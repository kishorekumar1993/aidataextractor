const https = require('https');

function fetch(url) {
  return new Promise(resolve => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve(''));
  });
}

async function run() {
  const bundles = [
    'https://cdn.prod.website-files.com/5a8f4df32ac2910001fb60df/js/webflow.schunk.78cb8371a037d463.js',
    'https://cdn.prod.website-files.com/5a8f4df32ac2910001fb60df/js/webflow.schunk.0623c442a5d77096.js',
    'https://cdn.prod.website-files.com/5a8f4df32ac2910001fb60df/js/webflow.4e3c9507.d79ed96490c8a934.js'
  ];
  for (const b of bundles) {
    const text = await fetch(b);
    const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    console.log(b, [...new Set(emails)]);
  }
}
run();

