const https = require('https');
const fs = require('fs');

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', err => resolve(''));
  });
}

async function run() {
  const h1 = await fetch('https://www.amorettibrothers.com');
  fs.writeFileSync('scratch/amorettibrothers_home.html', h1, 'utf8');
  console.log('Saved amorettibrothers_home.html, len:', h1.length);

  const h2 = await fetch('https://amoretti.com');
  fs.writeFileSync('scratch/amoretti_home.html', h2, 'utf8');
  console.log('Saved amoretti_home.html, len:', h2.length);
}
run();

