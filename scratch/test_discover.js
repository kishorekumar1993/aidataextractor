async function test() {
  const res = await fetch('http://www.hcsiren.com');
  const html = await res.text();
  
  const candidates = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    const innerText = match[2].replace(/<[^>]+>/g, "").trim().toLowerCase();
    const rawLower = raw.toLowerCase();
    if (!raw || /^(javascript:|mailto:|tel:|#)/i.test(raw)) continue;

    let score = 0;
    if (/\b(contact|contact-us|contactus|contact_us|get-in-touch|reach-us)\b/i.test(rawLower)) score += 10;
    if (/\b(about|about-us|aboutus|about_us|who-we-are|our-company|company-profile|profile)\b/i.test(rawLower)) score += 6;
    if (/\b(contact|contact\s*us|get\s*in\s*touch|reach\s*us)\b/i.test(innerText)) score += 12;
    if (/\b(about|about\s*us|who\s*we\s*are|company\s*profile|our\s*profile)\b/i.test(innerText)) score += 8;

    if (score > 0) {
      candidates.push({ raw, innerText, score });
    }
  }
  console.log('Found candidates:', candidates);
}
test();

