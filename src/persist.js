(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const KEY = 'msi2026sim';
  function b64encode(str) {
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64decode(b64) {
    if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8');
    return decodeURIComponent(escape(atob(b64)));
  }
  function encode(state) { return b64encode(JSON.stringify(state)); }
  function decode(str) {
    if (!str) return null;
    try { const o = JSON.parse(b64decode(str)); return (o && typeof o === 'object') ? o : null; }
    catch (e) { return null; }
  }
  function save(state, storage) { try { storage.setItem(KEY, encode(state)); } catch (e) {} }
  function load(storage) { try { return decode(storage.getItem(KEY)); } catch (e) { return null; } }

  // ---- Compact share link (scheme v1) ---------------------------------------
  // A scenario is fully reconstructable from the draw + each match's decided
  // result (the engine derives everything downstream). We pack:
  //   draw: 8 slots x 4 bits  (team index 0-7, 15 = empty)
  //   play-in pick: 3 bits    (0 = none, 1-4 = candidate index + 1)
  //   results: per match 3 bits (0 unplayed; 1/2/3 = A wins 3-0/3-1/3-2;
  //            4/5/6 = B wins 3-0/3-1/3-2), trailing-unplayed trimmed
  // then base64url, prefixed with "~1" (the "~" never appears in base64url, so
  // legacy base64-JSON links are unambiguous). In-progress (undecided) scores
  // are intentionally not carried — only decided results.
  function bytesToB64url(bytes) {
    let b64;
    if (typeof Buffer !== 'undefined') b64 = Buffer.from(bytes).toString('base64');
    else { let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); b64 = btoa(bin); }
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlToBytes(s) {
    let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    if (typeof Buffer !== 'undefined') return Array.from(Buffer.from(b64, 'base64'));
    const bin = atob(b64); const out = []; for (let i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i));
    return out;
  }
  function resultCode(sc) {
    const a = (sc && sc.a) || 0, b = (sc && sc.b) || 0;
    if (a === 3 && b < 3) return 1 + b;   // A wins, loser games b (0-2) -> 1,2,3
    if (b === 3 && a < 3) return 4 + a;   // B wins -> 4,5,6
    return 0;                              // unplayed / in-progress
  }
  function encodeShare(state, schema) {
    const { teams, candidates, matchIds } = schema;
    const bits = [];
    const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
    const draw = state.draw || [];
    for (let s = 0; s < 8; s++) {
      const t = draw[s]; const idx = t ? teams.indexOf(t) : -1;
      push(idx < 0 ? 15 : idx, 4);
    }
    const pick = state.playInPick ? candidates.indexOf(state.playInPick) + 1 : 0;
    push(pick < 0 ? 0 : pick, 3);
    const codes = matchIds.map(id => resultCode(state.scores && state.scores[id]));
    let last = -1; for (let i = 0; i < codes.length; i++) if (codes[i] !== 0) last = i;
    for (let i = 0; i <= last; i++) push(codes[i], 3); // trailing unplayed trimmed
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
      bytes.push(b);
    }
    return '~1' + bytesToB64url(bytes);
  }
  function decodeCompact(payload, schema) {
    const { teams, candidates, matchIds } = schema;
    const bytes = b64urlToBytes(payload);
    const bits = [];
    for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
    let p = 0; const read = n => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | (bits[p++] || 0); return v; };
    const draw = [];
    for (let s = 0; s < 8; s++) { const idx = read(4); draw.push(idx === 15 ? null : (teams[idx] || null)); }
    const pv = read(3); const playInPick = pv === 0 ? null : (candidates[pv - 1] || null);
    const scores = {}; for (const id of matchIds) scores[id] = { a: 0, b: 0 };
    for (let m = 0; m < matchIds.length; m++) {
      if (p + 3 > bits.length) break;
      const code = read(3);
      if (code === 0) continue;
      scores[matchIds[m]] = code <= 3 ? { a: 3, b: code - 1 } : { a: code - 4, b: 3 };
    }
    return { draw, scores, playInPick };
  }
  // Decode a share string: compact ("~1...") or legacy base64-JSON.
  function decodeShare(str, schema) {
    if (!str) return null;
    if (str[0] === '~') {
      if (str[1] !== '1') return null; // unknown future scheme version
      try { return decodeCompact(str.slice(2), schema); } catch (e) { return null; }
    }
    return decode(str); // legacy links / older format
  }

  return { __name: 'MSI_Persist', KEY, encode, decode, save, load, encodeShare, decodeShare };
});
