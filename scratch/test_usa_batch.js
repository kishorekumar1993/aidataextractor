const fs = require('fs');
const vm = require('vm');

const sitesToTest = [
  'http://www.eaglestone.net',
  'http://www.predator-software.com',
  'http://www.jacksontransformer.com',
  'http://www.mylestool.com',
  'http://www.tmitransformers.com',
  'http://www.texansigns.com'
];

async function runTest() {
  const bg = fs.readFileSync('background.js', 'utf8');

  const storageMock = {
    get: (keys, cb) => {
      const res = {};
      if (typeof cb === 'function') cb(res);
      return Promise.resolve(res);
    },
    set: (items, cb) => {
      if (typeof cb === 'function') cb();
      return Promise.resolve();
    }
  };

  const ctx = {
    console,
    chrome: {
      runtime: {
        onMessage: { addListener: () => {} },
        getManifest: () => ({ version: '1.0' })
      },
      storage: {
        local: storageMock,
        sync: storageMock
      }
    },
    fetch: globalThis.fetch,
    setTimeout, clearTimeout,
    URL: globalThis.URL,
    Headers: globalThis.Headers,
    Request: globalThis.Request,
    Response: globalThis.Response,
    AbortController: globalThis.AbortController,
    TextDecoder: globalThis.TextDecoder,
    TextEncoder: globalThis.TextEncoder
  };

  vm.createContext(ctx);
  vm.runInContext(bg, ctx);

  for (const site of sitesToTest) {
    try {
      console.log('Testing:', site);
      const res = await ctx.handleCrawlAndExtract(site);
      console.log('RESULT:', JSON.stringify({
        url: site,
        companyName: res.companyName,
        countryName: res.countryName,
        companyAddress: res.companyAddress,
        state: res.state,
        city: res.city
      }, null, 2));
    } catch (e) {
      console.error('Error for', site, e.message);
    }
  }
}

runTest();
