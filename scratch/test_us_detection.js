// Test US detection logic
const US_STATE_CODES_STR = "al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy";

function detectCountryFromAddress(address) {
  if (!address || typeof address !== "string" || address.trim().length < 3) return "";
  const lower = address.toLowerCase();

  // US 2-letter state code + 5-digit zip code (e.g. IL 60060, TX 78731, PA 19530)
  if (new RegExp(`(?:^|[,\\s])(?:${US_STATE_CODES_STR})\\s+\\d{5}(?:-\\d{4})?\\b`, "i").test(lower)) {
    return "United States Of America";
  }
  // US 2-letter state code following a comma at the end of address (e.g. "..., IL", "..., TX")
  if (new RegExp(`,\\s*(?:${US_STATE_CODES_STR})\\s*$`, "i").test(lower)) {
    return "United States Of America";
  }
  if (/\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new\\s*hampshire|new\\s*jersey|new\\s*mexico|new\\s*york|north\\s*carolina|north\\s*dakota|ohio|oklahoma|oregon|pennsylvania|rhode\\s*island|south\\s*carolina|south\\s*dakota|tennessee|texas|utah|vermont|virginia|washington|west\\s*virginia|wisconsin|wyoming|district\\s*of\\s*columbia)\b/i.test(lower)) return "United States Of America";

  return "";
}

function hasStateInAddress(addr, country) {
  if (!addr) return false;
  const lower = addr.toLowerCase();
  const isUS = !country || /^(?:u\.?s\.?a?\.?|united\s*states(?:\s*of\s*america)?|america)$/i.test(country) || /\b(usa|united\s*states)\b/i.test(lower);

  if (new RegExp(`\\b(?:${US_STATE_CODES_STR})\\s+\\d{5}(?:-\\d{4})?\\b`, "i").test(lower)) return true;
  if (new RegExp(`,\\s*(?:${US_STATE_CODES_STR})(?:\\s*,|\\s*\\d{5}|\\s*$)`, "i").test(lower)) return true;
  if (isUS && new RegExp(`^(?:${US_STATE_CODES_STR})(?:\\s+\\d{5}(?:-\\d{4})?)?$`, "i").test(lower.trim())) return true;

  // Full state names
  const usStates = ["alabama","alaska","arizona","arkansas","california","colorado","connecticut","delaware","florida","georgia","hawaii","idaho","illinois","indiana","iowa","kansas","kentucky","louisiana","maine","maryland","massachusetts","michigan","minnesota","mississippi","missouri","montana","nebraska","nevada","new hampshire","new jersey","new mexico","new york","north carolina","north dakota","ohio","oklahoma","oregon","pennsylvania","rhode island","south carolina","south dakota","tennessee","texas","utah","vermont","virginia","washington","west virginia","wisconsin","wyoming"];
  for (const st of usStates) {
    if (new RegExp(`\\b${st}\\b`, "i").test(lower)) return true;
  }
  return false;
}

function isNotCitySegment(segment) {
  if (!segment) return true;
  const s = segment.trim().toLowerCase();
  if (s.length < 2) return true;
  if (/\b(?:street|road|avenue|lane|drive|way|close|court|place|terrace|crescent|boulevard|highway|parade|walk|row|mews|view|gate|hill|wharf|parkway|alley|st|rd|ave|dr|ln|blvd|hwy|ct|pl)\b/i.test(s)) return true;
  if (/^(?:unit|suite|bldg|building|floor|fl|rm|room|dept|flat|apt|apartment|block|blk|no\.?\s*\d|number\s*\d|p\.?o\.?\s*box|post\s*office\s*box)\b/i.test(s)) return true;
  return false;
}

function detectCityFromStructure(addr, country = "") {
  if (!addr || typeof addr !== "string") return null;

  let clean = addr.trim();
  clean = clean.replace(/,\s*(?:united\s*states(?:\s*of\s*america)?|usa|u\.s\.a\.)\s*$/i, "").trim();
  clean = clean.replace(/,\s*\b\d{5}(?:-\d{4})?\b/g, "").trim();
  clean = clean.replace(/\s+\b\d{5}(?:-\d{4})?\b\s*$/g, "").trim();

  const parts = clean.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  let stateIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (hasStateInAddress(parts[i], country)) {
      stateIdx = i;
      break;
    }
  }

  if (stateIdx > 0) {
    for (let j = stateIdx - 1; j >= 0; j--) {
      const candidate = parts[j];
      if (!isNotCitySegment(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

const testAddresses = [
  "1201 Allanson Road, Mundelein, IL 60060",
  "5900 Balcones Dr, Austin, TX 78731",
  "12045 Wallisville Road, Suite 200, Houston, TX 77013",
  "9735 Commerce Cir, Kutztown, PA 19530",
  "1130 Stuart Dr, Merced, California 95341",
  "11831 Vose Street, North Hollywood, CA 91605",
  "101 West Waukau Avenue, Oshkosh, WI 54902",
  "50 Park Street, Somerville, MA 02143",
  "6199 County Rd W, Allenton, Wisconsin 53002",
  "9134 North Freeway, Houston, TX 77037",
  "45 Power Rd, Westford, MA 01886",
  "1901 West Main Street, Washington, MO 63090",
  "1321 West 119th Street, Chicago, IL 60643",
  "375 Morse St, Hamden, CT 06517",
  "20421 15th Street Southeast, Blomkest, MN 56216",
  "1500 15th Avenue Drive East Unit 105, Palmetto, FL 34221",
  "Saegertown, PA 16433",
  "Wheeling, IL 60090",
  "Watertown, MA 02472"
];

for (const a of testAddresses) {
  const country = detectCountryFromAddress(a);
  const state = hasStateInAddress(a, country) ? "Available" : "Not Available";
  const city = detectCityFromStructure(a, country);
  console.log(`Addr: "${a}"`);
  console.log(`  -> Country: ${country} | State: ${state} | City: ${city || 'None'}`);
}

