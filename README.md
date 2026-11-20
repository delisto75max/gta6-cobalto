# COBALTO: Bahía Caliente

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/delisto75max/gta6-cobalto/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/delisto75max/gta6-cobalto/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original low-poly open-world crime game in a sun-soaked port city: explore on foot and by
car, with lane-following traffic and sidewalk pedestrians, a five-star PDC wanted system that
escalates from patrol cars to a helicopter, eight story missions, four weapons, and a 2D canvas
HUD with mission card, circular minimap and car radio. Progress saves to localStorage.

Everything is generated in code — city, cast, cars, textures and synthesised audio — and runs as
static files with no network access and no build step. Three.js is vendored in `game/vendor/`.

## Run it

    node serve.ts

Then open http://localhost:8080 in a desktop browser and click to lock the pointer.

    node scripts/shoot.mjs

Renders the four staged scenes (chase, promenade, firefight, bay wide) into `screenshots/`.

## Controls

- **WASD / arrows** move, **Shift** sprint, **Space** jump
- **Mouse** orbit camera (pointer lock), **wheel** zoom
- **E** enter/exit a vehicle, **LMB** fire, **RMB** aim, **R** reload, **1-4 / Q** weapons
- **In a car:** **Space** handbrake, **H** horn
- **Tab** map, **Esc** pause, **[ ]** change radio station, **F5 / F9** quick save / load

## Licence

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 make.fun.
