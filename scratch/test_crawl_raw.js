global.chrome = {
  runtime: { onMessage: { addListener: () => {} } },
  storage: { sync: { get: () => Promise.resolve({ apiKey: "dummy" }) } }
};

const fs = require('fs');
const bgCode = fs.readFileSync('background.js', 'utf8');
eval(bgCode);

async function testCrawl() {
  const crawlResult = await crawlWebsite('https://sealsprayed.com/');
  console.log('Target URL:', crawlResult.originalUrl);
  console.log('Status:', crawlResult.status);
  console.log('Fetch error:', crawlResult.fetchError);
  console.log('ShopCartCheck result:', crawlResult.shopCartCheck);
}

testCrawl().catch(e => console.error(e));

