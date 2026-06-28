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
