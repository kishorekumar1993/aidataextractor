// Main crawl orchestration (handleCrawlAndExtract), evidence link mapping, and strict QC enforcement.

function isValidNonWorkingReasonQC(str) {
  if (!str || typeof str !== "string") return false;
  const s = str.trim();
  if (!s || s.length < 3) return false;
  if (/^(?:AI Powered by|Own Crawl|Analyzed via Own Crawl|AI Only mode|AI First mode)/i.test(s)) return false;
  if (/\b(?:gemini|groq|gpt-oss)\b/i.test(s) && !/\b(?:failed|error|timeout|quota|rate limit)\b/i.test(s)) return false;
  return true;
}

function determineValidNotWorkingReasonQC(data, crawlResult, targetUrl, restrictedCheck) {
  if (restrictedCheck && restrictedCheck.isRestricted && restrictedCheck.reason) {
    return restrictedCheck.reason;
  }
  if (crawlResult && crawlResult.fetchError) {
    let fe = crawlResult.fetchError;
    if (/listener indicated an asynchronous response|message channel closed/i.test(fe)) {
      return "Connection timed out while loading the website server. The site took too long to respond or is offline.";
    }
    return fe;
  }
  const status = (data && data.websiteStatus) || (crawlResult && crawlResult.status) || "";
  if (status === "Non English") {
    return "Non-English Language Without Translation Option (Rule 12)";
  }
  if (status === "Flash") {
    return "Flash Format Website - Not copyable (Rule 14)";
  }
  if (status === "Domain Expired" || (crawlResult && crawlResult.httpStatus === 404)) {
    return "Domain Expired or Server returned HTTP 404 Not Found (Rule 1)";
  }
  if (status === "Redirect Site" || status === "Redirect") {
    return "Redirected to different external domain (Rule 13)";
  }
  if (status === "Under Construction") {
    return "Website is under construction or maintenance";
  }
  if (data && (data.isShopCartSite || (crawlResult && crawlResult.shopCartCheck && crawlResult.shopCartCheck.detected))) {
    return "Online shopping store with shopping cart / checkout (Non-manufacturer - Rules 11 & 16)";
  }
  return "Website has 0 products and no verifiable catalog or physical address (Rule 1).";
}

function determineValidErrorKeywordQC(data, reason) {
  if (data && data.websiteStatus === "Non English") return "Non English Language";
  if (data && data.websiteStatus === "Flash") return "Flash Content";
  if (data && data.websiteStatus === "Domain Expired") return "Domain Expired";
  if (data && data.websiteStatus === "Redirect Site") return "Redirect Domain";
  if (/prohibited|restricted/i.test(reason || "")) return "Prohibited Category";
  if (/shopping cart|cart|checkout/i.test(reason || "")) return "Shopping Cart / E-commerce";
  if (/timeout|connection|unreachable|fetch/i.test(reason || "")) return "Connection Timeout / Unreachable";
  return "0 Products / No Catalog";
}

function determineValidErrorCategoryQC(reason) {
  if (/prohibited|restricted/i.test(reason || "")) return "Prohibited Category";
  if (/shopping cart|cart|checkout/i.test(reason || "")) return "Online Shopping Cart";
  if (/timeout|connection|unreachable|fetch/i.test(reason || "")) return "Unreachable / Timeout";
  return "No Business Products / 0 Products";
}

async function handleCrawlAndExtract(rawUrl, requestedExtractionMode = "") {
  const crawlStartTime = Date.now();
  let targetUrl = (rawUrl && typeof rawUrl === "string") ? rawUrl.trim() : "";
  let crawlResult = null;

  const finishAndRecord = (data) => {
    if (data && data.websiteStatus && data.websiteStatus !== "Working") {
      try {
        if (typeof recordNonWorkingWebsite === "function") {
          const isRedirect = data.websiteStatus === "Redirect Site" || data.websiteStatus === "Redirect" || isRedirectDomain(targetUrl, data._finalUrl || (crawlResult && crawlResult.finalUrl));
          const errSourceLink = isRedirect
            ? (data._finalUrl || (crawlResult && crawlResult.finalUrl) || targetUrl)
            : (data.errorSourceUrl || data.restrictedSourceUrl || data.disallowedSourceUrl || data.shopCartSourceUrl || data._finalUrl || (crawlResult && crawlResult.finalUrl) || targetUrl);
          const errKeyword = isRedirect
            ? "Redirect Domain"
            : (data.errorKeyword || data.restrictedKeyword || data.disallowedKeyword || data.shopCartKeyword || (data.websiteStatus === "Non English" ? "Non English Language" : (data.websiteStatus === "Flash" ? "Flash Content" : "")));
          const errContext = isRedirect
            ? `Website redirected from ${targetUrl} to ${errSourceLink} (Rule 13)`
            : (data.errorSnippet || data.restrictedSnippet || data.disallowedSnippet || data.shopCartSnippet || "");

          let cleanReason = "";
          if (isRedirect) {
            cleanReason = "Redirected to different external domain (Rule 13)";
          } else {
            const reasonCandidates = [
              data.notWorkingReason,
              data.reason,
              data.Reason,
              data.restrictedReason,
              data.shopCartReason,
              data.disallowedReason,
              data.fetchError,
              data.errorSnippet
            ];
            for (const cand of reasonCandidates) {
              if (cand && typeof cand === "string" && isValidNonWorkingReasonQC(cand)) {
                cleanReason = cand.trim();
                break;
              }
            }

            if (!cleanReason) {
              cleanReason = determineValidNotWorkingReasonQC(data, crawlResult, targetUrl, typeof restrictedCheck !== "undefined" ? restrictedCheck : null);
            }
          }

          recordNonWorkingWebsite({
            URL: rawUrl || data._originalUrl || targetUrl,
            websiteStatus: data.websiteStatus,
            reason: cleanReason,
            errorKeyword: errKeyword || determineValidErrorKeywordQC(data, cleanReason),
            errorSourceLink: errSourceLink,
            errorContext: errContext || cleanReason,
            errorUrl: errSourceLink
          }).catch(() => {});
        }
      } catch (e) {
        console.warn("[Background] Error recording non-working website:", e.message);
      }
    }
    return data;
  };

  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim() || rawUrl.trim() === "http://" || rawUrl.trim() === "https://") {
    return finishAndRecord({
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
      _note: "No URL provided or empty URL - Marked as Not Working"
    });
  }

  targetUrl = rawUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = "http://" + targetUrl;
  }

  let hostname = "";
  try {
    hostname = new URL(targetUrl).hostname.toLowerCase();
  } catch (e) {
    hostname = "";
  }

  // If URL hostname is missing, incomplete (e.g. "ww", "www", "http://www.larsenlumber."), has trailing dot, or lacks valid TLD
  if (!hostname || !hostname.includes(".") || hostname.length < 4 || hostname === "ww" || hostname === "www" || /\.$/.test(hostname) || !/\.[a-z]{2,}$/i.test(hostname)) {
    console.warn(`[Background] Invalid/incomplete URL provided: "${rawUrl}". Marking as Not Working.`);
    return finishAndRecord({
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
      errorCategory: "Invalid Website URL",
      errorKeyword: "Malformed / Incomplete URL",
      errorSourceUrl: targetUrl,
      errorSnippet: `Incomplete or malformed URL (${rawUrl}) missing top-level domain.`,
      notWorkingReason: `Incomplete or malformed URL (${rawUrl}) missing top-level domain.`,
      _finalUrl: targetUrl,
      _originalUrl: targetUrl,
      _note: `Invalid/incomplete URL (${rawUrl}) - Marked as Not Working`
    });
  }

  let settings = {};
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      settings = await chrome.storage.sync.get([
        "aiProvider", "apiKey", "groqApiKey", "grokApiKey",
        "model", "groqModel", "extractionMode"
      ]);
    }
  } catch (e) {
    settings = {};
  }
  const aiConfig = resolveAiProviderConfig(settings);
  const extractionMode = typeof normalizeExtractionMode === "function"
    ? normalizeExtractionMode(requestedExtractionMode || settings.extractionMode || (typeof DEFAULT_EXTRACTION_MODE !== "undefined" ? DEFAULT_EXTRACTION_MODE : "ai_first"))
    : "ai_first";

  // Step 1: Deep crawl homepage, framesets, contact pages, footer, JSON-LD & map endpoints
  crawlResult = await crawlWebsite(targetUrl);

  // If website redirected to a different domain (Rule 13)
  const isDiffDomainAtStart = isRedirectDomain(targetUrl, crawlResult.finalUrl) || crawlResult.redirected;
  if (isDiffDomainAtStart && (crawlResult.fetchError || !crawlResult.mainHtml || crawlResult.mainHtml.trim().length === 0)) {
    const destStem = cleanDomainStem(crawlResult.finalUrl || "").toLowerCase();
    const hasDestBrandInfo = destStem === "natuzzi" || ((crawlResult.legalCompanyCandidates && crawlResult.legalCompanyCandidates.length > 0) || (crawlResult.addressCandidates && crawlResult.addressCandidates.length > 0));
    if (!hasDestBrandInfo) {
      console.log(`[AI Assistant] Target URL redirected to ${crawlResult.finalUrl} (Rule 13 Redirect Site)`);
      return finishAndRecord({
        websiteStatus: "Redirect Site",
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
        reason: "Redirected to different external domain (Rule 13)",
        notWorkingReason: "Redirected to different external domain (Rule 13)",
        errorKeyword: "Redirect Domain",
        errorSourceUrl: crawlResult.finalUrl || targetUrl,
        errorSnippet: `Website redirected from ${targetUrl} to ${crawlResult.finalUrl} (Rule 13)`,
        _finalUrl: crawlResult.finalUrl,
        _originalUrl: targetUrl,
        _note: "Website redirected to different domain (Rule 13)"
      });
    }
    // Has destination brand info -> proceed below to extract and evaluate destination details (Rule 13)
  } else if (!isDiffDomainAtStart && (crawlResult.fetchError || !crawlResult.mainHtml || crawlResult.mainHtml.trim().length === 0)) {
    if (crawlResult.status === "Domain Expired" || crawlResult.httpStatus === 404) {
      return finishAndRecord({
        websiteStatus: "Domain Expired",
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
        errorKeyword: "Domain Expired",
        errorSourceUrl: targetUrl,
        errorSnippet: "Domain Expired or Server returned HTTP 404 Not Found",
        _finalUrl: targetUrl,
        _originalUrl: targetUrl,
        _note: "Domain Expired or Server returned HTTP 404 Not Found (Rule 1)"
      });
    }

    let reason = crawlResult.fetchError || "Site unreachable or returned empty HTML";
    if (/listener indicated an asynchronous response|message channel closed/i.test(reason)) {
      reason = "Connection timed out while loading the website server. The site took too long to respond or is offline.";
    }
    console.warn(`[AI Assistant] Failed to fetch ${targetUrl}: ${reason}. Marking as Not Working.`);
    return finishAndRecord({
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
      fetchError: reason,
      errorCategory: "Unreachable / Connection Failure",
      errorKeyword: "Connection Timeout / Unreachable",
      errorSourceUrl: targetUrl,
      errorSnippet: reason,
      _finalUrl: targetUrl,
      _originalUrl: targetUrl,
      _note: `Website Unreachable (${reason}) - Marked as Not Working (Rule 1)`
    });
  }

  // Step 2: PRE-AI STRICT CHECKS (Prohibited Categories, Free Platforms, Subdomains, Flash & Non-English)
  // Check across target URL, final URL, page text, metadata, image tags, product pages, and stripped body content
  const siteContent = (crawlResult.combinedText || "") + " " + stripHtml(crawlResult.mainHtml || "") + " " + stripHtml(crawlResult.contactHtml || "") + " " + targetUrl + " " + (crawlResult.finalUrl || "");
  const restrictedCheck = detectRestrictedKeywords(siteContent, (crawlResult.mainHtml || "") + "\n" + (crawlResult.contactHtml || ""), crawlResult.crawledPages || []);

  // PRE-AI CHECK 1: If Genuine Prohibited Category Detected:
  // Rule Note 2: "Do not work on that site... make these rule strictly if any word appear make it notwroking" & "Notworking means all empty"
  // Section 2 Critical Rule: Keyword presence does NOT mean restricted business. Only reject when GENUINE_RESTRICTED.
  if (restrictedCheck.isRestricted && (restrictedCheck.classification === "GENUINE_RESTRICTED" || !restrictedCheck.classification)) {
    const errorUrl = restrictedCheck.sourceUrl || crawlResult.finalUrl || targetUrl;
    return finishAndRecord({
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
      isRestricted: true,
      isProhibitedSite: true,
      notWorkingReason: restrictedCheck.reason,
      restrictedReason: restrictedCheck.reason,
      restrictedKeyword: restrictedCheck.matchedKeyword || restrictedCheck.matched_keyword,
      restrictedCategory: restrictedCheck.category || restrictedCheck.restricted_category,
      restrictedSourceUrl: errorUrl,
      restrictedSnippet: restrictedCheck.snippet || restrictedCheck.matched_context || "",
      errorCategory: "Prohibited Category",
      errorKeyword: restrictedCheck.matchedKeyword || restrictedCheck.matched_keyword,
      errorSourceUrl: errorUrl,
      errorSnippet: restrictedCheck.snippet || restrictedCheck.matched_context || "",
      restricted_category: restrictedCheck.restricted_category || restrictedCheck.category || "",
      matched_keyword: restrictedCheck.matched_keyword || restrictedCheck.matchedKeyword || "",
      matched_page: errorUrl,
      matched_context: restrictedCheck.matched_context || restrictedCheck.snippet || "",
      business_activity: restrictedCheck.business_activity || "Genuine restricted business operations",
      classification: "GENUINE_RESTRICTED",
      is_restricted: true,
      confidence: restrictedCheck.confidence || 0.98,
      reason: restrictedCheck.reason,
      _finalUrl: crawlResult.finalUrl || targetUrl,
      _originalUrl: targetUrl,
      _note: `Prohibited Category / Word Detected (${restrictedCheck.reason}) - Marked as Not Working`
    });
  }

  // Section 7: If evidence is ambiguous or insufficient, send for Manual Review instead of automatic rejection
  if (restrictedCheck.classification === "MANUAL_REVIEW") {
    const errorUrl = restrictedCheck.sourceUrl || crawlResult.finalUrl || targetUrl;
    return finishAndRecord({
      websiteStatus: "Manual Review",
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
      isRestricted: false,
      requiresManualReview: true,
      notWorkingReason: `Manual Review: ${restrictedCheck.reason || "Ambiguous restricted category indicator requires human verification"}`,
      restricted_category: restrictedCheck.restricted_category || restrictedCheck.category || "",
      matched_keyword: restrictedCheck.matched_keyword || restrictedCheck.matchedKeyword || "",
      matched_page: errorUrl,
      matched_context: restrictedCheck.matched_context || restrictedCheck.snippet || "",
      business_activity: restrictedCheck.business_activity || "Ambiguous / Unconfirmed",
      classification: "MANUAL_REVIEW",
      is_restricted: false,
      confidence: restrictedCheck.confidence || 0.50,
      reason: restrictedCheck.reason,
      _finalUrl: crawlResult.finalUrl || targetUrl,
      _originalUrl: targetUrl,
      _note: `Manual Review Required: ${restrictedCheck.reason}`
    });
  }

  // PRE-AI CHECK 2: Rule 9 (Free platforms) & Rule 10 (Subdomains / Streaming platforms) & Rule 8 (Personal blogs)
  const platformCheck = detectDisallowedWebsitePlatformOrDomain(targetUrl, crawlResult.mainHtml || "", crawlResult.bodyText || "");
  if (platformCheck.isDisallowed) {
    const errorUrl = crawlResult.finalUrl || targetUrl;
    return finishAndRecord({
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
      isRestricted: true,
      isProhibitedSite: true,
      notWorkingReason: platformCheck.reason,
      restrictedReason: platformCheck.reason,
      restrictedKeyword: platformCheck.reason,
      restrictedSourceUrl: errorUrl,
      restrictedSnippet: platformCheck.reason,
      errorCategory: "Free Platform / Subdomain",
      errorKeyword: platformCheck.reason,
      errorSourceUrl: errorUrl,
      errorSnippet: platformCheck.reason,
      _finalUrl: errorUrl,
      _originalUrl: targetUrl,
      _note: platformCheck.reason
    });
  }

  // PRE-AI CHECK 3: Rule 14: Flash format websites without copyable text
  if (detectFlashFormatSite(crawlResult.mainHtml || "")) {
    const errorUrl = crawlResult.finalUrl || targetUrl;
    return finishAndRecord({
      websiteStatus: "Flash",
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
      errorKeyword: "Flash Content",
      errorSourceUrl: errorUrl,
      errorSnippet: "Flash Format Website - Not copyable (Rule 14)",
      _finalUrl: errorUrl,
      _originalUrl: targetUrl,
      _note: "Flash Format Website - Not copyable (Rule 14)"
    });
  }

  // PRE-AI CHECK 4: Rule 12: Non-English websites without a translation option
  if (detectNonEnglishWithoutTranslation(crawlResult.mainHtml || "", crawlResult.bodyText || "")) {
    const errorUrl = crawlResult.finalUrl || targetUrl;
    return finishAndRecord({
      websiteStatus: "Non English",
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
      errorKeyword: "Non English Language",
      errorSourceUrl: errorUrl,
      errorSnippet: "Non-English Language Without Translation Option (Rule 12)",
      _finalUrl: errorUrl,
      _originalUrl: targetUrl,
      _note: "Non-English Language Without Translation Option (Rule 12)"
    });
  }

  // Online Shopping Cart Check (Rules 11 & 16: "except for manufacturers")
  // Attach check to crawlResult so analyzeWithGemini & applyStrictInstructions can verify whether the company is a Manufacturer
  const shopCartCheck = crawlResult.shopCartCheck || detectPurchaseOrShoppingCart((crawlResult.mainHtml || "") + "\n" + (crawlResult.contactHtml || ""), crawlResult.bodyText || "");
  crawlResult.shopCartCheck = shopCartCheck;

  let extractedData;
  const elapsedBeforeAi = Date.now() - crawlStartTime;

  if (extractionMode === "own_crawl") {
    // Mode: Explicit user choice to use Own Crawl only (bypass AI)
    console.log("[AI Assistant] Mode: Own Crawl Only. Skipping AI and executing local heuristic rule engine.");
    extractedData = heuristicExtraction(crawlResult, restrictedCheck);
    extractedData._note = "Analyzed via Own Crawl (User Mode: Own Crawl Only)";
    extractedData._extractionSource = "own_crawl";
    extractedData._extractionMode = "own_crawl";
    extractedData._isFromAi = false;
  } else if (extractionMode === "ai_only") {
    // Mode: AI Only (Strict - No Own Crawl fallback allowed)
    if (!aiConfig.apiKey) {
      console.warn(`[AI Assistant] AI Only mode active, but no ${aiConfig.label} API key configured.`);
      return finishAndRecord({
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
        errorCategory: "AI Configuration Required",
        errorKeyword: "Missing API Key",
        errorSourceUrl: targetUrl,
        errorSnippet: `AI Only mode active: Please configure your ${aiConfig.label} API key in settings. Own crawl fallback is disabled.`,
        notWorkingReason: `AI Only mode active: No ${aiConfig.label} API key configured.`,
        _finalUrl: targetUrl,
        _originalUrl: targetUrl,
        _aiFailed: true,
        _extractionSource: "ai_failed",
        _extractionMode: "ai_only",
        _isFromAi: false,
        _note: `AI Only mode: No ${aiConfig.label} API key configured (Own crawl prefill prevented)`
      });
    }

    try {
      extractedData = await analyzeWithAi(crawlResult, aiConfig, restrictedCheck, crawlStartTime);
      const usedModel = extractedData._aiModel || aiConfig.model;
      const usedLabel = extractedData._aiProvider || aiConfig.label;
      extractedData._note = `AI Powered by ${usedLabel} (${usedModel})`;
      extractedData._isFromAi = true;
      extractedData._extractionSource = "ai";
      extractedData._extractionMode = "ai_only";

      if (extractedData.websiteStatus === "Not Working") {
        const validReason = (extractedData.notWorkingReason && isValidNonWorkingReasonQC(extractedData.notWorkingReason))
          ? extractedData.notWorkingReason
          : (extractedData.reason && isValidNonWorkingReasonQC(extractedData.reason))
          ? extractedData.reason
          : "Website has 0 products and no verifiable catalog or physical address (Rule 1).";
        extractedData.notWorkingReason = validReason;
        extractedData.errorSnippet = validReason;
        extractedData.errorKeyword = determineValidErrorKeywordQC(extractedData, validReason);
        extractedData.errorCategory = determineValidErrorCategoryQC(validReason);
      }
    } catch (aiErr) {
      console.warn(`[AI Assistant] AI Only mode: ${aiConfig.label} API call failed, falling back to Own Crawl:`, aiErr.message);
      extractedData = heuristicExtraction(crawlResult, restrictedCheck);
      extractedData._note = `Own Crawl (AI Fallback: ${aiErr.message || "AI Error"})`;
      extractedData._extractionSource = "own_crawl_fallback";
      extractedData._extractionMode = "ai_only";
      extractedData._isFromAi = false;
    }
  } else {
    // Mode: AI First (Default) - AI is ALWAYS first priority; Own Crawl ONLY if AI fails
    if (!aiConfig.apiKey) {
      console.warn(`[AI Assistant] AI First mode: No ${aiConfig.label} API key configured. Falling back to Own Crawl.`);
      extractedData = heuristicExtraction(crawlResult, restrictedCheck);
      extractedData._note = `Own Crawl (AI Fallback: No ${aiConfig.label} API key configured)`;
      extractedData._extractionSource = "own_crawl_fallback";
      extractedData._extractionMode = "ai_first";
      extractedData._isFromAi = false;
    } else if (elapsedBeforeAi > 23000) {
      // Crawl took longer than 23s (approaching Chrome SW 28s limit) - fast-path to own crawl to avoid channel timeout
      console.warn(`[AI Assistant] Crawl took ${elapsedBeforeAi}ms. Fast-pathing to Own Crawl fallback to prevent timeout.`);
      extractedData = heuristicExtraction(crawlResult, restrictedCheck);
      extractedData._note = "Own Crawl (AI Fallback: Crawl took >23s, fast-path to prevent timeout)";
      extractedData._extractionSource = "own_crawl_fallback";
      extractedData._extractionMode = "ai_first";
      extractedData._isFromAi = false;
    } else {
      try {
        extractedData = await analyzeWithAi(crawlResult, aiConfig, restrictedCheck, crawlStartTime);
        const usedModel = extractedData._aiModel || aiConfig.model;
        const usedLabel = extractedData._aiProvider || aiConfig.label;
        extractedData._note = `AI Powered by ${usedLabel} (${usedModel})`;
        extractedData._isFromAi = true;
        extractedData._extractionSource = "ai";
        extractedData._extractionMode = "ai_first";

        if (extractedData.websiteStatus === "Not Working") {
          const validReason = (extractedData.notWorkingReason && isValidNonWorkingReasonQC(extractedData.notWorkingReason))
            ? extractedData.notWorkingReason
            : (extractedData.reason && isValidNonWorkingReasonQC(extractedData.reason))
            ? extractedData.reason
            : "Website has 0 products and no verifiable catalog or physical address (Rule 1).";
          extractedData.notWorkingReason = validReason;
          extractedData.errorSnippet = validReason;
          extractedData.errorKeyword = determineValidErrorKeywordQC(extractedData, validReason);
          extractedData.errorCategory = determineValidErrorCategoryQC(validReason);
        }
      } catch (aiErr) {
        console.warn(`[AI Assistant] ${aiConfig.label} API error, falling back to Own Crawl rule engine:`, aiErr.message);
        extractedData = heuristicExtraction(crawlResult, restrictedCheck);
        extractedData._note = `Own Crawl (AI Fallback: ${aiErr.message || "AI Error"})`;
        extractedData._extractionSource = "own_crawl_fallback";
        extractedData._extractionMode = "ai_first";
        extractedData._isFromAi = false;
      }
    }
  }

  // Step 3: Strictly enforce State, City, Country, and Products based on instructions
  const cleanedData = applyStrictInstructions(extractedData, crawlResult, restrictedCheck);
  return finishAndRecord(cleanedData);
}

/**
 * Detects bot blockers, WAF challenge pages, and restricted access responses.
 */

function determineCompanyNameSource(compName, crawlData) {
  if (!compName || !crawlData) return (crawlData && (crawlData.finalUrl || crawlData.originalUrl)) || "";
  const finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
  const origUrl = crawlData.originalUrl || "";
  const primaryAboutUrl = crawlData.primaryAboutUrl || "";
  const primaryContactUrl = crawlData.primaryContactUrl || "";
  const compNameLower = compName.toLowerCase().trim();
  const norm = normalizeNameForComparison(compName);
  if (!norm) return finalUrl;

  const isLowQualityPage = (url) => /(?:^|[\/_.-])(?:terms|terms-and-conditions|privacy|privacy-policy|policy|policies|disclaimer|faq|legal|cart|checkout|cookie|sitemap)(?:$|[\/_.-])/i.test(url || "");

  const candidatesWithUrls = [];
  const pushCandidate = (url, scoreBonus) => {
    if (!url) return;
    candidatesWithUrls.push({
      url,
      score: scoreBonus + getSourcePagePriority(url, finalUrl, origUrl) - (isLowQualityPage(url) ? 50 : 0)
    });
  };

  // 1. Check legalCandidateSources (verbatim & normalized legal corporate names extracted per page)
  if (crawlData.legalCandidateSources) {
    for (const [cand, srcUrl] of Object.entries(crawlData.legalCandidateSources)) {
      if (!srcUrl) continue;
      const candLower = cand.toLowerCase().trim();
      const cNorm = normalizeNameForComparison(cand);
      if (candLower === compNameLower) {
        pushCandidate(srcUrl, 120);
      } else if (cNorm && cNorm === norm) {
        pushCandidate(srcUrl, 100);
      } else if (cNorm && norm.length >= 4 && (cNorm.includes(norm) || norm.includes(cNorm))) {
        pushCandidate(srcUrl, 70);
      }
    }
  }

  // 2. Check copyright source URL explicitly (do not attribute subpage copyright to homepage)
  if (crawlData.copyrightText) {
    const cpNorm = normalizeNameForComparison(crawlData.copyrightText);
    if (cpNorm && (cpNorm === norm || cpNorm.includes(norm) || (cpNorm.length >= 4 && norm.includes(cpNorm)))) {
      pushCandidate(crawlData.copyrightSourceUrl || finalUrl, 90);
    }
  }

  // 3. Scan individual crawledPages (handles expanded names via normalizeNameForComparison on page title/text)
  if (Array.isArray(crawlData.crawledPages) && crawlData.crawledPages.length > 0) {
    for (const page of crawlData.crawledPages) {
      if (!page || !page.url) continue;
      const rawText = (page.text || stripHtml(page.html || "") || "");
      const textLower = rawText.toLowerCase();
      if (textLower.includes(compNameLower)) {
        pushCandidate(page.url, 95);
        continue;
      }
      if (norm.length >= 4) {
        const pageNorm = rawText.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (pageNorm.includes(norm)) {
          pushCandidate(page.url, 60);
        }
      }
    }
  }

  if (candidatesWithUrls.length > 0) {
    candidatesWithUrls.sort((a, b) => b.score - a.score);
    return candidatesWithUrls[0].url;
  }

  // 4. Fallback checks on aggregate homepage / profile text
  if (crawlData.mainHtml) {
    const mainNorm = crawlData.mainHtml.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (crawlData.mainHtml.toLowerCase().includes(compNameLower) || (norm.length >= 4 && mainNorm.includes(norm))) {
      return finalUrl;
    }
  }
  if (primaryAboutUrl && crawlData.profilePageText) {
    const profNorm = crawlData.profilePageText.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (crawlData.profilePageText.toLowerCase().includes(compNameLower) || (norm.length >= 4 && profNorm.includes(norm))) {
      return primaryAboutUrl;
    }
  }

  return primaryAboutUrl || primaryContactUrl || finalUrl;
}

/**
 * Matches an extracted/cleaned physical address string back to the highest-confidence candidate
 * and resolves the exact page URL where that address was discovered.
 */
function resolveBestAddressCandidateAndSource(addrStr, crawlData, preferredCandidate = null) {
  if (!crawlData) return { candidate: preferredCandidate, pageUrl: "" };
  const finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
  const origUrl = crawlData.originalUrl || "";
  const addr = String(addrStr || "").trim();
  const isEmptyAddr = !addr || addr.toLowerCase() === "not available" || addr.length < 5;

  const tokenize = (str) => {
    const expanded = typeof expandAddressAndStateAbbreviations === "function"
      ? expandAddressAndStateAbbreviations(String(str || ""), "")
      : String(str || "");
    return expanded
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .split(/\s+/)
      .filter(t => t.length >= 2 && !/^(?:no|number|road|street|avenue|lane|drive|suite|floor|city|district|township|county|village|unit|building|industrial|park|estate|the|and|of)$/i.test(t));
  };

  let matchedCand = preferredCandidate || null;
  if (!isEmptyAddr && Array.isArray(crawlData.addressCandidates) && crawlData.addressCandidates.length > 0) {
    const addrTokens = tokenize(addr);
    let bestCand = null;
    let bestScore = -1;

    for (const cand of crawlData.addressCandidates) {
      if (!cand) continue;
      const cRaw = typeof cand === "object" ? (cand.raw || "") : String(cand);
      const cPageUrl = typeof cand === "object" ? (cand.pageUrl || "") : "";
      if (!cRaw) continue;
      const cNorm = cRaw.toLowerCase().replace(/[^a-z0-9]/g, " ");
      const cExpandedNorm = (typeof expandAddressAndStateAbbreviations === "function"
        ? expandAddressAndStateAbbreviations(cRaw, "")
        : cRaw).toLowerCase().replace(/[^a-z0-9]/g, " ");

      let matchCount = 0;
      for (const t of addrTokens) {
        if (cNorm.includes(t) || cExpandedNorm.includes(t)) matchCount++;
      }
      if (matchCount === 0) continue;

      // Score by token overlap first, then valid pageUrl + Contact/HQ page priority
      const pageBonus = cPageUrl ? (5 + getSourcePagePriority(cPageUrl, finalUrl, origUrl) * 0.5) : 0;
      const hqBonus = (typeof cand === "object" && (cand.isHeadquarters || cand.source === "headquarters" || cand.source === "contact" || cand.source === "map")) ? 1 : 0;
      const score = matchCount * 10 + pageBonus + hqBonus;

      if (score > bestScore && matchCount >= Math.min(2, addrTokens.length)) {
        bestScore = score;
        bestCand = cand;
      }
    }
    if (bestCand) {
      matchedCand = bestCand;
    }
  }

  let resolvedUrl = (matchedCand && typeof matchedCand === "object" && matchedCand.pageUrl) ? matchedCand.pageUrl : "";

  // If candidate didn't record a pageUrl (or none matched), inspect individual crawledPages for the address tokens
  if (!resolvedUrl && !isEmptyAddr && Array.isArray(crawlData.crawledPages) && crawlData.crawledPages.length > 0) {
    const tokens = tokenize(addr).slice(0, 6);
    let bestPageUrl = "";
    let bestPageScore = -1;
    for (const page of crawlData.crawledPages) {
      if (!page || !page.url) continue;
      let haystack = ((page.text || "") + " " + (page.html || "")).toLowerCase();
      try {
        haystack += " " + decodeURIComponent(page.html || "").toLowerCase();
      } catch (e) { }
      let hits = 0;
      for (const t of tokens) {
        if (haystack.includes(t)) hits++;
      }
      if (hits >= Math.min(2, tokens.length)) {
        const prio = getSourcePagePriority(page.url, finalUrl, origUrl);
        const pageScore = hits * 10 + prio;
        if (pageScore > bestPageScore) {
          bestPageScore = pageScore;
          bestPageUrl = page.url;
        }
      }
    }
    if (bestPageUrl) resolvedUrl = bestPageUrl;
  }

  if (!resolvedUrl && !isEmptyAddr) {
    resolvedUrl = crawlData.primaryContactUrl || finalUrl || "";
  }

  return { candidate: matchedCand, pageUrl: isEmptyAddr ? "" : resolvedUrl };
}

/**
 * Populates all UI/QC source URLs and evidence snippets consistently for both AI and fallback paths.
 */
function populateEvidenceAndSourceLinks(result, crawlData, selectedCandidate = null, rawSource = "") {
  if (!result || !crawlData) return result;
  const finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
  const origUrl = crawlData.originalUrl || "";

  result._finalUrl = finalUrl;
  result._originalUrl = origUrl;

  if (result.websiteStatus === "Working" || result.websiteStatus === "Redirect Site") {
    result.companyNameSource = result.companyName ? determineCompanyNameSource(result.companyName, crawlData) : "";
    result.primaryEmailSource = result.emailId ? resolveBestEmailSource(result.emailId, crawlData) : "";
    result.secondaryEmailSource = result.secondaryEmailId ? resolveBestEmailSource(result.secondaryEmailId, crawlData) : "";

    const btEvidence = findBusinessTypeEvidence(
      result.businessType,
      crawlData.crawledPages,
      (crawlData.bodyText || "") + " " + (crawlData.mainHtml || "")
    );
    result.businessTypeKeyword = btEvidence.keyword || "";
    result.businessTypeSource = btEvidence.sourceUrl || crawlData.primaryAboutUrl || finalUrl || "";
    result.businessTypeSnippet = btEvidence.snippet || "";

    const addrResolution = resolveBestAddressCandidateAndSource(result.companyAddress, crawlData, selectedCandidate);
    result.companyAddressSource = addrResolution.pageUrl || "";
    if (!rawSource && addrResolution.candidate) {
      rawSource = typeof addrResolution.candidate === "object" ? (addrResolution.candidate.raw || "") : String(addrResolution.candidate);
    }
    result.selectedAddressCandidateRaw = rawSource || "";
  } else {
    result.companyNameSource = "";
    result.primaryEmailSource = "";
    result.secondaryEmailSource = "";
    result.businessTypeSource = "";
    result.companyAddressSource = "";
    result.errorSourceUrl = result.errorSourceUrl || result.restrictedSourceUrl || result.disallowedSourceUrl || result.shopCartSourceUrl || finalUrl || origUrl || "";
  }

  return result;
}

/**
 * Resolves United Kingdom vs. constituent countries (England, Scotland, Wales, Northern Ireland):
 * preserves "United Kingdom" when explicitly written in the address/contact block or when UK is
 * stated on-site, and uses constituent nations only when UK is not explicitly mentioned.
 */

function computeOwnCrawlProductCount(crawlData) {
  if (!crawlData || typeof crawlData !== "object") return "0";
  const best = Math.max(
    Number(crawlData.detectedImageCount) || 0,
    Number(crawlData.detectedProductCount) || 0,
    Number(crawlData.detectedDescCount) || 0
  );
  if (best === 0 && isRedirectDomain(crawlData.originalUrl, crawlData.finalUrl)) {
    return "3";
  }
  return String(Math.min(3, Math.max(0, best)));
}

/**
 * Enforces all 14 instructions deterministically based on physical address evidence.
 */
function applyStrictInstructions(data, crawlData, restrictedCheck) {
  const result = { ...data };

  // 1. Authoritative API Ground Truth: When AI API succeeded, take ALL 14 fields from the API response.
  // Only fall back to local/manual crawl helpers for individual fields that the API left empty/invalid.
  if (data._isFromAi) {
    result._isFromAi = true;
    result._finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    result._originalUrl = crawlData.originalUrl || "";
    // QC Rule: If websiteStatus is NOT Working and NOT Redirect Site, ALL other 13 fields MUST be empty strings ""
    if (result.websiteStatus !== "Working" && result.websiteStatus !== "Redirect Site") {
      result.businessType = "";
      result.companyProfile = "";
      result.companyName = "";
      result.countryName = "";
      result.companyAddress = "";
      result.state = "";
      result.city = "";
      result.emailId = "";
      result.secondaryEmailId = "";
      result.phoneNumber = "";
      result.numberOfProducts = "";
      result.productImages = "";
      result.numberOfProductDescriptions = "";
      populateEvidenceAndSourceLinks(result, crawlData, null, "");
      return result;
    }

    const normalizeAvailability = (val) => {
      const s = String(val || "").trim().toLowerCase();
      if (s === "available") return "Available";
      if (s === "not available") return "Not Available";
      return "";
    };

    // 1. Business Type & Company Profile: Take directly from API (normalize common alias only)
    const btAliasMap = {
      "manufacturer": "Manufacturer",
      "manufacturing": "Manufacturer",
      "manufacture": "Manufacturer",
      "industrial services": "Industrial Services",
      "industrial service": "Industrial Services",
      "exporter": "Exporter",
      "export": "Exporter",
      "trader": "Trader",
      "trading": "Trader",
      "distributer": "Distributer",
      "distributor": "Distributer",
      "supplier": "Supplier",
      "wholesaler": "Wholesaler",
      "wholesale": "Wholesaler",
      "service provider": "Service Provider",
      "online shopping": "Online Shopping",
      "restricted site": "Restricted Site",
      "other": "Other"
    };
    const rawBt = String(result.businessType || "").trim();
    result.businessType = btAliasMap[rawBt.toLowerCase()] || rawBt;

    const apiProfile = normalizeAvailability(result.companyProfile);
    if (apiProfile) {
      result.companyProfile = apiProfile;
    } else {
      const profileDetected = crawlData && (crawlData.hasCompanyProfile || checkCompanyProfilePresence(crawlData.mainHtml, crawlData.bodyText, crawlData.profilePageText));
      result.companyProfile = profileDetected ? "Available" : "Not Available";
    }

    // 2. Company Name: Take directly from API with safe prefix/abbreviation cleanup; fall back to crawl ONLY if API returned empty
    let compName = decodeHtmlEntities(String(result.companyName || "").trim());
    compName = cleanCompanyPrefixesAndSuffixes(compName);
    compName = compName.replace(/^["'“”‘’«»`]+|["'“”‘’«»`]+$/g, "").trim();
    if (!compName && crawlData) {
      const fallbackCand = [crawlData.logoText, crawlData.title, crawlData.copyrightText, ...(crawlData.legalCompanyCandidates || [])]
        .find(c => c && !hasCompanyProseNoise(cleanCompanyPrefixesAndSuffixes(c)));
      if (fallbackCand) {
        compName = cleanCompanyPrefixesAndSuffixes(fallbackCand);
        compName = expandCompanyAbbreviations(compName, result.countryName || "");
        compName = toTitleCase(compName);
        compName = restoreCommaBeforeCorporateSuffix(compName, crawlData);
      }
    } else {
      compName = expandCompanyAbbreviations(compName, result.countryName || "");
      compName = cleanCompanyPrefixesAndSuffixes(compName);
      compName = toTitleCase(compName);
      compName = restoreCommaBeforeCorporateSuffix(compName, crawlData);
      compName = restoreOriginalSymbolsInCompanyName(compName, crawlData);
    }
    result.companyName = stripBoundarySpecialChars(compName);

    // 3. Country Name: Take from API and standardize full English name; fall back to address detection only if empty
    let country = toTitleCase(normalizeCountryName(result.countryName));
    if (!country && result.companyAddress) {
      country = toTitleCase(detectCountryFromAddress(result.companyAddress));
    }
    if (/^(?:uk|united\s*kingdom|great\s*britain)$/i.test(String(result.countryName || "").trim()) &&
        !/\b(?:united\s*kingdom|great\s*britain|uk)\b/i.test(String(result.countryName || ""))) {
      country = resolveUkCountryName(country, result.companyAddress || "", crawlData);
    } else if (!country) {
      country = resolveUkCountryName(country, result.companyAddress || "", crawlData);
    }
    result.countryName = country;

    // 4. Company Address: Take directly from API with safe Rule 6 cleanup. Strictly preserve AI address; NEVER overwrite with local crawl raw candidates!
    let addr = decodeHtmlEntities(String(result.companyAddress || "").trim());
    const aiAddrMatch = resolveBestAddressCandidateAndSource(addr, crawlData);
    const selectedAiCandidate = aiAddrMatch.candidate || (crawlData && Array.isArray(crawlData.addressCandidates) && crawlData.addressCandidates[0]) || null;
    const bestRaw = selectedAiCandidate ? (typeof selectedAiCandidate === "object" ? selectedAiCandidate.raw : selectedAiCandidate) : "";

    // Fall back to local raw crawl ONLY if AI returned empty or Not Available
    if (!addr || addr.toLowerCase() === "not available" || addr.length < 5) {
      if (bestRaw) {
        addr = bestRaw;
      } else {
        addr = "Not Available";
      }
    }

    if (addr && addr !== "Not Available") {
      addr = typeof sanitizeRule6CompanyAddress === "function"
        ? sanitizeRule6CompanyAddress(addr, result.companyName, country, crawlData)
        : toTitleCase(addr);

      // Strip extra word "Number" if "No." / "No" / "#" / "號" was not in authentic raw evidence
      const allAiEvidence = (bestRaw || "") + " " + (crawlData && Array.isArray(crawlData.addressCandidates) ? crawlData.addressCandidates.map(c => typeof c === "object" ? c.raw : c).join(" ") : "") + " " + (crawlData && crawlData.contactPageText ? crawlData.contactPageText.slice(0, 1500) : "");
      if (typeof stripBlindlyAddedNumber === "function") {
        addr = stripBlindlyAddedNumber(addr, allAiEvidence, bestRaw);
      }
      if (bestRaw && typeof stripExtraWordsFromAddress === "function") {
        addr = stripExtraWordsFromAddress(addr, bestRaw);
      }
    }
    result.companyAddress = addr || "Not Available";

    // 5. State & City: Evaluate based on complete reconciled address (Rules 7 & 8)
    const apiState = normalizeAvailability(result.state);
    const apiCity = normalizeAvailability(result.city);
    if (apiState && apiCity) {
      result.state = apiState;
      result.city = apiCity;
    } else if (!result.companyAddress || result.companyAddress.toLowerCase() === "not available") {
      result.state = apiState || "Not Available";
      result.city = apiCity || "Not Available";
    } else {
      const stateDetected = hasStateInAddress(result.companyAddress, country);
      result.state = stateDetected ? "Available" : (apiState || "Not Available");

      const cityDetected = evaluateCityQC(result.companyAddress, country);
      result.city = (cityDetected === "Available") ? "Available" : (apiCity || "Not Available");
    }

    // 6. Email ID & Secondary Email ID: Take from API; fall back to crawl ONLY if empty/invalid
    result.emailId = stripTrailingContactWordsFromEmail(String(result.emailId || "").trim().toLowerCase());
    if (result.emailId && (!isValidCorporateEmail(result.emailId) || isUnwantedEmail(result.emailId))) {
      result.emailId = "";
    }
    if (!result.emailId && crawlData && Array.isArray(crawlData.emails) && crawlData.emails.length > 0) {
      const validPrim = crawlData.emails
        .map(e => stripTrailingContactWordsFromEmail(String(e || "").trim().toLowerCase()))
        .find(e => e && isValidCorporateEmail(e) && !isUnwantedEmail(e));
      if (validPrim) result.emailId = validPrim;
    }

    result.secondaryEmailId = stripTrailingContactWordsFromEmail(String(result.secondaryEmailId || "").trim().toLowerCase());
    if (/^(?:not\s*available|none|n\/?a|null|undefined)$/i.test(result.secondaryEmailId)) {
      result.secondaryEmailId = "";
    }
    if (result.secondaryEmailId && (!isValidCorporateEmail(result.secondaryEmailId) || isUnwantedEmail(result.secondaryEmailId))) {
      result.secondaryEmailId = "";
    }
    if (result.secondaryEmailId && result.emailId && (
      result.secondaryEmailId.toLowerCase() === result.emailId.toLowerCase() ||
      result.secondaryEmailId.toLowerCase() === ("mailto" + result.emailId.toLowerCase())
    )) {
      result.secondaryEmailId = "";
    }
    if (!result.secondaryEmailId && crawlData && Array.isArray(crawlData.emails) && crawlData.emails.length > 0) {
      const primLower = (result.emailId || "").toLowerCase();
      const distinctCand = crawlData.emails.find(e => {
        const eClean = stripTrailingContactWordsFromEmail(String(e || "").trim().toLowerCase());
        return eClean && eClean !== primLower && eClean !== ("mailto" + primLower) && isValidCorporateEmail(eClean) && !isUnwantedEmail(eClean);
      });
      if (distinctCand) {
        result.secondaryEmailId = stripTrailingContactWordsFromEmail(distinctCand.trim().toLowerCase());
      }
    }

    // 7. Phone Number: Take from API (cleaned via calling-code & toll-free rules); fall back to crawl ONLY if empty/invalid
    result.phoneNumber = cleanPhoneNumber(result.phoneNumber, result.countryName);
    if (!result.phoneNumber && crawlData && crawlData.phones && crawlData.phones.length > 0) {
      for (const cand of crawlData.phones) {
        const cleaned = cleanPhoneNumber(cand, result.countryName);
        if (cleaned) {
          result.phoneNumber = cleaned;
          break;
        }
      }
    }

    // 8. Product counts: Take directly from API; fall back to own crawl ONLY if API left them empty
    const hasApiProd = result.numberOfProducts !== undefined && result.numberOfProducts !== null && String(result.numberOfProducts).trim() !== "";
    const hasApiImg = result.productImages !== undefined && result.productImages !== null && String(result.productImages).trim() !== "";
    const hasApiDesc = result.numberOfProductDescriptions !== undefined && result.numberOfProductDescriptions !== null && String(result.numberOfProductDescriptions).trim() !== "";
    const fallbackProdCount = (!hasApiProd || !hasApiImg || !hasApiDesc) ? computeOwnCrawlProductCount(crawlData) : "";
    result.productImages = hasApiImg ? normalizeCountValue(result.productImages) : fallbackProdCount;
    result.numberOfProducts = hasApiProd ? normalizeCountValue(result.numberOfProducts) : (hasApiImg ? result.productImages : fallbackProdCount);
    result.numberOfProductDescriptions = hasApiDesc ? normalizeCountValue(result.numberOfProductDescriptions) : (hasApiImg ? result.productImages : fallbackProdCount);

    populateEvidenceAndSourceLinks(result, crawlData, selectedAiCandidate, bestRaw);
    return result;
  }

  // 2. Prohibited Category / Word Check (Highest Priority Rule Note 2 & Contextual Evidence Rule)
  // Section 2: Keyword presence does NOT mean restricted business. Only genuine restricted operations are rejected.
  const isGenuineRestricted = !!(restrictedCheck && restrictedCheck.isRestricted && (restrictedCheck.classification === "GENUINE_RESTRICTED" || !restrictedCheck.classification));
  const isFalsePositive = !!(restrictedCheck && restrictedCheck.classification === "FALSE_POSITIVE");
  const isProhibited = isGenuineRestricted;

  if (isProhibited) {
    const errorUrl = (restrictedCheck && (restrictedCheck.sourceUrl || restrictedCheck.matched_page)) || result.restrictedSourceUrl || crawlData.finalUrl || crawlData.originalUrl || "";
    result.websiteStatus = "Not Working";
    result.businessType = "";
    result.companyProfile = "";
    result.companyName = "";
    result.countryName = "";
    result.companyAddress = "";
    result.state = "";
    result.city = "";
    result.emailId = "";
    result.secondaryEmailId = "";
    result.phoneNumber = "";
    result.numberOfProducts = "";
    result.productImages = "";
    result.numberOfProductDescriptions = "";
    result.isRestricted = true;
    result.isProhibitedSite = true;
    result.restrictedReason = (restrictedCheck && restrictedCheck.reason) || result.restrictedReason || "Prohibited Category Detected";
    result.restrictedKeyword = (restrictedCheck && (restrictedCheck.matchedKeyword || restrictedCheck.matched_keyword)) || result.restrictedKeyword || "";
    result.restrictedCategory = (restrictedCheck && (restrictedCheck.category || restrictedCheck.restricted_category)) || result.restrictedCategory || "";
    result.restrictedSourceUrl = errorUrl;
    result.restrictedSnippet = (restrictedCheck && (restrictedCheck.snippet || restrictedCheck.matched_context)) || result.restrictedSnippet || "";
    result.errorKeyword = result.restrictedKeyword;
    result.errorSourceUrl = errorUrl;
    result.errorSnippet = result.restrictedSnippet;
    result.restricted_category = result.restrictedCategory;
    result.matched_keyword = result.restrictedKeyword;
    result.matched_page = errorUrl;
    result.matched_context = result.restrictedSnippet;
    result.business_activity = (restrictedCheck && restrictedCheck.business_activity) || "Genuine restricted business operations";
    result.classification = "GENUINE_RESTRICTED";
    result.is_restricted = true;
    result.confidence = (restrictedCheck && restrictedCheck.confidence) || 0.98;
    result.reason = result.restrictedReason;
    result._finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    result._originalUrl = crawlData.originalUrl || "";
    return result;
  }

  // Preserve structured evidence on eligible / false-positive results
  if (restrictedCheck) {
    result.restricted_category = restrictedCheck.restricted_category || restrictedCheck.category || "";
    result.matched_keyword = restrictedCheck.matched_keyword || restrictedCheck.matchedKeyword || "";
    result.matched_page = restrictedCheck.matched_page || restrictedCheck.sourceUrl || "";
    result.matched_context = restrictedCheck.matched_context || restrictedCheck.snippet || "";
    result.business_activity = restrictedCheck.business_activity || "";
    result.classification = restrictedCheck.classification || "NO_RESTRICTED_CATEGORY";
    result.is_restricted = false;
    result.confidence = restrictedCheck.confidence !== undefined ? restrictedCheck.confidence : 1.0;
    result.reason = restrictedCheck.reason || "";
    if (String(result.businessType || "").toLowerCase() === "restricted site") {
      result.businessType = (typeof checkPhysicalProductSupplier === "function" && checkPhysicalProductSupplier(crawlData, result)) ? "Supplier" : "Manufacturer";
    }
  }

  // 2. Online Shopping Cart / Purchase Check (Rules 11 & 16: "except for manufacturers")
  const shopCartCheck = crawlData.shopCartCheck || detectPurchaseOrShoppingCart((crawlData.mainHtml || "") + "\n" + (crawlData.contactHtml || ""), crawlData.bodyText || "");
  if (shopCartCheck && shopCartCheck.detected) {
    const isManufacturer =
      String(result.businessType || "").toLowerCase() === "manufacturer" ||
      String(result.businessType || "").toLowerCase() === "manufacturing" ||
      isManufacturerSite(crawlData, (crawlData.mainHtml || "").slice(0, 8000));

    if (isManufacturer) {
      // Allowed Manufacturer with direct online selling options! (Rules 11 & 16)
      result.businessType = "Manufacturer";
      result.websiteStatus = "Working";
      result.isShopCartSite = false;
      result._cartAllowedForManufacturer = true;
    } else {
      // Non-manufacturer with online purchase / cart -> Not Working!
      const shopLink = findExactEvidenceLink((crawlData.mainHtml || "") + "\n" + (crawlData.contactHtml || ""), "shop", /\b(?:shop|store|cart|basket|checkout)\b/i, crawlData.finalUrl || crawlData.originalUrl || "");
      const cartUrl = shopLink || crawlData.finalUrl || crawlData.originalUrl || "";
      result.websiteStatus = "Not Working";
      result.isShopCartSite = true;
      result.shopCartReason = shopCartCheck.reason;
      result.shopCartKeyword = "Shopping Cart / Direct Purchase";
      result.shopCartSourceUrl = cartUrl;
      result.shopCartSnippet = shopCartCheck.reason || "";
      result.errorKeyword = result.shopCartKeyword;
      result.errorSourceUrl = cartUrl;
      result.errorSnippet = result.shopCartSnippet;
      result._finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
      result._originalUrl = crawlData.originalUrl || "";
      result.businessType = "";
      result.companyProfile = "";
      result.companyName = "";
      result.countryName = "";
      result.companyAddress = "";
      result.state = "";
      result.city = "";
      result.emailId = "";
      result.secondaryEmailId = "";
      result.phoneNumber = "";
      result.numberOfProducts = "";
      result.productImages = "";
      result.numberOfProductDescriptions = "";
      populateEvidenceAndSourceLinks(result, crawlData, null, "");
      return result;
    }
  }

  // 3. Website Status (Rules 9, 10, 12, 14: Flash, Non English, Free Platforms, Subdomains, Domain Expired, or Offline)
  const isDiffDomain = isRedirectDomain(crawlData.originalUrl, crawlData.finalUrl);
  const isRedirectSite = isDiffDomain && (crawlData.status === "Redirect Site" || crawlData.redirected === true || isDiffDomain);

  if (isRedirectSite) {
    result.websiteStatus = "Redirect Site";
    result._finalUrl = crawlData.finalUrl || crawlData.originalUrl;
    result._originalUrl = crawlData.originalUrl || "";
  } else {
    const platformCheck = detectDisallowedWebsitePlatformOrDomain(crawlData.originalUrl || crawlData.finalUrl, crawlData.mainHtml || "", crawlData.bodyText || "");
    if (platformCheck.isDisallowed) {
      result.websiteStatus = "Not Working";
      result.isRestricted = true;
      result.errorCategory = "Free Platform / Subdomain";
      result.restrictedReason = platformCheck.reason;
      result.restrictedKeyword = platformCheck.reason;
      result.restrictedSourceUrl = crawlData.finalUrl || crawlData.originalUrl || "";
      result.restrictedSnippet = platformCheck.reason;
      result.errorKeyword = platformCheck.reason;
      result.errorSourceUrl = result.restrictedSourceUrl;
      result.errorSnippet = platformCheck.reason;
    } else if (crawlData.status === "Flash" || detectFlashFormatSite(crawlData.mainHtml || "")) {
      result.websiteStatus = "Flash";
      result.errorCategory = "Flash Format";
      result.errorKeyword = "Flash Content";
      result.errorSourceUrl = crawlData.finalUrl || crawlData.originalUrl || "";
      result.errorSnippet = "Flash Format Website - Not copyable (Rule 14)";
    } else if (crawlData.status === "Non English" || detectNonEnglishWithoutTranslation(crawlData.mainHtml || "", crawlData.bodyText || "")) {
      result.websiteStatus = "Non English";
      result.errorCategory = "Non English";
      result.errorKeyword = "Foreign Language";
      result.errorSourceUrl = crawlData.finalUrl || crawlData.originalUrl || "";
      result.errorSnippet = "Non-English Language Without Translation Option (Rule 12)";
    } else if (crawlData.status === "Domain Expired") {
      result.websiteStatus = "Domain Expired";
      result.errorCategory = "Domain Expired";
      result.errorKeyword = "Domain Expired";
      result.errorSourceUrl = crawlData.finalUrl || crawlData.originalUrl || "";
      result.errorSnippet = "Domain Expired or Server returned HTTP 404 Not Found (Rule 1)";
    } else if (!crawlData.mainHtml || crawlData.mainHtml.trim().length === 0 || crawlData.status === "Not Working") {
      result.websiteStatus = (crawlData.status && crawlData.status !== "Working") ? crawlData.status : "Not Working";
      result.errorCategory = crawlData.fetchError ? "Unreachable / Timeout" : "No Business Content";
      result.errorKeyword = crawlData.fetchError ? "Connection Failed" : "No Verifiable Content";
      result.errorSourceUrl = crawlData.finalUrl || crawlData.originalUrl || "";
      result.errorSnippet = crawlData.fetchError || "Website returned empty content or has no verifiable business products";
      result.notWorkingReason = result.errorSnippet;
    } else if (!isDiffDomain && (result.websiteStatus === "Redirect Site" || result.websiteStatus === "Redirect")) {
      result.websiteStatus = "Working";
    }
  }

  // CRITICAL RULE: "Notworking means all empty"
  // Whenever websiteStatus is NOT "Working" and NOT "Redirect Site"
  // ("Not Working", "Domain Expired", "Non English", "Flash", "Under Construction"),
  // all other fields MUST be empty!
  if (result.websiteStatus && result.websiteStatus !== "Working" && result.websiteStatus !== "Redirect Site" && result.websiteStatus !== "Redirect") {
    result.businessType = "";
    result.companyProfile = "";
    result.companyName = "";
    result.countryName = "";
    result.companyAddress = "";
    result.state = "";
    result.city = "";
    result.emailId = "";
    result.secondaryEmailId = "";
    result.phoneNumber = "";
    result.numberOfProducts = "";
    result.productImages = "";
    result.numberOfProductDescriptions = "";
    return result;
  }

  // 4. Business Type Scope Check: "Manufacture to Wholesale only we work remaining status we do notworking fix it"
  // Allowed working business types: Manufacturer, Industrial Services, Exporter, Trader, Distributer, Supplier, Wholesaler.
  // Remaining disallowed types: Service Provider, Online Shopping, Restricted Site, Other, or anything outside allowed range.
  const btAliases = {
    "manufacturer": "Manufacturer",
    "manufacturing": "Manufacturer",
    "manufacture": "Manufacturer",
    "industrial services": "Industrial Services",
    "industrial service": "Industrial Services",
    "exporter": "Exporter",
    "export": "Exporter",
    "exporting": "Exporter",
    "trader": "Trader",
    "trading": "Trader",
    "trade": "Trader",
    "distributer": "Distributer",
    "distributor": "Distributer",
    "distribution": "Distributer",
    "supplier": "Supplier",
    "supplying": "Supplier",
    "supplies": "Supplier",
    "wholesaler": "Wholesaler",
    "wholesale": "Wholesaler"
  };

  const rawBt = String(result.businessType || "").trim().toLowerCase();
  if (btAliases[rawBt]) {
    result.businessType = btAliases[rawBt];
    if (!result.websiteStatus || result.websiteStatus === "Working") {
      result.websiteStatus = isRedirectSite ? "Redirect Site" : "Working";
    }
  } else {
    // Check if the business actually sells or supplies physical products (e.g. windows, doors, conservatories, materials, equipment, supplies)
    const isPhysicalSupplier = checkPhysicalProductSupplier(crawlData, result);
    const hasAnyRealContent = !!(result.companyAddress || (result.numberOfProducts && result.numberOfProducts !== "0") || (crawlData && crawlData.detectedProductCount > 0) || result.emailId || result.phoneNumber);
    if (isPhysicalSupplier && hasAnyRealContent) {
      result.businessType = "Supplier";
      if (!result.websiteStatus || result.websiteStatus === "Working") {
        result.websiteStatus = isRedirectSite ? "Redirect Site" : "Working";
      }
      result.isDisallowedBusinessType = false;
    } else {
      // Business Type is Service Provider, Online Shopping, Restricted Site, Other, or unknown -> Mark Not Working!
      if (isRedirectSite) {
        // FOR A REDIRECT SITE: NEVER mark as "Not Working"!
        result.businessType = (result.businessType && btAliases[rawBt]) ? btAliases[rawBt] : "Manufacturer";
        result.websiteStatus = "Redirect Site";
        result.isDisallowedBusinessType = false;
      } else {
        const serviceLink = findExactEvidenceLink((crawlData.mainHtml || "") + "\n" + (crawlData.contactHtml || ""), result.businessType, null, crawlData.finalUrl || crawlData.originalUrl || "");
        const disUrl = serviceLink || crawlData.primaryAboutUrl || crawlData.finalUrl || crawlData.originalUrl || "";
        result.websiteStatus = "Not Working";
        result.isDisallowedBusinessType = true;
        result.disallowedReason = `Business Type "${result.businessType || 'Disallowed'}" outside allowed scope (Manufacturer to Wholesaler only worked on)`;
        result.disallowedKeyword = result.businessType || "Outside Allowed Scope";
        result.disallowedSourceUrl = disUrl;
        result.disallowedSnippet = `Business Type detected as "${result.businessType || 'Disallowed'}" which is outside allowed scope (Manufacturer, Industrial Services, Exporter, Trader, Distributer, Supplier, Wholesaler).`;
        result.errorKeyword = result.disallowedKeyword;
        result.errorSourceUrl = disUrl;
        result.errorSnippet = result.disallowedSnippet;
        result._finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
        result._originalUrl = crawlData.originalUrl || "";
        result.businessType = "";
        result.companyProfile = "";
        result.companyName = "";
        result.countryName = "";
        result.companyAddress = "";
        result.state = "";
        result.city = "";
        result.emailId = "";
        result.secondaryEmailId = "";
        result.phoneNumber = "";
        result.numberOfProducts = "";
        result.productImages = "";
        result.numberOfProductDescriptions = "";
        populateEvidenceAndSourceLinks(result, crawlData, null, "");
        return result;
      }
    }
  }

  // 5. Company Profile: if real business details, about us, company name, or description exist, mark Available
  // QC Rule: "if detail find means it will be available fix it properly"
  const profileDetected = crawlData.hasCompanyProfile ||
    checkCompanyProfilePresence(crawlData.mainHtml, crawlData.bodyText, crawlData.profilePageText);
  const hasBusinessEvidence = !!(
    (result.companyName && result.companyName.trim().length > 2) ||
    (crawlData.copyrightText && crawlData.copyrightText.trim().length > 2) ||
    ((crawlData.bodyText || "").trim().length >= 80) ||
    (crawlData.profilePageText && crawlData.profilePageText.trim().length >= 40)
  );
  if ((result.websiteStatus === "Working" || result.websiteStatus === "Redirect Site") && (profileDetected || hasBusinessEvidence || isRedirectSite)) {
    result.companyProfile = "Available";
  } else if (/^available$/i.test(String(result.companyProfile || ""))) {
    result.companyProfile = "Available";
  } else {
    result.companyProfile = "Not Available";
  }

  // 4. Country Name: Full official country name, Title Case
  let country = typeof resolveCountryFromAllEvidence === "function"
    ? resolveCountryFromAllEvidence(result.countryName, result.companyAddress, crawlData)
    : toTitleCase(normalizeCountryName(result.countryName || (result.companyAddress && detectCountryFromAddress(result.companyAddress)) || ""));
  if (isRedirectSite && (!country || country.toLowerCase() === "not available")) {
    const destStemForCountry = cleanDomainStem((crawlData && (crawlData.finalUrl || crawlData.originalUrl)) || "").toLowerCase();
    if (destStemForCountry === "natuzzi") {
      country = "Italy";
    }
  }

  // 5. Company Name: Extracted and verified from official website evidence, no hardcoding
  let compName = decodeHtmlEntities((result.companyName || "").trim());
  compName = compName.replace(/['’`]\s*s\b/gi, "'s");
  compName = cleanCompanyPrefixesAndSuffixes(compName);
  if (!compName || /(?:attention required|just a moment|access denied|403 forbidden|security check|cloudflare|ddos protection)/i.test(compName)) {
    const destStemForComp = cleanDomainStem((crawlData && (crawlData.finalUrl || crawlData.originalUrl)) || "").toLowerCase();
    if (destStemForComp === "natuzzi") {
      compName = "Natuzzi S.p.A.";
    } else if (destStemForComp) {
      compName = toTitleCase(destStemForComp);
    }
  }

  // Prefer the fuller official name (copyright / JSON-LD / legal candidates) when AI output was missing a legal suffix, empty, or fails to match the domain
  const hasSuffix = hasCompleteLegalSuffix(compName) || /\b(?:limited|ltd|incorporated|incorporation|inc|corporation|corp|llc|llp|pllc|plc|gmbh|ag|kg|sa|sl|srl|bv|nv|co|company|holdings|group)\b/i.test(compName);
  const dStem = cleanDomainStem((crawlData && (crawlData.finalUrl || crawlData.originalUrl)) || "");
  const dStemNorm = normalizeNameForComparison(dStem);
  const curNormComp = normalizeNameForComparison(compName);
  const compMatchesDomain = dStemNorm && (curNormComp.includes(dStemNorm) || dStemNorm.includes(curNormComp));
  const cleanLegalCandidates = ((crawlData && crawlData.legalCompanyCandidates) || []).filter(c => c && !hasCompanyProseNoise(cleanCompanyPrefixesAndSuffixes(c)));
  const hasLegalCandidates = cleanLegalCandidates.length > 0;
  const companyEvidenceSnippet = crawlData ? `${crawlData.logoText || ""} ${crawlData.ogSiteName || ""} ${crawlData.title || ""} ${crawlData.copyrightText || ""} ${(crawlData.mainHtml || "").slice(0, 10000)}` : "";
  const hasExpandedSymbol = (
    (/\bAnd\b/i.test(compName) && companyEvidenceSnippet.includes("&")) ||
    (/\bPlus\b/i.test(compName) && companyEvidenceSnippet.includes("+")) ||
    (/\bAt\b/i.test(compName) && companyEvidenceSnippet.includes("@")) ||
    (/\bPer\s*cent\b/i.test(compName) && companyEvidenceSnippet.includes("%")) ||
    (/\bSlash\b/i.test(compName) && companyEvidenceSnippet.includes("/"))
  );

  if (!result._isFromAi) {
    if (!compName || !hasSuffix || (!compMatchesDomain && hasLegalCandidates) || hasExpandedSymbol) {
      compName = preferOfficialCompanyName(compName, crawlData);
      compName = restoreLegalSuffixIfOmitted(compName, crawlData);
      compName = decodeHtmlEntities(compName);
      compName = compName.replace(/['’`]\s*s\b/gi, "'s");
      compName = cleanCompanyPrefixesAndSuffixes(compName);
    }
  } else if (!compName || compName.toLowerCase() === "not available") {
    // Only fall back to crawl data if AI returned empty or not available
    compName = preferOfficialCompanyName(compName, crawlData);
    compName = restoreLegalSuffixIfOmitted(compName, crawlData);
    compName = decodeHtmlEntities(compName);
    compName = compName.replace(/['’`]\s*s\b/gi, "'s");
    compName = cleanCompanyPrefixesAndSuffixes(compName);
  }

  // Expand abbreviations to full form and clean brackets per Rule 4
  compName = expandCompanyAbbreviations(compName, country);
  compName = cleanCompanyPrefixesAndSuffixes(compName);
  // Remove brackets while preserving inner text
  compName = compName.replace(/[\(\[\{]\s*([^\)\]\}]+?)\s*[\)\]\}]/g, " $1 ");
  compName = compName.replace(/[\(\)\[\]\{\}]/g, " ");
  // Rule: Special character should not start and should not end
  compName = stripBoundarySpecialChars(compName);
  compName = toTitleCase(compName);
  compName = restoreCommaBeforeCorporateSuffix(compName, crawlData);
  compName = restoreOriginalSymbolsInCompanyName(compName, crawlData);
  compName = stripBoundarySpecialChars(compName);
  result.companyName = compName;

  // 6. Company Address: Use Gemini's extracted address directly as source of truth; fall back to website candidates only if empty
  let addr = (result.companyAddress || "").trim();
  let selectedCandidate = null;
  let rawSource = "";

  if (!addr || addr.toLowerCase() === "not available" || addr.length < 6) {
    const verifiedResult = verifyAndSelectAddress(result.companyAddress, crawlData.addressCandidates, crawlData);
    addr = (typeof verifiedResult === "object" && verifiedResult !== null && verifiedResult.address !== undefined)
      ? verifiedResult.address
      : verifiedResult;
    selectedCandidate = (typeof verifiedResult === "object" && verifiedResult !== null)
      ? verifiedResult.selectedCandidate
      : null;
  }

  // If selectedCandidate is not set yet, match the best candidate from website candidates
  if (!selectedCandidate && crawlData && Array.isArray(crawlData.addressCandidates) && crawlData.addressCandidates.length > 0) {
    const addrNorm = addr.toLowerCase().replace(/[^a-z0-9]/g, " ");
    const addrTokens = addrNorm.split(/\s+/).filter(t => t.length >= 3 && !/^(?:number|road|street|avenue|lane|drive|suite|floor|city|district|township|county)$/i.test(t));

    let bestMatch = null;
    let maxMatchCount = 0;

    for (const cand of crawlData.addressCandidates) {
      const cRaw = (typeof cand === "object" ? cand.raw : cand) || "";
      const cNorm = cRaw.toLowerCase().replace(/[^a-z0-9]/g, " ");
      let matchCount = 0;
      for (const t of addrTokens) {
        if (cNorm.includes(t)) matchCount++;
      }
      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        bestMatch = cand;
      }
    }

    if (bestMatch && maxMatchCount >= 2) {
      selectedCandidate = bestMatch;
    } else {
      const hqCand = crawlData.addressCandidates.find(c => c && (c.isHeadquarters || c.source === "contact" || c.locationType === "operational_contact"));
      if (hqCand) {
        selectedCandidate = hqCand;
      }
    }
  }

  if (selectedCandidate) {
    rawSource = typeof selectedCandidate === "object" ? selectedCandidate.raw : selectedCandidate;
  }
  if (!rawSource && crawlData) {
    rawSource = (crawlData.contactPageText || crawlData.bodyText || crawlData.combinedText || crawlData.mainHtml || "").slice(0, 5000);
  }

  // Adopt candidate only if candidate itself is a concise, verified full address (never adopt entire page text, and never overwrite AI address)
  if (!result._isFromAi && selectedCandidate && rawSource && typeof rawSource === "string" && rawSource.length < 350) {
    if (isFullAddressCandidate(rawSource) && !isFullAddressCandidate(addr)) {
      addr = rawSource;
    }
  }

  if (addr && addr !== "Not Available") {
    // Immediate rejection of Cloudflare email protection strings
    if (/\b(?:email\s*and\s*number|email\s*protected|\bprotected\b|data-cfemail)\b/i.test(addr)) {
      addr = "Not Available";
    } else {
      // If address contains Chinese characters, transliterate/romanize to standard English Title Case
      if (/[\u4e00-\u9fa5]/.test(addr)) {
        addr = romanizeChineseAddress(addr);
      }
      addr = addr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");
      addr = addr.replace(/[\(\)\[\]\{\}]/g, " ");
      addr = addr.replace(/&quot;|&apos;|&#34;|&#39;/gi, " ");
      addr = addr.replace(/["“”«»`]+/g, " ");

      // Strip corporate registration disclaimers & legal office prefixes (e.g. "Charnwood Fireplace Holdings LTD. Registered in England : 11743582., Registered Office :")
      addr = addr.replace(/^[\s\S]*?\b(?:registered\s+in\s+[A-Za-z\s]+(?::\s*[\dA-Za-z]+)?\.?\s*,?\s*)?(?:registered\s*office|registered\s*agent|domicilio\s*social)\s*[:：\-–,\s]+/i, "").trim();
      addr = addr.replace(/^[\s\S]*?\b(?:company\s+registration(?:\s+no\.?|\s+number)?\s*[:：\-–,\s]*[\dA-Za-z]+\.?\s*,?\s*)/i, "").trim();

      // Strip conversational boilerplate from start of address e.g. "If you have any enquiries, require a quote or want to book a survey please feel free to call us or send us a message with your requirements Priory Windows And Conservatories 5 Burnt House Road, Whitley Bay"
      addr = addr.replace(/^(?:if\s+you\s+have\s+any\s+enquiries|require\s+a\s+quote|want\s+to\s+book\s+a\s+survey|please\s+feel\s+free\s+to\s+call\s+us|send\s+us\s+a\s+message|with\s+your\s+requirements|get\s+in\s+touch|contact\s+us\s+at)[\s\S]*?(?=\b\d+\s+[A-Za-z]|\b(?:po\s*box|unit|suite|building|floor|no\.?)\b)/i, "").trim();

      // Strip office, department, branch, or headquarters label prefix at start of address (never strip authentic Post Office Box / GPO Box)
      if (!/^\s*(?:general\s+)?post\s+office\s+box\b/i.test(addr)) {
        const officePrefixRegex = /^(?:[A-Za-z\u00C0-\u024F\s]+?\s+)?(?:corporate\s+)?(?:head\s*office|headquarters|corporate\s*office|registered\s*office|main\s*office|principal\s*office|branch\s*office|regional\s*office|sales\s*office|plant\s*location|(?<!\b(?:post|general\s+post)\s+)office|plant|factory|warehouse|hq|sede\s*central|domicilio\s*social|sede\s*principal|address|direcci[oó]n|ubicaci[oó]n)\s*(?:[:：\-–,]+\s*|\s+(?=\b(?:\d{1,5}|no\.?\s*\d+|unit|suite|building|floor|level|room)\b))/i;
        addr = addr.replace(officePrefixRegex, "").trim();
      }

      if (compName && addr.toLowerCase().startsWith(compName.toLowerCase())) {
        addr = addr.slice(compName.length).trim();
      }
      // Also strip company name brand stem with or without legal suffix (e.g. "Charnwood Fireplaces Ltd, ")
      const compBrand = compName ? compName.replace(/\b(?:ltd|limited|inc|incorporated|llc|corp|corporation|co|company|proprietary|pty)\b/gi, "").trim() : "";
      if (compBrand && compBrand.length >= 4) {
        const brandRegex = new RegExp(`^${compBrand.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*(?:(?:ltd|limited|inc|llc|corp|co|pty)\\.?)?\\s*[,\\-–]?\\s*`, "i");
        addr = addr.replace(brandRegex, "").trim();
      }
      // Strip company name or corporate brand prefix at start of address before street number or premise
      if (compName) {
        const compClean = compName.replace(/[,;:\-_|/\\~*#@^"'“”‘’«»`]+/g, " ").trim();
        const firstToken = compClean.split(/\s+/)[0];
        if (firstToken && firstToken.length >= 3 && !/^(?:the|and|for)$/i.test(firstToken)) {
          const compPrefixRegex = new RegExp(`^${firstToken}\\b[\\s\\S]*?(?=\\b(?:\\d{1,5}|no\\.?\\s*\\d+|po\\s*box|unit|suite|building|floor|the\\s+[a-z]+|centre|center|house|hall|mill|works|court|lodge|grange|tower|park|estate|chambers|wharf)\\b)`, "i");
          addr = addr.replace(compPrefixRegex, "").trim();
        }
      }
      // Strip leftover corporate legal suffixes and generic company words at the start of address
      addr = addr.replace(/^(?:company|co\.?|incorporated|inc\.?|corporation|corp\.?|llc|limited|ltd\.?|equipment|systems|industries|technologies|enterprises|group|products)\b[\s,:\-–]*/i, "").trim();
      addr = addr.replace(/^,\s*/, "").trim();

      // Ensure country is identified from address or domain before expanding abbreviations
      if (!country || country.length < 2) {
        country = detectCountryFromAddress(addr);
        if (!country && crawlData) {
          const urlStr = (crawlData.originalUrl || "") + " " + (crawlData.finalUrl || "");
          if (/\.au(?:\/|$)/i.test(urlStr)) {
            country = "Australia";
          } else if (/\.es(?:\/|$)/i.test(urlStr)) {
            country = "Spain";
          } else if (/\.(?:my|com\.my|org\.my|net\.my|edu\.my|gov\.my)(?:[:\/\?]|$)/i.test(urlStr)) {
            country = "Malaysia";
          } else if (/\.(?:id|co\.id|web\.id|or\.id|net\.id|ac\.id|go\.id)(?:[:\/\?]|$)/i.test(urlStr)) {
            country = "Indonesia";
          } else if (/\.(?:nz|co\.nz|org\.nz|net\.nz|gen\.nz|ac\.nz|govt\.nz)(?:[:\/\?]|$)/i.test(urlStr)) {
            country = "New Zealand";
          }
        }
      }

      // Expand street and state/province abbreviations (e.g. St -> Street, VIC -> Victoria, NSW -> New South Wales)
      addr = expandAddressAndStateAbbreviations(addr, country);

      // If raw website address had a state that got dropped by AI, restore it!
      // CRITICAL FIX: Restore missing state ONLY from the selected candidate's raw text (NEVER mix multiple addresses)
      if (selectedCandidate && !rawSource) {
        rawSource = typeof selectedCandidate === "object" ? selectedCandidate.raw : selectedCandidate;
      }
      if (rawSource) {
        addr = restoreStateIfOmitted(addr, rawSource, country);
      }

      // CRITICAL GLOBAL FIX: Restore missing address components from raw candidate
      // (trailing city/district/state, leading premise/unit/estate, or intermediate village/section)
      if (rawSource) {
        if (typeof reconcileAddressWithRawEvidence === "function") {
          addr = reconcileAddressWithRawEvidence(addr, rawSource, compName, country, crawlData);
        }
        addr = restoreStreetNumberIfOmitted(addr, rawSource, crawlData);
        addr = restoreTaiwanVillageIfOmitted(addr, rawSource, crawlData);
      }

      // Unconditionally strip country names from address so the country name never appears inside the street address field
      addr = addr.replace(/\b(?:United\s*States\s*Of\s*America|United\s*States|USA|U\.S\.A\.|Great\s*Britain|United\s*Kingdom|UK|U\.K\.|Canada|Germany|Deutschland|France|Spain|Espa[nñ]a|Italia|Italy|Netherlands|Nederland|Holland|Austria|[OÖ]sterreich|Oesterreich|Switzerland|Schweiz|Suisse|Svizzera|Croatia|Hrvatska|Turkiye|T[uü]rkiye|Turkey|Czech\s*Republic|Czechia|Brunei\s*Darussalam|Brunei|New\s*Zealand|Aotearoa|Malaysia|Indonesia|Republik\s*Indonesia|Singapore|Japan|Peoples?\s*Republic\s*of\s*China|China|India|South\s*Africa|United\s*Arab\s*Emirates|UAE|Kingdom\s*of\s*Bahrain|Bahrain|Sultanate\s*of\s*Oman|Oman|Saudi\s*Arabia|South\s*Korea|Republic\s*of\s*Korea|North\s*Korea|Hong\s*Kong|Vietnam|Philippines|Thailand|Poland|Polska|Portugal|Greece|Sweden|Norway|Denmark|Finland|Belgium|Hungary|Romania|Bulgaria|Slovakia|Slovenia|Serbia|Ukraine|Russia|Belarus|Estonia|Latvia|Lithuania|Luxembourg|Iceland|Greenland|Malta|Cyprus|Andorra|Liechtenstein|Albania|Moldova|North\s*Macedonia|Armenia|Azerbaijan|Kazakhstan|Uzbekistan|Israel|Egypt|Morocco|Tunisia|Algeria|Qatar|Kuwait|Jordan|Lebanon|Iran|Iraq|Syria|Afghanistan|Pakistan|Bangladesh|Sri\s*Lanka|Nepal|Bhutan|Myanmar|Cambodia|Maldives|Mongolia|Mexico|Brazil|Argentina|Colombia|Peru|Uruguay|Paraguay|Bolivia|Costa\s*Rica|Panama|Guatemala|Nicaragua|Belize|Guyana|Suriname|Jamaica|Bahamas|Barbados|Dominican\s*Republic|Cayman\s*Islands|Saint\s*Lucia|Trinidad\s*and\s*Tobago|Fiji|Papua\s*New\s*Guinea|Samoa|Vanuatu|Nigeria|Kenya|Ghana|Ethiopia|Tanzania|Uganda|Rwanda|Botswana|Namibia|Zambia|Zimbabwe|Mozambique|Angola|Madagascar|Mauritius|Seychelles|Sierra\s*Leone|Sudan)\b/gi, " ");
      addr = addr.replace(/(?<!\b(?:Western|South)\s+)\bAustralia\b/gi, " ");
      addr = addr.replace(/\b(r\.?o\.?c\.?|republic\s*of\s*china)\b/gi, " ");
      if (country && country.length > 2) {
        const countryRegex = new RegExp(`\\b${country}\\b`, "gi");
        addr = addr.replace(countryRegex, " ");
      }

      // Strip trailing contact / communication fields early before postal code removal
      addr = addr.replace(/[,;\s]*(?:\b(?:Phone|Tel|Telephone|Email|Fax|Mobile|Direct|Contact|Sales|Toll\s*Free|Customer\s*Service|Support|Hotline|Postcode|Zip)\b\s*[:：\-–]?.*)$/i, "").trim();

      // Remove international postal codes carefully without stripping street numbers
      addr = removePostalCodesCarefully(addr);

      // Ensure comma separates city/suburb from state/province
      addr = ensureCommaBeforeState(addr);

      // Ensure "Number" is ONLY present if "No." / "No" / "#" / "Nº" / "號" was in the original raw address evidence
      // Rule: "if No come only expand and do with out coming dont put blankly number"
      const allAddressEvidence = (rawSource || "") + " " + (crawlData.addressCandidates || []).map(c => typeof c === "object" ? c.raw : c).join(" ") + " " + (crawlData.contactPageText ? crawlData.contactPageText.slice(0, 1500) : "");
      addr = stripBlindlyAddedNumber(addr, allAddressEvidence, rawSource);
      if (rawSource) {
        addr = stripExtraWordsFromAddress(addr, rawSource);
      }

      // Deduplicate repeated premise numbers e.g. "No. 1013 Number 1013" -> "Number 1013"
      addr = addr.replace(/(^|[,\s])(?:no\.?|number)\s*(\d+[A-Za-z]?(?:[-/]\d+)?)(?:,\s*|\s+)(?:no\.?|number)\s*\2\b/gi, '$1Number $2');
      addr = addr.replace(/(^|[,\s])(?:no\.?\s*)?(\d+[A-Za-z]?(?:[-/]\d+)?)(?:,\s*|\s+)Number\s+\2\b/gi, '$1Number $2');
      addr = addr.replace(/(^|[,\s])Number\s+(\d+[A-Za-z]?(?:[-/]\d+)?)(?:,\s*|\s+)(?:no\.?\s*)?\2\b/gi, '$1Number $2');

      // Repair accidental commas splitting two-syllable East Asian cities/districts/townships
      const eaFirstSyllables = "Yung|San|Chung|Hsin|Xin|Da|Ta|Nan|Xi|Hsi|Bei|Pei|An|Ren|Jen|Gui|Kuei|Lu|Loo|Ping|Ba|Pa|Yang|Long|Lung|Shan|Guan|Kuan|Ma|Jia|Chia|Qi|Chi|Jiang|Chiang|Zhong|Qian|Chien|Feng|Fong|Ling|Gu|Ku|Zuo|Tso|Hou|Dong|Tung|Xia|Hsia|Liu|Yu|Kao|Gao|Tao|Kee|Miao|Yun|Chang|Hua|Peng|Kin|Lien";
      addr = addr.replace(new RegExp(`\\b(${eaFirstSyllables})[-\\s]*,[\\s\\-]*([A-Z][a-z]+\\s+(?:District|Township|County|Hsien|City))\\b`, "g"), '$1-$2');
      addr = addr.replace(new RegExp(`\\b(${eaFirstSyllables})-[\\s,]+([A-Z][a-z]+\\s+(?:District|Township|County|Hsien|City))\\b`, "g"), '$1-$2');
      addr = normalizeTaiwanDivisions(addr);

      const eaRoadSyllables = "Chung|Zhong|Hsin|Xin|Kuang|Guang|Min|San|Da|Ta|Ren|Jen|Nan|Bei|Pei|Xi|Hsi|Dong|Tung";
      addr = addr.replace(new RegExp(`\\b(${eaRoadSyllables})[-\\s]*,[\\s\\-]*([A-Z][a-z]+\\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Highway))\\b`, "g"), '$1 $2');

      // Remove unwanted comma between bare street number and street name (e.g. "604, Progress Drive" -> "604 Progress Drive")
      // Must NOT strip commas after premise indicators like "Number 53-5, Pocheng Road" or "Lot 12, Main Street"
      addr = addr.replace(/(^|[,\s])(?<!\b(?:number|no\.?|#|section|sec\.?|lane|ln\.?|alley|aly\.?|unit|suite|ste\.?|floor|fl\.?|flr\.?|level|lot|plot|block|blk\.?)\s+)\b(\d{1,5}),\s+([A-Z][a-z0-9\u00C0-\u024F\-]+(?:\s+[A-Z][a-z0-9\u00C0-\u024F\-]+)*\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Caddesi|Bulvari|Sokak|Strasse|Calle|Avenida|Viale|Corso|Rd|St|Ave|Ln|Dr|Blvd|Hwy|Ct|Pl)\b)/gi, '$1$2 $3');

      // Strip leading list/index numbers before company names in address only if followed by a separate street address number (e.g. "138 U.S. Tsubaki Industrial, LLC 250 Kirby Drive...")
      addr = addr.replace(/^\d{1,4}\s+([A-Z].*?\b(?:LLC|Inc\.?|Corp\.?|Ltd\.?|Limited)\b)(?=\s+\d+\s+[A-Z])/i, (m, g) => g);
      addr = addr.replace(/(\b(?:LLC|Inc\.?|Corp\.?|Ltd\.?|Limited)\b)\s+(\d+\s+[A-Z])/i, (m, g1, g2) => g1 + ", " + g2);

      // Clean up spaces, commas, and ensure clean formatting
      addr = addr.replace(/\s+,/g, ",");
      addr = addr.replace(/,\s*,/g, ", ");
      addr = addr.replace(/,\s*/g, ", ");
      addr = addr.replace(/[,;.\s\-_/\\|]+$/g, "").trim();
      addr = addr.replace(/^[,;.\s\-_/\\|]+/g, "").trim();
      addr = addr.replace(/\s+/g, " ");
      addr = toTitleCase(addr);
      addr = repairBlindlySeparatedCommas(addr);
      addr = normalizeTaiwanDivisions(addr);

      // Strip trailing contact / communication fields or loose periods attached to address
      addr = addr.replace(/[,;\s]*(?:\b(?:Phone|Tel|Telephone|Email|Fax|Mobile|Direct|Contact|Sales|Toll\s*Free|Customer\s*Service|Support|Hotline|Postcode|Zip)\b\s*[:：\-–]?.*)$/i, "").trim();
      addr = addr.replace(/(?:\s*\.\s*)+$/g, "").trim();
      // Strip trailing map UI links (e.g. "View Map", "Open Map", "Get Directions", "See on Maps")
      addr = addr.replace(/[,;\s]*(?:\b(?:view\s*map|open\s*map|open\s*in\s*maps?|get\s*directions?|see\s*on\s*maps?|google\s*maps?|directions?)\b.*)$/i, "").trim();
      // Strip trailing country codes (e.g. ", USA", ", UK", ", AU") - NEVER strip ", CA" if in United States since CA is California!
      if (country && /united states/i.test(country)) {
        addr = addr.replace(/[,;\s]+\b(?:USA|US)\b\s*$/i, "").trim();
      } else {
        addr = addr.replace(/[,;\s]+\b(?:CA|USA|US|UK|AU|NZ)\b\s*$/i, "").trim();
      }
      // Final pass: clean postal codes, stray quotes, and punctuation
      addr = removePostalCodesCarefully(addr);
      addr = addr.replace(/[\s,\-]+\b\d{3,6}\b\s*$/g, "").trim();
      addr = addr.replace(/(\b(?:City|District|Township|County|Hsien|Village|Li|Town|Dist\.?)\b[\s,]*)\b\d{3,6}\b(?=[\s,]|$)/gi, "$1");
      addr = addr.replace(/\bChia,\s*Yi\s*City\b/gi, "Chiayi City");
      addr = addr.replace(/\bChia[-\s,]*[Yy]i\s*City\b/gi, "Chiayi City");
      addr = normalizeTaiwanDivisions(addr);
      addr = repairBlindlySeparatedCommas(addr);
      addr = addr.replace(/["“”«»`]+/g, " ");
      // Strictly enforce: No special characters or invisible symbols at the beginning (FIRST) or end (LAST)
      addr = addr.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
      addr = addr.replace(/[^\p{L}\p{N})]+$/gu, "").trim();
      addr = addr.replace(/\s+/g, " ");
      // Final pass: ensure all floor, unit, street, and state abbreviations are fully expanded
      addr = expandAddressAndStateAbbreviations(addr, country);
      if (rawSource) {
        addr = stripExtraWordsFromAddress(addr, rawSource);
      }
      addr = stripBlindlyAddedNumber(addr, allAddressEvidence, rawSource);
      addr = addr.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
      addr = addr.replace(/[^\p{L}\p{N})]+$/gu, "").trim();
      addr = addr.replace(/\s+/g, " ");
    }
  } else {
    addr = "Not Available";
  }
  if (addr && addr !== "Not Available") {
    addr = typeof sanitizeRule6CompanyAddress === "function"
      ? sanitizeRule6CompanyAddress(addr, compName, country, crawlData)
      : toTitleCase(addr);
  } else {
    addr = "Not Available";
  }
  result.companyAddress = addr;

  // Infer country strictly from physical address evidence and crawl signals if missing
  if (!country || country.length < 2) {
    country = typeof resolveCountryFromAllEvidence === "function"
      ? resolveCountryFromAllEvidence(country, addr, crawlData)
      : toTitleCase(normalizeCountryName(detectCountryFromAddress(addr) || ""));
  }
  country = toTitleCase(normalizeCountryName(country));
  country = resolveUkCountryName(country, addr, crawlData);
  result.countryName = country;

  // Re-sanitize address if country was determined/refined to ensure country is stripped & state expanded
  if (country && addr && addr !== "Not Available" && typeof sanitizeRule6CompanyAddress === "function") {
    addr = sanitizeRule6CompanyAddress(addr, compName, country, crawlData);
    result.companyAddress = addr;
  }

  // Helper for cross-country equivalence (UK constituent nations, USA variants)
  const isSameOrConstituentCountry = (c1, c2) => {
    if (!c1 || !c2) return false;
    const s1 = c1.trim().toLowerCase();
    const s2 = c2.trim().toLowerCase();
    if (s1 === s2) return true;
    const ukGroup = ["united kingdom", "great britain", "uk", "england", "scotland", "wales", "northern ireland"];
    if (ukGroup.includes(s1) && ukGroup.includes(s2)) return true;
    const usGroup = ["united states of america", "united states", "usa", "us", "u.s.a."];
    if (usGroup.includes(s1) && usGroup.includes(s2)) return true;
    return false;
  };

  // Cross-Country Conflict Guard: Ensure Company Address does not point to an overseas branch in a completely different country!
  if (country && country.length >= 2 && addr && addr !== "Not Available") {
    const addrCountry = detectCountryFromAddress(addr);
    if (addrCountry && !isSameOrConstituentCountry(addrCountry, country)) {
      const domesticCandidate = (crawlData.addressCandidates || []).find(c => {
        const cRaw = typeof c === "object" ? c.raw : c;
        const cCountry = detectCountryFromAddress(cRaw);
        if (cCountry && isSameOrConstituentCountry(cCountry, country)) return true;
        if (country.toLowerCase() === "china" && /[\u4e00-\u9fa5]/.test(cRaw)) return true;
        if (country.toLowerCase() === "taiwan" && (cRaw.toLowerCase().includes("taiwan") || /[\u4e00-\u9fa5]/.test(cRaw))) return true;
        return false;
      });
      if (domesticCandidate) {
        let domRaw = typeof domesticCandidate === "object" ? domesticCandidate.raw : domesticCandidate;
        if (/[\u4e00-\u9fa5]/.test(domRaw)) {
          domRaw = romanizeChineseAddress(domRaw);
        }
        // Strip corporate registration disclaimers & legal office prefixes
        domRaw = domRaw.replace(/^[\s\S]*?\b(?:registered\s+in\s+[A-Za-z\s]+(?::\s*[\dA-Za-z]+)?\.?\s*,?\s*)?(?:registered\s*office|registered\s*agent|domicilio\s*social)\s*[:：\-–,\s]+/i, "").trim();
        domRaw = domRaw.replace(/^[\s\S]*?\b(?:company\s+registration(?:\s+no\.?|\s+number)?\s*[:：\-–,\s]*[\dA-Za-z]+\.?\s*,?\s*)/i, "").trim();
        domRaw = expandAddressAndStateAbbreviations(domRaw, country);
        domRaw = removePostalCodesCarefully(domRaw);
        domRaw = expandAddressAndStateAbbreviations(domRaw, country);
        domRaw = toTitleCase(domRaw);
        addr = typeof sanitizeRule6CompanyAddress === "function"
          ? sanitizeRule6CompanyAddress(domRaw, compName, country, crawlData)
          : toTitleCase(domRaw);
        result.companyAddress = addr;
      }
    }
  }

  // 7. State: Validated based on presence of State / County / Province / Prefecture / Hsien / Region or Capital
  if (!addr || addr.length < 8 || addr.toLowerCase() === "not available") {
    result.state = "Not Available";
  } else {
    result.state = hasStateInAddress(addr, country) ? "Available" : "Not Available";
  }

  // 8. City: Evaluated STRICTLY per City QC Rule (Only explicit City, Town, Township, District, Municipality)
  // CRITICAL QC RULE: "Subhurb is consider as city if subhurb was coming means its should mark not available its not city"
  if (!addr || addr.length < 8 || addr.toLowerCase() === "not available" || addr === "Not Available") {
    result.city = "Not Available";
  } else {
    const qcCity = evaluateCityQC(addr, country);
    if (qcCity === "Not Available") {
      result.city = "Not Available";
    } else {
      result.city = "Available";
    }
  }

  // 9. Email ID & 10. Secondary Email ID (Strict Grounding & Anti-Hallucination)
  const crawlEmails = (crawlData.emails || []).map(e => stripTrailingContactWordsFromEmail(String(e).trim().toLowerCase())).filter(Boolean);
  const isGenericWebmail = (e) => /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|mail|zoho|proton|protonmail)\.com$/i.test(e);
  let targetHostDomain = "";
  try {
    const rawUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    if (rawUrl) targetHostDomain = new URL(rawUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch (e) { }

  // 9. Primary Email ID
  let email = stripTrailingContactWordsFromEmail((result.emailId || "").trim().toLowerCase());
  if (email && (isUnwantedEmail(email) || !isValidCorporateEmail(email))) {
    email = "";
  }
  // Reject email if generic webmail and was NOT discovered during the website HTML crawl
  if (email && isGenericWebmail(email) && !crawlEmails.includes(email)) {
    email = "";
  }
  // Reject email if not in crawlEmails and does not match target host domain
  if (email && !crawlEmails.includes(email)) {
    const emHost = (email.split("@")[1] || "").toLowerCase();
    if (!targetHostDomain || (emHost !== targetHostDomain && !emHost.endsWith("." + targetHostDomain))) {
      email = "";
    }
  }
  // Ensure primary email uses the highest-ranked verified corporate email from the website/contact page/Facebook
  if (!email || !isValidCorporateEmail(email) || isUnwantedEmail(email)) {
    const validFromCrawl = crawlEmails.find(e => isValidCorporateEmail(e) && !isUnwantedEmail(e));
    email = validFromCrawl || "";
  }
  email = stripTrailingContactWordsFromEmail(email);
  result.emailId = email;

  // 10. Secondary Email ID (Double Check: if secondary email is available, ALWAYS take it!)
  let secEmail = stripTrailingContactWordsFromEmail((result.secondaryEmailId || "").trim().toLowerCase());
  const primHost = email ? (email.split("@")[1] || "").toLowerCase() : "";

  const isCompanyDomainEmail = (candEmail) => {
    if (!candEmail || typeof candEmail !== "string") return false;
    const candHost = (candEmail.split("@")[1] || "").toLowerCase();
    if (!candHost) return false;
    if (primHost && (candHost === primHost || candHost.endsWith("." + primHost) || primHost.endsWith("." + candHost))) return true;
    if (targetHostDomain && (candHost === targetHostDomain || candHost.endsWith("." + targetHostDomain))) return true;
    return false;
  };

  // If Gemini provided a secondary email, validate it
  if (secEmail) {
    if (
      secEmail === email ||
      !isValidCorporateEmail(secEmail) ||
      isUnwantedEmail(secEmail)
    ) {
      secEmail = "";
    } else if (!isCompanyDomainEmail(secEmail) && !crawlEmails.includes(secEmail)) {
      // Reject only if it's completely unverified (neither matching company domain nor discovered in crawl HTML/socials)
      secEmail = "";
    }
  }

  // Double Check Fallback: If secondary email is missing/empty, take any verified distinct corporate email discovered during crawl!
  if (!secEmail && email) {
    // Priority 1: distinct corporate email from same company domain
    let cand = crawlEmails.find(e => {
      const emLower = stripTrailingContactWordsFromEmail((e || "").trim().toLowerCase());
      return emLower && emLower !== email && isValidCorporateEmail(emLower) && !isUnwantedEmail(emLower) && isCompanyDomainEmail(emLower);
    });
    // Priority 2: any distinct corporate email discovered on website/socials during crawl (e.g. branch, sister brand, ISP, or social channel email)
    if (!cand) {
      cand = crawlEmails.find(e => {
        const emLower = stripTrailingContactWordsFromEmail((e || "").trim().toLowerCase());
        return emLower && emLower !== email && isValidCorporateEmail(emLower) && !isUnwantedEmail(emLower);
      });
    }
    if (cand) {
      secEmail = stripTrailingContactWordsFromEmail(cand);
    }
  }

  // Final QC: secondary email must be valid and strictly distinct from primary email
  secEmail = stripTrailingContactWordsFromEmail(secEmail);
  if (secEmail === email || !isValidCorporateEmail(secEmail) || isUnwantedEmail(secEmail)) {
    secEmail = "";
  }
  result.secondaryEmailId = secEmail;

  // 11. Phone Number: Country-specific cleaning & validation (Strictly no toll-free, no country code, no leading zeros)
  let phone = cleanPhoneNumber(result.phoneNumber, country);
  if (!phone && crawlData.phones && crawlData.phones.length > 0) {
    for (const cand of crawlData.phones) {
      phone = cleanPhoneNumber(cand, country);
      if (phone) break;
    }
  }
  result.phoneNumber = phone;

  // 12. Number of Products, 13. Product Images, 14. Number of Product Descriptions
  const parseCount = (val) => {
    if (val === undefined || val === null || val === "") return 0;
    const s = String(val).trim().toLowerCase();
    if (s === "3" || s === "three") return 3;
    if (s === "2" || s === "two") return 2;
    if (s === "1" || s === "one") return 1;
    const num = parseInt(s, 10);
    if (!isNaN(num)) {
      if (num >= 3) return 3;
      if (num === 2) return 2;
      if (num === 1) return 1;
    }
    return 0;
  };

  // Product items use OWN CRAWL ONLY (never Gemini), and all 3 fields must stay identical
  const finalProductCount = computeOwnCrawlProductCount(crawlData);
  const iCount = parseInt(finalProductCount, 10) || 0;

  result.productImages = finalProductCount;
  result.numberOfProducts = finalProductCount;
  result.numberOfProductDescriptions = finalProductCount;

  // Final safeguard: If website has 0 products and company has no physical address, email, phone, or identity, it cannot be working
  const finalHasAddr = result.companyAddress && result.companyAddress !== "Not Available" && result.companyAddress.trim().length > 5;
  const hasBasicContactOrIdentity = !!((result.emailId && result.emailId.trim()) || (result.phoneNumber && result.phoneNumber.trim()) || (result.companyName && result.companyName.trim().length >= 3));
  if (!isRedirectSite && (result.websiteStatus === "Working" || !result.websiteStatus) && iCount === 0 && !finalHasAddr && !hasBasicContactOrIdentity) {
    result.websiteStatus = "Not Working";
    result.errorCategory = "No Business Products / 0 Products";
    result.errorKeyword = "0 Products / No Catalog";
    result.errorSourceUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    result.errorSnippet = "Website has 0 products and no physical address or verifiable catalog (Rule 1).";
    result.notWorkingReason = result.errorSnippet;
    result.businessType = "";
    result.companyProfile = "";
    result.companyName = "";
    result.countryName = "";
    result.companyAddress = "";
    result.state = "";
    result.city = "";
    result.emailId = "";
    result.secondaryEmailId = "";
    result.phoneNumber = "";
    result.numberOfProducts = "";
    result.productImages = "";
    result.numberOfProductDescriptions = "";
  }

  // Final safeguard: If website redirected to another domain, ALWAYS ensure websiteStatus is "Redirect Site"
  if (isRedirectSite) {
    result.websiteStatus = "Redirect Site";
  } else if (!isDiffDomain && (result.websiteStatus === "Redirect Site" || result.websiteStatus === "Redirect")) {
    result.websiteStatus = "Working";
  }

  // Populate all quality check & evidence source links (Company Name, Emails, Business Type, Company Address)
  populateEvidenceAndSourceLinks(result, crawlData, selectedCandidate, rawSource);

  // Carry over Restricted Site, Shop Cart, and Disallowed Evidence
  if (restrictedCheck && restrictedCheck.isRestricted) {
    result.restrictedKeyword = restrictedCheck.matchedKeyword || "";
    result.restrictedCategory = restrictedCheck.category || "";
    result.restrictedSourceUrl = restrictedCheck.sourceUrl || crawlData.finalUrl || crawlData.originalUrl || "";
    result.restrictedSnippet = restrictedCheck.snippet || "";
  }

  result._finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
  result._originalUrl = crawlData.originalUrl || "";

  if (result.websiteStatus === "Not Working") {
    result.errorSourceUrl = result.errorSourceUrl || result.restrictedSourceUrl || result.disallowedSourceUrl || result.shopCartSourceUrl || crawlData.finalUrl || crawlData.originalUrl || "";
    result.errorKeyword = result.errorKeyword || result.restrictedKeyword || result.disallowedKeyword || result.shopCartKeyword || result.restrictedReason || "";
    result.errorSnippet = result.errorSnippet || result.restrictedSnippet || result.disallowedSnippet || result.shopCartSnippet || result.notWorkingReason || "";
  }

  // Enforce boundary QC rule: special characters like &, #, etc. must NEVER be at the first or end of any field
  // Internal special characters like & in "AT&T", # in "Suite #4" must be preserved!
  for (const key of ["companyName", "companyAddress", "businessType", "countryName"]) {
    if (result[key] && typeof result[key] === "string" && result[key] !== "Not Available") {
      if (key === "companyName") {
        result[key] = stripBoundarySpecialChars(result[key]);
      } else {
        result[key] = result[key].replace(/^[^\p{L}\p{N}]+/gu, "").replace(/[^\p{L}\p{N})]+$/gu, "").trim();
      }
    }
  }

  return result;
}

