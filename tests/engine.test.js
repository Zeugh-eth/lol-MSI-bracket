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
