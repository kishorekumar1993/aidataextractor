const fs = require('fs');

// Extract detectPurchaseOrShoppingCart from background.js
const bgCode = fs.readFileSync('d:/SoftwareWork/extension/aiextension/background.js', 'utf8');

// Isolate detectPurchaseOrShoppingCart function
const fnMatch = bgCode.match(/function detectPurchaseOrShoppingCart[\s\S]*?\n\}/);
if (!fnMatch) {
  console.error("Could not find detectPurchaseOrShoppingCart in background.js");
  process.exit(1);
}

const detectPurchaseOrShoppingCart = eval(`(${fnMatch[0]})`);

const testCases = [
  {
    name: "Case 1: B2B Manufacturer Showcase (Request a Quote)",
    html: `
      <html>
        <body>
          <h1>Industrial Hydraulic Valves</h1>
          <p>We manufacture high-precision valves for industrial machinery.</p>
          <a href="/quote" class="btn">Request a Quote</a>
          <a href="/catalog.pdf">Download Catalog</a>
        </body>
      </html>
    `,
    text: "Industrial Hydraulic Valves. We manufacture high-precision valves. Request a Quote. Download Catalog.",
    expectedDetected: false,
    expectedB2B: true
  },
  {
    name: "Case 2: B2B Manufacturer with Find a Dealer & Specs",
    html: `
      <html>
        <body>
          <h1>Venco Venturo Service Cranes</h1>
          <p>Leading manufacturer of truck mounted telescopic service cranes.</p>
          <a href="/dealers">Find a Dealer</a>
          <a href="/specs">Technical Specifications</a>
          <p>Sales: info@venturo.com | Parts: parts@venturo.com</p>
        </body>
      </html>
    `,
    text: "Venco Venturo Service Cranes. Find a Dealer. Technical Specifications. Sales: info@venturo.com",
    expectedDetected: false,
    expectedB2B: true
  },
  {
    name: "Case 3: B2B Manufacturer with Inquiry Basket (Add to Quote)",
    html: `
      <html>
        <body>
          <h1>Precision Gears & Motors</h1>
          <div class="product-item">
            <h2>Helical Gearbox Model HG-500</h2>
            <button class="btn-inquiry">Add to Quote</button>
          </div>
          <a href="/inquiry-cart">Inquiry Basket (3 items)</a>
          <button onclick="sendInquiry()">Send Inquiry</button>
        </body>
      </html>
    `,
    text: "Precision Gears & Motors. Helical Gearbox Model HG-500. Add to Quote. Inquiry Basket (3 items). Send Inquiry.",
    expectedDetected: false,
    expectedB2B: true
  },
  {
    name: "Case 4: Site with template theme cart icon but Contact Us for Pricing",
    html: `
      <html>
        <header>
          <div class="site-header__cart"><i class="fa fa-shopping-cart"></i> Cart (0)</div>
        </header>
        <body>
          <h1>Custom Metal Stamping & Fabrication</h1>
          <p>Contact Us for Pricing on custom production runs.</p>
          <a href="/contact">Request Pricing</a>
        </body>
      </html>
    `,
    text: "Custom Metal Stamping & Fabrication. Contact Us for Pricing on custom production runs. Request Pricing.",
    expectedDetected: false,
    expectedB2B: true
  },
  {
    name: "Case 5: Dominion Doors and Windows (from user screenshot)",
    html: `
      <html>
        <body>
          <h1>Dominion Doors and Windows Limited</h1>
          <p>Vinyl windows and entrance systems manufacturer in Ontario, Canada.</p>
          <button>Request a Quote</button>
          <a href="/specs">Product Specifications</a>
          <p>Contact: admin@dominiondw.com</p>
        </body>
      </html>
    `,
    text: "Dominion Doors and Windows Limited. Request a Quote. Product Specifications. admin@dominiondw.com",
    expectedDetected: false,
    expectedB2B: true
  },
  {
    name: "Case 6: True Retail E-Commerce Store (Shopify)",
    html: `
      <html>
        <head>
          <script src="https://cdn.shopify.com/s/files/1/theme.js"></script>
        </head>
        <body>
          <h1>Organic Cotton Hoodie</h1>
          <div class="price">$59.99</div>
          <button class="btn add-to-cart">Add to Cart</button>
          <a href="/checkout" class="btn-checkout">Proceed to Checkout</a>
          <p>Free shipping on orders over $50. Estimated delivery: 3-5 business days. 30-day Return Policy.</p>
        </body>
      </html>
    `,
    text: "Organic Cotton Hoodie. $59.99. Add to Cart. Proceed to Checkout. Free shipping on orders over $50. Estimated delivery 3-5 business days. 30-day Return Policy.",
    expectedDetected: true
  },
  {
    name: "Case 7: True Retail E-Commerce Store (WooCommerce with Product Schema)",
    html: `
      <html>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org/",
          "@type": "Product",
          "name": "Leather Chelsea Boots",
          "offers": {
            "@type": "Offer",
            "price": "145.00",
            "priceCurrency": "USD"
          }
        }
        </script>
        <body>
          <h1>Leather Chelsea Boots</h1>
          <span class="price">$145.00</span>
          <button class="single_add_to_cart_button">Add to Basket</button>
          <a href="/checkout/">Checkout Now</a>
          <div class="shipping-info">Shipping Policy: Standard courier delivery $9.99. Order tracking available.</div>
        </body>
      </html>
    `,
    text: "Leather Chelsea Boots. $145.00. Add to Basket. Checkout Now. Shipping Policy: Standard courier delivery $9.99. Order tracking available.",
    expectedDetected: true
  },
  {
    name: "Case 8: Service / Booking Platform with Calendar",
    html: `
      <html>
        <body>
          <h1>Legal Consultation & Advisory</h1>
          <div class="price">$250 per hour</div>
          <button>Book an Appointment</button>
          <div class="calendar-picker">Select date & time</div>
        </body>
      </html>
    `,
    text: "Legal Consultation & Advisory. $250 per hour. Book an Appointment. Select date & time.",
    expectedDetected: false
  },
  {
    name: "Case 9: SaaS Subscription Platform",
    html: `
      <html>
        <body>
          <h1>Cloud Analytics Platform</h1>
          <div class="tier">$49 / month</div>
          <a href="/signup">Start Free Trial</a>
        </body>
      </html>
    `,
    text: "Cloud Analytics Platform. $49 / month. Start Free Trial.",
    expectedDetected: false
  }
];

console.log("=== RUNNING 3-TIER E-COMMERCE VERIFICATION TESTS ===");
let passed = 0;
let failed = 0;

testCases.forEach((tc, idx) => {
  const res = detectPurchaseOrShoppingCart(tc.html, tc.text);
  const detectedOk = res.detected === tc.expectedDetected;
  let b2bOk = true;
  if (tc.expectedB2B) {
    b2bOk = res.isB2BCatalog === true;
  }

  if (detectedOk && b2bOk) {
    console.log(`[PASS] Case ${idx + 1}: ${tc.name}`);
    console.log(`       -> Result: detected=${res.detected}, reason="${res.reason || ''}", isB2BCatalog=${!!res.isB2BCatalog}`);
    passed++;
  } else {
    console.error(`[FAIL] Case ${idx + 1}: ${tc.name}`);
    console.error(`       -> Expected detected=${tc.expectedDetected}, got detected=${res.detected}`);
    console.error(`       -> Full result:`, res);
    failed++;
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} total tests.`);
if (failed > 0) process.exit(1);
