// police.js — the PDC response: wanted stars, cruisers that actually drive at you, officers who
// get out and shoot, roadblocks across the boulevard, and Kite-1 with its spotlight.
import * as THREE from 'three';
import { makeRng, range, pick, clamp, angleLerp } from './rng.js';
import { GeoBatch } from './scene.js';

const CALLSIGNS = ['PELICANO-11', 'GAVIOTA-7', 'CORAL-48', 'ANCLA-9', 'DUNA-14', 'MURO-1', 'TIBURON-3', 'SIRENA-22'];
const TACTICS = ['RAMMING', 'FLANKING', 'PURSUIT', 'FIRING', 'ROADBLOCK'];

function normalize(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function buildHeli() {
  const group = new THREE.Group();
  const b = new GeoBatch();
  b.box(0, 0, 0, 2.4, 1.4, 4.2, 0x27313a, 0);
  b.box(0, 0.55, -1.2, 2.0, 1.0, 1.6, 0x2f3b45, 0);
  b.box(0, 0.35, 0.5, 1.4, 0.5, 1.4, 0x55666f, 0);
  b.box(0, 0.05, -3.4, 0.34, 0.34, 3.0, 0x27313a, 0);
  b.box(0, 0.5, -4.8, 0.2, 1.3, 0.2, 0x27313a, 0);
  b.box(-1.35, -0.55, 0.2, 0.16, 0.8, 1.8, 0x20272d, 0);
  b.box(1.35, -0.55, 0.2, 0.16, 0.8, 1.8, 0x20272d, 0);
  b.box(0, -0.82, 0.2, 2.8, 0.09, 0.12, 0x20272d, 0);
  b.box(0, 0.95, 0, 0.4, 0.12, 0.4, 0x3b444b, 0);
  const bodyMesh = b.build(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0x9aa6ad, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 0.24), bladeMat);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.7, 24), new THREE.MeshBasicMaterial({ color: 0xaab4ba, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  rotor.add(disc);
  rotor.position.y = 1.08;
  group.add(rotor);

  const tailRotor = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.7), bladeMat);
  tailRotor.position.set(0.2, 0.5, -4.8);
  tailRotor.rotation.y = Math.PI / 2;
  group.add(tailRotor);

  const spotCone = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  spotCone.renderOrder = 3;
  sceneAdd(spotCone);
  const spotConeOuter = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  spotConeOuter.renderOrder = 2;
  sceneAdd(spotConeOuter);
  const spotPool = new THREE.Mesh(
    new THREE.CircleGeometry(4.6, 24),
    new THREE.MeshBasicMaterial({ map: roadblockGlow(), color: 0xffd98a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  spotPool.rotation.x = -Math.PI / 2;
  spotPool.renderOrder = 3;
  sceneAdd(spotPool);
  sceneAdd(group);
  return { group, rotor, tailRotor, spotCone, spotConeOuter, spotPool, bodyMesh };
}

let rbGlowTexture = null;
function roadblockGlow() {
  if (rbGlowTexture) return rbGlowTexture;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  rbGlowTexture = new THREE.CanvasTexture(c);
  rbGlowTexture.colorSpace = THREE.SRGBColorSpace;
  return rbGlowTexture;
}

let sceneHolder = null;
function sceneAdd(o) { if (sceneHolder) sceneHolder.add(o); }

export function createPolice(scene, city, vehicles, peds, player, world, hud) {
  sceneHolder = scene;
  const rng = makeRng(9911);
  const state = {
    level: 0,
    status: 'HIDDEN',
    units: [],
    heli: null,
    roadblocks: [],
    roadblockUnits: [],
    lastSeen: 0,
    searchTimer: 0,
    spawnTimer: 0,
    roadblockTimer: 0,
    staged: false,
    time: 0,
    lastCrime: 0,
    muzzlePolice: 0,
    commitCount: 0,
    dispatch: [],
  };
  const api = {
    state,
    combat: null,
    hud: null,
    commit,
    update,
    setLevel,
    clear,
    spawnUnit,
    spawnHeli,
    spawnRoadblock,
    stageShot1,
    stageShot2,
    stageShot3,
    getDispatch,
    officerShoot,
    unitNear,
    countNear,
    distances,
    spotlightOnPlayer: () => Boolean(state.heli?.spotlightOnPlayer),
  };

  function addUnit(x, z, heading, opts = {}) {
    const v = vehicles.spawn('cangrejo', x, z, heading, {
      police: true,
      color: 0xe9e5d9,
      callsign: opts.callsign || CALLSIGNS[state.units.length % CALLSIGNS.length],
      driver: 'ai',
    });
    v.police = true;
    v.siren = true;
    const unit = {
      v,
      callsign: v.callsign,
      tactic: opts.tactic || 'PURSUIT',
      officers: [],
      active: true,
      stuck: 0,
      age: 0,
      roadblock: Boolean(opts.roadblock),
    };
    if (opts.roadblock) {
      v.kinematic = true;
      v.brake = true;
    } else {
      v.ai = { throttle: 1, steer: 0 };
    }
    v.unit = unit;
    state.units.push(unit);
    return unit;
  }

  function spawnUnit(opts = {}) {
    const px = player.pos.x, pz = player.pos.z;
    const behind = player.heading + Math.PI;
    const lane = city.nearestLane(px, pz).lane;
    let x = px + Math.sin(behind) * range(rng, 55, 110) + range(rng, -8, 8);
    let z = pz + Math.cos(behind) * range(rng, 55, 110) + range(rng, -8, 8);
    if (city.blocked(x, z, 3)) {
      x = px + Math.sin(behind) * 70;
      z = pz + Math.cos(behind) * 70;
    }
    if (city.blocked(x, z, 3) && lane) {
      const p = city.lanePoint(lane, city.lanePoint ? 100 : 100);
      x = p.x; z = p.z;
    }
    return addUnit(x, z, Math.atan2(px - x, pz - z), opts);
  }

  function spawnHeli() {
    if (state.heli) return state.heli;
    const h = buildHeli();
    if (!h.group.parent) scene.add(h.group);
    state.heli = { ...h, angle: rng() * 6.28, dist: 70, up: 30, onScreen: true, spotlightOnPlayer: false, callsign: 'KITE-1' };
    return state.heli;
  }

  function removeHeli() {
    if (!state.heli) return;
    scene.remove(state.heli.group);
    scene.remove(state.heli.spotCone);
    scene.remove(state.heli.spotConeOuter);
    scene.remove(state.heli.spotPool);
    state.heli = null;
  }

  function addCones(x, z, heading, n = 6) {
    const g = new THREE.Group();
    const coneMat = new THREE.MeshLambertMaterial({ color: 0xe86a32, flatShading: true });
    for (let i = 0; i < n; i += 1) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 6), coneMat);
      const t = (i - n / 2) * 1.4;
      cone.position.set(Math.cos(heading) * t, 0.38, -Math.sin(heading) * t);
      cone.castShadow = true;
      g.add(cone);
    }
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    scene.add(g);
    return g;
  }

  function spawnRoadblock(px, pz, heading, distance = 105) {
    const x = px + Math.sin(heading) * distance;
    const z = pz + Math.cos(heading) * distance;
    const left = addUnit(x - Math.cos(heading) * 5.5, z + Math.sin(heading) * 5.5, heading + Math.PI / 2, {
      callsign: 'MURO-1', tactic: 'ROADBLOCK', roadblock: true,
    });
    const right = addUnit(x + Math.cos(heading) * 5.5, z - Math.sin(heading) * 5.5, heading - Math.PI / 2, {
      callsign: 'MURO-2', tactic: 'ROADBLOCK', roadblock: true,
    });
    left.v.pos.set(x - Math.cos(heading) * 5.5, 0.02, z + Math.sin(heading) * 5.5);
    right.v.pos.set(x + Math.cos(heading) * 5.5, 0.02, z - Math.sin(heading) * 5.5);
    left.v.heading = heading + Math.PI / 2;
    right.v.heading = heading - Math.PI / 2;
    left.v.group.position.copy(left.v.pos); left.v.group.rotation.y = left.v.heading;
    right.v.group.position.copy(right.v.pos); right.v.group.rotation.y = right.v.heading;
    const cones = addCones(x, z, heading, 7);
    const glowGroup = new THREE.Group();
    const flareTex = roadblockGlow();
    for (const sx of [-4.5, 4.5]) {
      const col = sx < 0 ? 0xff3344 : 0x3a74ff;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: flareTex, color: col, transparent: true, opacity: 0.52,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      sp.position.set(sx, 1.7, 0);
      sp.scale.set(4.6, 4.6, 1);
      glowGroup.add(sp);
    }
    glowGroup.position.set(x, 0, z);
    glowGroup.rotation.y = heading;
    scene.add(glowGroup);
    const rb = { x, z, units: [left, right], cones, glowGroup, dist: distance };
    state.roadblocks.push(rb);
    state.roadblockUnits = [left, right];
    return rb;
  }

  function clearRoadblocks() {
    for (const rb of state.roadblocks) {
      scene.remove(rb.cones);
      if (rb.glowGroup) scene.remove(rb.glowGroup);
      for (const u of rb.units) {
        const i = state.units.indexOf(u);
        if (i >= 0) state.units.splice(i, 1);
        vehicles.remove(u.v);
      }
    }
    state.roadblocks.length = 0;
    state.roadblockUnits = [];
  }

  function clear() {
    clearRoadblocks();
    for (const u of state.units) {
      for (const o of u.officers) { o.group.visible = false; }
      vehicles.remove(u.v);
    }
    state.units.length = 0;
    removeHeli();
    state.level = 0;
    state.status = 'HIDDEN';
    state.searchTimer = 0;
    state.lastSeen = 0;
    state.staged = false;
  }

  function setLevel(n) {
    const next = clamp(Math.round(n), 0, 5);
    if (next > state.level) state.commitCount += next - state.level;
    state.level = next;
    if (next === 0) clear();
    if (!state.staged) {
      const max = next >= 5 ? 6 : next >= 4 ? 5 : next >= 3 ? 3 : next >= 2 ? 2 : next >= 1 ? 1 : 0;
      while (state.units.filter((u) => !u.roadblock).length < max) {
        const u = spawnUnit();
        if (!u) break;
        if (state.units.length > 9) break;
      }
      if (next >= 4) spawnHeli();
    }
  }

  function commit(n, reason = '') {
    if (n <= 0) return state.level;
    const now = state.time;
    if (n <= 1 && now - state.lastCrime < 0.35) return state.level;
    state.lastCrime = now;
    state.commitCount += 1;
    const was = state.level;
    state.level = clamp(state.level + n, 0, 5);
    state.status = 'IN SIGHT';
    state.lastSeen = 0;
    if (state.level > was) {
      hud?.toast?.('WANTED LEVEL UP', 'wanted');
      hud?.dialog?.('PDC DISPATCH', 'radio', `All units, suspect wanted at ${state.level} star${state.level > 1 ? 's' : ''}. ${reason}`);
      if (state.level >= 4) spawnHeli();
      if (state.level >= 3 && !state.staged) spawnRoadblock(player.pos.x, player.pos.z, player.heading, 110);
      if (!state.staged) setLevel(state.level);
    }
    return state.level;
  }

  function officerShoot(officer, target) {
    if (!api.combat) return;
    state.muzzlePolice = 0.16;
    const from = new THREE.Vector3(officer.pos.x, 1.2, officer.pos.z);
    const to = new THREE.Vector3(target.pos.x + range(rng, -0.5, 0.5), 1.1, target.pos.z + range(rng, -0.5, 0.5));
    api.combat.npcShot(from, to, 0.62, 7);
  }
  state.officerShoot = officerShoot;

  function updateUnits(dt) {
    const px = player.pos.x, pz = player.pos.z;
    for (let i = state.units.length - 1; i >= 0; i -= 1) {
      const u = state.units[i];
      const v = u.v;
      if (v.dead) {
        for (const o of u.officers) o.group.visible = false;
        state.units.splice(i, 1);
        continue;
      }
      u.age += dt;
      const d = Math.hypot(px - v.pos.x, pz - v.pos.z);
      if (u.roadblock) {
        u.tactic = 'ROADBLOCK';
        if (d > 190 && !state.staged) {
          const j = state.units.indexOf(u);
          if (j >= 0) state.units.splice(j, 1);
          vehicles.remove(v);
        }
        continue;
      }
      if (state.staged) {
        v.siren = true;
        continue;
      }
      if (d > 260) {
        const j = state.units.indexOf(u);
        if (j >= 0) state.units.splice(j, 1);
        vehicles.remove(v);
        continue;
      }
      const desired = Math.atan2(px - v.pos.x, pz - v.pos.z);
      let diff = normalize(desired - v.heading);
      // at close range, swing alongside to box the player in
      if (d < 16) diff += Math.sin(state.time * 2 + i) * 0.3;
      v.ai = v.ai || { throttle: 1, steer: 0 };
      v.ai.steer = clamp(diff * 2.2, -1, 1);
      v.ai.throttle = d > 18 ? 1 : d > 11 ? 0.35 : -0.5;
      v.brake = d < 9 && v.speed > 8;
      u.tactic = d < 13 ? 'RAMMING' : d < 30 ? 'FLANKING' : d < 70 ? 'PURSUIT' : 'CLOSING';
      if (Math.abs(v.speed) < 1.2 && d > 20) u.stuck += dt; else u.stuck = Math.max(0, u.stuck - dt);
      if (u.stuck > 4.5) {
        const bx = px + Math.sin(player.heading + Math.PI) * 70;
        const bz = pz + Math.cos(player.heading + Math.PI) * 70;
        v.pos.set(bx, 0.02, bz);
        v.heading = desired;
        u.stuck = 0;
      }
      // officers leave the car when it is close and the response is armed
      if (state.level >= 3 && d < 26 && u.officers.length === 0) {
        for (let k = 0; k < 2; k += 1) {
          const a = v.heading + (k === 0 ? -1.2 : 1.2);
          const ox = v.pos.x + Math.sin(a) * 2.4;
          const oz = v.pos.z + Math.cos(a) * 2.4;
          const o = peds.spawnOfficer(ox, oz, { heading: desired, state: 'police' });
          o.unit = u;
          u.officers.push(o);
        }
      }
      if (u.officers.length) {
        const alive = u.officers.filter((o) => o.alive);
        if (alive.length) u.tactic = 'FIRING';
      }
    }
  }

  function updateHeli(dt, camera) {
    if (!state.heli) return;
    const h = state.heli;
    if (state.level < 4 && !state.staged) { removeHeli(); return; }
    h.angle += dt * 0.25;
    const radius = state.staged ? 18 : 48;
    const fixed = h.fixed;
    const x = fixed ? fixed.x : player.pos.x + Math.cos(h.angle) * radius;
    const z = fixed ? fixed.z : player.pos.z + Math.sin(h.angle) * radius - 4;
    const y = fixed ? fixed.y : state.staged ? 20 : 30 + Math.sin(h.angle * 1.7) * 2;
    h.group.position.set(x, y, z);
    h.group.rotation.y = -h.angle + Math.PI / 2;
    h.rotor.rotation.y += dt * 28;
    h.tailRotor.rotation.z += dt * 34;
    // spotlight: a cone whose apex is the helicopter and base is the player's roof
    const p = new THREE.Vector3(player.pos.x, 0.3, player.pos.z);
    const top = new THREE.Vector3(x, y - 1.2, z);
    const mid = top.clone().add(p).multiplyScalar(0.5);
    const dir = top.clone().sub(p);
    const len = dir.length();
    dir.normalize();
    h.spotCone.position.copy(mid);
    h.spotCone.scale.set(Math.max(2.2, len * 0.18), len, Math.max(2.2, len * 0.18));
    h.spotCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    if (h.spotConeOuter) {
      h.spotConeOuter.position.copy(mid);
      h.spotConeOuter.scale.set(Math.max(3.0, len * 0.26), len * 1.02, Math.max(3.0, len * 0.26));
      h.spotConeOuter.quaternion.copy(h.spotCone.quaternion);
    }
    h.spotPool.position.set(p.x, 0.11, p.z);
    h.spotPool.scale.setScalar(0.9 + Math.sin(state.time * 3) * 0.1);
    h.spotlightOnPlayer = Math.hypot(x - p.x, z - p.z) < 30;
    h.dist = camera ? camera.position.distanceTo(h.group.position) : Math.hypot(x - p.x, y, z - p.z);
    h.up = camera ? h.group.position.y - camera.position.y : y;
    h.onScreen = true;
    if (camera) {
      const v = h.group.position.clone().project(camera);
      h.onScreen = v.z < 1 && v.x > -1.05 && v.x < 1.05 && v.y > -1.05 && v.y < 1.05;
      h.screen = { x: v.x, y: v.y };
    }
  }

  function update(dt, camera) {
    state.time += dt;
    state.muzzlePolice = Math.max(0, state.muzzlePolice - dt);
    if (state.level <= 0 && !state.staged) {
      state.status = 'HIDDEN';
      updateHeli(dt, camera);
      return;
    }
    let seen = false;
    for (const u of state.units) {
      const d = Math.hypot(u.v.pos.x - player.pos.x, u.v.pos.z - player.pos.z);
      if (d < 230 && !city.segmentBlocked(u.v.pos.x, u.v.pos.z, player.pos.x, player.pos.z)) { seen = true; break; }
    }
    if (state.heli?.spotlightOnPlayer) seen = true;
    if (seen) {
      state.status = 'IN SIGHT';
      state.lastSeen = 0;
      state.searchTimer = 0;
    } else {
      state.lastSeen += dt;
      if (state.lastSeen > 8) {
        state.status = 'SEARCHING';
        state.searchTimer += dt;
        if (state.searchTimer > 9 && state.level > 0 && !state.staged) {
          state.level = Math.max(0, state.level - 1);
          state.searchTimer = 0;
          state.lastSeen = 8;
          if (state.level === 0) {
            state.status = 'HIDDEN';
            state.units.forEach((u) => { u.v.siren = false; });
            clear();
          }
        }
      } else {
        state.status = 'IN SIGHT';
      }
    }
    if (!state.staged) {
      state.spawnTimer += dt;
      const max = state.level >= 5 ? 6 : state.level >= 4 ? 5 : state.level >= 3 ? 3 : state.level >= 2 ? 2 : state.level >= 1 ? 1 : 0;
      const active = state.units.filter((u) => !u.roadblock).length;
      if (active < max && state.spawnTimer > 2.2) {
        state.spawnTimer = 0;
        spawnUnit();
      }
      state.roadblockTimer += dt;
      if (state.level >= 3 && state.roadblockTimer > 16 && state.roadblocks.length < 1) {
        state.roadblockTimer = 0;
        spawnRoadblock(player.pos.x, player.pos.z, player.heading, 105);
      }
      if (state.level >= 4 && !state.heli) spawnHeli();
    }
    updateUnits(dt);
    updateHeli(dt, camera);
    api.dispatch = getDispatch();
  }

  function getDispatch() {
    const rows = [];
    for (const u of state.units) {
      const d = Math.hypot(u.v.pos.x - player.pos.x, u.v.pos.z - player.pos.z);
      rows.push({ callsign: u.callsign, dist: d, tactic: u.tactic, police: true });
    }
    if (state.heli) {
      rows.push({ callsign: 'KITE-1', dist: state.heli.dist ?? 0, tactic: 'SPOTLIGHT', heli: true });
    }
    rows.sort((a, b) => a.dist - b.dist);
    return rows;
  }

  function stageShot1(px, pz, heading) {
    clear();
    state.staged = true;
    state.level = 4;
    state.status = 'IN SIGHT';
    const left = addUnit(px - 6.8, pz - 5, heading + 0.1, { callsign: 'PELICANO-11', tactic: 'RAMMING' });
    const right = addUnit(px + 6.9, pz - 6, heading - 0.08, { callsign: 'GAVIOTA-7', tactic: 'RAMMING' });
    for (const u of [left, right]) {
      u.v.kinematic = true;
      u.v.siren = true;
      u.v.ai = null;
    }
    const rb = spawnRoadblock(px, pz, heading, 85);
    rb.units[0].callsign = 'MURO-1';
    rb.units[1].callsign = 'MURO-2';
    spawnHeli();
    state.heli.group.position.set(px + 9, 11, pz - 10);
    state.heli.angle = 0.55;
    state.heli.fixed = { x: px + 9, y: 11, z: pz - 10 };
    state.heli.spotlightOnPlayer = true;
    state.heli.onScreen = true;
    return { left, right, rb };
  }

  function stageShot2(px, pz, heading) {
    clear();
    state.staged = true;
    state.level = 1;
    state.status = 'HIDDEN';
    const u = addUnit(px + Math.sin(heading) * 32, pz + Math.cos(heading) * 32, heading + Math.PI, { callsign: 'DUNA-14', tactic: 'PURSUIT' });
    u.v.kinematic = true;
    u.v.siren = true;
    u.v.ai = null;
    return u;
  }

  function stageShot3(px, pz, heading) {
    clear();
    state.staged = true;
    state.level = 3;
    state.status = 'IN SIGHT';
    const u = addUnit(px + Math.sin(heading) * 12, pz + Math.cos(heading) * 12, heading + Math.PI, { callsign: 'ANCLA-9', tactic: 'FIRING' });
    u.v.kinematic = true;
    u.v.siren = true;
    u.v.ai = null;
    const o1 = peds.spawnOfficer(px + Math.sin(heading) * 9 + Math.cos(heading) * 3, pz + Math.cos(heading) * 9 - Math.sin(heading) * 3, { heading, state: 'police' });
    const o2 = peds.spawnOfficer(px + Math.sin(heading) * 12 - Math.cos(heading) * 4, pz + Math.cos(heading) * 12 + Math.sin(heading) * 4, { heading, state: 'police' });
    o1.shootTimer = 0.05; o2.shootTimer = 0.4;
    u.officers.push(o1, o2);
    return { u, o1, o2 };
  }

  function countNear(pos, radius) {
    return state.units.filter((u) => Math.hypot(u.v.pos.x - pos.x, u.v.pos.z - pos.z) <= radius).length;
  }

  function distances() {
    return state.units.map((u) => Math.hypot(u.v.pos.x - player.pos.x, u.v.pos.z - player.pos.z));
  }

  function unitNear(pos, radius) {
    for (const u of state.units) if (Math.hypot(u.v.pos.x - pos.x, u.v.pos.z - pos.z) < radius) return u;
    return null;
  }

  return api;
}
