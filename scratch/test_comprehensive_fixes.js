const fs = require('fs');
const vm = require('vm');

const bgCode = fs.readFileSync('background.js', 'utf8');
const sandbox = {
  console, fetch, URL, Set, Array, Math, RegExp, parseInt, isNaN,
  decodeURIComponent, TextDecoder, AbortController, setTimeout, clearTimeout
};
vm.createContext(sandbox);
vm.runInContext('const chrome = { runtime: { onMessage: { addListener: () => {} } }, storage: { sync: { get: (k, cb) => cb({}), set: () => {} } } };' + bgCode, sandbox);

let allPassed = true;
function assert(desc, actual, expected) {
  const ok = actual === expected;
  if (!ok) allPassed = false;
  console.log(`${ok ? '✓ PASS' : '✗ FAIL'}: ${desc}\n  Actual:   "${actual}"\n  Expected: "${expected}"`);
}

console.log('=== TEST 1: Malaysian KU, KS, PJU, USJ and Milestone Bt Expansions ===');
assert(
  'Malaysian 1/Ku9 expansion',
  sandbox.expandAddressAndStateAbbreviations('2 Jalan Koporat 1/Ku9, Taman Perindustrian Meru, Klang, Selangor', 'Malaysia'),
  '2 Jalan Koporat 1/Klang Utara 9, Taman Perindustrian Meru, Klang, Selangor'
);
assert(
  'Malaysian KU-9 expansion',
  sandbox.expandAddressAndStateAbbreviations('No. 5, Jalan Meru, KU-9, Klang, Selangor', 'Malaysia'),
  'Number 5, Jalan Meru, Klang Utara 9, Klang, Selangor'
);
assert(
  'Malaysian KS1 expansion',
  sandbox.expandAddressAndStateAbbreviations('Jalan Pandamaran, KS1, Klang, Selangor', 'Malaysia'),
  'Jalan Pandamaran, Klang Selatan 1, Klang, Selangor'
);
assert(
  'Malaysian PJU 1 expansion',
  sandbox.expandAddressAndStateAbbreviations('Jalan PJU 1/42, Dataran Prima, Petaling Jaya', 'Malaysia'),
  'Jalan Petaling Jaya Utara 1/42, Dataran Prima, Petaling Jaya'
);
assert(
  'Malaysian USJ 10 expansion',
  sandbox.expandAddressAndStateAbbreviations('Jalan USJ 10/1, Subang Jaya', 'Malaysia'),
  'Jalan UEP Subang Jaya 10/1, Subang Jaya'
);
assert(
  'Bt 8 expands to Batu 8 (milestone)',
  sandbox.expandAddressAndStateAbbreviations('Bt 8, Jalan Klang Lama, Selangor', 'Malaysia'),
  'Batu 8, Jalan Klang Lama, Selangor'
);
assert(
  'Bt Caves expands to Batu Caves',
  sandbox.expandAddressAndStateAbbreviations('Kawasan Industri Bt Caves, Selangor', 'Malaysia'),
  'Kawasan Industri Batu Caves, Selangor'
);
assert(
  'Bt Timah expands to Bukit Timah',
  sandbox.expandAddressAndStateAbbreviations('10 Bt Timah Road', 'Singapore'),
  '10 Bukit Timah Road'
);

console.log('\n=== TEST 2: UK City QC Evaluation ===');
assert(
  'UK London returns Available',
  sandbox.evaluateCityQC('10 Downing Street, London, SW1A 2AA', 'United Kingdom'),
  'Available'
);
assert(
  'UK Manchester returns Available',
  sandbox.evaluateCityQC('Piccadilly Gardens, Manchester, M1 1RN', 'England'),
  'Available'
);
assert(
  'UK Birmingham returns Available',
  sandbox.evaluateCityQC('Centenary Square, Birmingham, B1 2ND', 'UK'),
  'Available'
);
assert(
  'UK Edinburgh returns Available',
  sandbox.evaluateCityQC('Princes Street, Edinburgh, EH2 2EQ', 'Scotland'),
  'Available'
);
assert(
  'UK Glasgow returns Available',
  sandbox.evaluateCityQC('George Square, Glasgow, G2 1DU', 'Scotland'),
  'Available'
);
assert(
  'UK London Borough Camden returns Available',
  sandbox.evaluateCityQC('High Street, Camden, London, NW1 7JE', 'England'),
  'Available'
);
assert(
  'UK Reading town returns Available',
  sandbox.evaluateCityQC('123 London Road, Reading, RG1 5AQ', 'United Kingdom'),
  'Available'
);

console.log('\n=== TEST 3: City QC (Structural and designated cities are Available) ===');
assert(
  'USA Boston with state is Available',
  sandbox.evaluateCityQC('123 Main Street, Boston, Massachusetts', 'United States of America'),
  'Available'
);
assert(
  'USA San Francisco with state is Available',
  sandbox.evaluateCityQC('456 Market Street, San Francisco, California', 'United States of America'),
  'Available'
);
assert(
  'South Africa Cape Town with state is Available',
  sandbox.evaluateCityQC('789 Long Street, Cape Town, Western Cape', 'South Africa'),
  'Available'
);
assert(
  'Taiwan New Taipei City without district is Not Available',
  sandbox.evaluateCityQC('456 High Street, New Taipei City', 'Taiwan'),
  'Not Available'
);
assert(
  'Taiwan New Taipei City with District is Available',
  sandbox.evaluateCityQC('456 High Street, Banqiao District, New Taipei City', 'Taiwan'),
  'Available'
);
assert(
  'Taiwan Xiushui Township is Available',
  sandbox.evaluateCityQC('No. 655, Lu Luh Road, Xiushui Township, Changhua County', 'Taiwan'),
  'Available'
);
assert(
  'China Longshan Town, Cixi City is Available',
  sandbox.evaluateCityQC('398 Cilong East Road, Jin\'ao Village, Longshan Town, Cixi City, Zhejiang Province', 'China'),
  'Available'
);

console.log('\n=== TEST 4: International Address Abbreviation Expansions ===');
assert(
  'Italy V.le and Zona Ind. expansion',
  sandbox.expandAddressAndStateAbbreviations('V.le delle Industrie 15, Zona Ind. Nord, Milano', 'Italy'),
  'Viale delle Industrie 15, Zona Industriale North, Milano'
);
assert(
  'Germany Industriestr. expansion',
  sandbox.expandAddressAndStateAbbreviations('Industriestr. 12, 80331 München, BY', 'Germany'),
  'Industriestrasse 12, 80331 München, Bayern'
);

console.log('\n=== TEST 5: Complete applyStrictInstructions pipeline ===');
const taiwanRaw = {
  websiteStatus: 'Working',
  businessType: 'Manufacturer',
  companyProfile: 'Available',
  companyName: 'Say Nen Gear Co., Ltd.',
  companyAddress: 'No. 655, Lu Luh Road, Xiushui Township, Changhua County',
  countryName: 'Taiwan',
  state: 'Available',
  city: 'Available',
  emailId: 'saynen@ms34.hinet.net',
  phoneNumber: '47684006',
  numberOfProducts: '3',
  productImages: '3',
  numberOfProductDescriptions: '3'
};
const taiwanProcessed = sandbox.applyStrictInstructions(taiwanRaw, { status: 'Working', mainHtml: '<html>test</html>', addressCandidates: [] }, { isRestricted: false });
assert('Taiwan Address formatted with Number', taiwanProcessed.companyAddress, 'Number 655, Lu Luh Road, Xiushui Township, Changhua County');
assert('Taiwan City is Available (Xiushui Township)', taiwanProcessed.city, 'Available');
assert('Taiwan State is Available (Changhua County)', taiwanProcessed.state, 'Available');

const chinaRaw = {
  websiteStatus: 'Working',
  businessType: 'Manufacturer',
  companyProfile: 'Available',
  companyName: 'Cixi Hongchang Electronics Company Limited',
  companyAddress: '398# Cilong East Road, Jin\'ao Village, Longshan Town, Cixi City, Zhejiang Province, China',
  countryName: 'China',
  state: 'Available',
  city: 'Available',
  emailId: 'kama@hcsiren.com',
  phoneNumber: '57463789931',
  numberOfProducts: '3',
  productImages: '3',
  numberOfProductDescriptions: '3'
};
const chinaProcessed = sandbox.applyStrictInstructions(chinaRaw, { status: 'Working', mainHtml: '<html>test</html>', addressCandidates: [] }, { isRestricted: false });
assert('China Address full road and village preserved', chinaProcessed.companyAddress, 'Number 398, Cilong East Road, Jin\'Ao Village, Longshan Town, Cixi City, Zhejiang Province');
assert('China City is Available (Longshan Town, Cixi City)', chinaProcessed.city, 'Available');
assert('China State is Available (Zhejiang Province)', chinaProcessed.state, 'Available');

console.log('\n=== TEST 6: Company name keeps Ltd / Co. Ltd full form ===');
assert(
  'Co., Ltd expands to Company Limited',
  sandbox.expandCompanyAbbreviations('Say Nen Gear Co., Ltd.'),
  'Say Nen Gear Company Limited'
);
assert(
  'Ltd expands to Limited',
  sandbox.expandCompanyAbbreviations('Acme Trading Ltd'),
  'Acme Trading Limited'
);
const restored = sandbox.restoreLegalSuffixIfOmitted('Acme Trading', {
  copyrightText: '© 2024 Acme Trading Co., Ltd. All Rights Reserved',
  footerText: 'Acme Trading Co., Ltd',
  contactPageText: '',
  profilePageText: ''
});
assert(
  'Missing Ltd suffix restored from copyright',
  sandbox.expandCompanyAbbreviations(restored).replace(/\s+/g, ' ').trim(),
  'Acme Trading Company Limited'
);
const coOnly = sandbox.restoreLegalSuffixIfOmitted('Cixi Hongchang Electronics Company', {
  copyrightText: 'Cixi Hongchang Electronics Co., Ltd',
  footerText: '',
  contactPageText: '',
  profilePageText: ''
});
assert(
  'Company without Ltd restores Co., Ltd from copyright',
  /ltd|limited/i.test(coOnly),
  true
);

console.log('\n=== TEST 7: Company profile Available when About/business evidence exists ===');
assert(
  'Dedicated profile page text marks profile present',
  sandbox.checkCompanyProfilePresence('<html></html>', 'Welcome', 'About Us\nWe are a manufacturer of electronic sirens established in 2004 with a factory in Cixi.'),
  true
);
const profileProcessed = sandbox.applyStrictInstructions(
  {
    websiteStatus: 'Working',
    businessType: 'Manufacturer',
    companyProfile: 'Not Available',
    companyName: 'Cixi Hongchang Electronics Co., Ltd',
    companyAddress: '398 Cilong East Road, Longshan Town, Cixi City, Zhejiang Province',
    countryName: 'China',
    state: 'Not Available',
    city: 'Not Available',
    emailId: 'kama@hcsiren.com',
    phoneNumber: '57463789931',
    numberOfProducts: '3',
    productImages: '3',
    numberOfProductDescriptions: '3'
  },
  {
    status: 'Working',
    mainHtml: '<html><a href="/about-us.html">About Us</a><h2>About Us</h2><p>We are a professional manufacturer established in 2004.</p></html>',
    bodyText: 'We are a professional manufacturer established in 2004 specializing in electronic sirens.',
    profilePageText: 'About Us We are a professional manufacturer of electronic sirens established in 2004.',
    hasCompanyProfile: false,
    addressCandidates: []
  },
  { isRestricted: false }
);
assert('Profile becomes Available when About Us content is found', profileProcessed.companyProfile, 'Available');

console.log('\n=== TEST 8: State Available for named states missing from the old short list ===');
assert(
  'Washington state name is Available',
  sandbox.hasStateInAddress('1200 4th Avenue, Seattle, Washington', 'United States of America'),
  true
);
assert(
  'Taoyuan in Taiwan address is Available',
  sandbox.hasStateInAddress('Yangmei District, Taoyuan', 'Taiwan'),
  true
);
assert(
  'Johor is Available',
  sandbox.hasStateInAddress('Jalan Persiaran, Johor Bahru, Johor', 'Malaysia'),
  true
);

if (!allPassed) {
  console.error('\nSOME TESTS FAILED!');
  process.exit(1);
} else {
  console.log('\nALL TESTS PASSED SUCCESSFULLY! ✓✓✓');
}
