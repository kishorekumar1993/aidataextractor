// Non-Working Website Records Manager
// Persistent Excel Append & Local Storage for Not Working, Redirect, and Not English sites.
// Maintains: Non_Working_Websites.xlsx across multiple extraction sessions without overwriting history.

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    define([], factory);
  } else {
    const exports = factory();
    Object.assign(root, exports);
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const NON_WORKING_EXCEL_FILENAME = "Non_Working_Websites.xlsx";
  const NON_WORKING_EXCEL_SHEET = "Non-Working Websites";
  const NON_WORKING_STORAGE_KEY = "nonWorkingRecords";
  const NON_WORKING_SYNC_TIME_KEY = "nonWorkingLastExcelSyncTime";

  const NON_WORKING_COLUMNS = [
    "URL",
    "Website Status",
    "Reason",
    "Error Keyword",
    "Error Source Link",
    "Error Context",
    "Date",
    "Time"
  ];

  const VALID_ERROR_STATUSES = ["Not Working", "Redirect", "Not English"];

  function getLocalDateString(d = new Date()) {
    const dateObj = d instanceof Date ? d : new Date(d);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getLocalTimeString(d = new Date()) {
    const dateObj = d instanceof Date ? d : new Date(d);
    const hours = String(dateObj.getHours()).padStart(2, "0");
    const mins = String(dateObj.getMinutes()).padStart(2, "0");
    const secs = String(dateObj.getSeconds()).padStart(2, "0");
    return `${hours}:${mins}:${secs}`;
  }

  /**
   * Normalizes websiteStatus into one of the 3 required error categories:
   * 1. Not Working
   * 2. Redirect
   * 3. Not English
   *
   * Successfully working and eligible websites return null (STRICTLY EXCLUDED).
   */
  function normalizeErrorCategory(rawStatus, data = {}) {
    if (!rawStatus && !data.websiteStatus) return null;
    const statusStr = String(rawStatus || data.websiteStatus || "").trim();

    // STRICT: Working websites are NEVER included in error records
    if (/^working$/i.test(statusStr)) {
      return null;
    }

    if (/^redirect(?:\s*site)?$/i.test(statusStr)) {
      return "Redirect";
    }

    if (/^(?:non[\s_-]?english|not[\s_-]?english)$/i.test(statusStr)) {
      return "Not English";
    }

    // Default failure status is "Not Working" (inaccessible, DNS, timeout, 404, prohibited, 0 products, flash, etc.)
    return "Not Working";
  }

  /**
   * Validates that a non-working reason is an authentic business/technical reason
   * and never an AI provenance note, model tagline, or engine fallback diagnostic.
   */
  function isValidNonWorkingReason(str) {
    if (!str || typeof str !== "string") return false;
    const s = str.trim();
    if (!s || s.length < 3) return false;
    if (/^(?:AI Powered by|Own Crawl|Analyzed via Own Crawl|AI Only mode|AI First mode)/i.test(s)) return false;
    if (/\b(?:gemini|groq|gpt-oss)\b/i.test(s) && !/\b(?:failed|error|timeout|quota|rate limit)\b/i.test(s)) return false;
    return true;
  }

  /**
   * Extracts a detailed explanation of the issue from crawl / QC / error data.
   */
  function extractErrorReason(data = {}, defaultReason = "") {
    if (typeof data === "string") {
      const s = data.trim();
      if (isValidNonWorkingReason(s)) return s;
      return defaultReason || "Website has 0 products and no verifiable catalog or physical address (Rule 1)";
    }

    const candidate =
      (isValidNonWorkingReason(data.reason) ? data.reason : "") ||
      (isValidNonWorkingReason(data.Reason) ? data.Reason : "") ||
      (isValidNonWorkingReason(data.notWorkingReason) ? data.notWorkingReason : "") ||
      (isValidNonWorkingReason(data.restrictedReason) ? data.restrictedReason : "") ||
      (isValidNonWorkingReason(data.shopCartReason) ? data.shopCartReason : "") ||
      (isValidNonWorkingReason(data.disallowedReason) ? data.disallowedReason : "") ||
      (isValidNonWorkingReason(data.fetchError) ? data.fetchError : "") ||
      (isValidNonWorkingReason(data.errorSnippet) ? data.errorSnippet : "") ||
      (isValidNonWorkingReason(data.errorKeyword) ? data.errorKeyword : "") ||
      (isValidNonWorkingReason(defaultReason) ? defaultReason : "");

    if (candidate) {
      return String(candidate).trim();
    }

    // Dynamic valid synthesis based on category instead of falling back to _note or engine branding
    const status = normalizeErrorCategory(data["Website Status"] || data.websiteStatus || data.status, data);
    if (status === "Not English") {
      return "Non-English Language Without Translation Option (Rule 12)";
    }
    if (status === "Flash") {
      return "Flash Format Website - Not copyable (Rule 14)";
    }
    if (status === "Redirect") {
      return "Redirected to different external domain (Rule 13)";
    }
    if (data.websiteStatus === "Domain Expired") {
      return "Domain Expired or Server returned HTTP 404 Not Found (Rule 1)";
    }
    if (data.websiteStatus === "Under Construction") {
      return "Website is under construction or maintenance";
    }

    return "Website has 0 products and no verifiable catalog or physical address (Rule 1)";
  }

  /**
   * Extracts the Error Keyword (e.g. Military, Weapons, Shopping Cart, Connection Timeout).
   */
  function extractErrorKeyword(data = {}) {
    if (!data || typeof data !== "object") return "";
    return (
      data["Error Keyword"] ||
      data.errorKeyword ||
      data.restrictedKeyword ||
      data.disallowedKeyword ||
      data.shopCartKeyword ||
      (data.websiteStatus === "Redirect Site" ? "Redirect Domain" : (data.websiteStatus === "Non English" ? "Non English Language" : (data.websiteStatus === "Flash" ? "Flash Content" : "")))
    ).toString().trim();
  }

  /**
   * Extracts the Error Source Link (e.g. https://traceygear.com/military-defense-suppliers/).
   */
  function extractErrorSourceLink(data = {}, fallbackUrl = "") {
    if (!data || typeof data !== "object") return String(fallbackUrl || "").trim();
    return (
      data["Error Source Link"] ||
      data.errorSourceLink ||
      data.errorSourceUrl ||
      data["Error URL"] ||
      data.errorUrl ||
      data.restrictedSourceUrl ||
      data.disallowedSourceUrl ||
      data.shopCartSourceUrl ||
      data._finalUrl ||
      data.finalUrl ||
      data._originalUrl ||
      fallbackUrl ||
      ""
    ).toString().trim();
  }

  const extractErrorUrl = extractErrorSourceLink;

  /**
   * Extracts the Error Context / snippet (e.g. "...Military & Defense Suppliers...").
   */
  function extractErrorContext(data = {}) {
    if (!data || typeof data !== "object") return "";
    return (
      data["Error Context"] ||
      data.errorContext ||
      data.errorSnippet ||
      data.restrictedSnippet ||
      data.disallowedSnippet ||
      data.shopCartSnippet ||
      ""
    ).toString().trim();
  }

  /**
   * Creates a normalized error record object adhering to the mandatory columns:
   * URL, Website Status, Reason, Error Keyword, Error Source Link, Error Context, Date, Time.
   */
  function createErrorRecord(input = {}) {
    if (!input) return null;
    const rawUrl = String(input.URL || input.url || input.rawUrl || input._originalUrl || "").trim();
    if (!rawUrl) return null;

    const rawStatus = input["Website Status"] || input.websiteStatus || input.status;
    const category = normalizeErrorCategory(rawStatus, input);
    if (!category) {
      // Successfully working or invalid status: do not capture
      return null;
    }

    const reason = extractErrorReason(input, input.reason || input.Reason);
    const errorKeyword = extractErrorKeyword(input);
    const errorSourceLink = extractErrorSourceLink(input, rawUrl);
    const errorContext = extractErrorContext(input);
    const dateStr = String(input.Date || input.date || getLocalDateString()).trim();
    const timeStr = String(input.Time || input.time || getLocalTimeString()).trim();

    return {
      URL: rawUrl,
      "Website Status": category,
      Reason: reason,
      "Error Keyword": errorKeyword,
      "Error Source Link": errorSourceLink || rawUrl,
      "Error Context": errorContext,
      Date: dateStr,
      Time: timeStr
    };
  }

  /**
   * Normalizes a URL for robust duplicate checking (ignores protocol, www, and trailing slashes).
   */
  function normalizeUrlForDedup(url) {
    if (!url) return "";
    return String(url)
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "");
  }

  /**
   * Duplicate Prevention:
   * Avoids inserting duplicate records for the same URL and same error occurrence.
   * If a URL was previously recorded but a new error occurrence happens at a different time/date,
   * the new occurrence is retained as a separate record.
   */
  function isDuplicateErrorRecord(existingRecords = [], candidate) {
    if (!Array.isArray(existingRecords) || existingRecords.length === 0 || !candidate) {
      return false;
    }
    const candUrl = normalizeUrlForDedup(candidate.URL || candidate.url);
    if (!candUrl) return false;

    const candStatus = String(candidate["Website Status"] || candidate.websiteStatus || "").trim().toLowerCase();
    const candDate = String(candidate.Date || candidate.date || "").trim();

    return existingRecords.some(r => {
      if (!r) return false;
      const exUrl = normalizeUrlForDedup(r.URL || r.url);
      const exStatus = String(r["Website Status"] || r.websiteStatus || "").trim().toLowerCase();
      const exDate = String(r.Date || r.date || "").trim();

      return exUrl === candUrl && exStatus === candStatus && exDate === candDate;
    });
  }

  /**
   * Appends candidate records to existing records, preserving all historical rows
   * and preventing duplicate occurrences.
   */
  function mergeErrorRecords(existingList = [], candidateList = []) {
    const merged = Array.isArray(existingList) ? [...existingList] : [];
    let addedCount = 0;
    const candidates = Array.isArray(candidateList) ? candidateList : [candidateList];

    for (const item of candidates) {
      if (!item) continue;
      const record = createErrorRecord(item);
      if (!record) continue;

      if (!isDuplicateErrorRecord(merged, record)) {
        merged.push(record);
        addedCount++;
      }
    }

    return { merged, addedCount };
  }

  /**
   * Generates a SheetJS XLSX workbook containing all cumulative historical error records.
   * Maintains one permanent filename: Non_Working_Websites.xlsx
   */
  function generateNonWorkingExcel(records = [], xlsxLib) {
    const lib = xlsxLib || (typeof XLSX !== "undefined" ? XLSX : null);
    if (!lib) {
      throw new Error("XLSX library not available for Excel generation.");
    }

    const rows = (records || []).map(r => {
      const rawReason = String(r.Reason || r.reason || "").trim();
      const cleanReason = isValidNonWorkingReason(rawReason) ? rawReason : extractErrorReason(r);
      return {
        "URL": String(r.URL || r.url || "").trim(),
        "Website Status": String(r["Website Status"] || r.websiteStatus || "").trim(),
        "Reason": cleanReason,
        "Error Keyword": String(r["Error Keyword"] || r.errorKeyword || "").trim(),
        "Error Source Link": String(r["Error Source Link"] || r.errorSourceLink || r["Error URL"] || r.errorUrl || "").trim(),
        "Error Context": String(r["Error Context"] || r.errorContext || r.errorSnippet || "").trim(),
        "Date": String(r.Date || r.date || "").trim(),
        "Time": String(r.Time || r.time || "").trim()
      };
    });

    const ws = lib.utils.json_to_sheet(rows, { header: NON_WORKING_COLUMNS });

    // Explicit professional column widths
    ws["!cols"] = [
      { wch: 36 }, // URL
      { wch: 16 }, // Website Status
      { wch: 48 }, // Reason
      { wch: 22 }, // Error Keyword
      { wch: 42 }, // Error Source Link
      { wch: 60 }, // Error Context
      { wch: 14 }, // Date
      { wch: 12 }  // Time
    ];

    const wb = lib.utils.book_new();
    lib.utils.book_append_sheet(wb, ws, NON_WORKING_EXCEL_SHEET);
    return wb;
  }

  /**
   * Reads an existing Non_Working_Websites.xlsx file from binary/buffer data and
   * parses all previously saved records.
   */
  function parseNonWorkingExcel(fileData, xlsxLib) {
    const lib = xlsxLib || (typeof XLSX !== "undefined" ? XLSX : null);
    if (!lib) {
      throw new Error("XLSX library not available for Excel parsing.");
    }

    const readType = typeof fileData === "string" ? "binary" : (typeof Buffer !== "undefined" && Buffer.isBuffer(fileData) ? "buffer" : "array");
    const wb = lib.read(fileData, { type: readType });
    const sheetName = wb.SheetNames.includes(NON_WORKING_EXCEL_SHEET)
      ? NON_WORKING_EXCEL_SHEET
      : wb.SheetNames[0];

    const ws = wb.Sheets[sheetName];
    if (!ws) return [];

    const rawRows = lib.utils.sheet_to_json(ws, { defval: "" });
    const records = [];

    for (const row of rawRows) {
      const rec = createErrorRecord(row);
      if (rec) {
        records.push(rec);
      }
    }

    return records;
  }

  /**
   * Calculates dashboard metrics:
   * - Total Not Working Websites
   * - Total Redirect Websites
   * - Total Not English Websites
   * - Total Historical Error Records
   * - Last Excel Sync Date and Time
   */
  function calculateErrorStats(records = [], lastSyncTime = null) {
    let totalNotWorking = 0;
    let totalRedirect = 0;
    let totalNotEnglish = 0;

    for (const r of (records || [])) {
      if (!r) continue;
      const status = String(r["Website Status"] || r.websiteStatus || "").trim();
      if (status === "Not Working") {
        totalNotWorking++;
      } else if (status === "Redirect") {
        totalRedirect++;
      } else if (status === "Not English") {
        totalNotEnglish++;
      }
    }

    let lastSyncFormatted = "Never";
    if (lastSyncTime) {
      try {
        const d = new Date(lastSyncTime);
        if (!isNaN(d.getTime())) {
          lastSyncFormatted = `${getLocalDateString(d)} ${getLocalTimeString(d)}`;
        } else if (typeof lastSyncTime === "string") {
          lastSyncFormatted = lastSyncTime;
        }
      } catch (e) {
        lastSyncFormatted = String(lastSyncTime);
      }
    }

    return {
      totalNotWorking,
      totalRedirect,
      totalNotEnglish,
      totalHistorical: (records || []).length,
      lastSyncTime: lastSyncFormatted,
      lastSyncTimestamp: lastSyncTime || null
    };
  }

  /**
   * Filters records by status, date, and search term.
   */
  function filterErrorRecords(records = [], options = {}) {
    const { status = "All", date = "", search = "" } = options;
    const normStatus = String(status || "All").trim();
    const normDate = String(date || "").trim();
    const normSearch = String(search || "").trim().toLowerCase();

    return (records || []).filter(r => {
      if (!r) return false;
      const recStatus = String(r["Website Status"] || r.websiteStatus || "").trim();
      if (normStatus !== "All" && recStatus.toLowerCase() !== normStatus.toLowerCase()) {
        return false;
      }

      const recDate = String(r.Date || r.date || "").trim();
      if (normDate && normDate !== "All" && recDate !== normDate) {
        return false;
      }

      if (normSearch) {
        const urlStr = String(r.URL || "").toLowerCase();
        const reasonStr = String(r.Reason || "").toLowerCase();
        const kwStr = String(r["Error Keyword"] || r.errorKeyword || "").toLowerCase();
        const srcStr = String(r["Error Source Link"] || r.errorSourceLink || r["Error URL"] || r.errorUrl || "").toLowerCase();
        const ctxStr = String(r["Error Context"] || r.errorContext || r.errorSnippet || "").toLowerCase();
        if (
          !urlStr.includes(normSearch) &&
          !reasonStr.includes(normSearch) &&
          !kwStr.includes(normSearch) &&
          !srcStr.includes(normSearch) &&
          !ctxStr.includes(normSearch)
        ) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Helper for Chrome storage local retrieval.
   */
  async function getStoredErrorRecords(chromeStorage) {
    const storage = chromeStorage || (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local);
    if (!storage) return [];
    try {
      const data = await storage.get([NON_WORKING_STORAGE_KEY]);
      const rawRecords = Array.isArray(data[NON_WORKING_STORAGE_KEY]) ? data[NON_WORKING_STORAGE_KEY] : [];
      let hadInvalid = false;
      const records = rawRecords.map(r => {
        if (!r) return r;
        const curReason = String(r.Reason || r.reason || "").trim();
        if (!isValidNonWorkingReason(curReason)) {
          hadInvalid = true;
          const clean = extractErrorReason(r);
          return { ...r, Reason: clean, reason: clean };
        }
        return r;
      });
      if (hadInvalid && typeof storage.set === "function") {
        storage.set({ [NON_WORKING_STORAGE_KEY]: records }).catch(() => {});
      }
      return records;
    } catch (e) {
      console.warn("[NonWorkingRecords] Error reading storage:", e.message);
      return [];
    }
  }

  /**
   * Helper for Chrome storage local save.
   */
  async function saveStoredErrorRecords(records, lastSyncTime, chromeStorage) {
    const storage = chromeStorage || (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local);
    if (!storage) return false;
    try {
      const payload = {
        [NON_WORKING_STORAGE_KEY]: records || []
      };
      if (lastSyncTime !== undefined) {
        payload[NON_WORKING_SYNC_TIME_KEY] = lastSyncTime;
      }
      await storage.set(payload);
      return true;
    } catch (e) {
      console.warn("[NonWorkingRecords] Error saving storage:", e.message);
      return false;
    }
  }

  return {
    NON_WORKING_EXCEL_FILENAME,
    NON_WORKING_EXCEL_SHEET,
    NON_WORKING_STORAGE_KEY,
    NON_WORKING_SYNC_TIME_KEY,
    NON_WORKING_COLUMNS,
    VALID_ERROR_STATUSES,
    getLocalDateString,
    getLocalTimeString,
    isValidNonWorkingReason,
    normalizeErrorCategory,
    extractErrorReason,
    extractErrorKeyword,
    extractErrorSourceLink,
    extractErrorContext,
    extractErrorUrl,
    createErrorRecord,
    normalizeUrlForDedup,
    isDuplicateErrorRecord,
    mergeErrorRecords,
    generateNonWorkingExcel,
    parseNonWorkingExcel,
    calculateErrorStats,
    filterErrorRecords,
    getStoredErrorRecords,
    saveStoredErrorRecords
  };
});

