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
  if (/\b(?:turkey|turkiye|turkiey|republic\s*of\s*turkiye|republic\s*of\s*turkey)\b/i.test(unaccented) || /^(?:tr|tur)$/i.test(unaccented)) {
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
  if (/\b(?:south[\s-]*africa|southafrica|republic\s*of\s*south\s*africa)\b/i.test(unaccented) || /^(?:za|rsa)$/i.test(unaccented)) {
    return "South Africa";
  }

  // 28. Germany
  if (/\b(?:germany|deutschland|german|federal\s*republic\s*of\s*germany|bundesrepublik\s*deutschland)\b/i.test(unaccented) || /^(?:de|deu)$/i.test(unaccented)) {
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
  if (/\b(?:singapore|republic\s*of\s*singapore)\b/i.test(unaccented) || /^(?:sg|sgp)$/i.test(unaccented)) {
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
  if (/\b(?:france|french|french\s*republic|republique\s*francaise)\b/i.test(unaccented) || /^(?:fr|fra)$/i.test(unaccented)) {
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

function hasIndonesiaAddressSignal(text, country = "") {
  const cLower = (country || "").toLowerCase();
  if (cLower.includes("indonesia")) return true;
  if (!text) return false;
  // If explicitly another known country or text has distinctive Turkish/European signals, do not falsely flag as Indonesia
  if (cLower && !cLower.includes("indonesia") && /\b(?:canada|united\s+states|usa|united\s+kingdom|uk|england|scotland|wales|australia|taiwan|china|india|south\s*africa|southafrica|germany|deutschland|german|italy|ireland|thailand|singapore|spain|malaysia|turkey|türkiye|turkiye|turkiey|france|french|netherlands|poland|austria|switzerland|belgium|mexico|brazil|japan|south\s+korea)\b/i.test(cLower)) {
    return false;
  }
  if (/\b(?:mah\.?|mh\.?|mahallesi|mahalle|cad\.?|cd\.?|caddesi|cadde|sok\.?|sk\.?|sokak|bulv?\.?|blv\.?|bulvari|osb|san\.?\s*sit\.?|istanbul|ankara|izmir|bursa|antalya|adana|konya|gaziantep|kocaeli|mersin|diyarbakir|kayseri|eskisehir|samsun|denizli|sakarya|mugla|trabzon|silivri|turkey|türkiye|turkiye|turkiey)\b/i.test(text)) {
    return false;
  }
  return /\b(?:jalan|jl\.?|jln\.?|gang|gg\.?|komp\.?|kompl\.?|perum\.?|perumahan|kav\.?|kavling|kel\.?|kelurahan|kec\.?|kecamatan|kab\.?|kabupaten|kodya|kotamadya|prov\.?|prop\.?|provinsi|desa|ds\.?|dusun|dsn\.?|dukuh|dk\.?|dkh\.?|lingkungan|lingk\.?|lk\.?|kp\.?|kampung|rukun\s+tetangga|rukun\s+warga|rt\.?\s*\d+(?:\s*[-/,]\s*rw\.?\s*\d+)?|rw\.?\s*\d+|kawasan|kaw\.?\s*ind|mm2100|jababeka|ejip|kiic|cibitung|jepara|pakis\s+aji|batealit|tahunan|mayong|pecangaan|welahan|bangsri|mlonggo|kalinyamatan|nalumsari|tawangmas|jakarta|surabaya|bandung|semarang|medan|tangerang|bekasi|cikarang|karawang|sidoarjo|gresik|pasuruan|malang|solo|surakarta|yogyakarta|bogor|depok|batam|makassar|palembang|denpasar|pekanbaru|balikpapan|serang|cilegon|cirebon|kudus|klaten|sukoharjo|pati|demak|pekalongan|tegal|magelang|salatiga|purwokerto|cilacap|pemalang|mojokerto|kediri|madiun|jambi|padang|banjarmasin|samarinda|pontianak|manado|jawa|central\s+java|west\s+java|east\s+java|north\s+sumatra|west\s+sumatra|south\s+sumatra|south\s+sulawesi|east\s+kalimantan|sumatra|sumatera|kalimantan|sulawesi|banten|bali|aceh|gorontalo|papua|maluku|jateng|jabar|jatim|sumut|sumbar|sumsel|sulsel|sulut|sulteng|sultra|sulbar|kaltim|kalbar|kalsel|kalteng|kalut|kaltara|kepri|malut|ntb|ntt|babel|dki|diy)\b/i.test(text) ||
    /\b(?:perumahan|kavling|komplek)\s+[A-Za-z0-9\s]+\bblok\b/i.test(text) ||
    /\bblok\s+[A-Z0-9]+\s+(?:no\.?|number)\s*\d+/i.test(text);
}

