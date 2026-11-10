// Shared country name standardization (135-country QC table) and address-based country detection.

function normalizeCountryName(country) {
  if (!country || typeof country !== "string") return "";
  let c = country.trim().replace(/[\(\)\[\]\{\}]/g, " ").replace(/\s+/g, " ").trim();
  if (c.length < 2) return c;

  const lower = c.toLowerCase();
  const unaccented = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Czech Republic (#32 in QC Valid List)
  if (/\b(?:czech\s*republic|ceska\s*republika|cesko|czechia)\b/i.test(unaccented) || /^(?:cz|cze|czech(?:ia)?)$/i.test(unaccented)) {
    return "Czech Republic";
  }

  // 2. Turkey / Turkiye -> Türkiye (#124 in QC Valid List & Table)
  if (/\b(?:turkey|turkiye|republic\s*of\s*turkiye|republic\s*of\s*turkey)\b/i.test(unaccented) || /^(?:tr|tur)$/i.test(unaccented)) {
    return "Türkiye";
  }

  // 3. USA / United States -> United States Of America (#129 full expansion)
  if (/^(?:u\.?s\.?a?\.?|united\s*states(?:\s*of\s*america)?|the\s*united\s*states)$/i.test(unaccented) || /\bunited\s*states(?:\s*of\s*america)?\b/i.test(unaccented)) {
    return "United States Of America";
  }

  // 4. People's Republic of China -> China vs Republic of China -> Taiwan
  if (/\b(?:people['’]?s?\s*republic\s*of\s*china|p\.?r\.?c\.?)\b/i.test(unaccented)) {
    return "China";
  }
  if (/taiwan/i.test(unaccented) || /\br\.?o\.?c\.?\b/i.test(unaccented) || /\brepublic\s*of\s*china\b/i.test(unaccented)) {
    return "Taiwan";
  }

  // 5. United Kingdom & Constituent Countries
  // QC Rule: UK -> United Kingdom; preserve constituent country when UK omitted
  if (/\bengland\b/i.test(unaccented)) return "England";
  if (/\bscotland\b/i.test(unaccented)) return "Scotland";
  if (/(?<!\bnew\s+south\s+)\bwales\b/i.test(unaccented)) return "Wales";
  if (/\bnorthern\s*ireland\b/i.test(unaccented)) return "Northern Ireland";
  if (/^(?:united\s*kingdom|great\s*britain|uk|u\.k\.|britain)$/i.test(unaccented) || /\bunited\s*kingdom\b/i.test(unaccented)) {
    return "United Kingdom";
  }

  // 6. South Korea & North Korea
  if (/\b(?:north\s*korea|democratic\s*people['’]?s\s*republic\s*of\s*korea|dprk)\b/i.test(unaccented)) {
    return "North Korea";
  }
  if (/\b(?:south\s*korea|korea,\s*republic\s*of|republic\s*of\s*korea|korea\s*republic|rok)\b/i.test(unaccented) || /^korea$/i.test(unaccented)) {
    return "South Korea";
  }

  // 7. Swaziland -> Eswatini
  if (/\b(?:swaziland|eswatini|kingdom\s*of\s*eswatini)\b/i.test(unaccented)) {
    return "Eswatini";
  }

  // 8. North Macedonia (Macedonia / FYROM)
  if (/\b(?:macedonia|north\s*macedonia|republic\s*of\s*north\s*macedonia|fyrom)\b/i.test(unaccented)) {
    return "North Macedonia";
  }

  // 9. Myanmar (Burma)
  if (/\b(?:burma|myanmar|republic\s*of\s*the\s*union\s*of\s*myanmar)\b/i.test(unaccented)) {
    return "Myanmar";
  }

  // 10. Netherlands (Holland / Nederland)
  if (/\b(?:netherlands|nederland|holland|the\s*netherlands|kingdom\s*of\s*the\s*netherlands)\b/i.test(unaccented)) {
    return "Netherlands";
  }

  // 11. Cote D'Ivoire (Ivory Coast)
  if (/\b(?:ivory\s*coast|cote\s*d['’]ivoire|cote\s*divoire)\b/i.test(unaccented)) {
    return "Cote D'Ivoire";
  }

  // 12. Timor-Leste (East Timor)
  if (/\b(?:east\s*timor|timor[\s-]leste)\b/i.test(unaccented)) {
    return "Timor-Leste";
  }

  // 13. Cabo Verde (Cape Verde)
  if (/\b(?:cape\s*verde|cabo\s*verde)\b/i.test(unaccented)) {
    return "Cabo Verde";
  }

  // 14. Vietnam
  if (/\b(?:viet\s*nam|vietnam|socialist\s*republic\s*of\s*vietnam)\b/i.test(unaccented)) {
    return "Vietnam";
  }

  // 15. Brunei Darussalam (#22 in QC Valid List)
  if (/\b(?:brunei\s*darussalam|brunei)\b/i.test(unaccented)) {
    return "Brunei Darussalam";
  }

  // 16. Syria
  if (/\b(?:syrian\s*arab\s*republic|syria)\b/i.test(unaccented)) {
    return "Syria";
  }

  // 17. Laos
  if (/\b(?:lao\s*people['’]?s\s*democratic\s*republic|laos)\b/i.test(unaccented)) {
    return "Laos";
  }

  // 18. Russia
  if (/\b(?:russian\s*federation|russia)\b/i.test(unaccented)) {
    return "Russia";
  }

  // 19. Iran
  if (/\b(?:islamic\s*republic\s*of\s*iran|iran)\b/i.test(unaccented)) {
    return "Iran";
  }

  // 20. Moldova
  if (/\b(?:republic\s*of\s*moldova|moldova)\b/i.test(unaccented)) {
    return "Moldova";
  }

  // 21. Tanzania
  if (/\b(?:united\s*republic\s*of\s*tanzania|tanzania)\b/i.test(unaccented)) {
    return "Tanzania";
  }

  // 22. Bolivia
  if (/\b(?:plurinational\s*state\s*of\s*bolivia|bolivia)\b/i.test(unaccented)) {
    return "Bolivia";
  }

  // 23. Venezuela
  if (/\b(?:bolivarian\s*republic\s*of\s*venezuela|venezuela)\b/i.test(unaccented)) {
    return "Venezuela";
  }

  // 24. New Zealand
  if (/\b(?:new\s*zealand|aotearoa)\b/i.test(unaccented) || /^(?:nz|nzl)$/i.test(unaccented)) {
    return "New Zealand";
  }

  // 25. Malaysia
  if (/\b(?:malaysia|federation\s*of\s*malaysia|persekutuan\s*malaysia)\b/i.test(unaccented) || /^(?:my|mys)$/i.test(unaccented)) {
    return "Malaysia";
  }

  // 26. Indonesia
  if (/\b(?:indonesia|republik\s*indonesia|republic\s*of\s*indonesia)\b/i.test(unaccented) || /^(?:id|idn|ri)$/i.test(unaccented)) {
    return "Indonesia";
  }

  // 27. South Africa
  if (/\b(?:south\s*africa)\b/i.test(unaccented) || /^(?:za|rsa)$/i.test(unaccented)) {
    return "South Africa";
  }

  // 28. Germany
  if (/\b(?:germany|deutschland)\b/i.test(unaccented) || /^(?:de|deu)$/i.test(unaccented)) {
    return "Germany";
  }

  // 29. Italy
  if (/\b(?:italy|italia)\b/i.test(unaccented) || /^(?:it|ita)$/i.test(unaccented)) {
    return "Italy";
  }

  // 30. Spain
  if (/\b(?:spain|espana)\b/i.test(unaccented) || /^(?:es|esp)$/i.test(unaccented)) {
    return "Spain";
  }

  // 31. Australia
  if (/\b(?:australia)\b/i.test(unaccented) || /^(?:au|aus)$/i.test(unaccented)) {
    return "Australia";
  }

  // 32. Singapore
  if (/\b(?:singapore)\b/i.test(unaccented) || /^(?:sg|sgp)$/i.test(unaccented)) {
    return "Singapore";
  }

  // 33. Thailand
  if (/\b(?:thailand)\b/i.test(unaccented) || /^(?:th|tha)$/i.test(unaccented)) {
    return "Thailand";
  }

  // 34. Canada
  if (/\b(?:canada)\b/i.test(unaccented) || /^(?:ca|can)$/i.test(unaccented)) {
    return "Canada";
  }

  // 35. India
  if (/\b(?:india)\b/i.test(unaccented) || /^(?:in|ind)$/i.test(unaccented)) {
    return "India";
  }

  // 36. France
  if (/\b(?:france)\b/i.test(unaccented) || /^(?:fr|fra)$/i.test(unaccented)) {
    return "France";
  }

  // 37. China
  if (/\b(?:china|people['’]?s\s*republic\s*of\s*china|prc)\b/i.test(unaccented) || /^(?:cn|chn)$/i.test(unaccented)) {
    return "China";
  }

  // 38. Japan
  if (/\b(?:japan|nippon|nihon)\b/i.test(unaccented) || /^(?:jp|jpn)$/i.test(unaccented)) {
    return "Japan";
  }

  // 39. Switzerland
  if (/\b(?:switzerland|schweiz|suisse|svizzera)\b/i.test(unaccented) || /^(?:ch|che)$/i.test(unaccented)) {
    return "Switzerland";
  }

  // 40. Ireland
  if (/\b(?:ireland|republic\s*of\s*ireland|eire)\b/i.test(unaccented) || /^(?:ie|irl)$/i.test(unaccented)) {
    return "Ireland";
  }

  // 41. United Arab Emirates
  if (/\b(?:united\s*arab\s*emirates|uae)\b/i.test(unaccented) || /^(?:ae|are)$/i.test(unaccented)) {
    return "United Arab Emirates";
  }

  // 42. Saudi Arabia
  if (/\b(?:saudi\s*arabia|kingdom\s*of\s*saudi\s*arabia|ksa)\b/i.test(unaccented) || /^(?:sa|sau)$/i.test(unaccented)) {
    return "Saudi Arabia";
  }

  // 43. Brazil
  if (/\b(?:brazil|brasil)\b/i.test(unaccented) || /^(?:br|bra)$/i.test(unaccented)) {
    return "Brazil";
  }

  // 44. Mexico
  if (/\b(?:mexico)\b/i.test(unaccented) || /^(?:mx|mex)$/i.test(unaccented)) {
    return "Mexico";
  }

  // 45. Poland
  if (/\b(?:poland|polska)\b/i.test(unaccented) || /^(?:pl|pol)$/i.test(unaccented)) {
    return "Poland";
  }

  // 46. Austria
  if (/\b(?:austria|osterreich|oesterreich)\b/i.test(unaccented) || /^(?:at|aut)$/i.test(unaccented)) {
    return "Austria";
  }

  // 47. Belgium
  if (/\b(?:belgium|belgie|belgique)\b/i.test(unaccented) || /^(?:be|bel)$/i.test(unaccented)) {
    return "Belgium";
  }

  // 48. Sweden
  if (/\b(?:sweden|sverige)\b/i.test(unaccented) || /^(?:se|swe)$/i.test(unaccented)) {
    return "Sweden";
  }

  // 49. Norway
  if (/\b(?:norway|norge)\b/i.test(unaccented) || /^(?:no|nor)$/i.test(unaccented)) {
    return "Norway";
  }

  // 50. Denmark
  if (/\b(?:denmark|danmark)\b/i.test(unaccented) || /^(?:dk|dnk)$/i.test(unaccented)) {
    return "Denmark";
  }

  // 51. Finland
  if (/\b(?:finland|suomi)\b/i.test(unaccented) || /^(?:fi|fin)$/i.test(unaccented)) {
    return "Finland";
  }

  // 52. Portugal
  if (/\b(?:portugal)\b/i.test(unaccented) || /^(?:pt|prt)$/i.test(unaccented)) {
    return "Portugal";
  }

  // 53. Greece
  if (/\b(?:greece|hellas)\b/i.test(unaccented) || /^(?:gr|grc)$/i.test(unaccented)) {
    return "Greece";
  }

  // 54. Philippines
  if (/\b(?:philippines|pilipinas)\b/i.test(unaccented) || /^(?:ph|phl)$/i.test(unaccented)) {
    return "Philippines";
  }

  // 55. Croatia (Hrvatska -> Croatia)
  if (/\b(?:croatia|hrvatska|republic\s*of\s*croatia)\b/i.test(unaccented) || /^(?:hr|hrv)$/i.test(unaccented)) {
    return "Croatia";
  }

  // 56. Bahrain (Kingdom of Bahrain -> Bahrain)
  if (/\b(?:bahrain|kingdom\s*of\s*bahrain)\b/i.test(unaccented) || /^(?:bh|bhr)$/i.test(unaccented)) {
    return "Bahrain";
  }

  // 57. Oman (Sultanate of Oman -> Oman)
  if (/\b(?:oman|sultanate\s*of\s*oman)\b/i.test(unaccented) || /^(?:om|omn)$/i.test(unaccented)) {
    return "Oman";
  }

  // 58. Hong Kong
  if (/\b(?:hong\s*kong|hongkong)\b/i.test(unaccented) || /^(?:hk|hkg)$/i.test(unaccented)) {
    return "Hong Kong";
  }

  // 59. Trinidad and Tobago (preserve exact lowercase "and" per valid country table)
  if (/\b(?:trinidad\s*(?:and|&)\s*tobago)\b/i.test(unaccented) || /^(?:tt|tto|t&t|t\s*&\s*t)$/i.test(unaccented)) {
    return "Trinidad and Tobago";
  }

  // 60. Full map of all remaining countries & abbreviations from 135-country valid list
  const exactCountryMap = {
    "afghanistan": "Afghanistan", "af": "Afghanistan", "afg": "Afghanistan",
    "albania": "Albania", "shqiperia": "Albania", "al": "Albania", "alb": "Albania",
    "algeria": "Algeria", "algerie": "Algeria", "dz": "Algeria", "dza": "Algeria",
    "andorra": "Andorra", "ad": "Andorra", "and": "Andorra",
    "angola": "Angola", "ao": "Angola", "ago": "Angola",
    "argentina": "Argentina", "ar": "Argentina", "arg": "Argentina",
    "armenia": "Armenia", "am": "Armenia", "arm": "Armenia",
    "azerbaijan": "Azerbaijan", "az": "Azerbaijan", "aze": "Azerbaijan",
    "bahamas": "Bahamas", "the bahamas": "Bahamas", "bs": "Bahamas", "bhs": "Bahamas",
    "bangladesh": "Bangladesh", "bd": "Bangladesh", "bgd": "Bangladesh",
    "barbados": "Barbados", "bb": "Barbados", "brb": "Barbados",
    "belarus": "Belarus", "by": "Belarus", "blr": "Belarus",
    "belize": "Belize", "bz": "Belize", "blz": "Belize",
    "bhutan": "Bhutan", "bt": "Bhutan", "btn": "Bhutan",
    "botswana": "Botswana", "bw": "Botswana", "bwa": "Botswana",
    "bulgaria": "Bulgaria", "bg": "Bulgaria", "bgr": "Bulgaria",
    "cambodia": "Cambodia", "kh": "Cambodia", "khm": "Cambodia",
    "cayman islands": "Cayman Islands", "ky": "Cayman Islands", "cym": "Cayman Islands",
    "colombia": "Colombia", "co": "Colombia", "col": "Colombia",
    "costa rica": "Costa Rica", "cr": "Costa Rica", "cri": "Costa Rica",
    "cyprus": "Cyprus", "cy": "Cyprus", "cyp": "Cyprus",
    "dominican republic": "Dominican Republic", "dom rep": "Dominican Republic", "dr": "Dominican Republic", "do": "Dominican Republic", "dom": "Dominican Republic",
    "egypt": "Egypt", "eg": "Egypt", "egy": "Egypt",
    "estonia": "Estonia", "eesti": "Estonia", "ee": "Estonia", "est": "Estonia",
    "ethiopia": "Ethiopia", "et": "Ethiopia", "eth": "Ethiopia",
    "fiji": "Fiji", "fj": "Fiji", "fji": "Fiji",
    "ghana": "Ghana", "gh": "Ghana", "gha": "Ghana",
    "greenland": "Greenland", "kalaallit nunaat": "Greenland", "gl": "Greenland", "grl": "Greenland",
    "guatemala": "Guatemala", "gt": "Guatemala", "gtm": "Guatemala",
    "guyana": "Guyana", "gy": "Guyana", "guy": "Guyana",
    "hungary": "Hungary", "magyarorszag": "Hungary", "hu": "Hungary", "hun": "Hungary",
    "iceland": "Iceland", "island": "Iceland", "is": "Iceland", "isl": "Iceland",
    "iraq": "Iraq", "iq": "Iraq", "irq": "Iraq",
    "israel": "Israel", "il": "Israel", "isr": "Israel",
    "jamaica": "Jamaica", "jm": "Jamaica", "jam": "Jamaica",
    "jordan": "Jordan", "jo": "Jordan", "jor": "Jordan",
    "kazakhstan": "Kazakhstan", "kz": "Kazakhstan", "kaz": "Kazakhstan",
    "kenya": "Kenya", "ke": "Kenya", "ken": "Kenya",
    "kuwait": "Kuwait", "kw": "Kuwait", "kwt": "Kuwait",
    "latvia": "Latvia", "latvija": "Latvia", "lv": "Latvia", "lva": "Latvia",
    "lebanon": "Lebanon", "liban": "Lebanon", "lb": "Lebanon", "lbn": "Lebanon",
    "liechtenstein": "Liechtenstein", "li": "Liechtenstein", "lie": "Liechtenstein",
    "lithuania": "Lithuania", "lietuva": "Lithuania", "lt": "Lithuania", "ltu": "Lithuania",
    "luxembourg": "Luxembourg", "luxemburg": "Luxembourg", "lu": "Luxembourg", "lux": "Luxembourg",
    "madagascar": "Madagascar", "mg": "Madagascar", "mdg": "Madagascar",
    "maldives": "Maldives", "mv": "Maldives", "mdv": "Maldives",
    "malta": "Malta", "mt": "Malta", "mlt": "Malta",
    "mauritius": "Mauritius", "mu": "Mauritius", "mus": "Mauritius",
    "mongolia": "Mongolia", "mn": "Mongolia", "mng": "Mongolia",
    "morocco": "Morocco", "maroc": "Morocco", "ma": "Morocco", "mar": "Morocco",
    "mozambique": "Mozambique", "mocambique": "Mozambique", "mz": "Mozambique", "moz": "Mozambique",
    "namibia": "Namibia", "na": "Namibia", "nam": "Namibia",
    "nepal": "Nepal", "np": "Nepal", "npl": "Nepal",
    "nicaragua": "Nicaragua", "ni": "Nicaragua", "nic": "Nicaragua",
    "nigeria": "Nigeria", "ng": "Nigeria", "nga": "Nigeria",
    "norway": "Norway", "no": "Norway", "nor": "Norway",
    "pakistan": "Pakistan", "pk": "Pakistan", "pak": "Pakistan",
    "panama": "Panama", "pa": "Panama", "pan": "Panama",
    "papua new guinea": "Papua New Guinea", "png": "Papua New Guinea", "pg": "Papua New Guinea",
    "paraguay": "Paraguay", "py": "Paraguay", "pry": "Paraguay",
    "peru": "Peru", "pe": "Peru", "per": "Peru",
    "qatar": "Qatar", "qa": "Qatar", "qat": "Qatar",
    "romania": "Romania", "ro": "Romania", "rou": "Romania",
    "rwanda": "Rwanda", "rw": "Rwanda", "rwa": "Rwanda",
    "saint lucia": "Saint Lucia", "st lucia": "Saint Lucia", "st. lucia": "Saint Lucia", "lc": "Saint Lucia", "lca": "Saint Lucia",
    "samoa": "Samoa", "ws": "Samoa", "wsm": "Samoa",
    "serbia": "Serbia", "srbija": "Serbia", "rs": "Serbia", "srb": "Serbia",
    "seychelles": "Seychelles", "sc": "Seychelles", "syc": "Seychelles",
    "sierra leone": "Sierra Leone", "sl": "Sierra Leone", "sle": "Sierra Leone",
    "slovakia": "Slovakia", "slovensko": "Slovakia", "slovak republic": "Slovakia", "sk": "Slovakia", "svk": "Slovakia",
    "slovenia": "Slovenia", "slovenija": "Slovenia", "si": "Slovenia", "svn": "Slovenia",
    "sri lanka": "Sri Lanka", "lk": "Sri Lanka", "lka": "Sri Lanka",
    "sudan": "Sudan", "sd": "Sudan", "sdn": "Sudan",
    "suriname": "Suriname", "sr": "Suriname", "sur": "Suriname",
    "tunisia": "Tunisia", "tunisie": "Tunisia", "tn": "Tunisia", "tun": "Tunisia",
    "uganda": "Uganda", "ug": "Uganda", "uga": "Uganda",
    "ukraine": "Ukraine", "ukraina": "Ukraine", "ua": "Ukraine", "ukr": "Ukraine",
    "uruguay": "Uruguay", "uy": "Uruguay", "ury": "Uruguay",
    "uzbekistan": "Uzbekistan", "uz": "Uzbekistan", "uzb": "Uzbekistan",
    "vanuatu": "Vanuatu", "vu": "Vanuatu", "vut": "Vanuatu",
    "zambia": "Zambia", "zm": "Zambia", "zmb": "Zambia",
    "zimbabwe": "Zimbabwe", "zw": "Zimbabwe", "zwe": "Zimbabwe",
    "brunei": "Brunei Darussalam", "bn": "Brunei Darussalam", "brn": "Brunei Darussalam",
    "u.a.e.": "United Arab Emirates", "united arab emirates": "United Arab Emirates",
    "united states": "United States Of America", "united states of america": "United States Of America"
  };
  const cleanLookup = unaccented.replace(/^(?:the\s+)?(?:kingdom|sultanate|principality|grand\s+duchy|commonwealth|state|federation|republic|islamic\s+republic|people['’]?s\s+republic|democratic\s+republic)\s+of\s+/i, "").trim();
  if (exactCountryMap[unaccented]) return exactCountryMap[unaccented];
  if (exactCountryMap[cleanLookup]) return exactCountryMap[cleanLookup];

  return toTitleCase(c);
}

/**
 * Determines Country Name EXCLUSIVELY from the physical address string.
 * Strictly NEVER checks or guesses from the domain name or URL extension.
 */
function detectCountryFromAddress(address) {
  if (!address || typeof address !== "string" || address.trim().length < 3) return "";
  const lower = address.toLowerCase();

  // 1. Explicit country mentioned in the physical address text
  if (/\b(?:czech\s*republic|ceska\s*republika|česká\s*republika|cesko|česko|czechia)\b/i.test(lower)) return "Czech Republic";
  if (/\b(south\s*africa)\b/i.test(lower)) return "South Africa";
  if (/\b(people['’]?s?\s*republic\s*of\s*china|p\.?r\.?c\.?)\b/i.test(lower)) return "China";
  if (/\b(taiwan|republic\s*of\s*china|r\.?o\.?c\.?)\b/i.test(lower) || /(?:臺灣|台灣|臺北|台北|新北|桃園|台中|臺中|台南|臺南|高雄|新竹|彰化|苗栗|南投|雲林|嘉義|屏東|宜蘭|花蓮|台東|臺東|澎湖|金門|連江|大里區|草堤路)/.test(address)) return "Taiwan";
  if (/\b(england)\b/i.test(lower)) return "England";
  if (/\b(scotland)\b/i.test(lower)) return "Scotland";
  if (/(?<!\bnew\s+south\s+)\bwales\b/i.test(lower)) return "Wales";
  if (/\b(northern\s*ireland)\b/i.test(lower)) return "Northern Ireland";
  if (/\b(united\s*kingdom|great\s*britain|uk)\b/i.test(lower)) {
    // QC Mandate: If constituent country is also mentioned, take that (e.g. "England and United Kingdom"):
    if (/\b(?:england)\b/i.test(lower)) return "England";
    if (/\b(?:scotland)\b/i.test(lower)) return "Scotland";
    if (/(?<!\bnew\s+south\s+)\b(?:wales)\b/i.test(lower)) return "Wales";
    if (/\b(?:northern\s*ireland)\b/i.test(lower)) return "Northern Ireland";
    // Otherwise, if website address literally says United Kingdom / UK, return "United Kingdom"!
    return "United Kingdom";
  }
  if (/\b(united\s*states(?:\s*of\s*america)?|usa|u\.s\.a\.?|u\.s\.?)\b/i.test(lower)) return "United States Of America";
  if (/\b(australia)\b/i.test(lower)) return "Australia";
  if (/\b(canada)\b/i.test(lower)) return "Canada";
  if (/\b(germany|deutschland)\b/i.test(lower)) return "Germany";
  if (/\b(india)\b/i.test(lower)) return "India";
  if (/\b(france)\b/i.test(lower)) return "France";
  if (/\b(people'?s?\s*republic\s*of\s*china|p\.?r\.?c\.?|china)\b/i.test(lower)) return "China";
  if (/\b(japan)\b/i.test(lower)) return "Japan";
  if (/\b(north\s*korea|d\.?p\.?r\.?k\.?)\b/i.test(lower)) return "North Korea";
  if (/\b(south\s*korea|republic\s*of\s*korea|korea)\b/i.test(lower)) return "South Korea";
  if (/\b(singapore)\b/i.test(lower)) return "Singapore";
  if (/\b(netherlands|nederland|holland)\b/i.test(lower)) return "Netherlands";
  if (/\b(?:new\s*zealand|aotearoa)\b/i.test(lower) || /,\s*nz\b/i.test(lower) || /\bnz\s+\d{4}\b/i.test(lower)) return "New Zealand";
  if (/\b(?:malaysia|federation\s*of\s*malaysia|persekutuan\s*malaysia)\b/i.test(lower)) return "Malaysia";
  if (/\b(?:indonesia|republik\s*indonesia|republic\s*of\s*indonesia)\b/i.test(lower)) return "Indonesia";
  if (/\b(united\s*arab\s*emirates|uae)\b/i.test(lower)) return "United Arab Emirates";
  if (/\b(italy|italia)\b/i.test(lower)) return "Italy";
  if (/\b(spain|espa[nñ]a)\b/i.test(lower)) return "Spain";
  if (/\b(t[uü]rkiye|turkey|republic\s*of\s*t[uü]rkiye|republic\s*of\s*turkey)\b/i.test(lower)) return "Türkiye";
  if (/\b(austria|[oö]sterreich|oesterreich)\b/i.test(lower)) return "Austria";
  if (/\b(switzerland|schweiz|suisse|svizzera)\b/i.test(lower)) return "Switzerland";
  if (/\b(croatia|hrvatska)\b/i.test(lower)) return "Croatia";
  if (/\b(kingdom\s*of\s*bahrain|bahrain)\b/i.test(lower)) return "Bahrain";
  if (/\b(sultanate\s*of\s*oman|oman)\b/i.test(lower)) return "Oman";
  if (/\b(brunei\s*darussalam|brunei)\b/i.test(lower)) return "Brunei Darussalam";
  if (/\b(hong\s*kong)\b/i.test(lower)) return "Hong Kong";
  if (/\b(saudi\s*arabia)\b/i.test(lower)) return "Saudi Arabia";
  if (/\b(qatar|kuwait|jordan|lebanon|israel|egypt|morocco|tunisia|algeria)\b/i.test(lower)) {
    const m = lower.match(/\b(qatar|kuwait|jordan|lebanon|israel|egypt|morocco|tunisia|algeria)\b/i);
    if (m) return toTitleCase(m[1]);
  }
  if (/\b(belgium|belgi[eë]|belgique|poland|polska|portugal|greece|hellas|sweden|sverige|norway|norge|denmark|danmark|finland|suomi|hungary|magyarorsz[aá]g|romania|bulgaria|slovakia|slovenia|serbia|ukraine|russia|russian\s*federation|belarus|estonia|latvia|lithuania|luxembourg|iceland|malta|cyprus|andorra|liechtenstein|albania|moldova|north\s*macedonia|armenia|azerbaijan|kazakhstan|uzbekistan)\b/i.test(lower)) {
    if (/\b(belgium|belgi[eë]|belgique)\b/i.test(lower)) return "Belgium";
    if (/\b(poland|polska)\b/i.test(lower)) return "Poland";
    if (/\b(greece|hellas)\b/i.test(lower)) return "Greece";
    if (/\b(sweden|sverige)\b/i.test(lower)) return "Sweden";
    if (/\b(norway|norge)\b/i.test(lower)) return "Norway";
    if (/\b(denmark|danmark)\b/i.test(lower)) return "Denmark";
    if (/\b(finland|suomi)\b/i.test(lower)) return "Finland";
    if (/\b(hungary|magyarorsz[aá]g)\b/i.test(lower)) return "Hungary";
    if (/\b(russia|russian\s*federation)\b/i.test(lower)) return "Russia";
    if (/\b(north\s*macedonia)\b/i.test(lower)) return "North Macedonia";
    const m = lower.match(/\b(portugal|romania|bulgaria|slovakia|slovenia|serbia|ukraine|belarus|estonia|latvia|lithuania|luxembourg|iceland|malta|cyprus|andorra|liechtenstein|albania|moldova|armenia|azerbaijan|kazakhstan|uzbekistan)\b/i);
    if (m) return toTitleCase(m[1]);
  }
  if (/\b(viet\s*nam|vietnam|philippines|pakistan|bangladesh|sri\s*lanka|nepal|bhutan|myanmar|cambodia|maldives|mongolia|afghanistan|iran|iraq|syria)\b/i.test(lower)) {
    if (/\b(viet\s*nam|vietnam)\b/i.test(lower)) return "Vietnam";
    if (/\b(sri\s*lanka)\b/i.test(lower)) return "Sri Lanka";
    const m = lower.match(/\b(philippines|pakistan|bangladesh|nepal|bhutan|myanmar|cambodia|maldives|mongolia|afghanistan|iran|iraq|syria)\b/i);
    if (m) return toTitleCase(m[1]);
  }
  if (/\b(mexico|m[eé]xico|brazil|brasil|argentina|colombia|peru|per[uú]|uruguay|paraguay|bolivia|costa\s*rica|panama|guatemala|nicaragua|belize|guyana|suriname|jamaica|bahamas|barbados|dominican\s*republic|cayman\s*islands|saint\s*lucia|trinidad\s*(?:and|&)\s*tobago|fiji|papua\s*new\s*guinea|samoa|vanuatu)\b/i.test(lower)) {
    if (/\b(mexico|m[eé]xico)\b/i.test(lower)) return "Mexico";
    if (/\b(brazil|brasil)\b/i.test(lower)) return "Brazil";
    if (/\b(peru|per[uú])\b/i.test(lower)) return "Peru";
    if (/\b(trinidad\s*(?:and|&)\s*tobago)\b/i.test(lower)) return "Trinidad and Tobago";
    if (/\b(costa\s*rica|dominican\s*republic|cayman\s*islands|saint\s*lucia|papua\s*new\s*guinea)\b/i.test(lower)) {
      const m2 = lower.match(/\b(costa\s*rica|dominican\s*republic|cayman\s*islands|saint\s*lucia|papua\s*new\s*guinea)\b/i);
      if (m2) return toTitleCase(m2[1]);
    }
    const m = lower.match(/\b(argentina|colombia|uruguay|paraguay|bolivia|panama|guatemala|nicaragua|belize|guyana|suriname|jamaica|bahamas|barbados|fiji|samoa|vanuatu)\b/i);
    if (m) return toTitleCase(m[1]);
  }
  if (/\b(nigeria|kenya|ghana|ethiopia|tanzania|uganda|rwanda|botswana|namibia|zambia|zimbabwe|mozambique|angola|madagascar|mauritius|seychelles|sierra\s*leone|sudan)\b/i.test(lower)) {
    if (/\b(sierra\s*leone)\b/i.test(lower)) return "Sierra Leone";
    const m = lower.match(/\b(nigeria|kenya|ghana|ethiopia|tanzania|uganda|rwanda|botswana|namibia|zambia|zimbabwe|mozambique|angola|madagascar|mauritius|seychelles|sudan)\b/i);
    if (m) return toTitleCase(m[1]);
  }
  //.
  // 2. Definitive administrative regions/towns explicitly appearing in physical address
  if (/\b(?:prague|praha|brno|ostrava|plzen|plzeň|olomouc|liberec|ceske\s*budejovice|české\s*budějovice|hradec\s*kralove|hradec\s*králové|usti\s*nad\s*labem|pardubice|zlin|zlín|havirov|kladno|most|karvina|opava|frydek-mistek)\b/i.test(lower)) {
    return "Czech Republic";
  }
  if (/\b(taoyuan\s*hsien|taoyuan|yangmei|taipei|new\s*taipei|kaohsiung|taichung|tainan|hsinchu)\b/i.test(lower)) {
    return "Taiwan";
  }
  if (/\b(boksburg|johannesburg|pretoria|durban|cape\s*town|sandton|midrand|centurion|gauteng|ekurhuleni)\b/i.test(lower)) {
    return "South Africa";
  }
  if (/\b(ireland)\b/i.test(lower)) return "Ireland";
  if (/\b(thailand)\b/i.test(lower)) return "Thailand";

  // 2. Verified State / Province / County / Region in the physical address text
  // Canada provinces, territory codes, Canadian postal code pattern (A1A 1A1)
  if (/\b(?:ontario|quebec|british\s*columbia|alberta|manitoba|saskatchewan|nova\s*scotia|new\s*brunswick|newfoundland|prince\s*edward\s*island)\b/i.test(lower) ||
    /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i.test(address) ||
    /(?:^|[,\s])(?:QC|BC|AB|ON|MB|SK|NS|NB|NL|PE)\b/i.test(address) && /\b(?:Canada|CA)\b/i.test(address) ||
    /,\s*(?:QC|BC|AB|ON|MB|SK|NS|NB|NL|PE)(?:,\s*CA)?\s*$/i.test(address) ||
    /\b(?:Montreal|Toronto|Vancouver|Calgary|Edmonton|Ottawa|Winnipeg|Quebec\s*City|Hamilton|Kitchener|London|Victoria|Halifax|Longueuil|Laval|Gatineau|Burnaby|Richmond|Saskatoon|Regina)\b/i.test(lower) && /\b(?:Canada|CA|QC|BC|AB|ON|MB|SK)\b/i.test(address)) {
    return "Canada";
  }

  // Indonesia check MUST run before US 2-letter state code + 5-digit zip fallback (because Indonesia uses 5-digit postcodes and ISO code ", ID")
  if (hasIndonesiaAddressSignal(address, "") || (/\b(?:jepara|semarang|surabaya|bandung|bekasi|tangerang|jakarta|jawa|kabupaten|kecamatan|jalan|perumahan)\b/i.test(lower) && /,\s*id\s*$/i.test(lower))) {
    return "Indonesia";
  }

  const US_STATE_CODES_STR = "al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy";
  if (new RegExp(`(?:^|[,\\s])(?:${US_STATE_CODES_STR})\\s+\\d{5}(?:-\\d{4})?\\b`, "i").test(lower)) return "United States Of America";
  if (new RegExp(`,\\s*(?:${US_STATE_CODES_STR})\\s*$`, "i").test(lower)) return "United States Of America";
  if (/\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new\s*hampshire|new\s*jersey|new\s*mexico|new\s*york|north\s*carolina|north\s*dakota|ohio|oklahoma|oregon|pennsylvania|rhode\s*island|south\s*carolina|south\s*dakota|tennessee|texas|utah|vermont|virginia|washington|west\s*virginia|wisconsin|wyoming|district\s*of\s*columbia)\b/i.test(lower)) return "United States Of America";
  if (/\b(?:new\s*south\s*wales|victoria|queensland|western\s*australia|south\s*australia|tasmania|northern\s*territory|australian\s*capital\s*territory|sydney|melbourne|brisbane|perth|adelaide|canberra|hobart|darwin|gold\s*coast|newcastle|wollongong|geelong|cairns|townsville)\b/i.test(lower) ||
    /\b(?:vic|nsw|qld|wa|sa|tas|act|nt)\s+\d{4}\b/i.test(lower) ||
    /,\s*(?:vic|nsw|qld|wa|sa|tas|act|nt)\b/i.test(lower)) return "Australia";
  if (/\b(bavaria|bayern|baden-wurttemberg|nordrhein-westfalen|hessen|sachsen)\b/i.test(lower)) return "Germany";
  if (/\b(andaluc[ií]a|catalu[nñ]a|galicia|pa[ií]s\s*vasco|arag[oó]n|asturias|baleares|canarias|cantabria|castilla|extremadura|navarra|rioja|barcelona|valencia|sevilla|zaragoza|málaga|malaga|murcia|alicante|córdoba|cordoba|valladolid|vigo|gijón|gijon|coruña|coruna|toledo|vizcaya|bizkaia)\b/i.test(lower)) return "Spain";
  if (/\b(maharashtra|karnataka|tamil\s*nadu|gujarat|uttar\s*pradesh|telangana|delhi)\b/i.test(lower)) return "India";
  if (/\b(taoyuan|hsinchu|miaoli|changhua|nantou|yunlin|chiayi|pingtung|yilan|hualien|taitung)\s*(hsien|county)\b/i.test(lower)) return "Taiwan";
  if (/\b(istanbul|ankara|izmir|bursa|antalya|adana|konya|gaziantep|kocaeli|mersin|diyarbakir|kayseri|eski[sş]ehir|sanliurfa|şanlıurfa|samsun|denizli|sakarya|mu[gğ]la|trabzon)\b/i.test(lower)) return "Türkiye";
  // Malaysia states & major cities
  if (/\b(selangor|johor|perak|kedah|pahang|negeri\s*sembilan|melaka|malacca|terengganu|kelantan|sabah|sarawak|perlis|wilayah\s*persekutuan|labuan|subang\s*jaya|petaling\s*jaya|shah\s*alam|klang|johor\s*bahru|george\s*town|ipoh|kota\s*kinabalu|kuching|seremban|batu\s*pahat|pasir\s*gudang|iskandar\s*puteri|puchong|cheras|cyberjaya|rawang|kajang|kuantan|alor\s*setar|taiping|sungai\s*petani|bintulu|miri|sibu|sandakan|tawau|butterworth|bukit\s*mertajam|nilai|semenyih)\b/i.test(lower)) return "Malaysia";
  if (/\b(penang|pulau\s*pinang)\b/i.test(lower) && !/\b(?:penang\s+road|penang\s+street|penang\s+lane)\b/i.test(lower)) return "Malaysia";
  // Indonesia provinces & major cities
  if (/\b(jawa\s*barat|jawa\s*tengah|jawa\s*timur|west\s*java|central\s*java|east\s*java|banten|sumatera\s*utara|sumatera\s*barat|sumatera\s*selatan|north\s*sumatra|west\s*sumatra|south\s*sumatra|kalimantan\s*(?:timur|barat|selatan|tengah|utara)?|sulawesi\s*(?:selatan|utara|tengah|tenggara|barat)?|kepulauan\s*riau|bangka\s*belitung|nusa\s*tenggara\s*(?:barat|timur)?|dki\s*jakarta|di\s*yogyakarta|surabaya|bandung|medan|semarang|makassar|palembang|tangerang|tangerang\s*selatan|bekasi|depok|bogor|batam|pekanbaru|bandar\s*lampung|balikpapan|denpasar|samarinda|cikarang|karawang|sidoarjo|gresik|serang|cilegon|solo|surakarta|malang|pontianak|manado|banjarmasin|cimahi|sukabumi|cirebon|tasikmalaya|purwakarta|jepara)\b/i.test(lower)) return "Indonesia";
  // New Zealand regions & major cities
  if (/\b(canterbury|waikato|bay\s*of\s*plenty|otago|hawke's\s*bay|hawkes\s*bay|taranaki|manawatu|southland|northland|marlborough|tasman|west\s*coast|auckland|christchurch|hamilton|tauranga|dunedin|lower\s*hutt|upper\s*hutt|palmerston\s*north|invercargill|rotorua|whangarei|napier|porirua|new\s*plymouth|queenstown|blenheim|timaru|taupo|pukekohe|cambridge|whakatane|hastings|gisborne|nelson|whanganui|feilding|levin|masterton|ashburton|rangiora|rolleston|wanaka)\b/i.test(lower)) return "New Zealand";

  // China provinces, major cities & Chinese characters
  if (/\b(guangdong|jiangsu|zhejiang|shandong|henan|sichuan|hubei|hunan|hebei|fujian|anhui|liaoning|shaanxi|jiangxi|huizhou|shenzhen|guangzhou|dongguan|foshan|zhongshan|zhuhai|suzhou|wuxi|changzhou|nanjing|hangzhou|ningbo|wenzhou|jiaxing|qingdao|jinan|yantai|weifang|xiamen|fuzhou|quanzhou|chengdu|wuhan|changsha|zhengzhou)\b/i.test(lower) || /[\u4e00-\u9fa5]/.test(address)) {
    return "China";
  }

  // Global major cities/provinces for additional 135-country coverage
  if (/\b(dubai|abu\s*dhabi|sharjah|ajman|ras\s*al\s*khaimah|fujairah)\b/i.test(lower)) return "United Arab Emirates";
  if (/\b(riyadh|jeddah|dammam|khobar|makkah|madinah)\b/i.test(lower)) return "Saudi Arabia";
  if (/\b(doha|al\s*wakrah)\b/i.test(lower)) return "Qatar";
  if (/\b(manama|muharraq)\b/i.test(lower)) return "Bahrain";
  if (/\b(muscat|salalah|sohar)\b/i.test(lower)) return "Oman";
  if (/\b(kuwait\s*city|hawalli)\b/i.test(lower)) return "Kuwait";
  if (/\b(zagreb|split|rijeka|osijek|zadar|dubrovnik)\b/i.test(lower)) return "Croatia";
  if (/\b(warsaw|warszawa|krak[oó]w|wroc[lł]aw|pozna[nń]|gda[nń]sk|[lł][oó]d[zź]|katowice)\b/i.test(lower)) return "Poland";
  if (/\b(bucharest|bucure[sş]ti|cluj-napoca|timi[sş]oara|ia[sş]i|bra[sş]ov|constan[tţ]a)\b/i.test(lower)) return "Romania";
  if (/\b(budapest|debrecen|szeged|miskolc)\b/i.test(lower)) return "Hungary";
  if (/\b(sofia|plovdiv|varna|burgas)\b/i.test(lower)) return "Bulgaria";
  if (/\b(bratislava|ko[sš]ice)\b/i.test(lower)) return "Slovakia";
  if (/\b(ljubljana|maribor)\b/i.test(lower)) return "Slovenia";
  if (/\b(belgrade|beograd|novi\s*sad)\b/i.test(lower)) return "Serbia";
  if (/\b(athens|athina|thessaloniki)\b/i.test(lower)) return "Greece";
  if (/\b(lisbon|lisboa|porto)\b/i.test(lower)) return "Portugal";
  if (/\b(vienna|wien|graz|linz|salzburg|innsbruck)\b/i.test(lower)) return "Austria";
  if (/\b(brussels|bruxelles|brussel|antwerp|antwerpen|ghent|gent)\b/i.test(lower)) return "Belgium";
  if (/\b(stockholm|gothenburg|g[oö]teborg|malm[oö]|uppsala)\b/i.test(lower)) return "Sweden";
  if (/\b(oslo|bergen|trondheim|stavanger)\b/i.test(lower)) return "Norway";
  if (/\b(copenhagen|k[oø]benhavn|aarhus|odense)\b/i.test(lower)) return "Denmark";
  if (/\b(helsinki|espoo|tampere|turku|oulu)\b/i.test(lower)) return "Finland";
  if (/\b(moscow|moskva|saint\s*petersburg|novosibirsk|yekaterinburg|kazan)\b/i.test(lower)) return "Russia";
  if (/\b(kyiv|kiev|kharkiv|odesa|odessa|dnipro|lviv)\b/i.test(lower)) return "Ukraine";
  if (/\b(tel\s*aviv|jerusalem|haifa)\b/i.test(lower)) return "Israel";
  if (/\b(cairo|alexandria|giza)\b/i.test(lower)) return "Egypt";
  if (/\b(casablanca|rabat|marrakech|tangier)\b/i.test(lower)) return "Morocco";
  if (/\b(lagos|abuja|kano|ibadan)\b/i.test(lower)) return "Nigeria";
  if (/\b(nairobi|mombasa)\b/i.test(lower)) return "Kenya";
  if (/\b(karachi|lahore|islamabad|faisalabad|rawalpindi|sialkot|gujranwala|punjab|sindh|khyber\s*pakhtunkhwa|balochistan)\b/i.test(lower)) return "Pakistan";
  if (/\b(dhaka|chattogram|chittagong|khulna|sylhet|rajshahi)\b/i.test(lower)) return "Bangladesh";
  if (/\b(colombo|kandy|galle)\b/i.test(lower)) return "Sri Lanka";
  if (/\b(manila|quezon\s*city|cebu|makati|taguig|pasig|davao)\b/i.test(lower)) return "Philippines";
  if (/\b(ho\s*chi\s*minh|hanoi|ha\s*noi|da\s*nang|hai\s*phong)\b/i.test(lower)) return "Vietnam";
  if (/\b(s[aã]o\s*paulo|rio\s*de\s*janeiro|belo\s*horizonte|curitiba|porto\s*alegre|bras[ií]lia|campinas)\b/i.test(lower)) return "Brazil";
  if (/\b(mexico\s*city|ciudad\s*de\s*m[eé]xico|guadalajara|monterrey|puebla|tijuana|quer[eé]taro)\b/i.test(lower)) return "Mexico";
  if (/\b(buenos\s*aires|c[oó]rdoba\s*capital|rosario|mendoza)\b/i.test(lower)) return "Argentina";
  if (/\b(bogot[aá]|medell[ií]n|cali|barranquilla)\b/i.test(lower)) return "Colombia";
  if (/\b(arequipa|trujillo|callao)\b/i.test(lower)) return "Peru";
  if (/\b(bandar\s*seri\s*begawan|kuala\s*belait)\b/i.test(lower)) return "Brunei Darussalam";
  if (/\b(kowloon|tsim\s*sha\s*tsui|tsuen\s*wan|kwun\s*tong|sha\s*tin|causeway\s*bay|wan\s*chai)\b/i.test(lower)) return "Hong Kong";

  // UK postcodes & major UK counties / administrative regions
  if (/\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(lower)) {
    if (/\b(?:eh|g|ab|dd|dg|fk|hs|iv|ka|kw|ky|ml|pa|ph|td|ze)\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(lower)) return "Scotland";
    if (/\b(?:cf|ld|ll|np|sa)\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(lower)) return "Wales";
    if (/\bbt\d[a-z\d]?\s*\d[a-z]{2}\b/i.test(lower)) return "Northern Ireland";
    return "England";
  }
  if (/\b(greater\s*london|greater\s*manchester|west\s*midlands|west\s*yorkshire|south\s*yorkshire|tyne\s*and\s*wear|merseyside|berkshire|buckinghamshire|cambridgeshire|cheshire|cornwall|cumbria|derbyshire|devon|dorset|durham|county\s*durham|essex|gloucestershire|hampshire|hertfordshire|kent|lancashire|leicestershire|lincolnshire|middlesex|norfolk|northamptonshire|northumberland|nottinghamshire|oxfordshire|shropshire|somerset|staffordshire|suffolk|surrey|sussex|east\s*sussex|west\s*sussex|warwickshire|wiltshire|worcestershire|yorkshire|east\s*yorkshire|north\s*yorkshire|bedfordshire|rutland|herefordshire|isle\s*of\s*wight)\b/i.test(lower)) {
    return "England";
  }

  // 3. National Capital mentioned in the physical address text
  if (isNewTaipeiCity(lower)) return "Taiwan";
  if (/\b(taipei|taipei\s*city)\b/i.test(lower)) return "Taiwan";
  if (/\b(pretoria|cape\s*town|bloemfontein)\b/i.test(lower)) return "South Africa";
  if (/\b(london)\b/i.test(lower)) return "England";
  if (/\b(edinburgh)\b/i.test(lower)) return "Scotland";
  if (/\b(cardiff)\b/i.test(lower)) return "Wales";
  if (/\b(belfast)\b/i.test(lower)) return "Northern Ireland";
  if (/\b(washington\s*d\.?c\.?)\b/i.test(lower)) return "United States Of America";
  if (/\b(ottawa)\b/i.test(lower)) return "Canada";
  if (/\b(canberra)\b/i.test(lower)) return "Australia";
  if (/\b(berlin)\b/i.test(lower)) return "Germany";
  if (/\b(paris|rixheim|mulhouse|lyon|marseille|toulouse|nice|nantes|strasbourg|bordeaux|lille)\b/i.test(lower)) return "France";
  if (/\b(madrid)\b/i.test(lower)) return "Spain";
  if (/\b(roma|rome|milan|milano|turin|torino|bologna|florence|firenze|naples|napoli)\b/i.test(lower)) return "Italy";
  if (/\b(tokyo|osaka|nagoya|yokohama|kyoto|kobe|fukuoka|sapporo)\b/i.test(lower)) return "Japan";
  if (/\b(beijing)\b/i.test(lower)) return "China";
  if (/\b(new\s*delhi)\b/i.test(lower)) return "India";
  if (/\b(seoul|busan|incheon|daegu|daejeon|suwon)\b/i.test(lower)) return "South Korea";
  if (/\b(ankara)\b/i.test(lower)) return "Türkiye";
  if (/\b(wellington)\b/i.test(lower) && !/\b(?:mount|mt\.?)\s+wellington\b/i.test(lower) && !isPlaceUsedAsStreetName(lower, "wellington")) return "New Zealand";
  if (/\b(kuala\s*lumpur|putrajaya)\b/i.test(lower)) return "Malaysia";
  if (/\b(jakarta|dki\s*jakarta|nusantara)\b/i.test(lower)) return "Indonesia";
  if (/\b(prague|praha)\b/i.test(lower)) return "Czech Republic";
  if (/\b(amsterdam|rotterdam|the\s*hague|den\s*haag|utrecht|eindhoven)\b/i.test(lower)) return "Netherlands";
  if (/\b(zurich|z[uü]rich|geneva|gen[eè]ve|basel|bern|lausanne)\b/i.test(lower)) return "Switzerland";
  if (/\b(dublin|cork|galway|limerick)\b/i.test(lower)) return "Ireland";
  if (/\b(bangkok|nonthaburi|chiang\s*mai|chonburi|rayong|samut\s*prakan)\b/i.test(lower)) return "Thailand";
  if (/\b(amman|beirut|nicosia|valletta|reykjavik|tallinn|riga|vilnius|minsk|chisinau|tirana|skopje|yerevan|baku|astana|tashkent|kathmandu|thimphu|yangon|phnom\s*penh|ulaanbaatar|baghdad|tehran|damascus|kabul|khartoum|addis\s*ababa|kampala|kigali|gaborone|windhoek|lusaka|harare|maputo|luanda|antananarivo|port\s*louis|victoria|freetown|accra|kingston|nassau|bridgetown|santo\s*domingo|belmopan|georgetown|paramaribo|panama\s*city|managua|san\s*jose|guatemala\s*city|suva|port\s*moresby|apia|port\s*vila|asuncion|la\s*paz|sucre|montevideo|lima)\b/i.test(lower)) {
    const capMap = {
      "amman": "Jordan", "beirut": "Lebanon", "nicosia": "Cyprus", "valletta": "Malta",
      "reykjavik": "Iceland", "tallinn": "Estonia", "riga": "Latvia", "vilnius": "Lithuania",
      "minsk": "Belarus", "chisinau": "Moldova", "tirana": "Albania", "skopje": "North Macedonia",
      "yerevan": "Armenia", "baku": "Azerbaijan", "astana": "Kazakhstan", "tashkent": "Uzbekistan",
      "kathmandu": "Nepal", "thimphu": "Bhutan", "yangon": "Myanmar", "phnom penh": "Cambodia",
      "ulaanbaatar": "Mongolia", "baghdad": "Iraq", "tehran": "Iran", "damascus": "Syria",
      "kabul": "Afghanistan", "khartoum": "Sudan", "addis ababa": "Ethiopia", "kampala": "Uganda",
      "kigali": "Rwanda", "gaborone": "Botswana", "windhoek": "Namibia", "lusaka": "Zambia",
      "harare": "Zimbabwe", "maputo": "Mozambique", "luanda": "Angola", "antananarivo": "Madagascar",
      "port louis": "Mauritius", "freetown": "Sierra Leone", "accra": "Ghana", "kingston": "Jamaica",
      "nassau": "Bahamas", "bridgetown": "Barbados", "santo domingo": "Dominican Republic",
      "belmopan": "Belize", "georgetown": "Guyana", "paramaribo": "Suriname", "panama city": "Panama",
      "managua": "Nicaragua", "san jose": "Costa Rica", "guatemala city": "Guatemala", "suva": "Fiji",
      "port moresby": "Papua New Guinea", "apia": "Samoa", "port vila": "Vanuatu", "asuncion": "Paraguay",
      "la paz": "Bolivia", "sucre": "Bolivia", "montevideo": "Uruguay", "lima": "Peru"
    };
    const m = lower.match(/\b(amman|beirut|nicosia|valletta|reykjavik|tallinn|riga|vilnius|minsk|chisinau|tirana|skopje|yerevan|baku|astana|tashkent|kathmandu|thimphu|yangon|phnom\s*penh|ulaanbaatar|baghdad|tehran|damascus|kabul|khartoum|addis\s*ababa|kampala|kigali|gaborone|windhoek|lusaka|harare|maputo|luanda|antananarivo|port\s*louis|freetown|accra|kingston|nassau|bridgetown|santo\s*domingo|belmopan|georgetown|paramaribo|panama\s*city|managua|san\s*jose|guatemala\s*city|suva|port\s*moresby|apia|port\s*vila|asuncion|la\s*paz|sucre|montevideo|lima)\b/i);
    if (m) {
      const k = m[1].replace(/\s+/g, " ");
      if (capMap[k]) return capMap[k];
    }
  }

  return "";
}

