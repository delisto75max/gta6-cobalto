// Boot, system registry and the single fixed-step loop. Later gameplay systems register here
// without replacing the loop; screenshot staging uses the query hook and the same real scene.
import { MAX_FRAME, RENDER, SEED, STEP } from './config.js';
import { generateCity } from './city.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createScene } from './scene.js';
import { createVehicles } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPeds } from './peds.js';
import { createCombat } from './combat.js';
import { createPolice } from './police.js';

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
const vehicles = createVehicles(stage, city, player, seed);
const traffic = createTraffic(city, vehicles, seed);
const peds = createPeds(stage, city, seed);
const combat = createCombat(stage, city, player, vehicles, peds, seed);
const police = createPolice(stage, city, player, vehicles, combat, seed);
const input = createInput(canvas);
const systems = new Map();
const clock = { time: 0, dt: STEP, step: 0 };
const context = {
  city,
  scene: stage,
  player,
  vehicles,
  traffic,
  peds,
  combat,
  police,
  camera: stage.camera,
  clock,
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
registerSystem('vehicles', vehicles);
registerSystem('traffic', traffic);
registerSystem('peds', peds);
registerSystem('police', police);
registerSystem('combat', combat);
registerSystem('scene', { update: stage.update });
registerSystem('hud', {
  update() {},
  drawHUD(g, ctx) {
    const vehicle = ctx.vehicles.activeVehicle;
    const nearby = vehicle ? null : ctx.vehicles.nearestVehicle(ctx.player.state.position.x, ctx.player.state.position.z, 4);
    if (!vehicle && !nearby) return;
    const ratio = hudCanvas.width / Math.max(1, window.innerWidth);
    g.save();
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.textBaseline = 'alphabetic';
    if (vehicle) {
      const x = window.innerWidth - 276;
      const y = window.innerHeight - 137;
      g.fillStyle = 'rgba(13, 25, 29, 0.78)';
      g.fillRect(x, y, 252, 113);
      g.fillStyle = '#e8c985';
      g.font = '600 15px sans-serif';
      g.fillText(vehicle.name.toUpperCase(), x + 18, y + 27);
      g.fillStyle = '#f5f0df';
      g.font = '700 42px sans-serif';
      g.fillText(String(Math.round(Math.abs(vehicle.speed) * 3.6)), x + 16, y + 75);
      g.font = '600 14px sans-serif';
      g.fillStyle = '#b9cbc9';
      g.fillText('km/h', x + 101, y + 73);
      g.fillStyle = '#283b40';
      g.fillRect(x + 17, y + 91, 216, 5);
      g.fillStyle = vehicle.health < vehicle.maxHealth * 0.3 ? '#d75d47' : '#6ea68e';
      g.fillRect(x + 17, y + 91, 216 * vehicle.health / vehicle.maxHealth, 5);
    } else {
      const text = `E  ENTER ${nearby.name.toUpperCase()}`;
      g.font = '600 14px sans-serif';
      const width = g.measureText(text).width + 34;
      const x = (window.innerWidth - width) / 2;
      const y = window.innerHeight - 68;
      g.fillStyle = 'rgba(13, 25, 29, 0.76)';
      g.fillRect(x, y, width, 38);
      g.fillStyle = '#f0dcaa';
      g.fillText(text, x + 17, y + 25);
    }
    g.restore();
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
window.__cobalto = {
  city, scene: stage, player, vehicles, traffic, peds, combat, police, input, systems, context, metrics, registerSystem,
};

let accumulator = 0;
let previousTime = performance.now();
let fpsTime = previousTime;
let paintedFrames = 0;
let announcedDistrict = player.state.district;
let titleHidden = false;

function fixedUpdate() {
  context.actions = input.read();
  context.time += STEP;
  clock.time = context.time;
  clock.step += 1;
  for (const system of systems.values()) system.update?.(STEP, context);
  accumulator -= STEP;
  metrics.fixedSteps += 1;
  if (player.state.district !== announcedDistrict) {
    announcedDistrict = player.state.district;
    status.textContent = `${player.state.vehicle ? 'Driving' : 'Walking'} through ${announcedDistrict}.`;
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
  status.textContent = player.state.vehicle
    ? 'W/S drive, A/D steer, RMB aim, LMB fire from the window, E step out.'
    : 'WASD move, RMB aim, LMB fire, R reload, 1/2/3 or wheel switch, E enter a vehicle.';
});

status.textContent = 'Bahía Cobalto ready. Click for mouse look. WASD move, E enter/exit, RMB aim, LMB fire, R reload, 1/2/3 weapons.';
requestAnimationFrame(frame);
