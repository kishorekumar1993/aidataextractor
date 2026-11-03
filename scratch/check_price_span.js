const fs = require('fs');
const html = fs.readFileSync('scratch/sealsprayed_shop.html', 'utf8');

const pMatches = html.match(/<span[^>]+class=["'][^"']*woocommerce-Price-amount[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi);
console.log('Sample woocommerce-Price-amount spans:', (pMatches || []).slice(0, 3));

