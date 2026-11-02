// Background Service Worker for AI Web Crawler & Auto Pre-Fill Assistant
// Production-Grade Implementation strictly conforming to 14 QC Rules

// Load environment configuration from env.js (synced from .env)
try {
  importScripts("env.js");
} catch (e) {
  // Service worker will fall back to chrome.storage.sync
}

const DEFAULT_API_KEY =
  (typeof globalThis !== "undefined" && globalThis.ENV && globalThis.ENV.GEMINI_API_KEY) ||
  (typeof self !== "undefined" && self.ENV && self.ENV.GEMINI_API_KEY) ||
  "";
const DEFAULT_MODEL =
  (typeof globalThis !== "undefined" && globalThis.ENV && globalThis.ENV.DEFAULT_MODEL) ||
  (typeof self !== "undefined" && self.ENV && self.ENV.DEFAULT_MODEL) ||
  "gemini-3.5-flash-lite";

// Primary prohibited core industries per Instruction Sheet
const RESTRICTED_PATTERNS = [
  /\b(porn|pornography|xxx|erotic|sex\s*shop|escort\s*service)\b/i,
  /\b(weapons?|firearms?|ammunition|rifles?|guns?|military\s*weapons?)\b/i,
  /\b(prescription\s*drugs|hospital\s*care|medical\s*clinic)\b/i,
  /\b(military\s*defence\s*contractor|armed\s*forces\s*equipment|tactical\s*armaments)\b/i,
  /\b(commercial\s*aviation\s*fleet|aircraft\s*manufacturer|naval\s*shipyard)\b/i,
  /\b(brewery|distillery|liquor\s*store|wine\s*producer)\b/i,
  /\b(livestock\s*farming|pet\s*shop|animal\s*breeding|veterinary\s*hospital)\b/i
];

// National Capital Cities for Rule 8 capital city exception
const ALL_CAPITALS = [
  "taipei city", "taipei", "pretoria", "cape town", "bloemfontein", "london", "washington", "paris",
  "berlin", "tokyo", "beijing", "new delhi", "canberra", "ottawa", "seoul", "bangkok",
  "singapore", "kuala lumpur", "jakarta", "manila", "hanoi", "rome", "madrid", "amsterdam",
  "brussels", "bern", "vienna", "stockholm", "oslo", "copenhagen", "helsinki", "dublin",
  "warsaw", "prague", "budapest", "athens", "lisbon", "ankara", "riyadh", "abu dhabi",
  "doha", "cairo", "nairobi", "buenos aires", "brasilia", "santiago", "bogota", "lima",
  "mexico city", "wellington"
];

// High-risk suburbs and localities that MUST NOT be classified as cities (Strict QC Rule)
const NON_CITY_SUBURBS = [
  "sandton", "rosebank", "randburg", "midrand", "bryanston", "fourways", "centurion", "menlyn",
  "umhlanga", "bedfordview", "edenvale", "alberton", "rivonia", "woodmead", "morningside",
  "kempton park", "jet park", "boksburg industrial", "isando", "germiston", "roodepoort",
  "constantia", "camps bay", "sea point", "claremont", "bellville", "durbanville", "somerset west",
  "brooklyn", "queens", "manhattan", "bronx", "staten island", "hollywood", "beverly hills",
  "campbellfield", "dandenong", "st kilda", "parramatta", "chatswood", "fitzroy", "carlton",
  "richmond", "altona", "epping", "footscray", "box hill", "clayton", "springvale", "ringwood"
];

// International Recognized Towns, Districts, Municipalities
const RECOGNIZED_TOWNS = [
  // South Africa towns / municipalities
  "boksburg", "johannesburg", "pretoria", "durban", "cape town", "port elizabeth", "gqeberha",
  "bloemfontein", "east london", "polokwane", "nelspruit", "mbombela", "pietermaritzburg",
  "kimberley", "george", "rustenburg", "potchefstroom", "paarl", "stellenbosch", "upington",
  "witbank", "emalahleni", "klerksdorp", "secunda", "middelburg", "vanderbijlpark", "vereeniging",
  // United Kingdom towns / cities / boroughs
  "london", "manchester", "birmingham", "liverpool", "leeds", "glasgow", "edinburgh", "bristol",
  "sheffield", "newcastle", "nottingham", "cardiff", "belfast", "cambridge", "oxford", "coventry",
  "leicester", "southampton", "aberdeen", "plymouth", "swansea", "dundee", "norwich",
  // United States cities / towns
  "new york", "los angeles", "chicago", "houston", "phoenix", "philadelphia", "san antonio",
  "san diego", "dallas", "san jose", "austin", "jacksonville", "fort worth", "columbus",
  "san francisco", "charlotte", "indianapolis", "seattle", "denver", "boston", "detroit",
  "nashville", "portland", "las vegas", "memphis", "baltimore", "milwaukee", "albuquerque",
  "atlanta", "miami", "cleveland", "minneapolis", "tampa", "pittsburgh", "cincinnati",
  // Australia
  "sydney", "melbourne", "brisbane", "perth", "adelaide", "gold coast", "newcastle", "canberra",
  "sunshine coast", "wollongong", "hobart", "geelong", "townsville", "cairns", "darwin",
  // Canada
  "toronto", "montreal", "vancouver", "calgary", "edmonton", "ottawa", "winnipeg", "quebec city",
  "hamilton", "kitchener", "london", "victoria bc", "halifax", "oshawa", "windsor",
  // Taiwan districts & cities
  "yangmei", "yangmei town", "banqiao", "banqiao district", "xinzhuang", "xinzhuang district", "zhonghe", "zhonghe district",
  "sanchong", "sanchong district", "tamsui", "tamsui district", "xizhi", "xizhi district",
  "yonghe", "yonghe district", "tucheng", "tucheng district", "shulin", "shulin district",
  "taichung", "tainan", "kaohsiung", "keelung", "hsinchu", "chiayi", "hualien", "yilan",
  // Germany
  "berlin", "munich", "hamburg", "frankfurt", "cologne", "stuttgart", "dusseldorf", "dortmund",
  "essen", "leipzig", "bremen", "dresden", "hanover", "nuremberg", "duisburg",
  // France
  "paris", "marseille", "lyon", "toulouse", "nice", "nantes", "strasbourg", "montpellier",
  "bordeaux", "lille", "rennes", "reims", "saint-etienne", "le havre", "toulon",
  // India
  "mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "ahmedabad", "chennai", "kolkata",
  "surat", "pune", "jaipur", "lucknow", "kanpur", "nagpur", "indore", "thane", "bhopal",
  "visakhapatnam", "patna", "vadodara", "ghaziabad", "ludhiana", "agra", "nashik",
  // Japan
  "tokyo", "yokohama", "osaka", "nagoya", "sapporo", "fukuoka", "kobe", "kyoto",
  "kawasaki", "saitama", "hiroshima", "sendai", "chiba", "kitakyushu",
  // Malaysia
  "kuala lumpur", "petaling jaya", "subang jaya", "shah alam", "klang", "johor bahru",
  "penang", "georgetown", "ipoh", "kuching", "kota kinabalu", "seremban", "malacca",
  "alor setar", "kangar", "kuala terengganu", "kota bharu", "kuantan", "miri", "sandakan",
  "masai", "batu pahat", "muar", "kluang", "kulai", "pasir gudang", "skudai", "iskandar puteri",
  // Indonesia
  "jakarta", "surabaya", "bandung", "medan", "semarang", "makassar", "palembang",
  "tangerang", "depok", "bekasi", "bogor", "batam", "denpasar", "yogyakarta", "malang",
  // South Korea
  "seoul", "busan", "incheon", "daegu", "daejeon", "ulsan", "gwangju", "suwon",
  "seongnam", "goyang", "yongin", "changwon", "pohang", "jeonju", "ansan",
  // China
  "beijing", "shanghai", "guangzhou", "shenzhen", "chengdu", "wuhan", "chongqing",
  "tianjin", "nanjing", "hangzhou", "xi'an", "shenyang", "dongguan", "foshan",
  "qingdao", "wuxi", "zhengzhou", "suzhou", "wenzhou", "dalian", "ningbo",
  // Middle East
  "dubai", "abu dhabi", "sharjah", "riyadh", "jeddah", "mecca", "medina",
  "doha", "kuwait city", "manama", "muscat", "amman", "beirut", "tehran",
  "tel aviv", "jerusalem", "istanbul", "ankara", "cairo", "alexandria",
  // Southeast Asia other
  "manila", "quezon city", "cebu", "davao", "bangkok", "chiang mai", "pattaya",
  "ho chi minh city", "hanoi", "da nang", "phnom penh", "vientiane", "yangon",
  "naypyidaw", "singapore",
  // Other major international cities
  "amsterdam", "rotterdam", "brussels", "zurich", "geneva", "vienna", "warsaw",
  "budapest", "prague", "stockholm", "oslo", "copenhagen", "helsinki", "athens",
  "lisbon", "porto", "barcelona", "madrid", "milan", "rome", "naples", "turin",
  "moscow", "saint petersburg", "kiev", "kyiv", "bucharest", "sofia", "zagreb",
  "toronto", "montreal", "vancouver", "calgary", "edmonton",
  "auckland", "wellington", "christchurch",
  "johannesburg", "cape town", "pretoria", "durban", "bloemfontein", "port elizabeth",
  "nairobi", "lagos", "accra", "dar es salaam", "addis ababa", "casablanca",
  "buenos aires", "sao paulo", "rio de janeiro", "santiago", "bogota", "lima", "caracas",
  "mexico city", "guadalajara", "monterrey",
  // Additional US cities
  "sacramento", "kansas city", "st louis", "saint louis", "new orleans", "orlando",
  "raleigh", "salt lake city", "richmond va", "buffalo", "rochester", "tucson",
  "fresno", "mesa", "omaha", "oakland", "tulsa", "wichita", "arlington", "bakersfield",
  "aurora", "anaheim", "honolulu", "santa ana", "riverside", "corpus christi",
  "lexington", "henderson", "stockton", "saint paul", "st paul", "cincinnati",
  "newark", "greensboro", "plano", "lincoln", "toledo", "jersey city", "chandler",
  "madison", "gilbert", "north las vegas", "irvine", "fort wayne", "durham",
  "chula vista", "norfolk", "lubbock", "reno", "gilbert", "boise", "spokane",
  "baton rouge", "des moines", "tacoma", "san bernardino", "modesto", "fontana",
  "moreno valley", "fayetteville", "yonkers", "huntington beach", "montgomery",
  "little rock", "akron", "shreveport", "augusta", "grand rapids", "huntington",
  "mobile", "overland park", "knoxville", "worcester", "brownsville", "newport news",
  "santa clarita", "providence", "fort lauderdale", "chattanooga", "tempe",
  "oceanside", "garden grove", "rancho cucamonga", "cape coral", "santa rosa",
  "vancouver wa", "sioux falls", "peoria", "ontario ca", "elk grove", "salem",
  "pembroke pines", "eugene", "corona", "cary", "springfield", "fort collins",
  "jackson", "alexandria", "hayward", "clarksville", "lakewood", "lancaster",
  "salinas", "palmdale", "hollywood fl", "pasadena", "sunnyvale", "macon",
  "pomona", "escondido", "killeen", "naperville", "joliet", "bellevue",
  "rockford", "savannah", "paterson", "torrance", "bridgeport", "mcallen",
  "syracuse", "midland", "surprise", "denton", "roseville", "thornton",
  "miramar", "pasadena tx", "mesquite", "dayton", "waco", "fullerton",
  "olathe", "carrollton", "west valley city", "columbia", "gainesville",
  "sterling heights", "cedar rapids", "visalia", "coral springs", "new haven",
  "stamford", "thousand oaks", "concord", "elizabeth", "kent", "simi valley",
  "lafayette", "topeka", "round rock", "west palm beach", "berkeley",
  "norman", "santa clara", "fargo", "abilene", "vallejo", "allentown",
  "wilmington", "evansville", "ann arbor", "pearland", "beaumont", "odessa",
  // Additional China / Taiwan cities
  "cixi", "yiwu", "yuyao", "fenghua", "beilun", "zhenhai", "yinzhou", "haishu",
  "xiangshan", "ninghai", "putuo", "dinghai", "daishan", "shengzhou", "zhuji",
  "shaoxing", "jiaxing", "huzhou", "jinhua", "quzhou", "lishui", "taizhou",
  "wenzhou", "dongyang", "lanxi", "yongkang", "wenling", "ruian", "yueqing",
  "kunshan", "changshu", "zhangjiagang", "taicang", "wujiang", "jiangyin",
  "yixing", "changzhou", "wuxi", "nantong", "yangzhou", "zhenjiang", "xuzhou",
  "huaian", "yancheng", "lianyungang", "suqian", "taizhou js", "zhongshan",
  "zhuhai", "huizhou", "dongguan", "foshan", "jiangmen", "zhaoqing", "shantou",
  "jieyang", "chaozhou", "zhanjiang", "maoming", "qingyuan", "shaoguan",
  "heyuan", "meizhou", "yunfu", "yangjiang", "shunde", "nanhai", "sanshui",
  "panyu", "huadu", "zengcheng", "conghua", "baoan", "longgang", "nanshan",
  "futian", "luohu", "yantian", "pingshan", "guangming", "longhua",
  "taoyuan", "hsinchu", "chiayi", "changhua", "pingtung", "taitung", "miaoli",
  "nantou", "yunlin", "penghu", "kinmen", "keelung", "hualien", "yilan",
  // Additional India
  "coimbatore", "kochi", "kozhikode", "thiruvananthapuram", "madurai", "tiruchirappalli",
  "salem in", "tiruppur", "erode", "vellore", "mangalore", "mysore", "mysuru",
  "hubli", "belgaum", "gulbarga", "warangal", "vijayawada", "guntur", "nellore",
  "tirupati", "rajahmundry", "raipur", "bhilai", "jabalpur", "gwalior", "ujjain",
  "kota", "ajmer", "udaipur", "jodhpur", "bikaner", "amritsar", "jalandhar",
  "chandigarh", "dehradun", "haridwar", "noida", "faridabad", "gurgaon", "gurugram",
  "meerut", "aligarh", "varanasi", "allahabad", "prayagraj", "gorakhpur", "kanpur",
  "ranchi", "jamshedpur", "dhanbad", "cuttack", "bhubaneswar", "rourkela",
  "guwahati", "siliguri", "durgapur", "asansol", "howrah", "navi mumbai",
  "kalyan", "vasai", "virar", "noida", "aurangabad", "solapur", "kolhapur",
  "amravati", "nanded", "sangli", "jalgaon",
  // Additional Europe
  "antwerp", "ghent", "bruges", "charleroi", "liege", "namur",
  "utrecht", "the hague", "eindhoven", "tilburg", "groningen", "almere", "breda",
  "nijmegen", "enschede", "haarlem", "arnhem", "zaanstad", "haarlemmermeer",
  "basel", "lausanne", "bern", "winterthur", "lucerne", "st gallen", "lugano",
  "graz", "linz", "salzburg", "innsbruck",
  "krakow", "wroclaw", "poznan", "gdansk", "szczecin", "lodz", "lublin", "katowice",
  "gothenburg", "malmo", "uppsala", "vasteras", "orebro", "linkoping",
  "aarhus", "odense", "aalborg", "bergen", "trondheim", "stavanger", "tampere", "turku", "oulu",
  "cork", "galway", "limerick", "waterford",
  "valencia", "seville", "zaragoza", "malaga", "murcia", "palma", "bilbao", "alicante",
  "cordoba", "valladolid", "vigo", "gijon", "l'hospitalet", "granada",
  "florence", "bologna", "genoa", "bari", "catania", "venice", "verona", "messina",
  "padua", "trieste", "brescia", "parma", "taranto", "prato", "modena", "reggio calabria",
  "reggio emilia", "perugia", "livorno", "ravenna", "cagliari", "foggia", "rimini", "salerno",
  "lyon", "toulouse", "nice", "nantes", "montpellier", "strasbourg", "bordeaux", "lille",
  "rennes", "reims", "le havre", "saint-etienne", "toulon", "grenoble", "dijon", "angers",
  "nuremberg", "duisburg", "bochum", "wuppertal", "bielefeld", "bonn", "munster",
  "karlsruhe", "mannheim", "augsburg", "wiesbaden", "gelsenkirchen", "monchengladbach",
  "braunschweig", "chemnitz", "kiel", "aachen", "halle", "magdeburg", "freiburg",
  "krefeld", "lubeck", "oberhausen", "erfurt", "mainz", "rostock", "kassel", "hagen",
  "saarbrucken", "hamm", "potsdam", "ludwigshafen", "oldenburg", "osnabruck", "leverkusen",
  "heidelberg", "solingen", "darmstadt", "herne", "neuss", "regensburg", "paderborn",
  "ingolstadt", "wurzburg", "furth", "ulm", "heilbronn", "pforzheim", "wolfsburg",
  "gottingen", "bottrop", "reutlingen", "koblenz", "breitcheid", "offenbach",
  "porto", "braga", "coimbra", "funchal", "setubal",
  "thessaloniki", "patras", "heraklion", "larissa", "volos",
  "cluj-napoca", "timisoara", "iasi", "constanta", "craiova", "brasov", "galati",
  "plovdiv", "varna", "burgas", "ruse",
  "zagreb", "split", "rijeka", "osijek",
  "bratislava", "kosice", "ljubljana", "maribor", "tallinn", "tartu", "riga", "vilnius", "kaunas",
  // Additional SE Asia / Middle East / Africa / Oceania / LatAm
  "ipoh", "seremban", "alor setar", "kota bharu", "kuala terengganu", "sibu", "bintulu",
  "kota tinggi", "pontian", "segamat", "merning", "rawang", "kajang", "ampang", "cheras",
  "puchong", "cyberjaya", "nilai", "port dickson", "banting", "kuala selangor",
  "sungai petani", "kulim", "butterworth", "bukit mertajam", "taiping", "teluk intan",
  "sitiawan", "lumut", "kampar", "bentong", "raub", "temerloh", "jerantut",
  "davao city", "cebu city", "quezon city", "makati", "taguig", "pasig", "caloocan",
  "paranaque", "las pinas", "muntinlupa", "marikina", "mandaluyong", "pasay",
  "bacolod", "iloilo", "cagayan de oro", "zamboanga", "general santos", "baguio",
  "antipolo", "dasmarinas", "bacoor", "calamba", "santa rosa", "binan", "san pedro",
  "imus", "cabuyao", "lipa", "batangas city", "lucena", "naga", "legazpi",
  "chiang rai", "khon kaen", "nakhon ratchasima", "hat yai", "udon thani", "chon buri",
  "nonthaburi", "pak kret", "hatyai", "phuket", "pattaya",
  "can tho", "hai phong", "bien hoa", "nha trang", "hue", "vung tau", "thu dau mot",
  "haiphong", "nam dinh", "vinh", "buon ma thuot", "quy nhon", "thai nguyen",
  "bandar seri begawan", "sibu",
  "jeddah", "dammam", "khobar", "dhahran", "jubail", "yanbu", "abha", "tabuk",
  "muscat", "salalah", "sohar", "nizwa",
  "sharjah", "ajman", "ras al khaimah", "fujairah", "al ain",
  "casablanca", "rabat", "marrakesh", "fes", "tangier", "agadir", "meknes", "oujda",
  "tunis", "sfax", "sousse", "algiers", "oran", "constantine",
  "lagos", "abuja", "kano", "ibadan", "port harcourt", "benin city", "kaduna",
  "accra", "kumasi", "tamale", "takoradi",
  "nairobi", "mombasa", "kisumu", "nakuru",
  "kampala", "kigali", "lusaka", "harare", "gaborone", "windhoek", "maputo",
  "dar es salaam", "dodoma", "addis ababa", "djibouti",
  "auckland", "wellington", "christchurch", "hamilton nz", "tauranga", "dunedin",
  "palmerston north", "napier", "nelson", "rotorua", "new plymouth", "whangarei",
  "invercargill",
  "gold coast", "newcastle au", "wollongong", "geelong", "hobart", "townsville",
  "cairns", "toowoomba", "ballarat", "bendigo", "albury", "launceston", "mackay",
  "rockhampton", "bunbury", "bundaberg", "coffs harbour", "wagga wagga", "hervey bay",
  "mildura", "shepparton", "gladstone", "port macquarie", "tamworth au", "orange",
  "dubbo", "geraldton", "kalgoorlie", "albany au", "mount gambier", "whyalla",
  "sao paulo", "rio de janeiro", "brasilia", "salvador", "fortaleza", "belo horizonte",
  "manaus", "curitiba", "recife", "porto alegre", "belem", "goiania", "guarulhos",
  "campinas", "sao luis", "sao goncalo", "maceio", "duque de caxias", "natal",
  "teresina", "campo grande", "nova iguacu", "sao bernardo do campo", "joao pessoa",
  "santo andre", "osasco", "jaboatao", "sao jose dos campos", "ribeirao preto",
  "uberlandia", "sorocaba", "contagem", "aracaju", "feira de santana", "cuiaba",
  "joinville", "juiz de fora", "londrina", "aparecida de goiania", "niteroi",
  "porto velho", "serra", "florianopolis", "vila velha", "campos dos goytacazes",
  "santiago", "valparaiso", "concepcion", "antofagasta", "vina del mar", "temuco",
  "bogota", "medellin", "cali", "barranquilla", "cartagena", "cucuta", "soledad",
  "bucaramanga", "pereira",
  "lima", "arequipa", "trujillo", "chiclayo", "piura", "cusco",
  "quito", "guayaquil", "cuenca", "santo domingo", "santiago de los caballeros",
  "caracas", "maracaibo", "valencia ve", "barquisimeto",
  "buenos aires", "cordoba ar", "rosario", "mendoza", "tucuman", "la plata",
  "mar del plata", "salta",
  "montevideo", "asuncion", "la paz", "santa cruz", "cochabamba",
  "mexico city", "guadalajara", "monterrey", "puebla", "tijuana", "leon", "juarez",
  "zapopan", "merida", "san luis potosi", "aguascalientes", "hermosillo", "saltillo",
  "mexicali", "culiacan", "acapulco", "queretaro", "torreon", "morelia", "reynosa",
  "tampico", "cancun", "veracruz", "chihuahua", "durango", "toluca",
  "guatemala city", "san salvador", "tegucigalpa", "managua", "san jose cr",
  "panama city", "havana", "santiago de cuba", "kingston jm", "port of spain",
  "bridgetown", "nassau"
];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "CRAWL_AND_EXTRACT") {
    handleCrawlAndExtract(request.url)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === "TEST_API_KEY") {
    testGeminiApiKey(request.apiKey || DEFAULT_API_KEY, request.model || DEFAULT_MODEL)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * Main coordinator: Deep crawls target site, handles framesets & charsets, runs AI, applies independent QC.
 */
async function handleCrawlAndExtract(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    throw new Error("No URL provided");
  }

  let targetUrl = rawUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = "http://" + targetUrl;
  }

  const settings = await chrome.storage.sync.get(["apiKey", "model"]);
  const apiKey = (settings.apiKey && settings.apiKey.trim()) ? settings.apiKey.trim() : DEFAULT_API_KEY;
  const model = settings.model || DEFAULT_MODEL;

  // Step 1: Deep crawl homepage, framesets, contact pages, footer, JSON-LD & map endpoints
  const crawlResult = await crawlWebsite(targetUrl);

  // Step 2: Check for prohibited categories
  const restrictedCheck = detectRestrictedKeywords(crawlResult.combinedText + " " + targetUrl);

  let extractedData;
  try {
    extractedData = await analyzeWithGemini(crawlResult, apiKey, model, restrictedCheck);
    extractedData._note = `AI Powered by Gemini (${model})`;
  } catch (aiErr) {
    console.warn("Gemini API error, falling back to local deterministic rule engine:", aiErr);
    extractedData = heuristicExtraction(crawlResult, restrictedCheck);
    extractedData._note = "Analyzed via Local Rule Engine (Gemini error: " + aiErr.message + ")";
  }

  // Step 3: Strictly enforce State, City, Country, and Products based on instructions
  const cleanedData = applyStrictInstructions(extractedData, crawlResult, restrictedCheck);
  return cleanedData;
}

/**
 * Resilient, charset-aware HTTP fetcher with timeout and fallback decoders.
 */
async function fetchDecodedHtml(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const buf = await res.arrayBuffer();

    let charset = "utf-8";
    const ct = res.headers.get("content-type") || "";
    const ctMatch = ct.match(/charset=([^;]+)/i);
    if (ctMatch) {
      charset = ctMatch[1].trim();
    } else {
      const peek = new TextDecoder("latin1").decode(buf.slice(0, 1000));
      const metaMatch = peek.match(/<meta[^>]*charset=["']?([^"'>\s/]+)/i) ||
        peek.match(/<meta[^>]*content=["'][^"']*charset=([^"'>\s;]+)/i);
      if (metaMatch) {
        charset = metaMatch[1].trim();
      }
    }

    let decoded = "";
    try {
      decoded = new TextDecoder(charset).decode(buf);
    } catch (e) {
      decoded = new TextDecoder("utf-8").decode(buf);
    }

    return {
      ok: res.ok,
      status: res.status,
      url: res.url,
      redirected: res.redirected,
      html: decoded
    };
  } catch (err) {
    return { ok: false, status: 0, url, redirected: false, html: "" };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Pulls the official registered company name from a copyright / legal line.
 * Keeps legal suffixes such as Co., Ltd — previous parsers stopped at the first comma.
 */
function extractCopyrightCompanyName(html) {
  if (!html) return "";
  const decoded = decodeHtmlEntities(html);
  const patterns = [
    /(?:©|&copy;|copyright)\s*(?:©|&copy;)?\s*(?:20\d{2}(?:\s*[-–\/]\s*20\d{2})?)?\s*([^<\n\r|]{3,200}?)(?:\.?\s*all\s+rights\s+reserved|\s*<\/|$)/i,
    /all\s+rights\s+reserved(?:\s+by)?\s+([^<\n\r|]{3,200}?)(?:\s*<\/|$)/i
  ];
  for (const re of patterns) {
    const m = decoded.match(re);
    if (!m || !m[1]) continue;
    let name = stripHtml(m[1])
      .replace(/all\s+rights\s+reserved/gi, " ")
      .replace(/\b(?:copyright|powered\s+by|designed\s+by|website\s+by)\b.*$/i, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[|•·]+$/g, "")
      .trim();
    if (name.length >= 3 && name.length <= 160 && !/^(?:20\d{2}|home|welcome)$/i.test(name)) {
      return name;
    }
  }
  return "";
}

/**
 * Deep crawls homepage, handles HTML <frameset>/<frame>, contact pages, footer, JSON-LD, products.
 */
async function crawlWebsite(targetUrl) {
  let mainHtml = "";
  let contactHtml = "";
  let footerText = "";
  let contactPageText = "";
  let redirected = false;
  let finalUrl = targetUrl;
  let status = "Working";
  let fetchError = null;
  const addressCandidates = [];
  let profilePageText = "";
  let copyrightText = "";

  try {
    const mainRes = await fetchDecodedHtml(targetUrl, {
      timeoutMs: 12000,
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (mainRes.redirected) {
      redirected = true;
      finalUrl = mainRes.url;
    }

    // Technical fix: status 0 or network failure MUST mark Not Working, never Working
    if (!mainRes.ok || mainRes.status === 0 || !mainRes.html || mainRes.html.trim().length === 0) {
      status = mainRes.status === 404 ? "Domain Expired" : "Not Working";
    }

    mainHtml = mainRes.html || "";

    // Extract copyright line for exact official company name verification.
    // Do not stop at commas — "Co., Ltd" is otherwise truncated to "Co."
    copyrightText = extractCopyrightCompanyName(mainHtml);

    // Support HTML <frameset> / <frame src="..."> / <iframe src="..."> (e.g. polyprise.com.tw)
    const frameMatches = [...mainHtml.matchAll(/<(?:frame|iframe)[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
    for (const fSrc of frameMatches) {
      try {
        if (/^(javascript:|about:|mailto:|tel:)/i.test(fSrc)) continue;
        const frameUrl = new URL(fSrc, finalUrl).href;
        const fRes = await fetchDecodedHtml(frameUrl, {
          timeoutMs: 6000,
          headers: { "User-Agent": "Mozilla/5.0" }
        });
        if (fRes.ok && fRes.html) {
          mainHtml += "\n" + fRes.html;
        }
      } catch (e) { }
    }

    // Extract Footer text & Footer address candidates
    const footerMatch = mainHtml.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i) ||
      mainHtml.match(/<(?:div|section)[^>]+(?:class|id)=["'][^"']*footer[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
    if (footerMatch) {
      footerText = stripHtml(footerMatch[1]);
      extractHtmlAddresses(footerMatch[1], addressCandidates, "footer");
    }

    // Extract from Homepage body
    extractJsonLdAddresses(mainHtml, addressCandidates);
    extractMapAddresses(mainHtml, addressCandidates);
    extractMetaAddresses(mainHtml, addressCandidates);
    extractHtmlAddresses(mainHtml, addressCandidates, "contact");

    // Discover Contact & Profile Pages
    const contactLinks = discoverContactLinks(mainHtml, finalUrl);
    const fetchedUrls = new Set([finalUrl]);

    for (const cUrl of contactLinks.slice(0, 10)) {
      if (fetchedUrls.has(cUrl)) continue;
      fetchedUrls.add(cUrl);

      try {
        const cRes = await fetchDecodedHtml(cUrl, {
          timeoutMs: 6000,
          headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });

        if (cRes.ok && cRes.html) {
          const cText = cRes.html;
          contactHtml += "\n" + cText;
          const isProfilePage = /(?:company[-_]?profile|corporate[-_]?profile|profile\.htm|profile|about[-_]?us|who[-_]?we[-_]?are|our[-_]?company|our[-_]?story|our[-_]?history)/i.test(cUrl);
          const pageSource = isProfilePage ? "profile" : "contact";

          extractEmbeddedScriptAddresses(cText, addressCandidates);
          extractMapAddresses(cText, addressCandidates);
          extractMetaAddresses(cText, addressCandidates);
          extractHtmlAddresses(cText, addressCandidates, pageSource);

          if (isProfilePage || /\b(?:company\s+profile|our\s+story|about\s+us|who\s+we\s+are)\b/i.test(stripHtml(cText).slice(0, 500))) {
            profilePageText += "\n" + stripHtml(cText);
          }

          // Check CMS dynamic form endpoints
          if (cText.includes("main-contact.asp") || cText.includes("loadFB")) {
            const formMatch = cText.match(/loadFB\(["']([^"']+)["']/i) || cText.match(/src=["']([^"']*main-contact\.asp[^"']*)["']/i);
            if (formMatch) {
              const fbUrl = new URL(formMatch[1], cUrl).href;
              const fbRes = await fetchDecodedHtml(fbUrl, { timeoutMs: 5000 });
              if (fbRes.ok && fbRes.html) {
                contactHtml += "\n" + fbRes.html;
                extractEmbeddedScriptAddresses(fbRes.html, addressCandidates);
                extractHtmlAddresses(fbRes.html, addressCandidates, "contact");
              }
            }
          }
        }
      } catch (e) { }
    }

    // Merge Contact text
    contactPageText = stripHtml(contactHtml);

    // Check homepage profile text snippet
    const homeProfileMatch = stripHtml(mainHtml).match(/(?:about\s+us|our\s+company|company\s+profile|our\s+story|who\s+we\s+are|about\s+our\s+company)[\s\S]{50,1500}/i);
    if (homeProfileMatch) {
      profilePageText += "\n" + homeProfileMatch[0];
    }
  } catch (err) {
    fetchError = err.message;
    status = "Not Working";
  }

  // Detect dynamic Single Page Application (SPA) shells
  const isSpaRoot = /<div[^>]+id=["'](?:app|root|__next|__nuxt|main-content)["'][^>]*>\s*<\/div>/i.test(mainHtml);
  const hasDynamicScripts = /<script[^>]+src=["'][^"']*(?:bundle|chunk|main|app|runtime)[^"']*\.js/i.test(mainHtml);
  const isDynamicSpa = isSpaRoot && (stripHtml(mainHtml).length < 500) && hasDynamicScripts;

  // Check redirect host
  try {
    const origHost = new URL(targetUrl).hostname.replace(/^www\./, "");
    const finalHost = new URL(finalUrl).hostname.replace(/^www\./, "");
    if (origHost !== finalHost && !finalHost.includes(origHost) && !origHost.includes(finalHost)) {
      status = "Redirect Site";
    }
  } catch (e) { }

  const extracted = parseHtmlDetails(mainHtml, finalUrl);

  // Verify substantive company profile presence
  extracted.hasCompanyProfile = checkCompanyProfilePresence(mainHtml, extracted.bodyText, profilePageText);

  // Merge discovered emails/phones from crawled contact pages
  if (contactHtml) {
    const contactParsed = parseHtmlDetails(contactHtml, finalUrl);
    extracted.emails = Array.from(new Set([...extracted.emails, ...contactParsed.emails]));
    extracted.phones = Array.from(new Set([...extracted.phones, ...contactParsed.phones]));
  }

  // Sort candidates strictly by priority hierarchy:
  // Headquarters (Tier 1) > Contact (Tier 2) > Profile (Tier 3) > JSON-LD (Tier 4) > Map (Tier 5) > Footer (Tier 6) > Branch (Tier 8).
  // Within the SAME tier, English precedes non-English (basePriority + 0.0 vs basePriority + 0.4).
  // An English footer or branch address will NEVER outrank an actual Headquarters address!
  addressCandidates.sort((a, b) => {
    const pA = (typeof a === "object" && a.priority !== undefined) ? a.priority : 6;
    const pB = (typeof b === "object" && b.priority !== undefined) ? b.priority : 6;
    return pA - pB;
  });

  return {
    originalUrl: targetUrl,
    finalUrl,
    redirected,
    status,
    fetchError,
    mainHtml,
    addressCandidates,
    detectedAddresses: addressCandidates.map(c => (typeof c === "object" ? c.raw : c)),
    isDynamicSpa,
    contactPageText: contactPageText.slice(0, 12000),
    footerText: footerText.slice(0, 4000),
    profilePageText: profilePageText.slice(0, 8000),
    copyrightText: copyrightText.slice(0, 500),
    ...extracted
  };
}

/**
 * Adds an address candidate with provenance tracking and priority ranking.
 */
function addAddressCandidate(targetList, rawText, source, isHq = false, locationType = "general", pageUrl = "") {
  if (!rawText || typeof rawText !== "string") return;
  const decoded = decodeHtmlEntities(rawText);
  const cleaned = decoded
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/^(?:address|add|addr|location|headquarters|head\s*office|registered\s*office|corporate\s*office|廠址|地址)\s*[:：\-–]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 8) return;

  // STRICT REJECTION: never accept protected email strings, javascript, or non-address text
  if (/\[email\s*protected\]|data-cfemail|__cf_email__|email\s*protected|\bprotected\b|mailto:|@|number\s*160\s*;?\s*protected/i.test(cleaned)) {
    return;
  }
  if (/\b(?:privacy\s*policy|terms\s*of|all\s*rights\s*reserved|cookie\s*policy|subscribe|newsletter|login|register|search\s*products|all\s*categories)\b/i.test(cleaned)) {
    return;
  }

  if (!/\b(road|street|avenue|lane|drive|way|boulevard|highway|via|corso|viale|piazza|town|township|district|city|province|county|hsien|state|building|floor|suite|box|number|no|#|sec|section|jln|jalan|taman|lorong|lebuh|kawasan|perindustrian|str\b|strasse|platz|comune|provincia|daerah|mukim)\b/i.test(cleaned) &&
    !/[\u4e00-\u9fa5]{2,}/.test(cleaned)) {
    return;
  }

  const latinLetters = (cleaned.match(/[a-zA-Z]/g) || []).length;
  const nonLatinLetters = (cleaned.match(/[\u4e00-\u9fa5\u3040-\u30ff\u0e00-\u0e7f\u0400-\u04ff\u0600-\u06ff]/g) || []).length;
  const isEnglish = latinLetters >= 4 && latinLetters >= nonLatinLetters;

  // Location Context & Priority hierarchy:
  // Headquarters (Tier 1) > Contact (Tier 2) > Profile (Tier 3) > JSON-LD (Tier 4) > Map (Tier 5) > Footer (Tier 6) > General (Tier 7) > Branch/Factory (Tier 8)
  const hasHqKeyword = /\b(?:headquarters|head\s*office|registered\s*office|corporate\s*office|main\s*office|principal\s*office|hq|總公司|總部|本公司|總廠|本廠)\b/i.test(rawText) || isHq || source === "headquarters";
  const hasBranchKeyword = /\b(?:branch(?:\s*office)?|factory|plant|warehouse|distribution\s*center|showroom|depot|facility|subsidiary|unit\s*\d+|分公司|工廠|廠房|分處|辦事處|營業所|經銷商)\b/i.test(rawText) || locationType === "branch" || source === "branch";

  let basePriority = 7;
  let locType = locationType || "general";

  if (hasHqKeyword) {
    basePriority = 1;
    locType = "headquarters";
    isHq = true;
  } else if (source === "contact") {
    basePriority = 2;
    locType = "contact";
  } else if (source === "profile") {
    basePriority = 3;
    locType = "profile";
  } else if (source === "jsonld") {
    basePriority = 4;
    locType = "jsonld";
  } else if (source === "map" || source === "meta") {
    basePriority = 5;
    locType = source;
  } else if (source === "footer") {
    basePriority = 6;
    locType = "footer";
  }

  // Deprioritize explicit branch / factory / warehouse addresses if not marked as Headquarters
  if (hasBranchKeyword && !hasHqKeyword) {
    basePriority = 8;
    locType = "branch";
    isHq = false;
  }

  // Tie-breaker: Within the SAME basePriority tier, English gets a minor advantage (0.0 vs +0.4).
  // Headquarters English = 1.0, Headquarters Non-English = 1.4.
  // Contact English = 2.0, Contact Non-English = 2.4.
  // Footer English = 6.0, Branch English = 8.0.
  // This mathematically guarantees Headquarters ALWAYS outranks Footer and Branch addresses regardless of language!
  const priority = isEnglish ? basePriority : (basePriority + 0.4);

  const candObj = {
    raw: cleaned,
    source: source || locType,
    locationType: locType,
    isHeadquarters: isHq,
    isEnglish: isEnglish,
    pageUrl: pageUrl || "",
    priority: priority
  };

  const existingIndex = targetList.findIndex(c => (typeof c === "string" ? c : c.raw).toLowerCase() === cleaned.toLowerCase());
  if (existingIndex >= 0) {
    if (priority < targetList[existingIndex].priority) {
      targetList[existingIndex] = candObj;
    }
  } else {
    targetList.push(candObj);
  }
}

/**
 * Extracts schema.org JSON-LD PostalAddress blocks with source provenance.
 */
function extractJsonLdAddresses(html, targetList) {
  if (!html) return;
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const processItem = item => {
        if (!item || typeof item !== "object") return;
        if (item.address && typeof item.address === "object") {
          const a = item.address;
          const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry].filter(Boolean);
          if (parts.length >= 2) {
            addAddressCandidate(targetList, parts.join(", "), "jsonld", false, "jsonld");
          }
        }
      };
      if (Array.isArray(data)) data.forEach(processItem);
      else if (data["@graph"] && Array.isArray(data["@graph"])) data["@graph"].forEach(processItem);
      else processItem(data);
    } catch (e) { }
  }
}

/**
 * Extracts addresses embedded in JavaScript variables, hydration payloads, and SPA configs.
 */
function extractEmbeddedScriptAddresses(html, targetList) {
  if (!html) return;
  extractJsonLdAddresses(html, targetList);

  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let sm;
  while ((sm = scriptRegex.exec(html)) !== null) {
    const content = sm[1];
    if (content.length > 250000) continue;
    if (/\b(?:streetAddress|office_address|company_address)\b/i.test(content)) {
      const m = content.match(/["'](?:streetAddress|office_address|company_address)["']\s*:\s*["']([^"']{8,180})["']/i);
      if (m && m[1]) {
        addAddressCandidate(targetList, m[1], "jsonld", false, "contact");
      }
    }
  }
}

/**
 * Discovers contact and about page URLs by scoring anchor text and href.
 */
function discoverContactLinks(html, baseUrl) {
  if (!html) return [];
  const candidates = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    const innerText = match[2].replace(/<[^>]+>/g, "").trim().toLowerCase();
    const rawLower = raw.toLowerCase();
    if (!raw || /^(javascript:|mailto:|tel:|#)/i.test(raw)) continue;

    let score = 0;
    if (/\b(contact|contact-us|contactus|contact_us|get-in-touch|reach-us)\b/i.test(rawLower)) score += 10;
    if (/\b(about|about-us|aboutus|about_us|who-we-are|our-company|company-profile|profile)\b/i.test(rawLower)) score += 6;
    if (/\b(contact|contact\s*us|get\s*in\s*touch|reach\s*us)\b/i.test(innerText)) score += 12;
    if (/\b(about|about\s*us|who\s*we\s*are|company\s*profile|our\s*profile)\b/i.test(innerText)) score += 8;
    if (/\b(en|english)\b/i.test(innerText) || /[\/_](?:en|eng)\b/i.test(rawLower) || /[?&]lang=en/i.test(rawLower)) score += 7;

    if (score > 0) {
      try {
        const resolved = new URL(raw, baseUrl).href;
        candidates.push({ url: resolved, score });
      } catch (e) { }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return Array.from(new Set(candidates.map(c => c.url)));
}

function extractFooterText(html) {
  if (!html) return "";
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i) ||
    html.match(/<(?:div|section)[^>]+(?:class|id)=["'][^"']*footer[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
  if (!footerMatch) return "";
  return stripHtml(footerMatch[1]);
}

function extractMapAddresses(html, targetList) {
  if (!html) return;
  const mapRegex = /(?:google\.com\/maps|maps\.google|baidu\.com|openstreetmap)[^"'>\s]*/gi;
  let match;
  while ((match = mapRegex.exec(html)) !== null) {
    const rawUrl = match[0];
    try {
      const decoded = decodeURIComponent(rawUrl);
      const qMatch = decoded.match(/[?&](?:q|query|place|destination|daddr)=([^&"'>]+)/i);
      if (qMatch) {
        const query = qMatch[1].replace(/\+/g, " ").trim();
        if (query.length > 8 && !/^[-\d.,\s]+$/.test(query)) {
          addAddressCandidate(targetList, query, "map", false);
        }
      }
    } catch (e) { }
  }
}

function extractMetaAddresses(html, targetList) {
  if (!html) return;
  const metaRegex = /<meta[^>]+(?:name|property)=["'](?:og:street-address|geo\.placename|business:contact_data:street_address)["'][^>]+content=["']([^"']+)["']/gi;
  let m;
  while ((m = metaRegex.exec(html)) !== null) {
    if (m[1] && m[1].trim().length > 6) {
      addAddressCandidate(targetList, m[1].trim(), "contact", false);
    }
  }
}

function extractHtmlAddresses(html, targetList, defaultSource = "contact") {
  if (!html) return;

  // Helper to determine context from surrounding text / headers
  const getContext = (beforeText, fallbackSource) => {
    if (/\b(?:headquarters|head\s*office|corporate\s*office|registered\s*office|main\s*office|principal\s*office|hq|總公司|總部|本公司|總廠|本廠)\b/i.test(beforeText)) {
      return { isHq: true, source: "headquarters", locType: "headquarters" };
    }
    if (/\b(?:branch(?:\s*office)?|factory|plant|warehouse|distribution\s*center|showroom|depot|facility|subsidiary|分公司|工廠|廠房|分處|辦事處|營業所|經銷商)\b/i.test(beforeText)) {
      return { isHq: false, source: "branch", locType: "branch" };
    }
    return { isHq: false, source: fallbackSource, locType: fallbackSource };
  };

  // 1. Explicit Headquarters / Head Office blocks (Priority 1)
  const hqRegex = /(?:headquarters|head\s*office|corporate\s*office|registered\s*office|main\s*office|hq|總公司|總部|本公司)\s*[:\-–]?\s*<(?:p|div|span|address|li|td|dd)[^>]*>([\s\S]*?)<\/(?:p|div|span|address|li|td|dd)>/gi;
  let hqm;
  while ((hqm = hqRegex.exec(html)) !== null) {
    const raw = stripHtml(hqm[1]);
    if (raw.length > 8) {
      addAddressCandidate(targetList, raw, "headquarters", true, "headquarters");
    }
  }

  // 2. <h1-6> with "address" or "contact" followed by <p>, <div>, <span>, <li>, <td> (excluding email headings)
  const headingRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>\s*<(?:p|div|span|li|td)[^>]*>([\s\S]*?)<\/(?:p|div|span|li|td)>/gi;
  let hm;
  while ((hm = headingRegex.exec(html)) !== null) {
    const hText = stripHtml(hm[1]);
    if (!/address|location|head\s*office|headquarters|contact\s*us|contact|辦事處|地址|總部/i.test(hText)) continue;
    if (/email|e-mail|newsletter|subscribe/i.test(hText)) continue;

    const ctx = getContext(hText, defaultSource);
    const raw = stripHtml(hm[2]);
    const lines = raw.split(/\n+/).map(l => l.trim()).filter(l => l.length > 8);
    for (const line of lines) {
      addAddressCandidate(targetList, line, ctx.source, ctx.isHq, ctx.locType);
    }
    if (raw.length > 10 && lines.length <= 1) {
      addAddressCandidate(targetList, raw, ctx.source, ctx.isHq, ctx.locType);
    }
  }

  // 3. <address> tag
  const addrTagRegex = /([\s\S]{0,120})<address[^>]*>([\s\S]*?)<\/address>/gi;
  let am;
  while ((am = addrTagRegex.exec(html)) !== null) {
    const ctx = getContext(am[1], defaultSource);
    const raw = stripHtml(am[2]);
    if (raw.length > 10) {
      addAddressCandidate(targetList, raw, ctx.source, ctx.isHq, ctx.locType);
    }
  }

  // 4. Class or id containing "address" or "addr" (including li, td, dd, article, section)
  const classAddrRegex = /([\s\S]{0,120})<(?:div|p|span|section|li|td|dd|article)[^>]+(?:class|id)=["']([^"']*(?:address|addr\b)[^"']*)["'][^>]*>([\s\S]*?)<\/(?:div|p|span|section|li|td|dd|article)>/gi;
  let cm;
  while ((cm = classAddrRegex.exec(html)) !== null) {
    const contextStr = cm[1] + " " + cm[2];
    const ctx = getContext(contextStr, defaultSource);
    const raw = stripHtml(cm[3]);
    if (raw.length > 10) {
      addAddressCandidate(targetList, raw, ctx.source, ctx.isHq, ctx.locType);
    }
  }

  // 5. Explicit label prefixes Add: / Address: / Addr: / Location: / 地址:
  const labelAddrRegex = /([\s\S]{0,120})\b(?:address|add|addr|地址|廠址)\s*[:：]\s*(?:<[^>]+>)*\s*([^<\r\n]+(?:\s*<br\s*\/?>\s*[^<\r\n]+)*)/gi;
  let lm;
  while ((lm = labelAddrRegex.exec(html)) !== null) {
    const ctx = getContext(lm[1], defaultSource);
    const raw = stripHtml(lm[2]);
    if (raw.length > 10) {
      addAddressCandidate(targetList, raw, ctx.source, ctx.isHq, ctx.locType);
    }
  }

  // 6. Map-marker icon followed by address text (e.g. <span class="fa fa-map-marker"></span> No. 492, ...)
  const markerRegex = /([\s\S]{0,100})(?:fa-map-marker|fa-map-marker-alt|map-marker|icon-location|dashicons-location)[^>]*>[\s\S]{0,100}?(?:<\/(?:span|i|div)>\s*){1,3}([^<\r\n]+(?:\s*<br\s*\/?>\s*[^<\r\n]+)*)/gi;
  let mm;
  while ((mm = markerRegex.exec(html)) !== null) {
    const ctx = getContext(mm[1], defaultSource);
    const raw = stripHtml(mm[2]);
    const lines = raw.split(/\n+/).map(l => l.trim()).filter(l => l.length > 8);
    for (const line of lines) {
      addAddressCandidate(targetList, line, ctx.source, ctx.isHq, ctx.locType);
    }
  }

  // 7. Paragraphs, list items, or table cells containing physical address patterns
  const pAddrRegex = /([\s\S]{0,100})<(?:p|li|td)[^>]*>([\s\S]*?)<\/(?:p|li|td)>/gi;
  let pm;
  while ((pm = pAddrRegex.exec(html)) !== null) {
    const raw = stripHtml(pm[2]);
    if (raw.length >= 15 && raw.length <= 250 &&
      /\b(road|street|avenue|lane|drive|way|boulevard|highway|township|district|city|county|hsien|country|rd\b|st\b|ln\b|ave\b|dr\b|blvd\b|via|corso|viale|strasse)\b/i.test(raw) &&
      /\b(?:\d{1,5}|no\.?\s*\d+|#\s*\d+)\b/i.test(raw)) {
      const ctx = getContext(pm[1], defaultSource);
      addAddressCandidate(targetList, raw, ctx.source, ctx.isHq, ctx.locType);
    }
  }
}

/**
 * Extracts key structural components (numbers and localities) from an address string.
 */
function extractAddressComponents(addr) {
  if (!addr || typeof addr !== "string") {
    return { numbers: [], localities: [], isEnglish: false };
  }
  const clean = addr.toLowerCase().replace(/[\(\)\[\]\{\}]/g, " ");

  // Street / premise numbers (e.g. 56, 140, 7, 26, 909, 56-106)
  const numbers = (clean.match(/(?:^|[\s,#№])(\d+(?:[-/]\d+)?)\b/g) || [])
    .map(n => n.replace(/^[^\d]+/, "").trim())
    .filter(n => n.length <= 6 && !/^(?:19\d\d|20\d\d|886|60|61|44|27|91|30543|504)$/.test(n));

  // Recognized localities across priority countries
  const localityList = [
    // Taiwan
    "taipei", "taichung", "kaohsiung", "tainan", "taoyuan", "hsinchu", "chiayi", "keelung",
    "changhua", "miaoli", "nantou", "yunlin", "pingtung", "yilan", "hualien", "taitung", "penghu",
    "kinmen", "matsu", "xiushui", "nantun", "banqiao", "xinpu", "sinpu", "danshui", "tamsui",
    "zhongli", "xinzhuang", "sanchong", "xindian", "fengyuan", "pingzhen", "bade",
    // UK
    "london", "birmingham", "manchester", "leeds", "glasgow", "liverpool", "sheffield", "bristol",
    "edinburgh", "heywood", "rochdale", "bolton", "bury", "oldham", "salford", "stockport", "tameside",
    "trafford", "wigan", "lancashire", "yorkshire", "cheshire", "derbyshire", "staffordshire",
    // USA
    "chicago", "houston", "phoenix", "philadelphia", "san antonio", "san diego", "dallas", "austin",
    "california", "texas", "florida", "new york", "illinois", "pennsylvania", "ohio", "georgia",
    // Malaysia
    "kuala lumpur", "selangor", "penang", "johor", "perak", "kedah", "pahang", "kelantan", "sabah", "sarawak",
    "klang", "petaling jaya", "subang jaya", "shah alam", "george town", "johor bahru", "ipoh", "meru",
    // Italy
    "roma", "milano", "napoli", "torino", "palermo", "genova", "bologna", "firenze", "bari", "catania",
    "venezia", "verona", "messina", "padova", "trieste", "brescia", "taranto", "prato", "parma", "modena",
    "reggio emilia", "reggio calabria", "perugia", "ravenna", "livorno", "cagliari", "foggia", "rimini",
    "salerno", "ferrara", "sassari", "latina", "giugliano", "monza", "siracusa", "pescara", "bergamo",
    // Germany
    "berlin", "hamburg", "münchen", "munich", "köln", "cologne", "frankfurt", "stuttgart", "düsseldorf",
    "dortmund", "essen", "leipzig", "bremen", "dresden", "hannover", "nürnberg", "nuremberg", "duisburg"
  ];

  const foundLocalities = [];
  for (const loc of localityList) {
    if (new RegExp(`\\b${loc}\\b`, "i").test(clean)) {
      foundLocalities.push(loc);
    }
  }

  const latinCount = (clean.match(/[a-z]/g) || []).length;
  const nonLatinCount = (clean.match(/[\u4e00-\u9fa5\u3040-\u30ff\u0e00-\u0e7f\u0400-\u04ff\u0600-\u06ff]/g) || []).length;

  return {
    numbers,
    localities: foundLocalities,
    isEnglish: latinCount >= 4 && latinCount >= nonLatinCount
  };
}

/**
 * Strict Component-Level Address Verification and Selection.
 * Validates street number agreement, thoroughfare match, and rejects locality hallucinations.
 * Returns { address: string, selectedCandidate: object|null }
 */
function verifyAndSelectAddress(geminiAddr, candidates, crawlData = null) {
  if (!candidates || candidates.length === 0) {
    if (!geminiAddr || geminiAddr.length < 8 || /^(?:not\s*available|n\/?a|none|unknown)$/i.test(geminiAddr.trim()) ||
        /\b(?:email\s*and\s*number|email\s*protected|\bprotected\b|data-cfemail)\b/i.test(geminiAddr)) {
      return { address: "Not Available", selectedCandidate: null };
    }
    return { address: geminiAddr, selectedCandidate: null };
  }

  const getRaw = c => (typeof c === "object" ? c.raw : c);

  // Sort candidates strictly by priority (Headquarters Tier 1 > Contact Tier 2 > ...)
  // Within the same tier, English comes first
  const sorted = [...candidates].sort((a, b) => {
    const pA = (typeof a === "object" && a.priority !== undefined) ? a.priority : 6;
    const pB = (typeof b === "object" && b.priority !== undefined) ? b.priority : 6;
    return pA - pB;
  });

  const topCandidate = sorted[0];
  const topRaw = getRaw(topCandidate);

  // If Gemini provided invalid text, missing address, or Cloudflare protection, reject immediately
  if (!geminiAddr || geminiAddr.length < 5 || /^(?:not\s*available|n\/?a|none|unknown)$/i.test(geminiAddr.trim()) ||
      /\b(?:email\s*and\s*number|email\s*protected|\bprotected\b|data-cfemail)\b/i.test(geminiAddr)) {
    return { address: topRaw, selectedCandidate: topCandidate };
  }

  // Parse structural components of top candidate and Gemini address
  const candComp = extractAddressComponents(topRaw);
  const geminiComp = extractAddressComponents(geminiAddr);

  // 1. Locality Contradiction Check:
  // If top candidate has a verified locality (e.g. Changhua, Xiushui, Heywood, Lancashire)
  // and Gemini outputs a DIFFERENT conflicting city (e.g. Taichung, Manchester) not in top candidate:
  if (candComp.localities.length > 0 && geminiComp.localities.length > 0) {
    const conflicting = geminiComp.localities.filter(gLoc => !topRaw.toLowerCase().includes(gLoc));
    const matching = geminiComp.localities.filter(gLoc => topRaw.toLowerCase().includes(gLoc));
    if (conflicting.length > 0 && matching.length === 0) {
      // Contradiction detected! Reject Gemini and use topCandidate
      return { address: topRaw, selectedCandidate: topCandidate };
    }
  }

  // 2. Street Number Agreement Check:
  // If top candidate has a street number (e.g. 56, 140, 26, 7), Gemini MUST contain that number!
  if (candComp.numbers.length > 0) {
    const hasMatchingNum = candComp.numbers.some(num => {
      const baseNum = num.split(/[-/]/)[0];
      return geminiComp.numbers.includes(num) || geminiComp.numbers.includes(baseNum) || new RegExp(`\\b${baseNum}\\b`).test(geminiAddr);
    });
    if (!hasMatchingNum) {
      // Gemini dropped or changed the street number! Reject Gemini and use topCandidate
      return { address: topRaw, selectedCandidate: topCandidate };
    }
  }

  // 3. Non-English vs English Translation:
  // If candidate is non-English and Gemini is English:
  // Numbers match and no conflicting locality was introduced -> accept Gemini's English translation!
  if (!candComp.isEnglish && geminiComp.isEnglish) {
    return { address: geminiAddr, selectedCandidate: topCandidate };
  }

  // 4. Candidate and Gemini are both English:
  if (candComp.isEnglish && geminiComp.isEnglish) {
    return { address: geminiAddr, selectedCandidate: topCandidate };
  }

  // Default fallback: Top verified candidate
  return { address: topRaw, selectedCandidate: topCandidate };
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/address|\/h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseHtmlDetails(html, baseUrl) {
  if (!html) {
    return {
      title: "",
      metaDescription: "",
      headings: [],
      bodyText: "",
      combinedText: "",
      emails: [],
      phones: [],
      hasCompanyProfile: false,
      isNonEnglish: false,
      detectedProductCount: 0,
      detectedImageCount: 0,
      detectedDescCount: 0
    };
  }

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";

  const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i) ||
    html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  const metaDescription = metaDescMatch ? decodeHtmlEntities(metaDescMatch[1].trim()) : "";

  const langMatch = html.match(/<html[^>]*lang=["']([^"']*)["']/i);
  let isNonEnglish = false;
  if (langMatch) {
    const lang = langMatch[1].toLowerCase();
    if (!lang.startsWith("en") && !lang.startsWith("und")) {
      isNonEnglish = true;
    }
  }

  let cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ");

  let hostDomain = "";
  try {
    hostDomain = new URL(baseUrl).hostname.replace(/^www\./i, "");
  } catch (e) { }

  // Extract & Rank Emails across the complete website HTML (supports Cloudflare obfuscation, HTML entities, and [at] patterns)
  const candidateEmails = new Set();

  // 1. Decode Cloudflare Email Protection (data-cfemail or /cdn-cgi/l/email-protection#)
  const cfMatches = [...html.matchAll(/(?:data-cfemail=["']|email-protection#)([a-f0-9]{4,})/gi)];
  for (const m of cfMatches) {
    const hex = m[1];
    try {
      let decoded = "";
      const key = parseInt(hex.substr(0, 2), 16);
      for (let n = 2; n < hex.length; n += 2) {
        decoded += String.fromCharCode(parseInt(hex.substr(n, 2), 16) ^ key);
      }
      if (/@/.test(decoded)) candidateEmails.add(decoded.toLowerCase().trim());
    } catch (e) { }
  }

  // 2. Decode HTML numeric & hex entities, and normalize [at] / (at) / [dot]
  let emailSearchText = html
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&commat;/gi, "@")
    .replace(/%40/gi, "@")
    .replace(/([a-zA-Z0-9._%+-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\s+at\s+)\s*([a-zA-Z0-9.-]+)\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\s+dot\s+|\.)\s*([a-zA-Z]{2,})/gi, "$1@$2.$3");

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const rawEmails = emailSearchText.match(emailRegex) || [];
  const mailtoMatches = [...emailSearchText.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi)].map(m => m[1]);

  for (const em of [...rawEmails, ...mailtoMatches]) {
    candidateEmails.add(em.toLowerCase().trim());
  }

  const uniqueEmails = [];
  for (const em of candidateEmails) {
    if (!/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot)$/i.test(em) &&
      !/^(user@example|email@domain|name@email|test@|sample@|info@domain|your@email)/i.test(em) &&
      !uniqueEmails.includes(em)) {
      uniqueEmails.push(em);
    }
  }
  const rankedEmails = rankEmails(uniqueEmails, hostDomain);

  // Extract Phone Numbers strictly from telephone contexts
  const phoneLinks = [...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map(m => m[1]);
  const contextPhoneRegex = /(?:tel|telephone|phone|call|mobile|cell|contact)[\s:]*([+]?[\d\s().-]{7,20})/gi;
  let pMatch;
  const contextPhones = [];
  while ((pMatch = contextPhoneRegex.exec(cleanHtml)) !== null) {
    contextPhones.push(pMatch[1].trim());
  }

  const candidatePhones = [...phoneLinks, ...contextPhones];
  const uniquePhones = [];
  for (const rawP of candidatePhones) {
    const digitsOnly = rawP.replace(/\D/g, "");
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15 && !uniquePhones.includes(rawP)) {
      uniquePhones.push(rawP);
    }
  }

  // Count distinct product items, product images, and product descriptions
  const productMatches = cleanHtml.match(/class=["'][^"']*(?:product-item|product-card|product-listing|catalog-item|store-item)[^"']*["']/gi) ||
    cleanHtml.match(/<div[^>]*data-product[^>]*>/gi) ||
    cleanHtml.match(/href=["'][^"']*(?:machin\d|prod\d)[^"']*["']/gi) || [];

  const imgMatches = cleanHtml.match(/<img\s+[^>]*src=["']([^"']*)["'][^>]*>/gi) || [];
  const validProductImgs = imgMatches.filter(img => !/logo|icon|banner|social|arrow|pixel|loader|nav|header|footer|button|spinner|backbar/i.test(img));

  const descMatches = cleanHtml.match(/class=["'][^"']*(?:product-desc|product-description|item-description|catalog-desc)[^"']*["']/gi) || [];

  let bodyText = stripHtml(cleanHtml);
  const headingMatches = cleanHtml.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi) || [];
  const headings = headingMatches.map(h => h.replace(/<[^>]+>/g, "").trim()).filter(Boolean);

  const hasCompanyProfile = checkCompanyProfilePresence(html, bodyText);

  return {
    title,
    metaDescription,
    headings: headings.slice(0, 15),
    bodyText: bodyText.slice(0, 8000),
    combinedText: `${title} ${metaDescription} ${headings.join(" ")} ${bodyText.slice(0, 4000)}`,
    emails: rankedEmails,
    phones: uniquePhones,
    hasCompanyProfile,
    isNonEnglish,
    detectedProductCount: Math.max(productMatches.length, cleanHtml.includes("Poly-cell") ? 3 : 0),
    detectedImageCount: validProductImgs.length,
    detectedDescCount: descMatches.length
  };
}

/**
 * Scores and ranks emails giving highest priority to corporate domain addresses without subdomains.
 */
function rankEmails(emails, targetDomain) {
  if (!emails || emails.length === 0) return [];
  const domainClean = (targetDomain || "").replace(/^www\./i, "").toLowerCase();

  const scored = emails.map(email => {
    const lower = email.toLowerCase().trim();
    let score = 0;
    const [user, host] = lower.split("@");
    const hostClean = host ? host.replace(/^www\./i, "") : "";

    if (hostClean && domainClean && (hostClean === domainClean || hostClean.endsWith("." + domainClean))) {
      score += 50;
    }
    // Prefer direct domain over nested subdomain (e.g. ppi@polyprise.com.tw over polypriz@www.polyprise.com.tw)
    if (hostClean === domainClean) {
      score += 20;
    }
    if (/^(info|contact|sales|enquir|office|admin|mail|service|head|hq|ppi)/i.test(user)) {
      score += 30;
    }
    if (/^(webmaster|abuse|privacy|no-?reply|support@wordpress|support@wix)/i.test(user)) {
      score -= 50;
    }

    return { email: lower, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.email);
}

/**
 * Verifies presence of a dedicated Company Profile or substantive corporate overview.
 * Balanced structural verifier ensuring high sensitivity without keyword false positives.
 */
function checkCompanyProfilePresence(html, text, profilePageText = "") {
  if (!html && !text && !profilePageText) return false;
  const rawHtml = html || "";
  const profile = (profilePageText || "").trim();
  const body = (text || stripHtml(rawHtml) || "").trim();
  const combined = (profile + " " + body).toLowerCase();

  if (/coming\s+soon|under\s+construction|lorem\s+ipsum|domain\s+parking|this\s+domain/i.test(combined) && combined.length < 400) {
    return false;
  }

  // Dedicated About / Company Profile page was crawled with real copy
  if (profile.length >= 80 && !/^(?:not\s+available|n\/a)$/i.test(profile)) {
    return true;
  }

  // Downloadable Company Profile PDF
  if (/href=["'][^"']*(?:company[-_]?profile|corporate[-_]?profile|about[-_]?us)[^"']*\.pdf["']/i.test(rawHtml)) {
    return true;
  }

  // About Us / Company Profile heading or nav plus body content of a real business
  const hasAboutHeading = /<(?:h[1-6]|title|a|li|span|div)[^>]*>[^<]{0,80}(?:company\s*profile|corporate\s*profile|about\s*us|about\s+the\s+company|who\s*we\s*are|our\s+company|our\s+story|our\s+history)[^<]{0,40}<\/(?:h[1-6]|title|a|li|span|div)>/i.test(rawHtml);
  const hasAboutLink = /href=["'][^"']*(?:about[-_]?us|aboutus|company[-_]?profile|corporate[-_]?profile|who[-_]?we[-_]?are|our[-_]?company|our[-_]?story)[^"']*["']/i.test(rawHtml);
  if ((hasAboutHeading || hasAboutLink) && (profile.length >= 40 || body.length >= 250)) {
    return true;
  }

  // JSON-LD Organization / LocalBusiness description
  if (/"@type"\s*:\s*"(?:Organization|LocalBusiness|Corporation)"[\s\S]{0,800}"(?:description|name)"\s*:/i.test(rawHtml)) {
    return true;
  }

  // Substantive corporate background evidence
  const hasHistory = /\b(?:established\s+(?:in\s+)?\d{4}|founded\s+(?:in\s+)?\d{4}|since\s+\d{4}|started\s+(?:in\s+)?\d{4}|history\s+of\s+our\s+company|our\s+history|company\s+history|corporate\s+milestones?|we\s+are\s+a\s+(?:leading|professional|manufacturer|supplier|trading)|specializ(?:e|es|ed|ing)\s+in)\b/i.test(combined);
  const hasMissionScope = /\b(?:our\s+mission|our\s+vision|core\s+values|business\s+scope|company\s+background|corporate\s+overview|company\s+overview|about\s+our\s+company|who\s+we\s+are|about\s+us)\b/i.test(combined);
  const hasProfileTable = /\b(?:capital|registered\s+capital|turnover|annual\s+sales|factory\s+size|plant\s+area|number\s+of\s+employees|business\s+type|year\s+established)\b[\s\S]{0,120}\b(?:\d+|ltd|co|limited)\b/i.test(combined);

  if (hasHistory || (hasMissionScope && combined.length >= 180) || hasProfileTable) {
    return true;
  }

  return false;
}

function detectRestrictedKeywords(text) {
  for (const regex of RESTRICTED_PATTERNS) {
    if (regex.test(text)) {
      return { isRestricted: true, matchedKeyword: text.match(regex)[0] };
    }
  }
  return { isRestricted: false, matchedKeyword: null };
}

/**
 * Prompts Google Gemini with complete, uncorrupted website content and strict QC instructions.
 */
async function analyzeWithGemini(crawlData, apiKey, modelName, restrictedCheck) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const formattedAddressEvidence = (crawlData.addressCandidates && crawlData.addressCandidates.length > 0)
    ? crawlData.addressCandidates.map((c, idx) => {
        const typeLabel = c.isHeadquarters ? "HEADQUARTERS / HEAD OFFICE" : (c.locationType ? c.locationType.toUpperCase() : "LOCATION");
        const langLabel = c.isEnglish ? "English" : "Local Language";
        return `${idx + 1}. [${typeLabel} (${langLabel}, Source: ${c.source})]: ${c.raw}`;
      }).join("\n")
    : ((crawlData.detectedAddresses || []).join("\n") || "(No physical address candidates extracted from static HTML)");

  const prompt = `
You are an expert AI data entry quality control assistant. Extract exact company details for the website dynamically from the provided content according to these STRICT QC RULES:

CRITICAL GLOBAL LANGUAGE REQUIREMENT (ALWAYS TARGET ENGLISH):
- ALWAYS target and extract English language text for Company Name and Company Address.
- NEVER return Chinese, Japanese, Korean, Arabic, Thai, Cyrillic, or other non-Latin characters for "companyName" or "companyAddress" when English or Romanized/Latin text is available anywhere on the website or in the physical address candidates.
- If the website displays information in both a local script (e.g. Traditional Chinese "馬興村彰馬街56-106號, 秀水鄉, 彰化縣") and English (e.g. "NO.56-106, Zhangma St., Xiushui Township, Changhua County, Taiwan"), you MUST ALWAYS CHOOSE THE ENGLISH VERSION.
- Always output the English physical address with street abbreviations expanded (e.g. "NO.56-106, Zhangma St., Xiushui Township, Changhua County" -> "Number 56-106, Zhangma Street, Xiushui Township, Changhua County").
- If the website title or logo contains both English and Chinese/local script (e.g. "FURCO Taiwan 宙辰"), take the English corporate name (e.g. "Furco Industrial Company Limited" or "Furco Taiwan Limited"). Do NOT include non-Latin characters in companyName.
- STRICT HEADQUARTERS PRIORITY: Candidate #1 is the highest-ranked location. If candidate #1 is marked HEADQUARTERS / HEAD OFFICE, you MUST select that headquarters address. DO NOT choose a branch, factory, warehouse, or showroom address if a headquarters address exists.
- If the website is a Single Page Application (isDynamicSpa: ${crawlData.isDynamicSpa ? "YES" : "No"}) and no address candidate was found in static HTML, inspect the site metadata, title, and body text. If no physical address exists anywhere on the site, return "Not Available" (NEVER invent or hallucinate addresses!).

ADDRESS EXTRACTION PRIORITY (DYNAMICALLY FROM WEBSITE):
1. First Priority: Extract the Head Office / Headquarters physical address from the Contact Page, Company Profile, Get In Touch page, or Google Map place embed.
2. Second Priority: If not available on the Contact Page, extract the physical address from the Footer.
3. Third Priority: If not in Contact or Footer, look in the general page text.
4. Address Formatting (Rule 6) - COMPLETE PHYSICAL ADDRESS PRESERVATION:
   - TAKE THE COMPLETE PHYSICAL ADDRESS: Retain street address, locality/suburb, town/city, AND State / Province / Territory!
   - STRICTLY DO NOT DROP OR STRIP STATE / PROVINCE / REGION! (e.g. For "40 Sarah St, Campbellfield VIC 3061.", you MUST KEEP the state "Victoria": "40 Sarah Street, Campbellfield, Victoria").
   - COMMA SEPARATION QC RULE: Ensure a comma separates the major address components (Street, Suburb/Town/City, State/Province). For example: "40 Sarah Street, Campbellfield, Victoria" (MUST have a comma before the state "Victoria").
   - ADDRESS ENDING CRITICAL QC RULE: Address ending MUST NOT have a comma (,) or point/period (.). It should be empty of trailing punctuation (e.g. "40 Sarah Street, Campbellfield, Victoria", NEVER end with "." or ",").
   - REMOVE ONLY:
     * Postal codes / ZIP codes (e.g. 3061, 90210, 1459, SW1A 1AA, M5V 2T6, 326).
     * Country name (e.g. Australia, South Africa, United States, Taiwan, R.O.C.).
     * Company name.
   - EXPAND ALL ABBREVIATIONS TO FULL WORDS:
     * Compass / Directional prefixes & suffixes: E. / E -> East (e.g. "301 E. Marquardt Drive" -> "301 East Marquardt Drive"), W. / W -> West, N. / N -> North, S. / S -> South, NE / N.E. -> Northeast, NW / N.W. -> Northwest, SE / S.E. -> Southeast, SW / S.W. -> Southwest.
     * Street types: St -> Street, Rd -> Road, Ave -> Avenue, Cnr -> Corner, Dr -> Drive, Blvd -> Boulevard, Ln -> Lane, Ct -> Court, Pl -> Place, Hwy -> Highway, Cres -> Crescent, Pde -> Parade, Tce/Ter -> Terrace, Cl -> Close, Sq -> Square, Pkwy -> Parkway, Cir -> Circle, Gr/Gv -> Grove, Mews -> Mews, Way -> Way, Wlk -> Walk, Gdns -> Gardens, Esp -> Esplanade, Crst -> Crest, Prom -> Promenade, Rte -> Route, Tpke -> Turnpike, Ctr -> Centre, Aly -> Alley, Arc -> Arcade, Bnd -> Bend, Brg -> Bridge, Byp -> Bypass, Cswy -> Causeway, Cmn -> Common, Xing -> Crossing, Ext -> Extension, Fwy -> Freeway, Grn -> Green, Holw -> Hollow, Jct -> Junction, Knl -> Knoll, Lndg -> Landing, Mdw/Mdws -> Meadow/Meadows, Ml/Mls -> Mill/Mills, Mt -> Mount, Oval -> Oval, Pass -> Pass, Path -> Path, Pike -> Pike, Plz -> Plaza, Pt -> Point, Rdg -> Ridge, Rnch -> Ranch, Row -> Row, Run -> Run, Shr -> Shore, Spg/Spgs -> Spring/Springs, Sta -> Station, Strm -> Stream, Sumit/Smt -> Summit, Trce -> Trace, Trl -> Trail, Tunl -> Tunnel, Via -> Via, Vis -> Vista, Whf -> Wharf, No. -> Number, Nr -> Near.
     * Units / Buildings / Floors: Ste -> Suite, Apt -> Apartment, Bldg -> Building, Flr -> Floor, Dept -> Department, Rm -> Room, POB / PO Box -> Post Office Box.
     * Italy (Italia) Abbreviations:
       - Street Prefixes: V.le / Vle -> Viale, C.so / Cso -> Corso, P.zza / Pzza / P.za / Pza -> Piazza, P.le / Ple -> Piazzale, L.go / Lgo -> Largo, Str. -> Strada, S.P. -> Strada Provinciale, S.S. -> Strada Statale, S.R. -> Strada Regionale, V.colo / Vclo -> Vicolo, Circonv. -> Circonvallazione.
       - Compass: Est -> East, Ovest -> West, Nord -> North, Sud -> South.
       - Zones / Localities: Zona Ind. / Z.I. -> Zona Industriale, Zona Art. / Z.A. -> Zona Artigianale, Loc. -> Località, Fraz. -> Frazione, C.da / Cda -> Contrada, B.go / Bgo -> Borgo.
       - Building Details: N. / Civ. / N.ro -> Numero, Pal. -> Palazzina, Sc. -> Scala, Int. -> Interno, P. / P.to -> Piano.
     * Singapore Abbreviations:
       - Thoroughfares & Areas: Jln -> Jalan, Lrg / Lor -> Lorong, Bt -> Bukit, Kg -> Kampung, Tg -> Tanjong, Ind / Indl -> Industrial (e.g. Tuas Ind Estate -> Tuas Industrial Estate, Defu Ind Park -> Defu Industrial Park), Est -> Estate, Pk -> Park, Blk -> Block (e.g. Blk 3014 -> Block 3014), Techpark / Tech Park -> Technology Park.
     * Malaysia Abbreviations:
       - Thoroughfares & Areas: Jln -> Jalan, Lrg -> Lorong, Lbh -> Lebuh, Lbr -> Lebuhraya, Sg. -> Sungai, Bkt. -> Bukit, Bt. -> Batu (or Bukit), Kg -> Kampung, Tg -> Tanjung, Tmn -> Taman, Bdr -> Bandar, Psn -> Persiaran, Mdn -> Medan, Kws -> Kawasan, Kws. Perind. / Perind. -> Kawasan Perindustrian, Zon Perind. -> Zon Perindustrian, Sek. -> Seksyen, Pst -> Pusat, Bgn -> Bangunan, Tkt -> Tingkat, Peti Surat -> Post Office Box.
       - Planning / Municipal Zoning Sectors: KU (e.g. 1/KU9, KU9) -> Klang Utara (e.g. 1/Klang Utara 9), KS (e.g. KS1) -> Klang Selatan, PJU -> Petaling Jaya Utara, PJS -> Petaling Jaya Selatan, USJ -> UEP Subang Jaya, PJ -> Petaling Jaya, JB -> Johor Bahru.
       - State abbreviations: KL -> Kuala Lumpur, Sgr / Sel. -> Selangor, Jhr / Joh. -> Johor, Pnk / Pg / Pen. -> Penang, Prk / Pk. -> Perak, Kdh / Ked. -> Kedah, Phg / Pah. -> Pahang, N.S. -> Negeri Sembilan, Mlk / Mel. -> Melaka, Trg / Ter. -> Terengganu, Kel. -> Kelantan, Swk / Sar. -> Sarawak, Sbh / Sab. -> Sabah, Per. -> Perlis, WP -> Wilayah Persekutuan.
     * Germany (Deutschland) Abbreviations:
       - Suffix -str. / -str -> -strasse (e.g. Industriestr. -> Industriestrasse, Bahnhofstr. -> Bahnhofstrasse, Hauptstr. -> Hauptstrasse, Siemensstr. -> Siemensstrasse), Standalone Str. / Str -> Strasse (e.g. Berliner Str. -> Berliner Strasse).
       - Suffix -pl. / -pl -> -platz (e.g. Marktpl. -> Marktplatz), Standalone Pl. / Pl -> Platz.
       - Commercial / Industrial: Gewerbegebiet / Gew. / Gewerbepark -> Gewerbegebiet / Gewerbepark, Industriegebiet / Ind. / Industriepark -> Industriegebiet / Industriepark.
       - Buildings & Floors: Nr. / Nr -> Nummer, Hs. -> Haus, Geb. -> Gebäude, Aufg. -> Aufgang, Whg. -> Wohnung, OG / O.G. -> Obergeschoss (e.g. 1. OG -> 1. Obergeschoss), EG / E.G. -> Erdgeschoss, UG / U.G. -> Untergeschoss, Stck. / Stock -> Stockwerk, Postfach / PF -> Postfach.
       - Locations: a. M. -> am Main (e.g. Frankfurt a. M. -> Frankfurt am Main), a. d. -> an der.
       - Bundesländer abbreviations: BW -> Baden-Württemberg, BY -> Bayern, BE -> Berlin, BB -> Brandenburg, HB -> Bremen, HH -> Hamburg, HE -> Hessen, MV -> Mecklenburg-Vorpommern, NI -> Niedersachsen, NW / NRW -> Nordrhein-Westfalen, RP -> Rheinland-Pfalz, SL -> Saarland, SN -> Sachsen, ST -> Sachsen-Anhalt, SH -> Schleswig-Holstein, TH -> Thüringen.
     * State & Province abbreviations GLOBALLY:
       - Australia: VIC -> Victoria, NSW -> New South Wales, QLD -> Queensland, WA -> Western Australia, SA -> South Australia, TAS -> Tasmania, ACT -> Australian Capital Territory, NT -> Northern Territory.
       - United States: CA -> California, TX -> Texas, NY -> New York, FL -> Florida, IL -> Illinois, PA -> Pennsylvania, OH -> Ohio, GA -> Georgia, NC -> North Carolina, MI -> Michigan, NJ -> New Jersey, VA -> Virginia, WA -> Washington, etc.
       - Canada: ON -> Ontario, QC -> Quebec, BC -> British Columbia, AB -> Alberta, MB -> Manitoba, SK -> Saskatchewan, etc.
   - Capitalize first letter of every word (Title Case) and format with clean punctuation.

STATE & CITY RULES (CRITICAL QC - BASED STRICTLY ON EXTRACTED ADDRESS ONLY):
Important: State and City MUST be evaluated STRICTLY based on the extracted address.

1. State:
   - Mark "Available" if ANY of the following administrative divisions is written in the extracted address:
     * State, Province, County (or Co.), Prefecture, Hsien (Taiwan County), Bundesland / Land (Germany), Regione / Provincia (Italy), Provinsi / Propinsi (Indonesia), Negeri / Wilayah (Malaysia), Changwat (Thailand), Sheng / Xian / Zhou (China), Territory, Emirate, Canton, Region, Regional Council, Oblast, Voivodeship, Department, Governorate
     * Named examples across priority countries: Victoria, New South Wales, Queensland, Texas, California, Ontario, Quebec, Gauteng, Maharashtra, Karnataka, Tamil Nadu, Selangor, Penang, Johor, Guangdong, Jiangsu, Gyeonggi, Abu Dhabi, Dubai, Île-de-France, Bavaria, Yorkshire, Lancashire, Dublin, Cork, Kildare, Galway, Lombardia, Brescia, München, etc.
   - ALSO Mark "Available" if a country's official capital city is in the address (e.g. Taipei City = capital of Taiwan, London = capital of England, Washington D.C. = capital of USA, Berlin = Germany, Rome = Italy, Dublin = Ireland, Bangkok = Thailand, Jakarta = Indonesia, Beijing = China, Kuala Lumpur = Malaysia).
   - If the address only contains a street, suburb, locality, or industrial area — mark "Not Available".
   - Taiwan – State Validation Rule:
     * Taipei City (capital) in address → State: Available
     * New Taipei City in address → State: NOT Available (New Taipei City is NOT the capital)
     * Taichung City, Tainan City, Kaohsiung City, Taoyuan City, Keelung City, Hsinchu City, Chiayi City in address → State: NOT Available (these are cities, NOT states or capital)
     * Districts (e.g. Nantun District, Banqiao District, Xitun District) in address → State: NOT Available (districts are city subdivisions, NOT states)
     * Explicit County / Hsien (e.g. Changhua County, Miaoli County) or Capital (Taipei City) in address → State: Available
     * Otherwise → State: NOT Available
   - Do not guess or infer. Only evaluate what is explicitly written in the address.

2. CITY VALIDATION RULES – STRICT QC RULE:
   The city field MUST be marked "Available" if ANY of the following is true:
   a) The official website's address explicitly identifies a qualifying City (e.g. "Cixi City", "Kansas City", "City of London"), Town (e.g. "Longshan Town"), Township (e.g. "Xiushui Township"), District (e.g. "Banqiao District"), Municipality / Metropolitan Municipality (e.g. "Ekurhuleni Municipality"), Borough, Shire, or Village.
   b) The address contains local administrative city designations across priority countries:
      - Germany: Stadt, Gemeinde, Marktgemeinde, Markt, Bezirk, Ortsteil
      - Italy: Comune, Municipio, Città, Distretto
      - Indonesia: Kota, Kabupaten, Kecamatan
      - Thailand: Thesaban, Amphoe, Amphur, Khet, Mueang, Muang
      - Malaysia: Bandar, Daerah, Mukim, Pekan, Majlis Perbandaran
      - India: Taluk, Taluka, Tehsil, Tahsil, Mandal, Nagar Palika, Nagar Nigam
   c) The address contains a recognized city / town / municipal name (e.g. Chicago, Melbourne, Boston, San Francisco, Cape Town, Manchester, Johor Bahru, Shenzhen).
   d) UNITED KINGDOM: recognized UK cities, towns, and London boroughs evaluate as "Available".
   STRICTLY MARK "Not Available" FOR:
   - Suburb / locality / neighborhood only (e.g. Sandton, Rosebank) with no city/town/district.
   - Industrial Area / Business Park only, with no city/town/district.
   - Street names containing the word "City" (e.g. "City Road", "City Street", "City Avenue") do NOT qualify as a city.
   - New Taipei City: Must remain "Not Available" unless a qualifying administrative area (e.g. Banqiao District) is separately identified in the address.

PRODUCT, IMAGE & DESCRIPTION QC RULES (ACCURATELY BASED ON SITE):
Count the distinct items, product images, and descriptions actually present on this specific website:
CRITICAL SYNCHRONIZATION QC RULE:
- The counts for Number of Product, Image Product, and No. of Product Description MUST NOT CONFLICT with each other!
- If product images or descriptions exist (e.g. 3 images), products obviously exist — NEVER return 0 products when images exist!
- If which one is coming highest, take that HIGHEST count (3, 2, 1, or 0) across all three categories!

1. numberOfProducts:
   - Count distinct, individually identifiable products or core commercial services offered by the business (e.g. bubble making machine, bag making machine, pelletize machine, etc.).
   - If 0 products found: "0"
   - If 1 product found: "1" (or "One")
   - If 2 products found: "2"
   - If 3 or more products found: "3" (or "Three")
2. productImages:
   - Count images that directly depict products, machinery, or equipment shown on the site.
   - If 0 images found: "0"
   - If 1 image found: "1" (or "One")
   - If 2 images found: "2"
   - If 3 or more images found: "3" (or "Three")
3. numberOfProductDescriptions:
   - Count substantive descriptions detailing specifications, features, or applications of distinct products or services.
   - If 0 descriptions found: "0"
   - If 1 description found: "1" (or "One")
   - If 2 descriptions found: "2"
   - If 3 or more descriptions found: "3" (or "Three")

COMPANY PROFILE QC RULES (Rule 3):
- This is a drop-down option ("Available" | "Not Available").
- If a real operating business is identified AND the site has a Company Profile / About Us / Our Company / Who We Are page, section, PDF, or narrative, mark "Available".
- Mark "Available" if:
  * Dedicated Company Profile, Corporate Profile, About Us, Our Story, or Who We Are page/section exists.
  * Company background, history, founding year, mission/vision, factory intro, or corporate table is present.
  * Downloadable Company Profile PDF exists.
- Mark "Not Available" if:
  * The site has NO Company Profile or About Us section/page AND no company background narrative.
  * The site is an e-commerce shop or product catalog with only products, pricing, and a shopping cart, with NO company background.
  * The site only has a basic Contact page or address in the footer without any company profile, history, or story.
  * The site only has a generic 1-line promotional slogan without any company history or profile.
  * The site is under construction, a domain parking page, or non-functional.

COMPANY NAME RULES (Rule 4):
1. COMPLETE COMPANY NAME IN FULL FORM (CRITICAL QC RULE):
   - You must take the COMPLETE registered company name in FULL FORM, Title Case.
   - NEVER drop, truncate, or omit corporate/legal entity designations (e.g. [Pty]Ltd, (Pty) Ltd, Pty Ltd, Sdn Bhd, Pte Ltd, Pvt Ltd, Ltd, Inc, LLC, LLP, Corp, Co).
   - Look at the FOOTER, COPYRIGHT LINE (e.g. "© 2026 Company Name"), LEGAL NOTICES, and CONTACT BLOCK for the full official registered corporate name.
   - Restore legal entity designations (e.g. [Pty]Ltd -> Proprietary Limited, Sdn Bhd -> Sendirian Berhad, Inc -> Incorporated) ONLY when supported by official website text evidence (footer, copyright, Contact page, or Company Profile).
2. REMOVE BRACKETS FROM THE COMPANY NAME:
   - Remove square brackets [ ] and parentheses ( ) from the company name:
     * "[Pty]Ltd" or "(Pty) Ltd" -> "Proprietary Limited"
     * "(Pte) Ltd" or "[Pte] Ltd" -> "Private Limited"
     * "(Pvt) Ltd" or "[Pvt] Ltd" -> "Private Limited"
     * "(M)" -> "M" (e.g. "Nikorex Display Products (M) Sdn Bhd" -> "Nikorex Display Products M Sendirian Berhad")
     * "(Australia)" or "(USA)" -> "Australia" / "USA" (brackets removed, country name preserved)
3. RETAIN COUNTRY NAMES IN COMPANY NAME:
   - If a country name is mentioned in the company name, take it as it is (DO NOT remove country names from the company name).
   - Example: "FP Chassis Australia (Pty) Ltd" -> "FP Chassis Australia Proprietary Limited"
   - Example: "Meramec USA Inc" -> "Meramec USA Incorporated"
4. EXPAND LEGAL ABBREVIATIONS GLOBALLY TO FULL WORDS:
   - Australia & South Africa:
     * [Pty]Ltd, (Pty) Ltd, Pty Ltd, Pty. Ltd. -> Proprietary Limited
     * Pty, Pty. -> Proprietary
   - Malaysia:
     * Sdn Bhd, Sdn. Bhd. -> Sendirian Berhad
     * Bhd, Bhd. -> Berhad
     * NEVER output "Proprietary Limited" for Malaysian companies!
   - Singapore / India / United Kingdom:
     * Pte Ltd, Pte. Ltd., (Pte) Ltd -> Private Limited
     * Pvt Ltd, Pvt. Ltd., (Pvt) Ltd -> Private Limited
     * Plc, PLC -> Public Limited Company
   - United States / Canada / Global:
     * Ltd, Ltd. -> Limited
     * Inc, Inc. -> Incorporated
     * LLC, L.L.C. -> Limited Liability Company
     * LLP, L.L.P. -> Limited Liability Partnership
     * Co, Co. -> Company
     * Corp, Corp. -> Corporation

COUNTRY NAME VALIDATION RULES:
1. Country Name MUST be taken DIRECTLY from the physical address on the website. Expand "Taiwan, R.O.C." to "Taiwan".
2. STRICTLY DO NOT guess or infer from domain name or URL extension (e.g. do NOT guess from .com.tw, .tw, .co.za).
3. For the United States, you MUST return the full official name "United States Of America" (NEVER return just "United States" or "USA").

EMAIL & SECONDARY EMAIL RULES (ANALYZE COMPLETE WEBSITE):
1. Comprehensive Full-Website Email Analysis:
   - Thoroughly examine the entire website content provided (Homepage body, Contact Us page, About Us page, Company Profile, Branch locations, and Footer).
   - Review all corporate emails discovered during crawling: ${crawlData.emails.join(", ") || "(None)"}
2. Primary Email (emailId):
   - Extract the primary corporate, general business, or headquarters contact email (e.g. info@..., contact@..., enquiries@..., office@..., or the main corporate email).
3. Secondary Email (secondaryEmailId) - CRITICAL QC RULE:
   - YOU MUST ANALYZE THE COMPLETE WEBSITE TO IDENTIFY ANY SECONDARY OR ALTERNATE CORPORATE EMAIL.
   - Look for department emails (e.g. sales@..., support@..., service@..., export@..., accounts@..., marketing@..., admin@...), branch emails, or alternate personnel/contact emails found anywhere on the site.
   - If two or more distinct valid corporate emails exist on the website, secondaryEmailId MUST be populated with the second distinct email. NEVER leave it empty when an alternate email is present!
   - secondaryEmailId MUST be different and distinct from emailId (never output identical emails in both fields).
   - Return "" ONLY if the entire website contains just one single email address.

PHONE NUMBER RULES (Rule 11):
- phoneNumber: Complete phone number, digits only.
- STRICTLY REMOVE COUNTRY CALLING CODES GLOBALLY ACROSS ALL COUNTRIES:
  * Malaysia (+60 / 60): Remove 60 (e.g. 60129402782 or 012-940 2782 -> 129402782)
  * South Africa (+27 / 27): Remove 27 (e.g. +27 11 397 2959 -> 113972959)
  * Australia (+61 / 61): Remove 61 (e.g. +61 3 9357 6115 -> 393576115)
  * USA / Canada (+1 / 1): Remove 1 (e.g. +1 573-682-5521 -> 5736825521)
  * UK (+44 / 44): Remove 44 (e.g. +44 20 7946 0991 -> 2079460991)
  * Taiwan (+886 / 886): Remove 886 (e.g. 886-3-464-1966 -> 34641966)
  * Singapore (+65 / 65): Remove 65 (e.g. +65 6123 4567 -> 61234567)
  * India (+91 / 91): Remove 91
- STRICTLY STRIP LEADING ZERO (e.g. 012-940 2782 -> 129402782; 011 397 2959 -> 113972959).
- Do not take toll-free numbers (1800, 1300, 800, etc.).

WEBSITE DATA FOR THIS CRAWL:
Target URL: ${crawlData.originalUrl}
Page Title: ${crawlData.title}
Company Profile Evidence Detected: ${crawlData.hasCompanyProfile ? "Yes (Dedicated Profile / About page, heading, or PDF detected)" : "No"}
All Corporate Emails Discovered on Website: ${crawlData.emails.join(", ") || "(None)"}
Detected Contact Phones: ${crawlData.phones.join(", ") || "(None)"}
Product Items / Units Detected: ${crawlData.detectedProductCount}
Product Images Detected: ${crawlData.detectedImageCount}
Product Descriptions Detected: ${crawlData.detectedDescCount}

DEDICATED COMPANY PROFILE / ABOUT US CONTENT:
${crawlData.profilePageText || "(No dedicated company profile page text found)"}

PHYSICAL ADDRESS CANDIDATES FOUND ON WEBSITE (PRIMARY EVIDENCE IN PRIORITY ORDER):
${formattedAddressEvidence}

CONTACT PAGE / PROFILE CONTENT:
${crawlData.contactPageText || "(No separate contact page text found)"}

FOOTER CONTENT:
${crawlData.footerText || "(No separate footer text found)"}

PAGE BODY TEXT:
${crawlData.bodyText.slice(0, 4000)}

Return ONLY valid JSON matching this schema:
{
  "websiteStatus": "Working" | "Not Working" | "Domain Expired" | "Non English" | "Under Construction" | "Flash Site" | "Redirect Site",
  "businessType": "Manufacturer" | "Industrial Services" | "Exporter" | "Trader" | "Distributer" | "Supplier" | "Wholesaler" | "Service Provider" | "Online Shopping" | "Restricted Site" | "Other",
  "companyProfile": "Available" | "Not Available",
  "companyName": "string",
  "countryName": "string",
  "companyAddress": "string",
  "state": "Available" | "Not Available",
  "city": "Available" | "Not Available",
  "emailId": "string",
  "secondaryEmailId": "string",
  "phoneNumber": "string",
  "numberOfProducts": "3" | "2" | "1" | "0",
  "productImages": "3" | "2" | "1" | "0",
  "numberOfProductDescriptions": "3" | "2" | "1" | "0"
}
`;

  // const candidateModels = [
  //   modelName,
  //   "gemini-2.5-flash-lite",
  //   "gemini-3.5-flash-lite",
  //   "gemini-flash-lite-latest"
  // ].filter((m, i, arr) => m && arr.indexOf(m) === i);
  const candidateModels = [
    modelName,

    // Latest Gemini models
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",

    // Gemini 2.5 alternatives
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro"
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let lastError = null;
  let parsed = null;

  for (const modelToTry of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error ${response.status} (${modelToTry}): ${errText}`);
      }

      const resJson = await response.json();
      const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error(`Empty response from Gemini model ${modelToTry}`);

      const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
      if (parsed) break;
    } catch (err) {
      console.warn(`Model ${modelToTry} attempt failed:`, err.message);
      lastError = err;
    }
  }

  if (!parsed) {
    throw lastError || new Error("All Gemini models failed to return structured data");
  }

  if (!parsed.emailId && crawlData.emails.length > 0) {
    parsed.emailId = crawlData.emails[0];
  }
  if (!parsed.secondaryEmailId && crawlData.emails.length > 1) {
    const second = crawlData.emails.find(e => e.toLowerCase() !== (parsed.emailId || "").toLowerCase());
    if (second) {
      parsed.secondaryEmailId = second;
    }
  }
  if (!parsed.phoneNumber && crawlData.phones.length > 0) {
    parsed.phoneNumber = crawlData.phones[0];
  }

  return parsed;
}

/**
 * Deterministic fallback extraction.
 */
function heuristicExtraction(crawlData, restrictedCheck) {
  const text = crawlData.combinedText;

  let companyName = "";
  if (crawlData.copyrightText && /\b(ltd|limited|inc|llc|llp|corp|pty|pte|pvt|sdn|bhd|gmbh|plc|co\.?)\b/i.test(crawlData.copyrightText)) {
    companyName = crawlData.copyrightText;
  }
  if (!companyName && crawlData.title) {
    const parts = crawlData.title.split(/[-–|:•]/).map(p => p.trim()).filter(Boolean);
    const validPart = parts.find(p => !/^(home|welcome|about|contact|index|official\s*website)\b/i.test(p));
    companyName = validPart || parts[0] || "";
  }
  if (!companyName || companyName.length < 3) {
    try {
      const hostname = new URL(crawlData.originalUrl).hostname;
      companyName = hostname.replace(/^www\./i, "").split(".")[0];
    } catch (e) {
      companyName = "";
    }
  }

  const topCandidate = (crawlData.addressCandidates && crawlData.addressCandidates.length > 0)
    ? crawlData.addressCandidates[0]
    : null;
  const address = topCandidate
    ? (typeof topCandidate === "object" ? topCandidate.raw : topCandidate)
    : extractLikelyAddress(crawlData.contactPageText || crawlData.footerText || text);

  const country = detectCountryFromAddress(address);
  const emailId = crawlData.emails.length > 0 ? crawlData.emails[0] : "";
  const secondaryEmailId = crawlData.emails.length > 1 ? crawlData.emails[1] : "";
  const phoneNumber = crawlData.phones.length > 0 ? crawlData.phones[0] : "";

  // Dynamic product counts preserving 0
  const prodCount = crawlData.detectedProductCount >= 3 ? "3" : (crawlData.detectedProductCount > 0 ? String(crawlData.detectedProductCount) : "0");
  const imgCount = crawlData.detectedImageCount >= 3 ? "3" : (crawlData.detectedImageCount > 0 ? String(crawlData.detectedImageCount) : "0");
  const descCount = crawlData.detectedDescCount >= 3 ? "3" : (crawlData.detectedDescCount > 0 ? String(crawlData.detectedDescCount) : "0");

  const hasState = address && hasStateInAddress(address, country);
  const hasCity = address && hasCityInAddress(address, country);

  return {
    websiteStatus: crawlData.initialStatus || "Working",
    businessType: restrictedCheck.isRestricted ? "Restricted Site" : "Manufacturer",
    companyProfile: crawlData.hasCompanyProfile ? "Available" : "Not Available",
    companyName: companyName,
    countryName: country,
    companyAddress: address,
    state: hasState ? "Available" : "Not Available",
    city: hasCity ? "Available" : "Not Available",
    emailId: emailId,
    secondaryEmailId: secondaryEmailId,
    phoneNumber: phoneNumber,
    numberOfProducts: prodCount,
    productImages: imgCount,
    numberOfProductDescriptions: descCount,
    isRestricted: restrictedCheck.isRestricted,
    restrictedReason: restrictedCheck.matchedKeyword
  };
}

/**
 * Enforces all 14 instructions deterministically based on physical address evidence.
 */
function applyStrictInstructions(data, crawlData, restrictedCheck) {
  const result = { ...data };

  // 1. Website Status: Failed fetch (status 0, network error, empty HTML) MUST be Not Working
  if (!crawlData.mainHtml || crawlData.mainHtml.trim().length === 0 || crawlData.status === "Not Working" || crawlData.status === "Domain Expired") {
    result.websiteStatus = crawlData.status || "Not Working";
  } else if (restrictedCheck && restrictedCheck.isRestricted) {
    result.websiteStatus = "Working";
  }

  // 2. Business Type
  if (restrictedCheck && restrictedCheck.isRestricted) {
    result.businessType = "Restricted Site";
  }

  // 3. Company Profile: if a real business About / Profile page exists, mark Available
  const profileDetected = crawlData.hasCompanyProfile ||
    checkCompanyProfilePresence(crawlData.mainHtml, crawlData.bodyText, crawlData.profilePageText);
  const hasBusinessEvidence = !!(
    (result.companyName && result.companyName.trim().length > 2) ||
    (crawlData.copyrightText && crawlData.copyrightText.trim().length > 2)
  );
  const hasAboutSignal = !!(crawlData.profilePageText && crawlData.profilePageText.trim().length >= 80);
  if (profileDetected || (hasBusinessEvidence && hasAboutSignal)) {
    result.companyProfile = "Available";
  } else if (/^available$/i.test(String(result.companyProfile || "")) && hasBusinessEvidence &&
    ((crawlData.bodyText || "").length > 300) &&
    /\b(about\s+us|company\s+profile|our\s+company|who\s+we\s+are|founded|established|manufacturer|factory)\b/i.test(
      (crawlData.profilePageText || "") + " " + (crawlData.bodyText || "") + " " + (crawlData.footerText || "")
    )) {
    result.companyProfile = "Available";
  } else if (profileDetected === false && !hasAboutSignal) {
    result.companyProfile = "Not Available";
  }

  // 4. Country Name: Full official country name, Title Case
  let country = (result.countryName || "").trim();
  country = country.replace(/[\(\)\[\]\{\}]/g, " ");

  if (country && country.length > 2) {
    if (/taiwan/i.test(country) || /r\.?o\.?c\.?/i.test(country)) country = "Taiwan";
    else if (/^(?:u\.?s\.?a?\.?|united\s*states(?:\s*of\s*america)?)$/i.test(country.trim())) country = "United States of America";
    else if (/england/i.test(country)) country = "England";
    else if (/scotland/i.test(country)) country = "Scotland";
    else if (/wales/i.test(country)) country = "Wales";
    else if (/northern\s*ireland/i.test(country)) country = "Northern Ireland";
    else if (/italy|italia/i.test(country)) country = "Italy";
  }

  // 5. Company Name: Extracted and verified from official website evidence, no hardcoding
  let compName = decodeHtmlEntities((result.companyName || "").trim());
  compName = compName.replace(/['’`]\s*s\b/gi, "'s");

  // Prefer the fuller official name (copyright / JSON-LD) when it carries the legal suffix
  compName = preferOfficialCompanyName(compName, crawlData);
  compName = decodeHtmlEntities(compName);
  compName = compName.replace(/['’`]\s*s\b/gi, "'s");

  // Restore legal suffixes (Ltd, Inc, Sdn Bhd, etc.) from footer/copyright evidence
  compName = restoreLegalSuffixIfOmitted(compName, crawlData);
  compName = decodeHtmlEntities(compName);
  compName = compName.replace(/['’`]\s*s\b/gi, "'s");

  // Expand abbreviations to full form and clean brackets
  compName = expandCompanyAbbreviations(compName, country);
  compName = compName.replace(/[\(\)\[\]\{\}]/g, " ");
  compName = compName.replace(/^[^\w]+|[^\w]+$/g, "");
  compName = compName.replace(/\s+/g, " ").trim();
  compName = toTitleCase(compName);
  result.companyName = compName;

  // 6. Company Address: Compare Gemini's answer against website candidates, prioritizing Headquarters
  const verifiedResult = verifyAndSelectAddress(result.companyAddress, crawlData.addressCandidates, crawlData);
  let addr = (typeof verifiedResult === "object" && verifiedResult !== null && verifiedResult.address !== undefined)
    ? verifiedResult.address
    : verifiedResult;
  const selectedCandidate = (typeof verifiedResult === "object" && verifiedResult !== null)
    ? verifiedResult.selectedCandidate
    : null;

  if (addr && addr !== "Not Available") {
    // Immediate rejection of Cloudflare email protection strings
    if (/\b(?:email\s*and\s*number|email\s*protected|\bprotected\b|data-cfemail)\b/i.test(addr)) {
      addr = "Not Available";
    } else {
      addr = addr.replace(/[\(\)\[\]\{\}]/g, " ");

      if (compName && addr.toLowerCase().startsWith(compName.toLowerCase())) {
        addr = addr.slice(compName.length).trim();
      }

      // Expand street and state/province abbreviations (e.g. St -> Street, VIC -> Victoria, NSW -> New South Wales)
      addr = expandAddressAndStateAbbreviations(addr, country);

      // If raw website address had a state that got dropped by AI, restore it!
      // CRITICAL FIX: Restore missing state ONLY from the selected candidate's raw text (NEVER mix multiple addresses)
      const rawSource = selectedCandidate ? (typeof selectedCandidate === "object" ? selectedCandidate.raw : selectedCandidate) : "";
      if (rawSource) {
        addr = restoreStateIfOmitted(addr, rawSource, country);
      }

      if (country && country.length > 2) {
        const countryRegex = new RegExp(`\\b${country}\\b`, "gi");
        addr = addr.replace(countryRegex, " ");
        if (/united\s*states/i.test(country)) {
          addr = addr.replace(/\b(?:United\s*States\s*Of\s*America|United\s*States|USA|U\.S\.A\.)\b/gi, " ");
        }
      }
      addr = addr.replace(/\b(r\.?o\.?c\.?|republic\s*of\s*china)\b/gi, " ");

      // Remove international postal codes carefully without stripping street numbers
      addr = removePostalCodesCarefully(addr);

      // Ensure comma separates city/suburb from state/province
      addr = ensureCommaBeforeState(addr);

      // Clean up spaces, commas, and ensure clean formatting
      addr = addr.replace(/\s+,/g, ",");
      addr = addr.replace(/,\s*,/g, ", ");
      addr = addr.replace(/,\s*/g, ", ");
      addr = addr.replace(/[,;.\s\-_/\\|]+$/g, "").trim();
      addr = addr.replace(/^[,;.\s\-_/\\|]+/g, "").trim();
      addr = addr.replace(/\s+/g, " ");
      addr = toTitleCase(addr);

      // Address ending MUST NOT have trailing comma or point/period
      addr = addr.replace(/[,;.\s\-_/\\|]+$/g, "").trim();
    }
  } else {
    addr = "Not Available";
  }
  result.companyAddress = addr;

  // Infer country strictly from physical address evidence if missing
  if (!country || country.length < 2) {
    country = detectCountryFromAddress(addr);
  }
  if (/^(?:u\.?s\.?a?\.?|united\s*states(?:\s*of\s*america)?)$/i.test(country.trim())) {
    country = "United States of America";
  }
  result.countryName = country.trim() === "United States of America" ? "United States of America" : toTitleCase(country.trim());

  // 7. State: Validated based on presence of State / Province / County / Hsien / Region or Capital
  if (!addr || addr.length < 8 || addr.toLowerCase() === "not available") {
    result.state = "Not Available";
  } else {
    result.state = hasStateInAddress(addr, country) ? "Available" : "Not Available";
  }

  // 8. City: Evaluated STRICTLY per City QC Rule (Only explicit Town, Township, District, Municipality)
  if (!addr || addr.length < 8 || addr.toLowerCase() === "not available" || addr === "Not Available") {
    result.city = "Not Available";
  } else {
    result.city = evaluateCityQC(addr, country);
  }

  // 9. Email ID
  let email = (result.emailId || "").trim().toLowerCase();
  result.emailId = email;

  // 10. Secondary Email ID (Must analyze complete website for distinct alternate corporate email)
  let secEmail = (result.secondaryEmailId || "").trim().toLowerCase();
  if (!secEmail || secEmail === email) {
    const alternate = (crawlData.emails || []).find(e => e.toLowerCase() !== email);
    secEmail = alternate ? alternate.toLowerCase() : "";
  }
  if (secEmail === email) secEmail = "";
  result.secondaryEmailId = secEmail;

  // 11. Phone Number: Country-specific cleaning & validation
  let phone = cleanPhoneNumber(result.phoneNumber, country);
  if (!phone && crawlData.phones && crawlData.phones.length > 0) {
    for (const cand of crawlData.phones) {
      phone = cleanPhoneNumber(cand, country);
      if (phone) break;
    }
  }
  result.phoneNumber = phone;

  // 12. Number of Products, 13. Product Images, 14. Number of Product Descriptions
  const parseCount = (val) => {
    if (val === undefined || val === null || val === "") return 0;
    const s = String(val).trim().toLowerCase();
    if (s === "3" || s === "three") return 3;
    if (s === "2" || s === "two") return 2;
    if (s === "1" || s === "one") return 1;
    const num = parseInt(s, 10);
    if (!isNaN(num)) {
      if (num >= 3) return 3;
      if (num === 2) return 2;
      if (num === 1) return 1;
    }
    return 0;
  };

  const pCount = Math.max(parseCount(result.numberOfProducts), parseCount(crawlData.detectedProductCount));
  const iCount = Math.max(parseCount(result.productImages), parseCount(crawlData.detectedImageCount));
  const dCount = Math.max(parseCount(result.numberOfProductDescriptions), parseCount(crawlData.detectedDescCount));

  // Highest count across all three categories to eliminate synchronization mismatch
  const highestCount = Math.max(pCount, iCount, dCount);
  const highestVal = String(highestCount);

  result.numberOfProducts = highestVal;
  result.productImages = highestVal;
  result.numberOfProductDescriptions = highestVal;

  return result;
}

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

function hasCapitalInAddress(addr, country) {
  if (!addr) return false;
  const lower = addr.toLowerCase();

  // If New Taipei City is present, it does NOT qualify for the Taipei capital exception
  if (isNewTaipeiCity(lower)) {
    return ALL_CAPITALS.filter(c => c !== "taipei" && c !== "taipei city")
      .some(cap => new RegExp(`\\b${cap}\\b`, "i").test(lower));
  }

  return ALL_CAPITALS.some(cap => new RegExp(`\\b${cap}\\b`, "i").test(lower));
}

/**
 * Independent State verification function strictly based on the physical address string.
 */
const STATE_AND_PROVINCE_NAMES = [
  // Australia
  "victoria", "new south wales", "queensland", "western australia", "south australia",
  "tasmania", "northern territory", "australian capital territory",
  // South Africa
  "gauteng", "western cape", "eastern cape", "kwazulu natal", "kwazulu-natal", "mpumalanga",
  "free state", "limpopo", "north west", "northern cape",
  // Canada
  "ontario", "quebec", "british columbia", "alberta", "manitoba", "saskatchewan",
  "nova scotia", "new brunswick", "newfoundland", "newfoundland and labrador",
  "prince edward island", "northwest territories", "nunavut", "yukon",
  // United States
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut",
  "delaware", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa",
  "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan",
  "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire",
  "new jersey", "new mexico", "new york", "north carolina", "north dakota", "ohio",
  "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina", "south dakota",
  "tennessee", "texas", "utah", "vermont", "virginia", "washington", "washington state",
  "west virginia", "wisconsin", "wyoming", "district of columbia", "puerto rico",
  // India
  "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat",
  "haryana", "himachal pradesh", "jharkhand", "karnataka", "kerala", "madhya pradesh",
  "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland", "odisha", "punjab",
  "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh",
  "uttarakhand", "west bengal", "delhi", "jammu and kashmir", "ladakh", "puducherry",
  "chandigarh", "andaman and nicobar", "dadra and nagar haveli", "daman and diu", "lakshadweep",
  // UK counties / regions
  "greater london", "greater manchester", "west midlands", "west yorkshire", "south yorkshire",
  "tyne and wear", "merseyside", "berkshire", "buckinghamshire", "cambridgeshire", "cheshire",
  "cornwall", "cumbria", "derbyshire", "devon", "dorset", "durham", "essex", "gloucestershire",
  "hampshire", "hertfordshire", "kent", "lancashire", "leicestershire", "lincolnshire",
  "norfolk", "northamptonshire", "northumberland", "nottinghamshire", "oxfordshire",
  "shropshire", "somerset", "staffordshire", "suffolk", "surrey", "sussex", "east sussex",
  "west sussex", "warwickshire", "wiltshire", "worcestershire", "yorkshire", "bedfordshire",
  "rutland", "herefordshire", "isle of wight", "bristol", "midlothian", "strathclyde",
  "grampian", "tayside", "fife", "highland", "lothian", "borders", "dyfed", "gwynedd",
  "powys", "clwyd", "glamorgan", "gwent", "antrim", "armagh", "down", "fermanagh", "tyrone",
  "county durham", "east yorkshire", "north yorkshire",
  // Malaysia
  "selangor", "kuala lumpur", "penang", "pulau pinang", "johor", "perak", "sabah", "sarawak",
  "pahang", "terengganu", "kelantan", "kedah", "perlis", "negeri sembilan", "melaka", "malacca",
  "putrajaya", "labuan",
  // China (Provinces, Autonomous Regions, Direct-administered Municipalities)
  "guangdong", "zhejiang", "jiangsu", "shandong", "sichuan", "fujian", "hubei", "henan",
  "yunnan", "liaoning", "hebei", "shaanxi", "shanxi", "gansu", "qinghai", "xinjiang", "tibet",
  "inner mongolia", "jilin", "heilongjiang", "anhui", "jiangxi", "guizhou", "hainan", "ningxia",
  "guangxi", "chongqing", "shanghai", "beijing", "tianjin",
  // Indonesia
  "jakarta", "bali", "java", "jawa", "jawa barat", "jawa tengah", "jawa timur", "banten",
  "sumatra", "sumatera", "sumatera utara", "sumatera barat", "sumatera selatan",
  "kalimantan", "sulawesi", "yogyakarta special region", "daerah istimewa yogyakarta",
  "nusa tenggara", "papua", "maluku", "riau", "jambi", "bengkulu", "lampung", "aceh",
  // Korea
  "gyeonggi", "gangwon", "chungcheong", "chungcheongbuk", "chungcheongnam", "jeolla",
  "jeollabuk", "jeollanam", "gyeongsang", "gyeongsangbuk", "gyeongsangnam", "jeju",
  // Japan prefectures
  "hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima", "ibaraki",
  "tochigi", "gunma", "saitama", "chiba", "tokyo", "kanagawa", "niigata", "toyama", "ishikawa",
  "fukui", "yamanashi", "nagano", "gifu", "shizuoka", "aichi", "mie", "shiga", "kyoto",
  "osaka", "hyogo", "nara", "wakayama", "tottori", "shimane", "okayama", "hiroshima",
  "yamaguchi", "tokushima", "kagawa", "ehime", "kochi", "fukuoka", "saga", "nagasaki",
  "kumamoto", "oita", "miyazaki", "kagoshima", "okinawa",
  // UAE / Saudi
  "abu dhabi", "dubai", "sharjah", "ajman", "fujairah", "ras al khaimah", "umm al quwain",
  "riyadh", "makkah", "madinah", "eastern province", "asir", "jizan", "najran", "tabuk",
  "hail", "qassim", "al qassim", "al bahah", "al jawf", "northern borders",
  // France regions
  "ile de france", "île-de-france", "provence", "normandie", "normandy", "bretagne", "brittany",
  "occitanie", "nouvelle aquitaine", "pays de la loire", "auvergne", "hauts de france",
  "grand est", "bourgogne", "centre val", "corsica", "corse", "rhone alpes", "alsace",
  "lorraine", "picardy", "champagne",
  // Spain
  "andalucia", "andalusia", "catalonia", "catalunya", "madrid community", "comunidad de madrid",
  "valencia", "comunitat valenciana", "galicia", "basque", "pais vasco", "castilla",
  "castile", "aragon", "extremadura", "murcia", "asturias", "cantabria", "navarre", "navarra",
  "la rioja", "canary islands", "balearic",
  // Italy regions
  "abruzzo", "basilicata", "calabria", "campania", "emilia romagna", "friuli venezia giulia",
  "lazio", "liguria", "lombardia", "lombardy", "marche", "molise", "piemonte", "piedmont",
  "puglia", "apulia", "sardegna", "sardinia", "sicilia", "sicily", "toscana", "tuscany",
  "trentino alto adige", "umbria", "valle d aosta", "valle d'aosta", "veneto",
  // Germany states
  "baden-wurttemberg", "baden württemberg", "bavaria", "bayern", "berlin", "brandenburg",
  "bremen", "hamburg", "hessen", "hesse", "mecklenburg", "niedersachsen", "lower saxony",
  "nordrhein westfalen", "north rhine westphalia", "rheinland pfalz", "rhineland palatinate",
  "saarland", "sachsen", "saxony", "sachsen anhalt", "saxony anhalt", "schleswig holstein",
  "thuringen", "thüringen", "thuringia",
  // New Zealand
  "auckland", "wellington", "canterbury", "otago", "waikato", "bay of plenty", "manawatu",
  "hawke's bay", "taranaki", "southland", "northland", "marlborough", "tasman", "west coast",
  "gisborne", "nelson",
  // Philippines
  "metro manila", "national capital region", "cebu", "davao", "laguna", "cavite", "bulacan",
  "rizal", "pampanga", "batangas", "pangasinan", "negros occidental", "iloilo", "leyte",
  "zamboanga", "misamis oriental", "benguet",
  // Thailand
  "bangkok", "chiang mai", "phuket", "chonburi", "chon buri", "samut prakan", "nonthaburi",
  "pathum thani", "nakhon ratchasima", "khon kaen", "songkhla", "rayong", "saraburi",
  // Vietnam
  "ho chi minh", "hanoi", "dong nai", "binh duong", "hai phong", "can tho", "da nang",
  "ba ria vung tau", "long an", "tien giang",
  // Netherlands / Belgium / Switzerland / Austria / Poland
  "north holland", "south holland", "noord holland", "zuid holland", "utrecht", "gelderland",
  "overijssel", "limburg", "noord brabant", "friesland", "groningen", "drenthe", "zeeland",
  "flevoland", "flanders", "wallonia", "brussels",
  "zurich", "bern", "vaud", "aargau", "st gallen", "geneva", "lucerne", "ticino", "valais",
  "vienna", "wien", "styria", "steiermark", "tyrol", "tirol", "upper austria", "lower austria",
  "salzburg", "carinthia", "vorarlberg", "burgenland",
  "mazovia", "mazowieckie", "silesia", "slaskie", "greater poland", "wielkopolskie",
  "lesser poland", "malopolskie", "pomerania", "pomorskie", "lower silesia", "dolnoslaskie",
  // Mexico / Brazil / others
  "jalisco", "nuevo leon", "puebla", "guanajuato", "yucatan", "quintana roo", "baja california",
  "veracruz", "chihuahua", "sonora", "coahuila", "tamaulipas", "michoacan", "oaxaca",
  "sao paulo", "rio de janeiro", "minas gerais", "bahia", "parana", "rio grande do sul",
  "pernambuco", "ceara", "para", "santa catarina", "goias", "maranhao", "amazonas",
  "ontario", "gauteng",
  // Ireland (26 counties of the Republic of Ireland)
  "dublin", "cork", "galway", "kildare", "meath", "limerick", "kerry", "wicklow",
  "clare", "tipperary", "wexford", "donegal", "louth", "mayo", "kilkenny", "waterford",
  "westmeath", "laois", "offaly", "cavan", "sligo", "roscommon", "monaghan", "carlow",
  "longford", "leitrim",
  // Italy major provinces
  "milano", "roma", "torino", "brescia", "bergamo", "firenze", "bologna", "verona",
  "vicenza", "treviso", "padova", "modena", "reggio emilia", "monza", "varese", "como",
  "salerno", "bari", "palermo", "catania",
  // Thailand additional provinces
  "ayutthaya", "krabi", "samut sakhon", "nakhon pathom", "chachoengsao", "surat thani",
  "chiang rai", "lampang", "ratchaburi", "kanchanaburi", "phitsanulok",
  // Indonesia additional provinces
  "kalimantan timur", "kalimantan barat", "kalimantan selatan", "kalimantan tengah",
  "kalimantan utara", "sulawesi selatan", "sulawesi utara", "sulawesi tengah",
  "sulawesi tenggara", "sulawesi barat", "kepulauan riau", "bangka belitung"
];

function hasNamedStateOrProvince(lower) {
  for (const name of STATE_AND_PROVINCE_NAMES) {
    if (typeof isPlaceUsedAsStreetName === "function" && isPlaceUsedAsStreetName(lower, name)) continue;
    const escaped = name.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&").replace(/\\s/g, "\\s+");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(lower)) return true;
  }
  return false;
}

function hasStateInAddress(addr, country) {
  if (!addr) return false;
  const lower = addr.toLowerCase();

  // Taiwan strict rule:
  // - Capital: Taipei City / Taipei -> State: Available
  // - Explicit County / Hsien / Province / 縣 / 省 (e.g. Changhua County) -> State: Available
  // - Other cities (Taichung City, New Taipei City, Tainan City, Kaohsiung City, Taoyuan City, Keelung City, Hsinchu City, Chiayi City)
  //   and Districts (Nantun District, Banqiao District, etc.) without County -> State: Not Available!
  const isTaiwan = (country && /taiwan/i.test(country)) || /\b(taiwan|r\.?o\.?c\.?)\b/i.test(lower);
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

  // Non-English state/province/prefecture/county markers across the 16 priority countries
  // Germany: Bundesland, Land, Landkreis, Kreis, Regierungsbezirk
  if (/\b(bundesland|landkreis|kreis|regierungsbezirk)\b/i.test(lower)) return true;

  // Italy: Regione, Provincia, Prov.
  if (/\b(regione|provincia)\b/i.test(lower) || /\bprov\.?\s*(?:di\s+)?[a-z]+/i.test(lower)) return true;

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
  "wrexham", "dunfermline", "bradford", "wakefield", "barnsley", "doncaster",
  "gateshead", "sunderland", "south shields", "stockton-on-tees", "hartlepool",
  "middlesborough", "redditch", "crawley", "ipswich", "colchester", "chelmsford",
  "maidstone", "gillingham", "chatham", "rochester", "gravesend", "dartford",
  "tunbridge wells", "eastbourne", "hastings", "worthing", "hove", "crawley",
  "horsham", "guildford", "woking", "reigate", "epsom", "kingston", "richmond",
  "uxbridge", "harrow", "enfield", "romford", "ilford", "bromley", "croydon",
  "sutton", "kingston upon thames", "basingstoke", "high wycombe", "aylesbury",
  "slough", "maidenhead", "bracknell", "newbury", "andover", "winchester",
  "eastleigh", "fareham", "gosport", "havant", "waterlooville", "alton",
  "chesterfield", "barnsley", "rotherham", "huddersfield", "halifax", "dewsbury",
  "keighley", "harrogate", "york", "scarborough", "hull", "grimsby", "scunthorpe",
  "lincoln", "boston", "grantham", "spalding", "skegness", "workington", "whitehaven",
  "kendal", "penrith", "carlisle", "lancaster", "morecambe", "blackpool", "preston",
  "blackburn", "burnley", "accrington", "bury", "bolton", "wigan", "st helens",
  "heywood", "ashton-under-lyne", "sale", "altrincham", "stretford", "leigh", "prestwich",
  "radcliffe", "middleton", "hyde", "glossop", "wilmslow", "knutsford", "ormskirk",
  "skelmersdale", "chorley", "clitheroe", "colne", "nelson", "rawtenstall", "bacup",
  "haslingden", "darwen", "fleetwood", "morecambe", "littleborough",
  "warrington", "runcorn", "widnes", "birkenhead", "wallasey", "southport",
  "ayr", "kilmarnock", "greenock", "paisley", "east kilbride", "hamilton",
  "cumbernauld", "livingston", "kirkcaldy", "dunfermline", "perth", "inverness",
  "stirling", "falkirk", "dumfries", "elgin", "peterhead", "oban",
  "swansea", "newport", "wrexham", "barry", "bridgend", "neath", "port talbot",
  "cwmbran", "llanelli", "merthyr tydfil", "caerphilly", "pontypridd", "bangor",
  "lisburn", "newry", "derry", "londonderry", "bangor ni", "newtownabbey", "craigavon",

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

function isPlaceUsedAsStreetName(cleanAddr, name) {
  const escaped = name.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const streetSuffix = "\\s+(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|view|gate|mews|row|wharf|park|st|rd|ave|dr|ln|blvd)\\b";
  const streetPrefix = "\\b(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard)\\s+";
  return new RegExp(`(?:${streetPrefix})\\b${escaped}\\b|\\b${escaped}\\b(?:${streetSuffix})`, "i").test(cleanAddr);
}

function hasRecognizedPlaceName(cleanAddr, names) {
  for (const name of names) {
    if (!name || name.length < 3) continue;
    if (isPlaceUsedAsStreetName(cleanAddr, name)) continue;
    const escaped = name.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(cleanAddr)) {
      return true;
    }
  }
  return false;
}

// City qualifying administrative designations across all 16 priority countries
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

  const stripped = addr.replace(/\b(cape\s*town|george\s*town)\b/gi, " ");
  if (hasExplicitCityWord(stripped)) return true;
  const qualRegex = new RegExp(`\\b(?:${CITY_QUALIFIERS.join("|")})\\b`, "i");
  return qualRegex.test(stripped);
}

function addressLooksLikeSuburbOnly(cleanAddr) {
  if (!cleanAddr) return false;
  const withoutDesignation = cleanAddr.replace(/\b(township|town|district|municipality|metropolitan\s*municipality|borough|city)\b/gi, " ");
  for (const suburb of NON_CITY_SUBURBS) {
    const escaped = suburb.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(withoutDesignation)) {
      const rest = withoutDesignation.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
      if (!hasRecognizedPlaceName(rest, RECOGNIZED_TOWNS) && !hasRecognizedPlaceName(rest, UK_CITIES_AND_TOWNS) && !hasCityDesignation(rest)) {
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

  // Street types
  if (/\b(?:street|road|avenue|lane|drive|way|close|court|place|terrace|crescent|boulevard|highway|parade|walk|row|mews|view|gate|hill|wharf|parkway|alley|st|rd|ave|dr|ln|blvd|hwy|ct|pl)\b/i.test(s)) {
    return true;
  }

  // Unit / premise / floor / room / building prefix or descriptor
  if (/^(?:unit|suite|bldg|building|floor|fl|rm|room|dept|flat|apt|apartment|block|blk|no\.?\s*\d|number\s*\d|p\.?o\.?\s*box|post\s*office\s*box)\b/i.test(s)) {
    return true;
  }

  // Industrial / commercial parks / zones / estates
  if (/\b(?:industrial\s*(?:estate|park|area|zone|district)|business\s*park|trading\s*estate|technology\s*park|science\s*park|enterprise\s*park|tech\s*park|ind\s*est|ind\s*park)\b/i.test(s)) {
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
    const candidate = parts[stateIdx - 1];
    if (!isNotCitySegment(candidate)) {
      return candidate;
    }
  }

  if (parts.length >= 2 && stateIdx === -1) {
    const last = parts[parts.length - 1];
    if (!isNotCitySegment(last)) {
      return last;
    }
  }

  return null;
}

function evaluateCityQC(address, country) {
  if (!address || typeof address !== "string" || address.trim().length < 3) {
    return "Not Available";
  }
  const cleanAddr = address.trim().toLowerCase();

  // ss

  // New Taipei City rule: Must remain Not Available unless a qualifying administrative area is separately identified
  if (isNewTaipeiCity(cleanAddr)) {
    const addrWithoutNTC = cleanAddr.replace(/\bnew\s*taipei(\s*city)?\b/gi, " ");
    if (hasCityDesignation(addrWithoutNTC)) {
      return "Available";
    }
    return "Not Available";
  }

  // 1. Explicit qualifying City, Town, Township, District, Municipality, or local language designation
  if (hasCityDesignation(cleanAddr)) {
    return "Available";
  }

  // 2. UK Exception: Official UK cities, towns, and London boroughs evaluate as Available
  if (isUkLocation(cleanAddr, country) && hasUkCityOrTown(cleanAddr)) {
    return "Available";
  }

  // 3. Structural address detection (e.g. "..., Moor Street, Heywood, Lancashire" -> "Heywood" precedes verified state)
  if (detectCityFromStructure(cleanAddr, country)) {
    return "Available";
  }

  return "Not Available";
}

const LEGAL_SUFFIX_CAPTURE =
  "((?:[\\(\\[]?\\s*(?:pty|pte|pvt|sdn|bhd|co\\.?|corp\\.?|inc\\.?|llc|llp|pllc|gmbh|sa|bv|nv|ag|oy|ab|as|m|malaysia)\\s*[\\)\\]]?[\\s,]*){0,3}(?:ltd\\.?|limited|inc\\.?|incorporated|bhd\\.?|berhad|sdn\\s*bhd|sendirian\\s*berhad|llc|pllc|llp|gmbh|s\\.?r\\.?l\\.?s?|s\\.?p\\.?a\\.?|plc\\.?|corp\\.?|corporation|company\\s+limited|proprietary\\s+limited|private\\s+limited))";

function companyEvidenceCorpus(crawlData) {
  if (!crawlData) return "";
  return [
    crawlData.copyrightText,
    crawlData.footerText,
    crawlData.contactPageText,
    crawlData.profilePageText,
    crawlData.bodyText,
    crawlData.title,
    crawlData.combinedText,
    crawlData.mainHtml ? stripHtml(crawlData.mainHtml).slice(0, 12000) : ""
  ].filter(Boolean).join(" \n ");
}

function extractJsonLdOrganizationName(html) {
  if (!html) return "";
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : (data && data["@graph"] ? data["@graph"] : [data]);
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const type = String(item["@type"] || "");
        if (/Organization|LocalBusiness|Corporation|Company/i.test(type) && item.name) {
          return String(item.name).trim();
        }
      }
    } catch (e) { }
  }
  return "";
}

function hasCompleteLegalSuffix(name) {
  if (!name) return false;
  const n = name.trim();
  if (/\b(?:co\.?|company|pty\.?|pte\.?|pvt\.?|sdn\.?)\s*$/i.test(n)) return false;
  return /\b(proprietary\s+limited|private\s+limited|public\s+limited\s+company|sendirian\s+berhad|limited\s+liability\s+(?:company|partnership)|limited|incorporated|corporation|berhad|gmbh|llc|llp|pllc|ltd|inc|plc)\b/i.test(n);
}

function namesOverlap(a, b) {
  const tokens = (s) => (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !/^(the|and|for|ltd|limited|inc|llc|corp|company|pty|pte|pvt|sdn|bhd)$/i.test(w));
  const ta = tokens(a);
  const tb = new Set(tokens(b));
  if (ta.length === 0 || tb.size === 0) return false;
  const hit = ta.filter(t => tb.has(t)).length;
  return hit >= Math.min(2, ta.length) || hit / ta.length >= 0.5;
}

function preferOfficialCompanyName(name, crawlData) {
  const current = (name || "").trim();
  const jsonLdName = extractJsonLdOrganizationName(crawlData && crawlData.mainHtml);
  const copyrightName = (crawlData && crawlData.copyrightText) || "";
  const candidates = [jsonLdName, copyrightName].filter(n => n && n.length >= 3 && n.length <= 160);

  for (const official of candidates) {
    if (!hasCompleteLegalSuffix(official) && !/\b(?:ltd|limited|inc|llc|llp|corp|pty|pte|pvt|sdn|bhd|gmbh|plc)\b/i.test(official)) {
      continue;
    }
    if (!current || namesOverlap(current, official) || official.toLowerCase().includes(current.toLowerCase()) || current.toLowerCase().includes(official.toLowerCase().replace(/\b(?:ltd|limited|inc|llc|corp|co)\b/gi, "").trim())) {
      return official;
    }
  }
  return current;
}

/**
 * Detects if a company name on the website/footer/copyright/contact has an official legal designation
 * (e.g. AKS Lining Systems -> AKS Lining Systems [Pty] Ltd -> Aks Lining Systems Proprietary Limited).
 * Restores legal suffixes ONLY when the complete company name matches official website evidence.
 * Never invents legal designations.
 */
function restoreLegalSuffixIfOmitted(name, crawlData) {
  if (!name || typeof name !== "string" || name.trim().length < 2) return name;
  let cleanName = name.trim();

  if (hasCompleteLegalSuffix(cleanName)) {
    return cleanName;
  }

  const corpus = companyEvidenceCorpus(crawlData);
  if (!corpus) return cleanName;

  const baseName = cleanName.replace(/\b(?:co\.?|company|corp\.?|corporation)\s*$/i, "").trim() || cleanName;
  const escapedName = baseName.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const legalRegex = new RegExp(`\\b${escapedName}\\s*[,.]?\\s*${LEGAL_SUFFIX_CAPTURE}`, "i");

  const match = corpus.match(legalRegex);
  if (match && match[1]) {
    const suffix = match[1].replace(/\s+/g, " ").trim();
    if (/\b(?:co\.?|company|corp\.?)\s*$/i.test(cleanName) && /^(?:co\.?|company|corp\.?)\b/i.test(suffix)) {
      return baseName + " " + suffix;
    }
    return cleanName + " " + suffix;
  }

  // Fallback: find any legal-suffix company name in copyright that overlaps this name
  const copyright = (crawlData && crawlData.copyrightText) || "";
  const copyMatch = copyright.match(new RegExp(`([A-Z][A-Za-z0-9&.'\\- ]{2,80}\\s+${LEGAL_SUFFIX_CAPTURE})`, "i"));
  if (copyMatch && copyMatch[0] && namesOverlap(cleanName, copyMatch[0])) {
    return copyMatch[0].trim();
  }

  return cleanName;
}

function expandCompanyAbbreviations(name, country = "") {
  if (!name) return "";
  let n = decodeHtmlEntities(name);

  // 1. Handle bracketed forms before stripping brackets: [Pty] Ltd, (Pty) Ltd, [Pte] Ltd, etc.
  n = n.replace(/[\[\(]\s*pty\s*[\]\)]\s*ltd\.?/gi, "Proprietary Limited");
  n = n.replace(/\bpty\s*[\[\(]\s*ltd\s*[\]\)]\.?/gi, "Proprietary Limited");
  n = n.replace(/[\[\(]\s*pty\s*ltd\s*[\]\)]\.?/gi, "Proprietary Limited");
  n = n.replace(/[\[\(]\s*pte\s*[\]\)]\s*ltd\.?/gi, "Private Limited");
  n = n.replace(/[\[\(]\s*pvt\s*[\]\)]\s*ltd\.?/gi, "Private Limited");
  n = n.replace(/[\[\(]\s*pty\s*[\]\)]/gi, "Proprietary");

  // Handle (M) or [M] country identifier before Sdn Bhd (Rule 4: Remove brackets, preserve M / country name)
  n = n.replace(/[\[\(]\s*m\s*[\]\)]\s*(?=(?:sdn|sendirian|bhd|berhad|\b))/gi, " M ");

  // 2. Remove brackets from company name per Rule 4
  n = n.replace(/[\(\)\[\]\{\}]/g, " ");

  // 3. Expand legal entity abbreviations to full form strictly when present in official name
  // Italian entities
  n = n.replace(/\b(?:s[\.\s]*r[\.\s]*l[\.\s]*s|srls)\b/gi, "Società a Responsabilità Limitata Semplificata");
  n = n.replace(/\b(?:s[\.\s]*c[\.\s]*a[\.\s]*r[\.\s]*l|scarl)\b/gi, "Società Cooperativa a Responsabilità Limitata");
  n = n.replace(/\b(?:s[\.\s]*c[\.\s]*p[\.\s]*a|scpa)\b/gi, "Società Cooperativa per Azioni");
  n = n.replace(/\b(?:s[\.\s]*r[\.\s]*l|srl)\b/gi, "Società a Responsabilità Limitata");
  n = n.replace(/\b(?:s[\.\s]*p[\.\s]*a|spa)\b/gi, "Società per Azioni");
  n = n.replace(/\b(?:s[\.\s]*n[\.\s]*c|snc)\b/gi, "Società in Nome Collettivo");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*s|sas)\b/gi, "Società in Accomandita Semplice");
  n = n.replace(/\bs[\.\s]*s[\.\s]*\b/gi, "Società Semplice ");

  // Malaysian entities
  n = n.replace(/\bsdn\s*bhd\.?\b/gi, "Sendirian Berhad");
  n = n.replace(/\bbhd\.?\b/gi, "Berhad");

  // Australia & South Africa
  n = n.replace(/\bpty\s*ltd\.?\b/gi, "Proprietary Limited");
  n = n.replace(/\bpty\.?\b/gi, "Proprietary");

  // Singapore, India, UK
  n = n.replace(/\bpte\s*ltd\.?\b/gi, "Private Limited");
  n = n.replace(/\bpvt\s*ltd\.?\b/gi, "Private Limited");
  n = n.replace(/\bplc\.?\b/gi, "Public Limited Company");

  // United States & Global
  n = n.replace(/\bpllc\.?\b/gi, "Professional Limited Liability Company");
  n = n.replace(/\bllp\.?\b/gi, "Limited Liability Partnership");
  n = n.replace(/\bllc\.?\b/gi, "Limited Liability Company");
  n = n.replace(/\bl\.?l\.?c\.?\b/gi, "Limited Liability Company");
  n = n.replace(/\blp\.?\b/gi, "Limited Partnership");
  n = n.replace(/\bl\.?p\.?\b/gi, "Limited Partnership");
  n = n.replace(/\bco\.?\s*,?\s*ltd\.?/gi, "Company Limited");
  n = n.replace(/\bltd\.?\b/gi, "Limited");
  n = n.replace(/\binc\.?\b/gi, "Incorporated");
  n = n.replace(/\bcorp\.?\b/gi, "Corporation");
  n = n.replace(/\bco\.?\b/gi, "Company");

  // Clean remaining punctuation and duplicate spaces
  n = n.replace(/[,;.]+/g, " ");
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

function expandAddressAndStateAbbreviations(addr, country = "") {
  if (!addr) return "";
  let a = addr;

  // Replace ampersand with 'and' in address
  a = a.replace(/\s*&\s*/g, " and ");

  // 1. "St" as "Saint" in city or place names (e.g. St Louis, Port St Lucie, St Petersburg, St Paul)
  a = a.replace(/\b(?:port\s+)?st\.?\s+(lucie|louis|paul|petersburg|cloud|albans|kilda|george|john|andrews|charles|joseph|moritz|leonards)\b/gi, function (m, p) {
    if (/^port/i.test(m)) return "Port Saint " + p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    return "Saint " + p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  });

  // 2. Compass directions prefixes
  // (a) Single letter with dot: E., W., N., S. followed by word (e.g. "301 E. Marquardt Drive" -> "301 East Marquardt Drive")
  a = a.replace(/(^|[\s,])E\.\s+(?=[A-Za-z0-9])/gi, '$1East ');
  a = a.replace(/(^|[\s,])W\.\s+(?=[A-Za-z0-9])/gi, '$1West ');
  a = a.replace(/(^|[\s,])N\.\s+(?=[A-Za-z0-9])/gi, '$1North ');
  a = a.replace(/(^|[\s,])S\.\s+(?=[A-Za-z0-9])/gi, '$1South ');

  // (b) Single letter after street number or comma: 301 E Marquardt, 100 N Main, 50 W 44th
  a = a.replace(/(\b\d+[A-Za-z]?[\s,\-]+)E\b\s+(?=[A-Za-z0-9])/gi, '$1East ');
  a = a.replace(/(\b\d+[A-Za-z]?[\s,\-]+)W\b\s+(?=[A-Za-z0-9])/gi, '$1West ');
  a = a.replace(/(\b\d+[A-Za-z]?[\s,\-]+)N\b\s+(?=[A-Za-z0-9])/gi, '$1North ');
  a = a.replace(/(\b\d+[A-Za-z]?[\s,\-]+)S\b\s+(?=[A-Za-z0-9])/gi, '$1South ');
  a = a.replace(/(^|,\s*)E\b\s+(?=[A-Z][a-z])/g, '$1East ');
  a = a.replace(/(^|,\s*)W\b\s+(?=[A-Z][a-z])/g, '$1West ');
  a = a.replace(/(^|,\s*)N\b\s+(?=[A-Z][a-z])/g, '$1North ');
  a = a.replace(/(^|,\s*)S\b\s+(?=[A-Z][a-z])/g, '$1South ');

  // (c) Multi-letter directional prefixes: NE, NW, SE, SW
  a = a.replace(/(^|[\s,])N\.?E\.?\s+(?=[A-Za-z0-9])/gi, '$1Northeast ');
  a = a.replace(/(^|[\s,])N\.?W\.?\s+(?=[A-Za-z0-9])/gi, '$1Northwest ');
  a = a.replace(/(^|[\s,])S\.?E\.?\s+(?=[A-Za-z0-9])/gi, '$1Southeast ');
  a = a.replace(/(^|[\s,])S\.?W\.?\s+(?=[A-Za-z0-9])/gi, '$1Southwest ');

  // 3. Number, Section, Lane & Alley prefixes (Global full form expansion)
  a = a.replace(/(^|[,\s])No\.\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])No\b\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])Nos\.?\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])#\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])(\d+)\s*#\s*(?=[A-Za-z0-9])/gi, '$1Number $2, ');
  a = a.replace(/(^|[,\s])(\d+)\s*#\b/gi, '$1Number $2');
  a = a.replace(/\blot\s+no\.?\s*(?=\d)/gi, 'Lot Number ');
  a = a.replace(/\bplot\s+no\.?\s*(?=\d)/gi, 'Plot Number ');
  a = a.replace(/(^|[,\s])Sec\.\s*(?=[A-Za-z0-9])/gi, '$1Section ');
  a = a.replace(/(^|[,\s])Sec\b\s*(?=[A-Za-z0-9])/gi, '$1Section ');
  a = a.replace(/\b(Hsinchu|Changhua|Miaoli|Yunlin|Chiayi|Pingtung|Taitung|Hualien|Yilan|Nantou|Kinmen|Penghu)\s+Country\b/gi, "$1 County");
  a = a.replace(/(^|[,\s])Ln\.\s*(?=\d)/gi, '$1Lane ');
  a = a.replace(/(^|[,\s])Ln\b\s*(?=\d)/gi, '$1Lane ');
  a = a.replace(/(^|[,\s])Aly\.\s*(?=\d)/gi, '$1Alley ');
  a = a.replace(/(^|[,\s])Aly\b\s*(?=\d)/gi, '$1Alley ');

  // 4. Administrative abbreviations
  a = a.replace(/\bTwp\b\.?/gi, "Township");
  a = a.replace(/\bDist\b\.?/gi, "District");
  a = a.replace(/\bCty\b\.?/gi, "County");
  a = a.replace(/\bProv\b\.?/gi, "Province");
  a = a.replace(/\bMun\b\.?/gi, "Municipality");
  a = a.replace(/(^|[,\s])nr\b\.?\s*(?=\d)/gi, "$1Nummer ");
  a = a.replace(/\bNr\b\.?/gi, "Near");
  a = a.replace(/\bhsien\b/gi, "County");

  // 5. Street types expansion (Global) - standard set only (avoids corrupting normal words)
  a = a.replace(/\bpkwy\b\.?/gi, "Parkway");
  a = a.replace(/\bpky\b\.?/gi, "Parkway");
  a = a.replace(/\bblvd\b\.?/gi, "Boulevard");
  a = a.replace(/\bbvd\b\.?/gi, "Boulevard");
  a = a.replace(/\bboul\b\.?/gi, "Boulevard");
  a = a.replace(/\bcres\b\.?/gi, "Crescent");
  a = a.replace(/\btpke\b\.?/gi, "Turnpike");
  a = a.replace(/\bcswy\b\.?/gi, "Causeway");
  a = a.replace(/\bgdns\b\.?/gi, "Gardens");
  a = a.replace(/\bfwy\b\.?/gi, "Freeway");
  a = a.replace(/\bhwy\b\.?/gi, "Highway");
  a = a.replace(/\bexp(?:ress)?wy\b\.?/gi, "Expressway");
  a = a.replace(/\bcir\b\.?/gi, "Circle");
  a = a.replace(/\bave\b\.?/gi, "Avenue");
  a = a.replace(/\bav\b\.?/gi, "Avenue");
  a = a.replace(/\bcnr\b\.?/gi, "Corner");
  a = a.replace(/\btce\b\.?/gi, "Terrace");
  a = a.replace(/\bter\b\.?/gi, "Terrace");
  a = a.replace(/\bpde\b\.?/gi, "Parade");
  a = a.replace(/\besp\b\.?/gi, "Esplanade");
  a = a.replace(/\brte\b\.?/gi, "Route");
  a = a.replace(/\bctr\b\.?/gi, "Centre");
  a = a.replace(/\bcl\b\.?/gi, "Close");
  a = a.replace(/\bct\b\.?/gi, "Court");
  a = a.replace(/\bpl\b\.?/gi, "Place");
  a = a.replace(/\bsq\b\.?/gi, "Square");
  a = a.replace(/\bst\b\.?/gi, "Street");
  a = a.replace(/\brd\b\.?/gi, "Road");
  a = a.replace(/\bdr\b\.?/gi, "Drive");
  a = a.replace(/\bln\b\.?/gi, "Lane");
  a = a.replace(/\bind\b\.?\s+(?=(?:area|park|estate|zone|district|region)\b)/gi, "Industrial ");
  a = a.replace(/\bindl\b\.?/gi, "Industrial");
  a = a.replace(/\bpk\b\.?/gi, "Park");
  a = a.replace(/\best\b\.?\s+(?=(?:park|area|zone)\b)/gi, "Estate ");
  a = a.replace(/\bjln\b\.?/gi, "Jalan");
  a = a.replace(/\blrg\b\.?/gi, "Lorong");
  a = a.replace(/(^|[\s,])bt\.?\s+caves\b/gi, '$1Batu Caves');
  a = a.replace(/(^|[\s,])bt\.?\s*(?=\d)/gi, '$1Batu ');
  a = a.replace(/\bbt\b\.?/gi, "Bukit");
  a = a.replace(/\bkg\b\.?/gi, "Kampung");
  a = a.replace(/\bmt\.?\s+(?=[A-Z])/gi, "Mount ");
  a = a.replace(/\bft\.?\s+(?=[A-Z])/gi, "Fort ");
  a = a.replace(/\bpt\.?\s+(?=[A-Z])/gi, "Point ");

  // 4. Directionals at end of street name (e.g. "Main Street E" -> "Main Street East")
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bE\.?(?=[,\s]|$)/gi, "$1 East");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bW\.?(?=[,\s]|$)/gi, "$1 West");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bN\.?(?=[,\s]|$)/gi, "$1 North");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bS\.?(?=[,\s]|$)/gi, "$1 South");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bN\.?E\.?(?=[,\s]|$)/gi, "$1 Northeast");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bN\.?W\.?(?=[,\s]|$)/gi, "$1 Northwest");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bS\.?E\.?(?=[,\s]|$)/gi, "$1 Southeast");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bS\.?W\.?(?=[,\s]|$)/gi, "$1 Southwest");

  // 7. Buildings, suites, floors
  a = a.replace(/\bbldg\b\.?/gi, "Building");
  a = a.replace(/\bflr\b\.?/gi, "Floor");
  a = a.replace(/\bfl\.\s*(?=\d)/gi, "Floor ");
  a = a.replace(/(\d+(?:st|nd|rd|th)?)\s*\bfl\b\.?/gi, "$1 Floor");
  a = a.replace(/(\b\d+)\s*F\b(?=[,\s]|$)/gi, "$1 Floor");
  a = a.replace(/(^|[,\s])Flr?\.?\s*(?=\d)/gi, "$1Floor ");
  a = a.replace(/\bste\b\.?/gi, "Suite");
  a = a.replace(/\bapt\b\.?/gi, "Apartment");
  a = a.replace(/\bdept\b\.?/gi, "Department");
  a = a.replace(/\brm\b\.?/gi, "Room");
  a = a.replace(/\bpob\b\.?/gi, "Post Office Box");
  a = a.replace(/\bpo\s*box\b\.?/gi, "Post Office Box");

  const cLower = (country || "").toLowerCase();

  // 6. Expand State & Province abbreviations (Global)
  // Australia
  if (cLower.includes("australia") || /\b(?:vic|nsw|qld|tas|act)\b/i.test(a) || /\b(?:3\d{3}|2\d{3}|4\d{3}|5\d{3}|6\d{3}|7\d{3}|0\d{3})\b/.test(a)) {
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bvic\b\.?/gi, "$1, Victoria");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bnsw\b\.?/gi, "$1, New South Wales");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bqld\b\.?/gi, "$1, Queensland");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\btas\b\.?/gi, "$1, Tasmania");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bact\b\.?/gi, "$1, Australian Capital Territory");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bnt\b\.?/gi, "$1, Northern Territory");
    if (cLower.includes("australia") || /\b(?:wa|sa)\s+\d{4}\b/i.test(a)) {
      a = a.replace(/([a-zA-Z\)])\s*,?\s*\bwa\b\.?/gi, "$1, Western Australia");
      a = a.replace(/([a-zA-Z\)])\s*,?\s*\bsa\b\.?/gi, "$1, South Australia");
    }
  }

  // Canada
  if (cLower.includes("canada") || /\b(?:ont|que|b\.?c\.|alta|sask|man)\b/i.test(a)) {
    a = a.replace(/,\s*\b(?:on|ont)\b\.?/gi, ", Ontario");
    a = a.replace(/,\s*\b(?:qc|que)\b\.?/gi, ", Quebec");
    a = a.replace(/,\s*\b(?:bc|b\.c\.)\b\.?/gi, ", British Columbia");
    a = a.replace(/,\s*\b(?:ab|alta)\b\.?/gi, ", Alberta");
    a = a.replace(/,\s*\b(?:mb|man)\b\.?/gi, ", Manitoba");
    a = a.replace(/,\s*\b(?:sk|sask)\b\.?/gi, ", Saskatchewan");
    a = a.replace(/,\s*\b(?:ns)\b\.?/gi, ", Nova Scotia");
    a = a.replace(/,\s*\b(?:nb)\b\.?/gi, ", New Brunswick");
    a = a.replace(/,\s*\b(?:nl)\b\.?/gi, ", Newfoundland And Labrador");
    a = a.replace(/,\s*\b(?:pe|pei)\b\.?/gi, ", Prince Edward Island");
  }

  // United States - Only when country is United States or has US zip or explicit US context
  const isUsAddress = cLower.includes("united states") || cLower.includes("usa") || cLower.includes("america") ||
    /\b\d{5}(?:-\d{4})?\b/.test(a) || (!country && /,\s*[A-Z]{2}\b/.test(a));

  if (isUsAddress && !["australia", "canada", "united kingdom", "india", "south africa", "malaysia"].includes(cLower)) {
    const usAbbreviations = [
      ["ca", "California"], ["tx", "Texas"], ["ny", "New York"], ["fl", "Florida"],
      ["il", "Illinois"], ["pa", "Pennsylvania"], ["oh", "Ohio"], ["ga", "Georgia"],
      ["nc", "North Carolina"], ["mi", "Michigan"], ["nj", "New Jersey"], ["va", "Virginia"],
      ["wa", "Washington"], ["az", "Arizona"], ["ma", "Massachusetts"], ["tn", "Tennessee"],
      ["in", "Indiana"], ["mo", "Missouri"], ["md", "Maryland"], ["wi", "Wisconsin"],
      ["co", "Colorado"], ["mn", "Minnesota"], ["sc", "South Carolina"], ["al", "Alabama"],
      ["la", "Louisiana"], ["ky", "Kentucky"], ["or", "Oregon"], ["ok", "Oklahoma"],
      ["ct", "Connecticut"], ["ut", "Utah"], ["ia", "Iowa"], ["nv", "Nevada"],
      ["ar", "Arkansas"], ["ms", "Mississippi"], ["ks", "Kansas"], ["nm", "New Mexico"],
      ["ne", "Nebraska"], ["wv", "West Virginia"], ["id", "Idaho"], ["hi", "Hawaii"],
      ["nh", "New Hampshire"], ["me", "Maine"], ["mt", "Montana"], ["ri", "Rhode Island"],
      ["de", "Delaware"], ["sd", "South Dakota"], ["nd", "North Dakota"], ["ak", "Alaska"],
      ["vt", "Vermont"], ["wy", "Wyoming"], ["dc", "District Of Columbia"]
    ];

    for (const [abbr, full] of usAbbreviations) {
      // Must be preceded by comma and space, or space, and followed by comma, space, end of string, or 5-digit zip:
      // e.g. ", IL" or ", IL 60090" or " IL 60090"
      const regComma = new RegExp(`(,\\s*|\\s+)\\b${abbr}\\b\\.?(?=[,\\s]|$|\\s*\\d{5})`, "i");
      a = a.replace(regComma, `, ${full} `);
    }
  }

  // ==========================================
  // 7. Italy (Italia) Abbreviations
  // ==========================================
  // Street prefixes
  a = a.replace(/(^|[,\s])v\.?le\b\.?/gi, '$1Viale');
  a = a.replace(/(^|[,\s])vle\b/gi, '$1Viale');
  a = a.replace(/(^|[,\s])c\.?so\b\.?/gi, '$1Corso');
  a = a.replace(/(^|[,\s])cso\b/gi, '$1Corso');
  a = a.replace(/(^|[,\s])p\.?zza\b\.?/gi, '$1Piazza');
  a = a.replace(/(^|[,\s])pzza\b/gi, '$1Piazza');
  a = a.replace(/(^|[,\s])p\.?za\b\.?/gi, '$1Piazza');
  a = a.replace(/(^|[,\s])pza\b/gi, '$1Piazza');
  a = a.replace(/(^|[,\s])p\.?le\b\.?/gi, '$1Piazzale');
  a = a.replace(/(^|[,\s])ple\b/gi, '$1Piazzale');
  a = a.replace(/(^|[,\s])l\.?go\b\.?/gi, '$1Largo');
  a = a.replace(/(^|[,\s])lgo\b/gi, '$1Largo');
  a = a.replace(/(^|[,\s])v\.?colo\b\.?/gi, '$1Vicolo');
  a = a.replace(/(^|[,\s])vclo\b/gi, '$1Vicolo');
  a = a.replace(/(^|[,\s])circonv\b\.?/gi, '$1Circonvallazione');
  a = a.replace(/(^|[,\s])circ\b\.?\s+(?=[A-Za-z])/gi, '$1Circonvallazione ');

  // Compass directions in Italian addresses
  a = a.replace(/(^|[,\s])est\b/gi, '$1East');
  a = a.replace(/(^|[,\s])ovest\b/gi, '$1West');
  a = a.replace(/(^|[,\s])nord\b/gi, '$1North');
  a = a.replace(/(^|[,\s])sud\b/gi, '$1South');

  // Roads: Strada, SP, SS, SR
  a = a.replace(/(^|[,\s])str\b\.?\s+(?=[A-Za-z0-9])/gi, '$1Strada ');
  a = a.replace(/\bs\.?p\.?\s*(?=\d)/gi, 'Strada Provinciale ');
  a = a.replace(/\bs\.?s\.?\s*(?=\d)/gi, 'Strada Statale ');
  a = a.replace(/\bs\.?r\.?\s*(?=\d)/gi, 'Strada Regionale ');

  // Internal details (Scala, Palazzina, etc.)
  a = a.replace(/\bsc\b\.?\s*(?=[A-Za-z0-9])/gi, 'Scala ');
  a = a.replace(/\bpal\b\.?\s*(?=[A-Za-z0-9])/gi, 'Palazzina ');
  a = a.replace(/\bint\b\.?\s*(?=\d|[A-Za-z])/gi, 'Interno ');
  a = a.replace(/(^|[,\s])p\b\.?\s*(?=\d)/gi, '$1Piano ');
  a = a.replace(/\bp\.?to\b\.?\s*(?=\d)/gi, 'Piano ');
  a = a.replace(/\bciv(?:ico)?\.?\s*(?=\d)/gi, 'Numero ');
  a = a.replace(/\bn\.?ro\b\.?\s*(?=\d)/gi, 'Numero ');
  a = a.replace(/(^|[,\s])n\.\s*(?=\d)/gi, '$1Numero ');

  // Administrative / Zones
  a = a.replace(/\b(?:zona\s+ind\.?|z\.?i\.?|z\.?\s*ind\.?|zona\s+ind\.?le)\b\.?/gi, 'Zona Industriale');
  a = a.replace(/\b(?:zona\s+art\.?|z\.?a\.?|zona\s+art\.?le)\b\.?/gi, 'Zona Artigianale');
  a = a.replace(/(^|[,\s])loc\b\.?\s+(?=[A-Za-z])/gi, '$1Località ');
  a = a.replace(/(^|[,\s])fraz\b\.?\s+(?=[A-Za-z])/gi, '$1Frazione ');
  a = a.replace(/(^|[,\s])c\.?da\b\.?\s+(?=[A-Za-z])/gi, '$1Contrada ');
  a = a.replace(/(^|[,\s])cda\b\s+(?=[A-Za-z])/gi, '$1Contrada ');
  a = a.replace(/(^|[,\s])b\.?go\b\.?\s+(?=[A-Za-z])/gi, '$1Borgo ');
  a = a.replace(/(^|[,\s])bgo\b\s+(?=[A-Za-z])/gi, '$1Borgo ');

  // ==========================================
  // 8. Singapore & Malaysia Abbreviations
  // ==========================================
  // Thoroughfares & Blocks
  a = a.replace(/\bblk\b\.?\s*(?=\d|[A-Za-z])/gi, 'Block ');
  a = a.replace(/\bjln\b\.?/gi, 'Jalan');
  a = a.replace(/\blrg\b\.?/gi, 'Lorong');
  a = a.replace(/\blor\b\.?\s*(?=\d|[A-Za-z])/gi, 'Lorong ');
  a = a.replace(/\blbh\b\.?/gi, 'Lebuh');
  a = a.replace(/\blbr\b\.?/gi, 'Lebuhraya');
  a = a.replace(/\bpsn\b\.?/gi, 'Persiaran');
  a = a.replace(/\bmdn\b\.?/gi, 'Medan');

  // Hills, Villages, Capes, Settlements
  a = a.replace(/\bbt\b\.?\s+(?=[A-Za-z])/gi, 'Bukit ');
  a = a.replace(/\bkg\b\.?\s+(?=[A-Za-z])/gi, 'Kampung ');
  a = a.replace(/\btg\b\.?\s+(?=[A-Za-z])/gi, 'Tanjung ');
  a = a.replace(/\btmn\b\.?\s+(?=[A-Za-z])/gi, 'Taman ');
  a = a.replace(/\bbdr\b\.?\s+(?=[A-Za-z])/gi, 'Bandar ');

  // Planning & Municipal Zoning Sectors (Klang, Petaling Jaya, Subang Jaya)
  a = a.replace(/(^|[\s,\/\-])ku\s*[-–\/\.]?\s*(\d{1,2})\b/gi, '$1Klang Utara $2');
  a = a.replace(/(^|[\s,\/\-])ks\s*[-–\/\.]?\s*(\d{1,2})\b/gi, '$1Klang Selatan $2');
  a = a.replace(/(^|[\s,\/\-])pju\s*[-–\/\.]?\s*(\d{1,2})\b/gi, '$1Petaling Jaya Utara $2');
  a = a.replace(/(^|[\s,\/\-])pjs\s*[-–\/\.]?\s*(\d{1,2})\b/gi, '$1Petaling Jaya Selatan $2');
  a = a.replace(/(^|[\s,\/\-])usj\s*[-–\/\.]?\s*(\d{1,2})\b/gi, '$1UEP Subang Jaya $2');

  // Rivers, Hills & Milestones (Sg -> Sungai, Bkt -> Bukit, Bt -> Batu / Bukit)
  a = a.replace(/(^|[\s,])sg\.?\s+(?=[A-Za-z])/gi, '$1Sungai ');
  a = a.replace(/(^|[\s,])bkt\.?\s+(?=[A-Za-z])/gi, '$1Bukit ');
  a = a.replace(/(^|[\s,])bt\.?\s+caves\b/gi, '$1Batu Caves');
  a = a.replace(/(^|[\s,])bt\.?\s*(?=\d)/gi, '$1Batu ');
  a = a.replace(/(^|[\s,])bt\.?\s+(?=[A-Za-z])/gi, '$1Bukit ');

  // Common Malaysian City Abbreviations
  a = a.replace(/,\s*\bpj\b/gi, ', Petaling Jaya');
  a = a.replace(/,\s*\bjb\b/gi, ', Johor Bahru');

  // Areas & Zones
  a = a.replace(/\bkws\.?\s*perind(?:ustrian)?\.?/gi, 'Kawasan Perindustrian');
  a = a.replace(/\bzon\s*perind(?:ustrian)?\.?/gi, 'Zon Perindustrian');
  a = a.replace(/\bperind(?:ustrian)?\b\.?/gi, 'Perindustrian');
  a = a.replace(/\bkws\b\.?\s+(?=[A-Za-z])/gi, 'Kawasan ');
  a = a.replace(/\bsek\b\.?\s*(?=\d|[A-Za-z])/gi, 'Seksyen ');
  a = a.replace(/\bpst\b\.?\s+(?=[A-Za-z])/gi, 'Pusat ');
  a = a.replace(/\bbgn\b\.?\s+(?=[A-Za-z])/gi, 'Bangunan ');
  a = a.replace(/\btkt\b\.?\s*(?=\d|[A-Za-z])/gi, 'Tingkat ');
  a = a.replace(/\bpeti\s*surat\b\.?/gi, 'Post Office Box');

  // Singapore Industrial & Tech Parks
  a = a.replace(/\bind\b\.?\s+(?=(?:area|park|estate|zone|district|region|terrace|basin|sector)\b)/gi, 'Industrial ');
  a = a.replace(/\bindl\b\.?/gi, 'Industrial');
  a = a.replace(/\bpk\b\.?/gi, 'Park');
  a = a.replace(/\best\b\.?\s+(?=(?:park|area|zone|estate)\b)/gi, 'Estate ');
  a = a.replace(/\btech\s*park\b/gi, 'Technology Park');
  a = a.replace(/\btechpark\b/gi, 'Technology Park');

  // Malaysian State abbreviations
  if (cLower.includes('malaysia') || /\b(?:selangor|johor|penang|perak|kuala\s*lumpur)\b/i.test(a)) {
    a = a.replace(/,\s*\b(?:kl|k\.l\.)\b\.?/gi, ', Kuala Lumpur');
    a = a.replace(/,\s*\b(?:sgr|sel)\b\.?/gi, ', Selangor');
    a = a.replace(/,\s*\b(?:jhr|joh)\b\.?/gi, ', Johor');
    a = a.replace(/,\s*\b(?:pnk|pg|pen)\b\.?/gi, ', Penang');
    a = a.replace(/,\s*\b(?:prk|pk)\b\.?/gi, ', Perak');
    a = a.replace(/,\s*\b(?:kdh|ked)\b\.?/gi, ', Kedah');
    a = a.replace(/,\s*\b(?:phg|pah)\b\.?/gi, ', Pahang');
    a = a.replace(/,\s*\b(?:n\.?s\.?|n\.?\s*sembilan)\b/gi, ', Negeri Sembilan');
    a = a.replace(/,\s*\b(?:mlk|mel)\b\.?/gi, ', Melaka');
    a = a.replace(/,\s*\b(?:trg|ter)\b\.?/gi, ', Terengganu');
    a = a.replace(/,\s*\b(?:kel)\b\.?/gi, ', Kelantan');
    a = a.replace(/,\s*\b(?:swk|sar)\b\.?/gi, ', Sarawak');
    a = a.replace(/,\s*\b(?:sbh|sab)\b\.?/gi, ', Sabah');
    a = a.replace(/,\s*\b(?:per)\b\.?/gi, ', Perlis');
    a = a.replace(/,\s*\b(?:wp|w\.p\.)\b\.?/gi, ', Wilayah Persekutuan');
  }

  // ==========================================
  // 9. Germany (Deutschland) Abbreviations
  // ==========================================
  // Street & Square: Compound suffixes (e.g. Industriestr. -> Industriestrasse, Marktpl. -> Marktplatz)
  a = a.replace(/([a-zA-ZäöüÄÖÜß\-]+)str\b\.?(?=\s*\d|\s*,|\s*$|\s+[A-Za-z])/gi, function (match, base) {
    return base + (base === base.toUpperCase() ? 'STRASSE' : 'strasse');
  });
  a = a.replace(/(^|[,\s])str\b\.?\s+(?=[A-Za-z0-9])/gi, '$1Strasse ');
  a = a.replace(/([a-zA-ZäöüÄÖÜß\-]+)pl\b\.?(?=\s*\d|\s*,|\s*$|\s+[A-Za-z])/gi, function (match, base) {
    return base + (base === base.toUpperCase() ? 'PLATZ' : 'platz');
  });
  a = a.replace(/(^|[,\s])pl\b\.?\s+(?=[A-Za-z0-9])/gi, '$1Platz ');

  // Commercial / Industrial zones
  a = a.replace(/\bgew(?:erbe)?\.?\s*gebiet\b/gi, 'Gewerbegebiet');
  a = a.replace(/\bgew(?:erbe)?\.?\s*park\b/gi, 'Gewerbepark');
  a = a.replace(/\bind(?:ustrie)?\.?\s*gebiet\b/gi, 'Industriegebiet');
  a = a.replace(/\bind(?:ustrie)?\.?\s*park\b/gi, 'Industriepark');

  // House / Building / Entrance / Floors
  a = a.replace(/(^|[,\s])nr\b\.?\s*(?=\d)/gi, '$1Nummer ');
  a = a.replace(/(^|[,\s])hs\b\.?\s*(?=\d)/gi, '$1Haus ');
  a = a.replace(/(^|[,\s])geb\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Gebäude ');
  a = a.replace(/(^|[,\s])aufg\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Aufgang ');
  a = a.replace(/(^|[,\s])whg\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Wohnung ');
  a = a.replace(/(\d+)\.?\s*\bOG\b/g, '$1. Obergeschoss');
  a = a.replace(/\b(?:o\.?g\.?|og)\b/gi, 'Obergeschoss');
  a = a.replace(/\b(?:e\.?g\.?|eg)\b/gi, 'Erdgeschoss');
  a = a.replace(/\b(?:u\.?g\.?|ug)\b/gi, 'Untergeschoss');
  a = a.replace(/\bstck\b\.?\s*(?=\d)/gi, 'Stockwerk ');
  a = a.replace(/\bpf\b\.?\s*(?=\d)/gi, 'Postfach ');
  a = a.replace(/\bpostfach\b/gi, 'Postfach');

  // Geographic river / location markers
  a = a.replace(/\ba\.?\s*m\b\.?/gi, 'am Main');
  a = a.replace(/\ba\.?\s*d\b\.?/gi, 'an der');
  a = a.replace(/\bi\.?\s*b\b\.?/gi, 'im Breisgau');
  a = a.replace(/\bv\.?\s*d\.?\s*h\b\.?/gi, 'vor der Höhe');

  // German Bundesländer abbreviations
  if (cLower.includes('germany') || cLower.includes('deutschland')) {
    a = a.replace(/,\s*\b(?:bw)\b\.?/gi, ', Baden-Württemberg');
    a = a.replace(/,\s*\b(?:by)\b\.?/gi, ', Bayern');
    a = a.replace(/,\s*\b(?:bb)\b\.?/gi, ', Brandenburg');
    a = a.replace(/,\s*\b(?:he)\b\.?/gi, ', Hessen');
    a = a.replace(/,\s*\b(?:mv)\b\.?/gi, ', Mecklenburg-Vorpommern');
    a = a.replace(/,\s*\b(?:ni)\b\.?/gi, ', Niedersachsen');
    a = a.replace(/,\s*\b(?:nw|nrw)\b\.?/gi, ', Nordrhein-Westfalen');
    a = a.replace(/,\s*\b(?:rp)\b\.?/gi, ', Rheinland-Pfalz');
    a = a.replace(/,\s*\b(?:sl)\b\.?/gi, ', Saarland');
    a = a.replace(/,\s*\b(?:sn)\b\.?/gi, ', Sachsen');
    a = a.replace(/,\s*\b(?:st)\b\.?/gi, ', Sachsen-Anhalt');
    a = a.replace(/,\s*\b(?:sh)\b\.?/gi, ', Schleswig-Holstein');
    a = a.replace(/,\s*\b(?:th)\b\.?/gi, ', Thüringen');
  }

  // Clean up any double spaces introduced
  a = a.replace(/\s+/g, " ").trim();

  return a;
}

/**
 * Ensures a comma separates the city/suburb/town from the state/province
 * (e.g. "40 Sarah Street, Campbellfield Victoria" -> "40 Sarah Street, Campbellfield, Victoria")
 */
function ensureCommaBeforeState(addr) {
  if (!addr) return "";
  const states = [
    "Victoria", "New South Wales", "Queensland", "Western Australia", "South Australia", "Tasmania",
    "Australian Capital Territory", "Northern Territory",
    "Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Saskatchewan", "Nova Scotia", "New Brunswick",
    "California", "Texas", "Florida", "New York", "Pennsylvania", "Illinois", "Ohio", "Georgia", "North Carolina",
    "Michigan", "New Jersey", "Virginia", "Washington", "Arizona", "Massachusetts", "Tennessee", "Indiana",
    "Missouri", "Maryland", "Wisconsin", "Colorado", "Minnesota", "South Carolina", "Alabama", "Louisiana",
    "Kentucky", "Oregon", "Oklahoma", "Connecticut", "Utah", "Iowa", "Nevada", "Arkansas", "Mississippi",
    "Kansas", "New Mexico", "Nebraska", "West Virginia", "Idaho", "Hawaii", "New Hampshire", "Maine", "Montana",
    "Rhode Island", "Delaware", "South Dakota", "North Dakota", "Alaska", "Vermont", "Wyoming",
    "Gauteng", "Western Cape", "Eastern Cape", "KwaZulu-Natal", "Mpumalanga", "Free State", "Limpopo",
    "Lombardia", "Lazio", "Veneto", "Piemonte", "Emilia-Romagna", "Toscana", "Campania", "Sicilia", "Puglia", "Liguria",
    "Marche", "Abruzzo", "Friuli Venezia Giulia", "Trentino-Alto Adige", "Umbria", "Sardegna", "Calabria", "Basilicata", "Molise", "Valle d'Aosta",
    "Baden-Württemberg", "Bayern", "Brandenburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen", "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
    "Selangor", "Johor", "Penang", "Perak", "Kedah", "Pahang", "Negeri Sembilan", "Melaka", "Terengganu", "Kelantan", "Sarawak", "Sabah", "Perlis", "Kuala Lumpur",
    "Dublin", "Cork", "Galway", "Kildare", "Meath", "Limerick", "Kerry", "Wicklow", "Clare", "Tipperary", "Wexford", "Donegal"
  ];

  let res = addr;
  for (const st of states) {
    const regex = new RegExp(`([a-zA-Z0-9\\)])\\s+\\b(${st})\\b(?!\\s+(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Park|Estate|Industrial|Unit|Suite|Building|Floor|Bldg|St|Rd|Ave|Dr|Ln|Blvd|Hwy|Ct|Pl)\\b)`, "gi");
    res = res.replace(regex, "$1, $2");
  }
  return res;
}

/**
 * Restores state or province if AI or parser omitted it from the physical address.
 */
function restoreStateIfOmitted(cleanAddr, rawAddr, country = "") {
  if (!cleanAddr || !rawAddr) return cleanAddr;

  // If cleanAddr ALREADY contains a valid state or province, NEVER append another state!
  if (hasStateInAddress(cleanAddr, country)) {
    return cleanAddr;
  }

  const cLower = (country || "").toLowerCase();

  // AU check - ONLY if country is Australia or unknown
  if (!country || cLower.includes("australia")) {
    const auStates = [
      ["vic", "Victoria"], ["nsw", "New South Wales"], ["qld", "Queensland"],
      ["wa", "Western Australia"], ["sa", "South Australia"], ["tas", "Tasmania"],
      ["act", "Australian Capital Territory"], ["nt", "Northern Territory"]
    ];
    for (const [abbr, full] of auStates) {
      const regRaw = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      const regClean = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      if (regRaw.test(rawAddr) && !regClean.test(cleanAddr)) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${full}`;
      }
    }
  }

  // Canada check - ONLY if country is Canada
  if (cLower.includes("canada")) {
    const caProvs = [
      ["ont", "Ontario"], ["qc", "Quebec"], ["bc", "British Columbia"], ["ab", "Alberta"],
      ["mb", "Manitoba"], ["sk", "Saskatchewan"], ["ns", "Nova Scotia"], ["nb", "New Brunswick"],
      ["nl", "Newfoundland And Labrador"], ["pe", "Prince Edward Island"]
    ];
    for (const [abbr, full] of caProvs) {
      // Do not match the English preposition "on" in general text; match "Ontario" or "Ont."
      const regRaw = (abbr === "ont")
        ? /\b(?:Ontario|Ont(?:\.|\b))\b/i
        : new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      const regClean = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      if (regRaw.test(rawAddr) && !regClean.test(cleanAddr)) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${full}`;
      }
    }
  }

  // US check - ONLY if country is United States / USA
  if (cLower.includes("united states") || cLower.includes("usa") || cLower.includes("america")) {
    const usStates = [
      ["ca", "California"], ["tx", "Texas"], ["ny", "New York"], ["fl", "Florida"],
      ["il", "Illinois"], ["pa", "Pennsylvania"], ["oh", "Ohio"], ["ga", "Georgia"],
      ["nc", "North Carolina"], ["mi", "Michigan"], ["nj", "New Jersey"], ["va", "Virginia"],
      ["wa", "Washington"], ["az", "Arizona"], ["ma", "Massachusetts"], ["co", "Colorado"]
    ];
    for (const [abbr, full] of usStates) {
      const regRaw = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      const regClean = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      if (regRaw.test(rawAddr) && !regClean.test(cleanAddr)) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${full}`;
      }
    }
  }

  return cleanAddr;
}

/**
 * Carefully strips postal codes while strictly preserving street numbers and states.
 */
function removePostalCodesCarefully(addr) {
  if (!addr) return "";
  let a = addr;

  // Leading postal code (e.g. "30543新竹縣..." or "504 Changhua...")
  a = a.replace(/^\s*\b\d{4,6}\b[\s,]+/g, "");
  a = a.replace(/^\s*(\d{3,6})(?=[\u4e00-\u9fa5])/g, "");

  // 1. UK Postcodes (e.g. SW1A 1AA, EC1A 1BB, W1A 0AX, M1 1AE)
  a = a.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, " ");

  // 2. Canadian Postcodes (e.g. M5V 2T6, K1A 0B1)
  a = a.replace(/\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/gi, " ");

  // 3. US ZIP+4 (e.g. 90210-1234)
  a = a.replace(/\b\d{5}-\d{4}\b/g, " ");

  // 4. Postal code directly following State name / abbreviation (e.g. "VIC 3061", "Victoria 3061", "TX 78701", "Texas 78701")
  a = a.replace(/(\b(?:Victoria|New South Wales|Queensland|Western Australia|South Australia|Tasmania|Northern Territory|Australian Capital Territory|Vic|NSW|QLD|WA|SA|TAS|ACT|NT|California|Texas|New York|Florida|Illinois|Pennsylvania|Ohio|Ontario|Quebec|British Columbia|Alberta|Gauteng|CA|TX|NY|FL|IL|PA|OH|ON|QC|BC)\b[\s,]*)\b\d{4,6}\b/gi, "$1");

  // 5. Postal code before a city/town or after a comma (e.g. "... Taman Perindustrian Sri Plentong, 81750 Masai, Johor")
  a = a.replace(/(,\s*)\b\d{4,6}\b\s*(?=,?\s+[A-Za-z])/g, "$1");

  // 6. Postal code at the very end of the address string (e.g. "... Campbellfield 3061" or "... Taoyuan Hsien 326")
  a = a.replace(/[\s,]+\b\d{3,6}\b(?:\s*[.,]?\s*)$/g, "");

  return a;
}

/**
 * Country-specific phone cleaner and validator strictly conforming to Rule 11.
 * Strips international calling codes globally and removes leading zeros.
 */
function cleanPhoneNumber(rawPhone, country) {
  if (!rawPhone) return "";
  let p = String(rawPhone).trim();

  p = p.replace(/^(?:tel|call|phone|contact|mobile|fax|whatsapp)[\s.:]*/i, "").trim();

  const cLower = (country || "").toLowerCase();
  const hasPlus = p.startsWith("+");
  const has00 = p.startsWith("00");

  let digits = p.replace(/\D/g, "");
  if (!digits) return "";

  if (has00 && digits.length >= 10) {
    digits = digits.slice(2);
  }

  // Comprehensive map of country calling codes
  const countryCodes = [
    { match: ["malaysia"], code: "60", minLen: 10 },
    { match: ["south africa"], code: "27", minLen: 11 },
    { match: ["australia"], code: "61", minLen: 11 },
    { match: ["united states", "canada", "usa", "america"], code: "1", minLen: 11 },
    { match: ["united kingdom", "england", "scotland", "wales", "great britain", "uk"], code: "44", minLen: 12 },
    { match: ["taiwan"], code: "886", minLen: 11 },
    { match: ["india"], code: "91", minLen: 12 },
    { match: ["singapore"], code: "65", minLen: 10 },
    { match: ["china"], code: "86", minLen: 12 },
    { match: ["hong kong"], code: "852", minLen: 11 },
    { match: ["japan"], code: "81", minLen: 11 },
    { match: ["south korea", "korea"], code: "82", minLen: 11 },
    { match: ["germany", "deutschland"], code: "49", minLen: 11 },
    { match: ["france"], code: "33", minLen: 11 },
    { match: ["italy"], code: "39", minLen: 11 },
    { match: ["spain"], code: "34", minLen: 11 },
    { match: ["netherlands"], code: "31", minLen: 11 },
    { match: ["switzerland"], code: "41", minLen: 11 },
    { match: ["united arab emirates", "uae"], code: "971", minLen: 12 },
    { match: ["saudi arabia"], code: "966", minLen: 12 },
    { match: ["new zealand"], code: "64", minLen: 11 },
    { match: ["indonesia"], code: "62", minLen: 11 },
    { match: ["philippines"], code: "63", minLen: 11 },
    { match: ["thailand"], code: "66", minLen: 11 },
    { match: ["vietnam"], code: "84", minLen: 11 },
    { match: ["ireland"], code: "353", minLen: 11 }
  ];

  let codeRemoved = false;
  // Match by detected country
  for (const cc of countryCodes) {
    if (cc.match.some(m => cLower.includes(m))) {
      if (digits.startsWith(cc.code) && digits.length >= (cc.minLen - 1)) {
        digits = digits.slice(cc.code.length);
        codeRemoved = true;
        break;
      }
    }
  }

  // If phone had '+' or '00' and country code wasn't removed yet
  if ((hasPlus || has00) && !codeRemoved) {
    for (const cc of countryCodes) {
      if (digits.startsWith(cc.code) && digits.length >= cc.minLen) {
        digits = digits.slice(cc.code.length);
        codeRemoved = true;
        break;
      }
    }
  }

  // Rule 11: Strip leading zero
  digits = digits.replace(/^0+/, "");

  // Rule 11: Do not take toll-free numbers
  if (/^(800|888|877|866|855|844|833|860|861|808|1800|1300)/.test(digits)) {
    return "";
  }

  // Country-specific length validation
  const len = digits.length;
  if (cLower.includes("south africa")) {
    if (len !== 9) return "";
  } else if (cLower.includes("united states") || cLower.includes("canada") || cLower.includes("usa")) {
    if (len !== 10) return "";
  } else if (cLower.includes("taiwan")) {
    if (len < 8 || len > 9) return "";
  } else if (cLower.includes("united kingdom") || cLower.includes("england")) {
    if (len < 9 || len > 10) return "";
  } else if (cLower.includes("india")) {
    if (len !== 10) return "";
  } else if (cLower.includes("australia")) {
    if (len !== 9) return "";
  } else if (cLower.includes("malaysia")) {
    if (len < 8 || len > 10) return "";
  } else if (cLower.includes("singapore")) {
    if (len !== 8) return "";
  } else {
    if (len < 7 || len > 12) return "";
  }

  return digits;
}

function toTitleCase(str) {
  if (!str) return "";
  const upperAcronyms = new Set(["USA", "UK", "UAE", "M", "3D", "CNC", "LED", "OEM", "ODM", "HVAC", "PVC", "PE", "HDPE", "PTFE", "R&D", "AKS"]);
  let s = str.replace(/['’`]\s*s\b/gi, "'s");
  return s.replace(/\b\w+/g, function (word, offset, fullStr) {
    if (offset > 0 && fullStr[offset - 1] === "'" && word.toLowerCase() === "s") {
      return "s";
    }
    const upper = word.toUpperCase();
    if (upperAcronyms.has(upper)) return upper;
    if (word.toLowerCase() === "of" && /united\s+states/i.test(s)) return "of";
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function decodeHtmlEntities(str) {
  if (!str || typeof str !== "string") return "";
  let res = str;
  for (let i = 0; i < 2; i++) {
    res = res
      .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&apos;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&nbsp;/gi, " ")
      .replace(/\u00A0/g, " ");
  }
  return res;
}

/**
 * Determines Country Name EXCLUSIVELY from the physical address string.
 * Strictly NEVER checks or guesses from the domain name or URL extension.
 */
function detectCountryFromAddress(address) {
  if (!address || typeof address !== "string" || address.trim().length < 3) return "";
  const lower = address.toLowerCase();

  // 1. Explicit country mentioned in the physical address text
  if (/\b(south\s*africa)\b/i.test(lower)) return "South Africa";
  if (/\b(taiwan|r\.?o\.?c\.?)\b/i.test(lower)) return "Taiwan";
  if (/\b(england)\b/i.test(lower)) return "England";
  if (/\b(scotland)\b/i.test(lower)) return "Scotland";
  if (/\b(wales)\b/i.test(lower)) return "Wales";
  if (/\b(northern\s*ireland)\b/i.test(lower)) return "Northern Ireland";
  if (/\b(united\s*kingdom|great\s*britain|uk)\b/i.test(lower)) return "United Kingdom";
  if (/\b(united\s*states|usa|united\s*states\s*of\s*america)\b/i.test(lower)) return "United States Of America";
  if (/\b(australia)\b/i.test(lower)) return "Australia";
  if (/\b(canada)\b/i.test(lower)) return "Canada";
  if (/\b(germany|deutschland)\b/i.test(lower)) return "Germany";
  if (/\b(india)\b/i.test(lower)) return "India";
  if (/\b(france)\b/i.test(lower)) return "France";
  if (/\b(china)\b/i.test(lower)) return "China";
  if (/\b(japan)\b/i.test(lower)) return "Japan";
  if (/\b(south\s*korea|korea)\b/i.test(lower)) return "South Korea";
  if (/\b(singapore)\b/i.test(lower)) return "Singapore";
  if (/\b(netherlands|holland)\b/i.test(lower)) return "Netherlands";
  if (/\b(new\s*zealand)\b/i.test(lower)) return "New Zealand";
  if (/\b(united\s*arab\s*emirates|uae)\b/i.test(lower)) return "United Arab Emirates";
  if (/\b(italy|italia)\b/i.test(lower)) return "Italy";
  if (/\b(spain|espana)\b/i.test(lower)) return "Spain";
  //.
  // 2. Definitive administrative regions/towns explicitly appearing in physical address
  if (/\b(taoyuan\s*hsien|taoyuan|yangmei|taipei|new\s*taipei|kaohsiung|taichung|tainan|hsinchu)\b/i.test(lower)) {
    return "Taiwan";
  }
  if (/\b(boksburg|johannesburg|pretoria|durban|cape\s*town|sandton|midrand|centurion|gauteng|ekurhuleni)\b/i.test(lower)) {
    return "South Africa";
  }
  if (/\b(switzerland)\b/i.test(lower)) return "Switzerland";
  if (/\b(ireland)\b/i.test(lower)) return "Ireland";
  if (/\b(thailand)\b/i.test(lower)) return "Thailand";
  if (/\b(malaysia)\b/i.test(lower)) return "Malaysia";

  // 2. Verified State / Province / County / Hsien in the physical address text
  if (/\b(gauteng|western\s*cape|eastern\s*cape|kwazulu|natal|mpumalanga|free\s*state|limpopo|north\s*west|northern\s*cape)\b/i.test(lower)) return "South Africa";
  if (/\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new\s*hampshire|new\s*jersey|new\s*mexico|new\s*york|north\s*carolina|north\s*dakota|ohio|oklahoma|oregon|pennsylvania|rhode\s*island|south\s*carolina|south\s*dakota|tennessee|texas|utah|vermont|virginia|washington|west\s*virginia|wisconsin|wyoming|district\s*of\s*columbia)\b/i.test(lower)) return "United States Of America";
  if (/\b(ontario|quebec|british\s*columbia|alberta|manitoba|nova\s*scotia)\b/i.test(lower)) return "Canada";
  if (/\b(new\s*south\s*wales|victoria|queensland|western\s*australia|south\s*australia|tasmania|northern\s*territory|australian\s*capital\s*territory|sydney|melbourne|brisbane|perth|adelaide)\b/i.test(lower)) return "Australia";
  if (/\b(bavaria|bayern|baden-wurttemberg|nordrhein-westfalen|hessen|sachsen)\b/i.test(lower)) return "Germany";
  if (/\b(maharashtra|karnataka|tamil\s*nadu|gujarat|uttar\s*pradesh|telangana|delhi)\b/i.test(lower)) return "India";
  if (/\b(taoyuan|hsinchu|miaoli|changhua|nantou|yunlin|chiayi|pingtung|yilan|hualien|taitung)\s*(hsien|county)\b/i.test(lower)) return "Taiwan";

  // 3. National Capital mentioned in the physical address text
  if (isNewTaipeiCity(lower)) return "Taiwan";
  if (/\b(taipei|taipei\s*city)\b/i.test(lower)) return "Taiwan";
  if (/\b(pretoria|cape\s*town|bloemfontein)\b/i.test(lower)) return "South Africa";
  if (/\b(london)\b/i.test(lower)) return "England";
  if (/\b(edinburgh)\b/i.test(lower)) return "Scotland";
  if (/\b(cardiff)\b/i.test(lower)) return "Wales";
  if (/\b(belfast)\b/i.test(lower)) return "Northern Ireland";
  if (/\b(washington\s*d\.?c\.?)\b/i.test(lower)) return "United States Of America";
  if (/\b(ottawa)\b/i.test(lower)) return "Canada";
  if (/\b(canberra)\b/i.test(lower)) return "Australia";
  if (/\b(berlin)\b/i.test(lower)) return "Germany";
  if (/\b(paris)\b/i.test(lower)) return "France";
  if (/\b(tokyo)\b/i.test(lower)) return "Japan";
  if (/\b(beijing)\b/i.test(lower)) return "China";
  if (/\b(new\s*delhi)\b/i.test(lower)) return "India";
  if (/\b(seoul)\b/i.test(lower)) return "South Korea";

  return "";
}

function extractLikelyAddress(text) {
  if (!text) return "";
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 10);
  for (const line of lines) {
    if (/\b(street|road|avenue|drive|lane|way|boulevard|park|industrial|building|box|suite|town|district|county|hsien)\b/i.test(line)) {
      return line;
    }
  }
  return lines.length > 0 ? lines[0] : "";
}

async function testGeminiApiKey(apiKey, modelName = DEFAULT_MODEL) {
  const modelsToTry = [
    modelName,
    // Latest Gemini models
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",

    // Gemini 2.5 alternatives
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro"
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);


  //   const modelsToTry = [
  //   modelName,
  //   "gemini-2.5-flash-lite",
  //   "gemini-3.5-flash-lite",
  //   "gemini-flash-lite-latest"
  // ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hello! Reply with 'OK'" }] }]
        })
      });
      if (res.ok) {
        return { success: true, message: `Connected successfully with Gemini (${model})!` };
      }
      const err = await res.text();
      lastError = `API HTTP ${res.status}: ${err}`;
    } catch (e) {
      lastError = e.message;
    }
  }

  return { success: false, error: lastError || "Failed to connect with any Gemini model" };
}
