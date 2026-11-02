const fs = require('fs');

// We have our known state/county/province list or matcher
function hasStateOrCounty(segment) {
  const s = segment.trim().toLowerCase();
  // State/county markers
  if (/\b(province|state|county|prefecture|hsien|bundesland|regione|provincia|changwat|negeri|wilayah)\b/i.test(s)) return true;
  // Known states/counties
  const known = [
    "lancashire", "greater manchester", "west yorkshire", "south yorkshire", "merseyside", "cheshire",
    "california", "texas", "illinois", "new york", "massachusetts", "florida", "ohio",
    "ontario", "quebec", "british columbia", "alberta",
    "victoria", "new south wales", "queensland", "western australia",
    "zhejiang", "guangdong", "jiangsu", "changhua", "taoyuan", "selangor", "johor",
    "gauteng", "western cape", "bayern", "lombardia", "kildare", "dublin", "otago", "canterbury"
  ];
  return known.some(k => new RegExp(`\\b${k}\\b`, "i").test(s));
}

function isNotCity(segment) {
  const s = segment.trim().toLowerCase();
  if (!s || s.length < 2) return true;
  // Street types
  if (/\b(street|road|avenue|lane|drive|way|close|court|place|terrace|crescent|boulevard|highway|parade|walk|row|mews|view|gate|hill|wharf|parkway|alley|st|rd|ave|dr|ln|blvd|hwy|ct|pl)\b/i.test(s)) return true;
  // Unit / premise / building
  if (/^(?:unit|suite|bldg|building|floor|fl|rm|room|dept|flat|apt|apartment|block|blk|no\.?\s*\d|p\.?o\.?\s*box)\b/i.test(s)) return true;
  // Industrial / commercial parks / zones / estates
  if (/\b(industrial\s*(?:estate|park|area|zone|district)|business\s*park|trading\s*estate|technology\s*park|science\s*park|enterprise\s*park|tech\s*park|ind\s*est|ind\s*park)\b/i.test(s)) return true;
  // Postal codes
  if (/\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(s) || /^\d{4,6}$/.test(s)) return true;
  // Pure numbers or symbols
  if (/^[\d\s#\-_,.]+$/.test(s)) return true;
  return false;
}

function detectCityFromStructure(addr) {
  if (!addr) return null;
  // Remove postal codes from end
  let clean = addr.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "").trim();
  clean = clean.replace(/,\s*(?:united\s*kingdom|uk|great\s*britain|england|scotland|wales|usa|united\s*states|canada|australia|germany|italy|ireland|new\s*zealand|south\s*africa|china|taiwan|malaysia)\s*$/i, "").trim();
  
  const parts = clean.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  // Find the index of the verified State / County / Province
  let stateIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (hasStateOrCounty(parts[i])) {
      stateIdx = i;
      break;
    }
  }

  // If state was found at index > 0, check the segment immediately preceding it
  if (stateIdx > 0) {
    const candidate = parts[stateIdx - 1];
    if (!isNotCity(candidate)) {
      return candidate;
    }
  }

  // If state was not explicitly identified or at index 0, check the penultimate segment
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 1];
    if (!hasStateOrCounty(candidate) && !isNotCity(candidate)) {
      return candidate;
    }
  }

  return null;
}

const addresses = [
  "Unit 7, Spring Mill, Moor Street, Heywood, Lancashire",
  "15 High Street, Littleborough, Greater Manchester",
  "Moor Street, Heywood, Lancashire",
  "123 Main Street, Boston, Massachusetts",
  "456 Market St, San Francisco, California",
  "100 Industrial Estate, Lancashire", // Should NOT detect "Industrial Estate"
  "123 Moor Street, Lancashire", // Should NOT detect "Moor Street"
  "Unit 5, Lancashire" // Should NOT detect "Unit 5"
];

for (const a of addresses) {
  const city = detectCityFromStructure(a);
  console.log(`Address: "${a}" -> City detected: ${city ? `"${city}" (Available)` : "None (Not Available)"}`);
}

