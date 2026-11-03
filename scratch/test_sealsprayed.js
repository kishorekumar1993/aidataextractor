const fs = require('fs');
const html = fs.readFileSync('scratch/sealsprayed.html', 'utf8');

const linkRegex = /href=["']([^"']+)["']/gi;
const links = [];
let m;
while ((m = linkRegex.exec(html)) !== null) {
  links.push(m[1]);
}

const productLinks = [...new Set(links.filter(l => /product|shop|cart|coating|sealant|item|category/i.test(l)))];
console.log("Found product/shop links:", productLinks.slice(0, 20));

// Check if WooCommerce / Shopify / Cart / Prices exist
console.log("Has woocommerce:", /woocommerce/i.test(html));
console.log("Has cart link:", /href=["'][^"']*cart/i.test(html));
console.log("Has checkout link:", /href=["'][^"']*checkout/i.test(html));
console.log("Has Add to Cart:", /add\s+to\s+cart/i.test(html));
console.log("Has Request a Quote / Get a Quote:", /get\s+a\s+quote|request\s+a\s+quote/i.test(html));
console.log("Price matches:", [...html.matchAll(/[\$£€]\s*\d+(?:\.\d{2})?/g)].map(m => m[0]).slice(0, 10));

