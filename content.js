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
          state.batchNotWorkingTotal = batch.total || 10;
          state.lastSubmittedUrl = batch.lastSubmittedUrl || "";
          state.isAutoQueuePipelineActive = false;
          if (typeof AIExt.updateBatchButtonsState === "function") {
            AIExt.updateBatchButtonsState();
          }
          console.log(`[AI Assistant] Resumed Batch Not Working from storage: ${state.batchNotWorkingRemaining} items left. Last submitted: "${state.lastSubmittedUrl}"`);
          AIExt.updateStatus(`⚡ Resuming Batch Not Working (${state.batchNotWorkingRemaining === -1 ? "ALL" : state.batchNotWorkingRemaining + " left"})...`, "loading");

          // Give dynamic fields a moment to settle before processing next item
          setTimeout(() => {
            if (state.isBatchNotWorkingActive && typeof AIExt.processNextBatchNotWorkingItem === "function") {
              AIExt.processNextBatchNotWorkingItem();
            }
          }, 600);
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
      if (typeof AIExt.setQuickBtnState === "function") {
        AIExt.setQuickBtnState("warning", "⚠️ Refresh Page (F5)!");
      }
      if (typeof AIExt.showFloatingToast === "function") {
        AIExt.showFloatingToast("🔄 Extension updated. Please refresh page (F5) to reconnect!", "warning", 4000);
      }
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
        setTimeout(() => { inputEl.style.outline = ""; }, 2200);
      }
      if (typeof AIExt.setQuickBtnState === "function") {
        AIExt.setQuickBtnState("no_url", "⚠️ Enter URL First!");
      }
      if (typeof AIExt.showFloatingToast === "function") {
        AIExt.showFloatingToast("⚠️ Website Name is empty! Click 'click here' or enter URL first.", "warning", 3000);
      }
      AIExt.updateStatus("⚠️ Website Name URL not found. Click 'click here' or enter a URL.", "error");
      return;
    }

    state.lastProcessedUrl = targetUrl;
    if (typeof AIExt.setQuickBtnState === "function") {
      AIExt.setQuickBtnState("crawling", "🔄 Crawling Site...");
    }
    if (typeof AIExt.showFloatingToast === "function") {
      AIExt.showFloatingToast(`🚀 Crawling ${targetUrl}...`, "loading", 0);
    }
    AIExt.updateStatus(`Crawling ${targetUrl} (Contact Page / Footer address)...`, "loading");

    // Progress to AI extracting phase if background is processing deep AI extraction
    let progressTimer = setTimeout(() => {
      if (state.isCrawlingInProgress) {
        if (typeof AIExt.setQuickBtnState === "function") {
          AIExt.setQuickBtnState("extracting", "🤖 AI Extracting...");
        }
        if (typeof AIExt.showFloatingToast === "function") {
          AIExt.showFloatingToast(`🤖 AI Extracting business data from ${targetUrl}...`, "loading", 0);
        }
      }
    }, 2500);

    // Safety timeout: ensure buttons are NEVER permanently disabled (30s)
    const safetyTimer = setTimeout(AIExt.resetCrawlButtons, 30000);

    try {
      const response = await AIExt.sendRuntimeMessage({
        action: "CRAWL_AND_EXTRACT",
        url: targetUrl,
        extractionMode: state.extractionMode || "ai_first"
      });
      if (progressTimer) {
        clearTimeout(progressTimer);
        progressTimer = null;
      }

      if (!response || !response.success) {
        const errorMsg = response?.error || "Unable to fetch or crawl website";
        const isExtError = !!response?.isExtensionError || /message\s*channel\s*closed|context\s*invalidated|could\s*not\s*establish\s*connection/i.test(errorMsg);

        if (isExtError) {
          // Internal Chrome extension communication glitch: DO NOT mark the site as Not Working!
          console.log("[AI Assistant] Extension service worker communication issue:", errorMsg);
          if (typeof AIExt.setQuickBtnState === "function") {
            AIExt.setQuickBtnState("warning", "⚠️ Retry Click!");
          }
          if (typeof AIExt.showFloatingToast === "function") {
            AIExt.showFloatingToast(`⚠️ Extension background busy (${errorMsg}). Please click AI Crawl again.`, "warning", 3500);
          }
          AIExt.updateStatus(`⚠️ Extension background busy (${errorMsg}). Please click AI Crawl & Fill again.`, "warning");
          return;
        }

        console.warn("[AI Assistant] Website unreachable / failed to fetch. Marking as Not Working as instructed:", errorMsg);
        if (typeof AIExt.setQuickBtnState === "function") {
          AIExt.setQuickBtnState("marked_not_working", "🚫 Not Working (Unreachable)");
        }
        if (typeof AIExt.showFloatingToast === "function") {
          AIExt.showFloatingToast(`🚫 Website Unreachable -> Status set to Not Working`, "not_working", 3500);
        }
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
        if (typeof AIExt.setQuickBtnState === "function") {
          AIExt.setQuickBtnState("error", "⚠️ AI Failed");
        }
        if (typeof AIExt.showFloatingToast === "function") {
          AIExt.showFloatingToast(`⚠️ AI Only Mode: AI failed (${data._note || "AI Error"}).`, "warning", 3500);
        }
        AIExt.renderPreview(data);
        AIExt.updateStatus(`⚠️ AI Only Mode: AI extraction failed (${data._note || "AI Error"}). Form prefill prevented.`, "error");
        return;
      }

      // STRICT QC: If prohibited or restricted site, show proper error message, clear all fields, and select Not Working
      if (data && (data.isProhibitedSite || data.isRestricted || String(data.businessType || "").toLowerCase() === "restricted site")) {
        const reason = data.restrictedReason || "Prohibited Category Detected";
        if (typeof AIExt.setQuickBtnState === "function") {
          AIExt.setQuickBtnState("restricted", "⛔ Restricted Site!");
        }
        if (typeof AIExt.showFloatingToast === "function") {
          AIExt.showFloatingToast(`⛔ Restricted Category (${reason}) -> Marked Not Working`, "restricted", 4000);
        }
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
        const notWorkingShort = data.isShopCartSite ? "Shopping Cart" : (data.isDisallowedBusinessType ? "Disallowed Type" : "Not Working");
        if (typeof AIExt.setQuickBtnState === "function") {
          AIExt.setQuickBtnState("marked_not_working", `🚫 Not Working (${notWorkingShort})`);
        }
        if (typeof AIExt.showFloatingToast === "function") {
          AIExt.showFloatingToast(`🚫 Not Working (${data.notWorkingReason || notWorkingShort}) -> All fields cleared`, "not_working", 3500);
        }
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

        // Record Working website event into local storage
        try {
          AIExt.sendRuntimeMessage({
            action: "RECORD_WORKING_SITE",
            data: {
              url: targetUrl,
              websiteStatus: "Working",
              companyName: data.companyName || "",
              countryName: data.countryName || "",
              businessType: data.businessType || ""
            }
          }).catch(() => {});
        } catch (e) { }

        const note = data._note || "Gemini AI";
        const sourceTag = data._extractionSource === "ai"
          ? "🤖 AI"
          : (data._extractionSource === "own_crawl_fallback" ? "⚠️ Own Crawl (AI Fallback)" : "🕷️ Own Crawl");
        if (typeof AIExt.setQuickBtnState === "function") {
          AIExt.setQuickBtnState("success_working", "✅ Pre-Filled (Working)!");
        }
        if (typeof AIExt.showFloatingToast === "function") {
          AIExt.showFloatingToast(`✅ Working Site Pre-Filled (${fillReport.filledCount} fields)! Review and click Submit.`, "success", 4000);
        }
        if (data.websiteStatus === "Redirect Site") {
          AIExt.updateStatus(`🔄 Redirect Site detected! Pre-filled ${fillReport.filledCount} fields [${sourceTag}: ${note}]. Stopped at Submit button for manual review.`, "success");
        } else {
          AIExt.updateStatus(`✅ Working site found! Pre-filled ${fillReport.filledCount} fields [${sourceTag}: ${note}]. Stopped at Submit button for manual review.`, "success");
        }
      }
    } catch (err) {
      if (progressTimer) {
        clearTimeout(progressTimer);
        progressTimer = null;
      }
      if (err.message && err.message.includes("Extension context invalidated")) {
        if (typeof AIExt.setQuickBtnState === "function") {
          AIExt.setQuickBtnState("warning", "⚠️ Refresh Page (F5)!");
        }
        if (typeof AIExt.showFloatingToast === "function") {
          AIExt.showFloatingToast("🔄 Extension context invalidated. Please press F5 to refresh page!", "warning", 4000);
        }
        AIExt.showReloadBanner();
        AIExt.updateStatus("Please refresh page (F5)", "warning");
      } else {
        console.warn("[AI Assistant] Crawl exception occurred. Marking as Not Working as instructed:", err.message);
        if (typeof AIExt.setQuickBtnState === "function") {
          AIExt.setQuickBtnState("marked_not_working", "🚫 Not Working (Error)");
        }
        if (typeof AIExt.showFloatingToast === "function") {
          AIExt.showFloatingToast(`⚠️ Crawl Error: ${err.message}. Status set to Not Working.`, "warning", 3500);
        }
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
