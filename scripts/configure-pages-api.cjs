const fs = require('node:fs');
const path = require('node:path');

const api = parseApiUrl();
if (!api || api.protocol !== 'https:' || api.href !== api.origin + '/' ||
    api.username || api.password || /[<>"&]/.test(api.origin)) {
  console.error('Set PAGES_API_BASE_URL to the public HTTPS API origin.');
  process.exit(1);
}

const index = path.join(__dirname, '..', 'public', 'index.html');
const placeholder = '<meta name="appprice-api-base-url" content="">';
const html = fs.readFileSync(index, 'utf8');
if (!html.includes(placeholder)) throw new Error('Missing Pages API configuration placeholder');
fs.writeFileSync(index, html.replace(placeholder, `<meta name="appprice-api-base-url" content="${api.origin}">`));

function parseApiUrl() {
  try { return new URL(process.env.PAGES_API_BASE_URL || ''); }
  catch { return null; }
}
