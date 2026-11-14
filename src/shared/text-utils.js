// Shared text, HTML entity, identifier normalization, and email sanitization helpers.

function stripBoundarySpecialChars(str) {
  if (!str || typeof str !== "string") return "";
  let s = str.trim();
  while (/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/u.test(s)) {
    s = s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim();
  }
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Strips HTML tags, script/style blocks, and decodes HTML entities into clean plain text.
 * Inline formatting tags (strong, b, em, i, span) are stripped without inserting spaces
 * so that adjacent digits/words (e.g. 979<strong>9) remain intact.
 */
function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<\/?(?:strong|b|em|i|span|u|font|mark|small|sub|sup)[^>]*>/gi, "")
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/address|\/h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Ensures "Number" is ONLY present if "No.", "No", "NO.", "Nos.", "Nº", "#", or "號" was in the original raw address evidence.
 * Rule: "if No come only expand and do with out coming dont put blankly number"
 */
function stripBlindlyAddedNumber(addr, rawEvidence = "", rawSource = "") {
  if (!addr || !/\bNumber\s+\d+/i.test(addr)) return addr;
  return addr.replace(/\bNumber\s+(\d+(?:[-/]\d+)?)\b/gi, (match, digits) => {
    const rawHasNoRegex = new RegExp('(?:(?:\\b(?:no|nos|n|nu|nr|nº|n°|numero|num|number|lot\\s*no|plot\\s*no)[.:]?|#)\\s*' + digits.replace('-', '[-/]') + '\\b|' + digits.replace('-', '[-/]') + '\\s*[号號])', 'i');
    if (rawSource && typeof rawSource === "string" && rawHasNoRegex.test(rawSource)) {
      return match;
    }
    if (rawEvidence && typeof rawEvidence === "string" && rawHasNoRegex.test(rawEvidence)) {
      return match;
    }
    return digits;
  });
}

/**
 * Strips navigational, CTA, and page-context prefixes and marketing taglines from company names.
 * Ensures official registered names are clean, complete, and free of extraneous artifacts.
 */

function stripTrailingContactWordsFromEmail(email) {
  if (!email || typeof email !== "string") return "";
  let em = email.trim();
  // Strip malformed mailto / protocol prefixes (e.g. "mailto:info@...", "http://mailtoinfo@...", "mailtoinfo@...")
  em = em.replace(/^(?:https?:\/\/)?mailto:/i, "");
  em = em.replace(/^(?:https?:\/\/)?mailto(?=(?:info|sales|contact|enquir(?:y|ies)|hello|hi|office|support|admin|service|customercare|customer|marketing|orders?|export|import|hr|jobs|careers|mail|general|team|feedback|billing|accounts)[a-z0-9._%+-]*@)/i, "");
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

function normalizeNameForComparison(name) {
  if (!name || typeof name !== "string") return "";
  return name.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " and ")
    .replace(/\b(?:pty\.?\s*ltd\.?|proprietary\s*limited|limited|ltd\.?|inc\.?|incorporated|llc|llp|corp\.?|corporation|co\.,\s*ltd\.?|company\s*limited|pte\.?\s*ltd\.?|pvt\.?\s*ltd\.?|sdn\.?\s*bhd\.?|berhad|gmbh|plc|s\.?l\.?u\.?|s\.?a\.?u\.?|s\.?l\.?|s\.?a\.?)\b/gi, " ")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}


function toTitleCase(str) {
  if (!str) return "";
  const upperAcronyms = new Set([
    "USA", "UK", "UAE", "3D", "CNC", "LED", "OEM", "ODM", "HVAC", "PVC", "PE", "HDPE", "PTFE", "R&D", "AKS",
    "PT", "CV", "UD", "TBK", "RT", "RW", "DKI", "DI", "BMW", "IBM", "B2B", "B2C", "IT", "TP", "QC", "AI", "FRP", "SMT", "PCB", "PCBA",
    "PEM", "FP", "HR", "CRP", "SMC", "THK", "NSK", "NTN", "IKO", "INA", "FAG", "FESTO", "CKD", "ABB", "SKF", "GE", "HP", "LG", "JVC", "TDK", "NEC", "ECU"
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
    // Preserve 2-4 letter all-caps acronyms AND alphanumeric industrial/zone codes (e.g. MM2100)
    if (word === upper && /[a-z]/.test(fullStr) && !/^(?:AND|THE|FOR|WITH|FROM|INTO|ONTO|UPON|OVER|UNDER|AFTER|ABOUT)$/i.test(word)) {
      if ((word.length >= 2 && word.length <= 4) || (/[A-Z]{2,}/.test(word) && /\d/.test(word))) {
        return upper;
      }
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
      .replace(/&plus;/gi, "+")
      .replace(/&commat;/gi, "@")
      .replace(/&percnt;/gi, "%")
      .replace(/&num;/gi, "#")
      .replace(/&sol;/gi, "/")
      .replace(/&reg;/gi, "®")
      .replace(/&trade;/gi, "™")
      .replace(/&copy;/gi, "©")
      .replace(/&ndash;/gi, "–")
      .replace(/&mdash;/gi, "—")
      .replace(/&bull;/gi, "•")
      .replace(/&middot;/gi, "·")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&nbsp;/gi, " ")
      .replace(/\u00A0/g, " ");
  }
  return res;
}

/**
 * Extracts the canonical registrable root domain (e.g. "example.com" or "example.co.uk").
 * Handles multi-part international TLDs (.co.uk, .com.au, .com.tw, .co.za, etc.).
 */
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
  host = host.replace(/^(?:www\d?|m|web)\./i, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const lastTwo = parts.slice(-2).join(".");
  if (/^(?:co|com|org|net|gov|edu|ac|asn|idv|gen|nic|ltd|me|tm|or|go|ne|gv|priv)\.[a-z]{2}$/i.test(lastTwo)) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

/**
 * Checks whether the original URL and final URL belong to different root domains.
 * Same domain (http <-> https, www vs non-www, language subpaths) return false.
 * Different domains (companyA.com -> companyB.com, company.co.uk -> company.com) return true.
 */
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

/**
 * Standardizes country names globally with full expanded official names (135 valid countries).
 * E.g., "USA"/"United States" -> "United States Of America", "Czechia" -> "Czech Republic",
 * "Turkey/Turkiye" -> "Türkiye", "Deutschland" -> "Germany", "Hrvatska" -> "Croatia", "Brunei" -> "Brunei Darussalam"
 */
