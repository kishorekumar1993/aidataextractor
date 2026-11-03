const fs = require('fs');

// Load full test script
const testFileCode = fs.readFileSync('scratch/test_ecommerce_3tier.js', 'utf8');

// Also add case 10: sealsprayed.com
const homeHtml = fs.readFileSync('scratch/sealsprayed.html', 'utf8');
const shopHtml = fs.readFileSync('scratch/sealsprayed_shop.html', 'utf8');
const sealsprayedCombined = homeHtml + "\n" + shopHtml;

console.log('Testing sealsprayedCombined:');
// We will test all cases after updating background.js

