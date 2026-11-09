const https = require('https');

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', err => resolve(''));
  });
}

async function run() {
  const homeHtml = await fetch('https://www.amorettibrothers.com');
  // Look for all /topic/ or /pages/ or /blogs/ or policies or footer links
  const links = [...homeHtml.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]);
  const topicLinks = links.filter(l => /topic|page|policy|terms|legal|shipping|returns|warranty|faq|help|about|contact/i.test(l));
  console.log('Topic links:', Array.from(new Set(topicLinks)));

  for (const t of Array.from(new Set(topicLinks))) {
    const fullUrl = t.startsWith('http') ? t : ('https://www.amorettibrothers.com' + (t.startsWith('/') ? '' : '/') + t);
    const html = await fetch(fullUrl);
    const emails = Array.from(new Set(html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []));
    console.log(`${fullUrl}:`, emails);
  }

  // Check Facebook
  const fbHtml = await fetch('https://www.facebook.com/AmorettiBrothers/');
  const fbDecoded = fbHtml.replace(/\\u0040/g, "@").replace(/%40/g, "@");
  const fbEmails = Array.from(new Set(fbDecoded.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []));
  console.log('Facebook emails:', fbEmails);
}
run();

