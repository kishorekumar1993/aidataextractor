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
 * Robust country resolution using all available evidence:
 * Address, address candidates, phone calling codes, domain ccTLD, and page text.
 */
function resolveCountryFromAllEvidence(currentCountry, addrStr, crawlData) {
  let country = (typeof normalizeCountryName === "function" ? normalizeCountryName(currentCountry || "") : currentCountry) || "";
  if (!country && addrStr && typeof detectCountryFromAddress === "function") {
    country = detectCountryFromAddress(addrStr);
  }
  // Check all discovered address candidates
  if (!country && crawlData && Array.isArray(crawlData.addressCandidates)) {
    for (const cand of crawlData.addressCandidates) {
      const raw = typeof cand === "object" ? cand.raw : cand;
      const c = typeof detectCountryFromAddress === "function" ? detectCountryFromAddress(raw) : "";
      if (c) {
        country = c;
        break;
      }
    }
  }
  // Check international phone calling codes
  if (!country && crawlData && Array.isArray(crawlData.phones)) {
    const callingCodeMap = {
      "886": "Taiwan", "852": "Hong Kong", "971": "United Arab Emirates",
      "966": "Saudi Arabia", "974": "Qatar", "965": "Kuwait", "420": "Czech Republic",
      "358": "Finland", "351": "Portugal", "353": "Ireland", "385": "Croatia",
      "49": "Germany", "44": "United Kingdom", "61": "Australia", "64": "New Zealand",
      "86": "China", "81": "Japan", "82": "South Korea", "91": "India", "60": "Malaysia",
      "62": "Indonesia", "65": "Singapore", "33": "France", "39": "Italy",
      "34": "Spain", "31": "Netherlands", "41": "Switzerland", "43": "Austria",
      "48": "Poland", "27": "South Africa", "55": "Brazil", "52": "Mexico",
      "90": "Türkiye", "32": "Belgium", "46": "Sweden", "47": "Norway",
      "45": "Denmark", "30": "Greece", "1": "United States Of America"
    };
    for (const p of crawlData.phones) {
      const pStr = String(p || "").trim();
      const codeMatch = pStr.match(/^\+?(\d{1,4})\b/);
      if (codeMatch && callingCodeMap[codeMatch[1]]) {
        country = callingCodeMap[codeMatch[1]];
        break;
      }
      const digits = pStr.replace(/^\+/, "").replace(/\D/g, "");
      if (digits.length >= 7) {
        if (callingCodeMap[digits.slice(0, 3)]) {
          country = callingCodeMap[digits.slice(0, 3)];
          break;
        }
        if (callingCodeMap[digits.slice(0, 2)]) {
          country = callingCodeMap[digits.slice(0, 2)];
          break;
        }
        if (digits.length >= 10 && callingCodeMap[digits.slice(0, 1)]) {
          country = callingCodeMap[digits.slice(0, 1)];
          break;
        }
      }
    }
  }
  // Check website domain ccTLD
  if (!country && crawlData) {
    const urlStr = (((crawlData.originalUrl || "") + " " + (crawlData.finalUrl || "")).split("?")[0] || "").toLowerCase();
    const tldMap = [
      [/\.de(?:\/|$)/, "Germany"],
      [/\.(?:co\.uk|org\.uk|gov\.uk|me\.uk|uk)(?:\/|$)/, "United Kingdom"],
      [/\.(?:com\.au|net\.au|org\.au|au)(?:\/|$)/, "Australia"],
      [/\.(?:co\.nz|net\.nz|org\.nz|nz)(?:\/|$)/, "New Zealand"],
      [/\.(?:com\.tw|idv\.tw|tw)(?:\/|$)/, "Taiwan"],
      [/\.(?:com\.cn|net\.cn|cn)(?:\/|$)/, "China"],
      [/\.(?:co\.jp|jp)(?:\/|$)/, "Japan"],
      [/\.(?:co\.kr|kr)(?:\/|$)/, "South Korea"],
      [/\.(?:co\.in|in)(?:\/|$)/, "India"],
      [/\.(?:com\.my|org\.my|net\.my|my)(?:\/|$)/, "Malaysia"],
      [/\.(?:co\.id|web\.id|or\.id|id)(?:\/|$)/, "Indonesia"],
      [/\.(?:com\.sg|sg)(?:\/|$)/, "Singapore"],
      [/\.us(?:\/|$)/, "United States Of America"],
      [/\.ca(?:\/|$)/, "Canada"],
      [/\.fr(?:\/|$)/, "France"],
      [/\.it(?:\/|$)/, "Italy"],
      [/\.es(?:\/|$)/, "Spain"],
      [/\.nl(?:\/|$)/, "Netherlands"],
      [/\.ch(?:\/|$)/, "Switzerland"],
      [/\.at(?:\/|$)/, "Austria"],
      [/\.pl(?:\/|$)/, "Poland"],
      [/\.(?:co\.za|za)(?:\/|$)/, "South Africa"],
      [/\.(?:com\.br|br)(?:\/|$)/, "Brazil"],
      [/\.(?:com\.mx|mx)(?:\/|$)/, "Mexico"],
      [/\.(?:com\.tr|tr)(?:\/|$)/, "Türkiye"],
      [/\.ae(?:\/|$)/, "United Arab Emirates"],
      [/\.be(?:\/|$)/, "Belgium"],
      [/\.se(?:\/|$)/, "Sweden"],
      [/\.no(?:\/|$)/, "Norway"],
      [/\.dk(?:\/|$)/, "Denmark"],
      [/\.fi(?:\/|$)/, "Finland"],
      [/\.cz(?:\/|$)/, "Czech Republic"],
      [/\.ie(?:\/|$)/, "Ireland"],
      [/\.pt(?:\/|$)/, "Portugal"]
    ];
    for (const [re, cName] of tldMap) {
      if (re.test(urlStr)) {
        country = cName;
        break;
      }
    }
  }
  // Check contact page / footer text
  if (!country && crawlData && typeof detectCountryFromAddress === "function") {
    const textCorpus = ((crawlData.contactPageText || "") + " " + (crawlData.footerText || "") + " " + (crawlData.copyrightText || "")).slice(0, 5000);
    const textCountry = detectCountryFromAddress(textCorpus);
    if (textCountry) {
      country = textCountry;
    }
  }

  if (typeof toTitleCase === "function" && typeof normalizeCountryName === "function") {
    country = toTitleCase(normalizeCountryName(country));
  }
  if (typeof resolveUkCountryName === "function") {
    country = resolveUkCountryName(country, addrStr, crawlData);
  }
  return country;
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
  const cLower = (country || "").toLowerCase();

  if (/\bmaldives\b/i.test(cLower || lower) && /\bmal[eé]\b/i.test(lower) && !isPlaceUsedAsStreetName(lower, "male")) {
    return true;
  }
  if (/scotland/i.test(cLower) && /\bedinburgh\b/i.test(lower) && !isPlaceUsedAsStreetName(lower, "edinburgh")) return true;
  if (/wales/i.test(cLower) && /\bcardiff\b/i.test(lower) && !isPlaceUsedAsStreetName(lower, "cardiff")) return true;
  if (/northern\s*ireland/i.test(cLower) && /\bbelfast\b/i.test(lower) && !isPlaceUsedAsStreetName(lower, "belfast")) return true;

  const isExplicitlyNonUs = Boolean(cLower && !/\b(?:united\s*states|usa|u\.s\.a\.|america)\b/i.test(cLower));

  const matchCap = (cap) => {
    if (cap === "wellington") return isWellingtonCapital(lower);
    if (cap === "washington" && isExplicitlyNonUs) return false;
    if (typeof isPlaceUsedAsStreetName === "function" && isPlaceUsedAsStreetName(lower, cap)) return false;
    const escaped = cap.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(lower);
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
    // Provincial & county-administered cities (Chiayi City, Hsinchu City, Changhua City, etc.) without County -> State: Not Available!
    if (/\b(?:chiayi|hsinchu|changhua|chang\s+hua|hualien|taitung|pingtung|yilan|miaoli|nantou)\s+city\b/i.test(lower) &&
        !/\b(?:county|hsien|province)\b/i.test(lower)) {
      // Only return false if the county name does not also appear independently outside "<Name> City"
      const withoutCityTerm = lower.replace(/\b(?:chiayi|hsinchu|changhua|chang\s+hua|hualien|taitung|pingtung|yilan|miaoli|nantou)\s+city\b/gi, " ");
      const hasIndependentCounty = TAIWAN_COUNTIES.some(c => {
        if (isPlaceUsedAsStreetName(withoutCityTerm, c)) return false;
        const esc = c.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        return new RegExp(`\\b${esc}\\b(?!\\s+city\\b)`, "i").test(withoutCityTerm);
      });
      if (!hasIndependentCounty) return false;
    }
    if (/(?:嘉義市|新竹市|彰化市|花蓮市|台東市|臺東市|屏東市|宜蘭市|苗栗市|南投市)/.test(addr) &&
        !/(?:嘉義縣|新竹縣|彰化縣|花蓮縣|台東縣|臺東縣|屏東縣|宜蘭縣|苗栗縣|南投縣)/.test(addr)) {
      return false;
    }
    // All 13 official Taiwan Counties (with or without "County" / "Hsien", excluding "<Name> City"):
    for (const county of TAIWAN_COUNTIES) {
      if (isPlaceUsedAsStreetName(lower, county)) continue;
      const escaped = county.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b(?!\\s+city\\b)`, "i").test(lower)) {
        return true;
      }
    }
    // Chinese county names (excluding "<Name>市" cities)
    if (/(?:彰化|嘉義|新竹|花蓮|金門|連江|馬祖|苗栗|南投|澎湖|屏東|台東|臺東|宜蘭|雲林)(?:縣|县|(?!市))/.test(addr)) {
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

  // Country official capital city exception (both City and State are considered available)
  if (hasCapitalInAddress(lower, country)) return true;

  // Strip street-label uses like "County Road 42" / "State Highway 1" before checking administrative state keywords
  const strippedRoadLabels = lower
    .replace(/\bcounty\s+(?:road|rd\.?|highway|hwy\.?|route|rte\.?|line|ln\.?|street|st\.?|avenue|ave\.?|drive|dr\.?|way)\b/gi, " ")
    .replace(/\bstate\s+(?:road|rd\.?|highway|hwy\.?|route|rte\.?|line|street|st\.?)\b/gi, " ");

  // Generic and international administrative markers: (County, Province, Prefecture) -> State
  if (/\b(province|prov\.?|state|county|prefecture|pref\.?|hsien|region|territory|emirate|canton|department|governorate|oblast|voivodeship)\b/i.test(strippedRoadLabels)) return true;
  if (/\b(federal\s+district|district\s+of\s+columbia)\b/i.test(lower)) return true;
  if (/\bregional\s*council\b/i.test(lower)) return true;

  // County abbreviations (e.g. Co. Dublin, Co. Cork, Co. Kildare, Orange Co., Cook Co.) - exclude company suffixes like Co. Ltd
  if (/\bco\.?\s+(?!ltd\b|limited\b|inc\b|corp\b|llc\b)[a-z]{3,}\b/i.test(strippedRoadLabels) ||
      /\b(?!limited\b|ltd\b|inc\b|corp\b|llc\b)[a-z]{3,}\s+co\.?\b(?=[,\s]|$)/i.test(strippedRoadLabels)) return true;

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

function stripNonAdministrativeCityTerms(addr) {
  return String(addr || "")
    .replace(/\b(?:industrial|business|commercial|technology|science|enterprise|tech|trade|trading)\s+(?:district|town|park|estate)\b/gi, " ")
    .replace(/\b(?:china\s*town|chinatown|down\s*town|downtown)\b/gi, " ")
    .replace(/\b(cape\s*town|george\s*town)\b/gi, " ")
    .replace(/\b(?:town|district|municipality|shire|borough)\s+(?:road|rd\.?|street|st\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|way|highway|hwy\.?)\b/gi, " ");
}

function hasCityDesignation(addr) {
  if (!addr) return false;
  // Chinese / East Asian City, Town, Township, District characters: 市 (City), 鎮/镇 (Town), 鄉/乡 (Township), 區/区 (District)
  if (/[\u5e02\u93ae\u9547\u9109\u4e61\u5340\u533a]/.test(addr)) return true;

  const stripped = stripNonAdministrativeCityTerms(addr);
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
    const strippedTW = stripNonAdministrativeCityTerms(cleanAddr);
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
    // (excluding industrial/business districts or street names like City Road / District Road)
    const strippedNZ = stripNonAdministrativeCityTerms(cleanAddr);
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
    const strippedMY = stripNonAdministrativeCityTerms(cleanAddr)
      .replace(/\b(?:kawasan|taman|zon)?\s*perindustrian(?:\s+[A-Za-z0-9]+)?/gi, " ");
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
    const strippedID = stripNonAdministrativeCityTerms(cleanAddr)
      .replace(/\bkawasan\s+(?:industri|berikat)(?:\s+[A-Za-z0-9]+)?/gi, " ");
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
    const strippedUS = stripNonAdministrativeCityTerms(cleanAddr);
    if (hasExplicitCityWord(strippedUS) || /\b(?:town|township|borough|municipality|village)\b/i.test(strippedUS)) {
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

  // UK Exception: Official UK cities, towns, boroughs, and explicit Town/District/Municipality designations evaluate as Available
  if (isUkLocation(cleanAddr, country)) {
    if (hasUkCityOrTown(cleanAddr) || hasCityDesignation(cleanAddr)) {
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
    const strippedAU = stripNonAdministrativeCityTerms(cleanAddr);
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
    const strippedZA = stripNonAdministrativeCityTerms(cleanAddr);
    if (hasExplicitCityWord(strippedZA) || /\b(?:town|township|district|municipality|metropolitan\s*municipality|borough)\b/i.test(strippedZA)) {
      return "Available";
    }
    return "Not Available";
  }

  // Explicit qualifying City, Town, Township, District, Municipality, or local language designation
  // (Non-administrative industrial/business districts/towns & street labels are already excluded inside hasCityDesignation)
  if (hasCityDesignation(cleanAddr)) {
    return "Available";
  }

  // Suburb-only addresses: If the address only has a suburb and no recognized city/town/district/municipality, MUST evaluate as Not Available!
  if (addressLooksLikeSuburbOnly(cleanAddr)) {
    return "Not Available";
  }

  // Recognized International Towns/Cities
  if (hasRecognizedPlaceName(cleanAddr, RECOGNIZED_TOWNS)) {
    return "Available";
  }

  // Structural address detection (for USA, Canada, and countries where city precedes state/province)
  if (isUnitedStatesLocation(cleanAddr, country) || /\b(?:canada|china|germany|deutschland|france)\b/i.test(country || cleanAddr)) {
    const structCity = detectCityFromStructure(cleanAddr, country);
    if (structCity && !isNotCitySegment(structCity)) {
      return "Available";
    }
  }

  return "Not Available";
}

/**
 * Determines Country Name EXCLUSIVELY from the physical address string.
 * Strictly NEVER checks or guesses from the domain name or URL extension.
 */
function detectCountryFromAddress(address) {
  if (!address || typeof address !== "string" || address.trim().length < 3) return "";
  const lower = address.toLowerCase();
  // Strip combining diacritics so JS ASCII \b word boundaries work on "Österreich", "España", "Türkiye", "São Paulo", etc.
  const unaccented = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Explicit country mentioned in the physical address text
  if (/\b(?:czech\s*republic|ceska\s*republika|cesko|czechia)\b/i.test(unaccented)) return "Czech Republic";
  if (/\b(south\s*africa)\b/i.test(unaccented)) return "South Africa";
  if (/\b(people['’]?s?\s*republic\s*of\s*china|p\.?r\.?c\.?)\b/i.test(unaccented)) return "China";
  if (/\b(taiwan|republic\s*of\s*china|r\.?o\.?c\.?)\b/i.test(unaccented) || /(?:臺灣|台灣|臺北|台北|新北|桃園|台中|臺中|台南|臺南|高雄|新竹|彰化|苗栗|南投|雲林|嘉義|屏東|宜蘭|花蓮|台東|臺東|澎湖|金門|連江|馬祖|基隆|大里|永康|草堤|湖口|竹北|員林|鹿港|板橋|新莊|中壢|楊梅|龜山|蘆竹|中華民國)/.test(address)) return "Taiwan";
  if (/\b(england)\b/i.test(unaccented)) return "England";
  if (/\b(scotland)\b/i.test(unaccented)) return "Scotland";
  if (/(?<!\bnew\s+south\s+)\bwales\b/i.test(unaccented)) return "Wales";
  if (/\b(northern\s*ireland)\b/i.test(unaccented)) return "Northern Ireland";
  if (/\b(united\s*kingdom|great\s*britain|uk)\b/i.test(unaccented)) {
    if (/\b(?:england)\b/i.test(unaccented)) return "England";
    if (/\b(?:scotland)\b/i.test(unaccented)) return "Scotland";
    if (/(?<!\bnew\s+south\s+)\b(?:wales)\b/i.test(unaccented)) return "Wales";
    if (/\b(?:northern\s*ireland)\b/i.test(unaccented)) return "Northern Ireland";
    return "United Kingdom";
  }
  if (/\b(united\s*states(?:\s*of\s*america)?|usa|u\.s\.a\.?|u\.s\.?)\b/i.test(unaccented)) return "United States Of America";
  if (/\b(australia)\b/i.test(unaccented)) return "Australia";
  if (/\b(canada)\b/i.test(unaccented)) return "Canada";
  if (/\b(germany|deutschland)\b/i.test(unaccented)) return "Germany";
  if (/\b(india)\b/i.test(unaccented)) return "India";
  if (/\b(france)\b/i.test(unaccented)) return "France";
  if (/\b(people'?s?\s*republic\s*of\s*china|p\.?r\.?c\.?|china)\b/i.test(unaccented)) return "China";
  if (/\b(japan)\b/i.test(unaccented)) return "Japan";
  if (/\b(north\s*korea|d\.?p\.?r\.?k\.?)\b/i.test(unaccented)) return "North Korea";
  if (/\b(south\s*korea|republic\s*of\s*korea|korea)\b/i.test(unaccented)) return "South Korea";
  if (/\b(singapore)\b/i.test(unaccented)) return "Singapore";
  if (/\b(netherlands|nederland|holland)\b/i.test(unaccented)) return "Netherlands";
  if (/\b(?:new\s*zealand|aotearoa)\b/i.test(unaccented) || /,\s*nz\b/i.test(unaccented) || /\bnz\s+\d{4}\b/i.test(unaccented)) return "New Zealand";
  if (/\b(?:malaysia|federation\s*of\s*malaysia|persekutuan\s*malaysia)\b/i.test(unaccented)) return "Malaysia";
  if (/\b(?:indonesia|republik\s*indonesia|republic\s*of\s*indonesia)\b/i.test(unaccented)) return "Indonesia";
  if (/\b(united\s*arab\s*emirates|uae)\b/i.test(unaccented)) return "United Arab Emirates";
  if (/\b(italy|italia)\b/i.test(unaccented)) return "Italy";
  if (/\b(spain|espana)\b/i.test(unaccented)) return "Spain";
  if (/\b(turkiye|turkey|republic\s*of\s*turkiye|republic\s*of\s*turkey)\b/i.test(unaccented)) return "Türkiye";
  if (/\b(austria|osterreich|oesterreich)\b/i.test(unaccented)) return "Austria";
  if (/\b(switzerland|schweiz|suisse|svizzera)\b/i.test(unaccented)) return "Switzerland";
  if (/\b(croatia|hrvatska)\b/i.test(unaccented)) return "Croatia";
  if (/\b(kingdom\s*of\s*bahrain|bahrain)\b/i.test(unaccented)) return "Bahrain";
  if (/\b(sultanate\s*of\s*oman|oman)\b/i.test(unaccented)) return "Oman";
  if (/\b(brunei\s*darussalam|brunei)\b/i.test(unaccented)) return "Brunei Darussalam";
  if (/\b(hong\s*kong)\b/i.test(unaccented)) return "Hong Kong";
  if (/\b(greenland|kalaallit\s*nunaat)\b/i.test(unaccented)) return "Greenland";
  if (/\b(saudi\s*arabia)\b/i.test(unaccented)) return "Saudi Arabia";
  if (/\b(qatar|kuwait|jordan|lebanon|israel|egypt|morocco|tunisia|algeria)\b/i.test(unaccented)) {
    const m = unaccented.match(/\b(qatar|kuwait|jordan|lebanon|israel|egypt|morocco|tunisia|algeria)\b/i);
    if (m) return toTitleCase(m[1]);
  }
  if (/\b(belgium|belgie|belgique|poland|polska|portugal|greece|hellas|sweden|sverige|norway|norge|denmark|danmark|finland|suomi|hungary|magyarorszag|romania|bulgaria|slovakia|slovensko|slovenia|slovenija|serbia|srbija|ukraine|russia|russian\s*federation|belarus|estonia|latvia|lithuania|luxembourg|iceland|malta|cyprus|andorra|liechtenstein|albania|moldova|north\s*macedonia|armenia|azerbaijan|kazakhstan|uzbekistan)\b/i.test(unaccented)) {
    if (/\b(belgium|belgie|belgique)\b/i.test(unaccented)) return "Belgium";
    if (/\b(poland|polska)\b/i.test(unaccented)) return "Poland";
    if (/\b(greece|hellas)\b/i.test(unaccented)) return "Greece";
    if (/\b(sweden|sverige)\b/i.test(unaccented)) return "Sweden";
    if (/\b(norway|norge)\b/i.test(unaccented)) return "Norway";
    if (/\b(denmark|danmark)\b/i.test(unaccented)) return "Denmark";
    if (/\b(finland|suomi)\b/i.test(unaccented)) return "Finland";
    if (/\b(hungary|magyarorszag)\b/i.test(unaccented)) return "Hungary";
    if (/\b(slovakia|slovensko)\b/i.test(unaccented)) return "Slovakia";
    if (/\b(slovenia|slovenija)\b/i.test(unaccented)) return "Slovenia";
    if (/\b(serbia|srbija)\b/i.test(unaccented)) return "Serbia";
    if (/\b(russia|russian\s*federation)\b/i.test(unaccented)) return "Russia";
    if (/\b(north\s*macedonia)\b/i.test(unaccented)) return "North Macedonia";
    const m = unaccented.match(/\b(portugal|romania|bulgaria|ukraine|belarus|estonia|latvia|lithuania|luxembourg|iceland|malta|cyprus|andorra|liechtenstein|albania|moldova|armenia|azerbaijan|kazakhstan|uzbekistan)\b/i);
    if (m) return toTitleCase(m[1]);
  }
  if (/\b(viet\s*nam|vietnam|philippines|pakistan|bangladesh|sri\s*lanka|nepal|bhutan|myanmar|cambodia|maldives|mongolia|afghanistan|iran|iraq|syria)\b/i.test(unaccented)) {
    if (/\b(viet\s*nam|vietnam)\b/i.test(unaccented)) return "Vietnam";
    if (/\b(sri\s*lanka)\b/i.test(unaccented)) return "Sri Lanka";
    const m = unaccented.match(/\b(philippines|pakistan|bangladesh|nepal|bhutan|myanmar|cambodia|maldives|mongolia|afghanistan|iran|iraq|syria)\b/i);
    if (m) return toTitleCase(m[1]);
  }
  if (/\b(mexico|brazil|brasil|argentina|colombia|peru|uruguay|paraguay|bolivia|costa\s*rica|panama|guatemala|nicaragua|belize|guyana|suriname|jamaica|bahamas|barbados|dominican\s*republic|cayman\s*islands|saint\s*lucia|trinidad\s*(?:and|&)\s*tobago|fiji|papua\s*new\s*guinea|samoa|vanuatu)\b/i.test(unaccented)) {
    if (/\b(mexico)\b/i.test(unaccented)) return "Mexico";
    if (/\b(brazil|brasil)\b/i.test(unaccented)) return "Brazil";
    if (/\b(peru)\b/i.test(unaccented)) return "Peru";
    if (/\b(trinidad\s*(?:and|&)\s*tobago)\b/i.test(unaccented)) return "Trinidad and Tobago";
    if (/\b(costa\s*rica|dominican\s*republic|cayman\s*islands|saint\s*lucia|papua\s*new\s*guinea)\b/i.test(unaccented)) {
      const m2 = unaccented.match(/\b(costa\s*rica|dominican\s*republic|cayman\s*islands|saint\s*lucia|papua\s*new\s*guinea)\b/i);
      if (m2) return toTitleCase(m2[1]);
    }
    const m = unaccented.match(/\b(argentina|colombia|uruguay|paraguay|bolivia|panama|guatemala|nicaragua|belize|guyana|suriname|jamaica|bahamas|barbados|fiji|samoa|vanuatu)\b/i);
    if (m) return toTitleCase(m[1]);
  }
  if (/\b(nigeria|kenya|ghana|ethiopia|tanzania|uganda|rwanda|botswana|namibia|zambia|zimbabwe|mozambique|angola|madagascar|mauritius|seychelles|sierra\s*leone|sudan)\b/i.test(unaccented)) {
    if (/\b(sierra\s*leone)\b/i.test(unaccented)) return "Sierra Leone";
    const m = unaccented.match(/\b(nigeria|kenya|ghana|ethiopia|tanzania|uganda|rwanda|botswana|namibia|zambia|zimbabwe|mozambique|angola|madagascar|mauritius|seychelles|sudan)\b/i);
    if (m) return toTitleCase(m[1]);
  }

  // 2. Definitive administrative regions/towns explicitly appearing in physical address
  if (/\b(?:prague|praha|brno|ostrava|plzen|olomouc|liberec|ceske\s*budejovice|hradec\s*kralove|usti\s*nad\s*labem|pardubice|zlin|havirov|kladno|most|karvina|opava|frydek-mistek)\b/i.test(unaccented)) {
    return "Czech Republic";
  }
  if (/\b(?:taoyuan\s*hsien|taoyuan|yangmei|taipei|new\s*taipei|kaohsiung|taichung|tainan|hsinchu|changhua|chiayi|miaoli|nantou|yunlin|pingtung|yilan|hualien|taitung|keelung|kinmen|penghu|lienchiang|matsu|yongkang|zhongli|banqiao|xinzhuang|zhonghe|yonghe|xindian|tucheng|luzhou|xizhi|shulin|sanxia|yingge|wugu|taishan|linkou|tamsui|dali|taiping|fengyuan|shalu|wuqi|houli|tanzi|wuri|lukang|yuanlin|zhubei|zhudong|hukou|toufen|zhunan)\b/i.test(unaccented)) {
    return "Taiwan";
  }
  if (/\b(boksburg|johannesburg|pretoria|durban|cape\s*town|sandton|midrand|centurion|gauteng|ekurhuleni)\b/i.test(unaccented)) {
    return "South Africa";
  }
  if (/\b(ireland)\b/i.test(unaccented)) return "Ireland";
  if (/\b(thailand)\b/i.test(unaccented)) return "Thailand";

  // Canada provinces, territory codes, Canadian postal code pattern (A1A 1A1)
  if (/\b(?:ontario|quebec|british\s*columbia|alberta|manitoba|saskatchewan|nova\s*scotia|new\s*brunswick|newfoundland|prince\s*edward\s*island)\b/i.test(unaccented) ||
    /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i.test(address) ||
    /(?:^|[,\s])(?:QC|BC|AB|ON|MB|SK|NS|NB|NL|PE)\b/i.test(address) && /\b(?:Canada|CA)\b/i.test(address) ||
    /,\s*(?:QC|BC|AB|ON|MB|SK|NS|NB|NL|PE)(?:,\s*CA)?\s*$/i.test(address) ||
    /\b(?:Montreal|Toronto|Vancouver|Calgary|Edmonton|Ottawa|Winnipeg|Quebec\s*City|Hamilton|Kitchener|London|Victoria|Halifax|Longueuil|Laval|Gatineau|Burnaby|Richmond|Saskatoon|Regina)\b/i.test(unaccented) && /\b(?:Canada|CA|QC|BC|AB|ON|MB|SK)\b/i.test(address)) {
    return "Canada";
  }

  // Indonesia check MUST run before US 2-letter state code + 5-digit zip fallback
  if (hasIndonesiaAddressSignal(address, "") || (/\b(?:jepara|semarang|surabaya|bandung|bekasi|tangerang|jakarta|jawa|kabupaten|kecamatan|jalan|perumahan)\b/i.test(unaccented) && /,\s*id\s*$/i.test(unaccented))) {
    return "Indonesia";
  }

  const US_STATE_CODES_STR = "al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy";
  if (new RegExp(`(?:^|[,\\s])(?:${US_STATE_CODES_STR})\\s+\\d{5}(?:-\\d{4})?\\b`, "i").test(unaccented)) return "United States Of America";
  if (new RegExp(`,\\s*(?:${US_STATE_CODES_STR})\\s*$`, "i").test(unaccented)) return "United States Of America";
  if (/\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new\s*hampshire|new\s*jersey|new\s*mexico|new\s*york|north\s*carolina|north\s*dakota|ohio|oklahoma|oregon|pennsylvania|rhode\s*island|south\s*carolina|south\s*dakota|tennessee|texas|utah|vermont|virginia|washington|west\s*virginia|wisconsin|wyoming|district\s*of\s*columbia)\b/i.test(unaccented)) return "United States Of America";
  if (/\b(?:new\s*south\s*wales|victoria|queensland|western\s*australia|south\s*australia|tasmania|northern\s*territory|australian\s*capital\s*territory|sydney|melbourne|brisbane|perth|adelaide|canberra|hobart|darwin|gold\s*coast|newcastle|wollongong|geelong|cairns|townsville)\b/i.test(unaccented) ||
    /\b(?:vic|nsw|qld|wa|sa|tas|act|nt)\s+\d{4}\b/i.test(unaccented) ||
    /,\s*(?:vic|nsw|qld|wa|sa|tas|act|nt)\b/i.test(unaccented)) return "Australia";
  if (/\b(bavaria|bayern|baden-wurttemberg|nordrhein-westfalen|hessen|sachsen|weissenhorn|munich|munchen|berlin|frankfurt|hamburg|stuttgart|cologne|koln|dusseldorf|dortmund|essen|leipzig|bremen|dresden|hannover|nurnberg|nuremberg|ulm|neu-ulm|augsburg|wiesbaden|karlsruhe|mannheim|bonn|munster|bielefeld|aachen|freiburg|heidelberg|wolfsburg|ingolstadt|regensburg)\b/i.test(unaccented)) return "Germany";
  if (/\b(andalucia|cataluna|galicia|pais\s*vasco|aragon|asturias|baleares|canarias|cantabria|castilla|extremadura|navarra|rioja|barcelona|valencia|sevilla|zaragoza|malaga|murcia|alicante|cordoba|valladolid|vigo|gijon|coruna|toledo|vizcaya|bizkaia)\b/i.test(unaccented)) return "Spain";
  if (/\b(maharashtra|karnataka|tamil\s*nadu|gujarat|uttar\s*pradesh|telangana|delhi)\b/i.test(unaccented)) return "India";
  if (/\b(?:taoyuan|hsinchu|miaoli|changhua|nantou|yunlin|chiayi|pingtung|yilan|hualien|taitung|keelung|kinmen|penghu)\s*(?:hsien|county)\b/i.test(unaccented)) return "Taiwan";
  if (/\b(istanbul|ankara|izmir|bursa|antalya|adana|konya|gaziantep|kocaeli|mersin|diyarbakir|kayseri|eskisehir|sanliurfa|samsun|denizli|sakarya|mugla|trabzon)\b/i.test(unaccented)) return "Türkiye";
  if (/\b(selangor|johor|perak|kedah|pahang|negeri\s*sembilan|melaka|malacca|terengganu|kelantan|sabah|sarawak|perlis|wilayah\s*persekutuan|labuan|subang\s*jaya|petaling\s*jaya|shah\s*alam|klang|johor\s*bahru|george\s*town|ipoh|kota\s*kinabalu|kuching|seremban|batu\s*pahat|pasir\s*gudang|iskandar\s*puteri|puchong|cheras|cyberjaya|rawang|kajang|kuantan|alor\s*setar|taiping|sungai\s*petani|bintulu|miri|sibu|sandakan|tawau|butterworth|bukit\s*mertajam|nilai|semenyih)\b/i.test(unaccented)) return "Malaysia";
  if (/\b(penang|pulau\s*pinang)\b/i.test(unaccented) && !/\b(?:penang\s+road|penang\s+street|penang\s+lane)\b/i.test(unaccented)) return "Malaysia";
  if (/\b(jawa\s*barat|jawa\s*tengah|jawa\s*timur|west\s*java|central\s*java|east\s*java|banten|sumatera\s*utara|sumatera\s*barat|sumatera\s*selatan|north\s*sumatra|west\s*sumatra|south\s*sumatra|kalimantan\s*(?:timur|barat|selatan|tengah|utara)?|sulawesi\s*(?:selatan|utara|tengah|tenggara|barat)?|kepulauan\s*riau|bangka\s*belitung|nusa\s*tenggara\s*(?:barat|timur)?|dki\s*jakarta|di\s*yogyakarta|surabaya|bandung|medan|semarang|makassar|palembang|tangerang|tangerang\s*selatan|bekasi|depok|bogor|batam|pekanbaru|bandar\s*lampung|balikpapan|denpasar|samarinda|cikarang|karawang|sidoarjo|gresik|serang|cilegon|solo|surakarta|malang|pontianak|manado|banjarmasin|cimahi|sukabumi|cirebon|tasikmalaya|purwakarta|jepara)\b/i.test(unaccented)) return "Indonesia";
  if (/\b(canterbury|waikato|bay\s*of\s*plenty|otago|hawke's\s*bay|hawkes\s*bay|taranaki|manawatu|southland|northland|marlborough|tasman|west\s*coast|auckland|christchurch|hamilton|tauranga|dunedin|lower\s*hutt|upper\s*hutt|palmerston\s*north|invercargill|rotorua|whangarei|napier|porirua|new\s*plymouth|queenstown|blenheim|timaru|taupo|pukekohe|cambridge|whakatane|hastings|gisborne|nelson|whanganui|feilding|levin|masterton|ashburton|rangiora|rolleston|wanaka)\b/i.test(unaccented)) return "New Zealand";

  // Check Taiwan signals before Chinese character fallback to China
  const hasTaiwanSignal = /\b(?:taoyuan|yangmei|taipei|new\s*taipei|kaohsiung|taichung|tainan|hsinchu|changhua|chiayi|miaoli|nantou|yunlin|pingtung|yilan|hualien|taitung|keelung|kinmen|penghu|lienchiang|matsu|yongkang|zhongli|banqiao|xinzhuang|zhonghe|yonghe|xindian|tucheng|luzhou|xizhi|shulin|sanxia|yingge|wugu|taishan|linkou|tamsui|dali|taiping|fengyuan|shalu|wuqi|houli|tanzi|wuri|lukang|yuanlin|zhubei|zhudong|hukou|toufen|zhunan)\b/i.test(unaccented) ||
    /(?:臺灣|台灣|臺北|台北|新北|桃園|台中|臺中|台南|臺南|高雄|新竹|彰化|苗栗|南投|雲林|嘉義|屏東|宜蘭|花蓮|台東|臺東|澎湖|金門|連江|馬祖|基隆|大里|永康|草堤|湖口|竹北|員林|鹿港|板橋|新莊|中壢|楊梅|龜山|蘆竹|中華民國)/.test(address);
  if (hasTaiwanSignal) {
    return "Taiwan";
  }

  if (/\b(guangdong|jiangsu|zhejiang|shandong|henan|sichuan|hubei|hunan|hebei|fujian|anhui|liaoning|shaanxi|jiangxi|huizhou|shenzhen|guangzhou|dongguan|foshan|zhongshan|zhuhai|suzhou|wuxi|changzhou|nanjing|hangzhou|ningbo|wenzhou|jiaxing|qingdao|jinan|yantai|weifang|xiamen|fuzhou|quanzhou|chengdu|wuhan|changsha|zhengzhou)\b/i.test(unaccented) || /[\u4e00-\u9fa5]/.test(address)) {
    return "China";
  }

  // Global major cities/provinces for additional 135-country coverage
  if (/\b(dubai|abu\s*dhabi|sharjah|ajman|ras\s*al\s*khaimah|fujairah)\b/i.test(unaccented)) return "United Arab Emirates";
  if (/\b(riyadh|jeddah|dammam|khobar|makkah|madinah)\b/i.test(unaccented)) return "Saudi Arabia";
  if (/\b(doha|al\s*wakrah)\b/i.test(unaccented)) return "Qatar";
  if (/\b(manama|muharraq)\b/i.test(unaccented)) return "Bahrain";
  if (/\b(muscat|salalah|sohar)\b/i.test(unaccented)) return "Oman";
  if (/\b(kuwait\s*city|hawalli)\b/i.test(unaccented)) return "Kuwait";
  if (/\b(zagreb|split|rijeka|osijek|zadar|dubrovnik)\b/i.test(unaccented)) return "Croatia";
  if (/\b(warsaw|warszawa|krakow|wroclaw|poznan|gdansk|lodz|katowice|gryfino|szczecin|lublin)\b/i.test(unaccented)) return "Poland";
  if (/\b(bucharest|bucuresti|cluj-napoca|timisoara|iasi|brasov|constanta)\b/i.test(unaccented)) return "Romania";
  if (/\b(budapest|debrecen|szeged|miskolc)\b/i.test(unaccented)) return "Hungary";
  if (/\b(sofia|plovdiv|varna|burgas)\b/i.test(unaccented)) return "Bulgaria";
  if (/\b(bratislava|kosice)\b/i.test(unaccented)) return "Slovakia";
  if (/\b(ljubljana|maribor)\b/i.test(unaccented)) return "Slovenia";
  if (/\b(belgrade|beograd|novi\s*sad)\b/i.test(unaccented)) return "Serbia";
  if (/\b(athens|athina|thessaloniki)\b/i.test(unaccented)) return "Greece";
  if (/\b(lisbon|lisboa|porto)\b/i.test(unaccented)) return "Portugal";
  if (/\b(vienna|wien|graz|linz|salzburg|innsbruck)\b/i.test(unaccented)) return "Austria";
  if (/\b(brussels|bruxelles|brussel|antwerp|antwerpen|ghent|gent)\b/i.test(unaccented)) return "Belgium";
  if (/\b(stockholm|gothenburg|goteborg|malmo|uppsala)\b/i.test(unaccented)) return "Sweden";
  if (/\b(oslo|bergen|trondheim|stavanger)\b/i.test(unaccented)) return "Norway";
  if (/\b(copenhagen|kobenhavn|aarhus|odense)\b/i.test(unaccented)) return "Denmark";
  if (/\b(helsinki|espoo|tampere|turku|oulu)\b/i.test(unaccented)) return "Finland";
  if (/\b(moscow|moskva|saint\s*petersburg|novosibirsk|yekaterinburg|kazan)\b/i.test(unaccented)) return "Russia";
  if (/\b(kyiv|kiev|kharkiv|odesa|odessa|dnipro|lviv)\b/i.test(unaccented)) return "Ukraine";
  if (/\b(tel\s*aviv|jerusalem|haifa)\b/i.test(unaccented)) return "Israel";
  if (/\b(cairo|alexandria|giza)\b/i.test(unaccented)) return "Egypt";
  if (/\b(casablanca|rabat|marrakech|tangier)\b/i.test(unaccented)) return "Morocco";
  if (/\b(lagos|abuja|kano|ibadan)\b/i.test(unaccented)) return "Nigeria";
  if (/\b(nairobi|mombasa)\b/i.test(unaccented)) return "Kenya";
  if (/\b(karachi|lahore|islamabad|faisalabad|rawalpindi|sialkot|gujranwala|punjab|sindh|khyber\s*pakhtunkhwa|balochistan)\b/i.test(unaccented)) return "Pakistan";
  if (/\b(dhaka|chattogram|chittagong|khulna|sylhet|rajshahi)\b/i.test(unaccented)) return "Bangladesh";
  if (/\b(colombo|kandy|galle)\b/i.test(unaccented)) return "Sri Lanka";
  if (/\b(manila|quezon\s*city|cebu|makati|taguig|pasig|davao)\b/i.test(unaccented)) return "Philippines";
  if (/\b(ho\s*chi\s*minh|hanoi|ha\s*noi|da\s*nang|hai\s*phong)\b/i.test(unaccented)) return "Vietnam";
  if (/\b(sao\s*paulo|rio\s*de\s*janeiro|belo\s*horizonte|curitiba|porto\s*alegre|brasilia|campinas)\b/i.test(unaccented)) return "Brazil";
  if (/\b(mexico\s*city|ciudad\s*de\s*mexico|guadalajara|monterrey|puebla|tijuana|queretaro)\b/i.test(unaccented)) return "Mexico";
  if (/\b(buenos\s*aires|cordoba\s*capital|rosario|mendoza)\b/i.test(unaccented)) return "Argentina";
  if (/\b(bogota|medellin|cali|barranquilla)\b/i.test(unaccented)) return "Colombia";
  if (/\b(arequipa|trujillo|callao)\b/i.test(unaccented)) return "Peru";
  if (/\b(bandar\s*seri\s*begawan|kuala\s*belait)\b/i.test(unaccented)) return "Brunei Darussalam";
  if (/\b(kowloon|tsim\s*sha\s*tsui|tsuen\s*wan|kwun\s*tong|sha\s*tin|causeway\s*bay|wan\s*chai)\b/i.test(unaccented)) return "Hong Kong";

  // UK postcodes & major UK counties / administrative regions
  if (/\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(unaccented)) {
    if (/\b(?:eh|g|ab|dd|dg|fk|hs|iv|ka|kw|ky|ml|pa|ph|td|ze)\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(unaccented)) return "Scotland";
    if (/\b(?:cf|ld|ll|np|sa)\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(unaccented)) return "Wales";
    if (/\bbt\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(unaccented)) return "Northern Ireland";
    return "England";
  }
  if (/\b(greater\s*london|greater\s*manchester|west\s*midlands|west\s*yorkshire|south\s*yorkshire|tyne\s*and\s*wear|merseyside|berkshire|buckinghamshire|cambridgeshire|cheshire|cornwall|cumbria|derbyshire|devon|dorset|durham|county\s*durham|essex|gloucestershire|hampshire|hertfordshire|kent|lancashire|leicestershire|lincolnshire|middlesex|norfolk|northamptonshire|northumberland|nottinghamshire|oxfordshire|shropshire|somerset|staffordshire|suffolk|surrey|sussex|east\s*sussex|west\s*sussex|warwickshire|wiltshire|worcestershire|yorkshire|east\s*yorkshire|north\s*yorkshire|bedfordshire|rutland|herefordshire|isle\s*of\s*wight)\b/i.test(unaccented)) {
    return "England";
  }

  // 3. National Capital mentioned in the physical address text
  if (isNewTaipeiCity(unaccented)) return "Taiwan";
  if (/\b(taipei|taipei\s*city)\b/i.test(unaccented)) return "Taiwan";
  if (/\b(pretoria|cape\s*town|bloemfontein)\b/i.test(unaccented)) return "South Africa";
  if (/\b(london)\b/i.test(unaccented)) return "England";
  if (/\b(edinburgh)\b/i.test(unaccented)) return "Scotland";
  if (/\b(cardiff)\b/i.test(unaccented)) return "Wales";
  if (/\b(belfast)\b/i.test(unaccented)) return "Northern Ireland";
  if (/\b(washington\s*d\.?c\.?)\b/i.test(unaccented)) return "United States Of America";
  if (/\b(ottawa)\b/i.test(unaccented)) return "Canada";
  if (/\b(canberra)\b/i.test(unaccented)) return "Australia";
  if (/\b(berlin)\b/i.test(unaccented)) return "Germany";
  if (/\b(paris|rixheim|mulhouse|lyon|marseille|toulouse|nice|nantes|strasbourg|bordeaux|lille)\b/i.test(unaccented)) return "France";
  if (/\b(madrid)\b/i.test(unaccented)) return "Spain";
  if (/\b(roma|rome|milan|milano|turin|torino|bologna|florence|firenze|naples|napoli)\b/i.test(unaccented)) return "Italy";
  if (/\b(tokyo|osaka|nagoya|yokohama|kyoto|kobe|fukuoka|sapporo)\b/i.test(unaccented)) return "Japan";
  if (/\b(beijing)\b/i.test(unaccented)) return "China";
  if (/\b(new\s*delhi)\b/i.test(unaccented)) return "India";
  if (/\b(seoul|busan|incheon|daegu|daejeon|suwon)\b/i.test(unaccented)) return "South Korea";
  if (/\b(ankara)\b/i.test(unaccented)) return "Türkiye";
  if (/\b(wellington)\b/i.test(unaccented) && !/\b(?:mount|mt\.?)\s+wellington\b/i.test(unaccented) && !isPlaceUsedAsStreetName(unaccented, "wellington")) return "New Zealand";
  if (/\b(kuala\s*lumpur|putrajaya)\b/i.test(unaccented)) return "Malaysia";
  if (/\b(jakarta|dki\s*jakarta|nusantara)\b/i.test(unaccented)) return "Indonesia";
  if (/\b(prague|praha)\b/i.test(unaccented)) return "Czech Republic";
  if (/\b(amsterdam|rotterdam|the\s*hague|den\s*haag|utrecht|eindhoven)\b/i.test(unaccented)) return "Netherlands";
  if (/\b(zurich|geneva|basel|bern|lausanne)\b/i.test(unaccented)) return "Switzerland";
  if (/\b(dublin|cork|galway|limerick)\b/i.test(unaccented)) return "Ireland";
  if (/\b(bangkok|nonthaburi|chiang\s*mai|chonburi|rayong|samut\s*prakan)\b/i.test(unaccented)) return "Thailand";
  if (/\b(nuuk|amman|beirut|nicosia|valletta|reykjavik|tallinn|riga|vilnius|minsk|chisinau|tirana|skopje|yerevan|baku|astana|tashkent|kathmandu|thimphu|yangon|phnom\s*penh|ulaanbaatar|baghdad|tehran|damascus|kabul|khartoum|addis\s*ababa|kampala|kigali|gaborone|windhoek|lusaka|harare|maputo|luanda|antananarivo|port\s*louis|victoria|freetown|accra|kingston|nassau|bridgetown|santo\s*domingo|belmopan|georgetown|paramaribo|panama\s*city|managua|san\s*jose|guatemala\s*city|suva|port\s*moresby|apia|port\s*vila|asuncion|la\s*paz|sucre|montevideo|lima)\b/i.test(unaccented)) {
    const capMap = {
      "nuuk": "Greenland", "amman": "Jordan", "beirut": "Lebanon", "nicosia": "Cyprus", "valletta": "Malta",
      "reykjavik": "Iceland", "tallinn": "Estonia", "riga": "Latvia", "vilnius": "Lithuania",
      "minsk": "Belarus", "chisinau": "Moldova", "tirana": "Albania", "skopje": "North Macedonia",
      "yerevan": "Armenia", "baku": "Azerbaijan", "astana": "Kazakhstan", "tashkent": "Uzbekistan",
      "kathmandu": "Nepal", "thimphu": "Bhutan", "yangon": "Myanmar", "phnom penh": "Cambodia",
      "ulaanbaatar": "Mongolia", "baghdad": "Iraq", "tehran": "Iran", "damascus": "Syria",
      "kabul": "Afghanistan", "khartoum": "Sudan", "addis ababa": "Ethiopia", "kampala": "Uganda",
      "kigali": "Rwanda", "gaborone": "Botswana", "windhoek": "Namibia", "lusaka": "Zambia",
      "harare": "Zimbabwe", "maputo": "Mozambique", "luanda": "Angola", "antananarivo": "Madagascar",
      "port louis": "Mauritius", "freetown": "Sierra Leone", "accra": "Ghana", "kingston": "Jamaica",
      "nassau": "Bahamas", "bridgetown": "Barbados", "santo domingo": "Dominican Republic",
      "belmopan": "Belize", "georgetown": "Guyana", "paramaribo": "Suriname", "panama city": "Panama",
      "managua": "Nicaragua", "san jose": "Costa Rica", "guatemala city": "Guatemala", "suva": "Fiji",
      "port moresby": "Papua New Guinea", "apia": "Samoa", "port vila": "Vanuatu", "asuncion": "Paraguay",
      "la paz": "Bolivia", "sucre": "Bolivia", "montevideo": "Uruguay", "lima": "Peru"
    };
    const m = unaccented.match(/\b(nuuk|amman|beirut|nicosia|valletta|reykjavik|tallinn|riga|vilnius|minsk|chisinau|tirana|skopje|yerevan|baku|astana|tashkent|kathmandu|thimphu|yangon|phnom\s*penh|ulaanbaatar|baghdad|tehran|damascus|kabul|khartoum|addis\s*ababa|kampala|kigali|gaborone|windhoek|lusaka|harare|maputo|luanda|antananarivo|port\s*louis|freetown|accra|kingston|nassau|bridgetown|santo\s*domingo|belmopan|georgetown|paramaribo|panama\s*city|managua|san\s*jose|guatemala\s*city|suva|port\s*moresby|apia|port\s*vila|asuncion|la\s*paz|sucre|montevideo|lima)\b/i);
    if (m) {
      const k = m[1].replace(/\s+/g, " ");
      if (capMap[k]) return capMap[k];
    }
  }

  return "";
}

