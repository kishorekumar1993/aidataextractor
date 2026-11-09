const fs = require('fs');
const bg = fs.readFileSync('background.js', 'utf8');

eval(bg.slice(bg.indexOf('function decodeRot13'), bg.indexOf('async function crawlWebsite')));

async function test() {
  const res = await fetchDecodedHtml('http://www.amoretti.com');
  console.log('Status:', res.status, 'OK:', res.ok, 'Redirected:', res.redirected, 'URL:', res.url);
  console.log('HTML length:', res.html.length);
  console.log('HTML preview:', res.html.slice(0, 500));
}
test();

