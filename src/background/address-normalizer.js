// Address romanization, abbreviation expansion, comma/state/street restoration, and postal code removal.

function romanizeChineseAddress(addr) {
  if (!addr || typeof addr !== "string") return addr;
  if (!/[\u4e00-\u9fa5]/.test(addr)) return addr;

  let s = addr;

  // Dictionary of known Chinese administrative, zoning, and address terms to English
  const dict = [
    // Provinces / Direct Municipalities
    [/广东省/g, "Guangdong Province, "],
    [/广东/g, "Guangdong, "],
    [/江苏省/g, "Jiangsu Province, "],
    [/江苏/g, "Jiangsu, "],
    [/浙江省/g, "Zhejiang Province, "],
    [/浙江/g, "Zhejiang, "],
    [/山东省/g, "Shandong Province, "],
    [/山东/g, "Shandong, "],
    [/河南省/g, "Henan Province, "],
    [/河南/g, "Henan, "],
    [/四川省/g, "Sichuan Province, "],
    [/四川/g, "Sichuan, "],
    [/湖北省/g, "Hubei Province, "],
    [/湖北/g, "Hubei, "],
    [/湖南省/g, "Hunan Province, "],
    [/湖南/g, "Hunan, "],
    [/河北省/g, "Hebei Province, "],
    [/河北/g, "Hebei, "],
    [/福建省/g, "Fujian Province, "],
    [/福建/g, "Fujian, "],
    [/安徽省/g, "Anhui Province, "],
    [/安徽/g, "Anhui, "],
    [/辽宁省/g, "Liaoning Province, "],
    [/辽宁/g, "Liaoning, "],
    [/陕西省/g, "Shaanxi Province, "],
    [/陕西/g, "Shaanxi, "],
    [/江西省/g, "Jiangxi Province, "],
    [/江西/g, "Jiangxi, "],
    [/台湾省/g, "Taiwan Province, "],
    [/台湾/g, "Taiwan, "],
    [/台灣省/g, "Taiwan Province, "],
    [/台灣/g, "Taiwan, "],
    [/北京市/g, "Beijing, "],
    [/北京/g, "Beijing, "],
    [/上海市/g, "Shanghai, "],
    [/上海/g, "Shanghai, "],
    [/天津市/g, "Tianjin, "],
    [/天津/g, "Tianjin, "],
    [/重庆市/g, "Chongqing, "],
    [/重庆/g, "Chongqing, "],

    // Major Cities
    [/惠州市/g, "Huizhou, "],
    [/惠州/g, "Huizhou, "],
    [/深圳市/g, "Shenzhen, "],
    [/深圳/g, "Shenzhen, "],
    [/广州市/g, "Guangzhou, "],
    [/广州/g, "Guangzhou, "],
    [/东莞市/g, "Dongguan, "],
    [/东莞/g, "Dongguan, "],
    [/佛山市/g, "Foshan, "],
    [/佛山/g, "Foshan, "],
    [/苏州市/g, "Suzhou, "],
    [/苏州/g, "Suzhou, "],
    [/无锡市/g, "Wuxi, "],
    [/无锡/g, "Wuxi, "],
    [/常州市/g, "Changzhou, "],
    [/常州/g, "Changzhou, "],
    [/南京市/g, "Nanjing, "],
    [/南京/g, "Nanjing, "],
    [/杭州市/g, "Hangzhou, "],
    [/杭州/g, "Hangzhou, "],
    [/宁波市/g, "Ningbo, "],
    [/宁波/g, "Ningbo, "],
    [/温州市/g, "Wenzhou, "],
    [/温州/g, "Wenzhou, "],
    [/青岛市/g, "Qingdao, "],
    [/青岛/g, "Qingdao, "],
    [/济南市/g, "Jinan, "],
    [/济南/g, "Jinan, "],
    [/厦门市/g, "Xiamen, "],
    [/厦门/g, "Xiamen, "],
    [/福州市/g, "Fuzhou, "],
    [/福州/g, "Fuzhou, "],
    [/西安市/g, "Xi'an, "],
    [/西安/g, "Xi'an, "],
    [/成都市/g, "Chengdu, "],
    [/成都/g, "Chengdu, "],
    [/武汉市/g, "Wuhan, "],
    [/武汉/g, "Wuhan, "],
    [/长沙市/g, "Changsha, "],
    [/长沙/g, "Changsha, "],
    [/郑州市/g, "Zhengzhou, "],
    [/郑州/g, "Zhengzhou, "],
    [/桃园市/g, "Taoyuan City, "],
    [/桃園市/g, "Taoyuan City, "],
    [/台北市/g, "Taipei City, "],
    [/臺北市/g, "Taipei City, "],
    [/新北市/g, "New Taipei City, "],
    [/嘉義市/g, "Chiayi City, "],
    [/嘉义市/g, "Chiayi City, "],
    [/嘉義縣/g, "Chiayi County, "],
    [/嘉义县/g, "Chiayi County, "],
    [/嘉義/g, "Chiayi, "],
    [/嘉义/g, "Chiayi, "],
    [/新竹市/g, "Hsinchu City, "],
    [/新竹縣/g, "Hsinchu County, "],
    [/新竹县/g, "Hsinchu County, "],
    [/新竹/g, "Hsinchu, "],
    [/台中市/g, "Taichung City, "],
    [/臺中市/g, "Taichung City, "],
    [/台中/g, "Taichung, "],
    [/臺中/g, "Taichung, "],
    [/台南市/g, "Tainan City, "],
    [/臺南市/g, "Tainan City, "],
    [/台南/g, "Tainan, "],
    [/臺南/g, "Tainan, "],
    [/高雄市/g, "Kaohsiung City, "],
    [/高雄/g, "Kaohsiung, "],
    [/基隆市/g, "Keelung City, "],
    [/基隆/g, "Keelung, "],
    [/彰化縣/g, "Changhua County, "],
    [/彰化县/g, "Changhua County, "],
    [/彰化/g, "Changhua, "],
    [/苗栗縣/g, "Miaoli County, "],
    [/苗栗县/g, "Miaoli County, "],
    [/苗栗/g, "Miaoli, "],
    [/南投縣/g, "Nantou County, "],
    [/南投县/g, "Nantou County, "],
    [/南投/g, "Nantou, "],
    [/雲林縣/g, "Yunlin County, "],
    [/云林县/g, "Yunlin County, "],
    [/雲林/g, "Yunlin, "],
    [/云林/g, "Yunlin, "],
    [/屏東縣/g, "Pingtung County, "],
    [/屏东县/g, "Pingtung County, "],
    [/屏東/g, "Pingtung, "],
    [/屏东/g, "Pingtung, "],
    [/宜蘭縣/g, "Yilan County, "],
    [/宜兰县/g, "Yilan County, "],
    [/宜蘭/g, "Yilan, "],
    [/宜兰/g, "Yilan, "],
    [/花蓮縣/g, "Hualien County, "],
    [/花莲县/g, "Hualien County, "],
    [/花蓮/g, "Hualien, "],
    [/花莲/g, "Hualien, "],
    [/台東縣/g, "Taitung County, "],
    [/臺東縣/g, "Taitung County, "],
    [/台东县/g, "Taitung County, "],
    [/台東/g, "Taitung, "],
    [/臺東/g, "Taitung, "],
    [/台东/g, "Taitung, "],
    [/東區/g, "East District, "],
    [/东区/g, "East District, "],
    [/西區/g, "West District, "],
    [/西区/g, "West District, "],
    [/南區/g, "South District, "],
    [/南区/g, "South District, "],
    [/北區/g, "North District, "],
    [/北区/g, "North District, "],
    [/中區/g, "Central District, "],
    [/中区/g, "Central District, "],
    [/後湖里/g, "Houhu Village, "],
    [/后湖里/g, "Houhu Village, "],
    [/保順路/g, "Baoshun Road, "],
    [/保顺路/g, "Baoshun Road, "],
    [/里/g, " Village, "],

    // Specific zones, parks, districts, entities
    [/仲恺高新区/g, "Zhongkai High-Tech Zone, "],
    [/仲恺/g, "Zhongkai "],
    [/东江高新科技产业园/g, "Dongjiang High-Tech Industrial Park, "],
    [/东江/g, "Dongjiang "],
    [/高新科技产业园/g, "High-Tech Industrial Park, "],
    [/高新技术产业开发区/g, "High-Tech Industrial Development Zone, "],
    [/高新科技园/g, "High-Tech Park, "],
    [/高新技术园区/g, "High-Tech Industrial Zone, "],
    [/高新区/g, "High-Tech Zone, "],
    [/科技工业园/g, "Science & Technology Industrial Park, "],
    [/工业园区/g, "Industrial Park, "],
    [/工业园/g, "Industrial Park, "],
    [/经济技术开发区/g, "Economic & Technological Development Zone, "],
    [/经济开发区/g, "Economic Development Zone, "],
    [/科技园/g, "Science Park, "],
    [/产业园/g, "Industrial Park, "],
    [/现代企业中心/g, "Modern Enterprise Center, "],
    [/相城区/g, "Xiangcheng District, "],
    [/相城/g, "Xiangcheng "],
    [/澄阳路/g, "Chengyang Road, "],
    [/澄阳/g, "Chengyang "],
    [/漕湖街道/g, "Caohu Subdistrict, "],
    [/春耀路/g, "Chunyao Road, "],
    [/粤海街道/g, "Yuehai Subdistrict, "],
    [/麻岭社区/g, "Maling Community, "],
    [/科技中三路/g, "Keji Middle 3rd Road, "],
    [/国人大厦/g, "Guoren Building, "],
    [/锦业路/g, "Jinye Road, "],
    [/唯新路/g, "Weixin Road, "],
    [/中科智能/g, "Zhongke Intelligent, "],
    [/漕宝路/g, "Caobao Road, "],
    [/宜山路/g, "Yishan Road, "],
    [/新埔六街/g, "Xinpu 6th Street, "],
    [/草堤路/g, "Caoti Road, "],
    [/大里區/g, "Dali District, "],
    [/大里区/g, "Dali District, "],
    [/惠泽大道/g, "Huize Avenue, "],
    [/惠泽路/g, "Huize Road, "],
    [/惠泽/g, "Huize "],

    // General terms
    [/([一二三四五六七八九1-9])\s*段/g, (m, d) => {
      const numMap = { "一": "1", "二": "2", "三": "3", "四": "4", "五": "5", "六": "6", "七": "7", "八": "8", "九": "9" };
      return `Section ${numMap[d] || d}, `;
    }],
    [/([A-Za-z\u4e00-\u9fa5]+)\s*東路/g, "$1 East Road, "],
    [/([A-Za-z\u4e00-\u9fa5]+)\s*东路/g, "$1 East Road, "],
    [/([A-Za-z\u4e00-\u9fa5]+)\s*西路/g, "$1 West Road, "],
    [/([A-Za-z\u4e00-\u9fa5]+)\s*南路/g, "$1 South Road, "],
    [/([A-Za-z\u4e00-\u9fa5]+)\s*北路/g, "$1 North Road, "],
    [/([A-Za-z\u4e00-\u9fa5]+)\s*中路/g, "$1 Middle Road, "],
    [/大道/g, " Avenue, "],
    [/路/g, " Road, "],
    [/街/g, " Street, "],
    [/巷/g, " Lane, "],
    [/弄/g, " Alley, "],
    [/(\d+)\s*[号號]/g, "Number $1, "],
    [/([A-Za-z0-9]+)\s*[幢栋棟]/g, "Building $1, "],
    [/([A-Za-z0-9]+)\s*[层樓楼]/g, "Floor $1, "],
    [/([A-Za-z0-9]+)\s*[室房]/g, "Room $1, "],
    [/([A-Za-z0-9]+)\s*[座]/g, "Block $1, "],
    [/([A-Za-z0-9]+)\s*[期]/g, "Phase $1, "],
    [/([A-Za-z0-9]+)\s*[区區]/g, "Area $1, "],
    [/区/g, " District, "],
    [/區/g, " District, "],
    [/县/g, " County, "],
    [/縣/g, " County, "],
    [/镇/g, " Town, "],
    [/鎮/g, " Town, "]
  ];

  for (const [re, rep] of dict) {
    s = s.replace(re, rep);
  }

  // If there are still Chinese characters left, strip or replace with space
  s = s.replace(/[\u4e00-\u9fa5]+/g, " ");

  // Order reversal: Chinese is largest-to-smallest ([City], [District], [Park], [Road], [Number]).
  // Western address is smallest-to-largest ([Number] [Road], [Park], [District], [City]).
  const parts = s.split(/[,，\n]+/).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    if (/\b(?:Number|No\.?|Floor|Room|Building)\b/i.test(lastPart) || /\b(?:Road|Street|Avenue|Lane)\b/i.test(lastPart) || /^\d+[A-Za-z]?$/.test(lastPart)) {
      parts.reverse();
    }
  }

  return parts.join(", ");
}

/**
 * Ensures "Number" is ONLY present if "No.", "No", "NO.", "Nos.", "Nº", "#", or "號" was in the original raw address evidence.
 * Rule: "if No come only expand and do with out coming dont put blankly number"
 */
function stripBlindlyAddedNumber(addr, rawEvidence = "", rawSource = "") {
  if (!addr || !/\bNumber\s+\d+/i.test(addr)) return addr;
  return addr.replace(/\bNumber\s+(\d+(?:[-/]\d+)?)\b/gi, (match, digits) => {
    const rawHasNoRegex = new RegExp('(?:(?:\\b(?:no|nos|n|nu|nr|nº|n°|numero|num|number|lot\\s*no|plot\\s*no)[.:]?|#)\\s*' + digits.replace('-', '[-/]') + '\\b|' + digits.replace('-', '[-/]') + '\\s*[号號])', 'i');
    // If rawSource explicitly had No./Number/#/號, preserve it
    if (rawSource && typeof rawSource === "string" && rawHasNoRegex.test(rawSource)) {
      return match;
    }
    // If rawEvidence explicitly had No./Number/#/號, preserve it
    if (rawEvidence && typeof rawEvidence === "string" && rawHasNoRegex.test(rawEvidence)) {
      return match;
    }
    // Neither rawSource nor rawEvidence had explicit No./Number/#/號 -> STRIP "Number "
    return digits;
  });
}

/**
 * CRITICAL QC RULE: "the items what available that only should come no extra word"
 * Strips words (like "Number", "City", "District", "Township", "County") that were NOT
 * in the source address candidate, and aligns spelling back to the source candidate.
 */
function stripExtraWordsFromAddress(addr, rawSource = "") {
  if (!addr || typeof addr !== "string") return addr;
  if (!rawSource || typeof rawSource !== "string") return addr;

  let a = addr;

  // 1. "Number": If addr has "Number <digits>" but rawSource does NOT have "no", "number", "#", "號"
  a = a.replace(/\bNumber\s+(\d+(?:[-/]\d+)?)\b/gi, (match, digits) => {
    const rawHasNo = new RegExp('(?:(?:\\b(?:no|nos|n|nu|nr|nº|n°|numero|num|number|lot\\s*no|plot\\s*no)[.:]?|#)\\s*' + digits.replace('-', '[-/]') + '\\b|' + digits.replace('-', '[-/]') + '\\s*[号號])', 'i');
    if (rawHasNo.test(rawSource)) {
      return match;
    }
    return digits; // strip "Number "
  });

  // 2. "City": If addr has "<CityName> City" but rawSource has "<CityName>" without "City"
  a = a.replace(/\b((?:(?:New|North|South|East|West|Old|San|Santa|Los|Las|Fort|Port|Saint|St\.)\s+)?[A-Z][a-z0-9\u00C0-\u024F\-]+)\s+City\b/g, (match, cityName) => {
    // Never strip City from cities where "City" is an integral part of the official city name
    if (/^(?:Kansas|Salt\s*Lake|Jersey|Carson|Oklahoma|Panama|Ho\s*Chi\s*Minh|Quezon|Cebu|Davao|Angeles|New\s*York|Mexico)$/i.test(cityName)) {
      return match;
    }
    const escapedName = cityName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const rawHasCity = new RegExp('\\b' + escapedName + '\\s+(?:city|cty\\.?)\\b', 'i');
    if (rawHasCity.test(rawSource)) {
      return match;
    }
    const rawHasNameOnly = new RegExp('\\b' + escapedName + '\\b', 'i');
    if (rawHasNameOnly.test(rawSource)) {
      return cityName; // strip " City"
    }
    return match;
  });

  // 3. "District", "Township", "County":
  const divPatterns = {
    District: '(?:district|dist\\.?)',
    Township: '(?:township|twp\\.?)',
    County: '(?:county|co\\.?|hsien)',
    Hsien: '(?:hsien|county|co\\.?)'
  };
  a = a.replace(/\b([A-Z][a-z0-9\u00C0-\u024F\-]+)\s+(District|Township|County|Hsien)\b/g, (match, name, div) => {
    const pat = divPatterns[div] || div;
    const rawHasDiv = new RegExp('\\b' + name + '\\s+' + pat + '\\b', 'i');
    if (rawHasDiv.test(rawSource)) {
      return match;
    }
    const rawHasNameOnly = new RegExp('\\b' + name + '\\b', 'i');
    if (rawHasNameOnly.test(rawSource)) {
      return name;
    }
    return match;
  });

  // 4. Locality spelling alignment:
  // e.g. rawSource has "Keishan" and does NOT have "Guishan", but addr has "Guishan"
  if (/\bKeishan\b/i.test(rawSource) && !/\bGuishan\b/i.test(rawSource)) {
    a = a.replace(/\bGuishan\s*(?:District|Township)?\b/gi, "Keishan");
  }

  return a;
}

/**
 * Normalizes Taiwanese cities, counties, and districts and repairs accidental commas
 * splitting two-syllable city names (e.g. "Chia, Yi City" -> "Chiayi City", "Hsin, Chu City" -> "Hsinchu City").
 */
function normalizeTaiwanDivisions(addr) {
  if (!addr || typeof addr !== "string") return addr;
  let a = addr;

  const twCities = [
    { regex: /\b(?:New\s*)?Tai[-\s,]*[Pp]ei\s*City\b/gi, rep: (m) => /^new/i.test(m) ? "New Taipei City" : "Taipei City" },
    { regex: /\bChia[-\s,]*[Yy]i\s*City\b/gi, rep: "Chiayi City" },
    { regex: /\bHsin[-\s,]*[Cc]hu\s*City\b/gi, rep: "Hsinchu City" },
    { regex: /\bTai[-\s,]*[Cc]hung\s*City\b/gi, rep: "Taichung City" },
    { regex: /\bTai[-\s,]*[Nn]an\s*City\b/gi, rep: "Tainan City" },
    { regex: /\bKao[-\s,]*[Hh]siung\s*City\b/gi, rep: "Kaohsiung City" },
    { regex: /\bTao[-\s,]*[Yy]uan\s*City\b/gi, rep: "Taoyuan City" },
    { regex: /\bKee[-\s,]*[Ll]ung\s*City\b/gi, rep: "Keelung City" },

    // Counties
    { regex: /\bChang[-\s,]*[Hh]ua\s*(?:County|Hsien)\b/gi, rep: "Changhua County" },
    { regex: /\bYun[-\s,]*[Ll]in\s*(?:County|Hsien)\b/gi, rep: "Yunlin County" },
    { regex: /\bMiao[-\s,]*[Ll]i\s*(?:County|Hsien)\b/gi, rep: "Miaoli County" },
    { regex: /\bNan[-\s,]*[Tt]ou\s*(?:County|Hsien)\b/gi, rep: "Nantou County" },
    { regex: /\bPing[-\s,]*[Tt]ung\s*(?:County|Hsien)\b/gi, rep: "Pingtung County" },
    { regex: /\bYi[-\s,]*[Ll]an\s*(?:County|Hsien)\b/gi, rep: "Yilan County" },
    { regex: /\bHua[-\s,]*[Ll]ien\s*(?:County|Hsien)\b/gi, rep: "Hualien County" },
    { regex: /\bTai[-\s,]*[Tt]ung\s*(?:County|Hsien)\b/gi, rep: "Taitung County" },
    { regex: /\bPen[-\s,]*[Gg]hu\s*(?:County|Hsien)\b/gi, rep: "Penghu County" },
    { regex: /\bKin[-\s,]*[Mm]en\s*(?:County|Hsien)\b/gi, rep: "Kinmen County" },
    { regex: /\bChia[-\s,]*[Yy]i\s*(?:County|Hsien)\b/gi, rep: "Chiayi County" },
    { regex: /\bHsin[-\s,]*[Cc]hu\s*(?:County|Hsien)\b/gi, rep: "Hsinchu County" }
  ];

  for (const item of twCities) {
    a = a.replace(item.regex, item.rep);
  }

  const twStandaloneCities = [
    { regex: /\bChia[-\s,]+[Yy]i\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Chiayi" },
    { regex: /\bHsin[-\s,]+[Cc]hu\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Hsinchu" },
    { regex: /\bTai[-\s,]+[Cc]hung\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Taichung" },
    { regex: /\bTai[-\s,]+[Nn]an\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Tainan" },
    { regex: /\bKao[-\s,]+[Hh]siung\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Kaohsiung" },
    { regex: /\bTao[-\s,]+[Yy]uan\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Taoyuan" },
    { regex: /\bKee[-\s,]+[Ll]ung\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Keelung" },
    { regex: /(?<!\bNew\s+)\bTai[-\s,]+[Pp]ei\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Taipei" },
    { regex: /\bNew\s+Tai[-\s,]+[Pp]ei\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "New Taipei" },
    { regex: /\bChang(?:\s*,\s*|\s*-\s*)[Hh]ua\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Changhua" },
    { regex: /\bYun[-\s,]+[Ll]in\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Yunlin" },
    { regex: /\bMiao[-\s,]+[Ll]i\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Miaoli" },
    { regex: /\bNan[-\s,]+[Tt]ou\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Nantou" },
    { regex: /\bPing[-\s,]+[Tt]ung\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Pingtung" },
    { regex: /\bYi[-\s,]+[Ll]an\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Yilan" },
    { regex: /\bHua[-\s,]+[Ll]ien\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Hualien" },
    { regex: /\bTai[-\s,]+[Tt]ung\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))\b/gi, rep: "Taitung" }
  ];

  for (const item of twStandaloneCities) {
    a = a.replace(item.regex, item.rep);
  }

  // Wade-Giles / Tongyong pinyin to modern standard English romanization
  a = a.replace(/\bHoo[-\s]*Hu\s*(?:Li|Village)\b/gi, 'Houhu Village');
  a = a.replace(/\bPao[-\s]*Shun\s*Road\b/gi, 'Baoshun Road');
  a = a.replace(/\b([A-Z][a-z0-9\-]+)\s+Li\b(?!\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Drive|Way|Place|Court|Highway|Close|Terrace))/g, '$1 Village');

  return a;
}

function expandAddressAndStateAbbreviations(addr, country = "") {
  if (!addr) return "";
  const cLower = (country || "").toLowerCase();
  const hasIndoHint = hasIndonesiaAddressSignal(addr, country);
  let a = addr;
  a = normalizeTaiwanDivisions(a);

  // Deduplicate repeated premise numbers early (e.g. "No. 1013 Number 1013" -> "Number 1013")
  a = a.replace(/(^|[,\s])(?:no\.?|number)\s*(\d+[A-Za-z]?(?:[-/]\d+)?)(?:,\s*|\s+)(?:no\.?|number)\s*\2\b/gi, '$1Number $2');
  a = a.replace(/(^|[,\s])(?:no\.?\s*)?(\d+[A-Za-z]?(?:[-/]\d+)?)(?:,\s*|\s+)Number\s+\2\b/gi, '$1Number $2');
  a = a.replace(/(^|[,\s])Number\s+(\d+[A-Za-z]?(?:[-/]\d+)?)(?:,\s*|\s+)(?:no\.?\s*)?\2\b/gi, '$1Number $2');
  a = a.replace(/(^|[,\s])(?:no\.?\s*)?(\d+)\s+\2\b/gi, '$1$2');

  // Repair accidental commas splitting two-syllable East Asian cities/districts/townships
  const eaFirstSyllables = "Yung|San|Chung|Hsin|Xin|Da|Ta|Nan|Xi|Hsi|Bei|Pei|An|Ren|Jen|Gui|Kuei|Lu|Loo|Ping|Ba|Pa|Yang|Long|Lung|Shan|Guan|Kuan|Ma|Jia|Chia|Qi|Chi|Jiang|Chiang|Zhong|Qian|Chien|Feng|Fong|Ling|Gu|Ku|Zuo|Tso|Hou|Dong|Tung|Xia|Hsia|Liu|Yu|Kao|Gao|Tao|Kee|Miao|Yun|Chang|Hua|Peng|Kin|Lien";
  a = a.replace(new RegExp(`\\b(${eaFirstSyllables})[-\\s]*,[\\s\\-]*([A-Z][a-z]+\\s+(?:District|Township|County|Hsien|City))\\b`, "g"), '$1-$2');
  a = a.replace(new RegExp(`\\b(${eaFirstSyllables})-[\\s,]+([A-Z][a-z]+\\s+(?:District|Township|County|Hsien|City))\\b`, "g"), '$1-$2');
  a = normalizeTaiwanDivisions(a);

  const eaRoadSyllables = "Chung|Zhong|Hsin|Xin|Kuang|Guang|Min|San|Da|Ta|Ren|Jen|Nan|Bei|Pei|Xi|Hsi|Dong|Tung";
  a = a.replace(new RegExp(`\\b(${eaRoadSyllables})[-\\s]*,[\\s\\-]*([A-Z][a-z]+\\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Highway))\\b`, "g"), '$1 $2');

  // Remove unwanted comma between bare street number and street name (e.g. "604, Progress Drive" -> "604 Progress Drive")
  // Must NOT strip commas after premise indicators like "Number 53-5, Pocheng Road" or "Lot 12, Main Street"
  a = a.replace(/(^|[,\s])(?<!\b(?:number|no\.?|#|section|sec\.?|lane|ln\.?|alley|aly\.?|unit|suite|ste\.?|floor|fl\.?|flr\.?|level|lot|plot|block|blk\.?)\s+)\b(\d{1,5}),\s+([A-Z][a-z0-9\u00C0-\u024F]+(?:\s+[A-Z][a-z0-9\u00C0-\u024F]+)*\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Caddesi|Bulvari|Sokak|Strasse|Calle|Avenida|Viale|Corso|Rd|St|Ave|Ln|Dr|Blvd|Hwy|Ct|Pl)\b)/gi, "$1$2 $3");

  // Preserve ampersand inside address (normalize spacing, do not replace with 'and')
  a = a.replace(/\s*&\s*/g, " & ");

  // 1. "St" as "Saint" in city, place, or street names (e.g. St Louis, Port St Lucie, St. James Road, St. Patrick Street)
  a = a.replace(/\b(?:port\s+|mount\s+)?st\.?\s+(lucie|louis|paul|petersburg|cloud|albans|kilda|george|john|johns|john's|andrews|charles|joseph|moritz|leonards|marys|mary's|peters|helens|ives|clair|james|patrick|thomas|martin|francis|anne|anne's|catherine|michael|jude|stephen|christopher|anthony|lawrence|luke|mark|matthew|david|nicholas|polten|pölten|gallen|johann|veit|anton)\b/gi, function (m, p) {
    if (/^port/i.test(m)) return "Port Saint " + p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    if (/^mount/i.test(m)) return "Mount Saint " + p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    return "Saint " + p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  });
  // Context-aware St. before any capitalized street word followed by another street suffix
  a = a.replace(/(^|[,\s]|\d+\s+)\bSt\.?\s+([A-Z][a-z']+(?:\s+[A-Z][a-z']+)?\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Rd|St|Ave|Ln|Dr|Blvd|Hwy|Pl)\b)/g, "$1Saint $2");
  // Context-aware Dr. before a person's name (e.g. "Dr. Martin Luther King Boulevard", "Jl. Dr. Sutomo") -> Doctor / Doktor, NOT Drive!
  a = a.replace(/(^|[,\s]|\b(?:jl|jln|jalan)\.?\s+)\bDr\.?\s+(?=[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Rd|St|Ave|Dr|Ln|Blvd)\b|[,\s]|$))/g, (m, p1) => {
    const isIndo = /\b(?:jl|jln|jalan)\b/i.test(p1) || /\b(?:indonesia|jepara|jakarta|surabaya|bandung|semarang|medan|tangerang|bekasi|cikarang|karawang|sidoarjo|gresik|pasuruan|malang|solo|surakarta|yogyakarta|bogor|depok|batam|makassar|palembang|denpasar|pekanbaru|balikpapan|jawa|java|jateng|jabar|jatim)\b/i.test(a) || (country || "").toLowerCase().includes("indonesia");
    return `${p1}${isIndo ? "Doktor" : "Doctor"} `;
  });

  // 2. Compass directions prefixes
  // (a) Single letter with dot: E., W., N., S. followed by word (e.g. "301 E. Marquardt Drive" -> "301 East Marquardt Drive")
  a = a.replace(/(^|[\s,])E\.\s+(?=[A-Za-z]|\d+(?:st|nd|rd|th)\b)/gi, '$1East ');
  a = a.replace(/(^|[\s,])W\.\s+(?=[A-Za-z]|\d+(?:st|nd|rd|th)\b)/gi, '$1West ');
  a = a.replace(/(^|[\s,])N\.\s+(?=[A-Za-z]|\d+(?:st|nd|rd|th)\b)/gi, '$1North ');
  a = a.replace(/(^|[\s,])S\.\s+(?=[A-Za-z]|\d+(?:st|nd|rd|th)\b)/gi, '$1South ');

  // (b) Single letter after street number or comma: 301 E Marquardt, 100 N Main, 50 W 44th
  a = a.replace(/(\b\d+[A-Za-z]?[\s,\-]+)E\b\s+(?=[A-Za-z]|\d+(?:st|nd|rd|th)\b)/gi, '$1East ');
  a = a.replace(/(\b\d+[A-Za-z]?[\s,\-]+)W\b\s+(?=[A-Za-z]|\d+(?:st|nd|rd|th)\b)/gi, '$1West ');
  a = a.replace(/(\b\d+[A-Za-z]?[\s,\-]+)N\b\s+(?=[A-Za-z]|\d+(?:st|nd|rd|th)\b)/gi, '$1North ');
  a = a.replace(/(\b\d+[A-Za-z]?[\s,\-]+)S\b\s+(?=[A-Za-z]|\d+(?:st|nd|rd|th)\b)/gi, '$1South ');
  a = a.replace(/(^|,\s*)E\b\s+(?=[A-Z][a-z])/g, '$1East ');
  a = a.replace(/(^|,\s*)W\b\s+(?=[A-Z][a-z])/g, '$1West ');
  a = a.replace(/(^|,\s*)N\b\s+(?=[A-Z][a-z])/g, '$1North ');
  a = a.replace(/(^|,\s*)S\b\s+(?=[A-Z][a-z])/g, '$1South ');

  // (b-2) Directional following street name: e.g. "Yongke E. Rd.", "Yongke E Rd", "Zhongshan N. Road", "Bade E. Road"
  a = a.replace(/\b([A-Za-z\u00C0-\u024F]+)\s+E\b\.?\s+(?=(?:Rd|Road|St|Street|Ave|Avenue|Blvd|Boulevard|Ln|Lane|Dr|Drive|Way|Ct|Court|Pl|Place|Hwy|Highway|Sec|Section)\b)/gi, '$1 East ');
  a = a.replace(/\b([A-Za-z\u00C0-\u024F]+)\s+W\b\.?\s+(?=(?:Rd|Road|St|Street|Ave|Avenue|Blvd|Boulevard|Ln|Lane|Dr|Drive|Way|Ct|Court|Pl|Place|Hwy|Highway|Sec|Section)\b)/gi, '$1 West ');
  a = a.replace(/\b([A-Za-z\u00C0-\u024F]+)\s+N\b\.?\s+(?=(?:Rd|Road|St|Street|Ave|Avenue|Blvd|Boulevard|Ln|Lane|Dr|Drive|Way|Ct|Court|Pl|Place|Hwy|Highway|Sec|Section)\b)/gi, '$1 North ');
  a = a.replace(/\b([A-Za-z\u00C0-\u024F]+)\s+S\b\.?\s+(?=(?:Rd|Road|St|Street|Ave|Avenue|Blvd|Boulevard|Ln|Lane|Dr|Drive|Way|Ct|Court|Pl|Place|Hwy|Highway|Sec|Section)\b)/gi, '$1 South ');

  // (c) Multi-letter directional prefixes: NE, NW, SE, SW
  a = a.replace(/(^|[\s,])N\.?E\.?\s+(?=[A-Za-z0-9])/gi, '$1Northeast ');
  a = a.replace(/(^|[\s,])N\.?W\.?\s+(?=[A-Za-z0-9])/gi, '$1Northwest ');
  a = a.replace(/(^|[\s,])S\.?E\.?\s+(?=[A-Za-z0-9])/gi, '$1Southeast ');
  a = a.replace(/(^|[\s,])S\.?W\.?\s+(?=[A-Za-z0-9])/gi, '$1Southwest ');

  // (c-2) Street directional suffix: e.g. "Main St. E.", "Main Street E", "Washington Ave. S.", "17th Street NW"
  a = a.replace(/\b(Street|Road|Avenue|Boulevard|Drive|Way|Lane|Court|Place|Close|Crescent|Terrace|Square|Highway|St|Rd|Ave|Blvd|Dr|Ln|Ct|Pl)\s+E\b\.?(?=[,\s]|$)/gi, '$1 East');
  a = a.replace(/\b(Street|Road|Avenue|Boulevard|Drive|Way|Lane|Court|Place|Close|Crescent|Terrace|Square|Highway|St|Rd|Ave|Blvd|Dr|Ln|Ct|Pl)\s+W\b\.?(?=[,\s]|$)/gi, '$1 West');
  a = a.replace(/\b(Street|Road|Avenue|Boulevard|Drive|Way|Lane|Court|Place|Close|Crescent|Terrace|Square|Highway|St|Rd|Ave|Blvd|Dr|Ln|Ct|Pl)\s+N\b\.?(?=[,\s]|$)/gi, '$1 North');
  a = a.replace(/\b(Street|Road|Avenue|Boulevard|Drive|Way|Lane|Court|Place|Close|Crescent|Terrace|Square|Highway|St|Rd|Ave|Blvd|Dr|Ln|Ct|Pl)\s+S\b\.?(?=[,\s]|$)/gi, '$1 South');
  a = a.replace(/\b(Street|Road|Avenue|Boulevard|Drive|Way|Lane|Court|Place|Close|Crescent|Terrace|Square|Highway|St|Rd|Ave|Blvd|Dr|Ln|Ct|Pl)\s+(?:NE|N\.E\.)(?=[,\s]|$)/gi, '$1 Northeast');
  a = a.replace(/\b(Street|Road|Avenue|Boulevard|Drive|Way|Lane|Court|Place|Close|Crescent|Terrace|Square|Highway|St|Rd|Ave|Blvd|Dr|Ln|Ct|Pl)\s+(?:NW|N\.W\.)(?=[,\s]|$)/gi, '$1 Northwest');
  a = a.replace(/\b(Street|Road|Avenue|Boulevard|Drive|Way|Lane|Court|Place|Close|Crescent|Terrace|Square|Highway|St|Rd|Ave|Blvd|Dr|Ln|Ct|Pl)\s+(?:SE|S\.E\.)(?=[,\s]|$)/gi, '$1 Southeast');
  a = a.replace(/\b(Street|Road|Avenue|Boulevard|Drive|Way|Lane|Court|Place|Close|Crescent|Terrace|Square|Highway|St|Rd|Ave|Blvd|Dr|Ln|Ct|Pl)\s+(?:SW|S\.W\.)(?=[,\s]|$)/gi, '$1 Southwest');

  // 3. Number, Section, Lane & Alley prefixes (Global full form expansion)
  // Note: Special characters like # and & must be preserved inside address (e.g. Suite #4, Unit #12)
  a = a.replace(/(^|[,\s])(?:No|Nu|Nr)[.:]\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])N[:]\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])(?:Nº|N°)[.:]?\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])(?:No|Nu)\b\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])Nos[.:]?\s*(?=\d)/gi, '$1Number ');
  a = a.replace(/(^|[,\s])N\.\s*(?=\d+(?:[-\/]\d+)?\b(?!\s*(?:st|nd|rd|th)\b))/gi, '$1Number ');
  a = a.replace(/\blot\s+(?:no|nos)[.:]?\s*(?=\d)/gi, 'Lot Number ');
  a = a.replace(/\bplot\s+(?:no|nos)[.:]?\s*(?=\d)/gi, 'Plot Number ');
  a = a.replace(/(^|[,\s])Sec\.\s*(?=[A-Za-z0-9])/gi, '$1Section ');
  a = a.replace(/(^|[,\s])Sec\b\s*(?=[A-Za-z0-9])/gi, '$1Section ');
  a = a.replace(/\b(Hsinchu|Changhua|Miaoli|Yunlin|Chiayi|Pingtung|Taitung|Hualien|Yilan|Nantou|Kinmen|Penghu|Lienchiang|Matsu)\s+Country\b/gi, "$1 County");
  a = a.replace(/(^|[,\s])Ln\.\s*(?=\d)/gi, '$1Lane ');
  a = a.replace(/(^|[,\s])Ln\b\s*(?=\d)/gi, '$1Lane ');
  a = a.replace(/(^|[,\s])Aly\.\s*(?=\d)/gi, '$1Alley ');
  a = a.replace(/(^|[,\s])Aly\b\s*(?=\d)/gi, '$1Alley ');

  const toOrdinalFloor = (num) => {
    const n = parseInt(num, 10);
    if (isNaN(n)) return `${num} Floor`;
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    const ord = s[(v - 20) % 10] || s[v] || s[0];
    return `${n}${ord} Floor`;
  };

  // Floor & Level abbreviations (e.g. "5/F.", "5/F", "5F.", "5F", "Fl. 5", "Flr 5", "Floor 5", "5th Fl" -> "5th Floor")
  a = a.replace(/(^|[,\s])(\d{1,3})\s*(?:\/|\s*)?F\.?(?=[,\s\.\/]|$)/gi, (m, p1, num) => `${p1}${toOrdinalFloor(num)}`);
  a = a.replace(/(^|[,\s])(?:Flr?|Floor)\.?\s*(\d{1,3})\b/gi, (m, p1, num) => `${p1}${toOrdinalFloor(num)}`);
  a = a.replace(/(^|[,\s])(\d{1,3})(?:st|nd|rd|th)?\s*(?:Flr?|Floor)\.?\b/gi, (m, p1, num) => `${p1}${toOrdinalFloor(num)}`);
  a = a.replace(/(^|[,\s])(?:G\s*\/\s*F\.?|GF\b|Gnd\s*Flr?\.?)/gi, "$1Ground Floor");
  a = a.replace(/(^|[,\s])(?:B\s*\/\s*F\.?|BF\b|Bsmt\b\.?)/gi, "$1Basement Floor");
  a = a.replace(/(^|[,\s])(?<!\b(?:Blok|Block|Kavling|Kav\.?|Lot|Plot|Unit|Suite|Ste\.?|Apartment|Apt\.?|Tower|Wing|Bay|Dock|Zone|Gate|Section|Sec\.?)\s+)B(\d{1,2})\b/gi, "$1Basement $2");
  a = a.replace(/(^|[,\s])Lvl\.?\s*(\d{1,3}|[A-Za-z])/gi, "$1Level $2");

  // 4. Administrative abbreviations
  a = a.replace(/\bTwp\b\.?/gi, "Township");
  a = a.replace(/\bDist\b\.?/gi, "District");
  a = a.replace(/\bCty\b\.?/gi, "County");
  if (!hasIndoHint) {
    a = a.replace(/\bProv\b\.?/gi, "Province");
  }
  a = a.replace(/\bMun\b\.?/gi, "Municipality");
  a = a.replace(/(^|[,\s])nr\b\.?\s*(?=\d)/gi, "$1Nummer ");
  a = a.replace(/\bNr\b\.?/gi, "Near");
  a = a.replace(/\bhsien\b/gi, "County");

  const isSpanishOrLatam = /\b(?:spain|espana|españa|mexico|méxico|argentina|colombia|peru|perú|costa\s*rica|panama|panamá|guatemala|nicaragua|uruguay|paraguay|bolivia|dominican\s*republic)\b/i.test(cLower) || /\b(?:col\.?|fracc\.?|calz\.?|prol\.?|mza\.?|cte\.?|avda\.?|pol\.?\s*ind\.?)\b/i.test(a) || (typeof isSpanishLocation === "function" && isSpanishLocation(a, country));
  const isPortugueseOrBrazil = /\b(?:brazil|brasil|portugal)\b/i.test(cLower) || /\b(?:rodovia|estr\.?|pça?\.?|rua|sao\s*paulo|são\s*paulo|rio\s*de\s*janeiro|belo\s*horizonte|curitiba|lisboa|porto)\b/i.test(a);
  const isPolishAddr = /\b(?:poland|polska)\b/i.test(cLower) || /\b(?:ul\.|al\.|os\.|woj\.|pow\.|warsaw|warszawa|krak[oó]w|wroc[lł]aw|pozna[nń]|gda[nń]sk|katowice|gryfino|szczecin)\b/i.test(a);
  const isDutchOrBelgianAddr = /\b(?:netherlands|nederland|holland|belgium|belgi[eë]|belgique)\b/i.test(cLower) || /\b(?:amsterdam|rotterdam|utrecht|eindhoven|den\s*haag|antwerp|antwerpen|brussels|bruxelles|ghent|gent|industrieterrein|postbus)\b/i.test(a);
  const isDachAddr = /\b(?:germany|deutschland|austria|[oö]sterreich|oesterreich|switzerland|schweiz|suisse|svizzera)\b/i.test(cLower) || /\b(?:strasse|straße|platz|gewerbegebiet|industriegebiet|berlin|munich|m[uü]nchen|hamburg|frankfurt|stuttgart|vienna|wien|graz|linz|zurich|z[uü]rich|basel|bern)\b/i.test(a);
  const isFrenchAddr = /\b(?:france|belgique)\b/i.test(cLower) || /\b(?:rue|cedex|z\.?i\.?|z\.?a\.?c?\.?|impasse|all[eé]e|chemin|boite\s*postale|paris|lyon|marseille|toulouse|nice|nantes|strasbourg|bordeaux|lille)\b/i.test(a);

  // 5a. Global Named Highway / Memorial Boulevard / Route Acronyms & Suffixes
  a = a.replace(/\bg\.?\s*a\.?\s*r\.?\s+(?=(?:highway|hwy\.?|road|rd\.?)\b)/gi, "Grand Army Of The Republic ");
  a = a.replace(/\bm\.?\s*l\.?\s*k\.?(?:\s+jr\.?)?\s+(?=(?:boulevard|blvd\.?|street|st\.?|avenue|ave\.?|drive|dr\.?|parkway|pkwy\.?|way|highway|hwy\.?)\b)/gi, (m) => {
    return /jr/i.test(m) ? "Martin Luther King Junior " : "Martin Luther King ";
  });
  a = a.replace(/\bj\.?\s*f\.?\s*k\.?\s+(?=(?:boulevard|blvd\.?|expressway|exp(?:ress)?wy\.?|expy\.?|highway|hwy\.?|parkway|pkwy\.?|drive|dr\.?|way)\b)/gi, "John F Kennedy ");
  a = a.replace(/\bf\.?\s*d\.?\s*r\.?\s+(?=(?:drive|dr\.?|expressway|exp(?:ress)?wy\.?|expy\.?)\b)/gi, "Franklin D Roosevelt ");
  a = a.replace(/\bp\.?\s*c\.?\s*h\.?\b(?=[,\s]|$)/gi, "Pacific Coast Highway");
  a = a.replace(/(^|[,\s])(?:co\.?|cty\.?)\s*rd\.?\s*(?=\d|[A-Za-z])/gi, "$1County Road ");
  a = a.replace(/(^|[,\s])(?:st\.?|state)\s*rte\.?\s*(?=\d|[A-Za-z])/gi, "$1State Route ");
  a = a.replace(/(^|[,\s])(?:u\.?\s*s\.?|us)\s*rte\.?\s*(?=\d)/gi, "$1US Route ");
  a = a.replace(/(^|[,\s])(?:u\.?\s*s\.?|us)\s*(?:hwy|hgwy)\.?\s*(?=\d)/gi, "$1US Highway ");
  a = a.replace(/(^|[,\s])state\s*(?:hwy|hgwy)\.?\s*(?=\d)/gi, "$1State Highway ");
  a = a.replace(/(^|[,\s])f\.?\s*m\.?\s*(\d{1,5})(?:\s+(?:rd|road))?\b/gi, "$1Farm To Market Road $2");
  a = a.replace(/(^|[,\s])r\.?\s*m\.?\s*(\d{1,5})(?:\s+(?:rd|road))?\b/gi, (m, p1, num, offset, str) => {
    // Only expand RM -> Ranch To Market Road when not clearly Room (avoid "Suite 4, Rm 201")
    return /\b(?:texas|tx|austin|san\s*antonio|round\s*rock|dripping\s*springs)\b/i.test(a) ? `${p1}Ranch To Market Road ${num}` : m;
  });
  a = a.replace(/(^|[,\s])r\.?\s*r\.?\s*(?=\d+\s*(?:,|box\b|$))/gi, "$1Rural Route ");

  // 5. Street types expansion (Global) - language-aware before generic English fallbacks
  a = a.replace(/\b(?:pkwy|pky|pwy)\b\.?/gi, "Parkway");
  a = a.replace(/\bmwy\b\.?/gi, "Motorway");
  a = a.replace(/\bblvd\b\.?/gi, "Boulevard");
  a = a.replace(/\bbvd\b\.?/gi, "Boulevard");
  a = a.replace(/\bboul\b\.?/gi, "Boulevard");
  a = a.replace(/\b(?:cresc|cres)\b\.?/gi, "Crescent");
  a = a.replace(/\b(?:tpke|trnpk)\b\.?/gi, "Turnpike");
  a = a.replace(/\bpke\b\.?/gi, "Pike");
  a = a.replace(/\bcswy\b\.?/gi, "Causeway");
  a = a.replace(/\bgdns\b\.?/gi, "Gardens");
  a = a.replace(/\bgdn\b\.?/gi, "Garden");
  a = a.replace(/\bfwy\b\.?/gi, "Freeway");
  a = a.replace(/\b(?:hwy|hgwy)\b\.?/gi, "Highway");
  a = a.replace(/\b(?:exp(?:ress)?wy|expy)\b\.?/gi, "Expressway");
  a = a.replace(/\bgtwy\b\.?/gi, "Gateway");
  a = a.replace(/\bhts\b\.?/gi, "Heights");
  a = a.replace(/\b(?:vlg|vil)\b\.?/gi, "Village");
  a = a.replace(/\bvly\b\.?/gi, "Valley");
  a = a.replace(/\bmdws\b\.?/gi, "Meadows");
  a = a.replace(/\bmdw\b\.?/gi, "Meadow");
  a = a.replace(/\bmnr\b\.?/gi, "Manor");
  a = a.replace(/\bgrv\b\.?/gi, "Grove");
  a = a.replace(/\bhbr\b\.?/gi, "Harbor");
  a = a.replace(/\bcmns\b\.?/gi, "Commons");
  a = a.replace(/\bxrds\b\.?/gi, "Crossroads");
  a = a.replace(/\bspgs\b\.?/gi, "Springs");
  a = a.replace(/\bspg\b\.?/gi, "Spring");
  a = a.replace(/\bshrs\b\.?/gi, "Shores");
  a = a.replace(/\bshr\b\.?/gi, "Shore");
  a = a.replace(/\blndg\b\.?/gi, "Landing");
  a = a.replace(/\bholw\b\.?/gi, "Hollow");
  a = a.replace(/\bbrg\b\.?/gi, "Bridge");
  a = a.replace(/\bsta\b\.?/gi, "Station");
  a = a.replace(/\bbch\b\.?/gi, "Beach");
  a = a.replace(/\bcrk\b\.?/gi, "Creek");
  a = a.replace(/\brdg\b\.?/gi, "Ridge");
  a = a.replace(/\bnatl\b\.?/gi, "National");
  a = a.replace(/\btrdg\.?\s*est\b\.?/gi, "Trading Estate");
  a = a.replace(/\bsez\b/gi, "Special Economic Zone");
  a = a.replace(/\bftz\b/gi, "Free Trade Zone");
  a = a.replace(/\bepz\b/gi, "Export Processing Zone");
  a = a.replace(/\bgpo\s*box\b/gi, "General Post Office Box");
  a = a.replace(/\blpo\b/gi, "Licensed Post Office");
  a = a.replace(/\bcir\b\.?/gi, "Circle");
  a = a.replace(/\bave\b\.?/gi, (isSpanishOrLatam || isPortugueseOrBrazil) ? "Avenida" : "Avenue");
  a = a.replace(/\bav\b\.?/gi, (isSpanishOrLatam || isPortugueseOrBrazil) ? "Avenida" : "Avenue");
  a = a.replace(/\bcnr\b\.?/gi, "Corner");
  a = a.replace(/\b(?:terr|tce|ter)\b\.?/gi, "Terrace");
  a = a.replace(/\bpde\b\.?/gi, "Parade");
  a = a.replace(/\besp\b\.?/gi, "Esplanade");
  a = a.replace(/\brte\b\.?/gi, "Route");
  a = a.replace(/\bctr\b\.?/gi, "Centre");
  a = a.replace(/\bplz\b\.?/gi, "Plaza");
  a = a.replace(/\bhse\b\.?/gi, "House");
  a = a.replace(/\bwks\b\.?/gi, "Works");
  a = a.replace(/\bcl\b\.?/gi, "Close");
  a = a.replace(/(?<!,\s*)\b(?:crt|ct)\b\.?(?!\s*\d{5})/gi, "Court");
  if (isPolishAddr) {
    a = a.replace(/(^|[,\s])pl\b\.?(?=\s+[A-ZŻŹĆĄŚĘŁÓŃa-z])/g, "$1Plac");
  } else if (isDutchOrBelgianAddr) {
    a = a.replace(/(^|[,\s])pl\b\.?(?=\s+[A-Za-z])/g, "$1Plein");
  } else if (isSpanishOrLatam) {
    a = a.replace(/(^|[,\s])pl\b\.?(?=\s+[A-Za-z])/g, "$1Plaza");
  } else if (!isDachAddr) {
    a = a.replace(/\bpl\b\.?/gi, "Place");
  }
  a = a.replace(/\b(?:sqr|sq)\b\.?/gi, "Square");
  a = a.replace(/\bst\b\.?(?!\s+(?:[A-Z][a-z']+\s+)*(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Rd|Ave|Dr|Ln|Blvd)\b)/gi, "Street");
  a = a.replace(/\brd\b\.?/gi, "Road");
  a = a.replace(/\bdr\b\.?(?!\s+[A-Z][a-z']+\b)/gi, "Drive");
  a = a.replace(/\bln\b\.?/gi, "Lane");
  a = a.replace(/\bextn?\b\.?/gi, "Extension");
  a = a.replace(/\bjct\b\.?/gi, "Junction");
  a = a.replace(/\btrl\b\.?/gi, "Trail");
  a = a.replace(/\bxing\b\.?/gi, "Crossing");
  a = a.replace(/\bbyp\b\.?/gi, "Bypass");
  a = a.replace(/\bmfg\b\.?/gi, "Manufacturing");
  a = a.replace(/\bwhse\b\.?/gi, "Warehouse");
  a = a.replace(/\b(?:ind['’]?l|indl|ind)\b\.?\s*est\b\.?/gi, "Industrial Estate");
  a = a.replace(/\b(?:ind['’]?l|indl|ind)\b\.?\s+(?=(?:area|park|estate|est\.?|zone|district|region|complex|center|centre|ctr\.?|corridor|hub|facility|rd|road|st|street|ave|avenue|dr|drive|way|blvd|pkwy)\b)/gi, "Industrial ");
  a = a.replace(/\bindl\b\.?/gi, "Industrial");
  a = a.replace(/\bcomml?\b\.?\s+(?=(?:park|estate|est\.?|center|centre|ctr\.?|district|area|zone|hub|complex|rd|road)\b)/gi, "Commercial ");
  a = a.replace(/\bbus\.?\s+(?=(?:park|estate|est\.?|center|centre|ctr\.?|district|hub|complex)\b)/gi, "Business ");
  a = a.replace(/\b(?:hi|high)[-\s]*tech\b\.?/gi, "High-Technology");
  a = a.replace(/\btech\.?\s+(?=(?:park|estate|est\.?|center|centre|ctr\.?|zone|hub|corridor|blvd|rd|way|dr|industrial)\b)/gi, "Technology ");
  a = a.replace(/\bpk\b\.?/gi, "Park");
  a = a.replace(/\best\b\.?\s+(?=(?:park|area|zone)\b)/gi, "Estate ");
  a = a.replace(/\b([A-Za-z0-9]+\s+(?:Industrial|Business|Trade|Trading|Commercial|Manor|Factory|Enterprise|Logistics|Distribution|Technology|Science)\s+)est\b\.?/gi, "$1Estate");
  a = a.replace(/\bjln\b\.?/gi, "Jalan");
  a = a.replace(/\blrg\b\.?/gi, "Lorong");
  a = a.replace(/(^|[\s,])bt\.?\s+caves\b/gi, '$1Batu Caves');
  a = a.replace(/(^|[\s,])bt\.?\s*(?=\d)/gi, '$1Batu ');
  a = a.replace(/\bbt\b\.?/gi, "Bukit");
  a = a.replace(/\bkg\b\.?/gi, "Kampung");
  a = a.replace(/\bmt\.?\s+(?=[A-Z])/gi, "Mount ");
  a = a.replace(/\bft\.?\s+(?=[A-Z])/gi, "Fort ");
  if (!hasIndoHint) {
    a = a.replace(/\bpt\.?\s+(?=(?:Melbourne|Adelaide|Kembla|Hedland|Macquarie|Augusta|Lincoln|Pirie|Elizabeth|Klang|Dickson|Harcourt|Louis|Arthur|Said|Moresby)\b)/gi, "Port ");
    a = a.replace(/\bpt\.?\s+(?=[A-Z])/gi, "Point ");
  }

  // 4. Directionals at end of street name (e.g. "Main Street E" -> "Main Street East")
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bE\.?(?=[,\s]|$)/gi, "$1 East");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bW\.?(?=[,\s]|$)/gi, "$1 West");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bN\.?(?=[,\s]|$)/gi, "$1 North");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bS\.?(?=[,\s]|$)/gi, "$1 South");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bN\.?E\.?(?=[,\s]|$)/gi, "$1 Northeast");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bN\.?W\.?(?=[,\s]|$)/gi, "$1 Northwest");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bS\.?E\.?(?=[,\s]|$)/gi, "$1 Southeast");
  a = a.replace(/(\b(?:Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Parkway|Circle))\s+\bS\.?W\.?(?=[,\s]|$)/gi, "$1 Southwest");

  // 7. Buildings, suites, floors
  a = a.replace(/\bbldg\b\.?/gi, "Building");
  a = a.replace(/\bflr\b\.?/gi, "Floor");
  a = a.replace(/\bfl\.\s*(?=\d{1,2}(?:\b|[,\s]))/gi, "Floor ");
  a = a.replace(/(\d+(?:st|nd|rd|th)?)\s*\bfl\b\.?/gi, "$1 Floor");
  a = a.replace(/(\b\d+)\s*F\b(?=[,\s]|$)/gi, "$1 Floor");
  a = a.replace(/(^|[,\s])Flr?\.?\s*(?=\d{1,2}(?:\b|[,\s]))/gi, "$1Floor ");
  a = a.replace(/\bste\b\.?/gi, "Suite");
  a = a.replace(/\bapt\b\.?/gi, "Apartment");
  a = a.replace(/\bdept\b\.?/gi, "Department");
  a = a.replace(/\brm\b\.?/gi, "Room");
  if (!hasIndoHint) {
    a = a.replace(/\bblk\b\.?/gi, "Block");
  }
  a = a.replace(/(^|[,\s])\b(?:p\.?o\.?\s*box|pob|postfach|bo[iî]te\s*postale|b\.?p\.?|apartado\s*postal|apdo|casella\s*postale|caixa\s*postal|postbus|skrytka\s*pocztowa|postboks)\b\.?/gi, "$1Post Office Box");
  a = a.replace(/(^|[,\s])(?<!\b(?:post\s+office|general\s+post\s+office)\s+)\bBox\s*(\d+[A-Za-z]?(?:[-/]\d+)?)\b/gi, "$1Post Office Box $2");

  // 6. Expand State & Province abbreviations (Global)
  // Australia
  if (cLower.includes("australia") || /\b(?:vic|nsw|qld|tas|act)\b/i.test(a) || /\b(?:3\d{3}|2\d{3}|4\d{3}|5\d{3}|6\d{3}|7\d{3}|0\d{3})\b/.test(a)) {
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bvic\b\.?/gi, "$1, Victoria");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bnsw\b\.?/gi, "$1, New South Wales");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bqld\b\.?/gi, "$1, Queensland");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\btas\b\.?/gi, "$1, Tasmania");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bact\b\.?/gi, "$1, Australian Capital Territory");
    a = a.replace(/([a-zA-Z\)])\s*,?\s*\bnt\b\.?/gi, "$1, Northern Territory");
    if (cLower.includes("australia") || /\b(?:wa|sa)\b(?=[,\s]|$|\s*\d{4})/i.test(a)) {
      a = a.replace(/([a-zA-Z\)])\s*,?\s*\bwa\b\.?(?=[,\s]|$|\s*\d{4})/gi, "$1, Western Australia");
      a = a.replace(/([a-zA-Z\)])\s*,?\s*\bsa\b\.?(?=[,\s]|$|\s*\d{4})/gi, "$1, South Australia");
    }
  }

  // Canada
  const isCanadaAddress = cLower.includes("canada") ||
    /\b(?:ont|que|qc|on|bc|b\.?c\.|alta|ab|sask|sk|man|mb|ns|nb|nl|pe|pei|quebec|ontario|alberta)\b/i.test(a) ||
    /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i.test(a);

  if (isCanadaAddress) {
    a = a.replace(/,\s*\b(?:on|ont)\b\.?/gi, ", Ontario");
    a = a.replace(/,\s*\b(?:qc|que)\b\.?/gi, ", Quebec");
    a = a.replace(/,\s*\b(?:bc|b\.c\.)\b\.?/gi, ", British Columbia");
    a = a.replace(/,\s*\b(?:ab|alta)\b\.?/gi, ", Alberta");
    a = a.replace(/,\s*\b(?:mb|man)\b\.?/gi, ", Manitoba");
    a = a.replace(/,\s*\b(?:sk|sask)\b\.?/gi, ", Saskatchewan");
    a = a.replace(/,\s*\b(?:ns)\b\.?/gi, ", Nova Scotia");
    a = a.replace(/,\s*\b(?:nb)\b\.?/gi, ", New Brunswick");
    a = a.replace(/,\s*\b(?:nl)\b\.?/gi, ", Newfoundland And Labrador");
    a = a.replace(/,\s*\b(?:pe|pei)\b\.?/gi, ", Prince Edward Island");
  }

  // United States - Only when country is United States or has US zip or explicit US context (NEVER override Indonesia / non-US countries)
  const nonUsCountries = [
    "australia", "canada", "united kingdom", "india", "indonesia", "south africa", "malaysia",
    "spain", "espana", "italy", "italia", "germany", "deutschland", "france", "taiwan",
    "japan", "china", "singapore", "thailand", "vietnam", "philippines", "south korea",
    "netherlands", "belgium", "switzerland", "austria", "poland", "portugal", "sweden",
    "norway", "denmark", "finland", "ireland", "new zealand", "turkey", "türkiye", "czech republic",
    "brazil", "mexico", "united arab emirates", "saudi arabia", "hong kong"
  ];
  const isUsAddress = !isCanadaAddress && !hasIndoHint && !nonUsCountries.includes(cLower) && (
    (typeof isUnitedStatesLocation === "function" && isUnitedStatesLocation(a, country)) ||
    cLower.includes("united states") || cLower.includes("usa") || cLower.includes("america") ||
    /\b\d{5}(?:-\d{4})?\b/.test(a) || (!country && /,\s*[A-Z]{2}\b/.test(a))
  );

  if (isUsAddress) {
    const usAbbreviations = [
      ["ca", "California"], ["tx", "Texas"], ["ny", "New York"], ["fl", "Florida"],
      ["il", "Illinois"], ["pa", "Pennsylvania"], ["oh", "Ohio"], ["ga", "Georgia"],
      ["nc", "North Carolina"], ["mi", "Michigan"], ["nj", "New Jersey"], ["va", "Virginia"],
      ["wa", "Washington"], ["az", "Arizona"], ["ma", "Massachusetts"], ["tn", "Tennessee"],
      ["in", "Indiana"], ["mo", "Missouri"], ["md", "Maryland"], ["wi", "Wisconsin"],
      ["co", "Colorado"], ["mn", "Minnesota"], ["sc", "South Carolina"], ["al", "Alabama"],
      ["la", "Louisiana"], ["ky", "Kentucky"], ["or", "Oregon"], ["ok", "Oklahoma"],
      ["ct", "Connecticut"], ["ut", "Utah"], ["ia", "Iowa"], ["nv", "Nevada"],
      ["ar", "Arkansas"], ["ms", "Mississippi"], ["ks", "Kansas"], ["nm", "New Mexico"],
      ["ne", "Nebraska"], ["wv", "West Virginia"], ["id", "Idaho"], ["hi", "Hawaii"],
      ["nh", "New Hampshire"], ["me", "Maine"], ["mt", "Montana"], ["ri", "Rhode Island"],
      ["de", "Delaware"], ["sd", "South Dakota"], ["nd", "North Dakota"], ["ak", "Alaska"],
      ["vt", "Vermont"], ["wy", "Wyoming"], ["dc", "District Of Columbia"]
    ];

    for (const [abbr, full] of usAbbreviations) {
      // Must be preceded by comma and space, or space and directly followed by 5-digit zip:
      // e.g. ", IL" or ", IL 60090" or " IL 60090"
      const regComma = new RegExp(`(,\\s*)\\b${abbr}\\b\\.?(?=[,\\s]|$|\\s*\\d{5})|(\\s+)\\b${abbr}\\b\\.?(?=\\s*\\d{5})`, "i");
      a = a.replace(regComma, (match, p1, p2) => {
        if (p1) return `, ${full} `;
        return ` ${full} `;
      });
    }
  }

  // ==========================================
  // 7. Spain (España) Abbreviations
  // ==========================================
  if (cLower.includes("spain") || cLower.includes("espana") || isSpanishLocation(a, country)) {
    // Industrial zones FIRST: Pol. Ind. / P.I. -> Poligono Industrial
    a = a.replace(/(^|[,\s])(?:pol\.?\s*ind(?:ustrial)?\.?|p\.?i\.?)\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Poligono Industrial ');
    a = a.replace(/\bpoligono\s+ind\b\.?/gi, 'Poligono Industrial');

    // Street prefixes: C/ -> Calle, Avda. -> Avenida, P.º -> Paseo, Pl. / Pza. -> Plaza, Ctra. -> Carretera, Rbla. -> Rambla
    a = a.replace(/(^|[,\s])C\/\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Calle ');
    a = a.replace(/(^|[,\s])C\.\s+(?=[A-ZÁÉÍÓÚ][a-záéíóúñ])/g, '$1Calle ');
    a = a.replace(/(^|[,\s])avda?\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Avenida ');
    a = a.replace(/(^|[,\s])(?:p\.?[º°]|pso\.?|p\.\s*o\b|p\.º)\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Paseo ');
    a = a.replace(/(^|[,\s])(?:plza?\.?|pza\.?|pl\.)\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Plaza ');
    a = a.replace(/(^|[,\s])Place\s+(?=(?:Mayor|de\s+|del\s+|Real|de\s*la|[A-ZÁÉÍÓÚ][a-z]))/g, '$1Plaza ');
    a = a.replace(/(^|[,\s])rbla\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Rambla ');
    a = a.replace(/(^|[,\s])ctra\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Carretera ');
    a = a.replace(/(^|[,\s])\b(?:cno|cam)\b\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Camino ');
    a = a.replace(/(^|[,\s])\btrav(?:es)?\b\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Travesia ');
    a = a.replace(/(^|[,\s])\bp(?:t)?je\b\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Pasaje ');
    a = a.replace(/(^|[,\s])\brda\b\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Ronda ');
    a = a.replace(/(^|[,\s])\burb\b\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Urbanizacion ');
    a = a.replace(/(^|[,\s])\bed(?:if)?\b\.?\s*(?=[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ])/gi, '$1Edificio ');

    // House / premise numbers / without number
    a = a.replace(/(^|[,\s])(?:n[ºo]\.?|n\.º|n[uú]m\.?)\s*(?=\d)/gi, '$1Numero ');
    a = a.replace(/\b(?:s\/n|sin\s*n[uú]mero)\b/gi, 'Sin Numero');
    a = a.replace(/\bkm\.?\s*(?=\d)/gi, 'Kilometro ');
    a = a.replace(/\bpta\.?\s*(?=\d|[A-Za-z])/gi, 'Puerta ');
    a = a.replace(/\bplta\.?\s*(?=\d|[A-Za-z])/gi, 'Planta ');
    a = a.replace(/\bapdo\.?\s*(?:de\s*correos)?\b/gi, 'Apartado de Correos');
  }

  // ==========================================
  // 8. Italy (Italia) Abbreviations
  // ==========================================
  // Street prefixes
  a = a.replace(/(^|[,\s])v\.?le\b\.?/gi, '$1Viale');
  a = a.replace(/(^|[,\s])vle\b/gi, '$1Viale');
  a = a.replace(/(^|[,\s])c\.?so\b\.?/gi, '$1Corso');
  a = a.replace(/(^|[,\s])cso\b/gi, '$1Corso');
  a = a.replace(/(^|[,\s])p\.?zza\b\.?/gi, '$1Piazza');
  a = a.replace(/(^|[,\s])pzza\b/gi, '$1Piazza');
  a = a.replace(/(^|[,\s])p\.?za\b\.?/gi, '$1Piazza');
  a = a.replace(/(^|[,\s])pza\b/gi, '$1Piazza');
  a = a.replace(/(^|[,\s])p\.?le\b\.?/gi, '$1Piazzale');
  a = a.replace(/(^|[,\s])ple\b/gi, '$1Piazzale');
  a = a.replace(/(^|[,\s])l\.?go\b\.?/gi, '$1Largo');
  a = a.replace(/(^|[,\s])lgo\b/gi, '$1Largo');
  a = a.replace(/(^|[,\s])v\.?colo\b\.?/gi, '$1Vicolo');
  a = a.replace(/(^|[,\s])vclo\b/gi, '$1Vicolo');
  a = a.replace(/(^|[,\s])circonv\b\.?/gi, '$1Circonvallazione');
  a = a.replace(/(^|[,\s])circ\b\.?\s+(?=[A-Za-z])/gi, '$1Circonvallazione ');

  // Compass directions in Italian addresses
  if (cLower.includes("italy") || cLower.includes("italia")) {
    a = a.replace(/(^|[,\s])est\b/gi, '$1East');
    a = a.replace(/(^|[,\s])ovest\b/gi, '$1West');
    a = a.replace(/(^|[,\s])nord\b/gi, '$1North');
    a = a.replace(/(^|[,\s])sud\b/gi, '$1South');
  }

  // Roads: Strada, SP, SS, SR (do not override German/Austrian/Swiss Strasse or Dutch/Belgian Straat)
  if (!isDutchOrBelgianAddr && !isDachAddr) {
    a = a.replace(/(^|[,\s])str\b\.?\s+(?=[A-Za-z0-9])/gi, '$1Strada ');
  }
  a = a.replace(/\bs\.?p\.?\s*(?=\d)/gi, 'Strada Provinciale ');
  a = a.replace(/\bs\.?s\.?\s*(?=\d)/gi, 'Strada Statale ');
  a = a.replace(/\bs\.?r\.?\s*(?=\d)/gi, 'Strada Regionale ');

  // Internal details (Scala, Palazzina, etc.)
  a = a.replace(/\bsc\b\.?\s*(?=[A-Za-z0-9])/gi, 'Scala ');
  a = a.replace(/\bpal\b\.?\s*(?=[A-Za-z0-9])/gi, 'Palazzina ');
  a = a.replace(/\bint\b\.?\s*(?=\d|[A-Za-z])/gi, isSpanishOrLatam ? 'Interior ' : 'Interno ');
  a = a.replace(/(^|[,\s])p\b\.?\s*(?=\d)/gi, '$1Piano ');
  a = a.replace(/\bp\.?to\b\.?\s*(?=\d)/gi, 'Piano ');
  a = a.replace(/\bciv(?:ico)?\.?\s*(?=\d)/gi, 'Numero ');
  a = a.replace(/\bn\.?ro\b\.?\s*(?=\d)/gi, 'Numero ');
  a = a.replace(/(^|[,\s])n\.\s*(?=\d)/gi, '$1Numero ');

  // Administrative / Zones (only expand Z.I./Z.A. as Italian when NOT a French address)
  if (!isFrenchAddr || cLower.includes("italy") || cLower.includes("italia")) {
    a = a.replace(/\b(?:zona\s+ind\.?|z\.?i\.?|z\.?\s*ind\.?|zona\s+ind\.?le)\b\.?/gi, 'Zona Industriale');
    a = a.replace(/\b(?:zona\s+art\.?|z\.?a\.?|zona\s+art\.?le)\b\.?/gi, 'Zona Artigianale');
  }
  a = a.replace(/(^|[,\s])loc\b\.?\s+(?=[A-Za-z])/gi, '$1Località ');
  a = a.replace(/(^|[,\s])fraz\b\.?\s+(?=[A-Za-z])/gi, '$1Frazione ');
  a = a.replace(/(^|[,\s])c\.?da\b\.?\s+(?=[A-Za-z])/gi, '$1Contrada ');
  a = a.replace(/(^|[,\s])cda\b\s+(?=[A-Za-z])/gi, '$1Contrada ');
  a = a.replace(/(^|[,\s])b\.?go\b\.?\s+(?=[A-Za-z])/gi, '$1Borgo ');
  a = a.replace(/(^|[,\s])bgo\b\s+(?=[A-Za-z])/gi, '$1Borgo ');

  // ==========================================
  // 8. Singapore & Malaysia Abbreviations
  // ==========================================
  // Thoroughfares & Blocks
  if (!hasIndoHint) {
    a = a.replace(/\bblk\b\.?\s*(?=\d|[A-Za-z])/gi, 'Block ');
  }
  a = a.replace(/\bjln\b\.?/gi, 'Jalan');
  a = a.replace(/\blrg\b\.?/gi, 'Lorong');
  a = a.replace(/\blor\b\.?\s*(?=\d|[A-Za-z])/gi, 'Lorong ');
  a = a.replace(/\blbh\b\.?/gi, 'Lebuh');
  a = a.replace(/\blbr\b\.?/gi, 'Lebuhraya');
  a = a.replace(/\bpsn\b\.?/gi, 'Persiaran');
  a = a.replace(/\bmdn\b\.?/gi, 'Medan');

  // Hills, Villages, Capes, Settlements
  a = a.replace(/\bbt\b\.?\s+(?=[A-Za-z])/gi, 'Bukit ');
  a = a.replace(/\bkg\b\.?\s+(?=[A-Za-z])/gi, 'Kampung ');
  a = a.replace(/\btg\b\.?\s+(?=[A-Za-z])/gi, 'Tanjung ');
  a = a.replace(/\btmn\b\.?\s+(?=[A-Za-z])/gi, 'Taman ');
  a = a.replace(/\bbdr\b\.?\s+(?=[A-Za-z])/gi, 'Bandar ');

  // Planning & Municipal Zoning Sectors (Klang, Petaling Jaya, Subang Jaya)
  a = a.replace(/(^|[\s,\/\-])ku\s*[-–\/\.]?\s*(\d{1,2})\b/gi, '$1Klang Utara $2');
  a = a.replace(/(^|[\s,\/\-])ks\s*[-–\/\.]?\s*(\d{1,2})\b/gi, '$1Klang Selatan $2');
  a = a.replace(/(^|[\s,\/\-])pju\s*[-–\/\.]?\s*(\d{1,2})\b/gi, '$1Petaling Jaya Utara $2');
  a = a.replace(/(^|[\s,\/\-])pjs\s*[-–\/\.]?\s*(\d{1,2})\b/gi, '$1Petaling Jaya Selatan $2');
  a = a.replace(/(^|[\s,\/\-])usj\s*[-–\/\.]?\s*(\d{1,2})\b/gi, '$1UEP Subang Jaya $2');

  // Rivers, Hills & Milestones (Sg -> Sungai, Bkt -> Bukit, Bt -> Batu / Bukit)
  a = a.replace(/(^|[\s,])sg\.?\s+(?=[A-Za-z])/gi, '$1Sungai ');
  a = a.replace(/(^|[\s,])bkt\.?\s+(?=[A-Za-z])/gi, '$1Bukit ');
  a = a.replace(/(^|[\s,])bt\.?\s+caves\b/gi, '$1Batu Caves');
  a = a.replace(/(^|[\s,])bt\.?\s*(?=\d)/gi, '$1Batu ');
  a = a.replace(/(^|[\s,])bt\.?\s+(?=[A-Za-z])/gi, '$1Bukit ');

  // Common Malaysian City Abbreviations
  a = a.replace(/,\s*\bpj\b/gi, ', Petaling Jaya');
  a = a.replace(/,\s*\bjb\b/gi, ', Johor Bahru');

  // Areas & Zones
  a = a.replace(/\bkws\.?\s*perind(?:ustrian)?\.?/gi, 'Kawasan Perindustrian');
  a = a.replace(/\bzon\s*perind(?:ustrian)?\.?/gi, 'Zon Perindustrian');
  a = a.replace(/\bperind(?:ustrian)?\b\.?/gi, 'Perindustrian');
  a = a.replace(/\bkws\b\.?\s+(?=[A-Za-z])/gi, 'Kawasan ');
  a = a.replace(/\bsek\b\.?\s*(?=\d|[A-Za-z])/gi, 'Seksyen ');
  a = a.replace(/\bpst\b\.?\s+(?=[A-Za-z])/gi, 'Pusat ');
  a = a.replace(/\bbgn\b\.?\s+(?=[A-Za-z])/gi, 'Bangunan ');
  a = a.replace(/\btkt\b\.?\s*(?=\d|[A-Za-z])/gi, 'Tingkat ');
  a = a.replace(/\bpeti\s*surat\b\.?/gi, 'Post Office Box');

  // Singapore Industrial & Tech Parks
  a = a.replace(/\bind\b\.?\s+(?=(?:area|park|estate|zone|district|region|terrace|basin|sector)\b)/gi, 'Industrial ');
  a = a.replace(/\bindl\b\.?/gi, 'Industrial');
  a = a.replace(/\bpk\b\.?/gi, 'Park');
  a = a.replace(/\best\b\.?\s+(?=(?:park|area|zone|estate)\b)/gi, 'Estate ');
  a = a.replace(/\btech\s*park\b/gi, 'Technology Park');
  a = a.replace(/\btechpark\b/gi, 'Technology Park');

  // Malaysian State abbreviations
  if (cLower.includes('malaysia') || /\b(?:selangor|johor|penang|perak|kuala\s*lumpur)\b/i.test(a)) {
    a = a.replace(/,\s*\b(?:kl|k\.l\.)\b\.?/gi, ', Kuala Lumpur');
    a = a.replace(/,\s*\b(?:sgr|sel)\b\.?/gi, ', Selangor');
    a = a.replace(/,\s*\b(?:jhr|joh)\b\.?/gi, ', Johor');
    a = a.replace(/,\s*\b(?:pnk|pg|pen)\b\.?/gi, ', Penang');
    a = a.replace(/,\s*\b(?:prk|pk)\b\.?/gi, ', Perak');
    a = a.replace(/,\s*\b(?:kdh|ked)\b\.?/gi, ', Kedah');
    a = a.replace(/,\s*\b(?:phg|pah)\b\.?/gi, ', Pahang');
    a = a.replace(/,\s*\b(?:n\.?s\.?|n\.?\s*sembilan)\b/gi, ', Negeri Sembilan');
    a = a.replace(/,\s*\b(?:mlk|mel)\b\.?/gi, ', Melaka');
    a = a.replace(/,\s*\b(?:trg|ter)\b\.?/gi, ', Terengganu');
    a = a.replace(/,\s*\b(?:kel)\b\.?/gi, ', Kelantan');
    a = a.replace(/,\s*\b(?:swk|sar)\b\.?/gi, ', Sarawak');
    a = a.replace(/,\s*\b(?:sbh|sab)\b\.?/gi, ', Sabah');
    a = a.replace(/,\s*\b(?:per)\b\.?/gi, ', Perlis');
    a = a.replace(/,\s*\b(?:wp|w\.p\.)\b\.?/gi, ', Wilayah Persekutuan');
  }

  // ==========================================
  // 9. Germany (Deutschland) Abbreviations
  // ==========================================
  // Street & Square: Compound suffixes (e.g. Industriestr. -> Industriestrasse, Marktpl. -> Marktplatz)
  if (!isDutchOrBelgianAddr && !cLower.includes('romania')) {
    a = a.replace(/([a-zA-ZäöüÄÖÜß\-]+)str\b\.?(?=\s*\d|\s*,|\s*$|\s+[A-Za-z])/gi, function (match, base) {
      return base + (base === base.toUpperCase() ? 'STRASSE' : 'strasse');
    });
    a = a.replace(/(^|[,\s])str\b\.?\s+(?=[A-Za-z0-9])/gi, '$1Strasse ');
  }
  if (!isPolishAddr && !isDutchOrBelgianAddr && !isSpanishOrLatam) {
    a = a.replace(/([a-zA-ZäöüÄÖÜß\-]+)pl\b\.?(?=\s*\d|\s*,|\s*$|\s+[A-Za-z])/gi, function (match, base) {
      return base + (base === base.toUpperCase() ? 'PLATZ' : 'platz');
    });
    a = a.replace(/(^|[,\s])pl\b\.?\s+(?=[A-Za-z0-9])/gi, '$1Platz ');
  }

  // Commercial / Industrial zones
  a = a.replace(/\bgew(?:erbe)?\.?\s*gebiet\b/gi, 'Gewerbegebiet');
  a = a.replace(/\bgew(?:erbe)?\.?\s*park\b/gi, 'Gewerbepark');
  a = a.replace(/\bind(?:ustrie)?\.?\s*gebiet\b/gi, 'Industriegebiet');
  a = a.replace(/\bind(?:ustrie)?\.?\s*park\b/gi, 'Industriepark');

  // House / Building / Entrance / Floors
  a = a.replace(/(^|[,\s])nr\b\.?\s*(?=\d)/gi, '$1Nummer ');
  a = a.replace(/(^|[,\s])hs\b\.?\s*(?=\d)/gi, '$1Haus ');
  a = a.replace(/(^|[,\s])geb\s*ude\b/gi, '$1Gebaeude');
  a = a.replace(/(^|[,\s])geb\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Gebaeude ');
  a = a.replace(/(^|[,\s])aufg\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Aufgang ');
  a = a.replace(/(^|[,\s])whg\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Wohnung ');
  a = a.replace(/(\d+)\.?\s*\bOG\b/g, '$1. Obergeschoss');
  a = a.replace(/\b(?:o\.?g\.?|og)\b/gi, 'Obergeschoss');
  a = a.replace(/\b(?:e\.?g\.?|eg)\b/gi, 'Erdgeschoss');
  a = a.replace(/\b(?:u\.?g\.?|ug)\b/gi, 'Untergeschoss');
  a = a.replace(/\bstck\b\.?\s*(?=\d)/gi, 'Stockwerk ');
  a = a.replace(/\bpf\b\.?\s*(?=\d)/gi, 'Postfach ');
  a = a.replace(/\bpostfach\b/gi, 'Postfach');

  // Geographic river / location markers
  a = a.replace(/\ba\.?\s*m\b\.?/gi, 'am Main');
  a = a.replace(/\ba\.?\s*d\b\.?/gi, 'an der');
  a = a.replace(/\bi\.?\s*b\b\.?/gi, 'im Breisgau');
  a = a.replace(/\bv\.?\s*d\.?\s*h\b\.?/gi, 'vor der Höhe');

  // German Bundesländer abbreviations
  if (cLower.includes('germany') || cLower.includes('deutschland') || cLower.includes('german')) {
    a = a.replace(/,\s*\b(?:bw)\b\.?/gi, ', Baden-Württemberg');
    a = a.replace(/,\s*\b(?:by)\b\.?/gi, ', Bayern');
    a = a.replace(/,\s*\b(?:bb)\b\.?/gi, ', Brandenburg');
    a = a.replace(/,\s*\b(?:he)\b\.?/gi, ', Hessen');
    a = a.replace(/,\s*\b(?:mv)\b\.?/gi, ', Mecklenburg-Vorpommern');
    a = a.replace(/,\s*\b(?:ni)\b\.?/gi, ', Niedersachsen');
    a = a.replace(/,\s*\b(?:nw|nrw)\b\.?/gi, ', Nordrhein-Westfalen');
    a = a.replace(/,\s*\b(?:rp)\b\.?/gi, ', Rheinland-Pfalz');
    a = a.replace(/,\s*\b(?:sl)\b\.?/gi, ', Saarland');
    a = a.replace(/,\s*\b(?:sn)\b\.?/gi, ', Sachsen');
    a = a.replace(/,\s*\b(?:st)\b\.?/gi, ', Sachsen-Anhalt');
    a = a.replace(/,\s*\b(?:sh)\b\.?/gi, ', Schleswig-Holstein');
    a = a.replace(/,\s*\b(?:th)\b\.?/gi, ', Thüringen');
  }

  // ==========================================
  // 10. Indonesia Abbreviations & Honorific Street Prefixes
  // ==========================================
  const hasIndoSignal = hasIndoHint || hasIndonesiaAddressSignal(a, country);

  a = a.replace(/(^|[,\s])jln?\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Jalan ');
  // Honorific street titles (e.g. "Jl. RA. Kardinah", "Jl. Jend. A. Yani" -> "Jalan Jenderal Ahmad Yani")
  if (hasIndoSignal) {
    // Strip trailing JSON-LD ISO country code ", ID" when address is Indonesian
    a = a.replace(/,\s*ID\s*$/i, "");
    // Military / honorific ranks FIRST so chained "Jl. Jend. A. Yani" or "Jl. Letjen S. Parman" expands both rank and name
    a = a.replace(/(\bJalan\s+|,\s*)\b(?:Let\.?\s*Jen(?:d)?|Letjen)\b\.?\s*(?=[A-Za-z])/gi, '$1Letnan Jenderal ');
    a = a.replace(/(\bJalan\s+|,\s*)\b(?:May\.?\s*Jen(?:d)?|Mayjen)\b\.?\s*(?=[A-Za-z])/gi, '$1Mayor Jenderal ');
    a = a.replace(/(\bJalan\s+|,\s*)\b(?:Brig\.?\s*Jen(?:d)?|Brigjen)\b\.?\s*(?=[A-Za-z])/gi, '$1Brigadir Jenderal ');
    a = a.replace(/(\bJalan\s+|,\s*)\bJend\.?\s*(?=[A-Za-z])/gi, '$1Jenderal ');
    a = a.replace(/(\bJalan\s+|,\s*)\bKol\.?\s*(?=[A-Za-z])/gi, '$1Kolonel ');
    a = a.replace(/(\bJalan\s+|,\s*)\bKapt\.?\s*(?=[A-Za-z])/gi, '$1Kapten ');

    const streetOrRank = `(\\bJalan\\s+(?:(?:Letnan|Mayor|Brigadir)?\\s*Jenderal\\s+|Kolonel\\s+|Kapten\\s+)?|,\\s*)`;
    a = a.replace(new RegExp(`${streetOrRank}\\bR\\.?\\s*A(?:\\.|\\b)\\s*(?=[A-Za-z])`, "gi"), '$1Raden Ajeng ');
    a = a.replace(new RegExp(`${streetOrRank}\\bK\\.?\\s*H(?:\\.|\\b)\\s*(?=[A-Za-z])`, "gi"), '$1Kiai Haji ');
    a = a.replace(new RegExp(`${streetOrRank}\\bH\\.?\\s*O\\.?\\s*S(?:\\.|\\b)\\s*(?=[A-Za-z])`, "gi"), '$1Haji Oemar Said ');
    a = a.replace(new RegExp(`${streetOrRank}\\bH\\.?\\s*R(?:\\.|\\b)\\s*(?=[A-Za-z])`, "gi"), '$1Haji Rangkayo ');
    a = a.replace(new RegExp(`${streetOrRank}\\bM\\.?\\s*H(?:\\.|\\b)\\s*(?=[A-Za-z])`, "gi"), '$1Mohammad Husni ');
    a = a.replace(new RegExp(`${streetOrRank}\\bM\\.?\\s*T(?:\\.|\\b)\\s*(?=[A-Za-z])`, "gi"), '$1Mas Tirtodarmo ');
    a = a.replace(new RegExp(`${streetOrRank}\\bW\\.?\\s*R(?:\\.|\\b)\\s*(?=[A-Za-z])`, "gi"), '$1Wage Rudolf ');
    a = a.replace(new RegExp(`${streetOrRank}\\bT\\.?\\s*B(?:\\.|\\b)\\s*(?=[A-Za-z])`, "gi"), '$1Tahi Bonar ');
    a = a.replace(new RegExp(`${streetOrRank}\\bD\\.?\\s*I\\.?\\s+(?=Panjaitan\\b)`, "gi"), '$1Donald Isaac ');
    a = a.replace(new RegExp(`${streetOrRank}\\bA\\.?\\s+(?=Yani\\b)`, "gi"), '$1Ahmad ');
    a = a.replace(new RegExp(`${streetOrRank}\\bS\\.?\\s+(?=Parman\\b)`, "gi"), '$1Siswondo ');
    a = a.replace(new RegExp(`${streetOrRank}\\bHj(?:\\.|\\b)\\s*(?=[A-Za-z])`, "gi"), '$1Hajjah ');
    a = a.replace(new RegExp(`${streetOrRank}\\bH\\.(?=\\s*[A-Z][a-z]+)`, "g"), '$1Haji');
    a = a.replace(new RegExp(`${streetOrRank}\\bProf\\.?\\s*(?=[A-Za-z])`, "gi"), '$1Professor ');
    a = a.replace(new RegExp(`${streetOrRank}\\bIr\\.?\\s*(?=[A-Za-z])`, "gi"), '$1Insinyur ');
    a = a.replace(new RegExp(`${streetOrRank}\\bDrs\\.?\\s*(?=[A-Za-z])`, "gi"), '$1Doktorandus ');
    a = a.replace(new RegExp(`${streetOrRank}\\bDr\\.?\\s*(?=[A-Z][a-z])`, "g"), '$1Doktor ');

    a = a.replace(/(^|[,\s])perum\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Perumahan ');
    a = a.replace(/(^|[,\s])dkh?\b\.?\s*(?=[A-Za-z])/gi, '$1Dukuh ');
    a = a.replace(/(^|[,\s])ds\b\.?\s*(?=[A-Za-z])/gi, '$1Desa ');
    a = a.replace(/(^|[,\s])dsn\b\.?\s*(?=[A-Za-z])/gi, '$1Dusun ');
    a = a.replace(/(^|[,\s])(?:lingk|lk)\b\.?\s*(?=[A-Za-z])/gi, '$1Lingkungan ');
    a = a.replace(/(^|[,\s])kodya\b\.?\s*(?=[A-Za-z])/gi, '$1Kotamadya ');
    a = a.replace(/(^|[,\s])kpg?\b\.?\s*(?=[A-Za-z])/gi, '$1Kampung ');
    a = a.replace(/(^|[,\s])gdg?\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Gedung ');
    a = a.replace(/(^|[,\s])lt\.?\s*(\d+)/gi, '$1Lantai $2');
    a = a.replace(/(^|[,\s])blk\.?\s*(?=[A-Za-z0-9])/gi, '$1Blok ');
    a = a.replace(/(^|[,\s])km\.?\s*(\d+)/gi, '$1Kilometer $2');
    a = a.replace(/(^|[,\s])(?:tjg|tj)\b\.?\s+(?=[A-Za-z])/gi, '$1Tanjung ');
    a = a.replace(/(^|[,\s])gn\b\.?\s+(?=[A-Za-z])/gi, '$1Gunung ');
    a = a.replace(/\b(?:kaw|kws)\.?\s*(?=(?:industri|perindustrian|berikat|pergudangan|bisnis|niaga|terpadu|ekonomi|[A-Z][a-z]+)\b)/gi, 'Kawasan ');
    a = a.replace(/\bperind\b\.?/gi, 'Perindustrian');
    // Directional city suffixes: Jakarta Sel. -> Jakarta Selatan, Semarang Bar. -> Semarang Barat, etc.
    a = a.replace(/\b(Jakarta|Semarang|Surabaya|Bandung|Bekasi|Tangerang|Bogor|Lampung|Minahasa)\s+(Sel|Tim|Bar|Utr?|Pst|Pus|Teng)\b\.?/gi, (m, city, dir) => {
      const dirMap = { sel: "Selatan", tim: "Timur", bar: "Barat", ut: "Utara", utr: "Utara", pst: "Pusat", pus: "Pusat", teng: "Tengah" };
      const fullDir = dirMap[dir.toLowerCase()];
      return fullDir ? `${city} ${fullDir}` : m;
    });
    const indoProvMap = [
      ["jabar", "Jawa Barat"], ["jateng", "Jawa Tengah"], ["jatim", "Jawa Timur"],
      ["sumut", "Sumatera Utara"], ["sumbar", "Sumatera Barat"], ["sumsel", "Sumatera Selatan"],
      ["sulsel", "Sulawesi Selatan"], ["sulut", "Sulawesi Utara"], ["sulteng", "Sulawesi Tengah"],
      ["sultra", "Sulawesi Tenggara"], ["sulbar", "Sulawesi Barat"],
      ["kaltim", "Kalimantan Timur"], ["kalbar", "Kalimantan Barat"], ["kalsel", "Kalimantan Selatan"],
      ["kalteng", "Kalimantan Tengah"], ["kalut", "Kalimantan Utara"], ["kaltara", "Kalimantan Utara"],
      ["kepri", "Kepulauan Riau"], ["malut", "Maluku Utara"],
      ["ntb", "Nusa Tenggara Barat"], ["ntt", "Nusa Tenggara Timur"],
      ["babel", "Bangka Belitung"]
    ];
    for (const [abbr, full] of indoProvMap) {
      a = a.replace(new RegExp(`(^|[,\\s])\\b${abbr}\\b\\.?(?=[,\\s\\d]|$)`, "gi"), `$1${full}`);
    }
    a = a.replace(/(^|[,\s])\bd\.?i\.?y\b\.?(?=[,\s\d]|$)/gi, '$1DI Yogyakarta');
    a = a.replace(/(^|[,\s\/])\brt\.?\s*(\d+)/gi, '$1Rukun Tetangga $2');
    a = a.replace(/(^|[,\s\/])\brw\.?\s*(\d+)/gi, '$1Rukun Warga $2');
  }
  a = a.replace(/(^|[,\s])gg\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Gang ');
  a = a.replace(/(^|[,\s])komp\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Komplek ');
  a = a.replace(/(^|[,\s])kompl\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Komplek ');
  a = a.replace(/(^|[,\s])kav\b\.?\s*(?=[A-Za-z0-9])/gi, '$1Kavling ');
  a = a.replace(/(^|[,\s])kel\b\.?\s*(?=[A-Za-z])/gi, '$1Kelurahan ');
  a = a.replace(/(^|[,\s])kec\b\.?\s*(?=[A-Za-z])/gi, '$1Kecamatan ');
  a = a.replace(/(^|[,\s])kab\b\.?\s*(?=[A-Za-z])/gi, '$1Kabupaten ');
  a = a.replace(/(^|[,\s])prov\b\.?\s*(?=[A-Za-z])/gi, '$1Provinsi ');
  a = a.replace(/(^|[,\s])prop\b\.?\s*(?=[A-Za-z])/gi, '$1Provinsi ');
  a = a.replace(/\bk(?:ws|aw)\.?\s*ind(?:ustri)?\.?/gi, 'Kawasan Industri');
  a = a.replace(/\brt\.?\s*(\d+)\s*(?:[\/,\-]|\s)*rw\.?\s*(\d+)/gi, 'Rukun Tetangga $1 Rukun Warga $2');
  a = a.replace(/\brukun\s+tetangga\s+(\d+)\s*\/\s*rukun\s+warga\s+(\d+)/gi, 'Rukun Tetangga $1 Rukun Warga $2');
  a = a.replace(/(^|[,\s])d\.?k\.?i\.?\s+jakarta\b/gi, '$1DKI Jakarta');
  a = a.replace(/(^|[,\s])d\.?i\.?\s+yogyakarta\b/gi, '$1DI Yogyakarta');

  // ==========================================
  // 11. United Kingdom & Ireland County Abbreviations
  // ==========================================
  if (cLower.includes('united kingdom') || cLower.includes('england') || cLower.includes('scotland') || cLower.includes('wales') || cLower.includes('ireland') || /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(a) || /\b(?:beds|berks|bucks|cambs|derbys|glos|hants|herts|lancs|leics|lincs|middx|northants|notts|oxon|staffs|warks|wilts|worcs|yorks|shrops|warwicks|herefs|gloucs|northumb|w\.?\s*mids|s\.?\s*yorks|w\.?\s*yorks|n\.?\s*yorks|co\.?\s+(?:durham|antrim|armagh|down|fermanagh|londonderry|tyrone|cork|dublin|galway|kerry|kildare|clare|mayo|meath|wexford|wicklow|limerick|tipperary|donegal))\b/i.test(a)) {
    const ukCounties = [
      ["beds", "Bedfordshire"], ["berks", "Berkshire"], ["bucks", "Buckinghamshire"],
      ["cambs", "Cambridgeshire"], ["ches", "Cheshire"], ["derbys", "Derbyshire"],
      ["glos", "Gloucestershire"], ["gloucs", "Gloucestershire"],
      ["hants", "Hampshire"], ["herts", "Hertfordshire"], ["herefs", "Herefordshire"],
      ["lancs", "Lancashire"], ["leics", "Leicestershire"], ["lincs", "Lincolnshire"],
      ["middx", "Middlesex"], ["northants", "Northamptonshire"], ["northumb", "Northumberland"],
      ["notts", "Nottinghamshire"], ["oxon", "Oxfordshire"], ["salop", "Shropshire"],
      ["shrops", "Shropshire"], ["staffs", "Staffordshire"], ["warks", "Warwickshire"],
      ["warwicks", "Warwickshire"], ["wilts", "Wiltshire"], ["worcs", "Worcestershire"],
      ["yorks", "Yorkshire"]
    ];
    for (const [abbr, full] of ukCounties) {
      a = a.replace(new RegExp(`\\b${abbr}\\b\\.?`, "gi"), full);
    }
    a = a.replace(/\bco\.?\s+(durham|antrim|armagh|down|fermanagh|londonderry|tyrone|cork|dublin|galway|kerry|kildare|clare|mayo|meath|wexford|wicklow|limerick|tipperary|donegal)\b/gi, (_, county) => `County ${county.charAt(0).toUpperCase() + county.slice(1).toLowerCase()}`);
    a = a.replace(/\bgt\.?\s+(manchester|london|yarmouth)\b/gi, (_, place) => `Great ${place.charAt(0).toUpperCase() + place.slice(1).toLowerCase()}`);
    a = a.replace(/\bn\.?\s*ireland\b/gi, "Northern Ireland");
    a = a.replace(/\b(?:w\.?\s*mids|west\s*mids)\b\.?/gi, "West Midlands");
    a = a.replace(/\b(?:s\.?\s*yorks)\b\.?/gi, "South Yorkshire");
    a = a.replace(/\b(?:w\.?\s*yorks)\b\.?/gi, "West Yorkshire");
    a = a.replace(/\b(?:n\.?\s*yorks)\b\.?/gi, "North Yorkshire");
    a = a.replace(/\b(?:e\.?\s*sussex)\b\.?/gi, "East Sussex");
    a = a.replace(/\b(?:w\.?\s*sussex)\b\.?/gi, "West Sussex");
  }

  // ==========================================
  // 12. France Abbreviations
  // ==========================================
  if (cLower.includes('france') || cLower.includes('french') || /\b(?:rue|avenue|boulevard|cedex|z\.?i\.?|z\.?a\.?c?\.?)\b/i.test(a)) {
    a = a.replace(/\b(?:z\.?i)\b\.?/gi, "Zone Industrielle");
    a = a.replace(/\b(?:z\.?a\.?c)\b\.?/gi, "Zone d'Amenagement Concerte");
    a = a.replace(/\b(?:z\.?a)\b\.?/gi, "Zone Artisanale");
    a = a.replace(/(^|[,\s])bd\.?\s+(?=[A-Za-z])/gi, "$1Boulevard ");
    a = a.replace(/(^|[,\s])imp\.?\s+(?=[A-Za-z])/gi, "$1Impasse ");
    a = a.replace(/(^|[,\s])all\.?\s+(?=[A-Za-z])/gi, "$1Allee ");
    a = a.replace(/(^|[,\s])ch\.?\s+(?=[A-Za-z])/gi, "$1Chemin ");
    a = a.replace(/(^|[,\s])rte\.?\s+(?=[A-Za-z0-9])/gi, "$1Route ");
    a = a.replace(/(^|[,\s])b[aâ]t\.?\s+(?=[A-Za-z0-9])/gi, "$1Batiment ");
    a = a.replace(/\bb\.?p\.?\s*(?=\d)/gi, "Boite Postale ");
    a = a.replace(/(^|[,\s])r\.\s+(?=[A-Za-z])/gi, "$1Rue ");
  }

  // ==========================================
  // 13. South Africa & India Abbreviations & State/Province Expansions
  // ==========================================
  if (cLower.includes('south africa') || cLower.includes('southafrica')) {
    a = a.replace(/,\s*\b(?:gp)\b\.?/gi, ", Gauteng");
    a = a.replace(/,\s*\b(?:kzn)\b\.?/gi, ", KwaZulu-Natal");
    a = a.replace(/,\s*\b(?:wc)\b\.?/gi, ", Western Cape");
    a = a.replace(/,\s*\b(?:ec)\b\.?/gi, ", Eastern Cape");
    a = a.replace(/,\s*\b(?:nc)\b\.?/gi, ", Northern Cape");
    a = a.replace(/,\s*\b(?:fs)\b\.?/gi, ", Free State");
    a = a.replace(/,\s*\b(?:nw)\b\.?/gi, ", North West");
    a = a.replace(/,\s*\b(?:mp)\b\.?/gi, ", Mpumalanga");
    a = a.replace(/,\s*\b(?:lp)\b\.?/gi, ", Limpopo");
    a = a.replace(/(^|[,\s])(?:pvt\s*bag|private\s*bag|p\/bag)\s*([A-Za-z0-9]+)?/gi, "$1Private Bag $2");
    a = a.replace(/\bext\b\.?\s*(?=\d)/gi, "Extension ");
    a = a.replace(/\bcnr\b\.?\s+(?=[A-Za-z])/gi, "Corner ");
  }
  const isIndiaAddr = cLower.includes('india') || /\b(?:bangalore|bengaluru|mumbai|pune|chennai|hyderabad|delhi|kolkata|ahmedabad|surat|jaipur|noida|gurgaon|gurugram|faridabad|coimbatore|vadodara|rajkot|ludhiana|indore|nagpur|midc|gidc|sidco|riico|maharashtra|karnataka|tamil\s*nadu|gujarat|telangana|uttar\s*pradesh|haryana|punjab|rajasthan)\b/i.test(a);
  if (isIndiaAddr) {
    a = a.replace(/\bm\.?\s*g\.?\s+(?=road\b)/gi, "Mahatma Gandhi ");
    a = a.replace(/\bg\.?\s*t\.?\s+(?=road\b)/gi, "Grand Trunk ");
    a = a.replace(/\bs\.?\s*v\.?\s+(?=road\b)/gi, "Swami Vivekananda ");
    a = a.replace(/\bj\.?\s*l\.?\s*n\.?\s+(?=marg\b)/gi, "Jawaharlal Nehru ");
    a = a.replace(/\bm\.?i\.?d\.?c\b\.?/gi, "Maharashtra Industrial Development Corporation");
    a = a.replace(/\bg\.?i\.?d\.?c\b\.?/gi, "Gujarat Industrial Development Corporation");
    a = a.replace(/\bs\.?i\.?d\.?c\.?o\b\.?/gi, "Small Industries Development Corporation");
    a = a.replace(/\br\.?i\.?i\.?c\.?o\b\.?/gi, "Rajasthan State Industrial Development and Investment Corporation");
    a = a.replace(/\b(?:sy|s)\.?\s*no\.?\s*(?=\d)/gi, "Survey Number ");
    a = a.replace(/\bsr\.?\s*no\.?\s*(?=\d)/gi, "Serial Number ");
    a = a.replace(/(^|[,\s])opp\.?\s+(?=[A-Za-z0-9])/gi, "$1Opposite ");
    a = a.replace(/(^|[,\s])b\/h\s+(?=[A-Za-z0-9])/gi, "$1Behind ");
    a = a.replace(/\bn\.?\s*h\.?\s*(?=\d)/gi, "National Highway ");
    a = a.replace(/\bs\.?\s*h\.?\s*(?=\d)/gi, "State Highway ");
    a = a.replace(/(^|[,\s])tal\.?\s+(?=[A-Za-z])/gi, "$1Taluka ");
    a = a.replace(/(^|[,\s])ph\.?\s*(?=\d|[IVX]+\b)/gi, "$1Phase ");
    a = a.replace(/(^|[,\s])indl\.?\s*area\b/gi, "$1Industrial Area");
    a = a.replace(/(^|[,\s])indl\.?\s*est\.?\b/gi, "$1Industrial Estate");
    a = a.replace(/,\s*\b(?:mh)\b\.?/gi, ", Maharashtra");
    a = a.replace(/,\s*\b(?:ka)\b\.?/gi, ", Karnataka");
    a = a.replace(/,\s*\b(?:tn)\b\.?/gi, ", Tamil Nadu");
    a = a.replace(/,\s*\b(?:gj)\b\.?/gi, ", Gujarat");
    a = a.replace(/,\s*\b(?:dl)\b\.?/gi, ", Delhi");
    a = a.replace(/,\s*\b(?:up)\b\.?/gi, ", Uttar Pradesh");
    a = a.replace(/,\s*\b(?:wb)\b\.?/gi, ", West Bengal");
    a = a.replace(/,\s*\b(?:ts)\b\.?/gi, ", Telangana");
    a = a.replace(/,\s*\b(?:ap)\b\.?/gi, ", Andhra Pradesh");
    a = a.replace(/,\s*\b(?:hr)\b\.?/gi, ", Haryana");
    a = a.replace(/,\s*\b(?:pb)\b\.?/gi, ", Punjab");
    a = a.replace(/,\s*\b(?:rj)\b\.?/gi, ", Rajasthan");
    a = a.replace(/,\s*\b(?:kl)\b\.?/gi, ", Kerala");
    a = a.replace(/,\s*\b(?:mp)\b\.?/gi, ", Madhya Pradesh");
    a = a.replace(/,\s*\b(?:od|or)\b\.?/gi, ", Odisha");
    a = a.replace(/,\s*\b(?:br)\b\.?/gi, ", Bihar");
    a = a.replace(/,\s*\b(?:jh)\b\.?/gi, ", Jharkhand");
    a = a.replace(/,\s*\b(?:cg)\b\.?/gi, ", Chhattisgarh");
    a = a.replace(/,\s*\b(?:uk|ut)\b\.?/gi, ", Uttarakhand");
    a = a.replace(/,\s*\b(?:hp)\b\.?/gi, ", Himachal Pradesh");
    a = a.replace(/,\s*\b(?:as)\b\.?/gi, ", Assam");
    a = a.replace(/,\s*\b(?:ga)\b\.?/gi, ", Goa");
    a = a.replace(/,\s*\b(?:ch)\b\.?/gi, ", Chandigarh");
  }

  // ==========================================
  // 14. Poland, Czech Republic & Slovakia Abbreviations
  // ==========================================
  if (isPolishAddr) {
    a = a.replace(/(^|[,\s])ul\.?\s+(?=[A-ZŻŹĆĄŚĘŁÓŃa-z0-9])/g, "$1Ulica ");
    a = a.replace(/(^|[,\s])al\.?\s+(?=[A-ZŻŹĆĄŚĘŁÓŃa-z0-9])/g, "$1Aleja ");
    a = a.replace(/(^|[,\s])os\.?\s+(?=[A-ZŻŹĆĄŚĘŁÓŃa-z0-9])/g, "$1Osiedle ");
    a = a.replace(/(^|[,\s])pow\.?\s+(?=[A-ZŻŹĆĄŚĘŁÓŃa-z])/g, "$1Powiat ");
    a = a.replace(/(^|[,\s])woj\.?\s+(?=[A-ZŻŹĆĄŚĘŁÓŃa-z])/g, "$1Wojewodztwo ");
    a = a.replace(/(^|[,\s])lok\.?\s*(?=\d|[A-Za-z])/gi, "$1Lokal ");
  }
  if (cLower.includes('czech') || cLower.includes('slovak') || /\b(?:praha|brno|ostrava|bratislava|kosice|n[aá]m\.|t[rř]\.)\b/i.test(a)) {
    a = a.replace(/(^|[,\s])ul\.?\s+(?=[A-Za-z0-9\u00C0-\u024F])/g, cLower.includes('slovak') ? "$1Ulica " : "$1Ulice ");
    a = a.replace(/(^|[,\s])n[aá]m\.?\s+(?=[A-Za-z0-9\u00C0-\u024F])/gi, "$1Namesti ");
    a = a.replace(/(^|[,\s])t[rř]\.?\s+(?=[A-Za-z0-9\u00C0-\u024F])/gi, "$1Trida ");
    a = a.replace(/(^|[,\s])č\.?\s*p\.?\s*(?=\d)/gi, "$1Cislo Popisne ");
  }

  // ==========================================
  // 15. Netherlands & Belgium Abbreviations
  // ==========================================
  if (isDutchOrBelgianAddr) {
    a = a.replace(/(^|[,\s])str\.?\s+(?=[A-Za-z0-9])/gi, "$1Straat ");
    a = a.replace(/([a-zA-Z]+)str\b\.?(?=\s*\d|\s*,|\s*$)/gi, "$1straat");
    a = a.replace(/(^|[,\s])wg\.?\s+(?=[A-Za-z])/gi, "$1Weg ");
    a = a.replace(/(^|[,\s])geb\.?\s+(?=[A-Za-z0-9])/gi, "$1Gebouw ");
    a = a.replace(/(^|[,\s])verd\.?\s*(?=\d)/gi, "$1Verdieping ");
    a = a.replace(/\bind\.?\s*terrein\b/gi, "Industrieterrein");
  }

  // ==========================================
  // 16. Austria & Switzerland State / Canton Abbreviations
  // ==========================================
  if (cLower.includes('austria') || /[öo]sterreich/i.test(a)) {
    a = a.replace(/,\s*\bn[öo]\.?(?=[,\s]|$)/gi, ", Niederösterreich");
    a = a.replace(/,\s*\bo[öo]\.?(?=[,\s]|$)/gi, ", Oberösterreich");
    a = a.replace(/,\s*\bstmk\b\.?/gi, ", Steiermark");
    a = a.replace(/,\s*\bktn\b\.?/gi, ", Kärnten");
    a = a.replace(/,\s*\bsbg\b\.?/gi, ", Salzburg");
    a = a.replace(/,\s*\bvbg\b\.?/gi, ", Vorarlberg");
    a = a.replace(/,\s*\bbgld\b\.?/gi, ", Burgenland");
  }
  if (cLower.includes('switzerland') || /\b(?:schweiz|suisse|svizzera|zurich|zürich|geneva|basel|bern)\b/i.test(a)) {
    a = a.replace(/(^|[,\s])ch\.?\s+(?=[A-Za-z])/gi, "$1Chemin ");
    const swissCantons = [
      ["zh", "Zürich"], ["be", "Bern"], ["lu", "Luzern"], ["zg", "Zug"],
      ["so", "Solothurn"], ["bs", "Basel-Stadt"], ["bl", "Basel-Landschaft"],
      ["sh", "Schaffhausen"], ["sg", "St. Gallen"], ["ag", "Aargau"],
      ["tg", "Thurgau"], ["ti", "Ticino"], ["vd", "Vaud"], ["vs", "Valais"],
      ["ne", "Neuchâtel"], ["ge", "Genève"], ["fr", "Fribourg"]
    ];
    for (const [abbr, full] of swissCantons) {
      a = a.replace(new RegExp(`,\\s*\\b${abbr}\\b\\.?`, "gi"), `, ${full}`);
    }
  }

  // ==========================================
  // 17. Portugal, Brazil & Latin America Abbreviations
  // ==========================================
  if (isPortugueseOrBrazil) {
    a = a.replace(/(^|[,\s])r\.?\s+(?=[A-ZÁÂÃÉÊÍÓÔÕÚÇ][a-z])/g, "$1Rua ");
    a = a.replace(/(^|[,\s])p[çc]a?\.?\s+(?=[A-Za-z\u00C0-\u024F])/gi, "$1Praça ");
    a = a.replace(/(^|[,\s])estr\.?\s+(?=[A-Za-z\u00C0-\u024F])/gi, "$1Estrada ");
    a = a.replace(/(^|[,\s])rod\.?\s+(?=[A-Za-z0-9\u00C0-\u024F])/gi, "$1Rodovia ");
    a = a.replace(/\bdist\.?\s*ind(?:ustrial)?\.?/gi, "Distrito Industrial");
    a = a.replace(/(^|[,\s])cj\.?\s*(?=\d|[A-Za-z])/gi, "$1Conjunto ");
    if (cLower.includes('brazil') || cLower.includes('brasil') || /\b(?:rodovia|s[aã]o\s*paulo|rio\s*de\s*janeiro|belo\s*horizonte|curitiba)\b/i.test(a)) {
      const brStates = [
        ["sp", "São Paulo"], ["rj", "Rio de Janeiro"], ["mg", "Minas Gerais"],
        ["rs", "Rio Grande do Sul"], ["pr", "Paraná"], ["sc", "Santa Catarina"],
        ["ba", "Bahia"], ["pe", "Pernambuco"], ["ce", "Ceará"],
        ["go", "Goiás"], ["df", "Distrito Federal"], ["es", "Espírito Santo"],
        ["mt", "Mato Grosso"], ["ms", "Mato Grosso do Sul"]
      ];
      for (const [abbr, full] of brStates) {
        a = a.replace(new RegExp(`,\\s*\\b${abbr}\\b\\.?`, "gi"), `, ${full}`);
      }
    }
  }
  if (isSpanishOrLatam && !cLower.includes('spain') && !cLower.includes('espana') && !cLower.includes('españa')) {
    a = a.replace(/(^|[,\s])col\.?\s+(?=[A-Za-z\u00C0-\u024F])/gi, "$1Colonia ");
    a = a.replace(/(^|[,\s])fracc\.?\s+(?=[A-Za-z\u00C0-\u024F])/gi, "$1Fraccionamiento ");
    a = a.replace(/(^|[,\s])cd\.?\s+(?=[A-ZÁÉÍÓÚÑ][a-z])/g, "$1Ciudad ");
    a = a.replace(/(^|[,\s])edo\.?\s+(?=[A-Za-z\u00C0-\u024F])/gi, "$1Estado ");
    a = a.replace(/(^|[,\s])mpio\.?\s+(?=[A-Za-z\u00C0-\u024F])/gi, "$1Municipio ");
    a = a.replace(/(^|[,\s])del\.?\s+(?=[A-ZÁÉÍÓÚÑ][a-z])/g, "$1Delegacion ");
    a = a.replace(/(^|[,\s])mza\.?\s*(?=\d|[A-Za-z])/gi, "$1Manzana ");
    a = a.replace(/(^|[,\s])lte\.?\s*(?=\d|[A-Za-z])/gi, "$1Lote ");
    a = a.replace(/(^|[,\s])prol\.?\s+(?=[A-Za-z\u00C0-\u024F])/gi, "$1Prolongacion ");
    a = a.replace(/(^|[,\s])calz\.?\s+(?=[A-Za-z\u00C0-\u024F])/gi, "$1Calzada ");
    a = a.replace(/\bp(?:que)?\.?\s*ind(?:ustrial)?\.?/gi, "Parque Industrial");
    a = a.replace(/(^|[,\s])carr\.?\s+(?=[A-Za-z\u00C0-\u024F])/gi, "$1Carretera ");
    if (cLower.includes('mexico') || cLower.includes('méxico') || /\b(?:colonia|fraccionamiento|cdmx|monterrey|guadalajara|quer[eé]taro)\b/i.test(a)) {
      const mxStates = [
        ["cdmx", "Ciudad de Mexico"], ["edomex", "Estado de Mexico"],
        ["nl", "Nuevo Leon"], ["jal", "Jalisco"], ["gto", "Guanajuato"],
        ["qro", "Queretaro"], ["pue", "Puebla"], ["bc", "Baja California"],
        ["son", "Sonora"], ["coah", "Coahuila"], ["chih", "Chihuahua"],
        ["tamps", "Tamaulipas"]
      ];
      for (const [abbr, full] of mxStates) {
        a = a.replace(new RegExp(`,\\s*\\b${abbr}\\b\\.?`, "gi"), `, ${full}`);
      }
    }
  }

  // ==========================================
  // 18. Türkiye, Romania & Hungary Abbreviations
  // ==========================================
  if (cLower.includes('türkiye') || cLower.includes('turkiye') || cLower.includes('turkey') || cLower.includes('turkiey') || /\b(?:mah\.?|mh\.?|mahallesi|mahalle|cad\.?|cd\.?|caddesi|cadde|sok\.?|sk\.?|sokak|sokagi|sokağı|bulv?\.?|blv\.?|bulvari|bulvarı|osb|san\.?\s*sit\.?|istanbul|ankara|izmir|bursa|antalya|adana|konya|gaziantep|kocaeli|mersin|diyarbakir|kayseri|eskisehir|samsun|denizli|sakarya|mugla|trabzon|silivri)\b/i.test(a)) {
    a = a.replace(/\b(?:cad|cd)\b\.?/gi, "Caddesi");
    a = a.replace(/\b(?:sok|sk)\b\.?/gi, "Sokak");
    a = a.replace(/\b(?:bulv?|blv)\b\.?/gi, "Bulvari");
    a = a.replace(/\b(?:mah|mh)\b\.?/gi, "Mahallesi");
    a = a.replace(/\bmahalle\b/gi, "Mahallesi");
    a = a.replace(/\bmyd\b\.?/gi, "Meydani");
    a = a.replace(/\b(?:ckm|çkm)\b\.?/gi, "Cikmazi");
    a = a.replace(/\bkvs\b\.?/gi, "Kavsagi");
    a = a.replace(/\bgct\b\.?/gi, "Gecidi");
    a = a.replace(/\bi[şs]\s*mrk\b\.?/gi, "Is Merkezi");
    a = a.replace(/\bsit\b\.?(?!\s*sitesi\b)/gi, "Sitesi");
    a = a.replace(/\b(?:apt|ap)\b\.?/gi, "Apartmani");
    a = a.replace(/\bosb\b/gi, "Organize Sanayi Bolgesi");
    a = a.replace(/\bsan\.?\s*sit\.?/gi, "Sanayi Sitesi");
    a = a.replace(/(^|[,\s])(?:\bkat|\bk)[:.]?\s*(\d{1,3})\b/gi, (m, p1, num) => `${p1}${toOrdinalFloor(num)}`);
    a = a.replace(/(^|[,\s])(?:\bdaire|\bd)[:.]?\s*(\d{1,4}[A-Za-z]?)\b/gi, "$1Apartment $2");
    a = a.replace(/\bblk\b\.?/gi, "Block");
  }
  if (cLower.includes('romania') || /\b(?:bucure[sş]ti|bucharest|jud\.?|bd\.?|cal\.)\b/i.test(a)) {
    a = a.replace(/(^|[,\s])str\.?\s+(?=[A-Za-z\u00C0-\u024F])/gi, "$1Strada ");
    a = a.replace(/(^|[,\s])bd\.?\s+(?=[A-Za-z\u00C0-\u024F])/gi, "$1Bulevardul ");
    a = a.replace(/(^|[,\s])cal\.?\s+(?=[A-Za-z\u00C0-\u024F])/gi, "$1Calea ");
    a = a.replace(/(^|[,\s])jud\.?\s+(?=[A-Za-z\u00C0-\u024F])/gi, "$1Judetul ");
  }
  if (cLower.includes('hungary') || /\b(?:budapest|debrecen|krt\.?|utca)\b/i.test(a)) {
    a = a.replace(/(^|[,\s])u\.?\s+(?=\d|[A-Za-z])/gi, "$1Utca ");
    a = a.replace(/(^|[,\s])krt\.?\s+(?=\d|[A-Za-z])/gi, "$1Korut ");
  }

  // ==========================================
  // 19. United Arab Emirates & Middle East Abbreviations
  // ==========================================
  if (cLower.includes('united arab emirates') || cLower.includes('saudi arabia') || cLower.includes('qatar') || cLower.includes('bahrain') || cLower.includes('oman') || cLower.includes('kuwait') || /\b(?:dubai|abu\s*dhabi|sharjah|jebel\s*ali|riyadh|jeddah|dammam|jafza)\b/i.test(a)) {
    a = a.replace(/\bind\.?\s*area\b/gi, "Industrial Area");
    a = a.replace(/\bjafza\b/gi, "Jebel Ali Free Zone");
    a = a.replace(/,\s*\bdxb\b/gi, ", Dubai");
    a = a.replace(/,\s*\bauh\b/gi, ", Abu Dhabi");
    a = a.replace(/,\s*\bshj\b/gi, ", Sharjah");
  }

  // ==========================================
  // 20. East Asia (Hong Kong, Japan, China), Nordics, Greece & CIS
  // ==========================================
  if (cLower.includes('hong kong') || /\b(?:kowloon|hong\s*kong|tsuen\s*wan|kwun\s*tong|sha\s*tin|tuen\s*mun|yuen\s*long|new\s*territories|kln|n\.t\.)\b/i.test(a)) {
    a = a.replace(/(?:^|[,\s])\bn\.?\s*t\.?(?=[,\s]|$)/gi, (m) => (m.startsWith(",") ? ", " : " ") + "New Territories");
    a = a.replace(/\bkln\b\.?/gi, "Kowloon");
    a = a.replace(/\bfty\b\.?/gi, "Factory");
    a = a.replace(/\bmsn\b\.?/gi, "Mansion");
  }
  if (cLower.includes('japan') || /\b(?:tokyo|osaka|nagoya|yokohama|kyoto|kobe|fukuoka|sapporo|pref\.|ku\b|chome\b)\b/i.test(a)) {
    a = a.replace(/\bpref\b\.?/gi, "Prefecture");
  }
  if (cLower.includes('china') || cLower.includes('taiwan') || /\b(?:e\.?t\.?d\.?z\.?|e\.?d\.?z\.?|h\.?t\.?z\.?)\b/i.test(a)) {
    a = a.replace(/\be\.?t\.?d\.?z\b\.?/gi, "Economic and Technological Development Zone");
    a = a.replace(/\be\.?d\.?z\b\.?/gi, "Economic Development Zone");
    a = a.replace(/\bh\.?t\.?z\b\.?/gi, "High-Tech Zone");
  }
  if (cLower.includes('sweden') || cLower.includes('norway') || cLower.includes('denmark') || cLower.includes('finland') || /\b(?:stockholm|g[oö]teborg|gothenburg|malm[oö]|oslo|copenhagen|k[oø]benhavn|helsinki|tampere)\b/i.test(a)) {
    a = a.replace(/\bind\.?\s*omr(?:[aå]de)?\.?/gi, "Industriområde");
  }
  if (cLower.includes('greece') || /\b(?:athens|athina|thessaloniki|leof\.|od\.)\b/i.test(a)) {
    a = a.replace(/(^|[,\s])od\.?\s+(?=[A-Za-z])/gi, "$1Odos ");
    a = a.replace(/(^|[,\s])leof\.?\s+(?=[A-Za-z])/gi, "$1Leoforos ");
  }
  if (cLower.includes('russia') || cLower.includes('ukraine') || cLower.includes('belarus') || cLower.includes('kazakhstan') || cLower.includes('uzbekistan') || /\b(?:moscow|moskva|kyiv|kiev|minsk|astana|tashkent|pr-t|obl\.)\b/i.test(a)) {
    a = a.replace(/(^|[,\s])ul\.?\s+(?=[A-Za-z0-9])/gi, cLower.includes('ukraine') ? "$1Vulytsya " : "$1Ulitsa ");
    a = a.replace(/(^|[,\s])(?:pr-t|pr)\.?\s+(?=[A-Za-z])/gi, "$1Prospekt ");
    a = a.replace(/(^|[,\s])per\.?\s+(?=[A-Za-z])/gi, "$1Pereulok ");
    a = a.replace(/\bobl\b\.?/gi, "Oblast");
  }

  // Clean up any double spaces introduced
  a = a.replace(/\s+/g, " ").trim();

  return a;
}

/**
 * Repairs blindly separated commas in addresses:
 * 1. Multi-word park names (e.g. "Argent, Trade, Park" or "Argent, Trade Park" -> "Argent Trade Park")
 * 2. Detached street suffixes (e.g. "Downing, Street" -> "Downing Street", "Pump, Lane" -> "Pump Lane")
 * 3. Directional prefixes (e.g. "North, Main Street" -> "North Main Street", "Great, Western Highway" -> "Great Western Highway")
 * 4. Multi-word cities, states, counties (e.g. "West, Sussex" -> "West Sussex", "Kuala, Lumpur" -> "Kuala Lumpur")
 * 5. Accidental comma between building number and street name (e.g. "604, Progress Drive" -> "604 Progress Drive")
 */
function isStandaloneStateOrCounty(word) {
  if (!word || typeof word !== "string") return false;
  return /^(?:Victoria|Queensland|Tasmania|Australian\s*Capital\s*Territory|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|Ohio|Oklahoma|Oregon|Pennsylvania|Tennessee|Texas|Utah|Vermont|Virginia|Washington|Wisconsin|Wyoming|District\s*of\s*Columbia|Ontario|Quebec|Alberta|Manitoba|Saskatchewan|Nova\s*Scotia|New\s*Brunswick|Newfoundland|Prince\s*Edward\s*Island|Canterbury|Waikato|Bay\s*of\s*Plenty|Otago|Taranaki|Southland|Northland|Marlborough|Tasman|Manawatu|Essex|Kent|Surrey|Lancashire|Yorkshire|Cheshire|Hampshire|Berkshire|Hertfordshire|Middlesex|Gloucestershire|Warwickshire|Devon|Dorset|Somerset|Oxfordshire|Cambridgeshire|Buckinghamshire|Staffordshire|Derbyshire|Nottinghamshire|Lincolnshire|Northamptonshire|Norfolk|Suffolk|Wiltshire|Worcestershire|Cornwall|Cumbria|Northumberland|Maharashtra|Karnataka|Tamil\s*Nadu|Gujarat|Uttar\s*Pradesh|Telangana|Andhra\s*Pradesh|Punjab|Haryana|Rajasthan|Madhya\s*Pradesh|Bihar|Kerala|Odisha|Jharkhand|Assam|Delhi|Selangor|Johor|Penang|Perak|Kedah|Pahang|Negeri\s*Sembilan|Melaka|Terengganu|Kelantan|Sarawak|Sabah|Perlis|Gauteng|Limpopo|Mpumalanga|Free\s*State|Dublin|Cork|Galway|Kildare|Meath|Limerick|Kerry|Wicklow|Clare|Tipperary|Wexford|Donegal|Madrid|Barcelona|Valencia|Sevilla|Zaragoza|Malaga|Málaga|Murcia|Bilbao|Alicante|Cordoba|Córdoba|Valladolid|Bavaria|Bayern|Hessen|Lombardia|Lazio|Veneto|Piemonte|Toscana|Campania|Sicilia|Puglia|Liguria)$/i.test(word.trim());
}

function normalizeAddressCommas(str) {
  if (!str) return "";
  let s = str.replace(/\b(\d{1,4}),(\d{1,2})\b/g, "$1__DEC_COMMA__$2");
  s = s.replace(/\s+,/g, ",");
  s = s.replace(/,\s*,+/g, ", ");
  s = s.replace(/,\s*/g, ", ");
  s = s.replace(/__DEC_COMMA__/g, ",");
  return s.replace(/\b(Kilometer|Km\.?)\s+(\d{1,4}),\s+(\d{1,2})\b/gi, "$1 $2,$3");
}

function repairBlindlySeparatedCommas(addr) {
  if (!addr) return "";
  let a = addr;
  a = normalizeTaiwanDivisions(a);

  // 1. Multi-word Industrial / Trade / Business / Science / Technology / Retail / Enterprise Parks & Estates
  const parkTypes = "Park|Estate|Zone|District|Centre|Center|Area";
  const parkQualifiers = "Trade|Trading|Industrial|Business|Technology|Tech|Science|Commercial|Retail|Enterprise|Logistics";

  const premisePrefixGuard = "(?<!\\b(?:Unit|Lot|Plot|Suite|Ste|Building|Bldg|Floor|Flr?|Level|Block|Blk|Blok|Apartment|Apt|Flat|Shed|Warehouse|Factory|Kav|Kavling|Room|Rm|No|Number)\\s+)";
  // "Argent, Trade, Park" -> "Argent Trade Park"
  a = a.replace(new RegExp(`${premisePrefixGuard}\\b([A-Za-z][A-Za-z0-9]*),\\s*(${parkQualifiers}),\\s*(${parkTypes})\\b`, "gi"), "$1 $2 $3");
  // "Argent, Trade Park" -> "Argent Trade Park"
  a = a.replace(new RegExp(`${premisePrefixGuard}\\b([A-Za-z][A-Za-z0-9]*),\\s*(${parkQualifiers})\\s+(${parkTypes})\\b`, "gi"), "$1 $2 $3");
  // "Trade, Park" -> "Trade Park"
  a = a.replace(new RegExp(`\\b(${parkQualifiers}),\\s*(${parkTypes})\\b`, "gi"), "$1 $2");

  // 2. Repair street suffix detached from previous word: "Downing, Street" -> "Downing Street", "Pump, Lane" -> "Pump Lane"
  const streetSuffixes = "Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill";
  a = a.replace(new RegExp(`\\b([A-Za-z]+),\\s+(${streetSuffixes})\\b(?!\\s+(?:East|West|North|South|\\d+))`, "gi"), (m, p1, p2) => {
    if (new RegExp(`^(?:${streetSuffixes}|Number|No|Plot|Lot|Unit|Suite|Level|Floor|Block|Section|Sec)$`, "i").test(p1)) return m;
    return `${p1} ${p2}`;
  });

  // Directional street prefixes: "North, Main Street" -> "North Main Street", "Great, Western Highway" -> "Great Western Highway"
  a = a.replace(new RegExp(`\\b(Great|Grand|Old|New|North|South|East|West|Upper|Lower|Central|Little|High|Long|Royal),\\s+([A-Za-z0-9]+(?:\\s+(?:${streetSuffixes}))\\b)`, "gi"), "$1 $2");

  // 3. Multi-word cities, states, counties: "West, Sussex" -> "West Sussex", "Kuala, Lumpur" -> "Kuala Lumpur"
  // Do NOT merge if the directional word is preceded by a park/estate/facility suffix (e.g. "Industrial Estate South, Durham" must NOT become "Estate South Durham")
  const twMultiWordPrefixes = "West|East|North|South|New|Old|Central|Upper|Lower|Greater|Inner|Outer|San|Santa|Los|Las|El|La|Kuala|Hong|Batu|Johor|Petaling|Subang|Shah|George|Cape|Port|Fort|Mount|St\.?|Saint|Yung|Chung|Hsin|Xin|Da|Ta|Nan|Xi|Hsi|Bei|Pei|An|Ren|Jen|Gui|Kuei|Lu|Loo|Ping|Ba|Pa|Yang|Long|Lung|Shan|Guan|Kuan|Ma|Jia|Chia|Qi|Chi|Jiang|Chiang|Zhong|Qian|Chien|Feng|Fong|Ling|Gu|Ku|Zuo|Tso|Hou|Dong|Tung|Xia|Hsia|Liu|Yu|Kao|Gao|Tao|Kee|Miao|Yun|Chang|Hua|Peng|Kin|Lien";
  a = a.replace(new RegExp(`(?<!\\b(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Highway|Close|Terrace|Boulevard|Estate|Park|Zone|Area|District|Sector|Ward|Block|Building|Phase)\\s+)\\b(${twMultiWordPrefixes}),\\s+([A-Za-z0-9]+)`, "gi"), (match, p1, p2) => {
    const compound = `${p1} ${p2}`.toLowerCase();
    const isKnownCompound = /^(?:new\s+york|new\s+jersey|new\s+mexico|new\s+hampshire|new\s+south\s+wales|new\s+zealand|north\s+carolina|south\s+carolina|north\s+dakota|south\s+dakota|west\s+virginia|rhode\s+island|western\s+australia|south\s+australia|northern\s+territory|west\s+sussex|east\s+sussex|north\s+yorkshire|south\s+yorkshire|west\s+yorkshire|western\s+cape|eastern\s+cape|northern\s+cape|north\s+west|west\s+bengal|west\s+midlands|san\s+francisco|san\s+jose|san\s+diego|san\s+antonio|san\s+juan|san\s+mateo|san\s+marcos|san\s+rafael|santa\s+clara|santa\s+barbara|santa\s+monica|santa\s+ana|santa\s+cruz|santa\s+fe|santa\s+rosa|los\s+angeles|las\s+vegas|kuala\s+lumpur|hong\s+kong|batu\s+pahat|johor\s+bahru|petaling\s+jaya|subang\s+jaya|shah\s+alam|george\s+town|port\s+elizabeth|cape\s+town|fort\s+worth|fort\s+wayne|fort\s+lauderdale|salt\s+lake\s+city)$/i.test(compound);
    if (isKnownCompound) return `${p1} ${p2}`;
    if (isStandaloneStateOrCounty(p2)) return match;
    return `${p1} ${p2}`;
  });

  // 4. Premise comma fix: "Unit 2, Argent, Trade Park" -> "Unit 2, Argent Trade Park"
  a = a.replace(/(\b(?:Unit|Suite|Lot|Plot|Building|Bldg|Level|Floor|Block|Flr|Ste|Apt)\s+[A-Za-z0-9\-\/]+),\s+([A-Za-z0-9]+),\s+([A-Za-z0-9]+\s+(?:Park|Estate|Zone|Street|Road|Avenue|Lane|Drive|Way|Place|Court|Highway)\b)/gi, "$1, $2 $3");

  // 5. Remove unwanted comma between bare street number and street name: "604, Progress Drive" -> "604 Progress Drive"
  // Must NOT strip commas after premise indicators like "Number 53-5, Pocheng Road" or "Lot 12, Main Street"
  a = a.replace(/(^|[,\s])(?<!\b(?:number|no\.?|#|section|sec\.?|lane|ln\.?|alley|aly\.?|unit|suite|ste\.?|floor|fl\.?|flr\.?|level|lot|plot|block|blk\.?)\s+)\b(\d{1,5}),\s+([A-Z][a-z0-9\u00C0-\u024F]+(?:\s+[A-Z][a-z0-9\u00C0-\u024F]+)*\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill)\b)/gi, "$1$2 $3");

  // Clean double commas and spaces (preserve decimal commas like "Kilometer 5,5")
  a = normalizeAddressCommas(a);
  a = a.replace(/\s+/g, " ").trim();
  a = normalizeTaiwanDivisions(a);

  return a;
}

/**
 * Ensures clean comma separation across all major address components:
 * 1. Premise indicators (Lot, Plot, Unit, Suite, Bldg, Level, Floor)
 * 2. Street types before suburb / city
 * 3. Industrial / Business parks before city
 * 4. City / Suburb before State / Province / Territory / County globally
 */
function ensureCommaBeforeState(addr) {
  if (!addr) return "";
  let a = addr;
  a = normalizeTaiwanDivisions(a);

  // 1. Ensure comma after premise indicators (Lot, Plot, Unit, Suite, Bldg, Building, Level, Floor, Block, Kav)
  // Only if NOT ALREADY followed by a comma!
  const premiseRegex = /(^|[,\s])\b(lot|plot|unit|suite|ste|bldg|building|floor|fl|flr|level|block|blk|apartment|apt|flat|shed|warehouse|factory|kav|kavling)\s+(\d+[A-Za-z]?(?:[-\/]\d+[A-Za-z]?)?|[A-Za-z](?:\d+)?)(?:\s*(?:&|and)\s*(\d+[A-Za-z]?(?:[-\/]\d+[A-Za-z]?)?|[A-Za-z]))?\s*(?!,)\s+(?=(?:no\.?|nos\.?|number|#)?\s*[A-Za-z0-9])/gi;
  a = a.replace(premiseRegex, (match, p1, type, val1, val2) => {
    const fullVal = val2 ? `${val1} and ${val2}` : val1;
    return `${p1}${type} ${fullVal}, `;
  });

  // 2. Ensure comma after street types when followed by locality/city/town/state
  const streetSuffixes = "(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Caddesi|Bulvari|Sokak|Mahallesi|Strasse|Calle|Avenida|Viale|Corso)";
  const nonStreetLookahead = "(?!\\s+(?:East|West|North|South|Northeast|Northwest|Southeast|Southwest|Extension|Ext|Road|Street|Avenue|Lane|Drive|Place|Close|Court|Terrace|Cres|Dr|Rd|St|Ave|Ln|Blvd|Hwy|Ct|Pl)\\b)";
  const nextWordPattern = "\\s+([A-Z][a-z0-9\\u00C0-\\u024F]*\\b)";
  const streetSepRegex = new RegExp(`\\b(${streetSuffixes})${nonStreetLookahead}${nextWordPattern}`, "g");
  a = a.replace(streetSepRegex, "$1, $2");

  // Ensure comma after Number <digits> when followed by town/district/suburb before state/city
  a = a.replace(/(\bNumber\s+\d+(?:[-/]\d+)?)\s+([A-Z][a-z0-9\u00C0-\u024F]+(?=,\s+[A-Z][a-z0-9\u00C0-\u024F]+))/g, "$1, $2");

  // 2a. Ensure comma after directional street suffixes when followed by locality/city
  // e.g. "County Road West Allenton" -> "County Road West, Allenton"
  const directionalSepRegex = new RegExp(`\\b(${streetSuffixes}\\s+(?:East|West|North|South|Northeast|Northwest|Southeast|Southwest|Extension|Ext))\\s+([A-Z][a-z0-9\\u00C0-\\u024F]+)(?!\\s+(?:Street|Road|Avenue|Lane|Drive|Place|Close|Court|Terrace|Way|Blvd|Hwy)\\b)`, "g");
  a = a.replace(directionalSepRegex, "$1, $2");

  // 2b. Remove unwanted comma between bare street number and street name (e.g. "604, Progress Drive" -> "604 Progress Drive")
  // Must NOT strip commas after premise indicators like "Number 53-5, Pocheng Road" or "Lot 12, Main Street"
  a = a.replace(/(^|[,\s])(?<!\b(?:number|no\.?|#|section|sec\.?|lane|ln\.?|alley|aly\.?|unit|suite|ste\.?|floor|fl\.?|flr\.?|level|lot|plot|block|blk\.?)\s+)\b(\d{1,5}),\s+([A-Z][a-z0-9\u00C0-\u024F]+(?:\s+[A-Z][a-z0-9\u00C0-\u024F]+)*\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Caddesi|Bulvari|Sokak|Strasse|Calle|Avenida|Viale|Corso|Rd|St|Ave|Ln|Dr|Blvd|Hwy|Ct|Pl)\b)/gi, "$1$2 $3");

  // 2c. Ensure clean comma separation across Taiwanese, East Asian, and multi-component premises:
  // Floor -> Premise Number
  a = a.replace(/\b(\d+(?:st|nd|rd|th)?\s+Floor|Floor\s+\d+)\s*(?!,)\s+(?=(?:Number|No\.?|#)?\s*\d)/gi, "$1, ");
  // Lane -> Alley / Section / Road
  a = a.replace(/\b(Lane|Ln\.?)\s+(\d+[A-Za-z]?)\s*(?!,)\s+(?=(?:Alley|Aly\.?|Section|Sec\.?|[A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*\s+(?:Road|Street|Avenue))\b)/gi, "$1 $2, ");
  // Alley -> Section / Road
  a = a.replace(/\b(Alley|Aly\.?)\s+(\d+[A-Za-z]?)\s*(?!,)\s+(?=(?:Section|Sec\.?|[A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*\s+(?:Road|Street|Avenue))\b)/gi, "$1 $2, ");
  // Section -> Road / Street
  a = a.replace(/\b(Section|Sec\.?)\s+(\d+[A-Za-z]?)\s*(?!,)\s+(?=[A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*\s+(?:Road|Street|Avenue)\b)/gi, "$1 $2, ");
  // Road / Street -> District / Township
  a = a.replace(/\b((?:Road|Street|Avenue|Lane|Alley))\s*(?!,)\s+(?=[A-Z][a-z0-9\-]+(?:\s+[A-Z][a-z0-9\-]+)*\s+(?:District|Township|County|Hsien)\b)/gi, "$1, ");

  // 3. Ensure comma before & after Industrial / Business parks & zones
  // Only separate if preceded by a street suffix (e.g. "Main Road Industrial Park" -> "Main Road, Industrial Park")
  // NEVER separate the proper name of the park itself (e.g. "Argent Trade Park", "Cambridge Science Park", "Westwood Business Park")
  a = a.replace(new RegExp(`(\\b${streetSuffixes})\\s+(?<!,\\s*)\\b((?:Industrial|Technology|Business|Science|Tech|Trade|Trading|Commercial|Retail|Enterprise|Logistics)\\s+(?:Park|Estate|Area|Zone|District)|Kawasan\\s+(?:Perindustrian|Industri|Berikat)|Taman\\s+Perindustrian|Poligono\\s+Industrial|Zona\\s+Industriale|Gewerbegebiet)\\b`, "gi"), "$1, $2");
  a = a.replace(/\b((?:Industrial|Technology|Business|Science|Tech|Trade|Trading|Commercial|Retail|Enterprise|Logistics)\s+(?:Park|Estate|Area|Zone|District)(?:\s+(?:North|South|East|West|Central|Upper|Lower))?|Kawasan\s+(?:Perindustrian|Industri|Berikat)|Taman\s+Perindustrian|Poligono\s+Industrial|Zona\s+Industriale|Gewerbegebiet)\s+(?!(?:Road|Street|Avenue|Lane|Drive|Way|Place|Court|Highway|North|South|East|West|Central|Upper|Lower)\b)(?=[A-Z][a-z0-9])/gi, "$1, ");

  // 4. Malaysian / Singapore recognized city hubs
  a = a.replace(/(?<!,\s*)\b(Subang Jaya|Petaling Jaya|Shah Alam|Klang|Kuala Lumpur|Puchong|Cheras|George Town|Johor Bahru|Ipoh|Kota Kinabalu|Kuching|Seremban|Batu Pahat|Pasir Gudang|Iskandar Puteri)\b/gi, ", $1");

  // 4b. Indonesian recognized city hubs (NEVER split after Kabupaten / Kota / Provinsi / Kecamatan / etc.)
  a = a.replace(/(?<!,\s*)(?<!\b(?:Kabupaten|Kota|Kotamadya|Provinsi|Kecamatan|Kelurahan|Desa|Dusun|Dukuh|Kampung|Lingkungan|Jalan|Gang|Komplek|Perumahan)\s+)\b(Jakarta|DKI Jakarta|Surabaya|Bandung|Medan|Semarang|Makassar|Palembang|Tangerang|Bekasi|Depok|Bogor|Batam|Pekanbaru|Bandar Lampung|Malang|Padang|Denpasar|Samarinda|Banjarmasin|Balikpapan|Cikarang|Karawang|Sidoarjo|Gresik|Jepara|Yogyakarta|Solo|Surakarta|Pasuruan|Mojokerto|Serang|Cilegon|Pontianak|Manado|Kudus|Pati|Demak|Purwakarta|Subang|Sukabumi|Tasikmalaya|Cimahi|Salatiga|Magelang|Kediri|Madiun|Jambi|Bengkulu|Pekalongan|Tegal|Purwokerto|Cilacap|Klaten|Sukoharjo|Boyolali)\b/gi, ", $1");

  // 4c. New Zealand recognized cities
  a = a.replace(/(?<!,\s*)\b(Auckland|Christchurch|Hamilton|Tauranga|Dunedin|Lower Hutt|Upper Hutt|Palmerston North|Napier|Porirua|New Plymouth|Rotorua|Whangarei|Invercargill|Nelson|Whanganui|Hastings|Gisborne|Blenheim|Timaru|Taupo|Queenstown|Cambridge)\b/gi, ", $1");

  // 5. Ensure comma before East Asian administrative regions (Township, District, County, Hsien)
  // Handles multi-word / hyphenated districts (e.g. Yung-Kang District, Yung Kang District, San-Min District)
  // MUST NOT insert comma inside multi-word or hyphenated districts like "Yung, Kang District"
  a = a.replace(/(?<![A-Za-z0-9\-,/]\s*)\b((?:[A-Z][a-z0-9\u00C0-\u024F]+(?:[- ][A-Z][a-z0-9\u00C0-\u024F]+)?)\s+(?:Township|District|County|Hsien))\b/g, ", $1");

  // 5b. Ensure comma after District / Township / County / Hsien when followed by City / Town / County / State
  // Exclude "County Road", "County Highway", "County Route", "County Line" in US addresses
  a = a.replace(/\b((?:Township|District|County|Hsien|Borough|Parish))\s+(?!(?:Road|Highway|Route|Line)\b)([A-Z][a-z0-9\u00C0-\u024F]+)/g, "$1, $2");

  // 5c. Ensure comma before "X City" (handling multi-word cities like "New York City", "New Taipei City", "Salt Lake City")
  // MUST NOT insert comma inside two-syllable city names (e.g. "Chia Yi City" -> "Chia, Yi City" or "Hsin Chu City" -> "Hsin, Chu City")
  const eaFirstSyllables = "Yung|San|Chung|Hsin|Xin|Da|Ta|Nan|Xi|Hsi|Bei|Pei|An|Ren|Jen|Gui|Kuei|Lu|Loo|Ping|Ba|Pa|Yang|Long|Lung|Shan|Guan|Kuan|Ma|Jia|Chia|Qi|Chi|Jiang|Chiang|Zhong|Qian|Chien|Feng|Fong|Ling|Gu|Ku|Zuo|Tso|Hou|Dong|Tung|Xia|Hsia|Liu|Yu|Kao|Gao|Tao|Kee|Miao|Yun|Chang|Hua|Peng|Kin|Lien";
  const cityPrefixLookbehind = "New|North|South|East|West|Old|Central|Upper|Lower|Greater|Inner|Outer|Salt|Lake|Ho|Chi|Minh|Kuala|Hong|San|Santa|Los|Las|El|La|" + eaFirstSyllables;
  a = a.replace(new RegExp(`(?<=[A-Za-z0-9\\)])\\s+(?<!,\\s*)(?<!\\b(?:${cityPrefixLookbehind}|${streetSuffixes})\\s+)\\b([A-Z][a-z0-9\\u00C0-\\u024F]+(?:\\s+[A-Z][a-z0-9\\u00C0-\\u024F]+)?\\s+City)\\b(?![\\s\\-]*(?:Road|Street|Avenue|Lane|Drive|Way|Place|Highway))`, "g"), ", $1");

  // Repair accidental commas splitting two-syllable East Asian cities/districts/townships:
  // e.g. "Chia, Yi City" -> "Chiayi City", "Hsin, Chu City" -> "Hsinchu City", "Yung, Kang District" -> "Yung-Kang District"
  a = a.replace(new RegExp(`\\b(${eaFirstSyllables})[-\\s]*,[\\s\\-]*([A-Z][a-z]+\\s+(?:District|Township|County|Hsien|City))\\b`, "g"), '$1-$2');
  a = a.replace(new RegExp(`\\b(${eaFirstSyllables})-[\\s,]+([A-Z][a-z]+\\s+(?:District|Township|County|Hsien|City))\\b`, "g"), '$1-$2');
  a = normalizeTaiwanDivisions(a);

  // Repair accidental commas splitting two-syllable street names:
  // e.g. "Chung, Hua Road" -> "Chung Hua Road", "Chung-, Hua Road" -> "Chung-Hua Road"
  const eaRoadSyllables = "Chung|Zhong|Hsin|Xin|Kuang|Guang|Min|San|Da|Ta|Ren|Jen|Nan|Bei|Pei|Xi|Hsi|Dong|Tung";
  a = a.replace(new RegExp(`\\b(${eaRoadSyllables})[-\\s]*,[\\s\\-]*([A-Z][a-z]+\\s+(?:Road|Street|Avenue|Lane|Alley|Boulevard|Highway))\\b`, "g"), '$1 $2');

  // Repair accidental commas splitting multi-word prefixes: "New, York" -> "New York", "New, Zealand" -> "New Zealand"
  // Do NOT merge if the directional word is a street suffix (e.g. "Main Street East, City", "County Road West, City")
  // or a facility / industrial estate suffix (e.g. "Industrial Estate South, Durham")
  // NEVER strip comma before a standalone state or province (e.g. "Oakleigh South, Victoria" MUST retain comma!)
  a = a.replace(/(?<!\b(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Highway|Close|Terrace|Boulevard|Estate|Park|Zone|Area|District|Sector|Ward|Block|Building|Phase)\s+)\b(New|North|South|East|West|Old|Central|Upper|Lower|Greater|Inner|Outer|San|Santa|Los|Las|El|La)[,\s]+([A-Z][a-z]+)/gi, (match, p1, p2) => {
    const compound = `${p1} ${p2}`.toLowerCase();
    const isKnownCompound = /^(?:new\s+york|new\s+jersey|new\s+mexico|new\s+hampshire|new\s+south\s+wales|new\s+zealand|north\s+carolina|south\s+carolina|north\s+dakota|south\s+dakota|west\s+virginia|rhode\s+island|western\s+australia|south\s+australia|northern\s+territory|west\s+sussex|east\s+sussex|north\s+yorkshire|south\s+yorkshire|west\s+yorkshire|western\s+cape|eastern\s+cape|northern\s+cape|north\s+west|west\s+bengal|west\s+midlands|san\s+francisco|san\s+jose|san\s+diego|san\s+antonio|san\s+juan|san\s+mateo|san\s+marcos|san\s+rafael|santa\s+clara|santa\s+barbara|santa\s+monica|santa\s+ana|santa\s+cruz|santa\s+fe|santa\s+rosa|los\s+angeles|las\s+vegas|kuala\s+lumpur|hong\s+kong|batu\s+pahat|johor\s+bahru|petaling\s+jaya|subang\s+jaya|shah\s+alam|george\s+town|port\s+elizabeth|cape\s+town|fort\s+worth|fort\s+wayne|fort\s+lauderdale|salt\s+lake\s+city)$/i.test(compound);
    if (isKnownCompound) return `${p1} ${p2}`;
    if (isStandaloneStateOrCounty(p2)) return match;
    return `${p1} ${p2}`;
  });

  // 6. Comprehensive global states, provinces, regions, and counties
  const states = [
    // US States
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
    "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
    "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming", "District of Columbia",
    // Australia
    "Victoria", "New South Wales", "Queensland", "Western Australia", "South Australia", "Tasmania", "Northern Territory", "Australian Capital Territory",
    // Canada
    "Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Saskatchewan", "Nova Scotia", "New Brunswick", "Newfoundland", "Prince Edward Island",
    // New Zealand Regions
    "Canterbury", "Waikato", "Bay of Plenty", "Otago", "Hawke's Bay", "Hawkes Bay", "Taranaki", "Southland", "Northland", "Marlborough", "Tasman", "West Coast", "Manawatu",
    // UK Counties
    "Essex", "Kent", "Surrey", "Lancashire", "Yorkshire", "Cheshire", "Hampshire", "Berkshire", "Hertfordshire", "Middlesex", "Gloucestershire", "Warwickshire", "Devon", "Dorset", "Somerset", "Oxfordshire", "Cambridgeshire", "Buckinghamshire", "Staffordshire", "Derbyshire", "Nottinghamshire", "Lincolnshire", "Northamptonshire", "Norfolk", "Suffolk", "Wiltshire", "Worcestershire", "Cornwall", "Cumbria", "Northumberland",
    // India States
    "Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat", "Uttar Pradesh", "Telangana", "Andhra Pradesh", "Punjab", "Haryana", "Rajasthan", "Madhya Pradesh", "West Bengal", "Bihar", "Kerala", "Odisha", "Jharkhand", "Assam", "Delhi",
    // Malaysia States
    "Selangor", "Johor", "Penang", "Perak", "Kedah", "Pahang", "Negeri Sembilan", "Melaka", "Terengganu", "Kelantan", "Sarawak", "Sabah", "Perlis", "Kuala Lumpur", "Putrajaya",
    // Indonesia Provinces
    "West Java", "Central Java", "East Java", "North Sumatra", "West Sumatra", "South Sumatra", "Special Region of Yogyakarta",
    "Jawa Barat", "Jawa Tengah", "Jawa Timur", "Banten", "DKI Jakarta", "DI Yogyakarta", "Bali", "Sumatera Utara", "Sumatera Barat", "Sumatera Selatan", "Riau", "Kepulauan Riau", "Lampung", "Jambi", "Bengkulu", "Bangka Belitung", "Kalimantan Timur", "Kalimantan Barat", "Kalimantan Selatan", "Kalimantan Tengah", "Kalimantan Utara", "Sulawesi Selatan", "Sulawesi Utara", "Sulawesi Tengah", "Sulawesi Tenggara", "Sulawesi Barat", "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Papua", "Maluku", "Aceh",
    // South Africa
    "Gauteng", "Western Cape", "Eastern Cape", "KwaZulu-Natal", "Mpumalanga", "Free State", "Limpopo", "North West", "Northern Cape",
    // Turkey Provinces
    "Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep", "Kocaeli", "Mersin", "Diyarbakir", "Kayseri", "Eskisehir", "Samsun", "Denizli", "Sakarya", "Mugla", "Trabzon",
    // Italy Regions
    "Lombardia", "Lazio", "Veneto", "Piemonte", "Emilia-Romagna", "Toscana", "Campania", "Sicilia", "Puglia", "Liguria", "Marche", "Abruzzo", "Friuli Venezia Giulia", "Trentino-Alto Adige", "Umbria", "Sardegna", "Calabria", "Basilicata", "Molise", "Valle d'Aosta",
    // Germany States
    "Baden-Württemberg", "Bayern", "Brandenburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen", "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
    // Ireland Counties
    "Dublin", "Cork", "Galway", "Kildare", "Meath", "Limerick", "Kerry", "Wicklow", "Clare", "Tipperary", "Wexford", "Donegal",
    // Spain (Provinces & Autonomous Communities)
    "Álava", "Alava", "Albacete", "Alicante", "Alacant", "Almería", "Almeria", "Asturias", "Ávila", "Avila", "Badajoz", "Islas Baleares", "Baleares", "Barcelona", "Burgos", "Cáceres", "Caceres", "Cádiz", "Cadiz", "Cantabria", "Castellón", "Castellon", "Ciudad Real", "Córdoba", "Cordoba", "Cuenca", "Girona", "Gerona", "Granada", "Guadalajara", "Guipúzcoa", "Guipuzcoa", "Gipuzkoa", "Huelva", "Huesca", "Jaén", "Jaen", "A Coruña", "La Coruña", "La Coruna", "La Rioja", "Las Palmas", "León", "Leon", "Lleida", "Lérida", "Lerida", "Lugo", "Madrid", "Málaga", "Malaga", "Murcia", "Navarra", "Ourense", "Orense", "Palencia", "Pontevedra", "Salamanca", "Santa Cruz de Tenerife", "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo", "Valencia", "Valladolid", "Vizcaya", "Bizkaia", "Zamora", "Zaragoza", "Andalucía", "Andalucia", "Aragón", "Aragon", "Canarias", "Castilla-La Mancha", "Castilla y León", "Castilla y Leon", "Cataluña", "Cataluna", "Extremadura", "Galicia", "País Vasco", "Pais Vasco", "Comunidad de Madrid", "Comunitat Valenciana"
  ];

  for (const st of states) {
    const regex = new RegExp(`([a-zA-Z0-9\\)])\\s+(?<!\\b(?:Provinsi|Province|Daerah\\s+Istimewa|Daerah\\s+Khusus\\s+Ibukota|Kabupaten|Kota)\\s+)\\b(${st})\\b(?!\\s+(?:City|Street|Road|Avenue|Drive|Lane|Boulevard|Way|Place|Court|Highway|Close|Crescent|Square|Terrace|Park|Estate|Industrial|Unit|Suite|Building|Floor|Bldg|St|Rd|Ave|Dr|Ln|Blvd|Hwy|Ct|Pl)\\b)`, "gi");
    a = a.replace(regex, "$1, $2");
  }

  // 7. Clean up spaces and duplicate commas (preserve decimal commas like "Kilometer 5,5")
  a = normalizeAddressCommas(a);
  a = a.replace(/[,;.\s\-_/\\|]+$/g, "").trim();
  a = a.replace(/^[,;.\s\-_/\\|]+/g, "").trim();
  a = a.replace(/\s+/g, " ");

  // Final pass: repair any blindly split commas
  a = repairBlindlySeparatedCommas(a);

  return a;
}

/**
 * Restores state or province if AI or parser omitted it from the physical address.
 */
function restoreStateIfOmitted(cleanAddr, rawAddr, country = "") {
  if (!cleanAddr || !rawAddr) return cleanAddr;

  // If cleanAddr ALREADY contains a valid state or province, NEVER append another state!
  if (hasStateInAddress(cleanAddr, country)) {
    return cleanAddr;
  }

  const cLower = (country || "").toLowerCase();

  // AU check - ONLY if country is Australia or unknown
  if (!country || cLower.includes("australia")) {
    const auStates = [
      ["vic", "Victoria"], ["nsw", "New South Wales"], ["qld", "Queensland"],
      ["wa", "Western Australia"], ["sa", "South Australia"], ["tas", "Tasmania"],
      ["act", "Australian Capital Territory"], ["nt", "Northern Territory"]
    ];
    for (const [abbr, full] of auStates) {
      const regRaw = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      const regClean = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      if (regRaw.test(rawAddr) && !regClean.test(cleanAddr)) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${full}`;
      }
    }
  }

  // Canada check - ONLY if country is Canada
  if (cLower.includes("canada")) {
    const caProvs = [
      ["ont", "Ontario"], ["qc", "Quebec"], ["bc", "British Columbia"], ["ab", "Alberta"],
      ["mb", "Manitoba"], ["sk", "Saskatchewan"], ["ns", "Nova Scotia"], ["nb", "New Brunswick"],
      ["nl", "Newfoundland And Labrador"], ["pe", "Prince Edward Island"]
    ];
    for (const [abbr, full] of caProvs) {
      // Do not match the English preposition "on" in general text; match "Ontario" or "Ont."
      const regRaw = (abbr === "ont")
        ? /\b(?:Ontario|Ont(?:\.|\b))\b/i
        : new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      const regClean = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      if (regRaw.test(rawAddr) && !regClean.test(cleanAddr)) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${full}`;
      }
    }
  }

  // US check - ONLY if country is United States / USA
  if (cLower.includes("united states") || cLower.includes("usa") || cLower.includes("america")) {
    const usStates = [
      ["al", "Alabama"], ["ak", "Alaska"], ["az", "Arizona"], ["ar", "Arkansas"],
      ["ca", "California"], ["co", "Colorado"], ["ct", "Connecticut"], ["de", "Delaware"],
      ["fl", "Florida"], ["ga", "Georgia"], ["hi", "Hawaii"], ["id", "Idaho"],
      ["il", "Illinois"], ["in", "Indiana"], ["ia", "Iowa"], ["ks", "Kansas"],
      ["ky", "Kentucky"], ["la", "Louisiana"], ["me", "Maine"], ["md", "Maryland"],
      ["ma", "Massachusetts"], ["mi", "Michigan"], ["mn", "Minnesota"], ["ms", "Mississippi"],
      ["mo", "Missouri"], ["mt", "Montana"], ["ne", "Nebraska"], ["nv", "Nevada"],
      ["nh", "New Hampshire"], ["nj", "New Jersey"], ["nm", "New Mexico"], ["ny", "New York"],
      ["nc", "North Carolina"], ["nd", "North Dakota"], ["oh", "Ohio"], ["ok", "Oklahoma"],
      ["or", "Oregon"], ["pa", "Pennsylvania"], ["ri", "Rhode Island"], ["sc", "South Carolina"],
      ["sd", "South Dakota"], ["tn", "Tennessee"], ["tx", "Texas"], ["ut", "Utah"],
      ["vt", "Vermont"], ["va", "Virginia"], ["wa", "Washington"], ["wv", "West Virginia"],
      ["wi", "Wisconsin"], ["wy", "Wyoming"], ["dc", "District of Columbia"]
    ];
    for (const [abbr, full] of usStates) {
      const regClean = new RegExp(`\\b${full}\\b`, "i");
      if (regClean.test(cleanAddr)) continue;

      let regRaw;
      if (["in", "or", "me", "ok", "wa", "al", "oh", "pa", "la", "de", "hi", "id", "il", "ma", "mo"].includes(abbr)) {
        regRaw = new RegExp(`(?:,\\s*\\b${abbr.toUpperCase()}\\b|\\b${abbr.toUpperCase()}\\b\\s+\\d{5}|\\b${full}\\b)`, "i");
      } else {
        regRaw = new RegExp(`\\b(?:${abbr}|${full})\\b`, "i");
      }
      if (regRaw.test(rawAddr)) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${full}`;
      }
    }
  }

  // UK check - ONLY if country is UK / United Kingdom
  if (cLower.includes("united kingdom") || cLower.includes("uk") || cLower.includes("england") || cLower.includes("scotland") || cLower.includes("wales")) {
    const ukCounties = [
      "Greater Manchester", "Greater London", "West Midlands", "West Yorkshire", "South Yorkshire",
      "Tyne and Wear", "Merseyside", "Berkshire", "Buckinghamshire", "Cambridgeshire", "Cheshire",
      "Cornwall", "Cumbria", "Derbyshire", "Devon", "Dorset", "Durham", "Essex", "Gloucestershire",
      "Hampshire", "Hertfordshire", "Kent", "Lancashire", "Leicestershire", "Lincolnshire", "Middlesex",
      "Norfolk", "Northamptonshire", "Northumberland", "Nottinghamshire", "Oxfordshire", "Shropshire",
      "Somerset", "Staffordshire", "Suffolk", "Surrey", "East Sussex", "West Sussex", "Warwickshire",
      "Wiltshire", "Worcestershire", "Bedfordshire"
    ];
    for (const countyName of ukCounties) {
      const regClean = new RegExp(`\\b${countyName.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}\\b`, "i");
      if (regClean.test(cleanAddr)) continue;
      const regRaw = new RegExp(`\\b${countyName.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}\\b`, "i");
      if (regRaw.test(rawAddr)) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${countyName}`;
      }
    }
  }

  // Germany check
  if (cLower.includes("germany") || cLower.includes("deutschland")) {
    const deStates = [
      "Baden-Württemberg", "Bayern", "Brandenburg", "Hessen", "Mecklenburg-Vorpommern",
      "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
      "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen"
    ];
    for (const st of deStates) {
      const regClean = new RegExp(`\\b${st.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}\\b`, "i");
      if (regClean.test(cleanAddr)) continue;
      const regRaw = new RegExp(`\\b${st.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}\\b`, "i");
      if (regRaw.test(rawAddr)) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${st}`;
      }
    }
  }

  // Spain check - ONLY if country is Spain or address has Spanish markers
  if (cLower.includes("spain") || cLower.includes("espana") || /\b(?:ES[-\s]?\d{5}|E[-\s]?\d{5})\b/i.test(rawAddr) || isSpanishLocation(rawAddr, country)) {
    // 1. Direct province mention in raw address that was omitted in cleanAddr
    const spainProvs = [
      "Álava", "Albacete", "Alicante", "Almería", "Asturias", "Ávila", "Badajoz", "Islas Baleares", "Barcelona",
      "Burgos", "Cáceres", "Cádiz", "Cantabria", "Castellón", "Ciudad Real", "Córdoba", "Cuenca", "Girona",
      "Granada", "Guadalajara", "Guipúzcoa", "Huelva", "Huesca", "Jaén", "A Coruña", "La Rioja", "Las Palmas",
      "León", "Lleida", "Lugo", "Madrid", "Málaga", "Murcia", "Navarra", "Ourense", "Palencia", "Pontevedra",
      "Salamanca", "Santa Cruz de Tenerife", "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo",
      "Valencia", "Valladolid", "Vizcaya", "Zamora", "Zaragoza"
    ];
    for (const prov of spainProvs) {
      const regRaw = new RegExp(`\\b${prov.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}\\b`, "i");
      if (regRaw.test(rawAddr)) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${prov}`;
      }
    }
  }

  // China check - ONLY if province is explicitly mentioned in raw website address
  if (!country || cLower.includes("china") || /[\u4e00-\u9fa5]/.test(rawAddr) || /[\u4e00-\u9fa5]/.test(cleanAddr)) {
    const chinaProvinces = [
      ["Guangdong", ["广东省", "广东", "guangdong"]],
      ["Jiangsu", ["江苏省", "江苏", "jiangsu"]],
      ["Zhejiang", ["浙江省", "浙江", "zhejiang"]],
      ["Shandong", ["山东省", "山东", "shandong"]],
      ["Sichuan", ["四川省", "四川", "sichuan"]],
      ["Hubei", ["湖北省", "湖北", "hubei"]],
      ["Hunan", ["湖南省", "湖南", "hunan"]],
      ["Henan", ["河南省", "河南", "henan"]],
      ["Hebei", ["河北省", "河北", "hebei"]],
      ["Fujian", ["福建省", "福建", "fujian"]],
      ["Anhui", ["安徽省", "安徽", "anhui"]],
      ["Shaanxi", ["陕西省", "陕西", "shaanxi"]],
      ["Liaoning", ["辽宁省", "辽宁", "liaoning"]],
      ["Jiangxi", ["江西省", "江西", "jiangxi"]]
    ];
    for (const [pFull, pKeywords] of chinaProvinces) {
      const regClean = new RegExp(`\\b${pFull}\\b`, "i");
      if (regClean.test(cleanAddr)) continue; // already has province
      const hasProvInRaw = pKeywords.some(kw => {
        if (/[\u4e00-\u9fa5]/.test(kw)) {
          return rawAddr.includes(kw);
        }
        return new RegExp(`\\b${kw}\\b`, "i").test(rawAddr);
      });
      // ONLY restore if the province was actually present in raw address on website!
      if (hasProvInRaw) {
        return `${cleanAddr.replace(/[,;\s.]+$/, "")}, ${pFull}`;
      }
    }
  }

  return cleanAddr;
}

/**
 * Restores initial street / building / premise number if AI dropped it.
 * E.g. "Best Place, Cincinnati, Ohio" -> "12110 Best Place, Cincinnati, Ohio"
 */
function restoreStreetNumberIfOmitted(cleanAddr, rawAddr, crawlData = null) {
  if (!cleanAddr || !rawAddr) return cleanAddr;
  let c = cleanAddr.trim();

  // If cleanAddr already starts with a number, premise indicator, or PO Box, check if rawAddr had a leading Unit/Floor/Level/Office Park
  if (/^(?:\d+|no\.?|nos\.?|nº|#|number\b|unit|suite|ste|bldg|building|floor|fl|rm|room|lot|plot|level|shed|warehouse|factory|block|blk|kav|kavling|p\.?o\.?\s*box)\b/i.test(c)) {
    // If cleanAddr starts with bare digits, check if raw evidence explicitly had "No.", "No", "Number", "Nº", or "號"
    const bareDigitMatch = c.match(/^(\d+[A-Za-z]?(?:[-\/]\d+)?)\b/);
    if (bareDigitMatch) {
      const d = bareDigitMatch[1];
      const checkTexts = [rawAddr];
      if (crawlData && Array.isArray(crawlData.addressCandidates)) {
        for (const cand of crawlData.addressCandidates) {
          const t = typeof cand === "object" ? cand.raw : cand;
          if (t && typeof t === "string") checkTexts.push(t);
        }
      }
      const rawHasNo = new RegExp('(?:(?:\\b(?:no|nos|nº|numero|num|number|lot\\s*no|plot\\s*no)\\.?|#)\\s*' + d.replace('-', '[-/]') + '\\b|' + d.replace('-', '[-/]') + '\\s*[号號])', 'i');
      if (checkTexts.some(txt => rawHasNo.test(txt))) {
        c = `Number ${d}, ` + c.slice(d.length).replace(/^,\s*/, '').trim();
      }
    }

    // Check if rawAddr has leading premise/floor/unit/suite/building/office park before cleanAddr
    const cleanEscaped = c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+');
    let mLead = rawAddr.match(new RegExp(`^\\s*([\\s\\S]{3,80}?)[,\\s]+(?=${cleanEscaped})`, 'i'));
    if (!mLead) {
      const firstThoroughfareMatch = c.match(/^(?:no\.?|nos\.?|number|#)?\s*\d+[A-Za-z]?(?:[-\/]\d+)?[,\s]+[A-Za-z0-9\u00C0-\u024F\s\-]+?\b(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Rd|St|Ave|Ln|Dr|Blvd|Hwy|Ct|Pl)\b/i);
      if (firstThoroughfareMatch) {
        const segEscaped = firstThoroughfareMatch[0].replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+');
        mLead = rawAddr.match(new RegExp(`^\\s*([\\s\\S]{3,80}?)[,\\s]+(?=${segEscaped})`, 'i'));
      }
    }
    if (mLead && mLead[1]) {
      const prefix = mLead[1].trim().replace(/,$/, '');
      if (/\b(?:unit|suite|ste|bldg|building|floor|fl|flr|level|block|blk|lot|plot|office\s*park|industrial|tower|kav)\b|\b\d+\s*(?:\/|\s*)?F\b/i.test(prefix)) {
        const floorDigitMatch = prefix.match(/\b(\d+)\s*(?:\/|\s*)?F\b/i);
        if (floorDigitMatch && new RegExp(`\\b${floorDigitMatch[1]}(?:st|nd|rd|th)?\\s+Floor\\b`, 'i').test(c)) {
          return c;
        }
        if (new RegExp(`^${prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(c)) {
          return c;
        }
        return `${prefix}, ${c}`;
      }
    }
    const leadingUnitMatch = rawAddr.match(/^\s*(\b(?:\d{1,3}(?:st|nd|rd|th)?\s+floor|\d{1,3}\s*(?:\/|\s*)?F\.?|(?:unit|suite|ste|bldg|building|floor|fl|rm|room|lot|plot|level|block|blk)\s+[A-Za-z0-9\-\/]+)[,\s]+)(?:no\.?|nos\.?|number|#)?\s*(\d+[A-Za-z]?(?:[-\/]\d+)?)/i);
    if (leadingUnitMatch) {
      const unitText = leadingUnitMatch[1].trim().replace(/,$/, '');
      const numText = leadingUnitMatch[2];
      const cleanStartsWithNum = new RegExp(`^(?:no\\.?|nos\\.?|number|#)?\\s*${numText}\\b`, 'i');
      if (cleanStartsWithNum.test(c) && !new RegExp(`^${unitText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(c)) {
        return `${unitText}, ${c}`;
      }
    }
    return c;
  }

  const premiseWords = "unit|suite|ste|bldg|building|floor|fl|rm|room|lot|plot|level|shed|warehouse|factory|block|blk|kav|kavling";
  const premiseId = "(?:pt\\s*)?[A-Za-z0-9\\-\\/]*\\d+[A-Za-z0-9\\-\\/]*";

  // Extract the first meaningful thoroughfare or street name chunk from cleanAddr
  // E.g. from "Best Place, Cincinnati, Ohio", chunk is "Best Place"
  const firstCommaIdx = c.indexOf(",");
  let firstSegment = (firstCommaIdx > 0 ? c.slice(0, firstCommaIdx) : c).trim();
  if (firstSegment.length >= 3) {
    // Make common street suffixes flexible between full and abbreviated forms
    const suffixMap = [
      [/\bStreet\b/i, "(?:Street|St\\b\\.?)"],
      [/\bRoad\b/i, "(?:Road|Rd\\b\\.?)"],
      [/\bPlace\b/i, "(?:Place|Pl\\b\\.?)"],
      [/\bAvenue\b/i, "(?:Avenue|Ave\\b\\.?)"],
      [/\bDrive\b/i, "(?:Drive|Dr\\b\\.?)"],
      [/\bLane\b/i, "(?:Lane|Ln\\b\\.?)"],
      [/\bBoulevard\b/i, "(?:Boulevard|Blvd\\b\\.?)"],
      [/\bCourt\b/i, "(?:Court|Ct\\b\\.?)"],
      [/\bTerrace\b/i, "(?:Terrace|Tce\\b|Ter\\b\\.?)"],
      [/\bHighway\b/i, "(?:Highway|Hwy\\b\\.?)"],
      [/\bParkway\b/i, "(?:Parkway|Pkwy\\b\\.?)"],
      [/\bCrescent\b/i, "(?:Crescent|Cres\\b\\.?)"],
      [/\bSquare\b/i, "(?:Square|Sq\\b\\.?)"]
    ];

    let escapedSeg = firstSegment.replace(/[-\[\]{}()*+?.,\\^$|#]/g, "\\$&");
    for (const [sufRegex, flexRep] of suffixMap) {
      if (sufRegex.test(escapedSeg)) {
        escapedSeg = escapedSeg.replace(sufRegex, flexRep);
        break;
      }
    }
    escapedSeg = escapedSeg.replace(/\s+/g, "\\s+");

    // Regex in rawAddr looking for premise / building / street number immediately preceding this segment
    // Supports: "Lot 45", "Plot 12", "Lot 12 & 13", "Lot PT 1234", "Plot 18-A", "Unit 4, 12", "Suite 200, 12110", "12110", "No. 18", "Building 5", etc.
    const prefixRegex = new RegExp(
      '(?:^|[\\s,#;:])((?:(?:' + premiseWords + ')\\s*(?:no\\.?|nos\\.?|number|#)?\\s*' + premiseId + '(?:\\s*(?:&|and|,)\\s*(?:(?:' + premiseWords + '|pt)\\s*)?(?:no\\.?|nos\\.?|#)?\\s*' + premiseId + ')*(?:[\\s,]+(?:no\\.?|nos\\.?|number|#)?\\s*\\d+[A-Za-z]?(?:[-/]\\d+[A-Za-z]?)?)?|(?:(?:no\\.?|nos\\.?|nº|#)\\s*)?\\d+[A-Za-z]?(?:[-/]\\d+[A-Za-z]?)?))[\\s,]+' + escapedSeg,
      'i'
    );

    const m = rawAddr.match(prefixRegex);
    if (m && m[1]) {
      let leadingNum = m[1].trim();
      leadingNum = leadingNum.replace(/[,;]+$/, "").trim();
      if (leadingNum) {
        const numDigits = (leadingNum.match(/\d+/) || [])[0];
        if (numDigits && new RegExp('\\b' + numDigits + '(?:st|nd|rd|th)?\\b', 'i').test(c.slice(0, 40))) {
          return cleanAddr;
        }
        if (new RegExp('^(?:' + premiseWords + ')\\b', 'i').test(leadingNum) && !leadingNum.includes(",")) {
          return `${leadingNum}, ${c}`;
        }
        return `${leadingNum} ${c}`;
      }
    }
  }

  // Fallback: Check if rawAddr begins with a premise or street number that got stripped from cleanAddr
  const startRegex = new RegExp(
    '^[\\s,#;:]*((?:(?:' + premiseWords + ')\\s*(?:no\\.?|nos\\.?|number|#)?\\s*' + premiseId + '(?:\\s*(?:&|and|,)\\s*(?:(?:' + premiseWords + '|pt)\\s*)?(?:no\\.?|nos\\.?|#)?\\s*' + premiseId + ')*(?:[\\s,]+(?:no\\.?|nos\\.?|number|#)?\\s*\\d+[A-Za-z]?(?:[-/]\\d+[A-Za-z]?)?)?|(?:(?:no\\.?|nos\\.?|nº|#)\\s*)?\\d+[A-Za-z]?(?:[-/]\\d+[A-Za-z]?)?))(?=[\\s,]+)',
    'i'
  );
  const mStart = rawAddr.trim().match(startRegex);
  if (mStart && mStart[1]) {
    const lead = mStart[1].trim().replace(/[,;]+$/, "");
    const leadDigits = (lead.match(/\d+/) || [])[0];
    if (leadDigits && new RegExp('\\b' + leadDigits + '(?:st|nd|rd|th)?\\b', 'i').test(c.slice(0, 40))) {
      return cleanAddr;
    }
    if (!new RegExp('\\b' + lead.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i').test(c)) {
      if (new RegExp('^(?:' + premiseWords + ')\\b', 'i').test(lead) && !lead.includes(",")) {
        return `${lead}, ${c}`;
      }
      return `${lead} ${c}`;
    }
  }

  return cleanAddr;
}

/**
 * Restores Taiwanese Village (里 / 村) if AI omitted it between Road and District / City.
 * E.g. "Number 228, Baoshun Road, East District, Chiayi City" -> "Number 228, Baoshun Road, Houhu Village, East District, Chiayi City"
 */
function restoreTaiwanVillageIfOmitted(cleanAddr, rawAddr, crawlData) {
  if (!cleanAddr || typeof cleanAddr !== "string") return cleanAddr;
  if (!rawAddr && !crawlData) return cleanAddr;
  let c = cleanAddr.trim();

  // Only apply to Taiwan addresses
  const isTaiwan = isTaiwanLocation(c, "Taiwan") ||
    (crawlData && typeof crawlData.country === "string" && /taiwan/i.test(crawlData.country)) ||
    (typeof rawAddr === "string" && isTaiwanLocation(rawAddr, "Taiwan"));
  if (!isTaiwan) return cleanAddr;

  // If already contains Village or Li, do nothing
  if (/\b(?:village|li)\b/i.test(c)) return cleanAddr;

  // Gather all evidence texts
  const candidates = [];
  if (typeof rawAddr === "string" && rawAddr) candidates.push(rawAddr);
  if (crawlData && Array.isArray(crawlData.addressCandidates)) {
    for (const cand of crawlData.addressCandidates) {
      if (!cand) continue;
      const text = typeof cand === "object" ? cand.raw : cand;
      if (text && typeof text === "string") candidates.push(text);
    }
  }

  let villageName = "";
  for (const text of candidates) {
    // 1. English format: e.g. "Houhu Village", "Hoo Hu Li", "Zhongxing Village"
    const engMatch = text.match(/\b([A-Z][a-z0-9]*(?:[-\s]+[A-Z][a-z0-9]*)?)\s+(?:Village|Li)\b/i);
    if (engMatch) {
      let rawV = engMatch[1].trim();
      if (/^hoo[-\s]*hu$/i.test(rawV)) rawV = "Houhu";
      villageName = rawV.split(/[\s\-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("") + " Village";
      break;
    }

    // 2. Chinese format: e.g. "嘉義市後湖里保順路", "東區後湖里"
    const chMatch = text.match(/(?:市|縣|区|區|乡|鄉|镇|鎮)([\u4e00-\u9fa5]{2,4})[里村]/);
    if (chMatch) {
      const chV = chMatch[1];
      if (chV === "後湖" || chV === "后湖") {
        villageName = "Houhu Village";
        break;
      }
      const rom = romanizeChineseAddress(chV + "里");
      if (rom && rom.includes("Village")) {
        villageName = rom.trim().replace(/^,\s*|,\s*$/g, "");
        break;
      }
    }
  }

  if (villageName) {
    // Insert village right after thoroughfare (Road|Street|Avenue|Lane|Alley|Boulevard|Highway) and before District|Township|City
    const inserted = c.replace(
      /(Road|Street|Avenue|Lane|Alley|Boulevard|Highway),\s*(East\s+District|West\s+District|North\s+District|South\s+District|Central\s+District|[A-Z][a-z0-9\-]+\s+(?:District|Township|City))\b/i,
      (m, road, div) => `${road}, ${villageName}, ${div}`
    );
    if (inserted !== c) return inserted;
  }

  return cleanAddr;
}

/**
 * Carefully strips postal codes while strictly preserving street numbers, cities, and states globally.
 */
function removePostalCodesCarefully(addr) {
  if (!addr) return "";
  let a = addr;

  const streetSuffixPattern = "\\b(?:street|road|avenue|lane|drive|way|place|court|terrace|boulevard|highway|parkway|crescent|close|walk|row|parade|circuit|square|esplanade|mews|alley|st|rd|ave|ln|dr|pl|ct|tce|blvd|hwy|pkwy|cres|cl|sq|strasse|straße|str|rue|via|viale|calle|ulica|ul|namesti|náměstí|avenida|avda|jalan|jl)\\b";
  const premisePrefixPattern = "\\b(?:suite|unit|bldg|building|floor|fl|rm|room|dept|apartment|apt|flat|lot|plot|block|blk|level|shed|warehouse|factory|p\\.?o\\.?\\s*box|no\\.?|nos\\.?|number|#)\\b";

  // 1. Explicitly labeled postal codes (e.g. 'Zip 45241, 12110 Best Place', 'Postal Code: 30543', 'PLZ: 80333', 'PSČ: 602 00', 'CP: 28013')
  a = a.replace(/(?:^|[\s,]+)(?:zip(?:\s*code)?|postal(?:\s*code)?|postcode|pincode|pin|plz|cap|cp|cedex|psč|psc)\s*[:#\-]?\s*(?:\d{4,6}|\d{3}\s*\d{2}|\d{2}-\d{3})[\s,]+/gi, ", ");

  // 2. Leading postal code directly touching Chinese characters (e.g. '30543新竹縣...')
  a = a.replace(/^\s*(\d{3,6})(?=[\u4e00-\u9fa5])/g, "");

  // 3. Leading postal code preceding an explicit street number indicator (e.g. '30543, No. 18 Kuang Fu North Road')
  a = a.replace(/^\s*\d{4,6}[\s,]+(?=(?:no\.?|nos\.?|number|#|unit|suite|bldg|building|floor|level|lot|plot)\s*\d+)/gi, "");

  // 4. Leading postal code preceding administrative region keyword (e.g. '504 Changhua County, Taiwan')
  a = a.replace(/^\s*\d{3,6}[\s,]+(?=[A-Za-z]+(?:\s+[A-Za-z]+)?\s+(?:county|hsien|province|region|prefecture)\b)/gi, "");

  // NOTE: A standalone number at the start of an address followed by a street name is 100% THE STREET / BUILDING NUMBER.
  // It MUST NEVER be stripped!

  // 5. UK Postcodes (e.g. SW1A 1AA, EC1A 1BB, W1A 0AX, M1 1AE, CM9 4PX)
  a = a.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, " ");

  // 6. European country-prefixed postal codes (e.g. ES-28014, CZ-60200, DE-80333, D-80333, FR-75002, PL-00-838, TR-34570, ZA-2000)
  a = a.replace(/\b(?:ES|E|IT|FR|DE|D|NL|BE|AT|CH|CZ|PL|SE|NO|DK|TR|ZA)[-\s]?(?:\d{4,5}|\d{3}\s*\d{2}|\d{2}-\d{3})\b/gi, " ");

  // 7. Canadian Postcodes (e.g. M5V 2T6, K1A 0B1)
  a = a.replace(/\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/gi, " ");

  // 8. Dutch Postcodes with 2 letters (e.g. 1015 CW)
  a = a.replace(/\b\d{4}\s*[A-Z]{2}\b/g, " ");

  // 9. US ZIP+4 (e.g. 90210-1234)
  a = a.replace(/\b\d{5}-\d{4}\b/g, " ");

  // 10. Polish postal codes (e.g. 00-838)
  a = a.replace(/\b\d{2}-\d{3}\b/g, " ");

  // 11. Czech / Slovak / Swedish spaced 5-digit postal codes (e.g. 602 00, 110 00) before city
  a = a.replace(/(,\s*)\b\d{3}\s+\d{2}\b\s*(?=,?\s+[\p{L}])/gu, "$1");

  // 12. Postal code directly following State name / abbreviation / province globally
  const allStatesPostalRegex = "\\b(?:Victoria|New South Wales|Queensland|Western Australia|South Australia|Tasmania|Northern Territory|Australian Capital Territory|Vic|NSW|QLD|WA|SA|TAS|ACT|NT|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\\s*Hampshire|New\\s*Jersey|New\\s*Mexico|New\\s*York|North\\s*Carolina|North\\s*Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\\s*Island|South\\s*Carolina|South\\s*Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\\s*Virginia|Wisconsin|Wyoming|District\\s*Of\\s*Columbia|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|Ontario|Quebec|British Columbia|Alberta|Gauteng|KwaZulu-Natal|Western Cape|Eastern Cape|Northern Cape|Free State|North West|Mpumalanga|Limpopo|ON|QC|BC|Baden-Württemberg|Baden-Wurttemberg|Bayern|Bavaria|Berlin|Brandenburg|Bremen|Hamburg|Hessen|Hesse|Mecklenburg-Vorpommern|Niedersachsen|Lower Saxony|Nordrhein-Westfalen|North Rhine-Westphalia|Rheinland-Pfalz|Rhineland-Palatinate|Saarland|Sachsen|Saxony|Sachsen-Anhalt|Saxony-Anhalt|Schleswig-Holstein|Thüringen|Thuringia|Jawa Barat|Jawa Tengah|Jawa Timur|DKI Jakarta|DI Yogyakarta|Banten|Sumatera Utara|Sumatera Barat|Sumatera Selatan|Kalimantan Timur|Kalimantan Barat|Sulawesi Selatan|Bali|İstanbul|Istanbul|Ankara|İzmir|Izmir|Bursa|Antalya|Adana|Konya|Gaziantep|Kocaeli|Mersin|Diyarbakır|Diyarbakir|Kayseri|Eskişehir|Eskisehir|Samsun|Denizli|Sakarya|Muğla|Mugla|Trabzon|Île-de-France|Ile-de-France|Auvergne-Rhône-Alpes|Nouvelle-Aquitaine|Occitanie|Hauts-de-France|Provence-Alpes-Côte d'Azur|PACA|Grand Est|Pays de la Loire|Bretagne|Normandie|Bourgogne-Franche-Comté|Centre-Val de Loire|Madrid|Barcelona|Valencia|Sevilla|Zaragoza|Málaga|Malaga|Murcia|Palma|Bilbao|Alicante|Córdoba|Cordoba|Valladolid|Vigo|Gijón|Gijon|Granada|Alava|Albacete|Almeria|Asturias|Avila|Badajoz|Baleares|Burgos|Caceres|Cadiz|Cantabria|Castellon|Ciudad Real|Cuenca|Girona|Guadalajara|Guipuzcoa|Huelva|Huesca|Jaen|La Coruna|La Rioja|Las Palmas|Leon|Lleida|Lugo|Navarra|Ourense|Palencia|Pontevedra|Salamanca|Santa Cruz de Tenerife|Segovia|Soria|Tarragona|Teruel|Toledo|Selangor|Johor|Penang|Perak|Kedah|Pahang|Negeri Sembilan|Melaka|Terengganu|Kelantan|Sarawak|Sabah|Perlis)\\b[\\s,]*";
  a = a.replace(new RegExp(`(${allStatesPostalRegex})\\b\\d{4,6}\\b`, "gi"), "$1");

  // 13. Postal code before a city/town after comma (e.g. "..., 81750 Masai, Johor", "..., 75002 Paris")
  // MUST NOT strip street numbers if preceded by Unit/Suite/Building or followed by a street suffix!
  a = a.replace(/(,\s*)\b\d{4,6}\b\s*(?=,?\s+([\p{L}]+(?:\s+[\p{L}]+)*))/gu, (match, comma, rest) => {
    if (new RegExp(streetSuffixPattern, "iu").test(rest)) return match;
    const preComma = a.slice(0, a.indexOf(match));
    const lastPre = preComma.split(',').pop().trim();
    if (new RegExp(`(?:^|\\s)${premisePrefixPattern}\\s*$`, "iu").test(lastPre)) return match;
    return comma;
  });
  a = a.replace(/(\b\d+\s+)\b(?:0[1-9]|[1-4]\d|5[0-2])\d{3}\b\s+(?=[\p{L}])/gu, "$1");

  // 14. Postal code directly following City / District / Township / County / Hsien / Province / Region
  a = a.replace(/(\b(?:City|District|Township|County|Hsien|Province|Region|Town|Dist\.?)\b[\s,]*)\b\d{3,6}\b(?=[\s,]|$)/gi, "$1");

  // 15. Postal code at the very end of the address string (e.g. "... Campbellfield 3061", "... Mumbai - 400001", or "... Cincinnati, Ohio 45241")
  a = a.replace(/[\s,\-]+(?:\bpin(?:\s*code)?\b[\s:#\-]*)?\b(?:\d{4,6}|\d{3}\s*\d{2}|\d{2}-\d{3})\b(?:\s*[.,]?\s*)$/gi, "");
  a = a.replace(/\s*-\s*\b\d{4,6}\b(?=[\s,]|$)/g, "");

  // 16. Strip trailing telephone / fax numbers from address string (e.g. "... Park Hills, Missouri 800.633.6775")
  a = a.replace(/(?:,\s*|\s+)(?:tel|phone|call|toll[-\s]*free)?\s*(?:\+?\d{1,3}[-.\s]*)?\(?\d{3}\)?[-.\s]+\d{3}[-.\s]+\d{4}\s*$/gi, "");

  // Clean double commas and spaces
  a = a.replace(/,\s*,+/g, ",");
  a = a.replace(/\s+/g, " ");
  a = a.replace(/^,\s*/, "").replace(/[,\s]+$/, "");

  return a;
}

/**
 * Universal Rule 6 Address Sanitizer for both AI and Own Crawl engines.
 * Strictly adheres to Rule 6 specification:
 * - Full physical address (premise, street number, street name, suburb/town, city, state/county) in Title Case.
 * - Automatically strips HTML remnants, stray tags, quotes, and brackets () [] {}.
 * - Strips office, department, and headquarters labels (e.g. "Head Office:", "Registered Office:").
 * - Automatically strips company name and corporate brand stems.
 * - Automatically strips telephone, fax, email, and opening hours.
 * - Automatically strips country names and postal/ZIP codes without dropping street numbers.
 * - Normalizes punctuation, commas, and strips boundary special characters.
 */
function sanitizeRule6CompanyAddress(addr, companyName = "", countryName = "", crawlData = null) {
  if (!addr || typeof addr !== "string") return "Not Available";
  let a = (typeof decodeHtmlEntities === "function" ? decodeHtmlEntities(addr) : addr).trim();
  if (!a || a.toLowerCase() === "not available" || a.length < 5) return "Not Available";

  // 1. Strip raw HTML tags, stray tag closers / attribute fragments e.g. '">, ', 'class="...", '
  a = a.replace(/<[^>]+>/g, " ");
  a = a.replace(/^(?:class|id|style|data-[a-z-]+)=["'][^"']*["']\s*>?\s*/gi, "");
  a = a.replace(/^[^\w\d#]*(?:["']\s*>?|>|\/?>)\s*/g, "");
  a = a.replace(/^[^a-zA-Z0-9#]+/g, "").trim();

  // 2. Decode quotes and remove brackets per Rule 4/6
  a = a.replace(/&quot;|&apos;|&#34;|&#39;/gi, " ");
  a = a.replace(/["“”‘’«»`]+/g, " ");
  // Remove brackets keeping inner text
  a = a.replace(/[\(\[\{]\s*([^\)\]\}]+?)\s*[\)\]\}]/g, " $1 ");
  a = a.replace(/[\(\)\[\]\{\}]/g, " ");

  // 3. Strip breadcrumbs, menu, and UI navigation remnants (e.g. "Home > Contact Us >", "Navigation")
  a = a.replace(/^(?:home\s*[>/\\|»-]+\s*(?:about(?:\s*us)?|contact(?:\s*us)?|our\s*locations?|find\s*us)?\s*[>/\\|»-]+\s*)+/i, "").trim();
  a = a.replace(/^(?:menu|navigation|quick\s*links|sidebar|footer)\s*[:：\-–|,]?\s*/i, "").trim();

  // 4. Strip corporate registration disclaimers & legal office prefixes
  a = a.replace(/^[\s\S]*?\b(?:registered\s+in\s+[A-Za-z\s]+(?::\s*[\dA-Za-z]+)?\.?\s*,?\s*)?(?:registered\s*office|registered\s*agent|domicilio\s*social)\s*[:：\-–,\s]+/i, "").trim();
  a = a.replace(/^[\s\S]*?\b(?:company\s+registration(?:\s+no\.?|\s+number)?\s*[:：\-–,\s]*[\dA-Za-z]+\.?\s*,?\s*)/i, "").trim();

  // 5. Strip conversational boilerplate and promotional marketing slogans from start
  a = a.replace(/^(?:if\s+you\s+have\s+any\s+(?:enquiries|questions)|require\s+a\s+quote|want\s+to\s+book\s+a\s+survey|please\s+(?:feel\s+free\s+to\s+)?(?:call|contact|email|reach|write)\s*(?:us|our\s+team)?|send\s+us\s+a\s+message|with\s+your\s+requirements|get\s+in\s+touch(?:\s+with\s+us)?|contact\s+us\s+at|welcome\s+to[\s\S]*?facility|committed\s+to[\s\S]*?quality|leading\s+manufacturer\s+of[\s\S]*?(?:solutions|products|systems)|specializing\s+in[\s\S]*?(?:moulding|engineering|manufacturing)|serving\s+(?:our\s+)?clients\s+worldwide|for\s+more\s+information(?:\s+please\s+contact\s+us)?)[\s\S]*?(?=\b\d+\s+[A-Za-z]|\b(?:po\s*box|post\s*office\s*box|unit|suite|building|floor|level|lot|plot|block|factory|shed|no\.?)\b)/i, "").trim();

  // 6. Strip contact, location, department, or office label prefixes at start of address
  // (NEVER match or strip authentic Post Office Box / General Post Office Box)
  if (!/^\s*(?:general\s+)?post\s+office\s+box\b/i.test(a)) {
    // Strip "Contact Us:", "Find Us:", "Where To Find Us:", "Our Location:", "Visit Us:", "We Are Located At:", etc.
    const contactHeadingPrefix = /^(?:where\s+to\s+find\s+us|where\s+we\s+are|how\s+to\s+find\s+us|find\s+us|visit\s+us|come\s+visit\s+us|our\s+locations?|office\s+locations?|locate\s+us|get\s+in\s+touch|contact\s+us\s+at|contact\s+us|contact|reach\s+us|reach\s+out|we\s+are\s+located\s+at|we're\s+located\s+at|our\s+factory|our\s+plant|our\s+showroom|our\s+warehouse|our\s+office|our\s+address|location\s+map|google\s+maps?|view\s+on\s+map)\s*[:：\-–|,]?\s*(?=\b(?:\d{1,5}|no\.?\s*\d+|unit|suite|building|floor|level|lot|plot|block|factory|shed|po\s*box|post\s*office\s*box|[A-Z][a-z]+)\b)/i;
    a = a.replace(contactHeadingPrefix, "").trim();

    // Strip office type prefixes e.g. "Head Office:", "Corporate Headquarters:", "Factory Location:", etc.
    const officePrefixRegex = /^(?:[A-Za-z\u00C0-\u024F\s]+?\s+)?(?:corporate\s+)?(?:head\s*office|headquarters|corporate\s*office|registered\s*office|main\s*office|principal\s*office|branch\s*office|regional\s*office|sales\s*office|plant\s*location|(?<!\b(?:post|general\s+post)\s+)office|plant|factory|warehouse|workshop|facility|showroom|hq|sede\s*central|domicilio\s*social|sede\s*principal|direcci[oó]n|ubicaci[oó]n|alamat|kantor|pabrik|廠址|地址)\s*(?:[:：\-–,]+\s*|\s+(?=\b(?:\d{1,5}|no\.?\s*\d+|unit|suite|building|floor|level|room|lot|plot)\b))/i;
    a = a.replace(officePrefixRegex, "").trim();

    // Strip address field labels in multiple languages: "Address:", "Addr:", "Physical Address:", "Postal Address:", "Street Address:", "Mailing Address:", etc.
    a = a.replace(/^(?:(?:physical|postal|mailing|street|corporate|registered|business|office|factory|plant|showroom|warehouse|workshop|main|head)\s+)?(?:address|add|addr|location|alamat|direcci[oó]n|ubicaci[oó]n|sede|anschrift|adresse|standort|indirizzo|地址|廠址|公司地址)\s*[:：\-–,\|\s]+/i, "").trim();
    a = a.replace(/^(?:where\s+we\s+are|where\s+to\s+find\s+us|find\s+us|visit\s+us|contact\s+us|contact|ubicaci[oó]n|direcci[oó]n|d[oó]nde\s*estamos|donde\s*estamos|contacto|cont[aá]ctenos|encu[eé]ntranos|alamat\s*kami|hubungi\s*kami|dove\s*siamo|standort|kontak|聯絡我們|联系我们)\s*[:：\-–,\|\s]+/i, "").trim();
  }

  // 7. Strip Company Name from start of address per Rule 6
  const cleanComp = (companyName || "").trim();
  if (cleanComp && cleanComp.length >= 3) {
    const compClean = cleanComp.replace(/[,;:\-_|/\\~*#@^"'“”‘’«»`]+/g, " ").trim();
    const compRegex = new RegExp(`^${compClean.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*[,\\-–]?\\s*`, "i");
    a = a.replace(compRegex, "").trim();

    // Strip brand stem without legal suffixes (e.g. "Teflex Plastics Pty Ltd" -> stem "Teflex Plastics")
    const brandStem = compClean.replace(/\b(?:pty|ltd|limited|inc|incorporated|llc|corp|corporation|co|company|proprietary|plc|gmbh|sdn|bhd|sa|bv|nv|srl|sl|sp\s*z\s*o\.?o\.?|se)\b/gi, "").trim();
    if (brandStem && brandStem.length >= 4) {
      const brandRegex = new RegExp(`^${brandStem.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*(?:(?:pty|ltd|limited|inc|llc|corp|co|se|gmbh)\\.?)?\\s*[,\\-–]?\\s*`, "i");
      a = a.replace(brandRegex, "").trim();
    }
  }

  // Strip brand/domain stem from crawlData if start of address duplicates site brand
  if (crawlData) {
    const siteUrl = (crawlData.finalUrl || crawlData.originalUrl || "").toLowerCase();
    const dStem = (typeof cleanDomainStem === "function" ? cleanDomainStem(siteUrl) : "").trim();
    if (dStem && dStem.length >= 4) {
      const dRegex = new RegExp(`^${dStem.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b(?:\\s+(?:pty|ltd|limited|inc|llc|corp|co|gmbh|services|products|group|enterprises|systems))?\\s*[,\\-–]?\\s*`, "i");
      a = a.replace(dRegex, "").trim();
    }
    if (crawlData.logoText && typeof crawlData.logoText === "string" && crawlData.logoText.trim().length >= 4) {
      const logoClean = crawlData.logoText.trim().replace(/[,;:\-_|/\\~*#@^"'“”‘’«»`]+/g, " ");
      const logoRegex = new RegExp(`^${logoClean.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*[,\\-–]?\\s*`, "i");
      a = a.replace(logoRegex, "").trim();
    }
  }

  // Strip generic leftover company words at start of address
  a = a.replace(/^(?:company|co\.?|incorporated|inc\.?|corporation|corp\.?|llc|limited|ltd\.?|equipment|systems|industries|technologies|enterprises|group|products)\b[\s,:\-–]*/i, "").trim();

  // 8. Strip embedded and trailing email addresses, URLs, and communication links
  a = a.replace(/(?:^|[\s,;])(?:email|e-mail|mail)\s*[:：\-–]?\s*[^\s,;]+@[^\s,;]+/gi, " ");
  a = a.replace(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, " ");
  a = a.replace(/\[email\s*protected\]|data-cfemail\S*/gi, " ");
  a = a.replace(/(?:^|[\s,;])(?:web|website|site|url)\s*[:：\-–]?\s*(?:https?:\/\/|www\.)[^\s,;]+/gi, " ");
  a = a.replace(/https?:\/\/[^\s,;]+/gi, " ");
  a = a.replace(/\bwww\.[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}(?:\/[^\s,;]*)?/gi, " ");

  // 8b. Strip embedded phone, tel, mobile, fax, and email fields without truncating trailing address
  a = a.replace(/[,;\s|•·]*\b(?:Phone|Tel|Telephone|Ph|Mob|Mobile|Cell|Fax|Direct|Toll\s*Free|Customer\s*Service|Support|Hotline|WhatsApp)\b\s*[:：\-–]?\s*(?:\+?\d{1,4}[-.\s]*)?(?:\(?\d{2,5}\)?[-.\s]*){1,4}\d{2,6}\s*(?=[,;|•·\n\r]|$)/gi, "");
  a = a.replace(/[,;\s|•·]*\b(?:Email|E-mail|Mail)\b\s*[:：\-–]?\s*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\s*(?=[,;|•·\n\r]|$)/gi, "");

  // 9. Strip trailing contact, communication, tax, and hours fields
  a = a.replace(/[,;\s]*(?:\b(?:Phone|Tel|Telephone|Ph|Mob|Mobile|Cell|Fax|Direct|Contact|Sales|Toll\s*Free|Customer\s*Service|Support|Hotline|WhatsApp|Postcode|Zip)\b\s*[:：\-–]?.*)$/i, "").trim();
  a = a.replace(/[,;\s]*(?:\b(?:mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b[\s\S]*?(?:am|pm).*)$/i, "").trim();
  a = a.replace(/[,;\s]*(?:\b(?:opening|business|working|office|trading)?\s*hours\b\s*[:：\-–]?.*)$/i, "").trim();
  a = a.replace(/[,;\s]*(?:\b(?:view\s*map|open\s*map|open\s*in\s*maps?|get\s*directions?|see\s*on\s*maps?|google\s*maps?|driving\s*directions?|directions?)\b.*)$/i, "").trim();
  a = a.replace(/[,;\s]*(?:\b(?:gps|coordinates?|latitude|longitude|lat|long)\b\s*[:：\-–]?\s*-?\d+\.\d+.*)$/i, "").trim();
  a = a.replace(/[,;\s]*(?:\b(?:cin|gstin|gst|tin|vat|tax\s*id|ein|abn|acn|cif|nif|siret|siren|kvk|hrb|uid|registration\s*no|reg\s*no|company\s*number|co\s*reg)\b\s*[:：\-–]?\s*[A-Za-z0-9\-\/]+.*)$/i, "").trim();
  a = a.replace(/[,;\s]*(?:\b(?:copyright|all\s*rights\s*reserved|privacy\s*policy|terms\s*(?:and|&)\s*conditions|terms\s*of\s*use)\b.*)$/i, "").trim();

  // Strip loose trailing telephone numbers (e.g. ", +1 217 555 1234", ", 0113 245 6789", ", 0812-3456-7890")
  a = a.replace(/[,;\s]+(?:\+?\d{1,4}[-\s.]*)?(?:\(?\d{2,5}\)?[-\s.]*){2,4}\d{2,6}\s*$/g, "").trim();

  // 10. Detect country and expand abbreviations
  let resolvedCountry = (countryName || "").trim();
  if (!resolvedCountry || resolvedCountry.length < 2) {
    resolvedCountry = (typeof detectCountryFromAddress === "function" ? detectCountryFromAddress(a) : "") || "";
  }
  if (typeof expandAddressAndStateAbbreviations === "function") {
    a = expandAddressAndStateAbbreviations(a, resolvedCountry);
  }

  // 11. Strip country names from address per Rule 6
  a = a.replace(/\b(?:United\s*States\s*Of\s*America|United\s*States|USA|U\.S\.A\.|Great\s*Britain|United\s*Kingdom|UK|U\.K\.|England|Scotland|Wales|Northern\s*Ireland|Canada|Germany|Deutschland|German|France|French|Spain|Espa[nñ]a|Italia|Italy|Netherlands|Nederland|Holland|Austria|[OÖ]sterreich|Oesterreich|Switzerland|Schweiz|Suisse|Svizzera|Croatia|Hrvatska|Turkiye|T[uü]rkiye|Turkey|Turkiey|Czech\s*Republic|Czechia|Brunei\s*Darussalam|Brunei|New\s*Zealand|Aotearoa|Malaysia|Indonesia|Republik\s*Indonesia|Singapore|Japan|Peoples?\s*Republic\s*of\s*China|China|India|South\s*Africa|Southafrica|United\s*Arab\s*Emirates|UAE|Kingdom\s*of\s*Bahrain|Bahrain|Sultanate\s*of\s*Oman|Oman|Saudi\s*Arabia|South\s*Korea|Republic\s*of\s*Korea|North\s*Korea|Hong\s*Kong|Vietnam|Philippines|Thailand|Poland|Polska|Portugal|Greece|Sweden|Norway|Denmark|Finland|Belgium|Hungary|Romania|Bulgaria|Slovakia|Slovenia|Serbia|Ukraine|Russia|Belarus|Estonia|Latvia|Lithuania|Luxembourg|Iceland|Greenland|Malta|Cyprus|Andorra|Liechtenstein|Albania|Moldova|North\s*Macedonia|Armenia|Azerbaijan|Kazakhstan|Uzbekistan|Israel|Egypt|Morocco|Tunisia|Algeria|Qatar|Kuwait|Jordan|Lebanon|Iran|Iraq|Syria|Afghanistan|Pakistan|Bangladesh|Sri\s*Lanka|Nepal|Bhutan|Myanmar|Cambodia|Maldives|Mongolia|Mexico|Brazil|Argentina|Colombia|Peru|Uruguay|Paraguay|Bolivia|Costa\s*Rica|Panama|Guatemala|Nicaragua|Belize|Guyana|Suriname|Jamaica|Bahamas|Barbados|Dominican\s*Republic|Cayman\s*Islands|Saint\s*Lucia|Trinidad\s*and\s*Tobago|Fiji|Papua\s*New\s*Guinea|Samoa|Vanuatu|Nigeria|Kenya|Ghana|Ethiopia|Tanzania|Uganda|Rwanda|Botswana|Namibia|Zambia|Zimbabwe|Mozambique|Angola|Madagascar|Mauritius|Seychelles|Sierra\s*Leone|Sudan)\b/gi, " ");
  a = a.replace(/(?<!\b(?:Western|South)\s+)\bAustralia\b/gi, " ");
  a = a.replace(/\b(r\.?o\.?c\.?|republic\s*of\s*china|taiwan)\b/gi, " ");
  a = a.replace(/(?:中華民國|台灣|臺灣|中国|中國)/g, " ");
  if (resolvedCountry && resolvedCountry.length > 2) {
    const cRegex = new RegExp(`\\b${resolvedCountry.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "gi");
    a = a.replace(cRegex, " ");
  }

  // Strip trailing country codes (e.g. ", USA", ", UK", ", AU", ", NZ") - never strip ", CA" if United States
  if (resolvedCountry && /united states/i.test(resolvedCountry)) {
    a = a.replace(/[,;\s]+\b(?:USA|US)\b\s*$/i, "").trim();
  } else {
    a = a.replace(/[,;\s]+\b(?:CA|USA|US|UK|GB|AU|NZ|ZA|DE|FR|ES|IT|IN|CN|PRC|TW|ROC|MY|ID|SG|TR)\b\s*$/i, "").trim();
  }

  // 12. Strip postal codes per Rule 6
  if (typeof removePostalCodesCarefully === "function") {
    a = removePostalCodesCarefully(a);
  }
  // Strip loose trailing 3-6 digit postal codes
  a = a.replace(/[\s,\-]+\b\d{3,6}\b\s*$/g, "").trim();

  // 13. Ensure comma before state and format
  if (typeof ensureCommaBeforeState === "function") {
    a = ensureCommaBeforeState(a);
  }
  if (typeof toTitleCase === "function") {
    a = toTitleCase(a);
  }

  // 14. Final cleanup of commas, spaces, and boundary special characters
  // Remove unwanted comma between bare street number and street name (e.g. "604, Progress Drive" -> "604 Progress Drive")
  a = a.replace(/(^|[,\s])(?<!\b(?:number|no\.?|#|section|sec\.?|lane|ln\.?|alley|aly\.?|unit|suite|ste\.?|floor|fl\.?|flr\.?|level|lot|plot|block|blk\.?)\s+)\b(\d{1,5}),\s+([A-Z][a-z0-9\u00C0-\u024F\-]+(?:\s+[A-Z][a-z0-9\u00C0-\u024F\-]+)*\s+(?:Street|Road|Avenue|Lane|Drive|Way|Place|Court|Terrace|Boulevard|Highway|Parkway|Crescent|Close|Walk|Row|Parade|Circuit|Square|Esplanade|Alley|Mews|Trail|Track|Hill|Caddesi|Bulvari|Sokak|Strasse|Calle|Avenida|Viale|Corso|Rd|St|Ave|Ln|Dr|Blvd|Hwy|Ct|Pl)\b)/gi, '$1$2 $3');

  a = a.replace(/\s+,/g, ",");
  a = a.replace(/,\s*,+/g, ", ");
  // Ensure space after commas except between digits (preserve decimal numbers e.g. 5,5 km)
  a = a.replace(/(?<!\d),(?!\d)\s*/g, ", ");
  a = a.replace(/[,;.\s\-_/\\|]+$/g, "").trim();
  a = a.replace(/^[,;.\s\-_/\\|]+/g, "").trim();
  a = a.replace(/\s+/g, " ");

  // Ensure "Number" is ONLY present if "No." / "No" / "#" / "Nº" / "號" was in the original raw address evidence
  if (crawlData && typeof stripBlindlyAddedNumber === "function") {
    const allEv = `${(crawlData.contactPageText || "")} ${(crawlData.footerText || "")} ${((crawlData.addressCandidates || []).map(c => typeof c === "object" ? c.raw : c).join(" "))}`;
    a = stripBlindlyAddedNumber(a, allEv, "");
  }

  // Deduplicate adjacent identical segments (e.g. "Puchong, Puchong" -> "Puchong")
  const segs = a.split(/(?<!\d),(?!\d)/).map(s => s.trim()).filter(Boolean);
  if (segs.length > 1) {
    const deduped = [];
    for (let i = 0; i < segs.length; i++) {
      if (i === 0 || segs[i].toLowerCase() !== segs[i - 1].toLowerCase()) {
        deduped.push(segs[i]);
      }
    }
    a = deduped.join(', ');
  }

  // Rule: Special character should not start and should not end
  a = a.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
  a = a.replace(/[^\p{L}\p{N})]+$/gu, "").trim();

  return a || "Not Available";
}

/**
 * Reconciles an extracted address (from AI or heuristic parser) with the authentic raw
 * candidate from the website's Contact Us / Footer to ensure NO authentic address components
 * are missed, truncated, or dropped (e.g. trailing cities, districts, counties, states,
 * leading unit/premise/estate names, or intermediate villages/sections).
 */
function reconcileAddressWithRawEvidence(addr, rawCand, companyName = "", country = "", crawlData = null) {
  if (!rawCand) return addr;
  const rawText = typeof rawCand === "object" ? (rawCand.raw || "") : String(rawCand || "");
  if (!rawText || rawText.length < 5 || rawText.length > 350) return addr;

  const rawClean = sanitizeRule6CompanyAddress(rawText, companyName, country, crawlData);
  if (!rawClean || rawClean === "Not Available" || rawClean.length < 5) return addr;
  if (!addr || addr === "Not Available") return rawClean;

  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  const normAi = norm(addr);
  const normRaw = norm(rawClean);

  if (normAi === normRaw) return addr;

  // Case 1: Raw candidate has trailing components missing from addr (e.g. City / County / State / District / Township)
  // e.g. addr: "Number 159, Yongke East Road, Yongkang District"
  // rawClean: "Number 159, Yongke East Road, Yongkang District, Tainan City"
  if (normRaw.startsWith(normAi) && normRaw.length > normAi.length) {
    return rawClean;
  }

  // Case 2: Raw candidate has leading premise / building / unit / estate missing from addr
  // e.g. addr: "12 Industrie Road, Penrose, Auckland"
  // rawClean: "Unit 4, 12 Industrie Road, Penrose, Auckland"
  if (normRaw.endsWith(normAi) && normRaw.length > normAi.length) {
    return rawClean;
  }

  // Case 3: Token coverage - if rawClean covers all major tokens of addr and has strictly more tokens
  // E.g. rawClean has intermediate village or road section or industrial park that AI dropped
  const aiTokens = normAi.split(" ").filter(t => t.length > 1);
  const rawTokens = normRaw.split(" ").filter(t => t.length > 1);
  if (aiTokens.length >= 2) {
    const matchCount = aiTokens.filter(t => rawTokens.includes(t)).length;
    if ((matchCount / aiTokens.length) >= 0.8 && rawTokens.length > aiTokens.length) {
      return rawClean;
    }
  }

  return addr;
}
