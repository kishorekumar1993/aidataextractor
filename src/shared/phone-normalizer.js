// Shared international phone number cleaning and toll-free/placeholder rejection.

function cleanPhoneNumber(rawPhone, country) {
  if (!rawPhone) return "";
  let p = String(rawPhone).trim();

  p = p.replace(/^(?:tel|call|phone|contact|mobile|fax|whatsapp)[\s.:]*/i, "").trim();

  // Immediate rejection of explicit toll-free keywords
  if (/\b(?:toll[-\s]*free|free[-\s]*phone|green[-\s]*line)\b/i.test(p)) {
    return "";
  }

  const cLower = (country || "").toLowerCase();
  const hasPlus = p.startsWith("+");
  const has00 = p.startsWith("00");

  let digits = p.replace(/\D/g, "");
  if (!digits) return "";

  // Reject immediate toll-free numbers before country code removal
  if (/^(?:1800|1888|1877|1866|1855|1844|1833|1300|0800|0808|0500|800|888|877|866|855|844|833)/.test(digits)) {
    return "";
  }

  if (has00 && digits.length >= 10) {
    digits = digits.slice(2);
  }

  // Comprehensive map of country calling codes
  const countryCodes = [
    { match: ["malaysia"], code: "60", minLen: 10 },
    { match: ["south africa"], code: "27", minLen: 11 },
    { match: ["australia"], code: "61", minLen: 11 },
    { match: ["united states", "canada", "usa", "america", "jamaica", "bahamas", "barbados", "cayman islands", "dominican republic", "saint lucia", "trinidad and tobago"], code: "1", minLen: 11 },
    { match: ["united kingdom", "northern ireland", "england", "scotland", "wales", "great britain", "uk"], code: "44", minLen: 12 },
    { match: ["taiwan"], code: "886", minLen: 11 },
    { match: ["india"], code: "91", minLen: 12 },
    { match: ["singapore"], code: "65", minLen: 10 },
    { match: ["china"], code: "86", minLen: 12 },
    { match: ["hong kong"], code: "852", minLen: 11 },
    { match: ["japan"], code: "81", minLen: 11 },
    { match: ["north korea"], code: "850", minLen: 11 },
    { match: ["south korea", "korea"], code: "82", minLen: 11 },
    { match: ["germany", "deutschland"], code: "49", minLen: 11 },
    { match: ["france"], code: "33", minLen: 11 },
    { match: ["italy", "italia"], code: "39", minLen: 11 },
    { match: ["spain", "españa", "espana"], code: "34", minLen: 11 },
    { match: ["netherlands", "nederland"], code: "31", minLen: 11 },
    { match: ["switzerland", "schweiz"], code: "41", minLen: 11 },
    { match: ["austria", "österreich", "oesterreich"], code: "43", minLen: 11 },
    { match: ["belgium"], code: "32", minLen: 11 },
    { match: ["united arab emirates", "uae"], code: "971", minLen: 12 },
    { match: ["saudi arabia"], code: "966", minLen: 12 },
    { match: ["qatar"], code: "974", minLen: 11 },
    { match: ["kuwait"], code: "965", minLen: 11 },
    { match: ["bahrain"], code: "973", minLen: 11 },
    { match: ["oman"], code: "968", minLen: 11 },
    { match: ["jordan"], code: "962", minLen: 11 },
    { match: ["lebanon"], code: "961", minLen: 11 },
    { match: ["israel"], code: "972", minLen: 12 },
    { match: ["türkiye", "turkiye", "turkey"], code: "90", minLen: 12 },
    { match: ["new zealand"], code: "64", minLen: 11 },
    { match: ["indonesia"], code: "62", minLen: 11 },
    { match: ["philippines"], code: "63", minLen: 11 },
    { match: ["thailand"], code: "66", minLen: 11 },
    { match: ["vietnam"], code: "84", minLen: 11 },
    { match: ["cambodia"], code: "855", minLen: 11 },
    { match: ["brunei"], code: "673", minLen: 10 },
    { match: ["myanmar"], code: "95", minLen: 10 },
    { match: ["pakistan"], code: "92", minLen: 12 },
    { match: ["bangladesh"], code: "880", minLen: 13 },
    { match: ["sri lanka"], code: "94", minLen: 11 },
    { match: ["nepal"], code: "977", minLen: 12 },
    { match: ["bhutan"], code: "975", minLen: 11 },
    { match: ["maldives"], code: "960", minLen: 10 },
    { match: ["mongolia"], code: "976", minLen: 11 },
    { match: ["afghanistan"], code: "93", minLen: 11 },
    { match: ["iran"], code: "98", minLen: 12 },
    { match: ["iraq"], code: "964", minLen: 12 },
    { match: ["syria"], code: "963", minLen: 11 },
    { match: ["ireland"], code: "353", minLen: 11 },
    { match: ["poland"], code: "48", minLen: 11 },
    { match: ["portugal"], code: "351", minLen: 12 },
    { match: ["greece"], code: "30", minLen: 12 },
    { match: ["sweden"], code: "46", minLen: 11 },
    { match: ["norway"], code: "47", minLen: 10 },
    { match: ["denmark"], code: "45", minLen: 10 },
    { match: ["finland"], code: "358", minLen: 11 },
    { match: ["iceland"], code: "354", minLen: 10 },
    { match: ["luxembourg"], code: "352", minLen: 11 },
    { match: ["liechtenstein"], code: "423", minLen: 10 },
    { match: ["andorra"], code: "376", minLen: 9 },
    { match: ["malta"], code: "356", minLen: 11 },
    { match: ["cyprus"], code: "357", minLen: 11 },
    { match: ["czech republic", "czechia", "czech"], code: "420", minLen: 12 },
    { match: ["slovakia"], code: "421", minLen: 12 },
    { match: ["hungary"], code: "36", minLen: 11 },
    { match: ["romania"], code: "40", minLen: 11 },
    { match: ["bulgaria"], code: "359", minLen: 12 },
    { match: ["croatia", "hrvatska"], code: "385", minLen: 11 },
    { match: ["slovenia"], code: "386", minLen: 11 },
    { match: ["serbia"], code: "381", minLen: 11 },
    { match: ["north macedonia"], code: "389", minLen: 11 },
    { match: ["albania"], code: "355", minLen: 11 },
    { match: ["moldova"], code: "373", minLen: 11 },
    { match: ["ukraine"], code: "380", minLen: 12 },
    { match: ["belarus"], code: "375", minLen: 12 },
    { match: ["estonia"], code: "372", minLen: 10 },
    { match: ["latvia"], code: "371", minLen: 11 },
    { match: ["lithuania"], code: "370", minLen: 11 },
    { match: ["russia", "kazakhstan"], code: "7", minLen: 11 },
    { match: ["uzbekistan"], code: "998", minLen: 12 },
    { match: ["azerbaijan"], code: "994", minLen: 12 },
    { match: ["armenia"], code: "374", minLen: 11 },
    { match: ["brazil"], code: "55", minLen: 12 },
    { match: ["mexico"], code: "52", minLen: 12 },
    { match: ["argentina"], code: "54", minLen: 12 },
    { match: ["colombia"], code: "57", minLen: 12 },
    { match: ["peru"], code: "51", minLen: 11 },
    { match: ["uruguay"], code: "598", minLen: 11 },
    { match: ["paraguay"], code: "595", minLen: 12 },
    { match: ["bolivia"], code: "591", minLen: 11 },
    { match: ["costa rica"], code: "506", minLen: 11 },
    { match: ["panama"], code: "507", minLen: 10 },
    { match: ["guatemala"], code: "502", minLen: 11 },
    { match: ["nicaragua"], code: "505", minLen: 11 },
    { match: ["belize"], code: "501", minLen: 10 },
    { match: ["guyana"], code: "592", minLen: 10 },
    { match: ["suriname"], code: "597", minLen: 10 },
    { match: ["egypt"], code: "20", minLen: 12 },
    { match: ["morocco"], code: "212", minLen: 12 },
    { match: ["algeria"], code: "213", minLen: 12 },
    { match: ["tunisia"], code: "216", minLen: 11 },
    { match: ["nigeria"], code: "234", minLen: 13 },
    { match: ["kenya"], code: "254", minLen: 12 },
    { match: ["ghana"], code: "233", minLen: 12 },
    { match: ["ethiopia"], code: "251", minLen: 12 },
    { match: ["tanzania"], code: "255", minLen: 12 },
    { match: ["uganda"], code: "256", minLen: 12 },
    { match: ["rwanda"], code: "250", minLen: 12 },
    { match: ["botswana"], code: "267", minLen: 11 },
    { match: ["namibia"], code: "264", minLen: 11 },
    { match: ["zambia"], code: "260", minLen: 12 },
    { match: ["zimbabwe"], code: "263", minLen: 12 },
    { match: ["mozambique"], code: "258", minLen: 12 },
    { match: ["angola"], code: "244", minLen: 12 },
    { match: ["madagascar"], code: "261", minLen: 12 },
    { match: ["mauritius"], code: "230", minLen: 10 },
    { match: ["seychelles"], code: "248", minLen: 10 },
    { match: ["sierra leone"], code: "232", minLen: 11 },
    { match: ["sudan"], code: "249", minLen: 12 },
    { match: ["fiji"], code: "679", minLen: 10 },
    { match: ["papua new guinea"], code: "675", minLen: 11 },
    { match: ["samoa"], code: "685", minLen: 8 },
    { match: ["vanuatu"], code: "678", minLen: 8 }
  ];

  let codeRemoved = false;
  const matchedCountryCc = countryCodes.find(cc => cc.match.some(m => cLower.includes(m)));

  // 1. Match by detected country strictly: ONLY strip this specific country's calling code
  if (matchedCountryCc) {
    if (digits.startsWith(matchedCountryCc.code) && (hasPlus || has00 || digits.length >= (matchedCountryCc.minLen - 1))) {
      digits = digits.slice(matchedCountryCc.code.length);
      codeRemoved = true;
    }
  }

  // 2. Fallback ONLY when country is unknown OR explicit international prefix (+ or 00) was present
  // NEVER strip foreign country codes (e.g. South Korea +82) from an already-stripped domestic number (e.g. Indonesia 82136903270)
  if (!codeRemoved && (!matchedCountryCc || hasPlus || has00)) {
    for (const cc of countryCodes) {
      if (digits.startsWith(cc.code) && digits.length >= ((hasPlus || has00) ? cc.minLen - 1 : cc.minLen)) {
        digits = digits.slice(cc.code.length);
        codeRemoved = true;
        break;
      }
    }
  }

  // Rule: Take complete phone number, but remove leading zero
  digits = digits.replace(/^0+/, "");

  // Rule: Do NOT take numbers starting with zero
  if (!digits || digits.startsWith("0")) {
    return "";
  }

  // Reject dummy placeholder phone patterns (e.g. 1234567890, 9876543210, 5551234567, or all-identical digits like 99999999)
  if (/^(?:123456789\d?|0?123456789|9876543210?|5551234567|(\d)\1{6,})$/.test(digits)) {
    return "";
  }

  // Rule: STRICTLY DO NOT TAKE TOLL-FREE NUMBERS (US 800/888/877/866/855/844/833, AU 1800/1300, UK 0800/0808/0500)
  // Note: International mobile prefixes like Indonesia 0888 (Smartfren -> 888...) are NOT North American toll-free!
  if (/^(?:1800|1300|0800|0808|0500)/.test(digits)) {
    return "";
  }
  const isNorthAmerica = cLower.includes("united states") || cLower.includes("canada") || cLower.includes("usa") || cLower.includes("america");
  if ((isNorthAmerica || !matchedCountryCc) && /^(?:800|888|877|866|855|844|833|900|901|902)/.test(digits)) {
    return "";
  }

  // Country-specific length validation
  const len = digits.length;
  if (cLower.includes("south africa")) {
    if (len !== 9) return "";
  } else if (isNorthAmerica) {
    if (len !== 10) return "";
  } else if (cLower.includes("taiwan")) {
    if (len < 8 || len > 9) return "";
  } else if (cLower.includes("united kingdom") || cLower.includes("england")) {
    if (len < 9 || len > 10) return "";
  } else if (cLower.includes("india")) {
    if (len !== 10) return "";
  } else if (cLower.includes("australia")) {
    if (len !== 9) return "";
  } else if (cLower.includes("malaysia")) {
    if (len < 8 || len > 10) return "";
  } else if (cLower.includes("new zealand")) {
    if (len < 8 || len > 10) return "";
  } else if (cLower.includes("indonesia")) {
    if (len < 8 || len > 12) return "";
  } else if (cLower.includes("singapore")) {
    if (len !== 8) return "";
  } else if (cLower.includes("spain") || cLower.includes("espana") || cLower.includes("españa")) {
    if (len !== 9) return "";
  } else if (cLower.includes("france")) {
    if (len !== 9) return "";
  } else {
    if (len < 8 || len > 12) return "";
  }

  return digits;
}

