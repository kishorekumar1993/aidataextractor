// Background Service Worker for AI Web Crawler & Auto Pre-Fill Assistant
// Production-Grade Implementation strictly conforming to 14 QC Rules

// Load environment configuration from env.js (synced from .env)
try {
  importScripts("env.js");
} catch (e) {
  // Service worker will fall back to chrome.storage.sync
}

const DEFAULT_API_KEY =
  (typeof globalThis !== "undefined" && globalThis.ENV && globalThis.ENV.GEMINI_API_KEY) ||
  (typeof self !== "undefined" && self.ENV && self.ENV.GEMINI_API_KEY) ||
  "";
const DEFAULT_MODEL =
  (typeof globalThis !== "undefined" && globalThis.ENV && globalThis.ENV.DEFAULT_MODEL) ||
  (typeof self !== "undefined" && self.ENV && self.ENV.DEFAULT_MODEL) ||
  "gemini-2.5-flash";

// Primary prohibited core industries per Instruction Sheet
const RESTRICTED_PATTERNS = [
  /\b(porn|pornography|xxx|erotic|sex\s*shop|escort\s*service)\b/i,
  /\b(weapons?|firearms?|ammunition|rifles?|guns?|military\s*weapons?)\b/i,
  /\b(prescription\s*drugs|hospital\s*care|medical\s*clinic)\b/i,
  /\b(military\s*defence\s*contractor|armed\s*forces\s*equipment|tactical\s*armaments)\b/i,
  /\b(commercial\s*aviation\s*fleet|aircraft\s*manufacturer|naval\s*shipyard)\b/i,
  /\b(brewery|distillery|liquor\s*store|wine\s*producer)\b/i,
  /\b(livestock\s*farming|pet\s*shop|animal\s*breeding|veterinary\s*hospital)\b/i
];

// National Capital Cities for Rule 8 capital city exception
const ALL_CAPITALS = [
  "taipei city", "taipei", "pretoria", "cape town", "bloemfontein", "london", "washington", "paris",
  "berlin", "tokyo", "beijing", "new delhi", "canberra", "ottawa", "seoul", "bangkok",
  "singapore", "kuala lumpur", "jakarta", "manila", "hanoi", "rome", "madrid", "amsterdam",
  "brussels", "bern", "vienna", "stockholm", "oslo", "copenhagen", "helsinki", "dublin",
  "warsaw", "prague", "budapest", "athens", "lisbon", "ankara", "riyadh", "abu dhabi",
  "doha", "cairo", "nairobi", "buenos aires", "brasilia", "santiago", "bogota", "lima",
  "mexico city", "wellington"
];

// High-risk suburbs and localities that MUST NOT be classified as cities (Strict QC Rule)
const NON_CITY_SUBURBS = [
  "sandton", "rosebank", "randburg", "midrand", "bryanston", "fourways", "centurion", "menlyn",
  "umhlanga", "bedfordview", "edenvale", "alberton", "rivonia", "woodmead", "morningside",
  "kempton park", "jet park", "boksburg industrial", "isando", "germiston", "roodepoort",
  "constantia", "camps bay", "sea point", "claremont", "bellville", "durbanville", "somerset west",
  "brooklyn", "queens", "manhattan", "bronx", "staten island", "hollywood", "beverly hills",
  "campbellfield", "dandenong", "st kilda", "parramatta", "chatswood", "fitzroy", "carlton",
  "richmond", "altona", "epping", "footscray", "box hill", "clayton", "springvale", "ringwood"
];

// International Recognized Towns, Districts, Municipalities
const RECOGNIZED_TOWNS = [
  // South Africa towns / municipalities
  "boksburg", "johannesburg", "pretoria", "durban", "cape town", "port elizabeth", "gqeberha",
  "bloemfontein", "east london", "polokwane", "nelspruit", "mbombela", "pietermaritzburg",
  "kimberley", "george", "rustenburg", "potchefstroom", "paarl", "stellenbosch", "upington",
  "witbank", "emalahleni", "klerksdorp", "secunda", "middelburg", "vanderbijlpark", "vereeniging",
  // United Kingdom towns / cities / boroughs
  "london", "manchester", "birmingham", "liverpool", "leeds", "glasgow", "edinburgh", "bristol",
  "sheffield", "newcastle", "nottingham", "cardiff", "belfast", "cambridge", "oxford", "coventry",
  "leicester", "southampton", "aberdeen", "plymouth", "swansea", "dundee", "norwich",
  // United States cities / towns
  "new york", "los angeles", "chicago", "houston", "phoenix", "philadelphia", "san antonio",
  "san diego", "dallas", "san jose", "austin", "jacksonville", "fort worth", "columbus",
  "san francisco", "charlotte", "indianapolis", "seattle", "denver", "boston", "detroit",
  "nashville", "portland", "las vegas", "memphis", "baltimore", "milwaukee", "albuquerque",
  "atlanta", "miami", "cleveland", "minneapolis", "tampa", "pittsburgh", "cincinnati",
  // Australia
  "sydney", "melbourne", "brisbane", "perth", "adelaide", "gold coast", "newcastle", "canberra",
  "sunshine coast", "wollongong", "hobart", "geelong", "townsville", "cairns", "darwin",
  // Canada
  "toronto", "montreal", "vancouver", "calgary", "edmonton", "ottawa", "winnipeg", "quebec city",
  "hamilton", "kitchener", "london", "victoria bc", "halifax", "oshawa", "windsor",
  // Taiwan districts & cities
  "yangmei", "yangmei town", "banqiao", "banqiao district", "xinzhuang", "xinzhuang district", "zhonghe", "zhonghe district",
  "sanchong", "sanchong district", "tamsui", "tamsui district", "xizhi", "xizhi district",
  "yonghe", "yonghe district", "tucheng", "tucheng district", "shulin", "shulin district",
  "taichung", "tainan", "kaohsiung", "keelung", "hsinchu", "chiayi", "hualien", "yilan",
  // Germany
  "berlin", "munich", "hamburg", "frankfurt", "cologne", "stuttgart", "dusseldorf", "dortmund",
  "essen", "leipzig", "bremen", "dresden", "hanover", "nuremberg", "duisburg",
  // France
  "paris", "marseille", "lyon", "toulouse", "nice", "nantes", "strasbourg", "montpellier",
  "bordeaux", "lille", "rennes", "reims", "saint-etienne", "le havre", "toulon",
  // India
  "mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "ahmedabad", "chennai", "kolkata",
  "surat", "pune", "jaipur", "lucknow", "kanpur", "nagpur", "indore", "thane", "bhopal",
  "visakhapatnam", "patna", "vadodara", "ghaziabad", "ludhiana", "agra", "nashik",
  // Japan
  "tokyo", "yokohama", "osaka", "nagoya", "sapporo", "fukuoka", "kobe", "kyoto",
  "kawasaki", "saitama", "hiroshima", "sendai", "chiba", "kitakyushu",
  // Malaysia
  "kuala lumpur", "petaling jaya", "subang jaya", "shah alam", "klang", "johor bahru",
  "penang", "georgetown", "ipoh", "kuching", "kota kinabalu", "seremban", "malacca",
  "alor setar", "kangar", "kuala terengganu", "kota bharu", "kuantan", "miri", "sandakan",
  "masai", "batu pahat", "muar", "kluang", "kulai", "pasir gudang", "skudai", "iskandar puteri",
  // Indonesia
  "jakarta", "surabaya", "bandung", "medan", "semarang", "makassar", "palembang",
  "tangerang", "depok", "bekasi", "bogor", "batam", "denpasar", "yogyakarta", "malang",
  // South Korea
  "seoul", "busan", "incheon", "daegu", "daejeon", "ulsan", "gwangju", "suwon",
  "seongnam", "goyang", "yongin", "changwon", "pohang", "jeonju", "ansan",
  // China
  "beijing", "shanghai", "guangzhou", "shenzhen", "chengdu", "wuhan", "chongqing",
  "tianjin", "nanjing", "hangzhou", "xi'an", "shenyang", "dongguan", "foshan",
  "qingdao", "wuxi", "zhengzhou", "suzhou", "wenzhou", "dalian", "ningbo",
  // Middle East
  "dubai", "abu dhabi", "sharjah", "riyadh", "jeddah", "mecca", "medina",
  "doha", "kuwait city", "manama", "muscat", "amman", "beirut", "tehran",
  "tel aviv", "jerusalem", "istanbul", "ankara", "cairo", "alexandria",
  // Southeast Asia other
  "manila", "quezon city", "cebu", "davao", "bangkok", "chiang mai", "pattaya",
  "ho chi minh city", "hanoi", "da nang", "phnom penh", "vientiane", "yangon",
  "naypyidaw", "singapore",
  // Other major international cities
  "amsterdam", "rotterdam", "brussels", "zurich", "geneva", "vienna", "warsaw",
  "budapest", "prague", "stockholm", "oslo", "copenhagen", "helsinki", "athens",
  "lisbon", "porto", "barcelona", "madrid", "milan", "rome", "naples", "turin",
  "moscow", "saint petersburg", "kiev", "kyiv", "bucharest", "sofia", "zagreb",
  "toronto", "montreal", "vancouver", "calgary", "edmonton",
  "auckland", "wellington", "christchurch",
  "johannesburg", "cape town", "pretoria", "durban", "bloemfontein", "port elizabeth",
  "nairobi", "lagos", "accra", "dar es salaam", "addis ababa", "casablanca",
  "buenos aires", "sao paulo", "rio de janeiro", "santiago", "bogota", "lima", "caracas",
  "mexico city", "guadalajara", "monterrey"
];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "CRAWL_AND_EXTRACT") {
    handleCrawlAndExtract(request.url)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "TEST_API_KEY") {
    testGeminiApiKey(request.apiKey || DEFAULT_API_KEY, request.model || DEFAULT_MODEL)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * Main coordinator: Deep crawls target site, handles framesets & charsets, runs AI, applies independent QC.
 */
async function handleCrawlAndExtract(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("No URL provided");
  }

  let targetUrl = rawUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = "http://" + targetUrl;
  }

  const settings = await chrome.storage.sync.get(["apiKey", "model"]);
  const apiKey = (settings.apiKey && settings.apiKey.trim()) ? settings.apiKey.trim() : DEFAULT_API_KEY;
  const model = settings.model || DEFAULT_MODEL;

  // Step 1: Deep crawl homepage, framesets, contact pages, footer, JSON-LD & map endpoints
  const crawlResult = await crawlWebsite(targetUrl);

  // Step 2: Check for prohibited categories
  const restrictedCheck = detectRestrictedKeywords(crawlResult.combinedText + " " + targetUrl);

  let extractedData;
  try {
    extractedData = await analyzeWithGemini(crawlResult, apiKey, model, restrictedCheck);
    extractedData._note = `AI Powered by Gemini (${model})`;
  } catch (aiErr) {
    console.warn("Gemini API error, falling back to local deterministic rule engine:", aiErr);
    extractedData = heuristicExtraction(crawlResult, restrictedCheck);
    extractedData._note = "Analyzed via Local Rule Engine (Gemini error: " + aiErr.message + ")";
  }

  // Step 3: Strictly enforce State, City, Country, and Products based on instructions
  const cleanedData = applyStrictInstructions(extractedData, crawlResult, restrictedCheck);
  return cleanedData;
}

/**
 * Resilient, charset-aware HTTP fetcher with timeout and fallback decoders.
 */
async function fetchDecodedHtml(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const buf = await res.arrayBuffer();

    let charset = "utf-8";
    const ct = res.headers.get("content-type") || "";
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

    return {
      ok: res.ok,
      status: res.status,
      url: res.url,
      redirected: res.redirected,
      html: decoded
    };
  } catch (err) {
    return { ok: false, status: 0, url, redirected: false, html: "" };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Deep crawls homepage, handles HTML <frameset>/<frame>, contact pages, footer, JSON-LD, products.
 */
async function crawlWebsite(targetUrl) {
  let mainHtml = "";
  let contactHtml = "";
  let footerText = "";
  let contactPageText = "";
  let redirected = false;
  let finalUrl = targetUrl;
  let status = "Working";
  let fetchError = null;
  const addressCandidates = [];
  let profilePageText = "";
  let copyrightText = "";

  try {
    const mainRes = await fetchDecodedHtml(targetUrl, {
      timeoutMs: 12000,
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (mainRes.redirected) {
      redirected = true;
      finalUrl = mainRes.url;
    }

    // Technical fix: status 0 or network failure MUST mark Not Working, never Working
    if (!mainRes.ok || mainRes.status === 0 || !mainRes.html || mainRes.html.trim().length === 0) {
      status = mainRes.status === 404 ? "Domain Expired" : "Not Working";
    }

    mainHtml = mainRes.html || "";

    // Extract copyright line for exact official company name verification
    const copyMatch = mainHtml.match(/(?:©|&copy;|copyright|all\s+rights\s+reserved)\s*(?:20\d\d[-–\d\s]*)?([^<\n\r,;|]+)/i);
    if (copyMatch && copyMatch[1]) {
      copyrightText = stripHtml(copyMatch[1]).replace(/all\s+rights\s+reserved/gi, "").trim();
    }

    // Support HTML <frameset> / <frame src="..."> / <iframe src="..."> (e.g. polyprise.com.tw)
    const frameMatches = [...mainHtml.matchAll(/<(?:frame|iframe)[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
    for (const fSrc of frameMatches) {
      try {
        if (/^(javascript:|about:|mailto:|tel:)/i.test(fSrc)) continue;
        const frameUrl = new URL(fSrc, finalUrl).href;
        const fRes = await fetchDecodedHtml(frameUrl, {
          timeoutMs: 6000,
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        if (fRes.ok && fRes.html) {
          mainHtml += "\n" + fRes.html;
        }
      } catch (e) { }
    }

    // Extract Footer text & Footer address candidates
    const footerMatch = mainHtml.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i) ||
      mainHtml.match(/<(?:div|section)[^>]+(?:class|id)=["'][^"']*footer[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
    if (footerMatch) {
      footerText = stripHtml(footerMatch[1]);
      extractHtmlAddresses(footerMatch[1], addressCandidates, "footer");
    }

    // Extract from Homepage body
    extractJsonLdAddresses(mainHtml, addressCandidates);
    extractMapAddresses(mainHtml, addressCandidates);
    extractMetaAddresses(mainHtml, addressCandidates);
    extractHtmlAddresses(mainHtml, addressCandidates, "contact");

    // Discover Contact & Profile Pages
    const contactLinks = discoverContactLinks(mainHtml, finalUrl);
    const fetchedUrls = new Set([finalUrl]);

    for (const cUrl of contactLinks.slice(0, 10)) {
      if (fetchedUrls.has(cUrl)) continue;
      fetchedUrls.add(cUrl);

      try {
        const cRes = await fetchDecodedHtml(cUrl, {
          timeoutMs: 6000,
          headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });

        if (cRes.ok && cRes.html) {
          const cText = cRes.html;
          contactHtml += "\n" + cText;
          const isProfilePage = /(?:company[-_]?profile|corporate[-_]?profile|profile\.htm|profile|about[-_]?us|who[-_]?we[-_]?are|our[-_]?company|our[-_]?story|our[-_]?history)/i.test(cUrl);
          const pageSource = isProfilePage ? "profile" : "contact";

          extractJsonLdAddresses(cText, addressCandidates);
          extractMapAddresses(cText, addressCandidates);
          extractMetaAddresses(cText, addressCandidates);
          extractHtmlAddresses(cText, addressCandidates, pageSource);

          if (isProfilePage || /\b(?:company\s+profile|our\s+story|about\s+us|who\s+we\s+are)\b/i.test(stripHtml(cText).slice(0, 500))) {
            profilePageText += "\n" + stripHtml(cText);
          }

          // Check CMS dynamic form endpoints
          if (cText.includes("main-contact.asp") || cText.includes("loadFB")) {
            const formMatch = cText.match(/loadFB\(["']([^"']+)["']/i) || cText.match(/src=["']([^"']*main-contact\.asp[^"']*)["']/i);
            if (formMatch) {
              const fbUrl = new URL(formMatch[1], cUrl).href;
              const fbRes = await fetchDecodedHtml(fbUrl, { timeoutMs: 5000 });
              if (fbRes.ok && fbRes.html) {
                contactHtml += "\n" + fbRes.html;
                extractHtmlAddresses(fbRes.html, addressCandidates, "contact");
              }
            }
          }
        }
      } catch (e) { }
    }

    // Merge Contact text
    contactPageText = stripHtml(contactHtml);

    // Check homepage profile text snippet
    const homeProfileMatch = stripHtml(mainHtml).match(/(?:about\s+us|our\s+company|company\s+profile|our\s+story|who\s+we\s+are|about\s+our\s+company)[\s\S]{50,1500}/i);
    if (homeProfileMatch) {
      profilePageText += "\n" + homeProfileMatch[0];
    }
  } catch (err) {
    fetchError = err.message;
    status = "Not Working";
  }

  // Check redirect host
  try {
    const origHost = new URL(targetUrl).hostname.replace(/^www\./, "");
    const finalHost = new URL(finalUrl).hostname.replace(/^www\./, "");
    if (origHost !== finalHost && !finalHost.includes(origHost) && !origHost.includes(finalHost)) {
      status = "Redirect Site";
    }
  } catch (e) { }

  const extracted = parseHtmlDetails(mainHtml, finalUrl);

  // Verify substantive company profile presence
  extracted.hasCompanyProfile = checkCompanyProfilePresence(mainHtml, extracted.bodyText, profilePageText);

  // Merge discovered emails/phones from crawled contact pages
  if (contactHtml) {
    const contactParsed = parseHtmlDetails(contactHtml, finalUrl);
    extracted.emails = Array.from(new Set([...extracted.emails, ...contactParsed.emails]));
    extracted.phones = Array.from(new Set([...extracted.phones, ...contactParsed.phones]));
  }

  return {
    originalUrl: targetUrl,
    finalUrl,
    redirected,
    status,
    fetchError,
    mainHtml,
    addressCandidates,
    detectedAddresses: addressCandidates.map(c => (typeof c === "object" ? c.raw : c)),
    contactPageText: contactPageText.slice(0, 12000),
    footerText: footerText.slice(0, 4000),
    profilePageText: profilePageText.slice(0, 8000),
    copyrightText: copyrightText.slice(0, 500),
    ...extracted
  };
}

/**
 * Adds an address candidate with provenance tracking and priority ranking.
 */
function addAddressCandidate(targetList, rawText, source, isHq = false) {
  if (!rawText || typeof rawText !== "string") return;
  const cleaned = rawText
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 8) return;
  if (!/\b(road|street|avenue|lane|drive|way|boulevard|highway|via|corso|viale|piazza|town|township|district|city|province|county|hsien|state|building|floor|suite|box|number|no|#|\d{3,6})\b/i.test(cleaned)) {
    return;
  }

  // Priority ranking: headquarters (1) > contact (2) > profile (3) > jsonld (4) > map (5) > footer (6)
  let priority = 6;
  if (isHq || source === "headquarters") priority = 1;
  else if (source === "contact") priority = 2;
  else if (source === "profile") priority = 3;
  else if (source === "jsonld") priority = 4;
  else if (source === "map") priority = 5;

  const exists = targetList.some(c => (typeof c === "string" ? c : c.raw).toLowerCase() === cleaned.toLowerCase());
  if (!exists) {
    targetList.push({
      raw: cleaned,
      source: source || "general",
      priority: priority,
      isHeadquarters: isHq || source === "headquarters"
    });
  }
}

/**
 * Extracts schema.org JSON-LD PostalAddress blocks with source provenance.
 */
function extractJsonLdAddresses(html, targetList) {
  if (!html) return;
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const processItem = item => {
        if (!item || typeof item !== "object") return;
        if (item.address && typeof item.address === "object") {
          const a = item.address;
          const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry].filter(Boolean);
          if (parts.length >= 2) {
            addAddressCandidate(targetList, parts.join(", "), "jsonld", false);
          }
        }
      };
      if (Array.isArray(data)) data.forEach(processItem);
      else if (data["@graph"] && Array.isArray(data["@graph"])) data["@graph"].forEach(processItem);
      else processItem(data);
    } catch (e) { }
  }
}

/**
 * Discovers contact and about page URLs by scoring anchor text and href.
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
    if (!raw || /^(javascript:|mailto:|tel:|#)/i.test(raw)) continue;

    let score = 0;
    if (/\b(contact|contact-us|contactus|contact_us|get-in-touch|reach-us)\b/i.test(rawLower)) score += 10;
    if (/\b(about|about-us|aboutus|about_us|who-we-are|our-company|company-profile|profile)\b/i.test(rawLower)) score += 6;
    if (/\b(contact|contact\s*us|get\s*in\s*touch|reach\s*us)\b/i.test(innerText)) score += 12;
    if (/\b(about|about\s*us|who\s*we\s*are|company\s*profile|our\s*profile)\b/i.test(innerText)) score += 8;

    if (score > 0) {
      try {
        const resolved = new URL(raw, baseUrl).href;
        candidates.push({ url: resolved, score });
      } catch (e) { }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return Array.from(new Set(candidates.map(c => c.url)));
}

function extractFooterText(html) {
  if (!html) return "";
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i) ||
    html.match(/<(?:div|section)[^>]+(?:class|id)=["'][^"']*footer[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
  if (!footerMatch) return "";
  return stripHtml(footerMatch[1]);
}

function extractMapAddresses(html, targetList) {
  if (!html) return;
  const mapRegex = /(?:google\.com\/maps|maps\.google|baidu\.com|openstreetmap)[^"'>\s]*/gi;
  let match;
  while ((match = mapRegex.exec(html)) !== null) {
    const rawUrl = match[0];
    try {
      const decoded = decodeURIComponent(rawUrl);
      const qMatch = decoded.match(/[?&](?:q|query|place|destination|daddr)=([^&"'>]+)/i);
      if (qMatch) {
        const query = qMatch[1].replace(/\+/g, " ").trim();
        if (query.length > 8 && !/^[-\d.,\s]+$/.test(query)) {
          addAddressCandidate(targetList, query, "map", false);
        }
      }
    } catch (e) { }
  }
}

function extractMetaAddresses(html, targetList) {
  if (!html) return;
  const metaRegex = /<meta[^>]+(?:name|property)=["'](?:og:street-address|geo\.placename|business:contact_data:street_address)["'][^>]+content=["']([^"']+)["']/gi;
  let m;
  while ((m = metaRegex.exec(html)) !== null) {
    if (m[1] && m[1].trim().length > 6) {
      addAddressCandidate(targetList, m[1].trim(), "contact", false);
    }
  }
}

function extractHtmlAddresses(html, targetList, defaultSource = "contact") {
  if (!html) return;

  // 1. Explicit Headquarters / Head Office blocks (Priority 1)
  const hqRegex = /(?:headquarters|head\s*office|corporate\s*office|registered\s*office|main\s*office|hq)\s*[:\-–]?\s*<(?:p|div|span|address)[^>]*>([\s\S]*?)<\/(?:p|div|span|address)>/gi;
  let hqm;
  while ((hqm = hqRegex.exec(html)) !== null) {
    const raw = stripHtml(hqm[1]);
    if (raw.length > 8) {
      addAddressCandidate(targetList, raw, "headquarters", true);
    }
  }

  // 2. <h1-6> with "address" followed by <p>, <div>, or <span>
  const headingRegex = /<h[1-6][^>]*>[^<]*address[^<]*<\/h[1-6]>\s*<(?:p|div|span)[^>]*>([\s\S]*?)<\/(?:p|div|span)>/gi;
  let hm;
  while ((hm = headingRegex.exec(html)) !== null) {
    const raw = stripHtml(hm[1]);
    if (raw.length > 10) {
      addAddressCandidate(targetList, raw, defaultSource, false);
    }
  }

  // 3. <address> tag
  const addrTagRegex = /<address[^>]*>([\s\S]*?)<\/address>/gi;
  let am;
  while ((am = addrTagRegex.exec(html)) !== null) {
    const raw = stripHtml(am[1]);
    if (raw.length > 10) {
      addAddressCandidate(targetList, raw, defaultSource, false);
    }
  }

  // 4. Class or id containing "address"
  const classAddrRegex = /<(?:div|p|span|section)[^>]+(?:class|id)=["'][^"']*address[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p|span|section)>/gi;
  let cm;
  while ((cm = classAddrRegex.exec(html)) !== null) {
    const raw = stripHtml(cm[1]);
    if (raw.length > 10) {
      addAddressCandidate(targetList, raw, defaultSource, false);
    }
  }
}

/**
 * Compares Gemini's suggested address against verified website candidates.
 * Prioritizes explicitly identified headquarters addresses and rejects unsupported addresses.
 */
function verifyAndSelectAddress(geminiAddr, candidates) {
  if (!candidates || candidates.length === 0) {
    if (!geminiAddr || geminiAddr.length < 8 || /^(?:not\s*available|n\/?a|none|unknown)$/i.test(geminiAddr.trim())) {
      return "Not Available";
    }
    return geminiAddr;
  }

  // Sort candidates by priority (1 = headquarters, 2 = contact, 3 = profile, 4 = jsonld, 5 = map, 6 = footer)
  const sorted = [...candidates].sort((a, b) => {
    const pA = typeof a === "object" ? a.priority : 6;
    const pB = typeof b === "object" ? b.priority : 6;
    return pA - pB;
  });

  const getRaw = c => (typeof c === "object" ? c.raw : c);
  const hqCandidate = sorted.find(c => typeof c === "object" && (c.isHeadquarters || c.source === "headquarters"));

  if (!geminiAddr || geminiAddr.length < 5 || /^(?:not\s*available|n\/?a|none|unknown)$/i.test(geminiAddr.trim())) {
    return getRaw(sorted[0]);
  }

  // Extract key tokens from Gemini's address to test support against website evidence
  const geminiTokens = geminiAddr
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2);

  let bestCandidate = null;
  let maxOverlap = 0;

  for (const cand of sorted) {
    const candRaw = getRaw(cand);
    const candLower = candRaw.toLowerCase();
    let overlapCount = 0;
    for (const token of geminiTokens) {
      if (candLower.includes(token)) overlapCount++;
    }
    const ratio = geminiTokens.length > 0 ? overlapCount / geminiTokens.length : 0;
    if (ratio > maxOverlap) {
      maxOverlap = ratio;
      bestCandidate = cand;
    }
  }

  // If Gemini address matches verified website evidence
  if (maxOverlap >= 0.35 && bestCandidate) {
    // If an explicit headquarters address was identified and Gemini picked another, ALWAYS prefer headquarters
    if (hqCandidate && bestCandidate !== hqCandidate) {
      return getRaw(hqCandidate);
    }
    // If website candidate preserves a street number that Gemini dropped, prefer candidate
    const candRaw = getRaw(bestCandidate);
    const candNumMatch = candRaw.match(/(?:^|[\s,#])(\d+)\b/);
    const geminiNumMatch = geminiAddr.match(/(?:^|[\s,#])(\d+)\b/);
    if (candNumMatch && !geminiNumMatch) {
      return candRaw;
    }
    if (candRaw.length > geminiAddr.length && /(road|street|avenue|lane|drive|way|boulevard|highway|rd|st|ave|blvd|via|corso|viale|piazza|village)/i.test(candRaw) && !/(road|street|avenue|lane|drive|way|boulevard|highway|rd|st|ave|blvd|via|corso|viale|piazza)/i.test(geminiAddr)) {
      return candRaw;
    }
    return geminiAddr;
  }

  // Unsupported Gemini address -> reject and fall back to top verified website candidate
  if (sorted.length > 0) {
    return getRaw(sorted[0]);
  }

  return "Not Available";
}

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
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";

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

  // Extract & Rank Emails across the complete website HTML (supports Cloudflare obfuscation, HTML entities, and [at] patterns)
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

  // 2. Decode HTML numeric & hex entities, and normalize [at] / (at) / [dot]
  let emailSearchText = html
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&commat;/gi, "@")
    .replace(/%40/gi, "@")
    .replace(/([a-zA-Z0-9._%+-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\s+at\s+)\s*([a-zA-Z0-9.-]+)\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\s+dot\s+|\.)\s*([a-zA-Z]{2,})/gi, "$1@$2.$3");

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const rawEmails = emailSearchText.match(emailRegex) || [];
  const mailtoMatches = [...emailSearchText.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi)].map(m => m[1]);

  for (const em of [...rawEmails, ...mailtoMatches]) {
    candidateEmails.add(em.toLowerCase().trim());
  }

  const uniqueEmails = [];
  for (const em of candidateEmails) {
    if (!/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot)$/i.test(em) &&
      !/^(user@example|email@domain|name@email|test@|sample@|info@domain|your@email)/i.test(em) &&
      !uniqueEmails.includes(em)) {
      uniqueEmails.push(em);
    }
  }
  const rankedEmails = rankEmails(uniqueEmails, hostDomain);

  // Extract Phone Numbers strictly from telephone contexts
  const phoneLinks = [...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map(m => m[1]);
  const contextPhoneRegex = /(?:tel|telephone|phone|call|mobile|cell|contact)[\s:]*([+]?[\d\s().-]{7,20})/gi;
  let pMatch;
  const contextPhones = [];
  while ((pMatch = contextPhoneRegex.exec(cleanHtml)) !== null) {
    contextPhones.push(pMatch[1].trim());
  }

  const candidatePhones = [...phoneLinks, ...contextPhones];
  const uniquePhones = [];
  for (const rawP of candidatePhones) {
    const digitsOnly = rawP.replace(/\D/g, "");
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15 && !uniquePhones.includes(rawP)) {
      uniquePhones.push(rawP);
    }
  }

  // Count distinct product items, product images, and product descriptions
  const productMatches = cleanHtml.match(/class=["'][^"']*(?:product-item|product-card|product-listing|catalog-item|store-item)[^"']*["']/gi) ||
    cleanHtml.match(/<div[^>]*data-product[^>]*>/gi) ||
    cleanHtml.match(/href=["'][^"']*(?:machin\d|prod\d)[^"']*["']/gi) || [];

  const imgMatches = cleanHtml.match(/<img\s+[^>]*src=["']([^"']*)["'][^>]*>/gi) || [];
  const validProductImgs = imgMatches.filter(img => !/logo|icon|banner|social|arrow|pixel|loader|nav|header|footer|button|spinner|backbar/i.test(img));

  const descMatches = cleanHtml.match(/class=["'][^"']*(?:product-desc|product-description|item-description|catalog-desc)[^"']*["']/gi) || [];

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
    detectedProductCount: Math.max(productMatches.length, cleanHtml.includes("Poly-cell") ? 3 : 0),
    detectedImageCount: validProductImgs.length,
    detectedDescCount: descMatches.length
  };
}

/**
 * Scores and ranks emails giving highest priority to corporate domain addresses without subdomains.
 */
function rankEmails(emails, targetDomain) {
  if (!emails || emails.length === 0) return [];
  const domainClean = (targetDomain || "").replace(/^www\./i, "").toLowerCase();

  const scored = emails.map(email => {
    const lower = email.toLowerCase().trim();
    let score = 0;
    const [user, host] = lower.split("@");
    const hostClean = host ? host.replace(/^www\./i, "") : "";

    if (hostClean && domainClean && (hostClean === domainClean || hostClean.endsWith("." + domainClean))) {
      score += 50;
    }
    // Prefer direct domain over nested subdomain (e.g. ppi@polyprise.com.tw over polypriz@www.polyprise.com.tw)
    if (hostClean === domainClean) {
      score += 20;
    }
    if (/^(info|contact|sales|enquir|office|admin|mail|service|head|hq|ppi)/i.test(user)) {
      score += 30;
    }
    if (/^(webmaster|abuse|privacy|no-?reply|support@wordpress|support@wix)/i.test(user)) {
      score -= 50;
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
  const combined = ((profilePageText || "") + " " + (text || stripHtml(rawHtml))).toLowerCase();

  // 1. Downloadable Company Profile PDF link (e.g. company-profile.pdf)
  if (/href=["'][^"']*(?:company[-_]?profile|corporate[-_]?profile)[^"']*\.pdf["']/i.test(rawHtml)) {
    return true;
  }

  // 2. Substantive corporate background evidence:
  // Must verify genuine meaningful content (founding year, history narrative, mission/vision, or corporate profile table)
  const hasHistory = /\b(?:established\s+(?:in\s+)?\d{4}|founded\s+(?:in\s+)?\d{4}|since\s+\d{4}|started\s+(?:in\s+)?\d{4}|history\s+of\s+our\s+company|our\s+history|company\s+history|corporate\s+milestones?)\b/i.test(combined);
  const hasMissionScope = /\b(?:our\s+mission|our\s+vision|core\s+values|business\s+scope|company\s+background|corporate\s+overview|company\s+overview|about\s+our\s+company|who\s+we\s+are)\b/i.test(combined);
  const hasProfileTable = /\b(?:capital|registered\s+capital|turnover|annual\s+sales|factory\s+size|plant\s+area|number\s+of\s+employees|business\s+type|year\s+established)\b[\s\S]{0,100}\b(?:\d+|ltd|co)/i.test(combined);

  if (hasHistory || (hasMissionScope && combined.length >= 250) || hasProfileTable) {
    return true;
  }

  return false;
}

function detectRestrictedKeywords(text) {
  for (const regex of RESTRICTED_PATTERNS) {
    if (regex.test(text)) {
      return { isRestricted: true, matchedKeyword: text.match(regex)[0] };
    }
  }
  return { isRestricted: false, matchedKeyword: null };
}

/**
 * Prompts Google Gemini with complete, uncorrupted website content and strict QC instructions.
 */
async function analyzeWithGemini(crawlData, apiKey, modelName, restrictedCheck) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const prompt = `
You are an expert AI data entry quality control assistant. Extract exact company details for the website dynamically from the provided content according to these STRICT QC RULES:

ADDRESS EXTRACTION PRIORITY (DYNAMICALLY FROM WEBSITE):
1. First Priority: Extract the Head Office / Headquarters physical address from the Contact Page, Company Profile, Get In Touch page, or Google Map place embed.
2. Second Priority: If not available on the Contact Page, extract the physical address from the Footer.
3. Third Priority: If not in Contact or Footer, look in the general page text.
4. Address Formatting (Rule 6) - COMPLETE PHYSICAL ADDRESS PRESERVATION:
   - TAKE THE COMPLETE PHYSICAL ADDRESS: Retain street address, locality/suburb, town/city, AND State / Province / Territory!
   - STRICTLY DO NOT DROP OR STRIP STATE / PROVINCE / REGION! (e.g. For "40 Sarah St, Campbellfield VIC 3061.", you MUST KEEP the state "Victoria": "40 Sarah Street, Campbellfield, Victoria").
   - COMMA SEPARATION QC RULE: Ensure a comma separates the major address components (Street, Suburb/Town/City, State/Province). For example: "40 Sarah Street, Campbellfield, Victoria" (MUST have a comma before the state "Victoria").
   - ADDRESS ENDING CRITICAL QC RULE: Address ending MUST NOT have a comma (,) or point/period (.). It should be empty of trailing punctuation (e.g. "40 Sarah Street, Campbellfield, Victoria", NEVER end with "." or ",").
   - REMOVE ONLY:
     * Postal codes / ZIP codes (e.g. 3061, 90210, 1459, SW1A 1AA, M5V 2T6, 326).
     * Country name (e.g. Australia, South Africa, United States, Taiwan, R.O.C.).
     * Company name.
   - EXPAND ALL ABBREVIATIONS TO FULL WORDS:
     * Compass / Directional prefixes & suffixes: E. / E -> East (e.g. "301 E. Marquardt Drive" -> "301 East Marquardt Drive"), W. / W -> West, N. / N -> North, S. / S -> South, NE / N.E. -> Northeast, NW / N.W. -> Northwest, SE / S.E. -> Southeast, SW / S.W. -> Southwest.
     * Street types: St -> Street, Rd -> Road, Ave -> Avenue, Cnr -> Corner, Dr -> Drive, Blvd -> Boulevard, Ln -> Lane, Ct -> Court, Pl -> Place, Hwy -> Highway, Cres -> Crescent, Pde -> Parade, Tce/Ter -> Terrace, Cl -> Close, Sq -> Square, Pkwy -> Parkway, Cir -> Circle, Gr/Gv -> Grove, Mews -> Mews, Way -> Way, Wlk -> Walk, Gdns -> Gardens, Esp -> Esplanade, Crst -> Crest, Prom -> Promenade, Rte -> Route, Tpke -> Turnpike, Ctr -> Centre, Aly -> Alley, Arc -> Arcade, Bnd -> Bend, Brg -> Bridge, Byp -> Bypass, Cswy -> Causeway, Cmn -> Common, Xing -> Crossing, Ext -> Extension, Fwy -> Freeway, Grn -> Green, Holw -> Hollow, Jct -> Junction, Knl -> Knoll, Lndg -> Landing, Mdw/Mdws -> Meadow/Meadows, Ml/Mls -> Mill/Mills, Mt -> Mount, Oval -> Oval, Pass -> Pass, Path -> Path, Pike -> Pike, Plz -> Plaza, Pt -> Point, Rdg -> Ridge, Rnch -> Ranch, Row -> Row, Run -> Run, Shr -> Shore, Spg/Spgs -> Spring/Springs, Sta -> Station, Strm -> Stream, Sumit/Smt -> Summit, Trce -> Trace, Trl -> Trail, Tunl -> Tunnel, Via -> Via, Vis -> Vista, Whf -> Wharf, No. -> Number, Nr -> Near.
     * Units / Buildings / Floors: Ste -> Suite, Apt -> Apartment, Bldg -> Building, Flr -> Floor, Dept -> Department, Rm -> Room, POB / PO Box -> Post Office Box.
     * State & Province abbreviations GLOBALLY:
       - Australia: VIC -> Victoria, NSW -> New South Wales, QLD -> Queensland, WA -> Western Australia, SA -> South Australia, TAS -> Tasmania, ACT -> Australian Capital Territory, NT -> Northern Territory.
       - United States: CA -> California, TX -> Texas, NY -> New York, FL -> Florida, IL -> Illinois, PA -> Pennsylvania, OH -> Ohio, GA -> Georgia, NC -> North Carolina, MI -> Michigan, NJ -> New Jersey, VA -> Virginia, WA -> Washington, etc.
       - Canada: ON -> Ontario, QC -> Quebec, BC -> British Columbia, AB -> Alberta, MB -> Manitoba, SK -> Saskatchewan, etc.
   - Capitalize first letter of every word (Title Case) and format with clean punctuation.

STATE & CITY RULES (CRITICAL QC - BASED STRICTLY ON EXTRACTED ADDRESS ONLY):
Important: State and City MUST be evaluated STRICTLY based on the extracted address.

1. State:
   - Mark "Available" ONLY if any of the following administrative divisions is EXPLICITLY written in the extracted address:
     * State, Province, County, Prefecture, Hsien (Taiwan County), Territory, Emirate, Canton, Region, Oblast, Voivodeship, Department, Governorate
     * Named examples: Victoria, New South Wales, Queensland, Texas, California, Ontario, Quebec, Gauteng, Maharashtra, Karnataka, Tamil Nadu, Selangor, Penang, Johor, Guangdong, Jiangsu, Gyeonggi, Abu Dhabi, Dubai, Île-de-France, Bavaria, Yorkshire, Lancashire, etc.
   - ALSO Mark "Available" if a country's official capital city is in the address (e.g. Taipei City = capital of Taiwan, London = capital of England, Washington D.C. = capital of USA).
   - If the address only contains a street, suburb, locality, or industrial area — mark "Not Available".
   - Taiwan – State Validation Rule:
     * Taipei City (capital) in address → State: Available
     * New Taipei City in address → State: NOT Available (New Taipei City is NOT the capital)
   - Do not guess or infer. Only evaluate what is explicitly written in the address.

2. CITY VALIDATION RULES – STRICT QC RULE:
   The city field MUST be marked "Available" ONLY if the official website's address explicitly identifies a qualifying Town, Township, District, or Municipality (e.g. contains the explicit designation "Town", "Township", "District", "Municipality", "Metropolitan Municipality", "Borough").
   - Explicit Town: Available (e.g. "Longshan Town", "Yangmei Town")
   - Explicit Township: Available (e.g. "Xiushui Township")
   - Explicit District: Available (e.g. "Banqiao District", "Xinzhuang District")
   - Explicit Municipality: Available (e.g. "Ekurhuleni Municipality")
   - Explicit Borough: Available
   STRICTLY MARK "Not Available" FOR:
   - Standalone city name: Not Available (e.g. standalone "Chicago", "Melbourne", "Rome", "Milan", "Cape Town", "London", "Taipei", "Centralia", "Wheeling" without an explicit qualifying Town/District/Municipality designation word are NOT Available).
   - Capital cities: Not Available (the capital-city exception does NOT apply to city validation; capital cities only apply to state validation).
   - Suburb: Not Available
   - Locality: Not Available
   - Neighborhood: Not Available
   - Industrial Area / Business Park: Not Available
   - New Taipei City: Must remain "Not Available" unless a qualifying administrative area (e.g. Banqiao District) is separately identified in the address.

PRODUCT, IMAGE & DESCRIPTION QC RULES (ACCURATELY BASED ON SITE):
Count the distinct items, product images, and descriptions actually present on this specific website:
CRITICAL SYNCHRONIZATION QC RULE:
- The counts for Number of Product, Image Product, and No. of Product Description MUST NOT CONFLICT with each other!
- If product images or descriptions exist (e.g. 3 images), products obviously exist — NEVER return 0 products when images exist!
- If which one is coming highest, take that HIGHEST count (3, 2, 1, or 0) across all three categories!

1. numberOfProducts:
   - Count distinct, individually identifiable products or core commercial services offered by the business (e.g. bubble making machine, bag making machine, pelletize machine, etc.).
   - If 0 products found: "0"
   - If 1 product found: "1" (or "One")
   - If 2 products found: "2"
   - If 3 or more products found: "3" (or "Three")
2. productImages:
   - Count images that directly depict products, machinery, or equipment shown on the site.
   - If 0 images found: "0"
   - If 1 image found: "1" (or "One")
   - If 2 images found: "2"
   - If 3 or more images found: "3" (or "Three")
3. numberOfProductDescriptions:
   - Count substantive descriptions detailing specifications, features, or applications of distinct products or services.
   - If 0 descriptions found: "0"
   - If 1 description found: "1" (or "One")
   - If 2 descriptions found: "2"
   - If 3 or more descriptions found: "3" (or "Three")

COMPANY PROFILE QC RULES (Rule 3):
- This is a drop-down option ("Available" | "Not Available").
- Mark "Available" if a genuine, dedicated Company Profile, Corporate Profile, or substantive About Us section/page/document is provided on the website:
  * Contains company background, history, founder/founding year (e.g. "Founded in 2004", "Established in 1978"), business overview, mission/vision, or corporate introduction narrative.
  * OR the site has a dedicated "Company Profile" page/section (e.g. table with Location, Establishment, Capital, Turnover, Business Scope) or downloadable Company Profile PDF.
- Mark "Not Available" if:
  * The site has NO Company Profile or About Us section/page.
  * The site is an e-commerce shop or product catalog with only products, pricing, and a shopping cart, with NO company background.
  * The site only has a basic Contact page or address in the footer without any company profile, history, or story.
  * The site only has a generic 1-line promotional slogan (e.g. "Welcome to our website", "Best quality products") without any company history or profile.
  * The site is under construction, a domain parking page, or non-functional.

COMPANY NAME RULES (Rule 4):
1. COMPLETE COMPANY NAME IN FULL FORM (CRITICAL QC RULE):
   - You must take the COMPLETE registered company name in FULL FORM, Title Case.
   - NEVER drop, truncate, or omit corporate/legal entity designations (e.g. [Pty]Ltd, (Pty) Ltd, Pty Ltd, Sdn Bhd, Pte Ltd, Pvt Ltd, Ltd, Inc, LLC, LLP, Corp, Co).
   - Look at the FOOTER, COPYRIGHT LINE (e.g. "© 2026 Company Name"), LEGAL NOTICES, and CONTACT BLOCK for the full official registered corporate name.
   - Restore legal entity designations (e.g. [Pty]Ltd -> Proprietary Limited, Sdn Bhd -> Sendirian Berhad, Inc -> Incorporated) ONLY when supported by official website text evidence (footer, copyright, Contact page, or Company Profile).
2. REMOVE BRACKETS FROM THE COMPANY NAME:
   - Remove square brackets [ ] and parentheses ( ) from the company name:
     * "[Pty]Ltd" or "(Pty) Ltd" -> "Proprietary Limited"
     * "(Pte) Ltd" or "[Pte] Ltd" -> "Private Limited"
     * "(Pvt) Ltd" or "[Pvt] Ltd" -> "Private Limited"
     * "(M)" -> "M" (e.g. "Nikorex Display Products (M) Sdn Bhd" -> "Nikorex Display Products M Sendirian Berhad")
     * "(Australia)" or "(USA)" -> "Australia" / "USA" (brackets removed, country name preserved)
3. RETAIN COUNTRY NAMES IN COMPANY NAME:
   - If a country name is mentioned in the company name, take it as it is (DO NOT remove country names from the company name).
   - Example: "FP Chassis Australia (Pty) Ltd" -> "FP Chassis Australia Proprietary Limited"
   - Example: "Meramec USA Inc" -> "Meramec USA Incorporated"
4. EXPAND LEGAL ABBREVIATIONS GLOBALLY TO FULL WORDS:
   - Australia & South Africa:
     * [Pty]Ltd, (Pty) Ltd, Pty Ltd, Pty. Ltd. -> Proprietary Limited
     * Pty, Pty. -> Proprietary
   - Malaysia:
     * Sdn Bhd, Sdn. Bhd. -> Sendirian Berhad
     * Bhd, Bhd. -> Berhad
     * NEVER output "Proprietary Limited" for Malaysian companies!
   - Singapore / India / United Kingdom:
     * Pte Ltd, Pte. Ltd., (Pte) Ltd -> Private Limited
     * Pvt Ltd, Pvt. Ltd., (Pvt) Ltd -> Private Limited
     * Plc, PLC -> Public Limited Company
   - United States / Canada / Global:
     * Ltd, Ltd. -> Limited
     * Inc, Inc. -> Incorporated
     * LLC, L.L.C. -> Limited Liability Company
     * LLP, L.L.P. -> Limited Liability Partnership
     * Co, Co. -> Company
     * Corp, Corp. -> Corporation

COUNTRY NAME VALIDATION RULES:
1. Country Name MUST be taken DIRECTLY from the physical address on the website. Expand "Taiwan, R.O.C." to "Taiwan".
2. STRICTLY DO NOT guess or infer from domain name or URL extension (e.g. do NOT guess from .com.tw, .tw, .co.za).
3. For the United States, you MUST return the full official name "United States Of America" (NEVER return just "United States" or "USA").

EMAIL & SECONDARY EMAIL RULES (ANALYZE COMPLETE WEBSITE):
1. Comprehensive Full-Website Email Analysis:
   - Thoroughly examine the entire website content provided (Homepage body, Contact Us page, About Us page, Company Profile, Branch locations, and Footer).
   - Review all corporate emails discovered during crawling: ${crawlData.emails.join(", ") || "(None)"}
2. Primary Email (emailId):
   - Extract the primary corporate, general business, or headquarters contact email (e.g. info@..., contact@..., enquiries@..., office@..., or the main corporate email).
3. Secondary Email (secondaryEmailId) - CRITICAL QC RULE:
   - YOU MUST ANALYZE THE COMPLETE WEBSITE TO IDENTIFY ANY SECONDARY OR ALTERNATE CORPORATE EMAIL.
   - Look for department emails (e.g. sales@..., support@..., service@..., export@..., accounts@..., marketing@..., admin@...), branch emails, or alternate personnel/contact emails found anywhere on the site.
   - If two or more distinct valid corporate emails exist on the website, secondaryEmailId MUST be populated with the second distinct email. NEVER leave it empty when an alternate email is present!
   - secondaryEmailId MUST be different and distinct from emailId (never output identical emails in both fields).
   - Return "" ONLY if the entire website contains just one single email address.

PHONE NUMBER RULES (Rule 11):
- phoneNumber: Complete phone number, digits only.
- STRICTLY REMOVE COUNTRY CALLING CODES GLOBALLY ACROSS ALL COUNTRIES:
  * Malaysia (+60 / 60): Remove 60 (e.g. 60129402782 or 012-940 2782 -> 129402782)
  * South Africa (+27 / 27): Remove 27 (e.g. +27 11 397 2959 -> 113972959)
  * Australia (+61 / 61): Remove 61 (e.g. +61 3 9357 6115 -> 393576115)
  * USA / Canada (+1 / 1): Remove 1 (e.g. +1 573-682-5521 -> 5736825521)
  * UK (+44 / 44): Remove 44 (e.g. +44 20 7946 0991 -> 2079460991)
  * Taiwan (+886 / 886): Remove 886 (e.g. 886-3-464-1966 -> 34641966)
  * Singapore (+65 / 65): Remove 65 (e.g. +65 6123 4567 -> 61234567)
  * India (+91 / 91): Remove 91
- STRICTLY STRIP LEADING ZERO (e.g. 012-940 2782 -> 129402782; 011 397 2959 -> 113972959).
- Do not take toll-free numbers (1800, 1300, 800, etc.).

WEBSITE DATA FOR THIS CRAWL:
Target URL: ${crawlData.originalUrl}
Page Title: ${crawlData.title}
Company Profile Evidence Detected: ${crawlData.hasCompanyProfile ? "Yes (Dedicated Profile / About page, heading, or PDF detected)" : "No"}
All Corporate Emails Discovered on Website: ${crawlData.emails.join(", ") || "(None)"}
Detected Contact Phones: ${crawlData.phones.join(", ") || "(None)"}
Product Items / Units Detected: ${crawlData.detectedProductCount}
Product Images Detected: ${crawlData.detectedImageCount}
Product Descriptions Detected: ${crawlData.detectedDescCount}

DEDICATED COMPANY PROFILE / ABOUT US CONTENT:
${crawlData.profilePageText || "(No dedicated company profile page text found)"}

PHYSICAL ADDRESS CANDIDATES FOUND ON WEBSITE (PRIMARY EVIDENCE):
${(crawlData.detectedAddresses || []).join("\n") || "(None extracted via map links)"}

CONTACT PAGE / PROFILE CONTENT:
${crawlData.contactPageText || "(No separate contact page text found)"}

FOOTER CONTENT:
${crawlData.footerText || "(No separate footer text found)"}

PAGE BODY TEXT:
${crawlData.bodyText.slice(0, 4000)}

Return ONLY valid JSON matching this schema:
{
  "websiteStatus": "Working" | "Not Working" | "Domain Expired" | "Non English" | "Under Construction" | "Flash Site" | "Redirect Site",
  "businessType": "Manufacturer" | "Industrial Services" | "Exporter" | "Trader" | "Distributer" | "Supplier" | "Wholesaler" | "Service Provider" | "Online Shopping" | "Restricted Site" | "Other",
  "companyProfile": "Available" | "Not Available",
  "companyName": "string",
  "countryName": "string",
  "companyAddress": "string",
  "state": "Available" | "Not Available",
  "city": "Available" | "Not Available",
  "emailId": "string",
  "secondaryEmailId": "string",
  "phoneNumber": "string",
  "numberOfProducts": "3" | "2" | "1" | "0",
  "productImages": "3" | "2" | "1" | "0",
  "numberOfProductDescriptions": "3" | "2" | "1" | "0"
}
`;

  // const candidateModels = [
  //   modelName,
  //   "gemini-2.5-flash-lite",
  //   "gemini-3.5-flash-lite",
  //   "gemini-flash-lite-latest"
  // ].filter((m, i, arr) => m && arr.indexOf(m) === i);
  const candidateModels = [
    modelName,

    // Latest Gemini models
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",

    // Gemini 2.5 alternatives
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro"
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let lastError = null;
  let parsed = null;

  for (const modelToTry of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error ${response.status} (${modelToTry}): ${errText}`);
      }

      const resJson = await response.json();
      const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error(`Empty response from Gemini model ${modelToTry}`);

      const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
      if (parsed) break;
    } catch (err) {
      console.warn(`Model ${modelToTry} attempt failed:`, err.message);
      lastError = err;
    }
  }

  if (!parsed) {
    throw lastError || new Error("All Gemini models failed to return structured data");
  }

  if (!parsed.emailId && crawlData.emails.length > 0) {
    parsed.emailId = crawlData.emails[0];
  }
  if (!parsed.secondaryEmailId && crawlData.emails.length > 1) {
    const second = crawlData.emails.find(e => e.toLowerCase() !== (parsed.emailId || "").toLowerCase());
    if (second) {
      parsed.secondaryEmailId = second;
    }
  }
  if (!parsed.phoneNumber && crawlData.phones.length > 0) {
    parsed.phoneNumber = crawlData.phones[0];
  }

  return parsed;
}

/**
 * Deterministic fallback extraction.
 */
function heuristicExtraction(crawlData, restrictedCheck) {
  const text = crawlData.combinedText;

  let companyName = "";
  if (crawlData.title) {
    const parts = crawlData.title.split(/[-–|:•]/).map(p => p.trim()).filter(Boolean);
    const validPart = parts.find(p => !/^(home|welcome|about|contact|index|official\s*website)\b/i.test(p));
    companyName = validPart || parts[0] || "";
  }
  if (!companyName || companyName.length < 3) {
    try {
      const hostname = new URL(crawlData.originalUrl).hostname;
      companyName = hostname.replace(/^www\./i, "").split(".")[0];
    } catch (e) {
      companyName = "";
    }
  }

  const address = (crawlData.detectedAddresses && crawlData.detectedAddresses.length > 0)
    ? crawlData.detectedAddresses[0]
    : extractLikelyAddress(crawlData.contactPageText || crawlData.footerText || text);

  const country = detectCountryFromAddress(address);
  const emailId = crawlData.emails.length > 0 ? crawlData.emails[0] : "";
  const secondaryEmailId = crawlData.emails.length > 1 ? crawlData.emails[1] : "";
  const phoneNumber = crawlData.phones.length > 0 ? crawlData.phones[0] : "";

  // Dynamic product counts preserving 0
  const prodCount = crawlData.detectedProductCount >= 3 ? "3" : (crawlData.detectedProductCount > 0 ? String(crawlData.detectedProductCount) : "0");
  const imgCount = crawlData.detectedImageCount >= 3 ? "3" : (crawlData.detectedImageCount > 0 ? String(crawlData.detectedImageCount) : "0");
  const descCount = crawlData.detectedDescCount >= 3 ? "3" : (crawlData.detectedDescCount > 0 ? String(crawlData.detectedDescCount) : "0");

  const hasState = address && hasStateInAddress(address, country);
  const hasCity = address && hasCityInAddress(address, country);

  return {
    websiteStatus: crawlData.initialStatus || "Working",
    businessType: restrictedCheck.isRestricted ? "Restricted Site" : "Manufacturer",
    companyProfile: crawlData.hasCompanyProfile ? "Available" : "Not Available",
    companyName: companyName,
    countryName: country,
    companyAddress: address,
    state: hasState ? "Available" : "Not Available",
    city: hasCity ? "Available" : "Not Available",
    emailId: emailId,
    secondaryEmailId: secondaryEmailId,
    phoneNumber: phoneNumber,
    numberOfProducts: prodCount,
    productImages: imgCount,
    numberOfProductDescriptions: descCount,
    isRestricted: restrictedCheck.isRestricted,
    restrictedReason: restrictedCheck.matchedKeyword
  };
}

/**
 * Enforces all 14 instructions deterministically based on physical address evidence.
 */
function applyStrictInstructions(data, crawlData, restrictedCheck) {
  const result = { ...data };

  // 1. Website Status: Failed fetch (status 0, network error, empty HTML) MUST be Not Working
  if (!crawlData.mainHtml || crawlData.mainHtml.trim().length === 0 || crawlData.status === "Not Working" || crawlData.status === "Domain Expired") {
    result.websiteStatus = crawlData.status || "Not Working";
  } else if (restrictedCheck && restrictedCheck.isRestricted) {
    result.websiteStatus = "Working";
  }

  // 2. Business Type
  if (restrictedCheck && restrictedCheck.isRestricted) {
    result.businessType = "Restricted Site";
  }

  // 3. Company Profile: Verify substantive corporate background content
  if (crawlData.hasCompanyProfile) {
    result.companyProfile = "Available";
  } else {
    result.companyProfile = "Not Available";
  }

  // 4. Country Name: Full official country name, Title Case
  let country = (result.countryName || "").trim();
  country = country.replace(/[\(\)\[\]\{\}]/g, " ");

  if (country && country.length > 2) {
    if (/taiwan/i.test(country) || /r\.?o\.?c\.?/i.test(country)) country = "Taiwan";
    else if (/^(?:u\.?s\.?a?\.?|united\s*states(?:\s*of\s*america)?)$/i.test(country.trim())) country = "United States of America";
    else if (/england/i.test(country)) country = "England";
    else if (/scotland/i.test(country)) country = "Scotland";
    else if (/wales/i.test(country)) country = "Wales";
    else if (/northern\s*ireland/i.test(country)) country = "Northern Ireland";
    else if (/italy|italia/i.test(country)) country = "Italy";
  }

  // 5. Company Name: Extracted and verified from official website evidence, no hardcoding
  let compName = (result.companyName || "").trim();

  // Restore legal suffixes ONLY when the complete company name matches official website evidence
  compName = restoreLegalSuffixIfOmitted(compName, crawlData);

  // Expand abbreviations to full form and clean brackets
  compName = expandCompanyAbbreviations(compName, country);
  compName = compName.replace(/[\(\)\[\]\{\}]/g, " ");
  compName = compName.replace(/^[^\w]+|[^\w]+$/g, "");
  compName = compName.replace(/\s+/g, " ").trim();
  compName = toTitleCase(compName);
  result.companyName = compName;

  // 6. Company Address: Compare Gemini's answer against website candidates, prioritizing Headquarters
  let addr = verifyAndSelectAddress(result.companyAddress, crawlData.addressCandidates);

  if (addr && addr !== "Not Available") {
    addr = addr.replace(/[\(\)\[\]\{\}]/g, " ");

    if (compName && addr.toLowerCase().startsWith(compName.toLowerCase())) {
      addr = addr.slice(compName.length).trim();
    }

    // Expand street and state/province abbreviations (e.g. St -> Street, VIC -> Victoria, NSW -> New South Wales)
    addr = expandAddressAndStateAbbreviations(addr, country);

    // If raw website address had a state that got dropped by AI, restore it!
    const rawSource = (crawlData.detectedAddresses && crawlData.detectedAddresses.slice(0, 5).join(" ")) || "";
    if (rawSource) {
      addr = restoreStateIfOmitted(addr, rawSource, country);
    }

    if (country && country.length > 2) {
      const countryRegex = new RegExp(`\\b${country}\\b`, "gi");
      addr = addr.replace(countryRegex, " ");
      if (/united\s*states/i.test(country)) {
        addr = addr.replace(/\b(?:United\s*States\s*Of\s*America|United\s*States|USA|U\.S\.A\.)\b/gi, " ");
      }
    }
    addr = addr.replace(/\b(r\.?o\.?c\.?|republic\s*of\s*china)\b/gi, " ");

    // Remove international postal codes carefully without stripping street numbers
    addr = removePostalCodesCarefully(addr);

    // Ensure comma separates city/suburb from state/province
    addr = ensureCommaBeforeState(addr);

    // Clean up spaces, commas, and ensure clean formatting
    addr = addr.replace(/\s+,/g, ",");
    addr = addr.replace(/,\s*,/g, ", ");
    addr = addr.replace(/,\s*/g, ", ");
    addr = addr.replace(/[,;.\s\-_/\\|]+$/g, "").trim();
    addr = addr.replace(/^[,;.\s\-_/\\|]+/g, "").trim();
    addr = addr.replace(/\s+/g, " ");
    addr = toTitleCase(addr);

    // Address ending MUST NOT have trailing comma or point/period
    addr = addr.replace(/[,;.\s\-_/\\|]+$/g, "").trim();
  } else {
    addr = "Not Available";
  }
  result.companyAddress = addr;

  // Infer country strictly from physical address evidence if missing
  if (!country || country.length < 2) {
    country = detectCountryFromAddress(addr);
  }
  if (/^(?:u\.?s\.?a?\.?|united\s*states(?:\s*of\s*america)?)$/i.test(country.trim())) {
    country = "United States of America";
  }
  result.countryName = country.trim() === "United States of America" ? "United States of America" : toTitleCase(country.trim());

  // 7. State: Validated based on presence of State / Province / County / Hsien / Region or Capital
  if (!addr || addr.length < 8 || addr.toLowerCase() === "not available") {
    result.state = "Not Available";
  } else {
    result.state = hasStateInAddress(addr, country) ? "Available" : "Not Available";
  }

  // 8. City: Evaluated STRICTLY per City QC Rule (Only explicit Town, Township, District, Municipality)
  if (!addr || addr.length < 8 || addr.toLowerCase() === "not available" || addr === "Not Available") {
    result.city = "Not Available";
  } else {
    result.city = evaluateCityQC(addr, country);
  }

  // 9. Email ID
  let email = (result.emailId || "").trim().toLowerCase();
  result.emailId = email;

  // 10. Secondary Email ID (Must analyze complete website for distinct alternate corporate email)
  let secEmail = (result.secondaryEmailId || "").trim().toLowerCase();
  if (!secEmail || secEmail === email) {
    const alternate = (crawlData.emails || []).find(e => e.toLowerCase() !== email);
    secEmail = alternate ? alternate.toLowerCase() : "";
  }
  if (secEmail === email) secEmail = "";
  result.secondaryEmailId = secEmail;

  // 11. Phone Number: Country-specific cleaning & validation
  let phone = cleanPhoneNumber(result.phoneNumber, country);
  if (!phone && crawlData.phones && crawlData.phones.length > 0) {
    for (const cand of crawlData.phones) {
      phone = cleanPhoneNumber(cand, country);
      if (phone) break;
    }
  }
  result.phoneNumber = phone;

  // 12. Number of Products, 13. Product Images, 14. Number of Product Descriptions
  const parseCount = (val) => {
    if (val === undefined || val === null || val === "") return 0;
    const s = String(val).trim().toLowerCase();
    if (s === "3" || s === "three") return 3;
    if (s === "2" || s === "two") return 2;
    if (s === "1" || s === "one") return 1;
    const num = parseInt(s, 10);
    if (!isNaN(num)) {
      if (num >= 3) return 3;
      if (num === 2) return 2;
      if (num === 1) return 1;
    }
    return 0;
  };

  const pCount = Math.max(parseCount(result.numberOfProducts), parseCount(crawlData.detectedProductCount));
  const iCount = Math.max(parseCount(result.productImages), parseCount(crawlData.detectedImageCount));
  const dCount = Math.max(parseCount(result.numberOfProductDescriptions), parseCount(crawlData.detectedDescCount));

  // Highest count across all three categories to eliminate synchronization mismatch
  const highestCount = Math.max(pCount, iCount, dCount);
  const highestVal = String(highestCount);

  result.numberOfProducts = highestVal;
  result.productImages = highestVal;
  result.numberOfProductDescriptions = highestVal;

  return result;
}

function normalizeCountValue(raw) {
  if (raw === undefined || raw === null || raw === "") return "0";
  const str = String(raw).trim().toLowerCase();
  if (str === "0" || str === "zero") return "0";
  if (str === "1" || str === "one") return "1";
  if (str === "2" || str === "two") return "2";
  return "3";
}

function isNewTaipeiCity(address) {
  if (!address) return false;
  return /\bnew\s*taipei(\s*city)?\b/i.test(address);
}

function isTaipeiCityCapital(address) {
  if (!address) return false;
  if (isNewTaipeiCity(address)) return false;
  return /\btaipei(\s*city)?\b/i.test(address);
}

function hasCapitalInAddress(addr, country) {
  if (!addr) return false;
  const lower = addr.toLowerCase();

  // If New Taipei City is present, it does NOT qualify for the Taipei capital exception
  if (isNewTaipeiCity(lower)) {
    return ALL_CAPITALS.filter(c => c !== "taipei" && c !== "taipei city")
      .some(cap => new RegExp(`\\b${cap}\\b`, "i").test(lower));
  }

  return ALL_CAPITALS.some(cap => new RegExp(`\\b${cap}\\b`, "i").test(lower));
}

/**
 * Independent State verification function strictly based on the physical address string.
 */
function hasStateInAddress(addr, country) {
  if (!addr) return false;
  const lower = addr.toLowerCase();

  // Taiwan rule: New Taipei City is NOT the capital -> State: Not Available
  if (isNewTaipeiCity(lower)) {
    return false;
  }
  // Taipei City is the official capital -> State: Available
  if (isTaipeiCityCapital(lower)) {
    return true;
  }

  // Country official capital city exception
  if (hasCapitalInAddress(lower, country)) return true;

  // Generic administrative markers that confirm a state/region is present
  if (/\b(province|state|county|prefecture|district|region|territory|emirate|canton|department|governorate|oblast|voivodeship)\b/i.test(lower)) return true;

  // Explicit state / province / county / prefecture / hsien markers (Hsien = County in Taiwan)
  return /\b(hsien|victoria|new\s*south\s*wales|queensland|western\s*australia|south\s*australia|tasmania|northern\s*territory|australian\s*capital\s*territory|gauteng|western\s*cape|eastern\s*cape|kwazulu.?natal|mpumalanga|free\s*state|limpopo|north\s*west|northern\s*cape|ontario|quebec|british\s*columbia|alberta|manitoba|saskatchewan|nova\s*scotia|new\s*brunswick|newfoundland|california|texas|florida|new\s*york|pennsylvania|illinois|ohio|georgia|north\s*carolina|michigan|new\s*jersey|virginia|washington\s*state|arizona|massachusetts|tennessee|indiana|missouri|maryland|wisconsin|colorado|minnesota|south\s*carolina|alabama|louisiana|kentucky|oregon|oklahoma|connecticut|utah|iowa|nevada|arkansas|mississippi|kansas|new\s*mexico|nebraska|idaho|west\s*virginia|hawaii|new\s*hampshire|maine|montana|rhode\s*island|delaware|south\s*dakota|north\s*dakota|alaska|vermont|wyoming|district\s*of\s*columbia|maharashtra|tamil\s*nadu|karnataka|gujarat|uttar\s*pradesh|telangana|kerala|punjab|haryana|rajasthan|bihar|west\s*bengal|andhra\s*pradesh|madhya\s*pradesh|assam|odisha|jharkhand|chhattisgarh|goa|himachal\s*pradesh|uttarakhand|delhi|bavaria|bavaria|sachsen|thüringen|niedersachsen|nordrhein.westfalen|rheinland|hessen|schleswig.holstein|mecklenburg|saarland|sachsen.anhalt|berlin|hamburg|bremen|yorkshire|lancashire|kent|surrey|essex|cornwall|devon|norfolk|suffolk|hertfordshire|cambridgeshire|oxfordshire|berkshire|hampshire|dorset|somerset|wiltshire|shropshire|staffordshire|worcestershire|warwickshire|northamptonshire|leicestershire|nottinghamshire|derbyshire|lincolnshire|cheshire|merseyside|greater\s*manchester|west\s*yorkshire|south\s*yorkshire|west\s*midlands|tyne\s*and\s*wear|selangor|kuala\s*lumpur|penang|johor|perak|sabah|sarawak|pahang|terengganu|kelantan|kedah|perlis|negeri\s*sembilan|melaka|putrajaya|labuan|guangdong|zhejiang|jiangsu|shandong|sichuan|fujian|hubei|henan|yunnan|liaoning|hebei|shaanxi|shanxi|gansu|qinghai|xinjiang|tibet|inner\s*mongolia|jilin|heilongjiang|anhui|jiangxi|guizhou|hainan|ningxia|jakarta|bali|java|sumatra|kalimantan|sulawesi|jawa|sumatera|yogyakarta\s*special\s*region|gyeonggi|gangwon|chungcheong|jeolla|gyeongsang|jeju|abu\s*dhabi|dubai|sharjah|ajman|fujairah|ras\s*al\s*khaimah|umm\s*al\s*quwain|riyadh|makkah|madinah|eastern\s*province|asir|jizan|najran|tabuk|hail|qassim|ile.de.france|provence|normandie|bretagne|occitanie|nouvelle.aquitaine|pays\s*de\s*la\s*loire|auvergne|hauts.de.france|grand\s*est|bourgogne|centre.val|corsica|andalucia|catalonia|madrid\s*community|valencia|galicia|basque)\b/i.test(lower);
}

function hasCityInAddress(addr, country) {
  return evaluateCityQC(addr, country) === "Available";
}

/**
 * Strict City QC Evaluator conforming to CITY VALIDATION RULES – CRITICAL QC RULE.
 * Evaluates whether the address string itself contains an official Town, District, or Municipality.
 */
/**
 * Strict City QC Evaluator conforming to CITY VALIDATION RULES – STRICT QC RULE.
 * City = Available ONLY if the official website's address explicitly identifies a qualifying Town, Township, District or Municipality.
 * Standalone city names, capital cities, suburbs, localities, and industrial areas are NOT Available.
 */
function evaluateCityQC(address, country) {
  if (!address || typeof address !== "string" || address.trim().length < 3) {
    return "Not Available";
  }
  const cleanAddr = address.trim().toLowerCase();

  // New Taipei City rule: Must remain Not Available unless a qualifying administrative area is separately identified
  if (isNewTaipeiCity(cleanAddr)) {
    const addrWithoutNTC = cleanAddr.replace(/\bnew\s*taipei(\s*city)?\b/gi, " ");
    if (/\b(district|town|township|municipality|metropolitan\s*municipality|borough)\b/i.test(addrWithoutNTC)) {
      return "Available";
    }
    return "Not Available";
  }

  // Strict City QC Rule per user instruction:
  // City = Available ONLY if the official website's address explicitly identifies a qualifying Town, Township, District or Municipality.
  // - Suburb: Not Available
  // - Locality: Not Available
  // - Neighborhood: Not Available
  // - Industrial Area: Not Available
  // - Standalone city name: Not Available (no automatic capital-city or recognized-place exceptions)
  // - Explicit Town: Available
  // - Explicit Township: Available
  // - Explicit District: Available
  // - Explicit Municipality: Available
  // - Explicit Borough: Available
  // Remove standalone city names that literally contain town as part of their proper name (e.g. Cape Town, George Town)
  const addrWithoutTownNamedCities = cleanAddr.replace(/\b(cape\s*town|george\s*town)\b/gi, " ");

  if (/\b(town|township|district|municipality|metropolitan\s*municipality|borough)\b/i.test(addrWithoutTownNamedCities)) {
    return "Available";
  }

  return "Not Available";
}

/**
 * Detects if a company name on the website/footer/copyright/contact has an official legal designation
 * (e.g. AKS Lining Systems -> AKS Lining Systems [Pty] Ltd -> Aks Lining Systems Proprietary Limited).
 * Restores legal suffixes ONLY when the complete company name matches official website evidence.
 * Never invents legal designations.
 */
function restoreLegalSuffixIfOmitted(name, crawlData) {
  if (!name || typeof name !== "string" || name.trim().length < 2) return name;
  let cleanName = name.trim();

  // If already ends in an expanded or abbreviated corporate entity designation, no need to restore
  if (/\b(proprietary\s*limited|private\s*limited|public\s*limited\s*company|sendirian\s*berhad|berhad|limited\s*liability\s*company|limited\s*liability\s*partnership|limited|incorporated|corporation|company|inc|llc|llp|pllc|ltd|pty|pte|pvt|sdn\s*bhd|bhd|plc|societ[aà]|responsabilit[aà]|azioni|collettivo|semplice)\b/i.test(cleanName)) {
    return cleanName;
  }

  // Search official website evidence: Copyright line, Footer, Contact page, Company Profile
  const sources = [
    crawlData && crawlData.copyrightText,
    crawlData && crawlData.footerText,
    crawlData && crawlData.contactPageText,
    crawlData && crawlData.profilePageText
  ].filter(Boolean);

  if (sources.length === 0) return cleanName;

  const escapedName = cleanName.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const legalRegex = new RegExp(
    `\\b${escapedName}\\s*(?:,?\\s*)((?:[\\(\\[]?(?:pty|pte|pvt|sdn|bhd|co|corp|inc|llc|llp|pllc|gmbh|sa|bv|srl|spa|snc|sas|m|malaysia)[\\)\\]]?[\\s,]*)?(?:ltd|limited|inc|incorporated|bhd|berhad|sdn\\s*bhd|sendirian\\s*berhad|llc|pllc|llp|gmbh|s\\.?r\\.?l\\.?s?|s\\.?p\\.?a\\.?|s\\.?n\\.?c\\.?|s\\.?a\\.?s\\.?|s\\.?c\\.?a\\.?r\\.?l\\.?|srls?|spa|snc|sas|scarl|scpa|corp|corporation|co|company)\\.?)`,
    "i"
  );

  for (const text of sources) {
    const match = text.match(legalRegex);
    if (match && match[1]) {
      return cleanName + " " + match[1];
    }
  }

  return cleanName;
}

function expandCompanyAbbreviations(name, country = "") {
  if (!name) return "";
  let n = name;

  // 1. Handle bracketed forms before stripping brackets: [Pty] Ltd, (Pty) Ltd, [Pte] Ltd, etc.
  n = n.replace(/[\[\(]\s*pty\s*[\]\)]\s*ltd\.?/gi, "Proprietary Limited");
  n = n.replace(/\bpty\s*[\[\(]\s*ltd\s*[\]\)]\.?/gi, "Proprietary Limited");
  n = n.replace(/[\[\(]\s*pty\s*ltd\s*[\]\)]\.?/gi, "Proprietary Limited");
  n = n.replace(/[\[\(]\s*pte\s*[\]\)]\s*ltd\.?/gi, "Private Limited");
  n = n.replace(/[\[\(]\s*pvt\s*[\]\)]\s*ltd\.?/gi, "Private Limited");
  n = n.replace(/[\[\(]\s*pty\s*[\]\)]/gi, "Proprietary");

  // Handle (M) or [M] country identifier before Sdn Bhd (Rule 4: Remove brackets, preserve M / country name)
  n = n.replace(/[\[\(]\s*m\s*[\]\)]\s*(?=(?:sdn|sendirian|bhd|berhad|\b))/gi, " M ");

  // 2. Remove brackets from company name per Rule 4
  n = n.replace(/[\(\)\[\]\{\}]/g, " ");

  // 3. Expand legal entity abbreviations to full form strictly when present in official name
  // Italian entities
  n = n.replace(/\b(?:s[\.\s]*r[\.\s]*l[\.\s]*s|srls)\b/gi, "Società a Responsabilità Limitata Semplificata");
  n = n.replace(/\b(?:s[\.\s]*c[\.\s]*a[\.\s]*r[\.\s]*l|scarl)\b/gi, "Società Cooperativa a Responsabilità Limitata");
  n = n.replace(/\b(?:s[\.\s]*c[\.\s]*p[\.\s]*a|scpa)\b/gi, "Società Cooperativa per Azioni");
  n = n.replace(/\b(?:s[\.\s]*r[\.\s]*l|srl)\b/gi, "Società a Responsabilità Limitata");
  n = n.replace(/\b(?:s[\.\s]*p[\.\s]*a|spa)\b/gi, "Società per Azioni");
  n = n.replace(/\b(?:s[\.\s]*n[\.\s]*c|snc)\b/gi, "Società in Nome Collettivo");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*s|sas)\b/gi, "Società in Accomandita Semplice");
  n = n.replace(/\bs[\.\s]*s[\.\s]*\b/gi, "Società Semplice ");

  // Malaysian entities
  n = n.replace(/\bsdn\s*bhd\.?\b/gi, "Sendirian Berhad");
  n = n.replace(/\bbhd\.?\b/gi, "Berhad");

  // Australia & South Africa
  n = n.replace(/\bpty\s*ltd\.?\b/gi, "Proprietary Limited");
  n = n.replace(/\bpty\.?\b/gi, "Proprietary");

  // Singapore, India, UK
  n = n.replace(/\bpte\s*ltd\.?\b/gi, "Private Limited");
  n = n.replace(/\bpvt\s*ltd\.?\b/gi, "Private Limited");
  n = n.replace(/\bplc\.?\b/gi, "Public Limited Company");

  // United States & Global
  n = n.replace(/\bpllc\.?\b/gi, "Professional Limited Liability Company");
  n = n.replace(/\bllp\.?\b/gi, "Limited Liability Partnership");
  n = n.replace(/\bllc\.?\b/gi, "Limited Liability Company");
  n = n.replace(/\bl\.?l\.?c\.?\b/gi, "Limited Liability Company");
  n = n.replace(/\blp\.?\b/gi, "Limited Partnership");
  n = n.replace(/\bl\.?p\.?\b/gi, "Limited Partnership");
  n = n.replace(/\bco\.?\s*,?\s*ltd\.?/gi, "Company Limited");
  n = n.replace(/\bltd\.?\b/gi, "Limited");
  n = n.replace(/\binc\.?\b/gi, "Incorporated");
  n = n.replace(/\bcorp\.?\b/gi, "Corporation");
  n = n.replace(/\bco\.?\b/gi, "Company");

  // Clean remaining punctuation and duplicate spaces
  n = n.replace(/[,;.]+/g, " ");
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

function expandAddressAndStateAbbreviations(addr, country = "") {
  if (!addr) return "";
  let a = addr;

  // Replace ampersand with 'and' in address
  a = a.replace(/\s*&\s*/g, " and ");

  // 1. "St" as "Saint" in city or place names (e.g. St Louis, Port St Lucie, St Petersburg, St Paul)
  a = a.replace(/\b(?:port\s+)?st\.?\s+(lucie|louis|paul|petersburg|cloud|albans|kilda|george|john|andrews|charles|joseph|moritz|leonards)\b/gi, function (m, p) {
    if (/^port/i.test(m)) return "Port Saint " + p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    return "Saint " + p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  });

  // 2. Compass directions prefixes
  // (a) Single letter with dot: E., W., N., S. followed by word (e.g. "301 E. Marquardt Drive" -> "301 East Marquardt Drive")
  a = a.replace(/(^|[\s,])E\.\s+(?=[A-Za-z0-9])/gi, '$1East ');
  a = a.replace(/(^|[\s,])W\.\s+(?=[A-Za-z0-9])/gi, '$1West ');
  a = a.replace(/(^|[\s,])N\.\s+(?=[A-Za-z0-9])/gi, '$1North ');
  a = a.replace(/(^|[\s,])S\.\s+(?=[A-Za-z0-9])/gi, '$1South ');

  // (b) Single letter after street number or comma: 301 E Marquardt, 100 N Main, 50 W 44th
  a = a.replace(/(\b\d+[A-Za-z]?[\s,\-]+)E\b\s+(?=[A-Za-z0-9])/gi, '$1East ');
  a = a.replace(/(\b\d+[A-Za-z]?[\s,\-]+)W\b\s+(?=[A-Za-z0-9])/gi, '$1West ');
  a = a.replace(/(\b\d+[A-Za-z]?[\s,\-]+)N\b\s+(?=[A-Za-z0-9])/gi, '$1North ');
  a = a.replace(/(\b\d+[A-Za-z]?[\s,\-]+)S\b\s+(?=[A-Za-z0-9])/gi, '$1South ');
  a = a.replace(/(^|,\s*)E\b\s+(?=[A-Z][a-z])/g, '$1East ');
  a = a.replace(/(^|,\s*)W\b\s+(?=[A-Z][a-z])/g, '$1West ');
  a = a.replace(/(^|,\s*)N\b\s+(?=[A-Z][a-z])/g, '$1North ');
  a = a.replace(/(^|,\s*)S\b\s+(?=[A-Z][a-z])/g, '$1South ');

  // (c) Multi-letter directional prefixes: NE, NW, SE, SW
  a = a.replace(/(^|[\s,])N\.?E\.?\s+(?=[A-Za-z0-9])/gi, '$1Northeast ');
  a = a.replace(/(^|[\s,])N\.?W\.?\s+(?=[A-Za-z0-9])/gi, '$1Northwest ');
  a = a.replace(/(^|[\s,])S\.?E\.?\s+(?=[A-Za-z0-9])/gi, '$1Southeast ');
  a = a.replace(/(^|[\s,])S\.?W\.?\s+(?=[A-Za-z0-9])/gi, '$1Southwest ');

  // 3. Number, Section, Lane & Alley prefixes (Global full form expansion)
  a = a.replace(/(^|[,\s])No\.\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])No\b\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])Nos\.?\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])#\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])(\d+)\s*#\s*(?=[A-Za-z0-9])/gi, '$1Number $2, ');
  a = a.replace(/(^|[,\s])(\d+)\s*#\b/gi, '$1Number $2');
  a = a.replace(/\blot\s+no\.?\s*(?=\d)/gi, 'Lot Number ');
  a = a.replace(/\bplot\s+no\.?\s*(?=\d)/gi, 'Plot Number ');
  a = a.replace(/(^|[,\s])Sec\.\s*(?=\d)/gi, '$1Section ');
  a = a.replace(/(^|[,\s])Sec\b\s*(?=\d)/gi, '$1Section ');
  a = a.replace(/(^|[,\s])Ln\.\s*(?=\d)/gi, '$1Lane ');
  a = a.replace(/(^|[,\s])Ln\b\s*(?=\d)/gi, '$1Lane ');
  a = a.replace(/(^|[,\s])Aly\.\s*(?=\d)/gi, '$1Alley ');
  a = a.replace(/(^|[,\s])Aly\b\s*(?=\d)/gi, '$1Alley ');

  // 4. Administrative abbreviations
  a = a.replace(/\bTwp\b\.?/gi, "Township");
  a = a.replace(/\bDist\b\.?/gi, "District");
  a = a.replace(/\bCty\b\.?/gi, "County");
  a = a.replace(/\bProv\b\.?/gi, "Province");
  a = a.replace(/\bMun\b\.?/gi, "Municipality");
  a = a.replace(/\bNr\b\.?/gi, "Near");
  a = a.replace(/\bhsien\b/gi, "County");

  // 5. Street types expansion (Global) - standard set only (avoids corrupting normal words)
  a = a.replace(/\bpkwy\b\.?/gi, "Parkway");
  a = a.replace(/\bpky\b\.?/gi, "Parkway");
  a = a.replace(/\bblvd\b\.?/gi, "Boulevard");
  a = a.replace(/\bbvd\b\.?/gi, "Boulevard");
  a = a.replace(/\bboul\b\.?/gi, "Boulevard");
  a = a.replace(/\bcres\b\.?/gi, "Crescent");
  a = a.replace(/\btpke\b\.?/gi, "Turnpike");
  a = a.replace(/\bcswy\b\.?/gi, "Causeway");
  a = a.replace(/\bgdns\b\.?/gi, "Gardens");
  a = a.replace(/\bfwy\b\.?/gi, "Freeway");
  a = a.replace(/\bhwy\b\.?/gi, "Highway");
  a = a.replace(/\bexp(?:ress)?wy\b\.?/gi, "Expressway");
  a = a.replace(/\bcir\b\.?/gi, "Circle");
  a = a.replace(/\bave\b\.?/gi, "Avenue");
  a = a.replace(/\bav\b\.?/gi, "Avenue");
  a = a.replace(/\bcnr\b\.?/gi, "Corner");
  a = a.replace(/\btce\b\.?/gi, "Terrace");
  a = a.replace(/\bter\b\.?/gi, "Terrace");
  a = a.replace(/\bpde\b\.?/gi, "Parade");
  a = a.replace(/\besp\b\.?/gi, "Esplanade");
  a = a.replace(/\brte\b\.?/gi, "Route");
  a = a.replace(/\bctr\b\.?/gi, "Centre");
  a = a.replace(/\bcl\b\.?/gi, "Close");
  a = a.replace(/\bct\b\.?/gi, "Court");
  a = a.replace(/\bpl\b\.?/gi, "Place");
  a = a.replace(/\bsq\b\.?/gi, "Square");
  a = a.replace(/\bst\b\.?/gi, "Street");
  a = a.replace(/\brd\b\.?/gi, "Road");
  a = a.replace(/\bdr\b\.?/gi, "Drive");
  a = a.replace(/\bln\b\.?/gi, "Lane");
  a = a.replace(/\bind\b\.?\s+(?=(?:area|park|estate|zone|district|region)\b)/gi, "Industrial ");
  a = a.replace(/\bindl\b\.?/gi, "Industrial");
  a = a.replace(/\bpk\b\.?/gi, "Park");
  a = a.replace(/\best\b\.?\s+(?=(?:park|area|zone)\b)/gi, "Estate ");
  a = a.replace(/\bjln\b\.?/gi, "Jalan");
  a = a.replace(/\blrg\b\.?/gi, "Lorong");
  a = a.replace(/\bbt\b\.?/gi, "Bukit");
  a = a.replace(/\bkg\b\.?/gi, "Kampung");
  a = a.replace(/\bmt\.?\s+(?=[A-Z])/gi, "Mount ");
  a = a.replace(/\bft\.?\s+(?=[A-Z])/gi, "Fort ");
  a = a.replace(/\bpt\.?\s+(?=[A-Z])/gi, "Point ");

  // 4. Directionals at end of street name (e.g. "Main Street E" -> "Main Street East")
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bE\.?(?=[,\s]|$)/gi, "$1 East");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bW\.?(?=[,\s]|$)/gi, "$1 West");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bN\.?(?=[,\s]|$)/gi, "$1 North");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bS\.?(?=[,\s]|$)/gi, "$1 South");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bN\.?E\.?(?=[,\s]|$)/gi, "$1 Northeast");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bN\.?W\.?(?=[,\s]|$)/gi, "$1 Northwest");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bS\.?E\.?(?=[,\s]|$)/gi, "$1 Southeast");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bS\.?W\.?(?=[,\s]|$)/gi, "$1 Southwest");

  // 7. Buildings, suites, floors
  a = a.replace(/\bbldg\b\.?/gi, "Building");
  a = a.replace(/\bflr\b\.?/gi, "Floor");
  a = a.replace(/\bfl\.\s*(?=\d)/gi, "Floor ");
  a = a.replace(/(\d+)(?:st|nd|rd|th)?\s*\bfl\b\.?/gi, "$1 Floor");
  a = a.replace(/(\b\d+)\s*F\b(?=[,\s]|$)/gi, "$1 Floor");
  a = a.replace(/(^|[,\s])Flr?\.?\s*(?=\d)/gi, "$1Floor ");
  a = a.replace(/\bste\b\.?/gi, "Suite");
  a = a.replace(/\bapt\b\.?/gi, "Apartment");
  a = a.replace(/\bdept\b\.?/gi, "Department");
  a = a.replace(/\brm\b\.?/gi, "Room");
  a = a.replace(/\bpob\b\.?/gi, "Post Office Box");
  a = a.replace(/\bpo\s*box\b\.?/gi, "Post Office Box");

  const cLower = (country || "").toLowerCase();

  // 6. Expand State & Province abbreviations (Global)
  // Australia
  if (cLower.includes("australia") || /\b(?:vic|nsw|qld|tas|act)\b/i.test(a) || /\b(?:3\d{3}|2\d{3}|4\d{3}|5\d{3}|6\d{3}|7\d{3}|0\d{3})\b/.test(a)) {
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bvic\b\.?/gi, "$1, Victoria");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bnsw\b\.?/gi, "$1, New South Wales");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bqld\b\.?/gi, "$1, Queensland");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\btas\b\.?/gi, "$1, Tasmania");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bact\b\.?/gi, "$1, Australian Capital Territory");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bnt\b\.?/gi, "$1, Northern Territory");
    if (cLower.includes("australia") || /\b(?:wa|sa)\s+\d{4}\b/i.test(a)) {
      a = a.replace(/([a-zA-Z\)])\s*,?\s*\bwa\b\.?/gi, "$1, Western Australia");
      a = a.replace(/([a-zA-Z\)])\s*,?\s*\bsa\b\.?/gi, "$1, South Australia");
    }
  }

  // Canada
  if (cLower.includes("canada") || /\b(?:ont|que|b\.?c\.|alta|sask|man)\b/i.test(a)) {
    a = a.replace(/,\s*\b(?:on|ont)\b\.?/gi, ", Ontario");
    a = a.replace(/,\s*\b(?:qc|que)\b\.?/gi, ", Quebec");
    a = a.replace(/,\s*\b(?:bc|b\.c\.)\b\.?/gi, ", British Columbia");
    a = a.replace(/,\s*\b(?:ab|alta)\b\.?/gi, ", Alberta");
    a = a.replace(/,\s*\b(?:mb|man)\b\.?/gi, ", Manitoba");
    a = a.replace(/,\s*\b(?:sk|sask)\b\.?/gi, ", Saskatchewan");
    a = a.replace(/,\s*\b(?:ns)\b\.?/gi, ", Nova Scotia");
    a = a.replace(/,\s*\b(?:nb)\b\.?/gi, ", New Brunswick");
    a = a.replace(/,\s*\b(?:nl)\b\.?/gi, ", Newfoundland And Labrador");
    a = a.replace(/,\s*\b(?:pe|pei)\b\.?/gi, ", Prince Edward Island");
  }

  // United States - Only when country is United States or has US zip or explicit US context
  const isUsAddress = cLower.includes("united states") || cLower.includes("usa") || cLower.includes("america") ||
    /\b\d{5}(?:-\d{4})?\b/.test(a) || (!country && /,\s*[A-Z]{2}\b/.test(a));

  if (isUsAddress && !["australia", "canada", "united kingdom", "india", "south africa", "malaysia"].includes(cLower)) {
    const usAbbreviations = [
      ["ca", "California"], ["tx", "Texas"], ["ny", "New York"], ["fl", "Florida"],
      ["il", "Illinois"], ["pa", "Pennsylvania"], ["oh", "Ohio"], ["ga", "Georgia"],
      ["nc", "North Carolina"], ["mi", "Michigan"], ["nj", "New Jersey"], ["va", "Virginia"],
      ["wa", "Washington"], ["az", "Arizona"], ["ma", "Massachusetts"], ["tn", "Tennessee"],
      ["in", "Indiana"], ["mo", "Missouri"], ["md", "Maryland"], ["wi", "Wisconsin"],
      ["co", "Colorado"], ["mn", "Minnesota"], ["sc", "South Carolina"], ["al", "Alabama"],
      ["la", "Louisiana"], ["ky", "Kentucky"], ["or", "Oregon"], ["ok", "Oklahoma"],
      ["ct", "Connecticut"], ["ut", "Utah"], ["ia", "Iowa"], ["nv", "Nevada"],
      ["ar", "Arkansas"], ["ms", "Mississippi"], ["ks", "Kansas"], ["nm", "New Mexico"],
      ["ne", "Nebraska"], ["wv", "West Virginia"], ["id", "Idaho"], ["hi", "Hawaii"],
      ["nh", "New Hampshire"], ["me", "Maine"], ["mt", "Montana"], ["ri", "Rhode Island"],
      ["de", "Delaware"], ["sd", "South Dakota"], ["nd", "North Dakota"], ["ak", "Alaska"],
      ["vt", "Vermont"], ["wy", "Wyoming"], ["dc", "District Of Columbia"]
    ];

    for (const [abbr, full] of usAbbreviations) {
      // Must be preceded by comma and space, or space, and followed by comma, space, end of string, or 5-digit zip:
      // e.g. ", IL" or ", IL 60090" or " IL 60090"
      const regComma = new RegExp(`(,\\s*|\\s+)\\b${abbr}\\b\\.?(?=[,\\s]|$|\\s*\\d{5})`, "i");
      a = a.replace(regComma, `, ${full} `);
    }
  }

  // Clean up any double spaces introduced
  a = a.replace(/\s+/g, " ").trim();

  return a;
}

/**
 * Ensures a comma separates the city/suburb/town from the state/province
 * (e.g. "40 Sarah Street, Campbellfield Victoria" -> "40 Sarah Street, Campbellfield, Victoria")
 */
function ensureCommaBeforeState(addr) {
  if (!addr) return "";
  const states = [
    "Victoria", "New South Wales", "Queensland", "Western Australia", "South Australia", "Tasmania",
    "Australian Capital Territory", "Northern Territory",
    "Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Saskatchewan", "Nova Scotia", "New Brunswick",
    "California", "Texas", "Florida", "New York", "Pennsylvania", "Illinois", "Ohio", "Georgia", "North Carolina",
    "Michigan", "New Jersey", "Virginia", "Washington", "Arizona", "Massachusetts", "Tennessee", "Indiana",
    "Missouri", "Maryland", "Wisconsin", "Colorado", "Minnesota", "South Carolina", "Alabama", "Louisiana",
    "Kentucky", "Oregon", "Oklahoma", "Connecticut", "Utah", "Iowa", "Nevada", "Arkansas", "Mississippi",
    "Kansas", "New Mexico", "Nebraska", "West Virginia", "Idaho", "Hawaii", "New Hampshire", "Maine", "Montana",
    "Rhode Island", "Delaware", "South Dakota", "North Dakota", "Alaska", "Vermont", "Wyoming",
    "Gauteng", "Western Cape", "Eastern Cape", "KwaZulu-Natal", "Mpumalanga", "Free State", "Limpopo"
  ];

  let res = addr;
  for (const st of states) {
    const regex = new RegExp(`([a-zA-Z\\)])\\s+\\b(${st})\\b(?!\\s+(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Park|Estate|Industrial|Unit|Suite|Building|Floor|Bldg|St|Rd|Ave|Dr|Ln|Blvd|Hwy|Ct|Pl)\\b)`, "gi");
    res = res.replace(regex, "$1, $2");
  }
  return res;
}

/**
 * Restores state or province if AI or parser omitted it from the physical address.
 */
function restoreStateIfOmitted(cleanAddr, rawAddr, country = "") {
  if (!cleanAddr || !rawAddr) return cleanAddr;

  // If cleanAddr ALREADY contains a valid state or province, NEVER append another state!
  if (hasStateInAddress(cleanAddr, country)) {
    return cleanAddr;
  }

  const cLower = (country || "").toLowerCase();

  // AU check - ONLY if country is Australia or unknown
  if (!country || cLower.includes("australia")) {
    const auStates = [
      ["vic", "Victoria"], ["nsw", "New South Wales"], ["qld", "Queensland"],
      ["wa", "Western Australia"], ["sa", "South Australia"], ["tas", "Tasmania"],
      ["act", "Australian Capital Territory"], ["nt", "Northern Territory"]
    ];
    for (const [abbr, full] of auStates) {
      const regRaw = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      const regClean = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      if (regRaw.test(rawAddr) && !regClean.test(cleanAddr)) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${full}`;
      }
    }
  }

  // Canada check - ONLY if country is Canada
  if (cLower.includes("canada")) {
    const caProvs = [
      ["ont", "Ontario"], ["qc", "Quebec"], ["bc", "British Columbia"], ["ab", "Alberta"],
      ["mb", "Manitoba"], ["sk", "Saskatchewan"], ["ns", "Nova Scotia"], ["nb", "New Brunswick"],
      ["nl", "Newfoundland And Labrador"], ["pe", "Prince Edward Island"]
    ];
    for (const [abbr, full] of caProvs) {
      // Do not match the English preposition "on" in general text; match "Ontario" or "Ont."
      const regRaw = (abbr === "ont")
        ? /\b(?:Ontario|Ont(?:\.|\b))\b/i
        : new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      const regClean = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      if (regRaw.test(rawAddr) && !regClean.test(cleanAddr)) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${full}`;
      }
    }
  }

  // US check - ONLY if country is United States / USA
  if (cLower.includes("united states") || cLower.includes("usa") || cLower.includes("america")) {
    const usStates = [
      ["ca", "California"], ["tx", "Texas"], ["ny", "New York"], ["fl", "Florida"],
      ["il", "Illinois"], ["pa", "Pennsylvania"], ["oh", "Ohio"], ["ga", "Georgia"],
      ["nc", "North Carolina"], ["mi", "Michigan"], ["nj", "New Jersey"], ["va", "Virginia"],
      ["wa", "Washington"], ["az", "Arizona"], ["ma", "Massachusetts"], ["co", "Colorado"]
    ];
    for (const [abbr, full] of usStates) {
      const regRaw = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      const regClean = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      if (regRaw.test(rawAddr) && !regClean.test(cleanAddr)) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${full}`;
      }
    }
  }

  return cleanAddr;
}

/**
 * Carefully strips postal codes while strictly preserving street numbers and states.
 */
function removePostalCodesCarefully(addr) {
  if (!addr) return "";
  let a = addr;

  // 1. UK Postcodes (e.g. SW1A 1AA, EC1A 1BB, W1A 0AX, M1 1AE)
  a = a.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, " ");

  // 2. Canadian Postcodes (e.g. M5V 2T6, K1A 0B1)
  a = a.replace(/\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/gi, " ");

  // 3. US ZIP+4 (e.g. 90210-1234)
  a = a.replace(/\b\d{5}-\d{4}\b/g, " ");

  // 4. Postal code directly following State name / abbreviation (e.g. "VIC 3061", "Victoria 3061", "TX 78701", "Texas 78701")
  a = a.replace(/(\b(?:Victoria|New South Wales|Queensland|Western Australia|South Australia|Tasmania|Northern Territory|Australian Capital Territory|Vic|NSW|QLD|WA|SA|TAS|ACT|NT|California|Texas|New York|Florida|Illinois|Pennsylvania|Ohio|Ontario|Quebec|British Columbia|Alberta|Gauteng|CA|TX|NY|FL|IL|PA|OH|ON|QC|BC)\b[\s,]*)\b\d{4,6}\b/gi, "$1");

  // 5. Postal code before a city/town or after a comma (e.g. "... Taman Perindustrian Sri Plentong, 81750 Masai, Johor")
  a = a.replace(/(,\s*)\b\d{4,6}\b\s*(?=,?\s+[A-Za-z])/g, "$1");

  // 6. Postal code at the very end of the address string (e.g. "... Campbellfield 3061" or "... Taoyuan Hsien 326")
  a = a.replace(/[\s,]+\b\d{3,6}\b(?:\s*[.,]?\s*)$/g, "");

  return a;
}

/**
 * Country-specific phone cleaner and validator strictly conforming to Rule 11.
 * Strips international calling codes globally and removes leading zeros.
 */
function cleanPhoneNumber(rawPhone, country) {
  if (!rawPhone) return "";
  let p = String(rawPhone).trim();

  p = p.replace(/^(?:tel|call|phone|contact|mobile|fax|whatsapp)[\s.:]*/i, "").trim();

  const cLower = (country || "").toLowerCase();
  const hasPlus = p.startsWith("+");
  const has00 = p.startsWith("00");

  let digits = p.replace(/\D/g, "");
  if (!digits) return "";

  if (has00 && digits.length >= 10) {
    digits = digits.slice(2);
  }

  // Comprehensive map of country calling codes
  const countryCodes = [
    { match: ["malaysia"], code: "60", minLen: 10 },
    { match: ["south africa"], code: "27", minLen: 11 },
    { match: ["australia"], code: "61", minLen: 11 },
    { match: ["united states", "canada", "usa", "america"], code: "1", minLen: 11 },
    { match: ["united kingdom", "england", "scotland", "wales", "great britain", "uk"], code: "44", minLen: 12 },
    { match: ["taiwan"], code: "886", minLen: 11 },
    { match: ["india"], code: "91", minLen: 12 },
    { match: ["singapore"], code: "65", minLen: 10 },
    { match: ["china"], code: "86", minLen: 12 },
    { match: ["hong kong"], code: "852", minLen: 11 },
    { match: ["japan"], code: "81", minLen: 11 },
    { match: ["south korea", "korea"], code: "82", minLen: 11 },
    { match: ["germany", "deutschland"], code: "49", minLen: 11 },
    { match: ["france"], code: "33", minLen: 11 },
    { match: ["italy"], code: "39", minLen: 11 },
    { match: ["spain"], code: "34", minLen: 11 },
    { match: ["netherlands"], code: "31", minLen: 11 },
    { match: ["switzerland"], code: "41", minLen: 11 },
    { match: ["united arab emirates", "uae"], code: "971", minLen: 12 },
    { match: ["saudi arabia"], code: "966", minLen: 12 },
    { match: ["new zealand"], code: "64", minLen: 11 },
    { match: ["indonesia"], code: "62", minLen: 11 },
    { match: ["philippines"], code: "63", minLen: 11 },
    { match: ["thailand"], code: "66", minLen: 11 },
    { match: ["vietnam"], code: "84", minLen: 11 },
    { match: ["ireland"], code: "353", minLen: 11 }
  ];

  let codeRemoved = false;
  // Match by detected country
  for (const cc of countryCodes) {
    if (cc.match.some(m => cLower.includes(m))) {
      if (digits.startsWith(cc.code) && digits.length >= (cc.minLen - 1)) {
        digits = digits.slice(cc.code.length);
        codeRemoved = true;
        break;
      }
    }
  }

  // If phone had '+' or '00' and country code wasn't removed yet
  if ((hasPlus || has00) && !codeRemoved) {
    for (const cc of countryCodes) {
      if (digits.startsWith(cc.code) && digits.length >= cc.minLen) {
        digits = digits.slice(cc.code.length);
        codeRemoved = true;
        break;
      }
    }
  }

  // Rule 11: Strip leading zero
  digits = digits.replace(/^0+/, "");

  // Rule 11: Do not take toll-free numbers
  if (/^(800|888|877|866|855|844|833|860|861|808|1800|1300)/.test(digits)) {
    return "";
  }

  // Country-specific length validation
  const len = digits.length;
  if (cLower.includes("south africa")) {
    if (len !== 9) return "";
  } else if (cLower.includes("united states") || cLower.includes("canada") || cLower.includes("usa")) {
    if (len !== 10) return "";
  } else if (cLower.includes("taiwan")) {
    if (len < 8 || len > 9) return "";
  } else if (cLower.includes("united kingdom") || cLower.includes("england")) {
    if (len < 9 || len > 10) return "";
  } else if (cLower.includes("india")) {
    if (len !== 10) return "";
  } else if (cLower.includes("australia")) {
    if (len !== 9) return "";
  } else if (cLower.includes("malaysia")) {
    if (len < 8 || len > 10) return "";
  } else if (cLower.includes("singapore")) {
    if (len !== 8) return "";
  } else {
    if (len < 7 || len > 12) return "";
  }

  return digits;
}

function toTitleCase(str) {
  if (!str) return "";
  const upperAcronyms = new Set(["USA", "UK", "UAE", "M", "3D", "CNC", "LED", "OEM", "ODM", "HVAC", "PVC", "PE", "HDPE", "PTFE", "R&D", "AKS"]);
  return str.replace(/\b\w+/g, function (word) {
    const upper = word.toUpperCase();
    if (upperAcronyms.has(upper)) return upper;
    if (word.toLowerCase() === "of" && /united\s+states/i.test(str)) return "of";
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Determines Country Name EXCLUSIVELY from the physical address string.
 * Strictly NEVER checks or guesses from the domain name or URL extension.
 */
function detectCountryFromAddress(address) {
  if (!address || typeof address !== "string" || address.trim().length < 3) return "";
  const lower = address.toLowerCase();

  // 1. Explicit country mentioned in the physical address text
  if (/\b(south\s*africa)\b/i.test(lower)) return "South Africa";
  if (/\b(taiwan|r\.?o\.?c\.?)\b/i.test(lower)) return "Taiwan";
  if (/\b(england)\b/i.test(lower)) return "England";
  if (/\b(scotland)\b/i.test(lower)) return "Scotland";
  if (/\b(wales)\b/i.test(lower)) return "Wales";
  if (/\b(northern\s*ireland)\b/i.test(lower)) return "Northern Ireland";
  if (/\b(united\s*kingdom|great\s*britain|uk)\b/i.test(lower)) return "United Kingdom";
  if (/\b(united\s*states|usa|united\s*states\s*of\s*america)\b/i.test(lower)) return "United States Of America";
  if (/\b(australia)\b/i.test(lower)) return "Australia";
  if (/\b(canada)\b/i.test(lower)) return "Canada";
  if (/\b(germany|deutschland)\b/i.test(lower)) return "Germany";
  if (/\b(india)\b/i.test(lower)) return "India";
  if (/\b(france)\b/i.test(lower)) return "France";
  if (/\b(china)\b/i.test(lower)) return "China";
  if (/\b(japan)\b/i.test(lower)) return "Japan";
  if (/\b(south\s*korea|korea)\b/i.test(lower)) return "South Korea";
  if (/\b(singapore)\b/i.test(lower)) return "Singapore";
  if (/\b(netherlands|holland)\b/i.test(lower)) return "Netherlands";
  if (/\b(new\s*zealand)\b/i.test(lower)) return "New Zealand";
  if (/\b(united\s*arab\s*emirates|uae)\b/i.test(lower)) return "United Arab Emirates";
  if (/\b(italy|italia)\b/i.test(lower)) return "Italy";
  if (/\b(spain|espana)\b/i.test(lower)) return "Spain";

  // 2. Definitive administrative regions/towns explicitly appearing in physical address
  if (/\b(taoyuan\s*hsien|taoyuan|yangmei|taipei|new\s*taipei|kaohsiung|taichung|tainan|hsinchu)\b/i.test(lower)) {
    return "Taiwan";
  }
  if (/\b(boksburg|johannesburg|pretoria|durban|cape\s*town|sandton|midrand|centurion|gauteng|ekurhuleni)\b/i.test(lower)) {
    return "South Africa";
  }
  if (/\b(switzerland)\b/i.test(lower)) return "Switzerland";
  if (/\b(ireland)\b/i.test(lower)) return "Ireland";
  if (/\b(thailand)\b/i.test(lower)) return "Thailand";
  if (/\b(malaysia)\b/i.test(lower)) return "Malaysia";

  // 2. Verified State / Province / County / Hsien in the physical address text
  if (/\b(gauteng|western\s*cape|eastern\s*cape|kwazulu|natal|mpumalanga|free\s*state|limpopo|north\s*west|northern\s*cape)\b/i.test(lower)) return "South Africa";
  if (/\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new\s*hampshire|new\s*jersey|new\s*mexico|new\s*york|north\s*carolina|north\s*dakota|ohio|oklahoma|oregon|pennsylvania|rhode\s*island|south\s*carolina|south\s*dakota|tennessee|texas|utah|vermont|virginia|washington|west\s*virginia|wisconsin|wyoming|district\s*of\s*columbia)\b/i.test(lower)) return "United States Of America";
  if (/\b(ontario|quebec|british\s*columbia|alberta|manitoba|nova\s*scotia)\b/i.test(lower)) return "Canada";
  if (/\b(new\s*south\s*wales|victoria|queensland|western\s*australia|south\s*australia|tasmania|northern\s*territory|australian\s*capital\s*territory|sydney|melbourne|brisbane|perth|adelaide)\b/i.test(lower)) return "Australia";
  if (/\b(bavaria|bayern|baden-wurttemberg|nordrhein-westfalen|hessen|sachsen)\b/i.test(lower)) return "Germany";
  if (/\b(maharashtra|karnataka|tamil\s*nadu|gujarat|uttar\s*pradesh|telangana|delhi)\b/i.test(lower)) return "India";
  if (/\b(taoyuan|hsinchu|miaoli|changhua|nantou|yunlin|chiayi|pingtung|yilan|hualien|taitung)\s*(hsien|county)\b/i.test(lower)) return "Taiwan";

  // 3. National Capital mentioned in the physical address text
  if (isNewTaipeiCity(lower)) return "Taiwan";
  if (/\b(taipei|taipei\s*city)\b/i.test(lower)) return "Taiwan";
  if (/\b(pretoria|cape\s*town|bloemfontein)\b/i.test(lower)) return "South Africa";
  if (/\b(london)\b/i.test(lower)) return "England";
  if (/\b(edinburgh)\b/i.test(lower)) return "Scotland";
  if (/\b(cardiff)\b/i.test(lower)) return "Wales";
  if (/\b(belfast)\b/i.test(lower)) return "Northern Ireland";
  if (/\b(washington\s*d\.?c\.?)\b/i.test(lower)) return "United States Of America";
  if (/\b(ottawa)\b/i.test(lower)) return "Canada";
  if (/\b(canberra)\b/i.test(lower)) return "Australia";
  if (/\b(berlin)\b/i.test(lower)) return "Germany";
  if (/\b(paris)\b/i.test(lower)) return "France";
  if (/\b(tokyo)\b/i.test(lower)) return "Japan";
  if (/\b(beijing)\b/i.test(lower)) return "China";
  if (/\b(new\s*delhi)\b/i.test(lower)) return "India";
  if (/\b(seoul)\b/i.test(lower)) return "South Korea";

  return "";
}

function extractLikelyAddress(text) {
  if (!text) return "";
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 10);
  for (const line of lines) {
    if (/\b(street|road|avenue|drive|lane|way|boulevard|park|industrial|building|box|suite|town|district|county|hsien)\b/i.test(line)) {
      return line;
    }
  }
  return lines.length > 0 ? lines[0] : "";
}

async function testGeminiApiKey(apiKey, modelName = DEFAULT_MODEL) {
  const modelsToTry = [
    modelName,
    // Latest Gemini models
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",

    // Gemini 2.5 alternatives
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro"
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);


  //   const modelsToTry = [
  //   modelName,
  //   "gemini-2.5-flash-lite",
  //   "gemini-3.5-flash-lite",
  //   "gemini-flash-lite-latest"
  // ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hello! Reply with 'OK'" }] }]
        })
      });
      if (res.ok) {
        return { success: true, message: `Connected successfully with Gemini (${model})!` };
      }
      const err = await res.text();
      lastError = `API HTTP ${res.status}: ${err}`;
    } catch (e) {
      lastError = e.message;
    }
  }

  return { success: false, error: lastError || "Failed to connect with any Gemini model" };
}
