const fs = require('fs');
const content = fs.readFileSync('content.js', 'utf8');
const isCRLF = content.includes('\r\n');
const lines = content.split(/\r?\n/);

const idx = lines.findIndex(l => l.includes('cleanAddress = toTitleCase(cleanAddress).replace'));
if (idx !== -1) {
  const insertLines = [
    '      // Remove comma between street/building number and street name (including hyphenated street names)',
    '      cleanAddress = cleanAddress.replace(/(\\b(?:Number|No\\.?|#)\\s*\\d+[A-Za-z]?(?:[-\\/]\\d+[A-Za-z]?)?),\\s+([A-Z][a-z0-9\\u00C0-\\u024F\\-]+(?:\\s+[A-Z][a-z0-9\\u00C0-\\u024F\\-]+)*\\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Caddesi|Bulvari|Sokak|Strasse|Calle|Avenida|Viale|Corso)\\b)/gi, "$1 $2");',
    '      // Repair accidental comma splitting two-syllable East Asian cities',
    '      cleanAddress = cleanAddress.replace(/\\bChia,\\s*Yi\\s*City\\b/gi, "Chiayi City");',
    '      cleanAddress = cleanAddress.replace(/\\bChia[-\\s,]*[Yy]i\\s*City\\b/gi, "Chiayi City");',
    '      cleanAddress = cleanAddress.replace(/\\bHsin,\\s*Chu\\s*City\\b/gi, "Hsinchu City");',
    '      cleanAddress = cleanAddress.replace(/\\bHsin[-\\s,]*[Cc]hu\\s*City\\b/gi, "Hsinchu City");',
    '      // Strip trailing postal codes (3 to 6 digits at the end of address string)',
    '      cleanAddress = cleanAddress.replace(/[\\s,\\-]+\\b\\d{3,6}\\b\\s*$/g, "");',
    '      cleanAddress = cleanAddress.replace(/(\\b(?:City|District|Township|County|Hsien|Village|Li|Town|Dist\\.?)\\b[\\s,]*)\\b\\d{3,6}\\b(?=[\\s,]|$)/gi, "$1");'
  ];
  lines.splice(idx, 0, ...insertLines);
  console.log('Inserted address cleanup rules in content.js at index', idx);
}

const updated = lines.join(isCRLF ? '\r\n' : '\n');
fs.writeFileSync('content.js', updated, 'utf8');
console.log('Finished updating content.js successfully.');

