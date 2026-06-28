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
