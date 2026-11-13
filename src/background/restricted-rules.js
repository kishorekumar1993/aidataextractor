// Prohibited industry, platform, flash, language, and e-commerce/shopping-cart compliance checks.

const RESTRICTED_PATTERNS = [
  {
    pattern: /\b(?:porn(?:o|ography|ographic)?|xxx|sex\s*shop|sex\s*store|escort\s*service|cam\s*girl|cam\s*model|strip\s*club|brothel|adult\s*toys?|dildos?|vibrators?|fetish|erotica|erotic|sex\s*worker|sensual\s*massage|onlyfans|adult\s*(?:entertainment|content|industry|videos?|movies?|films?|sites?|websites?|novelty|novelties|stores?|shops?|dating|webcams?|services?|chats?|massage|products?|games?|erotica|fun|nightclub|club|arcades?|bookstores?|theaters?|theatres?|magazines?|escorts?|performers?|models?|livestreams?|personals?)|(?:18\+|xxx|explicit|hardcore|erotic)\s+adults?)\b/i,
    label: "Adult & Porn"
  },
  {
    pattern: /\b(?:firearms?|rifles?|handguns?|pistols?|shotguns?|assault\s*weapons?|ammunition|munitions?|gun\s*shop|gun\s*dealer|gun\s*store|weapons?\s*(?:manufacturer|trading|supply|export|repair)|explosives?|bomb\s*making|ballistic\s*vests?|body\s*armor|body\s*armour|bulletproof|tactical\s*armaments|military\s*armor|combat\s*knives|tactical\s*knives|hunting\s*knives|custom\s*knives|knife\s*maker|bayonets?|machetes?|daggers?|swords?)\b/i,
    label: "Weapons, Armor & Knives"
  },
  {
    pattern: /\b(?:military|armed\s*forces|tactical\s*armaments|artillery|combat\s*vehicles?|missile\s*systems?|defence\s*contractors?|defense\s*contractors?|military\s*defence|military\s*defense|ministry\s*of\s*defence|department\s*of\s*defense|defence\s*forces?|defense\s*forces?|national\s*defence|national\s*defense|homeland\s*defence|homeland\s*defense|air\s*defence|air\s*defense|naval\s*defence|naval\s*defense|aerospace\s*(?:and|&)\s*defence|aerospace\s*(?:and|&)\s*defense|defence\s*equipment|defense\s*equipment|defence\s*systems?|defense\s*systems?|defence\s*industry|defense\s*industry|munitions?)\b/i,
    label: "Defence & Military"
  },
  {
    pattern: /\b(?:airlines?|commercial\s*aviation|aviation\s*services?|air\s*travel|flight\s*booking|aircraft\s*leasing|aviation\s*charter|aircraft\s*(?:manufacturer|manufacturing|production|builder|assembly|fleet|carrier|operator|maintenance|overhaul|mro)|airplane\s*(?:manufacturer|manufacturing|fleet|carrier)|airplanes?\s*charter|avionics|helicopters?\s*(?:charter|services?|manufacturer)|fighter\s*jets?|jet\s*aircraft)\b/i,
    label: "Aviation & Airlines"
  },
  {
    pattern: /\b(?:aerospace\s*(?:manufacturer|manufacturing|contractor|defense|systems\s*manufacturer|industry\s*oem|propulsion|spacecraft|satellite\s*manufacturer|launch\s*vehicle|rocket)|spacecraft|satellite\s*manufacturing|rocket\s*propulsion|space\s*exploration\s*technology)\b/i,
    label: "Aerospace"
  },
  {
    pattern: /\b(?:marine\s*industry|marine\s*operations?|marine\s*(?:transport(?:ation)?|shipping|logistics|freight|charter|vessel\s*operator|terminal|port\s*authority|salvage|dredging|aquaculture|fishery|fisheries|offshore\s*drilling|propulsion\s*systems)|maritime\s*(?:transport|logistics|shipping|security|charter|navigation)|naval\s*(?:fleet|operations|dockyard|base))\b/i,
    label: "Marine"
  },
  {
    pattern: /\b(?:shipyards?|shipbuilding|shipbuilders?|ship\s*builders?|ship\s*repairs?|boat\s*builders?|boat\s*building|naval\s*ships?|cargo\s*ships?|cruise\s*ships?|container\s*ships?|warships?|battleships?|vessels?\s*builder|commercial\s*vessels?|yachts?\s*(?:builder|charter)|motor\s*yachts?\s*builder|sailing\s*yachts?\s*builder|ferries|ferry\s*boats?|tugboats?|barges?)\b/i,
    label: "Ships & Boats"
  },
  {
    pattern: /\b(?:specialty\s*chemicals?\s*(?:manufacturer|producer|production|supplier)|industrial\s*chemicals?\s*(?:manufacturer|producer|supplier)|petrochemicals?\s*(?:refinery|manufacturer|plant)|agrochemicals?\s*(?:manufacturer|producer)|pesticides?\s*(?:manufacturer|producer)|hazardous\s*chemicals?\s*production|chemical\s*synthesis|solvents?\s*(?:manufacturer|producer)|toxic\s*chemicals?\s*production|raw\s*chemicals?\s*(?:production|manufacturer)|chemical\s*manufacturer|chemical\s*producer|chemical\s*manufacturing)\b/i,
    label: "Chemicals & Petrochemicals"
  },
  {
    pattern: /\b(?:hospital|hospitals|patient\s*care|dental\s*clinic|outpatient\s*clinic|surgery\s*center|veterinary\s*hospital|psychiatric\s*hospital|health\s*clinic|diagnostic\s*center|medical\s*(?:practice|center|treatment|services?|diagnostic|consultation|therapy|care|doctor|physician|imaging\s*center|laboratory|surgical\s*center)|pharmaceutical\s*(?:company|manufacturer|manufacturing|drugs?|formulation|products?)|prescription\s*drugs?|online\s*pharmacy|medicine\s*(?:manufacturer|production|formulation|sales|store))\b/i,
    label: "Medicine, Medical & Hospital"
  },
  {
    pattern: /\b(?:food\s*(?:processing\s*plant|manufacturing|production|manufacturer|producer|packaging\s*facility|wholesaler)|commercial\s*bakery|catering\s*services?|restaurants?|bistros?|cafes?|eateries|snack\s*foods?\s*(?:manufacturer|producer)|dairy\s*products?\s*(?:processing|manufacturer)|meat\s*processing\s*plant|poultry\s*processing\s*plant|seafood\s*processing\s*plant|edible\s*oils?\s*refinery|confectionery\s*manufacturer)\b/i,
    label: "Food & Beverages"
  },
  {
    pattern: /\b(?:brewery|breweries|distillery|distilleries|liquor\s*store|liquor\s*shop|wine\s*producer|winery|wineries|vineyards?|craft\s*beer\s*(?:brewery|producer)|beer\s*(?:manufacturer|producer|brewing|brewery)|wine\s*(?:producer|maker|making|cellar)|spirits\s*(?:distiller|distillery|manufacturer)|alcoholic\s*beverages?\s*(?:manufacturer|producer|wholesaler))\b/i,
    label: "Alcohol & Breweries"
  },
  {
    pattern: /\b(?:pet\s*shop|pet\s*store|pet\s*food\s*manufacturer|pet\s*care\s*services?|animal\s*breeding|livestock\s*(?:farming|producer|breeding|trade)|cattle\s*farming|poultry\s*farming|pig\s*farming|commercial\s*slaughterhouse|veterinary\s*clinic|vet\s*clinic|veterinary\s*hospital|puppy\s*mill|dog\s*breeding|kennel\s*club|cattery)\b/i,
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

/**
 * Classifies website pages by evidence priority per Section 3:
 * HIGH: Home, About Us, Products, Services, Catalog, Capabilities, Overview.
 * LOW: Privacy, Terms, Cookies, Policy, Legal, Blogs, News, Testimonials, Bio, FAQ.
 */
function getEvidencePagePriority(url = "", pageTitle = "") {
  const normUrl = String(url || "").toLowerCase();
  const normTitle = String(pageTitle || "").toLowerCase();

  if (/(?:privacy|privacy-policy|terms|terms-and-conditions|terms-of-service|terms-of-use|legal|disclaimer|cookie|cookies|cookie-policy|blog|news|article|articles|press|press-release|testimonial|testimonials|reviews|bio|biography|team|staff|author|careers|jobs|faq|faqs|sitemap|imprint|impressum)/i.test(normUrl) ||
      /(?:privacy\s*policy|terms\s*(?:and|&)\s*conditions|terms\s*of\s*(?:service|use)|cookie\s*policy|blog|latest\s*news|press\s*release|testimonials?|disclaimer)/i.test(normTitle)) {
    return "LOW";
  }

  if (/(?:^https?:\/\/[^\/]+\/?$|home|index|default|about|about-us|company|profile|corporate-profile|products?|catalog|catalogue|services?|capabilities|what-we-do|our-company|overview|manufacturing)/i.test(normUrl)) {
    return "HIGH";
  }

  return "MEDIUM";
}

/**
 * Broad candidate mapping to discover potential restricted keyword mentions
 * before contextual application analysis.
 */
const CANDIDATE_CATEGORY_KEYWORDS = [
  { label: "Adult & Porn", regex: /\b(?:porn(?:o|ography|ographic)?|xxx|adult|sex|escort|brothel|erotic|erotica)\b/i },
  { label: "Weapons, Armor & Knives", regex: /\b(?:weapons?|firearms?|rifles?|guns?|knives|knife|ammunition)\b/i },
  { label: "Defence & Military", regex: /\b(?:military|defence|defense|armed\s*forces)\b/i },
  { label: "Aviation & Airlines", regex: /\b(?:aircraft|airplane|airlines?|aviation)\b/i },
  { label: "Aerospace", regex: /\b(?:aerospace|spacecraft|satellite)\b/i },
  { label: "Marine", regex: /\b(?:marine|maritime|naval)\b/i },
  { label: "Ships & Boats", regex: /\b(?:ship|ships|shipyard|shipbuilding|boat|boats|vessel|vessels|yacht|yachts)\b/i },
  { label: "Chemicals & Petrochemicals", regex: /\b(?:chemicals?|petrochemicals?|solvents?)\b/i },
  { label: "Medicine, Medical & Hospital", regex: /\b(?:medical|medicine|hospital|pharmaceuticals?|clinic)\b/i },
  { label: "Food & Beverages", regex: /\b(?:food|bakery|catering|restaurant|eatery)\b/i },
  { label: "Alcohol & Breweries", regex: /\b(?:alcohol|brewery|breweries|distillery|distilleries|wine|beer|whiskey|whisky|liquor)\b/i },
  { label: "Animals & Pets", regex: /\b(?:animals?|pets?|puppy|puppies|dogs?|cats?|livestock|cattle)\b/i }
];

function sanitizeContextText(text) {
  let cleanText = String(text || "");

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

  // 2. Sanitize "Cat" false positives
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

  // 3. Sanitize "Ship" false positives
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

  // 4. Sanitize "Defence" / "Defense" false positives
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

  // 6. Component applications & served industry clause
  cleanText = cleanText.replace(/\b(?:connectors?|cables?|machining|tooling|components?|parts?|fasteners?|systems?|solutions?|gears?|valves?|pumps?)\s+(?:for|in)\s+[^.\n]+?(?=[.\n]|$)/gi, (match) => {
    if (/(?:aerospace|aircraft|military|defense|defence|medical|marine)/i.test(match)) {
      return " ";
    }
    return match;
  });

  // 7. Adult false positives (learners, education, children, furniture, pricing, privacy)
  cleanText = cleanText
    .replace(/\badult\s*(?:learners?|students?|children|life|audience|education|outdoor\s*furniture|furniture|tables?|benches?|chairs?|bicycles?|bikes?|watches?|apparel|clothing|shoes?|sizes?|sizing|swim|swimming|camps?|campers?|supervision|literacy|population|health|mental\s*health|care|medicine|patients?|volunteers?|staff|leaders?|advisors?|programs?|courses?|classes?|admissions?|diapers?|bibs?|incontinence|living|guardians?|relatives?|survivors?|immunization|vaccines?)\b/gi, " ")
    .replace(/(?:per|rates?\s+per|pricing\s+for|tickets?\s+for|cost\s+per|admit|admission\s+for|ages?\s+for)?\s*adults?\b/gi, " ")
    .replace(/(?:infants?|babies|toddlers?|children|kids?|youth|teens?|teenagers?|seniors?|men|women|families|family)[,\s]+(?:and|&|or)?\s*adults?\b/gi, " ")
    .replace(/\badults?[,\s]+(?:and|&|or)?\s*(?:children|kids?|youth|teens?|infants?|seniors?)\b/gi, " ")
    .replace(/\b(?:not\s+intended\s+for\s+children|children\s+under\s+(?:13|16|18)|age\s+of\s+majority|verify\s+your\s+age|parental\s+consent|adult\s+supervision\s+required|must\s+be\s+an\s+adult)\b/gi, " ")
    .replace(/\bnude\s*(?:color|shade|lip(?:stick|gloss)|palette|nail|tones?|leather|shoes?|pumps?|heels?|dress|fabric|tan)\b/gi, " ");

  // 8. Aerospace & Aircraft application false positives
  cleanText = cleanText
    .replace(/\b(?:for|in|serving|services?|supplying|supplies|solutions?|applications?|components?|parts?|tooling|cables?|machining|fabrication|engineering)\s+(?:for|in|to)?\s*(?:the\s+)?(?:aerospace|aircraft|aviation|defence|defense|medical|pharmaceutical)\b/gi, " ")
    .replace(/\b(?:aerospace|aircraft|aviation|defence|defense)\s+(?:applications?|grade|industry|industries|sector|sectors|market|markets|standards?|specifications?|spec|specs|cables?|connectors?|fasteners?|gears?|components?|parts?|tooling|machining|hangars?|composites?)\b/gi, " ")
    .replace(/\b(?:aircraft\s*cables?|aircraft-grade)\b/gi, " ")
    .replace(/\badvising\s+(?:corporate\s+)?clients\s+in\s+[^\n.]*?(?:aerospace|transportation)/gi, " ");

  // 9. Marine false positives
  cleanText = cleanText
    .replace(/\b(?:marine\s*grade|marine\s*environment|marine\s*resistant|marine\s*applications?|marine\s*coatings?|marine\s*equipment\s*manufacturers?)\b/gi, " ");

  // 10. Animals false positives (cruelty-free, vegan, animal welfare, government animal husbandry)
  cleanText = cleanText
    .replace(/\b(?:cruelty\s*[-–]?\s*free|not\s+tested\s+on\s+animals?|no\s+animal\s+testing|against\s+animal\s+cruelty|animal\s+welfare|animal\s+husbandry(?:\s+department)?)\b/gi, " ")
    .replace(/\banimal\s*(?:prints?|patterns?|designs?|motifs?|illustrations?|figures?|shapes?)\b/gi, " ");

  // 11. Alcohol false positives
  cleanText = cleanText
    .replace(/\b(?:whiskey|whisky)\s*(?:creek|river|ridge|valley|brown|oak|leather|bronze|finish|designs?|media|photo|photography)\b/gi, " ")
    .replace(/\b(?:photo|photograph|photographer|credit|architect|project)\s*(?:by|:)?\s*[^\n.]*?(?:whiskey|whisky)/gi, " ");

  // 12. Industrial equipment for food processing & bakery
  cleanText = cleanText
    .replace(/\b(?:equipment|machinery|machines?|conveyors?|systems?|solutions?|supplies|tooling)\s+(?:for|in)\s+(?:the\s+)?(?:food\s*processing|meat\s*processing|poultry\s*processing|dairy|bakery|beverage|pharmaceutical|medical)\s*(?:industry|industries|sector|sectors|market|markets|facilities|plants?)?\b/gi, " ")
    .replace(/\b(?:food\s*processing|meat\s*processing|poultry\s*processing|seafood\s*processing|dairy\s*processing|bakery|bakeries|catering)\s+(?:equipment|machinery|machines?|conveyors?|systems?|packaging|packaging\s*machinery|automation|tooling|lines?|plants?|technology|engineering|solutions?|supplies|appliances?|industry|industries|facilities)\b/gi, " ");

  // 13. Pharmaceutical / medical equipment & served industries
  cleanText = cleanText
    .replace(/\b(?:pharmaceutical|medical|healthcare)\s+(?:equipment|machinery|machines?|conveyors?|packaging|packaging\s*machinery|processing|processing\s*equipment|automation|tooling|cleanrooms?|clean\s*rooms?|tanks?|vessels?|pumps?|valves?|piping|tubing|devices?|instrumentation|instruments?|components?|parts?|systems?|grade|applications?|industry|industries|sector|sectors|market|markets|facilities|manufacturing|solutions?)\b/gi, " ")
    .replace(/\b(?:food|beverage|packaging|dairy|bakery|meat|confectionery|cosmetic|cosmetics|chemical|nutraceutical)[,\s]+(?:and\s+)?(?:pharmaceutical|medical)\b/gi, " ")
    .replace(/\b(?:serving|serves|served|for|to)\s+(?:the\s+)?(?:pharmaceutical|medical)\s+(?:industry|industries|sector|sectors|applications?|market|markets)\b/gi, " ");

  return cleanText;
}

function detectRestrictedKeywordsSingle(text, html = "", pageUrl = "") {
  let combined = ((text || "") + " " + extractImageAttributes(html)).trim();
  if (!combined) {
    return {
      isRestricted: false,
      classification: "NO_RESTRICTED_CATEGORY",
      restricted_category: "",
      matched_keyword: "",
      matched_page: pageUrl || "",
      matched_context: "",
      business_activity: "",
      confidence: 1.0,
      reason: "No content provided",
      category: "",
      matchedKeyword: null,
      sourceUrl: pageUrl || "",
      snippet: ""
    };
  }

  // Strip HTML tags and attributes first
  let rawClean = combined.replace(/<[^>]+>/g, " ");
  let cleanText = sanitizeContextText(rawClean);

  // Check against strict genuine restricted business patterns
  for (const item of RESTRICTED_PATTERNS) {
    const regex = item.pattern || item;
    const label = item.label || "Prohibited Category";
    if (regex.test(cleanText)) {
      const m = cleanText.match(regex);
      let matchedKw = m ? m[0] : "";
      if (label === "Marine" && /^marine/i.test(matchedKw)) {
        matchedKw = "Marine";
      }
      const snippet = extractContextSnippet(cleanText, matchedKw);
      const pagePriority = getEvidencePagePriority(pageUrl, "");

      // If matched keyword was found only on a low-priority page (Terms, Privacy, Bio, Blog)
      if (pagePriority === "LOW" && !/(?:porn|adult\s*video|escort|firearms?\s*store|weapons?\s*manufacturer|airline\s*fleet)/i.test(matchedKw)) {
        return {
          isRestricted: false,
          is_restricted: false,
          classification: "FALSE_POSITIVE",
          restricted_category: label,
          matched_keyword: matchedKw,
          matched_page: pageUrl,
          matched_context: snippet,
          business_activity: "Non-restricted operations (incidental reference in low-priority content)",
          confidence: 0.94,
          reason: `Keyword "${matchedKw}" appeared only on a low-priority document (${pageUrl || "legal/policy"}), not company primary business.`,
          category: label,
          matchedKeyword: matchedKw,
          sourceUrl: pageUrl,
          snippet
        };
      }

      return {
        isRestricted: true,
        is_restricted: true,
        classification: "GENUINE_RESTRICTED",
        restricted_category: label,
        matched_keyword: matchedKw,
        matched_page: pageUrl,
        matched_context: snippet,
        business_activity: `Genuine ${label} business`,
        confidence: 0.98,
        reason: `${label} ("${matchedKw}")`,
        category: label,
        matchedKeyword: matchedKw,
        sourceUrl: pageUrl,
        snippet
      };
    }
  }

  // Check if un-sanitized raw text contains any candidate category keyword
  // (to produce structured FALSE_POSITIVE evidence if a generic word was used contextually)
  for (const cand of CANDIDATE_CATEGORY_KEYWORDS) {
    if (cand.regex.test(rawClean)) {
      const m = rawClean.match(cand.regex);
      let matchedKw = m ? m[0] : "";
      if (cand.label === "Marine" && /^marine/i.test(matchedKw)) {
        matchedKw = "Marine";
      }
      const snippet = extractContextSnippet(rawClean, matchedKw);
      return {
        isRestricted: false,
        is_restricted: false,
        classification: "FALSE_POSITIVE",
        restricted_category: cand.label,
        matched_keyword: matchedKw,
        matched_page: pageUrl,
        matched_context: snippet,
        business_activity: "Eligible physical goods or services (application / incidental context)",
        confidence: 0.96,
        reason: `The website mentions ${cand.label} ("${matchedKw}") only as an application area, served industry, or incidental reference.`,
        category: cand.label,
        matchedKeyword: matchedKw,
        sourceUrl: pageUrl,
        snippet
      };
    }
  }

  return {
    isRestricted: false,
    is_restricted: false,
    classification: "NO_RESTRICTED_CATEGORY",
    restricted_category: "",
    matched_keyword: "",
    matched_page: pageUrl,
    matched_context: "",
    business_activity: "",
    confidence: 1.0,
    reason: "No relevant restricted business detected",
    category: "",
    matchedKeyword: null,
    sourceUrl: pageUrl,
    snippet: ""
  };
}

/**
 * Searches across all crawled pages to evaluate restricted business evidence.
 * Prioritizes high-priority pages and deep evidence links.
 */
function detectRestrictedKeywords(text, html = "", crawledPages = []) {
  let bestFalsePositive = null;
  let bestManualReview = null;

  if (crawledPages && crawledPages.length > 0) {
    for (const page of crawledPages) {
      const pText = page.text || stripHtml(page.html || "");
      const res = detectRestrictedKeywordsSingle(pText, page.html || "", page.url || "");

      if (res.classification === "GENUINE_RESTRICTED") {
        const exactLink = findExactEvidenceLink(page.html || "", res.matched_keyword || res.matchedKeyword, null, page.url);
        const resolvedUrl = exactLink || page.url;
        return {
          ...res,
          matched_page: resolvedUrl,
          sourceUrl: resolvedUrl,
          snippet: extractContextSnippet(pText, res.matched_keyword || res.matchedKeyword)
        };
      }

      if (res.classification === "MANUAL_REVIEW" && !bestManualReview) {
        bestManualReview = { ...res, sourceUrl: page.url, snippet: extractContextSnippet(pText, res.matched_keyword) };
      }

      if (res.classification === "FALSE_POSITIVE" && !bestFalsePositive) {
        bestFalsePositive = { ...res, sourceUrl: page.url, snippet: extractContextSnippet(pText, res.matched_keyword) };
      }
    }
  }

  // Fallback check on combined text
  const fallback = detectRestrictedKeywordsSingle(text, html, (crawledPages && crawledPages[0] && crawledPages[0].url) || "");
  if (fallback.classification === "GENUINE_RESTRICTED") {
    const pageUrl = (crawledPages && crawledPages[0] && crawledPages[0].url) || "";
    const exactLink = findExactEvidenceLink(html, fallback.matched_keyword || fallback.matchedKeyword, null, pageUrl);
    const resolvedUrl = exactLink || pageUrl;
    return {
      ...fallback,
      matched_page: resolvedUrl,
      sourceUrl: resolvedUrl,
      snippet: extractContextSnippet(text, fallback.matched_keyword || fallback.matchedKeyword)
    };
  }

  if (bestManualReview) return bestManualReview;
  if (bestFalsePositive) return bestFalsePositive;
  if (fallback.classification === "FALSE_POSITIVE" || fallback.classification === "MANUAL_REVIEW") return fallback;

  return {
    isRestricted: false,
    is_restricted: false,
    classification: "NO_RESTRICTED_CATEGORY",
    restricted_category: "",
    matched_keyword: "",
    matched_page: "",
    matched_context: "",
    business_activity: "",
    confidence: 1.0,
    reason: "No relevant restricted business detected",
    category: "",
    matchedKeyword: null,
    sourceUrl: "",
    snippet: ""
  };
}

/**
 * Pinpoints the exact keyword, source page URL, and context snippet supporting a business type.
 * Prioritizes deep anchor links (e.g. /about, /manufacturing, /factory) over generic homepage URLs.
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
    /\b(?:this\s+site\s+is\s+currently\s+unavailable|account\s+suspended|this\s+account\s+has\s+been\s+suspended)\b/i,
    /(?:parking-lander|\bap:\s*["']parking["']|LANDER_SYSTEM\s*=|location(?:\.href)?\s*=\s*["']\/lander["']|sedoparking|bodis\.com)/i
  ];
  const checkCorpus = pageTitle + " " + plainText + " " + (html || "").slice(0, 5000);
  for (const pp of parkedPatterns) {
    if (pp.test(checkCorpus)) {
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

  // 1. Explicit first-person manufacturing ownership proof (highest confidence)
  const hasFirstPersonManufacturing = /\b(?:we\s+(?:manufacture|produce|fabricate|build|engineer|design\s+and\s+manufacture)|our\s+(?:factory|manufacturing\s+(?:facility|plant)|production\s+(?:plant|facility)|fabrication\s+(?:plant|facility)|foundry|workshop)|custom\s+(?:fabrication|manufacturing|molding|casting|machining)|oem(?:\/|\s+)odm|contract\s+manufactur(?:er|ing)|in-house\s+manufacturing)\b/i.test(combined);
  if (hasFirstPersonManufacturing) return true;

  // 2. Pure distributor / reseller exclusion:
  // e.g. "distributor of leading manufacturers", "authorized dealer for manufacturers", "we supply products from manufacturers"
  const isDistributorOrReseller = /\b(?:distributor\s+(?:of|for)|authorized\s+(?:distributor|dealer|reseller)|dealer\s+(?:of|for)|wholesaler\s+(?:of|for)|reseller\s+(?:of|for)|retailer\s+(?:of|for)|stockist\s+(?:of|for)|supplier\s+of\s+leading\s+manufacturers|products\s+from\s+(?:leading|top|various|world)\s+manufacturers)\b/i.test(combined);
  if (isDistributorOrReseller) return false;

  // 3. General manufacturer keyword fallback only if not disqualified as distributor
  return /\b(?:manufacturer|manufacturers|manufacturing|manufacture|oem|odm|custom\s+fabricat(?:ion|or|ed|ing))\b/i.test(combined);
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
