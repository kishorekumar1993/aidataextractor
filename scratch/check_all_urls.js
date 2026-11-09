const http = require('http');
const https = require('https');

function get(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ url, status: res.statusCode, data }));
    }).on('error', err => resolve({ url, err: err.message }));
  });
}

async function run() {
  const r1 = await get('http://www.amorettibrothers.com');
  console.log('r1 status:', r1.status, 'len:', r1.data ? r1.data.length : 0);
  if (r1.data) console.log('r1 has info@amoretti.com:', r1.data.includes('info@amoretti.com'));

  const r2 = await get('http://amorettibrothers.com');
  console.log('r2 status:', r2.status, 'len:', r2.data ? r2.data.length : 0);
  if (r2.data) console.log('r2 has info@amoretti.com:', r2.data.includes('info@amoretti.com'));

  const r3 = await get('https://amorettibrothers.com');
  console.log('r3 status:', r3.status, 'len:', r3.data ? r3.data.length : 0);
  if (r3.data) console.log('r3 has info@amoretti.com:', r3.data.includes('info@amoretti.com'));
}
run();

