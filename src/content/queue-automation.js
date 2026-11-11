// Auto-queue pipeline scheduling, batch Not Working processing, and live DOM extraction.

(function (AIExt) {
  const state = (AIExt.state = AIExt.state || {});

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
        const t = (b.textContent || b.value || "").replace(/\s+/g, " ").trim().toLowerCase();
        const idCls = `${b.id || ""} ${b.className || ""} ${b.title || ""}`.toLowerCase();
        return t.includes("from queue") || t.includes("load next") || t.includes("next url") || t.includes("next record") || t === "next" || t.includes("get url") || t === "queue" || (/\bqueue\b/.test(idCls) && !t.includes("manual"));
      });
    if (fromQueueBtn) {
      console.log("[AI Assistant] Triggering 'From Queue' / Queue button:", fromQueueBtn);
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
    state.isAutoQueuePipelineActive = false; // separate pipeline

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
    AIExt.updateStatus(`🚀 Auto-Submitting ${label} queue sites as Not Working...`, "loading");
    updateBatchButtonsState();

    processNextBatchNotWorkingItem();
  }

  function stopBatchNotWorking(msg = "") {
    state.isBatchNotWorkingActive = false;
    state.batchNotWorkingRemaining = 0;
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

    let currentUrl = AIExt.getTargetUrl();
    if (!currentUrl) {
      triggerFromQueue();
      currentUrl = AIExt.getTargetUrl();
    }

    const normSubmitted = (currentUrl || `item-${Date.now()}`).trim().toLowerCase().replace(/\/+$/, "");
    const remainingText = state.batchNotWorkingRemaining === -1 ? "ALL" : `${state.batchNotWorkingRemaining} left`;
    AIExt.updateStatus(`⚡ Batch Not Working [${remainingText}]: Submitting ${currentUrl || "queue item"}...`, "loading");

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

    AIExt.fillFormFields(notWorkingData);

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
      if (!state.isBatchNotWorkingActive) return;

      let pollAttempts = 0;
      const pollTimer = setInterval(() => {
        pollAttempts++;
        if (!state.isBatchNotWorkingActive) {
          clearInterval(pollTimer);
          return;
        }

        let nextUrl = AIExt.getTargetUrl();
        if (!nextUrl && pollAttempts % 3 === 0) {
          triggerFromQueue();
          nextUrl = AIExt.getTargetUrl();
        }

        const normNext = (nextUrl || "").trim().toLowerCase().replace(/\/+$/, "");
        if (normNext && normNext !== normSubmitted && normNext.length > 3) {
          clearInterval(pollTimer);
          setTimeout(() => {
            if (state.isBatchNotWorkingActive) {
              processNextBatchNotWorkingItem();
            }
          }, 350);
          return;
        }

        if (pollAttempts >= 30) { // ~5 seconds max per item
          clearInterval(pollTimer);
          if (state.isBatchNotWorkingActive) {
            triggerFromQueue();
            setTimeout(() => {
              if (state.isBatchNotWorkingActive) {
                processNextBatchNotWorkingItem();
              }
            }, 350);
          }
        }
      }, 160);
    }, 500);
  }

  function markAndSubmitCurrentAsNotWorking(reason = "Manual 1-click Not Working") {
    const currentUrl = AIExt.getTargetUrl();
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
    AIExt.renderPreview(notWorkingData);
    AIExt.updateStatus(`🚫 Marked as Not Working (${reason}) - Submitting...`, "warning");
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
    const pauseBtn = document.getElementById("ai-pause-pipeline-btn");
    if (pauseBtn) pauseBtn.style.display = "inline-flex";

    let attempts = 0;
    const maxAttempts = 80; // 80 * 150ms = 12 seconds
    const normSubmitted = (submittedUrl || "").trim().toLowerCase().replace(/\/+$/, "");

    console.log(`[AI Assistant] Auto-queue pipeline listening for next record after "${normSubmitted}"...`);
    AIExt.updateStatus("⏳ Advancing to next queue record...", "loading");

    // If the input was cleared or still holds the submitted URL, trigger the portal's Queue / From Queue button
    setTimeout(() => {
      if (!state.isAutoQueuePipelineActive || !state.autoQueueEnabled) return;
      const cur = AIExt.getTargetUrl();
      if (!cur || cur.trim().toLowerCase().replace(/\/+$/, "") === normSubmitted) {
        triggerFromQueue();
      }
    }, 450);

    state.autoQueuePollTimer = setInterval(() => {
      attempts++;
      if (!state.isAutoQueuePipelineActive || !state.autoQueueEnabled) {
        clearInterval(state.autoQueuePollTimer);
        state.autoQueuePollTimer = null;
        return;
      }

      let nextUrl = AIExt.getTargetUrl();

      // If still empty or unchanged after periodic intervals, trigger Queue / From Queue
      if ((!nextUrl || nextUrl.trim().toLowerCase().replace(/\/+$/, "") === normSubmitted) && attempts % 8 === 0) {
        triggerFromQueue();
        nextUrl = AIExt.getTargetUrl();
      }

      const normNext = (nextUrl || "").trim().toLowerCase().replace(/\/+$/, "");

      // Check if a new valid URL has been loaded into the input
      if (normNext && normNext !== normSubmitted && normNext.length > 3) {
        clearInterval(state.autoQueuePollTimer);
        state.autoQueuePollTimer = null;
        console.log(`[AI Assistant] Next queue URL detected: ${nextUrl}. Auto-crawling in 350ms...`);
        AIExt.updateStatus(`⚡ Auto-Queue: Next site detected (${nextUrl}). Crawling...`, "loading");

        setTimeout(() => {
          if (state.isAutoQueuePipelineActive && state.autoQueueEnabled && !state.isBatchNotWorkingActive) {
            AIExt.triggerCrawlAndFill({ fromAutoQueue: true });
          }
        }, 350);
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(state.autoQueuePollTimer);
        state.autoQueuePollTimer = null;
        state.isAutoQueuePipelineActive = false;
        if (pauseBtn) pauseBtn.style.display = "none";
        console.log("[AI Assistant] Queue advance polling completed.");
        AIExt.updateStatus("Ready (Queue idle)", "idle");
      }
    }, 150);
  }

  /**
   * Automatically confirms custom confirmation popups/modals and submits the form
   * specifically for "Not Working" status (per instruction: "for notworking autosubmit").
   * For "Working" sites, submission is NEVER automatic so the user can manually review.
   */
  function autoSubmitNotWorking(specificUrl) {
    const submittedUrl = specificUrl || AIExt.getTargetUrl();
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
  Object.assign(AIExt, {
    triggerFromQueue,
    startBatchNotWorking,
    stopBatchNotWorking,
    updateBatchButtonsState,
    processNextBatchNotWorkingItem,
    markAndSubmitCurrentAsNotWorking,
    stopAutoQueuePipeline,
    scheduleNextQueueAutoCrawl,
    autoSubmitNotWorking,
    extractLiveDomPayload
  });
})(globalThis.__AI_EXTENSION__ = globalThis.__AI_EXTENSION__ || {});
