function testEmailLogic(result, crawlData) {
  const crawlEmails = (crawlData.emails || []).map(e => String(e).trim().toLowerCase());
  let targetHostDomain = "";
  try {
    const rawUrl = crawlData.finalUrl || crawlData.originalUrl || "";
    if (rawUrl) targetHostDomain = new URL(rawUrl).hostname.replace(/^www\./i, "").toLowerCase();
  } catch (e) { }

  let email = (result.emailId || "").trim().toLowerCase();
  if (!email && crawlEmails.length > 0) {
    email = crawlEmails[0];
  }
  result.emailId = email;

  let secEmail = (result.secondaryEmailId || "").trim().toLowerCase();
  const primHost = email ? (email.split("@")[1] || "").toLowerCase() : "";

  const isCompanyDomainEmail = (candEmail) => {
    if (!candEmail || typeof candEmail !== "string") return false;
    const candHost = (candEmail.split("@")[1] || "").toLowerCase();
    if (!candHost) return false;
    if (primHost && (candHost === primHost || candHost.endsWith("." + primHost) || primHost.endsWith("." + candHost))) return true;
    if (targetHostDomain && (candHost === targetHostDomain || candHost.endsWith("." + targetHostDomain))) return true;
    return false;
  };

  // If Gemini provided a secondary email, validate it
  if (secEmail) {
    if (secEmail === email) {
      secEmail = "";
    } else if (!isCompanyDomainEmail(secEmail) && !crawlEmails.includes(secEmail)) {
      secEmail = "";
    }
  }

  // Double Check Fallback: If secondary email is missing/empty, take any verified distinct corporate email discovered during crawl!
  if (!secEmail && email) {
    let cand = crawlEmails.find(e => {
      const emLower = (e || "").trim().toLowerCase();
      return emLower && emLower !== email && isCompanyDomainEmail(emLower);
    });
    if (!cand) {
      cand = crawlEmails.find(e => {
        const emLower = (e || "").trim().toLowerCase();
        return emLower && emLower !== email;
      });
    }
    if (cand) {
      secEmail = cand;
    }
  }

  if (secEmail === email) {
    secEmail = "";
  }
  result.secondaryEmailId = secEmail;
  return result;
}

// 1. Amoretti.com
const res1 = testEmailLogic(
  { emailId: "info@amoretti.com", secondaryEmailId: "" },
  { originalUrl: "http://www.amoretti.com", finalUrl: "https://amoretti.com/", emails: ["info@amoretti.com", "orders@amoretti.com"] }
);
console.log("Amoretti.com test:", res1);

// 2. Amoretti Brothers (if someone thought info@amoretti.com is secondary email)
const res2 = testEmailLogic(
  { emailId: "office@amorettibrothers.com", secondaryEmailId: "" },
  { originalUrl: "http://www.amorettibrothers.com", finalUrl: "https://www.amorettibrothers.com/", emails: ["office@amorettibrothers.com", "privacy@amorettibrothers.com"] }
);
console.log("Amorettibrothers.com test:", res2);

