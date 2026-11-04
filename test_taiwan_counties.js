const fs = require('fs');
const vm = require('vm');

const bgCode = fs.readFileSync('background.js', 'utf8');

const sandbox = {
  console: console,
  fetch: global.fetch,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  AbortSignal: AbortSignal,
  Headers: Headers,
  Request: Request,
  Response: Response,
  URL: URL,
  chrome: { runtime: { onMessage: { addListener: () => {} } }, storage: { local: { get: () => {} }, sync: { get: () => {} } } }
};

vm.createContext(sandbox);
vm.runInContext(bgCode, sandbox);

const counties = [
  "Changhua",
  "Chiayi",
  "Hsinchu",
  "Hualien",
  "Kinmen",
  "Lienchiang",
  "Miaoli",
  "Nantou",
  "Penghu",
  "Pingtung",
  "Taitung",
  "Yilan",
  "Yunlin"
];

console.log("=== TESTING TAIWAN COUNTIES STATE DETECTION ===");

let allPassed = true;

for (const c of counties) {
  // Test 1: With "County"
  const addrWithCounty = `No. 100, Zhongshan Road, ${c} County, Taiwan`;
  const resWith = sandbox.hasStateInAddress(addrWithCounty, "Taiwan");
  if (!resWith) {
    console.error(`FAIL: ${c} with County returned false`);
    allPassed = false;
  } else {
    console.log(`PASS: ${c} County -> Available`);
  }

  // Test 2: WITHOUT "County"
  const addrWithoutCounty = `No. 100, Zhongshan Road, ${c}, Taiwan`;
  const resWithout = sandbox.hasStateInAddress(addrWithoutCounty, "Taiwan");
  if (!resWithout) {
    console.error(`FAIL: ${c} without County returned false`);
    allPassed = false;
  } else {
    console.log(`PASS: ${c} (without County) -> Available`);
  }
}

// Negative tests
const neg1 = "No. 12, Banqiao District, New Taipei City, Taiwan";
console.log("Neg 1 (New Taipei City without county):", sandbox.hasStateInAddress(neg1, "Taiwan") === false ? "PASS (Not Available)" : "FAIL");

const neg2 = "No. 88, Nantun District, Taichung City, Taiwan";
console.log("Neg 2 (Taichung City without county):", sandbox.hasStateInAddress(neg2, "Taiwan") === false ? "PASS (Not Available)" : "FAIL");

const neg3 = "No. 5, Changhua Road, Taichung City, Taiwan";
console.log("Neg 3 (Street name Changhua Road in Taichung):", sandbox.hasStateInAddress(neg3, "Taiwan") === false ? "PASS (Not Available)" : "FAIL");

// Positive capital test
const cap = "No. 1, Zhongxiao East Road, Taipei City, Taiwan";
console.log("Capital (Taipei City):", sandbox.hasStateInAddress(cap, "Taiwan") === true ? "PASS (Available)" : "FAIL");

