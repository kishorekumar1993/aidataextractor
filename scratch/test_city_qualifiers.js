const streetSuffixPattern = "\\s+(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|view|gate|mews|row|wharf|park|highway|center|centre|hall|rd|st|ave|dr|ln|blvd|hwy|plz|plaza)\\b";
const streetPrefixPattern = "\\b(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|view|gate|mews|row|wharf|park|highway)\\s+";

const CITY_QUALIFIERS = [
  // English administrative designations
  "town", "township", "district", "municipality", "metropolitan\\s*municipality",
  "local\\s*municipality", "district\\s*municipality", "borough", "shire", "village",
  // Non-English administrative designations across the 16 priority countries
  // Germany / Austria / Switzerland
  "stadt", "gemeinde", "marktgemeinde", "markt", "bezirk", "ortsteil",
  // Italy
  "comune", "municipio", "citt[aà]", "distretto",
  // France / Quebec / Belgium
  "ville", "municipalit[eé]", "arrondissement",
  // Spain / Mexico
  "ciudad", "distrito",
  // Indonesia
  "kota", "kabupaten", "kecamatan",
  // Thailand
  "thesaban", "amphoe", "amphur", "khet", "mueang", "muang",
  // Malaysia
  "bandar", "daerah", "mukim", "pekan", "majlis\\s*perbandaran",
  // India
  "taluk", "taluka", "tehsil", "tahsil", "mandal", "nagar\\s*palika", "nagar\\s*nigam"
];

function isNewTaipeiCity(address) {
  if (!address) return false;
  return /\bnew\s*taipei(\s*city)?\b/i.test(address);
}

function hasExplicitCityWord(cleanAddr) {
  const cityPattern = new RegExp(`(?<!${streetPrefixPattern})\\bcity\\b(?!${streetSuffixPattern})`, "i");
  return cityPattern.test(cleanAddr);
}

function hasQualifyingCityDesignation(cleanAddr) {
  if (hasExplicitCityWord(cleanAddr)) return true;
  const qualRegex = new RegExp(`\\b(?:${CITY_QUALIFIERS.join("|")})\\b`, "i");
  return qualRegex.test(cleanAddr);
}

function evaluateCityQC(address, country) {
  if (!address || typeof address !== "string" || address.trim().length < 3) {
    return "Not Available";
  }
  const cleanAddr = address.trim().toLowerCase();

  // New Taipei City rule: Must remain Not Available unless a qualifying administrative area is separately identified
  if (isNewTaipeiCity(cleanAddr)) {
    const addrWithoutNTC = cleanAddr.replace(/\bnew\s*taipei(\s*city)?\b/gi, " ");
    if (hasQualifyingCityDesignation(addrWithoutNTC)) {
      return "Available";
    }
    return "Not Available";
  }

  // Remove standalone city names that literally contain town as part of their proper name (e.g. Cape Town, George Town)
  const addrWithoutTownNamedCities = cleanAddr.replace(/\b(cape\s*town|george\s*town)\b/gi, " ");

  if (hasQualifyingCityDesignation(addrWithoutTownNamedCities)) {
    return "Available";
  }

  return "Not Available";
}

const tests = [
  { addr: "456 High Street, New Taipei City", expected: "Not Available" },
  { addr: "456 High Street, Banqiao District, New Taipei City", expected: "Available" },
  { addr: "789 Long Street, Cape Town, Western Cape", expected: "Not Available" },
  { addr: "City of Cape Town Metropolitan Municipality, Western Cape", expected: "Available" },
  { addr: "No. 123 Binhai Road, Cixi City, Zhejiang Province", expected: "Available" },
  { addr: "100 Main St, Kansas City, Missouri", expected: "Available" },
  { addr: "123 Main Street, Boston, Massachusetts", expected: "Not Available" },
  { addr: "123 City Road, Boston, Massachusetts", expected: "Not Available" },
  { addr: "Industriestr. 12, Stadt München, Bayern", expected: "Available" },
  { addr: "Hauptstr. 5, Gemeinde Feldkirchen", expected: "Available" }
];

for (const t of tests) {
  const actual = evaluateCityQC(t.addr);
  console.log(`${actual === t.expected ? '✓ PASS' : '✗ FAIL'}: ${t.addr} -> Actual: ${actual}, Expected: ${t.expected}`);
}
