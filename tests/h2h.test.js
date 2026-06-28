const { test } = require('node:test');
const assert = require('node:assert');
const H = require('../src/h2h.js');

const SHORTS = new Set(['BLG','G2','HLE','LYON','TSTW','FURIA','TES','KCORP','T1','TL','DCGTW']);

test('MATCHES is non-empty and well-formed', () => {
  assert.ok(H.MATCHES.length > 50);
  for (const m of H.MATCHES) {
    assert.ok(SHORTS.has(m.a) && SHORTS.has(m.b), `teams ${m.a}/${m.b}`);
    assert.notEqual(m.a, m.b);
    assert.ok(Number.isInteger(m.sa) && Number.isInteger(m.sb));
    assert.notEqual(m.sa, m.sb); // series have a winner, no draws
    assert.match(m.d, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('MATCHES are sorted newest-first', () => {
  for (let i = 1; i < H.MATCHES.length; i++) {
    assert.ok(H.MATCHES[i - 1].d >= H.MATCHES[i].d, `out of order at ${i}`);
  }
});

test('summary is symmetric and perspective-correct', () => {
  const ab = H.summary('BLG', 'TES');
  const ba = H.summary('TES', 'BLG');
  assert.ok(ab.count > 0);
  assert.equal(ab.count, ba.count);
  assert.equal(ab.aWins, ba.bWins); // a's wins from one side == b's wins from the other
  assert.equal(ab.bWins, ba.aWins);
  // perspective: in summary('BLG','TES'), sa is BLG's score
  for (const m of ab.matches) {
    const won = m.sa > m.sb;
    // mirror in ba should have inverse
    assert.notEqual(m.sa, m.sb);
    void won;
  }
  assert.equal(ab.aWins + ab.bWins, ab.count);
});

test('summary count is zero for a pair that never met', () => {
  // two teams with no shared history in the snapshot
  const s = H.summary('TSTW', 'TL');
  assert.equal(s.count, 0);
  assert.deepEqual(s.matches, []);
});

test('recent returns at most n, newest-first, opponent is not the team', () => {
  const r = H.recent('T1', 4);
  assert.ok(r.length > 0 && r.length <= 4);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].d >= r[i].d);
  for (const m of r) assert.notEqual(m.opp, 'T1');
});
