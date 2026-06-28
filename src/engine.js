(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Source: {seed:n} | {winner:id} | {loser:id}
  const GRAPH = {
    WQF1: { round: 1, a: { seed: 0 }, b: { seed: 1 } },
    WQF2: { round: 1, a: { seed: 2 }, b: { seed: 3 } },
    WQF3: { round: 1, a: { seed: 4 }, b: { seed: 5 } },
    WQF4: { round: 1, a: { seed: 6 }, b: { seed: 7 } },
    LR1A: { round: 1, a: { loser: 'WQF1' }, b: { loser: 'WQF2' } },
    LR1B: { round: 1, a: { loser: 'WQF3' }, b: { loser: 'WQF4' } },
    WSF1: { round: 2, a: { winner: 'WQF1' }, b: { winner: 'WQF2' } },
    WSF2: { round: 2, a: { winner: 'WQF3' }, b: { winner: 'WQF4' } },
    LR2A: { round: 2, a: { winner: 'LR1A' }, b: { loser: 'WSF2' } }, // cross-seed
    LR2B: { round: 2, a: { winner: 'LR1B' }, b: { loser: 'WSF1' } }, // cross-seed
    LR3:  { round: 3, a: { winner: 'LR2A' }, b: { winner: 'LR2B' } },
    WBF:  { round: 4, a: { winner: 'WSF1' }, b: { winner: 'WSF2' } },
    LBF:  { round: 4, a: { winner: 'LR3' },  b: { loser: 'WBF' } },
    GF:   { round: 5, a: { winner: 'WBF' },  b: { winner: 'LBF' } },
  };

  function isValidBo5(a, b) {
    if (a < 0 || b < 0 || a > 3 || b > 3) return false;
    if (a === 3 && b === 3) return false;
    return true;
  }

  function emptyScores() {
    const s = {};
    for (const id of Object.keys(GRAPH)) s[id] = { a: 0, b: 0 };
    return s;
  }

  function resolveSource(src, draw, scores) {
    if ('seed' in src) return draw ? (draw[src.seed] ?? null) : null;
    const r = resolveMatch(src.winner || src.loser, draw, scores);
    if ('winner' in src) return r.winner;
    return r.loser;
  }

  function resolveMatch(matchId, draw, scores) {
    const m = GRAPH[matchId];
    const teamA = resolveSource(m.a, draw, scores);
    const teamB = resolveSource(m.b, draw, scores);
    let winner = null, loser = null;
    const sc = scores[matchId] || { a: 0, b: 0 };
    if (teamA && teamB && isValidBo5(sc.a, sc.b)) {
      if (sc.a === 3) { winner = teamA; loser = teamB; }
      else if (sc.b === 3) { winner = teamB; loser = teamA; }
    }
    return { teamA, teamB, winner, loser };
  }

  // ids strictly downstream of a given match (anything that consumes its winner/loser, transitively)
  function downstreamOf(matchId) {
    const out = new Set();
    let frontier = [matchId];
    while (frontier.length) {
      const next = [];
      for (const id of Object.keys(GRAPH)) {
        const m = GRAPH[id];
        const refs = [m.a, m.b].filter(s => !('seed' in s)).map(s => s.winner || s.loser);
        if (refs.some(r => frontier.includes(r)) && !out.has(id)) { out.add(id); next.push(id); }
      }
      frontier = next;
    }
    return out;
  }

  function setScore(scores, matchId, a, b) {
    const copy = {};
    for (const id of Object.keys(scores)) copy[id] = { a: scores[id].a, b: scores[id].b };
    copy[matchId] = { a, b };
    for (const id of downstreamOf(matchId)) copy[id] = { a: 0, b: 0 };
    return copy;
  }

  return { __name: 'MSI_Engine', GRAPH, isValidBo5, emptyScores, resolveMatch, setScore, downstreamOf };
});
