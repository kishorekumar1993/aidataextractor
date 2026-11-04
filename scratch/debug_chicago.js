const fs = require('fs');
const vm = require('vm');
const bgContent = fs.readFileSync('background.js', 'utf8');

const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  URL, Set, Map, Array, Object, RegExp, String, Number, Boolean, parseInt, parseFloat,
  chrome: { runtime: { onMessage: { addListener: () => {} } }, storage: { local: { get: () => {}, set: () => {} } } }
};
vm.createContext(sandbox);
vm.runInContext(bgContent, sandbox);

const addr = "1321 West 119th Street Chicago, IL 60643";
const lower = addr.toLowerCase();

console.log('isPlaceUsedAsStreetName(chicago):', sandbox.isPlaceUsedAsStreetName(lower, "chicago"));
console.log('hasRecognizedPlaceName:', sandbox.hasRecognizedPlaceName(lower, ["chicago"]));
console.log('addressLooksLikeSuburbOnly:', sandbox.addressLooksLikeSuburbOnly(lower));
console.log('detectCityFromStructure:', sandbox.detectCityFromStructure(lower, "United States Of America"));
