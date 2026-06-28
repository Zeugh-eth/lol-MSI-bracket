const { useState, useEffect, useMemo, useCallback } = React;
const DATA = MSI_DATA, Engine = MSI_Engine, Standings = MSI_Standings, Draw = MSI_Draw, Persist = MSI_Persist;
const ALL_TEAMS = DATA.teams.concat(DATA.playInCandidates);
const teamByShort = Object.fromEntries(ALL_TEAMS.map(t => [t.short, t]));

// Date display: "2026-07-01" -> "July 1st, Wednesday"
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function ordinal(n) {
  const v = n % 100, s = ['th','st','nd','rd'];
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function fmtDate(iso) {
  if (!iso) return 'Date TBD';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return MONTHS[d.getMonth()] + ' ' + ordinal(d.getDate()) + ', ' + WEEKDAYS[d.getDay()];
}

function TeamLogo({ short }) {
  const t = teamByShort[short];
  const [err, setErr] = useState(false);
  if (!t) return <span className="badge" style={{ background: '#333' }}>?</span>;
  if (t.logoUrl && !err)
    return <img className="logo" src={t.logoUrl} alt={t.short} onError={() => setErr(true)} />;
  return <span className="badge" style={{ background: t.color }}>{t.short.slice(0, 3)}</span>;
}

function TeamRow({ short, score, isWinner, seedIndex, onSwap, onPlace, onDoubleClick }) {
  const t = short ? teamByShort[short] : null;
  const slot = seedIndex != null; // QF rows are the seed slots (drag source + drop target)
  return (
    <div className={'row' + (isWinner ? ' winner' : '')}
      draggable={slot && !!short}
      onDragStart={slot && short ? e => e.dataTransfer.setData('text/seed', String(seedIndex)) : undefined}
      onDragOver={slot ? e => e.preventDefault() : undefined}
      onDrop={slot ? e => {
        e.preventDefault();
        const team = e.dataTransfer.getData('text/team');
        if (team) { if (onPlace) onPlace(team, seedIndex); return; }
        const from = parseInt(e.dataTransfer.getData('text/seed'), 10);
        if (!isNaN(from) && from !== seedIndex && onSwap) onSwap(from, seedIndex);
      } : undefined}
      onDoubleClick={onDoubleClick}
      title={onDoubleClick ? 'Double-click to set this team as a 3–0 winner' : undefined}
    >
      {short ? <TeamLogo short={short} /> : <span className="badge" style={{ background: '#222' }}> </span>}
      <span className={'name' + (t ? '' : ' tbd')}>{t ? (t.short + ' · ' + t.name) : 'TBD'}</span>
      <span className="score">{short ? score : ''}</span>
    </div>
  );
}

// Bench of teams not yet placed in the bracket. Drag one onto a quarterfinal
// slot to seed it manually — no draw required. Carries the RAW short (e.g. 'PIW').
function ChipTray({ draw, playInPick }) {
  const placed = new Set((draw || []).filter(Boolean));
  const bench = DATA.teams.map(t => t.short).filter(s => !placed.has(s));
  if (bench.length === 0) return null;
  const disp = applyPlayIn(playInPick);
  return (
    <div className="poolbar">
      <span className="bench-label">Drag teams into the bracket ↴</span>
      {bench.map(short => {
        const shown = disp(short);
        const t = teamByShort[shown];
        const hasLogo = t && t.logoUrl; // avoid "PIW PIW" when a badge already prints the code
        return (
          <div className="chip" key={short} draggable
               onDragStart={e => e.dataTransfer.setData('text/team', short)}>
            <TeamLogo short={shown} />{hasLogo ? <span>{t.short}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function MatchCard({ id, draw, scores, onOpen, justDrew, onSwap, onPlace, onQuickWin, selected }) {
  const r = Engine.resolveMatch(id, draw, scores);
  const sc = scores[id] || { a: 0, b: 0 };
  const live = r.teamA && r.teamB && !r.winner;
  const revealClass = justDrew && id.startsWith('WQF') ? ' reveal' : '';
  const isQF = id.startsWith('WQF');
  const g = isQF ? Engine.GRAPH[id] : null;
  const bothPresent = r.teamA && r.teamB;
  // Debounce single-click (open drawer) so a double-click (quick 3-0) doesn't also open it.
  const clickT = React.useRef(null);
  const handleClick = () => {
    if (clickT.current) return;
    clickT.current = setTimeout(() => { clickT.current = null; onOpen(id); }, 180);
  };
  const quickWin = side => e => {
    e.stopPropagation();
    if (clickT.current) { clearTimeout(clickT.current); clickT.current = null; }
    onQuickWin(id, side);
  };
  return (
    <div className={'match' + (live ? ' live' : '') + (selected ? ' selected' : '') + revealClass} onClick={handleClick}>
      <TeamRow short={r.teamA} score={sc.a} isWinner={r.winner && r.winner === r.teamA}
        seedIndex={isQF ? g.a.seed : undefined} onSwap={isQF ? onSwap : undefined} onPlace={isQF ? onPlace : undefined}
        onDoubleClick={bothPresent ? quickWin('a') : undefined} />
      <TeamRow short={r.teamB} score={sc.b} isWinner={r.winner && r.winner === r.teamB}
        seedIndex={isQF ? g.b.seed : undefined} onSwap={isQF ? onSwap : undefined} onPlace={isQF ? onPlace : undefined}
        onDoubleClick={bothPresent ? quickWin('b') : undefined} />
      <div className="meta"><span className="date">{fmtDate(DATA.dates[id])}</span><span className="bo5">BO5</span></div>
    </div>
  );
}

const MEDAL = { 1: 'gold', 2: 'silver', 3: 'bronze' };
function StandingsTable({ draw, scores }) {
  if (!draw) return <div className="standings"><div className="section-title">Standings</div><div className="standings-empty">Draw teams to begin.</div></div>;
  const rows = Standings.compute(Engine, draw, scores);
  return (
    <div className="standings">
      <div className="section-title">Standings</div>
      <table><tbody>
        {rows.map(r => {
          // Decided top-3 get a medal class (and are NOT shown as eliminated);
          // other eliminated teams are muted/struck; still-alive teams are normal.
          const medal = (!r.alive && MEDAL[r.place]) ? MEDAL[r.place] : '';
          const cls = medal || (!r.alive ? 'out' : '');
          return (
            <tr key={r.short} className={cls}>
              <td className="pl">{r.placeLabel}</td>
              <td><TeamLogo short={r.short} /></td>
              <td>{teamByShort[r.short] ? teamByShort[r.short].name : r.short}</td>
            </tr>
          );
        })}
      </tbody></table>
    </div>
  );
}

function RulesBox() {
  return (
    <div className="standings rules">
      <div className="section-title">Format</div>
      <ul className="rules-list">
        <li><b>8 teams</b>, single bracket, <b>double elimination</b></li>
        <li>Every match is a <b>Best of 5</b></li>
        <li>Lose once → you drop to the <b>Losers' Bracket</b></li>
        <li>Lose <b>twice</b> → you're eliminated</li>
        <li>Quarterfinals seed <b>Pool 1 v 4</b> and <b>Pool 2 v 3</b></li>
        <li>The <b>champion</b> qualifies for Worlds 2026</li>
      </ul>
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
          <div className="drawer-date">{fmtDate(DATA.dates[id])}</div>
          <div className="scorebox"><span><TeamLogo short={r.teamA} /> {nameOf(r.teamA)}</span><Stepper value={sc.a} onChange={setA} /></div>
          <div className="scorebox"><span><TeamLogo short={r.teamB} /> {nameOf(r.teamB)}</span><Stepper value={sc.b} onChange={setB} /></div>
          {r.winner && <div className="winner-tag">Winner — {nameOf(r.winner)}</div>}
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

function BracketView({ draw, scores, onOpen, justDrew, onSwap, onPlace, onQuickWin, openId }) {
  const mc = (id) => <MatchCard key={id} id={id} draw={draw} scores={scores} onOpen={onOpen}
    justDrew={justDrew} onSwap={onSwap} onPlace={onPlace} onQuickWin={onQuickWin} selected={id === openId} />;
  const col = (c) => (
    <div className="col" key={c.title}>
      <h3>{c.title}</h3>
      {c.ids.map(mc)}
    </div>
  );
  return (
    <div className="bracket">
      <div className="section-title">Winners' Bracket</div>
      <div className="cols">{COLUMNS.map(col)}
        <div className="col"><h3>Grand Final</h3>{mc('GF')}</div>
      </div>
      <div className="section-title" style={{ marginTop: 28 }}>Losers' Bracket</div>
      <div className="cols">{LB_COLUMNS.map(col)}</div>
    </div>
  );
}

function TopBar({ onDraw, onReset, onCopy, playInPick, onPick, copied }) {
  return (
    <div className="topbar">
      <div className="brand">
        <span className="brand-word">MSI<em>26</em></span>
        <span className="brand-tag">Stage 2 · Bracket</span>
      </div>
      <div className="spacer" />
      <label className="pick">Play-In Winner
        <select value={playInPick || ''} onChange={e => onPick(e.target.value || null)}>
          <option value="">— TBD —</option>
          {DATA.playInCandidates.map(c => <option key={c.short} value={c.short}>{c.short} · {c.name}</option>)}
        </select>
      </label>
      <button className="btn primary" onClick={onDraw}>↯ Draw</button>
      <button className="btn" onClick={onCopy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
      <button className="btn ghost" onClick={onReset}>Reset</button>
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
  const doPlace = useCallback((team, seedIndex) => setDraw(d => Draw.place(d, seedIndex, team)), []);
  const doQuickWin = useCallback((id, side) => setScores(s => Engine.setScore(s, id, side === 'a' ? 3 : 0, side === 'a' ? 0 : 3)), []);

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
      <ChipTray draw={draw} playInPick={playInPick} />
      <div className="layout">
        <BracketView draw={displayDraw} scores={scores} onOpen={setOpenId} justDrew={justDrew} onSwap={doSwap} onPlace={doPlace} onQuickWin={doQuickWin} openId={openId} />
        <div className="side">
          <StandingsTable draw={displayDraw} scores={scores} />
          <RulesBox />
        </div>
      </div>
      <Drawer id={openId} draw={displayDraw} scores={scores} onScore={doScore} onClose={() => setOpenId(null)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
