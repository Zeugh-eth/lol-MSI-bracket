(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const teams = [
    { short: 'BLG',   name: 'Bilibili Gaming',      region: 'CN',   pool: 1, color: '#1a2a6c', logoUrl: null },
    { short: 'G2',    name: 'G2 Esports',           region: 'EMEA', pool: 1, color: '#ee3d23', logoUrl: null },
    { short: 'HLE',   name: 'Hanwha Life Esports',  region: 'KR',   pool: 2, color: '#ff7900', logoUrl: null },
    { short: 'LYON',  name: 'Lyon',                 region: 'NA',   pool: 2, color: '#1e9de3', logoUrl: 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/0/01/LYON_%282024_American_Team%29logo_profile.png/revision/latest?cb=20251223131015' },
    { short: 'TSTW',  name: 'Team Secret Whales',   region: 'APAC', pool: 3, color: '#0b8457', logoUrl: null },
    { short: 'FURIA', name: 'FURIA',                region: 'BR',   pool: 3, color: '#000000', logoUrl: null },
    { short: 'TES',   name: 'Top Esports',          region: 'CN',   pool: 4, color: '#e60012', logoUrl: null },
    { short: 'PIW',   name: 'Play-In Winner',       region: 'INT',  pool: 4, color: '#6c5ce7', logoUrl: null },
  ];
  const playInCandidates = [
    { short: 'KCORP', name: 'Karmine Corp',      region: 'EMEA', color: '#0a3cff', logoUrl: null },
    { short: 'T1',    name: 'T1',                region: 'KR',   color: '#e2012d', logoUrl: null },
    { short: 'TL',    name: 'Team Liquid',       region: 'NA',   color: '#04193e', logoUrl: null },
    { short: 'DCGTW', name: 'Deep Cross Gaming', region: 'APAC', color: '#00a3a3', logoUrl: 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/d/d7/Deep_Cross_Gaminglogo_profile.png/revision/latest?cb=20260121020201' },
  ];
  const matchIds = ['WQF1','WQF2','WQF3','WQF4','WSF1','WSF2','WBF','LR1A','LR1B','LR2A','LR2B','LR3','LBF','GF'];
  // Best-effort dates from the wiki schedule; null where unknown. Edit as schedule firms up.
  const dates = {
    WQF1:'2026-07-01', WQF2:'2026-07-01', WQF3:'2026-07-02', WQF4:'2026-07-02',
    LR1A:'2026-07-03', LR1B:'2026-07-03', WSF1:'2026-07-04', WSF2:'2026-07-04',
    LR2A:'2026-07-05', LR2B:'2026-07-05', LR3:'2026-07-06', WBF:'2026-07-08',
    LBF:'2026-07-10', GF:'2026-07-11',
  };
  return { __name: 'MSI_DATA', teams, playInCandidates, matchIds, dates };
});
