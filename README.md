# MSI 2026 — Stage 2 Bracket Simulator

Single-file simulator for the 2026 Mid-Season Invitational Stage 2
(8-team double elimination). Draw the seeding, enter results, watch the
winners/losers brackets resolve, and share scenarios by link.

## Run
Open `index.html` in a browser (double-click). Needs internet on first
load to fetch React/Babel from a CDN.

## Develop
- `node --test`        # run all unit tests (engine, standings, draw, persist, data)
- `node build.js`      # regenerate index.html from src/
- `node scripts/fetch-logos.js`  # re-resolve Leaguepedia logo URLs for src/data.js

Logic lives in `src/*.js` (tested with Node). UI is `src/ui.jsx`.
`build.js` concatenates everything into the single `index.html`.

## Data
Teams, pools and format are a snapshot from
<https://lol.fandom.com/wiki/2026_Mid-Season_Invitational>.
Head-to-head history in the match drawer is stubbed for a future version.
