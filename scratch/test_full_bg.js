const fs = require('fs');

global.window = global;
global.chrome = {
  runtime: {
    onMessage: { addListener: () => {} },
    getURL: (p) => p
  },
  storage: {
    local: {
      get: (k, cb) => cb({ geminiApiKey: 'test' }),
      set: (v, cb) => cb && cb()
    }
  },
  tabs: {
    query: (q, cb) => cb([]),
    sendMessage: () => {}
  }
};

const bgCode = fs.readFileSync('background.js', 'utf8');
(0, eval)(bgCode);

async function run() {
  console.log("Crawling http://www.amorettibrothers.com ...");
  const res = await crawlWebsite('http://www.amorettibrothers.com');
  console.log("Result status:", res.status);
  console.log("Final URL:", res.finalUrl);
  console.log("Discovered emails:", res.emails);
}
run();
