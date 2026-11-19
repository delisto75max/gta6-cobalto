// Original hitscan weapons, damage delegation and bounded visual/audio effects. Police fire uses
// the same world raycast as Rafa, so neither side can send a bullet through a city collider.
import * as THREE from 'three';
import { COMBAT, PEDESTRIANS, PLAYER, POLICE } from './config.js';
import { mulberry32 } from './random.js';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

export function segmentAABBTime(start, end, collider, padding = 0) {
  let entry = 0;
  let exit = 1;
  const minima = [collider.minX - padding, collider.minY - padding, collider.minZ - padding];
  const maxima = [collider.maxX + padding, collider.maxY + padding, collider.maxZ + padding];
  const origins = [start.x, start.y, start.z];
  const deltas = [end.x - start.x, end.y - start.y, end.z - start.z];
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(deltas[axis]) < 0.000001) {
      if (origins[axis] < minima[axis] || origins[axis] > maxima[axis]) return null;
      continue;
    }
    const inverse = 1 / deltas[axis];
    let first = (minima[axis] - origins[axis]) * inverse;
    let second = (maxima[axis] - origins[axis]) * inverse;
    if (first > second) [first, second] = [second, first];
    entry = Math.max(entry, first);
    exit = Math.min(exit, second);
    if (entry > exit) return null;
  }
  return entry >= 0 && entry <= 1 ? entry : null;
}

export function hasWorldLineOfSight(city, start, end) {
  const middleX = (start.x + end.x) / 2;
  const middleZ = (start.z + end.z) / 2;
  const radius = Math.hypot(end.x - start.x, end.z - start.z) / 2 + 1;
  for (const collider of city.queryColliders(middleX, middleZ, radius)) {
    const time = segmentAABBTime(start, end, collider);
    if (time !== null && time > 0.005 && time < 0.995) return false;
  }
  return true;
}

function raySphereDistance(origin, direction, center, radius, maximum = Infinity) {
  const x = origin.x - center.x;
  const y = origin.y - center.y;
  const z = origin.z - center.z;
  const projection = x * direction.x + y * direction.y + z * direction.z;
  const constant = x * x + y * y + z * z - radius * radius;
  const discriminant = projection * projection - constant;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  let distance = -projection - root;
  if (distance < 0) distance = -projection + root;
  return distance >= 0 && distance <= maximum ? distance : null;
}

function verticalTargetDistance(origin, direction, targetPosition, maximum, radius = 0.4) {
  let nearest = null;
  const samples = [
    [0.38, radius], [0.98, radius * 1.08], [1.58, radius * 0.82], [1.76, radius * 0.58],
  ];
  const center = new THREE.Vector3();
  for (const [height, sampleRadius] of samples) {
    center.set(targetPosition.x, targetPosition.y + height, targetPosition.z);
    const distance = raySphereDistance(origin, direction, center, sampleRadius, maximum);
    if (distance !== null && (nearest === null || distance < nearest)) nearest = distance;
  }
  return nearest;
}

function makeFlashTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,235,1)');
  gradient.addColorStop(0.18, 'rgba(255,210,105,0.95)');
  gradient.addColorStop(0.5, 'rgba(255,126,40,0.42)');
  gradient.addColorStop(1, 'rgba(255,100,20,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,238,170,0.85)';
  g.fillRect(30, 2, 4, 60);
  g.fillRect(2, 30, 60, 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeWeaponModel(spec) {
  const group = new THREE.Group();
  group.name = spec.name;
  const metal = new THREE.MeshStandardMaterial({ color: '#343b3c', roughness: 0.38, metalness: 0.55 });
  const accent = new THREE.MeshStandardMaterial({ color: spec.key === 'cobre9' ? '#aa7048' : '#56686a', roughness: 0.55, metalness: 0.25 });
  const grip = new THREE.MeshStandardMaterial({ color: '#242727', roughness: 0.86 });
  function box(material, x, y, z, width, height, depth) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
  }
  if (spec.key === 'rompe') {
    box(metal, -0.07, 0, 0.25, 0.105, 0.105, 0.72);
    box(metal, 0.07, 0, 0.25, 0.105, 0.105, 0.72);
    box(accent, 0, -0.045, -0.1, 0.19, 0.15, 0.28);
    box(grip, 0, -0.17, -0.19, 0.13, 0.26, 0.17);
  } else {
    const length = spec.key === 'viento' ? 0.62 : 0.4;
    box(metal, 0, 0.04, length * 0.38, spec.key === 'viento' ? 0.2 : 0.15, 0.17, length);
    box(accent, 0, 0.1, length * 0.48, 0.13, 0.055, length * 0.72);
    box(grip, 0, -0.15, -0.04, 0.13, 0.29, 0.16);
    if (spec.key === 'viento') {
      box(grip, 0, -0.24, 0.12, 0.12, 0.35, 0.15);
      box(metal, 0, 0.03, -0.33, 0.11, 0.12, 0.34);
    }
  }
  group.position.set(0.4, 1.22, 0.36);
  return group;
}

function createAudio(seed) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let audio = null;
  let master = null;
  let noiseBuffer = null;
  const random = mulberry32((seed ^ 0xa0d10) | 0);
  const sirens = new Map();

  function unlock() {
    if (!AudioContextClass) return;
    if (!audio) {
      audio = new AudioContextClass();
      master = audio.createGain();
      master.gain.value = 0.42;
      master.connect(audio.destination);
      noiseBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.8), audio.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) data[index] = random() * 2 - 1;
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  }

  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });

  function spatialVolume(position, listenerPosition) {
    if (!position || !listenerPosition) return 1;
    const distance = Math.hypot(position.x - listenerPosition.x, position.z - listenerPosition.z);
    return 1 / (1 + Math.pow(distance / 34, 2));
  }

  function tone(frequency, duration, volume, type = 'square', slide = 0.5) {
    if (!audio || audio.state !== 'running') return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * slide), audio.currentTime + duration);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }

  function shot(key, position, listenerPosition) {
    if (!audio || audio.state !== 'running') return;
    const volume = spatialVolume(position, listenerPosition);
    const settings = key === 'rompe'
      ? { duration: 0.34, frequency: 115, filter: 750, gain: 0.5 }
      : key === 'viento'
        ? { duration: 0.105, frequency: 210, filter: 1550, gain: 0.22 }
        : { duration: 0.17, frequency: 155, filter: 1150, gain: 0.31 };
    const now = audio.currentTime;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    source.buffer = noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.value = settings.filter;
    gain.gain.setValueAtTime(settings.gain * volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(now, random() * 0.4, settings.duration);
    source.stop(now + settings.duration);
    tone(settings.frequency, settings.duration * 0.8, 0.17 * volume, 'triangle', 0.32);
  }

  function reload() {
    tone(940, 0.035, 0.055, 'square', 0.75);
    window.setTimeout(() => tone(1320, 0.045, 0.05, 'square', 0.8), 155);
  }

  function dryFire() { tone(1250, 0.025, 0.04, 'square', 0.8); }
  function callout() { tone(540, 0.09, 0.025, 'square', 1.35); }

  function addSiren(vehicle) {
    if (!audio || audio.state !== 'running' || sirens.has(vehicle.id)) return;
    const oscillator = audio.createOscillator();
    const modulation = audio.createOscillator();
    const modulationDepth = audio.createGain();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 730;
    modulation.type = 'sine';
    modulation.frequency.value = 0.72;
    modulationDepth.gain.value = 235;
    filter.type = 'lowpass';
    filter.frequency.value = 1850;
    gain.gain.value = 0.0001;
    modulation.connect(modulationDepth).connect(oscillator.frequency);
    oscillator.connect(filter).connect(gain).connect(master);
    oscillator.start();
    modulation.start();
    sirens.set(vehicle.id, { oscillator, modulation, gain });
  }

  function updateSirens(cruisers, listenerPosition) {
    const active = new Set();
    for (const cruiser of cruisers) {
      const vehicle = cruiser.vehicle || cruiser;
      if (!vehicle.siren || vehicle.control === 'removed') continue;
      active.add(vehicle.id);
      addSiren(vehicle);
      const voice = sirens.get(vehicle.id);
      if (!voice || !audio) continue;
      const distance = Math.hypot(vehicle.position.x - listenerPosition.x, vehicle.position.z - listenerPosition.z);
      const volume = distance < POLICE.sirenRange ? 0.115 / (1 + Math.pow(distance / 32, 2)) : 0.0001;
      voice.gain.gain.setTargetAtTime(Math.max(0.0001, volume), audio.currentTime, 0.08);
    }
    for (const [id, voice] of sirens) {
      if (active.has(id)) continue;
      try { voice.oscillator.stop(); voice.modulation.stop(); } catch {}
      voice.oscillator.disconnect();
      voice.modulation.disconnect();
      voice.gain.disconnect();
      sirens.delete(id);
    }
  }

  return { shot, reload, dryFire, callout, updateSirens, unlock, sirens };
}

export function createCombat(stage, city, player, vehicleSystem, pedSystem, seed = city.seed) {
  const random = mulberry32((seed ^ 0xc0b47) | 0);
  const audio = createAudio(seed);
  const inventory = COMBAT.weapons.map((spec) => ({
    spec, ammo: spec.magazineSize, reserve: spec.startingReserve, unlocked: spec.slot === 1,
  }));
  const weaponModels = inventory.map(({ spec }) => {
    const model = makeWeaponModel(spec);
    model.visible = false;
    player.mesh.add(model);
    return model;
  });
  weaponModels[0].visible = true;
  let context = null;
  let currentIndex = 0;
  let cooldown = 0;
  let reloadTimer = 0;
  let reloading = false;
  let aiming = false;
  let hitMarker = 0;
  let muzzleTimer = 0;
  let recoilVisual = 0;
  let tracerCursor = 0;
  let sparkCursor = 0;
  let shotHeatCooldown = 0;

  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const pelletDirection = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const bitangent = new THREE.Vector3();
  const right = new THREE.Vector3();
  const end = new THREE.Vector3();
  const point = new THREE.Vector3();
  const center = new THREE.Vector3();
  const forward = new THREE.Vector3();

  const flashMaterial = new THREE.SpriteMaterial({
    map: makeFlashTexture(), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const flash = new THREE.Sprite(flashMaterial);
  flash.scale.set(0.95, 0.95, 1);
  flash.visible = false;
  stage.scene.add(flash);
  const flashLight = new THREE.PointLight('#ffc16b', 0, 13, 2);
  stage.scene.add(flashLight);

  const tracerPositions = new Float32Array(COMBAT.tracerPoolSize * 6);
  const tracerLife = new Float32Array(COMBAT.tracerPoolSize);
  tracerPositions.fill(-10000);
  const tracerGeometry = new THREE.BufferGeometry();
  const tracerAttribute = new THREE.BufferAttribute(tracerPositions, 3);
  tracerAttribute.setUsage(THREE.DynamicDrawUsage);
  tracerGeometry.setAttribute('position', tracerAttribute);
  const tracers = new THREE.LineSegments(tracerGeometry, new THREE.LineBasicMaterial({
    color: '#ffdb8b', transparent: true, opacity: 0.78,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  tracers.frustumCulled = false;
  stage.scene.add(tracers);

  const sparkPositions = new Float32Array(COMBAT.sparkPoolSize * 3);
  const sparkVelocities = new Float32Array(COMBAT.sparkPoolSize * 3);
  const sparkLife = new Float32Array(COMBAT.sparkPoolSize);
  sparkPositions.fill(-10000);
  const sparkGeometry = new THREE.BufferGeometry();
  const sparkAttribute = new THREE.BufferAttribute(sparkPositions, 3);
  sparkAttribute.setUsage(THREE.DynamicDrawUsage);
  sparkGeometry.setAttribute('position', sparkAttribute);
  const sparks = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({
    color: '#ffbd61', size: 0.105, transparent: true, opacity: 0.92,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  sparks.frustumCulled = false;
  stage.scene.add(sparks);

  const stats = {
    shots: 0, pellets: 0, hits: 0, kills: 0, worldImpacts: 0,
    pedestrianHits: 0, officerHits: 0, officerShots: 0, reloads: 0,
  };
  let lastShot = null;

  function current() { return inventory[currentIndex]; }

  function addTracer(start, finish) {
    const index = tracerCursor;
    tracerCursor = (tracerCursor + 1) % tracerLife.length;
    tracerLife[index] = COMBAT.tracerTime;
    const offset = index * 6;
    tracerPositions[offset] = start.x;
    tracerPositions[offset + 1] = start.y;
    tracerPositions[offset + 2] = start.z;
    tracerPositions[offset + 3] = finish.x;
    tracerPositions[offset + 4] = finish.y;
    tracerPositions[offset + 5] = finish.z;
    tracerAttribute.needsUpdate = true;
  }

  function addSparks(position, count = 7) {
    for (let spark = 0; spark < count; spark += 1) {
      const index = sparkCursor;
      sparkCursor = (sparkCursor + 1) % sparkLife.length;
      const offset = index * 3;
      sparkPositions[offset] = position.x;
      sparkPositions[offset + 1] = position.y;
      sparkPositions[offset + 2] = position.z;
      sparkVelocities[offset] = (random() - 0.5) * 4.2;
      sparkVelocities[offset + 1] = 1.2 + random() * 3.7;
      sparkVelocities[offset + 2] = (random() - 0.5) * 4.2;
      sparkLife[index] = 0.18 + random() * 0.28;
    }
    sparkAttribute.needsUpdate = true;
  }

  function showMuzzle(position, shotDirection) {
    flash.position.copy(position).addScaledVector(shotDirection, 0.28);
    flashLight.position.copy(flash.position);
    flash.material.rotation = random() * TAU;
    flash.visible = true;
    muzzleTimer = COMBAT.muzzleTime;
    recoilVisual = 1;
  }

  function traceWorld(rayOrigin, rayDirection, range) {
    end.copy(rayOrigin).addScaledVector(rayDirection, range);
    const radius = range / 2 + 2;
    let nearest = range;
    let colliderHit = null;
    for (const collider of city.queryColliders((rayOrigin.x + end.x) / 2, (rayOrigin.z + end.z) / 2, radius)) {
      const time = segmentAABBTime(rayOrigin, end, collider);
      if (time === null || time < 0.0001) continue;
      const distance = time * range;
      if (distance < nearest) {
        nearest = distance;
        colliderHit = collider;
      }
    }
    return colliderHit ? { distance: nearest, collider: colliderHit } : null;
  }

  function traceShot(rayOrigin, rayDirection, range = 100, options = {}) {
    const worldHit = traceWorld(rayOrigin, rayDirection, range);
    let nearest = worldHit?.distance ?? range;
    let kind = worldHit ? 'world' : 'none';
    let target = worldHit?.collider ?? null;
    const ignore = options.ignoreTarget;

    if (!options.excludePeds) {
      for (const walker of pedSystem.walkers) {
        if (!walker.alive || walker === ignore) continue;
        const distance = verticalTargetDistance(rayOrigin, rayDirection, walker.position, nearest);
        if (distance !== null && distance < nearest) {
          nearest = distance;
          kind = 'pedestrian';
          target = walker;
        }
      }
    }
    if (!options.excludeOfficers) {
      for (const officer of context?.police?.officers || []) {
        if (!officer.alive || officer === ignore) continue;
        const distance = verticalTargetDistance(rayOrigin, rayDirection, officer.position, nearest, 0.42);
        if (distance !== null && distance < nearest) {
          nearest = distance;
          kind = 'officer';
          target = officer;
        }
      }
    }
    if (!options.excludeMissionTargets) {
      for (const actor of context?.missions?.targets || []) {
        if (!actor.alive || actor === ignore) continue;
        const distance = verticalTargetDistance(rayOrigin, rayDirection, actor.position, nearest, 0.42);
        if (distance !== null && distance < nearest) {
          nearest = distance;
          kind = 'missionTarget';
          target = actor;
        }
      }
    }
    if (options.includePlayer && !player.state.dead) {
      const distance = verticalTargetDistance(rayOrigin, rayDirection, player.state.position, nearest, PLAYER.radius);
      if (distance !== null && distance < nearest) {
        nearest = distance;
        kind = 'player';
        target = player.state;
      }
    }
    if (!options.excludeVehicles) {
      for (const vehicle of vehicleSystem.vehicles) {
        if (vehicle === options.excludeVehicle || vehicle === ignore || vehicle.control === 'removed') continue;
        forward.set(Math.sin(vehicle.heading), 0, Math.cos(vehicle.heading));
        const radius = Math.max(0.62, vehicle.spec.width * 0.58);
        for (const factor of [-0.28, 0, 0.28]) {
          center.copy(vehicle.position).addScaledVector(forward, vehicle.spec.length * factor);
          center.y += vehicle.spec.style === 'suv' ? 0.95 : 0.68;
          const distance = raySphereDistance(rayOrigin, rayDirection, center, radius, nearest);
          if (distance !== null && distance < nearest) {
            nearest = distance;
            kind = 'vehicle';
            target = vehicle;
          }
        }
      }
    }
    point.copy(rayOrigin).addScaledVector(rayDirection, nearest);
    return { kind, target, distance: nearest, point: point.clone(), range };
  }

  function damageCharacter(target, amount, options = {}) {
    const result = { applied: false, killed: false, healthDamage: 0, armourDamage: 0 };
    if (!target || amount <= 0 || target.dead || target.alive === false || target.health <= 0) return result;
    const maximumArmour = target.maxArmour ?? 100;
    target.armour = Math.max(0, Math.min(maximumArmour, target.armour ?? 0));
    const armourDamage = Math.min(target.armour, amount * COMBAT.armourAbsorption);
    target.armour -= armourDamage;
    const healthDamage = Math.min(target.health, Math.max(0, amount - armourDamage));
    const previousHealth = target.health;
    target.health = Math.max(0, target.health - healthDamage);
    result.applied = true;
    result.armourDamage = armourDamage;
    result.healthDamage = previousHealth - target.health;
    if (target.health <= 0 && previousHealth > 0) {
      result.killed = true;
      target.dead = true;
      if (target !== player.state) {
        target.alive = false;
        target.deathTimer = 0;
      } else {
        context?.police?.handlePlayerDeath(options.source || 'combat');
      }
    }
    return result;
  }

  function damagePlayer(amount, options = {}) {
    return damageCharacter(player.state, amount, options);
  }

  function damageForDistance(spec, distance) {
    const falloff = THREE.MathUtils.clamp((distance - spec.range * 0.35) / (spec.range * 0.65), 0, 1);
    return spec.damage * (1 - falloff * 0.67);
  }

  function resolvePlayerImpact(hit, spec) {
    if (hit.kind === 'world') {
      stats.worldImpacts += 1;
      addSparks(hit.point, 7);
      return;
    }
    if (hit.kind === 'none') return;
    hitMarker = COMBAT.hitMarkerTime;
    stats.hits += 1;
    const damage = damageForDistance(spec, hit.distance);
    if (hit.kind === 'pedestrian') {
      stats.pedestrianHits += 1;
      const result = damageCharacter(hit.target, damage, { source: 'player' });
      if (result.killed) {
        stats.kills += 1;
        context?.police?.reportCrime('pedestrianKilled', hit.target.position);
      }
    } else if (hit.kind === 'officer') {
      stats.officerHits += 1;
      context?.police?.damageOfficer(hit.target, damage, 'player');
    } else if (hit.kind === 'missionTarget') {
      const result = context?.missions?.damageTarget(hit.target, damage, 'player');
      if (result?.killed) stats.kills += 1;
    } else if (hit.kind === 'vehicle') {
      vehicleSystem.damage(hit.target, damage * 0.48);
      addSparks(hit.point, 3);
    }
  }

  function spreadDirection(base, spread, output) {
    tangent.crossVectors(base, UP);
    if (tangent.lengthSq() < 0.0001) tangent.set(1, 0, 0);
    else tangent.normalize();
    bitangent.crossVectors(base, tangent).normalize();
    const angle = random() * TAU;
    const radius = Math.sqrt(random()) * spread;
    return output.copy(base)
      .addScaledVector(tangent, Math.cos(angle) * radius)
      .addScaledVector(bitangent, Math.sin(angle) * radius)
      .normalize();
  }

  function reportPublicShot(position) {
    if (shotHeatCooldown > 0) return;
    context?.police?.reportCrime('weaponFired', position);
    shotHeatCooldown = POLICE.publicShotHeatCooldown;
  }

  function firePlayerWeapon() {
    const held = current();
    const spec = held.spec;
    if (cooldown > 0 || reloading || held.ammo <= 0) return false;
    held.ammo -= 1;
    cooldown = spec.fireInterval;
    stats.shots += 1;
    player.getAimDirection(direction);
    const activeVehicle = vehicleSystem.activeVehicle;
    if (activeVehicle) {
      right.set(-Math.cos(activeVehicle.heading), 0, Math.sin(activeVehicle.heading));
      origin.copy(activeVehicle.position).addScaledVector(right, 0.82);
      origin.y += 1.32;
    } else {
      right.set(-Math.cos(player.state.aimYaw), 0, Math.sin(player.state.aimYaw));
      origin.copy(player.state.position).addScaledVector(right, 0.2);
      origin.y += 1.38;
      origin.addScaledVector(direction, 0.35);
    }
    const spread = aiming ? spec.spreadAim : spec.spreadHip;
    for (let pellet = 0; pellet < spec.pellets; pellet += 1) {
      spreadDirection(direction, spread, pelletDirection);
      const hit = traceShot(origin, pelletDirection, spec.range, { excludeVehicle: activeVehicle });
      stats.pellets += 1;
      resolvePlayerImpact(hit, spec);
      addTracer(origin, hit.point);
      if (pellet === 0) lastShot = { ...hit, weapon: spec.key, time: context?.time ?? 0 };
    }
    showMuzzle(origin, direction);
    audio.shot(spec.key, origin, player.state.position);
    player.addRecoil(spec.recoil, (random() - 0.5) * spec.recoil * 0.4);
    pedSystem.panic(origin.x, origin.z, PEDESTRIANS.gunshotRadius, PEDESTRIANS.fearDuration);
    reportPublicShot(origin);
    return true;
  }

  function firePoliceWeapon(officer) {
    if (!officer?.alive || player.state.dead) return null;
    origin.copy(officer.position);
    origin.y += 1.36;
    center.copy(player.state.position);
    center.y += 1.16;
    direction.copy(center).sub(origin).normalize();
    spreadDirection(direction, POLICE.officerSpread, pelletDirection);
    const hit = traceShot(origin, pelletDirection, POLICE.officerRange, {
      ignoreTarget: officer, includePlayer: true, excludeOfficers: true, excludeMissionTargets: true, excludePeds: true,
    });
    stats.officerShots += 1;
    if (hit.kind === 'player') damagePlayer(POLICE.officerDamage, { source: 'PDC' });
    else if (hit.kind === 'vehicle') vehicleSystem.damage(hit.target, POLICE.officerDamage * 0.3);
    else if (hit.kind === 'world') addSparks(hit.point, 4);
    addTracer(origin, hit.point);
    showMuzzle(origin, pelletDirection);
    audio.shot('cobre9', origin, player.state.position);
    lastShot = { ...hit, weapon: 'PDC service pistol', time: context?.time ?? 0 };
    return hit;
  }

  function setWeapon(slotOrKey) {
    let next = -1;
    if (typeof slotOrKey === 'number') next = inventory.findIndex(({ spec }) => spec.slot === slotOrKey);
    else next = inventory.findIndex(({ spec }) => spec.key === slotOrKey || spec.name === slotOrKey);
    if (next < 0 || next === currentIndex || !inventory[next].unlocked) return false;
    weaponModels[currentIndex].visible = false;
    currentIndex = next;
    weaponModels[currentIndex].visible = true;
    reloading = false;
    reloadTimer = 0;
    cooldown = Math.max(cooldown, 0.12);
    return true;
  }

  function cycleWeapon(directionSign) {
    for (let offset = 1; offset <= inventory.length; offset += 1) {
      const next = (currentIndex + Math.sign(directionSign) * offset + inventory.length * 2) % inventory.length;
      if (inventory[next].unlocked) return setWeapon(inventory[next].spec.slot);
    }
    return false;
  }

  function unlockWeapon(slotOrKey) {
    const held = inventory.find(({ spec }) => spec.slot === slotOrKey || spec.key === slotOrKey || spec.name === slotOrKey);
    if (!held) return false;
    held.unlocked = true;
    return true;
  }

  function setAmmo(slotOrKey, ammo, reserve) {
    const held = inventory.find(({ spec }) => spec.slot === slotOrKey || spec.key === slotOrKey || spec.name === slotOrKey);
    if (!held || !Number.isFinite(ammo)) return false;
    held.ammo = THREE.MathUtils.clamp(Math.round(ammo), 0, held.spec.magazineSize);
    if (Number.isFinite(reserve)) held.reserve = Math.max(0, Math.round(reserve));
    if (held === current() && held.ammo >= held.spec.magazineSize) {
      reloading = false;
      reloadTimer = 0;
    }
    return true;
  }

  function startReload() {
    const held = current();
    if (reloading || held.ammo >= held.spec.magazineSize || held.reserve <= 0) return false;
    reloading = true;
    reloadTimer = held.spec.reloadTime;
    stats.reloads += 1;
    audio.reload();
    return true;
  }

  function finishReload() {
    const held = current();
    const needed = held.spec.magazineSize - held.ammo;
    const moved = Math.min(needed, held.reserve);
    held.ammo += moved;
    held.reserve -= moved;
    reloading = false;
    reloadTimer = 0;
  }

  function addAmmo(keyOrAmount, maybeAmount) {
    const key = typeof keyOrAmount === 'string' ? keyOrAmount : current().spec.key;
    const amount = typeof keyOrAmount === 'number' ? keyOrAmount : maybeAmount;
    const held = inventory.find(({ spec }) => spec.key === key || spec.name === key);
    if (!held || !Number.isFinite(amount)) return false;
    held.reserve = Math.max(0, Math.round(held.reserve + amount));
    return true;
  }

  function reduceAmmoAfterArrest() {
    for (const held of inventory) {
      held.ammo = Math.floor(held.ammo * POLICE.bustedAmmoRetention);
      held.reserve = Math.floor(held.reserve * POLICE.bustedAmmoRetention);
    }
    reloading = false;
    reloadTimer = 0;
  }

  function restorePlayer(health = player.state.maxHealth, armour = player.state.armour) {
    player.state.health = THREE.MathUtils.clamp(health, 0, player.state.maxHealth);
    player.state.armour = THREE.MathUtils.clamp(armour, 0, player.state.maxArmour);
    player.state.dead = false;
  }

  function getInventory() {
    return inventory.map(({ spec, ammo, reserve, unlocked }) => ({
      key: spec.key, name: spec.name, slot: spec.slot, magazineSize: spec.magazineSize, ammo, reserve,
      unlocked: Boolean(unlocked),
    }));
  }

  function updateEffects(dt) {
    muzzleTimer = Math.max(0, muzzleTimer - dt);
    flash.visible = muzzleTimer > 0;
    flashLight.intensity = muzzleTimer > 0 ? 32 * muzzleTimer / COMBAT.muzzleTime : 0;
    let tracerDirty = false;
    for (let index = 0; index < tracerLife.length; index += 1) {
      if (tracerLife[index] <= 0) continue;
      tracerLife[index] -= dt;
      if (tracerLife[index] <= 0) {
        const offset = index * 6;
        for (let component = 0; component < 6; component += 1) tracerPositions[offset + component] = -10000;
        tracerDirty = true;
      }
    }
    if (tracerDirty) tracerAttribute.needsUpdate = true;
    let sparkDirty = false;
    for (let index = 0; index < sparkLife.length; index += 1) {
      if (sparkLife[index] <= 0) continue;
      sparkLife[index] -= dt;
      const offset = index * 3;
      if (sparkLife[index] <= 0) {
        sparkPositions[offset] = sparkPositions[offset + 1] = sparkPositions[offset + 2] = -10000;
      } else {
        sparkVelocities[offset + 1] -= 10 * dt;
        sparkPositions[offset] += sparkVelocities[offset] * dt;
        sparkPositions[offset + 1] += sparkVelocities[offset + 1] * dt;
        sparkPositions[offset + 2] += sparkVelocities[offset + 2] * dt;
      }
      sparkDirty = true;
    }
    if (sparkDirty) sparkAttribute.needsUpdate = true;
    recoilVisual = THREE.MathUtils.damp(recoilVisual, 0, 24, dt);
    const model = weaponModels[currentIndex];
    model.position.z = 0.36 - recoilVisual * 0.13;
    model.rotation.x = reloading ? Math.sin(reloadTimer * 9) * 0.28 : 0;
  }

  function update(dt, nextContext) {
    context = nextContext;
    hitMarker = Math.max(0, hitMarker - dt);
    cooldown = Math.max(0, cooldown - dt);
    shotHeatCooldown = Math.max(0, shotHeatCooldown - dt);
    updateEffects(dt);
    aiming = Boolean(nextContext.actions.aim && !nextContext.police?.inputLocked && !player.state.dead);
    if (nextContext.police?.inputLocked || player.state.dead) return;

    if (nextContext.actions.weaponSlotPressed) setWeapon(nextContext.actions.weaponSlotPressed);
    if (nextContext.actions.wheel !== 0) cycleWeapon(nextContext.actions.wheel);
    if (nextContext.actions.reloadPressed) startReload();
    if (reloading) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) finishReload();
      return;
    }
    const spec = current().spec;
    const trigger = spec.automatic ? nextContext.actions.fire : nextContext.actions.firePressed;
    if (!trigger || cooldown > 0) return;
    if (current().ammo <= 0) {
      if (!startReload()) audio.dryFire();
      cooldown = 0.18;
      return;
    }
    firePlayerWeapon();
  }

  function drawHUD(g) {
    const ratio = g.canvas.width / Math.max(1, window.innerWidth);
    const width = window.innerWidth;
    const height = window.innerHeight;
    g.save();
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.textBaseline = 'alphabetic';

    const held = current();
    g.fillStyle = 'rgba(11, 25, 30, 0.76)';
    g.fillRect(22, 21, 224, 62);
    g.fillStyle = '#eacb91';
    g.font = '700 14px sans-serif';
    g.fillText(held.spec.name.toUpperCase(), 36, 44);
    g.fillStyle = '#f7f0dc';
    g.font = '700 24px sans-serif';
    g.fillText(String(held.ammo).padStart(2, '0'), 36, 72);
    g.fillStyle = '#a9c2c3';
    g.font = '600 13px sans-serif';
    g.fillText(`/ ${held.reserve}`, 78, 70);
    g.font = '600 10px sans-serif';
    g.fillText('1  2  3   ·   R RELOAD', 132, 69);
    if (reloading) {
      g.fillStyle = '#344d52';
      g.fillRect(132, 39, 99, 5);
      g.fillStyle = '#e6bf75';
      g.fillRect(132, 39, 99 * (1 - reloadTimer / held.spec.reloadTime), 5);
    }

    const x = 24;
    const y = height - 63;
    g.fillStyle = 'rgba(11, 25, 30, 0.78)';
    g.fillRect(x, y, 244, 43);
    g.fillStyle = '#263e43';
    g.fillRect(x + 13, y + 12, 216, 9);
    g.fillStyle = player.state.health < 30 ? '#df6553' : '#80b99a';
    g.fillRect(x + 13, y + 12, 216 * player.state.health / player.state.maxHealth, 9);
    g.fillStyle = '#263e43';
    g.fillRect(x + 13, y + 27, 216, 5);
    g.fillStyle = '#65a6c3';
    g.fillRect(x + 13, y + 27, 216 * player.state.armour / player.state.maxArmour, 5);
    g.fillStyle = '#f3edda';
    g.font = '700 10px sans-serif';
    g.fillText(`${Math.ceil(player.state.health)} HP`, x + 13, y - 4);

    if (aiming && !context?.police?.inputLocked) {
      const cx = width / 2;
      const cy = height / 2;
      g.strokeStyle = 'rgba(245, 240, 218, 0.8)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(cx - 7, cy); g.lineTo(cx - 2, cy);
      g.moveTo(cx + 2, cy); g.lineTo(cx + 7, cy);
      g.moveTo(cx, cy - 7); g.lineTo(cx, cy - 2);
      g.moveTo(cx, cy + 2); g.lineTo(cx, cy + 7);
      g.stroke();
    }
    if (hitMarker > 0) {
      const cx = width / 2;
      const cy = height / 2;
      g.strokeStyle = `rgba(255, 230, 181, ${Math.min(1, hitMarker * 9)})`;
      g.lineWidth = 2;
      g.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.moveTo(cx + sx * 5, cy + sy * 5);
        g.lineTo(cx + sx * 11, cy + sy * 11);
      }
      g.stroke();
    }
    g.restore();
  }

  return {
    weapons: inventory,
    stats,
    get lastShot() { return lastShot; },
    get weapon() { return current().spec.name; },
    get weaponKey() { return current().spec.key; },
    get ammo() { return current().ammo; },
    get reserveAmmo() { return current().reserve; },
    get magazineSize() { return current().spec.magazineSize; },
    get reloading() { return reloading; },
    get aiming() { return aiming; },
    get hitMarker() { return hitMarker; },
    setWeapon,
    unlockWeapon,
    setAmmo,
    cycleWeapon,
    reload: startReload,
    addAmmo,
    getInventory,
    reduceAmmoAfterArrest,
    traceShot,
    firePoliceWeapon,
    damageCharacter,
    damagePlayer,
    applyPlayerDamage: damagePlayer,
    restorePlayer,
    updateSirens: audio.updateSirens,
    playCallout: audio.callout,
    update,
    drawHUD,
  };
}
