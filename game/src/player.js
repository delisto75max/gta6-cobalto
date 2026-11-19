// Rafa's on-foot controller: stylised procedural character, camera-relative movement,
// capsule-like AABB collision, jumping, walk animation and the smoothed orbital chase camera.
import * as THREE from 'three';
import { CAMERA, CITY, INPUT, PALETTE, PLAYER, WORLD } from './config.js';

const clamp = THREE.MathUtils.clamp;

function shortAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function makeBox(parent, material, x, y, z, width, height, depth) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeCharacter(scene) {
  const group = new THREE.Group();
  group.name = 'Rafa Cordero';
  const jacket = new THREE.MeshStandardMaterial({ color: PALETTE.jacket, roughness: 0.82 });
  const panel = new THREE.MeshStandardMaterial({ color: PALETTE.jacketPanel, roughness: 0.78 });
  const shirt = new THREE.MeshStandardMaterial({ color: PALETTE.shirt, roughness: 0.9 });
  const trousers = new THREE.MeshStandardMaterial({ color: PALETTE.trousers, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: PALETTE.skin, roughness: 0.9 });
  const cap = new THREE.MeshStandardMaterial({ color: PALETTE.cap, roughness: 0.8 });
  const shoe = new THREE.MeshStandardMaterial({ color: '#20282b', roughness: 0.92 });

  const torso = makeBox(group, jacket, 0, 1.26, 0, 0.65, 0.67, 0.35);
  makeBox(group, panel, -0.23, 1.27, 0.183, 0.17, 0.6, 0.035);
  makeBox(group, panel, 0.23, 1.27, 0.183, 0.17, 0.6, 0.035);
  makeBox(group, shirt, 0, 1.3, 0.185, 0.24, 0.5, 0.04);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 12, 9), skin);
  head.scale.y = 1.1;
  head.position.set(0, 1.77, 0);
  head.castShadow = true;
  group.add(head);
  const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.216, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), cap);
  capCrown.position.set(0, 1.82, 0);
  capCrown.castShadow = true;
  group.add(capCrown);
  makeBox(group, cap, 0, 1.86, 0.225, 0.35, 0.045, 0.25);

  function limb(x, y, material, width, length, depth) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    makeBox(pivot, material, 0, -length / 2, 0, width, length, depth);
    group.add(pivot);
    return pivot;
  }
  const leftLeg = limb(-0.17, 0.94, trousers, 0.25, 0.76, 0.27);
  const rightLeg = limb(0.17, 0.94, trousers, 0.25, 0.76, 0.27);
  makeBox(leftLeg, shoe, 0, -0.77, 0.06, 0.27, 0.17, 0.39);
  makeBox(rightLeg, shoe, 0, -0.77, 0.06, 0.27, 0.17, 0.39);
  const leftArm = limb(-0.42, 1.51, jacket, 0.2, 0.65, 0.22);
  const rightArm = limb(0.42, 1.51, jacket, 0.2, 0.65, 0.22);
  makeBox(leftArm, skin, 0, -0.72, 0, 0.18, 0.19, 0.19);
  makeBox(rightArm, skin, 0, -0.72, 0, 0.18, 0.19, 0.19);
  scene.add(group);
  return { group, torso, leftLeg, rightLeg, leftArm, rightArm };
}

function cameraColliderTime(origin, end, collider, padding) {
  let entry = 0;
  let exit = 1;
  const minima = [collider.minX - padding, collider.minY - padding, collider.minZ - padding];
  const maxima = [collider.maxX + padding, collider.maxY + padding, collider.maxZ + padding];
  const starts = [origin.x, origin.y, origin.z];
  const deltas = [end.x - origin.x, end.y - origin.y, end.z - origin.z];
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(deltas[axis]) < 0.000001) {
      if (starts[axis] < minima[axis] || starts[axis] > maxima[axis]) return null;
      continue;
    }
    const inverse = 1 / deltas[axis];
    let first = (minima[axis] - starts[axis]) * inverse;
    let second = (maxima[axis] - starts[axis]) * inverse;
    if (first > second) [first, second] = [second, first];
    entry = Math.max(entry, first);
    exit = Math.min(exit, second);
    if (entry > exit) return null;
  }
  return entry >= 0 && entry <= 1 ? entry : null;
}

export function createPlayer(stage, city, spawn = city.playerSpawn) {
  const camera = stage.camera;
  const character = makeCharacter(stage.scene);
  const state = {
    position: new THREE.Vector3(spawn.x, city.groundHeightAt(spawn.x, spawn.z), spawn.z),
    velocity: new THREE.Vector3(),
    heading: spawn.heading,
    grounded: true,
    health: 100,
    district: city.districtAt(spawn.x, spawn.z),
    vehicle: null,
    driving: false,
  };
  const previousPosition = state.position.clone();
  const previousCameraPosition = new THREE.Vector3();
  const currentCameraPosition = new THREE.Vector3();
  const renderPosition = new THREE.Vector3();
  const target = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const resolvedCamera = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const movement = new THREE.Vector3();
  let yaw = spawn.heading;
  let pitch = CAMERA.pitch;
  let distance = CAMERA.distance;
  let wantedDistance = CAMERA.distance;
  let verticalVelocity = 0;
  let walkTime = 0;
  let elapsed = 0;

  function collides(x, z) {
    const radius = PLAYER.radius;
    const candidates = city.queryColliders(x, z, radius + 0.1);
    for (const collider of candidates) {
      if (collider.type !== 'seawall' && state.position.y > collider.maxY) continue;
      const closestX = clamp(x, collider.minX, collider.maxX);
      const closestZ = clamp(z, collider.minZ, collider.maxZ);
      const deltaX = x - closestX;
      const deltaZ = z - closestZ;
      if (deltaX * deltaX + deltaZ * deltaZ < radius * radius) return true;
    }
    return false;
  }

  function resolveCamera(origin, wanted, output) {
    output.copy(wanted);
    const midpointX = (origin.x + wanted.x) / 2;
    const midpointZ = (origin.z + wanted.z) / 2;
    const radius = Math.hypot(wanted.x - origin.x, wanted.z - origin.z) / 2 + 1;
    const candidates = city.queryColliders(midpointX, midpointZ, radius);
    let nearest = 1;
    for (const collider of candidates) {
      const time = cameraColliderTime(origin, wanted, collider, CAMERA.collisionPadding);
      if (time !== null && time > 0.035 && time < nearest) nearest = time;
    }
    if (nearest < 1) output.lerpVectors(origin, wanted, Math.max(0.04, nearest - 0.035));
    const ground = city.groundHeightAt(output.x, output.z);
    output.y = Math.max(output.y, ground + CAMERA.minGroundClearance);
    return output;
  }

  function calculateCameraTarget(source = state.position) {
    target.set(source.x, source.y + CAMERA.targetHeight, source.z);
    return target;
  }

  function snapCamera() {
    calculateCameraTarget();
    forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    desiredCamera.copy(target).addScaledVector(forward, -distance * Math.cos(pitch));
    desiredCamera.y += CAMERA.height + Math.sin(pitch) * distance * 0.65;
    resolveCamera(target, desiredCamera, camera.position);
    previousCameraPosition.copy(camera.position);
    currentCameraPosition.copy(camera.position);
    calculateCameraTarget();
    camera.lookAt(target);
    character.group.position.copy(state.position);
    character.group.rotation.y = state.heading;
  }

  function update(dt, context) {
    const actions = context.actions;
    if (state.vehicle) {
      previousPosition.copy(state.position);
      return;
    }
    elapsed += dt;
    previousPosition.copy(state.position);
    previousCameraPosition.copy(currentCameraPosition);

    yaw -= actions.lookX * INPUT.mouseSensitivity;
    pitch = clamp(pitch + actions.lookY * INPUT.mouseSensitivity, CAMERA.minPitch, CAMERA.maxPitch);
    wantedDistance = clamp(wantedDistance + actions.wheel * CAMERA.wheelSensitivity, CAMERA.minDistance, CAMERA.maxDistance);
    distance = THREE.MathUtils.damp(distance, wantedDistance, CAMERA.zoomSmoothing, dt);

    forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    right.set(-Math.cos(yaw), 0, Math.sin(yaw));
    movement.set(0, 0, 0).addScaledVector(forward, actions.forward).addScaledVector(right, actions.right);
    if (movement.lengthSq() > 1) movement.normalize();
    const speed = actions.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const blend = 1 - Math.exp(-PLAYER.acceleration * dt);
    state.velocity.x = THREE.MathUtils.lerp(state.velocity.x, movement.x * speed, blend);
    state.velocity.z = THREE.MathUtils.lerp(state.velocity.z, movement.z * speed, blend);

    const minX = -WORLD.halfSize + PLAYER.radius;
    const maxX = WORLD.halfSize - PLAYER.radius;
    const minZ = -WORLD.halfSize + PLAYER.radius;
    const maxZ = WORLD.seawallZ - 0.55 - PLAYER.radius;
    const nextX = clamp(state.position.x + state.velocity.x * dt, minX, maxX);
    if (!collides(nextX, state.position.z)) state.position.x = nextX;
    else state.velocity.x = 0;
    const nextZ = clamp(state.position.z + state.velocity.z * dt, minZ, maxZ);
    if (!collides(state.position.x, nextZ)) state.position.z = nextZ;
    else state.velocity.z = 0;

    if (actions.jumpPressed && state.grounded) {
      verticalVelocity = PLAYER.jumpSpeed;
      state.grounded = false;
    }
    verticalVelocity -= PLAYER.gravity * dt;
    state.position.y += verticalVelocity * dt;
    const ground = city.groundHeightAt(state.position.x, state.position.z);
    if (state.position.y <= ground) {
      state.position.y = ground;
      verticalVelocity = 0;
      state.grounded = true;
    }

    const planarSpeed = Math.hypot(state.velocity.x, state.velocity.z);
    if (planarSpeed > 0.18) {
      const wantedHeading = Math.atan2(state.velocity.x, state.velocity.z);
      state.heading += shortAngle(wantedHeading - state.heading) * (1 - Math.exp(-PLAYER.turnSpeed * dt));
    }
    walkTime += dt * PLAYER.walkCycleSpeed * Math.max(0.25, planarSpeed / PLAYER.walkSpeed);
    const stride = state.grounded ? Math.sin(walkTime) * Math.min(0.72, planarSpeed * 0.12) : 0.12;
    character.leftLeg.rotation.x = stride;
    character.rightLeg.rotation.x = -stride;
    character.leftArm.rotation.x = -stride * 0.78;
    character.rightArm.rotation.x = stride * 0.78;
    character.torso.position.y = 1.26 + Math.sin(elapsed * 2.1) * 0.008;
    character.group.rotation.y = state.heading;
    state.district = city.districtAt(state.position.x, state.position.z);

    calculateCameraTarget();
    desiredCamera.copy(target).addScaledVector(forward, -distance * Math.cos(pitch));
    desiredCamera.y += CAMERA.height + Math.sin(pitch) * distance * 0.65;
    resolveCamera(target, desiredCamera, resolvedCamera);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, resolvedCamera.x, CAMERA.followSmoothing, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, resolvedCamera.y, CAMERA.followSmoothing, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, resolvedCamera.z, CAMERA.followSmoothing, dt);
    const cameraGround = city.groundHeightAt(camera.position.x, camera.position.z);
    camera.position.y = Math.max(camera.position.y, cameraGround + CAMERA.minGroundClearance);
    currentCameraPosition.copy(camera.position);
    camera.lookAt(target);
  }

  function render(alpha) {
    if (state.vehicle) return;
    renderPosition.lerpVectors(previousPosition, state.position, alpha);
    character.group.position.copy(renderPosition);
    camera.position.lerpVectors(previousCameraPosition, currentCameraPosition, alpha);
    const ground = city.groundHeightAt(camera.position.x, camera.position.z);
    camera.position.y = Math.max(camera.position.y, ground + CAMERA.minGroundClearance);
    calculateCameraTarget(renderPosition);
    camera.lookAt(target);
  }

  function enterVehicle(vehicle) {
    state.vehicle = vehicle;
    state.driving = true;
    state.velocity.set(0, 0, 0);
    verticalVelocity = 0;
    character.group.visible = false;
  }

  function exitVehicle(destination = state.position) {
    state.vehicle = null;
    state.driving = false;
    state.position.set(destination.x, city.groundHeightAt(destination.x, destination.z), destination.z);
    state.velocity.set(0, 0, 0);
    state.heading = destination.heading ?? state.heading;
    state.district = city.districtAt(state.position.x, state.position.z);
    yaw = state.heading;
    verticalVelocity = 0;
    state.grounded = true;
    previousPosition.copy(state.position);
    character.group.visible = true;
    snapCamera();
  }

  function teleport(destination) {
    state.position.set(destination.x, city.groundHeightAt(destination.x, destination.z), destination.z);
    state.velocity.set(0, 0, 0);
    state.heading = destination.heading ?? state.heading;
    yaw = state.heading;
    verticalVelocity = 0;
    previousPosition.copy(state.position);
    snapCamera();
  }

  snapCamera();
  return { state, mesh: character.group, update, render, enterVehicle, exitVehicle, teleport };
}
