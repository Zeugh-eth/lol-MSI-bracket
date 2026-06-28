const { useState, useEffect, useMemo, useCallback } = React;
const DATA = MSI_DATA, Engine = MSI_Engine, Standings = MSI_Standings, Draw = MSI_Draw, Persist = MSI_Persist;
const ALL_TEAMS = DATA.teams.concat(DATA.playInCandidates);
const teamByShort = Object.fromEntries(ALL_TEAMS.map(t => [t.short, t]));

function TeamLogo({ short }) {
  const t = teamByShort[short];
  const [err, setErr] = useState(false);
  if (!t) return <span className="badge" style={{ background: '#333' }}>?</span>;
  if (t.logoUrl && !err)
    return <img className="logo" src={t.logoUrl} alt={t.short} onError={() => setErr(true)} />;
  return <span className="badge" style={{ background: t.color }}>{t.short.slice(0, 3)}</span>;
}

function TeamRow({ short, score, isWinner }) {
  const t = short ? teamByShort[short] : null;
  return (
    <div className={'row' + (isWinner ? ' winner' : '')}>
      {short ? <TeamLogo short={short} /> : <span className="badge" style={{ background: '#222' }}> </span>}
      <span className={'name' + (t ? '' : ' tbd')}>{t ? (t.short + ' · ' + t.name) : 'TBD'}</span>
      <span className="score">{short ? score : ''}</span>
    </div>
  );
}

function MatchCard({ id, draw, scores, onOpen }) {
  const r = Engine.resolveMatch(id, draw, scores);
  const sc = scores[id] || { a: 0, b: 0 };
  const live = r.teamA && r.teamB && !r.winner;
  return (
    <div className={'match' + (live ? ' live' : '')} onClick={() => onOpen(id)}>
      <TeamRow short={r.teamA} score={sc.a} isWinner={r.winner && r.winner === r.teamA} />
      <TeamRow short={r.teamB} score={sc.b} isWinner={r.winner && r.winner === r.teamB} />
      <div className="meta"><span>{DATA.dates[id] || 'TBD'}</span><span>BO5</span></div>
    </div>
  );
}

const COLUMNS = [
  { title: 'Round 1', ids: ['WQF1','WQF2','WQF3','WQF4'] },
  { title: 'Round 2', ids: ['WSF1','WSF2'] },
  { title: 'Round 4', ids: ['WBF'] },
];
const LB_COLUMNS = [
  { title: 'LB Round 1', ids: ['LR1A','LR1B'] },
  { title: 'LB Round 2', ids: ['LR2A','LR2B'] },
  { title: 'LB Round 3', ids: ['LR3'] },
  { title: 'LB Final', ids: ['LBF'] },
];

function BracketView({ draw, scores, onOpen }) {
  const col = (c) => (
    <div className="col" key={c.title}>
      <h3>{c.title}</h3>
      {c.ids.map(id => <MatchCard key={id} id={id} draw={draw} scores={scores} onOpen={onOpen} />)}
    </div>
  );
  return (
    <div className="bracket">
      <div className="section-title">Winners' Bracket</div>
      <div className="cols">{COLUMNS.map(col)}
        <div className="col"><h3>Grand Final</h3><MatchCard id="GF" draw={draw} scores={scores} onOpen={onOpen} /></div>
      </div>
      <div className="section-title" style={{ marginTop: 28 }}>Losers' Bracket</div>
      <div className="cols">{LB_COLUMNS.map(col)}</div>
    </div>
  );
}

function TopBar({ onDraw, onReset, onCopy, playInPick, onPick, copied }) {
  return (
    <div className="topbar">
      <h1>MSI 2026 · Stage 2</h1>
      <div className="spacer" />
      <label style={{ color: 'var(--muted)', fontSize: 12 }}>Play-In Winner:&nbsp;
        <select value={playInPick || ''} onChange={e => onPick(e.target.value || null)}>
          <option value="">— TBD —</option>
          {DATA.playInCandidates.map(c => <option key={c.short} value={c.short}>{c.short} · {c.name}</option>)}
        </select>
      </label>
      <button className="btn primary" onClick={onDraw}>⟳ Draw</button>
      <button className="btn" onClick={onCopy}>{copied ? '✓ Copied' : '🔗 Copy link'}</button>
      <button className="btn" onClick={onReset}>Reset</button>
    </div>
  );
}

// Apply the play-in pick: substitute the chosen team's identity into the PIW slot for display.
function applyPlayIn(short) {
  // returns a function mapping a slot short to display short (PIW -> picked team)
  return s => (s === 'PIW' && short ? short : s);
}

function App() {
  const seedRef = React.useRef(1);
  const [draw, setDraw] = useState(null);
  const [scores, setScores] = useState(Engine.emptyScores());
  const [playInPick, setPlayInPick] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [copied, setCopied] = useState(false);

  // hydrate once: URL hash beats localStorage
  useEffect(() => {
    const fromUrl = Persist.decode(location.hash.replace(/^#/, ''));
    const st = fromUrl || Persist.load(window.localStorage);
    if (st) { setDraw(st.draw || null); setScores(st.scores || Engine.emptyScores()); setPlayInPick(st.playInPick || null); }
  }, []);

  // autosave
  useEffect(() => {
    Persist.save({ draw, scores, playInPick }, window.localStorage);
  }, [draw, scores, playInPick]);

  const doDraw = useCallback(() => {
    const rng = Draw.makeRng((seedRef.current = seedRef.current + 1) * 2654435761 >>> 0 ^ Date.now());
    const d = Draw.generate(DATA.teams, rng);
    setDraw(d); setScores(Engine.emptyScores());
  }, []);
  const doReset = useCallback(() => {
    setDraw(null); setScores(Engine.emptyScores()); setPlayInPick(null);
    history.replaceState(null, '', location.pathname);
  }, []);
  const doCopy = useCallback(() => {
    const enc = Persist.encode({ draw, scores, playInPick });
    const url = location.origin + location.pathname + '#' + enc;
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
    history.replaceState(null, '', '#' + enc);
  }, [draw, scores, playInPick]);

  // draw with PIW substituted for display/logic
  const displayDraw = useMemo(() => draw && draw.map(applyPlayIn(playInPick)), [draw, playInPick]);

  return (
    <div>
      <TopBar onDraw={doDraw} onReset={doReset} onCopy={doCopy} playInPick={playInPick} onPick={setPlayInPick} copied={copied} />
      <div className="layout">
        <BracketView draw={displayDraw} scores={scores} onOpen={setOpenId} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
