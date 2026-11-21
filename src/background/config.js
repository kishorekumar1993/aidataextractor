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
// The strictly prohibited categories are:
// 1. Porn and adult content
// 2. Medicine, medical, medical device manufacturing, and hospitals
// 3. Food and food products
// 4. Weapons, knives, and firearms
// 5. Defence, military, and ITAR registration (International Traffic in Arms Regulations)
// 6. Aircraft, aviation, and aerospace (including aerospace machinery/tooling)
// 7. Marine, ships, and boats
// 8. Chemicals and chemical products
// 9. Alcohol and alcoholic beverages
// 10. Animals and animal-related products
// 11. School, college, university, and educational institutions (Out of Scope / Prohibited)
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
      description: "Mandatory if websiteStatus is Not Working, Domain Expired, Non English, Under Construction, Flash, or Manual Review: provide a concise, genuine business or technical reason (e.g. 'Website has 0 products and no verifiable catalog or physical address', 'Prohibited category: medicine/medical', 'Online retailer with shopping cart and no factory', 'Domain expired / parking page', 'Under construction', 'Cloudflare anti-bot challenge'). Return empty string \"\" if Working or Redirect Site."
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
        "Other",
        ""
      ],
      description: "Business scope classification. Allowed working types: Manufacturer (manufactures physical goods in own facility/factory), Industrial Services (machining, fabrication, industrial maintenance), Exporter, Trader, Distributor (authorized physical distributor/network), Supplier (B2B goods supplier), Wholesaler (wholesale goods), Service Provider (eligible B2B services). Ordinary online retail shopping without manufacturing/supply evidence is Online Shopping. Output \"\" if websiteStatus is Not Working."
    },
    companyProfile: {
      type: "STRING",
      enum: ["Available", "Not Available", ""],
      description: "Available if dedicated company overview, history, story, mission, or factory profile text exists describing background or operations; Not Available if only brief slogans, taglines, or bare product listings. Output \"\" if websiteStatus is Not Working."
    },
    companyName: {
      type: "STRING",
      description: "Official legal registered company name in Title Case. Expand abbreviations (e.g. Co. -> Company, Ltd. -> Limited, Inc. -> Incorporated, Corp. -> Corporation, LLC -> Limited Liability Company, Pte Ltd -> Private Limited, GmbH -> Gesellschaft mit beschränkter Haftung). Never invent suffixes not present on site. Return \"\" if websiteStatus is not Working."
    },
    countryName: {
      type: "STRING",
      description: "Standardized full expanded English country name based on official evidence in priority order: (1) physical HQ address, (2) corporate registration, (3) official social media, (4) domain TLD / calling code. NEVER guess without evidence. Always full form (e.g. United States Of America, United Kingdom, Canada, Australia, Singapore, Germany, France). Return \"\" if websiteStatus is not Working."
    },
    companyAddress: {
      type: "STRING",
      description: "Address as it is directly from the website: do NOT add address items or words, and do NOT omit source words. Expand abbreviations only; do not make grammar changes or invent words. Official physical headquarters address in Title Case without country name or postal codes. Output \"\" if websiteStatus is not Working, or \"Not Available\" if a Working site has no verifiable physical address. Retain all structural components (building, suite, unit, floor, street, locality, district, city, state) in original sequence without omitting or truncating any parts. CONTACT ADDRESS vs GOOGLE MAPS RULE: compare the contact and map addresses for the same location and select the fuller complete address, without combining separate locations. Expand standard abbreviations ONLY (St. -> Street, Rd. -> Road, Ave. -> Avenue, Blvd. -> Boulevard, Ste. -> Suite, Bldg. -> Building, Fl. -> Floor, Dist. -> District, P.O. Box -> Post Office Box). Whenever 'No.', 'No', 'NO.', 'Nos.', 'N:', 'No:', or '#' appears before a building/street number in the source address (including concatenated forms without spaces e.g. 'No.1008' -> 'Number 1008', 'No. 62-6' -> 'Number 62-6', 'No. 409-6' -> 'Number 409-6'), ALWAYS expand it to 'Number '. NEVER drop or strip 'No.'. Never invent 'Number' before bare street numbers. Preserve '#' with unit numbers (e.g. #01-12). Format Asian floors as '6 Floor-1'. Never use ordinal grammar expansions on floor numbers (e.g. '1 Floor', '2 Floor', '6 Floor', not '1st Floor' or '6th Floor'). Preserve source punctuation in retained address text: do NOT add commas or any other punctuation. A line break or space is not evidence for a comma; when combining source lines in this string field, use spaces rather than adding commas. Remove only punctuation that belongs to a removed country/postal code or is replaced by an abbreviation expansion. Never add, remove, or reorder address components."
    },
    state: {
      type: "STRING",
      enum: ["Available", "Not Available", ""],
      description: "This is a drop-down option. If the state name is given in the address, select Available; if not, select Not Available. Note: (County, Province, Prefecture) should be considered as State. (If a country's capital is mentioned in the address, then both City and State are considered available). Standalone cities or districts without a state/county/province (e.g. 'Taichung', 'Beitun District', 'Shengang District') are Not Available. Output \"\" if websiteStatus is Not Working."
    },
    city: {
      type: "STRING",
      enum: ["Available", "Not Available", ""],
      description: "This is a drop-down option. If the city name is given in the address, select Available; if not, select Not Available. Note: (Town, District, Municipality) should be considered as City. (If a country's capital is mentioned in the address, then both City and State are considered available). Suburbs alone without city/town are Not Available. Output \"\" if websiteStatus is Not Working."
    }, emailId: {
      type: "STRING",
      description: "Primary corporate contact email from supplied website evidence or company social media. Check discovered emails and contact/career pages; recognize clearly obfuscated or visually split emails (for example, name [at] domain [dot] com or HTML/line-break splits) only when the intended address is unambiguous. Do not guess missing characters or use placeholder/decoy addresses. Output \"\" if websiteStatus is Not Working."
    },
    secondaryEmailId: {
      type: "STRING",
      description: "Secondary distinct corporate email from anywhere on website or company social media (LinkedIn, Facebook). STRICTLY MUST NOT be the same as emailId. Output \"\" if websiteStatus is Not Working."
    },
    phoneNumber: {
      type: "STRING",
      description: "Primary domestic subscriber digits ONLY, whether shown with or without an international calling code. Inspect supplied contact evidence including tel: links, phone-labelled attributes, and numbers split by formatting, HTML breaks, or extensions. Remove a verified country calling code and leading trunk zero when present; do not require a fixed calling-code list or drop valid subscriber digits. E.g. '+6043329299' -> '43329299'; '+86 21 6888 8888' -> '2168888888'; '+91 98401 23456' -> '9840123456'; '+886 4 7322367' -> '47322367'; '+1 212 555 1234' -> '2125551234'. Digits only; exclude fax, extensions, and toll-free numbers. Never guess missing digits. Output \"\" if websiteStatus is Not Working."
    },
    numberOfProducts: {
      type: "STRING",
      enum: ["0", "1", "2", "3", ""],
      description: "Count of distinct physical products offered (not repeated images of the same product): '0', '1', '2', or '3' (for 3 or more). Evaluated independently. Output \"\" if websiteStatus is Not Working."
    },
    productImages: {
      type: "STRING",
      enum: ["0", "1", "2", "3", ""],
      description: "Count of genuine physical product photographs (excluding banners, logos, icons, and decorative graphics): '0', '1', '2', or '3' (for 3 or more). Evaluated independently. Output \"\" if websiteStatus is Not Working."
    },
    numberOfProductDescriptions: {
      type: "STRING",
      enum: ["0", "1", "2", "3", ""],
      description: "Count of distinct physical products with actual descriptive text: '0', '1', '2', or '3' (for 3 or more). Evaluated independently. Output \"\" if websiteStatus is Not Working."
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
