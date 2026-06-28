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

test('alive teams sort before eliminated; eliminated sink to the bottom with their place', () => {
  let s = E.emptyScores();
  s = E.setScore(s, 'WQF1', 3, 0);
  s = E.setScore(s, 'WQF2', 3, 0);
  s = E.setScore(s, 'LR1A', 3, 0); // PIW eliminated 7th-8th
  const rows = S.compute(E, DRAW, s);
  // 7 teams still alive, PIW eliminated -> PIW is the last row
  const last = rows[rows.length - 1];
  assert.equal(last.short, 'PIW');
  assert.equal(last.alive, false);
  assert.equal(last.place, 7);
  assert.ok(rows[0].alive); // a still-competing team leads the table
});
