async function test() {
  const res = await fetch('http://www.furco.com.tw');
  const html = await res.text();
  console.log('footer tag:', /<footer/i.test(html));
  console.log('footer class/id:', /<(?:div|section)[^>]+(?:class|id)=["'][^"']*footer/i.test(html));
  const liMatch = html.match(/<li[^>]*class=["']address["'][^>]*>([\s\S]*?)<\/li>/i);
  console.log('li.address:', liMatch ? liMatch[0] : null);
  
  // Where is li.address located? What parent container is it in?
  const idx = html.indexOf('class="address"');
  if (idx !== -1) {
    console.log('Surrounding HTML:\n', html.substring(Math.max(0, idx - 200), idx + 200));
  }
}
test();
