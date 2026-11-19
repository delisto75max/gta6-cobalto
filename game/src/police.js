// Policía de Cobalto: witnessed crime heat, staged cruiser response, foot officers and outcomes.
// This module owns wanted/outcome state; combat.js owns only the shared rays and damage numbers.
import * as THREE from 'three';
import { CITY, PLAYER, POLICE, WORLD } from './config.js';
import { mulberry32, range } from './random.js';
import { hasWorldLineOfSight } from './combat.js';

const TAU = Math.PI * 2;

function shortAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function makeOfficerModel(scene, materials) {
  const group = new THREE.Group();
  group.name = 'PDC officer';
  function box(parent, material, x, y, z, width, height, depth) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  box(group, materials.uniform, 0, 1.25, 0, 0.6, 0.67, 0.34);
  box(group, materials.shirt, 0, 1.46, 0.18, 0.48, 0.22, 0.035);
  box(group, materials.badge, -0.17, 1.4, 0.205, 0.09, 0.12, 0.025);
  box(group, materials.belt, 0, 0.96, 0, 0.56, 0.12, 0.36);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), materials.skin);
  head.position.set(0, 1.76, 0);
  head.castShadow = true;
  group.add(head);
  box(group, materials.cap, 0, 1.93, 0, 0.41, 0.12, 0.36);
  box(group, materials.capBand, 0, 1.88, 0.02, 0.42, 0.055, 0.38);
  box(group, materials.cap, 0, 1.88, 0.24, 0.34, 0.04, 0.22);

  function limb(x, y, material, width, length) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    box(pivot, material, 0, -length / 2, 0, width, length, width);
    group.add(pivot);
    return pivot;
  }
  const leftLeg = limb(-0.16, 0.91, materials.trousers, 0.23, 0.72);
  const rightLeg = limb(0.16, 0.91, materials.trousers, 0.23, 0.72);
  box(leftLeg, materials.boots, 0, -0.75, 0.06, 0.25, 0.15, 0.36);
  box(rightLeg, materials.boots, 0, -0.75, 0.06, 0.25, 0.15, 0.36);
  const leftArm = limb(-0.39, 1.5, materials.uniform, 0.19, 0.66);
  const rightArm = limb(0.39, 1.5, materials.uniform, 0.19, 0.66);
  box(rightArm, materials.weapon, 0, -0.68, 0.14, 0.12, 0.13, 0.38);
  scene.add(group);
  return { group, leftLeg, rightLeg, leftArm, rightArm };
}

export function createPolice(stage, city, player, vehicleSystem, combat, seed = city.seed) {
  const random = mulberry32((seed ^ 0x0dc411) | 0);
  const materials = {
    uniform: new THREE.MeshStandardMaterial({ color: '#263f58', roughness: 0.85 }),
    shirt: new THREE.MeshStandardMaterial({ color: '#82aec0', roughness: 0.82 }),
    badge: new THREE.MeshStandardMaterial({ color: '#e1be66', roughness: 0.35, metalness: 0.5 }),
    belt: new THREE.MeshStandardMaterial({ color: '#202a31', roughness: 0.8 }),
    trousers: new THREE.MeshStandardMaterial({ color: '#1e303e', roughness: 0.9 }),
    boots: new THREE.MeshStandardMaterial({ color: '#161e23', roughness: 0.92 }),
    skin: new THREE.MeshStandardMaterial({ color: '#aa7653', roughness: 0.9 }),
    cap: new THREE.MeshStandardMaterial({ color: '#22374d', roughness: 0.86 }),
    capBand: new THREE.MeshStandardMaterial({ color: '#d9e6e2', roughness: 0.78 }),
    weapon: new THREE.MeshStandardMaterial({ color: '#293236', roughness: 0.42, metalness: 0.48 }),
  };
  const cruisers = [];
  const officers = [];
  const stats = {
    crimes: 0, cruisersSpawned: 0, officersDeployed: 0, shotsAvoidedByCover: 0,
    arrests: 0, deaths: 0, starsDecayed: 0, witnessedThefts: 0, officersKilled: 0,
  };
  let context = null;
  let elapsed = 0;
  let heat = 0;
  let wanted = 0;
  let outOfSightTimer = 0;
  let spawnTimer = 0;
  let arrestTimer = 0;
  let phase = 'playing';
  let outcomeTimer = 0;
  let outcomeRespawned = false;
  let outcomeFee = 0;
  let callout = '';
  let calloutTimer = 0;
  let nextOfficerId = 1;
  let lastCrime = null;
  let lastOutcome = null;
  const lastSeen = player.state.position.clone();
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const target = new THREE.Vector3();
  const sightStart = new THREE.Vector3();
  const sightEnd = new THREE.Vector3();
  const destination = new THREE.Vector3();
  const candidate = new THREE.Vector3();
  const renderPosition = new THREE.Vector3();

  const CALL_OUTS = {
    respond: 'PDC dispatch: unit responding to Avenida Cobalto.',
    foot: 'PDC! Stop and keep your hands visible!',
    burst: 'PDC! Drop the weapon!',
    cover: 'PDC officer: moving to cover!',
    arrest: 'PDC! Do not move!',
  };

  function announce(text, duration = 3.2) {
    callout = text;
    calloutTimer = duration;
    combat.playCallout();
  }

  function levelForHeat(value) {
    let level = 0;
    for (let stars = 1; stars <= POLICE.maximumWanted; stars += 1) {
      if (value >= POLICE.heatThresholds[stars]) level = stars;
    }
    return level;
  }

  function seenFrom(position, distanceLimit = POLICE.sightRange) {
    const distance = Math.hypot(position.x - player.state.position.x, position.z - player.state.position.z);
    if (distance > distanceLimit) return false;
    sightStart.set(position.x, position.y + 1.55, position.z);
    sightEnd.copy(player.state.position);
    sightEnd.y += 1.18;
    return hasWorldLineOfSight(city, sightStart, sightEnd);
  }

  function addHeat(amount, reason = 'crime', position = player.state.position) {
    if (!Number.isFinite(amount) || amount <= 0 || phase !== 'playing') return wanted;
    const previous = wanted;
    heat = THREE.MathUtils.clamp(heat + amount, 0, POLICE.heatThresholds[POLICE.maximumWanted]);
    wanted = levelForHeat(heat);
    stats.crimes += 1;
    lastCrime = { reason, time: elapsed, x: position.x, z: position.z };
    lastSeen.copy(position);
    outOfSightTimer = 0;
    if (wanted > previous) announce(wanted >= 3 ? `PDC dispatch: ${wanted}-star pursuit, all available units.` : CALL_OUTS.respond);
    if (wanted > 0) spawnTimer = 0;
    return wanted;
  }

  function reportCrime(type, position = player.state.position) {
    const amount = POLICE.heat[type];
    if (!amount) return false;
    addHeat(amount, type, position);
    return true;
  }

  function witnessCrime(type, position = player.state.position) {
    for (const cruiser of cruisers) {
      if (cruiser.vehicle.control !== 'police') continue;
      if (seenFrom(cruiser.vehicle.position, POLICE.witnessRange)) {
        if (type === 'vehicleTheft') stats.witnessedThefts += 1;
        reportCrime(type, position);
        return true;
      }
    }
    return false;
  }

  function roadSpawn(origin) {
    for (let attempt = 0; attempt < 70; attempt += 1) {
      const road = city.roads[Math.floor(random() * city.roads.length)];
      const along = road.axis === 'z' ? origin.z + range(random, -150, 150) : origin.x + range(random, -150, 150);
      const x = road.axis === 'z' ? road.x : THREE.MathUtils.clamp(along, -WORLD.halfSize + 14, WORLD.halfSize - 14);
      const z = road.axis === 'z' ? THREE.MathUtils.clamp(along, -WORLD.halfSize + 14, WORLD.halfSize - 14) : road.z;
      const distance = Math.hypot(x - origin.x, z - origin.z);
      if (distance < POLICE.cruiserSpawnMinimum || distance > POLICE.cruiserSpawnMaximum) continue;
      let blocked = false;
      for (const collider of city.queryColliders(x, z, 3)) {
        if (x >= collider.minX - 1.4 && x <= collider.maxX + 1.4 && z >= collider.minZ - 2.4 && z <= collider.maxZ + 2.4) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      if (vehicleSystem.vehicles.some((vehicle) => Math.hypot(vehicle.position.x - x, vehicle.position.z - z) < 5)) continue;
      return { x, z, heading: Math.atan2(origin.x - x, origin.z - z) };
    }
    return null;
  }

  function spawnCruiser(origin = player.state.position) {
    const placement = roadSpawn(origin);
    if (!placement) return null;
    const vehicle = vehicleSystem.spawnVehicle({
      ...placement, police: true, siren: true, control: 'police', type: 'marea',
    });
    const cruiser = {
      vehicle, index: cruisers.length, officer: null, seesPlayer: false,
      stopping: false, lastDistance: Infinity,
    };
    cruisers.push(cruiser);
    stats.cruisersSpawned += 1;
    return cruiser;
  }

  function removeOfficer(officer) {
    stage.scene.remove(officer.model.group);
    const index = officers.indexOf(officer);
    if (index >= 0) officers.splice(index, 1);
    if (officer.cruiser?.officer === officer) officer.cruiser.officer = null;
  }

  function clearUnits() {
    for (const officer of [...officers]) removeOfficer(officer);
    for (let index = cruisers.length - 1; index >= 0; index -= 1) {
      const cruiser = cruisers[index];
      if (cruiser.vehicle.control === 'police') vehicleSystem.removeVehicle(cruiser.vehicle);
      cruisers.splice(index, 1);
    }
    combat.updateSirens([], player.state.position);
  }

  function setWanted(level) {
    wanted = THREE.MathUtils.clamp(Math.round(level), 0, POLICE.maximumWanted);
    heat = POLICE.heatThresholds[wanted];
    outOfSightTimer = 0;
    spawnTimer = 0;
    if (wanted === 0) clearUnits();
    return wanted;
  }

  function clearWanted() {
    heat = 0;
    outOfSightTimer = 0;
    arrestTimer = 0;
    return setWanted(0);
  }

  function canStand(x, z, radius = 0.35) {
    if (Math.abs(x) > WORLD.halfSize - 1 || z < -WORLD.halfSize + 1 || z > WORLD.seawallZ - 1) return false;
    for (const collider of city.queryColliders(x, z, radius + 0.2)) {
      const nearestX = THREE.MathUtils.clamp(x, collider.minX, collider.maxX);
      const nearestZ = THREE.MathUtils.clamp(z, collider.minZ, collider.maxZ);
      if (Math.hypot(x - nearestX, z - nearestZ) < radius + 0.05) return false;
    }
    return true;
  }

  function deployOfficer(cruiser) {
    if (cruiser.officer || cruiser.vehicle.control !== 'police') return cruiser.officer;
    const vehicle = cruiser.vehicle;
    const cosine = Math.cos(vehicle.heading);
    const sine = Math.sin(vehicle.heading);
    let x = vehicle.position.x + cosine * 1.75;
    let z = vehicle.position.z - sine * 1.75;
    if (!canStand(x, z)) {
      x = vehicle.position.x - cosine * 1.75;
      z = vehicle.position.z + sine * 1.75;
    }
    if (!canStand(x, z)) return null;
    const model = makeOfficerModel(stage.scene, materials);
    model.group.name = `PDC officer ${nextOfficerId}`;
    const officer = {
      id: `pdc-officer-${nextOfficerId++}`,
      model,
      position: new THREE.Vector3(x, city.groundHeightAt(x, z), z),
      previousPosition: new THREE.Vector3(x, city.groundHeightAt(x, z), z),
      heading: vehicle.heading,
      previousHeading: vehicle.heading,
      health: 100,
      maxHealth: 100,
      armour: 35,
      maxArmour: 35,
      alive: true,
      dead: false,
      deathTimer: 0,
      fallSide: random() < 0.5 ? -1 : 1,
      state: 'advance',
      destination: null,
      coverTimer: 0,
      peekPosition: null,
      phase: random() * TAU,
      stride: 0,
      moving: false,
      shooting: false,
      shotCooldown: 0,
      burstCooldown: range(random, 0.45, 1.1),
      burstRemaining: 0,
      strafeDirection: random() < 0.5 ? -1 : 1,
      seesPlayer: false,
      cruiser,
      calloutCooldown: 0,
    };
    cruiser.officer = officer;
    officers.push(officer);
    stats.officersDeployed += 1;
    announce(CALL_OUTS.foot);
    return officer;
  }

  function damageOfficer(officer, amount, source = 'player') {
    if (!officer?.alive) return { applied: false, killed: false };
    const result = combat.damageCharacter(officer, amount, { source });
    if (!result.applied) return result;
    if (source === 'player') {
      reportCrime('officerHit', officer.position);
      if (result.killed) {
        stats.officersKilled += 1;
        reportCrime('officerKilled', officer.position);
      }
    }
    officer.shooting = false;
    return result;
  }

  function updateCruiser(cruiser, index, dt) {
    const vehicle = cruiser.vehicle;
    if (vehicle.control !== 'police') return;
    vehicle.siren = wanted > 0 && vehicle.health > 0;
    const playerPosition = player.state.position;
    const distance = Math.hypot(vehicle.position.x - playerPosition.x, vehicle.position.z - playerPosition.z);
    cruiser.lastDistance = distance;
    cruiser.seesPlayer = seenFrom(vehicle.position);
    if (cruiser.seesPlayer) lastSeen.copy(playerPosition);

    target.copy(cruiser.seesPlayer ? playerPosition : lastSeen);
    const playerVehicle = player.state.vehicle;
    if (index % 3 === 2 && playerVehicle && Math.abs(playerVehicle.speed) > 5) {
      target.x += playerVehicle.velocity.x * 0.65;
      target.z += playerVehicle.velocity.z * 0.65;
    }
    const desiredHeading = Math.atan2(target.x - vehicle.position.x, target.z - vehicle.position.z);
    const difference = shortAngle(desiredHeading - vehicle.heading);
    const shouldStop = !playerVehicle && distance < POLICE.officerExitDistance;
    cruiser.stopping = shouldStop;
    let wantedSpeed = wanted >= 3 ? POLICE.pursuitSpeed : POLICE.investigateSpeed;
    if (!cruiser.seesPlayer && wanted < 3) wantedSpeed *= 0.65;
    wantedSpeed *= THREE.MathUtils.clamp(1 - Math.abs(difference) * 0.45, 0.2, 1);
    if (shouldStop || vehicle.health <= 0) wantedSpeed = 0;
    let throttle = Math.abs(vehicle.speed) > wantedSpeed + 0.8 ? -1 : 1;
    let handbrake = false;
    if (wantedSpeed === 0 && Math.abs(vehicle.speed) < 0.35) {
      throttle = 0;
      handbrake = true;
    }
    vehicleSystem.driveAI(vehicle, {
      forward: throttle,
      right: -THREE.MathUtils.clamp(difference * 1.5, -1, 1),
      handbrake,
    }, dt);
    if (!playerVehicle && distance < POLICE.officerExitDistance && Math.abs(vehicle.speed) < 4.5) deployOfficer(cruiser);
  }

  function findCover(officer) {
    sightStart.copy(player.state.position);
    sightStart.y += 1.15;
    let best = null;
    let bestScore = Infinity;
    for (const collider of city.queryColliders(officer.position.x, officer.position.z, 34)) {
      if (collider.type !== 'building') continue;
      const corners = [
        [collider.minX - 0.85, collider.minZ - 0.85],
        [collider.maxX + 0.85, collider.minZ - 0.85],
        [collider.maxX + 0.85, collider.maxZ + 0.85],
        [collider.minX - 0.85, collider.maxZ + 0.85],
      ];
      for (const [x, z] of corners) {
        if (!canStand(x, z)) continue;
        const travel = Math.hypot(x - officer.position.x, z - officer.position.z);
        const playerDistance = Math.hypot(x - player.state.position.x, z - player.state.position.z);
        if (travel > 36 || playerDistance < 6 || playerDistance > 42) continue;
        sightEnd.set(x, city.groundHeightAt(x, z) + 1.35, z);
        if (hasWorldLineOfSight(city, sightStart, sightEnd)) continue;
        const score = travel + Math.abs(playerDistance - 13) * 0.4 + random() * 2;
        if (score >= bestScore) continue;
        let peek = null;
        const centerX = (collider.minX + collider.maxX) / 2;
        const centerZ = (collider.minZ + collider.maxZ) / 2;
        const options = Math.abs(x - centerX) > Math.abs(z - centerZ)
          ? [[x, z - 2.4], [x, z + 2.4]]
          : [[x - 2.4, z], [x + 2.4, z]];
        for (const [peekX, peekZ] of options) {
          if (!canStand(peekX, peekZ)) continue;
          sightEnd.set(peekX, city.groundHeightAt(peekX, peekZ) + 1.35, peekZ);
          if (hasWorldLineOfSight(city, sightStart, sightEnd)) {
            peek = new THREE.Vector3(peekX, city.groundHeightAt(peekX, peekZ), peekZ);
            break;
          }
        }
        best = {
          position: new THREE.Vector3(x, city.groundHeightAt(x, z), z),
          peek,
        };
        bestScore = score;
      }
    }
    return best;
  }

  function moveOfficer(officer, dt) {
    officer.moving = false;
    if (!officer.destination) return;
    const dx = officer.destination.x - officer.position.x;
    const dz = officer.destination.z - officer.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.25) return;
    const speed = officer.state === 'apprehend' || officer.state === 'cover' ? POLICE.officerRunSpeed : POLICE.officerWalkSpeed;
    const step = Math.min(distance, speed * dt);
    const nx = dx / distance;
    const nz = dz / distance;
    const nextX = officer.position.x + nx * step;
    const nextZ = officer.position.z + nz * step;
    if (canStand(nextX, nextZ)) {
      officer.position.x = nextX;
      officer.position.z = nextZ;
      officer.moving = true;
    } else {
      const sign = officer.strafeDirection;
      const sideX = officer.position.x - nz * step * sign;
      const sideZ = officer.position.z + nx * step * sign;
      if (canStand(sideX, sideZ)) {
        officer.position.x = sideX;
        officer.position.z = sideZ;
        officer.moving = true;
      } else {
        officer.strafeDirection *= -1;
      }
    }
    if (officer.moving) {
      const wantedHeading = Math.atan2(officer.position.x - officer.previousPosition.x, officer.position.z - officer.previousPosition.z);
      officer.heading += shortAngle(wantedHeading - officer.heading) * Math.min(1, dt * 12);
      officer.stride += dt * speed * 4.7;
    }
    officer.position.y = city.groundHeightAt(officer.position.x, officer.position.z);
  }

  function updateOfficer(officer, dt) {
    officer.previousPosition.copy(officer.position);
    officer.previousHeading = officer.heading;
    if (!officer.alive) {
      officer.deathTimer += dt;
      return;
    }
    officer.shotCooldown = Math.max(0, officer.shotCooldown - dt);
    officer.burstCooldown = Math.max(0, officer.burstCooldown - dt);
    officer.calloutCooldown = Math.max(0, officer.calloutCooldown - dt);
    officer.coverTimer = Math.max(0, officer.coverTimer - dt);
    const distance = Math.hypot(officer.position.x - player.state.position.x, officer.position.z - player.state.position.z);
    officer.seesPlayer = seenFrom(officer.position, POLICE.officerRange);
    if (officer.seesPlayer) lastSeen.copy(player.state.position);
    const playerStopped = !player.state.vehicle && Math.hypot(player.state.velocity.x, player.state.velocity.z) < 0.45;
    officer.destination = null;

    if (!player.state.vehicle && (distance < 13 || (playerStopped && distance < 24))) {
      officer.state = 'apprehend';
      if (distance > 2.15) officer.destination = player.state.position;
    } else if (officer.state === 'cover' || officer.state === 'peek') {
      if (officer.state === 'cover' && officer.coverTimer <= 0 && officer.peekPosition) {
        officer.state = 'peek';
        officer.destination = officer.peekPosition;
      } else if (officer.state === 'peek' && officer.position.distanceTo(officer.peekPosition) < 0.5) {
        officer.destination = null;
      } else {
        officer.destination = officer.state === 'cover' ? officer.coverPosition : officer.peekPosition;
      }
    } else if (distance > 18 || !officer.seesPlayer) {
      officer.state = 'advance';
      officer.destination = officer.seesPlayer ? player.state.position : lastSeen;
    } else {
      officer.state = 'strafe';
      const dx = player.state.position.x - officer.position.x;
      const dz = player.state.position.z - officer.position.z;
      const inverse = 1 / Math.max(0.001, distance);
      destination.set(
        officer.position.x - dz * inverse * officer.strafeDirection * 4,
        0,
        officer.position.z + dx * inverse * officer.strafeDirection * 4,
      );
      destination.y = city.groundHeightAt(destination.x, destination.z);
      officer.destination = destination;
    }
    moveOfficer(officer, dt);

    const arrestOpportunity = playerStopped && distance < POLICE.arrestWakeDistance;
    const canFire = officer.seesPlayer && distance < POLICE.officerRange && !arrestOpportunity
      && officer.state !== 'cover' && officer.state !== 'apprehend';
    officer.shooting = canFire;
    if (!canFire) return;

    const wantedHeading = Math.atan2(player.state.position.x - officer.position.x, player.state.position.z - officer.position.z);
    officer.heading += shortAngle(wantedHeading - officer.heading) * Math.min(1, dt * 14);
    if (officer.burstCooldown <= 0 && officer.burstRemaining <= 0) {
      officer.burstRemaining = Math.floor(range(random, POLICE.officerBurstMinimum, POLICE.officerBurstMaximum + 1));
      if (officer.calloutCooldown <= 0) {
        announce(random() < 0.5 ? CALL_OUTS.burst : CALL_OUTS.cover);
        officer.calloutCooldown = 7;
      }
    }
    if (officer.burstRemaining > 0 && officer.shotCooldown <= 0) {
      combat.firePoliceWeapon(officer);
      officer.burstRemaining -= 1;
      officer.shotCooldown = POLICE.officerFireInterval;
      if (officer.burstRemaining === 0) {
        officer.burstCooldown = POLICE.officerBurstPause + random() * 0.7;
        if (random() < 0.72) {
          const cover = findCover(officer);
          if (cover) {
            officer.state = 'cover';
            officer.coverPosition = cover.position;
            officer.peekPosition = cover.peek || cover.position;
            officer.coverTimer = 0.8 + random() * 0.8;
            officer.shooting = false;
          }
        }
      }
    } else if (!officer.seesPlayer) {
      stats.shotsAvoidedByCover += 1;
    }
  }

  function updateArrest(dt) {
    if (wanted <= 0 || player.state.vehicle || player.state.dead) {
      arrestTimer = 0;
      return;
    }
    const stopped = player.state.grounded && Math.hypot(player.state.velocity.x, player.state.velocity.z) < 0.45;
    const closeOfficer = officers.some((officer) => officer.alive
      && Math.hypot(officer.position.x - player.state.position.x, officer.position.z - player.state.position.z) <= POLICE.arrestDistance);
    if (!stopped || !closeOfficer) {
      arrestTimer = 0;
      return;
    }
    if (arrestTimer === 0) announce(CALL_OUTS.arrest, 2.2);
    arrestTimer += dt;
    if (arrestTimer >= POLICE.arrestDuration) beginOutcome('busted');
  }

  function beginOutcome(type) {
    if (phase !== 'playing') return false;
    phase = type;
    outcomeTimer = 0;
    outcomeRespawned = false;
    outcomeFee = type === 'busted' ? POLICE.bustedFine : POLICE.wastedFee;
    arrestTimer = 0;
    lastOutcome = { type, fee: outcomeFee, completed: false };
    if (type === 'wasted') {
      stats.deaths += 1;
      player.state.dead = true;
      player.state.health = 0;
    } else {
      stats.arrests += 1;
    }
    if (vehicleSystem.activeVehicle) vehicleSystem.exit();
    calloutTimer = 0;
    combat.updateSirens([], player.state.position);
    return true;
  }

  function handlePlayerDeath() {
    return beginOutcome('wasted');
  }

  function respawnForOutcome() {
    const busted = phase === 'busted';
    clearWanted();
    if (busted) combat.reduceAmmoAfterArrest();
    combat.restorePlayer(player.state.maxHealth, busted ? player.state.armour : 0);
    if (context?.progress) {
      context.progress.money = Math.max(0, context.progress.money - outcomeFee);
      player.state.money = context.progress.money;
    } else {
      player.state.money = Math.max(0, (player.state.money ?? 0) - outcomeFee);
    }
    player.teleport(busted ? POLICE.station : POLICE.hospital);
    player.mesh.rotation.z = 0;
    outcomeRespawned = true;
    lastOutcome.completed = true;
  }

  function updateOutcome(dt) {
    outcomeTimer += dt;
    if (phase === 'wasted') player.mesh.rotation.z = -Math.min(Math.PI / 2, outcomeTimer * 2.7);
    if (!outcomeRespawned && outcomeTimer >= POLICE.outcomeRespawnAt) respawnForOutcome();
    if (outcomeTimer >= POLICE.outcomeDuration) {
      phase = 'playing';
      outcomeTimer = 0;
      outcomeRespawned = false;
    }
  }

  function updateWanted(dt) {
    if (wanted <= 0) return;
    let seen = false;
    for (const cruiser of cruisers) {
      if (cruiser.seesPlayer || seenFrom(cruiser.vehicle.position)) {
        seen = true;
        break;
      }
    }
    if (!seen) seen = officers.some((officer) => officer.alive && officer.seesPlayer);
    if (seen) outOfSightTimer = 0;
    else outOfSightTimer += dt;
    if (outOfSightTimer >= POLICE.outOfSightDecayDelay) {
      wanted -= 1;
      heat = POLICE.heatThresholds[wanted];
      outOfSightTimer = 0;
      stats.starsDecayed += 1;
      if (wanted === 0) clearUnits();
      else announce(`PDC dispatch: search narrowing. ${wanted} star${wanted === 1 ? '' : 's'} remain.`);
    }
  }

  function update(dt, nextContext) {
    context = nextContext;
    if (phase !== 'playing') {
      updateOutcome(dt);
      return;
    }
    elapsed += dt;
    calloutTimer = Math.max(0, calloutTimer - dt);
    spawnTimer = Math.max(0, spawnTimer - dt);

    const entered = player.state.vehicle;
    if (entered?.justEntered) witnessCrime('vehicleTheft', entered.position);
    updateWanted(dt);
    const desiredCruisers = POLICE.cruiserCounts[wanted];
    if (wanted === 0 && cruisers.length) clearUnits();
    while (cruisers.length > desiredCruisers) {
      const cruiser = cruisers.pop();
      if (cruiser.officer) removeOfficer(cruiser.officer);
      if (cruiser.vehicle.control === 'police') vehicleSystem.removeVehicle(cruiser.vehicle);
    }
    if (spawnTimer <= 0 && cruisers.length < desiredCruisers) {
      spawnCruiser(player.state.position);
      spawnTimer = 0.75;
    }
    for (let index = 0; index < cruisers.length; index += 1) updateCruiser(cruisers[index], index, dt);
    for (const officer of [...officers]) updateOfficer(officer, dt);
    updateArrest(dt);
    if (phase === 'playing') combat.updateSirens(cruisers, player.state.position);
  }

  function render(alpha) {
    for (const officer of officers) {
      const model = officer.model;
      renderPosition.lerpVectors(officer.previousPosition, officer.position, alpha);
      model.group.position.copy(renderPosition);
      model.group.rotation.y = officer.previousHeading + shortAngle(officer.heading - officer.previousHeading) * alpha;
      model.group.rotation.z = officer.alive ? 0 : officer.fallSide * Math.min(Math.PI / 2, officer.deathTimer * 3.2);
      if (!officer.alive) {
        model.group.position.y += 0.15;
        continue;
      }
      const stride = officer.moving ? Math.sin(officer.stride) * 0.58 : 0;
      model.leftLeg.rotation.x = stride;
      model.rightLeg.rotation.x = -stride;
      if (officer.shooting) {
        model.leftArm.rotation.x = -1.18;
        model.rightArm.rotation.x = -1.3;
        model.leftArm.rotation.z = -0.25;
      } else {
        model.leftArm.rotation.x = -stride * 0.75;
        model.rightArm.rotation.x = stride * 0.75;
        model.leftArm.rotation.z = 0;
      }
    }
  }

  function drawStar(g, x, y, outer, inner) {
    g.beginPath();
    for (let point = 0; point < 10; point += 1) {
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const radius = point % 2 === 0 ? outer : inner;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (point === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  }

  function drawHUD(g) {
    const ratio = g.canvas.width / Math.max(1, window.innerWidth);
    const width = window.innerWidth;
    const height = window.innerHeight;
    g.save();
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.textBaseline = 'alphabetic';
    for (let star = 0; star < POLICE.maximumWanted; star += 1) {
      const x = width - 32 - (POLICE.maximumWanted - 1 - star) * 31;
      drawStar(g, x, 39, 12, 5.2);
      g.fillStyle = star < wanted ? '#f1bf62' : 'rgba(14, 30, 36, 0.55)';
      g.fill();
      g.strokeStyle = star < wanted ? '#fff0b8' : 'rgba(215, 226, 215, 0.38)';
      g.lineWidth = 1.2;
      g.stroke();
    }
    if (wanted > 0) {
      g.fillStyle = '#e5d5ae';
      g.font = '700 10px sans-serif';
      g.textAlign = 'right';
      g.fillText(`PDC HEAT ${wanted} · ${Math.round(heat)}`, width - 20, 64);
      g.textAlign = 'left';
    }
    if (arrestTimer > 0) {
      const barWidth = 180;
      const x = (width - barWidth) / 2;
      g.fillStyle = 'rgba(15, 28, 34, 0.8)';
      g.fillRect(x - 9, height * 0.68 - 19, barWidth + 18, 38);
      g.fillStyle = '#e7dcc1';
      g.font = '700 10px sans-serif';
      g.fillText('HOLD STILL — PDC ARREST', x, height * 0.68 - 5);
      g.fillStyle = '#3d5962';
      g.fillRect(x, height * 0.68 + 2, barWidth, 5);
      g.fillStyle = '#e3bb67';
      g.fillRect(x, height * 0.68 + 2, barWidth * arrestTimer / POLICE.arrestDuration, 5);
    }
    if (calloutTimer > 0 && callout) {
      g.font = '600 12px sans-serif';
      const calloutWidth = Math.min(width - 40, g.measureText(callout).width + 28);
      const x = (width - calloutWidth) / 2;
      g.fillStyle = 'rgba(14, 31, 38, 0.8)';
      g.fillRect(x, 82, calloutWidth, 32);
      g.fillStyle = '#d9e7df';
      g.textAlign = 'center';
      g.fillText(callout, width / 2, 102);
      g.textAlign = 'left';
    }
    if (phase !== 'playing') {
      let fade = Math.min(1, outcomeTimer / POLICE.outcomeFadeIn);
      if (outcomeTimer > POLICE.outcomeRespawnAt) {
        fade = Math.max(0, 1 - (outcomeTimer - POLICE.outcomeRespawnAt) / (POLICE.outcomeDuration - POLICE.outcomeRespawnAt));
      }
      g.fillStyle = `rgba(3, 7, 9, ${fade})`;
      g.fillRect(0, 0, width, height);
      if (fade > 0.58) {
        g.globalAlpha = Math.min(1, (fade - 0.58) * 3);
        g.textAlign = 'center';
        g.fillStyle = phase === 'wasted' ? '#e9ded0' : '#e4c47e';
        g.font = '800 54px sans-serif';
        g.fillText(phase.toUpperCase(), width / 2, height / 2);
        g.fillStyle = '#c3cfca';
        g.font = '600 14px sans-serif';
        g.fillText(`${phase === 'busted' ? 'PDC STATION' : 'COBALTO HOSPITAL'}  ·  FEE $${outcomeFee}`, width / 2, height / 2 + 33);
        g.textAlign = 'left';
        g.globalAlpha = 1;
      }
    }
    g.restore();
  }

  return {
    cruisers,
    officers,
    stats,
    get wanted() { return wanted; },
    get heat() { return heat; },
    get phase() { return phase; },
    get inputLocked() { return phase !== 'playing'; },
    get arrestProgress() { return arrestTimer; },
    get outOfSightTime() { return outOfSightTimer; },
    get callout() { return calloutTimer > 0 ? callout : ''; },
    get lastCrime() { return lastCrime; },
    get lastOutcome() { return lastOutcome; },
    get outcomeFee() { return outcomeFee; },
    addHeat,
    reportCrime,
    witnessCrime,
    setWanted,
    clearWanted,
    spawnCruiser,
    damageOfficer,
    handlePlayerDeath,
    bustPlayer: () => beginOutcome('busted'),
    beginOutcome,
    update,
    render,
    drawHUD,
  };
}
