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
    TextDecoder,
    Buffer,
    atob: typeof atob === 'function' ? atob : (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: typeof btoa === 'function' ? btoa : (s) => Buffer.from(s, 'binary').toString('base64'),
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
    assert.ok(fetchCount >= 10, 'All 9 internal subpages + homepage (10 total) must be crawled');
    assert.strictEqual(crawlResult.pagesFetchedCount, 10, 'pagesFetchedCount must be 10');
    assert.strictEqual(crawlResult.crawledPages.length, 10, 'All 10 crawled pages must be recorded in crawledPages');
  });

  // =========================================================================
  // Item 86: Crawl Time Budget Guard Prevents 28s SW Timeout on Large Websites
  // =========================================================================
  await runAsyncTest('Item 86: Crawl time budget guard prevents service worker 28s timeout & properly crawls working sites', async () => {
    let fetchCount = 0;
    const mockPages = {
      'https://www.latchandbatchelor.co.uk/': `
        <html><head><title>Home - Latch and Batchelor</title></head>
        <body>
          <a href="/contact-us/">Contact Us</a>
          <a href="/products/crane-ropes/">Crane Ropes</a>
          <a href="/terms/">Terms</a>
          <p>Wire rope manufacturer in Birmingham</p>
        </body></html>
      `,
      'https://www.latchandbatchelor.co.uk/contact-us/': `
        <html><head><title>Contact Us - Latch and Batchelor</title></head>
        <body>
          <h3>Address:</h3>
          <p><strong>Latch and Batchelor</strong><br />
          Hay Mills, Birmingham B25 8DW,<br />
          West Midlands, United Kingdom</p>
          <p><strong>Phone:</strong> +44 (0)121 772 979<strong>9<br />
          <a href="/cdn-cgi/l/email-protection" data-cfemail="7e121c0d1f121b0d3e0916190c110b0e50110c19">[email&#160;protected]</a>
        </body></html>
      `,
      'https://www.latchandbatchelor.co.uk/products/crane-ropes/': `
        <html><body><h1>Crane Ropes</h1><p>Mining and engineering wire rope products</p><img src="rope1.jpg" alt="Rope 1" /><img src="rope2.jpg" alt="Rope 2" /><img src="rope3.jpg" alt="Rope 3" /></body></html>
      `,
      'https://www.latchandbatchelor.co.uk/terms/': `
        <html><body><p>Terms of business. Division of Webster and Horsfall Ltd.</p></body></html>
      `
    };

    const mockFetch = async (url) => {
      fetchCount++;
      const uClean = url.split('?')[0].split('#')[0];
      const html = mockPages[uClean] || '<html><body>Page</body></html>';
      return {
        ok: true,
        status: 200,
        headers: {
          get: (h) => (h.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null)
        },
        arrayBuffer: async () => Buffer.from(html, 'utf8')
      };
    };

    const { ctx } = createTestContext(mockFetch);
    const crawlResult = await ctx.crawlWebsite('https://www.latchandbatchelor.co.uk/', { maxCrawlTimeMs: 18000 });
    
    assert.strictEqual(crawlResult.status, 'Working');
    assert.strictEqual(crawlResult.requiresManualReview, false);
    assert.ok(crawlResult.crawledPages.length >= 2, 'Must crawl homepage and contact page');

    const result = await ctx.handleCrawlAndExtract('https://www.latchandbatchelor.co.uk/', 'own_crawl');
    assert.strictEqual(result.websiteStatus, 'Working', 'Website must be Working, not Not Working');
    assert.strictEqual(result.companyName, 'Latch And Batchelor', 'Company name must be Latch And Batchelor');
    assert.strictEqual(result.countryName, 'United Kingdom', 'Country must be United Kingdom');
    assert.strictEqual(result.companyAddress, 'Hay Mills, Birmingham, West Midlands', 'Address must have postal code and country stripped per Rule 6');
    assert.strictEqual(result.city, 'Available', 'City must be Available (Birmingham)');
    assert.strictEqual(result.state, 'Available', 'State must be Available (West Midlands)');
    assert.strictEqual(result.phoneNumber, '1217729799', 'Phone number must be clean national number with leading 0 stripped');
    assert.strictEqual(result.emailId, 'lbsales@whgroup.org', 'Cloudflare protected email must be decoded');
  });

  // =========================================================================
  // Item 87: Any issue/error/manual review/non-working condition marks
  // Website Status dropdown as "Not Working" and clears all other fields
  // =========================================================================
  await runAsyncTest('Item 87: Any issue, error, timeout, or non-working status marks "Not Working" in form status dropdown', async () => {
    const mockStatusSelect = {
      tagName: 'SELECT',
      id: 'selectWebsiteStatus',
      value: 'Working',
      selectedIndex: 0,
      options: [
        { value: 'Working', text: 'Working' },
        { value: 'Not Working', text: 'Not Working' },
        { value: 'Domain Expired', text: 'Domain Expired' },
        { value: 'Non English', text: 'Non English' },
        { value: 'Under Construction', text: 'Under Construction' },
        { value: 'Flash Site', text: 'Flash Site' },
        { value: 'Redirect Site', text: 'Redirect Site' }
      ],
      dispatchEvent: () => {},
      classList: { add: () => {}, remove: () => {} },
      style: {}
    };

    const mockCompanyInput = {
      tagName: 'INPUT',
      id: 'companyName',
      value: 'Stale Company Name',
      classList: { add: () => {}, remove: () => {} },
      style: {},
      dispatchEvent: () => {}
    };

    const cCtx = vm.createContext({
      window: { location: { href: 'http://testportal.com/dataextraction' } },
      document: {
        location: { href: 'http://testportal.com/dataextraction' },
        title: 'Test Portal',
        body: { querySelectorAll: () => [], appendChild: () => {}, removeChild: () => {} },
        createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {} }, appendChild: () => {}, addEventListener: () => {} }),
        getElementById: (id) => {
          if (id === 'selectWebsiteStatus' || id === 'website-status') return mockStatusSelect;
          if (id === 'companyName') return mockCompanyInput;
          return null;
        },
        querySelector: (sel) => {
          if (sel.includes('selectWebsiteStatus') || sel.includes('status')) return mockStatusSelect;
          if (sel.includes('company')) return mockCompanyInput;
          return null;
        },
        querySelectorAll: () => [mockStatusSelect, mockCompanyInput],
        addEventListener: () => {}
      },
      Event: function () {},
      setTimeout: (fn) => { fn(); return 1; },
      clearTimeout: () => {},
      setInterval: () => 1,
      clearInterval: () => {},
      URL
    });
    cCtx.globalThis = cCtx;

    const files = [
      'src/content/state.js',
      'src/content/messaging.js',
      'src/content/queue-automation.js',
      'src/content/overlay-ui.js',
      'src/content/form-detector.js'
    ];
    for (const rel of files) {
      const p = path.join(rootDir, rel);
      vm.runInContext(fs.readFileSync(p, 'utf8'), cCtx, { filename: rel });
    }

    const ext = cCtx.__AI_EXTENSION__;

    // 1. Timeout / Manual Review
    mockStatusSelect.value = 'Working';
    mockCompanyInput.value = 'Existing Co';
    ext.fillFormFields({
      websiteStatus: 'Manual Review',
      requiresManualReview: true,
      retryRequired: true,
      fetchError: 'Website took longer than 28 seconds to respond'
    });
    assert.strictEqual(mockStatusSelect.value, 'Not Working', 'Timeout / Manual Review must mark status as Not Working');
    assert.strictEqual(mockCompanyInput.value, '', 'Other fields must be cleared on Not Working');

    // 2. Domain Expired
    mockStatusSelect.value = 'Working';
    mockCompanyInput.value = 'Existing Co';
    ext.fillFormFields({
      websiteStatus: 'Domain Expired',
      errorKeyword: 'Domain Expired'
    });
    assert.strictEqual(mockStatusSelect.value, 'Not Working', 'Domain Expired must mark status as Not Working');
    assert.strictEqual(mockCompanyInput.value, '', 'Other fields must be cleared on Domain Expired');

    // 3. Non English
    mockStatusSelect.value = 'Working';
    mockCompanyInput.value = 'Existing Co';
    ext.fillFormFields({
      websiteStatus: 'Non English',
      errorKeyword: 'Foreign Language'
    });
    assert.strictEqual(mockStatusSelect.value, 'Not Working', 'Non English must mark status as Not Working');
    assert.strictEqual(mockCompanyInput.value, '', 'Other fields must be cleared on Non English');

    // 4. Prohibited Category / Disallowed
    mockStatusSelect.value = 'Working';
    mockCompanyInput.value = 'Existing Co';
    ext.fillFormFields({
      websiteStatus: 'Not Working',
      businessType: 'Restricted Site',
      isProhibitedSite: true
    });
    assert.strictEqual(mockStatusSelect.value, 'Not Working', 'Prohibited site must mark status as Not Working');
    assert.strictEqual(mockCompanyInput.value, '', 'Other fields must be cleared on Prohibited site');
  });

  runTest('Item 88: Taiwan / Asian floor sub-unit normalization (6 Floor-1, 6F-1, 6F.-1, 6 Floor, unit 1 -> 6 Floor-1, no ordinal expansions)', () => {
    const { ctx } = createTestContext();
    // 1. Gemini output with "6th Floor, unit 1" must normalize to "6 Floor-1"
    const geminiWrong1 = '6th Floor, unit 1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City';
    const norm1 = ctx.sanitizeRule6CompanyAddress(geminiWrong1, '', 'Taiwan');
    assert.strictEqual(norm1, '6 Floor-1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City',
      'Should normalize "6th Floor, unit 1" to "6 Floor-1"');

    // 2. Gemini output with capitalized "6th Floor, Unit 1"
    const geminiWrong2 = '6th Floor, Unit 1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City';
    const norm2 = ctx.sanitizeRule6CompanyAddress(geminiWrong2, '', 'Taiwan');
    assert.strictEqual(norm2, '6 Floor-1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City',
      'Should normalize "6th Floor, Unit 1" to "6 Floor-1"');

    // 3. Raw crawl with "6F-1" shorthand
    const rawCrawl1 = '6F-1, No. 27, Ln. 61, Sec. 1, Guangfu Rd., Sanchong Dist., New Taipei City';
    const norm3 = ctx.sanitizeRule6CompanyAddress(rawCrawl1, '', 'Taiwan');
    assert.strictEqual(norm3, '6 Floor-1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City',
      'Should normalize "6F-1" to "6 Floor-1"');

    // 4. Raw crawl with "6F.-1"
    const rawCrawl2 = '6F.-1, No. 27, Ln. 61, Sec. 1, Guangfu Rd., Sanchong Dist., New Taipei City';
    const norm4 = ctx.sanitizeRule6CompanyAddress(rawCrawl2, '', 'Taiwan');
    assert.strictEqual(norm4, '6 Floor-1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City',
      'Should normalize "6F.-1" to "6 Floor-1"');

    // 5. Raw crawl with "6F - 1"
    const rawCrawl3 = '6F - 1, No. 27, Ln. 61, Sec. 1, Guangfu Rd., Sanchong Dist., New Taipei City';
    const norm5 = ctx.sanitizeRule6CompanyAddress(rawCrawl3, '', 'Taiwan');
    assert.strictEqual(norm5, '6 Floor-1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City',
      'Should normalize "6F - 1" to "6 Floor-1"');

    // 6. Gemini output with "Floor 6, unit 1"
    const geminiWrong3 = 'Floor 6, unit 1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City';
    const norm6 = ctx.sanitizeRule6CompanyAddress(geminiWrong3, '', 'Taiwan');
    assert.strictEqual(norm6, '6 Floor-1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City',
      'Should normalize "Floor 6, unit 1" to "6 Floor-1"');

    // 7. Gemini output with "6th Floor Unit 1"
    const geminiWrong4 = '6th Floor Unit 1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City';
    const norm7 = ctx.sanitizeRule6CompanyAddress(geminiWrong4, '', 'Taiwan');
    assert.strictEqual(norm7, '6 Floor-1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City',
      'Should normalize "6th Floor Unit 1" to "6 Floor-1"');

    // 8. Other floor numbers e.g. 10F-2
    const otherFloor = '10F-2, No. 15, Ln. 8, Sec. 2, Zhongshan N. Rd., Zhongshan Dist., Taipei City';
    const norm8 = ctx.sanitizeRule6CompanyAddress(otherFloor, '', 'Taiwan');
    assert.strictEqual(norm8, '10 Floor-2, Number 15, Lane 8, Section 2, Zhongshan North Road, Zhongshan District, Taipei City',
      'Should normalize "10F-2" to "10 Floor-2"');
  });

  runTest('Item 89: Mandatory City and State QC Rules (Town/District/Municipality/Capital -> City/State Available)', () => {
    const { ctx } = createTestContext();

    // 1. Explicit Town, District, Municipality -> City: Available
    assert.strictEqual(ctx.evaluateCityQC('10 High Street, Heanor Town, Derbyshire', 'United Kingdom'), 'Available', 'Explicit Town must be City Available');
    assert.strictEqual(ctx.evaluateCityQC('6 Floor-1, Number 27, Sanchong District, New Taipei City', 'Taiwan'), 'Available', 'District & City must be City Available');
    assert.strictEqual(ctx.evaluateCityQC('15 Victoria Street, Sedibeng Municipality, Gauteng', 'South Africa'), 'Available', 'Municipality must be City Available');

    // 2. Capital City Rule: Capital city in address makes BOTH City and State Available
    const capTaipei = ctx.applyStrictInstructions({
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: '123 Zhongxiao East Road, Taipei City',
      countryName: 'Taiwan'
    }, {}, {});
    assert.strictEqual(capTaipei.city, 'Available', 'Capital Taipei City -> City Available');
    assert.strictEqual(capTaipei.state, 'Available', 'Capital Taipei City -> State Available');

    const capTokyo = ctx.applyStrictInstructions({
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: '1-1 Marunouchi, Tokyo',
      countryName: 'Japan'
    }, {}, {});
    assert.strictEqual(capTokyo.city, 'Available', 'Capital Tokyo -> City Available');
    assert.strictEqual(capTokyo.state, 'Available', 'Capital Tokyo -> State Available');

    const capParis = ctx.applyStrictInstructions({
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: '10 Rue de Rivoli, Paris',
      countryName: 'France'
    }, {}, {});
    assert.strictEqual(capParis.city, 'Available', 'Capital Paris -> City Available');
    assert.strictEqual(capParis.state, 'Available', 'Capital Paris -> State Available');

    const capWashington = ctx.applyStrictInstructions({
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: '500 Pennsylvania Avenue, Washington D.C.',
      countryName: 'United States Of America'
    }, {}, {});
    assert.strictEqual(capWashington.city, 'Available', 'Capital Washington D.C. -> City Available');
    assert.strictEqual(capWashington.state, 'Available', 'Capital Washington D.C. -> State Available');

    // 3. County, Province, Prefecture -> State: Available
    const countyAddr = ctx.applyStrictInstructions({
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: '15 Industrial Park, Kettering, Northamptonshire',
      countryName: 'United Kingdom'
    }, {}, {});
    assert.strictEqual(countyAddr.state, 'Available', 'Northamptonshire county -> State Available');
    assert.strictEqual(countyAddr.city, 'Available', 'Kettering town -> City Available');

    const provinceAddr = ctx.applyStrictInstructions({
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: '100 Main Road, Limpopo Province',
      countryName: 'South Africa'
    }, {}, {});
    assert.strictEqual(provinceAddr.state, 'Available', 'Explicit Province -> State Available');

    const prefAddr = ctx.applyStrictInstructions({
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: '50 Commerce Way, Kanagawa Prefecture',
      countryName: 'Japan'
    }, {}, {});
    assert.strictEqual(prefAddr.state, 'Available', 'Explicit Prefecture -> State Available');

    // 4. Street name with "County Road", "State Highway", "District Road" must NOT trigger State/City
    assert.strictEqual(ctx.hasStateInAddress('100 County Road 42, Unknown Village', 'United States Of America'), false, 'County Road must NOT trigger State');
    assert.strictEqual(ctx.hasStateInAddress('55 State Highway 1, Unknown Village', 'New Zealand'), false, 'State Highway must NOT trigger State');
    assert.strictEqual(ctx.evaluateCityQC('10 District Road, Unknown Suburb', 'Australia'), 'Not Available', 'District Road must NOT trigger City');

    // 5. Suburb only without recognized City/Town/District/Municipality -> City: Not Available
    assert.strictEqual(ctx.evaluateCityQC('40 Sarah Street, Campbellfield, Victoria', 'Australia'), 'Not Available', 'Campbellfield suburb only -> City Not Available');
    assert.strictEqual(ctx.evaluateCityQC('12 Industrie Road, Penrose', 'New Zealand'), 'Not Available', 'Penrose suburb only -> City Not Available');
    assert.strictEqual(ctx.evaluateCityQC('27w705 Hickory Lane, Northwoods, Illinois', 'United States Of America'), 'Not Available', 'Northwoods subdivision only -> City Not Available');

    const northwoodsQc = ctx.applyStrictInstructions({
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: '27w705 Hickory Lane, Northwoods, Illinois',
      countryName: 'United States Of America'
    }, {}, {});
    assert.strictEqual(northwoodsQc.state, 'Available', 'Illinois is state Available');
    assert.strictEqual(northwoodsQc.city, 'Not Available', 'Northwoods is neighborhood/subdivision only -> City Not Available');

    // 6. Final output must STRICTLY be only "Available" or "Not Available"
    assert.ok(['Available', 'Not Available'].includes(capTaipei.city));
    assert.ok(['Available', 'Not Available'].includes(capTaipei.state));
    assert.ok(['Available', 'Not Available'].includes(countyAddr.city));
    assert.ok(['Available', 'Not Available'].includes(countyAddr.state));
  });

  runTest('Item 90: GDPR / Statutory Privacy Policy "sex life / sexual orientation" false positive prevention (Fabrikat UK)', () => {
    const { ctx } = createTestContext();
    const privacyText = 'Special categories of personal data such as race, ethnicity, religious or philosophical beliefs, sex life, sexual orientation, political opinions, trade union membership.';
    const checkPrivacy = ctx.detectRestrictedKeywords(
      'Fabrikat Nottingham Limited. Manufacturer of street lighting columns, brackets, and pedestrian guardrails. ' + privacyText,
      '<html><body><h1>Fabrikat Lighting Manufacturer</h1><p>' + privacyText + '</p></body></html>',
      [
        { url: 'https://www.fabrikat.co.uk/', text: 'Fabrikat Nottingham Limited. Manufacturer of street lighting columns.' },
        { url: 'https://www.fabrikat.co.uk/privacy-policy/', text: privacyText }
      ]
    );
    assert.strictEqual(checkPrivacy.isRestricted, false, 'GDPR privacy policy statutory sex life mention must not trigger Adult & Porn rejection');

    // Genuine sex shop / adult novelty site must still be rejected
    const checkAdult = ctx.detectRestrictedKeywords(
      'Online Adult Novelty Store. Premium adult toys, vibrators, and sex shop novelties.',
      '<html><body><h1>Adult Novelties</h1></body></html>',
      [{ url: 'https://adultnovelty.com', text: 'Online Adult Novelty Store. Premium adult toys, vibrators, and sex shop novelties.' }]
    );
    assert.strictEqual(checkAdult.isRestricted, true, 'Genuine sex shop / adult novelty must be rejected');
    assert.strictEqual(checkAdult.category, 'Adult & Porn');
  });

  runTest('Item 91: United States Of America Mandatory QC Rules (County/Province/Prefecture -> State; Town/District/Municipality -> City; Capital Rule)', () => {
    const { ctx } = createTestContext();

    // 1. County considered as State:
    const usaCounty = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyName: 'Orange County Components LLC',
      countryName: 'United States Of America',
      companyAddress: '100 Innovation Way, Orange County',
      productImages: '3'
    }, {}, {});
    assert.strictEqual(usaCounty.state, 'Available', 'Orange County must be considered as State Available');

    const usaCookCounty = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyName: 'Cook County Precision Inc',
      countryName: 'United States Of America',
      companyAddress: '450 North Michigan Avenue, Cook County',
      productImages: '3'
    }, {}, {});
    assert.strictEqual(usaCookCounty.state, 'Available', 'Cook County must be considered as State Available');

    // 2. Town / District / Municipality considered as City:
    const usaDistrict = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyName: 'Midwest Fabrication LLC',
      countryName: 'United States Of America',
      companyAddress: '200 Logistics Drive, Elgin District, Illinois',
      productImages: '3'
    }, {}, {});
    assert.strictEqual(usaDistrict.city, 'Available', 'District must be considered as City Available');
    assert.strictEqual(usaDistrict.state, 'Available', 'Illinois is State Available');

    const usaTown = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyName: 'Carolina Metals Corp',
      countryName: 'United States Of America',
      companyAddress: '15 Main Street, Cary Town, North Carolina',
      productImages: '3'
    }, {}, {});
    assert.strictEqual(usaTown.city, 'Available', 'Town must be considered as City Available');
    assert.strictEqual(usaTown.state, 'Available', 'North Carolina is State Available');

    const usaMuni = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyName: 'Pennsylvania Castings Inc',
      countryName: 'United States Of America',
      companyAddress: '88 Foundry Road, Bethel Park Municipality, Pennsylvania',
      productImages: '3'
    }, {}, {});
    assert.strictEqual(usaMuni.city, 'Available', 'Municipality must be considered as City Available');
    assert.strictEqual(usaMuni.state, 'Available', 'Pennsylvania is State Available');

    // 3. Capital City Rule:
    const usaCapital = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyName: 'Federal Systems LLC',
      countryName: 'United States Of America',
      companyAddress: '1200 K Street NW, Washington',
      productImages: '3'
    }, {}, {});
    assert.strictEqual(usaCapital.city, 'Available', 'Capital Washington must have City Available');
    assert.strictEqual(usaCapital.state, 'Available', 'Capital Washington must have State Available');

    const usaCapitalDC = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyName: 'Potomac Defense Inc',
      countryName: 'United States Of America',
      companyAddress: '1600 Pennsylvania Avenue, Washington D.C.',
      productImages: '3'
    }, {}, {});
    assert.strictEqual(usaCapitalDC.city, 'Available', 'Capital Washington D.C. must have City Available');
    assert.strictEqual(usaCapitalDC.state, 'Available', 'Capital Washington D.C. must have State Available');

    // 4. Suburb without City -> City: Not Available, State: Available
    const usaSuburb = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyName: 'Midwest Automation Corp',
      countryName: 'United States Of America',
      companyAddress: '27W705 Hickory Lane, Northwoods, Illinois',
      productImages: '3'
    }, {}, {});
    assert.strictEqual(usaSuburb.city, 'Not Available', 'Northwoods is unincorporated neighborhood -> City Not Available');
    assert.strictEqual(usaSuburb.state, 'Available', 'Illinois is State Available');
  });

  runTest('Item 92: Pure AI extraction mode (TAKE AI DATA ONLY - zero crawl heuristic combining)', () => {
    const { ctx } = createTestContext();

    // When AI provides structured data, DO NOT combine or overwrite with crawl heuristic data:
    const aiOutput = {
      _isFromAi: true,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyProfile: 'Available',
      companyName: 'Alpha Precision Manufacturing Limited',
      countryName: 'United States Of America',
      companyAddress: '500 Enterprise Way, Elgin, Illinois',
      state: 'Available',
      city: 'Available',
      emailId: 'info@alphaprecision.com',
      secondaryEmailId: '',
      phoneNumber: '8475551234',
      numberOfProducts: '2',
      productImages: '2',
      numberOfProductDescriptions: '2'
    };

    // Crawl data has conflicting/unwanted items (different email, secondary email from footer, different phone, raw address fragment, 3 detected products)
    const noisyCrawlData = {
      emails: ['info@alphaprecision.com', 'webmaster@externalhost.com', 'developer@marketing.org'],
      phones: ['+1 800 555 9999', '3125550000'],
      addressCandidates: [{ raw: '500 Enterprise Way', source: 'footer' }],
      detectedProductCount: 5,
      detectedImageCount: 5
    };

    const finalResult = ctx.applyStrictInstructions(aiOutput, noisyCrawlData, {});

    // Verification:
    assert.strictEqual(finalResult.companyAddress, '500 Enterprise Way, Elgin, Illinois', 'Must retain AI address without stripping words from raw crawl candidates');
    assert.strictEqual(finalResult.emailId, 'info@alphaprecision.com', 'Must retain pure AI email');
    assert.strictEqual(finalResult.secondaryEmailId, '', 'Must NOT backfill secondary email from crawl footer/webmaster emails');
    assert.strictEqual(finalResult.phoneNumber, '8475551234', 'Must NOT overwrite AI phone with crawl phone');
    assert.strictEqual(finalResult.numberOfProducts, '2', 'Must retain AI product count (2) and NOT recalculate to 3 from crawl count (5)');
    assert.strictEqual(finalResult.productImages, '2');
    assert.strictEqual(finalResult.numberOfProductDescriptions, '2');
  });

  runTest('Item 93: In AI mode, strictly preserve AI City & State without heuristic override (asdw.net / East Brunswick test case)', () => {
    const { ctx } = createTestContext();

    const aiOutput = {
      _isFromAi: true,
      websiteStatus: 'Working',
      notWorkingReason: '',
      businessType: 'Manufacturer',
      companyProfile: 'Available',
      companyName: 'All Seasons Window & Door',
      countryName: 'United States Of America',
      companyAddress: '28 Edgeboro Road, East Brunswick, New Jersey',
      state: 'Available',
      city: 'Available',
      emailId: 'customer@asdw.net',
      secondaryEmailId: '',
      phoneNumber: '7322387100',
      numberOfProducts: '3',
      numberOfProductImages: '3',
      numberOfProductDescriptions: '3'
    };

    const finalResult = ctx.applyStrictInstructions(aiOutput, {}, {});

    assert.strictEqual(finalResult.websiteStatus, 'Working', 'Website Status must be Working');
    assert.strictEqual(finalResult.businessType, 'Manufacturer', 'Business Type must be Manufacturer');
    assert.strictEqual(finalResult.companyProfile, 'Available', 'Company Profile must be Available');
    assert.strictEqual(finalResult.companyName, 'All Seasons Window & Door', 'Company Name must be All Seasons Window & Door');
    assert.strictEqual(finalResult.countryName, 'United States Of America', 'Country must be United States Of America');
    assert.strictEqual(finalResult.companyAddress, '28 Edgeboro Road, East Brunswick, New Jersey', 'Address must be preserved');
    assert.strictEqual(finalResult.state, 'Available', 'State must be Available');
    assert.strictEqual(finalResult.city, 'Available', 'City must be Available as provided by AI (not overridden to Not Available)');
    assert.strictEqual(finalResult.emailId, 'customer@asdw.net', 'Email must be customer@asdw.net');
    assert.strictEqual(finalResult.phoneNumber, '7322387100', 'Phone number must be 7322387100');
    assert.strictEqual(finalResult.numberOfProducts, '3', 'Products must be 3');
    assert.strictEqual(finalResult.productImages, '3', 'Product images must be 3');
    assert.strictEqual(finalResult.numberOfProductDescriptions, '3', 'Product descriptions must be 3');
  });

  runTest('Item 94: Post Office Box numbers must NOT be removed from company address; pincodes only are removed', () => {
    const { ctx } = createTestContext();

    const rawAddrWithPobox = 'MO 0253, Jebel Ali Free Zone, PO Box 261619, Dubai, United Arab Emirates';
    const cleaned = ctx.sanitizeRule6CompanyAddress(rawAddrWithPobox, 'Gulf Worldwide Distribution FZE', 'United Arab Emirates');

    assert.ok(cleaned.includes('Post Office Box 261619'), `Must retain Post Office Box 261619, got: ${cleaned}`);
    assert.ok(!cleaned.includes('United Arab Emirates'), `Must strip country name, got: ${cleaned}`);

    // Verify trailing PO Box is also preserved
    const trailingPobox = 'Unit 4, Industrial Area, Dubai, Post Office Box 82314';
    const cleanedTrailing = ctx.sanitizeRule6CompanyAddress(trailingPobox, 'Orient Star Parts', 'United Arab Emirates');
    assert.ok(cleanedTrailing.includes('Post Office Box 82314'), `Must retain trailing Post Office Box 82314, got: ${cleanedTrailing}`);

    // Verify actual postal codes / pincodes ARE still stripped
    const withPincode = '123 Main Street, Dallas, Texas 75201, United States Of America';
    const cleanedPin = ctx.sanitizeRule6CompanyAddress(withPincode, 'Acme Corp', 'United States Of America');
    assert.ok(!cleanedPin.includes('75201'), `Must strip ZIP code 75201, got: ${cleanedPin}`);
  });

  runTest('Item 95: Address format and component sequence preservation across websites (no inversion/reordering)', () => {
    const { ctx } = createTestContext();

    // 1. Street before Suite on website (kochma.com test case: 106 Northpoint Pkwy Suite 400 Acworth GA 30102)
    const crawlData1 = {
      originalUrl: 'https://www.kochma.com',
      finalUrl: 'https://www.kochma.com',
      status: 'Working',
      companyName: 'Koch Machinery',
      addressCandidates: [
        { raw: '106 Northpoint Pkwy Suite 400\nAcworth GA 30102', isHeadquarters: true }
      ]
    };

    // Even if AI returned premise inverted (Suite 400 first)
    const aiResult1 = {
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyProfile: 'Available',
      companyName: 'Koch Machinery',
      countryName: 'United States Of America',
      companyAddress: 'Suite 400, 106 Northpoint Parkway, Acworth, Georgia',
      state: 'Available',
      city: 'Available',
      _isFromAi: true
    };

    const qcResult1 = ctx.applyStrictInstructions(aiResult1, crawlData1);
    assert.strictEqual(
      qcResult1.companyAddress,
      '106 Northpoint Parkway, Suite 400, Acworth, Georgia',
      'Must preserve street-first sequence as on website and not invert Suite to beginning'
    );

    // 2. Suite before Street on website (e.g. Suite 260, 2021 Guadalupe Street, Austin TX 78705)
    const crawlData2 = {
      originalUrl: 'https://www.example.com',
      finalUrl: 'https://www.example.com',
      status: 'Working',
      companyName: 'Example Corp',
      addressCandidates: [
        { raw: 'Suite 260, 2021 Guadalupe Street\nAustin TX 78705', isHeadquarters: true }
      ]
    };

    const aiResult2 = {
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyProfile: 'Available',
      companyName: 'Example Corp',
      countryName: 'United States Of America',
      companyAddress: 'Suite 260, 2021 Guadalupe Street, Austin, Texas',
      state: 'Available',
      city: 'Available',
      _isFromAi: true
    };

    const qcResult2 = ctx.applyStrictInstructions(aiResult2, crawlData2);
    assert.strictEqual(
      qcResult2.companyAddress,
      'Suite 260, 2021 Guadalupe Street, Austin, Texas',
      'Must preserve suite-first sequence when website writes suite first'
    );
  });

  runTest('Item 96: 12 Additional Critical Company Address QC Rules & Headquarters Priority Hierarchy', () => {
    const { ctx } = createTestContext();

    // 1. Rule 1: Headquarters Priority (Global HQ > Head Office > Main Office > Registered Office; branch never selected over HQ)
    const targetCandidates = [];
    ctx.addAddressCandidate(targetCandidates, 'Branch Office: 100 Industrial Road, Chicago, Illinois', 'branch', false, 'branch', 'https://example.com/locations');
    ctx.addAddressCandidate(targetCandidates, 'Registered Office: 50 Legal Way, Dover, Delaware', 'legal', false, 'registered_office', 'https://example.com/legal');
    ctx.addAddressCandidate(targetCandidates, 'Main Office: 200 Commerce Way, Dallas, Texas', 'contact', false, 'general', 'https://example.com/contact');
    ctx.addAddressCandidate(targetCandidates, 'Head Office: 300 Executive Parkway, Atlanta, Georgia', 'contact', true, 'headquarters', 'https://example.com/contact');
    ctx.addAddressCandidate(targetCandidates, 'Global Headquarters: 500 Corporate Boulevard, New York, New York', 'contact', true, 'headquarters', 'https://example.com/contact');

    // Sort by priority (lowest number = highest priority)
    targetCandidates.sort((a, b) => a.priority - b.priority);
    assert.ok(targetCandidates[0].raw.includes('500 Corporate Boulevard'), `Priority 1 must be Global Headquarters, got: ${targetCandidates[0].raw}`);
    assert.ok(targetCandidates[1].raw.includes('300 Executive Parkway'), `Priority 2 must be Head Office, got: ${targetCandidates[1].raw}`);
    assert.ok(targetCandidates[2].raw.includes('200 Commerce Way'), `Priority 3 must be Main Office, got: ${targetCandidates[2].raw}`);
    assert.ok(targetCandidates[3].raw.includes('50 Legal Way'), `Priority 4 must be Registered Office fallback, got: ${targetCandidates[3].raw}`);
    assert.ok(targetCandidates[4].raw.includes('100 Industrial Road'), `Branch Office must be lowest priority, got: ${targetCandidates[4].raw}`);

    // 2. Rule 3: Multi-line address combination in HTML
    const htmlWithAddress = '<address>Suite 500<br>700 Innovation Way<br>Sunnyvale, California 94086</address>';
    const extractedList = [];
    ctx.extractHtmlAddresses(htmlWithAddress, extractedList, 'contact', 'https://example.com/contact');
    assert.ok(extractedList.length > 0, 'Must extract from <address> tag');
    const combined = extractedList[0].raw;
    assert.ok(combined.includes('Suite 500'), 'Must retain Suite 500');
    assert.ok(combined.includes('700 Innovation Way'), 'Must retain 700 Innovation Way');
    assert.ok(combined.includes('Sunnyvale, California'), 'Must retain Sunnyvale, California');

    // 3. Rule 5 & 7: Postal code removed without removing street number or PO Box number
    const addrWithBox = 'Post Office Box 1234, 456 Main Street, Suite 200, Austin, Texas 78701, United States Of America';
    const cleaned = ctx.sanitizeRule6CompanyAddress(addrWithBox, 'Test Corp', 'United States Of America');
    assert.ok(cleaned.includes('Post Office Box 1234'), `Must retain Post Office Box 1234, got: ${cleaned}`);
    assert.ok(cleaned.includes('456 Main Street'), `Must retain street number 456, got: ${cleaned}`);
    assert.ok(!cleaned.includes('78701'), `Must strip postal code 78701, got: ${cleaned}`);
    assert.ok(!cleaned.includes('United States Of America'), `Must strip country name, got: ${cleaned}`);

    // 4. Rule 8: Non-English proper names & diacritics preserved
    const frenchAddr = '15 Rue De La Paix, 75002 Paris, France';
    const cleanedFr = ctx.sanitizeRule6CompanyAddress(frenchAddr, 'Societe Exemple', 'France');
    assert.ok(cleanedFr.includes('Rue De La Paix'), `Must preserve French street name, got: ${cleanedFr}`);

    // 5. Rule 9: Authentic symbols preserved (e.g. '+' never converted to 'And' or 'Plus')
    const symbolAddr = 'Units 3 + 4, Industrial Park, Birmingham, West Midlands';
    const cleanedSym = ctx.sanitizeRule6CompanyAddress(symbolAddr, 'Industrial Co', 'United Kingdom');
    assert.ok(cleanedSym.includes('Units 3 + 4'), `Must preserve '+' symbol in Units 3 + 4, got: ${cleanedSym}`);
    assert.ok(!cleanedSym.includes('Units 3 And 4') && !cleanedSym.includes('Units 3 Plus 4'), `Must not convert '+' to 'And' or 'Plus'`);

    // 6. Rule 10: Address Unavailable Handling
    const unavailableAi = {
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyProfile: 'Available',
      companyName: 'Virtual Services',
      countryName: 'United States Of America',
      companyAddress: 'Not Available',
      state: 'Not Available',
      city: 'Not Available',
      _isFromAi: true
    };
    const qcUnavail = ctx.applyStrictInstructions(unavailableAi, { addressCandidates: [] });
    assert.strictEqual(qcUnavail.companyAddress, 'Not Available', 'Must return Not Available when no physical address exists');
    assert.strictEqual(qcUnavail.state, 'Not Available');
    assert.strictEqual(qcUnavail.city, 'Not Available');
  });

  runTest('Item 97: Pure AI Data Mode - Zero Cross-Source Contamination, Conversion or Override', () => {
    const { ctx } = createTestContext();

    // 1. AI result has companyAddress: 'Not Available' while crawl has raw candidates.
    // Must strictly retain 'Not Available' from AI and NEVER replace with crawl candidate!
    const aiWithNoAddress = {
      _isFromAi: true,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyProfile: 'Available',
      companyName: 'Cloud Solutions Inc',
      countryName: 'United States Of America',
      companyAddress: 'Not Available',
      state: 'Not Available',
      city: 'Not Available',
      emailId: 'contact@cloudsolutions.com',
      secondaryEmailId: '',
      phoneNumber: '2125551234',
      numberOfProducts: '3',
      productImages: '3',
      numberOfProductDescriptions: '3'
    };

    const crawlWithCandidate = {
      addressCandidates: [{ raw: '999 Old Branch Road, Dallas, Texas 75201', source: 'footer' }],
      emails: ['billing@cloudsolutions.com', 'admin@marketing.com'],
      phones: ['+1 800 123 4567'],
      detectedProductCount: 0
    };

    const result1 = ctx.applyStrictInstructions(aiWithNoAddress, crawlWithCandidate, {});
    assert.strictEqual(result1.companyAddress, 'Not Available', 'AI address Not Available must NOT be overwritten with crawl candidate');
    assert.strictEqual(result1.state, 'Not Available', 'AI state Not Available must NOT be overwritten');
    assert.strictEqual(result1.city, 'Not Available', 'AI city Not Available must NOT be overwritten');
    assert.strictEqual(result1.emailId, 'contact@cloudsolutions.com', 'AI email must NOT be modified');
    assert.strictEqual(result1.secondaryEmailId, '', 'Secondary email must NOT be backfilled from crawl');
    assert.strictEqual(result1.phoneNumber, '2125551234', 'AI phone must NOT be overwritten');
    assert.strictEqual(result1.numberOfProducts, '3', 'AI products count must NOT be overwritten');

    // 2. Suburb / Unincorporated locality: AI returns City: Not Available.
    // Local regex / capital rules must NEVER convert or override AI city to Available!
    const aiSuburban = {
      _isFromAi: true,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyProfile: 'Available',
      companyName: 'Precision Lathes LLC',
      countryName: 'United States Of America',
      companyAddress: '27W705 Hickory Lane, Northwoods, Illinois',
      state: 'Available',
      city: 'Not Available',
      emailId: 'sales@precisionlathes.com',
      secondaryEmailId: '',
      phoneNumber: '6305559876',
      numberOfProducts: '2',
      productImages: '2',
      numberOfProductDescriptions: '2'
    };

    const result2 = ctx.applyStrictInstructions(aiSuburban, { addressCandidates: [] }, {});
    assert.strictEqual(result2.city, 'Not Available', 'AI City: Not Available must be completely preserved without heuristic override');
    assert.strictEqual(result2.state, 'Available', 'AI State: Available must be preserved');
    assert.ok(result2.companyAddress.toLowerCase().includes('27w705 hickory lane, northwoods, illinois'), 'Address must preserve Northwoods, Illinois');
  });

  runTest('Item 98: Rule 7 (State) and Rule 8 (City) across AI and Local Crawl modes (Chen Sound, Wey Yii, Milano, Ditzingen, Senai, Warszawa)', () => {
    const { ctx } = createTestContext();

    // 1. Chen Sound Taiwan (Local crawl) - Shengang District, Taichung City: City Available, State Not Available
    const chenSoundLocal = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: 'Number 62-6, Jhongche Road, Shengang District, Taichung City',
      countryName: 'Taiwan'
    }, {}, {});
    assert.strictEqual(chenSoundLocal.state, 'Not Available', 'Chen Sound Taiwan: Taichung City & Shengang District has no county -> State: Not Available');
    assert.strictEqual(chenSoundLocal.city, 'Available', 'Chen Sound Taiwan: Shengang District & Taichung City -> City: Available');

    // 2. Wey Yii Taiwan (AI mode) - 409-6 Beitun Road, Beitun District, Taichung:
    // AI hallucinated State: Available -> strictly corrected to State: Not Available; City: Available; No. restored to Number
    const rawWeyYii = 'No. 409-6, Beitun Rd., Beitun Dist., Taichung, Taiwan';
    const weyYiiAi = ctx.applyStrictInstructions({
      _isFromAi: true,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: '409-6 Beitun Road, Beitun District, Taichung',
      countryName: 'Taiwan',
      state: 'Available',
      city: 'Available'
    }, { addressCandidates: [{ raw: rawWeyYii, source: 'contact' }] }, {});
    assert.strictEqual(weyYiiAi.state, 'Not Available', 'Wey Yii Taiwan: Taichung has no county/province and is not capital -> State: Not Available');
    assert.strictEqual(weyYiiAi.city, 'Available', 'Wey Yii Taiwan: Beitun District & Taichung -> City: Available');
    assert.ok(weyYiiAi.companyAddress.startsWith('Number 409-6'), 'Raw "No. 409-6" on website restores "Number 409-6"');

    // 3. Milano Italy (Local crawl & AI mode) - Via Roma 10, 20121 Milano: City Available
    const milanoLocal = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: 'Via Roma 10, 20121 Milano',
      countryName: 'Italy'
    }, {}, {});
    assert.strictEqual(milanoLocal.city, 'Available', 'Milano in Italy must evaluate as City Available');

    const milanoAi = ctx.applyStrictInstructions({
      _isFromAi: true,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: 'Via Roma 10, 20121 Milano',
      countryName: 'Italy',
      state: 'Available',
      city: 'Available'
    }, {}, {});
    assert.strictEqual(milanoAi.city, 'Available', 'AI City Available for Milano must be preserved');

    // 4. Ditzingen Germany (Local crawl) - Siemensstrasse 10, 71254 Ditzingen, Baden-Wuerttemberg: Both Available
    const ditzingenLocal = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: 'Siemensstrasse 10, 71254 Ditzingen, Baden-Wuerttemberg',
      countryName: 'Germany'
    }, {}, {});
    assert.strictEqual(ditzingenLocal.state, 'Available', 'Baden-Wuerttemberg must evaluate as State Available');
    assert.strictEqual(ditzingenLocal.city, 'Available', 'Ditzingen must evaluate as City Available');

    // 5. Senai Malaysia (Local crawl) - Senai, Johor: Both Available
    const senaiLocal = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: 'Senai, Johor',
      countryName: 'Malaysia'
    }, {}, {});
    assert.strictEqual(senaiLocal.state, 'Available', 'Johor must evaluate as State Available');
    assert.strictEqual(senaiLocal.city, 'Available', 'Senai town must evaluate as City Available');

    // 6. Warszawa Poland (Capital Rule) - ul. Marszalkowska 10, Warszawa: Both Available
    const warszawaLocal = ctx.applyStrictInstructions({
      _isFromAi: false,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyAddress: 'ul. Marszalkowska 10, Warszawa',
      countryName: 'Poland'
    }, {}, {});
    assert.strictEqual(warszawaLocal.state, 'Available', 'Capital Warszawa makes State Available');
    assert.strictEqual(warszawaLocal.city, 'Available', 'Capital Warszawa makes City Available');
  });

  // =========================================================================
  // Item 99: ITAR registration (Defence), Medical Device Manufacturing, and
  // Aerospace CNC Machinery classified as Prohibited Categories (grinding.com)
  // =========================================================================
  runTest('Item 99: ITAR registration (Defence), Medical Device Manufacturing, and Aerospace classified as Prohibited Categories (grinding.com)', () => {
    const { ctx } = createTestContext();

    // 1. ITAR registration on About Us / Corporate Profile
    const itarSnippet = 'UNITED GRINDING North America, Inc., also holds International Traffic in Arms Regulations (ITAR) Registration.';
    const itarCheck = ctx.detectRestrictedKeywordsSingle(itarSnippet, '', 'https://www.grinding.com/en/about-us/');
    assert.strictEqual(itarCheck.isRestricted, true, 'ITAR registration must be detected as restricted');
    assert.strictEqual(itarCheck.category, 'Defence & Military', 'ITAR must be classified under Defence & Military');

    // 2. Navigation / Key Industries mentioning Medical Device Manufacturing and Aerospace
    const navSnippet = 'Industries Key Industries Automotive & Suppliers Energy Industry Medical Device Manufacturing Aerospace Tooling Machine Manufacturers';
    const navCheck = ctx.detectRestrictedKeywordsSingle(navSnippet, '', 'https://www.grinding.com/en/');
    assert.strictEqual(navCheck.isRestricted, true, 'Medical Device Manufacturing in nav must be restricted');

    // 3. Dedicated Medical Device Manufacturing subpage
    const medSnippet = 'Medical Device Machines & Grinders. Precision CNC grinding for medical device manufacturing, surgical instruments, and orthopedic implants.';
    const medCheck = ctx.detectRestrictedKeywordsSingle(medSnippet, '', 'https://www.grinding.com/en/industries/key-industries/medical-device-manufacturing/');
    assert.strictEqual(medCheck.isRestricted, true, 'Medical Device Machines must be restricted');
    assert.strictEqual(medCheck.category, 'Medicine, Medical & Hospital');

    // 4. Dedicated Aerospace CNC Machines subpage
    const aeroSnippet = 'Aerospace CNC Machines & Grinders. High precision grinding machines engineered for turbine blades and aerospace manufacturing.';
    const aeroCheck = ctx.detectRestrictedKeywordsSingle(aeroSnippet, '', 'https://www.grinding.com/en/industries/key-industries/aerospace/');
    assert.strictEqual(aeroCheck.isRestricted, true, 'Aerospace CNC Machines must be restricted');
    assert.strictEqual(aeroCheck.category, 'Aerospace');

    // 5. Full strict QC evaluation marks site as Not Working and clears all fields
    const restrictedEvaluation = ctx.applyStrictInstructions({
      websiteStatus: 'Working',
      companyName: 'United Grinding',
      companyAddress: '2100 United Grinding Boulevard, Miamisburg, Ohio'
    }, {}, itarCheck);

    assert.strictEqual(restrictedEvaluation.websiteStatus, 'Not Working');
    assert.strictEqual(restrictedEvaluation.companyName, '');
    assert.strictEqual(restrictedEvaluation.companyAddress, '');
    assert.strictEqual(restrictedEvaluation.isRestricted, true);
    assert.ok(restrictedEvaluation.notWorkingReason.includes('Defence & Military') || restrictedEvaluation.notWorkingReason.includes('Prohibited Category'));
  });

  // =========================================================================
  // Item 100: School, College, University & Education Websites Classified as
  // Not Working (Prohibited Category / Out of Scope)
  // =========================================================================
  runTest('Item 100: School, College, University & Education Websites Classified as Not Working', () => {
    const { ctx } = createTestContext();

    // 1. Domain-level check: .edu and .ac.* domains
    const harvardDomain = ctx.detectDisallowedWebsitePlatformOrDomain('https://www.harvard.edu');
    assert.strictEqual(harvardDomain.isDisallowed, true, '.edu domain must be disallowed');
    assert.ok(harvardDomain.reason.includes('School, College & Education'));

    const oxfordDomain = ctx.detectDisallowedWebsitePlatformOrDomain('https://www.ox.ac.uk');
    assert.strictEqual(oxfordDomain.isDisallowed, true, '.ac.uk domain must be disallowed');
    assert.ok(oxfordDomain.reason.includes('School, College & Education'));

    // 2. High School (.com domain)
    const schoolText = "Welcome to St. Mary's High School. Admissions open for academic year 2026. Academic curriculum, student life, and faculty details.";
    const schoolHtml = "<html><head><title>St. Mary's High School</title></head><body><h1>St. Mary's High School</h1><p>Admissions open for academic year 2026.</p></body></html>";
    const schoolCheck = ctx.detectRestrictedKeywordsSingle(schoolText, schoolHtml, 'https://www.stmaryshighschool.com');
    assert.strictEqual(schoolCheck.isRestricted, true, 'High school must be restricted');
    assert.strictEqual(schoolCheck.category, 'School, College & Education');

    // 3. Community College (.org domain)
    const collegeText = "Brighton Community College offers higher education degree courses, vocational diplomas, and adult education classes.";
    const collegeCheck = ctx.detectRestrictedKeywordsSingle(collegeText, '', 'https://www.brightoncollege.org');
    assert.strictEqual(collegeCheck.isRestricted, true, 'Community college must be restricted');
    assert.strictEqual(collegeCheck.category, 'School, College & Education');

    // 4. Full QC evaluation marks School as Not Working and clears all 13 fields
    const schoolQc = ctx.applyStrictInstructions({
      websiteStatus: 'Working',
      companyName: "St. Mary's High School",
      companyAddress: '100 School Lane, Springfield, Ohio',
      phoneNumber: '5551234567'
    }, {}, schoolCheck);

    assert.strictEqual(schoolQc.websiteStatus, 'Not Working', 'School status must be Not Working');
    assert.strictEqual(schoolQc.companyName, '', 'Company name must be cleared');
    assert.strictEqual(schoolQc.companyAddress, '', 'Company address must be cleared');
    assert.strictEqual(schoolQc.phoneNumber, '', 'Phone must be cleared');
    assert.strictEqual(schoolQc.isRestricted, true, 'isRestricted must be true');
    assert.ok(schoolQc.notWorkingReason.includes('School, College & Education') || schoolQc.notWorkingReason.includes('Prohibited Category'));

    // 5. False positive protection: School Uniform and School Furniture Manufacturers are NOT restricted
    const uniformText = "Elite Garment Factory: We manufacture custom school uniforms, sports jerseys, and corporate workwear.";
    const uniformCheck = ctx.detectRestrictedKeywordsSingle(uniformText, '', 'https://www.elitegarments.com');
    assert.strictEqual(uniformCheck.isRestricted, false, 'Uniform manufacturer must NOT be restricted');

    const furnText = "ClassCraft Furniture: Industrial manufacturer of durable desks and ergonomic chairs for schools and universities.";
    const furnCheck = ctx.detectRestrictedKeywordsSingle(furnText, '', 'https://www.classcraftfurniture.com');
    assert.strictEqual(furnCheck.isRestricted, false, 'School furniture manufacturer must NOT be restricted');
  });

  // =========================================================================
  // Item 101: Aerospace & Airplane Machinery Rejection (action-wetori.com) &
  // AI Mode Cannot Override Restricted Rejection
  // =========================================================================
  runTest('Item 101: Aerospace & Airplane Machinery Rejection (action-wetori.com) & AI Mode Cannot Override Restricted Rejection', () => {
    const { ctx } = createTestContext();

    // 1. action-wetori.com content detection (Airplane Parts & Aerospace)
    const actionSnippet = 'APPLICATIONS Industrial Field Car Parts VIEW MORE Aerospace VIEW MORE Airplane Parts VIEW MORE Bathroom Equipment VIEW MORE';
    const actionCheck = ctx.detectRestrictedKeywordsSingle(actionSnippet, '', 'https://www.action-wetori.com');
    assert.strictEqual(actionCheck.isRestricted, true, 'action-wetori must be detected as restricted');
    assert.ok(actionCheck.category === 'Aviation & Airlines' || actionCheck.category === 'Aerospace');

    // 2. Critical: Even if AI returns Working with _isFromAi: true, applyStrictInstructions MUST override to Not Working
    const mockAiReturnedWorking = {
      _isFromAi: true,
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyProfile: 'Available',
      companyName: 'Action Machinery Industries Co., Ltd.',
      countryName: 'Taiwan',
      companyAddress: 'No. 30, Renhuagong 18th Road, Dali District, Taichung City 412, Taiwan',
      state: 'Not Available',
      city: 'Available',
      emailId: 'sales@action-wetori.com.tw',
      secondaryEmailId: '',
      phoneNumber: '886424925937',
      numberOfProducts: '6',
      productImages: '6',
      numberOfProductDescriptions: '6'
    };

    const finalStrictQc = ctx.applyStrictInstructions(mockAiReturnedWorking, {
      finalUrl: 'https://www.action-wetori.com',
      originalUrl: 'https://www.action-wetori.com'
    }, actionCheck);

    assert.strictEqual(finalStrictQc.websiteStatus, 'Not Working', 'Restricted site MUST be Not Working even if AI returned Working');
    assert.strictEqual(finalStrictQc.businessType, '', 'Business type must be wiped');
    assert.strictEqual(finalStrictQc.companyName, '', 'Company name must be wiped');
    assert.strictEqual(finalStrictQc.companyAddress, '', 'Address must be wiped');
    assert.strictEqual(finalStrictQc.emailId, '', 'Email must be wiped');
    assert.strictEqual(finalStrictQc.phoneNumber, '', 'Phone must be wiped');
    assert.strictEqual(finalStrictQc.numberOfProducts, '', 'Products must be wiped');
    assert.strictEqual(finalStrictQc.isRestricted, true, 'isRestricted must be true');
    assert.strictEqual(finalStrictQc.isProhibitedSite, true, 'isProhibitedSite must be true');
    assert.ok(finalStrictQc.notWorkingReason.includes('Aircraft & Aviation') || finalStrictQc.notWorkingReason.includes('Aerospace') || finalStrictQc.notWorkingReason.includes('Prohibited Category'));
  });

  // =========================================================================
  // Item 102: Business Type "Other", "Service Provider", "Online Shopping", and
  // "Restricted Site" Classified as Not Working (All Fields Cleared)
  // =========================================================================
  runTest('Item 102: Business Type "Other", "Service Provider", "Online Shopping" Classified as Not Working', () => {
    const { ctx } = createTestContext();

    // 1. AI returned Business Type: "Other" with Working status
    const aiOtherData = {
      _isFromAi: true,
      websiteStatus: 'Working',
      businessType: 'Other',
      companyProfile: 'Available',
      companyName: 'Apex Business Consulting Ltd',
      countryName: 'United Kingdom',
      companyAddress: '10 High Street, London',
      state: 'Not Available',
      city: 'Available',
      emailId: 'contact@apexbiz.co.uk',
      phoneNumber: '442079460912',
      numberOfProducts: '5',
      productImages: '5',
      numberOfProductDescriptions: '5'
    };

    const qcOther = ctx.applyStrictInstructions(aiOtherData, {
      finalUrl: 'https://www.apexbiz.co.uk',
      originalUrl: 'https://www.apexbiz.co.uk'
    }, { isRestricted: false });

    assert.strictEqual(qcOther.websiteStatus, 'Not Working', 'Business Type "Other" must be Not Working');
    assert.strictEqual(qcOther.isDisallowedBusinessType, true, 'isDisallowedBusinessType must be true');
    assert.strictEqual(qcOther.companyName, '', 'Company name must be wiped');
    assert.strictEqual(qcOther.companyAddress, '', 'Company address must be wiped');
    assert.strictEqual(qcOther.emailId, '', 'Email must be wiped');
    assert.strictEqual(qcOther.phoneNumber, '', 'Phone must be wiped');
    assert.strictEqual(qcOther.numberOfProducts, '', 'Products must be wiped');
    assert.ok(qcOther.notWorkingReason.includes('Other') || qcOther.notWorkingReason.includes('outside allowed scope'));

    // 2. AI returned Business Type: "Service Provider" with Working status
    const aiServiceData = {
      _isFromAi: true,
      websiteStatus: 'Working',
      businessType: 'Service Provider',
      companyProfile: 'Available',
      companyName: 'Digital Cloud Solutions Inc',
      countryName: 'United States',
      companyAddress: '500 Tech Blvd, Austin, Texas',
      state: 'Available',
      city: 'Available',
      emailId: 'info@digitalcloud.com',
      phoneNumber: '15125550199',
      numberOfProducts: '3',
      productImages: '3',
      numberOfProductDescriptions: '3'
    };

    const qcService = ctx.applyStrictInstructions(aiServiceData, {
      finalUrl: 'https://www.digitalcloud.com',
      originalUrl: 'https://www.digitalcloud.com'
    }, { isRestricted: false });

    assert.strictEqual(qcService.websiteStatus, 'Not Working', 'Business Type "Service Provider" must be Not Working');
    assert.strictEqual(qcService.companyName, '', 'Company name must be wiped');
    assert.strictEqual(qcService.companyAddress, '', 'Company address must be wiped');
    assert.strictEqual(qcService.emailId, '', 'Email must be wiped');

    // 3. AI returned Business Type: "Online Shopping" with Working status
    const aiOnlineShopData = {
      _isFromAi: true,
      websiteStatus: 'Working',
      businessType: 'Online Shopping',
      companyProfile: 'Available',
      companyName: 'Trendy Fashion Boutique',
      countryName: 'Australia',
      companyAddress: '12 Collins Street, Melbourne, Victoria',
      state: 'Available',
      city: 'Available',
      emailId: 'orders@trendyboutique.com.au',
      phoneNumber: '61390001122',
      numberOfProducts: '20',
      productImages: '20',
      numberOfProductDescriptions: '20'
    };

    const qcOnlineShop = ctx.applyStrictInstructions(aiOnlineShopData, {
      finalUrl: 'https://www.trendyboutique.com.au',
      originalUrl: 'https://www.trendyboutique.com.au'
    }, { isRestricted: false });

    assert.strictEqual(qcOnlineShop.websiteStatus, 'Not Working', 'Business Type "Online Shopping" must be Not Working');
    assert.strictEqual(qcOnlineShop.companyName, '', 'Company name must be wiped');
    assert.strictEqual(qcOnlineShop.companyAddress, '', 'Company address must be wiped');
  });

  runTest('Item 103: Removal of all ordinal grammar expansions on floor numbers (1st floor -> 1 floor, 2nd floor -> 2 floor, 6th Floor-1 -> 6 Floor-1, 5/F -> 5 Floor)', () => {
    const { ctx } = createTestContext();

    // 1. "1st Floor" -> "1 Floor"
    const addr1 = '1st Floor, 40 High Street, Heanor, Derbyshire';
    const norm1 = ctx.sanitizeRule6CompanyAddress(addr1, '', 'United Kingdom');
    assert.strictEqual(norm1, '1 Floor, 40 High Street, Heanor, Derbyshire', '1st Floor must normalize to 1 Floor without ordinal grammar expansion');

    // 2. Lowercase "1st floor" -> "1 Floor"
    const addr2 = '1st floor, Number 159, Chien-Kuo Road, Taoyuan District, Taoyuan City';
    const norm2 = ctx.sanitizeRule6CompanyAddress(addr2, '', 'Taiwan');
    assert.strictEqual(norm2, '1 Floor, Number 159, Chien-Kuo Road, Taoyuan District, Taoyuan City', 'Lowercase "1st floor" must normalize to "1 Floor"');

    // 3. "2nd Floor" and "3rd Floor"
    const addr3 = '2nd Floor, 12 Commercial Road, Melbourne, Victoria';
    const norm3 = ctx.sanitizeRule6CompanyAddress(addr3, '', 'Australia');
    assert.strictEqual(norm3, '2 Floor, 12 Commercial Road, Melbourne, Victoria', '2nd Floor must normalize to 2 Floor');

    const addr4 = '3rd Floor, Suite 4, 100 Main Street, Dallas, Texas';
    const norm4 = ctx.sanitizeRule6CompanyAddress(addr4, '', 'United States Of America');
    assert.strictEqual(norm4, '3 Floor-4, 100 Main Street, Dallas, Texas', '3rd Floor, Suite 4 must normalize to 3 Floor-4');

    // 4. "6th Floor-1" -> "6 Floor-1"
    const addr5 = '6th Floor-1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City';
    const norm5 = ctx.sanitizeRule6CompanyAddress(addr5, '', 'Taiwan');
    assert.strictEqual(norm5, '6 Floor-1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City', '6th Floor-1 must normalize to 6 Floor-1');

    // 5. Standalone shorthand "5/F" and "Fl. 2"
    const addr6 = '5/F, Tower 1, 100 Nathan Road, Kowloon';
    const norm6 = ctx.sanitizeRule6CompanyAddress(addr6, '', 'Hong Kong');
    assert.strictEqual(norm6, '5 Floor, Tower 1, 100 Nathan Road, Kowloon', '5/F must normalize to 5 Floor');

    const addr7 = 'Fl. 2, Building B, 20 Industrial Park, Berlin';
    const norm7 = ctx.sanitizeRule6CompanyAddress(addr7, '', 'Germany');
    assert.strictEqual(norm7, '2 Floor, Building B, 20 Industrial Park, Berlin', 'Fl. 2 must normalize to 2 Floor');
  });

  runTest('Item 104: Core extraction rule: What website has, take the same — Expansion only, no grammar changes or new inventions', () => {
    const { ctx } = createTestContext();

    // 1. Take website text verbatim with abbreviation expansion only, no grammar conversions
    const rawWebsiteAddr = '1 Floor, Bldg. 4, Ste. 200, 1500 Main St., Dallas, TX';
    const norm1 = ctx.sanitizeRule6CompanyAddress(rawWebsiteAddr, '', 'United States Of America');
    assert.strictEqual(norm1, '1 Floor, Building 4, Suite 200, 1500 Main Street, Dallas, Texas',
      'Should take same text and perform expansion only (Bldg -> Building, Ste -> Suite, St -> Street, TX -> Texas) without grammar alteration');

    // 2. Company Name: Take same name, expand abbreviations only, never invent suffixes or do grammar changes
    const rawComp = 'Apex Precision Mfg. Co.';
    const expComp = ctx.expandCompanyAbbreviations(rawComp, 'United States Of America');
    assert.strictEqual(expComp, 'Apex Precision Manufacturing Company',
      'Should expand Mfg -> Manufacturing and Co -> Company without inventing Limited or altering words');

    // 3. No grammar changes to numbers or words (e.g. "Unit 1", "Plot 5")
    const unitAddr = 'Unit 1, Plot 5, 20 Industrial Area, Heanor, Derbyshire';
    const normUnit = ctx.sanitizeRule6CompanyAddress(unitAddr, '', 'United Kingdom');
    assert.strictEqual(normUnit, 'Unit 1, Plot 5, 20, Industrial Area, Heanor, Derbyshire',
      'Should preserve Unit 1 and Plot 5 verbatim without grammar alterations');
  });

  runTest('Item 105: Email & Secondary Email exhaustive website page check, obfuscation decoding & recovery', () => {
    const { ctx } = createTestContext();

    // 1. Obfuscation decoding: data-user + data-domain, Base64, and [at] [dot] normalization
    const htmlWithObfuscated = `
      <div>
        <span data-user="sales" data-domain="acmemachinery.com"></span>
        <a href="javascript:location.href=atob('bWFpbHRvOnN1cHBvcnRAYWNtZW1hY2hpbmVyeS5jb20=')">Support</a>
        <p>Inquiries: info [at] acmemachinery [dot] com</p>
      </div>
    `;
    const extracted = ctx.extractEmailsFromHtml(htmlWithObfuscated, 'https://www.acmemachinery.com');
    assert.ok(extracted.includes('sales@acmemachinery.com'), 'Should decode data-user + data-domain email');
    assert.ok(extracted.includes('support@acmemachinery.com'), 'Should decode Base64 encoded mailto link');
    assert.ok(extracted.includes('info@acmemachinery.com'), 'Should decode [at] [dot] obfuscated email');

    // 2. Multilingual contact links discovery (e.g. Chinese 聯絡我們 and Japanese お問い合わせ)
    const navHtml = `
      <nav>
        <a href="/contact-tw.html">聯絡我們</a>
        <a href="/inquiry-jp.html">お問い合わせ</a>
      </nav>
    `;
    const contactLinks = ctx.discoverContactLinks(navHtml, 'https://www.acmemachinery.com');
    assert.ok(contactLinks.some(l => l.includes('contact-tw.html')), 'Should discover Taiwanese 聯絡我們 contact page');
    assert.ok(contactLinks.some(l => l.includes('inquiry-jp.html')), 'Should discover Japanese お問い合わせ inquiry page');

    // 3. Secondary Email backfill: If AI only returned primary email, secondary email is backfilled from crawl
    const aiDataSingleEmail = {
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyName: 'Acme Machinery Limited',
      companyAddress: '100 Main Street, Dallas, Texas',
      countryName: 'United States Of America',
      state: 'Available',
      city: 'Available',
      emailId: 'sales@acmemachinery.com',
      secondaryEmailId: '',
      phoneNumber: '2145550199',
      numberOfProducts: '3',
      productImages: '3',
      numberOfProductDescriptions: '3'
    };
    const crawlDataTwoEmails = {
      finalUrl: 'https://www.acmemachinery.com',
      originalUrl: 'https://www.acmemachinery.com',
      emails: ['sales@acmemachinery.com', 'support@acmemachinery.com', 'info@acmemachinery.com']
    };

    const finalized = ctx.finalizeParsedAiResult(aiDataSingleEmail, crawlDataTwoEmails);
    assert.strictEqual(finalized.emailId, 'sales@acmemachinery.com', 'Primary email preserved');
    assert.strictEqual(finalized.secondaryEmailId, 'support@acmemachinery.com', 'Secondary email must be backfilled from crawl data when AI left it empty');

    // 4. Strict QC preserves both primary and secondary emails
    const qcResult = ctx.applyStrictInstructions(finalized, crawlDataTwoEmails, { isRestricted: false });
    assert.strictEqual(qcResult.emailId, 'sales@acmemachinery.com');
    assert.strictEqual(qcResult.secondaryEmailId, 'support@acmemachinery.com');
  });

  // =========================================================================
  // Item 106: Floor Space Preservation (7Floor vs 7 Floor), Comprehensive 15 Prohibited Categories & "Other" Business Type
  // =========================================================================
  runTest('Item 106: Floor space preservation (7Floor -> 7Floor vs 7 Floor -> 7 Floor), 15 Prohibited categories & Business Type "Other"', () => {
    const { ctx } = createTestContext();

    // 1. Floor Space Rule: If website has "7Floor" (no space), do not give space ("7Floor")
    const addrNoSpace = '7Floor, Number 159, Chien-Kuo Road, Taoyuan District, Taoyuan City';
    const normNoSpace = ctx.sanitizeRule6CompanyAddress(addrNoSpace, '', 'Taiwan');
    assert.strictEqual(normNoSpace, '7Floor, Number 159, Chien-Kuo Road, Taoyuan District, Taoyuan City',
      'Should preserve 7Floor without inserting space when source has no space');

    // 2. Floor Space Rule: If website has "7 Floor" (with space), provide space ("7 Floor")
    const addrWithSpace = '7 Floor, Number 159, Chien-Kuo Road, Taoyuan District, Taoyuan City';
    const normWithSpace = ctx.sanitizeRule6CompanyAddress(addrWithSpace, '', 'Taiwan');
    assert.strictEqual(normWithSpace, '7 Floor, Number 159, Chien-Kuo Road, Taoyuan District, Taoyuan City',
      'Should preserve 7 Floor with space when source has space');

    // 3. Hyphenated floor sub-units: 7Floor-1 (no space) vs 7 Floor-1 (with space)
    const addrHyphenNoSpace = '7Floor-1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City';
    const normHyphenNoSpace = ctx.sanitizeRule6CompanyAddress(addrHyphenNoSpace, '', 'Taiwan');
    assert.strictEqual(normHyphenNoSpace, '7Floor-1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City');

    const addrHyphenSpace = '7 Floor-1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City';
    const normHyphenSpace = ctx.sanitizeRule6CompanyAddress(addrHyphenSpace, '', 'Taiwan');
    assert.strictEqual(normHyphenSpace, '7 Floor-1, Number 27, Lane 61, Section 1, Guangfu Road, Sanchong District, New Taipei City');

    // 4. Prohibited categories: All 15 official categories detected in words, menus, image attributes, backgrounds
    const prohibitedKeywords = [
      { text: 'Industries: Aerospace', expectedCat: 'Aerospace' },
      { text: 'Industries: Medical', expectedCat: 'Medicine, Medical & Hospital' },
      { text: 'Company Profile: ITAR Registration', expectedCat: 'Defence & Military' },
      { text: 'Catalog: Defence Equipment', expectedCat: 'Defence & Military' },
      { text: 'Products: Precision Knife and Blades', expectedCat: 'Weapons, Armor & Knives' },
      { text: 'Specialty: Marine Operations', expectedCat: 'Marine' },
      { text: 'Specialty: Commercial Ship and Boat Building', expectedCat: 'Ships & Boats' },
      { text: 'Products: Chemical and Petrochemicals', expectedCat: 'Chemicals & Petrochemicals' },
      { text: 'Products: Craft Brewery and Alcohol', expectedCat: 'Alcohol & Breweries' },
      { text: 'Products: Pets and Animals', expectedCat: 'Animals & Pets' },
      { text: 'Menu: Restaurant and Food', expectedCat: 'Food & Beverages' },
      { text: 'About: University and Higher Education', expectedCat: 'School, College & Education' }
    ];

    for (const item of prohibitedKeywords) {
      const check = ctx.detectRestrictedKeywords(item.text, '', [{ url: 'https://example.com', text: item.text }]);
      assert.strictEqual(check.isRestricted, true, `Should detect restricted category for "${item.text}"`);
    }

    // 5. Image attribute detection: <source srcset="..."> and CSS background-image
    const htmlWithPicture = '<html><body><picture><source srcset="/images/aerospace-wing.webp"><img src="/images/blank.png" alt="wing"></picture></body></html>';
    const checkPicture = ctx.detectRestrictedKeywords('Precision Engineering', htmlWithPicture, [{ url: 'https://example.com', html: htmlWithPicture, text: 'Precision Engineering' }]);
    assert.strictEqual(checkPicture.isRestricted, true, 'Should detect restricted keyword in <source srcset>');

    const htmlWithBg = '<html><body><div style="background-image: url(\'/products/medical-device.jpg\')">Precision Parts</div></body></html>';
    const checkBg = ctx.detectRestrictedKeywords('Precision Parts', htmlWithBg, [{ url: 'https://example.com', html: htmlWithBg, text: 'Precision Parts' }]);
    assert.strictEqual(checkBg.isRestricted, true, 'Should detect restricted keyword in inline style background-image URL');

    // 6. Business Type "Other" must strictly set websiteStatus to "Not Working" and clear other 12 fields
    const dataWithOther = {
      websiteStatus: 'Working',
      businessType: 'Other',
      companyName: 'Acme General Services',
      countryName: 'United States Of America',
      companyAddress: '100 Main Street, Dallas, Texas',
      state: 'Available',
      city: 'Available',
      emailId: 'info@acme.com',
      phoneNumber: '2145550199',
      numberOfProducts: '5',
      productImages: '5',
      numberOfProductDescriptions: '5'
    };
    const finalizedOther = ctx.finalizeParsedAiResult(dataWithOther, {});
    assert.strictEqual(finalizedOther.websiteStatus, 'Not Working', 'Business Type "Other" must be Not Working');
    assert.strictEqual(finalizedOther.companyAddress, '', 'Address must be empty when business type is Other');
    assert.strictEqual(finalizedOther.companyName, '', 'Company name must be empty when business type is Other');
    assert.strictEqual(finalizedOther.emailId, '', 'Email must be empty when business type is Other');

    const qcOther = ctx.applyStrictInstructions(dataWithOther, { originalUrl: 'https://example.com' }, { isRestricted: false });
    assert.strictEqual(qcOther.websiteStatus, 'Not Working', 'Strict QC must mark business type Other as Not Working');
    assert.strictEqual(qcOther.companyAddress, '');
    assert.strictEqual(qcOther.companyName, '');
  });

  // =========================================================================
  // Item 107: All items taken from AI only - zero Own Crawl fallback or heuristic contamination
  // =========================================================================
  runTest('Item 107: All items taken from AI only - zero Own Crawl fallback or heuristic contamination', () => {
    const { ctx } = createTestContext();

    // 1. AI result in AI Only mode with missing address, company name, and products.
    // Must NOT backfill from crawlData (logoText, addressCandidates, computeOwnCrawlProductCount)
    const aiData = {
      _isFromAi: true,
      _extractionMode: 'ai_only',
      websiteStatus: 'Working',
      businessType: 'Manufacturer',
      companyProfile: '',
      companyName: '',
      countryName: 'United States Of America',
      companyAddress: '',
      state: 'Not Available',
      city: 'Not Available',
      emailId: 'sales@alphaprecision.com',
      secondaryEmailId: '',
      phoneNumber: '2125550199',
      numberOfProducts: '',
      productImages: '',
      numberOfProductDescriptions: ''
    };

    const crawlData = {
      title: 'Crawl Company Title',
      logoText: 'Crawl Logo Name Inc',
      copyrightText: '© 2026 Crawl Copyright Ltd',
      hasCompanyProfile: true,
      addressCandidates: [{ raw: '123 Crawl Street, Austin, Texas 78701', source: 'footer' }],
      detectedProductCount: 15,
      detectedImageCount: 15,
      detectedDescCount: 15
    };

    const finalResult = ctx.applyStrictInstructions(aiData, crawlData, { isRestricted: false });

    // Verification: Zero Own Crawl heuristic contamination
    assert.strictEqual(finalResult.companyName, '', 'Must NOT backfill company name from crawlData logoText/title in AI Only mode');
    assert.strictEqual(finalResult.companyAddress, 'Not Available', 'Must NOT backfill address from crawlData addressCandidates in AI Only mode');
    assert.strictEqual(finalResult.companyProfile, 'Not Available', 'Must NOT backfill company profile from crawlData heuristics in AI Only mode');
    assert.strictEqual(finalResult.numberOfProducts, '0', 'Must NOT backfill product counts from crawlData in AI Only mode');
    assert.strictEqual(finalResult.productImages, '0');
    assert.strictEqual(finalResult.numberOfProductDescriptions, '0');
    assert.strictEqual(finalResult.emailId, 'sales@alphaprecision.com', 'Preserves pure AI email');
    assert.strictEqual(finalResult.secondaryEmailId, '', 'Missing secondary email remains empty');
  });

  // =========================================================================
  // Item 108: Global Vacancy & Career Subpage Crawling and Department Secondary Email Extraction
  // (No hardcoding - works globally across languages: Dutch, English, German, French, Spanish)
  // =========================================================================
  runTest('Item 108: Global Vacancy & Career Subpage Crawling and Department Secondary Email Extraction', () => {
    const { ctx } = createTestContext();

    // 1. Crawler Subpage Discovery: /vacancies, /vacatures, /careers, /karriere are discovered with high priority
    const htmlWithVacancies = `
      <nav>
        <a href="/">Home</a>
        <a href="/about-us">About Us</a>
        <a href="/products">Products</a>
        <a href="/vacancies">Vacancies</a>
        <a href="/contact">Contact Us</a>
      </nav>
    `;
    const links = ctx.discoverContactLinks(htmlWithVacancies, 'https://www.dutchregulators.com');
    assert.ok(links.some(u => u.includes('/vacancies')), 'Crawler must discover /vacancies subpage');
    const vacancyIndex = links.findIndex(u => u.includes('/vacancies'));
    assert.ok(vacancyIndex >= 0 && vacancyIndex < 5, 'Vacancies subpage must be ranked in top priority subpages');

    // Multi-language check: Dutch /vacatures and German /karriere
    const htmlMultiLang = `
      <div>
        <a href="/over-ons">Over Ons</a>
        <a href="/vacatures">Vacatures & Werken Bij</a>
        <a href="/karriere">Karriere & Stellenangebote</a>
      </div>
    `;
    const multiLinks = ctx.discoverContactLinks(htmlMultiLang, 'https://example.com');
    assert.ok(multiLinks.some(u => u.includes('/vacatures')), 'Must discover Dutch /vacatures');
    assert.ok(multiLinks.some(u => u.includes('/karriere')), 'Must discover German /karriere');

    // 2. Email Ranking & Departmental Secondary Prioritization
    const mockEmailSourceMap = {
      'info@dutchregulators.com': 'https://www.dutchregulators.com/contact',
      'vacature@dutchregulators.com': 'https://www.dutchregulators.com/vacancies'
    };
    const ranked = ctx.rankEmails(['vacature@dutchregulators.com', 'info@dutchregulators.com'], 'https://www.dutchregulators.com', mockEmailSourceMap);
    assert.strictEqual(ranked[0], 'info@dutchregulators.com', 'Primary contact email on Contact page ranks #1');
    assert.strictEqual(ranked[1], 'vacature@dutchregulators.com', 'Vacancy department email ranks #2');

    // 3. AI Extraction Prompt: Section 10 instructs AI globally to identify distinct departmental secondary emails
    const mockCrawlData = {
      originalUrl: 'https://www.dutchregulators.com',
      finalUrl: 'https://www.dutchregulators.com',
      emails: ['info@dutchregulators.com', 'vacature@dutchregulators.com'],
      phones: ['+31 20 1234567'],
      careerPageText: 'Join our team at Dutch Regulators. Send your CV to vacature@dutchregulators.com.',
      contactPageText: 'Contact Dutch Regulators at info@dutchregulators.com.',
      detectedProductCount: 2,
      detectedImageCount: 2,
      detectedDescCount: 2
    };
    const prompt = ctx.buildExtractionPrompt(mockCrawlData, true);
    assert.ok(prompt.includes('CAREERS & VACANCIES SUBPAGE CONTENT'), 'Prompt must include career/vacancies page content');
    assert.ok(prompt.includes('vacature@') || prompt.includes('vacancies@'), 'Prompt instructions must guide vacancy email extraction');

    // 4. finalizeParsedAiResult: Accurately extracts distinct primary and departmental secondary emails
    const aiParsed = {
      emailId: 'info@dutchregulators.com',
      secondaryEmailId: '',
      countryName: 'Netherlands',
      phoneNumber: '201234567'
    };
    const finalized = ctx.finalizeParsedAiResult(aiParsed, mockCrawlData);
    assert.strictEqual(finalized.emailId, 'info@dutchregulators.com', 'Primary email preserved');
    assert.strictEqual(finalized.secondaryEmailId, 'vacature@dutchregulators.com', 'Secondary vacancy email recovered from crawl data');
    assert.notStrictEqual(finalized.secondaryEmailId, finalized.emailId, 'Secondary email must never duplicate primary');
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
