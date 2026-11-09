const fs = require('fs');
const html = fs.readFileSync('scratch/earthcruiser.html', 'utf8');

const linkMatches = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)].map(m => m[1]);
console.log('Total links:', linkMatches.length);
const subLinks = linkMatches.filter(l => /(?:about|contact|products|models|vehicles)/i.test(l));
console.log('Interesting sublinks:', subLinks.slice(0, 10));

