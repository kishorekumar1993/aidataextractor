// Company name extraction, prose-noise filtering, legal suffix matching, and abbreviation expansion.

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


const LEGAL_ENTITY_SUFFIX_CORE =
  "Pty\\.?\\s*Ltd\\.?|Proprietary\\s*Limited|Limited|Ltd\\.?|Inc\\.?|Incorporated|LLC|LLP|PLLC|Corp\\.?|Corporation|Co\\.,?\\s*Ltd\\.?|Company,?\\s*Limited|Pte\\.?\\s*Ltd\\.?|Pvt\\.?\\s*Ltd\\.?|Sdn\\.?\\s*Bhd\\.?|Sendirian\\s*Berhad|Berhad|GmbH(?:\\s*&\\s*Co\\.?\\s*KG)?|Ges\\.?\\s*m\\.?\\s*b\\.?\\s*H\\.?|Gesellschaft\\s+mit\\s+beschr[äa]nkter\\s+Haftung|Aktiengesellschaft|AG|Kommanditgesellschaft|KG|PLC|S\\.?L\\.?U\\.?|S\\.?A\\.?U\\.?|S\\.?L\\.?|S\\.?A\\.?|Sociedad\\s*Limitada(?:\\s*Unipersonal)?|Sociedad\\s*An[oó]nima(?:\\s*Unipersonal)?|S\\.?r\\.?l\\.?s?|S\\.?p\\.?A\\.?|Besloten\\s*Vennootschap|Naamloze\\s*Vennootschap|B\\.?V\\.?|N\\.?V\\.?|Tbk\\.?|Terbuka|Sp\\.?\\s*z\\.?\\s*o\\.?\\s*o\\.?|Sp[oó][lł]ka\\s+z\\s+ograniczon[aą]\\s+odpowiedzialno[sś]ci[aą]|Sp\\.?\\s*k\\.?|SARL|SASU?|EURL|SPRL|BVBA|s\\.?r\\.?o\\.?|d\\.?o\\.?o\\.?|Kft\\.?|Zrt\\.?|Ltda\\.?|ApS|Oyj?|SE|Societas\\s+Europaea";

const COMPANY_PROSE_NOISE_RE =
  /\b(?:was|were|is|are|am|been|being|became|become|began|started|transformed|renamed|converted|rebranded|relocated|acquired|merged|operates|provides|offers|produces|manufactures|supplies|distributes|specializes|into|onto|because|although|however|therefore|which|whose|whom)\b/i;

function hasCompanyProseNoise(name) {
  if (!name || typeof name !== "string") return false;
  if (COMPANY_PROSE_NOISE_RE.test(name)) return true;
  // Detect 3+ consecutive lowercase non-connector words (narrative sentence body text)
  const words = name.trim().split(/\s+/);
  const allowedLowerConnectors = /^(?:of|and|for|the|in|at|on|by|to|from|with|van|der|den|von|und|mit|für|fur|auf|aus|des|les|los|las|del|de|da|do|du|la|le|et|y|e|a|u|o|z|w|i|mbh|beschränkter|beschrankter|haftung|ograniczoną|odpowiedzialnością|responsabilité|responsabilite|limitée|limitee|responsabilità|azioni|capital|variable)$/i;
  let lowerRun = 0;
  for (const w of words) {
    const cleanW = w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!cleanW) continue;
    if (/^[a-z]{3,}$/.test(cleanW) && !allowedLowerConnectors.test(cleanW)) {
      lowerRun++;
      if (lowerRun >= 2) return true;
    } else {
      lowerRun = 0;
    }
  }
  return false;
}

function stripProseClausesFromCompanyName(rawName) {
  if (!rawName || typeof rawName !== "string") return "";
  let n = rawName.trim();
  // Strip chained transition/narrative clauses where the actual target entity follows on the right
  n = n.replace(/^.*?\b(?:(?:was|were|is|are|has\s+been|have\s+been)?\s*(?:transformed|converted|rebranded)\s+(?:into|to)|(?:was|were|is|are|has\s+been|have\s+been)\s+(?:renamed|called|known\s+as)|changed\s+(?:its|our|the)\s+name\s+to|(?:(?:this\s+)?(?:website|site|store|shop|portal|platform|domain)\s+(?:is\s+)?)?(?:operated|owned|managed|run)\s+by|all\s+products\s+(?:are\s+)?(?:manufactured|made|supplied|distributed)\s+by)\b\s*[:\-–—]?\s*/i, "").trim();
  // Strip explicit leading field labels even when chained (e.g. "Company information Company name: X")
  let prev = "";
  while (prev !== n) {
    prev = n;
    n = n.replace(/^(?:company\s*information|contact\s*details|company\s*details|company\s*name|legal\s*name|registered\s*name|official\s*name|business\s*name|entity\s*name|organization\s*name|vendor\s*name|nazwa\s*firmy|firma|name)\b\s*[:\-–—]?\s*/i, "").trim();
  }
  return n;
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

  // 1a. Strip embedded prose/transition clauses & field labels (e.g. "Engineering Was Transformed Into Mechatronic Systems GmbH")
  name = stripProseClausesFromCompanyName(name);

  // 1b. Strip embedded CTA / navigational breadcrumbs if present:
  // e.g. "Aerospace Contact Us Data Plastics Ltd" -> "Data Plastics Ltd"
  name = name.replace(/^.*?\b(?:contact(?:\s+us)?|about(?:\s+us)?|welcome(?:\s+to(?:\s+(?:the|our)\s+(?:official\s+)?(?:website|site|home\s*page|store|portal)(?:\s+of)?)?)?|get\s+in\s+touch(?:\s+with)?|reach\s+us|visit\s+us|find\s+us)\b\s*[:\-–—|•·*\/]?\s*/i, "").trim();
  name = name.replace(/^(?:(?:[A-Za-z0-9\s]{1,30}\s+[•·|*]\s+)|(?:(?:home|about(?:\s+us)?|contact(?:\s+us)?|products?|services?|shop|store|catalog|news|blog)\s*\/\s+))/i, "").trim();

  // 2. Strip common unwanted leading prefixes (iterative loop to handle chained prefixes like "Submit scroll to top Contact")
  const prefixRegex = /^(?:(?:company\s*information|company\s*details|contact\s*details|company\s*name|legal\s*name|registered\s*name|official\s*name|business\s*name|nazwa\s*firmy|firma|contact(?:\s+us)?(?:\s+today)?|about(?:\s+us)?(?:\s+(?:the|our)\s+company)?|welcome(?:\s+to(?:\s+(?:the|our)\s+(?:official\s+)?(?:website|site|home\s*page|store|portal)(?:\s+of)?)?)?|visit(?:\s+us(?:\s+at)?)?|home(?:\s+page)?|find(?:\s+us(?:\s+at)?)?|meet(?:\s+our)?|discover|explore|introducing|overview\s+of|profile\s+of|call(?:\s+us)?|email(?:\s+us)?|click\s+here(?:\s+to)?|submit|scroll\s+to\s+top|back\s+to\s+top|read\s+more\s+about|learn\s+more\s+about|policy|privacy(?:\s+notice|\s+policy)?(?:\s+of)?|this\s+is\s+the\s+(?:privacy\s+notice|privacy\s+policy|website|official\s+site)\s+of|copyright(?:\s*(?:©|\(c\)))?(?:\s*\d{4})?(?:\s+by)?|powered\s+by|designed\s+by|website\s+by|skip\s+to\s+content|official\s+website\s+of|get\s+in\s+touch(?:\s+with)?|connect\s+with|menu|logo|facebook|instagram|linkedin|twitter|youtube|pinterest|tiktok|vimeo|social\s*media|follow\s*us|connect\s*with\s*us)\b[\s\-_|:•·,]*)+/i;

  let prev = "";
  while (prev !== name) {
    prev = name;
    name = stripProseClausesFromCompanyName(name);
    name = name.replace(prefixRegex, "").trim();
    name = name.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
  }

  // 3. Strip trailing marketing taglines / SEO categories / profile fields if corporate legal suffix is already present
  // e.g. "Danzer UK Limited - Timber Merchants Suppliers of Hardwoods" -> "Danzer UK Limited"
  // e.g. "YUKIWA SEIKO USA INC. Drill Chucks, Tool Holder..." -> "YUKIWA SEIKO USA INC."
  const legalSuffixCutoff = new RegExp(`\\b(${LEGAL_ENTITY_SUFFIX_CORE}|Limited\\s+Liability\\s+(?:Company|Partnership)|Public\\s+Limited\\s+Company|Proprietary\\s+Limited|Private\\s+Limited|Sendirian\\s+Berhad|Joint\\s+Stock\\s+Company|Societas\\s+Europaea|Soci[eé]t[eé]\\s+[aà]\\s+Responsabilit[eé]\\s+Limit[eé]e|Soci[eé]t[eé]\\s+par\\s+Actions\\s+Simplifi[eé]e|Societ[aà]\\s+per\\s+Azioni|Societ[aà]\\s+a\\s+Responsabilit[aà]\\s+Limitata|Aktiebolag|Aksjeselskap|Osakeyhti[oö])\\b(?:\\s*[-–—|:•·,]\\s*|\\s+(?:Drill|Tool|Rotary|Spring|Chucks|Holder|Tables|Collets|Manufacturer|Supplier|Wholesaler|Distributor|Products|Services|Solutions|Store|Shop|Leading|Specialists|Machining|Precision|Online|Official|CEO|VAT|NIP|KRS|Tel|Phone|Email|Address|All\\s+Rights|Is\\s+A|Began|Started|Provides|Offers|Manufactures)\\b|\\.\\s+[A-Z]).*$`, "i");
  name = name.replace(legalSuffixCutoff, "$1");

  // 4. Strip trailing SEO taglines even without separator if starts with " - Manufacturer of...", " | Suppliers of..."
  name = name.replace(/\s*[-–—|:•·]\s*(?:manufacturer|supplier|wholesaler|distributor|timber\s*merchants|specialists|services|official\s*website|home|online\s*store).*$/i, "");

  // 4b. Strip dangling truncated German legal fragment (e.g. "... Systems Ges" truncated from Ges.m.b.H.)
  name = name.replace(/\s+\bGes\.?$/i, "");

  // 5. Clean boundary punctuation and special characters per Rule 4
  // Rule: Special character should not start and should not end
  return stripBoundarySpecialChars(name);
}

/**
 * Extracts candidate official registered legal corporate names from HTML text
 * across all crawled pages (e.g. from ABN/ACN/registration anchors, terms/authority clauses, copyright, and legal suffixes).
 */
function extractLegalCandidatesFromHtml(html) {
  if (!html) return [];
  const rawText = html.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:a|span|p|div|h[1-6]|li|td|tr|th|header|footer|nav|section|article|aside|caption|blockquote|ul|ol|table|br\s*\/?)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ");
  const text = decodeHtmlEntities(rawText);

  const candidates = new Set();

  function addCleanCandidate(rawCand) {
    if (!rawCand) return;
    // Strip leading connector words at the very beginning like "and", "the", "or", "from", "with", "between"
    let candidateToClean = rawCand.replace(/^(?:and|or|by|for|with|from|including|between|the|to|at|arises|into|as)\s+/i, "").trim();
    const cleaned = cleanCompanyPrefixesAndSuffixes(candidateToClean || rawCand);
    if (!cleaned || hasCompanyProseNoise(cleaned)) return;
    // Reject third-party job portals, HR platforms, web hosts, CMS, analytics, payment gateways
    if (/\b(?:Dayforce|Ceridian|Workday|BambooHR|Zenefits|Paychex|ADP|UltiPro|Greenhouse|Lever|Jobvite|SmartRecruiters|iCIMS|WordPress|Shopify|Wix|Squarespace|Cloudflare|Google|Facebook|Meta|Twitter|LinkedIn|Instagram|YouTube|Adobe|Salesforce|PayPal|Stripe)\b/i.test(cleaned)) {
      return;
    }
    if (cleaned.length >= 3 && cleaned.length <= 75 && !/^(?:and|the|for|with|from|including|our|your|their|loss|damage|expenses|costs)\b/i.test(cleaned) && !/^all\s+(?:rights|damages|losses|claims|disclaimers)\b/i.test(cleaned)) {
      candidates.add(cleaned);
    }
  }

  // Pattern 0: Explicit labeled company / legal name lines (e.g. "Company name: Mechatronic Engineering Sp.z.o.o")
  const labeledNameRegex = /(?:^|[\n\r|])\s*(?:company\s*name|legal\s*name|registered\s*name|official\s*name|business\s*name|nazwa\s*firmy|firma)\s*[:：]\s*([^\n\r|<]{3,85})/gi;
  let m;
  while ((m = labeledNameRegex.exec(text)) !== null) {
    if (m[1]) {
      const cut = m[1].split(/\s+(?:CEO|VAT|NIP|KRS|REGON|ABN|ACN|Tel|Phone|E-?mail|Address|Localization)\b[:：\s]?/i)[0].trim();
      if (cut && cut.length >= 3) addCleanCandidate(cut);
    }
  }

  // Pattern 1: ABN / ACN / CIF / NIF preceded or followed by company name
  const abnNearRegex = new RegExp(`([A-Z0-9][A-Za-z0-9\\u00C0-\\u024F&,.'\\- ]{2,55}\\s+(?:${LEGAL_ENTITY_SUFFIX_CORE}))[^\\.\\n\\r<]{0,60}?(?:ABN|ACN|Registration\\s*No|Reg\\s*No|CIF|NIF|VAT|NIP|KRS)[\\s:]*[A-Z0-9][- ]*\\d[\\d\\s\\-]{4,15}[A-Z0-9]?`, "gi");
  while ((m = abnNearRegex.exec(text)) !== null) {
    if (m[1]) addCleanCandidate(m[1].trim());
  }

  // Reverse: ABN / CIF / VAT / NIP followed by name
  const abnBeforeRegex = new RegExp(`(?:ABN|ACN|Registration\\s*No|Reg\\s*No|CIF|NIF|VAT|NIP|KRS)[\\s:]*[A-Z0-9][- ]*\\d[\\d\\s\\-]{4,15}[A-Z0-9]?[^\\.\\n\\r<]{0,60}?([A-Z0-9][A-Za-z0-9\\u00C0-\\u024F&,.'\\- ]{2,55}\\s+(?:${LEGAL_ENTITY_SUFFIX_CORE}))`, "gi");
  while ((m = abnBeforeRegex.exec(text)) !== null) {
    if (m[1]) addCleanCandidate(m[1].trim());
  }

  // Pattern 2: "means [Name] Pty Ltd", "operated by [Name] Pty Ltd", "authority of [Name] Pty Ltd", "trading as [Name] Pty Ltd"
  const legalContextRegex = new RegExp(`(?:means|operated\\s+by|registered\\s+as|trading\\s+as|property\\s+of|authority\\s+of)\\s+([A-Z0-9][A-Za-z0-9\\u00C0-\\u024F&,.'\\- ]{2,55}\\s+(?:${LEGAL_ENTITY_SUFFIX_CORE}))`, "gi");
  while ((m = legalContextRegex.exec(text)) !== null) {
    if (m[1]) addCleanCandidate(m[1].trim());
  }

  // Pattern 3: Explicit legal suffix preceded by capitalized words (trimming any prose clauses via addCleanCandidate)
  const generalLegalRegex = new RegExp(`\\b((?:[A-Z0-9\\u00C0-\\u024F][a-zA-Z0-9\\u00C0-\\u024F&.'\\-]*(?:[^\\S\\r\\n]+(?:&|[A-Z0-9\\u00C0-\\u024F][a-zA-Z0-9\\u00C0-\\u024F&.'\\-]*)){0,5})(?:,[^\\S\\r\\n]*|[^\\S\\r\\n]+)(?:${LEGAL_ENTITY_SUFFIX_CORE})(?:\\.|\\b))`, "gi");
  while ((m = generalLegalRegex.exec(text)) !== null) {
    let cand = m[1].trim();
    // Strip leading sentence prose before capitalized company core (e.g. "Engineering was transformed into Mechatronic Systems GmbH" -> "Mechatronic Systems GmbH")
    cand = stripProseClausesFromCompanyName(cand);
    const words = cand.split(/\s+/);
    const suffixTestRe = new RegExp(`^(?:${LEGAL_ENTITY_SUFFIX_CORE})\\.?$`, "i");
    const safeConnectorRe = /^(?:of|and|for|the|van|der|den|von|und|mit|für|fur|auf|aus|des|les|los|las|del|de|da|do|du|la|le|et|y|e|z|w|i|mbh)$/i;
    let cutIdx = 0;
    for (let i = 0; i < words.length; i++) {
      const cleanW = words[i].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      if (suffixTestRe.test(cleanW) || suffixTestRe.test(words.slice(i).join(" "))) break;
      if (/^[a-z]{2,}$/.test(cleanW) && !safeConnectorRe.test(cleanW)) {
        cutIdx = i + 1;
      }
    }
    if (cutIdx > 0 && cutIdx < words.length) {
      cand = words.slice(cutIdx).join(" ").trim();
    }
    if (!/\b(?:loss|damage|expenses|costs|disbursements|information|services|warranties|discretion|price)\b/i.test(cand) &&
      !/^(?:and|the|for|with|from|including|our|your|their)\b/i.test(cand) &&
      !/^all\s+(?:rights|damages|losses|claims|disclaimers)\b/i.test(cand) &&
      cand.length >= 3 && cand.length <= 75) {
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

const LEGAL_SUFFIX_CAPTURE =
  "((?:[\\(\\[]?\\s*(?:pty|pte|pvt|sdn|bhd|co\\.?|corp\\.?|inc\\.?|llc|llp|pllc|gmbh|ges\\.?m\\.?b\\.?h\\.?|sa|bv|nv|ag|kg|oy|ab|as|m|malaysia)\\s*[\\)\\]]?[\\s,]*){0,3}(?:ltd\\.?|limited|inc\\.?|incorporated|bhd\\.?|berhad|sdn[\\.\\s]+bhd\\.?|sendirian\\s*berhad|llc|pllc|llp|gmbh(?:\\s*(?:&|\\+|und|and|u\\.)\\s*co\\.?\\s*kg)?|ges\\.?\\s*m\\.?\\s*b\\.?\\s*h\\.?|gesellschaft\\s+mit\\s+beschr[äa]nkter\\s+haftung(?:\\s+and\\s+compagnie\\s+kommanditgesellschaft)?|aktiengesellschaft|kommanditgesellschaft|ag|kg|sp\\.?\\s*z\\.?\\s*o\\.?\\s*o\\.?|sp[oó][lł]ka\\s+z\\s+ograniczon[aą]\\s+odpowiedzialno[sś]ci[aą]|sp\\.?\\s*k\\.?|s\\.?r\\.?l\\.?s?|s\\.?p\\.?a\\.?|s\\.?l\\.?u?\\.?|s\\.?a\\.?u?\\.?|sarl|sasu?|eurl|eirl|sprl|bvba|sociedad\\s*limitada|sociedad\\s*an[oó]nima|tbk\\.?|terbuka|plc\\.?|corp\\.?|corporation|company\\s+limited|proprietary\\s+limited|private\\s+limited|besloten\\s*vennootschap|b\\.?v\\.?|n\\.?v\\.?|joint\\s+stock\\s+company|societas\\s+europaea|limitada|ltda\\.?|p?jsc|sro|doo|kft|zrt|oyj?|aps))";

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
        if (/Organization|LocalBusiness|Corporation|Company/i.test(type)) {
          const legal = typeof item.legalName === "string" ? item.legalName.trim() : "";
          const brand = typeof item.name === "string" ? item.name.trim() : "";
          if (legal && legal.length >= 2 && legal.length <= 120 && !hasCompanyProseNoise(legal)) {
            return legal;
          }
          if (brand && !hasCompanyProseNoise(brand)) {
            return brand;
          }
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
  // Complete forms across countries (including Sp. z o.o. / Sp.z.o.o, Ges.m.b.H., S.r.l., S.p.A.)
  if (/\b(?:sp\.?\s*z\.?\s*o\.?\s*o|sp\.?\s*k|ges\.?\s*m\.?\s*b\.?\s*h|s\.?\s*r\.?\s*l\.?\s*s?|s\.?\s*p\.?\s*a|e\.?\s*u\.?\s*r\.?\s*l|s\.?\s*r\.?\s*o|d\.?\s*o\.?\s*o|k\.?\s*f\.?\s*t|z\.?\s*r\.?\s*t|o\.?\s*y\.?j?|a\.?\s*p\.?\s*s|b\.?\s*v\.?\s*b\.?\s*a|s\.?\s*p\.?\s*r\.?\s*l)\b\.?/i.test(n)) {
    return true;
  }
  return /\b(proprietary\s+limited|private\s+limited|public\s+limited\s+company|sendirian\s+berhad|berhad|perkongsian\s+liabiliti\s+terhad|limited\s+liability\s+(?:company|partnership)|gesellschaft\s+mit\s+beschr[äa]nkter\s+haftung|aktiengesellschaft|kommanditgesellschaft|offene\s+handelsgesellschaft|unternehmergesellschaft|eingetragener\s+kaufmann|sociedad\s+limitada|sociedad\s+an[oó]nima|societ[aà]\s+(?:a\s+responsabilit[aà]\s+limitata|per\s+azioni|in\s+accomandita\s+semplice|in\s+nome\s+collettivo)|soci[eé]t[eé]\s+(?:[aà]\s+responsabilit[eé]\s+limit[eé]e|par\s+actions\s+simplifi[eé]e|anonyme)|compagnie|cie|besloten\s+vennootschap|naamloze\s+vennootschap|sp[oó][lł]ka\s+z\s+ograniczon[aą]\s+odpowiedzialno[sś]ci[aą]|aktiebolag|aksjeselskap|osakeyhti[oö]|terbuka|tbk|gmbh|ag|kg|llc|llp|pllc|ltd|limited|inc|incorporated|incorporation|plc|corp|corporation|joint\s+stock\s+company|societas\s+europaea|limitada|společnost\s+s\s+ručením\s+omezeným|društvo\s+s\s+ograničenom\s+odgovornošću|korlátolt\s+felelősségű\s+társaság|jsc|pjsc|ojsc|cjsc|sro|doo|kft|zrt|ltda|aps|oyj?|sarl|sas|sasu|eurl|sprl|bv|nv|srl|spa|sl|sa|bvba|eirl)\b/i.test(n);
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
  // Prioritize authoritative metadata/copyright/JSON-LD legal names ahead of general body candidates and filter out prose noise.
  const titleCandidate = cleanCompanyPrefixesAndSuffixes(extractBestBrandFromTitle(title, domain, logoText, ogSiteName));
  const logoCandidate = cleanCompanyPrefixesAndSuffixes(logoText);
  const allCandidates = Array.from(new Set([jsonLdName, copyrightName, ...legalCandidates, logoCandidate, titleCandidate]
    .map(n => cleanCompanyPrefixesAndSuffixes(n))
    .filter(n => n && n.length >= 3 && n.length <= 160 && !hasCompanyProseNoise(n))));

  let bestOfficial = null;
  let bestScore = -1;

  for (const official of allCandidates) {
    const hasSuffix = hasCompleteLegalSuffix(official) || /\b(?:ltd|limited|inc|llc|llp|corp|pty|pte|pvt|sdn|bhd|gmbh|plc|company|co)\b/i.test(official);
    const hasSymbolMatch = (
      (official.includes("&") && current.toLowerCase().includes(" and ")) ||
      (official.includes("+") && current.toLowerCase().includes(" plus ")) ||
      (official.includes("@") && current.toLowerCase().includes(" at ")) ||
      (official.includes("%") && /\bper\s*cent\b/i.test(current)) ||
      (official.includes("/") && /\bslash\b/i.test(current)) ||
      (official.includes("&") && companyNamesMatch(current, official))
    );
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

    // Boost candidate matching copyright text and Schema.org JSON-LD name/legalName
    const copyMatch = copyrightName && (offNorm === normalizeNameForComparison(copyrightName) || companyNamesMatch(copyrightName, official));
    const jsonLdNorm = normalizeNameForComparison(jsonLdName);
    const jsonLdExact = jsonLdNorm && offNorm === jsonLdNorm && hasCompleteLegalSuffix(jsonLdName);
    if (copyMatch) {
      score += (offNorm === normalizeNameForComparison(copyrightName)) ? 130 : 80;
    }
    if (jsonLdExact) {
      score += 120;
    }
    if (copyMatch && jsonLdExact) {
      score += 80;
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
 * Restores original symbols (such as "&", "+", "@", "%", "/") in company name when AI incorrectly
 * expanded them to words ("And", "Plus", "At", "Percent", "Slash"), and strips extraneous "Company"
 * when the official website brand is without "Company".
 * Strictly satisfies QC rule: "dont expand special charaters"
 */
function restoreOriginalSymbolsInCompanyName(name, crawlData) {
  if (!name || typeof name !== "string") return name;
  let n = name;

  const evidenceSources = [
    crawlData && crawlData.logoText,
    crawlData && crawlData.ogSiteName,
    crawlData && crawlData.title,
    crawlData && crawlData.copyrightText,
    ...(crawlData && crawlData.legalCompanyCandidates || []),
    ...(crawlData && crawlData.companySocials ? Object.values(crawlData.companySocials) : []),
    crawlData && crawlData.contactHtml,
    crawlData && crawlData.renderedText,
    crawlData && crawlData.bodyText,
    crawlData && crawlData.mainHtml
  ].filter(Boolean);

  const combinedEvidence = decodeHtmlEntities(evidenceSources.join(" "));
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // 1. Restore symbols when AI/upstream expanded them to words
  const symbolSpecs = [
    { sym: "&", words: ["And"] },
    { sym: "+", words: ["Plus"] },
    { sym: "@", words: ["At"] },
    { sym: "%", words: ["Percent", "Per\\s+Cent"] },
    { sym: "/", words: ["Slash", "Or"] },
    { sym: "#", words: ["Number", "Hash"] }
  ];

  const expandedRightMap = {
    company: "co\\.?",
    limited: "ltd\\.?",
    incorporated: "inc\\.?",
    corporation: "corp\\.?",
    manufacturing: "mfg\\.?",
    industries: "ind(?:s)?\\.?",
    industrial: "ind(?:l)?\\.?",
    engineering: "eng(?:g|r)?\\.?",
    brothers: "bros\\.?",
    associates: "assoc(?:s)?\\.?",
    solutions: "sol(?:n|ns|s)\\.?",
    services: "svc(?:s)?\\.?",
    products: "prod(?:s)?\\.?",
    technologies: "tech(?:s)?\\.?",
    technology: "tech\\.?"
  };

  for (const spec of symbolSpecs) {
    if (!combinedEvidence.includes(spec.sym)) continue;
    const symEsc = escRe(spec.sym);
    const wordAlt = spec.words.join("|");
    // Repeat up to 3 passes so chained symbols (e.g. "A And B And C" -> "A&B&C") all restore
    for (let pass = 0; pass < 3; pass++) {
      const pairRegex = new RegExp(`([\\p{L}\\p{N}.'\\-]+)\\s+(?:${wordAlt})\\s+([\\p{L}\\p{N}.'\\-]+)`, "giu");
      const updated = n.replace(pairRegex, (match, p1, p2) => {
        const p1Esc = escRe(p1);
        const p2Esc = escRe(p2);
        const p2Abbr = expandedRightMap[p2.toLowerCase()];
        const p2Group = p2Abbr ? `(?:${p2Esc}|${p2Abbr})` : p2Esc;
        const noSpaceRegex = new RegExp(`(?:^|[^\\p{L}\\p{N}])${p1Esc}${symEsc}${p2Group}(?:$|[^\\p{L}\\p{N}])`, "iu");
        const spaceRegex = new RegExp(`(?:^|[^\\p{L}\\p{N}])${p1Esc}\\s+${symEsc}\\s+${p2Group}(?:$|[^\\p{L}\\p{N}])`, "iu");
        if (noSpaceRegex.test(combinedEvidence)) {
          return `${p1}${spec.sym}${p2}`;
        }
        if (spaceRegex.test(combinedEvidence)) {
          return `${p1} ${spec.sym} ${p2}`;
        }
        return match;
      });
      if (updated === n) break;
      n = updated;
    }
    if (spec.sym === "%") {
      // Handle standalone "100 Percent ..." when evidence has "100%"
      n = n.replace(/(\b\d+(?:\.\d+)?)\s+(?:Percent|Per\s+Cent)\b/gi, (match, num) => {
        const pctRegex = new RegExp(`(?:^|[^\\d])${escRe(num)}%`, "i");
        return pctRegex.test(combinedEvidence) ? `${num}%` : match;
      });
    }
    if (spec.sym === "#") {
      n = n.replace(/\b(?:Number|Hash)\s+(\d+[A-Za-z]?)\b/gi, (match, num) => {
        const hashRegex = new RegExp(`(?:^|[^\\p{L}\\p{N}])#${escRe(num)}\\b`, "iu");
        return hashRegex.test(combinedEvidence) ? `#${num}` : match;
      });
    }
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
    "PEM", "FP", "HR", "CRP", "SMC", "THK", "NSK", "NTN", "IKO", "INA", "FAG", "FESTO", "CKD", "ABB", "SKF", "GE", "HP", "LG", "JVC", "TDK", "NEC", "ECU"
  ]);
  const titleAndLogo = ((crawlData && crawlData.title) || "") + " " + ((crawlData && crawlData.logoText) || "");
  n = n.replace(/\b[A-Za-z0-9]{2,4}\b/g, (word) => {
    const up = word.toUpperCase();
    if (upperAcronyms.has(up)) return up;
    const exactUpperRegex = new RegExp(`(^|[^A-Za-z0-9])${up}([^A-Za-z0-9]|$)`);
    if ((exactUpperRegex.test(titleAndLogo) || exactUpperRegex.test(combinedEvidence)) && !/^(?:AND|THE|FOR|WITH|FROM|INTO|ONTO|PAGE|VIEW|HOME|MENU|NEWS|SITE)$/i.test(up)) {
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

  // 1. Check legal company candidates discovered across all pages (reject prose noise or oversized unrelated prefix additions)
  const cleanTokensCount = cleanName.replace(/[^a-zA-Z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean).length;
  const legalCandidates = (crawlData && crawlData.legalCompanyCandidates) || [];
  for (const rawCand of legalCandidates) {
    const cand = cleanCompanyPrefixesAndSuffixes(rawCand);
    if (!cand || hasCompanyProseNoise(cand)) continue;
    const candTokensCount = cand.replace(/[^a-zA-Z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean).length;
    // Allow expanding a legal suffix (+1..6 words for multi-word suffixes like Sp. z o.o. / LLC / GMBH), but block unrelated extra leading prose words
    const candStartsLikeClean = normalizeNameForComparison(cand).startsWith(normalizeNameForComparison(cleanName).slice(0, 6));
    if (hasCompleteLegalSuffix(cand) && companyNamesMatch(cleanName, cand) && (candStartsLikeClean || candTokensCount <= cleanTokensCount + 4)) {
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

  // 4. Indonesia entities (prefix and suffix; \b before optional dot so "P.T. " matches)
  n = n.replace(/(^|[\s,])(?:p\.?\s*t)\b\.?\s+/gi, "$1Perseroan Terbatas ");
  n = n.replace(/(^|[\s,])(?:p\.?\s*t)\b\.?$/gi, "$1Perseroan Terbatas");
  n = n.replace(/(^|[\s,])(?:c\.?\s*v)\b\.?\s+/gi, "$1Commanditaire Vennootschap ");
  n = n.replace(/(^|[\s,])(?:c\.?\s*v)\b\.?$/gi, "$1Commanditaire Vennootschap");
  n = n.replace(/(^|[\s,])(?:u\.?\s*d)\b\.?\s+/gi, "$1Usaha Dagang ");
  n = n.replace(/(^|[\s,])(?:u\.?\s*d)\b\.?$/gi, "$1Usaha Dagang");
  n = n.replace(/(^|[\s,])(?:p\.?\s*d)\b\.?\s+/gi, "$1Perusahaan Daerah ");
  n = n.replace(/(^|[\s,])(?:p\.?\s*d)\b\.?$/gi, "$1Perusahaan Daerah");
  if ((country || "").toLowerCase().includes("indonesia")) {
    n = n.replace(/(^|[\s,])(?:f\.?\s*a)\b\.?\s+/gi, "$1Firma ");
  }
  n = n.replace(/\b(?:tbk)\b\.?/gi, "Terbuka");

  // 5. Malaysia entities
  n = n.replace(/\bsdn\.?\s*bhd\b\.?/gi, "Sendirian Berhad");
  n = n.replace(/\bsdn\b\.?/gi, "Sendirian");
  n = n.replace(/\bbhd\b\.?/gi, "Berhad");
  n = n.replace(/\bplt\b\.?/gi, "Perkongsian Liabiliti Terhad");

  // 6. Germany / Austria / Switzerland (DACH)
  // Preserve special characters like "&" or "+" unexpanded (do NOT turn "&" / "+" into "and")
  n = n.replace(/\bgmbh\s*(&|\+|und|and|u\.?)\s*co\.?\s*kg\.?/gi, (_, op) => {
    const conn = /^(&|\+)$/.test(op) ? op : (/^and$/i.test(op) ? "and" : "und");
    return `Gesellschaft mit beschränkter Haftung ${conn} Compagnie Kommanditgesellschaft`;
  });
  n = n.replace(/\bgmbh\s*(&|\+|und|and|u\.?)\s*co\b\.?/gi, (_, op) => {
    const conn = /^(&|\+)$/.test(op) ? op : (/^and$/i.test(op) ? "and" : "und");
    return `Gesellschaft mit beschränkter Haftung ${conn} Compagnie`;
  });
  n = n.replace(/\b(?:g[\.\s]*m[\.\s]*b[\.\s]*h|gmbh|ges[\.\s]*m[\.\s]*b[\.\s]*h|gesmbh)\b\.?/gi, "Gesellschaft mit beschränkter Haftung");
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
  n = n.replace(/\b(?:s[\.\s]*r[\.\s]*l[\.\s]*s|srls)\b\.?/gi, "Società a Responsabilità Limitata Semplificata");
  n = n.replace(/\b(?:s[\.\s]*c[\.\s]*a[\.\s]*r[\.\s]*l|scarl)\b\.?/gi, "Società Cooperativa a Responsabilità Limitata");
  n = n.replace(/\b(?:s[\.\s]*c[\.\s]*p[\.\s]*a|scpa)\b\.?/gi, "Società Cooperativa per Azioni");
  n = n.replace(/\b(?:s[\.\s]*r[\.\s]*l|srl)\b\.?/gi, "Società a Responsabilità Limitata");
  n = n.replace(/\b(?:s[\.\s]*p[\.\s]*a|spa)\b\.?/gi, "Società per Azioni");
  n = n.replace(/\b(?:s[\.\s]*n[\.\s]*c|snc)\b\.?/gi, "Società in Nome Collettivo");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*s|sas)\b\.?/gi, "Società in Accomandita Semplice");
  if (/italy|italia/i.test(country)) {
    n = n.replace(/\bs[\.\s]*s\b\.?/gi, "Società Semplice");
  }

  // 8. Spanish, Portuguese & Latin America entities
  n = n.replace(/\b(?:s[\.\s]*l[\.\s]*u|slu)\b\.?/gi, "Sociedad Limitada Unipersonal");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*u|sau)\b\.?/gi, "Sociedad Anónima Unipersonal");
  n = n.replace(/\b(?:s[\.\s]*l|sl)\b\.?/gi, "Sociedad Limitada");
  n = n.replace(/\b(?:s[\.\s]*a|sa)\b\.?/gi, "Sociedad Anónima");
  n = n.replace(/\b(?:s[\.\s]*c[\.\s]*p|scp)\b\.?/gi, "Sociedad Civil Privada");
  n = n.replace(/\b(?:s[\.\s]*coop|scoop)\b\.?/gi, "Sociedad Cooperativa");
  n = n.replace(/\b(?:u[\.\s]*n[\.\s]*i[\.\s]*p(?:essoal)?\.?\s*lda)\b\.?/gi, "Unipessoal Limitada");
  n = n.replace(/\b(?:l[\.\s]*t[\.\s]*d[\.\s]*a|ltda)\b\.?/gi, "Limitada");
  n = n.replace(/\b(?:lda)\b\.?$/gi, "Limitada");
  n = n.replace(/\b(?:c[\.\s]*i[\.\s]*a|cia)\b\.?/gi, "Compañía");

  // 9. France & Belgium
  n = n.replace(/\b(?:c[\.\s]*i[\.\s]*e|cie)\b\.?/gi, "Compagnie");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*r[\.\s]*l|sarl)\b\.?/gi, "Société à Responsabilité Limitée");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*s[\.\s]*u|sasu)\b\.?/gi, "Société par Actions Simplifiée Unipersonnelle");
  n = n.replace(/\b(?:s[\.\s]*a[\.\s]*s|sas)\b\.?/gi, "Société par Actions Simplifiée");
  n = n.replace(/\b(?:s[\.\s]*p[\.\s]*r[\.\s]*l|sprl)\b\.?/gi, "Société Privée à Responsabilité Limitée");
  n = n.replace(/\b(?:b[\.\s]*v[\.\s]*b[\.\s]*a|bvba)\b\.?/gi, "Besloten Vennootschap met Beperkte Aansprakelijkheid");

  // 10. Netherlands & Belgium
  n = n.replace(/\b(?:b[\.\s]*v|bv)\b\.?/gi, "Besloten Vennootschap");
  n = n.replace(/\b(?:n[\.\s]*v|nv)\b\.?/gi, "Naamloze Vennootschap");
  n = n.replace(/\b(?:v[\.\s]*o[\.\s]*f|vof)\b\.?/gi, "Vennootschap onder Firma");

  // 11. Poland
  n = n.replace(/\b(?:sp\.?\s*z\.?\s*o\.?\s*o|sp[oó][lł]ka\s+z\s+o\.?o)\b\.?/gi, "Spółka z ograniczoną odpowiedzialnością");

  // 12. Eastern Europe & Russia (Joint Stock Companies)
  n = n.replace(/\b(?:p[\.\s]*j[\.\s]*s[\.\s]*c|pjsc)\b\.?/gi, "Public Joint Stock Company");
  n = n.replace(/\b(?:o[\.\s]*j[\.\s]*s[\.\s]*c|ojsc)\b\.?/gi, "Open Joint Stock Company");
  n = n.replace(/\b(?:c[\.\s]*j[\.\s]*s[\.\s]*c|cjsc)\b\.?/gi, "Closed Joint Stock Company");
  n = n.replace(/\b(?:j[\.\s]*s[\.\s]*c|jsc)\b\.?/gi, "Joint Stock Company");

  // 13. Czechia, Slovakia, Hungary, Balkans
  n = n.replace(/\b(?:spol\.?\s*s\.?\s*r\.?\s*o|s[\.\s]*r[\.\s]*o|sro)\b\.?/gi, "společnost s ručením omezeným");
  n = n.replace(/\b(?:a[\.\s]*s|akc\.?\s*spol)\b\.?(?!\s+(?:de\s+c\.?v\.?))/gi, "akciová společnost");
  n = n.replace(/\b(?:d[\.\s]*o[\.\s]*o|doo)\b\.?/gi, "društvo s ograničenom odgovornošću");
  n = n.replace(/\b(?:k[\.\s]*f[\.\s]*t|kft)\b\.?/gi, "Korlátolt Felelősségű Társaság");
  n = n.replace(/\b(?:z[\.\s]*r[\.\s]*t|zrt)\b\.?/gi, "Zártkörűen működő Részvénytársaság");
  n = n.replace(/\b(?:n[\.\s]*y[\.\s]*r[\.\s]*t|nyrt)\b\.?/gi, "Nyilvánosan működő Részvénytársaság");

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

  // 17. Pan-European (SE -> Societas Europaea mandatory expansion per Rule 4)
  n = n.replace(/\b(?:s[\.\s]*e|se)\b\.?(?=\s*[,)]?\s*$)/gi, "Societas Europaea");

  // 18. Common Business, Technical, and Industry Word Abbreviations in Company Names
  // Manufacturing / Makers
  n = n.replace(/\b(?:mfg|manuf|mnfg)[\.\s]*co[\.\s]*(,)?[\.\s]*l[\.\s]*t[\.\s]*d\b\.?/gi, (match, comma) => {
    return comma ? "Manufacturing Company, Limited" : "Manufacturing Company Limited";
  });
  n = n.replace(/\b(?:mfg|manuf|mnfg)\b\.?/gi, "Manufacturing");
  n = n.replace(/\bmfrs\b\.?/gi, "Manufacturers");
  n = n.replace(/\bmfr\b\.?/gi, "Manufacturer");

  // Industries / Industrial
  n = n.replace(/\bind(?:ust)?[\.\s]*co[\.\s]*(,)?[\.\s]*l[\.\s]*t[\.\s]*d\b\.?/gi, (match, comma) => {
    return comma ? "Industries Company, Limited" : "Industries Company Limited";
  });
  n = n.replace(/\b(?:ind['’]?l|indl)\b\.?/gi, "Industrial");
  n = n.replace(/\binds\b\.?/gi, "Industries");
  n = n.replace(/\bindust\b\.?/gi, "Industries");
  n = n.replace(/\bind\b\.?\s*(?=(?:services?|solutions?|suppl(?:y|ies)|products?|equipment|park|estate|zone|area|mfg|manufacturing|eng|engineering|tech|technology|group|holdings?)\b)/gi, "Industrial ");
  n = n.replace(/\bind\b\.?/gi, "Industries");

  // International / National
  n = n.replace(/\b(?:int['’]?l|intl)\b\.?/gi, "International");
  n = n.replace(/\b(?:nat['’]?l|natl)\b\.?/gi, "National");

  // Technology / Technologies
  n = n.replace(/\btechs\b\.?/gi, "Technologies");
  n = n.replace(/\b(?:technol|tech)\b\.?/gi, "Technology");

  // Engineering
  n = n.replace(/\b(?:engg|engr|eng)\b\.?(?=\s*(?:&|\+|,|works|solutions?|services?|systems?|products?|supplies?|equipment|industries|mfg|manufacturing|co|company|corp|ltd|limited|inc|llc|$))/gi, "Engineering");
  n = n.replace(/\b(?:engg|engr)\b\.?/gi, "Engineering");

  // Equipment, Products, Systems, Development
  n = n.replace(/\b(?:eqpt|equip)\b\.?/gi, "Equipment");
  n = n.replace(/\bprods\b\.?/gi, "Products");
  n = n.replace(/\bprod\b\.?/gi, "Products");
  n = n.replace(/\b(?:systs|syst|sys)\b\.?/gi, "Systems");
  n = n.replace(/\b(?:devel|dev)\b\.?/gi, "Development");

  // Services, Solutions, Associates, Group
  n = n.replace(/\b(?:svcs|servs|svc|serv)\b\.?/gi, "Services");
  n = n.replace(/\b(?:solns|soln|sols)\b\.?/gi, "Solutions");
  n = n.replace(/\b(?:assocs|assoc)\b\.?/gi, "Associates");
  n = n.replace(/\bgrp\b\.?/gi, "Group");

  // Chemical, Electrical / Electronics, Automotive, Automation
  n = n.replace(/\bchems\b\.?/gi, "Chemicals");
  n = n.replace(/\bchem\b\.?\s*(?=(?:ind|industries|industrial|co|company|corp|ltd|limited|inc|llc|products?|supplies|works|mfg|manufacturing)\b|\s*(?:&|\+|and)\b)/gi, "Chemical ");
  n = n.replace(/\bchem\b\.?/gi, "Chemicals");
  n = n.replace(/\b(?:elect|elec)\b\.?\s*(?=(?:and|&|\+|engineering|services?|supplies?|works|mfg|co|company|corp|ltd|limited|inc|llc|systems?|products?)\b)/gi, "Electrical ");
  n = n.replace(/\b(?:elect|elec)\b\.?/gi, "Electronics");
  n = n.replace(/\bauto\b\.?\s*(?=(?:parts?|components?|industr(?:y|ies)|vehicles?|access(?:ories)?|mfg|co|corp|ltd|inc|llc)\b|\s*(?:&|\+)\b)/gi, "Automotive ");
  n = n.replace(/\bauto\b\.?\s*(?=(?:systems?|solutions?|engineering|tech|technology|controls?)\b)/gi, "Automation ");

  // Distribution, Fabrication, Machinery, Packaging, Trading, Furniture, Building, Hardware
  n = n.replace(/\b(?:distrs|distrib|dist)\b\.?\s*(?=(?:co|company|corp|ltd|limited|inc|llc|of)\b)/gi, "Distributors ");
  n = n.replace(/\b(?:distrs|distrib|dist)\b\.?/gi, "Distribution");
  n = n.replace(/\bfab\b\.?/gi, "Fabrication");
  n = n.replace(/\bmach\b\.?/gi, "Machinery");
  n = n.replace(/\b(?:pkg|pack)\b\.?/gi, "Packaging");
  n = n.replace(/\btrdg\b\.?/gi, "Trading");
  n = n.replace(/\bfurn\b\.?/gi, "Furniture");
  n = n.replace(/\bbldg\b\.?/gi, "Building");
  n = n.replace(/\b(?:hdwe|hdw)\b\.?/gi, "Hardware");
  n = n.replace(/\bmaint\b\.?/gi, "Maintenance");

  // Management, Communications, Laboratories, Materials
  n = n.replace(/\b(?:mgmt|mgt)\b\.?/gi, "Management");
  n = n.replace(/\b(?:comms|comm)\b\.?/gi, "Communications");
  n = n.replace(/\b(?:labs|lab)\b\.?/gi, "Laboratories");
  n = n.replace(/\b(?:matls|matl|mat)\b\.?/gi, "Materials");

  // Technical prefixes
  n = n.replace(/\bappl\b\.?\s*(?=(?:technol|tech|sciences?|systems?|materials?|engineering|products?|solutions?|co|company|corp|ltd|limited|inc|llc)\b)/gi, "Applied ");
  n = n.replace(/\badv\b\.?\s*(?=(?:technol|tech|materials?|systems?|engineering|solutions?|products?|mfg|co|company|corp|ltd|limited|inc|llc)\b)/gi, "Advanced ");
  n = n.replace(/\bgen\b\.?\s*(?=(?:electric|electrical|motors?|trading|commercial|engineering|industries|industrial|co|company|corp|ltd|inc|llc)\b)/gi, "General ");
  n = n.replace(/\bstd\b\.?\s*(?=(?:products?|engineering|parts?|fasteners?|mfg|co|company|corp|ltd|inc|llc)\b)/gi, "Standard ");
  n = n.replace(/\b(?:environ|envir|envr|env)\b\.?\s*(?=(?:solutions?|services?|systems?|engineering|tech|products?|co|corp|ltd|inc)\b)/gi, "Environmental ");
  n = n.replace(/\b(?:transp|trans)\b\.?\s*(?=(?:solutions?|services?|systems?|logistics?|co|company|corp|ltd|inc)\b)/gi, "Transportation ");
  n = n.replace(/\blogist\b\.?/gi, "Logistics");
  n = n.replace(/\blog\b\.?\s*(?=(?:solutions?|services?|systems?|co|ltd|inc)\b)/gi, "Logistics ");
  n = n.replace(/\b(?:constr|const)\b\.?\s*(?=(?:solutions?|services?|systems?|materials?|equipment|works|group|co|company|ltd|corp|inc)\b|\s*(?:&|\+|,|$))/gi, "Construction ");
  n = n.replace(/\bagric?\b\.?\s*(?=(?:products?|machinery|equip|equipment|supplies|industries|mfg|co|corp|ltd|inc|llc)\b)/gi, "Agricultural ");
  n = n.replace(/\bsci\b\.?\s*(?=(?:&|\+|instruments?|labs?|laboratories|equip|equipment|co|corp|ltd|inc)\b)/gi, "Scientific ");
  n = n.replace(/\bpharm\b\.?/gi, "Pharmaceuticals");
  n = n.replace(/\b(?:telecomms|telecoms|telecomm|telecom)\b\.?/gi, "Telecommunications");
  n = n.replace(/\bbros\b\.?/gi, "Brothers");
  n = n.replace(/\b(?:enterpr|enterp|entp|ent)\b\.?(?=\s|$|,)/gi, "Enterprises");
  n = n.replace(/\bhldgs\b\.?/gi, "Holdings");
  n = n.replace(/\bhldg\b\.?/gi, "Holding");
  n = n.replace(/\b(?:instrum|instr)\b\.?/gi, "Instruments");
  n = n.replace(/\belectromech\b\.?/gi, "Electromechanical");
  n = n.replace(/\bmech\b\.?/gi, "Mechanical");
  n = n.replace(/\b(?:hydr|hyd)\b\.?/gi, "Hydraulics");
  n = n.replace(/\bpneum\b\.?/gi, "Pneumatics");
  n = n.replace(/\binsul\b\.?/gi, "Insulation");
  n = n.replace(/\brefrig\b\.?/gi, "Refrigeration");
  n = n.replace(/\bventil\b\.?/gi, "Ventilation");
  n = n.replace(/\bplast\b\.?/gi, "Plastics");
  n = n.replace(/\bprec\b\.?/gi, "Precision");
  n = n.replace(/\bapp\b\.?(?=\s+(?:co|company|corp|ltd|limited|inc|llc|mfg)\b)/gi, "Apparatus");

  // 19. United States & Global Legal Entities (must run after Mfg/Ind compound rules)
  n = n.replace(/\bp[\.\s]*l[\.\s]*l[\.\s]*c\b\.?/gi, "Professional Limited Liability Company");
  n = n.replace(/\bl[\.\s]*l[\.\s]*p\b\.?/gi, "Limited Liability Partnership");
  n = n.replace(/\bl[\.\s]*l[\.\s]*c\b\.?/gi, "Limited Liability Company");
  n = n.replace(/\bl[\.\s]*p\b\.?/gi, "Limited Partnership");
  n = n.replace(/\bp[\.\s]*l[\.\s]*c\b\.?/gi, "Public Limited Company");

  // "Co., Ltd." vs "Co. Ltd"
  // If comma is present between Co and Ltd (e.g. "Co., Ltd." or "Co.,Ltd") -> "Company, Limited"
  // If WITHOUT comma (e.g. "Co. Ltd" or "Co Ltd") -> "Company Limited"
  n = n.replace(/\bco[\.\s]*(,)\s*l[\.\s]*t[\.\s]*d\b\.?/gi, "Company, Limited");
  n = n.replace(/\bco[\.\s]+l[\.\s]*t[\.\s]*d\b\.?/gi, "Company Limited");

  // Private, Proprietary Limited with/without comma
  n = n.replace(/\bp[\.\s]*t[\.\s]*e[\.\s]*(,)\s*l[\.\s]*t[\.\s]*d\b\.?/gi, "Private, Limited");
  n = n.replace(/\bp[\.\s]*t[\.\s]*e[\.\s]+l[\.\s]*t[\.\s]*d\b\.?/gi, "Private Limited");
  n = n.replace(/\bp[\.\s]*v[\.\s]*t[\.\s]*(,)\s*l[\.\s]*t[\.\s]*d\b\.?/gi, "Private, Limited");
  n = n.replace(/\bp[\.\s]*v[\.\s]*t[\.\s]+l[\.\s]*t[\.\s]*d\b\.?/gi, "Private Limited");
  n = n.replace(/\bp[\.\s]*t[\.\s]*y[\.\s]*(,)\s*l[\.\s]*t[\.\s]*d\b\.?/gi, "Proprietary, Limited");
  n = n.replace(/\bp[\.\s]*t[\.\s]*y[\.\s]+l[\.\s]*t[\.\s]*d\b\.?/gi, "Proprietary Limited");

  n = n.replace(/\bl[\.\s]*t[\.\s]*d\b\.?/gi, "Limited");
  n = n.replace(/\bi[\.\s]*n[\.\s]*c\b\.?/gi, "Incorporated");
  n = n.replace(/\bc[\.\s]*o[\.\s]*r[\.\s]*p\b\.?/gi, "Corporation");
  n = n.replace(/\b(?:co|c\.o)\b\.?/gi, "Company");

  // Clean semicolons and normalize commas without stripping dots and commas per Rule 4
  n = n.replace(/;+/g, " ");
  n = n.replace(/\s*,\s*/g, ", ");
  n = n.replace(/\s+/g, " ").trim();

  // Rule: Special character should not start and should not end
  return stripBoundarySpecialChars(n);
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
