const fs = require('fs');

const bg = fs.readFileSync('background.js', 'utf8');

// Evaluate necessary functions from background.js
eval(bg.slice(bg.indexOf('function stripHtml'), bg.indexOf('function checkCompanyProfilePresence')));
eval(bg.slice(bg.indexOf('function isUnwantedEmail'), bg.indexOf('function isValidCorporateEmail')));

const html = fs.readFileSync('scratch/amoretti_home.html', 'utf8');
const emails = extractEmailsFromHtml(html, 'amoretti.com');
console.log('Emails extracted from amoretti.com:', emails);

const ranked = rankEmails(emails, 'amoretti.com');
console.log('Ranked emails:', ranked);

