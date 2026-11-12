// Content Script Entry Point: Coordinates AI crawling, portal detection, and form pre-filling.
// Modular helpers are loaded prior to this file via manifest.json (src/shared/* and src/content/*).

(function (AIExt) {
  console.log("AI Web Crawler & Pre-Fill Assistant active on:", window.location.href);
  const state = (AIExt.state = AIExt.state || {});

  function initAssistant() {
    if (!AIExt.isDataEntryPage()) {
      return;
    }
    AIExt.ensureAiCrawlButtonsVisible();
    AIExt.attachFieldObservers();

    // Fast retries to catch dynamic / async / SPA form loads immediately
    const checkDelays = [80, 250, 500, 900, 1500, 2500, 4000];
    checkDelays.forEach((delay) => {
      setTimeout(AIExt.ensureAiCrawlButtonsVisible, delay);
    });

    // Continuous heartbeat every 1500ms to guarantee floating widget and buttons are always visible
    setInterval(AIExt.ensureAiCrawlButtonsVisible, 1500);

    // Check if auto-queue or batch Not Working pipeline was active across page reloads/navigations
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["batchNotWorking", "autoQueuePipeline"], (res) => {
        const batch = res?.batchNotWorking;
        // Resume if batch was active within the last 5 minutes
        if (batch && batch.active && (batch.remaining > 0 || batch.remaining === -1) && (Date.now() - (batch.updatedAt || 0) < 300000)) {
          state.isBatchNotWorkingActive = true;
          state.batchNotWorkingRemaining = batch.remaining;
          state.isAutoQueuePipelineActive = false;
          AIExt.updateBatchButtonsState();
          console.log(`[AI Assistant] Resumed Batch Not Working from storage: ${state.batchNotWorkingRemaining} items left.`);
          AIExt.updateStatus(`⚡ Resuming Batch Not Working (${state.batchNotWorkingRemaining === -1 ? "ALL" : state.batchNotWorkingRemaining + " left"})...`, "loading");

          // Give dynamic fields a moment to settle before processing next item
          setTimeout(() => {
            if (state.isBatchNotWorkingActive) {
              AIExt.processNextBatchNotWorkingItem();
            }
          }, 700);
          return;
        } else if (batch) {
          chrome.storage.local.remove(["batchNotWorking"]);
        }

        // Resume "Auto-crawl till Working site" pipeline across page reloads (sync autoQueueEnabled first)
        const autoPipeline = res?.autoQueuePipeline;
        if (autoPipeline && autoPipeline.active && (Date.now() - (autoPipeline.updatedAt || 0) < 180000)) {
          const resumePipeline = (enabled) => {
            if (!enabled) {
              chrome.storage.local.remove(["autoQueuePipeline"]);
              return;
            }
            state.isAutoQueuePipelineActive = true;
            const pauseBtn = document.getElementById("ai-pause-pipeline-btn");
            if (pauseBtn) pauseBtn.style.display = "inline-flex";
            console.log(`[AI Assistant] Resumed Auto-Queue Pipeline from storage. Last submitted: "${autoPipeline.lastSubmittedUrl}"`);
            AIExt.updateStatus("⚡ Auto-Queue: Advancing to next site...", "loading");

            setTimeout(() => {
              if (state.isAutoQueuePipelineActive && state.autoQueueEnabled && !state.isBatchNotWorkingActive) {
                AIExt.scheduleNextQueueAutoCrawl(autoPipeline.lastSubmittedUrl);
              }
            }, 450);
          };

          if (chrome.storage.sync) {
            chrome.storage.sync.get({ autoQueueEnabled: true }, (syncRes) => {
              state.autoQueueEnabled = syncRes ? !!syncRes.autoQueueEnabled : state.autoQueueEnabled;
              resumePipeline(state.autoQueueEnabled);
            });
          } else {
            resumePipeline(state.autoQueueEnabled);
          }
        } else if (autoPipeline) {
          chrome.storage.local.remove(["autoQueuePipeline"]);
        }
      });
    }

    setTimeout(() => {
      const initialUrl = AIExt.getTargetUrl();
      if (initialUrl) {
        AIExt.updateDetectedUrlDisplay();
        console.log("Detected Website Name URL on load:", initialUrl);
        if (state.autoQueueEnabled && !state.isCrawlingInProgress && !state.isBatchNotWorkingActive) {
          console.log("[AI Assistant] ⚡ Auto-crawl enabled on load. Auto-starting crawl...");
          if (typeof AIExt.checkAndAutoTriggerQueueCrawl === "function") {
            AIExt.checkAndAutoTriggerQueueCrawl();
          }
        }
      }
    }, 600);
  }


  async function triggerCrawlAndFill(options = {}) {
    const isFromAutoQueue = !!(options && options.fromAutoQueue === true);
    if (state.isCrawlingInProgress) {
      console.log("[AI Assistant] Crawl already active. Providing user visual feedback.");
      const quickBtn = document.getElementById("ai-quick-btn");
      if (quickBtn) {
        quickBtn.style.transform = "scale(0.96)";
        setTimeout(() => { quickBtn.style.transform = ""; }, 150);
      }
      AIExt.updateStatus("⏳ Crawl already in progress... please wait", "loading");
      return;
    }
    if (!AIExt.isExtensionAlive()) {
      AIExt.showReloadBanner();
      AIExt.updateStatus("Please refresh page (F5) to reconnect", "warning");
      return;
    }

    state.isCrawlingInProgress = true;

    // If auto-queue is enabled, keep pipeline active across this crawl!
    if (state.autoQueueEnabled) {
      state.isAutoQueuePipelineActive = true;
      const pauseBtn = document.getElementById("ai-pause-pipeline-btn");
      if (pauseBtn) pauseBtn.style.display = "inline-flex";
    } else if (!isFromAutoQueue) {
      AIExt.stopAutoQueuePipeline("Manual crawl with auto-queue disabled");
    }
    let targetUrl = AIExt.getTargetUrl();
    if (!targetUrl && typeof AIExt.triggerFromQueue === "function") {
      AIExt.triggerFromQueue();
      targetUrl = AIExt.getTargetUrl();
    }

    if (!targetUrl) {
      state.isCrawlingInProgress = false;
      const inputEl = typeof AIExt.findWebsiteNameInput === "function" ? AIExt.findWebsiteNameInput() : null;
      if (inputEl) {
        inputEl.style.outline = "2px solid #ef4444";
        inputEl.focus();
        setTimeout(() => { inputEl.style.outline = ""; }, 2000);
      }
      AIExt.updateStatus("⚠️ Website Name URL not found. Click 'click here' or enter a URL.", "error");
      AIExt.resetCrawlButtons();
      return;
    }

    state.lastProcessedUrl = targetUrl;
    AIExt.updateStatus(`Crawling ${targetUrl} (Contact Page / Footer address)...`, "loading");

    const crawlBtn = document.getElementById("ai-crawl-btn");
    const headerCrawlBtn = document.getElementById("ai-header-crawl-btn");
    const quickBtn = document.getElementById("ai-quick-btn");
    if (crawlBtn) {
      crawlBtn.disabled = true;
      crawlBtn.classList.add("ai-btn-crawling");
      crawlBtn.innerHTML = '<span class="ai-spinner-icon"></span> <span>Crawling Site...</span>';
    }
    if (headerCrawlBtn) {
      headerCrawlBtn.disabled = true;
      headerCrawlBtn.classList.add("ai-btn-crawling");
      headerCrawlBtn.innerHTML = '<span class="ai-spinner-icon"></span> <span>Crawling...</span>';
    }
    if (quickBtn) {
      quickBtn.disabled = true;
      quickBtn.classList.add("ai-btn-crawling");
      quickBtn.innerHTML = '<span class="ai-spinner-icon"></span> <span>Crawling Site...</span>';
    }

    // Safety timeout: ensure buttons are NEVER permanently disabled (30s)
    const safetyTimer = setTimeout(AIExt.resetCrawlButtons, 30000);

    try {
      const response = await AIExt.sendRuntimeMessage({
        action: "CRAWL_AND_EXTRACT",
        url: targetUrl,
        extractionMode: state.extractionMode || "ai_first"
      });
      AIExt.resetCrawlButtons();

      if (!response || !response.success) {
        const errorMsg = response?.error || "Unable to fetch or crawl website";
        const isExtError = !!response?.isExtensionError || /message\s*channel\s*closed|context\s*invalidated|could\s*not\s*establish\s*connection/i.test(errorMsg);

        if (isExtError) {
          // Internal Chrome extension communication glitch: DO NOT mark the site as Not Working!
          console.log("[AI Assistant] Extension service worker communication issue:", errorMsg);
          AIExt.updateStatus(`⚠️ Extension background busy (${errorMsg}). Please click AI Crawl & Fill again.`, "warning");
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
        AIExt.fillFormFields(notWorkingData);
        AIExt.renderPreview(notWorkingData);
        try {
          AIExt.sendRuntimeMessage({
            action: "RECORD_NON_WORKING_SITE",
            url: targetUrl,
            websiteStatus: "Not Working",
            reason: errorMsg,
            errorUrl: targetUrl
          }).catch(() => {});
        } catch (e) {}

        if (state.autoQueueEnabled || state.autoSubmitNotWorkingEnabled) {
          AIExt.updateStatus(`⚠️ Website unreachable (${errorMsg}). Status set to Not Working (auto-submitting in 2s...).`, "warning");
          if (state.pendingAutoSubmitTimer) clearTimeout(state.pendingAutoSubmitTimer);
          state.pendingAutoSubmitTimer = setTimeout(() => {
            state.pendingAutoSubmitTimer = null;
            AIExt.autoSubmitNotWorking(targetUrl);
          }, 2000);
        } else {
          AIExt.updateStatus(`⚠️ Website unreachable (${errorMsg}). Status set to Not Working.`, "warning");
        }
        return;
      }

      const data = response.data;
      state.cachedExtractedData = data;

      // STRICT QC: If AI Only mode was chosen and AI failed, block form prefill
      if (data && data._aiFailed && data._extractionMode === "ai_only") {
        AIExt.renderPreview(data);
        AIExt.updateStatus(`⚠️ AI Only Mode: AI extraction failed (${data._note || "AI Error"}). Form prefill prevented.`, "error");
        return;
      }

      // STRICT QC: If prohibited or restricted site, show proper error message, clear all fields, and select Not Working
      if (data && (data.isProhibitedSite || data.isRestricted || String(data.businessType || "").toLowerCase() === "restricted site")) {
        const reason = data.restrictedReason || "Prohibited Category Detected";
        AIExt.fillFormFields(data);
        AIExt.renderPreview(data);
        AIExt.showRestrictedBanner(reason);
        if (state.autoQueueEnabled || state.autoSubmitNotWorkingEnabled) {
          AIExt.updateStatus(`⛔ PROHIBITED CATEGORY DETECTED: ${reason}. Status set to Not Working (auto-submitting in 2s...).`, "error");
          if (state.pendingAutoSubmitTimer) clearTimeout(state.pendingAutoSubmitTimer);
          state.pendingAutoSubmitTimer = setTimeout(() => {
            state.pendingAutoSubmitTimer = null;
            AIExt.autoSubmitNotWorking(targetUrl);
          }, 2000);
        } else {
          AIExt.updateStatus(`⛔ PROHIBITED CATEGORY / WORD DETECTED: ${reason}. Website Status set to Not Working (all fields cleared).`, "error");
        }
        return;
      }

      AIExt.renderPreview(data);
      const fillReport = AIExt.fillFormFields(data);
      if (data.websiteStatus === "Not Working") {
        const msg = data.isShopCartSite
          ? `⚠️ Online Purchase / Shopping Cart detected (${data.shopCartReason || "Shopping Cart"}). Status set to Not Working.`
          : (data.isDisallowedBusinessType
            ? `⚠️ ${data.disallowedReason || "Business Type outside allowed scope (Manufacturer to Wholesaler only)"}. Status set to Not Working.`
            : `⚠️ Website Status set to Not Working (all other fields cleared).`);

        if (state.autoQueueEnabled || state.autoSubmitNotWorkingEnabled) {
          AIExt.updateStatus(`${msg} (auto-submitting in 2s...)`, "warning");
          if (state.pendingAutoSubmitTimer) clearTimeout(state.pendingAutoSubmitTimer);
          state.pendingAutoSubmitTimer = setTimeout(() => {
            state.pendingAutoSubmitTimer = null;
            AIExt.autoSubmitNotWorking(targetUrl);
          }, 2000);
        } else {
          AIExt.updateStatus(msg, "warning");
        }
      } else {
        // CRITICAL INSTRUCTION: "if working site stop to submit button"
        // STOP auto-pipeline and pause at submit button for manual user review
        state.isWaitingForUserWorkingReview = true;
        state.lastProcessedUrl = targetUrl;
        state.isAutoQueuePipelineActive = false;
        const pauseBtn = document.getElementById("ai-pause-pipeline-btn");
        if (pauseBtn) pauseBtn.style.display = "none";

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

          const formEl = submitBtn.closest("form") || document.querySelector("form");
          let submitHandled = false;
          const onWorkingSubmit = () => {
            if (submitHandled) return;
            submitHandled = true;
            state.isWaitingForUserWorkingReview = false;
            submitBtn.classList.remove("ai-submit-ready-highlight");
            document.removeEventListener("keydown", onCtrlEnterSubmit);
            const currentSubmitted = AIExt.getTargetUrl() || targetUrl;
            state.lastProcessedUrl = currentSubmitted;
            if (state.autoQueueEnabled) {
              state.isAutoQueuePipelineActive = true;
              if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({
                  autoQueuePipeline: {
                    active: true,
                    lastSubmittedUrl: currentSubmitted || "",
                    updatedAt: Date.now()
                  }
                });
              }
              AIExt.updateStatus("⏳ Website saved! Loading next URL...", "loading");
              setTimeout(() => {
                AIExt.scheduleNextQueueAutoCrawl(currentSubmitted);
              }, 300);
            }
          };
          const onCtrlEnterSubmit = (ev) => {
            if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
              onWorkingSubmit();
            }
          };

          submitBtn.addEventListener("click", onWorkingSubmit, { once: true });
          if (formEl) formEl.addEventListener("submit", onWorkingSubmit, { once: true });
          document.addEventListener("keydown", onCtrlEnterSubmit);
        }

        const note = data._note || "Gemini AI";
        const sourceTag = data._extractionSource === "ai"
          ? "🤖 AI"
          : (data._extractionSource === "own_crawl_fallback" ? "⚠️ Own Crawl (AI Fallback)" : "🕷️ Own Crawl");
        if (quickBtn) {
          quickBtn.classList.remove("ai-btn-crawling");
          quickBtn.classList.add("ai-btn-success");
          quickBtn.innerHTML = '<span>✅ Pre-Filled!</span>';
          setTimeout(() => {
            quickBtn.classList.remove("ai-btn-success");
            quickBtn.innerHTML = '🤖 AI Crawl & Fill';
          }, 1500);
        }
        if (data.websiteStatus === "Redirect Site") {
          AIExt.updateStatus(`🔄 Redirect Site detected! Pre-filled ${fillReport.filledCount} fields [${sourceTag}: ${note}]. Stopped at Submit button for manual review.`, "success");
        } else {
          AIExt.updateStatus(`✅ Working site found! Pre-filled ${fillReport.filledCount} fields [${sourceTag}: ${note}]. Stopped at Submit button for manual review.`, "success");
        }
      }
    } catch (err) {
      AIExt.resetCrawlButtons();
      if (err.message && err.message.includes("Extension context invalidated")) {
        AIExt.showReloadBanner();
        AIExt.updateStatus("Please refresh page (F5)", "warning");
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
          notWorkingReason: `Failed to fetch: ${err.message}`,
          errorSnippet: `Failed to fetch: ${err.message}`,
          _note: `Failed to fetch: ${err.message}`
        };
        AIExt.fillFormFields(notWorkingData);
        AIExt.renderPreview(notWorkingData);
        if (state.autoQueueEnabled || state.autoSubmitNotWorkingEnabled) {
          AIExt.updateStatus(`⚠️ Failed to fetch website (${err.message}). Status set to Not Working (auto-submitting in 2s...).`, "warning");
          if (state.pendingAutoSubmitTimer) clearTimeout(state.pendingAutoSubmitTimer);
          state.pendingAutoSubmitTimer = setTimeout(() => {
            state.pendingAutoSubmitTimer = null;
            AIExt.autoSubmitNotWorking(targetUrl);
          }, 2000);
        } else {
          AIExt.updateStatus(`⚠️ Failed to fetch website (${err.message}). Status set to Not Working.`, "warning");
        }
      }
    } finally {
      state.isCrawlingInProgress = false;
      clearTimeout(safetyTimer);
      AIExt.resetCrawlButtons();
    }
  }

  // Listen for actions from popup or background (e.g. user clicked "AI Crawl" in popup)
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.action === "TRIGGER_CRAWL") {
        AIExt.resetCrawlButtons();
        try { sendResponse({ success: true, started: true }); } catch (e) { }
        triggerCrawlAndFill();
        return false;
      }
      if (message && message.action === "START_BATCH_10_NOTWORKING") {
        AIExt.startBatchNotWorking(10);
        try { sendResponse({ success: true }); } catch (e) { }
        return false;
      }
      if (message && message.action === "SUBMIT_1_NOTWORKING") {
        AIExt.markAndSubmitCurrentAsNotWorking("Popup 1-click Not Working");
        try { sendResponse({ success: true }); } catch (e) { }
        return false;
      }
      if (message && message.action === "START_BATCH_ALL_NOTWORKING") {
        AIExt.startBatchNotWorking(-1);
        try { sendResponse({ success: true }); } catch (e) { }
        return false;
      }
      if (message && message.action === "STOP_BATCH_NOTWORKING") {
        AIExt.stopBatchNotWorking("Stopped from popup");
        try { sendResponse({ success: true }); } catch (e) { }
        return false;
      }
      if (message && message.action === "RESET_CRAWL_BUTTONS") {
        AIExt.resetCrawlButtons();
        try { sendResponse({ success: true }); } catch (e) { }
        return false;
      }
      if (message && message.action === "GET_STATUS") {
        sendResponse({
          url: AIExt.getTargetUrl(),
          isAlive: true
        });
        return true;
      }
      if (message && message.action === "EXTRACT_LIVE_DOM") {
        try {
          const domPayload = AIExt.extractLiveDomPayload();
          sendResponse({ success: true, data: domPayload });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return true;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAssistant);
  } else {
    initAssistant();
  }


  Object.assign(AIExt, {
    initAssistant,
    triggerCrawlAndFill
  });
})(globalThis.__AI_EXTENSION__ = globalThis.__AI_EXTENSION__ || {});
