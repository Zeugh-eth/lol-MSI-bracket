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
  // Official MSI seeding: quarterfinals pair Pool 1 vs Pool 4 and Pool 2 vs Pool 3.
  function satisfies(draw, byShort) {
    return QFS.every(([i, j]) => {
      const A = byShort[draw[i]], B = byShort[draw[j]];
      if (!A || !B) return false;
      const pools = [A.pool, B.pool].sort((x, y) => x - y).join('-');
      const validPair = pools === '1-4' || pools === '2-3';
      const diffRegion = A.region !== B.region;
      return validPair && diffRegion;
    });
  }
  function generate(teams, rng) {
    const byShort = Object.fromEntries(teams.map(t => [t.short, t]));
    const byPool = p => teams.filter(t => t.pool === p).map(t => t.short);
    for (let attempt = 0; attempt < 500; attempt++) {
      const p1 = shuffle(byPool(1), rng), p2 = shuffle(byPool(2), rng),
            p3 = shuffle(byPool(3), rng), p4 = shuffle(byPool(4), rng);
      // QF1: P1 v P4 | QF2: P2 v P3 | QF3: P1 v P4 | QF4: P2 v P3
      // (the two Pool-1 teams land in opposite halves so they can only meet in the final)
      const draw = [p1[0], p4[0], p2[0], p3[0], p1[1], p4[1], p2[1], p3[1]];
      if (satisfies(draw, byShort)) return draw;
    }
    throw new Error('could not satisfy draw constraints');
  }
  function swap(draw, i, j) {
    if (!draw) return draw;
    const d = draw.slice(); const t = d[i]; d[i] = d[j]; d[j] = t; return d;
  }
  // Place a team into slot i, starting from an empty 8-slot bracket if needed.
  // If the team already sits in another slot, it moves (its old slot is cleared).
  function place(draw, i, team) {
    const d = draw ? draw.slice() : new Array(8).fill(null);
    const at = d.indexOf(team);
    if (at >= 0) d[at] = null;
    d[i] = team;
    return d;
  }
  return { __name: 'MSI_Draw', makeRng, satisfies, generate, swap, place };
});
