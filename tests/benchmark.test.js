const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

console.log('========================================================');
console.log('     AI DATA ENTRY ASSISTANT - REGRESSION TEST SUITE    ');
console.log('========================================================\n');

// Load background.js in VM
const bgCode = fs.readFileSync('background.js', 'utf8');
const ctx = vm.createContext({
  chrome: {
    runtime: { onMessage: { addListener: () => {} } },
    storage: { sync: { get: async () => ({}) } }
  },
  console: { log: () => {}, warn: () => {}, error: () => {} }
});
vm.runInContext(bgCode, ctx);

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Error: ${err.message}\n`);
    failed++;
  }
}

// 1. Address Comma Preservation before State (Oakleigh South, Victoria)
runTest('Address comma preserved before state (Oakleigh South, Victoria)', () => {
  const input = "Building 2, 1090 Centre Road, Oakleigh South, Victoria";
  const fixed = ctx.repairBlindlySeparatedCommas(input);
  assert.strictEqual(fixed, input, "Comma before Victoria must not be stripped");
  const ensured = ctx.ensureCommaBeforeState(fixed);
  assert.strictEqual(ensured, input, "Comma before Victoria must be preserved");
});

// 2. Suburb is not city (Oakleigh South -> city Not Available)
runTest('Australian suburbs without recognized city/town are Not Available', () => {
  const cityResult = ctx.evaluateCityQC("Building 2, 1090 Centre Road, Oakleigh South, Victoria", "Australia");
  assert.strictEqual(cityResult, "Not Available", "Oakleigh South is a suburb, not an official city/town");
});

// 3. UK Town Locality Normalization (Heanor Gate -> city Available)
runTest('UK recognized town locality (Heanor Gate -> Heanor, Derbyshire)', () => {
  const cityResult = ctx.evaluateCityQC("Delves Road, Heanor Gate, Heanor, Derbyshire", "United Kingdom");
  assert.strictEqual(cityResult, "Available", "Heanor Gate qualifies as recognized town Heanor");
});

// 4. On-site United Kingdom retention
runTest('On-site United Kingdom is strictly preserved', () => {
  const mockCrawlData = {
    addressCandidates: [{ raw: "Unit 1, Example Way, London, United Kingdom" }],
    bodyText: "Registered in England and Wales no. 123456",
    contactPageText: "Contact our UK office in London, United Kingdom"
  };
  const mockData = {
    _isFromAi: true,
    websiteStatus: "Working",
    companyName: "Example Co Limited",
    countryName: "United Kingdom",
    companyAddress: "Unit 1, Example Way, London, United Kingdom"
  };
  const result = ctx.applyStrictInstructions(mockData, mockCrawlData, {});
  assert.strictEqual(result.countryName, "United Kingdom", "Must retain United Kingdom, never downgrade to England");
});

// 5. Phone number country code and leading zero stripping
runTest('Phone number cleaning (Australia country code +61 stripped)', () => {
  const cleaned = ctx.cleanPhoneNumber("+61 3 9562 0780", "Australia");
  assert.strictEqual(cleaned, "395620780", "Should strip +61 and spaces");
});

runTest('Phone number cleaning (UK leading zero stripped)', () => {
  const cleaned = ctx.cleanPhoneNumber("01773 535638", "United Kingdom");
  assert.strictEqual(cleaned, "1773535638", "Should strip leading zero");
});

// 6. Toll-free phone rejection
runTest('Toll-free numbers rejected', () => {
  const tf1 = ctx.cleanPhoneNumber("1-800-633-6775", "United States");
  const tf2 = ctx.cleanPhoneNumber("888-555-0199", "United States");
  const tf3 = ctx.cleanPhoneNumber("1300 123 456", "Australia");
  assert.strictEqual(tf1, "", "800 must be rejected");
  assert.strictEqual(tf2, "", "888 must be rejected");
  assert.strictEqual(tf3, "", "1300 must be rejected");
});

// 7. Email filtering (Unwanted vs Valid)
runTest('Unwanted emails blacklisted', () => {
  assert.strictEqual(ctx.isUnwantedEmail("privacy@wwcables.com.au"), true, "privacy@ must be filtered");
  assert.strictEqual(ctx.isUnwantedEmail("legal@wwcables.com.au"), true, "legal@ must be filtered");
  assert.strictEqual(ctx.isUnwantedEmail("dpo@wwcables.com.au"), true, "dpo@ must be filtered");
  assert.strictEqual(ctx.isUnwantedEmail("webmaster@wwcables.com.au"), true, "webmaster@ must be filtered");
  assert.strictEqual(ctx.isUnwantedEmail("sales@wwcables.com.au"), false, "sales@ must be accepted");
  assert.strictEqual(ctx.isUnwantedEmail("info@ecutesting.com"), false, "info@ must be accepted");
});

// 8. Distributor vs Manufacturer
runTest('Distributor with shopping cart is Not Working', () => {
  const resellerCrawl = {
    bodyText: "We are an authorized distributor of leading brand manufacturers. Add to cart to buy now.",
    profilePageText: "Supply partner and retail store.",
    footerText: ""
  };
  const isMfg = ctx.isManufacturerSite(resellerCrawl, resellerCrawl.bodyText);
  assert.strictEqual(isMfg, false, "Distributor must not be classified as Manufacturer");
});

// 9. Independent Product Counts (Not forced to be identical)
runTest('Independent product metrics in AI mode', () => {
  const aiData = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Test Manufacturing Ltd",
    numberOfProducts: "0",
    productImages: "3",
    numberOfProductDescriptions: "1"
  };
  const res = ctx.applyStrictInstructions(aiData, {}, {});
  assert.strictEqual(res.numberOfProducts, "0", "numberOfProducts must stay 0");
  assert.strictEqual(res.productImages, "3", "productImages must stay 3");
  assert.strictEqual(res.numberOfProductDescriptions, "1", "numberOfProductDescriptions must stay 1");
});

// 10. Cross-Field Sanity Check (Non-working fields cleared)
runTest('Non-working status strictly clears all other 13 fields', () => {
  const dirtyData = {
    _isFromAi: true,
    websiteStatus: "Non English",
    businessType: "Manufacturer",
    companyName: "Foreign Brand Co Ltd",
    countryName: "Germany",
    companyAddress: "Musterstrasse 1, Berlin",
    state: "Available",
    city: "Available",
    emailId: "kontakt@muster.de",
    phoneNumber: "123456789",
    numberOfProducts: "3",
    productImages: "3",
    numberOfProductDescriptions: "3"
  };
  const res = ctx.applyStrictInstructions(dirtyData, {}, {});
  assert.strictEqual(res.businessType, "", "businessType must be cleared");
  assert.strictEqual(res.companyName, "", "companyName must be cleared");
  assert.strictEqual(res.companyAddress, "", "companyAddress must be cleared");
  assert.strictEqual(res.city, "", "city must be cleared");
  assert.strictEqual(res.state, "", "state must be cleared");
  assert.strictEqual(res.emailId, "", "emailId must be cleared");
  assert.strictEqual(res.phoneNumber, "", "phoneNumber must be cleared");
  assert.strictEqual(res.numberOfProducts, "", "numberOfProducts must be cleared");
  assert.strictEqual(res.productImages, "", "productImages must be cleared");
  assert.strictEqual(res.numberOfProductDescriptions, "", "numberOfProductDescriptions must be cleared");
});

console.log('\n========================================================');
console.log(`Results: ${passed} Passed, ${failed} Failed`);
console.log('========================================================');

if (failed > 0) {
  process.exit(1);
}
