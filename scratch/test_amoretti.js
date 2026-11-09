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
  const allLinks = [...homeHtml.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]);
  console.log('All links count:', allLinks.length);

  // Check contact page content
  const contactHtml = await fetch('https://www.amorettibrothers.com/contact');
  console.log('Contact HTML snippet:\n', contactHtml.slice(contactHtml.indexOf('office@amorettibrothers.com') - 200, contactHtml.indexOf('office@amorettibrothers.com') + 400));

  // Check social links
  const socials = allLinks.filter(l => /facebook|linkedin|instagram|twitter|youtube/i.test(l));
  console.log('Social links:', socials);

  // Check all internal links
  const internal = Array.from(new Set(allLinks.filter(l => l.startsWith('/') || l.includes('amorettibrothers.com'))));
  console.log('Total internal links:', internal.length);

  for (const link of internal) {
    const fullUrl = link.startsWith('http') ? link : ('https://www.amorettibrothers.com' + (link.startsWith('/') ? '' : '/') + link);
    const html = await fetch(fullUrl);
    const emails = Array.from(new Set(html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []));
    const nonOffice = emails.filter(e => e !== 'office@amorettibrothers.com');
    if (nonOffice.length > 0) {
      console.log(`FOUND NON-OFFICE EMAIL on ${fullUrl}:`, nonOffice);
    }
  }
}
run();
