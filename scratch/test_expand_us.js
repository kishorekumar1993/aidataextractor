const { toTitleCase } = { toTitleCase: (s) => s.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()) };

function expandUsAbbreviations(addr) {
  let a = addr;
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

  // Street abbreviations
  a = a.replace(/(^|[,\s])St\.?(?=[,\s]|$)/gi, '$1Street');
  a = a.replace(/(^|[,\s])Rd\.?(?=[,\s]|$)/gi, '$1Road');
  a = a.replace(/(^|[,\s])Dr\.?(?=[,\s]|$)/gi, '$1Drive');
  a = a.replace(/(^|[,\s])Ave\.?(?=[,\s]|$)/gi, '$1Avenue');
  a = a.replace(/(^|[,\s])Cir\.?(?=[,\s]|$)/gi, '$1Circle');
  a = a.replace(/(^|[,\s])Blvd\.?(?=[,\s]|$)/gi, '$1Boulevard');
  a = a.replace(/(^|[,\s])Pkwy\.?(?=[,\s]|$)/gi, '$1Parkway');
  a = a.replace(/(^|[,\s])Hwy\.?(?=[,\s]|$)/gi, '$1Highway');

  for (const [abbr, full] of usAbbreviations) {
    const regComma = new RegExp(`(,\\s*)\\b${abbr}\\b\\.?(?=[,\\s]|$|\\s*\\d{5})|(\\s+)\\b${abbr}\\b\\.?(?=\\s*\\d{5})`, "i");
    a = a.replace(regComma, (match, p1, p2) => {
      if (p1) return `, ${full} `;
      return ` ${full} `;
    });
  }

  // Remove ZIP codes
  a = a.replace(/\b\d{5}(?:-\d{4})?\b/g, "").trim();
  a = a.replace(/\s+,/g, ",");
  a = a.replace(/,\s*,/g, ", ");
  a = a.replace(/,\s*/g, ", ");
  a = a.replace(/[,;.\s\-_/\\|]+$/g, "").trim();
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
  console.log(a, '->', expandUsAbbreviations(a));
}

