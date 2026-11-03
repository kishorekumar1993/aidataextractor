global.chrome = {
  runtime: { onMessage: { addListener: () => {} } },
  storage: { sync: { get: () => Promise.resolve({ apiKey: "dummy" }) } }
};

const fs = require('fs');
const bgCode = fs.readFileSync('background.js', 'utf8');
eval(bgCode);

async function testFetch() {
  const res = await fetchDecodedHtml('https://sealsprayed.com/');
  console.log('fetchDecodedHtml res:', res.ok, res.html.length, res.status);
}
testFetch().catch(e => console.error(e));

