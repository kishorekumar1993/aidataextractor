// Floating AI assistant widget, inline buttons, banners, Not Working study card, and preview renderer.

(function (AIExt) {
  const state = (AIExt.state = AIExt.state || {});

  function ensureAiCrawlButtonsVisible() {
    if (state.showFloatingWidget !== false) {
      createFloatingWidget();
      const w = document.getElementById("ai-prefill-widget");
      if (w) {
        w.style.setProperty("display", "block", "important");
        w.style.setProperty("visibility", "visible", "important");
        w.style.setProperty("opacity", "1", "important");
      }
    } else {
      const w = document.getElementById("ai-prefill-widget");
      if (w) w.style.display = "none";
    }

    if (state.showInlineBtn !== false) {
      injectInlineQuickButton();
      const b = document.getElementById("ai-quick-btn");
      if (b) {
        b.style.setProperty("display", "inline-flex", "important");
        b.style.setProperty("visibility", "visible", "important");
        b.style.setProperty("opacity", "1", "important");
      }
    } else {
      const b = document.getElementById("ai-quick-btn");
      if (b) b.style.display = "none";
    }

    updateDetectedUrlDisplay();
  }


  function resetCrawlButtons() {
    const crawlBtn = document.getElementById("ai-crawl-btn");
    const headerCrawlBtn = document.getElementById("ai-header-crawl-btn");
    const quickBtn = document.getElementById("ai-quick-btn");
    if (crawlBtn) {
      crawlBtn.disabled = false;
      crawlBtn.innerHTML = "<span>⚡ Auto-Crawl & Pre-Fill</span>";
    }
    if (headerCrawlBtn) {
      headerCrawlBtn.disabled = false;
      headerCrawlBtn.innerHTML = "⚡ AI Crawl";
    }
    if (quickBtn) {
      quickBtn.disabled = false;
      quickBtn.style.backgroundColor = "";
      quickBtn.style.borderColor = "";
      quickBtn.innerHTML = "🤖 AI Crawl & Fill";
    }
  }


  function showReloadBanner() {
    let banner = document.getElementById("ai-reload-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "ai-reload-banner";
      banner.style.cssText = `
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: #1e293b;
        color: #fff;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 9999999;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: 12px;
        border: 1px solid #3b82f6;
      `;
      banner.innerHTML = `
        <span>🔄 Extension updated. Please refresh this page (press F5) to reconnect!</span>
        <button id="ai-banner-reload-btn" style="background: #3b82f6; color: white; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-weight: 600;">Refresh Page</button>
      `;
      document.body.appendChild(banner);
      document.getElementById("ai-banner-reload-btn").addEventListener("click", () => {
        window.location.reload();
      });
    }
  }

  /**
   * Formats any URL into a safe, absolute, clickable http/https link that opens reliably in a browser tab.
   */
  function formatClickableUrl(url, fallbackBase) {
    const raw = (url && typeof url === "string") ? url.trim() : "";
    const base = (fallbackBase && typeof fallbackBase === "string") ? fallbackBase.trim() : "";
    if (!raw || /^(?:javascript:|mailto:|tel:|#)/i.test(raw)) {
      if (!base || /^(?:javascript:|mailto:|tel:|#)/i.test(base)) return "";
      return /^https?:\/\//i.test(base) ? base : "http://" + base;
    }
    try {
      const validBase = (base && /^https?:\/\//i.test(base)) ? base : "http://localhost";
      const resolved = new URL(raw, validBase);
      if (resolved.origin === "http://localhost" && !/^https?:\/\//i.test(raw)) {
        return "http://" + raw.replace(/^\/+/, "");
      }
      return resolved.href;
    } catch (e) {
      if (/^https?:\/\//i.test(raw)) return raw;
      if (raw.startsWith("//")) return "https:" + raw;
      if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(raw)) return "http://" + raw;
      return base || raw;
    }
  }

  function extractNotWorkingReason(data) {
    if (!data) return {
      category: "Unreachable",
      badge: "UNREACHABLE",
      badgeBg: "#fee2e2",
      badgeColor: "#991b1b",
      reason: "Website unreachable or empty response",
      rule: "Rule 1: If site has no verifiable business content or cannot be reached, mark Not Working.",
      keyword: "",
      link: "",
      snippet: ""
    };

    const siteBaseUrl = data._finalUrl || data._originalUrl || (typeof AIExt.getTargetUrl === "function" ? AIExt.getTargetUrl() : "");

    // 1. Prohibited Category / Word Check (Highest Priority Rule Note 2)
    if (data.restrictedReason || data.isRestricted || data.isProhibitedSite) {
      const rawLink = data.restrictedSourceUrl || data.errorSourceUrl || siteBaseUrl;
      const cat = data.restrictedCategory || data.restrictedReason || "Prohibited Category";
      const kw = data.restrictedKeyword || data.errorKeyword || "";
      return {
        category: "Prohibited Category",
        badge: `PROHIBITED: ${String(cat).toUpperCase()}`,
        badgeBg: "#fee2e2",
        badgeColor: "#991b1b",
        reason: `Prohibited Category Detected: "${cat}"${kw && kw.toLowerCase() !== cat.toLowerCase() ? ` (matched "${kw}")` : ""} found on website`,
        rule: "Rule Note 2: Weapons, Defence, Military, Medicine, Medical, Hospital, Food, Porn, Aerospace, Marine, Chemicals, Animals sites are strictly prohibited. Website Status is set to Not Working with all fields empty.",
        keyword: kw || cat,
        link: formatClickableUrl(rawLink, siteBaseUrl),
        snippet: data.restrictedSnippet || data.errorSnippet || `Prohibited category "${cat}" detected on the website.`
      };
    }

    // 2. Disallowed Business Type (Rule 4: Scope restrictions)
    if (data.disallowedReason || data.isDisallowedBusinessType) {
      const rawLink = data.disallowedSourceUrl || data.errorSourceUrl || siteBaseUrl;
      const bt = data.businessType || data.disallowedKeyword || "Outside Scope";
      return {
        category: "Disallowed Business Type",
        badge: `DISALLOWED: ${String(bt).toUpperCase()}`,
        badgeBg: "#f3e8ff",
        badgeColor: "#6b21a8",
        reason: data.disallowedReason || `Business Type "${bt}" is outside allowed work scope`,
        rule: "Rule 4 & Scope: Only Manufacturer, Supplier, Distributer, Wholesaler, Exporter, Trader, and Industrial Services are worked on. Retailers, Resellers, and Service Providers must be marked Not Working.",
        keyword: data.disallowedKeyword || data.errorKeyword || bt,
        link: formatClickableUrl(rawLink, siteBaseUrl),
        snippet: data.disallowedSnippet || data.errorSnippet || `Business Type classified as "${bt}". Non-industrial services, retailers, and consumer resellers must be marked Not Working.`
      };
    }

    // 3. Online Shopping Cart / Retail Store (Rule 11 & 16)
    if (data.shopCartReason || data.isShopCartSite) {
      const rawLink = data.shopCartSourceUrl || data.errorSourceUrl || siteBaseUrl;
      return {
        category: "Online Shopping Cart",
        badge: "ONLINE SHOPPING / CART",
        badgeBg: "#ffedd5",
        badgeColor: "#9a3412",
        reason: `Online Shopping / Retail Cart: ${data.shopCartReason || 'Shopping cart & checkout buttons detected without manufacturing evidence'}`,
        rule: "Rule 11 & 16: E-commerce websites selling products online with cart/checkout are marked Not Working, except if the company is a verified Manufacturer.",
        keyword: data.shopCartKeyword || data.errorKeyword || "Shopping Cart / Direct Purchase",
        link: formatClickableUrl(rawLink, siteBaseUrl),
        snippet: data.shopCartSnippet || data.shopCartReason || "Direct online consumer checkout detected on website without manufacturing evidence."
      };
    }

    // 4. Free Platform / Subdomain (Rules 9 & 10)
    if (data.errorCategory === "Free Platform / Subdomain" || (data.restrictedReason && /platform|wix|wordpress|blogspot|weebly|subdomain/i.test(data.restrictedReason))) {
      const rawLink = data.errorSourceUrl || siteBaseUrl;
      return {
        category: "Free Platform / Subdomain",
        badge: "FREE PLATFORM / SUBDOMAIN",
        badgeBg: "#fef3c7",
        badgeColor: "#92400e",
        reason: data.restrictedReason || "Website hosted on free platform or disallowed non-root subdomain",
        rule: "Rules 9 & 10: Free hosted platforms (Wix, WordPress, Blogspot, etc.) and non-root streaming subdomains must be marked Not Working.",
        keyword: data.errorKeyword || data.restrictedKeyword || "Free Platform",
        link: formatClickableUrl(rawLink, siteBaseUrl),
        snippet: data.errorSnippet || data.restrictedSnippet || "Website hosted on disallowed free platform or media subdomain."
      };
    }

    // 5. Domain Expired (Rule 1)
    if (data.websiteStatus === "Domain Expired") {
      const rawLink = data.errorSourceUrl || siteBaseUrl;
      return {
        category: "Domain Expired",
        badge: "DOMAIN EXPIRED / 404",
        badgeBg: "#f1f5f9",
        badgeColor: "#475569",
        reason: "Domain Expired, Parked Domain, or Server returned HTTP 404 Not Found",
        rule: "Rule 1: If domain has expired, is parked, or cannot be resolved, mark Domain Expired.",
        keyword: data.errorKeyword || "Domain Expired",
        link: formatClickableUrl(rawLink, siteBaseUrl),
        snippet: data.errorSnippet || "Domain expired or web server returned HTTP 404 Not Found."
      };
    }

    // 6. Non English (Rule 12)
    if (data.websiteStatus === "Non English") {
      const rawLink = data.errorSourceUrl || siteBaseUrl;
      return {
        category: "Non English",
        badge: "NON-ENGLISH",
        badgeBg: "#e0e7ff",
        badgeColor: "#3730a3",
        reason: "Non-English website without English translation option",
        rule: "Rule 12: Websites entirely in a foreign language with no English option must be marked Non English.",
        keyword: data.errorKeyword || "Non English Language",
        link: formatClickableUrl(rawLink, siteBaseUrl),
        snippet: data.errorSnippet || "Non-English Language Without Translation Option (Rule 12)"
      };
    }

    // 7. Flash Format (Rule 14)
    if (data.websiteStatus === "Flash") {
      const rawLink = data.errorSourceUrl || siteBaseUrl;
      return {
        category: "Flash Format",
        badge: "FLASH FORMAT",
        badgeBg: "#fae8ff",
        badgeColor: "#86198f",
        reason: "Flash format website without copyable text",
        rule: "Rule 14: Flash websites without selectable text must be marked Flash.",
        keyword: data.errorKeyword || "Flash Content",
        link: formatClickableUrl(rawLink, siteBaseUrl),
        snippet: data.errorSnippet || "Flash Format Website - Not copyable (Rule 14)"
      };
    }

    // 8. Fetch Error / Connection Timeout / Unreachable
    if (data.fetchError) {
      let cleanErr = data.fetchError;
      if (/listener indicated an asynchronous response|message channel closed/i.test(cleanErr)) {
        cleanErr = "Server connection timed out or background worker took too long to respond. The site may be slow, offline, or blocking requests.";
      }
      const rawLink = data.errorSourceUrl || siteBaseUrl;
      return {
        category: "Unreachable / Timeout",
        badge: "UNREACHABLE / TIMEOUT",
        badgeBg: "#fee2e2",
        badgeColor: "#991b1b",
        reason: `Connection / Fetch Failure: ${cleanErr}`,
        rule: "Instruction: If the website fails to fetch, load, or times out, mark Not Working.",
        keyword: data.errorKeyword || "Unreachable / Timeout",
        link: formatClickableUrl(rawLink, siteBaseUrl),
        snippet: data.errorSnippet || cleanErr
      };
    }

    // 8.5. No Business Products / 0 Products / Empty Catalog (Rule 1)
    if (data.errorCategory === "No Business Products / 0 Products" || /0\s*products/i.test(data.errorKeyword || "") || /0\s*products/i.test(data.notWorkingReason || "")) {
      const rawLink = data.errorSourceUrl || siteBaseUrl;
      return {
        category: "No Business Products",
        badge: "0 PRODUCTS / NO CATALOG",
        badgeBg: "#fee2e2",
        badgeColor: "#b91c1c",
        reason: data.notWorkingReason || "Website has 0 products and no verifiable catalog or physical address (Rule 1).",
        rule: "Rule 1: If site has no verifiable business products, physical goods, or cannot be reached, mark Not Working.",
        keyword: data.errorKeyword || "0 Products / No Catalog",
        link: formatClickableUrl(rawLink, siteBaseUrl),
        snippet: data.errorSnippet || "Website returned 0 products and has no physical company address or verifiable business catalog."
      };
    }

    // 9. Generic Not Working / No Business Content
    const rawLink = data.errorSourceUrl || siteBaseUrl;
    const reasonText = data.notWorkingReason || data._note || "Website has no verifiable business products, physical address, or services";
    return {
      category: "No Business Content",
      badge: "NO BUSINESS CONTENT",
      badgeBg: "#fef3c7",
      badgeColor: "#92400e",
      reason: reasonText,
      rule: "Rule 1: If site has no verifiable business content or cannot be reached, mark Not Working.",
      keyword: data.errorKeyword || "No Verifiable Content",
      link: formatClickableUrl(rawLink, siteBaseUrl),
      snippet: data.errorSnippet || "Website has no verifiable catalog, company profile, or physical business address."
    };
  }

  function showNotWorkingStudyCard(data) {
    const card = document.getElementById("ai-notworking-study-card");
    if (!card) return;
    const info = extractNotWorkingReason(data);
    const reasonEl = document.getElementById("ai-notworking-reason-text");
    const ruleEl = document.getElementById("ai-notworking-rule-text");
    const badgeEl = document.getElementById("ai-notworking-category-badge");
    if (reasonEl) reasonEl.textContent = info.reason;
    if (ruleEl) ruleEl.textContent = info.rule;

    if (badgeEl) {
      badgeEl.textContent = info.badge || "NOT WORKING";
      badgeEl.style.background = info.badgeBg || "#fee2e2";
      badgeEl.style.color = info.badgeColor || "#991b1b";
      badgeEl.style.border = `1px solid ${info.badgeColor || '#991b1b'}`;
    }

    const evidenceBox = document.getElementById("ai-notworking-evidence-box");
    const keywordRow = document.getElementById("ai-notworking-keyword-row");
    const keywordEl = document.getElementById("ai-notworking-keyword-text");
    const linkRow = document.getElementById("ai-notworking-link-row");
    const linkAnchor = document.getElementById("ai-notworking-link-anchor");
    const snippetRow = document.getElementById("ai-notworking-snippet-row");

    if (evidenceBox) {
      const hasKeyword = !!(info.keyword && String(info.keyword).trim());
      const hasLink = !!(info.link && String(info.link).trim());
      const hasSnippet = !!(info.snippet && String(info.snippet).trim());

      if (hasKeyword || hasLink || hasSnippet) {
        evidenceBox.style.display = "block";
        if (keywordRow) {
          keywordRow.style.display = hasKeyword ? "block" : "none";
          if (keywordEl) keywordEl.textContent = info.keyword || "";
        }
        if (linkRow) {
          linkRow.style.display = hasLink ? "block" : "none";
          if (linkAnchor) {
            linkAnchor.href = info.link;
            linkAnchor.textContent = `🔗 ${info.link}`;
            linkAnchor.title = `Open source link in new tab: ${info.link}`;
          }
        }
        if (snippetRow) {
          snippetRow.style.display = hasSnippet ? "block" : "none";
          if (info.snippet) {
            let rawSnippet = String(info.snippet).replace(/^(\.\.\.)+/, '').replace(/(\.\.\.)+$/, '').trim();
            // Highlight the matched keyword in the snippet if present
            if (info.keyword && info.keyword.length >= 2) {
              const escapedKw = info.keyword.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
              try {
                rawSnippet = rawSnippet.replace(new RegExp(`(\\b${escapedKw}\\b|${escapedKw})`, "gi"), '<mark style="background: #fef08a; color: #854d0e; padding: 1px 4px; border-radius: 3px; font-weight: 700;">$1</mark>');
              } catch (e) {}
            }
            snippetRow.innerHTML = `"...${rawSnippet}..."`;
          } else {
            snippetRow.innerHTML = "";
          }
        }
      } else {
        evidenceBox.style.display = "none";
      }
    }

    card.style.display = "block";
  }

  function hideNotWorkingStudyCard() {
    const card = document.getElementById("ai-notworking-study-card");
    if (card) card.style.display = "none";
  }

  function showRestrictedBanner(reason) {
    let banner = document.getElementById("ai-restricted-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "ai-restricted-banner";
      document.body.appendChild(banner);
    }
    banner.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #7f1d1d;
      color: #fef2f2;
      padding: 16px 28px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      z-index: 9999999;
      box-shadow: 0 12px 30px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      gap: 16px;
      border: 2px solid #ef4444;
      max-width: 650px;
    `;
    const cleanReason = String(reason || "Prohibited Category Detected").replace(/[<>"]/g, "");
    banner.innerHTML = `
      <span style="font-size: 26px; line-height: 1;">⛔</span>
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 15px; color: #ffffff; letter-spacing: 0.3px;">PROHIBITED CONTENT / WORD DETECTED</div>
        <div style="font-size: 13px; color: #fecaca; margin-top: 3px; line-height: 1.4;">
          <strong>Category/Word:</strong> ${cleanReason}. Per strict instruction Note 2: Do not work on websites related to prohibited categories or words. Website Status is set to <strong>Not Working</strong> and all other fields have been left empty.
        </div>
      </div>
      <button id="ai-dismiss-restricted-btn" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.4); padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; white-space: nowrap;">Dismiss</button>
    `;
    document.getElementById("ai-dismiss-restricted-btn")?.addEventListener("click", () => {
      banner.remove();
    });
    setTimeout(() => {
      if (document.getElementById("ai-restricted-banner")) {
        banner.remove();
      }
    }, 12000);
  }


  function createFloatingWidget() {
    const existing = document.getElementById("ai-prefill-widget");
    if (existing && document.body && document.body.contains(existing)) {
      return;
    }
    if (existing) {
      try { existing.remove(); } catch (e) { }
    }
    if (!document.body) return;

    const widget = document.createElement("div");
    widget.id = "ai-prefill-widget";

    widget.innerHTML = `
      <div id="ai-prefill-header">
        <div class="ai-header-title">
          <span class="ai-icon-sparkle">✨</span>
          <span>AI Data Entry Assistant</span>
        </div>
        <div class="ai-header-controls">
          <button class="ai-btn-quick-crawl" id="ai-header-crawl-btn" title="Quick AI Crawl & Fill">⚡ AI Crawl</button>
          <button class="ai-btn-icon" id="ai-toggle-minimize" title="Minimize / Expand">−</button>
        </div>
      </div>
      <div id="ai-prefill-body">
        <div class="ai-url-box">
          <div class="ai-url-label">
            <span>Website Name URL</span>
            <span id="ai-detected-tag" style="color: #10b981;">● Detected</span>
          </div>
          <div class="ai-url-value" id="ai-current-target-url">Searching for website URL...</div>
        </div>

        <button class="ai-action-btn ai-btn-primary" id="ai-crawl-btn">
          <span>⚡ Auto-Crawl & Pre-Fill</span>
        </button>

        <div class="ai-widget-auto-row">
          <span>⚡ Auto-crawl till Working site:</span>
          <label class="ai-widget-switch" title="Automatically advance through Not Working sites until a Working site is found">
            <input type="checkbox" id="ai-widget-auto-queue-toggle" ${state.autoQueueEnabled ? "checked" : ""}>
            <span class="ai-widget-slider"></span>
          </label>
        </div>

        <div class="ai-widget-auto-row" style="margin-top: 4px;">
          <span>🛑 Auto-submit Not Working:</span>
          <label class="ai-widget-switch" title="Automatically submit Not Working records. Leave OFF to pause and study Not Working sites.">
            <input type="checkbox" id="ai-auto-submit-notworking-toggle" ${state.autoSubmitNotWorkingEnabled ? "checked" : ""}>
            <span class="ai-widget-slider"></span>
          </label>
        </div>

        <!-- Stop & Batch Controls -->
        <div class="ai-secondary-actions" style="margin-top: 5px;">
          <button class="ai-btn-secondary ai-btn-stop" id="ai-stop-auto-submit-btn" style="flex: 1.2;" title="Immediately stop auto-submission so you can study this Not Working site">🛑 Stop Auto-Submit</button>
          <button class="ai-btn-secondary ai-btn-danger-light" id="ai-submit-notworking-btn" style="flex: 1;" title="Immediately mark current site as Not Working and submit">🚫 Submit 1</button>
        </div>

        <div class="ai-secondary-actions" style="margin-top: 3px;">
          <button class="ai-btn-secondary ai-btn-danger-light" id="ai-batch-10-btn" title="Automatically mark 10 queue sites as Not Working and auto-submit">⚡ Auto 10 Not Working</button>
          <button class="ai-btn-secondary ai-btn-danger-dark" id="ai-batch-all-btn" title="Automatically submit ALL pending sites in queue as Not Working">⚡ Submit ALL</button>
        </div>

        <div class="ai-secondary-actions" style="margin-top: 3px;">
          <button class="ai-btn-secondary" id="ai-pause-pipeline-btn" style="display: none; color: #dc2626; border-color: #fca5a5; background-color: #fef2f2; font-weight: 600;" title="Pause Auto-Queue Pipeline">⏸️ Stop</button>
          <button class="ai-btn-secondary" id="ai-fill-cached-btn" title="Re-apply prefilled values">Fill Form</button>
          <button class="ai-btn-secondary" id="ai-clear-btn" title="Clear highlighted fields">Reset Form</button>
        </div>

        <!-- Dedicated Not Working Study Card with reason & rule -->
        <div id="ai-notworking-study-card" class="ai-notworking-card" style="display: none;">
          <div class="ai-notworking-header" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <span>🚫</span>
              <span style="font-weight: 700; letter-spacing: 0.5px;">NOT WORKING STUDY</span>
            </div>
            <span id="ai-notworking-category-badge" class="ai-notworking-badge"></span>
          </div>
          <div class="ai-notworking-reason" id="ai-notworking-reason-text"></div>
          <div class="ai-notworking-rule" id="ai-notworking-rule-text"></div>

          <!-- Evidence Box: Matched Keyword, Source Link & Snippet -->
          <div id="ai-notworking-evidence-box" style="margin-top: 6px; padding: 6px 8px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 4px; font-size: 11px; display: none;">
            <div id="ai-notworking-keyword-row" style="margin-bottom: 4px; font-weight: 600; color: #9f1239;">
              <span>Trigger / Keyword: </span><span id="ai-notworking-keyword-text" style="background: #ffe4e6; padding: 1px 5px; border-radius: 3px; color: #881337; font-family: monospace;"></span>
            </div>
            <div id="ai-notworking-link-row" style="margin-bottom: 4px;">
              <span style="color: #4b5563;">Found on: </span>
              <a id="ai-notworking-link-anchor" href="#" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-weight: 600; text-decoration: underline; word-break: break-all;">🔗 Open Page Link</a>
            </div>
            <div id="ai-notworking-snippet-row" style="color: #374151; font-style: italic; font-size: 11px; border-top: 1px dashed #fecdd3; padding-top: 4px; margin-top: 4px; line-height: 1.35;"></div>
          </div>

          <div style="margin-top: 8px; display: flex; gap: 6px;">
            <button class="ai-btn-primary ai-btn-danger-light" id="ai-study-confirm-submit-btn" style="flex: 1; padding: 5px 8px; font-size: 11px; font-weight: 700; cursor: pointer; border-radius: 4px;">✓ Confirm & Submit</button>
            <button class="ai-btn-secondary" id="ai-study-dismiss-btn" style="padding: 5px 8px; font-size: 11px; cursor: pointer; border-radius: 4px;">Dismiss</button>
          </div>
        </div>

        <div id="ai-status-container" class="ai-status-bar ai-status-idle">
          <span>Ready to crawl from Website Name</span>
        </div>

        <div id="ai-preview-section" style="display: none;" class="ai-preview-table">
          <div style="font-weight: 600; margin-bottom: 6px; color: #374151;">Extracted Data Preview:</div>
          <div id="ai-preview-list"></div>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // Minimize toggle
    const minBtn = document.getElementById("ai-toggle-minimize");
    const bodyEl = document.getElementById("ai-prefill-body");
    if (minBtn && bodyEl) {
      minBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (bodyEl.style.display === "none") {
          bodyEl.style.display = "block";
          widget.classList.remove("ai-minimized");
          minBtn.textContent = "−";
        } else {
          bodyEl.style.display = "none";
          widget.classList.add("ai-minimized");
          minBtn.textContent = "+";
        }
      });
    }

    // Clicking anywhere on the minimized header expands it back
    const headerEl = document.getElementById("ai-prefill-header");
    if (headerEl && bodyEl) {
      headerEl.addEventListener("click", (e) => {
        if (e.target.closest("#ai-header-crawl-btn") || e.target.closest("#ai-toggle-minimize")) return;
        if (bodyEl.style.display === "none") {
          bodyEl.style.display = "block";
          widget.classList.remove("ai-minimized");
          if (minBtn) minBtn.textContent = "−";
        }
      });
    }

    const stopAutoSubmitBtn = document.getElementById("ai-stop-auto-submit-btn");
    if (stopAutoSubmitBtn) {
      stopAutoSubmitBtn.addEventListener("click", () => {
        if (state.pendingAutoSubmitTimer) {
          clearTimeout(state.pendingAutoSubmitTimer);
          state.pendingAutoSubmitTimer = null;
        }
        state.autoSubmitNotWorkingEnabled = false;
        const toggleEl = document.getElementById("ai-auto-submit-notworking-toggle");
        if (toggleEl) toggleEl.checked = false;
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set({ autoSubmitNotWorkingEnabled: false });
        }
        AIExt.stopAutoQueuePipeline("User stopped auto-submit for study");
        AIExt.stopBatchNotWorking("User stopped auto-submit for study");
        updateStatus("🛑 Auto-Submit STOPPED! You can now review and study the Not Working site.", "warning");
      });
    }

    const autoSubmitNotWorkingToggle = document.getElementById("ai-auto-submit-notworking-toggle");
    if (autoSubmitNotWorkingToggle) {
      autoSubmitNotWorkingToggle.checked = state.autoSubmitNotWorkingEnabled;
      autoSubmitNotWorkingToggle.addEventListener("change", () => {
        state.autoSubmitNotWorkingEnabled = autoSubmitNotWorkingToggle.checked;
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set({ autoSubmitNotWorkingEnabled: autoSubmitNotWorkingToggle.checked });
        }
        if (!state.autoSubmitNotWorkingEnabled) {
          if (state.pendingAutoSubmitTimer) {
            clearTimeout(state.pendingAutoSubmitTimer);
            state.pendingAutoSubmitTimer = null;
          }
          updateStatus("🛑 Auto-Submit Not Working turned OFF (Study mode active)", "idle");
        } else {
          updateStatus("⚡ Auto-Submit Not Working turned ON", "idle");
        }
      });
    }

    const studyConfirmBtn = document.getElementById("ai-study-confirm-submit-btn");
    if (studyConfirmBtn) {
      studyConfirmBtn.addEventListener("click", () => {
        const currentUrl = AIExt.getTargetUrl();
        AIExt.autoSubmitNotWorking(currentUrl);
      });
    }

    const studyDismissBtn = document.getElementById("ai-study-dismiss-btn");
    if (studyDismissBtn) {
      studyDismissBtn.addEventListener("click", () => {
        hideNotWorkingStudyCard();
      });
    }

    const pausePipelineBtn = document.getElementById("ai-pause-pipeline-btn");
    if (pausePipelineBtn) {
      pausePipelineBtn.addEventListener("click", () => {
        AIExt.stopAutoQueuePipeline("User paused auto-queue");
        AIExt.stopBatchNotWorking("User paused batch");
        updateStatus("⏸️ Process paused by user.", "idle");
      });
    }

    const batch10Btn = document.getElementById("ai-batch-10-btn");
    if (batch10Btn) {
      batch10Btn.addEventListener("click", () => {
        AIExt.startBatchNotWorking(10);
      });
    }

    const submitNotWorkingBtn = document.getElementById("ai-submit-notworking-btn");
    if (submitNotWorkingBtn) {
      submitNotWorkingBtn.addEventListener("click", () => {
        AIExt.markAndSubmitCurrentAsNotWorking("Manual 1-click Not Working");
      });
    }

    const batchAllBtn = document.getElementById("ai-batch-all-btn");
    if (batchAllBtn) {
      batchAllBtn.addEventListener("click", () => {
        AIExt.startBatchNotWorking(-1);
      });
    }

    const widgetAutoToggle = document.getElementById("ai-widget-auto-queue-toggle");
    if (widgetAutoToggle) {
      widgetAutoToggle.checked = state.autoQueueEnabled;
      widgetAutoToggle.addEventListener("change", () => {
        state.autoQueueEnabled = widgetAutoToggle.checked;
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set({ autoQueueEnabled: widgetAutoToggle.checked });
        }
        if (!state.autoQueueEnabled) {
          AIExt.stopAutoQueuePipeline("User disabled auto-queue in widget");
          updateStatus("Auto-Queue turned OFF", "idle");
        } else {
          updateStatus("⚡ Auto-Queue enabled: Will crawl till Working site", "idle");
        }
      });
    }

    const crawlBtn = document.getElementById("ai-crawl-btn");
    if (crawlBtn) crawlBtn.addEventListener("click", AIExt.triggerCrawlAndFill);

    const headerCrawlBtn = document.getElementById("ai-header-crawl-btn");
    if (headerCrawlBtn) {
      headerCrawlBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        AIExt.triggerCrawlAndFill();
      });
    }

    const fillCachedBtn = document.getElementById("ai-fill-cached-btn");
    if (fillCachedBtn) {
      fillCachedBtn.addEventListener("click", () => {
        if (state.cachedExtractedData) {
          if (state.cachedExtractedData.isProhibitedSite || state.cachedExtractedData.isRestricted || String(state.cachedExtractedData.businessType || "").toLowerCase() === "restricted site") {
            const reason = state.cachedExtractedData.restrictedReason || "Prohibited Category Detected";
            AIExt.fillFormFields(state.cachedExtractedData);
            renderPreview(state.cachedExtractedData);
            showRestrictedBanner(reason);
            updateStatus(`⛔ PROHIBITED CATEGORY / WORD DETECTED: ${reason}. Website Status set to Not Working (all fields cleared).`, "error");
            return;
          }
          AIExt.fillFormFields(state.cachedExtractedData);
          updateStatus("Pre-filled form with extracted data.", "success");
        } else {
          updateStatus("⚠️ No extracted data yet. Click 'Auto-Crawl & Pre-Fill' to crawl.", "warning");
        }
      });
    }

    const clearBtn = document.getElementById("ai-clear-btn");
    if (clearBtn) clearBtn.addEventListener("click", AIExt.clearFilledFields);
  }

  function injectInlineQuickButton() {
    const existing = document.getElementById("ai-quick-btn");
    if (existing && document.body && document.body.contains(existing)) {
      return;
    }
    if (existing && (!document.body || !document.body.contains(existing))) {
      try { existing.remove(); } catch (e) { }
    }

    // 1. Look for btnClickHere or text "click here"
    const clickHereBtn = document.getElementById("btnClickHere") ||
      Array.from(document.querySelectorAll("button, a, input[type=button]")).find(b => {
        const t = (b.textContent || b.value || "").trim().toLowerCase();
        return t === "click here" || t.includes("click here");
      });

    // 2. Look for Website Name input element
    const websiteInput = AIExt.findWebsiteNameInput();

    let targetParent = null;
    let referenceNode = null;
    let insertAfter = true;

    if (clickHereBtn && clickHereBtn.parentNode) {
      targetParent = clickHereBtn.parentNode;
      referenceNode = clickHereBtn;
      insertAfter = true;
    } else if (websiteInput) {
      const rowContainer = websiteInput.closest(".input-row, .website-input-group, .input-group, .form-group");
      if (rowContainer && (rowContainer.classList.contains("input-row") || rowContainer.classList.contains("website-input-group") || rowContainer.classList.contains("input-group"))) {
        targetParent = rowContainer;
        referenceNode = null;
        insertAfter = false;
      } else if (websiteInput.nextElementSibling) {
        targetParent = websiteInput.parentNode;
        referenceNode = websiteInput.nextElementSibling;
        insertAfter = false;
      } else if (websiteInput.parentNode) {
        targetParent = websiteInput.parentNode;
        referenceNode = websiteInput;
        insertAfter = true;
      }
    } else {
      const form = document.querySelector("#data-entry-form, form, .form-grid, .container");
      if (form) {
        targetParent = form;
        referenceNode = form.firstElementChild;
        insertAfter = false;
      }
    }

    if (!targetParent) return;

    const quickBtn = document.createElement("button");
    quickBtn.id = "ai-quick-btn";
    quickBtn.type = "button";
    quickBtn.innerHTML = "⚡ AI Crawl & Fill";
    quickBtn.title = "Click to automatically crawl website and pre-fill form";
    quickBtn.style.cssText = `
      background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
      color: #ffffff !important;
      border: 1px solid #047857 !important;
      padding: 6px 14px !important;
      border-radius: 6px !important;
      font-size: 13px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      margin-left: 8px !important;
      margin-right: 4px !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      vertical-align: middle !important;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4) !important;
      transition: transform 0.15s ease, background 0.2s ease, box-shadow 0.2s ease !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 999999 !important;
      height: 38px !important;
      line-height: 1 !important;
    `;

    quickBtn.addEventListener("mouseenter", () => {
      quickBtn.style.transform = "scale(1.04)";
      quickBtn.style.boxShadow = "0 4px 14px rgba(16, 185, 129, 0.6)";
    });
    quickBtn.addEventListener("mouseleave", () => {
      quickBtn.style.transform = "scale(1)";
      quickBtn.style.boxShadow = "0 2px 8px rgba(16, 185, 129, 0.4)";
    });

    quickBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      AIExt.triggerCrawlAndFill();
    });

    try {
      if (referenceNode && insertAfter && referenceNode.parentNode === targetParent) {
        targetParent.insertBefore(quickBtn, referenceNode.nextSibling);
      } else if (referenceNode && !insertAfter && referenceNode.parentNode === targetParent) {
        targetParent.insertBefore(quickBtn, referenceNode);
      } else {
        targetParent.appendChild(quickBtn);
      }
    } catch (e) {
      console.warn("[AI Assistant] Error injecting quick button:", e);
    }
  }

  function updateDetectedUrlDisplay() {
    const urlDisplay = document.getElementById("ai-current-target-url");
    const tag = document.getElementById("ai-detected-tag");
    const currentUrl = AIExt.getTargetUrl();

    if (urlDisplay) {
      if (currentUrl) {
        urlDisplay.textContent = currentUrl;
        if (tag) tag.style.display = "inline";
      } else {
        urlDisplay.textContent = "Website Name field is empty";
        if (tag) tag.style.display = "none";
      }
    }
  }

  function attachFieldObservers() {
    document.addEventListener("input", (e) => {
      const target = e.target;
      if (target && (target.placeholder?.toLowerCase().includes("http") || target.name?.toLowerCase().includes("website") || target.value?.startsWith("http") || target.id?.toLowerCase().includes("website"))) {
        updateDetectedUrlDisplay();
      }
    });

    const websiteInput = AIExt.findWebsiteNameInput();
    if (websiteInput) {
      const observer = new MutationObserver(() => {
        updateDetectedUrlDisplay();
      });
      observer.observe(websiteInput, { attributes: true, attributeFilter: ["value"] });
    }

    // Continuous guarantee: re-check every 1.2s so the button never vanishes after submit / next record / AJAX load
    setInterval(() => {
      ensureAiCrawlButtonsVisible();
    }, 1200);

    // MutationObserver on document.body for immediate re-injection on DOM updates
    if (document.body) {
      const domObserver = new MutationObserver(debounce(() => {
        ensureAiCrawlButtonsVisible();
      }, 100));
      domObserver.observe(document.body, { childList: true, subtree: true });
    }

    window.addEventListener("focus", ensureAiCrawlButtonsVisible);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") ensureAiCrawlButtonsVisible();
    });
  }


  function debounce(fn, delay) {
    return function (...args) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function updateStatus(message, type = "idle") {
    const container = document.getElementById("ai-status-container");
    if (!container) return;

    container.className = `ai-status-bar ai-status-${type}`;
    if (type === "loading") {
      container.innerHTML = `<span class="ai-spinner"></span> <span>${message}</span>`;
    } else {
      container.innerHTML = `<span>${message}</span>`;
    }
  }

  function renderPreview(data) {
    const previewSection = document.getElementById("ai-preview-section");
    const previewList = document.getElementById("ai-preview-list");
    if (!previewSection || !previewList) return;

    previewSection.style.display = "block";
    previewList.innerHTML = "";

    const isDisallowed = !!data.isDisallowedBusinessType;
    const isRestr = !!(data.isProhibitedSite || data.isRestricted || String(data.businessType || "").toLowerCase() === "restricted site" || isDisallowed);
    const isRedirect = data.websiteStatus === "Redirect Site" || data.websiteStatus === "Redirect";
    const statusVal = isRestr
      ? `Not Working (${data.disallowedReason || data.restrictedReason || "Prohibited Category"})`
      : (data.isShopCartSite ? `${data.websiteStatus} (Purchase / Cart detected)` : (isRedirect ? `Redirect Site` : data.websiteStatus));
    const businessTypeVal = (isRestr || data.websiteStatus === "Not Working") ? "-" : (data.businessType || "-");

    const siteBaseUrl = data._finalUrl || data._originalUrl || (typeof AIExt.getTargetUrl === "function" ? AIExt.getTargetUrl() : "");

    const btKeyword = (!isRestr && data.websiteStatus !== "Not Working") ? (data.businessTypeKeyword || "") : "";
    const btLink = (!isRestr && data.websiteStatus !== "Not Working") ? formatClickableUrl(data.businessTypeSource, siteBaseUrl) : "";
    const btSnippet = (!isRestr && data.websiteStatus !== "Not Working") ? (data.businessTypeSnippet || "") : "";

    const nameLink = !isRestr ? formatClickableUrl(data.companyNameSource || siteBaseUrl, siteBaseUrl) : "";
    const addrLink = !isRestr ? formatClickableUrl(data.companyAddressSource, siteBaseUrl) : "";
    const primaryEmailLink = !isRestr ? formatClickableUrl(data.primaryEmailSource, siteBaseUrl) : "";
    const secEmailLink = !isRestr ? formatClickableUrl(data.secondaryEmailSource, siteBaseUrl) : "";

    const errKeyword = (isRestr || data.websiteStatus === "Not Working")
      ? (data.errorKeyword || data.restrictedKeyword || data.disallowedKeyword || data.shopCartKeyword || "")
      : "";
    const errLinkRaw = (isRestr || data.websiteStatus === "Not Working")
      ? (data.errorSourceUrl || data.restrictedSourceUrl || data.disallowedSourceUrl || data.shopCartSourceUrl || siteBaseUrl || "")
      : "";
    const errLink = (isRestr || data.websiteStatus === "Not Working")
      ? formatClickableUrl(errLinkRaw, siteBaseUrl)
      : "";
    const errSnippet = (isRestr || data.websiteStatus === "Not Working")
      ? (data.errorSnippet || data.restrictedSnippet || data.disallowedSnippet || data.shopCartSnippet || "")
      : "";

    const redirectDestLink = (isRedirect && data._finalUrl && data._finalUrl !== data._originalUrl)
      ? formatClickableUrl(data._finalUrl, siteBaseUrl)
      : "";

    const items = [
      { key: "Status", val: statusVal, isAlert: isRestr || data.websiteStatus === "Not Working", isHighlight: isRedirect },
      { key: "Redirected To", val: redirectDestLink, isLink: true },
      { key: "Error Keyword", val: errKeyword, isAlert: true },
      { key: "Error Source Link", val: errLink, isLink: true },
      { key: "Error Context", val: errSnippet ? `"...${errSnippet.replace(/^(\.\.\.)+/, '').replace(/(\.\.\.)+$/, '')}..."` : "", isSnippet: true },
      { key: "Business Type", val: businessTypeVal },
      { key: "BT Keyword", val: btKeyword, isHighlight: true },
      { key: "BT Source Link", val: btLink, isLink: true },
      { key: "BT Context", val: btSnippet ? `"...${btSnippet.replace(/^(\.\.\.)+/, '').replace(/(\.\.\.)+$/, '')}..."` : "", isSnippet: true },
      { key: "Company Profile", val: isRestr ? "-" : data.companyProfile },
      { key: "Company Name", val: isRestr ? "-" : (data.companyName || "-") },
      { key: "Name Source Link", val: nameLink, isLink: true },
      { key: "Country", val: isRestr ? "-" : (data.countryName || "-") },
      { key: "Address", val: isRestr ? "-" : (data.companyAddress || "-") },
      { key: "Address Source Link", val: addrLink, isLink: true },
      { key: "State", val: isRestr ? "-" : data.state },
      { key: "City", val: isRestr ? "-" : data.city },
      { key: "Email", val: isRestr ? "-" : stripTrailingContactWordsFromEmail(data.emailId) },
      { key: "Primary Email Link", val: primaryEmailLink, isLink: true },
      { key: "Secondary Email", val: isRestr ? "-" : ((data.secondaryEmailId && stripTrailingContactWordsFromEmail(data.secondaryEmailId).trim().toLowerCase() !== stripTrailingContactWordsFromEmail(data.emailId || "").trim().toLowerCase()) ? stripTrailingContactWordsFromEmail(data.secondaryEmailId) : "(None)") },
      { key: "Sec Email Link", val: (data.secondaryEmailId && stripTrailingContactWordsFromEmail(data.secondaryEmailId).trim().toLowerCase() !== stripTrailingContactWordsFromEmail(data.emailId || "").trim().toLowerCase()) ? secEmailLink : "", isLink: true },
      { key: "Phone", val: isRestr ? "-" : (data.phoneNumber || "-") },
      { key: "No. Products", val: isRestr ? "-" : data.numberOfProducts },
      { key: "Product Images", val: isRestr ? "-" : data.productImages },
      { key: "Product Descs", val: isRestr ? "-" : data.numberOfProductDescriptions }
    ];

    items.forEach(item => {
      // Don't render empty optional lines
      if (!item.val) return;
      if (item.key === "Error Keyword" && !errKeyword) return;
      if (item.key === "Error Source Link" && !errLink) return;
      if (item.key === "Error Context" && !errSnippet) return;
      if (item.key === "BT Keyword" && !btKeyword) return;
      if (item.key === "BT Source Link" && !btLink) return;
      if (item.key === "BT Context" && !btSnippet) return;
      if (item.key === "Name Source Link" && (!data.companyName || isRestr)) return;
      if (item.key === "Address Source Link" && (!data.companyAddress || data.companyAddress === "Not Available" || isRestr)) return;
      if (item.key === "Primary Email Link" && (!data.emailId || isRestr)) return;
      if (item.key === "Sec Email Link" && (!data.secondaryEmailId || data.secondaryEmailId === "(None)" || data.secondaryEmailId.trim().toLowerCase() === String(data.emailId || "").trim().toLowerCase() || !item.val || isRestr)) return;

      const row = document.createElement("div");
      row.className = "ai-preview-row";
      const valStyle = item.isAlert ? 'style="color: #dc2626; font-weight: 700;"' : '';

      let valHtml = '';
      if (item.isLink && item.val) {
        valHtml = `<a href="${item.val}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-weight: 600; text-decoration: underline; font-size: 11px; word-break: break-all;" title="Open source link in new tab: ${item.val}">🔗 ${item.val}</a>`;
      } else if (item.isSnippet && item.val) {
        valHtml = `<span style="color: #4b5563; font-style: italic; font-size: 10.5px; word-break: break-word; line-height: 1.3;">${item.val}</span>`;
      } else if (item.isHighlight && item.val) {
        valHtml = `<span style="background: #e0e7ff; color: #3730a3; padding: 1px 5px; border-radius: 3px; font-weight: 600; font-size: 11px; font-family: monospace;">${item.val}</span>`;
      } else {
        valHtml = `<span class="ai-preview-val" ${valStyle} title="${item.val || ''}">${item.val || '-'}</span>`;
      }

      row.innerHTML = `
        <span class="ai-preview-key" style="${(item.isLink || item.isSnippet) ? 'font-size: 11px; color: #4b5563; font-style: italic;' : ''}">${item.key}:</span>
        ${valHtml}
      `;
      previewList.appendChild(row);
    });
  }
  Object.assign(AIExt, {
    resetCrawlButtons,
    ensureAiCrawlButtonsVisible,
    showReloadBanner,
    formatClickableUrl,
    extractNotWorkingReason,
    showNotWorkingStudyCard,
    hideNotWorkingStudyCard,
    showRestrictedBanner,
    createFloatingWidget,
    injectInlineQuickButton,
    updateDetectedUrlDisplay,
    attachFieldObservers,
    debounce,
    updateStatus,
    renderPreview
  });
})(globalThis.__AI_EXTENSION__ = globalThis.__AI_EXTENSION__ || {});
