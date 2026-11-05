const fs = require('fs');
const vm = require('vm');

const bgCode = fs.readFileSync('background.js', 'utf8');

const sandbox = {
  console: console, fetch: global.fetch, setTimeout: setTimeout, clearTimeout: clearTimeout,
  AbortSignal: AbortSignal, Headers: Headers, Request: Request, Response: Response, URL: URL,
  chrome: { runtime: { onMessage: { addListener: () => {} } }, storage: { local: { get: () => {} }, sync: { get: () => {} } } }
};

vm.createContext(sandbox);
vm.runInContext(bgCode, sandbox);

async function testRedirect() {
  console.log("=== Testing Redirect Site Detection ===");
  const testUrls = [
    "http://www.palramamericas.com",
    "http://palramamericas.com"
  ];

  for (const url of testUrls) {
    try {
      const crawl = await sandbox.crawlWebsite(url);
      console.log("\nURL:", url);
      console.log("finalUrl:", crawl.finalUrl);
      console.log("redirected:", crawl.redirected);
      console.log("status:", crawl.status);
      console.log("isRedirectDomain:", sandbox.isRedirectDomain(url, crawl.finalUrl));
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}

testRedirect();

