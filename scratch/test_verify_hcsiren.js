function verifyAndSelectAddress(geminiAddr, candidates) {
  if (!candidates || candidates.length === 0) {
    if (!geminiAddr || geminiAddr.length < 8 || /^(?:not\s*available|n\/?a|none|unknown)$/i.test(geminiAddr.trim())) {
      return "Not Available";
    }
    return geminiAddr;
  }

  // Sort candidates by priority (1 = headquarters, 2 = contact, 3 = profile, 4 = jsonld, 5 = map, 6 = footer)
  const sorted = [...candidates].sort((a, b) => {
    const pA = typeof a === "object" ? a.priority : 6;
    const pB = typeof b === "object" ? b.priority : 6;
    return pA - pB;
  });

  const getRaw = c => (typeof c === "object" ? c.raw : c);
  const hqCandidate = sorted.find(c => typeof c === "object" && (c.isHeadquarters || c.source === "headquarters"));

  if (!geminiAddr || geminiAddr.length < 5 || /^(?:not\s*available|n\/?a|none|unknown)$/i.test(geminiAddr.trim())) {
    return getRaw(sorted[0]);
  }

  // Extract key tokens from Gemini's address to test support against website evidence
  const geminiTokens = geminiAddr
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2);

  let bestCandidate = null;
  let maxOverlap = 0;

  for (const cand of sorted) {
    const candRaw = getRaw(cand);
    const candLower = candRaw.toLowerCase();
    let overlapCount = 0;
    for (const token of geminiTokens) {
      if (candLower.includes(token)) overlapCount++;
    }
    const ratio = geminiTokens.length > 0 ? overlapCount / geminiTokens.length : 0;
    if (ratio > maxOverlap) {
      maxOverlap = ratio;
      bestCandidate = cand;
    }
  }

  console.log('geminiTokens:', geminiTokens);
  console.log('maxOverlap:', maxOverlap);
  console.log('bestCandidate:', bestCandidate);

  // If Gemini address matches verified website evidence
  if (maxOverlap >= 0.35 && bestCandidate) {
    // If an explicit headquarters address was identified and Gemini picked another, ALWAYS prefer headquarters
    if (hqCandidate && bestCandidate !== hqCandidate) {
      return getRaw(hqCandidate);
    }
    // If website candidate preserves a street number that Gemini dropped, prefer candidate
    const candRaw = getRaw(bestCandidate);
    const candNumMatch = candRaw.match(/(?:^|[\s,#])(\d+)\b/);
    const geminiNumMatch = geminiAddr.match(/(?:^|[\s,#])(\d+)\b/);
    console.log('candNumMatch:', candNumMatch);
    console.log('geminiNumMatch:', geminiNumMatch);
    if (candNumMatch && !geminiNumMatch) {
      return candRaw;
    }
    if (candRaw.length > geminiAddr.length && / (road|street|avenue|lane|drive|way|boulevard|highway|rd|st|ave|blvd|via|corso|viale|piazza|village) /i.test(candRaw) && !/ (road|street|avenue|lane|drive|way|boulevard|highway|rd|st|ave|blvd|via|corso|viale|piazza) /i.test(geminiAddr)) {
      return candRaw;
    }
    return geminiAddr;
  }

  // Unsupported Gemini address -> reject and fall back to top verified website candidate
  if (sorted.length > 0) {
    return getRaw(sorted[0]);
  }

  return "Not Available";
}

const cand = {
  raw: "398# Cilong East Road, Jin'ao Village, Longshan Town, Cixi City, Zhejiang Province, China",
  source: 'contact',
  priority: 2
};
const geminiAddr = "Longshan Town, Cixi City, Zhejiang Province";
console.log("Result:", verifyAndSelectAddress(geminiAddr, [cand]));

