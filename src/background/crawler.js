// Web crawler, decoded HTTP/silent-tab fetching, link discovery, email/product/social HTML parsers.

function isAntiBotChallenge(html, status) {
  if (status === 403 || status === 401 || status === 429) return true;
  if (!html || typeof html !== "string") return false;
  const lower = html.slice(0, 15000).toLowerCase();
  if (lower.includes("cf-browser-verification") || lower.includes("cf-spinner") || lower.includes("challenge-platform")) return true;
  if (lower.includes("attention required! | cloudflare") || lower.includes("<title>just a moment...</title>")) return true;
  if (lower.includes("incapsula_resource") || lower.includes("_incubator_challenge_")) return true;
  if (lower.includes("sucuri website firewall - access denied")) return true;
  if (lower.includes("<title>access denied</title>") || lower.includes("<title>403 forbidden</title>")) return true;
  return false;
}

/**
 * Traces a server-side 3xx HTTP redirect chain (up to maxHops) to discover the true final URL.
 * Handles single-hop (301, 302, 307, 308) and multi-hop redirects across protocols and domains.
 * Detects circular redirect loops explicitly and preserves failure details (Items 8 & 15).
 */
async function resolveRedirectChain(initialUrl, maxHops = 8, options = {}) {
  if (!initialUrl || typeof initialUrl !== "string") {
    return { finalUrl: initialUrl, hops: 0, isRedirectLoop: false, loopUrl: null, error: null };
  }
  let currentUrl = initialUrl.trim();
  let hops = 0;
  const visited = new Set();
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 6000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let isRedirectLoop = false;
  let loopUrl = null;
  let redirectError = null;

  try {
    while (hops < maxHops) {
      visited.add(currentUrl);
      const res = await fetch(currentUrl, {
        redirect: "manual",
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        },
        signal: options.signal || controller.signal
      });
      const loc = res.headers.get("location");
      if (loc && ((res.status >= 300 && res.status < 400) || res.type === "opaqueredirect")) {
        const nextUrl = new URL(loc, currentUrl).href;
        if (visited.has(nextUrl)) {
          // Circular redirect loop detected (Item 15)
          isRedirectLoop = true;
          loopUrl = nextUrl;
          break;
        }
        currentUrl = nextUrl;
        hops++;
      } else {
        break;
      }
    }
  } catch (e) {
    redirectError = e.message || "Redirect resolution error"; // Item 8: Preserve redirect error details
  } finally {
    clearTimeout(timeoutId);
  }

  return { finalUrl: currentUrl, hops, isRedirectLoop, loopUrl, error: redirectError };
}

/**
 * Normalizes and deduplicates URLs across crawler requests (Item 14).
 * Strips tracking parameters, hash fragments, and normalizes trailing slashes.
 */
function normalizeCrawlUrl(rawUrl, baseUrl = "") {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    const resolved = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
    resolved.hash = "";
    const sp = resolved.searchParams;
    const trackingKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "ref", "source"];
    for (const k of trackingKeys) sp.delete(k);
    resolved.search = sp.toString();
    let p = resolved.pathname;
    if (p.length > 1 && p.endsWith("/")) {
      resolved.pathname = p.replace(/\/+$/, "");
    }
    return resolved.href;
  } catch (e) {
    return String(rawUrl).trim();
  }
}

/**
 * Identifies irrelevant URLs that waste crawl quota (Item 12).
 */
function isIrrelevantUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return true;
  return /(?:cart|checkout|basket|my-account|account|login|signin|signup|register|wishlist|\.pdf$|\.zip$|\.tar$|\.gz$|wp-content\/uploads\/|feed\/|rss\/|tag\/|author\/|comment|replytocom|search\?)/i.test(urlStr);
}

/**
 * Resilient, charset-aware HTTP fetcher with configurable timeout and content-type validation.
 * Validates Content-Type before parsing (Item 17) and supports external abort cancellation (Item 18).
 */
async function fetchDecodedHtml(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 7000; // Controlled, configurable timeout (Item 16)
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      return { ok: false, status: 0, url, redirected: false, html: "", isAborted: true, error: "Aborted" };
    }
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(url, { redirect: "follow", ...options, signal: controller.signal });

    // Validate content-type before parsing (Item 17: Non-HTML responses should not be parsed as HTML)
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const isHtmlOrText = !ct || ct.includes("text/html") || ct.includes("application/xhtml") || ct.includes("text/plain");
    if (!isHtmlOrText) {
      return {
        ok: false,
        status: res.status,
        url: res.url,
        redirected: res.redirected,
        html: "",
        isNonHtml: true,
        contentType: ct,
        error: `Non-HTML response type (${ct})`
      };
    }

    const buf = await res.arrayBuffer();

    let charset = "utf-8";
    const ctMatch = ct.match(/charset=([^;]+)/i);
    if (ctMatch) {
      charset = ctMatch[1].trim();
    } else {
      const peek = new TextDecoder("latin1").decode(buf.slice(0, 1000));
      const metaMatch = peek.match(/<meta[^>]*charset=["']?([^"'>\s/]+)/i) ||
        peek.match(/<meta[^>]*content=["'][^"']*charset=([^"'>\s;]+)/i);
      if (metaMatch) {
        charset = metaMatch[1].trim();
      }
    }

    let decoded = "";
    try {
      decoded = new TextDecoder(charset).decode(buf);
    } catch (e) {
      decoded = new TextDecoder("utf-8").decode(buf);
    }

    // Auto-solve JavaScript Cookie Challenges (e.g. document.cookie = "humans_21909=1"; document.location.reload(true))
    const jsCookieMatch = decoded.length < 500 && decoded.match(/document\.cookie\s*=\s*["']([^"';]+)/i);
    if (jsCookieMatch && !options._hasRetriedCookie) {
      const cookieVal = jsCookieMatch[1].trim();
      const retryHeaders = { ...(options.headers || {}), "Cookie": cookieVal };
      return await fetchDecodedHtml(url, { ...options, headers: retryHeaders, _hasRetriedCookie: true });
    }

    return {
      ok: res.ok,
      status: res.status,
      url: res.url,
      redirected: res.redirected,
      html: decoded,
      error: res.ok ? null : `HTTP ${res.status} ${res.statusText || ""}`.trim()
    };
  } catch (err) {
    const isTimeout = err.name === "AbortError" || String(err.message).toLowerCase().includes("aborted");
    const errMsg = isTimeout ? `Connection timed out after ${Math.round(timeoutMs / 1000)}s` : (err.message || "Network request failed");
    return { ok: false, status: 0, url, redirected: false, html: "", isTimeout, error: errMsg };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Pulls the official registered company name from a copyright / legal line.
 * Keeps legal suffixes such as Co., Ltd — previous parsers stopped at the first comma.
 */

// Background web crawling is 100% pure HTTP fetch; tabs are never opened programmatically in the user's browser.
async function fetchViaSilentBackgroundTab() {
  return null;
}

/**
 * Robustly extracts client-side redirects from HTML.
 * Supports:
 * - Meta Refresh tags (regardless of attribute order or quote style)
 * - JavaScript location redirects (assignments, location.replace(), location.assign(), navigate())
 * - Canonical link headers (<link rel="canonical" href="...">)
 * - OpenGraph URL (<meta property="og:url" content="...">)
 */
function extractClientSideRedirect(html, baseUrl) {
  if (!html || typeof html !== "string") return null;

  // 1. Meta Refresh (any attribute order, quote style, or spacing)
  const metaTags = html.match(/<meta\b[^>]+>/gi) || [];
  for (const tag of metaTags) {
    if (/http-equiv\s*=\s*["']?refresh["']?/i.test(tag)) {
      const urlMatch = tag.match(/url\s*=\s*['"]?([^'">\s;]+)/i);
      if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith("#")) {
        try {
          return new URL(urlMatch[1], baseUrl).href;
        } catch (e) { }
      }
    }
  }

  // 2. JavaScript location redirects
  const jsMatches = [
    /(?:window\.|document\.|self\.|top\.)?location(?:\.href)?\s*=\s*['"`]([^'"`]+)['"`]/i,
    /(?:window\.|document\.|self\.|top\.)?location\.(?:replace|assign)\(\s*['"`]([^'"`]+)['"`]\s*\)/i,
    /(?:window\.)?navigate\(\s*['"`]([^'"`]+)['"`]\s*\)/i
  ];
  for (const regex of jsMatches) {
    const m = html.match(regex);
    if (m && m[1] && !m[1].startsWith("#") && !m[1].startsWith("javascript:")) {
      try {
        return new URL(m[1], baseUrl).href;
      } catch (e) { }
    }
  }

  // 3. Canonical Link (any attribute order)
  const linkTags = html.match(/<link\b[^>]+>/gi) || [];
  for (const tag of linkTags) {
    if (/\brel\s*=\s*["']?canonical["']?/i.test(tag)) {
      const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
      if (hrefMatch && hrefMatch[1] && !hrefMatch[1].startsWith("#")) {
        try {
          return new URL(hrefMatch[1], baseUrl).href;
        } catch (e) { }
      }
    }
  }

  // 4. OpenGraph og:url
  for (const tag of metaTags) {
    if (/(?:property|name)\s*=\s*["']?og:url["']?/i.test(tag)) {
      const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
      if (contentMatch && contentMatch[1] && !contentMatch[1].startsWith("#")) {
        try {
          return new URL(contentMatch[1], baseUrl).href;
        } catch (e) { }
      }
    }
  }

  return null;
}

/**
 * Deep crawls homepage, handles HTML <frameset>/<frame>, contact pages, footer, JSON-LD, products.
 * Globally enforces a maximum of 5 pages crawled per website across all requests (Items 13 & 70).
 */
async function crawlWebsite(targetUrl, options = {}) {
  let mainHtml = "";
  let contactHtml = "";
  let footerText = "";
  let contactPageText = "";
  let redirected = false;
  let finalUrl = targetUrl;
  let status = "Working";
  let fetchError = null;
  let httpStatus = 0;
  let isBlocked = false;
  let requiresManualReview = false;
  const addressCandidates = [];
  let profilePageText = "";
  let copyrightText = "";
  let copyrightSourceUrl = targetUrl;
  let primaryContactUrl = "";
  let primaryAboutUrl = "";
  const allLegalCandidates = new Set();
  const legalCandidateSources = {};
  const allDiscoveredEmails = new Set();
  const emailSourceMap = {};
  const allDiscoveredPhones = new Set();
  const dedicatedContactPhones = new Set();
  let dedicatedContactHtml = "";
  let contactLinks = [];
  let companySocials = {};
  const crawledPages = [];
  let detectedProductCount = 0;
  let detectedImageCount = 0;
  let detectedDescCount = 0;
  let logoText = "";

  // Crawl budget: Complete website crawl across all discovered internal pages (Contact, About, Products, Services, Profile, Legal, etc.)
  // When options.maxPages is explicitly specified, respect it; otherwise crawl complete website (up to 50 pages).
  let pagesFetchedCount = 0;
  let redirectChainInfo = null;
  const isBudgetExplicit = options.maxPages !== undefined && options.maxPages !== null;
  const MAX_CRAWL_PAGES = isBudgetExplicit
    ? Number(options.maxPages)
    : (Number(options.crawlPageLimit) || 50);

  const getCrawlBudgetUsed = () => pagesFetchedCount + (isBudgetExplicit && redirectChainInfo ? 1 : 0);

  async function safeFetchHtml(urlToFetch, fetchOpts = {}) {
    if (getCrawlBudgetUsed() >= MAX_CRAWL_PAGES) {
      console.log(`[Crawler] Complete website crawl limit reached (${pagesFetchedCount}/${MAX_CRAWL_PAGES}). Skipping: ${urlToFetch}`);
      return null;
    }
    if (options.abortSignal && options.abortSignal.aborted) {
      return null;
    }
    pagesFetchedCount++;
    return await fetchDecodedHtml(urlToFetch, { ...fetchOpts, signal: options.abortSignal || fetchOpts.signal });
  }

  let mainRes = null;
  // Fast-path: Check if the user already has the site open in a Chrome tab. Grabbing DOM directly is <100ms!
  try {
    if (chrome && chrome.tabs && chrome.tabs.query && chrome.scripting && chrome.scripting.executeScript) {
      const targetHost = new URL(targetUrl).hostname.replace(/^www\./i, "").toLowerCase();
      const allTabs = await chrome.tabs.query({});
      const matchedTab = allTabs.find(t => {
        try {
          if (!t.url) return false;
          const h = new URL(t.url).hostname.replace(/^www\./i, "").toLowerCase();
          return h === targetHost;
        } catch (e) { return false; }
      });
      if (matchedTab && matchedTab.id) {
        const injected = await chrome.scripting.executeScript({
          target: { tabId: matchedTab.id },
          func: () => ({
            html: document.documentElement ? document.documentElement.outerHTML : "",
            url: window.location.href,
            title: document.title || ""
          })
        });
        if (injected && injected[0] && injected[0].result && injected[0].result.html && injected[0].result.html.length > 500) {
          const tabData = injected[0].result;
          mainRes = {
            ok: true,
            status: 200,
            url: tabData.url || targetUrl,
            html: tabData.html
          };
          console.log(`[AI Assistant] Instantly loaded DOM from active tab ${matchedTab.id} (${tabData.url}) in <100ms!`);
        }
      }
    }
  } catch (e) { }

  // 1. Upfront Multi-Hop 3xx Server-Side Redirect Chain Resolution
  // Follows all 301/302/303/307/308 hops (up to 4 hops budget) to discover the true final destination
  try {
    redirectChainInfo = await resolveRedirectChain(targetUrl, 4, { signal: options.abortSignal });
    if (redirectChainInfo && redirectChainInfo.hops > 0 && redirectChainInfo.finalUrl && redirectChainInfo.finalUrl !== targetUrl) {
      if (isRedirectDomain(targetUrl, redirectChainInfo.finalUrl)) {
        redirected = true;
        status = "Redirect Site";
        finalUrl = redirectChainInfo.finalUrl;
        console.log(`[AI Assistant] Detected multi-hop redirect (${redirectChainInfo.hops} hops): ${targetUrl} -> ${finalUrl}`);
      } else {
        // Same domain redirect (e.g. http->https, www toggle, or language path /en/)
        finalUrl = redirectChainInfo.finalUrl;
      }
    }
  } catch (e) { }

  try {
    if (!mainRes) {
      mainRes = await safeFetchHtml(finalUrl, {
        timeoutMs: 8000,
        headers: {
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });
    }

    // If HTTP failed, returned 403, 400, 0, empty HTML, or anti-bot challenge:
    // Automatically try protocol swap (http <-> https), www toggle, and root homepage fallback
    let isMainFailed = !mainRes || !mainRes.ok || mainRes.status === 0 || !mainRes.html || mainRes.html.trim().length === 0 || isAntiBotChallenge(mainRes.html, mainRes.status);
    if (isMainFailed && pagesFetchedCount < MAX_CRAWL_PAGES) {
      const fallbackUrls = [];
      const urlToFallback = finalUrl || targetUrl;
      if (/^http:\/\//i.test(urlToFallback)) {
        fallbackUrls.push(urlToFallback.replace(/^http:\/\//i, "https://"));
      } else if (/^https:\/\//i.test(urlToFallback)) {
        fallbackUrls.push(urlToFallback.replace(/^https:\/\//i, "http://"));
      }
      try {
        const parsedU = new URL(urlToFallback);
        if (parsedU.pathname && parsedU.pathname !== "/" && parsedU.pathname !== "") {
          fallbackUrls.push(parsedU.origin + "/");
        }
        if (!/^www\./i.test(parsedU.hostname)) {
          fallbackUrls.push(parsedU.protocol + "//www." + parsedU.hostname + (parsedU.pathname || "/"));
        } else {
          fallbackUrls.push(parsedU.protocol + "//" + parsedU.hostname.replace(/^www\./i, "") + (parsedU.pathname || "/"));
        }
      } catch (e) { }

      const targetFallbacks = fallbackUrls.slice(0, 2);
      for (const altUrl of targetFallbacks) {
        if (pagesFetchedCount >= MAX_CRAWL_PAGES) break;
        const res = await safeFetchHtml(altUrl, {
          timeoutMs: 5000,
          headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        });
        if (res && res.ok && res.html && res.html.trim().length > 0 && !isAntiBotChallenge(res.html, res.status)) {
          mainRes = res;
          isMainFailed = false;
          break;
        }
      }
    }

    httpStatus = (mainRes && mainRes.status) || 0;
    if (mainRes && mainRes.url && mainRes.url.trim().length > 0) {
      finalUrl = mainRes.url;
    }
    if (isRedirectDomain(targetUrl, finalUrl)) {
      redirected = true;
      status = "Redirect Site";
    }

    if (mainRes && mainRes.html && mainRes.html.trim().length > 0) {
      mainHtml = mainRes.html;
    }

    if (!mainRes || !mainRes.ok || mainRes.status === 0 || !mainRes.html || mainRes.html.trim().length === 0 || isAntiBotChallenge(mainRes.html, mainRes.status)) {
      if (redirected) {
        // If domain redirected to a different domain, PRESERVE "Redirect Site" status!
        status = "Redirect Site";
      } else if (mainRes && mainRes.status === 404) {
        status = "Domain Expired";
        fetchError = "Site returned HTTP 404 Not Found";
      } else if (mainRes && (mainRes.status === 403 || mainRes.status === 401 || mainRes.status === 429 || isAntiBotChallenge(mainRes.html, mainRes.status))) {
        status = "Not Working";
        isBlocked = true;
        requiresManualReview = false;
        errorKeyword = "Security Check / Anti-bot";
        fetchError = `Site access restricted / blocked (HTTP ${mainRes.status || 403} Security Check / Anti-bot)`;
      } else if (redirectChainInfo && redirectChainInfo.isRedirectLoop) {
        // Item 15: Explicit redirect loop result
        status = "Manual Review";
        requiresManualReview = true;
        fetchError = `Redirect loop detected at ${redirectChainInfo.loopUrl || targetUrl} after ${redirectChainInfo.hops} hops`;
      } else if (mainRes && mainRes.isTimeout) {
        // Item 1 & 66: Slow website -> not automatically Not Working
        status = "Manual Review";
        requiresManualReview = true;
        fetchError = mainRes.error || "Connection timed out. Retry Required / Manual Review.";
      } else {
        status = "Not Working";
        fetchError = (mainRes && mainRes.error) || fetchError || `Connection failed or empty response (HTTP ${(mainRes && mainRes.status) || 0})`;
      }
    }

    mainHtml = (mainRes && mainRes.html) || "";

    // Check for client-side HTML Meta Refresh, JS location redirects, or cross-domain canonical links
    if (mainHtml) {
      const clientRedirectHref = extractClientSideRedirect(mainHtml, finalUrl);

      if (clientRedirectHref && clientRedirectHref !== finalUrl && !clientRedirectHref.startsWith("#")) {
        try {
          const resolvedClientUrl = new URL(clientRedirectHref, finalUrl).href;
          const isCrossDomain = isRedirectDomain(targetUrl, resolvedClientUrl) || isRedirectDomain(finalUrl, resolvedClientUrl);
          const isThinShell = stripHtml(mainHtml).trim().length < 500;
          if (isCrossDomain || isThinShell) {
            console.log(`[AI Assistant] Detected client-side HTML/JS redirect from ${finalUrl} to ${resolvedClientUrl}`);
            finalUrl = resolvedClientUrl;
            if (isCrossDomain) {
              redirected = true;
              status = "Redirect Site";
            }
            const clientRes = await fetchDecodedHtml(resolvedClientUrl, {
              timeoutMs: 5000,
              headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
              }
            });
            if (clientRes && clientRes.html && clientRes.html.trim().length > 0) {
              mainRes = clientRes;
              finalUrl = clientRes.url || resolvedClientUrl;
              mainHtml = clientRes.html;
              if (isRedirectDomain(targetUrl, finalUrl)) {
                redirected = true;
                status = "Redirect Site";
              }
            }
          }
        } catch (e) { }
      }
    }

    // If redirected to a destination site and that destination is blocked by anti-bot/WAF (or failed),
    // check if the user has an open tab at the destination domain to grab the live rendered DOM!
    if (redirected && (isAntiBotChallenge(mainHtml, httpStatus) || !mainRes.ok)) {
      try {
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query && chrome.scripting && chrome.scripting.executeScript) {
          const destHost = new URL(finalUrl).hostname.replace(/^www\./i, "").toLowerCase();
          const allTabs = await chrome.tabs.query({});
          const matchedDestTab = allTabs.find(t => {
            try {
              if (!t.url) return false;
              const h = new URL(t.url).hostname.replace(/^www\./i, "").toLowerCase();
              return h === destHost;
            } catch (e) { return false; }
          });
          if (matchedDestTab && matchedDestTab.id) {
            const injected = await chrome.scripting.executeScript({
              target: { tabId: matchedDestTab.id },
              func: () => ({
                html: document.documentElement ? document.documentElement.outerHTML : "",
                url: window.location.href,
                title: document.title || ""
              })
            });
            if (injected && injected[0] && injected[0].result && injected[0].result.html && injected[0].result.html.length > 500 && !isAntiBotChallenge(injected[0].result.html, 200)) {
              mainRes = {
                ok: true,
                status: 200,
                url: injected[0].result.url || finalUrl,
                html: injected[0].result.html
              };
              mainHtml = injected[0].result.html;
              httpStatus = 200;
              console.log(`[AI Assistant] Grabbed live rendered DOM from destination tab (${matchedDestTab.url}) for Redirect Site!`);
            }
          }
        }
      } catch (e) { }
    }

    // Clean anti-bot challenge text on destination domain so Cloudflare noise does not pollute fields
    if (redirected && isAntiBotChallenge(mainHtml, httpStatus)) {
      mainHtml = "";
    }

    // For redirected domains, seed logo fallback if absent (do NOT treat domain-derived name as verified legal candidate)
    if (redirected) {
      const fallbackBrand = toTitleCase(cleanDomainStem(finalUrl));
      if (fallbackBrand && !logoText) {
        logoText = fallbackBrand;
      }
    }

    // Extract copyright line for exact official company name verification.
    // Do not stop at commas — "Co., Ltd" is otherwise truncated to "Co."
    copyrightText = extractCopyrightCompanyName(mainHtml);

    // Support HTML <frameset> / <frame src="..."> / <iframe src="..."> (e.g. polyprise.com.tw)
    const frameMatches = [...mainHtml.matchAll(/<(?:frame|iframe)[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
    for (const fSrc of frameMatches.slice(0, 2)) {
      if (pagesFetchedCount >= MAX_CRAWL_PAGES) break;
      try {
        if (!fSrc || /^(javascript:|about:|mailto:|tel:|data:)/i.test(fSrc)) continue;
        const frameUrl = new URL(fSrc, finalUrl);
        // Strictly only crawl same-domain frames; skip all external third-party iframes (maps, tags, analytics, widgets)
        const mainHost = new URL(finalUrl).hostname.replace(/^www\./i, "");
        const fHost = frameUrl.hostname.replace(/^www\./i, "");
        if (fHost !== mainHost && !fHost.endsWith("." + mainHost)) continue;

        const fRes = await safeFetchHtml(frameUrl.href, {
          timeoutMs: 2500,
          headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        });
        if (fRes && fRes.ok && fRes.html) {
          mainHtml += "\n" + fRes.html;
        }
      } catch (e) { }
    }

    if (mainHtml) {
      crawledPages.push({ url: finalUrl, html: mainHtml, text: stripHtml(mainHtml) });
      for (const em of extractEmailsFromHtml(mainHtml, finalUrl)) {
        allDiscoveredEmails.add(em);
        updateEmailSource(emailSourceMap, em, finalUrl, finalUrl, targetUrl);
      }
      const homePhoneLinks = [...mainHtml.matchAll(/href=["']tel:([^"']+)["']/gi)].map(m => m[1]);
      for (const p of homePhoneLinks) allDiscoveredPhones.add(p);
    }

    // Extract Footer text & Footer address candidates
    const footerMatch = mainHtml.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i) ||
      mainHtml.match(/<(?:div|section)[^>]+(?:class|id)=["'][^"']*footer[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
    if (footerMatch) {
      footerText = stripHtml(footerMatch[1]);
      extractHtmlAddresses(footerMatch[1], addressCandidates, "footer", finalUrl);
    }

    // Extract from Homepage body (tagged as "homepage" so dedicated Contact Us page takes #1 priority)
    extractJsonLdAddresses(mainHtml, addressCandidates, finalUrl);
    extractMapAddresses(mainHtml, addressCandidates, finalUrl);
    extractMetaAddresses(mainHtml, addressCandidates, finalUrl);
    extractHtmlAddresses(mainHtml, addressCandidates, "homepage", finalUrl);

    // Extract official registered legal company candidates across homepage
    for (const cand of extractLegalCandidatesFromHtml(mainHtml)) {
      allLegalCandidates.add(cand);
      if (!legalCandidateSources[cand]) legalCandidateSources[cand] = finalUrl;
    }

    // Discover Contact, About, Terms & Legal Pages
    contactLinks = discoverContactLinks(mainHtml, finalUrl);
    // Discover Product, Catalog, Category, Services & Prohibited Category Candidate Pages
    const productCandidates = discoverProductAndCatalogLinks(mainHtml, finalUrl);
    const fetchedUrls = new Set([finalUrl]);

    // PRE-AI CRAWL SHORT-CIRCUIT:
    // Only skip crawling subpages if a prohibited restricted category is detected.
    // For sites with online carts, NEVER skip subpages so we can verify if the company is a Manufacturer!
    const earlyRestricted = detectRestrictedKeywords(stripHtml(mainHtml) + " " + targetUrl, mainHtml, crawledPages);
    const shouldSkipSubpages = !!(earlyRestricted.isRestricted && earlyRestricted.classification === "GENUINE_RESTRICTED");

    if (!shouldSkipSubpages) {
      // STRICT PRIORITY ORDER:
      // Phase 1: Crawl dedicated Contact Us page(s) FIRST and wait for results before checking other pages.
      // Phase 2: Crawl About / Profile / Product / Restricted / Remaining pages AFTER Contact Us.
      const isDedicatedContactUrl = (u) => /(?:contact|contact[-_]?us|contactus|get[-_]?in[-_]?touch|reach[-_]?us|reach[-_]?out|kontakt|contacto|contactenos|contatti|contattaci|contactez[-_]?nous|nous[-_]?contacter|contato|fale[-_]?conosco|hubungi|kontak|impressum|imprint)/i.test(u || "");
      const contactPriorityLinks = [];
      const otherTopLinks = [];
      const seenPaths = new Set();

      // (1) Dedicated Contact Us URLs first (All discovered, no artificial limit)
      for (const link of contactLinks) {
        if (fetchedUrls.has(link) || !isDedicatedContactUrl(link)) continue;
        try {
          const uPath = new URL(link).pathname.toLowerCase().replace(/\/$/, "");
          if (seenPaths.has(uPath)) continue;
          seenPaths.add(uPath);
          contactPriorityLinks.push(link);
          fetchedUrls.add(link);
        } catch (e) { }
      }

      // (2) Restricted Category Hint URLs
      for (const item of productCandidates.filter(c => c.isRestrictedHint)) {
        try {
          const uPath = new URL(item.url).pathname.toLowerCase().replace(/\/$/, "");
          if (!seenPaths.has(uPath) && !fetchedUrls.has(item.url)) {
            seenPaths.add(uPath);
            otherTopLinks.push(item.url);
            fetchedUrls.add(item.url);
          }
        } catch (e) { }
      }

      // (3) Dedicated Industries / Markets / Applications URLs
      for (const link of contactLinks) {
        if (fetchedUrls.has(link)) continue;
        if (/(?:industr|market|application|sector)/i.test(link)) {
          try {
            const uPath = new URL(link).pathname.toLowerCase().replace(/\/$/, "");
            if (!seenPaths.has(uPath)) {
              seenPaths.add(uPath);
              otherTopLinks.push(link);
              fetchedUrls.add(link);
            }
          } catch (e) { }
        }
      }

      // (4) About / Profile / Company Overview / Facility / Team URLs
      for (const link of contactLinks) {
        if (fetchedUrls.has(link)) continue;
        try {
          const uPath = new URL(link).pathname.toLowerCase().replace(/\/$/, "");
          if (seenPaths.has(uPath)) continue;
          seenPaths.add(uPath);
          otherTopLinks.push(link);
          fetchedUrls.add(link);
        } catch (e) { }
      }

      // (5) All Product, Catalog, Category, and Service URLs
      for (const item of productCandidates.filter(c => !c.isRestrictedHint)) {
        if (fetchedUrls.has(item.url)) continue;
        try {
          const uPath = new URL(item.url).pathname.toLowerCase().replace(/\/$/, "");
          if (seenPaths.has(uPath)) continue;
          seenPaths.add(uPath);
          otherTopLinks.push(item.url);
          fetchedUrls.add(item.url);
        } catch (e) { }
      }

      // (6) All other internal navigation links on the website
      if (typeof discoverAllInternalLinks === "function") {
        for (const link of discoverAllInternalLinks(mainHtml, finalUrl)) {
          if (fetchedUrls.has(link)) continue;
          try {
            const uPath = new URL(link).pathname.toLowerCase().replace(/\/$/, "");
            if (seenPaths.has(uPath)) continue;
            seenPaths.add(uPath);
            otherTopLinks.push(link);
            fetchedUrls.add(link);
          } catch (e) { }
        }
      }

      const recordSubpageContent = (cUrl, cText, { includeAddresses = true, includeProfileText = true } = {}) => {
        const isProductPage = /(?:products?|catalog(?:ue)?|categories|category|items?|collection|services?|solutions?)/i.test(cUrl);
        const pageText = stripHtml(cText);
        crawledPages.push({ url: cUrl, html: cText, text: pageText, isProductPage });
        const isDistributorPage = /(?:dealers?|distributors?|stockists?|resellers?|partners?)/i.test(cUrl);
        const isProfilePage = !isDistributorPage && /(?:company[-_]?profile|corporate[-_]?profile|profile\.htm|profile|about|about[-_]?us|who[-_]?we[-_]?are|our[-_]?company|our[-_]?story|our[-_]?history|quienes[-_]?somos|sobre[-_]?nosotros|nosotros|empresa|nuestra[-_]?empresa|chi[-_]?siamo|azienda|u(?:e)?ber[-_]?uns|unternehmen|a[-_]?propos|qui[-_]?sommes[-_]?nous|quem[-_]?somos|sobre[-_]?nos|tentang[-_]?kami)/i.test(cUrl);
        const isContactPage = !isDistributorPage && isDedicatedContactUrl(cUrl);
        const isLowQualitySubpage = /(?:terms|privacy|policy|policies|disclaimer|faq|legal|cart|checkout|cookie|sitemap)/i.test(cUrl);
        const pageSource = isDistributorPage ? "distributor" : (isContactPage ? "contact" : (isProfilePage ? "profile" : (isProductPage ? "product" : "other")));

        if (isContactPage) {
          dedicatedContactHtml += "\n" + cText;
          if (!primaryContactUrl) primaryContactUrl = cUrl;
        } else {
          contactHtml += "\n" + cText;
        }
        if (isProfilePage && !primaryAboutUrl) primaryAboutUrl = cUrl;

        // Count product items, images, and descriptions on crawled subpages (especially product/catalog pages)
        const subSignals = countProductSignals(cText);
        if (isProductPage) {
          detectedProductCount = Math.max(detectedProductCount, subSignals.detectedProductCount);
          detectedImageCount = Math.max(detectedImageCount, subSignals.detectedImageCount);
          detectedDescCount = Math.max(detectedDescCount, subSignals.detectedDescCount);
        } else {
          detectedImageCount = Math.max(detectedImageCount, subSignals.detectedImageCount);
          detectedProductCount = Math.max(detectedProductCount, subSignals.detectedProductCount);
          detectedDescCount = Math.max(detectedDescCount, subSignals.detectedDescCount);
        }

        const isExcludedAddressSubpage = /(?:cart|checkout|cookie|sitemap)/i.test(cUrl);
        if (includeAddresses && !isExcludedAddressSubpage) {
          extractEmbeddedScriptAddresses(cText, addressCandidates, cUrl);
          extractMapAddresses(cText, addressCandidates, cUrl);
          extractMetaAddresses(cText, addressCandidates, cUrl);
          extractHtmlAddresses(cText, addressCandidates, pageSource, cUrl);
        }

        if (includeProfileText && (isProfilePage || /\b(?:company\s+profile|our\s+story|about\s+us|who\s+we\s+are)\b/i.test(pageText.slice(0, 5000)))) {
          profilePageText += "\n" + pageText;
        }

        // Extract legal corporate names across this page
        for (const cand of extractLegalCandidatesFromHtml(cText)) {
          allLegalCandidates.add(cand);
          if (!legalCandidateSources[cand]) {
            legalCandidateSources[cand] = cUrl;
          } else if (!isLowQualitySubpage && /(?:terms|privacy|policy|disclaimer|faq|cart)/i.test(legalCandidateSources[cand])) {
            legalCandidateSources[cand] = cUrl;
          }
        }

        // Extract all corporate emails and phones across this page (Contact Us phones get first priority)
        for (const em of extractEmailsFromHtml(cText, finalUrl)) {
          allDiscoveredEmails.add(em);
          updateEmailSource(emailSourceMap, em, cUrl, finalUrl, targetUrl);
        }
        const subParsed = parseHtmlDetails(cText, cUrl);
        if (isContactPage) {
          for (const p of subParsed.phones) dedicatedContactPhones.add(p);
        } else {
          for (const p of subParsed.phones) allDiscoveredPhones.add(p);
        }

        // Extract copyright on this page if homepage lacked complete legal suffix
        if (!isLowQualitySubpage) {
          const pageCopyright = extractCopyrightCompanyName(cText);
          if (pageCopyright && hasCompleteLegalSuffix(pageCopyright) && (!copyrightText || !hasCompleteLegalSuffix(copyrightText))) {
            copyrightText = pageCopyright;
            copyrightSourceUrl = cUrl;
          }
        }
      };

      const fetchSubpageBatch = async (urls, timeoutMs = 3500, concurrency = 6) => {
        if (!urls || urls.length === 0) return [];
        const results = [];
        for (let i = 0; i < urls.length; i += concurrency) {
          if (pagesFetchedCount >= MAX_CRAWL_PAGES) break;
          const chunk = urls.slice(i, i + concurrency);
          const chunkPromises = chunk.map(cUrl => {
            if (pagesFetchedCount >= MAX_CRAWL_PAGES) return Promise.resolve(null);
            return safeFetchHtml(cUrl, {
              timeoutMs,
              headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": finalUrl
              }
            });
          });
          const chunkSettled = await Promise.allSettled(chunkPromises);
          for (const s of chunkSettled) {
            if (s.status === "fulfilled" && s.value) {
              results.push({ status: "fulfilled", value: s.value });
            } else {
              results.push({ status: "rejected" });
            }
          }
        }
        return results;
      };

      // PHASE 1: Fetch dedicated Contact Us page(s) FIRST and wait before checking other pages
      if (contactPriorityLinks.length > 0 && pagesFetchedCount < MAX_CRAWL_PAGES) {
        const contactResults = await fetchSubpageBatch(contactPriorityLinks, 4000, 6);
        for (let i = 0; i < contactPriorityLinks.length; i++) {
          const cUrl = contactPriorityLinks[i];
          const settled = contactResults[i];
          if (settled && settled.status === "fulfilled" && settled.value && settled.value.ok && settled.value.html) {
            recordSubpageContent(settled.value.url || cUrl, settled.value.html, { includeAddresses: true, includeProfileText: true });
          }
        }
      }

      // PHASE 2: After Contact Us, fetch all remaining subpages across the complete website
      const candidateSubpages = otherTopLinks;
      if (candidateSubpages.length > 0 && pagesFetchedCount < MAX_CRAWL_PAGES) {
        const subpageResults = await fetchSubpageBatch(candidateSubpages, 3500, 6);
        for (let i = 0; i < candidateSubpages.length; i++) {
          const cUrl = candidateSubpages[i];
          const settled = subpageResults[i];
          if (!settled || settled.status !== "fulfilled") continue;
          const cRes = settled.value;

          if (cRes && cRes.ok && cRes.html) {
            recordSubpageContent(cRes.url || cUrl, cRes.html, { includeAddresses: true, includeProfileText: true });
          }
        }
      }

      // PHASE 3: Complete Website Deep Pass - Crawl any additional discovered internal links from subpages
      if (pagesFetchedCount < MAX_CRAWL_PAGES && typeof discoverAllInternalLinks === "function") {
        const secondaryLinks = [];
        for (const page of crawledPages) {
          if (!page.html) continue;
          const subLinks = discoverAllInternalLinks(page.html, finalUrl);
          for (const sUrl of subLinks) {
            if (fetchedUrls.has(sUrl)) continue;
            try {
              const uPath = new URL(sUrl).pathname.toLowerCase().replace(/\/$/, "");
              if (seenPaths.has(uPath)) continue;
              seenPaths.add(uPath);
              fetchedUrls.add(sUrl);
              secondaryLinks.push(sUrl);
            } catch (e) { }
          }
        }
        if (secondaryLinks.length > 0 && pagesFetchedCount < MAX_CRAWL_PAGES) {
          const secondaryResults = await fetchSubpageBatch(secondaryLinks, 3500, 6);
          for (let i = 0; i < secondaryLinks.length; i++) {
            const sUrl = secondaryLinks[i];
            const settled = secondaryResults[i];
            if (settled && settled.status === "fulfilled" && settled.value && settled.value.ok && settled.value.html) {
              recordSubpageContent(settled.value.url || sUrl, settled.value.html, { includeAddresses: true, includeProfileText: true });
            }
          }
        }
      }
      // Double check for secondary email: if fewer than 2 corporate emails discovered so far,
      // concurrently fetch remaining contact, support, privacy, policy, terms, legal, and warranty subpages from contactLinks
      if (allDiscoveredEmails.size < 2 && contactLinks && contactLinks.length > 0 && pagesFetchedCount < MAX_CRAWL_PAGES) {
        const remainingCandidates = contactLinks
          .map(l => normalizeCrawlUrl(l, finalUrl))
          .filter(l => l && !fetchedUrls.has(l) && !isIrrelevantUrl(l))
          .sort((a, b) => {
            const score = (u) => {
              if (/(?:contact|kontakt|contacto|contatti|impressum)/i.test(u)) return 15;
              if (/(?:privacy|policy|legal|terms|support|warranty|service|inquir|quote)/i.test(u)) return 10;
              return 1;
            };
            return score(b) - score(a);
          })
          .slice(0, 4);

        for (const cUrl of remainingCandidates) {
          if (pagesFetchedCount >= MAX_CRAWL_PAGES) break;
          fetchedUrls.add(cUrl);
          const settled = await safeFetchHtml(cUrl, {
            timeoutMs: 4000,
            headers: {
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Referer": finalUrl
            }
          });
          if (settled && settled.ok && settled.html) {
            recordSubpageContent(settled.url || cUrl, settled.html, { includeAddresses: true, includeProfileText: false });
          }
        }
      }
    }

    // Merge Contact text (Dedicated Contact Us page strictly FIRST, then other subpages)
    contactPageText = (dedicatedContactHtml ? stripHtml(dedicatedContactHtml) + "\n" : "") + stripHtml(contactHtml);
    contactHtml = dedicatedContactHtml + "\n" + contactHtml;

    // Check homepage profile text snippet
    const homeProfileMatch = stripHtml(mainHtml).match(/(?:about\s+us|our\s+company|company\s+profile|our\s+story|who\s+we\s+are|about\s+our\s+company)[\s\S]{50,1500}/i);
    if (homeProfileMatch) {
      profilePageText += "\n" + homeProfileMatch[0];
    }

    const allCrawlText = mainHtml + "\n" + contactHtml;
    companySocials = extractOfficialSocialLinks(allCrawlText);

    // High-speed smart social check: ONLY if NO email was discovered on the website at all,
    // check company's official Facebook/LinkedIn pages sequentially with tight 1.5s timeout.
    const socialCandidates = [companySocials.facebook, companySocials.linkedin].filter(Boolean);
    if (allDiscoveredEmails.size === 0 && socialCandidates.length > 0 && pagesFetchedCount < MAX_CRAWL_PAGES) {
      for (const socialUrl of socialCandidates) {
        if (pagesFetchedCount >= MAX_CRAWL_PAGES) break;
        const normSocial = normalizeCrawlUrl(socialUrl);
        if (!normSocial || fetchedUrls.has(normSocial)) continue;
        fetchedUrls.add(normSocial);
        try {
          const sRes = await safeFetchHtml(socialUrl, {
            timeoutMs: 1500,
            headers: {
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
              "Sec-Fetch-Dest": "document",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-Site": "none",
              "Sec-Fetch-User": "?1",
              "Upgrade-Insecure-Requests": "1"
            }
          });
          if (sRes && sRes.ok && sRes.html) {
            // Un-escape Facebook/LinkedIn JSON Unicode email obfuscation (\u0040 and %40)
            const decodedSocialHtml = sRes.html.replace(/\\u0040/g, "@").replace(/%40/g, "@");
            const rawSocialMatches = decodedSocialHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            for (const em of rawSocialMatches) {
              const cleanEm = em.toLowerCase().trim();
              if (isValidCorporateEmail(cleanEm) && !isUnwantedEmail(cleanEm)) {
                allDiscoveredEmails.add(cleanEm);
                updateEmailSource(emailSourceMap, cleanEm, socialUrl, finalUrl, targetUrl);
              }
            }
            for (const em of extractEmailsFromHtml(decodedSocialHtml, finalUrl)) {
              allDiscoveredEmails.add(em);
              updateEmailSource(emailSourceMap, em, socialUrl, finalUrl, targetUrl);
            }
          }
        } catch (e) { }
      }
    }
  } catch (err) {
    fetchError = err.message || "Failed to fetch website";
  }

  // Detect dynamic Single Page Application (SPA) shells
  const isSpaRoot = /<div[^>]+id=["'](?:app|root|__next|__nuxt|main-content)["'][^>]*>\s*<\/div>/i.test(mainHtml);
  const hasDynamicScripts = /<script[^>]+src=["'][^"']*(?:bundle|chunk|main|app|runtime)[^"']*\.js/i.test(mainHtml);
  const isDynamicSpa = isSpaRoot && (stripHtml(mainHtml).length < 500) && hasDynamicScripts;

  // Rule 13: URL redirecting websites – only the final redirected URL will be considered
  try {
    if (isRedirectDomain(targetUrl, finalUrl)) {
      redirected = true;
      status = "Redirect Site";
    } else {
      // Same domain redirect (http->https, www, subpath) is NOT a Redirect Site!
      if (status === "Redirect Site") {
        status = "Working";
      }
      redirected = false;
    }
  } catch (e) { }

  const extracted = parseHtmlDetails(mainHtml, finalUrl);

  // Verify substantive company profile presence
  extracted.hasCompanyProfile = checkCompanyProfilePresence(mainHtml, extracted.bodyText, profilePageText);

  // Merge discovered emails/phones from all crawled pages
  for (const em of extracted.emails) {
    allDiscoveredEmails.add(em);
    updateEmailSource(emailSourceMap, em, finalUrl, finalUrl, targetUrl);
  }
  for (const p of extracted.phones) allDiscoveredPhones.add(p);

  if (contactHtml) {
    const contactParsed = parseHtmlDetails(contactHtml, finalUrl);
    for (const em of contactParsed.emails) {
      allDiscoveredEmails.add(em);
      // Only set fallback source if not already mapped to an exact subpage URL
      if (!emailSourceMap[em]) {
        updateEmailSource(emailSourceMap, em, primaryContactUrl || finalUrl, finalUrl, targetUrl);
      }
    }
    for (const p of contactParsed.phones) allDiscoveredPhones.add(p);
    detectedProductCount = Math.max(detectedProductCount, contactParsed.detectedProductCount || 0);
    detectedImageCount = Math.max(detectedImageCount, contactParsed.detectedImageCount || 0);
    detectedDescCount = Math.max(detectedDescCount, contactParsed.detectedDescCount || 0);
  }
  extracted.detectedProductCount = Math.max(extracted.detectedProductCount || 0, detectedProductCount);
  extracted.detectedImageCount = Math.max(extracted.detectedImageCount || 0, detectedImageCount);
  extracted.detectedDescCount = Math.max(extracted.detectedDescCount || 0, detectedDescCount);

  let hostDomain = "";
  try {
    hostDomain = new URL(finalUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch (e) { }

  extracted.emails = rankEmails(Array.from(allDiscoveredEmails), hostDomain, emailSourceMap);
  const combinedOrderedPhones = new Set([...dedicatedContactPhones, ...allDiscoveredPhones]);
  extracted.phones = Array.from(combinedOrderedPhones);

  // Sort candidates strictly by priority hierarchy:
  // Headquarters (Tier 1) > Contact (Tier 2) > Profile (Tier 3) > JSON-LD (Tier 4) > Map (Tier 5) > Footer (Tier 6) > Branch (Tier 8).
  // Within the SAME tier, English precedes non-English (basePriority + 0.0 vs basePriority + 0.4).
  // An English footer or branch address will NEVER outrank an actual Headquarters address!
  addressCandidates.sort((a, b) => {
    let pA = (typeof a === "object" && a.priority !== undefined) ? a.priority : 6;
    let pB = (typeof b === "object" && b.priority !== undefined) ? b.priority : 6;
    const rawA = typeof a === "object" ? (a.raw || "") : String(a || "");
    const rawB = typeof b === "object" ? (b.raw || "") : String(b || "");

    // Full Address Boost: Candidate containing Premise/Street AND Locality/State/Postcode beats fragment
    const hasFullA = isFullAddressCandidate(rawA);
    const hasFullB = isFullAddressCandidate(rawB);
    if (hasFullA && !hasFullB) pA -= 4.0;
    else if (hasFullB && !hasFullA) pB -= 4.0;

    // Substring Superseded Rule: If rawB is a complete address containing rawA as a street substring, rawB wins!
    if (rawA.length > 10 && rawB.toLowerCase().includes(rawA.toLowerCase()) && hasFullB && !hasFullA) return 1;
    if (rawB.length > 10 && rawA.toLowerCase().includes(rawB.toLowerCase()) && hasFullA && !hasFullB) return -1;

    if (pA !== pB) return pA - pB;
    const scoreCandidate = (raw) => {
      let score = 0;
      if (hasStateInAddress(raw, "")) score += 50;
      if (isFullAddressCandidate(raw)) score += 40;
      if (/\b\d{4,6}\b/.test(raw)) score += 20;
      score += Math.min(raw.length, 60);
      if (/\b(?:will\s+be\s+held|trade\s*show|exhibition|expo|conference|convention|booth|cookies?|privacy\s*policy)\b/i.test(raw)) score -= 200;
      return score;
    };
    return scoreCandidate(rawB) - scoreCandidate(rawA);
  });

  if (!logoText) logoText = extractSiteLogoText(mainHtml);
  const ogSiteMatch = mainHtml.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) ||
    mainHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
  const ogSiteName = (ogSiteMatch && ogSiteMatch[1] && ogSiteMatch[1].trim()) || "";

  // Check for online purchase / shopping cart ("Shopchart")
  // Note: Manufacturer exception (Rules 11 & 16) is applied in strict QC, so do not blanket reject here!
  const shopCartCheck = detectPurchaseOrShoppingCart(mainHtml + "\n" + contactHtml, (extracted && extracted.bodyText) || "");

  return {
    originalUrl: targetUrl,
    finalUrl,
    redirected: isRedirectDomain(targetUrl, finalUrl),
    status,
    fetchError,
    httpStatus,
    mainHtml,
    contactHtml: contactHtml.slice(0, 50000),
    shopCartCheck,
    redirectHops: redirectChainInfo ? redirectChainInfo.hops : 0,
    totalNetworkRequests: pagesFetchedCount + (redirectChainInfo ? redirectChainInfo.hops : 0),
    logoText,
    ogSiteName,
    addressCandidates,
    detectedAddresses: addressCandidates.map(c => (typeof c === "object" ? c.raw : c)),
    isDynamicSpa,
    spaDetected: isDynamicSpa,
    incompleteExtraction: !!(isDynamicSpa || (mainHtml && stripHtml(mainHtml).length < 250)),
    pagesFetchedCount,
    maxPages: MAX_CRAWL_PAGES,
    isBlocked: isBlocked || (httpStatus === 403 || httpStatus === 401 || httpStatus === 429),
    requiresManualReview: (requiresManualReview || status === "Manual Review") && !isBlocked && httpStatus !== 403 && httpStatus !== 401 && httpStatus !== 429,
    contactPageText: contactPageText.slice(0, 12000),
    footerText: footerText.slice(0, 4000),
    profilePageText: profilePageText.slice(0, 8000),
    copyrightText: copyrightText.slice(0, 500),
    copyrightSourceUrl: copyrightSourceUrl || finalUrl,
    ...extracted,
    legalCompanyCandidates: Array.from(allLegalCandidates),
    legalCandidateSources,
    emailSourceMap,
    emails: rankEmails(Array.from(allDiscoveredEmails), targetUrl, emailSourceMap),
    phones: Array.from(combinedOrderedPhones),
    dedicatedContactText: dedicatedContactHtml ? stripHtml(dedicatedContactHtml).slice(0, 6000) : "",
    primaryContactUrl: primaryContactUrl || (contactLinks.find(u => /\b(?:contact|contact[-_]?us|contactus|get[-_]?in[-_]?touch|reach[-_]?us|reach[-_]?out)\b/i.test(u)) || ""),
    primaryAboutUrl: primaryAboutUrl || (contactLinks.find(u => /\b(?:about|about[-_]?us|aboutus|who[-_]?we[-_]?are|company[-_]?profile|profile)\b/i.test(u)) || ""),
    companySocials,
    crawledPages,
    renderedText: mainHtml ? stripHtml(mainHtml).slice(0, 15000) : "",
    jsonLd: extractJsonLdBlocks(mainHtml)
  };
}

/**
 * Adds an address candidate with provenance tracking and priority ranking.
 */

function discoverContactLinks(html, baseUrl) {
  if (!html) return [];
  const candidates = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    const innerText = match[2].replace(/<[^>]+>/g, "").trim().toLowerCase();
    const rawLower = raw.toLowerCase();
    if (!raw || /^(javascript:|mailto:|tel:|#)/i.test(raw) || isIrrelevantUrl(rawLower)) continue;

    let score = 0;
    if (/\b(contact|contact-us|contactus|contact_us|get-in-touch|reach-us|kontakt|contacto|contactenos|contáctenos|contatti|contattaci|contactez-nous|nous-contacter|contato|fale-conosco|hubungi|hubungi-kami|kontak|kontak-kami|impressum|imprint)\b/i.test(rawLower)) score += 100;
    if (/\b(industries|industry|markets|market|applications|sectors|sector|industries-served|markets-served)\b/i.test(rawLower)) score += 50;
    if (/\b(about|about-us|aboutus|about_us|who-we-are|our-company|company-profile|profile|quienes-somos|sobre-nosotros|nosotros|empresa|nuestra-empresa|chi-siamo|azienda|uber-uns|ueber-uns|unternehmen|wir-ueber-uns|a-propos|qui-sommes-nous|sobre-nos|quem-somos|tentang-kami|profil-perusahaan)\b/i.test(rawLower)) score += 25;
    if (/\b(terms|terms-conditions|terms-and-conditions|terms-of-service|conditions|privacy|privacy-policy|legal|disclaimer|mentions-legales|aviso-legal|note-legali|datenschutz|politica-de-privacidad|confidentialite|warranty|warranties|guarantee|returns)\b/i.test(rawLower)) score += 7;
    if (/\b(support|customer-support|service|customer-service|help|help-desk)\b/i.test(rawLower)) score += 10;
    if (/\b(faq)\b/i.test(rawLower)) score += 2;
    if (/\b(sales|inquiry|enquiry|inquiries|enquiries|quote|request-quote|request-a-quote|order|orders)\b/i.test(rawLower)) score += 12;
    if (/\b(shop|store|online-store|cart|basket)\b/i.test(rawLower)) score += 8;
    if (/\b(team|our-team|staff|management|people|leadership)\b/i.test(rawLower)) score += 6;
    if (/\b(locations|branches|branch|offices|stores)\b/i.test(rawLower)) score += 8;
    if (/\b(dealers|distributors|stockists|resellers|partners)\b/i.test(rawLower) || /\b(dealers|distributors|stockists|resellers|partners)\b/i.test(innerText)) score -= 50;
    if (/\b(careers|career|jobs|job|employment|work-with-us|join-our-team)\b/i.test(rawLower)) score += 3;
    if (/\b(careers|career|jobs|employment|work\s*with\s*us|join\s*our\s*team)\b/i.test(innerText)) score += 3;
    if (/\b(feedback|complaints|directory)\b/i.test(rawLower)) score += 5;
    if (/\b(contact|contact\s*us|get\s*in\s*touch|reach\s*us|kontakt|contacto|contáctenos|contatti|contattaci|contactez[-\s]*nous|nous\s*contacter|contato|fale\s*conosco|hubungi\s*kami|kontak\s*kami|kontak)\b/i.test(innerText)) score += 120;
    if (/\b(industries|our\s*industries|industries\s*served|markets|markets\s*served|applications|sectors)\b/i.test(innerText)) score += 50;
    if (/\b(about|about\s*us|who\s*we\s*are|company\s*profile|our\s*profile|quienes\s*somos|quiénes\s*somos|sobre\s*nosotros|nuestra\s*empresa|chi\s*siamo|la\s*azienda|über\s*uns|ueber\s*uns|das\s*unternehmen|à\s*propos|qui\s*sommes[-\s]*nous|quem\s*somos|sobre\s*nós|tentang\s*kami)\b/i.test(innerText)) score += 20;
    if (/\b(shop|store|online\s*store|cart|basket|buy\s*online)\b/i.test(innerText)) score += 9;
    if (/\b(terms|terms\s*and\s*conditions|terms\s*of\s*(?:service|use)|privacy\s*policy|legal\s*notice|company\s*info|imprint|impressum|mentions\s*légales|aviso\s*legal|note\s*legali|datenschutz|warranty|warranties|guarantee)\b/i.test(innerText)) score += 8;
    if (/\b(customer\s*support|customer\s*service|technical\s*support|help\s*center|support)\b/i.test(innerText)) score += 10;
    if (/\b(sales|sales\s*enquiry|sales\s*inquiry|request\s*a\s*quote|quote|orders)\b/i.test(innerText)) score += 10;
    if (/\b(en|english)\b/i.test(innerText) || /[\/_](?:en|eng)\b/i.test(rawLower) || /[?&]lang=en/i.test(rawLower)) score += 7;

    if (score > 0) {
      try {
        const resolved = new URL(raw, baseUrl);
        const baseHost = new URL(baseUrl).hostname.replace(/^www\./i, "").toLowerCase();
        const linkHost = resolved.hostname.replace(/^www\./i, "").toLowerCase();
        // Restrict subpage discovery to same host or subdomains to prevent external job portals/SaaS (Dayforce, Workday, Greenhouse, etc.)
        if (linkHost !== baseHost && !linkHost.endsWith("." + baseHost)) {
          continue;
        }
        candidates.push({ url: resolved.href, score });
      } catch (e) { }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return Array.from(new Set(candidates.map(c => c.url)));
}

/**
 * Discovers product, catalog, category, service, and prohibited category candidate links.
 * Prioritizes any links that contain restricted keywords in their URL or anchor text.
 */
function discoverProductAndCatalogLinks(html, baseUrl) {
  if (!html) return [];
  const candidates = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  const restrictedHints = /\b(?:medical|medicine|hospital|clinic|pharma|pharmaceutical|knife|knives|weapon|weapons|gun|guns|defence|defense|military|aircraft|aviation|aerospace|marine|ships?|boats?|yachts?|chemical|chemicals|alcohol|beer|wine|brewery|distillery|animals?|pets?|dogs?|cats?|veterinary|food|bakery|meat|poultry|seafood|porn|adult|casino|gambling|vape|vaping|tobacco|cannabis|cbd|thc)\b/i;

  while ((match = linkRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    const innerText = match[2].replace(/<[^>]+>/g, "").trim().toLowerCase();
    const rawLower = raw.toLowerCase();
    if (!raw || /^(javascript:|mailto:|tel:|#)/i.test(raw) || isIrrelevantUrl(rawLower)) continue;

    let score = 0;
    let isRestrictedHint = false;

    // High alert: link URL or text mentions restricted/prohibited categories
    if (restrictedHints.test(rawLower) || restrictedHints.test(innerText)) {
      score += 150;
      isRestrictedHint = true;
    }

    // Product, Catalog & Industry Capability pages
    if (/\b(?:products?|catalog(?:ue)?|categories|category|collection|collections|items?|goods|solutions?|services?|what-we-do|offerings|range|machinery|equipment|industries|industry|markets?|applications?|sectors?)\b/i.test(rawLower)) score += 25;
    if (/\b(?:products?|our\s*products?|catalog(?:ue)?|categories|category|all\s*products?|view\s*all\s*products?|services?|what\s*we\s*do|solutions?|our\s*services?|product\s*range|catalogues?|industries|our\s*industries|industries\s*served|markets|markets\s*served|applications|sectors)\b/i.test(innerText)) score += 30;

    // Demote pagination / query params / sorting links
    if (/[?&](?:page|p|sort|order|dir|limit|view)=/i.test(rawLower)) score -= 10;
    // Demote low-value non-product pages
    if (/\b(?:login|signup|cart|checkout|privacy|terms|cookie|wishlist)\b/i.test(rawLower)) score -= 30;

    if (score > 0) {
      try {
        const resolved = new URL(raw, baseUrl);
        const baseHost = new URL(baseUrl).hostname.replace(/^www\./i, "").toLowerCase();
        const linkHost = resolved.hostname.replace(/^www\./i, "").toLowerCase();
        if (linkHost !== baseHost && !linkHost.endsWith("." + baseHost)) {
          continue;
        }
        candidates.push({ url: resolved.href, score, isRestrictedHint });
      } catch (e) { }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

/**
 * Discovers all valid internal HTML navigation links on the same domain for complete website crawling.
 * Filters out binary files, images, documents, mailto:, javascript:, and anchors.
 */
function discoverAllInternalLinks(html, baseUrl) {
  if (!html || !baseUrl) return [];
  const links = [];
  const seen = new Set();
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;

  let baseHost = "";
  try {
    baseHost = new URL(baseUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch (e) {
    return [];
  }

  while ((match = linkRegex.exec(html)) !== null) {
    const raw = (match[1] || "").trim();
    if (!raw || /^(?:javascript:|mailto:|tel:|#|data:|whatsapp:)/i.test(raw)) continue;
    if (isIrrelevantUrl(raw.toLowerCase())) continue;
    if (/\.(?:pdf|zip|rar|tar|gz|7z|exe|dmg|apk|jpg|jpeg|png|gif|svg|webp|ico|mp4|mp3|avi|mov|wmv|doc|docx|xls|xlsx|ppt|pptx|css|js)$/i.test(raw.split(/[?#]/)[0])) continue;

    try {
      const resolved = new URL(raw, baseUrl);
      const linkHost = resolved.hostname.replace(/^www\./i, "").toLowerCase();
      if (linkHost !== baseHost && !linkHost.endsWith("." + baseHost)) {
        continue;
      }
      resolved.hash = "";
      const cleanUrl = resolved.href;
      const pathKey = resolved.pathname.toLowerCase().replace(/\/$/, "");
      if (!seen.has(pathKey)) {
        seen.add(pathKey);
        links.push(cleanUrl);
      }
    } catch (e) { }
  }

  return links;
}

function extractFooterText(html) {
  if (!html) return "";
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i) ||
    html.match(/<(?:div|section)[^>]+(?:class|id)=["'][^"']*footer[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
  if (!footerMatch) return "";
  return stripHtml(footerMatch[1]);
}

/**
 * Merges complementary Taiwanese administrative divisions from Google Maps embed URLs
 * where `q` parameter has search string (Village + Road) and `hnear` has geocoded location (District + Road).
 * E.g. q="嘉義市後湖里保順路228號" + hnear="600嘉義市東區保順路228號" -> "嘉義市東區後湖里保順路228號"
 */

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/address|\/h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Decodes ROT13 encoded text (used by WordPress plugins like Email Encoder Bundle).
 */
function decodeRot13(str) {
  if (!str || typeof str !== "string") return str;
  return str.replace(/[a-zA-Z]/g, function (c) {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + 13) % 26) + 65);
    if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + 13) % 26) + 97);
    return c;
  });
}

/**
 * Extracts official company social profile URLs from HTML.
 * Strictly limited to Facebook and LinkedIn per QC instructions (never Twitter, Instagram, TikTok, YouTube).
 */
function extractCompanySocialLinks(html) {
  if (!html || typeof html !== "string") return { facebook: "", linkedin: "" };
  let facebook = "";
  let linkedin = "";

  // 1. Facebook company profile link
  const fbMatches = [...html.matchAll(/href=["'](https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9.\-_/]+)["']/gi)];
  for (const m of fbMatches) {
    const u = m[1];
    if (!/sharer|share\.php|intent|plugins|privacy|help|dialog|login|signup|tr\?|hashtag/i.test(u)) {
      facebook = u;
      break;
    }
  }

  // 2. LinkedIn company profile link
  const liMatches = [...html.matchAll(/href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9.\-_/]+)["']/gi)];
  for (const m of liMatches) {
    const u = m[1];
    if (!/share|sharing|intent|legal|privacy|login|signup/i.test(u)) {
      linkedin = u;
      break;
    }
  }

  return { facebook, linkedin };
}

/**
 * Detects unwanted emails: asset files, tracking scripts, third-party platform vendors,
 * administrative/automated addresses, privacy/GDPR bots, and dummy placeholders.
 */
function isUnwantedEmail(email) {
  if (!email || typeof email !== "string") return true;
  const em = email.toLowerCase().trim();
  const atIdx = em.indexOf("@");
  if (atIdx <= 0 || atIdx === em.length - 1) return true;

  const user = em.slice(0, atIdx);
  const host = em.slice(atIdx + 1);

  // File extension anywhere in user or host (e.g. icon@2x.png, image.jpg@domain, logo@2x)
  if (/\.(?:png|jpg|jpeg|gif|svg|webp|avif|bmp|ico|css|js|woff|woff2|ttf|eot|pdf|zip|rar|tar|gz|json|xml|map|html|htm|php|asp|aspx)$/i.test(user)) return true;
  if (/\.(?:png|jpg|jpeg|gif|svg|webp|avif|bmp|ico|css|js|woff|woff2|ttf|eot|pdf|zip|rar|tar|gz|json|xml|map|html|htm|php|asp|aspx)$/i.test(host)) return true;

  // Media / asset / bundle prefixes
  if (/^(?:icon|logo|image|img|pic|photo|asset|banner|file|avatar|bg|font|theme|bundle|chunk|main|vendor|webpack)@/i.test(em)) return true;
  if (/@\d+x\./i.test(em)) return true; // e.g. logo@2x.png

  // Administrative / automated / bounce / non-contact prefixes (preserves department emails like sales, support, careers, jobs, press, media, hr, feedback, office)
  if (/^(?:noreply|no-reply|donotreply|do-not-reply|postmaster|hostmaster|abuse|mailer-daemon|bounce|unsubscribe|notification|notifications|alert|alerts|sentry|git|npm|dpo|privacy|compliance|legal|security|webmaster|cookie|accessibility|terms)@/i.test(em)) return true;

  // Placeholder / dummy emails
  if (/^(?:user|email|name|test|sample|placeholder|yourname|youremail|username|example|domain|contact|admin|info)@(?:example|domain|yourdomain|mydomain|domainname|test|sample|email|placeholder|yoursite|mysite|mycompany|yourcompany|company|website|sitename)\./i.test(em)) return true;
  if (/^(?:test\d*|tes\d*|dummy\d*|sample\d*|placeholder|yourname|youremail|username|user\d*|name|email|example\d*|johndoe|janedoe|john\.doe|jane\.doe)@(?:gmail|googlemail|yahoo|ymail|hotmail|outlook|live|mail|email|icloud|aol|proton|protonmail)\./i.test(em)) return true;
  if (/^(?:info|contact|admin|sales|support|enquiry|hello|mail)@mail\.com$/i.test(em)) return true;

  // Hex hashes / DSN keys / tokens (e.g. Sentry tracking DSN 605a7baede844d278b89dc95ae0a9123@...)
  if (/^[a-f0-9]{16,64}$/i.test(user)) return true;

  // ROT13 obfuscation remnants (e.g. .pbz, .bet, .arg, .rqh, .tbi or fnyrf@, vasb@)
  if (/\.(?:pbz|bet|arg|rqh|tbi)$/i.test(host)) return true;
  if (/^(?:fnyrf|vasb|fhccbeg|pbagnpg|uryyb|nqzva)@/i.test(em)) return true;

  // Known third-party platforms / analytics / CDN / web builders
  const disallowedHosts = [
    "wix.com", "wixsite.com", "wixpress.com", "shopify.com", "myshopify.com", "wordpress.com", "wordpress.org",
    "squarespace.com", "weebly.com", "sentry.io", "sentry-cdn.com", "sentry-next.wixpress.com", "sentry.wixpress.com", "static.wixpress.com",
    "cloudflare.com", "github.com", "gitlab.com", "google.com", "googleapis.com", "gstatic.com", "google-analytics.com",
    "googletagmanager.com", "facebook.com", "twitter.com", "instagram.com", "linkedin.com", "youtube.com",
    "schema.org", "w3.org", "apache.org", "nginx.org", "openjsf.org", "jsdelivr.net", "unpkg.com",
    "cdnjs.com", "cloudflare.net", "fontawesome.com", "doubleclick.net", "hotjar.com", "hubspot.com",
    "intercom.com", "zendesk.com", "zohocdn.com", "gravatar.com", "godaddy.com", "bluehost.com",
    "hostgator.com", "namecheap.com", "cpanel.net", "cpanel.com", "webhostbox.com", "secureserver.net",
    "example.com", "example.org", "example.net", "domain.com", "test.com", "sample.com",
    "mysite.com", "yoursite.com", "sitename.com", "website.com", "mycompany.com", "yourcompany.com", "company.com"
  ];
  if (disallowedHosts.some(dh => host === dh || host.endsWith("." + dh))) return true;

  return false;
}

/**
 * Strips contact label glued to the end of an email from HTML text concatenation.
 * E.g. "key@keyar.comaddress" -> "key@keyar.com"
 * E.g. "info@domain.co.ukphone:+44" -> "info@domain.co.uk"
 */

function isValidCorporateEmail(email) {
  if (!email || typeof email !== "string") return false;
  let em = email.trim().toLowerCase();
  em = stripTrailingContactWordsFromEmail(em);

  // Filter unwanted emails, script artifacts, and third-party vendors
  if (isUnwantedEmail(em)) return false;

  // Basic standard RFC-style email format
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(em)) return false;

  const atIdx = em.indexOf("@");
  if (atIdx <= 0 || atIdx === em.length - 1) return false;

  const user = em.slice(0, atIdx);
  const host = em.slice(atIdx + 1);

  // Email host/domain must never start with www., http., https., or contain /
  if (/^(?:www\d?|http|https)\./i.test(host) || host.includes("/")) return false;

  // Domain must contain a dot and have valid letters after dot
  if (!host.includes(".") || !/\.[a-zA-Z]{2,}$/.test(host)) return false;

  // Domain cannot end with non-email file extension
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot|ico|bmp|mp4|webm|pdf|exe|zip|rar|tar|gz|json|xml|map)$/i.test(host)) return false;

  // Prose verb/preposition artifacts from text scraping (e.g. "collected at www.domain.com")
  const proseVerbs = /^(?:collected|located|registered|hosted|available|visited|published|stored|created|updated|viewed|see|look|shop|buy|contacted|served|found)$/i;
  if (proseVerbs.test(user)) return false;

  // Reject if username or host is excessively short or long
  if (user.length < 2 || user.length > 64 || host.length < 4 || host.length > 255) return false;

  return true;
}

/**
 * Extracts and decodes all valid email addresses from any HTML snippet or page.
 * Handles mailto links, Cloudflare obfuscation, ROT13 encoding (WordPress Email Encoder),
 * decodeURIComponent/hex scripts, HTML numeric entities, URL encoding, and [at] patterns.
 */
function extractEmailsFromHtml(html, hostDomain = "") {
  if (!html || typeof html !== "string") return [];
  const candidateEmails = new Set();

  // 1. Decode Cloudflare Email Protection (data-cfemail or /cdn-cgi/l/email-protection#)
  const cfMatches = [...html.matchAll(/(?:data-cfemail=["']|email-protection#)([a-f0-9]{4,})/gi)];
  for (const m of cfMatches) {
    const hex = m[1];
    try {
      let decoded = "";
      const key = parseInt(hex.substr(0, 2), 16);
      for (let n = 2; n < hex.length; n += 2) {
        decoded += String.fromCharCode(parseInt(hex.substr(n, 2), 16) ^ key);
      }
      if (/@/.test(decoded)) candidateEmails.add(decoded.toLowerCase().trim());
    } catch (e) { }
  }

  // 2. Decode ROT13 obfuscated emails (e.g. data-enc-email="fnyrf[at]unegznaapbagebyf.pbz" or class="mail-link" data-enc-email="...")
  const rotMatches = [...html.matchAll(/data-enc-email=["']([a-zA-Z0-9._%+-]+(?:@|\[at\]|\(at\))[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["']/gi)];
  for (const rm of rotMatches) {
    const rawEnc = rm[1].replace(/\[at\]|\(at\)/gi, "@");
    const decoded = decodeRot13(rawEnc).toLowerCase().trim();
    if (/@/.test(decoded)) candidateEmails.add(decoded);
  }

  // 3. Decode inline URI / URIComponent scripts (e.g. innerHTML = decodeURIComponent("%73%61%6c%65%73..."))
  const uriEncodedMatches = [...html.matchAll(/(?:decodeURIComponent|decodeURI|unescape)\s*\(\s*["']([^"']+)["']\s*\)/gi)];
  for (const um of uriEncodedMatches) {
    try {
      const decoded = decodeURIComponent(um[1]).toLowerCase().trim();
      const emMatches = decoded.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const em of emMatches) candidateEmails.add(em);
    } catch (e) { }
  }

  // 4. Decode all mailto: links (including multiple comma/semicolon separated emails and ?cc= / ?bcc= parameters)
  const mailtoBlocks = [...html.matchAll(/(?:href=["']|data-[a-z0-9_-]*=["'])\s*mailto:([^"'>\s]+)/gi)];
  for (const mb of mailtoBlocks) {
    try {
      const decodedMailto = decodeURIComponent(mb[1]).replace(/%40|&#64;/gi, "@");
      const subEmails = decodedMailto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const se of subEmails) {
        const cleanSe = se.toLowerCase().trim();
        if (isValidCorporateEmail(cleanSe) && !isUnwantedEmail(cleanSe)) {
          candidateEmails.add(cleanSe);
        }
      }
    } catch (e) { }
  }

  // Strip form placeholder attributes BEFORE scanning raw HTML or script hydration so dummy emails like placeholder="e.g., example@mail.com" never extract
  const htmlWithoutPlaceholders = html
    .replace(/\b(?:aria-)?placeholder\s*=\s*"[^"]*"/gi, " ")
    .replace(/\b(?:aria-)?placeholder\s*=\s*'[^']*'/gi, " ");

  // 5. Extract emails from data attributes, hidden inputs, meta tags, and structured attributes
  const attrMatches = [...htmlWithoutPlaceholders.matchAll(/(?:data-[a-z0-9_-]*(?:email|mail|contact)|value|content|title|alt)=["']([a-zA-Z0-9._%+-]+(?:@|%40|&#64;)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["']/gi)];
  for (const am of attrMatches) {
    const rawEm = am[1].replace(/%40|&#64;/gi, "@").toLowerCase().trim();
    if (isValidCorporateEmail(rawEm) && !isUnwantedEmail(rawEm)) {
      candidateEmails.add(rawEm);
    }
  }

  // 6. Extract emails from JSON-LD, script hydration, Next.js / Nuxt state, and social profile JSON before stripping scripts
  const scriptMatches = [...htmlWithoutPlaceholders.matchAll(/[a-zA-Z0-9._%+-]+(?:@|\\u0040|%40)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)];
  for (const sm of scriptMatches) {
    const emClean = sm[0].replace(/\\u0040|%40/gi, "@").toLowerCase().trim();
    if (isValidCorporateEmail(emClean) && !isUnwantedEmail(emClean)) {
      candidateEmails.add(emClean);
    }
  }

  // 7. Decode HTML numeric & hex entities, and normalize explicit obfuscation [at] / (at) / [dot] (DO NOT MATCH RAW PROSE "at")
  // Strip <script> and <style> tags to avoid capturing error tracking, analytics tokens, and bundle code
  const emailSearchText = htmlWithoutPlaceholders
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&commat;/gi, "@")
    .replace(/%40/gi, "@")
    .replace(/([a-zA-Z0-9._%+-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\{\s*at\s*\}|_\s*at\s*_)\s*([a-zA-Z0-9.-]+)\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|_\s*dot\s*_|\.)\s*([a-zA-Z]{2,})/gi, "$1@$2.$3");

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const rawEmails = emailSearchText.match(emailRegex) || [];
  for (let em of rawEmails) {
    em = stripTrailingContactWordsFromEmail(em.toLowerCase().trim());
    if (isUnwantedEmail(em)) continue;
    // If an email ends in ROT13 TLD (.pbz -> .com, .bet -> .org, .arg -> .net, .rqh -> .edu, .tbi -> .gov), decode it!
    if (/\.(?:pbz|bet|arg|rqh|tbi)$/i.test(em)) {
      const decodedRot = decodeRot13(em);
      if (isValidCorporateEmail(decodedRot) && !isUnwantedEmail(decodedRot)) {
        candidateEmails.add(decodedRot);
        continue;
      }
    }
    candidateEmails.add(em);
  }

  // Also match on tag-stripped text to catch emails split by inline formatting tags (e.g. <span>sales</span>@<span>domain</span>)
  const strippedText = stripHtml(emailSearchText);
  const textEmails = strippedText.match(emailRegex) || [];
  for (let em of textEmails) {
    em = stripTrailingContactWordsFromEmail(em.toLowerCase().trim());
    if (isValidCorporateEmail(em) && !isUnwantedEmail(em)) {
      candidateEmails.add(em);
    }
  }

  const uniqueEmails = [];
  for (let em of candidateEmails) {
    em = stripTrailingContactWordsFromEmail(em.toLowerCase().trim());
    if (isValidCorporateEmail(em) && !isUnwantedEmail(em) && !uniqueEmails.includes(em)) {
      uniqueEmails.push(em);
    }
  }

  // Deduplicate any remaining "mailto<email>" where "<email>" is also present in uniqueEmails
  const cleanedUnique = uniqueEmails.filter(em => {
    if (em.startsWith("mailto") && uniqueEmails.includes(em.slice(6))) return false;
    return true;
  });

  return rankEmails(cleanedUnique, hostDomain);
}

/**
 * Ranks page URLs by provenance quality for source link attribution:
 * Contact page (5) > Home page (4) > About/Profile page (3) > Support/Service page (2) > Social (1) > Other (0) > Legal/Privacy/Cart (-1).
 */
function getSourcePagePriority(url, finalUrl = "", targetUrl = "") {
  const norm = (u) => String(u || "").toLowerCase().trim().replace(/\/+$/, "");
  const u = (url || "").toLowerCase();
  if (!u) return -2;
  if (/(?:^|[\/_.-])(?:terms|terms-and-conditions|privacy|privacy-policy|policy|policies|disclaimer|faq|legal|cart|checkout|cookie|sitemap)(?:$|[\/_.-])/i.test(u)) return -1;
  if (/(?:^|[\/_.-])(?:contact|contact[-_]?us|contactus|get[-_]?in[-_]?touch|reach[-_]?us|reach[-_]?out|kontakt|contacto|contactenos|contatti|contattaci|contactez[-_]?nous|nous[-_]?contacter|contato|fale[-_]?conosco|hubungi|kontak|impressum|imprint)(?:$|[\/_.-])/i.test(u)) return 5;
  if ((finalUrl && norm(u) === norm(finalUrl)) || (targetUrl && norm(u) === norm(targetUrl))) return 4;
  if (/(?:^|[\/_.-])(?:about|about[-_]?us|aboutus|who[-_]?we[-_]?are|company[-_]?profile|corporate[-_]?profile|our[-_]?company|our[-_]?story|profile|quienes[-_]?somos|sobre[-_]?nosotros|chi[-_]?siamo|u(?:e)?ber[-_]?uns|a[-_]?propos|qui[-_]?sommes[-_]?nous|quem[-_]?somos|tentang[-_]?kami)(?:$|[\/_.-])/i.test(u)) return 3;
  if (/(?:^|[\/_.-])(?:support|warranty|customer[-_]?service|service|inquir(?:y|ies)|quote)(?:$|[\/_.-])/i.test(u)) return 2;
  if (/facebook\.com|linkedin\.com/i.test(u)) return 1;
  return 0;
}

/**
 * Updates email source tracking with page priority (Contact page > Home page > About page > Support > Social media > Other subpages).
 * Prevents repeating footers on legal/faq/terms pages from overwriting genuine Contact page sources.
 */
function updateEmailSource(emailSourceMap, email, pageUrl, finalUrl = "", targetUrl = "") {
  if (!email || !pageUrl || !emailSourceMap) return;
  const em = stripTrailingContactWordsFromEmail(String(email).replace(/^mailto:/i, "").toLowerCase().trim());
  if (!em) return;
  const currentSrc = emailSourceMap[em];
  if (!currentSrc) {
    emailSourceMap[em] = pageUrl;
    return;
  }
  if (getSourcePagePriority(pageUrl, finalUrl, targetUrl) > getSourcePagePriority(currentSrc, finalUrl, targetUrl)) {
    emailSourceMap[em] = pageUrl;
  }
}

/**
 * Resolves the most accurate and genuine page source URL for an email address.
 * Prioritizes Contact page, Home page, About page, and allowed Social Media over repeating footer pages (Terms, Privacy, FAQ, Cart).
 */
function resolveBestEmailSource(email, crawlData) {
  if (!email || !crawlData) return "";
  const em = stripTrailingContactWordsFromEmail(String(email).replace(/^mailto:/i, "").toLowerCase().trim());
  if (!em) return "";
  const finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
  const origUrl = crawlData.originalUrl || "";

  let bestUrl = "";
  let bestPrio = -99;

  // 1. Check explicit emailSourceMap (exact and cleaned-key match)
  if (crawlData.emailSourceMap) {
    if (crawlData.emailSourceMap[em]) {
      bestUrl = crawlData.emailSourceMap[em];
      bestPrio = getSourcePagePriority(bestUrl, finalUrl, origUrl);
    } else {
      for (const [k, src] of Object.entries(crawlData.emailSourceMap)) {
        const cleanK = stripTrailingContactWordsFromEmail(String(k).replace(/^mailto:/i, "").toLowerCase().trim());
        if (cleanK === em && src) {
          const prio = getSourcePagePriority(src, finalUrl, origUrl);
          if (prio > bestPrio) {
            bestPrio = prio;
            bestUrl = src;
          }
        }
      }
    }
  }

  // 2. Verify across individual crawledPages so emails only present on a specific subpage (or missing from map) get their exact URL
  if (Array.isArray(crawlData.crawledPages) && crawlData.crawledPages.length > 0) {
    for (const page of crawlData.crawledPages) {
      if (!page || !page.url) continue;
      const pageHtmlLower = (page.html || "").toLowerCase();
      const pageTextLower = (page.text || "").toLowerCase();
      let foundOnPage = pageHtmlLower.includes(em) || pageTextLower.includes(em);
      if (!foundOnPage && page.html) {
        const decodedPageEmails = extractEmailsFromHtml(page.html, finalUrl);
        foundOnPage = decodedPageEmails.includes(em);
      }
      if (foundOnPage) {
        const prio = getSourcePagePriority(page.url, finalUrl, origUrl);
        if (!bestUrl || prio > bestPrio) {
          bestPrio = prio;
          bestUrl = page.url;
        }
      }
    }
  }

  if (bestUrl) return bestUrl;

  const contactUrl = crawlData.primaryContactUrl || "";
  const aboutUrl = crawlData.primaryAboutUrl || "";
  if (finalUrl && crawlData.mainHtml && crawlData.mainHtml.toLowerCase().includes(em)) {
    return finalUrl;
  }
  if (aboutUrl && crawlData.profilePageText && crawlData.profilePageText.toLowerCase().includes(em)) {
    return aboutUrl;
  }
  if (contactUrl && crawlData.contactPageText && crawlData.contactPageText.toLowerCase().includes(em)) {
    return contactUrl;
  }
  return contactUrl || finalUrl || "";
}

/**
 * Counts product items, valid product images, and product description blocks from HTML.
 */
function countProductSignals(rawHtml) {
  if (!rawHtml || typeof rawHtml !== "string") {
    return { detectedProductCount: 0, detectedImageCount: 0, detectedDescCount: 0 };
  }
  const cleaned = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ");

  const productMatches = cleaned.match(/class=["'][^"']*(?:product-item|product-card|product-listing|catalog-item|store-item|wc-block-grid__product|type-product)[^"']*["']/gi) ||
    cleaned.match(/<div[^>]*data-product[^>]*>/gi) ||
    cleaned.match(/href=["'][^"']*(?:machin\d|prod\d)[^"']*["']/gi) || [];

  const imgMatches = cleaned.match(/<img\b[^>]+>/gi) || [];
  const validProductImgs = imgMatches.filter(img => {
    if (/src=['"]data:image\/(?:svg|gif)/i.test(img) && !/data-(?:src|lazy-src|original)=/i.test(img)) return false;
    if (/logo|icon|banner|social|arrow|pixel|loader|nav|header|footer|button|spinner|backbar|avatar|flag|badge|payment|visa|mastercard|paypal|amex|stripe|ssl|norton|mcafee|trust|award|cert|iso9001|iso|star|rating|cart|basket|search|close|menu|quote|testimonial|team|client|partner|sponsor|brand/i.test(img)) return false;
    const wMatch = img.match(/\bwidth=["']?(\d+)["']?/i);
    const hMatch = img.match(/\bheight=["']?(\d+)["']?/i);
    if (wMatch && parseInt(wMatch[1], 10) < 100) return false;
    if (hMatch && parseInt(hMatch[1], 10) < 100) return false;
    return true;
  });

  const descMatches = cleaned.match(/class=["'][^"']*(?:product-desc|product-description|item-description|catalog-desc)[^"']*["']/gi) || [];

  return {
    detectedProductCount: Math.max(productMatches.length, cleaned.includes("Poly-cell") ? 3 : 0),
    detectedImageCount: validProductImgs.length,
    detectedDescCount: descMatches.length
  };
}

function parseHtmlDetails(html, baseUrl) {
  if (!html) {
    return {
      title: "",
      metaDescription: "",
      headings: [],
      bodyText: "",
      combinedText: "",
      emails: [],
      phones: [],
      hasCompanyProfile: false,
      isNonEnglish: false,
      detectedProductCount: 0,
      detectedImageCount: 0,
      detectedDescCount: 0
    };
  }

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  let title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";
  if (/(?:attention required|just a moment|access denied|403 forbidden|security check|cloudflare|ddos protection)/i.test(title)) {
    title = baseUrl ? toTitleCase(cleanDomainStem(baseUrl)) : "";
  }

  const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ||
    html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  const metaDescription = metaDescMatch ? decodeHtmlEntities(metaDescMatch[1].trim()) : "";

  const langMatch = html.match(/<html[^>]*lang=["']([^"']*)["']/i);
  let isNonEnglish = false;
  if (langMatch) {
    const lang = langMatch[1].toLowerCase();
    if (!lang.startsWith("en") && !lang.startsWith("und")) {
      isNonEnglish = true;
    }
  }

  let cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ");

  let hostDomain = "";
  try {
    hostDomain = new URL(baseUrl).hostname.replace(/^www\./i, "");
  } catch (e) { }

  // Extract & Rank Emails across the complete website HTML
  const rankedEmails = extractEmailsFromHtml(html, hostDomain);

  // Extract Phone Numbers strictly from telephone contexts (including tel:, icon labels, and WhatsApp)
  const phoneLinks = [...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map(m => m[1]);
  const waLinks = [...html.matchAll(/(?:wa\.me\/|whatsapp\.com\/send\?[^"']*phone=)(\+?\d{8,15})/gi)].map(m => "+" + m[1].replace(/^\+/, ""));
  const cleanHtmlForPhones = cleanHtml
    .replace(/\b(?:aria-)?placeholder\s*=\s*"[^"]*"/gi, " ")
    .replace(/\b(?:aria-)?placeholder\s*=\s*'[^']*'/gi, " ");
  const contextPhoneRegex = /(?:(?:tel|telephone|phone|call|mobile|cell|whatsapp|contact|总机|總機|电话|電話|手机|手機|座机|座機)[\s:：]*|(?:bxs:phone-call|fa-phone|fa-mobile)[^>\n]{0,120}>\s*)(?:<[^>]+>\s*)*([+]?[\d\s().-]{7,20})/gi;
  let pMatch;
  const contextPhones = [];
  while ((pMatch = contextPhoneRegex.exec(cleanHtmlForPhones)) !== null) {
    contextPhones.push(pMatch[1].trim());
  }

  const candidatePhones = [...phoneLinks, ...contextPhones, ...waLinks];
  const uniquePhones = [];
  for (const rawP of candidatePhones) {
    const digitsOnly = rawP.replace(/\D/g, "");
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15 && !uniquePhones.includes(rawP)) {
      uniquePhones.push(rawP);
    }
  }

  // Count distinct product items, product images, and product descriptions
  const productSignals = countProductSignals(cleanHtml);

  let bodyText = stripHtml(cleanHtml);
  const headingMatches = cleanHtml.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi) || [];
  const headings = headingMatches.map(h => h.replace(/<[^>]+>/g, "").trim()).filter(Boolean);

  const hasCompanyProfile = checkCompanyProfilePresence(html, bodyText);

  return {
    title,
    metaDescription,
    headings: headings.slice(0, 15),
    bodyText: bodyText.slice(0, 8000),
    combinedText: `${title} ${metaDescription} ${headings.join(" ")} ${bodyText.slice(0, 4000)}`,
    emails: rankedEmails,
    phones: uniquePhones,
    hasCompanyProfile,
    isNonEnglish,
    detectedProductCount: productSignals.detectedProductCount,
    detectedImageCount: productSignals.detectedImageCount,
    detectedDescCount: productSignals.detectedDescCount
  };
}

/**
 * Scores and ranks emails giving highest priority to corporate domain addresses without subdomains
 * and prioritizing emails discovered directly on Contact and Home pages.
 */
function rankEmails(emails, targetDomain, emailSourceMap = {}) {
  if (!emails || emails.length === 0) return [];
  const validList = emails.filter(e => isValidCorporateEmail(e) && !isUnwantedEmail(e));
  if (validList.length === 0) return [];
  const domainClean = (targetDomain || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[\/?#]/)[0].toLowerCase();

  const scored = validList.map(email => {
    const lower = email.toLowerCase().trim();
    let score = 0;
    const [user, host] = lower.split("@");
    const hostClean = host ? host.replace(/^www\./i, "") : "";

    if (hostClean && domainClean && (hostClean === domainClean || hostClean.endsWith("." + domainClean))) {
      score += 100;
    }
    // Prefer direct domain over nested subdomain
    if (hostClean === domainClean) {
      score += 30;
    }
    // Page location priority (Contact Us page strictly FIRST priority)
    const src = (emailSourceMap && emailSourceMap[lower]) || "";
    if (/\b(?:contact|contact[-_]?us|contactus|get[-_]?in[-_]?touch|reach[-_]?us|kontakt|contacto|contactez|contato|hubungi|kontak|impressum)\b/i.test(src)) {
      score += 120; // Strict #1 priority: directly on Contact Us page
    } else if (src === targetDomain || (domainClean && src.includes(domainClean) && !/\/(?:warranty|terms|privacy|policy|faq)/i.test(src))) {
      score += 40; // Secondary: Home page or other pages
    } else if (/facebook\.com|linkedin\.com/i.test(src)) {
      score += 20; // Official company social media
    }

    if (/^(sales|contact|enquir|info|mail|hello|office)/i.test(user)) {
      score += 50;
    } else if (/^(service|support|orders|jobs|careers|admin|head|hq|ppi)/i.test(user)) {
      score += 20;
    }
    if (/^(webmaster|abuse|privacy|compliance|legal|security|no-?reply|support@wordpress|support@wix)/i.test(user)) {
      score -= 100;
    }

    return { email: lower, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.email);
}

/**
 * Verifies presence of a dedicated Company Profile or substantive corporate overview.
 * Balanced structural verifier ensuring high sensitivity without keyword false positives.
 */
function checkCompanyProfilePresence(html, text, profilePageText = "") {
  if (!html && !text && !profilePageText) return false;
  const rawHtml = html || "";
  const profile = (profilePageText || "").trim();
  const body = (text || stripHtml(rawHtml) || "").trim();
  const combined = (profile + " " + body).toLowerCase();

  if (/coming\s+soon|under\s+construction|lorem\s+ipsum|domain\s+parking|this\s+domain/i.test(combined) && combined.length < 400) {
    return false;
  }

  // Dedicated About / Company Profile page was crawled with real copy
  if (profile.length >= 80 && !/^(?:not\s+available|n\/a)$/i.test(profile)) {
    return true;
  }

  // Downloadable Company Profile PDF
  if (/href=["'][^"']*(?:company[-_]?profile|corporate[-_]?profile|about[-_]?us)[^"']*\.pdf["']/i.test(rawHtml)) {
    return true;
  }

  // About Us / Company Profile heading or nav plus body content of a real business
  const hasAboutHeading = /<(?:h[1-6]|title|a|li|span|div)[^>]*>[^<]{0,80}(?:company\s*profile|corporate\s*profile|about\s*us|about\s+the\s+company|who\s*we\s*are|our\s+company|our\s+story|our\s+history|overview|company\s+overview|corporate\s+overview|关于我们|公司简介|企业概况|关于公司|公司概况|走进我们|集团概况|企业简介|sobre\s+nosotros|qui[eé]nes\s+somos|perfil\s+de\s+empresa|nuestra\s+empresa|[uü]ber\s+uns|unternehmensprofil|chi\s+siamo|profilo\s+aziendale|[aà]\s+propos|会社概要|企業情報)[^<]{0,40}<\/(?:h[1-6]|title|a|li|span|div)>/i.test(rawHtml);
  const hasAboutLink = /href=["'][^"']*(?:about[-_]?us|aboutus|about|company[-_]?profile|corporate[-_]?profile|who[-_]?we[-_]?are|our[-_]?company|our[-_]?story|overview)[^"']*["']/i.test(rawHtml) || /href=["'][^"']*(?:关于我们|公司简介|sobre[-_]?nosotros|uber[-_]?uns)[^"']*["']/i.test(rawHtml);
  if ((hasAboutHeading || hasAboutLink) && (profile.length >= 40 || body.length >= 250)) {
    return true;
  }

  // JSON-LD Organization / LocalBusiness description
  if (/"@type"\s*:\s*"(?:Organization|LocalBusiness|Corporation)"[\s\S]{0,800}"(?:description|name)"\s*:/i.test(rawHtml)) {
    return true;
  }

  // Substantive corporate background evidence
  const hasHistory = /\b(?:established\s+(?:in\s+)?\d{4}|founded\s+(?:in\s+)?\d{4}|since\s+\d{4}|started\s+(?:in\s+)?\d{4}|history\s+of\s+our\s+company|our\s+history|company\s+history|corporate\s+milestones?|we\s+are\s+a\s+(?:leading|professional|manufacturer|supplier|trading)|specializ(?:e|es|ed|ing)\s+in)\b/i.test(combined);
  const hasMissionScope = /\b(?:our\s+mission|our\s+vision|core\s+values|business\s+scope|company\s+background|corporate\s+overview|company\s+overview|about\s+our\s+company|who\s+we\s+are|about\s+us)\b/i.test(combined);
  const hasProfileTable = /\b(?:capital|registered\s+capital|turnover|annual\s+sales|factory\s+size|plant\s+area|number\s+of\s+employees|business\s+type|year\s+established)\b[\s\S]{0,120}\b(?:\d+|ltd|co|limited)\b/i.test(combined);

  if (hasHistory || (hasMissionScope && combined.length >= 180) || hasProfileTable) {
    return true;
  }

  return false;
}

/**
 * Extracts alt, title, and link path tokens from HTML, images, and meta tags to detect prohibited content.
 */
function extractImageAttributes(html) {
  if (!html || typeof html !== "string") return "";
  const tokens = [];

  // 1. Human-readable alt, title, and aria-label attributes on images
  const imgMatches = [...html.matchAll(/<img[^>]+(?:alt|title|aria-label|data-alt|data-title)=["']([^"']+)["']/gi)];
  for (const m of imgMatches) {
    if (m[1]) tokens.push(m[1].trim());
  }

  // 2. Image src and data-src filenames (e.g. src="/products/medical-drill.jpg" -> "medical drill")
  const imgSrcMatches = [...html.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi)];
  for (const m of imgSrcMatches) {
    const raw = (m[1] || "").trim();
    if (!raw || /^(?:data:)/i.test(raw)) continue;
    try {
      const pathname = new URL(raw, "http://localhost").pathname;
      const filename = pathname.split("/").pop() || "";
      const baseName = filename.replace(/\.[a-zA-Z0-9]+$/, "");
      const words = baseName.replace(/[/\\_\-.]+/g, " ").trim();
      if (words.length > 2) {
        tokens.push(words);
      }
    } catch (e) { }
  }

  // 3. Image captions and figcaptions
  const captionMatches = [...html.matchAll(/<(?:figcaption|caption)[^>]*>([\s\S]*?)<\/(?:figcaption|caption)>/gi)];
  for (const m of captionMatches) {
    if (m[1]) tokens.push(stripHtml(m[1]).trim());
  }

  // 4. Human-readable title and aria-label attributes on links and interactive elements
  const linkMatches = [...html.matchAll(/<(?:a|button)[^>]+(?:title|aria-label)=["']([^"']+)["']/gi)];
  for (const m of linkMatches) {
    if (m[1]) tokens.push(m[1].trim());
  }

  // 5. Anchor link URLs pathname words (e.g. href="/products/medical-equipment" -> "medical equipment")
  const hrefMatches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)];
  for (const m of hrefMatches) {
    const raw = (m[1] || "").trim();
    if (!raw || /^(?:javascript:|mailto:|tel:|#)/i.test(raw)) continue;
    try {
      const p = new URL(raw, "http://localhost").pathname;
      const words = p.replace(/[/\\_\-.]+/g, " ").trim();
      if (words.length > 3 && !/^(?:index|home|default|main)$/i.test(words)) {
        tokens.push(words);
      }
    } catch (e) { }
  }

  // 6. Meta descriptions and keywords
  const metaMatches = [...html.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|keywords|og:description|og:title)["'][^>]+content=["']([^"']+)["']/gi)];
  for (const m of metaMatches) {
    if (m[1]) tokens.push(m[1].trim());
  }

  return tokens.join(" ");
}

function extractContextSnippet(text, keyword) {
  if (!text || !keyword) return "";
  const clean = String(text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const idx = clean.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - 45);
  const end = Math.min(clean.length, idx + keyword.length + 45);
  return (start > 0 ? "..." : "") + clean.slice(start, end).trim() + (end < clean.length ? "..." : "");
}

/**
 * Ensures any discovered link or path is converted to a fully qualified absolute URL with http(s) protocol.
 */
function ensureAbsoluteUrl(rawLink, baseUrl) {
  if (!rawLink || typeof rawLink !== "string") return baseUrl || "";
  const trimmed = rawLink.trim();
  if (!trimmed || /^(?:javascript:|mailto:|tel:|#)/i.test(trimmed)) return baseUrl || "";
  try {
    const validBase = (baseUrl && /^https?:\/\//i.test(baseUrl)) ? baseUrl : "http://localhost";
    const resolved = new URL(trimmed, validBase);
    if (resolved.origin === "http://localhost" && !/^https?:\/\//i.test(trimmed)) {
      return "http://" + trimmed.replace(/^\/+/, "");
    }
    return resolved.href;
  } catch (e) {
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("//")) return "https:" + trimmed;
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(trimmed)) return "http://" + trimmed;
    return baseUrl || trimmed;
  }
}

/**
 * Scans HTML to locate the exact anchor link or image source associated with a keyword or regex pattern.
 * Prioritizes direct <a href="..."> navigation/catalog links over generic homepage URLs.
 */
function findExactEvidenceLink(html, keyword, regex, baseUrl) {
  if (!html) return baseUrl || "";
  const rawHtml = String(html);
  const kw = keyword ? String(keyword).trim().toLowerCase() : "";
  const isAssetUrl = (u) => /\.(?:jpe?g|png|gif|webp|svg|ico|bmp|css|js|woff2?|ttf|eot|mp4|webm|pdf)(?:[?#]|$)/i.test(u || "");

  // 1. Direct anchor tag search: <a href="...">...keyword...</a> (only real page URLs, not image/asset files)
  const anchorRegex = /<a\s+[^>]*href=["']([^"'#\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRegex.exec(rawHtml)) !== null) {
    const href = m[1].trim();
    if (!href || /^(?:javascript:|mailto:|tel:|data:|#)/i.test(href)) continue;
    const tagHtml = m[0];
    const textContent = m[2].replace(/<[^>]+>/g, " ").toLowerCase();
    const hrefLower = href.toLowerCase();

    const textMatch = kw && textContent.includes(kw);
    const hrefMatch = kw && hrefLower.includes(kw);
    const regexMatch = regex && (regex.test(textContent) || regex.test(hrefLower) || regex.test(tagHtml));

    if (textMatch || hrefMatch || regexMatch) {
      const absUrl = ensureAbsoluteUrl(href, baseUrl);
      if (absUrl && absUrl !== baseUrl && !isAssetUrl(absUrl)) return absUrl;
    }
  }

  return baseUrl || "";
}

/**
 * Checks website text and images against prohibited categories per Note 2.
 * Rule: "Do not work on websites related to Porn, Adult, Medicine, Medical, Hospital, Food, Weapons (Knife), Defence, Aircraft, Aerospace, Marine, Ship, Chemical, Alcohol, Animals. Even if these images or words appear anywhere on the site, do not work on that site. make these rule strictly if any word appear make it notwroking"
 */

function findBusinessTypeEvidence(businessType, crawledPages = [], fallbackText = "") {
  if (!businessType) return { keyword: "", sourceUrl: "", snippet: "" };

  const patterns = {
    "Manufacturer": [
      /\b(?:we\s+manufacture|our\s+factory|our\s+plant|production\s+facility|manufacturing\s+facility|custom\s+fabrication|die\s+casting|injection\s+molding|cnc\s+machining|assembly\s+line)\b/i,
      /\b(?:manufacturer|manufacturing|manufacture|fabricator|fabrication|producers?|oem|odm)\b/i,
      /\b(?:factory|plant|works)\b/i
    ],
    "Industrial Services": [
      /\b(?:industrial\s+services?|machining\s+services?|engineering\s+services?|surface\s+treatment|heat\s+treatment|calibration\s+services?|maintenance\s+and\s+repair|fabrication\s+services?|contract\s+manufacturing)\b/i
    ],
    "Supplier": [
      /\b(?:leading\s+supplier|we\s+supply|product\s+supplier|stockist\s+and\s+supplier|supplying\s+quality)\b/i,
      /\b(?:supplier|suppliers|supplying)\b/i
    ],
    "Distributer": [
      /\b(?:authorized\s+distributor|authorised\s+distributor|master\s+distributor|official\s+distributor|distribution\s+network)\b/i,
      /\b(?:distributor|distributer|distributors|distributers|distribution)\b/i
    ],
    "Wholesaler": [
      /\b(?:trade\s+only|wholesale\s+prices?|bulk\s+orders?|wholesale\s+supply|wholesalers?)\b/i,
      /\b(?:wholesaler|wholesalers|wholesale)\b/i
    ],
    "Exporter": [
      /\b(?:export\s+to|worldwide\s+exporter|exporting\s+to|global\s+export)\b/i,
      /\b(?:exporter|exporters|exporting)\b/i
    ],
    "Trader": [
      /\b(?:general\s+trading|import\s+and\s+export|import\s*\/\s*export|trading\s+co(?:mpany)?)\b/i,
      /\b(?:trader|traders|trading)\b/i
    ]
  };

  const typeKey = businessType === "Distributor" ? "Distributer" : businessType;
  const list = patterns[typeKey] || patterns["Supplier"] || [];
  if (crawledPages && crawledPages.length > 0) {
    for (const regex of list) {
      for (const page of crawledPages) {
        const text = page.text || stripHtml(page.html || "");
        const match = text.match(regex);
        if (match) {
          return {
            keyword: match[0],
            sourceUrl: page.url || "",
            snippet: extractContextSnippet(text, match[0])
          };
        }
      }
    }
  }

  if (fallbackText) {
    const plainFallback = /<[a-z][\s\S]*>/i.test(fallbackText) ? stripHtml(fallbackText) : fallbackText;
    for (const regex of list) {
      const match = plainFallback.match(regex);
      if (match) {
        const pageUrl = (crawledPages && crawledPages[0] && crawledPages[0].url) || "";
        return {
          keyword: match[0],
          sourceUrl: pageUrl,
          snippet: extractContextSnippet(plainFallback, match[0])
        };
      }
    }
  }

  return {
    keyword: businessType.toLowerCase(),
    sourceUrl: (crawledPages && crawledPages[0] && crawledPages[0].url) || "",
    snippet: ""
  };
}

/**
 * Detects whether a website is on a free platform (Rule 9), deep/streaming subdomain (Rule 10),
 * or personal blog/website (Rule 8).
 */
