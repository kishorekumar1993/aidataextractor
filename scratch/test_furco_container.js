async function test() {
  const res = await fetch('http://www.furco.com.tw');
  const html = await res.text();
  
  const idx = html.indexOf('class="address"');
  console.log('Surrounding 800 chars:\n', html.substring(Math.max(0, idx - 400), idx + 400));
}
test();
