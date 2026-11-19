// combat.js — the guns: ray hits against people, cars, walls and the radio mast; tracers, muzzle
// flashes, impact sparks, casings, wall decals and pickups. It also owns reloads and the small
// crime hooks that wake the police.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp, range } from './rng.js';

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = ox - cx, ly = oy - cy, lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

export function createCombat(scene, city, vehicles, peds, player, world, police) {
  const state = {
    shotsFired: 0,
    lastPlayerShot: -10,
    lastNpcShot: -10,
    time: 0,
    tracers: [],
    pickups: [],
    decals: [],
    reloadTimer: 0,
    fireTimer: 0,
    crimeCooldown: 0,
  };

  // one dynamic line buffer for every tracer
  const MAX_SEG = 96;
  const tracerPos = new Float32Array(MAX_SEG * 6);
  const tracerCol = new Float32Array(MAX_SEG * 6);
  const tracerLife = new Float32Array(MAX_SEG);
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3));
  tracerGeo.setAttribute('color', new THREE.BufferAttribute(tracerCol, 3));
  const tracerLines = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }));
  tracerLines.frustumCulled = false;
  scene.add(tracerLines);
  let tracerCursor = 0;

  const decalGeo = new THREE.CircleGeometry(0.09, 7);
  const decalMat = new THREE.MeshBasicMaterial({ color: 0x14171a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const decalMesh = new THREE.InstancedMesh(decalGeo, decalMat, 48);
  decalMesh.frustumCulled = false;
  scene.add(decalMesh);
  const decalDummy = new THREE.Object3D();
  let decalCursor = 0;
  for (let i = 0; i < 48; i += 1) { decalDummy.position.set(0, -50, 0); decalDummy.updateMatrix(); decalMesh.setMatrixAt(i, decalDummy.matrix); }

  const addTracer = (from, to, color = 0xffe3a6) => {
    const i = tracerCursor;
    tracerCursor = (tracerCursor + 1) % MAX_SEG;
    tracerPos[i * 6] = from.x; tracerPos[i * 6 + 1] = from.y; tracerPos[i * 6 + 2] = from.z;
    tracerPos[i * 6 + 3] = to.x; tracerPos[i * 6 + 4] = to.y; tracerPos[i * 6 + 5] = to.z;
    const c = new THREE.Color(color);
    tracerCol[i * 6] = c.r; tracerCol[i * 6 + 1] = c.g; tracerCol[i * 6 + 2] = c.b;
    tracerCol[i * 6 + 3] = c.r; tracerCol[i * 6 + 4] = c.g; tracerCol[i * 6 + 5] = c.b;
    tracerLife[i] = 0.09;
    tracerGeo.attributes.position.needsUpdate = true;
    tracerGeo.attributes.color.needsUpdate = true;
  };

  const addDecal = (point, normalY = false) => {
    decalDummy.position.copy(point);
    if (!normalY) { decalDummy.position.y = Math.max(0.1, point.y); }
    else decalDummy.position.y = Math.max(0.1, decalDummy.position.y);
    decalDummy.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
    decalDummy.scale.setScalar(range(Math.random, 0.7, 1.5));
    decalDummy.updateMatrix();
    decalMesh.setMatrixAt(decalCursor, decalDummy.matrix);
    decalCursor = (decalCursor + 1) % 48;
    decalMesh.instanceMatrix.needsUpdate = true;
  };

  const hitScan = (origin, dir, maxDist) => {
    let best = { t: maxDist, kind: 'air', ped: null, vehicle: null };
    for (const p of peds.peds) {
      if (!p.alive) continue;
      const t = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, p.pos.x, 1.0, p.pos.z, p.police ? 0.48 : 0.42);
      if (t !== null && t < best.t) best = { t, kind: 'ped', ped: p, vehicle: null };
    }
    for (const v of vehicles.list) {
      if (v.dead) continue;
      if (v === vehicles.playerVehicle) continue;
      const t = raySphere(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, v.pos.x, 0.9, v.pos.z, Math.max(1.2, v.def.length * 0.45));
      if (t !== null && t < best.t) best = { t, kind: 'vehicle', vehicle: v, ped: null };
    }
    // the radio mast is a mission target, not a building in the collision grid
    if (!world.mastDown) {
      const m = city.mast;
      for (let t = 2; t < Math.min(best.t, 180); t += 2) {
        const px = origin.x + dir.x * t;
        const py = origin.y + dir.y * t;
        const pz = origin.z + dir.z * t;
        if (Math.abs(px - m.x) < 4.2 && Math.abs(pz - m.z) < 4.2 && py > 0 && py < m.h + 4) {
          if (t < best.t) best = { t, kind: 'mast', ped: null, vehicle: null };
          break;
        }
      }
    }
    // buildings: march the ray in two-metre steps
    const step = 1.7;
    for (let t = 1.5; t < Math.min(best.t, 160); t += step) {
      const px = origin.x + dir.x * t;
      const py = origin.y + dir.y * t;
      const pz = origin.z + dir.z * t;
      if (py < 0.12) {
        if (t < best.t) best = { t, kind: 'ground', ped: null, vehicle: null };
        break;
      }
      const b = city.blocked(px, pz, 0.12);
      if (b && py < b.h) {
        if (t < best.t) best = { t, kind: 'wall', ped: null, vehicle: null };
        break;
      }
    }
    return best;
  };

  const currentWeapon = () => WEAPONS[player.weapon] || WEAPONS[1];

  const reload = () => {
    const idx = player.weapon;
    const def = WEAPONS[idx];
    if (!def || def.mag === 0) return;
    const have = player.reserve[idx] || 0;
    if (have <= 0 || player.mag[idx] >= def.mag || player.reloading > 0) return;
    player.reloading = def.reload;
    state.reloadTimer = def.reload;
    // audio is triggered by main through the reloading flag
  };

  const switchWeapon = (slot) => {
    if (slot < 0 || slot >= WEAPONS.length) return false;
    if (slot > 0 && !player.unlocked[slot]) return false;
    if (player.reloading > 0) return false;
    player.weapon = slot;
    state.fireTimer = 0;
    return true;
  };

  const finishReload = () => {
    const idx = player.weapon;
    const def = WEAPONS[idx];
    if (!def || def.mag === 0) return;
    const need = def.mag - player.mag[idx];
    const give = Math.min(need, player.reserve[idx] || 0);
    player.mag[idx] += give;
    player.ammo[idx] = player.mag[idx];
    player.reserve[idx] -= give;
  };

  const fire = (camera, opts = {}) => {
    if (player.dead) return null;
    if (state.fireTimer > 0 || player.reloading > 0) return null;
    const idx = player.weapon;
    const def = WEAPONS[idx];
    if (!def) return null;
    if (def.mag > 0 && player.mag[idx] <= 0) { reload(); return null; }
    state.fireTimer = def.rate;
    state.shotsFired += 1;
    state.lastPlayerShot = state.time;
    if (def.mag > 0) {
      player.mag[idx] -= 1;
      player.ammo[idx] = player.mag[idx];
    }

    const origin = new THREE.Vector3();
    if (vehicles.playerVehicle) {
      const v = vehicles.playerVehicle;
      origin.set(v.pos.x, 1.3, v.pos.z);
    } else {
      origin.copy(player.muzzleWorld());
    }
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    if (opts.spread) {
      dir.x += (Math.random() - 0.5) * opts.spread;
      dir.y += (Math.random() - 0.5) * opts.spread;
      dir.z += (Math.random() - 0.5) * opts.spread;
      dir.normalize();
    }
    const pellets = def.pellets || 1;
    for (let p = 0; p < pellets; p += 1) {
      const d = dir.clone();
      if (def.spread) {
        d.x += (Math.random() - 0.5) * def.spread;
        d.y += (Math.random() - 0.5) * def.spread;
        d.z += (Math.random() - 0.5) * def.spread;
        d.normalize();
      }
      const hit = hitScan(origin, d, def.range || 120);
      const point = origin.clone().addScaledVector(d, Math.min(hit.t, def.range || 120));
      addTracer(origin, point, idx === 4 ? 0xffd08a : 0xffe3b0);
      world.fx.flash(origin, idx === 4 ? 2.0 : 0.9);
      world.fx.spark(origin, 0xffc66b, 1);
      if (hit.kind === 'ped') {
        const dmg = def.damage * (idx === 4 ? 0.4 : 1);
        peds.damage(hit.ped, dmg);
        world.fx.blood(point);
        addDecal(point, true);
        if (!police.state.staged) {
          if (hit.ped.police) police.commit(1, 'officer down');
          else if (!hit.ped.alive) police.commit(2, 'civilian down');
          else police.commit(1, 'shots fired');
        }
      } else if (hit.kind === 'vehicle') {
        vehicles.damage(hit.vehicle, def.damage * 0.55, 'bullet');
        world.fx.spark(point, 0xffd28a, 5);
        addDecal(point, true);
        if (!police.state.staged && hit.vehicle.police) police.commit(1, 'cruiser hit');
      } else if (hit.kind === 'mast') {
        city.mast.health -= def.damage;
        world.fx.spark(point, 0xffd28a, 6);
        if (city.mast.health <= 0 && !world.mastDown) {
          world.mastDown = true;
          world.mastLight.visible = false;
          for (let i = 0; i < 5; i += 1) world.fx.smoke(new THREE.Vector3(city.mast.x, 10 + i * 10, city.mast.z), 0x2b2b2b, 8);
        }
      } else if (hit.kind === 'wall') {
        world.fx.spark(point, 0xffcf8a, 4);
        addDecal(point, false);
      } else if (hit.kind === 'ground') {
        world.fx.dust(point, 0xcbb99c, 4);
      }
    }
    if (def.sound !== 'punch' && !police.state.staged) {
      state.crimeCooldown -= state.time - (state.lastCrimeAt || state.time);
      state.lastCrimeAt = state.time;
      if (state.crimeCooldown <= 0) {
        state.crimeCooldown = 7;
        police.commit(1, 'disparos en la calle');
      }
    }
    return true;
  };

  const npcShot = (from, to, accuracy = 0.55, damage = 7) => {
    state.lastNpcShot = state.time;
    addTracer(from, to, 0xffb35c);
    world.fx.flash(from, 1.1, 0xffb35c);
    world.fx.spark(to, 0xffb35c, 3);
    if (Math.random() < accuracy) {
      player.takeDamage(damage);
      player.shake = Math.min(0.6, player.shake + 0.08);
    }
  };

  const addPickup = (type, x, z) => {
    let color = 0x6fdd8a;
    if (type === 'armour') color = 0x5fb4ff;
    if (type === 'cash') color = 0xffcf6b;
    const g = new THREE.Group();
    if (type === 'health') {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.16), new THREE.MeshBasicMaterial({ color }));
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), new THREE.MeshBasicMaterial({ color }));
      g.add(a, b);
    } else if (type === 'armour') {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 6), new THREE.MeshBasicMaterial({ color })));
    } else {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.24), new THREE.MeshBasicMaterial({ color })));
    }
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.55;
    g.add(halo);
    g.position.set(x, 1.0, z);
    scene.add(g);
    const item = { type, group: g, x, z, phase: Math.random() * 6, life: 60 };
    state.pickups.push(item);
    return item;
  };

  const update = (dt) => {
    state.time += dt;
    state.fireTimer = Math.max(0, state.fireTimer - dt);
    if (player.reloading > 0) {
      player.reloading -= dt;
      if (player.reloading <= 0) finishReload();
    }
    for (let i = 0; i < MAX_SEG; i += 1) {
      if (tracerLife[i] <= 0) continue;
      tracerLife[i] -= dt;
      if (tracerLife[i] <= 0) {
        tracerPos[i * 6 + 3] = tracerPos[i * 6];
        tracerPos[i * 6 + 4] = tracerPos[i * 6 + 1];
        tracerPos[i * 6 + 5] = tracerPos[i * 6 + 2];
        tracerGeo.attributes.position.needsUpdate = true;
      }
    }
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const p = state.pickups[i];
      p.phase += dt;
      p.life -= dt;
      p.group.position.y = 1.0 + Math.sin(p.phase * 2.4) * 0.12;
      p.group.rotation.y += dt * 1.4;
      const d = Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
      if (d < 1.8 && !player.dead) {
        if (p.type === 'health') player.health = Math.min(player.maxHealth, player.health + 35);
        if (p.type === 'armour') player.armour = Math.min(player.maxArmour, player.armour + 30);
        if (p.type === 'cash') player.cashPickup = (player.cashPickup || 0) + 40;
        scene.remove(p.group);
        state.pickups.splice(i, 1);
        continue;
      }
      if (p.life <= 0) { scene.remove(p.group); state.pickups.splice(i, 1); }
    }
  };

  return {
    state, fire, npcShot, reload, switchWeapon, addPickup, update, hitScan,
    get lastPlayerShot() { return state.lastPlayerShot; },
    get lastNpcShot() { return state.lastNpcShot; },
    get shotsFired() { return state.shotsFired; },
  };
}
