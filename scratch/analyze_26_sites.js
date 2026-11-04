const fs = require('fs');

const sites = [
  'http://www.larsenmfg.com',
  'http://www.qualityautoparts.com',
  'http://www.ac-h.com',
  'http://www.wildcatelectric.com',
  'http://meramecusa.com',
  'http://www.warmrain.com',
  'http://www.palramamericas.com',
  'http://www.lairdmfg.com',
  'http://www.streamlinertools.com',
  'http://stonelandusa.com',
  'http://www.sncmfg.com',
  'http://www.pptube.com',
  'http://www.peterforg.com',
  'http://www.sterrittlumber.com',
  'http://www.maysteel.com',
  'http://www.marleymep.com',
  'http://www.galaxystones.com',
  'http://www.baker-rullman.com',
  'http://www.idealconcreteblock.com',
  'http://www.shureusa.com',
  'http://www.ustsubaki.com',
  'http://www.ornamentalsecurity.com',
  'http://www.mifab.com',
  'http://www.highprecisioninc.com',
  'http://www.christianson.com',
  'http://www.cjpw.com'
];

async function fetchSite(url) {
  try {
    let target = url;
    let res;
    try {
      res = await fetch(target, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000)
      });
    } catch (e) {
      if (/^http:\/\//i.test(target)) {
        target = target.replace(/^http:\/\//i, 'https://');
        res = await fetch(target, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
          redirect: 'follow',
          signal: AbortSignal.timeout(10000)
        });
      } else {
        throw e;
      }
    }
    const html = await res.text();
    return { ok: res.ok, status: res.status, finalUrl: res.url, html };
  } catch (err) {
    return { error: err.message };
  }
}

// Regex to extract US addresses
const usAddressRegex = /\b\d{1,6}\s+[A-Za-z0-9\s,\.\-#]+(?:Street|St|Road|Rd|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Parkway|Pkwy|Circle|Cir|Highway|Hwy|Route|Rte|P\.?O\.?\s*Box\s+\d+)[\s\S]{0,120}?\b([A-Za-z\s\.]+),\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\s+Hampshire|New\s+Jersey|New\s+Mexico|New\s+York|North\s+Carolina|North\s+Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\s+Island|South\s+Carolina|South\s+Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\s+Virginia|Wisconsin|Wyoming)\s+(\d{5}(?:-\d{4})?)\b/i;

(async () => {
  const results = [];
  for (const url of sites) {
    const data = await fetchSite(url);
    if (data.error || (data.status !== 200 && data.status !== 301 && data.status !== 302)) {
      results.push({
        url,
        status: 'Not Working',
        reason: data.error || `HTTP ${data.status}`
      });
      console.log(`[NOT WORKING] ${url} -> ${data.error || 'HTTP ' + data.status}`);
      continue;
    }

    const html = data.html;
    const cleanText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
                          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
                          .replace(/<[^>]+>/g, ' ')
                          .replace(/\s+/g, ' ');

    const addrMatch = html.match(usAddressRegex) || cleanText.match(usAddressRegex);
    let extractedAddr = addrMatch ? addrMatch[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null;
    let city = addrMatch ? addrMatch[1].trim() : null;
    let state = addrMatch ? addrMatch[2].trim() : null;
    let zip = addrMatch ? addrMatch[3].trim() : null;

    results.push({
      url,
      finalUrl: data.finalUrl,
      status: 'Working',
      address: extractedAddr,
      city,
      state,
      zip
    });

    console.log(`[WORKING] ${url}`);
    if (extractedAddr) {
      console.log(`   Address: ${extractedAddr}`);
      console.log(`   City: ${city} | State: ${state} | Zip: ${zip}`);
    } else {
      console.log(`   Address: NOT FOUND IN HOMEPAGE REGEX (need contact page)`);
    }
  }

  fs.writeFileSync('scratch/results_26_sites.json', JSON.stringify(results, null, 2));
})();

