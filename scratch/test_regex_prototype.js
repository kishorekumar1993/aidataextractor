const fs = require('fs');
const homeHtml = fs.readFileSync('scratch/sealsprayed.html', 'utf8');
const shopHtml = fs.readFileSync('scratch/sealsprayed_shop.html', 'utf8');

// Test currency regex with HTML entities
const currencyRegex = /(?:[\$£€¥₹]|&#36;|&dollar;|&pound;|&#163;|&euro;|&#8364;|&#165;|&#8377;|AU\$|CA\$|USD|EUR|GBP)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i;

console.log('Testing price regex on &#36;13,512.00:');
const m1 = '&#36;13,512.00'.match(currencyRegex);
console.log('Match 1:', m1 ? m1[1].replace(/,/g, '') : null);

console.log('Testing price regex on $49.99:');
const m2 = '$49.99'.match(currencyRegex);
console.log('Match 2:', m2 ? m2[1].replace(/,/g, '') : null);

console.log('Testing price on shopHtml:');
const mShop = shopHtml.match(currencyRegex);
console.log('Match shop:', mShop ? mShop[1].replace(/,/g, '') : null);

// Test add-to-cart detection on shopHtml
const cartActionRegex = /(?:[?&]add-to-cart=\d+|\b(?:add_to_cart_button|ajax_add_to_cart|single_add_to_cart_button|wc-block-cart|snipcart-add-item|shopify-payment-button)\b|<(?:button|a|input)[^>]*>[\s\S]{0,100}?\b(?:add\s+to\s+cart|add\s+to\s+bag|add\s+to\s+basket|buy\s+now|order\s+now|buy\s+online)\b)/i;
console.log('Cart action on shopHtml:', cartActionRegex.test(shopHtml));
console.log('Cart action on homeHtml:', cartActionRegex.test(homeHtml));

// Test active shop route on homeHtml
const shopRouteRegex = /<a[^>]+href=["'][^"']*\/(?:shop|store|online[-_]?store)\/?["'][^>]*>[\s\S]{0,60}?\b(?:shop|store|online\s+store|buy\s+online)\b/i;
console.log('Shop route on homeHtml:', shopRouteRegex.test(homeHtml));

