// Extension configuration constants, multi-provider AI configuration, and JSON response schema.

function getEnvVar(name, fallback = "") {
  return (
    (typeof globalThis !== "undefined" && globalThis.ENV && globalThis.ENV[name]) ||
    (typeof self !== "undefined" && self.ENV && self.ENV[name]) ||
    fallback
  );
}

const DEFAULT_AI_PROVIDER = getEnvVar("AI_PROVIDER", "gemini").toLowerCase();
const DEFAULT_API_KEY = getEnvVar("GEMINI_API_KEY", "");
const DEFAULT_GROQ_API_KEY = getEnvVar("GROQ_API_KEY", "");

const EXTRACTION_MODES = {
  AI_FIRST: "ai_first",
  AI_ONLY: "ai_only",
  OWN_CRAWL: "own_crawl"
};
const DEFAULT_EXTRACTION_MODE = getEnvVar("EXTRACTION_MODE", EXTRACTION_MODES.AI_FIRST);

function normalizeExtractionMode(rawMode) {
  const m = String(rawMode || "").trim().toLowerCase();
  if (m === "ai_only" || m === "ai-only" || m === "aionly") return EXTRACTION_MODES.AI_ONLY;
  if (m === "own_crawl" || m === "own-crawl" || m === "owncrawl" || m === "heuristic") return EXTRACTION_MODES.OWN_CRAWL;
  return EXTRACTION_MODES.AI_FIRST;
}

const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];
const GROQ_MODELS = [
  "llama-3.1-8b-instant"
];

const DEFAULT_MODEL = getEnvVar("DEFAULT_MODEL", "gemini-3.5-flash-lite");
const DEFAULT_GROQ_MODEL = getEnvVar("GROQ_MODEL", "llama-3.1-8b-instant");

const AI_PROVIDERS = {
  gemini: {
    id: "gemini",
    label: "Gemini",
    models: GEMINI_MODELS,
    defaultModel: DEFAULT_MODEL,
    defaultKey: DEFAULT_API_KEY
  },
  groq: {
    id: "groq",
    label: "Groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    modelsEndpoint: "https://api.groq.com/openai/v1/models",
    models: GROQ_MODELS,
    defaultModel: DEFAULT_GROQ_MODEL,
    defaultKey: DEFAULT_GROQ_API_KEY
  }
};

function inferProviderByKeyPrefix(apiKey, fallbackProvider = "gemini") {
  const k = String(apiKey || "").trim();
  if (/^gsk_/i.test(k)) return "groq";
  if (/^AIza/i.test(k)) return "gemini";
  return AI_PROVIDERS[fallbackProvider] ? fallbackProvider : "gemini";
}

function normalizeProviderAndModel(rawProvider, apiKey, requestedModel = "") {
  const reqRaw = String(rawProvider || "").trim().toLowerCase();
  const cleanRequestedProv = reqRaw === "grok" ? "groq" : (AI_PROVIDERS[reqRaw] ? reqRaw : "gemini");
  const effectiveProvider = inferProviderByKeyPrefix(apiKey, cleanRequestedProv);
  const cfg = AI_PROVIDERS[effectiveProvider];
  const reqMod = String(requestedModel || "").trim();
  const isInvalidGroqModel = !reqMod ||
    /^gemini-|^grok-/i.test(reqMod) ||
    /gpt-oss|llama-3\.3-70b|mixtral|gemma2/i.test(reqMod);
  const modelValidForProvider = effectiveProvider === "groq"
    ? !isInvalidGroqModel
    : (reqMod && /^gemini-/i.test(reqMod));
  return {
    provider: effectiveProvider,
    label: cfg.label,
    apiKey: String(apiKey || "").trim(),
    model: modelValidForProvider ? reqMod : cfg.defaultModel
  };
}

function resolveAiProviderConfig(settings = {}) {
  let rawProvider = String(settings.aiProvider || DEFAULT_AI_PROVIDER || "gemini").trim().toLowerCase();
  if (rawProvider === "grok") rawProvider = "groq";
  const provider = AI_PROVIDERS[rawProvider] ? rawProvider : "gemini";
  if (provider === "groq") {
    const key = String(settings.groqApiKey || settings.grokApiKey || DEFAULT_GROQ_API_KEY || "").trim();
    return normalizeProviderAndModel("groq", key, settings.groqModel || DEFAULT_GROQ_MODEL);
  }
  const key = String(settings.apiKey || DEFAULT_API_KEY || "").trim();
  return normalizeProviderAndModel("gemini", key, settings.model || DEFAULT_MODEL);
}

// Authoritative Strict Restriction Policy for Prohibited / Restricted Categories:
// A website must be rejected if any restricted category word, meaningful category phrase,
// or relevant image is found anywhere in the available website content.
// The 10 strictly prohibited categories are:
// 1. Porn and adult content
// 2. Medicine, medical, and hospitals
// 3. Food and food products
// 4. Weapons, knives, and firearms
// 5. Defence and military
// 6. Aircraft, aviation, and aerospace
// 7. Marine, ships, and boats
// 8. Chemicals and chemical products
// 9. Alcohol and alcoholic beverages
// 10. Animals and animal-related products
// Incidental mentions, testimonials, blogs, news, FAQs, footers, headers, privacy/terms,
// and images are NOT exempt. Genuine occurrences trigger rejection across all crawled content.

const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    websiteStatus: {
      type: "STRING",
      enum: ["Working", "Not Working", "Domain Expired", "Non English", "Under Construction", "Flash", "Redirect Site", "Manual Review"],
      description: "Working if operational physical goods company or eligible B2B service provider; Not Working if dead, unreachable, 404/500, prohibited/restricted category, or non-manufacturer online retail shop; Domain Expired if parked, for sale, or expired domain; Redirect Site if redirected to a completely different external domain; Non English if foreign language with no English translation available; Under Construction if under maintenance/coming soon; Flash if built in uncopyable Flash; Manual Review if anti-bot challenge or ambiguous access."
    },
    notWorkingReason: {
      type: "STRING",
      description: "Mandatory if websiteStatus is Not Working, Domain Expired, Non English, Under Construction, Flash, or Manual Review: provide a concise, genuine business or technical reason (e.g. 'Website has 0 products and no verifiable catalog or physical address', 'Prohibited category: medicine/medical', 'Online retailer with shopping cart and no factory', 'Domain expired / parking page', 'Under construction'). Return empty string if Working."
    },
    businessType: {
      type: "STRING",
      enum: [
        "Manufacturer",
        "Industrial Services",
        "Exporter",
        "Trader",
        "Distributor",
        "Supplier",
        "Wholesaler",
        "Service Provider",
        "Online Shopping",
        "Restricted Site",
        "Other"
      ],
      description: "Business scope classification. Allowed working types: Manufacturer (manufactures physical goods in own facility/factory), Industrial Services (machining, fabrication, industrial maintenance), Exporter, Trader, Distributor (authorized physical distributor/network), Supplier (B2B goods supplier), Wholesaler (wholesale goods), Service Provider (eligible B2B services). Ordinary online retail shopping without manufacturing/supply evidence is Online Shopping."
    },
    companyProfile: {
      type: "STRING",
      enum: ["Available", "Not Available"],
      description: "Available if dedicated company overview, history, story, mission, or factory profile text exists describing background or operations; Not Available if only brief slogans, taglines, or bare product listings."
    },
    companyName: {
      type: "STRING",
      description: "Official legal registered company name in COMPLETE FULL FORM and Title Case (every word starts with a Capital letter). Return \"\" if websiteStatus is not Working.\n\n1. SOURCE PRIORITY & NOISE REMOVAL: Prefer the full official legal registered name (with corporate suffix like Limited, Incorporated, GmbH, Sdn Bhd, Pte Ltd, Sp. z o.o., etc.) from Footer copyright, About Us, Contact Us, or JSON-LD over a shortened header/logo brand. Strip slogans, taglines, field labels ('Company Name:'), copyright notices ('© 2026', 'All Rights Reserved'), and narrative prose.\n\n2. STRICT SUFFIX ACCURACY (NO INVENTED SUFFIXES): Expand ONLY the exact corporate and industry abbreviations actually written on the website. NEVER invent or append 'Limited', 'Company', or any suffix not present on the site (e.g. standalone 'Co.' -> 'Company', NEVER 'Company, Limited'; standalone 'Ltd.' -> 'Limited').\n\n3. COMMA RULE (EXACT SOURCE MATCH): Preserve a comma before or inside a corporate suffix ONLY if a comma is explicitly written on the website (e.g. 'Acme Co., Ltd.' -> 'Acme Company, Limited'; 'Acme, LLC' -> 'Acme, Limited Liability Company'). If NO comma is written on the site (e.g. 'Acme Co. Ltd.' -> 'Acme Company Limited'; 'TAD Communications Ltd' -> 'TAD Communications Limited'), DO NOT insert a comma.\n\n4. MANDATORY FULL-FORM EXPANSIONS:\n- Corporate Entities: Co. -> Company, Ltd. / Ltd -> Limited, Co., Ltd. -> Company, Limited, Co. Ltd. -> Company Limited, Inc. -> Incorporated, Corp. -> Corporation, LLC -> Limited Liability Company, LLP -> Limited Liability Partnership, PLC -> Public Limited Company, Pty Ltd -> Proprietary Limited, Pte Ltd / Pvt Ltd -> Private Limited, Sdn Bhd -> Sendirian Berhad, Bhd -> Berhad, PT -> Perseroan Terbatas, Tbk -> Terbuka, CV -> Commanditaire Vennootschap, SE -> Societas Europaea, GmbH / Ges.m.b.H. -> Gesellschaft mit beschränkter Haftung, AG -> Aktiengesellschaft, KG -> Kommanditgesellschaft, Cie -> Compagnie, Cia -> Compañía, SARL -> Société à Responsabilité Limitée, SAS -> Société par Actions Simplifiée, B.V. -> Besloten Vennootschap, N.V. -> Naamloze Vennootschap, S.A. -> Sociedad Anónima / Société Anonyme, S.L. -> Sociedad Limitada, S.r.l. -> Società a Responsabilità Limitata, S.p.A. -> Società per Azioni, Sp. z o.o. -> Spółka z Ograniczoną Odpowiedzialnością, AB -> Aktiebolag, Oy -> Osakeyhtiö, A/S -> Aktieselskab, Ltda. -> Limitada.\n- Industry Words: Mfg. -> Manufacturing, Ind. -> Industries, Indl. -> Industrial, Intl. -> International, Eng. -> Engineering, Equip. -> Equipment, Prods. -> Products, Bros. -> Brothers, Tech. -> Technology, Techs. -> Technologies, Sys. -> Systems, Svcs. -> Services, Ent. -> Enterprises, Solns. -> Solutions, Matls. -> Materials, Elec. -> Electronics, Mech. -> Mechanical, Prec. -> Precision, Plast. -> Plastics, Assoc. -> Associates, Labs. -> Laboratories, Comm. -> Communications.\n\n5. SYMBOLS, BRACKETS, ACRONYMS & BOUNDARIES: Remove brackets ()/[] while keeping inner text (keep country names inside company name as-is). Keep internal symbols verbatim ('&', '+', '/', '%', '#', periods in 'U.S.' or 'Sp. z o.o.')—NEVER expand '&' to 'And' or '+' to 'Plus'. Keep genuine short brand acronyms in UPPERCASE (e.g. 'PERI', 'PEM', 'CNC', 'USA'), but convert regular ALL-CAPS words to Title Case. Strictly remove ALL special characters from the very beginning and very end of the name (no leading or trailing '.', ',', '-', '!', '*', '&', '+', '/', '#', '@', '®', '™', '©', or quotes)."
    },
    countryName: {
      type: "STRING",
      description: "Standardized full expanded English country name based on official evidence in priority order: (1) physical headquarters address, (2) corporate imprint/registration, (3) official social media, (4) domain TLD / calling code. NEVER guess without evidence. Always full form (e.g. United States Of America, United Kingdom, Canada, Australia, Singapore, Germany, France, etc.). Empty string \"\" if websiteStatus is not Working."
    },
    companyAddress: {
      type: "STRING",
      description: "Official physical headquarters address in COMPLETE FULL FORM and Title Case (every word starts with a Capital letter). Output \"\" if websiteStatus is not Working, or \"Not Available\" if a Working site has no verifiable physical address.\n\n1. HEADQUARTERS PRIORITY ORDER: (1) Explicitly labeled Global/Corporate Headquarters, (2) Head Office, (3) Main Office, (4) Registered Office (only if no physical HQ/Head/Main office exists). Never select a branch, warehouse, factory, showroom, or dealer when an HQ/Head/Main office is available.\n\n2. COMPLETE MULTI-LINE EXTRACTION & SEQUENCE: Combine all address lines into one comma-separated string in the exact original sequence shown on the website. Retain EVERY structural component: Premise / Building / Complex Name, Block / Lot / Plot / Survey Number, Suite / Unit / Floor / Level / Room, Industrial Estate / Business Park / Zone, Street Number and Street Name, Suburb / Locality / Neighborhood / Village, Town / Township / Sub-district / District, City, and County / Province / Territory / State. Never drop leading unit/building numbers or trailing cities/districts/states.\n\n3. STRICT NOISE REMOVAL: Strip company name, contact person names, office labels (e.g. 'Physical Address:', 'Head Office:'), phone/fax numbers, email addresses, website URLs, business hours, map prompts ('Click Here for Map'), tax/registration numbers, all postal/ZIP/PIN codes (including UK alphanumeric postcodes like B75 7BU, SW1A 1AA, Canadian M5V 2T6, etc.), and country name. Remove brackets ()/[] while keeping inner text. Strip any leading or trailing commas, periods, colons, or symbols.\n\n4. MANDATORY FULL-FORM EXPANSION (ALL COMPONENTS GLOBALLY):\n- Premise, Floor & Box: Blk / Blk. -> Block, Bldg / Bldg. -> Building, Ste / Ste. -> Suite, Apt / Apt. -> Apartment, Fl / Flr / Fl. -> Floor, Lvl -> Level, Rm / Rm. -> Room, Dept. -> Department, Off. -> Office, Ph. -> Phase, Sec. -> Section, S.No. -> Survey Number, Opp. -> Opposite, Nr. -> Near, G/F -> Ground Floor, B/F -> Basement Floor, 1/F..9/F or 1F..9F -> 1st Floor..9th Floor, Asian hyphenated floors (e.g. 6F-1, 6/F-1, 6F之1) -> 6th Floor-1, P.O. Box / PO Box / POB / Postfach -> Post Office Box (KEEP Post Office Box numbers!).\n- Number Prefix Rule: Expand No. / No / Nos. / N: / No: / # (before standalone building/street number) -> Number ONLY when written on the website. NEVER invent or add 'Number' before bare street numbers (e.g. '13 Park Ave' -> '13 Park Avenue', 'Via Del Gregge, 220' -> 'Via Del Gregge, 220').\n- Thoroughfares & Directionals: St. -> Street (EXCEPT 'Saint' before proper/saint names like St. James, St. Paul, St. Polten), Rd. -> Road, Ave. -> Avenue, Dr. -> Drive (EXCEPT 'Doctor/Doktor' before person names like Dr. Sutomo), Blvd. -> Boulevard, Ln. -> Lane, Ct. -> Court, Cir. -> Circle, Pkwy. -> Parkway, Hwy. -> Highway, Expy. -> Expressway, Fwy. -> Freeway, Pl. -> Place, Sq. -> Square, Ter. -> Terrace, Trl. -> Trail, Cres. -> Crescent, Pde. -> Parade, Cl. -> Close, Co. Rd. -> County Road, Rte. -> Route, FM -> Farm To Market Road, GAR Hwy -> Grand Army Of The Republic Highway, MLK -> Martin Luther King, MG Road -> Mahatma Gandhi Road, N. -> North, S. -> South, E. -> East, W. -> West, NE/NW/SE/SW -> Northeast/Northwest/Southeast/Southwest.\n- Zones & Administrative Divisions: Ind. Est. -> Industrial Estate, Ind. Area -> Industrial Area, Ind. Park -> Industrial Park, Bus. Park -> Business Park, Tech. Park -> Technology Park, Trdg. Est. -> Trading Estate, Est. -> Estate, Dist. -> District, Twp. -> Township, Muni. -> Municipality, Prov. -> Province, Co. -> County (administrative only).\n- Global Non-English & Regional Terms: Jl./Jln. -> Jalan, Lrg. -> Lorong, Tmn. -> Taman, Bdr. -> Bandar, Kg. -> Kampung, Kaw. Ind. -> Kawasan Industri, Perum. -> Perumahan, Kec. -> Kecamatan, Kab. -> Kabupaten, Kel. -> Kelurahan, Ds. -> Desa, Dk. -> Dukuh, RT/RW -> Rukun Tetangga/Rukun Warga, N.T. -> New Territories, Kln -> Kowloon, Pref. -> Prefecture, Z.I. -> Zone Industrielle, Pol. Ind. -> Poligono Industrial, Str. -> Strasse (DE/AT/CH) or Straat (NL/BE), ul. -> Ulica, C/ -> Calle, Avda. -> Avenida, R. -> Rua, Rod. -> Rodovia, Col. -> Colonia, Cad./Cd. -> Caddesi, Sok./Sk. -> Sokak, Mah. -> Mahallesi, OSB -> Organize Sanayi Bolgesi.\n- States, Provinces & Counties: Expand ALL abbreviated states/provinces/counties inside the address (e.g. US: MA -> Massachusetts, TX -> Texas, CA -> California, IL -> Illinois, WI -> Wisconsin, OH -> Ohio; CA: ON -> Ontario, QC -> Quebec, BC -> British Columbia; AU: VIC -> Victoria, NSW -> New South Wales, QLD -> Queensland; UK: Northants -> Northamptonshire, Co. Durham -> County Durham; IN: MH -> Maharashtra, KA -> Karnataka, TN -> Tamil Nadu, GJ -> Gujarat, MIDC -> Maharashtra Industrial Development Corporation, GIDC -> Gujarat Industrial Development Corporation; ID/MY: Jateng -> Jawa Tengah, Jabar -> Jawa Barat, Jatim -> Jawa Timur, Sgr -> Selangor; AT/CH/DE/BR/MX: NÖ -> Niederösterreich, ZH -> Zürich, SP -> São Paulo, CDMX -> Ciudad de Mexico).\n\n5. PRESERVE VERBATIM & COMMA RULES: Keep hash floor-unit codes (e.g. #01-12, #04-05), '+' symbols (Units 3 + 4), and non-English proper names/diacritics unchanged. Separate distinct structural components with commas in their original order, and ALWAYS place a comma before the State/Province. NEVER split a street number from its street name or put commas inside a street/park name."
    },
    state: {
      type: "STRING",
      enum: ["Available", "Not Available"],
      description: "Available if an official State, County, Province, Territory, or Prefecture is explicitly mentioned in companyAddress, or if a national Capital City is mentioned, or for City-States (e.g. Singapore, Monaco, Vatican City); otherwise Not Available. Note: (County, Province, Prefecture) should be considered as State. If a country's capital is mentioned in the address, then both City and State are considered available. For Singapore addresses, both City and State are considered Available. Do NOT guess or infer from city/ZIP/country, and do NOT treat street names or building names as State."
    },
    city: {
      type: "STRING",
      enum: ["Available", "Not Available"],
      description: "Available if an official City, Town, District, Municipality, or designated locality is explicitly mentioned in companyAddress, or if a national Capital City is mentioned, or for City-States (e.g. Singapore, Monaco, Vatican City); otherwise Not Available. Note: (Town, District, Municipality) should be considered as City. If a country's capital is mentioned in the address, then both City and State are considered available. For Singapore addresses, both City and State are considered Available."
    }, emailId: {
      type: "STRING",
      description: "Primary corporate contact email address found anywhere on website or company social media (LinkedIn, Facebook)."
    },
    secondaryEmailId: {
      type: "STRING",
      description: "Secondary distinct corporate email from anywhere on website or company social media (LinkedIn, Facebook). STRICTLY MUST NOT be the same as emailId."
    },
    phoneNumber: {
      type: "STRING",
      description: "Domestic subscriber digits ONLY. Country calling code (+1, +44, +60, +61, +62, +86, +91, +886, etc.) and leading trunk zero MUST ALWAYS BE REMOVED. E.g. '+6043329299' -> '43329299'; '+86 21 6888 8888' -> '2168888888'; '+91 98401 23456' -> '9840123456'; '+886 4 7322367' -> '47322367'; '+1 212 555 1234' -> '2125551234'. Digits only. Strictly do not take toll-free numbers."
    },
    numberOfProducts: {
      type: "STRING",
      enum: ["0", "1", "2", "3"],
      description: "Count of distinct physical products offered (not repeated images of the same product): '0', '1', '2', or '3' (for 3 or more). Evaluated independently."
    },
    productImages: {
      type: "STRING",
      enum: ["0", "1", "2", "3"],
      description: "Count of genuine physical product photographs (excluding banners, logos, icons, and decorative graphics): '0', '1', '2', or '3' (for 3 or more). Evaluated independently."
    },
    numberOfProductDescriptions: {
      type: "STRING",
      enum: ["0", "1", "2", "3"],
      description: "Count of distinct physical products with actual descriptive text: '0', '1', '2', or '3' (for 3 or more). Evaluated independently."
    }
  },
  required: [
    "websiteStatus",
    "notWorkingReason",
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DEFAULT_AI_PROVIDER,
    DEFAULT_API_KEY,
    DEFAULT_GROQ_API_KEY,
    GEMINI_MODELS,
    GROQ_MODELS,
    DEFAULT_MODEL,
    DEFAULT_GROQ_MODEL,
    AI_PROVIDERS,
    EXTRACTION_MODES,
    DEFAULT_EXTRACTION_MODE,
    normalizeExtractionMode,
    inferProviderByKeyPrefix,
    normalizeProviderAndModel,
    resolveAiProviderConfig,
    GEMINI_RESPONSE_SCHEMA
  };
}
