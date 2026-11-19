// Multi-provider AI extraction (Gemini & Groq), key validation, and heuristic fallback extraction.
function buildExtractionPrompt(crawlData, includeJsonSchemaHint = false) {
  const compactSlice = (text, maxLen) => String(text || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
  const formattedAddressEvidence = (crawlData.addressCandidates && crawlData.addressCandidates.length > 0)
    ? crawlData.addressCandidates.slice(0, 10).map((c, idx) => {
      const typeLabel = c.isHeadquarters ? "HEADQUARTERS / HEAD OFFICE" : (c.locationType ? c.locationType.toUpperCase() : "LOCATION");
      const langLabel = c.isEnglish ? "English" : "Local Language";
      const romanized = !c.isEnglish && /[\u4e00-\u9fa5]/.test(c.raw) ? ` -> Romanized English: ${romanizeChineseAddress(c.raw)}` : "";
      return `${idx + 1}. [${typeLabel} (${langLabel}, Source: ${c.source})]: ${c.raw}${romanized}`;
    }).join("\n")
    : ((crawlData.detectedAddresses || []).slice(0, 10).join("\n") || "(No physical address candidates extracted from static HTML)");

  const contactText = compactSlice(crawlData.dedicatedContactText || crawlData.contactPageText, 2800);
  const careerRaw = compactSlice(crawlData.careerPageText, 1800);
  const careerText = (careerRaw && careerRaw !== contactText) ? careerRaw : "";
  const profileRaw = compactSlice(crawlData.profilePageText, 1800);
  const profileText = (profileRaw && profileRaw !== contactText && profileRaw !== careerText) ? profileRaw : "";

  // Dynamically collect crawled product/catalog subpage text so AI can verify product counts & descriptions
  const productPagesText = Array.isArray(crawlData.crawledPages)
    ? compactSlice(
      crawlData.crawledPages
        .filter(p => p && p.isProductPage && p.text)
        .map(p => p.text)
        .join("\n"),
      2400
    )
    : "";

  const renderedText = compactSlice(crawlData.renderedText, 1800);
  const footerText = compactSlice(crawlData.footerText, 800);
  const bodyRaw = compactSlice(crawlData.bodyText, 2000);
  const bodyText = (bodyRaw && bodyRaw !== renderedText && bodyRaw !== careerText) ? bodyRaw : "";

  // Dynamically prioritize legal company candidates matching the target domain before other candidates
  const targetStem = cleanDomainStem(crawlData.finalUrl || crawlData.originalUrl);
  const sortedLegalCandidates = Array.from(new Set(crawlData.legalCompanyCandidates || [])).sort((a, b) => {
    const aMatch = targetStem && cleanDomainStem(a).includes(targetStem) ? 1 : 0;
    const bMatch = targetStem && cleanDomainStem(b).includes(targetStem) ? 1 : 0;
    return bMatch - aMatch;
  });

  const jsonSchemaSection = includeJsonSchemaHint ? `

OUTPUT FORMAT (STRICT JSON ONLY):
Return ONLY a single valid JSON object (no markdown fences or commentary) containing ALL keys below:
{
  "websiteStatus": "Working" | "Not Working" | "Domain Expired" | "Non English" | "Under Construction" | "Flash" | "Redirect Site" | "Manual Review",
  "notWorkingReason": "string (mandatory explanation if not Working, else empty string \"\")",
  "businessType": "Manufacturer" | "Industrial Services" | "Exporter" | "Trader" | "Distributer" | "Distributor" | "Supplier" | "Wholesaler" | "Service Provider" | "Online Shopping" | "Restricted Site" | "Other" | "",
  "companyProfile": "Available" | "Not Available" | "",
  "companyName": "string (expand ONLY abbreviations present on site; standalone 'Co.' -> 'Company', NEVER add 'Limited' unless 'Ltd.'/'Limited' is on site)",
  "countryName": "string",
  "companyAddress": "string",
  "state": "Available" | "Not Available" | "",
  "city": "Available" | "Not Available" | "",
  "emailId": "string",
  "secondaryEmailId": "string",
  "phoneNumber": "string (domestic digits ONLY with country calling code and leading zero ALWAYS stripped, e.g. 43329299, 2168888888, 9840123456, 2125551234)",
  "numberOfProducts": "0" | "1" | "2" | "3" | "",
  "productImages": "0" | "1" | "2" | "3" | "",
  "numberOfProductDescriptions": "0" | "1" | "2" | "3" | ""
}` : "";

  return `You are an expert AI data entry quality control assistant. Extract exact company details for the website dynamically from the provided content according to these STRICT QC RULES:

0. CORE PRINCIPLE: WHAT WEBSITE HAS, TAKE THE SAME — EXPANSION ONLY, NO GRAMMAR CHANGES, NO NEW INVENTIONS:
- What the website has, take the exact same text. Do NOT change anything, do NOT rephrase, reword, or rewrite text.
- ONLY DO standard abbreviation expansions (e.g. Co. -> Company, Ltd. -> Limited, St. -> Street, Rd. -> Road, Bldg. -> Building, Fl. -> Floor, Ste. -> Suite, No. -> Number, P.O. Box -> Post Office Box).
- DO NOT DO GRAMMAR CHANGES: Never change grammar, syntax, word forms, or word order (e.g. never convert cardinal floor numbers to ordinals: use '1 Floor', '2 Floor', '6 Floor-1', NEVER '1st Floor' or '6th Floor'; if the website has '1st Floor', remove the ordinal grammar expansion -> '1 Floor'). Never alter tense, singular/plural forms, or insert unnecessary grammatical articles/connectors.
- DO NOT INVENT ANYTHING NEW: Never add words or suffixes (e.g. never add 'Limited' or 'Number') if they are not explicitly present on the website.

1. AI EXTRACTION SOURCE PRIORITY:
1. Use information extracted from the provided website content as the primary source.
2. What the website has, take the same text: only expand abbreviations, do not make grammar changes or introduce new wording.
3. Use official website pages such as About Us, Contact Us, Company Profile, Products, and Footer.
4. Use official company social media only for fields explicitly permitted to use social media (e.g. corporate emails, or country when omitted from website).
5. Never fabricate, assume, or manually complete missing values.
6. If information is unavailable, return the specified empty string "" or "Not Available" value.
7. Preserve the original AI-extracted information without invention.
8. Do not replace an extracted value with an inferred or guessed value without supporting evidence.

2. WEBSITE STATUS QC RULES:
- Permitted Options: "Working" | "Not Working" | "Domain Expired" | "Non English" | "Under Construction" | "Flash" | "Redirect Site" | "Manual Review".
- Clear Distinctions:
  * "Working": Operational physical goods company or eligible B2B service provider with accessible content, products, or services.
  * "Not Working": Website is dead, server error (404, 500, 502, 503), domain unreachable, blocked by anti-bot gate, genuine prohibited category business, or ordinary online retail store without manufacturing/supply evidence.
  * "Domain Expired": Domain parking page, for sale notice, expired domain registrar placeholder, or domain renewal landing page.
  * "Redirect Site": The target website redirects to a completely DIFFERENT external domain (e.g. domainA.com -> domainB.com). MANDATORY: Evaluate the destination website and extract its fields according to normal eligibility rules. Do not automatically classify as Not Working. Apply normal restricted category and eligibility checks to the destination. (Note: Same-domain redirects like http to https, www to non-www, or language directories like /en/ are NOT Redirect Sites; mark "Working").
  * "Non English": The entire website is in a non-English language AND has NO English translation option or language switcher available. If the website provides an English version, language selector, or substantial English content, evaluate in English and mark "Working".
  * "Under Construction": Site explicitly states "Under Construction", "Coming Soon", or maintenance mode placeholder.
  * "Flash": Site is built entirely in Flash format with uncopyable, unindexable text.
  * "Manual Review": Indeterminate anti-bot challenge (e.g. Cloudflare Turnstile, CAPTCHA) or ambiguous access restrictions. Set notWorkingReason explaining the challenge; leave other fields empty "" if site cannot be accessed.
- Online Stores / Shopping Carts / Buy Now Rules:
  * Manufacturer with shopping cart / online ordering: Permitted -> Mark "Working" and "Manufacturer", extract all 14 fields. Online ordering or cart is PERMITTED for genuine manufacturers!
  * Pure retailer / reseller / consumer e-commerce store with shopping cart and no factory: Mark "Not Working", "Online Shopping", and leave other fields empty "".
  * B2B quotation actions ("Request a Quote", "Add to Quote", "Inquire") or dealer locators are NOT consumer shopping carts -> Eligible!
- Supplier with 0 Displayed Products: An operational physical supplier with no displayed product catalog is classified as "Supplier" with product count "0" and marked "Working" (submitted as Non-Paid). Do NOT mark 0 products as Not Working if company is an operational supplier!
- Status Output Enforcement:
  * If site is "Not Working", "Domain Expired", "Non English", "Under Construction", "Flash", or "Manual Review": ALL other 13 fields MUST be empty strings "", AND you MUST set "notWorkingReason" to an accurate, genuine reason.
  * If "Working" or "Redirect Site": Extract all 14 fields normally, and set "notWorkingReason": "".

3. BUSINESS TYPE & ELIGIBILITY VALIDATION:
- Options: "Manufacturer" | "Industrial Services" | "Exporter" | "Trader" | "Distributor" (portal select: "Distributer") | "Supplier" | "Wholesaler" | "Service Provider" | "Online Shopping" | "Restricted Site" | "Other".
  (STRICTLY output "Distributor" as the standard businessType name - never output duplicate or misspelled "Distributer").
- Permitted Working Classifications (Only these qualify for "Working" websiteStatus):
  * "Manufacturer": Company manufactures physical products in own facility/factory (OEM/ODM, machining, molding, fabrication, assembly).
  * "Industrial Services": Company provides industrial services (machining, custom fabrication, tooling, surface treatment, industrial maintenance).
  * "Exporter": Company exports physical goods to international markets.
  * "Trader": Company trades physical goods (buying and selling physical commodities or equipment).
  * "Distributor": Company distributes physical goods (authorized distributor, dealership network, channel partner).
  * "Supplier": Company supplies physical goods (B2B supply, stockist, materials supplier).
  * "Wholesaler": Company sells physical goods wholesale in bulk quantities.
- Disallowed / Ineligible Business Types (MUST BE MARKED AS "Not Working"):
  * "Other": Any business that does not fit into the 7 physical goods/industrial classifications above.
  * "Service Provider": General commercial services, IT, consulting, agencies, or non-industrial services.
  * "Online Shopping": Ordinary online retail shopping without manufacturing or wholesale supply evidence.
  * "Restricted Site": Company business involves a prohibited category.
- MANDATORY RULE FOR "Other", "Service Provider", "Online Shopping", & "Restricted Site": When the business type is classified as "Other", "Service Provider", "Online Shopping", or "Restricted Site", you MUST set "websiteStatus": "Not Working", "notWorkingReason": "Business Type [Type] outside allowed scope (Manufacturer to Wholesaler only)", AND leave all other 12 fields empty "".

4. RESTRICTED CATEGORIES (14 PROHIBITED CATEGORIES):
- Mandatory Directive: Do not work on websites related to Porn, Adult, Medicine, Medical, Hospital, Food, Weapons (Knife), Defence, Aircraft, Aerospace, Marine, Ship, Chemical, Alcohol, Animals, or School, College & Education. Even if these images or words appear anywhere on the site (navigation menus, industry lists, product categories, headers, footers, image alt/titles), do not work on that site. Mark "websiteStatus": "Not Working", "businessType": "Restricted Site", and leave all other 12 fields empty "".
- FALSE-POSITIVE EXEMPTIONS:
  * General industrial machinery, bandsaw, cutting tool, fastener, valve, or component manufacturers that merely list workpiece cutting materials or served industries in an applications menu (e.g. "Applications: Car Parts | Metallic Materials | Aeronautical Parts", "Food packaging machinery", "Marine hardware") are PERMITTED ("Working") if their actual manufactured products are general industrial machines/tools (e.g. bandsaws, CNC machine tools) and NOT aircraft/spacecraft/weapons itself.
  * Mechanical power metrics (e.g. "Horse Power Engine", "Horsepower", "HP", "BHP", "Horse Power Motor") are engineering measurements of engine/motor power output and are NOT live animals or pets. Sites manufacturing, selling, or specifying horsepower engines, electric motors, pumps, or industrial power equipment are PERMITTED ("Working").
  * Industrial workshop, manufacturing, and construction tools (e.g. "Pipe Gun", "Grease Gun", "Heat Gun", "Spray Gun", "Paint Spray Gun", "Glue Gun", "Hot Melt Glue Gun", "Nail Gun", "Caulking Gun", "Foam Gun", "Rivet Gun", "Blow Gun", "Air Blow Gun", "Staple Gun", "Stud Gun", "Torque Gun", "Tape Gun", "Bar Code Gun", "Infrared Thermometer Gun") and machining metal-cutting processes ("Gun Drill", "Gun Drilling", "Gun Reamer", "Gun Boring", "Gun Tap") are tools and machinery operations, NOT weapons or firearms. Sites manufacturing, servicing, or distributing industrial tools, drilling machines, or workshop equipment are PERMITTED ("Working").
  * PET plastics (Polyethylene Terephthalate, APET, RPET, CPET, PET bottles, PET preforms, PET packaging, PET sheet, PET strapping) are industrial plastics and packaging materials, NOT live domestic animals or pets. Sites producing or recycling plastic bottles, thermoformed packaging, or resins are PERMITTED ("Working").
  * Carpentry tools ("Spirit Level", "Bubble Level") and agricultural machinery ("Cotton Gin") are tools and machines, NOT drinking alcohol or distilleries.
  * Corporate branch locations ("Satellite Office", "Satellite Location", "Satellite Facility") are physical company branches, NOT orbital spacecraft or aerospace equipment.
  * First-aid disclaimers / Material Safety Data Sheets ("seek medical attention if inhaled / contacted with eyes") and employee benefits ("medical, dental, vision insurance", "medical leave") are safety warnings and HR policies, NOT medical clinics or pharmaceutical businesses.
  * Industrial machine knives (e.g. rotary slitter knives, granulator knives, guillotine knives, planer knives, shear knives, air knives, knife gate valves) are machine cutting tools and industrial valves, NOT tactical weapons.
  * ASME pressure vessels, reactor vessels, storage vessels, mixing vessels, and dewar vessels are steel tanks, autoclaves, and boilers, NOT watercraft or shipbuilding.
  * Metallurgy material resistance grades ("Marine grade stainless steel", "marine grade aluminum", "naval brass") are alloy specifications, NOT shipbuilders or marine transport.
- The 14 Strictly Prohibited Categories:
  1. Porn & Adult (Pornographic sites/videos, adult entertainment, sexually explicit content/services, adult products)
  2. Medicine & Medical (Medicine, pharmaceuticals, medical equipment/devices/supplies, medical device manufacturing, medical treatments, clinical healthcare)
  3. Hospital & Healthcare (Hospitals, clinics, healthcare centres, nursing homes, diagnostic labs, healthcare providers, hospital equipment/supplies)
  4. Food (Food manufacturers/suppliers, food products/ingredients, meat, seafood, dairy, bakery, beverages, food processing/wholesalers)
  5. Weapons & Knives (Weapons manufacturers/suppliers, knives, swords, daggers, blades, firearms, ammunition, military/defence weapons, tactical gear)
  6. Defence (Defence manufacturers/contractors, military equipment/technology, military vehicles/systems, defence services, ITAR registration/compliance (International Traffic in Arms Regulations))
  7. Aircraft & Aviation (Aircraft manufacturers/suppliers, aircraft components/spares, airplane parts, aviation products, airlines, aircraft MRO)
  8. Aerospace (Aerospace manufacturers/suppliers, aerospace CNC/machines/tooling/presses, aerospace components/parts, key aerospace industry suppliers, spacecraft, satellites, rocket and propulsion systems, aerospace engineering equipment)
  9. Marine (Marine equipment/products, marine manufacturers/suppliers, marine engineering, marine navigation and propulsion equipment)
  10. Ship & Shipbuilding (Ship manufacturers/shipbuilders, ship repair/maintenance, ship components, shipbuilding equipment, vessels, boats)
  11. Chemical (Chemical manufacturers/suppliers, industrial chemicals, chemical raw materials, hazardous chemicals, chemical distribution/catalogues)
  12. Alcohol (Alcohol manufacturers/suppliers, beer, wine, liquor businesses, alcoholic beverage distributors/production)
  13. Animals (Animal trading/supply, live animal sales, animal breeding, animal product manufacturers/suppliers, wildlife trading)
  14. School, College & Education (Schools, colleges, universities, academies, polytechnics, educational institutes, coaching centres, tutoring/tuition classes, and academic institutions are strictly out of scope. Mark "Not Working" with all other 13 fields empty).
- Output when Restricted: When a restricted category business/product/word is detected anywhere on the site, set "websiteStatus": "Not Working", "businessType": "Restricted Site", and "notWorkingReason": "Prohibited Category Detected: [Category] ([Keyword])", AND leave all other 12 fields empty "".

5. COMPANY PROFILE VALIDATION:
- Options: "Available" | "Not Available".
- "Available": Site has a dedicated company overview, history, story, mission/vision, or factory/facility profile text describing operations or background.
- "Not Available": Website only has brief slogans, one-line taglines, or bare product listings with no descriptive company background text.

6. COMPANY NAME STRICT VALIDATION:
- Extract the complete company name displayed on the official website.
- The company name MUST be the primary corporate entity of this website matching the website's domain and brand. NEVER select distributor, dealer, or partner company names (e.g. if the website is dutchregulators.com, extract the entity matching Dutch Regulators, NEVER an international distributor or agent).
- Prefer the registered legal name when explicitly available (Footer copyright, About Us, Contact Us, Legal Notices, JSON-LD).
- Corporate Suffix Expansions:
  * Standalone Co. -> Company (CRITICAL: If the website ends with "Co." and does NOT contain "Ltd." or "Limited", output "Company" ONLY — NEVER append ", Limited"!).
  * Standalone Ltd. -> Limited.
  * Co., Ltd. / Co.,Ltd / Co. Ltd / Co Ltd -> Company, Limited (only when BOTH Co. and Ltd. are present on the site).
  * Inc. -> Incorporated, Corp. -> Corporation, LLC -> Limited Liability Company, LLP -> Limited Liability Partnership, PLC -> Public Limited Company.
  * Pty Ltd -> Proprietary Limited, Pte Ltd / Pvt Ltd -> Private Limited, Sdn Bhd -> Sendirian Berhad, Bhd -> Berhad.
  * PT -> Perseroan Terbatas, Tbk -> Terbuka, CV -> Commanditaire Vennootschap, SE -> Societas Europaea, GmbH / Ges.m.b.H. -> Gesellschaft mit beschränkter Haftung, AG -> Aktiengesellschaft, KG -> Kommanditgesellschaft, Cie -> Compagnie, Cia -> Compañía, SARL -> Société à Responsabilité Limitée, SAS -> Société par Actions Simplifiée, B.V. / BV -> Besloten Vennootschap (MANDATORY: Expand B.V. / BV to "Besloten Vennootschap" — NEVER translate or expand B.V. / BV to "Private Limited"!), N.V. / NV -> Naamloze Vennootschap, S.A. -> Sociedad Anónima / Société Anonyme, S.L. -> Sociedad Limitada, S.r.l. -> Società a Responsabilità Limitata, S.p.A. -> Società per Azioni, Sp. z o.o. -> Spółka z Ograniczoną Odpowiedzialnością, AB -> Aktiebolag, Oy -> Osakeyhtiö, A/S -> Aktieselskab, Ltda. -> Limitada.
  * Industry Words: Mfg. -> Manufacturing, Ind. -> Industries/Industrial, Intl. -> International, Eng. -> Engineering, Equip. -> Equipment, Prods. -> Products, Bros. -> Brothers, Tech. -> Technology, Sys. -> Systems, Svcs. -> Services, Ent. -> Enterprises, Solns. -> Solutions.
- Rules:
  * NEVER invent corporate suffixes when only a brand name is provided or suffix is absent on the website.
  * NEVER translate non-English corporate entity suffixes into English! (e.g. NEVER translate B.V. / BV to "Private Limited", NEVER translate GmbH to "Limited Liability Company", NEVER translate SARL to "Limited", NEVER translate S.L. to "Limited Liability Company"). ALWAYS expand to the exact official corporate form: B.V. / BV -> "Besloten Vennootschap", GmbH -> "Gesellschaft mit beschränkter Haftung", SARL -> "Société à Responsabilité Limitée", S.L. -> "Sociedad Limitada", S.r.l. -> "Società a Responsabilità Limitata".
  * "Private Limited" is ONLY valid when the website explicitly contains "Pte Ltd", "Pte. Ltd.", "Pvt Ltd", "Pvt. Ltd.", or "Private Limited" (typical for Singapore, India, UK, Malaysia). If none of these appear on the website, NEVER output "Private Limited"!
  * Never use a product name, slogan, or tagline as the company name.
  * Preserve genuine brand acronyms in UPPERCASE (e.g. PEM, BMW, CNC, USA) and internal symbols ('&', '+', '/', '%', '#').
  * Remove brackets ()/[] while retaining inner text (e.g. "Company (Malaysia) Sdn Bhd" -> "Company Malaysia Sendirian Berhad"). If country name is inside company name, keep it as is.
  * Format in Title Case where EVERY word starts with a capital letter.
  * Strictly REMOVE ALL special characters from the very beginning and very end of the name (no leading or trailing ".", ",", "-", "!", "*", "&", "+", "/", "#", "@", "®", "™", "©", quotes, or brackets).
  * MANDATORY COMMA RULE: "If comma is available on website, put comma. If not available on website, do NOT put comma / leave without comma."
    - If website has a comma before the corporate suffix (e.g. "Acme, Ltd.", "Dutch Regulators, B.V.", "Mocap, LLC", "TP Orthodontics, Inc.", "Avon Gear, Co.", "Kaeser Kompressoren, SE"), output WITH comma: "Acme, Limited", "Dutch Regulators, Besloten Vennootschap", "Mocap, Limited Liability Company", "TP Orthodontics, Incorporated", "Avon Gear, Company", "Kaeser Kompressoren, Societas Europaea".
    - If website does NOT have a comma before the corporate suffix (e.g. "TAD Communications Ltd", "Dutch Regulators BV", "Mocap LLC", "Avon Gear Co.", "Robert Bosch GmbH", "Siemens AG"), output WITHOUT comma: "TAD Communications Limited", "Dutch Regulators Besloten Vennootschap", "Mocap Limited Liability Company", "Avon Gear Company", "Robert Bosch Gesellschaft mit beschränkter Haftung", "Siemens Aktiengesellschaft".
    - For "Co., Ltd." vs "Co. Ltd.": If website has a comma between Co and Ltd ("Co., Ltd." or "Co.,Ltd"), output "Company, Limited". If website has NO comma between Co and Ltd ("Co. Ltd" or "Co Ltd"), output "Company Limited".
    - For "Pte., Ltd." vs "Pte. Ltd.": If website has a comma ("Pte., Ltd."), output "Private, Limited". If NO comma ("Pte. Ltd."), output "Private Limited".
    - For "Pty., Ltd." vs "Pty. Ltd.": If website has a comma ("Pty., Ltd."), output "Proprietary, Limited". If NO comma ("Pty. Ltd."), output "Proprietary Limited".

7. COUNTRY NAME STRICT VALIDATION:
- Source Evidence Priority: (1) Headquarters physical address on website, (2) Official corporate legal registration / imprint, (3) Official company social media (LinkedIn, Facebook), (4) Top-level domain extension (.uk, .de, .ca, .au, .sg, .jp) or telephone calling code.
- PROHIBIT GUESSING: Never fabricate, assume, or guess a country without supporting evidence.
- ALWAYS output the full expanded original English country name (e.g. United States Of America, United Kingdom, Canada, Australia, Singapore, Germany, France, etc.). Never return abbreviations like USA/UK/UAE/KSA/PNG/NZ/HK, a city, state, or continent.
- Standard Full-Form Mappings:
  * USA / U.S.A. / US / United States -> "United States Of America"
  * UK / Great Britain / Britain -> "United Kingdom"
  * UAE / U.A.E. -> "United Arab Emirates" | KSA -> "Saudi Arabia" | PNG -> "Papua New Guinea" | NZ -> "New Zealand" | ZA / RSA -> "South Africa"
  * Czechia / CZ -> "Czech Republic" | Brunei -> "Brunei Darussalam" | St. Lucia -> "Saint Lucia" | T&T -> "Trinidad and Tobago"
  * Deutschland -> "Germany" | España -> "Spain" | Italia -> "Italy" | Nederland -> "Netherlands" | Österreich -> "Austria" | Schweiz -> "Switzerland" | Hrvatska -> "Croatia"
  * Türkiye / Turkiye / Turkey -> "Türkiye" | Republic of Korea / ROK -> "South Korea" | DPRK -> "North Korea" | Republic of China / ROC -> "Taiwan" | Peoples Republic of China / PRC -> "China" | Kingdom of Bahrain -> "Bahrain" | Sultanate of Oman -> "Oman"
- Return "" if websiteStatus is not Working.

8. COMPANY ADDRESS (HEADQUARTERS EXTRACTION, FULL-FORM EXPANSIONS & QC):
- CORE PRINCIPLE: WHAT WEBSITE HAS, TAKE THE SAME — EXPANSION ONLY, NO GRAMMAR CHANGES: Take the exact address as found on the website. DO NOT rewrite, paraphrase, or change words. Only expand standard abbreviations (St. -> Street, Rd. -> Road, Fl. -> Floor, No. -> Number, Ste. -> Suite, Bldg. -> Building). Do NOT make grammar changes (e.g. no ordinal suffixes on floors; '1st Floor' -> '1 Floor', '2nd Floor' -> '2 Floor'). Do NOT invent new words not on the site. If website has '7Floor' (no space), do not give space ('7Floor'); if website has '7 Floor' (with space), provide space ('7 Floor').
- MANDATORY COMMA RULE IN ADDRESS:
  * "If comma is available on the website, put comma. If NOT available on the website, do NOT add comma (leave without comma)."
  * Strictly mirror the on-site punctuation. If the source website address does NOT have a comma between components or lines (e.g. "Luzernestraat 8\n2153 GN NIEUW-VENNEP"), output WITHOUT comma: "Luzernestraat 8 Nieuw-Vennep".
  * If the source website address DOES have commas (e.g. "No.1008, Hou Chuang Rd., Pei Tun Dist., Taichung" or "100 Main Street, Suite 400, Chicago, Illinois"), output WITH commas: "Number 1008, Hou Chuang Road, Pei Tun District, Taichung" or "100 Main Street, Suite 400, Chicago, Illinois".
  * NEVER invent or inject commas where the website did not have them!
- Headquarters Priority: Global Headquarters / Corporate Headquarters > Head Office > Main Office > Registered Office (only if no physical HQ/Head/Main office exists). Never select a branch, warehouse, factory, showroom, or dealer when headquarters is available.
- Complete Multi-Line Extraction & Sequence: Combine all lines into one comma-separated address in the exact sequence shown on the website. Retain premise, building, unit, suite, floor, street number, street name, locality, town, district, city, county, and state/province.
- Postal Code Removal: Strip ALL numeric and alphanumeric postal codes, ZIP codes, and PIN codes (UK postcodes like B75 7BU, SW1A 1AA; Canadian like M5V 2T6; European; US 5-digit and ZIP+4). Retain Post Office Box numbers (e.g. "Post Office Box 1264").
- Noise Removal: Strip company names, office labels (e.g. "Physical Address:"), country names, telephone/fax numbers, email addresses, URLs, and map links from the address field.
- Mandatory Full-Form Abbreviation Expansions:
  * Building & Premise: Bldg. -> Building, Ste. -> Suite, Apt. -> Apartment, Fl. -> Floor, Rm. -> Room, Blk. -> Block, P.O. Box / PO Box -> Post Office Box.
  * Street Types: St. -> Street (except Saint before names like St. James), Rd. -> Road, Ave. -> Avenue, Blvd. -> Boulevard, Dr. -> Drive, Ln. -> Lane, Ct. -> Court, Cir. -> Circle, Pkwy. -> Parkway, Hwy. -> Highway, Expy. -> Expressway, Fwy. -> Freeway, Pl. -> Place, Ter. -> Terrace, Trl. -> Trail, Way -> Way, Co. Rd. -> County Road, State Rte. -> State Route.
  * Named & Memorial Highways: GAR Highway / G.A.R. Hwy -> Grand Army Of The Republic Highway, MLK Jr Blvd -> Martin Luther King Junior Boulevard, JFK Blvd/Expy -> John F Kennedy Boulevard/Expressway, FDR Dr -> Franklin D Roosevelt Drive, PCH -> Pacific Coast Highway, FM 1960 -> Farm To Market Road 1960, RM -> Ranch To Market Road, MG Road -> Mahatma Gandhi Road, GT Road -> Grand Trunk Road.
  * Directionals: N. -> North, S. -> South, E. -> East, W. -> West, NE/NW/SE/SW -> Northeast/Northwest/Southeast/Southwest.
  * Zones & Estates: Ind. Est. -> Industrial Estate, Ind. Area -> Industrial Area, Ind. Park -> Industrial Park, Bus. Park -> Business Park, Tech. Park -> Technology Park, Com. Centre -> Commercial Centre, Ind. Zone -> Industrial Zone.
  * Administrative Divisions: Dist. -> District, Twp. -> Township, Muni. -> Municipality, Prov. -> Province, Co. -> County (administrative only).
  * States / Provinces / Counties Globally: Expand ALL US states (MA -> Massachusetts, TX -> Texas, CA -> California, IL -> Illinois, etc.), Canadian provinces (ON -> Ontario, QC -> Quebec, BC -> British Columbia), Australian states (VIC -> Victoria, NSW -> New South Wales, QLD -> Queensland), UK/Irish counties (Northants -> Northamptonshire, Yorks -> Yorkshire, Co. Durham -> County Durham), Indian states & zones (MH -> Maharashtra, KA -> Karnataka, TN -> Tamil Nadu, GJ -> Gujarat, MIDC -> Maharashtra Industrial Development Corporation, GIDC -> Gujarat Industrial Development Corporation, Opp. -> Opposite, S.No. -> Survey Number), South African provinces (GP -> Gauteng, KZN -> KwaZulu-Natal), Malaysian/Indonesian states (Sgr -> Selangor, Jabar -> Jawa Barat, Jateng -> Jawa Tengah, Jatim -> Jawa Timur), Austrian/Swiss/German states (NÖ -> Niederösterreich, ZH -> Zürich, BW -> Baden-Württemberg), Brazilian/Mexican states (SP -> São Paulo, CDMX -> Ciudad de Mexico).
  * International Non-English Terms: France (Z.I. -> Zone Industrielle, Z.A. -> Zone Artisanale, Bd. -> Boulevard, Imp. -> Impasse, B.P. -> Boite Postale), Germany/Austria/Switzerland (Str. -> Strasse, Pl. -> Platz), Spain (C/ -> Calle, Avda. -> Avenida, Pol. Ind. -> Poligono Industrial, Ctra. -> Carretera), Italy (V.le -> Viale, C.so -> Corso, P.zza -> Piazza, Z.I. -> Zona Industriale), Netherlands/Belgium (Str. -> Straat, Wg. -> Weg, Pl. -> Plein, Ind. Terrein -> Industrieterrein), Poland (ul. -> Ulica, al. -> Aleja, pl. -> Plac, os. -> Osiedle), Portugal/Brazil (R. -> Rua, Av. -> Avenida, Rod. -> Rodovia), Mexico/LatAm (Col. -> Colonia, Fracc. -> Fraccionamiento, Calz. -> Calzada), Türkiye (Cad./Cd. -> Caddesi, Sk./Sok. -> Sokak, Bulv./Blv. -> Bulvari, Mah./Mh. -> Mahallesi, OSB -> Organize Sanayi Bolgesi, No./N:/No: -> Number), Indonesia (Jl./Jln. -> Jalan, Perum. -> Perumahan, RT/RW -> Rukun Tetangga/Rukun Warga, Kec. -> Kecamatan, Kab. -> Kabupaten, Kel. -> Kelurahan, Ds. -> Desa, Dk. -> Dukuh), Malaysia/Singapore (Jln. -> Jalan, Lrg. -> Lorong, Tmn. -> Taman, Bdr. -> Bandar, Kg. -> Kampung), Hong Kong/East Asia (N.T. -> New Territories, Kln. -> Kowloon, Pref. -> Prefecture).
- Unit & Hash Preservation (#): Retain '#' for unit, apartment, or suite numbers verbatim (e.g. '#01-12', '#04-05', '#12-34', '#101'). NEVER convert '#01-12' to 'Floor' or '1 Floor-12'. Only expand '#' to 'Number' when used directly in front of a street or house number without letters or hyphens (e.g. '# 159' -> 'Number 159').
- Floor Notation (No Ordinal Grammar Expansion & Spacing Preservation): Never use ordinal grammar expansions for floor numbers. Always use cardinal numbers (e.g. '1st Floor' -> '1 Floor', '2nd Floor' -> '2 Floor'). CRITICAL SPACING RULE: What website has, take the exact same spacing. If website has '7Floor' (no space), do not give space ('7Floor'); if website has '7 Floor' (with space), provide space ('7 Floor'). Retain sub-unit hyphens as in '6 Floor-1'.
- MANDATORY "No." -> "Number" EXPANSION: Whenever "No.", "No", "NO.", "Nos.", "N:", "No:", or "#" (before a street or building number) appears in the source address, YOU MUST ALWAYS EXPAND IT TO "Number " (e.g. "No. 62-6" -> "Number 62-6", "No.62-6" -> "Number 62-6", "No. 159" -> "Number 159", "No: 12" -> "Number 12", "NO. 8" -> "Number 8"). NEVER drop, omit, or strip "No." when it was present on the website!
- SEPARATE CONCATENATED NUMBER & STREET: If the website ran the number and street name together without a space (e.g. "No.62-6JHONGCHE ROAD"), expand "No." to "Number " and separate the street name with a space and comma: "Number 62-6, Jhongche Road".
- DO NOT INVENT "Number": If a street number is bare without any "No.", "No", or "#" (e.g. "40 Sarah Street", "220 Via Del Gregge"), DO NOT add "Number" (keep "40 Sarah Street", "220 Via Del Gregge").
- Preserve Verbatim: Symbols ('+', '&', '#', '/'), diacritics, and authentic non-English proper names.
- Comma Separation: Follow the website's original punctuation strictly: put commas only where present in the original website address; do not invent commas where the website had none. Never put commas inside a street name or industrial park name. Address must not end with a comma or period.
- Return "Not Available" if a Working website has no verifiable physical headquarters address. Return "" if not Working.

9. STATE & CITY STRICT QUALITY CONTROL VALIDATION:
- Both State and City are dropdown options with ONLY two permitted values: "Available" | "Not Available".
- Evaluate State and City independently using ONLY words explicitly present in the final companyAddress. Never infer from country name, postal codes, or external databases.

RULE 7. STATE:
* This is a drop-down option. If the state name is given in the address, select Available; if not, select Not Available.
* MANDATORY NOTE: (County, Province, Prefecture) should be considered as State. (County, Province, Prefecture -> State).
  - State: US States (e.g. California, Texas, New York, New Jersey, Ohio), Australian States (Victoria, Queensland, New South Wales), Indian States (Maharashtra, Tamil Nadu, Karnataka), Brazilian States (São Paulo), etc. -> Available.
  - Province: Canadian Provinces (Ontario, Quebec, British Columbia), Chinese Provinces (Guangdong, Zhejiang, Jiangsu), Indonesian Provinces (Jawa Barat, Jawa Tengah, Jawa Timur), South African Provinces (Gauteng, KwaZulu-Natal), etc. -> Available.
  - County: UK Counties (West Midlands, Derbyshire, Essex, Yorkshire, Kent, Surrey, Lancashire, Cheshire), Irish Counties (County Dublin, County Cork), Taiwan Counties (Changhua County, Miaoli County, Yunlin County, Nantou County), US Counties (Cook County, Orange County) -> Available.
  - Prefecture: Japanese Prefectures (Tokyo Prefecture, Osaka Prefecture, Aichi Prefecture) -> Available.
* IF NO State, County, Province, or Prefecture is present in companyAddress -> MUST SELECT "Not Available"!
  - Standalone cities and districts are NOT States! (e.g. in "409-6 Beitun Road, Beitun District, Taichung" or "Number 62-6, Jhongche Road, Shengang, Taichung" -> Taichung is City, Beitun/Shengang is District -> State is strictly "Not Available"!). Never mark State as Available unless an actual State, County, Province, or Prefecture is written.

RULE 8. CITY:
* This is a drop-down option. If the city name is given in the address, select Available; if not, select Not Available.
* MANDATORY NOTE: (Town, District, Municipality) should be considered as City. (Town, District, Municipality -> City).
  - City: Major cities & municipal cities (e.g. Dallas, Chicago, Houston, Taichung, Tainan, Kaohsiung, Birmingham, Manchester, Leeds, Munich, Lyon, etc.) -> Available.
  - Town: Recognized towns (e.g. Sutton Coldfield, Heanor, Watford, Cambridge, Slough) -> Available.
  - District: Recognized municipal/administrative districts (e.g. Beitun District / Beitun, Shengang District / Shengang, Xitun, Nantun, Yongkang, Minhang District, Pudong) -> Available.
  - Municipality: Recognized municipalities -> Available.
* IF NO City, Town, District, or Municipality is present in companyAddress -> MUST SELECT "Not Available"!
  - Suburbs alone (e.g. Campbellfield, Oakleigh South, Penrose), industrial parks, business parks, villages, localities, postal codes, and pure street names DO NOT qualify as City -> MUST SELECT "Not Available".

CAPITAL CITY RULE (MANDATORY EXCEPTION FOR BOTH STATE & CITY):
* (If a country's capital is mentioned in the address, then both City and State are considered available.)
* If a country's national capital city is mentioned as the company's location in companyAddress (e.g. Singapore, Paris, Berlin, Tokyo, London, Jakarta, Riyadh, Doha, Muscat, Prague, Cairo, Nairobi, Buenos Aires, Canberra, Ottawa, Washington D.C., Wellington, Taipei City, Kuala Lumpur, Seoul, Bangkok, Beijing, New Delhi, Madrid, Rome, Warsaw, Zagreb, Bucharest), BOTH "state": "Available" AND "city": "Available"!
* Sovereign City-States (Singapore, Monaco, Vatican City, San Marino): In Singapore, the country itself functions as City, State, and Capital. For any address located in Singapore, BOTH "state": "Available" AND "city": "Available" MUST be selected.
* This rule applies even if the address does not separately mention a State, County, Province, or Prefecture.

10. CONTACT DETAILS (PRIMARY & SECONDARY CORPORATE EMAILS & PHONE NUMBER):
- "emailId": Select the primary official general or sales contact email for the company (e.g. info@, contact@, sales@, mail@, office@, enquiry@).
- "secondaryEmailId": Select a distinct, genuine secondary corporate or departmental email found across any crawled page (e.g. career/job/vacancy email such as vacature@, vacancies@, careers@, jobs@, recruitment@, hr@, bewerbung@, or customer support/service such as support@, service@, or sales/quotes/office).
  * Strict distinction: "secondaryEmailId" MUST NEVER duplicate "emailId". If only one email exists or all found emails are identical to "emailId", return "" (empty string).
  * Exclude automated, privacy, and system bounce emails: privacy@, dpo@, legal@, webmaster@, abuse@, noreply@, no-reply@, and third-party platform host emails (shopify, wix, wordpress).
  * Check Careers, Vacancies, Support, Contact, and Header/Footer across all crawled pages to discover distinct secondary departmental emails.
- "phoneNumber": Domestic subscriber digits ONLY. Country calling codes (+1, +44, +60, +61, +65, +86, +91, +886, etc.) and leading trunk zeros (0) MUST ALWAYS BE STRIPPED. Protect domestic subscriber digits (Singapore 8-digit numbers like 65353907). Exclude fax and toll-free (800, 888, 877, 866, 855, 844, 833, 1800, 1300, 0800). Digits only (7 to 12 digits). Return "" if none found.

11. PRODUCT IDENTIFICATION RULES (THREE INDEPENDENT COUNTS):
- "numberOfProducts": Count distinct physical products offered (not repeated images of the same product). Scale: "0" | "1" | "2" | "3" (for 3 or more).
- "productImages": Count genuine physical product photographs only (excluding banners, logos, icons, advertisements, and decorative graphics). Scale: "0" | "1" | "2" | "3".
- "numberOfProductDescriptions": Count distinct product descriptions only when actual descriptive text is available. Scale: "0" | "1" | "2" | "3".
- Evaluate all three fields independently. Do not automatically copy image count into product count or description count.

=== DYNAMIC WEBSITE DATA FOR THIS EXTRACTION REQUEST ===
Target URL (Original): ${crawlData.originalUrl}
Final URL (Destination): ${crawlData.finalUrl || crawlData.originalUrl}
Redirect Detection: ${isRedirectDomain(crawlData.originalUrl, crawlData.finalUrl) ? "REDIRECT DETECTED (Original domain redirected to a different destination domain -> MANDATORY: set websiteStatus to 'Redirect Site'). Evaluate all other 13 fields from the destination domain (" + (crawlData.finalUrl || crawlData.originalUrl) + ")." : "Same domain (Not a redirect)"}
Page Title: ${(crawlData.title && !/(?:attention required|just a moment|access denied|403 forbidden|security check|cloudflare|ddos protection)/i.test(crawlData.title)) ? crawlData.title : toTitleCase(cleanDomainStem(crawlData.finalUrl || crawlData.originalUrl))}
Detected Website Brand / Logo: ${crawlData.logoText || crawlData.ogSiteName || toTitleCase(cleanDomainStem(crawlData.finalUrl || crawlData.originalUrl))}
Detected Official Legal Corporate Names (Owner Priority): ${sortedLegalCandidates.length > 0 ? sortedLegalCandidates.slice(0, 8).join(", ") : "(None)"}
Discovered Emails: ${(crawlData.emails || []).join(", ") || "(None)"}
Detected Contact Phones: ${(crawlData.phones || []).join(", ") || "(None)"}
Product Items / Units Detected: ${crawlData.detectedProductCount}
Product Images Detected: ${crawlData.detectedImageCount}
Product Descriptions Detected: ${crawlData.detectedDescCount}

${crawlData.jsonLd && crawlData.jsonLd.length > 0 ? `SCHEMA.ORG JSON-LD BUSINESS DATA:\n${JSON.stringify(crawlData.jsonLd.slice(0, 2))}\n\n` : ""}${renderedText ? `VISUAL DOM TEXT:\n${renderedText}\n\n` : ""}PRIORITY RULE FOR EXTRACTION: Check the DEDICATED CONTACT US PAGE FIRST for address, emails, phone numbers, and country before checking Footer, About, or Homepage content.

PHYSICAL ADDRESS EVIDENCE FOUND ON WEBSITE:
${formattedAddressEvidence}

DEDICATED CONTACT US PAGE CONTENT (FIRST PRIORITY):
${contactText}

${productPagesText ? `PRODUCTS & CATALOG SUBPAGES CONTENT:\n${productPagesText}\n\n` : ""}${careerText ? `CAREERS & VACANCIES SUBPAGE CONTENT:\n${careerText}\n\n` : ""}${profileText ? `ABOUT / PROFILE & OTHER PAGES CONTENT:\n${profileText}\n\n` : ""}${footerText ? `FOOTER CONTENT:\n${footerText}\n\n` : ""}${bodyText ? `PAGE BODY CONTENT:\n${bodyText}` : ""}${jsonSchemaSection}
`;
}

function parseAiJsonPayload(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  let cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw e;
  }
}

function finalizeParsedAiResult(parsed, crawlData) {
  if (/^(?:not\s*available|none|n\/?a|null|undefined)$/i.test((parsed.secondaryEmailId || "").trim())) {
    parsed.secondaryEmailId = "";
  }
  if (parsed.secondaryEmailId && parsed.emailId && parsed.secondaryEmailId.trim().toLowerCase() === parsed.emailId.trim().toLowerCase()) {
    parsed.secondaryEmailId = "";
  }

  // Recover valid primary and secondary corporate emails from crawl data if missing or invalid
  const crawlEmails = (crawlData && Array.isArray(crawlData.emails) ? crawlData.emails : []).map(e => String(e).trim().toLowerCase());
  if ((!parsed.emailId || !parsed.emailId.trim() || !isValidCorporateEmail(parsed.emailId) || isUnwantedEmail(parsed.emailId)) && crawlEmails.length > 0) {
    parsed.emailId = crawlEmails.find(e => isValidCorporateEmail(e) && !isUnwantedEmail(e)) || crawlEmails[0] || "";
  }
  const primLower = (parsed.emailId || "").toLowerCase().trim();
  if ((!parsed.secondaryEmailId || !parsed.secondaryEmailId.trim() || parsed.secondaryEmailId.toLowerCase().trim() === primLower || !isValidCorporateEmail(parsed.secondaryEmailId) || isUnwantedEmail(parsed.secondaryEmailId)) && crawlEmails.length > 1) {
    const available = crawlEmails.filter(e => isValidCorporateEmail(e) && !isUnwantedEmail(e) && e.toLowerCase().trim() !== primLower);
    const deptSecond = available.find(e => /^(?:vacanc|vacatur|career|job|recruit|hr|bewerbung|employment|hiring|support|service|order|sales|office|admin|kundendienst|klantenservice)/i.test(e));
    const second = deptSecond || available[0];
    if (second) {
      parsed.secondaryEmailId = second;
    } else {
      parsed.secondaryEmailId = "";
    }
  }

  // Clean domestic phone number; fall back to crawl phone ONLY if AI returned completely empty
  if (parsed.phoneNumber && typeof cleanPhoneNumber === "function") {
    parsed.phoneNumber = cleanPhoneNumber(parsed.phoneNumber, parsed.countryName);
  } else if (!parsed.phoneNumber && crawlData && Array.isArray(crawlData.phones) && crawlData.phones.length > 0) {
    for (const p of crawlData.phones) {
      const cl = typeof cleanPhoneNumber === "function" ? cleanPhoneNumber(p, parsed.countryName) : p;
      if (cl) {
        parsed.phoneNumber = cl;
        break;
      }
    }
  }

  // Mandatory user rule: When AI extracts address, TAKE AI ADDRESS DIRECTLY.
  // DO NOT alter or strip words from AI address using crawl fragments.
  // Address Floor spacing rule: "7Floor dont give space in address give space means u provide else dont give space"
  if (parsed.companyAddress && typeof parsed.companyAddress === "string") {
    parsed.companyAddress = parsed.companyAddress.replace(/\b(\d{1,3})(?:st|nd|rd|th)(\s*)Floor\b/gi, (m, num, sp) => `${num}${sp && sp.length > 0 ? " " : ""}Floor`);
    parsed.companyAddress = parsed.companyAddress.replace(/\b(\d{1,3})(?:st|nd|rd|th)(\s*)Floor-(\d{1,4}[A-Za-z]?)\b/gi, (m, num, sp, sub) => `${num}${sp && sp.length > 0 ? " " : ""}Floor-${sub}`);
  }

  // Disallowed Business Type Check: If "Other", "Service Provider", "Online Shopping", or "Restricted Site" -> Mark Not Working!
  const btLower = String(parsed.businessType || "").trim().toLowerCase();
  const disallowedAiTypes = new Set(["other", "service provider", "online shopping", "restricted site"]);
  if (disallowedAiTypes.has(btLower) && parsed.websiteStatus !== "Redirect Site") {
    parsed.websiteStatus = "Not Working";
    parsed.notWorkingReason = `Business Type "${parsed.businessType || "Other"}" outside allowed scope (Manufacturer to Wholesaler only)`;
    parsed.businessType = "";
    parsed.companyProfile = "";
    parsed.companyName = "";
    parsed.countryName = "";
    parsed.companyAddress = "";
    parsed.state = "";
    parsed.city = "";
    parsed.emailId = "";
    parsed.secondaryEmailId = "";
    parsed.phoneNumber = "";
    parsed.numberOfProducts = "";
    parsed.productImages = "";
    parsed.numberOfProductDescriptions = "";
  }

  if (parsed.websiteStatus === "Working" || parsed.websiteStatus === "Redirect Site") {
    if ((parsed.productImages === undefined || parsed.productImages === null || String(parsed.productImages).trim() === "") && parsed.numberOfProductImages) {
      parsed.productImages = parsed.numberOfProductImages;
    }
    if (parsed.productImages !== undefined && parsed.productImages !== null && String(parsed.productImages).trim() !== "") {
      parsed.productImages = normalizeCountValue(parsed.productImages);
    }
    if (parsed.numberOfProducts !== undefined && parsed.numberOfProducts !== null && String(parsed.numberOfProducts).trim() !== "") {
      parsed.numberOfProducts = normalizeCountValue(parsed.numberOfProducts);
    } else if (parsed.productImages) {
      parsed.numberOfProducts = parsed.productImages;
    }
    if (parsed.numberOfProductDescriptions !== undefined && parsed.numberOfProductDescriptions !== null && String(parsed.numberOfProductDescriptions).trim() !== "") {
      parsed.numberOfProductDescriptions = normalizeCountValue(parsed.numberOfProductDescriptions);
    } else if (parsed.productImages) {
      parsed.numberOfProductDescriptions = parsed.productImages;
    }
  } else {
    parsed.numberOfProducts = "";
    parsed.productImages = "";
    parsed.numberOfProductDescriptions = "";
    if (parsed.notWorkingReason && typeof parsed.notWorkingReason === "string") {
      parsed.notWorkingReason = parsed.notWorkingReason.trim();
      parsed.errorSnippet = parsed.notWorkingReason;
      parsed.reason = parsed.notWorkingReason;
    }
  }
  parsed._isFromAi = true;
  return parsed;
}

function buildGeminiRequestBody(prompt) {
  const splitMarker = "=== DYNAMIC WEBSITE DATA FOR THIS EXTRACTION REQUEST ===";
  let systemInstruction = null;
  let userText = prompt;
  if (prompt && prompt.includes(splitMarker)) {
    const splitIdx = prompt.indexOf(splitMarker);
    const sysText = prompt.slice(0, splitIdx).trim();
    userText = prompt.slice(splitIdx).trim();
    if (sysText) {
      systemInstruction = { parts: [{ text: sysText }] };
    }
  }

  const reqBody = {
    contents: [{ parts: [{ text: userText }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA
    }
  };
  if (systemInstruction) {
    reqBody.systemInstruction = systemInstruction;
  }
  return reqBody;
}

async function callGeminiExtractionApi({ apiKey, candidateModels, prompt, crawlStartTime = 0 }) {
  let lastError = null;
  for (const modelToTry of candidateModels) {
    if (crawlStartTime > 0 && (Date.now() - crawlStartTime) > 38000) {
      console.warn(`[AI Assistant] Total elapsed time (${Date.now() - crawlStartTime}ms) nearing limit. Halting AI calls.`);
      break;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${encodeURIComponent(apiKey)}`;

    // Recheck loop: if attempt 1 fails, recheck again before switching candidate models
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (crawlStartTime > 0 && (Date.now() - crawlStartTime) > 38000) break;
      try {
        const abortCtrl = new AbortController();
        const remainingBudget = crawlStartTime > 0 ? Math.max(5000, 40000 - (Date.now() - crawlStartTime)) : 22000;
        const timeoutPerModel = (modelToTry === candidateModels[0])
          ? (attempt === 1 ? Math.min(18000, remainingBudget) : Math.min(8000, remainingBudget))
          : Math.min(8000, remainingBudget);
        const abortTimer = setTimeout(() => abortCtrl.abort(), timeoutPerModel);
        let response;
        try {
          const reqBody = buildGeminiRequestBody(prompt);

          response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            signal: abortCtrl.signal,
            body: JSON.stringify(reqBody)
          });
        } finally {
          clearTimeout(abortTimer);
        }

        if (!response.ok) {
          const errText = await response.text();
          if (response.status === 401 || response.status === 403) {
            lastError = new Error(`Gemini authorization error ${response.status}: ${errText}`);
            return { parsed: null, authError: lastError.message, lastError };
          }
          if (response.status === 404) {
            console.warn(`[AI Assistant] Gemini model ${modelToTry} not found (HTTP 404). Trying next model...`);
            lastError = new Error(`Gemini model ${modelToTry} not found (HTTP 404)`);
            break;
          }
          if (response.status === 400) {
            const retryCtrl = new AbortController();
            const retryTimer = setTimeout(() => retryCtrl.abort(), 15000);
            try {
              const fallbackRes = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": apiKey
                },
                signal: retryCtrl.signal,
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt + "\nReturn strictly a valid JSON object matching the requested schema." }] }],
                  generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 2048,
                    responseMimeType: "application/json"
                  }
                })
              });
              if (fallbackRes.ok) {
                const resJson = await fallbackRes.json();
                const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
                const parsed = parseAiJsonPayload(rawText);
                if (parsed) return { parsed, activeModel: modelToTry };
              }
            } catch (e) {
            } finally {
              clearTimeout(retryTimer);
            }
          }
          lastError = new Error(`Gemini API error ${response.status} (${modelToTry}): ${errText}`);
          if (attempt === 1 && (!crawlStartTime || (Date.now() - crawlStartTime) < 20000)) {
            console.warn(`[AI Assistant] Gemini attempt 1 on ${modelToTry} returned ${response.status}. Rechecking again...`);
            await new Promise(r => setTimeout(r, 400));
            continue;
          }
          break; // move to next model
        }

        const resJson = await response.json();
        const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error(`Empty response from Gemini model ${modelToTry}`);
        const parsed = parseAiJsonPayload(rawText);
        if (parsed) return { parsed, activeModel: modelToTry };
        throw new Error(`Failed to parse structured JSON from Gemini model ${modelToTry}`);
      } catch (err) {
        lastError = err;
        if (attempt === 1 && (!crawlStartTime || (Date.now() - crawlStartTime) < 20000)) {
          console.warn(`[AI Assistant] Gemini attempt 1 on ${modelToTry} failed (${err.message}). Rechecking again...`);
          await new Promise(r => setTimeout(r, 400));
          continue;
        }
      }
    }
  }
  throw lastError || new Error("All Gemini models failed to return structured data");
}

const _providerModelsCache = new Map();

async function fetchActiveChatModels(modelsEndpoint, apiKey, forceRefresh = false) {
  if (!modelsEndpoint || !apiKey) return { models: [], authError: "" };
  const cacheKey = `${modelsEndpoint}::${apiKey}`;
  const cached = !forceRefresh && _providerModelsCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < 600000) {
    return { models: cached.models, authError: "" };
  }

  try {
    const abortCtrl = new AbortController();
    const timer = setTimeout(() => abortCtrl.abort(), 4000);
    let res;
    try {
      res = await fetch(modelsEndpoint, {
        method: "GET",
        headers: { "Authorization": `Bearer ${apiKey}` },
        signal: abortCtrl.signal
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401 || res.status === 403) {
      return { models: [], authError: await res.text() };
    }
    if (!res.ok) return { models: [], authError: "" };
    const data = await res.json();
    const ids = (data && Array.isArray(data.data) ? data.data : [])
      .filter(m => m && m.id && m.active !== false)
      .filter(m => !Array.isArray(m.output_modalities) || m.output_modalities.includes("text"))
      .map(m => m.id)
      .filter(id => !/(?:whisper|tts|playai|guard|orpheus|safeguard|prompt-guard|compound-beta|mixtral|gemma2|llama-3\.3-70b)/i.test(id));
    const priorityOrder = [
      "llama-3.1-8b-instant"
    ];
    const ordered = [
      ...priorityOrder.filter(p => ids.includes(p)),
      ...ids.filter(id => !priorityOrder.includes(id))
    ];
    if (ordered.length > 0) {
      _providerModelsCache.set(cacheKey, { ts: Date.now(), models: ordered });
    }
    return { models: ordered, authError: "" };
  } catch (e) {
    return { models: [], authError: "" };
  }
}

async function resolveVerifiedChatModels(cfg, apiKey, preferredModel, forceRefresh = false) {
  const { models: liveModels, authError } = await fetchActiveChatModels(cfg.modelsEndpoint, apiKey, forceRefresh);
  if (authError) {
    return { models: [], authError };
  }
  if (liveModels.length > 0) {
    const cleanPref = String(preferredModel || "").trim();
    const queue = cleanPref && liveModels.includes(cleanPref)
      ? [cleanPref, ...liveModels.filter(m => m !== cleanPref)]
      : liveModels;
    return { models: queue, authError: "" };
  }
  return {
    models: Array.from(new Set([preferredModel, ...(cfg.models || [])])).filter(Boolean),
    authError: ""
  };
}

async function runOpenAiModelsWithFallback({ providerLabel, modelsEndpoint = "", apiKey, candidateModels, crawlStartTime = 0, attemptFn }) {
  let lastError = null;
  let isAuthError = false;
  const tried = new Set();
  let attemptIndex = 0;

  const tryModels = async (modelsList) => {
    for (const modelToTry of modelsList) {
      if (!modelToTry || tried.has(modelToTry)) continue;
      tried.add(modelToTry);

      if (crawlStartTime > 0 && (Date.now() - crawlStartTime) > 55000) {
        console.warn(`[AI Assistant] Total elapsed time (${Date.now() - crawlStartTime}ms) nearing limit. Halting ${providerLabel} calls.`);
        break;
      }

      const idx = attemptIndex++;
      try {
        const outcome = await attemptFn(modelToTry, idx);
        if (outcome && outcome.ok) {
          return { ok: true, value: outcome.value, activeModel: modelToTry };
        }
        if (outcome && outcome.authError) {
          isAuthError = true;
          lastError = outcome.error;
          break;
        }
        if (outcome && outcome.error) {
          lastError = outcome.error;
        }
      } catch (err) {
        lastError = err;
      }
    }
    return null;
  };

  // Direct chat/completions first using configured candidate models (no upfront /models call)
  const initialQueue = Array.from(new Set(candidateModels)).filter(Boolean).slice(0, 3);
  const directHit = await tryModels(initialQueue);
  if (directHit) return directHit;

  // Only query /models if direct attempts failed (excluding auth errors) to discover active models
  const withinBudget = !(crawlStartTime > 0 && (Date.now() - crawlStartTime) > 21000);
  if (!isAuthError && modelsEndpoint && withinBudget) {
    const { models: liveModels, authError } = await resolveVerifiedChatModels(
      { modelsEndpoint, models: candidateModels },
      apiKey,
      candidateModels[0],
      true
    );
    if (authError) {
      return { ok: false, isAuthError: true, error: new Error(`${providerLabel} authorization error 401: ${authError}`) };
    }
    const fallbackModels = liveModels.filter(m => !tried.has(m)).slice(0, 2);
    const fallbackHit = await tryModels(fallbackModels);
    if (fallbackHit) {
      return { ...fallbackHit, verifiedModels: liveModels };
    }
  }

  return { ok: false, isAuthError, error: lastError };
}

async function callOpenAiCompatibleApi({ providerLabel, endpoint, modelsEndpoint = "", apiKey, candidateModels, prompt, crawlStartTime = 0 }) {
  const result = await runOpenAiModelsWithFallback({
    providerLabel,
    modelsEndpoint,
    apiKey,
    candidateModels,
    crawlStartTime,
    attemptFn: async (modelToTry, idx) => {
      const sendChatRequest = async (useOptionalTuning) => {
        const abortCtrl = new AbortController();
        const timeoutPerModel = (idx === 0) ? 10000 : 6000;
        const abortTimer = setTimeout(() => abortCtrl.abort(), timeoutPerModel);
        const bodyPayload = {
          model: modelToTry,
          messages: [
            { role: "system", content: "You are a strict QC data-entry extractor. Always reply with a valid JSON object only." },
            { role: "user", content: prompt }
          ],
          temperature: 0,
          max_tokens: 1024
        };
        if (useOptionalTuning) {
          if (!/reasoner/i.test(modelToTry)) {
            bodyPayload.response_format = { type: "json_object" };
          }
          if (/gpt-oss/i.test(modelToTry)) {
            bodyPayload.reasoning_effort = "low";
          }
        }
        try {
          return await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            signal: abortCtrl.signal,
            body: JSON.stringify(bodyPayload)
          });
        } finally {
          clearTimeout(abortTimer);
        }
      };

      let response = await sendChatRequest(true);
      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 401 || response.status === 403) {
          return { authError: true, error: new Error(`${providerLabel} authorization error ${response.status}: ${errText}`) };
        }
        if (response.status === 400) {
          const retryRes = await sendChatRequest(false);
          if (retryRes.ok) {
            const retryJson = await retryRes.json();
            const rawRetry = retryJson?.choices?.[0]?.message?.content;
            const parsed = parseAiJsonPayload(rawRetry);
            if (parsed) return { ok: true, value: parsed };
          }
        }
        return { error: new Error(`${providerLabel} API error ${response.status} (${modelToTry}): ${errText}`) };
      }

      const resJson = await response.json();
      const rawText = resJson?.choices?.[0]?.message?.content;
      if (!rawText) {
        return { error: new Error(`Empty response from ${providerLabel} model ${modelToTry}`) };
      }
      const parsed = parseAiJsonPayload(rawText);
      if (parsed) return { ok: true, value: parsed };
      return { error: new Error(`Invalid JSON payload from ${providerLabel} model ${modelToTry}`) };
    }
  });

  if (result && result.ok) {
    return { parsed: result.value, activeModel: result.activeModel };
  }
  throw (result && result.error) || new Error(`All ${providerLabel} models failed to return structured data`);
}

async function analyzeWithAi(crawlData, aiConfig = {}, restrictedCheck = null, crawlStartTime = 0) {
  const apiKey = String(aiConfig.apiKey || "").trim();
  const normalized = normalizeProviderAndModel(aiConfig.provider || "gemini", apiKey, aiConfig.model);

  if (normalized.provider === "groq") {
    const cfg = AI_PROVIDERS.groq;
    const prompt = buildExtractionPrompt(crawlData, true);
    const candidateModels = Array.from(new Set([normalized.model, ...cfg.models])).filter(Boolean);
    const { parsed, activeModel } = await callOpenAiCompatibleApi({
      providerLabel: cfg.label,
      endpoint: cfg.endpoint,
      modelsEndpoint: cfg.modelsEndpoint,
      apiKey,
      candidateModels,
      prompt,
      crawlStartTime
    });
    parsed._aiProvider = cfg.label;
    parsed._aiModel = activeModel;

    // Cache latest API payload for 1-click clipboard copying
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          lastApiPayload: {
            url: crawlData.finalUrl || crawlData.originalUrl || "",
            timestamp: Date.now(),
            provider: "groq",
            model: activeModel,
            requestBody: {
              model: activeModel,
              messages: [{ role: "user", content: prompt }],
              temperature: 0,
              response_format: { type: "json_object" }
            }
          }
        });
      }
    } catch (e) { }

    // Persist active verified Groq model if previously saved one was unavailable
    if (activeModel && activeModel !== normalized.model && typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      try { chrome.storage.sync.set({ groqModel: activeModel }); } catch (e) { }
    }
    return finalizeParsedAiResult(parsed, crawlData);
  }

  const prompt = buildExtractionPrompt(crawlData, false);
  const reqModel = normalized.model || DEFAULT_MODEL;
  const verifiedGeminiFallbacks = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash"];
  // Prioritize requested model, followed immediately by active production Gemini models
  const candidateModels = Array.from(new Set([reqModel, ...verifiedGeminiFallbacks, ...GEMINI_MODELS])).filter(Boolean).slice(0, 5);
  const { parsed, activeModel } = await callGeminiExtractionApi({
    apiKey,
    candidateModels,
    prompt,
    crawlStartTime
  });
  parsed._aiProvider = "Gemini";
  parsed._aiModel = activeModel;

  // Cache latest API payload for 1-click clipboard copying
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        lastApiPayload: {
          url: crawlData.finalUrl || crawlData.originalUrl || "",
          timestamp: Date.now(),
          provider: "gemini",
          model: activeModel || reqModel,
          requestBody: buildGeminiRequestBody(prompt)
        }
      });
    }
  } catch (e) { }

  return finalizeParsedAiResult(parsed, crawlData);
}

async function analyzeWithGemini(crawlData, apiKey, modelName, restrictedCheck, crawlStartTime = 0) {
  return analyzeWithAi(crawlData, { provider: "gemini", apiKey, model: modelName }, restrictedCheck, crawlStartTime);
}

/**
 * Generates the complete JSON API payload (prompt + schema + parameters)
 * for the given website URL or retrieves the latest cached API payload.
 * Formatted as ready-to-use JSON for Google AI Studio, Postman, or curl.
 */
async function generateApiPayload(rawUrl = "", options = {}) {
  let targetUrl = (rawUrl && typeof rawUrl === "string") ? rawUrl.trim() : "";

  // 1. If no URL provided, return latest cached API payload if available
  if (!targetUrl) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        const stored = await chrome.storage.local.get(["lastApiPayload"]);
        if (stored && stored.lastApiPayload && stored.lastApiPayload.requestBody) {
          const p = stored.lastApiPayload;
          const str = JSON.stringify(p.requestBody, null, 2);
          return {
            success: true,
            cached: true,
            url: p.url,
            provider: p.provider,
            model: p.model,
            payload: p.requestBody,
            payloadString: str,
            charCount: str.length,
            promptTokenEstimate: Math.round(str.length / 4)
          };
        }
      } catch (e) { }
    }
    return {
      success: false,
      error: "No website URL provided. Please enter or detect a website URL first."
    };
  }

  // 2. Check if cached payload matches the requested URL (instant copy without recrawl)
  if (!options.forceFresh && typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      const stored = await chrome.storage.local.get(["lastApiPayload"]);
      if (stored && stored.lastApiPayload && stored.lastApiPayload.requestBody && stored.lastApiPayload.url === targetUrl) {
        const p = stored.lastApiPayload;
        const str = JSON.stringify(p.requestBody, null, 2);
        return {
          success: true,
          cached: true,
          url: p.url,
          provider: p.provider,
          model: p.model,
          payload: p.requestBody,
          payloadString: str,
          charCount: str.length,
          promptTokenEstimate: Math.round(str.length / 4)
        };
      }
    } catch (e) { }
  }

  // 3. Load provider & model settings
  let settings = {};
  if (typeof chrome !== "undefined" && chrome.storage) {
    try {
      const sync = chrome.storage.sync ? await chrome.storage.sync.get(null) : {};
      const local = chrome.storage.local ? await chrome.storage.local.get(null) : {};
      settings = { ...(sync || {}), ...(local || {}) };
    } catch (e) { }
  }
  const aiConfig = resolveAiProviderConfig(settings);
  const apiKey = String(aiConfig.apiKey || "").trim();
  const normalized = normalizeProviderAndModel(aiConfig.provider || "gemini", apiKey, aiConfig.model);

  // 4. Crawl website to get authentic evidence for the prompt
  let crawlResult;
  try {
    crawlResult = await crawlWebsite(targetUrl, {
      maxPages: settings.maxPages || settings.crawlPageLimit || 5,
      maxCrawlTimeMs: 8000
    });
  } catch (crawlErr) {
    // If crawl fails, build fallback minimal crawl structure
    crawlResult = {
      originalUrl: targetUrl,
      finalUrl: targetUrl,
      title: cleanDomainStem(targetUrl),
      mainHtml: `<html><body><h1>${cleanDomainStem(targetUrl)}</h1></body></html>`,
      combinedText: targetUrl,
      addressCandidates: [],
      emails: [],
      phones: [],
      productItems: [],
      detectedProductCount: 0,
      detectedImageCount: 0,
      detectedDescCount: 0
    };
  }

  // 5. Construct Prompt & API Request Body
  const isGroq = normalized.provider === "groq";
  const prompt = buildExtractionPrompt(crawlResult, isGroq);
  const activeModel = normalized.model || (isGroq ? "llama-3.1-8b-instant" : DEFAULT_MODEL);

  const requestBody = isGroq
    ? {
      model: activeModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      response_format: { type: "json_object" }
    }
    : buildGeminiRequestBody(prompt);

  const payloadRecord = {
    url: targetUrl,
    timestamp: Date.now(),
    provider: normalized.provider,
    model: activeModel,
    requestBody
  };

  // Cache in storage for instant re-access
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    try {
      await chrome.storage.local.set({ lastApiPayload: payloadRecord });
    } catch (e) { }
  }

  const payloadString = JSON.stringify(requestBody, null, 2);
  return {
    success: true,
    cached: false,
    url: targetUrl,
    provider: normalized.provider,
    model: activeModel,
    payload: requestBody,
    payloadString: payloadString,
    charCount: payloadString.length,
    promptTokenEstimate: Math.round(payloadString.length / 4)
  };
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


function isSeoSloganOrTagline(name) {
  if (!name || typeof name !== "string") return false;
  const n = name.trim();
  if (typeof hasCompleteLegalSuffix === "function" && hasCompleteLegalSuffix(n)) return false;
  if (/\b(?:pty\s*ltd|limited|inc|incorporated|llc|gmbh|sdn\s*bhd)\b/i.test(n)) return false;

  // Generic navigation and non-company page names
  if (/^(?:home(\s+page)?|welcome(\s+to.*)?|about(\s+us|\s+our\s+company)?|contact(\s+us)?|products?(\s*(?:and|&)\s*services?)?|services?|our\s+services?|our\s+products?|overview|index|online\s*store|shop(\s*online)?|catalog|catalogue|privacy\s*policy|terms(\s*(?:and|&)\s*conditions)?|frequently\s*asked\s*questions|faq|blog|news|portfolio|gallery|search|sitemap|logo)$/i.test(n)) {
    return true;
  }

  // Promotional slogans & adjectives
  if (/^(?:expert|best|leading|professional|premier|top|specialist|quality|affordable|cheap|reliable|trusted)\b/i.test(n)) {
    return true;
  }

  // Geographic context taglines
  if (/\b(?:in\s+(?:canberra|sydney|melbourne|brisbane|perth|adelaide|hobart|darwin|gold\s*coast|newcastle|london|new\s*york|chicago|los\s*angeles|taiwan|australia|singapore|malaysia|the\s+uk|europe|asia|north\s*america))\b/i.test(n)) {
    return true;
  }

  // Functional descriptions: "Manufacturer of...", "Supplier of...", "Specialists in..."
  if (/^(?:(?:leading|premier|trusted|global|quality|custom|reliable|expert)\s+)?(?:manufacturers?|suppliers?|wholesalers?|distributors?|makers?|installers?|builders?|contractors?|fabricators?|producers?|stockists?|exporters?|traders?)\s+(?:of|for|and)\b/i.test(n)) {
    return true;
  }
  if (/^(?:specialists?|specializing|leaders?|excellence|solutions?|innovations?|experts?|dedicated|custom|high\s*quality|precision|world\s*class|your\s*trusted)\s+in\b/i.test(n)) {
    return true;
  }
  if (/^(?:design|manufacture|production|fabrication|sales?|supply|installation|distribution)\s+(?:and|&)\s+(?:manufacture|production|fabrication|sales?|supply|installation|service|distribution)\s+of\b/i.test(n)) {
    return true;
  }
  if (/^(?:your\s+(?:trusted\s+)?partner|we\s+(?:provide|offer|manufacture|supply|specialize|deliver|create|build))\b/i.test(n)) {
    return true;
  }

  return false;
}

function scoreTitleSegment(segment, domainStem, logoText, ogSiteName) {
  const segLower = segment.toLowerCase().trim();
  let score = 0;
  if (isSeoSloganOrTagline(segment)) {
    score -= 100;
  }
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
  if (!title) return logoText || ogSiteName || (domain ? toTitleCase(cleanDomainStem(domain)) : "");
  if (/(?:attention required|just a moment|access denied|403 forbidden|404 not found|security check|cloudflare|ddos protection)/i.test(title)) {
    return domain ? toTitleCase(cleanDomainStem(domain)) : "";
  }
  const parts = title.split(/[-–—|:•]/).map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    const single = parts[0] || "";
    if (isSeoSloganOrTagline(single) || /^(?:home|welcome|about\s*us|contact\s*us|products?|services?)$/i.test(single)) {
      return domain ? toTitleCase(cleanDomainStem(domain)) : "";
    }
    return single;
  }
  const domainStem = cleanDomainStem(domain);
  let bestPart = "";
  let bestScore = -999;
  for (let part of parts) {
    const cleanedPart = part.replace(/^(?:welcome\s+to\s+|welcome\s*[-–—|:•]\s*)/i, "").trim();
    if (/^(?:home(\s+page)?|welcome|about(\s+us)?|contact(\s+us)?|index|official\s*website)$/i.test(cleanedPart)) continue;
    if (/(?:attention required|just a moment|access denied|403 forbidden|404 not found|security check|cloudflare|ddos protection)/i.test(cleanedPart)) continue;
    if (isSeoSloganOrTagline(cleanedPart)) continue;
    const candidate = cleanedPart || part;
    const s = scoreTitleSegment(candidate, domainStem, logoText, ogSiteName);
    if (s > bestScore) {
      bestScore = s;
      bestPart = candidate;
    }
  }
  if (!bestPart || bestScore <= -50) {
    if (domainStem) return toTitleCase(domainStem);
  }
  return bestPart || parts[0] || "";
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
  const text = crawlData.combinedText || "";

  // 1. Company Name: prefer official company candidates with legal suffixes matching domain
  let companyName = "";
  const domainStem = cleanDomainStem(crawlData.finalUrl || crawlData.originalUrl);

  if (crawlData.legalCompanyCandidates && crawlData.legalCompanyCandidates.length > 0) {
    for (const cand of crawlData.legalCompanyCandidates) {
      const cleaned = cleanCompanyPrefixesAndSuffixes(cand);
      if (cleaned && !hasCompanyProseNoise(cleaned) && hasCompleteLegalSuffix(cleaned)) {
        const cStem = cleanDomainStem(cleaned.replace(/\b(?:pty|ltd|limited|proprietary|inc|llc|corp|co|gmbh|se)\b/gi, ""));
        if (cStem && (cStem === domainStem || cStem.includes(domainStem) || domainStem.includes(cStem))) {
          companyName = cleaned;
          break;
        }
      }
    }
  }

  // 1b. Check if logoText or title brand matches the domain stem (Brand takes priority over unrelated third-party legal candidates)
  if (!companyName && crawlData.logoText && !isSeoSloganOrTagline(crawlData.logoText)) {
    const lStem = cleanDomainStem(crawlData.logoText);
    if (lStem && (lStem === domainStem || lStem.includes(domainStem) || domainStem.includes(lStem))) {
      companyName = cleanCompanyPrefixesAndSuffixes(crawlData.logoText);
    }
  }

  if (!companyName && crawlData.title) {
    const tBrand = extractBestBrandFromTitle(crawlData.title, crawlData.finalUrl || crawlData.originalUrl, crawlData.logoText, crawlData.ogSiteName);
    const tStem = cleanDomainStem(tBrand);
    if (tStem && (tStem === domainStem || tStem.includes(domainStem) || domainStem.includes(tStem))) {
      companyName = cleanCompanyPrefixesAndSuffixes(tBrand);
    }
  }

  if (!companyName && typeof preferOfficialCompanyName === "function") {
    companyName = preferOfficialCompanyName("", crawlData);
  }

  if (!companyName && crawlData.copyrightText) {
    const cleanedCopy = cleanCompanyPrefixesAndSuffixes(crawlData.copyrightText);
    if (cleanedCopy && !hasCompanyProseNoise(cleanedCopy) && (hasCompleteLegalSuffix(cleanedCopy) || /\b(ltd|limited|inc|llc|llp|corp|pty|pte|pvt|sdn|bhd|gmbh|plc|se|co\.?)\b/i.test(cleanedCopy))) {
      companyName = cleanedCopy;
    }
  }

  if (!companyName && crawlData.legalCompanyCandidates && crawlData.legalCompanyCandidates.length > 0) {
    for (const cand of crawlData.legalCompanyCandidates) {
      const cleaned = cleanCompanyPrefixesAndSuffixes(cand);
      if (cleaned && !hasCompanyProseNoise(cleaned) && hasCompleteLegalSuffix(cleaned)) {
        companyName = cleaned;
        break;
      }
    }
  }

  if (!companyName && crawlData.logoText && !isSeoSloganOrTagline(crawlData.logoText)) {
    companyName = cleanCompanyPrefixesAndSuffixes(crawlData.logoText);
  }

  if (!companyName && crawlData.title) {
    companyName = cleanCompanyPrefixesAndSuffixes(extractBestBrandFromTitle(crawlData.title, crawlData.finalUrl || crawlData.originalUrl, crawlData.logoText, crawlData.ogSiteName));
  }

  // Fallback to domain stem if still empty, generic navigation word, or slogan
  if (!companyName || isSeoSloganOrTagline(companyName) || /^(?:home(\s+page)?|welcome|about(\s+us)?|contact(\s+us)?|products?(\s*(?:and|&)\s*services?)?|services?)$/i.test(companyName)) {
    if (domainStem) companyName = toTitleCase(domainStem);
  }

  // Restore legal corporate designation if omitted
  if (companyName && typeof restoreLegalSuffixIfOmitted === "function") {
    companyName = restoreLegalSuffixIfOmitted(companyName, crawlData);
  }

  // Expand abbreviations in Company Name per Rule 4
  if (companyName) {
    companyName = expandCompanyAbbreviations(companyName, "");
    companyName = cleanCompanyPrefixesAndSuffixes(companyName);
    companyName = toTitleCase(companyName);
    companyName = restoreCommaBeforeCorporateSuffix(companyName, crawlData);
    companyName = restoreOriginalSymbolsInCompanyName(companyName, crawlData);
    companyName = stripBoundarySpecialChars(companyName);
  }

  // 2. Company Address: verified candidate from contact page or footer
  let address = "";
  let selectedCandidate = null;
  if (crawlData.addressCandidates && crawlData.addressCandidates.length > 0) {
    const verified = typeof verifyAndSelectAddress === "function"
      ? verifyAndSelectAddress("", crawlData.addressCandidates, crawlData)
      : null;
    address = (typeof verified === "object" && verified !== null && verified.address !== undefined)
      ? verified.address
      : (typeof verified === "string" ? verified : "");
    selectedCandidate = (typeof verified === "object" && verified !== null)
      ? verified.selectedCandidate
      : null;
  }
  if (!address || address.toLowerCase() === "not available" || address.length < 6) {
    address = typeof extractLikelyAddress === "function"
      ? extractLikelyAddress(crawlData.contactPageText || crawlData.footerText || text)
      : "";
  }

  // 3. Country: resolve using address, candidates, phone calling code, domain ccTLD, and text evidence
  let country = typeof resolveCountryFromAllEvidence === "function"
    ? resolveCountryFromAllEvidence("", address, crawlData)
    : (typeof detectCountryFromAddress === "function" ? detectCountryFromAddress(address) : "");
  if (/^(?:united\s*kingdom|great\s*britain|uk|england|scotland|wales|northern\s*ireland)$/i.test((country || "").trim())) {
    country = typeof resolveUkCountryName === "function" ? resolveUkCountryName(country, address, crawlData) : "United Kingdom";
  }

  // Sanitize Company Address per Rule 6 (using fully normalized companyName and resolved country)
  if (address) {
    address = typeof sanitizeRule6CompanyAddress === "function"
      ? sanitizeRule6CompanyAddress(address, companyName, country, crawlData)
      : address;
  }

  // Re-verify company name abbreviation expansions with resolved country
  if (companyName && country) {
    companyName = expandCompanyAbbreviations(companyName, country);
    companyName = toTitleCase(companyName);
    companyName = restoreCommaBeforeCorporateSuffix(companyName, crawlData);
    companyName = restoreOriginalSymbolsInCompanyName(companyName, crawlData);
    companyName = stripBoundarySpecialChars(companyName);
  }

  // 4. Email & Secondary Email: select valid corporate emails
  const validEmails = (crawlData.emails || []).map(e => stripTrailingContactWordsFromEmail(String(e || "").trim().toLowerCase()))
    .filter(e => e && isValidCorporateEmail(e) && !isUnwantedEmail(e));

  let emailId = "";
  if (validEmails.length > 0) {
    const domainStem = cleanDomainStem(crawlData.finalUrl || crawlData.originalUrl);
    const domainMatch = validEmails.find(e => {
      const h = (e.split("@")[1] || "").toLowerCase();
      const u = (e.split("@")[0] || "").toLowerCase();
      return (h.includes(domainStem) || domainStem.includes(h.split(".")[0])) && /^(?:info|sales|contact|enquir|office|hello|mail)/.test(u);
    });
    emailId = domainMatch || validEmails[0];
  }

  let secondaryEmailId = "";
  if (emailId) {
    const secCandidate = validEmails.find(e => e !== emailId && e !== ("mailto" + emailId));
    secondaryEmailId = secCandidate || "";
  }

  // 5. Phone Number: Country-specific cleaned phone number
  let phoneNumber = "";
  if (crawlData.phones && crawlData.phones.length > 0) {
    for (const p of crawlData.phones) {
      const cleaned = cleanPhoneNumber(p, country);
      if (cleaned) {
        phoneNumber = cleaned;
        break;
      }
    }
  }

  // Own-crawl product count (never uses Gemini; all 3 product fields stay identical)
  let ownProdCount = computeOwnCrawlProductCount(crawlData);
  let prodCount = ownProdCount;
  let imgCount = ownProdCount;
  let descCount = ownProdCount;

  let hasState = address && hasStateInAddress(address, country);
  let hasCity = address && hasCityInAddress(address, country);

  const isGenuineRestricted = !!(restrictedCheck && restrictedCheck.isRestricted);
  if (isGenuineRestricted) {
    const errorUrl = (restrictedCheck && (restrictedCheck.sourceUrl || restrictedCheck.matched_page)) || crawlData.finalUrl || crawlData.originalUrl || "";
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
      errorCategory: "Prohibited Category",
      errorKeyword: (restrictedCheck && (restrictedCheck.matchedKeyword || restrictedCheck.matched_keyword)) || "",
      errorSourceUrl: errorUrl,
      errorSnippet: (restrictedCheck && (restrictedCheck.snippet || restrictedCheck.matched_context)) || "",
      notWorkingReason: (restrictedCheck && restrictedCheck.reason) || "Prohibited Category Detected",
      restrictedReason: (restrictedCheck && restrictedCheck.reason) || "Prohibited Category Detected",
      restrictedKeyword: (restrictedCheck && (restrictedCheck.matchedKeyword || restrictedCheck.matched_keyword)) || "",
      restrictedCategory: (restrictedCheck && (restrictedCheck.category || restrictedCheck.restricted_category)) || "",
      restrictedSourceUrl: errorUrl,
      restrictedSnippet: (restrictedCheck && (restrictedCheck.snippet || restrictedCheck.matched_context)) || "",
      isRestricted: true,
      isProhibitedSite: true
    };
  }
  let inferredBusiness = isGenuineRestricted
    ? "Restricted Site"
    : inferBusinessTypeFromEvidence(text, crawlData.mainHtml || "");
  if (!inferredBusiness && !isGenuineRestricted) {
    if (typeof checkPhysicalProductSupplier === "function" && checkPhysicalProductSupplier(crawlData, { companyAddress: address })) {
      inferredBusiness = "Supplier";
    } else if (prodCount !== "0" || (address && (emailId || phoneNumber))) {
      inferredBusiness = "Manufacturer";
    }
  }

  const shopCartCheck = crawlData.shopCartCheck || detectPurchaseOrShoppingCart((crawlData.mainHtml || "") + "\n" + (crawlData.contactHtml || ""), crawlData.bodyText || "");
  const isDiffDomain = isRedirectDomain(crawlData.originalUrl, crawlData.finalUrl);
  // Preserving manufacturer exception (Rules 11 & 16: Manufacturers with online store/cart are eligible!)
  const isMfg = inferredBusiness === "Manufacturer" || (typeof isManufacturerFromEvidence === "function" && isManufacturerFromEvidence(crawlData));
  const isNonMfgShopCart = !!(shopCartCheck && shopCartCheck.detected && !isMfg);
  let websiteStatus = isDiffDomain ? "Redirect Site" : (isNonMfgShopCart ? "Not Working" : (crawlData.status || crawlData.initialStatus || "Working"));

  // Rule 1: A supplier with no displayed products can still be classified as Supplier with product count 0 and submitted as Non-Paid!
  // Only mark Not Working if website has 0 products AND has NO physical address AND NO contact information at all, and is NOT an eligible supplier.
  const hasContactEvidence = !!(address || emailId || phoneNumber);
  const isSupplier = inferredBusiness === "Supplier" || (typeof checkPhysicalProductSupplier === "function" && checkPhysicalProductSupplier(crawlData, { companyAddress: address }));
  const isZeroProdUnverifiable = !isDiffDomain && !isSupplier && ((!address && prodCount === "0") || (!hasContactEvidence && prodCount === "0"));
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

  if (isDiffDomain) {
    websiteStatus = "Redirect Site";
    if (!companyName || /(?:attention required|just a moment|access denied|403 forbidden|security check|cloudflare)/i.test(companyName)) {
      companyName = toTitleCase(cleanDomainStem(crawlData.finalUrl || crawlData.originalUrl));
    }
    if (!inferredBusiness) {
      inferredBusiness = "Manufacturer";
    }
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
    shopCartReason: (shopCartCheck && shopCartCheck.reason) || "",
    _selectedAddressCandidate: selectedCandidate
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
 * Prioritizes legal candidates / exact legal suffix matches on Home, About Us, and Contact pages
 * over repeating headers/footers or low-quality terms/privacy/policy/faq pages.
 */

async function testAiProviderKey({ provider = "gemini", apiKey = "", modelName = "" } = {}) {
  const cleanKey = String(apiKey || "").trim();
  const normalized = normalizeProviderAndModel(provider, cleanKey, modelName);
  const cleanProvider = normalized.provider;

  if (cleanProvider === "groq") {
    const cfg = AI_PROVIDERS.groq;
    if (!cleanKey) {
      return { success: false, error: `Please enter a valid ${cfg.label} API key (starts with gsk_).` };
    }
    const candidateModels = Array.from(new Set([normalized.model, ...(cfg.models || [])])).filter(Boolean);
    const result = await runOpenAiModelsWithFallback({
      providerLabel: cfg.label,
      modelsEndpoint: cfg.modelsEndpoint,
      apiKey: cleanKey,
      candidateModels,
      attemptFn: async (model) => {
        const abortCtrl = new AbortController();
        const abortTimer = setTimeout(() => abortCtrl.abort(), 5000);
        let res;
        try {
          res = await fetch(cfg.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${cleanKey}`
            },
            signal: abortCtrl.signal,
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: "Reply with OK" }],
              max_tokens: 10,
              temperature: 0.7
            })
          });
        } finally {
          clearTimeout(abortTimer);
        }
        if (res.ok) {
          return { ok: true, value: true };
        }
        const errText = await res.text();
        if (res.status === 401 || res.status === 403) {
          return { authError: true, error: new Error(`API HTTP ${res.status}: ${errText}`) };
        }
        return { error: new Error(`API HTTP ${res.status} (${model}): ${errText}`) };
      }
    });

    if (result && result.ok) {
      const response = {
        success: true,
        provider: "groq",
        message: `Connected successfully with Groq (${result.activeModel})!`,
        activeModel: result.activeModel
      };
      if (Array.isArray(result.verifiedModels) && result.verifiedModels.length > 0) {
        response.availableModels = result.verifiedModels;
      }
      return response;
    }
    return { success: false, error: (result && result.error && result.error.message) || "Failed to connect with Groq" };
  }

  const effectiveKey = cleanKey || DEFAULT_API_KEY;
  if (!effectiveKey) {
    return { success: false, error: "Please enter a valid Gemini API key." };
  }
  const selected = modelName || DEFAULT_MODEL;
  const modelsToTry = Array.from(new Set([selected, ...GEMINI_MODELS])).filter(Boolean).slice(0, 2);
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(effectiveKey)}`;
      const abortCtrl = new AbortController();
      const abortTimer = setTimeout(() => abortCtrl.abort(), 4000);
      let res;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": effectiveKey
          },
          signal: abortCtrl.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Hello! Reply with 'OK'" }] }]
          })
        });
      } finally {
        clearTimeout(abortTimer);
      }
      if (res.ok) {
        return { success: true, provider: "gemini", message: `Connected successfully with Gemini (${model})!`, activeModel: model };
      }
      const err = await res.text();
      lastError = `API HTTP ${res.status}: ${err}`;
      if (res.status === 401 || res.status === 403) break;
    } catch (e) {
      lastError = e.message;
    }
  }

  return { success: false, error: lastError || "Failed to connect with any Gemini model" };
}

async function testGeminiApiKey(apiKey, modelName = DEFAULT_MODEL) {
  return testAiProviderKey({ provider: "gemini", apiKey, modelName });
}

/**
 * Builds the official Strict Website Restricted Category Detection & QC Validation Prompt.
 */
function buildRestrictedCategoryPrompt(crawlData, siteUrl = "") {
  const url = siteUrl || crawlData.finalUrl || crawlData.originalUrl || "";
  const compactSlice = (text, maxLen) => String(text || "").replace(/\s+/g, " ").trim().slice(0, maxLen);
  const bodyText = compactSlice(crawlData.bodyText, 3500);
  const contactText = compactSlice(crawlData.contactPageText || crawlData.dedicatedContactText, 1500);
  const profileText = compactSlice(crawlData.profilePageText, 1500);
  const footerText = compactSlice(crawlData.footerText, 800);
  const renderedText = compactSlice(crawlData.renderedText, 1500);

  return `# Strict Website Restricted Category Detection & QC Validation Prompt

## 1. Role
You are a strict website eligibility and restricted-category validation engine.
Your responsibility is to identify websites that are related to prohibited business categories or contain restricted products, services, images, or content.

Primary instruction: Do not work on websites related to any restricted category listed below. If a website is genuinely related to a restricted category, reject it even if the restricted content appears on only one page, in a product listing, in an image, in a menu, or in another section of the website.
Do not extract company information or products from restricted websites.

## 2. Restricted Categories
The following 13 categories are strictly prohibited:

### Category 1: Porn & Adult
- Pornographic websites and videos.
- Adult entertainment businesses.
- Sexually explicit content or services.
- Pornographic products and services.
- Explicit sexual images or videos.

### Category 2: Medicine & Medical
- Medicine manufacturers, suppliers, traders, and distributors.
- Pharmaceutical products and businesses.
- Medical equipment and medical device businesses.
- Medical supplies and healthcare product manufacturers.
- Medical treatment products and services.
- Medical-related product catalogues.

### Category 3: Hospital & Healthcare
- Hospitals and clinics.
- Healthcare centres.
- Nursing homes.
- Medical laboratories and diagnostic centres.
- Healthcare service providers.
- Hospital equipment and hospital supply businesses.

### Category 4: Food
- Food manufacturers and suppliers.
- Food products and ingredients.
- Meat, seafood, dairy, bakery, and beverage food businesses.
- Food processing and packaging.
- Food wholesalers, exporters, and distributors.
- Food-related product catalogues.

### Category 5: Weapons & Knives
- Weapons manufacturers and suppliers.
- Knives, swords, daggers, and blades.
- Firearms and ammunition.
- Military weapons and weapon accessories.
- Defence weapons and tactical equipment.
- Weapon repair and maintenance businesses.

### Category 6: Defence
- Defence manufacturers and suppliers.
- Military equipment and military technology.
- Defence contractors and defence products.
- Military vehicles and systems.
- Defence-related manufacturing and services.

### Category 7: Aircraft & Aviation
- Aircraft manufacturers and suppliers.
- Aircraft components and spare parts.
- Aviation equipment and products.
- Airlines and aviation businesses.
- Aircraft maintenance and repair.
- Aircraft-related manufacturing.

### Category 8: Aerospace
- Aerospace manufacturers and suppliers.
- Spacecraft and satellite manufacturing.
- Aerospace components and materials.
- Rocket and propulsion systems.
- Aerospace engineering products and equipment.

### Category 9: Marine
- Marine equipment and products.
- Marine manufacturers and suppliers.
- Marine engineering and maintenance.
- Marine navigation and propulsion equipment.
- Marine industry-related product catalogues.

### Category 10: Ship & Shipbuilding
- Ship manufacturers and shipbuilders.
- Ship repair and maintenance.
- Ship components and spare parts.
- Shipbuilding equipment.
- Vessels, boats, and marine transportation products.

### Category 11: Chemical
- Chemical manufacturers and suppliers.
- Industrial chemical products.
- Chemical raw materials.
- Hazardous chemical products.
- Chemical processing and chemical distribution.
- Chemical product catalogues.

### Category 12: Alcohol
- Alcohol manufacturers and suppliers.
- Beer, wine, and liquor businesses.
- Alcoholic beverage distributors and exporters.
- Alcohol production and processing.
- Alcohol-related product catalogues.

### Category 13: Animals
- Animal trading and animal supply businesses.
- Live animal sales.
- Animal breeding and commercial animal businesses.
- Animal product manufacturers and suppliers.
- Animal-related product catalogues.
- Wildlife trading businesses.

## 3. Website-Wide Validation
Check all accessible website sections: Homepage, About Us, Products, Services, Categories, Product detail pages, Image galleries, Downloads and catalogues, Contact Us, Footer, and navigation menus.
Check visible text, product names, descriptions, image filenames, image ALT text, image titles, and actual image content when available.
If any accessible section confirms that the website is genuinely related to a restricted category, reject the entire website.

## 4. Strict Keyword and Image Detection
Search for category-related keywords and images. If a restricted product or category is confirmed anywhere on the website, classify the website as Restricted.

## 5. False-Positive Prevention
Do not reject a website merely because a restricted word appears in an unrelated context.
- "Adult learning", "adult education", "adult students", "responsible adult", "adult of legal age" in terms/policies, and "adult clothing / sizes / helmets" is not pornography.
- "Medical attention" in an unrelated safety disclaimer (MSDS/SDS) or "medical insurance / benefits" on a careers page is not a medical business.
- "Food for thought" is not a food business; machinery/conveyors/packaging supplied to food plants is not a food business.
- "Chemical reaction" in educational text, or "chemical-resistant" materials/coatings/tanks or "solvent-free" adhesives is not a chemical manufacturer.
- "Animal kingdom" as an idiom, or "cruelty-free / not tested on animals", or "PET bottles / PET plastics (Polyethylene Terephthalate)" is not animal trading/sales.
- "Defence against cyber attacks", "pest defense", or "defensive driving" is not military defence.
- "We ship worldwide", "shipping policy", "family ownership", "partnership", or "industrial pressure vessels" is not shipbuilding.
- "Knife-edge technology", "knife gate valves", machine slitter knives, granulator knives, or air knives is not a weapon/knife product.
- "Horse power engine", "horsepower", "100 hp" is an engineering mechanical engine/motor power metric, NOT live animals or pets.
- Industrial tools and workshop equipment such as "pipe gun", "grease gun", "heat gun", "spray gun", "paint gun", "glue gun", "nail gun", "caulking gun", "foam gun", "rivet gun", "blow gun", "air gun", "staple gun", "stud gun", "barcode gun", "temperature gun", or precision machining processes like "gun drilling", "gun drill", "gun reamer", "gun boring", "gun tap" are industrial machinery and workshop tools, NOT weapons or firearms.
- "Aircraft mode", "aircraft-grade aluminum" or titanium fasteners used in aircraft is not an aircraft manufacturer.
- "Satellite office" or "satellite branch" is a corporate physical branch location, NOT orbital aerospace spacecraft.
- "Whiskey Creek" as a project location or color name, "spirit level" as a leveling hand tool, or "cotton gin" as an agricultural machine is not alcohol.

Important distinction:
- A genuine restricted product, image, service, or business relationship is sufficient for rejection.
- An incidental word, metaphor, unrelated sentence, served-industry mention, or material resistance claim is NOT sufficient by itself.
- Evaluate images in context. Do not reject an unrelated image merely because its filename or ALT text contains a matching keyword.

## 6. Decision Rules
Use these decisions:
1. Restricted – Reject: A restricted product, service, image, or business activity is confirmed anywhere on the accessible website.
2. False Positive – Do Not Reject: A keyword appears only in an unrelated context and no restricted business activity or content is confirmed.
3. Manual Review: Evidence is unclear, an image cannot be identified, a page cannot be accessed, or a keyword match cannot be verified.
4. Not Working: Use only when the website is genuinely inaccessible under the website-status rules. Never use this status just because a restricted keyword was found.

If a restricted category is confirmed, stop extraction immediately and do not collect company details or product information.

## 7. Evidence Requirements
For every restricted rejection, return:
- Website URL.
- Restricted category.
- Exact source page URL.
- Exact matching product, service, or content.
- Image URL, if applicable.
- Evidence type: Business Activity / Product / Service / Image / Website Content.
- Short explanation of why it qualifies.
- Final QC decision.

Never invent evidence or claim to have inspected an image or page that was not actually accessible.

## 8. Required JSON Output
Return valid JSON only:

When restricted:
{
  "website_url": "${url}",
  "website_status": "Working",
  "restricted": true,
  "restricted_category": "Category Name",
  "classification": "Restricted - Reject",
  "evidence_type": "Product",
  "matched_keyword": "keyword",
  "matched_text": "context snippet",
  "source_url": "https://...",
  "image_url": "https://... or empty string",
  "reason": "explanation",
  "final_decision": "Reject",
  "manual_review_required": false
}

When false positive:
{
  "website_url": "${url}",
  "website_status": "Working",
  "restricted": false,
  "restricted_category": null,
  "classification": "False Positive",
  "evidence_type": "Website Content",
  "matched_keyword": "keyword",
  "matched_text": "context snippet",
  "source_url": "https://...",
  "image_url": "",
  "reason": "explanation",
  "final_decision": "Do Not Reject",
  "manual_review_required": false
}

When unclear evidence:
{
  "website_url": "${url}",
  "website_status": "Working",
  "restricted": null,
  "restricted_category": "Category Name",
  "classification": "Manual Review",
  "evidence_type": "Image",
  "matched_keyword": "keyword",
  "matched_text": "context snippet",
  "source_url": "https://...",
  "image_url": "",
  "reason": "explanation",
  "final_decision": "Manual Review",
  "manual_review_required": true
}

## 9. Final Mandatory Instructions
- Apply all restricted categories consistently across the entire accessible website.
- Do not work on confirmed restricted websites.
- Do not extract products or company information from restricted websites.
- Do not reject websites based only on isolated keyword matches.
- Do not ignore genuine restricted products or images just because the homepage is unrelated.
- Do not invent evidence.
- Accuracy and evidence-based classification are mandatory.

WEBSITE DATA FOR VALIDATION:
Website URL: ${url}
Title: ${crawlData.title || "(None)"}
${contactText ? `Contact Page Content:\n${contactText}\n\n` : ""}${profileText ? `About Page Content:\n${profileText}\n\n` : ""}${footerText ? `Footer Content:\n${footerText}\n\n` : ""}${renderedText ? `Rendered DOM:\n${renderedText}\n\n` : ""}Main Body Content:
${bodyText}
`;
}

/**
 * Validates a website's restricted-category compliance via AI using the strict prompt.
 */
async function validateRestrictedCategoryWithAi(crawlData, aiConfig = {}, crawlStartTime = 0) {
  const prompt = buildRestrictedCategoryPrompt(crawlData);
  const cfg = {
    apiKey: aiConfig.apiKey || "",
    provider: (aiConfig.provider || "gemini").toLowerCase(),
    model: aiConfig.model || "gemini-2.5-flash"
  };

  if (!cfg.apiKey) {
    const localCheck = typeof detectRestrictedKeywords === "function"
      ? detectRestrictedKeywords(crawlData.bodyText, crawlData.mainHtml, crawlData.crawledPages)
      : { isRestricted: false };
    return typeof formatRestrictedValidationResult === "function"
      ? formatRestrictedValidationResult(localCheck, crawlData.finalUrl || crawlData.originalUrl)
      : localCheck;
  }

  try {
    let rawResultText = "";
    if (cfg.provider === "gemini") {
      const candidateModels = [cfg.model, "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
      rawResultText = await callGeminiExtractionApi({
        apiKey: cfg.apiKey,
        candidateModels,
        prompt,
        crawlStartTime
      });
    } else {
      const candidateModels = [cfg.model, "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
      rawResultText = await callOpenAiCompatibleApi({
        providerLabel: cfg.provider.toUpperCase(),
        endpoint: cfg.endpoint || "https://api.groq.com/openai/v1/chat/completions",
        apiKey: cfg.apiKey,
        candidateModels,
        prompt,
        crawlStartTime
      });
    }

    const parsed = parseAiJsonPayload(rawResultText);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (err) {
    console.warn("[AI Assistant] AI restricted category validation error:", err.message);
  }

  // Fallback to heuristic validation
  const localCheck = typeof detectRestrictedKeywords === "function"
    ? detectRestrictedKeywords(crawlData.bodyText, crawlData.mainHtml, crawlData.crawledPages)
    : { isRestricted: false };
  return typeof formatRestrictedValidationResult === "function"
    ? formatRestrictedValidationResult(localCheck, crawlData.finalUrl || crawlData.originalUrl)
    : localCheck;
}

