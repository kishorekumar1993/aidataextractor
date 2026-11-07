const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('background.js', 'utf8');
const sandbox = {
  console: console,
  fetch: globalThis.fetch,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  URL: URL,
  AbortController: AbortController,
  TextDecoder: TextDecoder,
  TextEncoder: TextEncoder,
  ENV: { GEMINI_API_KEY: '', DEFAULT_MODEL: 'gemini-1.5-flash' },
  chrome: {
    storage: {
      local: { get: async (k) => ({}), set: async () => {} },
      sync: { get: async (k) => ({}), set: async () => {} }
    },
    runtime: { onMessage: { addListener: () => {} } }
  }
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

async function test() {
  const crawl = await sandbox.crawlWebsite("http://www.yi-shyang.com.tw/contact.html");
  console.log("yi-shyang contactHtml length:", (crawl.contactHtml || "").length);
  console.log("addressCandidates:", crawl.addressCandidates);
}
test();

