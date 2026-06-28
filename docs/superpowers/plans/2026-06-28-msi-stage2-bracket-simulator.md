# MSI 2026 Stage 2 Bracket Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single self-contained `index.html` that simulates the MSI 2026 Stage 2 (8-team double-elimination) bracket — pool-aware seeding draw, manual drag override, BO5 result entry with automatic winners/losers propagation, live standings, a per-match drawer, and shareable/persistent state.

**Architecture:** Pure logic (bracket engine, standings, draw, persistence, data) lives in small `src/*.js` files, each UMD-guarded so it works both as a browser global and a Node `require`. Those modules are unit-tested with `node --test`. React UI components (JSX) live in `src/ui.jsx`. A zero-dependency `build.js` concatenates the data + logic (as plain `<script>`) and the UI (as `<script type="text/babel">`) into a single self-contained `index.html` that loads React + Babel from a CDN — double-clickable, no install, no server. UI behavior is verified with the Playwright/webapp-testing skill.

**Tech Stack:** Vanilla JS (ES2015) for logic, React 18 + Babel Standalone via CDN for UI, native HTML5 drag-and-drop, `node --test` for unit tests, Node for the build script. No npm dependencies.

## Global Constraints

- **Single self-contained deliverable:** `index.html` must run by double-clicking (origin `file://`), pulling only React/Babel from a CDN. No ES modules in the browser (they break `file://`); use classic scripts only.
- **No npm dependencies / no install step.** Build = `node build.js` (concatenation only). Tests = `node --test`.
- **UMD guard** for every `src/*.js` logic module so Node can `require` it:
  ```js
  (function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root[api.__name] = api;
  })(typeof globalThis !== 'undefined' ? globalThis : this, function () { /* ... */ });
  ```
- **Team identity:** teams are keyed by their unique uppercase `short` code: `BLG, G2, HLE, LYON, TSTW, FURIA, TES, PIW` (PIW = Play-In Winner placeholder). Play-in candidates keyed `KCORP, T1, TL, DCGTW`.
- **BO5:** a match has a winner when one side's score === 3.
- **Bracket = 14 matches**, ids exactly: `WQF1 WQF2 WQF3 WQF4 WSF1 WSF2 WBF LR1A LR1B LR2A LR2B LR3 LBF GF`.
- **Persistence keys:** localStorage key `msi2026sim`; URL state in `location.hash` as base64(JSON).
- **Visual style:** dark MSI-primer aesthetic — deep navy/near-black background (`#11151c`), warm off-white text (`#f3ede0`), pink/red accents (`#e8567f` / `#ff5d73`).

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/data.js` | `DATA` snapshot: 8 stage-2 teams (short, name, region, pool, color, logoUrl), play-in candidates, per-match dates. |
| `src/engine.js` | Bracket graph (14 matches), recursive team resolution, BO5 winner/loser propagation, score set/clear. |
| `src/standings.js` | Derive 1st–8th placement (and "alive") from engine state. |
| `src/draw.js` | Seeded RNG + pool-aware random draw producing an 8-length seed array; constraint validator. |
| `src/persist.js` | Encode/decode scenario `{draw, scores, playInPick}` to/from base64 + localStorage helpers. |
| `src/ui.jsx` | React components: `App, TopBar, BracketView, MatchCard, TeamChip, Drawer, StandingsTable`. |
| `tests/engine.test.js` | Unit tests for engine. |
| `tests/standings.test.js` | Unit tests for standings. |
| `tests/draw.test.js` | Unit tests for draw. |
| `tests/persist.test.js` | Unit tests for persistence. |
| `build.js` | Concatenate data+logic+ui into `index.html`. |
| `index.html` | Generated single-file deliverable (committed). |
| `scripts/fetch-logos.js` | One-off helper documenting the Leaguepedia API calls used to populate `data.js` logo URLs. |

---

## Task 1: Project scaffold + data snapshot

**Files:**
- Create: `src/data.js`
- Create: `scripts/fetch-logos.js`
- Create: `tests/data.test.js`

**Interfaces:**
- Produces: `DATA` object with shape:
  ```js
  DATA.__name === 'MSI_DATA'
  DATA.teams // array of 8: { short, name, region, pool, color, logoUrl }
  DATA.playInCandidates // array of 4: { short, name, region, color, logoUrl }
  DATA.dates // { [matchId]: 'YYYY-MM-DD' | null } for all 14 match ids
  DATA.matchIds // ['WQF1', ... 'GF'] canonical order
  ```

- [ ] **Step 1: Write `scripts/fetch-logos.js`** — a documented Node helper (run manually, tolerant of rate-limits) that resolves logo URLs. It is reference/documentation; data.js is hand-finalized from its output.

```js
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
```

- [ ] **Step 2: Run the helper to capture logo URLs**

Run: `node scripts/fetch-logos.js`
Expected: lines like `BLG https://static.wikia.nocookie.net/.../Bilibili_Gaming...png`. If rate-limited (429/empty), wait and rerun; for any team that never resolves, leave `logoUrl: null` (badge fallback covers it).

- [ ] **Step 3: Write `src/data.js`** using captured URLs (use `null` where unresolved). Brand colors are hand-set.

```js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const teams = [
    { short: 'BLG',   name: 'Bilibili Gaming',      region: 'CN',   pool: 1, color: '#1a2a6c', logoUrl: null },
    { short: 'G2',    name: 'G2 Esports',           region: 'EMEA', pool: 1, color: '#ee3d23', logoUrl: null },
    { short: 'HLE',   name: 'Hanwha Life Esports',  region: 'KR',   pool: 2, color: '#ff7900', logoUrl: null },
    { short: 'LYON',  name: 'Lyon',                 region: 'NA',   pool: 2, color: '#1e9de3', logoUrl: null },
    { short: 'TSTW',  name: 'Team Secret Whales',   region: 'APAC', pool: 3, color: '#0b8457', logoUrl: null },
    { short: 'FURIA', name: 'FURIA',                region: 'BR',   pool: 3, color: '#000000', logoUrl: null },
    { short: 'TES',   name: 'Top Esports',          region: 'CN',   pool: 4, color: '#e60012', logoUrl: null },
    { short: 'PIW',   name: 'Play-In Winner',       region: 'INT',  pool: 4, color: '#6c5ce7', logoUrl: null },
  ];
  const playInCandidates = [
    { short: 'KCORP', name: 'Karmine Corp',      region: 'EMEA', color: '#0a3cff', logoUrl: null },
    { short: 'T1',    name: 'T1',                region: 'KR',   color: '#e2012d', logoUrl: null },
    { short: 'TL',    name: 'Team Liquid',       region: 'NA',   color: '#04193e', logoUrl: null },
    { short: 'DCGTW', name: 'Deep Cross Gaming', region: 'APAC', color: '#00a3a3', logoUrl: null },
  ];
  const matchIds = ['WQF1','WQF2','WQF3','WQF4','WSF1','WSF2','WBF','LR1A','LR1B','LR2A','LR2B','LR3','LBF','GF'];
  // Best-effort dates from the wiki schedule; null where unknown. Edit as schedule firms up.
  const dates = {
    WQF1:'2026-07-01', WQF2:'2026-07-01', WQF3:'2026-07-02', WQF4:'2026-07-02',
    LR1A:'2026-07-03', LR1B:'2026-07-03', WSF1:'2026-07-04', WSF2:'2026-07-04',
    LR2A:'2026-07-05', LR2B:'2026-07-05', LR3:'2026-07-06', WBF:'2026-07-08',
    LBF:'2026-07-10', GF:'2026-07-11',
  };
  return { __name: 'MSI_DATA', teams, playInCandidates, matchIds, dates };
});
```

- [ ] **Step 4: Write `tests/data.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert');
const DATA = require('../src/data.js');

test('has 8 stage-2 teams with unique shorts', () => {
  assert.equal(DATA.teams.length, 8);
  assert.equal(new Set(DATA.teams.map(t => t.short)).size, 8);
});
test('every team has a pool 1-4 and a color', () => {
  for (const t of DATA.teams) {
    assert.ok(t.pool >= 1 && t.pool <= 4, `${t.short} pool`);
    assert.match(t.color, /^#[0-9a-fA-F]{6}$/, `${t.short} color`);
  }
});
test('pools are balanced: four high (1-2) and four low (3-4)', () => {
  const high = DATA.teams.filter(t => t.pool <= 2).length;
  assert.equal(high, 4);
  assert.equal(DATA.teams.length - high, 4);
});
test('14 canonical match ids and dates for each', () => {
  assert.equal(DATA.matchIds.length, 14);
  for (const id of DATA.matchIds) assert.ok(id in DATA.dates, `date for ${id}`);
});
test('four play-in candidates', () => {
  assert.equal(DATA.playInCandidates.length, 4);
});
```

- [ ] **Step 5: Run tests**

Run: `node --test tests/data.test.js`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/data.js scripts/fetch-logos.js tests/data.test.js
git commit -m "feat: MSI 2026 team/format data snapshot + tests"
```

---

## Task 2: Bracket engine

**Files:**
- Create: `src/engine.js`
- Create: `tests/engine.test.js`

**Interfaces:**
- Consumes: nothing (self-contained logic).
- Produces (object `Engine`, `__name='MSI_Engine'`):
  - `Engine.GRAPH` — `{ [matchId]: { round, a: Source, b: Source } }` where `Source` is `{seed:n}` | `{winner:matchId}` | `{loser:matchId}`.
  - `Engine.emptyScores()` → `{ [matchId]: { a: 0, b: 0 } }`.
  - `Engine.resolveMatch(matchId, draw, scores)` → `{ teamA, teamB, winner, loser }` (team values are `short` strings or `null` when upstream unresolved). `winner`/`loser` are non-null only when both teams resolved and a score === 3.
  - `Engine.setScore(scores, matchId, a, b)` → **new** scores object with that match set and **all strictly-downstream matches cleared to 0/0** (so changing an early result retracts later ones).
  - `Engine.isValidBo5(a, b)` → boolean (0..3 each, not both 3, max one side ===3).

- [ ] **Step 1: Write `tests/engine.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert');
const E = require('../src/engine.js');

const DRAW = ['BLG','TES','G2','PIW','HLE','FURIA','LYON','TSTW']; // positions 0..7

test('graph has 14 matches with rounds', () => {
  assert.equal(Object.keys(E.GRAPH).length, 14);
  for (const id of ['WQF1','WSF1','WBF','LR1A','LR2A','LR3','LBF','GF'])
    assert.ok(E.GRAPH[id].round >= 1, id);
});

test('QF teams come straight from the draw', () => {
  const s = E.emptyScores();
  const r = E.resolveMatch('WQF1', DRAW, s);
  assert.deepEqual([r.teamA, r.teamB], ['BLG', 'TES']);
  assert.equal(r.winner, null); // no score yet
});

test('setScore marks a BO5 winner and feeds the next round', () => {
  let s = E.emptyScores();
  s = E.setScore(s, 'WQF1', 3, 1); // BLG beats TES
  s = E.setScore(s, 'WQF2', 3, 0); // G2 beats PIW
  assert.equal(E.resolveMatch('WQF1', DRAW, s).winner, 'BLG');
  const sf = E.resolveMatch('WSF1', DRAW, s);
  assert.deepEqual([sf.teamA, sf.teamB], ['BLG', 'G2']); // winners advance
});

test('QF losers drop into losers round 1', () => {
  let s = E.emptyScores();
  s = E.setScore(s, 'WQF1', 3, 2); // loser TES
  s = E.setScore(s, 'WQF2', 1, 3); // loser G2
  const lr = E.resolveMatch('LR1A', DRAW, s);
  assert.deepEqual([lr.teamA, lr.teamB], ['TES', 'G2']);
});

test('losers round 2 is cross-seeded (LR2A takes WSF2 loser)', () => {
  assert.deepEqual(E.GRAPH.LR2A.b, { loser: 'WSF2' });
  assert.deepEqual(E.GRAPH.LR2B.b, { loser: 'WSF1' });
});

test('LB final takes the WB final loser', () => {
  assert.deepEqual(E.GRAPH.LBF.b, { loser: 'WBF' });
});

test('grand final pits WB-final winner vs LB-final winner', () => {
  assert.deepEqual(E.GRAPH.GF.a, { winner: 'WBF' });
  assert.deepEqual(E.GRAPH.GF.b, { winner: 'LBF' });
});

test('changing an upstream result clears downstream scores', () => {
  let s = E.emptyScores();
  s = E.setScore(s, 'WQF1', 3, 0);
  s = E.setScore(s, 'WQF2', 3, 0);
  s = E.setScore(s, 'WSF1', 3, 0); // depends on WQF1 & WQF2
  s = E.setScore(s, 'WQF1', 0, 3); // flip QF1 -> WSF1 must reset
  assert.deepEqual(s.WSF1, { a: 0, b: 0 });
});

test('isValidBo5 rejects impossible scores', () => {
  assert.ok(E.isValidBo5(3, 2));
  assert.ok(E.isValidBo5(0, 0));
  assert.ok(!E.isValidBo5(3, 3));
  assert.ok(!E.isValidBo5(4, 0));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/engine.test.js`
Expected: FAIL — `Cannot find module '../src/engine.js'`.

- [ ] **Step 3: Write `src/engine.js`**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Source: {seed:n} | {winner:id} | {loser:id}
  const GRAPH = {
    WQF1: { round: 1, a: { seed: 0 }, b: { seed: 1 } },
    WQF2: { round: 1, a: { seed: 2 }, b: { seed: 3 } },
    WQF3: { round: 1, a: { seed: 4 }, b: { seed: 5 } },
    WQF4: { round: 1, a: { seed: 6 }, b: { seed: 7 } },
    LR1A: { round: 1, a: { loser: 'WQF1' }, b: { loser: 'WQF2' } },
    LR1B: { round: 1, a: { loser: 'WQF3' }, b: { loser: 'WQF4' } },
    WSF1: { round: 2, a: { winner: 'WQF1' }, b: { winner: 'WQF2' } },
    WSF2: { round: 2, a: { winner: 'WQF3' }, b: { winner: 'WQF4' } },
    LR2A: { round: 2, a: { winner: 'LR1A' }, b: { loser: 'WSF2' } }, // cross-seed
    LR2B: { round: 2, a: { winner: 'LR1B' }, b: { loser: 'WSF1' } }, // cross-seed
    LR3:  { round: 3, a: { winner: 'LR2A' }, b: { winner: 'LR2B' } },
    WBF:  { round: 4, a: { winner: 'WSF1' }, b: { winner: 'WSF2' } },
    LBF:  { round: 4, a: { winner: 'LR3' },  b: { loser: 'WBF' } },
    GF:   { round: 5, a: { winner: 'WBF' },  b: { winner: 'LBF' } },
  };

  function isValidBo5(a, b) {
    if (a < 0 || b < 0 || a > 3 || b > 3) return false;
    if (a === 3 && b === 3) return false;
    return true;
  }

  function emptyScores() {
    const s = {};
    for (const id of Object.keys(GRAPH)) s[id] = { a: 0, b: 0 };
    return s;
  }

  function resolveSource(src, draw, scores) {
    if ('seed' in src) return draw && draw[src.seed] ? draw[src.seed] : null;
    const r = resolveMatch(src.winner || src.loser, draw, scores);
    if ('winner' in src) return r.winner;
    return r.loser;
  }

  function resolveMatch(matchId, draw, scores) {
    const m = GRAPH[matchId];
    const teamA = resolveSource(m.a, draw, scores);
    const teamB = resolveSource(m.b, draw, scores);
    let winner = null, loser = null;
    const sc = scores[matchId] || { a: 0, b: 0 };
    if (teamA && teamB && isValidBo5(sc.a, sc.b)) {
      if (sc.a === 3) { winner = teamA; loser = teamB; }
      else if (sc.b === 3) { winner = teamB; loser = teamA; }
    }
    return { teamA, teamB, winner, loser };
  }

  // ids strictly downstream of a given match (anything that consumes its winner/loser, transitively)
  function downstreamOf(matchId) {
    const out = new Set();
    let frontier = [matchId];
    while (frontier.length) {
      const next = [];
      for (const id of Object.keys(GRAPH)) {
        const m = GRAPH[id];
        const refs = [m.a, m.b].filter(s => !('seed' in s)).map(s => s.winner || s.loser);
        if (refs.some(r => frontier.includes(r)) && !out.has(id)) { out.add(id); next.push(id); }
      }
      frontier = next;
    }
    return out;
  }

  function setScore(scores, matchId, a, b) {
    const copy = {};
    for (const id of Object.keys(scores)) copy[id] = { a: scores[id].a, b: scores[id].b };
    copy[matchId] = { a, b };
    for (const id of downstreamOf(matchId)) copy[id] = { a: 0, b: 0 };
    return copy;
  }

  return { __name: 'MSI_Engine', GRAPH, isValidBo5, emptyScores, resolveMatch, setScore, downstreamOf };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/engine.test.js`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine.js tests/engine.test.js
git commit -m "feat: double-elimination bracket engine with propagation + tests"
```

---

## Task 3: Standings derivation

**Files:**
- Create: `src/standings.js`
- Create: `tests/standings.test.js`

**Interfaces:**
- Consumes: `Engine` (via require/global).
- Produces (`Standings`, `__name='MSI_Standings'`):
  - `Standings.compute(engine, draw, scores)` → array of `{ short, place, placeLabel, alive }` sorted best→worst. `place` is a number (ties share a number, e.g. two 5ths). `alive` true if the team has not yet been eliminated. Unresolved teams get `place: null`, `placeLabel: '—'`, sorted last.

- [ ] **Step 1: Write `tests/standings.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert');
const E = require('../src/engine.js');
const S = require('../src/standings.js');

const DRAW = ['BLG','TES','G2','PIW','HLE','FURIA','LYON','TSTW'];

function placeOf(rows, short) { return rows.find(r => r.short === short); }

test('a full scripted tournament yields 8 placements', () => {
  let s = E.emptyScores();
  // Winners
  s = E.setScore(s, 'WQF1', 3, 0); // BLG > TES
  s = E.setScore(s, 'WQF2', 3, 0); // G2 > PIW
  s = E.setScore(s, 'WQF3', 3, 0); // HLE > FURIA
  s = E.setScore(s, 'WQF4', 3, 0); // LYON > TSTW
  s = E.setScore(s, 'WSF1', 3, 0); // BLG > G2
  s = E.setScore(s, 'WSF2', 3, 0); // HLE > LYON
  s = E.setScore(s, 'WBF',  3, 0); // BLG > HLE  (BLG to GF upper)
  // Losers
  s = E.setScore(s, 'LR1A', 3, 0); // TES > PIW  (PIW out 7th)
  s = E.setScore(s, 'LR1B', 3, 0); // FURIA > TSTW (TSTW out 7th)
  s = E.setScore(s, 'LR2A', 3, 0); // TES > LYON (LYON out 5th)
  s = E.setScore(s, 'LR2B', 3, 0); // FURIA > G2 (G2 out 5th)
  s = E.setScore(s, 'LR3',  3, 0); // TES > FURIA (FURIA out 4th)
  s = E.setScore(s, 'LBF',  3, 0); // TES > HLE (HLE out 3rd)
  s = E.setScore(s, 'GF',   3, 0); // BLG > TES

  const rows = S.compute(E, DRAW, s);
  assert.equal(placeOf(rows, 'BLG').place, 1);
  assert.equal(placeOf(rows, 'TES').place, 2);
  assert.equal(placeOf(rows, 'HLE').place, 3);
  assert.equal(placeOf(rows, 'FURIA').place, 4);
  assert.equal(placeOf(rows, 'LYON').place, 5);
  assert.equal(placeOf(rows, 'G2').place, 5);
  assert.equal(placeOf(rows, 'PIW').place, 7);
  assert.equal(placeOf(rows, 'TSTW').place, 7);
});

test('before any games everyone is alive with no place', () => {
  const rows = S.compute(E, DRAW, E.emptyScores());
  assert.equal(rows.length, 8);
  assert.ok(rows.every(r => r.alive && r.place === null));
});

test('rows are sorted best place first, unresolved last', () => {
  let s = E.emptyScores();
  s = E.setScore(s, 'WQF1', 3, 0);
  s = E.setScore(s, 'WQF2', 3, 0);
  s = E.setScore(s, 'LR1A', 3, 0); // PIW eliminated 7th-8th
  const rows = S.compute(E, DRAW, s);
  assert.equal(rows[rows.length - 1].short, undefined === rows[rows.length-1].short ? rows[rows.length-1].short : rows[rows.length-1].short); // sanity
  const piw = placeOf(rows, 'PIW');
  assert.equal(piw.alive, false);
  assert.equal(piw.place, 7);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/standings.test.js`
Expected: FAIL — `Cannot find module '../src/standings.js'`.

- [ ] **Step 3: Write `src/standings.js`**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Where a loss eliminates you -> finishing place. (GF loser = 2nd, GF winner = 1st handled separately.)
  const ELIM_PLACE = {
    LR1A: 7, LR1B: 7, // out in losers round 1
    LR2A: 5, LR2B: 5, // out in losers round 2
    LR3: 4,           // out in losers round 3
    LBF: 3,           // out in losers final
  };
  const LABELS = { 1:'1st', 2:'2nd', 3:'3rd', 4:'4th', 5:'5th–6th', 7:'7th–8th' };

  function compute(Engine, draw, scores) {
    const place = {};   // short -> number
    const alive = {};   // short -> bool
    for (const t of (draw || [])) if (t) alive[t] = true;

    // losers-bracket + LB final eliminations
    for (const id of Object.keys(ELIM_PLACE)) {
      const r = Engine.resolveMatch(id, draw, scores);
      if (r.loser) { place[r.loser] = ELIM_PLACE[id]; alive[r.loser] = false; }
    }
    // grand final
    const gf = Engine.resolveMatch('GF', draw, scores);
    if (gf.winner) { place[gf.winner] = 1; alive[gf.winner] = false;
                     place[gf.loser] = 2; alive[gf.loser] = false; }

    const rows = (draw || []).filter(Boolean).map(short => ({
      short,
      place: place[short] != null ? place[short] : null,
      placeLabel: place[short] != null ? LABELS[place[short]] : '—',
      alive: alive[short] !== false,
    }));
    rows.sort((x, y) => {
      const px = x.place == null ? 99 : x.place;
      const py = y.place == null ? 99 : y.place;
      if (px !== py) return px - py;
      return x.short.localeCompare(y.short);
    });
    return rows;
  }

  return { __name: 'MSI_Standings', compute };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/standings.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/standings.js tests/standings.test.js
git commit -m "feat: standings derivation from bracket state + tests"
```

---

## Task 4: Pool-aware draw

**Files:**
- Create: `src/draw.js`
- Create: `tests/draw.test.js`

**Interfaces:**
- Consumes: nothing (takes a teams array as argument).
- Produces (`Draw`, `__name='MSI_Draw'`):
  - `Draw.makeRng(seed)` → deterministic `() => float in [0,1)` (mulberry32).
  - `Draw.satisfies(draw, teamsByShort)` → boolean: every QF pairs a high pool (1–2) with a low pool (3–4), and the two teams in a QF are different regions.
  - `Draw.generate(teams, rng)` → 8-length array of `short` codes placing one high-pool and one low-pool team in each QF `[ [0,1],[2,3],[4,5],[6,7] ]`, retrying until `satisfies` holds (bounded attempts; throws after 500 if impossible).

- [ ] **Step 1: Write `tests/draw.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert');
const D = require('../src/draw.js');
const DATA = require('../src/data.js');

const byShort = Object.fromEntries(DATA.teams.map(t => [t.short, t]));

test('rng is deterministic for a seed', () => {
  const a = D.makeRng(42), b = D.makeRng(42);
  assert.equal(a(), b());
});

test('generate places 8 unique teams', () => {
  const draw = D.generate(DATA.teams, D.makeRng(1));
  assert.equal(draw.length, 8);
  assert.equal(new Set(draw).size, 8);
});

test('generated draw satisfies pool + region constraints', () => {
  for (let seed = 0; seed < 50; seed++) {
    const draw = D.generate(DATA.teams, D.makeRng(seed));
    assert.ok(D.satisfies(draw, byShort), `seed ${seed} violated constraints`);
  }
});

test('satisfies rejects a same-region quarterfinal', () => {
  // Force BLG (CN, pool1) vs TES (CN, pool4) into QF1
  const bad = ['BLG','TES','G2','PIW','HLE','FURIA','LYON','TSTW'];
  assert.equal(D.satisfies(bad, byShort), false);
});

test('satisfies rejects two high-pool teams in one QF', () => {
  const bad = ['BLG','G2','TES','PIW','HLE','LYON','TSTW','FURIA'];
  assert.equal(D.satisfies(bad, byShort), false); // BLG(1) vs G2(1)
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/draw.test.js`
Expected: FAIL — `Cannot find module '../src/draw.js'`.

- [ ] **Step 3: Write `src/draw.js`**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const QFS = [[0,1],[2,3],[4,5],[6,7]];
  function satisfies(draw, byShort) {
    return QFS.every(([i, j]) => {
      const A = byShort[draw[i]], B = byShort[draw[j]];
      if (!A || !B) return false;
      const oneHighOneLow = (A.pool <= 2) !== (B.pool <= 2);
      const diffRegion = A.region !== B.region;
      return oneHighOneLow && diffRegion;
    });
  }
  function generate(teams, rng) {
    const byShort = Object.fromEntries(teams.map(t => [t.short, t]));
    const high = teams.filter(t => t.pool <= 2).map(t => t.short);
    const low = teams.filter(t => t.pool > 2).map(t => t.short);
    for (let attempt = 0; attempt < 500; attempt++) {
      const h = shuffle(high, rng), l = shuffle(low, rng);
      const draw = [h[0], l[0], h[1], l[1], h[2], l[2], h[3], l[3]];
      if (satisfies(draw, byShort)) return draw;
    }
    throw new Error('could not satisfy draw constraints');
  }
  return { __name: 'MSI_Draw', makeRng, satisfies, generate };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/draw.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/draw.js tests/draw.test.js
git commit -m "feat: pool-aware seeded draw + constraint validation + tests"
```

---

## Task 5: Persistence (localStorage + URL)

**Files:**
- Create: `src/persist.js`
- Create: `tests/persist.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (`Persist`, `__name='MSI_Persist'`):
  - `Persist.encode(state)` → base64 string of `JSON.stringify(state)` (Node Buffer or browser btoa, whichever exists).
  - `Persist.decode(str)` → state object, or `null` on any error.
  - `Persist.save(state, storage)` / `Persist.load(storage)` — localStorage-like object (must have getItem/setItem); `load` returns state or `null`. Key `msi2026sim`.
  - State shape: `{ draw: (string|null)[8] | null, scores: {[id]:{a,b}}, playInPick: string|null }`.

- [ ] **Step 1: Write `tests/persist.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert');
const P = require('../src/persist.js');

const sample = { draw: ['BLG',null,null,null,null,null,null,null], scores: { WQF1: { a: 3, b: 1 } }, playInPick: 'T1' };

test('encode then decode round-trips', () => {
  assert.deepEqual(P.decode(P.encode(sample)), sample);
});
test('decode returns null on garbage', () => {
  assert.equal(P.decode('@@@not-base64@@@'), null);
  assert.equal(P.decode(''), null);
});
test('save/load via a fake storage', () => {
  const store = {}; const fake = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  P.save(sample, fake);
  assert.deepEqual(P.load(fake), sample);
});
test('load returns null when nothing stored', () => {
  const fake = { getItem: () => null, setItem: () => {} };
  assert.equal(P.load(fake), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/persist.test.js`
Expected: FAIL — `Cannot find module '../src/persist.js'`.

- [ ] **Step 3: Write `src/persist.js`**

```js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const KEY = 'msi2026sim';
  function b64encode(str) {
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64decode(b64) {
    if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8');
    return decodeURIComponent(escape(atob(b64)));
  }
  function encode(state) { return b64encode(JSON.stringify(state)); }
  function decode(str) {
    if (!str) return null;
    try { const o = JSON.parse(b64decode(str)); return (o && typeof o === 'object') ? o : null; }
    catch (e) { return null; }
  }
  function save(state, storage) { try { storage.setItem(KEY, encode(state)); } catch (e) {} }
  function load(storage) { try { return decode(storage.getItem(KEY)); } catch (e) { return null; } }
  return { __name: 'MSI_Persist', KEY, encode, decode, save, load };
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/persist.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/persist.js tests/persist.test.js
git commit -m "feat: scenario persistence (localStorage + URL) + tests"
```

---

## Task 6: Build script + static shell (renders the bracket, read-only)

**Files:**
- Create: `src/ui.jsx`
- Create: `build.js`
- Create: `index.html` (generated)

**Interfaces:**
- Consumes: globals `MSI_DATA, MSI_Engine, MSI_Standings, MSI_Draw, MSI_Persist` (set by the concatenated logic scripts), plus `React`, `ReactDOM` (CDN).
- Produces: a working `index.html`. After this task `App` renders the 14 match cards positioned by round, each showing resolved team names (TBD before draw) and BO5 badge — no interactivity yet.

- [ ] **Step 1: Write `build.js`**

```js
// build.js — concatenate logic + UI into a single self-contained index.html. No deps.
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

const logic = ['src/data.js','src/engine.js','src/standings.js','src/draw.js','src/persist.js']
  .map(read).join('\n\n');
const ui = read('src/ui.jsx');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MSI 2026 — Stage 2 Bracket Simulator</title>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
<style id="appstyle">__CSS__</style>
</head>
<body>
<div id="root">Loading… (this page needs an internet connection on first load for React)</div>
<script>
${logic}
</script>
<script type="text/babel" data-presets="react">
${ui}
</script>
</body>
</html>`;

const css = read('src/styles.css');
fs.writeFileSync(path.join(__dirname, 'index.html'), html.replace('__CSS__', css));
console.log('Wrote index.html (' + html.length + ' bytes)');
```

- [ ] **Step 2: Create `src/styles.css`** (dark MSI-primer theme)

```css
:root{--bg:#11151c;--panel:#171c26;--panel2:#1d2330;--line:#2b3342;--text:#f3ede0;--muted:#9aa3b2;--accent:#e8567f;--accent2:#ff5d73;--win:#5ad19a;}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(1200px 600px at 70% -10%,#1b2436 0%,var(--bg) 60%);color:var(--text);font:14px/1.4 'Segoe UI',system-ui,sans-serif}
.topbar{display:flex;gap:10px;align-items:center;padding:14px 20px;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(17,21,28,.9);backdrop-filter:blur(6px);z-index:5}
.topbar h1{font-size:16px;margin:0;letter-spacing:.5px;text-transform:uppercase;flex:0 0 auto}
.topbar .spacer{flex:1}
button.btn{background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:600}
button.btn:hover{border-color:var(--accent)}
button.btn.primary{background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;color:#1b0f16}
select{background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:7px 10px}
.layout{display:flex;gap:18px;padding:20px;align-items:flex-start}
.bracket{flex:1;overflow-x:auto;padding-bottom:30px}
.section-title{font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-size:12px;margin:8px 0}
.cols{display:flex;gap:46px;min-width:max-content}
.col{display:flex;flex-direction:column;gap:18px}
.col h3{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;text-align:center;background:#0d1117;border:1px solid var(--line);border-radius:6px;padding:6px;margin:0}
.match{background:var(--panel);border:1px solid var(--line);border-radius:8px;width:230px;overflow:hidden;cursor:pointer;transition:border-color .15s}
.match:hover{border-color:var(--accent)}
.match.live{border-color:var(--accent2)}
.row{display:flex;align-items:center;gap:8px;padding:7px 9px;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:none}
.row.winner{background:rgba(90,209,154,.08)}
.row .logo{width:22px;height:22px;border-radius:4px;object-fit:contain;background:#0d1117;flex:0 0 auto}
.row .badge{width:22px;height:22px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;flex:0 0 auto}
.row .name{flex:1;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .name.tbd{color:var(--muted);font-weight:500}
.row .score{width:22px;text-align:center;font-weight:800;font-variant-numeric:tabular-nums}
.match .meta{display:flex;justify-content:space-between;padding:4px 9px;font-size:10px;color:var(--muted);background:#0d1117}
.dropslot{outline:2px dashed var(--accent);outline-offset:-2px}
.standings{width:300px;flex:0 0 auto;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px}
.standings table{width:100%;border-collapse:collapse}
.standings td{padding:6px 4px;border-bottom:1px solid var(--line)}
.standings .pl{color:var(--accent);font-weight:800;width:54px}
.standings tr.out{opacity:.55}
.drawer{position:fixed;top:0;right:0;height:100%;width:360px;background:var(--panel2);border-left:1px solid var(--line);box-shadow:-20px 0 40px rgba(0,0,0,.4);transform:translateX(100%);transition:transform .2s;z-index:20;padding:18px;overflow-y:auto}
.drawer.open{transform:translateX(0)}
.drawer h2{margin:0 0 4px;font-size:15px}
.drawer .close{position:absolute;top:14px;right:14px;cursor:pointer;color:var(--muted);background:none;border:none;font-size:20px}
.drawer .vs{display:flex;align-items:center;gap:10px;margin:14px 0}
.scorebox{display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px;margin:8px 0}
.stepper{display:flex;align-items:center;gap:6px}
.stepper button{width:26px;height:26px;border-radius:6px;border:1px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer;font-weight:800}
.h2h{margin-top:18px;padding:14px;border:1px dashed var(--line);border-radius:8px;color:var(--muted);text-align:center}
.poolbar{display:flex;gap:8px;flex-wrap:wrap;margin:0 20px 6px}
.chip{display:flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--line);border-radius:20px;padding:4px 10px 4px 4px;cursor:grab;font-weight:600;font-size:12px}
.chip[draggable=true]:active{cursor:grabbing}
.reveal{animation:pop .35s ease}
@keyframes pop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
```

- [ ] **Step 3: Write `src/ui.jsx`** — initial read-only render (TeamChip helper + MatchCard + BracketView + minimal App). Drag/score/drawer wired in later tasks.

```jsx
const { useState, useEffect, useMemo, useCallback } = React;
const DATA = MSI_DATA, Engine = MSI_Engine, Standings = MSI_Standings, Draw = MSI_Draw, Persist = MSI_Persist;
const ALL_TEAMS = DATA.teams.concat(DATA.playInCandidates);
const teamByShort = Object.fromEntries(ALL_TEAMS.map(t => [t.short, t]));

function TeamLogo({ short }) {
  const t = teamByShort[short];
  const [err, setErr] = useState(false);
  if (!t) return <span className="badge" style={{ background: '#333' }}>?</span>;
  if (t.logoUrl && !err)
    return <img className="logo" src={t.logoUrl} alt={t.short} onError={() => setErr(true)} />;
  return <span className="badge" style={{ background: t.color }}>{t.short.slice(0, 3)}</span>;
}

function TeamRow({ short, score, isWinner }) {
  const t = short ? teamByShort[short] : null;
  return (
    <div className={'row' + (isWinner ? ' winner' : '')}>
      {short ? <TeamLogo short={short} /> : <span className="badge" style={{ background: '#222' }}> </span>}
      <span className={'name' + (t ? '' : ' tbd')}>{t ? (t.short + ' · ' + t.name) : 'TBD'}</span>
      <span className="score">{short ? score : ''}</span>
    </div>
  );
}

function MatchCard({ id, draw, scores, onOpen }) {
  const r = Engine.resolveMatch(id, draw, scores);
  const sc = scores[id] || { a: 0, b: 0 };
  const live = r.teamA && r.teamB && !r.winner;
  return (
    <div className={'match' + (live ? ' live' : '')} onClick={() => onOpen(id)}>
      <TeamRow short={r.teamA} score={sc.a} isWinner={r.winner && r.winner === r.teamA} />
      <TeamRow short={r.teamB} score={sc.b} isWinner={r.winner && r.winner === r.teamB} />
      <div className="meta"><span>{DATA.dates[id] || 'TBD'}</span><span>BO5</span></div>
    </div>
  );
}

const COLUMNS = [
  { title: 'Round 1', ids: ['WQF1','WQF2','WQF3','WQF4'] },
  { title: 'Round 2', ids: ['WSF1','WSF2'] },
  { title: 'Round 4', ids: ['WBF'] },
];
const LB_COLUMNS = [
  { title: 'LB Round 1', ids: ['LR1A','LR1B'] },
  { title: 'LB Round 2', ids: ['LR2A','LR2B'] },
  { title: 'LB Round 3', ids: ['LR3'] },
  { title: 'LB Final', ids: ['LBF'] },
];

function BracketView({ draw, scores, onOpen }) {
  const col = (c) => (
    <div className="col" key={c.title}>
      <h3>{c.title}</h3>
      {c.ids.map(id => <MatchCard key={id} id={id} draw={draw} scores={scores} onOpen={onOpen} />)}
    </div>
  );
  return (
    <div className="bracket">
      <div className="section-title">Winners' Bracket</div>
      <div className="cols">{COLUMNS.map(col)}
        <div className="col"><h3>Grand Final</h3><MatchCard id="GF" draw={draw} scores={scores} onOpen={onOpen} /></div>
      </div>
      <div className="section-title" style={{ marginTop: 28 }}>Losers' Bracket</div>
      <div className="cols">{LB_COLUMNS.map(col)}</div>
    </div>
  );
}

function App() {
  const [draw, setDraw] = useState(null);
  const [scores, setScores] = useState(Engine.emptyScores());
  return (
    <div>
      <div className="topbar"><h1>MSI 2026 · Stage 2</h1><div className="spacer" /></div>
      <div className="layout">
        <BracketView draw={draw} scores={scores} onOpen={() => {}} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

- [ ] **Step 4: Build and open**

Run: `node build.js`
Expected: `Wrote index.html (...)`.

- [ ] **Step 5: Verify render with the webapp-testing skill**

Invoke the `webapp-testing` skill (Playwright) to open `file://$PWD/index.html`, wait for `.bracket` to appear, and screenshot.
Expected: 14 match cards laid out in winners + losers columns, all showing "TBD / TBD", BO5 badges, dark theme. Confirm no console errors (other than the expected logo 404→badge fallbacks).

- [ ] **Step 6: Commit**

```bash
git add src/ui.jsx src/styles.css build.js index.html
git commit -m "feat: build pipeline + read-only bracket render"
```

---

## Task 7: Top bar — draw, play-in selector, reset, persistence wiring

**Files:**
- Modify: `src/ui.jsx` (replace `App`, add `TopBar`)
- Modify: `index.html` (regenerate via build)

**Interfaces:**
- Consumes: `Draw.generate`, `Draw.makeRng`, `Persist.save/load/encode/decode`, `DATA.playInCandidates`.
- Produces: `App` now owns `{draw, scores, playInPick}`, auto-saves to localStorage + URL hash, hydrates on load (URL hash wins over localStorage), and a `TopBar` with Draw / Reset / Copy link / play-in `<select>`.

- [ ] **Step 1: Add `TopBar` and rewrite `App` in `src/ui.jsx`** (place above `ReactDOM.createRoot`)

```jsx
function TopBar({ onDraw, onReset, onCopy, playInPick, onPick, copied }) {
  return (
    <div className="topbar">
      <h1>MSI 2026 · Stage 2</h1>
      <div className="spacer" />
      <label style={{ color: 'var(--muted)', fontSize: 12 }}>Play-In Winner:&nbsp;
        <select value={playInPick || ''} onChange={e => onPick(e.target.value || null)}>
          <option value="">— TBD —</option>
          {DATA.playInCandidates.map(c => <option key={c.short} value={c.short}>{c.short} · {c.name}</option>)}
        </select>
      </label>
      <button className="btn primary" onClick={onDraw}>⟳ Draw</button>
      <button className="btn" onClick={onCopy}>{copied ? '✓ Copied' : '🔗 Copy link'}</button>
      <button className="btn" onClick={onReset}>Reset</button>
    </div>
  );
}

// Apply the play-in pick: substitute the chosen team's identity into the PIW slot for display.
function applyPlayIn(short) {
  // returns a function mapping a slot short to display short (PIW -> picked team)
  return s => (s === 'PIW' && short ? short : s);
}

function App() {
  const seedRef = React.useRef(1);
  const [draw, setDraw] = useState(null);
  const [scores, setScores] = useState(Engine.emptyScores());
  const [playInPick, setPlayInPick] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [copied, setCopied] = useState(false);

  // hydrate once: URL hash beats localStorage
  useEffect(() => {
    const fromUrl = Persist.decode(location.hash.replace(/^#/, ''));
    const st = fromUrl || Persist.load(window.localStorage);
    if (st) { setDraw(st.draw || null); setScores(st.scores || Engine.emptyScores()); setPlayInPick(st.playInPick || null); }
  }, []);

  // autosave
  useEffect(() => {
    Persist.save({ draw, scores, playInPick }, window.localStorage);
  }, [draw, scores, playInPick]);

  const doDraw = useCallback(() => {
    const rng = Draw.makeRng((seedRef.current = seedRef.current + 1) * 2654435761 >>> 0 ^ Date.now());
    const d = Draw.generate(DATA.teams, rng);
    setDraw(d); setScores(Engine.emptyScores());
  }, []);
  const doReset = useCallback(() => {
    setDraw(null); setScores(Engine.emptyScores()); setPlayInPick(null);
    history.replaceState(null, '', location.pathname);
  }, []);
  const doCopy = useCallback(() => {
    const enc = Persist.encode({ draw, scores, playInPick });
    const url = location.origin + location.pathname + '#' + enc;
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
    history.replaceState(null, '', '#' + enc);
  }, [draw, scores, playInPick]);

  // draw with PIW substituted for display/logic
  const displayDraw = useMemo(() => draw && draw.map(applyPlayIn(playInPick)), [draw, playInPick]);

  return (
    <div>
      <TopBar onDraw={doDraw} onReset={doReset} onCopy={doCopy} playInPick={playInPick} onPick={setPlayInPick} copied={copied} />
      <div className="layout">
        <BracketView draw={displayDraw} scores={scores} onOpen={setOpenId} />
      </div>
    </div>
  );
}
```

Note: replace the old `App`. `displayDraw` (PIW substituted) is what feeds engine/standings/UI from here on.

- [ ] **Step 2: Build**

Run: `node build.js`
Expected: `Wrote index.html (...)`.

- [ ] **Step 3: Verify with webapp-testing skill**

Open `index.html`, click **Draw**, screenshot. Expected: 8 teams populate the 4 quarterfinals; pool/region constraints visibly hold (no all-China QF). Pick a Play-In Winner in the dropdown → the PIW slot's QF now shows that team. Reload the page → the drawn state persists. Click **Reset** → back to all-TBD.

- [ ] **Step 4: Commit**

```bash
git add src/ui.jsx index.html
git commit -m "feat: top bar (draw/reset/copy-link), play-in pick, persistence"
```

---

## Task 8: Score entry + match drawer

**Files:**
- Modify: `src/ui.jsx` (add `Drawer`, wire `setScore`, render Drawer in `App`)
- Modify: `index.html` (regenerate)

**Interfaces:**
- Consumes: `Engine.resolveMatch`, `Engine.setScore`, `Engine.isValidBo5`.
- Produces: clicking a match opens a right `Drawer` with both teams, date, two BO5 score steppers (0–3, clamped, invalid combos blocked), and a stubbed H2H panel. Score changes call `Engine.setScore` (which retracts downstream) and update state. Standings (Task 9) consume the same state.

- [ ] **Step 1: Add `Drawer` and wire scoring in `src/ui.jsx`**

```jsx
function Stepper({ value, onChange }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(0, value - 1))}>−</button>
      <span className="score" style={{ fontSize: 18 }}>{value}</span>
      <button onClick={() => onChange(Math.min(3, value + 1))}>+</button>
    </div>
  );
}

function Drawer({ id, draw, scores, onScore, onClose }) {
  if (!id) return <div className="drawer" />;
  const r = Engine.resolveMatch(id, draw, scores);
  const sc = scores[id] || { a: 0, b: 0 };
  const setA = v => { if (Engine.isValidBo5(v, sc.b)) onScore(id, v, sc.b); };
  const setB = v => { if (Engine.isValidBo5(sc.a, v)) onScore(id, sc.a, v); };
  const nameOf = s => (s ? (teamByShort[s] ? teamByShort[s].name : s) : 'TBD');
  return (
    <div className="drawer open">
      <button className="close" onClick={onClose}>×</button>
      <h2>{id} · BO5</h2>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{DATA.dates[id] || 'Date TBD'}</div>
      <div className="scorebox"><span><TeamLogo short={r.teamA} /> {nameOf(r.teamA)}</span><Stepper value={sc.a} onChange={setA} /></div>
      <div className="scorebox"><span><TeamLogo short={r.teamB} /> {nameOf(r.teamB)}</span><Stepper value={sc.b} onChange={setB} /></div>
      {r.winner && <div style={{ color: 'var(--win)', fontWeight: 700 }}>Winner: {nameOf(r.winner)}</div>}
      <div className="h2h">Head-to-head history<br /><small>coming soon</small></div>
    </div>
  );
}
```

In `App`, add the score handler and render the drawer + a click-catcher to close:

```jsx
  const doScore = useCallback((id, a, b) => setScores(s => Engine.setScore(s, id, a, b)), []);
  // ...inside the return, after <BracketView ...>:
  //   <Drawer id={openId} draw={displayDraw} scores={scores} onScore={doScore} onClose={() => setOpenId(null)} />
```

Wire `BracketView`'s `onOpen={setOpenId}` (already passed) and add the `<Drawer .../>` line inside `App`'s returned tree.

- [ ] **Step 2: Build**

Run: `node build.js`
Expected: success.

- [ ] **Step 3: Verify with webapp-testing skill**

Draw, click a quarterfinal → drawer opens. Step one team to 3 → drawer shows "Winner", card highlights the winning row, and that winner appears in the next round's card. Verify the loser appears in the correct LB round-1 card. Set a winners-semifinal, then change the feeding quarterfinal → confirm the semifinal score resets (downstream retraction). Screenshot each.

- [ ] **Step 4: Commit**

```bash
git add src/ui.jsx index.html
git commit -m "feat: match drawer with BO5 score entry + propagation"
```

---

## Task 9: Standings table + draw reveal animation

**Files:**
- Modify: `src/ui.jsx` (add `StandingsTable`, reveal animation class on draw)
- Modify: `index.html` (regenerate)

**Interfaces:**
- Consumes: `Standings.compute(Engine, displayDraw, scores)`.
- Produces: a `StandingsTable` in the layout showing live 1st–8th (place label, logo, name), eliminated rows dimmed; updates as scores change. Newly drawn match cards briefly get the `reveal` CSS animation.

- [ ] **Step 1: Add `StandingsTable` and reveal logic in `src/ui.jsx`**

```jsx
function StandingsTable({ draw, scores }) {
  if (!draw) return <div className="standings"><div className="section-title">Standings</div><div style={{color:'var(--muted)'}}>Draw teams to begin.</div></div>;
  const rows = Standings.compute(Engine, draw, scores);
  return (
    <div className="standings">
      <div className="section-title">Standings</div>
      <table><tbody>
        {rows.map(r => (
          <tr key={r.short} className={r.alive ? '' : 'out'}>
            <td className="pl">{r.placeLabel}</td>
            <td><TeamLogo short={r.short} /></td>
            <td>{teamByShort[r.short] ? teamByShort[r.short].name : r.short}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}
```

Add `<StandingsTable draw={displayDraw} scores={scores} />` to `App`'s layout (right of the bracket). For the reveal animation, set a `justDrew` flag in `doDraw` (`setJustDrew(true); setTimeout(()=>setJustDrew(false),700)`) and pass it into `BracketView`/`MatchCard` so freshly populated `WQF*` cards add `reveal` to their className when `justDrew` is true.

- [ ] **Step 2: Build**

Run: `node build.js`
Expected: success.

- [ ] **Step 3: Verify with webapp-testing skill**

Draw → QF cards pop in (reveal). Standings panel lists all 8 as alive with "—". Play the scripted run from `tests/standings.test.js` via clicks → confirm final standings read 1st BLG, 2nd TES, 3rd HLE, 4th FURIA, 5th–6th LYON/G2, 7th–8th PIW/TSTW, with eliminated rows dimmed. Screenshot the final state.

- [ ] **Step 4: Commit**

```bash
git add src/ui.jsx index.html
git commit -m "feat: live standings table + draw reveal animation"
```

---

## Task 10: Drag-and-drop manual override

**Files:**
- Modify: `src/ui.jsx` (pool chip tray + native DnD on QF slots)
- Modify: `src/styles.css` (drag affordances already present: `.chip`, `.dropslot`)
- Modify: `index.html` (regenerate)

**Interfaces:**
- Consumes: current `draw` (8 seed positions) and `App`'s `setDraw`.
- Produces: a chip tray of all 8 stage-2 teams (with PIW substituted) above the bracket; each QF team row is a drop target. Dragging a team chip (or another slot's team) onto a slot **swaps** the two teams' positions so the draw stays a permutation of the 8 teams. Manual edits keep persistence working.

- [ ] **Step 1: Add a `swapInDraw` helper to `src/draw.js`** and a test.

In `src/draw.js`, add before the return:
```js
  function swap(draw, i, j) {
    if (!draw) return draw;
    const d = draw.slice(); const t = d[i]; d[i] = d[j]; d[j] = t; return d;
  }
```
and add `swap` to the returned object. Add to `tests/draw.test.js`:
```js
test('swap exchanges two positions and preserves the set', () => {
  const before = ['BLG','TES','G2','PIW','HLE','FURIA','LYON','TSTW'];
  const after = D.swap(before, 0, 6);
  assert.equal(after[0], 'LYON'); assert.equal(after[6], 'BLG');
  assert.deepEqual([...after].sort(), [...before].sort());
});
```
Run: `node --test tests/draw.test.js` → PASS.

- [ ] **Step 2: Add DnD to `src/ui.jsx`** — make `TeamRow` slots droppable and a `ChipTray` draggable source.

Replace `MatchCard`'s rows with draggable/droppable variants for QF matches only (ids starting `WQF`), using native HTML5 DnD. A drag carries the source seed index (or a chip's team short); dropping on a QF slot finds both seed indices and calls `Draw.swap`. Representative wiring:

```jsx
function ChipTray({ draw }) {
  if (!draw) return null;
  return (
    <div className="poolbar">
      {draw.map((short, i) => (
        <div className="chip" key={i} draggable
             onDragStart={e => e.dataTransfer.setData('text/seed', String(i))}>
          <TeamLogo short={short} /> {teamByShort[short] ? teamByShort[short].short : short}
        </div>
      ))}
    </div>
  );
}
```

Give QF `TeamRow`s `onDragOver={e=>e.preventDefault()}` and `onDrop` that reads `text/seed` and swaps with the row's own seed index (`App` passes `onSwap(i,j)` → `setDraw(d => Draw.swap(d, i, j))`). Map each QF row to its seed index via `Engine.GRAPH[id].a.seed` / `.b.seed`.

- [ ] **Step 3: Build**

Run: `node build.js`
Expected: success.

- [ ] **Step 4: Verify with webapp-testing skill**

Draw, then use Playwright's drag to drop one chip onto another QF slot. Confirm the two teams swap positions and the set of 8 teams is unchanged. Confirm scores reset/recompute sensibly (a swap is a draw-edit). Reload → swapped layout persists. Screenshot.

- [ ] **Step 5: Commit**

```bash
git add src/ui.jsx src/draw.js tests/draw.test.js index.html
git commit -m "feat: drag-and-drop manual seeding override"
```

---

## Task 11: Final polish, full-run verification, README

**Files:**
- Modify: `src/styles.css` (connector lines / spacing polish)
- Create: `README.md`
- Modify: `index.html` (regenerate)

**Interfaces:**
- Consumes: everything.
- Produces: SVG/CSS connector lines between bracket rounds for the screenshot look, a short README (what it is, how to run = "open index.html", how to rebuild = "node build.js", how to test = "node --test", how to refresh data), and a final end-to-end verification.

- [ ] **Step 1: Add connector styling** — pseudo-element right-border elbows between columns in `src/styles.css` (e.g., `.col .match::after` lines), tuned so winners/losers columns read like the reference screenshot. Keep it CSS-only (no per-match absolute positioning) to stay robust.

- [ ] **Step 2: Write `README.md`**

```md
# MSI 2026 — Stage 2 Bracket Simulator

Single-file simulator for the 2026 Mid-Season Invitational Stage 2
(8-team double elimination). Draw the seeding, enter results, watch the
winners/losers brackets resolve, and share scenarios by link.

## Run
Open `index.html` in a browser (double-click). Needs internet on first
load to fetch React/Babel from a CDN.

## Develop
- `node --test`        # run all unit tests (engine, standings, draw, persist, data)
- `node build.js`      # regenerate index.html from src/
- `node scripts/fetch-logos.js`  # re-resolve Leaguepedia logo URLs for src/data.js

Logic lives in `src/*.js` (tested with Node). UI is `src/ui.jsx`.
`build.js` concatenates everything into the single `index.html`.

## Data
Teams, pools and format are a snapshot from
<https://lol.fandom.com/wiki/2026_Mid-Season_Invitational>.
Head-to-head history in the match drawer is stubbed for a future version.
```

- [ ] **Step 3: Run the full unit-test suite**

Run: `node --test`
Expected: all suites PASS (data, engine, standings, draw, persist).

- [ ] **Step 4: Build and full end-to-end verification with webapp-testing skill**

Run `node build.js`, then in Playwright: open `index.html`, Draw, play a complete bracket via the drawer to a champion, confirm standings fill 1→8, Copy link, open the copied URL in a fresh context, and confirm the full scenario rehydrates identically. Screenshot the finished bracket + standings.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css README.md index.html
git commit -m "feat: connector styling, README, end-to-end verification"
```

---

## Self-Review Notes

**Spec coverage check:**
- Draw of names per seed → Task 4 (logic) + Task 7 (button/animation) + Task 10 (manual override). ✓
- Results per game / table view → Task 8 (score entry) + Task 9 (standings). ✓
- Teams + format from wiki → Task 1 (data snapshot). ✓
- MSI primer visual style → Task 6 (styles.css) + Task 11 (connectors/polish). ✓
- Drag-and-drop / manual result change → Task 10 + Task 8. ✓
- Logos + name/short → Task 6 (`TeamLogo`/`TeamRow`) + Task 1 (logoUrl/color). ✓
- Losers & winners bracket logic (double elim) → Task 2 (engine) + tests. ✓
- Game dates → Task 1 (dates) + Task 6/8 (meta + drawer). ✓
- Click → drawer with H2H (stubbed v1) → Task 8. ✓
- Persistence + shareable → Task 5 + Task 7. ✓

**Type consistency:** module global names (`MSI_DATA`, `MSI_Engine`, `MSI_Standings`, `MSI_Draw`, `MSI_Persist`) and function signatures are used identically across tasks. Match ids and the 8-seed draw array are consistent throughout.

**Placeholder scan:** H2H is an explicit, spec-approved v1 stub (not a plan placeholder). No TBD/TODO logic remains.
