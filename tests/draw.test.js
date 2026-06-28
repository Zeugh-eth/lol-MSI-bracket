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
