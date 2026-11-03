const fs = require('fs');
const html = fs.readFileSync('scratch/sealsprayed_shop.html', 'utf8');

const idx = html.indexOf('woocommerce-Price-currencySymbol');
console.log('Context around woocommerce-Price-currencySymbol:');
console.log(html.slice(idx - 100, idx + 200));

