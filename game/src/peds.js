// peds.js — the crowd: merged low-poly bodies in six poses, walking the sidewalks, standing in
// groups, fleeing gunfire and sirens, plus the PDC officers who get out of their cruisers.
import * as THREE from 'three';
import { makeRng, range, pick, chance, clamp } from './rng.js';
import { GeoBatch } from './scene.js';

const SKINS = [0xb9825c, 0x8f5f3f, 0x6f452e, 0xd6a077, 0xa76b48, 0x5c3a28];
const OUTFITS = [
  { shirt: 0xe8ddc6, pants: 0x2f3a44, hat: 0 },
  { shirt: 0xc95545, pants: 0x333333, hat: 0 },
  { shirt: 0x2d8787, pants: 0xd7c8ae, hat: 0 },
  { shirt: 0xd2a03e, pants: 0x3b4652, hat: 0 },
  { shirt: 0x476b8c, pants: 0x22282e, hat: 0 },
  { shirt: 0xe58bad, pants: 0x4a4f57, hat: 0 },
  { shirt: 0x6f8f4f, pants: 0x3a3128, hat: 1 },
  { shirt: 0xf2e3c6, pants: 0x5a4632, hat: 0 },
];

function box(b, x, y, z, w, h, d, color) { b.box(x, y, z, w, h, d, color, 0); }

export function createPeds(scene, city, seed = 4411) {
  const rng = makeRng(seed);
  const peds = [];
  const geoCache = new Map();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  let target = 68;

  const geoFor = (pose, outfitIndex, skinIndex, police) => {
    const key = `${pose}-${outfitIndex}-${skinIndex}-${police ? 1 : 0}`;
    if (geoCache.has(key)) return geoCache.get(key);
    const b = new GeoBatch();
    const outfit = police ? { shirt: 0x466080, pants: 0x232c38, hat: 1 } : OUTFITS[outfitIndex];
    const skin = SKINS[skinIndex];
    const swing = pose === 1 ? 0.18 : pose === 2 ? -0.18 : pose === 3 ? 0.5 : pose === 4 ? -0.5 : 0;
    const aim = pose === 5;
    // legs (front/back offset rather than a rig; the silhouette reads at gameplay distance)
    box(b, -0.12, 0.42, swing * 0.7, 0.18, 0.8, 0.21, outfit.pants);
    box(b, 0.12, 0.42, -swing * 0.7, 0.18, 0.8, 0.21, outfit.pants);
    box(b, -0.12, 0.7, swing * 0.7, 0.19, 0.2, 0.23, outfit.pants);
    box(b, 0.12, 0.7, -swing * 0.7, 0.19, 0.2, 0.23, outfit.pants);
    // torso
    box(b, 0, 1.12, 0, 0.46, 0.58, 0.26, outfit.shirt);
    box(b, 0, 1.4, 0, 0.34, 0.1, 0.28, outfit.shirt);
    // arms
    if (aim) {
      box(b, -0.22, 1.22, 0.28, 0.12, 0.12, 0.62, outfit.shirt);
      box(b, 0.22, 1.22, 0.28, 0.12, 0.12, 0.62, outfit.shirt);
      box(b, 0.22, 1.22, 0.62, 0.09, 0.09, 0.24, 0x2f3338);
    } else {
      box(b, -0.3, 1.16, swing * 0.45, 0.12, 0.56, 0.14, skin);
      box(b, 0.3, 1.16, -swing * 0.45, 0.12, 0.56, 0.14, skin);
      box(b, -0.3, 1.4, swing * 0.45, 0.14, 0.16, 0.16, outfit.shirt);
      box(b, 0.3, 1.4, -swing * 0.45, 0.14, 0.16, 0.16, outfit.shirt);
    }
    // head, hair, face
    box(b, 0, 1.62, 0, 0.27, 0.28, 0.26, skin);
    box(b, 0, 1.78, -0.005, 0.29, 0.1, 0.28, 0x241d1a);
    box(b, 0, 1.64, 0.135, 0.22, 0.05, 0.02, 0x3a2b22);
    if (outfit.hat) {
      box(b, 0, 1.84, 0, 0.3, 0.07, 0.3, police ? 0x1b232c : 0x5a4632);
      box(b, 0, 1.8, 0.17, 0.3, 0.04, 0.14, police ? 0x1b232c : 0x5a4632);
    }
    if (police) {
      box(b, 0, 1.13, 0.15, 0.4, 0.1, 0.04, 0xd8c48a);
      box(b, 0, 1.32, 0.14, 0.12, 0.1, 0.03, 0xd8c48a);
      box(b, 0, 1.18, 0.135, 0.44, 0.06, 0.02, 0xe8e0c8);
      box(b, 0, 1.02, 0.135, 0.44, 0.06, 0.02, 0xe8e0c8);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.norm, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    geo.setIndex(b.idx);
    geo.computeBoundingSphere();
    geoCache.set(key, geo);
    return geo;
  };

  const makePed = (x, z, opts = {}) => {
    const outfit = opts.outfit ?? Math.floor(rng() * OUTFITS.length);
    const skin = opts.skin ?? Math.floor(rng() * SKINS.length);
    const police = Boolean(opts.police);
    const mesh = new THREE.Mesh(geoFor(0, outfit, skin, police), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.2;
    group.add(shadow);
    group.position.set(x, 0, z);
    group.scale.setScalar(opts.scale ?? range(rng, 0.92, 1.06));
    scene.add(group);
    const p = {
      group, mesh, pos: new THREE.Vector3(x, 0, z), heading: opts.heading ?? range(rng, 0, 6.28),
      speed: 0, state: opts.state ?? 'walk', outfit, skin, police, health: police ? 110 : 60,
      alive: true, phase: rng() * 6.28, pose: 0, fleeTimer: 0, shootTimer: range(rng, 0.6, 1.6),
      pathAxis: opts.pathAxis ?? (chance(rng, 0.5) ? 'x' : 'z'), pathFixed: opts.pathFixed ?? 0,
      pathFrom: opts.pathFrom ?? -900, pathTo: opts.pathTo ?? 900, pathDir: chance(rng, 0.5) ? 1 : -1,
      homeX: x, homeZ: z, dead: false, hitFlash: 0, target: null,
    };
    peds.push(p);
    return p;
  };

  const groupAt = (x, z, n, opts = {}) => {
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      out.push(makePed(x + Math.cos(a) * range(rng, 0.4, 1.8), z + Math.sin(a) * range(rng, 0.4, 1.8), {
        ...opts, state: opts.state ?? 'stand', heading: a + Math.PI,
      }));
    }
    return out;
  };

  const spawnAround = (focus) => {
    let guard = 0;
    while (peds.filter((p) => p.alive).length < target && guard < 60) {
      guard += 1;
      let x, z, axis, fixed;
      if (chance(rng, 0.25)) {
        // beach walkers
        x = range(rng, -1000, 1020);
        z = range(rng, 646, 700);
        axis = 'x'; fixed = z;
      } else {
        const lane = pick(rng, city.lanes);
        const t = range(rng, 10, lane.to - lane.from - 10);
        const p = city.lanePoint(lane, t);
        if (Math.hypot(p.x - focus.x, p.z - focus.z) > 150) continue;
        const side = chance(rng, 0.5) ? 1 : -1;
        const off = lane.axis === 'z' ? side * (7.6 + range(rng, 0, 2.4)) : side * (7.6 + range(rng, 0, 2.4));
        x = lane.axis === 'z' ? lane.fixed + off : p.x;
        z = lane.axis === 'z' ? p.z : lane.fixed + off;
        axis = lane.axis === 'x' ? 'x' : 'z';
        fixed = axis === 'x' ? z : x;
        if (city.blocked(x, z, 0.4)) continue;
      }
      const p = makePed(x, z, {
        pathAxis: axis, pathFixed: fixed, pathFrom: axis === 'x' ? -1050 : -760,
        pathTo: axis === 'x' ? 1050 : 630, pathDir: chance(rng, 0.5) ? 1 : -1,
      });
      p.group.position.set(x, 0, z);
    }
  };

  const setPose = (p, pose) => {
    if (p.pose === pose) return;
    p.pose = pose;
    p.mesh.geometry = geoFor(pose, p.outfit, p.skin, p.police);
  };

  const kill = (p) => {
    p.alive = false;
    p.state = 'dead';
    p.speed = 0;
    p.mesh.geometry = geoFor(0, p.outfit, p.skin, p.police);
    p.group.rotation.z = Math.PI / 2;
    p.group.position.y = 0;
  };

  const damage = (p, amount) => {
    if (!p.alive) return;
    p.health -= amount;
    p.hitFlash = 0.2;
    if (p.health <= 0) kill(p);
    else if (!p.police) fleeFrom(p.pos, 30);
  };

  const fleeFrom = (pos, radius = 24) => {
    for (const p of peds) {
      if (!p.alive || p.police || p.state === 'flee') continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < radius) {
        p.state = 'flee';
        p.fleeTimer = 5 + Math.random() * 3;
        const a = Math.atan2(p.pos.x - pos.x, p.pos.z - pos.z);
        p.heading = a;
      }
    }
  };

  const spawnOfficer = (x, z, opts = {}) => makePed(x, z, {
    ...opts, police: true, state: 'police', health: 120,
    outfit: 0, skin: opts.skin ?? 1, heading: opts.heading ?? 0,
  });

  const spawnCrew = (x, z, opts = {}) => {
    const p = makePed(x, z, {
      ...opts, police: false, state: 'crew', health: 90,
      outfit: opts.outfit ?? 3, skin: opts.skin ?? 0, heading: opts.heading ?? 0,
    });
    p.hostile = true;
    p.shootCb = opts.shootCb || null;
    return p;
  };

  const update = (dt, focus, player, policeState) => {
    for (const p of peds) {
      if (!p.alive) {
        p.group.rotation.z = Math.PI / 2;
        p.group.position.y = 0.1;
        continue;
      }
      p.phase += dt * (p.state === 'flee' ? 9 : 4.2);
      let moving = false;
      if (p.state === 'walk') {
        const speed = 1.25;
        p.speed = speed;
        const dir = p.pathDir;
        if (p.pathAxis === 'x') {
          p.pos.x += dir * speed * dt;
          p.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          p.pos.z = p.pathFixed;
          if (p.pos.x > p.pathTo || p.pos.x < p.pathFrom) p.pathDir *= -1;
        } else {
          p.pos.z += dir * speed * dt;
          p.heading = dir > 0 ? 0 : Math.PI;
          p.pos.x = p.pathFixed;
          if (p.pos.z > p.pathTo || p.pos.z < p.pathFrom) p.pathDir *= -1;
        }
        if (city.blocked(p.pos.x, p.pos.z, 0.4)) p.pathDir *= -1;
        moving = true;
      } else if (p.state === 'stand') {
        p.speed = 0;
        p.heading += Math.sin(p.phase * 0.3) * dt * 0.02;
      } else if (p.state === 'flee') {
        p.fleeTimer -= dt;
        p.speed = 4.4;
        const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
        const nx = p.pos.x + fx * p.speed * dt, nz = p.pos.z + fz * p.speed * dt;
        if (!city.blocked(nx, nz, 0.4) && nz < 650) { p.pos.x = nx; p.pos.z = nz; }
        else p.heading += 1.6;
        moving = true;
        if (p.fleeTimer <= 0) p.state = 'walk';
      } else if (p.state === 'police') {
        const d = Math.hypot(player.pos.x - p.pos.x, player.pos.z - p.pos.z);
        const los = !city.segmentBlocked(p.pos.x, p.pos.z, player.pos.x, player.pos.z);
        const a = Math.atan2(player.pos.x - p.pos.x, player.pos.z - p.pos.z);
        p.heading = a;
        if (d > 6 && los && !p.staged) {
          p.speed = 3.2;
          const nx = p.pos.x + Math.sin(a) * p.speed * dt;
          const nz = p.pos.z + Math.cos(a) * p.speed * dt;
          if (!city.blocked(nx, nz, 0.4)) { p.pos.x = nx; p.pos.z = nz; }
          moving = true;
        } else {
          p.speed = 0;
          p.shootTimer -= dt;
          if (policeState && policeState.level >= 3 && los && p.shootTimer <= 0 && d < 42) {
            p.shootTimer = 0.9 + Math.random() * 0.6;
            policeState.officerShoot?.(p, player);
          }
        }
      } else if (p.state === 'crew') {
        const d = Math.hypot(player.pos.x - p.pos.x, player.pos.z - p.pos.z);
        const los = !city.segmentBlocked(p.pos.x, p.pos.z, player.pos.x, player.pos.z);
        const a = Math.atan2(player.pos.x - p.pos.x, player.pos.z - p.pos.z);
        p.heading = a;
        if (d > 7 && los && !p.staged) {
          p.speed = 3.8;
          const nx = p.pos.x + Math.sin(a) * p.speed * dt;
          const nz = p.pos.z + Math.cos(a) * p.speed * dt;
          if (!city.blocked(nx, nz, 0.4)) { p.pos.x = nx; p.pos.z = nz; }
          moving = true;
        } else {
          p.speed = 0;
          p.shootTimer -= dt;
          if (los && p.shootTimer <= 0 && d < 48) {
            p.shootTimer = 0.8 + Math.random() * 0.5;
            p.shootCb?.(p);
          }
        }
      }
      p.group.position.set(p.pos.x, 0, p.pos.z);
      p.group.rotation.y = p.heading;
      if (moving) {
        const pose = p.state === 'flee' ? (Math.sin(p.phase) > 0 ? 3 : 4) : (Math.sin(p.phase) > 0 ? 1 : 2);
        setPose(p, pose);
      } else if (p.state === 'police' && p.speed === 0) {
        setPose(p, 5);
      } else if (p.state === 'crew' && p.speed === 0) {
        setPose(p, 5);
      } else {
        setPose(p, 0);
      }
      if (p.hitFlash > 0) p.hitFlash -= dt;
    }
    // keep the crowd around the player, despawn the ones far away (but never staged ones)
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      const p = peds[i];
      if (!p.alive && p.group.position.y < -10) { peds.splice(i, 1); continue; }
      if (p.staged) continue;
      const d = Math.hypot(p.pos.x - focus.x, p.pos.z - focus.z);
      if (d > 190) {
        scene.remove(p.group);
        peds.splice(i, 1);
      }
    }
    if (peds.filter((p) => p.alive && !p.staged).length < target) spawnAround(focus);
  };

  const countNear = (pos, radius) => peds.filter((p) => p.alive
    && Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) <= radius).length;

  const nearest = (pos, maxDist, filter = null) => {
    let best = null, bestD = maxDist;
    for (const p of peds) {
      if (!p.alive) continue;
      if (filter && !filter(p)) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  };

  const stage = (x, z, opts = {}) => {
    const p = makePed(x, z, opts);
    p.staged = true;
    return p;
  };

  const clearStaged = () => {
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      if (peds[i].staged) { scene.remove(peds[i].group); peds.splice(i, 1); }
    }
  };

  return { peds, update, spawnAround, spawnOfficer, spawnCrew, groupAt, stage, clearStaged, fleeFrom, damage, kill, nearest, countNear, setTarget: (n) => { target = n; } };
}
