// Background Service Worker for AI Web Crawler & Auto Pre-Fill Assistant
// Entry point: loads environment config, shared utilities, and modular domain workers via importScripts.

// Load optional local environment configuration from env.js (synced from .env)
try { importScripts("env.js"); } catch (e) { }

// Load shared pure helpers & background modules in dependency order
importScripts(
  "src/lib/xlsx.full.min.js",
  "src/shared/text-utils.js",
  "src/shared/country-normalizer.js",
  "src/shared/phone-normalizer.js",
  "src/shared/non-working-records.js",
  "src/background/error-recorder.js",
  "src/background/config.js",
  "src/background/geo-data.js",
  "src/background/restricted-rules.js",
  "src/background/company-normalizer.js",
  "src/background/address-extractor.js",
  "src/background/address-normalizer.js",
  "src/background/location-qc.js",
  "src/background/crawler.js",
  "src/background/ai-client.js",
  "src/background/strict-qc.js"
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PING") {
    sendResponse({ success: true, pong: true });
    return false;
  }

  if (request.action === "CRAWL_AND_EXTRACT") {
    // Keep MV3 service worker alive while crawling using storage keepalive
    let keepAlive = setInterval(() => {
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ _sw_beat: Date.now() }, () => { });
        }
      } catch (e) { }
    }, 2000);

    // Bounded safety timeout: 28s (well before Chrome's 30s message channel deadline)
    let finished = false;
    const timeoutId = setTimeout(() => {
      if (finished) return;
      finished = true;
      clearInterval(keepAlive);
      console.warn("[Background] Crawl reached safety boundary (28s). Returning timeout Not Working result before channel closes.");
      try {
        const timeoutNotWorking = {
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
          errorCategory: "Unreachable / Timeout",
          errorKeyword: "Connection Timeout / Unresponsive",
          errorSourceUrl: request.url,
          errorSnippet: "Website took longer than 28 seconds to respond or server is unresponsive (Rule 1).",
          notWorkingReason: "Website took longer than 28 seconds to respond or server is unresponsive (Rule 1).",
          _finalUrl: request.url,
          _originalUrl: request.url,
          _note: "Crawl timeout reached safety boundary - Marked as Not Working (Rule 1)"
        };
        if (typeof recordNonWorkingWebsite === "function") {
          recordNonWorkingWebsite(timeoutNotWorking).catch(() => {});
        }
        sendResponse({ success: true, data: timeoutNotWorking });
      } catch (err) {
        try { sendResponse({ success: false, error: "Crawl timeout" }); } catch (e) { }
      }
    }, 28000);

    handleCrawlAndExtract(request.url, request.extractionMode)
      .then(result => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        clearInterval(keepAlive);
        try { sendResponse({ success: true, data: result }); } catch (e) { }
      })
      .catch(error => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        clearInterval(keepAlive);
        console.warn("[Background] handleCrawlAndExtract caught error:", error.message);
        try {
          const fetchErrData = {
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
            errorSourceUrl: request.url,
            notWorkingReason: `Unreachable / Failed to Fetch (${error.message || "Site error"})`,
            _note: `Unreachable / Failed to Fetch (${error.message || "Site error"}) - Marked as Not Working`
          };
          if (typeof recordNonWorkingWebsite === "function") {
            recordNonWorkingWebsite(fetchErrData).catch(() => {});
          }
          sendResponse({
            success: true,
            data: fetchErrData
          });
        } catch (e) { }
      });
    return true;
  }

  if (request.action === "TEST_API_KEY") {
    const provider = String(request.provider || DEFAULT_AI_PROVIDER || "gemini").toLowerCase();
    const fallbackCfg = AI_PROVIDERS[provider] || AI_PROVIDERS.gemini;
    testAiProviderKey({
      provider,
      apiKey: request.apiKey || fallbackCfg.defaultKey,
      modelName: request.model || fallbackCfg.defaultModel
    })
      .then(res => { try { sendResponse(res); } catch (e) { } })
      .catch(err => { try { sendResponse({ success: false, error: err.message }); } catch (e) { } });
    return true;
  }

  // Website Records Actions
  if (request.action === "RECORD_WORKING_SITE") {
    recordWorkingWebsite(request.data || request)
      .then(res => { try { sendResponse(res); } catch (e) { } })
      .catch(err => { try { sendResponse({ success: false, error: err.message }); } catch (e) { } });
    return true;
  }

  if (request.action === "RECORD_NON_WORKING_SITE") {
    recordNonWorkingWebsite(request.data || request)
      .then(res => { try { sendResponse(res); } catch (e) { } })
      .catch(err => { try { sendResponse({ success: false, error: err.message }); } catch (e) { } });
    return true;
  }

  if (request.action === "GET_NON_WORKING_RECORDS") {
    getNonWorkingRecordsAndStats(request.dateFilter || "")
      .then(res => { try { sendResponse(res); } catch (e) { } })
      .catch(err => { try { sendResponse({ success: false, error: err.message }); } catch (e) { } });
    return true;
  }

  if (request.action === "APPEND_EXTERNAL_EXCEL_RECORDS") {
    appendExternalExcelRecords(request.rows || [])
      .then(res => { try { sendResponse(res); } catch (e) { } })
      .catch(err => { try { sendResponse({ success: false, error: err.message }); } catch (e) { } });
    return true;
  }

  if (request.action === "CLEAR_NON_WORKING_RECORDS") {
    clearNonWorkingRecords()
      .then(res => { try { sendResponse(res); } catch (e) { } })
      .catch(err => { try { sendResponse({ success: false, error: err.message }); } catch (e) { } });
    return true;
  }

  if (request.action === "UPDATE_LAST_SYNC_TIME") {
    updateLastExcelSync(request.timestamp || Date.now())
      .then(res => { try { sendResponse(res); } catch (e) { } })
      .catch(err => { try { sendResponse({ success: false, error: err.message }); } catch (e) { } });
    return true;
  }
});
