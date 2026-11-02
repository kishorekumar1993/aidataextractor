const fs = require('fs');

async function test() {
  const res = await fetch('http://www.hcsiren.com/us/?lang=en');
  const html = await res.text();
  
  function stripHtml(html) {
    if (!html) return "";
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/address|\/h[1-6])[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/[^\S\r\n]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const addressCandidates = [];
  function addAddressCandidate(list, rawAddr, source, isHq) {
    list.push({ raw: rawAddr, source, isHq });
  }

  // 1. Explicit Headquarters / Head Office blocks (Priority 1)
  const hqRegex = /(?:headquarters|head\s*office|corporate\s*office|registered\s*office|main\s*office|hq)\s*[:\-–]?\s*<(?:p|div|span|address)[^>]*>([\s\S]*?)<\/(?:p|div|span|address)>/gi;
  let hqm;
  while ((hqm = hqRegex.exec(html)) !== null) {
    const raw = stripHtml(hqm[1]);
    if (raw.length > 8) {
      addAddressCandidate(addressCandidates, raw, "headquarters", true);
    }
  }

  // 2. <h1-6> with "address" followed by <p>, <div>, or <span>
  const headingRegex = /<h[1-6][^>]*>[^<]*address[^<]*<\/h[1-6]>\s*<(?:p|div|span)[^>]*>([\s\S]*?)<\/(?:p|div|span)>/gi;
  let hm;
  while ((hm = headingRegex.exec(html)) !== null) {
    const raw = stripHtml(hm[1]);
    if (raw.length > 10) {
      addAddressCandidate(addressCandidates, raw, "contact", false);
    }
  }

  // 3. <address> tag
  const addrTagRegex = /<address[^>]*>([\s\S]*?)<\/address>/gi;
  let am;
  while ((am = addrTagRegex.exec(html)) !== null) {
    const raw = stripHtml(am[1]);
    if (raw.length > 10) {
      addAddressCandidate(addressCandidates, raw, "contact", false);
    }
  }

  // 4. Class or id containing "address"
  const classAddrRegex = /<(?:div|p|span|section)[^>]+(?:class|id)=["'][^"']*address[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p|span|section)>/gi;
  let cm;
  while ((cm = classAddrRegex.exec(html)) !== null) {
    const raw = stripHtml(cm[1]);
    if (raw.length > 10) {
      addAddressCandidate(addressCandidates, raw, "contact", false);
    }
  }

  console.log('Address candidates extracted:', addressCandidates);
}
test();

