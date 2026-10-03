const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// The GitHub Pages build parses Google Play pages in the browser, so the
// client parser must keep the server behavior: own per-item range only
// (skipping related-app offer blocks), the availability heuristic, and the
// split min/max IAP tracks.
const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notStrictEqual(start, -1, `function ${name} not found in app.js`);
  let depth = 0;
  let i = source.indexOf('{', start);
  for (; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return source.slice(start, i + 1);
}

const currencyMap = appJs.match(/const COUNTRY_CURRENCIES = \{[\s\S]*?\n\};/)[0];
const helpers = [
  'parseLocalizedPriceClient',
  'parseIapMinMaxClient',
  'buildGooglePlayIapsClient',
  'parseGooglePlayPageClient'
].map((name) => extractFunction(appJs, name)).join('\n');

const parsePage = new Function(`${currencyMap}\n${helpers}\nreturn parseGooglePlayPageClient;`)();

const US = { code: 'us', name: 'United States', flag: '', region: 'Americas' };
const KR = { code: 'kr', name: 'South Korea', flag: '', region: 'Asia Pacific' };
const CN = { code: 'cn', name: 'China', flag: '', region: 'Asia Pacific' };

test('parseGooglePlayPageClient parses a free US page with an IAP range', () => {
  const html = `
    <meta itemprop="price" content="0">
    <script>"priceCurrency":"USD"</script>
    <h1 class="foo"><span>ChatGPT</span></h1>
    <p>Some description</p>
    "$8.00 - $200.00 per item"
  `;
  const r = parsePage(html, US);
  assert.strictEqual(r.available, true);
  assert.strictEqual(r.price, 0);
  assert.strictEqual(r.currency, 'USD');
  assert.strictEqual(r.appName, 'ChatGPT');
  assert.strictEqual(r.iapRange, '$8.00 - $200.00 per item');
  assert.deepStrictEqual(r.iaps.map((i) => i.trackKey), ['google_play_min', 'google_play_max']);
  assert.deepStrictEqual(r.iaps.map((i) => i.price), [8, 200]);
  assert.deepStrictEqual(r.iaps.map((i) => i.formattedPrice), ['$8.00', '$200.00']);
});

test('parseGooglePlayPageClient skips related-app offer blocks', () => {
  const filler = 'x'.repeat(500); // keeps the own range clear of the offerId context
  const html = `
    <meta itemprop="price" content="0">
    <script>"priceCurrency":"USD"</script>
    <h1><span>ChatGPT</span></h1>
    <a href="/store/apps/details?id=other.app&offerId=123">Related app</a>
    "$0.99 - $999.99 per item"
    <div>${filler}</div>
    "$8.00 - $200.00 per item"
  `;
  const r = parsePage(html, US);
  assert.strictEqual(r.iapRange, '$8.00 - $200.00 per item');
  assert.deepStrictEqual(r.iaps.map((i) => i.price), [8, 200]);
});

test('parseGooglePlayPageClient parses a Korean paid page', () => {
  const html = `
    <meta itemprop="price" content="99000">
    <script>"priceCurrency":"KRW"</script>
    <h1><span>Toss</span></h1>
    "₩400 - ₩564,300 per item"
  `;
  const r = parsePage(html, KR);
  assert.strictEqual(r.available, true);
  assert.strictEqual(r.price, 99000);
  assert.strictEqual(r.currency, 'KRW');
  assert.deepStrictEqual(r.iaps.map((i) => i.price), [400, 564300]);
  assert.deepStrictEqual(r.iaps.map((i) => i.formattedPrice), ['₩400', '₩564,300']);
});

test('parseGooglePlayPageClient parses a paid US page', () => {
  const html = `
    <meta itemprop="price" content="$6.99">
    <script>"priceCurrency":"USD"</script>
    <h1><span>Minecraft</span></h1>
    "$0.99 - $49.99 per item"
  `;
  const r = parsePage(html, US);
  assert.strictEqual(r.available, true);
  assert.strictEqual(r.price, 6.99);
  assert.strictEqual(r.formattedPrice, '$6.99');
  assert.deepStrictEqual(r.iaps.map((i) => i.price), [0.99, 49.99]);
});

test('parseGooglePlayPageClient emits one track for a single-value range', () => {
  const html = `
    <meta itemprop="price" content="0">
    <script>"priceCurrency":"USD"</script>
    <h1><span>Utility</span></h1>
    "$6.99 per item"
  `;
  const r = parsePage(html, US);
  assert.strictEqual(r.iaps.length, 1);
  assert.strictEqual(r.iaps[0].trackKey, 'google_play_min');
  assert.strictEqual(r.iaps[0].price, 6.99);
});

test('parseGooglePlayPageClient marks no-storefront fallback pages unavailable', () => {
  const html = '<html><body><h1><span>App</span></h1><p>No price metadata</p></body></html>';
  const r = parsePage(html, CN);
  assert.strictEqual(r.available, false);
  assert.strictEqual(r.fetchStatus, 'no-storefront');
  assert.deepStrictEqual(r.iaps, []);
});

test('parseGooglePlayPageClient handles pages without IAP ranges', () => {
  const html = `
    <meta itemprop="price" content="0">
    <script>"priceCurrency":"USD"</script>
    <h1><span>Utility</span></h1>
    <p>No in-app purchases here</p>
  `;
  const r = parsePage(html, US);
  assert.strictEqual(r.available, true);
  assert.strictEqual(r.iapRange, null);
  assert.deepStrictEqual(r.iaps, []);
});
