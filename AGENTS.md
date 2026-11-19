# AGENTS.md — COBALTO build notes pass

This repository holds a finished, playable game. Your only job in this session:

1. Read `docs/BUILD_SPEC.md`, `game/index.html` and skim the files under `game/src/` so your notes
   are accurate.
2. **Rewrite this file**: replace everything above and below this list with a concise "Build notes"
   document (40-60 lines) that covers: what the game is, the controls, the file layout with one line
   per module, the four `?shot=` scenes, how to serve and screenshot it (`node serve.ts`,
   `node scripts/shoot.mjs`, `node scripts/check.mjs`), and the main systems (city, traffic, peds,
   police/wanted, combat, missions, HUD, save, audio).
3. Also change one line in `docs/BUILD_SPEC.md`'s title so it reads as documentation of the finished
   game rather than a work order.
4. Commit with `git add -A && git commit -m "Build notes"`. Do not push, do not run makefun, do not
   change anything under `game/`, and do not submit.
