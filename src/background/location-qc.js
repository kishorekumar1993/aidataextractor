// State and City QC evaluation, UK constituent resolution, and suburb vs city classification.

function resolveUkCountryName(currentCountry, addrStr, crawlData) {
  const country = currentCountry || "";
  const rawCandidatesText = (crawlData && crawlData.addressCandidates || []).map(c => typeof c === "object" ? c.raw : c).join(" ");
  const addressBlockText = ((addrStr || "") + " " + rawCandidatesText).toLowerCase();
  const fullCheckText = (addressBlockText + " " + (crawlData && crawlData.bodyText ? crawlData.bodyText.slice(0, 5000) : "") + " " + (crawlData && crawlData.contactPageText ? crawlData.contactPageText.slice(0, 5000) : "")).toLowerCase();

  const addressHasExplicitUk = /\b(united\s*kingdom|great\s*britain|uk)\b/i.test(addressBlockText);
  const hasExplicitUk = /\b(united\s*kingdom|great\s*britain|uk)\b/i.test(fullCheckText);
  const hasExplicitEngland = /\bengland\b/i.test(fullCheckText);
  const hasExplicitScotland = /\bscotland\b/i.test(fullCheckText);
  const hasExplicitWales = /(?<!\bnew\s+south\s+)\bwales\b/i.test(fullCheckText);
  const hasExplicitNI = /\bnorthern\s*ireland\b/i.test(fullCheckText);

  const isUkOrConstituentContext = country === "United Kingdom" || addressHasExplicitUk ||
    (!country && (hasExplicitUk || hasExplicitEngland || hasExplicitScotland || hasExplicitWales || hasExplicitNI));

  if (!isUkOrConstituentContext) {
    return country;
  }

  if (addressHasExplicitUk || (country === "United Kingdom" && hasExplicitUk)) {
    return "United Kingdom";
  }
  if (hasExplicitEngland) return "England";
  if (hasExplicitScotland) return "Scotland";
  if (hasExplicitWales) return "Wales";
  if (hasExplicitNI) return "Northern Ireland";
  return "United Kingdom";
}

/**
 * Computes the unified product item count ("0", "1", "2", or "3") exclusively from own-crawl data.
 * Never uses Gemini values; ensures numberOfProducts, productImages, and numberOfProductDescriptions always match.
 */

function normalizeCountValue(raw) {
  if (raw === undefined || raw === null || raw === "") return "0";
  const str = String(raw).trim().toLowerCase();
  if (str === "0" || str === "zero") return "0";
  if (str === "1" || str === "one") return "1";
  if (str === "2" || str === "two") return "2";
  return "3";
}

function isNewTaipeiCity(address) {
  if (!address) return false;
  return /\bnew\s*taipei(\s*city)?\b/i.test(address);
}

function isTaipeiCityCapital(address) {
  if (!address) return false;
  if (isNewTaipeiCity(address)) return false;
  return /\btaipei(\s*city)?\b/i.test(address);
}

function isWellingtonCapital(address) {
  if (!address) return false;
  const lower = address.toLowerCase();
  // Mount Wellington / Mt Wellington is a suburb of Auckland, NOT the capital Wellington!
  if (/\b(?:mount|mt\.?)\s+wellington\b/i.test(lower)) {
    const withoutMt = lower.replace(/\b(?:mount|mt\.?)\s+wellington\b/gi, " ");
    return isWellingtonCapital(withoutMt);
  }
  if (typeof isPlaceUsedAsStreetName === "function" && isPlaceUsedAsStreetName(lower, "wellington")) {
    return false;
  }
  // Exclude "Wellington Point" (suburb in Queensland, Australia)
  if (/\bwellington\s+point\b/i.test(lower)) {
    return false;
  }
  return /\bwellington(\s+city)?\b/i.test(lower);
}

function hasCapitalInAddress(addr, country) {
  if (!addr) return false;
  const lower = addr.toLowerCase();

  const matchCap = (cap) => {
    if (cap === "wellington") return isWellingtonCapital(lower);
    if (typeof isPlaceUsedAsStreetName === "function" && isPlaceUsedAsStreetName(lower, cap)) return false;
    return new RegExp(`\\b${cap}\\b`, "i").test(lower);
  };

  // If New Taipei City is present, it does NOT qualify for the Taipei capital exception
  if (isNewTaipeiCity(lower)) {
    return ALL_CAPITALS.filter(c => c !== "taipei" && c !== "taipei city")
      .some(matchCap);
  }

  return ALL_CAPITALS.some(matchCap);
}

/**
 * Independent State verification function strictly based on the physical address string.
 */

function extractAddressLocalitySegments(address) {
  if (!address || typeof address !== "string") return [];
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) return parts;

  const localitySegments = [];
  const streetSuffixPattern = /\b(?:street|road|avenue|lane|drive|way|close|court|place|terrace|crescent|boulevard|highway|parade|circuit|esplanade|walk|row|alley|mews|track|trail|strasse|str\b|calle|avenida|via|corso|viale|jalan|jln|lorong|lebuh|大道|路|街|巷|弄|st\b|rd\b|ave\b|dr\b|blvd\b|ln\b|hwy\b|ct\b|pl\b)\b/i;
  const premisePattern = /^(?:unit|suite|ste|bldg|building|floor|fl|flr|level|block|blk|lot|plot|room|rm|shed|warehouse|factory|kav|kavling|apt|apartment|po\s*box|p\.?o\.?\s*box)\b/i;
  const buildingPremise = /\b(?:house|building|tower|towers|hall|lodge|mansions|plaza)\b/i;
  const estatePattern = /\b(?:industrial|business|technology|science|trade|trading|retail|enterprise|commercial|logistics)\s+(?:park|estate|area|zone|district)\b/i;
  const countryPattern = /\b(?:united\s*states(?:\s*of\s*america)?|usa|united\s*kingdom|great\s*britain|england|scotland|wales|northern\s*ireland|australia|canada|germany|deutschland|france|spain|espana|españa|italy|italia|malaysia|indonesia|taiwan|china|india|south\s*africa|new\s*zealand|aotearoa|singapore|turkey|turkiye)\b/i;

  for (const part of parts) {
    const pLower = part.toLowerCase();
    if (countryPattern.test(pLower) && pLower.split(/\s+/).length <= 4) continue;
    if (/^\b(?:[A-Z]{1,2}\d[A-Z0-9]?\s*\d[A-Z]{2}|\d{4,6}(?:-\d{4})?)\b$/i.test(part)) continue;
    if (premisePattern.test(pLower)) continue;
    if (buildingPremise.test(pLower) && !/\b(?:town|city|district|county)\b/i.test(pLower)) continue;
    if (estatePattern.test(pLower)) continue;
    if (streetSuffixPattern.test(pLower)) continue;
    if (/^(?:number|no\.?|#)?\s*\d+[A-Za-z]?(?:[-\/]\d+)?$/i.test(part)) continue;
    if (/^(?:section|sec\.?|lane|ln\.?|alley|aly\.?)\s*\d+[A-Za-z]?$/i.test(part)) continue;

    localitySegments.push(part);
  }

  return localitySegments.length > 0 ? localitySegments : parts;
}

function hasNamedStateOrProvince(lower) {
  if (!lower) return false;
  const segments = extractAddressLocalitySegments(lower);
  const targetTexts = (segments && segments.length > 0) ? segments : [lower];

  for (const text of targetTexts) {
    for (const name of STATE_AND_PROVINCE_NAMES) {
      if (typeof isPlaceUsedAsStreetName === "function" && isPlaceUsedAsStreetName(text, name)) continue;
      const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&").replace(/\s+/g, "\\s+");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) return true;
    }
  }
  return false;
}


function hasStateInAddress(addr, country) {
  if (!addr) return false;
  const lower = addr.toLowerCase();

  // Taiwan strict rule:
  // - Capital: Taipei City / Taipei -> State: Available
  // - Explicit County / Hsien / Province / 縣 / 省 (e.g. Changhua County) -> State: Available
  // - All 13 official Taiwan Counties (whether written with or without "County" / "Hsien" / "Country" / "縣"):
  //   Changhua, Chiayi, Hsinchu, Hualien, Kinmen, Lienchiang (Matsu), Miaoli,
  //   Nantou, Penghu, Pingtung, Taitung, Yilan, Yunlin -> State: Available
  // - Special Municipalities (Taichung City, New Taipei City, Tainan City, Kaohsiung City, Taoyuan City, Keelung City)
  //   and Districts (Nantun District, Banqiao District, etc.) without County -> State: Not Available!
  const isTaiwan = (country && /taiwan/i.test(country)) ||
    /\b(taiwan|r\.?o\.?c\.?)\b/i.test(lower) ||
    /\b(changhua|chiayi|hsinchu|hualien|kinmen|lienchiang|matsu|miaoli|nantou|penghu|pingtung|taitung|yilan|yunlin)\s*(?:county|hsien|country)?\b/i.test(lower) ||
    /[\u5f70\u5316\u5609\u7fa9\u65b0\u7af9\u82b1\u84ee\u91d1\u9580\u9023\u6c5f\u99ac\u7956\u82d7\u6817\u5357\u6295\u6f8e\u6e56\u5c4f\u6771\u53f0\u6771\u81fa\u6771\u5b9c\u862d\u96f2\u6797]/.test(addr);

  if (isTaiwan) {
    if (isNewTaipeiCity(lower)) {
      return /\b(county|hsien|province)\b/i.test(lower) || /[\u7701\u7e23\u53bf]/.test(addr);
    }
    if (isTaipeiCityCapital(lower)) {
      return true;
    }
    if (/\b(county|hsien|province)\b/i.test(lower) || /[\u7701\u7e23\u53bf]/.test(addr)) {
      return true;
    }
    // Provincial cities (Chiayi City, Hsinchu City) without County -> State: Not Available!
    if (/\b(?:chiayi|hsinchu)\s+city\b/i.test(lower) && !/\b(?:chiayi|hsinchu)\s+(?:county|hsien)\b/i.test(lower)) {
      return false;
    }
    if (/(?:嘉義市|新竹市)/.test(addr) && !/(?:嘉義縣|新竹縣)/.test(addr)) {
      return false;
    }
    // All 13 official Taiwan Counties (with or without "County" / "Hsien"):
    for (const county of TAIWAN_COUNTIES) {
      if (isPlaceUsedAsStreetName(lower, county)) continue;
      const escaped = county.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(lower)) {
        return true;
      }
    }
    // Chinese county names
    if (/(?:彰化|嘉義|新竹|花蓮|金門|連江|馬祖|苗栗|南投|澎湖|屏東|台東|臺東|宜蘭|雲林)(?:縣|县)?/.test(addr)) {
      return true;
    }
    return false;
  }

  // New Zealand strict rule:
  // Note: (County, Province, Prefecture) should be considered as State.
  // (If a country’s capital is mentioned in the address, then both City and State are considered available.)
  // - Capital: Wellington -> State: Available
  // - Explicit County, Province, Prefecture, Region, Regional Council -> State: Available
  // - True New Zealand regions: Canterbury, Waikato, Bay of Plenty, Otago, Hawke's Bay, Taranaki, Manawatu, Southland, Northland, Marlborough, Tasman, West Coast
  // - Cities (Auckland, Christchurch, Hamilton, Nelson, Gisborne, etc.) & Suburbs (Penrose, Albany, etc.) -> State: Not Available
  const isNZ = isNewZealandLocation(lower, country);
  if (isNZ) {
    if (isWellingtonCapital(lower)) {
      return true;
    }
    if (/\b(?:region|regional\s*council|province|county|prefecture)\b/i.test(lower)) {
      return true;
    }
    const NZ_REGIONS = [
      "canterbury", "waikato", "bay of plenty", "otago", "hawke's bay", "hawkes bay",
      "taranaki", "manawatu", "manawatū", "manawatu-whanganui", "manawatū-whanganui",
      "southland", "northland", "marlborough", "tasman", "west coast",
      "auckland region", "wellington region", "nelson region", "gisborne region",
      "canterbury region", "waikato region", "otago region", "southland region",
      "northland region", "taranaki region", "marlborough region", "tasman region",
      "west coast region", "bay of plenty region", "hawke's bay region", "hawkes bay region"
    ];
    for (const reg of NZ_REGIONS) {
      if (typeof isPlaceUsedAsStreetName === "function" && isPlaceUsedAsStreetName(lower, reg)) continue;
      const escaped = reg.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&").replace(/\s+/g, "\\s+");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(lower)) {
        return true;
      }
    }
    return false;
  }

  // Country official capital city exception
  if (hasCapitalInAddress(lower, country)) return true;

  // Generic and international administrative markers that confirm State, County, Province, or Prefecture is present
  if (/\b(province|state|county|prefecture|hsien|region|territory|emirate|canton|department|governorate|oblast|voivodeship)\b/i.test(lower)) return true;
  if (/\b(federal\s+district|district\s+of\s+columbia)\b/i.test(lower)) return true;
  if (/\bregional\s*council\b/i.test(lower)) return true;

  // County abbreviations (e.g. Co. Dublin, Co. Cork, Co. Kildare, Orange Co., Cook Co.)
  if (/\bco\.?\s+[a-z]{3,}\b/i.test(lower) || /\b[a-z]{3,}\s+co\.?\b(?=[,\s]|$)/i.test(lower)) return true;

  // Australian state abbreviations with postcode or comma (e.g. NSW 2000, VIC 3000, QLD 4000)
  if (/\b(?:vic|nsw|qld|wa|sa|tas|act|nt)\s+\d{4}\b/i.test(lower) || /,\s*(?:vic|nsw|qld|wa|sa|tas|act|nt)\b/i.test(lower) || /\b(?:sydney|melbourne|brisbane|perth|adelaide|gold coast|hobart|canberra)\s+(?:vic|nsw|qld|wa|sa|tas|act|nt)\b/i.test(lower)) return true;

  // United States state abbreviations with 5-digit ZIP or comma (e.g. IL 60060, TX 78731, Allenton, WI)
  const US_STATE_CODES_STR = "al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy";
  const isUSState = !country || /^(?:u\.?s\.?a?\.?|united\s*states(?:\s*of\s*america)?|america)$/i.test(country) || /\b(usa|united\s*states)\b/i.test(lower);
  const nonUsSignal = !/\b(?:united\s*states|usa|u\.s\.a\.)\b/i.test(country || lower) && (
    hasIndonesiaAddressSignal(addr, country) ||
    /australia|united\s*kingdom|england|scotland|wales|northern\s*ireland|canada|new\s*zealand|malaysia|indonesia|taiwan|china|india|south\s*africa|germany|france|italy|spain|japan|south\s*korea|thailand|vietnam|philippines|singapore|netherlands|belgium|switzerland|austria|poland/i.test(country || "") ||
    isAustralianLocation(addr, country) || isUkLocation(addr, country)
  );
  if (!nonUsSignal && new RegExp(`\\b(?:${US_STATE_CODES_STR})\\s+\\d{5}(?:-\\d{4})?\\b`, "i").test(lower)) return true;
  if (!nonUsSignal && new RegExp(`,\\s*(?:${US_STATE_CODES_STR})(?:\\s*,|\\s*\\d{5}|\\s*$)`, "i").test(lower)) return true;
  if (isUSState && !nonUsSignal && new RegExp(`^(?:${US_STATE_CODES_STR})(?:\\s+\\d{5}(?:-\\d{4})?)?$`, "i").test(lower.trim())) return true;

  // Canadian province abbreviations (e.g. ON, QC, BC, AB, MB, SK, NS, NB, NL, PE)
  const isCanada = (country && /canada/i.test(country)) || /\b(canada)\b/i.test(lower);
  if (isCanada) {
    if (/,\s*(?:ON|QC|BC|AB|MB|SK|NS|NB|NL|PE|YT|NT|NU)\b/i.test(addr)) return true;
    if (/\b(?:ON|QC|BC|AB|MB|SK|NS|NB|NL|PE)\s+[A-Za-z]\d[A-Za-z]\s*\d[A-Za-z]\d\b/i.test(addr)) return true;
  }

  // Non-English state/province/prefecture/county markers across the 16 priority countries
  // Germany: Bundesland, Land, Landkreis, Kreis, Regierungsbezirk
  if (/\b(bundesland|landkreis|kreis|regierungsbezirk)\b/i.test(lower)) return true;

  // Italy: Regione, Provincia, Prov.
  if (/\b(regione|provincia)\b/i.test(lower) || /\bprov\.?\s*(?:di\s+)?[a-z]+/i.test(lower)) return true;

  // Spain: Provincia, Prov., Comunidad Autónoma
  if (/\b(provincia|comunidad\s+aut[oó]noma)\b/i.test(lower) || /\bprov\.?\s*(?:de\s+)?[a-z]+/i.test(lower)) return true;

  // Indonesia: Provinsi, Propinsi
  if (/\b(provinsi|propinsi)\b/i.test(lower)) return true;

  // Malaysia: Negeri, Wilayah
  if (/\b(negeri|wilayah)\b/i.test(lower)) return true;

  // Thailand: Changwat
  if (/\b(changwat)\b/i.test(lower)) return true;

  // China / East Asia: Sheng, Xian, Zhou, 縣/县 (County), 省 (Province)
  if (/\b(sheng|xian|zhou)\b/i.test(lower)) return true;
  if (/[\u7701\u7e23\u53bf]/.test(addr)) return true;

  return hasNamedStateOrProvince(lower);
}

function hasCityInAddress(addr, country) {
  return evaluateCityQC(addr, country) === "Available";
}

// UK Cities, Towns, and London Boroughs for UK City validation

function isUnitedStatesLocation(address, country) {
  const c = (country || "").toLowerCase();
  if (/\b(?:united\s*states|usa|u\.s\.a\.|america)\b/i.test(c)) return true;
  if (c && !/\b(?:united\s*states|usa|u\.s\.a\.|america)\b/i.test(c) && /\b(?:canada|united\s+kingdom|uk|england|scotland|wales|australia|taiwan|china|india|south\s+africa|germany|italy|ireland|thailand|singapore|spain|malaysia|indonesia|new\s+zealand|japan|vietnam|philippines|south\s*korea|netherlands|belgium|switzerland|austria|poland|portugal|sweden|norway|denmark|finland)\b/i.test(c)) {
    return false;
  }
  if (hasIndonesiaAddressSignal(address, country)) {
    return false;
  }
  const a = (address || "").toLowerCase();
  if (/\b(?:united\s*states|usa|u\.s\.a\.)\b/i.test(a)) return true;

  const US_STATE_CODES_STR = "al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy";
  if (new RegExp(`(?:^|[,\\s])(?:${US_STATE_CODES_STR})\\s+\\d{5}(?:-\\d{4})?\\b`, "i").test(a)) return true;
  if (new RegExp(`,\\s*(?:${US_STATE_CODES_STR})\\s*$`, "i").test(a)) return true;
  for (const st of [
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut",
    "delaware", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa",
    "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan",
    "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire",
    "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio",
    "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota",
    "tennessee", "texas", "utah", "vermont", "virginia", "washington", "west virginia",
    "wisconsin", "wyoming", "district of columbia"
  ]) {
    if (new RegExp(`\\b${st}\\b`, "i").test(a)) return true;
  }
  return false;
}

function isTaiwanLocation(address, country) {
  const c = (country || "").toLowerCase();
  if (/\b(?:taiwan|r\.?o\.?c\.?|republic\s*of\s*china)\b/i.test(c)) return true;
  const a = (address || "").toLowerCase();
  if (/\b(?:taiwan|r\.?o\.?c\.?|republic\s*of\s*china)\b/i.test(a)) return true;
  if (/[\u4e00-\u9fa5]/.test(a) && /[\u81fa\u53f0\u7063\u65b0\u5317\u53f0\u5317\u6843\u5712\u53f0\u4e2d\u53f0\u5357\u9ad8\u96c4\u57fa\u9686\u65b0\u7af9\u5609\u7fa9]/.test(a)) return true;
  if (/\b(?:taipei|new\s*taipei|taoyuan|taichung|tainan|kaohsiung|keelung|hsinchu|chiayi|changhua|miaoli|nantou|yunlin|pingtung|yilan|hualien|taitung|penghu|kinmen|keishan|guishan)\b/i.test(a)) return true;
  return false;
}

function isUkLocation(address, country) {
  const c = (country || "").toLowerCase();
  if (/\b(?:united\s*kingdom|uk|u\.k\.|great\s*britain|england|scotland|wales|northern\s*ireland)\b/i.test(c)) {
    return true;
  }
  const a = (address || "").toLowerCase();
  if (/\b(?:united\s*kingdom|england|scotland|wales|northern\s*ireland)\b/i.test(a)) {
    return true;
  }
  // Standard UK postcode format: e.g. SW1A 1AA, EC1A 1BB, W1A 0AX, M1 1AE, B1 1BB, G1 1XQ, EH1 1YZ
  if (/\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(a)) {
    return true;
  }
  // Major UK counties / regions
  if (/\b(greater\s*london|greater\s*manchester|west\s*midlands|west\s*yorkshire|south\s*yorkshire|tyne\s*and\s*wear|merseyside|berkshire|buckinghamshire|cambridgeshire|cheshire|cornwall|cumbria|derbyshire|devon|dorset|durham|essex|gloucestershire|hampshire|hertfordshire|kent|lancashire|leicestershire|lincolnshire|norfolk|northamptonshire|northumberland|nottinghamshire|oxfordshire|shropshire|somerset|staffordshire|suffolk|surrey|sussex|warwickshire|wiltshire|worcestershire|yorkshire)\b/i.test(a)) {
    return true;
  }
  return false;
}

// Official Australian Cities (Towns, Capital & Regional Cities ONLY - Suburbs excluded)

function isAustralianLocation(address, country) {
  const c = (country || "").toLowerCase();
  if (/\b(?:australia|aus)\b/i.test(c)) return true;
  const a = (address || "").toLowerCase();
  if (/\b(?:australia)\b/i.test(a)) return true;
  if (/\b(?:victoria|new\s*south\s*wales|queensland|western\s*australia|south\s*australia|tasmania|northern\s*territory|australian\s*capital\s*territory)\b/i.test(a)) return true;
  if (/\b(?:vic|nsw|qld|wa|sa|tas|act|nt)\s+\d{4}\b/i.test(a)) return true;
  if (/,\s*(?:vic|nsw|qld|wa|sa|tas|act|nt)\b/i.test(a)) return true;
  return false;
}

function isSouthAfricanLocation(address, country) {
  const c = (country || "").toLowerCase();
  if (/\b(?:south\s*africa|za|rsa)\b/i.test(c)) return true;
  const a = (address || "").toLowerCase();
  if (/\b(?:south\s*africa)\b/i.test(a)) return true;
  if (/\b(?:gauteng|western\s*cape|eastern\s*cape|kwazulu|natal|mpumalanga|free\s*state|limpopo|north\s*west|northern\s*cape)\b/i.test(a)) return true;
  return false;
}

function isNewZealandLocation(address, country) {
  const c = (country || "").toLowerCase();
  if (/\b(?:new\s*zealand|nz)\b/i.test(c)) return true;
  if (c && !/\b(?:new\s*zealand|nz)\b/i.test(c) && /\b(?:canada|united\s+states|usa|united\s+kingdom|uk|england|scotland|wales|australia|taiwan|china|india|south\s+africa|germany|italy|ireland|thailand|singapore|indonesia)\b/i.test(c)) {
    return false;
  }
  const a = (address || "").toLowerCase();
  if (/\b(?:new\s*zealand|\bnz\b)\b/i.test(a)) return true;
  if (typeof isPlaceUsedAsStreetName === "function" && isPlaceUsedAsStreetName(a, "wellington") && !/\b(?:new\s*zealand|nz)\b/i.test(a)) {
    return false;
  }
  if (/\b(?:auckland|wellington|canterbury|waikato|bay\s*of\s*plenty|otago|manawatu|hawke's\s*bay|hawkes\s*bay|taranaki|southland|northland|marlborough|tasman|gisborne|nelson|christchurch|hamilton|tauranga|dunedin|palmerston\s*north|napier|whangarei|invercargill|rotorua|whanganui|hastings|blenheim|timaru|taupo|queenstown|cambridge)\b/i.test(a)) return true;
  return false;
}

// Official New Zealand Cities & Towns (Note: Suburbs and Regions excluded)

function isMalaysianLocation(address, country) {
  const c = (country || "").toLowerCase();
  if (/\b(?:malaysia|my)\b/i.test(c)) return true;
  if (c && !/\b(?:malaysia|my)\b/i.test(c) && /\b(?:canada|united\s+states|usa|united\s+kingdom|uk|england|scotland|wales|australia|taiwan|china|india|south\s+africa|germany|italy|ireland|thailand|singapore|spain)\b/i.test(c)) {
    return false;
  }
  const a = (address || "").toLowerCase();
  if (/\b(?:malaysia)\b/i.test(a)) return true;
  if (/\b(?:selangor|kuala\s*lumpur|johor|penang|pulau\s*pinang|perak|kedah|pahang|negeri\s*sembilan|melaka|terengganu|kelantan|sabah|sarawak|perlis|putrajaya|labuan|wilayah\s*persekutuan)\b/i.test(a)) return true;
  if (/\b(?:subang\s*jaya|petaling\s*jaya|shah\s*alam|johor\s*bahru|george\s*town|kota\s*kinabalu|kuching|seremban|batu\s*pahat|pasir\s*gudang|iskandar\s*puteri|sungai\s*petani|bintulu|sandakan)\b/i.test(a)) return true;
  return false;
}


function isIndonesianLocation(address, country) {
  const c = (country || "").toLowerCase();
  if (/\b(?:indonesia|id)\b/i.test(c)) return true;
  if (c && !/\b(?:indonesia|id)\b/i.test(c) && /\b(?:canada|united\s+states|usa|united\s+kingdom|uk|england|scotland|wales|australia|taiwan|china|india|south\s+africa|germany|italy|ireland|thailand|singapore|spain|malaysia)\b/i.test(c)) {
    return false;
  }
  if (hasIndonesiaAddressSignal(address, country)) return true;
  const a = (address || "").toLowerCase();
  if (/\b(?:indonesia|republik\s*indonesia)\b/i.test(a)) return true;
  if (/\b(?:jakarta|dki\s*jakarta|jawa\s*barat|jawa\s*tengah|jawa\s*timur|banten|di\s*yogyakarta|yogyakarta|bali|sumatera|kalimantan|sulawesi|papua|maluku|riau|lampung|aceh|nusantara)\b/i.test(a)) return true;
  if (/\b(?:surabaya|bandung|medan|semarang|makassar|palembang|tangerang|depok|bekasi|batam|bogor|pekanbaru|bandar\s*lampung|malang|padang|denpasar|samarinda|banjarmasin|balikpapan)\b/i.test(a)) return true;
  return false;
}


function hasUkCityOrTown(cleanAddr) {
  if (!cleanAddr) return false;
  const segments = extractAddressLocalitySegments(cleanAddr);
  const targetTexts = (segments && segments.length > 0) ? segments : [cleanAddr];

  const streetSuffixPattern = "\\s+(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|view|mews|row|wharf|park|st|rd|ave|dr|ln|blvd)\\b";
  const streetPrefixPattern = "\\b(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|view|mews|row|wharf|park)\\s+";

  for (const rawText of targetTexts) {
    const text = rawText.replace(/\bgreater\s+manchester\b/gi, " ");
    for (const name of UK_CITIES_AND_TOWNS) {
      const escaped = name.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      const regex = new RegExp(`(?<!${streetPrefixPattern})\\b${escaped}\\b(?!${streetSuffixPattern})`, "i");
      if (regex.test(text)) {
        return true;
      }
    }
  }
  return false;
}

function isSpanishLocation(address, country) {
  const c = (country || "").toLowerCase();
  if (/\b(?:spain|espa[nñ]a|es)\b/i.test(c)) return true;
  const a = (address || "").toLowerCase();
  if (/\b(?:spain|espa[nñ]a)\b/i.test(a)) return true;
  if (/\b(?:madrid|barcelona|valencia|sevilla|seville|zaragoza|málaga|malaga|murcia|palma|bilbao|alicante|alacant|córdoba|cordoba|valladolid|vigo|gijón|gijon|hospitalet|granada|vitoria|gasteiz|coruña|coruna|elche|elx|oviedo|badalona|cartagena|terrassa|jerez|sabadell|santa\s*cruz\s*de\s*tenerife|móstoles|mostoles|alcalá\s*de\s*henares|alcala\s*de\s*henares|fuenlabrada|pamplona|iruña|almería|almeria|leganés|leganes|donostia|san\s*sebastián|san\s*sebastian|burgos|santander|castellón|castellon|albacete|alcorcón|alcorcon|getafe|salamanca|logroño|logrono|badajoz|huelva|marbella|lleida|lérida|lerida|tarragona|león|leon|dos\s*hermanas|parla|torrejón|torrejon|mataró|mataro|algeciras|ourense|orense|lugo|girona|gerona|cáceres|caceres|toledo|pontevedra|palencia|ciudad\s*real|zamora|ávila|avila|cuenca|huesca|segovia|soria|teruel)\b/i.test(a)) return true;
  if (/\b(?:andaluc[ií]a|catalu[nñ]a|galicia|pa[ií]s\s*vasco|arag[oó]n|asturias|baleares|canarias|cantabria|castilla|extremadura|navarra|rioja)\b/i.test(a)) return true;
  if (/\b(?:ES[-\s]?\d{5}|E[-\s]?\d{5})\b/i.test(a)) return true;
  if (/\b(?:0[1-9]|[1-4]\d|5[0-2])\d{3}\b/.test(a) && (/\b(?:calle|c\/|avenida|avda|paseo|plaza|pol[ií]gono|ctra|carretera)\b/i.test(a))) return true;
  return false;
}

// Major Spanish Cities & Municipal Centres (>20,000 population and all provincial capitals)

function hasSpanishCityOrTown(cleanAddr) {
  const streetSuffixPattern = "\\s+(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|view|gate|mews|row|wharf|park|st|rd|ave|dr|ln|blvd)\\b";
  const streetPrefixPattern = "\\b(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|calle|c\\/|avenida|avda?|paseo|p\\.[ºo]|pso|plaza|pza|plza|rambla|rbla|carretera|ctra|camino|cno|pasaje|p(?:t)?je|ronda|rda|traves[ií]a|trav)\\s+";

  for (const name of SPANISH_CITIES_AND_TOWNS) {
    const escaped = name.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const regex = new RegExp(`(?<!${streetPrefixPattern})\\b${escaped}\\b(?!${streetSuffixPattern})`, "i");
    if (regex.test(cleanAddr)) {
      return true;
    }
  }
  return false;
}

function isPlaceUsedAsStreetName(cleanAddr, name) {
  const escaped = name.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const streetSuffix = "\\s+(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|view|gate|mews|row|wharf|park|st|rd|ave|dr|ln|blvd)\\b";
  const streetPrefix = "\\b(?:calle|c\\/|c\\.|avenida|avda?|paseo|p\\.[ºo]|pso|plaza|pza|plza|rambla|rbla|carretera|ctra|camino|cno|pasaje|p(?:t)?je|ronda|rda|traves[ií]a|trav|via|corso|viale|piazza|rue|strada)\\s+";
  return new RegExp(`(?:${streetPrefix})\\b${escaped}\\b|\\b${escaped}\\b(?:${streetSuffix})`, "i").test(cleanAddr);
}

function hasRecognizedPlaceName(cleanAddr, names) {
  if (!cleanAddr || !names) return false;
  const segments = extractAddressLocalitySegments(cleanAddr);
  const targetTexts = (segments && segments.length > 0) ? segments : [cleanAddr];

  for (const text of targetTexts) {
    for (const name of names) {
      if (!name || name.length < 3) continue;
      if (isPlaceUsedAsStreetName(text, name)) continue;
      // If it is part of a directional suburb name (e.g. "North Sydney", "South Melbourne", "Port Melbourne", "West Perth", "East Perth")
      if (new RegExp(`\\b(?:north|south|east|west|port)\\s+${name}\\b`, "i").test(text)) {
        continue;
      }
      const escaped = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) {
        return true;
      }
    }
  }
  return false;
}

// City qualifying administrative designations across all 16 priority countries

function hasExplicitCityWord(cleanAddr) {
  // Matches "X City" or "City of X" or standalone "City", excluding street names like "City Road"
  const streetSuffix = "\\s+(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|view|gate|mews|row|wharf|park|highway|center|centre|hall|rd|st|ave|dr|ln|blvd|hwy|plz|plaza)\\b";
  const streetPrefix = "\\b(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|view|gate|mews|row|wharf|park|highway)\\s+";
  const cityPattern = new RegExp(`(?<!${streetPrefix})\\bcity\\b(?!${streetSuffix})`, "i");
  return cityPattern.test(cleanAddr);
}

function hasCityDesignation(addr) {
  if (!addr) return false;
  // Chinese / East Asian City, Town, Township, District characters: 市 (City), 鎮/镇 (Town), 鄉/乡 (Township), 區/区 (District)
  if (/[\u5e02\u93ae\u9547\u9109\u4e61\u5340\u533a]/.test(addr)) return true;

  const stripped = addr
    .replace(/\b(?:industrial|business|commercial|technology|science|enterprise|tech|trade|trading)\s+(?:district|town|park|estate)\b/gi, " ")
    .replace(/\b(?:china\s*town|chinatown|down\s*town|downtown)\b/gi, " ")
    .replace(/\b(cape\s*town|george\s*town)\b/gi, " ");
  if (hasExplicitCityWord(stripped)) return true;
  const qualRegex = new RegExp(`\\b(?:${CITY_QUALIFIERS.join("|")})\\b`, "i");
  return qualRegex.test(stripped);
}

function addressLooksLikeSuburbOnly(cleanAddr) {
  if (!cleanAddr) return false;
  if (/\b(?:suburb|unknown\s*suburb|neighborhood|neighbourhood)\b/i.test(cleanAddr) &&
      !/\b(?:city|municipality|township|borough)\b/i.test(cleanAddr) &&
      !hasRecognizedPlaceName(cleanAddr, AUSTRALIAN_CITIES) &&
      !hasRecognizedPlaceName(cleanAddr, RECOGNIZED_TOWNS)) {
    return true;
  }
  let withoutDesignation = cleanAddr.replace(/\b(township|town|district|municipality|metropolitan\s*municipality|borough|city)\b/gi, " ");
  withoutDesignation = withoutDesignation.replace(/\b(victoria|western\s*australia|south\s*australia|new\s*south\s*wales|queensland|tasmania)\b/gi, " ");
  for (const suburb of NON_CITY_SUBURBS) {
    const escaped = suburb.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, "i").test(withoutDesignation)) {
      const rest = withoutDesignation.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
      if (!hasRecognizedPlaceName(rest, RECOGNIZED_TOWNS) && !hasRecognizedPlaceName(rest, AUSTRALIAN_CITIES) && !hasRecognizedPlaceName(rest, UK_CITIES_AND_TOWNS) && !hasRecognizedPlaceName(rest, NEW_ZEALAND_CITIES_AND_TOWNS) && !hasCityDesignation(rest)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * City QC: Available when the address has a Town/Township/District/Municipality/City
 * designation, a recognized city/town, or a UK city/town/borough.
 * Suburbs/localities/industrial-only addresses stay Not Available.
 */
function isNotCitySegment(segment) {
  if (!segment) return true;
  const s = segment.trim().toLowerCase();
  if (s.length < 2) return true;

  // Suburbs are NOT cities (Strict QC Rule)
  for (const sub of NON_CITY_SUBURBS) {
    const escaped = sub.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    if (new RegExp(`^${escaped}$`, "i").test(s) || (new RegExp(`\\b${escaped}\\b`, "i").test(s) && !hasRecognizedPlaceName(s, RECOGNIZED_TOWNS) && !hasRecognizedPlaceName(s, AUSTRALIAN_CITIES) && !hasCityDesignation(s))) {
      return true;
    }
  }

  // Multi-word cities that contain street-like words (e.g. "hill", "view", "park", "gate", "close")
  if (/\b(?:morgan\s*hill|richmond\s*hill|cherry\s*hill|chapel\s*hill|rock\s*hill|beverly\s*hills|farmington\s*hills|chino\s*hills|mountain\s*view|oak\s*ridge|glen\s*ridge|cradley\s*heath)\b/i.test(s)) {
    return false;
  }

  // Street types
  if (/\b(?:street|road|avenue|lane|drive|way|close|court|place|terrace|crescent|boulevard|highway|parade|walk|row|mews|view|gate|hill|wharf|parkway|alley|st|rd|ave|dr|ln|blvd|hwy|ct|pl)\b/i.test(s)) {
    return true;
  }

  // Unit / premise / floor / room / building prefix or descriptor
  if (/^(?:unit|suite|bldg|building|floor|fl|rm|room|dept|flat|apt|apartment|block|blk|no\.?\s*\d|number\s*\d|p\.?o\.?\s*box|post\s*office\s*box)\b/i.test(s)) {
    return true;
  }
  if (/\b(?:house|building|tower|towers|hall|lodge|mansions|plaza)\b/i.test(s) && !/\b(?:town|city|district|county)\b/i.test(s)) {
    return true;
  }

  // Industrial / commercial parks / zones / estates & suburb markers
  if (/\b(?:industrial\s*(?:estate|park|area|zone|district|town)|business\s*park|trading\s*estate|technology\s*park|science\s*park|enterprise\s*park|tech\s*park|ind\s*est|ind\s*park|suburb|neighborhood|neighbourhood|hamlet|chinatown|downtown)\b/i.test(s)) {
    return true;
  }

  // Postal codes
  if (/\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(s) || /^\d{4,6}$/.test(s)) {
    return true;
  }

  // Pure numbers, coordinates, or symbols
  if (/^[\d\s#\-_,./\\]+$/.test(s)) {
    return true;
  }

  return false;
}

function detectCityFromStructure(addr, country = "") {
  if (!addr || typeof addr !== "string") return null;

  let clean = addr.trim();
  clean = clean.replace(/,\s*(?:united\s*kingdom|uk|u\.k\.|great\s*britain|england|scotland|wales|northern\s*ireland|united\s*states(?:\s*of\s*america)?|usa|u\.s\.a\.|canada|australia|germany|deutschland|italy|italia|ireland|new\s*zealand|south\s*africa|china|taiwan|malaysia|singapore|indonesia|thailand|india)\s*$/i, "").trim();

  clean = clean.replace(/,\s*[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "").trim();
  clean = clean.replace(/,\s*\b\d{5}(?:-\d{4})?\b/g, "").trim();
  clean = clean.replace(/,\s*\b\d{4,6}\b/g, "").trim();
  clean = clean.replace(/\s+\b\d{5}(?:-\d{4})?\b\s*$/g, "").trim();
  if (typeof ensureCommaBeforeState === "function") {
    clean = ensureCommaBeforeState(clean);
  }

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
      const cleanCand = candidate.replace(/\b(?:industrial\s*(?:estate|park|area|zone|district)|business\s*park|trading\s*estate|technology\s*park|science\s*park|enterprise\s*park|tech\s*park|ind\s*est|ind\s*park)\b/gi, "").trim();
      if (cleanCand.length >= 3 && !isNotCitySegment(cleanCand)) {
        return cleanCand;
      }
    }
  }

  if (parts.length >= 2 && stateIdx === -1) {
    const last = parts[parts.length - 1];
    if (!isNotCitySegment(last)) {
      return last;
    }
    const cleanLast = last.replace(/\b(?:industrial\s*(?:estate|park|area|zone|district)|business\s*park|trading\s*estate|technology\s*park|science\s*park|enterprise\s*park|tech\s*park|ind\s*est|ind\s*park)\b/gi, "").trim();
    if (cleanLast.length >= 3 && !isNotCitySegment(cleanLast)) {
      return cleanLast;
    }
  }

  return null;
}

function evaluateCityQC(address, country) {
  if (!address || typeof address !== "string" || address.trim().length < 3) {
    return "Not Available";
  }
  let cleanAddr = address.trim().toLowerCase();
  if (typeof ensureCommaBeforeState === "function") {
    cleanAddr = ensureCommaBeforeState(cleanAddr);
  }

  // New Taipei City rule: Must remain Not Available unless a qualifying administrative area is separately identified
  if (isNewTaipeiCity(cleanAddr)) {
    const addrWithoutNTC = cleanAddr.replace(/\bnew\s*taipei(\s*city)?\b/gi, " ");
    if (hasCityDesignation(addrWithoutNTC) || hasRecognizedPlaceName(addrWithoutNTC, RECOGNIZED_TOWNS)) {
      return "Available";
    }
    return "Not Available";
  }

  // Capital City Rule: (If a country's capital is mentioned in the address, then both City and State are considered available.)
  if (hasCapitalInAddress(cleanAddr, country)) {
    return "Available";
  }

  // Taiwan City Evaluation (Strict QC Rule):
  // Note: (Town, Township, District, City) should be considered as City, BUT:
  // "Subhurb is consider as city if subhurb was coming means its should mark not available its not city"
  // If an address contains only a suburb (e.g. Keishan, Guishan) or county/municipality name without the word "City" or "市",
  // City MUST be marked "Not Available"!
  if (isTaiwanLocation(cleanAddr, country)) {
    // 1. Capital Rule: Taipei / Taipei City in address -> City: Available
    if (/\b(?:taipei|taipei\s*city|臺北市|台北市)\b/i.test(cleanAddr) && !isNewTaipeiCity(cleanAddr)) {
      return "Available";
    }
    // 2. Official Cities with explicit "City" or "市":
    // e.g. "New Taipei City", "Taichung City", "Kaohsiung City", "Tainan City", "Taoyuan City", "Keelung City", "Hsinchu City", "Chiayi City"
    if (hasExplicitCityWord(cleanAddr) || /[\u5e02]/.test(cleanAddr)) {
      return "Available";
    }
    // 3. Explicit Town, Township, District:
    const strippedTW = cleanAddr.replace(/\b(?:industrial|business|commercial|technology|science|enterprise|tech)\s+(?:park|zone|district)\b/gi, " ");
    if (/\b(?:township|town|district|municipality)\b/i.test(strippedTW) || /[\u93ae\u9547\u9109\u4e61\u5340\u533a]/.test(strippedTW)) {
      if (!addressLooksLikeSuburbOnly(cleanAddr)) {
        return "Available";
      }
    }
    // Suburb only or bare municipality/county name (e.g. "Keishan, Taoyuan", "Taoyuan") -> Not Available!
    return "Not Available";
  }

  // New Zealand City Evaluation (Strict QC Rule):
  // Note: (Town, District, Municipality) should be considered as City.
  // (If a country’s capital is mentioned in the address, then both City and State are considered available.)
  if (isNewZealandLocation(cleanAddr, country)) {
    // 1. Capital Rule: Wellington in address -> City: Available
    if (isWellingtonCapital(cleanAddr)) {
      return "Available";
    }
    // 2. Official New Zealand Cities & Towns (e.g. Auckland, Christchurch, Hamilton, Tauranga, Dunedin, Cambridge, etc.)
    for (const place of NEW_ZEALAND_CITIES_AND_TOWNS) {
      if (place === "wellington" && !isWellingtonCapital(cleanAddr)) continue;
      if (isPlaceUsedAsStreetName(cleanAddr, place)) continue;
      const escaped = place.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(cleanAddr)) {
        return "Available";
      }
    }
    // 3. Explicit City, Town, Township, District, Municipality designation
    // (excluding industrial/business districts or street names like City Road)
    const strippedNZ = cleanAddr.replace(/\b(?:industrial|business|commercial|technology|science|enterprise|tech)\s+district\b/gi, " ");
    if (hasExplicitCityWord(strippedNZ) || /\b(?:town|township|district|municipality|borough|village)\b/i.test(strippedNZ)) {
      return "Available";
    }
    // Suburbs alone (Penrose, Albany, Rosedale, Mount Wellington, etc.) or regions alone (Canterbury, Waikato, etc.) -> Not Available
    return "Not Available";
  }

  // Malaysia City Evaluation (Strict QC Rule):
  // Note: (Town, District, Municipality) should be considered as City.
  // (If a country’s capital is mentioned in the address, then both City and State are considered available.)
  if (isMalaysianLocation(cleanAddr, country)) {
    // 1. Capital Rule: Kuala Lumpur / Putrajaya in address -> City: Available
    if (/\b(?:kuala\s*lumpur|putrajaya)\b/i.test(cleanAddr)) {
      return "Available";
    }
    // 2. Official Malaysian Cities & Towns
    for (const place of MALAYSIAN_CITIES_AND_TOWNS) {
      if (isPlaceUsedAsStreetName(cleanAddr, place)) continue;
      const escaped = place.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(cleanAddr)) {
        return "Available";
      }
    }
    // 3. Explicit qualifiers: Bandar, Daerah, Mukim, Pekan, Majlis Perbandaran, City, Town, District, Municipality
    const strippedMY = cleanAddr.replace(/\b(?:kawasan|taman|zon)?\s*perindustrian(?:\s+[A-Za-z0-9]+)?/gi, " ")
      .replace(/\b(?:industrial|business|technology)\s+(?:park|estate|area|zone|district)\b/gi, " ");
    if (hasExplicitCityWord(strippedMY) || /\b(?:bandar|daerah|mukim|pekan|majlis\s*perbandaran|town|township|district|municipality)\b/i.test(strippedMY)) {
      return "Available";
    }
    // Industrial park alone without a town/city -> Not Available
    return "Not Available";
  }

  // Indonesia City Evaluation (Strict QC Rule):
  // Note: (Town, District, Municipality) should be considered as City.
  // (If a country’s capital is mentioned in the address, then both City and State are considered available.)
  if (isIndonesianLocation(cleanAddr, country)) {
    // 1. Capital Rule: Jakarta / DKI Jakarta / Nusantara in address -> City: Available
    if (/\b(?:jakarta|dki\s*jakarta|nusantara)\b/i.test(cleanAddr)) {
      return "Available";
    }
    // 2. Official Indonesian Cities, Regencies & Municipalities
    for (const place of INDONESIAN_CITIES_AND_TOWNS) {
      if (isPlaceUsedAsStreetName(cleanAddr, place)) continue;
      const escaped = place.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(cleanAddr)) {
        return "Available";
      }
    }
    // 3. Explicit qualifiers: Kota, Kabupaten, Kecamatan, Kotamadya, City, Regency, Town, District, Municipality
    const strippedID = cleanAddr.replace(/\bkawasan\s+(?:industri|berikat)(?:\s+[A-Za-z0-9]+)?/gi, " ")
      .replace(/\b(?:industrial|business|technology|commercial|trade|china|down)\s+(?:park|estate|area|zone|district|town)\b/gi, " ");
    if (hasExplicitCityWord(strippedID) || /\b(?:kota|kabupaten|kecamatan|kotamadya|regency|town|township|district|municipality)\b/i.test(strippedID)) {
      return "Available";
    }
    // Industrial estate / village / suburb alone without a city -> Not Available
    return "Not Available";
  }

  // United States City Evaluation (Strict QC Rule):
  // Note: (Town, Township, Borough, Municipality) should be considered as City.
  // Standard US address format: [Street Address], [City/Town], [State] [ZIP]
  if (isUnitedStatesLocation(cleanAddr, country)) {
    // 1. Capital Rule: Washington D.C. in address -> City: Available
    if (/\b(?:washington\s*d\.?c\.?|district\s*of\s*columbia)\b/i.test(cleanAddr)) {
      return "Available";
    }
    // 2. Explicit City, Town, Township, Borough, Municipality designation
    if (hasExplicitCityWord(cleanAddr) || /\b(?:town|township|borough|municipality|village)\b/i.test(cleanAddr)) {
      return "Available";
    }
    // 3. Recognized US Cities / Towns
    if (hasRecognizedPlaceName(cleanAddr, RECOGNIZED_TOWNS)) {
      return "Available";
    }
    if (addressLooksLikeSuburbOnly(cleanAddr)) {
      return "Not Available";
    }
    // 4. Structural detection: Locality preceding State/ZIP
    const structCity = detectCityFromStructure(cleanAddr, country);
    if (structCity && !isNotCitySegment(structCity)) {
      return "Available";
    }
    return "Not Available";
  }

  // UK Exception: Official UK cities, towns, and London boroughs evaluate as Available
  if (isUkLocation(cleanAddr, country)) {
    if (hasUkCityOrTown(cleanAddr)) {
      return "Available";
    }
    const structCity = detectCityFromStructure(cleanAddr, country);
    if (structCity && !isNotCitySegment(structCity)) {
      return "Available";
    }
    return "Not Available";
  }

  // Australian City evaluation (Strict QC Rule: SUBURB IS NOT A CITY):
  if (isAustralianLocation(cleanAddr, country)) {
    // 1. Official Australian Cities ONLY (Melbourne, Sydney, Brisbane, Perth, Adelaide, Hobart, Darwin, Canberra, Geelong, Gold Coast, Newcastle, Wollongong, etc.)
    if (hasRecognizedPlaceName(cleanAddr, AUSTRALIAN_CITIES)) {
      return "Available";
    }
    // 2. Explicit City, Town, Township, Shire, District, Municipality designation
    const strippedAU = cleanAddr.replace(/\b(?:industrial|business|commercial|technology|science|enterprise|tech|trading)\s+(?:district|town|park|estate)\b/gi, " ");
    if (hasExplicitCityWord(strippedAU) || /\b(?:town|township|shire|district|municipality|borough)\b/i.test(strippedAU)) {
      return "Available";
    }
    // Suburbs are NOT cities -> MUST return Not Available!
    return "Not Available";
  }

  // Spanish City evaluation: Recognized Spanish cities & municipal centres evaluate as Available
  if (isSpanishLocation(cleanAddr, country)) {
    if (hasSpanishCityOrTown(cleanAddr) || hasRecognizedPlaceName(cleanAddr, SPANISH_CITIES_AND_TOWNS)) {
      return "Available";
    }
  }

  // South Africa: Suburbs preceding state/province MUST NOT be classified as cities!
  if (isSouthAfricanLocation(cleanAddr, country)) {
    if (hasRecognizedPlaceName(cleanAddr, RECOGNIZED_TOWNS)) {
      return "Available";
    }
    const strippedZA = cleanAddr.replace(/\b(?:industrial|business|commercial|technology|science|enterprise|tech|trading)\s+(?:district|town|park|estate)\b/gi, " ");
    if (hasExplicitCityWord(strippedZA) || /\b(?:town|township|district|municipality|metropolitan\s*municipality|borough)\b/i.test(strippedZA)) {
      return "Available";
    }
    return "Not Available";
  }

  // Suburb-only addresses: If the address only has a suburb and no recognized city/town, MUST evaluate as Not Available!
  if (addressLooksLikeSuburbOnly(cleanAddr)) {
    return "Not Available";
  }

  // Explicit qualifying City, Town, Township, District, Municipality, or local language designation
  if (hasCityDesignation(cleanAddr)) {
    return "Available";
  }

  // Recognized International Towns/Cities
  if (hasRecognizedPlaceName(cleanAddr, RECOGNIZED_TOWNS)) {
    return "Available";
  }

  // Structural address detection (for Canada where city precedes province)
  if (/\b(?:canada)\b/i.test(country || cleanAddr)) {
    const structCity = detectCityFromStructure(cleanAddr, country);
    if (structCity && !isNotCitySegment(structCity)) {
      return "Available";
    }
  }

  return "Not Available";
}

