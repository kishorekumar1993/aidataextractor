// Service worker liveness and resilient MV3 runtime messaging helpers.

(function (AIExt) {
  const state = (AIExt.state = AIExt.state || {});

  function isExtensionAlive() {
    try {
      return !!(window.chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  // Proactively wakes up service worker if idle with bounded timeout
  function ensureServiceWorkerAwake() {
    return new Promise((resolve) => {
      if (!isExtensionAlive()) return resolve(false);
      let settled = false;
      const guardTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(true); // Don't block subsequent message even if ping timed out
        }
      }, 1200);

      try {
        chrome.runtime.sendMessage({ action: "PING" }, (res) => {
          if (settled) return;
          settled = true;
          clearTimeout(guardTimer);
          if (chrome.runtime.lastError) {
            setTimeout(() => resolve(true), 200);
          } else {
            resolve(true);
          }
        });
      } catch (e) {
        if (!settled) {
          settled = true;
          clearTimeout(guardTimer);
          resolve(false);
        }
      }
    });
  }

  // Resilient, non-looping message sender for MV3 service worker with bounded safety timeout
  function sendRuntimeMessage(message) {
    return new Promise(async (resolve) => {
      if (!isExtensionAlive()) {
        AIExt.showReloadBanner();
        return resolve({ success: false, error: "Extension context invalidated. Please refresh this page (F5).", isExtensionError: true });
      }

      await ensureServiceWorkerAwake();

      let settled = false;
      const timeoutMs = (message && message.action === "CRAWL_AND_EXTRACT") ? 27000 : 9000;
      const safetyTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.warn(`[Messaging] sendRuntimeMessage timed out after ${timeoutMs}ms for action:`, message && message.action);
          resolve({ success: false, error: `Background response timeout (${Math.round(timeoutMs / 1000)}s)`, isExtensionError: true });
        }
      }, timeoutMs);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (settled) return;
          settled = true;
          clearTimeout(safetyTimer);
          if (chrome.runtime.lastError) {
            const err = chrome.runtime.lastError.message || "Unknown error";
            if (err.includes("Extension context invalidated")) {
              AIExt.showReloadBanner();
            }
            return resolve({ success: false, error: err, isExtensionError: true });
          }
          resolve(response);
        });
      } catch (err) {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimer);
        if (err.message && err.message.includes("Extension context invalidated")) {
          AIExt.showReloadBanner();
        }
        resolve({ success: false, error: err.message, isExtensionError: true });
      }
    });
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("unhandledrejection", (event) => {
      if (event.reason && String(event.reason.message || event.reason).includes("Extension context invalidated")) {
        try { event.preventDefault(); } catch (e) { }
        AIExt.showReloadBanner();
      }
    });
  }

  Object.assign(AIExt, {
    isExtensionAlive,
    ensureServiceWorkerAwake,
    sendRuntimeMessage
  });
})(globalThis.__AI_EXTENSION__ = globalThis.__AI_EXTENSION__ || {});
