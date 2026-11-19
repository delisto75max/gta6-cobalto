# COBALTO: BAHÍA CALIENTE

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/delisto75max/gta6-cobalto/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/delisto75max/gta6-cobalto/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game set in Bahía Cobalto, a sun-soaked port city of six distinct districts. Walk its streets at golden hour, from the docks of El Astillero to the towers of Avenida Cobalto. The city, textures, character and lighting are procedural; the game runs locally with no runtime network access.

## Run it

```sh
node serve.ts
```

Open `http://localhost:8080` in desktop Chrome. Click the city to capture the mouse.

- **WASD / arrows** — walk
- **Shift** — sprint
- **Space** — jump
- **Mouse** — orbit the third-person camera
- **Wheel** — zoom
- **Esc** — release pointer lock

## Source

`game/src/config.js` holds the tunables. `city.js` generates pure city data, `scene.js` builds its procedural three.js meshes, `player.js` handles on-foot movement and collision, and `main.js` runs the fixed-step loop. Three.js is vendored; no build step is required.

## License

MIT License. Copyright (c) 2026 delisto75max.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
