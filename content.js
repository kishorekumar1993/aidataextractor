// Content Script: Injected into Data Entry pages to coordinate AI crawling & form pre-filling

(function () {
  console.log("AI Web Crawler & Pre-Fill Assistant active on:", window.location.href);

  let cachedExtractedData = null;
  let lastProcessedUrl = "";

  function isExtensionAlive() {
    try {
      return !!(window.chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  // Resilient message sender preventing any unhandled Promise rejections
  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      if (!isExtensionAlive()) {
        showReloadBanner();
        return resolve({ success: false, error: "Extension context invalidated. Please refresh this page (F5)." });
      }

      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            const err = chrome.runtime.lastError.message || "Unknown error";
            if (err.includes("Extension context invalidated")) {
              showReloadBanner();
            }
            return resolve({ success: false, error: err });
          }
          resolve(response);
        });
      } catch (err) {
        if (err.message && err.message.includes("Extension context invalidated")) {
          showReloadBanner();
        }
        resolve({ success: false, error: err.message });
      }
    });
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("unhandledrejection", (event) => {
      if (event.reason && String(event.reason.message || event.reason).includes("Extension context invalidated")) {
        try { event.preventDefault(); } catch (e) { }
        showReloadBanner();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAssistant);
  } else {
    initAssistant();
  }

  function initAssistant() {
    createFloatingWidget();
    attachFieldObservers();
    injectInlineQuickButton();

    setTimeout(() => {
      const initialUrl = getTargetUrl();
      if (initialUrl) {
        updateDetectedUrlDisplay();
        console.log("Detected Website Name URL on load:", initialUrl);
      }
    }, 500);
  }

  /**
   * Specifically finds the "Website Name:" input element.
   */
  function findWebsiteNameInput() {
    // 1. Direct ID lookup for https://kishorekumar1993.github.io/dataextraction/
    const exact = document.getElementById("inputWebsiteName") || document.getElementById("website-name");
    if (exact) return exact;

    // 2. Look for button with id btnClickHere or text "click here"
    const clickHereBtn = document.getElementById("btnClickHere") ||
      Array.from(document.querySelectorAll("button, a, input[type=button]")).find(b => (b.textContent || b.value || "").toLowerCase().includes("click here"));

    if (clickHereBtn) {
      const container = clickHereBtn.closest(".website-input-group, .input-row, .form-group, div, td, tr");
      if (container) {
        const inputInGroup = container.querySelector("input[type=text], input[type=url], input:not([type=button]):not([type=submit])");
        if (inputInGroup) return inputInGroup;
      }
      if (clickHereBtn.previousElementSibling && clickHereBtn.previousElementSibling.tagName === "INPUT") {
        return clickHereBtn.previousElementSibling;
      }
    }

    // 3. Search by label
    const labels = Array.from(document.querySelectorAll("label, span, div, p"));
    for (const lbl of labels) {
      const text = (lbl.innerText || lbl.textContent || "").trim().toLowerCase();
      if (text.startsWith("website name") || text.includes("website name:")) {
        if (lbl.htmlFor) {
          const el = document.getElementById(lbl.htmlFor);
          if (el) return el;
        }
        const parent = lbl.closest(".form-group, .col, div");
        if (parent) {
          const input = parent.querySelector("input");
          if (input) return input;
        }
      }
    }

    // 4. Any input starting with http
    const allInputs = Array.from(document.querySelectorAll("input"));
    for (const input of allInputs) {
      if (input.type === "hidden" || input.type === "submit" || input.type === "button") continue;
      const val = (input.value || "").trim().toLowerCase();
      if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("www.")) {
        return input;
      }
    }

    return document.querySelector("input[name*='website'], input[id*='website'], input[name*='url'], input[id*='url']");
  }

  function getTargetUrl() {
    const input = findWebsiteNameInput();
    if (input && input.value) {
      return input.value.trim();
    }
    return "";
  }

  function getElementContext(el) {
    if (!el) return "";
    let ctx = `${el.name || ""} ${el.id || ""} ${el.placeholder || ""}`.toLowerCase();
    if (el.id) {
      const lbl = document.querySelector(`label[for="${el.id}"]`);
      if (lbl) ctx += " " + (lbl.textContent || "").toLowerCase();
    }
    let prev = el.previousElementSibling;
    if (prev) {
      ctx += " " + (prev.textContent || "").toLowerCase();
    }
    if (el.parentElement) {
      const parentLabel = el.parentElement.querySelector("label");
      if (parentLabel && parentLabel !== el) {
        ctx += " " + (parentLabel.textContent || "").toLowerCase();
      }
    }
    return ctx;
  }

  /**
   * Discovers and maps page form elements with direct ID matching and robust fallback.
   */
  function detectFormElements() {
    const elements = {};

    // 1. Direct ID mappings matching https://kishorekumar1993.github.io/dataextraction/ & test replica
    elements.websiteUrl = document.getElementById("inputWebsiteName") || document.getElementById("website-name") || findWebsiteNameInput();
    elements.websiteStatus = document.getElementById("selectWebsiteStatus") || document.getElementById("website-status");
    elements.businessType = document.getElementById("selectBusinessType") || document.getElementById("business-type");
    elements.companyProfile = document.getElementById("selectCompanyProfile") || document.getElementById("company-profile");
    elements.companyName = document.getElementById("inputCompanyName") || document.getElementById("company-name");
    elements.companyAddress = document.getElementById("inputCompanyAddress") || document.getElementById("company-address");
    elements.countryName = document.getElementById("inputCountry") || document.getElementById("country-name");
    elements.state = document.getElementById("selectState") || document.getElementById("state");
    elements.city = document.getElementById("selectCity") || document.getElementById("city");
    elements.emailId = document.getElementById("inputEmail") || document.getElementById("email-id") || document.getElementById("email") || document.getElementById("primaryEmail");
    elements.secondaryEmailId = document.getElementById("inputSecondaryEmail") || document.getElementById("secondary-email-id") || document.getElementById("secondaryEmail") || document.getElementById("secondary_email") || document.getElementById("altEmail") || document.getElementById("alternateEmail");
    elements.phoneNumber = document.getElementById("inputPhone") || document.getElementById("phone-number");
    elements.numberOfProducts = document.getElementById("selectProductCount") || document.getElementById("number-of-product");
    elements.productImages = document.getElementById("selectProductImage") || document.getElementById("image-product");
    elements.numberOfProductDescriptions = document.getElementById("selectProductDescription") || document.getElementById("desc-of-product");

    // Fallback detection for any generic portal
    const allInputs = Array.from(document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button])")).filter(i => i !== elements.websiteUrl);
    const allSelects = Array.from(document.querySelectorAll("select"));
    const allTextareas = Array.from(document.querySelectorAll("textarea"));

    if (!elements.websiteStatus) {
      elements.websiteStatus = allSelects.find(s => {
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("website status") || getElementContext(s).includes("website status");
      }) || allSelects[0];
    }

    if (!elements.businessType) {
      elements.businessType = allSelects.find(s => {
        if (s === elements.websiteStatus) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("kind of business") || firstOpt.includes("business type") || getElementContext(s).includes("business type");
      }) || allSelects[1];
    }

    if (!elements.companyProfile) {
      elements.companyProfile = allSelects.find(s => {
        if (s === elements.websiteStatus || s === elements.businessType) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("company profile") || getElementContext(s).includes("company profile");
      }) || allSelects[2];
    }

    if (!elements.companyName) {
      elements.companyName = allInputs.find(inp => {
        const ph = (inp.placeholder || "").toLowerCase();
        return ph.includes("company name") || getElementContext(inp).includes("company name");
      });
    }

    if (!elements.companyAddress) {
      elements.companyAddress = allTextareas.find(ta => {
        return (ta.placeholder || "").toLowerCase().includes("address") || getElementContext(ta).includes("address");
      }) || allInputs.find(inp => {
        return inp !== elements.companyName && (inp.placeholder || "").toLowerCase().includes("address");
      });
    }

    if (!elements.countryName) {
      elements.countryName = allInputs.find(inp => {
        if (inp === elements.companyName || inp === elements.companyAddress) return false;
        const ph = (inp.placeholder || "").toLowerCase().trim();
        return ph === "country" || ph.includes("country") || getElementContext(inp).includes("country");
      });
    }

    if (!elements.state) {
      elements.state = allSelects.find(s => {
        if (s === elements.websiteStatus || s === elements.businessType || s === elements.companyProfile) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt === "state" || getElementContext(s).includes("state:");
      });
    }

    if (!elements.city) {
      elements.city = allSelects.find(s => {
        if (s === elements.websiteStatus || s === elements.businessType || s === elements.companyProfile || s === elements.state) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt === "city" || getElementContext(s).includes("city:");
      });
    }

    if (!elements.emailId) {
      elements.emailId = allInputs.find(inp => {
        if (inp === elements.companyName || inp === elements.companyAddress || inp === elements.countryName) return false;
        const ctx = getElementContext(inp);
        return !ctx.includes("secondary") && (ctx.includes("email") || (inp.placeholder || "").toLowerCase().includes("email id"));
      });
    }

    if (!elements.secondaryEmailId) {
      elements.secondaryEmailId = allInputs.find(inp => {
        if (inp === elements.companyName || inp === elements.companyAddress || inp === elements.countryName || inp === elements.emailId) return false;
        const ctx = getElementContext(inp);
        return ctx.includes("secondary") || ctx.includes("alternate") || ctx.includes("alt email") || ctx.includes("email 2") || ctx.includes("email2") || ctx.includes("additional email") || (inp.placeholder || "").toLowerCase().includes("secondary") || (inp.placeholder || "").toLowerCase().includes("alternate");
      });
    }

    if (!elements.phoneNumber) {
      elements.phoneNumber = allInputs.find(inp => {
        if (inp === elements.companyName || inp === elements.companyAddress || inp === elements.countryName || inp === elements.emailId || inp === elements.secondaryEmailId) return false;
        return getElementContext(inp).includes("phone") || (inp.placeholder || "").toLowerCase().includes("phone");
      });
    }

    if (!elements.numberOfProducts) {
      elements.numberOfProducts = allSelects.find(s => {
        if (s === elements.websiteStatus || s === elements.businessType || s === elements.companyProfile || s === elements.state || s === elements.city) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("number of product") || getElementContext(s).includes("number of product");
      });
    }

    if (!elements.productImages) {
      elements.productImages = allSelects.find(s => {
        if (s === elements.websiteStatus || s === elements.businessType || s === elements.companyProfile || s === elements.state || s === elements.city || s === elements.numberOfProducts) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("image of product") || firstOpt.includes("image product") || getElementContext(s).includes("image product");
      });
    }

    if (!elements.numberOfProductDescriptions) {
      elements.numberOfProductDescriptions = allSelects.find(s => {
        if (s === elements.websiteStatus || s === elements.businessType || s === elements.companyProfile || s === elements.state || s === elements.city || s === elements.numberOfProducts || s === elements.productImages) return false;
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("desc of product") || firstOpt.includes("product description") || getElementContext(s).includes("product description");
      });
    }

    return elements;
  }

  function setInputValue(element, val) {
    if (!element) return false;
    const value = val !== undefined && val !== null ? String(val) : "";

    try {
      const isTextarea = element.tagName && element.tagName.toLowerCase() === "textarea";
      const proto = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(element, value);
      } else {
        element.value = value;
      }
    } catch (e) {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }

  /**
   * Sets dropdown option matching both textual ("Three", "One", "Available") and numeric ("3", "1", "0") options!
   */
  function setSelectValue(element, targetValue) {
    if (!element) return false;
    const targetClean = String(targetValue).trim().toLowerCase();

    if (element.tagName && element.tagName.toLowerCase() === "select") {
      let matchedIndex = -1;

      // 1. Direct text/value match
      for (let i = 0; i < element.options.length; i++) {
        const opt = element.options[i];
        const val = (opt.value || "").trim().toLowerCase();
        const txt = (opt.text || "").trim().toLowerCase();

        if (val === targetClean || txt === targetClean) {
          matchedIndex = i;
          break;
        }
      }

      // 2. Symbolic & Numeric mapping (Supports 0, 1, 2, 3 options as in https://kishorekumar1993.github.io/dataextraction/)
      if (matchedIndex === -1) {
        const isZero = targetClean === "0" || targetClean === "zero";
        const isOne = targetClean === "one" || targetClean === "1";
        const isTwo = targetClean === "two" || targetClean === "2";
        const isThree = targetClean === "three" || targetClean === "3";
        const isAvailable = targetClean === "available";
        const isNotAvailable = targetClean === "not available";

        for (let i = 0; i < element.options.length; i++) {
          const opt = element.options[i];
          const val = (opt.value || "").trim().toLowerCase();
          const txt = (opt.text || "").trim().toLowerCase();

          if (isZero && (val === "0" || txt === "0")) {
            matchedIndex = i;
            break;
          }
          if (isThree && (val === "3" || txt === "3" || val === "three" || txt.includes("three"))) {
            matchedIndex = i;
            break;
          }
          if (isOne && (val === "1" || txt === "1" || val === "one" || txt.includes("one"))) {
            matchedIndex = i;
            break;
          }
          if (isTwo && (val === "2" || txt === "2" || val === "two" || txt.includes("two"))) {
            matchedIndex = i;
            break;
          }
          if (isAvailable && (val === "available" || txt === "available" || (txt.includes("available") && !txt.includes("not")))) {
            matchedIndex = i;
            break;
          }
          if (isNotAvailable && (val === "not available" || txt === "not available" || txt.includes("not available") || (txt.includes("not") && txt.includes("avail")))) {
            matchedIndex = i;
            break;
          }
        }
      }

      // 3. Substring match (skip placeholder option 0 if multiple options exist)
      if (matchedIndex === -1 && element.options.length > 1) {
        for (let i = 1; i < element.options.length; i++) {
          const opt = element.options[i];
          const val = (opt.value || "").trim().toLowerCase();
          const txt = (opt.text || "").trim().toLowerCase();

          if (isAvailable) {
            if ((val.includes("available") || txt.includes("available")) && !val.includes("not") && !txt.includes("not")) {
              matchedIndex = i;
              break;
            }
          } else if (val.includes(targetClean) || txt.includes(targetClean)) {
            matchedIndex = i;
            break;
          }
        }
      }

      if (matchedIndex !== -1) {
        element.selectedIndex = matchedIndex;
        try {
          element.value = element.options[matchedIndex].value;
        } catch (e) { }
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.dispatchEvent(new Event("blur", { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function highlightField(element) {
    if (!element) return;
    element.classList.add("ai-prefilled-field");
    element.style.transition = "background-color 0.4s ease, border-color 0.4s ease";
    element.style.backgroundColor = "#ecfdf5";
    element.style.borderColor = "#10b981";

    setTimeout(() => {
      element.style.backgroundColor = "";
      element.style.borderColor = "";
    }, 2500);
  }

  /**
   * Pre-fills the page form fields following the exact instruction rules.
   */
  function fillFormFields(data) {
    if (!data) return { filledCount: 0 };
    if (data.isRestricted || String(data.businessType || "").toLowerCase() === "restricted site") {
      return { filledCount: 0 };
    }
    const elements = detectFormElements();
    let filledCount = 0;

    // CRITICAL QC RULE: "Notworking means all empty"
    // When Website Status is "Not Working", select "Not Working" and clear/leave empty ALL other fields!
    if (data.websiteStatus === "Not Working") {
      if (elements.websiteStatus) {
        if (setSelectValue(elements.websiteStatus, "Not Working")) {
          highlightField(elements.websiteStatus);
          filledCount++;
        }
      }

      // Clear all other fields
      for (const [key, el] of Object.entries(elements)) {
        if (!el || key === "websiteUrl" || key === "websiteStatus") continue;
        if (el.tagName && el.tagName.toLowerCase() === "select") {
          el.selectedIndex = 0;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          setInputValue(el, "");
        }
        el.classList.remove("ai-prefilled-field");
      }

      return { filledCount };
    }

    // 1. Website Status
    if (elements.websiteStatus && data.websiteStatus) {
      if (setSelectValue(elements.websiteStatus, data.websiteStatus)) {
        highlightField(elements.websiteStatus);
        filledCount++;
      }
    }

    // 2. Business Type
    if (elements.businessType && data.businessType) {
      if (setSelectValue(elements.businessType, data.businessType)) {
        highlightField(elements.businessType);
        filledCount++;
      }
    }

    // 3. Company Profile
    if (elements.companyProfile && data.companyProfile) {
      if (setSelectValue(elements.companyProfile, data.companyProfile)) {
        highlightField(elements.companyProfile);
        filledCount++;
      }
    }

    // 4. Company Name
    if (elements.companyName && data.companyName) {
      if (setInputValue(elements.companyName, data.companyName)) {
        highlightField(elements.companyName);
        filledCount++;
      }
    }

    // 5. Country Name
    if (elements.countryName && data.countryName) {
      if (setInputValue(elements.countryName, data.countryName)) {
        highlightField(elements.countryName);
        filledCount++;
      }
    }

    // 6. Company Address (Ensure comma before state, and address ending must not have comma or point)
    if (elements.companyAddress && data.companyAddress) {
      let cleanAddress = String(data.companyAddress).replace(/[,;.\s\-_/\\|]+$/g, "").trim();
      cleanAddress = cleanAddress.replace(/\s+,/g, ",").replace(/,\s*,/g, ", ").replace(/,\s*/g, ", ");
      if (setInputValue(elements.companyAddress, cleanAddress)) {
        highlightField(elements.companyAddress);
        filledCount++;
      }
    }

    // 7. State
    if (elements.state && data.state) {
      if (setSelectValue(elements.state, data.state)) {
        highlightField(elements.state);
        filledCount++;
      }
    }

    // 8. City
    if (elements.city && data.city) {
      if (setSelectValue(elements.city, data.city)) {
        highlightField(elements.city);
        filledCount++;
      }
    }

    // 9. Email ID
    if (elements.emailId && data.emailId) {
      if (setInputValue(elements.emailId, data.emailId)) {
        highlightField(elements.emailId);
        filledCount++;
      }
    }

    // 10. Secondary Email ID
    if (elements.secondaryEmailId) {
      setInputValue(elements.secondaryEmailId, data.secondaryEmailId || "");
      if (data.secondaryEmailId) highlightField(elements.secondaryEmailId);
      filledCount++;
    }

    // 11. Phone Number
    if (elements.phoneNumber && data.phoneNumber) {
      if (setInputValue(elements.phoneNumber, data.phoneNumber)) {
        highlightField(elements.phoneNumber);
        filledCount++;
      }
    }

    // 12. Number of Products
    if (elements.numberOfProducts && data.numberOfProducts !== undefined && data.numberOfProducts !== null) {
      if (setSelectValue(elements.numberOfProducts, data.numberOfProducts)) {
        highlightField(elements.numberOfProducts);
        filledCount++;
      }
    }

    // 13. Product Images
    if (elements.productImages && data.productImages !== undefined && data.productImages !== null) {
      if (setSelectValue(elements.productImages, data.productImages)) {
        highlightField(elements.productImages);
        filledCount++;
      }
    }

    // 14. Number of Product Descriptions
    if (elements.numberOfProductDescriptions && data.numberOfProductDescriptions !== undefined && data.numberOfProductDescriptions !== null) {
      if (setSelectValue(elements.numberOfProductDescriptions, data.numberOfProductDescriptions)) {
        highlightField(elements.numberOfProductDescriptions);
        filledCount++;
      }
    }

    return { filledCount };
  }

  function clearFilledFields() {
    const elements = detectFormElements();
    for (const [key, el] of Object.entries(elements)) {
      if (!el || key === "websiteUrl") continue;
      if (el.tagName && el.tagName.toLowerCase() === "select") {
        el.selectedIndex = 0;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        setInputValue(el, "");
      }
      el.classList.remove("ai-prefilled-field");
    }
    updateStatus("Form fields reset.", "idle");
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

  async function triggerCrawlAndFill() {
    if (!isExtensionAlive()) {
      showReloadBanner();
      updateStatus("Please refresh page (F5) to reconnect", "warning");
      return;
    }

    const targetUrl = getTargetUrl();
    if (!targetUrl) {
      updateStatus("⚠️ Website Name URL not found. Please enter a URL.", "error");
      return;
    }

    lastProcessedUrl = targetUrl;
    updateStatus(`Crawling ${targetUrl} (Contact Page / Footer address)...`, "loading");

    const crawlBtn = document.getElementById("ai-crawl-btn");
    const quickBtn = document.getElementById("ai-quick-btn");
    if (crawlBtn) crawlBtn.disabled = true;
    if (quickBtn) {
      quickBtn.disabled = true;
      quickBtn.innerHTML = "⏳ Crawling...";
    }

    try {
      const response = await sendRuntimeMessage({ action: "CRAWL_AND_EXTRACT", url: targetUrl });

      if (crawlBtn) crawlBtn.disabled = false;
      if (quickBtn) {
        quickBtn.disabled = false;
        quickBtn.innerHTML = "🤖 AI Crawl & Fill";
      }

      if (!response || !response.success) {
        const errorMsg = response?.error || "Unable to fetch or crawl website";
        updateStatus(`❌ Crawl Error: ${errorMsg}`, "error");
        const previewSection = document.getElementById("ai-preview-section");
        if (previewSection) previewSection.style.display = "none";
        return;
      }

      const data = response.data;
      cachedExtractedData = data;

      // STRICT QC: If restricted site, show proper error message and DO NOT fill anything!
      if (data && (data.isRestricted || String(data.businessType || "").toLowerCase() === "restricted site")) {
        const reason = data.restrictedReason || "Prohibited Category Detected";
        updateStatus(`⛔ Restricted Site: ${reason}. Form was not modified.`, "error");
        const previewSection = document.getElementById("ai-preview-section");
        if (previewSection) previewSection.style.display = "none";
        return;
      }

      renderPreview(data);
      const fillReport = fillFormFields(data);
      if (data.websiteStatus === "Not Working") {
        const msg = data.isShopCartSite
          ? `⚠️ Online Purchase / Shopping Cart detected (${data.shopCartReason || "Shopping Cart"}). Website Status set to Not Working (all other fields cleared).`
          : `⚠️ Website Status set to Not Working (all other fields left empty).`;
        updateStatus(msg, "warning");
      } else {
        updateStatus(`✅ Success! Pre-filled ${fillReport.filledCount} fields (${data._note || "Gemini AI"}).`, "success");
      }
    } catch (err) {
      if (crawlBtn) crawlBtn.disabled = false;
      if (quickBtn) {
        quickBtn.disabled = false;
        quickBtn.innerHTML = "🤖 AI Crawl & Fill";
      }
      if (err.message && err.message.includes("Extension context invalidated")) {
        showReloadBanner();
        updateStatus("Please refresh page (F5)", "warning");
      } else {
        updateStatus(`❌ Crawl Error: ${err.message}. Form was not modified.`, "error");
      }
    }
  }

  function createFloatingWidget() {
    if (document.getElementById("ai-prefill-widget")) return;

    const widget = document.createElement("div");
    widget.id = "ai-prefill-widget";

    widget.innerHTML = `
      <div id="ai-prefill-header">
        <div class="ai-header-title">
          <span class="ai-icon-sparkle">✨</span>
          <span>AI Data Entry Assistant</span>
        </div>
        <div class="ai-header-controls">
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

        <div class="ai-secondary-actions">
          <button class="ai-btn-secondary" id="ai-fill-cached-btn" title="Re-apply prefilled values">Fill Form</button>
          <button class="ai-btn-secondary" id="ai-clear-btn" title="Clear highlighted fields">Reset Form</button>
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
      minBtn.addEventListener("click", () => {
        if (bodyEl.style.display === "none") {
          bodyEl.style.display = "block";
          minBtn.textContent = "−";
        } else {
          bodyEl.style.display = "none";
          minBtn.textContent = "+";
        }
      });
    }

    const crawlBtn = document.getElementById("ai-crawl-btn");
    if (crawlBtn) crawlBtn.addEventListener("click", triggerCrawlAndFill);

    const fillCachedBtn = document.getElementById("ai-fill-cached-btn");
    if (fillCachedBtn) {
      fillCachedBtn.addEventListener("click", () => {
        if (cachedExtractedData) {
          if (cachedExtractedData.isRestricted || String(cachedExtractedData.businessType || "").toLowerCase() === "restricted site") {
            const reason = cachedExtractedData.restrictedReason || "Prohibited Category Detected";
            updateStatus(`⛔ Restricted Site: ${reason}. This website is restricted and cannot be filled.`, "error");
            return;
          }
          fillFormFields(cachedExtractedData);
          updateStatus("Pre-filled form with extracted data.", "success");
        } else {
          triggerCrawlAndFill();
        }
      });
    }

    const clearBtn = document.getElementById("ai-clear-btn");
    if (clearBtn) clearBtn.addEventListener("click", clearFilledFields);


  }

  function injectInlineQuickButton() {
    if (document.getElementById("ai-quick-btn")) return;

    // Look for btnClickHere or text "click here"
    const clickHereBtn = document.getElementById("btnClickHere") ||
      Array.from(document.querySelectorAll("button, a, input[type=button]")).find(b => (b.textContent || b.value || "").toLowerCase().includes("click here"));

    if (clickHereBtn && clickHereBtn.parentNode) {
      const quickBtn = document.createElement("button");
      quickBtn.id = "ai-quick-btn";
      quickBtn.type = "button";
      quickBtn.innerHTML = "🤖 AI Crawl & Fill";
      quickBtn.style.cssText = `
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        border: none;
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        margin-left: 8px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        vertical-align: middle;
        box-shadow: 0 2px 6px rgba(16, 185, 129, 0.35);
        transition: transform 0.15s ease, background 0.2s ease;
      `;

      quickBtn.addEventListener("mouseenter", () => {
        quickBtn.style.transform = "scale(1.03)";
      });
      quickBtn.addEventListener("mouseleave", () => {
        quickBtn.style.transform = "scale(1)";
      });

      quickBtn.addEventListener("click", (e) => {
        e.preventDefault();
        triggerCrawlAndFill();
      });

      // Also trigger AI Pre-fill when user clicks the native "click here" button!
      clickHereBtn.addEventListener("click", () => {
        setTimeout(() => {
          triggerCrawlAndFill();
        }, 120);
      });

      clickHereBtn.parentNode.insertBefore(quickBtn, clickHereBtn.nextSibling);
    }
  }

  function updateDetectedUrlDisplay() {
    const urlDisplay = document.getElementById("ai-current-target-url");
    const tag = document.getElementById("ai-detected-tag");
    const currentUrl = getTargetUrl();

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

    const websiteInput = findWebsiteNameInput();
    if (websiteInput) {
      const observer = new MutationObserver(() => {
        updateDetectedUrlDisplay();
      });
      observer.observe(websiteInput, { attributes: true, attributeFilter: ["value"] });
    }

    setInterval(() => {
      updateDetectedUrlDisplay();
    }, 1500);
  }

  let debounceTimer = null;
  function debounce(fn, delay) {
    return function (...args) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fn.apply(this, args), delay);
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

    const items = [
      { key: "Status", val: data.isShopCartSite ? `${data.websiteStatus} (Purchase / Cart detected)` : data.websiteStatus },
      { key: "Business Type", val: data.businessType },
      { key: "Company Profile", val: data.companyProfile },
      { key: "Company Name", val: data.companyName },
      { key: "Country", val: data.countryName },
      { key: "Address", val: data.companyAddress },
      { key: "State", val: data.state },
      { key: "City", val: data.city },
      { key: "Email", val: data.emailId },
      { key: "Secondary Email", val: data.secondaryEmailId || "(None)" },
      { key: "Phone", val: data.phoneNumber },
      { key: "No. Products", val: data.numberOfProducts },
      { key: "Product Images", val: data.productImages },
      { key: "Product Descs", val: data.numberOfProductDescriptions }
    ];

    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "ai-preview-row";
      row.innerHTML = `
        <span class="ai-preview-key">${item.key}:</span>
        <span class="ai-preview-val" title="${item.val || ''}">${item.val || '-'}</span>
      `;
      previewList.appendChild(row);
    });
  }

})();
