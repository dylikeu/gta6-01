# SOLARA — Streets of Coral Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![make.fun · gta6-01 · rank](https://make.fun/badge/gta6-01/dylikeu/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![make.fun · gta6-01 · reward](https://make.fun/badge/gta6-01/dylikeu/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 3D third-person open-world crime game, built from scratch in Three.js
(vendored, no network requests) — no assets borrowed from anyone. Drive,
steal, run, and climb the ranks of Coral Bay, a sun-soaked harbour city
of nine districts. An entry for the [make.fun](https://make.fun) gta6-01
bounty ("Make GTA 6").

## Play

Open `game/index.html` in a desktop browser, or run `node serve.ts` and
open http://localhost:8080/index.html.

- **Move** — WASD / arrow keys. **Run** — Shift.
- **Enter / exit car** — E (near a parked or traffic car).
- **Drive** — W/S accelerate & brake, A/D steer. **Handbrake** — Space.
- **Aim** — mouse. **Shoot** — mouse click. **Reload** — R.
- **Start mission** — walk into the gold marker and press E.
- **Pause** — P or Esc. **Camera** — drag with the mouse to orbit.

## The city

Nine districts — Coral Pier, Marina Hotel, Sunset Motors, Palm Court,
Neon Beach Club, Coral Bank, Harbor Docks, Lighthouse Point and Coral
Plaza — linked by avenues full of traffic (14 cars) and pedestrians.
Steal a car and the Coral Bay Police respond: a wanted level of 0–5
stars, patrol cars that chase and ram, roadblocks at high heat, and a
police helicopter with a searchlight at the top. Lay low out of sight
and the heat cools off.

## Story — eight missions from Rico, Luna and Mr. Vane

1. **Welcome to Coral Bay** — Rico shows Dante the ropes.
2. **Sunset Courier** — a delivery across town before sundown.
3. **Hot Wheels** — steal three marked cars for the chop shop.
4. **Debt Collector** — settle accounts at Palm Court.
5. **Beach Party Getaway** — lose the cops after the Neon Beach Club.
6. **The Coral Heist** — the bank job, from Mr. Vane.
7. **Harbor Heat** — escape the docks under fire.
8. **King of Coral Bay** — the final job.

Earn cash, climb the ranks, buy better rides, and keep your save in the
browser (localStorage). The radio plays while you drive; the HUD shows
wanted stars, cash, health and armour, a minimap, your weapon and speed.

## Layout

- `game/index.html` — page shell, WebGL canvas, HUD chrome
- `game/src/main.js` — game loop, wiring, shot & test modes
- `game/src/city.js` — city map, districts, buildings
- `game/src/player.js` — on-foot movement, driving, combat
- `game/src/police.js` — wanted level, police chase AI, helicopter
- `game/src/missions.js` — story missions & dialogue
- `game/src/traffic.js` — traffic cars & pedestrians
- `game/src/hud.js` — HUD, minimap, menus, radio
- `game/src/audio.js` — synthesized WebAudio sound effects
- `game/src/save.js` — localStorage save & load
- `game/vendor/three.module.js` — Three.js 0.187.0 (vendored from npm)

`main.ts` hands the entry in: it copies `game/` and `screenshots/` to
`/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json`.

## License

MIT — see LICENSE.
