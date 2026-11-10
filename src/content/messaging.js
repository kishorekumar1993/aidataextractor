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

  // Proactively wakes up service worker if idle
  function ensureServiceWorkerAwake() {
    return new Promise((resolve) => {
      if (!isExtensionAlive()) return resolve(false);
      try {
        chrome.runtime.sendMessage({ action: "PING" }, (res) => {
          if (chrome.runtime.lastError) {
            setTimeout(() => resolve(true), 250);
          } else {
            resolve(true);
          }
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  // Resilient, non-looping message sender for MV3 service worker
  function sendRuntimeMessage(message) {
    return new Promise(async (resolve) => {
      if (!isExtensionAlive()) {
        AIExt.showReloadBanner();
        return resolve({ success: false, error: "Extension context invalidated. Please refresh this page (F5).", isExtensionError: true });
      }

      await ensureServiceWorkerAwake();

      try {
        chrome.runtime.sendMessage(message, (response) => {
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
