const contactPages = [
  'https://www.streamlinertools.com/contact-us',
  'https://www.pptube.com/index.php/contact-us',
  'https://www.sterrittlumber.com/contact',
  'https://www.marleymep.com/contact-us/'
];

async function check() {
  for (const s of contactPages) {
    try {
      const res = await fetch(s, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000)
      });
      const html = await res.text();
      const zipMatches = [...html.matchAll(/\b[A-Za-z0-9\s,\.\-#]+,\s*(?:[A-Z]{2}|[A-Za-z]+)\s+\d{5}(?:-\d{4})?\b/g)].map(m => m[0].replace(/\s+/g, ' ').trim());
      console.log('Contact Page:', s);
      console.log('Matches:', zipMatches.slice(0, 3));
    } catch (e) {
      console.log('Contact Page:', s, 'Error:', e.message);
    }
  }
}
check();

