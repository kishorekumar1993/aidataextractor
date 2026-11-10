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
const ctx = vm.createContext({
  URL,
  chrome: {
    runtime: { onMessage: { addListener: () => {} } },
    storage: { sync: { get: async () => ({}) } }
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

// 9. Product Metrics Synchronization (Own crawl only — ignores Gemini and keeps all 3 identical)
runTest('Product items use own crawl only (ignores Gemini) and keep all 3 fields identical', () => {
  const aiDataWithBadZero = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Test Manufacturing Ltd",
    numberOfProducts: "0",
    productImages: "1",
    numberOfProductDescriptions: "2"
  };
  const crawlWithThree = {
    detectedProductCount: 2,
    detectedImageCount: 3,
    detectedDescCount: 1
  };
  const res = ctx.applyStrictInstructions(aiDataWithBadZero, crawlWithThree, {});
  assert.strictEqual(res.productImages, "3", "productImages must use own crawl (3), ignoring Gemini (1)");
  assert.strictEqual(res.numberOfProducts, "3", "numberOfProducts must match own crawl (3)");
  assert.strictEqual(res.numberOfProductDescriptions, "3", "numberOfProductDescriptions must match own crawl (3)");

  const aiDataWithOvercount = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Test One Product Ltd",
    numberOfProducts: "3",
    productImages: "3",
    numberOfProductDescriptions: "3"
  };
  const resOne = ctx.applyStrictInstructions(aiDataWithOvercount, { detectedImageCount: 1, detectedProductCount: 0, detectedDescCount: 0 }, {});
  assert.strictEqual(resOne.productImages, "1", "productImages must use own crawl (1), ignoring Gemini (3)");
  assert.strictEqual(resOne.numberOfProducts, "1", "numberOfProducts must match own crawl (1)");
  assert.strictEqual(resOne.numberOfProductDescriptions, "1", "numberOfProductDescriptions must match own crawl (1)");

  const resZero = ctx.applyStrictInstructions(aiDataWithOvercount, { detectedImageCount: 0, detectedProductCount: 0, detectedDescCount: 0 }, {});
  assert.strictEqual(resZero.productImages, "0", "productImages uses own crawl (0)");
  assert.strictEqual(resZero.numberOfProducts, "0", "numberOfProducts mirrors 0");
  assert.strictEqual(resZero.numberOfProductDescriptions, "0", "numberOfProductDescriptions mirrors 0");
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

  // Test applyStrictInstructions with buggy bare output
  const buggyAiData = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Yi Shyang Machinery Company, Limited",
    countryName: "Taiwan",
    companyAddress: "228 Baoshun Road, East District, Chiayi City",
    productImages: "3"
  };
  const crawlData = {
    country: "Taiwan",
    addressCandidates: [
      { raw: "No.228, Pao Shun Road, Hoo Hu Li, Chia Yi City, 60079, Taiwan, R.O.C.", source: "contact" },
      { raw: "嘉義市東區後湖里保順路228號", source: "map" }
    ]
  };
  const res = ctx.applyStrictInstructions(buggyAiData, crawlData, {});
  assert.strictEqual(
    res.companyAddress,
    "Number 228, Baoshun Road, Houhu Village, East District, Chiayi City",
    "Company address must restore Number prefix and Houhu Village"
  );
  assert.strictEqual(res.state, "Not Available", "Taiwan provincial city has State Not Available");
  assert.strictEqual(res.city, "Available", "Chiayi City is Available");
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

// 19. State and City strictly enforce instruction sheet rules in AI mode (suburbs never allowed; missing state never invented)
runTest('State and City enforce instruction sheet rules in AI mode (reject suburbs, require written state)', () => {
  const aiSuburbCase = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Global Example Ltd",
    countryName: "Australia",
    companyAddress: "Building 2, 1090 Centre Road, Oakleigh South, Victoria",
    state: "Available",
    city: "Available",
    productImages: "3"
  };
  const res1 = ctx.applyStrictInstructions(aiSuburbCase, {}, {});
  assert.strictEqual(res1.state, "Available", "Victoria in address must keep state=Available");
  assert.strictEqual(res1.city, "Not Available", "Suburb Oakleigh South must be overridden to city=Not Available even if Gemini says Available");

  const aiUnknownSuburb = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Sample Co Ltd",
    countryName: "Australia",
    companyAddress: "40 Sample Road, Unknown Suburb",
    state: "Available",
    city: "Available",
    productImages: "3"
  };
  const resUnknown = ctx.applyStrictInstructions(aiUnknownSuburb, {}, {});
  assert.strictEqual(resUnknown.state, "Not Available", "No state written in address must be overridden to state=Not Available");
  assert.strictEqual(resUnknown.city, "Not Available", "Unknown Suburb must be overridden to city=Not Available");

  const aiMissedCityState = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Melbourne Example Ltd",
    countryName: "Australia",
    companyAddress: "123 Collins Street, Melbourne, Victoria",
    state: "Not Available",
    city: "Not Available",
    productImages: "3"
  };
  const res2 = ctx.applyStrictInstructions(aiMissedCityState, {}, {});
  assert.strictEqual(res2.state, "Available", "Victoria in address must be fixed to state=Available");
  assert.strictEqual(res2.city, "Available", "Melbourne in address must be fixed to city=Available");

  const aiSuburbVillage = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "NZ Example Ltd",
    countryName: "New Zealand",
    companyAddress: "15 Penrose Road, Penrose",
    state: "Available",
    city: "Available",
    productImages: "3"
  };
  const resNz = ctx.applyStrictInstructions(aiSuburbVillage, {}, {});
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
  assert.strictEqual(aiCleanShort.companyName, "Mechatronic Engineering Spółka Z Ograniczoną Odpowiedzialnością");
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

console.log('\n========================================================');
console.log(`Results: ${passed} Passed, ${failed} Failed`);
console.log('========================================================');

if (failed > 0) {
  process.exit(1);
}
