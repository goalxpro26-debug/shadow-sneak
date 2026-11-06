# Shadow Sneak: Silent Strike

An original top-down stealth game. Slip between cover, wait for patrols' vision
cones to turn, and strike from behind. Every contract ends with a Boss — take
them down, then slip out the exit.

All titles, characters, art and music are original. No copied art, code, names,
characters or assets from any existing game. All visuals are drawn procedurally
on canvas; all sound is synthesized with WebAudio.

## How to run

Open `index.html` in any modern browser (desktop or mobile). No build step,
no server, no network, no external assets — a single self-contained file.

```sh
# option 1: double-click index.html
# option 2: serve locally
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

## How to play

- **Move:** tap / click anywhere to sneak there. WASD or arrow keys also work.
- **Vision cones:** yellow wedges are what guards can see. Caught inside one
  with a clear line of sight, the alarm meter fills — break line of sight or
  hide in a bush to let it drain.
- **Cover:** crates block sight and movement. Bushes hide you completely while
  you stand in them.
- **Strike from behind:** creep up behind a guard (or the Boss) until STRIKE
  lights up, then tap it, press Space, or tap the guard. A frontal strike
  sets off the alarm.
- **Smoke bomb** (unlocked Level 3): blinds nearby guards for 5 seconds.
- **Dash** (unlocked Level 6): a burst of speed.
- **Contract:** take down the Boss, then reach the glowing green exit.
  Spotted 3 times in a level and the contract fails.
- **Pause:** ❚❚ button or P / Esc. **Mute:** 🔊 button or M.

## Contents

- **20 levels** ("contracts") with rising difficulty: 2 guards on Level 1 up
  to 8 on Level 20, faster patrols, longer vision range and wider Boss cones.
  Each level is seeded, so layouts are fixed per level.
- **Score / progress:** +100 per silent takedown, +300 for the Boss, level
  bonus for remaining lives, time and unused smoke. Progress (highest
  unlocked contract) persists in `localStorage`.
- **Lives:** 3 per level. A full alarm costs one life and resets you to the
  start; losing all 3 ends the run with a retry screen.
- **Unlocks:** Night Fox (+12% speed, Level 5), Silent Owl (+1 smoke,
  Level 10), Ghost (fast + quiet, Level 15); Smoke Bomb (Level 3),
  Dash (Level 6). Unlockable characters are picked on the start menu.
- **Screens:** start menu with how-to-play and level select, pause, level
  clear, game over, and a win screen after Contract 20.
- **Audio:** original synthesized WebAudio music (A-minor bass pulse +
  plucked arpeggio loop) and SFX for strikes, alerts, smoke, dash, clears
  and the win fanfare. No copyrighted music.

## Files

- `index.html` — the whole game (HTML + CSS + vanilla JS + Canvas + WebAudio)
- `test.js` — headless real-click test (Playwright + system Chromium)
- `test-shots/` — screenshots captured by the test run
- `README.md` — this file

## Test results

Headless test: `node test.js file:///.../index.html test-shots`
(Playwright `playwright-core` + `/opt/meta-chromium/chrome`, real DOM clicks
on buttons and real canvas pointer clicks for movement/strikes, driven by the
`window.__shadowSneak()` state hook — no simulated game-state calls.)

<!-- TEST-RESULTS -->

Tested Nov 6, 2026 with `test.js` (Playwright `playwright-core` +
`/opt/meta-chromium/chrome`, 480×860 viewport). All driving is real DOM
clicks on buttons and real canvas pointer clicks for movement and strikes,
read through the `window.__shadowSneak()` state hook. The full run was done
in segments because this VM's headless Chrome intermittently kills its own
renderer (see environment notes); every segment's results are recorded in
`test-shots/progress.json` and the run logs.

**Passed:** the main run went 13/14 (the single failure was the Level 2
pathfinding bug below, fixed and re-verified by the resume runs), and the
final resumed segment (levels 12–20) went 3/3 including the win screen:

- Loads, menu screen, how-to overlay open/back, start → playing Level 1
  (2 guards, Boss alive, 3 lives).
- Click-to-move: real canvas tap moved the player 105px toward the target.
- Pause → paused, resume → playing, mute on/off toggles.
- Level 1 completed by real play: boss back-strike + walk to exit → clear
  screen (score 885); Next → Level 2; smoke correctly locked on Level 2
  (0 left) and unlocked on Level 3 (2 left).
- Levels 2–20 each cleared by real clicks (boss back-strike, then exit),
  ending on the **win screen "MASTER OF SHADOWS"** (final score 980, total
  career score 8570). Screenshots: `01-menu.png`, `02-level1.png`,
  `03-paused.png`, `04-clear.png`, `05-level10.png`, `06-level20.png`,
  `07-win.png` — the level-1 and win shots were visually inspected and
  show the HUD, vision cones, guards, Boss, crates, bushes and exit.
- **Zero console/page errors** in every run (`no console/page errors` check
  passed in the main run and in the final 12–20 segment).

**Bugs found by testing and fixed during the run:**

1. Headless Chrome here fires `requestAnimationFrame` ~once per few seconds,
   so a rAF-only loop stalled the game. Fix: game logic ticks on a 33ms
   timer, painting stays on rAF (real browsers still get smooth frames).
2. Timer-driven painting killed the headless renderer outright (menu died
   in <10s; a blank page survived 3 min). Fix: painting on rAF only, static
   floor cached to an offscreen canvas — the page then survived 150s+ idle.
3. Click-to-move had no pathfinding: the player wedged against crates and
   Level 2 timed out with the Boss already dead. Fix: grid BFS pathfinding
   around crates (with nearest-free-cell retargeting when the clicked cell
   is inside a crate); guards/Boss waypoints and spawns are also kept out
   of crates and guards no longer walk through them.
4. The STRIKE button can disable mid-race as a target walks out of range,
   stalling Playwright's click. Fix (test-side): the bot now taps the
   target on the canvas, which strikes directly; the button still works
   for human players.
5. Bottom level banner overlapped the action buttons — moved above the field.

**Environment notes (not game bugs):** the VM was under heavy load during
testing (load average 20–50, 50–130 Chrome processes from other work), so
individual steps ran slower than wall-clock time and the browser died
twice mid-run; the test resumes via the `?level=N` deep link and
`test-shots/progress.json`, and every level 1–20 was cleared across the
segments. A short post-fix check (load → start → canvas tap) passed with
the player moving 125px and zero errors.

## Deep link

`index.html?level=N` (1–20) jumps straight into that contract — used by the
headless test to resume, handy for jumping back into a later level.
