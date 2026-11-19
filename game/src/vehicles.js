// vehicles.js — the six cars of Bahía Cobalto: their meshes, arcade handling, damage, skid marks,
// police lightbars, and enter/exit. Traffic and the police drive the same objects by setting
// `v.ai`; the player drives one by setting `v.driver = 'player'`.
import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { clamp, damp } from './rng.js';
import { GeoBatch } from './scene.js';

const BODY_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const LIGHT_MAT = new THREE.MeshBasicMaterial({ vertexColors: true });

function buildCarGeometry(def, color, police) {
  const b = new GeoBatch();
  const l = new GeoBatch();
  const w = def.width, L = def.length;
  const body = police ? 0xe9e5d9 : color;
  const dark = 0x1d262c;
  const accent = police ? 0x242a2f : 0x2a3035;
  const wheelR = def.shape === 'bike' ? 0.38 : 0.33;

  if (def.shape === 'bike') {
    b.box(0, 0.62, 0, 0.34, 0.28, 1.55, body, 0);
    b.box(0, 0.82, -0.18, 0.42, 0.18, 0.55, 0x2a3035, 0);
    b.box(0, 0.95, 0.46, 0.18, 0.32, 0.18, 0x333a3f, 0);
    b.box(0, 1.06, 0.46, 0.72, 0.05, 0.06, 0x333a3f, 0);
    b.cylinder(0, wheelR, L * 0.36, wheelR, 0.14, 10, 0x17191c, 'x');
    b.cylinder(0, wheelR, -L * 0.36, wheelR, 0.14, 10, 0x17191c, 'x');
    l.box(0, 0.9, 0.78, 0.16, 0.1, 0.04, 0xfff2c6, 0);
    l.box(0, 0.78, -0.79, 0.12, 0.08, 0.03, 0xff3b30, 0);
  } else {
    const lowerH = def.shape === 'van' ? 0.9 : def.shape === 'suv' ? 0.7 : def.shape === 'sports' ? 0.46 : 0.55;
    const lowerY = def.shape === 'sports' ? 0.38 : def.shape === 'van' ? 0.62 : 0.52;
    b.box(0, lowerY, 0, w, lowerH, L, body, 0);
    if (def.shape === 'van') {
      b.box(0, lowerY + lowerH / 2 + 0.28, -L * 0.02, w * 0.98, 0.24, L * 0.9, body, 0);
    } else {
      const cabL = def.shape === 'sports' ? L * 0.34 : def.shape === 'muscle' ? L * 0.3 : L * 0.42;
      const cabH = def.shape === 'suv' ? 0.62 : 0.5;
      const cabY = lowerY + lowerH / 2 + cabH / 2;
      b.box(0, cabY, -L * 0.06, w * 0.78, cabH, cabL, dark, 0);
      b.box(0, cabY + cabH / 2 + 0.04, -L * 0.06, w * 0.8, 0.08, cabL + 0.08, body, 0);
      // pillars
      b.box(-w * 0.38, cabY, -L * 0.06, 0.08, cabH, cabL, body, 0);
      b.box(w * 0.38, cabY, -L * 0.06, 0.08, cabH, cabL, body, 0);
      // hood and trunk shoulders
      b.box(0, lowerY + lowerH / 2 + 0.06, L * 0.34, w * 0.94, 0.12, L * 0.26, body, 0);
      b.box(0, lowerY + lowerH / 2 + 0.05, -L * 0.4, w * 0.94, 0.12, L * 0.16, body, 0);
      if (def.shape === 'sports' || def.shape === 'muscle') {
        b.box(0, lowerY + 0.12, L * 0.5, w * 0.92, 0.12, 0.2, accent, 0);
        b.box(0, 1.02, -L * 0.49, w * 0.86, 0.06, 0.34, accent, 0);
        b.box(-w * 0.35, 0.9, -L * 0.48, 0.08, 0.3, 0.1, accent, 0);
        b.box(w * 0.35, 0.9, -L * 0.48, 0.08, 0.3, 0.1, accent, 0);
      }
      if (def.shape === 'suv') {
        b.box(0, cabY + cabH / 2 + 0.12, -L * 0.06, w * 0.6, 0.08, cabL * 0.7, accent, 0);
      }
    }
    // bumpers, skirts, wheels
    b.box(0, 0.38, L * 0.49, w * 0.98, 0.24, 0.18, accent, 0);
    b.box(0, 0.38, -L * 0.49, w * 0.98, 0.24, 0.18, accent, 0);
    const wx = w * 0.5 - 0.02;
    const wz = L * 0.31;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.cylinder(sx * wx, wheelR, sz * wz, wheelR, 0.24, 10, 0x17191c, 'x');
      }
    }
    // lamps
    l.box(-w * 0.32, def.shape === 'van' ? 0.82 : 0.66, L * 0.5 + 0.01, 0.28, 0.14, 0.03, 0xfff2c6, 0);
    l.box(w * 0.32, def.shape === 'van' ? 0.82 : 0.66, L * 0.5 + 0.01, 0.28, 0.14, 0.03, 0xfff2c6, 0);
    l.box(-w * 0.34, 0.6, -L * 0.5 - 0.01, 0.24, 0.12, 0.03, 0xff3b30, 0);
    l.box(w * 0.34, 0.6, -L * 0.5 - 0.01, 0.24, 0.12, 0.03, 0xff3b30, 0);
    if (police) {
      // PDC livery: a black belt around the middle and a lightbar on the roof
      b.box(0, 0.72, 0, w + 0.02, 0.32, L * 0.42, 0x22282c, 0);
      b.box(0, 0.72, L * 0.34, w + 0.02, 0.18, L * 0.16, 0x22282c, 0);
      b.box(-w * 0.42, 0.95, -L * 0.02, 0.06, 0.86, 1.5, 0x22282c, 0);
      b.box(w * 0.42, 0.95, -L * 0.02, 0.06, 0.86, 1.5, 0x22282c, 0);
      b.box(0, 0.5, L * 0.53, 0.9, 0.08, 0.1, 0x30363b, 0);
    }
  }

  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  bodyGeo.setAttribute('normal', new THREE.Float32BufferAttribute(b.norm, 3));
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  bodyGeo.setIndex(b.idx);
  bodyGeo.computeBoundingSphere();
  const lightGeo = new THREE.BufferGeometry();
  lightGeo.setAttribute('position', new THREE.Float32BufferAttribute(l.pos, 3));
  lightGeo.setAttribute('normal', new THREE.Float32BufferAttribute(l.norm, 3));
  lightGeo.setAttribute('color', new THREE.Float32BufferAttribute(l.col, 3));
  lightGeo.setIndex(l.idx);
  lightGeo.computeBoundingSphere();
  return { bodyGeo, lightGeo };
}

function buildRider() {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.3), new THREE.MeshLambertMaterial({ color: 0x3f4d5a, flatShading: true }));
  torso.position.set(0, 1.12, -0.08);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), new THREE.MeshLambertMaterial({ color: 0x1e2a33, flatShading: true }));
  head.position.set(0, 1.55, -0.04);
  const arms = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.12), new THREE.MeshLambertMaterial({ color: 0x2b3742, flatShading: true }));
  arms.position.set(0, 1.2, 0.3);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.24), new THREE.MeshLambertMaterial({ color: 0x242c33, flatShading: true }));
  legs.position.set(0, 0.72, -0.16);
  torso.castShadow = true; head.castShadow = true;
  g.add(torso, head, arms, legs);
  return g;
}

export function createVehicles(scene, city, player, world) {
  const list = [];
  const geometryCache = new Map();
  let current = null;
  let nextId = 1;
  const skidGeo = new THREE.PlaneGeometry(1, 1);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x14171a, transparent: true, opacity: 0.5, depthWrite: false });
  const skidMesh = new THREE.InstancedMesh(skidGeo, skidMat, 260);
  skidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  skidMesh.frustumCulled = false;
  scene.add(skidMesh);
  const skidDummy = new THREE.Object3D();
  let skidCursor = 0;
  for (let i = 0; i < 260; i += 1) {
    skidDummy.position.set(0, -100, 0);
    skidDummy.updateMatrix();
    skidMesh.setMatrixAt(i, skidDummy.matrix);
  }

  const addSkid = (x, z, heading) => {
    skidDummy.position.set(x, 0.1, z);
    skidDummy.rotation.set(-Math.PI / 2, 0, -heading);
    skidDummy.scale.set(0.26, 1.5, 1);
    skidDummy.updateMatrix();
    skidMesh.setMatrixAt(skidCursor, skidDummy.matrix);
    skidCursor = (skidCursor + 1) % 260;
    skidMesh.instanceMatrix.needsUpdate = true;
  };

  const geometryFor = (def, color, police) => {
    const key = `${def.id}-${color}-${police ? 1 : 0}`;
    if (!geometryCache.has(key)) geometryCache.set(key, buildCarGeometry(def, color, police));
    return geometryCache.get(key);
  };

  const spawn = (type, x, z, heading = 0, opts = {}) => {
    const def = VEHICLES[type] || VEHICLES.cangrejo;
    const color = opts.color ?? def.colors[0];
    const police = Boolean(opts.police);
    const { bodyGeo, lightGeo } = geometryFor(def, color, police);
    const group = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, BODY_MAT);
    body.castShadow = true;
    body.receiveShadow = true;
    const lights = new THREE.Mesh(lightGeo, LIGHT_MAT);
    group.add(body, lights);
    let rider = null;
    if (def.shape === 'bike' && !opts.noRider) {
      rider = buildRider();
      group.add(rider);
    }
    const v = {
      id: nextId++, type, def, color, group, body, lights, rider,
      pos: new THREE.Vector3(x, 0.02, z),
      heading, speed: 0, steer: 0, slip: 0,
      health: def.health, maxHealth: def.health,
      driver: opts.driver ?? 'ai', ai: null, kinematic: Boolean(opts.kinematic),
      lane: null, laneS: 0, laneSpeed: 11, custom: Boolean(opts.custom),
      police, callsign: opts.callsign || null, siren: police,
      dead: false, damageTimer: 0, skidTimer: 0, smokeTimer: 0,
      lightbar: null, occupied: Boolean(opts.driver),
      isPlayer: false,
    };
    group.position.copy(v.pos);
    group.rotation.y = heading;
    {
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.07;
      shadow.scale.set(def.width + 0.6, def.length + 0.8, 1);
      group.add(shadow);
    }
    if (opts.driver === 'player' || police) {
      const lamp = sharedGlow();
      for (const spec of [
        [-def.width * 0.32, 0.72, -def.length / 2 - 0.08, 0xff3b30, 1.1],
        [def.width * 0.32, 0.72, -def.length / 2 - 0.08, 0xff3b30, 1.1],
        [-def.width * 0.3, 0.72, def.length / 2 + 0.08, 0xfff0c0, 0.9],
        [def.width * 0.3, 0.72, def.length / 2 + 0.08, 0xfff0c0, 0.9],
      ]) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: lamp, color: spec[3], transparent: true, opacity: 0.7,
          depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        sp.position.set(spec[0], spec[1], spec[2]);
        sp.scale.set(spec[4], spec[4], 1);
        group.add(sp);
      }
    }
    scene.add(group);

    if (police) {
      const redMat = new THREE.MeshBasicMaterial({ color: 0xff2b2b });
      const blueMat = new THREE.MeshBasicMaterial({ color: 0x2b6bff });
      const barW = def.width * 0.28;
      const barR = new THREE.Mesh(new THREE.BoxGeometry(barW, 0.09, 0.18), redMat);
      const barB = new THREE.Mesh(new THREE.BoxGeometry(barW, 0.09, 0.18), blueMat);
      const roofY = def.shape === 'van' ? 2.25 : 1.52;
      barR.position.set(-barW * 0.58, roofY, -0.08);
      barB.position.set(barW * 0.58, roofY, -0.08);
      group.add(barR, barB);

      const flare = (col) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: sharedGlow(), color: col, transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        s.position.set(0, roofY + 0.18, -0.08);
        s.scale.set(2.2, 2.2, 1);
        group.add(s);
        return s;
      };
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(8.2, 5.2),
        new THREE.MeshBasicMaterial({ map: lightPoolTexture(), color: 0xff3344, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(0, 0.075, 0);
      group.add(pool);

      v.lightbar = {
        redMat, blueMat, barR, barB,
        flareR: flare(0xff3030), flareB: flare(0x3a74ff),
        poolMat: pool.material, phase: Math.random() * 6,
      };
    }

    list.push(v);
    return v;
  };

  const remove = (v) => {
    const i = list.indexOf(v);
    if (i >= 0) list.splice(i, 1);
    scene.remove(v.group);
    if (v === current) current = null;
  };

  const nearest = (pos, maxDist = 4, filter = null) => {
    let best = null, bestD = maxDist;
    for (const v of list) {
      if (v.dead) continue;
      if (filter && !filter(v)) continue;
      const d = Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  };

  const countNear = (pos, radius) => list.filter((v) => !v.police && !v.dead
    && Math.hypot(v.pos.x - pos.x, v.pos.z - pos.z) <= radius).length;

  const enter = (v) => {
    if (!v || v.dead || current) return false;
    v.driver = 'player';
    v.isPlayer = true;
    v.kinematic = false;
    v.ai = null;
    if (v.rider) v.rider.visible = false;
    player.visible = false;
    player.group.visible = false;
    player.vehicle = v;
    current = v;
    return true;
  };

  const exit = () => {
    const v = current;
    if (!v) return false;
    const sideX = Math.cos(v.heading), sideZ = -Math.sin(v.heading);
    let px = v.pos.x + sideX * (v.def.width / 2 + 0.9);
    let pz = v.pos.z + sideZ * (v.def.width / 2 + 0.9);
    if (city.blocked(px, pz, 0.5)) { px = v.pos.x - sideX * (v.def.width / 2 + 0.9); pz = v.pos.z - sideZ * (v.def.width / 2 + 0.9); }
    if (city.blocked(px, pz, 0.5)) { px = v.pos.x; pz = v.pos.z + 2; }
    player.pos.set(px, 0, pz);
    player.heading = v.heading + Math.PI / 2;
    player.visible = true;
    player.vehicle = null;
    v.isPlayer = false;
    v.driver = 'ai';
    v.speed *= 0.2;
    current = null;
    return true;
  };

  const damage = (v, amount, source = 'hit') => {
    if (!v || v.dead) return;
    v.health -= amount;
    v.damageTimer = 0.6;
    if (v.health <= 0) {
      v.health = 0;
      v.dead = true;
      const p = v.pos.clone(); p.y = 1;
      world.fx.spark(p, 0xffb347, 26);
      world.fx.smoke(p, 0x2b2b2b, 18);
      v.group.visible = false;
      if (v.isPlayer) { player.takeDamage(55); exit(); }
      if (v.police) v.siren = false;
    }
  };

  const updateLights = (v, dt) => {
    if (!v.lightbar) return;
    const lb = v.lightbar;
    lb.phase += dt * 7.2;
    const red = Math.sin(lb.phase) > 0;
    lb.redMat.color.setHex(v.siren && red ? 0xff2b2b : 0x3d1010);
    lb.blueMat.color.setHex(v.siren && !red ? 0x2b6bff : 0x0d1a3d);
    lb.flareR.material.opacity = v.siren && red ? 0.75 : 0;
    lb.flareB.material.opacity = v.siren && !red ? 0.7 : 0;
    lb.poolMat.color.setHex(v.siren && red ? 0xff3344 : 0x2b6bff);
    lb.poolMat.opacity = v.siren ? 0.2 : 0.05;
  };

  const physics = (v, dt) => {
    let throttle = 0, steerIn = 0;
    if (v.driver === 'player') {
      throttle = v.throttle ?? 0;
      steerIn = v.steerIn ?? 0;
    } else if (v.ai) {
      throttle = v.ai.throttle ?? 0;
      steerIn = v.ai.steer ?? 0;
    }
    const def = v.def;
    const top = def.top;
    const prevSpeed = v.speed;

    if (throttle > 0) v.speed += def.accel * throttle * dt;
    else if (throttle < 0) {
      if (v.speed > 0.4) v.speed -= def.brake * dt;
      else v.speed -= def.accel * 0.55 * dt;
    } else {
      v.speed -= v.speed * def.drag * dt;
    }
    if (v.brake) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), def.brake * 0.9 * dt);
    v.speed = clamp(v.speed, -top * 0.3, top);
    if (Math.abs(v.speed) < 0.06 && throttle === 0) v.speed = 0;

    const speedFactor = clamp(Math.abs(v.speed) / 7, 0, 1);
    const steerRate = def.steer * speedFactor * (1 - 0.42 * Math.min(1, Math.abs(v.speed) / top));
    const steerTarget = steerIn * steerRate;
    v.steer = damp(v.steer, steerTarget, 9, dt);
    v.heading += v.steer * dt * Math.sign(v.speed || 1) * Math.min(1, Math.abs(v.speed) / 3);

    // handbrake drift: the car keeps a little sideways momentum
    if (v.brake && Math.abs(v.speed) > 4) {
      v.slip = damp(v.slip, -steerIn * Math.abs(v.speed) * 0.16, 4, dt);
      v.speed *= 1 - 0.8 * dt;
    } else {
      v.slip = damp(v.slip, 0, 6, dt);
    }

    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const rx = Math.cos(v.heading), rz = -Math.sin(v.heading);
    const nx = v.pos.x + (fx * v.speed + rx * v.slip) * dt;
    const nz = v.pos.z + (fz * v.speed + rz * v.slip) * dt;

    const hit = city.blocked(nx + fx * 1.4, nz + fz * 1.4, v.def.width * 0.45)
      || city.blocked(nx - fx * 1.4, nz - fz * 1.4, v.def.width * 0.45);
    if (hit) {
      if (Math.abs(v.speed) > 7) damage(v, Math.abs(v.speed) * 0.7, 'wall');
      v.speed *= -0.22;
      v.slip *= -0.3;
      world.fx.spark(new THREE.Vector3(v.pos.x + fx * 2, 1, v.pos.z + fz * 2), 0xffc66b, 5);
    } else if (nz > 646 || nz < -778 || nx < -1080 || nx > 1080) {
      v.speed *= -0.3;
      player.shake = 0.2;
    } else {
      v.pos.x = nx;
      v.pos.z = nz;
    }

    if (v.brake && Math.abs(v.speed) > 8) {
      v.skidTimer -= dt;
      if (v.skidTimer <= 0) {
        v.skidTimer = 0.045;
        const bx = v.pos.x - fx * v.def.length * 0.3;
        const bz = v.pos.z - fz * v.def.length * 0.3;
        addSkid(bx - rx * v.def.width * 0.36, bz - rz * v.def.width * 0.36, v.heading);
        addSkid(bx + rx * v.def.width * 0.36, bz + rz * v.def.width * 0.36, v.heading);
      }
    }

    if (v.health < 45) {
      v.smokeTimer -= dt;
      if (v.smokeTimer <= 0) {
        v.smokeTimer = 0.14;
        world.fx.smoke(new THREE.Vector3(v.pos.x - fx * 1.6, 1.2, v.pos.z - fz * 1.6), 0x55524c, 2);
      }
    }

    v.group.position.set(v.pos.x, 0.02, v.pos.z);
    v.group.rotation.y = v.heading;
    v.body.rotation.z = -v.steer * 0.06 * clamp(Math.abs(v.speed) / 18, 0, 1);
    if (v.impact) v.impact -= dt * 4;
    updateLights(v, dt);
  };

  const update = (dt, input) => {
    for (const v of list) {
      if (v.dead) continue;
      if (v.driver === 'player') {
        v.throttle = input.forward ? 1 : input.back ? -1 : 0;
        v.steerIn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
        v.brake = Boolean(input.handbrake);
      } else if (v.kinematic) {
        v.group.position.set(v.pos.x, 0.02, v.pos.z);
        v.group.rotation.y = v.heading;
        if (v.police) updateLights(v, dt);
        continue;
      }
      physics(v, dt);
    }
    // dynamic vehicle collisions (police, player, parked cars)
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      if (a.dead || a.kinematic) continue;
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j];
        if (b.dead || b.kinematic) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const min = (a.def.length + b.def.length) * 0.31;
        const d = Math.hypot(dx, dz);
        if (d > 0.001 && d < min) {
          const push = (min - d) * 0.5;
          const ux = dx / d, uz = dz / d;
          a.pos.x -= ux * push; a.pos.z -= uz * push;
          b.pos.x += ux * push; b.pos.z += uz * push;
          const rel = Math.abs(a.speed - b.speed);
          if (rel > 8) { damage(a, rel * 0.35, 'car'); damage(b, rel * 0.35, 'car'); }
          a.speed *= 0.6; b.speed *= 0.6;
        }
      }
    }
    // a player's car keeps its body in sync after collisions
    if (current) {
      current.group.position.set(current.pos.x, 0.02, current.pos.z);
      current.group.rotation.y = current.heading;
    }
  };

  const spotOn = (x, z, focus) => {
    const d = Math.hypot(x - focus.x, z - focus.z);
    return d < 700;
  };

  return {
    list, spawn, remove, nearest, countNear, enter, exit, damage, update, addSkid, spotOn,
    get playerVehicle() { return current; },
    get current() { return current; },
    set current(v) { current = v; },
    geometryCache,
  };
}

let glowTexture = null;
function sharedGlow() {  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

let poolTexture = null;
function lightPoolTexture() {
  if (poolTexture) return poolTexture;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 32, 0, 64, 32, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 64);
  poolTexture = new THREE.CanvasTexture(c);
  poolTexture.colorSpace = THREE.SRGBColorSpace;
  return poolTexture;
}
