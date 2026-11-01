const fetch = globalThis.fetch;
const fs = require('fs');
const vm = require('vm');

let bg = fs.readFileSync('background.js', 'utf8');
const sandbox = {
  console, setTimeout, clearTimeout, fetch,
  AbortController: globalThis.AbortController,
  TextDecoder: globalThis.TextDecoder,
  URL: globalThis.URL,
  chrome: {
    runtime: { onMessage: { addListener: ()=>{} } },
    storage: { sync: { get: ()=>Promise.resolve({}) } }
  }
};
vm.createContext(sandbox);
vm.runInContext(bg, sandbox);

async function run() {
  console.log('Crawling http://www.hcsiren.com ...');
  const crawl = await sandbox.crawlWebsite('http://www.hcsiren.com');
  console.log('Crawl detectedAddresses:', crawl.detectedAddresses);
  console.log('contactPageText length:', crawl.contactPageText.length);
  console.log('Has 398 in contactPageText?', crawl.contactPageText.includes('398'));
  console.log('Has Cilong in contactPageText?', crawl.contactPageText.includes('Cilong'));

  const processed = sandbox.applyStrictInstructions({
    companyName: 'Cixi Hongchang Electronics Co., Ltd.',
    countryName: 'China',
    companyAddress: crawl.detectedAddresses[0] || '',
    city: 'Available',
    state: 'Available'
  }, crawl, { isRestricted: false });

  console.log('\n--- FINAL RESULTS ---');
  console.log('Company Name:', processed.companyName);
  console.log('Address     :', processed.companyAddress);
  console.log('Country     :', processed.countryName);
  console.log('State       :', processed.state);
  console.log('City        :', processed.city);
}

run();
