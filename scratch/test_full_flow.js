const fs = require('fs');

async function testFullFlow() {
  const res = await fetch('http://www.furco.com.tw');
  const mainHtml = await res.text();

  const addressCandidates = [];

  function addAddressCandidate(targetList, rawText, source, isHq = false) {
    if (!rawText || typeof rawText !== "string") return;
    const cleaned = rawText
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/^(?:address|add|addr|location|headquarters|head\s*office|registered\s*office|corporate\s*office|廠址|地址)\s*[:：\-–]?\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length < 8) return;
    if (!/\b(road|street|avenue|lane|drive|way|boulevard|highway|via|corso|viale|piazza|town|township|district|city|province|county|hsien|state|building|floor|suite|box|number|no|#|\d{3,6})\b/i.test(cleaned) &&
        !/[\u4e00-\u9fa5]{3,}/.test(cleaned)) {
      return;
    }

    const latinLetters = (cleaned.match(/[a-zA-Z]/g) || []).length;
    const nonLatinLetters = (cleaned.match(/[\u4e00-\u9fa5\u3040-\u30ff\u0e00-\u0e7f\u0400-\u04ff\u0600-\u06ff]/g) || []).length;
    const isEnglish = latinLetters >= 4 && latinLetters >= nonLatinLetters;

    // Priority ranking: headquarters (1) > contact (2) > profile (3) > jsonld (4) > map (5) > footer (6)
    let priority = 6;
    if (isHq || source === "headquarters") priority = 1;
    else if (source === "contact") priority = 2;
    else if (source === "profile") priority = 3;
    else if (source === "jsonld") priority = 4;
    else if (source === "map") priority = 5;

    // Deprioritize non-English candidates if English candidates are present
    if (!isEnglish) {
      priority += 10;
    }

    const exists = targetList.some(c => (typeof c === "string" ? c : c.raw).toLowerCase() === cleaned.toLowerCase());
    if (!exists) {
      targetList.push({
        raw: cleaned,
        source: source || "general",
        priority: priority,
        isHeadquarters: isHq || source === "headquarters",
        isEnglish: isEnglish
      });
    }
  }

  function extractJsonLdAddresses(html, targetList) {
    if (!html) return;
    const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        const processItem = item => {
          if (!item || typeof item !== "object") return;
          if (item.address && typeof item.address === "object") {
            const a = item.address;
            const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry].filter(Boolean);
            if (parts.length >= 2) {
              addAddressCandidate(targetList, parts.join(", "), "jsonld", false);
            }
          }
        };
        if (Array.isArray(data)) data.forEach(processItem);
        else if (data["@graph"] && Array.isArray(data["@graph"])) data["@graph"].forEach(processItem);
        else processItem(data);
      } catch (e) { }
    }
  }

  function extractHtmlAddresses(html, targetList, defaultSource = "contact") {
    if (!html) return;

    // 1. Explicit Headquarters / Head Office blocks (Priority 1)
    const hqRegex = /(?:headquarters|head\s*office|corporate\s*office|registered\s*office|main\s*office|hq)\s*[:\-–]?\s*<(?:p|div|span|address|li|td|dd)[^>]*>([\s\S]*?)<\/(?:p|div|span|address|li|td|dd)>/gi;
    let hqm;
    while ((hqm = hqRegex.exec(html)) !== null) {
      const raw = hqm[1].replace(/<[^>]+>/g, " ").trim();
      if (raw.length > 8) {
        addAddressCandidate(targetList, raw, "headquarters", true);
      }
    }

    // 2. <h1-6> with "address" followed by <p>, <div>, <span>, <li>
    const headingRegex = /<h[1-6][^>]*>[^<]*address[^<]*<\/h[1-6]>\s*<(?:p|div|span|li|td)[^>]*>([\s\S]*?)<\/(?:p|div|span|li|td)>/gi;
    let hm;
    while ((hm = headingRegex.exec(html)) !== null) {
      const raw = hm[1].replace(/<[^>]+>/g, " ").trim();
      if (raw.length > 10) {
        addAddressCandidate(targetList, raw, defaultSource, false);
      }
    }

    // 3. <address> tag
    const addrTagRegex = /<address[^>]*>([\s\S]*?)<\/address>/gi;
    let am;
    while ((am = addrTagRegex.exec(html)) !== null) {
      const raw = am[1].replace(/<[^>]+>/g, " ").trim();
      if (raw.length > 10) {
        addAddressCandidate(targetList, raw, defaultSource, false);
      }
    }

    // 4. Class or id containing "address" or "addr" (including li, td, dd, article)
    const classAddrRegex = /<(?:div|p|span|section|li|td|dd|article)[^>]+(?:class|id)=["'][^"']*(?:address|addr\b)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p|span|section|li|td|dd|article)>/gi;
    let cm;
    while ((cm = classAddrRegex.exec(html)) !== null) {
      const raw = cm[1].replace(/<[^>]+>/g, " ").trim();
      if (raw.length > 10) {
        addAddressCandidate(targetList, raw, defaultSource, false);
      }
    }

    // 5. Explicit label prefixes Add: / Address:
    const labelAddrRegex = /(?:address|add|addr)\s*[:：]\s*(?:<[^>]+>)*\s*([^<\r\n]+(?:\s*<br\s*\/?>\s*[^<\r\n]+)*)/gi;
    let lm;
    while ((lm = labelAddrRegex.exec(html)) !== null) {
      const raw = lm[1].replace(/<[^>]+>/g, " ").trim();
      if (raw.length > 10) {
        addAddressCandidate(targetList, raw, defaultSource, false);
      }
    }
  }

  extractJsonLdAddresses(mainHtml, addressCandidates);
  extractHtmlAddresses(mainHtml, addressCandidates, "contact");

  console.log('All candidates found:');
  console.dir(addressCandidates, { depth: null });

  // Sort candidates
  const sorted = [...addressCandidates].sort((a, b) => {
    const aIsEng = a.isEnglish ? 1 : 0;
    const bIsEng = b.isEnglish ? 1 : 0;
    if (aIsEng !== bIsEng) return bIsEng - aIsEng; // English first
    return a.priority - b.priority;
  });

  console.log('\nSorted candidates (English priority):');
  console.dir(sorted, { depth: null });
}

testFullFlow();
