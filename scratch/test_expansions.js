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

const testCases = [
  "Kaulin Mfg. Co., Ltd.",
  "Acme Ind. Co., Ltd.",
  "ABC Intl. Corp.",
  "Apex Engg. Works Ltd.",
  "Global Tech. Inc.",
  "National Fire Equip. Ltd.",
  "General Prod. Co.",
  "Business Solns. Inc.",
  "Industrial Svcs. Ltd.",
  "Precision Mach. Co.",
  "Creative Pkg. Ltd.",
  "Advanced Chem. Corp.",
  "Modern Elec. Ind.",
  "Smith & Assoc.",
  "Kaulin Grp.",
  "Kaulin Mfg Co Ltd",
  "Kaulin Mfg. Co. Ltd.",
  "Kaulin CO.,LTD.",
  "U.S. Tsubaki Ind., LLC",
  "Carrier Corp.",
  "Furco (Taiwan) Co., Ltd.",
  "Nikorex Display Products (M) Sdn. Bhd.",
  "Danzer UK Ltd.",
  "Siemens AG",
  "Bosch GmbH",
  "Schneider Electric SA",
  "TotalEnergies SE",
  "Petrobras S.A.",
  "Vale S.A.",
  "Ambev S.A.",
  "Cemex S.A.B. de C.V.",
  "FEMSA S.A. de C.V.",
  "Embraer S.A.",
  "JSC Russian Railways",
  "PJSC Gazprom"
];

console.log("=== Current expandCompanyAbbreviations Output ===");
testCases.forEach(name => {
  const expanded = sandbox.expandCompanyAbbreviations(name);
  console.log(`${name}  ===>  ${expanded}`);
});

