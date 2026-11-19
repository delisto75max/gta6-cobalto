// Rafa Cordero on foot: low-poly character, walk/aim animation, movement and building collision.
import * as THREE from 'three';
import { clamp } from './rng.js';

const SKIN = 0xc98d63, SHIRT = 0xe8e0cd, PANTS = 0x27313f, HAIR = 0x241c19, SHOE = 0x171a1d;

function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.78 }));
  m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
}

export function createPlayer(scene) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  box(0.56, 0.7, 0.34, SHIRT, 0, 1.18, 0, body);
  box(0.5, 0.24, 0.32, PANTS, 0, 0.79, 0, body);
  const head = new THREE.Group(); head.position.set(0, 1.63, 0); body.add(head);
  box(0.3, 0.34, 0.3, SKIN, 0, 0, 0, head);
  box(0.34, 0.12, 0.34, HAIR, 0, 0.2, 0.01, head);
  box(0.08, 0.1, 0.05, SKIN, 0, -0.02, 0.17, head);
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.37, 1.42, 0); armR.position.set(0.37, 1.42, 0);
  body.add(armL, armR);
  box(0.16, 0.56, 0.18, SHIRT, 0, -0.24, 0, armL);
  box(0.16, 0.56, 0.18, SHIRT, 0, -0.24, 0, armR);
  box(0.14, 0.18, 0.16, SKIN, 0, -0.56, 0, armL);
  const handR = box(0.14, 0.18, 0.16, SKIN, 0, -0.56, 0, armR);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.15, 0.74, 0); legR.position.set(0.15, 0.74, 0);
  body.add(legL, legR);
  box(0.2, 0.68, 0.22, PANTS, 0, -0.3, 0, legL);
  box(0.2, 0.68, 0.22, PANTS, 0, -0.3, 0, legR);
  box(0.22, 0.14, 0.32, SHOE, 0, -0.66, 0.04, legL);
  box(0.22, 0.14, 0.32, SHOE, 0, -0.66, 0.04, legR);
  const gun = new THREE.Group();
  const barrel = box(0.08, 0.1, 0.38, 0x2a2d33, 0, 0, 0.18, gun);
  barrel.material.metalness = 0.6; barrel.material.roughness = 0.35;
  box(0.09, 0.2, 0.1, 0x1c1e22, 0, -0.1, 0.0, gun);
  gun.position.set(0.06, 0.06, 0.12); gun.rotation.x = 0.04; gun.visible = false; handR.add(gun);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.52, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.06; scene.add(shadow);
  scene.add(root);

  const p = {
    root, body, head, armL, armR, legL, legR, gun, shadow,
    pos: new THREE.Vector3(0, 0.15, 0), vel: new THREE.Vector3(), heading: 0,
    speed: 0, phase: 0, health: 100, armour: 50, aim: false, alive: true, inVehicle: null,
    weapon: 'vesper', ammo: { vesper: 12, mako: 0, breaker: 0 }, reserve: { vesper: 96, mako: 0, breaker: 0 },
    fireCd: 0, reload: 0, recoil: 0,
  };
  root.position.copy(p.pos);
  return p;
}

export function resetPlayer(p, x, z, heading = 0) {
  p.pos.set(x, 0.15, z); p.vel.set(0, 0, 0); p.heading = heading;
  p.speed = 0; p.health = 100; p.armour = 50; p.alive = true; p.inVehicle = null;
  p.root.visible = true; p.gun.visible = false; p.aim = false;
}

export function updatePlayer(p, dt, ctrl, city) {
  if (!p.alive) return;
  const mx = ctrl.mx || 0, mz = ctrl.mz || 0;
  const moving = mx * mx + mz * mz > 0.001;
  const target = moving ? (ctrl.sprint ? 7.4 : 4.3) : 0;
  const accel = moving ? 26 : 18;
  const wishX = moving ? mx : 0, wishZ = moving ? mz : 0;
  p.vel.x += (wishX * target - p.vel.x) * Math.min(1, accel * dt);
  p.vel.z += (wishZ * target - p.vel.z) * Math.min(1, accel * dt);
  if (moving) {
    const want = Math.atan2(wishX, wishZ);
    let d = want - p.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    p.heading += d * Math.min(1, 12 * dt);
  }
  p.vel.y -= 20 * dt;
  p.pos.y += p.vel.y * dt;
  if (p.pos.y <= 0.15) { p.pos.y = 0.15; p.vel.y = 0; }
  if (ctrl.jump && p.pos.y <= 0.16) p.vel.y = 6.2;
  p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
  if (city.collide(p.pos, 0.42)) { p.vel.x *= 0.2; p.vel.z *= 0.2; }
  if (city.isWater(p.pos.x, p.pos.z)) { p.pos.z -= 1.2; p.vel.z = 0; }
  p.speed = Math.hypot(p.vel.x, p.vel.z);
  p.phase += dt * (2.2 + p.speed * 1.15);
  const run = clamp(p.speed / 6, 0, 1);
  const sw = Math.sin(p.phase * 2.1) * (0.15 + run * 0.65);
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  p.armL.rotation.x = -sw * 0.8; p.armR.rotation.x = sw * 0.8;
  p.armL.rotation.z = 0.08; p.armR.rotation.z = -0.08;
  p.body.position.y = p.speed > 0.2 ? Math.abs(Math.sin(p.phase * 2.1)) * 0.045 * run : Math.sin(p.phase * 1.2) * 0.012;
  if (p.aim) {
    p.armR.rotation.x = -1.35; p.armR.rotation.z = -0.12;
    p.armL.rotation.x = -1.15; p.armL.rotation.z = 0.5;
    p.aim = true;
  }
  p.gun.visible = p.aim || p.weapon !== 'fists';
  p.root.position.copy(p.pos);
  p.root.rotation.y = p.heading;
  p.shadow.position.set(p.pos.x, 0.06, p.pos.z);
  p.shadow.material.opacity = 0.25;
  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.recoil > 0) { p.recoil -= dt * 6; p.body.rotation.x = p.recoil * 0.12; } else p.body.rotation.x = 0;
}

export function playerMuzzle(p) {
  const v = new THREE.Vector3(0, 1.45, 0.55);
  v.applyAxisAngle(new THREE.Vector3(0, 1, 0), p.heading);
  return new THREE.Vector3(p.pos.x + v.x, p.pos.y + v.y - 0.15, p.pos.z + v.z);
}

export function damagePlayer(p, amount) {
  if (p.armour > 0) {
    const abs = Math.min(p.armour, amount * 0.6);
    p.armour -= abs; amount -= abs;
  }
  p.health = Math.max(0, p.health - amount);
  if (p.health <= 0) p.alive = false;
}
