global.chrome = {
  runtime: { onMessage: { addListener: () => {} } },
  storage: { sync: { get: () => Promise.resolve({ apiKey: "dummy" }) } }
};

const fs = require('fs');
const bgCode = fs.readFileSync('background.js', 'utf8');
eval(bgCode);

async function testLinks() {
  const crawlResult = await crawlWebsite('https://sealsprayed.com/');
  console.log('mainHtml length:', crawlResult.mainHtml.length);
  console.log('contactHtml length:', crawlResult.contactHtml.length);
  console.log('Does contactHtml include /shop/?', crawlResult.contactHtml.includes('/shop/?add-to-cart'));
  console.log('Does contactHtml include add_to_cart_button?', crawlResult.contactHtml.includes('add_to_cart_button'));
  console.log('Does contactHtml include 25,300?', crawlResult.contactHtml.includes('25,300'));
}
testLinks().catch(e => console.error(e));

