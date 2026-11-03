const fs = require('fs');
const homeHtml = fs.readFileSync('scratch/sealsprayed.html', 'utf8');
const shopHtml = fs.readFileSync('scratch/sealsprayed_shop.html', 'utf8');
const combinedHtml = homeHtml + "\n" + shopHtml;

// Updated extractProductLevelPrice with tag-agnostic regex & HTML entity decoding
function extractProductLevelPrice(html, text, jsonLdOffer) {
  if (jsonLdOffer && jsonLdOffer.hasProductOffer && jsonLdOffer.price > 0) {
    return { hasPrice: true, price: jsonLdOffer.price, currency: jsonLdOffer.currency, source: "JSON-LD Product Offer" };
  }

  const rawHtml = String(html || "");

  // 1. Meta / Microdata
  const metaPriceMatch = rawHtml.match(/<(?:meta|input)[^>]+(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["'][^>]+content=["']([0-9]+(?:\.[0-9]{2})?)["']/i) ||
    rawHtml.match(/<(?:meta|input)[^>]+content=["']([0-9]+(?:\.[0-9]{2})?)["'][^>]+(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["']/i);
  if (metaPriceMatch) {
    const val = parseFloat(metaPriceMatch[1]);
    if (!isNaN(val) && val > 0) return { hasPrice: true, price: val, source: "Meta/Microdata Product Price" };
  }

  // 2. Dedicated product price containers (handles WooCommerce / Shopify inner tags and currency entities)
  const productPriceClassRegex = /(?:class|id)=["'][^"']*\b(?:product[-_]?price|single[-_]?price|offer[-_]?price|sale[-_]?price|current[-_]?price|regular[-_]?price|woocommerce-Price-amount|entry[-_]?price|price-box|price)\b[^"']*["'][^>]*>[\s\S]{0,150}?(?:[\$£€¥₹]|&#36;|&dollar;|&pound;|&#163;|&euro;|&#8364;|&#165;|&#8377;|AU\$|CA\$|USD|EUR|GBP)(?:<\/[^>]+>|\s)*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i;
  const classMatch = rawHtml.match(productPriceClassRegex);
  if (classMatch) {
    const val = parseFloat(classMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return { hasPrice: true, price: val, source: "Product Price Container" };
  }

  // 3. Price near CTA
  const proximityRegex = /(?:(?:[\$£€¥₹]|&#36;|&dollar;|&pound;|&#163;|&euro;|&#8364;|&#165;|&#8377;|AU\$|CA\$|USD|EUR|GBP)(?:<\/[^>]+>|\s)*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)[\s\S]{0,150}?\b(?:add\s+to\s+cart|add\s+to\s+bag|buy\s+now|add\s+to\s+basket)\b|\b(?:add\s+to\s+cart|add\s+to\s+bag|buy\s+now|add\s+to\s+basket)\b[\s\S]{0,150}?(?:[\$£€¥₹]|&#36;|&dollar;|&pound;|&#163;|&euro;|&#8364;|&#165;|&#8377;|AU\$|CA\$|USD|EUR|GBP)(?:<\/[^>]+>|\s)*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?))/i;
  const proxMatch = rawHtml.match(proximityRegex);
  if (proxMatch) {
    const val = parseFloat((proxMatch[1] || proxMatch[2]).replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return { hasPrice: true, price: val, source: "CTA Proximity Price" };
  }

  return { hasPrice: false };
}

// Updated extractFunctionalCartAction
function extractFunctionalCartAction(html) {
  const rawHtml = String(html || "");

  // 1. Form submitting to cart endpoint
  const cartFormRegex = /<form[^>]+action=["'][^"']*(?:\/cart\/add|\/cart|\/basket|\/bag|add-to-cart)[^"']*["']/i;
  const formMatch = rawHtml.match(cartFormRegex);
  if (formMatch) return { hasCart: true, signal: `Form action: ${formMatch[0].slice(0, 80)}` };

  // 2. Query param add-to-cart link (WooCommerce standard)
  const addParamRegex = /href=["'][^"']*[?&]add-to-cart=\d+[^"']*["']/i;
  const addParamMatch = rawHtml.match(addParamRegex);
  if (addParamMatch) return { hasCart: true, signal: `Add to cart link param: ${addParamMatch[0].slice(0, 80)}` };

  // 3. Buttons / links with explicit CTA
  const ctaTagRegex = /<(?:button|a|input)[^>]*>[\s\S]{0,120}?\b(?:add\s+to\s+cart|add\s+to\s+bag|add\s+to\s+basket|buy\s+now|order\s+now|buy\s+online)\b[\s\S]{0,120}?<\/(?:button|a)>/i;
  const ctaTagMatch = rawHtml.match(ctaTagRegex);
  if (ctaTagMatch) return { hasCart: true, signal: `CTA text: ${ctaTagMatch[0].slice(0, 80)}` };

  // 4. Established e-commerce add to cart button classes / IDs
  const cartBtnClassRegex = /\b(?:single_add_to_cart_button|add_to_cart_button|ajax_add_to_cart|snipcart-add-item|shopify-payment-button)\b/i;
  const classMatch = rawHtml.match(cartBtnClassRegex);
  if (classMatch) return { hasCart: true, signal: `Cart button class: ${classMatch[0]}` };

  // 5. Active Shop navigation route + e-commerce cart widget
  const shopNavRegex = /<a[^>]+href=["'][^"']*\/(?:shop|store|online[-_]?store)\/?["'][^>]*>[\s\S]{0,60}?\b(?:shop|store|online\s+store)\b[\s\S]{0,60}?<\/a>/i;
  const cartWidgetRegex = /\b(?:widget-woocommerce-menu-cart|woocommerce-cart|site-header__cart|cart-drawer)\b/i;
  if (shopNavRegex.test(rawHtml) && cartWidgetRegex.test(rawHtml)) {
    return { hasCart: true, signal: "Active Shop navigation with shopping cart widget" };
  }

  return { hasCart: false };
}

// Updated extractCheckoutGateway
function extractCheckoutGateway(html) {
  const rawHtml = String(html || "");

  // 1. Direct standard checkout route links (href)
  const checkoutRouteRegex = /<a[^>]+href=["'][^"']*(?:\/(?:checkout|express_checkout|onepagecheckout|cart\/checkout)\b)(?:\/|["'?#])/i;
  const routeMatch = rawHtml.match(checkoutRouteRegex);
  if (routeMatch) return { hasCheckout: true, signal: `Checkout route link: ${routeMatch[0].slice(0, 80)}` };

  // 2. Direct shopping cart route link (href)
  const cartRouteRegex = /<a[^>]+href=["'][^"']*(?:\/(?:cart|basket|shopping[-_]?cart|my[-_]?cart)\b)(?:\/|["'?#])/i;
  const cartMatch = rawHtml.match(cartRouteRegex);
  if (cartMatch) return { hasCheckout: true, signal: `Shopping cart route link: ${cartMatch[0].slice(0, 80)}` };

  // 3. E-commerce active cart components (WooCommerce, Shopify cart widgets)
  const cartWidgetRegex = /\b(?:widget-woocommerce-menu-cart|wc-cart-fragments|snipcart\.com|checkout\.stripe\.com|paypal\.com\/checkout|pay\.shopify\.com)\b/i;
  const widgetMatch = rawHtml.match(cartWidgetRegex);
  if (widgetMatch) return { hasCheckout: true, signal: `E-commerce cart widget: ${widgetMatch[0]}` };

  // 4. Checkout buttons
  const checkoutBtnRegex = /<(?:button|a|input)[^>]*>[\s\S]{0,120}?\b(?:proceed\s+to\s+checkout|checkout\s+now|place\s+order|pay\s+now|complete\s+order|checkout)\b/i;
  const btnMatch = rawHtml.match(checkoutBtnRegex);
  if (btnMatch) return { hasCheckout: true, signal: `Checkout button: ${btnMatch[0].slice(0, 80)}` };

  return { hasCheckout: false };
}

console.log('Testing price on combinedHtml:', extractProductLevelPrice(combinedHtml));
console.log('Testing cart on combinedHtml:', extractFunctionalCartAction(combinedHtml));
console.log('Testing checkout on combinedHtml:', extractCheckoutGateway(combinedHtml));
console.log('Testing cart on homeHtml alone:', extractFunctionalCartAction(homeHtml));
console.log('Testing checkout on homeHtml alone:', extractCheckoutGateway(homeHtml));

