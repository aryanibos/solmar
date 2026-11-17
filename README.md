# solmar

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aryanibos/solmar/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aryanibos/solmar/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar is an original open-world crime game for make.fun's "Make GTA 6" bounty: a sun-soaked coastal city to explore on foot and by car, with traffic and pedestrians, cars to steal, a wanted level with police who chase and arrest, six story missions with dialogue and rewards, combat, a HUD with a minimap, a start screen and a save. Dario Venn is home — the Castellan crew runs the docks, the SPPD runs the streets, and Mara Solis has six jobs that pay enough to change all of it.

Everything is original and built from scratch in vanilla canvas and WebAudio: no libraries, no network requests, no assets from any other game. The city is procedural (one seed, one city), the sound is synthesized live, and the game runs from plain static files under `game/`.

## How to play

- **WASD / arrows** — move on foot, drive in a car
- **Shift** — run
- **E** — enter or steal a car, buy ammo at Solmar Arms
- **Space** — handbrake while driving
- **Mouse** — aim; **click** to shoot (pistol) or punch (no gun)
- **P / Esc** — pause · **M** — mute

Earn money from missions, taxi fares and courier runs. Spend it at the Sunset Garage (repairs, and a fresh paint job clears your wanted level) and at Solmar Arms (ammo). Get busted and the SPPD fines you; get wasted and the medics do.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Or play it directly: `node serve.ts`, then open http://localhost:8080. Node 22.18 or later, no build step, no dependencies.

## What is in here

- `game/` — the playable game: `index.html` plus `src/` modules, one job each (`city`, `cars`, `traffic`, `people`, `police`, `missions`, `combat`, `audio`, `hud`, `render`, `effects`, `player`, `input`, `save`, `shots`, `main`)
- `screenshots/` — four renders of the game: a police chase, a drive through downtown, on-foot combat at the harbor, and a mission delivery
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the make.fun library, copied unchanged

---

<sub>Entered on [make.fun](https://make.fun/?ref=d5fyv67m&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
