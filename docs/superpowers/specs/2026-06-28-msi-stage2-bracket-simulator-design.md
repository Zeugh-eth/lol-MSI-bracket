# MSI 2026 Stage 2 Bracket Simulator — Design

**Date:** 2026-06-28
**Status:** Approved

## Summary

A single self-contained `index.html` (React + Babel via CDN, no build step) that
simulates the **2026 Mid-Season Invitational Stage 2** double-elimination bracket.
Users draw the seeding, enter or drag results, and watch the winners and losers
brackets resolve logically. Dark "lolesports primer" aesthetic. Double-click the
file to run in any modern browser — no install, no server.

Data source for teams and format: <https://lol.fandom.com/wiki/2026_Mid-Season_Invitational>
(captured as a baked-in snapshot; see §2).

## Decisions (locked during brainstorming)

| Topic | Decision |
|-------|----------|
| Head-to-head data in drawer | **Out of scope for v1** — drawer stubs it ("coming soon") |
| Stack | **Single self-contained HTML file**, React + Babel standalone via CDN, native HTML5 drag-and-drop |
| Seeding draw | **Pool-aware random draw with reveal animation + manual drag override**, re-runnable |
| Persistence | **localStorage auto-save + shareable/bookmarkable URL** (Copy link), Reset clears both |
| Team display | **Real Leaguepedia logos** + short tag, with a brand-colored badge fallback |

## 1. Scope

In scope:
- Stage 2 bracket: 8-team double elimination, all BO5, with full winners/losers
  logic and automatic result propagation.
- Seeding draw (pool-aware random + manual override).
- Per-match drawer (teams, date, BO5 score entry; H2H stubbed).
- Live standings table (placement derived from progression).
- Persistence (localStorage + shareable URL).

Out of scope for v1:
- Head-to-head / recent-results data in the drawer.
- Simulating the Stage 1 (Play-In) bracket itself. Stage 1 is represented only as a
  **team-picker** that decides which team fills the Stage 2 pool-4 "Play-In Winner"
  slot. (Candidates: KCORP, T1, TL, DCG TW.)

## 2. Data (baked-in snapshot)

A `DATA` object embedded in the file, captured from the wiki:

- **8 Stage-2 teams**, each `{ name, short, region, pool, color, logoUrl }`:
  - BLG (CN, pool 1), G2 (EMEA, pool 1)
  - HLE (KR, pool 2), LYON (NA, pool 2)
  - TSTW (APAC, pool 3), FURIA (BR, pool 3)
  - TES (CN, pool 4), Play-In Winner placeholder (pool 4)
- **Play-In candidate teams**: KCORP (EMEA #2), T1 (KR #2), TL (NA #2), DCG TW (APAC #2),
  used by the play-in-winner selector.
- **Match dates** from the wiki schedule, mapped per bracket slot (best-effort;
  blanks allowed).
- **Logos**: resolved to Leaguepedia image URLs. Each team also carries a brand
  `color` used for the badge fallback when an image fails to load.

A short commented note documents the MediaWiki/Cargo API calls used to capture the
snapshot, so it can be re-pulled later. No live fetching at runtime.

## 3. Bracket model (core logic)

A pure logic layer (functions in-file, no DOM/React dependency) holding **14 match
slots** and a feeder graph so results propagate automatically.

Slots (matching the wiki `8DE` template and the reference screenshot):

- **Winners:** WQF1, WQF2, WQF3, WQF4 → WSF1, WSF2 → WB Final
- **Losers:**
  - LR1 (2 matches): losers of WQF1/WQF2 and WQF3/WQF4
  - LR2 (2 matches): LR1 winners vs WSF losers, **cross-seeded** to avoid an
    immediate rematch (LR1M1 winner faces WSF2 loser, LR1M2 winner faces WSF1 loser)
  - LR3 (1 match): LR2 winners
  - LB Final (1 match): LR3 winner vs WB-Final loser
- **Grand Final:** WB-Final winner vs LB-Final winner (single BO5, no bracket reset)

Column layout (per screenshot): Round 1 = 4 WQF + 2 LR1 (6); Round 2 = 2 WSF + 2 LR2
(4); Round 3 = LR3 (1); Round 4 = WB Final + LB Final (2); Finals = GF (1). Total 14.

Each match: `{ id, round, slotA, slotB, dateISO, scoreA, scoreB }` where a slot is a
team ref or a feeder reference (e.g. "winner of WQF1", "loser of WSF2").

Behavior:
- Setting a BO5 score (first to 3) marks a winner; the winner auto-advances to its
  downstream slot and the loser drops to its losers-bracket destination.
- Clearing/changing a score retracts all downstream consequences and recomputes.
- A small in-file self-test block exercises a full scripted run to guard the
  propagation logic.

## 4. The draw

Pools 1–4 map to bracket entry positions. The **Draw** button randomly assigns the 8
teams to the 4 quarterfinals subject to constraints:
- higher pools meet lower pools (P1/P2 paired against P3/P4),
- same-region teams (notably BLG/TES, both CN) are kept out of the same QF.

The result is revealed with a short sequential animation. After a draw, any team chip
can be **dragged onto any slot** to override (native HTML5 DnD). The draw is
re-runnable. Constraints are a sensible default; manual override covers any case the
real (under-documented) draw rules differ.

## 5. UI

- **Bracket canvas:** Winners bracket on top, losers bracket below, Grand Final to the
  right — column layout matching the reference screenshot, with SVG connector lines.
  Each team row: logo + short tag + score stepper. BO5 badge per match.
- **Match click → right-side drawer:** team names/logos, date, score entry, and a
  stubbed "Head-to-head — coming soon" panel.
- **Standings table:** live placement (1st–8th) derived from progression / point of
  elimination. Ties broken by bracket depth then seed; documented in-code.
- **Top bar:** Draw, Reset, Copy link, and a Play-In Winner selector.

Visual style: dark background, premium MSI-primer feel (deep navy/black, warm
off-white text, pink/red accents as in the screenshot).

## 6. Persistence

The full scenario (draw assignment + all scores + play-in pick) is:
- auto-saved to `localStorage` on every change, restored on load;
- encodable into the URL via **Copy link** (base64/JSON in the hash) for
  sharing/bookmarking; loading such a URL hydrates that scenario.
- **Reset** clears both localStorage and the URL state.

## 7. File layout

Single `index.html`, internally organized into clearly-commented sections:
1. `DATA` snapshot (teams, play-in candidates, dates)
2. Bracket logic functions + self-test block
3. Persistence helpers (localStorage + URL encode/decode)
4. Draw logic
5. React components: `App`, `TopBar`, `BracketView`, `Match`, `TeamChip`,
   `Drawer`, `StandingsTable`
6. Mount

## Risks / notes

- **Logo URLs**: Leaguepedia image URLs may change or rate-limit; the colored-badge
  fallback ensures the UI always renders.
- **Real draw rules** for MSI 2026 are not fully documented; the constraint model is a
  reasonable approximation, and manual override is the escape hatch.
- **Match dates** may be partial in the snapshot; UI tolerates missing dates.
