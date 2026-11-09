const fs = require('fs');

global.window = global;
global.chrome = {
  runtime: { onMessage: { addListener: () => {} }, getURL: (p) => p },
  storage: { local: { get: (k, cb) => cb({ geminiApiKey: 'test' }), set: (v, cb) => cb && cb() } },
  tabs: { query: (q, cb) => cb([]), sendMessage: () => {} }
};

const bgCode = fs.readFileSync('background.js', 'utf8');
(0, eval)(bgCode);

async function testAmoretti() {
  const crawlRes = await crawlWebsite('http://www.amoretti.com');
  console.log("Amoretti crawl emails:", crawlRes.emails);

  const mockAiOutput = {
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "Amoretti",
    countryName: "United States Of America",
    companyAddress: "451 Richardson Drive, Oxnard, California 93030",
    state: "Available",
    city: "Available",
    emailId: "orders@amoretti.com",
    secondaryEmailId: "",
    phoneNumber: "8059832888",
    numberOfProducts: "3",
    productImages: "3",
    numberOfProductDescriptions: "3"
  };

  const processed = applyStrictInstructions(mockAiOutput, crawlRes, { isRestricted: false });
  console.log("Processed Amoretti.com:", {
    emailId: processed.emailId,
    secondaryEmailId: processed.secondaryEmailId
  });
}

testAmoretti();

