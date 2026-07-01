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

test('every generated quarterfinal is Pool 1 v 4 or Pool 2 v 3', () => {
  const QFS = [[0,1],[2,3],[4,5],[6,7]];
  for (let seed = 0; seed < 50; seed++) {
    const draw = D.generate(DATA.teams, D.makeRng(seed));
    for (const [i, j] of QFS) {
      const pools = [byShort[draw[i]].pool, byShort[draw[j]].pool].sort((a, b) => a - b).join('-');
      assert.ok(pools === '1-4' || pools === '2-3', `seed ${seed} QF ${i},${j} had pools ${pools}`);
    }
  }
});

test('satisfies rejects a same-region quarterfinal', () => {
  // Force BLG (CN, pool1) vs TES (CN, pool4) into QF1 — valid pools but same region
  const bad = ['BLG','TES','G2','PIW','HLE','FURIA','LYON','TSTW'];
  assert.equal(D.satisfies(bad, byShort), false);
});

test('satisfies rejects two same-pool teams in one QF', () => {
  const bad = ['BLG','G2','TES','PIW','HLE','LYON','TSTW','FURIA'];
  assert.equal(D.satisfies(bad, byShort), false); // BLG(1) vs G2(1)
});

test('satisfies rejects a Pool 1 v 3 and a Pool 2 v 4 quarterfinal', () => {
  // BLG(1) v FURIA(3) in QF1, HLE(2) v TES(4) in QF2 — the old "high vs low" rule
  // wrongly allowed these; the correct rule must reject them.
  const bad = ['BLG','FURIA','HLE','TES','G2','TSTW','LYON','PIW'];
  assert.equal(D.satisfies(bad, byShort), false);
});

test('swap exchanges two positions and preserves the set', () => {
  const before = ['BLG','TES','G2','PIW','HLE','FURIA','LYON','TSTW'];
  const after = D.swap(before, 0, 6);
  assert.equal(after[0], 'LYON'); assert.equal(after[6], 'BLG');
  assert.deepEqual([...after].sort(), [...before].sort());
});

test('the published actualDraw satisfies the pool + region rules', () => {
  assert.ok(D.satisfies(DATA.actualDraw, byShort));
});

test('place from a null draw starts an empty 8-slot array', () => {
  const d = D.place(null, 5, 'G2');
  assert.equal(d.length, 8);
  assert.equal(d[5], 'G2');
  assert.equal(d.filter(Boolean).length, 1);
});

test('place moves a team that was already placed (no duplicates)', () => {
  let d = D.place(null, 0, 'BLG');
  d = D.place(d, 3, 'BLG'); // move BLG from slot 0 to slot 3
  assert.equal(d[0], null);
  assert.equal(d[3], 'BLG');
  assert.equal(d.filter(x => x === 'BLG').length, 1);
});

test('place overwrites the target slot (prior occupant returns to bench)', () => {
  let d = D.place(null, 2, 'TES');
  d = D.place(d, 2, 'HLE'); // drop HLE onto TES's slot
  assert.equal(d[2], 'HLE');
  assert.ok(!d.includes('TES')); // TES no longer placed
});
