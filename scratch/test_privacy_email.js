const fs = require('fs');
const bg = fs.readFileSync('background.js', 'utf8');
const fnMatch = bg.match(/function isUnwantedEmail\(email\) \{[\s\S]*?return false;\s*\}/);
eval(fnMatch[0]);
console.log('isUnwantedEmail("privacy@amorettibrothers.com"):', isUnwantedEmail('privacy@amorettibrothers.com'));
console.log('isValidCorporateEmail("privacy@amorettibrothers.com"):', isValidCorporateEmail('privacy@amorettibrothers.com'));

