async function test() {
  const res = await fetch('https://sealsprayed.com/shop/');
  const t = await res.text();
  console.log('Shop page length:', t.length);
  console.log('Has Add to cart in /shop/:', /add\s+to\s+cart/i.test(t));
  console.log('Has price in /shop/:', /[\$£€]\s*\d+/i.test(t));
  console.log('Has checkout in /shop/:', /checkout/i.test(t));
  console.log('Has quote in /shop/:', /quote/i.test(t));

  const linkRegex = /href=["'](https:\/\/sealsprayed\.com\/product\/[^"']+)["']/gi;
  const prods = [];
  let m;
  while ((m = linkRegex.exec(t)) !== null) prods.push(m[1]);
  const uniqueProds = [...new Set(prods)];
  console.log('Sample product URLs:', uniqueProds.slice(0, 5));

  if (uniqueProds.length > 0) {
    const prodRes = await fetch(uniqueProds[0]);
    const prodText = await prodRes.text();
    console.log('\n--- Checking Product Page: ' + uniqueProds[0] + ' ---');
    console.log('Product page length:', prodText.length);
    console.log('Has Add to Cart on product:', /add\s+to\s+cart/i.test(prodText));
    console.log('Has Buy Now:', /buy\s+now/i.test(prodText));
    console.log('Has Price on product:', /[\$£€]\s*\d+/i.test(prodText));
    console.log('Has Checkout on product:', /checkout/i.test(prodText));
    console.log('Has Request a quote / quote button:', /quote/i.test(prodText));

    const btns = [...prodText.matchAll(/<(?:button|a|input)[^>]*>([\s\S]*?)<\/(?:button|a)>/gi)].map(b => b[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    console.log('Buttons on product page:', [...new Set(btns)].slice(0, 15));
  }
}
test().catch(e => console.error(e));

