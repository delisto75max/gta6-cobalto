# gta6-cobalto

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/delisto75max/gta6-cobalto/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/delisto75max/gta6-cobalto/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**COBALTO: BAHÍA CALIENTE** — an original open-world crime game set in Bahía Cobalto, a sun-soaked port city of its own making. Played in a desktop browser from static files, with no network request: on foot and behind the wheel, traffic and pedestrians, a wanted level the policía answer, story missions, gunplay, a HUD with a minimap, and a save that keeps your progress.

Everything in it is our own: the city, its districts and street names, the characters and their story, the vehicles, the radio stations, the art, the sound and the music. Nothing comes from any commercial game.

## Run it

```sh
node serve.ts          # serves game/ on http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's vendored library.

## Layout

- `game/index.html` — the page, its import map and the canvas
- `game/src/` — the game: world, vehicles, player, police, missions, combat, HUD, menus
- `game/vendor/` — three.js, vendored minified
- `screenshots/` — real renders of the game, the cover first
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## License

MIT — see `LICENSE`.
