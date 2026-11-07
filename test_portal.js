// Test Portal interactive script complying with Manifest V3 CSP (no inline scripts)
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("website-name");
  const samplePills = document.querySelectorAll(".sample-pill");

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
      alert("Form submitted successfully!");
    });
  }
});
