const fs = require('fs');
const https = require('https');

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', err => resolve(''));
  });
}

const bg = fs.readFileSync('background.js', 'utf8');

// Evaluate from function stripHtml to checkCompanyProfilePresence
eval(bg.slice(bg.indexOf('function stripHtml'), bg.indexOf('function checkCompanyProfilePresence')));

async function test() {
  const html = await fetch('https://www.amorettibrothers.com/topic/privacy-policy');
  const emails = extractEmailsFromHtml(html, 'amorettibrothers.com');
  console.log('Extracted emails from privacy-policy:', emails);
}
test();
