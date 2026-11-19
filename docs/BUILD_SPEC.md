# BUILD SPEC — COBALTO: BAHÍA CALIENTE

An original open-world crime game for make.fun bounty `gta6-01`. 3D low-poly, third-person,
golden-hour coastal city, played with keyboard and mouse, served as static files from `game/`.
three.js is vendored (`game/vendor/three.module.min.js`, `three.core.min.js`), import-map name
`three`. Everything else is original: city, characters, vehicles, story, canvas textures,
WebAudio sound. No network, no binary assets, no build step.

The judge ranks, in order: (1) a complete open world **shown in the screenshots** — city on foot
and by car, traffic and pedestrians, wanted level with police responding, missions; (2) depth and
fun; (3) feel and polish; (4) look and originality; (5) structure — one clear job per file. The
screenshots carry most of the verdict, so every one of the four shows several systems at once.

## 0a. Shot acceptance — numbers, not vibes

Each shot scene fills `window.__shotDebug` before `window.__shotReady = true`:

```js
window.__shotDebug = {
  shot: 1, fps: 60,
  trafficNear: 15,       // civilian cars within 160 m of the camera
  pedsNear: 19,          // pedestrians within 80 m
  policeClose: 2,        // cruisers within 12 m of the player
  policeDistances: [7, 8, 95, 95],
  officerDistances: [],  // officers, metres
  roadblockUnits: 2, roadblockDist: 95,
  heli: { dist: 23, up: 14, onScreen: true, spotlightOnPlayer: true },
  minimapRoadSegments: 31,
  carsTotal: 59, pedsTotal: 70, boats: 0,
  muzzleFlashes: 0, errors: 0
};
```

`scripts/shoot.mjs` prints the object for each shot and prints PASS/FAIL against this table:

| Shot | Minimums |
|---|---|
| 1 cover | trafficNear ≥ 8, pedsNear ≥ 12, policeClose ≥ 2, roadblockUnits ≥ 2 with roadblockDist 80–110, heli.dist 20–40, heli.onScreen, heli.spotlightOnPlayer, minimapRoadSegments ≥ 25 |
| 2 on foot | pedsNear ≥ 12, a cruiser with lights within 40 m (policeDistances), minimapRoadSegments ≥ 25 |
| 3 firefight | 2 officers at 8–15 m (officerDistances), wanted 3, muzzleFlashes ≥ 2, minimapRoadSegments ≥ 20 |
| 4 wide | trafficNear ≥ 10, boats ≥ 2, minimapRoadSegments ≥ 30, no fog clipping the city |

If a number is short, move the entity; do not shrink the check. A shot is done only when the
numbers pass and `vision_analyze` confirms the frame reads at a glance.

## 0b. Rendering bar

- **Bloom.** A hand-written post pass: scene to a render target, bright-pass, two separable
  Gaussian blurs, additive composite, ACES tone map. It must make headlights, taillights, police
  lightbars, the helicopter spotlight edge, neon and the sun glint glow.
- **Particles.** One instanced/points pool, additive: tyre smoke while drifting, exhaust puffs,
  impact sparks, muzzle flash and smoke, dust on kerbs, water spray at the shoreline.
- **Skid marks** under hard braking and drifting, fading after roughly 20 s.
- **Camera feel.** FOV 62→~72 with speed, 0.15 s shake on impacts and shots, a kick when a cruiser
  rams the player.
- **Buildings.** Procedural facade shader with warm/cool/tinted lit windows, ground-floor
  storefronts, awnings, neon signs on the boulevard, rooftop ACs, water tanks and antennas,
  stepped towers with setbacks.
- **Density.** 45 traffic cars and 70 pedestrians alive around the player; in the cover at least
  15 civilian cars within 160 m and 18 pedestrians within 80 m.
- **Police.** Every cruiser has a red/blue lightbar with emissive material, alternating flare
  sprites, a coloured light pool and a point light on the road. At 3+ stars nearby walls catch the
  tint.
- **Helicopter.** Fully framed in the sky, spotlight cone aimed at the player's car, ground pool
  under the car.
- **Roadblock.** Two cruisers angled across the boulevard ~95 m ahead in the cover, plus cones.
- **Road.** Lane dashes, double-yellow centre, crosswalks, stop lines, manholes, kerbs, patches.
- **Water and sky.** Animated water shader with sun glitter, a surf/foam line, gulls, painted
  clouds, a low sun.
- **Pedestrians** flee from gunfire, sirens within 15 m and cars on the pavement.

## 1. The world

**Bahía Cobalto**, a port city on a horseshoe bay, six districts: **Avenida Cobalto** (downtown
towers, wide boulevard), **La Marina** (promenade, palms, yachts, cafés), **Mercado Viejo** (old
town, narrow streets, awnings, warm stucco), **El Astillero** (docks, cranes, containers),
**Playa Dorada** (beach, hotels, umbrellas), **Cerro Alto** (hillside villas, overlook).

A grid roughly 2.2 km × 1.6 km: seven north–south avenues, five east–west streets, a coastal
boulevard at z=540, beach and sea to the south, hills north. Seeded RNG (`config.seed`) so every
frame is reproducible. Buildings are boxes with a procedural window facade, 5–106 m, setbacks,
rooftop clutter, storefronts and signs. Props: palms, streetlights, traffic signals, crosswalks,
benches, bins, hydrants, bus stops, awnings, billboards with invented brands, umbrellas,
containers, cranes, boats, a lighthouse on a jetty, gulls, clouds.

Sky: gradient dome deep teal to peach, low warm sun, long shadows, warm fog, sea shimmer with a
surf line. Golden hour fixed at 17:40; the clock advances with play.

## 2. Player, camera, controls

Third-person character 1.8 m: torso, head, arms, legs, simple swing by speed. Collision with
building AABBs; cannot walk into the sea.

- `WASD`/arrows move, `Shift` sprint, `Space` jump
- Mouse orbits the camera (pointer lock on click), wheel zooms, camera collides with buildings
- `E` enter/exit the nearest vehicle within 4.6 m
- `LMB` fire, `RMB` aim, `R` reload, `1 2 3 4` / `Q` weapons
- `Space` in a car is the handbrake, `H` horn, `Tab` city map, `Esc` pause
- `[` `]` radio, `F5`/`F9` quick save/load, `Enter` confirm, arrows navigate menus

Camera: spring-damped third-person follow, shoulder offset, pulls back with speed, FOV 62→72,
shake on impacts and shots.

## 3. Vehicles, traffic, pedestrians

Six vehicles with distinct low-poly models and handling in `config.VEHICLES`: `Cangrejo`
(beater), `Marea 4x4`, `Mula` (van), `Viento GT` (sports), `Tiburón` (muscle), `Rayo 250`
(motorcycle). Arcade physics: acceleration, drag, grip/drift, steering falls with speed, handbrake
slide, collisions with impulse and damage, smoke at low health, dead engine.

`E` enters/exits; the player model hides and the camera goes to chase. Parked cars everywhere;
traffic cars can be carjacked (the driver flees). A carjacked simple traffic mesh is upgraded to
the detailed model (wheels, headlights, taillights) on entry.

Traffic: ~45 active cars on lane paths with spawn/despawn radius, lane following, braking for
cars ahead, horns. Pedestrians: ~70 on sidewalk paths, groups, some standing; flee from gunfire,
sirens close by and cars on the pavement.

## 4. Combat, health, police, wanted

Player 100 health, 50 armour (armour absorbs 60%). Death → respawn at the hospital, −$250, wanted
cleared.

Weapons (`WEAPONS`): fists, `Vesper` pistol (12 rounds, 34 dmg), `Mako` SMG (30, 22, auto),
`Breaker` shotgun (8 shells, 8×12). Ray hits, tracer lines, muzzle flash, casings, impact sparks,
reload timer and HUD ammo.

PDC (Policía de Cobalto), wanted 0–5 stars, rising with crimes:

- 1–2 stars: 1–3 cruisers chase, officers shout, try to box you in.
- 3 stars: officers shoot on foot, roadblocks spawn ahead.
- 4–5 stars: `Kite-1` helicopter with a spotlight follows, more units, faster spawns.
- Evade: no line of sight for ~3 s → `SEARCHING`, then stars decay one by one.
- HUD: stars, `IN SIGHT`/`SEARCHING`/`HIDDEN`, dispatch panel with call signs, distance in metres,
  tactic badges (`RAMMING`, `FLANKING`, `FIRING`, `ROADBLOCK`, `SPOTLIGHT`).

Cruiser model: black-and-white body, lightbar with alternating red/blue emissive, light pools,
siren audio. Helicopter: body, rotor disc, tail, spotlight cone; circles the player and reports
position.

## 5. Missions, story, activities, progression

Eight story missions with dialogue (portrait + line), stages, marker, reward. Story: **Rafa
Cordero**, out of prison after five years, back to his sister **Lucía** who runs the beach bar
*La Marea* and owes **Don Ismael Rueda**'s smuggling ring; **Capitana Verónica Salas** of the PDC
is the law on his tail; the last job is at the lighthouse.

1. **Welcome Home** — drive Lucía's Cangrejo from the terminal to La Marea.
2. **The Debt** — collect an envelope at El Astillero, lose a 2-star tail.
3. **Bad Cargo** — steal the Mula van, deliver it to Mercado Viejo without wrecking it.
4. **The Captain** — tail Salas's cruiser, keep out of her sight cone.
5. **Cerro Alto** — break into a villa, steal the Tiburón, escape 3 stars down the switchbacks.
6. **Radio Silence** — destroy the radio mast, survive the ambush.
7. **The Exchange** — meet Rueda at the lighthouse, chase him along the coast road.
8. **High Tide** — assault the marina warehouse, beat Rueda's crew, ending card.

Activities: three checkpoint street races, a delivery board at La Marea, a shooting range behind
the bar. Cash, `respect` XP and ranks (Nobody → Runner → Wheelman → Shot Caller → Fixer →
Kingpin), a Tienda to buy weapons, armour/health pickups, a garage to repair.

## 6. HUD (`hud.js`, 2D canvas overlay)

Dark translucent rounded panels, 1 px light border, cream text, one accent per role. Fixed
1280x720 virtual space scaled to the canvas.

- **Top-left** mission card: `JOB 3/8 · BAD CARGO`, stage pips, objective bold, `NEXT ...`, timer.
  Under it **PDC RESPONSE**: `● PDC RESPONSE  4 UNITS · 3★` and up to five rows (badge, call sign,
  `23 m`, tactic tag), footer `+2 more units · roadblock ahead`.
- **Top-centre** `WANTED` + five stars, status word (`IN SIGHT` red, `SEARCHING` amber, `HIDDEN`
  teal).
- **Top-right** clock `17:40`, `$12,450`, weapon row (four slots, name, ammo, active one lit).
- **Bottom-left** circular minimap 210 px: roads, blocks, water, district label once, player arrow,
  gold mission diamond, red/blue police blips, helicopter, dashed red search radius. Under it
  `HEALTH`, `ARMOUR`, respect bar `RANK 3 · WHEELMAN 240/500`.
- **Bottom-centre** dialogue: portrait chip, speaker + role, one line, typewriter.
- **Bottom-right** speed `87` + `KM/H`, gear, vehicle name, condition bar, radio line.
- **Toasts** under the wanted panel: `+$350`, `MISSION PASSED`, `WANTED LEVEL UP`.

Type: system-ui, letterspaced labels, tabular numbers. Nothing below 11 px at 1280.

## 7. Menus, save, audio

Title (bay skyline, `COBALTO`, `BAHÍA CALIENTE`, NEW GAME / CONTINUE / SETTINGS / CONTROLS),
pause (resume, map, settings, save, quit), full city map, settings (volume, sensitivity, invert Y,
HUD scale), save to `localStorage` key `cobalto.save.v1` (autosave 60 s and after missions, quick
save/load). Audio: engine loop (saw + lowpass by RPM), skid, horn, four gunshots, reload clicks,
footsteps, two-tone siren, rotor, UI clicks, city bed, three procedural radio stations.

## 8. Files (one job each)

```
game/index.html          canvas + HUD canvas + import map + boot
game/src/config.js       seed, palette, tunables, districts, VEHICLES, WEAPONS
game/src/rng.js          seeded RNG and math helpers
game/src/textures.js     canvas asphalt, concrete, sand, glows, clouds, signs, billboards
game/src/city.js         procedural city data: roads, blocks, buildings, props, lanes, POIs
game/src/scene.js        three.js world: sky, sun, sea, buildings, props, effects, bloom
game/src/fx.js           particles, skid marks, tracers, muzzle flashes
game/src/player.js       on-foot movement, collision, character mesh, animation
game/src/vehicles.js     vehicle meshes, arcade physics, enter/exit, damage, lightbars
game/src/traffic.js      lane traffic simulation
game/src/peds.js         pedestrian simulation, flee behaviour
game/src/police.js       wanted, cruiser/helicopter AI, roadblocks, search
game/src/combat.js       weapons, raycasts, effects, damage, pickups
game/src/missions.js     eight story missions, stages, dialogue, activities
game/src/hud.js          all HUD drawing + minimap
game/src/menus.js        title, pause, map, settings, controls, death, ending
game/src/save.js         localStorage save/load and settings
game/src/audio.js        WebAudio SFX, engine, sirens, radio
game/src/main.js         state machine, fixed-step loop, input, shot mode
```

`main.js` owns `state` and updates in order: input → player/vehicle → traffic → peds → police →
combat → missions → hud. Small explicit APIs (`createX`, `updateX(dt, ...)`, `drawX(...)`); no
circular imports except through `main.js`.

## 9. Screenshot mode

`?shot=1|2|3|4` boots straight into a scripted scene, skips the menu, runs ~120 fixed steps to
settle traffic/peds/police, renders, sets `window.__shotReady = true`.

1. **Cover** — Viento GT north on Avenida Cobalto, 4 stars: two cruisers flanking close with
   flashing bars, a roadblock of two angled cruisers + cones ~95 m ahead, `Kite-1` fully in frame
   up-right with its spotlight on the player, 15 civilian cars, 19 peds, skid marks behind the car,
   HUD with `JOB 6/8 · RADIO SILENCE`, `DESTROY THE MAST`, dispatch, dialogue.
2. **On foot** — Rafa on the La Marina promenade at 17:42: palms, yachts, beach, benches, 21 peds,
   a cruiser with lights 30 m away, pistol drawn, minimap + mission marker.
3. **Firefight** — Mercado Viejo on Calle Mercado: muzzle flashes and tracers both ways, two
   officers at 9 and 13 m behind cover, 3 stars, health/armour down, `RADIO SILENCE` objective.
4. **Wide city** — low over the bay at sunset: beach, water, boats, lighthouse on a jetty, coast
   road with 12 cars, downtown towers, HUD minimap and location label.

`scripts/shoot.mjs` opens each `?shot=N`, waits for `__shotReady`, checks the numbers, captures
1280x720 JPEG under `screenshots/`, keeping each under 256 KiB. `scripts/check.mjs N` prints
console errors and external requests. `scripts/smoke.mjs` drives a free-play loop.

## 10. Quality bar

- 60 fps at 1280x720 on a desktop; InstancedMesh for windows/palms/lights; merged static geometry;
  under ~450 draw calls; no per-frame allocation in hot loops.
- Every HUD label legible at 300 px wide.
- No console errors, no network requests, no missing files.
- Playable with no `?shot`: title → new game → walk → steal car → drive → shoot → wanted → mission.
