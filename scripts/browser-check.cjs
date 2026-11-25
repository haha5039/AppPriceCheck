const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const axios = require('axios');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

function lookup(id, country) {
  const prices = { us: 14, at: 14, kr: 0, it: 4 };
  if (!(country in prices)) return { resultCount: 0, results: [] };
  return { resultCount: 1, results: [{
    trackName: 'Apple fixture', price: prices[country], currency: 'USD',
    trackViewUrl: `https://apps.apple.com/${country}/app/id${id}`,
  }] };
}

test('Pages works with a separate HTTPS price API and preserves other apps on its origin', { timeout: 45000 }, async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'appprice-browser-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.cpSync(path.join(root, 'public'), path.join(temp, 'public'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'scripts'));
  fs.copyFileSync(path.join(__dirname, 'configure-pages-api.cjs'), path.join(temp, 'scripts', 'configure-pages-api.cjs'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=127.0.0.1', '-keyout', 'key.pem', '-out', 'cert.pem'], { cwd: temp, stdio: 'ignore' });

  const frontend = http.createServer((req, res) => {
    if (req.url === '/setup') return res.end('<!doctype html>');
    if (['/AppPriceCheck/sw.js', '/other/sw.js'].includes(req.url)) {
      res.setHeader('Content-Type', 'text/javascript');
      return res.end('self.addEventListener("install", () => self.skipWaiting());');
    }
    const file = new URL(req.url, 'http://localhost').pathname.split('/').pop() || 'index.html';
    const types = { 'index.html': 'text/html', 'app.js': 'text/javascript', 'style.css': 'text/css' };
    if (!Object.hasOwn(types, file)) return res.writeHead(404).end();
    res.setHeader('Content-Type', types[file]);
    res.end(fs.readFileSync(path.join(temp, 'public', file)));
  });
  const origin = `http://127.0.0.1:${await listen(frontend)}`;
  t.after(() => { frontend.closeAllConnections(); frontend.close(); });

  const googleCalls = new Set();
  let releaseItaly;
  const waitForItaly = new Promise(resolve => { releaseItaly = resolve; });
  t.after(releaseItaly);
  const originalCreate = axios.create;
  axios.create = () => ({ async get(raw) {
    const url = new URL(raw);
    const id = url.searchParams.get('id');
    if (url.hostname === 'itunes.apple.com') return { data: lookup(id, url.searchParams.get('country')) };
    if (url.hostname === 'apps.apple.com') {
      return { data: '<script>{"textPairs":[["Pro","$9.99"]]}</script>' };
    }
    assert.equal(url.hostname, 'play.google.com');
    const country = url.searchParams.get('gl');
    googleCalls.add(country);
    if (country === 'it') await waitForItaly;
    if (country === 'kr') throw Object.assign(new Error('Fixture denial'), { response: { status: 403 } });
    if (!['us', 'it'].includes(country)) return { status: 404 };
    return { status: 200, data: '<meta itemprop="price" content="$3.00"><script>"priceCurrency":"USD"</script>'
      + '<h1><span>Google fixture</span></h1>"$2.00 - $7.00 per item"' };
  } });
  process.env.PAGES_ORIGIN = origin;
  let app;
  try { ({ app } = require('../server.js')); }
  finally { axios.create = originalCreate; }
  const backend = https.createServer({
    key: fs.readFileSync(path.join(temp, 'key.pem')),
    cert: fs.readFileSync(path.join(temp, 'cert.pem')),
  }, (req, res) => {
    if (!req.url.startsWith('/api/google-prices-stream/com.example.partial')) return app(req, res);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': origin });
    res.end('data: {"country":"us","available":true,"price":3,"currency":"USD"}\n\ndata: {"type":"done","total":1}\n\n');
  });
  const api = `https://127.0.0.1:${await listen(backend)}`;
  t.after(() => { backend.closeAllConnections(); backend.close(); });
  execFileSync(process.execPath, [path.join(temp, 'scripts', 'configure-pages-api.cjs')], {
    env: { ...process.env, PAGES_API_BASE_URL: api },
  });

  const browser = await chromium.launch();
  t.after(() => browser.close());
  const context = await browser.newContext({ ignoreHTTPSErrors: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.route('https://open.er-api.com/**', route => route.fulfill({ json: { rates: { USD: 1, KRW: 1000 } } }));
  await page.route('https://itunes.apple.com/lookup?**', route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ contentType: 'text/javascript',
      body: `${params.get('callback')}(${JSON.stringify(lookup(params.get('id'), params.get('country')))});` });
  });
  await page.route('https://fonts.googleapis.com/**', route => route.abort());

  await page.goto(origin + '/setup');
  await page.evaluate(async () => {
    await Promise.all([
      navigator.serviceWorker.register('/AppPriceCheck/sw.js'),
      navigator.serviceWorker.register('/other/sw.js'),
      caches.open('appprice-v2.0.0'),
      caches.open('appprice-other-project'),
    ]);
  });
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).filter(reg => reg.active).length === 2);
  await page.goto(origin + '/AppPriceCheck/');
  await page.waitForFunction(async () => !(await caches.has('appprice-v2.0.0')));
  assert.deepEqual(await page.evaluate(async () => ({
    registrations: (await navigator.serviceWorker.getRegistrations()).map(reg => new URL(reg.scope).pathname),
    caches: await caches.keys(),
  })), { registrations: ['/other/'], caches: ['appprice-other-project'] });

  await page.fill('#search-input', '123456');
  await page.click('#search-btn');
  await page.waitForFunction(() => document.querySelector('#scan-status').textContent.includes('조회 완료'));
  await page.waitForFunction(() => document.querySelector('#iap-loading-text').textContent.includes('조회 완료'));
  assert.match(await page.locator('#iap-select').innerText(), /Pro/);
  assert.match(await page.locator('#insight-best-country').innerText(), /South Korea/);
  assert.match(await page.locator('#insight-max-saving').innerText(), /14\.00/);

  const visibleCodes = () => page.locator('#price-tbody .country-code').allTextContents();
  await page.click('[data-tier="sub-5"]');
  assert.deepEqual(await visibleCodes(), ['KR', 'IT']);
  await page.selectOption('#base-currency-select', 'KRW');
  assert.deepEqual(await visibleCodes(), ['KR', 'IT']);
  assert.match(await page.locator('#avg-price-currency').innerText(), /KRW/);
  await page.click('[data-tier="exp-top"]');
  assert.deepEqual((await visibleCodes()).sort(), ['AT', 'US']);
  await page.click('[data-tier="sub-5"]');
  await page.click('#iap-region-tabs [data-region="Europe"]');
  assert.deepEqual(await visibleCodes(), ['KR', 'IT']);
  await page.selectOption('#sort-select', 'usd-desc');
  assert.deepEqual(await visibleCodes(), ['IT', 'KR']);
  await page.click('#copy-table-btn');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.deepEqual(copied.trim().split('\n').slice(1).map(row => row.split('\t')[1].match(/\b(IT|KR)\b/)[0]), ['IT', 'KR']);

  await page.click('#compare-btn');
  await page.fill('#compare-search-input', 'com.example.app');
  await page.click('#compare-search-btn');
  // The first country's SSE frame arrives while Italy is still held upstream.
  const early = await page.evaluate(async endpoint => {
    const response = await fetch(endpoint);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let frames = '';
    try {
      while (!frames.includes('"country":"us"')) {
        const { value, done } = await reader.read();
        if (done) break;
        frames += decoder.decode(value, { stream: true });
      }
      return frames;
    } finally {
      await reader.cancel();
    }
  }, api + '/api/google-prices-stream/com.example.stream?countries=us,it');
  assert.match(early, /"country":"us"/);
  assert.doesNotMatch(early, /"type":"done"/);
  releaseItaly();
  const waitForComparison = () => page.waitForFunction(() => document.querySelector('#compare-status-text').textContent.includes('비교 완료'));
  await waitForComparison();
  assert.equal(googleCalls.size, 108);
  const italy = page.locator('#compare-tbody tr').filter({ hasText: 'Italy' });
  assert.match(await italy.innerText(), /₩3,000/);
  assert.match(await page.locator('#compare-tbody tr').filter({ hasText: 'South Korea' }).innerText(), /조회 실패/);
  assert.match(await page.locator('#compare-tbody tr').filter({ hasText: 'Austria' }).innerText(), /미판매/);
  assert.match(await page.locator('#compare-currency-b').innerText(), /KRW/);
  await page.selectOption('#base-currency-select', 'USD');
  assert.match(await page.locator('#compare-currency-b').innerText(), /USD/);
  assert.match(await italy.innerText(), /\$3\.00/);

  await page.fill('#compare-search-input', 'com.example.partial');
  await page.click('#compare-search-btn');
  await waitForComparison();
  assert.match(await italy.innerText(), /미조회/);

  await page.fill('#search-input', 'com.example.app');
  await page.click('#search-btn');
  await page.waitForFunction(() => document.querySelector('#scan-status').textContent.includes('조회 완료'));
  assert.match(await page.locator('#app-name').innerText(), /Google fixture/);
  assert.match(await page.locator('#iap-select').innerText(), /최저가.*최고가/s);
});
