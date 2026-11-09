const fs = require('fs');

const bg = fs.readFileSync('background.js', 'utf8');

eval(bg.slice(bg.indexOf('function isUnwantedEmail'), bg.indexOf('function checkCompanyProfilePresence')));

const emails = ['orders@amoretti.com', 'info@amoretti.com', 'back-in-stock@notifyboost.net'];
const ranked = rankEmails(emails, 'amoretti.com');
console.log('Ranked emails:', ranked);
