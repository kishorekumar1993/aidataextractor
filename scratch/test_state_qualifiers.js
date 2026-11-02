const STATE_AND_PROVINCE_NAMES = [
  // Ireland 26 counties
  "dublin", "cork", "galway", "kildare", "meath", "limerick", "kerry", "wicklow",
  "clare", "tipperary", "wexford", "donegal", "louth", "mayo", "kilkenny", "waterford",
  "westmeath", "laois", "offaly", "cavan", "sligo", "roscommon", "monaghan", "carlow",
  "longford", "leitrim"
];

function hasStateInAddress(addr, country) {
  if (!addr) return false;
  const lower = addr.toLowerCase();

  // Explicit generic and international administrative markers for State / County / Province / Prefecture
  if (/\b(province|state|county|prefecture|hsien|district|region|territory|emirate|canton|department|governorate|oblast|voivodeship)\b/i.test(lower)) return true;
  if (/\bregional\s*council\b/i.test(lower)) return true;
  if (/\bco\.?\s+[a-z]{3,}\b/i.test(lower) || /\b[a-z]{3,}\s+co\.?\b(?=[,\s]|$)/i.test(lower)) return true;
  if (/\b(bundesland|landkreis|kreis|regierungsbezirk)\b/i.test(lower)) return true;
  if (/\b(regione|provincia)\b/i.test(lower) || /\bprov\.?\s*(?:di\s+)?[a-z]+/i.test(lower)) return true;
  if (/\b(provinsi|propinsi)\b/i.test(lower)) return true;
  if (/\b(negeri|wilayah)\b/i.test(lower)) return true;
  if (/\b(changwat)\b/i.test(lower)) return true;
  if (/\b(sheng|xian|zhou)\b/i.test(lower)) return true;

  for (const name of STATE_AND_PROVINCE_NAMES) {
    if (new RegExp(`\\b${name}\\b`, "i").test(lower)) return true;
  }
  return false;
}

const tests = [
  { addr: "Main Street, Naas, Co. Kildare", expected: true },
  { addr: "High Street, Galway, Ireland", expected: true },
  { addr: "Via Industriale 12, Provincia di Brescia", expected: true },
  { addr: "Industriestrasse 5, Landkreis München", expected: true },
  { addr: "Sukhumvit Road, Changwat Rayong", expected: true },
  { addr: "Jalan Ahmad Yani, Provinsi Jawa Barat", expected: true },
  { addr: "398 Cilong East Road, Zhejiang Province", expected: true },
  { addr: "No. 655 Lu Luh Road, Changhua County", expected: true },
  { addr: "100 Tech Park, Orange County, California", expected: true }
];

for (const t of tests) {
  const actual = hasStateInAddress(t.addr);
  console.log(`${actual === t.expected ? '✓ PASS' : '✗ FAIL'}: ${t.addr} -> Actual: ${actual}, Expected: ${t.expected}`);
}

