# AGENTS.md — COBALTO: BAHÍA CALIENTE (make.fun gta6-01, build v2)

You are building the entry for make.fun bounty **gta6-01 "Make GTA 6"**. This repository is your
workspace. Read `docs/BUILD_SPEC.md` before writing code: it is the complete product and file
specification.

## State you inherit (do not redo)

- make.fun account **@delisto75max** is connected; do not login, do not ask for approval.
- The kit is unpacked at `/home/eris/projects/makefun/gta6/kit26/gta6-01-kit` (level 26). Its
  `RULES.txt` is the rulebook; skim "The task", "The gate", "The dossier".
- Recording is already running and watches this directory. Do not stop it, do not submit, do not
  push to GitHub. Do not run `makefun` at all except if you need to check `status`.
- You may **look at** `/home/eris/projects/makefun/gta6/repo/screenshots/*.jpg` (the previous
  attempt's renders) as a visual reference for the bar to beat. **Do not read its source code** —
  every line you write must be your own, and read code counts against authorship.

## First five minutes — touch the pre-existing files

These files exist before you start and count as "pre-existing" for the transcript gate unless you
rewrite them in this session. Rewrite each one early, with real improvements (not byte-identical):

- `AGENTS.md` (this file), `.gitignore`, `docs/BUILD_SPEC.md`, `scripts/shoot.mjs`, `scripts/check.mjs`

Leave the kit's own files untouched: `LICENSE`, `serve.ts`, `vendor/makefun-game.ts`,
`.makefun/owner.json`, `game/vendor/*.min.js`. Edit `main.ts` only in its header comment (one line
you write).

## What to build

A complete, original, 3D low-poly open-world crime game in the spirit of GTA, playable offline from
static files in desktop Chrome, keyboard + mouse. Build **all** of it in this session, run it,
screenshot it, look at the screenshots, and fix what is broken or ugly. `docs/BUILD_SPEC.md` lists
the files and every system.

Hard rules:

- Static files only under `game/`; `game/index.html` runs from any static server. No network at
  runtime — no CDN, no external font, no `http(s)` URL in a reachable file. Local modules or
  `data:` URIs only. three.js is vendored, import-map name `three`.
- Only three.js may be vendored. All game code is yours, written now.
- Original names, city, characters, vehicles, story, art, sound. Nothing from Rockstar's GTA.
- `game/` under 40 MiB and 900 files. No binary assets: canvas textures, WebAudio sound.
- One clear job per file, named for it (the judge reads the source outline).
- `screenshots/` ends with 3 or 4 JPEGs, 1280x720, each under 256 KiB, rendered from the game.

## Work loop (do this, do not skip)

1. Write the modules in the order in the spec. Write each file in ONE `write_file` call — do not
   spend ten minutes planning draw calls in your head before the first file exists.
2. `node serve.ts --port 8080` in the background, then `node scripts/shoot.mjs all` to write
   `screenshots/*.jpg`. It prints `debug={...}` for every shot: a shot is done only when the
   minimums in `docs/BUILD_SPEC.md` §0a are met, and `vision_analyze` confirms the frame reads.
3. `node scripts/check.mjs 1` … `4` for console errors and failed requests; a free-play smoke test
   must reach the title, start a game, walk, enter a car, drive, fire, and show a wanted level.
4. Iterate on the four shot scenes until each one reads at a glance: city, chase, police, HUD.
5. `git add -A && git commit -m "..."` when done. Do not push.

## When you finish

Print a short report: files with line counts, what works, what is weak, and the commands you ran.
Stop there.
