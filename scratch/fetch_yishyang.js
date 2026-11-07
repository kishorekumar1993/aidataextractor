const fs = require('fs');

fetch("http://www.yi-shyang.com.tw/contact.html").then(r => r.text()).then(html => {
  console.log("HTML length:", html.length);
  // Look for map iframe or coordinates or addresses
  const iframes = html.match(/<iframe[^>]+>/gi) || [];
  console.log("iframes:", iframes);
  const maps = html.match(/google\.com\/maps[^\s"'>]+/gi) || [];
  console.log("maps:", maps);
  const addrMatches = html.match(/baoshun|pao\s*shun|chiayi|chia\s*yi|houhu|228/gi) || [];
  console.log("addrMatches count:", addrMatches.length);
  // find lines containing 228
  const lines = html.split('\n').filter(l => l.includes('228') || l.toLowerCase().includes('baoshun') || l.toLowerCase().includes('chiayi'));
  console.log("lines with address info:", lines);
});

