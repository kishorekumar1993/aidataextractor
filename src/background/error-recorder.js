// Background error recorder service for non-working websites.
// Saves every non-working, redirect, and not-english site immediately to persistent storage.

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    Object.assign(root, factory());
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function () {
  "use strict";

  async function getStoredUserName() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
        const res = await chrome.storage.sync.get(["userName", "operatorName"]);
        return res.userName || res.operatorName || "Operator";
      }
    } catch (e) { }
    return "Operator";
  }

  /**
   * Records a website error event into local persistent storage.
   * If the site is working, it is strictly ignored and not recorded.
   */
  async function recordNonWorkingWebsite(input) {
    if (!input) return { success: false, reason: "No input provided" };

    const rawStatus = input["Website Status"] || input.websiteStatus || input.status;
    const category = typeof normalizeErrorCategory === "function"
      ? normalizeErrorCategory(rawStatus, input)
      : (String(rawStatus).toLowerCase() === "working" ? null : "Not Working");

    if (!category) {
      // Eligible working site - strictly excluded!
      return { success: false, ignored: true, reason: "Working websites are not recorded in error dataset" };
    }

    const newRecord = typeof createErrorRecord === "function"
      ? createErrorRecord(input)
      : {
        URL: input.URL || input.url || "",
        "Website Status": category,
        Reason: input.Reason || input.reason || "Website is not working or unavailable",
        "Error Keyword": input["Error Keyword"] || input.errorKeyword || "",
        "Error Source Link": input["Error Source Link"] || input.errorSourceLink || input["Error URL"] || input.errorUrl || input.URL || input.url || "",
        "Error Context": input["Error Context"] || input.errorContext || input.errorSnippet || "",
        Date: (typeof getLocalDateString === "function" ? getLocalDateString() : new Date().toISOString().split("T")[0]),
        Time: (typeof getLocalTimeString === "function" ? getLocalTimeString() : new Date().toTimeString().split(" ")[0])
      };

    if (!newRecord || !newRecord.URL) {
      return { success: false, reason: "Malformed record or missing URL" };
    }

    try {
      let existingRecords = [];
      let lastSyncTime = null;
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get([NON_WORKING_STORAGE_KEY, NON_WORKING_SYNC_TIME_KEY]);
        existingRecords = Array.isArray(data[NON_WORKING_STORAGE_KEY]) ? data[NON_WORKING_STORAGE_KEY] : [];
        lastSyncTime = data[NON_WORKING_SYNC_TIME_KEY] || null;
      }

      const { merged, addedCount } = typeof mergeErrorRecords === "function"
        ? mergeErrorRecords(existingRecords, [newRecord])
        : {
          merged: [...existingRecords, newRecord],
          addedCount: 1
        };

      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          [NON_WORKING_STORAGE_KEY]: merged
        });
      }

      console.log(`[ErrorRecorder] Recorded ${newRecord["Website Status"]} for ${newRecord.URL} (Added: ${addedCount > 0}, Total: ${merged.length})`);
      return {
        success: true,
        added: addedCount > 0,
        record: newRecord,
        totalRecords: merged.length
      };
    } catch (err) {
      console.warn("[ErrorRecorder] Failed to persist error record:", err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Retrieves all error records and summary statistics.
   */
  async function getNonWorkingRecordsAndStats() {
    try {
      let records = [];
      let lastSyncTime = null;
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get([NON_WORKING_STORAGE_KEY, NON_WORKING_SYNC_TIME_KEY]);
        records = Array.isArray(data[NON_WORKING_STORAGE_KEY]) ? data[NON_WORKING_STORAGE_KEY] : [];
        lastSyncTime = data[NON_WORKING_SYNC_TIME_KEY] || null;
      }
      const stats = typeof calculateErrorStats === "function"
        ? calculateErrorStats(records, lastSyncTime)
        : { totalNotWorking: 0, totalRedirect: 0, totalNotEnglish: 0, totalHistorical: records.length, lastSyncTime: "Never" };

      return { success: true, records, stats };
    } catch (err) {
      return { success: false, records: [], stats: {}, error: err.message };
    }
  }

  /**
   * Merges records from an external or existing Non_Working_Websites.xlsx file.
   */
  async function appendExternalExcelRecords(parsedRows = []) {
    if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
      return { success: false, reason: "No rows provided" };
    }
    try {
      let existingRecords = [];
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get([NON_WORKING_STORAGE_KEY]);
        existingRecords = Array.isArray(data[NON_WORKING_STORAGE_KEY]) ? data[NON_WORKING_STORAGE_KEY] : [];
      }

      const { merged, addedCount } = typeof mergeErrorRecords === "function"
        ? mergeErrorRecords(existingRecords, parsedRows)
        : { merged: [...existingRecords, ...parsedRows], addedCount: parsedRows.length };

      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          [NON_WORKING_STORAGE_KEY]: merged
        });
      }

      return { success: true, addedCount, totalRecords: merged.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Clears records from storage (requires explicit confirmation).
   */
  async function clearNonWorkingRecords() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove([NON_WORKING_STORAGE_KEY]);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Updates last Excel sync time.
   */
  async function updateLastExcelSync(timestamp = Date.now()) {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          [NON_WORKING_SYNC_TIME_KEY]: timestamp
        });
      }
      return { success: true, timestamp };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return {
    recordNonWorkingWebsite,
    getNonWorkingRecordsAndStats,
    appendExternalExcelRecords,
    clearNonWorkingRecords,
    updateLastExcelSync,
    getStoredUserName
  };
});

