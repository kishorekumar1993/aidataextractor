const fs = require('fs');
const html = fs.readFileSync('scratch/amorettibrothers_home.html', 'utf8');

const bg = fs.readFileSync('background.js', 'utf8');

global.cleanCompanyPrefixesAndSuffixes = s => s;
global.toTitleCase = s => s;
global.stripHtml = (s) => (s || '').replace(/<[^>]+>/g, ' ');

eval(bg.slice(bg.indexOf('function isValidCorporateEmail'), bg.indexOf('function checkCompanyProfilePresence')));
eval(bg.slice(bg.indexOf('function isUnwantedEmail'), bg.indexOf('function isValidCorporateEmail')));
eval(bg.slice(bg.indexOf('function extractEmailsFromHtml'), bg.indexOf('function extractPhonesFromHtml')));
eval(bg.slice(bg.indexOf('function rankEmails'), bg.indexOf('function extractEmailsFromHtml')));

const emails = extractEmailsFromHtml(html, 'amorettibrothers.com');
console.log('Extracted and ranked emails from amorettibrothers_home.html:', emails);
