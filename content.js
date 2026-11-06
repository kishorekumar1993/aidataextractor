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

  // Resilient message sender preventing any unhandled Promise rejections with auto-retry
  function sendRuntimeMessage(message, retryCount = 1) {
    return new Promise((resolve) => {
      if (!isExtensionAlive()) {
        showReloadBanner();
        return resolve({ success: false, error: "Extension context invalidated. Please refresh this page (F5).", isExtensionError: true });
      }

      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            const err = chrome.runtime.lastError.message || "Unknown error";
            if (err.includes("Extension context invalidated")) {
              showReloadBanner();
              return resolve({ success: false, error: err, isExtensionError: true });
            }
            // Auto-retry once on service worker wakeup/port disconnect
            if (retryCount > 0 && (err.includes("message channel closed") || err.includes("Could not establish connection"))) {
              console.warn(`[AI Assistant] Service worker message port closed (${err}). Waking worker and retrying...`);
              setTimeout(() => {
                sendRuntimeMessage(message, retryCount - 1).then(resolve);
              }, 400);
              return;
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

  function initAssistant() {
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

      // 4. Country alias fallbacks (Turkiye <-> Turkey, NZ <-> New Zealand, MY <-> Malaysia, ID <-> Indonesia, USA <-> United States)
      if (matchedIndex === -1) {
        if (targetClean === "turkiye" || targetClean === "türkiye") {
          for (let i = 0; i < element.options.length; i++) {
            const opt = element.options[i];
            const val = (opt.value || "").trim().toLowerCase();
            const txt = (opt.text || "").trim().toLowerCase();
            if (val === "turkey" || txt === "turkey" || val === "türkiye" || txt === "türkiye") {
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

    // Auto-approve native confirm dialogs in MAIN world so they don't block
    try {
      const s = document.createElement("script");
      s.textContent = "window.confirm = function() { return true; }; window.alert = function() { return true; };";
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    } catch (e) { }

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
      "PT", "CV", "UD", "TBK", "RT", "RW", "DKI", "DI", "BMW", "IBM", "B2B", "B2C", "IT", "SDN", "BHD", "LTD", "PLC", "LLC", "INC", "CORP"
    ]);
    let s = str.replace(/['’`]\s*s\b/gi, "'s");
    return s.replace(/[\p{L}\p{N}]+/gu, function (word, offset, fullStr) {
      if (offset > 0 && fullStr[offset - 1] === "'" && word.toLowerCase() === "s") {
        return "s";
      }
      const upper = word.toUpperCase();
      if (upperAcronyms.has(upper)) return upper;
      if (/^GmbH$/i.test(word)) return "GmbH";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }

  /**
   * Rule 4: Cleans and formats company name per QC requirements:
   * - Remove brackets while preserving inner text
   * - Keep country name as it is
   * - Preserve commas and dots (e.g. U.S., Co., Ltd.)
   * - Remove any special characters from beginning and end
   * - Apply Title Case
   */
  function cleanCompanyName(name) {
    if (!name || typeof name !== "string") return "";
    let n = name.trim();
    // Remove brackets while preserving inner text
    n = n.replace(/[\(\[\{]\s*([^\)\]\}]+?)\s*[\)\]\}]/g, " $1 ");
    n = n.replace(/[\(\)\[\]\{\}]/g, " ");
    // Remove any special characters from beginning
    n = n.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
    // Remove trailing special characters (symbols, dashes, colons, semicolons, commas, slashes, quotes)
    n = n.replace(/[,;:\-_|/\\~*#@^"'“”‘’«»`]+$/g, "").trim();
    n = n.replace(/\.{2,}$/g, ".");
    n = n.replace(/[^a-zA-Z0-9.\u00C0-\u024F]+$/gu, "").trim();
    n = n.replace(/(?<![\p{L}\p{N}])\.+$/gu, "").trim();
    n = n.replace(/[,;]+$/g, "").trim();
    n = n.replace(/\s+/g, " ").trim();
    return toTitleCase(n);
  }

  function fillFormFields(data) {
    if (!data) return { filledCount: 0 };
    const elements = detectFormElements();
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

    const isProhibitedOrRestricted = !!(data.isProhibitedSite || data.isRestricted || String(data.businessType || "").toLowerCase() === "restricted site" || isDisallowedType || data.isDisallowedBusinessType);

    // CRITICAL QC RULE:
    // When Website Status is NOT "Working" and NOT "Redirect Site" (Not Working, Non English, Flash, Domain Expired, or prohibited category detected),
    // select the respective status and clear/leave empty ALL other fields!
    // NOTE: "Redirect Site" is a WORKING website that redirected to a new domain (Rule 13).
    // All 14 fields MUST be filled with the company data from the final redirected URL!
    const isNonWorkingStatus = data.websiteStatus &&
      data.websiteStatus !== "Working" &&
      data.websiteStatus !== "Redirect Site" &&
      data.websiteStatus !== "Redirect";
    if (isNonWorkingStatus || isProhibitedOrRestricted) {
      const targetStatus = isProhibitedOrRestricted ? "Not Working" : (data.websiteStatus || "Not Working");
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

    // 4. Company Name (Rule 4: Full form, remove brackets, preserve country, commas & dots, clean boundary special chars)
    if (elements.companyName && data.companyName) {
      const formattedName = cleanCompanyName(data.companyName);
      if (setInputValue(elements.companyName, formattedName)) {
        highlightField(elements.companyName);
        filledCount++;
      }
    }

    // 5. Country Name (All words start with Capital)
    if (elements.countryName && data.countryName) {
      let formattedCountry = toTitleCase(data.countryName);
      if (/united\s*states/i.test(formattedCountry) || /^usa?$/i.test(formattedCountry.trim())) {
        formattedCountry = "United States Of America";
      } else if (/\b(?:turkey|t[uü]rkiye)\b/i.test(formattedCountry)) {
        formattedCountry = "Turkiye";
      } else if (/\b(?:malaysia|federation\s*of\s*malaysia|persekutuan\s*malaysia)\b/i.test(formattedCountry) || /^(?:my|mys)$/i.test(formattedCountry.trim())) {
        formattedCountry = "Malaysia";
      } else if (/\b(?:indonesia|republic\s*of\s*indonesia|republik\s*indonesia)\b/i.test(formattedCountry) || /^(?:id|idn|ri)$/i.test(formattedCountry.trim())) {
        formattedCountry = "Indonesia";
      } else if (/\b(?:new\s*zealand|aotearoa)\b/i.test(formattedCountry) || /^(?:nz|nzl)$/i.test(formattedCountry.trim())) {
        formattedCountry = "New Zealand";
      }
      const isSelect = elements.countryName.tagName && elements.countryName.tagName.toLowerCase() === "select";
      const success = isSelect ? setSelectValue(elements.countryName, formattedCountry) : setInputValue(elements.countryName, formattedCountry);
      if (success) {
        highlightField(elements.countryName);
        filledCount++;
      }
    }

    // 6. Company Address (Ensure comma before state, address ending must not have comma or point, and all words start with Capital)
    if (elements.companyAddress && data.companyAddress) {
      let cleanAddress = String(data.companyAddress).trim();
      // Ensure comma after premise indicators (Lot, Plot, Unit, Suite, Bldg, Building, Level, Floor, Block, Kav)
      cleanAddress = cleanAddress.replace(/(^|[,\s])\b(lot|plot|unit|suite|ste|bldg|building|floor|fl|flr|level|block|blk|apartment|apt|flat|shed|warehouse|factory|kav|kavling)\s+((?:pt\s*)?[A-Za-z0-9\-\/]+(?:\s*(?:&|and|,)\s*(?:pt\s*)?[A-Za-z0-9\-\/]+)*)\s+(?=(?:no\.?|nos\.?|number|#)?\s*[A-Za-z0-9])/gi, "$1$2 $3, ");
      // Ensure comma after street types when followed by word
      const streetSuffixes = "(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Caddesi|Bulvari|Sokak|Strasse|Calle|Avenida|Viale|Corso)";
      const nonStreetLookahead = "(?!\\s+(?:East|West|North|South|Northeast|Northwest|Southeast|Southwest|Extension|Ext|Road|Street|Avenue|Lane|Drive|Place|Close|Court|Terrace|Cres|Dr|Rd|St|Ave|Ln|Blvd|Hwy|Ct|Pl)\\b)";
      const streetSepRegex = new RegExp(`\\b(${streetSuffixes})${nonStreetLookahead}\\s+([A-Z][a-z0-9\\u00C0-\\u024F]+)`, "g");
      cleanAddress = cleanAddress.replace(streetSepRegex, "$1, $2");
      cleanAddress = cleanAddress.replace(/\s+,/g, ",").replace(/,\s*,/g, ", ").replace(/,\s*/g, ", ");
      cleanAddress = toTitleCase(cleanAddress).replace(/[,;.\s\-_/\\|]+$/g, "").trim();
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
      try { elements.secondaryEmailId.setAttribute("autocomplete", "off"); } catch (e) { }
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

  async function triggerCrawlAndFill() {
    if (!isExtensionAlive()) {
      showReloadBanner();
      updateStatus("Please refresh page (F5) to reconnect", "warning");
      return;
    }

    isAutoQueuePipelineActive = true;
    if (autoQueueEnabled && !isBatchNotWorkingActive) {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          autoQueuePipeline: {
            active: true,
            lastSubmittedUrl: getTargetUrl() || "",
            updatedAt: Date.now()
          }
        });
      }
      const pauseBtn = document.getElementById("ai-pause-pipeline-btn");
      if (pauseBtn) pauseBtn.style.display = "inline-flex";
    }
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

    // Safety timeout: ensure buttons are NEVER permanently disabled (25s)
    const safetyTimer = setTimeout(resetCrawlButtons, 25000);

    try {
      const response = await sendRuntimeMessage({ action: "CRAWL_AND_EXTRACT", url: targetUrl });
      resetCrawlButtons();

      if (!response || !response.success) {
        const errorMsg = response?.error || "Unable to fetch or crawl website";
        const isExtError = !!response?.isExtensionError || /message\s*channel\s*closed|context\s*invalidated|could\s*not\s*establish\s*connection/i.test(errorMsg);

        if (isExtError) {
          // Internal Chrome extension communication glitch: DO NOT mark the site as Not Working!
          console.warn("[AI Assistant] Extension service worker communication issue:", errorMsg);
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
    const statusVal = isRestr
      ? `Not Working (${data.disallowedReason || data.restrictedReason || "Prohibited Category"})`
      : (data.isShopCartSite ? `${data.websiteStatus} (Purchase / Cart detected)` : data.websiteStatus);
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

    const items = [
      { key: "Status", val: statusVal, isAlert: isRestr || data.websiteStatus === "Not Working" },
      { key: "Error Keyword", val: errKeyword, isAlert: true },
      { key: "Error Source Link", val: errLink, isLink: true },
      { key: "Error Context", val: errSnippet ? `"...${errSnippet.replace(/^(\.\.\.)+/, '').replace(/(\.\.\.)+$/, '')}..."` : "", isSnippet: true },
      { key: "Business Type", val: businessTypeVal },
      { key: "BT Keyword", val: btKeyword, isHighlight: true },
      { key: "BT Source Link", val: btLink, isLink: true },
      { key: "BT Context", val: btSnippet ? `"...${btSnippet.replace(/^(\.\.\.)+/, '').replace(/(\.\.\.)+$/, '')}..."` : "", isSnippet: true },
      { key: "Company Profile", val: isRestr ? "-" : data.companyProfile },
      { key: "Company Name", val: isRestr ? "-" : cleanCompanyName(data.companyName) },
      { key: "Name Source Link", val: nameLink, isLink: true },
      { key: "Country", val: isRestr ? "-" : toTitleCase(data.countryName) },
      { key: "Address", val: isRestr ? "-" : toTitleCase(data.companyAddress) },
      { key: "Address Source Link", val: addrLink, isLink: true },
      { key: "State", val: isRestr ? "-" : data.state },
      { key: "City", val: isRestr ? "-" : data.city },
      { key: "Email", val: isRestr ? "-" : data.emailId },
      { key: "Primary Email Link", val: primaryEmailLink, isLink: true },
      { key: "Secondary Email", val: isRestr ? "-" : (data.secondaryEmailId || "(None)") },
      { key: "Sec Email Link", val: secEmailLink, isLink: true },
      { key: "Phone", val: isRestr ? "-" : data.phoneNumber },
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
      if (item.key === "Sec Email Link" && (!data.secondaryEmailId || data.secondaryEmailId === "(None)" || isRestr)) return;

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
        triggerCrawlAndFill()
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: err?.message || String(err) }));
        return true; // Keep message channel open for async response
      }
      if (message && message.action === "START_BATCH_10_NOTWORKING") {
        startBatchNotWorking(10);
        sendResponse({ success: true });
        return true;
      }
      if (message && message.action === "SUBMIT_1_NOTWORKING") {
        markAndSubmitCurrentAsNotWorking("Popup 1-click Not Working");
        sendResponse({ success: true });
        return true;
      }
      if (message && message.action === "START_BATCH_ALL_NOTWORKING") {
        startBatchNotWorking(-1);
        sendResponse({ success: true });
        return true;
      }
      if (message && message.action === "STOP_BATCH_NOTWORKING") {
        stopBatchNotWorking("Stopped from popup");
        sendResponse({ success: true });
        return true;
      }
      if (message && message.action === "RESET_CRAWL_BUTTONS") {
        resetCrawlButtons();
        sendResponse({ success: true });
        return true;
      }
      if (message && message.action === "GET_STATUS") {
        sendResponse({
          url: getTargetUrl(),
          isAlive: true
        });
        return true;
      }
    });
  }

})();
