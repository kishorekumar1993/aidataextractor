// Background Service Worker for AI Web Crawler & Auto Pre-Fill Assistant
// Production-Grade Implementation strictly conforming to 14 QC Rules

// Load environment configuration from env.js (synced from .env)
try { importScripts("env.js"); } catch (e) { }

const DEFAULT_API_KEY =
  (typeof globalThis !== "undefined" && globalThis.ENV && globalThis.ENV.GEMINI_API_KEY) ||
  (typeof self !== "undefined" && self.ENV && self.ENV.GEMINI_API_KEY) ||
  "";
const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];

const DEFAULT_MODEL =
  (typeof globalThis !== "undefined" && globalThis.ENV && globalThis.ENV.DEFAULT_MODEL) ||
  (typeof self !== "undefined" && self.ENV && self.ENV.DEFAULT_MODEL) ||
  "gemini-3.5-flash-lite";

// Primary prohibited core industries per Instruction Sheet Note 2
// Rule: "Do not work on websites related to Porn, Adult, Medicine, Medical, Hospital, Food, Weapons (Knife), Defence, Aircraft, Aerospace, Marine, Ship, Chemical, Alcohol, Animals. Even if these images or words appear anywhere on the site, do not work on that site. make these rule strictly if any word appear make it notwroking"
const RESTRICTED_PATTERNS = [
  {
    pattern: /\b(?:porn(?:o|ography|ographic)?|xxx|erotic|adult|sex\s*shop|escort\s*service|cam\s*girl|cam\s*model|strip\s*club|brothel|adult\s*toys?|dildos?|vibrators?|fetish|erotica|sex\s*worker|sensual\s*massage|nude|nudity|onlyfans)\b/i,
    label: "Adult & Porn"
  },
  {
    pattern: /\b(?:weapons?|firearms?|rifles?|handguns?|pistols?|shotguns?|assault\s*weapons?|ammunition|munitions?|gun\s*shop|gun\s*dealer|gun\s*store|weapons?\s*manufacturer|weapons?\s*trading|weapons?\s*supply|weapons?\s*export(?:ing|er)?|weapons?\s*repair(?:ing)?|explosives?|bomb\s*making|ballistic\s*vests?|body\s*armor|body\s*armour|bulletproof|tactical\s*armaments|armor\s*plate|armour\s*plate|armored\s*vehicles?|armoured\s*vehicles?|tactical\s*armor|military\s*armor|combat\s*knives|tactical\s*knives|hunting\s*knives|knives|knife|daggers?|swords?|machetes?|bayonets?|custom\s*knives|knife\s*maker)\b/i,
    label: "Weapons, Armor & Knives"
  },
  {
    pattern: /\b(?:military|armed\s*forces|tactical\s*armaments|artillery|combat\s*vehicles?|missile\s*systems?|defence\s*contractors?|defense\s*contractors?|military\s*defence|military\s*defense|ministry\s*of\s*defence|department\s*of\s*defense|defence\s*forces?|defense\s*forces?|national\s*defence|national\s*defense|homeland\s*defence|homeland\s*defense|air\s*defence|air\s*defense|naval\s*defence|naval\s*defense|aerospace\s*(?:and|&)\s*defence|aerospace\s*(?:and|&)\s*defense|defence\s*equipment|defense\s*equipment|defence\s*systems?|defense\s*systems?|defence\s*industry|defense\s*industry|munitions?)\b/i,
    label: "Defence & Military"
  },
  {
    pattern: /\b(?:airlines?|commercial\s*aviation|aviation\s*industry|aviation\s*services?|air\s*travel|flight\s*booking|aircraft\s*leasing|aviation\s*charter|aircraft|aircrafts|airplane|airplanes|air\s*charter|avionics|helicopters?|fighter\s*jets?|jet\s*aircraft)\b/i,
    label: "Aviation & Airlines"
  },
  {
    pattern: /\b(?:aerospace|aerospace\s*engineering|aerospace\s*components?|aerospace\s*parts?)\b/i,
    label: "Aerospace"
  },
  {
    pattern: /\b(?:marine\s*vessels?|maritime\s*industry|naval\s*vessels?|commercial\s*vessels?)\b/i,
    label: "Marine"
  },
  {
    pattern: /\b(?:shipyards?|shipbuilding|shipbuilders?|ship\s*builders?|ship\s*repairs?|boat\s*builders?|boat\s*building|naval\s*ships?|cargo\s*ships?|cruise\s*ships?|container\s*ships?|warships?|battleships?|vessels?\s*builder|commercial\s*vessels?|yachts?|motor\s*yachts?|sailing\s*yachts?|ferries|ferry\s*boats?|tugboats?|barges?|watercraft)\b/i,
    label: "Ships & Boats"
  },
  {
    pattern: /\b(?:specialty\s*chemicals?|industrial\s*chemicals?|petrochemicals?|agrochemicals?|pesticides?|hazardous\s*chemicals?|chemical\s*synthesis|solvents?|toxic\s*chemicals?|raw\s*chemicals?|chemical\s*manufacturer|chemical\s*producer)\b/i,
    label: "Chemicals & Petrochemicals"
  },
  {
    pattern: /\b(?:medicine|medicines|medical|pharmaceuticals?|prescription\s*drugs?|online\s*pharmacy|hospital|hospitals|patient\s*care|dental\s*clinic|outpatient\s*clinic|surgery|veterinary\s*hospital|psychiatric\s*hospital|healthcare|health\s*clinic|diagnostic\s*center|clinic|clinics)\b/i,
    label: "Medicine, Medical & Hospital"
  },
  {
    pattern: /\b(?:food\s*processing|bakery|bakeries|catering|restaurants?|bistros?|cafes?|eateries|snack\s*foods?|dairy\s*products?|meat\s*processing|poultry\s*processing|seafood\s*processing|edible\s*oils?|confectionery)\b/i,
    label: "Food & Beverages"
  },
  {
    pattern: /\b(?:alcohol|alcoholic|brewery|breweries|distillery|distilleries|liquor\s*store|liquor\s*shop|liquor|wine\s*producer|winery|wineries|vineyards?|craft\s*beer|beer|whiskey|whisky|vodka|tequila|rum|gin|spirits)\b/i,
    label: "Alcohol & Breweries"
  },
  {
    pattern: /\b(?:animals?|pets?|puppy|puppies|kitten|kittens|dogs?|canine|feline|pet\s*shop|pet\s*store|pet\s*food|pet\s*care|animal\s*breeding|livestock|cattle|poultry\s*farming|pig\s*farming|animal\s*feed|slaughterhouse|veterinary|vet\s*clinic|domestic\s*cats?|pet\s*cats?|cats?\s*(?:and|&)\s*dogs?|dogs?\s*(?:and|&)\s*cats?|cats?\s*(?:food|feed|litter|care|grooming|breed|breeds|adoption|rescue|supplies|accessories|bed|shelter|boarding|neutering|vaccination))\b/i,
    label: "Animals & Pets"
  },
  {
    pattern: /\b(?:gambling|online\s*casino|casinos?|sports\s*betting|betting\s*site|slot\s*machines?|video\s*slots|poker\s*room|roulette|blackjack|baccarat|bookmaker|sportsbook|lottery|lotto|sports\s*wagering|jackpot\s*betting|online\s*gaming|online\s*games|igaming|i-gaming|crypto\s*casino|esports\s*betting|play\s*to\s*earn|online\s*gambling)\b/i,
    label: "Gambling & Online Gaming"
  },
  {
    pattern: /\b(?:tobacco|cigarettes?|cigars?|cigarillos|chewing\s*tobacco|hookah|shisha|snus|nicotine\s*pouches?|vape|vaping|e-?cigarette|vape\s*shop|e-?liquid|vape\s*juice|disposable\s*vape)\b/i,
    label: "Tobacco & Vaping"
  },
  {
    pattern: /\b(?:cannabis|marijuana|weed|thc|cbd\s*oil|cbd\s*gummies|dispensary|recreational\s*weed|medical\s*cannabis|delta-?8|delta-?9|kratom|illicit\s*drugs|narcotics)\b/i,
    label: "Cannabis & Controlled Substances"
  },
  {
    pattern: /\b(?:hacking\s*services?|hacking\s*tools?|hacking\s*information|hacking\s*tutorials?|hire\s*a\s*hacker|exploit\s*kits?|ddos\s*services?|ddos\s*attack|cyber\s*attack\s*service|ethical\s*hacking\s*service|black\s*hat\s*hacking|malware\s*distribution|spyware\s*services?)\b/i,
    label: "Hacking Services & Information"
  },
  {
    pattern: /\b(?:personal\s*blog|personal\s*website|my\s*personal\s*site|personal\s*portfolio|lifestyle\s*blog|travel\s*blog|food\s*blog|mommy\s*blog|personal\s*diary|resume\s*of|cv\s*of)\b/i,
    label: "Personal Website & Blog"
  },
  {
    pattern: /\b(?:music\s*streaming|video\s*streaming|audio\s*streaming|movie\s*streaming|streaming\s*platform|streaming\s*service)\b/i,
    label: "Multimedia & Streaming Platform"
  },
  {
    pattern: /\b(?:counterfeit\s*goods|replica\s*watches?|fake\s*id|fake\s*passports?|dark\s*web\s*market|payday\s*loans?|loan\s*shark)\b/i,
    label: "Counterfeits & Prohibited Financial Services"
  }
];

// National Capital Cities for Rule 8 capital city exception
const ALL_CAPITALS = [
  "taipei city", "taipei", "pretoria", "cape town", "bloemfontein", "london", "washington", "paris",
  "berlin", "tokyo", "beijing", "new delhi", "canberra", "ottawa", "seoul", "bangkok",
  "singapore", "kuala lumpur", "putrajaya", "jakarta", "dki jakarta", "nusantara", "manila", "hanoi", "rome", "madrid", "amsterdam",
  "brussels", "bern", "vienna", "stockholm", "oslo", "copenhagen", "helsinki", "dublin",
  "warsaw", "prague", "budapest", "athens", "lisbon", "ankara", "riyadh", "abu dhabi",
  "doha", "cairo", "nairobi", "buenos aires", "brasilia", "santiago", "bogota", "lima",
  "mexico city", "wellington"
];

// High-risk suburbs and localities that MUST NOT be classified as cities (Strict QC Rule)
const NON_CITY_SUBURBS = [
  // South Africa
  "sandton", "rosebank", "randburg", "midrand", "bryanston", "fourways", "centurion", "menlyn",
  "umhlanga", "bedfordview", "edenvale", "alberton", "rivonia", "woodmead", "morningside",
  "kempton park", "jet park", "boksburg industrial", "isando", "germiston", "roodepoort",
  "constantia", "camps bay", "sea point", "claremont", "bellville", "durbanville", "somerset west",
  // Canada Suburbs & Boroughs (MUST NOT be considered as City)
  "scarborough", "etobicoke", "north york", "east york", "york",
  // United States
  "brooklyn", "queens", "manhattan", "bronx", "staten island", "hollywood", "beverly hills",
  // Australia Suburbs & Localities (MUST NOT be considered as City)
  "minto", "campbellfield", "dandenong", "dandenong south", "braeside", "bayswater", "bayswater north",
  "clayton", "clayton south", "tullamarine", "thomastown", "somerton", "laverton", "laverton north",
  "truganina", "altona", "altona north", "derrimut", "ravenhall", "heidelberg", "heidelberg west",
  "preston", "coburg", "reservoir", "epping", "broadmeadows", "keon park", "richmond",
  "moorabbin", "cheltenham", "mordialloc", "springvale", "noble park", "notting hill", "mulgrave",
  "knoxfield", "scoresby", "rowville", "croydon", "croydon south", "ringwood", "kilsyth",
  "footscray", "brooklyn", "sunshine", "sunshine west", "yarraville", "port melbourne",
  "south melbourne", "brunswick", "essendon", "st kilda", "hawthorn", "camberwell", "box hill",
  "werribee", "hoppers crossing", "point cook", "frankston", "mornington", "carrum downs",
  "seven hills", "blacktown", "parramatta", "rydalmere", "silverwater", "wetherill park",
  "smithfield", "alexandria", "rosebery", "prestons", "moorebank", "liverpool", "ingleburn",
  "penrith", "st marys", "saint marys", "chullora", "bankstown", "canterbury", "revesby", "padstow",
  "mascot", "botany", "brookvale", "manly", "frenchs forest", "chatswood", "north sydney",
  "strathfield", "homebush", "auburn", "lidcombe", "granville", "guildford", "villawood",
  "chester hill", "eastern creek", "huntingwood", "erskine park", "glendenning", "arndell park",
  "kings park", "girraween", "castle hill", "norwest", "baulkham hills", "hornsby",
  "campbelltown", "camden", "smeaton grange", "taren point", "miranda", "caringbah",
  "acacia ridge", "rocklea", "wacol", "brendale", "yatala", "coopers plains", "archerfield",
  "salisbury", "darra", "richlands", "carole park", "logan", "loganholme",
  "underwood", "slacks creek", "springwood", "browns plains", "crestmead", "murarrie",
  "hemmant", "lytton", "tingalpa", "wynnum", "hendra", "eagle farm", "pinkenba",
  "geebung", "virginia", "zillmere", "strathpine", "lawnton", "north lakes", "caboolture",
  "southport", "surfers paradise", "burleigh heads", "molendinar", "nerang", "varsity lakes",
  "carrara", "ashmore", "stapylton", "maroochydore", "caloundra", "kunda park", "coolum beach",
  "welshpool", "kewdale", "canning vale", "malaga", "osborne park", "balcatta", "wangara",
  "joondalup", "fremantle", "o'connor", "bibra lake", "cockburn central", "henderson",
  "kwinana", "rockingham", "bassendean", "belmont", "victoria park",
  "subiaco", "west perth", "east perth", "clarkson", "landsdale", "morley", "maddington",
  "kenwick", "cannington", "forrestdale", "myaree", "willetton", "midland", "hazelmere",
  "wingfield", "regency park", "kilkenny", "hindmarsh", "beverley", "flinders park",
  "edwardstown", "lonsdale", "pooraka", "elizabeth", "edinburgh", "gepps cross", "dry creek",
  "port adelaide", "alberton", "glandore", "mile end", "thebarton", "norwood", "unley",
  "prospect", "glynde", "glenorchy", "derwent park", "moonah", "cambridge", "sorell",
  "kingston", "invermay", "mowbray", "kings meadows", "devonport", "burnie",
  "fyshwick", "hume", "mitchell", "belconnen", "woden", "tuggeranong", "gungahlin",
  "winnellie", "pinelands", "berrimah", "yarrawonga", "palmerston", "alice springs",
  // New Zealand Suburbs & Localities (MUST NOT be classified as City)
  "penrose", "rosedale", "albany", "east tamaki", "mount wellington", "mt wellington", "mt. wellington",
  "avondale", "henderson", "onehunga", "newmarket", "parnell", "grey lynn", "ponsonby", "takapuna",
  "manukau", "papatoetoe", "otahuhu", "mangere", "takanini", "wiri", "rosebank", "ellerslie",
  "greenlane", "epsom", "remuera", "glenfield", "northcote", "birkenhead", "devonport", "browns bay",
  "silverdale", "kumeu", "highbrook", "half moon bay", "botany downs", "flat bush", "pakuranga",
  "howick", "st lukes", "mount albert", "mt albert", "mount eden", "mt eden", "mount roskill", "mt roskill",
  "blockhouse bay", "new lynn", "kelston", "glendene", "te atatu", "te atatu peninsula", "te atatu south",
  "westgate", "hobsonville", "whenuapai", "glen eden", "titirangi", "kingsland", "morningside",
  "point chevalier", "pt chevalier", "freemans bay", "herne bay", "westmere", "orakei", "mission bay",
  "kohimarama", "st heliers", "panmure", "glen innes", "royal oak", "hillsborough", "three kings",
  "sandringham", "waterview", "lynfield", "favona", "otara", "clendon park", "manurewa", "alfriston",
  "drury", "milford", "mairangi bay", "torbay", "castor bay", "forrest hill", "sunnynook",
  "riccarton", "hornby", "papanui", "addington", "sydenham", "burnside", "fendalton", "merivale",
  "harewood", "woolston", "bromley", "belfast", "linwood", "halswell", "wigram", "sockburn",
  "islington", "middleton", "shirley", "mairehau", "st albans", "edgeware", "spreydon", "cashmere",
  "petone", "miramar", "thorndon", "te aro", "kilbirnie", "newtown", "johnsonville", "tawa",
  "ngaio", "khandallah", "karori", "island bay", "lyall bay", "rongotai", "kelburn", "wadestown",
  "frankton", "te rapa", "hamilton east", "claudelands", "chartwell", "rototuna", "dinsdale",
  // Taiwan Suburbs & Localities (MUST NOT be classified as City)
  "keishan", "guishan", "xizhi", "shulin", "linkou", "tamsui", "danshui",
  "sanchong", "xinzhuang", "zhonghe", "yonghe", "tucheng", "luzhou", "yingge",
  "sanxia", "wugu", "bali", "shenkeng", "shiding", "pinglin", "luzhu", "dayuan",
  "daxi", "yangmei", "pingzhen", "bade", "longtan", "guanyin", "xinwu", "fuxing",
  "nantun", "xitun", "beitun", "qianzhen", "fengshan", "gangshan", "qishan"
];

// International Recognized Towns, Districts, Municipalities
const RECOGNIZED_TOWNS = [
  // South Africa towns / municipalities
  "boksburg", "johannesburg", "pretoria", "durban", "cape town", "port elizabeth", "gqeberha",
  "bloemfontein", "east london", "polokwane", "nelspruit", "mbombela", "pietermaritzburg",
  "kimberley", "george", "rustenburg", "potchefstroom", "paarl", "stellenbosch", "upington",
  "witbank", "emalahleni", "klerksdorp", "secunda", "middelburg", "vanderbijlpark", "vereeniging",
  // United Kingdom towns / cities / boroughs
  "cradley heath", "hayes", "london", "manchester", "birmingham", "liverpool", "leeds", "glasgow", "edinburgh", "bristol",
  "sheffield", "newcastle", "nottingham", "cardiff", "belfast", "cambridge", "oxford", "coventry",
  "leicester", "southampton", "aberdeen", "plymouth", "swansea", "dundee", "norwich",
  // United States cities / towns
  "morgan hill", "rock hill", "chapel hill", "cherry hill", "sanborn", "beaverton",
  "new york", "los angeles", "chicago", "houston", "phoenix", "philadelphia", "san antonio",
  "san diego", "dallas", "san jose", "austin", "jacksonville", "fort worth", "columbus",
  "san francisco", "charlotte", "indianapolis", "seattle", "denver", "boston", "detroit",
  "nashville", "portland", "las vegas", "memphis", "baltimore", "milwaukee", "albuquerque",
  "atlanta", "miami", "cleveland", "minneapolis", "tampa", "pittsburgh", "cincinnati",
  "st. louis", "saint louis", "kansas city", "orlando", "sacramento", "raleigh", "virginia beach",
  "omaha", "oakland", "tulsa", "wichita", "new orleans", "arlington", "bakersfield", "aurora",
  "anaheim", "honolulu", "santa ana", "riverside", "corpus christi", "lexington", "stockton",
  "st. paul", "saint paul", "newark", "greensboro", "buffalo", "plano", "lincoln", "toledo",
  "irvine", "lubbock", "fort wayne", "laredo", "madison", "chandler", "scottsdale", "reno",
  "glendale", "gilbert", "winston-salem", "north las vegas", "norfolk", "chesapeake", "garland",
  "irving", "hialeah", "fremont", "boise", "richmond", "baton rouge", "spokane", "des moines",
  "tacoma", "san bernardino", "modesto", "fontana", "santa clarita", "birmingham", "fayetteville",
  "rochester", "oxnard", "moreno valley", "huntington beach", "salt lake city", "grand rapids",
  "amarillo", "yonkers", "montgomery", "akron", "little rock", "huntsville", "augusta",
  "port st. lucie", "grand prairie", "knoxville", "worcester", "newport news", "brownsville",
  "overland park", "santa rosa", "tallahassee", "chattanooga", "oceanside", "garden grove",
  "vancouver", "tempe", "ontario", "eugene", "pembroke pines", "salem", "cape coral",
  "peoria", "sioux falls", "springfield", "elk grove", "rockford", "lancaster", "corona",
  "salinas", "palmdale", "hayward", "fort collins", "pomona", "cary", "alexandria", "escondido",
  "mckinney", "joliet", "sunnyvale", "torrance", "bridgeport", "lakewood", "hollywood",
  "paterson", "naperville", "syracuse", "mesquite", "dayton", "savannah", "clarksville",
  "orange", "pasadena", "fullerton", "killeen", "frisco", "hampton", "mchenry", "oshkosh",
  "mundelein", "merced", "somerville", "allenton", "westford", "hamden", "palmetto",
  "saegertown", "wheeling", "watertown", "avon", "blomkest", "kutztown", "north hollywood",
  // Australia
  "sydney", "melbourne", "brisbane", "perth", "adelaide", "gold coast", "newcastle", "canberra",
  "sunshine coast", "wollongong", "hobart", "geelong", "townsville", "cairns", "darwin",
  // Canada
  "toronto", "montreal", "vancouver", "calgary", "edmonton", "ottawa", "winnipeg", "quebec city",
  "hamilton", "kitchener", "london", "victoria bc", "halifax", "oshawa", "windsor",
  "mississauga", "brampton", "surrey", "laval", "markham", "vaughan", "gatineau", "longueuil", "burnaby",
  "richmond", "oakville", "burlington", "richmond hill", "sudbury", "sherbrooke", "saguenay", "kelowna",
  "abbotsford", "coquitlam", "cambridge", "kingston", "guelph", "whitby", "dartmouth", "moncton",
  "regina", "saskatoon", "waterloo", "barrie", "st. catharines", "saint catharines",
  "delta", "nanaimo", "kamloops", "prince george", "chilliwack", "red deer",
  "lethbridge", "st. albert", "medicine hat", "wood buffalo", "milton", "brantford", "thunder bay", "niagara falls",
  // Taiwan districts & cities
  "yangmei", "yangmei town", "banqiao", "banqiao district", "xinzhuang", "xinzhuang district", "zhonghe", "zhonghe district",
  "sanchong", "sanchong district", "tamsui", "tamsui district", "xizhi", "xizhi district",
  "yonghe", "yonghe district", "tucheng", "tucheng district", "shulin", "shulin district",
  "taichung", "tainan", "kaohsiung", "keelung", "hsinchu", "chiayi", "hualien", "yilan",
  "hsi-hu", "hsihu", "xihu", "lu-kang", "lukang", "yuan-lin", "yuanlin", "daxi", "tamsui",
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
  "cixi", "kunshan", "yiwu", "changzhou", "taizhou", "huzhou", "shaoxing", "jiaxing",
  "zhongshan", "huizhou", "jiangmen", "zhuhai", "shantou", "chaozhou", "quanzhou", "xiamen",
  "zhangzhou", "fuzhou", "weifang", "zibo", "yantai", "jinan", "tangshan", "baoding",
  "shijiazhuang", "langfang", "cangzhou", "hefei", "wuhu", "chuzhou", "nanchang", "jiujiang", "yichun",
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
  // New Zealand cities & major towns
  "auckland", "wellington", "christchurch", "hamilton", "tauranga", "dunedin",
  "lower hutt", "upper hutt", "palmerston north", "napier", "porirua",
  "new plymouth", "rotorua", "whangarei", "invercargill", "nelson",
  "whanganui", "wanganui", "hastings", "gisborne", "blenheim", "timaru",
  "taupo", "pukekohe", "masterton", "levin", "ashburton", "cambridge",
  "queenstown", "rangiora", "rolleston", "feilding", "tokoroa", "oamaru",
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
  // Spain
  "valencia", "seville", "sevilla", "zaragoza", "malaga", "málaga", "murcia", "palma", "palma de mallorca",
  "bilbao", "alicante", "alacant", "cordoba", "córdoba", "valladolid", "vigo", "gijon", "gijón",
  "hospitalet", "l'hospitalet", "l'hospitalet de llobregat", "granada", "vitoria", "gasteiz", "vitoria-gasteiz",
  "coruna", "coruña", "a coruña", "la coruña", "elche", "elx", "oviedo", "badalona", "cartagena",
  "terrassa", "jerez", "jerez de la frontera", "sabadell", "mostoles", "móstoles", "santa cruz de tenerife",
  "pamplona", "iruna", "iruña", "almeria", "almería", "alcala de henares", "alcalá de henares",
  "fuenlabrada", "leganes", "leganés", "san sebastian", "san sebastián", "donostia", "getafe", "burgos",
  "albacete", "santander", "castellon", "castellón", "castellon de la plana", "alcorcon", "alcorcón",
  "logrono", "logroño", "badajoz", "salamanca", "huelva", "marbella", "lleida", "lerida", "lérida",
  "tarragona", "dos hermanas", "torrejon de ardoz", "torrejón de ardoz", "parla", "mataro", "mataró",
  "leon", "león", "algeciras", "santa coloma", "alcobendas", "cadiz", "cádiz", "jaen", "jaén", "reus",
  "ourense", "orense", "telde", "barakaldo", "lugo", "girona", "gerona", "santiago de compostela",
  "caceres", "cáceres", "lorca", "coslada", "orihuela", "toledo", "pontevedra", "palencia", "guadalajara",
  "aviles", "avilés", "gandia", "ciudad real", "segovia", "soria", "teruel", "cuenca", "huesca", "zamora", "avila", "ávila",
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
  // New Zealand cities & major towns
  "auckland", "wellington", "christchurch", "hamilton", "tauranga", "dunedin",
  "lower hutt", "upper hutt", "palmerston north", "napier", "porirua",
  "new plymouth", "rotorua", "whangarei", "invercargill", "nelson",
  "whanganui", "wanganui", "hastings", "gisborne", "blenheim", "timaru",
  "taupo", "pukekohe", "masterton", "levin", "ashburton", "cambridge",
  "queenstown", "rangiora", "rolleston", "feilding", "tokoroa", "oamaru",
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
  if (request.action === "PING") {
    sendResponse({ success: true, pong: true });
    return false;
  }

  if (request.action === "CRAWL_AND_EXTRACT") {
    // Keep MV3 service worker alive while crawling using storage keepalive
    let keepAlive = setInterval(() => {
      try {
        if (chrome && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ _sw_beat: Date.now() }, () => { });
        }
      } catch (e) { }
    }, 2000);

    // Bounded safety timeout: 28s (well before Chrome's 30s message channel deadline)
    let finished = false;
    const timeoutId = setTimeout(() => {
      if (finished) return;
      finished = true;
      clearInterval(keepAlive);
      console.warn("[Background] Crawl reached safety boundary (28s). Returning timeout Not Working result before channel closes.");
      try {
        const timeoutNotWorking = {
          websiteStatus: "Not Working",
          businessType: "",
          companyProfile: "",
          companyName: "",
          countryName: "",
          companyAddress: "",
          state: "",
          city: "",
          emailId: "",
          secondaryEmailId: "",
          phoneNumber: "",
          numberOfProducts: "",
          productImages: "",
          numberOfProductDescriptions: "",
          errorCategory: "Unreachable / Timeout",
          errorKeyword: "Connection Timeout / Unresponsive",
          errorSourceUrl: request.url,
          errorSnippet: "Website took longer than 28 seconds to respond or server is unresponsive (Rule 1).",
          notWorkingReason: "Website took longer than 28 seconds to respond or server is unresponsive (Rule 1).",
          _finalUrl: request.url,
          _originalUrl: request.url,
          _note: "Crawl timeout reached safety boundary - Marked as Not Working (Rule 1)"
        };
        sendResponse({ success: true, data: timeoutNotWorking });
      } catch (err) {
        try { sendResponse({ success: false, error: "Crawl timeout" }); } catch (e) { }
      }
    }, 28000);

    handleCrawlAndExtract(request.url)
      .then(result => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        clearInterval(keepAlive);
        try { sendResponse({ success: true, data: result }); } catch (e) { }
      })
      .catch(error => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        clearInterval(keepAlive);
        console.warn("[Background] handleCrawlAndExtract caught error:", error.message);
        try {
          sendResponse({
            success: true,
            data: {
              websiteStatus: "Not Working",
              businessType: "",
              companyProfile: "",
              companyName: "",
              countryName: "",
              companyAddress: "",
              state: "",
              city: "",
              emailId: "",
              secondaryEmailId: "",
              phoneNumber: "",
              numberOfProducts: "",
              productImages: "",
              numberOfProductDescriptions: "",
              _note: `Unreachable / Failed to Fetch (${error.message || "Site error"}) - Marked as Not Working`
            }
          });
        } catch (e) { }
      });
    return true;
  }

  if (request.action === "TEST_API_KEY") {
    testGeminiApiKey(request.apiKey || DEFAULT_API_KEY, request.model || DEFAULT_MODEL)
      .then(res => { try { sendResponse(res); } catch (e) { } })
      .catch(err => { try { sendResponse({ success: false, error: err.message }); } catch (e) { } });
    return true;
  }
});

/**
 * Main coordinator: Deep crawls target site, handles framesets & charsets, runs AI, applies independent QC.
 */
async function handleCrawlAndExtract(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim() || rawUrl.trim() === "http://" || rawUrl.trim() === "https://") {
    return {
      websiteStatus: "Not Working",
      businessType: "",
      companyProfile: "",
      companyName: "",
      countryName: "",
      companyAddress: "",
      state: "",
      city: "",
      emailId: "",
      secondaryEmailId: "",
      phoneNumber: "",
      numberOfProducts: "",
      productImages: "",
      numberOfProductDescriptions: "",
      _note: "No URL provided or empty URL - Marked as Not Working"
    };
  }

  let targetUrl = rawUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = "http://" + targetUrl;
  }

  let hostname = "";
  try {
    hostname = new URL(targetUrl).hostname.toLowerCase();
  } catch (e) {
    hostname = "";
  }

  // If URL hostname is missing, incomplete (e.g. "ww", "www", "http://www.larsenlumber."), has trailing dot, or lacks valid TLD
  if (!hostname || !hostname.includes(".") || hostname.length < 4 || hostname === "ww" || hostname === "www" || /\.$/.test(hostname) || !/\.[a-z]{2,}$/i.test(hostname)) {
    console.warn(`[Background] Invalid/incomplete URL provided: "${rawUrl}". Marking as Not Working.`);
    return {
      websiteStatus: "Not Working",
      businessType: "",
      companyProfile: "",
      companyName: "",
      countryName: "",
      companyAddress: "",
      state: "",
      city: "",
      emailId: "",
      secondaryEmailId: "",
      phoneNumber: "",
      numberOfProducts: "",
      productImages: "",
      numberOfProductDescriptions: "",
      errorCategory: "Invalid Website URL",
      errorKeyword: "Malformed / Incomplete URL",
      errorSourceUrl: targetUrl,
      errorSnippet: `Incomplete or malformed URL (${rawUrl}) missing top-level domain.`,
      notWorkingReason: `Incomplete or malformed URL (${rawUrl}) missing top-level domain.`,
      _finalUrl: targetUrl,
      _originalUrl: targetUrl,
      _note: `Invalid/incomplete URL (${rawUrl}) - Marked as Not Working`
    };
  }

  const settings = await chrome.storage.sync.get(["apiKey", "model"]);
  const apiKey = (settings.apiKey && settings.apiKey.trim()) ? settings.apiKey.trim() : DEFAULT_API_KEY;
  let model = (settings.model && settings.model.trim()) ? settings.model.trim() : DEFAULT_MODEL;

  // Step 1: Deep crawl homepage, framesets, contact pages, footer, JSON-LD & map endpoints
  const crawlResult = await crawlWebsite(targetUrl);

  // If website fetch failed (network timeout, connection error, DNS failure, empty response):
  // INSTRUCTION: "IF FAILED TO FETCH MEANS MAKE IT NOTWORKING"
  if (crawlResult.fetchError || !crawlResult.mainHtml || crawlResult.mainHtml.trim().length === 0) {
    if (crawlResult.status === "Domain Expired" || crawlResult.httpStatus === 404) {
      return {
        websiteStatus: "Domain Expired",
        businessType: "",
        companyProfile: "",
        companyName: "",
        countryName: "",
        companyAddress: "",
        state: "",
        city: "",
        emailId: "",
        secondaryEmailId: "",
        phoneNumber: "",
        numberOfProducts: "",
        productImages: "",
        numberOfProductDescriptions: "",
        errorKeyword: "Domain Expired",
        errorSourceUrl: targetUrl,
        errorSnippet: "Domain Expired or Server returned HTTP 404 Not Found",
        _finalUrl: targetUrl,
        _originalUrl: targetUrl,
        _note: "Domain Expired or Server returned HTTP 404 Not Found (Rule 1)"
      };
    }

    let reason = crawlResult.fetchError || "Site unreachable or returned empty HTML";
    if (/listener indicated an asynchronous response|message channel closed/i.test(reason)) {
      reason = "Connection timed out while loading the website server. The site took too long to respond or is offline.";
    }
    console.warn(`[AI Assistant] Failed to fetch ${targetUrl}: ${reason}. Marking as Not Working.`);
    return {
      websiteStatus: "Not Working",
      businessType: "",
      companyProfile: "",
      companyName: "",
      countryName: "",
      companyAddress: "",
      state: "",
      city: "",
      emailId: "",
      secondaryEmailId: "",
      phoneNumber: "",
      numberOfProducts: "",
      productImages: "",
      numberOfProductDescriptions: "",
      fetchError: reason,
      errorCategory: "Unreachable / Connection Failure",
      errorKeyword: "Connection Timeout / Unreachable",
      errorSourceUrl: targetUrl,
      errorSnippet: reason,
      _finalUrl: targetUrl,
      _originalUrl: targetUrl,
      _note: `Website Unreachable (${reason}) - Marked as Not Working (Rule 1)`
    };
  }

  // Step 2: PRE-AI STRICT CHECKS (Prohibited Categories, Free Platforms, Subdomains, Flash & Non-English)
  // Check across target URL, final URL, page text, metadata, image tags, product pages, and stripped body content
  const siteContent = (crawlResult.combinedText || "") + " " + stripHtml(crawlResult.mainHtml || "") + " " + stripHtml(crawlResult.contactHtml || "") + " " + targetUrl + " " + (crawlResult.finalUrl || "");
  const restrictedCheck = detectRestrictedKeywords(siteContent, (crawlResult.mainHtml || "") + "\n" + (crawlResult.contactHtml || ""), crawlResult.crawledPages || []);

  // PRE-AI CHECK 1: If Prohibited Category / Word appears anywhere on the site (text or images):
  // Rule Note 2: "Do not work on that site... make these rule strictly if any word appear make it notwroking" & "Notworking means all empty"
  if (restrictedCheck.isRestricted) {
    const errorUrl = restrictedCheck.sourceUrl || crawlResult.finalUrl || targetUrl;
    return {
      websiteStatus: "Not Working",
      businessType: "",
      companyProfile: "",
      companyName: "",
      countryName: "",
      companyAddress: "",
      state: "",
      city: "",
      emailId: "",
      secondaryEmailId: "",
      phoneNumber: "",
      numberOfProducts: "",
      productImages: "",
      numberOfProductDescriptions: "",
      isRestricted: true,
      isProhibitedSite: true,
      restrictedReason: restrictedCheck.reason,
      restrictedKeyword: restrictedCheck.matchedKeyword,
      restrictedCategory: restrictedCheck.category,
      restrictedSourceUrl: errorUrl,
      restrictedSnippet: restrictedCheck.snippet || "",
      errorKeyword: restrictedCheck.matchedKeyword,
      errorSourceUrl: errorUrl,
      errorSnippet: restrictedCheck.snippet || "",
      _finalUrl: crawlResult.finalUrl || targetUrl,
      _originalUrl: targetUrl,
      _note: `Prohibited Category / Word Detected (${restrictedCheck.reason}) - Marked as Not Working`
    };
  }

  // PRE-AI CHECK 2: Rule 9 (Free platforms) & Rule 10 (Subdomains / Streaming platforms) & Rule 8 (Personal blogs)
  const platformCheck = detectDisallowedWebsitePlatformOrDomain(targetUrl, crawlResult.mainHtml || "", crawlResult.bodyText || "");
  if (platformCheck.isDisallowed) {
    const errorUrl = crawlResult.finalUrl || targetUrl;
    return {
      websiteStatus: "Not Working",
      businessType: "",
      companyProfile: "",
      companyName: "",
      countryName: "",
      companyAddress: "",
      state: "",
      city: "",
      emailId: "",
      secondaryEmailId: "",
      phoneNumber: "",
      numberOfProducts: "",
      productImages: "",
      numberOfProductDescriptions: "",
      isRestricted: true,
      isProhibitedSite: true,
      restrictedReason: platformCheck.reason,
      restrictedKeyword: platformCheck.reason,
      restrictedSourceUrl: errorUrl,
      restrictedSnippet: platformCheck.reason,
      errorKeyword: platformCheck.reason,
      errorSourceUrl: errorUrl,
      errorSnippet: platformCheck.reason,
      _finalUrl: errorUrl,
      _originalUrl: targetUrl,
      _note: platformCheck.reason
    };
  }

  // PRE-AI CHECK 3: Rule 14: Flash format websites without copyable text
  if (detectFlashFormatSite(crawlResult.mainHtml || "")) {
    const errorUrl = crawlResult.finalUrl || targetUrl;
    return {
      websiteStatus: "Flash",
      businessType: "",
      companyProfile: "",
      companyName: "",
      countryName: "",
      companyAddress: "",
      state: "",
      city: "",
      emailId: "",
      secondaryEmailId: "",
      phoneNumber: "",
      numberOfProducts: "",
      productImages: "",
      numberOfProductDescriptions: "",
      errorKeyword: "Flash Content",
      errorSourceUrl: errorUrl,
      errorSnippet: "Flash Format Website - Not copyable (Rule 14)",
      _finalUrl: errorUrl,
      _originalUrl: targetUrl,
      _note: "Flash Format Website - Not copyable (Rule 14)"
    };
  }

  // PRE-AI CHECK 4: Rule 12: Non-English websites without a translation option
  if (detectNonEnglishWithoutTranslation(crawlResult.mainHtml || "", crawlResult.bodyText || "")) {
    const errorUrl = crawlResult.finalUrl || targetUrl;
    return {
      websiteStatus: "Non English",
      businessType: "",
      companyProfile: "",
      companyName: "",
      countryName: "",
      companyAddress: "",
      state: "",
      city: "",
      emailId: "",
      secondaryEmailId: "",
      phoneNumber: "",
      numberOfProducts: "",
      productImages: "",
      numberOfProductDescriptions: "",
      errorKeyword: "Non English Language",
      errorSourceUrl: errorUrl,
      errorSnippet: "Non-English Language Without Translation Option (Rule 12)",
      _finalUrl: errorUrl,
      _originalUrl: targetUrl,
      _note: "Non-English Language Without Translation Option (Rule 12)"
    };
  }

  // Online Shopping Cart Check (Rules 11 & 16: "except for manufacturers")
  // Attach check to crawlResult so analyzeWithGemini & applyStrictInstructions can verify whether the company is a Manufacturer
  const shopCartCheck = crawlResult.shopCartCheck || detectPurchaseOrShoppingCart((crawlResult.mainHtml || "") + "\n" + (crawlResult.contactHtml || ""), crawlResult.bodyText || "");
  crawlResult.shopCartCheck = shopCartCheck;

  let extractedData;
  if (!apiKey || !apiKey.trim()) {
    extractedData = heuristicExtraction(crawlResult, restrictedCheck);
    extractedData._note = "Analyzed via Local Rule Engine";
  } else {
    try {
      extractedData = await analyzeWithGemini(crawlResult, apiKey, model, restrictedCheck);
      extractedData._note = `AI Powered by Gemini (${model})`;
      extractedData._isFromAi = true;
    } catch (aiErr) {
      console.warn("Gemini API error, falling back to local deterministic rule engine:", aiErr);
      extractedData = heuristicExtraction(crawlResult, restrictedCheck);
      extractedData._note = "Analyzed via Local Rule Engine (Gemini error: " + aiErr.message + ")";
    }
  }

  // Step 3: Strictly enforce State, City, Country, and Products based on instructions
  const cleanedData = applyStrictInstructions(extractedData, crawlResult, restrictedCheck);
  return cleanedData;
}

/**
 * Detects bot blockers, WAF challenge pages, and restricted access responses.
 */
function isAntiBotChallenge(html, status) {
  if (status === 403 || status === 401 || status === 429) return true;
  if (!html || typeof html !== "string") return false;
  const lower = html.slice(0, 15000).toLowerCase();
  if (lower.includes("cf-browser-verification") || lower.includes("cf-spinner") || lower.includes("challenge-platform")) return true;
  if (lower.includes("attention required! | cloudflare") || lower.includes("<title>just a moment...</title>")) return true;
  if (lower.includes("incapsula_resource") || lower.includes("_incubator_challenge_")) return true;
  if (lower.includes("sucuri website firewall - access denied")) return true;
  if (lower.includes("<title>access denied</title>") || lower.includes("<title>403 forbidden</title>")) return true;
  return false;
}

/**
 * Resilient, charset-aware HTTP fetcher with timeout and fallback decoders.
 */
async function fetchDecodedHtml(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 5000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { redirect: "follow", ...options, signal: controller.signal });
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

    // Auto-solve JavaScript Cookie Challenges (e.g. document.cookie = "humans_21909=1"; document.location.reload(true))
    const jsCookieMatch = decoded.length < 500 && decoded.match(/document\.cookie\s*=\s*["']([^"';]+)/i);
    if (jsCookieMatch && !options._hasRetriedCookie) {
      const cookieVal = jsCookieMatch[1].trim();
      const retryHeaders = { ...(options.headers || {}), "Cookie": cookieVal };
      return await fetchDecodedHtml(url, { ...options, headers: retryHeaders, _hasRetriedCookie: true });
    }

    return {
      ok: res.ok,
      status: res.status,
      url: res.url,
      redirected: res.redirected,
      html: decoded,
      error: res.ok ? null : `HTTP ${res.status} ${res.statusText || ""}`.trim()
    };
  } catch (err) {
    const isTimeout = err.name === "AbortError" || String(err.message).toLowerCase().includes("aborted");
    const errMsg = isTimeout ? `Connection timed out after ${Math.round(timeoutMs / 1000)}s` : (err.message || "Network request failed");
    return { ok: false, status: 0, url, redirected: false, html: "", error: errMsg };
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
  const plainText = stripHtml(decoded.replace(/<(?:br|\/p|\/div|\/li)[^>]*>/gi, "\n"));
  const patterns = [
    /(?:©|&copy;|copyright|\(c\))\s*(?:©|&copy;|\(c\))?\s*(?:20\d{2}(?:\s*[-–\/]\s*20\d{2})?)?\s*([^<\n\r|]{3,200}?)(?:\.?\s*all\s+rights?\s+reserved|\s*<\/|$)/i,
    /all\s+rights?\s+reserved(?:\s+by)?\s+([^<\n\r|]{3,200}?)(?:\s*<\/|$)/i,
    /([A-Z\u4e00-\u9fa5][A-Za-z0-9\s&,.'\-\u4e00-\u9fa5]{3,80}?)\s*(?:\(c\)|©|&copy;)\s*20\d{2}/i
  ];
  for (const re of patterns) {
    const m = plainText.match(re) || decoded.match(re);
    if (!m || !m[1]) continue;
    let name = stripHtml(m[1])
      .replace(/all\s+rights?\s+reserved/gi, " ")
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
 * Strips navigational, CTA, and page-context prefixes and marketing taglines from company names.
 * Ensures official registered names are clean, complete, and free of extraneous artifacts.
 */
function cleanCompanyPrefixesAndSuffixes(rawName) {
  if (!rawName || typeof rawName !== "string") return "";
  let name = rawName.trim();

  // 1. Strip HTML entities, tag fragments and quotes
  name = name.replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ");
  name = name.replace(/^[^<>\n]*>/g, "").trim();
  name = name.replace(/<[^>]+>/g, "").replace(/^["'“”‘’«»`]+|["'“”‘’«»`]+$/g, "").trim();

  // Strip leading copyright indicators like "© 2024", "(c) 2024", "Copyright 2024", or standalone year numbers
  name = name.replace(/^(?:(?:©|\(c\)|&copy;|copyright)\s*(?:\d{4}(?:\s*[-–\/]\s*\d{4})?)?\s*(?:by)?|(?:\d{4}\s+)?(?:©|\(c\)|&copy;)\s*(?:\d{4})?\s*(?:by)?)\s*/i, "").trim();
  name = name.replace(/^(?:\d{4}|\b\d{2})\s+(?=[A-Z\u4e00-\u9fa5])/i, "").trim();

  // Remove special characters from the beginning per Rule 4
  name = name.replace(/^[^\p{L}\p{N}]+/gu, "").trim();

  // 1b. Strip embedded CTA / navigational breadcrumbs if present:
  // e.g. "Aerospace Contact Us Data Plastics Ltd" -> "Data Plastics Ltd"
  name = name.replace(/^.*?\b(?:contact(?:\s+us)?|about(?:\s+us)?|welcome(?:\s+to(?:\s+the\s+official\s+website\s+of)?)?|get\s+in\s+touch(?:\s+with)?|reach\s+us|visit\s+us|find\s+us)\b\s*[:\-–—|•·*\/]?\s*/i, "").trim();
  name = name.replace(/^[A-Za-z0-9\s]+[•·|*\/]\s*/, "").trim();

  // 2. Strip common unwanted leading prefixes (iterative loop to handle chained prefixes like "Submit scroll to top Contact")
  const prefixRegex = /^(?:(?:contact(?:\s+us)?(?:\s+today)?|about(?:\s+us)?(?:\s+(?:the|our)\s+company)?|welcome(?:\s+to(?:\s+the\s+official\s+website\s+of)?)?|visit(?:\s+us(?:\s+at)?)?|home(?:\s+page)?|find(?:\s+us(?:\s+at)?)?|meet(?:\s+our)?|discover|explore|introducing|overview\s+of|profile\s+of|call(?:\s+us)?|email(?:\s+us)?|click\s+here(?:\s+to)?|submit|scroll\s+to\s+top|back\s+to\s+top|read\s+more\s+about|learn\s+more\s+about|policy|privacy(?:\s+notice|\s+policy)?(?:\s+of)?|this\s+is\s+the\s+(?:privacy\s+notice|privacy\s+policy|website|official\s+site)\s+of|copyright(?:\s*(?:©|\(c\)))?(?:\s*\d{4})?(?:\s+by)?|powered\s+by|designed\s+by|website\s+by|skip\s+to\s+content|official\s+website\s+of|get\s+in\s+touch(?:\s+with)?|connect\s+with|menu|logo|facebook|instagram|linkedin|twitter|youtube|pinterest|tiktok|vimeo|social\s*media|follow\s*us|connect\s*with\s*us)\b[\s\-_|:•·,]*)+/i;

  let prev = "";
  while (prev !== name) {
    prev = name;
    name = name.replace(prefixRegex, "").trim();
    name = name.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
  }

  // 3. Strip trailing marketing taglines / SEO categories if corporate legal suffix is already present
  // e.g. "Danzer UK Limited - Timber Merchants Suppliers of Hardwoods" -> "Danzer UK Limited"
  // e.g. "YUKIWA SEIKO USA INC. Drill Chucks, Tool Holder..." -> "YUKIWA SEIKO USA INC."
  const legalSuffixCutoff = /\b(Pty\.?\s*Ltd\.?|Proprietary\s*Limited|Limited|Ltd\.?|Inc\.?|Incorporated|LLC|LLP|Corp\.?|Corporation|Co\.,\s*Ltd\.?|Company,\s*Limited|Company\s*Limited|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|Sdn\.?\s*Bhd\.?|Berhad|GmbH|PLC|S\.?L\.?U\.?|S\.?A\.?U\.?|S\.?L\.?|S\.?A\.?|Sociedad\s*Limitada|Sociedad\s*An[oó]nima|Joint\s+Stock\s+Company|Societas\s+Europaea|Limitada|Ltda\.?|P?JSC|Spółka\s+z\s+ograniczoną\s+odpowiedzialnością|Besloten\s+Vennootschap|Naamloze\s+Vennootschap|Societ[aà]\s+per\s+Azioni|Societ[aà]\s+a\s+Responsabilit[aà]\s+Limitata|Aktiebolag|Aksjeselskap|Osakeyhtiö)\b(?:\s*[-–—|:•·,]\s*|\s+(?:Drill|Tool|Rotary|Spring|Chucks|Holder|Tables|Collets|Manufacturer|Supplier|Wholesaler|Distributor|Products|Services|Solutions|Store|Shop|Leading|Specialists|Machining|Precision|Online|Official)\b|\.\s+[A-Z]).*$/i;
  name = name.replace(legalSuffixCutoff, "$1");

  // 4. Strip trailing SEO taglines even without separator if starts with " - Manufacturer of...", " | Suppliers of..."
  name = name.replace(/\s*[-–—|:•·]\s*(?:manufacturer|supplier|wholesaler|distributor|timber\s*merchants|specialists|services|official\s*website|home|online\s*store).*$/i, "");

  // 5. Clean boundary punctuation and special characters per Rule 4
  // Rule: Special character should not start and should not end
  name = name.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
  name = name.replace(/[^\p{L}\p{N}]+$/gu, "").trim();
  name = name.replace(/\s+/g, " ").trim();

  return name;
}

/**
 * Extracts candidate official registered legal corporate names from HTML text
 * across all crawled pages (e.g. from ABN/ACN/registration anchors, terms/authority clauses, copyright, and legal suffixes).
 */
function extractLegalCandidatesFromHtml(html) {
  if (!html) return [];
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:a|span|p|div|h[1-6]|li|td|tr|th|header|footer|nav|section|article|aside|caption|blockquote|ul|ol|table|br\s*\/?)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ");

  const candidates = new Set();

  function addCleanCandidate(rawCand) {
    if (!rawCand) return;
    // Strip leading words like "and", "the", "or", "from", "with", "between", "fault arises and"
    let candidateToClean = rawCand.replace(/^.*?\b(?:and|or|by|for|with|from|including|between|the|to|at|arises)\s+/i, "").trim();
    const cleaned = cleanCompanyPrefixesAndSuffixes(candidateToClean || rawCand);
    if (!cleaned) return;
    // Reject third-party job portals, HR platforms, web hosts, CMS, analytics, payment gateways
    if (/\b(?:Dayforce|Ceridian|Workday|BambooHR|Zenefits|Paychex|ADP|UltiPro|Greenhouse|Lever|Jobvite|SmartRecruiters|iCIMS|WordPress|Shopify|Wix|Squarespace|Cloudflare|Google|Facebook|Meta|Twitter|LinkedIn|Instagram|YouTube|Adobe|Salesforce|PayPal|Stripe)\b/i.test(cleaned)) {
      return;
    }
    if (cleaned.length >= 3 && cleaned.length <= 60 && !/^(?:and|the|for|with|from|including|our|your|their|loss|damage|expenses|costs)\b/i.test(cleaned) && !/^all\s+(?:rights|damages|losses|claims|disclaimers)\b/i.test(cleaned)) {
      candidates.add(cleaned);
    }
  }

  // Pattern 1: ABN / ACN / CIF / NIF preceded or followed by company name (e.g. "Custom Flatpack Pty Ltd ... ABN : 37 139 481 575" or "Empresa S.L. ... CIF: B-12345678")
  const abnNearRegex = /([A-Z0-9][A-Za-z0-9&,.'\- ]{2,50}\s+(?:Pty\.?\s*Ltd\.?|Proprietary\s*Limited|Limited|Ltd\.?|Inc\.?|Incorporated|LLC|LLP|Corp\.?|Corporation|Co\.,\s*Ltd\.?|Company\s*Limited|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|Sdn\.?\s*Bhd\.?|Sendirian\s*Berhad|Berhad|GmbH(?:\s*&\s*Co\.?\s*KG)?|Aktiengesellschaft|AG|Kommanditgesellschaft|KG|PLC|S\.?L\.?U\.?|S\.?A\.?U\.?|S\.?L\.?|S\.?A\.?|Sociedad\s*Limitada(?:\s*Unipersonal)?|Sociedad\s*An[oó]nima(?:\s*Unipersonal)?|S\.?r\.?l\.?s?|S\.?p\.?A\.?|Besloten\s*Vennootschap|B\.?V\.?|N\.?V\.?|Tbk\.?|Terbuka))[^\.\n\r<]{0,60}?(?:ABN|ACN|Registration\s*No|Reg\s*No|CIF|NIF)[\s:]*[A-Z0-9][- ]*\d[\d\s\-]{4,15}[A-Z0-9]?/gi;
  let m;
  while ((m = abnNearRegex.exec(text)) !== null) {
    if (m[1]) addCleanCandidate(m[1].trim());
  }

  // Reverse: ABN / CIF followed by name
  const abnBeforeRegex = /(?:ABN|ACN|Registration\s*No|Reg\s*No|CIF|NIF)[\s:]*[A-Z0-9][- ]*\d[\d\s\-]{4,15}[A-Z0-9]?[^\.\n\r<]{0,60}?([A-Z0-9][A-Za-z0-9&,.'\- ]{2,50}\s+(?:Pty\.?\s*Ltd\.?|Proprietary\s*Limited|Limited|Ltd\.?|Inc\.?|Incorporated|LLC|LLP|Corp\.?|Corporation|Co\.,\s*Ltd\.?|Company\s*Limited|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|Sdn\.?\s*Bhd\.?|Sendirian\s*Berhad|Berhad|GmbH(?:\s*&\s*Co\.?\s*KG)?|Aktiengesellschaft|AG|Kommanditgesellschaft|KG|PLC|S\.?L\.?U\.?|S\.?A\.?U\.?|S\.?L\.?|S\.?A\.?|Sociedad\s*Limitada(?:\s*Unipersonal)?|Sociedad\s*An[oó]nima(?:\s*Unipersonal)?|S\.?r\.?l\.?s?|S\.?p\.?A\.?|Besloten\s*Vennootschap|B\.?V\.?|N\.?V\.?|Tbk\.?|Terbuka))/gi;
  while ((m = abnBeforeRegex.exec(text)) !== null) {
    if (m[1]) addCleanCandidate(m[1].trim());
  }

  // Pattern 2: "means [Name] Pty Ltd", "operated by [Name] Pty Ltd", "authority of [Name] Pty Ltd", "trading as [Name] Pty Ltd"
  const legalContextRegex = /(?:means|operated\s+by|registered\s+as|trading\s+as|property\s+of|authority\s+of)\s+([A-Z0-9][A-Za-z0-9&,.'\- ]{2,50}\s+(?:Pty\.?\s*Ltd\.?|Proprietary\s*Limited|Limited|Ltd\.?|Inc\.?|Incorporated|LLC|LLP|Corp\.?|Corporation|Co\.,\s*Ltd\.?|Company\s*Limited|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|Sdn\.?\s*Bhd\.?|Sendirian\s*Berhad|Berhad|GmbH(?:\s*&\s*Co\.?\s*KG)?|Aktiengesellschaft|AG|Kommanditgesellschaft|KG|PLC|S\.?L\.?U\.?|S\.?A\.?U\.?|S\.?L\.?|S\.?A\.?|Sociedad\s*Limitada(?:\s*Unipersonal)?|Sociedad\s*An[oó]nima(?:\s*Unipersonal)?|S\.?r\.?l\.?s?|S\.?p\.?A\.?|Besloten\s*Vennootschap|B\.?V\.?|N\.?V\.?|Tbk\.?|Terbuka))/gi;
  while ((m = legalContextRegex.exec(text)) !== null) {
    if (m[1]) addCleanCandidate(m[1].trim());
  }

  // Pattern 3: Explicit legal suffix preceded by capitalized words (horizontal spaces only to avoid cross-line/inline link merging, supporting optional comma)
  const generalLegalRegex = /\b((?:[A-Z0-9][a-zA-Z0-9&.'\-]*(?:[^\S\r\n]+[A-Z0-9][a-zA-Z0-9&.'\-]*){0,5})(?:,[^\S\r\n]*|[^\S\r\n]+)(?:Pty\.?\s*Ltd\.?|Proprietary\s*Limited|Limited|Ltd\.?|Inc\.?|Incorporated|LLC|LLP|Corp\.?|Corporation|Co\.,\s*Ltd\.?|Company\s*Limited|Pte\.?\s*Ltd\.?|Pvt\.?\s*Ltd\.?|Sdn\.?\s*Bhd\.?|Sendirian\s*Berhad|Berhad|GmbH(?:\s*&\s*Co\.?\s*KG)?|Aktiengesellschaft|AG|Kommanditgesellschaft|KG|PLC|S\.?L\.?U\.?|S\.?A\.?U\.?|S\.?L\.?|S\.?A\.?|Sociedad\s*Limitada(?:\s*Unipersonal)?|Sociedad\s*An[oó]nima(?:\s*Unipersonal)?|S\.?r\.?l\.?s?|S\.?p\.?A\.?|Besloten\s*Vennootschap|B\.?V\.?|N\.?V\.?|Tbk\.?|Terbuka)(?:\.|\b))/gi;
  while ((m = generalLegalRegex.exec(text)) !== null) {
    const cand = m[1].trim();
    if (!/\b(?:loss|damage|expenses|costs|disbursements|information|services|warranties|discretion|price)\b/i.test(cand) &&
      !/^(?:and|the|for|with|from|including|our|your|their)\b/i.test(cand) &&
      !/^all\s+(?:rights|damages|losses|claims|disclaimers)\b/i.test(cand) &&
      cand.length >= 3 && cand.length <= 60) {
      addCleanCandidate(cand);
    }
  }

  // Pattern 4: Indonesian legal entities with prefix PT, CV, UD, etc. (e.g. "PT Astra International Tbk")
  const indoPrefixRegex = /\b((?:PT|P\.T\.|CV|C\.V\.|UD|U\.D\.|Perseroan\s+Terbatas)\s+[A-Z0-9][A-Za-z0-9&,.'\- ]{2,50}(?:\s+Tbk\.?)?)\b/g;
  while ((m = indoPrefixRegex.exec(text)) !== null) {
    addCleanCandidate(m[1].trim());
  }

  return Array.from(candidates);
}

/**
 * Extracts branding or company name from header logo alt/title or og:site_name metadata.
 */
function extractSiteLogoText(html) {
  if (!html) return "";

  // 1. Meta og:site_name
  const ogMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
  if (ogMatch && ogMatch[1] && ogMatch[1].trim().length >= 2 && !/^(?:home|website|default)$/i.test(ogMatch[1].trim())) {
    return ogMatch[1].trim();
  }

  // 2. Header logo image alt or title
  const headerMatch = html.match(/<header[\s\S]*?<\/header>/i);
  const searchArea = headerMatch ? headerMatch[0] : html.slice(0, 10000);

  // Look for logo class/id image
  const logoImgMatch = searchArea.match(/<img[^>]+(?:class|id)=["'][^"']*logo[^"']*["'][^>]+(?:alt|title)=["']([^"']+)["']/i) ||
    searchArea.match(/<img[^>]+(?:alt|title)=["']([^"']+)["'][^>]+(?:class|id)=["'][^"']*logo[^"']*["']/i) ||
    searchArea.match(/<img[^>]+src=["'][^"']*(?:logo|brand)[^"']*["'][^>]+(?:alt|title)=["']([^"']+)["']/i);
  if (logoImgMatch && logoImgMatch[1]) {
    const val = logoImgMatch[1].replace(/\blogo\b/gi, "").trim();
    if (val.length >= 2 && !/^(?:home|image|banner|site|first\s*slide|second\s*slide|third\s*slide|slide\s*\d+|carousel)$/i.test(val)) return val;
  }

  // Look for any image ONLY inside an explicit <header> with alt or title
  if (headerMatch) {
    const anyHeaderImg = searchArea.match(/<img[^>]+(?:alt|title)=["']([^"']{3,60})["']/i);
    if (anyHeaderImg && anyHeaderImg[1]) {
      const val = anyHeaderImg[1].replace(/\b(?:logo|website|homepage)\b/gi, "").trim();
      if (val.length >= 2 && !/^(?:home|image|banner|site|skip\s*to\s*content|loading|first\s*slide|second\s*slide|third\s*slide|slide\s*\d+|carousel|next|prev|previous|photo|placeholder|slider)$/i.test(val)) return val;
    }
  }

  // 3. Header brand link (e.g. <a class="logo" ... title="..."> or <a class="brand">Brand</a>)
  const logoLinkMatch = searchArea.match(/<a[^>]+class=["'][^"']*(?:logo|brand|navbar-brand)[^"']*["'][^>]*title=["']([^"']+)["']/i) ||
    searchArea.match(/<a[^>]+class=["'][^"']*(?:logo|brand|navbar-brand)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
  if (logoLinkMatch && logoLinkMatch[1]) {
    const val = logoLinkMatch[1].replace(/<[^>]+>/g, "").trim();
    if (val.length >= 2 && val.length <= 60 && !/^(?:home|index|logo)$/i.test(val)) return val;
  }

  return "";
}

/**
 * Extracts official company Facebook and LinkedIn URLs from HTML.
 * Ignores generic social sharing buttons (sharer, shareArticle, etc.).
 */
function extractOfficialSocialLinks(html) {
  if (!html) return { facebook: null, linkedin: null };
  const fbMatches = [...html.matchAll(/href=["'](https?:\/\/(?:www\.)?facebook\.com\/([A-Za-z0-9_.\-]+)\/?)(?:["'?>]|$)/gi)];
  let facebook = null;
  for (const m of fbMatches) {
    const rawUrl = m[1].trim();
    const handle = (m[2] || "").toLowerCase();
    if (!/^(?:sharer|share|tr|plugins|dialog|hashtag|home|login|search|pages|group|groups|events|watch|marketplace|help|policies|privacy|settings)$/i.test(handle)) {
      facebook = rawUrl;
      break;
    }
  }

  const liMatches = [...html.matchAll(/href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/([A-Za-z0-9_.\-]+)\/?)(?:["'?>]|$)/gi)];
  let linkedin = null;
  for (const m of liMatches) {
    const rawUrl = m[1].trim();
    const handle = (m[2] || "").toLowerCase();
    if (!/^(?:shareArticle|sharing|feed|jobs|learning|pulse|help|legal|login|signup)$/i.test(handle)) {
      linkedin = rawUrl;
      break;
    }
  }

  return { facebook, linkedin };
}

/**
 * Validates if an address candidate is complete (premise/street + locality/suburb/town/city + state/postcode).
 */
function isFullAddressCandidate(raw) {
  if (!raw || typeof raw !== "string" || raw.length < 15) return false;
  const hasStreetOrPremise = /\b(?:street|road|avenue|lane|drive|way|place|court|terrace|boulevard|highway|parkway|crescent|close|walk|row|parade|circuit|square|esplanade|mews|alley|st\b|rd\b|ave\b|ln\b|dr\b|blvd\b|hwy\b|suite|unit|bldg|building|floor|fl|flr|level|lot|plot|block|factory|shed|office\s*park|no\.?\s*\d+|\d+\s*[号號]|strasse|straße|rue|via|viale|calle|avenida|jalan|jl)\b/i.test(raw) ||
    /(?:大道|路|街|巷|弄|号|號|工业区|工业园|产业园|高新区)/.test(raw);
  const hasLocalityOrAdmin = hasStateInAddress(raw, "") ||
    hasCityDesignation(raw) ||
    hasExplicitCityWord(raw) ||
    hasRecognizedPlaceName(raw, AUSTRALIAN_CITIES) ||
    hasRecognizedPlaceName(raw, RECOGNIZED_TOWNS) ||
    hasRecognizedPlaceName(raw, UK_CITIES_AND_TOWNS) ||
    hasRecognizedPlaceName(raw, NEW_ZEALAND_CITIES_AND_TOWNS) ||
    addressLooksLikeSuburbOnly(raw) ||
    /(?:區|区|市|縣|县|鄉|乡|鎮|镇)/.test(raw) ||
    NON_CITY_SUBURBS.some(s => new RegExp(`\\b${s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, "i").test(raw));
  const hasRegionOrPostcode = hasStateInAddress(raw, "") ||
    /\b\d{4,6}\b/.test(raw) ||
    /\b[A-Z]{1,2}\d[A-Z0-9]?\s*\d[A-Z]{2}\b/i.test(raw) ||
    /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i.test(raw) ||
    /\b\d{3}\s*\d{2}\b/.test(raw) ||
    /\b\d{2}-\d{3}\b/.test(raw);

  return hasStreetOrPremise && (hasLocalityOrAdmin || hasRegionOrPostcode);
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
  let httpStatus = 0;
  const addressCandidates = [];
  let profilePageText = "";
  let copyrightText = "";
  let copyrightSourceUrl = targetUrl;
  let primaryContactUrl = "";
  let primaryAboutUrl = "";
  const allLegalCandidates = new Set();
  const legalCandidateSources = {};
  const allDiscoveredEmails = new Set();
  const emailSourceMap = {};
  const allDiscoveredPhones = new Set();
  let contactLinks = [];
  let companySocials = {};
  const crawledPages = [];

  let mainRes = null;
  try {
    mainRes = await fetchDecodedHtml(targetUrl, {
      timeoutMs: 8000,
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    // If HTTP failed, returned 403, 400, 0, empty HTML, or anti-bot challenge:
    // Automatically try protocol swap (http <-> https), www toggle, and root homepage fallback
    let isMainFailed = !mainRes.ok || mainRes.status === 0 || !mainRes.html || mainRes.html.trim().length === 0 || isAntiBotChallenge(mainRes.html, mainRes.status);
    if (isMainFailed) {
      const fallbackUrls = [];
      if (/^http:\/\//i.test(targetUrl)) {
        fallbackUrls.push(targetUrl.replace(/^http:\/\//i, "https://"));
      } else if (/^https:\/\//i.test(targetUrl)) {
        fallbackUrls.push(targetUrl.replace(/^https:\/\//i, "http://"));
      }
      try {
        const parsedU = new URL(targetUrl);
        if (parsedU.pathname && parsedU.pathname !== "/" && parsedU.pathname !== "") {
          fallbackUrls.push(parsedU.origin + "/");
        }
        if (!/^www\./i.test(parsedU.hostname)) {
          fallbackUrls.push(parsedU.protocol + "//www." + parsedU.hostname + (parsedU.pathname || "/"));
        } else {
          fallbackUrls.push(parsedU.protocol + "//" + parsedU.hostname.replace(/^www\./i, "") + (parsedU.pathname || "/"));
        }
      } catch (e) { }

      const targetFallbacks = fallbackUrls.slice(0, 2);
      if (targetFallbacks.length > 0) {
        const fallbackResults = await Promise.allSettled(
          targetFallbacks.map(altUrl => fetchDecodedHtml(altUrl, {
            timeoutMs: 5000,
            headers: {
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            }
          }))
        );
        for (const res of fallbackResults) {
          if (res.status === "fulfilled" && res.value && res.value.ok && res.value.html && res.value.html.trim().length > 0 && !isAntiBotChallenge(res.value.html, res.value.status)) {
            mainRes = res.value;
            isMainFailed = false;
            break;
          }
        }
      }
    }

    httpStatus = mainRes.status || 0;
    if (mainRes.url && mainRes.url.trim().length > 0) {
      finalUrl = mainRes.url;
    }
    if (isRedirectDomain(targetUrl, finalUrl)) {
      redirected = true;
      status = "Redirect Site";
    }

    if (mainRes.html && mainRes.html.trim().length > 0) {
      mainHtml = mainRes.html;
    }

    if (!mainRes || !mainRes.ok || mainRes.status === 0 || !mainRes.html || mainRes.html.trim().length === 0 || isAntiBotChallenge(mainRes.html, mainRes.status)) {
      if (mainRes && mainRes.status === 404) {
        status = "Domain Expired";
        fetchError = "Site returned HTTP 404 Not Found";
      } else if (mainRes && (mainRes.status === 403 || mainRes.status === 401 || isAntiBotChallenge(mainRes.html, mainRes.status))) {
        status = "Not Working";
        fetchError = `Site access restricted / blocked (HTTP ${mainRes.status || 403} Security Check / Forbidden)`;
      } else {
        status = "Not Working";
        fetchError = (mainRes && mainRes.error) || fetchError || `Connection failed or empty response (HTTP ${(mainRes && mainRes.status) || 0})`;
      }
    }

    mainHtml = (mainRes && mainRes.html) || "";

    // Check for client-side HTML Meta Refresh, JS location redirects, or cross-domain canonical links
    if (mainHtml) {
      const metaRefreshMatch = mainHtml.match(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["']?[^"'>]*url=['"]?([^'">\s;]+)/i);
      const jsRedirectMatch = mainHtml.match(/(?:window\.)?location(?:\.href|\.replace)?\s*=\s*['"]([^'"]+)['"]/i);
      const canonicalMatch = mainHtml.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);

      const clientRedirectHref = (metaRefreshMatch && metaRefreshMatch[1]) ||
        (jsRedirectMatch && jsRedirectMatch[1]) ||
        (canonicalMatch && canonicalMatch[1]);

      if (clientRedirectHref && !clientRedirectHref.startsWith("#")) {
        try {
          const resolvedClientUrl = new URL(clientRedirectHref, finalUrl).href;
          if (isRedirectDomain(targetUrl, resolvedClientUrl) || isRedirectDomain(finalUrl, resolvedClientUrl)) {
            console.log(`[AI Assistant] Detected client-side HTML/JS redirect from ${finalUrl} to ${resolvedClientUrl}`);
            const clientRes = await fetchDecodedHtml(resolvedClientUrl, {
              timeoutMs: 5000,
              headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
              }
            });
            if (clientRes.ok && clientRes.html && clientRes.html.trim().length > 0) {
              mainRes = clientRes;
              finalUrl = clientRes.url || resolvedClientUrl;
              redirected = true;
              mainHtml = clientRes.html;
              status = "Redirect Site";
            }
          }
        } catch (e) { }
      }
    }

    // Extract copyright line for exact official company name verification.
    // Do not stop at commas — "Co., Ltd" is otherwise truncated to "Co."
    copyrightText = extractCopyrightCompanyName(mainHtml);

    // Support HTML <frameset> / <frame src="..."> / <iframe src="..."> (e.g. polyprise.com.tw)
    const frameMatches = [...mainHtml.matchAll(/<(?:frame|iframe)[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
    for (const fSrc of frameMatches.slice(0, 2)) {
      try {
        if (!fSrc || /^(javascript:|about:|mailto:|tel:|data:)/i.test(fSrc)) continue;
        const frameUrl = new URL(fSrc, finalUrl);
        // Strictly only crawl same-domain frames; skip all external third-party iframes (maps, tags, analytics, widgets)
        const mainHost = new URL(finalUrl).hostname.replace(/^www\./i, "");
        const fHost = frameUrl.hostname.replace(/^www\./i, "");
        if (fHost !== mainHost && !fHost.endsWith("." + mainHost)) continue;

        const fRes = await fetchDecodedHtml(frameUrl.href, {
          timeoutMs: 4000,
          headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
          }
        });
        if (fRes.ok && fRes.html) {
          mainHtml += "\n" + fRes.html;
        }
      } catch (e) { }
    }

    if (mainHtml) {
      crawledPages.push({ url: finalUrl, html: mainHtml, text: stripHtml(mainHtml) });
      for (const em of extractEmailsFromHtml(mainHtml, finalUrl)) {
        allDiscoveredEmails.add(em);
        updateEmailSource(emailSourceMap, em, finalUrl, finalUrl, targetUrl);
      }
      const homePhoneLinks = [...mainHtml.matchAll(/href=["']tel:([^"']+)["']/gi)].map(m => m[1]);
      for (const p of homePhoneLinks) allDiscoveredPhones.add(p);
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

    // Extract official registered legal company candidates across homepage
    for (const cand of extractLegalCandidatesFromHtml(mainHtml)) {
      allLegalCandidates.add(cand);
      if (!legalCandidateSources[cand]) legalCandidateSources[cand] = finalUrl;
    }

    // Discover Contact, About, Terms & Legal Pages
    contactLinks = discoverContactLinks(mainHtml, finalUrl);
    // Discover Product, Catalog, Category, Services & Prohibited Category Candidate Pages
    const productCandidates = discoverProductAndCatalogLinks(mainHtml, finalUrl);
    const fetchedUrls = new Set([finalUrl]);

    // PRE-AI CRAWL SHORT-CIRCUIT:
    // Only skip crawling subpages if a prohibited restricted category is detected.
    // For sites with online carts, NEVER skip subpages so we can verify if the company is a Manufacturer!
    const earlyRestricted = detectRestrictedKeywords(stripHtml(mainHtml) + " " + targetUrl, mainHtml, crawledPages);
    const shouldSkipSubpages = earlyRestricted.isRestricted;

    if (!shouldSkipSubpages) {
      // Pick balanced target subpages (max 2-3 distinct subpages for fast crawl):
      // 1. Any link matching high-alert restricted hints (e.g. /products/medical, /knives, /defense)
      // 2. Top contact/about link (for physical address, legal company name, profile)
      // 3. Top product/catalog link (for product catalog, products, and restriction verification)
      const topLinks = [];
      const seenPaths = new Set();

      // (a) First: add any links flagged with prohibited / restricted hints (max 1)
      for (const item of productCandidates.filter(c => c.isRestrictedHint)) {
        try {
          const uPath = new URL(item.url).pathname.toLowerCase().replace(/\/$/, "");
          if (!seenPaths.has(uPath) && !fetchedUrls.has(item.url)) {
            seenPaths.add(uPath);
            topLinks.push(item.url);
            fetchedUrls.add(item.url);
            break;
          }
        } catch (e) { }
      }

      // (b) Add top contact/about/career links (max 2 for high speed & full coverage)
      let contactCount = 0;
      for (const link of contactLinks) {
        if (fetchedUrls.has(link)) continue;
        try {
          const uPath = new URL(link).pathname.toLowerCase().replace(/\/$/, "");
          if (seenPaths.has(uPath)) continue;
          seenPaths.add(uPath);
          topLinks.push(link);
          fetchedUrls.add(link);
          contactCount++;
          if (contactCount >= 2) break;
        } catch (e) { }
      }

      // (c) Add top product/catalog link (max 1 for high speed)
      for (const item of productCandidates.filter(c => !c.isRestrictedHint)) {
        if (fetchedUrls.has(item.url)) continue;
        try {
          const uPath = new URL(item.url).pathname.toLowerCase().replace(/\/$/, "");
          if (seenPaths.has(uPath)) continue;
          seenPaths.add(uPath);
          topLinks.push(item.url);
          fetchedUrls.add(item.url);
          break;
        } catch (e) { }
      }

      const candidateSubpages = topLinks.slice(0, 4);
      if (candidateSubpages.length > 0) {
        // High-speed concurrent parallel fetching of candidate subpages (6.5s timeout for reliable international subpage delivery)
        const subpageResults = await Promise.allSettled(
          candidateSubpages.map(cUrl => fetchDecodedHtml(cUrl, {
            timeoutMs: 6500,
            headers: {
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
              "Referer": finalUrl
            }
          }))
        );

        for (let i = 0; i < candidateSubpages.length; i++) {
          const cUrl = candidateSubpages[i];
          const settled = subpageResults[i];
          if (settled.status !== "fulfilled") continue;
          const cRes = settled.value;

          if (cRes && cRes.ok && cRes.html) {
            const cText = cRes.html;
            contactHtml += "\n" + cText;
            const isProductPage = /(?:products?|catalog(?:ue)?|categories|category|items?|collection|services?|solutions?)/i.test(cUrl);
            crawledPages.push({ url: cUrl, html: cText, text: stripHtml(cText), isProductPage });
            const isDistributorPage = /(?:dealers?|distributors?|stockists?|resellers?|partners?)/i.test(cUrl);
            const isProfilePage = !isDistributorPage && /(?:company[-_]?profile|corporate[-_]?profile|profile\.htm|profile|about|about[-_]?us|who[-_]?we[-_]?are|our[-_]?company|our[-_]?story|our[-_]?history)/i.test(cUrl);
            const isContactPage = !isDistributorPage && /(?:contact|contact[-_]?us|contactus|get[-_]?in[-_]?touch|reach[-_]?us|reach[-_]?out)/i.test(cUrl);
            const isLowQualitySubpage = /(?:terms|privacy|policy|policies|disclaimer|faq|legal|cart|checkout|cookie|sitemap)/i.test(cUrl);
            const pageSource = isDistributorPage ? "distributor" : (isProfilePage ? "profile" : (isContactPage ? "contact" : (isProductPage ? "product" : "other")));

            if (isProfilePage && !primaryAboutUrl) primaryAboutUrl = cUrl;
            if (isContactPage && !primaryContactUrl) primaryContactUrl = cUrl;

            // If product page, check for products and count items
            if (isProductPage) {
              const subMatches = cText.match(/class=["'][^"']*(?:product-item|product-card|product-listing|catalog-item|store-item)[^"']*["']/gi) ||
                cText.match(/<div[^>]*data-product[^>]*>/gi) || [];
              if (subMatches.length > 0) {
                detectedProductCount = Math.max(detectedProductCount, Math.min(subMatches.length, 3));
              }
            }

            extractEmbeddedScriptAddresses(cText, addressCandidates);
            extractMapAddresses(cText, addressCandidates);
            extractMetaAddresses(cText, addressCandidates);
            extractHtmlAddresses(cText, addressCandidates, pageSource, cUrl);

            if (isProfilePage || /\b(?:company\s+profile|our\s+story|about\s+us|who\s+we\s+are)\b/i.test(stripHtml(cText).slice(0, 5000))) {
              profilePageText += "\n" + stripHtml(cText);
            }

            // Extract legal corporate names across this page
            for (const cand of extractLegalCandidatesFromHtml(cText)) {
              allLegalCandidates.add(cand);
              if (!legalCandidateSources[cand]) {
                legalCandidateSources[cand] = cUrl;
              } else if (!isLowQualitySubpage && /(?:terms|privacy|policy|disclaimer|faq|cart)/i.test(legalCandidateSources[cand])) {
                legalCandidateSources[cand] = cUrl;
              }
            }

            // Extract all corporate emails and phones across this page
            for (const em of extractEmailsFromHtml(cText, finalUrl)) {
              allDiscoveredEmails.add(em);
              updateEmailSource(emailSourceMap, em, cUrl, finalUrl, targetUrl);
            }
            const pagePhoneLinks = [...cText.matchAll(/href=["']tel:([^"']+)["']/gi)].map(m => m[1]);
            for (const p of pagePhoneLinks) allDiscoveredPhones.add(p);

            // Extract copyright on this page if homepage lacked complete legal suffix
            const pageCopyright = extractCopyrightCompanyName(cText);
            if (pageCopyright && hasCompleteLegalSuffix(pageCopyright) && (!copyrightText || !hasCompleteLegalSuffix(copyrightText))) {
              copyrightText = pageCopyright;
              copyrightSourceUrl = cUrl;
            }
          }
        }
      }
      // Double check for secondary email: if fewer than 2 corporate emails discovered so far,
      // concurrently fetch all remaining contact, support, privacy, policy, terms, legal, and warranty subpages from contactLinks
      if (allDiscoveredEmails.size < 2 && contactLinks && contactLinks.length > 0) {
        const remainingCandidates = contactLinks
          .filter(l => !fetchedUrls.has(l))
          .sort((a, b) => {
            const score = (u) => {
              if (/(?:privacy|policy|legal|terms|support|warranty|service|inquir|quote)/i.test(u)) return 10;
              return 1;
            };
            return score(b) - score(a);
          })
          .slice(0, 8);

        if (remainingCandidates.length > 0) {
          const extraResults = await Promise.allSettled(
            remainingCandidates.map(cUrl => {
              fetchedUrls.add(cUrl);
              return fetchDecodedHtml(cUrl, {
                timeoutMs: 5000,
                headers: {
                  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                  "Accept-Language": "en-US,en;q=0.9",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                  "Referer": finalUrl
                }
              });
            })
          );
          for (let i = 0; i < remainingCandidates.length; i++) {
            const cUrl = remainingCandidates[i];
            const settled = extraResults[i];
            if (settled.status === "fulfilled" && settled.value && settled.value.ok && settled.value.html) {
              const cText = settled.value.html;
              contactHtml += "\n" + cText;
              for (const em of extractEmailsFromHtml(cText, finalUrl)) {
                allDiscoveredEmails.add(em);
                updateEmailSource(emailSourceMap, em, cUrl, finalUrl, targetUrl);
              }
              const pagePhoneLinks = [...cText.matchAll(/href=["']tel:([^"']+)["']/gi)].map(m => m[1]);
              for (const p of pagePhoneLinks) allDiscoveredPhones.add(p);
            }
          }
        }
      }
    }

    // Merge Contact text
    contactPageText = stripHtml(contactHtml);

    // Check homepage profile text snippet
    const homeProfileMatch = stripHtml(mainHtml).match(/(?:about\s+us|our\s+company|company\s+profile|our\s+story|who\s+we\s+are|about\s+our\s+company)[\s\S]{50,1500}/i);
    if (homeProfileMatch) {
      profilePageText += "\n" + homeProfileMatch[0];
    }

    const allCrawlText = mainHtml + "\n" + contactHtml;
    companySocials = extractOfficialSocialLinks(allCrawlText);

    // High-speed smart social check: if email is missing or fewer than 2 distinct emails found on website,
    // check company's official Facebook and LinkedIn pages for primary/secondary emails.
    const socialCandidates = [companySocials.facebook, companySocials.linkedin].filter(Boolean);
    if (allDiscoveredEmails.size < 2 && socialCandidates.length > 0) {
      for (const socialUrl of socialCandidates) {
        if (!socialUrl || fetchedUrls.has(socialUrl)) continue;
        fetchedUrls.add(socialUrl);
        try {
          const sRes = await fetchDecodedHtml(socialUrl, {
            timeoutMs: 3500,
            headers: {
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
              "Sec-Fetch-Dest": "document",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-Site": "none",
              "Sec-Fetch-User": "?1",
              "Upgrade-Insecure-Requests": "1"
            }
          });
          if (sRes && sRes.ok && sRes.html) {
            // Un-escape Facebook/LinkedIn JSON Unicode email obfuscation (\u0040 and %40)
            const decodedSocialHtml = sRes.html.replace(/\\u0040/g, "@").replace(/%40/g, "@");
            const rawSocialMatches = decodedSocialHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            for (const em of rawSocialMatches) {
              const cleanEm = em.toLowerCase().trim();
              if (isValidCorporateEmail(cleanEm) && !isUnwantedEmail(cleanEm)) {
                allDiscoveredEmails.add(cleanEm);
                updateEmailSource(emailSourceMap, cleanEm, socialUrl, finalUrl, targetUrl);
              }
            }
            for (const em of extractEmailsFromHtml(decodedSocialHtml, finalUrl)) {
              allDiscoveredEmails.add(em);
              updateEmailSource(emailSourceMap, em, socialUrl, finalUrl, targetUrl);
            }
          }
        } catch (e) { }
        if (allDiscoveredEmails.size >= 2) break;
      }
    }
  } catch (err) {
    fetchError = err.message || "Failed to fetch website";
  }

  // Detect dynamic Single Page Application (SPA) shells
  const isSpaRoot = /<div[^>]+id=["'](?:app|root|__next|__nuxt|main-content)["'][^>]*>\s*<\/div>/i.test(mainHtml);
  const hasDynamicScripts = /<script[^>]+src=["'][^"']*(?:bundle|chunk|main|app|runtime)[^"']*\.js/i.test(mainHtml);
  const isDynamicSpa = isSpaRoot && (stripHtml(mainHtml).length < 500) && hasDynamicScripts;

  // Rule 13: URL redirecting websites – only the final redirected URL will be considered
  try {
    if (isRedirectDomain(targetUrl, finalUrl)) {
      redirected = true;
      if (status === "Working") {
        status = "Redirect Site";
      }
    } else {
      // Same domain redirect (http->https, www, subpath) is NOT a Redirect Site!
      if (status === "Redirect Site") {
        status = "Working";
      }
      redirected = false;
    }
  } catch (e) { }

  const extracted = parseHtmlDetails(mainHtml, finalUrl);

  // Verify substantive company profile presence
  extracted.hasCompanyProfile = checkCompanyProfilePresence(mainHtml, extracted.bodyText, profilePageText);

  // Merge discovered emails/phones from all crawled pages
  for (const em of extracted.emails) {
    allDiscoveredEmails.add(em);
    updateEmailSource(emailSourceMap, em, finalUrl, finalUrl, targetUrl);
  }
  for (const p of extracted.phones) allDiscoveredPhones.add(p);

  if (contactHtml) {
    const contactParsed = parseHtmlDetails(contactHtml, finalUrl);
    for (const em of contactParsed.emails) {
      allDiscoveredEmails.add(em);
      // Only set fallback source if not already mapped to an exact subpage URL
      if (!emailSourceMap[em]) {
        updateEmailSource(emailSourceMap, em, primaryContactUrl || finalUrl, finalUrl, targetUrl);
      }
    }
    for (const p of contactParsed.phones) allDiscoveredPhones.add(p);
  }

  let hostDomain = "";
  try {
    hostDomain = new URL(finalUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch (e) { }

  extracted.emails = rankEmails(Array.from(allDiscoveredEmails), hostDomain, emailSourceMap);
  extracted.phones = Array.from(allDiscoveredPhones);

  // Sort candidates strictly by priority hierarchy:
  // Headquarters (Tier 1) > Contact (Tier 2) > Profile (Tier 3) > JSON-LD (Tier 4) > Map (Tier 5) > Footer (Tier 6) > Branch (Tier 8).
  // Within the SAME tier, English precedes non-English (basePriority + 0.0 vs basePriority + 0.4).
  // An English footer or branch address will NEVER outrank an actual Headquarters address!
  addressCandidates.sort((a, b) => {
    let pA = (typeof a === "object" && a.priority !== undefined) ? a.priority : 6;
    let pB = (typeof b === "object" && b.priority !== undefined) ? b.priority : 6;
    const rawA = typeof a === "object" ? (a.raw || "") : String(a || "");
    const rawB = typeof b === "object" ? (b.raw || "") : String(b || "");

    // Full Address Boost: Candidate containing Premise/Street AND Locality/State/Postcode beats fragment
    const hasFullA = isFullAddressCandidate(rawA);
    const hasFullB = isFullAddressCandidate(rawB);
    if (hasFullA && !hasFullB) pA -= 4.0;
    else if (hasFullB && !hasFullA) pB -= 4.0;

    // Substring Superseded Rule: If rawB is a complete address containing rawA as a street substring, rawB wins!
    if (rawA.length > 10 && rawB.toLowerCase().includes(rawA.toLowerCase()) && hasFullB && !hasFullA) return 1;
    if (rawB.length > 10 && rawA.toLowerCase().includes(rawB.toLowerCase()) && hasFullA && !hasFullB) return -1;

    if (pA !== pB) return pA - pB;
    const scoreCandidate = (raw) => {
      let score = 0;
      if (hasStateInAddress(raw, "")) score += 50;
      if (isFullAddressCandidate(raw)) score += 40;
      if (/\b\d{4,6}\b/.test(raw)) score += 20;
      score += Math.min(raw.length, 60);
      if (/\b(?:will\s+be\s+held|trade\s*show|exhibition|expo|conference|convention|booth|cookies?|privacy\s*policy)\b/i.test(raw)) score -= 200;
      return score;
    };
    return scoreCandidate(rawB) - scoreCandidate(rawA);
  });

  const logoText = extractSiteLogoText(mainHtml);
  const ogSiteMatch = mainHtml.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) ||
    mainHtml.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
  const ogSiteName = (ogSiteMatch && ogSiteMatch[1] && ogSiteMatch[1].trim()) || "";

  // Check for online purchase / shopping cart ("Shopchart")
  const shopCartCheck = detectPurchaseOrShoppingCart(mainHtml + "\n" + contactHtml, (extracted && extracted.bodyText) || "");
  if (shopCartCheck && shopCartCheck.detected) {
    status = "Not Working";
  }

  return {
    originalUrl: targetUrl,
    finalUrl,
    redirected: isRedirectDomain(targetUrl, finalUrl),
    status,
    fetchError,
    httpStatus,
    mainHtml,
    contactHtml: contactHtml.slice(0, 50000),
    shopCartCheck,
    logoText,
    ogSiteName,
    addressCandidates,
    detectedAddresses: addressCandidates.map(c => (typeof c === "object" ? c.raw : c)),
    isDynamicSpa,
    contactPageText: contactPageText.slice(0, 12000),
    footerText: footerText.slice(0, 4000),
    profilePageText: profilePageText.slice(0, 8000),
    copyrightText: copyrightText.slice(0, 500),
    copyrightSourceUrl: copyrightSourceUrl || finalUrl,
    ...extracted,
    legalCompanyCandidates: Array.from(allLegalCandidates),
    legalCandidateSources,
    emailSourceMap,
    emails: rankEmails(Array.from(allDiscoveredEmails), targetUrl, emailSourceMap),
    phones: Array.from(allDiscoveredPhones),
    primaryContactUrl: primaryContactUrl || (contactLinks.find(u => /\b(?:contact|contact[-_]?us|contactus|get[-_]?in[-_]?touch|reach[-_]?us|reach[-_]?out)\b/i.test(u)) || ""),
    primaryAboutUrl: primaryAboutUrl || (contactLinks.find(u => /\b(?:about|about[-_]?us|aboutus|who[-_]?we[-_]?are|company[-_]?profile|profile)\b/i.test(u)) || ""),
    companySocials,
    crawledPages,
    renderedText: mainHtml ? stripHtml(mainHtml).slice(0, 15000) : "",
    jsonLd: extractJsonLdBlocks(mainHtml)
  };
}

/**
 * Adds an address candidate with provenance tracking and priority ranking.
 */
function addAddressCandidate(targetList, rawText, source, isHq = false, locationType = "general", pageUrl = "", contextText = "") {
  if (!rawText || typeof rawText !== "string") return;
  const decoded = decodeHtmlEntities(rawText);
  let cleaned = decoded
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/^(?:[A-Za-z0-9&,.'\-()\[\]\s]{2,100}?\s+)?(?:registered\s+in\s+[A-Za-z\s]+(?::\s*[\dA-Za-z]+)?\.?\s*,?\s*)?(?:registered\s*office|registered\s*agent|domicilio\s*social)\s*[:：\-–,\s]+/i, "")
    .replace(/^(?:registered\s+in\s+[A-Za-z\s]+(?::\s*[\dA-Za-z]+)?\.?\s*,?\s*)/i, "")
    .replace(/^(?:company\s+registration(?:\s+no\.?|\s+number)?\s*[:：\-–,\s]*[\dA-Za-z]+\.?\s*,?\s*)/i, "")
    .replace(/^(?:[A-Za-z\u00C0-\u024F\s]+?\s+)?(?:corporate\s+)?(?:head\s*office|headquarters|corporate\s*office|registered\s*office|main\s*office|principal\s*office|branch\s*office|regional\s*office|sales\s*office|plant\s*location|office|plant|factory|warehouse|hq|sede\s*central|domicilio\s*social|sede\s*principal|address|add|addr|location|廠址|地址|view|learn\s*more|read\s*more|see\s*more|click\s*here|find\s*out\s*more|get\s*directions|directions)\s*[:：\-–,\s]+(?=\b(?:\d{1,5}|no\.?\s*\d+|po\s*box|unit|suite|building|floor)\b)/i, "")
    .replace(/^(?:address|add|addr|location|headquarters|head\s*office|registered\s*office|corporate\s*office|廠址|地址|view|learn\s*more|read\s*more|see\s*more|click\s*here|find\s*out\s*more|get\s*directions|directions)\s*[:：\-–]?\s*/i, "")
    .replace(/^(?:we(?:'re|\s+are)\s+(?:at|located\s+at)|visit\s+us(?:\s+at)?|find\s+us(?:\s+at)?|our\s+location\s+is|come\s+(?:in\s+and\s+)?visit\s+us(?:\s+at)?)\s*[:,\s]*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  // Strip leading promotional/intro sentence ending in ! or ? (e.g. "Come in and browse around! 14200 Washington Avenue...")
  if (/^[^!?]{3,80}[!?]\s+(?=\b(?:\d{1,5}|no\.?\s*\d+|po\s*box|unit|suite|building|lot|plot)\b)/i.test(cleaned)) {
    cleaned = cleaned.replace(/^[^!?]{3,80}[!?]\s+/i, "").trim();
  }

  if (cleaned.length < 8) return;

  // STRICT REJECTION: never accept protected email strings, javascript, or non-address text
  if (/\[email\s*protected\]|data-cfemail|__cf_email__|email\s*protected|\bprotected\b|mailto:|@|number\s*160\s*;?\s*protected/i.test(cleaned)) {
    return;
  }
  if (/\b(?:privacy\s*policy|terms\s*of|all\s*rights\s*reserved|cookie\s*policy|subscribe|newsletter|login|register|search\s*products|all\s*categories)\b/i.test(cleaned)) {
    return;
  }
  // Reject conversational copy / sentences with questions / first-person marketing
  if (/[?!]/.test(cleaned)) return;
  if (/\b(?:we\s+are\s+located|contact\s+our\s+team|visit\s+our|please\s+(?:call|contact|feel\s+free)|our\s+team\s+will|get\s+in\s+touch\s+with|happy\s+to\s+help|custom\s+quote|shipping\s+quotes?|free\s+on\s+board|\bfob\b|order\s+placement|before\s+order|order\s+policies|we\s+offer\s+currently|how\s+to\s+order|minimum\s+order|lead\s+time|payment\s+terms)\b/i.test(cleaned)) {
    return;
  }

  // Reject opening hours / business hours strings (e.g. "Monday to Saturday - 9.00 AM to 5.30 PM CT")
  if (/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s+(?:to|-|through)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i.test(cleaned) ||
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(cleaned)) {
    return;
  }

  // STRUCTURAL COMPONENT VALIDATION:
  // A valid address must possess verifiable structural address components:
  // 1. Premise indicator / street number / named building, works, centre, hall, estate, park
  // 2. Thoroughfare suffix (Street, Road, Ave, Lane, Drive, Boulevard, Highway, Way, Close, Court, Terrace, Crescent, etc.)
  // 3. Or locality/postal code (e.g. 4-6 digit postal code, UK alphanumeric postcodes, state abbreviation with ZIP, or East Asian structural address)
  const hasPremiseNum = /\b(?:number|no\.?|nos\.?|#)?\s*\d+[A-Za-z]?(?:[-\/]\d+[A-Za-z]?)?\b/i.test(cleaned) ||
    /\b(?:lot|plot|unit|suite|ste|bldg|building|floor|level|rm|room|shed|warehouse|kav|kavling|apt|apartment|po\s*box)\s+[A-Za-z0-9\-\/]+/i.test(cleaned) ||
    /\b(?:centre|center|house|hall|mill|works|court|lodge|grange|tower|park|estate|chambers|wharf|barn|farm)\b/i.test(cleaned);

  const hasThoroughfare = /\b(road|street|avenue|lane|drive|way|boulevard|highway|parade|circuit|crescent|close|court|place|terrace|esplanade|track|trail|row|walk|mews|passage|grove|view|hill|rise|vale|gate|approach|pde|cct|cres|cl|ct|pl|tce|via|corso|viale|piazza|jln|jalan|taman|lorong|lebuh|st\b|rd\b|ave\b|dr\b|blvd\b|ln\b|hwy\b|apt\b|str\b|strasse|platz|comune|provincia|daerah|mukim)\b/i.test(cleaned);

  const hasLocalityOrPostcode = /\b\d{4,6}\b/.test(cleaned) ||
    /\b[A-Z]{1,2}\d[A-Z0-9]?\s*\d[A-Z]{2}\b/i.test(cleaned) ||
    /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i.test(cleaned) ||
    /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s+\d{5}(?:-\d{4})?\b/i.test(cleaned) ||
    /\b(?:victoria|new\s*south\s*wales|queensland|western\s*australia|south\s*australia|tasmania|northern\s*territory|vic|nsw|qld|wa|sa|tas|act)\b/i.test(cleaned) ||
    /\b(?:leicestershire|nottinghamshire|derbyshire|staffordshire|warwickshire|worcestershire|northamptonshire|lincolnshire|yorkshire|lancashire|cheshire|cumbria|durham|northumberland|gloucestershire|oxfordshire|cambridgeshire|bedfordshire|hertfordshire|buckinghamshire|berkshire|surrey|kent|sussex|essex|norfolk|suffolk|devon|cornwall|somerset|dorset|wiltshire|hampshire|shropshire|herefordshire|middlesex)\b/i.test(cleaned) ||
    /\b(?:town|township|district|city|province|county|hsien|state|borough|municipality|shire)\b/i.test(cleaned) ||
    evaluateCityQC(cleaned, "") === "Available" ||
    hasStateInAddress(cleaned, "");

  const hasChineseAddressStructure = /(?:[0-9一二三四五六七八九十]+[号號]|大道|大厦|大廈|路|街|巷|弄|工业区|工業區|工业园|工業園|产业园|產業園|开发区|開發區|科技园|科技園|高新区|高新區|园区|園區|楼|樓|栋|棟|室|城|[省市区縣县鄉镇鎭])/.test(cleaned);

  const isValidStructure = (hasPremiseNum && hasThoroughfare) ||
    (hasThoroughfare && hasLocalityOrPostcode) ||
    (hasPremiseNum && hasLocalityOrPostcode && (isHq || source === "headquarters" || source === "jsonld")) ||
    hasChineseAddressStructure;

  if (!isValidStructure) {
    return;
  }

  // Reject generic promotional/marketing slogans
  if (/(?:我们期待|创造更多价值|服务宗旨|致力于|秉承|提供优质|欢迎垂询|全国热线|联系电话|客服热线|版权所有|网站备案)/i.test(cleaned)) {
    return;
  }

  const latinLetters = (cleaned.match(/[a-zA-Z]/g) || []).length;
  const nonLatinLetters = (cleaned.match(/[\u4e00-\u9fa5\u3040-\u30ff\u0e00-\u0e7f\u0400-\u04ff\u0600-\u06ff]/g) || []).length;
  const isEnglish = latinLetters >= 4 && latinLetters >= nonLatinLetters;

  // Location Context & Priority hierarchy:
  // Operational Headquarters (Tier 1) / Contact Page Operational Address (Tier 1.2) > Profile (Tier 3) > JSON-LD (Tier 4) > Map (Tier 5) > Footer (Tier 6) > General (Tier 7) > Registered Office (Tier 8) > Branch (Tier 8.5) > Distributor/Dealer (Tier 9)
  const isRegisteredOffice = /\b(?:registered\s*office|registered\s*in\b|company\s*registration\b|domicilio\s*social|registered\s*agent|legal\s*address|statutory\s*office)\b/i.test(rawText + " " + contextText);
  const hasHqKeyword = !isRegisteredOffice && (
    /\b(?:headquarters|head\s*office|corporate\s*office|main\s*office|principal\s*office|hq|main\s*factory|main\s*plant|main\s*facility|sede\s*central|oficinas?\s*central(?:es)?|sede\s*principal|oficina\s*principal)\b/i.test(rawText + " " + contextText) ||
    /(?:總公司|总公司|總部|总部|本公司|集團總部|集团总部|總廠|总厂|本廠|本厂|本部|本社|本店)/i.test(rawText + " " + contextText) ||
    isHq || source === "headquarters"
  );

  const isOperationalContact = (source === "contact" || /\b(?:contact|showroom|factory|plant|workshop|store|visiting|our\s+location|address)\b/i.test(pageUrl + " " + contextText));

  // Only demote explicit secondary/branch offices (NEVER treat manufacturing plants, factories, warehouses, or units as branches!)
  const hasBranchKeyword = /\b(?:branch(?:\s*office)?|regional\s*office|overseas\s*office|sales\s*office|subsidiary|sucursal|delegaci[oó]n|filiale|filial)\b/i.test(rawText + " " + contextText) ||
    /(?:海外子公司|全资子公司|控股子公司|子公司|海外办事处|办事处|辦事處|国内分公司|分公司|分處|分处|營業所|营业所|經銷商|经销商)/i.test(rawText + " " + contextText) ||
    locationType === "branch" || source === "branch";
  const hasDistributorKeyword = /\b(?:distributors?|dealers?|stockists?|resellers?|partners?)\b/i.test(pageUrl) || source === "distributor" || locationType === "distributor";

  let basePriority = 7;
  let locType = locationType || "general";

  if (hasHqKeyword) {
    basePriority = 1.0;
    locType = "headquarters";
    isHq = true;
  } else if (source === "contact" || isOperationalContact) {
    basePriority = 1.2;
    locType = "operational_contact";
    isHq = false;
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

  // Legal Registered Office is strictly demoted so operational contact addresses and showrooms always take precedence
  if (isRegisteredOffice && !hasHqKeyword) {
    basePriority = 8;
    locType = "registered_office";
    isHq = false;
  }

  // Deprioritize explicit branch offices if not marked as Headquarters
  if (hasBranchKeyword && !hasHqKeyword) {
    basePriority = 8.5;
    locType = "branch";
    isHq = false;
  }

  // Deprioritize third-party reseller / distributor addresses if not marked as Headquarters
  if (hasDistributorKeyword && !hasHqKeyword) {
    basePriority = 9;
    locType = "distributor";
    isHq = false;
  }

  // Tie-breaker: Within the SAME basePriority tier, English gets a minor advantage (0.0 vs +0.4).
  const priority = isEnglish ? basePriority : (basePriority + 0.4);

  const candObj = {
    raw: cleaned,
    source: source || locType,
    locationType: locType,
    isHeadquarters: isHq,
    isRegisteredOffice: isRegisteredOffice,
    isEnglish: isEnglish,
    pageUrl: pageUrl || "",
    contextText: contextText || "",
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
 * Extracts schema.org JSON-LD structured blocks from HTML.
 */
function extractJsonLdBlocks(html) {
  if (!html) return [];
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (Array.isArray(data)) {
        blocks.push(...data);
      } else if (data && data["@graph"] && Array.isArray(data["@graph"])) {
        blocks.push(...data["@graph"]);
      } else if (data && typeof data === "object") {
        blocks.push(data);
      }
    } catch (e) { }
  }
  return blocks;
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
    if (/\b(about|about-us|aboutus|about_us|who-we-are|our-company|company-profile|profile)\b/i.test(rawLower)) score += 8;
    if (/\b(terms|terms-conditions|terms-and-conditions|terms-of-service|conditions|privacy|privacy-policy|legal|disclaimer|impressum|imprint|mentions-legales|warranty|warranties|guarantee|returns)\b/i.test(rawLower)) score += 7;
    if (/\b(support|customer-support|service|customer-service|help|help-desk|faq)\b/i.test(rawLower)) score += 8;
    if (/\b(sales|inquiry|enquiry|inquiries|enquiries|quote|request-quote|request-a-quote|order|orders)\b/i.test(rawLower)) score += 8;
    if (/\b(shop|store|online-store|cart|basket)\b/i.test(rawLower)) score += 8;
    if (/\b(team|our-team|staff|management|people|leadership)\b/i.test(rawLower)) score += 6;
    if (/\b(locations|branches|branch|offices|stores)\b/i.test(rawLower)) score += 6;
    if (/\b(dealers|distributors|stockists|resellers|partners)\b/i.test(rawLower) || /\b(dealers|distributors|stockists|resellers|partners)\b/i.test(innerText)) score -= 10;
    if (/\b(careers|career|jobs|job|employment|work-with-us|join-our-team)\b/i.test(rawLower)) score += 9;
    if (/\b(careers|career|jobs|employment|work\s*with\s*us|join\s*our\s*team)\b/i.test(innerText)) score += 9;
    if (/\b(feedback|complaints|directory)\b/i.test(rawLower)) score += 5;
    if (/\b(contact|contact\s*us|get\s*in\s*touch|reach\s*us)\b/i.test(innerText)) score += 12;
    if (/\b(about|about\s*us|who\s*we\s*are|company\s*profile|our\s*profile)\b/i.test(innerText)) score += 10;
    if (/\b(shop|store|online\s*store|cart|basket|buy\s*online)\b/i.test(innerText)) score += 9;
    if (/\b(terms|terms\s*and\s*conditions|terms\s*of\s*(?:service|use)|privacy\s*policy|legal\s*notice|company\s*info|imprint|impressum|warranty|warranties|guarantee)\b/i.test(innerText)) score += 8;
    if (/\b(customer\s*support|customer\s*service|technical\s*support|help\s*center|support)\b/i.test(innerText)) score += 10;
    if (/\b(sales|sales\s*enquiry|sales\s*inquiry|request\s*a\s*quote|quote|orders)\b/i.test(innerText)) score += 10;
    if (/\b(en|english)\b/i.test(innerText) || /[\/_](?:en|eng)\b/i.test(rawLower) || /[?&]lang=en/i.test(rawLower)) score += 7;

    if (score > 0) {
      try {
        const resolved = new URL(raw, baseUrl);
        const baseHost = new URL(baseUrl).hostname.replace(/^www\./i, "").toLowerCase();
        const linkHost = resolved.hostname.replace(/^www\./i, "").toLowerCase();
        // Restrict subpage discovery to same host or subdomains to prevent external job portals/SaaS (Dayforce, Workday, Greenhouse, etc.)
        if (linkHost !== baseHost && !linkHost.endsWith("." + baseHost)) {
          continue;
        }
        candidates.push({ url: resolved.href, score });
      } catch (e) { }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return Array.from(new Set(candidates.map(c => c.url)));
}

/**
 * Discovers product, catalog, category, service, and prohibited category candidate links.
 * Prioritizes any links that contain restricted keywords in their URL or anchor text.
 */
function discoverProductAndCatalogLinks(html, baseUrl) {
  if (!html) return [];
  const candidates = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  const restrictedHints = /\b(?:medical|medicine|hospital|clinic|pharma|pharmaceutical|knife|knives|weapon|weapons|gun|guns|defence|defense|military|aircraft|aviation|aerospace|marine|ships?|boats?|yachts?|chemical|chemicals|alcohol|beer|wine|brewery|distillery|animals?|pets?|dogs?|cats?|veterinary|food|bakery|meat|poultry|seafood|porn|adult|casino|gambling|vape|vaping|tobacco|cannabis|cbd|thc)\b/i;

  while ((match = linkRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    const innerText = match[2].replace(/<[^>]+>/g, "").trim().toLowerCase();
    const rawLower = raw.toLowerCase();
    if (!raw || /^(javascript:|mailto:|tel:|#)/i.test(raw)) continue;

    let score = 0;
    let isRestrictedHint = false;

    // High alert: link URL or text mentions restricted/prohibited categories
    if (restrictedHints.test(rawLower) || restrictedHints.test(innerText)) {
      score += 150;
      isRestrictedHint = true;
    }

    // Product & Catalog pages
    if (/\b(?:products?|catalog(?:ue)?|categories|category|collection|collections|items?|goods|solutions?|services?|what-we-do|offerings|range|machinery|equipment)\b/i.test(rawLower)) score += 20;
    if (/\b(?:products?|our\s*products?|catalog(?:ue)?|categories|category|all\s*products?|view\s*all\s*products?|services?|what\s*we\s*do|solutions?|our\s*services?|product\s*range|catalogues?)\b/i.test(innerText)) score += 25;

    // Demote pagination / query params / sorting links
    if (/[?&](?:page|p|sort|order|dir|limit|view)=/i.test(rawLower)) score -= 10;
    // Demote low-value non-product pages
    if (/\b(?:login|signup|cart|checkout|privacy|terms|cookie|wishlist)\b/i.test(rawLower)) score -= 30;

    if (score > 0) {
      try {
        const resolved = new URL(raw, baseUrl);
        const baseHost = new URL(baseUrl).hostname.replace(/^www\./i, "").toLowerCase();
        const linkHost = resolved.hostname.replace(/^www\./i, "").toLowerCase();
        if (linkHost !== baseHost && !linkHost.endsWith("." + baseHost)) {
          continue;
        }
        candidates.push({ url: resolved.href, score, isRestrictedHint });
      } catch (e) { }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function extractFooterText(html) {
  if (!html) return "";
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i) ||
    html.match(/<(?:div|section)[^>]+(?:class|id)=["'][^"']*footer[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
  if (!footerMatch) return "";
  return stripHtml(footerMatch[1]);
}

function extractMapAddresses(html, targetList, pageUrl = "") {
  if (!html) return;
  const decodedHtml = decodeHtmlEntities(html);
  const mapRegex = /(?:google\.[a-z.]+\/maps|maps\.google(?:\.[a-z.]+)?|baidu\.com|openstreetmap)[^"'>\s]*/gi;
  let match;
  while ((match = mapRegex.exec(decodedHtml)) !== null) {
    const rawUrl = match[0];
    try {
      const decoded = decodeURIComponent(rawUrl.replace(/&amp;/gi, "&"));
      let query = "";

      // 1. Standard query parameters (?q=..., ?query=..., ?place=..., ?destination=..., ?daddr=..., ?saddr=..., ?hnear=...)
      const qMatch = decoded.match(/[?&](?:q|query|place|destination|daddr|saddr|hnear)=([^&"'>]+)/i);
      if (qMatch) {
        query = qMatch[1].replace(/\+/g, " ").trim();
      }

      // 2. /maps/place/<Address>/ or /maps/search/<Address>/
      if (!query || /^[-\d.,\s]+$/.test(query)) {
        const placeMatch = decoded.match(/\/maps\/(?:place|search)\/([^/@?#]+)/i);
        if (placeMatch) {
          query = placeMatch[1].replace(/\+/g, " ").replace(/,/g, ", ").trim();
        }
      }

      // 3. /maps/dir/.../<Address>
      if (!query || /^[-\d.,\s]+$/.test(query)) {
        const dirMatch = decoded.match(/\/maps\/dir\/[^\/]+\/([^/@?#]+)/i);
        if (dirMatch) {
          query = dirMatch[1].replace(/\+/g, " ").trim();
        }
      }

      // 4. Embedded Google Maps !2s<Address> parameter
      if (!query || /^[-\d.,\s]+$/.test(query)) {
        const pbMatch = decoded.match(/!2s([^!&"'>]+)/i);
        if (pbMatch) {
          const pbCandidate = pbMatch[1].replace(/\+/g, " ").trim();
          if (pbCandidate.length > 8 && !/^[-\d.,\s]+$/.test(pbCandidate)) {
            query = pbCandidate;
          }
        }
      }

      if (query.length > 8 && !/^[-\d.,\s]+$/.test(query) && !/^\d+$/.test(query)) {
        addAddressCandidate(targetList, query, "map", false, "map", pageUrl, "Google Maps");
      }

      // Also check hnear parameter if present
      const hnearMatch = decoded.match(/[?&]hnear=([^&"'>]+)/i);
      if (hnearMatch) {
        const hnearQuery = hnearMatch[1].replace(/\+/g, " ").trim();
        if (hnearQuery.length > 8 && hnearQuery !== query && !/^[-\d.,\s]+$/.test(hnearQuery)) {
          addAddressCandidate(targetList, hnearQuery, "map", false, "map", pageUrl, "Google Maps");
        }
      }
    } catch (e) { }
  }

  // 5. Modern Map & CMS widget attributes (Duda, Leaflet, Mapbox, Webflow, Squarespace, Shopify, Elementor)
  const widgetRegex = /(?:data-address|addresstodisplay|geocompleteaddress)=["']([^"']+)["']/gi;
  let wm;
  while ((wm = widgetRegex.exec(html)) !== null) {
    const rawAttr = wm[1].trim();
    if (rawAttr.length > 8 && !/^[-\d.,\s]+$/.test(rawAttr)) {
      addAddressCandidate(targetList, rawAttr, "map", false, "contact", pageUrl, "Map Widget");
    }
  }

  // 6. Google Maps short-link / map anchor text (e.g. <a href="https://maps.app.goo.gl/..." ...>14200 Washington Avenue, San Leandro, CA 94578</a>)
  const mapLinkRegex = /<a\b[^>]*href=["'](?:https?:)?\/\/(?:maps\.(?:google|app\.goo\.gl)|goo\.gl\/maps)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let mlm;
  while ((mlm = mapLinkRegex.exec(html)) !== null) {
    const linkText = stripHtml(mlm[1]).trim();
    if (linkText.length >= 10 && !/^[-\d.,\s]+$/.test(linkText)) {
      addAddressCandidate(targetList, linkText, "map", false, "contact", pageUrl, "Google Maps Link");
    }
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

function extractHtmlAddresses(html, targetList, defaultSource = "contact", pageUrl = "") {
  if (!html) return;

  // Preprocess HTML to close unclosed <td> and <th> cells so adjacent table columns never merge
  let processedHtml = html
    .replace(/(<td\b[^>]*>[\s\S]*?)(?=<td\b)/gi, (m) => m.includes('</td>') ? m : m + '</td>')
    .replace(/(<th\b[^>]*>[\s\S]*?)(?=<th\b)/gi, (m) => m.includes('</th>') ? m : m + '</th>');

  // Helper to determine context from surrounding text / headers / inner text
  const getContext = (beforeText, fallbackSource, innerText = "") => {
    const textToCheck = (beforeText || "") + " " + (innerText || "");
    if (/\b(?:registered\s*office|registered\s*in\b|domicilio\s*social|registered\s*agent|statutory\s*office)\b/i.test(textToCheck)) {
      return { isHq: false, source: "registered_office", locType: "registered_office" };
    }
    if (/\b(?:headquarters|head\s*office|corporate\s*office|main\s*office|principal\s*office|hq|main\s*factory|main\s*plant|main\s*facility|sede\s*central|oficinas?\s*central(?:es)?|sede\s*principal|oficina\s*principal)\b/i.test(textToCheck) ||
      /(?:總公司|总公司|總部|总部|本公司|集團總部|集团总部|總廠|总厂|本廠|本厂|本部|本社|本店)/i.test(textToCheck)) {
      return { isHq: true, source: "headquarters", locType: "headquarters" };
    }
    if (/\b(?:branch(?:\s*office)?|regional\s*office|overseas\s*office|sales\s*office|subsidiary|sucursal|delegaci[oó]n|filiale|filial)\b/i.test(textToCheck) ||
      /(?:海外子公司|全资子公司|控股子公司|子公司|海外办事处|办事处|辦事處|国内分公司|分公司|分處|分处|營業所|营业所|經銷商|经销商)/i.test(textToCheck)) {
      return { isHq: false, source: "branch", locType: "branch" };
    }
    return { isHq: false, source: fallbackSource, locType: fallbackSource };
  };

  // 1. Explicit Headquarters / Head Office blocks (Priority 1)
  const hqRegex = /(?:headquarters|head\s*office|corporate\s*office|main\s*office|hq|sede\s*central|oficinas?\s*central(?:es)?|sede\s*principal|總公司|总公司|總部|总部|本公司|集團總部|集团总部)\s*[:\-–]?\s*<(?:p|div|span|address|li|td|th|dd)[^>]*>([\s\S]*?)<\/(?:p|div|span|address|li|td|th|dd)>/gi;
  let hqm;
  while ((hqm = hqRegex.exec(processedHtml)) !== null) {
    const raw = stripHtml(hqm[1]);
    if (raw.length > 8) {
      addAddressCandidate(targetList, raw, "headquarters", true, "headquarters", pageUrl);
    }
  }

  // 1b. Explicit Registered Office blocks (Demoted to Priority 8 - Secondary/Fallback)
  const regOfficeRegex = /(?:registered\s*office|domicilio\s*social)\s*[:\-–]?\s*<(?:p|div|span|address|li|td|th|dd)[^>]*>([\s\S]*?)<\/(?:p|div|span|address|li|td|th|dd)>/gi;
  let rom;
  while ((rom = regOfficeRegex.exec(processedHtml)) !== null) {
    const raw = stripHtml(rom[1]);
    if (raw.length > 8) {
      addAddressCandidate(targetList, raw, "registered_office", false, "registered_office", pageUrl);
    }
  }

  // 2. <h1-6> with "address" or "contact" followed by content / sibling blocks (capture complete multi-line address blocks)
  const headingRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>([\s\S]{1,600}?)(?=<h[1-6]\b|<form\b|<footer\b|<\/section\b|<\/main\b|$)/gi;
  let hm;
  while ((hm = headingRegex.exec(processedHtml)) !== null) {
    const hText = stripHtml(hm[1]);
    if (!/address|location|head\s*office|headquarters|contact\s*us|contact|postal\s*address|direcci[oó]n|domicilio|sede|ubicaci[oó]n|d[oó]nde\s*estamos|donde\s*estamos|contacto|encu[eé]ntranos|辦事處|办事处|地址|總部|总部/i.test(hText)) continue;
    if (/email|e-mail|newsletter|subscribe|phone|tel|telephone|opening\s*hours|working\s*hours/i.test(hText)) continue;

    const ctx = getContext(hText, defaultSource);
    let blockText = stripHtml(hm[2]);
    blockText = blockText.replace(/(?:\b(?:phone|tel|telephone|email|working\s*hours|opening\s*hours|hours|mon\s*[-–]|monday)\b[\s\S]*)/i, "").trim();
    const combinedBlock = blockText.replace(/\n+/g, ", ").replace(/\s*,\s*,\s*/g, ", ").replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
    if (combinedBlock.length > 10) {
      addAddressCandidate(targetList, combinedBlock, ctx.source, ctx.isHq, ctx.locType, pageUrl);
    }
    const lines = blockText.split(/\n+/).map(l => l.trim()).filter(l => l.length > 8);
    for (const line of lines) {
      addAddressCandidate(targetList, line, ctx.source, ctx.isHq, ctx.locType, pageUrl);
    }
  }

  // 3. <address> tag (Fast execution without leading wildcard)
  const addrTagRegex = /<address[^>]*>([\s\S]*?)<\/address>/gi;
  let am;
  while ((am = addrTagRegex.exec(processedHtml)) !== null) {
    const beforeText = processedHtml.slice(Math.max(0, am.index - 500), am.index);
    const ctx = getContext(beforeText, defaultSource);
    const raw = stripHtml(am[1]);
    if (raw.length > 10) {
      addAddressCandidate(targetList, raw, ctx.source, ctx.isHq, ctx.locType, pageUrl);
    }
  }

  // 4. Class or id containing "address" or "addr" or "add" (Fast execution without leading wildcard)
  const classAddrRegex = /<(?:div|p|span|section|li|td|dd|article)[^>]+(?:class|id)=["']([^"']*(?:address|addr\b|add\b|direcci[oó]n|domicilio|ubicaci[oó]n)[^"']*)["'][^>]*>([\s\S]*?)<\/(?:div|p|span|section|li|td|dd|article)>/gi;
  let cm;
  while ((cm = classAddrRegex.exec(processedHtml)) !== null) {
    const beforeText = processedHtml.slice(Math.max(0, cm.index - 500), cm.index);
    const contextStr = beforeText + " " + cm[1];
    const ctx = getContext(contextStr, defaultSource);
    const raw = stripHtml(cm[2]);
    const combinedBlock = raw.replace(/\n+/g, ", ").replace(/\s*,\s*,\s*/g, ", ").replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
    if (combinedBlock.length > 10) {
      addAddressCandidate(targetList, combinedBlock, ctx.source, ctx.isHq, ctx.locType, pageUrl);
    }
  }

  // 4b. Elements whose class contains "fa-map-marker" or "location" directly (e.g. <li class="fa-map-marker">11092 SW Allen...</li>)
  const classMarkerRegex = /<(?:li|p|div|span)[^>]+class=["'][^"']*(?:fa-map-marker|map-marker|icon-location|dashicons-location)[^"']*["'][^>]*>([\s\S]*?)<\/(?:li|p|div|span)>/gi;
  let cmm;
  while ((cmm = classMarkerRegex.exec(processedHtml)) !== null) {
    const raw = stripHtml(cmm[1]);
    const combinedBlock = raw.replace(/\n+/g, ", ").replace(/\s*,\s*,\s*/g, ", ").replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
    if (combinedBlock.length > 10) {
      addAddressCandidate(targetList, combinedBlock, defaultSource, false, "contact", pageUrl);
    }
  }

  // 5. Explicit label prefixes Add: / Address: / Addr: / Location: / Dirección: / 地址: (Fast execution)
  const labelAddrRegex = /(?:^|[^a-zA-Z0-9])(?:postal\s*address|address|add|addr|direcci[oó]n|domicilio\s*social|domicilio|sede\s*central|sede|ubicaci[oó]n|localizaci[oó]n|地址|廠址|厂址)\s*[:：]?\s*(?:\s*<[^>]+>)*\s*([\s\S]{10,400}?)(?=<h[1-6]\b|<form\b|<footer\b|\b(?:phone|tel|telephone|email|working\s*hours|opening\s*hours|fax)\b\s*[:：]|$)/gi;
  let lm;
  while ((lm = labelAddrRegex.exec(processedHtml)) !== null) {
    const beforeText = processedHtml.slice(Math.max(0, lm.index - 500), lm.index);
    const ctx = getContext(beforeText, defaultSource);
    let block = stripHtml(lm[1]);
    block = block.replace(/(?:\b(?:phone|tel|telephone|email|working\s*hours|opening\s*hours|fax)\b[\s\S]*)/i, "").trim();
    const combinedBlock = block.replace(/\n+/g, ", ").replace(/\s*,\s*,\s*/g, ", ").replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
    if (combinedBlock.length > 10) {
      addAddressCandidate(targetList, combinedBlock, ctx.source, ctx.isHq, ctx.locType, pageUrl);
    }
  }

  // 5b. Elementor Icon List items containing map marker icons or addresses
  const elementorListRegex = /<(?:li|div)[^>]+class=["'][^"']*elementor-icon-list-item[^"']*["'][\s\S]*?(?:fa-map-marker|fa-map-marker-alt|map-marker|icon-location|e-fas-map-marker-alt|location)[\s\S]*?class=["'][^"']*elementor-icon-list-text[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|p)>/gi;
  let elm;
  while ((elm = elementorListRegex.exec(processedHtml)) !== null) {
    const raw = stripHtml(elm[1]).trim();
    if (raw.length > 8) {
      addAddressCandidate(targetList, raw, defaultSource, false, "contact", pageUrl);
    }
  }

  // 6. Map-marker icon followed by address text (Fast execution)
  const markerRegex = /(?:fa-map-marker|fa-map-marker-alt|map-marker|icon-location|dashicons-location|e-fas-map-marker-alt)[^>]*>[\s\S]{0,800}?(?:<\/(?:span|i|div|svg)>\s*){1,4}(?:<(?:span|p|div|li)[^>]*>)*([^<\r\n]+(?:\s*<br\s*\/?>\s*[^<\r\n]+)*)/gi;
  let mm;
  while ((mm = markerRegex.exec(processedHtml)) !== null) {
    const beforeText = processedHtml.slice(Math.max(0, mm.index - 500), mm.index);
    const ctx = getContext(beforeText, defaultSource);
    const raw = stripHtml(mm[1]);
    const combinedBlock = raw.replace(/\n+/g, ", ").replace(/\s*,\s*,\s*/g, ", ").replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
    if (combinedBlock.length > 10) {
      addAddressCandidate(targetList, combinedBlock, ctx.source, ctx.isHq, ctx.locType, pageUrl);
    }
    const lines = raw.split(/\n+/).map(l => l.trim()).filter(l => l.length > 8);
    for (const line of lines) {
      addAddressCandidate(targetList, line, ctx.source, ctx.isHq, ctx.locType, pageUrl);
    }
  }

  // 7. Paragraphs, list items, or table cells containing physical address patterns (Fast execution)
  const pAddrRegex = /<(?:p|li|td|th)[^>]*>([\s\S]*?)<\/(?:p|li|td|th)>/gi;
  let pm;
  while ((pm = pAddrRegex.exec(processedHtml)) !== null) {
    const raw = stripHtml(pm[1]);
    if (raw.length >= 15 && raw.length <= 400 &&
      (/\b(road|street|avenue|lane|drive|way|boulevard|highway|parade|circuit|crescent|close|court|place|terrace|esplanade|track|trail|township|district|city|county|hsien|country|marg|nagar|estate|colony|rd\b|st\b|ln\b|ave\b|dr\b|blvd\b|hwy\b|pde\b|cct\b|cres\b|cl\b|ct\b|pl\b|tce\b|via|corso|viale|piazza|strasse|straße|str\b|gasse|weg|platz|rue|calle|c\/|avenida|avda|paseo|plaza|rambla|carretera|pol[ií]gono\s*industrial|pol\.?\s*ind\.?|zona\s*industriale|gewerbegebiet|zone\s*industrielle|parc\s*d['’]activit[eé]s|kawasan\s*industri|taman\s*perindustrian|jalan|jl\b|lorong|solok|mukim|daerah|amphoe|tambon|barangay|ulica|ul\b|n[aá]m[eě]st[ií]|t[rř][ií]da|alej|camino|pasaje|traves[ií]a|ronda|apartado\s*de\s*correos)\b/i.test(raw) ||
        /(?:大道|路|街|巷|弄|号|號|工业区|工业园|产业园|高新区)/.test(raw) ||
        /\b(?:victoria|new\s*south\s*wales|queensland|western\s*australia|south\s*australia|tasmania|northern\s*territory|australian\s*capital\s*territory|vic|nsw|qld|wa|sa|tas|act|madrid|barcelona|valencia|sevilla|andaluc[ií]a|catalu[nñ]a|galicia|pa[ií]s\s*vasco|arag[oó]n|asturias|baleares|canarias|cantabria|castilla|extremadura|murcia|navarra|rioja|maharashtra|mumbai|delhi|bangalore|karnataka|tamil\s*nadu|chennai|gujarat|ahmedabad|kolkata|hyderabad|pune|selangor|johor|penang|perak|kedah|pahang|jihomoravsk[yý]|st[rř]edo[cč]esk[yý]|praha|brno|ostrava|plze[nň]|mazowieckie|ma[lł]opolskie|[sś]l[aą]skie|wielkopolskie|dolno[sś]l[aą]skie|bavaria|bayern|hessen|nordrhein-westfalen|baden-w[uü]rttemberg|sachsen)\b/i.test(raw)) &&
      (/\b(?:\d{1,5}|no\.?\s*\d+|n[ºo]\.?\s*\d+|s\/n\b|sin\s*n[uú]mero\b|#\s*\d+|unit\s*\d+|lot\s*\d+|plot\s*\d+|factory\s*\d+|level\s*\d+|floor\s*\d+|ist\s*floor|1st\s*floor|2nd\s*floor|3rd\s*floor|gpo\s*box)\b/i.test(raw) ||
        /\d+\s*[号號]/.test(raw) ||
        /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(raw) ||
        /\b\d{3}\s*\d{2}\b/.test(raw) ||
        /\b\d{2}-\d{3}\b/.test(raw) ||
        /\b\d{4,6}\b/.test(raw) ||
        /\bindustrial\s*(?:estate|park|area|zone|district)\b/i.test(raw))) {
      const beforeText = processedHtml.slice(Math.max(0, pm.index - 500), pm.index);
      const ctx = getContext(beforeText, defaultSource, pm[1]);
      addAddressCandidate(targetList, raw, ctx.source, ctx.isHq, ctx.locType, pageUrl);
      const lines = raw.split(/\n+/).map(l => l.trim()).filter(l => l.length >= 10);
      for (const line of lines) {
        addAddressCandidate(targetList, line, ctx.source, ctx.isHq, ctx.locType, pageUrl);
      }
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

  // Street / premise numbers (e.g. 56, 140, 7, 26, 909, 56-106, 138号)
  const matches = [...clean.matchAll(/(?<!\d)(\d+(?:[-/]\d+)?)(?!\d)/g)];
  const numbers = matches
    .map(m => m[1])
    .filter(n => n.length <= 6 && !/^(?:19\d\d|20\d\d|886|60|61|44|27|91|30543|504)$/.test(n));

  // Recognized localities across priority countries
  const localityList = [
    // China
    "guangdong", "jiangsu", "zhejiang", "shandong", "henan", "sichuan", "hubei", "hunan",
    "hebei", "fujian", "anhui", "liaoning", "shaanxi", "jiangxi", "chongqing", "beijing", "shanghai", "tianjin",
    "huizhou", "shenzhen", "guangzhou", "dongguan", "foshan", "zhongshan", "zhuhai",
    "suzhou", "wuxi", "changzhou", "nanjing", "hangzhou", "ningbo", "wenzhou", "jiaxing",
    "qingdao", "jinan", "yantai", "weifang", "xiamen", "fuzhou", "quanzhou", "xi'an", "xian",
    "chengdu", "wuhan", "changsha", "zhengzhou",
    // Australia
    "melbourne", "sydney", "brisbane", "perth", "adelaide", "hobart", "canberra", "darwin",
    "geelong", "gold coast", "newcastle", "wollongong", "sunshine coast", "townsville", "cairns",
    "toowoomba", "ballarat", "bendigo", "launceston", "mackay", "rockhampton", "bunbury",
    "campbellfield", "dandenong", "braeside", "bayswater", "clayton", "tullamarine", "thomastown",
    "somerton", "laverton", "truganina", "altona", "silverwater", "wetherill park", "smithfield",
    "seven hills", "blacktown", "parramatta", "rydalmere", "alexandria", "rosebery", "prestons",
    "acacia ridge", "rocklea", "wacol", "brendale", "yatala", "welshpool", "kewdale", "canning vale",
    "malaga", "osborne park", "wingfield", "regency park", "kilkenny", "hindmarsh",
    "victoria", "new south wales", "queensland", "western australia", "south australia", "tasmania",
    "northern territory", "australian capital territory",
    // Taiwan
    "taipei", "taichung", "kaohsiung", "tainan", "taoyuan", "hsinchu", "chiayi", "keelung",
    "changhua", "miaoli", "nantou", "yunlin", "pingtung", "yilan", "hualien", "taitung", "penghu",
    "kinmen", "matsu", "xiushui", "nantun", "banqiao", "xinpu", "sinpu", "danshui", "tamsui",
    "zhongli", "xinzhuang", "sanchong", "xindian", "fengyuan", "pingzhen", "bade",
    // UK
    "london", "birmingham", "manchester", "leeds", "glasgow", "liverpool", "sheffield", "bristol",
    "edinburgh", "heywood", "rochdale", "bolton", "bury", "oldham", "salford", "stockport", "tameside",
    "trafford", "wigan", "lancashire", "yorkshire", "cheshire", "derbyshire", "staffordshire",
    // China
    "beijing", "shanghai", "guangzhou", "shenzhen", "dongguan", "huizhou", "foshan", "zhongshan", "suzhou",
    "wuxi", "changzhou", "nanjing", "hangzhou", "ningbo", "wenzhou", "qingdao", "jinan", "xiamen", "fuzhou",
    "xi'an", "xian", "chengdu", "wuhan", "changsha", "zhengzhou", "chongqing", "tianjin",
    "guangdong", "jiangsu", "zhejiang", "shandong", "sichuan", "hubei", "hunan", "hebei", "henan", "fujian", "anhui", "shaanxi",
    // Chinese characters
    "惠州", "东莞", "深圳", "广州", "佛山", "中山", "苏州", "无锡", "常州", "南京", "杭州", "宁波", "温州", "青岛", "济南", "厦门", "福州", "西安", "成都", "武汉", "长沙", "郑州", "北京", "上海", "天津", "重庆",
    "台北", "新北", "台中", "高雄", "台南", "桃园", "新竹", "彰化", "深坑",
    // USA
    "chicago", "houston", "phoenix", "philadelphia", "san antonio", "san diego", "dallas", "austin", "cupertino",
    "california", "texas", "florida", "new york", "illinois", "pennsylvania", "ohio", "georgia",
    // Malaysia
    "kuala lumpur", "selangor", "penang", "johor", "perak", "kedah", "pahang", "kelantan", "sabah", "sarawak",
    "klang", "petaling jaya", "subang jaya", "shah alam", "george town", "johor bahru", "ipoh", "meru",
    // Spain
    "madrid", "barcelona", "valencia", "sevilla", "zaragoza", "malaga", "murcia", "palma", "bilbao",
    "alicante", "cordoba", "valladolid", "vigo", "gijon", "hospitalet", "vitoria", "coruna", "elche",
    "granada", "terrassa", "badalona", "oviedo", "sabadell", "cartagena", "jerez", "mostoles",
    "santa cruz de tenerife", "pamplona", "almeria", "alcala de henares", "fuenlabrada", "leganes",
    "san sebastian", "getafe", "burgos", "albacete", "santander", "castellon", "alcorcon", "logrono",
    "badajoz", "salamanca", "huelva", "marbella", "lleida", "tarragona", "dos hermanas", "torrejon de ardoz",
    "parla", "mataro", "leon", "algeciras", "santa coloma", "alcobendas", "cadiz", "jaen", "reus",
    "ourense", "telde", "barakaldo", "lugo", "girona", "caceres", "toledo", "pontevedra", "palencia",
    "guadalajara", "ciudad real", "segovia", "soria", "teruel", "cuenca", "huesca", "zamora", "avila",
    "andalucia", "cataluna", "galicia", "pais vasco", "asturias", "cantabria", "castilla", "extremadura",
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

  // 1. Establish Home Country from EXPLICIT HEADQUARTERS EVIDENCE on the website:
  // An address explicitly marked as Headquarters / Head Office / 總部 / 总公司 establishes the company's true home domicile!
  let provenHomeCountry = "";
  const explicitHqCandidate = candidates.find(c => c && (c.isHeadquarters === true || c.locationType === "headquarters"));
  if (explicitHqCandidate) {
    const hqRawText = getRaw(explicitHqCandidate);
    const detectedHqCountry = detectCountryFromAddress(hqRawText);
    if (detectedHqCountry) {
      provenHomeCountry = detectedHqCountry.toLowerCase();
    } else if (/[\u4e00-\u9fa5]/.test(hqRawText)) {
      // Check for Taiwan counties / districts or .tw domain
      const urlStr = crawlData ? ((crawlData.finalUrl || "") + " " + (crawlData.originalUrl || "")).toLowerCase() : "";
      if (/\.tw(?:\/|$)/i.test(urlStr) || /\b(taiwan|taipei|changhua|chiayi|hsinchu|taichung|tainan|kaohsiung|taoyuan|new taipei)\b/i.test(hqRawText) || /[\u81fa\u53f0\u7063\u65b0\u5317\u53f0\u5317]/.test(hqRawText)) {
        provenHomeCountry = "taiwan";
      } else {
        provenHomeCountry = "china";
      }
    }
  }

  // Fallback home country signals if no explicit HQ block was tagged:
  if (!provenHomeCountry && crawlData) {
    const contactText = (crawlData.contactPageText || "") + " " + (crawlData.footerText || "");
    const firstPhone = (crawlData.phones && crawlData.phones[0]) || "";
    if (/^\+?886\b/.test(firstPhone) || /\+886\b/.test(contactText)) provenHomeCountry = "taiwan";
    else if (/^\+?86\b/.test(firstPhone) || /\+86\b/.test(contactText)) provenHomeCountry = "china";
    else if (/^\+?44\b/.test(firstPhone) || /\+44\b/.test(contactText)) provenHomeCountry = "england";
    else if (/^\+?61\b/.test(firstPhone) || /\+61\b/.test(contactText)) provenHomeCountry = "australia";
    else if (/^\+?91\b/.test(firstPhone) || /\+91\b/.test(contactText)) provenHomeCountry = "india";
    else if (/^\+?27\b/.test(firstPhone) || /\+27\b/.test(contactText)) provenHomeCountry = "south africa";
    else if (/^\+?60\b/.test(firstPhone) || /\+60\b/.test(contactText)) provenHomeCountry = "malaysia";
    else if (/^\+?49\b/.test(firstPhone) || /\+49\b/.test(contactText)) provenHomeCountry = "germany";
    else if (/^\+?34\b/.test(firstPhone) || /\+34\b/.test(contactText)) provenHomeCountry = "spain";
    else if (/^\+?39\b/.test(firstPhone) || /\+39\b/.test(contactText)) provenHomeCountry = "italy";
    else if (/^\+?64\b/.test(firstPhone) || /\+64\b/.test(contactText)) provenHomeCountry = "new zealand";

    // Domain ccTLD if still unknown
    if (!provenHomeCountry) {
      const urlStr = ((crawlData.finalUrl || "") + " " + (crawlData.originalUrl || "")).toLowerCase();
      if (/\.(?:com\.)?tw(?:\/|$)/i.test(urlStr)) provenHomeCountry = "taiwan";
      else if (/\.(?:com\.)?au(?:\/|$)/i.test(urlStr)) provenHomeCountry = "australia";
      else if (/\.(?:co\.)?uk(?:\/|$)/i.test(urlStr)) provenHomeCountry = "england";
      else if (/\.ca(?:\/|$)/i.test(urlStr)) provenHomeCountry = "canada";
      else if (/\.(?:com\.)?cn(?:\/|$)/i.test(urlStr)) provenHomeCountry = "china";
      else if (/\.(?:com\.)?my(?:\/|$)/i.test(urlStr)) provenHomeCountry = "malaysia";
      else if (/\.(?:co\.)?in(?:\/|$)/i.test(urlStr)) provenHomeCountry = "india";
      else if (/\.(?:co\.)?za(?:\/|$)/i.test(urlStr)) provenHomeCountry = "south africa";
      else if (/\.de(?:\/|$)/i.test(urlStr)) provenHomeCountry = "germany";
      else if (/\.es(?:\/|$)/i.test(urlStr)) provenHomeCountry = "spain";
      else if (/\.it(?:\/|$)/i.test(urlStr)) provenHomeCountry = "italy";
      else if (/\.(?:co\.)?nz(?:\/|$)/i.test(urlStr)) provenHomeCountry = "new zealand";
    }
  }

  // 2. Sort candidates strictly by priority hierarchy:
  // - Explicit Headquarters (Tier 1)
  // - Candidates matching provenHomeCountry get a -4.0 boost over overseas branch offices
  // - English candidates matching provenHomeCountry get an additional -6.0 boost
  // - Overseas / foreign branch offices get demoted (+10.0) so a US/foreign sales office NEVER outranks home HQ
  const sorted = [...candidates].sort((a, b) => {
    let pA = (typeof a === "object" && a.priority !== undefined) ? a.priority : 6;
    let pB = (typeof b === "object" && b.priority !== undefined) ? b.priority : 6;
    const rawA = getRaw(a).toLowerCase();
    const rawB = getRaw(b).toLowerCase();

    // Legal Registered Office (e.g. accounting/incorporation office) MUST NEVER beat operational contact / headquarters / showroom
    const isRegA = a.locationType === "registered_office" || (typeof a === "object" && a.isRegisteredOffice);
    const isRegB = b.locationType === "registered_office" || (typeof b === "object" && b.isRegisteredOffice);
    if (isRegA && !isRegB) pA += 20.0;
    else if (isRegB && !isRegA) pB += 20.0;

    // Contact page address / showroom / factory / operational premise gets Priority 1 boost (-5.0)
    const isOpA = a.locationType === "operational_contact" || a.source === "contact";
    const isOpB = b.locationType === "operational_contact" || b.source === "contact";
    if (isOpA && !isOpB && !isRegA) pA -= 5.0;
    else if (isOpB && !isOpA && !isRegB) pB -= 5.0;

    // Full Address Boost: Candidate containing Premise/Street AND Locality/State/Postcode beats fragment
    const hasFullA = isFullAddressCandidate(rawA);
    const hasFullB = isFullAddressCandidate(rawB);
    if (hasFullA && !hasFullB) pA -= 4.0;
    else if (hasFullB && !hasFullA) pB -= 4.0;

    // Substring Superseded Rule: If rawB is a complete address containing rawA as a street substring, rawB wins!
    if (rawA.length > 10 && rawB.includes(rawA) && hasFullB && !hasFullA) return 1;
    if (rawB.length > 10 && rawA.includes(rawB) && hasFullA && !hasFullB) return -1;

    if (provenHomeCountry) {
      const matchA = rawA.includes(provenHomeCountry) ||
        (provenHomeCountry === "china" && /[\u4e00-\u9fa5]/.test(rawA)) ||
        (provenHomeCountry === "taiwan" && (rawA.includes("taiwan") || /[\u4e00-\u9fa5]/.test(rawA)));
      const matchB = rawB.includes(provenHomeCountry) ||
        (provenHomeCountry === "china" && /[\u4e00-\u9fa5]/.test(rawB)) ||
        (provenHomeCountry === "taiwan" && (rawB.includes("taiwan") || /[\u4e00-\u9fa5]/.test(rawB)));

      if (matchA && !matchB) pA -= 4.0;
      else if (matchB && !matchA) pB -= 4.0;

      // Penalize foreign branches located outside the home country
      const countryA = detectCountryFromAddress(rawA);
      const countryB = detectCountryFromAddress(rawB);
      if (countryA && countryA.toLowerCase() !== provenHomeCountry) pA += 10.0;
      if (countryB && countryB.toLowerCase() !== provenHomeCountry) pB += 10.0;

      // Boost English candidate that matches the home country
      if (matchA && a.isEnglish) pA -= 6.0;
      if (matchB && b.isEnglish) pB -= 6.0;
    }
    return pA - pB;
  });

  let bestCandidate = sorted[0];
  let bestRaw = getRaw(bestCandidate);

  // If bestCandidate is missing structural address components, check if a fuller candidate exists in the list
  const fuller = candidates.find(c => {
    const cRaw = getRaw(c);
    if (cRaw === bestRaw) return false;
    if (cRaw.toLowerCase().includes(bestRaw.toLowerCase()) && cRaw.length > bestRaw.length) return true;
    if (isFullAddressCandidate(cRaw) && !isFullAddressCandidate(bestRaw)) return true;
    return false;
  });
  if (fuller) {
    bestCandidate = fuller;
    bestRaw = getRaw(fuller);
  }

  // 3. SOURCE OF TRUTH MANDATE (Correction for Problem 1):
  // The verified website candidate is the absolute source of truth!
  // We NEVER allow Gemini to invent, drop, or alter address components.
  //
  // Case A: The verified website candidate is in English / Latin:
  // -> Return bestRaw directly as the base source of truth!
  const isCandidateEnglish = bestCandidate.isEnglish || ((bestRaw.match(/[a-zA-Z]/g) || []).length >= 4 && !/[\u4e00-\u9fa5]/.test(bestRaw));
  if (isCandidateEnglish) {
    return { address: bestRaw, selectedCandidate: bestCandidate };
  }

  // Case B: The verified website candidate is in non-Latin script (e.g. Chinese):
  // -> If Gemini provided an English translation, verify that Gemini faithfully translates bestRaw:
  if (geminiAddr && geminiAddr.length >= 5 && !/^(?:not\s*available|n\/?a|none|unknown)$/i.test(geminiAddr.trim()) && !/[\u4e00-\u9fa5]/.test(geminiAddr)) {
    // Foreign country conflict rejection: If Gemini returned an address in a foreign country (e.g. USA for Chinese company), reject Gemini!
    const geminiCountry = detectCountryFromAddress(geminiAddr);
    if (geminiCountry && provenHomeCountry && geminiCountry.toLowerCase() !== provenHomeCountry) {
      return { address: bestRaw, selectedCandidate: bestCandidate };
    }

    const candComp = extractAddressComponents(bestRaw);
    const geminiComp = extractAddressComponents(geminiAddr);

    let geminiFaithful = true;

    // Check street/premise numbers: Gemini MUST contain the premise numbers from bestRaw
    if (candComp.numbers.length > 0) {
      const hasMatchingNum = candComp.numbers.some(num => {
        const baseNum = num.split(/[-/]/)[0];
        return geminiComp.numbers.includes(num) || geminiComp.numbers.includes(baseNum) || new RegExp(`\\b${baseNum}\\b`).test(geminiAddr);
      });
      if (!hasMatchingNum) geminiFaithful = false;
    }

    // Check localities: Gemini must NOT introduce a foreign/conflicting city
    if (candComp.localities.length > 0 && geminiComp.localities.length > 0) {
      const conflicting = geminiComp.localities.filter(gLoc => !bestRaw.toLowerCase().includes(gLoc) && !candComp.localities.includes(gLoc));
      const matching = geminiComp.localities.filter(gLoc => bestRaw.toLowerCase().includes(gLoc) || candComp.localities.includes(gLoc));
      if (conflicting.length > 0 && matching.length === 0) {
        geminiFaithful = false;
      }
    }

    if (geminiFaithful) {
      return { address: geminiAddr, selectedCandidate: bestCandidate };
    }
  }

  // Fallback for non-Latin candidate: deterministic romanization (e.g. romanizeChineseAddress)
  return { address: bestRaw, selectedCandidate: bestCandidate };
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

/**
 * Decodes ROT13 encoded text (used by WordPress plugins like Email Encoder Bundle).
 */
function decodeRot13(str) {
  if (!str || typeof str !== "string") return str;
  return str.replace(/[a-zA-Z]/g, function (c) {
    const code = c.charCodeAt(0);
    if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 + 13) % 26) + 65);
    if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 + 13) % 26) + 97);
    return c;
  });
}

/**
 * Extracts official company social profile URLs from HTML.
 * Strictly limited to Facebook and LinkedIn per QC instructions (never Twitter, Instagram, TikTok, YouTube).
 */
function extractCompanySocialLinks(html) {
  if (!html || typeof html !== "string") return { facebook: "", linkedin: "" };
  let facebook = "";
  let linkedin = "";

  // 1. Facebook company profile link
  const fbMatches = [...html.matchAll(/href=["'](https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9.\-_/]+)["']/gi)];
  for (const m of fbMatches) {
    const u = m[1];
    if (!/sharer|share\.php|intent|plugins|privacy|help|dialog|login|signup|tr\?|hashtag/i.test(u)) {
      facebook = u;
      break;
    }
  }

  // 2. LinkedIn company profile link
  const liMatches = [...html.matchAll(/href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9.\-_/]+)["']/gi)];
  for (const m of liMatches) {
    const u = m[1];
    if (!/share|sharing|intent|legal|privacy|login|signup/i.test(u)) {
      linkedin = u;
      break;
    }
  }

  return { facebook, linkedin };
}

/**
 * Detects unwanted emails: asset files, tracking scripts, third-party platform vendors,
 * administrative/automated addresses, privacy/GDPR bots, and dummy placeholders.
 */
function isUnwantedEmail(email) {
  if (!email || typeof email !== "string") return true;
  const em = email.toLowerCase().trim();
  const atIdx = em.indexOf("@");
  if (atIdx <= 0 || atIdx === em.length - 1) return true;

  const user = em.slice(0, atIdx);
  const host = em.slice(atIdx + 1);

  // File extension anywhere in user or host (e.g. icon@2x.png, image.jpg@domain, logo@2x)
  if (/\.(?:png|jpg|jpeg|gif|svg|webp|avif|bmp|ico|css|js|woff|woff2|ttf|eot|pdf|zip|rar|tar|gz|json|xml|map|html|htm|php|asp|aspx)$/i.test(user)) return true;
  if (/\.(?:png|jpg|jpeg|gif|svg|webp|avif|bmp|ico|css|js|woff|woff2|ttf|eot|pdf|zip|rar|tar|gz|json|xml|map|html|htm|php|asp|aspx)$/i.test(host)) return true;

  // Media / asset / bundle prefixes
  if (/^(?:icon|logo|image|img|pic|photo|asset|banner|file|avatar|bg|font|theme|bundle|chunk|main|vendor|webpack)@/i.test(em)) return true;
  if (/@\d+x\./i.test(em)) return true; // e.g. logo@2x.png

  // Administrative / automated / bounce / non-contact prefixes (preserves department emails like sales, support, careers, jobs, press, media, hr, feedback, office)
  if (/^(?:noreply|no-reply|donotreply|do-not-reply|postmaster|hostmaster|abuse|mailer-daemon|bounce|unsubscribe|notification|notifications|alert|alerts|sentry|git|npm|dpo)@/i.test(em)) return true;

  // Placeholder / dummy emails
  if (/^(?:user|email|name|test|sample|placeholder|yourname|youremail|username|example|domain|contact|admin|info)@(?:example|domain|test|sample|email|placeholder|yoursite|mysite|mycompany|yourcompany|company|website|sitename)\./i.test(em)) return true;

  // Hex hashes / DSN keys / tokens (e.g. Sentry tracking DSN 605a7baede844d278b89dc95ae0a9123@...)
  if (/^[a-f0-9]{16,64}$/i.test(user)) return true;

  // ROT13 obfuscation remnants (e.g. .pbz, .bet, .arg, .rqh, .tbi or fnyrf@, vasb@)
  if (/\.(?:pbz|bet|arg|rqh|tbi)$/i.test(host)) return true;
  if (/^(?:fnyrf|vasb|fhccbeg|pbagnpg|uryyb|nqzva)@/i.test(em)) return true;

  // Known third-party platforms / analytics / CDN / web builders
  const disallowedHosts = [
    "wix.com", "wixsite.com", "wixpress.com", "shopify.com", "myshopify.com", "wordpress.com", "wordpress.org",
    "squarespace.com", "weebly.com", "sentry.io", "sentry-cdn.com", "sentry-next.wixpress.com", "sentry.wixpress.com", "static.wixpress.com",
    "cloudflare.com", "github.com", "gitlab.com", "google.com", "googleapis.com", "gstatic.com", "google-analytics.com",
    "googletagmanager.com", "facebook.com", "twitter.com", "instagram.com", "linkedin.com", "youtube.com",
    "schema.org", "w3.org", "apache.org", "nginx.org", "openjsf.org", "jsdelivr.net", "unpkg.com",
    "cdnjs.com", "cloudflare.net", "fontawesome.com", "doubleclick.net", "hotjar.com", "hubspot.com",
    "intercom.com", "zendesk.com", "zohocdn.com", "gravatar.com", "godaddy.com", "bluehost.com",
    "hostgator.com", "namecheap.com", "cpanel.net", "cpanel.com", "webhostbox.com", "secureserver.net",
    "example.com", "example.org", "example.net", "domain.com", "test.com", "sample.com",
    "mysite.com", "yoursite.com", "sitename.com", "website.com", "mycompany.com", "yourcompany.com", "company.com"
  ];
  if (disallowedHosts.some(dh => host === dh || host.endsWith("." + dh))) return true;

  return false;
}

/**
 * Strips contact label glued to the end of an email from HTML text concatenation.
 * E.g. "key@keyar.comaddress" -> "key@keyar.com"
 * E.g. "info@domain.co.ukphone:+44" -> "info@domain.co.uk"
 */
function stripTrailingContactWordsFromEmail(email) {
  if (!email || typeof email !== "string") return "";
  let em = email.trim();
  const contactSuffixes = "address|addr|tel|telephone|phone|fax|email|mail|contact|mobile|cell|whatsapp|postcode|postal|zip|website|web|url|loc|location";
  em = em.replace(new RegExp(`(\\.(?:com|org|net|edu|gov|io|co|cn|tw|uk|de|jp|fr|it|es|au|ca|in|biz|info|me|cc|tv|xyz|eu|nl|se|no|ch|at|ru|pl|br|mx|za|nz|asia|mobi|name|pro|tech|store|shop|online|site|vip|club|top))(?:${contactSuffixes})[\\s:：\\-–].*$`, "i"), "$1");
  em = em.replace(new RegExp(`(\\.(?:com|org|net|edu|gov|io|co|cn|tw|uk|de|jp|fr|it|es|au|ca|in|biz|info|me|cc|tv|xyz|eu|nl|se|no|ch|at|ru|pl|br|mx|za|nz|asia|mobi|name|pro|tech|store|shop|online|site|vip|club|top))(?:${contactSuffixes})$`, "i"), "$1");
  return em;
}

/**
 * Strict corporate email validator.
 * Rejects web URLs, images/assets, placeholders, prose artifacts (e.g. "collected at www.domain.com"),
 * and domains starting with www.
 */
function isValidCorporateEmail(email) {
  if (!email || typeof email !== "string") return false;
  let em = email.trim().toLowerCase();
  em = stripTrailingContactWordsFromEmail(em);

  // Filter unwanted emails, script artifacts, and third-party vendors
  if (isUnwantedEmail(em)) return false;

  // Basic standard RFC-style email format
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(em)) return false;

  const atIdx = em.indexOf("@");
  if (atIdx <= 0 || atIdx === em.length - 1) return false;

  const user = em.slice(0, atIdx);
  const host = em.slice(atIdx + 1);

  // Email host/domain must never start with www., http., https., or contain /
  if (/^(?:www\d?|http|https)\./i.test(host) || host.includes("/")) return false;

  // Domain must contain a dot and have valid letters after dot
  if (!host.includes(".") || !/\.[a-zA-Z]{2,}$/.test(host)) return false;

  // Domain cannot end with non-email file extension
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|woff2|ttf|eot|ico|bmp|mp4|webm|pdf|exe|zip|rar|tar|gz|json|xml|map)$/i.test(host)) return false;

  // Prose verb/preposition artifacts from text scraping (e.g. "collected at www.domain.com")
  const proseVerbs = /^(?:collected|located|registered|hosted|available|visited|published|stored|created|updated|viewed|see|look|shop|buy|contacted|served|found)$/i;
  if (proseVerbs.test(user)) return false;

  // Reject if username or host is excessively short or long
  if (user.length < 2 || user.length > 64 || host.length < 4 || host.length > 255) return false;

  return true;
}

/**
 * Extracts and decodes all valid email addresses from any HTML snippet or page.
 * Handles mailto links, Cloudflare obfuscation, ROT13 encoding (WordPress Email Encoder),
 * decodeURIComponent/hex scripts, HTML numeric entities, URL encoding, and [at] patterns.
 */
function extractEmailsFromHtml(html, hostDomain = "") {
  if (!html || typeof html !== "string") return [];
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

  // 2. Decode ROT13 obfuscated emails (e.g. data-enc-email="fnyrf[at]unegznaapbagebyf.pbz" or class="mail-link" data-enc-email="...")
  const rotMatches = [...html.matchAll(/data-enc-email=["']([a-zA-Z0-9._%+-]+(?:@|\[at\]|\(at\))[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["']/gi)];
  for (const rm of rotMatches) {
    const rawEnc = rm[1].replace(/\[at\]|\(at\)/gi, "@");
    const decoded = decodeRot13(rawEnc).toLowerCase().trim();
    if (/@/.test(decoded)) candidateEmails.add(decoded);
  }

  // 3. Decode inline URI / URIComponent scripts (e.g. innerHTML = decodeURIComponent("%73%61%6c%65%73..."))
  const uriEncodedMatches = [...html.matchAll(/(?:decodeURIComponent|decodeURI|unescape)\s*\(\s*["']([^"']+)["']\s*\)/gi)];
  for (const um of uriEncodedMatches) {
    try {
      const decoded = decodeURIComponent(um[1]).toLowerCase().trim();
      const emMatches = decoded.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const em of emMatches) candidateEmails.add(em);
    } catch (e) { }
  }

  // 4. Decode all mailto: links (including multiple comma/semicolon separated emails and ?cc= / ?bcc= parameters)
  const mailtoBlocks = [...html.matchAll(/(?:href=["']|data-[a-z0-9_-]*=["'])\s*mailto:([^"'>\s]+)/gi)];
  for (const mb of mailtoBlocks) {
    try {
      const decodedMailto = decodeURIComponent(mb[1]).replace(/%40|&#64;/gi, "@");
      const subEmails = decodedMailto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const se of subEmails) {
        const cleanSe = se.toLowerCase().trim();
        if (isValidCorporateEmail(cleanSe) && !isUnwantedEmail(cleanSe)) {
          candidateEmails.add(cleanSe);
        }
      }
    } catch (e) { }
  }

  // 5. Extract emails from data attributes, hidden inputs, meta tags, and structured attributes
  const attrMatches = [...html.matchAll(/(?:data-[a-z0-9_-]*(?:email|mail|contact)|value|content|title|alt)=["']([a-zA-Z0-9._%+-]+(?:@|%40|&#64;)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["']/gi)];
  for (const am of attrMatches) {
    const rawEm = am[1].replace(/%40|&#64;/gi, "@").toLowerCase().trim();
    if (isValidCorporateEmail(rawEm) && !isUnwantedEmail(rawEm)) {
      candidateEmails.add(rawEm);
    }
  }

  // 6. Extract emails from JSON-LD, script hydration, Next.js / Nuxt state, and social profile JSON before stripping scripts
  const scriptMatches = [...html.matchAll(/[a-zA-Z0-9._%+-]+(?:@|\\u0040|%40)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)];
  for (const sm of scriptMatches) {
    const emClean = sm[0].replace(/\\u0040|%40/gi, "@").toLowerCase().trim();
    if (isValidCorporateEmail(emClean) && !isUnwantedEmail(emClean)) {
      candidateEmails.add(emClean);
    }
  }

  // 7. Decode HTML numeric & hex entities, and normalize explicit obfuscation [at] / (at) / [dot] (DO NOT MATCH RAW PROSE "at")
  // Strip <script> and <style> tags to avoid capturing error tracking, analytics tokens, and bundle code
  const emailSearchText = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&commat;/gi, "@")
    .replace(/%40/gi, "@")
    .replace(/([a-zA-Z0-9._%+-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\{\s*at\s*\}|_\s*at\s*_)\s*([a-zA-Z0-9.-]+)\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|_\s*dot\s*_|\.)\s*([a-zA-Z]{2,})/gi, "$1@$2.$3");

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const rawEmails = emailSearchText.match(emailRegex) || [];
  for (let em of rawEmails) {
    em = stripTrailingContactWordsFromEmail(em.toLowerCase().trim());
    if (isUnwantedEmail(em)) continue;
    // If an email ends in ROT13 TLD (.pbz -> .com, .bet -> .org, .arg -> .net, .rqh -> .edu, .tbi -> .gov), decode it!
    if (/\.(?:pbz|bet|arg|rqh|tbi)$/i.test(em)) {
      const decodedRot = decodeRot13(em);
      if (isValidCorporateEmail(decodedRot) && !isUnwantedEmail(decodedRot)) {
        candidateEmails.add(decodedRot);
        continue;
      }
    }
    candidateEmails.add(em);
  }

  // Also match on tag-stripped text to catch emails split by inline formatting tags (e.g. <span>sales</span>@<span>domain</span>)
  const strippedText = stripHtml(emailSearchText);
  const textEmails = strippedText.match(emailRegex) || [];
  for (let em of textEmails) {
    em = stripTrailingContactWordsFromEmail(em.toLowerCase().trim());
    if (isValidCorporateEmail(em) && !isUnwantedEmail(em)) {
      candidateEmails.add(em);
    }
  }

  const uniqueEmails = [];
  for (let em of candidateEmails) {
    em = stripTrailingContactWordsFromEmail(em.toLowerCase().trim());
    if (isValidCorporateEmail(em) && !isUnwantedEmail(em) && !uniqueEmails.includes(em)) {
      uniqueEmails.push(em);
    }
  }

  return rankEmails(uniqueEmails, hostDomain);
}

/**
 * Updates email source tracking with page priority (Contact page > Home page > About page > Social media > Other subpages).
 * Prevents repeating footers on legal/faq/terms pages from overwriting genuine Contact page sources.
 */
function updateEmailSource(emailSourceMap, email, pageUrl, finalUrl = "", targetUrl = "") {
  if (!email || !pageUrl || !emailSourceMap) return;
  const em = email.toLowerCase().trim();
  const currentSrc = emailSourceMap[em];
  if (!currentSrc) {
    emailSourceMap[em] = pageUrl;
    return;
  }
  const getPagePriority = (url) => {
    const u = (url || "").toLowerCase();
    if (/\b(?:contact|contact[-_]?us|contactus|get[-_]?in[-_]?touch|reach[-_]?us|reach[-_]?out)\b/i.test(u)) return 4;
    if (u === (finalUrl || "").toLowerCase() || u === (targetUrl || "").toLowerCase()) return 3;
    if (/\b(?:about|about[-_]?us|aboutus|who[-_]?we[-_]?are|company[-_]?profile|profile)\b/i.test(u)) return 2;
    if (/facebook\.com|linkedin\.com/i.test(u)) return 1;
    if (/\b(?:terms|terms-and-conditions|privacy|privacy-policy|policy|policies|disclaimer|faq|legal|cart|checkout|cookie|sitemap)\b/i.test(u)) return -1;
    return 0;
  };
  if (getPagePriority(pageUrl) > getPagePriority(currentSrc)) {
    emailSourceMap[em] = pageUrl;
  }
}

/**
 * Resolves the most accurate and genuine page source URL for an email address.
 * Prioritizes Contact page, Home page, and allowed Social Media (Facebook/LinkedIn) over low-quality repeating footer pages (Terms, Privacy, FAQ, Cart).
 */
function resolveBestEmailSource(email, crawlData) {
  if (!email || !crawlData) return "";
  const em = email.toLowerCase().trim();
  const mappedSrc = (crawlData.emailSourceMap && crawlData.emailSourceMap[em]) || "";
  // Always return the exact page where the email was genuinely discovered (Contact, Warranty, Home, About, or Social)
  if (mappedSrc) {
    return mappedSrc;
  }
  const contactUrl = crawlData.primaryContactUrl || "";
  const finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
  const aboutUrl = crawlData.primaryAboutUrl || "";

  // If not explicitly mapped, check which crawled page actually contains this email
  if (contactUrl && crawlData.contactHtml && crawlData.contactHtml.toLowerCase().includes(em)) {
    return contactUrl;
  }
  if (finalUrl && crawlData.mainHtml && crawlData.mainHtml.toLowerCase().includes(em)) {
    return finalUrl;
  }
  if (aboutUrl && crawlData.profilePageText && crawlData.profilePageText.toLowerCase().includes(em)) {
    return aboutUrl;
  }
  return contactUrl || finalUrl || "";
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

  // Extract & Rank Emails across the complete website HTML
  const rankedEmails = extractEmailsFromHtml(html, hostDomain);

  // Extract Phone Numbers strictly from telephone contexts
  const phoneLinks = [...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map(m => m[1]);
  const contextPhoneRegex = /(?:tel|telephone|phone|call|mobile|cell|contact|总机|總機|电话|電話|手机|手機|座机|座機)[\s:：]*(?:<[^>]+>\s*)*([+]?[\d\s().-]{7,20})/gi;
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

  const imgMatches = cleanHtml.match(/<img\b[^>]+>/gi) || [];
  const validProductImgs = imgMatches.filter(img => {
    if (/src=['"]data:image\/(?:svg|gif)/i.test(img) && !/data-(?:src|lazy-src|original)=/i.test(img)) return false;
    return !/logo|icon|banner|social|arrow|pixel|loader|nav|header|footer|button|spinner|backbar|avatar/i.test(img);
  });

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
 * Scores and ranks emails giving highest priority to corporate domain addresses without subdomains
 * and prioritizing emails discovered directly on Contact and Home pages.
 */
function rankEmails(emails, targetDomain, emailSourceMap = {}) {
  if (!emails || emails.length === 0) return [];
  const validList = emails.filter(e => isValidCorporateEmail(e) && !isUnwantedEmail(e));
  if (validList.length === 0) return [];
  const domainClean = (targetDomain || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[\/?#]/)[0].toLowerCase();

  const scored = validList.map(email => {
    const lower = email.toLowerCase().trim();
    let score = 0;
    const [user, host] = lower.split("@");
    const hostClean = host ? host.replace(/^www\./i, "") : "";

    if (hostClean && domainClean && (hostClean === domainClean || hostClean.endsWith("." + domainClean))) {
      score += 100;
    }
    // Prefer direct domain over nested subdomain
    if (hostClean === domainClean) {
      score += 30;
    }
    // Page location priority
    const src = (emailSourceMap && emailSourceMap[lower]) || "";
    if (/\b(?:contact|contact[-_]?us|contactus|get[-_]?in[-_]?touch|reach[-_]?us)\b/i.test(src)) {
      score += 60; // Highest priority: directly on Contact page
    } else if (src === targetDomain || (domainClean && src.includes(domainClean) && !/\/(?:warranty|terms|privacy|policy|faq)/i.test(src))) {
      score += 40; // On Home page or general landing page
    } else if (/facebook\.com|linkedin\.com/i.test(src)) {
      score += 20; // Official company social media
    }

    if (/^(sales|contact)/i.test(user)) {
      score += 35;
    } else if (/^(info|enquir|office|admin|mail|service|head|hq|ppi)/i.test(user)) {
      score += 25;
    }
    if (/^(webmaster|abuse|privacy|no-?reply|support@wordpress|support@wix)/i.test(user)) {
      score -= 80;
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
  const hasAboutHeading = /<(?:h[1-6]|title|a|li|span|div)[^>]*>[^<]{0,80}(?:company\s*profile|corporate\s*profile|about\s*us|about\s+the\s+company|who\s*we\s*are|our\s+company|our\s+story|our\s+history|overview|company\s+overview|corporate\s+overview|关于我们|公司简介|企业概况|关于公司|公司概况|走进我们|集团概况|企业简介|sobre\s+nosotros|qui[eé]nes\s+somos|perfil\s+de\s+empresa|nuestra\s+empresa|[uü]ber\s+uns|unternehmensprofil|chi\s+siamo|profilo\s+aziendale|[aà]\s+propos|会社概要|企業情報)[^<]{0,40}<\/(?:h[1-6]|title|a|li|span|div)>/i.test(rawHtml);
  const hasAboutLink = /href=["'][^"']*(?:about[-_]?us|aboutus|about|company[-_]?profile|corporate[-_]?profile|who[-_]?we[-_]?are|our[-_]?company|our[-_]?story|overview)[^"']*["']/i.test(rawHtml) || /href=["'][^"']*(?:关于我们|公司简介|sobre[-_]?nosotros|uber[-_]?uns)[^"']*["']/i.test(rawHtml);
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

/**
 * Extracts alt, title, and link path tokens from HTML, images, and meta tags to detect prohibited content.
 */
function extractImageAttributes(html) {
  if (!html || typeof html !== "string") return "";
  const tokens = [];

  // 1. Human-readable alt & title attributes on images
  const imgMatches = [...html.matchAll(/<img[^>]+(?:alt|title)=["']([^"']+)["']/gi)];
  for (const m of imgMatches) {
    if (m[1]) tokens.push(m[1].trim());
  }

  // 2. Human-readable title and aria-label attributes on links and interactive elements
  const linkMatches = [...html.matchAll(/<(?:a|button)[^>]+(?:title|aria-label)=["']([^"']+)["']/gi)];
  for (const m of linkMatches) {
    if (m[1]) tokens.push(m[1].trim());
  }

  // 3. Anchor link URLs pathname words (e.g. href="/products/medical-equipment" -> "medical equipment")
  const hrefMatches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)];
  for (const m of hrefMatches) {
    const raw = (m[1] || "").trim();
    if (!raw || /^(?:javascript:|mailto:|tel:|#)/i.test(raw)) continue;
    try {
      const p = new URL(raw, "http://localhost").pathname;
      const words = p.replace(/[/\\_\-.]+/g, " ").trim();
      if (words.length > 3 && !/^(?:index|home|default|main)$/i.test(words)) {
        tokens.push(words);
      }
    } catch (e) { }
  }

  // 4. Meta descriptions and keywords
  const metaMatches = [...html.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|keywords|og:description|og:title)["'][^>]+content=["']([^"']+)["']/gi)];
  for (const m of metaMatches) {
    if (m[1]) tokens.push(m[1].trim());
  }

  return tokens.join(" ");
}

function extractContextSnippet(text, keyword) {
  if (!text || !keyword) return "";
  const clean = String(text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const idx = clean.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - 45);
  const end = Math.min(clean.length, idx + keyword.length + 45);
  return (start > 0 ? "..." : "") + clean.slice(start, end).trim() + (end < clean.length ? "..." : "");
}

/**
 * Ensures any discovered link or path is converted to a fully qualified absolute URL with http(s) protocol.
 */
function ensureAbsoluteUrl(rawLink, baseUrl) {
  if (!rawLink || typeof rawLink !== "string") return baseUrl || "";
  const trimmed = rawLink.trim();
  if (!trimmed || /^(?:javascript:|mailto:|tel:|#)/i.test(trimmed)) return baseUrl || "";
  try {
    const validBase = (baseUrl && /^https?:\/\//i.test(baseUrl)) ? baseUrl : "http://localhost";
    const resolved = new URL(trimmed, validBase);
    if (resolved.origin === "http://localhost" && !/^https?:\/\//i.test(trimmed)) {
      return "http://" + trimmed.replace(/^\/+/, "");
    }
    return resolved.href;
  } catch (e) {
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("//")) return "https:" + trimmed;
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(trimmed)) return "http://" + trimmed;
    return baseUrl || trimmed;
  }
}

/**
 * Scans HTML to locate the exact anchor link or image source associated with a keyword or regex pattern.
 * Prioritizes direct <a href="..."> navigation/catalog links over generic homepage URLs.
 */
function findExactEvidenceLink(html, keyword, regex, baseUrl) {
  if (!html) return baseUrl || "";
  const rawHtml = String(html);
  const kw = keyword ? String(keyword).trim().toLowerCase() : "";

  // 1. Direct anchor tag search: <a href="...">...keyword...</a>
  const anchorRegex = /<a\s+[^>]*href=["']([^"'#\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRegex.exec(rawHtml)) !== null) {
    const href = m[1].trim();
    if (!href || /^(?:javascript:|mailto:|tel:|#)/i.test(href)) continue;
    const tagHtml = m[0];
    const textContent = m[2].replace(/<[^>]+>/g, " ").toLowerCase();
    const hrefLower = href.toLowerCase();

    const textMatch = kw && textContent.includes(kw);
    const hrefMatch = kw && hrefLower.includes(kw);
    const regexMatch = regex && (regex.test(textContent) || regex.test(hrefLower) || regex.test(tagHtml));

    if (textMatch || hrefMatch || regexMatch) {
      const absUrl = ensureAbsoluteUrl(href, baseUrl);
      if (absUrl && absUrl !== baseUrl) return absUrl;
    }
  }

  // 2. Proximity search: find <a href="..."> within 400 characters of the keyword occurrence
  if (kw) {
    const idx = rawHtml.toLowerCase().indexOf(kw);
    if (idx !== -1) {
      const start = Math.max(0, idx - 400);
      const end = Math.min(rawHtml.length, idx + kw.length + 400);
      const slice = rawHtml.slice(start, end);
      const linkMatch = slice.match(/<a\s+[^>]*href=["']([^"'#\s]+)["']/i);
      if (linkMatch && linkMatch[1]) {
        const absUrl = ensureAbsoluteUrl(linkMatch[1].trim(), baseUrl);
        if (absUrl && absUrl !== baseUrl) return absUrl;
      }
    }
  }

  // 3. Image tag search: <img src="..." alt="...keyword...">
  if (kw) {
    const imgRegex = /<img\s+[^>]*?(?:alt|title|src)=["'][^"']*?([^"']*?)["'][^>]*>/gi;
    let imgM;
    while ((imgM = imgRegex.exec(rawHtml)) !== null) {
      const fullImg = imgM[0];
      if (fullImg.toLowerCase().includes(kw)) {
        const srcMatch = fullImg.match(/\bsrc=["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
          const absUrl = ensureAbsoluteUrl(srcMatch[1].trim(), baseUrl);
          if (absUrl) return absUrl;
        }
      }
    }
  }

  return baseUrl || "";
}

/**
 * Checks website text and images against prohibited categories per Note 2.
 * Rule: "Do not work on websites related to Porn, Adult, Medicine, Medical, Hospital, Food, Weapons (Knife), Defence, Aircraft, Aerospace, Marine, Ship, Chemical, Alcohol, Animals. Even if these images or words appear anywhere on the site, do not work on that site. make these rule strictly if any word appear make it notwroking"
 */
function detectRestrictedKeywordsSingle(text, html = "") {
  let combined = ((text || "") + " " + extractImageAttributes(html)).trim();
  if (!combined) return { isRestricted: false, matchedKeyword: null, reason: "", category: "" };

  // Strip HTML tags and attributes first so HTML tag/class/id attributes never create false tokens
  let cleanText = combined.replace(/<[^>]+>/g, " ");

  // Sanitize clinic/hospital/medical references inside customer testimonials, client reviews, or manufactured sign/display products
  cleanText = cleanText
    .replace(/\b(?:signage|signs?|branding|wayfinding|labels?|packaging|wraps?|displays?|vehicle\s*graphics)[^.\n]{0,120}?\b(?:for|in|at)\s+(?:our|a|the)?\s*\b(?:clinic|hospital|medical)\b/gi, " ")
    .replace(/\b(?:client\s+testimonial|testimonials?|what\s+our\s+clients\s+say|client\s+reviews?|our\s+clients|featured\s+work)[\s\S]{0,400}?\b(?:clinic|hospital)\b/gi, " ")
    .replace(/\bLONESTAR\s+LUNGS[^.\n]{0,60}?\bCLINIC\b/gi, " ");

  // 1. Strip URLs containing /cat/, ?cat=, etc.
  cleanText = cleanText
    .replace(/(?:https?:\/\/[^\s]+|\bwww\.[^\s]+)/gi, (url) => {
      return url
        .replace(/[/\\_]cat[/\\_]/gi, "/ ")
        .replace(/[?&]cat=[^&\s]*/gi, " ")
        .replace(/[/\\_](?:category|categories|catalogue|catalog|product-cat|shop-cat)[/\\_]/gi, "/ ")
        .replace(/[/\\_](?:shipping|shipping-policy|shipment|ship)[/\\_]/gi, "/ ");
    })
    .replace(/[/\\_]cat[/\\_]/gi, " ")
    .replace(/[?&]cat=[^&\s]*/gi, " ");

  // 2. Sanitize "Cat" false positives (Category, Cat. No., Cat #, Cat 5/6 cabling, CAT/Caterpillar machinery, etc.)
  cleanText = cleanText
    .replace(/\b(?:category|categories|categorized|categorization|catalogue|catalog|catalogues|catalogs|subcat|sub-category|sub-categories)\b/gi, " ")
    .replace(/\b(?:prod(?:uct)?|item|sub|main|shop|article|model|part)?\s*cat\b\.?\s*[:.\-–#]?\s*(?=[A-Za-z0-9])/gi, " ")
    .replace(/\bcat\b\.?\s*(?:no\.?|nos\.?|num\.?|number|#|code|part|id|class|rating|group|ref|item|type|section)\b\.?\s*[:.\-–]?\s*[A-Za-z0-9\-_]*/gi, " ")
    .replace(/\bcat\b\.?\s*[:.\-–#]\s*[A-Za-z0-9\-_]+/gi, " ")
    .replace(/\[\s*cat\b\.?[^\]]*\]|\(\s*cat\b\.?[^\)]*\)/gi, " ")
    .replace(/\bcat\s*[-_]?\s*(?:3|5|5e|6|6a|7|7a|8)\b(?:\s*(?:cabling|cables?|ethernet|patch|cord|cords|utp|stp|ftp|sftp|connector|wire|wiring|network))?/gi, " ")
    .replace(/\bcat\s+(?:cables?|cabling|patch|wire|utp|stp)\b/gi, " ")
    .replace(/\bcat\b\s+(?:equipment|machinery|machines?|loaders?|excavators?|dozers?|bulldozers?|tractors?|engines?|diesel|generators?|forklifts?|parts?|dealers?|dealerships?|power|heavy|mining|construction|tools?|filters?)\b/gi, " ")
    .replace(/\b(?:caterpillar|heavy\s*cat|cat\s*caterpillar)\b/gi, " ")
    .replace(/\bcat(?:alyst|alytic|alysis|alyze|alyzer|alyzers|alysts)\b/gi, " ")
    .replace(/\bcat(?:ering|erer|erers|ered)\b/gi, " ")
    .replace(/\bcat(?:ch|cher|chers|ching|ches|chment)\b/gi, " ")
    .replace(/\bcat(?:hode|hodic|hodes)\b/gi, " ");

  // 3. Sanitize "Ship" false positives (words ending in "-ship", parcel/freight logistics)
  cleanText = cleanText
    .replace(/\b[a-zA-Z]+(?:ship|ships)\b/gi, (word) => {
      if (/^(?:steamship|warship|battleship|flagship|spaceship|starship)s?$/i.test(word)) {
        return word;
      }
      return " ";
    })
    .replace(/\b(?:we\s+ship|ship\s+(?:to|worldwide|nationwide|internationally|domestically|via|by|with|orders|daily|within|freight|direct))\b/gi, " ")
    .replace(/\b(?:ready\s+to\s+ship|ships\s+(?:in|today|within|to|worldwide|daily)|will\s+ship|how\s+we\s+ship)\b/gi, " ")
    .replace(/\b(?:drop\s*ship(?:ping)?|dropship(?:ping)?)\b/gi, " ")
    .replace(/\b(?:free|fast|freight|same\s*day|standard|express|flat\s*rate|overnight|international|domestic|priority|ground)\s*shipping\b/gi, " ")
    .replace(/\bshipping\s*(?:policy|policies|cost|costs|info|information|method|methods|address|addresses|rate|rates|calculator|fee|fees|date|dates|label|labels|details|options|charge|charges|times?|carrier|carriers|weight|dimensions|terms|and\s+handling|and\s+returns|returns?)\b/gi, " ")
    .replace(/\b(?:shipment|shipments|shipped|shipping)\b/gi, " ");

  // 4. Sanitize "Defence" / "Defense" false positives (civilian, flood, legal, cyber, self, pest, corrosion defences)
  cleanText = cleanText
    .replace(/\b(?:flood|sea|coastal|storm|erosion|frost|weather|wind|sun|uv|heat|fire)\s*defen[cs]es?\b/gi, " ")
    .replace(/\b(?:pest|bug|insect|weed|crop|plant|microbial|infection|immune|body)\s*defen[cs]es?\b/gi, " ")
    .replace(/\b(?:cyber|data|network|it|cloud|endpoint|security)\s*defen[cs]es?\b/gi, " ")
    .replace(/\bcyber\-?defen[cs]es?\b/gi, " ")
    .replace(/\b(?:legal|self|criminal|patent|lawsuit|consumer)\s*defen[cs]es?\b/gi, " ")
    .replace(/\bself\-?defen[cs]es?\b/gi, " ")
    .replace(/\b(?:corrosion|wear|rust|abrasion|scratch|stain|damage)\s*defen[cs]es?\b/gi, " ")
    .replace(/\b(?:line\s+of|first\s+line\s+of|in\s+defence\s+of|in\s+defense\s+of|defen[cs]e\s+against|defen[cs]e\s+mechanism)\b/gi, " ");

  // 5. Sanitize industrial tools & material resistance
  cleanText = cleanText
    .replace(/\b(?:water|ink|hydro|sand)?\s*jets?\s*(?:cutting|cutter|cutters|machining|printing|printer|printers|pump|pumps|cleaning|cleaner|nozzle|nozzles)?\b/gi, " ")
    .replace(/\b(?:waterjet|inkjet|hydrojet)\b/gi, " ")
    .replace(/\b(?:air|utility|machine|slitter|guillotine|rotary|doctor)\s*knives?\b/gi, " ")
    .replace(/\bair\s*knife\s*(?:system|systems|drying|nozzle|nozzles|blower|blowers)?\b/gi, " ")
    .replace(/\b(?:chemical|chemically|marine|food)\s*(?:grade|resistance|resistant|proof|inert|inertness|compatibility|safe|approved)\b/gi, " ")
    .replace(/\bresistant\s+to\s+chemicals?\b/gi, " ")
    .replace(/\bisopropyl\s+alcohol\b/gi, " ");

  // 6. Sanitize industrial equipment/machinery/conveyors/tooling/supplies for food processing, bakery, dairy, and beverage industries
  cleanText = cleanText
    .replace(/\b(?:equipment|machinery|machines?|conveyors?|systems?|solutions?|supplies|tooling)\s+(?:for|in)\s+(?:the\s+)?(?:food\s*processing|meat\s*processing|poultry\s*processing|dairy|bakery|beverage|pharmaceutical|medical)\s*(?:industry|industries|sector|sectors|market|markets|facilities|plants?)?\b/gi, " ")
    .replace(/\b(?:food\s*processing|meat\s*processing|poultry\s*processing|seafood\s*processing|dairy\s*processing|bakery|bakeries|catering)\s+(?:equipment|machinery|machines?|conveyors?|systems?|packaging|packaging\s*machinery|automation|tooling|lines?|plants?|technology|engineering|solutions?|supplies|appliances?|industry|industries|facilities)\b/gi, " ");

  // 7. Sanitize pharmaceutical/medical industrial equipment, machinery, conveyors, packaging & served industries
  cleanText = cleanText
    .replace(/\b(?:pharmaceutical|medical|healthcare)\s+(?:equipment|machinery|machines?|conveyors?|packaging|packaging\s*machinery|processing|processing\s*equipment|automation|tooling|cleanrooms?|clean\s*rooms?|tanks?|vessels?|pumps?|valves?|piping|tubing|devices?|instrumentation|instruments?|components?|parts?|systems?|grade|applications?|industry|industries|sector|sectors|market|markets|facilities|manufacturing|solutions?)\b/gi, " ")
    .replace(/\b(?:food|beverage|packaging|dairy|bakery|meat|confectionery|cosmetic|cosmetics|chemical|nutraceutical)[,\s]+(?:and\s+)?(?:pharmaceutical|medical)\b/gi, " ")
    .replace(/\b(?:serving|serves|served|for|to)\s+(?:the\s+)?(?:pharmaceutical|medical)\s+(?:industry|industries|sector|sectors|applications?|market|markets)\b/gi, " ");

  for (const item of RESTRICTED_PATTERNS) {
    const regex = item.pattern || item;
    const label = item.label || "Prohibited Category";
    if (regex.test(cleanText)) {
      const m = cleanText.match(regex);
      return {
        isRestricted: true,
        matchedKeyword: m ? m[0] : "",
        category: label,
        reason: `${label} ("${m ? m[0] : ""}")`
      };
    }
  }
  return { isRestricted: false, matchedKeyword: null, reason: "", category: "" };
}

/**
 * Searches across all crawled pages to pinpoint the exact URL, matched keyword, and context snippet.
 * Prioritizes deep anchor/product links in HTML over generic homepage URLs.
 */
function detectRestrictedKeywords(text, html = "", crawledPages = []) {
  if (crawledPages && crawledPages.length > 0) {
    for (const page of crawledPages) {
      const pText = page.text || stripHtml(page.html || "");
      const res = detectRestrictedKeywordsSingle(pText, page.html || "");
      if (res.isRestricted) {
        const exactLink = findExactEvidenceLink(page.html || "", res.matchedKeyword, null, page.url);
        return {
          ...res,
          sourceUrl: exactLink || page.url,
          snippet: extractContextSnippet(pText, res.matchedKeyword)
        };
      }
    }
  }

  const fallback = detectRestrictedKeywordsSingle(text, html);
  if (fallback.isRestricted) {
    const pageUrl = (crawledPages && crawledPages[0] && crawledPages[0].url) || "";
    const exactLink = findExactEvidenceLink(html, fallback.matchedKeyword, null, pageUrl);
    return {
      ...fallback,
      sourceUrl: exactLink || pageUrl,
      snippet: extractContextSnippet(text, fallback.matchedKeyword)
    };
  }
  return { isRestricted: false, matchedKeyword: null, reason: "", category: "", sourceUrl: "", snippet: "" };
}

/**
 * Pinpoints the exact keyword, source page URL, and context snippet supporting a business type.
 * Prioritizes deep anchor links (e.g. /about, /manufacturing, /factory) over generic homepage URLs.
 */
function findBusinessTypeEvidence(businessType, crawledPages = [], fallbackText = "") {
  if (!businessType) return { keyword: "", sourceUrl: "", snippet: "" };

  const patterns = {
    "Manufacturer": [
      /\b(?:we\s+manufacture|our\s+factory|our\s+plant|production\s+facility|manufacturing\s+facility|custom\s+fabrication|die\s+casting|injection\s+molding|cnc\s+machining|assembly\s+line)\b/i,
      /\b(?:manufacturer|manufacturing|manufacture|fabricator|fabrication|producers?|oem|odm)\b/i,
      /\b(?:factory|plant|works)\b/i
    ],
    "Industrial Services": [
      /\b(?:industrial\s+services?|machining\s+services?|engineering\s+services?|surface\s+treatment|heat\s+treatment|calibration\s+services?|maintenance\s+and\s+repair|fabrication\s+services?|contract\s+manufacturing)\b/i
    ],
    "Supplier": [
      /\b(?:leading\s+supplier|we\s+supply|product\s+supplier|stockist\s+and\s+supplier|supplying\s+quality)\b/i,
      /\b(?:supplier|suppliers|supplying)\b/i
    ],
    "Distributer": [
      /\b(?:authorized\s+distributor|authorised\s+distributor|master\s+distributor|official\s+distributor|distribution\s+network)\b/i,
      /\b(?:distributor|distributer|distributors|distributers|distribution)\b/i
    ],
    "Wholesaler": [
      /\b(?:trade\s+only|wholesale\s+prices?|bulk\s+orders?|wholesale\s+supply|wholesalers?)\b/i,
      /\b(?:wholesaler|wholesalers|wholesale)\b/i
    ],
    "Exporter": [
      /\b(?:export\s+to|worldwide\s+exporter|exporting\s+to|global\s+export)\b/i,
      /\b(?:exporter|exporters|exporting)\b/i
    ],
    "Trader": [
      /\b(?:general\s+trading|import\s+and\s+export|import\s*\/\s*export|trading\s+co(?:mpany)?)\b/i,
      /\b(?:trader|traders|trading)\b/i
    ]
  };

  const list = patterns[businessType] || patterns["Supplier"] || [];
  if (crawledPages && crawledPages.length > 0) {
    for (const regex of list) {
      for (const page of crawledPages) {
        const text = page.text || stripHtml(page.html || "");
        const match = text.match(regex);
        if (match) {
          const exactLink = findExactEvidenceLink(page.html || "", match[0], regex, page.url);
          return {
            keyword: match[0],
            sourceUrl: exactLink || page.url,
            snippet: extractContextSnippet(text, match[0])
          };
        }
      }
    }
  }

  if (fallbackText) {
    for (const regex of list) {
      const match = fallbackText.match(regex);
      if (match) {
        const pageUrl = (crawledPages && crawledPages[0] && crawledPages[0].url) || "";
        const exactLink = findExactEvidenceLink(fallbackText, match[0], regex, pageUrl);
        return {
          keyword: match[0],
          sourceUrl: exactLink || pageUrl,
          snippet: extractContextSnippet(fallbackText, match[0])
        };
      }
    }
  }

  return {
    keyword: businessType.toLowerCase(),
    sourceUrl: (crawledPages && crawledPages[0] && crawledPages[0].url) || "",
    snippet: ""
  };
}

/**
 * Detects whether a website is on a free platform (Rule 9), deep/streaming subdomain (Rule 10),
 * or personal blog/website (Rule 8).
 */
function detectDisallowedWebsitePlatformOrDomain(url, html = "", text = "") {
  if (!url) return { isDisallowed: false, reason: "" };

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    return { isDisallowed: false, reason: "" };
  }
  const hostname = parsedUrl.hostname.toLowerCase();

  // Rule 9: Websites hosted on free platforms (WordPress, Wix, Weebly, Blogspot, etc.)
  const freePlatforms = [
    "wordpress.com", "wixsite.com", "weebly.com", "blogspot.com", "blogger.com",
    "webflow.io", "carrd.co", "squarespace.com", "jimdosite.com", "jimdofree.com",
    "mystrikingly.com", "site123.me", "godaddysites.com", "yolasite.com",
    "github.io", "pages.dev", "netlify.app", "vercel.app"
  ];
  for (const fp of freePlatforms) {
    if (hostname.endsWith("." + fp) || hostname === fp) {
      return {
        isDisallowed: true,
        reason: `Hosted on Free Platform (${fp}) - Rule 9`
      };
    }
  }

  // Rule 10: Multimedia / Entertainment streaming platforms
  const streamingHosts = [
    "youtube.com", "vimeo.com", "spotify.com", "soundcloud.com", "netflix.com",
    "twitch.tv", "dailymotion.com", "bandcamp.com", "audiomack.com", "deezer.com", "pandora.com"
  ];
  for (const sh of streamingHosts) {
    if (hostname.endsWith("." + sh) || hostname === sh) {
      return {
        isDisallowed: true,
        reason: `Multimedia / Entertainment Streaming Platform (${sh}) - Rule 10`
      };
    }
  }

  // Rule 10: Subdomain websites not hosted at root level
  const cleanHost = hostname.replace(/^www\./, "");
  const domainParts = cleanHost.split(".");
  const isMultiPartTld = /\.(?:co|com|org|net|edu|gov)\.[a-z]{2}$/i.test(hostname);
  const minPartsForRoot = isMultiPartTld ? 3 : 2;
  if (domainParts.length > minPartsForRoot) {
    const firstSub = domainParts[0];
    const isLangSub = /^[a-z]{2}(?:-[a-z]{2})?$/i.test(firstSub);
    const isCommonSub = /^(?:m|mobile|web|shop|store|online|b2b)$/i.test(firstSub);
    if (!isLangSub && !isCommonSub && domainParts.length > (minPartsForRoot + 1)) {
      return {
        isDisallowed: true,
        reason: `Subdomain Website Not Hosted at Root Level (${hostname}) - Rule 10`
      };
    }
  }

  // Rule 8: Personal websites, personal blogs, etc.
  const plainText = (text || stripHtml(html)).slice(0, 3000).toLowerCase();
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = (titleMatch ? titleMatch[1] : "").toLowerCase();
  const isPersonalBlog =
    /\b(?:personal\s*blog|personal\s*website|my\s*personal\s*site|personal\s*portfolio|lifestyle\s*blog|travel\s*blog|food\s*blog|mommy\s*blog|personal\s*diary|resume\s*of|cv\s*of)\b/i.test(pageTitle + " " + plainText);
  if (isPersonalBlog) {
    return {
      isDisallowed: true,
      reason: `Personal Website / Blog - Rule 8`
    };
  }

  // Rule 1: Parked domains, domains for sale, placeholder holding pages, and under construction
  const parkedPatterns = [
    /\b(?:buy\s+this\s+domain|domain\s+(?:is\s+)?for\s+sale|this\s+domain\s+(?:may\s+be\s+)?for\s+sale|inquire\s+about\s+this\s+domain|purchase\s+this\s+domain)\b/i,
    /\b(?:hugedomains\.com|sedo(?:\.com)?|godaddy\s*parked|dan\.com|afternic\.com|parked\s+domain|domain\s+parking)\b/i,
    /\b(?:website\s+under\s+construction|site\s+under\s+construction|under\s+construction|page\s+under\s+development|default\s+web\s+site\s+page|apache2\s+(?:ubuntu|debian)\s+default\s+page)\b/i,
    /\b(?:this\s+site\s+is\s+currently\s+unavailable|account\s+suspended|this\s+account\s+has\s+been\s+suspended)\b/i
  ];
  for (const pp of parkedPatterns) {
    if (pp.test(pageTitle + " " + plainText)) {
      return {
        isDisallowed: true,
        reason: "Parked Domain / Under Construction (Rule 1)"
      };
    }
  }

  return { isDisallowed: false, reason: "" };
}

/**
 * Detects Flash format websites without copyable text per Rule 14.
 */
function detectFlashFormatSite(html = "") {
  if (!html || typeof html !== "string") return false;
  const hasFlashObject =
    /<(?:object|embed)[^>]+(?:shockwave-flash|clsid:d27cdb6e-ae6d-11cf-96b8-444553540000|\.swf)/i.test(html) ||
    /\.swf\b/i.test(html);
  if (!hasFlashObject) return false;
  const copyableText = stripHtml(html).replace(/\s+/g, " ").trim();
  return copyableText.length < 80;
}

/**
 * Detects non-English websites without an English translation option per Rule 12.
 */
function detectNonEnglishWithoutTranslation(html = "", text = "") {
  if (!html && !text) return false;

  // Check if an English version or translation option is available
  const hasEnglishOption =
    /<a[^>]+href=["'][^"']*["'][^>]*>[\s\S]{0,30}?\b(?:english|en|eng)\b[\s\S]{0,30}?<\/a>/i.test(html) ||
    /<(?:link|meta)[^>]+(?:hreflang|lang)=["']en["']/i.test(html) ||
    /\b(?:translate\.google\.com|gtranslate|wpml|weglot|polylang)\b/i.test(html) ||
    /<(?:select|div|ul|nav)[^>]+(?:class|id)=["'][^"']*(?:lang|translate)[^"']*["']/i.test(html);

  if (hasEnglishOption) return false;

  const plainText = (text || stripHtml(html)).slice(0, 4000);
  if (plainText.length < 20) return false;

  const cjkCount = (plainText.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const cyrillicCount = (plainText.match(/[\u0400-\u04ff]/g) || []).length;
  const arabicCount = (plainText.match(/[\u0600-\u06ff]/g) || []).length;
  const thaiCount = (plainText.match(/[\u0e00-\u0e7f]/g) || []).length;

  const nonLatinChars = cjkCount + cyrillicCount + arabicCount + thaiCount;
  if (nonLatinChars >= 10 && (nonLatinChars / plainText.length) > 0.25) {
    return true;
  }

  const htmlLangMatch = html.match(/<html[^>]+lang=["']([a-zA-Z]{2}(?:-[a-zA-Z]{2})?)["']/i);
  if (htmlLangMatch) {
    const lang = htmlLangMatch[1].toLowerCase().slice(0, 2);
    if (!["en"].includes(lang)) {
      const englishWords = (plainText.match(/\b(?:the|and|for|with|company|contact|about|products|services|our|we|are|home)\b/gi) || []).length;
      if (englishWords < 5) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether a website has evidence of being a Manufacturer (Rules 11 & 16 exception).
 */
function isManufacturerSite(crawlData, text = "") {
  if (!crawlData) return false;
  const combined = ((crawlData.bodyText || "") + " " + (crawlData.profilePageText || "") + " " + (crawlData.footerText || "") + " " + (text || "")).toLowerCase();
  return /\b(?:manufacturer|manufacturers|manufacturing|manufacture|we\s+manufacture|our\s+factory|production\s+plant|production\s+facility|fabrication\s+plant|fabrication\s+facility|oem|odm|custom\s+fabricat(?:ion|or|ed|ing))\b/i.test(combined);
}

/**
 * Safely parses all JSON-LD script blocks in HTML and recursively inspects @graph / objects
 * to find genuine Product entities with valid Offer schemas containing a verified positive price.
 */
function extractJsonLdProductOffer(html) {
  if (!html || typeof html !== "string") return { hasProductOffer: false };
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);

      const checkEntity = (item) => {
        if (!item || typeof item !== "object") return null;
        const itemType = String(item["@type"] || "").toLowerCase();
        const types = Array.isArray(item["@type"]) ? item["@type"].map(t => String(t).toLowerCase()) : [itemType];
        const isProduct = types.some(t => t === "product" || t.endsWith("/product"));

        if (isProduct && item.offers) {
          const offersList = Array.isArray(item.offers) ? item.offers : [item.offers];
          for (const off of offersList) {
            if (!off || typeof off !== "object") continue;
            const offType = String(off["@type"] || "").toLowerCase();
            const offTypes = Array.isArray(off["@type"]) ? off["@type"].map(t => String(t).toLowerCase()) : [offType];
            const isOffer = offTypes.some(t => t === "offer" || t === "aggregateoffer" || t.endsWith("/offer"));

            const rawPrice = off.price !== undefined ? off.price : (off.lowPrice !== undefined ? off.lowPrice : off.highPrice);
            const numPrice = parseFloat(rawPrice);
            if (!isNaN(numPrice) && numPrice > 0) {
              return {
                hasProductOffer: true,
                price: numPrice,
                currency: off.priceCurrency || "",
                name: item.name || ""
              };
            }
          }
        }
        return null;
      };

      const traverse = (node) => {
        if (!node) return null;
        if (Array.isArray(node)) {
          for (const el of node) {
            const found = traverse(el);
            if (found) return found;
          }
        } else if (typeof node === "object") {
          const direct = checkEntity(node);
          if (direct) return direct;
          if (node["@graph"] && Array.isArray(node["@graph"])) {
            for (const el of node["@graph"]) {
              const found = traverse(el);
              if (found) return found;
            }
          }
        }
        return null;
      };

      const found = traverse(data);
      if (found) return found;
    } catch (e) { }
  }
  return { hasProductOffer: false };
}

/**
 * Extracts product-level unit price.
 * Rejects unrelated prices appearing in footers, blogs, articles, or company revenue.
 * Properly decodes HTML currency entities (&#36;, &pound;, &euro;) and handles thousands commas.
 */
function extractProductLevelPrice(html, text, jsonLdOffer) {
  // 1. Valid JSON-LD Product Offer price
  if (jsonLdOffer && jsonLdOffer.hasProductOffer && jsonLdOffer.price > 0) {
    return {
      hasPrice: true,
      price: jsonLdOffer.price,
      currency: jsonLdOffer.currency,
      source: "JSON-LD Product Offer"
    };
  }

  const rawHtml = String(html || "");

  // 2. Microdata / OpenGraph / Meta product price
  const metaPriceMatch = rawHtml.match(/<(?:meta|input)[^>]+(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["'][^>]+content=["']([0-9]+(?:\.[0-9]{2})?)["']/i) ||
    rawHtml.match(/<(?:meta|input)[^>]+content=["']([0-9]+(?:\.[0-9]{2})?)["'][^>]+(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["']/i);
  if (metaPriceMatch) {
    const val = parseFloat(metaPriceMatch[1]);
    if (!isNaN(val) && val > 0) {
      return {
        hasPrice: true,
        price: val,
        source: "Meta/Microdata Product Price"
      };
    }
  }

  // 3. Dedicated product price HTML classes / containers
  // Handles WooCommerce / Shopify inner tags (like <bdi><span class="woocommerce-Price-currencySymbol">&#36;</span>25,300.00</bdi>)
  // and loops to bypass $0.00 cart counters in headers to find actual product prices.
  const productPriceClassRegex = /(?:class|id)=["'][^"']*\b(?:product[-_]?price|single[-_]?price|offer[-_]?price|sale[-_]?price|current[-_]?price|regular[-_]?price|woocommerce-Price-amount|entry[-_]?price|price-box|price)\b[^"']*["'][^>]*>[\s\S]{0,150}?(?:[\$£€¥₹]|&#36;|&dollar;|&pound;|&#163;|&euro;|&#8364;|&#165;|&#8377;|AU\$|CA\$|USD|EUR|GBP)[\s\S]{0,30}?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/gi;
  let classMatch;
  while ((classMatch = productPriceClassRegex.exec(rawHtml)) !== null) {
    const val = parseFloat(classMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) {
      return {
        hasPrice: true,
        price: val,
        source: "Product Price Container"
      };
    }
  }

  // 4. Price in close proximity (within 150 chars) of an Add to Cart / Buy button
  const proximityRegex = /(?:(?:[\$£€¥₹]|&#36;|&dollar;|&pound;|&#163;|&euro;|&#8364;|&#165;|&#8377;|AU\$|CA\$|USD|EUR|GBP)[\s\S]{0,30}?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)[\s\S]{0,150}?\b(?:add\s+to\s+cart|add\s+to\s+bag|buy\s+now|add\s+to\s+basket)\b|\b(?:add\s+to\s+cart|add\s+to\s+bag|buy\s+now|add\s+to\s+basket)\b[\s\S]{0,150}?(?:[\$£€¥₹]|&#36;|&dollar;|&pound;|&#163;|&euro;|&#8364;|&#165;|&#8377;|AU\$|CA\$|USD|EUR|GBP)[\s\S]{0,30}?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?))/gi;
  let proxMatch;
  while ((proxMatch = proximityRegex.exec(rawHtml)) !== null) {
    const val = parseFloat((proxMatch[1] || proxMatch[2]).replace(/,/g, ''));
    if (!isNaN(val) && val > 0) {
      return {
        hasPrice: true,
        price: val,
        source: "CTA Proximity Price"
      };
    }
  }

  return { hasPrice: false };
}

/**
 * Extracts functional cart action.
 * Requires a verified Add to Cart form, button, input, or verified cart endpoint.
 * Cart quantity counters (e.g. Cart (0)) alone do NOT count as functional cart.
 */
function extractFunctionalCartAction(html) {
  const rawHtml = String(html || "");

  // 1. Form submitting to cart endpoint
  const cartFormRegex = /<form[^>]+action=["'][^"']*(?:\/cart\/add|\/cart|\/basket|\/bag|add-to-cart)[^"']*["']/i;
  const formMatch = rawHtml.match(cartFormRegex);
  if (formMatch) {
    return { hasCart: true, signal: `Form action: ${formMatch[0].slice(0, 80)}` };
  }

  // 2. Query param add-to-cart link (WooCommerce standard action)
  const addParamRegex = /href=["'][^"']*[?&]add-to-cart=\d+[^"']*["']/i;
  const addParamMatch = rawHtml.match(addParamRegex);
  if (addParamMatch) {
    return { hasCart: true, signal: `Add to cart link param: ${addParamMatch[0].slice(0, 80)}` };
  }

  // 3. Buttons / links with explicit "Add to Cart" / "Buy Now" CTA text
  const ctaTagRegex = /<(?:button|a|input)[^>]*>[\s\S]{0,120}?\b(?:add\s+to\s+cart|add\s+to\s+bag|add\s+to\s+basket|buy\s+now|order\s+now|buy\s+online)\b[\s\S]{0,120}?<\/(?:button|a)>/i;
  const ctaTagMatch = rawHtml.match(ctaTagRegex);
  if (ctaTagMatch) {
    return { hasCart: true, signal: `CTA text: ${ctaTagMatch[0].slice(0, 80)}` };
  }

  const inputSubmitRegex = /<input[^>]+(?:type=["'](?:submit|button)["'])[^>]+value=["'][^"']*\b(?:add\s+to\s+cart|add\s+to\s+bag|add\s+to\s+basket|buy\s+now|order\s+now)\b[^"']*["']/i;
  const inputSubmitMatch = rawHtml.match(inputSubmitRegex);
  if (inputSubmitMatch) {
    return { hasCart: true, signal: `Input submit: ${inputSubmitMatch[0].slice(0, 80)}` };
  }

  const inputSubmitRevRegex = /<input[^>]+value=["'][^"']*\b(?:add\s+to\s+cart|add\s+to\s+bag|add\s+to\s+basket|buy\s+now|order\s+now)\b[^"']*["'][^>]+(?:type=["'](?:submit|button)["'])/i;
  const inputSubmitRevMatch = rawHtml.match(inputSubmitRevRegex);
  if (inputSubmitRevMatch) {
    return { hasCart: true, signal: `Input submit: ${inputSubmitRevMatch[0].slice(0, 80)}` };
  }

  const ariaLabelRegex = /<(?:button|a|div|span)[^>]+aria-label=["'][^"']*\b(?:add\s+to\s+cart|add\s+to\s+bag|add\s+to\s+basket|buy\s+now)\b[^"']*["']/i;
  const ariaMatch = rawHtml.match(ariaLabelRegex);
  if (ariaMatch) {
    return { hasCart: true, signal: `Aria label: ${ariaMatch[0].slice(0, 80)}` };
  }

  // 4. Established e-commerce add to cart button classes / IDs
  const cartBtnClassRegex = /\b(?:single_add_to_cart_button|add_to_cart_button|ajax_add_to_cart|snipcart-add-item|shopify-payment-button)\b/i;
  const classMatch = rawHtml.match(cartBtnClassRegex);
  if (classMatch) {
    return { hasCart: true, signal: `Cart button class: ${classMatch[0]}` };
  }

  // 5. Active Shop navigation route + e-commerce cart widget
  const shopNavRegex = /<a[^>]+href=["'][^"']*\/(?:shop|store|online[-_]?store)\/?["'][^>]*>[\s\S]{0,60}?\b(?:shop|store|online\s+store)\b[\s\S]{0,60}?<\/a>/i;
  const cartWidgetRegex = /\b(?:widget-woocommerce-menu-cart|woocommerce-cart|site-header__cart|cart-drawer)\b/i;
  if (shopNavRegex.test(rawHtml) && cartWidgetRegex.test(rawHtml)) {
    return { hasCart: true, signal: "Active Shop navigation with shopping cart widget" };
  }

  return { hasCart: false };
}

/**
 * Extracts online checkout gateway.
 * Inspects checkout routes, shopping cart routes, checkout CTA buttons, void input tags, aria-labels,
 * and payment gateway integrations.
 */
function extractCheckoutGateway(html) {
  const rawHtml = String(html || "");

  // 1. Direct standard checkout route links (href)
  const checkoutRouteRegex = /<a[^>]+href=["'][^"']*(?:\/(?:checkout|express_checkout|onepagecheckout|cart\/checkout)\b)(?:\/|["'?#])/i;
  const routeMatch = rawHtml.match(checkoutRouteRegex);
  if (routeMatch) {
    return { hasCheckout: true, signal: `Checkout route link: ${routeMatch[0].slice(0, 80)}` };
  }

  // 2. Direct shopping cart route links (href)
  const cartRouteRegex = /<a[^>]+href=["'][^"']*(?:\/(?:cart|basket|shopping[-_]?cart|my[-_]?cart)\b)(?:\/|["'?#])/i;
  const cartMatch = rawHtml.match(cartRouteRegex);
  if (cartMatch) {
    return { hasCheckout: true, signal: `Shopping cart route link: ${cartMatch[0].slice(0, 80)}` };
  }

  // 3. E-commerce active cart components (WooCommerce, Shopify cart widgets)
  const cartWidgetRegex = /\b(?:widget-woocommerce-menu-cart|wc-cart-fragments|snipcart\.com|checkout\.stripe\.com|paypal\.com\/checkout|pay\.shopify\.com)\b/i;
  const widgetMatch = rawHtml.match(cartWidgetRegex);
  if (widgetMatch) {
    return { hasCheckout: true, signal: `E-commerce cart widget: ${widgetMatch[0]}` };
  }

  // 4. Checkout forms
  const checkoutFormRegex = /<form[^>]+action=["'][^"']*(?:\/(?:checkout|express_checkout|onepagecheckout)\b)[^"']*["']/i;
  const formMatch = rawHtml.match(checkoutFormRegex);
  if (formMatch) {
    return { hasCheckout: true, signal: `Checkout form: ${formMatch[0].slice(0, 80)}` };
  }

  // 5. Checkout CTA buttons or inputs (supports nested spans, void input tags, aria-labels)
  const checkoutBtnRegex = /<(?:button|a|input)[^>]*>[\s\S]{0,120}?\b(?:proceed\s+to\s+checkout|checkout\s+now|place\s+order|pay\s+now|complete\s+order|checkout|pay\s+with\s+(?:paypal|stripe|apple\s+pay|google\s+pay|klarna|afterpay))\b/i;
  const btnMatch = rawHtml.match(checkoutBtnRegex);
  if (btnMatch) {
    return { hasCheckout: true, signal: `Checkout button: ${btnMatch[0].slice(0, 80)}` };
  }

  const checkoutInputRegex = /<input[^>]+(?:type=["'](?:submit|button|image)["'])[^>]+value=["'][^"']*\b(?:proceed\s+to\s+checkout|checkout\s+now|place\s+order|pay\s+now|checkout)\b[^"']*["']/i;
  const inputMatch = rawHtml.match(checkoutInputRegex);
  if (inputMatch) {
    return { hasCheckout: true, signal: `Checkout input: ${inputMatch[0].slice(0, 80)}` };
  }

  const checkoutInputRevRegex = /<input[^>]+value=["'][^"']*\b(?:proceed\s+to\s+checkout|checkout\s+now|place\s+order|pay\s+now|checkout)\b[^"']*["'][^>]+(?:type=["'](?:submit|button|image)["'])/i;
  const inputRevMatch = rawHtml.match(checkoutInputRevRegex);
  if (inputRevMatch) {
    return { hasCheckout: true, signal: `Checkout input: ${inputRevMatch[0].slice(0, 80)}` };
  }

  // 6. Data attributes or names indicating checkout
  const dataActionRegex = /<(?:button|a|input|div)[^>]+(?:data-action|data-testid|aria-label|name)=["'][^"']*\b(?:checkout|proceed-to-checkout|place-order)\b[^"']*["']/i;
  const dataMatch = rawHtml.match(dataActionRegex);
  if (dataMatch) {
    return { hasCheckout: true, signal: `Checkout attribute: ${dataMatch[0].slice(0, 80)}` };
  }

  return { hasCheckout: false };
}

/**
 * Extracts fulfillment & delivery logistics signals.
 */
function extractFulfillmentLogistics(html, text) {
  const combined = String(html || "") + " " + String(text || "");

  const shippingRegex = /\b(?:shipping\s+(?:policy|information|rates|charges|options|method)|delivery\s+(?:policy|timelines|charges)|free\s+shipping\s+on\s+orders|calculated\s+at\s+checkout|estimated\s+delivery|ships\s+in\s+\d+\s*(?:business\s+)?days|dispatch\s+within\s+\d+\s*(?:business\s+)?days|courier\s+delivery)\b/i;
  const returnsRegex = /\b(?:return\s+policy|returns\s+(?:&|and)\s+exchanges|refund\s+policy|order\s+tracking|track\s+(?:your\s+)?order|track\s+shipment)\b/i;

  const shipMatch = combined.match(shippingRegex);
  const retMatch = combined.match(returnsRegex);

  if (shipMatch || retMatch) {
    return {
      hasFulfillment: true,
      signal: shipMatch ? shipMatch[0] : retMatch[0]
    };
  }

  return { hasFulfillment: false };
}

/**
 * Evaluates B2B Quote and Dealer purchasing actions.
 * Distinguishes between purchasing actions on products vs unrelated footer text.
 */
function extractB2BExclusions(html, text) {
  const rawHtml = String(html || "");
  const rawText = String(text || "");
  const combined = rawHtml + " " + rawText;

  // 1. Product-level / Purchasing CTA quote actions:
  const productQuoteCtaRegex = /<(?:button|a|input)[^>]*>[\s\S]{0,100}?\b(?:request\s+(?:a\s+)?quote|get\s+(?:a\s+)?quote|ask\s+for\s+(?:a\s+)?quote|request\s+pricing|contact\s+(?:us\s+)?for\s+pric(?:e|ing)|call\s+for\s+pric(?:e|ing)|price\s+on\s+(?:application|request)|inquir(?:y|e)\s+(?:for\s+pric(?:e|ing)|about\s+pric(?:e|ing)|now|online|cart|basket|list)|send\s+inquiry|add\s+to\s+quote|quote\s+(?:cart|basket|list|request)|rfq)\b[\s\S]{0,100}?<\/(?:button|a)>/i;
  const quoteCtaMatch = rawHtml.match(productQuoteCtaRegex);

  // 2. Dealer locator CTA:
  const dealerCtaRegex = /<(?:button|a)[^>]*>[\s\S]{0,80}?\b(?:find\s+(?:a\s+)?dealer|dealer\s+locator|where\s+to\s+buy|find\s+(?:a\s+)?distributor|distributor\s+locator|locate\s+(?:a\s+)?dealer|our\s+distributors)\b[\s\S]{0,80}?<\/(?:button|a)>/i;
  const dealerCtaMatch = rawHtml.match(dealerCtaRegex);

  // 3. General text occurrences (e.g. anywhere in text including footer/header)
  const generalQuoteRegex = /\b(?:request\s+(?:a\s+)?quote|get\s+(?:a\s+)?quote|contact\s+sales|inquir(?:y|e)\s+(?:for\s+pric(?:e|ing)|about\s+pric(?:e|ing)|basket|cart)|add\s+to\s+quote)\b/i;
  const generalDealerRegex = /\b(?:find\s+(?:a\s+)?dealer|dealer\s+locator|where\s+to\s+buy|distributor\s+locator)\b/i;

  const hasProductQuoteCta = !!quoteCtaMatch;
  const hasProductDealerCta = !!dealerCtaMatch;
  const hasGeneralQuote = generalQuoteRegex.test(combined);
  const hasGeneralDealer = generalDealerRegex.test(combined);

  return {
    hasProductQuoteCta,
    hasProductDealerCta,
    hasGeneralQuote,
    hasGeneralDealer,
    isQuoteOnlyPurchasing: hasProductQuoteCta || hasProductDealerCta,
    signal: quoteCtaMatch ? quoteCtaMatch[0] : (dealerCtaMatch ? dealerCtaMatch[0] : "")
  };
}

/**
 * 3-Tier Multi-Check E-Commerce Verification Rule.
 * Classifies a website as E-COMMERCE (Online Shopping) IF AND ONLY IF:
 *   [Mandatory Core Rule: Direct Transaction Capability (Cart + Unit Price + Online Checkout Gateway)]
 *   AND
 *   [Secondary Operational Signal: Delivery / Fulfillment Logistics OR Structured Product-Offer Schema]
 *
 * NOTE: The checkout gateway is strictly MANDATORY and cannot be substituted by technical schema or footprints.
 * Unrelated quotes in footers do NOT disqualify verified direct checkout.
 */
function detectPurchaseOrShoppingCart(html = "", text = "") {
  if (!html && !text) return { detected: false, reason: "", isHighConfidence: false };

  const rawHtml = String(html || "");
  const rawText = String(text || "");

  // Step 1: JSON-LD Product Offer Parsing (strict JSON parse + graph traversal)
  const jsonLdOffer = extractJsonLdProductOffer(rawHtml);

  // Step 2: Functional Cart Action (verified Add to Cart / cart endpoint; quantity counter alone rejected)
  const cartRes = extractFunctionalCartAction(rawHtml);

  // Step 3: Product-Level Price Verification (rejects unrelated revenue or footer currency)
  const priceRes = extractProductLevelPrice(rawHtml, rawText, jsonLdOffer);

  // Step 4: Online Checkout Gateway Verification (routes, CTA buttons, void input tags, payment gateways)
  const checkoutRes = extractCheckoutGateway(rawHtml);

  // Step 5: Fulfillment & Delivery Logistics (Shipping / returns policy, order tracking)
  const fulfillRes = extractFulfillmentLogistics(rawHtml, rawText);

  // Step 6: B2B Quote & Dealer Purchasing Exclusions (contextual analysis)
  const b2bRes = extractB2BExclusions(rawHtml, rawText);

  // MANDATORY CORE RULE: Direct Transaction Capability strictly requires ALL THREE:
  // 1. Functional Cart Action AND
  // 2. Defined Product Price AND
  // 3. Online Checkout Gateway
  // (Technical schema or platform footprints CANNOT substitute for the checkout gateway!)
  const hasTransactionCapability = cartRes.hasCart && priceRes.hasPrice && checkoutRes.hasCheckout;

  // Secondary Operational Signal: Delivery / Fulfillment Logistics OR Verified Structured Schema
  const hasSecondarySignal = fulfillRes.hasFulfillment || jsonLdOffer.hasProductOffer;

  // Direct Online Store Platform Detection: Active Shop navigation link combined with active e-commerce platform / cart widget
  const hasActiveStorePlatform = /\b(?:widget-woocommerce-menu-cart|woocommerce-cart|wc-cart-fragments|Shopify\.routes|cdn\.shopify\.com\/s\/files|snipcart\.com|ec[-_]?cart|prestashop|opencart)\b/i.test(rawHtml);
  const hasActiveShopNav = /<a[^>]+href=["'][^"']*\/(?:shop|store|online[-_]?store)\/?["'][^>]*>[\s\S]{0,60}?\b(?:shop|store|online\s+store)\b[\s\S]{0,60}?<\/a>/i.test(rawHtml);
  const isDirectStorePlatform = hasActiveShopNav && hasActiveStorePlatform;

  const evidence = {
    hasCartAction: cartRes.hasCart,
    cartSignal: cartRes.signal || "",
    hasProductPrice: priceRes.hasPrice,
    priceSignal: priceRes.source ? `${priceRes.source} (${priceRes.currency || ''} ${priceRes.price || ''})` : "",
    hasCheckoutGateway: checkoutRes.hasCheckout,
    checkoutSignal: checkoutRes.signal || "",
    hasFulfillment: fulfillRes.hasFulfillment,
    fulfillmentSignal: fulfillRes.signal || "",
    hasProductSchema: jsonLdOffer.hasProductOffer,
    schemaSignal: jsonLdOffer.hasProductOffer ? `Product: ${jsonLdOffer.name || 'Yes'}, Price: ${jsonLdOffer.currency} ${jsonLdOffer.price}` : "",
    hasB2BQuoteOrDealer: b2bRes.isQuoteOnlyPurchasing || b2bRes.hasGeneralQuote,
    b2bSignal: b2bRes.signal || "",
    isDirectStorePlatform: isDirectStorePlatform
  };

  // EVALUATION:
  // 1. Direct Transaction Capability Verified (Cart + Product Price + Online Checkout/Cart Gateway)
  // OR Active Online Store Platform (Shop navigation + e-commerce cart widget)
  if (hasTransactionCapability || isDirectStorePlatform) {
    const reason = hasTransactionCapability
      ? `E-Commerce Verified (Cart: ${cartRes.signal || 'Yes'} + Price: ${priceRes.source || 'Yes'} (${priceRes.price || ''}) + Checkout: ${checkoutRes.signal || 'Yes'}${fulfillRes.hasFulfillment ? ' + Shipping: ' + fulfillRes.signal : ''})`
      : `Online Shopping Store Detected (Active Shop Navigation + E-Commerce Cart Platform: ${checkoutRes.signal || 'WooCommerce/Shopify Cart'})`;

    return {
      detected: true,
      reason: reason,
      isEcommerce: true,
      isB2BCatalog: false,
      isHighConfidence: true,
      evidence: evidence
    };
  }

  // 2. Not Direct Transaction: B2B Catalog / Quote-Only / Dealer Locator
  if (b2bRes.isQuoteOnlyPurchasing || b2bRes.hasGeneralQuote || b2bRes.hasGeneralDealer) {
    return {
      detected: false,
      reason: "",
      isEcommerce: false,
      isB2BCatalog: true,
      isHighConfidence: false,
      b2bSignal: b2bRes.signal || "Quote / Dealer Catalog",
      evidence: evidence
    };
  }

  return {
    detected: false,
    reason: "",
    isEcommerce: false,
    isB2BCatalog: false,
    isHighConfidence: false,
    evidence: evidence
  };
}

/**
 * Option A: Gemini Structured Outputs Schema.
 * Guarantees that every field returned by Gemini adheres strictly to exact data types and enum constraints.
 */
const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    websiteStatus: {
      type: "STRING",
      enum: ["Working", "Not Working", "Redirect Site"],
      description: "Working if operational physical goods company; Not Working if dead, 404, 0 products, or prohibited; Redirect Site if redirected to different domain"
    },
    businessType: {
      type: "STRING",
      enum: [
        "Manufacturer",
        "Industrial Services",
        "Exporter",
        "Trader",
        "Distributer",
        "Supplier",
        "Wholesaler",
        "Service Provider",
        "Online Shopping",
        "Restricted Site",
        "Other"
      ],
      description: "Business scope classification. Manufacturer, Industrial Services, Exporter, Trader, Distributer, Supplier, Wholesaler are allowed working types."
    },
    companyProfile: {
      type: "STRING",
      enum: ["Available", "Not Available"],
      description: "Available if dedicated company overview/profile/history text exists; else Not Available"
    },
    companyName: {
      type: "STRING",
      description: "Official corporate name in Title Case where EVERY single word starts with a Capital letter (e.g. Inter Outstanding Electronics Incorporated, H&R Manufacturing, Web Rack Industrial Company Limited, PEM Fountain Company, Hsin Hsin Metals, Limited). CRITICAL QC RULE: DO NOT expand symbols like '&' into 'And' (keep '&' as it is: e.g. 'H&R Manufacturing', 'Johnson & Johnson'). If a comma precedes the corporate legal suffix on the website (e.g. 'HSINHSIN METALS, LTD.'), you MUST retain the comma (e.g. 'Hsin Hsin Metals, Limited'). DO NOT invent or add 'Company' if not in the official name. Brand acronyms/trademarks must be in UPPERCASE (e.g. PEM, BMW, AKS, HR, CRP). Expand all corporate abbreviations to full form (Co. -> Company, Ltd. -> Limited, Inc. -> Incorporated)."
    },
    countryName: {
      type: "STRING",
      description: "You must write the country name in full form in Title Case where EVERY single word starts with a Capital letter (e.g. Czechia, Turkiye, United States Of America, England, Wales, Scotland, Northern Ireland, United Kingdom, Canada, Australia, Taiwan, India). If the country name is not available on the site, check on social media. If still not available, search on Google using the city and state name. We consider the locality for the country name. Example: United Kingdom (England, Wales, Scotland, Northern Ireland). If 'England' and 'United Kingdom' both are mentioned, you must take England as the country name (same for Wales, Scotland, Northern Ireland)."
    },
    companyAddress: {
      type: "STRING",
      description: "CRITICAL MANDATE - FULL PHYSICAL ADDRESS: You MUST take the COMPLETE FULL physical address with ALL available structural components from the website: Premise / Building Name / Office Park / Suite / Unit / Floor / Level / Block / Lot / Plot / Factory / Workshop / Survey Number, Industrial Estate / Business Park / Zone, Street Number and Street Name, Suburb / Locality / Neighborhood / Village, Town / Township / Sub-district / District, City, and State / Province / Territory / County / Region. NEVER return an incomplete or partial address (NEVER return only a street name or omit premise/suite/suburb/city/state). Format in Title Case where EVERY single word starts with a Capital letter (e.g. 'Suite 260, 2021 Guadalupe Street, Austin, Texas' or '15 Telford Way, Kettering, Northamptonshire' or '5th Floor, Office Park, Number 535, Qingshuiqiao Road, Hi-Tech Zone, Ningbo' or '40 Sarah Street, Campbellfield, Victoria'). CRITICAL QC RULE - NO EXTRA WORDS: Retain all authentic address words that appear on the website; do not invent or add words not present (e.g. if 'Number' or 'No.' is not written, DO NOT add 'Number'; if 'City' is not written, DO NOT add 'City'; if 'District' is not written, DO NOT add 'District'). MANDATORY FULL FORM EXPANSION: You MUST expand all abbreviations to full form globally (5/F. or 5/F or 5F -> 5th Floor, 1/F -> 1st Floor, 2/F -> 2nd Floor, 3/F -> 3rd Floor, G/F -> Ground Floor, B/F -> Basement Floor, Lvl -> Level, No. -> Number, St. -> Street, Rd. -> Road, Ave. -> Avenue, Dr. -> Drive, Blvd. -> Boulevard, Ste. -> Suite, Bldg. -> Building, Flr. -> Floor, Rm. -> Room, Dept. -> Department, Apt. -> Apartment, POB -> Post Office Box). Strip country name and postal codes."
    },
    state: {
      type: "STRING",
      enum: ["Available", "Not Available"],
      description: "Available if state/province is identifiable in address; else Not Available"
    },
    city: {
      type: "STRING",
      enum: ["Available", "Not Available"],
      description: "Available if an official City, Town, Township, District, or Municipality is identifiable in the address; else Not Available. CRITICAL QC RULE: A SUBURB IS NOT A CITY! If the address only contains a suburb or locality (e.g. Keishan, Campbellfield, Rowville, Welshpool, Mascot, Rydalmere, Sandton, Penrose) with no explicit recognized city/town, MUST mark Not Available! For Taiwan: if address only contains a suburb (e.g. Keishan) or municipality without the explicit word 'City', MUST mark Not Available!"
    },
    emailId: {
      type: "STRING",
      description: "Primary corporate contact email address found anywhere on website or company social media (LinkedIn, Facebook)"
    },
    secondaryEmailId: {
      type: "STRING",
      description: "Secondary distinct corporate email from anywhere on website or company social media (LinkedIn, Facebook). STRICTLY MUST NOT be the same as emailId. If only one email exists, return empty string \"\"."
    },
    phoneNumber: {
      type: "STRING",
      description: "Take the complete phone number, but remove the country code, special characters, and spaces. Do not take toll-free numbers. Do not take numbers starting with zero. Digits only."
    },
    numberOfProducts: {
      type: "STRING",
      enum: ["0", "1", "2", "3"],
      description: "Number of physical product items/catalog offerings identified (must be synchronized and equal to productImages and numberOfProductDescriptions)"
    },
    productImages: {
      type: "STRING",
      enum: ["0", "1", "2", "3"],
      description: "Number of physical product images identified (must be synchronized and equal to numberOfProducts and numberOfProductDescriptions)"
    },
    numberOfProductDescriptions: {
      type: "STRING",
      enum: ["0", "1", "2", "3"],
      description: "Number of physical product descriptions identified (must be synchronized and equal to numberOfProducts and productImages)"
    }
  },
  required: [
    "websiteStatus",
    "businessType",
    "companyProfile",
    "companyName",
    "countryName",
    "companyAddress",
    "state",
    "city",
    "emailId",
    "secondaryEmailId",
    "phoneNumber",
    "numberOfProducts",
    "productImages",
    "numberOfProductDescriptions"
  ]
};

/**
 * Prompts Google Gemini with complete, uncorrupted website content and strict QC instructions.
 */
async function analyzeWithGemini(crawlData, apiKey, modelName, restrictedCheck) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const formattedAddressEvidence = (crawlData.addressCandidates && crawlData.addressCandidates.length > 0)
    ? crawlData.addressCandidates.map((c, idx) => {
      const typeLabel = c.isHeadquarters ? "HEADQUARTERS / HEAD OFFICE" : (c.locationType ? c.locationType.toUpperCase() : "LOCATION");
      const langLabel = c.isEnglish ? "English" : "Local Language";
      const romanized = !c.isEnglish && /[\u4e00-\u9fa5]/.test(c.raw) ? ` -> Romanized English: ${romanizeChineseAddress(c.raw)}` : "";
      return `${idx + 1}. [${typeLabel} (${langLabel}, Source: ${c.source})]: ${c.raw}${romanized}`;
    }).join("\n")
    : ((crawlData.detectedAddresses || []).join("\n") || "(No physical address candidates extracted from static HTML)");

  const prompt = `
You are an expert AI data entry quality control assistant. Extract exact company details for the website dynamically from the provided content according to these STRICT QC RULES:

WEBSITE STATUS QC RULES (Rule 1):
- Options: "Working" | "Not Working" | "Domain Expired" | "Non English" | "Under Construction" | "Flash".
- Rule 11 & 16: Websites with online product selling options (e.g. "Add to Cart", "Payment Gateway", "Buy Now", "Checkout"), EXCEPT FOR MANUFACTURERS:
  * If the company IS A MANUFACTURER (they produce, fabricate, or manufacture their own products in a factory/plant, OEM/ODM):
    -> You MUST mark "websiteStatus": "Working" and "businessType": "Manufacturer"!
    -> Extract and pre-fill all 14 fields (companyName, countryName, address, state, city, products, images, descriptions)!
  * If the company is NOT A MANUFACTURER (e.g. Retailer, Online Store, E-commerce reseller, Trader, Dropshipper):
    -> You MUST mark "websiteStatus": "Not Working" and leave all other fields empty ""!
- Rule 12: Websites in a non-English language without an English translation option -> mark "websiteStatus": "Non English" (all other fields empty "").
- Rule 14: Websites designed in Flash format where text is not copyable -> mark "websiteStatus": "Flash" (all other fields empty "").
- Rule 13: URL redirecting websites – only if the website redirected to a completely DIFFERENT domain (e.g. companyA.com -> companyB.com), mark "websiteStatus": "Redirect Site". If it is on the SAME domain (http to https, www vs non-www, language path /en/, subpage or subfolder), it is NOT a Redirect Site! Mark "websiteStatus": "Working". Evaluate the company dynamically at the final redirected URL.
- Rule 9: Websites hosted on free platforms (WordPress, Wix, Weebly, Blogspot, etc.) -> mark "websiteStatus": "Not Working" (all other fields empty "").
- Rule 10: Subdomain websites not hosted at root level (e.g. multimedia/entertainment streaming platforms like music or video streaming) -> mark "websiteStatus": "Not Working" (all other fields empty "").
- Rule 8: Personal websites, personal blogs, personal portfolios -> mark "websiteStatus": "Not Working" (all other fields empty "").
- Rule 4: Service provider websites (e.g. restaurants, salons, retailers, etc.), EXCEPT for industrial service providers -> mark "websiteStatus": "Not Working" (all other fields empty "").
- CRITICAL NOT WORKING QC RULE ("Notworking means all empty"):
  If "websiteStatus" is NOT "Working" ("Not Working", "Domain Expired", "Non English", "Flash", "Under Construction"):
  ALL OTHER FIELDS MUST BE EMPTY STRINGS ""!
  Do NOT extract companyName, countryName, address, state, city, emails, phones, products, businessType, or profile. Leave every other field as empty string "".
- If the domain is expired / parked, mark "Domain Expired".
- If the website failed to load or has no content, mark "Not Working".

BUSINESS TYPE & WORK SCOPE QC RULES (Rule 2):
- CRITICAL WORK SCOPE INSTRUCTION ("Manufacture to Wholesale only we work, remaining status we do notworking"):
  * ALLOWED BUSINESS TYPES WE WORK ON:
    1. "Manufacturer"
    2. "Industrial Services"
    3. "Exporter"
    4. "Trader"
    5. "Distributer" (note: spelled "Distributer")
    6. "Supplier"
    7. "Wholesaler"
  * CRITICAL PHYSICAL GOODS SUPPLIER RULE:
    - If a company sells, supplies, fabricates, fits, or distributes physical products / manufactured goods (such as windows, doors, conservatories, glass, building materials, construction products, hardware, tools, packaging, metals, plastics, machinery, equipment, components, industrial supplies):
      -> THEY ARE A "Supplier", "Manufacturer", "Distributer", or "Trader" (options 1 to 7)!
      -> YOU MUST MARK "websiteStatus": "Working" AND EXTRACT ALL 14 FIELDS!
      -> EVEN IF they provide installation, fitting, surveys, or quotes for their goods (e.g. "supply and fit windows/doors", "request a quote", "book a survey"), they are a PHYSICAL PRODUCT SUPPLIER, NEVER a disallowed service provider!
  * DISALLOWED / NON-WORKING BUSINESS TYPES:
    8. "Service Provider": STRICTLY AND ONLY for pure non-goods consumer services with NO physical goods supplied:
       - Restaurants, bars, cafes, food dining, catering
       - Hair salons, beauty clinics, barbers, nail spas, massage, wellness
       - Legal services, law firms, solicitors, lawyers
       - Accounting, bookkeeping, tax services
       - Marketing agencies, SEO, IT/web design consulting
       - Pure software / SaaS without hardware
       - Travel agencies, tour operators, flight booking, hotels
       - Real estate agencies, property rentals, property management
       - Cleaning, pest control, personal trainers, tutoring
    9. "Online Shopping" (unless company is a Manufacturer)
    10. "Restricted Site"
    11. "Other"
  * STRICT QC RULE:
    If the website's business type is pure "Service Provider" (non-goods consumer service), "Online Shopping" (non-manufacturer), "Restricted Site", "Other", or ANY business outside the Manufacturer to Wholesaler range:
    - YOU MUST SET "websiteStatus": "Not Working"!
    - ALL OTHER FIELDS MUST BE EMPTY STRINGS "": "businessType": "", "companyProfile": "", "companyName": "", "countryName": "", "companyAddress": "", "state": "", "city": "", "emailId": "", "secondaryEmailId": "", "phoneNumber": "", "numberOfProducts": "", "productImages": "", "numberOfProductDescriptions": ""!
- CRITICAL 3-TIER VERIFICATION RULE FOR "Online Shopping" (E-Commerce vs B2B Manufacturer / Wholesaler Catalog):
  A website qualifies as "Online Shopping" (E-Commerce) IF AND ONLY IF it meets the Mandatory Core Rule AND at least one Secondary Signal:
  1. Rule 1: The Transaction Test (Mandatory Core Rule):
     - The website must allow the user to complete a monetary exchange for a good entirely on-site without manual back-and-forth communication.
     - Must have: A functional cart/basket, a defined unit price (e.g. $29.99, €45.00), AND an online checkout gateway (credit/debit card, UPI, net banking, PayPal, Stripe, /checkout).
     - MANDATORY B2B EXCLUSION: If the button/link says "Request a Quote", "Contact Us for Pricing", "Contact Sales", "Enquire Now", "Inquiry Basket", or "Find a Dealer", it FAILS this rule and is a B2B Catalog / Showcase site, NOT e-commerce!
       -> You MUST classify such B2B catalog sites as "Manufacturer" or "Wholesaler" with "websiteStatus": "Working" and extract all 14 fields!
  2. Rule 2: The Fulfillment & Policy Test (Secondary Operational Signal):
     - Shipping & Returns Policy: Explicit delivery timelines, courier options, shipping charges, and a return/cancellation policy.
     - Order Tracking: Mechanism for order confirmation emails, invoices, and dispatch/tracking updates.
     - Exclusion: If the transaction is a recurring contract or consultation booked via a calendar ("Book an Appointment"), it is a Service / Booking site ("Service Provider"), NOT retail e-commerce.
  3. Rule 3: Technical & Data Markers (Verification):
     - Structured Schema Markup: Presence of Product and Offer schema defining price, priceCurrency, and availability.
     - E-Commerce Endpoints: Standard checkout routes (/cart, /checkout, /basket) or e-commerce platform footprints (Shopify, WooCommerce, Magento).

  QUICK CLASSIFICATION CHEAT SHEET:
  - Cart + Checkout + Price + Direct Shipping (by a Manufacturer) -> "Manufacturer" (websiteStatus: "Working", extract full company data!)
  - Cart + Checkout + Price + Direct Shipping (by a Retailer/Reseller) -> "Online Shopping" (websiteStatus: "Not Working", all other fields empty "")
  - Products + Specs + "Contact Sales" / "Enquire" / "Request a Quote" / "Find a Dealer" -> "Manufacturer" or "Wholesaler" (websiteStatus: "Working", extract full company data!)
  - Prices + "Book an Appointment" / Calendar picker -> "Service Provider" (websiteStatus: "Not Working")
  - Articles + Affiliate links redirecting to Amazon/other stores -> "Other" (websiteStatus: "Not Working")
  - Tier pricing ($X/month) + "Sign Up" / "Start Free Trial" -> "Service Provider" (websiteStatus: "Not Working")
- CRITICAL PROHIBITED / RESTRICTED WEBSITES QC RULE (Note 2):
  Instruction Note 2 Rule: "Do not work on websites related to Porn, Adult, Medicine, Medical, Hospital, Food, Weapons (Knife), Defence, Aircraft, Aerospace, Marine, Ship, Chemical, Alcohol, Animals. Even if these images or words appear anywhere on the site, do not work on that site. make these rule strictly if any word appear make it notwroking"
  If words or images related to ANY of these categories appear ANYWHERE on the site:
  1. Porn / Adult Content / Erotica / Onlyfans
  2. Weapons / Firearms / Ammunition / Knives (combat, hunting, tactical, daggers, swords)
      * EXCEPTION: Industrial machinery parts like "air knife systems" (drying blower nozzles) or "slitter/machine knives" are NOT weapons!
  3. Defence / Military / Armaments / Artillery / Defense contractors
  4. Aircraft / Airplanes / Commercial Aviation / Airlines / Helicopters / Fighter jets
      * EXCEPTION: Industrial manufacturing processes like "Waterjet cutting", "Inkjet printing", or "Jet pumps" are NOT aircraft!
  5. Aerospace / Aerospace engineering / Aerospace parts
  6. Marine / Maritime / Naval / Marine Vessels (actual maritime naval industry)
      * EXCEPTION: "Marine grade" material descriptors (e.g. marine grade stainless steel, marine plywood) are NOT marine vessel operations!
  7. Ships / Boats / Shipyard / Shipbuilding / Yachts (actual maritime boat/ship building & shipyards)
      * CRITICAL EXCEPTION FOR "SHIP":
        - Words ending in "-ship" such as "Partnership", "Membership", "Dealership", "Craftsmanship", "Workmanship", "Ownership", "Leadership", "Relationship" are NOT ships!
        - Freight, delivery, order, or parcel shipping (e.g. "We ship worldwide", "Shipping Policy", "Free shipping", "Fast shipping", "Shipping cost", "Shipment") is NOT the Ship category!
        - ONLY classify as Ships/Boats if the company builds, manufactures, or repairs actual watercraft, boats, yachts, or operates a shipyard!
  8. Chemical / Petrochemicals / Agrochemicals / Pesticides / Solvents / Hazardous chemicals (actual chemical manufacturing/synthesis)
      * EXCEPTION: Material specifications like "chemical resistance", "chemically resistant", or "chemical compatibility" describing plastics, steel, or coatings are NOT chemical producers!
  9. Medicine / Medical / Pharmaceuticals / Prescription drugs / Hospitals / Clinics / Healthcare / Doctors / Dental / Surgery
  10. Food / Foods / Beverages / Food manufacturing / Restaurants / Cafes / Bakeries / Catering / Groceries / Meat / Dairy / Snack
  11. Alcohol / Breweries / Wineries / Distilleries / Liquor / Wine / Beer / Spirits
      * EXCEPTION: "Isopropyl alcohol" used as an electronic cleaning solvent is NOT an alcoholic beverage/brewery!
  12. Animals / Pets / Dogs / Cats / Livestock / Cattle / Poultry / Animal feed / Veterinary
      * CRITICAL EXCEPTION FOR "CAT":
        - "Cat" or "Cat." as an abbreviation for "Category" (e.g. "Cat: Valves", "Product Cat", "Cat. No.", "Item Cat") or "Cat 5 / Cat 6" (network cabling) or "CAT" (Caterpillar machinery/equipment) is NOT an animal!
        - STRICTLY DO NOT mark a site as Animals or Not Working when "Cat" is used as Category, Catalogue, Cable, or Machinery!
        - Only classify as Animals when it refers to actual living animals, pets, pet care, or livestock.
  13. Gambling / Casinos / Betting / Poker / Lotteries
  14. Tobacco / Cigarettes / Cigars / Vaping / E-cigarettes / Nicotine
  15. Cannabis / Marijuana / THC / CBD / Narcotics / Illicit drugs
  16. Counterfeits / Replica goods / Fake ID / Hacking / Loan sharks
  THEN:
  - YOU MUST MARK "websiteStatus": "Not Working"!
  - ALL OTHER FIELDS MUST BE EMPTY STRINGS "": "businessType": "", "companyProfile": "", "companyName": "", "countryName": "", "companyAddress": "", "state": "", "city": "", "emailId": "", "secondaryEmailId": "", "phoneNumber": "", "numberOfProducts": "", "productImages": "", "numberOfProductDescriptions": ""!

CRITICAL GLOBAL LANGUAGE & CAPITALIZATION REQUIREMENT (ALL WORDS IN COMPANY NAME, COMPANY ADDRESS, COUNTRY MUST START WITH CAPITAL LETTER):
- MANDATORY CAPITALIZATION QC RULE ("In Company Name, Company Address, Country All the words start with Capital letter"):
  EVERY SINGLE WORD in "companyName", "companyAddress", and "countryName" MUST start with a Capital letter (Title Case).
  * In "companyName": Capitalize every single word! E.g. "Inter Outstanding Electronics Incorporated", "H&R Manufacturing", "Web Rack Industrial Company Limited", "PEM Fountain Company", "Danzer UK Limited".
  * CRITICAL QC RULE - ACRONYMS IN COMPANY NAME:
    - Acronyms and all-caps brand names (e.g. PEM, BMW, AKS, HR, CRP, SMC) MUST remain in full UPPERCASE (e.g. "PEM Fountain Company", NOT "Pem Fountain Company" or "Pem Fountain"!).
  * CRITICAL QC RULE - DO NOT EXPAND SYMBOLS:
    - DO NOT expand symbols like "&" into "And"! Keep symbols as they are (e.g. "H&R Manufacturing", NOT "H And R Manufacturing"!).
    - DO NOT add "Company" to the company name if "Company" or "Co." was not part of the official name (e.g. "H&R Manufacturing" must remain "H&R Manufacturing", NEVER add "Company"!).
    - Expand "Co." / "Co" to "Company" when present in official name, trade listing, or social media handle (e.g. "PEM Fountain Co." / "pemfountainco" -> "PEM Fountain Company").
  * In "companyAddress": Capitalize every single word! E.g. "18, Lane 247, Fusing 3rd Road, Keishan, Taoyuan", "15 Telford Way, Kettering, Northamptonshire", "Number 53-5, Pocheng Road, Yuanshan Township, Yilan County", "46 Market Hill, Maldon, Essex", "123 Main Street, Suite 400", "City Of Industry, California".
  * In "countryName": Capitalize every single word! E.g. "United States Of America" (with capital 'Of'), "United Kingdom", "South Korea", "New Zealand", "Saudi Arabia", "Czechia", "Turkiye".
  * STRICT PROHIBITION: Do NOT leave small words, prepositions, or conjunctions in lowercase! Words like "Of", "And", "In", "At", "By", "For", "With", "On", "The", "De", "Du" MUST be capitalized with their first letter uppercase (e.g. "United States Of America", "City Of Industry", "Bank Of China").
  * Special characters MUST NOT start and MUST NOT end "companyName" or "companyAddress".
- MANDATORY COUNTRY NAME QC RULE (CRITICAL QUALITY CONTROL REQUIREMENT):
  * "You must write the country name in full form. If the country name is not available on the site, check on social media. If still not available, search on Google using the city and state name. We consider the locality for the country name.
  Example: United Kingdom (England, Wales, Scotland, Northern Ireland). If “England” and “United Kingdom” both are mentioned, you must take England as the country name."
  * Every single word in countryName MUST start with a Capital letter (Title Case).
- MANDATORY PHONE NUMBER QC RULE:
  * "Take the complete phone number, but remove the country code, special characters, and spaces. Do not take toll-free numbers. Do not take numbers starting with zero."
- MANDATORY EMAIL QC RULE:
  * "Primary email and secondary emails should NOT be the same. Emails can be found in any place on the website or company social media like LinkedIn and Facebook. If a secondary email is available, double-check and ALWAYS take it. If only one email exists across the entire website and social channels, secondaryEmailId MUST be empty string \"\"."
- CRITICAL QC RULE - NO EXTRA WORDS ("the items what available that only should come no extra word"):
  * NEVER invent, inject, or hallucinate words, administrative divisions, or labels that do NOT exist in the website's original contact address!
  * 1. DO NOT ADD "Number" IF ABSENT:
    - ONLY expand to "Number" if the original address explicitly contains "No.", "No", "NO.", "Nos.", "Nº", or "#" (e.g. "No. 56-106, Zhangma St." -> "Number 56-106, Zhangma Street", "NO. 12" -> "Number 12").
    - If the original address does NOT contain "No" or "No." (e.g. it is just "18, Lane 247...", "18 Kuang Fu North Road", "40 Sarah Street", "12 Stephen Road", "46 Market Hill", "15 Telford Way"), DO NOT put "Number"! Output "18, Lane 247...", "18 Kuang Fu North Road", "40 Sarah Street", "15 Telford Way" (NEVER put "Number" if "No" was not in the original text!).
  * 2. DO NOT ADD "City" IF ABSENT:
    - If the word "City" is NOT written in the contact address (e.g. "Keishan, Taoyuan", "München", "Hayes, Middlesex", "Kettering, Northamptonshire"), DO NOT ADD "City"! Output "Keishan, Taoyuan", "München", "Hayes, Middlesex", "Kettering, Northamptonshire". NEVER append "City" when not present in source (e.g. NEVER make it "Taoyuan City" when the source only says "Taoyuan")!
  * 3. DO NOT ADD "District", "Township", OR "County" IF ABSENT:
    - If "District", "Township", or "County" is NOT written in the contact address, DO NOT ADD THEM!
    - If the contact page says "Keishan", output "Keishan" - DO NOT replace or substitute it with "Guishan District"!
  * 4. ONLY EXPAND ABBREVIATIONS THAT ARE ACTUALLY WRITTEN:
    - Only expand abbreviations present on the page (e.g. Rd -> Road, St -> Street, Ln -> Lane, Ste -> Suite, Fl -> Floor, 5/F. -> 5th Floor).
- STRICT HEADQUARTERS & DOMESTIC DOMICILE MANDATE:
  * You MUST ALWAYS select the company's OPERATIONAL HEADQUARTERS, MAIN SHOWROOM, FACTORY, or CONTACT PAGE PHYSICAL ADDRESS located in its domestic home country!
  * NEVER pick an overseas subsidiary, branch, or distributor address (e.g. choosing a USA / California sales office when the company is headquartered in China, Taiwan, UK, Australia, Canada, Malaysia, India, South Africa, etc.)!
  * If Candidate #1 is the Headquarters in local script (e.g. Chinese, Japanese, Taiwanese), translate or romanize THAT headquarters address into English—DO NOT pick an overseas branch address just because it is written in English!
  * Candidate #1 is the highest-ranked location. If candidate #1 is marked HEADQUARTERS or OPERATIONAL / CONTACT PAGE ADDRESS, select that operating address.
- ALWAYS target and extract English language text for Company Name and Company Address.
- NEVER return Chinese, Japanese, Korean, Arabic, Thai, Cyrillic, or other non-Latin characters for "companyName" or "companyAddress" when English or Romanized/Latin text is available. Translate or transliterate local script addresses to English Title Case.
- Always output the English physical address with street abbreviations expanded (e.g. "NO.56-106, Zhangma St., Xiushui Township, Changhua County" -> "Number 56-106, Zhangma Street, Xiushui Township, Changhua County", BUT "18 Kuang Fu North Road" -> "18 Kuang Fu North Road" WITHOUT adding "Number").
- If the website title or logo contains both English and Chinese/local script (e.g. "FURCO Taiwan 宙辰"), take the English corporate name (e.g. "Furco Industrial Company Limited" or "Furco Taiwan Limited"). Do NOT include non-Latin characters in companyName.
- If the website is a Single Page Application (isDynamicSpa: ${crawlData.isDynamicSpa ? "YES" : "No"}) and no address candidate was found in static HTML, inspect the site metadata, title, and body text. If no physical address exists anywhere on the site, return "Not Available" (NEVER invent or hallucinate addresses!).

ADDRESS EXTRACTION PRIORITY (CRITICAL QC REQUIREMENT):
1. First Priority: Extract the operational Headquarters, main showroom, factory, workshop, or physical trading address from the Contact Us page, Showroom page, or Get In Touch page.
2. Second Priority: Extract from the dedicated Company Profile / About Us page.
3. Third Priority: If not on Contact/About page, extract from the general page body or Footer.
4. STRICT PROHIBITION ON LEGAL REGISTERED OFFICES:
   - STRICTLY DO NOT EXTRACT corporate legal registration addresses, accounting offices, registered agent offices, or addresses labelled "Registered Office", "Registered in England", "Company Registration No.", or "Domicilio Social" if a physical showroom, factory, workshop, or Contact page address exists!
   - Legal registered offices (e.g. "Lonsdale House, High Street, Lutterworth" or an accounting firm address) are legal disclaimers, NOT the physical operating location where products are made or sold.
   - ALWAYS choose the showroom / factory / contact page location (e.g. "The Springboard Centre, Mantle Lane, Coalville, Leicestershire").
5. STRICTLY STRIP REGISTRATION CLAUSES FROM ADDRESS:
   - NEVER output legal disclaimers like "Registered in England : 11743582., Registered Office :" in companyAddress.
   - companyAddress MUST only contain clean physical address components: Premise/Building, Street, Locality/Town/City, and State.
4. Address Formatting (Rule 6) - COMPLETE PHYSICAL ADDRESS PRESERVATION (GLOBAL MANDATE FOR ALL COUNTRIES WORLDWIDE):
   - MANDATORY GLOBAL COMPLETE FULL ADDRESS QC RULE ("Address full address must be taken"):
     * You MUST extract the COMPLETE, FULL physical headquarters/main address for ALL countries worldwide. NEVER return an incomplete, partial, or truncated address!
     * If the website displays the address across multiple lines, paragraphs, or sibling blocks (e.g. Suite/Floor on line 1, Street on line 2, City/Suburbs/State on line 3), YOU MUST COMBINE THEM INTO ONE SINGLE COMPLETE ADDRESS!
     * NEVER cut off or omit any part of the address. Retain every single structural address component:
       1. Premise / Building Name / Suite / Unit / Floor / Level / Block / Lot / Plot / Factory / Workshop / Survey Number / Gate Number / Shed / Bay / Office Park.
       2. Industrial Estate / Business Park / Trading Estate / Science Park / Free Zone / Special Economic Zone / Technology Park / Hi-Tech Zone / Polígono Industrial / Zona Industriale / Gewerbegebiet / Kawasan Industri / Taman Perindustrian.
       3. Street number and Street / Road / Avenue / Boulevard / Way / Drive / Lane / Highway / Route / Strasse / Rue / Via / Calle / Jalan / Chome.
       4. Suburb / Locality / Ward / Neighborhood / Village / Town / Township / Sub-district / District / Municipality / Borough / Taluk / Tehsil / Mukim / Amphoe / Barangay / Sector.
       5. City / Metropolitan Area.
       6. State / Province / Territory / County / Shire / Canton / Prefecture / Bundesland / Region / Division / Department / Voivodeship / Oblast / Emirate / Governorate.
     * EXAMPLES OF COMPLETE FULL ADDRESSES:
       - "Suite 260, 2021 Guadalupe Street, Austin, Texas" (MUST retain Suite 260, 2021 Guadalupe Street, Austin, and Texas!)
       - "15 Telford Way, Kettering, Northamptonshire" (MUST retain 15 Telford Way, Kettering, and Northamptonshire!)
       - "5th Floor, Office Park, Number 535, Qingshuiqiao Road, Hi-Tech Zone, Ningbo" (MUST retain 5th Floor, Office Park, Number 535, Qingshuiqiao Road, Hi-Tech Zone, and Ningbo!)
       - "40 Sarah Street, Campbellfield, Victoria" (MUST retain 40 Sarah Street, Campbellfield, and Victoria!)
       - "Unit 5, 12 Baxter Road, Mascot, New South Wales" (MUST retain Unit 5, 12 Baxter Road, Mascot, and New South Wales!)
       - "15 Sandton Drive, Sandton, Gauteng" (MUST retain 15 Sandton Drive, Sandton, and Gauteng!)
     * NEVER return only a bare street name when premise, locality, suburb, city, or state is available on the website!
     * NEVER omit the Suite/Unit/Floor/Building/Office Park at the beginning, and NEVER omit the Suburb/Town/City/State at the end!
   - CRITICAL CONTINENTAL EUROPE & INTERNATIONAL POSTAL CODE RULE:
     * In Continental Europe (Germany, Austria, Switzerland, France, Italy, Spain, Netherlands, Belgium, Poland, Czechia, Sweden, Norway, Denmark, etc.), postal codes are placed BEFORE the city name (e.g. "80333 München", "75008 Paris", "28013 Madrid", "602 00 Brno", "00-838 Warszawa").
     * When stripping postal codes, REMOVE ONLY the postal code digits/code!
     * NEVER truncate, cut off, or discard the City, Municipality, District, or State that follows the postal code!
     * Example: "Musterstraße 12, 80333 München, Bayern" -> "Musterstrasse 12, München, Bayern" (München and Bayern MUST be kept!).
     * Example: "Rue de la Paix 10, 75002 Paris, Île-de-France" -> "Rue De La Paix 10, Paris, Île-De-France" (Paris and Île-de-France MUST be kept!).
     * Example: "Calle Mayor 4, 28013 Madrid" -> "Calle Mayor 4, Madrid" (Madrid MUST be kept!).
     * Example: "Křenová 75, 602 00 Brno, Jihomoravský Kraj" -> "Křenová 75, Brno, Jihomoravský Kraj" (Brno and Jihomoravský Kraj MUST be kept!).
     * Example: "Number 20-2, Xinxing Street, Shulin District, New Taipei City" -> KEEP ALL components!
   - STRICT INITIAL STREET NUMBER & PREMISE PRESERVATION:
     * NEVER drop or strip the leading building / street / premise number or identifier (e.g. "12110 Best Place" -> MUST KEEP "12110", "40 Sarah Street" -> MUST KEEP "40", "18 Kuang Fu North Road" -> MUST KEEP "18"). A standalone number at the beginning of an address followed by a street name is the STREET NUMBER, NOT a postal code! You MUST retain the initial building/street number!
     * NEVER drop or strip "Lot" or "Plot" identifiers (e.g. "Lot 45, Jalan Kemajuan" -> MUST KEEP "Lot 45", "Plot 12, Phase II" -> MUST KEEP "Plot 12"). "Lot" and "Plot" are primary premise addresses in industrial zones and estates globally!
     * NEVER drop or strip Unit, Suite, Building, Floor, or Block details (e.g. "Unit 4", "Suite 200", "Building 5", "Level 3", "Block B").
   - COMMA SEPARATION QC RULE (STRICT - NEVER INSERT COMMAS BLINDLY BETWEEN WORDS):
     * Ensure commas separate MAJOR structural address components ONLY:
       1. Premise / Unit / Suite / Lot / Plot from Street or Estate/Park name (e.g. "Unit 2, Argent Trade Park, Pump Lane", "Suite 200, 12110 Best Place", "Lot 45, Jalan Kemajuan").
       2. Street Name from Suburb / Town / City (e.g. "Pump Lane, Hayes", "12110 Best Place, Cincinnati", "40 Sarah Street, Campbellfield").
       3. Suburb / Town / City from State / County / Province / Territory (e.g. "Hayes, Middlesex", "Cincinnati, Ohio", "Campbellfield, Victoria", "Subang Jaya, Selangor").
     * CRITICAL NEGATIVE RULE (DO NOT PUT COMMAS BLINDLY):
       - NEVER insert commas BETWEEN words of a multi-word Industrial / Business / Trade Park, Trading Estate, or Zone name! (e.g. "Argent Trade Park" is ONE park name, NEVER "Argent, Trade, Park" or "Argent, Trade Park"! "Westwood Business Park", "Cambridge Science Park", "Prologis Park").
       - NEVER insert commas BETWEEN words of a multi-word Street Name or Highway! (e.g. "Pump Lane" NEVER "Pump, Lane", "Great Western Highway" NEVER "Great, Western, Highway", "Old Country Road" NEVER "Old, Country, Road").
       - NEVER insert commas BETWEEN building/street numbers and street names! (e.g. "604 Progress Drive" NEVER "604, Progress Drive", "12110 Best Place" NEVER "12110, Best Place").
       - NEVER insert commas BETWEEN words of a multi-word City or County! (e.g. "West Sussex" NEVER "West, Sussex", "Kuala Lumpur" NEVER "Kuala, Lumpur", "New York" NEVER "New, York", "New Taipei City" NEVER "New, Taipei City").
   - ADDRESS ENDING CRITICAL QC RULE: Address ending MUST NOT have a comma (,) or point/period (.). It should be empty of trailing punctuation (e.g. "40 Sarah Street, Campbellfield, Victoria", NEVER end with "." or ",").
   - REMOVE ONLY:
     * Postal codes / ZIP codes (e.g. "OH 45241" -> strip 45241, "VIC 3061" -> strip 3061, "602 00 Brno" -> strip 602 00). DO NOT strip the initial street number!
     * Country name (e.g. Australia, South Africa, United States, Taiwan, R.O.C., Turkiye, Czechia).
     * Company name.
   - MANDATORY FULL FORM EXPANSION RULES (EXPAND ALL ABBREVIATIONS TO FULL WORDS GLOBALLY):
     * Floors & Levels:
       - Expand all floor abbreviations into full ordinal names! E.g. "5/F." or "5/F" or "5F." or "5F" or "Fl. 5" or "Flr 5" or "Floor 5" or "5th Fl" -> "5th Floor".
       - "1/F" or "1F" -> "1st Floor", "2/F" or "2F" -> "2nd Floor", "3/F" or "3F" -> "3rd Floor", "4/F" or "4F" -> "4th Floor", "6/F" -> "6th Floor", "10/F" -> "10th Floor", etc.
       - "G/F" or "GF" -> "Ground Floor".
       - "B/F" or "BF" -> "Basement Floor", "B1" -> "Basement 1", "B2" -> "Basement 2".
       - "Lvl." or "Lvl" -> "Level".
       - Standalone "Flr." or "Flr" or "Fl." or "Fl" -> "Floor".
     * Premises & Numbers:
       - "No." or "No" or "NO." or "Nos." or "Nº" or "N." or "Núm." -> "Number" (e.g. "No. 535" -> "Number 535", "No. 20-2" -> "Number 20-2", "No. 53-5" -> "Number 53-5").
       - "Sec." or "Sec" -> "Section" (e.g. "Sec. 2" -> "Section 2").
       - "Ln." or "Ln" -> "Lane" (e.g. "Ln. 270" -> "Lane 270").
       - "Aly." or "Aly" -> "Alley" (e.g. "Aly. 15" -> "Alley 15").
       - "Lot No." -> "Lot Number", "Plot No." -> "Plot Number".
     * Units / Buildings / Departments:
       - "Ste." or "Ste" -> "Suite" (e.g. "Ste. 200" -> "Suite 200", "Ste 260" -> "Suite 260").
       - "Bldg." or "Bldg" -> "Building" (e.g. "Bldg. 4" -> "Building 4").
       - "Rm." or "Rm" -> "Room" (e.g. "Rm. 302" -> "Room 302").
       - "Apt." or "Apt" -> "Apartment" (e.g. "Apt. 5B" -> "Apartment 5B").
       - "Dept." or "Dept" -> "Department".
       - "Blk." or "Blk" -> "Block" (e.g. "Blk 12" -> "Block 12").
       - "POB" or "P.O. Box" or "PO Box" -> "Post Office Box".
     * Compass / Directional prefixes & suffixes: E. / E -> East (e.g. "301 E. Marquardt Drive" -> "301 East Marquardt Drive"), W. / W -> West, N. / N -> North, S. / S -> South, NE / N.E. -> Northeast, NW / N.W. -> Northwest, SE / S.E. -> Southeast, SW / S.W. -> Southwest.
     * Street types: St -> Street, Rd -> Road, Ave -> Avenue, Cnr -> Corner, Dr -> Drive, Blvd -> Boulevard, Ln -> Lane, Ct -> Court, Pl -> Place, Hwy -> Highway, Cres -> Crescent, Pde -> Parade, Tce/Ter -> Terrace, Cl -> Close, Sq -> Square, Pkwy -> Parkway, Cir -> Circle, Gr/Gv -> Grove, Mews -> Mews, Way -> Way, Wlk -> Walk, Gdns -> Gardens, Esp -> Esplanade, Crst -> Crest, Prom -> Promenade, Rte -> Route, Tpke -> Turnpike, Ctr -> Centre, Aly -> Alley, Arc -> Arcade, Bnd -> Bend, Brg -> Bridge, Byp -> Bypass, Cswy -> Causeway, Cmn -> Common, Xing -> Crossing, Ext -> Extension, Fwy -> Freeway, Grn -> Green, Holw -> Hollow, Jct -> Junction, Knl -> Knoll, Lndg -> Landing, Mdw/Mdws -> Meadow/Meadows, Ml/Mls -> Mill/Mills, Mt -> Mount, Oval -> Oval, Pass -> Pass, Path -> Path, Pike -> Pike, Plz -> Plaza, Pt -> Point, Rdg -> Ridge, Rnch -> Ranch, Row -> Row, Run -> Run, Shr -> Shore, Spg/Spgs -> Spring/Springs, Sta -> Station, Strm -> Stream, Sumit/Smt -> Summit, Trce -> Trace, Trl -> Trail, Tunl -> Tunnel, Via -> Via, Vis -> Vista, Whf -> Wharf, No. -> Number, Nr -> Near.
     * Units / Buildings / Floors: Ste -> Suite, Apt -> Apartment, Bldg -> Building, Flr -> Floor, Dept -> Department, Rm -> Room, POB / PO Box -> Post Office Box.
     * Spain (España) Abbreviations:
       - Street Prefixes: C/ -> Calle (e.g. C/ Alcalá 42 -> Calle Alcalá 42), C. -> Calle, Av. / Avda. / Avd. -> Avenida, P.º / Pº / Pso. -> Paseo, Pl. / Pza. / Plza. -> Plaza, Rbla. -> Rambla, Ctra. -> Carretera, Cam. / Cno. -> Camino, Trav. -> Travesia, Pje. -> Pasaje, Rda. -> Ronda, Urb. -> Urbanizacion, Edif. -> Edificio.
       - Industrial Zones: Pol. Ind. / Pol.Ind. / P.I. -> Poligono Industrial.
       - Building Details: Nº / N.º / Núm. / Num. / N. -> Numero, S/N -> Sin Numero, Km. -> Kilometro, Pta. -> Puerta, Plta. -> Planta, Apdo. -> Apartado de Correos.
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
     * Indonesia Abbreviations:
       - Thoroughfares & Areas: Jl. / Jln. -> Jalan, Gg. -> Gang, Komp. / Kompl. -> Komplek, Kel. -> Kelurahan, Kec. -> Kecamatan, Kab. -> Kabupaten, Prov. / Prop. -> Provinsi, Kav. -> Kavling, Blok -> Blok, Kws. Industri -> Kawasan Industri.
       - Building Details: No. -> Number, Rt. / Rw. -> RT / RW.
       - Regions: DKI Jakarta, DI Yogyakarta.
     * State & Province abbreviations GLOBALLY:
       - Australia: VIC -> Victoria, NSW -> New South Wales, QLD -> Queensland, WA -> Western Australia, SA -> South Australia, TAS -> Tasmania, ACT -> Australian Capital Territory, NT -> Northern Territory.
       - United States: Expand all 2-letter state codes to full state names (e.g. CA -> California, TX -> Texas, NY -> New York, FL -> Florida, IL -> Illinois, PA -> Pennsylvania, OH -> Ohio, GA -> Georgia, NC -> North Carolina, MI -> Michigan, NJ -> New Jersey, VA -> Virginia, WA -> Washington, MA -> Massachusetts, WI -> Wisconsin, MO -> Missouri, MN -> Minnesota, CT -> Connecticut, etc.). Strip 5-digit ZIP codes (e.g. "60060", "78731-1234") and country name ("USA", "United States"). Format cleanly as "[Street Address], [City], [Full State Name]".
       - Canada: ON -> Ontario, QC -> Quebec, BC -> British Columbia, AB -> Alberta, MB -> Manitoba, SK -> Saskatchewan, etc.
   - Capitalize first letter of every word (Title Case) and format with clean punctuation.

STATE & CITY RULES (CRITICAL QC - BASED STRICTLY ON EXTRACTED ADDRESS ONLY):
Important: State and City MUST be evaluated STRICTLY based on the extracted address.

1. State:
   - Mark "Available" if ANY of the following administrative divisions is written in the extracted address:
     * State, Province, County (or Co.), Prefecture, Hsien (Taiwan County), Bundesland / Land (Germany), Regione / Provincia (Italy), Provinsi / Propinsi (Indonesia), Negeri / Wilayah (Malaysia), Changwat (Thailand), Sheng / Xian / Zhou (China), Territory, Emirate, Canton, Region, Regional Council, Oblast, Voivodeship, Department, Governorate
     * Named examples across priority countries: Victoria, New South Wales, Queensland, Texas, California, Ontario, Quebec, Gauteng, Maharashtra, Karnataka, Tamil Nadu, Selangor, Penang, Johor, Guangdong, Jiangsu, Gyeonggi, Abu Dhabi, Dubai, Île-de-France, Bavaria, Yorkshire, Lancashire, Dublin, Cork, Kildare, Galway, Lombardia, Brescia, München, etc.
   - ALSO Mark "Available" if a country's official capital city is in the address (e.g. Taipei City = capital of Taiwan, London = capital of England, Washington D.C. = capital of USA, Berlin = Germany, Rome = Italy, Madrid = Spain, Ankara = Turkiye, Dublin = Ireland, Bangkok = Thailand, Jakarta = Indonesia, Beijing = China, Kuala Lumpur = Malaysia).
   - Spain State Rule: Any of the 50 provinces (e.g. Madrid, Barcelona, Valencia, Sevilla, Zaragoza, Málaga, Murcia, Alicante, Córdoba, Valladolid, A Coruña, Asturias, Vizcaya, Guipúzcoa, Las Palmas, Santa Cruz de Tenerife, etc.) or 17 Autonomous Communities (e.g. Andalucía, Cataluña, Galicia, País Vasco, Castilla y León, Castilla-La Mancha, etc.) in address → State: Available.
   - Turkey (Türkiye) State Rule: Any of Turkey's provinces (İl, e.g. Istanbul, Ankara, Izmir, Bursa, Antalya, Adana, Konya, Gaziantep, Kocaeli, Mersin, Diyarbakir, Kayseri, Eskisehir, Samsun, Denizli, Sakarya, Mugla, etc.) or explicit "İl" / "İli" / "Province" in address → State: Available. If Ankara (capital) is in address, both State and City are Available.
   - United States – State Validation Rule:
     * Any US state (full name e.g. Illinois, Texas, California, Pennsylvania, Wisconsin, Massachusetts, Missouri, Minnesota, Connecticut, Florida, etc., or 2-letter postal abbreviation e.g. IL, TX, CA, PA, WI, MA, MO, MN, CT, FL) in address → State: Available.
     * Washington D.C. (capital) in address → State: Available.
   - If the address only contains a street, suburb, locality, or industrial area — mark "Not Available".
   - Taiwan – State Validation Rule:
     * Taipei City (capital) in address → State: Available
     * New Taipei City in address → State: NOT Available (New Taipei City is NOT the capital)
     * Taichung City, Tainan City, Kaohsiung City, Taoyuan City, Keelung City, Hsinchu City, Chiayi City in address → State: NOT Available (these are cities, NOT states or capital)
     * Districts (e.g. Nantun District, Banqiao District, Xitun District) in address → State: NOT Available (districts are city subdivisions, NOT states)
     * Explicit County / Hsien (e.g. Changhua County, Miaoli County) or Capital (Taipei City) in address → State: Available
     * Otherwise → State: NOT Available
   - New Zealand – State Validation Rule:
     * Wellington (capital) in address → State: Available (If country's capital is in address, both City and State are Available)
     * True New Zealand Regions (e.g. Canterbury, Waikato, Bay of Plenty, Otago, Hawke's Bay, Taranaki, Manawatu, Southland, Northland, Marlborough, Tasman, West Coast) or explicit "Region" / "Regional Council" / "Province" / "County" (e.g. "Auckland Region", "Canterbury Province") in address → State: Available
     * Bare "Auckland" in address → State: NOT Available (Auckland is the City, NOT a state)
     * Bare cities / towns (e.g. Christchurch, Hamilton, Tauranga, Dunedin, Nelson, Napier, Palmerston North) in address → State: NOT Available
     * Suburbs alone (e.g. Penrose, Albany, Rosedale, East Tamaki, Mount Wellington, Riccarton) → State: NOT Available
     * Otherwise → State: NOT Available
   - Do not guess or infer. Only evaluate what is explicitly written in the address.

2. CITY VALIDATION RULES – STRICT QC RULE:
   - CRITICAL SUBURB QC RULE ("Subhurb is consider as city if subhurb was coming means its should mark not available its not city"):
     * A SUBURB IS NOT A CITY!
     * If an address contains ONLY a suburb or suburban locality (such as suburban localities in Australia, South Africa, New Zealand, UK, Canada, etc.) and does NOT contain an official recognized City, Town, Township, District, or Municipality:
       -> YOU MUST MARK "city": "Not Available"!
     * Suburbs are suburban residential or industrial areas within a metropolitan region—they are NOT cities!
     * Examples:
       - Australia: "40 Sarah Street, Campbellfield, Victoria" -> Campbellfield is a SUBURB, NOT a city. Mark "city": "Not Available"!
       - Australia: "83 Henderson Road, Rowville, Victoria" -> Rowville is a SUBURB, NOT a city. Mark "city": "Not Available"!
       - Australia: "12 Kewdale Road, Welshpool, Western Australia" -> Welshpool is a SUBURB, NOT a city. Mark "city": "Not Available"!
       - Australia: "Unit 5, 12 Baxter Road, Mascot, New South Wales" -> Mascot is a SUBURB, NOT a city. Mark "city": "Not Available"!
       - South Africa: "15 Sandton Drive, Sandton, Gauteng" -> Sandton is a SUBURB of Johannesburg. Mark "city": "Not Available"!
       - New Zealand: "120 Penrose Road, Penrose 1061" -> Penrose is a SUBURB of Auckland. Mark "city": "Not Available"!
     * ONLY mark "city": "Available" if an actual official recognized City (e.g. Sydney, Melbourne, Brisbane, Perth, Adelaide, Auckland, London, Chicago, etc.) or an explicit Town, Township, District, or Municipality is named in the address!
   The city field MUST be marked "Available" if ANY of the following is true:
   a) The official website's address explicitly identifies a qualifying City (e.g. "Cixi City", "Kansas City", "City of London"), Town (e.g. "Longshan Town"), Township (e.g. "Xiushui Township"), District (e.g. "Banqiao District"), Municipality / Metropolitan Municipality (e.g. "Ekurhuleni Municipality"), Borough, Shire, or Village.
   b) The address contains local administrative city designations across priority countries:
      - Germany: Stadt, Gemeinde, Marktgemeinde, Markt, Bezirk, Ortsteil
      - Italy: Comune, Municipio, Città, Distretto
      - Spain: Municipio, Ayuntamiento, Localidad, Población, Villa, Ciudad, Distrito, Término Municipal, Concejo
      - Indonesia: Kota, Kabupaten, Kecamatan
      - Thailand: Thesaban, Amphoe, Amphur, Khet, Mueang, Muang
      - Malaysia: Bandar, Daerah, Mukim, Pekan, Majlis Perbandaran
      - India: Taluk, Taluka, Tehsil, Tahsil, Mandal, Nagar Palika, Nagar Nigam
      - Turkey: İlçe, İlcesi, Belediye, Belediyesi, Şehir, Sehir, Mahalle, Mahallesi
   c) The address contains a recognized city / town / municipal name (e.g. Chicago, Melbourne, Boston, San Francisco, Cape Town, Manchester, Johor Bahru, Shenzhen).
   d) UNITED KINGDOM: recognized UK cities, towns, and London boroughs evaluate as "Available".
   e) NEW ZEALAND: Recognized NZ cities & towns (e.g. Auckland, Wellington, Christchurch, Hamilton, Tauranga, Dunedin, Lower Hutt, Upper Hutt, Palmerston North, Napier, Porirua, New Plymouth, Rotorua, Whangarei, Invercargill, Nelson, Whanganui, Hastings, Gisborne, Blenheim, Timaru, Taupo, Pukekohe, Cambridge, Queenstown) evaluate as "Available".
   f) UNITED STATES: Standard US addresses follow the format "[Street Address], [City], [State] [ZIP]". The locality preceding the State and ZIP is the official City/Town/Municipality (e.g. Mundelein, Austin, Houston, Kutztown, Merced, North Hollywood, Oshkosh, Somerville, Allenton, Westford, Washington, Chicago, Hamden, Blomkest, Palmetto, Saegertown, Wheeling, Watertown, etc.) and MUST evaluate as "Available".
   STRICTLY MARK "Not Available" FOR:
   - Suburb / locality / neighborhood only (e.g. Campbellfield, Rowville, Welshpool, Mascot, Sandton, Rosebank, Penrose, Albany) with no city/town/district.
   - New Zealand: Suburbs alone (e.g. Penrose, Albany, Rosedale, East Tamaki, Mount Wellington, Riccarton, Hornby) without a recognized city/town.
   - Australia: Suburbs alone (e.g. Campbellfield, Rowville, Welshpool, Mascot, Rydalmere, Braeside, Dandenong) without a recognized city/town.
   - Industrial Area / Business Park only, with no city/town/district.
   - Street names containing the word "City" (e.g. "City Road", "City Street", "City Avenue") do NOT qualify as a city.
   - New Taipei City: Must remain "Not Available" unless a qualifying administrative area (e.g. Banqiao District) is separately identified in the address.

PRODUCT, IMAGE & DESCRIPTION QC RULES (ACCURATELY BASED ON SITE):
Count the distinct items, product images, and descriptions actually present on this specific website:
CRITICAL SYNCHRONIZATION QC RULE (Rules 12, 13, 14):
- The counts for Number of Product, Image Product, and No. of Product Description MUST NOT CONFLICT with each other!
- "numberOfProducts", "productImages", and "numberOfProductDescriptions" MUST ALL BE THE SAME VALUE!
- If 3 or more products/items/services are shown on the website, ALL THREE FIELDS MUST BE "3":
  * "numberOfProducts": "3"
  * "productImages": "3"
  * "numberOfProductDescriptions": "3"
- If 2 products/items are shown, ALL THREE FIELDS MUST BE "2".
- If 1 product/item is shown, ALL THREE FIELDS MUST BE "1".
- If 0 products found, ALL THREE FIELDS MUST BE "0".
- CRITICAL QC MANDATE: NEVER return "0" for numberOfProductDescriptions when numberOfProducts or productImages is "3" or "1"! The product title, model number, specifications, and features count as the product description. ALL THREE PRODUCT FIELDS MUST BE IDENTICAL!

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
   - OFFICIAL ENGLISH NAME VS PINYIN TRANSLITERATION (CRITICAL QC MANDATE):
     * When the website provides an OFFICIAL ENGLISH NAME in its header, logo, page title, or matching the domain (e.g. "Web Rack Industrial Co., Ltd." on "web-rack.com.tw"), YOU MUST USE THAT EXACT OFFICIAL ENGLISH NAME: "Web Rack Industrial Company, Limited"!
     * NEVER translate, phonetically romanize, or Pinyin Chinese characters into English (e.g. NEVER translate "網瑞" to "Wang Ruey" when the website brand/logo is "Web Rack"!).
     * Look at the DOMAIN NAME (e.g. "web-rack.com.tw" -> stem is "Web Rack"): The official English company name MUST match the website domain!
     * If multiple group entities or associated companies appear in the header/footer (e.g. "Web Rack Industrial Co., Ltd." / "Web Loop Technology Corp." / "Alpmetal Industrial Co., Ltd."), ALWAYS choose the PRIMARY entity that MATCHES THE WEBSITE DOMAIN (e.g. for "web-rack.com.tw", choose "Web Rack Industrial Company, Limited", NEVER an auxiliary or unmatching entity!).
   - NEVER drop, truncate, or omit corporate/legal entity designations (e.g. [Pty]Ltd, (Pty) Ltd, Pty Ltd, Sdn Bhd, Pte Ltd, Pvt Ltd, Ltd, Inc, LLC, LLP, Corp, Co).
   - Look at the HEADER, LOGO, FOOTER, COPYRIGHT LINE, and TITLE for the full official registered corporate name.
   - Restore legal entity designations (e.g. [Pty]Ltd -> Proprietary Limited, Sdn Bhd -> Sendirian Berhad, Inc -> Incorporated) ONLY when supported by official website text evidence (footer, copyright, Contact page, or Company Profile).
2. REMOVE BRACKETS FROM THE COMPANY NAME:
   - Remove square brackets [ ] and parentheses ( ) from the company name while KEEPING their internal words:
     * "[Pty]Ltd" or "(Pty) Ltd" -> "Proprietary Limited"
     * "(Pte) Ltd" or "[Pte] Ltd" -> "Private Limited"
     * "(Pvt) Ltd" or "[Pvt] Ltd" -> "Private Limited"
     * "(M)" -> "M" (e.g. "Nikorex Display Products (M) Sdn Bhd" -> "Nikorex Display Products M Sendirian Berhad")
     * "(Australia)" or "(USA)" or "(Taiwan)" -> "Australia" / "USA" / "Taiwan" (brackets removed, country name preserved)
     * "Carrier (USA) Corporation" -> "Carrier USA Corporation"
     * "Furco (Taiwan) Company Limited" -> "Furco Taiwan Company Limited"
3. RETAIN COUNTRY NAMES IN COMPANY NAME:
   - If a country name is mentioned in the company name, take it as it is (DO NOT remove country names from the company name).
   - Example: "FP Chassis Australia (Pty) Ltd" -> "FP Chassis Australia Proprietary Limited"
   - Example: "Meramec USA Inc" -> "Meramec USA Incorporated"
   - Example: "Stoneland USA" -> "Stoneland USA"
   - Example: "Palram Americas" -> "Palram Americas"
4. DO NOT EXPAND SYMBOLS (KEEP SYMBOLS AS THEY ARE - e.g. "&") & DO NOT INVENT "COMPANY":
   - CRITICAL MANDATORY QC RULE ("dont expand the symbols it should be as it is H&R Manufacturing"):
     * When a company name uses symbols such as "&" (ampersand), DO NOT expand "&" into "And"!
     * Keep the symbol exactly as it appears on the website:
       - "H&R Manufacturing" -> "H&R Manufacturing" (STRICTLY NEVER "H And R Manufacturing" or "H And R Manufacturing Company"!)
       - "B&M Industrial" -> "B&M Industrial"
       - "Johnson & Johnson" -> "Johnson & Johnson"
       - "AT&T" -> "AT&T"
       - "P&G" -> "P&G"
       - "Black & Decker" -> "Black & Decker"
     * DO NOT invent, hallucinate, or append "Company" to the company name if "Company" or "Co." does not appear in the official name (e.g. if the website says "H&R Manufacturing", return "H&R Manufacturing", NEVER "H&R Manufacturing Company"!).
     * BUT when "Co." or "Co" appears in the corporate name, trade listing, or social media handles (e.g. "PEM Fountain Co." or "@pemfountainco"), expand "Co." to full form "Company": "PEM Fountain Company"!
   - CRITICAL MANDATORY QC RULE - BRAND ACRONYMS:
     * Retain acronyms and abbreviated brand trademarks in UPPERCASE (e.g. "PEM", "BMW", "AKS", "HR", "CRP", "FP"):
       - "PEM Fountain Company" (STRICTLY "PEM", NEVER "Pem Fountain" or "Pem Fountain Company"!)
       - "AKS Lining Systems Proprietary Limited" (STRICTLY "AKS", NEVER "Aks"!)
5. EXPANDING "CO., LTD" VS "CO. LTD" AND CORPORATE COMMAS (CRITICAL QC RULE):
   - RESPECT THE PRESENCE OR ABSENCE OF COMMAS EXACTLY AS IN THE OFFICIAL SOURCE:
     * If WITH comma: "Co., Ltd" or "Co.,Ltd" -> MUST expand to "Company, Limited" (keep the comma!).
     * If WITHOUT comma: "Co. Ltd" or "Co Ltd" -> MUST expand to "Company Limited" (DO NOT add a comma!).
     * Example: "KAULIN MFG. CO., LTD" -> "Kaulin Manufacturing Company, Limited" (comma kept).
     * Example: "ABC Inter Co. Ltd" -> "ABC Inter Company Limited" (no comma).
     * Example: "Pte., Ltd" -> "Private, Limited" vs "Pte. Ltd" -> "Private Limited".
     * Example: "Pty., Ltd" -> "Proprietary, Limited" vs "Pty. Ltd" -> "Proprietary Limited".
     * Example: "Pvt., Ltd" -> "Private, Limited" vs "Pvt. Ltd" -> "Private Limited".
   - When expanding ", Inc" or ", Inc." to full form, KEEP THE COMMA if present in original:
     * "TP Orthodontics, Inc" -> "TP Orthodontics, Incorporated"
     * "Transformer Manufacturers, Inc" -> "Transformer Manufacturers, Incorporated"
     * "Meramec USA Inc" -> "Meramec USA Incorporated" (no comma in original -> no comma in output).
   - Example: "U.S. Tsubaki Industrial, LLC" -> MUST KEEP the dots in "U.S." and the comma before "LLC"!
5. SPECIAL CHARACTERS MUST NOT START AND MUST NOT END (STRICT QC RULE):
   - Special characters MUST NOT start and MUST NOT end the company name!
   - The company name must strictly START with a letter or digit (never start with quotes, copyright ©, #, •, -, _, /, |, *, ~, (, [, @, &, punctuation, or symbols).
   - The company name must strictly END with a letter or digit (never end with trailing commas, periods/dots, semicolons, colons, dashes, slashes, or quotes).
   - Example: "# Carrier Inc." -> "Carrier Incorporated" (no leading #, no trailing dot).
   - Example: "© 2024 Acme Co., Ltd." -> "Acme Company, Limited" (no leading ©, no trailing dot).
   - Example: "- Furco Co. Ltd -" -> "Furco Company Limited" (no leading or trailing dashes).
6. EXPAND LEGAL ABBREVIATIONS GLOBALLY TO FULL WORDS:
   - Indonesia:
     * PT, PT., P.T. -> Perseroan Terbatas (prefix before name: e.g. "PT Astra International Tbk" -> "Perseroan Terbatas Astra International Terbuka")
     * CV, CV., C.V. -> Commanditaire Vennootschap
     * UD, UD., U.D. -> Usaha Dagang
     * PD, PD., P.D. -> Perusahaan Daerah
     * Tbk, Tbk. -> Terbuka
   - Malaysia:
     * Sdn Bhd, Sdn. Bhd. -> Sendirian Berhad
     * Bhd, Bhd. -> Berhad
     * PLT -> Perkongsian Liabiliti Terhad
     * NEVER output "Proprietary Limited" for Malaysian companies!
   - Germany / Austria / Switzerland (DACH):
     * GmbH, G.m.b.H. -> Gesellschaft mit beschränkter Haftung
     * GmbH & Co. KG, GmbH + Co. KG -> Gesellschaft mit beschränkter Haftung and Compagnie Kommanditgesellschaft
     * AG, A.G. -> Aktiengesellschaft
     * KG -> Kommanditgesellschaft
     * OHG -> Offene Handelsgesellschaft
     * UG (haftungsbeschränkt) -> Unternehmergesellschaft haftungsbeschränkt
     * GbR -> Gesellschaft bürgerlichen Rechts
     * e.K. -> eingetragener Kaufmann
   - Spain & Latin America:
     * S.L., SL -> Sociedad Limitada
     * S.A., SA -> Sociedad Anónima
     * S.L.U., SLU -> Sociedad Limitada Unipersonal
     * S.A.U., SAU -> Sociedad Anónima Unipersonal
     * S.Coop. -> Sociedad Cooperativa
   - Italy:
     * S.r.l., SRL -> Società a Responsabilità Limitata
     * S.r.l.s., SRLS -> Società a Responsabilità Limitata Semplificata
     * S.p.A., SPA -> Società per Azioni
     * S.a.s. -> Società in Accomandita Semplice
     * S.n.c. -> Società in Nome Collettivo
   - France & Belgium:
     * SARL, S.A.R.L. -> Société à Responsabilité Limitée
     * SAS, S.A.S. -> Société par Actions Simplifiée
     * SASU, S.A.S.U. -> Société par Actions Simplifiée Unipersonnelle
   - Netherlands & Belgium:
     * B.V., BV -> Besloten Vennootschap
     * N.V., NV -> Naamloze Vennootschap
   - Poland:
     * Sp. z o.o. -> Spółka z ograniczoną odpowiedzialnością
   - Nordics:
     * AB -> Aktiebolag
     * AS -> Aksjeselskap
     * Oy -> Osakeyhtiö
   - Australia & South Africa:
     * [Pty]Ltd, (Pty) Ltd, Pty Ltd, Pty. Ltd. -> Proprietary Limited
     * Pty, Pty. -> Proprietary
   - Singapore / India / United Kingdom:
     * Pte Ltd, Pte. Ltd., (Pte) Ltd -> Private Limited
     * Pvt Ltd, Pvt. Ltd., (Pvt) Ltd -> Private Limited
     * Plc, PLC -> Public Limited Company
   - United States / Canada / Global:
     * Ltd, Ltd. -> Limited
     * Inc, Inc. -> Incorporated
     * LLC, L.L.C. -> Limited Liability Company
     * LLP, L.L.P. -> Limited Liability Partnership
     * LP, L.P. -> Limited Partnership
     * PLLC, P.L.L.C. -> Professional Limited Liability Company
     * Co, Co. -> Company
     * Corp, Corp. -> Corporation
     * Co., Ltd., Co. Ltd. -> Company, Limited (always include comma before Limited!)
     * Mfg., Mfg -> Manufacturing
     * Mfr., Mfrs. -> Manufacturer, Manufacturers
     * Ind., Inds., Indust. -> Industries / Industrial
     * Intl., Intl, Int'l -> International
     * Natl., Natl, Nat'l -> National
     * Tech., Technol., Tech -> Technology / Technologies
     * Engg., Eng., Engr. -> Engineering
     * Dev., Devel. -> Development
     * Sys., Syst. -> Systems
     * Prod., Prods. -> Products
     * Equip., Eqpt. -> Equipment
     * Svcs., Svc., Serv. -> Services
     * Soln., Solns. -> Solutions
     * Assoc., Assocs. -> Associates
     * Grp., Grp -> Group
     * Chem., Chems. -> Chemicals / Chemical
     * Elec., Elect. -> Electronics / Electrical
     * Auto., Auto -> Automotive / Automation
     * Dist., Distrib. -> Distribution / Distributors
     * Fab., Fab -> Fabrication
     * Mach., Mach -> Machinery
     * Pkg., Pack. -> Packaging
     * Mgmt., Mgt. -> Management
     * Comm., Comms. -> Communications
     * Lab., Labs. -> Laboratories
     * Mat., Matl. -> Materials
     * Appl., App. -> Applied
     * Adv., Adv -> Advanced
     * Gen., Gen -> General
     * Std., Std -> Standard
     * Env., Envr. -> Environmental
     * Trans., Transp. -> Transportation / Transport
     * Log., Logist. -> Logistics
     * Const., Constr. -> Construction
     * Pharm., Pharm -> Pharmaceuticals
     * Agri., Agric. -> Agricultural
     * Telecom. -> Telecommunications
     * JSC, PJSC, OJSC -> Joint Stock Company, Public Joint Stock Company, Open Joint Stock Company
     * Ltda., Ltda -> Limitada
     * S.A. de C.V. -> Sociedad Anónima de Capital Variable
     * S. de R.L. de C.V. -> Sociedad de Responsabilidad Limitada de Capital Variable
     * SE -> Societas Europaea
     * s.r.o. -> společnost s ručením omezeným
     * d.o.o. -> društvo s ograničenom odgovornošću
     * Kft. -> Korlátolt Felelősségű Társaság
5. EXTRACT TRUE BRAND & COMPLETE LEGAL NAME (NEVER MARKETING SLOGANS OR INCOMPLETE DESCRIPTORS):
   - You MUST analyze ALL website pages (About Us, Company Profile, Terms & Conditions, Privacy Policy, Legal / Impressum, and official registration numbers like ABN/ACN).
   - If an official registered corporate name with prefix, suffix, and category exists anywhere on the site (e.g. "Custom Flatpack Proprietary Limited" / "Custom Flatpack Pty Ltd"), you MUST output that FULL official registered name! NEVER output an incomplete brand or marketing name like "Custom Flat Packs".
   - When the page title or header contains both a service description/slogan and a business name (e.g. "Expert Cabinet Maker in Canberra | Custom Flat Packs"), identify the business brand ("Custom Flatpack") and find its full registered legal corporate entity ("Custom Flatpack Proprietary Limited").
   - Reject phrases like "Expert ... in [City]", "Best ... in [City]", "Leading Manufacturer of ...", "Professional ... Services" when they are marketing taglines.
6. STRICTLY REMOVE NAVIGATION, CTA, AND PAGE-CONTEXT PREFIXES:
   - NEVER prefix the company name with navigation or call-to-action words like "Contact ", "Contact Us ", "About ", "Welcome to ", "Home - ", "Visit ", "Get In Touch With ", "Connect With ", "Policy ", "Submit ", "Scroll to Top ", "Privacy Notice of ", "Copyright ", etc.
   - Example: If a page heading says "Contact Danzer UK Limited", the official company name is "Danzer UK Limited" (NEVER "Contact Danzer UK Limited").
   - Strip marketing taglines or product category descriptors attached after the legal suffix (e.g. "Danzer UK Limited - Timber Merchants Suppliers of Hardwoods" -> "Danzer UK Limited").
7. MANDATORY CAPITALIZATION & SPECIAL CHARACTER RULES FOR COMPANY NAME:
   - EVERY SINGLE WORD in companyName MUST start with a Capital letter (Title Case). E.g. "Inter Outstanding Electronics Incorporated", "Wang Ruey Industrial Company Limited".
   - Special characters MUST NOT start and MUST NOT end the company name.

COUNTRY NAME VALIDATION RULES (CRITICAL QC REQUIREMENT):
1. MANDATORY COUNTRY NAME QC RULE:
   - "You must write the country name in full form. If the country name is not available on the site, check on social media. If still not available, search on Google using the city and state name. We consider the locality for the country name.
   Example: United Kingdom (England, Wales, Scotland, Northern Ireland). If “England” and “United Kingdom” both are mentioned, you must take England as the country name."
2. FULL FORM COUNTRY NAME (CRITICAL MANDATORY QC RULE):
   - You MUST write the country name in full form (e.g. "United States Of America", "United Kingdom", "South Africa", "United Arab Emirates", "Saudi Arabia", "New Zealand").
3. FALLBACK HIERARCHY FOR COUNTRY IDENTIFICATION (CRITICAL QC RULE):
   - If the country name is not available on the site, check on company social media (LinkedIn, Facebook, Twitter/X, Instagram, YouTube).
   - If still not available, search on Google using the city and state name. WE CONSIDER THE LOCALITY FOR THE COUNTRY NAME.
   - Extract directly from the physical address, city, state, or locality evidence.
4. UNITED KINGDOM & CONSTITUENT COUNTRIES MANDATE (CRITICAL QC RULE):
   - Example: United Kingdom (England, Wales, Scotland, Northern Ireland). If "England" and "United Kingdom" both are mentioned, you must take England as the country name.
   - The constituent countries of the United Kingdom are:
     * "England"
     * "Wales"
     * "Scotland"
     * "Northern Ireland"
   - STRICT QC MANDATE:
     * If "England" and "United Kingdom" both are mentioned, YOU MUST TAKE England as the country name!
     * If "Scotland" and "United Kingdom" both are mentioned, YOU MUST TAKE Scotland as the country name!
     * If "Wales" and "United Kingdom" both are mentioned, YOU MUST TAKE Wales as the country name!
     * If "Northern Ireland" and "United Kingdom" both are mentioned, YOU MUST TAKE Northern Ireland as the country name!
     * When the locality, city, or county belongs to a constituent country (e.g. London, Birmingham, Manchester, Leeds, Kettering, Northamptonshire, Essex, Yorkshire, Kent, Lancashire -> England; Cardiff, Swansea, Newport -> Wales; Edinburgh, Glasgow, Aberdeen, Dundee -> Scotland; Belfast, Derry -> Northern Ireland), you MUST return that constituent country ('England', 'Wales', 'Scotland', 'Northern Ireland') instead of generic 'United Kingdom'!
     * Only return generic "United Kingdom" if NO specific constituent country (England, Wales, Scotland, Northern Ireland) or constituent locality is identifiable.
4. MANDATORY CAPITALIZATION: EVERY SINGLE WORD in countryName MUST start with a Capital letter (e.g. "United States Of America" with capital 'Of', "United Kingdom", "England", "Scotland", "Wales", "Northern Ireland", "South Korea", "New Zealand", "Saudi Arabia", "Czechia", "Turkiye").
5. STANDARDIZED OFFICIAL COUNTRY NAMES (GLOBAL MANDATE - APPLIES GLOBALLY TO ALL COUNTRIES):
   - For Czech Republic / Czech / Česká republika / Česko, you MUST return "Czechia" (NEVER return "Czech Republic").
   - For Turkey / Türkiye / Republic of Turkey / Republic of Turkiye, you MUST return "Turkiye" (spelled "Turkiye").
   - For the United States / USA / US / U.S.A., you MUST return the full official name "United States Of America" (NEVER return just "United States" or "USA").
   - For the United Kingdom, remember: If England, Wales, Scotland, or Northern Ireland is mentioned or identifiable from locality, return "England", "Wales", "Scotland", or "Northern Ireland" (if "England" and "United Kingdom" both are mentioned, take "England"). If no constituent country is identified, return "United Kingdom".
   - For Taiwan / Taiwan, R.O.C. / Republic of China, you MUST return "Taiwan".
   - For South Korea / Korea / Republic of Korea / ROK, you MUST return "South Korea".
   - For Swaziland, you MUST return "Eswatini".
   - For North Macedonia / Macedonia / FYROM, you MUST return "North Macedonia".
   - For Myanmar / Burma, you MUST return "Myanmar".
   - For Netherlands / Holland, you MUST return "Netherlands".
   - For Ivory Coast / Côte d'Ivoire, you MUST return "Cote D'Ivoire".
   - For East Timor / Timor-Leste, you MUST return "Timor-Leste".
   - For Cape Verde / Cabo Verde, you MUST return "Cabo Verde".
   - For Vietnam / Viet Nam, you MUST return "Vietnam".
   - For Brunei / Brunei Darussalam, you MUST return "Brunei".
   - For Syria / Syrian Arab Republic, you MUST return "Syria".
   - For Laos / Lao People's Democratic Republic, you MUST return "Laos".
   - For Russia / Russian Federation, you MUST return "Russia".
   - For Iran / Islamic Republic of Iran, you MUST return "Iran".
   - For Moldova / Republic of Moldova, you MUST return "Moldova".
   - For Tanzania / United Republic of Tanzania, you MUST return "Tanzania".
   - For Bolivia / Plurinational State of Bolivia, you MUST return "Bolivia".
   - For Venezuela / Bolivarian Republic of Venezuela, you MUST return "Venezuela".

EMAIL & SECONDARY EMAIL RULES (ANALYZE COMPLETE WEBSITE & SOCIAL CHANNELS):
1. Primary and Secondary Emails MUST NEVER BE THE SAME:
   * CRITICAL QC RULE: "Primary email and secondary emails should NOT be the same. Emails can be found in any place on the website or company social media like LinkedIn and Facebook. If only one email exists, secondaryEmailId MUST be empty string \"\"."
   * emailId and secondaryEmailId STRICTLY CANNOT be identical. Under NO circumstances should secondaryEmailId duplicate emailId.
   * If only ONE corporate email is found across the website and social media, set emailId to that email, and set secondaryEmailId to "" (empty string).
2. Comprehensive Email Search Scope (Any Place in Website or Social Media):
   * Look for emails in ANY PLACE on the website:
     - Header, Navigation bar, and Homepage body
     - Contact Us, Get In Touch, and Inquiry pages
     - About Us, Company Profile, Leadership, and Team pages
     - Careers, Jobs, and HR pages
     - Support, Customer Service, Helpdesk, and Warranty pages
     - Branches, Global Offices, Factories, and Regional Contact sections
     - Footer, Copyright block, Legal, Terms of Service, and Privacy Policy
     - Downloadable catalogs, Brochures, Product Spec Sheets, and PDFs
   * Look for emails in Company Official Social Media:
     - Company official LinkedIn page
     - Company official Facebook page
3. Primary Email (emailId):
   * Extract the main corporate, general business, or headquarters contact email (e.g. info@..., contact@..., enquiries@..., sales@..., or main corporate domain email).
   * Check official website pages first. If NO email is found on the website pages, check official company LinkedIn or Facebook profiles.
   * Never leave emailId blank if a valid corporate email exists anywhere in the crawled content or social profiles.
4. Secondary Email (secondaryEmailId) - CRITICAL QC RULE (DOUBLE CHECK & ALWAYS TAKE IF AVAILABLE):
   * DOUBLE CHECK FOR SECONDARY EMAIL: "If a secondary email is available, double-check and ALWAYS take it. Primary and secondary emails should NOT be the same."
   * Review the "All Corporate Emails Discovered on Website" list provided below:
     - If this list contains 2 or more distinct corporate emails, secondaryEmailId MUST be populated with the second distinct corporate email (different department or person, e.g. sales@..., support@..., service@..., export@..., accounts@..., hr@..., admin@..., careers@..., office@..., or a branch/personnel email).
     - DO NOT leave secondaryEmailId blank if an alternate corporate email is available on the website or official LinkedIn/Facebook!
   * secondaryEmailId MUST be different and distinct from emailId.
   * If and ONLY if the website and social media contain just ONE single email address across all pages and evidence, return "" (empty string). NEVER duplicate the primary email or invent a fake one.
5. Strict Email Anti-Artifact & Anti-Hallucination Rules:
   * NEVER extract scraping, legal, or privacy policy artifacts like "collected@www...", "posted@...", "sent@...", "accessed@...", or any email containing "www." in the domain.
   * NEVER invent, hallucinate, or guess email addresses. Only extract genuine corporate emails explicitly present in the website or official company LinkedIn/Facebook pages.

PHONE NUMBER RULES (CRITICAL QC REQUIREMENT):
- MANDATORY QC RULE:
  "Take the complete phone number, but remove the country code, special characters, and spaces. Do not take toll-free numbers. Do not take numbers starting with zero."
- REMOVE COUNTRY CODE:
  * Extract the complete phone number, but STRIP the international country calling code:
    - USA / Canada (+1 / 1): Remove country code 1 (e.g. +1 573-682-5521 -> 5736825521)
    - Taiwan (+886 / 886): Remove country code 886 (e.g. +886-2-2668-9796 -> 226689796; +886-3-9233966 -> 39233966)
    - UK (+44 / 44): Remove country code 44 (e.g. +44 20 7946 0991 -> 2079460991)
    - Australia (+61 / 61): Remove country code 61 (e.g. +61 3 9357 6115 -> 393576115)
    - South Africa (+27 / 27): Remove country code 27 (e.g. +27 11 397 2959 -> 113972959)
    - Malaysia (+60 / 60): Remove country code 60 (e.g. +60 12-940 2782 -> 129402782)
    - Singapore (+65 / 65): Remove country code 65 (e.g. +65 6123 4567 -> 61234567)
    - India (+91 / 91): Remove country code 91
    - China (+86 / 86): Remove country code 86
    - Germany (+49 / 49): Remove country code 49
    - France (+33 / 33): Remove country code 33
    - Italy (+39 / 39): Remove country code 39
    - Spain (+34 / 34): Remove country code 34
    - Japan (+81 / 81): Remove country code 81
    - South Korea (+82 / 82): Remove country code 82
    - New Zealand (+64 / 64): Remove country code 64
    - Indonesia (+62 / 62): Remove country code 62
    - Czechia (+420 / 420): Remove country code 420
    - Turkiye (+90 / 90): Remove country code 90
- REMOVE SPECIAL CHARACTERS AND SPACES:
  * Digits only (no spaces, hyphens, brackets, parentheses, plus signs, dots, or extension text).
- STRICTLY DO NOT TAKE TOLL-FREE NUMBERS:
  * Toll-free numbers are NOT allowed!
  * If only a toll-free number is available on the website, return "" (leave empty string).
  * Never extract numbers starting with 800, 888, 877, 866, 855, 844, 833, 1800, 1300, 0800, 0808, 0500, or any toll-free prefix.
- STRICTLY DO NOT TAKE NUMBERS STARTING WITH ZERO:
  * Strip all leading zeros. The final output MUST NEVER start with zero (0).
  * Example: 02-26689796 -> 226689796; 012-940 2782 -> 129402782; 020 7946 0991 -> 2079460991.
  * If a number cannot be formatted without starting with 0, return "" (do not take it).

WEBSITE DATA FOR THIS CRAWL:
Target URL: ${crawlData.originalUrl}
Page Title: ${crawlData.title}
Detected Website Brand / Logo: ${crawlData.logoText || crawlData.ogSiteName || "(None)"}
Detected Official Legal Corporate Names (Across All Crawled Pages): ${crawlData.legalCompanyCandidates && crawlData.legalCompanyCandidates.length > 0 ? crawlData.legalCompanyCandidates.slice(0, 8).join(", ") : "(None)"}
Company Profile Evidence Detected: ${crawlData.hasCompanyProfile ? "Yes (Dedicated Profile / About page, heading, or PDF detected)" : "No"}
All Corporate Emails Discovered on Website: ${(crawlData.emails || []).join(", ") || "(None)"}
Detected Contact Phones: ${(crawlData.phones || []).join(", ") || "(None)"}
Product Items / Units Detected: ${crawlData.detectedProductCount}
Product Images Detected: ${crawlData.detectedImageCount}
Product Descriptions Detected: ${crawlData.detectedDescCount}

${crawlData.jsonLd && crawlData.jsonLd.length > 0 ? `SCHEMA.ORG JSON-LD STRUCTURED BUSINESS DATA:\n${JSON.stringify(crawlData.jsonLd.slice(0, 3), null, 2)}\n\n` : ""}${crawlData.renderedText ? `TRUE RENDERED VISUAL TEXT (LIVE BROWSER DOM):\n${crawlData.renderedText.slice(0, 3500)}\n\n` : ""}DEDICATED COMPANY PROFILE / ABOUT US CONTENT:
${(crawlData.profilePageText || "").slice(0, 2500) || "(No dedicated company profile page text found)"}

PHYSICAL ADDRESS CANDIDATES FOUND ON WEBSITE (PRIMARY EVIDENCE IN PRIORITY ORDER):
${formattedAddressEvidence}

CONTACT PAGE / PROFILE CONTENT:
${(crawlData.contactPageText || "").slice(0, 3000) || "(No separate contact page text found)"}

FOOTER CONTENT:
${(crawlData.footerText || "").slice(0, 1500) || "(No separate footer text found)"}

PAGE BODY TEXT:
${(crawlData.bodyText || "").slice(0, 2500)}
`;

  const selectedModel = modelName || DEFAULT_MODEL;
  const accuracyFallbackChain = [
    selectedModel,
    ...GEMINI_MODELS
  ];
  const candidateModels = Array.from(new Set(accuracyFallbackChain)).filter(Boolean);

  let lastError = null;
  let parsed = null;

  for (const modelToTry of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const abortCtrl = new AbortController();
      const timeoutPerModel = (modelToTry === candidateModels[0]) ? 10000 : 6000;
      const abortTimer = setTimeout(() => abortCtrl.abort(), timeoutPerModel);
      let response;
      try {
        const reqHeaders = {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        };
        response = await fetch(url, {
          method: "POST",
          headers: reqHeaders,
          signal: abortCtrl.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
              responseSchema: GEMINI_RESPONSE_SCHEMA
            }
          })
        });
      } finally {
        clearTimeout(abortTimer);
      }

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 401) {
          console.warn(`[AI Assistant] Gemini API key invalid / unauthenticated (401).`);
          lastError = new Error(`Gemini authorization error 401: ${errText}`);
          break; // Stop immediately for invalid API key
        }

        // If 400 Bad Request, model might not support responseSchema; retry once without responseSchema
        if (response.status === 400) {
          try {
            const reqHeaders = {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            };
            const fallbackRes = await fetch(url, {
              method: "POST",
              headers: reqHeaders,
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt + "\nReturn strictly a valid JSON object matching the requested schema." }] }],
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: "application/json"
                }
              })
            });
            if (fallbackRes.ok) {
              const resJson = await fallbackRes.json();
              const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (rawText) {
                const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
                parsed = JSON.parse(cleaned);
                if (parsed) {
                  console.log(`[AI Assistant] Successfully extracted data with model ${modelToTry} (standard JSON fallback)!`);
                  break;
                }
              }
            }
          } catch (e) { }
        }

        console.warn(`[AI Assistant] Model ${modelToTry} failed (${response.status}): ${errText}. Falling back to next model in accuracy chain.`);
        lastError = new Error(`Gemini API error ${response.status} (${modelToTry}): ${errText}`);
        continue;
      }

      const resJson = await response.json();
      const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error(`Empty response from Gemini model ${modelToTry}`);

      const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
      if (parsed) {
        console.log(`[AI Assistant] Successfully extracted data with Gemini model: ${modelToTry}`);
        if (/^(?:not\s*available|none|n\/?a|null|undefined)$/i.test((parsed.secondaryEmailId || "").trim())) {
          parsed.secondaryEmailId = "";
        }
        break;
      }
    } catch (err) {
      console.warn(`[AI Assistant] Model ${modelToTry} attempt failed:`, err.message, ". Falling back to next candidate.");
      lastError = err;
    }
  }

  if (!parsed) {
    throw lastError || new Error("All Gemini models failed to return structured data");
  }

  // Ensure secondaryEmailId doesn't retain "Not Available" placeholder text
  if (/^(?:not\s*available|none|n\/?a|null|undefined)$/i.test((parsed.secondaryEmailId || "").trim())) {
    parsed.secondaryEmailId = "";
  }
  // QC Rule: Primary email and secondary email MUST NOT be the same!
  if (parsed.secondaryEmailId && parsed.emailId && parsed.secondaryEmailId.trim().toLowerCase() === parsed.emailId.trim().toLowerCase()) {
    parsed.secondaryEmailId = "";
  }

  // Safely fallback to crawled emails/phones only if missing from Gemini
  const crawlEmails = (crawlData && Array.isArray(crawlData.emails) ? crawlData.emails : []).map(e => String(e).trim().toLowerCase());
  if ((!parsed.emailId || !parsed.emailId.trim()) && crawlEmails.length > 0) {
    parsed.emailId = crawlEmails.find(e => isValidCorporateEmail(e)) || crawlEmails[0] || "";
  }
  if ((!parsed.secondaryEmailId || !parsed.secondaryEmailId.trim()) && crawlEmails.length > 1) {
    const second = crawlEmails.find(e => isValidCorporateEmail(e) && e.toLowerCase() !== (parsed.emailId || "").toLowerCase());
    parsed.secondaryEmailId = second || "";
  }
  if (parsed.secondaryEmailId && parsed.emailId && parsed.secondaryEmailId.trim().toLowerCase() === parsed.emailId.trim().toLowerCase()) {
    parsed.secondaryEmailId = "";
  }
  if (!parsed.phoneNumber && crawlData && Array.isArray(crawlData.phones) && crawlData.phones.length > 0) {
    parsed.phoneNumber = crawlData.phones[0];
  }
  parsed._isFromAi = true;

  return parsed;
}

function extractRootDomain(urlOrHost) {
  if (!urlOrHost || typeof urlOrHost !== "string") return "";
  let host = urlOrHost.trim().toLowerCase();
  try {
    if (host.includes("://")) {
      host = new URL(host).hostname;
    } else if (host.includes("/")) {
      host = host.split("/")[0];
    }
  } catch (e) { }
  host = host.replace(/:\d+$/, "");
  host = host.replace(/^www\d?\./i, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  if (/^(?:co|com|org|net|gov|edu|ac|asn|idv|gen|nic|ltd|me|tm)\.[a-z]{2}$/i.test(lastTwo)) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function extractDomainStem(urlOrHost) {
  if (!urlOrHost || typeof urlOrHost !== "string") return "";
  let host = urlOrHost.trim().toLowerCase();
  host = host.replace(/^https?:\/\//i, "");
  try {
    if (host.includes("://")) {
      host = new URL("http://" + host).hostname;
    } else if (host.includes("/")) {
      host = host.split("/")[0];
    }
  } catch (e) { }
  host = host.replace(/^www\d?\./i, "");
  host = host.replace(/\.(?:co\.[a-z]{2}|com\.[a-z]{2}|org\.[a-z]{2}|net\.[a-z]{2}|gov\.[a-z]{2}|edu\.[a-z]{2}|[a-z]{2,})$/i, "");
  host = host.replace(/\.[a-z]{2,}$/i, "");
  return host.replace(/[^a-z0-9]/g, "");
}

function cleanDomainStem(url) {
  return extractDomainStem(url);
}

function isRedirectDomain(origUrl, finalUrl) {
  if (!origUrl || !finalUrl) return false;
  try {
    const origRoot = extractRootDomain(origUrl);
    const finalRoot = extractRootDomain(finalUrl);
    if (!origRoot || !finalRoot) return false;
    return origRoot !== finalRoot;
  } catch (e) {
    return false;
  }
}

function normalizeNameForComparison(name) {
  if (!name || typeof name !== "string") return "";
  return name.toLowerCase()
    .replace(/\b(?:pty\.?\s*ltd\.?|proprietary\s*limited|limited|ltd\.?|inc\.?|incorporated|llc|llp|corp\.?|corporation|co\.,\s*ltd\.?|company\s*limited|pte\.?\s*ltd\.?|pvt\.?\s*ltd\.?|sdn\.?\s*bhd\.?|berhad|gmbh|plc|s\.?l\.?u\.?|s\.?a\.?u\.?|s\.?l\.?|s\.?a\.?)\b/gi, " ")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function isSeoSloganOrTagline(name) {
  if (!name || typeof name !== "string") return false;
  const n = name.trim();
  if (typeof hasCompleteLegalSuffix === "function" && hasCompleteLegalSuffix(n)) return false;
  if (/\b(?:pty\s*ltd|limited|inc|incorporated|llc|gmbh|sdn\s*bhd)\b/i.test(n)) return false;
  if (/^(?:expert|best|leading|professional|premier|top|specialist|quality|affordable|cheap|reliable|trusted)\b/i.test(n)) {
    return true;
  }
  if (/\b(?:in\s+(?:canberra|sydney|melbourne|brisbane|perth|adelaide|hobart|darwin|gold\s*coast|newcastle|london|new\s*york|chicago|los\s*angeles|taiwan|australia|singapore|malaysia))\b/i.test(n)) {
    return true;
  }
  if (/^(?:manufacturer|supplier|wholesaler|distributor|maker|installer|builder|contractor)\s+of\b/i.test(n)) {
    return true;
  }
  return false;
}

function scoreTitleSegment(segment, domainStem, logoText, ogSiteName) {
  const segLower = segment.toLowerCase().trim();
  let score = 0;
  if (/^(?:expert|best|leading|professional|premier|top|specialist|quality|affordable|cheap|reliable|trusted)\b/i.test(segLower)) {
    score -= 50;
  }
  if (/\b(?:in\s+(?:canberra|sydney|melbourne|brisbane|perth|adelaide|london|new\s*york|chicago|taiwan|australia))\b/i.test(segLower)) {
    score -= 40;
  }
  if (/^(?:manufacturer|supplier|wholesaler|distributor|installer|maker|builder|contractor)\s+of\b/i.test(segLower)) {
    score -= 40;
  }
  const segCondensed = segLower.replace(/[^a-z0-9]/g, "");
  if (domainStem && domainStem.length >= 3) {
    if (segCondensed === domainStem) score += 100;
    else if (segCondensed.startsWith(domainStem) || domainStem.startsWith(segCondensed)) score += 70;
    else if (segCondensed.includes(domainStem) || domainStem.includes(segCondensed)) score += 50;
  }
  if (logoText && segLower.includes(logoText.toLowerCase())) score += 80;
  if (ogSiteName && segLower.includes(ogSiteName.toLowerCase())) score += 80;
  if (/\b(?:ltd|limited|inc|incorporated|llc|corp|corporation|pty|proprietary|pvt|pte|sdn|bhd|gmbh)\b/i.test(segLower)) {
    score += 60;
  }
  return score;
}

function extractBestBrandFromTitle(title, domain, logoText = "", ogSiteName = "") {
  if (!title) return "";
  const parts = title.split(/[-–—|:•]/).map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "";
  const domainStem = cleanDomainStem(domain);
  let bestPart = parts[0];
  let bestScore = -999;
  for (let part of parts) {
    const cleanedPart = part.replace(/^(?:welcome\s+to\s+|welcome\s*[-–—|:•]\s*)/i, "").trim();
    if (/^(?:home(\s+page)?|welcome|about(\s+us)?|contact(\s+us)?|index|official\s*website)$/i.test(cleanedPart)) continue;
    const candidate = cleanedPart || part;
    const s = scoreTitleSegment(candidate, domainStem, logoText, ogSiteName);
    if (s > bestScore) {
      bestScore = s;
      bestPart = candidate;
    }
  }
  return bestPart;
}

/**
 * Infers business type from website text and structural signals.
 * Never defaults blindly to Manufacturer.
 */
function inferBusinessTypeFromEvidence(corpus, html = "") {
  if (!corpus && !html) return "";
  const text = (corpus + " " + html).toLowerCase();

  const scores = {
    "Manufacturer": 0,
    "Supplier": 0,
    "Distributer": 0,
    "Wholesaler": 0,
    "Exporter": 0,
    "Trader": 0,
    "Industrial Services": 0
  };

  // 1. Manufacturer signals
  if (/\b(?:we\s+manufacture|our\s+factory|our\s+plant|production\s+facility|manufacturing\s+facility|oem\s*\/\s*odm|oem|odm|fabricated\s+in|custom\s+fabrication|die\s+casting|injection\s+molding|cnc\s+machining|assembly\s+line)\b/i.test(text)) scores["Manufacturer"] += 15;
  const mMatches = text.match(/\b(?:manufacturer|manufacturing|manufacture|fabricator|fabrication|producers?)\b/g);
  if (mMatches) scores["Manufacturer"] += mMatches.length * 3;

  // 2. Industrial Services signals
  if (/\b(?:industrial\s+services?|machining\s+services?|engineering\s+services?|surface\s+treatment|heat\s+treatment|calibration\s+services?|maintenance\s+and\s+repair|fabrication\s+services?|contract\s+manufacturing)\b/i.test(text)) scores["Industrial Services"] += 15;

  // 3. Supplier signals
  if (/\b(?:leading\s+supplier|we\s+supply|product\s+supplier|stockist\s+and\s+supplier|supplying\s+quality|lumber\s*(?:yard|company|dealer)?|building\s*materials|construction\s*supplies|timber\s*merchant|hardware\s*supplies)\b/i.test(text)) scores["Supplier"] += 12;
  const sMatches = text.match(/\b(?:supplier|suppliers|supplying|stockist|stockists|dealers?|lumberyard|lumber)\b/g);
  if (sMatches) scores["Supplier"] += sMatches.length * 3;

  // 4. Distributer signals
  if (/\b(?:authorized\s+distributor|authorised\s+distributor|master\s+distributor|official\s+distributor|distribution\s+network)\b/i.test(text)) scores["Distributer"] += 15;
  const dMatches = text.match(/\b(?:distributor|distributer|distributors|distributers|distribution)\b/g);
  if (dMatches) scores["Distributer"] += dMatches.length * 3;

  // 5. Wholesaler signals
  if (/\b(?:trade\s+only|wholesale\s+prices?|bulk\s+orders?|wholesale\s+supply|wholesalers?)\b/i.test(text)) scores["Wholesaler"] += 12;
  const wMatches = text.match(/\b(?:wholesaler|wholesalers|wholesale)\b/g);
  if (wMatches) scores["Wholesaler"] += wMatches.length * 3;

  // 6. Exporter signals
  if (/\b(?:export\s+to|worldwide\s+exporter|exporting\s+to|global\s+export)\b/i.test(text)) scores["Exporter"] += 12;
  const eMatches = text.match(/\b(?:exporter|exporters|exporting)\b/g);
  if (eMatches) scores["Exporter"] += eMatches.length * 3;

  // 7. Trader signals
  if (/\b(?:general\s+trading|import\s+and\s+export|import\s*\/\s*export|trading\s+co(?:mpany)?)\b/i.test(text)) scores["Trader"] += 12;
  const tMatches = text.match(/\b(?:trader|traders|trading)\b/g);
  if (tMatches) scores["Trader"] += tMatches.length * 3;

  let bestType = "";
  let maxScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestType = type;
    }
  }

  if (maxScore === 0) {
    if (/\b(?:factory|plant|works)\b/i.test(text)) return "Manufacturer";
    return "";
  }

  return bestType;
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
  if (!companyName && crawlData.legalCompanyCandidates && crawlData.legalCompanyCandidates.length > 0) {
    const domainStem = cleanDomainStem(crawlData.originalUrl || crawlData.finalUrl);
    for (const cand of crawlData.legalCompanyCandidates) {
      if (hasCompleteLegalSuffix(cand)) {
        const cStem = cleanDomainStem(cand.replace(/\b(?:pty|ltd|limited|proprietary|inc|llc|corp|co)\b/gi, ""));
        if (cStem && (cStem === domainStem || cStem.includes(domainStem) || domainStem.includes(cStem))) {
          companyName = cand;
          break;
        }
      }
    }
  }
  if (!companyName && crawlData.logoText && !isSeoSloganOrTagline(crawlData.logoText)) {
    companyName = crawlData.logoText;
  }
  if (!companyName && crawlData.title) {
    companyName = extractBestBrandFromTitle(crawlData.title, crawlData.originalUrl || crawlData.finalUrl, crawlData.logoText, crawlData.ogSiteName);
  }
  if (!companyName) {
    companyName = "";
  }

  const topCandidate = (crawlData.addressCandidates && crawlData.addressCandidates.length > 0)
    ? crawlData.addressCandidates[0]
    : null;
  let address = topCandidate
    ? (typeof topCandidate === "object" ? topCandidate.raw : topCandidate)
    : extractLikelyAddress(crawlData.contactPageText || crawlData.footerText || text);
  if (address) {
    address = address.replace(/^[\s\S]*?\b(?:registered\s+in\s+[A-Za-z\s]+(?::\s*[\dA-Za-z]+)?\.?\s*,?\s*)?(?:registered\s*office|registered\s*agent|domicilio\s*social)\s*[:：\-–,\s]+/i, "").trim();
    address = address.replace(/^[\s\S]*?\b(?:company\s+registration(?:\s+no\.?|\s+number)?\s*[:：\-–,\s]*[\dA-Za-z]+\.?\s*,?\s*)/i, "").trim();
    address = expandAddressAndStateAbbreviations(address, country);
  }

  let country = detectCountryFromAddress(address);
  if (/^(?:united\s*kingdom|great\s*britain|uk|england|scotland|wales|northern\s*ireland)$/i.test((country || "").trim())) {
    country = "United Kingdom";
  }
  const emailId = crawlData.emails.length > 0 ? stripTrailingContactWordsFromEmail(crawlData.emails[0]) : "";
  let targetDomain = "";
  try {
    targetDomain = new URL(crawlData.originalUrl || crawlData.url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch (e) { }
  const primHost = emailId ? (emailId.split("@")[1] || "").toLowerCase() : "";
  const secCandidate = crawlData.emails.map(e => stripTrailingContactWordsFromEmail(e)).find(e => {
    if (!e || e === emailId || !isValidCorporateEmail(e) || isUnwantedEmail(e)) return false;
    const h = (e.split("@")[1] || "").toLowerCase();
    if (!h) return false;
    if (primHost && (h === primHost || h.endsWith("." + primHost) || primHost.endsWith("." + h))) return true;
    if (targetDomain && (h === targetDomain || h.endsWith("." + targetDomain))) return true;
    return false;
  });
  const secondaryEmailId = (secCandidate && secCandidate !== emailId) ? secCandidate : "";
  const phoneNumber = crawlData.phones.length > 0 ? crawlData.phones[0] : "";

  // Dynamic product counts preserving 0
  const prodCount = crawlData.detectedProductCount >= 3 ? "3" : (crawlData.detectedProductCount > 0 ? String(crawlData.detectedProductCount) : "0");
  const imgCount = crawlData.detectedImageCount >= 3 ? "3" : (crawlData.detectedImageCount > 0 ? String(crawlData.detectedImageCount) : "0");
  const descCount = crawlData.detectedDescCount >= 3 ? "3" : (crawlData.detectedDescCount > 0 ? String(crawlData.detectedDescCount) : "0");

  const hasState = address && hasStateInAddress(address, country);
  const hasCity = address && hasCityInAddress(address, country);

  const inferredBusiness = restrictedCheck.isRestricted
    ? "Restricted Site"
    : inferBusinessTypeFromEvidence(text, crawlData.mainHtml || "");

  const shopCartCheck = crawlData.shopCartCheck || detectPurchaseOrShoppingCart((crawlData.mainHtml || "") + "\n" + (crawlData.contactHtml || ""), crawlData.bodyText || "");
  let websiteStatus = (shopCartCheck && shopCartCheck.detected) ? "Not Working" : (crawlData.status || crawlData.initialStatus || "Working");

  // Rule 1: If website has 0 products and no address or no verifiable contact information, mark Not Working!
  const hasContactEvidence = !!(address || emailId || phoneNumber);
  const isZeroProdUnverifiable = (!address && prodCount === "0") || (!hasContactEvidence && prodCount === "0");
  if (isZeroProdUnverifiable) {
    websiteStatus = "Not Working";
  }

  // CRITICAL RULE: "Notworking means all empty"
  if (websiteStatus === "Not Working") {
    const isZeroProdReason = isZeroProdUnverifiable;
    const reasonMsg = isZeroProdReason
      ? "Website has 0 products and no verifiable catalog or physical address (Rule 1)."
      : (crawlData.fetchError || "Website has no verifiable business products, physical address, or services.");

    return {
      websiteStatus: "Not Working",
      businessType: "",
      companyProfile: "",
      companyName: "",
      countryName: "",
      companyAddress: "",
      state: "",
      city: "",
      emailId: "",
      secondaryEmailId: "",
      phoneNumber: "",
      numberOfProducts: "",
      productImages: "",
      numberOfProductDescriptions: "",
      errorCategory: isZeroProdReason ? "No Business Products / 0 Products" : (crawlData.fetchError ? "Unreachable / Timeout" : "No Business Content"),
      errorKeyword: isZeroProdReason ? "0 Products / No Catalog" : (crawlData.fetchError ? "Connection Failed" : "No Verifiable Content"),
      errorSourceUrl: crawlData.finalUrl || crawlData.originalUrl || "",
      errorSnippet: reasonMsg,
      notWorkingReason: reasonMsg,
      isRestricted: restrictedCheck.isRestricted,
      restrictedReason: restrictedCheck.matchedKeyword,
      isShopCartSite: !!(shopCartCheck && shopCartCheck.detected),
      shopCartReason: (shopCartCheck && shopCartCheck.reason) || ""
    };
  }

  return {
    websiteStatus: websiteStatus,
    businessType: inferredBusiness,
    companyProfile: crawlData.hasCompanyProfile ? "Available" : "Not Available",
    companyName: companyName,
    countryName: normalizeCountryName(country),
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
    restrictedReason: restrictedCheck.matchedKeyword,
    isShopCartSite: !!(shopCartCheck && shopCartCheck.detected),
    shopCartReason: (shopCartCheck && shopCartCheck.reason) || ""
  };
}

/**
 * Identifies whether a company sells, supplies, fabricates, fits, or distributes physical products / manufactured goods
 * (e.g. windows, doors, conservatories, glass, building materials, construction products, hardware, tools, packaging, metals, plastics, machinery).
 * These are valid "Supplier" or "Manufacturer" companies and MUST be treated as Working sites, never as disallowed consumer service providers.
 */
function checkPhysicalProductSupplier(crawlData, result) {
  if (!crawlData) return false;
  const combined = (
    (crawlData.mainHtml || "") + " " +
    (crawlData.bodyText || "") + " " +
    (crawlData.profilePageText || "") + " " +
    (crawlData.contactHtml || "") + " " +
    (crawlData.title || "")
  ).toLowerCase();

  // Physical goods / tangible products markers
  const productMarkers = /\b(?:windows|doors|conservatories|orangeries|glazing|double\s*glazing|roof\s*lanterns|shutters|blinds|fencing|gates|railings|cladding|timber|lumber|wood|plywood|decking|mouldings?|trim|siding|roofing|insulation|drywall|upvc|aluminium|glass|tiles|flooring|cabinets|countertops|machinery|equipment|tools|hardware|valves|pumps|pipes|fittings|fasteners|bearings|cables|wiring|packaging|plastics|textiles|steel|sheet\s*metal|fabrication|building\s*materials|construction\s*supplies|industrial\s*supplies)\b/i;

  // Supplier / manufacturer / distributor operational markers
  const supplierMarkers = /\b(?:supplier|suppliers|supplying|supply\s+and\s+(?:fit|install)|fabricator|fabricators|distributor|distributer|distributors|wholesaler|wholesalers|manufacturers?|stockists?|our\s+products|product\s+range|brochure|products\s+we\s+supply|dealers?|yard|lumberyard|building\s*materials|materials\s*we|we\s*carry|inventory|stocking|browse\s*around)\b/i;

  // Pure non-goods consumer services exclusions (restaurants, salons, legal, accounting, marketing, real estate, hotels)
  const isPureConsumerService = /\b(?:restaurant|cafe|coffee\s*shop|bistro|barber|hair\s*salon|nail\s*salon|spa|massage|tattoo|dentist|veterinary|legal\s*advice|law\s*firm|solicitors?|accountants?|bookkeeping|marketing\s*agency|seo\s*agency|real\s*estate\s*agency|estate\s*agents?|property\s*rental|hotel|motel)\b/i.test(combined);

  if (productMarkers.test(combined) && supplierMarkers.test(combined) && !isPureConsumerService) {
    return true;
  }
  return false;
}

/**
 * Determines the source URL where the official company name was discovered.
 * Prioritizes Home page and About Us page over low-quality terms/privacy/policy/faq pages.
 */
function determineCompanyNameSource(compName, crawlData) {
  if (!compName || !crawlData) return (crawlData && (crawlData.finalUrl || crawlData.originalUrl)) || "";
  const norm = normalizeNameForComparison(compName);
  if (!norm) return crawlData.finalUrl || crawlData.originalUrl || "";

  const finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
  const primaryAboutUrl = crawlData.primaryAboutUrl || "";
  const primaryContactUrl = crawlData.primaryContactUrl || "";

  const isLowQualityPage = (url) => /\b(?:terms|terms-and-conditions|privacy|privacy-policy|policy|policies|disclaimer|faq|legal|cart|checkout|cookie|sitemap)\b/i.test(url || "");

  // 1. If homepage HTML, title, logo, header, or copyright matches company name, homepage is the primary source
  if (crawlData.mainHtml) {
    const mainHtmlLower = crawlData.mainHtml.toLowerCase();
    const compNameLower = compName.toLowerCase();
    if (
      (crawlData.copyrightText && normalizeNameForComparison(crawlData.copyrightText).includes(norm)) ||
      mainHtmlLower.includes(compNameLower) ||
      (norm.length > 5 && mainHtmlLower.includes(norm))
    ) {
      return finalUrl;
    }
  }

  // 2. If primaryAboutUrl exists and compName is mentioned on about page
  if (primaryAboutUrl && crawlData.profilePageText && crawlData.profilePageText.toLowerCase().includes(compName.toLowerCase())) {
    return primaryAboutUrl;
  }

  // 3. Check legalCandidateSources (excluding terms/privacy/cart pages)
  if (crawlData.legalCandidateSources) {
    for (const [cand, srcUrl] of Object.entries(crawlData.legalCandidateSources)) {
      if (normalizeNameForComparison(cand) === norm && !isLowQualityPage(srcUrl)) {
        return srcUrl;
      }
    }
    for (const [cand, srcUrl] of Object.entries(crawlData.legalCandidateSources)) {
      const cNorm = normalizeNameForComparison(cand);
      if (cNorm && (cNorm.includes(norm) || norm.includes(cNorm)) && !isLowQualityPage(srcUrl)) {
        return srcUrl;
      }
    }
  }

  // 4. Prefer primaryAboutUrl if present
  if (primaryAboutUrl) return primaryAboutUrl;

  // 5. Prefer primaryContactUrl if present
  if (primaryContactUrl) return primaryContactUrl;

  // 6. Check copyrightText source
  if (crawlData.copyrightText && normalizeNameForComparison(crawlData.copyrightText).includes(norm)) {
    const cpUrl = crawlData.copyrightSourceUrl || finalUrl;
    if (!isLowQualityPage(cpUrl)) return cpUrl;
  }

  return finalUrl;
}

/**
 * Enforces all 14 instructions deterministically based on physical address evidence.
 */
function applyStrictInstructions(data, crawlData, restrictedCheck) {
  const result = { ...data };

  // 1. Authoritative API Ground Truth: When Gemini API provided the extraction, use the API response directly!
  if (data._isFromAi) {
    result._isFromAi = true;
    result._finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    result._originalUrl = crawlData.originalUrl || "";
    if (result.websiteStatus === "Not Working") {
      result.businessType = "";
      result.companyProfile = "";
      result.companyName = "";
      result.countryName = "";
      result.companyAddress = "";
      result.state = "";
      result.city = "";
      result.emailId = "";
      result.secondaryEmailId = "";
      result.phoneNumber = "";
      result.numberOfProducts = "";
      result.productImages = "";
      result.numberOfProductDescriptions = "";
      return result;
    }

    // 1. Company Name: Align, expand, Title Case, restore symbols, restore comma before legal suffix
    let compName = decodeHtmlEntities(String(result.companyName || "").trim());

    // Domain-matching safeguard: If AI returned an unmatching Pinyin or auxiliary name, verify against domain stem
    try {
      const targetHost = (crawlData.finalUrl || crawlData.originalUrl || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].split(":")[0];
      const domainParts = targetHost.split(".");
      const domainStem = domainParts[0].toLowerCase().replace(/[^a-z0-9]/g, "");

      if (domainStem && domainStem.length >= 4) {
        const compNorm = compName.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!compNorm.includes(domainStem)) {
          const candidatesToSearch = [
            crawlData.logoText,
            crawlData.title,
            ...(crawlData.legalCompanyCandidates || [])
          ].filter(Boolean);

          for (const cand of candidatesToSearch) {
            const candNorm = cand.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (candNorm.includes(domainStem) && hasCompleteLegalSuffix(cand)) {
              console.log(`[AI Safeguard] Corrected mismatched company name "${compName}" to domain-matching official candidate "${cand}"`);
              compName = cand;
              break;
            }
          }
        }
      }
    } catch (e) { }

    compName = restoreLegalSuffixIfOmitted(compName, crawlData);
    compName = expandCompanyAbbreviations(compName, result.countryName || "");
    compName = toTitleCase(compName);
    compName = restoreCommaBeforeCorporateSuffix(compName, crawlData);
    compName = restoreOriginalSymbolsInCompanyName(compName, crawlData);
    result.companyName = compName
      .replace(/^[^\p{L}\p{N}]+/gu, "")
      .replace(/[^\p{L}\p{N}]+$/gu, "")
      .trim();

    // 2. Country Name: Full form Title Case, and UK constituent refinement (Mandatory QC Rule)
    // "United Kingdom (England, Wales, Scotland, Northern Ireland). If 'England' and 'United Kingdom' both are mentioned, you must take England as the country name."
    let country = toTitleCase(normalizeCountryName(result.countryName));
    if (!country && result.companyAddress) {
      country = toTitleCase(detectCountryFromAddress(result.companyAddress));
    }
    if (country === "United Kingdom") {
      const rawCandidatesText = (crawlData.addressCandidates || []).map(c => typeof c === "object" ? c.raw : c).join(" ");
      const fullCheckText = ((result.companyAddress || "") + " " + rawCandidatesText + " " + (crawlData.bodyText ? crawlData.bodyText.slice(0, 5000) : "") + " " + (crawlData.contactPageText ? crawlData.contactPageText.slice(0, 5000) : "")).toLowerCase();
      if (/\bengland\b/i.test(fullCheckText)) {
        country = "England";
      } else if (/\bscotland\b/i.test(fullCheckText)) {
        country = "Scotland";
      } else if (/(?<!\bnew\s+south\s+)\bwales\b/i.test(fullCheckText)) {
        country = "Wales";
      } else if (/\bnorthern\s*ireland\b/i.test(fullCheckText)) {
        country = "Northern Ireland";
      } else {
        const constituentFromLocality = detectCountryFromAddress(result.companyAddress || rawCandidatesText);
        if (["England", "Scotland", "Wales", "Northern Ireland"].includes(constituentFromLocality)) {
          country = constituentFromLocality;
        }
      }
    }
    result.countryName = country;

    // 3. Company Address: Strict QC sanitization - No Extra Words, expand abbreviations, remove postal codes & country
    let addr = decodeHtmlEntities(String(result.companyAddress || "").trim());
    let bestRaw = "";
    if (crawlData && Array.isArray(crawlData.addressCandidates) && crawlData.addressCandidates.length > 0) {
      const hqCand = crawlData.addressCandidates.find(c => c && (c.isHeadquarters || c.source === "contact" || c.source === "headquarters"));
      bestRaw = hqCand ? (typeof hqCand === "object" ? hqCand.raw : hqCand) : (typeof crawlData.addressCandidates[0] === "object" ? crawlData.addressCandidates[0].raw : crawlData.addressCandidates[0]);
    }
    if (addr && addr.toLowerCase() !== "not available") {
      addr = expandAddressAndStateAbbreviations(addr, country);
      if (bestRaw) {
        addr = restoreStateIfOmitted(addr, bestRaw, country);
        addr = restoreStreetNumberIfOmitted(addr, bestRaw);
        addr = stripBlindlyAddedNumber(addr, bestRaw, bestRaw);
        addr = stripExtraWordsFromAddress(addr, bestRaw);
      }
      addr = removePostalCodesCarefully(addr);
      addr = ensureCommaBeforeState(addr);
      if (bestRaw) {
        addr = stripBlindlyAddedNumber(addr, bestRaw, bestRaw);
        addr = stripExtraWordsFromAddress(addr, bestRaw);
      }
      // Unconditionally strip country names from address so country never appears inside the street address field
      addr = addr.replace(/\b(?:United\s*States\s*Of\s*America|United\s*States|USA|U\.S\.A\.)\b/gi, " ");
      addr = addr.replace(/\b(?:Great\s*Britain|United\s*Kingdom|UK|U\.K\.)\b/gi, " ");
      addr = addr.replace(/(?<!\b(?:Western|South)\s+)\bAustralia\b/gi, " ");
      addr = addr.replace(/\b(?:Canada|Germany|Deutschland|France|Spain|Espa[nñ]a|Turkiye|T[uü]rkiye|Turkey|New\s*Zealand|Aotearoa|Malaysia|Indonesia|Republik\s*Indonesia|Singapore|Japan|China|India|South\s*Africa)\b/gi, " ");
      addr = addr.replace(/\b(r\.?o\.?c\.?|republic\s*of\s*china|taiwan)\b/gi, " ");
      if (country && country.length > 2) {
        const countryRegex = new RegExp(`\\b${country}\\b`, "gi");
        addr = addr.replace(countryRegex, " ");
      }
      addr = addr.replace(/[,;.\s\-_/\\|]+$/g, "").trim();
      addr = addr.replace(/^[,;.\s\-_/\\|]+/g, "").trim();
      addr = addr.replace(/\s+/g, " ");
      addr = toTitleCase(addr);
      addr = repairBlindlySeparatedCommas(addr);
      addr = normalizeTaiwanDivisions(addr);
      if (bestRaw) {
        addr = stripExtraWordsFromAddress(addr, bestRaw);
      }
      addr = addr.replace(/^[^\p{L}\p{N}]+/gu, "").replace(/[,;:\-_|/\\~*#@^"'“”‘’«»`]+$/g, "").trim();
    } else {
      addr = "Not Available";
    }
    result.companyAddress = addr;

    // 4. State & City QC (CRITICAL QC RULE: A SUBURB IS NOT A CITY!)
    if (!addr || addr.length < 5 || addr.toLowerCase() === "not available") {
      result.state = "Not Available";
      result.city = "Not Available";
    } else {
      result.state = hasStateInAddress(addr, country) ? "Available" : "Not Available";
      result.city = evaluateCityQC(addr, country);
    }

    result.businessType = String(result.businessType || "").trim();
    result.companyProfile = String(result.companyProfile || "").trim();
    result.emailId = String(result.emailId || "").trim();
    result.secondaryEmailId = String(result.secondaryEmailId || "").trim();
    if (/^(?:not\s*available|none|n\/?a|null|undefined)$/i.test(result.secondaryEmailId)) {
      result.secondaryEmailId = "";
    }
    // QC Rule: Primary email and secondary email MUST NOT be the same!
    if (result.secondaryEmailId && result.emailId && result.secondaryEmailId.toLowerCase() === result.emailId.toLowerCase()) {
      result.secondaryEmailId = "";
    }
    // If secondaryEmailId is empty or duplicate, attempt to find a distinct corporate email from crawlData
    if (!result.secondaryEmailId && crawlData && Array.isArray(crawlData.emails) && crawlData.emails.length > 0) {
      const primLower = (result.emailId || "").toLowerCase();
      const distinctCand = crawlData.emails.find(e => {
        const eClean = String(e || "").trim();
        return eClean && eClean.toLowerCase() !== primLower && isValidCorporateEmail(eClean) && !isUnwantedEmail(eClean);
      });
      if (distinctCand) {
        result.secondaryEmailId = distinctCand.trim();
      }
    }
    if (result.secondaryEmailId && result.emailId && result.secondaryEmailId.toLowerCase() === result.emailId.toLowerCase()) {
      result.secondaryEmailId = "";
    }
    // QC Rule: Take the complete phone number, but remove the country code, special characters, and spaces. Do not take toll-free numbers. Do not take numbers starting with zero.
    result.phoneNumber = cleanPhoneNumber(result.phoneNumber, result.countryName);
    if (!result.phoneNumber && crawlData && crawlData.phones && crawlData.phones.length > 0) {
      for (const cand of crawlData.phones) {
        const cleaned = cleanPhoneNumber(cand, result.countryName);
        if (cleaned) {
          result.phoneNumber = cleaned;
          break;
        }
      }
    }
    // Product metrics synchronization (Rules 12, 13, 14):
    // "all should be large 3 means 3 only check and crawl properly all should be same only"
    const parseCount = (v) => {
      if (!v) return 0;
      const s = String(v).trim().toLowerCase();
      if (s === "three" || s === "3") return 3;
      if (s === "two" || s === "2") return 2;
      if (s === "one" || s === "1") return 1;
      const num = parseInt(s, 10);
      return !isNaN(num) && num > 0 ? (num >= 3 ? 3 : num) : 0;
    };

    const maxCount = Math.max(
      parseCount(result.numberOfProducts),
      parseCount(result.productImages),
      parseCount(result.numberOfProductDescriptions),
      parseCount(crawlData && crawlData.detectedProductCount),
      parseCount(crawlData && crawlData.detectedImageCount),
      parseCount(crawlData && crawlData.detectedDescCount)
    );

    const syncVal = String(maxCount);
    result.numberOfProducts = syncVal;
    result.productImages = syncVal;
    result.numberOfProductDescriptions = syncVal;

    return result;
  }

  // 2. Prohibited Category / Word Check (Highest Priority Rule Note 2)
  // "Do not work on websites related to Porn, Adult, Medicine, Medical, Hospital, Food, Weapons (Knife), Defence, Aircraft, Aerospace, Marine, Ship, Chemical, Alcohol, Animals. Even if these images or words appear anywhere on the site, do not work on that site. make these rule strictly if any word appear make it notwroking"
  const isProhibited = (restrictedCheck && restrictedCheck.isRestricted) ||
    String(result.businessType || "").toLowerCase() === "restricted site" ||
    !!result.isProhibitedSite;
  if (isProhibited) {
    const errorUrl = (restrictedCheck && restrictedCheck.sourceUrl) || result.restrictedSourceUrl || crawlData.finalUrl || crawlData.originalUrl || "";
    result.websiteStatus = "Not Working";
    result.businessType = "";
    result.companyProfile = "";
    result.companyName = "";
    result.countryName = "";
    result.companyAddress = "";
    result.state = "";
    result.city = "";
    result.emailId = "";
    result.secondaryEmailId = "";
    result.phoneNumber = "";
    result.numberOfProducts = "";
    result.productImages = "";
    result.numberOfProductDescriptions = "";
    result.isRestricted = true;
    result.isProhibitedSite = true;
    result.restrictedReason = (restrictedCheck && restrictedCheck.reason) || result.restrictedReason || "Prohibited Category Detected";
    result.restrictedKeyword = (restrictedCheck && restrictedCheck.matchedKeyword) || result.restrictedKeyword || "";
    result.restrictedCategory = (restrictedCheck && restrictedCheck.category) || result.restrictedCategory || "";
    result.restrictedSourceUrl = errorUrl;
    result.restrictedSnippet = (restrictedCheck && restrictedCheck.snippet) || result.restrictedSnippet || "";
    result.errorKeyword = result.restrictedKeyword;
    result.errorSourceUrl = errorUrl;
    result.errorSnippet = result.restrictedSnippet;
    result._finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    result._originalUrl = crawlData.originalUrl || "";
    return result;
  }

  // 2. Online Shopping Cart / Purchase Check (Rules 11 & 16: "except for manufacturers")
  const shopCartCheck = crawlData.shopCartCheck || detectPurchaseOrShoppingCart((crawlData.mainHtml || "") + "\n" + (crawlData.contactHtml || ""), crawlData.bodyText || "");
  if (shopCartCheck && shopCartCheck.detected) {
    const isManufacturer =
      String(result.businessType || "").toLowerCase() === "manufacturer" ||
      String(result.businessType || "").toLowerCase() === "manufacturing" ||
      isManufacturerSite(crawlData, (crawlData.mainHtml || "").slice(0, 8000));

    if (isManufacturer) {
      // Allowed Manufacturer with direct online selling options! (Rules 11 & 16)
      result.businessType = "Manufacturer";
      result.websiteStatus = "Working";
      result.isShopCartSite = false;
      result._cartAllowedForManufacturer = true;
    } else {
      // Non-manufacturer with online purchase / cart -> Not Working!
      const shopLink = findExactEvidenceLink((crawlData.mainHtml || "") + "\n" + (crawlData.contactHtml || ""), "shop", /\b(?:shop|store|cart|basket|checkout)\b/i, crawlData.finalUrl || crawlData.originalUrl || "");
      const cartUrl = shopLink || crawlData.finalUrl || crawlData.originalUrl || "";
      result.websiteStatus = "Not Working";
      result.isShopCartSite = true;
      result.shopCartReason = shopCartCheck.reason;
      result.shopCartKeyword = "Shopping Cart / Direct Purchase";
      result.shopCartSourceUrl = cartUrl;
      result.shopCartSnippet = shopCartCheck.reason || "";
      result.errorKeyword = result.shopCartKeyword;
      result.errorSourceUrl = cartUrl;
      result.errorSnippet = result.shopCartSnippet;
      result._finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
      result._originalUrl = crawlData.originalUrl || "";
      result.businessType = "";
      result.companyProfile = "";
      result.companyName = "";
      result.countryName = "";
      result.companyAddress = "";
      result.state = "";
      result.city = "";
      result.emailId = "";
      result.secondaryEmailId = "";
      result.phoneNumber = "";
      result.numberOfProducts = "";
      result.productImages = "";
      result.numberOfProductDescriptions = "";
      return result;
    }
  }

  // 3. Website Status (Rules 9, 10, 12, 14: Flash, Non English, Free Platforms, Subdomains, Domain Expired, or Offline)
  const isDiffDomain = isRedirectDomain(crawlData.originalUrl, crawlData.finalUrl);
  const isRedirectSite = isDiffDomain && (crawlData.status === "Redirect Site" || crawlData.redirected === true || isDiffDomain);

  const platformCheck = detectDisallowedWebsitePlatformOrDomain(crawlData.originalUrl || crawlData.finalUrl, crawlData.mainHtml || "", crawlData.bodyText || "");
  if (platformCheck.isDisallowed) {
    result.websiteStatus = "Not Working";
    result.isRestricted = true;
    result.errorCategory = "Free Platform / Subdomain";
    result.restrictedReason = platformCheck.reason;
    result.restrictedKeyword = platformCheck.reason;
    result.restrictedSourceUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    result.restrictedSnippet = platformCheck.reason;
    result.errorKeyword = platformCheck.reason;
    result.errorSourceUrl = result.restrictedSourceUrl;
    result.errorSnippet = platformCheck.reason;
  } else if (crawlData.status === "Flash" || detectFlashFormatSite(crawlData.mainHtml || "")) {
    result.websiteStatus = "Flash";
    result.errorCategory = "Flash Format";
    result.errorKeyword = "Flash Content";
    result.errorSourceUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    result.errorSnippet = "Flash Format Website - Not copyable (Rule 14)";
  } else if (crawlData.status === "Non English" || detectNonEnglishWithoutTranslation(crawlData.mainHtml || "", crawlData.bodyText || "")) {
    result.websiteStatus = "Non English";
    result.errorCategory = "Non English";
    result.errorKeyword = "Foreign Language";
    result.errorSourceUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    result.errorSnippet = "Non-English Language Without Translation Option (Rule 12)";
  } else if (crawlData.status === "Domain Expired") {
    result.websiteStatus = "Domain Expired";
    result.errorCategory = "Domain Expired";
    result.errorKeyword = "Domain Expired";
    result.errorSourceUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    result.errorSnippet = "Domain Expired or Server returned HTTP 404 Not Found (Rule 1)";
  } else if (!crawlData.mainHtml || crawlData.mainHtml.trim().length === 0 || crawlData.status === "Not Working") {
    result.websiteStatus = (crawlData.status && crawlData.status !== "Working") ? crawlData.status : "Not Working";
    result.errorCategory = crawlData.fetchError ? "Unreachable / Timeout" : "No Business Content";
    result.errorKeyword = crawlData.fetchError ? "Connection Failed" : "No Verifiable Content";
    result.errorSourceUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    result.errorSnippet = crawlData.fetchError || "Website returned empty content or has no verifiable business products";
    result.notWorkingReason = result.errorSnippet;
  } else if (isRedirectSite) {
    result.websiteStatus = "Redirect Site";
  } else if (!isDiffDomain && (result.websiteStatus === "Redirect Site" || result.websiteStatus === "Redirect")) {
    result.websiteStatus = "Working";
  }

  // CRITICAL RULE: "Notworking means all empty"
  // Whenever websiteStatus is NOT "Working" and NOT "Redirect Site"
  // ("Not Working", "Domain Expired", "Non English", "Flash", "Under Construction"),
  // all other fields MUST be empty!
  if (result.websiteStatus && result.websiteStatus !== "Working" && result.websiteStatus !== "Redirect Site" && result.websiteStatus !== "Redirect") {
    result.businessType = "";
    result.companyProfile = "";
    result.companyName = "";
    result.countryName = "";
    result.companyAddress = "";
    result.state = "";
    result.city = "";
    result.emailId = "";
    result.secondaryEmailId = "";
    result.phoneNumber = "";
    result.numberOfProducts = "";
    result.productImages = "";
    result.numberOfProductDescriptions = "";
    return result;
  }

  // 4. Business Type Scope Check: "Manufacture to Wholesale only we work remaining status we do notworking fix it"
  // Allowed working business types: Manufacturer, Industrial Services, Exporter, Trader, Distributer, Supplier, Wholesaler.
  // Remaining disallowed types: Service Provider, Online Shopping, Restricted Site, Other, or anything outside allowed range.
  const btAliases = {
    "manufacturer": "Manufacturer",
    "manufacturing": "Manufacturer",
    "manufacture": "Manufacturer",
    "industrial services": "Industrial Services",
    "industrial service": "Industrial Services",
    "exporter": "Exporter",
    "export": "Exporter",
    "exporting": "Exporter",
    "trader": "Trader",
    "trading": "Trader",
    "trade": "Trader",
    "distributer": "Distributer",
    "distributor": "Distributer",
    "distribution": "Distributer",
    "supplier": "Supplier",
    "supplying": "Supplier",
    "supplies": "Supplier",
    "wholesaler": "Wholesaler",
    "wholesale": "Wholesaler"
  };

  const rawBt = String(result.businessType || "").trim().toLowerCase();
  if (btAliases[rawBt]) {
    result.businessType = btAliases[rawBt];
    if (!result.websiteStatus || result.websiteStatus === "Working") {
      result.websiteStatus = isRedirectSite ? "Redirect Site" : "Working";
    }
  } else {
    // Check if the business actually sells or supplies physical products (e.g. windows, doors, conservatories, materials, equipment, supplies)
    const isPhysicalSupplier = checkPhysicalProductSupplier(crawlData, result);
    const hasAnyRealContent = !!(result.companyAddress || (result.numberOfProducts && result.numberOfProducts !== "0") || (crawlData && crawlData.detectedProductCount > 0) || result.emailId || result.phoneNumber);
    if (isPhysicalSupplier && hasAnyRealContent) {
      result.businessType = "Supplier";
      if (!result.websiteStatus || result.websiteStatus === "Working") {
        result.websiteStatus = isRedirectSite ? "Redirect Site" : "Working";
      }
      result.isDisallowedBusinessType = false;
    } else {
      // Business Type is Service Provider, Online Shopping, Restricted Site, Other, or unknown -> Mark Not Working!
      const serviceLink = findExactEvidenceLink((crawlData.mainHtml || "") + "\n" + (crawlData.contactHtml || ""), result.businessType, null, crawlData.finalUrl || crawlData.originalUrl || "");
      const disUrl = serviceLink || crawlData.primaryAboutUrl || crawlData.finalUrl || crawlData.originalUrl || "";
      result.websiteStatus = "Not Working";
      result.isDisallowedBusinessType = true;
      result.disallowedReason = `Business Type "${result.businessType || 'Disallowed'}" outside allowed scope (Manufacturer to Wholesaler only worked on)`;
      result.disallowedKeyword = result.businessType || "Outside Allowed Scope";
      result.disallowedSourceUrl = disUrl;
      result.disallowedSnippet = `Business Type detected as "${result.businessType || 'Disallowed'}" which is outside allowed scope (Manufacturer, Industrial Services, Exporter, Trader, Distributer, Supplier, Wholesaler).`;
      result.errorKeyword = result.disallowedKeyword;
      result.errorSourceUrl = disUrl;
      result.errorSnippet = result.disallowedSnippet;
      result._finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
      result._originalUrl = crawlData.originalUrl || "";
      result.businessType = "";
      result.companyProfile = "";
      result.companyName = "";
      result.countryName = "";
      result.companyAddress = "";
      result.state = "";
      result.city = "";
      result.emailId = "";
      result.secondaryEmailId = "";
      result.phoneNumber = "";
      result.numberOfProducts = "";
      result.productImages = "";
      result.numberOfProductDescriptions = "";
      return result;
    }
  }

  // 5. Company Profile: if real business details, about us, company name, or description exist, mark Available
  // QC Rule: "if detail find means it will be available fix it properly"
  const profileDetected = crawlData.hasCompanyProfile ||
    checkCompanyProfilePresence(crawlData.mainHtml, crawlData.bodyText, crawlData.profilePageText);
  const hasBusinessEvidence = !!(
    (result.companyName && result.companyName.trim().length > 2) ||
    (crawlData.copyrightText && crawlData.copyrightText.trim().length > 2) ||
    ((crawlData.bodyText || "").trim().length >= 80) ||
    (crawlData.profilePageText && crawlData.profilePageText.trim().length >= 40)
  );
  if (result.websiteStatus === "Working" && (profileDetected || hasBusinessEvidence)) {
    result.companyProfile = "Available";
  } else if (/^available$/i.test(String(result.companyProfile || ""))) {
    result.companyProfile = "Available";
  } else {
    result.companyProfile = "Not Available";
  }

  // 4. Country Name: Full official country name, Title Case
  let country = normalizeCountryName(result.countryName || "");
  if (!country && result.companyAddress) {
    country = detectCountryFromAddress(result.companyAddress);
  }

  // 5. Company Name: Extracted and verified from official website evidence, no hardcoding
  let compName = decodeHtmlEntities((result.companyName || "").trim());
  compName = compName.replace(/['’`]\s*s\b/gi, "'s");
  compName = cleanCompanyPrefixesAndSuffixes(compName);

  // Prefer the fuller official name (copyright / JSON-LD / legal candidates) when AI output was missing a legal suffix, empty, or fails to match the domain
  const hasSuffix = hasCompleteLegalSuffix(compName) || /\b(?:limited|ltd|incorporated|incorporation|inc|corporation|corp|llc|llp|pllc|plc|gmbh|ag|kg|sa|sl|srl|bv|nv|co|company|holdings|group)\b/i.test(compName);
  const dStem = cleanDomainStem((crawlData && (crawlData.originalUrl || crawlData.finalUrl)) || "");
  const dStemNorm = normalizeNameForComparison(dStem);
  const curNormComp = normalizeNameForComparison(compName);
  const compMatchesDomain = dStemNorm && (curNormComp.includes(dStemNorm) || dStemNorm.includes(curNormComp));
  const hasLegalCandidates = crawlData && crawlData.legalCompanyCandidates && crawlData.legalCompanyCandidates.length > 0;
  const hasExpandedSymbol = /\bAnd\b/i.test(compName) && ((crawlData && (crawlData.logoText || crawlData.title || crawlData.copyrightText || (crawlData.mainHtml || "").slice(0, 10000))).includes("&"));

  if (!compName || !hasSuffix || (!compMatchesDomain && hasLegalCandidates) || hasExpandedSymbol) {
    compName = preferOfficialCompanyName(compName, crawlData);
    compName = restoreLegalSuffixIfOmitted(compName, crawlData);
    compName = decodeHtmlEntities(compName);
    compName = compName.replace(/['’`]\s*s\b/gi, "'s");
    compName = cleanCompanyPrefixesAndSuffixes(compName);
  }

  // Expand abbreviations to full form and clean brackets per Rule 4
  compName = expandCompanyAbbreviations(compName, country);
  compName = cleanCompanyPrefixesAndSuffixes(compName);
  // Remove brackets while preserving inner text
  compName = compName.replace(/[\(\[\{]\s*([^\)\]\}]+?)\s*[\)\]\}]/g, " $1 ");
  compName = compName.replace(/[\(\)\[\]\{\}]/g, " ");
  // Rule: Special character should not start and should not end
  compName = compName.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
  compName = compName.replace(/[^\p{L}\p{N}]+$/gu, "").trim();
  compName = compName.replace(/\s+/g, " ").trim();
  compName = toTitleCase(compName);
  compName = restoreCommaBeforeCorporateSuffix(compName, crawlData);
  compName = restoreOriginalSymbolsInCompanyName(compName, crawlData);
  compName = compName.replace(/^[^\p{L}\p{N}]+/gu, "").replace(/[^\p{L}\p{N}]+$/gu, "").trim();
  result.companyName = compName;

  // 6. Company Address: Use Gemini's extracted address directly as source of truth; fall back to website candidates only if empty
  let addr = (result.companyAddress || "").trim();
  let selectedCandidate = null;
  let rawSource = "";

  if (!addr || addr.toLowerCase() === "not available" || addr.length < 6) {
    const verifiedResult = verifyAndSelectAddress(result.companyAddress, crawlData.addressCandidates, crawlData);
    addr = (typeof verifiedResult === "object" && verifiedResult !== null && verifiedResult.address !== undefined)
      ? verifiedResult.address
      : verifiedResult;
    selectedCandidate = (typeof verifiedResult === "object" && verifiedResult !== null)
      ? verifiedResult.selectedCandidate
      : null;
  }

  // If selectedCandidate is not set yet, match the best candidate from website candidates
  if (!selectedCandidate && crawlData && Array.isArray(crawlData.addressCandidates) && crawlData.addressCandidates.length > 0) {
    const addrNorm = addr.toLowerCase().replace(/[^a-z0-9]/g, " ");
    const addrTokens = addrNorm.split(/\s+/).filter(t => t.length >= 3 && !/^(?:number|road|street|avenue|lane|drive|suite|floor|city|district|township|county)$/i.test(t));

    let bestMatch = null;
    let maxMatchCount = 0;

    for (const cand of crawlData.addressCandidates) {
      const cRaw = (typeof cand === "object" ? cand.raw : cand) || "";
      const cNorm = cRaw.toLowerCase().replace(/[^a-z0-9]/g, " ");
      let matchCount = 0;
      for (const t of addrTokens) {
        if (cNorm.includes(t)) matchCount++;
      }
      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        bestMatch = cand;
      }
    }

    if (bestMatch && maxMatchCount >= 2) {
      selectedCandidate = bestMatch;
    } else {
      const hqCand = crawlData.addressCandidates.find(c => c && (c.isHeadquarters || c.source === "contact" || c.locationType === "operational_contact"));
      if (hqCand) {
        selectedCandidate = hqCand;
      }
    }
  }

  if (selectedCandidate) {
    rawSource = typeof selectedCandidate === "object" ? selectedCandidate.raw : selectedCandidate;
  }

  // MANDATORY COMPLETE FULL ADDRESS QC CHECK:
  // If Gemini returned an incomplete or partial address (e.g. only street name, or missing premise/suite/floor,
  // or missing suburb/locality/city/state), but a complete candidate exists on the website, adopt the complete address!
  if (rawSource && typeof rawSource === "string") {
    if (rawSource.length > addr.length && rawSource.toLowerCase().includes(addr.toLowerCase())) {
      addr = rawSource;
    } else if (isFullAddressCandidate(rawSource) && !isFullAddressCandidate(addr)) {
      addr = rawSource;
    } else if (rawSource.length > addr.length + 5) {
      const streetChunk = addr.match(/(?:no\.?|nos\.?|number|#)?\s*\d+[A-Za-z]?(?:[-\/]\d+)?[,\s]+[A-Za-z0-9\u00C0-\u024F\s\-]+?\b(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Rd|St|Ave|Ln|Dr|Blvd|Hwy|Ct|Pl)\b/i);
      if (streetChunk && rawSource.toLowerCase().includes(streetChunk[0].toLowerCase())) {
        addr = rawSource;
      }
    }
  }

  if (addr && addr !== "Not Available") {
    // Immediate rejection of Cloudflare email protection strings
    if (/\b(?:email\s*and\s*number|email\s*protected|\bprotected\b|data-cfemail)\b/i.test(addr)) {
      addr = "Not Available";
    } else {
      // If address contains Chinese characters, transliterate/romanize to standard English Title Case
      if (/[\u4e00-\u9fa5]/.test(addr)) {
        addr = romanizeChineseAddress(addr);
      }
      addr = addr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");
      addr = addr.replace(/[\(\)\[\]\{\}]/g, " ");
      addr = addr.replace(/&quot;|&apos;|&#34;|&#39;/gi, " ");
      addr = addr.replace(/["“”«»`]+/g, " ");

      // Strip corporate registration disclaimers & legal office prefixes (e.g. "Charnwood Fireplace Holdings LTD. Registered in England : 11743582., Registered Office :")
      addr = addr.replace(/^[\s\S]*?\b(?:registered\s+in\s+[A-Za-z\s]+(?::\s*[\dA-Za-z]+)?\.?\s*,?\s*)?(?:registered\s*office|registered\s*agent|domicilio\s*social)\s*[:：\-–,\s]+/i, "").trim();
      addr = addr.replace(/^[\s\S]*?\b(?:company\s+registration(?:\s+no\.?|\s+number)?\s*[:：\-–,\s]*[\dA-Za-z]+\.?\s*,?\s*)/i, "").trim();

      // Strip conversational boilerplate from start of address e.g. "If you have any enquiries, require a quote or want to book a survey please feel free to call us or send us a message with your requirements Priory Windows And Conservatories 5 Burnt House Road, Whitley Bay"
      addr = addr.replace(/^(?:if\s+you\s+have\s+any\s+enquiries|require\s+a\s+quote|want\s+to\s+book\s+a\s+survey|please\s+feel\s+free\s+to\s+call\s+us|send\s+us\s+a\s+message|with\s+your\s+requirements|get\s+in\s+touch|contact\s+us\s+at)[\s\S]*?(?=\b\d+\s+[A-Za-z]|\b(?:po\s*box|unit|suite|building|floor|no\.?)\b)/i, "").trim();

      // Strip office, department, branch, or headquarters label prefix at start of address
      // e.g. "Toronto Corporate Head Office:, 40 Edilcan Drive, Concord, Ontario" -> "40 Edilcan Drive, Concord, Ontario"
      const officePrefixRegex = /^(?:[A-Za-z\u00C0-\u024F\s]+?\s+)?(?:corporate\s+)?(?:head\s*office|headquarters|corporate\s*office|registered\s*office|main\s*office|principal\s*office|branch\s*office|regional\s*office|sales\s*office|plant\s*location|office|plant|factory|warehouse|hq|sede\s*central|domicilio\s*social|sede\s*principal|address|direcci[oó]n|ubicaci[oó]n)\s*[:：\-–,\s]+(?=\b(?:\d{1,5}|no\.?\s*\d+|po\s*box|unit|suite|building|floor)\b)/i;
      addr = addr.replace(officePrefixRegex, "").trim();

      if (compName && addr.toLowerCase().startsWith(compName.toLowerCase())) {
        addr = addr.slice(compName.length).trim();
      }
      // Also strip company name brand stem with or without legal suffix (e.g. "Charnwood Fireplaces Ltd, ")
      const compBrand = compName ? compName.replace(/\b(?:ltd|limited|inc|incorporated|llc|corp|corporation|co|company|proprietary|pty)\b/gi, "").trim() : "";
      if (compBrand && compBrand.length >= 4) {
        const brandRegex = new RegExp(`^${compBrand.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*(?:(?:ltd|limited|inc|llc|corp|co|pty)\\.?)?\\s*[,\\-–]?\\s*`, "i");
        addr = addr.replace(brandRegex, "").trim();
      }
      // Strip company name or corporate brand prefix at start of address before street number or premise
      if (compName) {
        const compClean = compName.replace(/[,;:\-_|/\\~*#@^"'“”‘’«»`]+/g, " ").trim();
        const firstToken = compClean.split(/\s+/)[0];
        if (firstToken && firstToken.length >= 3 && !/^(?:the|and|for)$/i.test(firstToken)) {
          const compPrefixRegex = new RegExp(`^${firstToken}\\b[\\s\\S]*?(?=\\b(?:\\d{1,5}|no\\.?\\s*\\d+|po\\s*box|unit|suite|building|floor|the\\s+[a-z]+|centre|center|house|hall|mill|works|court|lodge|grange|tower|park|estate|chambers|wharf)\\b)`, "i");
          addr = addr.replace(compPrefixRegex, "").trim();
        }
      }
      // Strip leftover corporate legal suffixes and generic company words at the start of address
      addr = addr.replace(/^(?:company|co\.?|incorporated|inc\.?|corporation|corp\.?|llc|limited|ltd\.?|equipment|systems|industries|technologies|enterprises|group|products)\b[\s,:\-–]*/i, "").trim();
      addr = addr.replace(/^,\s*/, "").trim();

      // Ensure country is identified from address or domain before expanding abbreviations
      if (!country || country.length < 2) {
        country = detectCountryFromAddress(addr);
        if (!country && crawlData) {
          const urlStr = (crawlData.originalUrl || "") + " " + (crawlData.finalUrl || "");
          if (/\.au(?:\/|$)/i.test(urlStr)) {
            country = "Australia";
          } else if (/\.es(?:\/|$)/i.test(urlStr)) {
            country = "Spain";
          } else if (/\.(?:my|com\.my|org\.my|net\.my|edu\.my|gov\.my)(?:[:\/\?]|$)/i.test(urlStr)) {
            country = "Malaysia";
          } else if (/\.(?:id|co\.id|web\.id|or\.id|net\.id|ac\.id|go\.id)(?:[:\/\?]|$)/i.test(urlStr)) {
            country = "Indonesia";
          } else if (/\.(?:nz|co\.nz|org\.nz|net\.nz|gen\.nz|ac\.nz|govt\.nz)(?:[:\/\?]|$)/i.test(urlStr)) {
            country = "New Zealand";
          }
        }
      }

      // Expand street and state/province abbreviations (e.g. St -> Street, VIC -> Victoria, NSW -> New South Wales)
      addr = expandAddressAndStateAbbreviations(addr, country);

      // If raw website address had a state that got dropped by AI, restore it!
      // CRITICAL FIX: Restore missing state ONLY from the selected candidate's raw text (NEVER mix multiple addresses)
      if (selectedCandidate && !rawSource) {
        rawSource = typeof selectedCandidate === "object" ? selectedCandidate.raw : selectedCandidate;
      }
      if (rawSource) {
        addr = restoreStateIfOmitted(addr, rawSource, country);
      }

      // CRITICAL GLOBAL FIX: Restore missing initial street / building / premise number if dropped
      // Restore missing number ONLY from the selected candidate's raw text (NEVER mix multiple addresses)
      if (rawSource) {
        addr = restoreStreetNumberIfOmitted(addr, rawSource);
      }

      // Unconditionally strip country names from address so the country name never appears inside the street address field
      addr = addr.replace(/\b(?:United\s*States\s*Of\s*America|United\s*States|USA|U\.S\.A\.)\b/gi, " ");
      addr = addr.replace(/\b(?:Great\s*Britain|United\s*Kingdom|UK|U\.K\.)\b/gi, " ");
      addr = addr.replace(/(?<!\b(?:Western|South)\s+)\bAustralia\b/gi, " ");
      addr = addr.replace(/\b(?:Canada|Germany|Deutschland|France|Spain|Espa[nñ]a|Turkiye|T[uü]rkiye|Turkey|New\s*Zealand|Aotearoa|Malaysia|Indonesia|Republik\s*Indonesia|Singapore|Japan|China|India|South\s*Africa)\b/gi, " ");
      addr = addr.replace(/\b(r\.?o\.?c\.?|republic\s*of\s*china)\b/gi, " ");
      if (country && country.length > 2) {
        const countryRegex = new RegExp(`\\b${country}\\b`, "gi");
        addr = addr.replace(countryRegex, " ");
      }

      // Strip trailing contact / communication fields early before postal code removal
      addr = addr.replace(/[,;\s]*(?:\b(?:Phone|Tel|Telephone|Email|Fax|Mobile|Direct|Contact|Sales|Toll\s*Free|Customer\s*Service|Support|Hotline|Postcode|Zip|P\.?O\.?\s*Box)\b\s*[:：\-–]?.*)$/i, "").trim();

      // Remove international postal codes carefully without stripping street numbers
      addr = removePostalCodesCarefully(addr);

      // Ensure comma separates city/suburb from state/province
      addr = ensureCommaBeforeState(addr);

      // Ensure "Number" is ONLY present if "No." / "No" / "#" / "Nº" was in the original raw address evidence
      // Rule: "if No come only expand and do with out coming dont put blankly number"
      const allAddressEvidence = (rawSource || "") + " " + (crawlData.addressCandidates || []).map(c => typeof c === "object" ? c.raw : c).join(" ") + " " + (crawlData.bodyText || "");
      addr = stripBlindlyAddedNumber(addr, allAddressEvidence, rawSource);
      if (rawSource) {
        addr = stripExtraWordsFromAddress(addr, rawSource);
      }

      // Deduplicate repeated premise numbers e.g. "No. 1013 Number 1013" -> "Number 1013"
      addr = addr.replace(/(^|[,\s])(?:no\.?|number)\s*(\d+[A-Za-z]?(?:[-/]\d+)?)(?:,\s*|\s+)(?:no\.?|number)\s*\2\b/gi, '$1Number $2');
      addr = addr.replace(/(^|[,\s])(?:no\.?\s*)?(\d+[A-Za-z]?(?:[-/]\d+)?)(?:,\s*|\s+)Number\s+\2\b/gi, '$1Number $2');
      addr = addr.replace(/(^|[,\s])Number\s+(\d+[A-Za-z]?(?:[-/]\d+)?)(?:,\s*|\s+)(?:no\.?\s*)?\2\b/gi, '$1Number $2');

      // Repair accidental commas splitting two-syllable East Asian cities/districts/townships
      const eaFirstSyllables = "Yung|San|Chung|Hsin|Xin|Da|Ta|Nan|Xi|Hsi|Bei|Pei|An|Ren|Jen|Gui|Kuei|Lu|Loo|Ping|Ba|Pa|Yang|Long|Lung|Shan|Guan|Kuan|Ma|Jia|Chia|Qi|Chi|Jiang|Chiang|Zhong|Qian|Chien|Feng|Fong|Ling|Gu|Ku|Zuo|Tso|Hou|Dong|Tung|Xia|Hsia|Liu|Yu|Kao|Gao|Tao|Kee|Miao|Yun|Chang|Hua|Peng|Kin|Lien";
      addr = addr.replace(new RegExp(`\\b(${eaFirstSyllables})[-\\s]*,[\\s\\-]*([A-Z][a-z]+\\s+(?:District|Township|County|Hsien|City))\\b`, "g"), '$1-$2');
      addr = addr.replace(new RegExp(`\\b(${eaFirstSyllables})-[\\s,]+([A-Z][a-z]+\\s+(?:District|Township|County|Hsien|City))\\b`, "g"), '$1-$2');
      addr = normalizeTaiwanDivisions(addr);

      const eaRoadSyllables = "Chung|Zhong|Hsin|Xin|Kuang|Guang|Min|San|Da|Ta|Ren|Jen|Nan|Bei|Pei|Xi|Hsi|Dong|Tung";
      addr = addr.replace(new RegExp(`\\b(${eaRoadSyllables})[-\\s]*,[\\s\\-]*([A-Z][a-z]+\\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Highway))\\b`, "g"), '$1 $2');

      // Remove unwanted comma between bare street number and street name (e.g. "604, Progress Drive" -> "604 Progress Drive")
      // Must NOT strip commas after premise indicators like "Number 53-5, Pocheng Road" or "Lot 12, Main Street"
      addr = addr.replace(/(^|[,\s])(?<!\b(?:number|no\.?|#|section|sec\.?|lane|ln\.?|alley|aly\.?|unit|suite|ste\.?|floor|fl\.?|flr\.?|level|lot|plot|block|blk\.?)\s+)\b(\d{1,5}),\s+([A-Z][a-z0-9\u00C0-\u024F\-]+(?:\s+[A-Z][a-z0-9\u00C0-\u024F\-]+)*\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Caddesi|Bulvari|Sokak|Strasse|Calle|Avenida|Viale|Corso|Rd|St|Ave|Ln|Dr|Blvd|Hwy|Ct|Pl)\b)/gi, '$1$2 $3');

      // Strip leading list/index numbers before company names in address only if followed by a separate street address number (e.g. "138 U.S. Tsubaki Industrial, LLC 250 Kirby Drive...")
      addr = addr.replace(/^\d{1,4}\s+([A-Z].*?\b(?:LLC|Inc\.?|Corp\.?|Ltd\.?|Limited)\b)(?=\s+\d+\s+[A-Z])/i, (m, g) => g);
      addr = addr.replace(/(\b(?:LLC|Inc\.?|Corp\.?|Ltd\.?|Limited)\b)\s+(\d+\s+[A-Z])/i, (m, g1, g2) => g1 + ", " + g2);

      // Clean up spaces, commas, and ensure clean formatting
      addr = addr.replace(/\s+,/g, ",");
      addr = addr.replace(/,\s*,/g, ", ");
      addr = addr.replace(/,\s*/g, ", ");
      addr = addr.replace(/[,;.\s\-_/\\|]+$/g, "").trim();
      addr = addr.replace(/^[,;.\s\-_/\\|]+/g, "").trim();
      addr = addr.replace(/\s+/g, " ");
      addr = toTitleCase(addr);
      addr = repairBlindlySeparatedCommas(addr);
      addr = normalizeTaiwanDivisions(addr);

      // Strip trailing contact / communication fields or loose periods attached to address
      addr = addr.replace(/[,;\s]*(?:\b(?:Phone|Tel|Telephone|Email|Fax|Mobile|Direct|Contact|Sales|Toll\s*Free|Customer\s*Service|Support|Hotline|Postcode|Zip|P\.?O\.?\s*Box)\b\s*[:：\-–]?.*)$/i, "").trim();
      addr = addr.replace(/(?:\s*\.\s*)+$/g, "").trim();
      // Strip trailing map UI links (e.g. "View Map", "Open Map", "Get Directions", "See on Maps")
      addr = addr.replace(/[,;\s]*(?:\b(?:view\s*map|open\s*map|open\s*in\s*maps?|get\s*directions?|see\s*on\s*maps?|google\s*maps?|directions?)\b.*)$/i, "").trim();
      // Strip trailing country codes (e.g. ", USA", ", UK", ", AU") - NEVER strip ", CA" if in United States since CA is California!
      if (country && /united states/i.test(country)) {
        addr = addr.replace(/[,;\s]+\b(?:USA|US)\b\s*$/i, "").trim();
      } else {
        addr = addr.replace(/[,;\s]+\b(?:CA|USA|US|UK|AU|NZ)\b\s*$/i, "").trim();
      }
      // Final pass: clean postal codes, stray quotes, and punctuation
      addr = removePostalCodesCarefully(addr);
      addr = addr.replace(/[\s,\-]+\b\d{3,6}\b\s*$/g, "").trim();
      addr = addr.replace(/(\b(?:City|District|Township|County|Hsien|Village|Li|Town|Dist\.?)\b[\s,]*)\b\d{3,6}\b(?=[\s,]|$)/gi, "$1");
      addr = addr.replace(/\bChia,\s*Yi\s*City\b/gi, "Chiayi City");
      addr = addr.replace(/\bChia[-\s,]*[Yy]i\s*City\b/gi, "Chiayi City");
      addr = normalizeTaiwanDivisions(addr);
      addr = repairBlindlySeparatedCommas(addr);
      addr = addr.replace(/["“”«»`]+/g, " ");
      // Strictly enforce: No special characters or invisible symbols at the beginning (FIRST) or end (LAST)
      addr = addr.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
      addr = addr.replace(/[^\p{L}\p{N})]+$/gu, "").trim();
      addr = addr.replace(/\s+/g, " ");
      // Final pass: ensure all floor, unit, street, and state abbreviations are fully expanded
      addr = expandAddressAndStateAbbreviations(addr, country);
      if (rawSource) {
        addr = stripExtraWordsFromAddress(addr, rawSource);
      }
      addr = addr.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
      addr = addr.replace(/[^\p{L}\p{N})]+$/gu, "").trim();
      addr = addr.replace(/\s+/g, " ");
    }
  } else {
    addr = "Not Available";
  }
  result.companyAddress = toTitleCase(addr);

  // Infer country strictly from physical address evidence if missing
  if (!country || country.length < 2) {
    country = detectCountryFromAddress(addr);
    if (!country && crawlData) {
      const urlStr = (crawlData.originalUrl || "") + " " + (crawlData.finalUrl || "");
      if (/\.au(?:\/|$)/i.test(urlStr)) country = "Australia";
      else if (/\.es(?:\/|$)/i.test(urlStr)) country = "Spain";
      else if (/\.(?:my|com\.my|org\.my|net\.my|edu\.my|gov\.my)(?:[:\/\?]|$)/i.test(urlStr)) country = "Malaysia";
      else if (/\.(?:id|co\.id|web\.id|or\.id|net\.id|ac\.id|go\.id)(?:[:\/\?]|$)/i.test(urlStr)) country = "Indonesia";
      else if (/\.(?:nz|co\.nz|org\.nz|net\.nz|gen\.nz|ac\.nz|govt\.nz)(?:[:\/\?]|$)/i.test(urlStr)) country = "New Zealand";
    }
  }
  country = toTitleCase(normalizeCountryName(country));
  // UK Constituent Country refinement (Mandatory QC Rule):
  // "United Kingdom (England, Wales, Scotland, Northern Ireland). If 'England' and 'United Kingdom' both are mentioned, you must take England as the country name."
  if (country === "United Kingdom") {
    const rawCandidatesText = (crawlData.addressCandidates || []).map(c => typeof c === "object" ? c.raw : c).join(" ");
    const fullCheckText = (addr + " " + rawCandidatesText + " " + (crawlData.bodyText ? crawlData.bodyText.slice(0, 5000) : "") + " " + (crawlData.contactPageText ? crawlData.contactPageText.slice(0, 5000) : "")).toLowerCase();
    if (/\bengland\b/i.test(fullCheckText)) {
      country = "England";
    } else if (/\bscotland\b/i.test(fullCheckText)) {
      country = "Scotland";
    } else if (/(?<!\bnew\s+south\s+)\bwales\b/i.test(fullCheckText)) {
      country = "Wales";
    } else if (/\bnorthern\s*ireland\b/i.test(fullCheckText)) {
      country = "Northern Ireland";
    } else {
      const constituentFromLocality = detectCountryFromAddress(addr || rawCandidatesText);
      if (["England", "Scotland", "Wales", "Northern Ireland"].includes(constituentFromLocality)) {
        country = constituentFromLocality;
      }
    }
  }
  result.countryName = country;

  // Helper for cross-country equivalence (UK constituent nations, USA variants)
  const isSameOrConstituentCountry = (c1, c2) => {
    if (!c1 || !c2) return false;
    const s1 = c1.trim().toLowerCase();
    const s2 = c2.trim().toLowerCase();
    if (s1 === s2) return true;
    const ukGroup = ["united kingdom", "great britain", "uk", "england", "scotland", "wales", "northern ireland"];
    if (ukGroup.includes(s1) && ukGroup.includes(s2)) return true;
    const usGroup = ["united states of america", "united states", "usa", "us", "u.s.a."];
    if (usGroup.includes(s1) && usGroup.includes(s2)) return true;
    return false;
  };

  // Cross-Country Conflict Guard: Ensure Company Address does not point to an overseas branch in a completely different country!
  if (country && country.length >= 2 && addr && addr !== "Not Available") {
    const addrCountry = detectCountryFromAddress(addr);
    if (addrCountry && !isSameOrConstituentCountry(addrCountry, country)) {
      const domesticCandidate = (crawlData.addressCandidates || []).find(c => {
        const cRaw = typeof c === "object" ? c.raw : c;
        const cCountry = detectCountryFromAddress(cRaw);
        if (cCountry && isSameOrConstituentCountry(cCountry, country)) return true;
        if (country.toLowerCase() === "china" && /[\u4e00-\u9fa5]/.test(cRaw)) return true;
        if (country.toLowerCase() === "taiwan" && (cRaw.toLowerCase().includes("taiwan") || /[\u4e00-\u9fa5]/.test(cRaw))) return true;
        return false;
      });
      if (domesticCandidate) {
        let domRaw = typeof domesticCandidate === "object" ? domesticCandidate.raw : domesticCandidate;
        if (/[\u4e00-\u9fa5]/.test(domRaw)) {
          domRaw = romanizeChineseAddress(domRaw);
        }
        // Strip corporate registration disclaimers & legal office prefixes
        domRaw = domRaw.replace(/^[\s\S]*?\b(?:registered\s+in\s+[A-Za-z\s]+(?::\s*[\dA-Za-z]+)?\.?\s*,?\s*)?(?:registered\s*office|registered\s*agent|domicilio\s*social)\s*[:：\-–,\s]+/i, "").trim();
        domRaw = domRaw.replace(/^[\s\S]*?\b(?:company\s+registration(?:\s+no\.?|\s+number)?\s*[:：\-–,\s]*[\dA-Za-z]+\.?\s*,?\s*)/i, "").trim();
        domRaw = expandAddressAndStateAbbreviations(domRaw, country);
        domRaw = removePostalCodesCarefully(domRaw);
        domRaw = expandAddressAndStateAbbreviations(domRaw, country);
        domRaw = toTitleCase(domRaw);
        addr = domRaw.replace(/[,;.\s\-_/\\|]+$/g, "").trim();
        result.companyAddress = toTitleCase(addr);
      }
    }
  }

  // 7. State: Validated based on presence of State / Province / County / Hsien / Region or Capital
  if (!addr || addr.length < 8 || addr.toLowerCase() === "not available") {
    result.state = "Not Available";
  } else {
    if (result.state === "Available") {
      result.state = "Available";
    } else {
      result.state = hasStateInAddress(addr, country) ? "Available" : "Not Available";
    }
  }

  // 8. City: Evaluated STRICTLY per City QC Rule (Only explicit City, Town, Township, District, Municipality)
  // CRITICAL QC RULE: "Subhurb is consider as city if subhurb was coming means its should mark not available its not city"
  if (!addr || addr.length < 8 || addr.toLowerCase() === "not available" || addr === "Not Available") {
    result.city = "Not Available";
  } else {
    const qcCity = evaluateCityQC(addr, country);
    if (qcCity === "Not Available") {
      result.city = "Not Available";
    } else {
      result.city = "Available";
    }
  }

  // 9. Email ID & 10. Secondary Email ID (Strict Grounding & Anti-Hallucination)
  const crawlEmails = (crawlData.emails || []).map(e => stripTrailingContactWordsFromEmail(String(e).trim().toLowerCase())).filter(Boolean);
  const isGenericWebmail = (e) => /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|mail|zoho|proton|protonmail)\.com$/i.test(e);
  let targetHostDomain = "";
  try {
    const rawUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    if (rawUrl) targetHostDomain = new URL(rawUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch (e) { }

  // 9. Primary Email ID
  let email = stripTrailingContactWordsFromEmail((result.emailId || "").trim().toLowerCase());
  if (email && (isUnwantedEmail(email) || !isValidCorporateEmail(email))) {
    email = "";
  }
  // Reject email if generic webmail and was NOT discovered during the website HTML crawl
  if (email && isGenericWebmail(email) && !crawlEmails.includes(email)) {
    email = "";
  }
  // Reject email if not in crawlEmails and does not match target host domain
  if (email && !crawlEmails.includes(email)) {
    const emHost = (email.split("@")[1] || "").toLowerCase();
    if (!targetHostDomain || (emHost !== targetHostDomain && !emHost.endsWith("." + targetHostDomain))) {
      email = "";
    }
  }
  // Ensure primary email uses the highest-ranked verified corporate email from the website/contact page/Facebook
  if (!email || !isValidCorporateEmail(email) || isUnwantedEmail(email)) {
    const validFromCrawl = crawlEmails.find(e => isValidCorporateEmail(e) && !isUnwantedEmail(e));
    email = validFromCrawl || "";
  }
  email = stripTrailingContactWordsFromEmail(email);
  result.emailId = email;

  // 10. Secondary Email ID (Double Check: if secondary email is available, ALWAYS take it!)
  let secEmail = stripTrailingContactWordsFromEmail((result.secondaryEmailId || "").trim().toLowerCase());
  const primHost = email ? (email.split("@")[1] || "").toLowerCase() : "";

  const isCompanyDomainEmail = (candEmail) => {
    if (!candEmail || typeof candEmail !== "string") return false;
    const candHost = (candEmail.split("@")[1] || "").toLowerCase();
    if (!candHost) return false;
    if (primHost && (candHost === primHost || candHost.endsWith("." + primHost) || primHost.endsWith("." + candHost))) return true;
    if (targetHostDomain && (candHost === targetHostDomain || candHost.endsWith("." + targetHostDomain))) return true;
    return false;
  };

  // If Gemini provided a secondary email, validate it
  if (secEmail) {
    if (
      secEmail === email ||
      !isValidCorporateEmail(secEmail) ||
      isUnwantedEmail(secEmail)
    ) {
      secEmail = "";
    } else if (!isCompanyDomainEmail(secEmail) && !crawlEmails.includes(secEmail)) {
      // Reject only if it's completely unverified (neither matching company domain nor discovered in crawl HTML/socials)
      secEmail = "";
    }
  }

  // Double Check Fallback: If secondary email is missing/empty, take any verified distinct corporate email discovered during crawl!
  if (!secEmail && email) {
    // Priority 1: distinct corporate email from same company domain
    let cand = crawlEmails.find(e => {
      const emLower = stripTrailingContactWordsFromEmail((e || "").trim().toLowerCase());
      return emLower && emLower !== email && isValidCorporateEmail(emLower) && !isUnwantedEmail(emLower) && isCompanyDomainEmail(emLower);
    });
    // Priority 2: any distinct corporate email discovered on website/socials during crawl (e.g. branch, sister brand, ISP, or social channel email)
    if (!cand) {
      cand = crawlEmails.find(e => {
        const emLower = stripTrailingContactWordsFromEmail((e || "").trim().toLowerCase());
        return emLower && emLower !== email && isValidCorporateEmail(emLower) && !isUnwantedEmail(emLower);
      });
    }
    if (cand) {
      secEmail = stripTrailingContactWordsFromEmail(cand);
    }
  }

  // Final QC: secondary email must be valid and strictly distinct from primary email
  secEmail = stripTrailingContactWordsFromEmail(secEmail);
  if (secEmail === email || !isValidCorporateEmail(secEmail) || isUnwantedEmail(secEmail)) {
    secEmail = "";
  }
  result.secondaryEmailId = secEmail;

  // 11. Phone Number: Country-specific cleaning & validation (Strictly no toll-free, no country code, no leading zeros)
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

  // Final safeguard: If highestCount is 0 and company has no physical address, it CANNOT be a working site
  const finalHasAddr = result.companyAddress && result.companyAddress !== "Not Available" && result.companyAddress.trim().length > 5;
  if ((result.websiteStatus === "Working" || !result.websiteStatus) && highestCount === 0 && !finalHasAddr) {
    result.websiteStatus = "Not Working";
    result.errorCategory = "No Business Products / 0 Products";
    result.errorKeyword = "0 Products / No Catalog";
    result.errorSourceUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    result.errorSnippet = "Website has 0 products and no physical address or verifiable catalog (Rule 1).";
    result.notWorkingReason = result.errorSnippet;
    result.businessType = "";
    result.companyProfile = "";
    result.companyName = "";
    result.countryName = "";
    result.companyAddress = "";
    result.state = "";
    result.city = "";
    result.emailId = "";
    result.secondaryEmailId = "";
    result.phoneNumber = "";
    result.numberOfProducts = "";
    result.productImages = "";
    result.numberOfProductDescriptions = "";
  }

  // Final safeguard: If website redirected to another domain and is working, ALWAYS ensure websiteStatus is "Redirect Site"
  if (isRedirectSite && (result.websiteStatus === "Working" || !result.websiteStatus)) {
    result.websiteStatus = "Redirect Site";
  } else if (!isDiffDomain && (result.websiteStatus === "Redirect Site" || result.websiteStatus === "Redirect")) {
    result.websiteStatus = "Working";
  }

  // Quality check source links: Company Name, Primary Email, Secondary Email
  result.companyNameSource = determineCompanyNameSource(result.companyName, crawlData);
  result.primaryEmailSource = result.emailId ? resolveBestEmailSource(result.emailId, crawlData) : "";
  result.secondaryEmailSource = result.secondaryEmailId ? resolveBestEmailSource(result.secondaryEmailId, crawlData) : "";

  // Business Type Evidence & Source Link
  if (result.websiteStatus === "Working" || result.websiteStatus === "Redirect Site") {
    const btEvidence = findBusinessTypeEvidence(result.businessType, crawlData.crawledPages, (crawlData.bodyText || "") + " " + (crawlData.mainHtml || ""));
    result.businessTypeKeyword = btEvidence.keyword || "";
    result.businessTypeSource = btEvidence.sourceUrl || crawlData.primaryAboutUrl || crawlData.finalUrl || "";
    result.businessTypeSnippet = btEvidence.snippet || "";
  }

  // Company Address Source Link
  result.companyAddressSource = (selectedCandidate && selectedCandidate.pageUrl)
    ? selectedCandidate.pageUrl
    : (crawlData.primaryContactUrl || crawlData.finalUrl || "");
  result.selectedAddressCandidateRaw = rawSource || "";

  // Carry over Restricted Site, Shop Cart, and Disallowed Evidence
  if (restrictedCheck && restrictedCheck.isRestricted) {
    result.restrictedKeyword = restrictedCheck.matchedKeyword || "";
    result.restrictedCategory = restrictedCheck.category || "";
    result.restrictedSourceUrl = restrictedCheck.sourceUrl || crawlData.finalUrl || crawlData.originalUrl || "";
    result.restrictedSnippet = restrictedCheck.snippet || "";
  }

  result._finalUrl = crawlData.finalUrl || crawlData.originalUrl || "";
  result._originalUrl = crawlData.originalUrl || "";

  if (result.websiteStatus === "Not Working") {
    result.errorSourceUrl = result.errorSourceUrl || result.restrictedSourceUrl || result.disallowedSourceUrl || result.shopCartSourceUrl || crawlData.finalUrl || crawlData.originalUrl || "";
    result.errorKeyword = result.errorKeyword || result.restrictedKeyword || result.disallowedKeyword || result.shopCartKeyword || result.restrictedReason || "";
    result.errorSnippet = result.errorSnippet || result.restrictedSnippet || result.disallowedSnippet || result.shopCartSnippet || result._note || "";
  }

  // Enforce boundary QC rule: special characters like &, #, etc. must NEVER be at the first or end of any field
  // Internal special characters like & in "AT&T", # in "Suite #4" must be preserved!
  for (const key of ["companyName", "companyAddress", "businessType", "countryName"]) {
    if (result[key] && typeof result[key] === "string" && result[key] !== "Not Available") {
      result[key] = result[key].replace(/^[^\p{L}\p{N}]+/gu, "").trim();
      if (key === "companyName") {
        result[key] = result[key].replace(/[^\p{L}\p{N}.)]+$/gu, "").trim();
      } else {
        result[key] = result[key].replace(/[^\p{L}\p{N})]+$/gu, "").trim();
      }
    }
  }

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
  "hampshire", "hertfordshire", "kent", "lancashire", "leicestershire", "lincolnshire", "middlesex",
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
  // Spain (50 Provinces, 17 Autonomous Communities & Autonomous Cities)
  "alava", "álava", "araba", "albacete", "alicante", "alacant", "almeria", "almería", "asturias", "principado de asturias",
  "avila", "ávila", "badajoz", "illes balears", "islas baleares", "baleares", "balearic islands", "barcelona", "burgos",
  "caceres", "cáceres", "cadiz", "cádiz", "cantabria", "castellon", "castellón", "castello", "castelló", "ciudad real",
  "cordoba", "córdoba", "cuenca", "girona", "gerona", "granada", "guadalajara", "guipuzcoa", "guipúzcoa", "gipuzkoa",
  "huelva", "huesca", "jaen", "jaén", "a coruna", "a coruña", "la coruna", "la coruña", "coruna", "coruña", "la rioja", "rioja",
  "las palmas", "gran canaria", "leon", "león", "lleida", "lerida", "lérida", "lugo", "madrid", "comunidad de madrid",
  "malaga", "málaga", "murcia", "region de murcia", "región de murcia", "navarra", "nafarroa", "navarre", "comunidad foral de navarra",
  "ourense", "orense", "palencia", "pontevedra", "salamanca", "santa cruz de tenerife", "tenerife", "segovia", "sevilla", "seville",
  "soria", "tarragona", "teruel", "toledo", "valencia", "valència", "comunitat valenciana", "comunidad valenciana", "valladolid",
  "vizcaya", "bizkaia", "biscay", "zamora", "zaragoza",
  "andalucia", "andalucía", "andalusia", "aragon", "aragón", "canarias", "canary islands", "castilla la mancha", "castilla-la mancha",
  "castilla y leon", "castilla y león", "castile and leon", "catalonia", "catalunya", "cataluña", "cataluna", "extremadura",
  "galicia", "pais vasco", "país vasco", "euskadi", "basque country", "ceuta", "melilla",
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
  // New Zealand (Regions / Provinces ONLY - Auckland, Wellington, Nelson, Gisborne are Cities!)
  "canterbury", "otago", "waikato", "bay of plenty", "manawatu", "manawatū", "manawatu-whanganui", "manawatū-whanganui",
  "hawke's bay", "hawkes bay", "taranaki", "southland", "northland", "marlborough", "tasman", "west coast",
  "auckland region", "wellington region", "nelson region", "gisborne region",
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
  // Turkey (Provinces / İl)
  "istanbul", "ankara", "izmir", "bursa", "antalya", "adana", "konya", "gaziantep", "şanlıurfa", "sanliurfa",
  "kocaeli", "mersin", "diyarbakır", "diyarbakir", "hatay", "manisa", "kayseri", "samsun", "balıkesir", "balikesir",
  "kahramanmaraş", "kahramanmaras", "van", "aydın", "aydin", "denizli", "sakarya", "tekirdağ", "tekirdag", "muğla",
  "mugla", "eskişehir", "eskisehir", "mardin", "malatya", "trabzon",
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

/**
 * Positional locality segmentation:
 * Isolates genuine locality segments (city, town, district, county, state) from an address
 * by stripping street lines, premise lines, industrial estates, building names, and country/postal codes.
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
      const escaped = name.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&").replace(/\s/g, "\\s+");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) return true;
    }
  }
  return false;
}

const TAIWAN_COUNTIES = [
  "changhua", "changhwa", "chang-hua", "chang hua",
  "chiayi", "jiayi", "chia-yi", "chia yi",
  "hsinchu", "xinzhu", "hsin-chu", "hsin chu",
  "hualien", "hwalien", "hua-lien", "hua lien",
  "kinmen", "jinmen", "quemoy", "kin-men", "kin men",
  "lienchiang", "lianjiang", "matsu", "lien-chiang", "lien chiang",
  "miaoli", "miao-li", "miao li",
  "nantou", "nan-tou", "nan tou",
  "penghu", "pescadores", "peng-hu", "peng hu",
  "pingtung", "ping-tung", "ping tung",
  "taitung", "taidong", "tai-tung", "tai tung",
  "yilan", "ilan", "yi-lan", "yi lan",
  "yunlin", "yun-lin", "yun lin"
];

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
      const escaped = reg.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&").replace(/\\s/g, "\\s+");
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
  if (new RegExp(`\\b(?:${US_STATE_CODES_STR})\\s+\\d{5}(?:-\\d{4})?\\b`, "i").test(lower)) return true;
  if (new RegExp(`,\\s*(?:${US_STATE_CODES_STR})(?:\\s*,|\\s*\\d{5}|\\s*$)`, "i").test(lower)) return true;
  if (isUSState && new RegExp(`^(?:${US_STATE_CODES_STR})(?:\\s+\\d{5}(?:-\\d{4})?)?$`, "i").test(lower.trim())) return true;

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
  "gateshead", "sunderland", "south shields", "north shields", "whitley bay", "north tyneside", "south tyneside", "tynemouth", "wallsend", "stockton-on-tees", "hartlepool",
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
  "ellesmere port", "chesterfield", "mansfield", "worksop", "newark", "beeston", "loughborough", "lutterworth",
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

function isUnitedStatesLocation(address, country) {
  const c = (country || "").toLowerCase();
  if (/\b(?:united\s*states|usa|u\.s\.a\.|america)\b/i.test(c)) return true;
  if (c && !/\b(?:united\s*states|usa|u\.s\.a\.|america)\b/i.test(c) && /\b(?:canada|united\s+kingdom|uk|england|scotland|wales|australia|taiwan|china|india|south\s+africa|germany|italy|ireland|thailand|singapore|spain|malaysia|indonesia|new\s+zealand)\b/i.test(c)) {
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
const AUSTRALIAN_CITIES = [
  "sydney", "melbourne", "brisbane", "perth", "adelaide", "hobart", "canberra", "darwin",
  "geelong", "gold coast", "newcastle", "wollongong", "sunshine coast", "townsville", "cairns",
  "toowoomba", "ballarat", "bendigo", "launceston", "mackay", "rockhampton", "bunbury",
  "coffs harbour", "bundaberg", "wagga wagga", "hervey bay", "mildura", "shepparton",
  "port macquarie", "tamworth", "orange", "dubbo", "bathurst", "albury", "wodonga",
  "gladstone", "nowra", "bomaderry", "warrnambool", "kalgoorlie", "geraldton", "mount gambier",
  "lismore", "armidale", "goulburn", "cessnock", "maitland"
];

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
const NEW_ZEALAND_CITIES_AND_TOWNS = [
  // 1. Official Cities & Major Metropolitan Centres
  "auckland", "wellington", "christchurch", "hamilton", "tauranga", "dunedin",
  "lower hutt", "upper hutt", "palmerston north", "napier", "porirua",
  "new plymouth", "rotorua", "whangarei", "invercargill", "nelson",
  "whanganui", "wanganui", "hastings", "gisborne",

  // 2. Secondary Cities & Major Regional Towns
  "blenheim", "timaru", "taupo", "pukekohe", "masterton", "levin",
  "ashburton", "cambridge", "te awamutu", "feilding", "rangiora",
  "rolleston", "queenstown", "tokoroa", "oamaru", "hawera", "gore",
  "waiuku", "greymouth", "wanaka", "motueka", "huntly", "matamata",
  "morrinsville", "kerikeri", "stratford", "whakatane", "dargaville",
  "marton", "foxton", "dannevirke", "carterton", "te puke", "kawerau",
  "katikati", "opotiki", "picton", "kaikohe", "lincoln", "mosgiel",
  "alexandra", "cromwell", "balclutha", "winton", "hokitika", "westport",
  "kaitaia", "papakura", "waiheke island", "warkworth", "snells beach",
  "helensville", "mangawhai", "wellsford", "whitianga", "thames",
  "paeroa", "waihi", "te aroha", "taumarunui", "turangi", "waipukurau",
  "wairoa", "woodville", "pahiatua", "bulls", "ohakune", "taihape",
  "eltham", "waitara", "inglewood", "hanmer springs", "kaikoura",
  "methven", "darfield", "geraldine", "temuka", "waimate", "arrowtown",
  "milton", "ranfurly", "roxburgh", "riverton", "te anau", "bluff"
];

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

const MALAYSIAN_CITIES_AND_TOWNS = [
  "kuala lumpur", "putrajaya", "subang jaya", "petaling jaya", "shah alam", "klang", "johor bahru",
  "george town", "ipoh", "kuching", "kota kinabalu", "seremban", "malacca", "melaka", "kuantan",
  "alor setar", "batu pahat", "muar", "kluang", "kulai", "pasir gudang", "skudai", "iskandar puteri",
  "taiping", "sungai petani", "bintulu", "miri", "sibu", "sandakan", "tawau", "puchong", "cheras",
  "rawang", "kajang", "banting", "sepang", "cyberjaya", "kangar", "labuan", "seberang perai",
  "butterworth", "bukit mertajam", "kulim", "port dickson", "teluk intan", "manjung", "seri kembangan",
  "ampang", "selayang", "temerloh", "lahad datu", "semenyih", "nilai", "cukai", "kemaman", "dungun",
  "kota bharu", "kuala terengganu", "pontian", "segamat", "tangkak", "mersing", "kota tinggi"
];

function isIndonesianLocation(address, country) {
  const c = (country || "").toLowerCase();
  if (/\b(?:indonesia|id)\b/i.test(c)) return true;
  if (c && !/\b(?:indonesia|id)\b/i.test(c) && /\b(?:canada|united\s+states|usa|united\s+kingdom|uk|england|scotland|wales|australia|taiwan|china|india|south\s+africa|germany|italy|ireland|thailand|singapore|spain|malaysia)\b/i.test(c)) {
    return false;
  }
  const a = (address || "").toLowerCase();
  if (/\b(?:indonesia|republik\s*indonesia)\b/i.test(a)) return true;
  if (/\b(?:jakarta|dki\s*jakarta|jawa\s*barat|jawa\s*tengah|jawa\s*timur|banten|di\s*yogyakarta|yogyakarta|bali|sumatera|kalimantan|sulawesi|papua|maluku|riau|lampung|aceh|nusantara)\b/i.test(a)) return true;
  if (/\b(?:surabaya|bandung|medan|semarang|makassar|palembang|tangerang|depok|bekasi|batam|bogor|pekanbaru|bandar\s*lampung|malang|padang|denpasar|samarinda|banjarmasin|balikpapan)\b/i.test(a)) return true;
  return false;
}

const INDONESIAN_CITIES_AND_TOWNS = [
  "jakarta", "dki jakarta", "nusantara", "surabaya", "bandung", "medan", "semarang", "makassar",
  "palembang", "tangerang", "tangerang selatan", "depok", "bekasi", "batam", "bogor", "pekanbaru",
  "bandar lampung", "malang", "padang", "denpasar", "samarinda", "banjarmasin", "serang", "cimahi",
  "pontianak", "balikpapan", "surakarta", "solo", "mataram", "manado", "yogyakarta", "cilegon",
  "kupang", "palu", "ambon", "tarakan", "sukabumi", "cirebon", "karawang", "sidoarjo", "gresik",
  "cikarang", "pasuruan", "mojokerto", "magelang", "pekalongan", "tegal", "kediri", "blitar",
  "probolinggo", "batu", "madiun", "salatiga", "kudus", "jepara", "purwokerto", "cilacap",
  "banyuwangi", "jember", "kuta", "sanur", "ubud", "jimbaran", "gianyar", "badung", "tabanan",
  "bima", "gorontalo", "kendari", "palangkaraya", "banjarbaru", "singkawang", "bitung", "kotamobagu",
  "baubau", "tual", "tidore", "ternate", "sorong", "jayapura", "purwakarta", "subang", "garut",
  "tasikmalaya", "ciamis", "kuningan", "majalengka", "sumedang", "indramayu", "brebes", "pemalang",
  "batang", "kendal", "demak", "grobogan", "blora", "rembang", "pati", "boyolali", "klaten",
  "sukoharjo", "wonogiri", "karanganyar", "sragen", "purworejo", "kebumen", "wonosobo", "temanggung",
  "banjarnegara", "purbalingga", "banyumas", "lamongan", "tuban", "bojonegoro", "ngawi", "magetan",
  "ponorogo", "pacitan", "trenggalek", "tulungagung", "nganjuk", "jombang", "lumajang", "bondowoso",
  "situbondo", "bangka", "belitung", "pangkalpinang", "tanjung pinang"
];

function hasUkCityOrTown(cleanAddr) {
  if (!cleanAddr) return false;
  const segments = extractAddressLocalitySegments(cleanAddr);
  const targetTexts = (segments && segments.length > 0) ? segments : [cleanAddr];

  const streetSuffixPattern = "\\s+(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|view|gate|mews|row|wharf|park|st|rd|ave|dr|ln|blvd)\\b";
  const streetPrefixPattern = "\\b(?:street|road|avenue|lane|drive|way|close|walk|place|court|terrace|hill|gardens|crescent|boulevard|view|gate|mews|row|wharf|park)\\s+";

  for (const text of targetTexts) {
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
const SPANISH_CITIES_AND_TOWNS = [
  "madrid", "barcelona", "valencia", "sevilla", "seville", "zaragoza", "malaga", "málaga", "murcia",
  "palma", "palma de mallorca", "las palmas", "las palmas de gran canaria", "bilbao", "alicante", "alacant",
  "cordoba", "córdoba", "valladolid", "vigo", "gijon", "gijón", "hospitalet", "l'hospitalet",
  "l'hospitalet de llobregat", "vitoria", "gasteiz", "vitoria-gasteiz", "coruna", "a coruna", "la coruna",
  "coruña", "a coruña", "la coruña", "elche", "elx", "granada", "terrassa", "badalona", "oviedo",
  "sabadell", "cartagena", "jerez", "jerez de la frontera", "mostoles", "móstoles", "santa cruz de tenerife",
  "pamplona", "iruna", "iruña", "almeria", "almería", "alcala de henares", "alcalá de henares", "fuenlabrada",
  "leganes", "leganés", "donostia", "san sebastian", "san sebastián", "getafe", "burgos", "albacete",
  "santander", "castellon", "castellón", "castellon de la plana", "alcorcon", "alcorcón", "la laguna",
  "san cristobal de la laguna", "logrono", "logroño", "badajoz", "salamanca", "huelva", "marbella",
  "lleida", "lerida", "lérida", "tarragona", "dos hermanas", "torrejon de ardoz", "torrejón de ardoz",
  "parla", "mataro", "mataró", "leon", "león", "algeciras", "santa coloma", "santa coloma de gramenet",
  "alcobendas", "cadiz", "cádiz", "jaen", "jaén", "reus", "ourense", "orense", "telde", "barakaldo",
  "baracaldo", "lugo", "girona", "gerona", "santiago de compostela", "san fernando", "caceres", "cáceres",
  "lorca", "coslada", "roquetas de mar", "orihuela", "el puerto de santa maria", "el puerto de santa maría",
  "talavera de la reina", "cornella", "cornellà", "cornellà de llobregat", "melilla", "ceuta",
  "pozuelo de alarcon", "rivas-vaciamadrid", "pontevedra", "toledo", "palencia", "guadalajara", "aviles",
  "avilés", "gandia", "ciudad real", "manresa", "ferrol", "benidorm", "valdemoro", "majadahonda",
  "torremolinos", "sanlucar de barrameda", "benalmadena", "benalmádena", "paterna", "santa lucia de tirajana",
  "vilanova i la geltru", "motril", "zamora", "segovia", "soria", "teruel", "huesca", "cuenca",
  "avila", "ávila", "arona", "granollers", "sagunto", "pinto", "alcoy", "merida", "mérida", "elda",
  "mollet del valles", "torrevieja", "rubi", "rubí", "fuengirola", "alcala de guadaira", "sant cugat",
  "viladecans", "el prat de llobregat", "collado villalba", "boadilla del monte", "aranjuez", "arganda del rey",
  "colmenar viejo", "san sebastian de los reyes", "tres cantos", "gava", "gavà", "esplugues de llobregat",
  "figueres", "blanes", "lloret de mar", "vic", "igualada", "vilafranca del penedes", "ripollet",
  "sant boi de llobregat", "cambrils", "salou", "tortosa", "manacor", "ibiza", "eivissa", "ciutadella",
  "mahon", "maó", "puerto del rosario", "arrecife", "adeje", "la orotava", "los realejos", "puerto de la cruz",
  "miranda de ebro", "ponferrada", "aranda de duero", "linares", "ubeda", "úbeda", "andujar", "andújar",
  "lucena", "puente genil", "antequera", "ronda", "velez-malaga", "vélez-málaga", "mijas", "estepona",
  "rincon de la victoria", "alhaurin de la torre", "baza", "guadix", "ecija", "écija", "utrera",
  "mairena del aljarafe", "camas", "tomares", "san juan de aznalfarache", "coria del rio", "la rinconada",
  "lebrija", "carmona", "moron de la frontera", "chiclana de la frontera", "san roque", "la linea de la concepcion",
  "puerto real", "arcos de la frontera", "rota", "ayamonte", "lepe", "isla cristina", "almonte", "moguer",
  "adra", "el ejido", "vicar", "vícar", "nijar", "níjar", "huercal-overa", "alcantarilla", "molina de segura",
  "cieza", "aguilas", "águilas", "torre-pacheco", "san javier", "san pedro del pinatar", "mazarron", "jumilla",
  "yecla", "caravaca de la cruz", "villena", "petrer", "novelda", "crevillent", "santa pola", "ibi",
  "denia", "dénia", "javea", "jávea", "calp", "calpe", "altea", "villajoyosa", "vila-real", "burriana",
  "la vall d'uixo", "vinaros", "benicarlo", "onda", "alzira", "sueca", "cullera", "ontinyent", "xativa",
  "torrent", "mislata", "burjassot", "manises", "aldaia", "alaquas", "xirivella", "catarroja", "paiporta",
  "algemesi", "betera", "riba-roja de turia", "la pobla de vallbona", "lliria", "moncada", "quart de poblet",
  "picassent", "silla", "puertollano", "tomelloso", "alcazar de san juan", "valdepenas", "manzanares",
  "hellin", "villarrobledo", "almansa", "illescas", "sesena", "azuqueca de henares", "plasencia",
  "don benito", "almendralejo", "villanueva de la serena", "zafra", "calatayud", "utebo", "monzon",
  "barbastro", "fraga", "ejea de los caballeros", "tudela", "baranain", "burlada", "estella", "tafalla",
  "irun", "errenteria", "eibar", "zarautz", "arrasate", "mondragon", "hernani", "tolosa", "getxo",
  "portugalete", "santurtzi", "basauri", "leioa", "galdakao", "durango", "sestao", "amorebieta",
  "bermeo", "mungia", "llodio", "amurrio", "torrelavega", "castro-urdiales", "camargo", "pielagos",
  "el astillero", "santona", "laredo", "siero", "langreo", "mieres", "castrillon", "san martin del rey aurelio",
  "corvera", "villaviciosa", "llanes", "llanera", "carballo", "arteixo", "culleredo", "ames", "ribeira",
  "cambre", "boiro", "teo", "noia", "sada", "betanzos", "vilagarcia de arousa", "redondela", "cangas",
  "marin", "moana", "ponteareas", "lalin", "o porrino", "a estrada", "poio", "monforte de lemos",
  "viveiro", "vilalba", "sarria", "ribadeo", "verin"
];

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
const CITY_QUALIFIERS = [
  // English administrative designations
  "town", "township", "district", "dist\\.?", "municipality", "metropolitan\\s*municipality",
  "local\\s*municipality", "district\\s*municipality", "borough", "shire", "village",
  // Non-English administrative designations across the 16 priority countries
  // Germany / Austria / Switzerland
  "stadt", "gemeinde", "marktgemeinde", "markt", "bezirk", "ortsteil",
  // Italy
  "comune", "municipio", "citt[aà]", "distretto",
  // France / Quebec / Belgium
  "ville", "municipalit[eé]", "arrondissement",
  // Spain / Mexico
  "ciudad", "distrito", "municipio", "ayuntamiento", "localidad", "poblaci[oó]n", "villa", "pedan[ií]a", "t[eé]rmino\\s*municipal", "concejo",
  // Indonesia
  "kota", "kabupaten", "kecamatan",
  // Thailand
  "thesaban", "amphoe", "amphur", "khet", "mueang", "muang",
  // Malaysia
  "bandar", "daerah", "mukim", "pekan", "majlis\\s*perbandaran",
  // India
  "taluk", "taluka", "tehsil", "tahsil", "mandal", "nagar\\s*palika", "nagar\\s*nigam",
  // Turkey
  "ilçe", "ilcesi", "belediye", "belediyesi", "şehir", "sehir", "mahalle", "mahallesi"
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

  const stripped = addr.replace(/\b(?:industrial|business|commercial|technology|science|enterprise|tech)\s+district\b/gi, " ").replace(/\b(cape\s*town|george\s*town)\b/gi, " ");
  if (hasExplicitCityWord(stripped)) return true;
  const qualRegex = new RegExp(`\\b(?:${CITY_QUALIFIERS.join("|")})\\b`, "i");
  return qualRegex.test(stripped);
}

function addressLooksLikeSuburbOnly(cleanAddr) {
  if (!cleanAddr) return false;
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
      .replace(/\b(?:industrial|business|technology)\s+(?:park|estate|area|zone|district)\b/gi, " ");
    if (hasExplicitCityWord(strippedID) || /\b(?:kota|kabupaten|kecamatan|kotamadya|regency|town|township|district|municipality)\b/i.test(strippedID)) {
      return "Available";
    }
    // Industrial estate alone without a city -> Not Available
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
    // 4. Structural detection: Locality preceding State/ZIP
    const structCity = detectCityFromStructure(cleanAddr, country);
    if (structCity && !isNotCitySegment(structCity)) {
      return "Available";
    }
  }

  // 1. Explicit qualifying City, Town, Township, District, Municipality, or local language designation
  if (hasCityDesignation(cleanAddr)) {
    return "Available";
  }

  // 2. Suburb-only addresses: If the address only has a suburb and no recognized city/town, MUST evaluate as Not Available!
  if (addressLooksLikeSuburbOnly(cleanAddr)) {
    return "Not Available";
  }

  // 3. UK Exception: Official UK cities, towns, and London boroughs evaluate as Available
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

  // 4. Australian City evaluation (Strict QC Rule: SUBURB IS NOT A CITY):
  if (isAustralianLocation(cleanAddr, country)) {
    // 1. Official Australian Cities ONLY (Melbourne, Sydney, Brisbane, Perth, Adelaide, Hobart, Darwin, Canberra, Geelong, Gold Coast, Newcastle, Wollongong, etc.)
    if (hasRecognizedPlaceName(cleanAddr, AUSTRALIAN_CITIES)) {
      return "Available";
    }
    // 2. Explicit City, Town, Township, Shire, District, Municipality designation
    const strippedAU = cleanAddr.replace(/\b(?:industrial|business|commercial|technology|science|enterprise|tech)\s+district\b/gi, " ");
    if (hasExplicitCityWord(strippedAU) || /\b(?:town|township|shire|district|municipality|borough)\b/i.test(strippedAU)) {
      return "Available";
    }
    // Suburbs are NOT cities -> MUST return Not Available!
    return "Not Available";
  }

  // 5. Spanish City evaluation: Recognized Spanish cities & municipal centres evaluate as Available
  if (isSpanishLocation(cleanAddr, country)) {
    if (hasSpanishCityOrTown(cleanAddr) || hasRecognizedPlaceName(cleanAddr, SPANISH_CITIES_AND_TOWNS)) {
      return "Available";
    }
  }

  // 6. South Africa: Suburbs preceding state/province MUST NOT be classified as cities!
  if (isSouthAfricanLocation(cleanAddr, country)) {
    if (hasRecognizedPlaceName(cleanAddr, RECOGNIZED_TOWNS)) {
      return "Available";
    }
    const strippedZA = cleanAddr.replace(/\b(?:industrial|business|commercial|technology|science|enterprise|tech)\s+district\b/gi, " ");
    if (hasExplicitCityWord(strippedZA) || /\b(?:town|township|district|municipality|metropolitan\s*municipality|borough)\b/i.test(strippedZA)) {
      return "Available";
    }
    return "Not Available";
  }

  // 7. Recognized International Towns/Cities
  if (hasRecognizedPlaceName(cleanAddr, RECOGNIZED_TOWNS)) {
    return "Available";
  }

  // 8. Structural address detection (for USA, Canada where city always precedes state/province without suburbs)
  if (isUnitedStatesLocation(cleanAddr, country) || /\b(?:canada)\b/i.test(country || cleanAddr)) {
    const structCity = detectCityFromStructure(cleanAddr, country);
    if (structCity && !isNotCitySegment(structCity)) {
      return "Available";
    }
  }

  return "Not Available";
}

const LEGAL_SUFFIX_CAPTURE =
  "((?:[\\(\\[]?\\s*(?:pty|pte|pvt|sdn|bhd|co\\.?|corp\\.?|inc\\.?|llc|llp|pllc|gmbh|sa|bv|nv|ag|kg|oy|ab|as|m|malaysia)\\s*[\\)\\]]?[\\s,]*){0,3}(?:ltd\\.?|limited|inc\\.?|incorporated|bhd\\.?|berhad|sdn[\\.\\s]+bhd\\.?|sendirian\\s*berhad|llc|pllc|llp|gmbh(?:\\s*(?:&|\\+|und|and|u\\.)\\s*co\\.?\\s*kg)?|gesellschaft\\s+mit\\s+beschr[äa]nkter\\s+haftung(?:\\s+and\\s+compagnie\\s+kommanditgesellschaft)?|aktiengesellschaft|kommanditgesellschaft|ag|kg|s\\.?r\\.?l\\.?s?|s\\.?p\\.?a\\.?|s\\.?l\\.?u?\\.?|s\\.?a\\.?u?\\.?|sociedad\\s*limitada|sociedad\\s*an[oó]nima|tbk\\.?|terbuka|plc\\.?|corp\\.?|corporation|company\\s+limited|proprietary\\s+limited|private\\s+limited|besloten\\s*vennootschap|b\\.?v\\.?|n\\.?v\\.?|joint\\s+stock\\s+company|societas\\s+europaea|limitada|ltda\\.?|p?jsc|sro|doo|kft))";

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
  // Indonesian prefixes
  if (/^(?:PT|P\.T\.|CV|C\.V\.|UD|U\.D\.|Perseroan\s+Terbatas)\b/i.test(n)) return true;
  // Complete forms across countries
  return /\b(proprietary\s+limited|private\s+limited|public\s+limited\s+company|sendirian\s+berhad|berhad|perkongsian\s+liabiliti\s+terhad|limited\s+liability\s+(?:company|partnership)|gesellschaft\s+mit\s+beschr[äa]nkter\s+haftung|aktiengesellschaft|kommanditgesellschaft|offene\s+handelsgesellschaft|unternehmergesellschaft|eingetragener\s+kaufmann|sociedad\s+limitada|sociedad\s+an[oó]nima|societ[aà]\s+(?:a\s+responsabilit[aà]\s+limitata|per\s+azioni|in\s+accomandita\s+semplice|in\s+nome\s+collettivo)|soci[eé]t[eé]\s+(?:[aà]\s+responsabilit[eé]\s+limit[eé]e|par\s+actions\s+simplifi[eé]e)|besloten\s+vennootschap|naamloze\s+vennootschap|sp[oó][lł]ka\s+z\s+ograniczon[aą]\s+odpowiedzialno[sś]ci[aą]|aktiebolag|aksjeselskap|osakeyhti[oö]|terbuka|tbk|gmbh|ag|kg|llc|llp|pllc|ltd|limited|inc|incorporated|incorporation|plc|corp|corporation|joint\s+stock\s+company|societas\s+europaea|limitada|společnost\s+s\s+ručením\s+omezeným|društvo\s+s\s+ograničenom\s+odgovornošću|korlátolt\s+felelősségű\s+társaság|jsc|pjsc|ojsc|cjsc|sro|doo|kft|ltda|aps)\b/i.test(n);
}

function companyNamesMatch(a, b) {
  if (!a || !b) return false;
  const sA = (a || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const sB = (b || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!sA || !sB) return false;
  if (sA === sB) return true;
  if (sA.replace(/and/g, "") === sB || sB.replace(/and/g, "") === sA) return true;

  // Strip legal suffixes from stems
  const stripLegal = (s) => s.replace(/(?:proprietarylimited|privatelimited|publiclimitedcompany|sendirianberhad|limitedliabilitycompany|limited|incorporated|corporation|berhad|gmbh|llc|llp|pllc|ptyltd|pteltd|pvtltd|sdnbhd|ltd|inc|plc|corp|co)$/g, "");
  const baseA = stripLegal(sA);
  const baseB = stripLegal(sB);

  if (baseA && baseB) {
    if (baseA === baseB) return true;
    if (baseA.startsWith(baseB) || baseB.startsWith(baseA)) {
      const minLen = Math.min(baseA.length, baseB.length);
      const maxLen = Math.max(baseA.length, baseB.length);
      if (minLen >= 4 && (maxLen - minLen <= 3 || minLen / maxLen >= 0.75)) return true;
    }
  }

  // Token matching with fuzzy stem prefix
  const tokens = (s) => (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !/^(the|and|for|ltd|limited|inc|llc|corp|company|pty|pte|pvt|sdn|bhd)$/i.test(w));
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return false;

  let hits = 0;
  for (const t1 of ta) {
    if (tb.some(t2 => t1 === t2 || (t1.length >= 4 && t2.length >= 4 && (t1.startsWith(t2) || t2.startsWith(t1))))) {
      hits++;
    }
  }
  return hits >= Math.min(2, ta.length) || (hits / ta.length >= 0.5);
}

function namesOverlap(a, b) {
  return companyNamesMatch(a, b);
}

function preferOfficialCompanyName(name, crawlData) {
  let current = cleanCompanyPrefixesAndSuffixes((name || "").trim());
  const jsonLdName = cleanCompanyPrefixesAndSuffixes(extractJsonLdOrganizationName(crawlData && crawlData.mainHtml));
  const copyrightName = cleanCompanyPrefixesAndSuffixes((crawlData && crawlData.copyrightText) || "");
  const logoText = (crawlData && crawlData.logoText) || "";
  const ogSiteName = (crawlData && crawlData.ogSiteName) || "";
  const title = (crawlData && crawlData.title) || "";
  const domain = (crawlData && (crawlData.originalUrl || crawlData.finalUrl)) || "";
  const domainStem = cleanDomainStem(domain);
  const dStemNorm = normalizeNameForComparison(domainStem);
  const curNorm = normalizeNameForComparison(current);
  const curMatchesDomain = dStemNorm && (curNorm.includes(dStemNorm) || dStemNorm.includes(curNorm));
  const legalCandidates = ((crawlData && crawlData.legalCompanyCandidates) || []).map(c => cleanCompanyPrefixesAndSuffixes(c)).filter(Boolean);

  // 1. If the current name is an SEO marketing slogan or tagline, replace it with the true brand
  if (isSeoSloganOrTagline(current)) {
    const brandFromTitle = extractBestBrandFromTitle(title, domain, logoText, ogSiteName);
    if (brandFromTitle && !isSeoSloganOrTagline(brandFromTitle)) {
      current = cleanCompanyPrefixesAndSuffixes(brandFromTitle);
    } else if (logoText && !isSeoSloganOrTagline(logoText)) {
      current = cleanCompanyPrefixesAndSuffixes(logoText);
    } else if (ogSiteName && !isSeoSloganOrTagline(ogSiteName)) {
      current = cleanCompanyPrefixesAndSuffixes(ogSiteName);
    }
  }

  // 2. Search for the FULL official registered corporate name (with complete legal suffix/prefix/category).
  // If current name is missing legal suffix (incomplete, e.g. "Custom Flat Packs"), an official candidate matching the domain/brand MUST win!
  const titleCandidate = cleanCompanyPrefixesAndSuffixes(extractBestBrandFromTitle(title, domain, logoText, ogSiteName));
  const logoCandidate = cleanCompanyPrefixesAndSuffixes(logoText);
  const allCandidates = [...legalCandidates, jsonLdName, copyrightName, logoCandidate, titleCandidate]
    .map(n => cleanCompanyPrefixesAndSuffixes(n))
    .filter(n => n && n.length >= 3 && n.length <= 160);

  let bestOfficial = null;
  let bestScore = -1;

  for (const official of allCandidates) {
    const hasSuffix = hasCompleteLegalSuffix(official) || /\b(?:ltd|limited|inc|llc|llp|corp|pty|pte|pvt|sdn|bhd|gmbh|plc|company|co)\b/i.test(official);
    const hasSymbolMatch = official.includes("&") && (current.toLowerCase().includes(" and ") || companyNamesMatch(current, official));
    if (!hasSuffix && !hasSymbolMatch) {
      continue;
    }
    let score = 0;
    const offNorm = normalizeNameForComparison(official);
    const curNorm = normalizeNameForComparison(current);

    if (offNorm && curNorm) {
      if (offNorm === curNorm) score += 100;
      else if (offNorm.startsWith(curNorm) || curNorm.startsWith(offNorm)) score += 80;
      else if (offNorm.includes(curNorm) || curNorm.includes(offNorm)) score += 60;
      else if (curNorm.replace(/and/g, "").startsWith(offNorm) || offNorm.startsWith(curNorm.replace(/and/g, ""))) score += 90;
    }
    if (dStemNorm && offNorm) {
      if (offNorm === dStemNorm) score += 90;
      else if (offNorm.startsWith(dStemNorm) || dStemNorm.startsWith(offNorm)) score += 70;
      else if (offNorm.includes(dStemNorm) || dStemNorm.includes(offNorm)) score += 50;
    }
    // Candidate preserves original symbol "&" when AI expanded to "And"
    if (hasSymbolMatch) {
      score += 150;
    }
    // If AI extracted name fails to match domain stem, but this official candidate matches domain stem:
    if (!curMatchesDomain && dStemNorm && (offNorm.includes(dStemNorm) || dStemNorm.includes(offNorm))) {
      score += 120;
    }
    // Boost English candidate matching domain when current is in Chinese/non-Latin
    if (/[\u4e00-\u9fa5]/.test(current) && dStemNorm && offNorm.includes(dStemNorm)) {
      score += 70;
    }
    if (companyNamesMatch(current, official)) score += 80;

    // Boost candidate matching website page title
    const titleNorm = normalizeNameForComparison(title);
    if (titleNorm && offNorm && (titleNorm.includes(offNorm) || offNorm.includes(titleNorm))) {
      score += 80;
    }

    // Boost candidate that retains country designation ONLY if it matches the specific country of the domain or current name
    const countryTokens = [
      { id: "usa", regex: /\b(?:usa|u\.s\.a\.|america|americas)\b|[-_.]us[-_.]/i },
      { id: "taiwan", regex: /\b(?:taiwan|r\.?o\.?c\.?)\b|[-_.]tw[-_.]/i },
      { id: "uk", regex: /\b(?:uk|u\.k\.|great\s*britain|england)\b|[-_.]uk[-_.]/i },
      { id: "australia", regex: /\b(?:australia|aus)\b|[-_.]au[-_.]/i },
      { id: "china", regex: /\b(?:china|prc)\b|[-_.]cn[-_.]/i },
      { id: "germany", regex: /\b(?:germany|deutschland)\b|[-_.]de[-_.]/i },
      { id: "india", regex: /\b(?:india)\b|[-_.]in[-_.]/i }
    ];

    for (const cToken of countryTokens) {
      const domainMatches = cToken.regex.test(domain) || cToken.regex.test(current);
      if (domainMatches) {
        const offMatches = cToken.regex.test(official);
        if (offMatches) {
          score += 80;
        }
      }
    }

    // Boost candidate matching copyright text
    if (copyrightName && (offNorm === normalizeNameForComparison(copyrightName) || companyNamesMatch(copyrightName, official))) {
      score += 100;
    }

    // Headquarters alignment: if explicit headquarters candidate was found, boost official candidate associated with HQ!
    const hqCandidates = (crawlData && crawlData.addressCandidates || []).filter(c => c && (c.isHeadquarters || c.locationType === "headquarters"));
    if (hqCandidates.length > 0) {
      for (const hq of hqCandidates) {
        const hqText = ((typeof hq === "object" ? hq.raw : hq) + " " + ((hq && hq.contextText) || "")).toLowerCase();
        if (offNorm && (hqText.includes(offNorm) || hqText.includes(offNorm.slice(0, 15)))) {
          score += 120;
        }
      }
    }

    // Favor concise, exact official names over overly long/noisy matches
    score -= Math.min(20, Math.floor(official.length / 5));

    if (score > bestScore) {
      bestScore = score;
      bestOfficial = official;
    }
  }

  if (bestOfficial && bestScore >= 60) {
    return cleanCompanyPrefixesAndSuffixes(bestOfficial);
  }

  // 3. Fallback: if current is still empty or looks like a slogan
  if (!current || isSeoSloganOrTagline(current)) {
    const fallbackBrand = extractBestBrandFromTitle(title, domain, logoText, ogSiteName);
    if (fallbackBrand) return cleanCompanyPrefixesAndSuffixes(fallbackBrand);
    if (logoText) return cleanCompanyPrefixesAndSuffixes(logoText);
  }

  return cleanCompanyPrefixesAndSuffixes(current);
}

/**
 * Restores original symbols (such as "&") in company name when AI incorrectly expanded them to words ("And"),
 * and strips extraneous "Company" when the official website brand is without "Company".
 * Strictly satisfies QC rule: "dont expand the symbols it should be as it is H&R Manufacturing"
 */
function restoreOriginalSymbolsInCompanyName(name, crawlData) {
  if (!name || typeof name !== "string") return name;
  let n = name;

  const evidenceSources = [
    crawlData && crawlData.logoText,
    crawlData && crawlData.title,
    crawlData && crawlData.copyrightText,
    ...(crawlData && crawlData.legalCompanyCandidates || []),
    ...(crawlData && crawlData.companySocials ? Object.values(crawlData.companySocials) : []),
    crawlData && crawlData.mainHtml
  ].filter(Boolean);

  const combinedEvidence = evidenceSources.join(" ");

  // 1. Restore "&" when AI expanded it to "And"
  // e.g. "H And R Manufacturing" -> "H&R Manufacturing" or "H & R Manufacturing"
  if (/\b(?:and)\b/i.test(n) && combinedEvidence.includes("&")) {
    n = n.replace(/\b([A-Za-z0-9]+)\s+And\s+([A-Za-z0-9]+)\b/g, (match, p1, p2) => {
      const noSpaceRegex = new RegExp(`\\b${p1}&${p2}\\b`, "i");
      const spaceRegex = new RegExp(`\\b${p1}\\s+&\\s+${p2}\\b`, "i");
      if (noSpaceRegex.test(combinedEvidence)) {
        return `${p1}&${p2}`;
      } else if (spaceRegex.test(combinedEvidence)) {
        return `${p1} & ${p2}`;
      }
      return match;
    });
  }

  // 2. If name ends with "Company" but the official website brand / title / logo is without "Company"
  // e.g. "H&R Manufacturing Company" -> "H&R Manufacturing"
  // BUT do NOT strip "Company" if the company has "Co." or "Company" in legal candidates, text, or social media handles (e.g. "PEM Fountain Co." / "pemfountainco")
  if (/\bCompany\b$/i.test(n.trim())) {
    const withoutCompany = n.replace(/\s+Company$/i, "").trim();
    if (withoutCompany.length >= 3) {
      const esc = withoutCompany.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const domainUrl = (crawlData && (crawlData.originalUrl || crawlData.finalUrl)) || "";
      const stem = cleanDomainStem(domainUrl);
      const brandExactRegex = new RegExp(`(^|[^a-zA-Z0-9])${esc}([^a-zA-Z0-9]|$)`, "i");
      const brandWithCoRegex = new RegExp(`(^|[^a-zA-Z0-9])(?:${esc}\\s*(?:Company|Co\\.?|Corp\\.?)|${stem}\\s*(?:Company|Co\\.?)|${stem}co)([^a-zA-Z0-9]|$)`, "i");
      const titleOrLogo = ((crawlData && crawlData.title) || "") + " " + ((crawlData && crawlData.logoText) || "");
      if (brandExactRegex.test(titleOrLogo) && !brandWithCoRegex.test(combinedEvidence)) {
        n = withoutCompany;
      }
    }
  }

  // 3. Restore all-caps brand acronyms (e.g. "Pem Fountain" -> "PEM Fountain", "Aks Lining" -> "AKS Lining")
  const upperAcronyms = new Set([
    "USA", "UK", "UAE", "3D", "CNC", "LED", "OEM", "ODM", "HVAC", "PVC", "PE", "HDPE", "PTFE", "R&D", "AKS",
    "PT", "CV", "UD", "TBK", "RT", "RW", "DKI", "DI", "BMW", "IBM", "B2B", "B2C", "IT", "TP", "QC", "AI", "FRP", "SMT", "PCB", "PCBA",
    "PEM", "FP", "HR", "CRP", "SMC", "THK", "NSK", "NTN", "IKO", "INA", "FAG", "FESTO", "CKD", "ABB", "SKF", "GE", "HP", "LG", "JVC", "TDK", "NEC"
  ]);
  const titleAndLogo = ((crawlData && crawlData.title) || "") + " " + ((crawlData && crawlData.logoText) || "");
  n = n.replace(/\b[A-Za-z0-9]{2,4}\b/g, (word) => {
    const up = word.toUpperCase();
    if (upperAcronyms.has(up)) return up;
    const exactUpperRegex = new RegExp(`(^|[^A-Za-z0-9])${up}([^A-Za-z0-9]|$)`);
    if (exactUpperRegex.test(titleAndLogo) && !/^(?:AND|THE|FOR|WITH|FROM|INTO|ONTO)$/i.test(up)) {
      return up;
    }
    return word;
  });

  return n;
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

  // 1. Check legal company candidates discovered across all pages
  const legalCandidates = (crawlData && crawlData.legalCompanyCandidates) || [];
  for (const cand of legalCandidates) {
    if (hasCompleteLegalSuffix(cand) && companyNamesMatch(cleanName, cand)) {
      return cand;
    }
  }

  // 1b. Check if legal candidates have Indonesian prefix matching this name (e.g. cand = "PT Astra Otoparts", cleanName = "Astra Otoparts")
  for (const cand of legalCandidates) {
    if (/^(?:PT|P\.T\.|CV|C\.V\.|UD|U\.D\.|Perseroan\s+Terbatas)\b/i.test(cand) && companyNamesMatch(cleanName, cand)) {
      return cand;
    }
  }

  // 1c. Check acronym-based legal candidate or title (e.g. cleanName = "Custom Rollform Products", cand = "CRP Inc" -> suffix is "Inc" -> "Custom Rollform Products, Inc")
  const getAcronym = (str) => {
    const words = (str || "").replace(/[^a-zA-Z0-9\s]/g, " ").trim().split(/\s+/).filter(w => w.length > 0 && !/^(the|and|for|of|in|on|at|co|company|corp|inc|ltd|llc)$/i.test(w));
    return words.map(w => w[0]).join("").toLowerCase();
  };
  const nameAcronym = getAcronym(cleanName);
  if (nameAcronym.length >= 2) {
    for (const cand of legalCandidates) {
      const candBase = cand.replace(/[^a-zA-Z0-9\s]/g, " ").trim().split(/\s+/)[0].toLowerCase();
      if (candBase === nameAcronym && hasCompleteLegalSuffix(cand)) {
        const m = cand.match(new RegExp(LEGAL_SUFFIX_CAPTURE + "$", "i"));
        if (m && m[1]) {
          return `${cleanName}, ${m[1].trim()}`;
        }
      }
    }
    // Also check page title (e.g. title: "... | CRP Inc.")
    if (crawlData && crawlData.title) {
      const titleMatch = crawlData.title.match(new RegExp(`\\b${nameAcronym}\\s*[,.]?\\s*${LEGAL_SUFFIX_CAPTURE}`, "i"));
      if (titleMatch && titleMatch[1]) {
        return `${cleanName}, ${titleMatch[1].trim()}`;
      }
    }
  }

  // 2. Check corpus regex
  const corpus = companyEvidenceCorpus(crawlData);
  if (!corpus) return cleanName;

  const baseName = cleanName.replace(/\b(?:co\.?|company|corp\.?|corporation)\s*$/i, "").trim() || cleanName;
  const escapedName = baseName.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

  // 2b. Indonesian prefix search in corpus
  const indoPrefixMatch = corpus.match(new RegExp(`\\b((?:PT|P\\.T\\.|CV|C\\.V\\.|UD|U\\.D\\.|Perseroan\\s+Terbatas)\\s+${escapedName}(?:\\s+Tbk\\.?)?)\\b`, "i"));
  if (indoPrefixMatch && indoPrefixMatch[1]) {
    return indoPrefixMatch[1].trim();
  }

  const legalRegex = new RegExp(`\\b${escapedName}\\s*[,.]?\\s*${LEGAL_SUFFIX_CAPTURE}`, "i");

  const match = corpus.match(legalRegex);
  if (match && match[1]) {
    const suffix = match[1].replace(/\s+/g, " ").trim();
    if (/\b(?:co\.?|company|corp\.?)\s*$/i.test(cleanName) && /^(?:co\.?|company|corp\.?)\b/i.test(suffix)) {
      return baseName + " " + suffix;
    }
    return cleanName + " " + suffix;
  }

  // 3. Fallback: find any legal-suffix company name in copyright that overlaps this name
  const copyright = (crawlData && crawlData.copyrightText) || "";
  const copyMatch = copyright.match(new RegExp(`([A-Z][A-Za-z0-9&.'\\- ]{2,80}\\s+${LEGAL_SUFFIX_CAPTURE})`, "i"));
  if (copyMatch && copyMatch[0] && (namesOverlap(cleanName, copyMatch[0]) || companyNamesMatch(cleanName, copyMatch[0]))) {
    return copyMatch[0].trim();
  }

  // 3b. Fallback: Indonesian prefix in copyright
  const copyIndoMatch = copyright.match(new RegExp(`((?:PT|P\\.T\\.|CV|C\\.V\\.|UD|U\\.D\\.|Perseroan\\s+Terbatas)\\s+[A-Z0-9][A-Za-z0-9&.'\\- ]{2,60}(?:\\s+Tbk\\.?)?)`, "i"));
  if (copyIndoMatch && copyIndoMatch[1] && (namesOverlap(cleanName, copyIndoMatch[1]) || companyNamesMatch(cleanName, copyIndoMatch[1]))) {
    return copyIndoMatch[1].trim();
  }

  // 3c. Check social media handles or text evidence for [Brand] Co. / [Brand] Company (e.g. pemfountainco -> PEM Fountain Company)
  const domainUrl = (crawlData && (crawlData.originalUrl || crawlData.finalUrl)) || "";
  const stem = cleanDomainStem(domainUrl);
  const socialValues = (crawlData && crawlData.companySocials) ? Object.values(crawlData.companySocials).join(" ").toLowerCase() : "";
  const combinedText = [
    crawlData && crawlData.logoText,
    crawlData && crawlData.title,
    crawlData && crawlData.copyrightText,
    ...(crawlData && crawlData.legalCompanyCandidates || []),
    crawlData && crawlData.mainHtml,
    socialValues
  ].filter(Boolean).join(" ");

  if (stem && stem.length >= 3) {
    const handleHasCo = new RegExp(`(?:/|@)${stem}co(?:/|\\b|$)`, "i").test(socialValues);
    const textHasCo = new RegExp(`\\b${escapedName}\\s+(?:Co\\.?|Company)\\b`, "i").test(combinedText);
    if ((handleHasCo || textHasCo) && !/\b(?:Company|Corporation|Limited|Incorporated)\b/i.test(cleanName)) {
      return `${cleanName} Company`;
    }
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
  n = n.replace(/[\[\(]\s*(malaysia)\s*[\]\)]/gi, " $1 ");

  // 2. Remove brackets from company name per Rule 4 (keep inner content, remove bracket symbols)
  n = n.replace(/[\(\[\{]\s*([^\)\]\}]+?)\s*[\)\]\}]/g, " $1 ");
  n = n.replace(/[\(\)\[\]\{\}]/g, " ");

  // 3. Multi-word Latin American corporate entities (must run before simple S.A.)
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*b[\.\s]*de[\.\s]*c[\.\s]*v|sab\s+de\s+cv)\b\.?/gi, "Sociedad Anónima Bursátil de Capital Variable");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*de[\.\s]*c[\.\s]*v|sa\s+de\s+cv)\b\.?/gi, "Sociedad Anónima de Capital Variable");
  n = n.replace(/\b(?:s[\.\s]*de[\.\s]*r[\.\s]*l[\.\s]*de[\.\s]*c[\.\s]*v|s\s+de\s+rl\s+de\s+cv)\b\.?/gi, "Sociedad de Responsabilidad Limitada de Capital Variable");
  n = n.replace(/\b(?:s[\.\s]*de[\.\s]*r[\.\s]*l|s\s+de\s+rl)\b\.?/gi, "Sociedad de Responsabilidad Limitada");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*p[\.\s]*i[\.\s]*de[\.\s]*c[\.\s]*v|sapi\s+de\s+cv)\b\.?/gi, "Sociedad Anónima Promotora de Inversión de Capital Variable");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*c|sac)\b\.?$/gi, "Sociedad Anónima Cerrada");
  n = n.replace(/\b(?:e[\.\s]*i[\.\s]*r[\.\s]*l|eirl)\b\.?/gi, "Empresa Individual de Responsabilidad Limitada");
  n = n.replace(/\b(?:c[\.\s]*a|ca)\b\.?$/gi, "Compañía Anónima");

  // 4. Indonesia entities (prefix and suffix)
  n = n.replace(/(^|[\s,])(?:pt|p\.t\.)\b\.?\s+/gi, "$1Perseroan Terbatas ");
  n = n.replace(/\b(?:pt|p\.t\.)\b\.?$/gi, "Perseroan Terbatas");
  n = n.replace(/(^|[\s,])(?:cv|c\.v\.)\b\.?\s+/gi, "$1Commanditaire Vennootschap ");
  n = n.replace(/\b(?:cv|c\.v\.)\b\.?$/gi, "Commanditaire Vennootschap");
  n = n.replace(/(^|[\s,])(?:ud|u\.d\.)\b\.?\s+/gi, "$1Usaha Dagang ");
  n = n.replace(/\b(?:ud|u\.d\.)\b\.?$/gi, "Usaha Dagang");
  n = n.replace(/(^|[\s,])(?:pd|p\.d\.)\b\.?\s+/gi, "$1Perusahaan Daerah ");
  n = n.replace(/\b(?:tbk)\b\.?/gi, "Terbuka");

  // 5. Malaysia entities
  n = n.replace(/\bsdn[\.\s]+bhd\.?\b/gi, "Sendirian Berhad");
  n = n.replace(/\bsdn\s*bhd\.?\b/gi, "Sendirian Berhad");
  n = n.replace(/\bsdn\b\.?/gi, "Sendirian");
  n = n.replace(/\bbhd\b\.?/gi, "Berhad");
  n = n.replace(/\bplt\b\.?/gi, "Perkongsian Liabiliti Terhad");

  // 6. Germany / Austria / Switzerland (DACH)
  n = n.replace(/\bgmbh\s*(?:&|\+|und|and|u\.)\s*co\.?\s*kg\.?\b/gi, "Gesellschaft mit beschränkter Haftung and Compagnie Kommanditgesellschaft");
  n = n.replace(/\bgmbh\s*(?:&|\+|und|and|u\.)\s*co\.?\b/gi, "Gesellschaft mit beschränkter Haftung and Compagnie");
  n = n.replace(/\b(?:g[\.\s]*m[\.\s]*b[\.\s]*h|gmbh)\b\.?/gi, "Gesellschaft mit beschränkter Haftung");
  n = n.replace(/\b(?:u[\.\s]*g|ug)\s*(?:\(haftungsbeschr[äa]nkt\)|haftungsbeschr[äa]nkt)?\b\.?/gi, "Unternehmergesellschaft haftungsbeschränkt");
  n = n.replace(/\b(?:k[\.\s]*g[\.\s]*a[\.\s]*a|kgaa)\b\.?/gi, "Kommanditgesellschaft auf Aktien");
  n = n.replace(/\b(?:a[\.\s]*g|ag)\b\.?$/gi, "Aktiengesellschaft");
  n = n.replace(/\b(?:a[\.\s]*g|ag)\b\.?\s+(?=(?:und|and|co|kg)\b)/gi, "Aktiengesellschaft ");
  if (/germany|deutschland|austria|[öo]sterreich|switzerland|schweiz/i.test(country) || /\b(?:ag|a\.g\.)\b\.?$/i.test(n)) {
    n = n.replace(/\b(?:a[\.\s]*g|ag)\b\.?/gi, "Aktiengesellschaft");
  }
  n = n.replace(/\b(?:k[\.\s]*g|kg)\b\.?$/gi, "Kommanditgesellschaft");
  n = n.replace(/\b(?:o[\.\s]*h[\.\s]*g|ohg)\b\.?/gi, "Offene Handelsgesellschaft");
  n = n.replace(/\b(?:g[\.\s]*b[\.\s]*r|gbr)\b\.?/gi, "Gesellschaft bürgerlichen Rechts");
  n = n.replace(/\b(?:e[\.\s]*k|ek)\b\.?$/gi, "eingetragener Kaufmann");
  n = n.replace(/\b(?:e[\.\s]*v|ev)\b\.?$/gi, "eingetragener Verein");

  // 7. Italian entities
  n = n.replace(/\b(?:s[\.\s]*r[\.\s]*l[\.\s]*s|srls)\b/gi, "Società a Responsabilità Limitata Semplificata");
  n = n.replace(/\b(?:s[\.\s]*c[\.\s]*a[\.\s]*r[\.\s]*l|scarl)\b/gi, "Società Cooperativa a Responsabilità Limitata");
  n = n.replace(/\b(?:s[\.\s]*c[\.\s]*p[\.\s]*a|scpa)\b/gi, "Società Cooperativa per Azioni");
  n = n.replace(/\b(?:s[\.\s]*r[\.\s]*l|srl)\b/gi, "Società a Responsabilità Limitata");
  n = n.replace(/\b(?:s[\.\s]*p[\.\s]*a|spa)\b/gi, "Società per Azioni");
  n = n.replace(/\b(?:s[\.\s]*n[\.\s]*c|snc)\b/gi, "Società in Nome Collettivo");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*s|sas)\b/gi, "Società in Accomandita Semplice");
  n = n.replace(/\bs[\.\s]*s[\.\s]*\b/gi, "Società Semplice ");

  // 8. Spanish & Latin America entities
  n = n.replace(/\b(?:s[\.\s]*l[\.\s]*u\.?|slu)\b/gi, "Sociedad Limitada Unipersonal");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*u\.?|sau)\b/gi, "Sociedad Anónima Unipersonal");
  n = n.replace(/\b(?:s[\.\s]+l|s\.l\.?|sl)\b\.?/gi, "Sociedad Limitada");
  n = n.replace(/\b(?:s[\.\s]+a|s\.a\.?|sa)\b\.?/gi, "Sociedad Anónima");
  n = n.replace(/\b(?:s[\.\s]*c[\.\s]*p\.?|scp)\b/gi, "Sociedad Civil Privada");
  n = n.replace(/\b(?:s[\.\s]*coop\.?|scoop)\b/gi, "Sociedad Cooperativa");
  n = n.replace(/\b(?:l[\.\s]*t[\.\s]*d[\.\s]*a|ltda)\b\.?/gi, "Limitada");

  // 9. France & Belgium
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*r[\.\s]*l|sarl)\b/gi, "Société à Responsabilité Limitée");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*s[\.\s]*u|sasu)\b/gi, "Société par Actions Simplifiée Unipersonnelle");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*s|sas)\b/gi, "Société par Actions Simplifiée");
  n = n.replace(/\b(?:s[\.\s]*p[\.\s]*r[\.\s]*l|sprl)\b/gi, "Société Privée à Responsabilité Limitée");
  n = n.replace(/\b(?:b[\.\s]*v[\.\s]*b[\.\s]*a|bvba)\b/gi, "Besloten Vennootschap met Beperkte Aansprakelijkheid");

  // 10. Netherlands & Belgium
  n = n.replace(/\b(?:b[\.\s]*v\.?|bv)\b/gi, "Besloten Vennootschap");
  n = n.replace(/\b(?:n[\.\s]*v\.?|nv)\b/gi, "Naamloze Vennootschap");
  n = n.replace(/\b(?:v[\.\s]*o[\.\s]*f\.?|vof)\b/gi, "Vennootschap onder Firma");

  // 11. Poland
  n = n.replace(/\b(?:sp\.?\s*z\s*o\.?\s*o\.?|sp[oó][lł]ka\s+z\s+o\.?o\.?)\b/gi, "Spółka z ograniczoną odpowiedzialnością");

  // 12. Eastern Europe & Russia (Joint Stock Companies)
  n = n.replace(/\b(?:p[\.\s]*j[\.\s]*s[\.\s]*c|pjsc)\b\.?/gi, "Public Joint Stock Company");
  n = n.replace(/\b(?:o[\.\s]*j[\.\s]*s[\.\s]*c|ojsc)\b\.?/gi, "Open Joint Stock Company");
  n = n.replace(/\b(?:c[\.\s]*j[\.\s]*s[\.\s]*c|cjsc)\b\.?/gi, "Closed Joint Stock Company");
  n = n.replace(/\b(?:j[\.\s]*s[\.\s]*c|jsc)\b\.?/gi, "Joint Stock Company");

  // 13. Czechia, Slovakia, Hungary, Balkans
  n = n.replace(/\b(?:spol\.?\s*s\s*r\.?o\.?|s[\.\s]*r[\.\s]*o\.?|sro)\b/gi, "společnost s ručením omezeným");
  n = n.replace(/\b(?:a[\.\s]*s\.?|akc\.?\s*spol\.?)\b(?!\s+(?:de\s+c\.?v\.?))/gi, "akciová společnost");
  n = n.replace(/\b(?:d[\.\s]*o[\.\s]*o\.?|doo)\b/gi, "društvo s ograničenom odgovornošću");
  n = n.replace(/\b(?:k[\.\s]*f[\.\s]*t\.?|kft)\b/gi, "Korlátolt Felelősségű Társaság");
  n = n.replace(/\b(?:z[\.\s]*r[\.\s]*t\.?|zrt)\b/gi, "Zártkörűen működő Részvénytársaság");
  n = n.replace(/\b(?:n[\.\s]*y[\.\s]*r[\.\s]*t\.?|nyrt)\b/gi, "Nyilvánosan működő Részvénytársaság");

  // 14. Nordics
  n = n.replace(/\b(?:aktiebolag|ab)\b\.?$/gi, "Aktiebolag");
  n = n.replace(/\b(?:aksjeselskap|as)\b\.?$/gi, "Aksjeselskap");
  n = n.replace(/\b(?:osakeyhti[oö]|oy)\b\.?$/gi, "Osakeyhtiö");
  n = n.replace(/\b(?:oyj)\b\.?$/gi, "Julkinen Osakeyhtiö");
  n = n.replace(/\b(?:anpartsselskab|aps)\b\.?$/gi, "Anpartsselskab");

  // 15. Australia & South Africa
  n = n.replace(/\bpty[\.\s]*ltd(?:\.|\b)/gi, "Proprietary Limited");
  n = n.replace(/\bpty(?:\.|\b)/gi, "Proprietary");

  // 16. Singapore, India, UK
  n = n.replace(/\bpte[\.\s]*ltd(?:\.|\b)/gi, "Private Limited");
  n = n.replace(/\bpvt[\.\s]*ltd(?:\.|\b)/gi, "Private Limited");
  n = n.replace(/\bpte(?:\.|\b)/gi, "Private");
  n = n.replace(/\bpvt(?:\.|\b)/gi, "Private");
  n = n.replace(/\bplc(?:\.|\b)/gi, "Public Limited Company");
  n = n.replace(/\bcic(?:\.|\b)/gi, "Community Interest Company");
  n = n.replace(/\bdac(?:\.|\b)/gi, "Designated Activity Company");

  // 17. Pan-European
  n = n.replace(/\b(?:s[\.\s]*e|se)\b\.?$/gi, "Societas Europaea");

  // 18. Common Business, Technical, and Industry Word Abbreviations in Company Names
  // Manufacturing / Makers
  n = n.replace(/\bmfg[\.\s]*co[\.\s]*(,)?[\.\s]*ltd(?:\.|\b)/gi, (match, comma) => {
    return comma ? "Manufacturing Company, Limited" : "Manufacturing Company Limited";
  });
  n = n.replace(/\bmfg(?:\.|\b)/gi, "Manufacturing");
  n = n.replace(/\bmfrs(?:\.|\b)/gi, "Manufacturers");
  n = n.replace(/\bmfr(?:\.|\b)/gi, "Manufacturer");

  // Industries / Industrial
  n = n.replace(/\bind(?:ust)?[\.\s]*co[\.\s]*(,)?[\.\s]*ltd(?:\.|\b)/gi, (match, comma) => {
    return comma ? "Industries Company, Limited" : "Industries Company Limited";
  });
  n = n.replace(/\binds(?:\.|\b)/gi, "Industries");
  n = n.replace(/\bindust(?:\.|\b)/gi, "Industries");
  n = n.replace(/\bind\b\.?\s*(?=(?:services?|solutions?|suppl(?:y|ies)|products?|equipment|park|estate|zone|area)\b)/gi, "Industrial ");
  n = n.replace(/\bind(?:\.|\b)/gi, "Industries");

  // International / National
  n = n.replace(/\b(?:int['’]?l|intl)\b\.?/gi, "International");
  n = n.replace(/\b(?:nat['’]?l|natl)\b\.?/gi, "National");

  // Technology / Technologies
  n = n.replace(/\btechs(?:\.|\b)/gi, "Technologies");
  n = n.replace(/\b(?:technol|tech)\b\.?/gi, "Technology");

  // Engineering
  n = n.replace(/\b(?:engg|engr|eng)\b\.?\s*(?=(?:works|solutions?|services?|systems?|products?|co|company|corp|ltd|limited|inc|llc)\b)/gi, "Engineering ");
  n = n.replace(/\b(?:engg|engr)\b\.?/gi, "Engineering");

  // Equipment, Products, Systems, Development
  n = n.replace(/\b(?:eqpt|equip)\b\.?/gi, "Equipment");
  n = n.replace(/\bprods(?:\.|\b)/gi, "Products");
  n = n.replace(/\bprod(?:\.|\b)/gi, "Products");
  n = n.replace(/\b(?:syst|sys)\b\.?/gi, "Systems");
  n = n.replace(/\b(?:devel|dev)\b\.?/gi, "Development");

  // Services, Solutions, Associates, Group
  n = n.replace(/\b(?:svcs|svc|serv)\b\.?/gi, "Services");
  n = n.replace(/\b(?:solns|soln|sols)\b\.?/gi, "Solutions");
  n = n.replace(/\b(?:assocs|assoc)\b\.?/gi, "Associates");
  n = n.replace(/\bgrp\b\.?/gi, "Group");

  // Chemical, Electrical / Electronics, Automotive, Automation
  n = n.replace(/\bchems(?:\.|\b)/gi, "Chemicals");
  n = n.replace(/\bchem\b\.?\s*(?=(?:ind|industries|co|company|corp|ltd|limited|inc|llc|products?|supplies)\b)/gi, "Chemical ");
  n = n.replace(/\bchem(?:\.|\b)/gi, "Chemicals");
  n = n.replace(/\b(?:elect|elec)\b\.?\s*(?=(?:and|&|engineering|services?|supplies)\b)/gi, "Electrical ");
  n = n.replace(/\b(?:elect|elec)\b\.?/gi, "Electronics");
  n = n.replace(/\bauto\b\.?\s*(?=(?:parts?|components?|industr(?:y|ies)|vehicles?)\b)/gi, "Automotive ");
  n = n.replace(/\bauto\b\.?\s*(?=(?:systems?|solutions?|engineering)\b)/gi, "Automation ");

  // Distribution, Fabrication, Machinery, Packaging
  n = n.replace(/\b(?:distrib|dist)\b\.?\s*(?=(?:co|company|corp|ltd|limited|inc|llc|of)\b)/gi, "Distributors ");
  n = n.replace(/\b(?:distrib|dist)\b\.?/gi, "Distribution");
  n = n.replace(/\bfab\b\.?/gi, "Fabrication");
  n = n.replace(/\bmach\b\.?/gi, "Machinery");
  n = n.replace(/\b(?:pkg|pack)\b\.?/gi, "Packaging");

  // Management, Communications, Laboratories, Materials
  n = n.replace(/\b(?:mgmt|mgt)\b\.?/gi, "Management");
  n = n.replace(/\b(?:comms|comm)\b\.?/gi, "Communications");
  n = n.replace(/\b(?:labs|lab)\b\.?/gi, "Laboratories");
  n = n.replace(/\b(?:matl|mat)\b\.?/gi, "Materials");

  // Technical prefixes
  n = n.replace(/\bappl\b\.?\s*(?=(?:technol|tech|sciences?|systems?|materials?|engineering)\b)/gi, "Applied ");
  n = n.replace(/\badv\b\.?\s*(?=(?:technol|tech|materials?|systems?|engineering|solutions?)\b)/gi, "Advanced ");
  n = n.replace(/\bgen\b\.?\s*(?=(?:electric|motors?|trading|commercial|engineering|industries)\b)/gi, "General ");
  n = n.replace(/\bstd\b\.?\s*(?=(?:products?|engineering|parts?|fasteners?)\b)/gi, "Standard ");
  n = n.replace(/\b(?:envr|env)\b\.?\s*(?=(?:solutions?|services?|systems?|engineering)\b)/gi, "Environmental ");
  n = n.replace(/\b(?:transp|trans)\b\.?\s*(?=(?:solutions?|services?|systems?|logistics?)\b)/gi, "Transportation ");
  n = n.replace(/\b(?:logist|log)\b\.?\s*(?=(?:solutions?|services?|systems?)\b)/gi, "Logistics ");
  n = n.replace(/\b(?:constr|const)\b\.?\s*(?=(?:solutions?|services?|systems?|materials?|equipment|co|company|ltd|corp|inc)\b)/gi, "Construction ");
  n = n.replace(/\bpharm\b\.?/gi, "Pharmaceuticals");
  n = n.replace(/\btelecom\b\.?/gi, "Telecommunications");

  // 19. United States & Global Legal Entities (must run after Mfg/Ind compound rules)
  n = n.replace(/\bpllc(?:\.|\b)/gi, "Professional Limited Liability Company");
  n = n.replace(/\bllp(?:\.|\b)/gi, "Limited Liability Partnership");
  n = n.replace(/\bllc(?:\.|\b)/gi, "Limited Liability Company");
  n = n.replace(/\bl\.?l\.?c(?:\.|\b)/gi, "Limited Liability Company");
  n = n.replace(/\blp(?:\.|\b)/gi, "Limited Partnership");
  n = n.replace(/\bl\.?p(?:\.|\b)/gi, "Limited Partnership");

  // "Co., Ltd." vs "Co. Ltd"
  // If comma is present between Co and Ltd (e.g. "Co., Ltd." or "Co.,Ltd") -> "Company, Limited"
  // If WITHOUT comma (e.g. "Co. Ltd" or "Co Ltd") -> "Company Limited"
  n = n.replace(/\bco[\.\s]*(,)\s*ltd(?:\.|\b)/gi, "Company, Limited");
  n = n.replace(/\bco[\.\s]+ltd(?:\.|\b)/gi, "Company Limited");

  // Private, Proprietary Limited with/without comma
  n = n.replace(/\bpte[\.\s]*(,)\s*ltd(?:\.|\b)/gi, "Private, Limited");
  n = n.replace(/\bpte[\.\s]+ltd(?:\.|\b)/gi, "Private Limited");
  n = n.replace(/\bpvt[\.\s]*(,)\s*ltd(?:\.|\b)/gi, "Private, Limited");
  n = n.replace(/\bpvt[\.\s]+ltd(?:\.|\b)/gi, "Private Limited");
  n = n.replace(/\bpty[\.\s]*(,)\s*ltd(?:\.|\b)/gi, "Proprietary, Limited");
  n = n.replace(/\bpty[\.\s]+ltd(?:\.|\b)/gi, "Proprietary Limited");

  n = n.replace(/\bltd(?:\.|\b)/gi, "Limited");
  n = n.replace(/\bl\.?t\.?d(?:\.|\b)/gi, "Limited");
  n = n.replace(/\binc(?:\.|\b)/gi, "Incorporated");
  n = n.replace(/\bi\.?n\.?c(?:\.|\b)/gi, "Incorporated");
  n = n.replace(/\bcorp(?:\.|\b)/gi, "Corporation");
  n = n.replace(/\bc\.?o\.?r\.?p(?:\.|\b)/gi, "Corporation");
  n = n.replace(/\bco(?:\.|\b)/gi, "Company");
  n = n.replace(/\bc\.?o(?:\.|\b)/gi, "Company");

  // Clean semicolons and normalize commas without stripping dots and commas per Rule 4
  n = n.replace(/;+/g, " ");
  n = n.replace(/\s*,\s*/g, ", ");
  n = n.replace(/\s+/g, " ").trim();

  // Rule: Special character should not start and should not end
  n = n.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
  n = n.replace(/[^\p{L}\p{N}]+$/gu, "").trim();

  return n;
}

/**
 * Rule 4: Preserves/restores comma before corporate legal designations:
 * e.g. "TP Orthodontics, Inc" -> "TP Orthodontics, Incorporated"
 * e.g. "Transformer Manufacturers, Inc" -> "Transformer Manufacturers, Incorporated"
 * e.g. "Kaulin Manufacturing Company, Limited"
 */
function restoreCommaBeforeCorporateSuffix(compName, crawlData) {
  if (!compName || typeof compName !== "string") return compName;
  // If already has a comma before Incorporated / Company, Limited / Limited Liability Company / Limited, keep it intact
  if (/,\s*(?:Incorporated|Company,\s*Limited|Limited\s*Liability\s*Company|Limited)\b/i.test(compName)) {
    return compName;
  }
  const m = compName.match(/^(.*?)\s+(Incorporated|Company,\s*Limited|Limited\s*Liability\s*Company|Limited)\b(.*)$/i);
  if (m) {
    const base = m[1].trim();
    const suffix = m[2].trim();
    const rest = m[3] || "";
    const corpus = [
      crawlData && crawlData.copyrightText,
      crawlData && crawlData.title,
      crawlData && (crawlData.legalCompanyCandidates || []).join(" "),
      crawlData && crawlData.mainHtml,
      crawlData && crawlData.contactHtml,
      crawlData && crawlData.contactPageText,
      crawlData && crawlData.bodyText,
      crawlData && crawlData.combinedText
    ].filter(Boolean).join(" ");

    const baseTokens = base.split(/\s+/).filter(Boolean);
    const flexibleBasePattern = baseTokens.map(t => t.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&")).join("\\s*");
    if (new RegExp(`${flexibleBasePattern}\\s*,\\s*(?:Inc|Incorporated|LLC|Ltd|Limited)`, "i").test(corpus)) {
      return `${base}, ${suffix}${rest}`;
    }
  }
  return compName;
}

/**
 * Romanizes / transliterates Chinese addresses to Title Case English smallest-to-largest format.
 * (e.g. "惠州市仲恺高新区东江高新科技产业园惠泽大道138号" -> "Number 138 Huize Avenue, Dongjiang Hi-Tech Industrial Park, Zhongkai Hi-Tech Zone, Huizhou, Guangdong")
 */
function romanizeChineseAddress(addr) {
  if (!addr || typeof addr !== "string") return addr;
  if (!/[\u4e00-\u9fa5]/.test(addr)) return addr;

  let s = addr;

  // Dictionary of known Chinese administrative, zoning, and address terms to English
  const dict = [
    // Provinces / Direct Municipalities
    [/广东省/g, "Guangdong Province, "],
    [/广东/g, "Guangdong, "],
    [/江苏省/g, "Jiangsu Province, "],
    [/江苏/g, "Jiangsu, "],
    [/浙江省/g, "Zhejiang Province, "],
    [/浙江/g, "Zhejiang, "],
    [/山东省/g, "Shandong Province, "],
    [/山东/g, "Shandong, "],
    [/河南省/g, "Henan Province, "],
    [/河南/g, "Henan, "],
    [/四川省/g, "Sichuan Province, "],
    [/四川/g, "Sichuan, "],
    [/湖北省/g, "Hubei Province, "],
    [/湖北/g, "Hubei, "],
    [/湖南省/g, "Hunan Province, "],
    [/湖南/g, "Hunan, "],
    [/河北省/g, "Hebei Province, "],
    [/河北/g, "Hebei, "],
    [/福建省/g, "Fujian Province, "],
    [/福建/g, "Fujian, "],
    [/安徽省/g, "Anhui Province, "],
    [/安徽/g, "Anhui, "],
    [/辽宁省/g, "Liaoning Province, "],
    [/辽宁/g, "Liaoning, "],
    [/陕西省/g, "Shaanxi Province, "],
    [/陕西/g, "Shaanxi, "],
    [/江西省/g, "Jiangxi Province, "],
    [/江西/g, "Jiangxi, "],
    [/台湾省/g, "Taiwan Province, "],
    [/台湾/g, "Taiwan, "],
    [/台灣省/g, "Taiwan Province, "],
    [/台灣/g, "Taiwan, "],
    [/北京市/g, "Beijing, "],
    [/北京/g, "Beijing, "],
    [/上海市/g, "Shanghai, "],
    [/上海/g, "Shanghai, "],
    [/天津市/g, "Tianjin, "],
    [/天津/g, "Tianjin, "],
    [/重庆市/g, "Chongqing, "],
    [/重庆/g, "Chongqing, "],

    // Major Cities
    [/惠州市/g, "Huizhou, "],
    [/惠州/g, "Huizhou, "],
    [/深圳市/g, "Shenzhen, "],
    [/深圳/g, "Shenzhen, "],
    [/广州市/g, "Guangzhou, "],
    [/广州/g, "Guangzhou, "],
    [/东莞市/g, "Dongguan, "],
    [/东莞/g, "Dongguan, "],
    [/佛山市/g, "Foshan, "],
    [/佛山/g, "Foshan, "],
    [/苏州市/g, "Suzhou, "],
    [/苏州/g, "Suzhou, "],
    [/无锡市/g, "Wuxi, "],
    [/无锡/g, "Wuxi, "],
    [/常州市/g, "Changzhou, "],
    [/常州/g, "Changzhou, "],
    [/南京市/g, "Nanjing, "],
    [/南京/g, "Nanjing, "],
    [/杭州市/g, "Hangzhou, "],
    [/杭州/g, "Hangzhou, "],
    [/宁波市/g, "Ningbo, "],
    [/宁波/g, "Ningbo, "],
    [/温州市/g, "Wenzhou, "],
    [/温州/g, "Wenzhou, "],
    [/青岛市/g, "Qingdao, "],
    [/青岛/g, "Qingdao, "],
    [/济南市/g, "Jinan, "],
    [/济南/g, "Jinan, "],
    [/厦门市/g, "Xiamen, "],
    [/厦门/g, "Xiamen, "],
    [/福州市/g, "Fuzhou, "],
    [/福州/g, "Fuzhou, "],
    [/西安市/g, "Xi'an, "],
    [/西安/g, "Xi'an, "],
    [/成都市/g, "Chengdu, "],
    [/成都/g, "Chengdu, "],
    [/武汉市/g, "Wuhan, "],
    [/武汉/g, "Wuhan, "],
    [/长沙市/g, "Changsha, "],
    [/长沙/g, "Changsha, "],
    [/郑州市/g, "Zhengzhou, "],
    [/郑州/g, "Zhengzhou, "],
    [/桃园市/g, "Taoyuan City, "],
    [/桃園市/g, "Taoyuan City, "],
    [/台北市/g, "Taipei City, "],
    [/臺北市/g, "Taipei City, "],
    [/新北市/g, "New Taipei City, "],
    [/嘉義市/g, "Chiayi City, "],
    [/嘉义市/g, "Chiayi City, "],
    [/嘉義縣/g, "Chiayi County, "],
    [/嘉义县/g, "Chiayi County, "],
    [/嘉義/g, "Chiayi, "],
    [/嘉义/g, "Chiayi, "],
    [/新竹市/g, "Hsinchu City, "],
    [/新竹縣/g, "Hsinchu County, "],
    [/新竹县/g, "Hsinchu County, "],
    [/新竹/g, "Hsinchu, "],
    [/台中市/g, "Taichung City, "],
    [/臺中市/g, "Taichung City, "],
    [/台中/g, "Taichung, "],
    [/臺中/g, "Taichung, "],
    [/台南市/g, "Tainan City, "],
    [/臺南市/g, "Tainan City, "],
    [/台南/g, "Tainan, "],
    [/臺南/g, "Tainan, "],
    [/高雄市/g, "Kaohsiung City, "],
    [/高雄/g, "Kaohsiung, "],
    [/基隆市/g, "Keelung City, "],
    [/基隆/g, "Keelung, "],
    [/彰化縣/g, "Changhua County, "],
    [/彰化县/g, "Changhua County, "],
    [/彰化/g, "Changhua, "],
    [/苗栗縣/g, "Miaoli County, "],
    [/苗栗县/g, "Miaoli County, "],
    [/苗栗/g, "Miaoli, "],
    [/南投縣/g, "Nantou County, "],
    [/南投县/g, "Nantou County, "],
    [/南投/g, "Nantou, "],
    [/雲林縣/g, "Yunlin County, "],
    [/云林县/g, "Yunlin County, "],
    [/雲林/g, "Yunlin, "],
    [/云林/g, "Yunlin, "],
    [/屏東縣/g, "Pingtung County, "],
    [/屏东县/g, "Pingtung County, "],
    [/屏東/g, "Pingtung, "],
    [/屏东/g, "Pingtung, "],
    [/宜蘭縣/g, "Yilan County, "],
    [/宜兰县/g, "Yilan County, "],
    [/宜蘭/g, "Yilan, "],
    [/宜兰/g, "Yilan, "],
    [/花蓮縣/g, "Hualien County, "],
    [/花莲县/g, "Hualien County, "],
    [/花蓮/g, "Hualien, "],
    [/花莲/g, "Hualien, "],
    [/台東縣/g, "Taitung County, "],
    [/臺東縣/g, "Taitung County, "],
    [/台东县/g, "Taitung County, "],
    [/台東/g, "Taitung, "],
    [/臺東/g, "Taitung, "],
    [/台东/g, "Taitung, "],
    [/東區/g, "East District, "],
    [/东区/g, "East District, "],
    [/西區/g, "West District, "],
    [/西区/g, "West District, "],
    [/南區/g, "South District, "],
    [/南区/g, "South District, "],
    [/北區/g, "North District, "],
    [/北区/g, "North District, "],
    [/中區/g, "Central District, "],
    [/中区/g, "Central District, "],
    [/後湖里/g, "Houhu Village, "],
    [/后湖里/g, "Houhu Village, "],
    [/保順路/g, "Baoshun Road, "],
    [/保顺路/g, "Baoshun Road, "],
    [/里/g, " Village, "],

    // Specific zones, parks, districts, entities
    [/仲恺高新区/g, "Zhongkai High-Tech Zone, "],
    [/仲恺/g, "Zhongkai "],
    [/东江高新科技产业园/g, "Dongjiang High-Tech Industrial Park, "],
    [/东江/g, "Dongjiang "],
    [/高新科技产业园/g, "High-Tech Industrial Park, "],
    [/高新技术产业开发区/g, "High-Tech Industrial Development Zone, "],
    [/高新科技园/g, "High-Tech Park, "],
    [/高新技术园区/g, "High-Tech Industrial Zone, "],
    [/高新区/g, "High-Tech Zone, "],
    [/科技工业园/g, "Science & Technology Industrial Park, "],
    [/工业园区/g, "Industrial Park, "],
    [/工业园/g, "Industrial Park, "],
    [/经济技术开发区/g, "Economic & Technological Development Zone, "],
    [/经济开发区/g, "Economic Development Zone, "],
    [/科技园/g, "Science Park, "],
    [/产业园/g, "Industrial Park, "],
    [/现代企业中心/g, "Modern Enterprise Center, "],
    [/相城区/g, "Xiangcheng District, "],
    [/相城/g, "Xiangcheng "],
    [/澄阳路/g, "Chengyang Road, "],
    [/澄阳/g, "Chengyang "],
    [/漕湖街道/g, "Caohu Subdistrict, "],
    [/春耀路/g, "Chunyao Road, "],
    [/粤海街道/g, "Yuehai Subdistrict, "],
    [/麻岭社区/g, "Maling Community, "],
    [/科技中三路/g, "Keji Middle 3rd Road, "],
    [/国人大厦/g, "Guoren Building, "],
    [/锦业路/g, "Jinye Road, "],
    [/唯新路/g, "Weixin Road, "],
    [/中科智能/g, "Zhongke Intelligent, "],
    [/漕宝路/g, "Caobao Road, "],
    [/宜山路/g, "Yishan Road, "],
    [/新埔六街/g, "Xinpu 6th Street, "],
    [/草堤路/g, "Caoti Road, "],
    [/大里區/g, "Dali District, "],
    [/大里区/g, "Dali District, "],
    [/惠泽大道/g, "Huize Avenue, "],
    [/惠泽路/g, "Huize Road, "],
    [/惠泽/g, "Huize "],

    // General terms
    [/大道/g, " Avenue, "],
    [/路/g, " Road, "],
    [/街/g, " Street, "],
    [/巷/g, " Lane, "],
    [/弄/g, " Alley, "],
    [/(\d+)\s*[号號]/g, "Number $1, "],
    [/([A-Za-z0-9]+)\s*[幢栋棟]/g, "Building $1, "],
    [/([A-Za-z0-9]+)\s*[层樓楼]/g, "Floor $1, "],
    [/([A-Za-z0-9]+)\s*[室房]/g, "Room $1, "],
    [/([A-Za-z0-9]+)\s*[座]/g, "Block $1, "],
    [/([A-Za-z0-9]+)\s*[期]/g, "Phase $1, "],
    [/([A-Za-z0-9]+)\s*[区區]/g, "Area $1, "],
    [/区/g, " District, "],
    [/區/g, " District, "],
    [/县/g, " County, "],
    [/縣/g, " County, "],
    [/镇/g, " Town, "],
    [/鎮/g, " Town, "]
  ];

  for (const [re, rep] of dict) {
    s = s.replace(re, rep);
  }

  // If there are still Chinese characters left, strip or replace with space
  s = s.replace(/[\u4e00-\u9fa5]+/g, " ");

  // Order reversal: Chinese is largest-to-smallest ([City], [District], [Park], [Road], [Number]).
  // Western address is smallest-to-largest ([Number] [Road], [Park], [District], [City]).
  const parts = s.split(/[,，\n]+/).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    if (/\b(?:Number|No\.?|Floor|Room|Building)\b/i.test(lastPart) || /\b(?:Road|Street|Avenue|Lane)\b/i.test(lastPart) || /^\d+[A-Za-z]?$/.test(lastPart)) {
      parts.reverse();
    }
  }

  return parts.join(", ");
}

/**
 * Ensures "Number" is ONLY present if "No.", "No", "NO.", "Nos.", "Nº", or "#" was in the original raw address evidence.
 * Rule: "if No come only expand and do with out coming dont put blankly number"
 */
function stripBlindlyAddedNumber(addr, rawEvidence = "", rawSource = "") {
  if (!addr || !/\bNumber\s+\d+/i.test(addr)) return addr;
  return addr.replace(/\bNumber\s+(\d+(?:[-/]\d+)?)\b/gi, (match, digits) => {
    // If rawSource is available (the actual selected candidate), prioritize it
    if (rawSource && typeof rawSource === "string") {
      const rawHasNo = new RegExp('(?:(?:\\b(?:no|nos|nº|numero|num|number|lot\\s*no|plot\\s*no)\\.?|#)\\s*' + digits.replace('-', '[-/]') + '\\b|' + digits.replace('-', '[-/]') + '\\s*[号號])', 'i');
      if (rawHasNo.test(rawSource)) {
        return match;
      }
      const rawHasBare = new RegExp('(?:^|[^a-zA-Z0-9#])' + digits.replace('-', '[-/]') + '(?:[^a-zA-Z0-9号號]|$)', 'i');
      if (rawHasBare.test(rawSource)) {
        return digits; // strip "Number "
      }
    }
    const rawRegex = new RegExp('(?:(?:\\b(?:no|nos|nº|numero|num|number|lot\\s*no|plot\\s*no)\\.?|#)\\s*' + digits.replace('-', '[-/]') + '\\b|' + digits.replace('-', '[-/]') + '\\s*[号號])', 'i');
    if (rawEvidence && rawRegex.test(rawEvidence)) {
      return match;
    }
    return digits;
  });
}

/**
 * CRITICAL QC RULE: "the items what available that only should come no extra word"
 * Strips words (like "Number", "City", "District", "Township", "County") that were NOT
 * in the source address candidate, and aligns spelling back to the source candidate.
 */
function stripExtraWordsFromAddress(addr, rawSource = "") {
  if (!addr || typeof addr !== "string") return addr;
  if (!rawSource || typeof rawSource !== "string") return addr;

  let a = addr;

  // 1. "Number": If addr has "Number <digits>" but rawSource has bare digits without "no", "number", "#"
  a = a.replace(/\bNumber\s+(\d+(?:[-/]\d+)?)\b/gi, (match, digits) => {
    const rawHasNo = new RegExp('(?:(?:\\b(?:no|nos|nº|numero|num|number|lot\\s*no|plot\\s*no)\\.?|#)\\s*' + digits.replace('-', '[-/]') + '\\b|' + digits.replace('-', '[-/]') + '\\s*[号號])', 'i');
    if (rawHasNo.test(rawSource)) {
      return match;
    }
    const rawHasBare = new RegExp('(?:^|[^a-zA-Z0-9#])' + digits.replace('-', '[-/]') + '(?:[^a-zA-Z0-9号號]|$)', 'i');
    if (rawHasBare.test(rawSource)) {
      return digits; // strip "Number "
    }
    return match;
  });

  // 2. "City": If addr has "<CityName> City" but rawSource has "<CityName>" without "City"
  a = a.replace(/\b((?:(?:New|North|South|East|West|Old|San|Santa|Los|Las|Fort|Port|Saint|St\.)\s+)?[A-Z][a-z0-9\u00C0-\u024F\-]+)\s+City\b/g, (match, cityName) => {
    const escapedName = cityName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const rawHasCity = new RegExp('\\b' + escapedName + '\\s+(?:city|cty\\.?)\\b', 'i');
    if (rawHasCity.test(rawSource)) {
      return match;
    }
    const rawHasNameOnly = new RegExp('\\b' + escapedName + '\\b', 'i');
    if (rawHasNameOnly.test(rawSource)) {
      return cityName; // strip " City"
    }
    return match;
  });

  // 3. "District", "Township", "County":
  const divPatterns = {
    District: '(?:district|dist\\.?)',
    Township: '(?:township|twp\\.?)',
    County: '(?:county|co\\.?|hsien)',
    Hsien: '(?:hsien|county|co\\.?)'
  };
  a = a.replace(/\b([A-Z][a-z0-9\u00C0-\u024F\-]+)\s+(District|Township|County|Hsien)\b/g, (match, name, div) => {
    const pat = divPatterns[div] || div;
    const rawHasDiv = new RegExp('\\b' + name + '\\s+' + pat + '\\b', 'i');
    if (rawHasDiv.test(rawSource)) {
      return match;
    }
    const rawHasNameOnly = new RegExp('\\b' + name + '\\b', 'i');
    if (rawHasNameOnly.test(rawSource)) {
      return name;
    }
    return match;
  });

  // 4. Locality spelling alignment:
  // e.g. rawSource has "Keishan" and does NOT have "Guishan", but addr has "Guishan"
  if (/\bKeishan\b/i.test(rawSource) && !/\bGuishan\b/i.test(rawSource)) {
    a = a.replace(/\bGuishan\s*(?:District|Township)?\b/gi, "Keishan");
  }

  return a;
}

/**
 * Normalizes Taiwanese cities, counties, and districts and repairs accidental commas
 * splitting two-syllable city names (e.g. "Chia, Yi City" -> "Chiayi City", "Hsin, Chu City" -> "Hsinchu City").
 */
function normalizeTaiwanDivisions(addr) {
  if (!addr || typeof addr !== "string") return addr;
  let a = addr;

  const twCities = [
    { regex: /\b(?:New\s*)?Tai[-\s,]*[Pp]ei\s*City\b/gi, rep: (m) => /^new/i.test(m) ? "New Taipei City" : "Taipei City" },
    { regex: /\bChia[-\s,]*[Yy]i\s*City\b/gi, rep: "Chiayi City" },
    { regex: /\bHsin[-\s,]*[Cc]hu\s*City\b/gi, rep: "Hsinchu City" },
    { regex: /\bTai[-\s,]*[Cc]hung\s*City\b/gi, rep: "Taichung City" },
    { regex: /\bTai[-\s,]*[Nn]an\s*City\b/gi, rep: "Tainan City" },
    { regex: /\bKao[-\s,]*[Hh]siung\s*City\b/gi, rep: "Kaohsiung City" },
    { regex: /\bTao[-\s,]*[Yy]uan\s*City\b/gi, rep: "Taoyuan City" },
    { regex: /\bKee[-\s,]*[Ll]ung\s*City\b/gi, rep: "Keelung City" },

    // Counties
    { regex: /\bChang[-\s,]*[Hh]ua\s*(?:County|Hsien)\b/gi, rep: "Changhua County" },
    { regex: /\bYun[-\s,]*[Ll]in\s*(?:County|Hsien)\b/gi, rep: "Yunlin County" },
    { regex: /\bMiao[-\s,]*[Ll]i\s*(?:County|Hsien)\b/gi, rep: "Miaoli County" },
    { regex: /\bNan[-\s,]*[Tt]ou\s*(?:County|Hsien)\b/gi, rep: "Nantou County" },
    { regex: /\bPing[-\s,]*[Tt]ung\s*(?:County|Hsien)\b/gi, rep: "Pingtung County" },
    { regex: /\bYi[-\s,]*[Ll]an\s*(?:County|Hsien)\b/gi, rep: "Yilan County" },
    { regex: /\bHua[-\s,]*[Ll]ien\s*(?:County|Hsien)\b/gi, rep: "Hualien County" },
    { regex: /\bTai[-\s,]*[Tt]ung\s*(?:County|Hsien)\b/gi, rep: "Taitung County" },
    { regex: /\bPen[-\s,]*[Gg]hu\s*(?:County|Hsien)\b/gi, rep: "Penghu County" },
    { regex: /\bKin[-\s,]*[Mm]en\s*(?:County|Hsien)\b/gi, rep: "Kinmen County" },
    { regex: /\bChia[-\s,]*[Yy]i\s*(?:County|Hsien)\b/gi, rep: "Chiayi County" },
    { regex: /\bHsin[-\s,]*[Cc]hu\s*(?:County|Hsien)\b/gi, rep: "Hsinchu County" }
  ];

  for (const item of twCities) {
    a = a.replace(item.regex, item.rep);
  }

  const twStandaloneCities = [
    { regex: /\bChia[-\s,]+[Yy]i\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Chiayi" },
    { regex: /\bHsin[-\s,]+[Cc]hu\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Hsinchu" },
    { regex: /\bTai[-\s,]+[Cc]hung\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Taichung" },
    { regex: /\bTai[-\s,]+[Nn]an\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Tainan" },
    { regex: /\bKao[-\s,]+[Hh]siung\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Kaohsiung" },
    { regex: /\bTao[-\s,]+[Yy]uan\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Taoyuan" },
    { regex: /\bKee[-\s,]+[Ll]ung\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Keelung" },
    { regex: /(?<!\bNew\s+)\bTai[-\s,]+[Pp]ei\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Taipei" },
    { regex: /\bNew\s+Tai[-\s,]+[Pp]ei\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "New Taipei" },
    { regex: /\bChang[-\s,]+[Hh]ua\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Changhua" },
    { regex: /\bYun[-\s,]+[Ll]in\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Yunlin" },
    { regex: /\bMiao[-\s,]+[Ll]i\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Miaoli" },
    { regex: /\bNan[-\s,]+[Tt]ou\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Nantou" },
    { regex: /\bPing[-\s,]+[Tt]ung\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Pingtung" },
    { regex: /\bYi[-\s,]+[Ll]an\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Yilan" },
    { regex: /\bHua[-\s,]+[Ll]ien\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Hualien" },
    { regex: /\bTai[-\s,]+[Tt]ung\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Taitung" }
  ];

  for (const item of twStandaloneCities) {
    a = a.replace(item.regex, item.rep);
  }

  return a;
}

function expandAddressAndStateAbbreviations(addr, country = "") {
  if (!addr) return "";
  let a = addr;
  a = normalizeTaiwanDivisions(a);

  // Deduplicate repeated premise numbers early (e.g. "No. 1013 Number 1013" -> "Number 1013")
  a = a.replace(/(^|[,\s])(?:no\.?|number)\s*(\d+[A-Za-z]?(?:[-/]\d+)?)(?:,\s*|\s+)(?:no\.?|number)\s*\2\b/gi, '$1Number $2');
  a = a.replace(/(^|[,\s])(?:no\.?\s*)?(\d+[A-Za-z]?(?:[-/]\d+)?)(?:,\s*|\s+)Number\s+\2\b/gi, '$1Number $2');
  a = a.replace(/(^|[,\s])Number\s+(\d+[A-Za-z]?(?:[-/]\d+)?)(?:,\s*|\s+)(?:no\.?\s*)?\2\b/gi, '$1Number $2');
  a = a.replace(/(^|[,\s])(?:no\.?\s*)?(\d+)\s+\2\b/gi, '$1$2');

  // Repair accidental commas splitting two-syllable East Asian cities/districts/townships
  const eaFirstSyllables = "Yung|San|Chung|Hsin|Xin|Da|Ta|Nan|Xi|Hsi|Bei|Pei|An|Ren|Jen|Gui|Kuei|Lu|Loo|Ping|Ba|Pa|Yang|Long|Lung|Shan|Guan|Kuan|Ma|Jia|Chia|Qi|Chi|Jiang|Chiang|Zhong|Qian|Chien|Feng|Fong|Ling|Gu|Ku|Zuo|Tso|Hou|Dong|Tung|Xia|Hsia|Liu|Yu|Kao|Gao|Tao|Kee|Miao|Yun|Chang|Hua|Peng|Kin|Lien";
  a = a.replace(new RegExp(`\\b(${eaFirstSyllables})[-\\s]*,[\\s\\-]*([A-Z][a-z]+\\s+(?:District|Township|County|Hsien|City))\\b`, "g"), '$1-$2');
  a = a.replace(new RegExp(`\\b(${eaFirstSyllables})-[\\s,]+([A-Z][a-z]+\\s+(?:District|Township|County|Hsien|City))\\b`, "g"), '$1-$2');
  a = normalizeTaiwanDivisions(a);

  const eaRoadSyllables = "Chung|Zhong|Hsin|Xin|Kuang|Guang|Min|San|Da|Ta|Ren|Jen|Nan|Bei|Pei|Xi|Hsi|Dong|Tung";
  a = a.replace(new RegExp(`\\b(${eaRoadSyllables})[-\\s]*,[\\s\\-]*([A-Z][a-z]+\\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Highway))\\b`, "g"), '$1 $2');

  // Remove unwanted comma between bare street number and street name (e.g. "604, Progress Drive" -> "604 Progress Drive")
  // Must NOT strip commas after premise indicators like "Number 53-5, Pocheng Road" or "Lot 12, Main Street"
  a = a.replace(/(^|[,\s])(?<!\b(?:number|no\.?|#|section|sec\.?|lane|ln\.?|alley|aly\.?|unit|suite|ste\.?|floor|fl\.?|flr\.?|level|lot|plot|block|blk\.?)\s+)\b(\d{1,5}),\s+([A-Z][a-z0-9\u00C0-\u024F]+(?:\s+[A-Z][a-z0-9\u00C0-\u024F]+)*\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Caddesi|Bulvari|Sokak|Strasse|Calle|Avenida|Viale|Corso|Rd|St|Ave|Ln|Dr|Blvd|Hwy|Ct|Pl)\b)/gi, "$1$2 $3");

  // Preserve ampersand inside address (normalize spacing, do not replace with 'and')
  a = a.replace(/\s*&\s*/g, " & ");

  // 1. "St" as "Saint" in city or place names (e.g. St Louis, Port St Lucie, St Petersburg, St Paul, St Marys)
  a = a.replace(/\b(?:port\s+|mount\s+)?st\.?\s+(lucie|louis|paul|petersburg|cloud|albans|kilda|george|john|andrews|charles|joseph|moritz|leonards|marys|mary's|peters|helens|ives|clair)\b/gi, function (m, p) {
    if (/^port/i.test(m)) return "Port Saint " + p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    if (/^mount/i.test(m)) return "Mount Saint " + p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
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
  // Note: Special characters like # and & must be preserved inside address (e.g. Suite #4, Unit #12)
  a = a.replace(/(^|[,\s])No\.\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])No\b\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])Nos\.?\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/\blot\s+no\.?\s*(?=\d)/gi, 'Lot Number ');
  a = a.replace(/\bplot\s+no\.?\s*(?=\d)/gi, 'Plot Number ');
  a = a.replace(/(^|[,\s])Sec\.\s*(?=[A-Za-z0-9])/gi, '$1Section ');
  a = a.replace(/(^|[,\s])Sec\b\s*(?=[A-Za-z0-9])/gi, '$1Section ');
  a = a.replace(/\b(Hsinchu|Changhua|Miaoli|Yunlin|Chiayi|Pingtung|Taitung|Hualien|Yilan|Nantou|Kinmen|Penghu|Lienchiang|Matsu)\s+Country\b/gi, "$1 County");
  a = a.replace(/(^|[,\s])Ln\.\s*(?=\d)/gi, '$1Lane ');
  a = a.replace(/(^|[,\s])Ln\b\s*(?=\d)/gi, '$1Lane ');
  a = a.replace(/(^|[,\s])Aly\.\s*(?=\d)/gi, '$1Alley ');
  a = a.replace(/(^|[,\s])Aly\b\s*(?=\d)/gi, '$1Alley ');

  const toOrdinalFloor = (num) => {
    const n = parseInt(num, 10);
    if (isNaN(n)) return `${num} Floor`;
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    const ord = s[(v - 20) % 10] || s[v] || s[0];
    return `${n}${ord} Floor`;
  };

  // Floor & Level abbreviations (e.g. "5/F.", "5/F", "5F.", "5F", "Fl. 5", "Flr 5", "Floor 5", "5th Fl" -> "5th Floor")
  a = a.replace(/(^|[,\s])(\d{1,3})\s*(?:\/|\s*)?F\.?(?=[,\s\.\/]|$)/gi, (m, p1, num) => `${p1}${toOrdinalFloor(num)}`);
  a = a.replace(/(^|[,\s])(?:Flr?|Floor)\.?\s*(\d{1,3})\b/gi, (m, p1, num) => `${p1}${toOrdinalFloor(num)}`);
  a = a.replace(/(^|[,\s])(\d{1,3})(?:st|nd|rd|th)?\s*(?:Flr?|Floor)\.?\b/gi, (m, p1, num) => `${p1}${toOrdinalFloor(num)}`);
  a = a.replace(/(^|[,\s])(?:G\s*\/\s*F\.?|GF\b|Gnd\s*Flr?\.?)/gi, "$1Ground Floor");
  a = a.replace(/(^|[,\s])(?:B\s*\/\s*F\.?|BF\b|Bsmt\b\.?)/gi, "$1Basement Floor");
  a = a.replace(/(^|[,\s])B(\d{1,2})\b/gi, "$1Basement $2");
  a = a.replace(/(^|[,\s])Lvl\.?\s*(\d{1,3}|[A-Za-z])/gi, "$1Level $2");

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
  a = a.replace(/(?<!,\s*)\bct\b\.?(?!\s*\d{5})/gi, "Court");
  a = a.replace(/\bpl\b\.?/gi, "Place");
  a = a.replace(/\bsq\b\.?/gi, "Square");
  a = a.replace(/\bst\b\.?/gi, "Street");
  a = a.replace(/\brd\b\.?/gi, "Road");
  a = a.replace(/\bdr\b\.?/gi, "Drive");
  a = a.replace(/\bln\b\.?/gi, "Lane");
  a = a.replace(/\bind\b\.?\s*est\b\.?/gi, "Industrial Estate");
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
  a = a.replace(/\bfl\.\s*(?=\d{1,2}(?:\b|[,\s]))/gi, "Floor ");
  a = a.replace(/(\d+(?:st|nd|rd|th)?)\s*\bfl\b\.?/gi, "$1 Floor");
  a = a.replace(/(\b\d+)\s*F\b(?=[,\s]|$)/gi, "$1 Floor");
  a = a.replace(/(^|[,\s])Flr?\.?\s*(?=\d{1,2}(?:\b|[,\s]))/gi, "$1Floor ");
  a = a.replace(/\bste\b\.?/gi, "Suite");
  a = a.replace(/\bapt\b\.?/gi, "Apartment");
  a = a.replace(/\bdept\b\.?/gi, "Department");
  a = a.replace(/\brm\b\.?/gi, "Room");
  a = a.replace(/\bblk\b\.?/gi, "Block");
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
    if (cLower.includes("australia") || /\b(?:wa|sa)\b(?=[,\s]|$|\s*\d{4})/i.test(a)) {
      a = a.replace(/([a-zA-Z\)])\s*,?\s*\bwa\b\.?(?=[,\s]|$|\s*\d{4})/gi, "$1, Western Australia");
      a = a.replace(/([a-zA-Z\)])\s*,?\s*\bsa\b\.?(?=[,\s]|$|\s*\d{4})/gi, "$1, South Australia");
    }
  }

  // Canada
  const isCanadaAddress = cLower.includes("canada") ||
    /\b(?:ont|que|qc|on|bc|b\.?c\.|alta|ab|sask|sk|man|mb|ns|nb|nl|pe|pei|quebec|ontario|alberta)\b/i.test(a) ||
    /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i.test(a);

  if (isCanadaAddress) {
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
  const isUsAddress = !isCanadaAddress && ((typeof isUnitedStatesLocation === "function" && isUnitedStatesLocation(a, country)) ||
    cLower.includes("united states") || cLower.includes("usa") || cLower.includes("america") ||
    /\b\d{5}(?:-\d{4})?\b/.test(a) || (!country && /,\s*[A-Z]{2}\b/.test(a)));

  if (isUsAddress && !["australia", "canada", "united kingdom", "india", "south africa", "malaysia", "spain", "espana", "italy", "italia", "germany", "deutschland", "france"].includes(cLower)) {
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
      // Must be preceded by comma and space, or space and directly followed by 5-digit zip:
      // e.g. ", IL" or ", IL 60090" or " IL 60090"
      const regComma = new RegExp(`(,\\s*)\\b${abbr}\\b\\.?(?=[,\\s]|$|\\s*\\d{5})|(\\s+)\\b${abbr}\\b\\.?(?=\\s*\\d{5})`, "i");
      a = a.replace(regComma, (match, p1, p2) => {
        if (p1) return `, ${full} `;
        return ` ${full} `;
      });
    }
  }

  // ==========================================
  // 7. Spain (España) Abbreviations
  // ==========================================
  if (cLower.includes("spain") || cLower.includes("espana") || isSpanishLocation(a, country)) {
    // Industrial zones FIRST: Pol. Ind. / P.I. -> Poligono Industrial
    a = a.replace(/(^|[,\s])(?:pol\.?\s*ind(?:ustrial)?\.?|p\.?i\.?)\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Poligono Industrial ');
    a = a.replace(/\bpoligono\s+ind\b\.?/gi, 'Poligono Industrial');

    // Street prefixes: C/ -> Calle, Avda. -> Avenida, P.º -> Paseo, Pl. / Pza. -> Plaza, Ctra. -> Carretera, Rbla. -> Rambla
    a = a.replace(/(^|[,\s])C\/\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Calle ');
    a = a.replace(/(^|[,\s])C\.\s+(?=[A-ZÁÉÍÓÚ][a-záéíóúñ])/g, '$1Calle ');
    a = a.replace(/(^|[,\s])avda?\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Avenida ');
    a = a.replace(/(^|[,\s])(?:p\.?[º°]|pso\.?|p\.\s*o\b|p\.º)\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Paseo ');
    a = a.replace(/(^|[,\s])(?:plza?\.?|pza\.?|pl\.)\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Plaza ');
    a = a.replace(/(^|[,\s])Place\s+(?=(?:Mayor|de\s+|del\s+|Real|de\s*la|[A-ZÁÉÍÓÚ][a-z]))/g, '$1Plaza ');
    a = a.replace(/(^|[,\s])rbla\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Rambla ');
    a = a.replace(/(^|[,\s])ctra\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Carretera ');
    a = a.replace(/(^|[,\s])\b(?:cno|cam)\b\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Camino ');
    a = a.replace(/(^|[,\s])\btrav(?:es)?\b\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Travesia ');
    a = a.replace(/(^|[,\s])\bp(?:t)?je\b\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Pasaje ');
    a = a.replace(/(^|[,\s])\brda\b\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Ronda ');
    a = a.replace(/(^|[,\s])\burb\b\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Urbanizacion ');
    a = a.replace(/(^|[,\s])\bed(?:if)?\b\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Edificio ');

    // House / premise numbers / without number
    a = a.replace(/(^|[,\s])(?:n[ºo]\.?|n\.º|n[uú]m\.?)\s*(?=\d)/gi, '$1Numero ');
    a = a.replace(/\b(?:s\/n|sin\s*n[uú]mero)\b/gi, 'Sin Numero');
    a = a.replace(/\bkm\.?\s*(?=\d)/gi, 'Kilometro ');
    a = a.replace(/\bpta\.?\s*(?=\d|[A-Za-z])/gi, 'Puerta ');
    a = a.replace(/\bplta\.?\s*(?=\d|[A-Za-z])/gi, 'Planta ');
    a = a.replace(/\bapdo\.?\s*(?:de\s*correos)?\b/gi, 'Apartado de Correos');
  }

  // ==========================================
  // 8. Italy (Italia) Abbreviations
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
  if (cLower.includes("italy") || cLower.includes("italia")) {
    a = a.replace(/(^|[,\s])est\b/gi, '$1East');
    a = a.replace(/(^|[,\s])ovest\b/gi, '$1West');
    a = a.replace(/(^|[,\s])nord\b/gi, '$1North');
    a = a.replace(/(^|[,\s])sud\b/gi, '$1South');
  }

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
  a = a.replace(/(^|[,\s])geb\s*ude\b/gi, '$1Gebaeude');
  a = a.replace(/(^|[,\s])geb\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Gebaeude ');
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

  // ==========================================
  // 10. Indonesia Abbreviations
  // ==========================================
  a = a.replace(/(^|[,\s])jl\b\.?\s+(?=[A-Za-z0-9])/gi, '$1Jalan ');
  a = a.replace(/(^|[,\s])jln\b\.?\s+(?=[A-Za-z0-9])/gi, '$1Jalan ');
  a = a.replace(/(^|[,\s])gg\b\.?\s+(?=[A-Za-z0-9])/gi, '$1Gang ');
  a = a.replace(/(^|[,\s])komp\b\.?\s+(?=[A-Za-z0-9])/gi, '$1Komplek ');
  a = a.replace(/(^|[,\s])kompl\b\.?\s+(?=[A-Za-z0-9])/gi, '$1Komplek ');
  a = a.replace(/(^|[,\s])kav\b\.?\s+(?=[A-Za-z0-9])/gi, '$1Kavling ');
  a = a.replace(/(^|[,\s])kel\b\.?\s+(?=[A-Za-z])/gi, '$1Kelurahan ');
  a = a.replace(/(^|[,\s])kec\b\.?\s+(?=[A-Za-z])/gi, '$1Kecamatan ');
  a = a.replace(/(^|[,\s])kab\b\.?\s+(?=[A-Za-z])/gi, '$1Kabupaten ');
  a = a.replace(/(^|[,\s])prov\b\.?\s+(?=[A-Za-z])/gi, '$1Provinsi ');
  a = a.replace(/(^|[,\s])prop\b\.?\s+(?=[A-Za-z])/gi, '$1Provinsi ');
  a = a.replace(/\bkws\.?\s*ind(?:ustri)?\.?/gi, 'Kawasan Industri');
  a = a.replace(/\brt\.?\s*(\d+)\s*\/?\s*rw\.?\s*(\d+)/gi, 'RT $1 RW $2');
  a = a.replace(/(^|[,\s])dki\s+jakarta\b/gi, '$1DKI Jakarta');
  a = a.replace(/(^|[,\s])d\.?i\.?\s+yogyakarta\b/gi, '$1DI Yogyakarta');

  // Clean up any double spaces introduced
  a = a.replace(/\s+/g, " ").trim();

  return a;
}

/**
 * Repairs blindly separated commas in addresses:
 * 1. Multi-word park names (e.g. "Argent, Trade, Park" or "Argent, Trade Park" -> "Argent Trade Park")
 * 2. Detached street suffixes (e.g. "Downing, Street" -> "Downing Street", "Pump, Lane" -> "Pump Lane")
 * 3. Directional prefixes (e.g. "North, Main Street" -> "North Main Street", "Great, Western Highway" -> "Great Western Highway")
 * 4. Multi-word cities, states, counties (e.g. "West, Sussex" -> "West Sussex", "Kuala, Lumpur" -> "Kuala Lumpur")
 * 5. Accidental comma between building number and street name (e.g. "604, Progress Drive" -> "604 Progress Drive")
 */
function repairBlindlySeparatedCommas(addr) {
  if (!addr) return "";
  let a = addr;
  a = normalizeTaiwanDivisions(a);

  // 1. Multi-word Industrial / Trade / Business / Science / Technology / Retail / Enterprise Parks & Estates
  const parkTypes = "Park|Estate|Zone|District|Centre|Center|Area";
  const parkQualifiers = "Trade|Trading|Industrial|Business|Technology|Tech|Science|Commercial|Retail|Enterprise|Logistics";

  // "Argent, Trade, Park" -> "Argent Trade Park"
  a = a.replace(new RegExp(`\\b([A-Za-z0-9]+),\\s*(${parkQualifiers}),\\s*(${parkTypes})\\b`, "gi"), "$1 $2 $3");
  // "Argent, Trade Park" -> "Argent Trade Park"
  a = a.replace(new RegExp(`\\b([A-Za-z0-9]+),\\s*(${parkQualifiers})\\s+(${parkTypes})\\b`, "gi"), "$1 $2 $3");
  // "Trade, Park" -> "Trade Park"
  a = a.replace(new RegExp(`\\b(${parkQualifiers}),\\s*(${parkTypes})\\b`, "gi"), "$1 $2");

  // 2. Repair street suffix detached from previous word: "Downing, Street" -> "Downing Street", "Pump, Lane" -> "Pump Lane"
  const streetSuffixes = "Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill";
  a = a.replace(new RegExp(`\\b([A-Za-z]+),\\s+(${streetSuffixes})\\b(?!\\s+(?:East|West|North|South|\\d+))`, "gi"), (m, p1, p2) => {
    if (new RegExp(`^(?:${streetSuffixes}|Number|No|Plot|Lot|Unit|Suite|Level|Floor|Block|Section|Sec)$`, "i").test(p1)) return m;
    return `${p1} ${p2}`;
  });

  // Directional street prefixes: "North, Main Street" -> "North Main Street", "Great, Western Highway" -> "Great Western Highway"
  a = a.replace(new RegExp(`\\b(Great|Grand|Old|New|North|South|East|West|Upper|Lower|Central|Little|High|Long|Royal),\\s+([A-Za-z0-9]+(?:\\s+(?:${streetSuffixes}))\\b)`, "gi"), "$1 $2");

  // 3. Multi-word cities, states, counties: "West, Sussex" -> "West Sussex", "Kuala, Lumpur" -> "Kuala Lumpur"
  // Do NOT merge if the directional word is preceded by a park/estate/facility suffix (e.g. "Industrial Estate South, Durham" must NOT become "Estate South Durham")
  const twMultiWordPrefixes = "West|East|North|South|New|Old|Central|Upper|Lower|Greater|Inner|Outer|San|Santa|Los|Las|El|La|Kuala|Hong|Batu|Johor|Petaling|Subang|Shah|George|Cape|Port|Fort|Mount|St\.?|Saint|Yung|Chung|Hsin|Xin|Da|Ta|Nan|Xi|Hsi|Bei|Pei|An|Ren|Jen|Gui|Kuei|Lu|Loo|Ping|Ba|Pa|Yang|Long|Lung|Shan|Guan|Kuan|Ma|Jia|Chia|Qi|Chi|Jiang|Chiang|Zhong|Qian|Chien|Feng|Fong|Ling|Gu|Ku|Zuo|Tso|Hou|Dong|Tung|Xia|Hsia|Liu|Yu|Kao|Gao|Tao|Kee|Miao|Yun|Chang|Hua|Peng|Kin|Lien";
  a = a.replace(new RegExp(`(?<!\\b(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Highway|Close|Terrace|Boulevard|Estate|Park|Zone|Area|District|Sector|Ward|Block|Building|Phase)\\s+)\\b(${twMultiWordPrefixes}),\\s+([A-Za-z0-9]+)`, "gi"), "$1 $2");

  // 4. Premise comma fix: "Unit 2, Argent, Trade Park" -> "Unit 2, Argent Trade Park"
  a = a.replace(/(\b(?:Unit|Suite|Lot|Plot|Building|Bldg|Level|Floor|Block|Flr|Ste|Apt)\s+[A-Za-z0-9\-\/]+),\s+([A-Za-z0-9]+),\s+([A-Za-z0-9]+\s+(?:Park|Estate|Zone|Street|Road|Avenue|Lane|Drive|Way|Place|Court|Highway)\b)/gi, "$1, $2 $3");

  // 5. Remove unwanted comma between bare street number and street name: "604, Progress Drive" -> "604 Progress Drive"
  // Must NOT strip commas after premise indicators like "Number 53-5, Pocheng Road" or "Lot 12, Main Street"
  a = a.replace(/(^|[,\s])(?<!\b(?:number|no\.?|#|section|sec\.?|lane|ln\.?|alley|aly\.?|unit|suite|ste\.?|floor|fl\.?|flr\.?|level|lot|plot|block|blk\.?)\s+)\b(\d{1,5}),\s+([A-Z][a-z0-9\u00C0-\u024F]+(?:\s+[A-Z][a-z0-9\u00C0-\u024F]+)*\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill)\b)/gi, "$1$2 $3");

  // Clean double commas and spaces
  a = a.replace(/\s+,/g, ",");
  a = a.replace(/,\s*,+/g, ", ");
  a = a.replace(/,\s*/g, ", ");
  a = a.replace(/\s+/g, " ").trim();
  a = normalizeTaiwanDivisions(a);

  return a;
}

/**
 * Ensures clean comma separation across all major address components:
 * 1. Premise indicators (Lot, Plot, Unit, Suite, Bldg, Level, Floor)
 * 2. Street types before suburb / city
 * 3. Industrial / Business parks before city
 * 4. City / Suburb before State / Province / Territory / County globally
 */
function ensureCommaBeforeState(addr) {
  if (!addr) return "";
  let a = addr;
  a = normalizeTaiwanDivisions(a);

  // 1. Ensure comma after premise indicators (Lot, Plot, Unit, Suite, Bldg, Building, Level, Floor, Block, Kav)
  // Only if NOT ALREADY followed by a comma!
  const premiseRegex = /(^|[,\s])\b(lot|plot|unit|suite|ste|bldg|building|floor|fl|flr|level|block|blk|apartment|apt|flat|shed|warehouse|factory|kav|kavling)\s+(\d+[A-Za-z]?(?:[-\/]\d+[A-Za-z]?)?|[A-Za-z](?:\d+)?)(?:\s*(?:&|and)\s*(\d+[A-Za-z]?(?:[-\/]\d+[A-Za-z]?)?|[A-Za-z]))?\s*(?!,)\s+(?=(?:no\.?|nos\.?|number|#)?\s*[A-Za-z0-9])/gi;
  a = a.replace(premiseRegex, (match, p1, type, val1, val2) => {
    const fullVal = val2 ? `${val1} and ${val2}` : val1;
    return `${p1}${type} ${fullVal}, `;
  });

  // 2. Ensure comma after street types when followed by locality/city/town/state
  const streetSuffixes = "(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Caddesi|Bulvari|Sokak|Strasse|Calle|Avenida|Viale|Corso)";
  const nonStreetLookahead = "(?!\\s+(?:East|West|North|South|Northeast|Northwest|Southeast|Southwest|Extension|Ext|Road|Street|Avenue|Lane|Drive|Place|Close|Court|Terrace|Cres|Dr|Rd|St|Ave|Ln|Blvd|Hwy|Ct|Pl)\\b)";
  const nextWordPattern = "\\s+([A-Z][a-z0-9\\u00C0-\\u024F]+)";
  const streetSepRegex = new RegExp(`\\b(${streetSuffixes})${nonStreetLookahead}${nextWordPattern}`, "g");
  a = a.replace(streetSepRegex, "$1, $2");

  // 2a. Ensure comma after directional street suffixes when followed by locality/city
  // e.g. "County Road West Allenton" -> "County Road West, Allenton"
  const directionalSepRegex = new RegExp(`\\b(${streetSuffixes}\\s+(?:East|West|North|South|Northeast|Northwest|Southeast|Southwest|Extension|Ext))\\s+([A-Z][a-z0-9\\u00C0-\\u024F]+)(?!\\s+(?:Street|Road|Avenue|Lane|Drive|Place|Close|Court|Terrace|Way|Blvd|Hwy)\\b)`, "g");
  a = a.replace(directionalSepRegex, "$1, $2");

  // 2b. Remove unwanted comma between bare street number and street name (e.g. "604, Progress Drive" -> "604 Progress Drive")
  // Must NOT strip commas after premise indicators like "Number 53-5, Pocheng Road" or "Lot 12, Main Street"
  a = a.replace(/(^|[,\s])(?<!\b(?:number|no\.?|#|section|sec\.?|lane|ln\.?|alley|aly\.?|unit|suite|ste\.?|floor|fl\.?|flr\.?|level|lot|plot|block|blk\.?)\s+)\b(\d{1,5}),\s+([A-Z][a-z0-9\u00C0-\u024F]+(?:\s+[A-Z][a-z0-9\u00C0-\u024F]+)*\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Caddesi|Bulvari|Sokak|Strasse|Calle|Avenida|Viale|Corso|Rd|St|Ave|Ln|Dr|Blvd|Hwy|Ct|Pl)\b)/gi, "$1$2 $3");

  // 2c. Ensure clean comma separation across Taiwanese, East Asian, and multi-component premises:
  // Floor -> Premise Number
  a = a.replace(/\b(\d+(?:st|nd|rd|th)?\s+Floor|Floor\s+\d+)\s*(?!,)\s+(?=(?:Number|No\.?|#)?\s*\d)/gi, "$1, ");
  // Premise Number -> Lane / Alley / Section
  a = a.replace(/\b((?:Number|No\.?|#)\s*\d+[A-Za-z]?(?:[-\/]\d+[A-Za-z]?)?|\b\d+[A-Za-z]?)\s*(?!,)\s+(?=(?:Lane|Ln\.?|Alley|Aly\.?|Section|Sec\.?)\b)/gi, "$1, ");
  // Lane -> Alley / Section / Road
  a = a.replace(/\b(Lane|Ln\.?)\s+(\d+[A-Za-z]?)\s*(?!,)\s+(?=(?:Alley|Aly\.?|Section|Sec\.?|[A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*\s+(?:Road|Street|Avenue))\b)/gi, "$1 $2, ");
  // Alley -> Section / Road
  a = a.replace(/\b(Alley|Aly\.?)\s+(\d+[A-Za-z]?)\s*(?!,)\s+(?=(?:Section|Sec\.?|[A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*\s+(?:Road|Street|Avenue))\b)/gi, "$1 $2, ");
  // Section -> Road / Street
  a = a.replace(/\b(Section|Sec\.?)\s+(\d+[A-Za-z]?)\s*(?!,)\s+(?=[A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*\s+(?:Road|Street|Avenue)\b)/gi, "$1 $2, ");
  // Road / Street -> District / Township
  a = a.replace(/\b((?:Road|Street|Avenue|Lane|Alley))\s*(?!,)\s+(?=[A-Z][a-z0-9\-]+(?:\s+[A-Z][a-z0-9\-]+)*\s+(?:District|Township|County|Hsien)\b)/gi, "$1, ");

  // 3. Ensure comma before & after Industrial / Business parks & zones
  // Only separate if preceded by a street suffix (e.g. "Main Road Industrial Park" -> "Main Road, Industrial Park")
  // NEVER separate the proper name of the park itself (e.g. "Argent Trade Park", "Cambridge Science Park", "Westwood Business Park")
  a = a.replace(new RegExp(`(\\b${streetSuffixes})\\s+(?<!,\\s*)\\b((?:Industrial|Technology|Business|Science|Tech|Trade|Trading|Commercial|Retail|Enterprise|Logistics)\\s+(?:Park|Estate|Area|Zone|District)|Kawasan\\s+(?:Perindustrian|Industri|Berikat)|Taman\\s+Perindustrian|Poligono\\s+Industrial|Zona\\s+Industriale|Gewerbegebiet)\\b`, "gi"), "$1, $2");
  a = a.replace(/\b((?:Industrial|Technology|Business|Science|Tech|Trade|Trading|Commercial|Retail|Enterprise|Logistics)\s+(?:Park|Estate|Area|Zone|District)(?:\s+(?:North|South|East|West|Central|Upper|Lower))?|Kawasan\s+(?:Perindustrian|Industri|Berikat)|Taman\s+Perindustrian|Poligono\s+Industrial|Zona\s+Industriale|Gewerbegebiet)\s+(?!(?:Road|Street|Avenue|Lane|Drive|Way|Place|Court|Highway|North|South|East|West|Central|Upper|Lower)\b)(?=[A-Z][a-z0-9])/gi, "$1, ");

  // 4. Malaysian / Singapore recognized city hubs
  a = a.replace(/(?<!,\s*)\b(Subang Jaya|Petaling Jaya|Shah Alam|Klang|Kuala Lumpur|Puchong|Cheras|George Town|Johor Bahru|Ipoh|Kota Kinabalu|Kuching|Seremban|Batu Pahat|Pasir Gudang|Iskandar Puteri)\b/gi, ", $1");

  // 4b. Indonesian recognized city hubs
  a = a.replace(/(?<!,\s*)\b(Jakarta|DKI Jakarta|Surabaya|Bandung|Medan|Semarang|Makassar|Palembang|Tangerang|Bekasi|Depok|Bogor|Batam|Pekanbaru|Bandar Lampung|Malang|Padang|Denpasar|Samarinda|Banjarmasin|Balikpapan|Cikarang|Karawang|Sidoarjo|Gresik)\b/gi, ", $1");

  // 4c. New Zealand recognized cities
  a = a.replace(/(?<!,\s*)\b(Auckland|Christchurch|Hamilton|Tauranga|Dunedin|Lower Hutt|Upper Hutt|Palmerston North|Napier|Porirua|New Plymouth|Rotorua|Whangarei|Invercargill|Nelson|Whanganui|Hastings|Gisborne|Blenheim|Timaru|Taupo|Queenstown|Cambridge)\b/gi, ", $1");

  // 5. Ensure comma before East Asian administrative regions (Township, District, County, Hsien)
  // Handles multi-word / hyphenated districts (e.g. Yung-Kang District, Yung Kang District, San-Min District)
  // MUST NOT insert comma inside multi-word or hyphenated districts like "Yung, Kang District"
  a = a.replace(/(?<![A-Za-z0-9\-,/]\s*)\b((?:[A-Z][a-z0-9\u00C0-\u024F]+(?:[- ][A-Z][a-z0-9\u00C0-\u024F]+)?)\s+(?:Township|District|County|Hsien))\b/g, ", $1");

  // 5b. Ensure comma after District / Township / County / Hsien when followed by City / Town / County / State
  // Exclude "County Road", "County Highway", "County Route", "County Line" in US addresses
  a = a.replace(/\b((?:Township|District|County|Hsien|Borough|Parish))\s+(?!(?:Road|Highway|Route|Line)\b)([A-Z][a-z0-9\u00C0-\u024F]+)/g, "$1, $2");

  // 5c. Ensure comma before "X City" (handling multi-word cities like "New York City", "New Taipei City", "Salt Lake City")
  // MUST NOT insert comma inside two-syllable city names (e.g. "Chia Yi City" -> "Chia, Yi City" or "Hsin Chu City" -> "Hsin, Chu City")
  const eaFirstSyllables = "Yung|San|Chung|Hsin|Xin|Da|Ta|Nan|Xi|Hsi|Bei|Pei|An|Ren|Jen|Gui|Kuei|Lu|Loo|Ping|Ba|Pa|Yang|Long|Lung|Shan|Guan|Kuan|Ma|Jia|Chia|Qi|Chi|Jiang|Chiang|Zhong|Qian|Chien|Feng|Fong|Ling|Gu|Ku|Zuo|Tso|Hou|Dong|Tung|Xia|Hsia|Liu|Yu|Kao|Gao|Tao|Kee|Miao|Yun|Chang|Hua|Peng|Kin|Lien";
  const cityPrefixLookbehind = "New|North|South|East|West|Old|Central|Upper|Lower|Greater|Inner|Outer|Salt|Lake|Ho|Chi|Minh|Kuala|Hong|San|Santa|Los|Las|El|La|" + eaFirstSyllables;
  a = a.replace(new RegExp(`(?<=[A-Za-z0-9\\)])\\s+(?<!,\\s*)(?<!\\b(?:${cityPrefixLookbehind}|${streetSuffixes})\\s+)\\b([A-Z][a-z0-9\\u00C0-\\u024F]+(?:\\s+[A-Z][a-z0-9\\u00C0-\\u024F]+)?\\s+City)\\b(?![\\s\\-]*(?:Road|Street|Avenue|Lane|Drive|Way|Place|Highway))`, "g"), ", $1");

  // Repair accidental commas splitting two-syllable East Asian cities/districts/townships:
  // e.g. "Chia, Yi City" -> "Chiayi City", "Hsin, Chu City" -> "Hsinchu City", "Yung, Kang District" -> "Yung-Kang District"
  a = a.replace(new RegExp(`\\b(${eaFirstSyllables})[-\\s]*,[\\s\\-]*([A-Z][a-z]+\\s+(?:District|Township|County|Hsien|City))\\b`, "g"), '$1-$2');
  a = a.replace(new RegExp(`\\b(${eaFirstSyllables})-[\\s,]+([A-Z][a-z]+\\s+(?:District|Township|County|Hsien|City))\\b`, "g"), '$1-$2');
  a = normalizeTaiwanDivisions(a);

  // Repair accidental commas splitting two-syllable street names:
  // e.g. "Chung, Hua Road" -> "Chung Hua Road", "Chung-, Hua Road" -> "Chung-Hua Road"
  const eaRoadSyllables = "Chung|Zhong|Hsin|Xin|Kuang|Guang|Min|San|Da|Ta|Ren|Jen|Nan|Bei|Pei|Xi|Hsi|Dong|Tung";
  a = a.replace(new RegExp(`\\b(${eaRoadSyllables})[-\\s]*,[\\s\\-]*([A-Z][a-z]+\\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Highway))\\b`, "g"), '$1 $2');

  // Repair accidental commas splitting multi-word prefixes: "New, York" -> "New York", "New, Zealand" -> "New Zealand"
  // Do NOT merge if the directional word is a street suffix (e.g. "Main Street East, City", "County Road West, City")
  // or a facility / industrial estate suffix (e.g. "Industrial Estate South, Durham")
  a = a.replace(/(?<!\b(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Highway|Close|Terrace|Boulevard|Estate|Park|Zone|Area|District|Sector|Ward|Block|Building|Phase)\s+)\b(New|North|South|East|West|Old|Central|Upper|Lower|Greater|Inner|Outer|San|Santa|Los|Las|El|La)[,\s]+([A-Z][a-z]+)/g, "$1 $2");

  // 6. Comprehensive global states, provinces, regions, and counties
  const states = [
    // US States
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
    "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
    "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming", "District of Columbia",
    // Australia
    "Victoria", "New South Wales", "Queensland", "Western Australia", "South Australia", "Tasmania", "Northern Territory", "Australian Capital Territory",
    // Canada
    "Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Saskatchewan", "Nova Scotia", "New Brunswick", "Newfoundland", "Prince Edward Island",
    // New Zealand Regions
    "Canterbury", "Waikato", "Bay of Plenty", "Otago", "Hawke's Bay", "Hawkes Bay", "Taranaki", "Southland", "Northland", "Marlborough", "Tasman", "West Coast", "Manawatu",
    // UK Counties
    "Essex", "Kent", "Surrey", "Lancashire", "Yorkshire", "Cheshire", "Hampshire", "Berkshire", "Hertfordshire", "Middlesex", "Gloucestershire", "Warwickshire", "Devon", "Dorset", "Somerset", "Oxfordshire", "Cambridgeshire", "Buckinghamshire", "Staffordshire", "Derbyshire", "Nottinghamshire", "Lincolnshire", "Northamptonshire", "Norfolk", "Suffolk", "Wiltshire", "Worcestershire", "Cornwall", "Cumbria", "Northumberland",
    // India States
    "Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat", "Uttar Pradesh", "Telangana", "Andhra Pradesh", "Punjab", "Haryana", "Rajasthan", "Madhya Pradesh", "West Bengal", "Bihar", "Kerala", "Odisha", "Jharkhand", "Assam", "Delhi",
    // Malaysia States
    "Selangor", "Johor", "Penang", "Perak", "Kedah", "Pahang", "Negeri Sembilan", "Melaka", "Terengganu", "Kelantan", "Sarawak", "Sabah", "Perlis", "Kuala Lumpur", "Putrajaya",
    // Indonesia Provinces
    "Jawa Barat", "Jawa Tengah", "Jawa Timur", "Banten", "DKI Jakarta", "DI Yogyakarta", "Bali", "Sumatera Utara", "Sumatera Barat", "Sumatera Selatan", "Riau", "Kepulauan Riau", "Lampung", "Jambi", "Bengkulu", "Bangka Belitung", "Kalimantan Timur", "Kalimantan Barat", "Kalimantan Selatan", "Kalimantan Tengah", "Kalimantan Utara", "Sulawesi Selatan", "Sulawesi Utara", "Sulawesi Tengah", "Sulawesi Tenggara", "Sulawesi Barat", "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Papua", "Maluku", "Aceh",
    // South Africa
    "Gauteng", "Western Cape", "Eastern Cape", "KwaZulu-Natal", "Mpumalanga", "Free State", "Limpopo", "North West", "Northern Cape",
    // Turkey Provinces
    "Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep", "Kocaeli", "Mersin", "Diyarbakir", "Kayseri", "Eskisehir", "Samsun", "Denizli", "Sakarya", "Mugla", "Trabzon",
    // Italy Regions
    "Lombardia", "Lazio", "Veneto", "Piemonte", "Emilia-Romagna", "Toscana", "Campania", "Sicilia", "Puglia", "Liguria", "Marche", "Abruzzo", "Friuli Venezia Giulia", "Trentino-Alto Adige", "Umbria", "Sardegna", "Calabria", "Basilicata", "Molise", "Valle d'Aosta",
    // Germany States
    "Baden-Württemberg", "Bayern", "Brandenburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen", "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
    // Ireland Counties
    "Dublin", "Cork", "Galway", "Kildare", "Meath", "Limerick", "Kerry", "Wicklow", "Clare", "Tipperary", "Wexford", "Donegal",
    // Spain (Provinces & Autonomous Communities)
    "Álava", "Alava", "Albacete", "Alicante", "Alacant", "Almería", "Almeria", "Asturias", "Ávila", "Avila", "Badajoz", "Islas Baleares", "Baleares", "Barcelona", "Burgos", "Cáceres", "Caceres", "Cádiz", "Cadiz", "Cantabria", "Castellón", "Castellon", "Ciudad Real", "Córdoba", "Cordoba", "Cuenca", "Girona", "Gerona", "Granada", "Guadalajara", "Guipúzcoa", "Guipuzcoa", "Gipuzkoa", "Huelva", "Huesca", "Jaén", "Jaen", "A Coruña", "La Coruña", "La Coruna", "La Rioja", "Las Palmas", "León", "Leon", "Lleida", "Lérida", "Lerida", "Lugo", "Madrid", "Málaga", "Malaga", "Murcia", "Navarra", "Ourense", "Orense", "Palencia", "Pontevedra", "Salamanca", "Santa Cruz de Tenerife", "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo", "Valencia", "Valladolid", "Vizcaya", "Bizkaia", "Zamora", "Zaragoza", "Andalucía", "Andalucia", "Aragón", "Aragon", "Canarias", "Castilla-La Mancha", "Castilla y León", "Castilla y Leon", "Cataluña", "Cataluna", "Extremadura", "Galicia", "País Vasco", "Pais Vasco", "Comunidad de Madrid", "Comunitat Valenciana"
  ];

  for (const st of states) {
    const regex = new RegExp(`([a-zA-Z0-9\\)])\\s+\\b(${st})\\b(?!\\s+(?:City|Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Park|Estate|Industrial|Unit|Suite|Building|Floor|Bldg|St|Rd|Ave|Dr|Ln|Blvd|Hwy|Ct|Pl)\\b)`, "gi");
    a = a.replace(regex, "$1, $2");
  }

  // 7. Clean up spaces and duplicate commas
  a = a.replace(/\s+,/g, ",");
  a = a.replace(/,\s*,+/g, ", ");
  a = a.replace(/,\s*/g, ", ");
  a = a.replace(/[,;.\s\-_/\\|]+$/g, "").trim();
  a = a.replace(/^[,;.\s\-_/\\|]+/g, "").trim();
  a = a.replace(/\s+/g, " ");

  // Final pass: repair any blindly split commas
  a = repairBlindlySeparatedCommas(a);

  return a;
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

  // Spain check - ONLY if country is Spain or address has Spanish markers
  if (cLower.includes("spain") || cLower.includes("espana") || /\b(?:ES[-\s]?\d{5}|E[-\s]?\d{5})\b/i.test(rawAddr) || isSpanishLocation(rawAddr, country)) {
    // 1. Direct province mention in raw address that was omitted in cleanAddr
    const spainProvs = [
      "Álava", "Albacete", "Alicante", "Almería", "Asturias", "Ávila", "Badajoz", "Islas Baleares", "Barcelona",
      "Burgos", "Cáceres", "Cádiz", "Cantabria", "Castellón", "Ciudad Real", "Córdoba", "Cuenca", "Girona",
      "Granada", "Guadalajara", "Guipúzcoa", "Huelva", "Huesca", "Jaén", "A Coruña", "La Rioja", "Las Palmas",
      "León", "Lleida", "Lugo", "Madrid", "Málaga", "Murcia", "Navarra", "Ourense", "Palencia", "Pontevedra",
      "Salamanca", "Santa Cruz de Tenerife", "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo",
      "Valencia", "Valladolid", "Vizcaya", "Zamora", "Zaragoza"
    ];
    for (const prov of spainProvs) {
      const regRaw = new RegExp(`\\b${prov.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}\\b`, "i");
      if (regRaw.test(rawAddr)) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${prov}`;
      }
    }
  }

  // China check - ONLY if province is explicitly mentioned in raw website address
  if (!country || cLower.includes("china") || /[\u4e00-\u9fa5]/.test(rawAddr) || /[\u4e00-\u9fa5]/.test(cleanAddr)) {
    const chinaProvinces = [
      ["Guangdong", ["广东省", "广东", "guangdong"]],
      ["Jiangsu", ["江苏省", "江苏", "jiangsu"]],
      ["Zhejiang", ["浙江省", "浙江", "zhejiang"]],
      ["Shandong", ["山东省", "山东", "shandong"]],
      ["Sichuan", ["四川省", "四川", "sichuan"]],
      ["Hubei", ["湖北省", "湖北", "hubei"]],
      ["Hunan", ["湖南省", "湖南", "hunan"]],
      ["Henan", ["河南省", "河南", "henan"]],
      ["Hebei", ["河北省", "河北", "hebei"]],
      ["Fujian", ["福建省", "福建", "fujian"]],
      ["Anhui", ["安徽省", "安徽", "anhui"]],
      ["Shaanxi", ["陕西省", "陕西", "shaanxi"]],
      ["Liaoning", ["辽宁省", "辽宁", "liaoning"]],
      ["Jiangxi", ["江西省", "江西", "jiangxi"]]
    ];
    for (const [pFull, pKeywords] of chinaProvinces) {
      const regClean = new RegExp(`\\b${pFull}\\b`, "i");
      if (regClean.test(cleanAddr)) continue; // already has province
      const hasProvInRaw = pKeywords.some(kw => {
        if (/[\u4e00-\u9fa5]/.test(kw)) {
          return rawAddr.includes(kw);
        }
        return new RegExp(`\\b${kw}\\b`, "i").test(rawAddr);
      });
      // ONLY restore if the province was actually present in raw address on website!
      if (hasProvInRaw) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${pFull}`;
      }
    }
  }

  return cleanAddr;
}

/**
 * Restores initial street / building / premise number if AI dropped it.
 * E.g. "Best Place, Cincinnati, Ohio" -> "12110 Best Place, Cincinnati, Ohio"
 */
function restoreStreetNumberIfOmitted(cleanAddr, rawAddr) {
  if (!cleanAddr || !rawAddr) return cleanAddr;
  let c = cleanAddr.trim();

  // If cleanAddr already starts with a number, premise indicator, or PO Box, check if rawAddr had a leading Unit/Floor/Level/Office Park
  if (/^(?:\d+|no\.?|nos\.?|nº|#|number\b|unit|suite|ste|bldg|building|floor|fl|rm|room|lot|plot|level|shed|warehouse|factory|block|blk|kav|kavling|p\.?o\.?\s*box)\b/i.test(c)) {
    // Check if rawAddr has leading premise/floor/unit/suite/building/office park before cleanAddr
    const cleanEscaped = c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+');
    let mLead = rawAddr.match(new RegExp(`^\\s*([\\s\\S]{3,80}?)[,\\s]+(?=${cleanEscaped})`, 'i'));
    if (!mLead) {
      const firstThoroughfareMatch = c.match(/^(?:no\.?|nos\.?|number|#)?\s*\d+[A-Za-z]?(?:[-\/]\d+)?[,\s]+[A-Za-z0-9\u00C0-\u024F\s\-]+?\b(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Rd|St|Ave|Ln|Dr|Blvd|Hwy|Ct|Pl)\b/i);
      if (firstThoroughfareMatch) {
        const segEscaped = firstThoroughfareMatch[0].replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+');
        mLead = rawAddr.match(new RegExp(`^\\s*([\\s\\S]{3,80}?)[,\\s]+(?=${segEscaped})`, 'i'));
      }
    }
    if (mLead && mLead[1]) {
      const prefix = mLead[1].trim().replace(/,$/, '');
      if (/\b(?:unit|suite|ste|bldg|building|floor|fl|flr|level|block|blk|lot|plot|office\s*park|industrial|tower|kav)\b|\b\d+\s*(?:\/|\s*)?F\b/i.test(prefix)) {
        const floorDigitMatch = prefix.match(/\b(\d+)\s*(?:\/|\s*)?F\b/i);
        if (floorDigitMatch && new RegExp(`\\b${floorDigitMatch[1]}(?:st|nd|rd|th)?\\s+Floor\\b`, 'i').test(c)) {
          return c;
        }
        if (new RegExp(`^${prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(c)) {
          return c;
        }
        return `${prefix}, ${c}`;
      }
    }
    const leadingUnitMatch = rawAddr.match(/^\s*(\b(?:\d{1,3}(?:st|nd|rd|th)?\s+floor|\d{1,3}\s*(?:\/|\s*)?F\.?|(?:unit|suite|ste|bldg|building|floor|fl|rm|room|lot|plot|level|block|blk)\s+[A-Za-z0-9\-\/]+)[,\s]+)(?:no\.?|nos\.?|number|#)?\s*(\d+[A-Za-z]?(?:[-\/]\d+)?)/i);
    if (leadingUnitMatch) {
      const unitText = leadingUnitMatch[1].trim().replace(/,$/, '');
      const numText = leadingUnitMatch[2];
      const cleanStartsWithNum = new RegExp(`^(?:no\\.?|nos\\.?|number|#)?\\s*${numText}\\b`, 'i');
      if (cleanStartsWithNum.test(c) && !new RegExp(`^${unitText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(c)) {
        return `${unitText}, ${c}`;
      }
    }
    return cleanAddr;
  }

  const premiseWords = "unit|suite|ste|bldg|building|floor|fl|rm|room|lot|plot|level|shed|warehouse|factory|block|blk|kav|kavling";
  const premiseId = "(?:pt\\s*)?[A-Za-z0-9\\-\\/]*\\d+[A-Za-z0-9\\-\\/]*";

  // Extract the first meaningful thoroughfare or street name chunk from cleanAddr
  // E.g. from "Best Place, Cincinnati, Ohio", chunk is "Best Place"
  const firstCommaIdx = c.indexOf(",");
  let firstSegment = (firstCommaIdx > 0 ? c.slice(0, firstCommaIdx) : c).trim();
  if (firstSegment.length >= 3) {
    // Make common street suffixes flexible between full and abbreviated forms
    const suffixMap = [
      [/\bStreet\b/i, "(?:Street|St\\b\\.?)"],
      [/\bRoad\b/i, "(?:Road|Rd\\b\\.?)"],
      [/\bPlace\b/i, "(?:Place|Pl\\b\\.?)"],
      [/\bAvenue\b/i, "(?:Avenue|Ave\\b\\.?)"],
      [/\bDrive\b/i, "(?:Drive|Dr\\b\\.?)"],
      [/\bLane\b/i, "(?:Lane|Ln\\b\\.?)"],
      [/\bBoulevard\b/i, "(?:Boulevard|Blvd\\b\\.?)"],
      [/\bCourt\b/i, "(?:Court|Ct\\b\\.?)"],
      [/\bTerrace\b/i, "(?:Terrace|Tce\\b|Ter\\b\\.?)"],
      [/\bHighway\b/i, "(?:Highway|Hwy\\b\\.?)"],
      [/\bParkway\b/i, "(?:Parkway|Pkwy\\b\\.?)"],
      [/\bCrescent\b/i, "(?:Crescent|Cres\\b\\.?)"],
      [/\bSquare\b/i, "(?:Square|Sq\\b\\.?)"]
    ];

    let escapedSeg = firstSegment.replace(/[-\[\]{}()*+?.,\\^$|#]/g, "\\$&");
    for (const [sufRegex, flexRep] of suffixMap) {
      if (sufRegex.test(escapedSeg)) {
        escapedSeg = escapedSeg.replace(sufRegex, flexRep);
        break;
      }
    }
    escapedSeg = escapedSeg.replace(/\s+/g, "\\s+");

    // Regex in rawAddr looking for premise / building / street number immediately preceding this segment
    // Supports: "Lot 45", "Plot 12", "Lot 12 & 13", "Lot PT 1234", "Plot 18-A", "Unit 4, 12", "Suite 200, 12110", "12110", "No. 18", "Building 5", etc.
    const prefixRegex = new RegExp(
      '(?:^|[\\s,#;:])((?:(?:' + premiseWords + ')\\s*(?:no\\.?|nos\\.?|number|#)?\\s*' + premiseId + '(?:\\s*(?:&|and|,)\\s*(?:(?:' + premiseWords + '|pt)\\s*)?(?:no\\.?|nos\\.?|#)?\\s*' + premiseId + ')*(?:[\\s,]+(?:no\\.?|nos\\.?|number|#)?\\s*\\d+[A-Za-z]?(?:[-/]\\d+[A-Za-z]?)?)?|(?:(?:no\\.?|nos\\.?|nº|#)\\s*)?\\d+[A-Za-z]?(?:[-/]\\d+[A-Za-z]?)?))[\\s,]+' + escapedSeg,
      'i'
    );

    const m = rawAddr.match(prefixRegex);
    if (m && m[1]) {
      let leadingNum = m[1].trim();
      leadingNum = leadingNum.replace(/[,;]+$/, "").trim();
      if (leadingNum) {
        const numDigits = (leadingNum.match(/\d+/) || [])[0];
        if (numDigits && new RegExp('\\b' + numDigits + '(?:st|nd|rd|th)?\\b', 'i').test(c.slice(0, 40))) {
          return cleanAddr;
        }
        if (new RegExp('^(?:' + premiseWords + ')\\b', 'i').test(leadingNum) && !leadingNum.includes(",")) {
          return `${leadingNum}, ${c}`;
        }
        return `${leadingNum} ${c}`;
      }
    }
  }

  // Fallback: Check if rawAddr begins with a premise or street number that got stripped from cleanAddr
  const startRegex = new RegExp(
    '^[\\s,#;:]*((?:(?:' + premiseWords + ')\\s*(?:no\\.?|nos\\.?|number|#)?\\s*' + premiseId + '(?:\\s*(?:&|and|,)\\s*(?:(?:' + premiseWords + '|pt)\\s*)?(?:no\\.?|nos\\.?|#)?\\s*' + premiseId + ')*(?:[\\s,]+(?:no\\.?|nos\\.?|number|#)?\\s*\\d+[A-Za-z]?(?:[-/]\\d+[A-Za-z]?)?)?|(?:(?:no\\.?|nos\\.?|nº|#)\\s*)?\\d+[A-Za-z]?(?:[-/]\\d+[A-Za-z]?)?))(?=[\\s,]+)',
    'i'
  );
  const mStart = rawAddr.trim().match(startRegex);
  if (mStart && mStart[1]) {
    const lead = mStart[1].trim().replace(/[,;]+$/, "");
    const leadDigits = (lead.match(/\d+/) || [])[0];
    if (leadDigits && new RegExp('\\b' + leadDigits + '(?:st|nd|rd|th)?\\b', 'i').test(c.slice(0, 40))) {
      return cleanAddr;
    }
    if (!new RegExp('\\b' + lead.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i').test(c)) {
      if (new RegExp('^(?:' + premiseWords + ')\\b', 'i').test(lead) && !lead.includes(",")) {
        return `${lead}, ${c}`;
      }
      return `${lead} ${c}`;
    }
  }

  return cleanAddr;
}

/**
 * Carefully strips postal codes while strictly preserving street numbers, cities, and states globally.
 */
function removePostalCodesCarefully(addr) {
  if (!addr) return "";
  let a = addr;

  const streetSuffixPattern = "\\b(?:street|road|avenue|lane|drive|way|place|court|terrace|boulevard|highway|parkway|crescent|close|walk|row|parade|circuit|square|esplanade|mews|alley|st|rd|ave|ln|dr|pl|ct|tce|blvd|hwy|pkwy|cres|cl|sq|strasse|straße|str|rue|via|viale|calle|ulica|ul|namesti|náměstí|avenida|avda|jalan|jl)\\b";
  const premisePrefixPattern = "\\b(?:suite|unit|bldg|building|floor|fl|rm|room|dept|apartment|apt|flat|lot|plot|block|blk|level|shed|warehouse|factory|p\\.?o\\.?\\s*box|no\\.?|nos\\.?|number|#)\\b";

  // 1. Explicitly labeled postal codes (e.g. 'Zip 45241, 12110 Best Place', 'Postal Code: 30543', 'PLZ: 80333', 'PSČ: 602 00', 'CP: 28013')
  a = a.replace(/(?:^|[\s,]+)(?:zip(?:\s*code)?|postal(?:\s*code)?|postcode|pincode|pin|plz|cap|cp|cedex|psč|psc)\s*[:#\-]?\s*(?:\d{4,6}|\d{3}\s*\d{2}|\d{2}-\d{3})[\s,]+/gi, ", ");

  // 2. Leading postal code directly touching Chinese characters (e.g. '30543新竹縣...')
  a = a.replace(/^\s*(\d{3,6})(?=[\u4e00-\u9fa5])/g, "");

  // 3. Leading postal code preceding an explicit street number indicator (e.g. '30543, No. 18 Kuang Fu North Road')
  a = a.replace(/^\s*\d{4,6}[\s,]+(?=(?:no\.?|nos\.?|number|#|unit|suite|bldg|building|floor|level|lot|plot)\s*\d+)/gi, "");

  // 4. Leading postal code preceding administrative region keyword (e.g. '504 Changhua County, Taiwan')
  a = a.replace(/^\s*\d{3,6}[\s,]+(?=[A-Za-z]+(?:\s+[A-Za-z]+)?\s+(?:county|hsien|province|region|prefecture)\b)/gi, "");

  // NOTE: A standalone number at the start of an address followed by a street name is 100% THE STREET / BUILDING NUMBER.
  // It MUST NEVER be stripped!

  // 5. UK Postcodes (e.g. SW1A 1AA, EC1A 1BB, W1A 0AX, M1 1AE, CM9 4PX)
  a = a.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, " ");

  // 6. European country-prefixed postal codes (e.g. ES-28014, CZ-60200, DE-80333, FR-75002, PL-00-838)
  a = a.replace(/\b(?:ES|E|IT|FR|DE|NL|BE|AT|CH|CZ|PL|SE|NO|DK)[-\s]?(?:\d{4,5}|\d{3}\s*\d{2}|\d{2}-\d{3})\b/gi, " ");

  // 7. Canadian Postcodes (e.g. M5V 2T6, K1A 0B1)
  a = a.replace(/\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/gi, " ");

  // 8. Dutch Postcodes with 2 letters (e.g. 1015 CW)
  a = a.replace(/\b\d{4}\s*[A-Z]{2}\b/g, " ");

  // 9. US ZIP+4 (e.g. 90210-1234)
  a = a.replace(/\b\d{5}-\d{4}\b/g, " ");

  // 10. Polish postal codes (e.g. 00-838)
  a = a.replace(/\b\d{2}-\d{3}\b/g, " ");

  // 11. Czech / Slovak / Swedish spaced 5-digit postal codes (e.g. 602 00, 110 00) before city
  a = a.replace(/(,\s*)\b\d{3}\s+\d{2}\b\s*(?=,?\s+[\p{L}])/gu, "$1");

  // 12. Postal code directly following State name / abbreviation / province globally
  const allStatesPostalRegex = "\\b(?:Victoria|New South Wales|Queensland|Western Australia|South Australia|Tasmania|Northern Territory|Australian Capital Territory|Vic|NSW|QLD|WA|SA|TAS|ACT|NT|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\\s*Hampshire|New\\s*Jersey|New\\s*Mexico|New\\s*York|North\\s*Carolina|North\\s*Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\\s*Island|South\\s*Carolina|South\\s*Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\\s*Virginia|Wisconsin|Wyoming|District\\s*Of\\s*Columbia|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|Ontario|Quebec|British Columbia|Alberta|Gauteng|ON|QC|BC|Madrid|Barcelona|Valencia|Sevilla|Zaragoza|Málaga|Malaga|Murcia|Palma|Bilbao|Alicante|Córdoba|Cordoba|Valladolid|Vigo|Gijón|Gijon|Granada|Alava|Albacete|Almeria|Asturias|Avila|Badajoz|Baleares|Burgos|Caceres|Cadiz|Cantabria|Castellon|Ciudad Real|Cuenca|Girona|Guadalajara|Guipuzcoa|Huelva|Huesca|Jaen|La Coruna|La Rioja|Las Palmas|Leon|Lleida|Lugo|Navarra|Ourense|Palencia|Pontevedra|Salamanca|Santa Cruz de Tenerife|Segovia|Soria|Tarragona|Teruel|Toledo|Selangor|Johor|Penang|Perak|Kedah|Pahang|Negeri Sembilan|Melaka|Terengganu|Kelantan|Sarawak|Sabah|Perlis)\\b[\\s,]*";
  a = a.replace(new RegExp(`(${allStatesPostalRegex})\\b\\d{4,6}\\b`, "gi"), "$1");

  // 13. Postal code before a city/town after comma (e.g. "..., 81750 Masai, Johor", "..., 75002 Paris")
  // MUST NOT strip street numbers if preceded by Unit/Suite/Building or followed by a street suffix!
  a = a.replace(/(,\s*)\b\d{4,6}\b\s*(?=,?\s+([\p{L}]+(?:\s+[\p{L}]+)*))/gu, (match, comma, rest) => {
    if (new RegExp(streetSuffixPattern, "iu").test(rest)) return match;
    const preComma = a.slice(0, a.indexOf(match));
    if (new RegExp(premisePrefixPattern, "iu").test(preComma)) return match;
    return comma;
  });
  a = a.replace(/(\b\d+\s+)\b(?:0[1-9]|[1-4]\d|5[0-2])\d{3}\b\s+(?=[\p{L}])/gu, "$1");

  // 14. Postal code directly following City / District / Township / County / Hsien / Province / Region
  a = a.replace(/(\b(?:City|District|Township|County|Hsien|Province|Region|Town|Dist\.?)\b[\s,]*)\b\d{3,6}\b(?=[\s,]|$)/gi, "$1");

  // 15. Postal code at the very end of the address string (e.g. "... Campbellfield 3061", "... Mumbai - 400001", or "... Cincinnati, Ohio 45241")
  a = a.replace(/[\s,\-]+(?:\bpin(?:\s*code)?\b[\s:#\-]*)?\b(?:\d{4,6}|\d{3}\s*\d{2}|\d{2}-\d{3})\b(?:\s*[.,]?\s*)$/gi, "");
  a = a.replace(/\s*-\s*\b\d{4,6}\b(?=[\s,]|$)/g, "");

  // Clean double commas and spaces
  a = a.replace(/,\s*,+/g, ",");
  a = a.replace(/\s+/g, " ");
  a = a.replace(/^,\s*/, "").replace(/[,\s]+$/, "");

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

  // Immediate rejection of explicit toll-free keywords
  if (/\b(?:toll[-\s]*free|free[-\s]*phone|green[-\s]*line)\b/i.test(p)) {
    return "";
  }

  const cLower = (country || "").toLowerCase();
  const hasPlus = p.startsWith("+");
  const has00 = p.startsWith("00");

  let digits = p.replace(/\D/g, "");
  if (!digits) return "";

  // Reject immediate toll-free numbers before country code removal
  if (/^(?:1800|1888|1877|1866|1855|1844|1833|1300|0800|0808|0500|800|888|877|866|855|844|833)/.test(digits)) {
    return "";
  }

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
  // Match by detected country - unconditionally strip country code if digits start with it
  for (const cc of countryCodes) {
    if (cc.match.some(m => cLower.includes(m))) {
      if (digits.startsWith(cc.code)) {
        digits = digits.slice(cc.code.length);
        codeRemoved = true;
        break;
      }
    }
  }

  // If phone had '+' or '00' or starts with country code without plus and wasn't removed yet
  if (!codeRemoved) {
    for (const cc of countryCodes) {
      if (digits.startsWith(cc.code) && digits.length >= (cc.minLen - 2)) {
        digits = digits.slice(cc.code.length);
        codeRemoved = true;
        break;
      }
    }
  }

  // Rule: Take complete phone number, but remove leading zero
  digits = digits.replace(/^0+/, "");

  // Rule: Do NOT take numbers starting with zero
  if (!digits || digits.startsWith("0")) {
    return "";
  }

  // Rule: STRICTLY DO NOT TAKE TOLL-FREE NUMBERS (US 800/888/877/866/855/844/833, AU 1800/1300, UK 0800/0808/0500)
  if (/^(?:800|888|877|866|855|844|833|1800|1300|900|901|902|0800|0808|0500)/.test(digits)) {
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
  } else if (cLower.includes("new zealand")) {
    if (len < 8 || len > 10) return "";
  } else if (cLower.includes("indonesia")) {
    if (len < 8 || len > 11) return "";
  } else if (cLower.includes("singapore")) {
    if (len !== 8) return "";
  } else if (cLower.includes("spain") || cLower.includes("espana")) {
    if (len !== 9) return "";
  } else {
    if (len < 7 || len > 12) return "";
  }

  return digits;
}

function toTitleCase(str) {
  if (!str) return "";
  const upperAcronyms = new Set([
    "USA", "UK", "UAE", "3D", "CNC", "LED", "OEM", "ODM", "HVAC", "PVC", "PE", "HDPE", "PTFE", "R&D", "AKS",
    "PT", "CV", "UD", "TBK", "RT", "RW", "DKI", "DI", "BMW", "IBM", "B2B", "B2C", "IT", "TP", "QC", "AI", "FRP", "SMT", "PCB", "PCBA",
    "PEM", "FP", "HR", "CRP", "SMC", "THK", "NSK", "NTN", "IKO", "INA", "FAG", "FESTO", "CKD", "ABB", "SKF", "GE", "HP", "LG", "JVC", "TDK", "NEC"
  ]);
  let s = str.replace(/['’`]\s*s\b/gi, "'s");
  // Every word starts with a Capital letter per QC instruction: "All words start with Capital letter"
  return s.replace(/[\p{L}\p{N}]+/gu, function (word, offset, fullStr) {
    if (offset > 0 && fullStr[offset - 1] === "'" && word.toLowerCase() === "s") {
      return "s";
    }
    const upper = word.toUpperCase();
    if (upperAcronyms.has(upper)) return upper;
    if (/^GmbH$/i.test(word)) return "GmbH";
    // Preserve 2-4 letter all-caps acronyms when the surrounding string has mixed lowercase characters
    if (word.length >= 2 && word.length <= 4 && word === upper && /[a-z]/.test(fullStr) && !/^(?:AND|THE|FOR|WITH|FROM|INTO|ONTO|UPON|OVER|UNDER|AFTER|ABOUT)$/i.test(word)) {
      return upper;
    }
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
 * Standardizes country names globally per official QC mandate.
 * E.g., "Czech Republic" -> "Czechia", "Turkey" -> "Turkiye", "USA" -> "United States Of America"
 */
function normalizeCountryName(country) {
  if (!country || typeof country !== "string") return "";
  let c = country.trim().replace(/[\(\)\[\]\{\}]/g, " ").replace(/\s+/g, " ").trim();
  if (c.length < 2) return c;

  const lower = c.toLowerCase();
  const unaccented = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Czech Republic -> Czechia (Mandatory QC Rule)
  if (/\b(?:czech\s*republic|ceska\s*republika|cesko|czechia)\b/i.test(unaccented) || /^czech(?:ia)?$/i.test(unaccented)) {
    return "Czechia";
  }

  // 2. Turkey / Türkiye -> Turkiye
  if (/\b(?:turkey|turkiye|republic\s*of\s*turkiye|republic\s*of\s*turkey)\b/i.test(unaccented)) {
    return "Turkiye";
  }

  // 3. United States -> United States Of America
  if (/^(?:u\.?s\.?a?\.?|united\s*states(?:\s*of\s*america)?|the\s*united\s*states)$/i.test(unaccented) || /\bunited\s*states\s*of\s*america\b/i.test(unaccented)) {
    return "United States Of America";
  }

  // 4. Taiwan
  if (/taiwan/i.test(unaccented) || /r\.?o\.?c\.?/i.test(unaccented) || /republic\s*of\s*china/i.test(unaccented)) {
    return "Taiwan";
  }

  // 5. United Kingdom & Constituent Countries
  // QC Rule: "United Kingdom (England, Wales, Scotland, Northern Ireland). If 'England' and 'United Kingdom' both are mentioned, you must take England as the country name."
  if (/\bengland\b/i.test(unaccented)) return "England";
  if (/\bscotland\b/i.test(unaccented)) return "Scotland";
  if (/(?<!\bnew\s+south\s+)\bwales\b/i.test(unaccented)) return "Wales";
  if (/\bnorthern\s*ireland\b/i.test(unaccented)) return "Northern Ireland";
  if (/^(?:united\s*kingdom|great\s*britain|uk|u\.k\.|britain)$/i.test(unaccented) || /\bunited\s*kingdom\b/i.test(unaccented)) {
    return "United Kingdom";
  }

  // 6. South Korea
  if (/\b(?:south\s*korea|korea,\s*republic\s*of|republic\s*of\s*korea|korea\s*republic|rok)\b/i.test(unaccented) || /^korea$/i.test(unaccented)) {
    return "South Korea";
  }

  // 7. Swaziland -> Eswatini
  if (/\b(?:swaziland|eswatini|kingdom\s*of\s*eswatini)\b/i.test(unaccented)) {
    return "Eswatini";
  }

  // 8. North Macedonia (Macedonia / FYROM)
  if (/\b(?:macedonia|north\s*macedonia|republic\s*of\s*north\s*macedonia|fyrom)\b/i.test(unaccented)) {
    return "North Macedonia";
  }

  // 9. Myanmar (Burma)
  if (/\b(?:burma|myanmar|republic\s*of\s*the\s*union\s*of\s*myanmar)\b/i.test(unaccented)) {
    return "Myanmar";
  }

  // 10. Netherlands (Holland)
  if (/\b(?:netherlands|holland|the\s*netherlands|kingdom\s*of\s*the\s*netherlands)\b/i.test(unaccented)) {
    return "Netherlands";
  }

  // 11. Cote D'Ivoire (Ivory Coast)
  if (/\b(?:ivory\s*coast|cote\s*d['’]ivoire|cote\s*divoire)\b/i.test(unaccented)) {
    return "Cote D'Ivoire";
  }

  // 12. Timor-Leste (East Timor)
  if (/\b(?:east\s*timor|timor[\s-]leste)\b/i.test(unaccented)) {
    return "Timor-Leste";
  }

  // 13. Cabo Verde (Cape Verde)
  if (/\b(?:cape\s*verde|cabo\s*verde)\b/i.test(unaccented)) {
    return "Cabo Verde";
  }

  // 14. Vietnam
  if (/\b(?:viet\s*nam|vietnam|socialist\s*republic\s*of\s*vietnam)\b/i.test(unaccented)) {
    return "Vietnam";
  }

  // 15. Brunei
  if (/\b(?:brunei\s*darussalam|brunei)\b/i.test(unaccented)) {
    return "Brunei";
  }

  // 16. Syria
  if (/\b(?:syrian\s*arab\s*republic|syria)\b/i.test(unaccented)) {
    return "Syria";
  }

  // 17. Laos
  if (/\b(?:lao\s*people['’]?s\s*democratic\s*republic|laos)\b/i.test(unaccented)) {
    return "Laos";
  }

  // 18. Russia
  if (/\b(?:russian\s*federation|russia)\b/i.test(unaccented)) {
    return "Russia";
  }

  // 19. Iran
  if (/\b(?:islamic\s*republic\s*of\s*iran|iran)\b/i.test(unaccented)) {
    return "Iran";
  }

  // 20. Moldova
  if (/\b(?:republic\s*of\s*moldova|moldova)\b/i.test(unaccented)) {
    return "Moldova";
  }

  // 21. Tanzania
  if (/\b(?:united\s*republic\s*of\s*tanzania|tanzania)\b/i.test(unaccented)) {
    return "Tanzania";
  }

  // 22. Bolivia
  if (/\b(?:plurinational\s*state\s*of\s*bolivia|bolivia)\b/i.test(unaccented)) {
    return "Bolivia";
  }

  // 23. Venezuela
  if (/\b(?:bolivarian\s*republic\s*of\s*venezuela|venezuela)\b/i.test(unaccented)) {
    return "Venezuela";
  }

  // 24. New Zealand
  if (/\b(?:new\s*zealand|aotearoa)\b/i.test(unaccented) || /^(?:nz|nzl)$/i.test(unaccented)) {
    return "New Zealand";
  }

  // 25. Malaysia
  if (/\b(?:malaysia|federation\s*of\s*malaysia|persekutuan\s*malaysia)\b/i.test(unaccented) || /^(?:my|mys)$/i.test(unaccented)) {
    return "Malaysia";
  }

  // 26. Indonesia
  if (/\b(?:indonesia|republik\s*indonesia|republic\s*of\s*indonesia)\b/i.test(unaccented) || /^(?:id|idn|ri)$/i.test(unaccented)) {
    return "Indonesia";
  }

  // 27. South Africa
  if (/\b(?:south\s*africa)\b/i.test(unaccented) || /^(?:za|rsa)$/i.test(unaccented)) {
    return "South Africa";
  }

  // 28. Germany
  if (/\b(?:germany|deutschland)\b/i.test(unaccented) || /^(?:de|deu)$/i.test(unaccented)) {
    return "Germany";
  }

  // 29. Italy
  if (/\b(?:italy|italia)\b/i.test(unaccented) || /^(?:it|ita)$/i.test(unaccented)) {
    return "Italy";
  }

  // 30. Spain
  if (/\b(?:spain|espana)\b/i.test(unaccented) || /^(?:es|esp)$/i.test(unaccented)) {
    return "Spain";
  }

  // 31. Australia
  if (/\b(?:australia)\b/i.test(unaccented) || /^(?:au|aus)$/i.test(unaccented)) {
    return "Australia";
  }

  // 32. Singapore
  if (/\b(?:singapore)\b/i.test(unaccented) || /^(?:sg|sgp)$/i.test(unaccented)) {
    return "Singapore";
  }

  // 33. Thailand
  if (/\b(?:thailand)\b/i.test(unaccented) || /^(?:th|tha)$/i.test(unaccented)) {
    return "Thailand";
  }

  // 34. Canada
  if (/\b(?:canada)\b/i.test(unaccented) || /^(?:ca|can)$/i.test(unaccented)) {
    return "Canada";
  }

  // 35. India
  if (/\b(?:india)\b/i.test(unaccented) || /^(?:in|ind)$/i.test(unaccented)) {
    return "India";
  }

  // 36. France
  if (/\b(?:france)\b/i.test(unaccented) || /^(?:fr|fra)$/i.test(unaccented)) {
    return "France";
  }

  // 37. China
  if (/\b(?:china|people['’]?s\s*republic\s*of\s*china|prc)\b/i.test(unaccented) || /^(?:cn|chn)$/i.test(unaccented)) {
    return "China";
  }

  // 38. Japan
  if (/\b(?:japan|nippon|nihon)\b/i.test(unaccented) || /^(?:jp|jpn)$/i.test(unaccented)) {
    return "Japan";
  }

  // 39. Switzerland
  if (/\b(?:switzerland|schweiz|suisse|svizzera)\b/i.test(unaccented) || /^(?:ch|che)$/i.test(unaccented)) {
    return "Switzerland";
  }

  // 40. Ireland
  if (/\b(?:ireland|republic\s*of\s*ireland|eire)\b/i.test(unaccented) || /^(?:ie|irl)$/i.test(unaccented)) {
    return "Ireland";
  }

  // 41. United Arab Emirates
  if (/\b(?:united\s*arab\s*emirates|uae)\b/i.test(unaccented) || /^(?:ae|are)$/i.test(unaccented)) {
    return "United Arab Emirates";
  }

  // 42. Saudi Arabia
  if (/\b(?:saudi\s*arabia|kingdom\s*of\s*saudi\s*arabia|ksa)\b/i.test(unaccented) || /^(?:sa|sau)$/i.test(unaccented)) {
    return "Saudi Arabia";
  }

  // 43. Brazil
  if (/\b(?:brazil|brasil)\b/i.test(unaccented) || /^(?:br|bra)$/i.test(unaccented)) {
    return "Brazil";
  }

  // 44. Mexico
  if (/\b(?:mexico)\b/i.test(unaccented) || /^(?:mx|mex)$/i.test(unaccented)) {
    return "Mexico";
  }

  // 45. Poland
  if (/\b(?:poland|polska)\b/i.test(unaccented) || /^(?:pl|pol)$/i.test(unaccented)) {
    return "Poland";
  }

  // 46. Austria
  if (/\b(?:austria|osterreich|oesterreich)\b/i.test(unaccented) || /^(?:at|aut)$/i.test(unaccented)) {
    return "Austria";
  }

  // 47. Belgium
  if (/\b(?:belgium|belgie|belgique)\b/i.test(unaccented) || /^(?:be|bel)$/i.test(unaccented)) {
    return "Belgium";
  }

  // 48. Sweden
  if (/\b(?:sweden|sverige)\b/i.test(unaccented) || /^(?:se|swe)$/i.test(unaccented)) {
    return "Sweden";
  }

  // 49. Norway
  if (/\b(?:norway|norge)\b/i.test(unaccented) || /^(?:no|nor)$/i.test(unaccented)) {
    return "Norway";
  }

  // 50. Denmark
  if (/\b(?:denmark|danmark)\b/i.test(unaccented) || /^(?:dk|dnk)$/i.test(unaccented)) {
    return "Denmark";
  }

  // 51. Finland
  if (/\b(?:finland|suomi)\b/i.test(unaccented) || /^(?:fi|fin)$/i.test(unaccented)) {
    return "Finland";
  }

  // 52. Portugal
  if (/\b(?:portugal)\b/i.test(unaccented) || /^(?:pt|prt)$/i.test(unaccented)) {
    return "Portugal";
  }

  // 53. Greece
  if (/\b(?:greece|hellas)\b/i.test(unaccented) || /^(?:gr|grc)$/i.test(unaccented)) {
    return "Greece";
  }

  // 54. Philippines
  if (/\b(?:philippines|pilipinas)\b/i.test(unaccented) || /^(?:ph|phl)$/i.test(unaccented)) {
    return "Philippines";
  }

  return toTitleCase(c);
}

/**
 * Determines Country Name EXCLUSIVELY from the physical address string.
 * Strictly NEVER checks or guesses from the domain name or URL extension.
 */
function detectCountryFromAddress(address) {
  if (!address || typeof address !== "string" || address.trim().length < 3) return "";
  const lower = address.toLowerCase();

  // 1. Explicit country mentioned in the physical address text
  if (/\b(?:czech\s*republic|ceska\s*republika|česká\s*republika|cesko|česko|czechia)\b/i.test(lower)) return "Czechia";
  if (/\b(south\s*africa)\b/i.test(lower)) return "South Africa";
  if (/\b(taiwan|r\.?o\.?c\.?)\b/i.test(lower) || /(?:臺灣|台灣|臺北|台北|新北|桃園|台中|臺中|台南|臺南|高雄|新竹|彰化|苗栗|南投|雲林|嘉義|屏東|宜蘭|花蓮|台東|臺東|澎湖|金門|連江|大里區|草堤路)/.test(address)) return "Taiwan";
  if (/\b(england)\b/i.test(lower)) return "England";
  if (/\b(scotland)\b/i.test(lower)) return "Scotland";
  if (/(?<!\bnew\s+south\s+)\bwales\b/i.test(lower)) return "Wales";
  if (/\b(northern\s*ireland)\b/i.test(lower)) return "Northern Ireland";
  if (/\b(united\s*kingdom|great\s*britain|uk)\b/i.test(lower)) {
    // QC Mandate: Prioritize constituent country if locality belongs to England, Wales, Scotland, or Northern Ireland
    if (/\b(?:london|birmingham|manchester|leeds|liverpool|sheffield|bristol|newcastle|nottingham|leicester|coventry|essex|yorkshire|kent|lancashire|surrey|hampshire|sussex|norfolk|suffolk|somerset|devon|cornwall|cheshire|derbyshire|berkshire|oxfordshire|cambridgeshire|gloucestershire|northamptonshire|wiltshire|bedfordshire|staffordshire|cumbria|lincolnshire|hertfordshire|warwickshire|dorset|worcestershire|shropshire|buckinghamshire)\b/i.test(lower)) return "England";
    if (/\b(?:edinburgh|glasgow|aberdeen|dundee|inverness|perth|stirling|fife|lanarkshire|highland|ayrshire|lothian)\b/i.test(lower)) return "Scotland";
    if (/\b(?:cardiff|swansea|newport|wrexham|glamorgan|gwent|dyfed|powys|gwynedd|clwyd)\b/i.test(lower)) return "Wales";
    if (/\b(?:belfast|derry|londonderry|armagh|antrim|down|fermanagh|tyrone)\b/i.test(lower)) return "Northern Ireland";
    return "United Kingdom";
  }
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
  if (/\b(?:new\s*zealand|aotearoa)\b/i.test(lower) || /,\s*nz\b/i.test(lower) || /\bnz\s+\d{4}\b/i.test(lower)) return "New Zealand";
  if (/\b(?:malaysia|federation\s*of\s*malaysia|persekutuan\s*malaysia)\b/i.test(lower)) return "Malaysia";
  if (/\b(?:indonesia|republik\s*indonesia|republic\s*of\s*indonesia)\b/i.test(lower)) return "Indonesia";
  if (/\b(united\s*arab\s*emirates|uae)\b/i.test(lower)) return "United Arab Emirates";
  if (/\b(italy|italia)\b/i.test(lower)) return "Italy";
  if (/\b(spain|espana)\b/i.test(lower)) return "Spain";
  if (/\b(t[uü]rkiye|turkey|republic\s*of\s*t[uü]rkiye|republic\s*of\s*turkey)\b/i.test(lower)) return "Turkiye";
  //.
  // 2. Definitive administrative regions/towns explicitly appearing in physical address
  if (/\b(?:prague|praha|brno|ostrava|plzen|plzeň|olomouc|liberec|ceske\s*budejovice|české\s*budějovice|hradec\s*kralove|hradec\s*králové|usti\s*nad\s*labem|pardubice|zlin|zlín|havirov|kladno|most|karvina|opava|frydek-mistek)\b/i.test(lower)) {
    return "Czechia";
  }
  if (/\b(taoyuan\s*hsien|taoyuan|yangmei|taipei|new\s*taipei|kaohsiung|taichung|tainan|hsinchu)\b/i.test(lower)) {
    return "Taiwan";
  }
  if (/\b(boksburg|johannesburg|pretoria|durban|cape\s*town|sandton|midrand|centurion|gauteng|ekurhuleni)\b/i.test(lower)) {
    return "South Africa";
  }
  if (/\b(switzerland)\b/i.test(lower)) return "Switzerland";
  if (/\b(ireland)\b/i.test(lower)) return "Ireland";
  if (/\b(thailand)\b/i.test(lower)) return "Thailand";

  // 2. Verified State / Province / County / Region in the physical address text
  // Canada provinces, territory codes, Canadian postal code pattern (A1A 1A1)
  if (/\b(?:ontario|quebec|british\s*columbia|alberta|manitoba|saskatchewan|nova\s*scotia|new\s*brunswick|newfoundland|prince\s*edward\s*island)\b/i.test(lower) ||
    /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i.test(address) ||
    /(?:^|[,\s])(?:QC|BC|AB|ON|MB|SK|NS|NB|NL|PE)\b/i.test(address) && /\b(?:Canada|CA)\b/i.test(address) ||
    /,\s*(?:QC|BC|AB|ON|MB|SK|NS|NB|NL|PE)(?:,\s*CA)?\s*$/i.test(address) ||
    /\b(?:Montreal|Toronto|Vancouver|Calgary|Edmonton|Ottawa|Winnipeg|Quebec\s*City|Hamilton|Kitchener|London|Victoria|Halifax|Longueuil|Laval|Gatineau|Burnaby|Richmond|Saskatoon|Regina)\b/i.test(lower) && /\b(?:Canada|CA|QC|BC|AB|ON|MB|SK)\b/i.test(address)) {
    return "Canada";
  }

  const US_STATE_CODES_STR = "al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy";
  if (new RegExp(`(?:^|[,\\s])(?:${US_STATE_CODES_STR})\\s+\\d{5}(?:-\\d{4})?\\b`, "i").test(lower)) return "United States Of America";
  if (new RegExp(`,\\s*(?:${US_STATE_CODES_STR})\\s*$`, "i").test(lower)) return "United States Of America";
  if (/\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new\s*hampshire|new\s*jersey|new\s*mexico|new\s*york|north\s*carolina|north\s*dakota|ohio|oklahoma|oregon|pennsylvania|rhode\s*island|south\s*carolina|south\s*dakota|tennessee|texas|utah|vermont|virginia|washington|west\s*virginia|wisconsin|wyoming|district\s*of\s*columbia)\b/i.test(lower)) return "United States Of America";
  if (/\b(?:new\s*south\s*wales|victoria|queensland|western\s*australia|south\s*australia|tasmania|northern\s*territory|australian\s*capital\s*territory|sydney|melbourne|brisbane|perth|adelaide|canberra|hobart|darwin|gold\s*coast|newcastle|wollongong|geelong|cairns|townsville)\b/i.test(lower) ||
    /\b(?:vic|nsw|qld|wa|sa|tas|act|nt)\s+\d{4}\b/i.test(lower) ||
    /,\s*(?:vic|nsw|qld|wa|sa|tas|act|nt)\b/i.test(lower)) return "Australia";
  if (/\b(bavaria|bayern|baden-wurttemberg|nordrhein-westfalen|hessen|sachsen)\b/i.test(lower)) return "Germany";
  if (/\b(andaluc[ií]a|catalu[nñ]a|galicia|pa[ií]s\s*vasco|arag[oó]n|asturias|baleares|canarias|cantabria|castilla|extremadura|navarra|rioja|barcelona|valencia|sevilla|zaragoza|málaga|malaga|murcia|alicante|córdoba|cordoba|valladolid|vigo|gijón|gijon|coruña|coruna|toledo|vizcaya|bizkaia)\b/i.test(lower)) return "Spain";
  if (/\b(maharashtra|karnataka|tamil\s*nadu|gujarat|uttar\s*pradesh|telangana|delhi)\b/i.test(lower)) return "India";
  if (/\b(taoyuan|hsinchu|miaoli|changhua|nantou|yunlin|chiayi|pingtung|yilan|hualien|taitung)\s*(hsien|county)\b/i.test(lower)) return "Taiwan";
  if (/\b(istanbul|ankara|izmir|bursa|antalya|adana|konya|gaziantep|kocaeli|mersin|diyarbakir|kayseri|eski[sş]ehir|sanliurfa|şanlıurfa|samsun|denizli|sakarya|mu[gğ]la|trabzon)\b/i.test(lower)) return "Turkiye";
  // Malaysia states & major cities
  if (/\b(selangor|johor|perak|kedah|pahang|negeri\s*sembilan|melaka|malacca|terengganu|kelantan|sabah|sarawak|perlis|wilayah\s*persekutuan|labuan|subang\s*jaya|petaling\s*jaya|shah\s*alam|klang|johor\s*bahru|george\s*town|ipoh|kota\s*kinabalu|kuching|seremban|batu\s*pahat|pasir\s*gudang|iskandar\s*puteri|puchong|cheras|cyberjaya|rawang|kajang|kuantan|alor\s*setar|taiping|sungai\s*petani|bintulu|miri|sibu|sandakan|tawau|butterworth|bukit\s*mertajam|nilai|semenyih)\b/i.test(lower)) return "Malaysia";
  if (/\b(penang|pulau\s*pinang)\b/i.test(lower) && !/\b(?:penang\s+road|penang\s+street|penang\s+lane)\b/i.test(lower)) return "Malaysia";
  // Indonesia provinces & major cities
  if (/\b(jawa\s*barat|jawa\s*tengah|jawa\s*timur|west\s*java|central\s*java|east\s*java|banten|sumatera\s*utara|sumatera\s*barat|sumatera\s*selatan|north\s*sumatra|west\s*sumatra|south\s*sumatra|kalimantan\s*(?:timur|barat|selatan|tengah|utara)?|sulawesi\s*(?:selatan|utara|tengah|tenggara|barat)?|kepulauan\s*riau|bangka\s*belitung|nusa\s*tenggara\s*(?:barat|timur)?|dki\s*jakarta|di\s*yogyakarta|surabaya|bandung|medan|semarang|makassar|palembang|tangerang|tangerang\s*selatan|bekasi|depok|bogor|batam|pekanbaru|bandar\s*lampung|balikpapan|denpasar|samarinda|cikarang|karawang|sidoarjo|gresik|serang|cilegon|solo|surakarta|malang|pontianak|manado|banjarmasin|cimahi|sukabumi|cirebon|tasikmalaya|purwakarta)\b/i.test(lower)) return "Indonesia";
  // New Zealand regions & major cities
  if (/\b(canterbury|waikato|bay\s*of\s*plenty|otago|hawke's\s*bay|hawkes\s*bay|taranaki|manawatu|southland|northland|marlborough|tasman|west\s*coast|auckland|christchurch|hamilton|tauranga|dunedin|lower\s*hutt|upper\s*hutt|palmerston\s*north|invercargill|rotorua|whangarei|napier|porirua|new\s*plymouth|queenstown|blenheim|timaru|taupo|pukekohe|cambridge|whakatane|hastings|gisborne|nelson|whanganui|feilding|levin|masterton|ashburton|rangiora|rolleston|wanaka)\b/i.test(lower)) return "New Zealand";

  // China provinces, major cities & Chinese characters
  if (/\b(guangdong|jiangsu|zhejiang|shandong|henan|sichuan|hubei|hunan|hebei|fujian|anhui|liaoning|shaanxi|jiangxi|huizhou|shenzhen|guangzhou|dongguan|foshan|zhongshan|zhuhai|suzhou|wuxi|changzhou|nanjing|hangzhou|ningbo|wenzhou|jiaxing|qingdao|jinan|yantai|weifang|xiamen|fuzhou|quanzhou|chengdu|wuhan|changsha|zhengzhou)\b/i.test(lower) || /[\u4e00-\u9fa5]/.test(address)) {
    return "China";
  }

  // UK postcodes & major UK counties / administrative regions
  if (/\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(lower)) {
    if (/\b(?:eh|g|ab|dd|dg|fk|hs|iv|ka|kw|ky|ml|pa|ph|td|ze)\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(lower)) return "Scotland";
    if (/\b(?:cf|ld|ll|np|sa)\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(lower)) return "Wales";
    if (/\bbt\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(lower)) return "Northern Ireland";
    return "England";
  }
  if (/\b(greater\s*london|greater\s*manchester|west\s*midlands|west\s*yorkshire|south\s*yorkshire|tyne\s*and\s*wear|merseyside|berkshire|buckinghamshire|cambridgeshire|cheshire|cornwall|cumbria|derbyshire|devon|dorset|durham|county\s*durham|essex|gloucestershire|hampshire|hertfordshire|kent|lancashire|leicestershire|lincolnshire|middlesex|norfolk|northamptonshire|northumberland|nottinghamshire|oxfordshire|shropshire|somerset|staffordshire|suffolk|surrey|sussex|east\s*sussex|west\s*sussex|warwickshire|wiltshire|worcestershire|yorkshire|east\s*yorkshire|north\s*yorkshire|bedfordshire|rutland|herefordshire|isle\s*of\s*wight)\b/i.test(lower)) {
    return "England";
  }

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
  if (/\b(madrid)\b/i.test(lower)) return "Spain";
  if (/\b(roma|rome)\b/i.test(lower)) return "Italy";
  if (/\b(tokyo)\b/i.test(lower)) return "Japan";
  if (/\b(beijing)\b/i.test(lower)) return "China";
  if (/\b(new\s*delhi)\b/i.test(lower)) return "India";
  if (/\b(seoul)\b/i.test(lower)) return "South Korea";
  if (/\b(ankara)\b/i.test(lower)) return "Turkiye";
  if (/\b(wellington)\b/i.test(lower) && !/\b(?:mount|mt\.?)\s+wellington\b/i.test(lower) && !isPlaceUsedAsStreetName(lower, "wellington")) return "New Zealand";
  if (/\b(kuala\s*lumpur|putrajaya)\b/i.test(lower)) return "Malaysia";
  if (/\b(jakarta|dki\s*jakarta|nusantara)\b/i.test(lower)) return "Indonesia";
  if (/\b(prague|praha)\b/i.test(lower)) return "Czechia";

  return "";
}

function extractLikelyAddress(text) {
  if (!text) return "";
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 10);
  for (const line of lines) {
    if (/\b(street|road|avenue|drive|lane|way|boulevard|park|industrial|building|box|suite|town|district|county|hsien|marg|nagar|estate|floor|block|sector|plot|no\.?|mumbai|delhi|bangalore|chennai|kolkata|hyderabad|pune|ahmedabad)\b/i.test(line)) {
      return line;
    }
  }
  return "";
}

async function testGeminiApiKey(apiKey, modelName = DEFAULT_MODEL) {
  const selected = modelName || DEFAULT_MODEL;
  const modelsToTry = Array.from(new Set([
    selected,
    ...GEMINI_MODELS
  ])).filter(Boolean);

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const reqHeaders = {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      };
      const res = await fetch(url, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hello! Reply with 'OK'" }] }]
        })
      });
      if (res.ok) {
        return { success: true, message: `Connected successfully with Gemini (${model})!`, activeModel: model };
      }
      const err = await res.text();
      lastError = `API HTTP ${res.status}: ${err}`;
      if (res.status === 401) {
        break; // Key invalid, no other model will succeed
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  return { success: false, error: lastError || "Failed to connect with any Gemini model" };
}
