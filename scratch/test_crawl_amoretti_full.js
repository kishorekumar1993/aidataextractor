const fs = require('fs');
const bg = fs.readFileSync('background.js', 'utf8');

// Mock Chrome extension APIs if needed
global.chrome = {
  runtime: { getURL: (p) => p },
  storage: { local: { get: (k, cb) => cb({}), set: (v, cb) => cb && cb() } }
};

eval(bg.slice(bg.indexOf('function decodeRot13'), bg.indexOf('async function crawlWebsite')));
eval(bg.slice(bg.indexOf('function isRedirectDomain'), bg.indexOf('function formatFullAddress')));
eval(bg.slice(bg.indexOf('async function crawlWebsite'), bg.indexOf('function parseHtmlDetails')));
eval(bg.slice(bg.indexOf('function parseHtmlDetails'), bg.indexOf('function isUnwantedEmail')));
eval(bg.slice(bg.indexOf('function isUnwantedEmail'), bg.indexOf('function checkCompanyProfilePresence')));
eval(bg.slice(bg.indexOf('function checkCompanyProfilePresence'), bg.indexOf('function cleanCompanyPrefixesAndSuffixes')));
eval(bg.slice(bg.indexOf('function cleanCompanyPrefixesAndSuffixes'), bg.indexOf('function cleanDomainStem')));

async function test() {
  console.log("Starting crawl of http://www.amoretti.com ...");
  const res = await crawlWebsite('http://www.amoretti.com');
  console.log("Crawl Status:", res.status);
  console.log("Final URL:", res.finalUrl);
  console.log("Discovered Emails:", res.emails);
}
test().catch(console.error);
