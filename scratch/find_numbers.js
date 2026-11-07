const fs = require('fs');
const code = fs.readFileSync('background.js', 'utf8');
const lines = code.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('Number ') || l.includes('Number$') || l.includes('Lot Number') || l.includes('Plot Number')) {
    console.log((idx + 1) + ': ' + l.trim());
  }
});

