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
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite"
];
const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
  "allam-2-7b"
];

const DEFAULT_MODEL = getEnvVar("DEFAULT_MODEL", "gemini-3.5-flash-lite");
const DEFAULT_GROQ_MODEL = getEnvVar("GROQ_MODEL", "openai/gpt-oss-120b");

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
  const modelValidForProvider = effectiveProvider === "groq"
    ? (reqMod && !/^gemini-|^grok-/i.test(reqMod))
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

// Primary prohibited core industries per Instruction Sheet Note 2
// Rule: "Do not work on websites related to Porn, Adult, Medicine, Medical, Hospital, Food, Weapons (Knife), Defence, Aircraft, Aerospace, Marine, Ship, Chemical, Alcohol, Animals. Even if these images or words appear anywhere on the site, do not work on that site. make these rule strictly if any word appear make it notwroking"

const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    websiteStatus: {
      type: "STRING",
      enum: ["Working", "Not Working", "Domain Expired", "Non English", "Under Construction", "Flash", "Redirect Site"],
      description: "Working if operational physical goods company; Not Working if dead, 404, 0 products, or prohibited; Domain Expired if parked/404; Non English if non-English without translation; Under Construction if under construction; Flash if flash format; Redirect Site if redirected to different domain"
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
      description: "Available if dedicated company overview/profile/history text exists; else Not Available."
    },
    companyName: {
      type: "STRING",
      description: "Official corporate name in full expanded form and Title Case where EVERY word starts with a Capital letter (e.g. Inter Outstanding Electronics Incorporated, H&R Manufacturing, Web Rack Industrial Company Limited, PEM Fountain Company, Hsin Hsin Metals, Limited, Commanditaire Vennootschap Aulia Jati Indofurni, Zuber & Compagnie). MANDATORY FULL FORM EXPANSION: Expand ALL legal entity and business abbreviations to full form: Co. -> Company, Ltd. -> Limited, Inc. -> Incorporated, Corp. -> Corporation, LLC -> Limited Liability Company, LLP -> Limited Liability Partnership, PLC -> Public Limited Company, Pty Ltd -> Proprietary Limited, Pte Ltd/Pvt Ltd -> Private Limited, Sdn Bhd -> Sendirian Berhad, PT -> Perseroan Terbatas, CV -> Commanditaire Vennootschap, Cie -> Compagnie, Cia -> Compañía, SARL -> Société à Responsabilité Limitée, SAS -> Société par Actions Simplifiée, GmbH -> Gesellschaft mit beschränkter Haftung, B.V. -> Besloten Vennootschap, S.A. -> Sociedad Anónima/Société Anonyme, S.L. -> Sociedad Limitada, S.r.l. -> Società a Responsabilità Limitata, Mfg. -> Manufacturing, Ind. -> Industries/Industrial, Intl. -> International, Eng. -> Engineering, Equip. -> Equipment, Prods. -> Products, Bros. -> Brothers. Remove brackets ()/[] keeping inner text. Keep '&' as '&' (never 'And'). Keep comma before corporate suffix if on site (e.g. 'Hsin Hsin Metals, Limited'). Keep uppercase brand acronyms (PEM, BMW, AKS). Empty string \"\" if websiteStatus is not Working."
    },
    countryName: {
      type: "STRING",
      description: "Standardized full expanded English country name (e.g. United States Of America, United Kingdom, Germany, Spain, Italy, Netherlands, Austria, Switzerland, Croatia, Türkiye, United Arab Emirates, South Korea, Taiwan, China, Bahrain, Oman, Czech Republic, Brunei Darussalam, Papua New Guinea, Dominican Republic, Trinidad and Tobago, Saint Lucia, France, Australia, Canada, India, Indonesia, Japan, Malaysia, Singapore, New Zealand, South Africa, Mexico, Brazil, Poland, etc.). MANDATORY FULL EXPANSION: USA/US/United States -> United States Of America, UK/GB -> United Kingdom, UAE -> United Arab Emirates, KSA -> Saudi Arabia, PNG -> Papua New Guinea, DR -> Dominican Republic, HK -> Hong Kong, NZ -> New Zealand, Deutschland -> Germany, España -> Spain, Italia -> Italy, Nederland -> Netherlands, Österreich -> Austria, Schweiz -> Switzerland, Hrvatska -> Croatia, Turkey/Turkiye -> Türkiye, Republic of Korea -> South Korea, Republic of China -> Taiwan, Peoples Republic of China -> China, Kingdom of Bahrain -> Bahrain, Sultanate of Oman -> Oman, Czechia -> Czech Republic, Brunei -> Brunei Darussalam, St. Lucia -> Saint Lucia. Never return a city, state, continent, abbreviation, or blank if working; infer from social media or address locality if omitted. Empty string \"\" if websiteStatus is not Working."
    },
    companyAddress: {
      type: "STRING",
      description: "CRITICAL MANDATE - FULL PHYSICAL ADDRESS: You MUST take the COMPLETE FULL physical address with ALL available structural components from the website: Premise / Building Name / Office Park / Suite / Unit / Floor / Level / Block / Lot / Plot / Factory / Workshop / Survey Number, Industrial Estate / Business Park / Zone, Street Number and Street Name, Suburb / Locality / Neighborhood / Village, Town / Township / Sub-district / District, City, and State / Province / Territory / County / Region. NEVER return an incomplete or partial address (NEVER return only a street name or omit premise/suite/suburb/city/state). Format in Title Case where EVERY single word starts with a Capital letter (e.g. 'Suite 260, 2021 Guadalupe Street, Austin, Texas' or '15 Telford Way, Kettering, Northamptonshire' or '5th Floor, Office Park, Number 535, Qingshuiqiao Road, Hi-Tech Zone, Ningbo' or '40 Sarah Street, Campbellfield, Victoria'). CRITICAL QC RULE - NO EXTRA WORDS: Retain all authentic address words that appear on the website; do not invent or add words not present (e.g. if 'Number' or 'No.' is not written, DO NOT add 'Number'; if 'City' is not written, DO NOT add 'City'; if 'District' is not written, DO NOT add 'District'). MANDATORY FULL FORM EXPANSION: You MUST expand all abbreviations to full form globally (5/F. or 5/F or 5F -> 5th Floor, 1/F -> 1st Floor, 2/F -> 2nd Floor, 3/F -> 3rd Floor, G/F -> Ground Floor, B/F -> Basement Floor, Lvl -> Level, No. -> Number, St. -> Street, Rd. -> Road, Ave. -> Avenue, Dr. -> Drive, Blvd. -> Boulevard, Ste. -> Suite, Bldg. -> Building, Flr. -> Floor, Rm. -> Room, Dept. -> Department, Apt. -> Apartment, POB -> Post Office Box). Strip country name and postal codes. Empty string \"\" if websiteStatus is not Working."
    },
    state: {
      type: "STRING",
      enum: ["Available", "Not Available"],
      description: "Available ONLY IF a State, Province, County, Territory, Prefecture, Canton, Oblast, Voivodeship, Governorate, Emirate, Region, or National Capital City word is LITERALLY PRESENT in companyAddress across any country worldwide. Do NOT guess or infer state from external knowledge if no state/region word is written in companyAddress (e.g. '28 Rue Zuber, Rixheim' has no state/region written -> MUST be 'Not Available')."
    },
    city: {
      type: "STRING",
      enum: ["Available", "Not Available"],
      description: "Available if an official City, Town, Township, District, Municipality, Commune, Borough, or recognized town locality (e.g. Heanor Gate -> town of Heanor, Rixheim, Mulhouse, Zurich, Zagreb, Doha, Nairobi) is present in companyAddress across any country worldwide; else Not Available. Note: Suburbs/industrial estates alone without a recognized city/town (e.g. Campbellfield, Rowville, Mascot, Sandton) are Not Available."
    },
    emailId: {
      type: "STRING",
      description: "Primary corporate contact email address found anywhere on website or company social media (LinkedIn, Facebook)."
    },
    secondaryEmailId: {
      type: "STRING",
      description: "Secondary distinct corporate email from anywhere on website or company social media (LinkedIn, Facebook). STRICTLY MUST NOT be the same as emailId."
    },
    phoneNumber: {
      type: "STRING",
      description: "Complete phone number with ONLY the country code (+1, +33, +44, +61, +62, +886) and trunk (0) removed, keeping ALL remaining national digits (e.g. '+33 (0) 3 89 44 13 88' -> '389441388', NEVER drop '3'; '+6282136903270' -> '82136903270'). Digits only. Do not take toll-free numbers. Do not take numbers starting with zero."
    },
    numberOfProducts: {
      type: "STRING",
      enum: ["0", "1", "2", "3"],
      description: "Must be identical to productImages. '0', '1', '2', or '3' (for 3 or more)."
    },
    productImages: {
      type: "STRING",
      enum: ["0", "1", "2", "3"],
      description: "Number of physical product images/photos identified: '0', '1', '2', or '3' (for 3 or more)."
    },
    numberOfProductDescriptions: {
      type: "STRING",
      enum: ["0", "1", "2", "3"],
      description: "Must be identical to productImages. '0', '1', '2', or '3' (for 3 or more)."
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
