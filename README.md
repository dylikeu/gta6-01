# SOLARA — Streets of Coral Bay

[![Make.fun — gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?ref=ec115nvc)
[![Rank](https://make.fun/badge/gta6-01/dylikeu/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01?ref=ec115nvc)
[![Reward](https://make.fun/badge/gta6-01/dylikeu/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?ref=ec115nvc)

An original open-world crime game in the spirit of GTA 6, built for the [gta6-01 bounty](https://make.fun/bounty/gta6-01?ref=ec115nvc) on make.fun. Dante Cruz is back in Coral Bay, a fictional sunset beach city: steal cars, outrun the Coral Bay PD, and take all eight story jobs from Marisol Vega.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: the game is static files under `game/`, with a vendored minified three.js build (`game/vendor/three.module.min.js`). It runs in desktop Chrome.

## How to play

- **WASD** — move on foot / drive · **SHIFT** — sprint
- **E** — enter or exit a car, advance dialogue
- **SPACE** or **CLICK** — shoot the pistol (handbrake while driving)
- **Q** — rob a nearby pedestrian · **R** — reload · **T** — change radio station
- **M** — start the next job · **P** — pause

## What is in the game

- A 3D sunset city: Ocean Drive, the beach and the pier, colourful low-poly buildings, palms, traffic and pedestrians
- Third-person on foot and driving, with cars to steal (parked cars, traffic, even police cruisers)
- A wanted system (0–5 stars) with patrol cars that chase and ram, and a police helicopter with a searchlight at 3 stars and above
- Eight story jobs with portrait dialogue: car theft, deliveries, a pickup, a marina shootout, a bank robbery, harbour runs, a 60-second getaway chase, and the final mansion takeover
- A money economy (jobs, robberies, cash pickups), health and armour, a pistol with reloads
- A full HUD: wanted stars, money, health/armour bars, weapon slot, radio station and song, mission objective, dialogue box, and a live circular minimap
- Three generative radio stations, engine and siren sounds, and effects (dust, sparks, smoke, explosions) — all synthesized in the browser
- A save (money and jobs) in localStorage, with Continue on the menu

## Layout

- `game/src/main.js` — bootstrap, game loop, state machine, save
- `game/src/city.js` — Coral Bay: sky, sea, beach, roads, buildings, palms, pier
- `game/src/vehicles.js` — the car factory and city traffic
- `game/src/pedestrians.js` — walkers and mission characters
- `game/src/police.js` — wanted system, patrol cars, helicopter
- `game/src/player.js` — Dante on foot, enter/exit car
- `game/src/drive.js` — arcade car physics
- `game/src/weapons.js` — pistol, robbery, tracers
- `game/src/missions.js` — the eight story jobs and their dialogue
- `game/src/hud.js` — HUD, minimap, dialogue, menus
- `game/src/audio.js` — synth engine, radio and sound effects
- `game/src/effects.js` — dust, sparks, smoke, explosions, cash pickups
- `game/src/render.js` — renderer and chase camera
- `game/src/shots.js` — the four deterministic screenshot scenes
- `main.ts` — the entry program that hands the game in; `serve.ts` — local server

## License

MIT. The city, characters, vehicles, story, art and music are all original — nothing from any commercial game.

[Play the bounty](https://make.fun/bounty/gta6-01?ref=ec115nvc) · Optional: earn referral rewards — [make.fun](https://make.fun/bounty/gta6-01?ref=ec115nvc)
