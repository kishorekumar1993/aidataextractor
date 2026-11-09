const fs = require('fs');
const https = require('https');

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', err => resolve(''));
  });
}

// Read discoverContactLinks from background.js
const bg = fs.readFileSync('background.js', 'utf8');
const fnMatch = bg.match(/function discoverContactLinks\(html, baseUrl\) \{[\s\S]*?return Array\.from\(new Set\(candidates\.map\(c => c\.url\)\)\);\s*\}/);

eval(fnMatch[0]);

async function test() {
  const html = await fetch('https://www.amorettibrothers.com');
  const links = discoverContactLinks(html, 'https://www.amorettibrothers.com');
  console.log('Discovered Contact Links:', links);
}
test();

