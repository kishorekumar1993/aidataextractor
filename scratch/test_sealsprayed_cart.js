async function testCart() {
  // Let's inspect the WooCommerce script / settings in the HTML
  const res = await fetch('https://sealsprayed.com/product/901-high-solids-elastomeric-roof-coating/');
  const t = await res.text();
  
  // Look for wc_checkout_params or payment gateways
  const params = t.match(/var\s+wc_[a-z_]+_params\s*=\s*({[^;]+});/g);
  console.log('WC params found:', params);

  // Look for any mentions of shipping methods, stripe, paypal, or payment in the entire page
  const paymentMentions = t.match(/woocommerce[-_]?(?:gateway|payment|stripe|paypal|square|cod|bacs|cheque)/gi);
  console.log('Payment plugin/gateway mentions:', [...new Set(paymentMentions || [])]);

  // Check if checkout page redirects when empty or what the checkout page actually is
  // When cart has item, does checkout work?
  // Let's simulate adding to cart
  const cookieJar = [];
  const addRes = await fetch('https://sealsprayed.com/product/901-high-solids-elastomeric-roof-coating/?add-to-cart=1147', {
    method: 'GET',
    redirect: 'manual'
  });
  console.log('Add to cart response status:', addRes.status);
  const setCookie = addRes.headers.get('set-cookie');
  console.log('Set-Cookie:', setCookie);

  const cartRes = await fetch('https://sealsprayed.com/cart/', {
    headers: setCookie ? { 'Cookie': setCookie } : {}
  });
  const cartHtml = await cartRes.text();
  console.log('Cart page title:', cartHtml.match(/<title>([^<]+)<\/title>/i)?.[1]);
  const checkoutBtn = cartHtml.match(/href=["'][^"']*checkout[^"']*["']/gi);
  console.log('Proceed to checkout button on cart:', checkoutBtn);
}
testCart().catch(e => console.error(e));

