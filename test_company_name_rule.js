// Test suite for Rule 4: Company Name formatting
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = vm.createContext({ URL, console });
ctx.importScripts = (...files) => {
  for (const file of files) {
    const full = path.resolve(__dirname, file);
    if (fs.existsSync(full)) {
      vm.runInContext(fs.readFileSync(full, "utf8"), ctx, { filename: file });
    }
  }
};
ctx.importScripts("src/shared/text-utils.js", "src/background/company-normalizer.js");

const {
  toTitleCase,
  decodeHtmlEntities,
  cleanCompanyPrefixesAndSuffixes,
  expandCompanyAbbreviations
} = ctx;

function formatCompanyName(compName, country = "") {
  compName = decodeHtmlEntities((compName || "").trim());
  compName = compName.replace(/['’`]\s*s\b/gi, "'s");
  compName = cleanCompanyPrefixesAndSuffixes(compName);

  // Expand abbreviations to full form and clean brackets per Rule 4
  compName = expandCompanyAbbreviations(compName, country);
  compName = cleanCompanyPrefixesAndSuffixes(compName);
  // Remove brackets while preserving inner text
  compName = compName.replace(/[\(\[\{]\s*([^\)\]\}]+?)\s*[\)\]\}]/g, " $1 ");
  compName = compName.replace(/[\(\)\[\]\{\}]/g, " ");
  // Remove any special characters from the beginning
  compName = compName.replace(/^[^\p{L}\p{N}]+/gu, "").trim();
  // Remove trailing special characters (symbols, dashes, colons, semicolons, commas, slashes, quotes)
  compName = compName.replace(/[,;:\-_|/\\~*#@^"'“”‘’«»`]+$/g, "").trim();
  compName = compName.replace(/\.{2,}$/g, ".");
  compName = compName.replace(/[^a-zA-Z0-9.\u00C0-\u024F]+$/gu, "").trim();
  compName = compName.replace(/(?<![\p{L}\p{N}])\.+$/gu, "").trim();
  compName = compName.replace(/[,;]+$/g, "").trim();
  compName = compName.replace(/\s+/g, " ").trim();
  compName = toTitleCase(compName);
  return compName;
}

const tests = [
  {
    name: "Preserve dots in U.S. and comma before LLC (U.S. Tsubaki Industrial, LLC)",
    input: "U.S. Tsubaki Industrial, LLC",
    country: "United States Of America",
    expected: "U.S. Tsubaki Industrial, Limited Liability Company"
  },
  {
    name: "Remove brackets and keep country name (Carrier (USA) Corporation)",
    input: "Carrier (USA) Corporation",
    country: "United States Of America",
    expected: "Carrier USA Corporation"
  },
  {
    name: "Remove brackets and keep Taiwan (Furco (Taiwan) Company Limited)",
    input: "Furco (Taiwan) Company Limited",
    country: "Taiwan",
    expected: "Furco Taiwan Company Limited"
  },
  {
    name: "Strip special characters from beginning and end (- # Acme Tools, Inc. -)",
    input: "- # Acme Tools, Inc. -",
    country: "United States Of America",
    expected: "Acme Tools, Incorporated"
  },
  {
    name: "Remove leading copyright symbol (© 2024 Peter Forg Manufacturing Co.)",
    input: "© 2024 Peter Forg Manufacturing Co.",
    country: "United States Of America",
    expected: "Peter Forg Manufacturing Company"
  },
  {
    name: "Remove brackets and keep country name India ([India] Pvt. Ltd.)",
    input: "Delta [India] Pvt. Ltd.",
    country: "India",
    expected: "Delta India Private Limited"
  },
  {
    name: "Preserve country name in Stoneland USA",
    input: "Stoneland USA",
    country: "United States Of America",
    expected: "Stoneland USA"
  },
  {
    name: "Preserve country name in Meramec USA Inc",
    input: "Meramec USA Inc",
    country: "United States Of America",
    expected: "Meramec USA Incorporated"
  },
  {
    name: "Preserve country name in Palram Americas Inc",
    input: "Palram Americas Inc",
    country: "United States Of America",
    expected: "Palram Americas Incorporated"
  },
  {
    name: "Preserve country name in Shure USA Inc.",
    input: "Shure USA Inc.",
    country: "United States Of America",
    expected: "Shure USA Incorporated"
  },
  {
    name: "Preserve internal commas and ampersand (Johnson, Smith & Associates, LLC)",
    input: "Johnson, Smith & Associates, LLC",
    country: "United States Of America",
    expected: "Johnson, Smith & Associates, Limited Liability Company"
  },
  {
    name: "Clean trailing slashes and pipes (High Precision, Inc. //)",
    input: "High Precision, Inc. //",
    country: "United States Of America",
    expected: "High Precision, Incorporated"
  },
  {
    name: "Clean leading quotes and symbols (\"Acme Corp\")",
    input: "\"Acme Corp\"",
    country: "United States Of America",
    expected: "Acme Corporation"
  },
  {
    name: "Clean brackets around country and state (Carrier (USA) (Ohio) Inc)",
    input: "Carrier (USA) (Ohio) Inc",
    country: "United States Of America",
    expected: "Carrier USA Ohio Incorporated"
  }
];

let failed = 0;
console.log("=== Running Rule 4 Company Name Tests ===\n");
tests.forEach((t, i) => {
  const result = formatCompanyName(t.input, t.country);
  const pass = result === t.expected;
  if (pass) {
    console.log(`[PASS] Test ${i + 1}: ${t.name}`);
    console.log(`       Input:    "${t.input}"`);
    console.log(`       Output:   "${result}"`);
  } else {
    failed++;
    console.error(`[FAIL] Test ${i + 1}: ${t.name}`);
    console.error(`       Input:    "${t.input}"`);
    console.error(`       Expected: "${t.expected}"`);
    console.error(`       Got:      "${result}"`);
  }
});

console.log(`\nResults: ${tests.length - failed}/${tests.length} passed.`);
if (failed > 0) process.exit(1);
