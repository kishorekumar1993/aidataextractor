const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

console.log('========================================================');
console.log('     AI DATA ENTRY ASSISTANT - REGRESSION TEST SUITE    ');
console.log('========================================================\n');

// Load background.js in VM
const bgCode = fs.readFileSync('background.js', 'utf8');
const ctx = vm.createContext({
  URL,
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

// 9. Product Metrics Synchronization (Image Product mirrors to Number of Product and No. of Product Description)
runTest('Image Product mirrors to Number of Product and No. of Product Description', () => {
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
  assert.strictEqual(res.productImages, "3", "productImages must stay 3");
  assert.strictEqual(res.numberOfProducts, "3", "numberOfProducts must match productImages (3)");
  assert.strictEqual(res.numberOfProductDescriptions, "3", "numberOfProductDescriptions must match productImages (3)");

  const zeroData = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Test Service Ltd",
    numberOfProducts: "3",
    productImages: "0",
    numberOfProductDescriptions: "2"
  };
  const resZero = ctx.applyStrictInstructions(zeroData, {}, {});
  assert.strictEqual(resZero.productImages, "0", "productImages is 0");
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

// 19. State and City strictly trust Gemini AI values directly (no local crawler override)
runTest('State and City use Gemini API returned values directly in AI mode', () => {
  const aiCase1 = {
    _isFromAi: true,
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyName: "Global Example Ltd",
    countryName: "Australia",
    companyAddress: "40 Sample Road, Unknown Suburb",
    state: "Available",
    city: "Available",
    productImages: "3"
  };
  const res1 = ctx.applyStrictInstructions(aiCase1, {}, {});
  assert.strictEqual(res1.state, "Available", "Must preserve Gemini's state=Available even if local regex wouldn't find it");
  assert.strictEqual(res1.city, "Available", "Must preserve Gemini's city=Available without local override");

  const aiCase2 = {
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
  const res2 = ctx.applyStrictInstructions(aiCase2, {}, {});
  assert.strictEqual(res2.state, "Not Available", "Must preserve Gemini's state=Not Available");
  assert.strictEqual(res2.city, "Not Available", "Must preserve Gemini's city=Not Available");
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

console.log('\n========================================================');
console.log(`Results: ${passed} Passed, ${failed} Failed`);
console.log('========================================================');

if (failed > 0) {
  process.exit(1);
}
