const fs = require('fs');
const vm = require('vm');

const contentJs = fs.readFileSync('content.js', 'utf8');

// Test the extractNotWorkingReason function directly
const extractFnMatch = contentJs.match(/function extractNotWorkingReason\([\s\S]*?\n  }\n/);
const formatUrlMatch = contentJs.match(/function formatClickableUrl\([\s\S]*?\n  }\n/);

const testRunner = new Function('data', `
  ${formatUrlMatch[0]}
  ${extractFnMatch[0]}
  function getTargetUrl() { return "http://www.example.com"; }
  return extractNotWorkingReason(data);
`);

console.log('--- TEST 1: Prohibited Category (Food) ---');
const t1 = testRunner({
  websiteStatus: "Not Working",
  restrictedReason: "Food / Beverage",
  restrictedCategory: "Food",
  restrictedKeyword: "biscuit",
  restrictedSourceUrl: "http://www.example.com/products/biscuits.html",
  restrictedSnippet: "We manufacture high quality biscuits and bakery foods for regional stores."
});
console.log(t1);

console.log('\n--- TEST 2: Disallowed Business Type (Service Provider) ---');
const t2 = testRunner({
  websiteStatus: "Not Working",
  businessType: "Service Provider",
  disallowedReason: 'Business Type "Service Provider" outside allowed scope',
  disallowedKeyword: "IT Consulting Services",
  disallowedSourceUrl: "http://www.example.com/services.html",
  disallowedSnippet: "We provide IT consulting and software development services."
});
console.log(t2);

console.log('\n--- TEST 3: Shopping Cart on Retail Store ---');
const t3 = testRunner({
  websiteStatus: "Not Working",
  isShopCartSite: true,
  shopCartReason: "Add to cart and checkout buttons detected on retailer store",
  shopCartKeyword: "Shopping Cart / Direct Purchase",
  shopCartSourceUrl: "http://www.example.com/cart.html",
  shopCartSnippet: "Click Add to Cart to buy online with free shipping."
});
console.log(t3);

console.log('\n--- TEST 4: Fetch Error with message channel closed ---');
const t4 = testRunner({
  websiteStatus: "Not Working",
  fetchError: "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received",
  errorSourceUrl: "http://www.example.com"
});
console.log(t4);

console.log('\n--- TEST 5: Free Hosted Platform (Wix) ---');
const t5 = testRunner({
  websiteStatus: "Not Working",
  errorCategory: "Free Platform / Subdomain",
  restrictedReason: "Free Hosted Platform (Wix.com)",
  errorKeyword: "Wix.com",
  errorSourceUrl: "http://www.example.wixsite.com",
  errorSnippet: "This site was created with Wix.com"
});
console.log(t5);
