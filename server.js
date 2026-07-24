const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// ─── Cache ────────────────────────────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, time: Date.now() });
}

// ─── Country List ─────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Concurrency-limited parallel execution */
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

/** Fetch iTunes lookup for one country */
async function iTunesLookup(appId, country) {
  const cacheKey = `itunes_${appId}_${country}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `https://itunes.apple.com/lookup?id=${appId}&country=${country}`;
  const res = await axios.get(url, {
    timeout: 10000,
    decompress: true,
    headers: { 'User-Agent': 'Mozilla/5.0 AppPriceCheck/1.0', 'Accept-Encoding': 'gzip, deflate' },
  });
  setCache(cacheKey, res.data);
  return res.data;
}

function decodeHtml(value) {
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

function currencyFractionDigits(currency) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency })
      .resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

/** Convert an App Store formatted price to a number using its ISO currency. */
function parseLocalizedPrice(formattedPrice, currency) {
  if (!formattedPrice || !currency) return null;

  const rawPrice = String(formattedPrice);
  const indonesianCompact = rawPrice.match(/([\d][\d\s.,'’]*)\s*(ribu|juta)\b/i);
  if (currency === 'IDR' && indonesianCompact) {
    // Indonesian App Store abbreviates rupiah: ribu = 1,000 and juta =
    // 1,000,000. In “Rp 1,889juta”, the comma is decimal (1.889 million),
    // not a group separator; treating it as 1,889 million creates a 1,000×
    // overstatement.
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

  // A few storefronts compact large values in their own language, e.g.
  // “Rp 75ribu” and “Rp 1,889juta”. Preserve the magnitude before parsing.
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

  // If the numeric string explicitly ends with a 2-digit decimal suffix (e.g. .00 or ,00),
  // parse it as decimal regardless of the currency's default locale fraction digits.
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

  const fractionDigits = currencyFractionDigits(currency);
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

function isAvailableInStorefront(app, countryCode) {
  // A lookup must point to the requested storefront as well as return an app.
  // This protects against any API fallback to a different country's listing.
  try {
    const [, storefront] = new URL(app.trackViewUrl).pathname.match(/^\/([a-z]{2})\//i) || [];
    return storefront?.toLowerCase() === countryCode.toLowerCase();
  } catch {
    return false;
  }
}

function makeIapKey(name, seenNames) {
  const base = name.toLocaleLowerCase('en-US').replace(/\s+/g, ' ').trim();
  const occurrence = (seenNames.get(base) || 0) + 1;
  seenNames.set(base, occurrence);
  return `${base}__${occurrence}`;
}

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

function extractIapPairs(html) {
  const pairs = [];

  // Method 1: Target presentation HTML text-pair divs
  const pairRe = /<div\b[^>]*\btext-pair\b[^>]*>\s*<span\b[^>]*>([\s\S]*?)<\/span>\s*<span\b[^>]*>([\s\S]*?)<\/span>/gi;
  let match;
  while ((match = pairRe.exec(html)) !== null) {
    const name = decodeHtml(match[1]);
    const price = decodeHtml(match[2]);
    if (name && price && /\d/.test(price)) {
      pairs.push([name, price]);
    }
  }

  if (pairs.length > 0) return pairs;

  // Method 2: Bootstrap JSON textPairs / items_V3 fallback
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

/**
 * Scrape IAP prices from the App Store web page for one country.
 * Returns an array of { trackKey, trackName, price, currency, formattedPrice }
 */
async function scrapeIap(appId, country, currency) {
  const finalCurrency = currency || COUNTRY_CURRENCIES[country.toLowerCase()] || 'USD';
  const url = `https://apps.apple.com/${country}/app/id${appId}`;
  const res = await axios.get(url, {
    timeout: 12000,
    decompress: true,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  const html = res.data;
  if (typeof html !== 'string') return [];

  const seenNames = new Map();
  return extractIapPairs(html)
    .filter(([name, price]) => name && price && /\d/.test(price))
    .map(([trackName, formattedPrice]) => ({
      trackKey: makeIapKey(trackName, seenNames),
      trackName,
      price: parseLocalizedPrice(formattedPrice, finalCurrency),
      currency: finalCurrency,
      formattedPrice,
    }))
    .filter((iap) => iap.price !== null);
}



// ─── Routes ───────────────────────────────────────────────────────────────────

/** Exchange rates (base USD) */
app.get('/api/rates', async (req, res) => {
  const cached = getCached('rates');
  if (cached) return res.json(cached);

  try {
    // This source covers the currencies used by all supported storefronts;
    // an ECB-only feed leaves much of the global comparison as N/A.
    const response = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 10000 });
    if (response.data.result !== 'success' || !response.data.rates) throw new Error('Invalid exchange-rate response');
    const data = {
      rates: { ...response.data.rates, USD: 1 },
      date: response.data.time_last_update_utc,
      provider: 'ExchangeRate-API',
    };
    setCache('rates', data);
    res.json(data);
  } catch (e) {
    // A smaller ECB fallback is still preferable to breaking all USD comparison.
    try {
      const fallback = await axios.get('https://api.frankfurter.dev/v1/latest?base=USD', { timeout: 10000 });
      const data = { rates: { ...fallback.data.rates, USD: 1 }, date: fallback.data.date, provider: 'Frankfurter (ECB)' };
      setCache('rates', data);
      res.json(data);
    } catch (fallbackError) {
      res.status(500).json({ error: 'Failed to fetch exchange rates', details: fallbackError.message });
    }
  }
});

/** Supported countries list */
app.get('/api/countries', (req, res) => {
  res.json(APP_STORE_COUNTRIES);
});

/**
 * SSE: stream app prices for all countries as they arrive.
 * Sends JSON objects line by line via text/event-stream.
 * Terminal event: { type: 'done', total }  or  { type: 'error', message }
 */
app.get('/api/prices-stream/:appId', async (req, res) => {
  const { appId } = req.params;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  // Return from cache immediately if available
  const cacheKey = `prices_v2_${appId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    for (const item of cached) send(item);
    send({ type: 'done', total: cached.length, fromCache: true });
    return res.end();
  }

  // Verify the app exists across hintCountry, US, or major regional storefronts
  let appMeta = null;
  const hintCountry = (req.query.hintCountry || '').toLowerCase();
  const lookupCandidates = Array.from(new Set([
    hintCountry, 'us', 'hu', 'kr', 'jp', 'gb', 'de', 'fr', 'cn', 'ca', 'au', 'br', 'in', 'es', 'it', 'pl', 'cz', 'at'
  ].filter(Boolean)));

  for (const c of lookupCandidates) {
    try {
      const data = await iTunesLookup(appId, c);
      if (data.resultCount > 0) {
        appMeta = data.results[0];
        break;
      }
    } catch { /* try next candidate */ }
  }

  if (!appMeta) {
    send({ type: 'error', message: 'App not found. Please check the App Store URL or ID.' });
    return res.end();
  }

  const allResults = [];

  const tasks = APP_STORE_COUNTRIES.map((country) => async () => {
    if (res.writableEnded) return;
    try {
      const data = await iTunesLookup(appId, country.code);
      if (!data.resultCount || !isAvailableInStorefront(data.results[0], country.code)) {
        const unavailable = {
          country: country.code,
          countryName: country.name,
          flag: country.flag,
          region: country.region,
          available: false,
          price: null,
          currency: '',
          formattedPrice: '',
        };
        allResults.push(unavailable);
        send(unavailable);
        return;
      }
      const app = data.results[0];
      const result = {
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
        artworkUrl512: (app.artworkUrl512 || app.artworkUrl100 || '').replace('100x100', '512x512'),
        developer: app.artistName,
        rating: app.averageUserRating || null,
        ratingCount: app.userRatingCount || 0,
        primaryGenreName: app.primaryGenreName || '',
        isFree: app.price === 0,
        releaseDate: app.releaseDate || '',
      };
      allResults.push(result);
      send(result);
    } catch { /* skip unavailable countries silently */ }
  });

  await limitedParallel(tasks, 10);

  setCache(cacheKey, allResults);
  send({ type: 'done', total: allResults.length });
  res.end();
});

/**
 * SSE: stream IAP prices as each store is processed.
 * Apple does not expose IAPs in the iTunes Lookup API, so these values are read
 * from the public App Store product page. Sending incremental results makes the
 * comparison usable immediately instead of waiting for every storefront.
 */
app.get('/api/iap-stream/:appId', async (req, res) => {
  const { appId } = req.params;
  if (!/^\d{6,12}$/.test(appId)) return res.status(400).json({ error: 'Invalid App Store ID' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (payload) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const cacheKey = `iap_v2_${appId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    for (const item of cached) send({ type: 'data', ...item });
    send({ type: 'done', total: cached.length, completed: APP_STORE_COUNTRIES.length, fromCache: true });
    return res.end();
  }

  const results = [];
  let completed = 0;

  const fetchCountryIaps = async (country) => {
    if (res.writableEnded) return;
    try {
      // The lookup value provides the ISO currency needed to convert a localized
      // display string such as “₩29,000” or “R$ 19,90” into a numeric amount.
      const lookup = await iTunesLookup(appId, country.code);
      const currency = lookup.results?.[0]?.currency;
      if (!currency) return;

      const iaps = await scrapeIap(appId, country.code, currency);
      if (iaps.length > 0) {
        const result = { country: country.code, iaps };
        results.push(result);
        send({ type: 'data', ...result });
      }
    } catch {
      // An app can legitimately be unavailable in a storefront. Keep the stream
      // alive for the remaining countries rather than failing the whole request.
    } finally {
      completed += 1;
      send({ type: 'progress', completed, total: APP_STORE_COUNTRIES.length });
    }
  };

  // Fetch the US listing first so the selector gets a stable reference item.
  const us = APP_STORE_COUNTRIES.find((country) => country.code === 'us');
  const remainingCountries = APP_STORE_COUNTRIES.filter((country) => country.code !== 'us');
  if (us) await fetchCountryIaps(us);

  // The public storefront serves these pages quickly; 10 concurrent requests
  // keeps total time low while avoiding a burst across all countries at once.
  await limitedParallel(remainingCountries.map((country) => () => fetchCountryIaps(country)), 10);

  setCache(cacheKey, results);
  send({ type: 'done', total: results.length, completed });
  res.end();
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  AppPriceCheck running at http://localhost:${PORT}\n`);
});
