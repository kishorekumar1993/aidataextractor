global.chrome = {
  runtime: { onMessage: { addListener: () => {} } },
  storage: { sync: { get: () => Promise.resolve({ apiKey: "dummy" }) } }
};

const fs = require('fs');
const bgCode = fs.readFileSync('background.js', 'utf8');
eval(bgCode);

async function testTrace() {
  try {
    const mainRes = await fetchDecodedHtml('https://sealsprayed.com/', {
      timeoutMs: 8000,
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    console.log('mainRes status:', mainRes.status, 'html len:', mainRes.html ? mainRes.html.length : 0);
  } catch (e) {
    console.error('Error in mainRes:', e);
  }
}
testTrace();

