// PDC response: wanted stars, chasing cruisers, foot officers, roadblocks and Kite-1.
import * as THREE from 'three';
import { createVehicle, updateVehicle, forward } from './vehicles.js';
import { clamp, angleWrap } from './rng.js';
import { playerMuzzle, damagePlayer } from './player.js';
import * as TEX from './textures.js';

const CALLS = ['PELICANO-11', 'GAVIOTA-7', 'CORAL-48', 'DUNA-14', 'ANCLA-9', 'MURO-1', 'CORAL-85', 'MARLIN-3'];

const BEAM_UP = new THREE.Vector3(0, 1, 0);
export function aimBeam(h, x, z) {
  const from = h.g.position, to = new THREE.Vector3(x, 0.1, z);
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dir = from.clone().sub(to);
  const len = dir.length() || 1;
  h.spot.position.copy(mid);
  h.spot.quaternion.setFromUnitVectors(BEAM_UP, dir.normalize());
  h.spot.scale.set(1, len / 34, 1);
}

function makeHeli(scene) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2b36, roughness: 0.55, metalness: 0.2 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe6e2d6, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 4.2), dark); body.position.y = 0.6; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 1.2), white); nose.position.set(0, 0.55, 2.1); g.add(nose);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.75, 0.9), new THREE.MeshStandardMaterial({ color: 0x24414d, roughness: 0.2, metalness: 0.4 })); glass.position.set(0, 0.75, 1.7); g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 4.2), dark); tail.position.set(0, 0.8, -3.6); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.7), white); fin.position.set(0, 1.2, -5.2); g.add(fin);
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.06, 16), new THREE.MeshBasicMaterial({ color: 0x14181c, transparent: true, opacity: 0.62 }));
  rotor.position.y = 1.5; g.add(rotor);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 5), dark); mast.position.y = 1.2; g.add(mast);
  const trotor = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.04, 10), new THREE.MeshBasicMaterial({ color: 0x14181c, transparent: true, opacity: 0.5 }));
  trotor.rotation.z = Math.PI / 2; trotor.position.set(0.3, 1.0, -5.3); g.add(trotor);
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.7 });
  for (const x of [-0.75, 0.75]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.6), skidMat); s.position.set(x, -0.08, 0.4); g.add(s); }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshStandardMaterial({ color: 0xff4322, emissive: 0xff2200, emissiveIntensity: 7 }));
  beacon.position.set(0, 1.02, -2.4); g.add(beacon);
  const spot = new THREE.Mesh(new THREE.ConeGeometry(9, 34, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  spot.visible = false; scene.add(spot);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshBasicMaterial({ map: TEX.glowTexture(), color: 0xffe6b8, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2; scene.add(pool);
  const light = new THREE.SpotLight(0xffe2b0, 220, 150, 0.28, 0.5, 1.4); scene.add(light); scene.add(light.target);
  g.visible = false; pool.visible = false;
  scene.add(g);
  return { g, rotor, trotor, spot, pool, light, beacon, active: false };
}

export function makeOfficer(scene, x, z) {
  const g = new THREE.Group();
  const uniform = new THREE.MeshStandardMaterial({ color: 0x33465c, roughness: 0.75 });
  const vest = new THREE.MeshStandardMaterial({ color: 0xe8e2cc, roughness: 0.6 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d63, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.66, 0.32), uniform); torso.position.y = 1.16; g.add(torso);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.34), vest); stripe.position.y = 1.28; g.add(stripe);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.33, 0.3), skin); head.position.y = 1.65; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.34), uniform); cap.position.y = 1.84; g.add(cap);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.68, 0.3), uniform); legs.position.y = 0.58; g.add(legs);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.16), uniform); arm.position.set(0.3, 1.15, 0.18); arm.rotation.x = -1.35; g.add(arm);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.34), new THREE.MeshStandardMaterial({ color: 0x22262c, metalness: 0.6, roughness: 0.3 })); gun.position.set(0.3, 1.3, 0.36); g.add(gun);
  g.position.set(x, 0.15, z); scene.add(g);
  return { g, x, z, health: 100, fireT: 0.6 + Math.random(), alive: true, aim: 0 };
}

export class Police {
  constructor(scene, city, fx, audio) {
    this.scene = scene; this.city = city; this.fx = fx; this.audio = audio;
    this.wanted = 0; this.heat = 0; this.units = []; this.officers = []; this.roadblock = null;
    this.heli = makeHeli(scene);
    this.status = 'HIDDEN'; this.searchT = 0; this.decayT = 0; this.tick = 0; this.los = false;
    this.lastSeen = new THREE.Vector3(); this.spawnT = 0; this.msg = '';
    this.playerPos = new THREE.Vector3(); this.playerCar = null;
  }
  setWanted(n) {
    n = clamp(Math.round(n), 0, 5);
    if (n === this.wanted) return;
    this.wanted = n; this.heat = n * 100;
    if (n === 0) this.clear();
    if (n >= 4 && !this.heli.active) this.spawnHeli();
    if (n < 4 && this.heli.active) this.despawnHeli();
    if (n >= 3) this.spawnRoadblock();
    if (n < 3) this.clearRoadblock();
  }
  clear() {
    for (const u of this.units) this.scene.remove(u.v.group);
    this.units = []; this.clearRoadblock(); this.despawnHeli();
    for (const o of this.officers) this.scene.remove(o.g); this.officers = [];
    this.status = 'HIDDEN'; this.searchT = 0; this.decayT = 0;
  }
  crime(type, x, z) {
    const add = type === 'shoot' ? 1 : type === 'ped' ? 2 : type === 'cop' ? 2 : type === 'car' ? 1 : 1;
    if (this.wanted === 0) this.setWanted(Math.min(2, add));
    else this.heat = Math.min(500, this.heat + add * 70);
    this.status = 'IN SIGHT'; this.searchT = 0;
    this.lastSeen.set(x, 0, z);
  }
  spawnUnit(behind = true, dist = 70) {
    const angle = Math.random() * Math.PI * 2;
    const px = (behind ? -Math.sin(angle) : Math.sin(angle)) * dist;
    const pz = (behind ? -Math.cos(angle) : Math.cos(angle)) * dist;
    const x = clamp(this.playerPos.x + px, -1080, 1080), z = clamp(this.playerPos.z + pz, -740, 570);
    const v = createVehicle(this.scene, 'police', { x, z, heading: Math.atan2(this.playerPos.x - x, this.playerPos.z - z), simple: false, siren: true });
    const u = { v, role: this.units.length === 0 ? 'ram' : Math.random() < 0.4 ? 'flank' : 'chase', id: CALLS[this.units.length % CALLS.length], fireT: 1.2 };
    this.units.push(u);
    return u;
  }
  spawnHeli() {
    this.heli.active = true; this.heli.g.visible = true; this.heli.pool.visible = true; this.heli.spot.visible = true;
    this.heli.g.position.set(this.playerPos.x + 34, 26, this.playerPos.z - 8);
    if (this.audio) this.audio.startRotor();
  }
  despawnHeli() {
    this.heli.active = false; this.heli.g.visible = false; this.heli.pool.visible = false; this.heli.spot.visible = false; this.heli.light.intensity = 0;
    if (this.audio) this.audio.stopRotor();
  }
  spawnRoadblock() {
    if (this.roadblock) return;
    const p = this.playerPos;
    const f = this.playerCar ? forward(this.playerCar.heading) : { x: 0, z: -1 };
    const cx = clamp(p.x + f.x * 96, -1000, 1000), cz = clamp(p.z + f.z * 96, -700, 540);
    const h = this.playerCar ? this.playerCar.heading : 0;
    const units = [];
    const group = new THREE.Group();
    for (const s of [-1, 1]) {
      const x = cx + Math.cos(h) * s * 4.2, z = cz - Math.sin(h) * s * 4.2;
      const v = createVehicle(this.scene, 'police', { x, z, heading: h + Math.PI / 2 + s * 0.18, simple: false, siren: true });
      v.speed = 0; v.ai = true; v.roadblock = true; units.push(v); this.units.push({ v, role: 'roadblock', id: CALLS[(this.units.length + 2) % CALLS.length], fireT: 2 });
      for (let i = 0; i < 4; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0xe2692d, emissive: 0x3a1200, emissiveIntensity: 1 }));
        cone.position.set(cx + Math.cos(h) * (i - 1.5) * 2.4, 0.35, cz - Math.sin(h) * (i - 1.5) * 2.4);
        group.add(cone);
      }
    }
    this.scene.add(group);
    this.roadblock = { x: cx, z: cz, units, group, dist: 96 };
  }
  clearRoadblock() {
    if (!this.roadblock) return;
    for (const v of this.roadblock.units) { const i = this.units.findIndex((u) => u.v === v); if (i >= 0) this.units.splice(i, 1); this.scene.remove(v.group); }
    this.scene.remove(this.roadblock.group); this.roadblock = null;
  }
  spawnOfficers(n = 2) {
    const p = this.playerPos;
    for (let i = 0; i < n; i++) {
      if (this.officers.length >= 6) break;
      const a = Math.random() * 6.28, r = 10 + Math.random() * 5;
      const o = makeOfficer(this.scene, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
      o.g.rotation.y = Math.atan2(p.x - o.x, p.z - o.z);
      this.officers.push(o);
    }
  }
  hasLOS(x1, z1, x2, z2) {
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      if (this.city.buildingAt(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false;
    }
    return true;
  }
  update(dt, player, playerCar, audio) {
    this.playerPos = player.inVehicle ? player.inVehicle.pos : player.pos;
    this.playerCar = player.inVehicle;
    const p = this.playerPos;
    if (this.wanted > 0) {
      const dist = Math.hypot(p.x - this.lastSeen.x, p.z - this.lastSeen.z);
      this.los = dist < 62 && this.hasLOS(p.x, p.z, this.lastSeen.x, this.lastSeen.z);
      if (this.los) { this.lastSeen.set(p.x, 0, p.z); this.status = 'IN SIGHT'; this.searchT = 0; }
      else {
        this.searchT += dt;
        if (this.searchT > 3) this.status = 'SEARCHING';
      }
      // stars decay after a clean escape
      if (this.status === 'SEARCHING') {
        this.decayT += dt;
        if (this.decayT > 10) { this.decayT = 0; this.setWanted(this.wanted - 1); this.status = 'SEARCHING'; if (audio) audio.ui(); }
      } else this.decayT = 0;
      // keep the units flowing
      const want = Math.min(6, this.wanted + 1);
      this.spawnT -= dt;
      if (this.units.length < want && this.spawnT <= 0) { this.spawnT = Math.max(0.5, 3.2 - this.wanted * 0.45); this.spawnUnit(true, 85 + Math.random() * 60); }
      if (this.wanted >= 3 && this.officers.length < Math.min(4, this.wanted - 1) && Math.random() < dt * 0.25) this.spawnOfficers(1);
      if (this.wanted >= 3 && !this.roadblock) this.spawnRoadblock();
      if (this.wanted >= 4 && !this.heli.active) this.spawnHeli();
    }
    // cruisers
    for (const u of this.units) {
      const v = u.v;
      if (v.dead) continue;
      if (u.freeze) { updateVehicle(v, dt, { throttle: 0, brake: 1, steer: 0 }, this.city, this.fx, audio); continue; }
      const dx = p.x - v.pos.x, dz = p.z - v.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 360 && u.role !== 'roadblock') { this.scene.remove(v.group); u.dead = true; continue; }
      if (u.role === 'roadblock') { updateVehicle(v, dt, { throttle: 0, brake: 1, steer: 0 }, this.city, this.fx, audio); continue; }
      const want = Math.atan2(dx, dz);
      let dh = angleWrap(want - v.heading);
      const speed = Math.abs(v.speed);
      let steer = clamp(dh * 1.7, -1, 1);
      let throttle = d > 14 ? 1 : 0.25, brake = 0;
      if (d < 7 && speed > 8) { brake = 0.7; throttle = 0; }
      if (u.role === 'ram' && d < 25) { throttle = 1; steer = clamp(dh * 2.2, -1, 1); }
      if (u.role === 'flank') { steer = clamp(dh * 1.4 + 0.35 * Math.sign(dh || 1), -1, 1); }
      if (Math.abs(dh) > 1.2 && speed > 12) throttle = 0.5;
      updateVehicle(v, dt, { throttle, brake, steer, handbrake: false }, this.city, this.fx, audio);
      // officers shoot from close cruisers at 3+
      if (this.wanted >= 3 && d < 32) {
        u.fireT -= dt;
        if (u.fireT <= 0 && this.hasLOS(v.pos.x, v.pos.z, p.x, p.z)) {
          u.fireT = 1.1 + Math.random() * 0.9;
          const m = new THREE.Vector3(v.pos.x, 1.1, v.pos.z);
          this.fx.muzzle(m.x, m.y, m.z, 0.9);
          this.fx.shotTracer(m, new THREE.Vector3(p.x, 1.2, p.z));
          damagePlayer(player, 5 + Math.random() * 6);
          if (audio) audio.shot(false);
        }
      }
    }
    this.units = this.units.filter((u) => !u.dead);
    // foot officers
    for (const o of this.officers) {
      if (!o.alive) continue;
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz);
      o.g.rotation.y = Math.atan2(dx, dz);
      if (d > 4) { o.x += dx / d * dt * 1.6; o.z += dz / d * dt * 1.6; o.g.position.set(o.x, 0.15, o.z); }
      o.fireT -= dt;
      if (o.fireT <= 0 && d < 42 && this.hasLOS(o.x, o.z, p.x, p.z)) {
        o.fireT = 0.9 + Math.random() * 0.7;
        const m = new THREE.Vector3(o.x + dx / d * 0.6, 1.35, o.z + dz / d * 0.6);
        this.fx.muzzle(m.x, m.y, m.z, 0.85);
        this.fx.shotTracer(m, new THREE.Vector3(p.x, 1.2, p.z));
        damagePlayer(player, 7 + Math.random() * 7);
        if (audio) audio.shot(false);
      }
    }
    // roadblock distance
    if (this.roadblock) this.roadblock.dist = Math.hypot(this.roadblock.x - p.x, this.roadblock.z - p.z);
    // helicopter
    if (this.heli.active) {
      const h = this.heli;
      const t = performance.now() / 1000;
      const r = 32, a = t * 0.22;
      h.g.position.set(p.x + Math.cos(a) * r, 24 + Math.sin(t * 0.8) * 1.5, p.z + Math.sin(a) * r);
      h.g.rotation.y = -a + Math.PI / 2;
      h.rotor.rotation.y = t * 24; h.trotor.rotation.x = t * 30;
      h.beacon.material.emissiveIntensity = Math.sin(t * 7) > 0 ? 8 : 1;
      h.light.position.set(p.x, 40, p.z);
      h.light.target.position.set(p.x, 0, p.z);
      h.pool.position.set(p.x, 0.12, p.z);
      h.pool.material.opacity = 0.4 + Math.sin(t * 3) * 0.05;
      aimBeam(h, p.x, p.z);
    }
    if (this.wanted === 0 && this.units.length === 0 && this.officers.length === 0) this.status = 'HIDDEN';
  }
  dispatch() {
    const p = this.playerPos || { x: 0, z: 0 };
    const rows = this.units.map((u) => {
      const d = Math.hypot(u.v.pos.x - p.x, u.v.pos.z - p.z);
      let tactic = u.role === 'roadblock' ? 'ROADBLOCK' : d < 16 ? 'RAMMING' : u.role === 'flank' ? 'FLANKING' : 'CHASE';
      if (u.v.police && this.wanted >= 3 && d < 30) tactic = u.role === 'roadblock' ? 'ROADBLOCK' : 'FIRING';
      return { id: u.id, d, tactic };
    }).sort((a, b) => a.d - b.d);
    if (this.heli.active) rows.push({ id: 'KITE-1', d: Math.hypot(this.heli.g.position.x - p.x, this.heli.g.position.z - p.z), tactic: 'SPOTLIGHT' });
    const officers = this.officers.filter((o) => o.alive).length;
    return { rows, officers, units: this.units.length + (this.heli.active ? 1 : 0) + officers, status: this.status };
  }
  nearest(x, z, max = 12) {
    let best = null, bd = max * max;
    for (const u of this.units) { const dx = u.v.pos.x - x, dz = u.v.pos.z - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = u.v; } }
    return best;
  }
}
