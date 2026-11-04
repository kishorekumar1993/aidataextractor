const sites = [
  'http://meramecusa.com',
  'http://www.streamlinertools.com',
  'http://www.pptube.com',
  'http://www.sterrittlumber.com',
  'http://www.marleymep.com'
];

async function check() {
  for (const s of sites) {
    try {
      const res = await fetch(s, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000)
      });
      const html = await res.text();
      const links = [...html.matchAll(/href=["']([^"']*(?:contact|location|about)[^"']*)["']/gi)].map(m => m[1]);
      console.log('Site:', s);
      console.log('Final URL:', res.url);
      console.log('Links:', links.slice(0, 5));
      // Look for zip code in html
      const zipMatches = [...html.matchAll(/\b(?:[A-Z]{2})\s+\d{5}(?:-\d{4})?\b/g)].map(m => m[0]);
      console.log('Zip patterns on page:', zipMatches.slice(0, 5));
    } catch (e) {
      console.log('Site:', s, 'Error:', e.message);
    }
  }
}
check();

