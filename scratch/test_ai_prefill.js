const fs = require('fs');

// Extract applyStrictInstructions and decodeHtmlEntities from background.js
const bg = fs.readFileSync('background.js', 'utf8');

const geminiOutput = {
  websiteStatus: "Working",
  businessType: "Manufacturer",
  companyProfile: "Available",
  companyName: "Inter Outstanding Electronics, Incorporated",
  countryName: "Taiwan",
  companyAddress: "Number 53-5, Pocheng Road, Yuanshan Township, Yilan County",
  state: "Available",
  city: "Available",
  emailId: "jack-hsiao@ioeinc.com.tw",
  secondaryEmailId: "",
  phoneNumber: "39233966",
  numberOfProducts: "3",
  productImages: "3",
  numberOfProductDescriptions: "3",
  _isFromAi: true
};

const crawlData = {
  finalUrl: "http://www.ioeinc.com.tw",
  originalUrl: "http://www.ioeinc.com.tw"
};

function decodeHtmlEntities(str) {
  if (!str || typeof str !== "string") return "";
  return str.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

eval(bg.slice(bg.indexOf("function applyStrictInstructions("), bg.indexOf("function hasValidCorporateAddress(")));

const result = applyStrictInstructions(geminiOutput, crawlData, {});
console.log("Result after applyStrictInstructions:", JSON.stringify(result, null, 2));

if (result.companyName !== geminiOutput.companyName) {
  console.error("FAIL: companyName mismatch!", result.companyName, "vs", geminiOutput.companyName);
} else {
  console.log("SUCCESS: companyName preserved exactly:", result.companyName);
}

if (result.companyAddress !== geminiOutput.companyAddress) {
  console.error("FAIL: companyAddress mismatch!", result.companyAddress, "vs", geminiOutput.companyAddress);
} else {
  console.log("SUCCESS: companyAddress preserved exactly:", result.companyAddress);
}

if (result._isFromAi !== true) {
  console.error("FAIL: _isFromAi flag was lost!");
} else {
  console.log("SUCCESS: _isFromAi flag is present!");
}

