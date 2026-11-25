const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
let failKorea = false, calls = [], observedAbort;
let signalObserved;
const signalReady = new Promise(resolve => { signalObserved = resolve; });
const mockClient = {
  async get(raw, options = {}) {
    const url = new URL(raw);
    calls.push(url.href);
    const id = url.searchParams.get('id');
    if (id === '999999') {
      signalObserved();
      return new Promise((resolve, reject) => {
        const abort = () => { observedAbort?.(); reject(new Error('cancelled')); };
        if (options.signal.aborted) abort();
        else options.signal.addEventListener('abort', abort, { once: true });
      });
    }
    if (url.hostname === 'apps.apple.com') {
      if (url.pathname.startsWith('/kr/')) throw Object.assign(new Error('upstream failure'), {response: {status:400}});
      return {data:'<script>{"textPairs":[["Pro","$9.99"]]}</script>'};
    }
    if (url.hostname === 'play.google.com') {
      if (id === 'com.example.missing') {
        assert.equal(options.validateStatus(404), true);
        return { status: 404, data: 'Not found' };
      }
      return {data:'<meta itemprop="price" content="0"><script>"priceCurrency":"USD"</script><h1><span>Fixture</span></h1>"$1.00 - $9.00 per item"'};
    }
    if (url.pathname === '/search') return {data: {results:[{trackId:123456,trackName:'Fixture',price:0}]}};
    const country = url.searchParams.get('country');
    if ((failKorea || id === '777777') && country === 'kr') {
      throw Object.assign(new Error('upstream failure'), { response: { status: 400 } });
    }
    if (id === '888888' || id === '777777' || (id === '666666' && country !== 'ie')) {
      return { data: { resultCount: 0, results: [] } };
    }
    return {data:{resultCount:1,results:[{trackId:Number(id),trackName:'Fixture',price:10,currency:'USD',trackViewUrl:`https://apps.apple.com/${url.searchParams.get('country')}/app/id${id}`}]}};
  }
};
const create = axios.create;
axios.create = () => mockClient;
const { app } = require('../server.js');
axios.create = create;
let server, base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});
async function events(path) {
  const res = await fetch(base + path);
  assert.equal(res.status, 200);
  const body = await res.text();
  return body.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)));
}

test('API rejects structured queries and invalid identifiers before contacting upstream', async () => {
  const initial = calls.length;
  for (const path of ['/api/search?q[]=a&q[]=b', '/api/search?q[name]=a', '/api/prices-stream/not-an-id',
    '/api/prices-stream/123456?hintCountry=zz', '/api/iap-stream/123456?countries=us,zz',
    '/api/google-prices-stream/com.example?refresh[]=1']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 400, path);
    await response.json();
  }
  assert.equal(calls.length, initial);
  assert.equal((await fetch(base + '/api/countries')).status, 200);
});

test('selected-country price stream ends exactly once and preserves cached subset boundaries', async () => {
  const us = await events('/api/prices-stream/123456?countries=us');
  assert.deepEqual(us.filter(r => r.country).map(r => r.country), ['us']);
  assert.equal(us.filter(r => r.type === 'done').length, 1);
  const kr = await events('/api/prices-stream/123456?countries=kr');
  assert.deepEqual(kr.filter(r => r.country).map(r => r.country), ['kr']);
  const cached = await events('/api/prices-stream/123456?countries=us');
  assert.equal(cached.at(-1).fromCache, true);
});

test('Apple queries only the requested countries and discovers apps sold solely in Ireland', async () => {
  const before = calls.length;
  const result = await events('/api/prices-stream/666666?countries=ie&hintCountry=us');
  assert.equal(result[0].available, true);
  assert.equal(result[0].country, 'ie');
  assert.deepEqual(calls.slice(before).map(raw => new URL(raw).searchParams.get('country')), ['ie']);
  assert.equal(result[1].type, 'done');
});

test('Apple emits one row per country and distinguishes a complete absence from mixed failures', async () => {
  const absent = await events('/api/prices-stream/888888?countries=us,kr');
  assert.deepEqual(absent.map(row => row.fetchStatus || row.type), ['unavailable', 'unavailable', 'done']);
  const partial = await events('/api/prices-stream/777777?countries=us,kr');
  assert.equal(partial.find(row => row.country === 'kr').fetchStatus, 'request-failed');
  assert.equal(partial.find(row => row.country === 'us').fetchStatus, 'unavailable');
  assert.equal(partial.at(-1).type, 'done');
});

test('transient price failures are explicit and not replayed from aggregate cache', async () => {
  failKorea = true;
  const first = await events('/api/prices-stream/234567?countries=us,kr');
  assert.equal(first.find(r => r.country === 'kr').fetchStatus, 'request-failed');
  failKorea = false;
  const next = await events('/api/prices-stream/234567?countries=us,kr');
  assert.equal(next.find(r => r.country === 'kr').available, true);
  assert.notEqual(next.at(-1).fromCache, true);
});

test('IAP stream reports failures separately from empty products and never caches failures', async () => {
  const first = await events('/api/iap-stream/345678?countries=us,kr');
  assert.equal(first.find(r => r.country === 'us').iaps[0].price, 9.99);
  assert.equal(first.find(r => r.country === 'kr').fetchStatus, 'request-failed');
  assert.equal(first.at(-1).failed, 1);
  const next = await events('/api/iap-stream/345678?countries=us,kr');
  assert.notEqual(next.at(-1).fromCache, true);
});

test('Google Play fixture retains IAP edges and emits one terminal event', async () => {
  const result = await events('/api/google-prices-stream/com.example.app?countries=us');
  assert.deepEqual(result.find(r => r.country === 'us').iaps.map(i => i.price), [1,9]);
  assert.equal(result.filter(r => r.type === 'done').length, 1);
});

test('Google Play 404 is a cacheable unavailable row and never enters the retry pass', async () => {
  const before = calls.length;
  const path = '/api/google-prices-stream/com.example.missing?countries=us';
  const first = await events(path);
  assert.equal(first.find(row => row.country === 'us').fetchStatus, 'unavailable');
  assert.equal(first.some(row => row.noticeType === 'retry'), false);
  await events(path);
  assert.equal(calls.length - before, 1);
});

test('static serving includes only public assets and CORS covers API responses and errors', async () => {
  assert.equal((await fetch(base + '/')).status, 200);
  for (const path of ['/server.js', '/server.log', '/package-lock.json', '/test/server-routes.test.js']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  const origin = process.env.PAGES_ORIGIN || 'https://haha5039.github.io';
  const allowed = await fetch(base + '/api/prices-stream/invalid', { headers: { Origin: origin } });
  assert.equal(allowed.status, 400);
  assert.equal(allowed.headers.get('access-control-allow-origin'), origin);
  assert.match(allowed.headers.get('vary'), /Origin/);
  const unrelated = await fetch(base + '/api/countries', { headers: { Origin: 'https://unrelated.example' } });
  assert.equal(unrelated.headers.get('access-control-allow-origin'), null);
});

test('disconnect aborts in-flight upstream request without launching the next country', async () => {
  const abortSeen = new Promise(resolve => { observedAbort = resolve; });
  const controller = new AbortController();
  const response = await fetch(base + '/api/prices-stream/999999?countries=us,kr', {signal: controller.signal});
  await signalReady;
  const count = calls.filter(url => url.includes('id=999999')).length;
  controller.abort();
  await abortSeen;
  await response.body.cancel().catch(() => {});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(url => url.includes('id=999999')).length, count);
});
