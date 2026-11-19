// Weapons, ray hits, tracers, damage and pickups.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { playerMuzzle, damagePlayer } from './player.js';

const ORDER = ['fists', 'vesper', 'mako', 'breaker'];

export class Combat {
  constructor(scene, camera, fx, audio) {
    this.scene = scene; this.camera = camera; this.fx = fx; this.audio = audio;
    this.ray = new THREE.Raycaster();
    this.pickups = [];
    this.shake = 0;
    this.tmp = new THREE.Vector3(); this.tmp2 = new THREE.Vector3(); this.dir = new THREE.Vector3();
  }
  ensure(player) {
    if (!player.unlocked) player.unlocked = { fists: true, vesper: true, mako: false, breaker: false };
    if (!player.ammo) player.ammo = { vesper: 12, mako: 30, breaker: 8 };
    if (!player.reserve) player.reserve = { vesper: 96, mako: 180, breaker: 48 };
  }
  switchTo(player, slot) {
    const w = ORDER[slot - 1];
    if (!w) return;
    if (w !== 'fists' && !player.unlocked[w]) return;
    player.weapon = w; player.reload = 0;
  }
  cycle(player, d) {
    this.ensure(player);
    let i = ORDER.indexOf(player.weapon);
    for (let k = 0; k < 4; k++) {
      i = (i + d + 4) % 4;
      if (ORDER[i] === 'fists' || player.unlocked[ORDER[i]]) { player.weapon = ORDER[i]; return; }
    }
  }
  reload(player) {
    this.ensure(player);
    const w = WEAPONS[player.weapon];
    if (!w || w.melee) return;
    if (player.ammo[player.weapon] >= w.mag || player.reserve[player.weapon] <= 0) return;
    player.reload = 1.15;
  }
  finishReload(player) {
    const w = WEAPONS[player.weapon];
    if (!w || w.melee) return;
    const need = w.mag - player.ammo[player.weapon];
    const take = Math.min(need, player.reserve[player.weapon]);
    player.ammo[player.weapon] += take; player.reserve[player.weapon] -= take;
  }
  fire(player, police, peds, traffic, city) {
    this.ensure(player);
    const w = WEAPONS[player.weapon];
    if (!w || player.fireCd > 0) return null;
    if (w.melee) {
      player.fireCd = w.rate; player.recoil = 1;
      const f = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
      const hit = police.officers.find((o) => o.alive && Math.hypot(o.x - player.pos.x, o.z - player.pos.z) < 2.4);
      if (hit) { hit.health -= w.dmg; this.fx.impact(hit.x, 1.2, hit.z, 4, [1, 0.3, 0.2]); police.crime('cop', player.pos.x, player.pos.z); }
      return { melee: true };
    }
    if (player.reload > 0) return null;
    if (player.ammo[player.weapon] <= 0) { this.reload(player); return null; }
    player.ammo[player.weapon]--;
    player.fireCd = w.rate; player.recoil = 1; this.shake = Math.max(this.shake, 0.7);
    const muzzle = playerMuzzle(player);
    this.camera.getWorldDirection(this.dir);
    const aim = this.tmp.copy(this.camera.position).addScaledVector(this.dir, 90);
    const dir = this.tmp2.copy(aim).sub(muzzle).normalize();
    const pellets = w.pellets || 1;
    let anyHit = null;
    for (let i = 0; i < pellets; i++) {
      const d = dir.clone();
      const sp = w.spread || 0.01;
      d.x += (Math.random() - 0.5) * sp * 2; d.y += (Math.random() - 0.5) * sp * 1.2; d.z += (Math.random() - 0.5) * sp * 2;
      d.normalize();
      const hit = this.trace(muzzle, d, w.range, police, peds, traffic, city);
      if (hit) { if (!anyHit || hit.t < anyHit.t) anyHit = hit; }
      const end = hit ? hit.point : muzzle.clone().addScaledVector(d, 80);
      this.fx.shotTracer(muzzle, end);
    }
    this.fx.muzzle(muzzle.x, muzzle.y, muzzle.z, 1);
    if (this.audio) this.audio.shot(true);
    if (anyHit) this.applyHit(anyHit, w, player, police, peds, traffic);
    else police.crime('shoot', player.pos.x, player.pos.z);
    if (peds) peds.panic(player.pos.x, player.pos.z, 40);
    return anyHit;
  }
  trace(origin, dir, range, police, peds, traffic, city) {
    let best = null;
    const test = (x, y, z, r, obj, type) => {
      const ox = x - origin.x, oy = y - origin.y, oz = z - origin.z;
      const t = ox * dir.x + oy * dir.y + oz * dir.z;
      if (t < 0 || t > range) return;
      const cx = origin.x + dir.x * t, cy = origin.y + dir.y * t, cz = origin.z + dir.z * t;
      const d = Math.hypot(x - cx, y - cy, z - cz);
      if (d < r && (!best || t < best.t)) best = { t, point: new THREE.Vector3(cx, cy, cz), obj, type };
    };
    for (const u of police.units) if (!u.v.dead) test(u.v.pos.x, 0.85, u.v.pos.z, 1.7, u.v, 'car');
    for (const o of police.officers) if (o.alive) test(o.x, 1.15, o.z, 0.48, o, 'cop');
    for (const p of peds.list) if (p) test(p.x, 1.05, p.z, 0.44, p, 'ped');
    if (traffic) for (const v of traffic.cars) if (!v.dead) test(v.pos.x, 0.8, v.pos.z, 1.7, v, 'car');
    // buildings: march the ray
    for (let t = 1; t < Math.min(range, best ? best.t : range); t += 1) {
      const x = origin.x + dir.x * t, z = origin.z + dir.z * t;
      if (city.buildingAt(x, z)) { best = { t, point: new THREE.Vector3(x, origin.y + dir.y * t, z), type: 'wall' }; break; }
    }
    return best;
  }
  applyHit(hit, w, player, police, peds, traffic) {
    this.fx.impact(hit.point.x, hit.point.y, hit.point.z, 5);
    if (hit.type === 'cop') {
      hit.obj.health -= w.dmg;
      police.crime('cop', player.pos.x, player.pos.z);
      if (hit.obj.health <= 0) { hit.obj.alive = false; hit.obj.g.visible = false; this.fx.boom(hit.obj.x, 0.8, hit.obj.z); }
    } else if (hit.type === 'car') {
      const v = hit.obj;
      v.health -= w.dmg * 0.65;
      if (v.health <= 0 && !v.dead) { v.dead = true; this.fx.boom(v.pos.x, 1, v.pos.z); police.crime('cop', player.pos.x, player.pos.z); }
    } else if (hit.type === 'ped') {
      const p = hit.obj; p.flee = 8; p.state = 'flee'; police.crime('ped', player.pos.x, player.pos.z); this.fx.impact(hit.point.x, hit.point.y, hit.point.z, 4, [0.8, 0.1, 0.1]);
    }
  }
  addPickup(kind, x, z) {
    const color = kind === 'health' ? 0x55d98a : kind === 'armour' ? 0x5bb6e6 : 0xffc35a;
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, roughness: 0.4 }));
    m.position.y = 0.55; g.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 6, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; g.add(ring);
    g.position.set(x, 0, z); this.scene.add(g);
    this.pickups.push({ kind, x, z, g, m, t: Math.random() * 6 });
  }
  update(dt, player) {
    this.ensure(player);
    if (player.fireCd > 0) player.fireCd -= dt;
    if (player.reload > 0) { player.reload -= dt; if (player.reload <= 0) this.finishReload(player); }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 4);
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.t += dt; p.m.rotation.y += dt * 2; p.g.position.y = Math.sin(p.t * 2) * 0.08;
      if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 1.8) {
        p.taken = true; p.g.visible = false;
        if (p.kind === 'health') player.health = Math.min(100, player.health + 35);
        else if (p.kind === 'armour') player.armour = Math.min(100, player.armour + 40);
        else { player.reserve.vesper += 40; player.reserve.mako += 60; player.reserve.breaker += 12; }
      }
    }
  }
}
