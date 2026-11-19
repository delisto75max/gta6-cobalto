// The eight-mission story chain, physical objective markers, compact dialogue and mission actors.
// All narrative state is data; session 5 can replace drawHUD without changing the mission engine.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

export const MISSION_LOCATIONS = Object.freeze({
  station: { x: 62, z: 289 },
  laMarea: { x: 62, z: 565 },
  marinaViento: { x: -225, z: 553.15, heading: -Math.PI / 2 },
  containerYard: { x: -310, z: 434 },
  market: { x: -124, z: 53 },
  barRear: { x: 62, z: 535 },
  beach: { x: 62, z: 550 },
  cerroAlto: { x: 372, z: -290 },
  docksExit: { x: -310, z: 548 },
  warehouse: { x: -372, z: 434 },
  lighthouse: { x: 535, z: 555 },
});

export const MISSION_SPEAKERS = Object.freeze({
  rafa: { name: 'Rafa Cordero', color: '#e7bd79', monogram: 'RC' },
  lucia: { name: 'Lucía Cordero', color: '#ef9f83', monogram: 'LC' },
  rueda: { name: 'Don Ismael Rueda', color: '#bf9bc8', monogram: 'IR' },
  tavo: { name: 'Tavo Méndez', color: '#e58b67', monogram: 'TM' },
  salas: { name: 'Capitán Verónica Salas', color: '#82b8cf', monogram: 'VS' },
  nico: { name: 'Nico Reyes', color: '#89b99a', monogram: 'NR' },
});

const amber = '#f2bd68';
const red = '#ee8068';
const teal = '#72c5bd';

export const MISSION_DEFINITIONS = Object.freeze([
  {
    id: 'homecoming', number: 1, title: 'Homecoming', giver: 'lucia', marker: MISSION_LOCATIONS.station,
    color: amber, reward: 150, unlock: 'safehouse:bar',
    intro: [
      ['lucia', 'There he is. Five years, and still the same stubborn walk.'],
      ['rafa', 'Get me out of this street, Lucía.'],
    ],
    outro: [
      ['lucia', 'You look older.'],
      ['rafa', "You look like you haven't slept."],
      ['lucia', "The bar is in trouble. Rueda owns the debt."],
    ],
    steps: [
      { type: 'steal', marker: null, text: 'Steal any parked car' },
      { type: 'deliver', marker: MISSION_LOCATIONS.laMarea, text: 'Drive to La Marea' },
    ],
  },
  {
    id: 'the-debt', number: 2, title: 'The Debt', giver: 'lucia', marker: MISSION_LOCATIONS.laMarea,
    color: amber, reward: 400, unlock: 'weapon:cobre9',
    intro: [
      ['lucia', 'Tavo wants a Viento from the marina. Do this, and he buys us a week.'],
      ['rafa', 'A week is enough to find another answer.'],
    ],
    outro: [
      ['tavo', 'Clean car, clean hands; Rueda might start liking you.'],
      ['rafa', 'Tell him the week belongs to Lucía.'],
    ],
    steps: [
      { type: 'steal', marker: MISSION_LOCATIONS.marinaViento, text: 'Steal the Viento GT at La Marina', vehicle: 'viento' },
      { type: 'deliver', marker: MISSION_LOCATIONS.containerYard, text: 'Leave the Viento in the container bay', vehicle: 'viento' },
    ],
  },
  {
    id: 'dockside', number: 3, title: 'Dockside', giver: 'tavo', marker: MISSION_LOCATIONS.containerYard,
    color: teal, reward: 600, unlock: 'armour:plate',
    intro: [
      ['tavo', 'Customs passes soon. Take the little grey case and run.'],
      ['rafa', 'You always leave out the part with sirens.'],
    ],
    outro: [
      ['tavo', 'See? No customs, no problem.'],
      ['salas', 'Cordero, I know that silhouette. Next time, I will know the plate.'],
    ],
    steps: [
      { type: 'goto', marker: MISSION_LOCATIONS.containerYard, text: 'Drive to the container yard' },
      { type: 'talk', marker: { x: -326, z: 432 }, text: 'Pick up the package on foot' },
      { type: 'escape', marker: MISSION_LOCATIONS.market, text: 'Lose the two-star response, then reach Mercado Viejo' },
    ],
  },
  {
    id: 'paper-trail', number: 4, title: 'Paper Trail', giver: 'nico', marker: MISSION_LOCATIONS.barRear,
    color: teal, reward: 700, unlock: 'weapon:smg',
    intro: [
      ['nico', 'That Mula carries names to the PDC. Follow it, but give the driver air.'],
      ['rafa', 'Twenty metres of doubt. Sixty metres of patience.'],
    ],
    outro: [
      ['nico', 'A whole list of whispers, and the engine still runs.'],
      ['rafa', 'Now we find out who has been talking.'],
    ],
    steps: [
      { type: 'tail', marker: { x: 62, z: 492 }, text: "Tail Tavo's courier for 60 seconds", seconds: 60, vehicle: 'mula' },
      { type: 'steal', marker: null, text: 'Steal the courier Mula', vehicle: 'mula' },
      { type: 'deliver', marker: MISSION_LOCATIONS.barRear, text: 'Park the Mula behind La Marea', vehicle: 'mula' },
    ],
  },
  {
    id: 'the-exchange', number: 5, title: 'The Exchange', giver: 'rueda', marker: MISSION_LOCATIONS.containerYard,
    color: red, reward: 900, unlock: 'safehouse:market',
    intro: [
      ['rueda', 'A simple exchange on the boardwalk. Smile if anyone points a gun.'],
      ['rafa', 'And if they point it at Lucía?'],
      ['rueda', 'Then stop smiling.'],
    ],
    outro: [
      ['lucia', 'You came back for me. That is the part I will remember.'],
      ['rafa', 'Get inside. I will make sure nobody follows.'],
    ],
    steps: [
      { type: 'goto', marker: MISSION_LOCATIONS.beach, text: 'Drive to the Playa Dorada exchange' },
      { type: 'survive', marker: MISSION_LOCATIONS.beach, text: 'Survive the ambush', count: 6 },
      { type: 'deliver', marker: MISSION_LOCATIONS.market, text: 'Drive Lucía to her apartment' },
    ],
  },
  {
    id: 'heat', number: 6, title: 'Heat', giver: 'rueda', marker: MISSION_LOCATIONS.containerYard,
    color: red, reward: 1200, unlock: 'vehicle:tiburon',
    intro: [
      ['rueda', 'You learned the shape of my business too quickly, Rafa.'],
      ['salas', 'All units: Cordero is leaving the docks. Bring him in breathing.'],
    ],
    outro: [
      ['lucia', 'The scanner went quiet. Did you disappear?'],
      ['rafa', 'For tonight. That has to be enough.'],
    ],
    steps: [
      { type: 'goto', marker: MISSION_LOCATIONS.docksExit, text: 'Leave the docks through the PDC cordon' },
      { type: 'escape', marker: MISSION_LOCATIONS.cerroAlto, text: 'Lose the PDC in Cerro Alto' },
      { type: 'goto', marker: MISSION_LOCATIONS.laMarea, text: 'Reach the La Marea safehouse' },
    ],
  },
  {
    id: 'salt-in-the-wound', number: 7, title: 'Salt in the Wound', giver: 'rafa', marker: MISSION_LOCATIONS.laMarea,
    color: red, reward: 2000, unlock: 'weapon:rompe',
    intro: [
      ['rafa', 'The warehouse ledger has your name in it, Lucía.'],
      ['lucia', 'Then bring it home. Or make sure nobody can read it again.'],
    ],
    outro: [],
    steps: [
      { type: 'goto', marker: MISSION_LOCATIONS.warehouse, text: 'Raid the warehouse at El Astillero' },
      { type: 'kill', marker: MISSION_LOCATIONS.warehouse, text: 'Fight through the warehouse guards', count: 8 },
      { type: 'talk', marker: { x: -350, z: 437 }, text: 'Take the ledger · B burn it / K keep it' },
    ],
  },
  {
    id: 'cobalto-sunset', number: 8, title: 'Cobalto Sunset', giver: 'rafa', marker: MISSION_LOCATIONS.laMarea,
    color: amber, reward: 5000, unlock: 'safehouse:lighthouse',
    intro: [
      ['nico', "Rueda's Marea is heading east on the coast road. This is his last exit."],
      ['rafa', 'Then we watch the sun go down at the lighthouse.'],
    ],
    outro: [],
    steps: [
      { type: 'tail', marker: MISSION_LOCATIONS.laMarea, text: "Chase Rueda's Marea 4x4 along the coast road", seconds: 45, vehicle: 'marea' },
      { type: 'kill', marker: MISSION_LOCATIONS.lighthouse, text: 'Face Rueda at the lighthouse', count: 1 },
      { type: 'talk', marker: MISSION_LOCATIONS.lighthouse, text: 'Finish it at the lighthouse' },
    ],
  },
]);

const TAIL_ROUTE = [
  { x: 62, z: 496 }, { x: 62, z: 310 }, { x: -62, z: 310 }, { x: -62, z: 62 },
  { x: 62, z: 62 }, { x: 62, z: -186 }, { x: 186, z: -186 }, { x: 186, z: 62 },
  { x: 62, z: 62 }, { x: 62, z: 310 }, { x: 62, z: 496 }, { x: 186, z: 558 },
  { x: 62, z: 558 }, { x: 62, z: 496 },
];
const CHASE_ROUTE = [
  { x: 62, z: 496 }, { x: 62, z: 550 }, { x: 186, z: 550 }, { x: 310, z: 550 },
  { x: 434, z: 550 }, { x: 535, z: 550 }, { x: 535, z: 555 },
];
const GUARD_OFFSETS = [
  [-15, -11], [-7, 13], [5, -14], [14, 8], [-18, 5], [18, -5], [-5, -20], [9, 19],
];

function inside(position, marker, radius) {
  return Boolean(marker) && Math.hypot(position.x - marker.x, position.z - marker.z) <= radius;
}

function angleDifference(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function makeBox(parent, material, x, y, z, width, height, depth) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createMissions(stage, city, progress) {
  let state = 'idle';
  let current = null;
  let currentIndex = -1;
  let stepIndex = 0;
  let stepElapsed = 0;
  let result = null;
  let resultElapsed = 0;
  let objective = '';
  let dialogue = null;
  let killCount = 0;
  let tailSeconds = 0;
  let tailDistance = Infinity;
  let abandonTimer = 0;
  let stoppedTimer = 0;
  let markerPosition = null;
  let missionVehicle = null;
  let routeIndex = 0;
  let context = null;
  let dialogueClock = 0;
  let elapsed = 0;
  let modelSequence = 1;
  const dialogueQueue = [];
  const targets = [];
  const ownedVehicles = [];
  const enteredSafehouses = new Set();
  const pressedChoices = new Set();

  const marker = new THREE.Group();
  marker.name = 'Mission objective marker';
  const beamMaterial = new THREE.MeshBasicMaterial({
    color: amber, transparent: true, opacity: 0.12, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 2.15, 13, 32, 1, true), beamMaterial);
  beam.position.y = 6.5;
  marker.add(beam);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: amber, transparent: true, opacity: 0.72, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.75, 3.25, 64), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.09;
  marker.add(ring);
  const markerLight = new THREE.PointLight(amber, 4, 17, 2);
  markerLight.position.y = 2.1;
  marker.add(markerLight);
  marker.visible = false;
  stage.scene.add(marker);

  const actorMaterials = {
    guard: new THREE.MeshStandardMaterial({ color: '#783f37', roughness: 0.85 }),
    rueda: new THREE.MeshStandardMaterial({ color: '#3f2d49', roughness: 0.8 }),
    shirt: new THREE.MeshStandardMaterial({ color: '#c6a17c', roughness: 0.9 }),
    trousers: new THREE.MeshStandardMaterial({ color: '#29343b', roughness: 0.9 }),
    skin: new THREE.MeshStandardMaterial({ color: '#ad7954', roughness: 0.9 }),
    weapon: new THREE.MeshStandardMaterial({ color: '#242c30', roughness: 0.5, metalness: 0.4 }),
  };

  function speakerLine(speaker, line) {
    const portrait = MISSION_SPEAKERS[speaker] || MISSION_SPEAKERS.rafa;
    return {
      speaker, line, until: dialogueClock + MISSIONS.dialogueSeconds,
      name: portrait.name, color: portrait.color, monogram: portrait.monogram,
    };
  }

  function say(speaker, line) {
    if (!MISSION_SPEAKERS[speaker] || typeof line !== 'string' || !line) return false;
    dialogueQueue.push({ speaker, line });
    if (!dialogue) {
      const next = dialogueQueue.shift();
      dialogue = speakerLine(next.speaker, next.line);
    }
    return true;
  }

  function sayAll(lines) {
    for (const [speaker, line] of lines || []) say(speaker, line);
  }

  function updateDialogue(dt) {
    dialogueClock += dt;
    if (dialogue && dialogueClock >= dialogue.until) dialogue = null;
    if (!dialogue && dialogueQueue.length) {
      const next = dialogueQueue.shift();
      dialogue = speakerLine(next.speaker, next.line);
    }
  }

  function missionRadius(ctx) {
    return ctx.vehicles.activeVehicle ? MISSIONS.triggerVehicle : MISSIONS.triggerOnFoot;
  }

  function matchingActiveVehicle(vehicleKey) {
    const active = context?.vehicles.activeVehicle;
    if (!active) return false;
    if (!vehicleKey) return true;
    if (active.type !== vehicleKey) return false;
    if (current?.id === 'paper-trail' || current?.id === 'cobalto-sunset') return active === missionVehicle;
    if (current?.id === 'the-debt') return active === missionVehicle;
    return true;
  }

  function makeActor(position, role = 'guard') {
    const group = new THREE.Group();
    group.name = role === 'rueda' ? 'Don Ismael Rueda' : `Warehouse gunman ${modelSequence}`;
    const clothing = role === 'rueda' ? actorMaterials.rueda : actorMaterials.guard;
    makeBox(group, clothing, 0, 1.25, 0, 0.58, 0.67, 0.34);
    makeBox(group, actorMaterials.shirt, 0, 1.43, 0.18, 0.28, 0.25, 0.035);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 10, 8), actorMaterials.skin);
    head.position.y = 1.76;
    head.castShadow = true;
    group.add(head);
    function limb(x, material) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 1.48, 0);
      makeBox(pivot, material, 0, -0.31, 0, 0.18, 0.63, 0.2);
      group.add(pivot);
      return pivot;
    }
    const leftArm = limb(-0.39, clothing);
    const rightArm = limb(0.39, clothing);
    makeBox(rightArm, actorMaterials.weapon, 0, -0.62, 0.16, 0.12, 0.12, 0.4);
    makeBox(group, actorMaterials.trousers, -0.16, 0.54, 0, 0.23, 0.9, 0.26);
    makeBox(group, actorMaterials.trousers, 0.16, 0.54, 0, 0.23, 0.9, 0.26);
    group.position.copy(position);
    stage.scene.add(group);
    const actor = {
      id: `mission-actor-${modelSequence++}`,
      missionTarget: true, role, model: { group, leftArm, rightArm },
      position: position.clone(), previousPosition: position.clone(),
      heading: 0, health: role === 'rueda' ? 130 : 70, maxHealth: role === 'rueda' ? 130 : 70,
      armour: role === 'rueda' ? 35 : 0, maxArmour: role === 'rueda' ? 35 : 100,
      alive: true, dead: false, deathTimer: 0, shotCooldown: 0.55 + modelSequence * 0.06,
      shooting: false, stride: 0,
    };
    targets.push(actor);
    return actor;
  }

  function spawnGuards(center, count, role = 'guard') {
    for (let index = 0; index < count; index += 1) {
      const [offsetX, offsetZ] = GUARD_OFFSETS[index % GUARD_OFFSETS.length];
      const x = center.x + offsetX;
      const z = center.z + offsetZ;
      makeActor(new THREE.Vector3(x, city.groundHeightAt(x, z), z), role);
    }
  }

  function clearTargets() {
    for (const actor of targets) {
      stage.scene.remove(actor.model.group);
      actor.model.group.traverse((child) => child.geometry?.dispose());
    }
    targets.length = 0;
  }

  function spawnMissionVehicle(type, placement) {
    const vehicle = context.vehicles.spawnVehicle({
      type, x: placement.x, z: placement.z, heading: placement.heading ?? 0,
      control: 'mission', color: type === 'marea' ? '#51354f' : '#d7b54d', accent: '#e3d6b4',
    });
    ownedVehicles.push(vehicle);
    missionVehicle = vehicle;
    routeIndex = 1;
    return vehicle;
  }

  function stopOwnedVehicles() {
    for (const vehicle of ownedVehicles) {
      if (vehicle.control === 'removed' || vehicle.control === 'player') continue;
      vehicle.control = 'parked';
      vehicle.velocity.set(0, 0, 0);
      vehicle.speed = 0;
    }
  }

  function removeOwnedVehicles() {
    if (!context) {
      ownedVehicles.length = 0;
      missionVehicle = null;
      return;
    }
    for (const vehicle of ownedVehicles) {
      if (vehicle === context.vehicles.activeVehicle) continue;
      context.vehicles.removeVehicle(vehicle);
    }
    ownedVehicles.length = 0;
    missionVehicle = null;
  }

  function currentStep() {
    return state === 'active' ? current?.steps[stepIndex] ?? null : null;
  }

  function nearestStepVehicle(step) {
    let nearest = null;
    let distance = Infinity;
    for (const vehicle of context.vehicles.vehicles) {
      if (vehicle.police || vehicle === context.vehicles.activeVehicle || vehicle.control === 'removed') continue;
      if (step.vehicle) {
        if (vehicle.type !== step.vehicle) continue;
        if ((current.id === 'paper-trail' || current.id === 'the-debt') && vehicle !== missionVehicle) continue;
      }
      const nextDistance = Math.hypot(
        vehicle.position.x - context.player.state.position.x,
        vehicle.position.z - context.player.state.position.z,
      );
      if (nextDistance < distance) {
        nearest = vehicle;
        distance = nextDistance;
      }
    }
    return nearest?.position || null;
  }

  function updateMarkerPosition() {
    markerPosition = null;
    if (state === 'active') {
      const step = currentStep();
      if (!step) return;
      if (step.type === 'steal') markerPosition = step.marker || nearestStepVehicle(step);
      else if (step.type === 'tail' && missionVehicle) markerPosition = missionVehicle.position;
      else if ((step.type === 'kill' || step.type === 'survive') && targets.some((actor) => actor.alive)) {
        let nearest = Infinity;
        for (const actor of targets) {
          if (!actor.alive) continue;
          const distance = Math.hypot(actor.position.x - context.player.state.position.x, actor.position.z - context.player.state.position.z);
          if (distance < nearest) {
            nearest = distance;
            markerPosition = actor.position;
          }
        }
      } else markerPosition = step.marker || missionVehicle?.position || null;
    } else if (state === 'idle') {
      const next = MISSION_DEFINITIONS[Math.min(progress.mission, MISSION_DEFINITIONS.length - 1)];
      if (progress.mission < MISSION_DEFINITIONS.length) markerPosition = next.marker;
      else markerPosition = MISSION_LOCATIONS.lighthouse;
    }
  }

  function markerColor() {
    if (state === 'idle') {
      const next = MISSION_DEFINITIONS[Math.min(progress.mission, MISSION_DEFINITIONS.length - 1)];
      return MISSION_SPEAKERS[next.giver]?.color || amber;
    }
    const type = currentStep()?.type;
    return type === 'kill' || type === 'survive' ? red : current?.color || amber;
  }

  function updateWorldMarker() {
    updateMarkerPosition();
    marker.visible = Boolean(markerPosition) && state !== 'complete' && state !== 'failed';
    if (!marker.visible) return;
    const color = markerColor();
    beamMaterial.color.set(color);
    ringMaterial.color.set(color);
    markerLight.color.set(color);
    const ground = city.groundHeightAt(markerPosition.x, markerPosition.z);
    marker.position.set(markerPosition.x, ground + 0.025, markerPosition.z);
    const pulse = 1 + Math.sin(elapsed * 3.4) * 0.075;
    ring.scale.setScalar(pulse);
    ring.rotation.z = elapsed * 0.32;
    beamMaterial.opacity = 0.105 + Math.sin(elapsed * 2.2) * 0.025;
    markerLight.intensity = 3.5 + Math.sin(elapsed * 3.4) * 1.2;
  }

  function driveMissionVehicle(route, desiredSpeed, dt, stopped = false) {
    if (!missionVehicle || missionVehicle.control === 'removed' || missionVehicle === context.vehicles.activeVehicle) return;
    if (stopped) {
      context.vehicles.driveAI(missionVehicle, { forward: 0, right: 0, handbrake: true }, dt);
      return;
    }
    const waypoint = route[Math.min(routeIndex, route.length - 1)];
    const dx = waypoint.x - missionVehicle.position.x;
    const dz = waypoint.z - missionVehicle.position.z;
    if (Math.hypot(dx, dz) < 9 && routeIndex < route.length - 1) routeIndex += 1;
    const target = route[Math.min(routeIndex, route.length - 1)];
    const wantedHeading = Math.atan2(target.x - missionVehicle.position.x, target.z - missionVehicle.position.z);
    const difference = angleDifference(wantedHeading - missionVehicle.heading);
    const atEnd = routeIndex >= route.length - 1 && Math.hypot(target.x - missionVehicle.position.x, target.z - missionVehicle.position.z) < 9;
    const speed = atEnd ? 0 : desiredSpeed;
    context.vehicles.driveAI(missionVehicle, {
      forward: atEnd ? 0 : Math.abs(missionVehicle.speed) > speed ? -0.35 : 1,
      right: -THREE.MathUtils.clamp(difference * 1.6, -1, 1),
      handbrake: atEnd,
    }, dt);
  }

  function actorCanStand(x, z) {
    for (const collider of city.queryColliders(x, z, 0.48)) {
      const nearestX = THREE.MathUtils.clamp(x, collider.minX, collider.maxX);
      const nearestZ = THREE.MathUtils.clamp(z, collider.minZ, collider.maxZ);
      if (Math.hypot(x - nearestX, z - nearestZ) < 0.42) return false;
    }
    return true;
  }

  function updateTargets(dt) {
    const playerPosition = context.player.state.position;
    for (const actor of targets) {
      actor.previousPosition.copy(actor.position);
      if (!actor.alive) {
        actor.deathTimer += dt;
        actor.model.group.rotation.z = Math.min(Math.PI / 2, actor.deathTimer * 3.4);
        actor.model.group.position.copy(actor.position);
        continue;
      }
      actor.shotCooldown = Math.max(0, actor.shotCooldown - dt);
      const dx = playerPosition.x - actor.position.x;
      const dz = playerPosition.z - actor.position.z;
      const distance = Math.hypot(dx, dz);
      actor.heading = Math.atan2(dx, dz);
      let moving = false;
      if (distance > 14 && distance < 95 && !context.player.state.vehicle) {
        const step = Math.min(distance, MISSIONS.enemyMoveSpeed * dt);
        const nextX = actor.position.x + dx / Math.max(distance, 0.001) * step;
        const nextZ = actor.position.z + dz / Math.max(distance, 0.001) * step;
        if (actorCanStand(nextX, nextZ)) {
          actor.position.x = nextX;
          actor.position.z = nextZ;
          moving = true;
        }
      }
      actor.position.y = city.groundHeightAt(actor.position.x, actor.position.z);
      actor.stride += dt * (moving ? 8 : 2);
      actor.shooting = distance < MISSIONS.enemyRange && !context.police.inputLocked && !context.player.state.dead;
      if (actor.shooting && actor.shotCooldown <= 0) {
        context.combat.firePoliceWeapon(actor);
        actor.shotCooldown = MISSIONS.enemyFireInterval + (Number(actor.id.split('-').pop()) % 4) * 0.13;
      }
      actor.model.group.position.copy(actor.position);
      actor.model.group.rotation.y = actor.heading;
      actor.model.group.rotation.z = 0;
      actor.model.leftArm.rotation.x = actor.shooting ? -1.18 : moving ? Math.sin(actor.stride) * 0.5 : 0;
      actor.model.rightArm.rotation.x = actor.shooting ? -1.28 : moving ? -Math.sin(actor.stride) * 0.5 : 0;
    }
    if (state === 'active') recountKills();
  }

  function recountKills() {
    killCount = targets.reduce((sum, actor) => sum + (!actor.alive && actor.missionTarget ? 1 : 0), 0);
  }

  function enterStep() {
    const step = currentStep();
    if (!step) return;
    stepElapsed = 0;
    objective = step.text;
    killCount = 0;
    tailSeconds = 0;
    tailDistance = Infinity;
    abandonTimer = 0;
    stoppedTimer = 0;
    markerPosition = step.marker || null;
    clearTargets();
    if (step.type !== 'steal' && current.id !== 'the-debt' && current.id !== 'paper-trail' && current.id !== 'cobalto-sunset') missionVehicle = null;

    if (current.id === 'the-debt' && stepIndex === 0) spawnMissionVehicle('viento', MISSION_LOCATIONS.marinaViento);
    if (current.id === 'dockside' && stepIndex === 2) {
      context.police.setWanted(2);
      say('salas', 'PDC to Cordero: put the case down. You are making this very easy.');
    }
    if (current.id === 'paper-trail') {
      if (stepIndex === 0) {
        spawnMissionVehicle('mula', { ...TAIL_ROUTE[0], heading: Math.PI });
        say('nico', 'There it goes. Keep between twenty and sixty metres.');
      }
      if (stepIndex === 1 && missionVehicle) stopOwnedVehicles();
    }
    if (step.type === 'survive') {
      spawnGuards(step.marker, step.count);
      say('tavo', 'That was not our deal! Rafa, behind you!');
    }
    if (current.id === 'salt-in-the-wound' && step.type === 'kill') {
      spawnGuards(step.marker, step.count);
      say('rafa', 'Eight names between me and that ledger.');
    }
    if (current.id === 'cobalto-sunset') {
      if (stepIndex === 0) {
        spawnMissionVehicle('marea', { ...CHASE_ROUTE[0], heading: Math.PI / 2 });
        say('rueda', 'You were useful, Rafa. Useful men are allowed to retire.');
      }
      if (stepIndex === 1) {
        stopOwnedVehicles();
        spawnGuards(MISSION_LOCATIONS.lighthouse, 1, 'rueda');
        say('rueda', 'No more roads. Let us settle the account.');
      }
    }
  }

  function completeStep() {
    context.audio?.sfx?.('objective');
    if (stepIndex >= current.steps.length - 1) {
      completeMission();
      return;
    }
    stepIndex += 1;
    enterStep();
    context.save?.saveGame?.(context, { reason: 'autosave' });
  }

  function applyUnlock(unlock) {
    if (!unlock) return;
    if (!progress.unlocks.includes(unlock)) progress.unlocks.push(unlock);
    if (unlock === 'weapon:smg') {
      context.combat.unlockWeapon?.('viento');
      context.combat.addAmmo('viento', 60);
    } else if (unlock === 'weapon:rompe') {
      context.combat.unlockWeapon?.('rompe');
      context.combat.addAmmo('rompe', 16);
    } else if (unlock === 'weapon:cobre9') {
      context.combat.unlockWeapon?.('cobre9');
      context.combat.addAmmo('cobre9', 36);
    } else if (unlock === 'armour:plate') {
      context.combat.restorePlayer(context.player.state.health, context.player.state.maxArmour);
    } else if (unlock === 'vehicle:tiburon') {
      const origin = context.player.state.position;
      context.vehicles.spawnVehicle({
        type: 'tiburon', x: origin.x + 6, z: origin.z - 3,
        heading: context.player.state.heading, control: 'parked', color: '#315d72', accent: '#d9b86d',
      });
    }
  }

  function completeMission() {
    const finishedIndex = currentIndex;
    progress.money += current.reward;
    progress.respect += current.number * 5;
    if (!progress.completed.includes(current.id)) progress.completed.push(current.id);
    progress.mission = Math.min(MISSION_DEFINITIONS.length, finishedIndex + 1);
    applyUnlock(current.unlock);
    context.police.clearWanted();
    stopOwnedVehicles();
    clearTargets();
    if (current.id === 'the-debt' && context.vehicles.activeVehicle === missionVehicle) context.vehicles.exit();
    if (current.id === 'salt-in-the-wound') {
      const kept = progress.ledgerChoice === 'keep';
      say('lucia', kept ? 'Keep it hidden. A name on paper can still open a cell.' : 'You burned it? Then let the past stay ash.');
      say('rafa', kept ? 'The city keeps its secrets. So do we.' : 'Some debts burn clean. Yours just did.');
    }
    if (current.id === 'cobalto-sunset') {
      say('rueda', 'A city like this always collects.');
      say('rafa', progress.ledgerChoice === 'keep' ? 'The city keeps its secrets. I keep mine.' : 'Some debts burn clean. This one is finished.');
    }
    sayAll(current.outro);
    state = 'complete';
    resultElapsed = 0;
    objective = 'Mission complete';
    result = {
      type: 'complete', success: true, title: 'MISSION COMPLETE',
      mission: current.title, missionId: current.id, reward: current.reward, unlock: current.unlock,
      money: progress.money, respect: progress.respect, nextMission: MISSION_DEFINITIONS[progress.mission]?.title || null,
      ledgerChoice: progress.ledgerChoice,
      ending: current.id === 'cobalto-sunset'
        ? progress.ledgerChoice === 'keep' ? 'The city keeps its secrets' : 'Some debts burn clean'
        : null,
      action: 'continue',
    };
    syncProgress();
    context.save?.saveGame?.(context, { reason: 'autosave' });
  }

  function failMission(reason = 'Mission failed') {
    if (state !== 'active') return;
    state = 'failed';
    progress.mission = currentIndex;
    objective = reason;
    result = {
      type: 'failed', success: false, title: 'MISSION FAILED', mission: current.title,
      missionId: current.id, reason, reward: 0, unlock: null, action: 'retry',
    };
    resultElapsed = 0;
    context.police.clearWanted();
    clearTargets();
    stopOwnedVehicles();
    missionVehicle = null;
  }

  function syncProgress() {
    context.player.state.money = progress.money;
    progress.weapon = context.combat.weaponKey;
    progress.ammo = context.combat.ammo;
  }

  function start(id) {
    let index = -1;
    if (typeof id === 'number') index = MISSION_DEFINITIONS.findIndex((mission) => mission.number === id);
    else index = MISSION_DEFINITIONS.findIndex((mission) => mission.id === id);
    if (id === 0) index = 0;
    if (index < 0) return false;
    if (!context) return false;
    removeOwnedVehicles();
    clearTargets();
    currentIndex = index;
    current = MISSION_DEFINITIONS[index];
    progress.mission = index;
    state = 'active';
    stepIndex = 0;
    result = null;
    dialogue = null;
    dialogueQueue.length = 0;
    context.police.clearWanted();
    if (current.id === 'heat') context.police.setWanted(4);
    enterStep();
    sayAll(current.intro);
    return true;
  }

  function reset() {
    removeOwnedVehicles();
    clearTargets();
    state = 'idle';
    current = null;
    currentIndex = -1;
    stepIndex = 0;
    stepElapsed = 0;
    result = null;
    objective = '';
    dialogue = null;
    dialogueQueue.length = 0;
    missionVehicle = null;
    enteredSafehouses.clear();
  }

  function dismiss() {
    if (state !== 'complete' && state !== 'failed') return false;
    const retry = state === 'failed' ? current?.id : null;
    state = 'idle';
    current = null;
    currentIndex = -1;
    stepIndex = 0;
    result = null;
    objective = '';
    if (retry) return start(retry);
    return true;
  }

  function chooseLedger(choice) {
    if (current?.id !== 'salt-in-the-wound' || stepIndex !== 2 || state !== 'active') return false;
    if (choice !== 'burn' && choice !== 'keep') return false;
    progress.ledgerChoice = choice;
    say('rafa', choice === 'burn' ? 'Paper burns faster than a debt.' : 'This ledger goes somewhere no badge can reach.');
    completeStep();
    return true;
  }

  function damageTarget(actor, amount, source = 'player') {
    if (!actor?.missionTarget || !targets.includes(actor) || !actor.alive) return { applied: false, killed: false };
    const result = context.combat.damageCharacter(actor, amount, { source });
    if (result.killed) recountKills();
    return result;
  }

  function updateTail(dt, step) {
    if (!missionVehicle || missionVehicle.control === 'removed') {
      failMission('The courier escaped.');
      return;
    }
    tailDistance = Math.hypot(
      missionVehicle.position.x - context.player.state.position.x,
      missionVehicle.position.z - context.player.state.position.z,
    );
    if (current.id === 'paper-trail') {
      driveMissionVehicle(TAIL_ROUTE, 12.5, dt);
      const inBand = tailDistance >= MISSIONS.tailMinimum && tailDistance <= MISSIONS.tailMaximum;
      if (inBand) tailSeconds = Math.min(step.seconds, tailSeconds + dt);
      abandonTimer = tailDistance > MISSIONS.abandonDistance ? abandonTimer + dt : Math.max(0, abandonTimer - dt * 2);
      objective = inBand
        ? `Tail the Mula · ${Math.ceil(step.seconds - tailSeconds)}s · ${Math.round(tailDistance)}m`
        : tailDistance < MISSIONS.tailMinimum
          ? `Drop back to 20m · ${Math.round(tailDistance)}m`
          : `Close to 60m · ${Math.round(tailDistance)}m`;
      if (abandonTimer >= MISSIONS.abandonSeconds) failMission('You lost the courier.');
      else if (tailSeconds >= step.seconds) completeStep();
    } else {
      const disabled = missionVehicle.health <= missionVehicle.maxHealth * MISSIONS.chaseHealthRatio;
      driveMissionVehicle(CHASE_ROUTE, 20, dt, disabled);
      stoppedTimer = Math.abs(missionVehicle.speed) < 0.6 && tailDistance < 65 ? stoppedTimer + dt : 0;
      tailSeconds = Math.min(step.seconds, tailSeconds + dt);
      objective = disabled
        ? 'Rueda is off the road'
        : `Chase Rueda · ${Math.round(tailDistance)}m · ${Math.ceil(missionVehicle.health)} vehicle HP`;
      abandonTimer = tailDistance > 165 ? abandonTimer + dt : Math.max(0, abandonTimer - dt * 2);
      if (abandonTimer > 8) failMission('Rueda reached the open road.');
      else if (disabled || stoppedTimer >= MISSIONS.chaseStoppedSeconds || tailSeconds >= step.seconds) completeStep();
    }
  }

  function updateActive(dt) {
    const step = currentStep();
    if (!step) return;
    stepElapsed += dt;
    updateTargets(dt);
    if (state !== 'active') return;
    if (context.police.phase !== 'playing' || context.player.state.dead) {
      failMission(context.police.phase === 'busted' ? 'Rafa was arrested.' : 'Rafa was killed.');
      return;
    }
    const stepMarker = step.marker || (step.type === 'tail' ? missionVehicle?.position : null);
    const near = inside(context.player.state.position, stepMarker, missionRadius(context));

    if (step.type === 'goto') {
      if (near) completeStep();
    } else if (step.type === 'talk') {
      if (current.id === 'salt-in-the-wound' && stepIndex === 2) {
        objective = near && !context.vehicles.activeVehicle
          ? 'Ledger choice · B burn it / K keep it'
          : 'Take the ledger on foot';
        if (near && !context.vehicles.activeVehicle) {
          if (pressedChoices.has('burn')) chooseLedger('burn');
          else if (pressedChoices.has('keep')) chooseLedger('keep');
        }
      } else if (near && !context.vehicles.activeVehicle) completeStep();
    } else if (step.type === 'steal') {
      const active = context.vehicles.activeVehicle;
      if (active && !active.police && matchingActiveVehicle(step.vehicle)) completeStep();
      else if (step.vehicle && missionVehicle) {
        objective = `${step.text} · ${Math.round(Math.hypot(missionVehicle.position.x - context.player.state.position.x, missionVehicle.position.z - context.player.state.position.z))}m`;
      }
    } else if (step.type === 'deliver') {
      objective = step.text;
      if (near && matchingActiveVehicle(step.vehicle)) completeStep();
    } else if (step.type === 'kill' || step.type === 'survive') {
      objective = `${step.text} · ${killCount}/${step.count}`;
      if (killCount >= step.count) completeStep();
    } else if (step.type === 'tail') {
      updateTail(dt, step);
    } else if (step.type === 'escape') {
      objective = context.police.wanted > 0
        ? `Lose the PDC · ${context.police.wanted} star${context.police.wanted === 1 ? '' : 's'} remain`
        : `${step.text} · heat cleared`;
      if (near && context.police.wanted === 0) completeStep();
    }
  }

  function updateSafehouses() {
    const safehouses = [
      ['safehouse:bar', MISSION_LOCATIONS.laMarea],
      ['safehouse:market', MISSION_LOCATIONS.market],
      ['safehouse:lighthouse', MISSION_LOCATIONS.lighthouse],
    ];
    const nearby = new Set();
    for (const [unlock, location] of safehouses) {
      if (!progress.unlocks.includes(unlock)) continue;
      if (!inside(context.player.state.position, location, MISSIONS.safehouseRadius)) continue;
      nearby.add(unlock);
      if (!enteredSafehouses.has(unlock)) context.save?.saveGame?.(context, { reason: 'safehouse' });
    }
    enteredSafehouses.clear();
    for (const key of nearby) enteredSafehouses.add(key);
  }

  function updateIdle() {
    if (progress.mission >= MISSION_DEFINITIONS.length || context.police.inputLocked) return;
    const next = MISSION_DEFINITIONS[progress.mission];
    objective = `Meet ${MISSION_SPEAKERS[next.giver].name} for ${next.title}`;
    if (inside(context.player.state.position, next.marker, missionRadius(context))) start(next.id);
  }

  function update(dt, nextContext) {
    context = nextContext;
    elapsed += dt;
    updateDialogue(dt);
    if (state === 'active') updateActive(dt);
    else if (state === 'idle') updateIdle();
    else {
      resultElapsed += dt;
      if (resultElapsed > 0.75 && context.actions.interactPressed) dismiss();
    }
    updateSafehouses();
    syncProgress();
    updateWorldMarker();
    pressedChoices.clear();
  }

  function drawWrapped(g, text, x, y, maximumWidth, lineHeight) {
    const words = String(text).split(' ');
    let line = '';
    let lineIndex = 0;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && g.measureText(candidate).width > maximumWidth) {
        g.fillText(line, x, y + lineIndex * lineHeight);
        line = word;
        lineIndex += 1;
      } else line = candidate;
    }
    if (line) g.fillText(line, x, y + lineIndex * lineHeight);
    return lineIndex + 1;
  }

  function drawDialogue(g, width, height) {
    if (!dialogue) return;
    const boxWidth = Math.min(650, width - 320);
    const boxHeight = 104;
    const x = (width - boxWidth) / 2;
    const y = height - 139;
    g.fillStyle = 'rgba(10, 24, 29, 0.91)';
    g.fillRect(x, y, boxWidth, boxHeight);
    g.fillStyle = dialogue.color;
    g.fillRect(x, y, 4, boxHeight);
    g.fillStyle = 'rgba(225, 205, 165, 0.12)';
    g.fillRect(x + 17, y + 15, 60, 72);
    g.strokeStyle = dialogue.color;
    g.lineWidth = 1.5;
    g.strokeRect(x + 17, y + 15, 60, 72);
    g.fillStyle = dialogue.color;
    g.font = '800 24px sans-serif';
    g.textAlign = 'center';
    g.fillText(dialogue.monogram, x + 47, y + 59);
    g.textAlign = 'left';
    g.font = '700 12px sans-serif';
    g.fillText(dialogue.name.toUpperCase(), x + 94, y + 30);
    g.fillStyle = '#f2ecdc';
    g.font = '500 15px sans-serif';
    drawWrapped(g, dialogue.line, x + 94, y + 56, boxWidth - 112, 21);
  }

  function drawResult(g, width, height) {
    if (!result) return;
    const panelWidth = Math.min(510, width - 48);
    const panelHeight = result.ending ? 228 : 192;
    const x = (width - panelWidth) / 2;
    const y = (height - panelHeight) / 2 - 35;
    g.fillStyle = 'rgba(8, 20, 25, 0.92)';
    g.fillRect(x, y, panelWidth, panelHeight);
    g.fillStyle = result.success ? '#edc275' : '#e77b67';
    g.fillRect(x, y, panelWidth, 4);
    g.textAlign = 'center';
    g.font = '800 25px sans-serif';
    g.fillText(result.title, width / 2, y + 43);
    g.fillStyle = '#f4eedc';
    g.font = '700 15px sans-serif';
    g.fillText(result.mission.toUpperCase(), width / 2, y + 72);
    g.font = '600 14px sans-serif';
    g.fillStyle = '#d1dfd7';
    const detail = result.success
      ? `+$${result.reward.toLocaleString('en-US')}   ·   UNLOCK ${result.unlock}`
      : result.reason;
    g.fillText(detail, width / 2, y + 102);
    if (result.success) {
      g.fillStyle = '#e8c681';
      g.fillText(`MONEY $${progress.money.toLocaleString('en-US')}   ·   RESPECT ${progress.respect}`, width / 2, y + 128);
    }
    if (result.ending) {
      g.fillStyle = '#f1d6a1';
      g.font = 'italic 600 17px sans-serif';
      g.fillText(`“${result.ending}”`, width / 2, y + 154);
    }
    g.fillStyle = '#9eb9b6';
    g.font = '600 11px sans-serif';
    g.fillText(result.success ? 'E  CONTINUE IN FREE ROAM' : 'E  RETRY MISSION', width / 2, y + panelHeight - 22);
    g.textAlign = 'left';
  }

  function drawHUD(g) {
    const ratio = g.canvas.width / Math.max(1, window.innerWidth);
    const width = window.innerWidth;
    const height = window.innerHeight;
    g.save();
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.textBaseline = 'alphabetic';
    const panelWidth = Math.min(570, width - 44);
    g.fillStyle = 'rgba(10, 24, 29, 0.8)';
    g.fillRect(22, 95, panelWidth, 67);
    g.fillStyle = markerColor();
    g.fillRect(22, 95, 4, 67);
    g.font = '800 13px sans-serif';
    g.fillText((state === 'idle' ? 'FREE ROAM' : current?.title || 'COBALTO').toUpperCase(), 38, 118);
    g.fillStyle = '#f2eddc';
    g.font = '600 13px sans-serif';
    drawWrapped(g, objective, 38, 141, panelWidth - 30, 17);
    g.fillStyle = '#ebc77f';
    g.font = '700 13px sans-serif';
    g.textAlign = 'right';
    g.fillText(`$${progress.money.toLocaleString('en-US')}`, width - 24, 91);
    g.textAlign = 'left';
    drawResult(g, width, height);
    drawDialogue(g, width, height);
    g.restore();
  }

  function blips() {
    const resultBlips = [];
    if (markerPosition) {
      resultBlips.push({
        x: markerPosition.x, z: markerPosition.z, color: markerColor(),
        kind: state === 'idle' ? 'giver' : currentStep()?.type || 'objective',
        label: state === 'idle' ? 'Mission giver' : objective,
      });
    }
    if (state === 'active') {
      for (const actor of targets) {
        if (actor.alive) resultBlips.push({ x: actor.position.x, z: actor.position.z, color: red, kind: 'enemy', label: actor.role });
      }
    }
    return resultBlips;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat || (event.code !== 'KeyB' && event.code !== 'KeyK')) return;
    if (current?.id !== 'salt-in-the-wound' || state !== 'active') return;
    event.preventDefault();
    pressedChoices.add(event.code === 'KeyB' ? 'burn' : 'keep');
  });

  return {
    start, update, say, blips, dismiss, reset, chooseLedger, damageTarget, targets,
    get state() { return state; },
    get current() { return current; },
    get currentIndex() { return currentIndex; },
    get objective() { return objective; },
    get title() { return current?.title || 'Free roam'; },
    get dialogue() { return dialogue; },
    get result() { return result; },
    get step() { return currentStep(); },
    get stepIndex() { return stepIndex; },
    get stepElapsed() { return stepElapsed; },
    get killCount() { return killCount; },
    get tailProgress() { return tailSeconds; },
    get tailDistance() { return tailDistance; },
    get marker() { return markerPosition; },
    get missionVehicle() { return missionVehicle; },
    drawHUD,
  };
}
