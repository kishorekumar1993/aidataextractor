const fs = require('fs');
const bg = fs.readFileSync('background.js', 'utf8');

global.chrome = {
  runtime: { getURL: (p) => p },
  storage: { local: { get: (k, cb) => cb({}), set: (v, cb) => cb && cb() } }
};

let cwCode = bg.slice(bg.indexOf('async function crawlWebsite'), bg.indexOf('function parseHtmlDetails'));
eval(bg.slice(bg.indexOf('async function fetchDecodedHtml'), bg.indexOf('async function crawlWebsite')));
eval(bg.slice(bg.indexOf('function isRedirectDomain'), bg.indexOf('function formatFullAddress')));
eval(bg.slice(bg.indexOf('function parseHtmlDetails'), bg.indexOf('function isUnwantedEmail')));
eval(bg.slice(bg.indexOf('function isUnwantedEmail'), bg.indexOf('function checkCompanyProfilePresence')));
eval(bg.slice(bg.indexOf('function checkCompanyProfilePresence'), bg.indexOf('function cleanCompanyPrefixesAndSuffixes')));
eval(bg.slice(bg.indexOf('function cleanCompanyPrefixesAndSuffixes'), bg.indexOf('function cleanDomainStem')));

// Replace the main catch at line 1601
const idx = cwCode.lastIndexOf('} catch (e) { }');
cwCode = cwCode.slice(0, idx) + '} catch (e) { console.error("MAIN CRAWL TRY ERROR:", e); }' + cwCode.slice(idx + 15);
eval(cwCode);

async function test() {
  const res = await crawlWebsite('http://www.amoretti.com');
  console.log("Result status:", res.status, "emails:", res.emails);
}
test();
