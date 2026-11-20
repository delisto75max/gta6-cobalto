# COBALTO: Bahía Caliente — build notes

A finished, playable open-world crime game: low-poly 3D, third-person, golden-hour port city,
keyboard and mouse, static files only. Three.js is vendored in `game/vendor/` (import map `three`);
the city, cast, cars, story, textures and audio are original and generated in code — no build step.

## Controls
WASD/arrows move, Shift sprint, Space jump; mouse orbits (pointer lock), wheel zooms.
E enter/exit a vehicle within 4.6 m; LMB fire, RMB aim, R reload, 1-4/Q weapons; in a car
Space is the handbrake, H the horn. Tab map, Esc pause, [ ] radio, F5/F9 quick save/load.

## Files
```
game/index.html          canvases, HUD canvas, import map, error hooks, boot
game/src/config.js       seed, grid, palette, districts, VEHICLES, WEAPONS, ranks, story
game/src/rng.js          seeded RNG plus clamp/damp/angle helpers
game/src/textures.js     canvas-painted asphalt, concrete, sand, glows, signs, clouds
game/src/city.js         city data: roads, blocks, buildings, props, lanes, POIs (no three.js)
game/src/scene.js        three.js world: sky, sun, sea, geometry, lights, bloom post pass
game/src/fx.js           particle pool, skid marks, tracers, muzzle flashes
game/src/player.js       Rafa on foot: mesh, walk/aim animation, movement, collision
game/src/vehicles.js     six vehicle models, arcade physics, damage, lightbars, glows
game/src/traffic.js      45 lane-following civilian cars, braking, carjacking
game/src/peds.js         70 sidewalk pedestrians, walking, standing, fleeing
game/src/police.js       wanted stars, cruiser/heli AI, officers, roadblocks, search
game/src/combat.js       fists/pistol/SMG/shotgun, raycasts, tracers, damage, pickups
game/src/missions.js     eight story missions, stages, dialogue, races, delivery
game/src/hud.js          2D canvas HUD: mission card, dispatch, stars, minimap, vitals
game/src/menus.js        title, pause, city map, settings, controls, death, ending
game/src/save.js         localStorage save/settings (cobalto.save.v1, cobalto.settings.v1)
game/src/audio.js        WebAudio engine, siren, rotor, guns, city bed, three radio stations
game/src/main.js         state machine, input, camera, fixed-step loop, staged screenshots
```

## Run and verify
    node serve.ts                # game/ on http://localhost:8080 (--port N to change)
    node scripts/shoot.mjs all   # all four staged shots -> screenshots/, PASS/FAIL gates
    node scripts/check.mjs 1     # console, exception, external-request and state check

`shoot.mjs` waits for `window.__shotReady`, gates `__shotDebug` against `docs/BUILD_SPEC.md` §0a
and writes 1280x720 JPEGs under 256 KiB; `check.mjs <url|1-4>` flags errors and external requests.

## Staged scenes (`?shot=1|2|3|4`)
1. Cover — Viento GT on Avenida Cobalto, 4 stars, two cruisers flanking, roadblock ~95 m ahead, Kite-1 overhead.
2. On foot — Rafa on the La Marina promenade at 17:42, pistol drawn, a lit cruiser 30 m away.
3. Firefight — Mercado Viejo, tracers both ways, two officers behind cover at 9 and 13 m, 3 stars.
4. Wide — low over the bay at sunset: beach, boats, lighthouse, coast road, downtown towers.

Each boots past the menu, runs ~120 fixed steps to settle traffic/peds/police, renders once and sets
`__shotReady`; shot 3 freezes its flash frame so the muzzle fire survives capture.

## Systems
City: seeded ~2.2 x 1.4 km grid, six districts, procedural facades, props, POIs. Traffic: 45
lane-following cars with spawn/despawn radius and braking, carjackable. Peds: 70 on sidewalk
paths; flee gunfire, near sirens and cars on the pavement. Police: 0-5 stars, chase/ram/flank
cruisers, foot officers and roadblocks at 3+, Kite-1 spotlight at 4+, search when unseen.
Combat: four weapons, ray hits, tracers, casings, armour absorbs 60%, death -> hospital -$250.
Missions: eight story jobs (Welcome Home to High Tide), two races and a delivery board. HUD:
mission card, PDC dispatch, wanted status, circular minimap, vitals, speed, dialogue.
Save/audio: autosave every 60 s and after missions, F5/F9 quick save; synthesised engine, siren, rotor, guns, skids, city bed, three radio stations.
