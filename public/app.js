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
let currentBaseCurrency = 'USD'; // 'USD', 'KRW', 'EUR', 'JPY', 'GBP', 'CAD', 'AUD'
let isPppMode = false;           // Purchasing Power Parity mode toggle
let favoriteApps = [];           // localStorage Watchlist
let currentTierFilter = 'all';  // 'all', 'cheap-30', 'sub-5', 'exp-top'

// IAP Filter state variables
let iapCurrentRegion = 'all';
let iapCountrySearchQuery = '';
let iapCurrentBaseCurrency = 'USD';
let iapCurrentSort = 'usd-asc';

const TOTAL_COUNTRIES = 108;

// Relative PPP Price Level Index (Normalized to US = 1.0)
const PPP_FACTORS = {
  us: 1.00, ca: 0.92, mx: 0.58, br: 0.48, ar: 0.38, cl: 0.62, co: 0.45, pe: 0.50,
  uy: 0.68, bo: 0.42, ec: 0.52, cr: 0.64, gt: 0.51, py: 0.45, do: 0.53, jm: 0.58, tt: 0.68,
  gb: 0.95, de: 0.92, fr: 0.94, it: 0.84, es: 0.78, nl: 0.96, se: 0.98, no: 1.18,
  dk: 1.15, fi: 0.96, pl: 0.58, be: 0.92, at: 0.94, ch: 1.32, pt: 0.68, ie: 0.95,
  cz: 0.65, hu: 0.59, ro: 0.52, gr: 0.70, tr: 0.32, ua: 0.35, ru: 0.45, sk: 0.68,
  bg: 0.48, hr: 0.64, si: 0.75, lt: 0.62, lv: 0.61, ee: 0.72, lu: 1.15, mt: 0.76,
  cy: 0.74, is: 1.25, al: 0.46, rs: 0.48, mk: 0.42, md: 0.38, am: 0.44, ge: 0.45,
  az: 0.42, kz: 0.40,
  jp: 0.78, kr: 0.82, cn: 0.55, au: 0.96, nz: 0.92, sg: 0.95, hk: 0.88, tw: 0.72,
  in: 0.28, th: 0.48, ph: 0.38, my: 0.52, id: 0.36, vn: 0.34, pk: 0.25, lk: 0.30,
  mn: 0.35, np: 0.26, mm: 0.28, kh: 0.32, bn: 0.65, uz: 0.28, kg: 0.26,
  ae: 0.88, sa: 0.72, kw: 0.82, qa: 0.90, bh: 0.78, om: 0.75, jo: 0.58, eg: 0.28,
  il: 1.05, lb: 0.42, iq: 0.35,
  za: 0.46, ng: 0.30, ke: 0.32, gh: 0.35, tz: 0.28, ma: 0.42, ug: 0.25, sn: 0.32,
  dz: 0.32, tn: 0.35, et: 0.24, zm: 0.26, cm: 0.32, ci: 0.35, mz: 0.28
};

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

  // Google Play URL
  const gplayUrl = input.match(/play\.google\.com\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/i);
  if (gplayUrl) return { appId: gplayUrl[1], store: 'google' };

  // Google Play Package ID (e.g. com.openai.chatgpt)
  if (/^[a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+$/.test(input) && !input.includes('/')) {
    return { appId: input, store: 'google' };
  }

  // Plain numeric ID
  if (/^\d{6,12}$/.test(input)) return { appId: input, store: 'apple', hintCountry: null };

  // Various Apple URL patterns with country code
  const patterns = [
    /apps\.apple\.com\/([a-z]{2})\/app\/[^/]*\/id(\d+)/i,
    /apps\.apple\.com\/([a-z]{2})\/app\/id(\d+)/i,
    /itunes\.apple\.com\/([a-z]{2})\/app\/[^/]*\/id(\d+)/i,
    /itunes\.apple\.com\/([a-z]{2})\/app\/id(\d+)/i,
  ];

  for (const re of patterns) {
    const m = input.match(re);
    if (m) return { appId: m[2], store: 'apple', hintCountry: m[1].toLowerCase() };
  }

  // Fallback for URLs without country code (e.g. /id123456)
  const idMatch = input.match(/\/id(\d{6,12})/);
  if (idMatch) return { appId: idMatch[1], store: 'apple', hintCountry: null };

  return null;
}

const COUNTRY_TAX_NOTES = {
  ar: '🇦🇷 아르헨티나: 해외 카드 결제 시 60% 카드세(PAIS) 및 환율 변동 주의가 필요합니다.',
  tr: '🇹🇷 튀르키예: 최근 애플/구글 티어 인상 및 환율 변동성이 높은 지역입니다.',
  eg: '🇪🇬 이집트: 해외 결제 카드 한도 제한 및 추가 수수료가 적용될 수 있습니다.',
  ng: '🇳🇬 나이지리아: 현지 카드 한도 제한으로 해외 결제가 제한될 수 있습니다.',
  br: '🇧🇷 브라질: 해외 카드 이용 시 IOF(해외사용 금융거래세 4.38%)가 부과됩니다.',
  in: '🇮🇳 인도: RBI 규정으로 카드 자동 갱신 결제 시 추가 인증(OTP/AFA)이 필요합니다.'
};

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

// Convert local-currency price to selected Base Currency (with optional PPP adjustment)
function toBaseVal(price, currency, countryCode = 'us', baseCurrencyOverride) {
  if (price === 0) return 0;
  if (!price || !currency) return null;
  let usd = (currency === 'USD') ? price : (exchangeRates[currency] ? price / exchangeRates[currency] : null);
  if (usd === null) return null;

  if (isPppMode && countryCode && PPP_FACTORS[countryCode.toLowerCase()]) {
    const factor = PPP_FACTORS[countryCode.toLowerCase()];
    usd = usd / factor;
  }

  const baseCurr = baseCurrencyOverride || currentBaseCurrency;
  if (baseCurr === 'USD') return usd;
  const targetRate = exchangeRates[baseCurr];
  if (!targetRate) return usd;
  return usd * targetRate;
}

function fmtBaseVal(val, currOverride) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  if (val === 0) return '무료';
  const curr = currOverride || currentBaseCurrency;
  const symbols = {
    USD: '$', KRW: '₩', EUR: '€', JPY: '¥', GBP: '£', CAD: 'CA$', AUD: 'AU$'
  };
  const sym = symbols[curr] || `${curr} `;
  if (curr === 'KRW' || curr === 'JPY') {
    return `${sym}${Math.round(val).toLocaleString()}`;
  }
  return `${sym}${val.toFixed(2)}`;
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
  const descEl = $('app-description');
  if (descEl) {
    descEl.textContent = bestItem.description || '';
    descEl.style.display = bestItem.description ? '' : 'none';
  }

  // Add to recent searches
  const currentStore = document.getElementById('tab-google')?.classList.contains('active') ? 'google' : 'apple';
  addRecentSearch(currentAppId, currentStore, bestItem.appName);
}

// ─── Deduplication Helper ───────────────────────────────────────────────────
function getUniqueCountries(dataArr) {
  const map = new Map();
  dataArr.forEach(item => {
    if (item.country && !map.has(item.country)) {
      map.set(item.country, item);
    }
  });
  return Array.from(map.values());
}

// ─── Stats Update ─────────────────────────────────────────────────────────────
function updateStats() {
  updateAppHeaderMeta();
  updateFavBtn();

  const availableItems = getUniqueCountries(priceData).filter((item) => item.available !== false);
  const usItem = availableItems.find(i => i.country === 'us');
  if (usItem) {
    const usVal = toBaseVal(usItem.price, usItem.currency, 'us');
    $('us-price').textContent = usItem.price === 0 ? '무료' : (usItem.formattedPrice || fmtBaseVal(usVal));
    $('app-store-link').href = `https://apps.apple.com/us/app/id${currentAppId}`;
  }

  const paidItems = availableItems
    .map(i => ({ ...i, val: toBaseVal(i.price, i.currency, i.country) }))
    .filter(i => i.val !== null && i.val > 0)
    .sort((a, b) => a.val - b.val);

  if (paidItems.length > 0) {
    const cheapest = paidItems[0];
    const priciest = paidItems[paidItems.length - 1];
    const avg = paidItems.reduce((s, i) => s + i.val, 0) / paidItems.length;

    $('cheapest-price').textContent = fmtBaseVal(cheapest.val);
    $('cheapest-country').textContent = `${cheapest.flag} ${cheapest.countryName}`;
    $('expensive-price').textContent = fmtBaseVal(priciest.val);
    $('expensive-country').textContent = `${priciest.flag} ${priciest.countryName}`;
    $('avg-price').textContent = fmtBaseVal(avg);
  } else {
    // All countries have free app
    $('cheapest-price').textContent = '무료';
    $('cheapest-country').textContent = '— 모든 국가 —';
    $('expensive-price').textContent = '무료';
    $('expensive-country').textContent = '— 모든 국가 —';
    $('avg-price').textContent = '무료';
  }

  $('countries-count').textContent = availableItems.length;

  renderChart();
  renderInsights();
}

// ─── Region Heatmap Update ───────────────────────────────────────────────────
function renderRegionHeatmap() {
  const regions = [
    { key: 'Americas', priceId: 'region-price-americas', subId: 'region-sub-americas' },
    { key: 'Europe', priceId: 'region-price-europe', subId: 'region-sub-europe' },
    { key: 'Asia Pacific', priceId: 'region-price-asia', subId: 'region-sub-asia' },
    { key: 'Middle East', priceId: 'region-price-me', subId: 'region-sub-me' },
    { key: 'Africa', priceId: 'region-price-africa', subId: 'region-sub-africa' },
  ];

  regions.forEach(r => {
    const items = priceData
      .filter(i => i.region === r.key && i.available !== false)
      .map(i => ({ ...i, val: toBaseVal(i.price, i.currency, i.country) }))
      .filter(i => i.val !== null);

    const priceEl = $(r.priceId);
    const subEl = $(r.subId);
    if (!priceEl || !subEl) return;

    if (items.length === 0) {
      priceEl.textContent = '—';
      subEl.textContent = '데이터 없음';
      return;
    }

    const paid = items.filter(i => i.val > 0).sort((a, b) => a.val - b.val);
    if (paid.length > 0) {
      const avg = paid.reduce((s, i) => s + i.val, 0) / paid.length;
      const cheapest = paid[0];
      priceEl.textContent = fmtBaseVal(avg);
      subEl.textContent = `최저가: ${cheapest.flag} ${fmtBaseVal(cheapest.val)}`;
    } else {
      priceEl.textContent = '무료';
      subEl.textContent = '모든 국가 무료';
    }
  });
}

// ─── Insights Update ─────────────────────────────────────────────────────────
function renderInsights() {
  const insightSection = $('insight-section');
  if (!insightSection) return;

  const availableItems = priceData
    .filter(i => i.available !== false)
    .map(i => ({ ...i, val: toBaseVal(i.price, i.currency, i.country) }))
    .filter(i => i.val !== null);

  if (availableItems.length === 0) {
    hide('insight-section');
    return;
  }

  show('insight-section');

  const paidItems = availableItems.filter(i => i.val > 0).sort((a, b) => a.val - b.val);
  const usItem = availableItems.find(i => i.country === 'us');
  const usVal = usItem ? usItem.val : (paidItems.length > 0 ? paidItems[0].val : 0);

  if (paidItems.length > 0) {
    show('insight-best-deal');
    show('insight-savings');
    show('insight-sweet-spot');

    const cheapest = paidItems[0];
    const priciest = paidItems[paidItems.length - 1];

    // Best deal country
    const diffPct = usVal > 0 ? (((cheapest.val - usVal) / usVal) * 100).toFixed(1) : 0;
    $('insight-best-country').textContent = `${cheapest.flag} ${cheapest.countryName}`;
    $('insight-best-saving').textContent = `${fmtBaseVal(cheapest.val)} (${diffPct > 0 ? '+' : ''}${diffPct}%)`;

    // Max savings vs US
    const savedVal = Math.max(0, usVal - cheapest.val);
    $('insight-max-saving').textContent = fmtBaseVal(savedVal);
    $('insight-saving-countries').textContent = `미국(${fmtBaseVal(usVal)}) 대비 최저가 선택 시 절약`;

    // Pricing strategy
    const variance = priciest.val / (cheapest.val || 1);
    if (variance > 2.5) {
      $('insight-stable-countries').textContent = '동적 지역 가격 정책';
      $('insight-stable-detail').textContent = `최저/최고가 격차 약 ${variance.toFixed(1)}배 (지역별 차등 적용)`;
    } else {
      $('insight-stable-countries').textContent = '글로벌 표준 가격 정책';
      $('insight-stable-detail').textContent = `전 세계 국가 간 가격 차이가 약 ${((variance - 1) * 100).toFixed(0)}% 이내로 고정`;
    }

    // Free count
    const freeCount = availableItems.filter(i => i.price === 0).length;
    $('insight-free-count').textContent = `${freeCount}개 국가`;
    $('insight-free-detail').textContent = freeCount > 0 ? '일부 국가에서 앱이 무료로 제공됨' : '전 세계 모든 지원 국가에서 유료 판매';

  } else {
    // All free
    hide('insight-best-deal');
    hide('insight-savings');
    hide('insight-sweet-spot');

    $('insight-free-count').textContent = `${availableItems.length}개 국가`;
    $('insight-free-detail').textContent = '모든 지원 국가에서 무료로 제공 중';
  }
}

// ─── Table Rendering ──────────────────────────────────────────────────────────
function renderTable() {
  const tbody = $('price-tbody');

  // Dynamic headers
  const thBase = $('th-base-currency');
  if (thBase) {
    thBase.textContent = isPppMode ? `PPP (${currentBaseCurrency})` : currentBaseCurrency;
  }

  // Filter
  const uniqueData = getUniqueCountries(priceData);
  let rows = uniqueData.filter(item => {
    const regionOk = currentRegion === 'all' || item.region === currentRegion;
    const q = countrySearchQuery.toLowerCase();
    const searchOk = !q ||
      item.countryName.toLowerCase().includes(q) ||
      item.country.toLowerCase().includes(q);
    return regionOk && searchOk;
  });

  // Attach base currency / PPP price + diff
  const usItem = uniqueData.find(i => i.country === 'us' && i.available !== false);
  const usVal = usItem ? toBaseVal(usItem.price, usItem.currency, 'us') : null;

  rows = rows.map(item => {
    const available = item.available !== false;
    const val = available ? toBaseVal(item.price, item.currency, item.country) : null;
    const diff = (usVal !== null && usVal > 0 && val !== null && val > 0)
      ? ((val - usVal) / usVal) * 100
      : null;
    return { ...item, available, val, diff };
  });

  // Tier Filter
  rows = rows.filter(r => {
    if (currentTierFilter === 'cheap-30') return r.diff !== null && r.diff <= -30;
    if (currentTierFilter === 'sub-5') return r.val !== null && r.val <= 5;
    if (currentTierFilter === 'exp-top') return r.diff !== null && r.diff >= 20;
    return true;
  });

  // Sort
  switch (currentSort) {
    case 'usd-asc':   rows.sort((a, b) => (a.val ?? Infinity) - (b.val ?? Infinity)); break;
    case 'usd-desc':  rows.sort((a, b) => (b.val ?? -Infinity) - (a.val ?? -Infinity)); break;
    case 'name-asc':  rows.sort((a, b) => a.countryName.localeCompare(b.countryName)); break;
    case 'diff-asc':  rows.sort((a, b) => (a.diff ?? Infinity) - (b.diff ?? Infinity)); break;
    case 'diff-desc': rows.sort((a, b) => (b.diff ?? -Infinity) - (a.diff ?? -Infinity)); break;
  }

  const maxVal = Math.max(1, ...rows.filter(r => r.available && r.val > 0).map(r => r.val));

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-placeholder">조건과 일치하는 국가가 없습니다.</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  rows.forEach((item, idx) => {
    const isUs = item.country === 'us';
    const dc = diffClass(item.diff);
    const taxNote = COUNTRY_TAX_NOTES[item.country.toLowerCase()];
    const noteHtml = taxNote ? `<span class="country-note-icon" title="${escHtml(taxNote)}">💡</span>` : '';

    const tr = document.createElement('tr');
    if (isUs) tr.classList.add('us-row');
    if (!item.available) tr.classList.add('unavailable-row');

    tr.innerHTML = `
      <td class="col-rank">${idx + 1}</td>
      <td class="col-country">
        <span class="flag">${item.flag}</span>
        <span class="country-name">${escHtml(item.countryName)}</span>
        <span class="country-code">${item.country.toUpperCase()}</span>
        ${noteHtml}
      </td>
      <td class="col-local">${item.available ? fmtLocal(item.price, item.currency, item.formattedPrice) : '<span class="unavailable-label">미지원</span>'}</td>
      <td class="col-usd">${item.available ? (item.price === 0 ? '<span class="free-badge">무료</span>' : escHtml(fmtBaseVal(item.val))) : '—'}</td>
      <td class="col-diff">
        ${!item.available
          ? '<span class="diff-badge unavailable">미지원</span>'
          : item.price === 0
          ? ''
          : isUs
            ? '<span class="diff-badge neutral">기준</span>'
            : `<span class="diff-badge ${dc}">${diffLabel(item.diff)}</span>`
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
    show('iap-section');
    $('iap-select').disabled = true;
    $('iap-select').innerHTML = '<option value="">Node.js 서버 전용 기능</option>';
    $('iap-tbody').innerHTML = `<tr><td colspan="5" class="table-placeholder" style="color:var(--text-muted); padding: 2rem 1rem;">💡 GitHub Pages(정적 웹 페이지) 환경에서는 Apple 보안 정책(CORS)으로 인해 웹 크롤링이 제한됩니다.<br>로컬 Node.js 서버(<code>npm start</code>)를 실행하시면 108개국의 IAP/구독 가격을 실시간으로 비교하실 수 있습니다.</td></tr>`;
    setIapStatus('💡 GitHub Pages 안내: 앱 기본 가격 조회가 지원되며, IAP 세부 비교는 Node.js 서버에서 제공됩니다.', true);
    return;
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
        show('iap-section');
        setIapStatus('💡 이 앱은 별도의 인앱결제(구독 또는 아이템) 항목이 없습니다.', true);
        $('iap-select').disabled = true;
        $('iap-select').innerHTML = '<option value="">인앱결제 항목 없음</option>';
        $('iap-tbody').innerHTML = `<tr><td colspan="5" class="table-placeholder" style="color:var(--text-muted); padding: 2rem 1rem;">💡 해당 앱은 별도의 인앱결제(IAP) 상품이 없거나 등록되어 있지 않습니다.</td></tr>`;
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
    show('iap-section');
    setIapStatus('💡 이 앱은 별도의 인앱결제(구독 또는 아이템) 항목이 없습니다.', true);
    $('iap-select').disabled = true;
    $('iap-select').innerHTML = '<option value="">인앱결제 항목 없음</option>';
    $('iap-tbody').innerHTML = `<tr><td colspan="5" class="table-placeholder" style="color:var(--text-muted); padding: 2rem 1rem;">💡 해당 앱은 별도의 인앱결제(IAP) 상품이 없거나 등록되어 있지 않습니다.</td></tr>`;
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
  if (!tbody) return;

  if (!selectedIapTrackName) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-placeholder">비교할 IAP 항목을 선택해 주세요.</td></tr>`;
    return;
  }

  // Update dynamic base currency header in IAP table
  const thBase = $('iap-table')?.querySelector('th.col-usd');
  if (thBase) {
    thBase.textContent = iapCurrentBaseCurrency;
  }

  let rows = [];
  Object.entries(iapsByCountry).forEach(([countryCode, iaps]) => {
    const iap = iaps.find(i => iapKey(i) === selectedIapTrackName);
    if (!iap) return;
    const countryInfo = priceData.find(i => i.country === countryCode);
    if (!countryInfo) return;

    // Filter by Region
    if (iapCurrentRegion !== 'all' && countryInfo.region !== iapCurrentRegion) return;

    // Filter by Search Query
    const q = iapCountrySearchQuery.toLowerCase();
    if (q) {
      const matchName = countryInfo.countryName.toLowerCase().includes(q);
      const matchCode = countryInfo.country.toLowerCase().includes(q);
      if (!matchName && !matchCode) return;
    }

    const val = toBaseVal(iap.price, iap.currency, countryCode, iapCurrentBaseCurrency);
    rows.push({
      country: countryCode,
      countryName: countryInfo.countryName,
      flag: countryInfo.flag,
      price: iap.price,
      currency: iap.currency,
      formattedPrice: iap.formattedPrice,
      val: val,
    });
  });

  const usRow = rows.find(r => r.country === 'us');
  const usVal = usRow?.val ?? null;

  rows = rows.map(r => {
    const diff = (usVal !== null && usVal > 0 && r.val !== null && r.val > 0)
      ? ((r.val - usVal) / usVal) * 100
      : null;
    return { ...r, diff };
  });

  // Sort
  switch (iapCurrentSort) {
    case 'usd-asc':   rows.sort((a, b) => (a.val ?? Infinity) - (b.val ?? Infinity)); break;
    case 'usd-desc':  rows.sort((a, b) => (b.val ?? -Infinity) - (a.val ?? -Infinity)); break;
    case 'name-asc':  rows.sort((a, b) => a.countryName.localeCompare(b.countryName)); break;
    case 'diff-asc':  rows.sort((a, b) => (a.diff ?? Infinity) - (b.diff ?? Infinity)); break;
    case 'diff-desc': rows.sort((a, b) => (b.diff ?? -Infinity) - (a.diff ?? -Infinity)); break;
  }

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-placeholder">조건과 일치하는 IAP 가격 정보가 없습니다.</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  rows.forEach((item, idx) => {
    const isUs = item.country === 'us';
    const dc = diffClass(item.diff);
    const taxNote = COUNTRY_TAX_NOTES[item.country.toLowerCase()];
    const noteHtml = taxNote ? `<span class="country-note-icon" title="${escHtml(taxNote)}">💡</span>` : '';

    const tr = document.createElement('tr');
    if (isUs) tr.classList.add('us-row');
    tr.innerHTML = `
      <td class="col-rank">${idx + 1}</td>
      <td class="col-country">
        <span class="flag">${item.flag}</span>
        <span class="country-name">${escHtml(item.countryName)}</span>
        <span class="country-code">${item.country.toUpperCase()}</span>
        ${noteHtml}
      </td>
      <td class="col-local">${fmtLocal(item.price, item.currency, item.formattedPrice)}</td>
      <td class="col-usd">${escHtml(fmtBaseVal(item.val, iapCurrentBaseCurrency))}</td>
      <td class="col-diff">
        ${isUs
          ? '<span class="diff-badge neutral">기준</span>'
          : `<span class="diff-badge ${dc}">${diffLabel(item.diff)}</span>`
        }
      </td>`;
    fragment.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
}

function copyIapTableToClipboard() {
  const table = $('iap-table');
  if (!table) return;
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  if (rows.length === 0 || rows[0].querySelector('.table-placeholder')) {
    showToast('복사할 IAP 데이터가 없습니다.');
    return;
  }
  let text = `순위\t국가\t현지 가격\t${iapCurrentBaseCurrency}\t미국 대비\n`;
  rows.forEach(r => {
    const cols = Array.from(r.querySelectorAll('td')).map(c => c.textContent.trim().replace(/\s+/g, ' '));
    if (cols.length >= 5) text += cols.join('\t') + '\n';
  });
  navigator.clipboard.writeText(text).then(() => {
    showToast('IAP 가격표가 클립보드에 복사되었습니다!');
  }).catch(() => {
    showToast('클립보드 복사에 실패했습니다.');
  });
}

// ─── Resilient SSE Wrapper ────────────────────────────────────────────────────
function createResilientSSE(url, { maxRetries = 2, retryDelay = 2000 } = {}) {
  let retryCount = 0;
  let es = null;
  const listeners = { onmessage: null, onerror: null, ondone: null };

  function connect() {
    es = new EventSource(url);

    es.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }

      if (data.type === 'done') {
        retryCount = 0;
        if (listeners.ondone) listeners.ondone(data);
        return;
      }
      if (data.type === 'error') {
        if (listeners.onmessage) listeners.onmessage(event);
        return;
      }
      retryCount = 0;
      if (listeners.onmessage) listeners.onmessage(event);
    };

    es.onerror = () => {
      es.close();
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(connect, retryDelay);
      } else {
        if (listeners.onerror) listeners.onerror();
      }
    };
  }

  return {
    onmessage: (fn) => { listeners.onmessage = fn; },
    onerror: (fn) => { listeners.onerror = fn; },
    ondone: (fn) => { listeners.ondone = fn; },
    start: () => connect(),
    close: () => { if (es) es.close(); retryCount = maxRetries; }
  };
}

// ─── Main Search (SSE) ────────────────────────────────────────────────────────
async function searchApp(target) {
  const store = typeof target === 'object' ? (target.store || 'apple') : 'apple';
  const appId = typeof target === 'object' ? target.appId : target;
  const hintCountry = typeof target === 'object' ? target.hintCountry : null;

  currentAppId = appId;
  priceData = [];
  iapsByCountry = {};
  currentAppIsFree = false;
  countrySearchQuery = '';
  currentRegion = 'all';
  currentTierFilter = 'all';

  const countrySearchInput = $('country-search');
  if (countrySearchInput) countrySearchInput.value = '';
  document.querySelectorAll('.region-tab').forEach(t => t.classList.toggle('active', t.dataset.region === 'all'));
  document.querySelectorAll('.tier-chip').forEach(c => c.classList.toggle('active', c.dataset.tier === 'all'));

  hide('error-section');
  hide('results-section');
  hide('iap-section');
  const oldNotice = document.querySelector('.gplay-notice');
  if (oldNotice) oldNotice.remove();
  show('loading-section');

  $('loaded-count').textContent = '0';
  $('progress-fill').style.width = '0%';
  $('loading-status').textContent = '100개 이상 국가의 가격을 확인하는 중…';
  $('price-tbody').innerHTML = `<tr><td colspan="5" class="table-placeholder">가격을 불러오는 중…</td></tr>`;
  $('iap-tbody').innerHTML = `<tr><td colspan="5" class="table-placeholder">비교할 IAP 항목을 선택해 주세요.</td></tr>`;

  // Fetch exchange rates in parallel with SSE stream
  await fetchExchangeRates();

  if (store === 'google') {
    return searchGooglePlay(appId);
  }

  // Start IAP data load in parallel
  loadIapData(appId);

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

        // Save to price history
        const cheapest2 = priceData.filter(i => i.available !== false && i.price > 0).sort((a, b) => (toBaseVal(a.price, a.currency, a.country) || Infinity) - (toBaseVal(b.price, b.currency, b.country) || Infinity))[0];
        const avgPaid2 = priceData.filter(i => i.available !== false && i.price > 0);
        const avgPrice2 = avgPaid2.length > 0 ? avgPaid2.reduce((s, i) => s + (toBaseVal(i.price, i.currency, i.country) || 0), 0) / avgPaid2.length : 0;
        const bestItem2 = priceData.find(i => i.appName);
        savePriceHistoryEntry(appId, 'apple', bestItem2?.appName, bestItem2?.artworkUrl, cheapest2 ? toBaseVal(cheapest2.price, cheapest2.currency, cheapest2.country) : 0, cheapest2?.countryName, avgPrice2, cheapest2?.currency);
        resolve(priceData);
        return;
      }

      // Country price data
      priceData.push(data);
      receivedCount++;

      updateAppHeaderMeta();

      // Progress bar
      const pct = Math.min(99, (receivedCount / TOTAL_COUNTRIES) * 100);
      $('loaded-count').textContent = receivedCount;
      $('progress-fill').style.width = `${pct}%`;

      // Live-update UI: show results section immediately on 1st country
      if (receivedCount === 1) {
        hide('loading-section');
        show('results-section');
        updateStats();
        renderTable();
      } else if (receivedCount % 5 === 0) {
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

// ─── Google Play Search (SSE) ────────────────────────────────────────────────
async function searchGooglePlay(packageId) {
  currentAppId = packageId;
  priceData = [];
  iapsByCountry = {};
  currentAppIsFree = false;

  hide('error-section');
  hide('results-section');
  hide('iap-section');
  const oldNotice = document.querySelector('.gplay-notice');
  if (oldNotice) oldNotice.remove();
  show('loading-section');

  $('loaded-count').textContent = '0';
  $('progress-fill').style.width = '0%';
  $('loading-status').textContent = 'Google Play 100개 이상 국가의 가격을 확인하는 중…';
  $('price-tbody').innerHTML = `<tr><td colspan="5" class="table-placeholder">가격을 불러오는 중…</td></tr>`;
  $('iap-tbody').innerHTML = `<tr><td colspan="5" class="table-placeholder">비교할 IAP 항목을 선택해 주세요.</td></tr>`;

  await fetchExchangeRates();

  return new Promise((resolve, reject) => {
    const streamUrl = `/api/google-prices-stream/${packageId}`;
    const es = new EventSource(streamUrl);
    let receivedCount = 0;

    es.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }

      if (data.type === 'notice') {
        const notice = document.createElement('div');
        notice.className = 'gplay-notice';
        notice.innerHTML = `<span>ℹ️</span> ${escHtml(data.message)}`;
        const loadingCard = document.querySelector('.loading-card');
        if (loadingCard) loadingCard.insertAdjacentElement('beforebegin', notice);
        return;
      }

      if (data.type === 'error') {
        es.close();
        hide('loading-section');
        $('error-title').textContent = '앱을 찾을 수 없습니다';
        $('error-msg').textContent = data.message || 'Google Play Package ID를 확인한 뒤 다시 시도해 주세요.';
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

        const totalLoadedIap = Object.keys(iapsByCountry).length;
        if (totalLoadedIap > 0) {
          show('iap-section');
          const refIaps = iapsByCountry.us || Object.values(iapsByCountry)[0] || [];
          if (refIaps.length > 0) populateIapSelect(refIaps);
          setIapStatus(`Google Play IAP 가격 조회 완료 · ${totalLoadedIap}개 국가`, true);
          renderIapTable();
        } else {
          show('iap-section');
          setIapStatus('💡 이 앱은 별도의 인앱결제(구독 또는 아이템) 항목이 등록되어 있지 않습니다.', true);
          $('iap-select').disabled = true;
          $('iap-select').innerHTML = '<option value="">인앱결제 항목 없음</option>';
          $('iap-tbody').innerHTML = `<tr><td colspan="5" class="table-placeholder" style="color:var(--text-muted); padding: 2rem 1rem;">💡 해당 앱은 별도의 인앱결제(IAP) 상품이 없거나 등록되어 있지 않습니다.</td></tr>`;
        }

        // Save to price history
        const gcheapest = priceData.filter(i => i.available !== false && i.price > 0).sort((a, b) => (toBaseVal(a.price, a.currency, a.country) || Infinity) - (toBaseVal(b.price, b.currency, b.country) || Infinity))[0];
        const gavgPaid = priceData.filter(i => i.available !== false && i.price > 0);
        const gavgPrice = gavgPaid.length > 0 ? gavgPaid.reduce((s, i) => s + (toBaseVal(i.price, i.currency, i.country) || 0), 0) / gavgPaid.length : 0;
        const gbest = priceData.find(i => i.appName);
        savePriceHistoryEntry(packageId, 'google', gbest?.appName, gbest?.artworkUrl, gcheapest ? toBaseVal(gcheapest.price, gcheapest.currency, gcheapest.country) : 0, gcheapest?.countryName, gavgPrice, gcheapest?.currency);
        renderPriceHistoryBadge();

        resolve(priceData);
        return;
      }

      priceData.push(data);
      if (data.iaps && data.iaps.length > 0) {
        iapsByCountry[data.country] = data.iaps;
        const refIaps = iapsByCountry.us || Object.values(iapsByCountry)[0];
        if (refIaps) {
          populateIapSelect(refIaps);
          show('iap-section');
        }
      }
      receivedCount++;

      updateAppHeaderMeta();

      const pct = Math.min(99, (receivedCount / TOTAL_COUNTRIES) * 100);
      $('loaded-count').textContent = receivedCount;
      $('progress-fill').style.width = `${pct}%`;

      if (receivedCount % 10 === 0) {
        updateStats();
        renderTable();
        if (Object.keys(iapsByCountry).length > 0) renderIapTable();
      }
    };

    es.onerror = () => {
      es.close();
      if (priceData.length > 0) {
        hide('loading-section');
        updateStats();
        renderTable();
        show('results-section');

        const totalLoadedIap = Object.keys(iapsByCountry).length;
        if (totalLoadedIap > 0) {
          show('iap-section');
          const refIaps = iapsByCountry.us || Object.values(iapsByCountry)[0] || [];
          if (refIaps.length > 0) populateIapSelect(refIaps);
          setIapStatus(`Google Play IAP 가격 조회 완료 · ${totalLoadedIap}개 국가`, true);
          renderIapTable();
        }

        resolve(priceData);
      } else {
        hide('loading-section');
        $('error-title').textContent = '연결 오류';
        $('error-msg').textContent = 'Google Play 가격 데이터를 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.';
        show('error-section');
        reject(new Error('Connection failed'));
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
        description: (app.description || '').substring(0, 200),
          isFree: app.price === 0,
        };
        priceData.push(item);

        updateAppHeaderMeta();

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
    loadIapData(appId);
  }
}

// ─── Toast Notifications ──────────────────────────────────────────────────────
function showToast(message) {
  const container = $('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast-info';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-visible'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ─── Recent Searches System ──────────────────────────────────────────────────
let recentSearches = [];

function loadRecentSearches() {
  try {
    const raw = localStorage.getItem('app_price_recent');
    recentSearches = raw ? JSON.parse(raw) : [];
  } catch {
    recentSearches = [];
  }
  renderRecentSearches();
}

function saveRecentSearches() {
  try {
    localStorage.setItem('app_price_recent', JSON.stringify(recentSearches));
  } catch { /* skip */ }
}

function addRecentSearch(appId, store, appName) {
  if (!appId || !appName) return;
  recentSearches = recentSearches.filter(i => i.appId !== appId);
  recentSearches.unshift({ appId, store: store || 'apple', appName });
  if (recentSearches.length > 8) recentSearches.pop();
  saveRecentSearches();
  renderRecentSearches();
}

function clearRecentSearches() {
  recentSearches = [];
  saveRecentSearches();
  renderRecentSearches();
}

function renderRecentSearches() {
  const container = $('recent-list');
  const recentBox = $('recent-searches');
  if (!container) return;

  if (recentSearches.length === 0) {
    if (recentBox) hide('recent-searches');
    container.innerHTML = '';
    return;
  }

  if (recentBox) show('recent-searches');
  const fragment = document.createDocumentFragment();

  recentSearches.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'recent-item-btn';
    const storeIcon = item.store === 'google' ? '🤖' : '🍎';
    btn.innerHTML = `${storeIcon} ${escHtml(item.appName)}`;
    btn.addEventListener('click', () => {
      searchApp({ appId: item.appId, store: item.store });
    });
    fragment.appendChild(btn);
  });

  container.innerHTML = '';
  container.appendChild(fragment);
}

// ─── Watchlist / Favorites ───────────────────────────────────────────────────
function loadFavorites() {
  try {
    const raw = localStorage.getItem('app_price_check_favorites');
    favoriteApps = raw ? JSON.parse(raw) : [];
  } catch {
    favoriteApps = [];
  }
  updateFavBadge();
}

function saveFavorites() {
  try {
    localStorage.setItem('app_price_check_favorites', JSON.stringify(favoriteApps));
  } catch (e) {
    console.warn('Failed to save favorites:', e);
  }
  updateFavBadge();
  updateFavBtn();
}

function updateFavBadge() {
  const badge = $('fav-count-badge');
  if (!badge) return;
  badge.textContent = favoriteApps.length;
  if (favoriteApps.length > 0) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function isAppFavorited(appId) {
  return favoriteApps.some(item => item.id === appId);
}

function toggleFavoriteApp() {
  if (!currentAppId) return;
  const bestItem = priceData.find(i => i.appName);
  const appName = bestItem ? bestItem.appName : currentAppId;
  const icon = bestItem ? bestItem.artworkUrl : '';
  const store = bestItem ? (bestItem.store || 'apple') : 'apple';

  if (isAppFavorited(currentAppId)) {
    favoriteApps = favoriteApps.filter(item => item.id !== currentAppId);
    showToast('보관함에서 삭제되었습니다.');
  } else {
    favoriteApps.unshift({
      id: currentAppId,
      name: appName,
      icon,
      store,
      date: new Date().toISOString()
    });
    showToast('⭐ 보관함에 저장되었습니다.');
  }
  saveFavorites();
}

function updateFavBtn() {
  const btn = $('fav-btn');
  const icon = $('fav-btn-icon');
  const text = $('fav-btn-text');
  if (!btn || !icon || !text) return;

  if (isAppFavorited(currentAppId)) {
    btn.classList.add('active');
    icon.textContent = '★';
    text.textContent = '보관함 저장됨';
  } else {
    btn.classList.remove('active');
    icon.textContent = '☆';
    text.textContent = '즐겨찾기';
  }
}

function renderWatchlistModal() {
  const empty = $('watchlist-empty');
  const itemsContainer = $('watchlist-items');
  if (!empty || !itemsContainer) return;

  if (favoriteApps.length === 0) {
    empty.classList.remove('hidden');
    itemsContainer.innerHTML = '';
    return;
  }

  empty.classList.add('hidden');
  itemsContainer.innerHTML = favoriteApps.map(app => `
    <div class="watchlist-item">
      <div class="watchlist-item-left">
        <img class="watchlist-item-icon" src="${escHtml(app.icon)}" onerror="this.src='data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' rx=\'20\' fill=\'%231a1a38\'/><text y=\'55\' x=\'50\' font-size=\'40\' text-anchor=\'middle\'>📱</text></svg>'">
        <div class="watchlist-item-info">
          <p class="watchlist-item-title">${escHtml(app.name)}</p>
          <span class="watchlist-item-badge ${app.store === 'google' ? 'google' : 'apple'}">${app.store === 'google' ? '🤖 Google Play' : '🍎 App Store'}</span>
        </div>
      </div>
      <div class="watchlist-item-right">
        <button class="watchlist-load-btn" data-id="${escHtml(app.id)}" data-store="${escHtml(app.store)}">조회</button>
        <button class="watchlist-remove-btn" data-id="${escHtml(app.id)}" title="삭제">✕</button>
      </div>
    </div>
  `).join('');

  itemsContainer.querySelectorAll('.watchlist-load-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      hide('watchlist-modal');
      const id = btn.dataset.id;
      const store = btn.dataset.store;
      searchApp({ appId: id, store });
    });
  });

  itemsContainer.querySelectorAll('.watchlist-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      favoriteApps = favoriteApps.filter(a => a.id !== id);
      saveFavorites();
      renderWatchlistModal();
    });
  });
}

// ─── Price Distribution Chart ────────────────────────────────────────────────
// ─── Chart State (for hover interaction) ─────────────────────────────────────
let chartPadding = { top: 15, right: 20, bottom: 20, left: 45 };

function renderChart() {
  const availableItems = priceData
    .filter(i => i.available !== false)
    .map(i => ({ ...i, val: toBaseVal(i.price, i.currency, i.country) }))
    .filter(i => i.val !== null && i.val > 0)
    .sort((a, b) => a.val - b.val);

  if (availableItems.length === 0) {
    hide('chart-section');
    chartPoints = [];
    return;
  }

  show('chart-section');

  const canvas = $('price-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  chartCanvasRect = rect;
  ctx.clearRect(0, 0, width, height);

  const padding = chartPadding;
  const graphW = width - padding.left - padding.right;
  const graphH = height - padding.top - padding.bottom;

  const minVal = availableItems[0].val;
  const maxVal = availableItems[availableItems.length - 1].val;

  // Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (graphH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    const valLabel = maxVal - ((maxVal - minVal) / 4) * i;
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(fmtBaseVal(valLabel), padding.left - 8, y + 4);
  }

  // US baseline reference line
  const usItem = availableItems.find(i => i.country === 'us');
  if (usItem) {
    const usY = padding.top + graphH - ((usItem.val - minVal) / (maxVal - minVal || 1)) * graphH;
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, usY);
    ctx.lineTo(width - padding.right, usY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('US 기준', width - padding.right - 4, usY - 5);
  }

  // Draw points
  chartPoints = availableItems.map((item, idx) => {
    const x = padding.left + (graphW / (availableItems.length - 1 || 1)) * idx;
    const y = padding.top + graphH - ((item.val - minVal) / (maxVal - minVal || 1)) * graphH;
    return { x, y, item };
  });

  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
  gradient.addColorStop(1, 'rgba(139, 92, 246, 0.02)');

  ctx.beginPath();
  ctx.moveTo(chartPoints[0].x, height - padding.bottom);
  chartPoints.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(chartPoints[chartPoints.length - 1].x, height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(chartPoints[0].x, chartPoints[0].y);
  for (let i = 1; i < chartPoints.length; i++) {
    ctx.lineTo(chartPoints[i].x, chartPoints[i].y);
  }
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  chartPoints.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#a78bfa';
    ctx.fill();
  });
}

// ─── Chart Hover Tooltip ────────────────────────────────────────────────────
function initChartTooltip() {
  const canvas = $('price-chart');
  const tooltip = $('chart-tooltip');
  if (!canvas || !tooltip) return;

  canvas.addEventListener('mousemove', (e) => {
    if (chartPoints.length === 0) { tooltip.style.display = 'none'; return; }

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Find nearest point
    let closest = null;
    let closestDist = Infinity;
    for (const p of chartPoints) {
      const dist = Math.sqrt((p.x - mx) ** 2 + (p.y - my) ** 2);
      if (dist < closestDist) { closestDist = dist; closest = p; }
    }

    if (!closest || closestDist > 30) {
      tooltip.style.display = 'none';
      canvas.style.cursor = 'default';
      return;
    }

    canvas.style.cursor = 'pointer';
    const item = closest.item;
    const usItem2 = priceData.find(i => i.country === 'us' && i.available !== false);
    const usVal = usItem2 ? toBaseVal(usItem2.price, usItem2.currency, 'us') : null;
    const diff = (usVal && usVal > 0 && item.val > 0) ? ((item.val - usVal) / usVal * 100) : null;

    $('tooltip-flag').textContent = item.flag;
    $('tooltip-name').textContent = item.countryName + ' (' + item.country.toUpperCase() + ')';
    $('tooltip-price').textContent = fmtBaseVal(item.val);

    const diffEl = $('tooltip-diff');
    if (diff !== null) {
      const sign = diff >= 0 ? '+' : '';
      diffEl.textContent = '미국 대비 ' + sign + diff.toFixed(1) + '%';
      diffEl.className = 'tooltip-diff ' + (diff < 0 ? 'cheap' : diff > 0 ? 'expensive' : '');
    } else {
      diffEl.textContent = '';
      diffEl.className = 'tooltip-diff';
    }

    tooltip.style.display = 'block';
    const ttRect = tooltip.getBoundingClientRect();
    let tx = e.clientX + 14;
    let ty = e.clientY - 10;
    if (tx + ttRect.width > window.innerWidth - 8) tx = e.clientX - ttRect.width - 14;
    if (ty + ttRect.height > window.innerHeight - 8) ty = e.clientY - ttRect.height - 10;
    tooltip.style.left = tx + 'px';
    tooltip.style.top = ty + 'px';
  });

  canvas.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
    canvas.style.cursor = 'default';
  });

  // Click on chart point to scroll to table row
  canvas.addEventListener('click', (e) => {
    if (chartPoints.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let closest = null;
    let closestDist = Infinity;
    for (const p of chartPoints) {
      const dist = Math.sqrt((p.x - mx) ** 2 + (p.y - my) ** 2);
      if (dist < closestDist) { closestDist = dist; closest = p; }
    }

    if (closest && closestDist < 30) {
      const countryCode = closest.item.country;
      const countrySearch = $('country-search');
      if (countrySearch) { countrySearch.value = closest.item.countryName; countrySearchQuery = closest.item.countryName; renderTable(); }
      $('price-table').scrollIntoView({ behavior: 'smooth' });
      // Flash the matching row
      setTimeout(() => {
        const rows = $('price-tbody').querySelectorAll('tr');
        rows.forEach(r => {
          if (r.textContent.includes(closest.item.countryName)) {
            r.style.transition = 'background 0.3s';
            r.style.background = 'rgba(139, 92, 246, 0.2)';
            setTimeout(() => { r.style.background = ''; }, 1500);
          }
        });
      }, 400);
    }
  });
}

// ─── Price Distribution Histogram ──────────────────────────────────────────
function renderHistogram() {
  const canvas = $('price-histogram');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  const availableItems = priceData
    .filter(i => i.available !== false)
    .map(i => ({ ...i, val: toBaseVal(i.price, i.currency, i.country) }))
    .filter(i => i.val !== null && i.val > 0)
    .sort((a, b) => a.val - b.val);

  if (availableItems.length === 0) {
    hide('histogram-section');
    return;
  }
  show('histogram-section');

  // Define price brackets
  const brackets = [
    { label: '0-1', min: 0, max: 1 },
    { label: '1-3', min: 1, max: 3 },
    { label: '3-5', min: 3, max: 5 },
    { label: '5-10', min: 5, max: 10 },
    { label: '10-20', min: 10, max: 20 },
    { label: '20-50', min: 20, max: 50 },
    { label: '50+', min: 50, max: Infinity },
  ];

  const counts = brackets.map(b => ({
    ...b,
    count: availableItems.filter(i => i.val >= b.min && i.val < b.max).length
  }));

  const maxCount = Math.max(1, ...counts.map(c => c.count));
  const padding = { top: 20, right: 20, bottom: 36, left: 40 };
  const graphW = width - padding.left - padding.right;
  const graphH = height - padding.top - padding.bottom;
  const barGap = 8;
  const barW = (graphW - barGap * (counts.length - 1)) / counts.length;

  // Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (graphH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    const countLabel = Math.round(maxCount - (maxCount / 4) * i);
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(countLabel), padding.left - 6, y + 3);
  }

  // Draw bars
  counts.forEach((b, i) => {
    const x = padding.left + i * (barW + barGap);
    const barH = (b.count / maxCount) * graphH;
    const y = padding.top + graphH - barH;

    // Gradient for each bar
    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    if (b.count > 0) {
      grad.addColorStop(0, 'rgba(139, 92, 246, 0.85)');
      grad.addColorStop(1, 'rgba(99, 102, 241, 0.5)');
    } else {
      grad.addColorStop(0, 'rgba(139, 92, 246, 0.15)');
      grad.addColorStop(1, 'rgba(99, 102, 241, 0.08)');
    }

    // Round top corners
    const r = Math.min(4, barW / 4, barH);
    ctx.beginPath();
    ctx.moveTo(x, y + barH);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.lineTo(x + barW - r, y);
    ctx.arcTo(x + barW, y, x + barW, y + r, r);
    ctx.lineTo(x + barW, y + barH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Count label on top of bar
    if (b.count > 0) {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(b.count), x + barW / 2, y - 6);
    }

    // Bracket label below
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label + currentBaseCurrency, x + barW / 2, height - padding.bottom + 16);
  });

  // Y-axis label
  ctx.save();
  ctx.fillStyle = '#64748b';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.translate(12, padding.top + graphH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('국가 수', 0, 0);
  ctx.restore();
}


// ─── Compare Mode ─────────────────────────────────────────────────────────────
let comparePriceData = [];
let compareAppName = '';

async function runCompareSearch() {
  const input = $('compare-search-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) {
    input.focus();
    return;
  }

  const parsed = parseAppStoreUrl(raw);
  if (!parsed || !parsed.appId) {
    showToast('올바른 URL 또는 앱 ID를 입력해 주세요.');
    return;
  }

  const status = $('compare-status');
  const statusText = $('compare-status-text');
  if (status) show('compare-status');
  if (statusText) statusText.textContent = '비교할 앱 가격 정보를 수집하는 중…';

  comparePriceData = [];
  const targetStore = parsed.store || 'apple';
  const appId = parsed.appId;

  try {
    const streamUrl = targetStore === 'google'
      ? `/api/google-prices-stream/${appId}`
      : `/api/prices-stream/${appId}`;
      
    const es = new EventSource(streamUrl);
    await new Promise((resolve) => {
      let count = 0;
      const timeout = setTimeout(() => { es.close(); resolve(); }, 30000);

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'done' || data.type === 'error') {
            clearTimeout(timeout);
            es.close();
            resolve();
          } else if (data.country) {
            comparePriceData.push(data);
            count++;
            if (count % 10 === 0 && statusText) {
              statusText.textContent = `비교 앱 가격 수집 중… ${count}개국 완료`;
            }
          }
        } catch { /* skip */ }
      };
      es.onerror = () => { clearTimeout(timeout); es.close(); resolve(); };
    });
  } catch (e) {
    console.warn('Compare fetch error:', e);
  } finally {
    if (status) hide('compare-status');
    renderCompareTable();
  }
}

function renderCompareTable() {
  const tbody = $('compare-tbody');
  if (!tbody) return;

  if (comparePriceData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-placeholder">비교할 앱 가격 정보를 불러오지 못했습니다.</td></tr>`;
    return;
  }

  const bestCompare = comparePriceData.find(i => i.appName);
  compareAppName = bestCompare ? bestCompare.appName : '비교 앱';

  const appALabel = document.querySelector('.compare-app-a');
  const appBLabel = document.querySelector('.compare-app-b');
  if (appALabel) {
    const bestA = priceData.find(i => i.appName);
    appALabel.textContent = bestA ? bestA.appName : '앱 A';
  }
  if (appBLabel) {
    appBLabel.textContent = compareAppName;
  }

  const uniqueA = getUniqueCountries(priceData);
  const uniqueB = getUniqueCountries(comparePriceData);

  let aWins = 0, bWins = 0, ties = 0;

  const fragment = document.createDocumentFragment();
  uniqueA.forEach((itemA) => {
    if (itemA.available === false) return;
    const itemB = uniqueB.find(i => i.country === itemA.country && i.available !== false);

    const valA = toBaseVal(itemA.price, itemA.currency, itemA.country);
    const valB = itemB ? toBaseVal(itemB.price, itemB.currency, itemB.country) : null;

    let diff = null;
    let winner = '';
    if (valA !== null && valA > 0 && valB !== null && valB > 0) {
      diff = ((valB - valA) / valA) * 100;
      if (valA < valB) { winner = 'a'; aWins++; }
      else if (valB < valA) { winner = 'b'; bWins++; }
      else { ties++; }
    } else if (valA !== null && valA > 0 && (valB === null || valB === 0)) {
      winner = 'b'; bWins++;
    } else if (valB !== null && valB > 0 && (valA === null || valA === 0)) {
      winner = 'a'; aWins++;
    }

    const tr = document.createElement('tr');
    const dc = diffClass(diff);

    tr.innerHTML = `
      <td class="col-country">
        <span class="flag">${itemA.flag}</span>
        <span class="country-name">${escHtml(itemA.countryName)}</span>
      </td>
      <td class="col-local compare-app-a${winner === 'a' ? ' compare-winner' : ''}">${fmtLocal(itemA.price, itemA.currency, itemA.formattedPrice)}</td>
      <td class="col-usd">${fmtBaseVal(valA)}</td>
      <td class="col-local compare-app-b${winner === 'b' ? ' compare-winner' : ''}">${itemB ? fmtLocal(itemB.price, itemB.currency, itemB.formattedPrice) : '<span class="unavailable-label">미지원</span>'}</td>
      <td class="col-usd">${itemB ? fmtBaseVal(valB) : '—'}</td>
      <td class="col-diff">
        ${diff !== null ? `<span class="diff-badge ${dc}">${diffLabel(diff)}</span>` : '—'}
      </td>
    `;
    fragment.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);

  const statusText = $('compare-status-text');
  if (statusText && (aWins + bWins + ties) > 0) {
    statusText.textContent = `비교 완료: ${aWins}개국에서 앱 A 저렴 · ${bWins}개국에서 앱 B 저렴 · ${ties}개국 동일`;
  }
}
// ─── Copy Table TSV ────────────────────────────────────────────────────────────
function copyTableTSV() {
  const availableItems = getUniqueCountries(priceData)
    .filter(i => i.available !== false)
    .map(i => ({
      ...i,
      val: toBaseVal(i.price, i.currency, i.country)
    }));

  if (availableItems.length === 0) {
    showToast('복사할 데이터가 없습니다.');
    return;
  }

  const usItem = availableItems.find(i => i.country === 'us');
  const usVal = usItem ? usItem.val : null;

  availableItems.sort((a, b) => (a.val ?? Infinity) - (b.val ?? Infinity));

  let tsv = `순위\t국가\t현지 가격\t${currentBaseCurrency} 환산가\t미국 대비 차이\n`;
  availableItems.forEach((item, idx) => {
    const diff = (usVal !== null && usVal > 0 && item.val !== null && item.val > 0)
      ? (((item.val - usVal) / usVal) * 100).toFixed(1) + '%'
      : '-';
    const localFormatted = item.formattedPrice || `${item.currency} ${item.price}`;
    const baseFormatted = item.val !== null ? fmtBaseVal(item.val) : '-';
    tsv += `${idx + 1}\t${item.countryName}\t${localFormatted}\t${baseFormatted}\t${diff}\n`;
  });

  navigator.clipboard.writeText(tsv).then(() => {
    showToast('📋 클립보드에 테이블 데이터가 복사되었습니다.');
  }).catch(() => {
    showToast('클립보드 복사에 실패했습니다.');
  });
}

// ─── Export CSV ──────────────────────────────────────────────────────────────
function exportCSV() {
  const availableItems = getUniqueCountries(priceData)
    .filter(i => i.available !== false)
    .map(i => ({
      ...i,
      val: toBaseVal(i.price, i.currency, i.country)
    }));

  if (availableItems.length === 0) {
    showToast('내보낼 데이터가 없습니다.');
    return;
  }

  const bestItem = priceData.find(i => i.appName);
  const appName = bestItem ? bestItem.appName : 'app_prices';

  const usItem = availableItems.find(i => i.country === 'us');
  const usVal = usItem ? usItem.val : null;

  let csvContent = '\uFEFF';
  csvContent += 'Rank,Country Code,Country Name,Region,Local Price,Local Currency,Base Currency Price (' + currentBaseCurrency + '),Difference vs US (%)\n';

  availableItems.sort((a, b) => (a.val ?? Infinity) - (b.val ?? Infinity));

  availableItems.forEach((item, idx) => {
    const diff = (usVal !== null && usVal > 0 && item.val !== null && item.val > 0)
      ? (((item.val - usVal) / usVal) * 100).toFixed(1) + '%'
      : 'N/A';

    const localFormatted = item.formattedPrice || `${item.currency} ${item.price}`;
    const baseFormatted = item.val !== null ? item.val.toFixed(2) : 'N/A';

    const row = [
      idx + 1,
      `"${item.country.toUpperCase()}"`,
      `"${item.countryName}"`,
      `"${item.region || ''}"`,
      `"${localFormatted}"`,
      `"${item.currency}"`,
      `"${baseFormatted}"`,
      `"${diff}"`
    ].join(',');

    csvContent += row + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${appName.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}_prices.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('📥 CSV 파일이 성공적으로 다운로드되었습니다.');
}

// ─── Export Infographic PNG Card ──────────────────────────────────────────────
function exportInfographicCard() {
  const availableItems = priceData
    .filter(i => i.available !== false)
    .map(i => ({ ...i, val: toBaseVal(i.price, i.currency, i.country) }))
    .filter(i => i.val !== null);

  if (availableItems.length === 0) {
    showToast('저장할 가격 데이터가 없습니다.');
    return;
  }

  const bestItem = priceData.find(i => i.appName) || {};
  const appName = bestItem.appName || 'App Store Compare';
  const developer = bestItem.developer || 'Developer';

  const paidItems = availableItems.filter(i => i.val > 0).sort((a, b) => a.val - b.val);
  const cheapest = paidItems[0] || availableItems[0];
  const priciest = paidItems[paidItems.length - 1] || availableItems[0];
  const avgVal = paidItems.length > 0 ? paidItems.reduce((s, i) => s + i.val, 0) / paidItems.length : 0;

  // Create Canvas (1200 x 675)
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 675;
  const ctx = canvas.getContext('2d');

  // Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 1200, 675);
  bgGrad.addColorStop(0, '#070a19');
  bgGrad.addColorStop(0.5, '#0e142e');
  bgGrad.addColorStop(1, '#131a3a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 675);

  // Border & Accent Glow
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 1160, 635);

  // Header Title
  ctx.fillStyle = '#8b5cf6';
  ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText('📱 AppPriceCheck — Price Intelligence Report', 60, 80);

  // App Name
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.fillText(appName.substring(0, 45), 60, 135);

  // Developer
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '20px Inter, sans-serif';
  ctx.fillText(`개발사: ${developer}`, 60, 170);

  // Stat Boxes (3 columns)
  const boxY = 210;
  const boxW = 340;
  const boxH = 130;

  // Box 1: Cheapest
  ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(60, boxY, boxW, boxH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText('가장 저렴한 국가 💚', 85, boxY + 38);
  ctx.font = 'bold 28px Inter, sans-serif';
  ctx.fillText(fmtBaseVal(cheapest.val), 85, boxY + 80);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(`${cheapest.flag} ${cheapest.countryName}`, 85, boxY + 108);

  // Box 2: Priciest
  ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
  ctx.beginPath();
  ctx.roundRect(430, boxY, boxW, boxH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f87171';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText('가장 높은 가격 🔴', 455, boxY + 38);
  ctx.font = 'bold 28px Inter, sans-serif';
  ctx.fillText(fmtBaseVal(priciest.val), 455, boxY + 80);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(`${priciest.flag} ${priciest.countryName}`, 455, boxY + 108);

  // Box 3: Average
  ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
  ctx.beginPath();
  ctx.roundRect(800, boxY, boxW, boxH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#c4b5fd';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText('글로벌 평균 가격 📊', 825, boxY + 38);
  ctx.font = 'bold 28px Inter, sans-serif';
  ctx.fillText(fmtBaseVal(avgVal), 825, boxY + 80);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(`${currentBaseCurrency} 환산 기준`, 825, boxY + 108);

  // Top 5 Cheapest Section Header
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px Inter, sans-serif';
  ctx.fillText('🏆 TOP 5 최저가 국가', 60, 395);

  const top5 = paidItems.slice(0, 5);
  top5.forEach((item, idx) => {
    const itemY = 430 + idx * 42;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(60, itemY - 24, 1080, 36, 8);
    ctx.fill();

    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(`#${idx + 1}`, 80, itemY);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '18px Inter, sans-serif';
    ctx.fillText(`${item.flag}  ${item.countryName}`, 140, itemY);

    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`현지가: ${item.formattedPrice || fmtLocal(item.price, item.currency)}`, 550, itemY);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.fillText(`${fmtBaseVal(item.val)}`, 960, itemY);
  });

  // Price Range Bar
  const barY = 370;
  const barW = 1080;
  const barH = 8;
  const barX = 60;

  // Background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 4);
  ctx.fill();

  // Cheapest to average range
  if (paidItems.length > 0) {
    const range = priciest.val - cheapest.val || 1;
    const avgX = barX + ((avgVal - cheapest.val) / range) * barW;
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(0.5, '#8b5cf6');
    grad.addColorStop(1, '#ef4444');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // Average marker
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(avgX, barY + barH / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(avgX, barY + barH / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(fmtBaseVal(cheapest.val), barX, barY - 8);
    ctx.textAlign = 'center';
    ctx.fillText('평균 ' + fmtBaseVal(avgVal), avgX, barY - 8);
    ctx.textAlign = 'right';
    ctx.fillText(fmtBaseVal(priciest.val), barX + barW, barY - 8);
    ctx.textAlign = 'left';
  }

  // Savings Tip
  if (paidItems.length > 0 && usVal && usVal > 0) {
    const savingPct = ((1 - cheapest.val / usVal) * 100).toFixed(0);
    if (cheapest.val < usVal) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.beginPath();
      ctx.roundRect(60, barY + 20, 1080, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText(`💡 미국에서 ${cheapest.flag} ${cheapest.countryName}(으)로 구매하면 ${savingPct}% 절약 (${fmtBaseVal(usVal - cheapest.val)} 절약)`, 80, barY + 40);
    }
  }

  // Footer Watermark
  ctx.fillStyle = '#64748b';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText('Generated by https://haha5039.github.io/AppPriceCheck/', 60, 640);

  // Download Trigger
  const link = document.createElement('a');
  link.download = `${appName.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}_price_summary.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('📸 요약 카드가 PNG 이미지로 저장되었습니다.');
}

// ─── Price History Tracking ─────────────────────────────────────────────────
const PRICE_HISTORY_KEY = 'app_price_history';
const MAX_HISTORY_ENTRIES = 50;

function getPriceHistory() {
  try {
    const raw = localStorage.getItem(PRICE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePriceHistoryEntry(appId, store, appName, icon, cheapestPrice, cheapestCountry, avgPrice, currency) {
  const history = getPriceHistory();
  const now = Date.now();
  // Avoid duplicate entries within 5 minutes
  const recent = history.find(h => h.appId === appId && (now - h.timestamp) < 5 * 60 * 1000);
  if (recent) return;

  history.unshift({
    appId,
    store: store || 'apple',
    appName,
    icon: icon || '',
    timestamp: now,
    cheapestPrice,
    cheapestCountry,
    avgPrice,
    currency: currency || 'USD'
  });

  // Keep only last N entries
  if (history.length > MAX_HISTORY_ENTRIES) history.length = MAX_HISTORY_ENTRIES;
  try {
    localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history));
  } catch { /* localStorage full */ }
}

function getLastCheckedTime(appId) {
  const history = getPriceHistory();
  const entry = history.find(h => h.appId === appId);
  if (!entry) return null;
  const diff = Date.now() - entry.timestamp;
  if (diff < 60 * 1000) return '방금 전';
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + '분 전';
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + '시간 전';
  return Math.floor(diff / 86400000) + '일 전';
}

function renderPriceHistoryBadge() {
  const lastChecked = getLastCheckedTime(currentAppId);
  const badge = $('last-checked-badge');
  if (!badge) return;
  if (lastChecked) {
    badge.textContent = '마지막 조회: ' + lastChecked;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// ─── Theme Toggle System ──────────────────────────────────────────────────────
function initTheme() {
  const savedTheme = localStorage.getItem('app_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isLight = savedTheme === 'light' || (!savedTheme && !prefersDark);
  
  if (isLight) {
    document.body.classList.add('light-theme');
    const themeIcon = $('theme-icon');
    if (themeIcon) themeIcon.textContent = '☀️';
  } else {
    document.body.classList.remove('light-theme');
    const themeIcon = $('theme-icon');
    if (themeIcon) themeIcon.textContent = '🌙';
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('app_theme', isLight ? 'light' : 'dark');
  const themeIcon = $('theme-icon');
  if (themeIcon) themeIcon.textContent = isLight ? '☀️' : '🌙';
  showToast(isLight ? '☀️ 라이트 모드로 전환되었습니다.' : '🌙 다크 모드로 전환되었습니다.');
}

// ─── Keyboard Shortcuts Modal ────────────────────────────────────────────────
function openShortcutsModal() {
  const modal = $('shortcuts-modal');
  if (!modal) return;
  show('shortcuts-modal');
  modal.classList.add('visible');
}

function closeShortcutsModal() {
  const modal = $('shortcuts-modal');
  if (!modal) return;
  modal.classList.remove('visible');
  hide('shortcuts-modal');
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = $('search-input');
  const searchBtn   = $('search-btn');

  async function resolveAppByQuery(rawQuery) {
    let parsed = parseAppStoreUrl(rawQuery);
    if (parsed && parsed.appId) return parsed;

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(rawQuery)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const topMatch = data.results[0];
          return {
            appId: String(topMatch.trackId),
            store: 'apple',
            hintCountry: null
          };
        }
      }
    } catch (err) {
      console.warn('Smart resolution error:', err);
    }

    return null;
  }

  async function handleSearch() {
    const raw = searchInput.value.trim();
    if (!raw) {
      searchInput.focus();
      return;
    }

    searchBtn.disabled = true;
    searchBtn.querySelector('.btn-label').textContent = '조회 중…';

    try {
      let parsed = await resolveAppByQuery(raw);
      if (!parsed || !parsed.appId) {
        showToast('💡 검색어를 바탕으로 앱을 찾습니다.');
        openSearchModal();
        const modalInput = $('search-modal-input');
        if (modalInput) {
          modalInput.value = raw;
          modalInput.dispatchEvent(new Event('input'));
        }
        return;
      }

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

  // Tier chips filter
  document.querySelectorAll('.tier-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.tier-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentTierFilter = chip.dataset.tier;
      renderTable();
    });
  });

  // Regional heatmap card click filter
  document.querySelectorAll('.region-card').forEach(card => {
    card.addEventListener('click', () => {
      const region = card.dataset.region;
      document.querySelectorAll('.region-tab').forEach(t => {
        if (t.dataset.region === region) {
          t.click();
          $('price-table').scrollIntoView({ behavior: 'smooth' });
        }
      });
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

  loadFavorites();
  initTheme();
  const themeBtn = $('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }
  fetchExchangeRates();

  // Base Currency selector
  const baseCurrencySelect = $('base-currency-select');
  if (baseCurrencySelect) {
    baseCurrencySelect.addEventListener('change', (e) => {
      currentBaseCurrency = e.target.value;
      updateStats();
      renderTable();
      renderIapTable();
    });
  }

  // PPP mode toggle
  const pppBtn = $('ppp-toggle-btn');
  if (pppBtn) {
    pppBtn.addEventListener('click', () => {
      isPppMode = !isPppMode;
      pppBtn.classList.toggle('active', isPppMode);
      showToast(isPppMode ? '🍔 구매력 평가(PPP) 지수가 적용되었습니다.' : '💵 표준 환율 변환 모드로 전환되었습니다.');
      updateStats();
      renderTable();
      renderIapTable();
    });
  }

  // Favorite App button
  const favBtn = $('fav-btn');
  if (favBtn) {
    favBtn.addEventListener('click', toggleFavoriteApp);
  }

  // Export Infographic Card button
  const exportCardBtn = $('export-card-btn');
  if (exportCardBtn) {
    exportCardBtn.addEventListener('click', exportInfographicCard);
  }

  // Export CSV button
  const exportCsvBtn = $('export-csv-btn');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportCSV);
  }

  // Copy Table button
  const copyBtn = $('copy-table-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', copyTableTSV);
  }

  // Sortable table headers
  document.querySelectorAll('.sortable-th').forEach(th => {
    th.addEventListener('click', () => {
      const sortType = th.dataset.sort;
      if (currentSort === sortType) {
        if (sortType === 'usd-asc') currentSort = 'usd-desc';
        else if (sortType === 'usd-desc') currentSort = 'usd-asc';
        else if (sortType === 'diff-asc') currentSort = 'diff-desc';
        else if (sortType === 'diff-desc') currentSort = 'diff-asc';
      } else {
        currentSort = sortType;
      }
      const sortSelect = $('sort-select');
      if (sortSelect) sortSelect.value = currentSort;
      renderTable();
    });
  });

  // Compare Mode Toggle
  const compareBtn = $('compare-btn');
  const compareToggleBtn = $('compare-toggle-btn');
  const compareSection = $('compare-section');

  if (compareBtn) {
    compareBtn.addEventListener('click', () => {
      show('compare-section');
      if (compareSection) compareSection.scrollIntoView({ behavior: 'smooth' });
      const compareInput = $('compare-search-input');
      if (compareInput) compareInput.focus();
    });
  }

  if (compareToggleBtn) {
    compareToggleBtn.addEventListener('click', () => {
      hide('compare-section');
    });
  }

  const compareSearchBtn = $('compare-search-btn');
  const compareSearchInput = $('compare-search-input');
  if (compareSearchBtn) {
    compareSearchBtn.addEventListener('click', runCompareSearch);
  }
  if (compareSearchInput) {
    compareSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runCompareSearch();
    });
  }

  // Watchlist modal
  const watchlistBtn = $('watchlist-btn');
  const watchlistClose = $('watchlist-modal-close');
  const watchlistBackdrop = $('watchlist-modal-backdrop');

  if (watchlistBtn) {
    watchlistBtn.addEventListener('click', () => {
      renderWatchlistModal();
      show('watchlist-modal');
      const modal = $('watchlist-modal');
      if (modal) modal.classList.add('visible');
    });
  }
  if (watchlistClose) {
    watchlistClose.addEventListener('click', () => {
      const modal = $('watchlist-modal');
      if (modal) modal.classList.remove('visible');
      hide('watchlist-modal');
    });
  }
  if (watchlistBackdrop) {
    watchlistBackdrop.addEventListener('click', () => {
      const modal = $('watchlist-modal');
      if (modal) modal.classList.remove('visible');
      hide('watchlist-modal');
    });
  }

  // IAP select & filters
  const iapSelectEl = $('iap-select');
  if (iapSelectEl) {
    iapSelectEl.addEventListener('change', (e) => {
      selectedIapTrackName = e.target.value;
      renderIapTable();
    });
  }

  const iapCountrySearch = $('iap-country-search');
  if (iapCountrySearch) {
    iapCountrySearch.addEventListener('input', (e) => {
      iapCountrySearchQuery = e.target.value;
      renderIapTable();
    });
  }

  const iapRegionTabs = document.querySelectorAll('#iap-region-tabs .region-tab');
  iapRegionTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      iapRegionTabs.forEach(t => t.classList.remove('active'));
      const target = e.currentTarget || e.target;
      target.classList.add('active');
      iapCurrentRegion = target.dataset.region;
      renderIapTable();
    });
  });

  const iapCurrSelect = $('iap-currency-select');
  if (iapCurrSelect) {
    iapCurrSelect.addEventListener('change', (e) => {
      iapCurrentBaseCurrency = e.target.value;
      renderIapTable();
    });
  }

  const iapSortSelect = $('iap-sort-select');
  if (iapSortSelect) {
    iapSortSelect.addEventListener('change', (e) => {
      iapCurrentSort = e.target.value;
      renderIapTable();
    });
  }

  const iapCopyBtn = $('iap-copy-table-btn');
  if (iapCopyBtn) {
    iapCopyBtn.addEventListener('click', () => {
      copyIapTableToClipboard();
    });
  }

// ─── Calculator Logic ────────────────────────────────────────────────────────
async function calculateCurrencyConversion() {
  if (!exchangeRates || Object.keys(exchangeRates).length <= 1) {
    await fetchExchangeRates();
  }
  const amountEl = $('calc-amount-input');
  const fromEl = $('calc-from-select');
  const toEl = $('calc-to-select');
  const resultEl = $('calc-result-value');
  const rateInfoEl = $('calc-rate-info');
  if (!amountEl || !fromEl || !toEl || !resultEl) return;

  const amt = parseFloat(amountEl.value) || 0;
  const fromCurr = fromEl.value;
  const toCurr = toEl.value;

  const usdVal = toUSD(amt, fromCurr);
  if (usdVal === null || usdVal < 0) {
    resultEl.textContent = '—';
    if (rateInfoEl) rateInfoEl.textContent = '환율 정보를 수집하는 중…';
    return;
  }

  const targetRate = exchangeRates[toCurr] || 1;
  const converted = usdVal * targetRate;

  let symbol = '$';
  if (toCurr === 'KRW') symbol = '₩';
  else if (toCurr === 'EUR') symbol = '€';
  else if (toCurr === 'JPY') symbol = '¥';
  else if (toCurr === 'GBP') symbol = '£';

  const formatted = toCurr === 'KRW' || toCurr === 'JPY'
    ? `${symbol}${Math.round(converted).toLocaleString()}`
    : `${symbol}${converted.toFixed(2)}`;

  resultEl.textContent = formatted;
  if (rateInfoEl) {
    rateInfoEl.textContent = `1 ${fromCurr} = ${(toUSD(1, fromCurr) * targetRate).toFixed(4)} ${toCurr} (실시간 기준)`;
  }
}

  // Recent searches setup
  loadRecentSearches();
  const recentClearBtn = $('recent-clear-btn');
  if (recentClearBtn) {
    recentClearBtn.addEventListener('click', clearRecentSearches);
  }

  // Calculator Modal Setup
  const calcNavBtn = $('calc-nav-btn');
  const calcModalClose = $('calc-modal-close');
  const calcModalBackdrop = $('calc-modal-backdrop');

  if (calcNavBtn) {
    calcNavBtn.addEventListener('click', () => {
      calculateCurrencyConversion();
      show('calculator-modal');
      const modal = $('calculator-modal');
      if (modal) modal.classList.add('visible');
    });
  }

  if (calcModalClose) {
    calcModalClose.addEventListener('click', () => {
      const modal = $('calculator-modal');
      if (modal) modal.classList.remove('visible');
      hide('calculator-modal');
    });
  }

  if (calcModalBackdrop) {
    calcModalBackdrop.addEventListener('click', () => {
      const modal = $('calculator-modal');
      if (modal) modal.classList.remove('visible');
      hide('calculator-modal');
    });
  }

  ['calc-amount-input', 'calc-from-select', 'calc-to-select'].forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener('input', calculateCurrencyConversion);
      el.addEventListener('change', calculateCurrencyConversion);
    }
  });

  // ─── Store Tab Switching ─────────────────────────────────────────────────
  const tabApple = $('tab-apple');
  const tabGoogle = $('tab-google');
  const appleExamples = $('apple-examples');
  const googleExamples = $('google-examples');
  const searchInput2 = $('search-input');

  function setActiveStore(store) {
    if (tabApple && tabGoogle) {
      tabApple.classList.toggle('active', store === 'apple');
      tabGoogle.classList.toggle('active', store === 'google');
    }
    if (appleExamples && googleExamples) {
      appleExamples.classList.toggle('hidden', store !== 'apple');
      googleExamples.classList.toggle('hidden', store !== 'google');
    }
    const icon = $('search-store-icon');
    if (icon) icon.textContent = store === 'google' ? '🤖' : '📱';
    if (searchInput2) {
      searchInput2.placeholder = store === 'google'
        ? 'Google Play URL 또는 패키지 ID를 붙여넣으세요'
        : 'App Store URL 또는 앱 ID를 붙여넣으세요';
    }
  }

  if (tabApple) {
    tabApple.addEventListener('click', () => setActiveStore('apple'));
  }
  if (tabGoogle) {
    tabGoogle.addEventListener('click', () => setActiveStore('google'));
  }

  // ─── Search Modal (Cmd/Ctrl+K) ──────────────────────────────────────────
  const searchModal = $('search-modal');
  const searchModalInput = $('search-modal-input');
  const searchModalResults = $('search-modal-results');
  const searchModalClose = $('search-modal-close');
  const searchModalBackdrop = $('search-modal-backdrop');

  function openSearchModal() {
    if (!searchModal) return;
    show('search-modal');
    searchModal.classList.add('visible');
    setTimeout(() => { if (searchModalInput) searchModalInput.focus(); searchModalInput.select(); }, 100);
  }

  function closeSearchModal() {
    if (!searchModal) return;
    searchModal.classList.remove('visible');
    hide('search-modal');
    if (searchModalInput) searchModalInput.value = '';
    if (searchModalResults) searchModalResults.innerHTML = '<p class="search-modal-hint">앱 이름을 입력하면 App Store에서 검색합니다.</p>';
  }

  // Keyboard shortcut: Cmd/Ctrl + K
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const isVisible = searchModal && !searchModal.classList.contains('hidden');
      if (isVisible) closeSearchModal();
      else openSearchModal();
    }
    if (e.key === 'Escape') {
      if (searchModal && !searchModal.classList.contains('hidden')) closeSearchModal();
      else if ($('shortcuts-modal') && !$('shortcuts-modal').classList.contains('hidden')) closeShortcutsModal();
    }
    // ? key for shortcuts help (only when not typing in an input)
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = document.activeElement?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        const shortcutsModal = $('shortcuts-modal');
        if (shortcutsModal && !shortcutsModal.classList.contains('hidden')) closeShortcutsModal();
        else openShortcutsModal();
      }
    }
  });

  
  // Keyboard navigation in search modal (Arrow keys + Enter)
  if (searchModalInput) {
    searchModalInput.addEventListener('keydown', (e) => {
      const items = searchModalResults.querySelectorAll('.search-result-item');
      if (items.length === 0) return;
      const focused = searchModalResults.querySelector('.search-result-focused');
      let idx = Array.from(items).indexOf(focused);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (focused) focused.classList.remove('search-result-focused');
        idx = (idx + 1) % items.length;
        items[idx].classList.add('search-result-focused');
        items[idx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (focused) focused.classList.remove('search-result-focused');
        idx = idx <= 0 ? items.length - 1 : idx - 1;
        items[idx].classList.add('search-result-focused');
        items[idx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && focused) {
        e.preventDefault();
        focused.click();
      }
    });
  }

  if (searchModalClose) searchModalClose.addEventListener('click', closeSearchModal);
  if (searchModalBackdrop) searchModalBackdrop.addEventListener('click', closeSearchModal);

  const keyboardHintBtn = $('keyboard-hint-btn');
  if (keyboardHintBtn) {
    keyboardHintBtn.addEventListener('click', openSearchModal);
  }

  // Search modal: live search via iTunes API
  let searchModalDebounce = null;
  if (searchModalInput) {
    searchModalInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(searchModalDebounce);
      if (q.length < 2) {
        searchModalResults.innerHTML = '<p class="search-modal-hint">앱 이름을 입력하면 App Store에서 검색합니다.</p>';
        return;
      }
      
        searchModalResults.innerHTML = '<div class="search-result-spinner"><div class="mini-spinner"></div></div>';
      searchModalDebounce = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (!data.results || data.results.length === 0) {
            searchModalResults.innerHTML = '<p class="search-modal-hint">검색 결과가 없습니다.</p>';
            return;
          }
          searchModalResults.innerHTML = data.results.map(app => `
            <div class="search-result-item" data-app-id="${app.trackId}">
              <img class="search-result-icon" src="${escHtml(app.artworkUrl100 || app.artworkUrl60)}" alt="" onerror="this.style.display='none'">
              <div class="search-result-info">
                <p class="search-result-name">${escHtml(app.trackName)}</p>
                <p class="search-result-dev">${escHtml(app.artistName)} · ${escHtml(app.primaryGenreName)}</p>
              </div>
              <span class="search-result-price">${escHtml(app.formattedPrice || 'Free')}</span>
            </div>
          `).join('');

          searchModalResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
              const id = item.dataset.appId;
              closeSearchModal();
              const activeStore = tabGoogle && tabGoogle.classList.contains('active') ? 'google' : 'apple';
              searchApp({ appId: id, store: activeStore });
            });
          });
        } catch (err) {
          searchModalResults.innerHTML = '<p class="search-modal-hint">검색 중 오류가 발생했습니다. 다시 시도해 주세요.</p>';
        }
      }, 350);
    });
  }

  // ─── Share Button ────────────────────────────────────────────────────────
  const shareBtn = $('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      if (!currentAppId) return;
      const url = window.location.origin + window.location.pathname + '?id=' + currentAppId;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'AppPriceCheck — 가격 비교', url });
        } else {
          await navigator.clipboard.writeText(url);
          showToast('📋 링크가 클립보드에 복사되었습니다.');
        }
      } catch {
        // User cancelled or not supported
      }
    });
  }

  // ─── Back to Top Button ──────────────────────────────────────────────────
  const backToTop = $('back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        backToTop.classList.remove('hidden');
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.add('hidden');
        backToTop.classList.remove('visible');
      }
    }, { passive: true });

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

      // Shortcuts Modal
  if ($('shortcuts-modal-close')) $('shortcuts-modal-close').addEventListener('click', closeShortcutsModal);
  if ($('shortcuts-modal-backdrop')) $('shortcuts-modal-backdrop').addEventListener('click', closeShortcutsModal);

  initChartTooltip();

  // ─── URL Deep Link ──────────────────────────────────────────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const deepLinkId = urlParams.get('id');
  if (deepLinkId) {
    const isGooglePlay = /^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+$/.test(deepLinkId);
    searchApp({ appId: deepLinkId, store: isGooglePlay ? 'google' : 'apple' });
  }

});
