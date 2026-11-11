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
    "strictFilter", "showFloatingWidget", "showInlineBtn", "autoQueueEnabled"
  ], (res) => {
    let rawProv = String(res.aiProvider || DEFAULT_AI_PROVIDER || "gemini").toLowerCase();
    if (rawProv === "grok") rawProv = "groq";
    const activeProvider = PROVIDER_MODELS_UI[rawProv] ? rawProv : "gemini";

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
      showInlineBtn: inline
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
});
