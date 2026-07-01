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
test('14 canonical match ids and a UTC schedule time for each', () => {
  assert.equal(DATA.matchIds.length, 14);
  for (const id of DATA.matchIds) {
    assert.ok(id in DATA.schedule, `schedule for ${id}`);
    assert.match(DATA.schedule[id], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, `ISO UTC for ${id}`);
  }
});
test('four play-in candidates', () => {
  assert.equal(DATA.playInCandidates.length, 4);
});
test('actualDraw is a full valid seeding with the play-in winner', () => {
  const shorts = new Set(DATA.teams.map(t => t.short));
  assert.equal(DATA.actualDraw.length, 8);
  assert.equal(new Set(DATA.actualDraw).size, 8, 'no duplicate seeds');
  for (const s of DATA.actualDraw) assert.ok(shorts.has(s), `unknown seed ${s}`);
  assert.ok(DATA.actualDraw.includes('PIW'), 'PIW slot present for the play-in qualifier');
  assert.ok(DATA.playInCandidates.some(c => c.short === DATA.playInWinner), 'playInWinner is a candidate');
});
