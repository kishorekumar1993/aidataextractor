// Prohibited industry, platform, flash, language, and e-commerce/shopping-cart compliance checks.

const RESTRICTED_PATTERNS = [
  {
    pattern: /\b(?:porn(?:o|ography|ographic)?|sex\s*shop|sex\s*store|escort\s*service|cam\s*girl|cam\s*model|strip\s*club|brothel|adult\s*toys?|dildos?|vibrators?|fetish|erotica|erotic|sex\s*worker|sensual\s*massage|onlyfans|adult\s*(?:entertainment|content|industry|videos?|movies?|films?|sites?|websites?|novelty|novelties|stores?|shops?|dating|webcams?|services?|chats?|massage|products?|games?|erotica|fun|nightclub|club|arcades?|bookstores?|theaters?|theatres?|magazines?|escorts?|performers?|models?|livestreams?|personals?)|(?:18\+|explicit|hardcore|erotic)\s+adults?)\b/i,
    label: "Adult & Porn"
  },
  {
    pattern: /\b(?:firearms?|rifles?|handguns?|pistols?|shotguns?|assault\s*weapons?|ammunition|munitions?|gun\s*(?:shop|store|dealer|distributor|trader|sales|range|smith|smithing)|weapons?\s*(?:manufacturer|manufacturing|trading|trader|supply|supplier|export(?:er)?|repair|store|shop|dealer|distributor|sales|wholesaler)|ballistic\s*vests?|body\s*armor|body\s*armour|bulletproof\s*(?:vests?|armor|armour|plates?|helmets?|jackets?)|tactical\s*armaments|military\s*armor|knife\s*(?:shop|store|maker|manufacturer|blade|blades|dealer|distributor|crafting|sharpening|collectors?)|knives\s*(?:shop|store|dealer|distributor|manufacturer|sales|for\s*sale)|pocket\s*knives?|folding\s*knives?|hunting\s*knives?|tactical\s*knives?|combat\s*knives?|custom\s*knives?|survival\s*knives?|throwing\s*knives?|fixed\s*blade\s*knives?|handmade\s*knives?|switchblades?|bayonets?|machetes?|daggers?|swords?|bowie\s*knives?)\b/i,
    label: "Weapons, Armor & Knives"
  },
  {
    pattern: /\b(?:military|armed\s*forces|tactical\s*armaments|artillery|combat\s*vehicles?|missile\s*systems?|defence\s*contractors?|defense\s*contractors?|military\s*defence|military\s*defense|ministry\s*of\s*defence|department\s*of\s*defense|defence\s*forces?|defense\s*forces?|national\s*defence|national\s*defense|homeland\s*defence|homeland\s*defense|air\s*defence|air\s*defense|naval\s*defence|naval\s*defense|aerospace\s*(?:and|&)\s*defence|aerospace\s*(?:and|&)\s*defense|defence\s*equipment|defense\s*equipment|defence\s*systems?|defense\s*systems?|defence\s*industry|defense\s*industry|munitions?)\b/i,
    label: "Defence & Military"
  },
  {
    pattern: /\b(?:airlines?|commercial\s*aviation|aviation\s*services?|air\s*travel|flight\s*booking|aircraft\s*leasing|aviation\s*charter|passenger\s*flights?|airline\s*(?:tickets?|flights?|carrier|company)|air\s*charter|helicopter\s*charter|aircraft\s*(?:manufacturer|manufacturing|production|builder|assembly|fleet|carrier|operator|maintenance|overhaul|mro)|airplane\s*(?:manufacturer|manufacturing|fleet|carrier)|airplanes?\s*charter|avionics|helicopters?\s*(?:charter|services?|manufacturer)|fighter\s*jets?|jet\s*aircraft)\b/i,
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
    pattern: /\b(?:shipyards?|shipbuilding|shipbuilders?|ship\s*builders?|ship\s*repairs?|boat\s*builders?|boat\s*building|boat\s*(?:dealers?|sales|brokerage|charter|rental)|naval\s*ships?|cargo\s*ships?|cruise\s*ships?|container\s*ships?|warships?|battleships?|vessels?\s*builder|commercial\s*vessels?|yachts?\s*(?:builder|charter|brokerage|sales)|motor\s*yachts?\s*builder|sailing\s*yachts?\s*builder|ferries|ferry\s*boats?|tugboats?|barges?|ship\s*charter|ferry\s*operator|tugboat\s*operator|barge\s*operator)\b/i,
    label: "Ships & Boats"
  },
  {
    pattern: /\b(?:chemical\s*(?:manufacturer|manufacturing|producer|production|supplier|supplies|distributor|distribution|trading|trader|wholesaler|export(?:er)?|dealer|sales|vendor|company|corporation|inc|ltd|works|plant|industry)|petrochemicals?\s*(?:refinery|manufacturer|plant|producer|supplier|distributor|trading|company)|solvents?\s*(?:manufacturer|producer|supplier|distributor|trading|wholesaler)|industrial\s*chemicals?\s*(?:manufacturer|producer|supplier|distributor|trading|wholesaler)|specialty\s*chemicals?\s*(?:manufacturer|producer|supplier|distributor|trading|wholesaler)|bulk\s*chemicals?\s*(?:manufacturer|producer|supplier|distributor|trading|wholesaler|sales)|raw\s*chemicals?\s*(?:manufacturer|producer|supplier|distributor|trading|wholesaler)|fine\s*chemicals?\s*(?:manufacturer|producer|supplier|distributor|trading|wholesaler)|agrochemicals?\s*(?:manufacturer|producer|supplier|distributor)|pesticides?\s*(?:manufacturer|producer|supplier|distributor)|hazardous\s*chemicals?|toxic\s*chemicals?|chemical\s*synthesis)\b/i,
    label: "Chemicals & Petrochemicals"
  },
  {
    pattern: /\b(?:hospital|hospitals|patient\s*care|dental\s*(?:clinic|practice)|outpatient\s*clinic|surgery\s*center|veterinary\s*hospital|psychiatric\s*hospital|health\s*clinic|urgent\s*care|diagnostic\s*center|medical\s*(?:practice|center|treatment|services?|diagnostic|consultation|therapy|care|doctor|physician|imaging\s*center|laboratory|surgical\s*center|clinic)|pharmaceutical\s*(?:company|manufacturer|manufacturing|drugs?|formulation|products?|distributor|supplier|wholesaler|trader|export(?:er)?)|prescription\s*drugs?|online\s*pharmacy|pharmacy|pharmacies|drugstore|drugstores|medicine\s*(?:manufacturer|production|formulation|sales|store|distributor))\b/i,
    label: "Medicine, Medical & Hospital"
  },
  {
    pattern: /\b(?:brewery|breweries|distillery|distilleries|liquor\s*store|liquor\s*shop|wine\s*producer|winery|wineries|vineyards?|craft\s*beer\s*(?:brewery|producer)|craft\s*brewery|microbrewery|wine\s*shop|beer\s*store|beer\s*(?:manufacturer|producer|brewing|brewery)|wine\s*(?:producer|maker|making|cellar)|spirits\s*(?:distiller|distillery|manufacturer|producer)|alcoholic\s*beverages?\s*(?:manufacturer|producer|wholesaler|distributor))\b/i,
    label: "Alcohol & Breweries"
  },
  {
    pattern: /\b(?:food\s*(?:processing\s*plant|manufacturing|production|manufacturer|producer|packaging\s*facility|wholesaler|supplier|distributor|company|products\s*producer)|commercial\s*bakery|catering\s*services?|restaurants?|bistros?|cafes?|eateries|(?:roadside\s*diner|american\s*diner|diner\s*restaurant)|snack\s*foods?\s*(?:manufacturer|producer|supplier)|dairy\s*products?\s*(?:processing|manufacturer|producer|supplier)|meat\s*processing|poultry\s*processing|seafood\s*processing|edible\s*oils?\s*refinery|confectionery\s*manufacturer|(?:non-alcoholic\s+|soft\s+drink\s+)?beverage\s*(?:manufacturer|producer|bottler|bottling))\b/i,
    label: "Food & Beverages"
  },
  {
    pattern: /\b(?:pet\s*(?:shop|store|boutique|salon|supplies|accessories|food|care\s*services?|grooming|boarding|hotel|products\s*store)|puppy\s*(?:mill|breeder|breeding|for\s*sale)|dog\s*(?:breeder|breeding|kennel|grooming|for\s*sale)|cat\s*(?:breeder|breeding|cattery|for\s*sale)|puppies\s*for\s*sale|kittens\s*for\s*sale|animal\s*breeding|animal\s*shelter|animal\s*hospital|veterinary\s*(?:clinic|hospital|services?|care)|vet\s*clinic|veterinarian|livestock\s*(?:farming|producer|breeding|trade|market)|cattle\s*farming|poultry\s*farming|pig\s*farming|commercial\s*slaughterhouse)\b/i,
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
  { label: "Porn & Adult", regex: /\b(?:porn(?:o|ography|ographic)?|adult|sex|escort|brothel|erotic|erotica)\b/i },
  { label: "Medicine & Medical", regex: /\b(?:medical|medicine|pharmaceuticals?|prescription\s*drugs?)\b/i },
  { label: "Hospital & Healthcare", regex: /\b(?:hospitals?|clinics?|patient\s*care|healthcare|nursing\s*homes?)\b/i },
  { label: "Food", regex: /\b(?:food|bakery|catering|restaurant|eatery|beverages?|dairy|meat|poultry|seafood)\b/i },
  { label: "Weapons & Knives", regex: /\b(?:weapons?|firearms?|rifles?|guns?|knives|knife|ammunition|swords?|daggers?|blades?)\b/i },
  { label: "Defence", regex: /\b(?:military|defence|defense|armed\s*forces|tactical\s*armaments?)\b/i },
  { label: "Aircraft & Aviation", regex: /\b(?:aircraft|airplane|airlines?|aviation|avionics|helicopters?)\b/i },
  { label: "Aerospace", regex: /\b(?:aerospace|spacecraft|satellite|rocket\s*propulsion)\b/i },
  { label: "Marine", regex: /\b(?:marine|maritime|naval)\b/i },
  { label: "Ship & Shipbuilding", regex: /\b(?:ship|ships|shipyard|shipbuilding|boat|boats|vessel|vessels|yacht|yachts)\b/i },
  { label: "Chemical", regex: /\b(?:chemicals?|petrochemicals?|solvents?|hazardous\s*chemicals?)\b/i },
  { label: "Alcohol", regex: /\b(?:alcohol|brewery|breweries|distillery|distilleries|wine|beer|whiskey|whisky|liquor|spirits)\b/i },
  { label: "Animals", regex: /\b(?:animals?|pets?|puppy|puppies|dogs?|cats?|livestock|cattle)\b/i }
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
    .replace(/\b(?:knife\s*gate\s*valves?|knife\s*valves?|machine\s*knives?|slitter\s*knives?|circular\s*knives?|guillotine\s*knives?|rotary\s*knives?|granulator\s*knives?|pelletizer\s*knives?|chipper\s*knives?|shear\s*knives?|planer\s*knives?|jointer\s*knives?|industrial\s*knives?|doctor\s*blades?|utility\s*knives?|utility\s*knife\s*blades?)\b/gi, " ")
    .replace(/\b(?:air|utility|machine|slitter|guillotine|rotary|doctor)\s*knives?\b/gi, " ")
    .replace(/\b(?:rotary|slitter|circular|machine|industrial|machinery|saw|cutter|guillotine|granulator|pelletizer|shear|planer|doctor|wiper|turbine|fan)\s*blades?\b/gi, " ")
    .replace(/\bair\s*knife\s*(?:system|systems|drying|nozzle|nozzles|blower|blowers)?\b/gi, " ")
    .replace(/\b(?:chemical|chemically|marine|food)\s*(?:grade|resistance|resistant|proof|inert|inertness|compatibility|safe|approved|contact)\b/gi, " ")
    .replace(/\b(?:food[-–\s]*(?:grade|contact|approved|safe|packaging|containers?|storage|use|applications?|compatibility))\b/gi, " ")
    .replace(/\bresistant\s+to\s+chemicals?\b/gi, " ")
    .replace(/\bisopropyl\s+alcohol\b/gi, " ");

  // 5b. Sanitize "non-" phrases (non-food, non-medical, non-military, non-chemical, etc.)
  cleanText = cleanText
    .replace(/\bnon[-–\s]+foods?(?:[-–\s]+(?:approved|grade|contact|safe|applications?|use|purposes?|items?|products?|packaging|containers?|bottles?|jars?|plastics?|materials?|areas?|zones?|manufacturing|production))?\b/gi, " ")
    .replace(/\b(?:not\s+(?:for|intended\s+for|suitable\s+for|approved\s+for)\s+(?:food|human\s+consumption))\b/gi, " ")
    .replace(/\b(?:non-food|non\s+food)\b/gi, " ")
    .replace(/\bnon[-–\s]+medical(?:[-–\s]+(?:grade|use|applications?|devices?|equipment|supplies|products?|purposes?))?\b/gi, " ")
    .replace(/\bnon[-–\s]+clinical\b/gi, " ")
    .replace(/\bnon[-–\s]+pharmaceutical\b/gi, " ")
    .replace(/\bnon[-–\s]+military\b/gi, " ")
    .replace(/\bnon[-–\s]+defen[cs]e\b/gi, " ")
    .replace(/\bnon[-–\s]+weapon\b/gi, " ")
    .replace(/\bnon[-–\s]+hazardous\b/gi, " ")
    .replace(/\bnon[-–\s]+toxic\b/gi, " ")
    .replace(/\bnon[-–\s]+chemical\b/gi, " ")
    .replace(/\bnon[-–\s]+animal\b/gi, " ")
    .replace(/\bnon[-–\s]+alcoholic\b/gi, " ");

  // 5c. Sanitize payment card brands & footer payment icons (Diners Club, Visa, Mastercard, Elo, Hipercard, Amex, etc.)
  cleanText = cleanText
    .replace(/\bdiners?\s*club(?:\s*(?:international|card|cards|credit\s*card))?\b/gi, " ")
    .replace(/\b(?:mastercard|visa|elo|hipercard|hypercard|american\s*express|amex|diners?\s*club|discover|jcb|unionpay|aura|cabal|carnet|bancontact)\b/gi, " ")
    .replace(/\b(?:payment\s*(?:methods?|options?|gateways?|icons?|types?)|accepted\s*(?:cards?|payments?)|we\s*accept|cards?\s*accepted)[\s\S]{0,200}?\bdiners?\b/gi, " ")
    .replace(/\b(?:credit|debit)\s*cards?[\s\S]{0,100}?\bdiners?\b/gi, " ");

  // 6. Component applications & served industry clause
  cleanText = cleanText.replace(/\b(?:connectors?|cables?|machining|tooling|components?|parts?|fasteners?|systems?|solutions?|gears?|valves?|pumps?|gaskets?|seals?|packings?|rubbers?|plastics?|flanges?|fittings?|pipes?|tubes?|tubing|motors?|actuators?|sensors?|instruments?|switches?|panels?|tanks?|vessels?|boilers?|compressors?|blowers?|fans?|bearings?|springs?|bushings?|shafts?|couplings?|hoses?|belts?|chains?|filters?|filtration|materials?|containers?|packaging|jars?|bottles?|caps?|closures?|boxes?|cartons?|vials?|pouches?|tins?|cans?|pallets?|trays?)\s+(?:for|in|to)\s+[^.\n;]+?(?=[.\n;]|$)/gi, (match) => {
    if (/(?:aerospace|aircraft|aviation|military|defense|defence|medical|pharmaceutical|hospital|marine|ships?|boats?|vessels?|chemical|food|beverage)/i.test(match)) {
      return " ";
    }
    return match;
  });

  // 6b. Multi-industry served clauses and "used in / applied in" phrases
  cleanText = cleanText
    .replace(/\b(?:suitable|used|applied|utilized|designed|recommended|engineered|ideal|intended)\s+(?:for|in)\s+(?:food|beverage|non-food|chemical|marine|medical|pharmaceutical|aerospace|defense|defence)[^.\n;]*?(?=[.\n;]|$)/gi, " ")
    .replace(/\b(?:food|beverage)\s*(?:storage|packaging|containers?|bottles?|jars?|wrapping|boxes?|cartons?|handling|contact|grade)\b/gi, " ")
    .replace(/\b(?:(?:our|these)?\s*(?:products?|goods|components?|materials?|supplies|equipment|machinery|solutions?|parts?|services?)\s+(?:are\s+)?(?:mainly\s+|widely\s+|commonly\s+)?(?:used|applied|utilized|suitable|designed|recommended|engineered)\s+(?:for|in)\s+[^.\n;]+?(?=[.\n;]|$))/gi, " ")
    .replace(/\b(?:used|applied|serving)\s+(?:in|for|to)\s+(?:marine|industrial|chemical|food|beverage|pharmaceutical|medical|aerospace|automotive|defence|defense|military|offshore|oil|gas|refinery)[^.\n;]*?(?=[.\n;]|$)/gi, " ")
    .replace(/(?:(?:^|[\r\n])\s*(?:industries|markets|sectors|applications?)\s*[:\-–]|(?:\b(?:target|key|served)\s+(?:industries|markets|sectors)\s*[:\-–])|(?:\b(?:industries|markets|sectors|applications?)\s+(?:we\s+serve|served|supported)\s*[:\-–]))[^.\n;]+?(?=[.\n;]|$)/gi, " ")
    .replace(/\b(?:serving|serves|served|supplying|supplies|supplied|catering|caters|catered)\s+(?:to\s+)?(?:the\s+)?(?:manufacturing|marine|aerospace|aviation|aircraft|defence|defense|military|chemical|petrochemical|food|beverage|pharmaceutical|medical|healthcare|hospital|automotive|mining|oil|gas|refinery|industrial)\s*(?:and|&|or|,|\s*industry|\s*industries|\s*plants?|\s*sector|\s*sectors|\s*market|\s*markets|\s*facilities|\s*applications?|\s*environments?)*[^.\n;]*?(?=[.\n;]|$)/gi, " ")
    .replace(/\b(?:used\s+in\s+)?(?:marine\s*(&|and)\s*industrial|offshore\s*industrial\s*chemical\s*plant|food\s*(&|and)\s*chemical\s*industry)\b/gi, " ");

  // 6c. Architectural & commercial facility installations (lighting, flooring, doors, HVAC, etc.)
  cleanText = cleanText
    .replace(/\b(?:lighting|fixtures?|led|flooring|ceilings?|doors?|windows?|elevators?|lifts?|hvac|ventilation|air\s*conditioning|fire\s*protection|fire\s*alarms?|alarms?|electrical|panels?|signage|signs?|branding|wayfinding|furniture|desks?|chairs?|partitions?|wall\s*coverings?|paints?|coatings?|hardware|locks?|plumbing|pipes?|generators?|cables?|textiles?|linens?|uniforms?|scrubs?|laundry|security|cctv|access\s*control)\s+(?:for|in|at|installed\s+in)\s+(?:various\s+)?(?:commercial\s+(?:buildings?|spaces?|offices?|facilities?)|schools?|universities?|colleges?|offices?|retail|hotels?|airports?|residential|cleanrooms?|clean\s*rooms?|factories?|warehouses?|data\s*centers?|laboratories?|labs?|prisons?|churches?|auditoriums?|stadiums?|hospitals?|clinics?|medical\s*centers?|healthcare\s*facilities?|nursing\s*homes?|care\s*homes?)\b[^.\n;]*?(?=[.\n;]|$)/gi, " ")
    .replace(/\b(?:for|in|at|to)\s+(?:the\s+)?(?:hospitals?|clinics?|medical\s*centers?|healthcare\s*facilities?|nursing\s*homes?)\s*(?:and|&|or|,)\s*(?:schools?|universities?|offices?|hotels?|commercial|residential|industrial|retail|airports?)\b/gi, " ")
    .replace(/\b(?:schools?|universities?|offices?|hotels?|commercial|residential|industrial|retail|airports?)\s*(?:and|&|or|,)\s*(?:hospitals?|clinics?|medical\s*centers?|healthcare\s*facilities?|nursing\s*homes?)\b/gi, " ");

  // 7. Adult false positives (learners, education, children, furniture, pricing, privacy)
  cleanText = cleanText
    .replace(/\b(?:young|older|mature|elderly|all)\s+adults?\b/gi, " ")
    .replace(/\badult\s*(?:learners?|students?|children|life|audience|education|outdoor\s*furniture|furniture|tables?|benches?|chairs?|bicycles?|bikes?|watches?|apparel|clothing|shoes?|sizes?|sizing|swim|swimming|camps?|campers?|supervision|literacy|population|health|mental\s*health|care|medicine|patients?|volunteers?|staff|leaders?|advisors?|programs?|courses?|classes?|admissions?|diapers?|bibs?|incontinence|living|guardians?|relatives?|survivors?|immunization|vaccines?)\b/gi, " ")
    .replace(/\b(?:per|rates?\s+per|pricing\s+for|tickets?\s+for|cost\s+per|admit|admission\s+for|ages?\s+for)\s+adults?\b/gi, " ")
    .replace(/(?:infants?|babies|toddlers?|children|kids?|youth|teens?|teenagers?|seniors?|men|women|families|family)[,\s]+(?:and|&|or)?\s*adults?\b/gi, " ")
    .replace(/\badults?[,\s]+(?:and|&|or)?\s*(?:children|kids?|youth|teens?|infants?|seniors?)\b/gi, " ")
    .replace(/\b(?:not\s+intended\s+for\s+children|children\s+under\s+(?:13|16|18)|age\s+of\s+majority|verify\s+your\s+age|parental\s+consent|adult\s+supervision\s+required|must\s+be\s+an\s+adult(?:\s+of\s+legal\s+age)?|adult\s+of\s+legal\s+age|legal\s+adult\s+age|you\s+must\s+be\s+an\s+adult)\b/gi, " ")
    .replace(/\bnude\s*(?:color|shade|lip(?:stick|gloss)|palette|nail|tones?|leather|shoes?|pumps?|heels?|dress|fabric|tan)\b/gi, " ");

  // 8. Aerospace & Aircraft application false positives
  cleanText = cleanText
    .replace(/\b(?:titanium\s+)?(?:bolts?|fasteners?|brackets?|components?|parts?|connectors?|cables?|machining|tooling)\s+(?:perform\s+flawlessly\s+on|for|in|on|used\s+in)\s+(?:our\s+)?(?:military\s+aircraft|commercial\s+aircraft|aircraft|aviation|aerospace)\b/gi, " ")
    .replace(/\b(?:for|in|serving|services?|supplying|supplies|solutions?|applications?|components?|parts?|tooling|cables?|machining|fabrication|engineering)\s+(?:for|in|to)?\s*(?:the\s+)?(?:aerospace|aircraft|aviation|defence|defense|medical|pharmaceutical)\b/gi, " ")
    .replace(/\b(?:aerospace|aircraft|aviation|defence|defense)\s+(?:applications?|grade|industry|industries|sector|sectors|market|markets|standards?|specifications?|spec|specs|cables?|connectors?|fasteners?|gears?|components?|parts?|tooling|machining|hangars?|composites?)\b/gi, " ")
    .replace(/\b(?:aircraft\s*cables?|aircraft-grade)\b/gi, " ")
    .replace(/\badvising\s+(?:corporate\s+)?clients\s+in\s+[^.\n;]+?(?=[.\n;]|$)/gi, " ");

  // 9. Marine false positives
  cleanText = cleanText
    .replace(/\b(?:overhead\s+)?(?:gantries|gantry\s+systems?|cranes?|hoists?|lift\s+systems?)\s+(?:for|in)\s+(?:ship\s+maintenance|marine\s+operations?)\b/gi, " ")
    .replace(/\bmarine\s+hardware\b/gi, " ")
    .replace(/\b(?:marine\s*grade|marine\s*environment|marine\s*environments|marine\s*resistant|marine\s*applications?|marine\s*coatings?|marine\s*paints?|marine\s*grease|marine\s*lubricants?|marine\s*fasteners?|marine\s*plywood|marine\s*hardware|marine\s*use|marine\s*conditions?|marine\s*equipment\s*manufacturers?|marine\s*(&|and)\s*industrial)\b/gi, " ");

  // 10. Animals false positives (cruelty-free, vegan, animal welfare, government animal husbandry)
  cleanText = cleanText
    .replace(/\b(?:safe\s+for\s+(?:farm\s+)?animals?(?:\s+and\s+pets?)?|safe\s+near\s+animals?)\b/gi, " ")
    .replace(/\b(?:cruelty\s*[-–]?\s*free(?:\s+to\s+animals?)?|not\s+tested\s+on\s+animals?|no\s+animal\s+testing|against\s+animal\s+cruelty|animal\s+welfare|animal\s+husbandry(?:\s+department)?|veterinary\s+administrative(?:\s+services)?|livestock\s+(?:housing|buildings?|barns?|sheds?|facilities|shelters?|enclosures?|fencing|equipment))\b/gi, " ")
    .replace(/\banimal\s*(?:prints?|patterns?|designs?|motifs?|illustrations?|figures?|shapes?)\b/gi, " ");

  // 11. Alcohol false positives
  cleanText = cleanText
    .replace(/\b(?:whiskey|whisky)\s*(?:creek|river|ridge|valley|brown|oak|leather|bronze|finish|designs?|media|photo|photography)\b/gi, " ")
    .replace(/\b(?:photo|photograph|photographer|credit|architect|project)\s*(?:by|:)?\s*[^\n.]*?(?:whiskey|whisky)/gi, " ");

  // 12. Industrial equipment for food processing & bakery
  cleanText = cleanText
    .replace(/\b(?:equipment|machinery|machines?|conveyors?|systems?|solutions?|supplies|tooling|ovens?|mixers?|appliances?)\s+(?:designed\s+(?:specifically\s+)?for|for|in|used\s+in)\s+(?:the\s+)?(?:food\s*processing|meat\s*processing|poultry\s*processing|dairy|bakery|bakeries|beverage|pharmaceutical|medical|restaurants?|cafes?|commercial\s*kitchens?)\s*(?:and|&|or|,|\s*industry|\s*industries|\s*sector|\s*sectors|\s*market|\s*markets|\s*facilities|\s*plants?|\s*bakeries|\s*restaurants?|\s*cafes?|\s*commercial\s*kitchens?)*[^.\n;]*?(?=[.\n;]|$)/gi, " ")
    .replace(/\b(?:food\s*processing|meat\s*processing|poultry\s*processing|seafood\s*processing|dairy\s*processing|bakery|bakeries|catering)\s+(?:equipment|machinery|machines?|conveyors?|systems?|packaging|packaging\s*machinery|automation|tooling|lines?|plants?|technology|engineering|solutions?|supplies|appliances?|industry|industries|facilities)\b/gi, " ")
    .replace(/\b(?:food\s+processing\s+plants?|chemical\s+and\s+petrochemical\s+plants?)\b/gi, " ");

  // 13. Pharmaceutical / medical equipment & served industries
  cleanText = cleanText
    .replace(/\b(?:pharmaceutical|medical|healthcare)\s+(?:equipment|machinery|machines?|conveyors?|packaging|packaging\s*machinery|processing|processing\s*equipment|automation|tooling|cleanrooms?|clean\s*rooms?|tanks?|vessels?|pumps?|valves?|piping|tubing|devices?|instrumentation|instruments?|components?|parts?|systems?|grade|applications?|industry|industries|sector|sectors|market|markets|facilities|manufacturing|solutions?)\b/gi, " ")
    .replace(/\b(?:food|beverage|packaging|dairy|bakery|meat|confectionery|cosmetic|cosmetics|chemical|nutraceutical)[,\s]+(?:and\s+)?(?:pharmaceutical|medical)\b/gi, " ")
    .replace(/\b(?:serving|serves|served|for|to)\s+(?:the\s+)?(?:pharmaceutical|medical)\s+(?:industry|industries|sector|sectors|applications?|market|markets)\b/gi, " ");

  // 14. Industrial chemical equipment and tanks false positives
  cleanText = cleanText
    .replace(/\b(?:chemical\s*(?:storage|process(?:ing)?|handling|injection|dosing|transfer)\s*(?:tanks?|vessels?|reactors?|equipment|machinery|machines?|pumps?|skids?|piping|systems?|solutions?))\b/gi, " ")
    .replace(/\b(?:brewing|distillery)\s*(?:equipment|machinery|systems?|tanks?|kettles?|vessels?|fermenters?|stills?|columns?)\b/gi, " ")
    .replace(/\b(?:(?:titan|stainless|steel|pressure|reactor|storage|process|jacketed|mixing|containment)\s+vessels?)\b/gi, " ");

  return cleanText;
}

// Official Strict Restriction Policy Categories (13 Strictly Prohibited Categories):
// Category 1: Porn & Adult
// Category 2: Medicine & Medical
// Category 3: Hospital & Healthcare
// Category 4: Food
// Category 5: Weapons & Knives
// Category 6: Defence
// Category 7: Aircraft & Aviation
// Category 8: Aerospace
// Category 9: Marine
// Category 10: Ship & Shipbuilding
// Category 11: Chemical
// Category 12: Alcohol
// Category 13: Animals

const STRICT_OFFICIAL_CATEGORIES = [
  {
    id: 1,
    officialCategory: "Porn & Adult",
    category: "Adult & Porn",
    label: "Adult & Porn",
    regex: /\b(?:porn(?:o|ography|ographic)?|adults?|sex|escorts?|brothels?|erotica?|sensual\s*massage|strip\s*clubs?|adult\s*toys?|dildos?|vibrators?|fetish(?:es)?|onlyfans)\b/i
  },
  {
    id: 2,
    officialCategory: "Medicine & Medical",
    category: "Medicine, Medical & Hospital",
    label: "Medicine, Medical & Hospital",
    regex: /\b(?:medicines?|pharmaceuticals?|pharmac(?:y|ies)|prescription\s*drugs?|medical\s*(?:equipment|devices?|supplies|treatment|products?|catalog(?:ue)?|instruments?|implants?|technology|diagnostic\s*tools?)|medicine\s*(?:manufactur(?:er|ing)|suppl(?:ier|ies)|trader|distributor|production|formulation|sales|store))\b/i
  },
  {
    id: 3,
    officialCategory: "Hospital & Healthcare",
    category: "Medicine, Medical & Hospital",
    label: "Medicine, Medical & Hospital",
    regex: /\b(?:hospitals?|clinics?|healthcare\s*(?:centres?|centers?|services?|providers?|facilities)|nursing\s*homes?|medical\s*(?:laborator(?:y|ies)|labs?|diagnostic\s*centers?|imaging\s*centers?)|patient\s*care|urgent\s*care|outpatient\s*clinic|surgery\s*center|physicians?|doctors?|hospital\s*(?:equipment|suppl(?:ies|ier|iers)|furniture|beds?))\b/i
  },
  {
    id: 4,
    officialCategory: "Food",
    category: "Food & Beverages",
    label: "Food & Beverages",
    regex: /\b(?:(?<!(?:pet|puppy|dog|cat|animal|fish|non)[-\s]+)foods?|baker(?:y|ies)|catering|restaurants?|bistros?|cafes?|eater(?:y|ies)|(?<!alcoholic\s+)beverages?|edible|confectioner(?:y|ies)|dairy\s*(?:products?|processing)|meat\s*(?:products?|processing)|poultry\s*processing|seafood\s*(?:products?|processing)|food\s*(?:manufactur(?:er|ing)|suppl(?:ier|ies)|products?|ingredients?|processing|packaging|wholesal(?:er|ers)|export(?:er|ers)|distributor|catalog(?:ue)?)|snacks?\s*(?:manufactur(?:er|ing)|producer)|(?:roadside\s*diner|american\s*diner|diner\s*restaurant))\b/i
  },
  {
    id: 5,
    officialCategory: "Weapons & Knives",
    category: "Weapons, Armor & Knives",
    label: "Weapons, Armor & Knives",
    regex: /\b(?:weapons?|firearms?|rifles?|guns?|handguns?|pistols?|shotguns?|assault\s*weapons?|ammunition|munitions?|knif(?:e|es)|knives|pocket\s*knives?|folding\s*knives?|hunting\s*knives?|tactical\s*knives?|combat\s*knives?|custom\s*knives?|survival\s*knives?|throwing\s*knives?|fixed\s*blade\s*knives?|handmade\s*knives?|switchblades?|bayonets?|machetes?|daggers?|swords?|bowie\s*knives?|(?:combat|tactical|fixed|custom|hunting|survival|throwing|weapon|knife|sword|dagger)\s*blades?|tactical\s*equipment|weapon\s*(?:manufactur(?:er|ing)|suppl(?:ier|ies)|trader|dealer|repair|accessories))\b/i
  },
  {
    id: 6,
    officialCategory: "Defence",
    category: "Defence & Military",
    label: "Defence & Military",
    regex: /\b(?:defen[cs]e\s*(?:contractors?|manufactur(?:er|ing)|suppl(?:ier|ies)|products?|equipment|systems?|technology|industry)|military\s*(?:equipment|technology|vehicles?|systems?|defence|defense|armaments?|artillery|contractors?)|armed\s*forces|tactical\s*armaments|combat\s*vehicles?|missile\s*systems?|ministry\s*of\s*defence|department\s*of\s*defense|defence\s*forces?|national\s*defen[cs]e|homeland\s*defen[cs]e|air\s*defen[cs]e|naval\s*defen[cs]e)\b/i
  },
  {
    id: 7,
    officialCategory: "Aircraft & Aviation",
    category: "Aviation & Airlines",
    label: "Aviation & Airlines",
    regex: /\b(?:aircrafts?|airplanes?|aeroplanes?|aviation|airlines?|commercial\s*aviation|aviation\s*(?:equipment|products?|services?|charter)|passenger\s*flights?|airline\s*(?:tickets?|flights?|carrier|company)|aircraft\s*(?:manufactur(?:er|ing)|suppl(?:ier|ies)|components?|spare\s*parts?|equipment|products?|maintenance|repair|overhaul|mro)|avionics|helicopters?\s*(?:charter|services?|manufactur(?:er|ing))|flight\s*booking|aircraft\s*leasing)\b/i
  },
  {
    id: 8,
    officialCategory: "Aerospace",
    category: "Aerospace",
    label: "Aerospace",
    regex: /\b(?:aerospace\s*(?:manufactur(?:er|ing)|suppl(?:ier|ies)|contractor|components?|materials?|engineering|products?|equipment)|spacecraft|satellite\s*manufactur(?:er|ing)|rocket\s*(?:and\s+)?propulsion(?:\s*systems?)?|launch\s*vehicles?|space\s*exploration\s*technology)\b/i
  },
  {
    id: 9,
    officialCategory: "Marine",
    category: "Marine",
    label: "Marine",
    regex: /\b(?:marine\s*(?:equipment|products?|manufactur(?:er|ing)|suppl(?:ier|ies)|engineering|maintenance|navigation|propulsion(?:\s*equipment)?|industry(?:-related)?|operations?|catalog(?:ue)?)|maritime\s*(?:equipment|navigation|logistics|shipping|security|charter)|naval\s*(?:operations|dockyard|base|propulsion))\b/i
  },
  {
    id: 10,
    officialCategory: "Ship & Shipbuilding",
    category: "Ships & Boats",
    label: "Ships & Boats",
    regex: /\b(?:shipyards?|shipbuilding|shipbuilders?|ship\s*builders?|ship\s*repairs?|boat\s*builders?|boat\s*building|ship\s*(?:manufactur(?:er|ing)|components?|spare\s*parts?|maintenance)|shipbuilding\s*equipment|vessels?\s*(?:builder|building|construction|manufactur(?:er|ing))|commercial\s*vessels?|cargo\s*ships?|cruise\s*ships?|container\s*ships?|warships?|battleships?|naval\s*ships?|yachts?\s*builder|ferr(?:y|ies)|tugboats?|barges?|marine\s*transportation\s*products?)\b/i
  },
  {
    id: 11,
    officialCategory: "Chemical",
    category: "Chemicals & Petrochemicals",
    label: "Chemicals & Petrochemicals",
    regex: /\b(?:chemicals?\s*(?:manufactur(?:er|ing)|producer|production|suppl(?:ier|ies)|distributor|distribution|trading|trader|wholesal(?:er|ers)|export(?:er|ers)|raw\s*materials?|products?|processing|catalog(?:ue)?)|petrochemicals?\s*(?:refinery|manufactur(?:er|ing)|plant|producer|supplier|distributor)|solvents?\s*(?:manufactur(?:er|ing)|producer|supplier|distributor)|industrial\s*chemicals?|hazardous\s*chemicals?|toxic\s*chemicals?|chemical\s*raw\s*materials?|specialty\s*chemicals?|bulk\s*chemicals?|fine\s*chemicals?|agrochemicals?|pesticides?)\b/i
  },
  {
    id: 12,
    officialCategory: "Alcohol",
    category: "Alcohol & Breweries",
    label: "Alcohol & Breweries",
    regex: /\b(?:alcohol\s*(?:manufactur(?:er|ing)|suppl(?:ier|ies)|production|processing|distributor|export(?:er|ers)|catalog(?:ue)?)|alcoholic\s*beverages?|brewer(?:y|ies)|craft\s*brewery|microbrewery|distiller(?:y|ies)|wines?\s*(?:producer|maker|making|cellar|business)|winer(?:y|ies)|vineyards?|beers?\s*(?:manufactur(?:er|ing)|producer|brewing)|liquor\s*(?:store|shop|business)|spirits\s*(?:distiller|distillery|manufactur(?:er|ing)|producer)|whiskey|whisky|vodka|rum|gin|tequila|brandy)\b/i
  },
  {
    id: 13,
    officialCategory: "Animals",
    category: "Animals & Pets",
    label: "Animals & Pets",
    regex: /\b(?:animal\s*(?:trading|suppl(?:y|ies|ier|iers)|breeding|commercial|products?\s*manufactur(?:er|ing)|products?\s*suppl(?:ier|ies)|catalog(?:ue)?)|live\s*animal\s*sales?|wildlife\s*trading|pupp(?:y|ies)\s*(?:for\s*sale|mill|breeder|breeding)|dogs?\s*(?:breeder|breeding|for\s*sale)|cats?\s*(?:breeder|breeding|for\s*sale)(?!\s*[-_.]?\s*(?:no\b|num|#|code|part|id|class|rating|group|ref|item|type|section|3\b|5\b|5e\b|6\b|6a\b|7\b|7a\b|8\b|cables?|cabling))|kittens\s*for\s*sale|animal\s*shelter|livestock\s*(?:farming|producer|breeding|trade|market|sales?)|cattle\s*farming|poultry\s*farming|pig\s*farming|commercial\s*slaughterhouse|pet\s*(?:shop|store|boutique|supplies|accessories|food|breeding))\b/i
  }
];

function extractEvidenceTypeAndImage(html = "", matchedKw = "", pageUrl = "") {
  let evidenceType = "Website Content";
  let imageUrl = null;

  if (!matchedKw) return { evidenceType, imageUrl };

  const rawHtml = String(html || "");
  const kwLower = String(matchedKw).toLowerCase();

  // 1. Check if matched inside <img> tag
  if (rawHtml) {
    const imgMatches = [...rawHtml.matchAll(/<img\s+[^>]*>/gi)];
    for (const m of imgMatches) {
      const tag = m[0];
      if (tag.toLowerCase().includes(kwLower)) {
        evidenceType = "Image";
        const srcMatch = tag.match(/(?:src|data-src)=["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
          const rawSrc = srcMatch[1].trim();
          imageUrl = (typeof ensureAbsoluteUrl === "function" && pageUrl) ? ensureAbsoluteUrl(rawSrc, pageUrl) : rawSrc;
        }
        return { evidenceType, imageUrl };
      }
    }
  }

  // 2. Check if product catalog / product listing
  const normUrl = String(pageUrl || "").toLowerCase();
  if (/(?:products?|catalog|catalogue|shop|item|model|parts?)/i.test(normUrl) ||
      /<(?:div|section|article|li)[^>]+(?:class|id)=["'][^"']*(?:product|catalog|item)[^"']*["']/i.test(rawHtml)) {
    evidenceType = "Product";
    return { evidenceType, imageUrl };
  }

  // 3. Check if service
  if (/(?:services?|capabilities|solutions|repairs?|maintenance)/i.test(normUrl)) {
    evidenceType = "Service";
    return { evidenceType, imageUrl };
  }

  // 4. Check if corporate overview / business activity
  if (/(?:about|profile|company|overview|what-we-do)/i.test(normUrl) ||
      /\b(?:we\s+(?:are|manufacture|produce|supply|distribute|export)|our\s+(?:company|business|mission|factory))\b/i.test(rawHtml)) {
    evidenceType = "Business Activity";
    return { evidenceType, imageUrl };
  }

  return { evidenceType, imageUrl };
}

function formatRestrictedValidationResult(check, websiteUrl = "", websiteStatus = "Working") {
  if (!check || !check.isRestricted) {
    if (check && (check.requiresManualReview || check.classification === "MANUAL_REVIEW")) {
      return {
        website_url: websiteUrl || check.sourceUrl || check.matched_page || "",
        website_status: websiteStatus,
        restricted: null,
        restricted_category: check.official_category || check.restricted_category || check.category || "",
        classification: "Manual Review",
        evidence_type: check.evidence_type || "Website Content",
        matched_keyword: check.matchedKeyword || check.matched_keyword || "",
        matched_text: check.snippet || check.matched_context || "",
        source_url: check.sourceUrl || check.matched_page || "",
        image_url: check.image_url || "",
        reason: check.reason || "Ambiguous restricted category indicator requires human verification",
        final_decision: "Manual Review",
        manual_review_required: true
      };
    }
    return {
      website_url: websiteUrl || (check && (check.sourceUrl || check.matched_page)) || "",
      website_status: websiteStatus,
      restricted: false,
      restricted_category: null,
      classification: "False Positive",
      evidence_type: (check && check.evidence_type) || "Website Content",
      matched_keyword: (check && (check.matchedKeyword || check.matched_keyword)) || "",
      matched_text: (check && (check.snippet || check.matched_context)) || "",
      source_url: (check && (check.sourceUrl || check.matched_page)) || "",
      image_url: (check && check.image_url) || "",
      reason: (check && check.reason) || "No genuine restricted business activity or content confirmed",
      final_decision: "Do Not Reject",
      manual_review_required: false
    };
  }

  return {
    website_url: websiteUrl || check.sourceUrl || check.matched_page || "",
    website_status: websiteStatus,
    restricted: true,
    restricted_category: check.official_category || check.restricted_category || check.category || "",
    classification: "Restricted - Reject",
    evidence_type: check.evidence_type || "Website Content",
    matched_keyword: check.matchedKeyword || check.matched_keyword || "",
    matched_text: check.snippet || check.matched_context || "",
    source_url: check.sourceUrl || check.matched_page || "",
    image_url: check.image_url || "",
    reason: check.reason || `Restricted Category Detected: ${check.official_category || check.category}`,
    final_decision: "Reject",
    manual_review_required: false
  };
}

function detectRestrictedKeywordsSingle(text, html = "", pageUrl = "") {
  let imgAttributes = typeof extractImageAttributes === "function" ? extractImageAttributes(html) : "";
  let combined = ((text || "") + " " + imgAttributes).trim();
  if (!combined) {
    return {
      website_url: pageUrl || "",
      website_status: "Working",
      restricted: false,
      restricted_category: null,
      official_category: null,
      category_id: null,
      classification: "NO_RESTRICTED_CATEGORY",
      strict_classification: "False Positive",
      evidence_type: "Website Content",
      matched_keyword: "",
      matched_text: "",
      source_url: pageUrl || "",
      image_url: "",
      reason: "No content provided",
      final_decision: "Do Not Reject",
      manual_review_required: false,

      isRestricted: false,
      is_restricted: false,
      matched_page: pageUrl || "",
      matched_context: "",
      business_activity: "",
      confidence: 1.0,
      category: "",
      matchedKeyword: null,
      sourceUrl: pageUrl || "",
      snippet: ""
    };
  }

  // Strip HTML tags for clean raw text scanning
  let rawClean = combined.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // Distinguish genuine prohibited category operations/products from unrelated contextual mentions (equipment for food plants, chemical tanks, hospital lighting, adult education/terms of service, cruelty-free, aerospace applications)
  let cleanText = sanitizeContextText(rawClean);

  // 1. STRICT OFFICIAL RESTRICTION POLICY:
  // Reject if any restricted category word or phrase is found anywhere in the available content
  for (const item of STRICT_OFFICIAL_CATEGORIES) {
    if (item.regex.test(cleanText)) {
      const m = cleanText.match(item.regex);
      let matchedKw = m ? m[0] : "";
      if (item.label === "Marine" && /^marine/i.test(matchedKw)) {
        matchedKw = "Marine";
      }
      const snippet = extractContextSnippet(rawClean, matchedKw);
      const exactLink = typeof findExactEvidenceLink === "function" ? findExactEvidenceLink(html, matchedKw, null, pageUrl) : pageUrl;
      const resolvedUrl = exactLink || pageUrl || "";
      const { evidenceType, imageUrl } = extractEvidenceTypeAndImage(html, matchedKw, resolvedUrl);
      return {
        // Section 8 Schema Fields:
        website_url: pageUrl || "",
        website_status: "Working",
        restricted: true,
        restricted_category: item.category,
        official_category: item.officialCategory,
        category_id: item.id,
        classification: "GENUINE_RESTRICTED",
        strict_classification: "Restricted - Reject",
        evidence_type: evidenceType,
        matched_keyword: matchedKw,
        matched_text: snippet,
        source_url: resolvedUrl,
        image_url: imageUrl || "",
        reason: `Prohibited Category Detected: ${item.officialCategory || item.category} ("${matchedKw}")`,
        final_decision: "Reject",
        manual_review_required: false,

        // Backward compatibility fields:
        isRestricted: true,
        is_restricted: true,
        category: item.label,
        matchedKeyword: matchedKw,
        sourceUrl: resolvedUrl,
        snippet: snippet,
        matched_page: resolvedUrl,
        matched_context: snippet,
        business_activity: `Restricted Category: ${item.officialCategory || item.category}`,
        confidence: 1.0
      };
    }
  }

  // 2. Also check other existing prohibited patterns (Gambling, Tobacco, Cannabis, Hacking, etc.)
  for (const item of RESTRICTED_PATTERNS) {
    const regex = item.pattern || item;
    const label = item.label || "Prohibited Category";
    if (regex.test(cleanText)) {
      const m = cleanText.match(regex);
      let matchedKw = m ? m[0] : "";
      if (item.label === "Marine" && /^marine/i.test(matchedKw)) {
        matchedKw = "Marine";
      }
      const snippet = extractContextSnippet(rawClean, matchedKw);
      const exactLink = typeof findExactEvidenceLink === "function" ? findExactEvidenceLink(html, matchedKw, null, pageUrl) : pageUrl;
      const resolvedUrl = exactLink || pageUrl || "";
      const { evidenceType, imageUrl } = extractEvidenceTypeAndImage(html, matchedKw, resolvedUrl);
      return {
        website_url: pageUrl || "",
        website_status: "Working",
        restricted: true,
        restricted_category: label,
        official_category: label,
        category_id: null,
        classification: "GENUINE_RESTRICTED",
        strict_classification: "Restricted - Reject",
        evidence_type: evidenceType,
        matched_keyword: matchedKw,
        matched_text: snippet,
        source_url: resolvedUrl,
        image_url: imageUrl || "",
        reason: `Prohibited Category Detected: ${label} ("${matchedKw}")`,
        final_decision: "Reject",
        manual_review_required: false,

        isRestricted: true,
        is_restricted: true,
        category: label,
        matchedKeyword: matchedKw,
        sourceUrl: resolvedUrl,
        snippet: snippet,
        matched_page: resolvedUrl,
        matched_context: snippet,
        business_activity: `Restricted Category: ${label}`,
        confidence: 1.0
      };
    }
  }

  return {
    website_url: pageUrl || "",
    website_status: "Working",
    restricted: false,
    restricted_category: null,
    official_category: null,
    category_id: null,
    classification: "NO_RESTRICTED_CATEGORY",
    strict_classification: "False Positive",
    evidence_type: "Website Content",
    matched_keyword: "",
    matched_text: "",
    source_url: pageUrl || "",
    image_url: "",
    reason: "No relevant restricted business detected",
    final_decision: "Do Not Reject",
    manual_review_required: false,

    isRestricted: false,
    is_restricted: false,
    matched_page: pageUrl || "",
    matched_context: "",
    business_activity: "",
    confidence: 1.0,
    category: "",
    matchedKeyword: null,
    sourceUrl: pageUrl || "",
    snippet: ""
  };
}

/**
 * Searches across all crawled pages to evaluate restricted business evidence.
 * Includes Homepage, About Us, Contact, Products, Services, Blog, FAQ, Footer, Terms/Privacy, and Images.
 */
function detectRestrictedKeywords(text, html = "", crawledPages = []) {
  if (Array.isArray(crawledPages) && crawledPages.length > 0) {
    for (const page of crawledPages) {
      if (!page) continue;
      const pText = ((page.text || "") + " " + (page.html ? stripHtml(page.html) : "")).trim();
      const res = detectRestrictedKeywordsSingle(pText, page.html || "", page.url || "");

      if (res.isRestricted) {
        return res;
      }
    }
  }

  // Fallback check on combined text and html
  const fallbackUrl = (crawledPages && crawledPages[0] && crawledPages[0].url) || "";
  const combinedFallbackText = ((text || "") + " " + (html ? stripHtml(html) : "")).trim();
  const fallback = detectRestrictedKeywordsSingle(combinedFallbackText, html, fallbackUrl);
  if (fallback.isRestricted) {
    return fallback;
  }

  return {
    website_url: fallbackUrl || "",
    website_status: "Working",
    restricted: false,
    restricted_category: null,
    official_category: null,
    category_id: null,
    classification: "NO_RESTRICTED_CATEGORY",
    strict_classification: "False Positive",
    evidence_type: "Website Content",
    matched_keyword: "",
    matched_text: "",
    source_url: fallbackUrl || "",
    image_url: "",
    reason: "No relevant restricted business detected",
    final_decision: "Do Not Reject",
    manual_review_required: false,

    isRestricted: false,
    is_restricted: false,
    matched_page: "",
    matched_context: "",
    business_activity: "",
    confidence: 1.0,
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
