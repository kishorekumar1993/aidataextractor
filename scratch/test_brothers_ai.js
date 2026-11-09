const fs = require('fs');

global.window = global;
global.chrome = {
  runtime: { onMessage: { addListener: () => {} }, getURL: (p) => p },
  storage: { local: { get: (k, cb) => cb({ geminiApiKey: 'test' }), set: (v, cb) => cb && cb() } },
  tabs: { query: (q, cb) => cb([]), sendMessage: () => {} }
};

const bgCode = fs.readFileSync('background.js', 'utf8');
(0, eval)(bgCode);

async function testBrothers() {
  const crawlRes = await crawlWebsite('http://www.amorettibrothers.com');
  console.log("Amoretti Brothers crawl emails:", crawlRes.emails);

  const mockAiOutput = {
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "Amoretti Brothers Incorporated",
    countryName: "United States Of America",
    companyAddress: "Suite 260, 2021 Guadalupe Street, Austin, Texas",
    state: "Available",
    city: "Available",
    emailId: "office@amorettibrothers.com",
    secondaryEmailId: "",
    phoneNumber: "9179151981",
    numberOfProducts: "3",
    productImages: "3",
    numberOfProductDescriptions: "3"
  };

  const processed = applyStrictInstructions(mockAiOutput, crawlRes, { isRestricted: false });
  console.log("Processed Amorettibrothers.com:", {
    emailId: processed.emailId,
    secondaryEmailId: processed.secondaryEmailId
  });
}

testBrothers();

