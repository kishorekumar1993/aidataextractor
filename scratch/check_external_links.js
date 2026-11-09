const fs = require('fs');
const html = fs.readFileSync('scratch/amorettibrothers_home.html', 'utf8');
const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m => m[1]);
console.log('All external links:');
links.filter(l => l.startsWith('http')).forEach(l => console.log(l));

