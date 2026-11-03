async function checkCheckout() {
  const checkoutRes = await fetch('https://sealsprayed.com/checkout/');
  const t = await checkoutRes.text();
  console.log('Checkout length:', t.length);
  const forms = [...t.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/gi)].map(f => f[0].slice(0, 200));
  console.log('Forms on checkout:', forms);
  
  // Check shipping policy on sealsprayed.com
  const links = [...t.matchAll(/href=["']([^"']+)["']/gi)].map(l => l[1]);
  console.log('Shipping or policy links:', [...new Set(links.filter(l => /ship|return|refund|policy|terms/i.test(l)))]);

  // Check what payment methods are listed
  const paymentMatches = t.match(/class=["'][^"']*wc_payment_method[^"']*["'][\s\S]*?<\/li>/gi);
  console.log('Payment methods:', paymentMatches);
}
checkCheckout().catch(e => console.error(e));

