const fs = require('fs');

// Read background.js
const bgCode = fs.readFileSync('d:/SoftwareWork/extension/aiextension/background.js', 'utf8');

// Isolate all relevant helper functions from background.js
const extractJsonLdProductOffer = eval(`(${bgCode.match(/function extractJsonLdProductOffer[\s\S]*?\n\}/)[0]})`);
const extractProductLevelPrice = eval(`(${bgCode.match(/function extractProductLevelPrice[\s\S]*?\n\}/)[0]})`);
const extractFunctionalCartAction = eval(`(${bgCode.match(/function extractFunctionalCartAction[\s\S]*?\n\}/)[0]})`);
const extractCheckoutGateway = eval(`(${bgCode.match(/function extractCheckoutGateway[\s\S]*?\n\}/)[0]})`);
const extractFulfillmentLogistics = eval(`(${bgCode.match(/function extractFulfillmentLogistics[\s\S]*?\n\}/)[0]})`);
const extractB2BExclusions = eval(`(${bgCode.match(/function extractB2BExclusions[\s\S]*?\n\}/)[0]})`);
const detectPurchaseOrShoppingCart = eval(`(${bgCode.match(/function detectPurchaseOrShoppingCart[\s\S]*?\n\}/)[0]})`);

const userTestCases = [
  {
    name: "1. Product + Add to Cart + Price + Checkout",
    html: `
      <html>
        <body>
          <h1>Performance Cycling Jersey</h1>
          <div class="product-price">$89.00</div>
          <button class="btn single_add_to_cart_button">Add to Cart</button>
          <a href="/checkout" class="checkout-btn">Proceed to Checkout</a>
          <p>Free standard shipping on orders over $50.</p>
        </body>
      </html>
    `,
    text: "Performance Cycling Jersey. $89.00. Add to Cart. Proceed to Checkout. Free standard shipping.",
    expectedDetected: true,
    expectedB2B: false
  },
  {
    name: "2. Product + Request a Quote only",
    html: `
      <html>
        <body>
          <h1>Industrial Heavy Duty CNC Lathe</h1>
          <p>High precision machinery for automotive manufacturing.</p>
          <button class="quote-btn">Request a Quote</button>
          <a href="/specifications">Technical Specifications</a>
        </body>
      </html>
    `,
    text: "Industrial Heavy Duty CNC Lathe. Request a Quote. Technical Specifications.",
    expectedDetected: false,
    expectedB2B: true
  },
  {
    name: "3. Product + Find a Dealer",
    html: `
      <html>
        <body>
          <h1>Venco Venturo Truck Cranes</h1>
          <p>Leading manufacturer of service cranes and hoists.</p>
          <a href="/dealer-locator">Find a Dealer</a>
          <a href="/dealers">Locate a Dealer</a>
        </body>
      </html>
    `,
    text: "Venco Venturo Truck Cranes. Find a Dealer. Locate a Dealer.",
    expectedDetected: false,
    expectedB2B: true
  },
  {
    name: "4. Product + $100 mentioned in footer (Not sufficient)",
    html: `
      <html>
        <body>
          <h1>Custom Metal Stamping & Fabrication</h1>
          <p>We manufacture custom parts for engineering clients.</p>
        </body>
        <footer>
          <p>Annual donations to community fund exceed $100 every year.</p>
          <p>Contact Sales: sales@example.com</p>
        </footer>
      </html>
    `,
    text: "Custom Metal Stamping & Fabrication. Annual donations exceed $100 every year. Contact Sales.",
    expectedDetected: false,
    expectedB2B: true
  },
  {
    name: "5. Basket icon only (Not sufficient)",
    html: `
      <html>
        <header>
          <div class="header-cart-icon"><i class="fa fa-shopping-basket"></i> Basket (0)</div>
        </header>
        <body>
          <h1>Precision Gear Systems</h1>
          <p>Custom gears manufactured to DIN standards.</p>
          <a href="/contact">Inquire for Price</a>
        </body>
      </html>
    `,
    text: "Basket (0). Precision Gear Systems. Inquire for Price.",
    expectedDetected: false,
    expectedB2B: true
  },
  {
    name: "6. Shopify technology detected only (Not sufficient)",
    html: `
      <html>
        <head>
          <script src="https://cdn.shopify.com/s/files/1/theme.js"></script>
          <script>window.Shopify = { routes: {} };</script>
        </head>
        <body>
          <h1>Wholesale Industrial Packaging</h1>
          <p>We manufacture corrugated cardboard boxes in bulk.</p>
          <a href="/contact">Contact Us for Pricing</a>
        </body>
      </html>
    `,
    text: "Wholesale Industrial Packaging. Contact Us for Pricing.",
    expectedDetected: false,
    expectedB2B: true
  },
  {
    name: "7. Product schema without checkout (Not sufficient)",
    html: `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Product",
                "name": "Commercial Boiler System",
                "offers": {
                  "@type": "Offer",
                  "price": "4500.00",
                  "priceCurrency": "USD"
                }
              }
            ]
          }
          </script>
        </head>
        <body>
          <h1>Commercial Boiler System</h1>
          <p>Call our engineers for installation consultation.</p>
          <a href="/quote">Request a Quote</a>
        </body>
      </html>
    `,
    text: "Commercial Boiler System. Call our engineers for installation consultation. Request a Quote.",
    expectedDetected: false,
    expectedB2B: true
  },
  {
    name: "8. Checkout + actual cart + price",
    html: `
      <html>
        <body>
          <h1>Ergonomic Office Chair</h1>
          <div class="product-price">$249.99</div>
          <button class="add-to-cart">Add to Cart</button>
          <form action="/checkout" method="POST">
            <input type="submit" value="Proceed to Checkout" />
          </form>
          <p>Shipping Policy: Orders ship in 2-3 business days. 30-day return policy.</p>
        </body>
      </html>
    `,
    text: "Ergonomic Office Chair. $249.99. Add to Cart. Proceed to Checkout. Shipping Policy: Orders ship in 2-3 business days. 30-day return policy.",
    expectedDetected: true,
    expectedB2B: false
  },
  {
    name: "9. Quote button in footer + genuine retail checkout (Online Shopping)",
    html: `
      <html>
        <body>
          <h1>Wireless Noise-Canceling Headphones</h1>
          <div class="product-price">$199.99</div>
          <button class="btn single_add_to_cart_button">Add to Bag</button>
          <a href="/checkout" class="btn">Checkout Now</a>
          <p>Delivery timelines: 3-5 days delivery. Order tracking provided.</p>
        </body>
        <footer>
          <div class="b2b-links">
            <p>Looking for corporate bulk orders (1000+ units)?</p>
            <a href="/enterprise">Contact Sales</a>
            <a href="/bulk-quote">Request Bulk Quote</a>
          </div>
        </footer>
      </html>
    `,
    text: "Wireless Noise-Canceling Headphones. $199.99. Add to Bag. Checkout Now. Delivery timelines: 3-5 days. Contact Sales. Request Bulk Quote.",
    expectedDetected: true,
    expectedB2B: false
  }
];

console.log("=== RUNNING MANDATED E-COMMERCE TESTS ===");
let passed = 0;
let failed = 0;

userTestCases.forEach((tc, idx) => {
  const res = detectPurchaseOrShoppingCart(tc.html, tc.text);
  const detectedOk = res.detected === tc.expectedDetected;
  let b2bOk = true;
  if (tc.expectedB2B !== undefined) {
    b2bOk = res.isB2BCatalog === tc.expectedB2B;
  }

  if (detectedOk && b2bOk) {
    console.log(`[PASS] Case ${idx + 1}: ${tc.name}`);
    console.log(`       -> Result: detected=${res.detected}, isB2BCatalog=${res.isB2BCatalog}, isHighConfidence=${res.isHighConfidence}`);
    console.log(`       -> Evidence:`, res.evidence);
    passed++;
  } else {
    console.error(`[FAIL] Case ${idx + 1}: ${tc.name}`);
    console.error(`       -> Expected detected=${tc.expectedDetected}, isB2B=${tc.expectedB2B}`);
    console.error(`       -> Got detected=${res.detected}, isB2B=${res.isB2BCatalog}`);
    console.error(`       -> Evidence:`, res.evidence);
    failed++;
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${userTestCases.length} tests.`);
if (failed > 0) process.exit(1);
