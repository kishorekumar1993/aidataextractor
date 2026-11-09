const fs = require('fs');
const html = fs.readFileSync('scratch/amorettibrothers_home.html', 'utf8');
const scripts = [...html.matchAll(/<script[^>]*src=["']([^"']+)["']/gi)].map(m => m[1]);
console.log('Scripts:', scripts.slice(0, 20));

