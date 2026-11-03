global.chrome = {
  runtime: { onMessage: { addListener: () => {} } },
  storage: { sync: { get: () => Promise.resolve({}) } }
};

const fs = require('fs');
const bgCode = fs.readFileSync('background.js', 'utf8');
eval(bgCode);

const homeHtml = fs.readFileSync('scratch/sealsprayed.html', 'utf8');
const shopHtml = fs.readFileSync('scratch/sealsprayed_shop.html', 'utf8');
const combinedHtml = homeHtml + "\n" + shopHtml;

console.log('--- TEST 1: sealsprayed.com Homepage Alone ---');
const resHome = detectPurchaseOrShoppingCart(homeHtml, stripHtml(homeHtml));
console.log('detected:', resHome.detected);
console.log('reason:', resHome.reason);
console.log('isEcommerce:', resHome.isEcommerce);
console.log('isB2BCatalog:', resHome.isB2BCatalog);

console.log('\n--- TEST 2: sealsprayed.com Combined (Home + Shop) ---');
const resCombined = detectPurchaseOrShoppingCart(combinedHtml, stripHtml(combinedHtml));
console.log('detected:', resCombined.detected);
console.log('reason:', resCombined.reason);
console.log('isEcommerce:', resCombined.isEcommerce);
console.log('isB2BCatalog:', resCombined.isB2BCatalog);

console.log('\n--- TEST 3: Dominion Doors & Windows (B2B Showcase) ---');
const b2bHtml = `
<html>
  <body>
    <h1>Dominion Doors and Windows Limited</h1>
    <p>Vinyl windows and doors manufacturer in Ontario, Canada.</p>
    <a href="/quote">Request a Quote</a>
    <a href="/specs">Product Specifications</a>
    <p>Contact: admin@dominiondw.com</p>
  </body>
</html>
`;
const resB2B = detectPurchaseOrShoppingCart(b2bHtml, stripHtml(b2bHtml));
console.log('detected (expect false):', resB2B.detected);
console.log('isB2BCatalog (expect true):', resB2B.isB2BCatalog);

console.log('\n--- TEST 4: Venturo Cranes (B2B Manufacturer) ---');
const venturoHtml = `
<html>
  <body>
    <h1>Venco Venturo Industries</h1>
    <p>Manufacturer of truck cranes and hoists.</p>
    <a href="/dealer-locator">Find a Dealer</a>
    <p>Sales: info@venturo.com</p>
  </body>
</html>
`;
const resVenturo = detectPurchaseOrShoppingCart(venturoHtml, stripHtml(venturoHtml));
console.log('detected (expect false):', resVenturo.detected);
console.log('isB2BCatalog (expect true):', resVenturo.isB2BCatalog);
