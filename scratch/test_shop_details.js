const fs = require('fs');
const html = fs.readFileSync('scratch/sealsprayed_shop.html', 'utf8');

console.log('Price elements:', html.match(/class=["'][^"']*price[^"']*["'][^>]*>[\s\S]*?<\/[a-z]+>/gi));
console.log('Dollar matches:', html.match(/&#36;\s*[\d,.]+/g));
console.log('Currency symbols:', (html.match(/(?:woocommerce-Price-currencySymbol|Price-amount)[\s\S]{0,100}/g) || []).slice(0, 5));
console.log('WooCommerce cart link:', html.match(/href=["'][^"']*cart[^"']*["']/gi));
console.log('WooCommerce checkout link:', html.match(/href=["'][^"']*checkout[^"']*["']/gi));

