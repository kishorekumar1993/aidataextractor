async function test() {
  const res = await fetch('http://www.hcsiren.com/us/?lang=en');
  const html = await res.text();
  console.log('us/?lang=en status:', res.status, 'len:', html.length);
  console.log('contains 398:', html.includes('398'));
  console.log('contains Cilong:', html.includes('Cilong'));
  if (html.includes('Cilong')) {
    const idx = html.indexOf('Cilong');
    console.log('snippet:', html.substring(Math.max(0, idx - 100), idx + 200));
  }
}
test();

