function cleanBoundary(str, isName = false) {
  if (!str || typeof str !== 'string') return '';
  let s = str.trim();
  // Strip leading special characters (any character that is not a Unicode letter or digit)
  s = s.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
  // Strip trailing special characters (keep closing parenthesis or dot for abbreviations if name)
  if (isName) {
    s = s.replace(/[^\p{L}\p{N}.)]+$/gu, "").trim();
    s = s.replace(/(?<![\p{L}\p{N}])\.+$/gu, "").trim();
    s = s.replace(/[,;:]+$/g, "").trim();
  } else {
    s = s.replace(/[^\p{L}\p{N})]+$/gu, "").trim();
  }
  return s;
}

const tests = [
  // Company names
  { input: "& AT&T Corp. &", isName: true, expected: "AT&T Corp." },
  { input: "# Johnson & Johnson #", isName: true, expected: "Johnson & Johnson" },
  { input: "© 2024 Acme & Co., Ltd.", isName: true, expected: "Acme & Co., Ltd." },
  { input: "--- Procter & Gamble ---", isName: true, expected: "Procter & Gamble" },
  { input: "B&B #1 Solutions Inc.", isName: true, expected: "B&B #1 Solutions Inc." },
  
  // Addresses
  { input: "\u200B4/F., No. 415, Jung-Jeng Road, New Taipei City", isName: false, expected: "4/F., No. 415, Jung-Jeng Road, New Taipei City" },
  { input: "# 123 Main St, Suite #400, Chicago, Illinois #", isName: false, expected: "123 Main St, Suite #400, Chicago, Illinois" },
  { input: "& Unit #12 & #13, Industrial Park, London &", isName: false, expected: "Unit #12 & #13, Industrial Park, London" },
  { input: "--- 500 Broadway, Apt #2B, New York ---", isName: false, expected: "500 Broadway, Apt #2B, New York" },
  { input: "123 Main Street (Building B)", isName: false, expected: "123 Main Street (Building B)" },
  { input: "123 Main Street, Suite 4,", isName: false, expected: "123 Main Street, Suite 4" }
];

let failed = 0;
tests.forEach(t => {
  const actual = cleanBoundary(t.input, t.isName);
  const ok = actual === t.expected;
  if (!ok) {
    failed++;
    console.log(`FAIL: input="${t.input}" -> actual="${actual}", expected="${t.expected}"`);
  } else {
    console.log(`PASS: "${t.input}" -> "${actual}"`);
  }
});

console.log(`\nTotal: ${tests.length}, Failed: ${failed}`);

