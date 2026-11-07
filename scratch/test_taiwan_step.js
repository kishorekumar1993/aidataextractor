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

const rawAddr = 'No.228, Pao Shun Road, Hoo Hu Li, Chia Yi City, 60079, Taiwan, R.O.C.';
console.log('Step 1 (expandAddressAndStateAbbreviations):', sandbox.expandAddressAndStateAbbreviations(rawAddr, 'Taiwan'));
console.log('Step 2 (normalizeTaiwanDivisions):', sandbox.normalizeTaiwanDivisions(rawAddr));
console.log('Step 3 (repairBlindlySeparatedCommas):', sandbox.repairBlindlySeparatedCommas('Number 228 Pao Shun Road, Hoo Hu Li, Chia Yi City'));

