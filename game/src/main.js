// Boot, system registry and the single fixed-step loop. Later gameplay systems register here
// without replacing the loop; screenshot staging uses the query hook and the same real scene.
import { MAX_FRAME, RENDER, SEED, STEP } from './config.js';
import { generateCity } from './city.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createScene } from './scene.js';

const canvas = document.getElementById('game');
const hudCanvas = document.getElementById('hud');
const hudContext = hudCanvas.getContext('2d');
const status = document.getElementById('status');
const title = document.getElementById('title');
const errorPanel = document.getElementById('error');

function showError(error) {
  const text = error?.stack || error?.message || String(error);
  errorPanel.textContent = `COBALTO could not continue\n\n${text}`;
  errorPanel.hidden = false;
  status.textContent = `Game error. ${error?.message || String(error)}`;
}

window.addEventListener('error', (event) => showError(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => showError(event.reason));

const parameters = new URLSearchParams(window.location.search);
const requestedSeed = Number.parseInt(parameters.get('seed') ?? '', 10);
const seed = Number.isInteger(requestedSeed) ? requestedSeed : SEED;
const shotName = parameters.get('shot');
window.__shotReady = false;
window.__shotName = shotName || null;

const city = generateCity(seed);
const stage = createScene(canvas, city);
const player = createPlayer(stage, city);
const input = createInput(canvas);
const systems = new Map();
const context = {
  city,
  scene: stage,
  player,
  actions: input.actions,
  systems,
  seed,
  shot: shotName,
  time: 0,
};

function registerSystem(name, system) {
  if (!name || systems.has(name)) throw new Error(`System name already registered: ${name}`);
  systems.set(name, system);
  return system;
}

registerSystem('player', player);
registerSystem('scene', { update: stage.update });
registerSystem('hud', {
  update() {},
  drawHUD() {
    // The real HUD arrives with missions; this pass-through keeps canvas ownership here.
  },
});

function resizeHUD() {
  const ratio = Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio);
  hudCanvas.width = Math.round(window.innerWidth * ratio);
  hudCanvas.height = Math.round(window.innerHeight * ratio);
}

window.addEventListener('resize', resizeHUD);
resizeHUD();

const metrics = {
  fps: 0,
  frames: 0,
  fixedSteps: 0,
  drawCalls: 0,
  triangles: 0,
};
window.__cobalto = { city, scene: stage, player, input, systems, context, metrics, registerSystem };

let accumulator = 0;
let previousTime = performance.now();
let fpsTime = previousTime;
let paintedFrames = 0;
let announcedDistrict = player.state.district;
let titleHidden = false;

function fixedUpdate() {
  context.actions = input.read();
  context.time += STEP;
  for (const system of systems.values()) system.update?.(STEP, context);
  accumulator -= STEP;
  metrics.fixedSteps += 1;
  if (player.state.district !== announcedDistrict) {
    announcedDistrict = player.state.district;
    status.textContent = `Walking through ${announcedDistrict}.`;
  }
  if (context.actions.pausePressed) status.textContent = 'Mouse released. Click the city to resume mouse look.';
}

function drawHUD() {
  hudContext.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
  for (const system of systems.values()) system.drawHUD?.(hudContext, context);
}

function frame(now) {
  requestAnimationFrame(frame);
  const frameSeconds = Math.min(MAX_FRAME, Math.max(0, (now - previousTime) / 1000));
  previousTime = now;
  accumulator += frameSeconds;
  while (accumulator >= STEP) fixedUpdate();

  const alpha = accumulator / STEP;
  for (const system of systems.values()) system.render?.(alpha, context);
  stage.render();
  drawHUD();
  paintedFrames += 1;
  metrics.frames += 1;
  if (now - fpsTime >= RENDER.fpsSampleMilliseconds) {
    metrics.fps = metrics.frames * 1000 / (now - fpsTime);
    metrics.drawCalls = stage.renderer.info.render.calls;
    metrics.triangles = stage.renderer.info.render.triangles;
    metrics.frames = 0;
    fpsTime = now;
  }

  if (shotName && paintedFrames >= 2) window.__shotReady = true;
  if (paintedFrames >= 2 && !titleHidden) {
    titleHidden = true;
    title.classList.add('ready');
    window.setTimeout(() => { title.hidden = true; }, 650);
  }
}

document.addEventListener('visibilitychange', () => {
  accumulator = 0;
  previousTime = performance.now();
});

canvas.addEventListener('pointerdown', () => {
  status.textContent = `Exploring ${player.state.district}. WASD to walk, Shift to sprint, Space to jump.`;
});

status.textContent = 'Bahía Cobalto ready. Click the city for mouse look. W A S D to walk, Shift to sprint, Space to jump.';
requestAnimationFrame(frame);
