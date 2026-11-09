const fs = require('fs');

global.window = global;
global.chrome = {
  runtime: { onMessage: { addListener: () => {} }, getURL: (p) => p },
  storage: { local: { get: (k, cb) => cb({ geminiApiKey: 'test' }), set: (v, cb) => cb && cb() } },
  tabs: { query: (q, cb) => cb([]), sendMessage: () => {} }
};

const bgCode = fs.readFileSync('background.js', 'utf8');
(0, eval)(bgCode);

async function run() {
  const res = await crawlWebsite('http://www.amorettibrothers.com');
  console.log("emailSourceMap:", res.emailSourceMap);
}
run();

