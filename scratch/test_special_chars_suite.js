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
      local: { get: async () => ({}), set: async () => {} },
      sync: { get: async () => ({}), set: async () => {} }
    },
    runtime: { onMessage: { addListener: () => {} } }
  }
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const companyNameTests = [
  { in: "& AT&T Corp. &", expected: "AT&T Corporation" },
  { in: "# Johnson & Johnson #", expected: "Johnson & Johnson" },
  { in: "--- Procter & Gamble ---", expected: "Procter & Gamble" },
  { in: "* B&B #1 Solutions Inc. *", expected: "B&B #1 Solutions Incorporated" },
  { in: "© 2024 Barnes & Noble Ltd.", expected: "Barnes & Noble Limited" },
  { in: "# 100% Cotton Co., Ltd. #", expected: "100% Cotton Company, Limited" }
];

const addressTests = [
  { in: "\u200B4/F., 415 Jung-Jeng Road, New Taipei City", expected: "4/F., 415 Jung-Jeng Road, New Taipei City" },
  { in: "# 123 Main St, Suite #400, Chicago, Illinois #", expected: "123 Main Street, Suite #400, Chicago, Illinois" },
  { in: "& Unit #12 & #13, Industrial Park, London &", expected: "Unit #12 & #13 Industrial Park, London" },
  { in: "--- 500 Broadway, Apt #2B, New York ---", expected: "500 Broadway, Apartment #2b, New York" },
  { in: "123 Main Street (Building B)", expected: "123 Main Street, Building B" },
  { in: "123 Main Street, Suite 4,", expected: "123 Main Street, Suite 4" },
  { in: "@ 789 Technology Drive, Unit #5 @", expected: "789 Technology Drive, Unit #5" }
];

console.log("=== Testing Company Name Special Characters & Boundaries ===");
let cnFail = 0;
companyNameTests.forEach(t => {
  const dummyCrawl = {
    mainHtml: "<html><body>We manufacture quality industrial equipment.</body></html>",
    bodyText: "We manufacture quality industrial equipment.",
    copyrightText: "",
    legalCompanyCandidates: [],
    detectedProductCount: 3,
    originalUrl: "http://example.com"
  };
  const res = sandbox.applyStrictInstructions(
    { companyName: t.in, companyAddress: "123 Main Street, Suite 100, Chicago, Illinois", businessType: "Manufacturer", numberOfProducts: "3", websiteStatus: "Working" },
    dummyCrawl,
    { isRestricted: false }
  );
  const actual = res.companyName;
  const ok = actual === t.expected;
  if (!ok) {
    cnFail++;
    console.error(`FAIL: in="${t.in}" -> actual="${actual}", expected="${t.expected}"`);
  } else {
    console.log(`PASS: "${t.in}" -> "${actual}"`);
  }
});

console.log("\n=== Testing Company Address Special Characters & Boundaries ===");
let addrFail = 0;
addressTests.forEach(t => {
  const dummyCrawl = {
    mainHtml: "<html><body>We manufacture quality industrial equipment.</body></html>",
    bodyText: "We manufacture quality industrial equipment.",
    addressCandidates: [{ raw: t.in, priority: 1, isEnglish: true }],
    detectedProductCount: 3,
    originalUrl: "http://example.com"
  };
  const res = sandbox.applyStrictInstructions(
    { companyName: "Acme", companyAddress: t.in, businessType: "Manufacturer", numberOfProducts: "3", websiteStatus: "Working" },
    dummyCrawl,
    { isRestricted: false }
  );
  const actual = res.companyAddress;
  const ok = actual === t.expected;
  if (!ok) {
    addrFail++;
    console.error(`FAIL: in="${t.in}" -> actual="${actual}", expected="${t.expected}"`);
  } else {
    console.log(`PASS: "${t.in}" -> "${actual}"`);
  }
});

console.log(`\nResults: Company Name (${companyNameTests.length - cnFail}/${companyNameTests.length}), Address (${addressTests.length - addrFail}/${addressTests.length})`);
if (cnFail > 0 || addrFail > 0) process.exit(1);
