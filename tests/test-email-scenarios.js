const fs = require('fs');

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/gi, '&')
    .replace(/&commat;/gi, '@')
    .replace(/&period;/gi, '.')
    .replace(/&colon;/gi, ':')
    .replace(/&semi;/gi, ';');
}

function decodeURIComponentSafe(uri) {
  if (!uri) return '';
  try {
    return decodeURIComponent(uri);
  } catch (e) {
    return uri;
  }
}

function decodeRot13(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[a-zA-Z]/g, (c) => {
    const code = c.charCodeAt(0);
    const base = code >= 97 ? 97 : 65;
    return String.fromCharCode(((code - base + 13) % 26) + base);
  });
}

function isValidCorporateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const em = email.trim().toLowerCase();
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(em)) return false;
  return true;
}

function isUnwantedEmail() {
  return false;
}

function stripTrailingContactWordsFromEmail(em) {
  return em;
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ');
}

function rankEmails(emails) {
  return emails;
}

// Improved extractEmailsFromHtml
function extractEmailsFromHtml(html, hostDomain = "") {
  if (!html || typeof html !== "string") return [];
  const candidateEmails = new Set();

  // Helper to add valid clean email
  const addCandidate = (raw) => {
    if (!raw) return;
    const clean = stripTrailingContactWordsFromEmail(String(raw).toLowerCase().trim());
    if (isValidCorporateEmail(clean) && !isUnwantedEmail(clean)) {
      candidateEmails.add(clean);
    }
  };

  // Helper to search and add all emails from text
  const extractFromText = (text) => {
    if (!text || typeof text !== "string") return;
    const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const m of matches) addCandidate(m);
  };

  // 1. Decode Cloudflare Email Protection (data-cfemail or /cdn-cgi/l/email-protection#)
  const cfMatches = [...html.matchAll(/(?:data-cfemail=["']|email-protection#)([a-f0-9]{4,})/gi)];
  for (const m of cfMatches) {
    const hex = m[1];
    try {
      let decoded = "";
      const key = parseInt(hex.substr(0, 2), 16);
      for (let n = 2; n < hex.length; n += 2) {
        decoded += String.fromCharCode(parseInt(hex.substr(n, 2), 16) ^ key);
      }
      if (/@/.test(decoded)) addCandidate(decoded);
    } catch (e) { }
  }

  // 2. Decode ROT13 obfuscated emails (e.g. data-enc-email="fnyrf[at]unegznaapbagebyf.pbz" or class="mail-link" data-enc-email="...")
  const rotMatches = [...html.matchAll(/data-enc-email=["']([a-zA-Z0-9._%+-]+(?:@|\[at\]|\(at\))[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["']/gi)];
  for (const rm of rotMatches) {
    const rawEnc = rm[1].replace(/\[at\]|\(at\)/gi, "@");
    const decoded = decodeRot13(rawEnc);
    if (/@/.test(decoded)) addCandidate(decoded);
  }

  // 3. Decode inline URI / URIComponent scripts (e.g. innerHTML = decodeURIComponent("%73%61%6c%65%73..."))
  const uriEncodedMatches = [...html.matchAll(/(?:decodeURIComponent|decodeURI|unescape)\s*\(\s*["']([^"']+)["']\s*\)/gi)];
  for (const um of uriEncodedMatches) {
    try {
      const decoded = decodeURIComponentSafe(um[1]);
      extractFromText(decoded);
    } catch (e) { }
  }

  // 3b. Decode Base64 encoded emails (e.g. atob("bWFpbHRvOnNhbGVzQGNvbXBhbnkuY29t") or data-b64="...")
  const decodeBase64Safe = (b64) => {
    if (!b64) return "";
    if (typeof atob === "function") {
      try { return atob(b64); } catch (e) { }
    }
    if (typeof Buffer !== "undefined") {
      try { return Buffer.from(b64, 'base64').toString('binary'); } catch (e) { }
    }
    return "";
  };

  const b64Matches = [...html.matchAll(/(?:atob|base64_decode)\s*\(\s*["']([A-Za-z0-9+/=]{8,})["']\s*\)|data-(?:b64|base64|enc)=["']([A-Za-z0-9+/=]{8,})["']/gi)];
  for (const bm of b64Matches) {
    try {
      const b64Str = bm[1] || bm[2];
      if (b64Str) {
        const dec = decodeBase64Safe(b64Str);
        extractFromText(dec);
      }
    } catch (e) { }
  }

  // 3c. Decode dataset / split attribute emails (e.g. data-user="sales" data-domain="company.com" or data-tld="com")
  const splitAttrMatches = [...html.matchAll(/<[^>]*(?:data-(?:user|name|prefix|email-prefix)=["']([^"']+)["'])[^>]*>/gi)];
  for (const sm of splitAttrMatches) {
    const fullTag = sm[0];
    const uMatch = fullTag.match(/data-(?:user|name|prefix|email-prefix)=["']([^"']+)["']/i);
    const dMatch = fullTag.match(/data-(?:domain|host|suffix|email-domain)=["']([^"']+)["']/i);
    const tldMatch = fullTag.match(/data-(?:tld|ext|extension)=["']([^"']+)["']/i);
    if (uMatch && dMatch) {
      let u = uMatch[1].trim();
      let d = dMatch[1].trim().replace(/^@/, "");
      if (tldMatch && !d.includes(".")) {
        d = `${d}.${tldMatch[1].trim().replace(/^\./, "")}`;
      }
      if (u && d && !d.includes("@") && d.includes(".")) {
        addCandidate(`${u}@${d}`);
      }
    }
  }

  // 3d. Decode reverse text (CSS rtl / unicode-bidi:bidi-override / <bdo dir="rtl"> / class="reverse" / dir="rtl")
  const rtlMatches = [...html.matchAll(/<(?:bdo|span|div|p|a|li|b|i)\b[^>]*(?:dir=["']?rtl["']?|direction\s*:\s*rtl|unicode-bidi\s*:\s*bidi-override|class=["'][^"']*(?:rtl|reverse|rev)[^"']*["'])[^>]*>([\s\S]*?)<\/(?:bdo|span|div|p|a|li|b|i)>/gi)];
  for (const rm of rtlMatches) {
    const inner = decodeHtmlEntities(stripHtml(rm[1])).trim();
    if (inner) {
      const reversed = inner.split("").reverse().join("");
      extractFromText(reversed);
    }
  }

  // 3e. Process <script> blocks BEFORE stripping: Joomla cloaking, variable concatenation, String.fromCharCode, Array join
  const scriptBlocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const sb of scriptBlocks) {
    const rawScript = sb[1];
    if (!rawScript || (!/mailto|@|&#64;|addy|fromCharCode|reverse|join|prefix|document\.write/i.test(rawScript))) continue;

    // Decode HTML entities within script text first
    const scriptDecoded = decodeHtmlEntities(rawScript);

    // 3e-1. String.fromCharCode(...)
    const fromCharCodeMatches = [...scriptDecoded.matchAll(/String\.fromCharCode\s*\(\s*([\d\s,xXa-fA-F]+)\s*\)/gi)];
    for (const fcm of fromCharCodeMatches) {
      try {
        const charCodes = fcm[1].split(",").map(c => {
          const t = c.trim();
          return t.startsWith("0x") || t.startsWith("0X") ? parseInt(t, 16) : parseInt(t, 10);
        });
        const reconstructed = String.fromCharCode(...charCodes);
        extractFromText(reconstructed);
      } catch (e) { }
    }

    // 3e-2. Array join: ['sales', 'domain.com'].join('@') or ['info', 'domain', 'com'].join('.')
    const arrayJoinMatches = [...scriptDecoded.matchAll(/\[([^\]]+)\]\.join\s*\(\s*['"]([^'"]*)['"]\s*\)/gi)];
    for (const aj of arrayJoinMatches) {
      try {
        const items = aj[1].split(",").map(s => {
          const m = s.trim().match(/^['"]([^'"]*)['"]$/);
          return m ? m[1] : "";
        });
        const separator = aj[2] || "";
        const reconstructed = items.join(separator);
        extractFromText(reconstructed);
      } catch (e) { }
    }

    // 3e-3. Multi-part literal string concatenation: e.g. "contact" + "@" + "brand" + ".com"
    const concatLiteralMatches = [...scriptDecoded.matchAll(/(?:'[^']*'|"[^"]*")(?:\s*\+\s*(?:'[^']*'|"[^"]*"))+/g)];
    for (const clm of concatLiteralMatches) {
      const expr = clm[0];
      const strParts = [...expr.matchAll(/['"]([^'"]*)['"]/g)].map(x => x[1]).join("");
      extractFromText(strParts);
    }

    // 3e-4. Variable assignment & concatenation tracking (e.g. Joomla addy42191, user + '@' + domain)
    try {
      const vars = {};
      const lines = scriptDecoded.split(/\r?\n/);
      for (const line of lines) {
        const statements = line.split(";").map(s => s.trim()).filter(Boolean);
        for (const stmt of statements) {
          const assignMatch = stmt.match(/^(?:var|let|const)?\s*([a-zA-Z0-9_$]+)\s*(\+=|=)\s*(.+)$/);
          if (!assignMatch) continue;
          const [, varName, op, expr] = assignMatch;
          const tokens = expr.split(/\s*\+\s*/);
          let resolved = "";
          let valid = true;
          for (const token of tokens) {
            const strMatch = token.match(/^['"]([^'"]*)['"]$/);
            if (strMatch) {
              resolved += strMatch[1];
            } else if (Object.prototype.hasOwnProperty.call(vars, token)) {
              resolved += vars[token];
            } else {
              valid = false;
              break;
            }
          }
          if (valid) {
            if (op === "+=") {
              vars[varName] = (vars[varName] || "") + resolved;
            } else {
              vars[varName] = resolved;
            }
          }
        }
      }
      for (const val of Object.values(vars)) {
        extractFromText(val);
      }
    } catch (e) { }
  }

  // 4. Decode all mailto: links (including HTML entity encoded, URI encoded, semicolon/comma delimited, onclick, window.open)
  const mailtoBlocks = [...html.matchAll(/(?:href\s*=\s*["']|onclick\s*=\s*["']|window\.open\s*\(\s*["']|\b)((?:mailto:|&#109;&#97;&#105;&#108;&#116;&#111;|%6d%61%69%6c%74%6f)[^"'>\s]+)/gi)];
  for (const mb of mailtoBlocks) {
    try {
      const rawMailto = mb[1];
      const decodedEntities = decodeHtmlEntities(rawMailto);
      const decodedMailto = decodeURIComponentSafe(decodedEntities).replace(/%40|&#64;|&commat;/gi, "@");
      extractFromText(decodedMailto);
    } catch (e) { }
  }

  // Strip form placeholder attributes BEFORE scanning raw HTML or script hydration so dummy emails never extract
  const htmlWithoutPlaceholders = html
    .replace(/\b(?:aria-)?placeholder\s*=\s*"[^"]*"/gi, " ")
    .replace(/\b(?:aria-)?placeholder\s*=\s*'[^']*'/gi, " ");

  // 5. Extract emails from data attributes, hidden inputs, meta tags, and structured attributes
  const attrMatches = [...htmlWithoutPlaceholders.matchAll(/(?:data-[a-z0-9_-]*(?:email|mail|contact)|value|content|title|alt)=["']([a-zA-Z0-9._%+-]+(?:@|%40|&#64;|&commat;)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["']/gi)];
  for (const am of attrMatches) {
    const rawEm = decodeHtmlEntities(am[1]).replace(/%40|&#64;|&commat;/gi, "@").toLowerCase().trim();
    addCandidate(rawEm);
  }

  // 6. Extract emails from JSON-LD, script hydration, Next.js / Nuxt state, and social profile JSON before stripping scripts
  const scriptMatches = [...htmlWithoutPlaceholders.matchAll(/[a-zA-Z0-9._%+-]+(?:@|\\u0040|%40|&#64;)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)];
  for (const sm of scriptMatches) {
    const emClean = sm[0].replace(/\\u0040|%40|&#64;/gi, "@").toLowerCase().trim();
    addCandidate(emClean);
  }

  // 7. Honeypot stripping & Text normalization
  // Strip spambot honeypots (display:none spans, hidden tags, comments) by removing them COMPLETELY (not space)
  // so split emails like sales<span>trap</span>@domain.com rejoin cleanly
  const emailSearchText = htmlWithoutPlaceholders
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<(?:span|div|b|i|font|p)[^>]*?(?:style=["'][^"']*?display:\s*none[^"']*?|class=["'][^"']*?(?:hidden|hide|d-none|invisible|antispam)[^"']*?)[^>]*>[\s\S]*?<\/(?:span|div|b|i|font|p)>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/&#(\d+);?/g, (m, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);?/gi, (m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/gi, "&")
    .replace(/&commat;/gi, "@")
    .replace(/&period;/gi, ".")
    .replace(/%40/gi, "@")
    // Bracketed, parenthesized, slashed, hyphenated, and spaced at / dot normalization
    .replace(/([a-zA-Z0-9._%+-]+)\s*(?:\[\s*(?:at|@|a)\s*\]|\(\s*(?:at|@|a)\s*\)|\{\s*(?:at|@|a)\s*\}|_\s*at\s*_|\/\s*at\s*\/|-\s*at\s*-|\s+at\s+|\bAT\b)\s*([a-zA-Z0-9.-]+)\s*(?:\[\s*(?:dot|\.)\s*\]|\(\s*(?:dot|\.)\s*\)|\{\s*(?:dot|\.)\s*\}|_\s*dot\s*_|\/\s*dot\s*\/|-\s*dot\s*-|\s+dot\s+|\bDOT\b|\.)\s*([a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})*)/gi, "$1@$2.$3")
    .replace(/([a-zA-Z0-9._%+-]+)\s*(?:\[\s*(?:at|@|a)\s*\]|\(\s*(?:at|@|a)\s*\)|\{\s*(?:at|@|a)\s*\}|_\s*at\s*_|\/\s*at\s*\/|-\s*at\s*-|\bAT\b)\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})*)/gi, "$1@$2")
    .replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\s*(?:\[\s*(?:dot|\.)\s*\]|\(\s*(?:dot|\.)\s*\)|\{\s*(?:dot|\.)\s*\}|_\s*dot\s*_|\/\s*dot\s*\/|-\s*dot\s*-|\bDOT\b)\s*([a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})*)/gi, "$1@$2.$3")
    .replace(/([a-zA-Z0-9._%+-]+)\s+@\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "$1@$2")
    .replace(/([a-zA-Z0-9._%+-]+)@\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "$1@$2")
    .replace(/([a-zA-Z0-9._%+-]+)\s+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, "$1@$2");

  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const rawEmails = emailSearchText.match(emailRegex) || [];
  for (let em of rawEmails) {
    em = stripTrailingContactWordsFromEmail(em.toLowerCase().trim());
    if (isUnwantedEmail(em)) continue;
    if (/\.(?:pbz|bet|arg|rqh|tbi)$/i.test(em)) {
      const decodedRot = decodeRot13(em);
      if (isValidCorporateEmail(decodedRot) && !isUnwantedEmail(decodedRot)) {
        candidateEmails.add(decodedRot);
        continue;
      }
    }
    candidateEmails.add(em);
  }

  // Tag-stripped match
  const strippedText = stripHtml(emailSearchText);
  const textEmails = strippedText.match(emailRegex) || [];
  for (let em of textEmails) {
    em = stripTrailingContactWordsFromEmail(em.toLowerCase().trim());
    if (isValidCorporateEmail(em) && !isUnwantedEmail(em)) {
      candidateEmails.add(em);
    }
  }

  const uniqueEmails = [];
  for (let em of candidateEmails) {
    em = stripTrailingContactWordsFromEmail(em.toLowerCase().trim());
    if (isValidCorporateEmail(em) && !isUnwantedEmail(em) && !uniqueEmails.includes(em)) {
      uniqueEmails.push(em);
    }
  }

  const cleanedUnique = uniqueEmails.filter(em => {
    if (em.startsWith("mailto") && uniqueEmails.includes(em.slice(6))) return false;
    return true;
  });

  return rankEmails(cleanedUnique, hostDomain);
}

const scenarios = [
  {
    name: 'WillJoin Joomla Cloaking',
    html: `E-mail : 
 <script type='text/javascript'>
 <!--
 var prefix = '&#109;a' + 'i&#108;' + '&#116;o';
 var path = 'hr' + 'ef' + '=';
 var addy74927 = 'w&#105;llj&#111;&#105;n' + '&#64;';
 addy74927 = addy74927 + 'ms9' + '&#46;' + 'h&#105;n&#101;t' + '&#46;' + 'n&#101;t';
 var addy_text74927 = 'w&#105;llj&#111;&#105;n' + '&#64;' + 'ms9' + '&#46;' + 'h&#105;n&#101;t' + '&#46;' + 'n&#101;t';
 document.write('<a ' + path + '\'' + prefix + ':' + addy74927 + '\'>');
 document.write(addy_text74927);
 document.write('<\/a>');
 //-->
 </script><script type='text/javascript'>
 <!--
 document.write('<span style=\'display: none;\'>');
 //-->
 </script>This email address is being protected from spambots. You need JavaScript enabled to view it.`,
    expected: 'willjoin@ms9.hinet.net'
  },
  {
    name: 'Numeric entity mailto',
    html: '<a href="mailto:&#105;&#110;&#102;&#111;&#64;&#99;&#111;&#109;&#112;&#97;&#110;&#121;&#46;&#99;&#111;&#109;">Mail</a>',
    expected: 'info@company.com'
  },
  {
    name: 'Hex entity mailto',
    html: '<a href="mailto:&#x69;&#x6e;&#x66;&#x6f;&#x40;&#x63;&#x6f;&#x6d;&#x70;&#x61;&#x6e;&#x79;&#x2e;&#x63;&#x6f;&#x6d;">Mail</a>',
    expected: 'info@company.com'
  },
  {
    name: 'Semicolon mailto with 2 emails',
    html: '<a href="mailto:daisyyang@zungsung.com;zungsung@ms14.hinet.net">Contact</a>',
    expected: 'daisyyang@zungsung.com'
  },
  {
    name: 'BDO RTL tag',
    html: '<bdo dir="rtl">moc.ynapmoc@selas</bdo>',
    expected: 'sales@company.com'
  },
  {
    name: 'Span DIR RTL tag',
    html: '<span dir="rtl">moc.ynapmoc@ofni</span>',
    expected: 'info@company.com'
  },
  {
    name: 'String.fromCharCode in script',
    html: '<script>var email = String.fromCharCode(115, 97, 108, 101, 115, 64, 115, 105, 116, 101, 46, 99, 111, 109);</script>',
    expected: 'sales@site.com'
  },
  {
    name: 'Multi-part JS string concatenation in script',
    html: '<script>var em = "contact" + "@" + "brand" + ".com";</script>',
    expected: 'contact@brand.com'
  },
  {
    name: 'JS variable concatenation in script',
    html: '<script>var u = "support"; var d = "service.org"; var m = u + "@" + d;</script>',
    expected: 'support@service.org'
  },
  {
    name: 'Text obfuscation with multi-dot TLD',
    html: 'Contact us: export [at] factory [dot] com [dot] tw',
    expected: 'export@factory.com.tw'
  },
  {
    name: 'Text obfuscation (a) and [.]',
    html: 'Email: office(a)enterprise[.]com',
    expected: 'office@enterprise.com'
  },
  {
    name: 'Anti-spam display:none span inside email',
    html: '<p>sales<span style="display:none">spambot-trap</span>@company.com</p>',
    expected: 'sales@company.com'
  },
  {
    name: 'Split dataset with tld',
    html: '<span data-name="info" data-domain="firm" data-tld="com"></span>',
    expected: 'info@firm.com'
  }
];

console.log('Testing NEW crawler extractEmailsFromHtml:');
let pass = 0;
for (const sc of scenarios) {
  const result = extractEmailsFromHtml(sc.html, 'example.com');
  const ok = result.includes(sc.expected);
  console.log(`${ok ? '✅' : '❌'} ${sc.name}: got ${JSON.stringify(result)}, expected to include '${sc.expected}'`);
  if (ok) pass++;
}
console.log(`Passed: ${pass}/${scenarios.length}`);
