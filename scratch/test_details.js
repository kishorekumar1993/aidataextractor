const fs = require('fs');

global.chrome = {
  storage: {
    sync: { get: async () => ({}) },
    local: { set: () => {}, get: async () => ({}) }
  },
  runtime: { onMessage: { addListener: () => {} } }
};
global.self = global;

eval(fs.readFileSync('background.js', 'utf8'));

console.log('--- TEST West Midlands in UK ---');
const addr = 'Bay 3, Block J, Stourbridge Industrial Estate, Mill Race Lane, Stourbridge, West Midlands';
console.log('hasStateInAddress with country United Kingdom:', hasStateInAddress(addr, 'United Kingdom'));
console.log('hasStateInAddress with country England:', hasStateInAddress(addr, 'England'));

console.log('--- TEST Stourbridge City ---');
console.log('evaluateCityQC for Stourbridge:', evaluateCityQC(addr, 'United Kingdom'));
