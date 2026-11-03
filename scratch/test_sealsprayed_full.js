global.chrome = {
  runtime: { onMessage: { addListener: () => {} } },
  storage: { sync: { get: () => Promise.resolve({ apiKey: process.env.GEMINI_API_KEY || "dummy", model: "gemini-2.5-flash-lite" }) } }
};

const fs = require('fs');
const bgCode = fs.readFileSync('background.js', 'utf8');
eval(bgCode);

async function testSealsprayed() {
  const crawlResult = await crawlWebsite('https://sealsprayed.com/');
  console.log('crawlResult status:', crawlResult.status);
  console.log('shopCartCheck:', crawlResult.shopCartCheck);

  const finalResult = applyStrictInstructions({
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "Seal Sprayed Solutions",
    countryName: "Jamaica",
    companyAddress: "6 Trinidad Terrace, Kingston 5, Jamaica",
    state: "Not Available",
    city: "Available",
    emailId: "info@sealja.com",
    secondaryEmailId: "sealspraytt@gmail.com",
    phoneNumber: "8769686239",
    numberOfProducts: "3",
    productImages: "3",
    numberOfProductDescriptions: "3"
  }, crawlResult);

  console.log('\n--- FINAL RESULT FROM APPLYSTRICTINSTRUCTIONS ---');
  console.log('websiteStatus:', finalResult.websiteStatus);
  console.log('businessType:', finalResult.businessType);
  console.log('isShopCartSite:', finalResult.isShopCartSite);
}

testSealsprayed().catch(e => console.error(e));

