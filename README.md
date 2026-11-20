# VELMARA — Streets of the Sun

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![make.fun · gta6-01 · rank](https://make.fun/badge/gta6-01/dylikeu/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![make.fun · gta6-01 · reward](https://make.fun/badge/gta6-01/dylikeu/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 2D top-down open-world crime game, built from scratch in vanilla canvas
JavaScript — no libraries, no network requests, no assets borrowed from
anyone. Drive, steal, run, and climb the ranks of Velmara, a sun-baked
harbour city of five districts.

## Play

Open `game/index.html` in a desktop browser, or run `node serve.ts` and
open http://localhost:8080/index.html.

- **Move** — WASD / arrow keys. **Sprint** — Shift.
- **Enter / exit car** — E (near a parked or traffic car).
- **Drive** — W/S accelerate & brake, A/D steer. **Handbrake** — Space.
- **Punch / shoot** — mouse click (aim with the mouse). **Reload** — R.
- **Start mission** — walk into the gold marker and press E.
- **Pause** — P or Esc. **Mute** — M. **Save** — automatic + button on pause.

## The city

Five districts — Sunport Marina, Downtown, Coral Row, Palm Yards and the
Old Harbour — linked by avenues full of traffic and pedestrians. Steal a
car and the Velmara Police respond: a wanted level of 0–5 stars, patrol
cars that chase, roadblocks at high heat, and arrest if they catch you
on foot. Lay low out of sight and the heat cools off.

## Story — six missions from Mara Kline

1. **The Getaway** — grab the courier car and lose the patrol.
2. **Harbour Lights** — photograph the smugglers' dock (stay unseen).
3. **Hot Wheels** — steal three marked cars for the chop shop.
4. **Payback** — settle the score with the rival crew at the yards.
5. **The Long Night** — escort Mara's van across town under fire.
6. **King of the Sun** — the final heist at the marina casino boat.

Earn cash, climb ranks from Wheelman to King of the Sun, buy better rides
at the dealership, and keep your save in the browser (localStorage).

## Self-test

Open `game/index.html?test=1` — fifteen automated checks run in-page
(movement, driving, stealing, wanted stars, police chase, missions,
combat, save/load) and report pass/fail with zero console errors.

## Layout

- `game/index.html` — page shell, canvas, HUD chrome
- `game/src/main.js` — game loop, wiring, shot & test modes
- `game/src/core/` — math helpers, shared game state
- `game/src/city/` — city map, traffic & pedestrians
- `game/src/player/` — on-foot movement, driving, combat
- `game/src/police/` — wanted level, police chase AI
- `game/src/missions/` — story missions & dialogue
- `game/src/hud/` — HUD, minimap, menus
- `game/src/audio/` — synthesized WebAudio sound effects
- `game/src/save/` — localStorage save & load

`main.ts` hands the entry in: it copies `game/` and `screenshots/` to
`/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json`.

## License

MIT — see LICENSE.
