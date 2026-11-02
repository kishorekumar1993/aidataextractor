async function test() {
  const res = await fetch('http://www.hcsiren.com');
  const html = await res.text();
  console.log('Homepage contains 398:', html.includes('398'));
  console.log('Homepage contains Cilong:', html.includes('Cilong'));
  console.log('Homepage contains Longshan:', html.includes('Longshan'));
  
  const contactMatches = [...html.matchAll(/href=["']([^"']*(?:contact|about)[^"']*)["']/gi)].map(m => m[1]);
  console.log('Contact/About links:', contactMatches);

  for (const link of contactMatches.slice(0, 5)) {
    try {
      const fullUrl = new URL(link, 'http://www.hcsiren.com').href;
      const cRes = await fetch(fullUrl);
      const cHtml = await cRes.text();
      console.log(`URL: ${fullUrl} (len ${cHtml.length})`);
      console.log(`  contains 398:`, cHtml.includes('398'));
      console.log(`  contains Cilong:`, cHtml.includes('Cilong'));
      console.log(`  contains Longshan:`, cHtml.includes('Longshan'));
      if (cHtml.includes('Cilong') || cHtml.includes('Longshan')) {
        const idx = cHtml.indexOf('Longshan');
        console.log(`  snippet:`, cHtml.substring(Math.max(0, idx - 150), idx + 150));
      }
    } catch (e) {
      console.error(e.message);
    }
  }
}
test();

