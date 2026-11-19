// player.js — Rafa Cordero on foot: movement, collision, the character mesh, the walk cycle and
// the third-person camera rig. The car camera lives in main.js because it follows a vehicle.
import * as THREE from 'three';
import { CAMERA, WORLD } from './config.js';
import { clamp, damp, angleLerp } from './rng.js';

const SKIN = 0xb9825c;
const SHIRT = 0xe8ddc6;
const PANTS = 0x2f3a44;
const HAIR = 0x241d1a;
const SHOE = 0x1c2024;

function mesh(geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function limb(color, w, h, d) {
  const pivot = new THREE.Group();
  const m = mesh(new THREE.BoxGeometry(w, h, d), color, 0, -h / 2, 0);
  pivot.add(m);
  return pivot;
}

export function createPlayer(scene, city) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const hips = mesh(new THREE.BoxGeometry(0.5, 0.24, 0.3), PANTS, 0, 0.92, 0);
  body.add(hips);
  const torso = mesh(new THREE.BoxGeometry(0.54, 0.62, 0.32), SHIRT, 0, 1.28, 0);
  body.add(torso);
  const collar = mesh(new THREE.BoxGeometry(0.3, 0.1, 0.34), 0xd7c8ae, 0, 1.55, 0);
  body.add(collar);
  const head = mesh(new THREE.BoxGeometry(0.3, 0.32, 0.29), SKIN, 0, 1.73, 0);
  body.add(head);
  const hair = mesh(new THREE.BoxGeometry(0.33, 0.13, 0.32), HAIR, 0, 1.89, -0.01);
  body.add(hair);
  const brow = mesh(new THREE.BoxGeometry(0.3, 0.035, 0.02), 0x3a2b22, 0, 1.77, 0.15);
  body.add(brow);

  const armL = limb(SKIN, 0.14, 0.62, 0.16);
  armL.position.set(-0.36, 1.52, 0);
  const armR = limb(SKIN, 0.14, 0.62, 0.16);
  armR.position.set(0.36, 1.52, 0);
  body.add(armL, armR);
  const sleeveL = mesh(new THREE.BoxGeometry(0.16, 0.26, 0.18), SHIRT, 0, 1.42, 0);
  sleeveL.position.set(0, 0.16, 0);
  armL.add(sleeveL);
  const sleeveR = sleeveL.clone();
  sleeveR.position.set(0, 0.16, 0);
  armR.add(sleeveR);

  const legL = limb(PANTS, 0.2, 0.84, 0.24);
  legL.position.set(-0.14, 0.86, 0);
  const legR = limb(PANTS, 0.2, 0.84, 0.24);
  legR.position.set(0.14, 0.86, 0);
  body.add(legL, legR);
  const shoeL = mesh(new THREE.BoxGeometry(0.21, 0.12, 0.34), SHOE, 0, 0.84, 0.06);
  legL.add(shoeL);
  const shoeR = shoeL.clone();
  legR.add(shoeR);

  const gun = new THREE.Group();
  const barrel = mesh(new THREE.BoxGeometry(0.075, 0.075, 0.46), 0x2f3338, 0, 0, 0.18);
  const slide = mesh(new THREE.BoxGeometry(0.09, 0.09, 0.2), 0x42484d, 0, 0.02, 0.02);
  const grip = mesh(new THREE.BoxGeometry(0.06, 0.18, 0.08), 0x3d2c22, 0, -0.11, -0.03);
  gun.add(barrel, slide, grip);
  gun.position.set(0.05, -0.58, 0.16);
  armR.add(gun);
  gun.visible = false;

  const playerShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.48),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24, depthWrite: false }),
  );
  playerShadow.rotation.x = -Math.PI / 2;
  playerShadow.position.y = 0.2;
  group.add(playerShadow);

  scene.add(group);

  const player = {
    group, body, armL, armR, legL, legR, gun, head,
    pos: new THREE.Vector3(),
    heading: Math.PI,
    speed: 0,
    vertical: 0,
    onGround: true,
    phase: 0,
    health: 100,
    armour: 50,
    maxHealth: 100,
    maxArmour: 100,
    weapon: 1,
    unlocked: [true, true, false, false],
    mag: [0, 12, 0, 0],
    ammo: [0, 12, 0, 0],
    reserve: [0, 96, 0, 0],
    aiming: false,
    fireCooldown: 0,
    reloading: 0,
    visible: true,
    camYaw: 0,
    camPitch: -0.12,
    camDist: 5.4,
    shake: 0,
    dead: false,
  };

  player.spawnAt = (x, z, heading = Math.PI) => {
    player.pos.set(x, 0, z);
    player.heading = heading;
    player.speed = 0;
    player.vertical = 0;
    player.health = player.maxHealth;
    player.armour = Math.max(player.armour, 20);
    player.dead = false;
    player.visible = true;
    player.group.visible = true;
    player.group.position.copy(player.pos);
    player.group.rotation.y = heading;
  };

  player.weaponDef = null;

  player.update = (dt, input, cityRef, vehicles) => {
    if (player.dead) return;
    const yaw = player.camYaw;
    const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    let mx = 0, mz = 0;
    if (input.forward) { mx += fwdX; mz += fwdZ; }
    if (input.back) { mx -= fwdX; mz -= fwdZ; }
    if (input.right) { mx += rightX; mz += rightZ; }
    if (input.left) { mx -= rightX; mz -= rightZ; }
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }
    player.aiming = Boolean(input.aim);

    const targetSpeed = player.aiming ? 1.9 : input.sprint ? 6.4 : 3.4;
    const accel = player.onGround ? 22 : 7;
    player.speed = damp(player.speed, len > 0 ? targetSpeed : 0, accel, dt);
    if (len > 0) {
      player.heading = angleLerp(player.heading, Math.atan2(mx, mz), 1 - Math.exp(-12 * dt));
    }

    if (input.jump && player.onGround) {
      player.vertical = 5.2;
      player.onGround = false;
    }
    player.vertical -= 16 * dt;
    if (!player.onGround) {
      player.pos.y += player.vertical * dt;
      if (player.pos.y <= 0) { player.pos.y = 0; player.vertical = 0; player.onGround = true; }
    }

    const stepX = mx * player.speed * dt;
    const stepZ = mz * player.speed * dt;
    const nx = player.pos.x + stepX;
    const nz = player.pos.z + stepZ;
    if (!cityRef.blocked(nx, player.pos.z, 0.44) && nx > -1070 && nx < 1070) player.pos.x = nx;
    if (!cityRef.blocked(player.pos.x, nz, 0.44) && nz < 654 && nz > -772) player.pos.z = nz;

    // walk cycle and pose
    player.phase += dt * (2.6 + player.speed * 1.5);
    const swing = Math.min(0.72, player.speed * 0.14 + (player.speed > 0.2 ? 0.18 : 0));
    if (player.aiming) {
      armR.rotation.set(-Math.PI / 2 + 0.08, 0.06, 0);
      armL.rotation.set(-Math.PI / 2 + 0.18, 0, -0.12);
      legL.rotation.x = damp(legL.rotation.x, -0.12, 10, dt);
      legR.rotation.x = damp(legR.rotation.x, 0.12, 10, dt);
    } else {
      armL.rotation.x = Math.sin(player.phase) * swing;
      armR.rotation.x = -Math.sin(player.phase) * swing;
      armL.rotation.z = 0.04;
      armR.rotation.z = -0.04;
      legL.rotation.x = -Math.sin(player.phase) * swing;
      legR.rotation.x = Math.sin(player.phase) * swing;
    }
    body.position.y = Math.abs(Math.sin(player.phase * 2)) * 0.025 * (player.speed > 0.4 ? 1 : 0);
    body.rotation.z = Math.sin(player.phase) * 0.015 * (player.speed > 0.4 ? 1 : 0);
    gun.visible = player.weapon > 1 && !vehicles?.playerVehicle;

    player.group.position.copy(player.pos);
    player.group.rotation.y = player.heading;
    player.group.visible = player.visible && !vehicles?.playerVehicle;
  };

  player.muzzleWorld = () => {
    const fwdX = Math.sin(player.heading), fwdZ = Math.cos(player.heading);
    const rightX = Math.cos(player.heading), rightZ = -Math.sin(player.heading);
    return new THREE.Vector3(
      player.pos.x + fwdX * 0.62 + rightX * 0.2,
      player.pos.y + 1.34,
      player.pos.z + fwdZ * 0.62 + rightZ * 0.2,
    );
  };

  player.takeDamage = (amount) => {
    if (player.dead) return;
    const armourPart = Math.min(player.armour, amount * 0.6);
    player.armour -= armourPart;
    player.health -= amount - armourPart;
    player.shake = Math.min(0.5, player.shake + amount * 0.006);
    if (player.health <= 0) {
      player.health = 0;
      player.dead = true;
    }
  };

  // Third-person camera: spring-damped, shoulder-offset, pulled in by buildings.
  player.updateCamera = (camera, dt, aiming) => {
    const target = new THREE.Vector3(player.pos.x, player.pos.y + (aiming ? 1.56 : 1.5), player.pos.z);
    const yaw = player.camYaw;
    const pitch = player.camPitch;
    const dist = aiming ? 3.3 : player.camDist;
    const cosP = Math.cos(pitch);
    const desired = new THREE.Vector3(
      target.x + Math.sin(yaw) * cosP * dist,
      target.y + Math.sin(pitch) * dist + 0.45,
      target.z + Math.cos(yaw) * cosP * dist,
    );
    // pull the camera in when a wall is between it and the shoulder
    let allowed = 1;
    for (let i = 1; i <= 12; i += 1) {
      const t = i / 12;
      const px = target.x + (desired.x - target.x) * t;
      const pz = target.z + (desired.z - target.z) * t;
      if (city.blocked(px, pz, 0.28)) { allowed = Math.max(0.18, t - 0.12); break; }
    }
    desired.lerpVectors(target, desired, allowed);
    const k = 1 - Math.exp(-12 * dt);
    camera.position.lerp(desired, k);
    const look = new THREE.Vector3(
      target.x - Math.sin(yaw) * 2.2,
      target.y + 1.1 + Math.sin(pitch) * -2.0,
      target.z - Math.cos(yaw) * 2.2,
    );
    camera.lookAt(look);
    if (player.shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * player.shake * 0.12;
      camera.position.y += (Math.random() - 0.5) * player.shake * 0.12;
      player.shake *= Math.exp(-6 * dt);
    }
    camera.fov = damp(camera.fov, aiming ? 52 : 60, 7, dt);
    camera.updateProjectionMatrix();
  };

  player.spawnAt(-182, 606, Math.PI * 0.5);
  return player;
}
