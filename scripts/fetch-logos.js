// scripts/fetch-logos.js
// One-off helper: resolve Leaguepedia square-logo URLs for MSI 2026 teams.
// Usage: node scripts/fetch-logos.js
// Leaguepedia is rate-limited; rerun on HTTP 429. Output is pasted into src/data.js.
const https = require('https');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const TEAMS = {
  BLG: 'Bilibili Gaming', G2: 'G2 Esports', HLE: 'Hanwha Life Esports',
  LYON: 'Lyon', TSTW: 'team Secret Whales', FURIA: 'FURIA', TES: 'Top Esports',
  KCORP: 'Karmine Corp', T1: 'T1', TL: 'Team Liquid', DCGTW: 'Deep Cross Gaming',
};
function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': UA } }, r => {
      let b = ''; r.on('data', d => (b += d)); r.on('end', () => res(b));
    }).on('error', rej);
  });
}
async function logoFor(name) {
  // 1) cargo query Teams table for the Image filename
  const q = `https://lol.fandom.com/api.php?action=cargoquery&format=json&tables=Teams&fields=Image&where=Name%3D%22${encodeURIComponent(name)}%22&limit=1`;
  const cj = JSON.parse(await get(q));
  const file = cj.cargoquery && cj.cargoquery[0] && cj.cargoquery[0].title.Image;
  if (!file) return null;
  // 2) imageinfo to resolve the file to a URL
  const iq = `https://lol.fandom.com/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=File:${encodeURIComponent(file)}`;
  const ij = JSON.parse(await get(iq));
  const pages = ij.query.pages;
  const p = pages[Object.keys(pages)[0]];
  return p.imageinfo && p.imageinfo[0] && p.imageinfo[0].url;
}
(async () => {
  for (const [short, name] of Object.entries(TEAMS)) {
    try { console.log(short, await logoFor(name)); }
    catch (e) { console.log(short, 'ERROR', e.message); }
    await new Promise(r => setTimeout(r, 1500)); // be gentle with the rate limit
  }
})();
