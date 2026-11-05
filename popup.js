// Popup UI Logic
// Load defaults from environment configuration (env.js / .env)
const DEFAULT_API_KEY =
  (typeof globalThis !== "undefined" && globalThis.ENV && globalThis.ENV.GEMINI_API_KEY) ||
  (typeof window !== "undefined" && window.ENV && window.ENV.GEMINI_API_KEY) ||
  "";
const DEFAULT_MODEL =
  (typeof globalThis !== "undefined" && globalThis.ENV && globalThis.ENV.DEFAULT_MODEL) ||
  (typeof window !== "undefined" && window.ENV && window.ENV.DEFAULT_MODEL) ||
  "gemini-3.5-flash-lite";

document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("api-key-input");
  const toggleKeyVisibilityBtn = document.getElementById("btn-toggle-key-visibility");
  const modelSelect = document.getElementById("model-select");
  const btnSaveKey = document.getElementById("btn-save-key");
  const btnTestKey = document.getElementById("btn-test-key");
  const statusMsg = document.getElementById("api-test-status");
  const toggleAutoQueue = document.getElementById("toggle-auto-queue");
  const toggleStrictFilter = document.getElementById("toggle-strict-filter");
  const toggleFloatingWidget = document.getElementById("toggle-floating-widget");
  const toggleInlineBtn = document.getElementById("toggle-inline-btn");
  const btnOpenTestPortal = document.getElementById("btn-open-test-portal");

  // Load existing settings or pre-configure defaults
  chrome.storage.sync.get(["apiKey", "model", "strictFilter", "showFloatingWidget", "showInlineBtn", "autoQueueEnabled"], (res) => {
    apiKeyInput.value = res.apiKey || DEFAULT_API_KEY;
    modelSelect.value = res.model || DEFAULT_MODEL;
    toggleStrictFilter.checked = res.strictFilter !== undefined ? res.strictFilter : true;
    if (toggleAutoQueue) {
      toggleAutoQueue.checked = res.autoQueueEnabled !== undefined ? res.autoQueueEnabled : true;
    }
    if (toggleFloatingWidget) {
      toggleFloatingWidget.checked = res.showFloatingWidget !== undefined ? res.showFloatingWidget : true;
    }
    if (toggleInlineBtn) {
      toggleInlineBtn.checked = res.showInlineBtn !== undefined ? res.showInlineBtn : true;
    }
  });

  // Toggle API Key visibility
  toggleKeyVisibilityBtn.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleKeyVisibilityBtn.textContent = "🙈";
    } else {
      apiKeyInput.type = "password";
      toggleKeyVisibilityBtn.textContent = "👁️";
    }
  });

  // Save Settings
  btnSaveKey.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    const model = modelSelect.value;
    const strict = toggleStrictFilter.checked;
    const autoQueue = toggleAutoQueue ? toggleAutoQueue.checked : true;
    const floating = toggleFloatingWidget ? toggleFloatingWidget.checked : true;
    const inline = toggleInlineBtn ? toggleInlineBtn.checked : true;

    chrome.storage.sync.set({
      apiKey: key,
      model: model,
      strictFilter: strict,
      autoQueueEnabled: autoQueue,
      showFloatingWidget: floating,
      showInlineBtn: inline
    }, () => {
      showStatus("Settings saved successfully!", "success");
    });
  });

  // Instant toggles without requiring Save button
  if (toggleAutoQueue) {
    toggleAutoQueue.addEventListener("change", () => {
      chrome.storage.sync.set({ autoQueueEnabled: toggleAutoQueue.checked });
    });
  }
  if (toggleFloatingWidget) {
    toggleFloatingWidget.addEventListener("change", () => {
      chrome.storage.sync.set({ showFloatingWidget: toggleFloatingWidget.checked });
    });
  }
  if (toggleInlineBtn) {
    toggleInlineBtn.addEventListener("change", () => {
      chrome.storage.sync.set({ showInlineBtn: toggleInlineBtn.checked });
    });
  }

  // Test Connection
  btnTestKey.addEventListener("click", () => {
    const key = apiKeyInput.value.trim() || DEFAULT_API_KEY;
    const model = modelSelect.value || DEFAULT_MODEL;

    showStatus("Testing Gemini API connection...", "loading");

    chrome.runtime.sendMessage({
      action: "TEST_API_KEY",
      apiKey: key,
      model: model
    }, (res) => {
      if (chrome.runtime.lastError) {
        showStatus(`Error: ${chrome.runtime.lastError.message}`, "error");
        return;
      }
      if (res && res.success) {
        showStatus(`Connected! Gemini API is active & ready.`, "success");
      } else {
        showStatus(`Test failed: ${res?.error || "Unknown error"}`, "error");
      }
    });
  });

  // Open Local Test Portal
  btnOpenTestPortal.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("test_portal.html") });
  });

  // Direct AI Crawl & Fill on Active Tab
  const btnPopupCrawl = document.getElementById("btn-popup-crawl");
  const popupCrawlStatus = document.getElementById("popup-crawl-status");

  if (btnPopupCrawl) {
    btnPopupCrawl.addEventListener("click", () => {
      btnPopupCrawl.disabled = true;
      showPopupCrawlStatus("⚡ Triggering AI Crawl on active page...", "loading");

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
          btnPopupCrawl.disabled = false;
          showPopupCrawlStatus("No active tab found.", "error");
          return;
        }

        const activeTab = tabs[0];
        chrome.tabs.sendMessage(activeTab.id, { action: "TRIGGER_CRAWL" }, (res) => {
          btnPopupCrawl.disabled = false;
          if (chrome.runtime.lastError) {
            const err = chrome.runtime.lastError.message || "Failed to reach page";
            showPopupCrawlStatus(`Please open the data entry page first (${err})`, "error");
            return;
          }
          if (res && res.success) {
            showPopupCrawlStatus("✅ AI Crawl & Fill started successfully!", "success");
          } else {
            showPopupCrawlStatus(`Error: ${res?.error || "Unable to start crawl"}`, "error");
          }
        });
      });
    });
  }

  // Batch Not Working Actions from Popup
  const btnPopupBatch10 = document.getElementById("btn-popup-batch-10");
  if (btnPopupBatch10) {
    btnPopupBatch10.addEventListener("click", () => {
      showPopupCrawlStatus("⚡ Triggering Auto Submit 10 Sites as Not Working...", "loading");
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        chrome.tabs.sendMessage(tabs[0].id, { action: "START_BATCH_10_NOTWORKING" }, () => {
          showPopupCrawlStatus("🚀 Started Auto-Submitting 10 as Not Working!", "success");
        });
      });
    });
  }

  const btnPopupSubmitNotWorking = document.getElementById("btn-popup-submit-notworking");
  if (btnPopupSubmitNotWorking) {
    btnPopupSubmitNotWorking.addEventListener("click", () => {
      showPopupCrawlStatus("🚫 Submitting current site as Not Working...", "loading");
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        chrome.tabs.sendMessage(tabs[0].id, { action: "SUBMIT_1_NOTWORKING" }, () => {
          showPopupCrawlStatus("✓ Submitted as Not Working and advancing!", "success");
        });
      });
    });
  }

  const btnPopupBatchAll = document.getElementById("btn-popup-batch-all");
  if (btnPopupBatchAll) {
    btnPopupBatchAll.addEventListener("click", () => {
      showPopupCrawlStatus("⚡ Starting continuous auto-submit ALL as Not Working...", "loading");
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        chrome.tabs.sendMessage(tabs[0].id, { action: "START_BATCH_ALL_NOTWORKING" }, () => {
          showPopupCrawlStatus("🚀 Started Auto-Submitting ALL as Not Working!", "success");
        });
      });
    });
  }

  function showPopupCrawlStatus(msg, type) {
    if (!popupCrawlStatus) return;
    popupCrawlStatus.className = `status-msg ${type}`;
    popupCrawlStatus.textContent = msg;
    popupCrawlStatus.style.display = "block";
    if (type === "success") {
      setTimeout(() => {
        popupCrawlStatus.style.display = "none";
      }, 4000);
    }
  }

  function showStatus(msg, type) {
    statusMsg.className = `status-msg ${type}`;
    statusMsg.textContent = msg;
    statusMsg.style.display = "block";
    if (type === "success") {
      setTimeout(() => {
        statusMsg.style.display = "none";
      }, 3500);
    }
  }
});
