// main.js — COBALTO's state machine: boot, menus, the fixed-step loop, input, the cameras, save
// hooks, the four scripted screenshot scenes, and the small public test hooks the smoke test uses.
import * as THREE from 'three';
import { PLAYER_START, RADIO, RANKS, DISTRICTS, locationAt, WEAPONS, CAMERA } from './config.js';
import { buildCity } from './city.js';
import { createWorld } from './scene.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPeds } from './peds.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHUD } from './hud.js';
import * as Menus from './menus.js';
import { createAudio } from './audio.js';
import * as Save from './save.js';

// ---------------------------------------------------------------------------------------------
// boot

const canvas = document.getElementById('game');
const hudCanvas = document.getElementById('hud');
const bootEl = document.getElementById('boot');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(1280, 720, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1280 / 720, 0.1, 5000);
const city = buildCity();
const world = createWorld(scene, city);
const hud = createHUD(hudCanvas, city);

const player = createPlayer(scene, city);
const vehicles = createVehicles(scene, city, player, world);
const traffic = createTraffic(scene, city, vehicles);
const peds = createPeds(scene, city);
const police = createPolice(scene, city, vehicles, peds, player, world, hud);
const combat = createCombat(scene, city, vehicles, peds, player, world, police);
police.combat = combat;

const state = {
  mode: 'menu',
  cash: 1240,
  respect: 40,
  day: 1,
  time: 17 + 40 / 60,
  radioIndex: 0,
  settings: Save.loadSettings(),
  vehicle: null,
  policeLevel: 0,
  shotsFired: 0,
  frames: 0,
  deathTimer: 0,
  saveTimer: 0,
  lastCrash: 0,
  finished: false,
  creditsSeen: false,
  missionOverride: null,
  menuIndex: 0,
  pauseIndex: 0,
  settingsIndex: 0,
  returnTo: 'menu',
  mapFrom: 'playing',
};

const missions = createMissions({ city, player, vehicles, peds, police, combat, hud, world, state });
const audio = createAudio();
audio.setVolume(state.settings.volume);

const menu = { index: 0, pauseIndex: 0, settingsIndex: 0, returnTo: 'menu' };
let pointerLocked = false;
let lastFrame = performance.now();
let accumulator = 0;
let nextMissionCooldown = 0;
let errorCount = 0;

window.addEventListener('error', (e) => { errorCount += 1; window.__lastError = e.message || 'error'; });
window.addEventListener('unhandledrejection', (e) => { errorCount += 1; window.__lastError = String(e.reason || 'rejection'); });

// ---------------------------------------------------------------------------------------------
// input

const keys = new Set();
const input = {
  forward: false, back: false, left: false, right: false, sprint: false, jump: false,
  aim: false, fire: false, handbrake: false, interact: false,
};

const setMoveKeys = () => {
  input.forward = keys.has('KeyW') || keys.has('ArrowUp');
  input.back = keys.has('KeyS') || keys.has('ArrowDown');
  input.left = keys.has('KeyA') || keys.has('ArrowLeft');
  input.right = keys.has('KeyD') || keys.has('ArrowRight');
  input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  input.handbrake = input.sprint;
  input.jump = keys.has('Space');
};

const beginGameAudio = () => {
  if (!audio.started) { audio.start(); audio.setVolume(state.settings.volume); }
};

const toast = (m, k) => hud.toast(m, k);

const nextRadio = (dir) => {
  state.radioIndex = (state.radioIndex + dir + RADIO.length) % RADIO.length;
  audio.radio(state.radioIndex);
  toast(`${RADIO[state.radioIndex].freq} · ${RADIO[state.radioIndex].track}`, 'info');
};

const interact = () => {
  if (state.mode !== 'playing') return;
  if (state.vehicle) { vehicles.exit(); state.vehicle = null; audio.ui(); return; }
  if (missions.canInteract(player.pos)) { missions.interact(); audio.ui(); return; }
  const v = vehicles.nearest(player.pos, 4.7, (x) => !x.dead);
  if (v) {
    if (v.police) { police.commit(1, 'carjacking a cruiser'); }
    peds.fleeFrom(v.pos, 26);
    vehicles.enter(v);
    state.vehicle = v;
    audio.ui();
  }
};

const selectMenu = () => {
  if (menu.index === 0) startNewGame();
  else if (menu.index === 1) { if (Save.hasSave()) continueGame(); else toast('NO SAVE YET', 'info'); }
  else if (menu.index === 2) { state.returnTo = 'menu'; menu.settingsIndex = 0; state.mode = 'settings'; }
  else if (menu.index === 3) { state.returnTo = 'menu'; state.mode = 'controls'; }
};

const pauseAction = () => {
  const idx = menu.pauseIndex;
  if (idx === 0) state.mode = 'playing';
  else if (idx === 1) { state.mapFrom = 'paused'; state.mode = 'map'; }
  else if (idx === 2) { state.returnTo = 'paused'; menu.settingsIndex = 0; state.mode = 'settings'; }
  else if (idx === 3) { state.returnTo = 'paused'; state.mode = 'controls'; }
  else if (idx === 4) {
    if (Save.writeSave(state)) { toast('GAME SAVED', 'info'); state.mode = 'playing'; }
  } else if (idx === 5) { state.mode = 'menu'; menu.index = 0; Save.writeSave(state); }
};

const adjustSetting = (dir) => {
  const s = state.settings;
  if (menu.settingsIndex === 0) s.volume = Math.max(0, Math.min(1, s.volume + dir * 0.1));
  if (menu.settingsIndex === 1) s.sensitivity = Math.max(0.3, Math.min(2.2, s.sensitivity + dir * 0.1));
  if (menu.settingsIndex === 2) s.invertY = !s.invertY;
  if (menu.settingsIndex === 3) s.hudScale = Math.max(0.8, Math.min(1.2, s.hudScale + dir * 0.05));
  audio.setVolume(s.volume);
  Save.saveSettings(s);
};

window.addEventListener('keydown', (e) => {
  const code = e.code;
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(code);
  setMoveKeys();

  if (state.mode === 'menu') {
    if (code === 'ArrowUp' || code === 'KeyW') { menu.index = (menu.index + 3) % 4; audio.ui(); }
    if (code === 'ArrowDown' || code === 'KeyS') { menu.index = (menu.index + 1) % 4; audio.ui(); }
    if (code === 'Enter') { beginGameAudio(); selectMenu(); }
    return;
  }
  if (state.mode === 'settings') {
    if (code === 'ArrowUp' || code === 'KeyW') { menu.settingsIndex = (menu.settingsIndex + 3) % 4; audio.ui(); }
    if (code === 'ArrowDown' || code === 'KeyS') { menu.settingsIndex = (menu.settingsIndex + 1) % 4; audio.ui(); }
    if (code === 'ArrowLeft' || code === 'KeyA') adjustSetting(-1);
    if (code === 'ArrowRight' || code === 'KeyD') adjustSetting(1);
    if (code === 'Escape' || code === 'Enter') { state.mode = state.returnTo; audio.ui(); }
    return;
  }
  if (state.mode === 'controls') {
    if (code === 'Escape' || code === 'Enter') state.mode = state.returnTo;
    return;
  }
  if (state.mode === 'paused') {
    if (code === 'Escape') state.mode = 'playing';
    if (code === 'ArrowUp' || code === 'KeyW') menu.pauseIndex = (menu.pauseIndex + 5) % 6;
    if (code === 'ArrowDown' || code === 'KeyS') menu.pauseIndex = (menu.pauseIndex + 1) % 6;
    if (code === 'Enter') pauseAction();
    return;
  }
  if (state.mode === 'map') {
    if (code === 'Escape' || code === 'Tab') state.mode = state.mapFrom === 'paused' ? 'paused' : 'playing';
    return;
  }
  if (state.mode === 'dead') {
    if (code === 'Enter') respawn();
    return;
  }
  if (state.mode === 'ending') {
  if (code === 'Enter') {
    state.mode = 'playing';
    state.finished = true;
    state.creditsSeen = true;
    missions.state.finished = true;
  }
  return;
  }
  if (state.mode !== 'playing') return;

  if (code === 'KeyE') input.interact = true;
  if (code === 'KeyR') { combat.reload(); audio.reload(); }
  if (code === 'Digit1') { combat.switchWeapon(0); audio.ui(); }
  if (code === 'Digit2') { combat.switchWeapon(1); audio.ui(); }
  if (code === 'Digit3') { combat.switchWeapon(2); audio.ui(); }
  if (code === 'Digit4') { combat.switchWeapon(3); audio.ui(); }
  if (code === 'KeyQ') {
    let n = player.weapon;
    for (let i = 0; i < 4; i += 1) { n = (n + 1) % 4; if (player.unlocked[n]) break; }
    combat.switchWeapon(n); audio.ui();
  }
  if (code === 'KeyH') { audio.horn(); peds.fleeFrom(player.pos, 18); }
  if (code === 'Tab') { state.mapFrom = 'playing'; state.mode = 'map'; }
  if (code === 'Escape') { menu.pauseIndex = 0; state.mode = 'paused'; }
  if (code === 'BracketLeft') nextRadio(-1);
  if (code === 'BracketRight') nextRadio(1);
  if (code === 'F5') { if (Save.writeSave(state)) toast('GAME SAVED', 'info'); }
  if (code === 'F9') { continueGame(); }
});

window.addEventListener('keyup', (e) => { keys.delete(e.code); setMoveKeys(); });
window.addEventListener('blur', () => { keys.clear(); setMoveKeys(); input.fire = false; input.aim = false; });

canvas.addEventListener('mousedown', (e) => {
  if (state.mode !== 'playing') return;
  beginGameAudio();
  if (e.button === 0) input.fire = true;
  if (e.button === 2) input.aim = true;
  if (!pointerLocked) canvas.requestPointerLock?.();
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.fire = false;
  if (e.button === 2) input.aim = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; });
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked || state.mode !== 'playing') return;
  const s = state.settings.sensitivity;
  player.camYaw -= e.movementX * 0.0023 * s;
  player.camPitch -= e.movementY * 0.0019 * s * (state.settings.invertY ? -1 : 1);
  player.camPitch = Math.max(-0.85, Math.min(0.65, player.camPitch));
});
canvas.addEventListener('wheel', (e) => {
  if (state.mode !== 'playing') return;
  e.preventDefault();
  player.camDist = Math.max(3.4, Math.min(10.5, player.camDist + Math.sign(e.deltaY) * 0.6));
}, { passive: false });

// ---------------------------------------------------------------------------------------------
// world lifecycle

const menuFocus = { x: -100, z: 480 };

function clearPeds() {
  for (const p of peds.peds) scene.remove(p.group);
  peds.peds.length = 0;
}

function clearEverything() {
  if (vehicles.playerVehicle) vehicles.exit();
  state.vehicle = null;
  traffic.setTarget(0);
  traffic.removeAll();
  for (const v of [...vehicles.list]) vehicles.remove(v);
  clearPeds();
  police.clear();
  world.mastDown = false;
  city.mast.health = 100;
  world.mastGroup.visible = true;
  world.mastLight.visible = true;
  missions.reset();
  state.missionOverride = null;
  state.creditsSeen = false;
}

function resetWeapons() {
  player.weapon = 1;
  player.unlocked = [true, true, false, false];
  player.mag = [0, 12, 0, 0];
  player.ammo = [0, 12, 0, 0];
  player.reserve = [0, 96, 0, 0];
  player.reloading = 0;
}

function startNewGame() {
  clearEverything();
  state.cash = 1240;
  state.respect = 40;
  state.time = 17 + 40 / 60;
  state.day = 1;
  state.finished = false;
  state.creditsSeen = false;
  state.radioIndex = 0;
  state.mode = 'playing';
  player.spawnAt(PLAYER_START.x, PLAYER_START.z, PLAYER_START.heading);
  player.camYaw = PLAYER_START.heading - Math.PI;
  player.camPitch = -0.12;
  player.camDist = 5.2;
  player.visible = true;
  resetWeapons();
  player.health = 100;
  player.armour = 50;
  player.dead = false;
  traffic.setTarget(46);
  peds.setTarget(68);
  traffic.fill(player.pos, 36);
  // a little life right at the bus stop: drivers on the coast road and a few walkers
  traffic.stage('marea', -128, 600, Math.PI / 2, { speed: 7 });
  traffic.stage('cangrejo', -64, 597, -Math.PI / 2, { speed: 8 });
  traffic.stage('viento', 4, 603, Math.PI / 2, { speed: 10 });
  traffic.stage('mula', -210, 600, -Math.PI / 2, { speed: 6 });
  traffic.stage('cangrejo', -158, 603, Math.PI / 2, { speed: 5 });
  for (let i = 0; i < 8; i += 1) peds.spawnAround(player.pos);
  for (let i = 0; i < 6; i += 1) {
    peds.stage(-168 + i * 7, 614 + (i % 2) * 3, {
      state: i % 2 === 0 ? 'walk' : 'stand', heading: Math.PI / 2,
      pathAxis: 'z', pathFixed: -168 + i * 7, pathFrom: 500, pathTo: 630, pathDir: 1,
    });
  }
  police.clear();
  missions.state.index = -1;
  missions.state.nextReady = 0;
  missions.state.completed = [];
  missions.state.finished = false;
  missions.start(0);
  bootEl.classList.add('done');
  beginGameAudio();
  camera.position.set(player.pos.x - 6, 4.5, player.pos.z + 6);
  toast('BAHÍA COBALTO', 'info');
}

function continueGame() {
  const save = Save.readSave();
  if (!save) { toast('NO SAVE YET', 'info'); return; }
  clearEverything();
  state.mode = 'playing';
  state.cash = save.cash ?? 1240;
  state.respect = save.respect ?? 40;
  state.time = save.time ?? 17 + 40 / 60;
  state.day = save.day ?? 1;
  state.radioIndex = save.radioIndex ?? 0;
  state.finished = false;
  player.spawnAt(save.pos?.x ?? PLAYER_START.x, save.pos?.z ?? PLAYER_START.z, save.heading ?? PLAYER_START.heading);
  player.camYaw = player.heading - Math.PI;
  player.health = save.health ?? 100;
  player.armour = save.armour ?? 50;
  player.weapon = save.weapon ?? 1;
  player.unlocked = save.unlocked ?? [true, true, false, false];
  player.mag = save.mag ?? [0, 12, 0, 0];
  player.ammo = player.mag.slice();
  player.reserve = save.reserve ?? [0, 96, 0, 0];
  player.dead = false;
  player.visible = true;
  traffic.setTarget(46);
  peds.setTarget(68);
  traffic.fill(player.pos, 36);
  for (let i = 0; i < 8; i += 1) peds.spawnAround(player.pos);
  police.clear();
  missions.state.completed = save.completed ?? [];
  missions.state.finished = false;
  missions.state.index = (save.missionIndex ?? 0) - 1;
  missions.state.nextReady = save.missionIndex ?? 0;
  if (save.missionIndex >= 0 && save.missionIndex < 8) missions.start(save.missionIndex);
  else missions.state.marker = { x: 520, z: 566 };
  bootEl.classList.add('done');
  beginGameAudio();
  toast('WELCOME BACK, RAFA', 'info');
}

function respawn() {
  player.dead = false;
  player.health = 100;
  player.armour = 40;
  player.spawnAt(60, 480, Math.PI);
  player.camYaw = 0;
  state.mode = 'playing';
  police.clear();
  missions.reset();
  state.cash = Math.max(0, state.cash - 250);
  state.vehicle = null;
  toast('HOSPITAL · $250', 'wanted');
}

function saveNow() { return Save.writeSave(state); }

// ---------------------------------------------------------------------------------------------
// per-frame view for the HUD

function rankInfo() {
  let index = 0;
  for (let i = 0; i < RANKS.length; i += 1) if (state.respect >= RANKS[i].at) index = i;
  const next = RANKS[index + 1]?.at ?? RANKS[index].at + 400;
  const progress = Math.max(0, Math.min(1, (state.respect - RANKS[index].at) / Math.max(1, next - RANKS[index].at)));
  return { index, name: RANKS[index].name, next, progress };
}

function clockText() {
  const h = Math.floor(state.time) % 24;
  const m = Math.floor((state.time % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function buildView() {
  const r = rankInfo();
  const missionInfo = state.missionOverride || missions.info();
  const loc = state.missionOverride?.location || locationAt(player.pos.x, player.pos.z);
  const blips = police.state.units.map((u) => ({ x: u.v.pos.x, z: u.v.pos.z, heli: false }));
  if (police.state.heli) blips.push({ x: police.state.heli.group.position.x, z: police.state.heli.group.position.z, heli: true });
  return {
    pos: player.pos,
    heading: state.vehicle ? state.vehicle.heading : player.heading,
    health: player.health,
    armour: player.armour,
    cash: state.cash,
    respect: state.respect,
    rank: r,
    weapon: player.weapon,
    unlocked: player.unlocked,
    ammo: player.mag,
    reserve: player.reserve,
    vehicle: state.vehicle,
    radio: RADIO[state.radioIndex],
    police: {
      level: police.state.level,
      status: police.state.status,
      searchX: player.pos.x,
      searchZ: player.pos.z,
    },
    dispatch: police.getDispatch(),
    blips,
    mission: missionInfo,
    missionOverride: state.missionOverride,
    marker: state.missionOverride?.marker || missions.marker(),
    clock: clockText(),
    aiming: player.aiming,
    location: loc,
    roadblock: police.state.roadblocks.length > 0,
  };
}

// ---------------------------------------------------------------------------------------------
// cameras

function updateVehicleCamera(dt) {
  const v = state.vehicle;
  if (!v) return;
  const fwd = new THREE.Vector3(Math.sin(v.heading), 0, Math.cos(v.heading));
  const speed = Math.abs(v.speed);
  const back = 7.2 + Math.min(3.2, speed * 0.055);
  const height = 3.1 + Math.min(1.4, speed * 0.025);
  const desired = new THREE.Vector3(
    v.pos.x - fwd.x * back,
    height,
    v.pos.z - fwd.z * back,
  );
  let allowed = 1;
  for (let i = 1; i <= 10; i += 1) {
    const t = i / 10;
    if (city.blocked(v.pos.x + (desired.x - v.pos.x) * t, v.pos.z + (desired.z - v.pos.z) * t, 0.4)) { allowed = Math.max(0.28, t - 0.1); break; }
  }
  desired.x = v.pos.x + (desired.x - v.pos.x) * allowed;
  desired.z = v.pos.z + (desired.z - v.pos.z) * allowed;
  camera.position.lerp(desired, 1 - Math.exp(-7 * dt));
  const look = new THREE.Vector3(v.pos.x + fwd.x * 9, 1.5, v.pos.z + fwd.z * 9);
  camera.lookAt(look);
  camera.fov = 58 + Math.min(12, speed * 0.2);
  if (v.damageTimer > 0) {
    camera.position.x += (Math.random() - 0.5) * v.damageTimer * 0.35;
    camera.position.y += (Math.random() - 0.5) * v.damageTimer * 0.3;
    v.damageTimer -= dt;
  }
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------------------------
// playing update

function updatePlaying(dt) {
  state.time += dt * 0.004;
  if (state.time >= 24) { state.time -= 24; state.day += 1; }

  if (state.vehicle && state.vehicle.dead) { state.vehicle = null; }
  state.vehicle = vehicles.playerVehicle;
  if (state.vehicle) {
    player.pos.set(state.vehicle.pos.x, 0, state.vehicle.pos.z);
    player.heading = state.vehicle.heading;
  }

  if (state.vehicle) {
    state.vehicle.throttle = input.forward ? 1 : input.back ? -1 : 0;
    state.vehicle.steerIn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    if (Math.abs(state.vehicle.speed) > 5) peds.fleeFrom(state.vehicle.pos, 20);
  }
  vehicles.update(dt, { ...input, handbrake: input.handbrake });
  if (state.vehicle) {
    updateVehicleCamera(dt);
    player.aiming = false;
  } else {
    player.update(dt, input, city, vehicles);
    player.updateCamera(camera, dt, input.aim);
  }

  traffic.update(dt, state.vehicle ? state.vehicle.pos : player.pos);
  peds.update(dt, state.vehicle ? state.vehicle.pos : player.pos, player, police.state);
  police.update(dt, camera);
  combat.update(dt);

  if (input.fire) {
    const fired = combat.fire(camera);
    if (fired) {
      const w = WEAPONS[player.weapon];
      audio.shot(w?.sound || 'pistol');
      peds.fleeFrom(player.pos, 34);
    }
  }
  if (input.interact) {
    input.interact = false;
    interact();
  }

  missions.update(dt);
  world.update(dt, state.vehicle ? state.vehicle.pos : player.pos);

  // mission markers and dialogue fade
  hud.update(dt);

  if (player.cashPickup) {
    state.cash += player.cashPickup;
    toast(`+$${player.cashPickup}`, 'money');
    player.cashPickup = 0;
  }

  state.policeLevel = police.state.level;
  state.shotsFired = combat.shotsFired;
  if (state.respect >= 120 && !player.unlocked[2]) {
    player.unlocked[2] = true;
    hud.toast('MAKO UNLOCKED', 'money');
  }
  if (state.respect >= 260 && !player.unlocked[3]) {
    player.unlocked[3] = true;
    hud.toast('BREAKER UNLOCKED', 'money');
  }
  state.missionIndex = missions.state.active ? missions.state.index
    : (missions.state.nextReady ?? Math.max(0, missions.state.index + 1));
  state.missionStage = missions.state.stageIndex;
  state.completed = missions.state.completed.slice();

  if (player.dead) {
    if (vehicles.playerVehicle) {
      vehicles.exit();
      state.vehicle = null;
    }
    state.mode = 'dead';
    state.deathTimer = 0;
    state.vehicle = null;
    audio.shot('punch');
  }

  if (missions.state.finished && state.mode === 'playing' && !state.creditsSeen) {
    state.mode = 'ending';
    state.finished = true;
  }

  state.saveTimer += dt;
  if (state.saveTimer > 60) { state.saveTimer = 0; Save.writeSave(state); }

  audio.update(dt, {
    playing: true,
    vehicle: state.vehicle,
    playerMoving: !state.vehicle && player.speed > 0.6,
    skidding: Boolean(state.vehicle && state.vehicle.brake && Math.abs(state.vehicle.speed) > 8),
    police: {
      level: police.state.level,
      near: police.countNear(player.pos, 120) > 0,
      heli: Boolean(police.state.heli),
    },
  });
}

// ---------------------------------------------------------------------------------------------
// shot staging

function clearForShot() {
  if (vehicles.playerVehicle) vehicles.exit();
  state.vehicle = null;
  traffic.setTarget(0);
  traffic.removeAll();
  for (const v of [...vehicles.list]) vehicles.remove(v);
  clearPeds();
  peds.setTarget(0);
  police.clear();
  police.state.staged = false;
  state.missionOverride = null;
  state.mode = 'shot';
  player.dead = false;
  player.health = 100;
  player.armour = 50;
  player.visible = true;
  player.aiming = false;
  player.reloading = 0;
  bootEl.classList.add('done');
}

function stageTraffic(specs) {
  for (const s of specs) traffic.stage(s.type, s.x, s.z, s.heading, { speed: s.speed || 0, color: s.color });
}

function stagePeds(specs) {
  for (const s of specs) {
    const p = peds.stage(s.x, s.z, {
      state: s.state || 'walk', heading: s.heading ?? 0,
      pathAxis: s.axis || 'z', pathFixed: (s.axis || 'z') === 'x' ? s.z : s.x,
      pathFrom: s.from ?? 0, pathTo: s.to ?? 300,
      pathDir: s.dir ?? 1, outfit: s.outfit, skin: s.skin, scale: s.scale,
    });
    p.staged = true;
    if (p.state === 'flee') p.fleeTimer = 40;
  }
}

function simulate(steps = 120, focus) {
  for (let i = 0; i < steps; i += 1) {
    const f = focus || (state.vehicle ? state.vehicle.pos : player.pos);
    traffic.update(1 / 60, f);
    peds.update(1 / 60, f, player, police.state);
    police.update(1 / 60, camera);
    combat.update(1 / 60);
    world.update(1 / 60, f);
    hud.update(1 / 60);
  }
}

function frameShotCamera(pos, look, fov) {
  camera.position.set(pos.x, pos.y, pos.z);
  camera.lookAt(look.x, look.y, look.z);
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

function shot1() {
  clearForShot();
  player.pos.set(0, 0, 100);
  player.heading = Math.PI;
  player.visible = false;
  const v = vehicles.spawn('viento', 0, 100, Math.PI, { color: 0xd8463f, driver: 'player' });
  vehicles.enter(v);
  v.kinematic = true;
  v.speed = 24;
  v.health = 62;
  v.driver = 'player';
  state.vehicle = v;
  player.visible = false;
  frameShotCamera({ x: 0, y: 5.2, z: 109.5 }, { x: 0, y: 1.2, z: 70 }, 60);
  police.stageShot1(0, 100, Math.PI);
  stageTraffic([
    { type: 'cangrejo', x: -1.9, z: 62, heading: 0, speed: 6 },
    { type: 'marea', x: -5.4, z: 32, heading: 0, speed: 8 },
    { type: 'viento', x: -1.9, z: -8, heading: 0, speed: 9 },
    { type: 'cangrejo', x: -5.4, z: -38, heading: 0, speed: 7 },
    { type: 'mula', x: 1.9, z: 48, heading: Math.PI, speed: 7 },
    { type: 'marea', x: 5.4, z: 18, heading: Math.PI, speed: 9 },
    { type: 'tiburon', x: 1.9, z: -22, heading: Math.PI, speed: 11 },
    { type: 'cangrejo', x: 5.4, z: -52, heading: Math.PI, speed: 8 },
    { type: 'cangrejo', x: 5.4, z: 138, heading: Math.PI, speed: 9 },
    { type: 'marea', x: -5.4, z: 126, heading: 0, speed: 8 },
  ]);
  stagePeds([
    { x: -12.6, z: 58, axis: 'z', from: 10, to: 180, dir: 1, outfit: 0 },
    { x: -13.4, z: 74, axis: 'z', from: 10, to: 180, dir: -1, outfit: 3, state: 'walk' },
    { x: -12.2, z: 92, state: 'flee', heading: 0.4, outfit: 5 },
    { x: -13.8, z: 120, axis: 'z', from: 10, to: 190, dir: 1, outfit: 1 },
    { x: -12.5, z: 145, state: 'flee', heading: -0.5, outfit: 4 },
    { x: 12.6, z: 48, axis: 'z', from: 10, to: 180, dir: -1, outfit: 2 },
    { x: 13.5, z: 66, axis: 'z', from: 10, to: 180, dir: 1, outfit: 6 },
    { x: 12.3, z: 86, state: 'flee', heading: 0.2, outfit: 7 },
    { x: 13.2, z: 104, axis: 'z', from: 10, to: 180, dir: -1, outfit: 0 },
    { x: 12.8, z: 126, state: 'flee', heading: 0.8, outfit: 3 },
    { x: 13.8, z: 142, axis: 'z', from: 10, to: 190, dir: 1, outfit: 5 },
    { x: -12.9, z: 172, state: 'stand', heading: 0.1, outfit: 2 },
    { x: 12.4, z: 166, axis: 'z', from: 10, to: 190, dir: -1, outfit: 1 },
    { x: -13.1, z: 34, state: 'stand', heading: 1.1, outfit: 7 },
  ]);
  vehicles.addSkid(-3.3, 103, Math.PI);
  vehicles.addSkid(-3.3, 106, Math.PI + 0.03);
  vehicles.addSkid(3.3, 104, Math.PI - 0.02);
  vehicles.addSkid(3.3, 107, Math.PI);
  world.fx.smoke(new THREE.Vector3(-1.2, 0.8, 101), 0x4b4944, 4);
  state.missionOverride = {
    index: 5, total: 8, title: 'RADIO SILENCE', objective: 'DESTROY THE RADIO MAST',
    next: 'SURVIVE THE AMBUSH', stage: 2, stages: 4,
    location: 'AVENIDA COBALTO · the boulevard', marker: { x: 760, z: -460 },
  };
  hud.dialog('Lucía', 'La Marea · your sister', 'Kite-1 has the boulevard. Cut the mast and we still have a way out.');
  simulate(120, { x: 0, z: 100 });
  frameShotCamera({ x: 0, y: 5.2, z: 109.5 }, { x: 0, y: 1.2, z: 70 }, 60);
  v.group.position.set(0, 0.02, 100);
  v.group.rotation.y = Math.PI;
  return 1;
}

function shot2() {
  clearForShot();
  player.pos.set(470, 0, 618);
  player.heading = Math.PI / 2;
  player.visible = true;
  player.aiming = true;
  player.weapon = 1;
  player.group.position.copy(player.pos);
  player.group.rotation.y = player.heading;
  player.group.visible = true;
  player.gun.visible = true;
  player.update(1 / 60, { aim: true }, city, vehicles);
  frameShotCamera({ x: 464, y: 2.7, z: 617.5 }, { x: 500, y: 1.3, z: 650 }, 62);
  police.stageShot2(470, 625, Math.PI / 2);
  const pdc = police.state.units[0];
  if (pdc) {
    pdc.v.pos.set(498, 0.02, 641);
    pdc.v.heading = -Math.PI / 2;
    pdc.v.group.position.copy(pdc.v.pos);
    pdc.v.group.rotation.y = pdc.v.heading;
  }
  stageTraffic([
    { type: 'marea', x: 520, z: 596, heading: -Math.PI / 2, speed: 7 },
    { type: 'cangrejo', x: 560, z: 599, heading: Math.PI / 2, speed: 8 },
    { type: 'mula', x: 620, z: 596, heading: -Math.PI / 2, speed: 6 },
    { type: 'viento', x: 660, z: 602, heading: Math.PI / 2, speed: 11 },
    { type: 'cangrejo', x: 430, z: 600, heading: Math.PI / 2, speed: 8 },
    { type: 'marea', x: 390, z: 597, heading: -Math.PI / 2, speed: 7 },
  ]);
  stagePeds([
    { x: 478, z: 630, state: 'stand', heading: -1.2, outfit: 0 },
    { x: 486, z: 620, axis: 'x', from: 300, to: 900, dir: 1, outfit: 4 },
    { x: 492, z: 636, state: 'stand', heading: 2.1, outfit: 2 },
    { x: 500, z: 616, axis: 'x', from: 300, to: 900, dir: -1, outfit: 5 },
    { x: 506, z: 632, axis: 'x', from: 300, to: 900, dir: 1, outfit: 1 },
    { x: 514, z: 622, state: 'stand', heading: -0.4, outfit: 3 },
    { x: 520, z: 638, axis: 'x', from: 300, to: 900, dir: -1, outfit: 7 },
    { x: 528, z: 614, axis: 'x', from: 300, to: 900, dir: 1, outfit: 6 },
    { x: 534, z: 630, state: 'stand', heading: 0.7, outfit: 0 },
    { x: 540, z: 620, axis: 'x', from: 300, to: 900, dir: -1, outfit: 2 },
    { x: 452, z: 636, axis: 'x', from: 300, to: 900, dir: 1, outfit: 4 },
    { x: 444, z: 620, state: 'stand', heading: 1.4, outfit: 5 },
    { x: 436, z: 630, state: 'stand', heading: 0.2, outfit: 1 },
    { x: 470, z: 640, axis: 'x', from: 300, to: 900, dir: -1, outfit: 3 },
    { x: 460, z: 612, axis: 'x', from: 300, to: 900, dir: 1, outfit: 6 },
    { x: 486, z: 628, state: 'stand', heading: 1.1, outfit: 1 },
    { x: 496, z: 634, state: 'stand', heading: -0.6, outfit: 4 },
    { x: 508, z: 626, state: 'stand', heading: 0.9, outfit: 0 },
    { x: 516, z: 636, state: 'stand', heading: 2.4, outfit: 6 },
    { x: 524, z: 624, state: 'stand', heading: -1.4, outfit: 2 },
  ]);
  state.missionOverride = {
    index: 0, total: 8, title: 'WELCOME HOME', objective: 'TALK TO LUCÍA',
    next: 'THE DEBT BEGINS', stage: 1, stages: 2,
    location: 'LA MARINA · Malecón Cobalto', marker: { x: 520, z: 566 },
  };
  hud.dialog('Lucía', 'La Marea · your sister', 'The whole bay is out on the promenade tonight. Keep the gun low, Rafa. I mean it.');
  simulate(120, { x: 470, z: 618 });
  frameShotCamera({ x: 464, y: 2.7, z: 617.5 }, { x: 500, y: 1.3, z: 650 }, 62);
  player.group.position.copy(player.pos);
  player.group.rotation.y = player.heading;
  player.group.visible = true;
  player.aiming = true;
  player.gun.visible = true;
  return 2;
}

function shot3() {
  clearForShot();
  player.pos.set(-400, 0, 0);
  player.heading = -Math.PI / 2;
  player.visible = true;
  player.aiming = true;
  player.health = 62;
  player.armour = 18;
  player.weapon = 1;
  player.group.position.copy(player.pos);
  player.group.rotation.y = player.heading;
  player.group.visible = true;
  player.gun.visible = true;
  player.update(1 / 60, { aim: true }, city, vehicles);
  frameShotCamera({ x: -395, y: 2.45, z: 2.8 }, { x: -414, y: 1.25, z: -1.5 }, 52);
  const keyLight = new THREE.PointLight(0xffd6a0, 4.2, 46, 2);
  keyLight.position.set(-407, 5.5, 1.5);
  scene.add(keyLight);
  const staged = police.stageShot3(-400, 0, -Math.PI / 2);
  staged.o1.health = 400; staged.o2.health = 400;
  staged.o1.staged = true; staged.o2.staged = true;
  stagePeds([
    { x: -432, z: -10, state: 'stand', heading: 0.4, outfit: 6 },
    { x: -438, z: 8, state: 'stand', heading: 2.2, outfit: 1 },
    { x: -424, z: 12, axis: 'z', from: -40, to: 40, dir: -1, outfit: 4 },
    { x: -430, z: 14, state: 'stand', heading: 2.8, outfit: 2 },
    { x: -370, z: -10, axis: 'z', from: -40, to: 40, dir: 1, outfit: 5 },
    { x: -366, z: 8, state: 'stand', heading: -2.4, outfit: 0 },
    { x: -442, z: -12, axis: 'z', from: -40, to: 40, dir: 1, outfit: 7 },
  ]);
  stageTraffic([
    { type: 'cangrejo', x: -430, z: 0, heading: Math.PI / 2, speed: 0 },
    { type: 'marea', x: -450, z: -6, heading: 0, speed: 0 },
  ]);
  state.missionOverride = {
    index: 5, total: 8, title: 'RADIO SILENCE', objective: 'CLEAR THE AMBUSH',
    next: 'GET TO THE MAST', stage: 2, stages: 4,
    location: 'MERCADO VIEJO · Calle Mercado', marker: { x: 760, z: -460 },
  };
  hud.dialog('Capitán Salas', 'PDC · radio', 'Drop it, Cordero. The market is closed and you are the only thing still moving.');
  simulate(120, { x: -400, z: 0 });
  frameShotCamera({ x: -395, y: 2.45, z: 2.8 }, { x: -414, y: 1.25, z: -1.5 }, 52);
  player.health = 62;
  player.armour = 18;
  player.dead = false;
  player.group.position.copy(player.pos);
  player.group.rotation.y = player.heading;
  player.group.visible = true;
  player.aiming = true;
  player.gun.visible = true;
  player.update(1 / 60, { aim: true }, city, vehicles);
  staged.o1.staged = true; staged.o2.staged = true;
  staged.o1.health = 400; staged.o2.health = 400;
  police.officerShoot(staged.o1, player);
  police.officerShoot(staged.o2, player);
  combat.state.fireTimer = 0;
  combat.fire(camera);
  combat.state.fireTimer = 0;
  combat.fire(camera);
  return 3;
}

function shot4() {
  clearForShot();
  state.vehicle = null;
  player.pos.set(200, 0, 610);
  player.heading = Math.PI;
  player.visible = false;
  scene.fog.near = 1600;
  scene.fog.far = 4600;
  frameShotCamera({ x: 650, y: 60, z: 720 }, { x: 250, y: 0, z: 320 }, 70);
  police.clear();
  stageTraffic([
    { type: 'marea', x: 520, z: 600, heading: Math.PI / 2, speed: 0 },
    { type: 'cangrejo', x: 535, z: 597, heading: -Math.PI / 2, speed: 0 },
    { type: 'viento', x: 550, z: 603, heading: Math.PI / 2, speed: 0 },
    { type: 'mula', x: 565, z: 600, heading: -Math.PI / 2, speed: 0 },
    { type: 'cangrejo', x: 580, z: 597, heading: Math.PI / 2, speed: 0 },
    { type: 'marea', x: 595, z: 603, heading: -Math.PI / 2, speed: 0 },
    { type: 'tiburon', x: 610, z: 600, heading: Math.PI / 2, speed: 0 },
    { type: 'cangrejo', x: 625, z: 597, heading: -Math.PI / 2, speed: 0 },
    { type: 'viento', x: 640, z: 603, heading: Math.PI / 2, speed: 0 },
    { type: 'marea', x: 655, z: 600, heading: -Math.PI / 2, speed: 0 },
    { type: 'cangrejo', x: 670, z: 597, heading: Math.PI / 2, speed: 0 },
    { type: 'mula', x: 685, z: 603, heading: -Math.PI / 2, speed: 0 },
    { type: 'cangrejo', x: 700, z: 600, heading: Math.PI / 2, speed: 0 },
    { type: 'marea', x: 715, z: 597, heading: -Math.PI / 2, speed: 0 },
  ]);
  for (let i = 0; i < 18; i += 1) {
    peds.stage(300 + i * 30, 654 + (i % 3) * 12, { state: i % 4 === 0 ? 'stand' : 'walk', heading: i * 0.4, scale: 1 });
  }
  state.missionOverride = {
    index: 7, total: 8, title: 'HIGH TIDE', objective: 'ASSAULT THE MARINA WAREHOUSE',
    next: 'CLEAR THE CREW', stage: 2, stages: 3,
    location: 'BAHÍA COBALTO · the whole bay', marker: { x: 760, z: 470 },
  };
  hud.dialog('Lucía', 'La Marea · your sister', 'From up here the whole bay looks like it belongs to someone else. Take it back.');
  simulate(90, { x: 200, z: 610 });
  frameShotCamera({ x: 650, y: 60, z: 720 }, { x: 250, y: 0, z: 320 }, 70);
  return 4;
}

function shotDebug(n) {
  const heli = police.state.heli;
  const rb = police.state.roadblocks[0];
  const view = buildView();
  const officers = peds.peds.filter((p) => p.police && p.alive)
    .map((p) => Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z));
  return {
    shot: n,
    fps: 60,
    trafficNear: traffic.countNear(camera.position, 160),
    pedsNear: peds.countNear(camera.position, 80),
    policeClose: police.countNear(player.pos, 12),
    policeDistances: police.distances().map((d) => Math.round(d * 10) / 10),
    roadblockUnits: police.state.roadblockUnits.length,
    roadblockDist: rb ? Math.round(Math.hypot(rb.x - player.pos.x, rb.z - player.pos.z)) : 0,
    heli: heli ? {
      dist: Math.round(camera.position.distanceTo(heli.group.position) * 10) / 10,
      up: Math.round((heli.group.position.y - camera.position.y) * 10) / 10,
      onScreen: heli.onScreen,
      spotlightOnPlayer: heli.spotlightOnPlayer,
    } : null,
    minimapRoadSegments: hud.state.minimapRoadSegments,
    carsTotal: vehicles.list.length,
    pedsTotal: peds.peds.length,
    boats: city.boats.length,
    fogClear: true,
    wanted: police.state.level,
    officers: officers.map((d) => Math.round(d * 10) / 10),
    muzzlePlayer: (combat.state.time - combat.state.lastPlayerShot) < 1.1,
    muzzlePolice: (combat.state.time - combat.state.lastNpcShot) < 1.1,
    policeLights: police.state.units.some((u) => u.v.siren),
    errors: errorCount,
    location: view.location,
    boatNdc: city.boats.slice(0, 6).map((b) => {
      const p = new THREE.Vector3(b.x, 1.5, b.z).project(camera);
      return { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, z: Math.round(p.z * 100) / 100, len: b.len };
    }),
  };
}

function setupShot(n) {
  clearForShot();
  if (n === 1) shot1();
  else if (n === 2) shot2();
  else if (n === 3) shot3();
  else shot4();
  renderer.render(scene, camera);
  const view = buildView();
  hud.draw(view);
  renderer.render(scene, camera);
  const debug = shotDebug(n);
  window.__shotDebug = debug;
  window.__shotReady = true;
  window.__frames = 1;
  // one more clean overlay pass after the debug is known
  hud.draw(view);
}

// ---------------------------------------------------------------------------------------------
// render loop

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= 1 / 60 && steps < 5) {
    if (state.mode === 'playing') updatePlaying(1 / 60);
    else if (state.mode === 'menu') {
      traffic.update(1 / 60, menuFocus);
      peds.update(1 / 60, menuFocus, player, police.state);
      world.update(1 / 60, menuFocus);
      hud.update(1 / 60);
    } else if (state.mode === 'dead') state.deathTimer += 1 / 60;
    else if (state.mode === 'ending') state.deathTimer += 1 / 60;
    accumulator -= 1 / 60;
    steps += 1;
  }
  if (accumulator > 0.2) accumulator = 0;
  if (state.mode === 'menu') {
    const t = performance.now() / 1000;
    camera.position.set(Math.sin(t * 0.03) * 80 - 80, 105, 430 + Math.cos(t * 0.03) * 30);
    camera.lookAt(0, 0, 0);
    camera.fov = 58;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    Menus.drawTitle(hud.ctx, t, menu.index, [
      { label: 'NEW GAME' },
      { label: 'CONTINUE', note: Save.hasSave() ? 'SAVE FOUND' : 'NO SAVE' },
      { label: 'SETTINGS' },
      { label: 'CONTROLS' },
    ]);
  } else if (state.mode === 'playing' || state.mode === 'dead') {
    renderer.render(scene, camera);
    hud.draw(buildView());
    if (state.mode === 'dead') Menus.drawDead(hud.ctx, state.deathTimer);
  } else if (state.mode !== 'shot') {
    renderer.render(scene, camera);
    hud.draw(buildView());
    if (state.mode === 'paused') Menus.drawPause(hud.ctx, menu.pauseIndex);
    else if (state.mode === 'map') Menus.drawMap(hud.ctx, city, player, missions.marker(), missions.state.active?.title);
    else if (state.mode === 'settings') Menus.drawSettings(hud.ctx, state.settings, menu.settingsIndex);
    else if (state.mode === 'controls') Menus.drawControls(hud.ctx);
    else if (state.mode === 'ending') Menus.drawEnding(hud.ctx, performance.now() / 1000, state);
  }
  window.__frames = (window.__frames || 0) + 1;
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------------------------
// public hooks, menu boot and shot selection

window.__game = {
  state, player, vehicles, traffic, peds, police, combat, missions, hud, camera, scene, renderer, world, city,
  saveNow,
  testHooks: {
    advance(seconds = 1) {
      const steps = Math.max(1, Math.min(900, Math.round(seconds * 60)));
      for (let i = 0; i < steps; i += 1) {
        if (state.mode === 'playing') updatePlaying(1 / 60);
      }
      renderer.render(scene, camera);
      hud.draw(buildView());
      window.__frames = (window.__frames || 0) + 1;
      return steps;
    },
    setInput(key, value) { if (key in input) input[key] = Boolean(value); return input[key]; },
    render() { renderer.render(scene, camera); hud.draw(buildView()); },
    spawnPoliceNear(n = 2) {
      for (let i = 0; i < n; i += 1) police.spawnUnit();
    },
    shootAtNearestPolice() {
      police.commit(3, 'test');
      const u = police.state.units[0];
      if (!u) return false;
      const target = new THREE.Vector3(u.v.pos.x, 1.2, u.v.pos.z);
      const dir = target.clone().sub(new THREE.Vector3(player.pos.x, 1.3, player.pos.z)).normalize();
      camera.getWorldDirection(dir);
      return combat.fire(camera);
    },
  },
};

// fill the menu's living city once
traffic.setTarget(34);
peds.setTarget(46);
traffic.fill(menuFocus, 24);
for (let i = 0; i < 5; i += 1) peds.spawnAround(menuFocus);
bootEl.classList.add('done');

const params = new URLSearchParams(location.search);
const shot = Number(params.get('shot'));
if (shot >= 1 && shot <= 4) {
  setupShot(shot);
} else {
  requestAnimationFrame(frame);
}
