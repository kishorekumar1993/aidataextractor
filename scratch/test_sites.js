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
      local: {
        get: async (keys) => ({}),
        set: async (items) => {}
      },
      sync: {
        get: async (keys) => ({}),
        set: async (items) => {}
      }
    },
    runtime: {
      onMessage: { addListener: () => {} }
    }
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

async function run() {
  console.log("Testing centertek...");
  try {
    const res1 = await sandbox.handleCrawlAndExtract("http://www.centertek.com");
    console.log("Centertek Result:", JSON.stringify({
      companyName: res1.companyName,
      companyAddress: res1.companyAddress,
      city: res1.city,
      state: res1.state,
      countryName: res1.countryName
    }, null, 2));
  } catch(e) {
    console.error("Centertek Error:", e);
  }

  console.log("\nTesting yi-shyang...");
  try {
    const res2 = await sandbox.handleCrawlAndExtract("http://www.yi-shyang.com.tw");
    console.log("Yi-Shyang Result:", JSON.stringify({
      companyName: res2.companyName,
      companyAddress: res2.companyAddress,
      city: res2.city,
      state: res2.state,
      countryName: res2.countryName
    }, null, 2));
  } catch(e) {
    console.error("Yi-Shyang Error:", e);
  }
}

run();
