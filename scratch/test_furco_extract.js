const fs = require('fs');

async function testExtraction() {
  const res = await fetch('http://www.furco.com.tw');
  const html = await res.text();

  const candidates = [];
  function addAddressCandidate(targetList, rawText, source, isHq = false) {
    if (!rawText || typeof rawText !== "string") return;
    const cleaned = rawText
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/^(?:address|add|addr|location|地址|廠址)\s*[:：]\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length < 8) return;
    if (!/\b(road|street|avenue|lane|drive|way|boulevard|highway|via|corso|viale|piazza|town|township|district|city|province|county|hsien|state|building|floor|suite|box|number|no|#|\d{3,6})\b/i.test(cleaned)) {
      return;
    }

    const exists = targetList.some(c => (typeof c === "string" ? c : c.raw).toLowerCase() === cleaned.toLowerCase());
    if (!exists) {
      targetList.push({
        raw: cleaned,
        source: source || "general",
        isHeadquarters: isHq
      });
    }
  }

  // 1. Tag with class or id containing address (including li, div, p, span, section, td, dd)
  const classAddrRegex = /<(?:div|p|span|section|li|td|dd)[^>]+(?:class|id)=["'][^"']*(?:address|addr\b)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p|span|section|li|td|dd)>/gi;
  let cm;
  while ((cm = classAddrRegex.exec(html)) !== null) {
    addAddressCandidate(candidates, cm[1], "contact", false);
  }

  // 2. Explicit label Add: / Address:
  const labelAddrRegex = /(?:address|add|addr)\s*[:：]\s*(?:<\/?(?:span|strong|b|em)[^>]*>)*\s*([^<\r\n]+(?:\s*<br\s*\/?>\s*[^<\r\n]+)*)/gi;
  let lm;
  while ((lm = labelAddrRegex.exec(html)) !== null) {
    addAddressCandidate(candidates, lm[1], "contact", false);
  }

  console.log('Extracted candidates:', candidates);
}

testExtraction();
