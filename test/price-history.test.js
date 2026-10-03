const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// The price history panel lives in the client (localStorage), so its pure
// helpers are extracted from app.js and exercised directly.
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

const HISTORY_FNS = [
  'formatRelativeTime',
  'samePriceHistoryScope',
  'annotatePriceHistory',
  'fmtHistoryPrice',
  'buildPriceTrendSeries',
  'sparklinePath'
].map((name) => extractFunction(appJs, name)).join('\n');

const historyClient = new Function(
  `${HISTORY_FNS}
  return {
    formatRelativeTime,
    annotatePriceHistory,
    fmtHistoryPrice,
    buildPriceTrendSeries,
    sparklinePath
  };`
)();

const base = {
  schemaVersion: 2,
  coverage: 'kr,us',
  ppp: false,
  appId: 'com.example.app',
  store: 'google',
  appName: 'Example',
  currency: 'USD',
  cheapestPrice: 10,
  cheapestCountry: 'United States',
  avgPrice: 12
};

function entry(overrides) {
  return { ...base, ...overrides };
}

// ─── annotatePriceHistory ───────────────────────────────────────────────────
test('annotatePriceHistory sorts newest first', () => {
  const old = entry({ timestamp: 1000 });
  const fresh = entry({ timestamp: 2000 });
  const annotated = historyClient.annotatePriceHistory([old, fresh]);
  assert.strictEqual(annotated[0].timestamp, 2000);
  assert.strictEqual(annotated[1].timestamp, 1000);
});

test('annotatePriceHistory marks cheaper/pricier/identical changes', () => {
  const prev = entry({ timestamp: 1000, cheapestPrice: 10 });
  const cheaper = entry({ timestamp: 2000, cheapestPrice: 7 });
  const pricier = entry({ timestamp: 3000, cheapestPrice: 12 });
  const same = entry({ timestamp: 4000, cheapestPrice: 12 });

  const annotated = historyClient.annotatePriceHistory([prev, cheaper, pricier, same]);
  assert.strictEqual(annotated[0].change, 0);        // 12 vs 12
  assert.strictEqual(annotated[1].change, 5);        // 12 vs 7
  assert.strictEqual(annotated[2].change, -3);       // 7 vs 10
  assert.strictEqual(annotated[3].change, null);     // no previous check
});

test('annotatePriceHistory skips change across app/store/currency boundaries', () => {
  const a = entry({ timestamp: 1000, store: 'google', currency: 'USD', cheapestPrice: 10 });
  const b = entry({ timestamp: 2000, store: 'google', currency: 'KRW', cheapestPrice: 10 });
  const c = entry({ timestamp: 3000, store: 'apple', currency: 'USD', cheapestPrice: 10 });
  const d = entry({ timestamp: 4000, appId: 'other.app', cheapestPrice: 10 });

  const annotated = historyClient.annotatePriceHistory([a, b, c, d]);
  assert.strictEqual(annotated[0].change, null);
  assert.strictEqual(annotated[1].change, null);
  assert.strictEqual(annotated[2].change, null);
  assert.strictEqual(annotated[3].change, null);
});

test('annotatePriceHistory includes a verified free price in change detection', () => {
  const prev = entry({ timestamp: 1000, cheapestPrice: 0 });
  const fresh = entry({ timestamp: 2000, cheapestPrice: 5 });
  const annotated = historyClient.annotatePriceHistory([prev, fresh]);
  assert.strictEqual(annotated[0].change, 5);
});

test('annotatePriceHistory tolerates non-array input', () => {
  assert.deepStrictEqual(historyClient.annotatePriceHistory(null), []);
  assert.deepStrictEqual(historyClient.annotatePriceHistory(undefined), []);
});

test('history changes and trends exclude different or unknown country coverage', () => {
  const fresh = entry({timestamp:4000, cheapestPrice:10});
  const different = entry({timestamp:3000, coverage:'us', cheapestPrice:20});
  const unknown = entry({timestamp:2000, coverage:undefined, cheapestPrice:99});
  const previous = entry({timestamp:1000, cheapestPrice:8});
  const history = [fresh, different, unknown, previous];
  const annotated = historyClient.annotatePriceHistory(history);
  assert.strictEqual(annotated[0].change, 2);
  assert.strictEqual(annotated[1].change, null);
  assert.strictEqual(annotated[2].change, null);
  assert.deepStrictEqual(historyClient.buildPriceTrendSeries(history, fresh), [8,10]);
  assert.deepStrictEqual(historyClient.buildPriceTrendSeries(history, unknown), []);
});

// ─── fmtHistoryPrice ─────────────────────────────────────────────────────────
test('fmtHistoryPrice formats numbers, free and unknown', () => {
  assert.strictEqual(historyClient.fmtHistoryPrice(0), '무료');
  assert.strictEqual(historyClient.fmtHistoryPrice(9.5), '9.5');
  assert.strictEqual(historyClient.fmtHistoryPrice(1234.567), '1,234.57');
  assert.strictEqual(historyClient.fmtHistoryPrice(NaN), '—');
  assert.strictEqual(historyClient.fmtHistoryPrice(undefined), '—');
});

// ─── formatRelativeTime ──────────────────────────────────────────────────────
test('formatRelativeTime buckets relative ages', () => {
  const now = Date.now();
  assert.strictEqual(historyClient.formatRelativeTime(now - 30 * 1000), '방금 전');
  assert.strictEqual(historyClient.formatRelativeTime(now - 5 * 60 * 1000), '5분 전');
  assert.strictEqual(historyClient.formatRelativeTime(now - 3 * 60 * 60 * 1000), '3시간 전');
  assert.strictEqual(historyClient.formatRelativeTime(now - 2 * 24 * 60 * 60 * 1000), '2일 전');
});

// ─── buildPriceTrendSeries ───────────────────────────────────────────────────
test('buildPriceTrendSeries returns same-app cheapest prices oldest first', () => {
  const history = [
    entry({ timestamp: 3000, cheapestPrice: 12 }),
    entry({ timestamp: 1000, cheapestPrice: 10 }),
    entry({ timestamp: 2000, cheapestPrice: 11 }),
    entry({ timestamp: 4000, appId: 'other.app', cheapestPrice: 99 })
  ];
  const series = historyClient.buildPriceTrendSeries(history, history[0]);
  assert.deepStrictEqual(series, [10, 11, 12]);
});

test('buildPriceTrendSeries isolates stores and includes verified free prices', () => {
  const history = [
    entry({ timestamp: 1000, cheapestPrice: 0 }),
    entry({ timestamp: 2000, cheapestPrice: 5 }),
    entry({ timestamp: 1500, store: 'apple', cheapestPrice: 7 })
  ];
  const series = historyClient.buildPriceTrendSeries(history, entry({ timestamp: 2000, cheapestPrice: 5 }));
  assert.deepStrictEqual(series, [0, 5]);
});

// ─── sparklinePath ───────────────────────────────────────────────────────────
test('sparklinePath builds monotonic coordinates and flat lines', () => {
  const path = historyClient.sparklinePath([10, 20, 30], 72, 26);
  assert.match(path, /^M2\.0,24\.0 L36\.0,13\.0 L70\.0,2\.0$/);
  const flat = historyClient.sparklinePath([5, 5, 5], 72, 26);
  assert.strictEqual(flat, 'M2.0,24.0 L36.0,24.0 L70.0,24.0');
});

test('sparklinePath returns empty for insufficient points', () => {
  assert.strictEqual(historyClient.sparklinePath([5], 72, 26), '');
  assert.strictEqual(historyClient.sparklinePath([], 72, 26), '');
  assert.strictEqual(historyClient.sparklinePath(null, 72, 26), '');
});
