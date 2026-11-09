const https = require('https');

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', err => resolve(''));
  });
}

async function run() {
  const html = await fetch('https://www.amorettibrothers.com');
  console.log('HTML length:', html.length);
  
  // Search for any occurrence of "info@"
  const infoMatches = [...html.matchAll(/info@/gi)];
  console.log('info@ matches:', infoMatches.length);
  for (const m of infoMatches) {
    console.log('Context around info@:', html.slice(m.index - 50, m.index + 50));
  }

  // Search for any occurrence of "amoretti"
  const amMatches = [...html.matchAll(/info[^<]{0,30}amoretti/gi)];
  console.log('info...amoretti matches:', amMatches.length);
  for (const m of amMatches) {
    console.log('Context:', m[0]);
  }

  // Search for any occurrence of "amoretti.com"
  const dMatches = [...html.matchAll(/amoretti\.com/gi)];
  console.log('amoretti.com matches:', dMatches.length);
  for (const m of dMatches) {
    console.log('Context:', html.slice(m.index - 50, m.index + 50));
  }
}
run();

