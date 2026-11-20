const fs = require('fs');
const vm = require('vm');

const crawlerCode = fs.readFileSync('src/background/crawler.js', 'utf8');
const ctx = {
  isValidCorporateEmail: (e) => Boolean(e && e.includes('@') && e.includes('.')),
  isUnwantedEmail: () => false,
  stripTrailingContactWordsFromEmail: (e) => e,
  decodeRot13: (e) => e,
  stripHtml: (h) => h.replace(/<[^>]+>/g, ' '),
  cleanPhoneNumber: (p) => p ? p.replace(/\D/g, '') : '',
  toTitleCase: (s) => s,
  normalizeCountryName: (c) => c,
  cleanCompanyPrefixesAndSuffixes: (s) => s,
  formatStreetOnlyAddress: (s) => s,
  isFullAddressCandidate: () => true
};

vm.runInNewContext(crawlerCode, ctx);

// Test 1: Semicolon mailto
const testHtml1 = 'Email: <a href="mailto:daisyyang@zungsung.com;zungsung@ms14.hinet.net">Contact</a>';
console.log('Test 1 emails:', ctx.extractEmailsFromHtml(testHtml1, 'zungsung.com'));

// Test 2: Numeric HTML entity encoded mailto
// "info@acme.com" in numeric entities: &#105;&#110;&#102;&#111;&#64;&#97;&#99;&#109;&#101;&#46;&#99;&#111;&#109;
const testHtml2 = '<a href="mailto:&#105;&#110;&#102;&#111;&#64;&#97;&#99;&#109;&#101;&#46;&#99;&#111;&#109;">Mail</a>';
console.log('Test 2 emails:', ctx.extractEmailsFromHtml(testHtml2, 'acme.com'));

// Test 3: <bdo dir="rtl">
const testHtml3 = '<bdo dir="rtl">moc.emca@selas</bdo>';
console.log('Test 3 emails:', ctx.extractEmailsFromHtml(testHtml3, 'acme.com'));

// Test 4: Joomla cloaking (e.g. willjoin.com.tw)
const testHtml4 = `
  <script type='text/javascript'>
  var addy1 = 'w&#105;llj&#111;&#105;n' + '&#64;';
  addy1 = addy1 + 'ms9' + '&#46;' + 'h&#105;n&#101;t' + '&#46;' + 'n&#101;t';
  document.write(addy1);
  </script>
`;
console.log('Test 4 emails:', ctx.extractEmailsFromHtml(testHtml4, 'willjoin.com.tw'));
