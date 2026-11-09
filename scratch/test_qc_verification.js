const fs = require('fs');
const assert = require('assert');

// Mock chrome
global.chrome = {
  runtime: { onMessage: { addListener: () => {} }, getURL: p => p },
  storage: { local: { get: (k, cb) => cb({}), set: (v, cb) => cb && cb() } },
  tabs: { query: (q, cb) => cb([]), sendMessage: () => {} }
};

const bgCode = fs.readFileSync('background.js', 'utf8');
(0, eval)(bgCode);

console.log("Running Country & Email QC Tests...");

// 1. UK & Constituent Countries Priority Rule:
assert.strictEqual(normalizeCountryName("England, United Kingdom"), "England");
assert.strictEqual(normalizeCountryName("United Kingdom (England)"), "England");
assert.strictEqual(normalizeCountryName("Scotland, United Kingdom"), "Scotland");
assert.strictEqual(normalizeCountryName("Wales, United Kingdom"), "Wales");
assert.strictEqual(normalizeCountryName("Northern Ireland, United Kingdom"), "Northern Ireland");
assert.strictEqual(normalizeCountryName("United Kingdom"), "United Kingdom");

// 2. Full Form Country Name Rule:
assert.strictEqual(normalizeCountryName("United States"), "United States Of America");
assert.strictEqual(normalizeCountryName("USA"), "United States Of America");
assert.strictEqual(normalizeCountryName("Czech Republic"), "Czechia");
assert.strictEqual(normalizeCountryName("Turkey"), "Turkiye");

// 3. Locality detection for UK constituent countries:
assert.strictEqual(detectCountryFromAddress("10 Downing Street, London, United Kingdom"), "England");
assert.strictEqual(detectCountryFromAddress("High Street, Manchester, United Kingdom"), "England");
assert.strictEqual(detectCountryFromAddress("Princes Street, Edinburgh, United Kingdom"), "Scotland");
assert.strictEqual(detectCountryFromAddress("Cardiff Bay, Cardiff, United Kingdom"), "Wales");
assert.strictEqual(detectCountryFromAddress("Donegall Square, Belfast, United Kingdom"), "Northern Ireland");

// 4. Test applyStrictInstructions refinement for UK:
const mockCrawlDataUK = {
  originalUrl: "http://britishtools.co.uk",
  finalUrl: "https://britishtools.co.uk",
  status: "Working",
  mainHtml: "<html><body><h1>British Tools Ltd</h1><p>Manufacturer of industrial tools in Essex, England.</p></body></html>",
  bodyText: "Our main office is based in Essex, England, providing precision manufacturing.",
  contactPageText: "Contact us at our Birmingham warehouse.",
  emails: ["info@britishtools.co.uk", "sales@britishtools.co.uk"],
  phones: ["01214960000"]
};

const rawAiUK = {
  websiteStatus: "Working",
  businessType: "Manufacturer",
  companyProfile: "Available",
  companyName: "British Tools Ltd",
  countryName: "United Kingdom",
  companyAddress: "Unit 4, Industrial Park, Essex",
  state: "Available",
  city: "Available",
  emailId: "info@britishtools.co.uk",
  secondaryEmailId: "sales@britishtools.co.uk",
  phoneNumber: "01214960000",
  numberOfProducts: "3",
  productImages: "3",
  numberOfProductDescriptions: "3"
};

const processedUK = applyStrictInstructions(rawAiUK, mockCrawlDataUK, { isRestricted: false });
assert.strictEqual(processedUK.websiteStatus, "Working");
assert.strictEqual(processedUK.countryName, "England", "Should refine United Kingdom to England due to Essex / England mention");
assert.strictEqual(processedUK.emailId, "info@britishtools.co.uk");
assert.strictEqual(processedUK.secondaryEmailId, "sales@britishtools.co.uk");

console.log("All QC Tests Passed Successfully!");
