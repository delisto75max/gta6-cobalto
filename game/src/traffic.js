// Lightweight lane-following AI on the city's intersection graph. Traffic reuses vehicles.js
// records so headlights, brake lights, wheel animation, entering and damage stay consistent.
import * as THREE from 'three';
import { CITY, TRAFFIC } from './config.js';
import { mulberry32, pick, range } from './random.js';
import { vehicleForward } from './vehicles.js';

const DIRECTIONS = [
  { x: 0, z: 1 },
  { x: -1, z: 0 },
  { x: 0, z: -1 },
  { x: 1, z: 0 },
];

function shortAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function gridIndex(value) {
  return Math.round(value / CITY.pitch + CITY.blocks / 2);
}

function directionHeading(direction) {
  return Math.atan2(direction.x, direction.z);
}

export function createTraffic(city, vehicleSystem, seed = city.seed) {
  const random = mulberry32((seed ^ 0x7fa11c) | 0);
  const cars = [];
  const roadLines = Array.from({ length: CITY.blocks + 1 }, (_, index) => (index - CITY.blocks / 2) * CITY.pitch);
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const waypoint = new THREE.Vector3();
  let recycleCursor = 0;

  function insideGrid(ix, iz) {
    return ix >= 0 && iz >= 0 && ix <= CITY.blocks && iz <= CITY.blocks;
  }

  function lanePosition(ix, iz, direction, output) {
    const heading = directionHeading(direction);
    output.set(
      roadLines[ix] - Math.cos(heading) * TRAFFIC.laneOffset,
      0,
      roadLines[iz] + Math.sin(heading) * TRAFFIC.laneOffset,
    );
    return output;
  }

  function resetCar(vehicle, origin, initial = false) {
    const minimumDistance = initial ? 24 : TRAFFIC.respawnMinimumDistance;
    const maximumDistance = initial ? 295 : TRAFFIC.respawnMaximumDistance;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const direction = pick(random, DIRECTIONS);
      const targetIX = THREE.MathUtils.clamp(gridIndex(origin.x) + Math.floor(range(random, -2, 3)), 0, CITY.blocks);
      const targetIZ = THREE.MathUtils.clamp(gridIndex(origin.z) + Math.floor(range(random, -2, 3)), 0, CITY.blocks);
      const startIX = targetIX - direction.x;
      const startIZ = targetIZ - direction.z;
      if (!insideGrid(startIX, startIZ)) continue;
      const progress = range(random, 0.08, 0.9);
      lanePosition(targetIX, targetIZ, direction, waypoint);
      const heading = directionHeading(direction);
      const laneX = -Math.cos(heading) * TRAFFIC.laneOffset;
      const laneZ = Math.sin(heading) * TRAFFIC.laneOffset;
      const x = THREE.MathUtils.lerp(roadLines[startIX], roadLines[targetIX], progress) + laneX;
      const z = THREE.MathUtils.lerp(roadLines[startIZ], roadLines[targetIZ], progress) + laneZ;
      const distance = Math.hypot(x - origin.x, z - origin.z);
      if (distance < minimumDistance || distance > maximumDistance) continue;
      vehicle.position.set(x, city.groundHeightAt(x, z), z);
      vehicle.previousPosition.copy(vehicle.position);
      vehicle.heading = heading;
      vehicle.previousHeading = heading;
      vehicle.speed = range(random, 2, 7);
      vehicle.velocity.copy(vehicleForward(vehicle, forward)).multiplyScalar(vehicle.speed);
      vehicle.steer = 0;
      vehicle.control = 'traffic';
      vehicle.occupied = false;
      vehicle.health = vehicle.maxHealth;
      vehicle.engineRunning = true;
      vehicle.model.bodyMaterial.color.set('#ffffff');
      vehicle.braking = false;
      vehicle.ai = {
        targetIX,
        targetIZ,
        direction,
        cruiseSpeed: range(random, TRAFFIC.minimumSpeed, TRAFFIC.maximumSpeed),
        turnTimer: 0,
        recycleDelay: recycleCursor * 0.035,
      };
      recycleCursor = (recycleCursor + 1) % 17;
      return true;
    }
    return false;
  }

  function addCar(origin) {
    const vehicle = vehicleSystem.spawnTrafficCar({
      x: 0, z: 0, type: pick(random, ['cangrejo', 'mula', 'marea', 'tiburon', 'viento']),
    });
    if (!resetCar(vehicle, origin, true)) {
      vehicle.position.set(city.playerSpawn.x, city.groundHeightAt(city.playerSpawn.x, city.playerSpawn.z), city.playerSpawn.z - 40 - cars.length * 6);
      vehicle.previousPosition.copy(vehicle.position);
      vehicle.ai = {
        targetIX: gridIndex(vehicle.position.x), targetIZ: gridIndex(vehicle.position.z) + 1,
        direction: DIRECTIONS[0], cruiseSpeed: 11, turnTimer: 0, recycleDelay: 0,
      };
    }
    cars.push(vehicle);
  }

  function chooseNextDirection(vehicle) {
    const ai = vehicle.ai;
    const currentNode = { ix: ai.targetIX, iz: ai.targetIZ };
    const candidates = [ai.direction, ai.direction, ai.direction, ...DIRECTIONS];
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [candidates[index], candidates[other]] = [candidates[other], candidates[index]];
    }
    for (const direction of candidates) {
      if (direction.x === -ai.direction.x && direction.z === -ai.direction.z) continue;
      const nextIX = currentNode.ix + direction.x;
      const nextIZ = currentNode.iz + direction.z;
      if (!insideGrid(nextIX, nextIZ)) continue;
      const changed = direction !== ai.direction;
      ai.direction = direction;
      ai.targetIX = nextIX;
      ai.targetIZ = nextIZ;
      if (changed) ai.turnTimer = 1.05;
      return;
    }
    // Only a boundary node can reach this branch: reverse rather than leaving the road graph.
    ai.direction = { x: -ai.direction.x, z: -ai.direction.z };
    ai.targetIX = currentNode.ix + ai.direction.x;
    ai.targetIZ = currentNode.iz + ai.direction.z;
    ai.turnTimer = 1.2;
  }

  function obstacleLimitedSpeed(vehicle, context) {
    const ai = vehicle.ai;
    let wantedSpeed = ai.cruiseSpeed;
    if (ai.turnTimer > 0) wantedSpeed = Math.min(wantedSpeed, 7.2);
    vehicleForward(vehicle, forward);
    right.set(-Math.cos(vehicle.heading), 0, Math.sin(vehicle.heading));
    for (const other of vehicleSystem.vehicles) {
      if (other === vehicle) continue;
      const dx = other.position.x - vehicle.position.x;
      const dz = other.position.z - vehicle.position.z;
      const ahead = dx * forward.x + dz * forward.z;
      const side = Math.abs(dx * right.x + dz * right.z);
      if (ahead > 0 && ahead < 20 && side < 2.25) {
        wantedSpeed = Math.min(wantedSpeed, Math.max(0, (ahead - 5.0) * 0.72));
      }
    }
    const player = context.player;
    if (!player.state.vehicle) {
      const dx = player.state.position.x - vehicle.position.x;
      const dz = player.state.position.z - vehicle.position.z;
      const ahead = dx * forward.x + dz * forward.z;
      const side = Math.abs(dx * right.x + dz * right.z);
      const inRoad = city.groundHeightAt(player.state.position.x, player.state.position.z) <= CITY.roadHeight + 0.025;
      if (inRoad && ahead > 0 && ahead < 17 && side < 3.0) wantedSpeed = 0;
    }
    return wantedSpeed;
  }

  function update(dt, context) {
    for (let index = cars.length - 1; index >= 0; index -= 1) {
      if (cars[index].control !== 'traffic') cars.splice(index, 1);
    }
    const origin = context.player.state.position;
    while (cars.length < TRAFFIC.count) addCar(origin);

    for (const vehicle of cars) {
      const ai = vehicle.ai;
      ai.turnTimer = Math.max(0, ai.turnTimer - dt);
      const distanceFromPlayer = Math.hypot(vehicle.position.x - origin.x, vehicle.position.z - origin.z);
      ai.recycleDelay -= dt;
      if (distanceFromPlayer > TRAFFIC.visibilityDistance && ai.recycleDelay <= 0) {
        resetCar(vehicle, origin);
        continue;
      }
      if (vehicle.health <= 0) {
        vehicle.speed = Math.max(0, vehicle.speed - TRAFFIC.braking * dt);
        vehicle.braking = true;
        continue;
      }

      lanePosition(ai.targetIX, ai.targetIZ, ai.direction, waypoint);
      const waypointDistance = Math.hypot(waypoint.x - vehicle.position.x, waypoint.z - vehicle.position.z);
      if (waypointDistance < Math.max(3.8, vehicle.speed * dt * 2.2)) chooseNextDirection(vehicle);
      lanePosition(ai.targetIX, ai.targetIZ, ai.direction, waypoint);
      const desiredHeading = Math.atan2(waypoint.x - vehicle.position.x, waypoint.z - vehicle.position.z);
      const difference = shortAngle(desiredHeading - vehicle.heading);
      const turnRate = 1.35 / (1 + vehicle.speed * 0.018);
      vehicle.heading += THREE.MathUtils.clamp(difference, -turnRate * dt, turnRate * dt);
      vehicle.heading = shortAngle(vehicle.heading);
      vehicle.steer = THREE.MathUtils.damp(vehicle.steer, THREE.MathUtils.clamp(-difference * 0.72, -0.45, 0.45), 6, dt);

      const wantedSpeed = obstacleLimitedSpeed(vehicle, context);
      vehicle.braking = wantedSpeed < vehicle.speed - 0.35 || (wantedSpeed < 0.05 && vehicle.speed < 0.25);
      if (vehicle.speed < wantedSpeed) {
        vehicle.speed = Math.min(wantedSpeed, vehicle.speed + TRAFFIC.acceleration * dt);
      } else {
        vehicle.speed = Math.max(wantedSpeed, vehicle.speed - TRAFFIC.braking * dt);
      }
      vehicleForward(vehicle, forward);
      vehicle.velocity.copy(forward).multiplyScalar(vehicle.speed);
      vehicle.position.addScaledVector(forward, vehicle.speed * dt);
      vehicle.position.y = city.groundHeightAt(vehicle.position.x, vehicle.position.z);
    }
  }

  while (cars.length < TRAFFIC.count) addCar(city.playerSpawn);

  return {
    cars,
    update,
    recycle: resetCar,
  };
}
