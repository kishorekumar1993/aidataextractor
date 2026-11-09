const fs = require('fs');

const bg = fs.readFileSync('background.js', 'utf8');

global.detectPurchaseOrShoppingCart = () => ({ detected: false });
global.detectDisallowedWebsitePlatformOrDomain = () => ({ isDisallowed: false });
global.detectFlashFormatSite = () => false;
global.detectNonEnglishWithoutTranslation = () => false;
global.checkCompanyProfilePresence = () => true;
global.cleanCompanyPrefixesAndSuffixes = (s) => s;
global.cleanDomainStem = (s) => s;
global.isRedirectDomain = () => false;
global.toTitleCase = (s) => s;
global.normalizeCountryName = (s) => s;
global.detectCountryFromAddress = () => "United States Of America";
global.decodeHtmlEntities = (s) => s;
global.cleanPhoneNumber = (p) => p;
global.evaluateStateQC = () => "Available";
global.evaluateCityQC = () => "Available";
global.resolveBestEmailSource = () => "https://example.com";
global.cleanCompanyName = (s) => s;
global.expandCompanyAbbreviations = (s) => s;
global.evaluateBusinessTypeQC = () => "Manufacturer";
global.isManufacturerSite = () => true;

eval(bg.slice(bg.indexOf('function isValidCorporateEmail'), bg.indexOf('function checkCompanyProfilePresence')));
eval(bg.slice(bg.indexOf('function isUnwantedEmail'), bg.indexOf('function isValidCorporateEmail')));
eval(bg.slice(bg.indexOf('function applyStrictInstructions'), bg.indexOf('function evaluateBusinessTypeQC')));

// Test 1: amoretti.com
const crawlDataAmoretti = {
  originalUrl: "http://www.amoretti.com",
  finalUrl: "https://amoretti.com/",
  status: "Working",
  mainHtml: "<html><body>Amoretti ingredients</body></html>",
  bodyText: "Amoretti ingredients",
  emails: ["info@amoretti.com", "orders@amoretti.com"],
  phones: ["8059832888"]
};

const rawAiAmoretti = {
  websiteStatus: "Working",
  businessType: "Manufacturer",
  companyProfile: "Available",
  companyName: "Amoretti",
  countryName: "United States Of America",
  companyAddress: "451 Richardson Drive, Oxnard, California",
  state: "Available",
  city: "Available",
  emailId: "info@amoretti.com",
  secondaryEmailId: "",
  phoneNumber: "8059832888",
  numberOfProducts: "3",
  productImages: "3",
  numberOfProductDescriptions: "3"
};

const processedAmoretti = applyStrictInstructions(rawAiAmoretti, crawlDataAmoretti, { isRestricted: false });
console.log("Processed Amoretti.com:", {
  websiteStatus: processedAmoretti.websiteStatus,
  emailId: processedAmoretti.emailId,
  secondaryEmailId: processedAmoretti.secondaryEmailId
});

// Test 2: amorettibrothers.com
const crawlDataBrothers = {
  originalUrl: "http://www.amorettibrothers.com",
  finalUrl: "https://www.amorettibrothers.com/",
  status: "Working",
  mainHtml: "<html><body>Amoretti Brothers handmade cookware</body></html>",
  bodyText: "Amoretti Brothers handmade cookware",
  emails: ["office@amorettibrothers.com", "privacy@amorettibrothers.com"],
  phones: ["9179151981"]
};

const rawAiBrothers = {
  websiteStatus: "Working",
  businessType: "Manufacturer",
  companyProfile: "Available",
  companyName: "Amoretti Brothers Incorporated",
  countryName: "United States Of America",
  companyAddress: "Suite 260, 2021 Guadalupe Street, Austin, Texas",
  state: "Available",
  city: "Available",
  emailId: "office@amorettibrothers.com",
  secondaryEmailId: "",
  phoneNumber: "9179151981",
  numberOfProducts: "3",
  productImages: "3",
  numberOfProductDescriptions: "3"
};

const processedBrothers = applyStrictInstructions(rawAiBrothers, crawlDataBrothers, { isRestricted: false });
console.log("Processed Amorettibrothers.com:", {
  websiteStatus: processedBrothers.websiteStatus,
  emailId: processedBrothers.emailId,
  secondaryEmailId: processedBrothers.secondaryEmailId
});
