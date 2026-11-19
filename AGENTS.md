# AGENTS.md — COBALTO: BAHÍA CALIENTE (make.fun gta6-01 entry)

You are building the entry for make.fun bounty **gta6-01 "Make GTA 6"**. Your repository is this
directory (`/home/eris/projects/makefun/gta6/repo`). Read `docs/BUILD_SPEC.md` before writing code:
it is the complete product and file specification.

## State you inherit (do not redo)

- The make.fun account is already connected as **@delisto75max**; do not run `login` and do not ask
  for approval.
- The kit is unpacked at `/home/eris/projects/makefun/gta6/kit26/gta6-01-kit` (level 26). Its
  `RULES.txt` is the authoritative bounty rulebook — read the sections "The task", "The gate",
  "The dossier" and "Transcripts" once.
- **Do not submit.** Do not run `makefun submit`. Do not push to GitHub. The operator seals the
  recording and submits after your session ends.
- The repository is intentionally empty of game code except `game/vendor/three.module.min.js`,
  `game/vendor/three.core.min.js`, `vendor/makefun-game.ts`, `serve.ts`, `main.ts` (kit starter),
  `LICENSE` and `.makefun/owner.json`. Everything under `game/src/` is yours to write.

## What to build

A complete, original, 3D low-poly open-world crime game in the spirit of GTA, playable offline from
static files in desktop Chrome, with keyboard + mouse. Build **all** of it in this session, then run
it, screenshot it, look at the screenshots, and fix what is broken or ugly. Follow
`docs/BUILD_SPEC.md` file by file.

Hard rules:

- Static files only under `game/`. `game/index.html` must open from any static server. No network
  request at runtime — no CDN, no external font, no `http(s)` URL in any reachable file. Everything
  is a local module/file or a `data:` URI. three.js is vendored and reachable through the import map
  name `three` (already set up in the starter's index.html pattern).
- Only three.js may be vendored; write all game code yourself. Do **not** copy code from the
  previous attempt or from any other entry — every line must be your own writing in this session.
- Original names, city, characters, vehicles, story, art, sound: nothing from Rockstar's GTA.
- Keep `game/` under 40 MiB and 900 files. No binary assets; textures are generated with canvas,
  audio with WebAudio.
- Every file gets one clear job and a name that says it (the judge reads the source outline).
- `main.ts` is the kit's starter: edit it only to describe this game in its header comment
  (it must contain at least one line you wrote).
- `screenshots/` must end with 3 or 4 JPEGs, 1280x720, each under 256 KiB, rendered from the game.

## Work loop (do this, do not skip)

1. Write the modules in the order given in the spec.
2. `node serve.ts --port 8080` (background) and open the game with the screenshot tool:
   `node scripts/shoot.mjs 1` (it writes `screenshots/1-....jpg`). Inspect the file with the
   `vision_analyze` tool and fix visual bugs.
3. Test each shot scene (`?shot=1` … `?shot=4`), then a free-play smoke test: the page must reach
   `window.__shotReady` / run without console errors. `node scripts/check.mjs` prints console errors.
4. Fix everything you see: z-fighting, floating props, missing HUD panels, unreadable text, black
   screen, cars sunk in the road, camera clipping.
5. `git add -A && git commit -m "..."` when done. Do not push.

Keep the game fun and legible over elaborate: 60 fps at 1280x720 in a real browser, and every HUD
panel readable at 300 px wide (the judge sees a shrunk contact sheet).

## When you finish

Print a short report: files written with line counts, what works, what is weak, and the exact
commands you ran to test. Stop there.
