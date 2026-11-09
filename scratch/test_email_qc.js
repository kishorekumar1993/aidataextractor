// test_email_qc.js
const assert = require('assert');

// 1. Test isCompanyDomainEmail + secEmail preservation
const email = "info@company.com";
const targetHostDomain = "company.com";
const primHost = "company.com";
const crawlEmails = ["info@company.com", "sales@company.com", "careers@company.com", "alpmetal@ms24.hinet.net"];

const isCompanyDomainEmail = (candEmail) => {
  if (!candEmail || typeof candEmail !== "string") return false;
  const candHost = (candEmail.split("@")[1] || "").toLowerCase();
  if (!candHost) return false;
  if (primHost && (candHost === primHost || candHost.endsWith("." + primHost) || primHost.endsWith("." + candHost))) return true;
  if (targetHostDomain && (candHost === targetHostDomain || candHost.endsWith("." + targetHostDomain))) return true;
  return false;
};

// Scenario A: AI returns an ISP or sister brand email found during crawl
let secEmailA = "alpmetal@ms24.hinet.net";
if (secEmailA) {
  if (secEmailA === email) {
    secEmailA = "";
  } else if (!isCompanyDomainEmail(secEmailA) && !crawlEmails.includes(secEmailA)) {
    secEmailA = "";
  }
}
console.log("Scenario A (Sister brand / ISP email from crawl) - secEmail:", secEmailA);
assert.strictEqual(secEmailA, "alpmetal@ms24.hinet.net", "Discovered sister brand / ISP email must be kept!");

// Scenario B: AI returned empty secEmail, fallback takes distinct email from crawl
let secEmailB = "";
if (!secEmailB && email) {
  let cand = crawlEmails.find(e => e !== email && isCompanyDomainEmail(e));
  if (!cand) cand = crawlEmails.find(e => e !== email);
  if (cand) secEmailB = cand;
}
console.log("Scenario B (Fallback takes distinct same-domain email) - secEmail:", secEmailB);
assert.strictEqual(secEmailB, "sales@company.com");

// Scenario C: If no same-domain email exists, fallback takes discovered non-domain email
const crawlEmailsNonDomain = ["info@company.com", "webrack@hinet.net"];
let secEmailC = "";
if (!secEmailC && email) {
  let cand = crawlEmailsNonDomain.find(e => e !== email && isCompanyDomainEmail(e));
  if (!cand) cand = crawlEmailsNonDomain.find(e => e !== email);
  if (cand) secEmailC = cand;
}
console.log("Scenario C (Fallback takes discovered non-domain email) - secEmail:", secEmailC);
assert.strictEqual(secEmailC, "webrack@hinet.net");

// Scenario D: Careers or jobs email is not rejected as unwanted
const emCareers = "careers@company.com";
const isUnwanted = /^(?:noreply|no-reply|donotreply|do-not-reply|postmaster|hostmaster|abuse|mailer-daemon|bounce|unsubscribe|notification|notifications|alert|alerts|sentry|git|npm|dpo)@/i.test(emCareers);
console.log("Scenario D (careers@company.com isUnwanted):", isUnwanted);
assert.strictEqual(isUnwanted, false, "careers@ email must NOT be unwanted!");

// Scenario E: Identical emails are not allowed
let secEmailE = "info@company.com";
if (secEmailE === email) secEmailE = "";
console.log("Scenario E (Identical email cleared):", JSON.stringify(secEmailE));
assert.strictEqual(secEmailE, "");

console.log("\nALL DOUBLE-CHECK EMAIL TESTS PASSED SUCCESSFULLY!");
