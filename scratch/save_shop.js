async function saveShop() {
  const res = await fetch('https://sealsprayed.com/shop/');
  const t = await res.text();
  const fs = require('fs');
  fs.writeFileSync('scratch/sealsprayed_shop.html', t);
  console.log('Saved sealsprayed_shop.html, length:', t.length);
}
saveShop().catch(e => console.error(e));

