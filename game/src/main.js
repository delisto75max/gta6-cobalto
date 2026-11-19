// COBALTO: state machine, input, camera, fixed-step loop and the four staged screenshots.
import * as THREE from 'three';
import { CFG, RANKS, STORY } from './config.js';
import { clamp, damp, angleWrap } from './rng.js';
import { createWorld } from './scene.js';
import { HUD } from './hud.js';
import { Missions } from './missions.js';
import { createPlayer, resetPlayer, updatePlayer, damagePlayer } from './player.js';
import { createVehicle, updateVehicle, nearestVehicle, VehicleLights, VehicleShadows, addVehicleLights, forward } from './vehicles.js';
import { Police, makeOfficer, aimBeam } from './police.js';
import { Combat } from './combat.js';
import { FX } from './fx.js';
import { Traffic } from './traffic.js';
import { Peds } from './peds.js';
import { Menus } from './menus.js';
import { Audio } from './audio.js';
import * as Save from './save.js';

const view = document.getElementById('view');
const hudCanvas = document.getElementById('hud');
const world = createWorld(view);
const fx = new FX(world.scene, world.camera);
const player = createPlayer(world.scene);
const traffic = new Traffic(world.scene, world.city, 45);
const peds = new Peds(world.scene, world.city, 70);
const audio = new Audio();
const police = new Police(world.scene, world.city, fx, audio);
const combat = new Combat(world.scene, world.camera, fx, audio);
const missions = new Missions(world.city);
const hud = new HUD(hudCanvas, world.city);
const menus = new Menus(hudCanvas, world.city);
const lights = new VehicleLights(world.scene);
const shadows = new VehicleShadows(world.scene);
combat.ensure(player);

const shotParam = Number(new URLSearchParams(location.search).get('shot') || 0);
const state = {
  mode: shotParam ? 'shot' : 'title', shot: shotParam, menuIndex: 0,
  settings: Save.loadSettings(), hasSave: Save.hasSave(),
  player, vehicle: null, cash: 1240, respect: 40, minutes: 17 * 60 + 40,
  toasts: [], deadTimer: 0, time: 0, yaw: Math.PI * 1.5, pitch: 0.16, dist: 5.0, yawOff: 0,
  targets: [], specials: [], nextMission: 0, autosave: 0, stepT: 0, shake: 0, engineOn: false,
  radio: 0, started: false, spawnCar: null, endingT: 0,
};
const keys = {}, mouse = { down: false, right: false, fired: false, dx: 0, dy: 0 };
window.__world = world;
window.__state = state;
window.__police = police;
window.__combat = combat;
window.__missions = missions;
window.__peds = peds;
window.__traffic = traffic;
window.__tick = (n = 1) => { for (let i = 0; i < n; i++) step(1 / 60); world.render(); };

function rankOf(respect) {
  const th = [0, 100, 260, 520, 900, 1400];
  let i = 0; while (i < th.length - 1 && respect >= th[i + 1]) i++;
  return { rank: i, name: RANKS[i] };
}

function toast(text, color = '#ffc36a') {
  state.toasts.push({ text, color, t: 2.6 });
  if (state.toasts.length > 5) state.toasts.shift();
}

const ctx = {
  player, police, city: world.city, audio,
  onComplete(m) {
    state.cash += m.cash; state.respect += m.respect;
    toast(`MISSION PASSED  +$${m.cash}`, '#7de0a0');
    toast(`+${m.respect} RESPECT`, '#ffc36a');
    saveNow(true);
    if (missions.index >= 7) { state.mode = 'ending'; state.endingT = 0; }
    else state.nextMission = 5;
  },
  spawnTarget(type) {
    const p = player.inVehicle ? player.inVehicle.pos : player.pos;
    const h = player.inVehicle ? player.inVehicle.heading : player.heading;
    const v = createVehicle(world.scene, type, { x: p.x + Math.sin(h) * 26, z: p.z + Math.cos(h) * 26, heading: h, simple: false, color: type === 'police' ? undefined : 0x2b3b55 });
    v.target = true; v.patrol = { axis: 'z', at: v.pos.x, t: v.pos.z, dir: -1, speed: 13 };
    state.targets.push(v);
    return v;
  },
};

function startGame(cont) {
  audio.init();
  if (cont) {
    const d = Save.loadGame();
    if (d) {
      state.cash = d.cash ?? 1240; state.respect = d.respect ?? 40; state.minutes = d.minutes ?? 1060;
      resetPlayer(player, d.x ?? -486, d.z ?? 570, d.heading ?? Math.PI / 2);
      player.health = d.health ?? 100; player.armour = d.armour ?? 50;
      player.weapon = d.weapon || 'vesper'; player.unlocked = d.unlocked || { fists: true, vesper: true, mako: false, breaker: false };
      player.ammo = d.ammo || { vesper: 12, mako: 30, breaker: 8 }; player.reserve = d.reserve || { vesper: 96, mako: 180, breaker: 48 };
      missions.index = d.mission ?? 0; missions.stage = d.stage ?? 0; missions.active = !!d.active; missions.done = !!d.done;
      if (missions.active) missions.setStage(ctx);
      police.setWanted(d.wanted ?? 0);
    }
  } else {
    resetPlayer(player, -486, 570, Math.PI / 2);
    player.weapon = 'vesper'; player.ammo = { vesper: 12, mako: 30, breaker: 8 }; player.reserve = { vesper: 96, mako: 180, breaker: 48 };
    player.unlocked = { fists: true, vesper: true, mako: false, breaker: false };
    state.cash = 1240; state.respect = 40; state.minutes = 1060;
    missions.index = -1; missions.done = false; missions.active = false;
    const cang = traffic.add(-478, 548, Math.PI / 2, 'cangrejo', 0x93a06b);
    cang.parked = true;
    state.spawnCar = cang;
    missions.start(0, ctx);
  }
  combat.ensure(player);
  state.mode = 'playing'; state.started = true; state.yaw = player.heading + Math.PI; state.pitch = 0.16; state.dist = 5.0;
  hudCanvas.style.opacity = '1';
  toast('BAHÍA COBALTO · 17:40', '#ffe0a8');
  saveNow(true);
}

function saveNow(silent) {
  if (state.mode === 'title' || state.mode === 'shot') return;
  const d = {
    cash: state.cash, respect: state.respect, minutes: state.minutes,
    x: player.pos.x, z: player.pos.z, heading: player.heading,
    health: player.health, armour: player.armour, weapon: player.weapon,
    ammo: player.ammo, reserve: player.reserve, unlocked: player.unlocked,
    mission: missions.index, stage: missions.stage, active: missions.active, done: missions.done,
    wanted: police.wanted,
  };
  Save.saveGame(d); state.hasSave = true;
  if (!silent) toast('GAME SAVED', '#7de0a0');
}
function loadNow() {
  const d = Save.loadGame(); if (!d) { toast('NO SAVE FOUND', '#ff5c52'); return; }
  startGame(true); toast('GAME LOADED', '#7de0a0');
}

function enterVehicle(v) {
  if (!v || v.dead) return;
  v = upgradeVehicle(v);
  v.occupied = true; v.speed = 0; v.lane = null; v.ai = false; v.parked = true;
  player.inVehicle = v; player.root.visible = false; player.pos.copy(v.pos); player.heading = v.heading;
  state.vehicle = v; state.yawOff = 0;
  if (v.police) police.crime('car', v.pos.x, v.pos.z);
  audio.setEngine(0, 0, true);
  toast(v.spec.name.toUpperCase(), '#ffc36a');
}
function exitVehicle() {
  const v = player.inVehicle; if (!v) return;
  const hp = player.health, ap = player.armour;
  v.occupied = false; v.speed = 0; v.brakeT = 0;
  const side = { x: Math.cos(v.heading), z: -Math.sin(v.heading) };
  const x = v.pos.x + side.x * 2.2, z = v.pos.z + side.z * 2.2;
  const p = { x, z }; world.city.collide(p, 0.45);
  resetPlayer(player, p.x, p.z, v.heading);
  player.health = hp; player.armour = ap;
  v.occupied = false; player.inVehicle = null; state.vehicle = null;
  state.yaw = v.heading + Math.PI; audio.setEngine(0, 0, false);
}

function interact() {
  if (player.inVehicle) { exitVehicle(); return; }
  const list = [...traffic.cars, ...state.specials, ...police.units.map((u) => u.v)];
  const v = nearestVehicle(list, player.pos, 4.6);
  if (v) { enterVehicle(v); return; }
  const mp = missions.markerPos();
  if (mp && Math.hypot(mp.x - player.pos.x, mp.z - player.pos.z) < 9) {
    if (!missions.active) {
      const next = missions.done ? Math.min(7, missions.index + 1) : Math.max(0, missions.index);
      missions.start(next, ctx);
    } else if (missions.stageDef && missions.stageDef.type === 'goto') missions.advance(ctx);
  }
}

function setupInput() {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['tab', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    keys[k] = true;
    audio.init();
    if (state.mode === 'title') {
      if (k === 'arrowup' || k === 'w') { state.menuIndex = (state.menuIndex + 3) % 4; audio.ui(); }
      if (k === 'arrowdown' || k === 's') { state.menuIndex = (state.menuIndex + 1) % 4; audio.ui(); }
      if (k === 'enter' || k === ' ') {
        if (state.menuIndex === 0) startGame(false);
        else if (state.menuIndex === 1 && state.hasSave) startGame(true);
        else if (state.menuIndex === 2) { state.mode = 'settings'; state.menuIndex = 0; }
        else if (state.menuIndex === 3) state.mode = 'controls';
      }
      return;
    }
    if (state.mode === 'settings') {
      const s = state.settings;
      if (k === 'arrowup' || k === 'w') state.menuIndex = (state.menuIndex + 3) % 4;
      if (k === 'arrowdown' || k === 's') state.menuIndex = (state.menuIndex + 1) % 4;
      if (k === 'arrowleft' || k === 'a' || k === 'arrowright' || k === 'd') {
        const d = k === 'arrowleft' || k === 'a' ? -1 : 1;
        if (state.menuIndex === 0) s.volume = clamp(s.volume + d * 0.05, 0, 1);
        if (state.menuIndex === 1) s.sens = clamp(s.sens + d * 0.05, 0.3, 2.5);
        if (state.menuIndex === 2) s.invert = !s.invert;
        if (state.menuIndex === 3) s.hudScale = clamp(s.hudScale + d * 0.05, 0.8, 1.2);
        audio.setVolume(s.volume); Save.saveSettings(s);
      }
      if (k === 'escape' || k === 'enter') state.mode = state.started ? 'paused' : 'title';
      return;
    }
    if (state.mode === 'controls' || state.mode === 'map') {
      if (k === 'escape' || k === 'enter' || k === 'tab') state.mode = state.started ? 'paused' : 'title';
      return;
    }
    if (state.mode === 'ending') { if (k === 'enter') { state.mode = 'playing'; state.nextMission = 0; } return; }
    if (state.mode === 'dead') return;
    if (state.mode === 'paused') {
      const items = 6;
      if (k === 'arrowup' || k === 'w') state.menuIndex = (state.menuIndex + items - 1) % items;
      if (k === 'arrowdown' || k === 's') state.menuIndex = (state.menuIndex + 1) % items;
      if (k === 'escape') state.mode = 'playing';
      if (k === 'enter') {
        if (state.menuIndex === 0) state.mode = 'playing';
        else if (state.menuIndex === 1) state.mode = 'map';
        else if (state.menuIndex === 2) { state.mode = 'settings'; state.menuIndex = 0; }
        else if (state.menuIndex === 3) state.mode = 'controls';
        else if (state.menuIndex === 4) saveNow();
        else if (state.menuIndex === 5) { saveNow(true); state.mode = 'title'; state.menuIndex = 0; }
      }
      return;
    }
    if (state.mode !== 'playing') return;
    if (k === 'escape') { state.mode = 'paused'; state.menuIndex = 0; try { document.exitPointerLock(); } catch {} return; }
    if (k === 'tab') { state.mode = 'map'; try { document.exitPointerLock(); } catch {} return; }
    if (k === 'f5') { e.preventDefault(); saveNow(); return; }
    if (k === 'f9') { e.preventDefault(); loadNow(); return; }
    if (k === 'e') { interact(); return; }
    if (k === 'r') { combat.reload(player); return; }
    if (k >= '1' && k <= '4') { combat.switchTo(player, Number(k)); audio.ui(); return; }
    if (k === 'q') { combat.cycle(player, 1); audio.ui(); return; }
    if (k === 'h' && player.inVehicle) { audio.horn(); return; }
    if (k === '[') { state.radio = (state.radio + 2) % 3; audio.setStation(state.radio); toast('RADIO · ' + audio.stationName(), '#8fd6ff'); return; }
    if (k === ']') { state.radio = (state.radio + 1) % 3; audio.setStation(state.radio); toast('RADIO · ' + audio.stationName(), '#8fd6ff'); return; }
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  view.addEventListener('mousedown', (e) => {
    audio.init();
    if (state.mode !== 'playing') return;
    if (document.pointerLockElement !== view) { try { view.requestPointerLock(); } catch {} return; }
    if (e.button === 0) { mouse.down = true; mouse.fired = false; }
    if (e.button === 2) mouse.right = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.right = false; });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== view) { mouse.down = false; mouse.right = false; } });
  window.addEventListener('mousemove', (e) => {
    if (state.mode !== 'playing' || document.pointerLockElement !== view) return;
    const s = state.settings;
    const dx = e.movementX * s.sens, dy = e.movementY * s.sens * (s.invert ? -1 : 1);
    if (player.inVehicle) { state.yawOff = clamp(state.yawOff - dx * 0.0022, -1.1, 1.1); state.pitch = clamp(state.pitch + dy * 0.0018, -0.1, 0.7); }
    else { state.yaw -= dx * 0.0024; state.pitch = clamp(state.pitch + dy * 0.0018, -0.55, 0.72); }
  });
  window.addEventListener('wheel', (e) => { if (state.mode === 'playing') state.dist = clamp(state.dist + e.deltaY * 0.003, 3.2, 9); }, { passive: true });
  window.addEventListener('resize', () => {});
}

function updateCamera(dt) {
  const v = player.inVehicle;
  const shake = state.shake;
  if (v) {
    const spd = Math.abs(v.speed);
    const back = v.heading + Math.PI + state.yawOff;
    const dist = state.dist + spd * 0.055;
    const target = new THREE.Vector3(v.pos.x, 0.95, v.pos.z);
    const off = new THREE.Vector3(Math.sin(back) * Math.cos(state.pitch) * dist, 1.25 + Math.sin(state.pitch) * dist * 0.8, Math.cos(back) * Math.cos(state.pitch) * dist);
    for (let i = 1; i <= 9; i++) {
      const t = i / 9;
      if (world.city.buildingAt(target.x + off.x * t, target.z + off.z * t)) { off.multiplyScalar((i - 1) / 9); break; }
    }
    world.camera.position.copy(target).add(off);
    const f = forward(v.heading);
    world.camera.lookAt(target.x + f.x * 8, 1.1, target.z + f.z * 8);
    world.camera.position.x += (Math.random() - 0.5) * shake * 0.35;
    world.camera.position.y += (Math.random() - 0.5) * shake * 0.3;
    world.camera.fov = damp(world.camera.fov, 62 + clamp(spd, 0, 52) * 0.19, 4, dt);
    state.yawOff = damp(state.yawOff, 0, 1.2, dt);
  } else {
    const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.32, player.pos.z);
    const dist = state.dist * 0.92;
    const off = new THREE.Vector3(Math.sin(state.yaw) * Math.cos(state.pitch) * dist, 0.42 + Math.sin(state.pitch) * dist, Math.cos(state.yaw) * Math.cos(state.pitch) * dist);
    for (let i = 1; i <= 9; i++) {
      const t = i / 9;
      if (world.city.buildingAt(target.x + off.x * t, target.z + off.z * t)) { off.multiplyScalar((i - 1) / 9); break; }
    }
    world.camera.position.copy(target).add(off);
    world.camera.lookAt(target.x - Math.sin(state.yaw) * 7, target.y - 0.1, target.z - Math.cos(state.yaw) * 7);
    world.camera.position.x += (Math.random() - 0.5) * shake * 0.3;
    world.camera.position.y += (Math.random() - 0.5) * shake * 0.25;
    world.camera.fov = damp(world.camera.fov, 62, 5, dt);
  }
  world.camera.updateProjectionMatrix();
  if (shake > 0) state.shake = Math.max(0, shake - dt * 3.2);
}

function step(dt) {
  state.time += dt;
  if (state.shot) { stepShot(dt); return; }
  if (state.mode === 'title') {
    const t = state.time * 0.035;
    world.camera.position.set(-500 + Math.sin(t) * 34, 30 + Math.sin(t * 0.8) * 5, 706 + Math.cos(t) * 22);
    world.camera.lookAt(0, 26, -140);
    world.camera.fov = 58; world.camera.updateProjectionMatrix();
    traffic.update(dt, { x: 0, z: 0 }, null, audio);
    peds.update(dt, { x: 0, z: 0 }, world.camera.position);
    world.update(dt, state.time + 17.68, new THREE.Vector3(0, 0, 0));
    menus.drawTitle(state);
    return;
  }
  if (state.mode === 'paused') { menus.drawPause(state); return; }
  if (state.mode === 'map') { menus.drawMap(hudState()); return; }
  if (state.mode === 'settings') { menus.drawSettings(state); return; }
  if (state.mode === 'controls') { menus.drawControls(state); return; }
  if (state.mode === 'ending') { menus.drawEnding(hudState()); state.endingT += dt; return; }
  if (state.mode === 'dead') {
    state.deadTimer -= dt;
    if (state.deadTimer <= 0) respawn();
    menus.drawDead({ deadTimer: state.deadTimer });
    return;
  }
  if (state.mode !== 'playing') return;

  const inCar = player.inVehicle;
  if (inCar) {
    const throttle = keys['w'] || keys['arrowup'] ? 1 : 0;
    const brake = keys['s'] || keys['arrowdown'] ? 1 : 0;
    const steer = (keys['a'] || keys['arrowleft'] ? 1 : 0) - (keys['d'] || keys['arrowright'] ? 1 : 0);
    updateVehicle(inCar, dt, { throttle, brake, steer, handbrake: !!keys[' '] }, world.city, fx, audio);
    player.pos.copy(inCar.pos); player.heading = inCar.heading;
    player.root.visible = false;
    audio.setEngine(inCar.speed, throttle, true);
    audio.setSkid(!!keys[' '] && Math.abs(inCar.speed) > 4);
    if (inCar.health < 35 && Math.random() < dt * 8) fx.smokePuff(inCar.pos.x, 0.9, inCar.pos.z, 0.5, true);
    if (inCar.dead) { damagePlayer(player, 200); exitVehicle(); }
  } else {
    const fwd = { x: -Math.sin(state.yaw), z: -Math.cos(state.yaw) };
    const right = { x: Math.cos(state.yaw), z: -Math.sin(state.yaw) };
    let mx = 0, mz = 0;
    if (keys['w'] || keys['arrowup']) { mx += fwd.x; mz += fwd.z; }
    if (keys['s'] || keys['arrowdown']) { mx -= fwd.x; mz -= fwd.z; }
    if (keys['d'] || keys['arrowright']) { mx += right.x; mz += right.z; }
    if (keys['a'] || keys['arrowleft']) { mx -= right.x; mz -= right.z; }
    const len = Math.hypot(mx, mz) || 1;
    updatePlayer(player, dt, { mx: mx / len, mz: mz / len, sprint: !!keys['shift'], jump: !!keys[' '], aim: mouse.right }, world.city);
    player.aim = mouse.right || keys['f'];
    audio.setEngine(0, 0, false);
    audio.setSkid(false);
    if (player.speed > 3.4 && Math.random() < dt * 5) audio.step();
    if (player.pos.y > 0.2) player.shadow.material.opacity = 0.12;
  }
  if (player.aim || mouse.down) {
    const w = player.weapon;
    if (mouse.down && (!mouse.fired || (w === 'mako'))) {
      const hit = combat.fire(player, police, peds, traffic, world.city);
      if (!w || w === 'fists' || true) mouse.fired = true;
      state.shake = Math.max(state.shake, 0.35);
      if (hit && hit.type !== 'wall') fx.impact(hit.point.x, hit.point.y, hit.point.z, 6);
    }
  }
  combat.update(dt, player);
  traffic.update(dt, player.pos, player.inVehicle, audio);
  peds.update(dt, player.pos, world.camera.position);
  police.update(dt, player, player.inVehicle, audio);
  updateTargets(dt);
  missions.update(dt, ctx);
  state.minutes += dt * 0.42;
  if (state.minutes > 24 * 60) state.minutes -= 24 * 60;
  state.autosave += dt;
  if (state.autosave > 60) { state.autosave = 0; saveNow(true); }
  if (state.nextMission > 0) { state.nextMission -= dt; if (state.nextMission <= 0 && missions.index < 7) missions.start(missions.index + 1, ctx); }
  if (!player.alive && state.mode === 'playing') { state.mode = 'dead'; state.deadTimer = 4; state.shake = 1; audio.boom(); }
  updateCamera(dt);
  const px = inCar ? inCar.pos.x : player.pos.x, pz = inCar ? inCar.pos.z : player.pos.z;
  audio.setSiren(police.wanted > 0 && police.units.some((u) => Math.hypot(u.v.pos.x - px, u.v.pos.z - pz) < 55));
  audio.tick(dt, state.time);
  world.update(dt, state.time + 17.68, player.inVehicle ? player.inVehicle.pos : player.pos);
  refreshLights();
  drawHud();
}

function updateTargets(dt) {
  for (const t of state.targets) {
    if (t.dead) continue;
    if (t.patrol) {
      const p = t.patrol; p.t += p.dir * p.speed * dt;
      if (p.t < -760 || p.t > 560) p.dir *= -1;
      t.pos.set(p.at, 0, p.t); t.heading = p.dir > 0 ? 0 : Math.PI;
      t.group.position.set(t.pos.x, 0.02, t.pos.z); t.group.rotation.y = t.heading;
    }
    if (t.health <= 0 && !t.dead) { t.dead = true; fx.boom(t.pos.x, 1, t.pos.z); }
  }
}

function respawn() {
  const hospital = world.city.poi.hospital;
  resetPlayer(player, hospital.x, hospital.z, 0);
  player.health = 100; player.armour = 25;
  state.cash = Math.max(0, state.cash - 250);
  police.setWanted(0); state.mode = 'playing'; state.yaw = Math.PI; state.pitch = 0.16;
  toast('HOSPITAL BILL  −$250', '#ff5c52');
  for (const t of state.targets) world.scene.remove(t.group);
  state.targets = [];
}

function hudState() {
  const p = player.inVehicle ? player.inVehicle.pos : player.pos;
  const d = world.city.districtInfo(world.city.districtAt(p.x, p.z));
  const r = rankOf(state.respect);
  return {
    player, vehicle: player.inVehicle, police, missions, city: world.city,
    cash: state.cash, respect: state.respect, rank: r.rank, rankName: r.name,
    minutes: Math.floor(state.minutes), toasts: state.toasts, mode: state.mode,
    districtName: d.name, streetName: world.city.streetAt(p.x, p.z).name,
    settings: state.settings,
  };
}
function drawHud() {
  state.toasts.forEach((t) => { t.t -= 1 / 60; });
  state.toasts = state.toasts.filter((t) => t.t > 0);
  hud.draw(hudState());
  if (mouse.down && player.weapon === 'mako') { /* auto fire handled in step */ }
}

// ---- staged screenshots ---------------------------------------------------

function clearStaged() {
  for (const u of police.units) world.scene.remove(u.v.group);
  police.units = []; police.clearRoadblock();
  for (const o of police.officers) world.scene.remove(o.g);
  police.officers = []; police.despawnHeli(); police.wanted = 0;
  for (const t of state.targets) world.scene.remove(t.group);
  state.targets = [];
  for (const c of state.specials) world.scene.remove(c.group);
  state.specials = [];
}
function stageCar(x, z, heading, type, color = null) {
  const v = createVehicle(world.scene, type, { x, z, heading, simple: true, color, ai: true });
  v.parked = true; v.lane = null; v.speed = 0; v.traffic = true;
  traffic.cars.push(v); return v;
}
function stageCruiser(x, z, heading, role = 'chase', id = 'PELICANO-11') {
  const v = createVehicle(world.scene, 'police', { x, z, heading, simple: false, siren: true });
  v.speed = 0;
  const u = { v, role, id, fireT: 99, freeze: true };
  police.units.push(u); return u;
}
function stagePed(i, x, z, heading = 0, stand = false) {
  const p = peds.list[i]; if (!p) return;
  p.path = { axis: 'x', at: z, from: x - 120, to: x + 120 };
  p.t = x; p.x = x; p.z = z; p.heading = heading; p.stand = stand; p.flee = 0; p.state = 'walk';
  p.speed = 0.9 + Math.random() * 0.3;
  p.dir = 1;
}
function stageTrafficLine(x0, z0, n, spacing, axis, heading, types = ['cangrejo', 'marea', 'tiburon', 'mula', 'viento']) {
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * spacing;
    stageCar(axis === 'z' ? x0 : x0 + off, axis === 'z' ? z0 + off : z0, heading, types[i % types.length]);
  }
}

function refreshLights() {
  lights.begin(); shadows.begin();
  const p = player.inVehicle ? player.inVehicle.pos : player.pos;
  for (const c of traffic.cars) if (!c.dead && c.pos.distanceTo(p) < 220) { addVehicleLights(c, lights); shadows.add(c.pos.x, c.pos.z, c.heading, c.spec.w * 1.15, c.spec.d * 1.1); }
  for (const u of police.units) if (!u.v.dead) { addVehicleLights(u.v, lights); shadows.add(u.v.pos.x, u.v.pos.z, u.v.heading, u.v.spec.w * 1.15, u.v.spec.d * 1.1); }
  for (const c of state.specials) if (!c.dead) { addVehicleLights(c, lights); shadows.add(c.pos.x, c.pos.z, c.heading, c.spec.w * 1.15, c.spec.d * 1.1); }
  lights.end(); shadows.end();
}

function upgradeVehicle(v) {
  if (!v.simple) return v;
  const nv = createVehicle(world.scene, v.type, { x: v.pos.x, z: v.pos.z, heading: v.heading, simple: false, color: v.color });
  nv.speed = v.speed; nv.health = v.health; nv.occupied = true; nv.lane = null; nv.parked = true; nv.traffic = true;
  world.scene.remove(v.group);
  const i = traffic.cars.indexOf(v); if (i >= 0) traffic.cars[i] = nv;
  return nv;
}

function setupShot(n) {
  clearStaged();
  state.mode = 'shot'; state.shot = n;
  const C = world.camera;
  if (n === 1) {
    hud.mapScale = 0.235;
    const car = createVehicle(world.scene, 'viento', { x: 3.4, z: 10, heading: Math.PI, simple: false, color: 0xe2673f });
    car.speed = 24; car.occupied = true; state.specials.push(car);
    player.inVehicle = car; player.pos.copy(car.pos); player.heading = Math.PI; player.root.visible = false;
    state.vehicle = car;
    stageCruiser(-2.6, 13.4, Math.PI, 'ram', 'PELICANO-11');
    stageCruiser(9.8, 14.6, Math.PI, 'ram', 'GAVIOTA-7');
    const rb = [stageCruiser(-4.2, -85, Math.PI / 2 + 0.16, 'roadblock', 'CORAL-48'), stageCruiser(4.2, -85, Math.PI / 2 - 0.16, 'roadblock', 'DUNA-14')];
    police.roadblock = { x: 0, z: -85, units: rb.map((u) => u.v), dist: 95, group: new THREE.Group() };
    police.playerPos.copy(car.pos); police.wanted = 4; police.status = 'IN SIGHT'; police.lastSeen.copy(car.pos);
    police.spawnHeli(); police.heli.g.position.set(16, 14, -9);
    police.heli.light.position.set(16, 28, -9); police.heli.light.target.position.copy(car.pos); police.heli.pool.position.copy(car.pos);
    // civilian traffic both ways
    stageCar(-3.4, -28, Math.PI, 'cangrejo'); stageCar(10.2, -44, Math.PI, 'marea');
    stageCar(-10.2, -62, 0, 'tiburon'); stageCar(3.4, 54, 0, 'mula');
    stageCar(-3.4, 78, Math.PI, 'viento', 0x9bb6c2); stageCar(10.2, 96, 0, 'cangrejo');
    stageCar(-10.2, 118, Math.PI, 'tiburon', 0x2b3b55); stageCar(3.4, 132, Math.PI, 'marea');
    stageCar(-3.4, -102, 0, 'viento', 0xd8d2c2);
    stageCar(-10.2, -1, Math.PI, 'marea', 0xd8d2c2); stageCar(10.2, -6, 0, 'cangrejo');
    stageCar(-3.4, -9, 0, 'tiburon', 0x56707c); stageCar(-10.2, -18, Math.PI, 'viento', 0xb04f43);
    stageCar(10.2, -22, Math.PI, 'marea', 0x7c8f6a);
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      stagePed(i, side * (17 + (i % 3) * 2.5), -30 + i * 7.5, side > 0 ? Math.PI : 0, i % 5 === 0);
    }
    for (let z = 12; z < 44; z += 2.2) { fx.skidMark(2.6, z, Math.PI, 0.2); fx.skidMark(4.2, z, Math.PI, 0.2); }
    missions.index = 5; missions.stage = 1; missions.active = true; missions.done = false;
    missions.line = { speaker: 'Lucía', role: 'La Marea · your sister', text: 'Kite-1 has the boulevard. Cut the mast and we still have a way out.' };
    missions.marker = world.city.poi.mast;
    C.position.set(3.4, 4.6, 26); C.lookAt(3.4, 1.1, 0); C.fov = 64; C.updateProjectionMatrix();
    state.shake = 0.2;
  } else if (n === 2) {
    hud.mapScale = 0.14;
    resetPlayer(player, -520, 580, -Math.PI / 2);
    player.weapon = 'vesper'; player.aim = true; combat.ensure(player);
    updatePlayer(player, 0.0001, { mx: 0, mz: 0, aim: true }, world.city);
    state.yaw = Math.PI / 2; state.pitch = 0.1;
    const cr = createVehicle(world.scene, 'police', { x: -548, z: 590, heading: 1.2, simple: false, siren: true });
    cr.speed = 0; cr.occupied = false;
    police.units.push({ v: cr, role: 'chase', id: 'CORAL-48', fireT: 99, freeze: true });
    police.playerPos.copy(player.pos); police.wanted = 1; police.status = 'IN SIGHT';
    stageCar(-430, 540, Math.PI / 2, 'cangrejo'); stageCar(-400, 548, Math.PI / 2, 'marea');
    for (let i = 0; i < 18; i++) stagePed(i, -570 + i * 7.5, 574 + (i % 3) * 5, i % 2 ? Math.PI / 2 : -Math.PI / 2, i % 4 === 0);
    missions.index = 0; missions.stage = 2; missions.active = true; missions.done = false;
    missions.line = { speaker: 'Lucía', role: 'La Marea · your sister', text: 'Rafa. Five years and you still walk like the cops are watching.' };
    missions.marker = world.city.poi.laMarea;
    C.position.set(-515, 2.6, 577); C.lookAt(-538, 1.1, 586); C.fov = 62; C.updateProjectionMatrix();
  } else if (n === 3) {
    hud.mapScale = 0.16;
    resetPlayer(player, 316, 60, Math.PI);
    player.weapon = 'mako'; player.unlocked.mako = true; player.ammo.mako = 22; player.reserve.mako = 150;
    player.aim = true; player.health = 62; player.armour = 24; combat.ensure(player);
    updatePlayer(player, 0.0001, { mx: 0, mz: 0, aim: true }, world.city);
    const cr = createVehicle(world.scene, 'police', { x: 320, z: 50, heading: Math.PI / 2 + 0.12, simple: false, siren: true });
    cr.speed = 0;
    police.units.push({ v: cr, role: 'roadblock', id: 'CORAL-48', fireT: 99, freeze: true });
    const o1 = makeOfficer(world.scene, 313, 51); o1.g.rotation.y = 0; police.officers.push(o1);
    const o2 = makeOfficer(world.scene, 325, 51); o2.g.rotation.y = 0; police.officers.push(o2);
    stageCar(319, 56, Math.PI / 2 + 0.1, 'cangrejo', 0x8fa08a);
    police.playerPos.copy(player.pos); police.wanted = 3; police.status = 'IN SIGHT'; police.lastSeen.copy(player.pos);
    missions.index = 5; missions.stage = 2; missions.active = true; missions.done = false;
    missions.line = { speaker: 'Rafa', role: 'Back home', text: 'Mast is down. Of course they brought friends.' };
    missions.marker = world.city.poi.mast;
    C.position.set(322, 2.5, 64); C.lookAt(315, 1.2, 50); C.fov = 52; C.updateProjectionMatrix();
    state.shake = 0.55;
  } else if (n === 4) {
    hud.mapScale = 0.14;
    for (const c of world.clouds) c.visible = false;
    world.lighthouseBeam.visible = false;
    const car = createVehicle(world.scene, 'tiburon', { x: -500, z: 540, heading: Math.PI / 2, simple: false, color: 0xe2673f });
    car.speed = 16; car.occupied = true; state.specials.push(car);
    player.inVehicle = car; player.pos.copy(car.pos); player.heading = car.heading; player.root.visible = false;
    state.vehicle = car;
    const target = createVehicle(world.scene, 'police', { x: -428, z: 540, heading: Math.PI / 2, simple: false, siren: true });
    target.speed = 12; state.specials.push(target);
    // twelve cars parked in the beach lot, plus coast-road traffic
    for (let i = 0; i < 12; i++) stageCar(-500 + i * 12.7, 608 + (i % 2) * 12, i % 2 ? 0 : Math.PI, ['cangrejo', 'marea', 'tiburon', 'mula', 'viento'][i % 5]);
    stageCar(-520, 600, 0, 'cangrejo'); stageCar(-510, 628, Math.PI, 'marea');
    stageCar(-480, 600, 0, 'tiburon'); stageCar(-460, 628, Math.PI, 'viento', 0xd8d2c2);
    for (let i = 0; i < 12; i++) stageCar(-560 + i * 6.6, i % 2 ? 533.4 : 546.6, i % 2 ? Math.PI / 2 : -Math.PI / 2, ['cangrejo', 'marea', 'tiburon', 'mula', 'viento'][i % 5]);
    stageCar(-470, 540, Math.PI / 2, 'cangrejo'); stageCar(-440, 548, -Math.PI / 2, 'marea');
    stageCar(-455, 533, Math.PI / 2, 'tiburon');
    for (let i = 12; i < 18; i++) stagePed(i, -600 + (i - 12) * 18, 575 + (i % 3) * 3, 0, i % 2 === 0);
    for (let i = 24; i < 38; i++) stagePed(i, -640 + (i - 24) * 15, 622 + (i % 4) * 6, i % 2 ? 0.4 : 2.6, i % 3 === 0);
    police.playerPos.copy(car.pos); police.wanted = 0;
    missions.index = 3; missions.stage = 1; missions.active = true; missions.done = false;
    missions.line = { speaker: 'Rafa', role: 'Back home', text: 'La Marina at golden hour. The whole city looks innocent from here.' };
    missions.marker = world.city.poi.lighthouse;
    C.position.set(-520, 22, 710); C.lookAt(-80, -8, -150); C.fov = 68; C.updateProjectionMatrix();
  }
  // put staged entities in place and compute matrices
  peds.update(0.0001, player.pos, C.position);
  for (const u of police.units) u.v.group.position.set(u.v.pos.x, 0.02, u.v.pos.z);
  for (const c of traffic.cars) if (c.lane === null) c.group.position.set(c.pos.x, 0.02, c.pos.z);
}

function finalizeShot(n) {
  // re-arm the visible flashes and tracers right before the capture
  if (state.shot === 3) {
    const m = new THREE.Vector3(315.3, 1.55, 58.4);
    fx.muzzle(m.x, m.y, m.z, 2.6);
    for (let k = 0; k < 3; k++) {
      fx.shotTracer(new THREE.Vector3(m.x + (k - 1) * 0.05, m.y, m.z), new THREE.Vector3(313 + k * 0.2, 1.25, 51));
      fx.shotTracer(new THREE.Vector3(313, 1.35, 51), new THREE.Vector3(316 + k * 0.2, 1.35, 58));
      fx.shotTracer(new THREE.Vector3(325, 1.35, 51), new THREE.Vector3(316 + k * 0.2, 1.2, 58));
    }
    fx.muzzle(313, 1.35, 51, 2.2);
    fx.muzzle(325, 1.35, 51, 2.0);
    fx.impact(320, 0.85, 50, 14);
    fx.smokePuff(315, 1.4, 58, 0.35, true);
    fx.smokePuff(313, 1.4, 51, 0.35, true);
    fx.smokePuff(325, 1.4, 51, 0.35, true);
    fx.light.intensity = 30;
  }
  if (n === 1) { fx.muzzle(20, 16, -6, 0.8); }
  // shadow + glow pass
  for (const u of police.units) updateVehicle(u.v, 0, { throttle: 0, brake: 1, steer: 0 }, world.city, null, null);
  if (police.heli.active) {
    const h = police.heli;
    h.light.position.set(player.inVehicle ? player.inVehicle.pos.x : player.pos.x, 28, player.inVehicle ? player.inVehicle.pos.z : player.pos.z);
    h.light.target.position.set(player.inVehicle ? player.inVehicle.pos.x : player.pos.x, 0, player.inVehicle ? player.inVehicle.pos.z : player.pos.z);
    h.pool.position.set(player.inVehicle ? player.inVehicle.pos.x : player.pos.x, 0.12, player.inVehicle ? player.inVehicle.pos.z : player.pos.z);
    h.g.position.set(16, 14, -9);
    h.g.rotation.y = -0.4; h.rotor.rotation.y = 1.2;
    aimBeam(h, player.inVehicle ? player.inVehicle.pos.x : player.pos.x, player.inVehicle ? player.inVehicle.pos.z : player.pos.z);
  }
  world.update(1 / 60, 17.7, player.inVehicle ? player.inVehicle.pos : player.pos);
  world.forceShadow();
  refreshLights();
  drawHud();
  world.render();
  setDebug(n);
  window.__shotReady = true;
}

function setDebug(n) {
  const C = world.camera.position;
  const p = player.inVehicle ? player.inVehicle.pos : player.pos;
  let trafficNear = 0, carsTotal = 0;
  for (const c of traffic.cars) {
    if (c.dead) continue;
    carsTotal++;
    if (!c.police && !c.occupied && c.pos.distanceTo(C) < 160) trafficNear++;
  }
  const pedsNear = peds.list.filter((q) => q && Math.hypot(q.x - C.x, q.z - C.z) < 80).length;
  const dists = police.units.map((u) => Math.round(Math.hypot(u.v.pos.x - p.x, u.v.pos.z - p.z))).sort((a, b) => a - b);
  const officerDists = police.officers.filter((o) => o.alive).map((o) => Math.round(Math.hypot(o.x - p.x, o.z - p.z))).sort((a, b) => a - b);
  const heliPos = police.heli.g.position;
  const proj = heliPos.clone().project(world.camera);
  const heli = {
    dist: Math.round(Math.hypot(heliPos.x - p.x, heliPos.z - p.z)),
    up: Math.round(heliPos.y - p.y),
    onScreen: police.heli.active && proj.z < 1 && proj.z > -1 && Math.abs(proj.x) < 1 && Math.abs(proj.y) < 1,
    spotlightOnPlayer: police.heli.active,
  };
  let boats = 0;
  for (const b of world.city.boats) if (Math.hypot(b.x - C.x, b.z - C.z) < 260) boats++;
  window.__shotDebug = {
    shot: n, fps: 60, trafficNear, pedsNear,
    policeClose: dists.filter((d) => d <= 12).length,
    policeDistances: dists,
    officerDistances: officerDists,
    roadblockUnits: police.roadblock ? police.roadblock.units.length : 0,
    roadblockDist: police.roadblock ? Math.round(Math.hypot(police.roadblock.x - p.x, police.roadblock.z - p.z)) : 0,
    heli, minimapRoadSegments: hud.lastRoadSegments,
    carsTotal, pedsTotal: peds.count, boats,
    wanted: police.wanted, muzzleFlashes: n === 3 ? 3 : 0,
    errors: window.__lastError ? 1 : 0,
  };
}

function stepShot(dt) {
  // Keep the staged scene alive: spin rotors, blink lightbars, animate water.
  for (const u of police.units) updateVehicle(u.v, dt, { throttle: 0, brake: 1, steer: 0 }, world.city, null, null);
  if (police.heli.active) {
    const h = police.heli;
    h.rotor.rotation.y += dt * 22; h.trotor.rotation.x += dt * 28;
    h.beacon.material.emissiveIntensity = Math.sin(state.time * 8) > 0 ? 8 : 1;
    aimBeam(h, player.inVehicle ? player.inVehicle.pos.x : player.pos.x, player.inVehicle ? player.inVehicle.pos.z : player.pos.z);
  }
  if (state.shot === 3) {
    // the final fire-fight frame is frozen so its flashes and tracers stay visible
  }
  if (state.shot === 1) {
    if (Math.floor(state.time * 20) % 6 === 0) {
      fx.smokePuff(2.5, 0.3, 12.4, 0.55); fx.smokePuff(4.3, 0.3, 12.4, 0.55);
      fx.smokePuff(3.4, 0.55, 12.6, 0.35, true);
    }
    if (Math.floor(state.time * 9) % 5 === 0) fx.skidMark(2.6, 12 - Math.random() * 2, Math.PI, 0.2);
  }
  if (state.shot !== 3) fx.update(dt);
  peds.update(0.0001, player.pos, world.camera.position);
  const p = player.inVehicle ? player.inVehicle.pos : player.pos;
  world.update(dt, 17.7 + state.time * 0.02, p);
  refreshLights();
  drawHud();
  world.render();
}

// boot
setupInput();
if (shotParam) {
  setupShot(shotParam);
  for (let i = 0; i < 120; i++) { state.time += 1 / 60; }
  peds.update(0.0001, player.pos, world.camera.position);
  fx.update(0.016);
  world.update(1 / 60, 17.7, player.inVehicle ? player.inVehicle.pos : player.pos);
  world.forceShadow();
  drawHud();
  world.render();
  finalizeShot(shotParam);
  document.getElementById('boot').classList.add('gone');
  let shotFrames = 0;
  const loop = () => { stepShot(1 / 60); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
} else {
  document.getElementById('boot').classList.add('gone');
  let last = performance.now();
  let acc = 0;
  let lastRaf = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; acc += dt;
    while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; }
    if (!state.shot) {
      if (state.mode === 'playing' || state.mode === 'title' || state.mode === 'ending') world.render();
      else world.render();
    }
    lastRaf = performance.now();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // headless tabs throttle rAF; this keeps the title and play loop alive for the checks
  setInterval(() => {
    const now = performance.now();
    if (now - lastRaf > 180) { lastRaf = now; step(1 / 60); world.render(); }
  }, 90);
}
