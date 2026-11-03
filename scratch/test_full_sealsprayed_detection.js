const fs = require('fs');
const homeHtml = fs.readFileSync('scratch/sealsprayed.html', 'utf8');
const shopHtml = fs.readFileSync('scratch/sealsprayed_shop.html', 'utf8');
const combinedHtml = homeHtml + "\n" + shopHtml;

function extractJsonLdProductOffer(html) {
  if (!html || typeof html !== "string") return { hasProductOffer: false };
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const checkEntity = (item) => {
        if (!item || typeof item !== "object") return null;
        const itemType = String(item["@type"] || "").toLowerCase();
        const types = Array.isArray(item["@type"]) ? item["@type"].map(t => String(t).toLowerCase()) : [itemType];
        const isProduct = types.some(t => t === "product" || t.endsWith("/product"));

        if (isProduct && item.offers) {
          const offersList = Array.isArray(item.offers) ? item.offers : [item.offers];
          for (const off of offersList) {
            if (!off || typeof off !== "object") continue;
            const offType = String(off["@type"] || "").toLowerCase();
            const offTypes = Array.isArray(off["@type"]) ? off["@type"].map(t => String(t).toLowerCase()) : [offType];
            const isOffer = offTypes.some(t => t === "offer" || t === "aggregateoffer" || t.endsWith("/offer"));

            const rawPrice = off.price !== undefined ? off.price : (off.lowPrice !== undefined ? off.lowPrice : off.highPrice);
            const numPrice = parseFloat(rawPrice);
            if (!isNaN(numPrice) && numPrice > 0) {
              return { hasProductOffer: true, price: numPrice, currency: off.priceCurrency || "", name: item.name || "" };
            }
          }
        }
        return null;
      };

      const traverse = (node) => {
        if (!node) return null;
        if (Array.isArray(node)) {
          for (const el of node) {
            const found = traverse(el);
            if (found) return found;
          }
        } else if (typeof node === "object") {
          const direct = checkEntity(node);
          if (direct) return direct;
          if (node["@graph"] && Array.isArray(node["@graph"])) {
            for (const el of node["@graph"]) {
              const found = traverse(el);
              if (found) return found;
            }
          }
        }
        return null;
      };

      const found = traverse(data);
      if (found) return found;
    } catch (e) { }
  }
  return { hasProductOffer: false };
}

function extractProductLevelPrice(html, text, jsonLdOffer) {
  if (jsonLdOffer && jsonLdOffer.hasProductOffer && jsonLdOffer.price > 0) {
    return { hasPrice: true, price: jsonLdOffer.price, currency: jsonLdOffer.currency, source: "JSON-LD Product Offer" };
  }

  const rawHtml = String(html || "");

  // 1. Microdata / Meta
  const metaPriceMatch = rawHtml.match(/<(?:meta|input)[^>]+(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["'][^>]+content=["']([0-9]+(?:\.[0-9]{2})?)["']/i) ||
    rawHtml.match(/<(?:meta|input)[^>]+content=["']([0-9]+(?:\.[0-9]{2})?)["'][^>]+(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["']/i);
  if (metaPriceMatch) {
    const val = parseFloat(metaPriceMatch[1]);
    if (!isNaN(val) && val > 0) return { hasPrice: true, price: val, source: "Meta/Microdata Product Price" };
  }

  // 2. Dedicated product price HTML containers (global regex loop handling entities & commas)
  const productPriceClassRegex = /(?:class|id)=["'][^"']*\b(?:product[-_]?price|single[-_]?price|offer[-_]?price|sale[-_]?price|current[-_]?price|regular[-_]?price|woocommerce-Price-amount|entry[-_]?price|price-box|price)\b[^"']*["'][^>]*>[\s\S]{0,150}?(?:[\$£€¥₹]|&#36;|&dollar;|&pound;|&#163;|&euro;|&#8364;|&#165;|&#8377;|AU\$|CA\$|USD|EUR|GBP)[\s\S]{0,30}?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/gi;
  let classMatch;
  while ((classMatch = productPriceClassRegex.exec(rawHtml)) !== null) {
    const val = parseFloat(classMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return { hasPrice: true, price: val, source: "Product Price Container" };
  }

  // 3. Price in close proximity (within 150 chars) of an Add to Cart / Buy button
  const proximityRegex = /(?:(?:[\$£€¥₹]|&#36;|&dollar;|&pound;|&#163;|&euro;|&#8364;|&#165;|&#8377;|AU\$|CA\$|USD|EUR|GBP)[\s\S]{0,30}?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)[\s\S]{0,150}?\b(?:add\s+to\s+cart|add\s+to\s+bag|buy\s+now|add\s+to\s+basket)\b|\b(?:add\s+to\s+cart|add\s+to\s+bag|buy\s+now|add\s+to\s+basket)\b[\s\S]{0,150}?(?:[\$£€¥₹]|&#36;|&dollar;|&pound;|&#163;|&euro;|&#8364;|&#165;|&#8377;|AU\$|CA\$|USD|EUR|GBP)[\s\S]{0,30}?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?))/gi;
  let proxMatch;
  while ((proxMatch = proximityRegex.exec(rawHtml)) !== null) {
    const val = parseFloat((proxMatch[1] || proxMatch[2]).replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return { hasPrice: true, price: val, source: "CTA Proximity Price" };
  }

  return { hasPrice: false };
}

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

  // 3. Buttons / links with explicit CTA text
  const ctaTagRegex = /<(?:button|a|input)[^>]*>[\s\S]{0,120}?\b(?:add\s+to\s+cart|add\s+to\s+bag|add\s+to\s+basket|buy\s+now|order\s+now|buy\s+online)\b[\s\S]{0,120}?<\/(?:button|a)>/i;
  const ctaTagMatch = rawHtml.match(ctaTagRegex);
  if (ctaTagMatch) return { hasCart: true, signal: `CTA text: ${ctaTagMatch[0].slice(0, 80)}` };

  const inputSubmitRegex = /<input[^>]+(?:type=["'](?:submit|button)["'])[^>]+value=["'][^"']*\b(?:add\s+to\s+cart|add\s+to\s+bag|add\s+to\s+basket|buy\s+now|order\s+now)\b[^"']*["']/i;
  const inputSubmitMatch = rawHtml.match(inputSubmitRegex);
  if (inputSubmitMatch) return { hasCart: true, signal: `Input submit: ${inputSubmitMatch[0].slice(0, 80)}` };

  const ariaLabelRegex = /<(?:button|a|div|span)[^>]+aria-label=["'][^"']*\b(?:add\s+to\s+cart|add\s+to\s+bag|add\s+to\s+basket|buy\s+now)\b[^"']*["']/i;
  const ariaMatch = rawHtml.match(ariaLabelRegex);
  if (ariaMatch) return { hasCart: true, signal: `Aria label: ${ariaMatch[0].slice(0, 80)}` };

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

  // 4. Checkout buttons / forms
  const checkoutFormRegex = /<form[^>]+action=["'][^"']*(?:\/(?:checkout|express_checkout|onepagecheckout)\b)[^"']*["']/i;
  const formMatch = rawHtml.match(checkoutFormRegex);
  if (formMatch) return { hasCheckout: true, signal: `Checkout form: ${formMatch[0].slice(0, 80)}` };

  const checkoutBtnRegex = /<(?:button|a|input)[^>]*>[\s\S]{0,120}?\b(?:proceed\s+to\s+checkout|checkout\s+now|place\s+order|pay\s+now|complete\s+order|checkout)\b/i;
  const btnMatch = rawHtml.match(checkoutBtnRegex);
  if (btnMatch) return { hasCheckout: true, signal: `Checkout button: ${btnMatch[0].slice(0, 80)}` };

  return { hasCheckout: false };
}

function extractFulfillmentLogistics(html, text) {
  const combined = String(html || "") + " " + String(text || "");
  const shippingRegex = /\b(?:shipping\s+(?:policy|information|rates|charges|options|method)|delivery\s+(?:policy|timelines|charges)|free\s+shipping\s+on\s+orders|calculated\s+at\s+checkout|estimated\s+delivery|ships\s+in\s+\d+\s*(?:business\s+)?days|dispatch\s+within\s+\d+\s*(?:business\s+)?days|courier\s+delivery)\b/i;
  const returnsRegex = /\b(?:return\s+policy|returns\s+(?:&|and)\s+exchanges|refund\s+policy|order\s+tracking|track\s+(?:your\s+)?order|track\s+shipment)\b/i;

  const shipMatch = combined.match(shippingRegex);
  const retMatch = combined.match(returnsRegex);
  if (shipMatch || retMatch) return { hasFulfillment: true, signal: shipMatch ? shipMatch[0] : retMatch[0] };
  return { hasFulfillment: false };
}

function extractB2BExclusions(html, text) {
  const rawHtml = String(html || "");
  const rawText = String(text || "");
  const combined = rawHtml + " " + rawText;

  const productQuoteCtaRegex = /<(?:button|a|input)[^>]*>[\s\S]{0,100}?\b(?:request\s+(?:a\s+)?quote|get\s+(?:a\s+)?quote|ask\s+for\s+(?:a\s+)?quote|request\s+pricing|contact\s+(?:us\s+)?for\s+pric(?:e|ing)|call\s+for\s+pric(?:e|ing)|price\s+on\s+(?:application|request)|inquir(?:y|e)\s+(?:for\s+pric(?:e|ing)|about\s+pric(?:e|ing)|now|online|cart|basket|list)|send\s+inquiry|add\s+to\s+quote|quote\s+(?:cart|basket|list|request)|rfq)\b[\s\S]{0,100}?<\/(?:button|a)>/i;
  const quoteCtaMatch = rawHtml.match(productQuoteCtaRegex);

  const dealerCtaRegex = /<(?:button|a)[^>]*>[\s\S]{0,80}?\b(?:find\s+(?:a\s+)?dealer|dealer\s+locator|where\s+to\s+buy|find\s+(?:a\s+)?distributor|distributor\s+locator|locate\s+(?:a\s+)?dealer|our\s+distributors)\b[\s\S]{0,80}?<\/(?:button|a)>/i;
  const dealerCtaMatch = rawHtml.match(dealerCtaRegex);

  const generalQuoteRegex = /\b(?:request\s+(?:a\s+)?quote|get\s+(?:a\s+)?quote|contact\s+sales|inquir(?:y|e)\s+(?:for\s+pric(?:e|ing)|about\s+pric(?:e|ing)|basket|cart)|add\s+to\s+quote)\b/i;
  const generalDealerRegex = /\b(?:find\s+(?:a\s+)?dealer|dealer\s+locator|where\s+to\s+buy|distributor\s+locator)\b/i;

  return {
    hasProductQuoteCta: !!quoteCtaMatch,
    hasProductDealerCta: !!dealerCtaMatch,
    hasGeneralQuote: generalQuoteRegex.test(combined),
    hasGeneralDealer: generalDealerRegex.test(combined),
    isQuoteOnlyPurchasing: !!quoteCtaMatch || !!dealerCtaMatch,
    signal: quoteCtaMatch ? quoteCtaMatch[0] : (dealerCtaMatch ? dealerCtaMatch[0] : "")
  };
}

function detectPurchaseOrShoppingCart(html = "", text = "") {
  if (!html && !text) return { detected: false, reason: "", isHighConfidence: false };
  const rawHtml = String(html || "");
  const rawText = String(text || "");

  const jsonLdOffer = extractJsonLdProductOffer(rawHtml);
  const cartRes = extractFunctionalCartAction(rawHtml);
  const priceRes = extractProductLevelPrice(rawHtml, rawText, jsonLdOffer);
  const checkoutRes = extractCheckoutGateway(rawHtml);
  const fulfillRes = extractFulfillmentLogistics(rawHtml, rawText);
  const b2bRes = extractB2BExclusions(rawHtml, rawText);

  const hasTransactionCapability = cartRes.hasCart && priceRes.hasPrice && checkoutRes.hasCheckout;
  const hasSecondarySignal = fulfillRes.hasFulfillment || jsonLdOffer.hasProductOffer;

  const evidence = {
    hasCartAction: cartRes.hasCart,
    cartSignal: cartRes.signal || "",
    hasProductPrice: priceRes.hasPrice,
    priceSignal: priceRes.source ? `${priceRes.source} (${priceRes.currency || ''} ${priceRes.price || ''})` : "",
    hasCheckoutGateway: checkoutRes.hasCheckout,
    checkoutSignal: checkoutRes.signal || "",
    hasFulfillment: fulfillRes.hasFulfillment,
    fulfillmentSignal: fulfillRes.signal || "",
    hasProductSchema: jsonLdOffer.hasProductOffer,
    schemaSignal: jsonLdOffer.hasProductOffer ? `Product: ${jsonLdOffer.name || 'Yes'}, Price: ${jsonLdOffer.currency} ${jsonLdOffer.price}` : "",
    hasB2BQuoteOrDealer: b2bRes.isQuoteOnlyPurchasing || b2bRes.hasGeneralQuote,
    b2bSignal: b2bRes.signal || ""
  };

  // If the site has functional cart action, defined product price, and checkout/cart gateway:
  // It is verified as Online Shopping (direct purchasing capability exists)!
  if (hasTransactionCapability) {
    const reason = `E-Commerce Verified (Cart: ${cartRes.signal || 'Yes'} + Price: ${priceRes.source || 'Yes'} (${priceRes.price}) + Checkout: ${checkoutRes.signal || 'Yes'})`;
    return {
      detected: true,
      reason: reason,
      isEcommerce: true,
      isB2BCatalog: false,
      isHighConfidence: true,
      evidence: evidence
    };
  }

  // Not direct transaction: check if B2B Quote / Dealer catalog
  if (b2bRes.isQuoteOnlyPurchasing || b2bRes.hasGeneralQuote || b2bRes.hasGeneralDealer) {
    return {
      detected: false,
      reason: "",
      isEcommerce: false,
      isB2BCatalog: true,
      isHighConfidence: false,
      b2bSignal: b2bRes.signal || "Quote / Dealer Catalog",
      evidence: evidence
    };
  }

  return {
    detected: false,
    reason: "",
    isEcommerce: false,
    isB2BCatalog: false,
    isHighConfidence: false,
    evidence: evidence
  };
}

console.log('Result for sealsprayed.com combinedHtml:');
const res = detectPurchaseOrShoppingCart(combinedHtml, '');
console.log(JSON.stringify(res, null, 2));

