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

function TeamRow({ short, score, isWinner, seedIndex, onSwap }) {
  const t = short ? teamByShort[short] : null;
  const droppable = onSwap != null;
  return (
    <div className={'row' + (isWinner ? ' winner' : '')}
      onDragOver={droppable ? e => e.preventDefault() : undefined}
      onDrop={droppable ? e => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData('text/seed'), 10);
        if (!isNaN(from) && from !== seedIndex) onSwap(from, seedIndex);
      } : undefined}
    >
      {short ? <TeamLogo short={short} /> : <span className="badge" style={{ background: '#222' }}> </span>}
      <span className={'name' + (t ? '' : ' tbd')}>{t ? (t.short + ' · ' + t.name) : 'TBD'}</span>
      <span className="score">{short ? score : ''}</span>
    </div>
  );
}

function ChipTray({ draw }) {
  if (!draw) return null;
  return (
    <div className="poolbar">
      {draw.map((short, i) => {
        const t = teamByShort[short];
        // Only append text label when team has a real logo (img), so the badge fallback
        // (which already prints the short code) doesn't cause "HLE HLE" duplication.
        const hasLogo = t && t.logoUrl;
        return (
          <div className="chip" key={i} draggable
               onDragStart={e => e.dataTransfer.setData('text/seed', String(i))}>
            <TeamLogo short={short} />{hasLogo ? <span>{t.short}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function MatchCard({ id, draw, scores, onOpen, justDrew, onSwap }) {
  const r = Engine.resolveMatch(id, draw, scores);
  const sc = scores[id] || { a: 0, b: 0 };
  const live = r.teamA && r.teamB && !r.winner;
  const revealClass = justDrew && id.startsWith('WQF') ? ' reveal' : '';
  const isQF = id.startsWith('WQF');
  const g = isQF ? Engine.GRAPH[id] : null;
  return (
    <div className={'match' + (live ? ' live' : '') + revealClass} onClick={() => onOpen(id)}>
      <TeamRow short={r.teamA} score={sc.a} isWinner={r.winner && r.winner === r.teamA}
        seedIndex={isQF ? g.a.seed : undefined} onSwap={isQF ? onSwap : undefined} />
      <TeamRow short={r.teamB} score={sc.b} isWinner={r.winner && r.winner === r.teamB}
        seedIndex={isQF ? g.b.seed : undefined} onSwap={isQF ? onSwap : undefined} />
      <div className="meta"><span>{DATA.dates[id] || 'TBD'}</span><span>BO5</span></div>
    </div>
  );
}

function StandingsTable({ draw, scores }) {
  if (!draw) return <div className="standings"><div className="section-title">Standings</div><div style={{color:'var(--muted)'}}>Draw teams to begin.</div></div>;
  const rows = Standings.compute(Engine, draw, scores);
  return (
    <div className="standings">
      <div className="section-title">Standings</div>
      <table><tbody>
        {rows.map(r => (
          <tr key={r.short} className={r.alive ? '' : 'out'}>
            <td className="pl">{r.placeLabel}</td>
            <td><TeamLogo short={r.short} /></td>
            <td>{teamByShort[r.short] ? teamByShort[r.short].name : r.short}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}

function Stepper({ value, onChange }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(0, value - 1))}>−</button>
      <span className="score" style={{ fontSize: 18 }}>{value}</span>
      <button onClick={() => onChange(Math.min(3, value + 1))}>+</button>
    </div>
  );
}

function Drawer({ id, draw, scores, onScore, onClose }) {
  const isOpen = !!id;
  const r = isOpen ? Engine.resolveMatch(id, draw, scores) : {};
  const sc = isOpen ? (scores[id] || { a: 0, b: 0 }) : { a: 0, b: 0 };
  const setA = v => { if (Engine.isValidBo5(v, sc.b)) onScore(id, v, sc.b); };
  const setB = v => { if (Engine.isValidBo5(sc.a, v)) onScore(id, sc.a, v); };
  const nameOf = s => (s ? (teamByShort[s] ? teamByShort[s].name : s) : 'TBD');
  return (
    <>
      <div className={'drawer-backdrop' + (isOpen ? '' : ' hidden')} onClick={onClose} />
      <div className={'drawer' + (isOpen ? ' open' : '')}>
        {isOpen && <>
          <button className="close" onClick={onClose}>×</button>
          <h2>{id} · BO5</h2>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>{DATA.dates[id] || 'Date TBD'}</div>
          <div className="scorebox"><span><TeamLogo short={r.teamA} /> {nameOf(r.teamA)}</span><Stepper value={sc.a} onChange={setA} /></div>
          <div className="scorebox"><span><TeamLogo short={r.teamB} /> {nameOf(r.teamB)}</span><Stepper value={sc.b} onChange={setB} /></div>
          {r.winner && <div style={{ color: 'var(--win)', fontWeight: 700 }}>Winner: {nameOf(r.winner)}</div>}
          <div className="h2h">Head-to-head history<br /><small>coming soon</small></div>
        </>}
      </div>
    </>
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

function BracketView({ draw, scores, onOpen, justDrew, onSwap }) {
  const col = (c) => (
    <div className="col" key={c.title}>
      <h3>{c.title}</h3>
      {c.ids.map(id => <MatchCard key={id} id={id} draw={draw} scores={scores} onOpen={onOpen} justDrew={justDrew} onSwap={onSwap} />)}
    </div>
  );
  return (
    <div className="bracket">
      <div className="section-title">Winners' Bracket</div>
      <div className="cols">{COLUMNS.map(col)}
        <div className="col"><h3>Grand Final</h3><MatchCard id="GF" draw={draw} scores={scores} onOpen={onOpen} justDrew={justDrew} onSwap={onSwap} /></div>
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
  const firstSave = React.useRef(true);
  const [draw, setDraw] = useState(null);
  const [scores, setScores] = useState(Engine.emptyScores());
  const [playInPick, setPlayInPick] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [justDrew, setJustDrew] = useState(false);

  // hydrate once: URL hash beats localStorage
  useEffect(() => {
    const fromUrl = Persist.decode(location.hash.replace(/^#/, ''));
    const st = fromUrl || Persist.load(window.localStorage);
    if (st) { setDraw(st.draw || null); setScores(st.scores || Engine.emptyScores()); setPlayInPick(st.playInPick || null); }
  }, []);

  // autosave
  useEffect(() => {
    if (firstSave.current) { firstSave.current = false; return; }
    Persist.save({ draw, scores, playInPick }, window.localStorage);
    if (location.hash) history.replaceState(null, '', location.pathname);
  }, [draw, scores, playInPick]);

  const doScore = useCallback((id, a, b) => setScores(s => Engine.setScore(s, id, a, b)), []);
  const doSwap = useCallback((i, j) => setDraw(d => Draw.swap(d, i, j)), []);

  const doDraw = useCallback(() => {
    const rng = Draw.makeRng((seedRef.current = seedRef.current + 1) * 2654435761 >>> 0 ^ Date.now());
    const d = Draw.generate(DATA.teams, rng);
    setDraw(d); setScores(Engine.emptyScores());
    setJustDrew(true); setTimeout(() => setJustDrew(false), 700);
  }, []);
  const doReset = useCallback(() => {
    setDraw(null); setScores(Engine.emptyScores()); setPlayInPick(null);
    history.replaceState(null, '', location.pathname);
  }, []);
  const doCopy = useCallback(() => {
    const enc = Persist.encode({ draw, scores, playInPick });
    const url = location.href.split('#')[0] + '#' + enc;
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
    history.replaceState(null, '', '#' + enc);
  }, [draw, scores, playInPick]);

  // draw with PIW substituted for display/logic
  const displayDraw = useMemo(() => draw && draw.map(applyPlayIn(playInPick)), [draw, playInPick]);

  return (
    <div>
      <TopBar onDraw={doDraw} onReset={doReset} onCopy={doCopy} playInPick={playInPick} onPick={setPlayInPick} copied={copied} />
      <ChipTray draw={displayDraw} />
      <div className="layout">
        <BracketView draw={displayDraw} scores={scores} onOpen={setOpenId} justDrew={justDrew} onSwap={doSwap} />
        <StandingsTable draw={displayDraw} scores={scores} />
      </div>
      <Drawer id={openId} draw={displayDraw} scores={scores} onScore={doScore} onClose={() => setOpenId(null)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
