(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Where a loss eliminates you -> finishing place. (GF loser = 2nd, GF winner = 1st handled separately.)
  const ELIM_PLACE = {
    LR1A: 7, LR1B: 7, // out in losers round 1
    LR2A: 5, LR2B: 5, // out in losers round 2
    LR3: 4,           // out in losers round 3
    LBF: 3,           // out in losers final
  };
  const LABELS = { 1:'1st', 2:'2nd', 3:'3rd', 4:'4th', 5:'5th–6th', 7:'7th–8th' };

  function compute(Engine, draw, scores) {
    const place = {};   // short -> number
    const alive = {};   // short -> bool
    for (const t of (draw || [])) if (t) alive[t] = true;

    // losers-bracket + LB final eliminations
    for (const id of Object.keys(ELIM_PLACE)) {
      const r = Engine.resolveMatch(id, draw, scores);
      if (r.loser) { place[r.loser] = ELIM_PLACE[id]; alive[r.loser] = false; }
    }
    // grand final
    const gf = Engine.resolveMatch('GF', draw, scores);
    if (gf.winner) { place[gf.winner] = 1; alive[gf.winner] = false;
                     place[gf.loser] = 2; alive[gf.loser] = false; }

    const rows = (draw || []).filter(Boolean).map(short => ({
      short,
      place: place[short] != null ? place[short] : null,
      placeLabel: place[short] != null ? LABELS[place[short]] : '—',
      alive: alive[short] !== false,
    }));
    rows.sort((x, y) => {
      // Still-competing teams lead the table; eliminated teams sink to the
      // bottom ordered by finishing place. Once the tournament completes,
      // every team is eliminated, so this collapses to pure 1st..8th order.
      if (x.alive !== y.alive) return x.alive ? -1 : 1;
      const px = x.place == null ? 99 : x.place;
      const py = y.place == null ? 99 : y.place;
      if (px !== py) return px - py;
      return x.short.localeCompare(y.short);
    });
    return rows;
  }

  return { __name: 'MSI_Standings', compute };
});
