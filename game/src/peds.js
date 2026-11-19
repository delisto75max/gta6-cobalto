// Pedestrians on sidewalks and the promenade: instanced bodies, walking, standing and fleeing.
import * as THREE from 'three';
import { RNG, clamp } from './rng.js';
import * as TEX from './textures.js';

const SHIRTS = [0xe4dccb, 0xd07a5c, 0x6e9c94, 0xd8b45c, 0x8a9cb5, 0xb56d7e, 0x5f7f64, 0xded4c0, 0x3e5a6b];
const PANTS = [0x2c3442, 0x3d3a33, 0x4b5566, 0x5d4c3d, 0x252a30];
const SKIN = [0xc98d63, 0x8d5f42, 0xe0b08a, 0x6e4530, 0xd9a273];

export class Peds {
  constructor(scene, city, count = 70) {
    this.scene = scene; this.city = city; this.count = count;
    this.rng = new RNG(0x9e11);
    this.list = [];
    this.paths = city.pedPaths;
    this.parts = [];
    this.parts.push(this.mesh(scene, new THREE.BoxGeometry(0.5, 0.66, 0.3), count)); // torso
    this.parts.push(this.mesh(scene, new THREE.BoxGeometry(0.29, 0.33, 0.29), count)); // head
    this.parts.push(this.mesh(scene, new THREE.BoxGeometry(0.14, 0.52, 0.16), count)); // arm L
    this.parts.push(this.mesh(scene, new THREE.BoxGeometry(0.14, 0.52, 0.16), count)); // arm R
    this.parts.push(this.mesh(scene, new THREE.BoxGeometry(0.18, 0.62, 0.21), count)); // leg L
    this.parts.push(this.mesh(scene, new THREE.BoxGeometry(0.18, 0.62, 0.21), count)); // leg R
    this.shadow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.36, 8), new THREE.MeshBasicMaterial({ map: TEX.glowTexture(), color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }), count);
    this.shadow.frustumCulled = false; scene.add(this.shadow);
    for (let i = 0; i < count; i++) this.spawn(i, 0, 0, true);
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v3 = new THREE.Vector3(); this.s3 = new THREE.Vector3();
  }
  mesh(scene, geo, n) {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.82 }), n);
    m.castShadow = true; m.frustumCulled = false; scene.add(m); return m;
  }
  spawn(i, x, z, wide = false) {
    const path = this.paths[this.rng.int(0, this.paths.length - 1)];
    const t = this.rng.range(path.from, path.to);
    const p = {
      path, t, dir: this.rng.chance(0.5) ? 1 : -1, speed: this.rng.range(0.9, 1.7),
      phase: this.rng.range(0, 6.28), state: wide ? 'walk' : 'walk', flee: 0, heading: 0,
      shirt: SHIRTS[this.rng.int(0, SHIRTS.length - 1)], pants: PANTS[this.rng.int(0, PANTS.length - 1)],
      skin: SKIN[this.rng.int(0, SKIN.length - 1)], scale: this.rng.range(0.88, 1.06),
      x: 0, z: 0, stand: this.rng.chance(0.18),
    };
    if (path.axis === 'z') { p.x = path.at; p.z = t; p.heading = p.dir > 0 ? 0 : Math.PI; }
    else { p.x = t; p.z = path.at; p.heading = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    if (wide) { p.x += this.rng.range(-40, 40); }
    this.list[i] = p;
    const sh = this.shadow;
    const m = new THREE.Matrix4().makeRotationX(-Math.PI / 2); m.setPosition(p.x, 0.07, p.z); sh.setMatrixAt(i, m);
    this.parts[0].setColorAt(i, new THREE.Color(p.shirt));
    this.parts[1].setColorAt(i, new THREE.Color(p.skin));
    this.parts[2].setColorAt(i, new THREE.Color(p.shirt));
    this.parts[3].setColorAt(i, new THREE.Color(p.shirt));
    this.parts[4].setColorAt(i, new THREE.Color(p.pants));
    this.parts[5].setColorAt(i, new THREE.Color(p.pants));
    for (const part of this.parts) if (part.instanceColor) part.instanceColor.needsUpdate = true;
  }
  panic(x, z, radius = 26) {
    for (const p of this.list) {
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) { p.flee = 5 + Math.random() * 3; p.state = 'flee'; }
    }
  }
  update(dt, playerPos, cameraPos) {
    const { m4, q, e, v3, s3 } = this;
    for (let i = 0; i < this.count; i++) {
      const p = this.list[i]; if (!p) continue;
      const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      if (d > 300) { this.spawn(i, 0, 0); continue; }
      if (p.flee > 0) {
        p.flee -= dt;
        if (p.flee <= 0) { p.state = 'walk'; p.speed = this.rng.range(0.9, 1.6); }
        const dx = p.x - playerPos.x, dz = p.z - playerPos.z, len = Math.hypot(dx, dz) || 1;
        p.heading = Math.atan2(dx / len, dz / len);
        p.x += (dx / len) * dt * 4.6; p.z += (dz / len) * dt * 4.6;
        p.phase += dt * 9;
      } else if (p.stand) {
        p.phase += dt * 1.2;
        p.heading += Math.sin(p.phase * 0.4) * dt * 0.3;
      } else {
        p.t += p.dir * p.speed * dt;
        if (p.t > p.path.to || p.t < p.path.from) { p.dir *= -1; p.t = clamp(p.t, p.path.from, p.path.to); }
        if (p.path.axis === 'z') { p.x = p.path.at; p.z = p.t; p.heading = p.dir > 0 ? 0 : Math.PI; }
        else { p.x = p.t; p.z = p.path.at; p.heading = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        p.phase += dt * 4.2 * p.speed;
      }
      const pos = { x: p.x, z: p.z };
      if (this.city.collide(pos, 0.28)) { p.x = pos.x; p.z = pos.z; p.dir *= -1; }
      p.x = clamp(p.x, -1160, 1160); p.z = clamp(p.z, -800, 660);
      const sw = p.state === 'flee' ? Math.sin(p.phase) * 0.9 : Math.sin(p.phase) * 0.55;
      const bob = Math.abs(Math.sin(p.phase)) * 0.03;
      const baseY = 0.15 + bob * p.scale;
      const R = (rot, px, py, pz, sx, sy, sz) => {
        e.set(rot, p.heading, 0); q.setFromEuler(e);
        v3.set(p.x + px, baseY + py, p.z + pz); s3.set(sx * p.scale, sy * p.scale, sz * p.scale);
        m4.compose(v3, q, s3);
        return m4;
      };
      this.parts[0].setMatrixAt(i, R(0, 0, 1.05, 0, 1, 1, 1));
      this.parts[1].setMatrixAt(i, R(0, 0, 1.56, 0, 1, 1, 1));
      this.parts[2].setMatrixAt(i, R(p.state === 'flee' ? -2.4 : sw, -0.32, 1.23, 0, 1, 1, 1));
      this.parts[3].setMatrixAt(i, R(p.state === 'flee' ? -2.4 : -sw, 0.32, 1.23, 0, 1, 1, 1));
      this.parts[4].setMatrixAt(i, R(-sw, -0.14, 0.42, 0, 1, 1, 1));
      this.parts[5].setMatrixAt(i, R(sw, 0.14, 0.42, 0, 1, 1, 1));
      e.set(-Math.PI / 2, 0, 0); q.setFromEuler(e); v3.set(p.x, 0.07, p.z); s3.set(1, 1, 1);
      m4.compose(v3, q, s3); this.shadow.setMatrixAt(i, m4);
    }
    for (const part of this.parts) part.instanceMatrix.needsUpdate = true;
    this.shadow.instanceMatrix.needsUpdate = true;
  }
  near(x, z, radius) {
    let n = 0;
    for (const p of this.list) if (p && Math.hypot(p.x - x, p.z - z) < radius) n++;
    return n;
  }
}
