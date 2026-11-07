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
    storage: { local: { get: async () => ({}), set: async () => {} }, sync: { get: async () => ({}), set: async () => {} } },
    runtime: { onMessage: { addListener: () => {} } }
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const names = [
  "Cemex Sociedad Anónima Bursátil de Capital Variable",
  "Bosch Gesellschaft mit beschränkter Haftung",
  "Spółka z ograniczoną odpowiedzialnością",
  "Société à Responsabilité Limitée",
  "U.S. Tsubaki Industries, Limited Liability Company",
  "Kaulin Manufacturing Company, Limited"
];

names.forEach(n => {
  console.log(`${n}  ===>  ${sandbox.toTitleCase(n)}`);
});

