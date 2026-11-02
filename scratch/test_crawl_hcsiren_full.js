const fs = require('fs');
const vm = require('vm');

async function run() {
  const bgCode = fs.readFileSync('background.js', 'utf8');
  
  const sandbox = {
    console,
    fetch,
    URL,
    Set,
    Array,
    Math,
    RegExp,
    parseInt,
    isNaN,
    decodeURIComponent,
    TextDecoder,
    AbortController,
    setTimeout,
    clearTimeout
  };
  vm.createContext(sandbox);
  const wrapped = `
    const chrome = {
      runtime: { onMessage: { addListener: () => {} } },
      storage: { sync: { get: (k, cb) => cb({}), set: () => {} } }
    };
    ${bgCode}
    globalThis.crawlWebsite = crawlWebsite;
    globalThis.verifyAndSelectAddress = verifyAndSelectAddress;
    globalThis.applyStrictInstructions = applyStrictInstructions;
    globalThis.detectRestrictedKeywords = detectRestrictedKeywords;
  `;
  vm.runInContext(wrapped, sandbox);

  console.log('Crawling http://www.hcsiren.com...');
  const crawlData = await sandbox.globalThis.crawlWebsite('http://www.hcsiren.com');
  console.log('Crawl status:', crawlData.status);
  console.log('Candidates found:', crawlData.addressCandidates);

  const selected = sandbox.globalThis.verifyAndSelectAddress("Longshan Town, Cixi City, Zhejiang Province", crawlData.addressCandidates);
  console.log('Selected address if Gemini returned short:', selected);

  const rawData = {
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "Cixi Hongchang Electronics Company Limited",
    companyAddress: "Longshan Town, Cixi City, Zhejiang Province",
    countryName: "China",
    state: "Available",
    city: "Available",
    emailId: "kama@hcsiren.com",
    secondaryEmailId: "liuqin85@hotmail.com",
    phoneNumber: "57463789931",
    numberOfProducts: "3",
    productImages: "3",
    numberOfProductDescriptions: "3"
  };

  const restricted = sandbox.globalThis.detectRestrictedKeywords(crawlData.combinedText || "");
  const finalized = sandbox.globalThis.applyStrictInstructions(rawData, crawlData, restricted);
  console.log('Finalized Company Address:', finalized.companyAddress);
}
run();
