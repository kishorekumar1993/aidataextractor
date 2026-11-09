const https = require('https');
https.get('https://www.amorettibrothers.com', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const socials = [...d.matchAll(/https?:\/\/(?:www\.)?(?:facebook|instagram|linkedin|twitter|pinterest|youtube)\.com\/[^"'>\s\)]+/gi)].map(m => m[0]);
    console.log('Socials:', [...new Set(socials)]);
  });
});

