// Shared state store and chrome.storage.sync preference listeners for content scripts.

(function (AIExt) {
  const state = (AIExt.state = AIExt.state || {
    cachedExtractedData: null,
    lastProcessedUrl: "",
    extractionMode: "ai_first",
    showFloatingWidget: true,
    showInlineBtn: true,
    autoQueueEnabled: true,
    autoSubmitNotWorkingEnabled: false,
    pendingAutoSubmitTimer: null,
    currentNotWorkingData: null,
    isAutoQueuePipelineActive: false,
    autoQueuePollTimer: null,
    isBatchNotWorkingActive: false,
    batchNotWorkingRemaining: 0,
    isCrawlingInProgress: false,
    isWaitingForUserWorkingReview: false,
    debounceTimer: null
  });

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get({ showFloatingWidget: true, showInlineBtn: true, autoQueueEnabled: true, autoSubmitNotWorkingEnabled: false, extractionMode: "ai_first" }, (res) => {
      if (res) {
        state.showFloatingWidget = res.showFloatingWidget !== false;
        state.showInlineBtn = res.showInlineBtn !== false;
        state.extractionMode = res.extractionMode || "ai_first";
        if (res.autoQueueEnabled !== undefined) {
          state.autoQueueEnabled = !!res.autoQueueEnabled;
        }
        if (typeof res.autoSubmitNotWorkingEnabled === "boolean") {
          state.autoSubmitNotWorkingEnabled = res.autoSubmitNotWorkingEnabled;
        }
      }
      const widgetMode = document.getElementById("ai-widget-extraction-mode");
      if (widgetMode) widgetMode.value = state.extractionMode;
      const widgetToggle = document.getElementById("ai-widget-auto-queue-toggle");
      if (widgetToggle) widgetToggle.checked = state.autoQueueEnabled;
      const notWorkingToggle = document.getElementById("ai-auto-submit-notworking-toggle");
      if (notWorkingToggle) notWorkingToggle.checked = state.autoSubmitNotWorkingEnabled;
      if (typeof AIExt.ensureAiCrawlButtonsVisible === "function") {
        AIExt.ensureAiCrawlButtonsVisible();
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync") {
        if (changes.extractionMode) {
          state.extractionMode = changes.extractionMode.newValue || "ai_first";
          const widgetMode = document.getElementById("ai-widget-extraction-mode");
          if (widgetMode) widgetMode.value = state.extractionMode;
        }
        if (changes.showFloatingWidget) {
          state.showFloatingWidget = changes.showFloatingWidget.newValue !== false;
        }
        if (changes.showInlineBtn) {
          state.showInlineBtn = changes.showInlineBtn.newValue !== false;
        }
        if (changes.autoQueueEnabled !== undefined) {
          state.autoQueueEnabled = !!changes.autoQueueEnabled.newValue;
          const widgetToggle = document.getElementById("ai-widget-auto-queue-toggle");
          if (widgetToggle) widgetToggle.checked = state.autoQueueEnabled;
          if (!state.autoQueueEnabled && typeof AIExt.stopAutoQueuePipeline === "function") {
            AIExt.stopAutoQueuePipeline("Auto-queue disabled");
          }
        }
        if (typeof AIExt.ensureAiCrawlButtonsVisible === "function") {
          AIExt.ensureAiCrawlButtonsVisible();
        }
      }
    });
  }
})(globalThis.__AI_EXTENSION__ = globalThis.__AI_EXTENSION__ || {});
