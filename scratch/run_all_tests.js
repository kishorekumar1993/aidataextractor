const fs = require('fs');
const vm = require('vm');

async function runAllTests() {
  const bg = fs.readFileSync('background.js', 'utf8');
  const storageMock = { get: (k, cb) => { if (typeof cb === 'function') cb({}); return Promise.resolve({}); }, set: (k, cb) => { if (typeof cb === 'function') cb(); return Promise.resolve(); } };
  const ctx = {
    console,
    chrome: { runtime: { onMessage: { addListener: () => {} }, getManifest: () => ({ version: '1.0' }) }, storage: { local: storageMock, sync: storageMock } },
    fetch: globalThis.fetch, setTimeout, clearTimeout, URL: globalThis.URL, Headers: globalThis.Headers, Request: globalThis.Request, Response: globalThis.Response,
    AbortController: globalThis.AbortController, TextDecoder: globalThis.TextDecoder, TextEncoder: globalThis.TextEncoder
  };
  vm.createContext(ctx);
  vm.runInContext(bg, ctx);

  console.log('==================================================');
  console.log('TEST 1: http://www.speed-hz.com');
  const speed = await ctx.handleCrawlAndExtract('http://www.speed-hz.com');
  console.log('Speed-hz Results:');
  console.log('  Status:', speed.websiteStatus);
  console.log('  Business Type:', speed.businessType);
  console.log('  Profile:', speed.companyProfile);
  console.log('  Company Name:', speed.companyName);
  console.log('  Country:', speed.countryName);
  console.log('  Address:', speed.companyAddress);
  console.log('  State:', speed.state);
  console.log('  City:', speed.city);

  console.log('==================================================');
  console.log('TEST 2: http://www.nationalfire.com');
  const nat = await ctx.handleCrawlAndExtract('http://www.nationalfire.com');
  console.log('NationalFire Results:');
  console.log('  Address:', nat.companyAddress);
  console.log('  Company Name:', nat.companyName);
  console.log('  Country:', nat.countryName);
  console.log('  State:', nat.state);
  console.log('  City:', nat.city);

  console.log('==================================================');
  console.log('TEST 3: http://www.chunlin.com.tw');
  const chun = await ctx.handleCrawlAndExtract('http://www.chunlin.com.tw');
  console.log('Chunlin Results:');
  console.log('  Company Name:', chun.companyName);
  console.log('  Country:', chun.countryName);
  console.log('  Address:', chun.companyAddress);
  console.log('  State:', chun.state);
  console.log('  City:', chun.city);

  console.log('==================================================');
  console.log('TEST 4: http://www.cablecorporation.com');
  const cable = await ctx.handleCrawlAndExtract('http://www.cablecorporation.com');
  console.log('Cable Corporation Results:');
  console.log('  Status:', cable.websiteStatus);
  console.log('  Company Name:', cable.companyName);
  console.log('  Country:', cable.countryName);
  console.log('  Address:', cable.companyAddress);
  console.log('  State:', cable.state);
  console.log('  City:', cable.city);
  console.log('==================================================');
  console.log('TEST 5: http://www.yi-shyang.com.tw');
  const yi = await ctx.handleCrawlAndExtract('http://www.yi-shyang.com.tw');
  console.log('Yi Shyang Results:');
  console.log('  Status:', yi.websiteStatus);
  console.log('  Company Name:', yi.companyName);
  console.log('  Country:', yi.countryName);
  console.log('  Address:', yi.companyAddress);
  console.log('  State:', yi.state);
  console.log('  City:', yi.city);
  console.log('==================================================');
}
runAllTests();

