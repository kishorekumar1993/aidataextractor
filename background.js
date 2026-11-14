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
    const crawlAbortController = typeof AbortController !== "undefined" ? new AbortController() : null;

    const timeoutId = setTimeout(() => {
      if (finished) return;
      finished = true;
      clearInterval(keepAlive);
      if (crawlAbortController) {
        try { crawlAbortController.abort(); } catch (e) { }
      }
      console.warn("[Background] Crawl reached safety boundary (28s). Returning Manual Review / Retry Required before channel closes.");
      try {
        const timeoutReview = {
          websiteStatus: "Manual Review",
          requiresManualReview: true,
          retryRequired: true,
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
          errorCategory: "Crawl Timeout",
          errorKeyword: "Connection Timeout / Slow Response",
          errorSourceUrl: request.url,
          errorSnippet: "Website took longer than 28 seconds to respond or server is unresponsive. Retry Required / Manual Review.",
          notWorkingReason: "Website took longer than 28 seconds to respond or server is unresponsive. Retry Required / Manual Review.",
          _finalUrl: request.url,
          _originalUrl: request.url,
          _note: "Crawl timeout reached safety boundary - Marked for Manual Review / Retry Required"
        };
        // DO NOT record as confirmed Not Working in error dataset!
        sendResponse({ success: true, data: timeoutReview });
      } catch (err) {
        try { sendResponse({ success: false, error: "Crawl timeout" }); } catch (e) { }
      }
    }, 28000);

    handleCrawlAndExtract(request.url, request.extractionMode, { abortSignal: crawlAbortController ? crawlAbortController.signal : null })
      .then(result => {
        if (finished) return; // Late result after timeout: strictly ignore to prevent duplicate records!
        finished = true;
        clearTimeout(timeoutId);
        clearInterval(keepAlive);
        try { sendResponse({ success: true, data: result }); } catch (e) { }
      })
      .catch(error => {
        if (finished) return; // Late error after timeout: strictly ignore
        finished = true;
        clearTimeout(timeoutId);
        clearInterval(keepAlive);
        console.warn("[Background] handleCrawlAndExtract caught error:", error.message);
        try {
          const errMsg = String(error && error.message || "").toLowerCase();
          const isConfirmedDead = /nxdomain|enotfound|domain expired|dns failure|getaddrinfo\s+enotfound|http\s*404/i.test(errMsg);

          if (isConfirmedDead) {
            const confirmedDeadData = {
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
              errorCategory: "Domain Inaccessible",
              errorKeyword: "DNS Lookup Failed / Domain Expired",
              errorSourceUrl: request.url,
              notWorkingReason: `Confirmed Domain Failure (${error.message || "Domain not found"})`,
              _note: `Confirmed Domain Failure (${error.message || "Domain not found"}) - Marked as Not Working`
            };
            if (typeof recordNonWorkingWebsite === "function") {
              recordNonWorkingWebsite(confirmedDeadData).catch(() => {});
            }
            sendResponse({ success: true, data: confirmedDeadData });
          } else {
            // Temporary error, timeout, abort, rate limit, or network disruption -> Separate from confirmed failure!
            const temporaryErrData = {
              websiteStatus: "Manual Review",
              requiresManualReview: true,
              retryRequired: true,
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
              errorCategory: "Temporary Network / Crawl Error",
              errorKeyword: "Temporary Error",
              errorSourceUrl: request.url,
              notWorkingReason: `Temporary network/fetch issue: ${error.message || "Temporary error"}. Retry Required / Manual Review.`,
              _note: `Temporary crawl exception (${error.message || "Temporary error"}) - Marked for Manual Review / Retry Required`
            };
            // Never record temporary errors as confirmed Not Working!
            sendResponse({ success: true, data: temporaryErrData });
          }
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
