const fs = require('fs');

// Read background.js content
const bgContent = fs.readFileSync('background.js', 'utf8');

// We can extract or evaluate evaluateCityQC, hasStateInAddress, detectCountryFromAddress, isUnitedStatesLocation
// using vm or an evaluation wrapper
const vm = require('vm');
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  URL,
  Set,
  Map,
  Array,
  Object,
  RegExp,
  String,
  Number,
  Boolean,
  parseInt,
  parseFloat,
  encodeURIComponent,
  decodeURIComponent
};
vm.createContext(sandbox);

// Wrap chrome mock
sandbox.chrome = {
  runtime: { onMessage: { addListener: () => {} } },
  storage: { local: { get: () => {}, set: () => {} } }
};

// Execute background.js in sandbox
vm.runInContext(bgContent, sandbox);

const resultsData = JSON.parse(fs.readFileSync('scratch/results_26_sites.json', 'utf8'));

console.log('=== VERIFYING USA EXTRACTION LOGIC ON 26 SITES ===\n');

let passCount = 0;
let notWorkingCount = 0;

resultsData.forEach((site, idx) => {
  console.log(`[Site #${idx + 1}] ${site.url}`);
  if (site.status === 'Not Working') {
    notWorkingCount++;
    console.log(`  -> Status: Not Working (${site.reason || 'Blocked/Down'})`);
  } else {
    const rawAddr = site.address || `${site.city || ''}, ${site.state || ''} ${site.zip || ''}`;
    const country = sandbox.detectCountryFromAddress(rawAddr);
    const hasState = sandbox.hasStateInAddress(rawAddr, country);
    const cityStatus = sandbox.evaluateCityQC(rawAddr, country);
    const cleanedAddr = sandbox.expandAddressAndStateAbbreviations(rawAddr, country);

    console.log(`  -> Raw Address: "${rawAddr}"`);
    console.log(`  -> Country: ${country}`);
    console.log(`  -> State Available: ${hasState ? 'Available' : 'Not Available'}`);
    console.log(`  -> City Available: ${cityStatus}`);
    console.log(`  -> Cleaned Addr: "${cleanedAddr}"`);

    if (country === 'United States Of America' && hasState && cityStatus === 'Available') {
      passCount++;
      console.log('  -> RESULT: PASS (All fields valid)\n');
    } else {
      console.log('  -> RESULT: NEEDS CHECK\n');
    }
  }
});

console.log(`Summary: ${passCount} Working USA sites passed full QC, ${notWorkingCount} sites correctly identified as Not Working.`);

