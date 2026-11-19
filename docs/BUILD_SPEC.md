# BUILD SPEC — COBALTO: BAHÍA CALIENTE (v2)

An original open-world crime game for make.fun bounty `gta6-01`. 3D low-poly, third-person,
golden-hour coastal city. three.js vendored (`game/vendor/three.module.min.js`,
`three.core.min.js`, import-map name `three`). Everything else is written by you now: canvas
textures and WebAudio sound, no binary assets, no network.

The judge ranks by, in order: (1) a complete open world *shown in the screenshots* — city on foot
and by car, traffic and pedestrians, wanted level with police responding, missions; (2) depth and
fun; (3) feel and polish; (4) look and originality; (5) structure — one clear job per file. The
screenshots carry most of the verdict, so every one of the four must show several systems at once.

## 0a. Accept the shot scenes with numbers, not vibes

Each shot scene must expose `window.__shotDebug` (filled before `window.__shotReady = true`) with
the numbers the staging claims:

```js
window.__shotDebug = {
  shot: 1, fps: 60,
  trafficNear: 9,          // civilian cars within 160 m of the camera
  pedsNear: 14,            // pedestrians within 80 m
  policeClose: 2,          // cruisers within 12 m
  policeDistances: [7, 9, 14, 88, 92],  // metres
  roadblockUnits: 2,       // cruisers in the roadblock, facing across
  roadblockDist: 90,       // metres from the player
  heli: { dist: 32, up: 12, onScreen: true, spotlightOnPlayer: true },
  minimapRoadSegments: 40, // road segments drawn on the radar
  carsTotal: 46, pedsTotal: 72,
  errors: 0
};
```

`scripts/shoot.mjs` prints it for every shot. **Do not call a shot done until its numbers meet this
table**, and then confirm with `vision_analyze` that the frame reads at a glance:

| Shot | Minimums |
|---|---|
| 1 cover | trafficNear ≥ 8, pedsNear ≥ 12, policeClose ≥ 2, roadblockUnits ≥ 2 with roadblockDist 80-110, heli.dist 20-40 and onScreen and spotlightOnPlayer, minimapRoadSegments ≥ 25 |
| 2 on foot | pedsNear ≥ 12, a cruiser with lights within 40 m, minimapRoadSegments ≥ 25 |
| 3 firefight | 2 officers within 8-15 m, muzzle flashes on both sides, wanted 3, minimapRoadSegments ≥ 20 |
| 4 wide | trafficNear ≥ 10, boats ≥ 2, minimapRoadSegments ≥ 30, no fog clipping the city |

If a number is short, move the entity — do not shrink the check.

## 0b. The rendering gap — this build must close it

Judged blind against the field, the previous build scored high on UI and systems but low on
"visual polish" and "action juice". Both are cheap to fix and they decide close games:

- **Bloom.** Write a small post pass yourself: render the scene to a render target, a bright-pass,
  two separable Gaussian blurs, additively composite over the scene. It must make headlights,
  taillights, police lightbars, the helicopter spotlight edge, neon signs and the sun glint glow.
  Keep it ~200 lines, no library.
- **Particles** (one instanced sprite pool, additive): tyre smoke while the handbrake slides or a
  car drifts, exhaust puffs at idle, impact sparks on collisions, muzzle flash + smoke on every
  shot, dust when a car mounts the kerb, water spray at the shoreline.
- **Skid marks**: dark quads laid on the road under hard braking/drifting, fading after ~20 s.
- **Camera feel**: FOV 58→68 with speed, 0.15 s shake on impacts and each shot, a small kick when a
  cruiser rams you.
- **Buildings**: three window textures (warm, cool, tinted), ground-floor storefronts with awnings
  and neon signs on the boulevard, rooftop ACs/water tanks/antennas, some setback towers.
- **Density**: 45 traffic cars and 70 pedestrians alive around the player, and in shot 1 at least
  8 civilian cars within 160 m placed explicitly at fixed lane positions.

The judge compares screenshots two at a time, so a frame with glow, particles and a full street
beats a cleaner but static frame almost every time.

## 0. What the previous attempt got wrong — fix these

Its HUD was strong, but the world was empty and static in the frames. This build must not repeat:

- **Police cars had no visible emergency lights.** Every cruiser needs a red/blue lightbar with a
  bright emissive material, two alternating flare sprites, and a coloured light pool on the road
  under it. At 3+ stars the player's car and nearby walls catch a blue/red tint.
- **The helicopter was cropped by the top of the frame and lit an empty car.** Frame it fully in
  the sky and aim the spotlight cone at the player's car.
- **No roadblock despite the HUD saying so.** Put two cruisers angled across the boulevard ~120 m
  ahead in the cover shot, with cones and a flare.
- **Empty road.** In every driving shot at least 6 civilian cars must be visible within 150 m,
  moving in both directions; on the sidewalks at least 10 pedestrians within 80 m.
- **No motion cues.** Skid marks behind hard-braking cars, tyre smoke while drifting, exhaust
  puffs, a little camera shake and FOV kick with speed, impact sparks.
- **Sterile road.** Lane dashes, double-yellow centre, crosswalks at every intersection, stop
  lines, manhole covers, patch repairs, arrows.
- **Duplicate location text** (`AVENIDA COBALTO · Avenida Cobalto`). Show district + street once.
- **Flat water and empty sky.** Animated water shimmer, a broken surf line, gulls, two or three
  painted clouds.
- **Peds ignore a 4-star chase.** They flee when shots are fired, a car mounts the kerb, or a
  cruiser passes with sirens within 15 m.

## 1. The world

**Bahía Cobalto**, a port city on a horseshoe bay, six districts: **Avenida Cobalto** (downtown
towers, wide boulevard), **La Marina** (promenade, palms, yachts, cafés), **Mercado Viejo** (old
town, narrow streets, awnings, warm stucco), **El Astillero** (docks, cranes, containers),
**Playa Dorada** (beach, hotels, boardwalk, umbrellas), **Cerro Alto** (hillside villas,
switchbacks, overlook).

City: a grid roughly 2.2 km x 1.6 km, roads 14 m with sidewalks, beach and sea to the south, hills
north. Seeded RNG (`config.SEED`) so every frame is reproducible. Seven north-south avenues, five
east-west streets, a coastal boulevard, one switchback road into the hills. Buildings are boxes with
canvas window textures (2-3 shared textures, tinted), 2-30 floors, rooftop AC units, water tanks,
signs; **lit windows** scattered warm at golden hour. Props: palms, streetlights, traffic lights,
crosswalks, bus stops, benches, bins, hydrants, awnings, billboards with invented brands, beach
umbrellas, containers, cranes, moored boats, a lighthouse, gulls, clouds.

Sky: gradient dome deep teal to peach, low warm sun, long shadows, fog, sea shimmer with a surf
line. Golden hour fixed at 17:40, clock advances with play.

## 2. Player, camera, controls

Third-person character 1.8 m: torso, head, two arms, two legs, simple swing animation by speed.
Collision with building AABBs; cannot walk into the sea.

- `W A S D`/arrows move, `Shift` sprint, `Space` jump
- Mouse orbits the camera (pointer lock on click), wheel zooms, camera collides with buildings
- `E` enter/exit nearest vehicle within 4 m
- `LMB` fire, `RMB` aim, `R` reload, `1 2 3 4`/`Q` weapon slots
- `Shift` in a car is the handbrake, `H` horn, `Tab` city map, `Esc` pause
- `[` `]` radio, `F5`/`F9` quick save/load, `Enter` confirm, arrows navigate menus

Camera: spring-damped third-person follow, shoulder offset, pulls back/up with speed, FOV 58→68,
slight shake on impacts and shots.

## 3. Vehicles, traffic, pedestrians

Six vehicles with distinct low-poly models and handling in `config.VEHICLES`: `Cangrejo` (beater),
`Marea 4x4`, `Mula` (van), `Viento GT` (sports), `Tiburón` (muscle), `Rayo 250` (motorcycle).
Arcade physics: acceleration, drag, grip/drift, steering falls with speed, handbrake slide,
collisions with impulse and damage, smoke at low health, dead engine.

`E` enters/exits; the player model hides and the camera goes to chase. Parked cars everywhere;
traffic cars can be carjacked (the driver flees).

Traffic: ~45 active cars around the player on lane paths (spawn/despawn radius), lanes, car
following, red lights on the boulevard, horns. **Density near the camera is what the judge sees:
keep 6+ cars within 150 m in the driving shots.** Pedestrians: ~70 on sidewalks, groups, some
standing; flee from gunfire, sirens close by and cars on the pavement.

## 4. Combat, health, police, wanted

Player 100 health, 50 armour (armour absorbs 60%). Death → respawn at the nearest hospital, −$250,
wanted cleared.

Weapons (`WEAPONS`): fists, `Vesper` pistol (12 rounds, 34 dmg), `Mako` SMG (30, 22, auto),
`Breaker` shotgun (8 shells, 8x12). Raycast hits, tracer lines, muzzle flash, casings, impact
sparks, decals. Reload animation + HUD ammo.

PDC (Policía de Cobalto), wanted 0-5 stars, rising with crimes:

- 1-2 stars: 1-3 cruisers chase, officers shout, try to box you in.
- 3 stars: officers shoot on foot, roadblocks spawn ahead.
- 4-5 stars: `Kite-1` helicopter with a spotlight follows, more units, faster spawns.
- Evade: no line of sight for ~8 s → `SEARCHING`, then stars decay one by one.
- HUD: stars, `IN SIGHT`/`SEARCHING`/`HIDDEN`, dispatch panel with call signs, distance in metres,
  tactic badges (`RAMMING`, `FLANKING`, `FIRING`, `ROADBLOCK`, `SPOTLIGHT`).

Cruiser model: black-and-white body, **lightbar with alternating red/blue emissive**, light pools
on the road, siren audio. Helicopter: body, rotor disc, tail, spotlight cone; circles the player
and reports position (wanted does not decay while lit).

## 5. Missions, story, activities, progression

Eight story missions with dialogue (portrait + 2-3 lines), stages, marker, reward. Story: **Rafa
Cordero**, out of prison after five years, back to his sister **Lucía** who runs the beach bar *La
Marea* and owes **Don Ismael Rueda**'s smuggling ring; **Capitán Verónica Salas** of the PDC is the
law on his tail; the last job is at the lighthouse.

1. **Welcome Home** — drive Lucía's Cangrejo from the bus station to La Marea.
2. **The Debt** — collect an envelope at El Astillero, lose a 2-star tail.
3. **Bad Cargo** — steal the Mula van from the docks, deliver it to Mercado Viejo without wrecking it.
4. **The Captain** — tail Salas's cruiser, keep out of her sight cone.
5. **Cerro Alto** — break into a villa, steal the Tiburón, escape 3 stars down the switchbacks.
6. **Radio Silence** — shoot out the smuggling ring's radio mast, survive the ambush.
7. **The Exchange** — meet Rueda at the lighthouse, betrayal, chase along the coast road.
8. **High Tide** — assault the marina warehouse, beat Rueda's crew, ending card.

Activities: three checkpoint street races, a delivery board at La Marea, a shooting range behind
the bar. Cash, `respect` XP and ranks (Nobody → Runner → Wheelman → Shot Caller → Fixer → Kingpin),
a `Tienda` to buy weapons, armour/health pickups, a garage to repair.

## 6. HUD (`hud.js`, 2D canvas overlay)

Dark translucent rounded panels, 1 px light border, cream text, one accent per role. Fixed 1280x720
virtual space scaled to the canvas.

- **Top-left** mission card: `JOB 3/8 · BAD CARGO`, stage pips, objective in bold, `NEXT ...`,
  timer when the mission has one. Under it **PDC RESPONSE**: `● PDC RESPONSE  4 UNITS · 3★` and up
  to 5 rows (badge, call sign, `23 m`, tactic tag), footer `+2 more units · roadblock ahead`.
- **Top-centre** `WANTED` + 5 stars, status word (`IN SIGHT` red, `SEARCHING` amber, `HIDDEN` teal).
- **Top-right** clock `17:40`, `$12,450`, and the weapon row (4 slots, name, ammo, active one lit).
- **Bottom-left** circular minimap 210 px: roads, blocks, water, district label **once**
  (`LA MARINA · Malecón`), player arrow, gold mission diamond, red/blue police blips, helicopter,
  dashed red search radius. Under it `HEALTH`, `ARMOUR`, respect bar `RANK 3 · WHEELMAN 240/500`.
- **Bottom-centre** dialogue: portrait chip, speaker + role, one line, typewriter; radio chatter
  uses the same card.
- **Bottom-right** speed `87` + `KM/H`, gear `G3`, vehicle name, condition bar,
  `♪ COBALTO 104.7 — Noche Azul`.
- Toasts under the wanted panel: `+$350`, `MISSION PASSED`, `WANTED LEVEL UP`.

Type: system-ui, letterspaced labels, tabular numbers. Nothing below 11 px at 1280; mission title
20 px; cash 26 px.

## 7. Menus, save, audio

Title (skyline, `COBALTO`, `BAHÍA CALIENTE`, NEW GAME / CONTINUE / SETTINGS / CONTROLS), pause
(resume, map, settings, save, quit), full city map, settings (volume, sensitivity, invert Y, HUD
scale), save to `localStorage` key `cobalto.save.v1` (autosave 60 s and after missions, quick
save/load). Audio: engine loop (saw + lowpass by RPM), skid, horn, four gunshots, reload clicks,
footsteps, two-tone siren, rotor, UI clicks, city bed, three procedural radio stations.

## 8. Files (one job each)

```
game/index.html          canvas + HUD canvas + import map + boot
game/src/config.js       SEED, palette, tunables, districts, VEHICLES, WEAPONS
game/src/rng.js          seeded RNG helpers
game/src/city.js         procedural city data: roads, blocks, buildings, props, lanes, POIs
game/src/scene.js        three.js world: sky, sun, sea, ground, buildings, props, lights, effects
game/src/player.js       on-foot movement, collision, character mesh, animation
game/src/vehicles.js     vehicle meshes, arcade physics, enter/exit, damage, lightbars
game/src/traffic.js      lane traffic simulation
game/src/peds.js         pedestrian simulation, flee behaviour
game/src/police.js       wanted, cruiser/helicopter AI, roadblocks, search
game/src/combat.js       weapons, raycasts, effects, damage, pickups
game/src/missions.js     eight story missions, stages, dialogue, races, deliveries
game/src/hud.js          all HUD drawing + minimap
game/src/menus.js        title, pause, map, settings
game/src/save.js         localStorage save/load and settings
game/src/audio.js        WebAudio SFX, engine, sirens, radio
game/src/main.js         state machine, fixed-step loop, input, shot mode
```

`main.js` owns `state` and updates in order: input → player/vehicle → traffic → peds → police →
combat → missions → hud. Small explicit APIs (`createX`, `updateX(dt, ...)`, `drawX(...)`); no
circular imports except through `main.js`.

## 9. Screenshot mode (decisive)

`?shot=1|2|3|4` boots straight into a scripted scene, skips the menu, runs ~120 fixed steps to
settle traffic/peds/police, renders, sets `window.__shotReady = true`.

1. **Cover** — Viento GT north on Avenida Cobalto, 17:41, 4 stars: two cruisers close behind with
   flashing bars, a roadblock of two angled cruisers + cones ~120 m ahead, `Kite-1` fully in frame
   up-right with its spotlight on the player, 6+ civilian cars, peds on both sidewalks, skid marks
   behind the car, HUD with `JOB 6/8 · RADIO SILENCE`, `DESTROY THE MAST`, dispatch, dialogue.
2. **On foot** — Rafa on the La Marina promenade at 17:42: palms, yachts, market stalls, benches,
   gulls, 10+ peds, a cruiser approaching, pistol drawn, minimap + mission marker.
3. **Firefight** — Mercado Viejo alley: muzzle flash, tracers, sparks, two officers behind a
   cruiser door, 3 stars, health/armour down, `RADIO SILENCE` objective.
4. **Wide city** — high vantage over the bay at sunset: districts, coast road with traffic,
   lighthouse, downtown towers, beach, boats, HUD minimap and location label.

`scripts/shoot.mjs` opens each `?shot=N`, waits for `__shotReady`, captures 1280x720 JPEG under
`screenshots/`, keeping each under 256 KiB. `scripts/check.mjs N` prints console errors and
external requests.

## 10. Quality bar

- 60 fps at 1280x720 on a desktop; InstancedMesh for windows/palms/lights; merged static geometry;
  under ~400 draw calls; no per-frame allocation in hot loops.
- Every HUD label legible at 300 px wide: 11 px minimum at 1280.
- No console errors, no network requests, no missing files.
- Playable with no `?shot`: title → new game → walk → steal car → drive → shoot → wanted → mission.

Write the code now, in file order. After each group, run and screenshot. Do not stop until all four
shot scenes render correctly and free play works.
