(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root[api.__name] = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Logos use Leaguepedia "square" variants (the bracket-icon form), shown on a light tile.
  const teams = [
    { short: 'BLG',   name: 'Bilibili Gaming',      region: 'CN',   pool: 1, color: '#1a2a6c', logoUrl: 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/9/91/Bilibili_Gaminglogo_square.png/revision/latest?cb=20260109092043' },
    { short: 'G2',    name: 'G2 Esports',           region: 'EMEA', pool: 1, color: '#ee3d23', logoUrl: 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/7/77/G2_Esportslogo_square.png/revision/latest?cb=20210810013355' },
    { short: 'HLE',   name: 'Hanwha Life Esports',  region: 'KR',   pool: 2, color: '#ff7900', logoUrl: 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/a/a6/Hanwha_Life_Esportslogo_square.png/revision/latest?cb=20211024145058' },
    { short: 'LYON',  name: 'Lyon',                 region: 'NA',   pool: 2, color: '#1e9de3', logoUrl: 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/5/54/LYON_%282024_American_Team%29logo_square.png/revision/latest?cb=20250109185221' },
    { short: 'TSTW',  name: 'Team Secret Whales',   region: 'APAC', pool: 3, color: '#0b8457', logoUrl: 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/a/ac/Team_Secret_Whaleslogo_square.png/revision/latest?cb=20260330071358' },
    { short: 'FURIA', name: 'FURIA',                region: 'BR',   pool: 3, color: '#000000', logoUrl: 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/f/f2/FURIAlogo_square.png/revision/latest?cb=20211007041545' },
    { short: 'TES',   name: 'Top Esports',          region: 'CN',   pool: 4, color: '#e60012', logoUrl: 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/4/46/Top_Esportslogo_square.png/revision/latest?cb=20260109111428' },
    { short: 'PIW',   name: 'Play-In Winner',       region: 'INT',  pool: 4, color: '#6c5ce7', logoUrl: null },
  ];
  const playInCandidates = [
    { short: 'KCORP', name: 'Karmine Corp',      region: 'EMEA', color: '#0a3cff', logoUrl: 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/2/2d/Karmine_Corplogo_square.png/revision/latest?cb=20260110072726' },
    { short: 'T1',    name: 'T1',                region: 'KR',   color: '#e2012d', logoUrl: 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/a/a2/T1logo_square.png/revision/latest?cb=20230512040747' },
    { short: 'TL',    name: 'Team Liquid',       region: 'NA',   color: '#04193e', logoUrl: 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/f/f4/Team_Liquidlogo_square.png/revision/latest?cb=20251229063951' },
    { short: 'DCGTW', name: 'Deep Cross Gaming', region: 'APAC', color: '#00a3a3', logoUrl: 'https://static.wikia.nocookie.net/lolesports_gamepedia_en/images/4/4c/Deep_Cross_Gaminglogo_square.png/revision/latest?cb=20260121020453' },
  ];
  const matchIds = ['WQF1','WQF2','WQF3','WQF4','WSF1','WSF2','WBF','LR1A','LR1B','LR2A','LR2B','LR3','LBF','GF'];
  // Scheduled start times (UTC, ISO) for each bracket slot, from Leaguepedia's
  // MatchSchedule. The UI converts these to the viewer's chosen timezone.
  const schedule = {
    WQF1:'2026-07-03T03:00:00Z', WQF2:'2026-07-03T08:00:00Z',
    WQF3:'2026-07-04T03:00:00Z', WQF4:'2026-07-04T08:00:00Z',
    LR1A:'2026-07-05T03:00:00Z', LR1B:'2026-07-06T03:00:00Z',
    WSF1:'2026-07-05T08:00:00Z', WSF2:'2026-07-06T08:00:00Z',
    LR2A:'2026-07-08T03:00:00Z', LR2B:'2026-07-08T08:00:00Z',
    LR3:'2026-07-10T08:00:00Z',  WBF:'2026-07-09T08:00:00Z',
    LBF:'2026-07-11T08:00:00Z',  GF:'2026-07-12T08:00:00Z',
  };
  // The actual, drawn Stage 2 seeding (published 2026-07-01). Seed positions map
  // to quarterfinals WQF1..WQF4 = [0,1],[2,3],[4,5],[6,7]. The Play-In qualifier
  // (T1) occupies the 'PIW' slot, resolved via playInWinner.
  //   WQF1 HLE v TSTW · WQF2 G2 v TES · WQF3 LYON v FURIA · WQF4 BLG v T1
  const actualDraw = ['HLE', 'TSTW', 'G2', 'TES', 'LYON', 'FURIA', 'BLG', 'PIW'];
  const playInWinner = 'T1';
  return { __name: 'MSI_DATA', teams, playInCandidates, matchIds, schedule, actualDraw, playInWinner };
});
