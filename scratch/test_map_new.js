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

function extractMapAddressesNew(html, targetList, pageUrl = "") {
  if (!html) return;
  const decodedHtml = sandbox.decodeHtmlEntities(html);
  const mapRegex = /(?:google\.[a-z.]+\/maps|maps\.google(?:\.[a-z.]+)?|baidu\.com|openstreetmap)[^"'>\s]*/gi;
  let match;
  while ((match = mapRegex.exec(decodedHtml)) !== null) {
    const rawUrl = match[0];
    try {
      const decoded = decodeURIComponent(rawUrl.replace(/&amp;/gi, "&"));
      let query = "";

      // 1. Standard query parameters (?q=..., ?query=..., ?place=..., ?daddr=..., ?saddr=..., ?hnear=...)
      const qMatch = decoded.match(/[?&](?:q|query|place|destination|daddr|saddr|hnear)=([^&"'>]+)/i);
      if (qMatch) {
        query = qMatch[1].replace(/\+/g, " ").trim();
      }

      // 2. /maps/place/<Address>/ or /maps/search/<Address>/
      if (!query || /^[-\d.,\s]+$/.test(query)) {
        const placeMatch = decoded.match(/\/maps\/(?:place|search)\/([^/@?#]+)/i);
        if (placeMatch) {
          query = placeMatch[1].replace(/\+/g, " ").replace(/,/g, ", ").trim();
        }
      }

      // 3. /maps/dir/.../<Address>
      if (!query || /^[-\d.,\s]+$/.test(query)) {
        const dirMatch = decoded.match(/\/maps\/dir\/[^\/]+\/([^/@?#]+)/i);
        if (dirMatch) {
          query = dirMatch[1].replace(/\+/g, " ").trim();
        }
      }

      // 4. Embedded Google Maps !2s<Address> parameter
      if (!query || /^[-\d.,\s]+$/.test(query)) {
        const pbMatch = decoded.match(/!2s([^!&"'>]+)/i);
        if (pbMatch) {
          const pbCandidate = pbMatch[1].replace(/\+/g, " ").trim();
          if (pbCandidate.length > 8 && !/^[-\d.,\s]+$/.test(pbCandidate)) {
            query = pbCandidate;
          }
        }
      }

      if (query.length > 8 && !/^[-\d.,\s]+$/.test(query) && !/^\d+$/.test(query)) {
        sandbox.addAddressCandidate(targetList, query, "map", false, "map", pageUrl, "Google Maps");
      }

      // Also check hnear if separate
      const hnearMatch = decoded.match(/[?&]hnear=([^&"'>]+)/i);
      if (hnearMatch) {
        const hnearQuery = hnearMatch[1].replace(/\+/g, " ").trim();
        if (hnearQuery.length > 8 && hnearQuery !== query && !/^[-\d.,\s]+$/.test(hnearQuery)) {
          sandbox.addAddressCandidate(targetList, hnearQuery, "map", false, "map", pageUrl, "Google Maps");
        }
      }
    } catch (e) { }
  }
}

async function test() {
  const html = await fetch("http://www.yi-shyang.com.tw/contact.html").then(r => r.text());
  const list = [];
  extractMapAddressesNew(html, list, "http://www.yi-shyang.com.tw/contact.html");
  console.log("New extractMapAddresses:", list);
}
test();

