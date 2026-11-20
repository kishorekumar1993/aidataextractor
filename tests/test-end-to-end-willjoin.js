const fs = require('fs');
const vm = require('vm');

const textUtilsCode = fs.readFileSync('src/shared/text-utils.js', 'utf8');
const countryCode = fs.readFileSync('src/shared/country-normalizer.js', 'utf8');
const phoneCode = fs.readFileSync('src/shared/phone-normalizer.js', 'utf8');
const nonWorkingCode = fs.readFileSync('src/shared/non-working-records.js', 'utf8');
const errRecCode = fs.readFileSync('src/background/error-recorder.js', 'utf8');
const configCode = fs.readFileSync('src/background/config.js', 'utf8');
const geoCode = fs.readFileSync('src/background/geo-data.js', 'utf8');
const restrictedCode = fs.readFileSync('src/background/restricted-rules.js', 'utf8');
const compCode = fs.readFileSync('src/background/company-normalizer.js', 'utf8');
const addrExtCode = fs.readFileSync('src/background/address-extractor.js', 'utf8');
const addrNormCode = fs.readFileSync('src/background/address-normalizer.js', 'utf8');
const locQcCode = fs.readFileSync('src/background/location-qc.js', 'utf8');
const crawlerCode = fs.readFileSync('src/background/crawler.js', 'utf8');
const aiCode = fs.readFileSync('src/background/ai-client.js', 'utf8');
const strictQcCode = fs.readFileSync('src/background/strict-qc.js', 'utf8');

const ctx = vm.createContext({
  URL,
  setTimeout,
  clearTimeout,
  console: { log: console.log, warn: console.warn, error: console.error }
});

vm.runInContext(textUtilsCode, ctx);
vm.runInContext(countryCode, ctx);
vm.runInContext(phoneCode, ctx);
vm.runInContext(nonWorkingCode, ctx);
vm.runInContext(errRecCode, ctx);
vm.runInContext(configCode, ctx);
vm.runInContext(geoCode, ctx);
vm.runInContext(restrictedCode, ctx);
vm.runInContext(compCode, ctx);
vm.runInContext(addrExtCode, ctx);
vm.runInContext(addrNormCode, ctx);
vm.runInContext(locQcCode, ctx);
vm.runInContext(crawlerCode, ctx);
vm.runInContext(aiCode, ctx);
vm.runInContext(strictQcCode, ctx);

const willjoinHtml = fs.readFileSync('willjoin.html', 'utf8');
const extractedEmails = ctx.extractEmailsFromHtml(willjoinHtml, 'http://www.willjoin.com.tw');
console.log('1. Extracted emails:', extractedEmails);

const mockAiResult = {
  websiteStatus: 'Working',
  businessType: 'Manufacturer',
  companyProfile: 'Available',
  companyName: 'Will Join Enterprise Company, Limited',
  companyAddress: 'Number 2, Alley 87, Lane 103 Section 6, Fu An Road, Tainan',
  countryName: 'Taiwan',
  state: 'Not Available',
  city: 'Available',
  emailId: '',
  secondaryEmailId: '',
  phoneNumber: '2581370',
  numberOfProducts: '3',
  productImages: '3',
  numberOfProductDescriptions: '3'
};

const mockCrawlData = {
  finalUrl: 'http://www.willjoin.com.tw',
  originalUrl: 'http://www.willjoin.com.tw',
  emails: extractedEmails,
  phones: ['06-2581370']
};

const finalized = ctx.finalizeParsedAiResult(mockAiResult, mockCrawlData);
console.log('2. Finalized emailId:', finalized.emailId);
console.log('3. Finalized secondaryEmailId:', finalized.secondaryEmailId);

const qcResult = ctx.applyStrictInstructions(finalized, mockCrawlData, { isRestricted: false });
console.log('4. QC Result emailId:', qcResult.emailId);
console.log('5. QC Result secondaryEmailId:', qcResult.secondaryEmailId);
