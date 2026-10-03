const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function client(extra = {}) {
  const nodes = new Map(), streams = [], storage = new Map();
  const element = id => {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, { textContent: '', innerHTML: '', value: '', disabled: false, style: {},
        classList: {
          add(...names) { names.forEach(name => classes.add(name)); },
          remove(...names) { names.forEach(name => classes.delete(name)); },
          toggle(name, force = !classes.has(name)) { if (force) classes.add(name); else classes.delete(name); return force; },
          contains: name => classes.has(name)
        },
        getAttribute: () => null, removeAttribute() {}, querySelector: () => element(id + '-child'),
        querySelectorAll: () => [], remove() {}, focus() {} });
    }
    return nodes.get(id);
  };
  class EventSource {
    constructor(url) { this.url = url; streams.push(this); }
    close() { this.closed = true; }
    send(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
  }
  const context = vm.createContext({ console, setTimeout, clearTimeout, AbortController, AbortSignal, DOMException,
    URLSearchParams, URL, Intl, EventSource,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: { getElementById: element, querySelectorAll: () => [], querySelector: () => null,
      addEventListener() {}, createElement: () => element('script'), head: { appendChild() {} } },
    window: { location: { hostname: 'localhost', protocol: 'http:' } },
    fetch: async () => ({ ok: true, json: async () => ({ rates: { USD: 1, KRW: 1000 } }) }), ...extra });
  vm.runInContext(source, context);
  const run = code => vm.runInContext(code, context);
  return { context, run, nodes, element, streams, storage };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

function captureTable(c, id) {
  let rows = [];
  c.context.document.createDocumentFragment = () => {
    rows = [];
    return { appendChild(row) { rows.push(row); } };
  };
  c.context.document.createElement = () => ({ classList: { add() {} }, innerHTML: '' });
  c.element(id).appendChild = () => {};
  return () => rows.map(row => row.innerHTML).join('');
}

test('SSE delivers done once, closes, and never reconnects after completion', () => {
  const c = client();
  c.run('var completed = 0; var stream = createResilientSSE("/prices"); stream.ondone(() => completed++); stream.start();');
  c.streams[0].send({ type: 'done' });
  c.streams[0].send({ type: 'done' });
  c.streams[0].onerror();
  assert.equal(c.run('completed'), 1);
  assert.equal(c.streams[0].closed, true);
  assert.equal(c.streams.length, 1);
});

test('SSE retries stay bounded even when each connection delivers country data', async () => {
  const c = client();
  c.run('var failures = 0; var stream = createResilientSSE("/prices", {maxRetries: 1, retryDelay: 0}); stream.onerror(() => failures++); stream.start();');
  c.streams[0].send({ country: 'us' });
  c.streams[0].onerror();
  await new Promise(resolve => setTimeout(resolve, 10));
  c.streams[1].send({ country: 'us' });
  c.streams[1].onerror();
  assert.equal(c.streams.length, 2);
  assert.equal(c.run('failures'), 1);
});

test('cancelling a stream settles its promise and ignores late data', async () => {
  const c = client();
  const promise = c.run('var controller = new AbortController(); var rows = []; collectPriceStream("/prices", controller.signal, r => rows.push(r));');
  c.run('controller.abort()');
  assert.equal((await promise).cancelled, true);
  c.streams[0].send({ country: 'kr' });
  assert.equal(c.run('rows.length'), 0);
});

test('main searches isolate responses, deduplicate countries and finalize once', async () => {
  const c = client();
  c.run('var historyWrites = 0, iapLoads = 0; updateStats = renderTable = () => {}; recordCurrentPriceHistory = () => historyWrites++; loadIapData = () => iapLoads++;');
  const first = c.run('searchApp({appId:"123456"})');
  await tick();
  const old = c.streams[0];
  const second = c.run('searchApp({appId:"654321"})');
  await tick();
  old.send({ country: 'us', price: 999 });
  const latest = c.streams[1];
  latest.send({ country: 'us', available: true, price: 5, currency: 'USD' });
  latest.send({ country: 'us', available: true, price: 4, currency: 'USD' });
  latest.send({ type: 'done' });
  await Promise.all([first, second]);
  assert.equal(c.run('priceData.filter(r => r.country === "us").length'), 1);
  assert.equal(c.run('priceData.find(r => r.country === "us").price'), 4);
  assert.equal(c.run('historyWrites'), 1);
  assert.equal(c.element('search-btn').disabled, false);
  assert.equal(c.run('iapLoads'), 2); // one per search, never duplicated at completion
});

test('terminal application errors settle and restore search controls', async () => {
  const c = client();
  c.run('updateStats = renderTable = loadIapData = () => {};');
  const result = c.run('searchApp({appId:"123456"})');
  await tick();
  c.streams[0].send({ type: 'error', message: 'Not found' });
  await result;
  assert.equal(c.element('search-btn').disabled, false);
  assert.equal(c.element('error-msg').textContent, 'Not found');
});

test('missing FX never becomes a free price or a mislabeled target amount', () => {
  const c = client();
  c.run('exchangeRates = {USD: 1}; currentBaseCurrency = "KRW";');
  assert.equal(c.run('toBaseVal(10, "USD")'), null);
  assert.equal(c.run('toBaseVal(9900, "KRW")'), null);
  assert.equal(c.run('toBaseVal(0, "KRW")'), 0);
  assert.equal(c.run('toBaseVal(NaN, "USD")'), null);
  c.run('priceData = [{country:"kr", available:true, price:9900, currency:"KRW"}]; updateAppHeaderMeta = updateFavBtn = renderChart = renderInsights = () => {}; updateStats();');
  assert.equal(c.element('cheapest-price').textContent, '환산 불가');
});

test('summary excludes unknown conversion from denominator and includes verified free prices', () => {
  const c = client();
  c.run('exchangeRates = {USD:1}; priceData = [{country:"us", price:10, currency:"USD"}, {country:"kr", price:9900, currency:"KRW"}, {country:"ca", price:0, currency:"CAD"}]; updateAppHeaderMeta = updateFavBtn = renderChart = renderInsights = () => {}; updateStats();');
  assert.equal(c.element('cheapest-price').textContent, '무료');
  assert.equal(c.element('avg-price').textContent, c.run('fmtBaseVal(5)'));
});

test('history uses actual display currency, PPP, and skips ambiguous legacy entries', () => {
  const c = client();
  c.run('exchangeRates = {USD:1, KRW:1000}; currentBaseCurrency = "KRW"; priceData = [{country:"us", price:10, currency:"USD"}]; renderPriceHistory = renderPriceHistoryBadge = () => {}; recordCurrentPriceHistory("123456", "apple");');
  const stored = JSON.parse(c.storage.get('app_price_history'))[0];
  assert.equal(stored.currency, 'KRW');
  assert.equal(stored.cheapestPrice, 10000);
  assert.equal(stored.ppp, false);
  assert.equal(stored.schemaVersion, 2);
  const entries = [
    { ...stored, timestamp: 4, cheapestPrice: 9000 },
    { ...stored, timestamp: 3, appId: 'other', cheapestPrice: 1 },
    { ...stored, timestamp: 2 },
    { ...stored, timestamp: 1, currency: 'USD', cheapestPrice: 10 },
    { ...stored, timestamp: 0, schemaVersion: undefined }
  ];
  c.context.entries = entries;
  assert.equal(c.run('annotatePriceHistory(entries)[0].change'), -1000);
  assert.equal(JSON.stringify(c.run('buildPriceTrendSeries(entries, entries[0])')), '[10000,9000]');
});

test('static name search uses JSONP and locale fallback; abort removes callbacks', async () => {
  const c = client();
  c.context.window.location.hostname = 'example.github.io';
  const requests = [];
  c.context.document.head.appendChild = script => {
    const url = new URL(script.src); requests.push(url);
    queueMicrotask(() => c.context.window[url.searchParams.get('callback')]({ results: url.searchParams.get('country') === 'us' ? [{trackId:123456}] : [] }));
  };
  const result = await c.run('searchAppsByName("테스트", new AbortController().signal)');
  assert.equal(result[0].trackId, 123456);
  assert.deepEqual(requests.map(u => u.searchParams.get('country')), ['kr', 'us']);
  assert.equal(Object.keys(c.context.window).filter(k => k.startsWith('itunes_')).length, 0);
  c.context.document.head.appendChild = () => {};
  const pending = c.run('var aborter = new AbortController(); fetchJSONP("https://itunes.apple.com/lookup?id=123456", aborter.signal)');
  c.run('aborter.abort()');
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(Object.keys(c.context.window).filter(k => k.startsWith('itunes_')).length, 0);
});

test('static Apple lookup distinguishes missing apps from request failures', async () => {
  const c = client();
  c.run('updateStats = renderTable = () => {}; scanCountryCodes = ["us", "kr"]; fetchITunesJSONP = async (id, country) => { if (country === "kr") throw Error("network"); return null; };');
  await c.run('searchAppClientSide("123456", null, currentSearchToken, new AbortController().signal, ["us","kr"])');
  assert.equal(c.run('priceData.find(r => r.country === "us").fetchStatus'), 'unavailable');
  assert.equal(c.run('priceData.find(r => r.country === "kr").fetchStatus'), 'request-failed');
});

test('static IAP failures cannot become empty products or update a newer search', async () => {
  const c = client();
  c.run('renderIapSummary = () => {}; fetchITunesJSONP = async () => { throw Error("network"); };');
  await c.run('loadIapDataClientSide("123456", currentSearchToken, new AbortController().signal, ["us"])');
  assert.equal(c.run('iapStatuses.us'), 'request-failed');
  c.run('iapStatuses = {}; fetchITunesJSONP = async () => { currentSearchToken++; return null; };');
  await c.run('loadIapDataClientSide("123456", currentSearchToken, new AbortController().signal, ["us"])');
  assert.equal(c.run('Object.keys(iapStatuses).length'), 0);
});

test('comparison queries cannot mix late rows from previous queries', async () => {
  const c = client();
  c.element('compare-search-input').value = '123456';
  c.run('renderCompareTable = () => {};');
  const a = c.run('runCompareSearch()');
  c.element('compare-search-input').value = '654321';
  const b = c.run('runCompareSearch()');
  c.streams[0].send({country:'us',price:100});
  c.streams[1].send({country:'us',price:5});
  c.streams[1].send({type:'done'});
  await Promise.all([a,b]);
  assert.equal(c.run('comparePriceData.length'), 1);
  assert.equal(c.run('comparePriceData[0].price'), 5);
});

test('retry requests only failed countries and preserves existing successful prices', async () => {
  const c = client();
  c.run('updateStats = renderTable = loadIapData = recordCurrentPriceHistory = () => {}; currentAppId="123456"; priceData=[{country:"us",price:10,currency:"USD",available:true},{country:"kr",available:false,fetchStatus:"request-failed"}];');
  const pending = c.run('searchApp({appId:"123456",retryCountries:["kr"],forceRefresh:true})');
  await tick();
  assert.equal(new URL(c.streams[0].url, 'http://localhost').searchParams.get('countries'), 'kr');
  c.streams[0].send({country:'kr',price:9000,currency:'KRW',available:true});
  c.streams[0].send({type:'done'});
  await pending;
  assert.equal(c.run('priceData.length'), 2);
  assert.equal(c.run('priceData.find(r=>r.country==="us").price'), 10);
  assert.equal(c.run('priceData.find(r=>r.country==="kr").available'), true);
});

test('IAP table renders country metadata even if IAP arrives before app prices', () => {
  const c = client();
  const fragment = {children:[],appendChild(row){this.children.push(row);}};
  c.context.document.createDocumentFragment = () => fragment;
  c.context.document.createElement = () => ({classList:{add(){}},innerHTML:''});
  c.element('iap-tbody').appendChild = () => {};
  c.run('exchangeRates={USD:1}; selectedIapTrackName="monthly"; iapsByCountry={us:[{trackKey:"monthly",price:5,currency:"USD"}]}; priceData=[]; renderIapTable();');
  assert.equal(fragment.children.length, 1);
  assert.match(fragment.children[0].innerHTML, /United States/);
});

test('late exchange-rate response cannot overwrite a newer snapshot', async () => {
  const pending = [];
  const c = client({ fetch: () => new Promise(resolve => pending.push(resolve)) });
  const first = c.run('fetchExchangeRates()');
  const second = c.run('fetchExchangeRates()');
  pending[1]({ok:true,json:async()=>({rates:{USD:1,KRW:1300}})});
  await second;
  pending[0]({ok:true,json:async()=>({rates:{USD:1,KRW:1000}})});
  await first;
  assert.equal(c.run('exchangeRates.KRW'), 1300);
});

test('history skips failed, missing and unconvertible country results', () => {
  const c = client();
  c.run('renderPriceHistory = renderPriceHistoryBadge = () => {}; exchangeRates = {USD:1}; scanCountryCodes = ["us","kr"]; priceData = [{country:"us", price:10, currency:"USD"}, {country:"kr", price:1, currency:"USD"}]; recordCurrentPriceHistory("123456","apple");');
  assert.equal(JSON.parse(c.storage.get('app_price_history'))[0].coverage, 'kr,us');
  c.run('priceData[1] = {country:"kr", available:false, fetchStatus:"request-failed"}; recordCurrentPriceHistory("123456","apple");');
  c.run('priceData.pop(); recordCurrentPriceHistory("123456","apple");');
  c.run('priceData.push({country:"kr", price:9900, currency:"KRW"}); recordCurrentPriceHistory("123456","apple");');
  const history = JSON.parse(c.storage.get('app_price_history'));
  assert.equal(history.length, 1);
  assert.equal(history[0].cheapestPrice, 1);
});

test('history does not compare prices when available-country coverage changes', () => {
  const c = client();
  c.run('renderPriceHistory = renderPriceHistoryBadge = () => {}; exchangeRates = {USD:1}; scanCountryCodes = ["us","kr"]; priceData = [{country:"us", price:10, currency:"USD"}, {country:"kr", price:1, currency:"USD"}]; recordCurrentPriceHistory("123456","apple");');
  c.run('priceData[1] = {country:"kr", available:false, fetchStatus:"unavailable"}; recordCurrentPriceHistory("123456","apple");');
  assert.equal(c.run('getPriceHistory().length'), 2);
  assert.equal(c.run('annotatePriceHistory(getPriceHistory())[0].change'), null);
  assert.equal(JSON.stringify(c.run('buildPriceTrendSeries(getPriceHistory(), getPriceHistory()[0])')), '[10]');
});

test('comparison excludes missing FX and unavailable prices from winner counts', () => {
  for (const [a, b] of [[10, 9900], [9900, 10], [10, null]]) {
    const c = client();
    const html = captureTable(c, 'compare-tbody');
    c.context.rowA = {country:'us', countryName:'United States', price:a, currency:a === 9900 ? 'KRW' : 'USD'};
    c.context.rowB = b === null ? {country:'us', available:false, fetchStatus:'request-failed'}
      : {country:'us', price:b, currency:b === 9900 ? 'KRW' : 'USD', formattedPrice:b === 9900 ? '₩9,900' : '$10.00'};
    c.run('exchangeRates = {USD:1}; priceData = [rowA]; comparePriceData = [rowB]; renderCompareTable();');
    assert.doesNotMatch(html(), /compare-winner/);
    assert.match(c.element('compare-status-text').textContent, /0개국에서 앱 A 저렴 · 0개국에서 앱 B 저렴 · 0개국 동일/);
  }
});

test('comparison counts verified free prices as wins and free pairs as ties', () => {
  const c = client();
  const html = captureTable(c, 'compare-tbody');
  c.run('exchangeRates = {USD:1}; priceData = [{country:"us", countryName:"United States", price:10, currency:"USD"}]; comparePriceData = [{country:"us", price:0, currency:"USD"}]; renderCompareTable();');
  assert.match(html(), /compare-app-b compare-winner/);
  assert.match(html(), /-100\.0%/);
  c.run('priceData[0].price = 0; renderCompareTable();');
  assert.doesNotMatch(html(), /compare-winner/);
  assert.match(c.element('compare-status-text').textContent, /1개국 동일/);
});

test('new main search clears previous comparison rows, labels and controls', async () => {
  const c = client();
  const labels = {'#compare-table .compare-app-a':{textContent:'Old A'}, '#compare-table .compare-app-b':{textContent:'Old B'}};
  c.context.document.querySelector = selector => labels[selector] || null;
  c.element('compare-tbody').innerHTML = '<tr><td>Old prices</td></tr>';
  c.element('compare-search-input').value = '654321';
  c.run('updateStats = renderTable = loadIapData = recordCurrentPriceHistory = () => {}; comparePriceData = [{country:"us", price:99}]; compareAppName = "Old B";');
  const result = c.run('searchApp({appId:"123456"})');
  await tick();
  assert.equal(c.run('comparePriceData.length'), 0);
  assert.equal(c.run('compareAppName'), '');
  assert.equal(c.element('compare-section').classList.contains('hidden'), true);
  assert.doesNotMatch(c.element('compare-tbody').innerHTML, /Old prices/);
  assert.equal(c.element('compare-search-input').value, '');
  assert.equal(labels['#compare-table .compare-app-a'].textContent, '앱 A');
  assert.equal(labels['#compare-table .compare-app-b'].textContent, '앱 B');
  c.streams[0].send({country:'us', price:10, currency:'USD', available:true});
  c.streams[0].send({type:'done'});
  await result;
});

test('IAP table keeps the US comparison baseline outside region and search filters', () => {
  const c = client();
  const html = captureTable(c, 'iap-tbody');
  c.run('exchangeRates={USD:1}; selectedIapTrackName="pro"; iapsByCountry={us:[{trackKey:"pro", price:10, currency:"USD"}],de:[{trackKey:"pro", price:8, currency:"USD"}]}; iapCurrentRegion="Europe"; renderIapTable();');
  assert.match(html(), /-20\.0%/);
  assert.doesNotMatch(html(), /United States/);
  c.run('iapCurrentRegion="all"; iapCountrySearchQuery="germany"; renderIapTable();');
  assert.match(html(), /-20\.0%/);
});

test('Google IAP selector retains maximum tracks found outside the US', () => {
  const c = client();
  const options = [];
  c.context.document.createElement = () => ({value:'', textContent:''});
  c.element('iap-select').appendChild = option => options.push(option);
  c.run('renderIapTable = () => {}; currentStore = "google"; selectedIapTrackName = "google_play_max"; iapsByCountry={us:[{trackKey:"google_play_min",trackName:"Min",price:5,currency:"USD"}],kr:[{trackKey:"google_play_min",trackName:"Min",price:5,currency:"USD"},{trackKey:"google_play_max",trackName:"Max",price:100,currency:"USD"}]}; iapStatuses={us:"ok",kr:"ok"}; renderIapSummary(true);');
  assert.deepEqual(options.map(option => option.value), ['google_play_min','google_play_max']);
  assert.equal(c.run('selectedIapTrackName'), 'google_play_max');
  assert.equal(c.element('iap-select').disabled, false);
});

test('static searches report a missing app instead of leaving a loading title', async () => {
  const c = client();
  c.context.window.location.hostname = 'example.github.io';
  c.run('var historyWrites=0; updateStats = renderTable = loadIapData = () => {}; recordCurrentPriceHistory = () => historyWrites++; fetchITunesJSONP = async () => null;');
  const rows = await c.run('searchApp({appId:"999999999999"})');
  assert.equal(rows.length, 0);
  assert.equal(c.element('error-title').textContent, '앱을 찾을 수 없습니다');
  assert.match(c.element('error-msg').textContent, /앱 URL 또는 ID/);
  assert.equal(c.element('error-section').classList.contains('hidden'), false);
  assert.equal(c.element('results-section').classList.contains('hidden'), true);
  assert.notEqual(c.element('app-name').textContent, '조회 중…');
  assert.equal(c.element('search-btn').disabled, false);
  assert.equal(c.run('historyWrites'), 0);
});

test('static request failures remain retryable without claiming an app is missing', async () => {
  const c = client();
  c.context.window.location.hostname = 'example.github.io';
  c.run('updateStats = renderTable = loadIapData = () => {}; fetchITunesJSONP = async () => { throw Error("network"); };');
  await c.run('searchApp({appId:"123456"})');
  assert.equal(c.element('error-title').textContent, '가격 조회에 실패했습니다');
  assert.equal(c.element('retry-failed-btn').disabled, false);
  assert.equal(c.element('results-section').classList.contains('hidden'), false);
  assert.equal(c.run('priceData.every(row => row.fetchStatus === "request-failed")'), true);
  assert.equal(c.storage.has('app_price_history'), false);
});
