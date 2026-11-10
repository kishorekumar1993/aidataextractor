// Shared text, HTML entity, identifier normalization, and email sanitization helpers.

function stripBoundarySpecialChars(str) {
  if (!str || typeof str !== "string") return "";
  return str.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").replace(/\s+/g, " ").trim();
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

function normalizeNameForComparison(name) {
  if (!name || typeof name !== "string") return "";
  return name.toLowerCase()
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
 * Standardizes country names globally with full expanded official names (135 valid countries).
 * E.g., "USA"/"United States" -> "United States Of America", "Czechia" -> "Czech Republic",
 * "Turkey/Turkiye" -> "Türkiye", "Deutschland" -> "Germany", "Hrvatska" -> "Croatia", "Brunei" -> "Brunei Darussalam"
 */
