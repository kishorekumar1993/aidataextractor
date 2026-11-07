// Environment Configuration Template for Chrome Extension
// Copy or sync this file using `node sync_env.js` after setting your key in .env
(function (root) {
  const ENV = {
    GEMINI_API_KEY: "your_gemini_api_key_here",
    DEFAULT_MODEL: "gemini-3.5-flash-lite"
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ENV;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.ENV = ENV;
  }
  if (typeof self !== "undefined") {
    self.ENV = ENV;
  }
  if (typeof window !== "undefined") {
    window.ENV = ENV;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

