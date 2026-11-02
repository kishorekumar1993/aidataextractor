const fs = require('fs');
const vm = require('vm');

async function testFurcoPipeline() {
  const bgCode = fs.readFileSync('background.js', 'utf8');

  const sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    fetch: fetch,
    TextDecoder: TextDecoder,
    AbortController: AbortController,
    URL: URL,
    Headers: Headers,
    Response: Response,
    Request: Request,
    chrome: { runtime: { onMessage: { addListener: () => {} } } }
  };
  vm.createContext(sandbox);
  vm.runInContext(bgCode, sandbox);

  console.log('Crawling http://www.furco.com.tw...');
  const crawlData = await sandbox.crawlWebsite('http://www.furco.com.tw');
  console.log('Crawl status:', crawlData.status);
  console.log('Address candidates count:', crawlData.addressCandidates.length);
  console.log('Address candidates:');
  console.dir(crawlData.addressCandidates, { depth: null });
  console.log('Detected addresses (top 3):', crawlData.detectedAddresses.slice(0, 3));

  // Test address selection when Gemini returns Chinese address
  const selectedWhenGeminiReturnedChinese = sandbox.verifyAndSelectAddress("馬興村彰馬街56-106號, 秀水鄉, 彰化縣", crawlData.addressCandidates);
  console.log('\nverifyAndSelectAddress (Gemini Chinese):', selectedWhenGeminiReturnedChinese);

  // Test address selection when Gemini returns English address
  const selectedWhenGeminiReturnedEnglish = sandbox.verifyAndSelectAddress("NO.56-106, Zhangma St., Xiushui Township, Changhua County", crawlData.addressCandidates);
  console.log('verifyAndSelectAddress (Gemini English):', selectedWhenGeminiReturnedEnglish);

  // Test full post processing with applyStrictInstructions
  const mockGeminiOutput = {
    websiteStatus: "Working",
    businessType: "Manufacturer",
    companyProfile: "Available",
    companyName: "Furco Industrial Company Limited",
    countryName: "Taiwan",
    companyAddress: selectedWhenGeminiReturnedChinese, // even if Gemini gave Chinese!
    state: "Available",
    city: "Available",
    emailId: "rep@furco.com.tw",
    secondaryEmailId: "malisse.yang@msa.hinet.net",
    phoneNumber: "+886-4-7617357",
    numberOfProducts: "3",
    productImages: "3",
    numberOfProductDescriptions: "3"
  };

  const finalResult = sandbox.applyStrictInstructions(mockGeminiOutput, crawlData, { isRestricted: false });
  console.log('\nFinal applyStrictInstructions result:');
  console.log('Company Name:', finalResult.companyName);
  console.log('Company Address:', finalResult.companyAddress);
  console.log('Country Name:', finalResult.countryName);
  console.log('State:', finalResult.state);
  console.log('City:', finalResult.city);
  console.log('Phone Number:', finalResult.phoneNumber);
  console.log('Email Id:', finalResult.emailId);
  console.log('Secondary Email Id:', finalResult.secondaryEmailId);
  console.log('Company Profile:', finalResult.companyProfile);
  console.log('Products:', finalResult.numberOfProducts, finalResult.productImages, finalResult.numberOfProductDescriptions);
}

testFurcoPipeline();