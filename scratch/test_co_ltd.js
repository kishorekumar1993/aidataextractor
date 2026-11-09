const fs = require('fs');
const bg = fs.readFileSync('background.js', 'utf8');

function decodeHtmlEntities(str) { return str || ""; }

eval(bg.slice(bg.indexOf("function expandCompanyAbbreviations("), bg.indexOf("function restoreCommaBeforeCorporateSuffix(")));

const cases = [
  { input: "Taiwan Semiconductor Mfg. Co., Ltd.", expected: "Taiwan Semiconductor Manufacturing Company, Limited" },
  { input: "Taiwan Semiconductor Mfg. Co. Ltd", expected: "Taiwan Semiconductor Manufacturing Company Limited" },
  { input: "Global Tech Co., Ltd.", expected: "Global Technology Company, Limited" },
  { input: "Global Tech Co. Ltd", expected: "Global Technology Company Limited" },
  { input: "Global Tech Co Ltd", expected: "Global Technology Company Limited" },
  { input: "ABC Pte., Ltd.", expected: "ABC Private, Limited" },
  { input: "ABC Pte. Ltd", expected: "ABC Private Limited" },
  { input: "XYZ Pty., Ltd.", expected: "XYZ Proprietary, Limited" },
  { input: "XYZ Pty. Ltd", expected: "XYZ Proprietary Limited" },
  { input: "\" - # Inter Outstanding Electronics, Incorporated. - \"", expected: "Inter Outstanding Electronics, Incorporated" }
];

let allPassed = true;
for (const c of cases) {
  const actual = expandCompanyAbbreviations(c.input);
  if (actual === c.expected) {
    console.log("PASS:", c.input, "->", actual);
  } else {
    console.error("FAIL:", c.input, "\n  Expected:", c.expected, "\n  Actual:  ", actual);
    allPassed = false;
  }
}

if (allPassed) {
  console.log("\nALL 10 TESTS PASSED PERFECTLY!");
} else {
  process.exit(1);
}
