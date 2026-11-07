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
      local: { get: async (keys) => ({}), set: async (items) => {} },
      sync: { get: async (keys) => ({}), set: async (items) => {} }
    },
    runtime: { onMessage: { addListener: () => {} } }
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

async function inspect(url) {
  const crawl = await sandbox.crawlWebsite(url);
  console.log(`=== Result for ${url} ===`, Object.keys(crawl));
  console.log('addressCandidates:', crawl.addressCandidates ? crawl.addressCandidates.slice(0, 5) : 'none');
  console.log('address:', crawl.address);
}

async function main() {
  await inspect("http://www.centertek.com");
  await inspect("http://www.yi-shyang.com.tw");
}
main();
