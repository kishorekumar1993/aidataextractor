function removePostalCodesCarefully(addr) {
  if (!addr) return "";
  let a = addr;

  // 8. US ZIP+4 (e.g. 90210-1234)
  a = a.replace(/\b\d{5}-\d{4}\b/g, " ");

  // 9. Postal code directly following State name / abbreviation
  const allStates = "Victoria|New South Wales|Queensland|Western Australia|South Australia|Tasmania|Northern Territory|Australian Capital Territory|Vic|NSW|QLD|WA|SA|TAS|ACT|NT|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New\\s*Hampshire|New\\s*Jersey|New\\s*Mexico|New\\s*York|North\\s*Carolina|North\\s*Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode\\s*Island|South\\s*Carolina|South\\s*Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West\\s*Virginia|Wisconsin|Wyoming|District\\s*Of\\s*Columbia|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
  a = a.replace(new RegExp(`(\\b(?:${allStates})\\b[\\s,]*)\\b\\d{4,6}\\b`, "gi"), "$1");

  // 11. Postal code at the very end of the address string
  a = a.replace(/[\s,]+\b\d{3,6}\b(?:\s*[.,]?\s*)$/g, "");

  return a;
}

const testAddrs = [
  "1201 Allanson Road, Mundelein, IL 60060",
  "5900 Balcones Dr, Austin, TX 78731",
  "12045 Wallisville Road, Suite 200, Houston, TX 77013",
  "9735 Commerce Cir, Kutztown, PA 19530",
  "1130 Stuart Dr, Merced, California 95341",
  "11831 Vose Street, North Hollywood, CA 91605",
  "101 West Waukau Avenue, Oshkosh, WI 54902",
  "50 Park Street, Somerville, MA 02143",
  "6199 County Rd W, Allenton, Wisconsin 53002",
  "45 Power Rd, Westford, MA 01886",
  "1901 West Main Street, Washington, MO 63090",
  "375 Morse St, Hamden, CT 06517",
  "20421 15th Street Southeast, Blomkest, MN 56216",
  "1500 15th Avenue Drive East Unit 105, Palmetto, FL 34221"
];

for (const a of testAddrs) {
  console.log(a, '->', removePostalCodesCarefully(a));
}

