const https = require('https');

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve(''));
  });
}

async function run() {
  const pages = [
    'https://www.amorettibrothers.com/',
    'https://www.amorettibrothers.com/pages/contact',
    'https://www.amorettibrothers.com/pages/about-us',
    'https://www.amorettibrothers.com/policies/privacy-policy',
    'https://www.amorettibrothers.com/policies/terms-of-service',
    'https://www.amorettibrothers.com/collections/all'
  ];
  for (const p of pages) {
    const html = await fetch(p);
    if (html.includes('info@amoretti.com')) {
      console.log('FOUND info@amoretti.com in', p);
    }
    if (html.includes('amoretti.com')) {
      console.log('FOUND amoretti.com in', p);
    }
  }
  console.log('Check complete.');
}
run();

