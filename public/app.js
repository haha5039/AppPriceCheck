/* ═══════════════════════════════════════════════════════════════
   AppPriceCheck — app.js
   Frontend: URL parsing · SSE streaming · Table rendering
═══════════════════════════════════════════════════════════════ */

// ─── State ────────────────────────────────────────────────────────────────────
let priceData = [];          // Array of country-price objects
let exchangeRates = {};      // { USD: 1, KRW: 1400, ... }
let currentSort = 'usd-asc';
let currentRegion = 'all';
let countrySearchQuery = '';
let iapsByCountry = {};      // { 'us': [{trackId, trackName, price, currency}], ... }
let selectedIapTrackName = '';
let currentAppId = '';
let currentAppIsFree = false;
let iapCompletedCountries = 0;

const TOTAL_COUNTRIES = 108;

// ─── Country List & Helpers for GitHub Pages Mode ────────────────────────────
const APP_STORE_COUNTRIES = [
  // Americas
  { code: 'us', name: 'United States',   flag: '🇺🇸', region: 'Americas' },
  { code: 'ca', name: 'Canada',          flag: '🇨🇦', region: 'Americas' },
  { code: 'mx', name: 'Mexico',          flag: '🇲🇽', region: 'Americas' },
  { code: 'br', name: 'Brazil',          flag: '🇧🇷', region: 'Americas' },
  { code: 'ar', name: 'Argentina',       flag: '🇦🇷', region: 'Americas' },
  { code: 'cl', name: 'Chile',           flag: '🇨🇱', region: 'Americas' },
  { code: 'co', name: 'Colombia',        flag: '🇨🇴', region: 'Americas' },
  { code: 'pe', name: 'Peru',            flag: '🇵🇪', region: 'Americas' },
  { code: 'uy', name: 'Uruguay',         flag: '🇺🇾', region: 'Americas' },
  { code: 'bo', name: 'Bolivia',         flag: '🇧🇴', region: 'Americas' },
  { code: 'ec', name: 'Ecuador',         flag: '🇪🇨', region: 'Americas' },
  { code: 'cr', name: 'Costa Rica',      flag: '🇨🇷', region: 'Americas' },
  { code: 'gt', name: 'Guatemala',       flag: '🇬🇹', region: 'Americas' },
  { code: 'py', name: 'Paraguay',        flag: '🇵🇾', region: 'Americas' },
  { code: 'do', name: 'Dominican Rep.',  flag: '🇩🇴', region: 'Americas' },
  { code: 'jm', name: 'Jamaica',         flag: '🇯🇲', region: 'Americas' },
  { code: 'tt', name: 'Trinidad & Tobago',flag:'🇹🇹', region: 'Americas' },
  // Europe
  { code: 'gb', name: 'United Kingdom',  flag: '🇬🇧', region: 'Europe' },
  { code: 'de', name: 'Germany',         flag: '🇩🇪', region: 'Europe' },
  { code: 'fr', name: 'France',          flag: '🇫🇷', region: 'Europe' },
  { code: 'it', name: 'Italy',           flag: '🇮🇹', region: 'Europe' },
  { code: 'es', name: 'Spain',           flag: '🇪🇸', region: 'Europe' },
  { code: 'nl', name: 'Netherlands',     flag: '🇳🇱', region: 'Europe' },
  { code: 'se', name: 'Sweden',          flag: '🇸🇪', region: 'Europe' },
  { code: 'no', name: 'Norway',          flag: '🇳🇴', region: 'Europe' },
  { code: 'dk', name: 'Denmark',         flag: '🇩🇰', region: 'Europe' },
  { code: 'fi', name: 'Finland',         flag: '🇫🇮', region: 'Europe' },
  { code: 'pl', name: 'Poland',          flag: '🇵🇱', region: 'Europe' },
  { code: 'be', name: 'Belgium',         flag: '🇧🇪', region: 'Europe' },
  { code: 'at', name: 'Austria',         flag: '🇦🇹', region: 'Europe' },
  { code: 'ch', name: 'Switzerland',     flag: '🇨🇭', region: 'Europe' },
  { code: 'pt', name: 'Portugal',        flag: '🇵🇹', region: 'Europe' },
  { code: 'ie', name: 'Ireland',         flag: '🇮🇪', region: 'Europe' },
  { code: 'cz', name: 'Czech Republic',  flag: '🇨🇿', region: 'Europe' },
  { code: 'hu', name: 'Hungary',         flag: '🇭🇺', region: 'Europe' },
  { code: 'ro', name: 'Romania',         flag: '🇷🇴', region: 'Europe' },
  { code: 'gr', name: 'Greece',          flag: '🇬🇷', region: 'Europe' },
  { code: 'tr', name: 'Turkey',          flag: '🇹🇷', region: 'Europe' },
  { code: 'ua', name: 'Ukraine',         flag: '🇺🇦', region: 'Europe' },
  { code: 'ru', name: 'Russia',          flag: '🇷🇺', region: 'Europe' },
  { code: 'sk', name: 'Slovakia',        flag: '🇸🇰', region: 'Europe' },
  { code: 'bg', name: 'Bulgaria',        flag: '🇧🇬', region: 'Europe' },
  { code: 'hr', name: 'Croatia',         flag: '🇭🇷', region: 'Europe' },
  { code: 'si', name: 'Slovenia',        flag: '🇸🇮', region: 'Europe' },
  { code: 'lt', name: 'Lithuania',       flag: '🇱🇹', region: 'Europe' },
  { code: 'lv', name: 'Latvia',          flag: '🇱🇻', region: 'Europe' },
  { code: 'ee', name: 'Estonia',         flag: '🇪🇪', region: 'Europe' },
  { code: 'lu', name: 'Luxembourg',      flag: '🇱🇺', region: 'Europe' },
  { code: 'mt', name: 'Malta',           flag: '🇲🇹', region: 'Europe' },
  { code: 'cy', name: 'Cyprus',          flag: '🇨🇾', region: 'Europe' },
  { code: 'is', name: 'Iceland',         flag: '🇮🇸', region: 'Europe' },
  { code: 'al', name: 'Albania',         flag: '🇦🇱', region: 'Europe' },
  { code: 'rs', name: 'Serbia',          flag: '🇷🇸', region: 'Europe' },
  { code: 'mk', name: 'N. Macedonia',    flag: '🇲🇰', region: 'Europe' },
  { code: 'md', name: 'Moldova',         flag: '🇲🇩', region: 'Europe' },
  { code: 'am', name: 'Armenia',         flag: '🇦🇲', region: 'Europe' },
  { code: 'ge', name: 'Georgia',         flag: '🇬🇪', region: 'Europe' },
  { code: 'az', name: 'Azerbaijan',      flag: '🇦🇿', region: 'Europe' },
  { code: 'kz', name: 'Kazakhstan',      flag: '🇰🇿', region: 'Europe' },
  // Asia Pacific
  { code: 'jp', name: 'Japan',           flag: '🇯🇵', region: 'Asia Pacific' },
  { code: 'kr', name: 'South Korea',     flag: '🇰🇷', region: 'Asia Pacific' },
  { code: 'cn', name: 'China',           flag: '🇨🇳', region: 'Asia Pacific' },
  { code: 'au', name: 'Australia',       flag: '🇦🇺', region: 'Asia Pacific' },
  { code: 'nz', name: 'New Zealand',     flag: '🇳🇿', region: 'Asia Pacific' },
  { code: 'sg', name: 'Singapore',       flag: '🇸🇬', region: 'Asia Pacific' },
  { code: 'hk', name: 'Hong Kong',       flag: '🇭🇰', region: 'Asia Pacific' },
  { code: 'tw', name: 'Taiwan',          flag: '🇹🇼', region: 'Asia Pacific' },
  { code: 'in', name: 'India',           flag: '🇮🇳', region: 'Asia Pacific' },
  { code: 'th', name: 'Thailand',        flag: '🇹🇭', region: 'Asia Pacific' },
  { code: 'ph', name: 'Philippines',     flag: '🇵🇭', region: 'Asia Pacific' },
  { code: 'my', name: 'Malaysia',        flag: '🇲🇾', region: 'Asia Pacific' },
  { code: 'id', name: 'Indonesia',       flag: '🇮🇩', region: 'Asia Pacific' },
  { code: 'vn', name: 'Vietnam',         flag: '🇻🇳', region: 'Asia Pacific' },
  { code: 'pk', name: 'Pakistan',        flag: '🇵🇰', region: 'Asia Pacific' },
  { code: 'lk', name: 'Sri Lanka',       flag: '🇱🇰', region: 'Asia Pacific' },
  { code: 'mn', name: 'Mongolia',        flag: '🇲🇳', region: 'Asia Pacific' },
  { code: 'np', name: 'Nepal',           flag: '🇳🇵', region: 'Asia Pacific' },
  { code: 'mm', name: 'Myanmar',         flag: '🇲🇲', region: 'Asia Pacific' },
  { code: 'kh', name: 'Cambodia',        flag: '🇰🇭', region: 'Asia Pacific' },
  { code: 'bn', name: 'Brunei',          flag: '🇧🇳', region: 'Asia Pacific' },
  { code: 'uz', name: 'Uzbekistan',      flag: '🇺🇿', region: 'Asia Pacific' },
  { code: 'kg', name: 'Kyrgyzstan',      flag: '🇰🇬', region: 'Asia Pacific' },
  // Middle East
  { code: 'ae', name: 'UAE',             flag: '🇦🇪', region: 'Middle East' },
  { code: 'sa', name: 'Saudi Arabia',    flag: '🇸🇦', region: 'Middle East' },
  { code: 'kw', name: 'Kuwait',          flag: '🇰🇼', region: 'Middle East' },
  { code: 'qa', name: 'Qatar',           flag: '🇶🇦', region: 'Middle East' },
  { code: 'bh', name: 'Bahrain',         flag: '🇧🇭', region: 'Middle East' },
  { code: 'om', name: 'Oman',            flag: '🇴🇲', region: 'Middle East' },
  { code: 'jo', name: 'Jordan',          flag: '🇯🇴', region: 'Middle East' },
  { code: 'eg', name: 'Egypt',           flag: '🇪🇬', region: 'Middle East' },
  { code: 'il', name: 'Israel',          flag: '🇮🇱', region: 'Middle East' },
  { code: 'lb', name: 'Lebanon',         flag: '🇱🇧', region: 'Middle East' },
  { code: 'iq', name: 'Iraq',            flag: '🇮🇶', region: 'Middle East' },
  // Africa
  { code: 'za', name: 'South Africa',    flag: '🇿🇦', region: 'Africa' },
  { code: 'ng', name: 'Nigeria',         flag: '🇳🇬', region: 'Africa' },
  { code: 'ke', name: 'Kenya',           flag: '🇰🇪', region: 'Africa' },
  { code: 'gh', name: 'Ghana',           flag: '🇬🇭', region: 'Africa' },
  { code: 'tz', name: 'Tanzania',        flag: '🇹🇿', region: 'Africa' },
  { code: 'ma', name: 'Morocco',         flag: '🇲🇦', region: 'Africa' },
  { code: 'ug', name: 'Uganda',          flag: '🇺🇬', region: 'Africa' },
  { code: 'sn', name: 'Senegal',         flag: '🇸🇳', region: 'Africa' },
  { code: 'dz', name: 'Algeria',         flag: '🇩🇿', region: 'Africa' },
  { code: 'tn', name: 'Tunisia',         flag: '🇹🇳', region: 'Africa' },
  { code: 'et', name: 'Ethiopia',        flag: '🇪🇹', region: 'Africa' },
  { code: 'zm', name: 'Zambia',          flag: '🇿🇲', region: 'Africa' },
  { code: 'cm', name: 'Cameroon',        flag: '🇨🇲', region: 'Africa' },
  { code: 'ci', name: 'Côte d\'Ivoire',  flag: '🇨🇮', region: 'Africa' },
  { code: 'mz', name: 'Mozambique',      flag: '🇲🇿', region: 'Africa' },
];

async function limitedParallel(tasks, concurrency = 8) {
  const results = new Array(tasks.length).fill(null);
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try { results[i] = await tasks[i](); }
      catch { results[i] = null; }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, worker)
  );
  return results;
}

// ─── URL Parsing ──────────────────────────────────────────────────────────────
function parseAppStoreUrl(input) {
  input = (input || '').trim();
  if (!input) return null;

  // Plain numeric ID
  if (/^\d{6,12}$/.test(input)) return { appId: input, hintCountry: null };

  // Various Apple URL patterns with country code
  const patterns = [
    /apps\.apple\.com\/([a-z]{2})\/app\/[^/]*\/id(\d+)/i,
    /apps\.apple\.com\/([a-z]{2})\/app\/id(\d+)/i,
    /itunes\.apple\.com\/([a-z]{2})\/app\/[^/]*\/id(\d+)/i,
    /itunes\.apple\.com\/([a-z]{2})\/app\/id(\d+)/i,
  ];

  for (const re of patterns) {
    const m = input.match(re);
    if (m) return { appId: m[2], hintCountry: m[1].toLowerCase() };
  }

  // Fallback for URLs without country code (e.g. /id123456)
  const idMatch = input.match(/\/id(\d{6,12})/);
  if (idMatch) return { appId: idMatch[1], hintCountry: null };

  return null;
}

// ─── Formatting ───────────────────────────────────────────────────────────────
function fmtUSD(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
  if (amount === 0) return '무료';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtLocal(price, currency, formattedPrice) {
  if (price === 0) return '<span class="free-badge">무료</span>';
  if (formattedPrice) return escHtml(formattedPrice);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Convert local-currency price to USD
function toUSD(price, currency) {
  if (price === 0) return 0;
  if (!price || !currency) return null;
  if (currency === 'USD') return price;
  const rate = exchangeRates[currency];
  if (!rate) return null;
  return price / rate;
}

// Diff CSS class
function diffClass(diff) {
  if (diff === null) return 'neutral';
  if (diff <= -35) return 'very-cheap';
  if (diff <= -15) return 'cheap';
  if (diff <= -5)  return 'slightly-cheap';
  if (diff <= 5)   return 'neutral';
  if (diff <= 20)  return 'slightly-exp';
  if (diff <= 40)  return 'expensive';
  return 'very-expensive';
}

function diffLabel(diff) {
  if (diff === null) return '';
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}%`;
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');

// ─── Fetch Exchange Rates ─────────────────────────────────────────────────────
async function fetchExchangeRates() {
  try {
    const res = await fetch('/api/rates');
    if (!res.ok) throw new Error('Local API not available');
    const data = await res.json();
    exchangeRates = data.rates || {};
    exchangeRates['USD'] = 1;
  } catch (e) {
    // Fallback to open.er-api.com directly from browser for GitHub Pages mode
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await res.json();
      exchangeRates = data.rates || {};
      exchangeRates['USD'] = 1;
    } catch (err) {
      console.warn('Exchange rates fetch failed:', err);
      exchangeRates = { USD: 1 };
    }
  }
}

function fetchITunesJSONP(appId, country) {
  return new Promise((resolve) => {
    const cb = 'itunes_' + country + '_' + Math.random().toString(36).slice(2, 8);
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      delete window[cb];
      if (script.parentNode) script.parentNode.removeChild(script);
      resolve(null);
    }, 3000);

    window[cb] = (data) => {
      clearTimeout(timeout);
      delete window[cb];
      if (script.parentNode) script.parentNode.removeChild(script);
      if (data && data.resultCount > 0 && data.results && data.results[0]) {
        resolve(data.results[0]);
      } else {
        resolve(null);
      }
    };

    script.onerror = () => {
      clearTimeout(timeout);
      delete window[cb];
      if (script.parentNode) script.parentNode.removeChild(script);
      resolve(null);
    };

    script.src = `https://itunes.apple.com/lookup?id=${appId}&country=${country}&callback=${cb}`;
    document.head.appendChild(script);
  });
}

function updateAppHeaderMeta() {
  const usItem = priceData.find(i => i.country === 'us' && i.appName);
  const krItem = priceData.find(i => i.country === 'kr' && i.appName);
  const gbItem = priceData.find(i => i.country === 'gb' && i.appName);
  const caItem = priceData.find(i => i.country === 'ca' && i.appName);
  const anyItem = priceData.find(i => i.appName);

  const bestItem = usItem || krItem || gbItem || caItem || anyItem;
  if (!bestItem) return;

  $('app-name').textContent = bestItem.appName;
  $('app-developer').textContent = `개발사 · ${bestItem.developer || '—'}`;
  if (bestItem.artworkUrl) {
    $('app-icon').src = bestItem.artworkUrl.replace('100x100bb', '200x200bb');
  }
  if (bestItem.rating) {
    $('app-rating').textContent = `⭐ ${bestItem.rating.toFixed(1)} (${(bestItem.ratingCount || 0).toLocaleString()})`;
  } else {
    $('app-rating').textContent = '';
  }
  $('app-genre').textContent = bestItem.primaryGenreName || '';
}

// ─── Stats Update ─────────────────────────────────────────────────────────────
function updateStats() {
  updateAppHeaderMeta();

  const availableItems = priceData.filter((item) => item.available !== false);
  const usItem = availableItems.find(i => i.country === 'us');
  if (usItem) {
    $('us-price').textContent = usItem.price === 0 ? '무료' : (usItem.formattedPrice || fmtUSD(toUSD(usItem.price, usItem.currency)));
    $('app-store-link').href = `https://apps.apple.com/us/app/id${currentAppId}`;
  }

  const paidItems = availableItems
    .map(i => ({ ...i, usd: toUSD(i.price, i.currency) }))
    .filter(i => i.usd !== null && i.usd > 0)
    .sort((a, b) => a.usd - b.usd);

  if (paidItems.length > 0) {
    const cheapest = paidItems[0];
    const priciest = paidItems[paidItems.length - 1];
    const avg = paidItems.reduce((s, i) => s + i.usd, 0) / paidItems.length;

    $('cheapest-price').textContent = fmtUSD(cheapest.usd);
    $('cheapest-country').textContent = `${cheapest.flag} ${cheapest.countryName}`;
    $('expensive-price').textContent = fmtUSD(priciest.usd);
    $('expensive-country').textContent = `${priciest.flag} ${priciest.countryName}`;
    $('avg-price').textContent = fmtUSD(avg);
  } else {
    // All countries have free app
    $('cheapest-price').textContent = '무료';
    $('cheapest-country').textContent = '— 모든 국가 —';
    $('expensive-price').textContent = '무료';
    $('expensive-country').textContent = '— 모든 국가 —';
    $('avg-price').textContent = '무료';
  }

  $('countries-count').textContent = availableItems.length;
}

// ─── Table Rendering ──────────────────────────────────────────────────────────
function renderTable() {
  const tbody = $('price-tbody');

  // Filter
  let rows = priceData.filter(item => {
    const regionOk = currentRegion === 'all' || item.region === currentRegion;
    const q = countrySearchQuery.toLowerCase();
    const searchOk = !q ||
      item.countryName.toLowerCase().includes(q) ||
      item.country.toLowerCase().includes(q);
    return regionOk && searchOk;
  });

  // Attach USD price + diff
  const usItem = priceData.find(i => i.country === 'us' && i.available !== false);
  const usUsd = usItem ? toUSD(usItem.price, usItem.currency) : null;

  rows = rows.map(item => {
    const available = item.available !== false;
    const usd = available ? toUSD(item.price, item.currency) : null;
    const diff = (usUsd !== null && usUsd > 0 && usd !== null && usd > 0)
      ? ((usd - usUsd) / usUsd) * 100
      : null;
    return { ...item, available, usd, diff };
  });

  // Sort
  switch (currentSort) {
    case 'usd-asc':   rows.sort((a, b) => (a.usd ?? Infinity) - (b.usd ?? Infinity)); break;
    case 'usd-desc':  rows.sort((a, b) => (b.usd ?? -Infinity) - (a.usd ?? -Infinity)); break;
    case 'name-asc':  rows.sort((a, b) => a.countryName.localeCompare(b.countryName)); break;
    case 'diff-asc':  rows.sort((a, b) => (a.diff ?? Infinity) - (b.diff ?? Infinity)); break;
    case 'diff-desc': rows.sort((a, b) => (b.diff ?? -Infinity) - (a.diff ?? -Infinity)); break;
  }

  const maxUsd = Math.max(1, ...rows.filter(r => r.available && r.usd > 0).map(r => r.usd));

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-placeholder">조건과 일치하는 국가가 없습니다.</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  rows.forEach((item, idx) => {
    const isUs = item.country === 'us';
    const dc = diffClass(item.diff);
    const barW = item.usd > 0 ? Math.min(100, (item.usd / maxUsd) * 100).toFixed(1) : 0;

    const tr = document.createElement('tr');
    if (isUs) tr.classList.add('us-row');
    if (!item.available) tr.classList.add('unavailable-row');

    tr.innerHTML = `
      <td class="col-rank">${idx + 1}</td>
      <td class="col-country">
        <span class="flag">${item.flag}</span>
        <span class="country-name">${escHtml(item.countryName)}</span>
        <span class="country-code">${item.country.toUpperCase()}</span>
      </td>
      <td class="col-local">${item.available ? fmtLocal(item.price, item.currency, item.formattedPrice) : '<span class="unavailable-label">미지원</span>'}</td>
      <td class="col-usd">${item.available ? (item.price === 0 ? '<span class="free-badge">무료</span>' : escHtml(fmtUSD(item.usd))) : '—'}</td>
      <td class="col-diff">
        ${!item.available
          ? '<span class="diff-badge unavailable">미지원</span>'
          : item.price === 0
          ? ''
          : isUs
            ? '<span class="diff-badge neutral">기준</span>'
            : `<span class="diff-badge ${dc}">${diffLabel(item.diff)}</span>`
        }
      </td>
      <td class="col-bar">
        ${item.available && item.price > 0
          ? `<div class="price-bar-wrapper"><div class="price-bar ${dc}" style="width:${barW}%"></div></div>`
          : ''
        }
      </td>`;
    fragment.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
}

// ─── IAP Loading ──────────────────────────────────────────────────────────────
function iapKey(iap) {
  return iap.trackKey || iap.trackName;
}

function populateIapSelect(referenceIaps) {
  const select = $('iap-select');
  const previousSelection = selectedIapTrackName;

  select.innerHTML = '';
  referenceIaps.forEach((iap) => {
    const opt = document.createElement('option');
    opt.value = iapKey(iap);
    opt.textContent = `${iap.trackName}  —  ${iap.formattedPrice || fmtUSD(toUSD(iap.price, iap.currency))}`;
    select.appendChild(opt);
  });

  selectedIapTrackName = referenceIaps.some((iap) => iapKey(iap) === previousSelection)
    ? previousSelection
    : iapKey(referenceIaps[0]);
  select.value = selectedIapTrackName;
  select.disabled = false;
}

function setIapStatus(message, finished = false) {
  $('iap-loading-text').textContent = message;
  $('iap-loading').classList.toggle('iap-loading-complete', finished);
  $('iap-loading').querySelector('.mini-spinner').classList.toggle('hidden', finished);
}

function loadIapData(appId) {
  show('iap-section');
  $('iap-loading').classList.remove('hidden', 'iap-loading-complete');
  $('iap-loading').querySelector('.mini-spinner').classList.remove('hidden');
  setIapStatus('IAP 가격을 국가별로 확인하는 중…');
  $('iap-select').disabled = true;
  $('iap-select').innerHTML = '<option value="">IAP 목록을 불러오는 중…</option>';
  $('iap-tbody').innerHTML = `<tr><td colspan="5" class="table-placeholder">IAP 가격을 불러오는 중…</td></tr>`;
  iapCompletedCountries = 0;
  selectedIapTrackName = '';

  if (window.location.hostname.includes('github.io') || window.location.protocol === 'file:') {
    return loadIapDataClientSide(appId);
  }

  const es = new EventSource(`/api/iap-stream/${appId}`);
  let receivedIapCountries = 0;

  es.onmessage = (event) => {
    let data;
    try { data = JSON.parse(event.data); }
    catch { return; }

    if (data.type === 'data') {
      iapsByCountry[data.country] = data.iaps || [];
      receivedIapCountries += 1;

      // The server sends the US storefront first. Fall back to the first
      // available storefront only when an app is unavailable in the US.
      const referenceIaps = iapsByCountry.us || Object.values(iapsByCountry)[0] || [];
      if (referenceIaps.length > 0) {
        const selectWasDisabled = $('iap-select').disabled;
        populateIapSelect(referenceIaps);
        if (selectWasDisabled || receivedIapCountries % 4 === 0) renderIapTable();
      }
      return;
    }

    if (data.type === 'progress') {
      iapCompletedCountries = data.completed || iapCompletedCountries;
      setIapStatus(`IAP 가격 확인 중 · ${iapCompletedCountries}/${data.total || TOTAL_COUNTRIES}개 국가`);
      if (selectedIapTrackName && iapCompletedCountries % 4 === 0) renderIapTable();
      return;
    }

    if (data.type === 'done') {
      es.close();
      const availableCountries = Object.keys(iapsByCountry).length;
      if (availableCountries === 0) {
        hide('iap-section');
        return;
      }
      setIapStatus(`IAP 가격 조회 완료 · ${availableCountries}개 국가`, true);
      renderIapTable();
    }
  };

  es.onerror = () => {
    es.close();
    const availableCountries = Object.keys(iapsByCountry).length;
    if (availableCountries === 0) {
      loadIapDataClientSide(appId);
      return;
    }
    setIapStatus(`일부 국가의 IAP 가격을 불러왔습니다 · ${availableCountries}개 국가`, true);
    renderIapTable();
  };
}

// ─── Client-side IAP Loader (GitHub Pages Mode) ──────────────────────────────
async function loadIapDataClientSide(appId) {
  const iapCountries = ['us', 'kr', 'jp', 'gb', 'de', 'fr', 'ca', 'au', 'hu', 'pk', 'es', 'it', 'pl', 'cz', 'cn', 'tw', 'br', 'in'];
  let completed = 0;

  const tasks = iapCountries.map((c) => async () => {
    try {
      const currency = COUNTRY_CURRENCIES[c] || 'USD';
      const targetUrl = `https://apps.apple.com/${c}/app/id${appId}`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
      
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const html = await res.text();
        const pairs = extractIapPairsClient(html);
        if (pairs.length > 0) {
          const seenNames = new Map();
          const iaps = pairs.map(([name, priceStr]) => ({
            trackKey: makeIapKeyClient(name, seenNames),
            trackName: name,
            price: parseLocalizedPriceClient(priceStr, currency),
            currency: currency,
            formattedPrice: priceStr
          })).filter(i => i.price !== null);

          if (iaps.length > 0) {
            iapsByCountry[c] = iaps;
            const refIaps = iapsByCountry['us'] || iapsByCountry[c];
            if (refIaps) populateIapSelect(refIaps);
            renderIapTable();
          }
        }
      }
    } catch { /* skip failed fetch */ } finally {
      completed++;
      setIapStatus(`IAP 가격 확인 중 · ${completed}/${iapCountries.length}개 주요 국가`);
    }
  });

  await limitedParallel(tasks, 4);

  const totalLoaded = Object.keys(iapsByCountry).length;
  if (totalLoaded > 0) {
    setIapStatus(`IAP 가격 조회 완료 · ${totalLoaded}개 주요 국가`, true);
    renderIapTable();
  } else {
    hide('iap-section');
  }
}

function makeIapKeyClient(name, seenNames) {
  const base = name.toLowerCase().replace(/\s+/g, ' ').trim();
  const occ = (seenNames.get(base) || 0) + 1;
  seenNames.set(base, occ);
  return `${base}__${occ}`;
}

function extractIapPairsClient(html) {
  const pairs = [];
  const pairRe = /<div\b[^>]*\btext-pair\b[^>]*>\s*<span\b[^>]*>([\s\S]*?)<\/span>\s*<span\b[^>]*>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = pairRe.exec(html)) !== null) {
    const name = match[1].replace(/<[^>]+>/g, '').trim();
    const price = match[2].replace(/<[^>]+>/g, '').trim();
    if (name && price && /\d/.test(price)) {
      pairs.push([name, price]);
    }
  }
  return pairs;
}

function parseLocalizedPriceClient(formattedPrice, currency) {
  if (!formattedPrice) return null;
  const str = String(formattedPrice).trim();
  const m = str.match(/[\d][\d\s.,'’]*/);
  if (!m) return null;
  let numeric = m[0].replace(/[\s'’]/g, '');

  if (/\.\d{2}$/.test(numeric)) {
    const lastDot = numeric.lastIndexOf('.');
    const whole = numeric.slice(0, lastDot).replace(/[.,]/g, '');
    const dec = numeric.slice(lastDot + 1);
    const parsed = Number(`${whole}.${dec}`);
    if (Number.isFinite(parsed)) return parsed;
  } else if (/,\d{2}$/.test(numeric)) {
    const lastComma = numeric.lastIndexOf(',');
    const whole = numeric.slice(0, lastComma).replace(/[.,]/g, '');
    const dec = numeric.slice(lastComma + 1);
    const parsed = Number(`${whole}.${dec}`);
    if (Number.isFinite(parsed)) return parsed;
  }

  const parsed = Number(numeric.replace(/[.,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

// ─── IAP Table Rendering ──────────────────────────────────────────────────────
function renderIapTable() {
  const tbody = $('iap-tbody');
  if (!selectedIapTrackName) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-placeholder">비교할 IAP 항목을 선택해 주세요.</td></tr>`;
    return;
  }

  const rows = [];
  Object.entries(iapsByCountry).forEach(([countryCode, iaps]) => {
    const iap = iaps.find(i => iapKey(i) === selectedIapTrackName);
    if (!iap) return;
    const countryInfo = priceData.find(i => i.country === countryCode);
    if (!countryInfo) return;
    rows.push({
      country: countryCode,
      countryName: countryInfo.countryName,
      flag: countryInfo.flag,
      price: iap.price,
      currency: iap.currency,
      formattedPrice: iap.formattedPrice,
      usd: toUSD(iap.price, iap.currency),
    });
  });

  rows.sort((a, b) => (a.usd ?? Infinity) - (b.usd ?? Infinity));

  const usRow = rows.find(r => r.country === 'us');
  const usUsd = usRow?.usd ?? null;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-placeholder">선택한 IAP의 가격 정보를 찾지 못했습니다.</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  rows.forEach((item, idx) => {
    const isUs = item.country === 'us';
    const diff = (usUsd > 0 && item.usd > 0) ? ((item.usd - usUsd) / usUsd) * 100 : null;
    const dc = diffClass(diff);

    const tr = document.createElement('tr');
    if (isUs) tr.classList.add('us-row');
    tr.innerHTML = `
      <td class="col-rank">${idx + 1}</td>
      <td class="col-country">
        <span class="flag">${item.flag}</span>
        <span class="country-name">${escHtml(item.countryName)}</span>
        <span class="country-code">${item.country.toUpperCase()}</span>
      </td>
      <td class="col-local">${fmtLocal(item.price, item.currency, item.formattedPrice)}</td>
      <td class="col-usd">${escHtml(fmtUSD(item.usd))}</td>
      <td class="col-diff">
        ${isUs
          ? '<span class="diff-badge neutral">기준</span>'
          : `<span class="diff-badge ${dc}">${diffLabel(diff)}</span>`
        }
      </td>`;
    fragment.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
}

// ─── Main Search (SSE) ────────────────────────────────────────────────────────
async function searchApp(target) {
  const appId = typeof target === 'object' ? target.appId : target;
  const hintCountry = typeof target === 'object' ? target.hintCountry : null;

  currentAppId = appId;
  priceData = [];
  iapsByCountry = {};
  currentAppIsFree = false;

  hide('error-section');
  hide('results-section');
  hide('iap-section');
  show('loading-section');

  $('loaded-count').textContent = '0';
  $('progress-fill').style.width = '0%';
  $('loading-status').textContent = '100개 이상 국가의 App Store 가격을 확인하는 중…';
  $('price-tbody').innerHTML = `<tr><td colspan="6" class="table-placeholder">가격을 불러오는 중…</td></tr>`;
  $('iap-tbody').innerHTML = `<tr><td colspan="5" class="table-placeholder">비교할 IAP 항목을 선택해 주세요.</td></tr>`;

  // Fetch exchange rates in parallel with SSE stream
  await fetchExchangeRates();

  return new Promise((resolve, reject) => {
    // Run client-side JSONP for GitHub Pages / static hosting or if local API fails
    if (window.location.hostname.includes('github.io') || window.location.protocol === 'file:') {
      return searchAppClientSide(appId, hintCountry).then(resolve).catch(reject);
    }

    const streamUrl = `/api/prices-stream/${appId}${hintCountry ? `?hintCountry=${hintCountry}` : ''}`;
    const es = new EventSource(streamUrl);
    let appInfoSet = false;
    let receivedCount = 0;

    es.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); }
      catch { return; }

      // Terminal events
      if (data.type === 'error') {
        es.close();
        hide('loading-section');
        $('error-title').textContent = '앱을 찾을 수 없습니다';
        $('error-msg').textContent = data.message || 'URL 또는 앱 ID를 확인한 뒤 다시 시도해 주세요.';
        show('error-section');
        reject(new Error(data.message));
        return;
      }

      if (data.type === 'done') {
        es.close();
        hide('loading-section');

        if (priceData.length === 0) {
          $('error-title').textContent = '가격 정보를 찾지 못했습니다';
          $('error-msg').textContent = '이 앱은 현재 지원 국가에서 제공되지 않을 수 있습니다.';
          show('error-section');
          reject(new Error('empty'));
          return;
        }

        updateStats();
        renderTable();
        show('results-section');

        loadIapData(appId);

        resolve(priceData);
        return;
      }

      // Country price data
      priceData.push(data);
      receivedCount++;

      // Set app meta on first result
      if (!appInfoSet && data.appName) {
        appInfoSet = true;
        $('app-name').textContent = data.appName;
        $('app-developer').textContent = `개발사 · ${data.developer || '—'}`;
        if (data.artworkUrl) {
          $('app-icon').src = data.artworkUrl.replace('100x100bb', '200x200bb');
        }
        if (data.rating) {
          $('app-rating').textContent = `⭐ ${data.rating.toFixed(1)} (${(data.ratingCount || 0).toLocaleString()})`;
        } else {
          $('app-rating').textContent = '';
        }
        $('app-genre').textContent = data.primaryGenreName || '';
        currentAppIsFree = data.isFree;
      }

      // Progress bar
      const pct = Math.min(99, (receivedCount / TOTAL_COUNTRIES) * 100);
      $('loaded-count').textContent = receivedCount;
      $('progress-fill').style.width = `${pct}%`;

      // Live-update table every 10 countries
      if (receivedCount % 10 === 0) {
        updateStats();
        renderTable();
      }
    };

    es.onerror = () => {
      es.close();
      if (priceData.length > 0) {
        hide('loading-section');
        updateStats();
        renderTable();
        show('results-section');
        loadIapData(appId);
        resolve(priceData);
      } else {
        // Fallback to client-side JSONP lookup for static hosting
        searchAppClientSide(appId, hintCountry).then(resolve).catch(reject);
      }
    };
  });
}

// ─── Client-side Search (GitHub Pages Mode) ──────────────────────────────────
async function searchAppClientSide(targetAppId, hintCountry) {
  const appId = typeof targetAppId === 'object' ? targetAppId.appId : String(targetAppId);
  priceData = [];
  iapsByCountry = {};
  currentAppIsFree = false;

  let appInfoSet = false;
  let receivedCount = 0;

  const tasks = APP_STORE_COUNTRIES.map((country) => async () => {
    try {
      const app = await fetchITunesJSONP(appId, country.code);
      receivedCount++;
      const pct = Math.min(99, (receivedCount / TOTAL_COUNTRIES) * 100);
      $('loaded-count').textContent = receivedCount;
      $('progress-fill').style.width = `${pct}%`;

      if (app) {
        const item = {
          country: country.code,
          countryName: country.name,
          flag: country.flag,
          region: country.region,
          available: true,
          price: app.price,
          currency: app.currency,
          formattedPrice: app.formattedPrice,
          appName: app.trackName,
          artworkUrl: app.artworkUrl100 || '',
          developer: app.artistName,
          rating: app.averageUserRating || null,
          ratingCount: app.userRatingCount || 0,
          primaryGenreName: app.primaryGenreName || '',
          isFree: app.price === 0,
        };
        priceData.push(item);

        if (!appInfoSet) {
          appInfoSet = true;
          $('app-name').textContent = app.trackName;
          $('app-developer').textContent = `개발사 · ${app.artistName || '—'}`;
          if (app.artworkUrl100) $('app-icon').src = app.artworkUrl100.replace('100x100bb', '200x200bb');
          if (app.averageUserRating) $('app-rating').textContent = `⭐ ${app.averageUserRating.toFixed(1)} (${(app.userRatingCount || 0).toLocaleString()})`;
          $('app-genre').textContent = app.primaryGenreName || '';
          currentAppIsFree = app.price === 0;
        }

        if (priceData.length % 5 === 0) {
          updateStats();
          renderTable();
        }
      }
    } catch { /* skip */ }
  });

  await limitedParallel(tasks, 15);

  hide('loading-section');
  if (priceData.length === 0) {
    $('error-title').textContent = '앱을 찾을 수 없습니다';
    $('error-msg').textContent = 'URL 또는 앱 ID를 확인한 뒤 다시 시도해 주세요.';
    show('error-section');
  } else {
    updateStats();
    renderTable();
    show('results-section');
  }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = $('search-input');
  const searchBtn   = $('search-btn');

  async function handleSearch() {
    const raw = searchInput.value.trim();
    if (!raw) {
      searchInput.focus();
      return;
    }
    const parsed = parseAppStoreUrl(raw);
    if (!parsed || !parsed.appId) {
      alert('올바른 App Store URL 또는 앱 ID를 입력해 주세요.\n예시:\n• 6448311069\n• https://apps.apple.com/us/app/chatgpt/id6448311069');
      return;
    }

    searchBtn.disabled = true;
    searchBtn.querySelector('.btn-label').textContent = '조회 중…';

    try {
      await searchApp(parsed);
    } catch (e) {
      // error shown in UI
    } finally {
      searchBtn.disabled = false;
      searchBtn.querySelector('.btn-label').textContent = '조회하기';
    }
  }

  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(); });

  // Example buttons
  document.querySelectorAll('.example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      searchInput.value = btn.dataset.url;
      handleSearch();
    });
  });

  // Retry button
  $('retry-btn').addEventListener('click', () => {
    hide('error-section');
    searchInput.focus();
  });

  // Region tabs
  document.querySelectorAll('.region-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.region-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentRegion = tab.dataset.region;
      renderTable();
    });
  });

  // Sort
  $('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderTable();
  });

  // Country search
  $('country-search').addEventListener('input', (e) => {
    countrySearchQuery = e.target.value;
    renderTable();
  });

  // IAP select
  $('iap-select').addEventListener('change', (e) => {
    selectedIapTrackName = e.target.value;
    renderIapTable();
  });
});
