const fs = require('fs');
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

const bg = fs.readFileSync('background.js', 'utf8');

// Evaluate necessary functions from background.js
eval(bg.slice(bg.indexOf('function stripHtml'), bg.indexOf('function checkCompanyProfilePresence')));
eval(bg.slice(bg.indexOf('function discoverContactLinks'), bg.indexOf('function discoverProductAndCatalogLinks')));

async function simulateCrawl() {
  const mainUrl = 'https://www.amorettibrothers.com';
  const mainHtml = await fetch(mainUrl);
  const contactLinks = discoverContactLinks(mainHtml, mainUrl);
  console.log('Total contactLinks discovered:', contactLinks.length);

  const allDiscoveredEmails = new Set();
  for (const em of extractEmailsFromHtml(mainHtml, 'amorettibrothers.com')) {
    allDiscoveredEmails.add(em);
  }
  console.log('Emails from homepage:', Array.from(allDiscoveredEmails));

  const fetchedUrls = new Set([mainUrl]);
  const candidateSubpages = contactLinks.slice(0, 3);
  const subResults = await Promise.allSettled(candidateSubpages.map(u => {
    fetchedUrls.add(u);
    return fetch(u);
  }));

  for (const r of subResults) {
    if (r.status === 'fulfilled' && r.value) {
      for (const em of extractEmailsFromHtml(r.value, 'amorettibrothers.com')) {
        allDiscoveredEmails.add(em);
      }
    }
  }
  console.log('Emails after first 3 subpages:', Array.from(allDiscoveredEmails));

  // Double check secondary email: if fewer than 2 emails discovered so far:
  if (allDiscoveredEmails.size < 2 && contactLinks && contactLinks.length > 0) {
    // Priority: privacy, policy, terms, legal, support, warranty, contact, about
    const sortedRemaining = contactLinks
      .filter(l => !fetchedUrls.has(l))
      .sort((a, b) => {
        const score = (u) => {
          if (/(?:privacy|policy|legal|terms|support|warranty)/i.test(u)) return 10;
          return 1;
        };
        return score(b) - score(a);
      })
      .slice(0, 6);

    console.log('Fetching extra links in parallel:', sortedRemaining);
    const extraResults = await Promise.allSettled(sortedRemaining.map(u => {
      fetchedUrls.add(u);
      return fetch(u);
    }));

    for (const r of extraResults) {
      if (r.status === 'fulfilled' && r.value) {
        for (const em of extractEmailsFromHtml(r.value, 'amorettibrothers.com')) {
          allDiscoveredEmails.add(em);
        }
      }
    }
  }

  console.log('Final Discovered Emails across site:', Array.from(allDiscoveredEmails));
}

simulateCrawl();

