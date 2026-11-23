// Shared state store and chrome.storage.sync preference listeners for content scripts.

(function (AIExt) {
  const state = (AIExt.state = AIExt.state || {
    cachedExtractedData: null,
    lastProcessedUrl: "",
    extractionMode: "ai_only", // Default: AI Only (all items from AI only; legacy support extractionMode: "ai_first")
    showFloatingWidget: true,
    showInlineBtn: true,
    autoQueueEnabled: false,
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

  function isExtensionAlive() {
    try {
      return Boolean(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  if (isExtensionAlive() && chrome.storage && chrome.storage.sync) {
    try {
      chrome.storage.sync.get({ showFloatingWidget: true, showInlineBtn: false, autoQueueEnabled: false, crawlMode: "manual", autoSubmitNotWorkingEnabled: false, extractionMode: "ai_only" }, (res) => {
        try {
          if (!isExtensionAlive()) return;
          if (res) {
            state.showFloatingWidget = res.showFloatingWidget !== false;
            state.showInlineBtn = res.showInlineBtn === true;
            state.extractionMode = (res.extractionMode === "own_crawl") ? "own_crawl" : "ai_only";
            if (res.crawlMode !== undefined) {
              state.autoQueueEnabled = res.crawlMode === "auto" || res.crawlMode === "continuous";
            } else if (res.autoQueueEnabled !== undefined) {
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
        } catch (e) {}
      });
    } catch (e) {}

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        try {
          if (!isExtensionAlive()) return;
          if (area === "sync") {
            if (changes.extractionMode) {
              state.extractionMode = (changes.extractionMode.newValue === "own_crawl") ? "own_crawl" : "ai_only";
              const widgetMode = document.getElementById("ai-widget-extraction-mode");
              if (widgetMode) widgetMode.value = state.extractionMode;
            }
            if (changes.showFloatingWidget) {
              state.showFloatingWidget = changes.showFloatingWidget.newValue !== false;
            }
            if (changes.showInlineBtn) {
              state.showInlineBtn = changes.showInlineBtn.newValue !== false;
            }
            if (changes.crawlMode !== undefined) {
              state.autoQueueEnabled = changes.crawlMode.newValue === "auto" || changes.crawlMode.newValue === "continuous";
              const widgetToggle = document.getElementById("ai-widget-auto-queue-toggle");
              if (widgetToggle) widgetToggle.checked = state.autoQueueEnabled;
              if (!state.autoQueueEnabled && typeof AIExt.stopAutoQueuePipeline === "function") {
                AIExt.stopAutoQueuePipeline("Auto-queue disabled");
              }
            }
            if (changes.autoQueueEnabled !== undefined) {
              state.autoQueueEnabled = !!changes.autoQueueEnabled.newValue;
              const widgetToggle = document.getElementById("ai-widget-auto-queue-toggle");
              if (widgetToggle) widgetToggle.checked = state.autoQueueEnabled;
              if (!state.autoQueueEnabled && typeof AIExt.stopAutoQueuePipeline === "function") {
                AIExt.stopAutoQueuePipeline("Auto-queue disabled");
              }
            }
            if (changes.autoSubmitNotWorkingEnabled !== undefined) {
              state.autoSubmitNotWorkingEnabled = !!changes.autoSubmitNotWorkingEnabled.newValue;
              const notWorkingToggle = document.getElementById("ai-auto-submit-notworking-toggle");
              if (notWorkingToggle) notWorkingToggle.checked = state.autoSubmitNotWorkingEnabled;
            }
            if (typeof AIExt.ensureAiCrawlButtonsVisible === "function") {
              AIExt.ensureAiCrawlButtonsVisible();
            }
          }
        } catch (e) {}
      });
    } catch (e) {}
  }
})(globalThis.__AI_EXTENSION__ = globalThis.__AI_EXTENSION__ || {});
