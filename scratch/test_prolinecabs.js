const fs = require('fs');
const vm = require('vm');

const bgCode = fs.readFileSync('background.js', 'utf8');
const sandbox = {
  console, fetch, URL, Set, Array, Math, RegExp, parseInt, isNaN,
  decodeURIComponent, TextDecoder, AbortController, setTimeout, clearTimeout
};
vm.createContext(sandbox);
vm.runInContext('const chrome = { runtime: { onMessage: { addListener: () => {} } }, storage: { sync: { get: (k, cb) => cb({}), set: () => {} } } };' + bgCode, sandbox);

const addr = "Unit 7, Spring Mill, Moor Street, Heywood, Lancashire";
const country = "United Kingdom";

console.log('Address:', addr);
console.log('State:', sandbox.hasStateInAddress(addr, country));
console.log('City:', sandbox.evaluateCityQC(addr, country));
