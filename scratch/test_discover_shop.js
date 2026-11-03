global.chrome = {
  runtime: { onMessage: { addListener: () => {} } },
  storage: { sync: { get: () => Promise.resolve({ apiKey: "dummy" }) } }
};

const fs = require('fs');
let bgCode = fs.readFileSync('background.js', 'utf8');

// Modify discoverContactLinks in memory for testing
bgCode = bgCode.replace(
  'if (/\\b(sales|inquiry|enquiry|inquiries|enquiries|quote|request-quote|request-a-quote|order|orders)\\b/i.test(rawLower)) score += 8;',
  `if (/\\b(sales|inquiry|enquiry|inquiries|enquiries|quote|request-quote|request-a-quote|order|orders)\\b/i.test(rawLower)) score += 8;
    if (/\\b(shop|store|online-store|cart|basket|products)\\b/i.test(rawLower)) score += 8;
    if (/\\b(shop|store|online\\s*store|cart|basket|buy\\s*online)\\b/i.test(innerText)) score += 9;`
);

eval(bgCode);

const homeHtml = fs.readFileSync('scratch/sealsprayed.html', 'utf8');
const links = discoverContactLinks(homeHtml, 'https://sealsprayed.com/');
console.log('Discovered links with shop support:', links);

