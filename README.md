# lol-MSI-bracket

A single-file, fan-made simulator for the **2026 Mid-Season Invitational — Stage 2**
(8-team double elimination, all BO5). Draw the seeding, enter results, and watch the
winners and losers brackets resolve — then share the scenario by link.

Built for fans, to make it easy to picture **how Stage 2 might play out**.

## Usage

This is a **non-commercial fan project**. It is intended for personal, fan, and
educational use only — please don't use it commercially.

> Not affiliated with, endorsed, or sponsored by Riot Games. League of Legends,
> the Mid-Season Invitational, MSI, team names, and team logos are trademarks or
> property of their respective owners. Team data, the format, and logos are drawn
> from the community wiki ([Leaguepedia](https://lol.fandom.com/wiki/2026_Mid-Season_Invitational))
> and are used here for non-commercial, illustrative purposes.

The code is released under the [MIT License](LICENSE). (Note: MIT is a permissive
license that does not by itself legally restrict commercial use — the non-commercial
line above is the intended use of this fan project, and the Riot trademarks/logos are
not ours to license.)

## Run

Open `index.html` in a browser (double-click). It's fully self-contained; it only
needs an internet connection on first load to pull React/Babel and fonts from a CDN
and to fetch team logos.

## Features

- **Seeding draw** — pool-aware (Pool 1 v 4, Pool 2 v 3), with a reveal animation
- **Manual override** — drag team chips onto quarterfinal slots
- **Result entry** — click a match, set the BO5 score; winners advance and losers
  drop through the losers' bracket automatically (and retract if you change a result)
- **Live standings** — 1st–8th derived from how far each team goes
- **Shareable** — a "Copy link" button encodes the whole scenario into the URL;
  state also auto-saves locally

## Develop

```bash
node --test            # run the unit tests (engine, standings, draw, persistence, data)
node build.js          # regenerate index.html from src/
node scripts/fetch-logos.js   # re-resolve Leaguepedia logo URLs for src/data.js
```

Pure logic lives in `src/*.js` (UMD-guarded, tested with Node). The React UI is
`src/ui.jsx`. `build.js` concatenates everything into the single `index.html` —
React + Babel come from a CDN, so there is no build toolchain to install.

## Data

Teams, pools, format, and the schedule are a snapshot from the
[2026 MSI Leaguepedia page](https://lol.fandom.com/wiki/2026_Mid-Season_Invitational).
Re-run the fetch helper to refresh logos as the bracket firms up.
