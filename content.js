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

  // Proactively wakes up service worker if idle
  function ensureServiceWorkerAwake() {
    return new Promise((resolve) => {
      if (!isExtensionAlive()) return resolve(false);
      try {
        chrome.runtime.sendMessage({ action: "PING" }, (res) => {
          if (chrome.runtime.lastError) {
            setTimeout(() => resolve(true), 250);
          } else {
            resolve(true);
          }
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  // Resilient, non-looping message sender for MV3 service worker
  function sendRuntimeMessage(message) {
    return new Promise(async (resolve) => {
      if (!isExtensionAlive()) {
        showReloadBanner();
        return resolve({ success: false, error: "Extension context invalidated. Please refresh this page (F5).", isExtensionError: true });
      }

      await ensureServiceWorkerAwake();

      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            const err = chrome.runtime.lastError.message || "Unknown error";
            if (err.includes("Extension context invalidated")) {
              showReloadBanner();
            }
            return resolve({ success: false, error: err, isExtensionError: true });
          }
          resolve(response);
        });
      } catch (err) {
        if (err.message && err.message.includes("Extension context invalidated")) {
          showReloadBanner();
        }
        resolve({ success: false, error: err.message, isExtensionError: true });
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

  let showFloatingWidget = true;
  let showInlineBtn = true;
  let autoQueueEnabled = true;
  let autoSubmitNotWorkingEnabled = false; // Default OFF so user can study Not Working sites
  let pendingAutoSubmitTimer = null;
  let currentNotWorkingData = null;
  let isAutoQueuePipelineActive = false;
  let autoQueuePollTimer = null;
  let isBatchNotWorkingActive = false;
  let batchNotWorkingRemaining = 0; // -1 for ALL, or positive count like 10

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({ showFloatingWidget: true, showInlineBtn: true, autoQueueEnabled: true, autoSubmitNotWorkingEnabled: false }, (res) => {
      if (res) {
        showFloatingWidget = res.showFloatingWidget !== false;
        showInlineBtn = res.showInlineBtn !== false;
        if (res.autoQueueEnabled !== undefined) {
          autoQueueEnabled = !!res.autoQueueEnabled;
        }
        if (typeof res.autoSubmitNotWorkingEnabled === "boolean") {
          autoSubmitNotWorkingEnabled = res.autoSubmitNotWorkingEnabled;
        }
      }
      const widgetToggle = document.getElementById("ai-widget-auto-queue-toggle");
      if (widgetToggle) widgetToggle.checked = autoQueueEnabled;
      const notWorkingToggle = document.getElementById("ai-auto-submit-notworking-toggle");
      if (notWorkingToggle) notWorkingToggle.checked = autoSubmitNotWorkingEnabled;
      ensureAiCrawlButtonsVisible();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync") {
        if (changes.showFloatingWidget) {
          showFloatingWidget = changes.showFloatingWidget.newValue !== false;
        }
        if (changes.showInlineBtn) {
          showInlineBtn = changes.showInlineBtn.newValue !== false;
        }
        if (changes.autoQueueEnabled !== undefined) {
          autoQueueEnabled = !!changes.autoQueueEnabled.newValue;
          const widgetToggle = document.getElementById("ai-widget-auto-queue-toggle");
          if (widgetToggle) widgetToggle.checked = autoQueueEnabled;
          if (!autoQueueEnabled) {
            stopAutoQueuePipeline("Auto-queue disabled");
          }
        }
        ensureAiCrawlButtonsVisible();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAssistant);
  } else {
    initAssistant();
  }

  function isDataEntryPage() {
    return !!(
      document.getElementById("inputWebsiteName") ||
      document.getElementById("website-name") ||
      document.getElementById("btnLoadNextQueueUrl") ||
      document.getElementById("selectWebsiteStatus") ||
      document.getElementById("website-status") ||
      document.getElementById("btnClickHere") ||
      document.querySelector("input[id*='Website'], select[id*='WebsiteStatus'], [id*='inputWebsite']") ||
      (window.location.href && window.location.href.includes("dataextraction"))
    );
  }

  function initAssistant() {
    if (!isDataEntryPage()) {
      return;
    }
    ensureAiCrawlButtonsVisible();
    attachFieldObservers();

    // Fast retries to catch dynamic / async / SPA form loads immediately
    const checkDelays = [80, 250, 500, 900, 1500, 2500, 4000];
    checkDelays.forEach((delay) => {
      setTimeout(ensureAiCrawlButtonsVisible, delay);
    });

    // Continuous heartbeat every 1500ms to guarantee floating widget and buttons are always visible
    setInterval(ensureAiCrawlButtonsVisible, 1500);

    // Check if auto-queue or batch Not Working pipeline was active across page reloads/navigations
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["batchNotWorking", "autoQueuePipeline"], (res) => {
        const batch = res?.batchNotWorking;
        // Resume if batch was active within the last 5 minutes
        if (batch && batch.active && (batch.remaining > 0 || batch.remaining === -1) && (Date.now() - (batch.updatedAt || 0) < 300000)) {
          isBatchNotWorkingActive = true;
          batchNotWorkingRemaining = batch.remaining;
          isAutoQueuePipelineActive = false;
          updateBatchButtonsState();
          console.log(`[AI Assistant] Resumed Batch Not Working from storage: ${batchNotWorkingRemaining} items left.`);
          updateStatus(`⚡ Resuming Batch Not Working (${batchNotWorkingRemaining === -1 ? "ALL" : batchNotWorkingRemaining + " left"})...`, "loading");

          // Give dynamic fields a moment to settle before processing next item
          setTimeout(() => {
            if (isBatchNotWorkingActive) {
              processNextBatchNotWorkingItem();
            }
          }, 700);
          return;
        } else if (batch) {
          chrome.storage.local.remove(["batchNotWorking"]);
        }

        // Resume "Auto-crawl till Working site" pipeline across page reloads
        const autoPipeline = res?.autoQueuePipeline;
        if (autoPipeline && autoPipeline.active && autoQueueEnabled && (Date.now() - (autoPipeline.updatedAt || 0) < 180000)) {
          isAutoQueuePipelineActive = true;
          const pauseBtn = document.getElementById("ai-pause-pipeline-btn");
          if (pauseBtn) pauseBtn.style.display = "inline-flex";
          console.log(`[AI Assistant] Resumed Auto-Queue Pipeline from storage. Last submitted: "${autoPipeline.lastSubmittedUrl}"`);
          updateStatus("⚡ Auto-Queue: Advancing to next site...", "loading");

          setTimeout(() => {
            if (isAutoQueuePipelineActive && autoQueueEnabled && !isBatchNotWorkingActive) {
              scheduleNextQueueAutoCrawl(autoPipeline.lastSubmittedUrl);
            }
          }, 450);
        } else if (autoPipeline) {
          chrome.storage.local.remove(["autoQueuePipeline"]);
        }
      });
    }

    setTimeout(() => {
      const initialUrl = getTargetUrl();
      if (initialUrl) {
        updateDetectedUrlDisplay();
        console.log("Detected Website Name URL on load:", initialUrl);
      }
    }, 500);
  }

  function ensureAiCrawlButtonsVisible() {
    if (showFloatingWidget !== false) {
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

    if (showInlineBtn !== false) {
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
    elements.websiteStatus = document.getElementById("selectWebsiteStatus") ||
      document.getElementById("website-status") ||
      document.querySelector("select[name*='status']") ||
      document.querySelector("select[id*='status']") ||
      document.querySelector("select[name*='website_status']");

    if (!elements.websiteStatus) {
      const allSelects = Array.from(document.querySelectorAll("select"));
      elements.websiteStatus = allSelects.find(s =>
        Array.from(s.options).some(o => (o.text || o.value || "").trim().toLowerCase() === "not working")
      ) || allSelects.find(s => {
        const firstOpt = (s.options[0]?.text || "").toLowerCase().trim();
        return firstOpt.includes("website status") || getElementContext(s).includes("website status");
      }) || allSelects[0];
    }
    elements.businessType = document.getElementById("selectBusinessType") || document.getElementById("business-type");
    elements.companyProfile = document.getElementById("selectCompanyProfile") || document.getElementById("company-profile");
    elements.companyName = document.getElementById("inputCompanyName") || document.getElementById("company-name");
    elements.companyAddress = document.getElementById("inputCompanyAddress") || document.getElementById("company-address");
    elements.countryName = document.getElementById("inputCountry") || document.getElementById("country-name");
    elements.state = document.getElementById("selectState") || document.getElementById("state");
    elements.city = document.getElementById("selectCity") || document.getElementById("city");
    elements.emailId = document.getElementById("inputEmail") || document.getElementById("email-id") || document.getElementById("email") || document.getElementById("primaryEmail");
    elements.secondaryEmailId = document.getElementById("inputSecondaryEmail") || document.getElementById("secondary-email-id") || document.getElementById("secondaryEmail") || document.getElementById("secondary_email") || document.getElementById("altEmail") || document.getElementById("alternateEmail");
    elements.phoneNumber = document.getElementById("inputPhone") ||
      document.getElementById("phone-number") ||
      document.getElementById("phone") ||
      document.getElementById("phoneNumber") ||
      document.getElementById("inputPhoneNumber") ||
      document.getElementById("telephone") ||
      document.getElementById("inputTelephone") ||
      document.querySelector('input[type="tel"]') ||
      document.querySelector('input[name="phoneNumber"]') ||
      document.querySelector('input[name="phone"]') ||
      document.querySelector('input[name="inputPhone"]') ||
      document.querySelector('input[name="telephone"]');
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
        const ctx = getElementContext(inp);
        return ctx.includes("phone") || ctx.includes("mobile") || ctx.includes("tel") || (inp.placeholder || "").toLowerCase().includes("phone") || inp.type === "tel";
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

    const isZero = targetClean === "0" || targetClean === "zero";
    const isOne = targetClean === "one" || targetClean === "1";
    const isTwo = targetClean === "two" || targetClean === "2";
    const isThree = targetClean === "three" || targetClean === "3";
    const isAvailable = targetClean === "available";
    const isNotAvailable = targetClean === "not available";

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

      // 1b. Redirect Site alias matching (supports "Redirect Site", "Redirect", etc.)
      if (matchedIndex === -1 && targetClean.includes("redirect")) {
        for (let i = 0; i < element.options.length; i++) {
          const opt = element.options[i];
          const val = (opt.value || "").trim().toLowerCase();
          const txt = (opt.text || "").trim().toLowerCase();
          if (val === "redirect site" || txt === "redirect site" || val === "redirect" || txt === "redirect" || txt.includes("redirect") || val.includes("redirect")) {
            matchedIndex = i;
            break;
          }
        }
      }

      // 2. Symbolic & Numeric mapping (Supports 0, 1, 2, 3 options as in https://kishorekumar1993.github.io/dataextraction/)
      if (matchedIndex === -1) {
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
          } else if (isNotAvailable) {
            if (val.includes("not available") || txt.includes("not available") || (txt.includes("not") && txt.includes("avail"))) {
              matchedIndex = i;
              break;
            }
          } else if (val.includes(targetClean) || txt.includes(targetClean)) {
            matchedIndex = i;
            break;
          }
        }
      }

      // 4. Country alias fallbacks (Czechia <-> Czech Republic, Turkiye <-> Turkey, NZ <-> New Zealand, etc.)
      if (matchedIndex === -1) {
        if (targetClean === "czechia" || targetClean === "czech republic" || targetClean === "czech") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "czechia" || txt === "czechia" || val === "czech republic" || txt === "czech republic" || val === "ceska republika" || txt === "ceska republika" || val === "česká republika" || txt === "česká republika" || val === "czech" || txt === "czech") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "eswatini" || targetClean === "swaziland") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "eswatini" || txt === "eswatini" || val === "swaziland" || txt === "swaziland") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "myanmar" || targetClean === "burma") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "myanmar" || txt === "myanmar" || val === "burma" || txt === "burma") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "north macedonia" || targetClean === "macedonia") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "north macedonia" || txt === "north macedonia" || val === "macedonia" || txt === "macedonia" || val === "fyrom" || txt === "fyrom") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "netherlands" || targetClean === "holland") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "netherlands" || txt === "netherlands" || val === "holland" || txt === "holland" || val === "the netherlands" || txt === "the netherlands") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "cote d'ivoire" || targetClean === "côte d'ivoire" || targetClean === "ivory coast") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val.includes("cote d'ivoire") || txt.includes("cote d'ivoire") || val.includes("côte d'ivoire") || txt.includes("côte d'ivoire") || val.includes("ivory coast") || txt.includes("ivory coast")) {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "timor-leste" || targetClean === "east timor") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "timor-leste" || txt === "timor-leste" || val === "east timor" || txt === "east timor") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "cabo verde" || targetClean === "cape verde") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "cabo verde" || txt === "cabo verde" || val === "cape verde" || txt === "cape verde") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "vietnam" || targetClean === "viet nam") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "vietnam" || txt === "vietnam" || val === "viet nam" || txt === "viet nam") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "south korea" || targetClean === "korea") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "south korea" || txt === "south korea" || val.includes("republic of korea") || txt.includes("republic of korea") || val === "korea, republic of" || txt === "korea, republic of" || val === "korea" || txt === "korea") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "turkiye" || targetClean === "türkiye") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "turkey" || txt === "turkey" || val === "turkiye" || txt === "turkiye" || val === "türkiye" || txt === "türkiye") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "turkey") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "turkiye" || txt === "turkiye" || val === "türkiye" || txt === "türkiye") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "new zealand") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "nz" || txt === "nz" || val === "nzl" || txt === "nzl" || val === "new zealand" || txt === "new zealand" || val.includes("new zealand") || txt.includes("new zealand")) {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "malaysia") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "my" || txt === "my" || val === "mys" || txt === "mys" || val === "malaysia" || txt === "malaysia" || val.includes("malaysia") || txt.includes("malaysia")) {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "indonesia") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "id" || txt === "id" || val === "idn" || txt === "idn" || val === "indonesia" || txt === "indonesia" || val.includes("indonesia") || txt.includes("indonesia") || val.includes("republik indonesia") || txt.includes("republik indonesia")) {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "united states of america" || targetClean === "united states") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "usa" || txt === "usa" || val === "us" || txt === "us" || val === "united states" || txt === "united states" || val === "united states of america" || txt === "united states of america") {
              matchedIndex = i;
              break;
            }
          }
        } else if (targetClean === "united kingdom" || targetClean === "uk" || targetClean === "great britain") {
          // Pass 1: exact match for United Kingdom, UK, or Great Britain
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "united kingdom" || txt === "united kingdom" || val === "uk" || txt === "uk" || val === "great britain" || txt === "great britain") {
              matchedIndex = i;
              break;
            }
          }
          // Pass 2: fall back to England only if United Kingdom is not in the dropdown
          if (matchedIndex === -1) {
            for (let i = 0; i < element.options.length; i++) {
              const opt = element.options[i];
              const val = (opt.value || "").trim().toLowerCase();
              const txt = (opt.text || "").trim().toLowerCase();
              if (val === "england" || txt === "england") {
                matchedIndex = i;
                break;
              }
            }
          }
        } else if (targetClean === "england" || targetClean === "scotland" || targetClean === "wales" || targetClean === "northern ireland") {
          // Pass 1: exact match for specific constituent country (England, Scotland, Wales, Northern Ireland)
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === targetClean || txt === targetClean) {
              matchedIndex = i;
              break;
            }
          }
          // Pass 2: fall back to United Kingdom only if specific constituent is not in the dropdown
          if (matchedIndex === -1) {
            for (let i = 0; i < element.options.length; i++) {
              const opt = element.options[i];
              const val = (opt.value || "").trim().toLowerCase();
              const txt = (opt.text || "").trim().toLowerCase();
              if (val === "united kingdom" || txt === "united kingdom" || val === "uk" || txt === "uk" || val === "great britain" || txt === "great britain") {
                matchedIndex = i;
                break;
              }
            }
          }
        } else if (targetClean === "distributer" || targetClean === "distributor") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "distributer" || txt === "distributer" || val === "distributor" || txt === "distributor") {
              matchedIndex = i;
              break;
            }
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

  // =========================================================================
  // BATCH NOT WORKING PIPELINE (Separate options requested by user)
  // =========================================================================

  function triggerFromQueue() {
    const fromQueueBtn = document.getElementById("btnLoadNextQueueUrl") ||
      document.getElementById("btnNextQueue") ||
      document.getElementById("loadNext") ||
      document.getElementById("nextRecord") ||
      Array.from(document.querySelectorAll("button, a, input[type=button]")).find(b => {
        if (b.closest("#ai-prefill-widget")) return false;
        const t = (b.textContent || b.value || "").trim().toLowerCase();
        return t.includes("from queue") || t.includes("load next") || t.includes("next url") || t.includes("next record") || t === "next" || t.includes("get url");
      });
    if (fromQueueBtn) {
      console.log("[AI Assistant] Triggering 'From Queue' / Next Record button:", fromQueueBtn);
      fromQueueBtn.click();
      return true;
    }
    return false;
  }

  function startBatchNotWorking(count = 10) {
    if (isBatchNotWorkingActive) {
      stopBatchNotWorking("Batch stopped by user.");
      return;
    }

    isBatchNotWorkingActive = true;
    batchNotWorkingRemaining = count;
    isAutoQueuePipelineActive = false; // separate pipeline

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        batchNotWorking: {
          active: true,
          remaining: count,
          updatedAt: Date.now()
        }
      });
    }

    const label = count === -1 ? "ALL" : count;
    console.log(`[AI Assistant] Starting Batch Not Working for ${label} sites...`);
    updateStatus(`🚀 Auto-Submitting ${label} queue sites as Not Working...`, "loading");
    updateBatchButtonsState();

    processNextBatchNotWorkingItem();
  }

  function stopBatchNotWorking(msg = "") {
    isBatchNotWorkingActive = false;
    batchNotWorkingRemaining = 0;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(["batchNotWorking"]);
    }
    updateBatchButtonsState();
    updateStatus(msg || "Batch Not Working stopped.", "idle");
  }

  function updateBatchButtonsState() {
    const b10 = document.getElementById("ai-batch-10-btn");
    const bAll = document.getElementById("ai-batch-all-btn");

    if (b10) {
      if (isBatchNotWorkingActive && batchNotWorkingRemaining > 0) {
        b10.textContent = `⏹️ Stop (${batchNotWorkingRemaining} left)`;
        b10.style.backgroundColor = "#dc2626";
        b10.style.color = "#ffffff";
      } else {
        b10.textContent = "⚡ Auto 10 Not Working";
        b10.style.backgroundColor = "";
        b10.style.color = "#b91c1c";
      }
    }
    if (bAll) {
      if (isBatchNotWorkingActive && batchNotWorkingRemaining === -1) {
        bAll.textContent = "⏹️ Stop Submitting ALL";
        bAll.style.backgroundColor = "#dc2626";
        bAll.style.color = "#ffffff";
      } else {
        bAll.textContent = "⚡ Submit ALL Not Working";
        bAll.style.backgroundColor = "";
        bAll.style.color = "#7f1d1d";
      }
    }
  }

  function processNextBatchNotWorkingItem() {
    if (!isBatchNotWorkingActive) return;

    if (batchNotWorkingRemaining !== -1 && batchNotWorkingRemaining <= 0) {
      stopBatchNotWorking("🎉 Successfully auto-submitted 10 sites as Not Working!");
      return;
    }

    let currentUrl = getTargetUrl();
    if (!currentUrl) {
      triggerFromQueue();
      currentUrl = getTargetUrl();
    }

    const normSubmitted = (currentUrl || `item-${Date.now()}`).trim().toLowerCase().replace(/\/+$/, "");
    const remainingText = batchNotWorkingRemaining === -1 ? "ALL" : `${batchNotWorkingRemaining} left`;
    updateStatus(`⚡ Batch Not Working [${remainingText}]: Submitting ${currentUrl || "queue item"}...`, "loading");

    // Pre-fill as Not Working and submit
    const notWorkingData = {
      websiteStatus: "Not Working",
      businessType: "",
      companyProfile: "",
      companyName: "",
      countryName: "",
      companyAddress: "",
      state: "",
      city: "",
      emailId: "",
      secondaryEmailId: "",
      phoneNumber: "",
      numberOfProducts: "",
      productImages: "",
      numberOfProductDescriptions: "",
      _note: "Batch Auto-Submit as Not Working"
    };

    fillFormFields(notWorkingData);

    const nextRemaining = batchNotWorkingRemaining > 0 ? batchNotWorkingRemaining - 1 : -1;
    batchNotWorkingRemaining = nextRemaining;
    updateBatchButtonsState();

    if (nextRemaining === 0) {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(["batchNotWorking"]);
      }
      setTimeout(() => {
        stopBatchNotWorking("🎉 Successfully auto-submitted 10 sites as Not Working!");
      }, 1500);
      return;
    }

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        batchNotWorking: {
          active: true,
          remaining: nextRemaining,
          updatedAt: Date.now()
        }
      });
    }

    // Wait for submission, advance queue, and process next item (for SPA / AJAX portals)
    setTimeout(() => {
      if (!isBatchNotWorkingActive) return;

      let pollAttempts = 0;
      const pollTimer = setInterval(() => {
        pollAttempts++;
        if (!isBatchNotWorkingActive) {
          clearInterval(pollTimer);
          return;
        }

        let nextUrl = getTargetUrl();
        if (!nextUrl && pollAttempts % 3 === 0) {
          triggerFromQueue();
          nextUrl = getTargetUrl();
        }

        const normNext = (nextUrl || "").trim().toLowerCase().replace(/\/+$/, "");
        if (normNext && normNext !== normSubmitted && normNext.length > 3) {
          clearInterval(pollTimer);
          setTimeout(() => {
            if (isBatchNotWorkingActive) {
              processNextBatchNotWorkingItem();
            }
          }, 350);
          return;
        }

        if (pollAttempts >= 30) { // ~5 seconds max per item
          clearInterval(pollTimer);
          if (isBatchNotWorkingActive) {
            triggerFromQueue();
            setTimeout(() => {
              if (isBatchNotWorkingActive) {
                processNextBatchNotWorkingItem();
              }
            }, 350);
          }
        }
      }, 160);
    }, 500);
  }

  function markAndSubmitCurrentAsNotWorking(reason = "Manual 1-click Not Working") {
    const currentUrl = getTargetUrl();
    const notWorkingData = {
      websiteStatus: "Not Working",
      businessType: "",
      companyProfile: "",
      companyName: "",
      countryName: "",
      companyAddress: "",
      state: "",
      city: "",
      emailId: "",
      secondaryEmailId: "",
      phoneNumber: "",
      numberOfProducts: "",
      productImages: "",
      numberOfProductDescriptions: "",
      _note: reason
    };
    fillFormFields(notWorkingData);
    renderPreview(notWorkingData);
    updateStatus(`🚫 Marked as Not Working (${reason}) - Submitting...`, "warning");
  }

  function stopAutoQueuePipeline(reason = "") {
    isAutoQueuePipelineActive = false;
    if (autoQueuePollTimer) {
      clearInterval(autoQueuePollTimer);
      autoQueuePollTimer = null;
    }
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(["autoQueuePipeline"]);
    }
    const pauseBtn = document.getElementById("ai-pause-pipeline-btn");
    if (pauseBtn) pauseBtn.style.display = "none";
    console.log("[AI Assistant] Auto-queue pipeline stopped" + (reason ? `: ${reason}` : "."));
  }

  function scheduleNextQueueAutoCrawl(submittedUrl) {
    if (isBatchNotWorkingActive) {
      console.log("[AI Assistant] Batch Not Working is active; skipping normal auto-crawl scheduling.");
      return;
    }

    if (autoQueuePollTimer) {
      clearInterval(autoQueuePollTimer);
      autoQueuePollTimer = null;
    }

    if (!autoQueueEnabled) {
      console.log("[AI Assistant] Auto-queue advance is disabled in settings.");
      stopAutoQueuePipeline("Feature disabled in settings");
      return;
    }

    isAutoQueuePipelineActive = true;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        autoQueuePipeline: {
          active: true,
          lastSubmittedUrl: submittedUrl || "",
          updatedAt: Date.now()
        }
      });
    }
    const pauseBtn = document.getElementById("ai-pause-pipeline-btn");
    if (pauseBtn) pauseBtn.style.display = "inline-flex";

    let attempts = 0;
    const maxAttempts = 60; // 60 * 150ms = 9 seconds
    const normSubmitted = (submittedUrl || "").trim().toLowerCase().replace(/\/+$/, "");

    console.log(`[AI Assistant] Auto-queue pipeline listening for next record after "${normSubmitted}"...`);
    updateStatus("⏳ Advancing to next queue record...", "loading");

    // Helper to ensure next pending URL is loaded from queue
    const loadNextFromQueue = () => {
      const fromQueueBtn = document.getElementById("btnLoadNextQueueUrl") ||
        Array.from(document.querySelectorAll("button, a")).find(b => (b.textContent || "").toLowerCase().includes("from queue"));
      if (fromQueueBtn) {
        console.log("[AI Assistant] Triggering 'From Queue' to load next pending URL...");
        fromQueueBtn.click();
      }
    };

    // If the input was cleared or in manual URL mode, click 'From Queue' at 350ms
    setTimeout(() => {
      const cur = getTargetUrl();
      if (!cur || cur.trim().toLowerCase().replace(/\/+$/, "") === normSubmitted) {
        loadNextFromQueue();
      }
    }, 350);

    autoQueuePollTimer = setInterval(() => {
      attempts++;
      if (!isAutoQueuePipelineActive || !autoQueueEnabled) {
        clearInterval(autoQueuePollTimer);
        autoQueuePollTimer = null;
        return;
      }

      let nextUrl = getTargetUrl();

      // If still empty after several attempts, trigger 'From Queue'
      if (!nextUrl && attempts % 5 === 0) {
        loadNextFromQueue();
        nextUrl = getTargetUrl();
      }

      const normNext = (nextUrl || "").trim().toLowerCase().replace(/\/+$/, "");

      // Check if a new valid URL has been loaded into the input
      if (normNext && normNext !== normSubmitted && normNext.length > 3) {
        clearInterval(autoQueuePollTimer);
        autoQueuePollTimer = null;
        console.log(`[AI Assistant] Next queue URL detected: ${nextUrl}. Auto-crawling in 350ms...`);
        updateStatus(`⚡ Auto-Queue: Next site detected (${nextUrl}). Crawling...`, "loading");

        setTimeout(() => {
          if (isAutoQueuePipelineActive && autoQueueEnabled && !isBatchNotWorkingActive) {
            triggerCrawlAndFill();
          }
        }, 350);
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(autoQueuePollTimer);
        autoQueuePollTimer = null;
        isAutoQueuePipelineActive = false;
        if (pauseBtn) pauseBtn.style.display = "none";
        console.log("[AI Assistant] Queue advance polling completed.");
        updateStatus("Ready (Queue idle)", "idle");
      }
    }, 150);
  }

  /**
   * Automatically confirms custom confirmation popups/modals and submits the form
   * specifically for "Not Working" status (per instruction: "for notworking autosubmit").
   * For "Working" sites, submission is NEVER automatic so the user can manually review.
   */
  function autoSubmitNotWorking(specificUrl) {
    const submittedUrl = specificUrl || getTargetUrl();
    console.log(`[AI Assistant] Auto-submitting 'Not Working' record for: ${submittedUrl}...`);

    // Ensure pipeline state is preserved across form submission reload!
    if (autoQueueEnabled && !isBatchNotWorkingActive) {
      isAutoQueuePipelineActive = true;
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          autoQueuePipeline: {
            active: true,
            lastSubmittedUrl: submittedUrl || "",
            updatedAt: Date.now()
          }
        });
      }
    }

    let hasClickedSubmit = false;
    let hasConfirmedModal = false;

    // Helper to find the Submit button
    const findSubmitButton = () => {
      return document.getElementById("btnSubmitForm") ||
        document.getElementById("btnSubmit") ||
        document.getElementById("submitForm") ||
        document.getElementById("btn-submit") ||
        document.getElementById("submit") ||
        document.querySelector('button[type="submit"]') ||
        document.querySelector('input[type="submit"]') ||
        document.querySelector('.btn-submit') ||
        document.querySelector('button[name="submit"]') ||
        document.querySelector('input[name="submit"]') ||
        Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).find(b => {
          if (b.closest("#ai-prefill-widget")) return false; // ignore assistant buttons
          const t = (b.textContent || b.value || "").trim().toLowerCase();
          return t === "submit" || (t.includes("submit") && !t.includes("not working") && !t.includes("reset") && !t.includes("cancel"));
        });
    };

    // Helper to find confirmation modal / dialog buttons
    const findModalConfirmButton = () => {
      // SweetAlert / SweetAlert2
      const swalConfirm = document.querySelector(".swal2-confirm, .swal-button--confirm");
      if (swalConfirm && swalConfirm.offsetParent !== null) return swalConfirm;

      // Check visible modals
      const modals = Array.from(document.querySelectorAll('.modal, .swal2-container, .swal-overlay, div[role="dialog"], .confirmation-modal, .popup, div[class*="modal"], div[class*="dialog"], div[class*="confirm"], div[class*="alert"]'));
      for (const modal of modals) {
        if (modal.id === "ai-prefill-widget" || modal.closest("#ai-prefill-widget")) continue;
        const text = (modal.textContent || "").toLowerCase();
        if (text.includes("confirmation required") || text.includes("are you sure") || text.includes("not working") || text.includes("confirm")) {
          const buttons = Array.from(modal.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
          const okBtn = buttons.find(b => {
            const bText = (b.textContent || b.value || "").trim().toLowerCase();
            return bText === "ok" || bText === "✓ ok" || bText === "yes" || bText === "confirm" || bText === "proceed" || bText.includes("ok");
          });
          if (okBtn) return okBtn;
        }
      }

      // Check any button with OK / Yes matching confirmation text nearby
      const allBtns = Array.from(document.querySelectorAll('button, input[type="button"]'));
      const okBtn = allBtns.find(b => {
        if (b.closest("#ai-prefill-widget")) return false;
        const bText = (b.textContent || b.value || "").trim().toLowerCase();
        const pText = (b.closest("div")?.parentElement?.textContent || "").toLowerCase();
        return (bText === "ok" || bText === "✓ ok" || bText === "yes") && (pText.includes("are you sure") || pText.includes("not working") || pText.includes("confirmation required"));
      });
      return okBtn || null;
    };

    // Step A: Click Submit button
    const doSubmit = () => {
      if (hasClickedSubmit) return;
      const submitBtn = findSubmitButton();
      if (submitBtn) {
        hasClickedSubmit = true;
        console.log("[AI Assistant] Auto-clicked Submit button for 'Not Working' status:", submitBtn);
        submitBtn.click();
        const form = submitBtn.closest("form") || document.forms[0];
        if (form && typeof form.requestSubmit === "function" && !submitBtn.disabled) {
          try { form.requestSubmit(submitBtn); } catch (e) { }
        }
      }
    };

    // Step B: Continuously poll for modal confirmation buttons for up to 2.5 seconds
    let modalPollCount = 0;
    const modalPollTimer = setInterval(() => {
      modalPollCount++;
      if (hasConfirmedModal || modalPollCount > 40) {
        clearInterval(modalPollTimer);
        return;
      }
      const okBtn = findModalConfirmButton();
      if (okBtn) {
        hasConfirmedModal = true;
        clearInterval(modalPollTimer);
        console.log("[AI Assistant] Auto-confirmed 'Not Working' confirmation modal:", okBtn);
        okBtn.click();
      }
    }, 60);

    // Initial submit attempts
    setTimeout(doSubmit, 120);
    setTimeout(doSubmit, 400);
    setTimeout(doSubmit, 800);

    // Queue progression: ONLY for normal auto-crawl pipeline, NEVER during batch Not Working!
    if (!isBatchNotWorkingActive) {
      scheduleNextQueueAutoCrawl(submittedUrl);
    }
  }

  /**
   * Capitalizes the first letter of every word (Title Case) per instruction: "All words come start with Captial make it"
   * Preserves standard corporate acronyms (USA, UK, PT, CV, SDN BHD, etc.).
   */
  function toTitleCase(str) {
    if (!str || typeof str !== "string") return "";
    const upperAcronyms = new Set([
      "USA", "UK", "UAE", "3D", "CNC", "LED", "OEM", "ODM", "HVAC", "PVC", "PE", "HDPE", "PTFE", "R&D", "AKS",
      "PT", "CV", "UD", "TBK", "RT", "RW", "DKI", "DI", "BMW", "IBM", "B2B", "B2C", "IT", "TP", "QC", "AI", "FRP", "SMT", "PCB", "PCBA",
      "PEM", "FP", "HR", "CRP", "SMC", "THK", "NSK", "NTN", "IKO", "INA", "FAG", "FESTO", "CKD", "ABB", "SKF", "GE", "HP", "LG", "JVC", "TDK", "NEC", "ECU"
    ]);
    let s = str.replace(/['’`]\s*s\b/gi, "'s");
    return s.replace(/[\p{L}\p{N}]+/gu, function (word, offset, fullStr) {
      if (offset > 0 && fullStr[offset - 1] === "'" && word.toLowerCase() === "s") {
        return "s";
      }
      const upper = word.toUpperCase();
      if (upperAcronyms.has(upper)) return upper;
      if (/^GmbH$/i.test(word)) return "GmbH";
      // Preserve 2-4 letter all-caps acronyms when the surrounding string has mixed lowercase characters
      if (word.length >= 2 && word.length <= 4 && word === upper && /[a-z]/.test(fullStr) && !/^(?:AND|THE|FOR|WITH|FROM|INTO|ONTO|UPON|OVER|UNDER|AFTER|ABOUT)$/i.test(word)) {
        return upper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }

  /**
   * Standardizes country names globally with full expanded official names.
   * E.g., "USA"/"United States" -> "United States Of America", "Czechia" -> "Czech Republic",
   * "Turkey/Turkiye" -> "Türkiye", "Deutschland" -> "Germany", "España" -> "Spain", "Hrvatska" -> "Croatia"
   */
  function normalizeCountryName(country) {
    if (!country || typeof country !== "string") return "";
    let c = country.trim().replace(/[\(\)\[\]\{\}]/g, " ").replace(/\s+/g, " ").trim();
    if (c.length < 2) return c;

    const lower = c.toLowerCase();
    const unaccented = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // 1. Czechia -> Czech Republic (#32 in QC Valid List)
    if (/\b(?:czech\s*republic|ceska\s*republika|cesko|czechia)\b/i.test(unaccented) || /^(?:cz|cze|czech(?:ia)?)$/i.test(unaccented)) {
      return "Czech Republic";
    }

    // 2. Turkey / Turkiye -> Türkiye (#124 in QC Valid List & Table)
    if (/\b(?:turkey|turkiye|republic\s*of\s*turkiye|republic\s*of\s*turkey)\b/i.test(unaccented) || /^(?:tr|tur)$/i.test(unaccented)) {
      return "Türkiye";
    }

    // 3. USA / United States -> United States Of America (#129 full expansion)
    if (/^(?:u\.?s\.?a?\.?|united\s*states(?:\s*of\s*america)?|the\s*united\s*states)$/i.test(unaccented) || /\bunited\s*states(?:\s*of\s*america)?\b/i.test(unaccented)) {
      return "United States Of America";
    }

    // 4. People's Republic of China -> China vs Republic of China -> Taiwan
    if (/\b(?:people['’]?s?\s*republic\s*of\s*china|p\.?r\.?c\.?)\b/i.test(unaccented)) {
      return "China";
    }
    if (/taiwan/i.test(unaccented) || /\br\.?o\.?c\.?\b/i.test(unaccented) || /\brepublic\s*of\s*china\b/i.test(unaccented)) {
      return "Taiwan";
    }

    // 5. United Kingdom & Constituent Countries
    // QC Rule: "United Kingdom (England, Wales, Scotland, Northern Ireland). If 'England' and 'United Kingdom' both are mentioned, you must take England as the country name."
    if (/\bengland\b/i.test(unaccented)) return "England";
    if (/\bscotland\b/i.test(unaccented)) return "Scotland";
    if (/(?<!\bnew\s+south\s+)\bwales\b/i.test(unaccented)) return "Wales";
    if (/\bnorthern\s*ireland\b/i.test(unaccented)) return "Northern Ireland";
    if (/^(?:united\s*kingdom|great\s*britain|uk|u\.k\.|britain)$/i.test(unaccented) || /\bunited\s*kingdom\b/i.test(unaccented)) {
      return "United Kingdom";
    }

    // 6. North Korea vs South Korea (#85 & #111 in QC Valid List)
    if (/\b(?:north\s*korea|democratic\s*people['’]?s\s*republic\s*of\s*korea|dprk)\b/i.test(unaccented)) {
      return "North Korea";
    }
    if (/\b(?:south\s*korea|korea,\s*republic\s*of|republic\s*of\s*korea|korea\s*republic|rok)\b/i.test(unaccented) || /^korea$/i.test(unaccented)) {
      return "South Korea";
    }

    // 7. Croatia / Hrvatska
    if (/\b(?:hrvatska|croatia|republic\s*of\s*croatia)\b/i.test(unaccented) || /^(?:hr|hrv)$/i.test(unaccented)) {
      return "Croatia";
    }

    // 8. Kingdom of Bahrain -> Bahrain
    if (/\b(?:kingdom\s*of\s*bahrain|bahrain)\b/i.test(unaccented) || /^(?:bh|bhr)$/i.test(unaccented)) {
      return "Bahrain";
    }

    // 9. Sultanate of Oman -> Oman
    if (/\b(?:sultanate\s*of\s*oman|oman)\b/i.test(unaccented) || /^(?:om|omn)$/i.test(unaccented)) {
      return "Oman";
    }

    // 7. Swaziland -> Eswatini
    if (/\b(?:swaziland|eswatini|kingdom\s*of\s*eswatini)\b/i.test(unaccented)) {
      return "Eswatini";
    }

    // 8. North Macedonia (Macedonia / FYROM)
    if (/\b(?:macedonia|north\s*macedonia|republic\s*of\s*north\s*macedonia|fyrom)\b/i.test(unaccented)) {
      return "North Macedonia";
    }

    // 9. Myanmar (Burma)
    if (/\b(?:burma|myanmar|republic\s*of\s*the\s*union\s*of\s*myanmar)\b/i.test(unaccented)) {
      return "Myanmar";
    }

    // 10. Netherlands (Holland)
    if (/\b(?:netherlands|holland|the\s*netherlands|kingdom\s*of\s*the\s*netherlands)\b/i.test(unaccented)) {
      return "Netherlands";
    }

    // 11. Cote D'Ivoire (Ivory Coast)
    if (/\b(?:ivory\s*coast|cote\s*d['’]ivoire|cote\s*divoire)\b/i.test(unaccented)) {
      return "Cote D'Ivoire";
    }

    // 12. Timor-Leste (East Timor)
    if (/\b(?:east\s*timor|timor[\s-]leste)\b/i.test(unaccented)) {
      return "Timor-Leste";
    }

    // 13. Cabo Verde (Cape Verde)
    if (/\b(?:cape\s*verde|cabo\s*verde)\b/i.test(unaccented)) {
      return "Cabo Verde";
    }

    // 14. Vietnam
    if (/\b(?:viet\s*nam|vietnam|socialist\s*republic\s*of\s*vietnam)\b/i.test(unaccented)) {
      return "Vietnam";
    }

    // 15. Brunei -> Brunei Darussalam
    if (/\b(?:brunei\s*darussalam|brunei)\b/i.test(unaccented)) {
      return "Brunei Darussalam";
    }

    // 16. Syria
    if (/\b(?:syrian\s*arab\s*republic|syria)\b/i.test(unaccented)) {
      return "Syria";
    }

    // 17. Laos
    if (/\b(?:lao\s*people['’]?s\s*democratic\s*republic|laos)\b/i.test(unaccented)) {
      return "Laos";
    }

    // 18. Russia
    if (/\b(?:russian\s*federation|russia)\b/i.test(unaccented)) {
      return "Russia";
    }

    // 19. Iran
    if (/\b(?:islamic\s*republic\s*of\s*iran|iran)\b/i.test(unaccented)) {
      return "Iran";
    }

    // 20. Moldova
    if (/\b(?:republic\s*of\s*moldova|moldova)\b/i.test(unaccented)) {
      return "Moldova";
    }

    // 21. Tanzania
    if (/\b(?:united\s*republic\s*of\s*tanzania|tanzania)\b/i.test(unaccented)) {
      return "Tanzania";
    }

    // 22. Bolivia
    if (/\b(?:plurinational\s*state\s*of\s*bolivia|bolivia)\b/i.test(unaccented)) {
      return "Bolivia";
    }

    // 23. Venezuela
    if (/\b(?:bolivarian\s*republic\s*of\s*venezuela|venezuela)\b/i.test(unaccented)) {
      return "Venezuela";
    }

    // 24. New Zealand
    if (/\b(?:new\s*zealand|aotearoa)\b/i.test(unaccented) || /^(?:nz|nzl)$/i.test(unaccented)) {
      return "New Zealand";
    }

    // 25. Malaysia
    if (/\b(?:malaysia|federation\s*of\s*malaysia|persekutuan\s*malaysia)\b/i.test(unaccented) || /^(?:my|mys)$/i.test(unaccented)) {
      return "Malaysia";
    }

    // 26. Indonesia
    if (/\b(?:indonesia|republik\s*indonesia|republic\s*of\s*indonesia)\b/i.test(unaccented) || /^(?:id|idn|ri)$/i.test(unaccented)) {
      return "Indonesia";
    }

    // 27. South Africa
    if (/\b(?:south\s*africa)\b/i.test(unaccented) || /^(?:za|rsa)$/i.test(unaccented)) {
      return "South Africa";
    }

    // 28. Germany
    if (/\b(?:germany|deutschland)\b/i.test(unaccented) || /^(?:de|deu)$/i.test(unaccented)) {
      return "Germany";
    }

    // 29. Italy
    if (/\b(?:italy|italia)\b/i.test(unaccented) || /^(?:it|ita)$/i.test(unaccented)) {
      return "Italy";
    }

    // 30. Spain
    if (/\b(?:spain|espana)\b/i.test(unaccented) || /^(?:es|esp)$/i.test(unaccented)) {
      return "Spain";
    }

    // 31. Australia
    if (/\b(?:australia)\b/i.test(unaccented) || /^(?:au|aus)$/i.test(unaccented)) {
      return "Australia";
    }

    // 32. Singapore
    if (/\b(?:singapore)\b/i.test(unaccented) || /^(?:sg|sgp)$/i.test(unaccented)) {
      return "Singapore";
    }

    // 33. Thailand
    if (/\b(?:thailand)\b/i.test(unaccented) || /^(?:th|tha)$/i.test(unaccented)) {
      return "Thailand";
    }

    // 34. Canada
    if (/\b(?:canada)\b/i.test(unaccented) || /^(?:ca|can)$/i.test(unaccented)) {
      return "Canada";
    }

    // 35. India
    if (/\b(?:india)\b/i.test(unaccented) || /^(?:in|ind)$/i.test(unaccented)) {
      return "India";
    }

    // 36. France
    if (/\b(?:france)\b/i.test(unaccented) || /^(?:fr|fra)$/i.test(unaccented)) {
      return "France";
    }

    // 37. China
    if (/\b(?:china|people['’]?s\s*republic\s*of\s*china|prc)\b/i.test(unaccented) || /^(?:cn|chn)$/i.test(unaccented)) {
      return "China";
    }

    // 38. Japan
    if (/\b(?:japan|nippon|nihon)\b/i.test(unaccented) || /^(?:jp|jpn)$/i.test(unaccented)) {
      return "Japan";
    }

    // 39. Switzerland
    if (/\b(?:switzerland|schweiz|suisse|svizzera)\b/i.test(unaccented) || /^(?:ch|che)$/i.test(unaccented)) {
      return "Switzerland";
    }

    // 40. Ireland
    if (/\b(?:ireland|republic\s*of\s*ireland|eire)\b/i.test(unaccented) || /^(?:ie|irl)$/i.test(unaccented)) {
      return "Ireland";
    }

    // 41. United Arab Emirates
    if (/\b(?:united\s*arab\s*emirates|uae)\b/i.test(unaccented) || /^(?:ae|are)$/i.test(unaccented)) {
      return "United Arab Emirates";
    }

    // 42. Saudi Arabia
    if (/\b(?:saudi\s*arabia|kingdom\s*of\s*saudi\s*arabia|ksa)\b/i.test(unaccented) || /^(?:sa|sau)$/i.test(unaccented)) {
      return "Saudi Arabia";
    }

    // 43. Brazil
    if (/\b(?:brazil|brasil)\b/i.test(unaccented) || /^(?:br|bra)$/i.test(unaccented)) {
      return "Brazil";
    }

    // 44. Mexico
    if (/\b(?:mexico)\b/i.test(unaccented) || /^(?:mx|mex)$/i.test(unaccented)) {
      return "Mexico";
    }

    // 45. Poland
    if (/\b(?:poland|polska)\b/i.test(unaccented) || /^(?:pl|pol)$/i.test(unaccented)) {
      return "Poland";
    }

    // 46. Austria
    if (/\b(?:austria|osterreich|oesterreich)\b/i.test(unaccented) || /^(?:at|aut)$/i.test(unaccented)) {
      return "Austria";
    }

    // 47. Belgium
    if (/\b(?:belgium|belgie|belgique)\b/i.test(unaccented) || /^(?:be|bel)$/i.test(unaccented)) {
      return "Belgium";
    }

    // 48. Sweden
    if (/\b(?:sweden|sverige)\b/i.test(unaccented) || /^(?:se|swe)$/i.test(unaccented)) {
      return "Sweden";
    }

    // 49. Norway
    if (/\b(?:norway|norge)\b/i.test(unaccented) || /^(?:no|nor)$/i.test(unaccented)) {
      return "Norway";
    }

    // 50. Denmark
    if (/\b(?:denmark|danmark)\b/i.test(unaccented) || /^(?:dk|dnk)$/i.test(unaccented)) {
      return "Denmark";
    }

    // 51. Finland
    if (/\b(?:finland|suomi)\b/i.test(unaccented) || /^(?:fi|fin)$/i.test(unaccented)) {
      return "Finland";
    }

    // 52. Portugal
    if (/\b(?:portugal)\b/i.test(unaccented) || /^(?:pt|prt)$/i.test(unaccented)) {
      return "Portugal";
    }

    // 53. Greece
    if (/\b(?:greece|hellas)\b/i.test(unaccented) || /^(?:gr|grc)$/i.test(unaccented)) {
      return "Greece";
    }

    // 54. Philippines
    if (/\b(?:philippines|pilipinas)\b/i.test(unaccented) || /^(?:ph|phl)$/i.test(unaccented)) {
      return "Philippines";
    }

    // 55. Hong Kong & Trinidad and Tobago
    if (/\b(?:hong\s*kong|hongkong)\b/i.test(unaccented) || /^(?:hk|hkg)$/i.test(unaccented)) {
      return "Hong Kong";
    }
    if (/\b(?:trinidad\s*(?:and|&)\s*tobago)\b/i.test(unaccented) || /^(?:tt|tto|t&t|t\s*&\s*t)$/i.test(unaccented)) {
      return "Trinidad and Tobago";
    }

    // 56. Strip common official prefixes ("Kingdom of X", "Sultanate of X", "Republic of X")
    const strippedOfficial = unaccented
      .replace(/^(?:the\s+)?(?:kingdom|sultanate|principality|grand\s+duchy|commonwealth|state|federation|republic|islamic\s+republic|people['’]?s\s+republic|democratic\s+republic)\s+of\s+/i, "")
      .trim();

    // 57. Canonical map across all 135 QC valid countries & abbreviations
    const exactCountryMap = {
      "afghanistan": "Afghanistan", "af": "Afghanistan", "afg": "Afghanistan",
      "albania": "Albania", "shqiperia": "Albania", "al": "Albania", "alb": "Albania",
      "algeria": "Algeria", "algerie": "Algeria", "dz": "Algeria", "dza": "Algeria",
      "andorra": "Andorra", "ad": "Andorra", "and": "Andorra",
      "angola": "Angola", "ao": "Angola", "ago": "Angola",
      "argentina": "Argentina", "ar": "Argentina", "arg": "Argentina",
      "armenia": "Armenia", "am": "Armenia", "arm": "Armenia",
      "australia": "Australia",
      "austria": "Austria",
      "azerbaijan": "Azerbaijan", "az": "Azerbaijan", "aze": "Azerbaijan",
      "bahamas": "Bahamas", "the bahamas": "Bahamas", "bs": "Bahamas", "bhs": "Bahamas",
      "bahrain": "Bahrain",
      "bangladesh": "Bangladesh", "bd": "Bangladesh", "bgd": "Bangladesh",
      "barbados": "Barbados", "bb": "Barbados", "brb": "Barbados",
      "belarus": "Belarus", "by": "Belarus", "blr": "Belarus",
      "belgium": "Belgium",
      "belize": "Belize", "bz": "Belize", "blz": "Belize",
      "bhutan": "Bhutan", "bt": "Bhutan", "btn": "Bhutan",
      "bolivia": "Bolivia", "bo": "Bolivia", "bol": "Bolivia",
      "botswana": "Botswana", "bw": "Botswana", "bwa": "Botswana",
      "brazil": "Brazil",
      "brunei": "Brunei Darussalam", "brunei darussalam": "Brunei Darussalam", "bn": "Brunei Darussalam", "brn": "Brunei Darussalam",
      "bulgaria": "Bulgaria", "bg": "Bulgaria", "bgr": "Bulgaria",
      "cambodia": "Cambodia", "kh": "Cambodia", "khm": "Cambodia",
      "canada": "Canada",
      "cayman islands": "Cayman Islands", "ky": "Cayman Islands", "cym": "Cayman Islands",
      "china": "China", "colombia": "Colombia", "co": "Colombia", "col": "Colombia",
      "costa rica": "Costa Rica", "cr": "Costa Rica", "cri": "Costa Rica",
      "croatia": "Croatia", "cyprus": "Cyprus", "cy": "Cyprus", "cyp": "Cyprus",
      "czech republic": "Czech Republic", "czechia": "Czech Republic", "denmark": "Denmark",
      "dominican republic": "Dominican Republic", "dom rep": "Dominican Republic", "dr": "Dominican Republic", "do": "Dominican Republic", "dom": "Dominican Republic",
      "egypt": "Egypt", "eg": "Egypt", "egy": "Egypt",
      "estonia": "Estonia", "eesti": "Estonia", "ee": "Estonia", "est": "Estonia",
      "ethiopia": "Ethiopia", "et": "Ethiopia", "eth": "Ethiopia",
      "fiji": "Fiji", "fj": "Fiji", "fji": "Fiji",
      "finland": "Finland", "france": "France",
      "germany": "Germany", "ghana": "Ghana", "gh": "Ghana", "gha": "Ghana",
      "greece": "Greece", "greenland": "Greenland", "kalaallit nunaat": "Greenland", "gl": "Greenland", "grl": "Greenland",
      "guatemala": "Guatemala", "gt": "Guatemala", "gtm": "Guatemala",
      "guyana": "Guyana", "gy": "Guyana", "guy": "Guyana",
      "hong kong": "Hong Kong", "hungary": "Hungary", "magyarorszag": "Hungary", "hu": "Hungary", "hun": "Hungary",
      "iceland": "Iceland", "island": "Iceland", "is": "Iceland", "isl": "Iceland",
      "india": "India", "indonesia": "Indonesia", "iran": "Iran",
      "iraq": "Iraq", "iq": "Iraq", "irq": "Iraq",
      "ireland": "Ireland", "israel": "Israel", "il": "Israel", "isr": "Israel", "italy": "Italy",
      "jamaica": "Jamaica", "jm": "Jamaica", "jam": "Jamaica", "japan": "Japan",
      "jordan": "Jordan", "jo": "Jordan", "jor": "Jordan",
      "kazakhstan": "Kazakhstan", "kz": "Kazakhstan", "kaz": "Kazakhstan",
      "kenya": "Kenya", "ke": "Kenya", "ken": "Kenya",
      "kuwait": "Kuwait", "kw": "Kuwait", "kwt": "Kuwait",
      "latvia": "Latvia", "latvija": "Latvia", "lv": "Latvia", "lva": "Latvia",
      "lebanon": "Lebanon", "liban": "Lebanon", "lb": "Lebanon", "lbn": "Lebanon",
      "liechtenstein": "Liechtenstein", "li": "Liechtenstein", "lie": "Liechtenstein",
      "lithuania": "Lithuania", "lietuva": "Lithuania", "lt": "Lithuania", "ltu": "Lithuania",
      "luxembourg": "Luxembourg", "luxemburg": "Luxembourg", "lu": "Luxembourg", "lux": "Luxembourg",
      "madagascar": "Madagascar", "mg": "Madagascar", "mdg": "Madagascar",
      "malaysia": "Malaysia", "maldives": "Maldives", "mv": "Maldives", "mdv": "Maldives",
      "malta": "Malta", "mt": "Malta", "mlt": "Malta",
      "mauritius": "Mauritius", "mu": "Mauritius", "mus": "Mauritius",
      "mexico": "Mexico", "moldova": "Moldova", "md": "Moldova", "mda": "Moldova",
      "mongolia": "Mongolia", "mn": "Mongolia", "mng": "Mongolia",
      "morocco": "Morocco", "maroc": "Morocco", "ma": "Morocco", "mar": "Morocco",
      "mozambique": "Mozambique", "mocambique": "Mozambique", "mz": "Mozambique", "moz": "Mozambique",
      "myanmar": "Myanmar", "namibia": "Namibia", "na": "Namibia", "nam": "Namibia",
      "nepal": "Nepal", "np": "Nepal", "npl": "Nepal",
      "netherlands": "Netherlands", "new zealand": "New Zealand",
      "nicaragua": "Nicaragua", "ni": "Nicaragua", "nic": "Nicaragua",
      "nigeria": "Nigeria", "ng": "Nigeria", "nga": "Nigeria",
      "north korea": "North Korea", "north macedonia": "North Macedonia", "norway": "Norway", "oman": "Oman",
      "pakistan": "Pakistan", "pk": "Pakistan", "pak": "Pakistan",
      "panama": "Panama", "pa": "Panama", "pan": "Panama",
      "papua new guinea": "Papua New Guinea", "png": "Papua New Guinea", "pg": "Papua New Guinea",
      "paraguay": "Paraguay", "py": "Paraguay", "pry": "Paraguay",
      "peru": "Peru", "pe": "Peru", "per": "Peru",
      "philippines": "Philippines", "poland": "Poland", "portugal": "Portugal",
      "qatar": "Qatar", "qa": "Qatar", "qat": "Qatar",
      "romania": "Romania", "ro": "Romania", "rou": "Romania", "russia": "Russia",
      "rwanda": "Rwanda", "rw": "Rwanda", "rwa": "Rwanda",
      "saint lucia": "Saint Lucia", "st lucia": "Saint Lucia", "st. lucia": "Saint Lucia", "lc": "Saint Lucia", "lca": "Saint Lucia",
      "samoa": "Samoa", "ws": "Samoa", "wsm": "Samoa",
      "saudi arabia": "Saudi Arabia", "serbia": "Serbia", "srbija": "Serbia", "rs": "Serbia", "srb": "Serbia",
      "seychelles": "Seychelles", "sc": "Seychelles", "syc": "Seychelles",
      "sierra leone": "Sierra Leone", "sl": "Sierra Leone", "sle": "Sierra Leone",
      "singapore": "Singapore", "slovakia": "Slovakia", "slovensko": "Slovakia", "slovak republic": "Slovakia", "sk": "Slovakia", "svk": "Slovakia",
      "slovenia": "Slovenia", "slovenija": "Slovenia", "si": "Slovenia", "svn": "Slovenia",
      "south africa": "South Africa", "south korea": "South Korea", "spain": "Spain",
      "sri lanka": "Sri Lanka", "lk": "Sri Lanka", "lka": "Sri Lanka",
      "sudan": "Sudan", "sd": "Sudan", "sdn": "Sudan",
      "suriname": "Suriname", "sr": "Suriname", "sur": "Suriname",
      "sweden": "Sweden", "switzerland": "Switzerland", "syria": "Syria", "taiwan": "Taiwan",
      "tanzania": "Tanzania", "thailand": "Thailand", "trinidad and tobago": "Trinidad and Tobago",
      "tunisia": "Tunisia", "tunisie": "Tunisia", "tn": "Tunisia", "tun": "Tunisia",
      "turkiye": "Türkiye", "turkey": "Türkiye",
      "uganda": "Uganda", "ug": "Uganda", "uga": "Uganda",
      "ukraine": "Ukraine", "ukraina": "Ukraine", "ua": "Ukraine", "ukr": "Ukraine",
      "u.a.e.": "United Arab Emirates", "united arab emirates": "United Arab Emirates",
      "united kingdom": "United Kingdom",
      "united states": "United States Of America", "united states of america": "United States Of America",
      "uruguay": "Uruguay", "uy": "Uruguay", "ury": "Uruguay",
      "uzbekistan": "Uzbekistan", "uz": "Uzbekistan", "uzb": "Uzbekistan",
      "vanuatu": "Vanuatu", "vu": "Vanuatu", "vut": "Vanuatu",
      "vietnam": "Vietnam",
      "zambia": "Zambia", "zm": "Zambia", "zmb": "Zambia",
      "zimbabwe": "Zimbabwe", "zw": "Zimbabwe", "zwe": "Zimbabwe"
    };
    if (exactCountryMap[unaccented]) return exactCountryMap[unaccented];
    if (exactCountryMap[strippedOfficial]) return exactCountryMap[strippedOfficial];

    return toTitleCase(c);
  }

  /**
   * Rule 4: Cleans and formats company name per QC requirements:
   * - Remove brackets while preserving inner text
   * - Keep country name as it is
   * - Co., Ltd -> Company, Limited vs Co. Ltd -> Company Limited
   * - Special character should not start and should not end
   * - Apply Title Case
   */
  function cleanCompanyName(name) {
    if (!name || typeof name !== "string") return "";
    let n = name.trim();
    // Remove brackets while preserving inner text
    n = n.replace(/[\(\[\{]\s*([^\)\]\}]+?)\s*[\)\]\}]/g, " $1 ");
    n = n.replace(/[\(\)\[\]\{\}]/g, " ");

    // Indonesia & Malaysia legal forms
    n = n.replace(/(^|[\s,])(?:p\.?\s*t)\b\.?\s+/gi, "$1Perseroan Terbatas ");
    n = n.replace(/(^|[\s,])(?:c\.?\s*v)\b\.?\s+/gi, "$1Commanditaire Vennootschap ");
    n = n.replace(/(^|[\s,])(?:u\.?\s*d)\b\.?\s+/gi, "$1Usaha Dagang ");
    n = n.replace(/\btbk\b\.?/gi, "Terbuka");
    n = n.replace(/\bsdn\.?\s*bhd\b\.?/gi, "Sendirian Berhad");

    // Common business & industry abbreviations
    n = n.replace(/\b(?:mfg|manuf|mnfg)[\.\s]*co[\.\s]*(,)?[\.\s]*l[\.\s]*t[\.\s]*d\b\.?/gi, (m, c) => c ? "Manufacturing Company, Limited" : "Manufacturing Company Limited");
    n = n.replace(/\bind(?:ust)?[\.\s]*co[\.\s]*(,)?[\.\s]*l[\.\s]*t[\.\s]*d\b\.?/gi, (m, c) => c ? "Industries Company, Limited" : "Industries Company Limited");
    n = n.replace(/\b(?:mfg|manuf|mnfg)\b\.?/gi, "Manufacturing");
    n = n.replace(/\b(?:ind['’]?l|indl)\b\.?/gi, "Industrial");
    n = n.replace(/\b(?:inds|indust|ind)\b\.?/gi, "Industries");
    n = n.replace(/\b(?:intl|int['’]?l)\b\.?/gi, "International");
    n = n.replace(/\b(?:engg|engr)\b\.?/gi, "Engineering");
    n = n.replace(/\b(?:bros)\b\.?/gi, "Brothers");
    n = n.replace(/\b(?:tech)\b\.?/gi, "Technology");
    n = n.replace(/\b(?:systs|syst|sys)\b\.?/gi, "Systems");
    n = n.replace(/\b(?:svcs|servs|svc|serv)\b\.?/gi, "Services");
    n = n.replace(/\b(?:equip|eqpt)\b\.?/gi, "Equipment");
    n = n.replace(/\b(?:prods|prod)\b\.?/gi, "Products");

    // Co., Ltd vs Co. Ltd (preserve comma if present, omit if not)
    n = n.replace(/\bco[\.\s]*(,)\s*l[\.\s]*t[\.\s]*d\b\.?/gi, "Company, Limited");
    n = n.replace(/\bco[\.\s]+l[\.\s]*t[\.\s]*d\b\.?/gi, "Company Limited");

    // Private / Proprietary Limited & US/Global entities
    n = n.replace(/\bp[\.\s]*t[\.\s]*e[\.\s]*(,)\s*l[\.\s]*t[\.\s]*d\b\.?/gi, "Private, Limited");
    n = n.replace(/\bp[\.\s]*t[\.\s]*e[\.\s]+l[\.\s]*t[\.\s]*d\b\.?/gi, "Private Limited");
    n = n.replace(/\bp[\.\s]*v[\.\s]*t[\.\s]*(,)\s*l[\.\s]*t[\.\s]*d\b\.?/gi, "Private, Limited");
    n = n.replace(/\bp[\.\s]*v[\.\s]*t[\.\s]+l[\.\s]*t[\.\s]*d\b\.?/gi, "Private Limited");
    n = n.replace(/\bp[\.\s]*t[\.\s]*y[\.\s]*(,)\s*l[\.\s]*t[\.\s]*d\b\.?/gi, "Proprietary, Limited");
    n = n.replace(/\bp[\.\s]*t[\.\s]*y[\.\s]+l[\.\s]*t[\.\s]*d\b\.?/gi, "Proprietary Limited");

    n = n.replace(/\bl[\.\s]*l[\.\s]*c\b\.?/gi, "Limited Liability Company");
    n = n.replace(/\bl[\.\s]*t[\.\s]*d\b\.?/gi, "Limited");
    n = n.replace(/\bi[\.\s]*n[\.\s]*c\b\.?/gi, "Incorporated");
    n = n.replace(/\bc[\.\s]*o[\.\s]*r[\.\s]*p\b\.?/gi, "Corporation");
    n = n.replace(/\bco\b\.?/gi, "Company");

    // Rule: Special character should not start and should not end (internal symbols like &, +, @, %, / preserved)
    n = n.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
    n = n.replace(/[^\p{L}\p{N}]+$/gu, "").trim();
    n = n.replace(/\s+/g, " ").trim();
    return toTitleCase(n);
  }

  /**
   * Rule: Take the complete phone number, but remove the country code, special characters, and spaces.
   * Do not take toll-free numbers. Do not take numbers starting with zero.
   */
  function cleanPhoneNumber(rawPhone, country) {
    if (!rawPhone) return "";
    let p = String(rawPhone).trim();

    p = p.replace(/^(?:tel|call|phone|contact|mobile|fax|whatsapp)[\s.:]*/i, "").trim();

    // Immediate rejection of explicit toll-free keywords
    if (/\b(?:toll[-\s]*free|free[-\s]*phone|green[-\s]*line)\b/i.test(p)) {
      return "";
    }

    const cLower = (country || "").toLowerCase();
    const hasPlus = p.startsWith("+");
    const has00 = p.startsWith("00");

    let digits = p.replace(/\D/g, "");
    if (!digits) return "";

    // Reject immediate toll-free numbers before country code removal
    if (/^(?:1800|1888|1877|1866|1855|1844|1833|1300|0800|0808|0500|800|888|877|866|855|844|833)/.test(digits)) {
      return "";
    }

    if (has00 && digits.length >= 10) {
      digits = digits.slice(2);
    }

    // Comprehensive map of country calling codes
    const countryCodes = [
      { match: ["malaysia"], code: "60", minLen: 10 },
      { match: ["south africa"], code: "27", minLen: 11 },
      { match: ["australia"], code: "61", minLen: 11 },
      { match: ["united states", "canada", "usa", "america", "jamaica", "bahamas", "barbados", "cayman islands", "dominican republic", "saint lucia", "trinidad and tobago"], code: "1", minLen: 11 },
      { match: ["united kingdom", "northern ireland", "england", "scotland", "wales", "great britain", "uk"], code: "44", minLen: 12 },
      { match: ["taiwan"], code: "886", minLen: 11 },
      { match: ["india"], code: "91", minLen: 12 },
      { match: ["singapore"], code: "65", minLen: 10 },
      { match: ["china"], code: "86", minLen: 12 },
      { match: ["hong kong"], code: "852", minLen: 11 },
      { match: ["japan"], code: "81", minLen: 11 },
      { match: ["north korea"], code: "850", minLen: 11 },
      { match: ["south korea", "korea"], code: "82", minLen: 11 },
      { match: ["germany", "deutschland"], code: "49", minLen: 11 },
      { match: ["france"], code: "33", minLen: 11 },
      { match: ["italy", "italia"], code: "39", minLen: 11 },
      { match: ["spain", "españa", "espana"], code: "34", minLen: 11 },
      { match: ["netherlands", "nederland"], code: "31", minLen: 11 },
      { match: ["switzerland", "schweiz"], code: "41", minLen: 11 },
      { match: ["austria", "österreich", "oesterreich"], code: "43", minLen: 11 },
      { match: ["belgium"], code: "32", minLen: 11 },
      { match: ["united arab emirates", "uae"], code: "971", minLen: 12 },
      { match: ["saudi arabia"], code: "966", minLen: 12 },
      { match: ["qatar"], code: "974", minLen: 11 },
      { match: ["kuwait"], code: "965", minLen: 11 },
      { match: ["bahrain"], code: "973", minLen: 11 },
      { match: ["oman"], code: "968", minLen: 11 },
      { match: ["jordan"], code: "962", minLen: 11 },
      { match: ["lebanon"], code: "961", minLen: 11 },
      { match: ["israel"], code: "972", minLen: 12 },
      { match: ["türkiye", "turkiye", "turkey"], code: "90", minLen: 12 },
      { match: ["new zealand"], code: "64", minLen: 11 },
      { match: ["indonesia"], code: "62", minLen: 11 },
      { match: ["philippines"], code: "63", minLen: 11 },
      { match: ["thailand"], code: "66", minLen: 11 },
      { match: ["vietnam"], code: "84", minLen: 11 },
      { match: ["cambodia"], code: "855", minLen: 11 },
      { match: ["brunei"], code: "673", minLen: 10 },
      { match: ["myanmar"], code: "95", minLen: 10 },
      { match: ["pakistan"], code: "92", minLen: 12 },
      { match: ["bangladesh"], code: "880", minLen: 13 },
      { match: ["sri lanka"], code: "94", minLen: 11 },
      { match: ["nepal"], code: "977", minLen: 12 },
      { match: ["bhutan"], code: "975", minLen: 11 },
      { match: ["maldives"], code: "960", minLen: 10 },
      { match: ["mongolia"], code: "976", minLen: 11 },
      { match: ["afghanistan"], code: "93", minLen: 11 },
      { match: ["iran"], code: "98", minLen: 12 },
      { match: ["iraq"], code: "964", minLen: 12 },
      { match: ["syria"], code: "963", minLen: 11 },
      { match: ["ireland"], code: "353", minLen: 11 },
      { match: ["poland"], code: "48", minLen: 11 },
      { match: ["portugal"], code: "351", minLen: 12 },
      { match: ["greece"], code: "30", minLen: 12 },
      { match: ["sweden"], code: "46", minLen: 11 },
      { match: ["norway"], code: "47", minLen: 10 },
      { match: ["denmark"], code: "45", minLen: 10 },
      { match: ["finland"], code: "358", minLen: 11 },
      { match: ["iceland"], code: "354", minLen: 10 },
      { match: ["luxembourg"], code: "352", minLen: 11 },
      { match: ["liechtenstein"], code: "423", minLen: 10 },
      { match: ["andorra"], code: "376", minLen: 9 },
      { match: ["malta"], code: "356", minLen: 11 },
      { match: ["cyprus"], code: "357", minLen: 11 },
      { match: ["czech republic", "czechia", "czech"], code: "420", minLen: 12 },
      { match: ["slovakia"], code: "421", minLen: 12 },
      { match: ["hungary"], code: "36", minLen: 11 },
      { match: ["romania"], code: "40", minLen: 11 },
      { match: ["bulgaria"], code: "359", minLen: 12 },
      { match: ["croatia", "hrvatska"], code: "385", minLen: 11 },
      { match: ["slovenia"], code: "386", minLen: 11 },
      { match: ["serbia"], code: "381", minLen: 11 },
      { match: ["north macedonia"], code: "389", minLen: 11 },
      { match: ["albania"], code: "355", minLen: 11 },
      { match: ["moldova"], code: "373", minLen: 11 },
      { match: ["ukraine"], code: "380", minLen: 12 },
      { match: ["belarus"], code: "375", minLen: 12 },
      { match: ["estonia"], code: "372", minLen: 10 },
      { match: ["latvia"], code: "371", minLen: 11 },
      { match: ["lithuania"], code: "370", minLen: 11 },
      { match: ["russia", "kazakhstan"], code: "7", minLen: 11 },
      { match: ["uzbekistan"], code: "998", minLen: 12 },
      { match: ["azerbaijan"], code: "994", minLen: 12 },
      { match: ["armenia"], code: "374", minLen: 11 },
      { match: ["brazil"], code: "55", minLen: 12 },
      { match: ["mexico"], code: "52", minLen: 12 },
      { match: ["argentina"], code: "54", minLen: 12 },
      { match: ["colombia"], code: "57", minLen: 12 },
      { match: ["peru"], code: "51", minLen: 11 },
      { match: ["uruguay"], code: "598", minLen: 11 },
      { match: ["paraguay"], code: "595", minLen: 12 },
      { match: ["bolivia"], code: "591", minLen: 11 },
      { match: ["costa rica"], code: "506", minLen: 11 },
      { match: ["panama"], code: "507", minLen: 10 },
      { match: ["guatemala"], code: "502", minLen: 11 },
      { match: ["nicaragua"], code: "505", minLen: 11 },
      { match: ["belize"], code: "501", minLen: 10 },
      { match: ["guyana"], code: "592", minLen: 10 },
      { match: ["suriname"], code: "597", minLen: 10 },
      { match: ["egypt"], code: "20", minLen: 12 },
      { match: ["morocco"], code: "212", minLen: 12 },
      { match: ["algeria"], code: "213", minLen: 12 },
      { match: ["tunisia"], code: "216", minLen: 11 },
      { match: ["nigeria"], code: "234", minLen: 13 },
      { match: ["kenya"], code: "254", minLen: 12 },
      { match: ["ghana"], code: "233", minLen: 12 },
      { match: ["ethiopia"], code: "251", minLen: 12 },
      { match: ["tanzania"], code: "255", minLen: 12 },
      { match: ["uganda"], code: "256", minLen: 12 },
      { match: ["rwanda"], code: "250", minLen: 12 },
      { match: ["botswana"], code: "267", minLen: 11 },
      { match: ["namibia"], code: "264", minLen: 11 },
      { match: ["zambia"], code: "260", minLen: 12 },
      { match: ["zimbabwe"], code: "263", minLen: 12 },
      { match: ["mozambique"], code: "258", minLen: 12 },
      { match: ["angola"], code: "244", minLen: 12 },
      { match: ["madagascar"], code: "261", minLen: 12 },
      { match: ["mauritius"], code: "230", minLen: 10 },
      { match: ["seychelles"], code: "248", minLen: 10 },
      { match: ["sierra leone"], code: "232", minLen: 11 },
      { match: ["sudan"], code: "249", minLen: 12 },
      { match: ["fiji"], code: "679", minLen: 10 },
      { match: ["papua new guinea"], code: "675", minLen: 11 },
      { match: ["samoa"], code: "685", minLen: 8 },
      { match: ["vanuatu"], code: "678", minLen: 8 }
    ];

    let codeRemoved = false;
    const matchedCountryCc = countryCodes.find(cc => cc.match.some(m => cLower.includes(m)));

    // 1. Match by detected country strictly: ONLY strip this specific country's calling code
    if (matchedCountryCc) {
      if (digits.startsWith(matchedCountryCc.code) && (hasPlus || has00 || digits.length >= (matchedCountryCc.minLen - 1))) {
        digits = digits.slice(matchedCountryCc.code.length);
        codeRemoved = true;
      }
    }

    // 2. Fallback ONLY when country is unknown OR explicit international prefix (+ or 00) was present
    if (!codeRemoved && (!matchedCountryCc || hasPlus || has00)) {
      for (const cc of countryCodes) {
        if (digits.startsWith(cc.code) && digits.length >= ((hasPlus || has00) ? cc.minLen - 1 : cc.minLen)) {
          digits = digits.slice(cc.code.length);
          codeRemoved = true;
          break;
        }
      }
    }

    // Rule: Take complete phone number, but remove leading zero
    digits = digits.replace(/^0+/, "");

    // Rule: Do NOT take numbers starting with zero
    if (!digits || digits.startsWith("0")) {
      return "";
    }

    // Rule: STRICTLY DO NOT TAKE TOLL-FREE NUMBERS (US 800/888/877/866/855/844/833, AU 1800/1300, UK 0800/0808/0500)
    if (/^(?:1800|1300|0800|0808|0500)/.test(digits)) {
      return "";
    }
    const isNorthAmerica = cLower.includes("united states") || cLower.includes("canada") || cLower.includes("usa") || cLower.includes("america");
    if ((isNorthAmerica || !matchedCountryCc) && /^(?:800|888|877|866|855|844|833|900|901|902)/.test(digits)) {
      return "";
    }

    // Country-specific length validation
    const len = digits.length;
    if (cLower.includes("south africa")) {
      if (len !== 9) return "";
    } else if (isNorthAmerica) {
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
    } else if (cLower.includes("new zealand")) {
      if (len < 8 || len > 10) return "";
    } else if (cLower.includes("indonesia")) {
      if (len < 8 || len > 12) return "";
    } else if (cLower.includes("singapore")) {
      if (len !== 8) return "";
    } else if (cLower.includes("spain") || cLower.includes("espana") || cLower.includes("españa")) {
      if (len !== 9) return "";
    } else if (cLower.includes("france")) {
      if (len !== 9) return "";
    } else {
      if (len < 8 || len > 12) return "";
    }

    return digits;
  }

  /**
   * Strips contact label glued to the end of an email from HTML text concatenation.
   * E.g. "key@keyar.comaddress" -> "key@keyar.com"
   * E.g. "info@domain.co.ukphone:+44" -> "info@domain.co.uk"
   */
  function stripTrailingContactWordsFromEmail(email) {
    if (!email || typeof email !== "string") return "";
    let em = email.trim();
    // Strip malformed mailto / protocol prefixes (e.g. "mailto:info@...", "http://mailtoinfo@...", "mailtoinfo@...")
    em = em.replace(/^(?:https?:\/\/)?mailto:/i, "");
    em = em.replace(/^(?:https?:\/\/)?mailto(?=(?:info|sales|contact|enquir(?:y|ies)|hello|hi|office|support|admin|service|customercare|customer|marketing|orders?|export|import|hr|jobs|careers|mail|general|team|feedback|billing|accounts)[a-z0-9._%+-]*@)/i, "");
    const contactSuffixes = "address|addr|tel|telephone|phone|fax|email|mail|contact|mobile|cell|whatsapp|postcode|postal|zip|website|web|url|loc|location";
    em = em.replace(new RegExp(`(\\.(?:com|org|net|edu|gov|io|co|cn|tw|uk|de|jp|fr|it|es|au|ca|in|biz|info|me|cc|tv|xyz|eu|nl|se|no|ch|at|ru|pl|br|mx|za|nz|asia|mobi|name|pro|tech|store|shop|online|site|vip|club|top))(?:${contactSuffixes})[\\s:：\\-–].*$`, "i"), "$1");
    em = em.replace(new RegExp(`(\\.(?:com|org|net|edu|gov|io|co|cn|tw|uk|de|jp|fr|it|es|au|ca|in|biz|info|me|cc|tv|xyz|eu|nl|se|no|ch|at|ru|pl|br|mx|za|nz|asia|mobi|name|pro|tech|store|shop|online|site|vip|club|top))(?:${contactSuffixes})$`, "i"), "$1");
    return em;
  }

  function fillFormFields(data) {
    if (!data) return { filledCount: 0 };
    const elements = detectFormElements();
    clearFilledFields(); // Reset all form fields to prevent ghost bleed-through from previous record
    let filledCount = 0;

    const allowedWorkingTypes = new Set([
      "manufacturer",
      "manufacturing",
      "manufacture",
      "industrial services",
      "industrial service",
      "exporter",
      "export",
      "trader",
      "trading",
      "distributer",
      "distributor",
      "distribution",
      "supplier",
      "supplies",
      "wholesaler",
      "wholesale"
    ]);

    const btVal = String(data.businessType || "").trim().toLowerCase();
    const isDisallowedType = !!(btVal && !allowedWorkingTypes.has(btVal));

    const isProhibitedOrRestricted = !data._isFromAi && !!(data.isProhibitedSite || data.isRestricted || String(data.businessType || "").toLowerCase() === "restricted site" || isDisallowedType || data.isDisallowedBusinessType);

    // Rule 1 QC Safeguard: A site with 0 products and no address or contact info CANNOT be Working!
    const isZeroProdUnverifiable = !data._isFromAi && (String(data.numberOfProducts || "").trim() === "0" || data.numberOfProducts === 0) &&
      (!data.companyAddress || data.companyAddress === "Not Available" || !data.companyAddress.trim()) &&
      (!data.emailId || !data.emailId.trim()) &&
      (!data.phoneNumber || !data.phoneNumber.trim());

    // CRITICAL QC RULE:
    // When Website Status is NOT "Working" and NOT "Redirect Site" (Not Working, Non English, Flash, Domain Expired, or prohibited category detected),
    // select the respective status and clear/leave empty ALL other fields!
    // NOTE: "Redirect Site" is a WORKING website that redirected to a new domain (Rule 13).
    // All 14 fields MUST be filled with the company data from the final redirected URL!
    const isNonWorkingStatus = (data.websiteStatus &&
      data.websiteStatus !== "Working" &&
      data.websiteStatus !== "Redirect Site" &&
      data.websiteStatus !== "Redirect") || isZeroProdUnverifiable;
    if (isNonWorkingStatus || isProhibitedOrRestricted) {
      const targetStatus = (isProhibitedOrRestricted || isZeroProdUnverifiable) ? "Not Working" : (data.websiteStatus || "Not Working");
      if (elements.websiteStatus) {
        if (setSelectValue(elements.websiteStatus, targetStatus)) {
          highlightField(elements.websiteStatus);
          filledCount++;
        }
      }

      // Display detailed Not Working Study Card & reason
      if (targetStatus === "Not Working" || isNonWorkingStatus) {
        currentNotWorkingData = data;
        showNotWorkingStudyCard(data);
      }

      // Check auto-submit toggle: Only auto-submit if user enabled it!
      if (targetStatus === "Not Working") {
        const currentUrl = getTargetUrl();
        if (autoSubmitNotWorkingEnabled) {
          updateStatus("⚠️ Status set to Not Working. Auto-submitting in 3s... (Click 'Stop Auto-Submit' to study)", "warning");
          if (pendingAutoSubmitTimer) clearTimeout(pendingAutoSubmitTimer);
          pendingAutoSubmitTimer = setTimeout(() => {
            pendingAutoSubmitTimer = null;
            autoSubmitNotWorking(currentUrl);
          }, 3000);
        } else {
          // Auto-submit is OFF so user can review and study
          if (pendingAutoSubmitTimer) {
            clearTimeout(pendingAutoSubmitTimer);
            pendingAutoSubmitTimer = null;
          }
          const studyInfo = extractNotWorkingReason(data);
          updateStatus(`🚫 NOT WORKING: ${studyInfo.reason}. Auto-submit is STOPPED so you can study.`, "error");
        }
      }

      // Clear all other fields (leave empty string / default placeholder)
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

      if (isProhibitedOrRestricted) {
        showRestrictedBanner(data.restrictedReason || "Prohibited Category Detected");
      }

      return { filledCount, isNotWorking: true, isRestricted: isProhibitedOrRestricted };
    }

    // 1. Website Status
    try {
      if (elements.websiteStatus && data.websiteStatus) {
        if (setSelectValue(elements.websiteStatus, data.websiteStatus)) {
          highlightField(elements.websiteStatus);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting websiteStatus:", e); }

    // 2. Business Type
    try {
      if (elements.businessType && data.businessType) {
        if (setSelectValue(elements.businessType, data.businessType)) {
          highlightField(elements.businessType);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting businessType:", e); }

    // 3. Company Profile
    try {
      if (elements.companyProfile && data.companyProfile) {
        if (setSelectValue(elements.companyProfile, data.companyProfile)) {
          highlightField(elements.companyProfile);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting companyProfile:", e); }

    // 4. Company Name (Rule: All words start with Capital letter, Special character should not start and should not end)
    try {
      if (elements.companyName && data.companyName) {
        let formattedName = String(data.companyName).trim();
        // Rule: Special character should not start and should not end
        formattedName = formattedName.replace(/^[^\p{L}\p{N}]+/gu, "").replace(/[^\p{L}\p{N}]+$/gu, "").trim();
        if (setInputValue(elements.companyName, formattedName)) {
          highlightField(elements.companyName);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting companyName:", e); }

    // 5. Country Name (Rule: Full official country name in Title Case)
    try {
      if (elements.countryName && data.countryName) {
        let formattedCountry = String(data.countryName).trim();
        const isSelect = elements.countryName.tagName && elements.countryName.tagName.toLowerCase() === "select";
        const success = isSelect ? setSelectValue(elements.countryName, formattedCountry) : setInputValue(elements.countryName, formattedCountry);
        if (success) {
          highlightField(elements.countryName);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting countryName:", e); }

    // 6. Company Address (Trust background.js final QC-sanitized address directly)
    try {
      const addrVal = (data.companyAddress && data.companyAddress !== "Not Available")
        ? String(data.companyAddress).trim()
        : "";
      if (elements.companyAddress && addrVal) {
        if (setInputValue(elements.companyAddress, addrVal)) {
          highlightField(elements.companyAddress);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting companyAddress:", e); }

    // 7. State
    try {
      if (elements.state && data.state) {
        if (setSelectValue(elements.state, data.state)) {
          highlightField(elements.state);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting state:", e); }

    // 8. City
    try {
      if (elements.city && data.city) {
        if (setSelectValue(elements.city, data.city)) {
          highlightField(elements.city);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting city:", e); }

    // 9. Email ID
    try {
      if (elements.emailId) {
        let cleanEmail = data.emailId ? stripTrailingContactWordsFromEmail(String(data.emailId).trim()) : "";
        setInputValue(elements.emailId, cleanEmail);
        if (cleanEmail) {
          highlightField(elements.emailId);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting emailId:", e); }

    // 10. Secondary Email ID (QC Rule: primary and secondary emails MUST NOT be the same)
    try {
      if (elements.secondaryEmailId) {
        try { elements.secondaryEmailId.setAttribute("autocomplete", "off"); } catch (e) { }
        let secEmail = data.secondaryEmailId ? stripTrailingContactWordsFromEmail(String(data.secondaryEmailId || "").trim()) : "";
        const primEmail = data.emailId ? stripTrailingContactWordsFromEmail(String(data.emailId || "").trim()).toLowerCase() : "";
        if (/^(?:not\s*available|none|n\/?a|null|undefined)$/i.test(secEmail) || secEmail.toLowerCase() === primEmail) {
          secEmail = "";
        }
        setInputValue(elements.secondaryEmailId, secEmail);
        if (secEmail) {
          highlightField(elements.secondaryEmailId);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting secondaryEmailId:", e); }

    // 11. Phone Number (Digits only, country code and leading zeroes stripped)
    try {
      if (elements.phoneNumber) {
        let phoneVal = (data.phoneNumber && data.phoneNumber !== "Not Available") ? String(data.phoneNumber).trim() : "";
        setInputValue(elements.phoneNumber, phoneVal);
        if (phoneVal) {
          highlightField(elements.phoneNumber);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting phoneNumber:", e); }

    // 12, 13, 14. Independent Product Metrics (Evaluated independently per website evidence)
    const parseCountStr = (v) => {
      if (!v) return "0";
      const s = String(v).trim().toLowerCase();
      if (s === "three" || s === "3") return "3";
      if (s === "two" || s === "2") return "2";
      if (s === "one" || s === "1") return "1";
      const n = parseInt(s, 10);
      return (!isNaN(n) && n > 0) ? (n >= 3 ? "3" : String(n)) : "0";
    };

    // 12, 13, 14. Product Metrics: Whatever Image Product has, put the same for No. of Product Description and Number of Product
    const imageCount = parseCountStr(data.productImages);

    // 12. Number of Products (same as Image Product)
    try {
      if (elements.numberOfProducts) {
        if (setSelectValue(elements.numberOfProducts, imageCount)) {
          highlightField(elements.numberOfProducts);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting numberOfProducts:", e); }

    // 13. Product Images
    try {
      if (elements.productImages) {
        if (setSelectValue(elements.productImages, imageCount)) {
          highlightField(elements.productImages);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting productImages:", e); }

    // 14. Number of Product Descriptions (same as Image Product)
    try {
      if (elements.numberOfProductDescriptions) {
        if (setSelectValue(elements.numberOfProductDescriptions, imageCount)) {
          highlightField(elements.numberOfProductDescriptions);
          filledCount++;
        }
      }
    } catch (e) { console.warn("Error setting numberOfProductDescriptions:", e); }

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

    const siteBaseUrl = data._finalUrl || data._originalUrl || (typeof getTargetUrl === "function" ? getTargetUrl() : "");

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

  let isCrawlingInProgress = false;

  async function triggerCrawlAndFill() {
    if (isCrawlingInProgress) {
      console.log("[AI Assistant] Crawl already active. Ignoring duplicate request.");
      return;
    }
    if (!isExtensionAlive()) {
      showReloadBanner();
      updateStatus("Please refresh page (F5) to reconnect", "warning");
      return;
    }

    isCrawlingInProgress = true;

    // Single crawl & fill: ensure auto-queue loop is stopped so API is never called repeatedly
    stopAutoQueuePipeline("Manual crawl initiated");
    let targetUrl = getTargetUrl();
    if (!targetUrl) {
      // Try to load pending URL from queue if input is empty
      const fromQueueBtn = document.getElementById("btnLoadNextQueueUrl") ||
        Array.from(document.querySelectorAll("button, a")).find(b => (b.textContent || "").toLowerCase().includes("from queue"));
      if (fromQueueBtn) {
        fromQueueBtn.click();
        targetUrl = getTargetUrl();
      }
    }

    if (!targetUrl) {
      updateStatus("⚠️ Website Name URL not found. Click 'From Queue' or enter a URL.", "error");
      resetCrawlButtons();
      return;
    }

    lastProcessedUrl = targetUrl;
    updateStatus(`Crawling ${targetUrl} (Contact Page / Footer address)...`, "loading");

    const crawlBtn = document.getElementById("ai-crawl-btn");
    const headerCrawlBtn = document.getElementById("ai-header-crawl-btn");
    const quickBtn = document.getElementById("ai-quick-btn");
    if (crawlBtn) crawlBtn.disabled = true;
    if (headerCrawlBtn) {
      headerCrawlBtn.disabled = true;
      headerCrawlBtn.innerHTML = "⏳ Crawling...";
    }
    if (quickBtn) {
      quickBtn.disabled = true;
      quickBtn.innerHTML = "⏳ Crawling...";
    }

    // Safety timeout: ensure buttons are NEVER permanently disabled (30s)
    const safetyTimer = setTimeout(resetCrawlButtons, 30000);

    try {
      const response = await sendRuntimeMessage({ action: "CRAWL_AND_EXTRACT", url: targetUrl });
      resetCrawlButtons();

      if (!response || !response.success) {
        const errorMsg = response?.error || "Unable to fetch or crawl website";
        const isExtError = !!response?.isExtensionError || /message\s*channel\s*closed|context\s*invalidated|could\s*not\s*establish\s*connection/i.test(errorMsg);

        if (isExtError) {
          // Internal Chrome extension communication glitch: DO NOT mark the site as Not Working!
          console.log("[AI Assistant] Extension service worker communication issue:", errorMsg);
          updateStatus(`⚠️ Extension background busy (${errorMsg}). Please click AI Crawl & Fill again.`, "warning");
          return;
        }

        console.warn("[AI Assistant] Website unreachable / failed to fetch. Marking as Not Working as instructed:", errorMsg);
        const notWorkingData = {
          websiteStatus: "Not Working",
          businessType: "",
          companyProfile: "",
          companyName: "",
          countryName: "",
          companyAddress: "",
          state: "",
          city: "",
          emailId: "",
          secondaryEmailId: "",
          phoneNumber: "",
          numberOfProducts: "",
          productImages: "",
          numberOfProductDescriptions: "",
          fetchError: errorMsg,
          errorKeyword: "Unreachable / Failed to Fetch",
          errorSourceUrl: targetUrl,
          errorSnippet: errorMsg,
          _finalUrl: targetUrl,
          _originalUrl: targetUrl,
          _note: `Unreachable / Failed to fetch: ${errorMsg}`
        };
        fillFormFields(notWorkingData);
        renderPreview(notWorkingData);
        updateStatus(`⚠️ Website unreachable (${errorMsg}). Status set to Not Working.`, "warning");
        return;
      }

      const data = response.data;
      cachedExtractedData = data;

      // STRICT QC: If prohibited or restricted site, show proper error message, clear all fields, and select Not Working
      if (data && (data.isProhibitedSite || data.isRestricted || String(data.businessType || "").toLowerCase() === "restricted site")) {
        const reason = data.restrictedReason || "Prohibited Category Detected";
        fillFormFields(data);
        renderPreview(data);
        updateStatus(`⛔ PROHIBITED CATEGORY / WORD DETECTED: ${reason}. Website Status set to Not Working (all fields cleared).`, "error");
        showRestrictedBanner(reason);
        return;
      }

      renderPreview(data);
      const fillReport = fillFormFields(data);
      if (data.websiteStatus === "Not Working") {
        const msg = data.isShopCartSite
          ? `⚠️ Online Purchase / Shopping Cart detected (${data.shopCartReason || "Shopping Cart"}). Status set to Not Working (auto-submitting...).`
          : (data.isDisallowedBusinessType
            ? `⚠️ ${data.disallowedReason || "Business Type outside allowed scope (Manufacturer to Wholesaler only)"}. Status set to Not Working (auto-submitting...).`
            : `⚠️ Website Status set to Not Working (all other fields cleared; auto-submitting...).`);
        updateStatus(msg, "warning");
      } else {
        // CRITICAL INSTRUCTION: "if working site stop to submit button"
        // STOP auto-pipeline immediately! DO NOT auto-submit working sites.
        stopAutoQueuePipeline(data.websiteStatus === "Redirect Site" ? "Redirect Site found" : "Working site found");

        // Highlight Submit button and scroll into view for user's manual review
        const submitBtn = document.getElementById("btnSubmitForm") ||
          document.getElementById("btnSubmit") ||
          document.getElementById("submitForm") ||
          document.querySelector('button[type="submit"], input[type="submit"]') ||
          Array.from(document.querySelectorAll('button, input[type="button"]')).find(b => {
            const t = (b.textContent || b.value || "").trim().toLowerCase();
            return t === "submit" || (t.includes("submit") && !t.includes("reset") && !t.includes("cancel"));
          });

        if (submitBtn) {
          submitBtn.classList.remove("ai-submit-ready-highlight");
          void submitBtn.offsetWidth; // trigger reflow
          submitBtn.classList.add("ai-submit-ready-highlight");
          submitBtn.scrollIntoView({ behavior: "smooth", block: "center" });

          submitBtn.addEventListener("click", () => {
            submitBtn.classList.remove("ai-submit-ready-highlight");
            if (autoQueueEnabled) {
              const currentSubmitted = getTargetUrl();
              if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({
                  autoQueuePipeline: {
                    active: true,
                    lastSubmittedUrl: currentSubmitted || "",
                    updatedAt: Date.now()
                  }
                });
              }
              setTimeout(() => {
                scheduleNextQueueAutoCrawl(currentSubmitted);
              }, 400);
            }
          }, { once: true });
        }

        const note = data._note || "Gemini AI";
        if (data.websiteStatus === "Redirect Site") {
          updateStatus(`🔄 Redirect Site detected! Pre-filled ${fillReport.filledCount} fields from destination URL (${note}). Stopped at Submit button for manual review.`, "success");
        } else {
          updateStatus(`✅ Working site found! Pre-filled ${fillReport.filledCount} fields (${note}). Stopped at Submit button for manual review.`, "success");
        }
      }
    } catch (err) {
      resetCrawlButtons();
      if (err.message && err.message.includes("Extension context invalidated")) {
        showReloadBanner();
        updateStatus("Please refresh page (F5)", "warning");
      } else {
        console.warn("[AI Assistant] Crawl exception occurred. Marking as Not Working as instructed:", err.message);
        const notWorkingData = {
          websiteStatus: "Not Working",
          businessType: "",
          companyProfile: "",
          companyName: "",
          countryName: "",
          companyAddress: "",
          state: "",
          city: "",
          emailId: "",
          secondaryEmailId: "",
          phoneNumber: "",
          numberOfProducts: "",
          productImages: "",
          numberOfProductDescriptions: "",
          _note: `Failed to fetch: ${err.message}`
        };
        fillFormFields(notWorkingData);
        renderPreview(notWorkingData);
        updateStatus(`⚠️ Failed to fetch website (${err.message}). Status set to Not Working (auto-submitting...).`, "warning");
      }
    } finally {
      isCrawlingInProgress = false;
      clearTimeout(safetyTimer);
      resetCrawlButtons();
    }
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
            <input type="checkbox" id="ai-widget-auto-queue-toggle" ${autoQueueEnabled ? "checked" : ""}>
            <span class="ai-widget-slider"></span>
          </label>
        </div>

        <div class="ai-widget-auto-row" style="margin-top: 4px;">
          <span>🛑 Auto-submit Not Working:</span>
          <label class="ai-widget-switch" title="Automatically submit Not Working records. Leave OFF to pause and study Not Working sites.">
            <input type="checkbox" id="ai-auto-submit-notworking-toggle" ${autoSubmitNotWorkingEnabled ? "checked" : ""}>
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
        if (pendingAutoSubmitTimer) {
          clearTimeout(pendingAutoSubmitTimer);
          pendingAutoSubmitTimer = null;
        }
        autoSubmitNotWorkingEnabled = false;
        const toggleEl = document.getElementById("ai-auto-submit-notworking-toggle");
        if (toggleEl) toggleEl.checked = false;
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set({ autoSubmitNotWorkingEnabled: false });
        }
        stopAutoQueuePipeline("User stopped auto-submit for study");
        stopBatchNotWorking("User stopped auto-submit for study");
        updateStatus("🛑 Auto-Submit STOPPED! You can now review and study the Not Working site.", "warning");
      });
    }

    const autoSubmitNotWorkingToggle = document.getElementById("ai-auto-submit-notworking-toggle");
    if (autoSubmitNotWorkingToggle) {
      autoSubmitNotWorkingToggle.checked = autoSubmitNotWorkingEnabled;
      autoSubmitNotWorkingToggle.addEventListener("change", () => {
        autoSubmitNotWorkingEnabled = autoSubmitNotWorkingToggle.checked;
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set({ autoSubmitNotWorkingEnabled: autoSubmitNotWorkingToggle.checked });
        }
        if (!autoSubmitNotWorkingEnabled) {
          if (pendingAutoSubmitTimer) {
            clearTimeout(pendingAutoSubmitTimer);
            pendingAutoSubmitTimer = null;
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
        const currentUrl = getTargetUrl();
        autoSubmitNotWorking(currentUrl);
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
        stopAutoQueuePipeline("User paused auto-queue");
        stopBatchNotWorking("User paused batch");
        updateStatus("⏸️ Process paused by user.", "idle");
      });
    }

    const batch10Btn = document.getElementById("ai-batch-10-btn");
    if (batch10Btn) {
      batch10Btn.addEventListener("click", () => {
        startBatchNotWorking(10);
      });
    }

    const submitNotWorkingBtn = document.getElementById("ai-submit-notworking-btn");
    if (submitNotWorkingBtn) {
      submitNotWorkingBtn.addEventListener("click", () => {
        markAndSubmitCurrentAsNotWorking("Manual 1-click Not Working");
      });
    }

    const batchAllBtn = document.getElementById("ai-batch-all-btn");
    if (batchAllBtn) {
      batchAllBtn.addEventListener("click", () => {
        startBatchNotWorking(-1);
      });
    }

    const widgetAutoToggle = document.getElementById("ai-widget-auto-queue-toggle");
    if (widgetAutoToggle) {
      widgetAutoToggle.checked = autoQueueEnabled;
      widgetAutoToggle.addEventListener("change", () => {
        autoQueueEnabled = widgetAutoToggle.checked;
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.set({ autoQueueEnabled: widgetAutoToggle.checked });
        }
        if (!autoQueueEnabled) {
          stopAutoQueuePipeline("User disabled auto-queue in widget");
          updateStatus("Auto-Queue turned OFF", "idle");
        } else {
          updateStatus("⚡ Auto-Queue enabled: Will crawl till Working site", "idle");
        }
      });
    }

    const crawlBtn = document.getElementById("ai-crawl-btn");
    if (crawlBtn) crawlBtn.addEventListener("click", triggerCrawlAndFill);

    const headerCrawlBtn = document.getElementById("ai-header-crawl-btn");
    if (headerCrawlBtn) {
      headerCrawlBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        triggerCrawlAndFill();
      });
    }

    const fillCachedBtn = document.getElementById("ai-fill-cached-btn");
    if (fillCachedBtn) {
      fillCachedBtn.addEventListener("click", () => {
        if (cachedExtractedData) {
          if (cachedExtractedData.isProhibitedSite || cachedExtractedData.isRestricted || String(cachedExtractedData.businessType || "").toLowerCase() === "restricted site") {
            const reason = cachedExtractedData.restrictedReason || "Prohibited Category Detected";
            fillFormFields(cachedExtractedData);
            renderPreview(cachedExtractedData);
            showRestrictedBanner(reason);
            updateStatus(`⛔ PROHIBITED CATEGORY / WORD DETECTED: ${reason}. Website Status set to Not Working (all fields cleared).`, "error");
            return;
          }
          fillFormFields(cachedExtractedData);
          updateStatus("Pre-filled form with extracted data.", "success");
        } else {
          updateStatus("⚠️ No extracted data yet. Click 'Auto-Crawl & Pre-Fill' to crawl.", "warning");
        }
      });
    }

    const clearBtn = document.getElementById("ai-clear-btn");
    if (clearBtn) clearBtn.addEventListener("click", clearFilledFields);
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
    const websiteInput = findWebsiteNameInput();

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
      triggerCrawlAndFill();
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

    const isDisallowed = !!data.isDisallowedBusinessType;
    const isRestr = !!(data.isProhibitedSite || data.isRestricted || String(data.businessType || "").toLowerCase() === "restricted site" || isDisallowed);
    const isRedirect = data.websiteStatus === "Redirect Site" || data.websiteStatus === "Redirect";
    const statusVal = isRestr
      ? `Not Working (${data.disallowedReason || data.restrictedReason || "Prohibited Category"})`
      : (data.isShopCartSite ? `${data.websiteStatus} (Purchase / Cart detected)` : (isRedirect ? `Redirect Site` : data.websiteStatus));
    const businessTypeVal = (isRestr || data.websiteStatus === "Not Working") ? "-" : (data.businessType || "-");

    const siteBaseUrl = data._finalUrl || data._originalUrl || (typeof getTargetUrl === "function" ? getTargetUrl() : "");

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

  // Listen for actions from popup or background (e.g. user clicked "AI Crawl" in popup)
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.action === "TRIGGER_CRAWL") {
        resetCrawlButtons();
        try { sendResponse({ success: true, started: true }); } catch (e) { }
        triggerCrawlAndFill();
        return false;
      }
      if (message && message.action === "START_BATCH_10_NOTWORKING") {
        startBatchNotWorking(10);
        try { sendResponse({ success: true }); } catch (e) { }
        return false;
      }
      if (message && message.action === "SUBMIT_1_NOTWORKING") {
        markAndSubmitCurrentAsNotWorking("Popup 1-click Not Working");
        try { sendResponse({ success: true }); } catch (e) { }
        return false;
      }
      if (message && message.action === "START_BATCH_ALL_NOTWORKING") {
        startBatchNotWorking(-1);
        try { sendResponse({ success: true }); } catch (e) { }
        return false;
      }
      if (message && message.action === "STOP_BATCH_NOTWORKING") {
        stopBatchNotWorking("Stopped from popup");
        try { sendResponse({ success: true }); } catch (e) { }
        return false;
      }
      if (message && message.action === "RESET_CRAWL_BUTTONS") {
        resetCrawlButtons();
        try { sendResponse({ success: true }); } catch (e) { }
        return false;
      }
      if (message && message.action === "GET_STATUS") {
        sendResponse({
          url: getTargetUrl(),
          isAlive: true
        });
        return true;
      }
      if (message && message.action === "EXTRACT_LIVE_DOM") {
        try {
          const domPayload = extractLiveDomPayload();
          sendResponse({ success: true, data: domPayload });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return true;
      }
    });
  }

  // Option A: Extract live rendered visual DOM, Schema.org JSON-LD, and metadata from active tab
  function extractLiveDomPayload() {
    const finalUrl = window.location.href;
    const title = document.title || "";
    const metaDesc = document.querySelector('meta[name="description"]')?.content || "";
    const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.content || "";
    const canonical = document.querySelector('link[rel="canonical"]')?.href || "";

    const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map(s => {
        try { return JSON.parse(s.innerText); } catch (e) { return null; }
      })
      .filter(Boolean);

    const renderedText = (document.body ? document.body.innerText : "")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .slice(0, 15000);

    const footerEl = document.querySelector("footer, [id*='footer'], [class*='footer']");
    const footerText = footerEl ? footerEl.innerText.slice(0, 2500) : "";

    const candidateLinks = Array.from(document.querySelectorAll("a[href]"))
      .map(a => ({ text: (a.innerText || "").trim(), href: a.href }))
      .filter(l => l.text && l.href && /^(http|https):/i.test(l.href))
      .filter(l => /(?:contact|about|profile|product|catalog|service)/i.test(l.href) || /(?:contact|about|profile|product|catalog|service)/i.test(l.text))
      .slice(0, 15);

    const productItems = document.querySelectorAll("[data-product], [class*='product-item'], [class*='product-card'], [class*='product-listing'], [class*='catalog-item'], .product, .woocommerce-loop-product");
    const productImages = document.querySelectorAll("img[src*='product'], img[alt*='product'], [class*='product'] img");

    return {
      finalUrl,
      title,
      metaDesc,
      ogSiteName,
      canonical,
      jsonLd: jsonLdScripts.slice(0, 5),
      renderedText,
      footerText,
      candidateLinks,
      liveProductCount: Math.min(productItems.length, 3),
      liveImageCount: Math.min(productImages.length, 3)
    };
  }

})();
