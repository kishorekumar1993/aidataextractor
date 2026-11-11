// Popup UI Logic
// Load defaults from environment configuration (env.js / .env)
function readPopupEnv(key, fallback = "") {
  return (
    (typeof globalThis !== "undefined" && globalThis.ENV && globalThis.ENV[key]) ||
    (typeof window !== "undefined" && window.ENV && window.ENV[key]) ||
    fallback
  );
}

const DEFAULT_AI_PROVIDER = readPopupEnv("AI_PROVIDER", "gemini").toLowerCase();
const DEFAULT_API_KEY = readPopupEnv("GEMINI_API_KEY", "");
const DEFAULT_MODEL = readPopupEnv("DEFAULT_MODEL", "gemini-3.5-flash-lite");
const DEFAULT_GROQ_API_KEY = readPopupEnv("GROQ_API_KEY", "");
const DEFAULT_GROQ_MODEL = readPopupEnv("GROQ_MODEL", "openai/gpt-oss-120b");

const PROVIDER_MODELS_UI = {
  gemini: [
    { value: "gemini-3.8-flash", label: "Gemini 3.8 Flash (Latest & High Accuracy)" },
    { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
    { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite (Fast & Accurate - Default)" },
    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" }
  ],
  groq: [
    { value: "openai/gpt-oss-120b", label: "GPT-OSS 120B (Default)" },
    { value: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B" },
    { value: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
    { value: "allam-2-7b", label: "ALLaM-2 7B" }
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  const extractionModeSelect = document.getElementById("extraction-mode-select");
  const providerSelect = document.getElementById("provider-select");
  const apiKeyInput = document.getElementById("api-key-input");
  const groqApiKeyInput = document.getElementById("groq-api-key-input");
  const toggleKeyVisibilityBtn = document.getElementById("btn-toggle-key-visibility");
  const toggleGroqKeyVisibilityBtn = document.getElementById("btn-toggle-groq-key-visibility");
  const modelSelect = document.getElementById("model-select");
  const btnSaveKey = document.getElementById("btn-save-key");
  const btnTestKey = document.getElementById("btn-test-key");
  const statusMsg = document.getElementById("api-test-status");
  const toggleAutoQueue = document.getElementById("toggle-auto-queue");
  const toggleStrictFilter = document.getElementById("toggle-strict-filter");
  const toggleFloatingWidget = document.getElementById("toggle-floating-widget");
  const toggleInlineBtn = document.getElementById("toggle-inline-btn");
  const btnOpenTestPortal = document.getElementById("btn-open-test-portal");
  const operatorUsernameInput = document.getElementById("operator-username-input");

  const savedModelsByProvider = {
    gemini: DEFAULT_MODEL,
    groq: DEFAULT_GROQ_MODEL
  };

  function populateModelsForProvider(provider, selectedModel) {
    const cleanProv = PROVIDER_MODELS_UI[provider] ? provider : "gemini";
    const options = [...PROVIDER_MODELS_UI[cleanProv]];
    const desired = selectedModel || savedModelsByProvider[cleanProv] || options[0].value;
    if (desired && !options.some(o => o.value === desired) && (cleanProv === "groq" ? !/^gemini-|^grok-/i.test(desired) : /^gemini-/i.test(desired))) {
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

    const activeGroupMap = {
      gemini: document.getElementById("group-gemini-key"),
      groq: document.getElementById("group-groq-key")
    };
    for (const [provKey, groupEl] of Object.entries(activeGroupMap)) {
      if (!groupEl) continue;
      groupEl.style.opacity = provKey === cleanProv ? "1" : "0.72";
    }
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
  wireVisibilityToggle(toggleGroqKeyVisibilityBtn, groqApiKeyInput);

  // Load existing settings or pre-configure defaults
  chrome.storage.sync.get([
    "aiProvider", "apiKey", "groqApiKey", "grokApiKey",
    "model", "groqModel", "extractionMode",
    "strictFilter", "showFloatingWidget", "showInlineBtn", "autoQueueEnabled", "userName"
  ], (res) => {
    let rawProv = String(res.aiProvider || DEFAULT_AI_PROVIDER || "gemini").toLowerCase();
    if (rawProv === "grok") rawProv = "groq";
    const activeProvider = PROVIDER_MODELS_UI[rawProv] ? rawProv : "gemini";

    if (operatorUsernameInput) {
      operatorUsernameInput.value = res.userName || "Operator";
    }

    if (extractionModeSelect) {
      extractionModeSelect.value = res.extractionMode || "ai_first";
    }

    const savedGroqKey = res.groqApiKey || res.grokApiKey || DEFAULT_GROQ_API_KEY;
    if (providerSelect) providerSelect.value = activeProvider;

    apiKeyInput.value = res.apiKey || DEFAULT_API_KEY;
    if (groqApiKeyInput) groqApiKeyInput.value = savedGroqKey;

    savedModelsByProvider.gemini = res.model || DEFAULT_MODEL;
    savedModelsByProvider.groq = res.groqModel || DEFAULT_GROQ_MODEL;
    populateModelsForProvider(activeProvider, savedModelsByProvider[activeProvider]);

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

  if (providerSelect) {
    providerSelect.addEventListener("change", () => {
      const nextProv = providerSelect.value;
      populateModelsForProvider(nextProv, savedModelsByProvider[nextProv]);
    });
  }

  // Auto-select Groq when pasting a gsk_ key or Gemini when pasting AIza key
  if (groqApiKeyInput) {
    groqApiKeyInput.addEventListener("input", () => {
      if (/^gsk_/i.test(groqApiKeyInput.value.trim()) && providerSelect && providerSelect.value !== "groq") {
        providerSelect.value = "groq";
        populateModelsForProvider("groq", savedModelsByProvider.groq);
      }
    });
  }
  if (apiKeyInput) {
    apiKeyInput.addEventListener("input", () => {
      if (/^AIza/i.test(apiKeyInput.value.trim()) && providerSelect && providerSelect.value !== "gemini") {
        providerSelect.value = "gemini";
        populateModelsForProvider("gemini", savedModelsByProvider.gemini);
      }
    });
  }

  modelSelect.addEventListener("change", () => {
    const prov = providerSelect ? providerSelect.value : "gemini";
    savedModelsByProvider[prov] = modelSelect.value;
  });

  // Save Settings
  btnSaveKey.addEventListener("click", () => {
    const aiProvider = providerSelect ? providerSelect.value : "gemini";
    const extractionMode = extractionModeSelect ? extractionModeSelect.value : "ai_first";
    const key = apiKeyInput.value.trim();
    const groqApiKey = groqApiKeyInput ? groqApiKeyInput.value.trim() : "";
    savedModelsByProvider[aiProvider] = modelSelect.value;

    const strict = toggleStrictFilter.checked;
    const autoQueue = toggleAutoQueue ? toggleAutoQueue.checked : true;
    const floating = toggleFloatingWidget ? toggleFloatingWidget.checked : true;
    const inline = toggleInlineBtn ? toggleInlineBtn.checked : true;

    chrome.storage.sync.set({
      aiProvider,
      extractionMode,
      apiKey: key,
      groqApiKey,
      model: savedModelsByProvider.gemini,
      groqModel: savedModelsByProvider.groq,
      strictFilter: strict,
      autoQueueEnabled: autoQueue,
      showFloatingWidget: floating,
      showInlineBtn: inline,
      userName: operatorUsernameInput ? operatorUsernameInput.value.trim() : "Operator"
    }, () => {
      showStatus("Settings saved successfully!", "success");
    });
  });

  // Instant toggles without requiring Save button
  if (extractionModeSelect) {
    extractionModeSelect.addEventListener("change", () => {
      chrome.storage.sync.set({ extractionMode: extractionModeSelect.value });
    });
  }
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

  // Test Connection for active AI provider
  btnTestKey.addEventListener("click", () => {
    let provider = providerSelect ? providerSelect.value : "gemini";
    let key = "";
    let defaultMod = DEFAULT_MODEL;
    if (provider === "groq") {
      key = (groqApiKeyInput ? groqApiKeyInput.value.trim() : "") || DEFAULT_GROQ_API_KEY;
      defaultMod = DEFAULT_GROQ_MODEL;
    } else {
      key = apiKeyInput.value.trim() || DEFAULT_API_KEY;
      defaultMod = DEFAULT_MODEL;
    }

    if (/^gsk_/i.test(key) && provider !== "groq") {
      provider = "groq";
      defaultMod = DEFAULT_GROQ_MODEL;
      if (providerSelect) providerSelect.value = "groq";
      populateModelsForProvider("groq", savedModelsByProvider.groq);
    }

    const model = modelSelect.value || defaultMod;
    const providerName = provider === "groq" ? "Groq" : "Gemini";

    showStatus(`Testing ${providerName} API connection...`, "loading");

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
        if (Array.isArray(res.availableModels) && res.availableModels.length > 0 && provider === "groq") {
          PROVIDER_MODELS_UI.groq = res.availableModels.map(m => ({ value: m, label: m }));
        }
        if (res.activeModel) {
          savedModelsByProvider[provider] = res.activeModel;
          populateModelsForProvider(provider, res.activeModel);
          chrome.storage.sync.set(provider === "groq" ? { groqModel: res.activeModel } : { model: res.activeModel });
        }
        showStatus(res.message || `Connected! ${providerName} API is active & ready.`, "success");
      } else {
        const err = res?.error || "Unknown error";
        if (/401|403|unauthorized|unauthenticated/i.test(err)) {
          const hintMap = {
            gemini: "Google Gemini keys start with 'AIzaSy...'. Check aistudio.google.com/app/apikey",
            groq: "Groq keys start with 'gsk_...'. Check console.groq.com/keys"
          };
          showStatus(`${providerName} Unauthorized: ${hintMap[provider] || err}`, "error");
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

  // =========================================================================
  // NON-WORKING WEBSITE RECORDS DASHBOARD LOGIC
  // =========================================================================
  const statNotWorking = document.getElementById("stat-not-working");
  const statRedirect = document.getElementById("stat-redirect");
  const statNotEnglish = document.getElementById("stat-not-english");
  const statTotalHistorical = document.getElementById("stat-total-historical");
  const statLastSync = document.getElementById("stat-last-sync");
  const badgeTotalRecords = document.getElementById("badge-total-records");
  const btnViewCount = document.getElementById("btn-view-count");
  const excelSyncStatus = document.getElementById("excel-sync-status");

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

  function getActiveUserName() {
    return (operatorUsernameInput && operatorUsernameInput.value.trim()) || "Operator";
  }

  if (operatorUsernameInput) {
    operatorUsernameInput.addEventListener("change", () => {
      chrome.storage.sync.set({ userName: getActiveUserName() });
    });
  }

  async function refreshDashboardData() {
    chrome.runtime.sendMessage({ action: "GET_NON_WORKING_RECORDS" }, (res) => {
      if (chrome.runtime.lastError) {
        console.warn("Could not fetch records:", chrome.runtime.lastError.message);
        return;
      }
      if (res && res.success) {
        currentRecords = Array.isArray(res.records) ? res.records : [];
        const stats = res.stats || {};
        if (statNotWorking) statNotWorking.textContent = stats.totalNotWorking || 0;
        if (statRedirect) statRedirect.textContent = stats.totalRedirect || 0;
        if (statNotEnglish) statNotEnglish.textContent = stats.totalNotEnglish || 0;
        if (statTotalHistorical) statTotalHistorical.textContent = stats.totalHistorical || 0;
        if (badgeTotalRecords) badgeTotalRecords.textContent = `${stats.totalHistorical || 0} Records`;
        if (btnViewCount) btnViewCount.textContent = stats.totalHistorical || 0;
        if (statLastSync) statLastSync.textContent = stats.lastSyncTime || "Never";

        if (recordsViewerPanel && recordsViewerPanel.style.display !== "none") {
          renderRecordsTable();
        }
      }
    });
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
    const dateVal = filterDateInput ? filterDateInput.value : "";
    const searchVal = filterSearchInput ? filterSearchInput.value : "";

    const filtered = (typeof filterErrorRecords === "function")
      ? filterErrorRecords(currentRecords, { status: statusVal, date: dateVal, search: searchVal })
      : currentRecords;

    if (filteredCountDisplay) {
      filteredCountDisplay.textContent = `Showing ${filtered.length} of ${currentRecords.length} records`;
    }

    if (!filtered || filtered.length === 0) {
      recordsTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No matching error records found.</td></tr>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const r of filtered) {
      const tr = document.createElement("tr");

      const statusCls = r["Website Status"] === "Not Working"
        ? "status-not-working"
        : (r["Website Status"] === "Redirect" ? "status-redirect" : "status-not-english");

      tr.innerHTML = `
        <td title="${escapeHtml(r.URL)}">
          <a href="${escapeHtml(r.URL)}" target="_blank" style="color: #4f46e5; text-decoration: none;">
            ${escapeHtml(truncate(r.URL, 30))}
          </a>
        </td>
        <td class="${statusCls}"><strong>${escapeHtml(r["Website Status"])}</strong></td>
        <td title="${escapeHtml(r.Reason)}">${escapeHtml(truncate(r.Reason, 38))}</td>
        <td title="${escapeHtml(r["Error URL"])}">${escapeHtml(truncate(r["Error URL"] || "-", 26))}</td>
        <td>${escapeHtml(r.Date)}</td>
        <td>${escapeHtml(r.Time)}</td>
        <td>${escapeHtml(r["User Name"] || "Operator")}</td>
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
        chrome.runtime.sendMessage({ action: "UPDATE_LAST_SYNC_TIME", timestamp: now }, () => {
          refreshDashboardData();
        });

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

          const userName = getActiveUserName();
          const { merged } = mergeErrorRecords(currentRecords, parsedRows, userName);

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

          const userName = getActiveUserName();
          const { merged, addedCount } = mergeErrorRecords(currentRecords, parsedRows, userName);

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

  // Clear Records (Confirmation Required)
  if (btnClearRecords) {
    btnClearRecords.addEventListener("click", () => {
      const total = currentRecords.length;
      if (total === 0) {
        showExcelSyncStatus("There are no records to clear.", "idle");
        return;
      }

      const confirmed = window.confirm(`⚠️ Are you sure you want to clear all ${total} historical non-working website records?\n\nThis will remove them from local storage. Download your Excel file first if you wish to preserve a copy.`);
      if (!confirmed) return;

      chrome.runtime.sendMessage({ action: "CLEAR_NON_WORKING_RECORDS" }, (res) => {
        if (res && res.success) {
          refreshDashboardData();
          showExcelSyncStatus("🗑️ All historical error records cleared.", "success");
        } else {
          showExcelSyncStatus(`Failed to clear records: ${res?.error || "Unknown error"}`, "error");
        }
      });
    });
  }

  // Real-time storage listener to refresh counts when extraction runs
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.nonWorkingRecords || changes.nonWorkingLastExcelSyncTime)) {
        refreshDashboardData();
      }
    });
  }

  // Initial load of dashboard data
  refreshDashboardData();
});
