const fs = require('fs');

async function test() {
  const code = fs.readFileSync('background.js', 'utf8');
  // eval or require in a sandbox
  // let's run test via node
}

