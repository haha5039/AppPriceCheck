const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

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

const countriesStart = appJs.indexOf('const APP_STORE_COUNTRIES =');
const countriesSource = appJs.slice(countriesStart, appJs.indexOf('];', countriesStart) + 2);

const CSV_FNS = ['iapKey', 'getIapUsValue', 'csvField', 'iapCsvRows']
  .map((name) => extractFunction(appJs, name))
  .join('\n');

const iapCsvClient = new Function(`
  const usdRate = { USD: 1, KRW: 0.00077, JPY: 0.0068, EUR: 1.09 };
  ${countriesSource}
  ${CSV_FNS}
  function toBaseVal(price, currency, countryCode, baseCurrencyOverride) {
    if (price === 0) return 0;
    if (!price || !currency) return null;
    return price * (usdRate[currency] || 1);
  }

  let iapsByCountry = {};
  let priceData = [];
  let selectedIapTrackName = '';
  let iapCurrentRegion = 'all';
  let iapCountrySearchQuery = '';
  let iapCurrentBaseCurrency = 'USD';

  return {
    csvField,
    iapCsvRows,
    setState(next) {
      iapsByCountry = next.iapsByCountry || iapsByCountry;
      priceData = next.priceData || priceData;
      selectedIapTrackName = next.selectedIapTrackName ?? selectedIapTrackName;
      iapCurrentRegion = next.iapCurrentRegion ?? iapCurrentRegion;
      iapCountrySearchQuery = next.iapCountrySearchQuery ?? iapCountrySearchQuery;
      iapCurrentBaseCurrency = next.iapCurrentBaseCurrency ?? iapCurrentBaseCurrency;
    }
  };
`)();

const priceData = [
  { country: 'us', countryName: 'United States', region: 'Americas' },
  { country: 'kr', countryName: 'South Korea', region: 'Asia-Pacific' },
  { country: 'jp', countryName: 'Japan', region: 'Asia-Pacific' },
  { country: 'de', countryName: 'Germany', region: 'Europe' }
];

const iapsByCountry = {
  us: [{ trackKey: 'gold', trackName: 'Gold Pack', price: 9.99, currency: 'USD', formattedPrice: '$9.99' }],
  kr: [{ trackKey: 'gold', trackName: 'Gold Pack', price: 12000, currency: 'KRW', formattedPrice: '₩12,000' }],
  jp: [{ trackKey: 'gold', trackName: 'Gold Pack', price: 1300, currency: 'JPY' }],
  de: [{ trackKey: 'gold', trackName: 'Gold Pack', price: 10.99, currency: 'EUR' }]
};

function loaded() {
  iapCsvClient.setState({
    iapsByCountry,
    priceData,
    selectedIapTrackName: 'gold'
  });
}

// ─── csvField ────────────────────────────────────────────────────────────────
test('csvField leaves plain values unquoted', () => {
  const client = iapCsvClient;
  assert.strictEqual(client.csvField(42), '42');
  assert.strictEqual(client.csvField('hello'), 'hello');
  assert.strictEqual(client.csvField('US'), 'US');
});

test('csvField quotes and escapes commas, quotes, and newlines', () => {
  const client = iapCsvClient;
  assert.strictEqual(client.csvField('₩12,000'), '"₩12,000"');
  assert.strictEqual(client.csvField('say "hi"'), '"say ""hi"""');
  assert.strictEqual(client.csvField('line1\nline2'), '"line1\nline2"');
});

test('csvField turns null and undefined into empty string', () => {
  const client = iapCsvClient;
  assert.strictEqual(client.csvField(null), '');
  assert.strictEqual(client.csvField(undefined), '');
});

// ─── iapCsvRows ──────────────────────────────────────────────────────────────
test('iapCsvRows returns [] without a selected track', () => {
  iapCsvClient.setState({ iapsByCountry, priceData, selectedIapTrackName: '' });
  assert.deepStrictEqual(iapCsvClient.iapCsvRows(), []);
});

test('iapCsvRows sorts by base value ascending and computes diff vs US', () => {
  loaded();
  const rows = iapCsvClient.iapCsvRows();
  assert.strictEqual(rows.length, 4);
  assert.deepStrictEqual(rows.map(r => r.country), ['jp', 'kr', 'us', 'de']);

  const us = rows.find(r => r.country === 'us');
  assert.strictEqual(us.diff, '0.0%');

  const jp = rows.find(r => r.country === 'jp');
  assert.strictEqual(jp.baseFormatted, '8.84');
  assert.strictEqual(jp.diff, '-11.5%');

  const kr = rows.find(r => r.country === 'kr');
  assert.strictEqual(kr.localFormatted, '₩12,000');
  assert.strictEqual(kr.baseFormatted, '9.24');
  assert.strictEqual(kr.diff, '-7.5%');
});

test('iapCsvRows falls back to raw price when formattedPrice is missing', () => {
  loaded();
  const jp = iapCsvClient.iapCsvRows().find(r => r.country === 'jp');
  assert.strictEqual(jp.localFormatted, 'JPY 1300');
});

test('iapCsvRows filters by region', () => {
  loaded();
  iapCsvClient.setState({ iapCurrentRegion: 'Europe' });
  const rows = iapCsvClient.iapCsvRows();
  assert.deepStrictEqual(rows.map(r => r.country), ['de']);
  assert.strictEqual(rows[0].diff, '19.9%');
});

test('iapCsvRows filters by country name and code search', () => {
  loaded();
  iapCsvClient.setState({ iapCurrentRegion: 'all', iapCountrySearchQuery: 'korea' });
  assert.deepStrictEqual(iapCsvClient.iapCsvRows().map(r => r.country), ['kr']);
  assert.strictEqual(iapCsvClient.iapCsvRows()[0].diff, '-7.5%');

  iapCsvClient.setState({ iapCountrySearchQuery: 'DE' });
  assert.deepStrictEqual(iapCsvClient.iapCsvRows().map(r => r.country), ['de']);
  assert.strictEqual(iapCsvClient.iapCsvRows()[0].diff, '19.9%');
});
