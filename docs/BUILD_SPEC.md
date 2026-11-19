# BUILD SPEC — COBALTO: BAHÍA CALIENTE

An original open-world crime game for make.fun bounty `gta6-01`. 3D low-poly, third person,
golden-hour coastal city. three.js is vendored under `game/vendor/` (import-map name `three`).
Everything else — city, people, cars, story, textures, sound — is generated in code.

The judge ranks, in order: (1) a complete open world *shown in the screenshots* — city on foot and
by car, traffic and pedestrians, wanted level with police responding, missions; (2) depth and fun;
(3) feel and polish; (4) look and originality; (5) structure. The screenshots carry most of the
verdict, so every one of the four must show several systems at once.

## 0a. Shot acceptance — numbers, not vibes

Each shot scene fills `window.__shotDebug` before setting `window.__shotReady = true`:

```js
window.__shotDebug = {
  shot: 1, fps: 60,
  trafficNear: 9,            // civilian cars within 160 m of the camera
  pedsNear: 14,              // pedestrians within 80 m
  policeClose: 2,            // cruisers within 12 m
  policeDistances: [7, 9, 14, 88, 92],
  roadblockUnits: 2, roadblockDist: 90,
  heli: { dist: 32, up: 12, onScreen: true, spotlightOnPlayer: true },
  minimapRoadSegments: 40,
  carsTotal: 46, pedsTotal: 72,
  errors: 0
};
```

| Shot | Minimums |
|---|---|
| 1 cover | trafficNear ≥ 8, pedsNear ≥ 12, policeClose ≥ 2, roadblockUnits ≥ 2 with roadblockDist 80-110, heli.dist 20-40 + onScreen + spotlightOnPlayer, minimapRoadSegments ≥ 25 |
| 2 on foot | pedsNear ≥ 12, a cruiser with lights within 40 m, minimapRoadSegments ≥ 25 |
| 3 firefight | 2 officers within 8-15 m, muzzle flashes on both sides, wanted 3, minimapRoadSegments ≥ 20 |
| 4 wide | trafficNear ≥ 10, boats ≥ 2, minimapRoadSegments ≥ 30, no fog clipping the city |

If a number is short, move the entity — never shrink the check.

## 0b. The failure modes this build avoids

- Empty asphalt: lane dashes, double-yellow, crosswalks, stop lines, manholes, patches, arrows,
  curbs, skid marks, tyre smoke, exhaust.
- Flat light: warm low sun, long directional shadows, hemisphere fill, ACES tone mapping, fog,
  lit windows, emissive lamps, light pools under the cruisers.
- Grey boxes: window textures with sills and lit panes, ground-floor shops, awnings, rooftop AC,
  water tanks, signs, balconies, varied heights and pastel tints.
- Static crowd: pedestrians walk, groups stop to talk, they flee from gunfire, sirens and cars
  mounting the kerb. Traffic moves in both directions and follows the lane.
- Cropped helicopter: Kite-1 flies fully inside the frame, its cone lands on the player's car.
- Duplicate location text: district and street are printed once.

## 1. The world

**Bahía Cobalto**, a horseshoe bay. Six districts: **Avenida Cobalto** (downtown towers and the
wide boulevard), **La Marina** (promenade, palms, yachts, cafés), **Mercado Viejo** (warm stucco
old town, awnings, narrow streets), **El Astillero** (docks, containers, cranes), **Playa Dorada**
(beach, hotels, boardwalk, umbrellas), **Cerro Alto** (hillside villas, switchback, overlook).

Grid about 2.1 km × 1.5 km: seven north-south avenues, five east-west streets, a coastal
boulevard, beach and sea to the south, hills north. Seeded RNG, so every frame is reproducible.
Buildings are boxes with canvas window textures, 2–30 floors, rooftop AC, tanks and signs; lit
windows warm at golden hour. Props: palms, streetlights, traffic lights, crosswalks, bus stops,
benches, bins, hydrants, awnings, billboards with invented brands, beach umbrellas, containers,
cranes, moored boats, a lighthouse, gulls, clouds.

Sky: gradient dome deep teal to peach, low warm sun, long shadows, sea shimmer with a surf line.
Golden hour fixed at 17:40; clock advances with play.

## 2. Player, camera, controls

Third-person 1.8 m character: torso, head, two arms, two legs, swing animation by speed. Collides
with building AABBs; cannot walk into the sea.

- `W A S D` / arrows move, `Shift` sprint, `Space` jump
- mouse orbits the camera (pointer lock on click), wheel zooms, camera collides with buildings
- `E` enter/exit nearest vehicle within 4 m
- `LMB` fire, `RMB` aim, `R` reload, `1 2 3 4` / `Q` weapon slots
- `Shift` in a car is the handbrake, `H` horn, `Tab` city map, `Esc` pause
- `[` `]` radio, `F5` / `F9` quick save/load, `Enter` confirm, arrows navigate menus

Camera: spring-damped third-person follow, shoulder offset, pulls back and up with speed, FOV
58→68, slight shake on shots and impacts.

## 3. Vehicles, traffic, pedestrians

Six vehicles with distinct models and handling in `config.VEHICLES`: `Cangrejo` (beater),
`Marea 4x4`, `Mula` (van), `Viento GT` (sports), `Tiburón` (muscle), `Rayo 250` (motorcycle).
Arcade physics: acceleration, drag, grip and drift, steering falling with speed, handbrake slide,
collisions with impulse and damage, smoke at low health, dead engine.

`E` enters and exits; the player model hides and the camera goes to chase. Parked cars are
everywhere; traffic cars can be carjacked and the driver flees.

Traffic: ~45 active cars on lane paths with spawn/despawn radius, lane following, horns, red
lights. **Density near the camera is what the judge sees: 6+ cars within 150 m in every driving
shot.** Pedestrians: ~70 on sidewalks, groups, some standing, fleeing from gunfire, sirens and
cars on the pavement.

## 4. Combat, health, police, wanted

Player 100 health, 50 armour (absorbs 60%). Death respawns at the hospital, −$250, wanted cleared.

Weapons (`WEAPONS`): fists, `Vesper` pistol (12 rounds, 34 dmg), `Mako` SMG (30, 22, auto),
`Breaker` shotgun (8 shells, 8×12). Ray hits, tracers, muzzle flash, casings, sparks, decals.
Reload animation and HUD ammo.

PDC (Policía de Cobalto), wanted 0–5 stars, rising with crimes:

- 1–2 stars: 1–3 cruisers chase, officers shout, try to box you in.
- 3 stars: officers shoot on foot, roadblocks spawn ahead.
- 4–5 stars: `Kite-1` helicopter with a spotlight follows; more units, faster spawns.
- Evade: no line of sight for ~8 s → `SEARCHING`, then stars decay one by one.
- HUD: stars, `IN SIGHT` / `SEARCHING` / `HIDDEN`, dispatch panel with call signs, distance in
  metres, tactic badges (`RAMMING`, `FLANKING`, `FIRING`, `ROADBLOCK`, `SPOTLIGHT`).

Cruiser model: black-and-white body, lightbar with alternating red/blue emissive, light pools on
the road, siren audio. Helicopter: body, rotor disc, tail, spotlight cone; circles the player and
reports position (wanted does not decay while lit).

## 5. Missions, story, progression

Eight story missions with dialogue (portrait chip + two or three lines), stages, marker, reward.
Story: **Rafa Cordero**, out of prison after five years, back to his sister **Lucía** who runs the
beach bar *La Marea* and owes **Don Ismael Rueda**'s smuggling ring; **Capitán Verónica Salas** of
the PDC is the law on his tail; the last job is at the lighthouse.

1. **Welcome Home** — drive Lucía's Cangrejo from the bus station to La Marea.
2. **The Debt** — collect an envelope at El Astillero, lose a 2-star tail.
3. **Bad Cargo** — steal the Mula van at the docks, deliver it to Mercado Viejo above 40%.
4. **The Captain** — tail Salas's cruiser, keep out of her sight cone.
5. **Cerro Alto** — break into a villa, steal the Tiburón, escape 3 stars down the hill.
6. **Radio Silence** — shoot out the smuggling ring's radio mast, survive the ambush.
7. **The Exchange** — meet Rueda at the lighthouse, betrayal, chase along the coast road.
8. **High Tide** — assault the marina warehouse, beat Rueda's crew, ending card.

Activities: three checkpoint races, a delivery board at La Marea, a shooting range behind the bar.
Cash, `respect` XP and ranks (Nobody → Runner → Wheelman → Shot Caller → Fixer → Kingpin), a
`Tienda` for weapons, armour and health pickups, a garage that repairs.

## 6. HUD (`hud.js`, 2D canvas overlay)

Dark translucent rounded panels, 1 px light border, cream text, one accent per role, 1280×720
virtual space scaled to the canvas.

- **Top-left** mission card: `JOB 3/8 · BAD CARGO`, stage pips, objective in bold, `NEXT …`,
  timer when the mission has one. Under it **PDC RESPONSE**: `● PDC RESPONSE  4 UNITS · 3★` and up
  to five rows (badge, call sign, `23 m`, tactic tag), footer `+2 more units · roadblock ahead`.
- **Top-centre** `WANTED` + five stars, status word (`IN SIGHT` red, `SEARCHING` amber, `HIDDEN`
  teal).
- **Top-right** clock `17:40`, `$12,450`, weapon row (four slots, name, ammo, active one lit).
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

## 9. Screenshot mode

`?shot=1|2|3|4` boots straight into a scripted scene, skips the menu, runs ~120 fixed steps to
settle traffic, peds and police, renders, sets `window.__shotReady = true`.

1. **Cover** — Viento GT north on Avenida Cobalto, 17:41, 4 stars: two cruisers close behind with
   flashing bars, a roadblock of two angled cruisers and cones ~95 m ahead, `Kite-1` fully in frame
   up-right with its spotlight on the player, 8+ civilian cars, peds on both sidewalks, skid marks,
   HUD with `JOB 6/8 · RADIO SILENCE`, `DESTROY THE MAST`, dispatch, dialogue.
2. **On foot** — Rafa on the La Marina promenade at 17:42: palms, yachts, stalls, benches, gulls,
   12+ peds, a cruiser approaching, pistol drawn, minimap and mission marker.
3. **Firefight** — Mercado Viejo alley: muzzle flash, tracers, sparks, two officers behind a
   cruiser door, 3 stars, health and armour down, `RADIO SILENCE` objective.
4. **Wide city** — high vantage over the bay at sunset: districts, coast road with traffic,
   lighthouse, downtown towers, beach, boats, HUD minimap and location label.

`scripts/shoot.mjs` opens each `?shot=N`, waits for `__shotReady`, asserts the numeric table,
captures 1280×720 JPEG under 256 KiB. `scripts/check.mjs --smoke` plays the title → walk → car →
drive → fire → wanted path and reports console errors.

## 10. Quality bar

- 60 fps at 1280×720 on a desktop; instancing for palms, lights and repeated props; merged static
  geometry; under ~400 draw calls; no per-frame allocation in hot loops.
- Every HUD label legible at 300 px wide: 11 px minimum at 1280.
- No console errors, no network requests, no missing files.
- Playable with no `?shot`: title → new game → walk → steal car → drive → shoot → wanted → mission.
