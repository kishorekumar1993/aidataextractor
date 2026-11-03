const fs = require('fs');
const html = fs.readFileSync('scratch/sealsprayed_shop.html', 'utf8');

// Strip HTML tags and normalize currency entities
function extractPricesFromHtml(rawHtml) {
  // 1. Direct regex allowing optional closing span tags between currency and digits
  const tagAgnosticPriceRegex = /(?:[\$£€¥₹]|&#36;|&dollar;|&pound;|&#163;|&euro;|&#8364;|&#165;|&#8377;|AU\$|CA\$|USD|EUR|GBP)(?:<\/[^>]+>|\s)*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/gi;
  const matches = [...rawHtml.matchAll(tagAgnosticPriceRegex)];
  return matches.map(m => parseFloat(m[1].replace(/,/g, ''))).filter(p => p > 0);
}

const found = extractPricesFromHtml(html);
console.log('Prices found:', found.slice(0, 10));

