async function checkPrice() {
  const prodRes = await fetch('https://sealsprayed.com/product/901-high-solids-elastomeric-roof-coating/');
  const html = await prodRes.text();
  
  // Search for price tags or woocommerce price
  const priceMatches = html.match(/<p[^>]+class=["'][^"']*price[^"']*["'][^>]*>[\s\S]*?<\/p>/gi);
  console.log('Price paragraphs:', priceMatches);

  const amountMatches = html.match(/class=["'][^"']*woocommerce-Price-amount[^"']*["'][^>]*>[\s\S]*?<\/span>/gi);
  console.log('Amount matches:', amountMatches);

  // Check form action
  const formMatches = html.match(/<form[^>]+class=["'][^"']*cart[^"']*["'][^>]*>[\s\S]*?<\/form>/gi);
  console.log('Cart form found:', formMatches ? formMatches[0].slice(0, 300) : 'none');

  // Check checkout page
  const checkoutRes = await fetch('https://sealsprayed.com/checkout/');
  console.log('Checkout page status:', checkoutRes.status);
  const checkoutText = await checkoutRes.text();
  console.log('Checkout page title:', checkoutText.match(/<title>([^<]+)<\/title>/i)?.[1]);
  console.log('Has payment gateway in checkout:', /payment|stripe|paypal|credit card|billing/i.test(checkoutText));
}
checkPrice().catch(e => console.error(e));

