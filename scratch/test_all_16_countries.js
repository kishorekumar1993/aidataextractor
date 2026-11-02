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

console.log('=== TEST SUITE: 16 Priority Countries (City & State QC) ===\n');

// 1. United States
console.log('-- 1. United States --');
assert('US State by named state', sandbox.hasStateInAddress('100 Main St, Kansas City, Missouri', 'United States of America'), true);
assert('US State by County', sandbox.hasStateInAddress('100 Tech Park, Orange County', 'United States of America'), true);
assert('US City: Kansas City (explicit City)', sandbox.evaluateCityQC('100 Main St, Kansas City, Missouri', 'United States of America'), 'Available');
assert('US City: Cherry Hill Township (Township)', sandbox.evaluateCityQC('200 Route 70, Cherry Hill Township, New Jersey', 'United States of America'), 'Available');
assert('US City: City Road (street name only -> Not Available)', sandbox.evaluateCityQC('123 City Road, Boston, Massachusetts', 'United States of America'), 'Not Available');

// 2. Taiwan
console.log('\n-- 2. Taiwan --');
assert('Taiwan State by County (Changhua County)', sandbox.hasStateInAddress('No. 655, Lu Luh Road, Xiushui Township, Changhua County', 'Taiwan'), true);
assert('Taiwan State: Taipei City (Capital)', sandbox.hasStateInAddress('No. 100 Gongyuan Road, Taipei City', 'Taiwan'), true);
assert('Taiwan State: New Taipei City (NOT capital)', sandbox.hasStateInAddress('456 High Street, New Taipei City', 'Taiwan'), false);
assert('Taiwan City: Xiushui Township', sandbox.evaluateCityQC('No. 655, Lu Luh Road, Xiushui Township, Changhua County', 'Taiwan'), 'Available');
assert('Taiwan City: Banqiao District, New Taipei City', sandbox.evaluateCityQC('456 High Street, Banqiao District, New Taipei City', 'Taiwan'), 'Available');
assert('Taiwan City: New Taipei City alone (Not Available)', sandbox.evaluateCityQC('456 High Street, New Taipei City', 'Taiwan'), 'Not Available');
assert('Taiwan City: Taichung City (explicit City)', sandbox.evaluateCityQC('No. 100 Gongyuan Road, Taichung City', 'Taiwan'), 'Available');

// 3. United Kingdom
console.log('\n-- 3. United Kingdom --');
assert('UK State by County (Greater Manchester)', sandbox.hasStateInAddress('Piccadilly Gardens, Manchester, Greater Manchester', 'United Kingdom'), true);
assert('UK State: London (Capital)', sandbox.hasStateInAddress('10 Downing Street, London, SW1A 2AA', 'United Kingdom'), true);
assert('UK City: London (Available)', sandbox.evaluateCityQC('10 Downing Street, London, SW1A 2AA', 'United Kingdom'), 'Available');
assert('UK City: Manchester (Available)', sandbox.evaluateCityQC('Piccadilly Gardens, Manchester, M1 1RN', 'England'), 'Available');
assert('UK City: Birmingham (Available)', sandbox.evaluateCityQC('Centenary Square, Birmingham, B1 2ND', 'UK'), 'Available');

// 4. Canada
console.log('\n-- 4. Canada --');
assert('Canada State by Province (Ontario)', sandbox.hasStateInAddress('100 King Street West, Toronto, Ontario', 'Canada'), true);
assert('Canada State: Ottawa (Capital)', sandbox.hasStateInAddress('Parliament Hill, Wellington St, Ottawa', 'Canada'), true);
assert('Canada City: Township of Langley', sandbox.evaluateCityQC('20338 65 Ave, Township of Langley, British Columbia', 'Canada'), 'Available');
assert('Canada City: Quebec City', sandbox.evaluateCityQC('100 Rue Saint-Jean, Quebec City, Quebec', 'Canada'), 'Available');

// 5. China
console.log('\n-- 5. China --');
assert('China State by Province (Zhejiang Province)', sandbox.hasStateInAddress('398# Cilong East Road, Jin\'ao Village, Longshan Town, Cixi City, Zhejiang Province', 'China'), true);
assert('China State: Beijing (Capital)', sandbox.hasStateInAddress('No. 1 Dongchanganjie, Beijing', 'China'), true);
assert('China City: Cixi City (explicit City)', sandbox.evaluateCityQC('No. 123 Binhai Road, Cixi City, Zhejiang Province', 'China'), 'Available');
assert('China City: Longshan Town (Town)', sandbox.evaluateCityQC('398 Cilong East Road, Longshan Town, Zhejiang Province', 'China'), 'Available');
assert('China City: Chaoyang District (District)', sandbox.evaluateCityQC('10 Jianguomenwai Dajie, Chaoyang District, Beijing', 'China'), 'Available');

// 6. Malaysia
console.log('\n-- 6. Malaysia --');
assert('Malaysia State by State (Selangor)', sandbox.hasStateInAddress('2 Jalan Koporat 1/Ku9, Klang, Selangor', 'Malaysia'), true);
assert('Malaysia State: Kuala Lumpur (Capital)', sandbox.hasStateInAddress('Jalan Ampang, Kuala Lumpur', 'Malaysia'), true);
assert('Malaysia City: Bandar Klang (Bandar = Town/City)', sandbox.evaluateCityQC('Jalan Meru, Bandar Klang, Selangor', 'Malaysia'), 'Available');
assert('Malaysia City: Daerah Petaling (Daerah = District)', sandbox.evaluateCityQC('Persiaran Barat, Daerah Petaling, Selangor', 'Malaysia'), 'Available');

// 7. Australia
console.log('\n-- 7. Australia --');
assert('Australia State by State (Victoria)', sandbox.hasStateInAddress('100 Collins Street, Melbourne, Victoria', 'Australia'), true);
assert('Australia State: Canberra (Capital)', sandbox.hasStateInAddress('Parliament House, Canberra', 'Australia'), true);
assert('Australia City: Shire of Yarra Ranges', sandbox.evaluateCityQC('Anderson Street, Shire of Yarra Ranges, Victoria', 'Australia'), 'Available');
assert('Australia City: City of Sydney', sandbox.evaluateCityQC('456 George Street, City of Sydney, New South Wales', 'Australia'), 'Available');

// 8. India
console.log('\n-- 8. India --');
assert('India State by State (Maharashtra)', sandbox.hasStateInAddress('MIDC Industrial Area, Thane District, Maharashtra', 'India'), true);
assert('India State: New Delhi (Capital)', sandbox.hasStateInAddress('Connaught Place, New Delhi', 'India'), true);
assert('India City: Thane District (District)', sandbox.evaluateCityQC('Plot 15, Wagle Estate, Thane District, Maharashtra', 'India'), 'Available');
assert('India City: Taluka Haveli', sandbox.evaluateCityQC('Chakan MIDC, Taluka Haveli, Maharashtra', 'India'), 'Available');

// 9. South Africa
console.log('\n-- 9. South Africa --');
assert('South Africa State by Province (Gauteng)', sandbox.hasStateInAddress('Randburg Municipality, Gauteng', 'South Africa'), true);
assert('South Africa State: Pretoria (Capital)', sandbox.hasStateInAddress('Church Square, Pretoria', 'South Africa'), true);
assert('South Africa City: Ekurhuleni Municipality', sandbox.evaluateCityQC('Corner Cross Street, Ekurhuleni Municipality, Gauteng', 'South Africa'), 'Available');
assert('South Africa City: City of Cape Town Metropolitan Municipality', sandbox.evaluateCityQC('Hertzog Boulevard, City of Cape Town Metropolitan Municipality, Western Cape', 'South Africa'), 'Available');

// 10. New Zealand
console.log('\n-- 10. New Zealand --');
assert('New Zealand State by Region (Canterbury)', sandbox.hasStateInAddress('100 Colombo Street, Christchurch, Canterbury', 'New Zealand'), true);
assert('New Zealand State: Wellington (Capital)', sandbox.hasStateInAddress('Lambton Quay, Wellington', 'New Zealand'), true);
assert('New Zealand City: Selwyn District', sandbox.evaluateCityQC('Norman Kirk Drive, Selwyn District, Canterbury', 'New Zealand'), 'Available');

// 11. Italy
console.log('\n-- 11. Italy --');
assert('Italy State by Region (Lombardia)', sandbox.hasStateInAddress('Via Monte Napoleone 8, Milano, Lombardia', 'Italy'), true);
assert('Italy State by Provincia (Provincia di Brescia)', sandbox.hasStateInAddress('Via Industriale 12, Provincia di Brescia', 'Italy'), true);
assert('Italy State: Roma (Capital)', sandbox.hasStateInAddress('Via del Corso, Roma', 'Italy'), true);
assert('Italy City: Comune di Milano', sandbox.evaluateCityQC('Via Roma 10, Comune di Milano', 'Italy'), 'Available');
assert('Italy City: Municipio I', sandbox.evaluateCityQC('Piazza Venezia, Municipio I, Roma', 'Italy'), 'Available');

// 12. Thailand
console.log('\n-- 12. Thailand --');
assert('Thailand State by Changwat (Changwat Rayong)', sandbox.hasStateInAddress('Sukhumvit Road, Changwat Rayong', 'Thailand'), true);
assert('Thailand State: Bangkok (Capital)', sandbox.hasStateInAddress('Silom Road, Bangkok', 'Thailand'), true);
assert('Thailand City: Amphoe Mueang', sandbox.evaluateCityQC('Sukhumvit Road, Amphoe Mueang, Rayong', 'Thailand'), 'Available');
assert('Thailand City: Thesaban Nakhon Chiang Mai', sandbox.evaluateCityQC('Chang Khlan Road, Thesaban Nakhon Chiang Mai', 'Thailand'), 'Available');

// 13. Ireland
console.log('\n-- 13. Ireland --');
assert('Ireland State by Co. (Co. Kildare)', sandbox.hasStateInAddress('Main Street, Naas, Co. Kildare', 'Ireland'), true);
assert('Ireland State by County name (Galway)', sandbox.hasStateInAddress('Shop Street, Galway, Ireland', 'Ireland'), true);
assert('Ireland State: Dublin (Capital)', sandbox.hasStateInAddress('O\'Connell Street, Dublin', 'Ireland'), true);
assert('Ireland City: Galway City', sandbox.evaluateCityQC('Eyre Square, Galway City, County Galway', 'Ireland'), 'Available');
assert('Ireland City: Municipal District of Bray', sandbox.evaluateCityQC('Main Street, Municipal District of Bray, Co. Wicklow', 'Ireland'), 'Available');

// 14. Singapore
console.log('\n-- 14. Singapore --');
assert('Singapore State: Singapore (Capital)', sandbox.hasStateInAddress('10 Marina Boulevard, Singapore', 'Singapore'), true);
assert('Singapore City: Tampines Town', sandbox.evaluateCityQC('5 Tampines Central 1, Tampines Town, Singapore', 'Singapore'), 'Available');

// 15. Indonesia
console.log('\n-- 15. Indonesia --');
assert('Indonesia State by Provinsi (Provinsi Jawa Barat)', sandbox.hasStateInAddress('Jalan Ahmad Yani, Provinsi Jawa Barat', 'Indonesia'), true);
assert('Indonesia State: Jakarta (Capital)', sandbox.hasStateInAddress('Jalan M.H. Thamrin, Jakarta', 'Indonesia'), true);
assert('Indonesia City: Kota Surabaya', sandbox.evaluateCityQC('Jalan Basuki Rahmat, Kota Surabaya, Jawa Timur', 'Indonesia'), 'Available');
assert('Indonesia City: Kabupaten Bekasi', sandbox.evaluateCityQC('Cikarang Industrial Estate, Kabupaten Bekasi, Jawa Barat', 'Indonesia'), 'Available');

// 16. Germany
console.log('\n-- 16. Germany --');
assert('Germany State by Bundesland (Bayern)', sandbox.hasStateInAddress('Industriestr. 12, 80331 München, Bayern', 'Germany'), true);
assert('Germany State by Landkreis (Landkreis München)', sandbox.hasStateInAddress('Gewerbestr. 4, Landkreis München', 'Germany'), true);
assert('Germany State: Berlin (Capital)', sandbox.hasStateInAddress('Unter den Linden, Berlin', 'Germany'), true);
assert('Germany City: Stadt München', sandbox.evaluateCityQC('Marienplatz 1, Stadt München, Bayern', 'Germany'), 'Available');
assert('Germany City: Gemeinde Feldkirchen', sandbox.evaluateCityQC('Kapellenstraße 1, Gemeinde Feldkirchen, Bayern', 'Germany'), 'Available');
assert('Germany City: Bezirk Mitte', sandbox.evaluateCityQC('Alexanderplatz, Bezirk Mitte, Berlin', 'Germany'), 'Available');

if (!allPassed) {
  console.error('\nSOME TESTS FAILED!');
  process.exit(1);
} else {
  console.log('\nALL 16 COUNTRIES PASSED BOTH CITY AND STATE QC VERIFICATION! ✓✓✓');
}

