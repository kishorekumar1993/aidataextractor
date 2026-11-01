const fs = require('fs');

function discoverContactLinksFixed(html, baseUrl) {
  if (!html) return [];
  // Match both href and anchor text
  const linkMatches = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const scoredLinks = [];

  for (const m of linkMatches) {
    const raw = m[1];
    const text = m[2].replace(/<[^>]+>/g, "").trim().toLowerCase();

    if (/^(tel:|mailto:|javascript:|#)/i.test(raw)) continue;
    if (/\.(css|js|png|jpg|jpeg|gif|svg|webp|pdf|zip|cgi|dat|exe)$/i.test(raw)) continue;
    if (/\/cgi-bin\//i.test(raw)) continue;

    let score = 0;
    const lower = raw.toLowerCase();
    const combined = lower + " " + text;

    if (/head-?office|headquarters?|corporate-?office/i.test(combined)) score += 100;
    else if (/company-?profile|corporate-?profile|profile\.htm|profile/i.test(combined)) score += 95;
    else if (/contact-?us|contactus|get-in-touch|reach-us/i.test(combined)) score += 90;
    else if (/about-?us|aboutus|who-we-are|our-company|our-story|our-history/i.test(combined)) score += 85;
    else if (/\bcontact\b|\babout\b/i.test(text) || /\bcontact\b|\babout\b/i.test(lower)) score += 80;
    else if (/sales|support|service|enquir|inquir|quote|request-quote/i.test(combined)) score += 70;
    else if (/team|staff|management|leadership|our-people|directors/i.test(combined)) score += 65;
    else if (/location|locations|branches|our-offices|find-us|dealers|distributors/i.test(combined)) score += 55;
    else if (/product|products|catalog|store/i.test(combined)) score += 45;
    else if (/feedback|customer-care/i.test(combined)) score += 40;
    else if (/imprint|impressum|legal|privacy/i.test(combined)) score += 35;

    if (score > 0) {
      try {
        const fullUrl = new URL(raw, baseUrl).href;
        scoredLinks.push({ url: fullUrl, score, text, raw });
      } catch (e) { }
    }
  }

  scoredLinks.sort((a, b) => b.score - a.score);
  return scoredLinks;
}

const fetch = globalThis.fetch;
async function test() {
  const res = await fetch('http://www.hcsiren.com');
  const html = await res.text();
  const links = discoverContactLinksFixed(html, 'http://www.hcsiren.com');
  console.log('Top scored links:');
  for (const l of links.slice(0, 10)) {
    console.log(l.score, l.url, '(', l.text, ')');
  }
}
test();
