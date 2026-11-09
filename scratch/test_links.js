const fs = require('fs');
const html = fs.readFileSync('scratch/amorettibrothers_home.html', 'utf8');
const links = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map(m => m[1]);
console.log('Total links:', links.length);
const uniqueLinks = [...new Set(links)];
for (const l of uniqueLinks) {
  if (/email|mail|info|contact/i.test(l)) {
    console.log('Matching link:', l);
  }
}

