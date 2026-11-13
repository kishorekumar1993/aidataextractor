const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('========================================================');
console.log('     AI DATA ENTRY ASSISTANT - REGRESSION TEST SUITE    ');
console.log('========================================================\n');

// Load background.js and its modular importScripts dependencies in VM
const rootDir = path.resolve(__dirname, '..');
const bgCode = fs.readFileSync(path.join(rootDir, 'background.js'), 'utf8');
let mockLocalStorage = {};
const ctx = vm.createContext({
  URL,
  AbortController,
  setTimeout,
  clearTimeout,
  fetch: async () => { throw new Error('Network fetch not mocked in test'); },
  chrome: {
    runtime: { onMessage: { addListener: () => {} } },
    storage: {
      sync: {
        get: async () => ({}),
        set: async () => {}
      },
      local: {
        get: async (keys) => {
          if (!keys) return { ...mockLocalStorage };
          const res = {};
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) {
            if (k in mockLocalStorage) res[k] = mockLocalStorage[k];
          }
          return res;
        },
        set: async (obj) => {
          Object.assign(mockLocalStorage, obj);
        },
        remove: async (keys) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) delete mockLocalStorage[k];
        }
      }
    }
  },
  console: { log: () => {}, warn: () => {}, error: () => {} }
});
ctx.importScripts = (...files) => {
  for (const file of files) {
    const targetPath = path.resolve(rootDir, file);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`importScripts file not found: ${file}`);
    }
    vm.runInContext(fs.readFileSync(targetPath, 'utf8'), ctx, { filename: file });
  }
};
vm.runInContext(bgCode, ctx, { filename: 'background.js' });

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err.stack);
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

runTest('Phone number country calling code stripping (High Priority across global countries)', () => {
  // Malaysia: +60 and raw 60
  assert.strictEqual(ctx.cleanPhoneNumber("+6043329299", "Malaysia"), "43329299", "Malaysia +60 must be stripped");
  assert.strictEqual(ctx.cleanPhoneNumber("6043329299", "Malaysia"), "43329299", "Malaysia raw 60 must be stripped");

  // China: +86 and raw 86
  assert.strictEqual(ctx.cleanPhoneNumber("+86 21 6888 8888", "China"), "2168888888", "China +86 must be stripped");
  assert.strictEqual(ctx.cleanPhoneNumber("862168888888", "China"), "2168888888", "China raw 86 must be stripped");

  // Taiwan: +886 and raw 886
  assert.strictEqual(ctx.cleanPhoneNumber("+886 4 7322367", "Taiwan"), "47322367", "Taiwan +886 must be stripped");
  assert.strictEqual(ctx.cleanPhoneNumber("88647322367", "Taiwan"), "47322367", "Taiwan raw 886 must be stripped");
  assert.strictEqual(ctx.cleanPhoneNumber("+886-6-2318800", "Taiwan"), "62318800", "Taiwan +886-6-2318800 must yield 62318800");

  // India: +91 and raw 91
  assert.strictEqual(ctx.cleanPhoneNumber("+91 98401 23456", "India"), "9840123456", "India +91 must be stripped");
  assert.strictEqual(ctx.cleanPhoneNumber("919840123456", "India"), "9840123456", "India raw 91 must be stripped");

  // USA: +1 and raw 1
  assert.strictEqual(ctx.cleanPhoneNumber("+1 (212) 555-1234", "United States"), "2125551234", "US +1 must be stripped");
  assert.strictEqual(ctx.cleanPhoneNumber("12125551234", "United States"), "2125551234", "US raw 1 must be stripped");

  // Germany: +49 and raw 49
  assert.strictEqual(ctx.cleanPhoneNumber("+49 89 1234567", "Germany"), "891234567", "Germany +49 must be stripped");
  assert.strictEqual(ctx.cleanPhoneNumber("49891234567", "Germany"), "891234567", "Germany raw 49 must be stripped");

  // France: +33 with trunk (0)
  assert.strictEqual(ctx.cleanPhoneNumber("+33 (0) 3 89 44 13 88", "France"), "389441388", "France +33 and trunk (0) must be stripped");
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

// 9. Product Metrics Synchronization (Takes API values when provided; falls back to own crawl only if missing or in manual mode)
runTest('Product items use API values when present and fall back to own crawl when missing or manual', () => {
  const aiData = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Test Manufacturing Ltd",
    numberOfProducts: "1",
    productImages: "1",
    numberOfProductDescriptions: "1"
  };
  const crawlWithThree = {
    detectedProductCount: 2,
    detectedImageCount: 3,
    detectedDescCount: 1
  };
  const res = ctx.applyStrictInstructions(aiData, crawlWithThree, {});
  assert.strictEqual(res.productImages, "1", "productImages must take API value (1)");
  assert.strictEqual(res.numberOfProducts, "1", "numberOfProducts must take API value (1)");
  assert.strictEqual(res.numberOfProductDescriptions, "1", "numberOfProductDescriptions must take API value (1)");

  const aiMissingProducts = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Test Missing Product Counts Ltd"
  };
  const resFallback = ctx.applyStrictInstructions(aiMissingProducts, crawlWithThree, {});
  assert.strictEqual(resFallback.productImages, "3", "Missing API productImages must fall back to own crawl (3)");
  assert.strictEqual(resFallback.numberOfProducts, "3", "Missing API numberOfProducts must fall back to own crawl (3)");
  assert.strictEqual(resFallback.numberOfProductDescriptions, "3", "Missing API numberOfProductDescriptions must fall back to own crawl (3)");

  const manualRes = ctx.applyStrictInstructions({
    _isFromAi: false,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Manual Crawl Ltd",
    countryName: "United States Of America",
    companyAddress: "100 Main Street, Chicago, Illinois"
  }, { mainHtml: "<html><body>Industrial Products</body></html>", detectedImageCount: 0, detectedProductCount: 0, detectedDescCount: 0 }, {});
  assert.strictEqual(manualRes.productImages, "0", "Manual fallback uses own crawl (0)");
  assert.strictEqual(manualRes.numberOfProducts, "0", "Manual fallback mirrors 0");
  assert.strictEqual(manualRes.numberOfProductDescriptions, "0", "Manual fallback mirrors 0");
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

// 11. Taiwan Administrative Hierarchy & Number Expansion
runTest('Taiwan Google Maps embed merge & village restoration (Yi-Shyang test case)', () => {
  // Test mergeTaiwanMapEmbed
  const mergedChinese = ctx.mergeTaiwanMapEmbed("嘉義市後湖里保順路228號", "600嘉義市東區保順路228號");
  assert.strictEqual(mergedChinese, "嘉義市東區後湖里保順路228號", "Merged Chinese must include East District and Houhu Village");

  // Test romanizeChineseAddress
  const romanized = ctx.romanizeChineseAddress(mergedChinese);
  assert.strictEqual(romanized, "Number 228, Baoshun Road, Houhu Village, East District, Chiayi City", "Romanized must expand No. -> Number and order smallest to largest");

  // Test manual fallback restoration when AI fails / is omitted
  const manualTaiwanData = {
    _isFromAi: false,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Yi Shyang Machinery Company, Limited",
    countryName: "Taiwan",
    companyAddress: "228 Baoshun Road, East District, Chiayi City",
    productImages: "3"
  };
  const crawlData = {
    mainHtml: "<html><body>Machinery Products</body></html>",
    country: "Taiwan",
    addressCandidates: [
      { raw: "No.228, Pao Shun Road, Hoo Hu Li, Chia Yi City, 60079, Taiwan, R.O.C.", source: "contact" },
      { raw: "嘉義市東區後湖里保順路228號", source: "map" }
    ]
  };
  const res = ctx.applyStrictInstructions(manualTaiwanData, crawlData, {});
  assert.strictEqual(
    res.companyAddress,
    "Number 228, Baoshun Road, Houhu Village, East District, Chiayi City",
    "Manual fallback must restore Number prefix and Houhu Village"
  );
  assert.strictEqual(res.state, "Not Available", "Taiwan provincial city has State Not Available");
  assert.strictEqual(res.city, "Available", "Chiayi City is Available");

  // County-administered city without County/Hsien (e.g. Changhua City / Chang Hua City) must have State Not Available
  const changhuaCityRes = ctx.applyStrictInstructions({
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "Jen-Mao Industrial Company, Limited",
    countryName: "Taiwan",
    companyAddress: "Number 262 Lane 23, Kuo Sheng Road, Chang Hua City",
    state: "Not Available",
    city: "Available",
    emailId: "jmmail@hardware168.com",
    phoneNumber: "88647322367",
    productImages: "3"
  }, {
    originalUrl: "http://www.hardware168.com/",
    finalUrl: "https://www.hardware168.com/en/index.html",
    country: "Taiwan",
    addressCandidates: [
      { raw: "No. 262 Lane 23, Kuo Sheng Rd., Chang Hua City 500, Taiwan", source: "contact" }
    ],
    emails: ["jmmail@hardware168.com"],
    phones: ["+886-4-732-2367"],
    detectedImageCount: 133
  }, {});
  assert.strictEqual(changhuaCityRes.companyAddress, "Number 262 Lane 23, Kuo Sheng Road, Chang Hua City", "Must preserve API address without injecting unwanted comma after Number 262 or altering Chang Hua City");
  assert.strictEqual(changhuaCityRes.state, "Not Available", "Changhua City without Changhua County must be State Not Available");
  assert.strictEqual(changhuaCityRes.city, "Available", "Changhua City must be City Available");
  assert.strictEqual(changhuaCityRes.phoneNumber, "47322367");
  assert.strictEqual(ctx.hasStateInAddress("Number 10, Road, Changhua County", "Taiwan"), true, "Explicit Changhua County must be State Available");
  assert.strictEqual(ctx.hasStateInAddress("Number 10, Road, Changhua City, Changhua County", "Taiwan"), true, "Changhua City with Changhua County must be State Available");
});

// 12. Global Phone Country Code Double-Stripping Guard
runTest('Phone cleaner does not strip foreign country codes from domestic numbers (Indonesia 82136903270 / Australia 395620780)', () => {
  assert.strictEqual(ctx.cleanPhoneNumber("+6282136903270", "Indonesia"), "82136903270", "Should strip +62 and keep 82136903270");
  assert.strictEqual(ctx.cleanPhoneNumber("82136903270", "Indonesia"), "82136903270", "Must NOT strip 82 (South Korea) from Indonesia domestic number");
  assert.strictEqual(ctx.cleanPhoneNumber("395620780", "Australia"), "395620780", "Must NOT strip 39 (Italy) from Australia domestic number");
});

// 13. Global Malformed mailto Email Artifact Cleanup & Deduplication
runTest('Malformed mailto prefix in href or email string is cleaned and deduplicated', () => {
  const html = `<a href="http://mailtoinfo@auliajati.com">Email</a> and info@auliajati.com`;
  const emails = ctx.extractEmailsFromHtml(html, "auliajati.com");
  assert.strictEqual(JSON.stringify(emails), JSON.stringify(["info@auliajati.com"]), "Should clean http://mailtoinfo@ to info@ and avoid duplicate");

  const mockAi = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Aulia Jati",
    countryName: "Indonesia",
    companyAddress: "Jalan R. A. Kardinah, Ring Road, Senenan, Jepara, Central Java",
    emailId: "info@auliajati.com",
    secondaryEmailId: "mailtoinfo@auliajati.com",
    phoneNumber: "82136903270",
    productImages: "3"
  };
  const res = ctx.applyStrictInstructions(mockAi, { emails: ["info@auliajati.com", "mailtoinfo@auliajati.com"] }, {});
  assert.strictEqual(res.emailId, "info@auliajati.com");
  assert.strictEqual(res.secondaryEmailId, "", "mailtoinfo@ must be cleaned and deduplicated so secondaryEmailId is empty");
  assert.strictEqual(res.phoneNumber, "82136903270", "Indonesian phone 82136903270 must remain intact");
});

// 14. Global Mobile Numbers & Full Address Expansion (Indonesian Honorifics, St./Dr. Safety, UK Counties)
runTest('Global mobile numbers (12-digit ID, Smartfren 0888, UK, AU) & address expansion', () => {
  // Indonesian 12-digit mobile + Smartfren 0888 prefix
  assert.strictEqual(ctx.cleanPhoneNumber("+62 812-3456-78901", "Indonesia"), "812345678901", "12-digit Indonesian mobile supported");
  assert.strictEqual(ctx.cleanPhoneNumber("+62 888-1234-5678", "Indonesia"), "88812345678", "Indonesian 0888 mobile not rejected as US toll-free");
  assert.strictEqual(ctx.cleanPhoneNumber("888-555-0199", "United States"), "", "US 888 toll-free still rejected");

  // Indonesian Honorific & Street Expansion
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations("Jl. RA. Kardinah, Senenan, Jepara", "Indonesia"),
    "Jalan Raden Ajeng Kardinah, Senenan, Jepara",
    "Jl. and RA. must expand properly"
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations("Jalan R. A. Kardinah, Senenan, Jepara", "Indonesia"),
    "Jalan Raden Ajeng Kardinah, Senenan, Jepara",
    "R. A. must expand to Raden Ajeng"
  );

  // St. and Dr. context safety (never Drive Sutomo or Street James Road)
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations("Jl. Dr. Sutomo 12, Jakarta", "Indonesia"),
    "Jalan Doktor Sutomo 12, Jakarta",
    "Dr. before name in Indonesia must become Doktor, not Drive"
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations("100 St. James Rd, London", "United Kingdom"),
    "100 Saint James Road, London",
    "St. before saint name must become Saint, not Street"
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations("15 Oak Dr, Chicago, IL", "United States"),
    "15 Oak Drive, Chicago, Illinois",
    "Dr at street end becomes Drive and IL becomes Illinois"
  );

  // UK Counties Expansion
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations("Unit 4, Ind. Est., Kettering, Northants", "United Kingdom"),
    "Unit 4, Industrial Estate, Kettering, Northamptonshire",
    "Ind. Est. and Northants must expand cleanly"
  );
});

// 15. Global Company Name Abbreviation Expansion
runTest('Company name abbreviations expand to full legal & industry forms', () => {
  assert.strictEqual(ctx.expandCompanyAbbreviations("Amoretti Bros. LLC", "United States").trim(), "Amoretti Brothers Limited Liability Company");
  assert.strictEqual(ctx.expandCompanyAbbreviations("Acme Mfg. Co., Ltd.", "Taiwan").trim(), "Acme Manufacturing Company, Limited");
  assert.strictEqual(ctx.expandCompanyAbbreviations("Acme Mfg. Co. Ltd.", "Taiwan").trim(), "Acme Manufacturing Company Limited");
  assert.strictEqual(ctx.expandCompanyAbbreviations("Acme Ind. Co. Ltd.", "Taiwan").trim(), "Acme Industries Company Limited");
  assert.strictEqual(ctx.expandCompanyAbbreviations("Acme Co., Ltd.", "Taiwan").trim(), "Acme Company, Limited");
  assert.strictEqual(ctx.expandCompanyAbbreviations("Acme Co.,Ltd.", "Taiwan").trim(), "Acme Company, Limited");
  assert.strictEqual(ctx.expandCompanyAbbreviations("Acme Co. Ltd.", "Taiwan").trim(), "Acme Company Limited");
  assert.strictEqual(ctx.expandCompanyAbbreviations("Acme Co Ltd", "Taiwan").trim(), "Acme Company Limited");
  assert.strictEqual(ctx.expandCompanyAbbreviations("Acme Company Limited", "Taiwan").trim(), "Acme Company Limited");
  assert.strictEqual(ctx.expandCompanyAbbreviations("Global (Malaysia) Sdn Bhd", "Malaysia").replace(/\s+/g, " ").trim(), "Global Malaysia Sendirian Berhad");
  assert.strictEqual(ctx.expandCompanyAbbreviations("PT Karya Ind. Tbk", "Indonesia").trim(), "Perseroan Terbatas Karya Industries Terbuka");
  assert.strictEqual(ctx.expandCompanyAbbreviations("Krupp Tech. GmbH", "Germany").trim(), "Krupp Technology Gesellschaft mit beschränkter Haftung");
  assert.strictEqual(ctx.expandCompanyAbbreviations("Pacific Precision Pty Ltd", "Australia").trim(), "Pacific Precision Proprietary Limited");
});

// 16. Synced UK Country Resolution (Fallback matches AI path) & International Contact Slugs
runTest('Deterministic UK country resolution matches AI path & resolves England when UK omitted', () => {
  const ukAddrCrawl = {
    addressCandidates: [{ raw: "Unit 1, Example Way, London, United Kingdom" }],
    bodyText: "Registered in England and Wales no. 123456",
    contactPageText: "London, United Kingdom"
  };
  assert.strictEqual(
    ctx.resolveUkCountryName("United Kingdom", "Unit 1, Example Way, London", ukAddrCrawl),
    "United Kingdom",
    "Fallback resolver must preserve United Kingdom when UK is explicitly in addressCandidates"
  );

  const englandOnlyCrawl = {
    addressCandidates: [{ raw: "42 High Street, Manchester, M1 1AA" }],
    bodyText: "Registered in England. Precision manufacturer.",
    contactPageText: "42 High Street, Manchester"
  };
  assert.strictEqual(
    ctx.resolveUkCountryName("United Kingdom", "42 High Street, Manchester", englandOnlyCrawl),
    "England",
    "Resolver must refine to England when UK is omitted and England is stated"
  );
});

runTest('discoverContactLinks finds international contact and about pages', () => {
  const html = `
    <nav>
      <a href="/kontakt">Kontakt</a>
      <a href="/ueber-uns">Über uns</a>
      <a href="/contacto">Contacto</a>
      <a href="/quienes-somos">Quiénes somos</a>
      <a href="/contatti">Contatti</a>
      <a href="/chi-siamo">Chi siamo</a>
      <a href="/contactez-nous">Contactez-nous</a>
    </nav>
  `;
  const links = ctx.discoverContactLinks(html, "https://example.eu/");
  assert.ok(links.includes("https://example.eu/kontakt"), "Must discover German /kontakt");
  assert.ok(links.includes("https://example.eu/ueber-uns"), "Must discover German /ueber-uns");
  assert.ok(links.includes("https://example.eu/contacto"), "Must discover Spanish /contacto");
  assert.ok(links.includes("https://example.eu/quienes-somos"), "Must discover Spanish /quienes-somos");
  assert.ok(links.includes("https://example.eu/contatti"), "Must discover Italian /contatti");
  assert.ok(links.includes("https://example.eu/chi-siamo"), "Must discover Italian /chi-siamo");
  assert.ok(links.includes("https://example.eu/contactez-nous"), "Must discover French /contactez-nous");
});

// 17. Source Link Attribution (Emails, Address, Company Name, Business Type) in AI & Fallback Modes
runTest('AI and fallback modes populate accurate subpage source links for all fields', () => {
  const emailSourceMap = {};
  ctx.updateEmailSource(emailSourceMap, "info@auliajati.com", "https://www.auliajati.com/", "https://www.auliajati.com/");
  ctx.updateEmailSource(emailSourceMap, "info@auliajati.com", "https://www.auliajati.com/contact-us/", "https://www.auliajati.com/");
  ctx.updateEmailSource(emailSourceMap, "info@auliajati.com", "https://www.auliajati.com/privacy-policy/", "https://www.auliajati.com/");
  ctx.updateEmailSource(emailSourceMap, "support@auliajati.com", "https://www.auliajati.com/warranty/", "https://www.auliajati.com/");
  assert.strictEqual(emailSourceMap["info@auliajati.com"], "https://www.auliajati.com/contact-us/", "Contact page must beat homepage and privacy page for primary email");
  assert.strictEqual(emailSourceMap["support@auliajati.com"], "https://www.auliajati.com/warranty/", "Support/warranty email must keep warranty page URL");

  // Map embed on /contact.html preserves its exact subpage URL
  const mapCands = [];
  ctx.extractMapAddresses(
    '<iframe src="https://maps.google.com/maps?q=No.+228,+Baoshun+Rd,+Houhu+Village,+Chiayi+City,+Taiwan"></iframe>',
    mapCands,
    "https://www.yi-shyang.com.tw/contact.html"
  );
  assert.strictEqual(mapCands[0].pageUrl, "https://www.yi-shyang.com.tw/contact.html", "Map address must retain contact subpage URL");

  const crawlData = {
    originalUrl: "https://www.auliajati.com/",
    finalUrl: "https://www.auliajati.com/",
    primaryContactUrl: "https://www.auliajati.com/contact-us/",
    primaryAboutUrl: "https://www.auliajati.com/about-us/",
    mainHtml: "<html><body><h1>Auliajati Indofurni</h1><p>Welcome to our site.</p><footer><a href='/privacy'>Privacy</a></footer></body></html>",
    bodyText: "Auliajati Indofurni Welcome to our site.",
    contactPageText: "Office & Factory: Jl. RA. Kardinah, Senenan, Jepara Email: info@auliajati.com",
    profilePageText: "About Us: CV. Aulia Jati Indofurni. We manufacture indoor and outdoor furniture in our own factory.",
    copyrightText: "CV. Aulia Jati Indofurni",
    copyrightSourceUrl: "https://www.auliajati.com/about-us/",
    legalCompanyCandidates: ["CV. Aulia Jati Indofurni"],
    legalCandidateSources: { "CV. Aulia Jati Indofurni": "https://www.auliajati.com/about-us/" },
    emails: ["info@auliajati.com", "support@auliajati.com"],
    emailSourceMap,
    phones: ["+62 2136903270"],
    detectedImageCount: 3,
    detectedProductCount: 3,
    detectedDescCount: 3,
    hasCompanyProfile: true,
    addressCandidates: [
      { raw: "Jl. RA. Kardinah, Senenan, Jepara, Central Java", source: "contact", isHeadquarters: true, pageUrl: "https://www.auliajati.com/contact-us/" }
    ],
    crawledPages: [
      {
        url: "https://www.auliajati.com/",
        html: "<html><body><h1>Auliajati</h1><img src='/images/factory-hero.png' alt='factory'></body></html>",
        text: "Auliajati Welcome to our homepage."
      },
      {
        url: "https://www.auliajati.com/about-us/",
        html: "<html><body><p>CV. Aulia Jati Indofurni. We manufacture wooden furniture in our own factory. <a href='/privacy'>Privacy</a></p></body></html>",
        text: "CV. Aulia Jati Indofurni. We manufacture wooden furniture in our own factory."
      },
      {
        url: "https://www.auliajati.com/contact-us/",
        html: "<html><body><p>Office & Factory: Jl. RA. Kardinah, Senenan, Jepara, Central Java</p><a href='mailto:info@auliajati.com'>info@auliajati.com</a></body></html>",
        text: "Office & Factory: Jl. RA. Kardinah, Senenan, Jepara, Central Java info@auliajati.com"
      },
      {
        url: "https://www.auliajati.com/warranty/",
        html: "<html><body><p>Warranty inquiries: support@auliajati.com</p></body></html>",
        text: "Warranty inquiries: support@auliajati.com"
      }
    ]
  };

  const aiResult = ctx.applyStrictInstructions({
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "CV. Aulia Jati Indofurni",
    countryName: "Indonesia",
    companyAddress: "Jl. RA. Kardinah, Senenan, Jepara, Central Java",
    state: "Available",
    city: "Available",
    emailId: "info@auliajati.com",
    secondaryEmailId: "support@auliajati.com",
    phoneNumber: "+62 2136903270",
    numberOfProducts: "3",
    productImages: "3",
    numberOfProductDescriptions: "3"
  }, crawlData, { isRestricted: false });

  assert.strictEqual(aiResult.primaryEmailSource, "https://www.auliajati.com/contact-us/", "AI mode must populate Contact page as primaryEmailSource");
  assert.strictEqual(aiResult.secondaryEmailSource, "https://www.auliajati.com/warranty/", "AI mode must populate Warranty page as secondaryEmailSource");
  assert.strictEqual(aiResult.companyAddressSource, "https://www.auliajati.com/contact-us/", "AI mode must populate Contact page as companyAddressSource");
  assert.strictEqual(aiResult.companyNameSource, "https://www.auliajati.com/about-us/", "AI mode must attribute legal name to /about-us/, not homepage");
  assert.strictEqual(aiResult.businessTypeSource, "https://www.auliajati.com/about-us/", "AI mode must attribute BT Source to /about-us/ page, not image or /privacy");

  const fallbackResult = ctx.applyStrictInstructions({
    _isFromAi: false,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "CV. Aulia Jati Indofurni",
    countryName: "Indonesia",
    companyAddress: "Jl. RA. Kardinah, Senenan, Jepara, Central Java",
    emailId: "info@auliajati.com",
    secondaryEmailId: "support@auliajati.com",
    phoneNumber: "+62 2136903270",
    productImages: "3"
  }, crawlData, { isRestricted: false });

  assert.strictEqual(fallbackResult.primaryEmailSource, aiResult.primaryEmailSource, "Fallback and AI primaryEmailSource must match");
  assert.strictEqual(fallbackResult.secondaryEmailSource, aiResult.secondaryEmailSource, "Fallback and AI secondaryEmailSource must match");
  assert.strictEqual(fallbackResult.companyAddressSource, aiResult.companyAddressSource, "Fallback and AI companyAddressSource must match");
  assert.strictEqual(fallbackResult.companyNameSource, aiResult.companyNameSource, "Fallback and AI companyNameSource must match");
  assert.strictEqual(fallbackResult.businessTypeSource, aiResult.businessTypeSource, "Fallback and AI businessTypeSource must match");
});

runTest('updateEmailSource handles international contact slugs like /kontakt and /contacto', () => {
  const map = {};
  ctx.updateEmailSource(map, "sales@firma.de", "https://firma.de/", "https://firma.de/");
  ctx.updateEmailSource(map, "sales@firma.de", "https://firma.de/kontakt", "https://firma.de/");
  assert.strictEqual(map["sales@firma.de"], "https://firma.de/kontakt", "German /kontakt must beat homepage");

  const mapEs = {};
  ctx.updateEmailSource(mapEs, "hola@empresa.es", "https://empresa.es/", "https://empresa.es/");
  ctx.updateEmailSource(mapEs, "hola@empresa.es", "https://empresa.es/contacto/", "https://empresa.es/");
  assert.strictEqual(mapEs["hola@empresa.es"], "https://empresa.es/contacto/", "Spanish /contacto/ must beat homepage");
});

// 19. State and City trust API values when provided, and enforce QC rules on missing API values & manual crawl fallback
runTest('State and City enforce instruction sheet rules in manual crawl and missing-field AI fallback', () => {
  const aiDirectValues = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Global Example Ltd",
    countryName: "Australia",
    companyAddress: "Building 2, 1090 Centre Road, Oakleigh South, Victoria",
    state: "Available",
    city: "Not Available",
    productImages: "3"
  };
  const resAiDirect = ctx.applyStrictInstructions(aiDirectValues, {}, {});
  assert.strictEqual(resAiDirect.state, "Available", "API state must be taken directly");
  assert.strictEqual(resAiDirect.city, "Not Available", "API city must be taken directly");

  const aiMissingStateCity = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Melbourne Example Ltd",
    countryName: "Australia",
    companyAddress: "123 Collins Street, Melbourne, Victoria",
    productImages: "3"
  };
  const resMissing = ctx.applyStrictInstructions(aiMissingStateCity, {}, {});
  assert.strictEqual(resMissing.state, "Available", "Missing API state must fall back to Victoria QC check");
  assert.strictEqual(resMissing.city, "Available", "Missing API city must fall back to Melbourne QC check");

  const manualCrawlStub = { mainHtml: "<html><body>Industrial Products</body></html>" };

  const manualSuburbCase = {
    _isFromAi: false,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Global Example Ltd",
    countryName: "Australia",
    companyAddress: "Building 2, 1090 Centre Road, Oakleigh South, Victoria",
    state: "Available",
    city: "Available",
    productImages: "3"
  };
  const res1 = ctx.applyStrictInstructions(manualSuburbCase, manualCrawlStub, {});
  assert.strictEqual(res1.state, "Available", "Victoria in address must keep state=Available");
  assert.strictEqual(res1.city, "Not Available", "Manual crawl suburb Oakleigh South must be city=Not Available");

  const manualUnknownSuburb = {
    _isFromAi: false,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Sample Co Ltd",
    countryName: "Australia",
    companyAddress: "40 Sample Road, Unknown Suburb",
    state: "Available",
    city: "Available",
    productImages: "3"
  };
  const resUnknown = ctx.applyStrictInstructions(manualUnknownSuburb, manualCrawlStub, {});
  assert.strictEqual(resUnknown.state, "Not Available", "No state written in address must be state=Not Available in manual mode");
  assert.strictEqual(resUnknown.city, "Not Available", "Unknown Suburb must be city=Not Available in manual mode");

  const manualSuburbVillage = {
    _isFromAi: false,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "NZ Example Ltd",
    countryName: "New Zealand",
    companyAddress: "15 Penrose Road, Penrose",
    state: "Available",
    city: "Available",
    productImages: "3"
  };
  const resNz = ctx.applyStrictInstructions(manualSuburbVillage, manualCrawlStub, {});
  assert.strictEqual(resNz.state, "Not Available", "Penrose without region/capital must have state=Not Available");
  assert.strictEqual(resNz.city, "Not Available", "Penrose suburb alone must have city=Not Available");

  assert.strictEqual(
    ctx.evaluateCityQC("Unit 5, Trafford Park, Greater Manchester", "United Kingdom"),
    "Not Available",
    "UK industrial suburb Trafford Park without city must be Not Available"
  );
  assert.strictEqual(
    ctx.evaluateCityQC("Jl. Industri Raya, MM2100 Industrial Town, Cibitung", "Indonesia"),
    "Not Available",
    "Indonesian Industrial Town estate without city/kabupaten/kecamatan must be Not Available"
  );
  assert.strictEqual(
    ctx.hasStateInAddress("Via Roma 10, MI", "Italy"),
    false,
    "Non-US 2-letter code MI must not falsely trigger Michigan state"
  );

  // County, Province, Prefecture -> State; Town, District, Municipality -> City; National Capital -> both Available
  assert.strictEqual(ctx.hasStateInAddress("10 Main Street, Osaka Prefecture", "Japan"), true, "Prefecture must be State Available");
  assert.strictEqual(ctx.hasStateInAddress("10 Main Street, Aichi Pref.", "Japan"), true, "Pref. abbreviation must be State Available");
  assert.strictEqual(ctx.hasStateInAddress("10 Main Street, Kent County", "United Kingdom"), true, "County must be State Available");
  assert.strictEqual(ctx.hasStateInAddress("10 Main Street, Limpopo Province", "South Africa"), true, "Province must be State Available");
  assert.strictEqual(ctx.hasStateInAddress("100 County Road 42, Rixheim", "France"), false, "County Road street label must NOT falsely trigger State Available");

  assert.strictEqual(ctx.evaluateCityQC("10 Main Street, Some Town, Kent", "United Kingdom"), "Available", "Town must be City Available");
  assert.strictEqual(ctx.evaluateCityQC("10 Main Street, Peak District", "United Kingdom"), "Available", "District must be City Available");
  assert.strictEqual(ctx.evaluateCityQC("10 Main Street, Ekurhuleni Municipality", "South Africa"), "Available", "Municipality must be City Available");
  assert.strictEqual(ctx.evaluateCityQC("10 District Road, Unknown Suburb", "Australia"), "Not Available", "District Road street label must NOT trigger City Available");

  for (const [capAddr, capCountry] of [
    ["1-1 Marunouchi, Tokyo", "Japan"],
    ["100 Wellington Street, Ottawa", "Canada"],
    ["10 Downing Street, London", "United Kingdom"],
    ["500 Pennsylvania Avenue, Washington D.C.", "United States Of America"],
    ["10 Rue de Rivoli, Paris", "France"],
    ["123 Zhongxiao Road, Taipei City", "Taiwan"]
  ]) {
    const capResManual = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: "Working",
      businessType: "Manufacturer",
      companyName: "Capital Corp Limited",
      countryName: capCountry,
      companyAddress: capAddr,
      state: "Not Available",
      city: "Not Available",
      productImages: "3"
    }, manualCrawlStub, {});
    assert.strictEqual(capResManual.state, "Available", `Capital in "${capAddr}" must make State Available in manual mode`);
    assert.strictEqual(capResManual.city, "Available", `Capital in "${capAddr}" must make City Available in manual mode`);

    const capResAiMissing = ctx.applyStrictInstructions({
      _isFromAi: true,
      websiteStatus: "Working",
      businessType: "Manufacturer",
      companyName: "Capital Corp Limited",
      countryName: capCountry,
      companyAddress: capAddr,
      productImages: "3"
    }, {}, {});
    assert.strictEqual(capResAiMissing.state, "Available", `Missing AI state for capital in "${capAddr}" must fall back to Available`);
    assert.strictEqual(capResAiMissing.city, "Available", `Missing AI city for capital in "${capAddr}" must fall back to Available`);
  }

  const rule7Prompt = ctx.buildExtractionPrompt({ originalUrl: "https://example.com", title: "Ex", emails: [], phones: [] }, false);
  assert.ok(/County,\s*Province,\s*Prefecture/i.test(rule7Prompt), "Prompt must state County, Province, Prefecture -> State");
  assert.ok(/Town,\s*District,\s*Municipality/i.test(rule7Prompt), "Prompt must state Town, District, Municipality -> City");
  assert.ok(/capital city is mentioned.*BOTH\s*"state":\s*"Available"\s*AND\s*"city":\s*"Available"/i.test(rule7Prompt), "Prompt must state capital makes both State and City Available");
});

// 20. Global 135-Country Standardization, QC Corrections, Global State/City & Calling Codes
runTest('Global 135-country QC corrections, State/City detection, and calling codes', () => {
  const corrections = [
    ["Deutschland", "Germany"],
    ["España", "Spain"],
    ["Italia", "Italy"],
    ["Nederland", "Netherlands"],
    ["Österreich", "Austria"],
    ["Schweiz", "Switzerland"],
    ["Hrvatska", "Croatia"],
    ["Turkiye", "Türkiye"],
    ["Turkey", "Türkiye"],
    ["UAE", "United Arab Emirates"],
    ["U.A.E.", "United Arab Emirates"],
    ["UK", "United Kingdom"],
    ["USA", "United States Of America"],
    ["U.S.A.", "United States Of America"],
    ["United States", "United States Of America"],
    ["Republic of Korea", "South Korea"],
    ["ROK", "South Korea"],
    ["DPRK", "North Korea"],
    ["Republic of China", "Taiwan"],
    ["ROC", "Taiwan"],
    ["Peoples Republic of China", "China"],
    ["PRC", "China"],
    ["Kingdom of Bahrain", "Bahrain"],
    ["Sultanate of Oman", "Oman"],
    ["Czechia", "Czech Republic"],
    ["CZ", "Czech Republic"],
    ["TR", "Türkiye"],
    ["Brunei", "Brunei Darussalam"],
    ["BN", "Brunei Darussalam"],
    ["KSA", "Saudi Arabia"],
    ["PNG", "Papua New Guinea"],
    ["St. Lucia", "Saint Lucia"],
    ["T&T", "Trinidad and Tobago"],
    ["DR", "Dominican Republic"],
    ["HK", "Hong Kong"],
    ["Hong Kong", "Hong Kong"],
    ["Trinidad and Tobago", "Trinidad and Tobago"]
  ];
  for (const [raw, expected] of corrections) {
    assert.strictEqual(ctx.normalizeCountryName(raw), expected, `${raw} must standardize to ${expected}`);
  }

  // Global State & City fallback evaluation
  assert.strictEqual(ctx.evaluateCityQC("28 Rue Zuber, Rixheim", "France"), "Available", "Rixheim in France is a recognized city/town");
  assert.strictEqual(ctx.hasStateInAddress("28 Rue Zuber, Rixheim", "France"), false, "28 Rue Zuber, Rixheim omits Haut-Rhin/Grand Est");
  assert.strictEqual(ctx.hasStateInAddress("Ilica 10, Zagreb", "Croatia"), true, "Zagreb is Croatia's National Capital");
  assert.strictEqual(ctx.evaluateCityQC("Ilica 10, Zagreb", "Croatia"), "Available", "Zagreb is Croatia's city/capital");
  assert.strictEqual(ctx.detectCountryFromAddress("12 Calea Victoriei, Bucharest"), "Romania");
  assert.strictEqual(ctx.detectCountryFromAddress("PO Box 100, Muscat"), "Oman");
  assert.strictEqual(ctx.detectCountryFromAddress("Av. Corrientes 500, Buenos Aires"), "Argentina");
  assert.strictEqual(ctx.detectCountryFromAddress("ul. Marszalkowska 10, Warsaw"), "Poland");

  // Calling codes across newly added countries
  assert.strictEqual(ctx.cleanPhoneNumber("+385 1 234 5678", "Croatia"), "12345678");
  assert.strictEqual(ctx.cleanPhoneNumber("+971 4 321 9876", "United Arab Emirates"), "43219876");
  assert.strictEqual(ctx.cleanPhoneNumber("+974 4412 3456", "Qatar"), "44123456");
  assert.strictEqual(ctx.cleanPhoneNumber("+48 22 654 3210", "Poland"), "226543210");
  assert.strictEqual(ctx.cleanPhoneNumber("+55 11 98765 4321", "Brazil"), "11987654321");
});

// Test 23: Indonesia address expansion & Contact Us #1 priority ranking
runTest('Indonesia address expansion & Contact Us #1 priority ranking', () => {
  // 1. Indonesia address abbreviations (with/without spaces, honorifics, provinces, and PT guard)
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations("Jl.RA. Kardinah Ring Road Senenan Jepara Central Java", "Indonesia"),
    "Jalan Raden Ajeng Kardinah Ring Road Senenan Jepara Central Java"
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations("Perum. Graha Indah Blk. A2 No. 5, Kec. Cikarang Selatan, Kab. Bekasi, Jabar", "Indonesia"),
    "Perumahan Graha Indah Blok A2 Number 5, Kecamatan Cikarang Selatan, Kabupaten Bekasi, Jawa Barat"
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations("Jl. K.H. Mas Mansyur Kav. 10, Lt. 3, Kel. Karet, Tanah Abang, DKI Jakarta", "Indonesia"),
    "Jalan Kiai Haji Mas Mansyur Kavling 10, Lantai 3, Kelurahan Karet, Tanah Abang, DKI Jakarta"
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations("Jl. H.R. Rasuna Said, Kec. Setiabudi, Jakarta", "Indonesia"),
    "Jalan Haji Rangkayo Rasuna Said, Kecamatan Setiabudi, Jakarta"
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations("Ds. Kecapi, Kec. Tahunan, Kab. Jepara, Jateng", "Indonesia"),
    "Desa Kecapi, Kecamatan Tahunan, Kabupaten Jepara, Jawa Tengah"
  );
  const ptResult = ctx.expandAddressAndStateAbbreviations("PT Jaya Abadi, Jl. Dr. Sutomo 12, Surabaya", "Indonesia");
  assert(!ptResult.includes("Point"), `Indonesian PT must not expand to Point (got: ${ptResult})`);
  assert(ptResult.includes("Jalan Doktor Sutomo"), `Indonesian Dr. must expand to Doktor (got: ${ptResult})`);

  // 2. Contact Us links strictly prioritized ahead of About / Products / Careers
  const sampleHtml = `
    <nav>
      <a href="/about-us/">About Us</a>
      <a href="/products/">Products</a>
      <a href="/careers/">Careers</a>
      <a href="/hubungi-kami/">Hubungi Kami</a>
      <a href="/contact-us/">Contact Us</a>
    </nav>
  `;
  const links = ctx.discoverContactLinks(sampleHtml, "https://example.co.id/");
  assert(links.length >= 2, "Expected discovered contact/about links");
  assert(
    links[0].includes("/contact-us") || links[0].includes("/hubungi-kami"),
    `Contact link must be ranked #1 (got: ${links.join(", ")})`
  );

  // 3. Dedicated Contact Us address candidate outranks Homepage & Footer
  const candidates = [];
  ctx.addAddressCandidate(candidates, "Jalan Sudirman 10, Jakarta", "footer", false, "general", "https://example.co.id/", "");
  ctx.addAddressCandidate(candidates, "Jalan Thamrin 20, Jakarta", "homepage", true, "hq", "https://example.co.id/", "");
  ctx.addAddressCandidate(candidates, "Jl. Ahmad Yani 99, Semarang, Jawa Tengah", "contact", true, "hq", "https://example.co.id/contact-us/", "");
  candidates.sort((a, b) => a.priority - b.priority);
  assert.strictEqual(candidates[0].source, "contact", "Dedicated contact address candidate must have highest priority (lowest number)");
  assert(candidates[0].priority < 1, `Contact HQ candidate priority should be < 1 (got: ${candidates[0].priority})`);

  // 4. Contact Us page email ranks strictly above Homepage & About emails
  const ranked = ctx.rankEmails(
    ["hello@example.co.id", "info@example.co.id", "sales@example.co.id"],
    "example.co.id",
    {
      "hello@example.co.id": "https://example.co.id/about-us",
      "info@example.co.id": "https://example.co.id/",
      "sales@example.co.id": "https://example.co.id/contact-us"
    }
  );
  assert.strictEqual(ranked[0], "sales@example.co.id", `Contact Us email must rank #1 (got: ${ranked.join(", ")})`);
});

// Test 24: Remove leading/trailing special characters & preserve internal special characters unexpanded
runTest('Remove leading/trailing special characters & do not expand internal symbols', () => {
  // 1. Remove ANY special characters from beginning or end (including ., ), *, -, ®, ™, #, &)
  assert.strictEqual(
    ctx.expandCompanyAbbreviations("* H&R Mfg. Co. ®", "United States Of America"),
    "H&R Manufacturing Company"
  );
  assert.strictEqual(
    ctx.expandCompanyAbbreviations("- Acme Corp.)", "United States Of America"),
    "Acme Corporation"
  );
  assert.strictEqual(
    ctx.expandCompanyAbbreviations("© \"Smith & Sons\" ™ !", "United Kingdom"),
    "Smith & Sons"
  );
  assert.strictEqual(
    ctx.cleanCompanyPrefixesAndSuffixes("R/C Electronics Ltd."),
    "R/C Electronics Ltd"
  );

  // 2. Do NOT expand "&" or "+" in GmbH & Co. KG / GmbH + Co. KG
  assert.strictEqual(
    ctx.expandCompanyAbbreviations("Müller GmbH & Co. KG", "Germany"),
    "Müller Gesellschaft mit beschränkter Haftung & Compagnie Kommanditgesellschaft"
  );
  assert.strictEqual(
    ctx.expandCompanyAbbreviations("Meyer GmbH + Co. KG", "Germany"),
    "Meyer Gesellschaft mit beschränkter Haftung + Compagnie Kommanditgesellschaft"
  );

  // 3. Full applyStrictInstructions (AI mode): strip end "." and ")" AND restore expanded symbols (&, +, %, /)
  const symCrawl = {
    originalUrl: "https://hrdesign.example.com/",
    finalUrl: "https://hrdesign.example.com/",
    status: "Working",
    title: "H&R Manufacturing | Design+Build",
    logoText: "H&R Manufacturing",
    mainHtml: "<html><body><h1>Design+Build</h1><p>100% Plastics Co.</p><p>Contact: sales@hrdesign.example.com</p></body></html>",
    bodyText: "H&R Manufacturing Design+Build 100% Plastics Co. Industrial equipment.",
    contactHtml: "",
    contactPageText: "100 Main Street, Chicago, Illinois",
    footerText: "Copyright 2026 H&R Manufacturing",
    emails: ["sales@hrdesign.example.com"],
    phones: ["3125551234"],
    addressCandidates: [{ raw: "100 Main Street, Chicago, Illinois", source: "contact", isHeadquarters: true, priority: 0.5 }],
    detectedProductCount: 3,
    detectedImageCount: 3,
    detectedDescCount: 3
  };

  const aiDotEnd = ctx.applyStrictInstructions({
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "® *H And R Manufacturing.) *",
    countryName: "United States",
    companyAddress: "100 Main Street, Chicago, Illinois",
    state: "Available",
    city: "Available",
    emailId: "sales@hrdesign.example.com",
    phoneNumber: "3125551234",
    numberOfProducts: "3",
    productImages: "3",
    numberOfProductDescriptions: "3"
  }, symCrawl, { isRestricted: false });
  assert.strictEqual(aiDotEnd.companyName, "H&R Manufacturing");

  const aiPlus = ctx.applyStrictInstructions({
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "Design Plus Build Ltd.",
    countryName: "United States",
    companyAddress: "100 Main Street, Chicago, Illinois",
    state: "Available",
    city: "Available",
    emailId: "sales@hrdesign.example.com",
    phoneNumber: "3125551234",
    numberOfProducts: "3",
    productImages: "3",
    numberOfProductDescriptions: "3"
  }, symCrawl, { isRestricted: false });
  assert.strictEqual(aiPlus.companyName, "Design+Build Limited");

  const aiPct = ctx.applyStrictInstructions({
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "& 100 Percent Plastics Co. -",
    countryName: "United States",
    companyAddress: "100 Main Street, Chicago, Illinois",
    state: "Available",
    city: "Available",
    emailId: "sales@hrdesign.example.com",
    phoneNumber: "3125551234",
    numberOfProducts: "3",
    productImages: "3",
    numberOfProductDescriptions: "3"
  }, symCrawl, { isRestricted: false });
  assert.strictEqual(aiPct.companyName, "100% Plastics Company");
});

// Test 25: Indonesian RT/RW, Dk., Prov., no-comma Jateng, ec-indonesia Jl./MM2100 & tes@gmail.com filter
runTest('Indonesian RT/RW/Dk/province expansion, decimal KM comma, and ec-indonesia crawl extraction', () => {
  const buildMock = (addr) => ctx.applyStrictInstructions({
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "Test Co Ltd",
    countryName: "Indonesia",
    companyAddress: addr,
    state: "Available",
    city: "Available",
    emailId: "info@test.co.id",
    phoneNumber: "81234567890",
    numberOfProducts: "3",
    productImages: "3",
    numberOfProductDescriptions: "3"
  }, {
    originalUrl: "https://test.co.id",
    finalUrl: "https://test.co.id",
    mainHtml: "<html><body>Manufacturing</body></html>",
    addressCandidates: [{ raw: addr, source: "contact", priority: 0.5 }],
    emails: ["info@test.co.id"],
    phones: ["081234567890"],
    detectedProductCount: 3,
    detectedImageCount: 3,
    detectedDescCount: 3
  }, { isRestricted: false });

  assert.strictEqual(
    buildMock("Mambak RT 02 RW 03, Pakis Aji, Jepara, Central Java").companyAddress,
    "Mambak Rukun Tetangga 02 Rukun Warga 03, Pakis Aji, Jepara, Central Java"
  );
  assert.strictEqual(
    buildMock("Mambak RT.02/RW.03 Kec. Pakis Aji Kab. Jepara Jateng 59456").companyAddress,
    "Mambak Rukun Tetangga 02 Rukun Warga 03 Kecamatan Pakis Aji Kabupaten Jepara, Jawa Tengah"
  );
  assert.strictEqual(
    buildMock("Dk. Mambak RT 02 / RW 03, Ds. Mambak, Kec. Pakis Aji, Kab. Jepara, Prov. Jawa Tengah").companyAddress,
    "Dukuh Mambak Rukun Tetangga 02 Rukun Warga 03, Desa Mambak, Kecamatan Pakis Aji, Kabupaten Jepara, Provinsi Jawa Tengah"
  );
  assert.strictEqual(
    buildMock("Jl. Soekarno-Hatta KM. 5,5, Kel. Tlogosari, Kec. Pedurungan, Semarang, Jateng").companyAddress,
    "Jalan Soekarno-Hatta Kilometer 5,5, Kelurahan Tlogosari, Kecamatan Pedurungan, Semarang, Jawa Tengah"
  );
  assert.strictEqual(
    buildMock("MM2100 Industrial Town Jl. Sumba Kav. A3 Cibitung, Bekasi, 17520").companyAddress,
    "MM2100 Industrial Town Jalan Sumba Kavling A3, Cibitung, Bekasi"
  );

  // Verify addAddressCandidate accepts Indonesian Jl. / RT RW addresses and footer phone/email filtering works
  const cands = [];
  ctx.addAddressCandidate(cands, "MM2100 Industrial Town Jl. Sumba Kav. A3 Cibitung, Bekasi, 17520", "footer", false, "general", "https://www.ec-indonesia.com/", "");
  ctx.addAddressCandidate(cands, "Mambak RT 02 RW 03, Pakis Aji, Jepara, Central Java", "contact", false, "contact", "https://www.ec-indonesia.com/contact", "");
  assert.strictEqual(cands.length, 2, "Indonesian Jl. and RT/RW addresses must both be accepted by addAddressCandidate");
  assert.strictEqual(ctx.isUnwantedEmail("tes@gmail.com"), true, "Dummy test email tes@gmail.com must be rejected");
});

// Test 26: Placeholder emails/phones (example@mail.com), ID vs Idaho guard, extended company/address expansions, boundary special chars
runTest('Placeholder emails/phones blocked, ID vs Idaho fixed, company/address expansions & symbol preservation', () => {
  // 1. Placeholder form inputs never leak into emails or secondaryEmailId
  const formHtml = `
    <form>
      <label>Email *</label><input type="email" placeholder="e.g., example@mail.com">
      <label>Phone *</label><input type="tel" placeholder="e.g., 123-456-7890">
      <a href="mailto:sales@kayulama.com">sales@kayulama.com</a>
    </form>
  `;
  const parsedFormEmails = ctx.extractEmailsFromHtml(formHtml, "kayulama.com");
  assert.strictEqual(JSON.stringify(parsedFormEmails), JSON.stringify(["sales@kayulama.com"]), "Placeholder example@mail.com must be excluded from HTML email extraction");
  assert.strictEqual(ctx.isUnwantedEmail("example@mail.com"), true, "example@mail.com must be rejected by isUnwantedEmail");
  assert.strictEqual(ctx.cleanPhoneNumber("123-456-7890", "United States"), "", "Dummy placeholder phone 123-456-7890 must be rejected");

  const aiKayulama = ctx.applyStrictInstructions({
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "Kayulama",
    countryName: "Indonesia",
    companyAddress: "Jl. Raya Batealit - Bangsri, Kec. Batealit, Kab. Jepara, Jateng",
    state: "Available",
    city: "Available",
    emailId: "sales@kayulama.com",
    secondaryEmailId: "example@mail.com",
    phoneNumber: "+62 247619249",
    productImages: "3"
  }, { emails: ["sales@kayulama.com", "example@mail.com"] }, {});
  assert.strictEqual(aiKayulama.secondaryEmailId, "", "AI secondaryEmailId example@mail.com must be stripped");
  assert.strictEqual(
    aiKayulama.companyAddress,
    "Jalan Raya Batealit - Bangsri, Kecamatan Batealit, Kabupaten Jepara, Jawa Tengah"
  );

  // 2. Indonesian ", ID" + 5-digit postcode must NOT mis-detect as Idaho / USA
  assert.strictEqual(
    ctx.detectCountryFromAddress("Jalan Raya Batealit - Bangsri, Kabupaten Jepara, 59461, ID"),
    "Indonesia"
  );
  assert.ok(
    !/idaho/i.test(ctx.expandAddressAndStateAbbreviations("Jalan Raya Batealit - Bangsri, Kabupaten Jepara, 59461, ID", "")),
    "Indonesian JSON-LD ', ID' must not expand to Idaho"
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations("Perumahan Semarang Indah Blok B2 No.3, Semarang Bar., Jateng", "Indonesia"),
    "Perumahan Semarang Indah Blok B2 Number 3, Semarang Barat, Jawa Tengah",
    "Blok B2 must NOT become Basement 2 and No.3 / Semarang Bar. / Jateng must expand"
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations("Jl. Jend. A. Yani, Prov. Babel", "Indonesia"),
    "Jalan Jenderal Ahmad Yani, Provinsi Bangka Belitung"
  );

  // 3. Extended Company Abbreviations, boundary special chars, and unexpanded symbols
  assert.strictEqual(
    ctx.expandCompanyAbbreviations("P.T. Karya Indl. & Eng. Mfg. Co., Ltd.", "Indonesia"),
    "Perseroan Terbatas Karya Industrial & Engineering Manufacturing Company, Limited"
  );
  assert.strictEqual(
    ctx.expandCompanyAbbreviations("ABC Hydr. & Pneum. Matls. Pty.Ltd.", "Australia"),
    "ABC Hydraulics & Pneumatics Materials Proprietary Limited"
  );
  const symAndAbbr = ctx.applyStrictInstructions({
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "*** ®Smith And Co., Ltd. ™ —",
    countryName: "United Kingdom",
    companyAddress: "Unit 2, Ind. Est., Kettering, Northants",
    state: "Available",
    city: "Available",
    emailId: "info@smithco.co.uk",
    phoneNumber: "+44 1536 123456",
    productImages: "3"
  }, { logoText: "Smith & Co., Ltd.", title: "Smith & Co., Ltd." }, {});
  assert.strictEqual(symAndAbbr.companyName, "Smith & Company, Limited", "Boundary special chars removed, Co. -> Company, And -> & restored");
  assert.strictEqual(symAndAbbr.companyAddress, "Unit 2, Industrial Estate, Kettering, Northamptonshire");
});

// Test 27: Strip unwanted narrative prose clauses & boilerplate labels from Company Name, and support Sp. z o.o. / Ges.m.b.H.
runTest('Strip unwanted prose clauses & field labels from company names and support Polish Sp. z o.o.', () => {
  const aboutHtml = `<html><body><p>In 1997, AK Engineering was transformed into Mechatronic Systems GmbH and began developing products. Company is renamed Mechatronic Systems GmbH.</p></body></html>`;
  const contactHtml = `<html><body><p>Company information</p><p>Company name: Mechatronic Engineering Sp.z.o.o</p><footer>© 2026 Mechatronic Engineering Sp.z.o.o All Rights Reserved.</footer></body></html>`;
  const mainHtml = `<html><head><script type="application/ld+json">{"@type":"Organization","name":"Mechatronic Systems","legalName":"Mechatronic Engineering Sp. z o.o."}</script></head><body></body></html>`;

  const aboutCands = ctx.extractLegalCandidatesFromHtml(aboutHtml);
  for (const c of aboutCands) {
    assert.ok(!/\b(?:was|transformed|into|is|renamed)\b/i.test(c), `Prose word leaked into candidate: ${c}`);
  }
  assert.ok(aboutCands.includes("Mechatronic Systems GmbH"));

  const contactCands = ctx.extractLegalCandidatesFromHtml(contactHtml);
  assert.ok(contactCands.includes("Mechatronic Engineering Sp.z.o.o"), "Expected labeled Polish company name");
  assert.strictEqual(ctx.extractJsonLdOrganizationName(mainHtml), "Mechatronic Engineering Sp. z o.o.");
  assert.strictEqual(ctx.hasCompleteLegalSuffix("Mechatronic Engineering Sp.z.o.o"), true);

  assert.strictEqual(
    ctx.cleanCompanyPrefixesAndSuffixes("Engineering Was Transformed Into Mechatronic Systems GmbH"),
    "Mechatronic Systems GmbH"
  );
  assert.strictEqual(
    ctx.cleanCompanyPrefixesAndSuffixes("Company information Company name: Acme Ltd - Leading Supplier"),
    "Acme Ltd"
  );
  assert.strictEqual(
    ctx.cleanCompanyPrefixesAndSuffixes("Welcome to our website Beta Corp."),
    "Beta Corp"
  );
  assert.strictEqual(
    ctx.expandCompanyAbbreviations("Alpine Optics Ges.m.b.H.", "Austria"),
    "Alpine Optics Gesellschaft mit beschränkter Haftung"
  );

  const mechatronicCrawl = {
    originalUrl: "http://www.mechatronic-systems.com",
    finalUrl: "https://mechatronic-systems.com/",
    mainHtml,
    contactHtml,
    copyrightText: "Mechatronic Engineering Sp.z.o.o",
    legalCompanyCandidates: Array.from(new Set([...contactCands, ...aboutCands])),
    logoText: "Mechatronic Systems",
    title: "SMT machines | Mechatronic Systems",
    addressCandidates: [{ raw: "Innowacyjna 6, Gardno, 74-100 Gryfino", source: "contact" }],
    emails: ["info@mechatronic-systems.com"],
    phones: ["693893855"]
  };

  const aiFixed = ctx.applyStrictInstructions({
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "Engineering Was Transformed Into Mechatronic Systems GmbH",
    countryName: "Poland",
    companyAddress: "Innowacyjna 6, Gardno, Gryfino",
    state: "Not Available",
    city: "Not Available",
    emailId: "info@mechatronic-systems.com",
    phoneNumber: "693893855",
    productImages: "3"
  }, mechatronicCrawl, {});
  assert.ok(!/transformed|into|was/i.test(aiFixed.companyName), `AI companyName retained prose noise: ${aiFixed.companyName}`);
  assert.strictEqual(aiFixed.companyName, "Mechatronic Systems Gesellschaft Mit Beschränkter Haftung");

  const aiCleanShort = ctx.applyStrictInstructions({
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "Mechatronic Systems",
    countryName: "Poland",
    companyAddress: "Innowacyjna 6, Gardno, Gryfino",
    state: "Not Available",
    city: "Not Available",
    emailId: "info@mechatronic-systems.com",
    phoneNumber: "693893855",
    productImages: "3"
  }, mechatronicCrawl, {});
  assert.strictEqual(aiCleanShort.companyName, "Mechatronic Systems", "AI companyName must be preserved when API returned a clean name");

  const manualShort = ctx.applyStrictInstructions({
    _isFromAi: false,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "",
    countryName: "Poland",
    companyAddress: "Innowacyjna 6, Gardno, Gryfino",
    state: "Not Available",
    city: "Not Available",
    emailId: "info@mechatronic-systems.com",
    phoneNumber: "693893855",
    productImages: "3"
  }, mechatronicCrawl, {});
  assert.ok(/Mechatronic/i.test(manualShort.companyName) && /Gesellschaft Mit Beschränkter Haftung|Spółka Z Ograniczoną Odpowiedzialnością/i.test(manualShort.companyName));
});

// 28. Modular Split Integrity: manifest.json content_scripts load cleanly & resolve all AIExt references
runTest('Modular MV3 split loads all content scripts cleanly with valid AIExt bindings', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
  const files = manifest.content_scripts[0].js;
  assert.ok(files.length >= 9, `Expected modular content_scripts list, got ${files.length}`);

  const noopEl = {
    style: { setProperty: () => {} },
    classList: { add: () => {}, remove: () => {} },
    addEventListener: () => {},
    setAttribute: () => {},
    appendChild: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    closest: () => null,
    innerHTML: '',
    textContent: '',
    value: ''
  };
  const mockWindow = { location: { href: 'https://example.com/dataextraction' }, addEventListener: () => {} };
  const cCtx = vm.createContext({
    console: { log: () => {}, warn: () => {}, error: () => {} },
    window: mockWindow,
    document: {
      readyState: 'complete',
      body: noopEl,
      head: noopEl,
      title: 'Test Portal',
      createElement: () => ({ ...noopEl }),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    chrome: {
      runtime: { id: 'test-ext', onMessage: { addListener: () => {} }, sendMessage: (_, cb) => cb && cb({ success: true }) },
      storage: {
        sync: { get: (_, cb) => cb && cb({}), set: () => {} },
        local: { get: (_, cb) => cb && cb({}), set: () => {}, remove: () => {} },
        onChanged: { addListener: () => {} }
      }
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    Event: function () {},
    URL,
    MutationObserver: function () { return { observe: () => {} }; }
  });
  cCtx.globalThis = cCtx;
  mockWindow.chrome = cCtx.chrome;

  for (const rel of files) {
    const abs = path.join(rootDir, rel);
    assert.ok(fs.existsSync(abs), `Missing manifest content script: ${rel}`);
    vm.runInContext(fs.readFileSync(abs, 'utf8'), cCtx, { filename: rel });
  }

  const ext = cCtx.__AI_EXTENSION__;
  assert.ok(ext && ext.state, 'AIExt namespace and shared state must exist');
  assert.strictEqual(cCtx.normalizeCountryName('USA'), 'United States Of America');
  assert.strictEqual(cCtx.stripTrailingContactWordsFromEmail('info@acme.comphone'), 'info@acme.com');
  assert.strictEqual(ext.isDataEntryPage(), true);

  for (const rel of files.filter(x => x.startsWith('src/content') || x === 'content.js')) {
    const src = fs.readFileSync(path.join(rootDir, rel), 'utf8');
    for (const m of src.matchAll(/AIExt\.([a-zA-Z0-9_]+)/g)) {
      assert.ok(m[1] in ext, `Undefined AIExt.${m[1]} referenced in ${rel}`);
    }
  }

  // Verify #ai-crawl-btn ("Auto-Crawl & Pre-Fill") resolves AIExt.triggerCrawlAndFill lazily even if widget was created before content.js
  const overlaySrc = fs.readFileSync(path.join(rootDir, 'src/content/overlay-ui.js'), 'utf8');
  assert.ok(!/crawlBtn\.addEventListener\(\s*["']click["']\s*,\s*AIExt\.triggerCrawlAndFill\s*\)/.test(overlaySrc),
    '#ai-crawl-btn must wrap AIExt.triggerCrawlAndFill in a function instead of passing undefined before content.js loads');
  assert.ok(overlaySrc.includes('type="button" class="ai-action-btn ai-btn-primary" id="ai-crawl-btn"'),
    '#ai-crawl-btn must have type="button"');
});

// 29. Rule 4 Company Name formatting (brackets, copyright symbols, U.S. dots, internal commas/ampersands)
runTest('Rule 4 company name formatting preserves U.S. dots, symbols, commas, and strips brackets', () => {
  const formatCompanyName = (compName, country = "") => {
    let n = ctx.decodeHtmlEntities((compName || "").trim());
    n = n.replace(/['’`]\s*s\b/gi, "'s");
    n = ctx.cleanCompanyPrefixesAndSuffixes(n);
    n = ctx.expandCompanyAbbreviations(n, country);
    n = ctx.cleanCompanyPrefixesAndSuffixes(n);
    n = n.replace(/[\(\[\{]\s*([^\)\]\}]+?)\s*[\)\]\}]/g, " $1 ");
    n = n.replace(/[\(\)\[\]\{\}]/g, " ");
    n = ctx.stripBoundarySpecialChars(n);
    n = ctx.toTitleCase(n);
    return n;
  };

  assert.strictEqual(formatCompanyName("U.S. Tsubaki Industrial, LLC", "United States Of America"), "U.S. Tsubaki Industrial, Limited Liability Company");
  assert.strictEqual(formatCompanyName("Carrier (USA) (Ohio) Inc", "United States Of America"), "Carrier USA Ohio Incorporated");
  assert.strictEqual(formatCompanyName("- # Acme Tools, Inc. -", "United States Of America"), "Acme Tools, Incorporated");
  assert.strictEqual(formatCompanyName("© 2024 Peter Forg Manufacturing Co.", "United States Of America"), "Peter Forg Manufacturing Company");
  assert.strictEqual(formatCompanyName("Delta [India] Pvt. Ltd.", "India"), "Delta India Private Limited");
  assert.strictEqual(formatCompanyName("Johnson, Smith & Associates, LLC", "United States Of America"), "Johnson, Smith & Associates, Limited Liability Company");
  assert.strictEqual(formatCompanyName("High Precision, Inc. //", "United States Of America"), "High Precision, Incorporated");
});

// 30. Full 135-country valid list & accented QC address detection (incl. Greenland, Österreich, Türkiye)
runTest('All 135 valid countries normalize & detect from address including accented QC entries', () => {
  const valid135 = [
    'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan',
    'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Bhutan','Bolivia','Botswana',
    'Brazil','Brunei Darussalam','Bulgaria','Cambodia','Canada','Cayman Islands','China','Colombia','Costa Rica','Croatia',
    'Cyprus','Czech Republic','Denmark','Dominican Republic','Egypt','Estonia','Ethiopia','Fiji','Finland','France',
    'Germany','Ghana','Greece','Greenland','Guatemala','Guyana','Hong Kong','Hungary','Iceland','India',
    'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan',
    'Kenya','Kuwait','Latvia','Lebanon','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malaysia','Maldives',
    'Malta','Mauritius','Mexico','Moldova','Mongolia','Morocco','Mozambique','Myanmar','Namibia','Nepal',
    'Netherlands','New Zealand','Nicaragua','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Panama',
    'Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda',
    'Saint Lucia','Samoa','Saudi Arabia','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','South Africa',
    'South Korea','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tanzania',
    'Thailand','Trinidad and Tobago','Tunisia','Türkiye','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States',
    'Uruguay','Uzbekistan','Vanuatu','Vietnam','Zambia','Zimbabwe'
  ];

  for (const c of valid135) {
    const exp = c === 'United States' ? 'United States Of America' : c;
    assert.strictEqual(ctx.normalizeCountryName(c), exp, `normalizeCountryName failed for ${c}`);
    assert.strictEqual(ctx.detectCountryFromAddress(`123 Main St, ${c}`), exp, `detectCountryFromAddress failed for ${c}`);
  }

  assert.strictEqual(ctx.detectCountryFromAddress('Ringstrasse 1, Wien, Österreich'), 'Austria');
  assert.strictEqual(ctx.detectCountryFromAddress('Nuuk, Greenland'), 'Greenland');
  assert.strictEqual(ctx.detectCountryFromAddress('Imaneq 12, Nuuk'), 'Greenland');
  assert.strictEqual(ctx.detectCountryFromAddress('Calle Mayor 5, España'), 'Spain');
  assert.strictEqual(ctx.detectCountryFromAddress('Ilica 1, Hrvatska'), 'Croatia');
  assert.strictEqual(ctx.normalizeCountryName('Peoples Republic of China'), 'China');
  assert.strictEqual(ctx.normalizeCountryName('Republic of China'), 'Taiwan');
  assert.strictEqual(ctx.normalizeCountryName('Kingdom of Bahrain'), 'Bahrain');
  assert.strictEqual(ctx.normalizeCountryName('Sultanate of Oman'), 'Oman');
});

// 31. Expanded global address abbreviations & dangling Ges truncation cleanup
runTest('Global address expansions (PL, FR, NL, BR, MX, TR, AT, CH, IN) & truncated Ges cleanup', () => {
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations('Z.I. des Platanes, Lyon', 'France'),
    'Zone Industrielle des Platanes, Lyon'
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations('ul. Innowacyjna 6, pl. Zamkowy, Warszawa', 'Poland'),
    'Ulica Innowacyjna 6, Plac Zamkowy, Warszawa'
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations('Ind. Terrein De Hurk, Str. 5, Eindhoven', 'Netherlands'),
    'Industrieterrein De Hurk, Straat 5, Eindhoven'
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations('Rod. Anhanguera 10, Campinas, SP', 'Brazil'),
    'Rodovia Anhanguera 10, Campinas, São Paulo'
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations('Col. Industrial Vallejo, Pque. Ind. Norte, CDMX', 'Mexico'),
    'Colonia Industrial Vallejo, Parque Industrial Norte, Ciudad de Mexico'
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations('Ataturk Cad. 12, Merkez Mah., OSB, Bursa', 'Türkiye'),
    'Ataturk Caddesi 12, Merkez Mahallesi, Organize Sanayi Bolgesi, Bursa'
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations('MIDC Area, Opp. Railway Station, Pune, MH', 'India'),
    'Maharashtra Industrial Development Corporation Area, Opposite Railway Station, Pune, Maharashtra'
  );
  assert.strictEqual(
    ctx.expandAddressAndStateAbbreviations('Hauptstrasse 1, St. Polten, NÖ', 'Austria'),
    'Hauptstrasse 1, Saint Polten, Niederösterreich'
  );
  assert.strictEqual(
    ctx.cleanCompanyPrefixesAndSuffixes('Engineering Was Transformed Into Mechatronic Systems Ges'),
    'Mechatronic Systems'
  );
});

// 32. Named highways (GAR Highway, MLK, FM), global routes/zones in BOTH code & Gemini prompt
runTest('Named highways (GAR Highway, MLK, FM) and global country abbreviations expand in code & prompt', () => {
  assert.strictEqual(
    ctx.toTitleCase(ctx.expandAddressAndStateAbbreviations('1658 GAR Highway, Swansea, Massachusetts', 'United States Of America')),
    '1658 Grand Army Of The Republic Highway, Swansea, Massachusetts'
  );
  assert.strictEqual(
    ctx.toTitleCase(ctx.expandAddressAndStateAbbreviations('1658 G.A.R. Hwy, Swansea, MA', 'United States Of America')),
    '1658 Grand Army Of The Republic Highway, Swansea, Massachusetts'
  );
  assert.strictEqual(
    ctx.toTitleCase(ctx.expandAddressAndStateAbbreviations('500 MLK Jr Blvd, Austin, TX', 'United States Of America')),
    '500 Martin Luther King Junior Boulevard, Austin, Texas'
  );
  assert.strictEqual(
    ctx.toTitleCase(ctx.expandAddressAndStateAbbreviations('200 FM 1960 Rd, Houston, TX', 'United States Of America')),
    '200 Farm To Market Road 1960, Houston, Texas'
  );
  assert.strictEqual(
    ctx.toTitleCase(ctx.expandAddressAndStateAbbreviations('100 Co. Rd. 42, Columbus, OH', 'United States Of America')),
    '100 County Road 42, Columbus, Ohio'
  );
  assert.strictEqual(
    ctx.toTitleCase(ctx.expandAddressAndStateAbbreviations('12 MG Road, Bangalore, KA', '')),
    '12 Mahatma Gandhi Road, Bangalore, Karnataka'
  );
  assert.strictEqual(
    ctx.toTitleCase(ctx.expandAddressAndStateAbbreviations('Unit 5, JAFZA, DXB', 'United Arab Emirates')),
    'Unit 5, Jebel Ali Free Zone, Dubai'
  );
  assert.strictEqual(
    ctx.toTitleCase(ctx.expandAddressAndStateAbbreviations('Plot 10, N.T., Kln', 'Hong Kong')),
    'Plot 10, New Territories, Kowloon'
  );
  assert.strictEqual(
    ctx.toTitleCase(ctx.expandAddressAndStateAbbreviations('Unit 4, Trdg. Est., Co. Durham', 'United Kingdom')),
    'Unit 4, Trading Estate, County Durham'
  );

  // Full AI QC pipeline scenario for 1658 GAR Highway, Swansea, Massachusetts
  const garAi = ctx.applyStrictInstructions({
    _isFromAi: true,
    websiteStatus: 'Working',
    businessType: 'Manufacturer',
    companyProfile: 'Available',
    companyName: 'Swansea Industrial Co Ltd',
    countryName: 'USA',
    companyAddress: '1658 GAR Highway, Swansea, Massachusetts',
    state: 'Available',
    city: 'Available',
    emailId: 'sales@swanseaindustrial.com',
    phoneNumber: '5085550199',
    productImages: '3'
  }, { originalUrl: 'https://swanseaindustrial.com', addressCandidates: [{ raw: '1658 GAR Highway, Swansea, MA 02777', source: 'contact' }] }, {});
  assert.strictEqual(garAi.countryName, 'United States Of America');
  assert.strictEqual(garAi.companyAddress, '1658 Grand Army Of The Republic Highway, Swansea, Massachusetts');
  assert.strictEqual(garAi.state, 'Available');
  assert.strictEqual(garAi.city, 'Available');

  // Verify analyzeWithGemini prompt instructs global & highway expansions too
  const aiClientSrc = fs.readFileSync(path.join(rootDir, 'src/background/ai-client.js'), 'utf8');
  assert.ok(aiClientSrc.includes('Grand Army Of The Republic Highway'), 'Prompt must instruct GAR Highway expansion');
  assert.ok(aiClientSrc.includes('Martin Luther King Junior Boulevard'), 'Prompt must instruct MLK Jr Blvd expansion');
  assert.ok(aiClientSrc.includes('Farm To Market Road'), 'Prompt must instruct FM route expansion');
  assert.ok(aiClientSrc.includes('Zone Industrielle'), 'Prompt must instruct French Z.I. expansion');
  assert.ok(aiClientSrc.includes('Niederösterreich'), 'Prompt must instruct Austrian/global state expansion');
});

// 33. Multi-provider AI config resolution, popup UI, and Grok / DeepSeek / Gemini execution
async function runAsyncTests() {
  async function runAsyncTest(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error('STACK TRACE:', err.stack);
      failed++;
    }
  }

  await runAsyncTest('Gemini & Groq (console.groq.com) config, direct-first 1-call path, and /models fallback on failure work end-to-end', async () => {
    const groqCfg = ctx.resolveAiProviderConfig({
      aiProvider: 'groq',
      groqApiKey: 'gsk_test_groq_key',
      groqModel: 'llama-3.1-8b-instant'
    });
    assert.strictEqual(groqCfg.provider, 'groq');
    assert.strictEqual(groqCfg.apiKey, 'gsk_test_groq_key');
    assert.strictEqual(groqCfg.model, 'llama-3.1-8b-instant');

    // Verify legacy grok/grokApiKey with gsk_ migrates cleanly to Groq default (llama-3.1-8b-instant)
    const migratedCfg = ctx.resolveAiProviderConfig({
      aiProvider: 'grok',
      grokApiKey: 'gsk_legacy_key',
      grokModel: 'grok-3-mini'
    });
    assert.strictEqual(migratedCfg.provider, 'groq');
    assert.strictEqual(migratedCfg.apiKey, 'gsk_legacy_key');
    assert.strictEqual(migratedCfg.model, 'llama-3.1-8b-instant');

    let calls = [];
    let forceFallbackMode = false;
    ctx.fetch = async (url, opts) => {
      const sampleJson = JSON.stringify({
        websiteStatus: 'Working',
        businessType: 'Manufacturer',
        companyProfile: 'Available',
        companyName: 'Swansea Industrial Co., Ltd.',
        countryName: 'USA',
        companyAddress: '1658 GAR Highway, Swansea, Massachusetts',
        state: 'Available',
        city: 'Available',
        emailId: '',
        secondaryEmailId: '',
        phoneNumber: '+1 508-555-0199',
        numberOfProducts: '3',
        productImages: '3',
        numberOfProductDescriptions: '3'
      });

      if (url === 'https://api.groq.com/openai/v1/models') {
        calls.push({ url, method: opts.method });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'whisper-large-v3', active: true, output_modalities: ['transcription'] },
              { id: 'meta-llama/llama-prompt-guard-2-86m', active: true, output_modalities: ['text'] },
              { id: 'canopylabs/orpheus-v1-english', active: true, output_modalities: ['speech'] },
              { id: 'allam-2-7b', active: true, output_modalities: ['text'] }
            ]
          })
        };
      }

      const parsedBody = JSON.parse(opts.body);
      calls.push({ url, model: parsedBody.model });

      if (url === 'https://api.groq.com/openai/v1/chat/completions') {
        const expectedModel = forceFallbackMode ? 'allam-2-7b' : 'llama-3.1-8b-instant';
        if (parsedBody.model !== expectedModel) {
          return {
            ok: false,
            status: 404,
            text: async () => JSON.stringify({ error: { message: 'Model not found', type: 'invalid_request_error', code: 'model_not_found' } })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: '```json\n' + sampleJson + '\n```' } }] })
        };
      }

      if (url.includes('generativelanguage.googleapis.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ candidates: [{ content: { parts: [{ text: sampleJson }] } }] })
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    };

    const mockCrawl = {
      originalUrl: 'https://swanseaindustrial.com',
      title: 'Swansea Industrial',
      emails: ['sales@swanseaindustrial.com', 'info@swanseaindustrial.com'],
      phones: ['5085550199'],
      addressCandidates: [{ raw: '1658 GAR Highway, Swansea, MA 02777', source: 'contact' }],
      detectedProductCount: 3,
      detectedImageCount: 3,
      detectedDescCount: 3
    };

    // 1. Happy path: direct 1-call chat/completions without calling /openai/v1/models
    calls = [];
    forceFallbackMode = false;
    const groqOut = await ctx.analyzeWithAi(mockCrawl, groqCfg, {}, 0);
    assert.strictEqual(groqOut._aiProvider, 'Groq');
    assert.strictEqual(groqOut._aiModel, 'llama-3.1-8b-instant');
    assert.strictEqual(groqOut.emailId, 'sales@swanseaindustrial.com');
    assert.strictEqual(groqOut.secondaryEmailId, 'info@swanseaindustrial.com');
    assert.strictEqual(calls.length, 1, 'Happy path must make only 1 API call (no /models call)');
    assert.strictEqual(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.strictEqual(calls[0].model, 'llama-3.1-8b-instant');

    // 2. Key test happy path: 1 API call total without /models
    calls = [];
    const testDirect = await ctx.testAiProviderKey({ provider: 'groq', apiKey: 'gsk_test_groq_key', modelName: 'llama-3.1-8b-instant' });
    assert.strictEqual(testDirect.success, true);
    assert.strictEqual(testDirect.activeModel, 'llama-3.1-8b-instant');
    assert.strictEqual(calls.length, 1, 'Key test happy path must make only 1 API call');

    // 3. Failure fallback path: when initial candidate models fail, /openai/v1/models is called to discover active models
    calls = [];
    forceFallbackMode = true;
    const fallbackOut = await ctx.analyzeWithAi(mockCrawl, groqCfg, {}, 0);
    assert.strictEqual(fallbackOut._aiModel, 'allam-2-7b');
    assert.ok(calls.some(c => c.url === 'https://api.groq.com/openai/v1/models'), 'Must call /models only after candidate models fail');

    calls = [];
    const testFallback = await ctx.testAiProviderKey({ provider: 'groq', apiKey: 'gsk_stale_key_test', modelName: 'llama-3.3-70b-versatile' });
    assert.strictEqual(testFallback.success, true);
    assert.strictEqual(testFallback.provider, 'groq');
    assert.strictEqual(testFallback.activeModel, 'allam-2-7b');
    assert.deepStrictEqual([...testFallback.availableModels], ['allam-2-7b']);

    const testMissing = await ctx.testAiProviderKey({ provider: 'groq', apiKey: '' });
    assert.strictEqual(testMissing.success, false);

    // Verify Gemini 3.8 Flash & 3.6 Flash extraction + prompt deduplication/accuracy
    calls = [];
    const gemini38Out = await ctx.analyzeWithAi(mockCrawl, { provider: 'gemini', apiKey: 'AIza_test', model: 'gemini-3.8-flash' }, {}, 0);
    assert.strictEqual(gemini38Out._aiProvider, 'Gemini');
    assert.strictEqual(gemini38Out._aiModel, 'gemini-3.8-flash');
    const promptPreview = ctx.buildExtractionPrompt({
      originalUrl: 'https://example.com',
      title: 'Example',
      contactPageText: 'UNIQUE_CONTACT_TEXT_12345',
      profilePageText: '',
      bodyText: 'Body text',
      emails: [],
      phones: []
    }, false);
    assert.strictEqual(promptPreview.split('UNIQUE_CONTACT_TEXT_12345').length - 1, 1, 'Contact text must not be duplicated in prompt');
    assert.ok(promptPreview.includes('"Distributer"') && !promptPreview.includes('"Retailer"'), 'Prompt businessType enum must match portal schema');

    // Verify popup HTML & JS expose Gemini (including 3.8 Flash & 3.6 Flash) & updated active Groq models only
    const popupHtml = fs.readFileSync(path.join(rootDir, 'popup.html'), 'utf8');
    const popupJs = fs.readFileSync(path.join(rootDir, 'popup.js'), 'utf8');
    const configJs = fs.readFileSync(path.join(rootDir, 'src/background/config.js'), 'utf8');
    assert.ok(popupHtml.includes('id="provider-select"'));
    assert.ok(popupHtml.includes('id="groq-api-key-input"'));
    assert.ok(!popupHtml.includes('id="grok-api-key-input"'));
    assert.ok(!/deepseek|api\.x\.ai|llama-4-scout|qwen3-32b/i.test(popupHtml + popupJs + configJs), 'Only Gemini and active Groq models should remain');
    assert.ok(!/GROQ_MODELS\s*=\s*\[[^\]]*gpt-oss/i.test(configJs), 'Groq models must not include gpt-oss');
    assert.ok(popupHtml.includes('gemini-3.8-flash') && popupHtml.includes('gemini-3.6-flash'));
    assert.ok(popupJs.includes('gemini-3.8-flash') && configJs.includes('gemini-3.8-flash'));
    assert.ok(popupJs.includes('llama-3.1-8b-instant') && configJs.includes('llama-3.1-8b-instant'));
    assert.ok(popupJs.includes('PROVIDER_MODELS_UI') && popupJs.includes('groqApiKey'));
  });

  // 34. Rule 6 Company Address Sanitization for AI and Own Crawl modes
  runTest('Rule 6 Company Address sanitizes company name, postal code, country, phone, and HTML remnants', () => {
    // Case 1: Raw footer candidate with leading HTML artifact, company name, postal code, and country
    const rawCandidate = '">, Teflex Plastics Pty Ltd, Unit 4, 12 Industrie Road, Penrose, Auckland 1061, New Zealand';
    const cleaned = ctx.sanitizeRule6CompanyAddress(rawCandidate, 'Teflex Plastics Pty Ltd', 'New Zealand');
    assert.strictEqual(cleaned, 'Unit 4, 12 Industrie Road, Penrose, Auckland', 'Must strip leading artifacts, company name, postal code, and country');

    // Case 2: AI returned address with company name, country, and state abbreviation
    const aiInput = 'Acme Industrial Co., 123 Main Street, Suite 400, Austin, TX, United States Of America';
    const cleanedAi = ctx.sanitizeRule6CompanyAddress(aiInput, 'Acme Industrial Co.', 'United States Of America');
    assert.strictEqual(cleanedAi, '123 Main Street, Suite 400, Austin, Texas', 'Must strip company name and country, expand TX to Texas');

    // Case 3: Address with office label, phone, fax, and UK postcode
    const officeAddr = 'Head Office: 45 Queens Road, Leeds, West Yorkshire LS1 2TW Tel: +44 113 245 6789 Fax: +44 113 245 6790';
    const cleanedOffice = ctx.sanitizeRule6CompanyAddress(officeAddr, 'Apex Business Solutions', 'United Kingdom');
    assert.strictEqual(cleanedOffice, '45 Queens Road, Leeds, West Yorkshire', 'Must strip Head Office prefix, phone/fax, and UK postcode');

    // Case 4: End-to-end applyStrictInstructions on AI path
    const mockAiData = {
      _isFromAi: true,
      websiteStatus: 'Working',
      companyName: 'Acme Industrial Co.',
      countryName: 'United States Of America',
      companyAddress: 'Acme Industrial Co., 123 Main Street, Suite 400, Austin, TX, United States Of America'
    };
    const mockCrawlData = {
      addressCandidates: [],
      emails: ['info@test.com'],
      phones: ['12345678'],
      mainHtml: '<html><body>Test</body></html>'
    };
    const resAi = ctx.applyStrictInstructions(mockAiData, mockCrawlData, {});
    assert.strictEqual(resAi.companyAddress, '123 Main Street, Suite 400, Austin, Texas', 'applyStrictInstructions AI path must strictly sanitize address');

    // Case 5: End-to-end applyStrictInstructions on Own Crawl path
    const mockOwnData = {
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyName: 'Teflex Plastics Pty Ltd',
      countryName: 'New Zealand',
      companyAddress: '">, Teflex Plastics Pty Ltd, Unit 4, 12 Industrie Road, Penrose, Auckland 1061, New Zealand'
    };
    const resOwn = ctx.applyStrictInstructions(mockOwnData, mockCrawlData, {});
    assert.strictEqual(resOwn.companyAddress, 'Unit 4, 12 Industrie Road, Penrose, Auckland', 'applyStrictInstructions Own Crawl path must strictly sanitize address');
  });

  // 35. AI Priority, Fallback, and Extraction Modes (AI First, AI Only, Own Crawl)
  runTest('AI Priority, Fallback, and Extraction Modes (AI First, AI Only, Own Crawl)', () => {
    // 1. Config definitions & normalization
    const configPath = path.join(rootDir, 'src/background/config.js');
    const configModule = require(configPath);
    assert.ok(configModule.EXTRACTION_MODES, 'EXTRACTION_MODES must be defined in config.js');
    assert.strictEqual(configModule.EXTRACTION_MODES.AI_FIRST, 'ai_first');
    assert.strictEqual(configModule.EXTRACTION_MODES.AI_ONLY, 'ai_only');
    assert.strictEqual(configModule.EXTRACTION_MODES.OWN_CRAWL, 'own_crawl');
    assert.strictEqual(configModule.DEFAULT_EXTRACTION_MODE, 'ai_first', 'AI First must be default extraction mode');

    assert.strictEqual(configModule.normalizeExtractionMode('ai_first'), 'ai_first');
    assert.strictEqual(configModule.normalizeExtractionMode('ai_only'), 'ai_only');
    assert.strictEqual(configModule.normalizeExtractionMode('AI-ONLY'), 'ai_only');
    assert.strictEqual(configModule.normalizeExtractionMode('own_crawl'), 'own_crawl');
    assert.strictEqual(configModule.normalizeExtractionMode('heuristic'), 'own_crawl');
    assert.strictEqual(configModule.normalizeExtractionMode('unknown_mode'), 'ai_first', 'Unrecognized mode must default to ai_first');

    // 2. Popup UI inspection
    const popupHtml = fs.readFileSync(path.join(rootDir, 'popup.html'), 'utf8');
    const popupJs = fs.readFileSync(path.join(rootDir, 'popup.js'), 'utf8');
    assert.ok(popupHtml.includes('id="extraction-mode-select"'), 'popup.html must have extraction mode selector');
    assert.ok(popupHtml.includes('value="ai_first"') && popupHtml.includes('value="ai_only"') && popupHtml.includes('value="own_crawl"'), 'popup.html must expose all 3 modes');
    assert.ok(popupJs.includes('extractionModeSelect') && popupJs.includes('extractionMode'), 'popup.js must load and save extractionMode');

    // 3. Overlay widget & content scripts inspection
    const overlayJs = fs.readFileSync(path.join(rootDir, 'src/content/overlay-ui.js'), 'utf8');
    const stateJs = fs.readFileSync(path.join(rootDir, 'src/content/state.js'), 'utf8');
    const contentJs = fs.readFileSync(path.join(rootDir, 'content.js'), 'utf8');

    assert.ok(overlayJs.includes('id="ai-widget-extraction-mode"'), 'overlay widget must have in-page extraction mode select');
    assert.ok(overlayJs.includes('_extractionSource === "ai"') && overlayJs.includes('_extractionSource === "own_crawl_fallback"'), 'overlay preview must show data source badge');
    assert.ok(stateJs.includes('extractionMode: "ai_first"'), 'state.js must track extractionMode with ai_first default');
    assert.ok(contentJs.includes('extractionMode: state.extractionMode'), 'content.js must forward extractionMode to service worker');
    assert.ok(contentJs.includes('_aiFailed') && contentJs.includes('ai_only'), 'content.js must block form prefill when AI fails in ai_only mode');

    // 4. Strict-qc extraction mode source code validation
    const strictQcJs = fs.readFileSync(path.join(rootDir, 'src/background/strict-qc.js'), 'utf8');
    assert.ok(strictQcJs.includes('extractionMode === "own_crawl"'), 'strict-qc.js must support explicit own_crawl mode');
    assert.ok(strictQcJs.includes('extractionMode === "ai_only"'), 'strict-qc.js must support strict ai_only mode');
    assert.ok(strictQcJs.includes('_extractionSource = "own_crawl_fallback"'), 'strict-qc.js must flag own crawl fallback when AI fails');
    assert.ok(strictQcJs.includes('_extractionSource = "ai"'), 'strict-qc.js must flag AI extraction source');
  });

  // 36. Rule 4 Company Name and Rule 6 Address Mandatory Expansions (Peri SE -> PERI Societas Europaea & Box -> Post Office Box)
  runTest('Rule 4 Company Name and Rule 6 Address Mandatory Expansions (Peri SE -> PERI Societas Europaea & Box -> Post Office Box)', () => {
    // 1. Post Office Box address expansion from Box / P.O. Box
    const poBoxInput = 'Post Office Box 1264, Weissenhorn';
    assert.strictEqual(ctx.sanitizeRule6CompanyAddress(poBoxInput, 'Peri Se', 'Germany'), 'Post Office Box 1264, Weissenhorn', 'Must preserve Post Office Box');

    const rawBoxInput = 'Box 1264, Weissenhorn';
    assert.strictEqual(ctx.sanitizeRule6CompanyAddress(rawBoxInput, 'Peri Se', 'Germany'), 'Post Office Box 1264, Weissenhorn', 'Must expand Box to Post Office Box');

    // 2. Company Name expansion: SE -> Societas Europaea
    const compExpanded = ctx.expandCompanyAbbreviations('Peri Se', 'Germany');
    assert.strictEqual(compExpanded, 'Peri Societas Europaea', 'Must expand SE / Se to Societas Europaea');

    // 3. End-to-end applyStrictInstructions on AI path
    const mockAiData = {
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyProfile: 'Available',
      companyName: 'Peri Se',
      countryName: 'Germany',
      companyAddress: 'Post Office Box 1264, Weissenhorn',
      state: 'Not Available',
      city: 'Available',
      emailId: 'info@peri.com',
      secondaryEmailId: 'data.protection@peri.com',
      phoneNumber: '73099500',
      numberOfProducts: '3',
      productImages: '3',
      numberOfProductDescriptions: '3',
      _isFromAi: true
    };
    const mockCrawlData = {
      addressCandidates: [{ raw: 'Box 1264, Weissenhorn', source: 'contact' }],
      legalCompanyCandidates: ['PERI Societas Europaea'],
      emails: ['info@peri.com'],
      phones: ['73099500'],
      mainHtml: '<html><body>PERI Societas Europaea</body></html>'
    };

    const result = ctx.applyStrictInstructions(mockAiData, mockCrawlData, {});
    assert.strictEqual(result.companyName, 'PERI Societas Europaea', 'Must expand SE to Societas Europaea and preserve uppercase brand PERI');
    assert.strictEqual(result.companyAddress, 'Post Office Box 1264, Weissenhorn', 'Must preserve full Post Office Box address');
  });

  // 37. Own Crawl Heuristic Extraction & Fallback Robustness
  runTest('Own Crawl Heuristic Extraction & Fallback Robustness (Accurate Fields, No Excess/Missing Data)', () => {
    // 1. Promotional text rejection in extractLikelyAddress
    const marketingText = "Welcome to our state-of-the-art industrial park facility!\nWe provide innovative building solutions.\nBox 1264, 89264 Weissenhorn";
    const extractedAddr = ctx.extractLikelyAddress(marketingText);
    assert.ok(!extractedAddr.includes("Welcome"), "Must reject marketing slogans");
    assert.ok(!extractedAddr.includes("innovative"), "Must reject promotional copy");
    assert.ok(extractedAddr.includes("Box 1264"), "Must extract valid address line");

    // 2. Country resolution from phone calling code & domain ccTLD
    const mockGermanCrawl = {
      originalUrl: 'http://www.peri.de',
      finalUrl: 'https://www.peri.de',
      phones: ['+49 7309 9500'],
      addressCandidates: [{ raw: 'Box 1264, 89264 Weissenhorn', source: 'contact' }]
    };
    const resolvedCountry = ctx.resolveCountryFromAllEvidence('', 'Box 1264, 89264 Weissenhorn', mockGermanCrawl);
    assert.strictEqual(resolvedCountry, 'Germany', 'Must resolve Germany from phone calling code +49 and ccTLD .de');

    // 3. International PO Box expansions (Postfach -> Post Office Box)
    const postfachAddr = ctx.sanitizeRule6CompanyAddress('Postfach 1264, 89264 Weissenhorn', 'PERI SE', 'Germany');
    assert.strictEqual(postfachAddr, 'Post Office Box 1264, Weissenhorn', 'Must expand Postfach to Post Office Box and strip German postal code');

    // 4. End-to-end Own Crawl heuristicExtraction + applyStrictInstructions
    const fullMockCrawl = {
      originalUrl: 'http://www.peri.com',
      finalUrl: 'https://www.peri.com',
      title: 'PERI SE Formwork Scaffolding Engineering',
      logoText: 'PERI',
      copyrightText: 'Copyright © 2026 PERI SE - All Rights Reserved | Privacy Policy',
      legalCompanyCandidates: ['PERI SE', 'PERI Societas Europaea'],
      addressCandidates: [{ raw: 'Box 1264, 89264 Weissenhorn', source: 'contact', priority: 1 }],
      emails: ['info@peri.com', 'data.protection@peri.com'],
      phones: ['+49 7309 9500'],
      combinedText: 'PERI is a leading manufacturer of formwork and scaffolding systems for construction projects globally.',
      mainHtml: '<html><body>PERI SE Manufacturer Formwork Scaffolding Engineering</body></html>',
      detectedProductCount: 3,
      hasCompanyProfile: true
    };

    const ownData = ctx.heuristicExtraction(fullMockCrawl, { isRestricted: false });
    assert.strictEqual(ownData.websiteStatus, 'Working');
    assert.strictEqual(ownData.businessType, 'Manufacturer');
    assert.strictEqual(ownData.companyProfile, 'Available');
    assert.strictEqual(ownData.companyName, 'PERI Societas Europaea', 'Own crawl must expand SE to Societas Europaea and restore uppercase brand');
    assert.strictEqual(ownData.countryName, 'Germany', 'Own crawl must resolve Germany from phone calling code +49 and city Weissenhorn');
    assert.strictEqual(ownData.companyAddress, 'Post Office Box 1264, Weissenhorn', 'Own crawl must expand Box 1264 to Post Office Box 1264');
    assert.strictEqual(ownData.emailId, 'info@peri.com');
    assert.strictEqual(ownData.secondaryEmailId, 'data.protection@peri.com');
    assert.strictEqual(ownData.phoneNumber, '73099500', 'Must strip +49 calling code from phone');
    assert.strictEqual(ownData.numberOfProducts, '3');
    assert.strictEqual(ownData.productImages, '3');
    assert.strictEqual(ownData.numberOfProductDescriptions, '3');

    // Pass through applyStrictInstructions for non-AI path
    const finalStrictData = ctx.applyStrictInstructions(ownData, fullMockCrawl, { isRestricted: false });
    assert.strictEqual(finalStrictData.companyName, 'PERI Societas Europaea');
    assert.strictEqual(finalStrictData.companyAddress, 'Post Office Box 1264, Weissenhorn');
    assert.strictEqual(finalStrictData.countryName, 'Germany');
    assert.strictEqual(finalStrictData.phoneNumber, '73099500');
    assert.strictEqual(finalStrictData.city, 'Available');
  });

  // 38. Address Quality Control & Sanitization (Elimination of Unwanted Content & Pending Items)
  runTest('Address Quality Control & Sanitization (Elimination of Unwanted Content & Pending Items)', () => {
    // 1. Elimination of Unwanted Content: Contact headings, labels, emails, URLs, phones, hours, and tax IDs
    const dirtyAddr1 = "Contact Us: 100 Main Street, Suite 400, Austin, TX 78701, USA Email: info@example.com Phone: +1 512 555 1234";
    const clean1 = ctx.sanitizeRule6CompanyAddress(dirtyAddr1, "Acme Corp", "United States Of America");
    assert.strictEqual(clean1, "100 Main Street, Suite 400, Austin, Texas", "Must strip Contact Us prefix, trailing email, phone, and postal code");

    const dirtyAddr2 = "Physical Address: Unit 4, 12 Industrie Road, Penrose, Auckland 1061, New Zealand Web: www.teflexplastics.co.za Hours: Mon-Fri 8am-5pm";
    const clean2 = ctx.sanitizeRule6CompanyAddress(dirtyAddr2, "Teflex Plastics", "New Zealand");
    assert.strictEqual(clean2, "Unit 4, 12 Industrie Road, Penrose, Auckland", "Must strip Physical Address label, website URL, hours, postal code, and country");

    const dirtyAddr3 = "Where To Find Us: Plot No. 45, GIDC Industrial Estate, Makarpura, Vadodara, Gujarat 390010 CIN: U12345GJ2000PTC123456 GSTIN: 24AAAAA0000A1Z5";
    const clean3 = ctx.sanitizeRule6CompanyAddress(dirtyAddr3, "Baroda Polymers Ltd", "India");
    assert.strictEqual(clean3, "Plot Number 45, Gujarat Industrial Development Corporation Industrial Estate, Makarpura, Vadodara, Gujarat", "Must strip Where To Find Us, CIN, GSTIN, and Indian postal code while expanding abbreviations");

    const dirtyAddr4 = "Our Location: 45 Queens Road, Leeds, West Yorkshire LS1 2TW, United Kingdom Get Directions View On Google Maps";
    const clean4 = ctx.sanitizeRule6CompanyAddress(dirtyAddr4, "Apex Solutions", "United Kingdom");
    assert.strictEqual(clean4, "45 Queens Road, Leeds, West Yorkshire", "Must strip Our Location, UK postcode, and map links");

    // 2. Elimination of Pending Items: Multi-line address extraction from broken HTML text
    const multiLineBrokenText = "About Our Facility\nUnit 4, 12 Industrie Road\nPenrose, Auckland 1061\nNew Zealand\nPhone: +64 9 555 1234";
    const extractedMulti = ctx.extractLikelyAddress(multiLineBrokenText);
    assert.ok(extractedMulti.length > 10, "Must extract multi-line address instead of leaving address pending");
    assert.ok(extractedMulti.includes("Industrie Road"), "Must capture street from multi-line text");
    const sanitizedMulti = ctx.sanitizeRule6CompanyAddress(extractedMulti, "Teflex Plastics", "New Zealand");
    assert.strictEqual(sanitizedMulti, "Unit 4, 12 Industrie Road, Penrose, Auckland", "Must sanitize extracted multi-line address cleanly");

    // 3. Industrial Park / Estate recognition in isFullAddressCandidate
    assert.ok(ctx.isFullAddressCandidate("Plot 45, GIDC Industrial Estate, Makarpura, Vadodara, Gujarat"), "Must recognize industrial estate as valid address structure");
    assert.ok(ctx.isFullAddressCandidate("Unit 3, Riverside Business Park, Olympic Way, Wembley, London HA9 0GU"), "Must recognize business park as valid address structure");
  });

  // 39. Rule 6 Address Reconciliation & Missing Item Restoration (Taiwan City, Premise, Village, County)
  runTest('Rule 6 Address Reconciliation restores missing trailing cities, premises, and intermediate divisions', () => {
    // 1. Taiwan trailing city restoration (Charng Guey case: Yongkang District -> Tainan City)
    const rawTaiwan = "No.159, Yongke E. Rd., Yongkang Dist., Tainan City 710, Taiwan";
    const truncatedAi = "Number 159, Yongke East Road, Yongkang District";
    const reconciled1 = ctx.reconcileAddressWithRawEvidence(truncatedAi, rawTaiwan, "Charng Guey Machinery Company, Limited", "Taiwan");
    assert.strictEqual(reconciled1, "Number 159, Yongke East Road, Yongkang District, Tainan City", "Must restore missing trailing Tainan City");

    // 2. Leading premise / unit restoration
    const rawNz = "Unit 4, 12 Industrie Road, Penrose, Auckland 1061, New Zealand";
    const truncatedNz = "12 Industrie Road, Penrose, Auckland";
    const reconciled2 = ctx.reconcileAddressWithRawEvidence(truncatedNz, rawNz, "Teflex Plastics Pty Ltd", "New Zealand");
    assert.strictEqual(reconciled2, "Unit 4, 12 Industrie Road, Penrose, Auckland", "Must restore missing leading Unit 4");

    // 3. Strict QC end-to-end integration with applyStrictInstructions
    const strictResult = ctx.applyStrictInstructions({
      websiteStatus: "Working",
      businessType: "Manufacturer",
      companyName: "Charng Guey Machinery Company, Limited",
      countryName: "Taiwan",
      companyAddress: "Number 159, Yongke East Road, Yongkang District",
      state: "Not Available",
      city: "Available"
    }, {
      originalUrl: "http://www.cg-machinery.com.tw",
      finalUrl: "http://www.cg-machinery.com.tw",
      mainHtml: "<html><body>Industrial Machinery Manufacturer</body></html>",
      country: "Taiwan",
      addressCandidates: [
        { raw: "No.159, Yongke E. Rd., Yongkang Dist., Tainan City 710, Taiwan", pageUrl: "https://www.cg-machinery.com.tw/contact.html", source: "contact" }
      ]
    });
    assert.strictEqual(strictResult.companyAddress, "Number 159, Yongke East Road, Yongkang District, Tainan City", "Strict QC must produce full address with Tainan City");
    assert.strictEqual(strictResult.city, "Available", "City must remain Available");
    assert.strictEqual(strictResult.state, "Not Available", "State must remain Not Available for Tainan City");
  });

  // 40. Non-Working Website Records – Normalization, Mandatory Columns, Duplicate Prevention & Multi-Session Excel Append
  await runAsyncTest('Non-Working Website Records – Normalization, Mandatory Columns, Duplicate Prevention & Multi-Session Excel Append (50 -> 80 -> 125 -> 150)', async () => {
    // 1. Error Category Normalization: Capture ONLY Not Working, Redirect, Not English
    assert.strictEqual(ctx.normalizeErrorCategory("Not Working"), "Not Working");
    assert.strictEqual(ctx.normalizeErrorCategory("Domain Expired"), "Not Working");
    assert.strictEqual(ctx.normalizeErrorCategory("Flash"), "Not Working");
    assert.strictEqual(ctx.normalizeErrorCategory("Redirect Site"), "Redirect");
    assert.strictEqual(ctx.normalizeErrorCategory("Redirect"), "Redirect");
    assert.strictEqual(ctx.normalizeErrorCategory("Non English"), "Not English");
    assert.strictEqual(ctx.normalizeErrorCategory("Not English"), "Not English");

    // Successfully working and eligible websites must NOT be included in this separate error dataset
    assert.strictEqual(ctx.normalizeErrorCategory("Working"), null, "Working websites must be strictly excluded");

    // 2. Mandatory Columns in exact order with Error Keyword, Error Source Link, Error Context (User Name removed)
    const traceyRecord = ctx.createErrorRecord({
      url: "https://traceygear.com/military-defense-suppliers/",
      websiteStatus: "Not Working",
      reason: "Prohibited Category / Word Detected (Weapons / Military / Defense)",
      errorKeyword: "Military",
      errorSourceLink: "https://traceygear.com/military-defense-suppliers/",
      errorContext: "...nery Builders Marine Equipment Manufacturers Military & Defense Suppliers Pump & Valve M...",
      date: "2026-11-11",
      time: "14:30:00"
    });

    assert.ok(traceyRecord, "Tracey Gear record must be created");
    assert.deepStrictEqual(Object.keys(traceyRecord), [
      "URL",
      "Website Status",
      "Reason",
      "Error Keyword",
      "Error Source Link",
      "Error Context",
      "Date",
      "Time"
    ], "Record must strictly have the 8 mandatory columns in order (without User Name)");
    assert.strictEqual(traceyRecord.URL, "https://traceygear.com/military-defense-suppliers/");
    assert.strictEqual(traceyRecord["Website Status"], "Not Working");
    assert.strictEqual(traceyRecord.Reason, "Prohibited Category / Word Detected (Weapons / Military / Defense)");
    assert.strictEqual(traceyRecord["Error Keyword"], "Military");
    assert.strictEqual(traceyRecord["Error Source Link"], "https://traceygear.com/military-defense-suppliers/");
    assert.strictEqual(traceyRecord["Error Context"], "...nery Builders Marine Equipment Manufacturers Military & Defense Suppliers Pump & Valve M...");
    assert.strictEqual(traceyRecord.Date, "2026-11-11");
    assert.strictEqual(traceyRecord.Time, "14:30:00");
    assert.strictEqual(traceyRecord["User Name"], undefined, "User Name must be completely removed");

    // 3. Multi-Session Persistent Append Simulation (Session 1: 50 -> Session 2: 80 -> Session 3: 125 -> Session 4: 150)
    let persistentDataset = [];

    // Session 1: 0 existing + 50 new = 50 records
    const session1New = [];
    for (let i = 1; i <= 50; i++) {
      session1New.push({
        url: `https://site-${i}.com`,
        websiteStatus: i % 3 === 0 ? "Redirect Site" : (i % 5 === 0 ? "Non English" : "Not Working"),
        reason: `Error reason ${i}`,
        errorKeyword: i % 3 === 0 ? "Redirect Domain" : (i % 5 === 0 ? "Non English" : "Server Error"),
        errorSourceLink: `https://site-${i}.com/failed`,
        errorContext: `Context snippet for site ${i}`,
        date: "2026-11-11",
        time: "10:00:00"
      });
    }
    const res1 = ctx.mergeErrorRecords(persistentDataset, session1New);
    persistentDataset = res1.merged;
    assert.strictEqual(res1.addedCount, 50);
    assert.strictEqual(persistentDataset.length, 50, "Session 1 must have 50 total records");

    // Session 2: 50 existing + 30 new (+ 10 duplicates from session 1) = 80 final
    const session2Candidates = [];
    // 10 duplicate attempts from session 1 (same URL, same status, same date)
    for (let i = 1; i <= 10; i++) {
      session2Candidates.push({
        url: `https://site-${i}.com`,
        websiteStatus: i % 3 === 0 ? "Redirect Site" : (i % 5 === 0 ? "Non English" : "Not Working"),
        reason: `Error reason duplicate ${i}`,
        errorKeyword: "Duplicate",
        errorSourceLink: `https://site-${i}.com/failed`,
        errorContext: `Duplicate context ${i}`,
        date: "2026-11-11",
        time: "10:00:00"
      });
    }
    // 30 brand new sites
    for (let i = 51; i <= 80; i++) {
      session2Candidates.push({
        url: `https://site-${i}.com`,
        websiteStatus: "Not Working",
        reason: `Connection error ${i}`,
        errorKeyword: "Connection Timeout",
        errorSourceLink: `https://site-${i}.com`,
        errorContext: `Timeout snippet ${i}`,
        date: "2026-11-11",
        time: "11:00:00"
      });
    }
    const res2 = ctx.mergeErrorRecords(persistentDataset, session2Candidates);
    persistentDataset = res2.merged;
    assert.strictEqual(res2.addedCount, 30, "Must skip 10 duplicates and add only 30 new records");
    assert.strictEqual(persistentDataset.length, 80, "Session 2 must contain exactly 80 records");

    // Session 3: 80 existing + 45 new = 125 final
    const session3New = [];
    for (let i = 81; i <= 125; i++) {
      session3New.push({
        url: `https://site-${i}.com`,
        websiteStatus: i % 2 === 0 ? "Redirect" : "Not Working",
        reason: `DNS failed ${i}`,
        errorKeyword: "DNS Failure",
        errorSourceLink: `https://site-${i}.com`,
        errorContext: `DNS error context ${i}`,
        date: "2026-11-11",
        time: "12:00:00"
      });
    }
    const res3 = ctx.mergeErrorRecords(persistentDataset, session3New);
    persistentDataset = res3.merged;
    assert.strictEqual(res3.addedCount, 45);
    assert.strictEqual(persistentDataset.length, 125, "Session 3 must contain exactly 125 records");

    // Session 4: 125 existing + 25 new = 150 final
    const session4New = [];
    for (let i = 126; i <= 150; i++) {
      session4New.push({
        url: `https://site-${i}.com`,
        websiteStatus: "Not English",
        reason: `Foreign language content ${i}`,
        errorKeyword: "Non English Language",
        errorSourceLink: `https://site-${i}.com`,
        errorContext: `Non English snippet ${i}`,
        date: "2026-11-11",
        time: "13:00:00"
      });
    }
    const res4 = ctx.mergeErrorRecords(persistentDataset, session4New);
    persistentDataset = res4.merged;
    assert.strictEqual(res4.addedCount, 25);
    assert.strictEqual(persistentDataset.length, 150, "Session 4 must contain all 150 cumulative records in the single dataset");

    // Duplicate Prevention on Different Dates:
    // If a site fails again on a different date, retain as a separate historical record
    const reoccurrenceDifferentDate = {
      url: "https://site-1.com",
      websiteStatus: "Not Working",
      reason: "Failed again on day 2",
      errorKeyword: "Day 2 Failure",
      errorSourceLink: "https://site-1.com",
      errorContext: "Day 2 context",
      date: "2026-11-12",
      time: "09:00:00"
    };
    const resReoccur = ctx.mergeErrorRecords(persistentDataset, [reoccurrenceDifferentDate]);
    assert.strictEqual(resReoccur.addedCount, 1, "Same URL on a different date must be retained as a new separate record");
    assert.strictEqual(resReoccur.merged.length, 151);

    // 4. Excel Generation & Parsing with SheetJS (XLSX)
    const wb = ctx.generateNonWorkingExcel(persistentDataset, ctx.XLSX);
    assert.strictEqual(wb.SheetNames[0], "Non-Working Websites", "Permanent Excel sheet name must be Non-Working Websites");

    const xlsxBuffer = ctx.XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    assert.ok(xlsxBuffer.length > 5000, "Must generate valid non-empty Excel binary");

    // Parse back the generated Excel file to verify 100% round-trip fidelity
    const parsedRows = ctx.parseNonWorkingExcel(xlsxBuffer, ctx.XLSX);
    assert.strictEqual(parsedRows.length, 150, "Read-back Excel rows must preserve all 150 records");
    assert.strictEqual(parsedRows[0].URL, "https://site-1.com");
    assert.strictEqual(parsedRows[149].URL, "https://site-150.com");
    assert.strictEqual(parsedRows[149]["Website Status"], "Not English");
    assert.strictEqual(parsedRows[149]["Error Keyword"], "Non English Language");
    assert.strictEqual(parsedRows[149]["Error Source Link"], "https://site-150.com");
    assert.strictEqual(parsedRows[149]["Error Context"], "Non English snippet 150");
  });

  // 40. Non-Working Website Records – Dashboard Metrics, Filtering & Storage Persistence
  await runAsyncTest('Non-Working Website Records – Dashboard Metrics, Filtering & Storage Persistence', async () => {
    mockLocalStorage = {}; // Reset storage

    // Test background recording service with Tracey Gear example items
    const rec1 = await ctx.recordNonWorkingWebsite({
      url: "https://traceygear.com/military-defense-suppliers/",
      websiteStatus: "Not Working",
      reason: "Prohibited Category / Word Detected (Military & Defense Suppliers)",
      errorKeyword: "Military",
      errorSourceLink: "https://traceygear.com/military-defense-suppliers/",
      errorContext: "...nery Builders Marine Equipment Manufacturers Military & Defense Suppliers Pump & Valve M..."
    });
    assert.strictEqual(rec1.success, true);
    assert.strictEqual(rec1.added, true);
    assert.strictEqual(rec1.totalRecords, 1);
    assert.strictEqual(rec1.record["Error Keyword"], "Military");
    assert.strictEqual(rec1.record["Error Source Link"], "https://traceygear.com/military-defense-suppliers/");
    assert.strictEqual(rec1.record["Error Context"], "...nery Builders Marine Equipment Manufacturers Military & Defense Suppliers Pump & Valve M...");

    // Recording working site must be strictly ignored
    const recWorking = await ctx.recordNonWorkingWebsite({
      url: "https://working-manufacturer.com",
      websiteStatus: "Working"
    });
    assert.strictEqual(recWorking.success, false);
    assert.strictEqual(recWorking.ignored, true);

    // Record redirect site
    const rec2 = await ctx.recordNonWorkingWebsite({
      url: "https://redirect-source.com",
      websiteStatus: "Redirect Site",
      reason: "Redirected to destination-domain.com",
      errorKeyword: "Redirect Domain",
      errorSourceLink: "https://destination-domain.com",
      errorContext: "Redirect from redirect-source.com to destination-domain.com"
    });
    assert.strictEqual(rec2.success, true);
    assert.strictEqual(rec2.record["Website Status"], "Redirect");

    // Record Not English site
    const rec3 = await ctx.recordNonWorkingWebsite({
      url: "https://chinese-supplier.cn",
      websiteStatus: "Non English",
      reason: "Chinese content without English translation (Rule 12)",
      errorKeyword: "Non English Language",
      errorSourceLink: "https://chinese-supplier.cn",
      errorContext: "仅限中国国内销售 (Domestic sales only)"
    });
    assert.strictEqual(rec3.success, true);
    assert.strictEqual(rec3.record["Website Status"], "Not English");

    // Retrieve stats
    const statsRes = await ctx.getNonWorkingRecordsAndStats();
    assert.strictEqual(statsRes.success, true);
    assert.strictEqual(statsRes.records.length, 3);
    assert.strictEqual(statsRes.stats.totalNotWorking, 1);
    assert.strictEqual(statsRes.stats.totalRedirect, 1);
    assert.strictEqual(statsRes.stats.totalNotEnglish, 1);
    assert.strictEqual(statsRes.stats.totalHistorical, 3);

    // Filtering test
    const allRecords = statsRes.records;
    const onlyRedirects = ctx.filterErrorRecords(allRecords, { status: "Redirect" });
    assert.strictEqual(onlyRedirects.length, 1);
    assert.strictEqual(onlyRedirects[0].URL, "https://redirect-source.com");

    const onlyNotEnglish = ctx.filterErrorRecords(allRecords, { status: "Not English" });
    assert.strictEqual(onlyNotEnglish.length, 1);
    assert.strictEqual(onlyNotEnglish[0].URL, "https://chinese-supplier.cn");

    const searchKeywordResult = ctx.filterErrorRecords(allRecords, { search: "Military" });
    assert.strictEqual(searchKeywordResult.length, 1);
    assert.strictEqual(searchKeywordResult[0].URL, "https://traceygear.com/military-defense-suppliers/");

    const searchContextResult = ctx.filterErrorRecords(allRecords, { search: "Builders Marine" });
    assert.strictEqual(searchContextResult.length, 1);
    assert.strictEqual(searchContextResult[0].URL, "https://traceygear.com/military-defense-suppliers/");

    // Update last sync time
    await ctx.updateLastExcelSync(1773000000000);
    const updatedStats = await ctx.getNonWorkingRecordsAndStats();
    assert.ok(updatedStats.stats.lastSyncTime !== "Never", "Last sync time must be updated from Never");

    // Clear records test
    await ctx.clearNonWorkingRecords();
    const cleared = await ctx.getNonWorkingRecordsAndStats();
    assert.strictEqual(cleared.records.length, 0);
    assert.strictEqual(cleared.stats.totalHistorical, 0);
  });

  // 42. Non-Working Website Reason Sanitization & AI Failure Recheck / Own Crawl Fallback
  await runAsyncTest('Non-Working Website Reason Sanitization & AI Failure Recheck / Own Crawl Fallback', async () => {
    // 1. Validate that AI branding/notes are strictly blocked from being recorded as error reasons
    assert.strictEqual(ctx.isValidNonWorkingReason("AI Powered by Gemini (gemini-3.5-flash-lite)"), false);
    assert.strictEqual(ctx.isValidNonWorkingReason("AI Powered by Groq (openai/gpt-oss-120b)"), false);
    assert.strictEqual(ctx.isValidNonWorkingReason("Own Crawl (AI Fallback: No Gemini API key configured)"), false);
    assert.strictEqual(ctx.isValidNonWorkingReason("AI Only mode: Gemini failed (quota exceeded) - Own crawl prefill prevented"), false);
    assert.strictEqual(ctx.isValidNonWorkingReason("Analyzed via Own Crawl (User Mode: Own Crawl Only)"), false);

    // 2. Validate authentic business/technical reasons are allowed
    assert.strictEqual(ctx.isValidNonWorkingReason('Medicine, Medical & Hospital ("Clinic")'), true);
    assert.strictEqual(ctx.isValidNonWorkingReason("Website took longer than 28 seconds to respond or server is unresponsive (Rule 1)."), true);
    assert.strictEqual(ctx.isValidNonWorkingReason("Chemicals & Petrochemicals (\"industrial chemicals\")"), true);
    assert.strictEqual(ctx.isValidNonWorkingReason("Website has 0 products and no verifiable catalog or physical address (Rule 1)."), true);
    assert.strictEqual(ctx.isValidNonWorkingReason("Failed to fetch"), true);

    // 3. Ensure extractErrorReason never picks _note or AI model taglines
    const badRecord = {
      URL: "http://www.wiki.apache.org",
      websiteStatus: "Not Working",
      _note: "AI Powered by Gemini (gemini-3.5-flash-lite)"
    };
    const sanitizedReason = ctx.extractErrorReason(badRecord);
    assert.ok(!sanitizedReason.includes("AI Powered by"), "Reason must never contain AI Powered by");
    assert.ok(!sanitizedReason.includes("gemini"), "Reason must never contain gemini model names");
    assert.strictEqual(sanitizedReason, "Website has 0 products and no verifiable catalog or physical address (Rule 1)");

    // 4. Test error record creation with bad _note
    const createdRec = ctx.createErrorRecord(badRecord);
    assert.strictEqual(createdRec.Reason, "Website has 0 products and no verifiable catalog or physical address (Rule 1)");
    assert.notStrictEqual(createdRec.Reason, "AI Powered by Gemini (gemini-3.5-flash-lite)");

    // 5. When authentic reason is provided alongside _note, authentic reason is preserved
    const validProhibitedRecord = {
      URL: "http://www.bsi-hardware.com",
      websiteStatus: "Not Working",
      restrictedReason: 'Defence & Military ("military")',
      _note: "AI Powered by Gemini (gemini-3.5-flash-lite)"
    };
    const recWithReason = ctx.createErrorRecord(validProhibitedRecord);
    assert.strictEqual(recWithReason.Reason, 'Defence & Military ("military")');

    // 6. Test generateNonWorkingExcel sanitizes dirty Reason fields
    const dirtyRecords = [
      { URL: "http://www.ewt.com.my", websiteStatus: "Not Working", Reason: "AI Powered by Gemini (gemini-3.5-flash-lite)" }
    ];
    const wb = ctx.generateNonWorkingExcel(dirtyRecords, ctx.XLSX);
    const generatedRows = ctx.XLSX.utils.sheet_to_json(wb.Sheets[ctx.NON_WORKING_EXCEL_SHEET]);
    assert.strictEqual(generatedRows[0].Reason, "Website has 0 products and no verifiable catalog or physical address (Rule 1)");
    assert.ok(!generatedRows[0].Reason.includes("Gemini"));

    // 7. Verify Chee Wah Corporation Berhad is preserved without all-caps mutation
    const cheeWahHtml = "<html><title>CHEE WAH CORPORATION BERHAD</title><body>WELCOME TO CHEE WAH</body></html>";
    const cheeWahNormalized = ctx.restoreOriginalSymbolsInCompanyName("Chee Wah Corporation Berhad", { mainHtml: cheeWahHtml, title: "CHEE WAH CORPORATION BERHAD" });
    assert.strictEqual(cheeWahNormalized, "Chee Wah Corporation Berhad", "Normal name with vowels must not be uppercased");

    // 8. Verify PERI is properly uppercased
    const periNormalized = ctx.restoreOriginalSymbolsInCompanyName("Peri Societas Europaea", { mainHtml: "<html><body>PERI SE</body></html>" });
    assert.strictEqual(periNormalized, "PERI Societas Europaea", "PERI acronym must be uppercased");

    // 9. Extra word "Number" must NOT be injected if "No." was not on website (Via Del Gregge testcase)
    const rawItalianCand = "Via del Gregge, 220, 21015 Lonate Pozzolo (VA)";
    const mockAiItalian = {
      websiteStatus: "Working",
      companyName: "Negri Bossi",
      countryName: "Italy",
      companyAddress: "Via Del Gregge, Number 220, Lonate Pozzolo, Varese",
      state: "Available",
      city: "Available",
      _isFromAi: true
    };
    const mockItalianCrawl = {
      finalUrl: "https://www.negribossi.com",
      addressCandidates: [{ raw: rawItalianCand, isHeadquarters: true }],
      contactPageText: rawItalianCand
    };
    const italianResult = ctx.applyStrictInstructions(mockAiItalian, mockItalianCrawl, {});
    assert.strictEqual(
      italianResult.companyAddress,
      "Via Del Gregge, 220, Lonate Pozzolo, Varese",
      "Must strip extra word 'Number' when bare street number 220 had no 'No.' on website"
    );

    // 10. When 'No.' IS in raw evidence, 'Number' MUST be kept/expanded
    const rawTaiwanCand = "No. 159, Yongke East Road, Yongkang District, Tainan City 710, Taiwan";
    const mockAiTaiwan = {
      websiteStatus: "Working",
      companyName: "Charng Guey",
      countryName: "Taiwan",
      companyAddress: "Number 159, Yongke East Road, Yongkang District, Tainan City",
      state: "Not Available",
      city: "Available",
      _isFromAi: true
    };
    const mockTaiwanCrawl = {
      finalUrl: "http://www.cg-machinery.com.tw",
      addressCandidates: [{ raw: rawTaiwanCand, isHeadquarters: true }],
      contactPageText: rawTaiwanCand
    };
    const taiwanResult = ctx.applyStrictInstructions(mockAiTaiwan, mockTaiwanCrawl, {});
    assert.strictEqual(
      taiwanResult.companyAddress,
      "Number 159, Yongke East Road, Yongkang District, Tainan City",
      "Must expand and keep 'Number' when 'No.' was present on website"
    );

    // 11. Test 44: Restricted Prohibited Categories: Marine Industry / Subpage Detection (Total Hoists & Cranes case)
    const mockCraneIndustriesText = "Find out how we can help with your project. Marine Industry We offer overhead gantries, jib cranes for marine operations.";
    const marineCheck = ctx.detectRestrictedKeywordsSingle(mockCraneIndustriesText, "<h4>Marine Industry</h4>");
    assert.strictEqual(marineCheck.isRestricted, true, "Must detect 'Marine Industry' as restricted");
    assert.strictEqual(marineCheck.category, "Marine", "Category must be Marine");
    assert.strictEqual(marineCheck.matchedKeyword, "Marine", "Matched keyword must be Marine");

    // Discover contact links prioritizes industries / applications page
    const mockCraneHomeHtml = `
      <html><body>
        <a href="/contact-us">Contact Us</a>
        <a href="/about-us/why-choose-us">Why Choose Us</a>
        <a href="/about-us/faq">FAQ</a>
        <a href="/about-us/industries">Industries</a>
        <a href="/about-us/vacancies">Vacancies</a>
      </body></html>
    `;
    const craneDiscovered = ctx.discoverContactLinks(mockCraneHomeHtml, "https://www.totalhoistsandcranes.com.au/");
    assert.ok(craneDiscovered.includes("https://www.totalhoistsandcranes.com.au/about-us/industries"), "Must discover /about-us/industries");
    const indIndex = craneDiscovered.indexOf("https://www.totalhoistsandcranes.com.au/about-us/industries");
    const faqIndex = craneDiscovered.indexOf("https://www.totalhoistsandcranes.com.au/about-us/faq");
    assert.ok(indIndex < faqIndex, "Industries link must be prioritized above FAQ");

    // End-to-end multi-page restricted detection
    const multiPageCraneCheck = ctx.detectRestrictedKeywords(
      "Total Hoists & Cranes Overhead Cranes Manufacturer",
      "<html><body>Total Hoists & Cranes</body></html>",
      [
        { url: "https://www.totalhoistsandcranes.com.au/", text: "Total Hoists & Cranes" },
        { url: "https://www.totalhoistsandcranes.com.au/about-us/industries", text: mockCraneIndustriesText, html: "<h4>Marine Industry</h4>" }
      ]
    );
    assert.strictEqual(multiPageCraneCheck.isRestricted, true);
    assert.strictEqual(multiPageCraneCheck.sourceUrl, "https://www.totalhoistsandcranes.com.au/about-us/industries");
    assert.strictEqual(multiPageCraneCheck.category, "Marine");

    // 12. Parked Domain / GoDaddy Parking Lander Detection (e.g. negribossi.co.uk/lander)
    const godaddyLanderHtml = `<!doctype html><html lang="en"><head><script>window.LANDER_SYSTEM="PW"</script><script>window._trfd=window._trfd||[],window._trfd.push({ap:"parking"})</script><script defer="defer" src="https://img1.wsimg.com/parking-lander/static/js/main.1cc9fa89.js"></script></head><body><div id="root"></div></body></html>`;
    const parkedCheck = ctx.detectDisallowedWebsitePlatformOrDomain("https://negribossi.co.uk/lander", godaddyLanderHtml, "");
    assert.strictEqual(parkedCheck.isDisallowed, true, "Must detect GoDaddy parking lander as disallowed");
    assert.ok(parkedCheck.reason.includes("Parked Domain"), "Reason must identify Parked Domain");

    // QC compliance: If site is restricted, all 13 fields MUST be empty
    const restrictedQcResult = ctx.applyStrictInstructions({
      websiteStatus: "Working",
      companyName: "Total Hoists and Cranes Pty Ltd",
      countryName: "Australia",
      companyAddress: "10 Industrial Drive, Melbourne, Victoria"
    }, {
      originalUrl: "http://www.totalhoistsandcranes.com.au",
      finalUrl: "https://www.totalhoistsandcranes.com.au/"
    }, multiPageCraneCheck);
    assert.strictEqual(restrictedQcResult.websiteStatus, "Not Working");
    assert.strictEqual(restrictedQcResult.companyName, "");
    assert.strictEqual(restrictedQcResult.companyAddress, "");
    assert.strictEqual(restrictedQcResult.state, "");
    assert.strictEqual(restrictedQcResult.city, "");
  });

  runTest('Own Crawl extraction & QC robustness for Taiwan, UK, USA, China', () => {
    // 1. Taiwan Own Crawl test case
    const mockTaiwanCrawl = {
      originalUrl: "http://www.kaulin.com.tw",
      finalUrl: "https://www.kaulin.com.tw/en/",
      title: "Kaulin Mfg. Co., Ltd. - Industrial Sewing Machines",
      copyrightText: "Copyright © 2024 Kaulin Mfg. Co., Ltd. All Rights Reserved.",
      legalCompanyCandidates: ["Kaulin Mfg. Co., Ltd.", "高林股份有限公司"],
      addressCandidates: [
        {
          raw: "No. 159, Yongke E. Rd., Yongkang Dist., Tainan City 71041, Taiwan, R.O.C.",
          source: "contact",
          isHeadquarters: true,
          isEnglish: true
        },
        {
          raw: "710台南市永康區永科東路159號",
          source: "footer",
          isHeadquarters: true,
          isEnglish: false
        }
      ],
      phones: ["+886-6-233-2888"],
      emails: ["service@kaulin.com.tw"],
      mainHtml: `<html><body><h1>Kaulin Mfg. Co., Ltd.</h1><div>No. 159, Yongke E. Rd., Yongkang Dist., Tainan City 71041, Taiwan</div></body></html>`,
      combinedText: "Kaulin Mfg. Co., Ltd. No. 159, Yongke E. Rd., Yongkang Dist., Tainan City 71041, Taiwan",
      productItems: [
        { name: "Overlock Machine", img: "overlock.jpg", desc: "High speed industrial overlock sewing machine" },
        { name: "Interlock Machine", img: "interlock.jpg", desc: "Multi-thread industrial interlock machine" },
        { name: "Lockstitch Machine", img: "lockstitch.jpg", desc: "Single needle direct drive lockstitch machine" }
      ]
    };

    const taiwanExtracted = ctx.heuristicExtraction(mockTaiwanCrawl, { isRestricted: false });
    const taiwanQc = ctx.applyStrictInstructions(taiwanExtracted, mockTaiwanCrawl, { isRestricted: false });

    assert.strictEqual(taiwanQc.websiteStatus, "Working");
    assert.strictEqual(taiwanQc.companyName, "Kaulin Manufacturing Company, Limited", "Taiwan company abbreviation must expand Co., Ltd. to Company, Limited and Mfg. to Manufacturing");
    assert.strictEqual(taiwanQc.countryName, "Taiwan", "Taiwan country name must be Taiwan");
    assert.strictEqual(taiwanQc.companyAddress, "Number 159, Yongke East Road, Yongkang District, Tainan City", "Taiwan address must expand Yongke E. Rd. to Yongke East Road, No. to Number, strip 71041 postal code and Taiwan country");
    assert.strictEqual(taiwanQc.state, "Not Available", "Taiwan municipalities/districts have no state (State: Not Available)");
    assert.strictEqual(taiwanQc.city, "Available", "Tainan City / Yongkang District must be City Available");
    assert.strictEqual(taiwanQc.phoneNumber, "62332888", "Taiwan phone must strip +886 calling code");

    // 2. United Kingdom (UK) Own Crawl test case
    const mockUkCrawl = {
      originalUrl: "http://www.dataplastics.co.uk",
      finalUrl: "https://www.dataplastics.co.uk/",
      title: "Data Plastics Ltd - Precision Injection Moulding",
      copyrightText: "© 2024 Data Plastics Ltd",
      legalCompanyCandidates: ["Data Plastics Ltd"],
      addressCandidates: [
        {
          raw: "42 High Street, Manchester, M1 1AA, United Kingdom",
          source: "contact",
          isHeadquarters: true,
          isEnglish: true
        }
      ],
      phones: ["+44 0161 234 5678"],
      emails: ["enquiries@dataplastics.co.uk"],
      mainHtml: `<html><body><p>42 High Street, Manchester, M1 1AA</p></body></html>`,
      combinedText: "Data Plastics Ltd 42 High Street, Manchester, M1 1AA, United Kingdom",
      productItems: [
        { name: "Moulding 1", img: "m1.jpg", desc: "Precision custom moulding" },
        { name: "Moulding 2", img: "m2.jpg", desc: "Medical grade plastic injection" },
        { name: "Moulding 3", img: "m3.jpg", desc: "Industrial tooling and extrusion" }
      ]
    };

    const ukExtracted = ctx.heuristicExtraction(mockUkCrawl, { isRestricted: false });
    const ukQc = ctx.applyStrictInstructions(ukExtracted, mockUkCrawl, { isRestricted: false });

    assert.strictEqual(ukQc.companyName, "Data Plastics Limited", "UK company abbreviation must expand Ltd to Limited");
    assert.strictEqual(ukQc.countryName, "United Kingdom", "UK country name must be United Kingdom when explicitly on site");
    assert.strictEqual(ukQc.companyAddress, "42 High Street, Manchester", "UK address must strip UK postcode M1 1AA, strip United Kingdom, and NOT blindly add Number");
    assert.strictEqual(ukQc.state, "Not Available", "UK has no state without explicit county keyword");
    assert.strictEqual(ukQc.city, "Available", "Manchester is an official UK city");
    assert.strictEqual(ukQc.phoneNumber, "1612345678", "UK phone must strip +44 and leading 0");

    // 3. USA Own Crawl test case
    const mockUsaCrawl = {
      originalUrl: "http://www.hartlandprecision.com",
      finalUrl: "https://www.hartlandprecision.com/",
      title: "Hartland Precision Tools, LLC",
      copyrightText: "© 2024 Hartland Precision Tools, LLC. All Rights Reserved.",
      legalCompanyCandidates: ["Hartland Precision Tools, LLC"],
      addressCandidates: [
        {
          raw: "604 Progress Drive, Hartland, WI 53029, USA",
          source: "contact",
          isHeadquarters: true,
          isEnglish: true
        }
      ],
      phones: ["+1 (262) 367-1234"],
      emails: ["sales@hartlandprecision.com"],
      mainHtml: `<html><body><p>604 Progress Drive, Hartland, WI 53029</p></body></html>`,
      combinedText: "Hartland Precision Tools, LLC 604 Progress Drive, Hartland, WI 53029",
      productItems: [
        { name: "Tool A", img: "a.jpg", desc: "Precision tool holder" },
        { name: "Tool B", img: "b.jpg", desc: "CNC collet chuck" },
        { name: "Tool C", img: "c.jpg", desc: "Carbide milling insert" }
      ]
    };

    const usaExtracted = ctx.heuristicExtraction(mockUsaCrawl, { isRestricted: false });
    const usaQc = ctx.applyStrictInstructions(usaExtracted, mockUsaCrawl, { isRestricted: false });

    assert.strictEqual(usaQc.companyName, "Hartland Precision Tools, Limited Liability Company", "USA company must expand LLC to Limited Liability Company");
    assert.strictEqual(usaQc.countryName, "United States Of America", "USA country name must resolve to United States Of America");
    assert.strictEqual(usaQc.companyAddress, "604 Progress Drive, Hartland, Wisconsin", "USA address must expand WI to Wisconsin, strip 53029 zip, strip USA, and NOT blindly add Number");
    assert.strictEqual(usaQc.state, "Available", "Wisconsin is a recognized US state (State: Available)");
    assert.strictEqual(usaQc.city, "Available", "Hartland precedes Wisconsin (City: Available)");
    assert.strictEqual(usaQc.phoneNumber, "2623671234", "USA phone must strip +1 country calling code");

    // 4. China Own Crawl test case
    const mockChinaCrawl = {
      originalUrl: "http://www.dongjianghardware.com",
      finalUrl: "https://www.dongjianghardware.com/en/",
      title: "Dongjiang Precision Hardware Co., Ltd.",
      copyrightText: "Copyright © 2024 Dongjiang Precision Hardware Co., Ltd.",
      legalCompanyCandidates: ["Dongjiang Precision Hardware Co., Ltd.", "东莞市东江精密五金制品有限公司"],
      addressCandidates: [
        {
          raw: "Number 138 Huize Avenue, Dongjiang High-Tech Industrial Park, Zhongkai High-Tech Zone, Huizhou, Guangdong 516000, China",
          source: "contact",
          isHeadquarters: true,
          isEnglish: true
        }
      ],
      phones: ["+86-752-3891234"],
      emails: ["info@dongjianghardware.com"],
      mainHtml: `<html><body><p>Number 138 Huize Avenue, Dongjiang High-Tech Industrial Park, Huizhou, Guangdong 516000</p></body></html>`,
      combinedText: "Dongjiang Precision Hardware Co., Ltd. Number 138 Huize Avenue, Dongjiang High-Tech Industrial Park, Huizhou, Guangdong 516000",
      productItems: [
        { name: "Hardware 1", img: "h1.jpg", desc: "Precision stamping parts" },
        { name: "Hardware 2", img: "h2.jpg", desc: "CNC machined components" },
        { name: "Hardware 3", img: "h3.jpg", desc: "Custom brass fittings" }
      ]
    };

    const chinaExtracted = ctx.heuristicExtraction(mockChinaCrawl, { isRestricted: false });
    const chinaQc = ctx.applyStrictInstructions(chinaExtracted, mockChinaCrawl, { isRestricted: false });

    assert.strictEqual(chinaQc.companyName, "Dongjiang Precision Hardware Company, Limited", "China company must prefer English registered legal name and expand Co., Ltd. to Company, Limited");
    assert.strictEqual(chinaQc.countryName, "China", "China country name must be China");
    assert.strictEqual(chinaQc.companyAddress, "Number 138 Huize Avenue, Dongjiang High-Technology Industrial Park, Zhongkai High-Technology Zone, Huizhou, Guangdong", "China address must strip 6-digit postal code 516000 and China country");
    assert.strictEqual(chinaQc.state, "Available", "Guangdong is a Chinese province (State: Available)");
    assert.strictEqual(chinaQc.city, "Available", "Huizhou is a recognized city in Guangdong (City: Available)");
    assert.strictEqual(chinaQc.phoneNumber, "7523891234", "China phone must strip +86 calling code");
  });

  // 46. Tactile Button Interaction, Live Progress States, and Floating Toast Feedback
  runTest('Tactile button feedback, live states (crawling, extracting, success, not-working, restricted), and floating toast notifications', () => {
    // 1. Verify content.css contains interactive, ripple, shake, and floating toast styles
    const cssContent = fs.readFileSync(path.join(rootDir, 'content.css'), 'utf8');
    assert.ok(cssContent.includes('.ai-btn-pressed'), 'content.css must define .ai-btn-pressed for tactile depression');
    assert.ok(cssContent.includes('.ai-btn-ripple'), 'content.css must define .ai-btn-ripple material animation');
    assert.ok(cssContent.includes('@keyframes ai-ripple-animation'), 'content.css must include @keyframes ai-ripple-animation');
    assert.ok(cssContent.includes('@keyframes ai-btn-shake'), 'content.css must include @keyframes ai-btn-shake for empty URL warnings');
    assert.ok(cssContent.includes('#ai-floating-toast'), 'content.css must style #ai-floating-toast notification');
    assert.ok(cssContent.includes('.ai-toast-show'), 'content.css must include .ai-toast-show state');
    assert.ok(cssContent.includes('.ai-btn-not-working'), 'content.css must style .ai-btn-not-working state');
    assert.ok(cssContent.includes('.ai-btn-restricted'), 'content.css must style .ai-btn-restricted state');
    assert.ok(cssContent.includes('.ai-btn-extracting'), 'content.css must style .ai-btn-extracting state');

    // 2. Mock DOM element simulating button and toast behaviors
    class MockElement {
      constructor(id = '', tagName = 'div') {
        this.id = id;
        this.tagName = tagName;
        this.classes = new Set();
        this.classList = {
          add: (...cls) => cls.forEach(c => this.classes.add(c)),
          remove: (...cls) => cls.forEach(c => this.classes.delete(c)),
          contains: (c) => this.classes.has(c)
        };
        this.innerHTML = '';
        this.disabled = false;
        this.style = {};
        this.children = [];
      }
      get className() {
        return Array.from(this.classes).join(' ');
      }
      set className(val) {
        this.classes.clear();
        (val || '').split(/\s+/).filter(Boolean).forEach(c => this.classes.add(c));
      }
      appendChild(child) {
        this.children.push(child);
      }
      querySelector(selector) {
        if (selector.startsWith('.')) {
          const c = selector.slice(1);
          return this.children.find(ch => ch.classList && ch.classList.contains(c)) || null;
        }
        return null;
      }
    }

    const mockBody = new MockElement('body', 'body');
    const mockQuickBtn = new MockElement('ai-quick-btn', 'button');
    const mockCrawlBtn = new MockElement('ai-crawl-btn', 'button');
    const mockHeaderBtn = new MockElement('ai-header-crawl-btn', 'button');
    mockBody.appendChild(mockQuickBtn);
    mockBody.appendChild(mockCrawlBtn);
    mockBody.appendChild(mockHeaderBtn);

    const elementsById = {
      'ai-quick-btn': mockQuickBtn,
      'ai-crawl-btn': mockCrawlBtn,
      'ai-header-crawl-btn': mockHeaderBtn
    };

    const mockDoc = {
      body: mockBody,
      createElement: (tag) => new MockElement('', tag),
      getElementById: (id) => elementsById[id] || null
    };

    const overlayContext = vm.createContext({
      document: mockDoc,
      globalThis: {},
      setTimeout: () => 1,
      clearTimeout: () => {},
      console: { log: () => {}, warn: () => {} }
    });
    overlayContext.globalThis = overlayContext;

    const overlayCode = fs.readFileSync(path.join(rootDir, 'src/content/overlay-ui.js'), 'utf8');
    vm.runInContext(overlayCode, overlayContext);

    const AIExt = overlayContext.__AI_EXTENSION__;
    assert.ok(typeof AIExt.setQuickBtnState === 'function', 'setQuickBtnState must be exported on AIExt');
    assert.ok(typeof AIExt.showFloatingToast === 'function', 'showFloatingToast must be exported on AIExt');

    // Test crawling state
    AIExt.setQuickBtnState('crawling', 'Crawling Site...');
    assert.strictEqual(mockQuickBtn.disabled, true, 'Quick button must be disabled during crawl');
    assert.ok(mockQuickBtn.classList.contains('ai-btn-crawling'), 'Quick button must have ai-btn-crawling class');
    assert.ok(mockQuickBtn.innerHTML.includes('Crawling Site...'), 'Quick button must show crawling label');

    // Test extracting state
    AIExt.setQuickBtnState('extracting', 'AI Extracting...');
    assert.ok(mockQuickBtn.classList.contains('ai-btn-extracting'), 'Quick button must have ai-btn-extracting class');
    assert.ok(mockQuickBtn.innerHTML.includes('AI Extracting...'), 'Quick button must show extracting label');

    // Test success working state
    AIExt.setQuickBtnState('success_working', '✅ Pre-Filled (Working)!');
    assert.strictEqual(mockQuickBtn.disabled, false, 'Quick button must be re-enabled on success');
    assert.ok(mockQuickBtn.classList.contains('ai-btn-success'), 'Quick button must have ai-btn-success class');
    assert.ok(mockQuickBtn.innerHTML.includes('Pre-Filled (Working)'), 'Quick button must show Working prefill success label');

    // Test marked not working state
    AIExt.setQuickBtnState('marked_not_working', '🚫 Not Working (Shopping Cart)');
    assert.ok(mockQuickBtn.classList.contains('ai-btn-not-working'), 'Quick button must have ai-btn-not-working class');
    assert.ok(mockQuickBtn.innerHTML.includes('Not Working (Shopping Cart)'), 'Quick button must show Not Working badge');

    // Test restricted site state
    AIExt.setQuickBtnState('restricted', '⛔ Restricted Site!');
    assert.ok(mockQuickBtn.classList.contains('ai-btn-restricted'), 'Quick button must have ai-btn-restricted class');
    assert.ok(mockQuickBtn.innerHTML.includes('Restricted Site!'), 'Quick button must show Restricted Site badge');

    // Test empty URL / warning state
    AIExt.setQuickBtnState('no_url', '⚠️ Enter URL First!');
    assert.ok(mockQuickBtn.classList.contains('ai-btn-warning'), 'Quick button must have ai-btn-warning class');
    assert.ok(mockQuickBtn.innerHTML.includes('Enter URL First!'), 'Quick button must show warning text');

    // Test reset to idle
    AIExt.resetCrawlButtons();
    assert.strictEqual(mockQuickBtn.disabled, false);
    assert.strictEqual(mockQuickBtn.innerHTML, '🤖 AI Crawl & Fill');
    assert.strictEqual(mockQuickBtn.classList.contains('ai-btn-crawling'), false);

    // Test showFloatingToast creates toast element in body with correct classes
    AIExt.showFloatingToast('🚀 Crawling https://example.com...', 'loading', 0);
    const toast = mockBody.children.find(c => c.id === 'ai-floating-toast');
    assert.ok(toast, 'Floating toast element must be injected into document.body');
    assert.ok(toast.classList.contains('ai-toast-show'), 'Floating toast must have ai-toast-show class');
    assert.ok(toast.classList.contains('ai-toast-loading'), 'Floating toast must have ai-toast-loading class');
    assert.ok(toast.innerHTML.includes('https://example.com'), 'Floating toast must contain target URL message');
  });

  // 47. Total Working Items Tracking, Today Date Filter, and Quality Metrics Dashboard
  await runAsyncTest('Total Working items tracking, Today date filter metrics, and UI sync', async () => {
    // 1. Verify working website recording into persistent storage
    const wRec1 = await ctx.recordWorkingWebsite({
      url: "https://www.campap.com",
      websiteStatus: "Working",
      companyName: "CHEE WAH Corporation Berhad",
      countryName: "Malaysia",
      businessType: "Manufacturer"
    });
    assert.strictEqual(wRec1.success, true, "recordWorkingWebsite must succeed");
    assert.strictEqual(wRec1.added, true, "Initial working website must be added");
    assert.strictEqual(wRec1.record["Website Status"], "Working");
    assert.strictEqual(wRec1.record["Company Name"], "CHEE WAH Corporation Berhad");
    assert.strictEqual(wRec1.record["Country Name"], "Malaysia");
    assert.strictEqual(wRec1.record["Business Type"], "Manufacturer");

    // 2. Duplicate prevention on the same date
    const wRecDup = await ctx.recordWorkingWebsite({
      url: "https://www.campap.com/",
      websiteStatus: "Working"
    });
    assert.strictEqual(wRecDup.added, false, "Duplicate working website URL on same date must be ignored");

    // 3. Record a non-working website for today
    await ctx.recordNonWorkingWebsite({
      url: "https://dead-example-site.com",
      websiteStatus: "Not Working",
      reason: "Website unreachable or empty response"
    });

    // 4. Test stats calculation with today's date filter
    const todayStr = ctx.getLocalDateString();
    const statsResult = await ctx.getNonWorkingRecordsAndStats(todayStr);
    assert.strictEqual(statsResult.success, true);
    assert.ok(statsResult.stats.totalWorking >= 1, "Stats must include totalWorking >= 1");
    assert.ok(statsResult.stats.workingToday >= 1, "Stats must include workingToday >= 1");
    assert.strictEqual(statsResult.stats.todayDate, todayStr, "Stats must report correct todayDate");
    assert.ok(statsResult.stats.totalToday >= 1, "Stats must include totalToday count");
    assert.ok(statsResult.stats.totalProcessed >= statsResult.stats.totalHistorical + statsResult.stats.totalWorking, "totalProcessed must include both working and non-working items");

    // 5. Test UI elements presence in popup.html
    const popupHtml = fs.readFileSync(path.join(rootDir, 'popup.html'), 'utf8');
    assert.ok(popupHtml.includes('id="stat-working"'), 'popup.html must contain #stat-working metric tile');
    assert.ok(popupHtml.includes('id="btn-filter-today"'), 'popup.html must contain #btn-filter-today button');
    assert.ok(popupHtml.includes('id="btn-filter-all"'), 'popup.html must contain #btn-filter-all button');
    assert.ok(popupHtml.includes('id="filter-metric-date"'), 'popup.html must contain #filter-metric-date picker');
    assert.ok(popupHtml.includes('id="label-stat-total"'), 'popup.html must contain #label-stat-total');

    // 6. Test styles presence in popup.css
    const popupCss = fs.readFileSync(path.join(rootDir, 'popup.css'), 'utf8');
    assert.ok(popupCss.includes('.tile-working'), 'popup.css must style .tile-working');
    assert.ok(popupCss.includes('.date-filter-bar'), 'popup.css must style .date-filter-bar');
    assert.ok(popupCss.includes('.date-pill'), 'popup.css must style .date-pill');
    assert.ok(popupCss.includes('.metric-date-picker'), 'popup.css must style .metric-date-picker');

    // 7. Verify content.js dispatches RECORD_WORKING_SITE when a Working site is detected
    const contentJs = fs.readFileSync(path.join(rootDir, 'content.js'), 'utf8');
    assert.ok(contentJs.includes('RECORD_WORKING_SITE'), 'content.js must dispatch RECORD_WORKING_SITE action for working sites');
  });

  // 47. Comprehensive Cross-Domain & Client-Side Redirect Detection (Rule 13)
  await runAsyncTest('Comprehensive Cross-Domain & Client-Side Redirect Detection (Rule 13)', async () => {
    // 1. Root domain extraction across global multi-part ccTLDs
    assert.strictEqual(ctx.extractRootDomain("http://example.com"), "example.com");
    assert.strictEqual(ctx.extractRootDomain("https://www.example.co.uk/path"), "example.co.uk");
    assert.strictEqual(ctx.extractRootDomain("http://sub.company.com.au"), "company.com.au");
    assert.strictEqual(ctx.extractRootDomain("https://m.store.co.za"), "store.co.za");
    assert.strictEqual(ctx.extractRootDomain("http://corp.com.tw/products"), "corp.com.tw");

    // 2. Cross-domain vs same-domain redirect distinction
    assert.strictEqual(ctx.isRedirectDomain("http://alpha.com", "https://beta.com"), true);
    assert.strictEqual(ctx.isRedirectDomain("http://alpha.co.uk", "https://alpha.com"), true);
    assert.strictEqual(ctx.isRedirectDomain("http://company.com.au", "https://company.com"), true);
    assert.strictEqual(ctx.isRedirectDomain("http://alpha.com", "https://alpha.com/"), false);
    assert.strictEqual(ctx.isRedirectDomain("http://alpha.com", "https://www.alpha.com/"), false);
    assert.strictEqual(ctx.isRedirectDomain("http://alpha.com", "https://alpha.com/en/home"), false);

    // 3. Client-side redirect extraction (Meta refresh, JS replace/assign, Canonical, og:url)
    const metaHtml = '<meta content="0; url=https://newdestination.com/welcome" http-equiv="refresh">';
    assert.strictEqual(ctx.extractClientSideRedirect(metaHtml, "http://source.com"), "https://newdestination.com/welcome");

    const jsReplaceHtml = '<script>location.replace("https://destinationcorp.com/home");</script>';
    assert.strictEqual(ctx.extractClientSideRedirect(jsReplaceHtml, "http://sourcecorp.com"), "https://destinationcorp.com/home");

    const jsAssignHtml = '<script>window.location.assign("https://destinationcorp.com/landing");</script>';
    assert.strictEqual(ctx.extractClientSideRedirect(jsAssignHtml, "http://sourcecorp.com"), "https://destinationcorp.com/landing");

    const canonHtml = '<link href="https://canonicalcorp.com/" rel="canonical">';
    assert.strictEqual(ctx.extractClientSideRedirect(canonHtml, "http://sourcecorp.com"), "https://canonicalcorp.com/");

    // 4. End-to-end Redirect Site status preservation & field evaluation
    const redirectCrawl = {
      originalUrl: "http://www.oldbrandtools.com",
      finalUrl: "https://www.newbrandtools.com",
      redirected: true,
      status: "Redirect Site",
      title: "New Brand Tools Inc.",
      mainHtml: `<html><head><title>New Brand Tools Inc.</title></head><body><h1>New Brand Tools Inc.</h1><p>123 Tool Way, Dallas, Texas, United States</p></body></html>`,
      bodyText: "New Brand Tools Inc. 123 Tool Way, Dallas, Texas, United States",
      addressCandidates: [{ raw: "123 Tool Way, Dallas, Texas, United States" }],
      emails: ["sales@newbrandtools.com"],
      phones: ["2145550188"],
      detectedProductCount: 3,
      detectedImageCount: 3,
      detectedDescCount: 3,
      crawledPages: [{ url: "https://www.newbrandtools.com", text: "New Brand Tools" }]
    };

    const extracted = ctx.heuristicExtraction(redirectCrawl, { isRestricted: false });
    const cleaned = ctx.applyStrictInstructions(extracted, redirectCrawl, { isRestricted: false });

    assert.strictEqual(cleaned.websiteStatus, "Redirect Site", "Must be marked as Redirect Site");
    assert.strictEqual(cleaned._finalUrl, "https://www.newbrandtools.com", "Must track final redirected URL");
    assert.strictEqual(cleaned._originalUrl, "http://www.oldbrandtools.com", "Must track original URL");
    assert.ok(cleaned.companyName.includes("New Brand Tools"), "Must evaluate company name from destination site");
    assert.strictEqual(cleaned.countryName, "United States Of America", "Must evaluate country from destination site");

    // 5. Natuzzi Press Room test case (http://www.natuzzipressroom.com -> http://www.natuzzi.com/)
    const natuzziCrawl = {
      originalUrl: "http://www.natuzzipressroom.com",
      finalUrl: "http://www.natuzzi.com/",
      redirected: true,
      status: "Redirect Site",
      title: "Attention Required! | Cloudflare",
      mainHtml: "<html><title>Attention Required! | Cloudflare</title><body>Just a moment...</body></html>",
      bodyText: "Attention Required! | Cloudflare",
      legalCompanyCandidates: ["Natuzzi S.p.A.", "Natuzzi"],
      legalCandidateSources: { "Natuzzi S.p.A.": "http://www.natuzzi.com/" },
      addressCandidates: [{ raw: "Via Iazzitiello 47, 70029 Santeramo in Colle, Bari, Italy", priority: 1 }],
      emails: ["info@natuzzi.com"],
      phones: [],
      detectedProductCount: 3,
      detectedImageCount: 3,
      detectedDescCount: 3,
      crawledPages: []
    };

    const natuzziExtracted = ctx.heuristicExtraction(natuzziCrawl, { isRestricted: false });
    const natuzziCleaned = ctx.applyStrictInstructions(natuzziExtracted, natuzziCrawl, { isRestricted: false });

    assert.strictEqual(natuzziCleaned.websiteStatus, "Redirect Site", "Natuzzi must be marked as Redirect Site");
    assert.ok(natuzziCleaned.companyName.includes("Natuzzi"), "Company name must be Natuzzi, never Attention Required");
    assert.ok(!natuzziCleaned.companyName.toLowerCase().includes("attention"), "Anti-bot title must never be company name");
    assert.strictEqual(natuzziCleaned.countryName, "Italy", "Natuzzi country must be Italy");
    assert.strictEqual(natuzziCleaned.businessType, "Manufacturer", "Natuzzi business type must be Manufacturer");
    assert.strictEqual(natuzziCleaned.companyProfile, "Available", "Profile must be Available");
    assert.strictEqual(natuzziCleaned.state, "Available", "State must be Available");
    assert.strictEqual(natuzziCleaned.city, "Available", "City must be Available");
    assert.strictEqual(natuzziCleaned.numberOfProducts, "3");
    assert.strictEqual(natuzziCleaned.productImages, "3");
    assert.strictEqual(natuzziCleaned.numberOfProductDescriptions, "3");
    assert.strictEqual(natuzziCleaned._finalUrl, "http://www.natuzzi.com/");
    assert.strictEqual(natuzziCleaned._originalUrl, "http://www.natuzzipressroom.com");

    // 6. Anti-Bot Cloudflare Challenge on generic destination domain
    const cfCrawl = {
      originalUrl: "http://www.legacyvalves.com",
      finalUrl: "https://www.valvecorp.com/",
      redirected: true,
      status: "Redirect Site",
      title: "Just a moment...",
      mainHtml: "<html><title>Just a moment...</title><body>Cloudflare turnstile challenge</body></html>",
      bodyText: "",
      addressCandidates: [],
      emails: [],
      phones: [],
      detectedProductCount: 0,
      detectedImageCount: 0,
      detectedDescCount: 0,
      crawledPages: []
    };
    const cfExtracted = ctx.heuristicExtraction(cfCrawl, { isRestricted: false });
    const cfCleaned = ctx.applyStrictInstructions(cfExtracted, cfCrawl, { isRestricted: false });
    assert.strictEqual(cfCleaned.websiteStatus, "Redirect Site", "Must preserve Redirect Site even on anti-bot destination");
    assert.strictEqual(cfCleaned.companyName, "Valvecorp", "Must derive clean brand from domain stem, not Cloudflare");
    assert.strictEqual(cfCleaned.businessType, "Manufacturer", "Must default to eligible Manufacturer, not Outside Allowed Scope");
    assert.strictEqual(cfCleaned.numberOfProducts, "3", "Must default products to 3 for eligible redirect site");

    // 7. Dead Redirect Destination (404 / Connection error)
    const deadCrawl = {
      originalUrl: "http://oldsite.com",
      finalUrl: "http://deadnewsitedomain.com",
      redirected: true,
      status: "Redirect Site",
      fetchError: "Site returned HTTP 404 Not Found",
      mainHtml: "",
      httpStatus: 404
    };
    const deadResult = await ctx.handleCrawlAndExtract("http://oldsite.com", "own_crawl");
    // Dead crawl result through handleCrawlAndExtract
    assert.strictEqual(ctx.isRedirectDomain(deadCrawl.originalUrl, deadCrawl.finalUrl), true);

    // 8. Visotek Inc -> Laser Mechanisms Inc (HTTP 301 socket reset rescue)
    const visotekCrawl = {
      originalUrl: "http://www.visotekinc.com",
      finalUrl: "https://www.lasermech.com/",
      redirected: true,
      status: "Redirect Site",
      title: "Laser Mechanisms, Inc",
      mainHtml: "<html><head><title>Laser Mechanisms, Inc</title></head><body><h1>Laser Mechanisms</h1><p>25325 Regency Drive, Novi, Michigan 48375 USA</p></body></html>",
      bodyText: "Corporate Offices · Sales & Engineering Laser Mechanisms, Inc. 25325 Regency Drive Novi, Michigan 48375 USA Phone (248) 474-9480",
      legalCompanyCandidates: ["Laser Mechanisms, Inc.", "Laser Mechanisms"],
      addressCandidates: [{ raw: "25325 Regency Drive, Novi, Michigan 48375, USA", priority: 1 }],
      phones: ["(248) 474-9480"],
      detectedProductCount: 3,
      crawledPages: []
    };
    const visotekExtracted = ctx.heuristicExtraction(visotekCrawl, { isRestricted: false });
    const visotekResult = ctx.applyStrictInstructions(visotekExtracted, visotekCrawl, { isRestricted: false });
    assert.strictEqual(visotekResult.websiteStatus, "Redirect Site", "Must classify visotekinc.com as Redirect Site");
    assert.strictEqual(visotekResult.companyName, "Laser Mechanisms, Incorporated", "Must extract and expand Laser Mechanisms, Inc.");
    assert.strictEqual(visotekResult.countryName, "United States Of America");
    assert.strictEqual(visotekResult.companyAddress, "25325 Regency Drive, Novi, Michigan");
    assert.strictEqual(visotekResult.state, "Available");
    assert.strictEqual(visotekResult.city, "Available");
    assert.strictEqual(visotekResult.phoneNumber, "2484749480");

    // 9. resolveRedirectChain multi-hop mock tracing test
    const mockHops = {
      "http://hop1.com": { status: 301, location: "https://hop2.com" },
      "https://hop2.com": { status: 302, location: "https://finaldestination.com/" },
      "https://hop2.com/": { status: 302, location: "https://finaldestination.com/" },
      "https://finaldestination.com/": { status: 200 }
    };
    const origFetch = ctx.fetch;
    try {
      ctx.fetch = async (url) => {
        const info = mockHops[url] || { status: 200 };
        return {
          status: info.status,
          type: info.status >= 300 && info.status < 400 ? "opaqueredirect" : "basic",
          headers: {
            get: (h) => (h.toLowerCase() === "location" ? info.location : null)
          }
        };
      };
      const chainRes = await ctx.resolveRedirectChain("http://hop1.com", 6);
      assert.strictEqual(chainRes.finalUrl, "https://finaldestination.com/", "resolveRedirectChain must trace multi-hop chain to final destination");
      assert.strictEqual(chainRes.hops, 2, "resolveRedirectChain must report correct hop count");
      assert.strictEqual(ctx.isRedirectDomain("http://hop1.com", chainRes.finalUrl), true, "Cross-domain redirect must be detected from chain");
    } finally {
      ctx.fetch = origFetch;
    }
  });

  // 48. Website Restricted Category Detection, False-Positive Elimination & QC Evidence Accuracy
  runTest('Website Restricted Category Detection, False-Positive Elimination & QC Evidence Accuracy', () => {
    // 1. Adult / Porn False Positives
    const adultCases = [
      {
        url: "https://campakeela.com/programs",
        title: "Camp Akeela - Sleepaway Summer Camp",
        text: "Camp Akeela is a co-ed sleepaway camp for children, teens, and young adults. We offer camp programs for kids and adults.",
        expectedBusiness: "Youth summer camp"
      },
      {
        url: "https://carl-f-bucherer.com/en/watches",
        title: "Carl F. Bucherer Swiss Watches",
        text: "Carl F. Bucherer is a Swiss luxury watchmaker founded in 1888 in Lucerne. High quality watches for men, women, and adults.",
        expectedBusiness: "Luxury watchmaker"
      },
      {
        url: "https://northkenya.com/safaris",
        title: "North Kenya Safaris & Wildlife Tours",
        text: "North Kenya Safaris: Guided game drives and tours across East Africa. Rates: $150 per adult, $75 per child.",
        expectedBusiness: "Wildlife safari tours"
      },
      {
        url: "https://nifdindia.org/about",
        title: "NIFD Global - Premier Design Institute",
        text: "NIFD Global is a premier design institute. Adult education, vocational courses for adult learners and fashion design students.",
        expectedBusiness: "Design educational institute"
      },
      {
        url: "https://breswaoutdoorfurniture.co.nz/products",
        title: "Breswa Outdoor Furniture New Zealand",
        text: "Breswa Outdoor Furniture New Zealand. Handcrafted wooden picnic tables, outdoor furniture for adults and kids.",
        expectedBusiness: "Outdoor wooden furniture manufacturing"
      },
      {
        url: "https://cri.fiu.edu/research",
        title: "Community Research Institute - Florida International University",
        text: "Community Research Institute at Florida International University. Academic research into adult life, adult population health and development.",
        expectedBusiness: "University research institute"
      },
      {
        url: "https://momeni.com/terms",
        title: "Momeni Rugs Terms and Conditions",
        text: "Momeni Rugs and Carpets. Terms of service: You must be an adult of legal age to place orders on this website.",
        expectedBusiness: "Rugs and carpet manufacturing"
      },
      {
        url: "https://avanti-conveyors.co.uk/privacy",
        title: "Avanti Conveyors Privacy Policy",
        text: "Avanti Conveyors Ltd manufactures packaging conveyors. Privacy notice: our website is intended for adult audience only.",
        expectedBusiness: "Packaging conveyor systems manufacturing"
      },
      {
        url: "https://theprintedbagshop.co.uk/products",
        title: "The Printed Bag Shop Products",
        text: "Custom printed bags, paper packaging, and totes with cute animal illustrations and animal prints.",
        expectedBusiness: "Custom packaging and printed bags"
      }
    ];

    for (const ac of adultCases) {
      const res = ctx.detectRestrictedKeywordsSingle(ac.text, `<html><head><title>${ac.title}</title></head></html>`, ac.url);
      assert.strictEqual(res.isRestricted, false, `Must NOT restrict adult false positive: ${ac.url}`);
      assert.ok(res.classification === "FALSE_POSITIVE" || res.classification === "NO_RESTRICTED_CATEGORY", `Classification must be non-restricted for ${ac.url}`);
    }

    // 2. Aircraft / Aerospace False Positives (Applications, Materials & Served Industries)
    const aeroCases = [
      {
        url: "https://odu.de/industries",
        title: "ODU High-Performance Connectors",
        text: "ODU Connectors: High performance circular connectors for aerospace applications, medical technology, and military equipment."
      },
      {
        url: "https://avongear.com/capabilities",
        title: "Avon Gear Precision Manufacturing",
        text: "Avon Gear: Precision gear manufacturing. Custom gears manufactured for aerospace applications and heavy industrial machinery."
      },
      {
        url: "https://3dimensional.co.uk/services",
        title: "3D Dimensional Laser Prototyping",
        text: "3D Dimensional: Laser scanning, reverse engineering, and prototyping for automotive and aerospace applications."
      },
      {
        url: "https://globalpublicaffairs.ca/sectors",
        title: "Global Public Affairs",
        text: "Global Public Affairs: Advising corporate clients in transportation, aerospace, and energy sectors."
      },
      {
        url: "https://wdserv.com/markets",
        title: "Water Treatment Services",
        text: "Water Treatment Services: Industrial water filtration systems serving manufacturing, automotive, and aerospace facilities."
      },
      {
        url: "https://flocomponents.com/products",
        title: "Flo Components Lubrication Systems",
        text: "Flo Components: Automatic lubrication systems for mining, construction, and aerospace machinery."
      },
      {
        url: "https://russellsymes.com.au/about",
        title: "Russell Symes CNC Machining",
        text: "Russell Symes & Co: Precision CNC machining and toolmaking. Components for medical, defense, and aerospace applications."
      },
      {
        url: "https://mastertechdiamond.com/products",
        title: "Mastertech Superabrasive Diamond",
        text: "Mastertech Diamond: Superabrasive diamond grinding wheels for carbide, ceramics, and aerospace composites."
      },
      {
        url: "https://pppltd.com/capabilities",
        title: "Precision Plastic Products",
        text: "Precision Plastic Products: Plastic injection moulding for automotive, industrial, and aerospace applications."
      },
      {
        url: "https://cleaningequipmentservices.uk/hire",
        title: "Cleaning Equipment Services Hire",
        text: "Cleaning Equipment Services: Industrial floor scrubbers and sweepers hire for warehouses, factories, and aerospace hangars."
      },
      {
        url: "https://slingchoker.com/products",
        title: "Sling-Choker Rigging Supplies",
        text: "Sling-Choker: Rigging supplies, synthetic lifting slings, and galvanized aircraft cables for industrial lifting."
      },
      {
        url: "https://thomescanada.com/products",
        title: "Thomes Canada Birch Plywood",
        text: "Thomes Canada: Premium Baltic birch plywood and aircraft-grade plywood panels for architectural and furniture use."
      }
    ];

    for (const aero of aeroCases) {
      const res = ctx.detectRestrictedKeywordsSingle(aero.text, `<html><head><title>${aero.title}</title></head></html>`, aero.url);
      assert.strictEqual(res.isRestricted, false, `Must NOT restrict aerospace/aircraft application: ${aero.url}`);
      assert.ok(res.classification === "FALSE_POSITIVE" || res.classification === "NO_RESTRICTED_CATEGORY", `Classification must be non-restricted for ${aero.url}`);
    }

    // 3. Animals False Positives (Welfare, Cruelty-Free Vegan, Government Administration)
    const animalCases = [
      {
        url: "https://zpkolhapur.gov.in/en",
        title: "Zilla Parishad Kolhapur Government Portal",
        text: "Zilla Parishad Kolhapur Government Portal. Animal Husbandry Department provides veterinary administrative services and welfare schemes."
      },
      {
        url: "https://suryabrasil.com/about-us",
        title: "Surya Brasil Vegan Cosmetics",
        text: "Surya Brasil: Natural organic vegan cosmetics and henna hair color. Cruelty-free, no animal testing, 100% vegan, cruelty-free to animals."
      },
      {
        url: "https://amwarkup.co.uk/buildings",
        title: "A.M. Warkup Agricultural Buildings",
        text: "A.M. Warkup Ltd: Agricultural building design and construction. Steel framed livestock housing built for animal welfare."
      }
    ];

    for (const anim of animalCases) {
      const res = ctx.detectRestrictedKeywordsSingle(anim.text, `<html><head><title>${anim.title}</title></head></html>`, anim.url);
      assert.strictEqual(res.isRestricted, false, `Must NOT restrict animal false positive: ${anim.url}`);
      assert.ok(res.classification === "FALSE_POSITIVE" || res.classification === "NO_RESTRICTED_CATEGORY", `Classification must be non-restricted for ${anim.url}`);
    }

    // 4. Alcohol False Positive (Architectural project credit / color finish)
    const alcoholCase = {
      url: "https://alumicor.com/projects",
      title: "Alumicor Architectural Aluminum",
      text: "Alumicor architectural aluminum windows, curtain walls, and entrances. Featured project: Whiskey Creek Community Center."
    };
    const alcRes = ctx.detectRestrictedKeywordsSingle(alcoholCase.text, `<html><head><title>${alcoholCase.title}</title></head></html>`, alcoholCase.url);
    assert.strictEqual(alcRes.isRestricted, false, "Must NOT restrict architectural project mentioning Whiskey Creek");
    assert.ok(alcRes.classification === "FALSE_POSITIVE" || alcRes.classification === "NO_RESTRICTED_CATEGORY");

    // 4b. Industrial False Positives (Negis Rubber/Gaskets, Hospital Lighting, Knife Gate Valves, Bakery Ovens)
    const industrialFpCases = [
      {
        url: "http://www.negis.com.sg/",
        title: "Ng Eng Guan Industry & Supplier",
        text: "Ng Eng Guan: Gaskets, Rubbers, Plastics. Our products are mainly used in Marine & Industrial, Refinery, Oil & Gases, Offshore Industrial Chemical Plant, Automotive, Food & Chemical Industry etc."
      },
      {
        url: "https://lumalighting.com/applications",
        title: "LumaLighting Solutions",
        text: "LumaLighting: Commercial and industrial LED lighting solutions for hospitals, schools, and offices."
      },
      {
        url: "https://apexvalves.com/products",
        title: "Apex Industrial Valves",
        text: "Apex Valves: We manufacture industrial knife gate valves, ball valves, and check valves for wastewater treatment."
      },
      {
        url: "https://industrialtooling.com/products",
        title: "Industrial Tooling Machinery Blades",
        text: "Industrial Tooling: Precision slitter knives, circular knives, and rotary blades for paper converting machinery."
      },
      {
        url: "https://baketech.com/ovens",
        title: "BakeTech Bakery Equipment",
        text: "BakeTech: Commercial bakery equipment, rotary rack ovens, and dough mixers for bakeries and restaurants."
      },
      {
        url: "https://titanvessels.com/tanks",
        title: "Titan Stainless Vessels",
        text: "Titan Vessels: Custom fabrication of stainless steel chemical storage tanks and chemical process equipment."
      }
    ];

    for (const ifp of industrialFpCases) {
      const res = ctx.detectRestrictedKeywordsSingle(ifp.text, `<html><head><title>${ifp.title}</title></head></html>`, ifp.url);
      assert.strictEqual(res.isRestricted, false, `Must NOT restrict industrial false positive: ${ifp.url}`);
      assert.ok(res.classification === "FALSE_POSITIVE" || res.classification === "NO_RESTRICTED_CATEGORY", `Classification must be non-restricted for ${ifp.url}`);
    }

    // 5. Genuine Restricted Businesses MUST Remain Strictly Restricted
    const genuineCases = [
      { url: "https://pornhub.com", text: "Pornhub is a free porn videos, xxx movies, adult entertainment and streaming erotica platform.", category: "Adult & Porn" },
      { url: "https://adulttoyzone.com", text: "Online sex shop selling adult toys, dildos, vibrators, and erotic novelties.", category: "Adult & Porn" },
      { url: "https://colt.com", text: "Colt Firearms: Manufacturing defense rifles, handguns, pistols, revolvers, and military firearms.", category: "Weapons, Armor & Knives" },
      { url: "https://bladeshop.com", text: "BladeShop: Wholesale pocket knives, folding knives, hunting knives, and tactical knives for sale.", category: "Weapons, Armor & Knives" },
      { url: "https://emirates.com", text: "Emirates Airline: Book commercial flights, air travel, and passenger tickets worldwide.", category: "Aviation & Airlines" },
      { url: "https://guinness.com", text: "Guinness Brewery: World famous stout beer brewery and alcoholic beverage producer in Dublin.", category: "Alcohol & Breweries" },
      { url: "https://abcchemical.com", text: "ABC Chemical: We are a leading chemical distributor and wholesale supplier of industrial chemicals, solvents, and raw materials.", category: "Chemicals & Petrochemicals" },
      { url: "https://globalchem.com", text: "Global Chem: International chemical trader and exporter of bulk chemicals and industrial solvents.", category: "Chemicals & Petrochemicals" },
      { url: "https://cedars-sinai.org", text: "Cedars-Sinai Medical Center: Hospital patient care, outpatient surgery clinic, and emergency healthcare services.", category: "Medicine, Medical & Hospital" },
      { url: "https://huntingtoningalls.com", text: "Huntington Ingalls Industries: America largest military shipbuilder, naval shipyards, and warships building.", category: "Ships & Boats" },
      { url: "https://puppyspot.com", text: "PuppySpot: Purebred puppies for sale, trusted dog breeding network and pet store adoption.", category: "Animals & Pets" },
      { url: "https://bestpetstore.com", text: "BestPetStore: Pet shop selling pet supplies, puppy food, dog accessories, and cat collars.", category: "Animals & Pets" }
    ];

    for (const gc of genuineCases) {
      const res = ctx.detectRestrictedKeywordsSingle(gc.text, "", gc.url);
      assert.strictEqual(res.isRestricted, true, `Must detect genuine restricted business: ${gc.url}`);
      assert.strictEqual(res.classification, "GENUINE_RESTRICTED");
      if (gc.url.includes("huntingtoningalls")) {
        assert.ok(
          res.restricted_category === "Ships & Boats" || res.restricted_category === "Defence & Military",
          `Expected Ships & Boats or Defence & Military, got ${res.restricted_category}`
        );
      } else {
        assert.strictEqual(res.restricted_category, gc.category);
      }
      assert.ok(res.confidence >= 0.95, "Confidence score must be >= 0.95 for genuine restricted");
    }

    // 6. Section 8 Structured Evidence Output Format Verification
    const sampleAvonEvidence = ctx.detectRestrictedKeywordsSingle(
      "Avon Gear provides precision gears for aerospace applications.",
      "<html><head><title>Avon Gear Precision</title></head></html>",
      "https://avongear.com/capabilities"
    );
    assert.strictEqual(sampleAvonEvidence.classification, "FALSE_POSITIVE");
    assert.strictEqual(sampleAvonEvidence.is_restricted, false);
    assert.strictEqual(sampleAvonEvidence.restricted_category, "Aerospace");
    assert.strictEqual(sampleAvonEvidence.matched_keyword, "aerospace");
    assert.strictEqual(sampleAvonEvidence.matched_page, "https://avongear.com/capabilities");
    assert.ok(sampleAvonEvidence.matched_context.includes("aerospace applications"));
    assert.ok(sampleAvonEvidence.confidence >= 0.90);
    assert.ok(sampleAvonEvidence.reason.length > 10);

    // 7. End-to-end QC Preservation: Eligible company with false-positive application mention keeps Working status
    const mockAvonCrawl = {
      finalUrl: "https://avongear.com/about",
      originalUrl: "https://avongear.com",
      mainHtml: "<html><body><h1>Avon Gear Company</h1><p>We manufacture custom precision gears for aerospace applications.</p></body></html>",
      contactHtml: "<html><body><p>123 Gear Way, Detroit, Michigan, USA. Phone: 3135550199</p></body></html>",
      bodyText: "Avon Gear manufactures custom precision gears for aerospace applications.",
      crawledPages: [
        { url: "https://avongear.com/about", text: "We manufacture custom precision gears for aerospace applications." }
      ]
    };
    const avonCheck = ctx.detectRestrictedKeywords(mockAvonCrawl.bodyText, mockAvonCrawl.mainHtml, mockAvonCrawl.crawledPages);
    assert.strictEqual(avonCheck.classification, "FALSE_POSITIVE");
    assert.strictEqual(avonCheck.isRestricted, false);

    const avonExtracted = {
      websiteStatus: "Working",
      businessType: "Manufacturer",
      companyName: "Avon Gear Company",
      countryName: "United States Of America",
      companyAddress: "123 Gear Way, Detroit, Michigan",
      state: "Available",
      city: "Available",
      phoneNumber: "3135550199",
      numberOfProducts: "3",
      productImages: "3",
      numberOfProductDescriptions: "3"
    };
    const avonQc = ctx.applyStrictInstructions(avonExtracted, mockAvonCrawl, avonCheck);
    assert.strictEqual(avonQc.websiteStatus, "Working", "False-positive application must preserve Working website status");
    assert.strictEqual(avonQc.companyName, "Avon Gear Company");
    assert.strictEqual(avonQc.classification, "FALSE_POSITIVE");
    assert.strictEqual(avonQc.is_restricted, false);
    assert.strictEqual(avonQc.restricted_category, "Aerospace");
  });

  // 49. Rule 4 Corporate Suffix Comma Reconciliation: "is comma available then only u put comma else leave"
  runTest('Rule 4 Corporate Suffix Comma Reconciliation - only put comma if available on website else leave (TAD Communications Ltd -> TAD Communications Limited)', () => {
    // A. Direct function tests for restoreCommaBeforeCorporateSuffix
    // 1. TAD Communications Ltd: on-site evidence has NO comma before Ltd -> output must NOT have comma
    const tadCrawlNoComma = {
      copyrightText: "Copyright © 2024 TAD Communications Ltd. All rights reserved.",
      title: "TAD Communications Ltd - Radio & Wireless Solutions",
      legalCompanyCandidates: ["TAD Communications Ltd"],
      combinedText: "TAD Communications Ltd provides radio and wireless communications."
    };
    // Even if AI generated a comma, it must be stripped
    assert.strictEqual(
      ctx.restoreCommaBeforeCorporateSuffix("TAD Communications, Limited", tadCrawlNoComma),
      "TAD Communications Limited",
      "Hallucinated comma before Limited must be stripped when website has TAD Communications Ltd without comma"
    );
    assert.strictEqual(
      ctx.restoreCommaBeforeCorporateSuffix("TAD Communications Limited", tadCrawlNoComma),
      "TAD Communications Limited",
      "No-comma company name must remain without comma when website has TAD Communications Ltd"
    );

    // 2. TAD Communications, Ltd: on-site evidence HAS a comma before Ltd -> output MUST preserve comma
    const tadCrawlWithComma = {
      copyrightText: "Copyright © 2024 TAD Communications, Ltd. All rights reserved.",
      title: "TAD Communications, Ltd. - Radio Solutions",
      legalCompanyCandidates: ["TAD Communications, Ltd."],
      combinedText: "TAD Communications, Ltd. provides communications."
    };
    assert.strictEqual(
      ctx.restoreCommaBeforeCorporateSuffix("TAD Communications Limited", tadCrawlWithComma),
      "TAD Communications, Limited",
      "Comma before Limited must be restored when website has TAD Communications, Ltd with comma"
    );
    assert.strictEqual(
      ctx.restoreCommaBeforeCorporateSuffix("TAD Communications, Limited", tadCrawlWithComma),
      "TAD Communications, Limited",
      "Existing comma before Limited must be preserved when website has TAD Communications, Ltd with comma"
    );

    // 3. Co., Ltd. vs Co. Ltd. (Company, Limited vs Company Limited)
    const kaulinCrawl = {
      copyrightText: "Copyright © 2024 Kaulin Mfg. Co., Ltd.",
      title: "Kaulin Mfg. Co., Ltd."
    };
    assert.strictEqual(
      ctx.restoreCommaBeforeCorporateSuffix("Kaulin Manufacturing Company Limited", kaulinCrawl),
      "Kaulin Manufacturing Company, Limited",
      "Company, Limited must have comma when on-site evidence has Co., Ltd."
    );
    assert.strictEqual(
      ctx.restoreCommaBeforeCorporateSuffix("Kaulin Manufacturing Company, Limited", kaulinCrawl),
      "Kaulin Manufacturing Company, Limited"
    );

    const coLtdNoCommaCrawl = {
      copyrightText: "Copyright © 2024 Apex Tools Co. Ltd. All rights reserved.",
      title: "Apex Tools Co. Ltd."
    };
    assert.strictEqual(
      ctx.restoreCommaBeforeCorporateSuffix("Apex Tools Company, Limited", coLtdNoCommaCrawl),
      "Apex Tools Company Limited",
      "Company Limited must NOT have comma when on-site evidence has Co. Ltd without comma"
    );

    // 4. Mocap LLC (no comma) vs Mocap, LLC (with comma)
    const mocapNoCommaCrawl = {
      bodyText: "Mocap LLC produces rubber and plastic caps.",
      copyrightText: "© 2024 Mocap LLC"
    };
    assert.strictEqual(
      ctx.restoreCommaBeforeCorporateSuffix("Mocap, Limited Liability Company", mocapNoCommaCrawl),
      "Mocap Limited Liability Company",
      "Limited Liability Company must NOT have comma when website has Mocap LLC without comma"
    );

    const mocapWithCommaCrawl = {
      bodyText: "Mocap, LLC produces rubber and plastic caps.",
      copyrightText: "© 2024 Mocap, LLC"
    };
    assert.strictEqual(
      ctx.restoreCommaBeforeCorporateSuffix("Mocap Limited Liability Company", mocapWithCommaCrawl),
      "Mocap, Limited Liability Company",
      "Limited Liability Company MUST have comma when website has Mocap, LLC with comma"
    );

    // 5. TP Orthodontics, Inc (with comma)
    const tpOrthodonticsCrawl = {
      title: "TP Orthodontics, Inc. - Precision Orthodontics",
      combinedText: "TP Orthodontics, Inc."
    };
    assert.strictEqual(
      ctx.restoreCommaBeforeCorporateSuffix("TP Orthodontics Incorporated", tpOrthodonticsCrawl),
      "TP Orthodontics, Incorporated",
      "Incorporated must have comma when website has TP Orthodontics, Inc. with comma"
    );

    // B. End-to-end QC pipeline test via applyStrictInstructions
    const tadMockExtracted = {
      websiteStatus: "Working",
      businessType: "Manufacturer",
      companyName: "TAD Communications, Limited", // AI generated with unwanted comma
      countryName: "United Kingdom",
      companyAddress: "14 Wireless Way, Leeds, West Yorkshire",
      state: "Available",
      city: "Available",
      phoneNumber: "1132550199",
      numberOfProducts: "3",
      productImages: "3",
      numberOfProductDescriptions: "3"
    };
    const tadMockCrawl = {
      originalUrl: "http://www.tadcommunications.co.uk",
      finalUrl: "https://www.tadcommunications.co.uk/",
      title: "TAD Communications Ltd - Radio & Wireless Systems",
      copyrightText: "Copyright © 2024 TAD Communications Ltd. All rights reserved.",
      legalCompanyCandidates: ["TAD Communications Ltd"],
      mainHtml: "<html><body><h1>TAD Communications Ltd</h1><p>We manufacture commercial two-way radios and communication equipment.</p></body></html>",
      bodyText: "TAD Communications Ltd is a UK manufacturer of wireless equipment.",
      combinedText: "TAD Communications Ltd is a UK manufacturer of wireless equipment. We manufacture commercial two-way radios and communication equipment.",
      addressCandidates: [{ raw: "14 Wireless Way, Leeds, West Yorkshire, LS1 2AB, UK", isHeadquarters: true }],
      productItems: [
        { name: "Two-Way Radio", img: "radio.jpg", desc: "Commercial handheld radio transceiver" },
        { name: "Base Station", img: "station.jpg", desc: "VHF base repeater station" },
        { name: "Antenna Mast", img: "antenna.jpg", desc: "High gain communication antenna" }
      ]
    };
    const tadQcResult = ctx.applyStrictInstructions(tadMockExtracted, tadMockCrawl, { isRestricted: false });
    assert.strictEqual(
      tadQcResult.companyName,
      "TAD Communications Limited",
      "applyStrictInstructions must strip hallucinated comma before Limited when website evidence has TAD Communications Ltd"
    );
  });

  // 50. Auto 10 Not Working Batch Automation Loop & Form Submission
  runTest('Auto 10 Not Working batch automation loop, queue advance, and form submission', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
    const files = manifest.content_scripts[0].js;

    let submittedCount = 0;
    let fromQueueClicks = 0;
    let storedBatch = null;
    let formValues = {};

    const queueSites = [
      'http://www.badsite1.com',
      'http://www.badsite2.com',
      'http://www.badsite3.com',
      'http://www.badsite4.com',
      'http://www.badsite5.com',
      'http://www.badsite6.com',
      'http://www.badsite7.com',
      'http://www.badsite8.com',
      'http://www.badsite9.com',
      'http://www.badsite10.com'
    ];
    let queueIdx = 0;

    const mockWebsiteInput = {
      id: 'website-name',
      name: 'website_name',
      value: queueSites[0],
      dispatchEvent: () => {},
      closest: () => null,
      classList: { add: () => {}, remove: () => {} },
      style: {}
    };

    const mockStatusSelect = {
      id: 'website-status',
      name: 'website_status',
      tagName: 'SELECT',
      options: [
        { text: 'Website Status', value: '' },
        { text: 'Working', value: 'Working' },
        { text: 'Not Working', value: 'Not Working' }
      ],
      selectedIndex: 0,
      value: '',
      dispatchEvent: () => {},
      closest: () => null,
      classList: { add: () => {}, remove: () => {} },
      style: {}
    };

    const mockSubmitBtn = {
      id: 'btnSubmitForm',
      tagName: 'BUTTON',
      textContent: 'Submit',
      disabled: false,
      click: () => {
        submittedCount++;
        // On submit, simulate form submission and portal loading next queue record
        if (queueIdx < queueSites.length - 1) {
          queueIdx++;
          mockWebsiteInput.value = queueSites[queueIdx];
        }
      },
      closest: () => ({ requestSubmit: () => {} }),
      classList: { add: () => {}, remove: () => {} },
      scrollIntoView: () => {}
    };

    const mockFromQueueBtn = {
      id: 'btnLoadNextQueueUrl',
      tagName: 'BUTTON',
      textContent: 'From Queue',
      click: () => {
        fromQueueClicks++;
        if (queueIdx < queueSites.length - 1) {
          queueIdx++;
          mockWebsiteInput.value = queueSites[queueIdx];
        }
      }
    };

    const mockBatch10Btn = {
      id: 'ai-batch-10-btn',
      tagName: 'BUTTON',
      textContent: '⚡ Auto 10 Not Working',
      style: {},
      addEventListener: () => {}
    };

    const mockBatchAllBtn = {
      id: 'ai-batch-all-btn',
      tagName: 'BUTTON',
      textContent: '⚡ Submit ALL Not Working',
      style: {},
      addEventListener: () => {}
    };

    let modalConfirmClicks = 0;
    const mockModal = {
      id: 'notWorkingConfirmModal',
      classList: {
        contains: (cls) => cls === 'active' || cls === 'modal-overlay',
        add: () => {},
        remove: () => {}
      },
      offsetParent: {}
    };

    const mockModalConfirmOkBtn = {
      id: 'btnNotWorkingConfirmOk',
      tagName: 'BUTTON',
      textContent: 'OK',
      click: () => {
        modalConfirmClicks++;
      },
      closest: (sel) => sel.includes('Modal') || sel.includes('modal') ? mockModal : null,
      offsetParent: {}
    };

    const bCtx = vm.createContext({
      console: { log: () => {}, warn: () => {}, error: () => {} },
      window: { location: { href: 'https://example.com/dataextraction' }, addEventListener: () => {} },
      document: {
        readyState: 'complete',
        body: { appendChild: () => {}, querySelectorAll: () => [] },
        head: { appendChild: () => {} },
        title: 'Test Portal',
        createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {} }, addEventListener: () => {}, setAttribute: () => {}, appendChild: () => {} }),
        getElementById: (id) => {
          if (id === 'website-name' || id === 'inputWebsiteName') return mockWebsiteInput;
          if (id === 'website-status' || id === 'selectWebsiteStatus') return mockStatusSelect;
          if (id === 'btnSubmitForm' || id === 'btnSubmit') return mockSubmitBtn;
          if (id === 'btnLoadNextQueueUrl' || id === 'btnNextQueue') return mockFromQueueBtn;
          if (id === 'btnNotWorkingConfirmOk') return mockModalConfirmOkBtn;
          if (id === 'notWorkingConfirmModal') return mockModal;
          if (id === 'ai-batch-10-btn') return mockBatch10Btn;
          if (id === 'ai-batch-all-btn') return mockBatchAllBtn;
          return null;
        },
        querySelector: (sel) => {
          if (sel.includes('website')) return mockWebsiteInput;
          if (sel.includes('status')) return mockStatusSelect;
          if (sel.includes('submit')) return mockSubmitBtn;
          if (sel.includes('btnNotWorkingConfirmOk') || sel.includes('confirm-ok')) return mockModalConfirmOkBtn;
          return null;
        },
        querySelectorAll: (sel) => {
          if (sel === 'select') return [mockStatusSelect];
          if (sel && sel.includes('input')) return [mockWebsiteInput];
          return [mockWebsiteInput, mockStatusSelect, mockSubmitBtn, mockFromQueueBtn, mockModalConfirmOkBtn];
        },
        addEventListener: () => {}
      },
      chrome: {
        runtime: {
          id: 'test-ext',
          onMessage: { addListener: () => {} },
          sendMessage: (_, cb) => cb && cb({ success: true })
        },
        storage: {
          sync: { get: (_, cb) => cb && cb({ autoQueueEnabled: false, autoSubmitNotWorkingEnabled: false }), set: () => {} },
          local: {
            get: (keys, cb) => {
              const res = {};
              if (keys.includes('batchNotWorking') && storedBatch) res.batchNotWorking = storedBatch;
              cb(res);
            },
            set: (data) => {
              if (data.batchNotWorking) storedBatch = data.batchNotWorking;
            },
            remove: (keys) => {
              if (keys.includes('batchNotWorking')) storedBatch = null;
            }
          },
          onChanged: { addListener: () => {} }
        }
      },
      setTimeout: (fn) => { fn(); return 1; },
      clearTimeout: () => {},
      setInterval: () => 1,
      clearInterval: () => {},
      Event: function () {},
      URL,
      MutationObserver: function () { return { observe: () => {} }; }
    });
    bCtx.globalThis = bCtx;

    for (const rel of files) {
      const abs = path.join(rootDir, rel);
      vm.runInContext(fs.readFileSync(abs, 'utf8'), bCtx, { filename: rel });
    }

    const ext = bCtx.__AI_EXTENSION__;
    assert.ok(typeof ext.startBatchNotWorking === 'function', 'startBatchNotWorking must be defined');
    assert.ok(typeof ext.stopBatchNotWorking === 'function', 'stopBatchNotWorking must be defined');
    assert.ok(typeof ext.processNextBatchNotWorkingItem === 'function', 'processNextBatchNotWorkingItem must be defined');
    assert.ok(typeof ext.autoSubmitNotWorking === 'function', 'autoSubmitNotWorking must be defined');
    assert.ok(typeof ext.findSubmitButton === 'function', 'findSubmitButton must be defined');

    // 1. Verify findSubmitButton detects the mock portal submit button
    const foundSubmit = ext.findSubmitButton();
    assert.strictEqual(foundSubmit, mockSubmitBtn, 'findSubmitButton must return portal submit button');

    // 2. Start Batch 10 Not Working
    ext.startBatchNotWorking(10);
    assert.strictEqual(ext.state.isBatchNotWorkingActive, true, 'Batch Not Working must be active');
    // First item processed immediately: remaining decremented to 9, submit clicked
    assert.strictEqual(submittedCount, 1, 'First item must have auto-submitted');
    assert.strictEqual(ext.state.batchNotWorkingRemaining, 9, 'Remaining count must decrement to 9');
    assert.ok(storedBatch && storedBatch.active && storedBatch.remaining === 9, 'Storage must persist 9 remaining');

    // 3. Process remaining 9 items through loop
    for (let i = 9; i > 0; i--) {
      ext.processNextBatchNotWorkingItem();
    }

    // 4. Verify all 10 submissions completed and state cleanly reset
    assert.strictEqual(submittedCount, 10, 'Must have auto-submitted exactly 10 sites as Not Working');
    assert.ok(modalConfirmClicks >= 10, `Must have auto-confirmed Not Working modal (confirmed ${modalConfirmClicks} times)`);
    assert.strictEqual(ext.state.isBatchNotWorkingActive, false, 'Batch must cleanly stop after 10 sites');
    assert.strictEqual(storedBatch, null, 'Storage must be cleaned up after batch finishes');
  });
}

runAsyncTests().then(() => {
  console.log('\n========================================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
});
