const fs = require('fs');
const bg = fs.readFileSync('background.js', 'utf8');

eval(bg.slice(bg.indexOf('function decodeRot13'), bg.indexOf('async function crawlWebsite')));
eval(bg.slice(bg.indexOf('function parseHtmlDetails'), bg.indexOf('function isUnwantedEmail')));
eval(bg.slice(bg.indexOf('function isUnwantedEmail'), bg.indexOf('function checkCompanyProfilePresence')));

const html = fs.readFileSync('scratch/amoretti_home.html', 'utf8');
const details = parseHtmlDetails(html, 'https://amoretti.com/');
console.log('details.emails:', details.emails);

