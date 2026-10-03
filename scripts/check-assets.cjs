const fs = require('node:fs');
const path = require('node:path');
const files = ['app.js', 'index.html', 'style.css', 'server.js', 'sw.js', 'manifest.json', 'favicon.svg', 'icon.png', 'icon-192.png', 'icon-512.png'];
let failed = false;
for (const file of files) {
  const root = path.join(__dirname, '..', file);
  const copy = path.join(__dirname, '..', 'public', file);
  if (!fs.existsSync(copy) || !fs.readFileSync(root).equals(fs.readFileSync(copy))) {
    console.error(`Static asset differs: ${file}`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
else console.log('Root/public assets match.');
