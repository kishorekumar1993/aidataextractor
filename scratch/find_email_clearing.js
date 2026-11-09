const fs = require('fs');

const bg = fs.readFileSync('background.js', 'utf8');

// Let's find why applyStrictInstructions cleared emailId and secondaryEmailId!
// Look at lines 5380-6075 of background.js
const lines = bg.split('\n');
console.log('Searching for where result.emailId = "" occurs in background.js:');
for (let i = 5200; i < 6100; i++) {
  if (lines[i] && (lines[i].includes('result.emailId = ""') || lines[i].includes('result.emailId = \'\'') || lines[i].includes('result.emailId ='))) {
    console.log(`Line ${i + 1}: ${lines[i]}`);
  }
}

