const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('========================================================');
console.log('  REVIEW ITEMS (66-77) REGRESSION & VERIFICATION SUITE  ');
console.log('========================================================\n');

const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
  }
}

// Setup sandbox environment
function createTestContext(customFetch) {
  let mockLocalStorage = {};
  const ctx = vm.createContext({
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: customFetch || (async () => { throw new Error('fetch not mocked'); }),
    chrome: {
      runtime: { onMessage: { addListener: () => {} }, sendMessage: () => {} },
      storage: {
        sync: { get: async () => ({}), set: async () => {} },
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
          set: async (obj) => { Object.assign(mockLocalStorage, obj); },
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
      const p = path.resolve(rootDir, file);
      const code = fs.readFileSync(p, 'utf8');
      vm.runInContext(code, ctx, { filename: file });
    }
  };

  // Load background.js dependencies
  const bgCode = fs.readFileSync(path.join(rootDir, 'background.js'), 'utf8');
  vm.runInContext(bgCode, ctx, { filename: 'background.js' });

  return { ctx, getLocalStorage: () => mockLocalStorage };
}

async function runAll() {
  // =========================================================================
  // Item 66: Test a slow website (28-second timeout -> Manual Review / Retry Required, NOT Not Working)
  // =========================================================================
  await runAsyncTest('Item 66: Slow website timeout produces Manual Review, not Not Working', async () => {
    const { ctx } = createTestContext();
    const crawlData = {
      status: "Manual Review",
      requiresManualReview: true,
      retryRequired: true,
      timedOut: true,
      reason: "Website response timed out after 28 seconds (Rule 1 safeguard)",
      pages: []
    };

    const restrictedCheck = { isRestricted: false };
    const timeoutResult = ctx.applyStrictInstructions({}, crawlData, restrictedCheck);

    assert.strictEqual(timeoutResult.websiteStatus, 'Manual Review', 'Status must be Manual Review on timeout');
    assert.strictEqual(timeoutResult.retryRequired, true, 'retryRequired must be true');
    assert.strictEqual(timeoutResult.requiresManualReview, true, 'requiresManualReview must be true');
    assert.notStrictEqual(timeoutResult.websiteStatus, 'Not Working', 'Must NOT be classified as Not Working');

    // Verify error recorder excludes it
    const recResult = await ctx.recordNonWorkingWebsite(timeoutResult);
    assert.strictEqual(recResult.ignored, true, 'Timeout must be ignored by error recorder');
  });

  // =========================================================================
  // Item 67: Test a dead website (DNS failure/404 -> confirmed Not Working / Domain Expired)
  // =========================================================================
  await runAsyncTest('Item 67: Dead website produces confirmed Not Working / Domain Expired and records to Excel', async () => {
    const { ctx, getLocalStorage } = createTestContext();
    const crawlData = {
      status: "Not Working",
      reason: "DNS lookup failed / domain expired (ENOTFOUND)",
      isDomainExpired: true,
      errorUrl: "https://dead-expired-domain-12345.com",
      pages: []
    };

    const deadResult = ctx.applyStrictInstructions({}, crawlData, { isRestricted: false });

    assert.strictEqual(deadResult.websiteStatus, 'Domain Expired', 'Status must be Domain Expired or Not Working for expired domain');
    assert.strictEqual(deadResult.errorKeyword, 'Domain Expired', 'Error keyword must be Domain Expired');

    // Verify error recorder saves it
    const recResult = await ctx.recordNonWorkingWebsite(deadResult);
    assert.strictEqual(recResult.success, true, 'Dead site must be persisted in error dataset');
    const storage = getLocalStorage();
    const storedList = storage[ctx.NON_WORKING_STORAGE_KEY];
    assert.ok(Array.isArray(storedList), 'Storage must have nonWorkingRecords');
    assert.strictEqual(storedList.length, 1, 'Should record exactly 1 non-working record');
    assert.strictEqual(storedList[0]['Website Status'], 'Not Working');
    assert.strictEqual(storedList[0]['Error Keyword'], 'Domain Expired');
  });

  // =========================================================================
  // Item 68: Test a blocked website (HTTP 401, 403, 429, Cloudflare challenge -> Not Working)
  // =========================================================================
  await runAsyncTest('Item 68: HTTP 403 / Cloudflare challenge produces Not Working and records to error dataset', async () => {
    const { ctx } = createTestContext();
    const blockedCrawl = {
      status: 'Not Working',
      isBlocked: true,
      requiresManualReview: false,
      reason: 'Site access restricted / blocked (HTTP 403 Security Check / Anti-bot)',
      errorKeyword: 'Security Check / Anti-bot',
      finalUrl: 'https://protected-site.com',
      pages: []
    };

    const evaluated = ctx.applyStrictInstructions({}, blockedCrawl, { isRestricted: false });
    assert.strictEqual(evaluated.websiteStatus, 'Not Working', 'Status must be Not Working');
    assert.strictEqual(evaluated.isBlocked, true, 'isBlocked must be true');
    assert.strictEqual(evaluated.requiresManualReview, false, 'requiresManualReview must be false');
    assert.strictEqual(evaluated.companyName, '', 'All 13 fields must be empty for Not Working');

    // Error recorder must record blocked site
    const recResult = await ctx.recordNonWorkingWebsite(evaluated);
    assert.strictEqual(recResult.success, true, 'Blocked site must be recorded in error records');
    assert.strictEqual(recResult.record['Website Status'], 'Not Working', 'Status in record must be Not Working');
  });

  // =========================================================================
  // Item 69: Test redirected website (Cross-domain -> Redirect Site, same-domain -> Working)
  // =========================================================================
  runTest('Item 69: Redirected website classifies as Redirect Site on cross-domain redirect', () => {
    const { ctx } = createTestContext();
    const isCross1 = ctx.isRedirectDomain('https://company-old.com', 'https://company-new.com');
    assert.strictEqual(isCross1, true, 'Different domains must be cross-domain redirect');

    const isCross2 = ctx.isRedirectDomain('http://example.com', 'https://www.example.com/en/home');
    assert.strictEqual(isCross2, false, 'Same domain with protocol/path change is NOT cross-domain');
  });

  // =========================================================================
  // Item 70: Test 5-page crawl budget enforcement
  // =========================================================================
  await runAsyncTest('Item 70: Five-page maximum crawl limit is strictly enforced', async () => {
    let fetchCount = 0;
    const mockHtml = `
      <html>
        <head><title>Test Factory Co., Ltd.</title></head>
        <body>
          <a href="/contact">Contact</a>
          <a href="/about">About</a>
          <a href="/products">Products</a>
          <a href="/products/p1">P1</a>
          <a href="/products/p2">P2</a>
          <a href="/products/p3">P3</a>
          <a href="/products/p4">P4</a>
          <a href="/products/p5">P5</a>
          <p>We manufacture industrial equipment. 100 Main Street, City, State.</p>
        </body>
      </html>
    `;

    const mockFetch = async (url) => {
      fetchCount++;
      return {
        ok: true,
        status: 200,
        headers: {
          get: (h) => (h.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null)
        },
        arrayBuffer: async () => Buffer.from(mockHtml, 'utf8')
      };
    };

    const { ctx } = createTestContext(mockFetch);
    const crawlResult = await ctx.crawlWebsite('https://factory-test.com', { maxPages: 5 });
    assert.ok(fetchCount <= 5, `Total fetch requests (${fetchCount}) must not exceed 5`);
    assert.ok(crawlResult.pagesFetchedCount <= 5, `crawlResult.pagesFetchedCount (${crawlResult.pagesFetchedCount}) must not exceed 5`);
  });

  // =========================================================================
  // Item 71: Test duplicate URLs normalization and deduplication
  // =========================================================================
  runTest('Item 71: Duplicate URLs are normalized and deduplicated', () => {
    const { ctx } = createTestContext();
    const u1 = ctx.normalizeCrawlUrl('https://example.com/about/', 'https://example.com');
    const u2 = ctx.normalizeCrawlUrl('https://example.com/about#team', 'https://example.com');
    const u3 = ctx.normalizeCrawlUrl('/about', 'https://example.com');

    assert.strictEqual(u1, 'https://example.com/about');
    assert.strictEqual(u2, 'https://example.com/about');
    assert.strictEqual(u3, 'https://example.com/about');
  });

  // =========================================================================
  // Item 72: Website-Wide Strict Restriction Validation (14 Required Scenarios)
  // Official Policy: Distinguish genuine prohibited category operations from
  // unrelated contextual mentions (equipment for food plants, chemical tanks,
  // hospital lighting, adult education/legal age, titanium bolts for aircraft).
  // =========================================================================
  runTest('Item 72.1: Genuine restricted business on homepage -> Reject (Category 1: Adult/Porn)', () => {
    const { ctx } = createTestContext();
    const text = 'Welcome to Adult Entertainment Zone. High quality adult media and videos.';
    const check = ctx.detectRestrictedKeywords(text, '', [{ url: 'https://example.com', text }]);
    assert.strictEqual(check.isRestricted, true);
    assert.strictEqual(check.classification, 'GENUINE_RESTRICTED');
  });

  runTest('Item 72.2: Genuine restricted business on About Us -> Reject (Category 2: Medicine/Medical)', () => {
    const { ctx } = createTestContext();
    const check = ctx.detectRestrictedKeywords('Medical Health Clinic', '', [
      { url: 'https://example.com', text: 'Medical Health Clinic' },
      { url: 'https://example.com/about', text: 'Our company was founded by medical physicians and doctors providing patient hospital care.' }
    ]);
    assert.strictEqual(check.isRestricted, true);
    assert.strictEqual(check.category, 'Medicine, Medical & Hospital');
  });

  runTest('Item 72.3: Contextual mention in footer (equipment for chemical plants) -> Permitted (Working)', () => {
    const { ctx } = createTestContext();
    const html = '<html><body><div>Precision Lathes</div><footer>Supplying equipment for chemical and petrochemical plants.</footer></body></html>';
    const check = ctx.detectRestrictedKeywords('Precision Lathes', html, [{ url: 'https://example.com', html, text: 'Precision Lathes' }]);
    assert.strictEqual(check.isRestricted, false, 'Industrial equipment for chemical plants is permitted');
  });

  runTest('Item 72.3b: Genuine prohibited chemical supplier -> Reject (Category 8: Chemicals)', () => {
    const { ctx } = createTestContext();
    const text = 'Bulk industrial chemicals, petrochemical solvents, and agrochemicals distribution.';
    const check = ctx.detectRestrictedKeywords(text, '', [{ url: 'https://example.com', text }]);
    assert.strictEqual(check.isRestricted, true);
    assert.strictEqual(check.category, 'Chemicals & Petrochemicals');
  });

  runTest('Item 72.4: Contextual mention in testimonial (bolts for military aircraft) -> Permitted (Working)', () => {
    const { ctx } = createTestContext();
    const text = 'Customer Testimonial: These machined titanium bolts perform flawlessly on our military aircraft.';
    const check = ctx.detectRestrictedKeywords(text, '', [{ url: 'https://example.com/testimonials', text }]);
    assert.strictEqual(check.isRestricted, false, 'Hardware fasteners applied in aircraft are permitted');
  });

  runTest('Item 72.4b: Genuine military armaments business -> Reject (Category 5: Defence)', () => {
    const { ctx } = createTestContext();
    const text = 'Defense contractor producing tactical armaments and military artillery systems.';
    const check = ctx.detectRestrictedKeywords(text, '', [{ url: 'https://example.com', text }]);
    assert.strictEqual(check.isRestricted, true);
    assert.strictEqual(check.category, 'Defence & Military');
  });

  runTest('Item 72.5: Restricted business in blog/news page -> Reject (Category 9: Alcohol & Breweries)', () => {
    const { ctx } = createTestContext();
    const check = ctx.detectRestrictedKeywords('Stainless Tank Fabricators', '', [
      { url: 'https://example.com', text: 'Stainless Tank Fabricators' },
      { url: 'https://example.com/blog/craft-brewery-visit', text: 'Our company operates a local craft beer brewery in Dublin.' }
    ]);
    assert.strictEqual(check.isRestricted, true);
    assert.strictEqual(check.category, 'Alcohol & Breweries');
  });

  runTest('Item 72.6: Contextual mention in FAQ (enclosure safe for animals) -> Permitted (Working)', () => {
    const { ctx } = createTestContext();
    const check = ctx.detectRestrictedKeywords('Fencing Systems', '', [
      { url: 'https://example.com', text: 'Fencing Systems' },
      { url: 'https://example.com/faq', text: 'Q: Is this enclosure safe for farm animals and pets? A: Yes.' }
    ]);
    assert.strictEqual(check.isRestricted, false, 'Fencing enclosure safety mention is permitted');
  });

  runTest('Item 72.6b: Genuine live animal sales -> Reject (Category 10: Animals & Pets)', () => {
    const { ctx } = createTestContext();
    const check = ctx.detectRestrictedKeywords('Pet Kingdom', '', [
      { url: 'https://example.com', text: 'Pet Kingdom' },
      { url: 'https://example.com/pets', text: 'Purebred puppies and kittens available for adoption at our pet store.' }
    ]);
    assert.strictEqual(check.isRestricted, true);
    assert.strictEqual(check.category, 'Animals & Pets');
  });

  runTest('Item 72.7: Contextual mention in privacy/terms (legal adult age) -> Permitted (Working)', () => {
    const { ctx } = createTestContext();
    const check = ctx.detectRestrictedKeywords('Standard Tools Corp', '', [
      { url: 'https://example.com', text: 'Standard Tools Corp' },
      { url: 'https://example.com/terms', text: 'Terms of service: You must be an adult of legal age to browse this site.' }
    ]);
    assert.strictEqual(check.isRestricted, false, 'Terms of service adult disclaimer is permitted');
  });

  runTest('Item 72.7b: Genuine adult entertainment -> Reject (Category 1: Adult)', () => {
    const { ctx } = createTestContext();
    const check = ctx.detectRestrictedKeywords('Erotic Video Network', '', [
      { url: 'https://example.com', text: 'Erotic Video Network' },
      { url: 'https://example.com/videos', text: 'Exclusive adult toys, erotica, and uncensored adult videos.' }
    ]);
    assert.strictEqual(check.isRestricted, true);
    assert.strictEqual(check.category, 'Adult & Porn');
  });

  runTest('Item 72.8: Contextual mention in product description (conveyors for food plants) -> Permitted (Working)', () => {
    const { ctx } = createTestContext();
    const text = 'Model F-200: Industrial conveyor systems designed specifically for food processing plants.';
    const check = ctx.detectRestrictedKeywords(text, '', [{ url: 'https://example.com/products/f200', text }]);
    assert.strictEqual(check.isRestricted, false, 'Conveyor equipment for food plants is permitted');
  });

  runTest('Item 72.8b: Genuine food manufacturer/bakery -> Reject (Category 3: Food)', () => {
    const { ctx } = createTestContext();
    const text = 'Artisan bakery producing gourmet breads, pastries, and confectionery food products.';
    const check = ctx.detectRestrictedKeywords(text, '', [{ url: 'https://example.com', text }]);
    assert.strictEqual(check.isRestricted, true);
    assert.strictEqual(check.category, 'Food & Beverages');
  });

  runTest('Item 72.9: Restricted word in image alt/title/src -> Reject (Category 4: Weapons/Knives & 2: Hospital)', () => {
    const { ctx } = createTestContext();
    const html = '<html><body><h1>Machining Capabilities</h1><img src="/images/medical-drill.jpg" alt="surgical knife" title="hospital equipment" /></body></html>';
    const check = ctx.detectRestrictedKeywordsSingle('Machining Capabilities', html, 'https://example.com/gallery');
    assert.strictEqual(check.isRestricted, true);
  });

  runTest('Item 72.10: Contextual mention in crawled page (gantry for ship maintenance) -> Permitted (Working)', () => {
    const { ctx } = createTestContext();
    const check = ctx.detectRestrictedKeywords('Heavy Cranes Ltd', '', [
      { url: 'https://example.com', text: 'Heavy Cranes Ltd' },
      { url: 'https://example.com/industries/marine', text: 'Overhead gantry systems for ship maintenance.' }
    ]);
    assert.strictEqual(check.isRestricted, false, 'Gantry systems are permitted');
  });

  runTest('Item 72.10b: Genuine shipyard shipbuilding -> Reject (Category 7: Marine/Ships)', () => {
    const { ctx } = createTestContext();
    const check = ctx.detectRestrictedKeywords('Seaway Shipbuilders Ltd', '', [
      { url: 'https://example.com', text: 'Seaway Shipbuilders Ltd' },
      { url: 'https://example.com/shipbuilding', text: 'Full-service shipyard constructing commercial passenger vessels, ferries, and ships.' }
    ]);
    assert.strictEqual(check.isRestricted, true);
  });

  runTest('Item 72.11: "ownership" containing substring "ship" -> Do NOT reject for "ship"', () => {
    const { ctx } = createTestContext();
    const text = 'Celebrating 40 years of continuous family ownership and dedicated partnership in metal fabrication.';
    const check = ctx.detectRestrictedKeywords(text, '', [{ url: 'https://example.com/about', text }]);
    assert.strictEqual(check.isRestricted, false, '"ownership" and "partnership" must NOT trigger the "ship" rule');
  });

  runTest('Item 72.12: No restricted words or images found -> Continue existing QC', () => {
    const { ctx } = createTestContext();
    const text = 'Apex Precision Machining. We manufacture high-precision CNC steel brackets, gears, and fasteners.';
    const check = ctx.detectRestrictedKeywords(text, '', [{ url: 'https://apex-machining.com', text }]);
    assert.strictEqual(check.isRestricted, false);

    const crawlData = {
      originalUrl: 'https://apex-machining.com',
      finalUrl: 'https://apex-machining.com',
      mainHtml: '<html><body><p>' + text + '</p></body></html>',
      crawledPages: [{ url: 'https://apex-machining.com', text }]
    };
    const qcResult = ctx.applyStrictInstructions({
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyName: 'Apex Precision Machining Limited',
      countryName: 'United Kingdom',
      companyAddress: 'Unit 4, Industrial Park, Heanor, Derbyshire',
      phoneNumber: '1773531111',
      numberOfProducts: '3',
      productImages: '3',
      numberOfProductDescriptions: '3'
    }, crawlData, check);

    assert.strictEqual(qcResult.websiteStatus, 'Working', 'Clean site must proceed with existing QC');
    assert.strictEqual(qcResult.isRestricted, false);
    assert.strictEqual(qcResult.companyName, 'Apex Precision Machining Limited');
  });

  runTest('Item 72.13: Temporary crawl failure -> Do not classify as restricted', () => {
    const { ctx } = createTestContext();
    const crawlData = {
      status: 'Manual Review',
      requiresManualReview: true,
      retryRequired: true,
      timedOut: true,
      originalUrl: 'https://slowsite.com',
      finalUrl: 'https://slowsite.com',
      fetchError: 'ETIMEDOUT',
      timeoutMs: 30000,
      reason: 'Website response timed out after 30 seconds',
      mainHtml: '',
      bodyText: ''
    };
    const restrictedCheck = ctx.detectRestrictedKeywords('', '', []);
    assert.strictEqual(restrictedCheck.isRestricted, false);

    const result = ctx.applyStrictInstructions({}, crawlData, restrictedCheck);
    assert.strictEqual(result.isRestricted, false, 'Timeout failure must NOT be classified as restricted');
    assert.strictEqual(result.websiteStatus, 'Manual Review', 'Timeout failure must be Manual Review');
  });

  runTest('Item 72.14: Manufacturer with permitted online selling -> Preserve manufacturer exception (Rules 11 & 16)', () => {
    const { ctx } = createTestContext();
    const crawlData = {
      originalUrl: 'https://customfab.com',
      finalUrl: 'https://customfab.com',
      mainHtml: '<html><body><h1>Custom Fabrication Inc</h1><p>We manufacture custom aluminum enclosures in our factory. Add to Cart available for standard sizes.</p><button>Add to Cart</button></body></html>',
      bodyText: 'Custom Fabrication Inc. We manufacture custom aluminum enclosures in our factory. Add to Cart available for standard sizes.',
      shopCartCheck: { detected: true, reason: 'Add to Cart button found' },
      isShopCartSite: true,
      crawledPages: [{ url: 'https://customfab.com', text: 'We manufacture custom aluminum enclosures in our factory.' }]
    };
    const check = ctx.detectRestrictedKeywords(crawlData.bodyText, crawlData.mainHtml, crawlData.crawledPages);
    assert.strictEqual(check.isRestricted, false);

    const qcResult = ctx.applyStrictInstructions({
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyName: 'Custom Fabrication Incorporated',
      countryName: 'United States Of America',
      companyAddress: '100 Industrial Parkway, Chicago, Illinois',
      phoneNumber: '3125550199',
      numberOfProducts: '3',
      productImages: '3',
      numberOfProductDescriptions: '3'
    }, crawlData, check);

    assert.strictEqual(qcResult.websiteStatus, 'Working', 'Manufacturer with shopping cart is permitted (Rules 11 & 16 exception)');
    assert.strictEqual(qcResult.businessType, 'Manufacturer');
    assert.strictEqual(qcResult.isRestricted, false);
  });

  runTest('Item 72.15: Non-manufacturer retailer with shopping cart -> Reject as Not Working', () => {
    const { ctx } = createTestContext();
    const crawlData = {
      originalUrl: 'https://consumer-retail.com',
      finalUrl: 'https://consumer-retail.com',
      mainHtml: '<html><body><h1>Super Gadgets Retail</h1><p>Online store with direct checkout.</p><button>Add to Cart</button></body></html>',
      bodyText: 'Super Gadgets Retail. Online store with direct checkout. Add to Cart. Price $19.99.',
      shopCartCheck: { detected: true, reason: 'Add to Cart button found' },
      isShopCartSite: true,
      crawledPages: [{ url: 'https://consumer-retail.com', text: 'Online store with direct checkout.' }]
    };
    const check = ctx.detectRestrictedKeywords(crawlData.bodyText, crawlData.mainHtml, crawlData.crawledPages);
    assert.strictEqual(check.isRestricted, false);

    const qcResult = ctx.applyStrictInstructions({
      websiteStatus: 'Working',
      businessType: 'Trader',
      companyName: 'Super Gadgets Retail Limited',
      countryName: 'United States Of America',
      companyAddress: '100 Market St, San Francisco, CA',
      phoneNumber: '4155550100',
      numberOfProducts: '3',
      productImages: '3',
      numberOfProductDescriptions: '3'
    }, crawlData, check);

    assert.strictEqual(qcResult.websiteStatus, 'Not Working', 'Non-manufacturer retailer with cart must be Not Working');
  });

  runTest('Item 72.16: Supplier with 0 displayed products -> Classify as Supplier with count 0 & Working status', () => {
    const { ctx } = createTestContext();
    const crawlData = {
      originalUrl: 'https://raw-alloys-supplier.com',
      finalUrl: 'https://raw-alloys-supplier.com',
      mainHtml: '<html><body><h1>Raw Alloys Supply Corp</h1><p>Supplier of industrial metals, ingots, and alloys upon enquiry.</p><footer>Address: 50 Metal Way, Birmingham, UK. Tel: +44 121 555 1234</footer></body></html>',
      bodyText: 'Raw Alloys Supply Corp. Supplier of industrial metals, ingots, and alloys upon enquiry. Address: 50 Metal Way, Birmingham, UK. Tel: +44 121 555 1234',
      crawledPages: [{ url: 'https://raw-alloys-supplier.com', text: 'Raw Alloys Supply Corp. Supplier of industrial metals, ingots, and alloys upon enquiry.' }],
      detectedProductCount: 0,
      detectedImageCount: 0,
      detectedDescCount: 0,
      emails: ['info@raw-alloys-supplier.com'],
      phones: ['+44 121 555 1234'],
      addressCandidates: [{ raw: '50 Metal Way, Birmingham, UK', priority: 1 }]
    };
    const check = ctx.detectRestrictedKeywords(crawlData.bodyText, crawlData.mainHtml, crawlData.crawledPages);
    assert.strictEqual(check.isRestricted, false);

    const extracted = ctx.heuristicExtraction(crawlData, check);
    assert.strictEqual(extracted.businessType, 'Supplier');
    assert.strictEqual(extracted.numberOfProducts, '0');
    assert.strictEqual(extracted.websiteStatus, 'Working', 'Supplier with 0 products is Working (eligible for Non-Paid submission)');
  });

  // =========================================================================
  // Item 74: Excel append over multiple sessions (preserves historical rows and prevents duplicate rows)
  // =========================================================================
  runTest('Item 74: Excel append preserves historical records and prevents duplicate rows', () => {
    const { ctx } = createTestContext();
    const existing = [
      { URL: 'https://site1.com', 'Website Status': 'Not Working', Reason: 'Dead link', Date: '2026-11-14', Time: '10:00:00' },
      { URL: 'https://site2.com', 'Website Status': 'Not Working', Reason: '404', Date: '2026-11-14', Time: '10:05:00' }
    ];

    const candidates = [
      { URL: 'https://site2.com', 'Website Status': 'Not Working', Reason: '404', Date: '2026-11-14', Time: '10:05:00' }, // duplicate
      { URL: 'https://site3.com', 'Website Status': 'Domain Expired', Reason: 'Expired', Date: '2026-11-14', Time: '10:10:00' } // new
    ];

    const { merged, addedCount } = ctx.mergeErrorRecords(existing, candidates);
    assert.strictEqual(addedCount, 1, 'Only 1 new record should be added');
    assert.strictEqual(merged.length, 3, 'Total records should be 3');
    assert.strictEqual(merged[2].URL, 'https://site3.com');
  });

  // =========================================================================
  // Item 75: Test queue halts after 20 attempts without duplicate submission
  // =========================================================================
  runTest('Item 75: Submission ledger blocks duplicate submissions', () => {
    const { ctx } = createTestContext();
    const state = { submissionLedger: new Set() };
    const recordSubmission = (url) => {
      state.submissionLedger.add(url.toLowerCase().trim().replace(/\/+$/, ''));
    };
    const isAlreadySubmitted = (url) => {
      return state.submissionLedger.has(url.toLowerCase().trim().replace(/\/+$/, ''));
    };

    recordSubmission('https://example.com/record1');
    assert.strictEqual(isAlreadySubmitted('https://example.com/record1/'), true, 'Should detect normalized duplicate');
    assert.strictEqual(isAlreadySubmitted('https://example.com/record2'), false, 'Should allow fresh record');
  });

  // =========================================================================
  // Item 76: No hardcoded company-specific data contamination
  // Verifies Laser Mechanisms and Natuzzi fixtures are NOT injected into results
  // =========================================================================
  runTest('Item 76: No hardcoded company-specific data contamination on redirected or minimal sites', () => {
    const { ctx } = createTestContext();

    // Case A: Redirect to lasermech domain with blank/minimal HTML
    const minimalLaserCrawl = {
      originalUrl: 'https://old-domain.com',
      finalUrl: 'https://lasermech.com',
      title: 'Laser Mech - Optical Solutions',
      mainHtml: '<html><body><h1>Optical Solutions</h1><p>Contact us online.</p></body></html>',
      bodyText: 'Optical Solutions. Contact us online.',
      crawledPages: [{ url: 'https://lasermech.com', text: 'Optical Solutions. Contact us online.' }],
      detectedProductCount: 0,
      detectedImageCount: 0,
      detectedDescCount: 0,
      emails: [],
      phones: [],
      addressCandidates: []
    };

    const laserExtracted = ctx.heuristicExtraction(minimalLaserCrawl, { isRestricted: false });
    // Verify no fabricated Laser Mechanisms phone, address, or product counts
    assert.notStrictEqual(laserExtracted.phoneNumber, '2484749480', 'Must not inject hardcoded phone (248) 474-9480');
    assert.notStrictEqual(laserExtracted.companyAddress, '25325 Regency Drive, Novi, Michigan 48375', 'Must not inject hardcoded Novi address');
    assert.strictEqual(laserExtracted.companyAddress, '', 'Missing address must remain empty string');
    assert.strictEqual(laserExtracted.phoneNumber, '', 'Missing phone must remain empty string');

    // Case B: Redirect to natuzzi domain with blank/minimal HTML
    const minimalNatuzziCrawl = {
      originalUrl: 'https://old-press.com',
      finalUrl: 'https://natuzzi.com',
      title: 'Natuzzi Design',
      mainHtml: '<html><body><h1>Design Portal</h1></body></html>',
      bodyText: 'Design Portal',
      crawledPages: [{ url: 'https://natuzzi.com', text: 'Design Portal' }],
      detectedProductCount: 0,
      detectedImageCount: 0,
      detectedDescCount: 0,
      emails: [],
      phones: [],
      addressCandidates: []
    };

    const natuzziExtracted = ctx.heuristicExtraction(minimalNatuzziCrawl, { isRestricted: false });
    assert.notStrictEqual(natuzziExtracted.emailId, 'info@natuzzi.com', 'Must not inject hardcoded email info@natuzzi.com');
    assert.notStrictEqual(natuzziExtracted.companyAddress, 'Via Iazzitiello 47, 70029 Santeramo in Colle, Bari', 'Must not inject hardcoded Santeramo address');
    assert.strictEqual(natuzziExtracted.emailId, '', 'Missing email must remain empty string');
    assert.strictEqual(natuzziExtracted.companyAddress, '', 'Missing address must remain empty string');

    // Apply strict QC and verify country and address remain unpolluted
    const qcResult = ctx.applyStrictInstructions(laserExtracted, minimalLaserCrawl, { isRestricted: false });
    assert.ok(!qcResult.companyAddress.includes('Regency Drive'), 'QC result must not contain Regency Drive');
    assert.ok(!qcResult.companyAddress.includes('Novi'), 'QC result must not contain Novi');
  });

  // =========================================================================
  // Item 77: Generic extraction uses actual website data & preserves missing info
  // =========================================================================
  runTest('Item 77: Generic extraction uses actual website data & preserves missing info', () => {
    const { ctx } = createTestContext();

    // Actual company with 1 product and verifiable address from HTML
    const realCrawl = {
      originalUrl: 'https://quantum-sensors.de',
      finalUrl: 'https://quantum-sensors.de',
      title: 'Quantum Sensors GmbH',
      mainHtml: `<html><body>
        <h1>Quantum Sensors GmbH</h1>
        <p>Manufacturer of high precision photon detectors.</p>
        <div class="product"><img src="detector.jpg" alt="Photon Detector 500" /><h3>Photon Detector 500</h3><p>Ultra sensitive sensor.</p></div>
        <footer><p>Quantum Sensors GmbH, Einsteinstrasse 10, 80331 Munich, Germany. Phone: +49 89 12345678</p></footer>
      </body></html>`,
      bodyText: 'Quantum Sensors GmbH. Manufacturer of high precision photon detectors. Photon Detector 500. Einsteinstrasse 10, 80331 Munich, Germany.',
      detectedProductCount: 1,
      detectedImageCount: 1,
      detectedDescCount: 1,
      emails: ['info@quantum-sensors.de'],
      phones: ['+49 89 12345678'],
      addressCandidates: [{ raw: 'Einsteinstrasse 10, 80331 Munich, Germany', priority: 1 }],
      crawledPages: [{ url: 'https://quantum-sensors.de', text: 'Quantum Sensors GmbH...' }]
    };

    const extracted = ctx.heuristicExtraction(realCrawl, { isRestricted: false });
    const qcResult = ctx.applyStrictInstructions(extracted, realCrawl, { isRestricted: false });

    // Verify actual data extracted from HTML
    assert.strictEqual(qcResult.websiteStatus, 'Working');
    assert.strictEqual(qcResult.companyName, 'Quantum Sensors Gesellschaft Mit Beschränkter Haftung');
    assert.strictEqual(qcResult.countryName, 'Germany');
    assert.strictEqual(qcResult.numberOfProducts, '1', 'Must reflect actual product count (1), not defaulted to 3');
    assert.strictEqual(qcResult.productImages, '1');
    assert.strictEqual(qcResult.numberOfProductDescriptions, '1');
    assert.strictEqual(qcResult.secondaryEmailId, '', 'Missing secondary email must remain empty');
  });

  // =========================================================================
  // Item 78: Strict 13 Restricted Categories Detection & Section 8 JSON Schema
  // =========================================================================
  runTest('Item 78: Strict 13 Restricted Categories Detection & Section 8 JSON Schema', () => {
    const { ctx } = createTestContext();

    const sample13Cases = [
      { id: 1, name: "Porn & Adult", text: "Adult entertainment store with adult movies and videos.", url: "https://adultzone.com" },
      { id: 2, name: "Medicine & Medical", text: "Wholesale distributor of pharmaceutical medicine products and medical supplies.", url: "https://medisupply.com" },
      { id: 3, name: "Hospital & Healthcare", text: "Private hospital and outpatient healthcare clinic offering diagnostic care.", url: "https://cityhospital.com" },
      { id: 4, name: "Food", text: "Commercial bakery manufacturing bread and food products.", url: "https://bestbakery.com" },
      { id: 5, name: "Weapons & Knives", text: "Custom manufacturer of tactical combat knives, folding knives, and daggers.", url: "https://bladeknives.com" },
      { id: 6, name: "Defence", text: "Defense contractor providing military combat vehicles and military technology.", url: "https://defencetech.com" },
      { id: 7, name: "Aircraft & Aviation", text: "Commercial airline providing passenger flights and aviation services.", url: "https://skylines.com" },
      { id: 8, name: "Aerospace", text: "Aerospace manufacturer specializing in rocket propulsion and satellite manufacturing.", url: "https://orbitallaunch.com" },
      { id: 9, name: "Marine", text: "Supplier of marine equipment and marine navigation systems.", url: "https://marinegear.com" },
      { id: 10, name: "Ship & Shipbuilding", text: "Commercial shipyard constructing cargo ships, passenger vessels, and tugboats.", url: "https://shipyardbuilders.com" },
      { id: 11, name: "Chemical", text: "Industrial chemical manufacturer producing bulk solvents and raw materials.", url: "https://chemworks.com" },
      { id: 12, name: "Alcohol", text: "Craft beer brewery and alcoholic beverage producer.", url: "https://craftbrewery.com" },
      { id: 13, name: "Animals", text: "Live animal sales and purebred puppy breeding kennel.", url: "https://puppybreeder.com" }
    ];

    for (const c of sample13Cases) {
      const check = ctx.detectRestrictedKeywordsSingle(c.text, "", c.url);
      assert.strictEqual(check.isRestricted, true, `Category ${c.id} (${c.name}) must be restricted`);
      const formatted = ctx.formatRestrictedValidationResult(check, c.url);
      assert.strictEqual(formatted.restricted, true);
      assert.strictEqual(formatted.classification, "Restricted - Reject");
      assert.strictEqual(formatted.final_decision, "Reject");
      assert.strictEqual(formatted.manual_review_required, false);
      assert.strictEqual(formatted.website_url, c.url);
      assert.ok(formatted.reason.length > 5);
      assert.ok(formatted.matched_keyword.length > 0);
    }

    // False Positive test
    const fpCheck = ctx.detectRestrictedKeywordsSingle("Adult education center for adult learners", "", "https://adultlearning.edu");
    assert.strictEqual(fpCheck.isRestricted, false);
    const fpFormatted = ctx.formatRestrictedValidationResult(fpCheck, "https://adultlearning.edu");
    assert.strictEqual(fpFormatted.restricted, false);
    assert.strictEqual(fpFormatted.restricted_category, null);
    assert.strictEqual(fpFormatted.classification, "False Positive");
    assert.strictEqual(fpFormatted.final_decision, "Do Not Reject");
    assert.strictEqual(fpFormatted.manual_review_required, false);

    // Manual Review test
    const mrFormatted = ctx.formatRestrictedValidationResult({
      requiresManualReview: true,
      category: "Medicine & Medical",
      reason: "Image appears to show medical device but description is missing"
    }, "https://ambiguous-device.com");
    assert.strictEqual(mrFormatted.restricted, null);
    assert.strictEqual(mrFormatted.classification, "Manual Review");
    assert.strictEqual(mrFormatted.final_decision, "Manual Review");
    assert.strictEqual(mrFormatted.manual_review_required, true);

    // Build prompt test
    const promptText = ctx.buildRestrictedCategoryPrompt({
      originalUrl: "https://example.com",
      bodyText: "Sample text"
    });
    assert.ok(promptText.includes("Category 1: Porn & Adult"));
    assert.ok(promptText.includes("Category 13: Animals"));
    assert.ok(promptText.includes("Restricted - Reject"));
  });

  // =========================================================================
  // Item 79: False Positive Prevention: "non-food-approved" (Riverjars) & "Diners Club" payment (Surya Brasil)
  // =========================================================================
  runTest('Item 79: False Positive Prevention: non-food applications & Diners Club credit card payment methods', () => {
    const { ctx } = createTestContext();

    // 1. Riverjars case: "non-food-approved applications"
    const riverjarsSnippet = "ic, if requested. These are suitable for non-food-approved applications. Additionally, we are...";
    const rCheck = ctx.detectRestrictedKeywordsSingle(riverjarsSnippet, "", "https://www.riverjars.com/");
    assert.strictEqual(rCheck.isRestricted, false, "Must NOT restrict 'non-food-approved applications'");
    const rFormatted = ctx.formatRestrictedValidationResult(rCheck, "https://www.riverjars.com/");
    assert.strictEqual(rFormatted.restricted, false);
    assert.strictEqual(rFormatted.classification, "False Positive");
    assert.strictEqual(rFormatted.final_decision, "Do Not Reject");

    // 2. Surya Brasil case: "Diners Club" payment method in footer
    const suryaSnippet = "...stercard Visa Elo Hypercard American Express Diners Club © 2026, Surya Brasil Com tecnologi...";
    const sCheck = ctx.detectRestrictedKeywordsSingle(suryaSnippet, "", "https://suryabrasil.com/");
    assert.strictEqual(sCheck.isRestricted, false, "Must NOT restrict 'Diners Club' credit card payment method");
    const sFormatted = ctx.formatRestrictedValidationResult(sCheck, "https://suryabrasil.com/");
    assert.strictEqual(sFormatted.restricted, false);
    assert.strictEqual(sFormatted.classification, "False Positive");
    assert.strictEqual(sFormatted.final_decision, "Do Not Reject");

    // 3. Packaging jars & containers for food/non-food
    const packagingSnippet = "Manufacturer of glass jars, plastic bottles, and closures suitable for food and non-food storage.";
    const pCheck = ctx.detectRestrictedKeywordsSingle(packagingSnippet, "", "https://packagingsupplier.com");
    assert.strictEqual(pCheck.isRestricted, false, "Must NOT restrict packaging container manufacturer");

    // 4. Non-medical equipment
    const nonMedSnippet = "Our non-medical monitoring devices are designed for general industrial temperature logging.";
    const nmCheck = ctx.detectRestrictedKeywordsSingle(nonMedSnippet, "", "https://templogger.com");
    assert.strictEqual(nmCheck.isRestricted, false, "Must NOT restrict non-medical devices");
  });

  // =========================================================================
  // Item 80: Own Crawl Name & Address Formatting Robustness
  // =========================================================================
  runTest('Item 80: Own Crawl Name & Address Formatting Robustness (No Slogan Names, Clean Address Components, Embedded Contacts Preserved)', () => {
    const { ctx } = createTestContext();

    // 1. Slogan in Title and "Home" in Logo -> Pick official legal brand
    const mockCrawlSlogan = {
      originalUrl: "https://www.acmevalves.com",
      finalUrl: "https://www.acmevalves.com/",
      title: "Welcome to | High Quality Valve Solutions | Acme Corp Ltd",
      logoText: "Home",
      copyrightText: "Copyright © 2026 Acme Corp Ltd. All Rights Reserved.",
      legalCompanyCandidates: ["Acme Corp Ltd"],
      addressCandidates: [
        {
          raw: "123 Industrial Parkway, Suite 400, Chicago, IL 60601, USA",
          source: "contact",
          isHeadquarters: true
        }
      ],
      phones: ["+1 312 555 0199"],
      emails: ["sales@acmevalves.com"],
      combinedText: "Acme Corp Ltd is a manufacturer of industrial valves.",
      mainHtml: "<html><body><h1>Acme Corp Ltd</h1></body></html>",
      detectedProductCount: 5,
      hasCompanyProfile: true
    };

    const extractedSlogan = ctx.heuristicExtraction(mockCrawlSlogan, { isRestricted: false });
    const qcSlogan = ctx.applyStrictInstructions(extractedSlogan, mockCrawlSlogan, { isRestricted: false });

    assert.strictEqual(qcSlogan.companyName, "Acme Corporation Limited", "Must reject slogans/nav items and expand Corp Ltd to Corporation Limited");
    assert.strictEqual(qcSlogan.companyAddress, "123 Industrial Parkway, Suite 400, Chicago, Illinois", "Must expand IL to Illinois, Suite 400, and strip zip code");
    assert.strictEqual(qcSlogan.state, "Available", "Illinois is state Available");
    assert.strictEqual(qcSlogan.city, "Available", "Chicago is city Available");

    // 2. Embedded telephone & email in middle of address does NOT truncate trailing city/state
    const mockCrawlEmbedded = {
      originalUrl: "https://www.dataplastics.co.uk",
      finalUrl: "https://www.dataplastics.co.uk/",
      title: "Custom CNC Machining Services - Data Plastics Ltd",
      copyrightText: "© 2026 Data Plastics Ltd",
      legalCompanyCandidates: ["Data Plastics Ltd"],
      addressCandidates: [
        {
          raw: "42 High Street, Tel: +44 161 234 5678, Email: info@dataplastics.co.uk, Manchester, Greater Manchester, M1 1AA, United Kingdom",
          source: "contact",
          isHeadquarters: true
        }
      ],
      phones: ["+44 161 234 5678"],
      emails: ["info@dataplastics.co.uk"],
      combinedText: "Data Plastics Ltd manufacturer of custom plastics.",
      mainHtml: "<html><body><p>Precision Moulding</p></body></html>",
      detectedProductCount: 3,
      hasCompanyProfile: true
    };

    const extractedEmbedded = ctx.heuristicExtraction(mockCrawlEmbedded, { isRestricted: false });
    const qcEmbedded = ctx.applyStrictInstructions(extractedEmbedded, mockCrawlEmbedded, { isRestricted: false });

    assert.strictEqual(qcEmbedded.companyName, "Data Plastics Limited", "Must strip leading slogan from title and expand Ltd to Limited");
    assert.strictEqual(qcEmbedded.companyAddress, "42 High Street, Manchester, Greater Manchester", "Embedded phone/email must be removed without truncating Manchester, Greater Manchester");
    assert.strictEqual(qcEmbedded.city, "Available", "Manchester is city Available");
    assert.strictEqual(qcEmbedded.state, "Available", "Greater Manchester is state/county Available");

    // 3. Full address candidate wins over incomplete fragment with higher default priority
    const mockCrawlFragment = {
      originalUrl: "https://www.precisiontools.com",
      finalUrl: "https://www.precisiontools.com/",
      title: "Precision Tools Inc.",
      copyrightText: "Copyright © 2026 Precision Tools Inc.",
      legalCompanyCandidates: ["Precision Tools Inc."],
      addressCandidates: [
        {
          raw: "London, UK",
          source: "footer",
          priority: 1 // default high priority from footer, but incomplete fragment!
        },
        {
          raw: "No. 55 Burnt House Road, Whitley Bay, Tyne and Wear, NE25 9DP, United Kingdom",
          source: "contact",
          priority: 6
        }
      ],
      phones: ["+44 191 252 1234"],
      emails: ["contact@precisiontools.com"],
      combinedText: "Precision Tools Inc. manufacturer of tools.",
      mainHtml: "<html><body><p>Tools</p></body></html>",
      detectedProductCount: 2,
      hasCompanyProfile: true
    };

    const extractedFragment = ctx.heuristicExtraction(mockCrawlFragment, { isRestricted: false });
    const qcFragment = ctx.applyStrictInstructions(extractedFragment, mockCrawlFragment, { isRestricted: false });

    assert.strictEqual(qcFragment.companyAddress, "Number 55 Burnt House Road, Whitley Bay, Tyne And Wear", "Full candidate must win over fragment, No. expands to Number, and postcode/country stripped");
    assert.strictEqual(qcFragment.city, "Available", "Whitley Bay is city Available");
    assert.strictEqual(qcFragment.state, "Available", "Tyne and Wear is county/state Available");
  });

  // =========================================================================
  // Item 81: Turkish Address Full Expansion & Own Crawl (Balaban Mahallesi Uzungol Cd. C Blok, N:1-2 Silivri, Istanbul)
  // =========================================================================
  runTest('Item 81: Turkish Address Full Expansion & Own Crawl (Cd. -> Caddesi, N:1-2 -> Number 1-2, C Blok, Silivri, Istanbul -> Türkiye)', () => {
    const { ctx } = createTestContext();
    const rawAddr = "Balaban Mahallesi Uzungol Cd. C Blok, N:1-2 Silivri, Istanbul";

    // 1. isFullAddressCandidate recognition
    assert.strictEqual(ctx.isFullAddressCandidate(rawAddr), true, 'Turkish thoroughfare, block and number prefix must be recognized as full address');

    // 2. Abbreviation expansion
    const expanded = ctx.expandAddressAndStateAbbreviations(rawAddr, "Türkiye");
    assert.strictEqual(expanded, "Balaban Mahallesi Uzungol Caddesi C Blok, Number 1-2 Silivri, Istanbul", 'Cd. must expand to Caddesi and N:1-2 must expand to Number 1-2');

    // 3. Address sanitization & comma punctuation
    const sanitized = ctx.sanitizeRule6CompanyAddress(rawAddr, "Balaban Makina Sanayi", "Türkiye", { contactPageText: rawAddr, footerText: rawAddr });
    assert.strictEqual(sanitized, "Balaban Mahallesi, Uzungol Caddesi, C Blok, Number 1-2, Silivri, Istanbul", 'Sanitized address must expand abbreviations and format components cleanly with commas');

    // 4. Country detection must NOT be falsely hijacked by Blok into Indonesia
    const detectedCountry = ctx.detectCountryFromAddress(rawAddr);
    assert.strictEqual(detectedCountry, "Türkiye", 'Istanbul address with Blok must resolve to Türkiye, not Indonesia');

    // 5. City and State QC evaluation
    assert.strictEqual(ctx.evaluateCityQC(sanitized, "Türkiye"), "Available", 'Silivri / Istanbul must evaluate as City Available in Türkiye');
    assert.strictEqual(ctx.hasStateInAddress(sanitized, "Türkiye"), true, 'Istanbul must evaluate as State Available in Türkiye');

    // 6. End-to-end own crawl extraction and strict QC
    const mockCrawlTurkish = {
      originalUrl: "https://www.balabanmakina.com.tr",
      finalUrl: "https://www.balabanmakina.com.tr/",
      title: "Balaban Makina Sanayi Ltd. Sti.",
      contactPageText: rawAddr,
      footerText: rawAddr,
      bodyText: rawAddr + " We manufacture custom packaging machinery in our factory in Silivri, Istanbul.",
      mainHtml: `<html><body><h1>Balaban Makina</h1><p>${rawAddr}</p></body></html>`,
      crawledPages: [{ url: "https://www.balabanmakina.com.tr/", text: rawAddr + " We manufacture custom packaging machinery." }],
      detectedProductCount: 3,
      detectedImageCount: 3,
      detectedDescCount: 3,
      emails: ["info@balabanmakina.com.tr"],
      phones: ["+90 212 727 1234"],
      addressCandidates: [{ raw: rawAddr, source: "contact" }]
    };

    const extracted = ctx.heuristicExtraction(mockCrawlTurkish, { isRestricted: false });
    assert.strictEqual(extracted.countryName, "Türkiye", 'Own crawl must resolve country as Türkiye');
    assert.strictEqual(extracted.companyAddress, "Balaban Mahallesi, Uzungol Caddesi, C Blok, Number 1-2, Silivri, Istanbul", 'Own crawl must extract fully expanded address');

    const qcResult = ctx.applyStrictInstructions(extracted, mockCrawlTurkish, { isRestricted: false });
    assert.strictEqual(qcResult.websiteStatus, "Working", 'Website status must be Working');
    assert.strictEqual(qcResult.countryName, "Türkiye", 'Country name must be Türkiye');
    assert.strictEqual(qcResult.companyAddress, "Balaban Mahallesi, Uzungol Caddesi, C Blok, Number 1-2, Silivri, Istanbul", 'QC must preserve fully expanded address');
    assert.strictEqual(qcResult.city, "Available", 'City must be Available');
    assert.strictEqual(qcResult.state, "Available", 'State must be Available');
  });

  // =========================================================================
  // Item 82: Comprehensive 7-Country Support (Türkiye, France, Indonesia, Singapore, Malaysia, South Africa, Germany)
  // =========================================================================
  runTest('Item 82: Comprehensive 7-Country Support (Türkiye, France, Indonesia, Singapore, Malaysia, South Africa, Germany)', () => {
    const { ctx } = createTestContext();

    // 1. Türkiye
    const trCo = ctx.expandCompanyAbbreviations("ABC San. ve Tic. Ltd. Şti.");
    assert.strictEqual(trCo, "ABC Sanayi ve Ticaret Limited Şirketi", "Turkish legal suffix & trade abbreviation expansion");
    const trCountry = ctx.normalizeCountryName("turkiey");
    assert.strictEqual(trCountry, "Türkiye", "turkiey alias maps to Türkiye");
    const trPhone = ctx.cleanPhoneNumber("+90 212 123 4567", "Türkiye");
    assert.strictEqual(trPhone, "2121234567", "Turkish country code +90 must be stripped");
    const trAddr = ctx.sanitizeRule6CompanyAddress("Balaban Mh. Uzungol Cd. C Blok, N:1-2 Myd. Silivri, Istanbul, Türkiye", "ABC", "Türkiye");
    assert.strictEqual(ctx.evaluateCityQC(trAddr, "Türkiye"), "Available", "Silivri / Istanbul must evaluate as City Available");
    assert.strictEqual(ctx.hasStateInAddress(trAddr, "Türkiye"), true, "Istanbul must evaluate as State Available");

    // 2. France
    const frCo = ctx.expandCompanyAbbreviations("Societe Industrielle SARL");
    assert.strictEqual(frCo, "Societe Industrielle Société à Responsabilité Limitée", "French SARL expansion");
    const frCoSci = ctx.expandCompanyAbbreviations("Immobiliere SCI");
    assert.strictEqual(frCoSci, "Immobiliere Société Civile Immobilière", "French SCI expansion");
    const frCountry = ctx.normalizeCountryName("french");
    assert.strictEqual(frCountry, "France", "french alias maps to France");
    const frPhone = ctx.cleanPhoneNumber("+33 4 42 18 00 00", "France");
    assert.strictEqual(frPhone, "442180000", "French country code +33 must be stripped");
    const frAddr = ctx.sanitizeRule6CompanyAddress("15 Bd. de la Liberte, Z.I. Les Paluds, 13400 Aubagne, France", "Societe", "France");
    assert.strictEqual(frAddr, "15 Boulevard De La Liberte, Zone Industrielle Les Paluds, Aubagne", "French address abbreviation expansion & postal code/country stripping");
    assert.strictEqual(ctx.evaluateCityQC(frAddr, "France"), "Available", "Aubagne must evaluate as City Available");
    assert.strictEqual(ctx.hasStateInAddress("15 Boulevard De La Liberte, Aubagne, Provence-Alpes-Cote d'Azur", "France"), true, "PACA region must evaluate as State Available");

    // 3. Indonesia
    const idCo = ctx.expandCompanyAbbreviations("PT Maju Jaya Bersama");
    assert.strictEqual(idCo, "Perseroan Terbatas Maju Jaya Bersama", "Indonesian PT expansion");
    const idCoCv = ctx.expandCompanyAbbreviations("CV Indah Karya");
    assert.strictEqual(idCoCv, "Commanditaire Vennootschap Indah Karya", "Indonesian CV expansion");
    const idCountry = ctx.normalizeCountryName("indonesia");
    assert.strictEqual(idCountry, "Indonesia", "Indonesia normalization");
    const idPhone = ctx.cleanPhoneNumber("+62 21 893 1234", "Indonesia");
    assert.strictEqual(idPhone, "218931234", "Indonesian country code +62 must be stripped");
    const idAddr = ctx.sanitizeRule6CompanyAddress("Jl. Raya Industri Km 5,5 No. 12, Cikarang, Jawa Barat, Indonesia", "Maju", "Indonesia");
    assert.strictEqual(idAddr, "Jalan Raya Industri Kilometer 5,5 Number 12, Cikarang, Jawa Barat", "Indonesian Jl/Km/No expansion, decimal comma preservation, country strip");
    assert.strictEqual(ctx.evaluateCityQC(idAddr, "Indonesia"), "Available", "Cikarang must evaluate as City Available");
    assert.strictEqual(ctx.hasStateInAddress(idAddr, "Indonesia"), true, "Jawa Barat must evaluate as State Available");

    // 4. Singapore
    const sgCo = ctx.expandCompanyAbbreviations("Pacific Engineering Pte Ltd");
    assert.strictEqual(sgCo, "Pacific Engineering Private Limited", "Singapore Pte Ltd expansion");
    const sgCountry = ctx.normalizeCountryName("republic of singapore");
    assert.strictEqual(sgCountry, "Singapore", "Republic of Singapore maps to Singapore");
    const sgPhone = ctx.cleanPhoneNumber("+65 6220 1234", "Singapore");
    assert.strictEqual(sgPhone, "62201234", "Singapore country code +65 must be stripped");
    const sgAddr = ctx.sanitizeRule6CompanyAddress("10 Anson Road #08-01 International Plaza, Singapore 079903", "Pacific", "Singapore");
    assert.strictEqual(sgAddr, "10 Anson Road #08-01 International Plaza", "Singapore 6-digit postal code & country stripped, # preserved");
    assert.strictEqual(ctx.evaluateCityQC(sgAddr, "Singapore"), "Available", "Singapore City-State evaluates as City Available");
    assert.strictEqual(ctx.hasStateInAddress(sgAddr, "Singapore"), true, "Singapore City-State evaluates as State Available");

    // 5. Malaysia
    const myCo = ctx.expandCompanyAbbreviations("Apex Manufacturing Sdn Bhd");
    assert.strictEqual(myCo, "Apex Manufacturing Sendirian Berhad", "Malaysian Sdn Bhd expansion");
    const myCountry = ctx.normalizeCountryName("malaysia");
    assert.strictEqual(myCountry, "Malaysia", "Malaysia normalization");
    const myPhone = ctx.cleanPhoneNumber("+60 3 8061 1234", "Malaysia");
    assert.strictEqual(myPhone, "380611234", "Malaysian country code +60 must be stripped");
    const myAddr = ctx.sanitizeRule6CompanyAddress("No. 25, Jln. Industri 3, Tmn. Perindustrian Puchong, 47100 Puchong, Selangor, Malaysia", "Apex", "Malaysia");
    assert.strictEqual(myAddr, "Number 25, Jalan Industri 3, Taman Perindustrian, Puchong, Selangor", "Malaysian Jln/Tmn expansion, postal code stripped, deduplicated city");
    assert.strictEqual(ctx.evaluateCityQC(myAddr, "Malaysia"), "Available", "Puchong must evaluate as City Available");
    assert.strictEqual(ctx.hasStateInAddress(myAddr, "Malaysia"), true, "Selangor must evaluate as State Available");

    // 6. South Africa
    const zaCo = ctx.expandCompanyAbbreviations("Transnet SOC Ltd");
    assert.strictEqual(zaCo, "Transnet State Owned Company Limited", "South African SOC Ltd expansion");
    const zaCoPty = ctx.expandCompanyAbbreviations("Apex Mining (Pty) Ltd");
    assert.strictEqual(zaCoPty, "Apex Mining Proprietary Limited", "South African (Pty) Ltd expansion with brackets removed");
    const zaCountry = ctx.normalizeCountryName("southafrica");
    assert.strictEqual(zaCountry, "South Africa", "southafrica alias maps to South Africa");
    const zaCountryRsa = ctx.normalizeCountryName("rsa");
    assert.strictEqual(zaCountryRsa, "South Africa", "rsa alias maps to South Africa");
    const zaPhone = ctx.cleanPhoneNumber("+27 11 123 4567", "South Africa");
    assert.strictEqual(zaPhone, "111234567", "South African country code +27 must be stripped");
    const zaSuburbAddr = "10 West Street, Sandton, Gauteng";
    assert.strictEqual(ctx.evaluateCityQC(zaSuburbAddr, "South Africa"), "Not Available", "South African suburb Sandton alone must be City Not Available");
    assert.strictEqual(ctx.hasStateInAddress(zaSuburbAddr, "South Africa"), true, "Gauteng province must be State Available");
    const zaCityAddr = "10 West Street, Johannesburg, Gauteng";
    assert.strictEqual(ctx.evaluateCityQC(zaCityAddr, "South Africa"), "Available", "Johannesburg city must be City Available");

    // 7. Germany
    const deCo = ctx.expandCompanyAbbreviations("Musterbau GmbH & Co. KG");
    assert.strictEqual(deCo, "Musterbau Gesellschaft mit beschränkter Haftung & Compagnie Kommanditgesellschaft", "German GmbH & Co. KG expansion with & preserved");
    const deCountry = ctx.normalizeCountryName("german");
    assert.strictEqual(deCountry, "Germany", "german alias maps to Germany");
    const deCountryDeu = ctx.normalizeCountryName("bundesrepublik deutschland");
    assert.strictEqual(deCountryDeu, "Germany", "bundesrepublik deutschland maps to Germany");
    const dePhone = ctx.cleanPhoneNumber("+49 7309 1234", "Germany");
    assert.strictEqual(dePhone, "73091234", "German country code +49 must be stripped");
    const deAddr = ctx.sanitizeRule6CompanyAddress("Industriestr. 12, 89264 Weissenhorn, Germany", "Musterbau", "Germany");
    assert.strictEqual(deAddr, "Industriestrasse 12, Weissenhorn", "German Industriestr expansion and 5-digit PLZ/country stripped");
    assert.strictEqual(ctx.evaluateCityQC(deAddr, "Germany"), "Available", "Weissenhorn must evaluate as City Available");
    assert.strictEqual(ctx.hasStateInAddress("Industriestrasse 12, Weissenhorn, Bayern", "Germany"), true, "Bayern must evaluate as State Available");
    assert.strictEqual(ctx.evaluateCityQC("Hauptstrasse 10, Berlin", "Germany"), "Available", "Berlin City-State evaluates as City Available");
    assert.strictEqual(ctx.hasStateInAddress("Hauptstrasse 10, Berlin", "Germany"), true, "Berlin City-State evaluates as State Available");
  });

  // =========================================================================
  // Item 83: Security Check / Anti-bot (HTTP 403) marked as Not Working (Fashion Alliance UK)
  // =========================================================================
  await runAsyncTest('Item 83: Security Check / Anti-bot (HTTP 403) marked as Not Working (Fashion Alliance UK)', async () => {
    const { ctx } = createTestContext();
    const fashionAllianceCrawl = {
      status: 'Not Working',
      httpStatus: 403,
      isBlocked: true,
      requiresManualReview: false,
      fetchError: 'Site access restricted / blocked (HTTP 403 Security Check / Anti-bot)',
      reason: 'Site access restricted / blocked (HTTP 403 Security Check / Anti-bot). Manual Review required.',
      errorKeyword: 'Security Check / Anti-bot',
      finalUrl: 'http://www.fashionalliance.co.uk/',
      pages: []
    };

    const evaluated = ctx.applyStrictInstructions({}, fashionAllianceCrawl, { isRestricted: false });
    assert.strictEqual(evaluated.websiteStatus, 'Not Working', 'Status must be Not Working for HTTP 403 Security Check / Anti-bot');
    assert.strictEqual(evaluated.requiresManualReview, false, 'requiresManualReview must be false');
    assert.strictEqual(evaluated.errorKeyword, 'Security Check / Anti-bot', 'Error keyword must be Security Check / Anti-bot');
    assert.strictEqual(evaluated.companyName, '', 'Company name must be cleared for Not Working');
    assert.strictEqual(evaluated.companyAddress, '', 'Company address must be cleared for Not Working');
    assert.strictEqual(evaluated.emailId, '', 'Email must be cleared for Not Working');
    assert.strictEqual(evaluated.phoneNumber, '', 'Phone must be cleared for Not Working');

    // Error recorder must record it into persistent non-working storage
    const recResult = await ctx.recordNonWorkingWebsite(evaluated);
    assert.strictEqual(recResult.success, true, 'Fashion Alliance 403 must be recorded in non-working records');
    assert.strictEqual(recResult.record['Website Status'], 'Not Working', 'Status in record must be Not Working');
    assert.strictEqual(recResult.record['Error Keyword'], 'Security Check / Anti-bot', 'Error Keyword in record must match');
    assert.strictEqual(recResult.record.URL, 'http://www.fashionalliance.co.uk/', 'URL in record must match');
  });

  // =========================================================================
  // Item 84: Address Unwanted Expansion Fix & Boundary Special Characters Removal
  // =========================================================================
  await runAsyncTest('Item 84: Address Unwanted Expansion Fix & Boundary Special Characters Removal', async () => {
    const { ctx } = createTestContext();

    // 1. Melrose Packaging UK address - raw candidate has "Units 3 + 4"
    const rawMelroseAddr = 'Units 3 + 4\nSt. Martins Way\nBedford\nBedfordshire\nMK42 0LF\nUK';
    const sanitizedMelrose = ctx.sanitizeRule6CompanyAddress(rawMelroseAddr, 'Melrose Packaging Limited', 'United Kingdom');
    assert.strictEqual(
      sanitizedMelrose,
      'Units 3 + 4 Saint Martins Way, Bedford, Bedfordshire',
      'Must preserve "+" in Units 3 + 4, expand St. to Saint, add comma before Bedfordshire, and strip postal code/UK'
    );

    // 2. Reconcile / Restore address symbol when AI output expanded "+" to "And"
    const mockCrawlMelrose = {
      originalUrl: 'http://www.melrosepackaging.co.uk/',
      finalUrl: 'http://www.melrosepackaging.co.uk/',
      addressCandidates: [{ raw: rawMelroseAddr }],
      contactPageText: rawMelroseAddr,
      renderedText: 'Melrose Packaging Limited Units 3 + 4 St. Martins Way Bedford Bedfordshire MK42 0LF UK',
      bodyText: 'Melrose Packaging Limited manufacture bespoke polythene bags and packaging solutions.'
    };
    const aiOutputWithUnwantedExpansion = {
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyProfile: 'Available',
      companyName: '* Melrose Packaging Ltd *',
      countryName: 'United Kingdom',
      companyAddress: 'Units 3 And 4 Saint Martins Way, Bedford, Bedfordshire',
      emailId: 'sales@melrosepackaging.co.uk',
      phoneNumber: '1234841144',
      numberOfProducts: '2',
      productImages: '2',
      numberOfProductDescriptions: '2',
      _isFromAi: true
    };
    const evaluatedMelrose = ctx.applyStrictInstructions(aiOutputWithUnwantedExpansion, mockCrawlMelrose, {});
    assert.strictEqual(
      evaluatedMelrose.companyAddress,
      'Units 3 + 4 Saint Martins Way, Bedford, Bedfordshire',
      'Must restore "+" from raw evidence and avoid unwanted expansion into "And"'
    );
    assert.strictEqual(
      evaluatedMelrose.companyName,
      'Melrose Packaging Limited',
      'Must strip leading/trailing "*" and expand Ltd to Limited'
    );
    assert.strictEqual(evaluatedMelrose.countryName, 'United Kingdom');
    assert.strictEqual(evaluatedMelrose.state, 'Available', 'Bedfordshire must be recognized as State Available');
    assert.strictEqual(evaluatedMelrose.city, 'Available', 'Bedford must be recognized as City Available');

    // 3. Rule 4: Special characters must not start and must not end on Company Names
    const boundaryTestCases = [
      { input: '- Acme Corp -', expected: 'Acme Corporation' },
      { input: '• Smith & Jones •', expected: 'Smith & Jones' },
      { input: '"Alpha Beta Ltd."', expected: 'Alpha Beta Limited' },
      { input: '© Global Tech Ltd. ™ !', expected: 'Global Technology Limited' },
      { input: '+ Plus Electronics Ltd +', expected: 'Plus Electronics Limited' },
      { input: 'R/C Electronics Ltd.', expected: 'R/C Electronics Limited' }
    ];

    for (const { input, expected } of boundaryTestCases) {
      const mockCrawl = {
        originalUrl: 'http://example.com/',
        finalUrl: 'http://example.com/',
        bodyText: 'Industrial manufacturer producing components.'
      };
      const aiMock = {
        websiteStatus: 'Working',
        businessType: 'Manufacturer',
        companyProfile: 'Available',
        companyName: input,
        countryName: 'United Kingdom',
        companyAddress: '100 High Street, Bedford, Bedfordshire',
        emailId: 'info@example.com',
        phoneNumber: '12345678',
        numberOfProducts: '2',
        productImages: '2',
        numberOfProductDescriptions: '2',
        _isFromAi: true
      };
      const res = ctx.applyStrictInstructions(aiMock, mockCrawl, {});
      assert.strictEqual(res.companyName, expected, `Boundary special chars must be stripped from "${input}"`);
    }
  });

  // =========================================================================
  // Item 85: Complete Website Crawl (No 5-Page Restriction)
  // =========================================================================
  await runAsyncTest('Item 85: Complete Website Crawl (No 5-Page Restriction)', async () => {
    let fetchCount = 0;
    const fetchedUrlsList = [];
    const mockHtml = `
      <html>
        <head><title>Apex Machinery Co., Ltd.</title></head>
        <body>
          <a href="/contact">Contact</a>
          <a href="/about-us">About Us</a>
          <a href="/company-profile">Company Profile</a>
          <a href="/products">Products</a>
          <a href="/products/cnc-machines">CNC Machines</a>
          <a href="/products/milling">Milling</a>
          <a href="/services">Services</a>
          <a href="/locations">Locations</a>
          <a href="/terms">Terms</a>
          <p>Apex Machinery manufactures industrial machinery. 123 Factory Lane, Manchester.</p>
        </body>
      </html>
    `;

    const mockFetch = async (url) => {
      fetchCount++;
      fetchedUrlsList.push(url);
      return {
        ok: true,
        status: 200,
        headers: {
          get: (h) => (h.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null)
        },
        arrayBuffer: async () => Buffer.from(mockHtml, 'utf8')
      };
    };

    const { ctx } = createTestContext(mockFetch);
    // When called normally (complete website crawl), it must crawl beyond the old 5-page limit
    const crawlResult = await ctx.crawlWebsite('https://apex-machinery.com');
    assert.ok(fetchCount > 5, `Total fetch requests (${fetchCount}) must exceed the old 5-page limit`);
    assert.ok(crawlResult.pagesFetchedCount > 5, `pagesFetchedCount (${crawlResult.pagesFetchedCount}) must exceed 5`);
    assert.strictEqual(fetchCount, 10, 'All 9 internal subpages + homepage (10 total) must be crawled');
    assert.strictEqual(crawlResult.crawledPages.length, 10, 'All 10 crawled pages must be recorded in crawledPages');
  });

  console.log('\n========================================================');
  console.log(`Review Items Results: ${passedTests} Passed, ${failedTests} Failed (Total: ${totalTests})`);
  console.log('========================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Fatal error running review regression tests:', err);
  process.exit(1);
});
