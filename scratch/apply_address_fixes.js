const fs = require('fs');
const content = fs.readFileSync('background.js', 'utf8');
const isCRLF = content.includes('\r\n');
const lines = content.split(/\r?\n/);

const idx1 = lines.findIndex((l, i) => l.includes('Beishen Road') && lines[i + 1] && lines[i + 1].includes('addr = addr.replace'));
if (idx1 !== -1) {
  const lineToReplace = idx1 + 1;
  const newLines = [
    '      addr = addr.replace(/(\\b(?:Number|No\\.?|#)\\s*\\d+[A-Za-z]?(?:[-\\/]\\d+[A-Za-z]?)?),\\s+([A-Z][a-z0-9\\u00C0-\\u024F\\-]+(?:\\s+[A-Z][a-z0-9\\u00C0-\\u024F\\-]+)*\\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Caddesi|Bulvari|Sokak|Strasse|Calle|Avenida|Viale|Corso|Rd|St|Ave|Ln|Dr|Blvd|Hwy|Ct|Pl)\\b)/gi, \'$1 $2\');',
    lines[lineToReplace].replace('[A-Z][a-z0-9\\u00C0-\\u024F]+', '[A-Z][a-z0-9\\u00C0-\\u024F\\-]+')
  ];
  lines.splice(lineToReplace, 1, ...newLines);
  console.log('Replaced line at', lineToReplace);
}

const idx2 = lines.findIndex(l => l.includes('// Final pass: clean postal codes, stray quotes, and punctuation'));
if (idx2 !== -1) {
  const insertLines = [
    '      addr = addr.replace(/[\\s,\\-]+\\b\\d{3,6}\\b\\s*$/g, "").trim();',
    '      addr = addr.replace(/(\\b(?:City|District|Township|County|Hsien|Village|Li|Town|Dist\\.?)\\b[\\s,]*)\\b\\d{3,6}\\b(?=[\\s,]|$)/gi, "$1");',
    '      addr = addr.replace(/\\bChia,\\s*Yi\\s*City\\b/gi, "Chiayi City");',
    '      addr = addr.replace(/\\bChia[-\\s,]*[Yy]i\\s*City\\b/gi, "Chiayi City");',
    '      addr = normalizeTaiwanDivisions(addr);',
    '      addr = repairBlindlySeparatedCommas(addr);'
  ];
  lines.splice(idx2 + 2, 0, ...insertLines);
  console.log('Inserted final pass lines at', idx2 + 2);
}

const updated = lines.join(isCRLF ? '\r\n' : '\n');
fs.writeFileSync('background.js', updated, 'utf8');
console.log('Finished updating background.js successfully.');
