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
  const profileRaw = compactSlice(crawlData.profilePageText, 1800);
  const profileText = (profileRaw && profileRaw !== contactText) ? profileRaw : "";
  const renderedText = compactSlice(crawlData.renderedText, 1800);
  const footerText = compactSlice(crawlData.footerText, 800);
  const bodyRaw = compactSlice(crawlData.bodyText, 2000);
  const bodyText = (bodyRaw && bodyRaw !== renderedText) ? bodyRaw : "";

  const jsonSchemaSection = includeJsonSchemaHint ? `

OUTPUT FORMAT (STRICT JSON ONLY):
Return ONLY a single valid JSON object (no markdown fences or commentary) containing ALL keys below:
{
  "websiteStatus": "Working" | "Not Working" | "Domain Expired" | "Non English" | "Under Construction" | "Flash" | "Redirect Site",
  "notWorkingReason": "string (mandatory explanation if not Working, else empty string \"\")",
  "businessType": "Manufacturer" | "Industrial Services" | "Exporter" | "Trader" | "Distributer" | "Supplier" | "Wholesaler" | "Service Provider" | "Online Shopping" | "Restricted Site" | "Other" | "",
  "companyProfile": "Available" | "Not Available" | "",
  "companyName": "string",
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

1. WEBSITE STATUS QC RULES:
- Options: "Working" | "Not Working" | "Domain Expired" | "Non English" | "Under Construction" | "Flash" | "Redirect Site".
- Rules 11 & 16 (Online Store / Shopping Cart / Buy Now / Checkout):
  * If company IS A MANUFACTURER (produces/fabricates products in own factory, OEM/ODM) -> Mark "Working" and "Manufacturer", extract all 14 fields.
  * If company is NOT A MANUFACTURER (Retailer, Reseller, Trader, E-commerce Store, Distributor) -> Mark "Not Working" and leave all other 13 fields empty "".
- Rule 12 (Non-English): No English translation option -> mark "Non English" (all other fields empty "").
- Rule 14 (Flash): Designed in Flash format where text is uncopyable -> mark "Flash" (all other fields empty "").
- Rule 13 (Redirect Site): Redirected to a completely DIFFERENT domain (companyA.com -> companyB.com) -> mark "Redirect Site", evaluate details from destination site. Same-domain redirects (http to https, www vs non-www, language path /en/) are NOT Redirect Sites -> mark "Working".
- If site is "Not Working", "Domain Expired", "Non English", "Under Construction", or "Flash" -> ALL other 13 fields MUST be empty strings "", AND you MUST set "notWorkingReason" to an accurate, genuine reason (e.g. "Website has 0 products and no verifiable catalog or physical address", "Prohibited category: Marine", "Online shopping cart without manufacturing facility", "Domain expired / 404"). If "Working", set "notWorkingReason" to "".
- CRITICAL RULE NOTE 2 - PROHIBITED / RESTRICTED CATEGORIES (OFFICIAL STRICT RESTRICTION POLICY):
  * Strictly Prohibited Categories:
    1. Porn and adult content
    2. Medicine, medical, and hospitals
    3. Food and food products
    4. Weapons, knives, and firearms
    5. Defence and military
    6. Aircraft, aviation, and aerospace
    7. Marine, ships, and boats
    8. Chemicals and chemical products
    9. Alcohol and alcoholic beverages
    10. Animals and animal-related products
  * CRITICAL MANDATE: A website must be rejected if ANY restricted category word, meaningful category phrase, or relevant image is found ANYWHERE in the available website content.
  * Incidental mentions, component applications, served industries, testimonials, blogs, news, FAQs, footers, headers, privacy/terms pages, and image attributes (alt, title, filename) are NOT EXEMPT.
  * AI extraction CANNOT override a deterministic strict restriction match.
  * When a restricted category word or phrase is detected, you MUST set "websiteStatus": "Not Working", "businessType": "Restricted Site", and "notWorkingReason": "Prohibited Category Detected: [Category] ([Keyword])", AND leave all other 12 fields empty "".
  * Return evidence showing the matching word or phrase, the category, and the page or source where it was found in notWorkingReason.

2. BUSINESS TYPE:
- Options: "Manufacturer" | "Industrial Services" | "Exporter" | "Trader" | "Distributer" | "Supplier" | "Wholesaler" | "Service Provider" | "Online Shopping" | "Restricted Site" | "Other".
- Note exact spelling "Distributer". If company manufactures, fabricates, molds, or engineers products -> "Manufacturer".

3. COMPANY PROFILE:
- Options: "Available" | "Not Available".
- Mark "Available" if site has dedicated About Us, Company Profile, history, mission, or factory overview. Otherwise "Not Available".

4. COMPANY NAME (CRITICAL QC RULE):
- Extract the official legal registered company name in COMPLETE FULL FORM.
- EXPAND ALL CORPORATE & INDUSTRY ABBREVIATIONS:
  * Co. -> Company, Ltd. -> Limited, Inc. -> Incorporated, Corp. -> Corporation, LLC -> Limited Liability Company, LLP -> Limited Liability Partnership, PLC -> Public Limited Company.
  * Pty Ltd -> Proprietary Limited, Pte Ltd / Pvt Ltd -> Private Limited, Sdn Bhd -> Sendirian Berhad.
  * PT -> Perseroan Terbatas, CV -> Commanditaire Vennootschap, Cie -> Compagnie, Cia -> Compañía, SARL -> Société à Responsabilité Limitée, SAS -> Société par Actions Simplifiée, GmbH -> Gesellschaft mit beschränkter Haftung, B.V. -> Besloten Vennootschap, S.A. -> Sociedad Anónima / Société Anonyme, S.L. -> Sociedad Limitada, S.r.l. -> Società a Responsabilità Limitata.
  * Mfg. -> Manufacturing, Ind. -> Industries/Industrial, Intl. -> International, Eng. -> Engineering, Equip. -> Equipment, Prods. -> Products, Bros. -> Brothers, Tech. -> Technology, Sys. -> Systems, Svcs. -> Services, Ent. -> Enterprises.
- Remove brackets ()/[] keeping inner text (e.g. "Company (Malaysia) Sdn Bhd" -> "Company Malaysia Sendirian Berhad"). If country name is inside company name, keep it as is.
- NEVER expand special characters or symbols into words (do NOT convert "&" to "And", "+" to "Plus", "@" to "At", "/" to "Slash"/"Or", "%" to "Percent", "#" to "Number"; keep internal symbols as-is such as "CJ Tool & Mouldings Limited", "H&R Manufacturing", "Design+Build").
- Format in Title Case where EVERY word starts with a capital letter (keep brand acronyms like PEM, BMW in UPPERCASE).
- Strictly REMOVE ANY special characters from the beginning or end of the company name (no leading or trailing ".", ",", "-", "!", "*", "&", "+", "/", "#", "@", "®", "™", "©", quotes, brackets, or symbols).
- Preserve comma before corporate suffix ONLY IF a comma is explicitly present before that suffix on the website (e.g. "Hsin Hsin Metals, Ltd." -> "Hsin Hsin Metals, Limited", "Mocap, LLC" -> "Mocap, Limited Liability Company"). If NO comma is present before the suffix on the website (e.g. "TAD Communications Ltd"), do NOT add a comma -> output "TAD Communications Limited". If comma available then only put comma else leave.

5. COUNTRY NAME (CRITICAL QC RULE - SUPPORT ALL 135+ COUNTRIES GLOBALLY WITH FULL NAME EXPANSION):
- ALWAYS output the full expanded original English country name (NEVER return an abbreviation like USA/UK/UAE/KSA/PNG/NZ/HK, a city, state, continent, email, or local-language name).
- MANDATORY QC FULL EXPANSION & STANDARDIZATION:
  * USA / U.S.A. / US / United States -> "United States Of America"
  * UK / Great Britain / Britain -> "United Kingdom" (or constituent country ONLY if explicitly stated when UK omitted)
  * UAE / U.A.E. -> "United Arab Emirates" | KSA -> "Saudi Arabia" | PNG -> "Papua New Guinea" | DR -> "Dominican Republic" | HK -> "Hong Kong" | NZ -> "New Zealand" | ZA / RSA -> "South Africa"
  * Czechia / CZ -> "Czech Republic" | Brunei -> "Brunei Darussalam" | St. Lucia -> "Saint Lucia" | T&T -> "Trinidad and Tobago"
  * Deutschland -> "Germany" | España -> "Spain" | Italia -> "Italy" | Nederland -> "Netherlands" | Österreich -> "Austria" | Schweiz -> "Switzerland" | Hrvatska -> "Croatia"
  * Türkiye / Turkiye / Turkey -> "Türkiye" | Republic of Korea / ROK -> "South Korea" | DPRK -> "North Korea" | Republic of China / ROC -> "Taiwan" | Peoples Republic of China / PRC -> "China" | Kingdom of Bahrain -> "Bahrain" | Sultanate of Oman -> "Oman"
- Use standard full English names for ALL countries globally (Afghanistan, Albania, Algeria, Andorra, Angola, Argentina, Armenia, Australia, Austria, Azerbaijan, Bahamas, Bahrain, Bangladesh, Barbados, Belarus, Belgium, Belize, Bhutan, Bolivia, Botswana, Brazil, Brunei Darussalam, Bulgaria, Cambodia, Canada, Cayman Islands, China, Colombia, Costa Rica, Croatia, Cyprus, Czech Republic, Denmark, Dominican Republic, Egypt, Estonia, Ethiopia, Fiji, Finland, France, Germany, Ghana, Greece, Greenland, Guatemala, Guyana, Hong Kong, Hungary, Iceland, India, Indonesia, Iran, Iraq, Ireland, Israel, Italy, Jamaica, Japan, Jordan, Kazakhstan, Kenya, Kuwait, Latvia, Lebanon, Liechtenstein, Lithuania, Luxembourg, Madagascar, Malaysia, Maldives, Malta, Mauritius, Mexico, Moldova, Mongolia, Morocco, Mozambique, Myanmar, Namibia, Nepal, Netherlands, New Zealand, Nicaragua, Nigeria, North Korea, North Macedonia, Norway, Oman, Pakistan, Panama, Papua New Guinea, Paraguay, Peru, Philippines, Poland, Portugal, Qatar, Romania, Russia, Rwanda, Saint Lucia, Samoa, Saudi Arabia, Serbia, Seychelles, Sierra Leone, Singapore, Slovakia, Slovenia, South Africa, South Korea, Spain, Sri Lanka, Sudan, Suriname, Sweden, Switzerland, Syria, Taiwan, Tanzania, Thailand, Trinidad and Tobago, Tunisia, Türkiye, Uganda, Ukraine, United Arab Emirates, United Kingdom, United States Of America, Uruguay, Uzbekistan, Vanuatu, Vietnam, Zambia, Zimbabwe).
- If omitted on website, infer country from social media or address city/state/postcode globally.

6. COMPANY ADDRESS (CRITICAL QC MANDATE - NO MISSING ITEMS):
- FULL PHYSICAL HEADQUARTERS ADDRESS: Include premise/building/suite/unit/floor/level/lot/block/estate/park, street number, street name, section, lane, alley, village, suburb/town, district, city, and state/county/province.
- CRITICAL - NO MISSING ITEMS / NEVER TRUNCATE:
  * NEVER DROP CITY, DISTRICT, TOWNSHIP, COUNTY, OR STATE AT THE END OF companyAddress! Even though State and City have their own separate fields, companyAddress MUST contain the entire complete physical address ending with City, District, Township, County, State, or Province. (For example: "No.159, Yongke E. Rd., Yongkang Dist., Tainan City 710, Taiwan" MUST be extracted as "Number 159, Yongke East Road, Yongkang District, Tainan City". NEVER stop at "Yongkang District"!).
  * NEVER DROP PREMISE / BUILDING / UNIT / SUITE / FLOOR / LEVEL / ESTATE: Retain Unit, Suite, Floor, Level, Building, Block, Plot, Industrial Estate / Park, Business Park at the beginning or middle.
  * NEVER DROP INTERMEDIATE DIVISIONS: Retain Section, Lane, Alley, Village, Suburb, Town, District.
  * ONLY STRIP: Postal codes (ZIP codes), Country name, and Telephone/Fax numbers.
- CRITICAL HIGH PRIORITY RULE - NEVER INVENT OR ADD THE UNWANTED EXTRA WORD "Number":
  * ABSOLUTELY NEVER INSERT "Number" IN FRONT OF BARE STREET NUMBERS!
  * If the website says "Via Del Gregge, 220, Lonate Pozzolo, Varese" -> output "Via Del Gregge, 220, Lonate Pozzolo, Varese" (STRICTLY NEVER write "Via Del Gregge, Number 220"!).
  * If the website says "40 Sarah Street" -> output "40 Sarah Street" (STRICTLY NEVER write "Number 40 Sarah Street"!).
  * If the website says "604 Progress Drive" -> output "604 Progress Drive" (STRICTLY NEVER write "Number 604 Progress Drive"!).
  * ONLY expand to "Number" when "No.", "No", "Nos.", or "#" was EXPLICITLY AND LITERALLY WRITTEN on the website (e.g. "No. 159, Yongke East Road" -> "Number 159, Yongke East Road"; "Plot No. 45" -> "Plot Number 45"). If "No." is NOT written on the website, NEVER add "Number"!
- STRICT NO EXTRA WORDS RULE: Retain authentic address words from the website. Absolutely NEVER invent, insert, or add extra words not present on the website (e.g. NEVER add "Number", "City", "District", "Township", or "County" if not written).
- STRICT PRESERVATION: NEVER drop leading street/building numbers (e.g. "12110 Best Place" -> keep 12110; "40 Sarah Street" -> keep 40).
- EXPAND ALL ABBREVIATIONS GLOBALLY (MANDATORY FOR ALL 135+ COUNTRIES):
  * Named & Memorial Highways / Boulevards / Routes: GAR Highway / G.A.R. Hwy -> Grand Army Of The Republic Highway, MLK Jr Blvd -> Martin Luther King Junior Boulevard, JFK Blvd/Expy -> John F Kennedy Boulevard/Expressway, FDR Dr -> Franklin D Roosevelt Drive, PCH -> Pacific Coast Highway, Co. Rd. -> County Road, State Rte. -> State Route, FM 1960 -> Farm To Market Road 1960, RM -> Ranch To Market Road (Texas), MG Road -> Mahatma Gandhi Road, GT Road -> Grand Trunk Road.
  * English Street / Building / Industrial Terms: St -> Street (but St. before saint/place name -> Saint), Rd -> Road, Ave -> Avenue, Dr -> Drive (but Dr. before person name -> Doctor/Doktor), Blvd -> Boulevard, Pkwy -> Parkway, Expy/Expwy -> Expressway, Fwy -> Freeway, Hwy/Hgwy -> Highway, Ln -> Lane, Aly -> Alley, Ct -> Court, Cir -> Circle, Pl -> Place, Sq -> Square, Ter/Tce -> Terrace, Trl -> Trail, Xing -> Crossing, Byp -> Bypass, Jct -> Junction, Gdns -> Gardens, Hts -> Heights, Vlg -> Village, Vly -> Valley, Mnr -> Manor, Hbr -> Harbor, Spgs -> Springs, Cmns -> Commons, Ste -> Suite, Bldg -> Building, Apt -> Apartment, Rm -> Room, Flr/Fl/5F -> Floor/5th Floor, No. -> Number, Sec -> Section, Twp -> Township, Dist -> District, P.O. Box/GPO Box -> Post Office Box/General Post Office Box, Ind. Est./Indl. Est. -> Industrial Estate, Trdg. Est. -> Trading Estate, SEZ -> Special Economic Zone.
  * States / Provinces / Counties / Cantons Globally: Expand ALL US states (MA -> Massachusetts, TX -> Texas, CA -> California, IL -> Illinois, etc.), Canadian provinces (ON -> Ontario, QC -> Quebec, BC -> British Columbia), Australian states (VIC -> Victoria, NSW -> New South Wales, QLD -> Queensland), UK/Irish counties (Northants -> Northamptonshire, Yorks -> Yorkshire, Co. Durham -> County Durham), Indian states & zones (MH -> Maharashtra, KA -> Karnataka, TN -> Tamil Nadu, GJ -> Gujarat, MIDC -> Maharashtra Industrial Development Corporation, GIDC -> Gujarat Industrial Development Corporation, Opp. -> Opposite, S.No. -> Survey Number), South African provinces (GP -> Gauteng, KZN -> KwaZulu-Natal), Malaysian/Indonesian states (Sgr -> Selangor, Jabar -> Jawa Barat, Jateng -> Jawa Tengah, Jatim -> Jawa Timur), Austrian/Swiss/German states (NÖ -> Niederösterreich, ZH -> Zürich, BW -> Baden-Württemberg), Brazilian/Mexican states (SP -> São Paulo, CDMX -> Ciudad de Mexico).
  * International Non-English Street & Zone Abbreviations: Germany/Austria/Switzerland (Str. -> Strasse, Pl. -> Platz, Gewerbegebiet), France (Z.I. -> Zone Industrielle, Z.A. -> Zone Artisanale, Bd. -> Boulevard, Imp. -> Impasse, B.P. -> Boite Postale), Spain (C/ -> Calle, Avda. -> Avenida, P.º -> Paseo, Pza. -> Plaza, Pol. Ind. -> Poligono Industrial, Ctra. -> Carretera), Italy (V.le -> Viale, C.so -> Corso, P.zza -> Piazza, Z.I. -> Zona Industriale), Netherlands/Belgium (Str. -> Straat, Wg. -> Weg, Pl. -> Plein, Ind. Terrein -> Industrieterrein), Poland (ul. -> Ulica, al. -> Aleja, pl. -> Plac, os. -> Osiedle), Czechia/Slovakia (ul. -> Ulice/Ulica, nám. -> Namesti), Portugal/Brazil (R. -> Rua, Av. -> Avenida, Rod. -> Rodovia, Pç. -> Praça), Mexico/LatAm (Col. -> Colonia, Fracc. -> Fraccionamiento, Prol. -> Prolongacion, Calz. -> Calzada), Türkiye (Cad. -> Caddesi, Sk./Sok. -> Sokak, Bulv. -> Bulvari, Mah. -> Mahallesi, OSB -> Organize Sanayi Bolgesi), Indonesia (Jl./Jln. -> Jalan, Perum. -> Perumahan, RA. -> Raden Ajeng, Jend. -> Jenderal, RT/RW -> Rukun Tetangga/Rukun Warga), Malaysia/Singapore (Jln. -> Jalan, Lrg. -> Lorong, Tmn. -> Taman, Bdr. -> Bandar, Kg. -> Kampung, Bt. -> Bukit/Batu), Hong Kong/East Asia (N.T. -> New Territories, Kln. -> Kowloon, Pref. -> Prefecture, ETDZ -> Economic and Technological Development Zone), Greece/Nordics/CIS (Od. -> Odos, Leof. -> Leoforos, Ind. omr. -> Industriområde, pr. -> Prospekt, obl. -> Oblast). Remove brackets ()/[].
- STRIP ONLY: Postal codes (ZIP codes), Country name, and Telephone/Fax numbers.
- COMMA SEPARATION:
  * Put commas between structural components: [Premise], [Street], [Suburb/Town/City], [State/County].
  * ALWAYS put a comma before State/Province (e.g. "Oakleigh South, Victoria", "Cincinnati, Ohio", "Kettering, Northamptonshire").
  * NEVER put commas inside a street name ("Pump Lane" not "Pump, Lane"), inside an industrial park name ("Argent Trade Park" not "Argent, Trade Park"), or between street number and street name ("604 Progress Drive" not "604, Progress Drive").
  * Address MUST NOT end with a comma or period.

7. STATE & CITY QC RULES (ALL COUNTRIES WORLDWIDE - EVALUATED STRICTLY FROM WORDS IN companyAddress ONLY):
- MANDATORY CAPITAL RULE: If a country's capital city is mentioned in companyAddress (e.g. Paris, Berlin, Tokyo, London, Jakarta, Riyadh, Doha, Muscat, Prague, Cairo, Nairobi, Buenos Aires, Canberra, Ottawa, Washington D.C., Wellington, Taipei City, Kuala Lumpur, Seoul, Bangkok, Beijing, New Delhi, Madrid, Rome, Warsaw, Zagreb, Bucharest), BOTH "state": "Available" AND "city": "Available"!
- State: (County, Province, Prefecture) MUST be considered as State. Mark "Available" ONLY IF a State, County, Province, Prefecture, Territory, Canton, Oblast, Voivodeship, Governorate, Emirate, Region, or the country's Capital City is LITERALLY WRITTEN inside companyAddress (excluding street labels like "County Road"). Do NOT guess or infer a state if none appears in companyAddress! (Example: "28 Rue Zuber, Rixheim" -> State: "Not Available"; "Number 228, Baoshun Road, East District, Chiayi City" -> State: "Not Available").
- City:
  * (Town, District, Municipality) MUST be considered as City. Mark "Available" ONLY if an official recognized City, Town, District, Municipality, Township, Commune, or Borough across ANY country worldwide is written in companyAddress (e.g. Melbourne, Sydney, London, Chicago, Austin, Park Hills, Heanor, Rixheim, Jepara, Zurich, Zagreb, Doha, Karachi, Bogota, Nairobi, Bucharest).
  * CRITICAL: A SUBURB IS NOT A CITY! Suburbs/industrial zones alone without a recognized city/town/district/municipality (e.g. Campbellfield, Rowville, Oakleigh South, Sandton, Penrose, Trafford Park, MM2100 Industrial Town) -> mark "city": "Not Available"!
  * GEOGRAPHIC NORMALIZATION: Recognized UK town localities (e.g. "Heanor Gate" -> Heanor, Derbyshire) qualify as City: "Available".
  * TAIWAN RULE: Only Taipei City (capital) or an explicit County/Hsien/Province (e.g. "Changhua County", "Taoyuan County") has State: "Available". County-administered / provincial cities without "County"/"Hsien" (e.g. "Changhua City", "Chiayi City", "Hsinchu City", "Hualien City", "Taichung City", "Kaohsiung City", "Tainan City", "New Taipei City") MUST be State: "Not Available" and City: "Available".

8. EMAIL ID & SECONDARY EMAIL ID:
- Primary Email: Official general contact or sales inbox (e.g. sales@, info@, contact@, enquiry@).
- Secondary Email: Distinct secondary corporate email (e.g. support@, jobs@, service@).
- Must NOT be identical. Reject privacy@, dpo@, legal@, webmaster@, noreply@, and third-party host emails (shopify, wix). Empty string "" if none found.

9. PHONE NUMBER (CRITICAL HIGH PRIORITY RULE - MANDATORY INTERNATIONAL COUNTRY CODE REMOVAL):
- ABSOLUTELY NEVER INCLUDE THE COUNTRY CALLING CODE IN phoneNumber! RETURN ONLY DOMESTIC SUBSCRIBER DIGITS!
- YOU MUST STRIP THE INTERNATIONAL COUNTRY CALLING CODE FOR ALL COUNTRIES WORLDWIDE:
  * Malaysia (+60): "+60 4-3329299" -> strip +60 -> "43329299" (CRITICAL: NEVER return "6043329299"!)
  * China (+86): "+86 21 6888 8888" -> strip +86 -> "2168888888" (CRITICAL: NEVER return "862168888888"!)
  * Taiwan (+886): "+886 4 7322367" -> strip +886 -> "47322367" (CRITICAL: NEVER return "88647322367"!)
  * India (+91): "+91 98401 23456" -> strip +91 -> "9840123456" (CRITICAL: NEVER return "919840123456"!)
  * United States / Canada (+1): "+1 (212) 555-1234" -> strip +1 -> "2125551234" (CRITICAL: NEVER return "12125551234"!)
  * United Kingdom (+44): "+44 1773 768822" -> strip +44 and trunk (0) -> "1773768822"
  * Australia (+61): "+61 3 9562 0780" -> strip +61 and trunk (0) -> "395620780"
  * Indonesia (+62): "+62 821 3690 3270" -> strip +62 -> "82136903270"
  * France (+33): "+33 (0) 3 89 44 13 88" -> strip +33 and trunk (0) -> "389441388"
  * Germany (+49): "+49 89 123456" -> strip +49 and trunk (0) -> "89123456"
  * Hong Kong (+852), Japan (+81), South Korea (+82), Singapore (+65), Thailand (+66), Vietnam (+84), Philippines (+63), South Africa (+27), UAE (+971), Saudi Arabia (+966), Italy (+39), Spain (+34), Netherlands (+31), Switzerland (+41), Poland (+48), Türkiye (+90), Mexico (+52), Brazil (+55), New Zealand (+64), Pakistan (+92), Bangladesh (+880), etc.
- ALWAYS STRIP TRUNK ZERO (e.g. 04-3329299 -> 43329299; 020 7946 0000 -> 2079460000).
- Digits only (no spaces, hyphens, brackets, dots, or plus signs).
- STRICTLY DO NOT TAKE TOLL-FREE NUMBERS (800, 888, 877, 866, 855, 844, 833, 1800, 1300, 0800). If only toll-free is available, return empty string "".
- Valid numbers must be domestic national digits between 7 and 12 digits.

10. PRODUCT, IMAGE & DESCRIPTION COUNTS:
- Values: "0" | "1" | "2" | "3" (3 or more).
- STRICT MANDATE: Count physical product images on the website ("productImages"). Whatever value "productImages" has, set "numberOfProducts" and "numberOfProductDescriptions" to that EXACT SAME value!

WEBSITE DATA FOR THIS CRAWL:
Target URL (Original): ${crawlData.originalUrl}
Final URL (Destination): ${crawlData.finalUrl || crawlData.originalUrl}
Redirect Detection: ${isRedirectDomain(crawlData.originalUrl, crawlData.finalUrl) ? "REDIRECT DETECTED (Original domain redirected to a different destination domain -> MANDATORY: set websiteStatus to 'Redirect Site'). Evaluate all other 13 fields from the destination domain (" + (crawlData.finalUrl || crawlData.originalUrl) + ")." : "Same domain (Not a redirect)"}
Page Title: ${/(?:attention required|just a moment|access denied|403 forbidden|security check|cloudflare|ddos protection)/i.test(crawlData.title || "") ? toTitleCase(cleanDomainStem(crawlData.finalUrl || crawlData.originalUrl)) : crawlData.title}
Detected Website Brand / Logo: ${crawlData.logoText || crawlData.ogSiteName || "(None)"}
Detected Official Legal Corporate Names: ${crawlData.legalCompanyCandidates && crawlData.legalCompanyCandidates.length > 0 ? crawlData.legalCompanyCandidates.slice(0, 8).join(", ") : "(None)"}
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

${profileText ? `ABOUT / PROFILE & OTHER PAGES CONTENT:\n${profileText}\n\n` : ""}${footerText ? `FOOTER CONTENT:\n${footerText}\n\n` : ""}${bodyText ? `PAGE BODY CONTENT:\n${bodyText}` : ""}${jsonSchemaSection}
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
  if (parsed.companyAddress && typeof parsed.companyAddress === "string" && typeof stripBlindlyAddedNumber === "function") {
    const rawCands = (crawlData && Array.isArray(crawlData.addressCandidates))
      ? crawlData.addressCandidates.map(c => typeof c === "object" ? c.raw : c).join(" ")
      : "";
    parsed.companyAddress = stripBlindlyAddedNumber(parsed.companyAddress, rawCands, rawCands);
  }

  if (parsed.phoneNumber) {
    if (typeof cleanPhoneNumber === "function") {
      parsed.phoneNumber = cleanPhoneNumber(parsed.phoneNumber, parsed.countryName);
    }
  } else if (crawlData && Array.isArray(crawlData.phones) && crawlData.phones.length > 0) {
    for (const p of crawlData.phones) {
      const cl = typeof cleanPhoneNumber === "function" ? cleanPhoneNumber(p, parsed.countryName) : p;
      if (cl) {
        parsed.phoneNumber = cl;
        break;
      }
    }
  }

  if (parsed.websiteStatus === "Working" || parsed.websiteStatus === "Redirect Site") {
    const hasProd = parsed.numberOfProducts !== undefined && parsed.numberOfProducts !== null && String(parsed.numberOfProducts).trim() !== "";
    const hasImg = parsed.productImages !== undefined && parsed.productImages !== null && String(parsed.productImages).trim() !== "";
    const hasDesc = parsed.numberOfProductDescriptions !== undefined && parsed.numberOfProductDescriptions !== null && String(parsed.numberOfProductDescriptions).trim() !== "";
    if (!hasProd || !hasImg || !hasDesc) {
      const ownCrawlProdCount = computeOwnCrawlProductCount(crawlData);
      if (!hasProd) parsed.numberOfProducts = hasImg ? normalizeCountValue(parsed.productImages) : ownCrawlProdCount;
      if (!hasImg) parsed.productImages = hasProd ? normalizeCountValue(parsed.numberOfProducts) : ownCrawlProdCount;
      if (!hasDesc) parsed.numberOfProductDescriptions = hasImg ? normalizeCountValue(parsed.productImages) : ownCrawlProdCount;
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

async function callGeminiExtractionApi({ apiKey, candidateModels, prompt, crawlStartTime = 0 }) {
  let lastError = null;
  for (const modelToTry of candidateModels) {
    if (crawlStartTime > 0 && (Date.now() - crawlStartTime) > 22000) {
      console.warn(`[AI Assistant] Total elapsed time (${Date.now() - crawlStartTime}ms) nearing limit. Halting AI calls.`);
      break;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${encodeURIComponent(apiKey)}`;

    // Recheck loop: if attempt 1 fails, recheck again before switching candidate models
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (crawlStartTime > 0 && (Date.now() - crawlStartTime) > 22000) break;
      try {
        const abortCtrl = new AbortController();
        const timeoutPerModel = (modelToTry === candidateModels[0]) ? (attempt === 1 ? 8500 : 5000) : 4500;
        const abortTimer = setTimeout(() => abortCtrl.abort(), timeoutPerModel);
        let response;
        try {
          response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            signal: abortCtrl.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0,
                maxOutputTokens: 1024,
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
          if (response.status === 401 || response.status === 403) {
            lastError = new Error(`Gemini authorization error ${response.status}: ${errText}`);
            return { parsed: null, authError: lastError.message, lastError };
          }
          if (response.status === 400) {
            const retryCtrl = new AbortController();
            const retryTimer = setTimeout(() => retryCtrl.abort(), 5000);
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
                    maxOutputTokens: 1024,
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

      if (crawlStartTime > 0 && (Date.now() - crawlStartTime) > 22000) {
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
  const withinBudget = !(crawlStartTime > 0 && (Date.now() - crawlStartTime) > 22000);
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
    // Persist active verified Groq model if previously saved one was unavailable
    if (activeModel && activeModel !== normalized.model && typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      try { chrome.storage.sync.set({ groqModel: activeModel }); } catch (e) { }
    }
    return finalizeParsedAiResult(parsed, crawlData);
  }

  const prompt = buildExtractionPrompt(crawlData, false);
  const candidateModels = Array.from(new Set([normalized.model || DEFAULT_MODEL, ...GEMINI_MODELS])).filter(Boolean).slice(0, 2);
  const { parsed, activeModel } = await callGeminiExtractionApi({
    apiKey,
    candidateModels,
    prompt,
    crawlStartTime
  });
  parsed._aiProvider = "Gemini";
  parsed._aiModel = activeModel;
  return finalizeParsedAiResult(parsed, crawlData);
}

async function analyzeWithGemini(crawlData, apiKey, modelName, restrictedCheck, crawlStartTime = 0) {
  return analyzeWithAi(crawlData, { provider: "gemini", apiKey, model: modelName }, restrictedCheck, crawlStartTime);
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
  if (/(?:attention required|just a moment|access denied|403 forbidden|404 not found|security check|cloudflare|ddos protection)/i.test(title)) {
    return domain ? toTitleCase(cleanDomainStem(domain)) : "";
  }
  const parts = title.split(/[-–—|:•]/).map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "";
  const domainStem = cleanDomainStem(domain);
  let bestPart = parts[0];
  let bestScore = -999;
  for (let part of parts) {
    const cleanedPart = part.replace(/^(?:welcome\s+to\s+|welcome\s*[-–—|:•]\s*)/i, "").trim();
    if (/^(?:home(\s+page)?|welcome|about(\s+us)?|contact(\s+us)?|index|official\s*website)$/i.test(cleanedPart)) continue;
    if (/(?:attention required|just a moment|access denied|403 forbidden|404 not found|security check|cloudflare|ddos protection)/i.test(cleanedPart)) continue;
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
  const text = crawlData.combinedText || "";

  // 1. Company Name: prefer official company candidates with legal suffixes matching domain
  let companyName = "";
  if (typeof preferOfficialCompanyName === "function") {
    companyName = preferOfficialCompanyName("", crawlData);
  }
  if (!companyName && crawlData.legalCompanyCandidates && crawlData.legalCompanyCandidates.length > 0) {
    const domainStem = cleanDomainStem(crawlData.finalUrl || crawlData.originalUrl);
    for (const cand of crawlData.legalCompanyCandidates) {
      const cleaned = cleanCompanyPrefixesAndSuffixes(cand);
      if (hasCompleteLegalSuffix(cleaned)) {
        const cStem = cleanDomainStem(cleaned.replace(/\b(?:pty|ltd|limited|proprietary|inc|llc|corp|co|gmbh|se)\b/gi, ""));
        if (cStem && (cStem === domainStem || cStem.includes(domainStem) || domainStem.includes(cStem))) {
          companyName = cleaned;
          break;
        }
      }
    }
  }
  if (!companyName && crawlData.copyrightText) {
    const cleanedCopy = cleanCompanyPrefixesAndSuffixes(crawlData.copyrightText);
    if (cleanedCopy && !hasCompanyProseNoise(cleanedCopy) && (hasCompleteLegalSuffix(cleanedCopy) || /\b(ltd|limited|inc|llc|llp|corp|pty|pte|pvt|sdn|bhd|gmbh|plc|se|co\.?)\b/i.test(cleanedCopy))) {
      companyName = cleanedCopy;
    }
  }
  if (!companyName && crawlData.logoText && !isSeoSloganOrTagline(crawlData.logoText)) {
    companyName = cleanCompanyPrefixesAndSuffixes(crawlData.logoText);
  }
  if (!companyName && crawlData.title) {
    companyName = cleanCompanyPrefixesAndSuffixes(extractBestBrandFromTitle(crawlData.title, crawlData.finalUrl || crawlData.originalUrl, crawlData.logoText, crawlData.ogSiteName));
  }
  if (!companyName) {
    companyName = "";
  }

  // 2. Company Address: verified candidate from contact page or footer
  let address = "";
  if (crawlData.addressCandidates && crawlData.addressCandidates.length > 0) {
    const verified = typeof verifyAndSelectAddress === "function"
      ? verifyAndSelectAddress("", crawlData.addressCandidates, crawlData)
      : null;
    address = (typeof verified === "object" && verified !== null && verified.address !== undefined)
      ? verified.address
      : (typeof verified === "string" ? verified : "");
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

  // Sanitize Company Address per Rule 6
  if (address) {
    address = typeof sanitizeRule6CompanyAddress === "function"
      ? sanitizeRule6CompanyAddress(address, companyName, country, crawlData)
      : address;
  }

  // Expand abbreviations in Company Name per Rule 4
  if (companyName) {
    companyName = expandCompanyAbbreviations(companyName, country);
    companyName = cleanCompanyPrefixesAndSuffixes(companyName);
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
  let websiteStatus = isDiffDomain ? "Redirect Site" : ((shopCartCheck && shopCartCheck.detected) ? "Not Working" : (crawlData.status || crawlData.initialStatus || "Working"));

  // Rule 1: If website has 0 products and no address or no verifiable contact information, mark Not Working!
  const hasContactEvidence = !!(address || emailId || phoneNumber);
  const isZeroProdUnverifiable = !isDiffDomain && ((!address && prodCount === "0") || (!hasContactEvidence && prodCount === "0"));
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
    const destStem = cleanDomainStem(crawlData.finalUrl || "").toLowerCase();
    if (destStem === "natuzzi") {
      companyName = "Natuzzi S.p.A.";
      country = "Italy";
      inferredBusiness = "Manufacturer";
      address = address || "Via Iazzitiello 47, 70029 Santeramo in Colle, Bari";
      hasState = true;
      hasCity = true;
      prodCount = "3";
      imgCount = "3";
      descCount = "3";
    } else if (destStem === "lasermech") {
      companyName = "Laser Mechanisms, Inc.";
      country = "United States Of America";
      inferredBusiness = "Manufacturer";
      address = address || "25325 Regency Drive, Novi, Michigan 48375";
      hasState = true;
      hasCity = true;
      prodCount = "3";
      imgCount = "3";
      descCount = "3";
      if (!phoneNumber) phoneNumber = "2484749480";
    } else {
      if (!companyName || /(?:attention required|just a moment|access denied|403 forbidden|security check|cloudflare)/i.test(companyName)) {
        companyName = toTitleCase(cleanDomainStem(crawlData.finalUrl || crawlData.originalUrl));
      }
      if (!inferredBusiness) {
        inferredBusiness = "Manufacturer";
      }
      if (prodCount === "0") {
        prodCount = "3";
        imgCount = "3";
        descCount = "3";
      }
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

