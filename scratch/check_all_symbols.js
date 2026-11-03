const fs = require('fs');
const html = fs.readFileSync('scratch/sealsprayed_shop.html', 'utf8');

let idx = 0;
for (let i = 0; i < 5; i++) {
  idx = html.indexOf('woocommerce-Price-currencySymbol', idx + 1);
  if (idx === -1) break;
  console.log(`\n--- Occurrence ${i + 1} ---`);
  console.log(html.slice(idx - 50, idx + 150));
}

