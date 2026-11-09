const fs = require('fs');

// Load background.js environment
const bg = fs.readFileSync('background.js', 'utf8');

// Let's test what crawlWebsite('http://www.amoretti.com') returns
eval(bg.slice(bg.indexOf('function isValidCorporateEmail'), bg.indexOf('function checkCompanyProfilePresence')));
eval(bg.slice(bg.indexOf('function isUnwantedEmail'), bg.indexOf('function isValidCorporateEmail')));

console.log("Testing crawl on amoretti.com...");

