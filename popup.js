// Popup UI Logic
// Load defaults from environment configuration (env.js / .env)
function readPopupEnv(key, fallback = "") {
  return (
    (typeof globalThis !== "undefined" && globalThis.ENV && globalThis.ENV[key]) ||
    (typeof window !== "undefined" && window.ENV && window.ENV[key]) ||
    fallback
  );
}

const DEFAULT_AI_PROVIDER = "gemini";
const DEFAULT_API_KEY = readPopupEnv("GEMINI_API_KEY", "");
const DEFAULT_MODEL = readPopupEnv("DEFAULT_MODEL", "gemini-3.5-flash-lite");
// Removed Groq from popup UI (background config retains llama-3.1-8b-instant for legacy compatibility)

const PROVIDER_MODELS_UI = {
  gemini: [
    { value: "gemini-3.8-flash", label: "Gemini 3.8 Flash (Latest & High Accuracy)" },
    { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
    { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite (Fast & Accurate - Default)" },
    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" }
  ]
};

function saveSettingsToStorage(obj, cb) {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set(obj, () => {
      if (chrome.storage.sync) {
        try { chrome.storage.sync.set(obj, () => {}); } catch (e) {}
      }
      if (cb) cb();
    });
  } else if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.set(obj, cb);
  } else if (cb) {
    cb();
  }
}

function loadSettingsFromStorage(keys, cb) {
  const local = (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) ? chrome.storage.local : null;
  const sync = (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) ? chrome.storage.sync : null;

  if (local && sync) {
    local.get(keys, (localRes) => {
      sync.get(keys, (syncRes) => {
        const merged = { ...(syncRes || {}), ...(localRes || {}) };
        if (syncRes && Object.keys(syncRes).length > 0) {
          try { local.set(syncRes, () => {}); } catch (e) {}
        }
        cb(merged);
      });
    });
  } else if (local) {
    local.get(keys, (res) => cb(res || {}));
  } else if (sync) {
    sync.get(keys, (res) => cb(res || {}));
  } else {
    cb({});
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const extractionModeSelect = document.getElementById("extraction-mode-select");
  const providerSelect = document.getElementById("provider-select");
  const apiKeyInput = document.getElementById("api-key-input");
  const toggleKeyVisibilityBtn = document.getElementById("btn-toggle-key-visibility");
  const modelSelect = document.getElementById("model-select");
  const btnSaveKey = document.getElementById("btn-save-key");
  const btnTestKey = document.getElementById("btn-test-key");
  const statusMsg = document.getElementById("api-test-status");
  const toggleAutoQueue = document.getElementById("toggle-auto-queue");
  const crawlModeSelect = document.getElementById("crawl-mode-select");
  const btnPopupStopCrawl = document.getElementById("btn-popup-stop-crawl");
  const toggleStrictFilter = document.getElementById("toggle-strict-filter");
  const toggleFloatingWidget = document.getElementById("toggle-floating-widget");
  const toggleInlineBtn = document.getElementById("toggle-inline-btn");
  const btnOpenTestPortal = document.getElementById("btn-open-test-portal");

  // Clean up Groq from UI if present
  const groupGroqKey = document.getElementById("group-groq-key");
  if (groupGroqKey) groupGroqKey.style.display = "none";
  if (providerSelect) {
    const groqOpt = providerSelect.querySelector('option[value="groq"]');
    if (groqOpt) groqOpt.remove();
    providerSelect.value = "gemini";
  }

  const savedModelsByProvider = {
    gemini: DEFAULT_MODEL
  };

  function populateModelsForProvider(provider, selectedModel) {
    const cleanProv = "gemini";
    const options = [...PROVIDER_MODELS_UI.gemini];
    const desired = selectedModel || savedModelsByProvider.gemini || options[0].value;
    if (desired && !options.some(o => o.value === desired) && /^gemini-/i.test(desired)) {
      options.push({ value: desired, label: desired });
    }
    modelSelect.innerHTML = "";
    for (const opt of options) {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      modelSelect.appendChild(el);
    }
    modelSelect.value = options.some(o => o.value === desired) ? desired : options[0].value;
  }

  function wireVisibilityToggle(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener("click", () => {
      if (input.type === "password") {
        input.type = "text";
        btn.textContent = "🙈";
      } else {
        input.type = "password";
        btn.textContent = "👁️";
      }
    });
  }

  wireVisibilityToggle(toggleKeyVisibilityBtn, apiKeyInput);

  // Load existing settings with chrome.storage.local priority and sync fallback
  loadSettingsFromStorage([
    "aiProvider", "apiKey", "groqApiKey", "model", "extractionMode",
    "strictFilter", "showFloatingWidget", "showInlineBtn", "autoQueueEnabled", "crawlMode"
  ], (res) => {
    if (extractionModeSelect) {
      extractionModeSelect.value = (res.extractionMode === "own_crawl") ? "own_crawl" : "ai_only";
    }

    if (providerSelect) providerSelect.value = "gemini";
    apiKeyInput.value = res.apiKey || DEFAULT_API_KEY;

    savedModelsByProvider.gemini = res.model || DEFAULT_MODEL;
    populateModelsForProvider("gemini", savedModelsByProvider.gemini);

    toggleStrictFilter.checked = res.strictFilter !== undefined ? res.strictFilter : true;
    const isAutoQueue = res.crawlMode === "auto" || res.crawlMode === "continuous" || (res.crawlMode === undefined && res.autoQueueEnabled !== undefined ? !!res.autoQueueEnabled : false);
    if (toggleAutoQueue) {
      toggleAutoQueue.checked = isAutoQueue;
    }
    if (crawlModeSelect) {
      crawlModeSelect.value = isAutoQueue ? "auto" : "manual";
    }
    if (btnPopupStopCrawl) {
      btnPopupStopCrawl.style.display = isAutoQueue ? "block" : "none";
    }
    if (toggleFloatingWidget) {
      toggleFloatingWidget.checked = res.showFloatingWidget !== undefined ? res.showFloatingWidget : true;
    }
    if (toggleInlineBtn) {
      toggleInlineBtn.checked = res.showInlineBtn !== undefined ? !!res.showInlineBtn : false;
    }
  });

  if (apiKeyInput) {
    apiKeyInput.addEventListener("input", () => {
      if (providerSelect) providerSelect.value = "gemini";
    });
  }

  modelSelect.addEventListener("change", () => {
    savedModelsByProvider.gemini = modelSelect.value;
  });

  // Save Settings
  btnSaveKey.addEventListener("click", () => {
    const aiProvider = "gemini";
    const extractionMode = extractionModeSelect ? extractionModeSelect.value : "ai_only";
    const key = apiKeyInput.value.trim();
    savedModelsByProvider.gemini = modelSelect.value;

    const strict = toggleStrictFilter.checked;
    const isAuto = crawlModeSelect ? (crawlModeSelect.value === "auto" || crawlModeSelect.value === "continuous") : (toggleAutoQueue ? toggleAutoQueue.checked : false);
    const floating = toggleFloatingWidget ? toggleFloatingWidget.checked : true;
    const inline = toggleInlineBtn ? toggleInlineBtn.checked : true;

    saveSettingsToStorage({
      aiProvider,
      extractionMode,
      apiKey: key,
      model: savedModelsByProvider.gemini,
      strictFilter: strict,
      autoQueueEnabled: isAuto,
      crawlMode: isAuto ? "auto" : "manual",
      showFloatingWidget: floating,
      showInlineBtn: inline
    }, () => {
      showStatus("Settings saved successfully!", "success");
    });
  });

  // Instant toggles without requiring Save button
  if (extractionModeSelect) {
    extractionModeSelect.addEventListener("change", () => {
      saveSettingsToStorage({ extractionMode: extractionModeSelect.value });
    });
  }
  if (crawlModeSelect) {
    crawlModeSelect.addEventListener("change", () => {
      const isContinuous = crawlModeSelect.value === "auto" || crawlModeSelect.value === "continuous";
      if (toggleAutoQueue) toggleAutoQueue.checked = isContinuous;
      if (btnPopupStopCrawl) btnPopupStopCrawl.style.display = isContinuous ? "block" : "none";
      saveSettingsToStorage({ autoQueueEnabled: isContinuous, crawlMode: isContinuous ? "auto" : "manual" });
      if (!isContinuous) {
        chrome.runtime.sendMessage({ action: "STOP_ALL_CRAWLING" }, () => {});
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "STOP_ALL_CRAWLING" }, () => {});
          }
        });
      }
      showStatus(isContinuous ? "⚡ Auto Crawl activated: Always auto-crawls on load." : "✋ Manual Crawl activated: Always manual (only crawls on click).", "success");
    });
  }

  if (toggleAutoQueue) {
    toggleAutoQueue.addEventListener("change", () => {
      const isContinuous = toggleAutoQueue.checked;
      if (crawlModeSelect) crawlModeSelect.value = isContinuous ? "auto" : "manual";
      if (btnPopupStopCrawl) btnPopupStopCrawl.style.display = isContinuous ? "block" : "none";
      saveSettingsToStorage({ autoQueueEnabled: isContinuous, crawlMode: isContinuous ? "auto" : "manual" });
      if (!isContinuous) {
        chrome.runtime.sendMessage({ action: "STOP_ALL_CRAWLING" }, () => {});
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "STOP_ALL_CRAWLING" }, () => {});
          }
        });
      }
    });
  }

  if (btnPopupStopCrawl) {
    btnPopupStopCrawl.addEventListener("click", () => {
      if (toggleAutoQueue) toggleAutoQueue.checked = false;
      if (crawlModeSelect) crawlModeSelect.value = "manual";
      btnPopupStopCrawl.style.display = "none";
      saveSettingsToStorage({ autoQueueEnabled: false, crawlMode: "manual" });
      chrome.runtime.sendMessage({ action: "STOP_ALL_CRAWLING" }, () => {});
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "STOP_ALL_CRAWLING" }, () => {});
        }
      });
      showStatus("🛑 Crawling stopped. Switched to Manual Crawl.", "idle");
    });
  }
  if (toggleFloatingWidget) {
    toggleFloatingWidget.addEventListener("change", () => {
      saveSettingsToStorage({ showFloatingWidget: toggleFloatingWidget.checked });
    });
  }
  if (toggleInlineBtn) {
    toggleInlineBtn.addEventListener("change", () => {
      saveSettingsToStorage({ showInlineBtn: toggleInlineBtn.checked });
    });
  }

  // Test Connection for Gemini
  btnTestKey.addEventListener("click", () => {
    const provider = "gemini";
    const key = apiKeyInput.value.trim() || DEFAULT_API_KEY;
    const model = modelSelect.value || DEFAULT_MODEL;

    showStatus("Testing Gemini API connection...", "loading");

    chrome.runtime.sendMessage({
      action: "TEST_API_KEY",
      provider,
      apiKey: key,
      model
    }, (res) => {
      if (chrome.runtime.lastError) {
        showStatus(`Error: ${chrome.runtime.lastError.message}`, "error");
        return;
      }
      if (res && res.success) {
        if (res.activeModel) {
          savedModelsByProvider.gemini = res.activeModel;
          populateModelsForProvider("gemini", res.activeModel);
          saveSettingsToStorage({ model: res.activeModel });
        }
        showStatus(res.message || "Connected! Gemini API is active & ready.", "success");
      } else {
        const err = res?.error || "Unknown error";
        if (/401|403|unauthorized|unauthenticated/i.test(err)) {
          showStatus("Gemini Unauthorized: Google Gemini keys start with 'AIzaSy...'. Check aistudio.google.com/app/apikey", "error");
        } else {
          showStatus(`Test failed: ${err}`, "error");
        }
      }
    });
  });

  // Open Local Test Portal
  btnOpenTestPortal.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("test_portal.html") });
  });

  /**
   * Validates if target URL belongs to allowed data entry portals.
   */
  function isAllowedPortalUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return false;
    try {
      const u = new URL(rawUrl);
      const host = u.hostname.toLowerCase();
      const href = u.href.toLowerCase();
      if (host === "cpworkportal.online" || host.endsWith(".cpworkportal.online") || href.includes("cpworkportal.online")) {
        return true;
      }
      if (host.includes("kishorekumar1993") || href.includes("kishorekumar1993")) {
        return true;
      }
      if (href.includes("test_portal") || href.includes("testportal") || href.includes("dataextraction")) {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // Direct AI Crawl & Fill on Active Tab
  const btnPopupCrawl = document.getElementById("btn-popup-crawl");
  const popupCrawlStatus = document.getElementById("popup-crawl-status");

  // Check active tab portal status on load
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs && tabs[0];
    if (activeTab && activeTab.url && !isAllowedPortalUrl(activeTab.url)) {
      showPopupCrawlStatus("ℹ️ Extension active only on cpworkportal.online & kishorekumar1993 (disabled on this site)", "info");
    }
  });

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
        if (!isAllowedPortalUrl(activeTab.url)) {
          btnPopupCrawl.disabled = false;
          showPopupCrawlStatus("⚠️ Extension is restricted to cpworkportal.online and kishorekumar1993. It is disabled on this site to prevent disturbance.", "warning");
          return;
        }
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
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        if (!isAllowedPortalUrl(tabs[0].url)) {
          showPopupCrawlStatus("⚠️ Action disabled. Active only on cpworkportal.online and kishorekumar1993.", "warning");
          return;
        }
        showPopupCrawlStatus("⚡ Triggering Auto Submit 10 Sites as Not Working...", "loading");
        chrome.tabs.sendMessage(tabs[0].id, { action: "START_BATCH_10_NOTWORKING" }, () => {
          showPopupCrawlStatus("🚀 Started Auto-Submitting 10 as Not Working!", "success");
        });
      });
    });
  }

  const btnPopupSubmitNotWorking = document.getElementById("btn-popup-submit-notworking");
  if (btnPopupSubmitNotWorking) {
    btnPopupSubmitNotWorking.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        if (!isAllowedPortalUrl(tabs[0].url)) {
          showPopupCrawlStatus("⚠️ Action disabled. Active only on cpworkportal.online and kishorekumar1993.", "warning");
          return;
        }
        showPopupCrawlStatus("🚫 Submitting current site as Not Working...", "loading");
        chrome.tabs.sendMessage(tabs[0].id, { action: "SUBMIT_1_NOTWORKING" }, () => {
          showPopupCrawlStatus("✓ Submitted as Not Working and advancing!", "success");
        });
      });
    });
  }

  const btnPopupBatchAll = document.getElementById("btn-popup-batch-all");
  if (btnPopupBatchAll) {
    btnPopupBatchAll.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        if (!isAllowedPortalUrl(tabs[0].url)) {
          showPopupCrawlStatus("⚠️ Action disabled. Active only on cpworkportal.online and kishorekumar1993.", "warning");
          return;
        }
        showPopupCrawlStatus("⚡ Starting continuous auto-submit ALL as Not Working...", "loading");
        chrome.tabs.sendMessage(tabs[0].id, { action: "START_BATCH_ALL_NOTWORKING" }, () => {
          showPopupCrawlStatus("🚀 Started Auto-Submitting ALL as Not Working!", "success");
        });
      });
    });
  }

  const btnPopupCopyPayload = document.getElementById("btn-popup-copy-payload");
  if (btnPopupCopyPayload) {
    btnPopupCopyPayload.addEventListener("click", () => {
      const labelSpan = document.getElementById("btn-popup-copy-payload-text");
      const origText = labelSpan ? labelSpan.textContent : "Generate & Copy API Payload";
      if (labelSpan) labelSpan.textContent = "⏳ Generating...";
      btnPopupCopyPayload.disabled = true;
      showPopupCrawlStatus("⏳ Generating API payload...", "loading");

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs && tabs[0];
        const tabId = activeTab ? activeTab.id : null;

        const requestPayloadForUrl = (targetUrl) => {
          chrome.runtime.sendMessage({
            action: "GENERATE_API_PAYLOAD",
            url: targetUrl || ""
          }, async (res) => {
            btnPopupCopyPayload.disabled = false;
            if (chrome.runtime.lastError) {
              const err = chrome.runtime.lastError.message;
              showPopupCrawlStatus(`Error: ${err}`, "error");
              if (labelSpan) labelSpan.textContent = "⚠️ Error";
              setTimeout(() => { if (labelSpan) labelSpan.textContent = origText; }, 2500);
              return;
            }
            if (res && res.success && res.payloadString) {
              let copied = false;
              try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(res.payloadString);
                  copied = true;
                }
              } catch (clipErr) { }
              if (!copied) {
                try {
                  const ta = document.createElement("textarea");
                  ta.value = res.payloadString;
                  ta.style.position = "fixed";
                  ta.style.left = "-9999px";
                  document.body.appendChild(ta);
                  ta.focus();
                  ta.select();
                  copied = document.execCommand("copy");
                  document.body.removeChild(ta);
                } catch (e) { }
              }
              if (copied) {
                const sizeKb = (res.charCount ? (res.charCount / 1024).toFixed(1) : (res.payloadString.length / 1024).toFixed(1));
                showPopupCrawlStatus(`✅ API Payload copied to clipboard (${sizeKb} KB)! Ready to paste into Postman / Google AI Studio.`, "success");
                if (labelSpan) labelSpan.textContent = `✅ Copied (${sizeKb} KB)!`;
              } else {
                showPopupCrawlStatus("⚠️ Unable to copy to clipboard", "error");
                if (labelSpan) labelSpan.textContent = "⚠️ Copy Failed";
              }
            } else {
              showPopupCrawlStatus(`Error: ${res?.error || "Could not generate payload"}`, "error");
              if (labelSpan) labelSpan.textContent = "⚠️ Failed";
            }
            setTimeout(() => { if (labelSpan) labelSpan.textContent = origText; }, 2500);
          });
        };

        if (tabId) {
          chrome.tabs.sendMessage(tabId, { action: "GET_CURRENT_TARGET_URL" }, (urlRes) => {
            let detectedUrl = (urlRes && urlRes.url) || "";
            if (!detectedUrl && activeTab && activeTab.url && !activeTab.url.startsWith("chrome")) {
              detectedUrl = activeTab.url;
            }
            requestPayloadForUrl(detectedUrl);
          });
        } else {
          requestPayloadForUrl("");
        }
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

  // =========================================================================
  // WEBSITE RECORDS & QUALITY DASHBOARD LOGIC (WORKING + NON-WORKING + TODAY FILTER)
  // =========================================================================
  const statWorking = document.getElementById("stat-working");
  const statNotWorking = document.getElementById("stat-not-working");
  const statRedirect = document.getElementById("stat-redirect");
  const statNotEnglish = document.getElementById("stat-not-english");
  const statTotalHistorical = document.getElementById("stat-total-historical");
  const labelStatTotal = document.getElementById("label-stat-total");
  const statLastSync = document.getElementById("stat-last-sync");
  const badgeTotalRecords = document.getElementById("badge-total-records");
  const btnViewCount = document.getElementById("btn-view-count");
  const excelSyncStatus = document.getElementById("excel-sync-status");

  // Date Filter Elements
  const btnFilterToday = document.getElementById("btn-filter-today");
  const btnFilterAll = document.getElementById("btn-filter-all");
  const todayDateText = document.getElementById("today-date-text");
  const filterMetricDate = document.getElementById("filter-metric-date");

  const btnSyncExcel = document.getElementById("btn-sync-excel");
  const btnDownloadExcel = document.getElementById("btn-download-excel");
  const btnViewRecords = document.getElementById("btn-view-records");
  const btnClearRecords = document.getElementById("btn-clear-records");
  const inputExcelFile = document.getElementById("input-excel-file");

  const recordsViewerPanel = document.getElementById("records-viewer-panel");
  const btnCloseRecordsPanel = document.getElementById("btn-close-records-panel");
  const filterStatusSelect = document.getElementById("filter-status-select");
  const filterDateInput = document.getElementById("filter-date-input");
  const filterSearchInput = document.getElementById("filter-search-input");
  const recordsTableBody = document.getElementById("records-table-body");
  const filteredCountDisplay = document.getElementById("filtered-count-display");

  let currentRecords = [];
  let currentWorkingRecords = [];
  let lastFetchedStats = {};
  let activeDateFilter = "today"; // Default to Today as requested
  const todayIsoDate = typeof getLocalDateString === "function" ? getLocalDateString() : new Date().toISOString().split("T")[0];

  if (todayDateText) {
    todayDateText.textContent = todayIsoDate;
  }
  if (filterMetricDate) {
    filterMetricDate.value = todayIsoDate;
  }
  if (filterDateInput) {
    filterDateInput.value = todayIsoDate;
  }

  function showExcelSyncStatus(msg, type = "idle") {
    if (!excelSyncStatus) return;
    excelSyncStatus.className = `status-msg ${type}`;
    excelSyncStatus.textContent = msg;
    excelSyncStatus.style.display = "block";
    if (type === "success") {
      setTimeout(() => {
        excelSyncStatus.style.display = "none";
      }, 4000);
    }
  }

  function updateMetricsDisplay() {
    if (!lastFetchedStats) return;

    if (activeDateFilter === "today" || (activeDateFilter && activeDateFilter === todayIsoDate)) {
      if (statWorking) statWorking.textContent = lastFetchedStats.workingToday || 0;
      if (statNotWorking) statNotWorking.textContent = lastFetchedStats.notWorkingToday || 0;
      if (statRedirect) statRedirect.textContent = lastFetchedStats.redirectToday || 0;
      if (statNotEnglish) statNotEnglish.textContent = lastFetchedStats.notEnglishToday || 0;
      if (statTotalHistorical) statTotalHistorical.textContent = lastFetchedStats.totalToday || 0;
      if (labelStatTotal) labelStatTotal.textContent = "Today Total";
      const totalAll = (lastFetchedStats.totalWorking || 0) + (lastFetchedStats.totalHistorical || 0);
      if (badgeTotalRecords) badgeTotalRecords.textContent = `${lastFetchedStats.totalToday || 0} Today (${totalAll} Total)`;
      if (btnViewCount) btnViewCount.textContent = lastFetchedStats.totalToday || 0;
    } else if (activeDateFilter === "all") {
      if (statWorking) statWorking.textContent = lastFetchedStats.totalWorking || 0;
      if (statNotWorking) statNotWorking.textContent = lastFetchedStats.totalNotWorking || 0;
      if (statRedirect) statRedirect.textContent = lastFetchedStats.totalRedirect || 0;
      if (statNotEnglish) statNotEnglish.textContent = lastFetchedStats.totalNotEnglish || 0;
      const totalAll = (lastFetchedStats.totalWorking || 0) + (lastFetchedStats.totalHistorical || 0);
      if (statTotalHistorical) statTotalHistorical.textContent = totalAll;
      if (labelStatTotal) labelStatTotal.textContent = "Total All";
      if (badgeTotalRecords) badgeTotalRecords.textContent = `${totalAll} Records`;
      if (btnViewCount) btnViewCount.textContent = totalAll;
    } else {
      // Specific custom date filter
      const targetDate = activeDateFilter;
      const wCount = (currentWorkingRecords || []).filter(r => (r.Date || r.date) === targetDate).length;
      const nwCount = (currentRecords || []).filter(r => (r["Website Status"] === "Not Working") && ((r.Date || r.date) === targetDate)).length;
      const redCount = (currentRecords || []).filter(r => (r["Website Status"] === "Redirect") && ((r.Date || r.date) === targetDate)).length;
      const neCount = (currentRecords || []).filter(r => (r["Website Status"] === "Not English") && ((r.Date || r.date) === targetDate)).length;
      const totalCust = wCount + nwCount + redCount + neCount;

      if (statWorking) statWorking.textContent = wCount;
      if (statNotWorking) statNotWorking.textContent = nwCount;
      if (statRedirect) statRedirect.textContent = redCount;
      if (statNotEnglish) statNotEnglish.textContent = neCount;
      if (statTotalHistorical) statTotalHistorical.textContent = totalCust;
      if (labelStatTotal) labelStatTotal.textContent = "Date Total";
      if (badgeTotalRecords) badgeTotalRecords.textContent = `${totalCust} Records (${targetDate})`;
      if (btnViewCount) btnViewCount.textContent = totalCust;
    }
    if (statLastSync) statLastSync.textContent = lastFetchedStats.lastSyncTime || "Never";
  }

  // Date Filter Pill Button Listeners
  if (btnFilterToday) {
    btnFilterToday.addEventListener("click", () => {
      activeDateFilter = "today";
      btnFilterToday.classList.add("active");
      if (btnFilterAll) btnFilterAll.classList.remove("active");
      if (filterDateInput) filterDateInput.value = todayIsoDate;
      if (filterMetricDate) filterMetricDate.value = todayIsoDate;
      updateMetricsDisplay();
      renderRecordsTable();
    });
  }

  if (btnFilterAll) {
    btnFilterAll.addEventListener("click", () => {
      activeDateFilter = "all";
      btnFilterAll.classList.add("active");
      if (btnFilterToday) btnFilterToday.classList.remove("active");
      if (filterDateInput) filterDateInput.value = "";
      if (filterMetricDate) filterMetricDate.value = "";
      updateMetricsDisplay();
      renderRecordsTable();
    });
  }

  if (filterMetricDate) {
    filterMetricDate.addEventListener("change", (e) => {
      const val = e.target.value;
      if (!val) {
        activeDateFilter = "all";
        if (btnFilterAll) btnFilterAll.classList.add("active");
        if (btnFilterToday) btnFilterToday.classList.remove("active");
      } else if (val === todayIsoDate) {
        activeDateFilter = "today";
        if (btnFilterToday) btnFilterToday.classList.add("active");
        if (btnFilterAll) btnFilterAll.classList.remove("active");
      } else {
        activeDateFilter = val;
        if (btnFilterToday) btnFilterToday.classList.remove("active");
        if (btnFilterAll) btnFilterAll.classList.remove("active");
      }
      if (filterDateInput) filterDateInput.value = val;
      updateMetricsDisplay();
      renderRecordsTable();
    });
  }

  async function refreshDashboardData() {
    // 1. Direct local storage read - provides 0ms instant display without depending on service worker
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        const recordsKey = typeof NON_WORKING_STORAGE_KEY !== "undefined" ? NON_WORKING_STORAGE_KEY : "nonWorkingRecords";
        const workingKey = typeof WORKING_STORAGE_KEY !== "undefined" ? WORKING_STORAGE_KEY : "workingRecords";
        const syncKey = typeof NON_WORKING_SYNC_TIME_KEY !== "undefined" ? NON_WORKING_SYNC_TIME_KEY : "nonWorkingLastExcelSyncTime";

        const data = await chrome.storage.local.get([recordsKey, workingKey, syncKey]);
        currentRecords = Array.isArray(data[recordsKey]) ? data[recordsKey] : [];
        currentWorkingRecords = Array.isArray(data[workingKey]) ? data[workingKey] : [];
        const lastSyncTime = data[syncKey] || null;

        if (typeof calculateErrorStats === "function") {
          lastFetchedStats = calculateErrorStats(currentRecords, lastSyncTime, currentWorkingRecords, todayIsoDate);
        } else {
          lastFetchedStats = {
            totalWorking: currentWorkingRecords.length,
            totalNotWorking: currentRecords.filter(r => (r["Website Status"] || r.websiteStatus) === "Not Working").length,
            totalRedirect: currentRecords.filter(r => (r["Website Status"] || r.websiteStatus) === "Redirect").length,
            totalNotEnglish: currentRecords.filter(r => (r["Website Status"] || r.websiteStatus) === "Not English").length,
            totalHistorical: currentRecords.length,
            workingToday: 0,
            notWorkingToday: 0,
            redirectToday: 0,
            notEnglishToday: 0,
            totalToday: 0,
            lastSyncTime: lastSyncTime ? String(lastSyncTime) : "Never"
          };
        }
        updateMetricsDisplay();

        if (recordsViewerPanel && recordsViewerPanel.style.display !== "none") {
          renderRecordsTable();
        }
      } catch (e) {
        // Silent fallback if storage read is interrupted
      }
    }

    // 2. Synchronize with background service worker if active, silently handling sleeping worker
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: "GET_NON_WORKING_RECORDS", dateFilter: todayIsoDate }, (res) => {
          if (chrome.runtime.lastError) {
            // Service worker is sleeping or inactive; local storage already populated the UI
            return;
          }
          if (res && res.success) {
            currentRecords = Array.isArray(res.records) ? res.records : currentRecords;
            currentWorkingRecords = Array.isArray(res.workingRecords) ? res.workingRecords : currentWorkingRecords;
            if (res.stats) {
              lastFetchedStats = res.stats;
            }
            updateMetricsDisplay();

            if (recordsViewerPanel && recordsViewerPanel.style.display !== "none") {
              renderRecordsTable();
            }
          }
        });
      }
    } catch (e) {
      // Worker unavailable, already handled by storage.local
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function truncate(str, max = 35) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max - 3) + "..." : str;
  }

  function renderRecordsTable() {
    if (!recordsTableBody) return;
    const statusVal = filterStatusSelect ? filterStatusSelect.value : "All";
    const dateVal = filterDateInput ? filterDateInput.value : (activeDateFilter === "today" ? todayIsoDate : (activeDateFilter === "all" ? "" : activeDateFilter));
    const searchVal = filterSearchInput ? filterSearchInput.value : "";

    let combinedList = [];
    const workingMapped = (currentWorkingRecords || []).map(w => ({
      URL: w.URL || w.url || "",
      "Website Status": "Working",
      Reason: `Eligible Working Site (${w["Business Type"] || w.businessType || "Verified"})`,
      "Error Keyword": w["Business Type"] || w.businessType || "-",
      "Error Source Link": w.URL || w.url || "",
      "Error Context": `${w["Company Name"] || w.companyName || ""}${w["Country Name"] ? " - " + w["Country Name"] : ""}`,
      Date: w.Date || w.date || "",
      Time: w.Time || w.time || ""
    }));

    if (statusVal === "Working") {
      combinedList = workingMapped;
    } else if (statusVal === "All") {
      combinedList = [...currentRecords, ...workingMapped];
    } else {
      combinedList = currentRecords;
    }

    const filtered = (typeof filterErrorRecords === "function")
      ? filterErrorRecords(combinedList, { status: statusVal, date: dateVal, search: searchVal })
      : combinedList;

    if (filteredCountDisplay) {
      filteredCountDisplay.textContent = `Showing ${filtered.length} of ${combinedList.length} records`;
    }

    if (!filtered || filtered.length === 0) {
      recordsTableBody.innerHTML = `<tr><td colspan="8" class="empty-state">No matching records found.</td></tr>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const r of filtered) {
      const tr = document.createElement("tr");

      const statusCls = r["Website Status"] === "Working"
        ? "status-working"
        : (r["Website Status"] === "Not Working"
          ? "status-not-working"
          : (r["Website Status"] === "Redirect" ? "status-redirect" : "status-not-english"));

      const keyword = r["Error Keyword"] || r.errorKeyword || "-";
      const srcLink = r["Error Source Link"] || r.errorSourceLink || r["Error URL"] || r.errorUrl || "-";
      const errCtx = r["Error Context"] || r.errorContext || r.errorSnippet || "-";

      const isWorking = r["Website Status"] === "Working";
      const badgeStyle = isWorking
        ? "background: #dcfce7; color: #166534; padding: 1px 5px; border-radius: 4px; font-size: 10px; font-weight: 600;"
        : "background: #fee2e2; color: #991b1b; padding: 1px 5px; border-radius: 4px; font-size: 10px; font-weight: 600;";

      tr.innerHTML = `
        <td title="${escapeHtml(r.URL)}">
          <a href="${escapeHtml(r.URL)}" target="_blank" style="color: #4f46e5; text-decoration: none;">
            ${escapeHtml(truncate(r.URL, 28))}
          </a>
        </td>
        <td class="${statusCls}"><strong>${escapeHtml(r["Website Status"])}</strong></td>
        <td title="${escapeHtml(r.Reason)}">${escapeHtml(truncate(r.Reason, 34))}</td>
        <td title="${escapeHtml(keyword)}">
          <span style="${badgeStyle}">
            ${escapeHtml(truncate(keyword, 20))}
          </span>
        </td>
        <td title="${escapeHtml(srcLink)}">
          ${/^https?:\/\//i.test(srcLink) ? `
            <a href="${escapeHtml(srcLink)}" target="_blank" style="color: #0284c7; text-decoration: none;">
              🔗 ${escapeHtml(truncate(srcLink, 28))}
            </a>
          ` : escapeHtml(truncate(srcLink, 28))}
        </td>
        <td title="${escapeHtml(errCtx)}" style="font-family: monospace; font-size: 10px; color: #334155;">
          ${escapeHtml(truncate(errCtx, 36))}
        </td>
        <td>${escapeHtml(r.Date)}</td>
        <td>${escapeHtml(r.Time)}</td>
      `;
      fragment.appendChild(tr);
    }
    recordsTableBody.innerHTML = "";
    recordsTableBody.appendChild(fragment);
  }

  // Toggle View Records Panel
  if (btnViewRecords) {
    btnViewRecords.addEventListener("click", () => {
      if (!recordsViewerPanel) return;
      const isOpen = recordsViewerPanel.style.display !== "none";
      recordsViewerPanel.style.display = isOpen ? "none" : "block";
      if (!isOpen) {
        renderRecordsTable();
        recordsViewerPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  if (btnCloseRecordsPanel) {
    btnCloseRecordsPanel.addEventListener("click", () => {
      if (recordsViewerPanel) recordsViewerPanel.style.display = "none";
    });
  }

  // Filters & Search
  if (filterStatusSelect) filterStatusSelect.addEventListener("change", renderRecordsTable);
  if (filterDateInput) filterDateInput.addEventListener("input", renderRecordsTable);
  if (filterSearchInput) filterSearchInput.addEventListener("input", renderRecordsTable);

  // Download Excel (Non_Working_Websites.xlsx)
  if (btnDownloadExcel) {
    btnDownloadExcel.addEventListener("click", () => {
      if (!currentRecords || currentRecords.length === 0) {
        showExcelSyncStatus("No error records to download yet. (Records are captured when Not Working sites are crawled)", "error");
        return;
      }

      try {
        if (typeof XLSX === "undefined") {
          showExcelSyncStatus("Excel library not loaded.", "error");
          return;
        }

        const wb = generateNonWorkingExcel(currentRecords, XLSX);
        XLSX.writeFile(wb, NON_WORKING_EXCEL_FILENAME);

        const now = Date.now();
        const syncKey = typeof NON_WORKING_SYNC_TIME_KEY !== "undefined" ? NON_WORKING_SYNC_TIME_KEY : "nonWorkingLastExcelSyncTime";
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [syncKey]: now }).catch(() => { });
        }
        try {
          chrome.runtime.sendMessage({ action: "UPDATE_LAST_SYNC_TIME", timestamp: now }, () => {
            if (chrome.runtime.lastError) { /* ignore */ }
            refreshDashboardData();
          });
        } catch (e) {
          refreshDashboardData();
        }

        showExcelSyncStatus(`✅ Downloaded cumulative ${NON_WORKING_EXCEL_FILENAME} (${currentRecords.length} records)!`, "success");
      } catch (err) {
        showExcelSyncStatus(`Download failed: ${err.message}`, "error");
      }
    });
  }

  // Append / Sync to Existing Excel
  if (btnSyncExcel) {
    btnSyncExcel.addEventListener("click", async () => {
      // Path A: File System Access API (Direct disk file read/write)
      if (typeof window.showOpenFilePicker === "function") {
        try {
          const [fileHandle] = await window.showOpenFilePicker({
            types: [{
              description: "Excel Files",
              accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }
            }],
            multiple: false
          });

          showExcelSyncStatus("Reading existing Excel file...", "loading");
          const file = await fileHandle.getFile();
          const arrayBuffer = await file.arrayBuffer();
          const parsedRows = parseNonWorkingExcel(arrayBuffer, XLSX);

          const { merged } = mergeErrorRecords(currentRecords, parsedRows);

          // Write updated dataset back to the same file
          const wb = generateNonWorkingExcel(merged, XLSX);
          const wbBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

          const writable = await fileHandle.createWritable();
          await writable.write(wbBuffer);
          await writable.close();

          const now = Date.now();
          await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              action: "APPEND_EXTERNAL_EXCEL_RECORDS",
              rows: parsedRows
            }, () => {
              chrome.runtime.sendMessage({ action: "UPDATE_LAST_SYNC_TIME", timestamp: now }, resolve);
            });
          });

          await refreshDashboardData();
          showExcelSyncStatus(`✅ Synced & appended to ${file.name}! Total: ${merged.length} records.`, "success");
          return;
        } catch (err) {
          if (err.name === "AbortError") {
            // User cancelled file picker
            return;
          }
          console.warn("File System Access failed, falling back to file input upload:", err.message);
        }
      }

      // Path B: Fallback file upload input
      if (inputExcelFile) {
        inputExcelFile.value = "";
        inputExcelFile.click();
      }
    });
  }

  // Handle uploaded Excel file via input fallback
  if (inputExcelFile) {
    inputExcelFile.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      showExcelSyncStatus(`Reading ${file.name}...`, "loading");
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const arrayBuffer = evt.target.result;
          const parsedRows = parseNonWorkingExcel(arrayBuffer, XLSX);

          const { merged, addedCount } = mergeErrorRecords(currentRecords, parsedRows);

          // Save merged records into persistent storage
          await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              action: "APPEND_EXTERNAL_EXCEL_RECORDS",
              rows: parsedRows
            }, resolve);
          });

          // Generate updated workbook and auto-download
          const wb = generateNonWorkingExcel(merged, XLSX);
          XLSX.writeFile(wb, NON_WORKING_EXCEL_FILENAME);

          const now = Date.now();
          chrome.runtime.sendMessage({ action: "UPDATE_LAST_SYNC_TIME", timestamp: now }, () => {
            refreshDashboardData();
          });

          showExcelSyncStatus(`✅ Appended ${addedCount} records from ${file.name}. Total: ${merged.length} records!`, "success");
        } catch (err) {
          showExcelSyncStatus(`Failed to read Excel: ${err.message}`, "error");
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // Clear Records (Confirmation Required - Clears both Working & Error records completely)
  if (btnClearRecords) {
    btnClearRecords.addEventListener("click", () => {
      const errorCount = (currentRecords || []).length;
      const workingCount = (currentWorkingRecords || []).length;
      const total = errorCount + workingCount;
      if (total === 0) {
        showExcelSyncStatus("There are no records to clear.", "idle");
        return;
      }

      const confirmed = window.confirm(
        `⚠️ Are you sure you want to completely clear all ${total} website records?\n\n` +
        `• Working Sites: ${workingCount}\n` +
        `• Not Working / Redirect / Not English: ${errorCount}\n\n` +
        `This will completely clear all working and non-working records from local storage. Download your Excel file first if you wish to preserve a copy.`
      );
      if (!confirmed) return;

      const clearLocally = () => {
        const recordsKey = typeof NON_WORKING_STORAGE_KEY !== "undefined" ? NON_WORKING_STORAGE_KEY : "nonWorkingRecords";
        const workingKey = typeof WORKING_STORAGE_KEY !== "undefined" ? WORKING_STORAGE_KEY : "workingRecords";
        currentRecords = [];
        currentWorkingRecords = [];
        if (typeof calculateErrorStats === "function") {
          lastFetchedStats = calculateErrorStats([], null, [], todayIsoDate);
        } else if (lastFetchedStats) {
          lastFetchedStats.totalWorking = 0;
          lastFetchedStats.totalNotWorking = 0;
          lastFetchedStats.totalRedirect = 0;
          lastFetchedStats.totalNotEnglish = 0;
          lastFetchedStats.totalHistorical = 0;
          lastFetchedStats.workingToday = 0;
          lastFetchedStats.notWorkingToday = 0;
          lastFetchedStats.redirectToday = 0;
          lastFetchedStats.notEnglishToday = 0;
          lastFetchedStats.totalToday = 0;
        }
        updateMetricsDisplay();
        if (recordsViewerPanel && recordsViewerPanel.style.display !== "none") {
          renderRecordsTable();
        }
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [recordsKey]: [], [workingKey]: [] }, () => {
            chrome.storage.local.remove([recordsKey, workingKey]).catch(() => {});
            showExcelSyncStatus("🗑️ Complete data cleared (Working & Error records).", "success");
          });
        } else {
          showExcelSyncStatus("🗑️ Complete data cleared (Working & Error records).", "success");
        }
      };

      try {
        chrome.runtime.sendMessage({ action: "CLEAR_NON_WORKING_RECORDS" }, () => {
          clearLocally();
        });
      } catch (e) {
        clearLocally();
      }
    });
  }

  // Real-time storage listener to refresh counts when extraction runs
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.nonWorkingRecords || changes.workingRecords || changes.nonWorkingLastExcelSyncTime)) {
        refreshDashboardData();
      }
    });
  }

  // Initial load of dashboard data
  refreshDashboardData();
});
