async function test() {
  const res = await fetch('http://www.furco.com.tw');
  const html = await res.text();
  
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i) ||
    html.match(/<(?:div|section)[^>]+(?:class|id)=["'][^"']*footer[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
  
  console.log('footerMatch tag/attr:', footerMatch ? footerMatch[0].substring(0, 150) : null);
  console.log('footerMatch length:', footerMatch ? footerMatch[0].length : 0);
  console.log('Does footerMatch include Xiushui?:', footerMatch ? footerMatch[0].includes('Xiushui') : false);
  console.log('Does footerMatch include address?:', footerMatch ? footerMatch[0].includes('class="address"') : false);
}
test();
