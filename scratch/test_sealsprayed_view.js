async function viewCheckout() {
  const res = await fetch('https://sealsprayed.com/checkout/');
  const t = await res.text();
  // Strip tags and print body text snippet
  const text = t.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ');
  console.log('Checkout page content snippet:');
  console.log(text.slice(0, 1500));
}
viewCheckout().catch(e => console.error(e));

