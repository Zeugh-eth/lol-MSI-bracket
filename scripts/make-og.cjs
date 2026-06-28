// Render scripts/og-template.html to og.png (1200x630) for social previews.
// Usage: node scripts/make-og.cjs   (requires a local playwright install)
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/private/tmp/shotter/node_modules/playwright')); }
(async () => {
  const tpl = 'file://' + path.join(__dirname, 'og-template.html');
  const out = path.join(__dirname, '..', 'og.png');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  await p.goto(tpl, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800); // fonts + logos
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await b.close();
  console.log('wrote', out);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
