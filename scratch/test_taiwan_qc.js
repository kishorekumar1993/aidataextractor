const fs = require('fs');
const vm = require('vm');

const chineseAddress = "馬興村彰馬街56-106號, 秀水鄉, 彰化縣";
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

console.log('Address:', chineseAddress);
console.log('hasStateInAddress:', sandbox.hasStateInAddress(chineseAddress, "Taiwan"));
console.log('evaluateCityQC:', sandbox.evaluateCityQC(chineseAddress, "Taiwan"));
