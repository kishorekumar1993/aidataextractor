const str = '<span class="woocommerce-Price-amount amount"><bdi><span class="woocommerce-Price-currencySymbol" translate="no" dir="auto">&#36;</span>25,300.00</bdi></span>';

const reg = /woocommerce-Price-amount[\s\S]*?&#36;[\s\S]*?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/;
const m = str.match(reg);
console.log('Match on exact string:', m ? m[1] : null);

