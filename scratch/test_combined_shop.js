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
const res = detectPurchaseOrShoppingCart(combinedHtml, stripHtml(combinedHtml));
console.log('Result when /shop/ is included:', JSON.stringify(res, null, 2));

