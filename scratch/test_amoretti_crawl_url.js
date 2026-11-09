const fs = require('fs');

// Load background.js environment
const bg = fs.readFileSync('background.js', 'utf8');

// Let's test what fetchDecodedHtml does on 'http://www.amoretti.com' and 'https://amoretti.com'
const http = require('http');
const https = require('https');

async function testFetch(targetUrl) {
  return new Promise((resolve) => {
    const client = targetUrl.startsWith('https') ? https : http;
    client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, (res) => {
      console.log(targetUrl, 'Status:', res.statusCode, 'Location:', res.headers.location);
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, data }));
    }).on('error', err => resolve({ err: err.message }));
  });
}

async function run() {
  const r1 = await testFetch('http://www.amoretti.com');
  const r2 = await testFetch('https://www.amoretti.com');
  const r3 = await testFetch('https://amoretti.com');
  console.log('r3 length:', r3.data ? r3.data.length : 0);
  if (r3.data) {
    const emails = r3.data.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    console.log('r3 emails:', Array.from(new Set(emails)));
  }
}
run();

