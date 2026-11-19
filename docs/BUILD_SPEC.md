# BUILD SPEC — COBALTO: BAHÍA CALIENTE

An original open-world crime game for make.fun bounty `gta6-01`. 3D low-poly, third-person,
golden-hour coastal city. three.js is vendored (`game/vendor/three.module.min.js` and
`three.core.min.js`, import-map name `three`). No other library. Every asset is generated at
runtime (canvas textures, WebAudio).

The judge ranks by, in order: (1) a complete open world *shown in the screenshots* — city on foot
and by car, traffic and pedestrians, wanted level with police responding, missions; (2) depth and
fun — missions and story, vehicles, activities, combat, progression; (3) feel and polish — controls,
camera, HUD with minimap, effects, menus; (4) look and originality — a coherent sun-soaked modern
city of its own; (5) structure — one clear job per source file.

The screenshots are the main evidence. Four of them must each show several systems at once.

## 1. The world

**Bahía Cobalto**, a port city on a horseshoe bay, six districts:

| District | Look |
|---|---|
| Avenida Cobalto | downtown towers, wide boulevard, glass and concrete |
| La Marina | promenade, palms, yachts, low pastel buildings, cafés |
| Mercado Viejo | old town, narrow streets, awnings, warm stucco |
| El Astillero | docks, cranes, containers, warehouses, chain-link |
| Playa Dorada | beach, hotels, boardwalk, umbrellas, sea |
| Cerro Alto | hillside villas, switchback road, overlook |

City layout: a grid of blocks roughly 2.2 km x 1.6 km, roads 14 m wide with sidewalks, a beach along
the south edge and water beyond, hills at the north edge. Generate it procedurally from a seeded
RNG (`config.SEED`) so every frame is reproducible. Roads: 7 north-south avenues, 5 east-west
streets, with a coastal boulevard and one highway curve into the hills. Buildings: boxes with
window grids painted by canvas textures (2-3 shared textures, tinted per building), 2-30 floors,
rooftop details (AC units, water tanks, signs). Props: palms, streetlights, traffic lights, bus
stops, beach umbrellas, containers, cranes, moored boats, billboards with invented brands,
fire hydrants, trash bins.

Sky: gradient dome (deep teal to peach), low sun with warm directional light and long shadows,
fog for depth, a few flat clouds, gulls. Ocean: large plane with a subtle animated normal-ish
shimmer (vertex offset or scrolling texture), white shoreline strip.

Time of day fixed at golden hour (17:40) but a clock advances in game; the sun colour and fog can
shift slightly over the session. Keep it warm: amber key light, cool blue shadow fill.

## 2. Player, camera and controls

Third-person character: 1.8 m capsule assembled from boxes/capsules with a head, torso, two arms,
two legs; simple limb swing animation driven by speed; two outfits (default white shirt + dark
trousers). Position on foot, collision with building AABBs and the sea (cannot walk into water).

Controls (keyboard + mouse):

- `W A S D` / arrows — move; `Shift` — sprint; `Space` — jump
- Mouse — orbit camera (pointer lock on click); wheel — zoom; camera collision with buildings
- `E` — enter/exit the nearest vehicle (within 4 m)
- `LMB` — fire; `RMB` — aim (tighter camera, crosshair); `R` — reload
- `1 2 3 4` / `Q` — weapon slots (fists, pistol, SMG, shotgun)
- `Shift` in a car — handbrake; `H` — horn
- `Tab` — full city map; `Esc` — pause menu
- `[` `]` — radio station; `F5`/`F9` — quick save/load
- `Enter` — confirm in menus; arrows — menu navigation

Camera: spring-damped third-person follow, shoulder offset, look-ahead when driving (pulls back and
raises with speed), FOV 58→68 with speed, small shake on impacts and gunshots.

## 3. Vehicles, traffic, pedestrians

Six vehicles, each a distinct low-poly model (body, cabin, wheels, lights, plate), with handling
specs in `config.js` (`VEHICLES`): `Cangrejo` (beater), `Marea 4x4`, `Mula` (van), `Viento GT`
(sports), `Tiburón` (muscle), `Rayo 250` (motorcycle). Arcade physics: forward acceleration, drag,
grip/drift factor, steering that scales down with speed, handbrake slide, collisions with buildings
and other cars (simple impulse + damage). Damage shows as smoke at low health and a dead engine.

Enter/exit: `E` near a car; the player model is hidden and the camera switches to chase; exit places
the player beside the door. Parked cars everywhere; traffic cars can be carjacked (the driver flees).

Traffic: ~40 active cars on lane paths around the player (spawn/despawn in a radius), obey lanes,
slow behind obstacles, stop at red lights on the boulevard, honk. Pedestrians: ~60 walking
sidewalks, some standing in groups; flee when shots are fired or a car mounts the pavement.

## 4. Combat, health, police, wanted

Player: 100 health, 50 armour; armour absorbs 60% of damage. Death → fade, respawn at the nearest
hospital with $250 less and wanted cleared.

Weapons (`WEAPONS` in config): fists (melee), `Vesper` pistol (12 rounds, 34 dmg), `Mako` SMG
(30 rounds, 22 dmg, auto), `Breaker` shotgun (8 shells, 8x12 dmg spread). Raycast hits with
tracer lines, muzzle flash sprite, shell casings, impact sparks and decals. Reload with animation
and HUD ammo.

Police (PDC — Policía de Cobalto): wanted 0-5 stars. Stars rise with crimes (shots fired near
civilians, carjacking in view, hitting cops, killing). Response:

- 1-2 stars: 1-3 cruisers chase, officers shout, try to box you in.
- 3 stars: officers shoot on foot, roadblocks spawn ahead on your road.
- 4-5 stars: `Kite-1` helicopter with a spotlight cone follows you, more units, faster spawning.
- Evasion: when no cop has line of sight for ~8 s, a "searching" state, then stars decay one by one.
- Wanted HUD shows stars, `IN SIGHT`/`SEARCHING`, and a dispatch panel listing units with call signs,
  distance in metres and a tactic badge (`RAMMING`, `FLANKING`, `FIRING`, `ROADBLOCK`, `SPOTLIGHT`).

Cop AI: drive to a point ahead of the player, ram, PIT at close range; on foot, take cover-ish
positions and fire in bursts. Helicopter circles with a spotlight mesh and light cone, reports
your position (keeps wanted from decaying while lit).

## 5. Missions, story, activities, progression

Eight story missions, each with a short dialogue intro (portrait + 2-3 lines), stages, a marker,
and a reward. Story: **Rafa Cordero**, out of prison after five years, returns to his sister
**Lucía** who runs the beach bar *La Marea* and owes money to **Don Ismael Rueda**'s smuggling ring;
**Capitán Verónica Salas** of the PDC is the law on his tail. Final mission at the lighthouse.

Mission list (`MISSIONS` in `missions.js`), each with a `stage` machine:

1. **Welcome Home** — drive Lucía's Cangrejo from the bus station to La Marea (waypoint driving).
2. **The Debt** — collect an envelope at El Astillero, then lose a 2-star tail.
3. **Bad Cargo** — steal the Mula van from the docks, deliver it to Mercado Viejo without wrecking it.
4. **The Captain** — tail Salas's cruiser at distance, keep out of her sight cone.
5. **Cerro Alto** — break into a villa, steal the Tiburón, escape 3 stars down the switchbacks.
6. **Radio Silence** — shoot out the smuggling ring's radio mast, survive the ambush.
7. **The Exchange** — meet Rueda at the lighthouse; betrayal; chase him along the coast road.
8. **High Tide** — assault the marina warehouse, beat Rueda's crew, final choice and ending card.

Activities: three street races (checkpoint races against one rival, timed), a delivery job board at
La Marea (random cargo runs), and a shooting range behind the bar. Rewards pay cash.

Progression: cash, `respect` XP and rank names (Nobody → Runner → Wheelman → Shot Caller → Fixer →
Kingpin), weapon unlocks bought at a `Tienda` marker (pistol/SMG/shotgun), armour and health pickups,
vehicle condition upgrades at a garage marker. Save the lot.

## 6. HUD (drawn on a 2D canvas overlay, `hud.js`)

Exactly this layout, all panels dark translucent rounded rectangles with 1 px light border, warm
cream text, one accent colour per role:

- **Top-left — mission card**: `JOB 3/8 · BAD CARGO`, a stage row of pips, the objective in bold,
  `NEXT ...` line, and a timer when the mission has one. Under it, the **PDC RESPONSE** panel:
  `● PDC RESPONSE  4 UNITS · 3★`, then up to 5 rows: badge, call sign, distance `23 m`, tactic
  tag. Footer `+2 more units · roadblock ahead`.
- **Top-centre — wanted**: `WANTED` + 5 stars (filled gold / empty outline), a status word
  (`IN SIGHT` red, `SEARCHING` amber, `HIDDEN` teal).
- **Top-right — clock and cash**: `17:40` and `$12,450`; under them the weapon row: 4 slots with
  name, ammo, active highlighted.
- **Bottom-left — minimap**: circular, 210 px, rotatable (north-up default), showing roads, blocks,
  water, district label, player arrow, mission marker (gold diamond), police blips (red/blue),
  helicopter, and a red dashed search radius when wanted. Under it `HEALTH` and `ARMOUR` bars,
  location `LA MARINA · Malecón`, and the respect bar `RANK 3 · WHEELMAN  240/500`.
- **Bottom-centre — dialogue**: portrait chip (initial + colour), speaker name + role, one line of
  dialogue, typewriter reveal; also used for radio chatter.
- **Bottom-right — vehicle**: big speed `87` + `KM/H`, gear `G3`, vehicle name, condition bar,
  radio station `♪ COBALTO 104.7 — Noche Azul`.
- Toast messages (top-centre under wanted): `+$350`, `MISSION PASSED`, `WANTED LEVEL UP`.

Draw the HUD in `hud.js` with a fixed 1280x720 virtual coordinate space scaled to the canvas, so
the same layout works at any window size. Use a clean geometric sans (system-ui), letter-spacing on
labels, tabular numbers.

## 7. Menus, save, audio

- **Title**: city skyline at golden hour behind a gradient, big title `COBALTO`, subtitle
  `BAHÍA CALIENTE`, `NEW GAME` / `CONTINUE` / `SETTINGS` / `CONTROLS`, small print of the controls.
- **Pause**: resume, map, settings, save, quit to title.
- **Map**: full-screen city map with districts, roads, mission marker, player, owned safehouse.
- **Settings**: master volume, mouse sensitivity, invert Y, HUD scale — persisted.
- **Save**: localStorage key `cobalto.save.v1`, autosave every 60 s and after missions; quick save/load.
- **Audio** (`audio.js`, WebAudio only): engine loop (saw + lowpass, pitch by RPM), tyre skid,
  horn, gunshots per weapon, reload clicks, footsteps, siren (two-tone), helicopter rotor, UI clicks,
  ambient city bed, and three radio stations that are simple procedural sequencers (synthwave,
  latin guitar-ish plucks, talk). Volume buses: master, music, sfx.

## 8. Files (one job each)

```
game/index.html          canvas + HUD canvas + import map + boot
game/src/config.js       SEED, palette, tunables, districts, VEHICLES, WEAPONS, MISSIONS meta
game/src/rng.js          seeded RNG helpers
game/src/city.js         procedural city data: roads, blocks, buildings, props, lanes, POIs
game/src/scene.js        three.js world: sky, sun, sea, ground, buildings, props, lights
game/src/player.js       on-foot movement, collision, character mesh, animation
game/src/vehicles.js     vehicle meshes, arcade physics, enter/exit, damage
game/src/traffic.js      lane traffic simulation
game/src/peds.js         pedestrian simulation
game/src/police.js       wanted level, cruiser/helicopter AI, roadblocks, search
game/src/combat.js       weapons, raycasts, effects, damage, pickups
game/src/missions.js     story missions, stages, dialogue, races, delivery jobs
game/src/hud.js          all HUD drawing + minimap
game/src/menus.js        title, pause, map, settings, dialogs
game/src/save.js         localStorage save/load, settings persistence
game/src/audio.js        WebAudio synth SFX, engine, sirens, radio stations
game/src/main.js         game state machine, fixed-step loop, input wiring, shot mode
```

`main.js` owns `state` and calls `update(dt)` on each subsystem in a fixed order: input → player or
vehicle → traffic → peds → police → combat → missions → hud. Keep the module APIs small and explicit
(export a `createX(...)`, `updateX(dt, ...)`, `drawX(...)`); no circular imports except through
`main.js`.

## 9. Screenshot mode (critical)

`index.html` must accept `?shot=1|2|3|4` and boot directly into a scripted scenario, skipping the
menu:

1. **Cover** — driving the Viento GT north on Avenida Cobalto at 17:40, 4 stars, two cruisers
   behind, Kite-1 helicopter ahead casting a spotlight, traffic and palms, full HUD with an active
   mission (`JOB 6/8 · RADIO SILENCE`, `DESTROY THE MAST`), dialogue line from Lucía.
2. **On foot** — Rafa walking La Marina promenade, palms and yachts, pedestrians, HUD with minimap,
   mission marker, pistol drawn, a cop car approaching.
3. **Firefight** — Mercado Viejo alley, muzzle flash, two officers behind a cruiser, 3 stars,
   health/armour partially down, mission objective visible.
4. **Wide city** — a high vantage over the bay at sunset showing districts, traffic trails, the
   lighthouse and downtown, with the HUD minimap and `BAHÍA COBALTO` location label.

Each shot boots deterministically (no reliance on real time), runs ~120 fixed steps to settle
traffic/peds/police, then renders and sets `window.__shotReady = true`. The HUD must be fully
populated in every shot. `scripts/shoot.mjs` will open `?shot=N`, wait for `__shotReady`, capture
1280x720 PNG and convert to JPEG under `screenshots/`.

## 10. Quality bar and performance

- 60 fps at 1280x720 on a normal desktop; use InstancedMesh for windows/palms/streetlights, merge
  static geometry, keep draw calls under ~400, no per-frame allocations in hot loops.
- Every HUD label legible when the 1280x720 frame is shrunk to 300 px wide: nothing below 11 px at
  1280, key labels 13-16 px, mission title 20 px, cash 26 px.
- No console errors. No network requests. No missing files.
- The game must be playable with no shot parameter: title → new game → walk → steal car → drive →
  shoot → wanted → mission.

Write the code now, file by file, in the order above. After each group, run the game and screenshot
it. Do not stop until all four shot scenes render correctly and the free-play loop works.
