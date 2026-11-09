const fs = require('fs');

const bg = fs.readFileSync('background.js', 'utf8');

// Load functions
eval(bg.slice(bg.indexOf('function stripHtml'), bg.indexOf('function checkCompanyProfilePresence')));
eval(bg.slice(bg.indexOf('function isUnwantedEmail'), bg.indexOf('function isValidCorporateEmail')));

const html = fs.readFileSync('scratch/amoretti_home.html', 'utf8');
const emails = extractEmailsFromHtml(html, 'amoretti.com');
console.log('amoretti.com extracted emails:', emails);

