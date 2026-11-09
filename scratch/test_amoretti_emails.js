const fs = require('fs');

const bg = fs.readFileSync('background.js', 'utf8');

// Evaluate from function stripHtml to checkCompanyProfilePresence
eval(bg.slice(bg.indexOf('function stripHtml'), bg.indexOf('function checkCompanyProfilePresence')));

const html = fs.readFileSync('scratch/amoretti_home.html', 'utf8');
const emails = extractEmailsFromHtml(html, 'amoretti.com');
console.log('Extracted emails from amoretti.com homepage:', emails);

