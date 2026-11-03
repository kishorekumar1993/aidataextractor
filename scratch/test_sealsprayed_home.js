const fs = require('fs');
const html = fs.readFileSync('scratch/sealsprayed.html', 'utf8');

console.log('Homepage contains /shop/:', /href=["'][^"']*\/shop\/?["']/i.test(html));
console.log('Homepage contains /cart/:', /href=["'][^"']*\/cart\/?["']/i.test(html));
console.log('Homepage contains /product/:', /href=["'][^"']*\/product\//i.test(html));
console.log('Homepage contains /product-category/:', /href=["'][^"']*\/product-category\//i.test(html));
console.log('Homepage contains widget-woocommerce-menu-cart:', /widget-woocommerce-menu-cart/i.test(html));
console.log('Homepage contains Cart text in nav:', /<a[^>]*href=["'][^"']*cart[^"']*["'][^>]*>[\s\S]*?<\/a>/i.test(html));

const cartLinkMatch = html.match(/<a[^>]*href=["'][^"']*cart[^"']*["'][^>]*>[\s\S]*?<\/a>/gi);
console.log('Cart link matches:', cartLinkMatch);

const shopLinkMatch = html.match(/<a[^>]*href=["'][^"']*shop[^"']*["'][^>]*>[\s\S]*?<\/a>/gi);
console.log('Shop link matches:', shopLinkMatch);

