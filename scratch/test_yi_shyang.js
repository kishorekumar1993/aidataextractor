const fs = require('fs');
const bg = fs.readFileSync('background.js', 'utf8');

const vm = require('vm');
const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  fetch: () => Promise.resolve({ ok: false }),
  chrome: {
    storage: {
      local: {
        get: () => {},
        set: () => {}
      }
    },
    runtime: {
      sendMessage: () => {},
      onMessage: { addListener: () => {} }
    }
  }
};
vm.createContext(sandbox);

try {
  vm.runInContext(bg, sandbox);

  const rawAddress = "No.228, Pao Shun Road, Hoo Hu Li, Chia Yi City, 60079, Taiwan, R.O.C.";
  const crawlData = {
    originalUrl: "http://www.yi-shyang.com.tw",
    finalUrl: "http://www.yi-shyang.com.tw",
    mainHtml: `<div class="add">No.228, Pao Shun Road, Hoo Hu Li, Chia Yi City, 60079, Taiwan, R.O.C.</div>`,
    contactPageText: "No.228, Pao Shun Road, Hoo Hu Li, Chia Yi City, 60079, Taiwan, R.O.C.",
    footerText: "No.228, Pao Shun Road, Hoo Hu Li, Chia Yi City, 60079, Taiwan, R.O.C.",
    bodyText: "Yi Shyang Machinery Company, Limited manufacturer of machinery products",
    title: "Yi Shyang Machinery Company, Limited",
    addressCandidates: [
      { raw: "No.228, Pao Shun Road, Hoo Hu Li, Chia Yi City, 60079, Taiwan, R.O.C.", score: 95 }
    ]
  };

  const initialData = {
    websiteUrl: "http://www.yi-shyang.com.tw",
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyAddress: rawAddress,
    companyName: "Yi Shyang Machinery Company, Limited",
    countryName: "Taiwan",
    numberOfProducts: "3",
    productImages: "3",
    numberOfProductDescriptions: "3"
  };

  const result = sandbox.applyStrictInstructions(initialData, crawlData, { isRestricted: false });
  console.log('Result for yi-shyang.com.tw:');
  console.log('  companyAddress:', result.companyAddress);
  console.log('  countryName:', result.countryName);
  console.log('  city:', result.city);
  console.log('  state:', result.state);
} catch (e) {
  console.error('Error in vm:', e);
}
