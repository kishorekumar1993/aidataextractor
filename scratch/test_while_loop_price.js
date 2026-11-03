const fs = require('fs');
const homeHtml = fs.readFileSync('scratch/sealsprayed.html', 'utf8');
const shopHtml = fs.readFileSync('scratch/sealsprayed_shop.html', 'utf8');
const combinedHtml = homeHtml + "\n" + shopHtml;

function findFirstPositivePrice(html) {
  const priceRegex = /(?:class|id)=["'][^"']*\b(?:product[-_]?price|single[-_]?price|offer[-_]?price|sale[-_]?price|current[-_]?price|regular[-_]?price|woocommerce-Price-amount|entry[-_]?price|price-box|price)\b[^"']*["'][^>]*>[\s\S]{0,150}?(?:[\$£€¥₹]|&#36;|&dollar;|&pound;|&#163;|&euro;|&#8364;|&#165;|&#8377;|AU\$|CA\$|USD|EUR|GBP)[\s\S]{0,30}?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/gi;
  let m;
  while ((m = priceRegex.exec(html)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) {
      return { hasPrice: true, price: val, match: m[0].slice(0, 80) };
    }
  }
  return { hasPrice: false };
}

console.log('Result with while-loop on combinedHtml:', findFirstPositivePrice(combinedHtml));
console.log('Result with while-loop on shopHtml:', findFirstPositivePrice(shopHtml));

