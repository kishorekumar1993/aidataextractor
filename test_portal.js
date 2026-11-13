// Test Portal interactive script complying with Manifest V3 CSP (no inline scripts)
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("website-name");
  const samplePills = document.querySelectorAll(".sample-pill");

  const queueUrls = [
    "http://www.site1-notworking.com",
    "http://www.site2-notworking.com",
    "http://www.site3-notworking.com",
    "http://www.site4-notworking.com",
    "http://www.site5-notworking.com",
    "http://www.site6-notworking.com",
    "http://www.site7-notworking.com",
    "http://www.site8-notworking.com",
    "http://www.site9-notworking.com",
    "http://www.site10-notworking.com",
    "http://www.site11-notworking.com",
    "http://www.site12-notworking.com"
  ];
  let queueIndex = 0;

  function loadNextFromQueue() {
    if (input && queueIndex < queueUrls.length) {
      input.value = queueUrls[queueIndex++];
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      console.log("[Test Portal] Loaded from queue:", input.value);
    }
  }

  const fromQueueBtn = document.getElementById("btnLoadNextQueueUrl");
  if (fromQueueBtn) {
    fromQueueBtn.addEventListener("click", loadNextFromQueue);
  }

  samplePills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const url = pill.getAttribute("data-url");
      if (input && url) {
        input.value = url;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  });

  const btnClickHere = document.querySelector(".btn-click-here");
  if (btnClickHere && input) {
    btnClickHere.addEventListener("click", () => {
      const val = input.value.trim();
      if (val) {
        window.open(val, "_blank");
      }
    });
  }

  const form = document.getElementById("data-entry-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      console.log("[Test Portal] Form submitted successfully for:", input?.value);
      // Auto-advance to next queue record upon submission
      loadNextFromQueue();
    });
  }
});

