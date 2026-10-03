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
let currentStore = 'apple';
let currentHintCountry = null;
let currentAppIsFree = false;
let activeIapStream = null;
let currentSearchToken = 0;
let searchController = null;
let compareController = null;
let compareRequestToken = 0;
let nameRequestToken = 0;
let nameController = null;
let scanCountryCodes = [];
let scanFinished = false;
let iapStatuses = {};
let ratesRequestToken = 0;
let currentBaseCurrency = 'USD'; // 'USD', 'KRW', 'EUR', 'JPY', 'GBP', 'CAD', 'AUD'
let isPppMode = false;           // Purchasing Power Parity mode toggle
let favoriteApps = [];           // localStorage Watchlist
let currentTierFilter = 'all';  // 'all', 'cheap-30', 'sub-5', 'exp-top'

// IAP Filter state variables
let iapCurrentRegion = 'all';
let iapCountrySearchQuery = '';
let iapCurrentBaseCurrency = 'USD';
let iapCurrentSort = 'usd-asc';


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

// Client-side copy of the server currency map. Used by the GitHub Pages IAP
// scanner, which has no access to /api/* endpoints.
const COUNTRY_CURRENCIES = {
  us: 'USD', ca: 'CAD', mx: 'MXN', br: 'BRL', ar: 'ARS', cl: 'CLP', co: 'COP', pe: 'PEN',
  uy: 'UYU', bo: 'BOB', ec: 'USD', cr: 'CRC', gt: 'GTQ', py: 'PYG', do: 'DOP', jm: 'JMD', tt: 'TTD',
  gb: 'GBP', de: 'EUR', fr: 'EUR', it: 'EUR', es: 'EUR', nl: 'EUR', se: 'SEK', no: 'NOK',
  dk: 'DKK', fi: 'EUR', pl: 'PLN', be: 'EUR', at: 'EUR', ch: 'CHF', pt: 'EUR', ie: 'EUR',
  cz: 'CZK', hu: 'HUF', ro: 'RON', gr: 'EUR', tr: 'TRY', ua: 'UAH', ru: 'RUB', sk: 'EUR',
  bg: 'BGN', hr: 'EUR', si: 'EUR', lt: 'EUR', lv: 'EUR', ee: 'EUR', lu: 'EUR', mt: 'EUR',
  cy: 'EUR', is: 'ISK', al: 'ALL', rs: 'RSD', mk: 'MKD', md: 'MDL', am: 'AMD', ge: 'GEL',
  az: 'AZN', kz: 'KZT',
  jp: 'JPY', kr: 'KRW', cn: 'CNY', au: 'AUD', nz: 'NZD', sg: 'SGD', hk: 'HKD', tw: 'TWD',
  in: 'INR', th: 'THB', ph: 'PHP', my: 'MYR', id: 'IDR', vn: 'VND', pk: 'PKR', lk: 'LKR',
  mn: 'MNT', np: 'NPR', mm: 'MMK', kh: 'KHR', bn: 'BND', uz: 'UZS', kg: 'KGS',
  ae: 'AED', sa: 'SAR', kw: 'KWD', qa: 'QAR', bh: 'BHD', om: 'OMR', jo: 'JOD', eg: 'EGP',
  il: 'ILS', lb: 'LBP', iq: 'IQD',
  za: 'ZAR', ng: 'NGN', ke: 'KES', gh: 'GHS', tz: 'TZS', ma: 'MAD', ug: 'UGX', sn: 'XOF',
  dz: 'DZD', tn: 'TND', et: 'ETB', zm: 'ZMW', cm: 'XAF', ci: 'XOF', mz: 'MZN',
};

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
  if (!Number.isFinite(price) || price < 0 || !currency) return null;
  if (price === 0) return 0;
  const rate = currency === 'USD' ? 1 : exchangeRates[currency];
  return Number.isFinite(rate) && rate > 0 ? price / rate : null;
}

function toBaseVal(price, currency, countryCode = 'us', baseCurrencyOverride) {
  let usd = toUSD(price, currency);
  if (usd === null || usd === 0) return usd;
  if (isPppMode && PPP_FACTORS[countryCode?.toLowerCase()]) usd /= PPP_FACTORS[countryCode.toLowerCase()];
  const base = baseCurrencyOverride || currentBaseCurrency;
  const rate = base === 'USD' ? 1 : exchangeRates[base];
  return Number.isFinite(rate) && rate > 0 ? usd * rate : null;
}

function fmtBaseVal(val, currOverride) {
  if (!Number.isFinite(val)) return '환산 불가';
  if (val === 0) return '무료';
  const currency = currOverride || currentBaseCurrency;
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(val);
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
const modalFocus = new Map();
const show = id => {
  const element = $(id);
  if (!element) return;
  if (element.getAttribute('role') === 'dialog') {
    document.querySelectorAll('[role="dialog"]:not(.hidden)').forEach(other => { if (other !== element) hide(other.id); });
    if (element.classList.contains('hidden')) modalFocus.set(id, document.activeElement);
    element.classList.remove('hidden');
    element.classList.add('visible');
    (element.querySelector('input, select, button, [tabindex="0"]') || element).focus();
  } else element.classList.remove('hidden');
};
const hide = id => {
  const element = $(id);
  if (!element) return;
  const wasVisible = !element.classList.contains('hidden');
  element.classList.add('hidden');
  if (element.getAttribute('role') === 'dialog') {
    element.classList.remove('visible');
    if (id === 'search-modal') {
      nameController?.abort(); nameRequestToken++;
      if (!searchController || scanFinished) { $('search-btn').disabled = false; $('search-btn').querySelector('.btn-label').textContent = '조회하기'; }
    }
    if (wasVisible) modalFocus.get(id)?.focus();
  }
};

function initModalKeyboard() {
  document.addEventListener('keydown', event => {
    const modal = document.querySelector('[role="dialog"]:not(.hidden)');
    if (!modal) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      hide(modal.id);
    } else if (event.key === 'Tab') {
      const controls = [...modal.querySelectorAll('button, input, select, a[href], [tabindex="0"]')]
        .filter(el => !el.disabled && el.getClientRects().length);
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (!modal.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  }, true);
}

function closeActiveStreams() {
  if (activeIapStream) activeIapStream.close();
  activeIapStream = null;
}

function configureStorePresentation(store) {
  const isGoogle = store === 'google';
  const iapTitle = $('iap-title');
  const iapSubtitle = $('iap-subtitle');
  const iapSourceNote = $('iap-source-note');
  const iapLabel = document.querySelector('.iap-label');

  $('us-price-label').textContent = isGoogle ? '미국 Google Play' : '미국 App Store';
  $('app-store-link').textContent = isGoogle ? 'Google Play에서 보기 ↗' : 'App Store에서 보기 ↗';

  if (iapTitle) iapTitle.textContent = isGoogle ? 'Google Play 인앱결제 최저가/최고가 비교' : '인앱결제 가격 비교';
  if (iapSubtitle) {
    iapSubtitle.textContent = isGoogle
      ? '공개 페이지가 노출하는 국가별 인앱결제 최저가와 최고가를 나눠 비교합니다.'
      : '동일하게 표기된 구독과 아이템의 국가별 현지 가격 및 환산가를 비교합니다.';
  }
  if (iapSourceNote) {
    iapSourceNote.textContent = isGoogle
      ? 'Google Play는 개별 IAP 상품 목록을 공개하지 않아 공개 페이지의 최저/최고 금액만 사용합니다. 최저가와 최고가는 서로 다른 상품일 수 있습니다.'
      : 'Apple 공개 페이지에는 안정적인 IAP 상품 ID가 없어, 국가별로 동일하게 표기된 항목만 비교합니다. 번역되거나 지역 전용인 항목은 제외될 수 있습니다.';
  }
  if (iapLabel) iapLabel.textContent = '비교할 항목';
}

function updateStoreBadge(store) {
  const badge = $('store-badge');
  if (!badge) return;
  if (!store) {
    badge.classList.add('hidden');
    badge.textContent = '';
    return;
  }
  badge.classList.remove('hidden');
  badge.textContent = store === 'google' ? 'Google Play' : 'App Store';
}

// ─── Fetch Exchange Rates ─────────────────────────────────────────────────────
function isStaticHosting() {
  return window.location.hostname.endsWith('.github.io') || window.location.protocol === 'file:';
}

async function fetchExchangeRates(forceRefresh = false, signal) {
  const token = ++ratesRequestToken;
  const urls = isStaticHosting() ? [] : [`/api/rates${forceRefresh ? '?refresh=1' : ''}`];
  urls.push('https://open.er-api.com/v6/latest/USD');
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: requestSignal(signal, 12000), cache: forceRefresh ? 'no-store' : 'default' });
      if (!res.ok) throw new Error('환율 조회 실패');
      const data = await res.json();
      if (!data.rates || (data.result && data.result !== 'success')) throw new Error('잘못된 환율 응답');
      const rates = Object.fromEntries(Object.entries(data.rates).filter(([, v]) => Number.isFinite(v) && v > 0));
      if (token === ratesRequestToken && !signal?.aborted) exchangeRates = { ...rates, USD: 1 };
      return;
    } catch { if (signal?.aborted) return; }
  }
  if (token === ratesRequestToken) exchangeRates = { USD: 1 };
}

function requestSignal(signal, timeout) {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
}

function fetchJSONP(url, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('취소됨', 'AbortError'));
    const callback = 'itunes_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      script.remove();
      delete window[callback];
    };
    const finish = (error, data) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error); else resolve(data);
    };
    const abort = () => finish(new DOMException('취소됨', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('응답 시간 초과')), 10000);
    window[callback] = data => finish(null, data);
    script.onerror = () => finish(new Error('조회 실패'));
    signal?.addEventListener('abort', abort, { once: true });
    script.src = `${url}&callback=${callback}`;
    document.head.appendChild(script);
  });
}

async function fetchITunesJSONP(appId, country, signal) {
  const data = await fetchJSONP(`https://itunes.apple.com/lookup?id=${encodeURIComponent(appId)}&country=${country}`, signal);
  return data?.resultCount > 0 ? data.results?.[0] || null : null;
}

async function searchAppsByName(query, signal) {
  const q = query.trim();
  if (q.length < 2) return [];
  if (!isStaticHosting()) {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: requestSignal(signal, 18000) });
      if (!res.ok) throw new Error('검색 실패');
      const data = await res.json();
      if (!Array.isArray(data.results)) throw new Error('검색 응답 오류');
      return data.results;
    } catch (error) { if (signal?.aborted) throw error; }
  }
  const countries = /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(q) ? ['kr', 'us'] : ['us', 'kr'];
  for (const country of countries) {
    const data = await fetchJSONP(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&country=${country}&entity=software&limit=12`, signal);
    if (data.results?.length) return data.results;
  }
  return [];
}

async function fetchStorefrontHtml(url, signal) {
  const encoded = encodeURIComponent(url);
  for (const proxy of [`https://api.allorigins.win/raw?url=${encoded}`, `https://corsproxy.io/?url=${encoded}`]) {
    if (signal?.aborted) throw new DOMException('취소됨', 'AbortError');
    try {
      const res = await fetch(proxy, { signal: requestSignal(signal, 25000) });
      if (res.ok) return await res.text();
    } catch (error) { if (signal?.aborted) throw error; }
  }
  throw new Error('공개 페이지 조회 실패');
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

  // Add to recent searches. The store comes from the resolved app URL
  // (currentStore), never from UI tab state.
  addRecentSearch(currentAppId, currentStore, bestItem.appName);
}

// ─── Deduplication Helper ───────────────────────────────────────────────────
function getUniqueCountries(dataArr) {
  const map = new Map();
  dataArr.forEach(item => {
    if (item.country) {
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
  $('us-price').textContent = '—';
  $('app-store-link').href = currentStore === 'google' ? `https://play.google.com/store/apps/details?id=${encodeURIComponent(currentAppId)}` : `https://apps.apple.com/app/id${currentAppId}`;
  if (usItem) {
    const usVal = toBaseVal(usItem.price, usItem.currency, 'us');
    $('us-price').textContent = usItem.price === 0 ? '무료' : (usItem.formattedPrice || fmtBaseVal(usVal));
    $('app-store-link').href = currentStore === 'google'
      ? `https://play.google.com/store/apps/details?id=${encodeURIComponent(currentAppId)}&gl=us&hl=en`
      : `https://apps.apple.com/us/app/id${currentAppId}`;
  }

  const comparableItems = availableItems
    .map(i => ({ ...i, val: toBaseVal(i.price, i.currency, i.country) }))
    .filter(i => Number.isFinite(i.val))
    .sort((a, b) => a.val - b.val);

  if (comparableItems.length > 0) {
    const cheapest = comparableItems[0];
    const priciest = comparableItems[comparableItems.length - 1];
    const avg = comparableItems.reduce((s, i) => s + i.val, 0) / comparableItems.length;

    $('cheapest-price').textContent = fmtBaseVal(cheapest.val);
    $('cheapest-country').textContent = `${cheapest.flag} ${cheapest.countryName}`;
    $('expensive-price').textContent = fmtBaseVal(priciest.val);
    $('expensive-country').textContent = `${priciest.flag} ${priciest.countryName}`;
    $('avg-price').textContent = fmtBaseVal(avg);
  } else {
    // No comparable values is not evidence of a free app.
    $('cheapest-price').textContent = '환산 불가';
    $('cheapest-country').textContent = '확인된 가격 없음';
    $('expensive-price').textContent = '환산 불가';
    $('expensive-country').textContent = '확인된 가격 없음';
    $('avg-price').textContent = '환산 불가';
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
  const usVal = usItem ? usItem.val : null;

  if (paidItems.length > 0) {
    show('insight-best-deal');
    show('insight-savings');
    show('insight-sweet-spot');

    const cheapest = paidItems[0];
    const priciest = paidItems[paidItems.length - 1];

    // Best deal country
    const diffPct = usVal > 0 ? (((cheapest.val - usVal) / usVal) * 100).toFixed(1) : 0;
    $('insight-best-country').textContent = `${cheapest.flag} ${cheapest.countryName}`;
    $('insight-best-saving').textContent = usVal > 0 ? `${fmtBaseVal(cheapest.val)} (${diffPct > 0 ? '+' : ''}${diffPct}%)` : `${fmtBaseVal(cheapest.val)} · 미국 기준가 없음`;

    // Max savings vs US
    const savedVal = usVal === null ? null : Math.max(0, usVal - cheapest.val);
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
    $('insight-free-detail').textContent = '가격이 확인된 국가에서 무료로 제공 중';
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
    const notAvailLabel = item.fetchStatus === 'request-failed' ? '조회 실패' : '미지원';
    const notAvailBadge = item.fetchStatus === 'request-failed' ? 'diff-badge fetch-failed' : 'diff-badge unavailable';

    tr.innerHTML = `
      <td class="col-rank">${idx + 1}</td>
      <td class="col-country">
        <span class="flag">${item.flag}</span>
        <span class="country-name">${escHtml(item.countryName)}</span>
        <span class="country-code">${item.country.toUpperCase()}</span>
        ${noteHtml}
      </td>
      <td class="col-local">${item.available ? fmtLocal(item.price, item.currency, item.formattedPrice) : `<span class="unavailable-label">${notAvailLabel}</span>`}</td>
      <td class="col-usd">${item.available ? (item.price === 0 ? '<span class="free-badge">무료</span>' : escHtml(fmtBaseVal(item.val))) : '—'}</td>
      <td class="col-diff">
        ${!item.available
          ? `<span class="${notAvailBadge}">${notAvailLabel}</span>`
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

function getIapUsValue() {
  const iap = iapsByCountry.us?.find(item => iapKey(item) === selectedIapTrackName);
  return iap ? toBaseVal(iap.price, iap.currency, 'us', iapCurrentBaseCurrency) : null;
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

function renderIapSummary(finished = false) {
  const statuses = Object.values(iapStatuses);
  const failed = statuses.filter(s => s === 'request-failed').length;
  let reference = iapsByCountry.us?.length ? iapsByCountry.us : Object.values(iapsByCountry).find(items => items.length);
  if (currentStore === 'google') {
    const tracks = new Map();
    for (const items of [iapsByCountry.us || [], ...Object.values(iapsByCountry)]) {
      for (const item of items) if (!tracks.has(iapKey(item))) tracks.set(iapKey(item), item);
    }
    reference = ['google_play_min', 'google_play_max'].map(key => tracks.get(key)).filter(Boolean);
  }
  show('iap-section');
  if (reference?.length) {
    populateIapSelect(reference);
    renderIapTable();
  } else {
    $('iap-select').disabled = true;
    $('iap-select').innerHTML = '<option value="">확인된 인앱결제 항목 없음</option>';
    $('iap-tbody').innerHTML = `<tr><td colspan="5" class="table-placeholder">${failed ? '일부 국가를 조회하지 못했습니다. 다시 조회해 주세요.' : '확인된 공개 페이지에 인앱결제 가격이 없습니다.'}</td></tr>`;
  }
  setIapStatus(`IAP ${finished ? '조회 완료' : '확인 중'} · ${statuses.length}개국 확인 · 실패 ${failed}${reference ? '' : ' · 확인된 가격 없음'}`, finished);
  if ($('retry-iap-btn')) $('retry-iap-btn').disabled = !finished || failed === 0;
}

async function loadIapData(appId, forceRefresh = false, token = currentSearchToken, signal = searchController?.signal, codes = null) {
  if (token !== currentSearchToken || signal?.aborted) return;
  show('iap-section');
  $('iap-loading').classList.remove('hidden');
  setIapStatus('인앱결제 공개 가격을 확인하는 중…');
  if (isStaticHosting()) return loadIapDataClientSide(appId, token, signal, codes);
  const params = new URLSearchParams();
  if (forceRefresh) params.set('refresh', '1');
  if (codes?.length) params.set('countries', codes.join(','));
  const expected = codes || APP_STORE_COUNTRIES.map(c => c.code);
  await new Promise(resolve => {
    const es = new EventSource(`/api/iap-stream/${appId}?${params}`);
    activeIapStream = es;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      es.close();
      signal?.removeEventListener('abort', finish);
      if (activeIapStream === es) activeIapStream = null;
      if (token === currentSearchToken && !signal?.aborted) {
        for (const code of expected) if (!iapStatuses[code]) iapStatuses[code] = 'request-failed';
        renderIapSummary(true);
      }
      resolve();
    };
    const deadline = setTimeout(finish, 180000);
    signal?.addEventListener('abort', finish, { once: true });
    es.onmessage = event => {
      if (token !== currentSearchToken || signal?.aborted) return finish();
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'done' || data.type === 'error') return finish();
      if (data.country && data.type === 'data') {
        iapsByCountry[data.country] = data.iaps || [];
        iapStatuses[data.country] = data.fetchStatus || (data.iaps?.length ? 'ok' : 'empty');
        renderIapSummary();
      }
    };
    es.onerror = finish;
  });
}

async function loadIapDataClientSide(appId, token = currentSearchToken, signal = searchController?.signal, codes = null) {
  const supported = ['us', 'kr', 'jp', 'gb', 'de', 'fr', 'ca', 'au', 'hu', 'pk', 'es', 'it', 'pl', 'cz', 'cn', 'tw', 'br', 'in'];
  const countries = codes ? supported.filter(c => codes.includes(c)) : supported;
  await limitedParallel(countries.map(country => async () => {
    if (signal?.aborted) return;
    let items = [], status = 'empty';
    try {
      const app = await fetchITunesJSONP(appId, country, signal);
      const countryInfo = APP_STORE_COUNTRIES.find(c => c.code === country);
      if (!app || !applePriceRow(app, countryInfo).available) status = 'unavailable';
      else if (!app.currency) status = 'request-failed';
      else {
        const html = await fetchStorefrontHtml(`https://apps.apple.com/${country}/app/id${appId}`, signal);
        const seen = new Map();
        items = extractIapPairsClient(html).map(([trackName, formattedPrice]) => ({ trackName, formattedPrice,
          price: parseLocalizedPriceClient(formattedPrice, app.currency), currency: app.currency }))
          .filter(i => i.price !== null).sort((a, b) => a.price - b.price)
          .map(i => ({ ...i, trackKey: makeIapKeyClient(i.trackName, seen) }));
        status = items.length ? 'ok' : 'empty';
      }
    } catch { status = 'request-failed'; }
    if (token !== currentSearchToken || signal?.aborted) return;
    iapsByCountry[country] = items;
    iapStatuses[country] = status;
    renderIapSummary();
  }), 4);
  if (token === currentSearchToken && !signal?.aborted) renderIapSummary(true);
}

function makeIapKeyClient(name, seenNames) {
  const base = name.toLowerCase().replace(/\s+/g, ' ').trim();
  const occ = (seenNames.get(base) || 0) + 1;
  seenNames.set(base, occ);
  return `${base}__${occ}`;
}

function decodeHtmlClient(value) {
  return String(value)
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:x0*27|39);/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .trim();
}

function extractIapPairsClient(html) {
  const pairs = [];

  // Method 1: Structured "textPairs" JSON arrays from the bootstrap payload.
  // This mirrors the server-side parser and avoids duplicated matches when the
  // expanded items_V3 objects coexist with the presentation divs.
  const textPairsRe = /"textPairs":\s*(\[)/g;
  let tpMatch;
  while ((tpMatch = textPairsRe.exec(html)) !== null) {
    const start = tpMatch.index + tpMatch[0].indexOf('[');
    let depth = 0;
    let i = start;
    for (; i < html.length; i += 1) {
      const ch = html[i];
      if (ch === '\\') { i += 1; continue; }
      if (ch === '[') depth += 1;
      else if (ch === ']') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    try {
      const parsed = JSON.parse(html.slice(start, i + 1));
      for (const entry of parsed) {
        const name = Array.isArray(entry) ? entry[0] : null;
        const price = Array.isArray(entry) ? entry[1] : null;
        if (name && price && /\d/.test(String(price))) pairs.push([name, price]);
      }
    } catch { /* skip malformed array */ }
    if (pairs.length > 0) break;
  }

  if (pairs.length > 0) return pairs;

  // Method 2: Target presentation HTML text-pair divs
  const pairRe = /<div\b[^>]*\btext-pair\b[^>]*>\s*<span\b[^>]*>([\s\S]*?)<\/span>\s*<span\b[^>]*>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = pairRe.exec(html)) !== null) {
    const name = decodeHtmlClient(match[1]);
    const price = decodeHtmlClient(match[2]);
    if (name && price && /\d/.test(price)) {
      pairs.push([name, price]);
    }
  }

  if (pairs.length > 0) return pairs;

  // Method 3: Bootstrap JSON items_V3 fallback
  const v3Re = /"leadingText":"((?:\\.|[^"\\])*)","trailingText":"((?:\\.|[^"\\])*)"/g;
  while ((match = v3Re.exec(html)) !== null) {
    try {
      const name = JSON.parse(`"${match[1]}"`);
      const price = JSON.parse(`"${match[2]}"`);
      if (name && price && /\d/.test(price)) {
        pairs.push([name, price]);
      }
    } catch { /* ignore malformed */ }
  }

  return pairs;
}

function parseLocalizedPriceClient(formattedPrice, currency) {
  if (!formattedPrice || !currency) return null;

  const rawPrice = String(formattedPrice);
  const indonesianCompact = rawPrice.match(/([\d][\d\s.,'’]*)\s*(ribu|juta)\b/i);
  if (currency === 'IDR' && indonesianCompact) {
    const compactNumber = indonesianCompact[1].replace(/[\s'’]/g, '');
    const separatorIndex = Math.max(compactNumber.lastIndexOf(','), compactNumber.lastIndexOf('.'));
    const amount = separatorIndex === -1
      ? Number(compactNumber)
      : Number(`${compactNumber.slice(0, separatorIndex).replace(/[.,]/g, '')}.${compactNumber.slice(separatorIndex + 1)}`);
    const multiplier = indonesianCompact[2].toLocaleLowerCase('id-ID') === 'juta'
      ? 1_000_000
      : 1_000;
    return Number.isFinite(amount) ? amount * multiplier : null;
  }

  const compactMultiplier = /(?:juta|million|millionen)/i.test(rawPrice)
    ? 1_000_000
    : /(?:ribu|thousand|tausend)/i.test(rawPrice)
      ? 1_000
      : 1;
  const numeric = rawPrice
    .replace(/\u00a0|\u202f/g, ' ')
    .match(/[\d][\d\s.,'’]*/)?.[0]
    ?.replace(/[\s'’]/g, '');

  if (!numeric) return null;

  if (/\.\d{2}$/.test(numeric)) {
    const lastDot = numeric.lastIndexOf('.');
    const whole = numeric.slice(0, lastDot).replace(/[.,]/g, '');
    const dec = numeric.slice(lastDot + 1);
    const parsed = Number(`${whole}.${dec}`);
    if (Number.isFinite(parsed)) return parsed * compactMultiplier;
  } else if (/,\d{2}$/.test(numeric)) {
    const lastComma = numeric.lastIndexOf(',');
    const whole = numeric.slice(0, lastComma).replace(/[.,]/g, '');
    const dec = numeric.slice(lastComma + 1);
    const parsed = Number(`${whole}.${dec}`);
    if (Number.isFinite(parsed)) return parsed * compactMultiplier;
  }

  let fractionDigits = 2;
  try {
    fractionDigits = new Intl.NumberFormat('en-US', { style: 'currency', currency })
      .resolvedOptions().maximumFractionDigits;
  } catch { /* default to 2 */ }

  if (fractionDigits === 0) {
    const parsed = Number(numeric.replace(/[.,]/g, ''));
    return Number.isFinite(parsed) ? parsed * compactMultiplier : null;
  }

  const separators = numeric.match(/[.,]/g) || [];
  if (separators.length === 0) {
    const parsed = Number(numeric);
    return Number.isFinite(parsed) ? parsed * compactMultiplier : null;
  }

  const lastSeparatorIndex = Math.max(numeric.lastIndexOf('.'), numeric.lastIndexOf(','));
  const decimalPart = numeric.slice(lastSeparatorIndex + 1);
  const separator = numeric[lastSeparatorIndex];
  const groups = numeric.split(separator);
  const canBeDecimal = decimalPart.length > 0 && decimalPart.length <= fractionDigits;
  const isThreeDigitDecimal = fractionDigits === 3 && decimalPart.length === 3 && groups.length === 2 && groups[0].length <= 3;

  if (canBeDecimal || isThreeDigitDecimal) {
    const whole = numeric.slice(0, lastSeparatorIndex).replace(/[.,]/g, '');
    const parsed = Number(`${whole}.${decimalPart}`);
    return Number.isFinite(parsed) ? parsed * compactMultiplier : null;
  }

  const parsed = Number(numeric.replace(/[.,]/g, ''));
  return Number.isFinite(parsed) ? parsed * compactMultiplier : null;
}

function parseIapMinMaxClient(iapRangeStr, currency) {
  if (!iapRangeStr) return null;
  const str = String(iapRangeStr).trim();
  const matches = str.match(/[\d][\d\s.,'’]*/g);
  if (!matches || matches.length === 0) return null;

  const cleanNums = matches
    .map((match) => parseLocalizedPriceClient(match, currency))
    .filter((amount) => Number.isFinite(amount) && amount > 0);

  if (cleanNums.length === 0) return null;
  if (cleanNums.length === 1) return { min: cleanNums[0], max: cleanNums[0] };
  return { min: Math.min(...cleanNums), max: Math.max(...cleanNums) };
}

// Mirror of server.buildGooglePlayIaps: the public page only exposes one
// "per item" range, so emit separate min/max tracks that the IAP diff,
// filters, and sorting can operate on again.
function buildGooglePlayIapsClient(iapRange, minMax, currency) {
  if (!minMax) return [];

  const parts = String(iapRange || '')
    .split(/\s*[-\u2013\u2014]\s*/)
    .map((p) => p.replace(/\s*(?:per item|per unit|항목당|pro Artikel|par article|por item|por artículo)\s*$/i, '').trim())
    .filter(Boolean);
  const minStr = parts[0] || `${currency} ${minMax.min}`;
  const maxStr = parts.length > 1 ? parts[parts.length - 1] : minStr;

  if (minMax.min === minMax.max || parts.length <= 1) {
    return [{
      trackKey: 'google_play_min',
      trackName: '인앱결제 최저가',
      price: minMax.min,
      currency,
      formattedPrice: minStr
    }];
  }

  return [
    {
      trackKey: 'google_play_min',
      trackName: '인앱결제 최저가',
      price: minMax.min,
      currency,
      formattedPrice: minStr
    },
    {
      trackKey: 'google_play_max',
      trackName: '인앱결제 최고가',
      price: minMax.max,
      currency,
      formattedPrice: maxStr
    }
  ];
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
    const country = APP_STORE_COUNTRIES.find(c => c.code === countryCode);
    const countryInfo = priceData.find(i => i.country === countryCode) || (country ? { country: country.code, countryName: country.name, flag: country.flag, region: country.region } : null);
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
      val: val
    });
  });

  const usVal = getIapUsValue();

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
  let attempts = 0, es = null, timer = null, closed = false;
  const listeners = {};
  const close = () => {
    closed = true;
    clearTimeout(timer);
    if (es) es.close();
  };
  function connect() {
    if (closed) return;
    es = new EventSource(url);
    es.onmessage = event => {
      if (closed) return;
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'done') {
        close();
        listeners.ondone?.(data);
      } else if (data.type === 'error') {
        close();
        listeners.onmessage?.(event);
      } else listeners.onmessage?.(event);
    };
    es.onerror = () => {
      es.close();
      if (closed) return;
      if (attempts++ < maxRetries) {
        listeners.onreconnect?.(attempts);
        timer = setTimeout(connect, retryDelay);
      } else {
        close();
        listeners.onerror?.();
      }
    };
  }
  return {
    onmessage: fn => { listeners.onmessage = fn; },
    ondone: fn => { listeners.ondone = fn; },
    onerror: fn => { listeners.onerror = fn; },
    onreconnect: fn => { listeners.onreconnect = fn; },
    start: connect, close
  };
}

function unavailableRow(country, fetchStatus = 'request-failed') {
  return { country: country.code, countryName: country.name, flag: country.flag, region: country.region,
    available: false, price: null, currency: '', formattedPrice: '', fetchStatus };
}

function upsertCountry(rows, row) {
  const index = rows.findIndex(item => item.country === row.country);
  if (index < 0) rows.push(row); else rows[index] = row;
}

function updateScanProgress() {
  const rows = priceData.filter(row => scanCountryCodes.includes(row.country));
  const failed = rows.filter(row => row.fetchStatus === 'request-failed').length;
  const success = rows.filter(row => row.available !== false).length;
  const unavailable = rows.length - failed - success;
  const total = scanCountryCodes.length;
  const percent = total ? Math.round(rows.length / total * 100) : 0;
  $('loaded-count').textContent = rows.length;
  $('progress-fill').style.width = `${percent}%`;
  const progress = $('scan-progress');
  if (progress) progress.value = percent;
  if ($('scan-status')) $('scan-status').textContent = `${scanFinished ? '조회 완료' : '조회 중'} · ${rows.length}/${total}개국 · 확인 ${success} · 미판매/미지원 ${unavailable} · 실패 ${failed}`;
  if ($('retry-failed-btn')) $('retry-failed-btn').disabled = !scanFinished || failed === 0;
}

function acceptPriceRow(row, token) {
  if (token !== currentSearchToken || !row.country) return;
  upsertCountry(priceData, row);
  if (currentStore === 'google') {
    iapsByCountry[row.country] = row.iaps || [];
    iapStatuses[row.country] = row.fetchStatus === 'request-failed' ? 'request-failed' : (row.iaps?.length ? 'ok' : 'empty');
  }
  updateScanProgress();
  hide('loading-section');
  show('results-section');
  updateStats();
  renderTable();
  if (selectedIapTrackName) renderIapTable();
}

function collectPriceStream(url, signal, onRow, onNotice = () => {}) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return resolve({ cancelled: true });
    const stream = createResilientSSE(url);
    let settled = false;
    const finish = (error, data) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      signal.removeEventListener('abort', abort);
      stream.close();
      if (error) reject(error); else resolve(data);
    };
    const abort = () => finish(null, { cancelled: true });
    const deadline = setTimeout(() => finish(null, { partial: true }), 180000);
    signal.addEventListener('abort', abort, { once: true });
    stream.onmessage(event => {
      const data = JSON.parse(event.data);
      if (data.type === 'error') finish(new Error(data.message || '조회 실패'));
      else if (data.type === 'notice') onNotice(data.message);
      else if (data.country) onRow(data);
    });
    stream.ondone(data => finish(null, data));
    stream.onerror(() => finish(null, { partial: true }));
    stream.onreconnect(() => onNotice('연결이 끊겨 다시 연결하는 중입니다.'));
    stream.start();
  });
}

async function searchApp(target) {
  target = typeof target === 'object' ? target : { appId: String(target) };
  const appId = String(target.appId || '');
  const store = target.store || 'apple';
  if (!(store === 'google' ? /^[a-zA-Z][\w]*(?:\.[\w]+)+$/ : /^\d{6,12}$/).test(appId)) {
    showToast('올바른 앱 URL 또는 ID를 입력해 주세요.');
    return [];
  }
  const retry = Array.isArray(target.retryCountries) && currentAppId === appId && currentStore === store;
  const token = ++currentSearchToken;
  nameController?.abort();
  nameRequestToken++;
  searchController?.abort();
  compareController?.abort();
  compareRequestToken++;
  resetComparison();
  closeActiveStreams();
  searchController = new AbortController();
  const signal = searchController.signal;
  currentAppId = appId;
  currentStore = store;
  currentHintCountry = target.hintCountry || null;
  const codes = isStaticHosting() && store === 'google' ? GOOGLE_CLIENT_COUNTRY_CODES : APP_STORE_COUNTRIES.map(c => c.code);
  scanCountryCodes = codes;
  const requested = retry ? target.retryCountries.filter(c => codes.includes(c)) : codes;
  scanFinished = false;
  if (!retry) {
    priceData = [];
    iapsByCountry = {};
    iapStatuses = {};
    selectedIapTrackName = '';
    currentAppIsFree = false;
    countrySearchQuery = '';
    currentRegion = 'all';
    currentTierFilter = 'all';
    $('country-search').value = '';
    $('app-name').textContent = '조회 중…';
    $('app-developer').textContent = '';
    $('app-icon').removeAttribute('src');
    hide('results-section');
    document.querySelectorAll('.region-tab').forEach(t => t.classList.toggle('active', t.dataset.region === 'all'));
    document.querySelectorAll('.tier-chip').forEach(t => t.classList.toggle('active', t.dataset.tier === 'all'));
  }
  configureStorePresentation(store);
  updateStoreBadge(store);
  hide('error-section');
  hide('iap-section');
  show('loading-section');
  $('search-btn').disabled = true;
  $('search-btn').querySelector('.btn-label').textContent = '조회 중…';
  $('loading-status').textContent = `${store === 'google' ? 'Google Play' : 'App Store'} ${codes.length}개국 가격 확인 중…`;
  if ($('scan-notice')) $('scan-notice').textContent = isStaticHosting()
    ? `공개 페이지로 ${codes.length}개국을 조회합니다. 일부 국가의 응답이 제한될 수 있습니다.`
    : (store === 'google' ? 'Google Play 판매 여부는 공개 페이지 기준 추정치입니다.' : '');
  updateScanProgress();
  try {
    await fetchExchangeRates(Boolean(target.forceRefresh), signal);
    if (signal.aborted) return [];
    if (store === 'apple') {
      const iapRetry = retry ? codes.filter(code => requested.includes(code) || !iapStatuses[code] || iapStatuses[code] === 'request-failed') : null;
      loadIapData(appId, Boolean(target.forceRefresh), token, signal, iapRetry);
    }
    if (isStaticHosting()) {
      if (store === 'google') await searchGooglePlayClientSide(appId, token, signal, requested);
      else await searchAppClientSide(appId, currentHintCountry, token, signal, requested);
    } else {
      const params = new URLSearchParams();
      if (target.forceRefresh || retry) params.set('refresh', '1');
      if (currentHintCountry) params.set('hintCountry', currentHintCountry);
      if (retry) params.set('countries', requested.join(','));
      const route = store === 'google' ? 'google-prices-stream' : 'prices-stream';
      await collectPriceStream(`/api/${route}/${appId}?${params}`, signal,
        row => acceptPriceRow(row, token), message => {
          if (token === currentSearchToken && $('scan-notice')) $('scan-notice').textContent = message;
        });
    }
    if (signal.aborted || token !== currentSearchToken) return [];
    for (const code of requested) {
      if (!priceData.some(row => row.country === code)) acceptPriceRow(unavailableRow(APP_STORE_COUNTRIES.find(c => c.code === code)), token);
    }
    if (!priceData.some(row => row.available !== false)) {
      const failed = priceData.some(row => row.fetchStatus === 'request-failed');
      const error = new Error(failed
        ? '가격을 확인한 국가가 없습니다. 실패 국가를 다시 조회하거나 앱 URL 또는 ID를 확인해 주세요.'
        : '이 앱은 조회한 국가에서 제공되지 않습니다. 앱 URL 또는 ID를 확인해 주세요.');
      error.title = failed ? '가격 조회에 실패했습니다' : '앱을 찾을 수 없습니다';
      throw error;
    }
    if (store === 'google') renderIapSummary(true);
    recordCurrentPriceHistory(appId, store);
    return priceData;
  } catch (error) {
    if (signal.aborted || token !== currentSearchToken) return [];
    $('error-title').textContent = error.title || '가격 조회를 완료하지 못했습니다';
    $('error-msg').textContent = error.message;
    if (!priceData.some(row => row.available !== false)) $('app-name').textContent = $('error-title').textContent;
    show('error-section');
    return [];
  } finally {
    if (token === currentSearchToken) {
      scanFinished = true;
      hide('loading-section');
      updateScanProgress();
      if (priceData.some(row => row.available !== false || row.fetchStatus === 'request-failed')) {
        updateStats(); renderTable(); if (selectedIapTrackName) renderIapTable(); show('results-section');
      } else {
        hide('results-section');
        hide('iap-section');
      }
      $('search-btn').disabled = false;
      $('search-btn').querySelector('.btn-label').textContent = '조회하기';
    }
  }
}

// ─── Client-side Google Play Scanner (GitHub Pages Mode) ─────────────────────
const GOOGLE_CLIENT_COUNTRY_CODES = [
  'us', 'ca', 'mx', 'br', 'gb', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'se',
  'jp', 'kr', 'tw', 'hk', 'sg', 'in', 'th', 'id', 'ph', 'vn', 'au', 'nz',
  'ae', 'sa', 'za', 'ng', 'eg', 'tr'
];

function parseGooglePlayPageClient(html, country) {
  const priceMeta = html.match(/<meta itemprop="price" content="([^"]+)"/);
  const titleMatch = html.match(/<h1[^>]*><span[^>]*>(.*?)<\/span>/);
  const devMatch = html.match(/\/store\/apps\/(?:developer|dev)\?id=[^"]*"><span>(.*?)<\/span>/);
  const iconMatch = html.match(/src="(https:\/\/play-lh\.googleusercontent\.com\/[^"]+)"/);
  const priceCurrencyMatch = html.match(/"priceCurrency":"([A-Z]{3})"/);
  const currency = priceCurrencyMatch ? priceCurrencyMatch[1] : (COUNTRY_CURRENCIES[country.code] || 'USD');
  const priceStr = priceMeta ? priceMeta[1] : null;

  // Same availability heuristic as the server: countries without a real
  // storefront return a stripped USD fallback page with no price meta.
  const hasPerItemOffers = /per item|per unit|항목당|pro Artikel|par article|por item|por artículo/i.test(html);
  const realStorefront = priceMeta !== null && (currency !== 'USD' || country.code === 'us' || hasPerItemOffers);

  if (!titleMatch || !realStorefront) {
    return {
      country: country.code,
      countryName: country.name,
      flag: country.flag,
      region: country.region,
      available: false,
      price: null,
      currency: '',
      formattedPrice: '',
      fetchStatus: realStorefront ? 'no-title' : 'no-storefront',
      iaps: []
    };
  }

  // Own per-item range only: skip related-app offer blocks (they carry an
  // offerId link) before and after the app title.
  const perItemRe = /"((?:[\$₩€₹£¥R\$Rs\.A-Z0-9\xa0\s.,]+(?:\s*[-\u2013\u2014]\s*[\$₩€₹£¥R\$Rs\.A-Z0-9\xa0\s.,]+)?)\s*(?:per item|per unit|항목당|pro Artikel|par article|por item|por artículo))"/gi;
  let iapRange = null;
  const titlePos = html.indexOf(titleMatch[0]);
  let perItemMatch;
  while ((perItemMatch = perItemRe.exec(html)) !== null) {
    if (perItemMatch.index <= titlePos) continue;
    const before = html.slice(Math.max(0, perItemMatch.index - 350), perItemMatch.index);
    if (/offerId/i.test(before)) continue;
    iapRange = perItemMatch[1];
    break;
  }

  const price = parseLocalizedPriceClient(priceStr, currency);
  const minMax = parseIapMinMaxClient(iapRange, currency);
  const iaps = buildGooglePlayIapsClient(iapRange, minMax, currency);

  return {
    country: country.code,
    countryName: country.name,
    flag: country.flag,
    region: country.region,
    available: true,
    price,
    currency,
    formattedPrice: priceStr || (price === 0 ? 'Free' : ''),
    iapRange: iapRange || null,
    iaps,
    appName: titleMatch[1],
    artworkUrl: iconMatch ? iconMatch[1] : '',
    developer: devMatch ? devMatch[1] : 'Developer',
    rating: null,
    ratingCount: 0,
    primaryGenreName: 'Google Play',
    isFree: price === 0,
    store: 'google'
  };
}

async function searchGooglePlayClientSide(packageId, token = currentSearchToken, signal = searchController?.signal, codes = GOOGLE_CLIENT_COUNTRY_CODES) {
  const countries = APP_STORE_COUNTRIES.filter(c => codes.includes(c.code));
  await limitedParallel(countries.map(country => async () => {
    if (signal?.aborted) return;
    let row;
    try {
      const html = await fetchStorefrontHtml(`https://play.google.com/store/apps/details?id=${encodeURIComponent(packageId)}&gl=${country.code}&hl=en`, signal);
      row = parseGooglePlayPageClient(html, country);
    } catch { row = unavailableRow(country); }
    if (!signal?.aborted) acceptPriceRow(row, token);
  }), 4);
}

function applePriceRow(app, country) {
  if (!app) return unavailableRow(country, 'unavailable');
  const storefront = app.trackViewUrl?.match(/apps\.apple\.com\/([a-z]{2})\//i)?.[1]?.toLowerCase();
  if (storefront && storefront !== country.code) return unavailableRow(country, 'unavailable');
  return { country: country.code, countryName: country.name, flag: country.flag, region: country.region,
    available: true, price: app.price, currency: app.currency, formattedPrice: app.formattedPrice,
    appName: app.trackName, artworkUrl: app.artworkUrl100 || '', developer: app.artistName,
    rating: app.averageUserRating || null, ratingCount: app.userRatingCount || 0,
    primaryGenreName: app.primaryGenreName || '', description: (app.description || '').slice(0, 200), isFree: app.price === 0 };
}

async function searchAppClientSide(appId, hintCountry, token = currentSearchToken, signal = searchController?.signal, codes = APP_STORE_COUNTRIES.map(c => c.code)) {
  await limitedParallel(APP_STORE_COUNTRIES.filter(c => codes.includes(c.code)).map(country => async () => {
    if (signal?.aborted) return;
    let row;
    try { row = applePriceRow(await fetchITunesJSONP(appId, country.code, signal), country); }
    catch { row = unavailableRow(country); }
    if (!signal?.aborted) acceptPriceRow(row, token);
  }), 8);
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

function resetComparison() {
  comparePriceData = [];
  compareAppName = '';
  hide('compare-status');
  hide('compare-section');
  $('compare-search-input').value = '';
  $('compare-tbody').innerHTML = '<tr><td colspan="6" class="table-placeholder">비교할 앱을 입력해 주세요.</td></tr>';
  $('compare-status-text').textContent = '';
  const appALabel = document.querySelector('#compare-table .compare-app-a');
  const appBLabel = document.querySelector('#compare-table .compare-app-b');
  if (appALabel) appALabel.textContent = '앱 A';
  if (appBLabel) appBLabel.textContent = '앱 B';
}

async function runCompareSearch() {
  const parsed = parseAppStoreUrl($('compare-search-input')?.value);
  if (!parsed) { showToast('올바른 URL 또는 앱 ID를 입력해 주세요.'); return; }
  compareController?.abort();
  compareController = new AbortController();
  const signal = compareController.signal;
  const token = ++compareRequestToken;
  const mainToken = currentSearchToken;
  const rows = [];
  comparePriceData = [];
  show('compare-status');
  $('compare-status-text').textContent = '비교할 앱 가격을 수집하는 중…';
  try {
    if (isStaticHosting()) rows.push(...await collectCompareDataClientSide(parsed.appId, parsed.store, signal));
    else {
      const route = parsed.store === 'google' ? 'google-prices-stream' : 'prices-stream';
      await collectPriceStream(`/api/${route}/${parsed.appId}`, signal, row => {
        if (!signal.aborted) upsertCountry(rows, row);
      });
    }
    if (signal.aborted || token !== compareRequestToken || mainToken !== currentSearchToken) return;
    comparePriceData = rows;
    renderCompareTable();
  } catch {
    if (!signal.aborted) showToast('비교 앱 조회에 실패했습니다. 다시 시도해 주세요.');
  } finally {
    if (token === compareRequestToken) hide('compare-status');
  }
}

async function collectCompareDataClientSide(appId, store, signal) {
  const codes = store === 'google' ? GOOGLE_CLIENT_COUNTRY_CODES : ['us', 'kr', 'jp', 'gb', 'de', 'fr', 'ca', 'au'];
  const rows = [];
  await limitedParallel(APP_STORE_COUNTRIES.filter(c => codes.includes(c.code)).map(country => async () => {
    if (signal?.aborted) return;
    let row;
    try {
      if (store === 'google') {
        const html = await fetchStorefrontHtml(`https://play.google.com/store/apps/details?id=${appId}&gl=${country.code}&hl=en`, signal);
        row = parseGooglePlayPageClient(html, country);
      } else row = applePriceRow(await fetchITunesJSONP(appId, country.code, signal), country);
    } catch { row = unavailableRow(country); }
    if (!signal?.aborted) upsertCountry(rows, row);
  }), 4);
  return rows;
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
    if (Number.isFinite(valA) && Number.isFinite(valB)) {
      if (valA > 0) diff = ((valB - valA) / valA) * 100;
      if (valA < valB) { winner = 'a'; aWins++; }
      else if (valB < valA) { winner = 'b'; bWins++; }
      else { ties++; }
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
  if (statusText) {
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
      csvField(item.country.toUpperCase()),
      csvField(item.countryName),
      csvField(item.region || ''),
      csvField(localFormatted),
      csvField(item.currency),
      csvField(baseFormatted),
      csvField(diff)
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
  URL.revokeObjectURL(url);
  showToast('📥 CSV 파일이 성공적으로 다운로드되었습니다.');
}

function csvField(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function iapCsvRows() {
  if (!selectedIapTrackName) return [];

  let rows = [];
  Object.entries(iapsByCountry).forEach(([countryCode, iaps]) => {
    const iap = iaps.find(i => iapKey(i) === selectedIapTrackName);
    if (!iap) return;
    const country = APP_STORE_COUNTRIES.find(c => c.code === countryCode);
    const countryInfo = priceData.find(i => i.country === countryCode) || (country ? { country: country.code, countryName: country.name, flag: country.flag, region: country.region } : null);
    if (!countryInfo) return;

    if (iapCurrentRegion !== 'all' && countryInfo.region !== iapCurrentRegion) return;

    const q = iapCountrySearchQuery.toLowerCase();
    if (q) {
      const matchName = countryInfo.countryName.toLowerCase().includes(q);
      const matchCode = countryInfo.country.toLowerCase().includes(q);
      if (!matchName && !matchCode) return;
    }

    rows.push({
      country: countryCode,
      countryName: countryInfo.countryName,
      region: countryInfo.region || '',
      price: iap.price,
      currency: iap.currency,
      formattedPrice: iap.formattedPrice,
      val: toBaseVal(iap.price, iap.currency, countryCode, iapCurrentBaseCurrency)
    });
  });

  const usVal = getIapUsValue();

  return rows
    .sort((a, b) => (a.val ?? Infinity) - (b.val ?? Infinity))
    .map(r => {
      const diff = (usVal !== null && usVal > 0 && r.val !== null && r.val > 0)
        ? (((r.val - usVal) / usVal) * 100).toFixed(1) + '%'
        : 'N/A';
      return {
        ...r,
        localFormatted: r.formattedPrice || `${r.currency} ${r.price}`,
        baseFormatted: r.val !== null ? r.val.toFixed(2) : 'N/A',
        diff
      };
    });
}

function exportIapCSV() {
  const items = iapCsvRows();
  if (items.length === 0) {
    showToast('내보낼 IAP 데이터가 없습니다.');
    return;
  }

  const appName = (currentAppId || 'app_iaps').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
  const trackSlug = (selectedIapTrackName || 'iap').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');

  let csvContent = '\uFEFF';
  csvContent += `순위,국가코드,국가명,지역,현지 가격,현지 통화,${iapCurrentBaseCurrency},미국 대비(%)\n`;
  items.forEach((item, idx) => {
    csvContent += [
      csvField(idx + 1),
      csvField(item.country.toUpperCase()),
      csvField(item.countryName),
      csvField(item.region),
      csvField(item.localFormatted),
      csvField(item.currency),
      csvField(item.baseFormatted),
      csvField(item.diff)
    ].join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${appName}_${trackSlug}_iaps.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
  const comparableItems = availableItems.slice().sort((a, b) => a.val - b.val);
  const cheapest = comparableItems[0];
  const priciest = comparableItems[comparableItems.length - 1];
  const avgVal = comparableItems.reduce((sum, item) => sum + item.val, 0) / comparableItems.length;
  const usItem = availableItems.find(i => i.country === 'us');
  const usVal = usItem ? usItem.val : null;

  // Create Canvas (1200 x 675)
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  // Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 1200, 720);
  bgGrad.addColorStop(0, '#070a19');
  bgGrad.addColorStop(0.5, '#0e142e');
  bgGrad.addColorStop(1, '#131a3a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 720);

  // Border & Accent Glow
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 1160, 680);

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
  ctx.fillText('🏆 TOP 5 최저가 국가', 60, 405);

  const top5 = paidItems.slice(0, 5);
  top5.forEach((item, idx) => {
    const itemY = 440 + idx * 38;
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

  // Price Range Bar (between stat boxes and TOP 5 list)
  const barY = 362;
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
      ctx.roundRect(60, 600, 1080, 28, 8);
      ctx.fill();
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText(`💡 미국에서 ${cheapest.flag} ${cheapest.countryName}(으)로 구매하면 ${savingPct}% 절약 (${fmtBaseVal(usVal - cheapest.val)} 절약)`, 80, 618);
    }
  }

  // Footer Watermark
  ctx.fillStyle = '#64748b';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText('Generated by https://haha5039.github.io/AppPriceCheck/', 60, 668);

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
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.filter(item => item && typeof item === 'object') : [];
  } catch { return []; }
}

// Pure helpers so the renderer and tests share one implementation.
function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60 * 1000) return '방금 전';
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + '분 전';
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + '시간 전';
  return Math.floor(diff / 86400000) + '일 전';
}

function samePriceHistoryScope(entry, other) {
  return entry?.schemaVersion === 2 && other?.schemaVersion === 2 &&
    typeof entry.coverage === 'string' && entry.coverage.length > 0 && entry.coverage === other.coverage &&
    entry.appId === other.appId && entry.store === other.store && entry.currency === other.currency && entry.ppp === other.ppp;
}

function annotatePriceHistory(history) {
  const sorted = Array.isArray(history) ? history.filter(Boolean).slice().sort((a, b) => b.timestamp - a.timestamp) : [];
  return sorted.map((entry, index) => {
    const previous = sorted.slice(index + 1).find(other => samePriceHistoryScope(entry, other));
    const change = previous && Number.isFinite(entry.cheapestPrice) && Number.isFinite(previous.cheapestPrice)
      ? entry.cheapestPrice - previous.cheapestPrice : null;
    return { ...entry, change };
  });
}

function fmtHistoryPrice(value) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '무료';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Pure: cheapest-price series for the same app+store, oldest -> newest.
function buildPriceTrendSeries(history, entry) {
  if (!Array.isArray(history) || entry?.schemaVersion !== 2) return [];
  return history.filter(h => samePriceHistoryScope(entry, h) && h.timestamp <= entry.timestamp && Number.isFinite(h.cheapestPrice))
    .sort((a, b) => a.timestamp - b.timestamp).map(h => h.cheapestPrice);
}

// Pure: SVG polyline path for the series scaled into a w x h box.
function sparklinePath(points, w, h, pad = 2) {
  if (!Array.isArray(points) || points.length < 2) return '';
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;
  return points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * usableW;
    const y = pad + usableH - ((p - min) / span) * usableH;
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
}

function savePriceHistoryEntry(appId, store, appName, icon, cheapestPrice, cheapestCountry, avgPrice, currency, ppp = isPppMode, coverage = '') {
  if (!Number.isFinite(cheapestPrice) || !Number.isFinite(avgPrice) || !coverage) return;
  const history = getPriceHistory();
  const now = Date.now();
  const scope = { schemaVersion: 2, appId, store, currency, ppp, coverage };
  const recent = history.find(h => samePriceHistoryScope(scope, h) && now - h.timestamp < 5 * 60 * 1000);
  if (recent && recent.cheapestPrice === cheapestPrice && recent.avgPrice === avgPrice) return;
  history.unshift({ ...scope, appName, icon: icon || '', timestamp: now, cheapestPrice, cheapestCountry, avgPrice });
  try { localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ENTRIES))); } catch { /* storage unavailable */ }
}

function recordCurrentPriceHistory(appId, store) {
  const countries = getUniqueCountries(priceData);
  if (countries.some(row => row.fetchStatus === 'request-failed') ||
    scanCountryCodes.some(code => !countries.some(row => row.country === code))) return;
  const rows = countries.filter(i => i.available !== false).map(i => ({ ...i, val: toBaseVal(i.price, i.currency, i.country) }));
  // A missing country or conversion can hide the actual cheapest price.
  if (!rows.length || rows.some(row => !Number.isFinite(row.val))) return;
  rows.sort((a, b) => a.val - b.val);
  const coverage = rows.map(row => row.country).sort().join(',');
  const best = priceData.find(i => i.appName);
  savePriceHistoryEntry(appId, store, best?.appName, best?.artworkUrl, rows[0].val, rows[0].countryName,
    rows.reduce((sum, row) => sum + row.val, 0) / rows.length, currentBaseCurrency, isPppMode, coverage);
  renderPriceHistoryBadge();
  renderPriceHistory();
}

function getLastCheckedTime(appId) {
  const history = getPriceHistory();
  const entry = history.find(h => h.appId === appId);
  if (!entry) return null;
  return formatRelativeTime(entry.timestamp);
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

function renderPriceHistory() {
  const section = $('history-section');
  const list = $('history-list');
  const emptyBox = $('history-empty');
  const clearBtn = $('history-clear-btn');
  if (!section || !list) return;

  const history = getPriceHistory();
  if (history.length === 0) {
    // First-time visitors get a visible (empty) panel so the feature is
    // discoverable instead of dead markup that can never render.
    show('history-section');
    if (emptyBox) emptyBox.classList.remove('hidden');
    list.innerHTML = '';
    if (clearBtn) clearBtn.disabled = true;
    return;
  }

  show('history-section');
  if (emptyBox) emptyBox.classList.add('hidden');
  if (clearBtn) clearBtn.disabled = false;

  const entries = annotatePriceHistory(history);
  list.innerHTML = entries.map((entry) => {
    const isGoogle = entry.store === 'google';
    const trend = buildPriceTrendSeries(entries, entry);
    const sparkSvg = trend.length >= 2
      ? `<svg class="history-spark" width="72" height="26" viewBox="0 0 72 26" aria-hidden="true" title="최저가 추이"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="${sparklinePath(trend, 72, 26)}"/></svg>`
      : '';
    const changeHtml = entry.change === null ? ''
      : entry.change < 0
        ? `<span class="history-change down" title="직전 조회 대비">▼ ${fmtHistoryPrice(Math.abs(entry.change))} 저렴</span>`
        : entry.change > 0
          ? `<span class="history-change up" title="직전 조회 대비">▲ ${fmtHistoryPrice(entry.change)} 비쌈</span>`
          : `<span class="history-change same" title="직전 조회 대비">= 동일</span>`;
    return `
      <button type="button" class="history-row" data-app-id="${escHtml(entry.appId)}" data-store="${isGoogle ? 'google' : 'apple'}">
        <img class="history-icon" src="${escHtml(entry.icon || '')}" alt="" onerror="this.style.display='none'">
        <span class="history-main">
          <span class="history-title-line">
            <span class="history-name">${escHtml(entry.appName || entry.appId)}</span>
            <span class="history-store ${isGoogle ? 'google' : 'apple'}">${isGoogle ? 'Google Play' : 'App Store'}</span>
          </span>
          <span class="history-meta">${formatRelativeTime(entry.timestamp)} · 평균 ${entry.schemaVersion === 2 ? fmtHistoryPrice(entry.avgPrice) + ' ' + escHtml(entry.currency) + (entry.ppp ? ' · PPP' : '') : '이전 기록 · 단위 확인 불가'}</span>
        </span>
        <span class="history-price">
          <span class="history-price-value">${entry.schemaVersion === 2 ? fmtHistoryPrice(entry.cheapestPrice) + ' ' + escHtml(entry.currency) : '—'}</span>
          <span class="history-price-where">최저가 · ${escHtml(entry.cheapestCountry || '—')}</span>
        </span>
        ${sparkSvg}
        ${changeHtml}
      </button>`;
  }).join('');

  list.querySelectorAll('.history-row').forEach((row) => {
    row.addEventListener('click', () => {
      searchApp({ appId: row.dataset.appId, store: row.dataset.store });
      const sectionEl = $('history-section');
      if (sectionEl) sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function clearPriceHistory() {
  try {
    localStorage.removeItem(PRICE_HISTORY_KEY);
  } catch { /* localStorage unavailable */ }
  renderPriceHistory();
  renderPriceHistoryBadge();
  showToast('🧹 조회 이력이 비워졌습니다.');
}

// ─── Theme Toggle System ──────────────────────────────────────────────────────
function initTheme() {
  let savedTheme;
  try { savedTheme = localStorage.getItem('app_theme'); } catch { /* storage unavailable */ }
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
  try { localStorage.setItem('app_theme', isLight ? 'light' : 'dark'); } catch { /* storage unavailable */ }
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
  initModalKeyboard();
  const searchInput = $('search-input');
  const searchBtn   = $('search-btn');

  async function handleSearch() {
    const raw = searchInput.value.trim();
    if (!raw) { searchInput.focus(); return; }
    nameController?.abort();
    nameController = new AbortController();
    const signal = nameController.signal;
    const token = ++nameRequestToken;
    searchBtn.disabled = true;
    searchBtn.querySelector('.btn-label').textContent = '조회 중…';
    try {
      let parsed = parseAppStoreUrl(raw);
      if (!parsed) {
        const results = await searchAppsByName(raw, signal);
        if (token !== nameRequestToken || signal.aborted) return;
        if (results.length) parsed = { appId: String(results[0].trackId), store: 'apple' };
      }
      if (token !== nameRequestToken || signal.aborted) return;
      if (parsed) await searchApp(parsed);
      else showToast('검색 결과가 없습니다. 앱 이름이나 URL을 확인해 주세요.');
    } catch {
      if (!signal.aborted) showToast('검색에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      if (token === nameRequestToken) {
        searchBtn.disabled = false;
        searchBtn.querySelector('.btn-label').textContent = '조회하기';
      }
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
  renderPriceHistory();

  const historyClearBtn = $('history-clear-btn');
  if (historyClearBtn) {
    historyClearBtn.addEventListener('click', clearPriceHistory);
  }

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

  const refreshBtn = $('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      if (!currentAppId) return;
      const label = refreshBtn.lastElementChild;
      refreshBtn.disabled = true;
      if (label) label.textContent = '새로 조회 중…';
      showToast('스토어 가격과 환율 캐시를 우회해 다시 조회합니다.');
      try {
        await searchApp({
          appId: currentAppId,
          store: currentStore,
          hintCountry: currentHintCountry,
          forceRefresh: true
        });
      } catch {
        // The search flow presents its own error state.
      } finally {
        refreshBtn.disabled = false;
        if (label) label.textContent = '새로고침';
      }
    });
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
    th.tabIndex = 0;
    th.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); th.click(); }
    });
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

  const iapCsvBtn = $('iap-csv-btn');
  if (iapCsvBtn) {
    iapCsvBtn.addEventListener('click', exportIapCSV);
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

  const targetRate = toCurr === 'USD' ? 1 : exchangeRates[toCurr];
  if (!Number.isFinite(targetRate) || targetRate <= 0) {
    resultEl.textContent = '환산 불가';
    if (rateInfoEl) rateInfoEl.textContent = '목표 통화 환율을 불러오지 못했습니다.';
    return;
  }
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

  // ─── Store Detection Badge ────────────────────────────────────────────────
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      nameController?.abort();
      nameRequestToken++;
      if (!searchController || scanFinished) { searchBtn.disabled = false; searchBtn.querySelector('.btn-label').textContent = '조회하기'; }
      // Live auto-detect while typing so the user sees which store will be
      // queried before pressing search; no manual store selector needed.
      const parsed = parseAppStoreUrl(searchInput.value);
      updateStoreBadge(parsed ? parsed.store : null);
    });
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
    if (searchModalInput) { searchModalInput.focus(); searchModalInput.select(); }
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

  // Both hosting modes use the same search adapter and stale-result guard.
  let searchModalDebounce = null;
  if (searchModalInput) {
    searchModalInput.addEventListener('input', event => {
      const q = event.target.value.trim();
      clearTimeout(searchModalDebounce);
      nameController?.abort();
      nameController = new AbortController();
      const signal = nameController.signal;
      const token = ++nameRequestToken;
      if (q.length < 2) {
        searchModalResults.textContent = '앱 이름을 두 글자 이상 입력해 주세요.';
        return;
      }
      searchModalResults.textContent = '검색 중…';
      searchModalDebounce = setTimeout(async () => {
        if (signal.aborted || token !== nameRequestToken) return;
        try {
          const results = await searchAppsByName(q, signal);
          if (signal.aborted || token !== nameRequestToken || searchModal.classList.contains('hidden')) return;
          searchModalResults.innerHTML = results.length ? results.map(app => `
            <button type="button" class="search-result-item" data-app-id="${escHtml(String(app.trackId))}">
              <img class="search-result-icon" src="${escHtml(app.artworkUrl100 || app.artworkUrl60 || '')}" alt="">
              <span class="search-result-info"><span class="search-result-name">${escHtml(app.trackName)}</span>
              <span class="search-result-dev">${escHtml(app.artistName || '')} · ${escHtml(app.primaryGenreName || '')}</span></span>
              <span class="search-result-price">${escHtml(app.formattedPrice || (app.price === 0 ? '무료' : '가격 확인 필요'))}</span>
            </button>`).join('') : '<p class="search-modal-hint">검색 결과가 없습니다.</p>';
          searchModalResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
              const appId = item.dataset.appId;
              closeSearchModal();
              searchApp({ appId, store: 'apple' });
            });
          });
        } catch {
          if (!signal.aborted && token === nameRequestToken) searchModalResults.textContent = '검색에 실패했습니다. 다시 시도해 주세요.';
        }
      }, 350);
    });
  }

  $('retry-failed-btn')?.addEventListener('click', () => {
    const retryCountries = priceData.filter(row => row.fetchStatus === 'request-failed').map(row => row.country);
    if (retryCountries.length) searchApp({ appId: currentAppId, store: currentStore, hintCountry: currentHintCountry, forceRefresh: true, retryCountries });
  });
  $('retry-iap-btn')?.addEventListener('click', async () => {
    const codes = Object.keys(iapStatuses).filter(code => iapStatuses[code] === 'request-failed');
    if (!codes.length) return;
    $('retry-iap-btn').disabled = true;
    if (currentStore === 'google') {
      await searchApp({ appId: currentAppId, store: currentStore, forceRefresh: true, retryCountries: codes });
    } else {
      for (const code of codes) delete iapStatuses[code];
      await loadIapData(currentAppId, true, currentSearchToken, searchController?.signal, codes);
    }
  });


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
