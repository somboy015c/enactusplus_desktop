// Writes the EnactusNG Plus server address into the app. Runs automatically in GitHub Actions.
import fs from 'node:fs';
const outFile = process.argv[2];
const cfg = JSON.parse(fs.readFileSync('app.config.json', 'utf8'));
const url = (process.env.PLUS_URL || cfg.plusUrl || '').trim().replace(/\/+$/, '').replace(/\/api\/index\.php$/, '');
try { const u = new URL(url); if (u.protocol !== 'https:') throw new Error('must start with https://'); }
catch (e) { console.error(`\n❌ Invalid Plus address "${url}": ${e.message}\n   Edit app.config.json and set "plusUrl" (e.g. https://plus.enactus.org.ng).\n`); process.exit(1); }
fs.writeFileSync(outFile, `window.PLUS_CONFIG = { api: ${JSON.stringify(url + '/api/index.php')} };\n`);
console.log(`✅ Plus server set to ${url}`);
