const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  parseLocalizedPrice,
  parseIapMinMax,
  buildGooglePlayIaps,
  extractIapPairs
} = require('../server.js');

// ─── Client parity helpers ──────────────────────────────────────────────────
// The GitHub Pages build (public/app.js) parses pages in the browser, so the
// client functions must stay behaviorally identical to the server versions.
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

const CLIENT_FNS = [
  'decodeHtmlClient',
  'parseLocalizedPriceClient',
  'parseIapMinMaxClient',
  'buildGooglePlayIapsClient',
  'extractIapPairsClient'
].map((name) => extractFunction(appJs, name)).join('\n');

const client = new Function(
  `${CLIENT_FNS}
  return {
    parseLocalizedPrice: parseLocalizedPriceClient,
    parseIapMinMax: parseIapMinMaxClient,
    buildGooglePlayIaps: buildGooglePlayIapsClient,
    extractIapPairs: extractIapPairsClient
  };`
)();

// ─── parseLocalizedPrice ─────────────────────────────────────────────────────
test('parseLocalizedPrice handles major currency formats', () => {
  const cases = [
    ['$9.99', 'USD', 9.99],
    ['$6.99', 'USD', 6.99],
    ['₩9,900', 'KRW', 9900],
    ['₩999', 'KRW', 999],
    ['¥1,400', 'JPY', 1400],
    ['1,99 €', 'EUR', 1.99],
    ['14,99 €', 'EUR', 14.99],
    ['Rp 75.000', 'IDR', 75000],
    ['₹399.00', 'INR', 399],
    ['EGP 220.00', 'EGP', 220],
    ['LKR 1,499.00', 'LKR', 1499],
    ['Rs 49,900', 'PKR', 49900],
    ['$249.00', 'CAD', 249],
    ['R$ 29,90', 'BRL', 29.9]
  ];
  for (const [input, currency, expected] of cases) {
    const actual = parseLocalizedPrice(input, currency);
    assert.ok(Number.isFinite(actual), `${input} (${currency}) should parse`);
    assert.ok(Math.abs(actual - expected) < 1e-6, `${input} (${currency}) = ${actual}, expected ${expected}`);
  }
});

test('parseLocalizedPrice handles compact Indonesian formats', () => {
  assert.strictEqual(parseLocalizedPrice('Rp 15 ribu', 'IDR'), 15000);
  assert.strictEqual(parseLocalizedPrice('Rp 1,5 juta', 'IDR'), 1500000);
});

test('client parseLocalizedPrice matches server', () => {
  const cases = [
    ['$9.99', 'USD'],
    ['₩9,900', 'KRW'],
    ['1,99 €', 'EUR'],
    ['Rp 75.000', 'IDR'],
    ['Rs 49,900', 'PKR']
  ];
  for (const [input, currency] of cases) {
    assert.strictEqual(client.parseLocalizedPrice(input, currency), parseLocalizedPrice(input, currency));
  }
});

// ─── parseIapMinMax ──────────────────────────────────────────────────────────
test('parseIapMinMax extracts range edges', () => {
  assert.deepStrictEqual(parseIapMinMax('$8.00 - $200.00 per item', 'USD'), { min: 8, max: 200 });
  assert.deepStrictEqual(parseIapMinMax('₩999 - ₩74,000 per item', 'KRW'), { min: 999, max: 74000 });
  assert.deepStrictEqual(parseIapMinMax('$6.99 per item', 'USD'), { min: 6.99, max: 6.99 });
  assert.strictEqual(parseIapMinMax('', 'USD'), null);
  assert.strictEqual(parseIapMinMax(null, 'USD'), null);
});

// ─── buildGooglePlayIaps ─────────────────────────────────────────────────────
test('buildGooglePlayIaps splits ranges into min/max tracks', () => {
  const iaps = buildGooglePlayIaps('$8.00 - $200.00 per item', { min: 8, max: 200 }, 'USD');
  assert.deepStrictEqual(iaps.map((i) => i.trackKey), ['google_play_min', 'google_play_max']);
  assert.deepStrictEqual(iaps.map((i) => i.price), [8, 200]);
  assert.deepStrictEqual(iaps.map((i) => i.formattedPrice), ['$8.00', '$200.00']);
  assert.deepStrictEqual(iaps.map((i) => i.trackName), ['인앱결제 최저가', '인앱결제 최고가']);
});

test('buildGooglePlayIaps handles localized suffixes and dash variants', () => {
  const kr = buildGooglePlayIaps('₩999 - ₩74,000 항목당', { min: 999, max: 74000 }, 'KRW');
  assert.deepStrictEqual(kr.map((i) => i.formattedPrice), ['₩999', '₩74,000']);

  const de = buildGooglePlayIaps('1,99 € – 14,99 € pro Artikel', { min: 1.99, max: 14.99 }, 'EUR');
  assert.deepStrictEqual(de.map((i) => i.price), [1.99, 14.99]);
  assert.deepStrictEqual(de.map((i) => i.formattedPrice), ['1,99 €', '14,99 €']);

  const en = buildGooglePlayIaps('$0.99 — $49.99 per item', { min: 0.99, max: 49.99 }, 'USD');
  assert.deepStrictEqual(en.map((i) => i.formattedPrice), ['$0.99', '$49.99']);
});

test('buildGooglePlayIaps emits one track for a single value', () => {
  const iaps = buildGooglePlayIaps('$6.99 per item', { min: 6.99, max: 6.99 }, 'USD');
  assert.strictEqual(iaps.length, 1);
  assert.strictEqual(iaps[0].trackKey, 'google_play_min');
  assert.strictEqual(iaps[0].formattedPrice, '$6.99');
  assert.deepStrictEqual(buildGooglePlayIaps('$8.00 - $200.00 per item', null, 'USD'), []);
});

test('client buildGooglePlayIaps matches server', () => {
  const cases = [
    ['$8.00 - $200.00 per item', { min: 8, max: 200 }, 'USD'],
    ['₩999 - ₩74,000 항목당', { min: 999, max: 74000 }, 'KRW'],
    ['1,99 € – 14,99 € pro Artikel', { min: 1.99, max: 14.99 }, 'EUR'],
    ['$6.99 per item', { min: 6.99, max: 6.99 }, 'USD'],
    ['$8.00 - $200.00 per item', null, 'USD']
  ];
  for (const [range, minMax, currency] of cases) {
    assert.deepStrictEqual(
      client.buildGooglePlayIaps(range, minMax, currency),
      buildGooglePlayIaps(range, minMax, currency)
    );
  }
});

// ─── extractIapPairs (App Store) ─────────────────────────────────────────────
test('extractIapPairs reads textPairs JSON first', () => {
  const html = '<script>{"textPairs":[["Plus","$9.99"],["Pro","$19.99"]]}</script>'
    + '<div class="text-pair"><span>Monthly</span><span>$4.99</span></div>';
  assert.deepStrictEqual(extractIapPairs(html), [['Plus', '$9.99'], ['Pro', '$19.99']]);
});

test('extractIapPairs falls back to text-pair divs', () => {
  const html = '<div class="text-pair"><span>Monthly</span><span>$4.99</span></div>'
    + '<div class="text-pair"><span>Yearly</span><span>$49.99</span></div>';
  assert.deepStrictEqual(extractIapPairs(html), [['Monthly', '$4.99'], ['Yearly', '$49.99']]);
});

test('extractIapPairs falls back to items_V3 JSON', () => {
  const html = '"leadingText":"Yearly","trailingText":"$49.99"';
  assert.deepStrictEqual(extractIapPairs(html), [['Yearly', '$49.99']]);
});

test('client extractIapPairs matches server', () => {
  const html = '<script>{"textPairs":[["Plus","$9.99"]]}</script>'
    + '<div class="text-pair"><span>Monthly</span><span>$4.99</span></div>';
  assert.deepStrictEqual(client.extractIapPairs(html), extractIapPairs(html));
});

test('client parseIapMinMax matches server', () => {
  assert.deepStrictEqual(client.parseIapMinMax('₩999 - ₩74,000 per item', 'KRW'), parseIapMinMax('₩999 - ₩74,000 per item', 'KRW'));
});
