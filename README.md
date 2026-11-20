# VELMARA — Streets of the Sun

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dylikeu/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dylikeu/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game that runs in a desktop browser — built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) ("Make GTA 6").

Velmara is a sunlit coastal city. Explore it on foot and by car, steal cars,
outrun the Velmara PD through a 0–5 star wanted level, shoot it out with the
Brass Kings, and work six story jobs for Mara Kline — from a first taxi fare
to the Sunset Run. Traffic, pedestrians, a live minimap, ranks, money and
progression, synthesised sound effects, and a save that survives reloads.

## How to run

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network, no external assets — plain static files under
`game/`, vanilla canvas JavaScript.

## Controls

- **WASD / arrows** — walk / drive
- **E** — enter a car, interact, advance dialogue
- **F** — exit a car
- **Mouse aim, click** — shoot the pistol
- **R** — reload
- **Space** — handbrake
- **P / Esc** — pause
- **M** — mute

## Structure

Source is split by job under `game/src/`:

- `city/` — the map of Velmara, traffic cars and pedestrians
- `player/` — walking, driving, and pistol combat
- `police/` — the wanted level and the VPD chase
- `missions/` — the six-job story
- `hud/` — HUD with minimap, and title/pause/dialogue menus
- `audio/` — synthesised WebAudio sound effects
- `save/` — localStorage save and load
- `core/` — shared state and math helpers

MIT licensed. All names, characters, art, story and sound are original work.
