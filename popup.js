// Popup UI Logic

const DEFAULT_API_KEY = "AIzaSyB5yBrU7BuuoelExXn7VV9rsrUmqztDSR4";
const DEFAULT_MODEL = "gemini-2.5-flash-lite";

document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("api-key-input");
  const toggleKeyVisibilityBtn = document.getElementById("btn-toggle-key-visibility");
  const modelSelect = document.getElementById("model-select");
  const btnSaveKey = document.getElementById("btn-save-key");
  const btnTestKey = document.getElementById("btn-test-key");
  const statusMsg = document.getElementById("api-test-status");
  const toggleAutoCrawl = document.getElementById("toggle-auto-crawl");
  const toggleStrictFilter = document.getElementById("toggle-strict-filter");
  const btnOpenTestPortal = document.getElementById("btn-open-test-portal");

  // Load existing settings or pre-configure defaults
  chrome.storage.sync.get(["apiKey", "model", "autoFillOnUrlChange", "strictFilter"], (res) => {
    apiKeyInput.value = res.apiKey || DEFAULT_API_KEY;
    modelSelect.value = res.model || DEFAULT_MODEL;
    if (res.autoFillOnUrlChange !== undefined) {
      toggleAutoCrawl.checked = res.autoFillOnUrlChange;
    } else {
      toggleAutoCrawl.checked = true;
    }
    if (res.strictFilter !== undefined) {
      toggleStrictFilter.checked = res.strictFilter;
    } else {
      toggleStrictFilter.checked = true;
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
    const autoCrawl = toggleAutoCrawl.checked;
    const strict = toggleStrictFilter.checked;

    chrome.storage.sync.set({
      apiKey: key,
      model: model,
      autoFillOnUrlChange: autoCrawl,
      strictFilter: strict
    }, () => {
      showStatus("Settings saved successfully!", "success");
    });
  });

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
