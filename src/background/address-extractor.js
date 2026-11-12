// Address candidate extraction (HTML, JSON-LD, maps, meta, embedded scripts) and address verification.

function isFullAddressCandidate(raw) {
  if (!raw || typeof raw !== "string" || raw.length < 8) return false;
  const hasStreetOrPremise = /\b(?:street|road|avenue|lane|drive|way|place|court|terrace|boulevard|highway|parkway|crescent|close|walk|row|parade|circuit|square|esplanade|mews|alley|quay|wharf|broadway|bypass|crossing|loop|circle|turnpike|expressway|corridor|promenade|mall|arcade|chase|approach|reach|gardens|green|st\b|rd\b|ave\b|ln\b|dr\b|blvd\b|hwy\b|pde\b|cct\b|cres\b|cl\b|ct\b|pl\b|tce\b|cir\b|suite|unit|bldg|building|floor|fl|flr|level|lot|plot|block|factory|shed|warehouse|workshop|facility|premises|compound|office\s*park|business\s*park|trading\s*estate|industrial\s*(?:estate|park|area|zone|district)|science\s*park|technology\s*park|technopark|phase\s*\d+|sector\s*\d+|no\.?\s*\d+|\d+\s*[号號]|strasse|straße|str\b|gasse|weg|platz|ring|allee|damm|chaussee|ufer|rue|avda|av\b|boulevard|bd\b|chemin|route|allée|impasse|cours|passage|chaussée|voie|via|viale|corso|piazza|piazzale|borgo|contrada|vicolo|strada|calle|c\/|paseo|plaza|camino|carretera|pasaje|travesía|ronda|pol[ií]gono\s*industrial|pol\.?\s*ind\.?|zona\s*industrial|zona\s*industriale|zone\s*industrielle|gewerbegebiet|industriegebiet|gewerbepark|industriepark|jalan|jln|jl\b|lorong|lebuh|gang|gg\b|kawasan\s*industri|taman\s*perindustrian|post\s+office\s+box|po\s*box|p\.?o\.?\s*box|pob|gpo\s*box|private\s*bag|postfach|boite\s*postale|apartado\s*postal|apartado\s*de\s*correos|postbus|box\s+\d+|ulica|ul\b|aleja|al\b|plac|rynek|cadde|caddesi|sokak|sokagi|bulvar|bulvari|sanayi|osb)\b/i.test(raw) ||
    /(?:大道|大厦|路|街|巷|弄|段|号|號|工业区|工业园|产业园|高新区|科技园|园区|开发区)/.test(raw);
  const hasLocalityOrAdmin = hasStateInAddress(raw, "") ||
    hasCityDesignation(raw) ||
    hasExplicitCityWord(raw) ||
    hasRecognizedPlaceName(raw, AUSTRALIAN_CITIES) ||
    hasRecognizedPlaceName(raw, RECOGNIZED_TOWNS) ||
    hasRecognizedPlaceName(raw, UK_CITIES_AND_TOWNS) ||
    hasRecognizedPlaceName(raw, NEW_ZEALAND_CITIES_AND_TOWNS) ||
    addressLooksLikeSuburbOnly(raw) ||
    /(?:區|区|市|縣|县|鄉|乡|鎮|镇)/.test(raw) ||
    NON_CITY_SUBURBS.some(s => new RegExp(`\\b${s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, "i").test(raw)) ||
    (typeof detectCountryFromAddress === "function" && !!detectCountryFromAddress(raw));
  const hasRegionOrPostcode = hasStateInAddress(raw, "") ||
    /\b\d{4,6}\b/.test(raw) ||
    /\b[A-Z]{1,2}\d[A-Z0-9]?\s*\d[A-Z]{2}\b/i.test(raw) ||
    /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i.test(raw) ||
    /\b\d{3}\s*\d{2,3}\b/.test(raw) ||
    /\b\d{2}-\d{3}\b/.test(raw) ||
    /\b\d{5}(?:-\d{4})?\b/.test(raw) ||
    /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/.test(raw);

  return hasStreetOrPremise && (hasLocalityOrAdmin || hasRegionOrPostcode);
}

/**
 * Silently renders a page in an inactive background tab when raw HTTP fetch hits
 * an empty JS SPA shell or Cloudflare/anti-bot 403/503 challenge.
 */

function addAddressCandidate(targetList, rawText, source, isHq = false, locationType = "general", pageUrl = "", contextText = "") {
  if (!rawText || typeof rawText !== "string") return;
  const decoded = decodeHtmlEntities(rawText);
  let cleaned = decoded
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/^[^\w\d#]*(?:["']\s*>?|>|\/?>)\s*/g, "")
    .replace(/^[^a-zA-Z0-9#]+/g, "")
    .replace(/^(?:[A-Za-z0-9&,.'\-()\[\]\s]{2,100}?\s+)?(?:registered\s+in\s+[A-Za-z\s]+(?::\s*[\dA-Za-z]+)?\.?\s*,?\s*)?(?:registered\s*office|registered\s*agent|domicilio\s*social)\s*[:：\-–,\s]+/i, "")
    .replace(/^(?:registered\s+in\s+[A-Za-z\s]+(?::\s*[\dA-Za-z]+)?\.?\s*,?\s*)/i, "")
    .replace(/^(?:company\s+registration(?:\s+no\.?|\s+number)?\s*[:：\-–,\s]*[\dA-Za-z]+\.?\s*,?\s*)/i, "")
    .replace(/^(?:[A-Za-z\u00C0-\u024F\s]+?\s+)?(?:corporate\s+)?(?:head\s*office|headquarters|corporate\s*office|registered\s*office|main\s*office|principal\s*office|branch\s*office|regional\s*office|sales\s*office|plant\s*location|office|plant|factory|warehouse|workshop|facility|showroom|hq|sede\s*central|domicilio\s*social|sede\s*principal|address|add|addr|location|廠址|地址|view|learn\s*more|read\s*more|see\s*more|click\s*here|find\s*out\s*more|get\s*directions|directions)\s*[:：\-–,\s]+(?=\b(?:\d{1,5}|no\.?\s*\d+|po\s*box|post\s*office\s*box|unit|suite|building|floor)\b)/i, "")
    .replace(/^(?:(?:physical|postal|mailing|street|corporate|registered|business|office|factory|plant|showroom|warehouse|workshop|main|head)\s+)?(?:address|add|addr|location|headquarters|head\s*office|registered\s*office|corporate\s*office|廠址|地址|view|learn\s*more|read\s*more|see\s*more|click\s*here|find\s*out\s*more|get\s*directions|directions|domicilio\s*social|domicilio|anschrift|standort|sede|ubicaci[oó]n|direcci[oó]n)\s*[:：\-–|,]?\s*/i, "")
    .replace(/^(?:we(?:'re|\s+are)\s+(?:at|located\s+at)|visit\s+us(?:\s+at)?|find\s+us(?:\s+at)?|where\s+to\s+find\s+us|where\s+we\s+are|our\s+locations?|office\s+locations?|our\s+location\s+is|come\s+(?:in\s+and\s+)?visit\s+us(?:\s+at)?|get\s+in\s+touch|contact\s+us(?:\s+at)?|contact|contacto|cont[aá]ctenos|alamat\s*kami|hubungi\s*kami|dove\s*siamo|standort|kontak|聯絡我們|联系我们)\s*[:：\-–|,]?\s*/i, "")
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
    /\b(?:lot|plot|unit|suite|ste|bldg|building|floor|level|rm|room|shed|warehouse|workshop|facility|kav|kavling|apt|apartment|phase\s*\d+|sector\s*\d+|po\s*box|post\s*office\s*box|postfach|box)\s+[A-Za-z0-9\-\/]+/i.test(cleaned) ||
    /\b(?:centre|center|house|hall|mill|works|court|lodge|grange|tower|park|estate|chambers|wharf|barn|farm|compound|premises|business\s*park|industrial\s*(?:estate|park|area|zone))\b/i.test(cleaned);

  const hasThoroughfare = /\b(road|street|avenue|lane|drive|way|boulevard|highway|parade|circuit|crescent|close|court|place|terrace|esplanade|track|trail|row|walk|mews|passage|grove|view|hill|rise|vale|gate|approach|reach|wharf|quay|broadway|bypass|crossing|loop|circle|turnpike|expressway|corridor|promenade|mall|arcade|chase|gardens|green|pde|cct|cres|cl|ct|pl|tce|via|corso|viale|piazza|jl|jln|jalan|gang|gg|taman|lorong|lebuh|komp|komplek|perum|perumahan|dukuh|dk|desa|ds|dusun|dsn|kecamatan|kec|kabupaten|kab|rt\.?\s*\d+|st\b|rd\b|ave\b|dr\b|blvd\b|ln\b|hwy\b|apt\b|str\b|strasse|platz|gasse|weg|ring|allee|damm|chaussee|ufer|rue|avda|av\b|bd\b|chemin|route|allée|impasse|cours|quai|chaussée|voie|calle|c\/|paseo|plaza|camino|carretera|pasaje|travesía|ronda|pol[ií]gono\s*industrial|pol\.?\s*ind\.?|zona\s*industrial|zona\s*industriale|zone\s*industrielle|gewerbegebiet|industriegebiet|gewerbepark|industriepark|kawasan\s*industri|taman\s*perindustrian|industrial\s*(?:estate|park|area|zone|district)|business\s*park|trading\s*estate|science\s*park|technology\s*park|technopark|comune|provincia|daerah|mukim|post\s*office\s*box|po\s*box|postfach|postbus|cadde|caddesi|sokak|sokagi|bulvar|bulvari|sanayi|osb|ulica|ul\b|aleja|al\b|plac|rynek)\b/i.test(cleaned);

  const hasLocalityOrPostcode = /\b\d{4,6}\b/.test(cleaned) ||
    /\b[A-Z]{1,2}\d[A-Z0-9]?\s*\d[A-Z]{2}\b/i.test(cleaned) ||
    /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i.test(cleaned) ||
    /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s+\d{5}(?:-\d{4})?\b/i.test(cleaned) ||
    /\b(?:victoria|new\s*south\s*wales|queensland|western\s*australia|south\s*australia|tasmania|northern\s*territory|vic|nsw|qld|wa|sa|tas|act)\b/i.test(cleaned) ||
    /\b(?:leicestershire|nottinghamshire|derbyshire|staffordshire|warwickshire|worcestershire|northamptonshire|lincolnshire|yorkshire|lancashire|cheshire|cumbria|durham|northumberland|gloucestershire|oxfordshire|cambridgeshire|bedfordshire|hertfordshire|buckinghamshire|berkshire|surrey|kent|sussex|essex|norfolk|suffolk|devon|cornwall|somerset|dorset|wiltshire|hampshire|shropshire|herefordshire|middlesex)\b/i.test(cleaned) ||
    /\b(?:town|township|district|city|province|county|hsien|state|borough|municipality|shire)\b/i.test(cleaned) ||
    (typeof detectCountryFromAddress === "function" && !!detectCountryFromAddress(cleaned)) ||
    evaluateCityQC(cleaned, "") === "Available" ||
    hasStateInAddress(cleaned, "");

  const hasChineseAddressStructure = /(?:[0-9一二三四五六七八九十]+[号號]|大道|大厦|大廈|路|街|巷|弄|工业区|工業區|工业园|工業園|产业园|產業園|开发区|開發區|科技园|科技園|高新区|高新區|园区|園區|楼|樓|栋|棟|室|城|[省市区縣县鄉镇鎭])/.test(cleaned);

  const isValidStructure = (hasPremiseNum && hasThoroughfare) ||
    (hasThoroughfare && hasLocalityOrPostcode) ||
    (hasPremiseNum && hasLocalityOrPostcode) ||
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
  // Contact Us Page HQ (Tier 0.5) > Contact Us Page Operational (Tier 0.8) > Homepage/Other HQ (Tier 1.0) > Operational/Homepage (Tier 2.0) > Profile (Tier 3) > JSON-LD (Tier 4) > Map (Tier 5) > Footer (Tier 6) > General (Tier 7) > Registered Office (Tier 8) > Branch (Tier 8.5) > Distributor/Dealer (Tier 9)
  const isRegisteredOffice = /\b(?:registered\s*office|registered\s*in\b|company\s*registration\b|domicilio\s*social|registered\s*agent|legal\s*address|statutory\s*office)\b/i.test(rawText + " " + contextText);
  const hasHqKeyword = !isRegisteredOffice && (
    /\b(?:headquarters|head\s*office|corporate\s*office|main\s*office|principal\s*office|hq|main\s*factory|main\s*plant|main\s*facility|sede\s*central|oficinas?\s*central(?:es)?|sede\s*principal|oficina\s*principal)\b/i.test(rawText + " " + contextText) ||
    /(?:總公司|总公司|總部|总部|本公司|集團總部|集团总部|總廠|总厂|本廠|本厂|本部|本社|本店)/i.test(rawText + " " + contextText) ||
    isHq || source === "headquarters"
  );

  const isDedicatedContactSource = (source === "contact" || /(?:contact|contact[-_]?us|contactus|get[-_]?in[-_]?touch|reach[-_]?us|kontakt|contacto|contactenos|contatti|contactez|contato|hubungi|kontak|impressum)/i.test(pageUrl || "")) && source !== "homepage";
  const isOperationalContact = isDedicatedContactSource || /\b(?:showroom|factory|plant|workshop|store|visiting|our\s+location)\b/i.test(contextText);

  // Only demote explicit secondary/branch offices (NEVER treat manufacturing plants, factories, warehouses, or units as branches!)
  const hasBranchKeyword = /\b(?:branch(?:\s*office)?|regional\s*office|overseas\s*office|sales\s*office|subsidiary|sucursal|delegaci[oó]n|filiale|filial)\b/i.test(rawText + " " + contextText) ||
    /(?:海外子公司|全资子公司|控股子公司|子公司|海外办事处|办事处|辦事處|国内分公司|分公司|分處|分处|營業所|营业所|經銷商|经销商)/i.test(rawText + " " + contextText) ||
    locationType === "branch" || source === "branch";
  const hasDistributorKeyword = /\b(?:distributors?|dealers?|stockists?|resellers?|partners?)\b/i.test(pageUrl) || source === "distributor" || locationType === "distributor";

  let basePriority = 7;
  let locType = locationType || "general";

  if (isDedicatedContactSource && hasHqKeyword) {
    basePriority = 0.5;
    locType = "headquarters";
    isHq = true;
  } else if (isDedicatedContactSource) {
    basePriority = 0.8;
    locType = "contact";
    isHq = false;
  } else if (hasHqKeyword) {
    basePriority = 1.0;
    locType = "headquarters";
    isHq = true;
  } else if (source === "homepage" || isOperationalContact) {
    basePriority = 2.0;
    locType = source === "homepage" ? "homepage" : "operational_contact";
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
function extractJsonLdAddresses(html, targetList, pageUrl = "") {
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
            addAddressCandidate(targetList, parts.join(", "), "jsonld", false, "jsonld", pageUrl);
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
function extractEmbeddedScriptAddresses(html, targetList, pageUrl = "") {
  if (!html) return;
  extractJsonLdAddresses(html, targetList, pageUrl);

  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let sm;
  while ((sm = scriptRegex.exec(html)) !== null) {
    const content = sm[1];
    if (content.length > 250000) continue;
    if (/\b(?:streetAddress|office_address|company_address)\b/i.test(content)) {
      const m = content.match(/["'](?:streetAddress|office_address|company_address)["']\s*:\s*["']([^"']{8,180})["']/i);
      if (m && m[1]) {
        addAddressCandidate(targetList, m[1], "jsonld", false, "contact", pageUrl);
      }
    }
  }
}

/**
 * Discovers contact and about page URLs by scoring anchor text and href.
 */

function mergeTaiwanMapEmbed(q, hnear) {
  if (!q || !hnear) return null;
  const qClean = q.replace(/^\d{3,6}\s*/, '').trim();
  const hClean = hnear.replace(/^\d{3,6}\s*/, '').trim();

  // If both have Chinese characters:
  if (/[\u4e00-\u9fa5]/.test(qClean) && /[\u4e00-\u9fa5]/.test(hClean)) {
    const qParts = qClean.match(/^([\u4e00-\u9fa5]{1,4}(?:市|縣))?([\u4e00-\u9fa5]{1,4}(?:區|区|鄉|乡|鎮|镇))?([\u4e00-\u9fa5]{1,4}(?:里|村))?([\u4e00-\u9fa5]+(?:路|街|大道|巷|弄))?(.*)$/);
    const hParts = hClean.match(/^([\u4e00-\u9fa5]{1,4}(?:市|縣))?([\u4e00-\u9fa5]{1,4}(?:區|区|鄉|乡|鎮|镇))?([\u4e00-\u9fa5]{1,4}(?:里|村))?([\u4e00-\u9fa5]+(?:路|街|大道|巷|弄))?(.*)$/);
    if (qParts && hParts) {
      const city = hParts[1] || qParts[1] || '';
      const dist = hParts[2] || qParts[2] || '';
      const vill = hParts[3] || qParts[3] || '';
      const road = hParts[4] || qParts[4] || '';
      const rest = hParts[5] || qParts[5] || '';
      if (qParts[4] && hParts[4] && qParts[4] !== hParts[4] && !qParts[4].includes(hParts[4]) && !hParts[4].includes(qParts[4])) {
        return null;
      }
      if (city && (dist || vill) && road) {
        return city + dist + vill + road + rest;
      }
    }
  }
  return null;
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

      // Also check hnear parameter if present
      const hnearMatch = decoded.match(/[?&]hnear=([^&"'>]+)/i);
      let hnearQuery = "";
      if (hnearMatch) {
        hnearQuery = hnearMatch[1].replace(/\+/g, " ").trim();
      }

      // Merge Taiwan map embed parameters (q: Village + Road, hnear: District + Road) if complementary
      const mergedQuery = mergeTaiwanMapEmbed(query, hnearQuery);
      if (mergedQuery) {
        addAddressCandidate(targetList, mergedQuery, "map", false, "map", pageUrl, "Google Maps");
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

      if (hnearQuery.length > 8 && hnearQuery !== query && !/^[-\d.,\s]+$/.test(hnearQuery)) {
        addAddressCandidate(targetList, hnearQuery, "map", false, "map", pageUrl, "Google Maps");
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

function extractMetaAddresses(html, targetList, pageUrl = "") {
  if (!html) return;
  const metaRegex = /<meta[^>]+(?:name|property)=["'](?:og:street-address|geo\.placename|business:contact_data:street_address)["'][^>]+content=["']([^"']+)["']/gi;
  let m;
  while ((m = metaRegex.exec(html)) !== null) {
    if (m[1] && m[1].trim().length > 6) {
      addAddressCandidate(targetList, m[1].trim(), "contact", false, "general", pageUrl);
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
    if (!/address|location|head\s*office|headquarters|factory(?:\s*(?:&|and)\s*showroom)?|showroom|workshop|office|contact\s*us|contact|postal\s*address|direcci[oó]n|domicilio|sede|ubicaci[oó]n|d[oó]nde\s*estamos|donde\s*estamos|contacto|encu[eé]ntranos|alamat|kantor|pabrik|辦事處|办事处|地址|總部|总部/i.test(hText)) continue;
    if (/email|e-mail|newsletter|subscribe|phone|tel|telephone|opening\s*hours|working\s*hours/i.test(hText)) continue;

    const ctx = getContext(hText, defaultSource);
    let blockText = stripHtml(hm[2]);
    let blockLines = blockText.split(/\r?\n/).map(l => l.trim()).filter(l => {
      if (/^(?:phone|tel|telephone|ph|mob|mobile|cell|fax|email|e-mail|working\s*hours|opening\s*hours|trading\s*hours)\b\s*[:：\-–]?/i.test(l)) return false;
      if (/@|mailto:|data-cfemail/i.test(l)) return false;
      if (/\b(?:mon|tue|wed|thu|fri|sat|sun)\b[\s\S]*?(?:am|pm)/i.test(l)) return false;
      return true;
    });
    const combinedBlock = blockLines.join(", ").replace(/\s*,\s*,\s*/g, ", ").replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
    if (combinedBlock.length > 10) {
      addAddressCandidate(targetList, combinedBlock, ctx.source, ctx.isHq, ctx.locType, pageUrl);
    }
    const lines = blockLines.filter(l => l.length > 8);
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

  // 4. Class or id containing address, contact info, footer, or location
  const classAddrRegex = /<(?:div|p|span|section|li|td|dd|article)[^>]+(?:class|id)=["']([^"']*(?:address|addr\b|add\b|direcci[oó]n|domicilio|ubicaci[oó]n|contact[-_]?(?:info|details|item|box|block|content|text|data|col|card|section|wrapper)|footer[-_]?(?:contact|info|col|widget|block|content|box|details|text)|location[-_]?(?:info|details|text|box|block)|company[-_]?(?:address|location|info))[^"']*)["'][^>]*>([\s\S]*?)<\/(?:div|p|span|section|li|td|dd|article)>/gi;
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

  // 5. Explicit label prefixes Add: / Address: / Addr: / Where You Can Find Us / Find Us / Location: / Alamat: / Dirección: / 地址:
  const labelAddrRegex = /(?:^|>|&nbsp;|\n)\s*(?:where\s+(?:you\s+can\s+)?find\s+us|find\s+us|our\s+(?:office|address|location|factory|workshop|showroom)|[A-Za-z]+\s+(?:office|factory(?:\s*(?:&|and)\s*showroom)?|showroom|warehouse)|postal\s*address|address|alamat|kantor|lokasi|pabrik|add|addr|direcci[oó]n|domicilio\s*social|domicilio|sede\s*central|sede|ubicaci[oó]n|localizaci[oó]n|地址|廠址|厂址)\s*[:：]?\s*(?:\s*<[^>]+>)*\s*([\s\S]{10,400}?)(?=<h[1-6]\b|<form\b|<footer\b|\b(?:phone|tel|telephone|email|working\s*hours|opening\s*hours|fax)\b\s*[:：]|$)/gi;
  let lm;
  while ((lm = labelAddrRegex.exec(processedHtml)) !== null) {
    const beforeText = processedHtml.slice(Math.max(0, lm.index - 500), lm.index);
    const ctx = getContext(beforeText, defaultSource);
    let block = stripHtml(lm[1]);
    block = block.replace(/^[^\w\d#]*(?:["']\s*>?|>|\/?>)\s*/g, "").replace(/^[^a-zA-Z0-9#]+/g, "").trim();
    let labelLines = block.split(/\r?\n/).map(l => l.trim()).filter(l => {
      if (/^(?:phone|tel|telephone|ph|mob|mobile|cell|fax|email|e-mail|working\s*hours|opening\s*hours)\b\s*[:：\-–]?/i.test(l)) return false;
      if (/@|mailto:|data-cfemail/i.test(l)) return false;
      return true;
    });
    const combinedBlock = labelLines.join(", ").replace(/\s*,\s*,\s*/g, ", ").replace(/^[,;\s]+|[,;\s]+$/g, "").trim();
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

  // 7. Paragraphs, list items, table cells, or text containers containing physical address patterns (Fast execution)
  const pAddrRegex = /<(?:p|li|td|th|div|span|dd|article|section)[^>]*>([\s\S]*?)<\/(?:p|li|td|th|div|span|dd|article|section)>/gi;
  let pm;
  while ((pm = pAddrRegex.exec(processedHtml)) !== null) {
    const raw = stripHtml(pm[1]);
    if (raw.length >= 12 && raw.length <= 400 &&
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
    const allPhones = Array.isArray(crawlData.phones) ? crawlData.phones : [];
    for (const p of allPhones) {
      const pStr = String(p || "").trim();
      if (/^\+?886\b/.test(pStr)) { provenHomeCountry = "taiwan"; break; }
      if (/^\+?86\b/.test(pStr)) { provenHomeCountry = "china"; break; }
      if (/^\+?44\b/.test(pStr)) { provenHomeCountry = "united kingdom"; break; }
      if (/^\+?1\b/.test(pStr)) { provenHomeCountry = "united states of america"; break; }
      if (/^\+?61\b/.test(pStr)) { provenHomeCountry = "australia"; break; }
      if (/^\+?91\b/.test(pStr)) { provenHomeCountry = "india"; break; }
      if (/^\+?27\b/.test(pStr)) { provenHomeCountry = "south africa"; break; }
      if (/^\+?60\b/.test(pStr)) { provenHomeCountry = "malaysia"; break; }
      if (/^\+?49\b/.test(pStr)) { provenHomeCountry = "germany"; break; }
      if (/^\+?34\b/.test(pStr)) { provenHomeCountry = "spain"; break; }
      if (/^\+?39\b/.test(pStr)) { provenHomeCountry = "italy"; break; }
      if (/^\+?64\b/.test(pStr)) { provenHomeCountry = "new zealand"; break; }
    }

    if (!provenHomeCountry) {
      if (/\+886\b/.test(contactText)) provenHomeCountry = "taiwan";
      else if (/\+86\b/.test(contactText)) provenHomeCountry = "china";
      else if (/\+44\b/.test(contactText)) provenHomeCountry = "united kingdom";
      else if (/\+1[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/.test(contactText)) provenHomeCountry = "united states of america";
      else if (/\+61\b/.test(contactText)) provenHomeCountry = "australia";
      else if (/\+91\b/.test(contactText)) provenHomeCountry = "india";
      else if (/\+27\b/.test(contactText)) provenHomeCountry = "south africa";
      else if (/\+60\b/.test(contactText)) provenHomeCountry = "malaysia";
      else if (/\+49\b/.test(contactText)) provenHomeCountry = "germany";
      else if (/\+34\b/.test(contactText)) provenHomeCountry = "spain";
      else if (/\+39\b/.test(contactText)) provenHomeCountry = "italy";
      else if (/\+64\b/.test(contactText)) provenHomeCountry = "new zealand";
    }

    // Domain ccTLD if still unknown
    if (!provenHomeCountry) {
      const urlStr = ((crawlData.finalUrl || "") + " " + (crawlData.originalUrl || "")).toLowerCase();
      if (/\.(?:com\.)?tw(?:\/|$)/i.test(urlStr)) provenHomeCountry = "taiwan";
      else if (/\.(?:com\.)?au(?:\/|$)/i.test(urlStr)) provenHomeCountry = "australia";
      else if (/\.(?:co\.)?uk(?:\/|$)/i.test(urlStr)) provenHomeCountry = "united kingdom";
      else if (/\.us(?:\/|$)/i.test(urlStr)) provenHomeCountry = "united states of america";
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

  const isSameOrConstituent = (c1, c2) => {
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

  const matchesHome = (candRaw, home) => {
    if (!candRaw || !home) return false;
    const r = candRaw.toLowerCase();
    const h = home.toLowerCase();
    if (r.includes(h)) return true;
    if (isSameOrConstituent("united kingdom", h)) {
      return /\b(?:united\s*kingdom|great\s*britain|uk|england|scotland|wales|northern\s*ireland)\b/i.test(r) ||
        /\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(r);
    }
    if (isSameOrConstituent("united states of america", h)) {
      return /\b(?:united\s*states|usa|u\.s\.a\.)\b/i.test(r) ||
        /\b(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new\s*hampshire|new\s*jersey|new\s*mexico|new\s*york|north\s*carolina|north\s*dakota|ohio|oklahoma|oregon|pennsylvania|rhode\s*island|south\s*carolina|south\s*dakota|tennessee|texas|utah|vermont|virginia|washington|west\s*virginia|wisconsin|wyoming)\b/i.test(r) ||
        /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(candRaw);
    }
    if (h === "taiwan") {
      return /\b(?:taiwan|r\.?o\.?c\.?|republic\s*of\s*china|taipei|new\s*taipei|kaohsiung|taichung|tainan|taoyuan|hsinchu|changhua|miaoli|nantou|yunlin|chiayi|pingtung|yilan|hualien|taitung|keelung)\b/i.test(r) ||
        /(?:臺灣|台灣|臺北|台北|新北|桃園|台中|臺中|台南|臺南|高雄|新竹|彰化|苗栗|南投|雲林|嘉義|屏東|宜蘭|花蓮|台東|臺東|澎湖|金門|連江)/.test(candRaw);
    }
    if (h === "china") {
      return /\b(?:china|p\.?r\.?c\.?|people['’]?s?\s*republic\s*of\s*china|beijing|shanghai|guangdong|shenzhen|guangzhou|dongguan|foshan|jiangsu|suzhou|wuxi|changzhou|nanjing|zhejiang|hangzhou|ningbo|shandong|qingdao)\b/i.test(r) ||
        (/[\u4e00-\u9fa5]/.test(candRaw) && !/(?:臺灣|台灣|臺北|台北|新北|桃園|台中|臺中|台南|臺南|高雄|新竹|彰化|苗栗|南投|雲林|嘉義|屏東|宜蘭|花蓮|台東|臺東|澎湖|金門|連江)/.test(candRaw));
    }
    return false;
  };

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
      const matchA = matchesHome(rawA, provenHomeCountry);
      const matchB = matchesHome(rawB, provenHomeCountry);

      if (matchA && !matchB) pA -= 4.0;
      else if (matchB && !matchA) pB -= 4.0;

      // Penalize foreign branches located outside the home country
      const countryA = detectCountryFromAddress(rawA);
      const countryB = detectCountryFromAddress(rawB);
      if (countryA && !isSameOrConstituent(countryA, provenHomeCountry)) pA += 10.0;
      if (countryB && !isSameOrConstituent(countryB, provenHomeCountry)) pB += 10.0;

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

  // 3. SOURCE OF TRUTH MANDATE:
  // If Gemini provided a valid extracted address, trust and verify it!
  const hasGemini = geminiAddr && geminiAddr.length >= 8 && !/^(?:not\s*available|n\/?a|none|unknown)$/i.test(geminiAddr.trim()) &&
    !/\b(?:email\s*and\s*number|email\s*protected|\bprotected\b|data-cfemail)\b/i.test(geminiAddr);

  if (hasGemini) {
    // Foreign country conflict rejection: If Gemini returned an address in a foreign country (e.g. USA for Chinese company), reject Gemini
    const geminiCountry = (typeof detectCountryFromAddress === "function" ? detectCountryFromAddress(geminiAddr) : "") || "";
    const isConflict = geminiCountry && provenHomeCountry &&
      geminiCountry.toLowerCase() !== provenHomeCountry &&
      !/(?:united kingdom|great britain|uk|england|scotland|wales)/i.test(geminiCountry + " " + provenHomeCountry) &&
      !/(?:united states|usa|u\.s\.a\.)/i.test(geminiCountry + " " + provenHomeCountry);

    if (!isConflict) {
      return { address: geminiAddr, selectedCandidate: bestCandidate };
    }
  }

  // Case B: The verified website candidate is in non-Latin script (e.g. Chinese):
  // -> If Gemini provided an English translation, verify that Gemini faithfully translates bestRaw:
  if (geminiAddr && geminiAddr.length >= 5 && !/^(?:not\s*available|n\/?a|none|unknown)$/i.test(geminiAddr.trim()) && !/[\u4e00-\u9fa5]/.test(geminiAddr)) {
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

    if (geminiFaithful) {
      return { address: geminiAddr, selectedCandidate: bestCandidate };
    }
  }

  // Fallback for Own Crawl: return bestRaw from the verified website candidate
  return { address: bestRaw, selectedCandidate: bestCandidate };
}


function extractLikelyAddress(text) {
  if (!text) return "";
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length >= 3 && l.length <= 250);

  const isJunk = l => /[?!]/.test(l) || /\b(?:welcome|committed|leading|innovative|we\s+provide|we\s+offer|our\s+(?:products|services|mission|team|facility|story|history)|years\s+of|experience|feel\s+free|call\s+us|contact\s+us|email\s+us|inquiry|click\s+here|read\s+more|cookies?|privacy\s*policy|terms\s*of|copyright|all\s*rights)\b/i.test(l) || /@|mailto:|data-cfemail/i.test(l);

  // 1. First pass: look for a complete multi-line address window (2-4 lines) where lines form a full address with premise + street + locality/postcode
  for (let windowSize = 4; windowSize >= 2; windowSize--) {
    for (let i = 0; i <= lines.length - windowSize; i++) {
      const slice = lines.slice(i, i + windowSize);
      if (slice.some(isJunk)) continue;
      const combined = slice.join(", ");
      if (combined.length >= 15 && combined.length <= 250) {
        if (typeof isFullAddressCandidate === "function" && isFullAddressCandidate(combined)) {
          return combined;
        }
      }
    }
  }

  // 2. Second pass: single lines that are full addresses
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 10 || isJunk(line)) continue;
    if (typeof isFullAddressCandidate === "function" && isFullAddressCandidate(line)) {
      return line;
    }
  }

  // 3. Third pass: single line with premise + (street or loc)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 10 || isJunk(line)) continue;
    const hasPremise = /\b(?:number|no\.?|#)?\s*\d+[A-Za-z]?(?:[-\/]\d+)?\b/i.test(line) || /\b(?:po\s*box|post\s*office\s*box|postfach|box)\s+\d+\b/i.test(line);
    const hasStreet = /\b(road|street|avenue|lane|drive|way|boulevard|highway|crescent|close|court|place|terrace|st\b|rd\b|ave\b|dr\b|strasse|calle|rue|via)\b/i.test(line);
    const hasLocOrPost = /\b\d{4,6}\b/.test(line) || (typeof hasStateInAddress === "function" && hasStateInAddress(line, "")) || (typeof evaluateCityQC === "function" && evaluateCityQC(line, "") === "Available");

    if (hasPremise && hasStreet && !hasLocOrPost && i + 1 < lines.length) {
      const next = lines[i + 1];
      if (!isJunk(next) && (/\b\d{4,6}\b/.test(next) || (typeof hasStateInAddress === "function" && hasStateInAddress(next, "")) || (typeof evaluateCityQC === "function" && evaluateCityQC(next, "") === "Available"))) {
        return line + ", " + next;
      }
    }
    if (hasPremise && (hasStreet || hasLocOrPost)) {
      return line;
    }
  }

  return "";
}

