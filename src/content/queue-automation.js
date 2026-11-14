// Auto-queue pipeline scheduling, batch Not Working processing, and live DOM extraction.

(function (AIExt) {
  const state = (AIExt.state = AIExt.state || {});

  // =========================================================================
  // SUBMIT & CONFIRMATION HELPERS
  // =========================================================================

  function findSubmitButton() {
    return document.getElementById("btnSubmitForm") ||
      document.getElementById("btnSubmit") ||
      document.getElementById("submitForm") ||
      document.getElementById("btn-submit") ||
      document.getElementById("btn_submit") ||
      document.getElementById("submitBtn") ||
      document.getElementById("submit") ||
      document.querySelector('button[type="submit"]') ||
      document.querySelector('input[type="submit"]') ||
      document.querySelector('.btn-submit') ||
      document.querySelector('button[name="submit"]') ||
      document.querySelector('input[name="submit"]') ||
      document.querySelector('input[name="btnSubmit"]') ||
      Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).find(b => {
        if (b.closest("#ai-prefill-widget")) return false; // ignore assistant buttons
        const t = (b.textContent || b.value || "").trim().toLowerCase();
        return t === "submit" || (t.includes("submit") && !t.includes("not working") && !t.includes("from queue") && !t.includes("reset") && !t.includes("cancel"));
      });
  }

  function findModalConfirmButton() {
    // 1. Direct portal confirmation modal button IDs (e.g. dataextraction portal)
    // ONLY match if the modal is genuinely ACTIVE / VISIBLE (has class 'active' or 'show')
    const notWorkingModal = document.getElementById("notWorkingConfirmModal");
    if (notWorkingModal && (notWorkingModal.classList.contains("active") || notWorkingModal.classList.contains("show"))) {
      const notWorkingOk = document.getElementById("btnNotWorkingConfirmOk");
      if (notWorkingOk) return notWorkingOk;
    }

    const actionModal = document.getElementById("actionConfirmModal");
    if (actionModal && (actionModal.classList.contains("active") || actionModal.classList.contains("show"))) {
      const actionOk = document.getElementById("btnActionConfirmOk");
      if (actionOk) return actionOk;
    }

    // 2. SweetAlert / SweetAlert2
    const swalConfirm = document.querySelector(".swal2-confirm, .swal-button--confirm");
    if (swalConfirm && swalConfirm.offsetParent !== null) return swalConfirm;

    // 3. Active / visible modal overlays & dialogs
    const activeModals = Array.from(document.querySelectorAll('.modal-overlay.active, .modal.active, .modal.show, .swal2-container, .swal-overlay, div[role="dialog"].active, .confirmation-modal.active, div[class*="modal"].active'));
    for (const modal of activeModals) {
      if (modal.id === "ai-prefill-widget" || modal.closest("#ai-prefill-widget")) continue;
      const buttons = Array.from(modal.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
      const okBtn = buttons.find(b => {
        if (b.id === "btnNotWorkingConfirmCancel" || b.id === "btnCloseNotWorkingModal" || b.classList.contains("btn-confirm-cancel")) return false;
        const bText = (b.textContent || b.value || "").trim().toLowerCase();
        return b.id === "btnNotWorkingConfirmOk" || b.classList.contains("btn-confirm-ok") || bText === "ok" || bText === "✓ ok" || bText === "yes" || bText === "confirm" || bText === "proceed" || bText.includes("ok");
      });
      if (okBtn) return okBtn;
    }

    return null;
  }

  // =========================================================================
  // BATCH NOT WORKING PIPELINE (Separate options requested by user)
  // =========================================================================

  function triggerFromQueue() {
    // Strictly find ONLY genuine queue navigation buttons.
    // NEVER click "click here" buttons, external link buttons, or buttons that open new windows/tabs!
    const fromQueueBtn = document.getElementById("btnLoadNextQueueUrl") ||
      document.getElementById("btnNextQueueUrl") ||
      document.getElementById("btnNextQueue") ||
      document.getElementById("btnNext") ||
      document.getElementById("btn_next") ||
      document.getElementById("loadNext") ||
      document.getElementById("nextRecord") ||
      document.getElementById("btnFromQueue") ||
      document.getElementById("btn_from_queue") ||
      document.getElementById("fromQueue") ||
      document.getElementById("loadQueue") ||
      document.getElementById("btnLoadQueue") ||
      document.getElementById("nextQueue") ||
      document.getElementById("next") ||
      Array.from(document.querySelectorAll("button, a, input[type=button], input[type=submit]")).find(b => {
        if (b.closest("#ai-prefill-widget")) return false;
        const t = (b.textContent || b.value || "").replace(/\s+/g, " ").trim().toLowerCase();
        const idCls = `${b.id || ""} ${b.className || ""} ${b.title || ""} ${b.name || ""}`.toLowerCase();

        // Strictly reject any "click here", "open", "visit", or external link buttons
        if (t.includes("click here") || idCls.includes("clickhere") || idCls.includes("click-here")) return false;
        if (b.getAttribute("target") === "_blank" || (b.getAttribute("href") && b.getAttribute("href").startsWith("http"))) return false;
        if (idCls.includes("external") || idCls.includes("preview") || t.includes("preview") || t.includes("visit")) return false;

        // Strictly reject submit, reset, cancel
        if (t === "submit" || (t.includes("submit") && !t.includes("from queue") && !t.includes("next")) || t === "reset" || t.includes("reset") || t.includes("cancel")) return false;

        return t.includes("from queue") ||
          t.includes("load next") ||
          t.includes("next url") ||
          t.includes("next website") ||
          t.includes("next site") ||
          t.includes("next record") ||
          t.includes("next data") ||
          t.includes("next lead") ||
          t.includes("get url") ||
          t.includes("get next") ||
          t.includes("fetch next") ||
          t.includes("load queue") ||
          t === "next" ||
          t === "next >" ||
          t === "next >>" ||
          t === ">" ||
          (/\bqueue\b/.test(idCls) && !t.includes("manual")) ||
          (/\b(btn[-_]?next|next[-_]?btn)\b/.test(idCls));
      });
    if (fromQueueBtn) {
      console.log("[AI Assistant] Triggering 'From Queue' button:", fromQueueBtn);
      fromQueueBtn.click();
      return true;
    }
    return false;
  }

  function startBatchNotWorking(count = 10) {
    if (state.isBatchNotWorkingActive) {
      stopBatchNotWorking("Batch stopped by user.");
      return;
    }

    state.isBatchNotWorkingActive = true;
    state.batchNotWorkingRemaining = count;
    state.batchNotWorkingTotal = count;
    state.isAutoQueuePipelineActive = false; // separate pipeline
    if (state.pendingAutoSubmitTimer) {
      clearTimeout(state.pendingAutoSubmitTimer);
      state.pendingAutoSubmitTimer = null;
    }

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        batchNotWorking: {
          active: true,
          remaining: count,
          total: count,
          lastSubmittedUrl: "",
          updatedAt: Date.now()
        }
      });
    }

    const label = count === -1 ? "ALL" : count;
    console.log(`[AI Assistant] Starting Batch Not Working for ${label} sites...`);
    AIExt.updateStatus(`🚀 Auto-Submitting ${label} queue sites as Not Working...`, "loading");
    updateBatchButtonsState();

    processNextBatchNotWorkingItem();
  }

  function stopBatchNotWorking(msg = "") {
    state.isBatchNotWorkingActive = false;
    state.batchNotWorkingRemaining = 0;
    state.lastSubmittedUrl = "";
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(["batchNotWorking"]);
    }
    updateBatchButtonsState();
    AIExt.updateStatus(msg || "Batch Not Working stopped.", "idle");
  }

  function updateBatchButtonsState() {
    const b10 = document.getElementById("ai-batch-10-btn");
    const bAll = document.getElementById("ai-batch-all-btn");

    if (b10) {
      if (state.isBatchNotWorkingActive && state.batchNotWorkingRemaining > 0) {
        b10.textContent = `⏹️ Stop (${state.batchNotWorkingRemaining} left)`;
        b10.style.backgroundColor = "#dc2626";
        b10.style.color = "#ffffff";
      } else {
        b10.textContent = "⚡ Auto 10 Not Working";
        b10.style.backgroundColor = "";
        b10.style.color = "#b91c1c";
      }
    }
    if (bAll) {
      if (state.isBatchNotWorkingActive && state.batchNotWorkingRemaining === -1) {
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
    if (!state.isBatchNotWorkingActive) return;

    if (state.batchNotWorkingRemaining !== -1 && state.batchNotWorkingRemaining <= 0) {
      stopBatchNotWorking("🎉 Successfully auto-submitted 10 sites as Not Working!");
      return;
    }

    let currentUrl = (typeof AIExt.getTargetUrl === "function" ? AIExt.getTargetUrl() : "") || "";
    const lastSubmitted = (state.lastSubmittedUrl || "").trim().toLowerCase().replace(/\/+$/, "");
    const normCurrent = (currentUrl || "").trim().toLowerCase().replace(/\/+$/, "");

    // If current URL is empty or matches the last submitted URL, advance queue first!
    if (!normCurrent || (lastSubmitted && normCurrent === lastSubmitted)) {
      console.log(`[AI Assistant] Batch item URL needs advancement (current="${currentUrl}", lastSubmitted="${lastSubmitted}"). Triggering From Queue...`);
      triggerFromQueue();

      let attempts = 0;
      const queuePollTimer = setInterval(() => {
        attempts++;
        if (!state.isBatchNotWorkingActive) {
          clearInterval(queuePollTimer);
          return;
        }

        const freshUrl = (typeof AIExt.getTargetUrl === "function" ? AIExt.getTargetUrl() : "") || "";
        const freshNorm = freshUrl.trim().toLowerCase().replace(/\/+$/, "");

        // If fresh URL is present and different from last submitted, proceed!
        if (freshNorm && (!lastSubmitted || freshNorm !== lastSubmitted)) {
          clearInterval(queuePollTimer);
          setTimeout(() => {
            if (state.isBatchNotWorkingActive) {
              processNextBatchNotWorkingItem();
            }
          }, 200);
          return;
        }

        // Retry clicking From Queue every 6 attempts (~900ms)
        if (attempts % 6 === 0) {
          triggerFromQueue();
        }

        // After 20 attempts (~3s), if we have some URL even if identical or default, proceed with it
        if (attempts >= 20) {
          clearInterval(queuePollTimer);
          if (state.isBatchNotWorkingActive) {
            executeBatchNotWorkingSubmission(freshUrl || currentUrl);
          }
        }
      }, 150);
      return;
    }

    executeBatchNotWorkingSubmission(currentUrl);
  }

  function executeBatchNotWorkingSubmission(currentUrl) {
    if (!state.isBatchNotWorkingActive) return;

    const normSubmitted = (currentUrl || `item-${Date.now()}`).trim().toLowerCase().replace(/\/+$/, "");
    const remainingText = state.batchNotWorkingRemaining === -1 ? "ALL" : `${state.batchNotWorkingRemaining} left`;
    AIExt.updateStatus(`⚡ Batch Not Working [${remainingText}]: Submitting ${currentUrl || "queue site"}...`, "loading");

    // Pre-fill as Not Working: Rule 1 requires websiteStatus="Not Working" and all other 13 fields blank
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

    AIExt.fillFormFields(notWorkingData);
    if (typeof AIExt.renderPreview === "function") {
      AIExt.renderPreview(notWorkingData);
    }

    try {
      if (typeof AIExt !== "undefined" && typeof AIExt.sendRuntimeMessage === "function") {
        AIExt.sendRuntimeMessage({
          action: "RECORD_NON_WORKING_SITE",
          url: currentUrl,
          websiteStatus: "Not Working",
          reason: "Batch auto-submit as Not Working",
          errorUrl: currentUrl
        }).catch(() => {});
      }
    } catch (e) {}

    const nextRemaining = state.batchNotWorkingRemaining > 0 ? state.batchNotWorkingRemaining - 1 : -1;
    state.batchNotWorkingRemaining = nextRemaining;
    state.lastSubmittedUrl = currentUrl;
    updateBatchButtonsState();

    if (nextRemaining === 0) {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove(["batchNotWorking"]);
      }
    } else {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          batchNotWorking: {
            active: true,
            remaining: nextRemaining,
            total: state.batchNotWorkingTotal || 10,
            lastSubmittedUrl: currentUrl,
            updatedAt: Date.now()
          }
        });
      }
    }

    // ACTUALLY SUBMIT THE FORM & CONFIRM MODALS
    autoSubmitNotWorking(currentUrl);

    // If 10 items completed, stop batch after brief settle
    if (nextRemaining === 0) {
      setTimeout(() => {
        stopBatchNotWorking("🎉 Successfully auto-submitted 10 sites as Not Working!");
      }, 1200);
      return;
    }

    // Wait for submission, advance queue, and process next item (for SPA / AJAX portals)
    setTimeout(() => {
      if (!state.isBatchNotWorkingActive) return;

      let pollAttempts = 0;
      const pollTimer = setInterval(() => {
        pollAttempts++;
        if (!state.isBatchNotWorkingActive) {
          clearInterval(pollTimer);
          return;
        }

        let nextUrl = (typeof AIExt.getTargetUrl === "function" ? AIExt.getTargetUrl() : "") || "";
        const normNext = nextUrl.trim().toLowerCase().replace(/\/+$/, "");

        // If next URL is already loaded and different from submitted, advance!
        if (normNext && normNext !== normSubmitted && normNext.length > 3) {
          clearInterval(pollTimer);
          setTimeout(() => {
            if (state.isBatchNotWorkingActive) {
              processNextBatchNotWorkingItem();
            }
          }, 250);
          return;
        }

        // ONLY trigger 'From Queue' as fallback after 1.5 seconds (attempt >= 10), NEVER at attempt 1!
        if ((!normNext || normNext === normSubmitted) && (pollAttempts === 10 || pollAttempts === 18)) {
          console.log("[AI Assistant] URL not auto-advanced by portal after submit. Triggering queue button fallback...");
          triggerFromQueue();
        }

        if (pollAttempts >= 25) { // ~3.8 seconds max per item
          clearInterval(pollTimer);
          if (state.isBatchNotWorkingActive) {
            triggerFromQueue();
            setTimeout(() => {
              if (state.isBatchNotWorkingActive) {
                processNextBatchNotWorkingItem();
              }
            }, 300);
          }
        }
      }, 150);
    }, 400);
  }

  function markAndSubmitCurrentAsNotWorking(reason = "Manual 1-click Not Working") {
    state.isExplicitNotWorkingSubmit = true;
    const currentUrl = typeof AIExt.getTargetUrl === "function" ? AIExt.getTargetUrl() : "";
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
    AIExt.fillFormFields(notWorkingData);
    state.isExplicitNotWorkingSubmit = false;

    try {
      if (typeof AIExt !== "undefined" && typeof AIExt.sendRuntimeMessage === "function") {
        AIExt.sendRuntimeMessage({
          action: "RECORD_NON_WORKING_SITE",
          url: currentUrl,
          websiteStatus: "Not Working",
          reason: reason || "Manual 1-click Not Working",
          errorUrl: currentUrl
        }).catch(() => {});
      }
    } catch (e) {}
    if (typeof AIExt.renderPreview === "function") {
      AIExt.renderPreview(notWorkingData);
    }
    AIExt.updateStatus(`🚫 Marked as Not Working (${reason}) - Submitting...`, "warning");

    // Execute submission
    setTimeout(() => {
      autoSubmitNotWorking(currentUrl);
    }, 100);
  }

  function stopAutoQueuePipeline(reason = "") {
    state.isAutoQueuePipelineActive = false;
    if (state.autoQueuePollTimer) {
      clearInterval(state.autoQueuePollTimer);
      state.autoQueuePollTimer = null;
    }
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(["autoQueuePipeline"]);
    }
    const pauseBtn = document.getElementById("ai-pause-pipeline-btn");
    if (pauseBtn) pauseBtn.style.display = "none";
    console.log("[AI Assistant] Auto-queue pipeline stopped" + (reason ? `: ${reason}` : "."));
  }

  /**
   * Continuous Auto-Queue Engine:
   * Whenever '⚡ Auto-crawl till Working site' is active, continuously detects
   * when a new URL is loaded into the portal (via AJAX, page load, or queue advance)
   * and AUTOMATICALLY starts crawling immediately without requiring manual clicks.
   */
  function checkAndAutoTriggerQueueCrawl() {
    if (!state.autoQueueEnabled) return false;
    if (state.isCrawlingInProgress) return false;
    if (state.isBatchNotWorkingActive) return false;
    if (state.pendingAutoSubmitTimer) return false; // in 2s countdown before auto-submitting Not Working

    const currentUrl = typeof AIExt.getTargetUrl === "function" ? AIExt.getTargetUrl() : "";
    if (!currentUrl || currentUrl.trim().length < 4) {
      return false;
    }

    const normCurrent = currentUrl.trim().toLowerCase().replace(/\/+$/, "");
    const normLast = (state.lastProcessedUrl || "").trim().toLowerCase().replace(/\/+$/, "");

    // If identical to last processed URL, don't duplicate
    if (normCurrent === normLast) {
      return false;
    }

    // If waiting for manual review on a working site, but user loaded a DIFFERENT URL:
    // This proves the previous site was completed and portal advanced! Clear review wait state!
    state.isWaitingForUserWorkingReview = false;
    state.isAutoQueuePipelineActive = true;
    const pauseBtn = document.getElementById("ai-pause-pipeline-btn");
    if (pauseBtn) pauseBtn.style.display = "inline-flex";

    console.log(`[AI Assistant] ⚡ Auto-crawl till Working site: New URL detected ("${currentUrl}"). Automatically crawling...`);
    AIExt.updateStatus(`⚡ Auto-Queue: Crawling site (${currentUrl})...`, "loading");

    if (typeof AIExt.triggerCrawlAndFill === "function") {
      AIExt.triggerCrawlAndFill({ fromAutoQueue: true });
      return true;
    }
    return false;
  }

  function scheduleNextQueueAutoCrawl(submittedUrl) {
    if (state.isBatchNotWorkingActive) {
      console.log("[AI Assistant] Batch Not Working is active; skipping normal auto-crawl scheduling.");
      return;
    }

    if (state.autoQueuePollTimer) {
      clearInterval(state.autoQueuePollTimer);
      state.autoQueuePollTimer = null;
    }

    if (!state.autoQueueEnabled) {
      console.log("[AI Assistant] Auto-queue advance is disabled in settings.");
      stopAutoQueuePipeline("Feature disabled in settings");
      return;
    }

    state.isWaitingForUserWorkingReview = false;
    state.isAutoQueuePipelineActive = true;
    if (submittedUrl) {
      state.lastProcessedUrl = submittedUrl;
    }

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

    const normSubmitted = (submittedUrl || "").trim().toLowerCase().replace(/\/+$/, "");
    console.log(`[AI Assistant] Auto-queue pipeline listening for next record after "${normSubmitted}"...`);
    AIExt.updateStatus("⏳ Advancing to next queue record...", "loading");

    // Check immediately in case portal already updated the input
    if (checkAndAutoTriggerQueueCrawl()) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 160; // 24 seconds polling window

    state.autoQueuePollTimer = setInterval(() => {
      attempts++;
      if (!state.autoQueueEnabled) {
        clearInterval(state.autoQueuePollTimer);
        state.autoQueuePollTimer = null;
        return;
      }

      // Check if new URL has been loaded
      const curUrl = typeof AIExt.getTargetUrl === "function" ? AIExt.getTargetUrl() : "";
      const normCur = (curUrl || "").trim().toLowerCase().replace(/\/+$/, "");

      if (normCur && normCur !== normSubmitted && normCur.length > 3) {
        clearInterval(state.autoQueuePollTimer);
        state.autoQueuePollTimer = null;
        setTimeout(() => {
          if (state.autoQueueEnabled && !state.isCrawlingInProgress && !state.isBatchNotWorkingActive) {
            checkAndAutoTriggerQueueCrawl();
          }
        }, 200);
        return;
      }

      // Fallback: If still empty or unchanged after 1.5s (attempt >= 10), trigger queue button
      if ((!normCur || normCur === normSubmitted) && (attempts === 10 || attempts === 20)) {
        triggerFromQueue();
      }

      if (attempts >= maxAttempts) {
        clearInterval(state.autoQueuePollTimer);
        state.autoQueuePollTimer = null;
        console.log("[AI Assistant] Queue advance polling completed. Continuous watcher remains active.");
      }
    }, 150);
  }

  // Immediate capture listener: user clicking submit or "click here" unblocks review state
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button, input[type=submit], input[type=button], a");
    if (!btn) return;
    const txt = (btn.textContent || btn.value || "").trim().toLowerCase();
    if (txt === "submit" || txt.includes("submit") || txt === "click here" || txt.includes("click here")) {
      state.isWaitingForUserWorkingReview = false;
    }
  }, true);

  // Continuous Auto-Watcher: guarantees user NEVER has to manually click crawl when auto-queue is enabled!
  setInterval(() => {
    try {
      if (state.autoQueueEnabled && !state.isCrawlingInProgress) {
        // Check if portal has "Website data saved successfully" banner (as shown in user portal screenshot)
        const pageText = (document.body ? document.body.innerText || "" : "").toLowerCase();
        if (pageText.includes("website data saved successfully") || pageText.includes("data saved successfully")) {
          state.isWaitingForUserWorkingReview = false;
        }
        checkAndAutoTriggerQueueCrawl();
      }
    } catch (e) { }
  }, 300);

  // DOM MutationObserver for immediate reaction when AJAX injects new URL
  try {
    const queueDomObserver = new MutationObserver(() => {
      if (state.autoQueueEnabled && !state.isCrawlingInProgress) {
        checkAndAutoTriggerQueueCrawl();
      }
    });
    if (typeof document !== "undefined" && (document.documentElement || document.body)) {
      queueDomObserver.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["value"]
      });
    }
  } catch (e) { }

  /**
   * Automatically confirms custom confirmation popups/modals and submits the form
   * specifically for "Not Working" status (per instruction: "for notworking autosubmit").
   * For "Working" sites, submission is NEVER automatic so the user can manually review.
   */
  function autoSubmitNotWorking(specificUrl) {
    const submittedUrl = specificUrl || (typeof AIExt.getTargetUrl === "function" ? AIExt.getTargetUrl() : "");
    console.log(`[AI Assistant] Auto-submitting 'Not Working' record for: ${submittedUrl}...`);

    // Ensure pipeline state is preserved across form submission reload!
    if (state.autoQueueEnabled && !state.isBatchNotWorkingActive) {
      state.isAutoQueuePipelineActive = true;
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

    const normSubmitted = (submittedUrl || "").trim().toLowerCase().replace(/\/+$/, "");

    const doSubmit = () => {
      const submitBtn = findSubmitButton();
      if (submitBtn) {
        console.log("[AI Assistant] Auto-clicked Submit button for 'Not Working' status:", submitBtn);
        submitBtn.click();
      }
    };

    const confirmModalIfPresent = () => {
      const okBtn = findModalConfirmButton();
      if (okBtn) {
        console.log("[AI Assistant] Auto-confirmed 'Not Working' confirmation modal:", okBtn);
        okBtn.click();
        return true;
      }
      return false;
    };

    // 1. Immediately confirm modal if already popped up from setting dropdown to "Not Working"
    confirmModalIfPresent();

    // 2. Initial submit attempt
    setTimeout(doSubmit, 50);

    // 3. Iterative coordination: poll modal & ensure form submission actually finishes
    let pollCount = 0;
    const maxPolls = 25; // ~3.5s max
    const submitCoordTimer = setInterval(() => {
      pollCount++;

      // If URL has already changed, record was saved and portal advanced!
      const curUrl = (typeof AIExt.getTargetUrl === "function" ? AIExt.getTargetUrl() : "") || "";
      const normCur = curUrl.trim().toLowerCase().replace(/\/+$/, "");
      if (normCur && normSubmitted && normCur !== normSubmitted) {
        clearInterval(submitCoordTimer);
        return;
      }

      // Check and confirm any modal (form-select or form-submit)
      const modalConfirmed = confirmModalIfPresent();

      // If modal was just confirmed, wait 80ms and check if we need to click submit.
      // (If context was form-submit, clicking OK already saved the record!)
      if (modalConfirmed) {
        setTimeout(() => {
          const freshUrl = (typeof AIExt.getTargetUrl === "function" ? AIExt.getTargetUrl() : "") || "";
          const freshNorm = freshUrl.trim().toLowerCase().replace(/\/+$/, "");
          // CRITICAL: Only click submit if still on the submitted URL and no modal is active!
          // NEVER click submit if portal already moved to next URL!
          if (freshNorm === normSubmitted && !findModalConfirmButton()) {
            doSubmit();
          }
        }, 80);
      } else if (pollCount % 4 === 0) {
        // Re-try clicking submit if modal is closed and URL has not changed
        if (!findModalConfirmButton()) {
          doSubmit();
        }
      }

      if (pollCount >= maxPolls) {
        clearInterval(submitCoordTimer);
      }
    }, 140);

    // Queue progression: ONLY for normal auto-crawl pipeline, NEVER during batch Not Working!
    if (!state.isBatchNotWorkingActive) {
      scheduleNextQueueAutoCrawl(submittedUrl);
    }
  }

  /**
   * Capitalizes the first letter of every word (Title Case) per instruction: "All words come start with Captial make it"
   * Preserves standard corporate acronyms (USA, UK, PT, CV, SDN BHD, etc.).
   */

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

  // Global capturing submit listener for auto-queue progression across all portal workflows
  document.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("button, input[type=submit], input[type=button], .btn-submit") : null;
    if (!btn || btn.closest("#ai-prefill-widget")) return;
    const txt = (btn.textContent || btn.value || "").trim().toLowerCase();
    const isSubmit = btn.type === "submit" || (btn.id && btn.id.toLowerCase().includes("submit")) || (btn.className && typeof btn.className === "string" && btn.className.toLowerCase().includes("submit")) || txt === "submit" || (txt.includes("submit") && !txt.includes("reset") && !txt.includes("cancel"));
    if (isSubmit) {
      state.isWaitingForUserWorkingReview = false;
      const curUrl = typeof AIExt.getTargetUrl === "function" ? AIExt.getTargetUrl() : "";
      if (curUrl) state.lastProcessedUrl = curUrl;
      if (state.autoQueueEnabled && !state.isBatchNotWorkingActive) {
        state.isAutoQueuePipelineActive = true;
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({
            autoQueuePipeline: {
              active: true,
              lastSubmittedUrl: curUrl || "",
              updatedAt: Date.now()
            }
          });
        }
        setTimeout(() => {
          if (state.autoQueueEnabled && !state.isBatchNotWorkingActive) {
            scheduleNextQueueAutoCrawl(curUrl);
          }
        }, 300);
      }
    }
  }, true);

  // Form submit listener for keyboard / programmatic form submits
  document.addEventListener("submit", (e) => {
    if (e.target && e.target.closest && e.target.closest("#ai-prefill-widget")) return;
    state.isWaitingForUserWorkingReview = false;
    const curUrl = typeof AIExt.getTargetUrl === "function" ? AIExt.getTargetUrl() : "";
    if (curUrl) state.lastProcessedUrl = curUrl;
    if (state.autoQueueEnabled && !state.isBatchNotWorkingActive) {
      state.isAutoQueuePipelineActive = true;
      setTimeout(() => {
        if (state.autoQueueEnabled && !state.isBatchNotWorkingActive) {
          scheduleNextQueueAutoCrawl(curUrl);
        }
      }, 300);
    }
  }, true);

  Object.assign(AIExt, {
    triggerFromQueue,
    startBatchNotWorking,
    stopBatchNotWorking,
    updateBatchButtonsState,
    processNextBatchNotWorkingItem,
    markAndSubmitCurrentAsNotWorking,
    stopAutoQueuePipeline,
    checkAndAutoTriggerQueueCrawl,
    scheduleNextQueueAutoCrawl,
    autoSubmitNotWorking,
    findSubmitButton,
    findModalConfirmButton,
    extractLiveDomPayload
  });
})(globalThis.__AI_EXTENSION__ = globalThis.__AI_EXTENSION__ || {});
