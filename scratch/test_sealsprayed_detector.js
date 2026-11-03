const fs = require('fs');

// Load home and shop HTML
const homeHtml = fs.readFileSync('scratch/sealsprayed.html', 'utf8');
const shopHtml = fs.readFileSync('scratch/sealsprayed_shop.html', 'utf8');
const combinedHtml = homeHtml + "\n" + shopHtml;

// Test currency regex with HTML entities & commas
function testPrice(html) {
  const currencyRegex = /(?:[\$£€¥₹]|&#36;|&dollar;|&pound;|&#163;|&euro;|&#8364;|&#165;|&#8377;|AU\$|CA\$|USD|EUR|GBP)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i;
  const match = html.match(currencyRegex);
  if (match) {
    const val = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return { hasPrice: true, price: val };
  }
  return { hasPrice: false };
}

// Test cart action
function testCartAction(html) {
  const cartActionRegex = /(?:[?&]add-to-cart=\d+|\b(?:add_to_cart_button|ajax_add_to_cart|single_add_to_cart_button|wc-block-cart|snipcart-add-item|shopify-payment-button)\b|<(?:button|a|input)[^>]*>[\s\S]{0,100}?\b(?:add\s+to\s+cart|add\s+to\s+bag|add\s+to\s+basket|buy\s+now|order\s+now|buy\s+online)\b)/i;
  const match = html.match(cartActionRegex);
  return { hasCart: !!match, signal: match ? match[0].slice(0, 80) : '' };
}

// Test checkout / cart gateway
function testCheckout(html) {
  const checkoutRegex = /(?:<a[^>]+href=["'][^"']*(?:\/(?:checkout|express_checkout|onepagecheckout|cart\/checkout|cart|basket)\b)(?:\/|["'?#])|<form[^>]+action=["'][^"']*(?:\/(?:checkout|cart)\b)|\b(?:widget-woocommerce-menu-cart|wc-cart-fragments|checkout\.stripe\.com|paypal\.com\/checkout|pay\.shopify\.com)\b)/i;
  const match = html.match(checkoutRegex);
  return { hasCheckout: !!match, signal: match ? match[0].slice(0, 80) : '' };
}

console.log('--- TESTING ON COMBINED SEALSRAYED HTML ---');
const pRes = testPrice(combinedHtml);
const cRes = testCartAction(combinedHtml);
const chRes = testCheckout(combinedHtml);

console.log('Price:', pRes);
console.log('Cart:', cRes);
console.log('Checkout / Cart:', chRes);

const isOnlineShopping = cRes.hasCart && pRes.hasPrice && chRes.hasCheckout;
console.log('Is Online Shopping:', isOnlineShopping);

