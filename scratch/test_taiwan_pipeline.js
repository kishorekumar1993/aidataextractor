const fs = require('fs');
const vm = require('vm');

const raw = "NO.56-106, Zhangma St., Xiushui Township, Changhua County, 504, Taiwan";
const bgCode = fs.readFileSync('background.js', 'utf8');

const sandbox = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  fetch: () => {},
  chrome: { runtime: { onMessage: { addListener: () => {} } } }
};
vm.createContext(sandbox);
vm.runInContext(bgCode, sandbox);

let country = "Taiwan";
let addr = raw;

// expandAddressAndStateAbbreviations
addr = sandbox.expandAddressAndStateAbbreviations(addr, country);
console.log('After expand:', addr);

// Remove country
const countryRegex = new RegExp(`\\b${country}\\b`, "gi");
addr = addr.replace(countryRegex, " ");
console.log('After country strip:', addr);

// Postal codes
addr = sandbox.removePostalCodesCarefully(addr);
console.log('After postal:', addr);

// Comma
addr = sandbox.ensureCommaBeforeState(addr);
console.log('After ensure comma:', addr);

// Format
addr = addr.replace(/\s+,/g, ",");
addr = addr.replace(/,\s*,/g, ", ");
addr = addr.replace(/,\s*/g, ", ");
addr = addr.replace(/[,;.\s\-_/\\|]+$/g, "").trim();
addr = addr.replace(/^[,;.\s\-_/\\|]+/g, "").trim();
addr = addr.replace(/\s+/g, " ");
addr = sandbox.toTitleCase(addr);
addr = addr.replace(/[,;.\s\-_/\\|]+$/g, "").trim();

console.log('Final formatted addr:', addr);
console.log('State:', sandbox.hasStateInAddress(addr, country) ? "Available" : "Not Available");
console.log('City:', sandbox.evaluateCityQC(addr, country));

