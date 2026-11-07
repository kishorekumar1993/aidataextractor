let addr = '4/F., Number 415, Jung-Jeng Road, Shu-Lin District, New Taipei City 238';

// Strip trailing postal code (3-6 digits at end)
addr = addr.replace(/[\s,\-]+\b\d{3,6}\b\s*$/g, '');

// Strip comma between number and street even when street name has hyphens
addr = addr.replace(/(\b(?:Number|No\.?|#)\s*\d+[A-Za-z]?(?:[-\/]\d+[A-Za-z]?)?),\s+([A-Z][a-z0-9\u00C0-\u024F\-]+(?:\s+[A-Z][a-z0-9\u00C0-\u024F\-]+)*\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Caddesi|Bulvari|Sokak|Strasse|Calle|Avenida|Viale|Corso)\b)/gi, '$1 $2');

console.log('Result:', addr);

let addr2 = 'Number 228 Pao Shun Road, Hoo Hu Li, Chia, Yi City';
// Fix accidental comma splitting two-syllable city / county / district names
addr2 = addr2.replace(/\bChia,\s*Yi\s*City\b/gi, 'Chiayi City');
console.log('Result 2:', addr2);

