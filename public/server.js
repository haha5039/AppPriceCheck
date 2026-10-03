const express = require('express');
const axios = require('axios');
const http = require('http');
const https = require('https');
const path = require('path');
const { AsyncLocalStorage } = require('node:async_hooks');
const requestContext = new AsyncLocalStorage();

const app = express();
const PORT = process.env.PORT || 3000;

// Keep-alive sockets cut down on connection churn; Google Play resets idle
// connections aggressively, which was one source of run-to-run failures.
const axiosInstance = axios.create({
  httpAgent: new http.Agent({ keepAlive: true, maxSockets: 24 }),
  httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 24 }),
});

app.use(express.static(__dirname));

// ─── Cache ────────────────────────────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_ENTRIES = 1000; // Cap cache size to avoid unbounded heap growth

function getCached(key, forceRefresh = false) {
  if (forceRefresh) {
    cache.delete(key);
    return null;
  }
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time < CACHE_TTL) return entry.data;
  // Expired: delete immediately to reclaim memory
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  if (requestContext.getStore()?.signal.aborted) return;
  // If cache exceeds limit, remove oldest inserted entries
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { data, time: Date.now() });
}

// Clean up expired cache entries periodically every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.time >= CACHE_TTL) cache.delete(key);
  }
}, 5 * 60 * 1000).unref();

// ─── Rate Limiter ────────────────────────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // max requests per window per IP

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return next();
  }

  record.count++;
  if (record.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  next();
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap) {
    if (now - record.start > RATE_LIMIT_WINDOW * 2) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000).unref();

app.use('/api', rateLimit);

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
    while (index < tasks.length && !requestContext.getStore()?.signal.aborted) {
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

function shouldForceRefresh(value) {
  return value === '1' || value === 'true';
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Request cancelled'));
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    const abort = () => { clearTimeout(timer); reject(new Error('Request cancelled')); };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

/**
 * Fetch with retries for transient storefront failures (timeouts, resets,
 * 429/5xx). Timeouts and connection resets are the main reason Google Play
 * results flipped between runs, so they are always retried with backoff.
 */
async function getWithRetry(url, options, attempts = 3) {
  const signal = options.signal || requestContext.getStore()?.signal;
  options = { ...options, signal };
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await axiosInstance.get(url, options);
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      const status = error.response?.status;
      const code = error.code;
      const retryable = !status || status === 429 || status >= 500 ||
        code === 'ECONNRESET' || code === 'ECONNABORTED' ||
        code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'EAI_AGAIN';
      if (!retryable || attempt === attempts - 1) throw error;

      let delay = 400 * Math.pow(2, attempt) + Math.random() * 300;
      if (status === 429 && error.response?.headers?.['retry-after']) {
        const retryAfter = parseInt(error.response.headers['retry-after'], 10);
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          delay = Math.max(delay, retryAfter * 1000);
        }
      }
      await wait(Math.min(delay, 10000), signal);
    }
  }
  throw lastError;
}

/** Fetch iTunes lookup for one country */
async function iTunesLookup(appId, country, forceRefresh = false) {
  const cacheKey = `itunes_${appId}_${country}`;
  const cached = getCached(cacheKey, forceRefresh);
  if (cached) return cached;

  const url = `https://itunes.apple.com/lookup?id=${appId}&country=${country}`;
  const res = await getWithRetry(url, {
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

function parseIapMinMax(iapRangeStr, currency) {
  if (!iapRangeStr) return null;
  const str = String(iapRangeStr).trim();
  const matches = str.match(/[\d][\d\s.,'’]*/g);
  if (!matches || matches.length === 0) return null;

  // Use the same locale-aware parser used by both storefronts. The old parser
  // treated every separator as a grouping separator in several currencies.
  const cleanNums = matches
    .map((match) => parseLocalizedPrice(match, currency))
    .filter((amount) => Number.isFinite(amount) && amount > 0);

  if (cleanNums.length === 0) return null;
  if (cleanNums.length === 1) return { min: cleanNums[0], max: cleanNums[0] };
  return { min: Math.min(...cleanNums), max: Math.max(...cleanNums) };
}

/**
 * Google Play's public page exposes one "per item" price range, not SKU-level
 * records. Split it back into separate min/max entries so the existing IAP
 * diff and filter logic applies to each edge. Formatting keeps the original
 * currency symbol from the page ("₩999 - ₩74,000 per item" -> two entries).
 */
function buildGooglePlayIaps(iapRange, minMax, currency) {
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

function isAvailableInStorefront(app, countryCode) {
  if (!app) return false;
  if (app.price === undefined || app.price === null) return false;
  if (app.trackViewUrl) {
    try {
      const match = new URL(app.trackViewUrl).pathname.match(/^\/([a-z]{2})\//i);
      if (match) {
        return match[1].toLowerCase() === countryCode.toLowerCase();
      }
    } catch { /* ignore URL parse error */ }
  }
  return true;
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

  // Method 1: Structured "textPairs" JSON arrays from the bootstrap payload.
  // This is the canonical source Apple renders the text-pair divs from, and it
  // avoids duplicated matches when the expanded items_V3 objects coexist.
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
    const name = decodeHtml(match[1]);
    const price = decodeHtml(match[2]);
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

/**
 * Scrape IAP prices from the App Store web page for one country.
 * Returns an array of { trackKey, trackName, price, currency, formattedPrice }
 */
async function scrapeIap(appId, country, currency) {
  const finalCurrency = currency || COUNTRY_CURRENCIES[country.toLowerCase()] || 'USD';
  const url = `https://apps.apple.com/${country}/app/id${appId}`;
  const res = await getWithRetry(url, {
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
      trackName,
      formattedPrice,
      price: parseLocalizedPrice(formattedPrice, finalCurrency),
      currency: finalCurrency,
    }))
    .filter((iap) => iap.price !== null)
    // Sort by price so duplicate display names get stable keys across
    // countries: __1 is always the cheaper variant (e.g. two "ChatGPT Plus"
    // entries on Apple's page), which keeps cross-country matching consistent.
    .sort((a, b) => a.price - b.price)
    .map((iap) => ({ ...iap, trackKey: makeIapKey(iap.trackName, seenNames) }));
}



function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve().then(() => handler(req, res)).catch(next);
}

app.use('/api', (req, res, next) => {
  const bad = message => res.status(400).json({ error: message });
  for (const name of ['q', 'hintCountry', 'refresh', 'countries']) {
    if (req.query[name] !== undefined && typeof req.query[name] !== 'string') return bad(`Invalid ${name}`);
  }
  if (req.query.q && req.query.q.length > 200) return bad('Search query is too long');
  if (req.query.refresh !== undefined && !['0', '1', 'true', 'false'].includes(req.query.refresh)) return bad('Invalid refresh');
  const countryCodes = new Set(APP_STORE_COUNTRIES.map(c => c.code));
  if (req.query.hintCountry && !countryCodes.has(req.query.hintCountry.toLowerCase())) return bad('Invalid country');
  const selected = req.query.countries?.split(',');
  if (selected && (!selected.length || selected.some(c => !countryCodes.has(c)))) return bad('Invalid countries');
  req.countries = selected ? APP_STORE_COUNTRIES.filter(c => selected.includes(c.code)) : APP_STORE_COUNTRIES;
  const appleId = req.path.match(/^\/(?:prices-stream|iap-stream)\/([^/]+)$/)?.[1];
  if (appleId && !/^\d{6,12}$/.test(appleId)) return bad('Invalid App Store ID');
  const controller = new AbortController();
  req.signal = controller.signal;
  res.once('close', () => controller.abort());
  requestContext.run({ signal: controller.signal }, next);
});

// ─── Routes ───────────────────────────────────────────────────────────────────

/** Exchange rates (base USD) */
app.get('/api/rates', asyncRoute(async (req, res) => {
  const forceRefresh = shouldForceRefresh(req.query.refresh);
  const cached = getCached('rates', forceRefresh);
  if (cached) return res.json(cached);

  try {
    // This source covers the currencies used by all supported storefronts;
    // an ECB-only feed leaves much of the global comparison as N/A.
    const response = await getWithRetry('https://open.er-api.com/v6/latest/USD', { timeout: 10000 }, 1);
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
      const fallback = await getWithRetry('https://api.frankfurter.dev/v1/latest?base=USD', { timeout: 10000 }, 1);
      const data = { rates: { ...fallback.data.rates, USD: 1 }, date: fallback.data.date, provider: 'Frankfurter (ECB)' };
      setCache('rates', data);
      res.json(data);
    } catch (fallbackError) {
      res.status(500).json({ error: 'Failed to fetch exchange rates', details: fallbackError.message });
    }
  }
}));

/** Supported countries list */
app.get('/api/countries', (req, res) => {
  res.json(APP_STORE_COUNTRIES);
});

/** Cache statistics */
app.get('/api/cache-stats', (req, res) => {
  const now = Date.now();
  let totalEntries = 0;
  let activeEntries = 0;
  let expiredEntries = 0;
  let memoryEstimate = 0;

  cache.forEach((entry, key) => {
    totalEntries++;
    if (now - entry.time < CACHE_TTL) {
      activeEntries++;
      try { memoryEstimate += JSON.stringify(entry.data).length * 2; } catch {}
    } else {
      expiredEntries++;
    }
  });

  res.json({
    totalEntries,
    activeEntries,
    expiredEntries,
    cacheTTLMinutes: CACHE_TTL / 60000,
    memoryEstimateKB: Math.round(memoryEstimate / 1024),
    uptimeSeconds: Math.round(process.uptime())
  });
});



/** Search apps by name via iTunes Search API */
app.get('/api/search', asyncRoute(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  if (q.length < 2) return res.status(400).json({ error: 'Search query must be at least 2 characters' });

  const cacheKey = `search_v2_${q.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const isKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(q);
    const primaryCountry = isKorean ? 'kr' : 'us';
    const secondaryCountry = isKorean ? 'us' : 'kr';

    let response = await getWithRetry('https://itunes.apple.com/search', {
      params: { term: q, country: primaryCountry, entity: 'software', limit: 12 },
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 AppPriceCheck/1.0' },
    });

    if (!response.data.results || response.data.results.length === 0) {
      response = await getWithRetry('https://itunes.apple.com/search', {
        params: { term: q, country: secondaryCountry, entity: 'software', limit: 12 },
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 AppPriceCheck/1.0' },
      });
    }

    const results = (response.data.results || []).map(item => ({
      trackId: item.trackId,
      trackName: item.trackName,
      artistName: item.artistName,
      artworkUrl60: item.artworkUrl60 || '',
      artworkUrl100: item.artworkUrl100 || '',
      formattedPrice: item.formattedPrice || (item.price === 0 ? 'Free' : `$${item.price}`),
      primaryGenreName: item.primaryGenreName || '',
      averageUserRating: item.averageUserRating || null,
      bundleId: item.bundleId || '',
    }));
    const data = { results };
    setCache(cacheKey, data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Search failed', details: e.message });
  }
}));


/**
 * SSE: stream app prices for all countries as they arrive.
 * Sends JSON objects line by line via text/event-stream.
 * Terminal event: { type: 'done', total }  or  { type: 'error', message }
 */
app.get('/api/prices-stream/:appId', asyncRoute(async (req, res) => {
  const countries = req.countries;
  const { appId } = req.params;
  const forceRefresh = shouldForceRefresh(req.query.refresh);

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (obj) => { if (!req.signal.aborted && !res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(obj)}\n\n`); };

  // Return from cache immediately if available
  const cacheKey = `prices_v2_${appId}_${countries.map(c => c.code).join(',')}`;
  const cached = getCached(cacheKey, forceRefresh);
  if (cached) {
    for (const item of cached) send(item);
    send({ type: 'done', total: cached.length, fromCache: true });
    return res.end();
  }

  // Verify the app exists across hintCountry, US, or major regional storefronts
  let appMeta = null;
  const hintCountry = (req.query.hintCountry || '').toLowerCase();
  const lookupCandidates = Array.from(new Set([
    hintCountry, 'kr', 'us', 'jp', 'gb', 'de', 'fr', 'cn', 'tw', 'ca', 'au', 'br', 'in', 'es', 'it', 'pl', 'cz', 'at', 'hu', 'tr', 'nl', 'se', 'no', 'dk', 'fi', 'sg', 'hk', 'mx', 'th', 'ph', 'id', 'vn', 'ae', 'sa', 'za'
  ].filter(Boolean)));

  for (const c of lookupCandidates) {
    if (req.signal.aborted) return;
    try {
      const data = await iTunesLookup(appId, c, forceRefresh);
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

  const tasks = countries.map((country) => async () => {
    if (req.signal.aborted || res.writableEnded || res.destroyed) return;
    try {
      const data = await iTunesLookup(appId, country.code, forceRefresh);
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
        description: (app.description || '').substring(0, 200),
        isFree: app.price === 0,
        releaseDate: app.releaseDate || '',
      };
      allResults.push(result);
      send(result);
    } catch {
      // A thrown lookup is a transient API failure, not "not available".
      // Emit an explicit row so the country never silently disappears from
      // the table between runs; the UI labels it "조회 실패".
      const unavailable = {
        country: country.code,
        countryName: country.name,
        flag: country.flag,
        region: country.region,
        available: false,
        price: null,
        currency: '',
        formattedPrice: '',
        fetchStatus: 'request-failed'
      };
      allResults.push(unavailable);
      send(unavailable);
    }
  });

  await limitedParallel(tasks, 10);

  if (!req.signal.aborted && !allResults.some(r => r.fetchStatus === 'request-failed')) setCache(cacheKey, allResults);
  send({ type: 'done', total: allResults.length });
  res.end();
}));

/**
 * SSE: stream IAP prices as each store is processed.
 * Apple does not expose IAPs in the iTunes Lookup API, so these values are read
 * from the public App Store product page. Sending incremental results makes the
 * comparison usable immediately instead of waiting for every storefront.
 */
app.get('/api/iap-stream/:appId', asyncRoute(async (req, res) => {
  const countries = req.countries;
  const { appId } = req.params;
  const forceRefresh = shouldForceRefresh(req.query.refresh);
  if (!/^\d{6,12}$/.test(appId)) return res.status(400).json({ error: 'Invalid App Store ID' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (payload) => {
    if (!req.signal.aborted && !res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const cacheKey = `iap_v2_${appId}_${countries.map(c => c.code).join(',')}`;
  const cached = getCached(cacheKey, forceRefresh);
  if (cached) {
    for (const item of cached) send({ type: 'data', ...item });
    send({ type: 'done', total: cached.length, completed: countries.length, failed: 0, fromCache: true });
    return res.end();
  }

  const results = [];
  let completed = 0;

  const fetchCountryIaps = async (country) => {
    if (req.signal.aborted) return;
    let result = { country: country.code, iaps: [], fetchStatus: 'empty' };
    try {
      const lookup = await iTunesLookup(appId, country.code, forceRefresh);
      const item = lookup.results?.[0];
      if (!item || !isAvailableInStorefront(item, country.code)) result.fetchStatus = 'unavailable';
      else if (!item.currency) result.fetchStatus = 'request-failed';
      else {
        result.iaps = await scrapeIap(appId, country.code, item.currency);
        result.fetchStatus = result.iaps.length ? 'ok' : 'empty';
      }
    } catch { result.fetchStatus = 'request-failed'; }
    if (req.signal.aborted) return;
    results.push(result);
    completed++;
    send({ type: 'data', ...result });
    send({ type: 'progress', completed, total: countries.length });
  };

  // Fetch the US listing first so the selector gets a stable reference item.
  const us = countries.find((country) => country.code === 'us');
  const remainingCountries = countries.filter((country) => country.code !== 'us');
  if (us) await fetchCountryIaps(us);

  // The public storefront serves these pages quickly; 10 concurrent requests
  // keeps total time low while avoiding a burst across all countries at once.
  await limitedParallel(remainingCountries.map((country) => () => fetchCountryIaps(country)), 10);

  const failed = results.filter(r => r.fetchStatus === 'request-failed').length;
  if (!req.signal.aborted && failed === 0) setCache(cacheKey, results);
  send({ type: 'done', total: results.length, completed, failed });
  res.end();
}));

// ─── Google Play Stream Route ──────────────────────────────────────────────────
app.get('/api/google-prices-stream/:packageId', asyncRoute(async (req, res) => {
  const countries = req.countries;
  const { packageId } = req.params;
  const forceRefresh = shouldForceRefresh(req.query.refresh);
  if (!packageId || !/^[a-zA-Z][\w]*(?:\.[\w]+)+$/.test(packageId) || packageId.length > 255) {
    return res.status(400).json({ error: 'Invalid Google Play Package ID' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (payload) => {
    if (!req.signal.aborted && !res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const cacheKey = `gplay_stream_${packageId}_${countries.map(c => c.code).join(',')}`;
  const cached = getCached(cacheKey, forceRefresh);
  if (cached) {
    for (const item of cached) send(item);
    send({ type: 'done', total: cached.length });
    return res.end();
  }

  // Send notice that Google Play availability is an estimate derived from the
  // public storefront page; region-locked apps cannot be detected reliably.
  send({ type: 'notice', message: 'Google Play 가용성은 공개 페이지 기준 추정치입니다. 스토어프론트가 없는 국가는 USD 폴백 페이지를 반환하므로 제외 처리했으며, 지역 제한 앱의 실제 이용 가능 여부는 해당 국가의 기기에서 확인이 필요합니다.', noticeType: 'availability' });

  const allResults = [];

  /**
   * Fetch one country's storefront page and turn it into a row. Transient
   * failures throw; callers decide whether to retry or mark the row failed.
   */
  const fetchSingleCountry = async (country, { attempts = 3, timeout = 9000 } = {}) => {
    const url = `https://play.google.com/store/apps/details?id=${packageId}&gl=${country.code}&hl=en`;
    const resp = await getWithRetry(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout
    }, attempts);
    const html = resp.data;
    const priceMeta = html.match(/<meta itemprop="price" content="([^"]+)"/);
    const titleMatch = html.match(/<h1[^>]*><span[^>]*>(.*?)<\/span>/);
    const devMatch = html.match(/\/store\/apps\/(?:developer|dev)\?id=[^"]*"><span>(.*?)<\/span>/);
    const iconMatch = html.match(/src="(https:\/\/play-lh\.googleusercontent\.com\/[^"]+)"/);
    const ratingMatch = html.match(/aria-label="Rated ([0-9.]+) stars out of five/i) || html.match(/([0-9.]+)\s*★/);

    // Use priceCurrency from schema.org JSON-LD — this is the ACTUAL currency
    // Google Play uses for this country (e.g. Cambodia uses USD, not KHR)
    const priceCurrencyMatch = html.match(/"priceCurrency":"([A-Z]{3})"/);
    const currency = priceCurrencyMatch ? priceCurrencyMatch[1] : (COUNTRY_CURRENCIES[country.code] || 'USD');
    const priceStr = priceMeta ? priceMeta[1] : null;

    // Countries without a real storefront get a stripped USD fallback page:
    // no <meta itemprop="price"> (China, Cuba, Iran) or a USD page with no
    // storefront data (Albania, Argentina, ...). Real USD storefronts (US,
    // Ecuador, Cambodia, Gulf states) keep their per-item offers, so combine
    // price-meta presence, currency, and per-item signal into one heuristic.
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
        fetchStatus: realStorefront ? 'no-title' : 'no-storefront'
      };
    }

    // The page embeds other apps' "per item" ranges in related-app offer
    // blocks (each carries an offerId link) both before and after the app
    // title, so a plain first match varies between requests. The app's own
    // summary is the first occurrence after the <h1> title whose preceding
    // context has no offerId. If it is missing, show no range rather than
    // borrowing another app's numbers.
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

    const price = parseLocalizedPrice(priceStr, currency);
    const minMax = parseIapMinMax(iapRange, currency);
    const iaps = buildGooglePlayIaps(iapRange, minMax, currency);

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
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
      ratingCount: 0,
      primaryGenreName: 'Google Play',
      isFree: price === 0,
      store: 'google'
    };
  };

  const failedRow = (country) => ({
    country: country.code,
    countryName: country.name,
    flag: country.flag,
    region: country.region,
    available: false,
    price: null,
    currency: '',
    formattedPrice: '',
    fetchStatus: 'request-failed'
  });

  // Pass 1: fetch every country. Rows that are definitively unavailable
  // (real page, no storefront) are sent immediately; transient failures are
  // held back so they can be retried instead of flipping the result set.
  const pendingRetries = [];
  const tasks = countries.map((country) => async () => {
    if (req.signal.aborted || res.writableEnded || res.destroyed) return;
    try {
      const result = await fetchSingleCountry(country);
      allResults.push(result);
      send(result);
    } catch {
      pendingRetries.push(country);
    }
  });

  // Google Play is more likely to rate-limit bursty anonymous requests than
  // Apple. A smaller worker pool plus retry gives more consistent coverage.
  await limitedParallel(tasks, 6);

  // Pass 2: retry only the countries that failed, with more attempts and a
  // gentler concurrency so a single flaky request cannot change the answer
  // between two runs of the same app.
  if (pendingRetries.length > 0) {
    send({ type: 'notice', message: `${pendingRetries.length}개 국가의 응답이 일시적으로 실패해 재조회 중입니다.`, noticeType: 'retry' });
    const retryTasks = pendingRetries.map((country) => async () => {
      if (req.signal.aborted || res.writableEnded || res.destroyed) return;
      try {
        const result = await fetchSingleCountry(country, { attempts: 4, timeout: 12000 });
        allResults.push(result);
        send(result);
      } catch {
        const unavailable = failedRow(country);
        allResults.push(unavailable);
        send(unavailable);
      }
    });
    await limitedParallel(retryTasks, 3);
  }

  // Only cache fully-successful runs; a run with transient failures should not
  // be replayed as if those countries were genuinely unavailable.
  if (!req.signal.aborted && !allResults.some(r => r.fetchStatus === 'request-failed')) setCache(cacheKey, allResults);
  send({ type: 'done', total: allResults.length });
  res.end();
}));

app.use((error, req, res, next) => {
  if (req.signal?.aborted || res.destroyed) return;
  if (res.headersSent) return res.end();
  res.status(500).json({ error: 'Request failed' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀  AppPriceCheck running at http://localhost:${PORT}\n`);
  });
}

module.exports = { app, parseLocalizedPrice, parseIapMinMax, buildGooglePlayIaps, extractIapPairs };
