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

// ---- compact share link -----------------------------------------------------
const SCHEMA = {
  teams: ['BLG', 'G2', 'HLE', 'LYON', 'TSTW', 'FURIA', 'TES', 'PIW'],
  candidates: ['KCORP', 'T1', 'TL', 'DCGTW'],
  matchIds: ['WQF1','WQF2','WQF3','WQF4','WSF1','WSF2','WBF','LR1A','LR1B','LR2A','LR2B','LR3','LBF','GF'],
};
const emptyScores = () => Object.fromEntries(SCHEMA.matchIds.map(id => [id, { a: 0, b: 0 }]));

test('encodeShare uses the ~1 version prefix and base64url only', () => {
  const enc = P.encodeShare({ draw: SCHEMA.teams.slice(), scores: emptyScores(), playInPick: null }, SCHEMA);
  assert.ok(enc.startsWith('~1'));
  assert.match(enc.slice(2), /^[A-Za-z0-9_-]*$/); // base64url, no +/=
});

test('share round-trips draw, play-in pick and decided results', () => {
  const draw = ['BLG','TES','HLE','FURIA','G2','PIW','LYON','TSTW'];
  const scores = emptyScores();
  scores.WQF1 = { a: 3, b: 0 };  // A 3-0
  scores.WQF2 = { a: 1, b: 3 };  // B 3-1
  scores.WSF1 = { a: 3, b: 2 };  // A 3-2
  scores.GF   = { a: 2, b: 3 };  // B 3-2
  const state = { draw, scores, playInPick: 'T1' };
  const back = P.decodeShare(P.encodeShare(state, SCHEMA), SCHEMA);
  assert.deepEqual(back.draw, draw);
  assert.equal(back.playInPick, 'T1');
  assert.deepEqual(back.scores.WQF1, { a: 3, b: 0 });
  assert.deepEqual(back.scores.WQF2, { a: 1, b: 3 });
  assert.deepEqual(back.scores.WSF1, { a: 3, b: 2 });
  assert.deepEqual(back.scores.GF,   { a: 2, b: 3 });
  assert.deepEqual(back.scores.WQF3, { a: 0, b: 0 }); // untouched stays unplayed
});

test('share link fits well under 130 characters (full bracket)', () => {
  const draw = SCHEMA.teams.slice();
  const scores = emptyScores();
  for (const id of SCHEMA.matchIds) scores[id] = { a: 3, b: 2 }; // every match decided, max games
  const enc = P.encodeShare({ draw, scores, playInPick: 'DCGTW' }, SCHEMA);
  const url = 'https://msibracket.xyz/#' + enc;
  assert.ok(url.length <= 130, 'url length ' + url.length);
  assert.ok(url.length <= 60, 'expected very short, got ' + url.length);
});

test('share trims trailing unplayed matches (early bracket is shorter)', () => {
  const draw = SCHEMA.teams.slice();
  const full = emptyScores(); for (const id of SCHEMA.matchIds) full[id] = { a: 3, b: 1 };
  const early = emptyScores(); early.WQF1 = { a: 3, b: 0 };
  const encFull = P.encodeShare({ draw, scores: full, playInPick: null }, SCHEMA);
  const encEarly = P.encodeShare({ draw, scores: early, playInPick: null }, SCHEMA);
  assert.ok(encEarly.length < encFull.length);
});

test('share round-trips a partial draw (empty slots)', () => {
  const draw = ['BLG', null, null, 'TES', null, null, null, null];
  const back = P.decodeShare(P.encodeShare({ draw, scores: emptyScores(), playInPick: null }, SCHEMA), SCHEMA);
  assert.deepEqual(back.draw, draw);
});

test('decodeShare falls back to legacy base64-JSON links', () => {
  const legacy = P.encode({ draw: ['BLG', null, null, null, null, null, null, null], scores: { WQF1: { a: 3, b: 1 } }, playInPick: 'T1' });
  const back = P.decodeShare(legacy, SCHEMA); // legacy string has no "~" prefix
  assert.equal(back.playInPick, 'T1');
  assert.deepEqual(back.draw[0], 'BLG');
});

test('decodeShare returns null on garbage / unknown version', () => {
  assert.equal(P.decodeShare('~9zzzz', SCHEMA), null);
  assert.equal(P.decodeShare('', SCHEMA), null);
});
