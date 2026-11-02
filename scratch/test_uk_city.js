const UK_CITIES_AND_TOWNS = [
  // Official UK Cities
  "london", "birmingham", "manchester", "leeds", "glasgow", "liverpool", "newcastle upon tyne", "newcastle",
  "sheffield", "bristol", "edinburgh", "belfast", "cardiff", "coventry", "nottingham", "leicester",
  "sunderland", "brighton and hove", "brighton", "kingston upon hull", "hull", "plymouth", "stoke-on-trent",
  "wolverhampton", "derby", "swansea", "southampton", "salford", "aberdeen", "westminster", "portsmouth",
  "york", "peterborough", "dundee", "lancaster", "oxford", "newport", "preston", "st albans", "norwich",
  "chester", "cambridge", "salisbury", "exeter", "gloucester", "lisburn", "chichester", "winchester",
  "londonderry", "derry", "carlisle", "worcester", "bath", "durham", "lincoln", "hereford", "armagh",
  "inverness", "stirling", "canterbury", "lichfield", "newry", "ripon", "bangor", "truro", "ely",
  "wells", "st asaph", "st davids", "perth", "chelmsford", "milton keynes", "colchester", "doncaster",
  "wrexham", "dunfermline",

  // Major UK Towns & Municipal Centres
  "reading", "slough", "luton", "bolton", "bournemouth", "swindon", "northampton", "middlesbrough",
  "blackpool", "huddersfield", "ipswich", "blackburn", "watford", "rotherham", "stockport", "oldham",
  "walsall", "telford", "rochdale", "solihull", "poole", "halifax", "burnley", "scunthorpe", "grimsby",
  "hartlepool", "darlington", "southport", "wigan", "st helens", "warrington", "crewe", "macclesfield",
  "ellesmere port", "chesterfield", "mansfield", "worksop", "newark", "beeston", "loughborough",
  "hinckley", "kettering", "corby", "wellingborough", "bedford", "dunstable", "stevenage",
  "hemel hempstead", "welwyn garden city", "harlow", "basildon", "southend-on-sea", "brentwood",
  "braintree", "clacton-on-sea", "bury st edmunds", "lowestoft", "great yarmouth", "kings lynn",
  "thetford", "taunton", "yeovil", "bridgwater", "weston-super-mare", "trowbridge", "chippenham",
  "cheltenham", "stroud", "tewkesbury", "shrewsbury", "oswestry", "redditch", "kidderminster",
  "bromsgrove", "malvern", "warwick", "leamington spa", "rugby", "stratford-upon-avon", "nuneaton",
  "tamworth", "cannock", "stafford", "burton upon trent", "newcastle-under-lyme", "leek",
  "falkirk", "paisley", "east kilbride", "livingston", "cumbernauld", "hamilton", "kirkcaldy",
  "ayr", "kilmarnock", "greenock", "coatbridge", "glenrothes", "airdrie", "irvine", "dumfries",
  "motherwell", "rutherglen", "cambuslang", "barrhead", "bellshill", "blantyre", "elgin",
  "arbroath", "alloa", "dumbarton", "kirkintilloch", "clarkston", "bathgate", "stenhousemuir",
  "peterhead", "barry", "bridgend", "neath", "cwmbran", "llanelli", "merthyr tydfil", "caerphilly",
  "pontypridd", "ebbw vale", "aberystwyth",

  // London Boroughs
  "city of london", "city of westminster", "barking and dagenham", "barnet", "bexley", "brent",
  "bromley", "camden", "croydon", "ealing", "enfield", "greenwich", "hackney", "hammersmith and fulham",
  "haringey", "harrow", "havering", "hillingdon", "hounslow", "islington", "kensington and chelsea",
  "kingston upon thames", "lambeth", "lewisham", "merton", "newham", "redbridge", "richmond upon thames",
  "southwark", "sutton", "tower hamlets", "waltham forest", "wandsworth"
];

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

function hasUkCityOrTown(cleanAddr) {
  const streetSuffixPattern = "\\s+(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|view|gate|mews|row|wharf|park|st|rd|ave|dr|ln|blvd)\\b";
  const streetPrefixPattern = "\\b(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|view|gate|mews|row|wharf|park)\\s+";

  for (const name of UK_CITIES_AND_TOWNS) {
    const escaped = name.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const regex = new RegExp(`(?<!${streetPrefixPattern})\\b${escaped}\\b(?!${streetSuffixPattern})`, "i");
    if (regex.test(cleanAddr)) {
      return true;
    }
  }
  return false;
}

function evaluateCityQC(address, country) {
  if (!address || typeof address !== "string" || address.trim().length < 3) {
    return "Not Available";
  }
  const cleanAddr = address.trim().toLowerCase();

  // New Taipei City rule: Must remain Not Available unless a qualifying administrative area is separately identified
  if (/\bnew\s*taipei(\s*city)?\b/i.test(cleanAddr)) {
    const addrWithoutNTC = cleanAddr.replace(/\bnew\s*taipei(\s*city)?\b/gi, " ");
    if (/\b(district|town|township|municipality|metropolitan\s*municipality|borough)\b/i.test(addrWithoutNTC)) {
      return "Available";
    }
    return "Not Available";
  }

  // Explicit qualifying administrative designation (Global Rule)
  const addrWithoutTownNamedCities = cleanAddr.replace(/\b(cape\s*town|george\s*town)\b/gi, " ");
  if (/\b(town|township|district|municipality|metropolitan\s*municipality|borough)\b/i.test(addrWithoutTownNamedCities)) {
    return "Available";
  }

  // UK Exception: Official UK cities, towns, and London boroughs are Available
  if (isUkLocation(cleanAddr, country) && hasUkCityOrTown(cleanAddr)) {
    return "Available";
  }

  return "Not Available";
}

// Test suite
const tests = [
  { addr: "10 Downing Street, London, SW1A 2AA", country: "United Kingdom", expected: "Available" },
  { addr: "Piccadilly Gardens, Manchester, M1 1RN", country: "England", expected: "Available" },
  { addr: "Centenary Square, Birmingham, B1 2ND", country: "UK", expected: "Available" },
  { addr: "Princes Street, Edinburgh, EH2 2EQ", country: "Scotland", expected: "Available" },
  { addr: "George Square, Glasgow, G2 1DU", country: "Scotland", expected: "Available" },
  { addr: "High Street, Camden, London, NW1 7JE", country: "England", expected: "Available" },
  { addr: "123 London Road, Reading, RG1 5AQ", country: "United Kingdom", expected: "Available" },
  // Standalone non-UK city without administrative designation must remain Not Available
  { addr: "123 Main Street, Boston, Massachusetts", country: "United States of America", expected: "Not Available" },
  { addr: "456 Market Street, San Francisco, California", country: "United States of America", expected: "Not Available" },
  { addr: "789 Long Street, Cape Town, Western Cape", country: "South Africa", expected: "Not Available" },
  // Explicit administrative designation works globally
  { addr: "No. 655, Lu Luh Road, Xiushui Township, Changhua County", country: "Taiwan", expected: "Available" },
  { addr: "398 Cilong East Road, Longshan Town, Cixi City, Zhejiang Province", country: "China", expected: "Available" },
  { addr: "123 Main Street, Randburg Municipality, Gauteng", country: "South Africa", expected: "Available" },
  { addr: "456 High Street, New Taipei City", country: "Taiwan", expected: "Not Available" },
  { addr: "456 High Street, Banqiao District, New Taipei City", country: "Taiwan", expected: "Available" }
];

let passed = 0;
for (const t of tests) {
  const actual = evaluateCityQC(t.addr, t.country);
  const ok = actual === t.expected;
  if (ok) passed++;
  console.log(`${ok ? '✓ PASS' : '✗ FAIL'}: ${t.addr} (${t.country}) -> Actual: ${actual}, Expected: ${t.expected}`);
}
console.log(`\nResults: ${passed} / ${tests.length} passed.`);
if (passed !== tests.length) process.exit(1);

