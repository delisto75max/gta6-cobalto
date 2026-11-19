// Original primitive-built vehicles, deterministic kerb parking, arcade driving and damage.
// The same vehicle records are reused by player driving, road traffic and later police systems.
import * as THREE from 'three';
import { CAMERA, CITY, PLAYER, VEHICLES, WORLD } from './config.js';
import { mulberry32, pick, range } from './random.js';

const clamp = THREE.MathUtils.clamp;
const TAU = Math.PI * 2;
const IDLE_DRIVING = Object.freeze({ forward: 0, right: 0, handbrake: false, jump: false });
const PAINTS = [
  ['#d95742', '#f0c276'], ['#246b78', '#dfd5b8'], ['#d9b64f', '#454f55'],
  ['#e7dfca', '#bd5a42'], ['#344d69', '#a9c0bd'], ['#6f3840', '#d9a560'],
  ['#54816c', '#e5ce93'], ['#a9a9a0', '#31454d'], ['#b8653e', '#f0d4a0'],
];

function shortAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function vehicleForward(vehicle, target = new THREE.Vector3()) {
  return target.set(Math.sin(vehicle.heading), 0, Math.cos(vehicle.heading));
}

function vehicleRight(vehicle, target = new THREE.Vector3()) {
  return target.set(-Math.cos(vehicle.heading), 0, Math.sin(vehicle.heading));
}

class PrimitiveBatch {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
  }

  add(geometry, color, x, y, z, rotationX = 0, rotationY = 0, rotationZ = 0) {
    const transformed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    const matrix = new THREE.Matrix4();
    matrix.makeRotationFromEuler(new THREE.Euler(rotationX, rotationY, rotationZ));
    matrix.setPosition(x, y, z);
    transformed.applyMatrix4(matrix);
    const positions = transformed.getAttribute('position');
    const normals = transformed.getAttribute('normal');
    const shade = new THREE.Color(color);
    for (let index = 0; index < positions.count; index += 1) {
      this.positions.push(positions.getX(index), positions.getY(index), positions.getZ(index));
      this.normals.push(normals.getX(index), normals.getY(index), normals.getZ(index));
      this.colors.push(shade.r, shade.g, shade.b);
    }
    transformed.dispose();
  }

  box(x, y, z, width, height, depth, color, rotationY = 0, rotationX = 0, rotationZ = 0) {
    this.add(new THREE.BoxGeometry(width, height, depth), color, x, y, z, rotationX, rotationY, rotationZ);
  }

  cylinder(x, y, z, radius, length, color, rotationX = 0, rotationY = 0, rotationZ = 0, segments = 12) {
    this.add(new THREE.CylinderGeometry(radius, radius, length, segments), color, x, y, z, rotationX, rotationY, rotationZ);
  }

  sphere(x, y, z, radius, color, scaleY = 1, scaleZ = 1) {
    const geometry = new THREE.SphereGeometry(radius, 12, 8);
    if (scaleY !== 1 || scaleZ !== 1) geometry.scale(1, scaleY, scaleZ);
    this.add(geometry, color, x, y, z);
  }

  makeGeometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }

  makeMesh(material, castShadow = false) {
    if (this.positions.length === 0) return null;
    const mesh = new THREE.Mesh(this.makeGeometry(), material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    return mesh;
  }
}

function buildWheelGeometry(spec) {
  const batch = new PrimitiveBatch();
  batch.cylinder(0, 0, 0, spec.wheelRadius, spec.wheelWidth, '#171d20', 0, 0, Math.PI / 2, 16);
  batch.cylinder(0, 0, 0, spec.wheelRadius * 0.57, spec.wheelWidth * 1.04, '#a2aaa7', 0, 0, Math.PI / 2, 10);
  batch.cylinder(0, 0, 0, spec.wheelRadius * 0.22, spec.wheelWidth * 1.09, '#39464b', 0, 0, Math.PI / 2, 10);
  return batch.makeGeometry();
}

function addCommonBodyDetails(body, spec, primary, secondary, baseHeight) {
  const { width, length } = spec;
  body.box(0, baseHeight, 0, width, 0.42, length, primary);
  body.box(0, baseHeight - 0.17, 0, width * 1.02, 0.12, length * 0.96, secondary);
  body.box(0, baseHeight - 0.04, length / 2 + 0.055, width * 0.9, 0.16, 0.12, '#28353a');
  body.box(0, baseHeight - 0.04, -length / 2 - 0.055, width * 0.9, 0.16, 0.12, '#28353a');
  body.box(-width * 0.51, baseHeight + 0.19, 0, 0.055, 0.045, length * 0.64, secondary);
  body.box(width * 0.51, baseHeight + 0.19, 0, 0.055, 0.045, length * 0.64, secondary);
}

function makePoliceDecal() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const g = canvas.getContext('2d');
  g.fillStyle = '#244f78';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = '#b9d5df';
  g.lineWidth = 5;
  g.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  g.fillStyle = '#f1f3e9';
  g.font = '800 58px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('PDC', 128, 51);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false });
}

function buildVehicleModel(spec, primary, secondary, shared, police = false) {
  const group = new THREE.Group();
  group.name = spec.name;
  const body = new PrimitiveBatch();
  const glass = new PrimitiveBatch();
  const headlights = new PrimitiveBatch();
  const brakes = new PrimitiveBatch();
  const { width: w, length: l, wheelbase: wb, wheelRadius: wr, style } = spec;

  if (style === 'coupe') {
    addCommonBodyDetails(body, spec, primary, secondary, 0.55);
    body.box(0, 0.78, l * 0.29, w * 0.9, 0.16, l * 0.35, primary);
    body.box(0, 0.77, -l * 0.37, w * 0.91, 0.19, l * 0.21, primary);
    glass.box(0, 1.0, -0.18, w * 0.72, 0.4, l * 0.33, '#294751');
    body.box(0, 1.23, -0.22, w * 0.61, 0.09, l * 0.22, secondary);
    body.box(0, 0.86, -l * 0.47, w * 0.78, 0.055, 0.18, secondary);
    body.box(-w * 0.53, 1.0, 0.18, 0.18, 0.1, 0.26, primary);
    body.box(w * 0.53, 1.0, 0.18, 0.18, 0.1, 0.26, primary);
  } else if (style === 'muscle') {
    addCommonBodyDetails(body, spec, primary, secondary, 0.61);
    body.box(0, 0.88, l * 0.28, w * 0.93, 0.22, l * 0.39, primary);
    body.box(0, 0.79, l * 0.31, w * 0.16, 0.06, l * 0.33, secondary);
    glass.box(0, 1.14, -0.25, w * 0.75, 0.49, l * 0.29, '#263f49');
    body.box(0, 1.42, -0.31, w * 0.74, 0.1, l * 0.25, primary);
    body.box(0, 0.87, -l * 0.39, w * 0.92, 0.2, l * 0.19, primary);
    body.box(0, 0.93, -l * 0.49, w * 0.82, 0.07, 0.16, secondary);
    body.cylinder(-w * 0.28, 0.36, -l * 0.52, 0.075, 0.22, '#929b98', Math.PI / 2);
    body.cylinder(w * 0.28, 0.36, -l * 0.52, 0.075, 0.22, '#929b98', Math.PI / 2);
  } else if (style === 'suv') {
    addCommonBodyDetails(body, spec, primary, secondary, 0.72);
    body.box(0, 1.08, -0.15, w * 0.91, 0.7, l * 0.65, primary);
    glass.box(0, 1.39, 0.55, w * 0.82, 0.48, l * 0.23, '#294751');
    glass.box(-w * 0.461, 1.4, -0.43, 0.035, 0.47, l * 0.31, '#31515b');
    glass.box(w * 0.461, 1.4, -0.43, 0.035, 0.47, l * 0.31, '#31515b');
    body.box(0, 1.72, -0.29, w * 0.94, 0.14, l * 0.66, secondary);
    body.box(-w * 0.39, 1.86, -0.3, 0.07, 0.16, l * 0.6, '#344147');
    body.box(w * 0.39, 1.86, -0.3, 0.07, 0.16, l * 0.6, '#344147');
    body.box(0, 1.1, -l * 0.51, w * 0.5, 0.55, 0.12, secondary);
    body.box(0, 1.11, l * 0.502, w * 0.58, 0.35, 0.06, '#25383e');
  } else if (style === 'hatchback') {
    addCommonBodyDetails(body, spec, primary, secondary, 0.52);
    body.box(0, 0.78, l * 0.31, w * 0.9, 0.18, l * 0.25, primary);
    glass.box(0, 1.01, -0.17, w * 0.78, 0.53, l * 0.47, '#31505a');
    body.box(0, 1.32, -0.27, w * 0.78, 0.1, l * 0.39, secondary);
    body.box(0, 0.91, -l * 0.43, w * 0.87, 0.52, l * 0.12, primary);
    body.box(0, 1.0, -l * 0.495, w * 0.65, 0.28, 0.035, '#2b4851');
    body.box(0, 0.7, l * 0.51, w * 0.56, 0.18, 0.04, secondary);
    body.box(-w * 0.29, 1.06, 0.48, 0.06, 0.35, 0.08, primary);
    body.box(w * 0.29, 1.06, 0.48, 0.06, 0.35, 0.08, primary);
  } else if (style === 'van') {
    addCommonBodyDetails(body, spec, primary, secondary, 0.64);
    body.box(0, 1.28, -l * 0.16, w * 0.95, 1.18, l * 0.65, primary);
    body.box(0, 1.82, -l * 0.16, w * 0.94, 0.12, l * 0.66, secondary);
    body.box(0, 1.0, l * 0.34, w * 0.91, 0.62, l * 0.24, primary);
    glass.box(0, 1.43, l * 0.35, w * 0.8, 0.5, l * 0.19, '#2c4b55');
    glass.box(-w * 0.456, 1.43, l * 0.23, 0.035, 0.48, l * 0.14, '#355863');
    glass.box(w * 0.456, 1.43, l * 0.23, 0.035, 0.48, l * 0.14, '#355863');
    body.box(-w * 0.483, 1.18, -l * 0.17, 0.035, 0.17, l * 0.6, secondary);
    body.box(w * 0.483, 1.18, -l * 0.17, 0.035, 0.17, l * 0.6, secondary);
    body.box(0, 1.25, -l * 0.493, 0.045, 0.94, 0.035, secondary);
    body.box(0, 0.99, l * 0.505, w * 0.55, 0.25, 0.055, '#26383e');
  } else {
    body.box(0, 0.61, 0, 0.24, 0.19, wb * 0.85, '#303c40');
    body.box(0, 0.81, 0.2, 0.48, 0.38, 0.65, primary, 0, -0.15);
    body.box(0, 0.86, -0.42, 0.43, 0.17, 0.62, '#242c30');
    body.box(0, 0.7, 0.47, 0.53, 0.24, 0.45, secondary);
    body.cylinder(-0.18, 0.59, 0.63, 0.045, 0.93, '#a3aaa5', -0.24);
    body.cylinder(0.18, 0.59, 0.63, 0.045, 0.93, '#a3aaa5', -0.24);
    body.cylinder(0, 0.49, -0.18, 0.22, 0.52, '#515b5c', 0, 0, Math.PI / 2);
    body.cylinder(0.29, 0.39, -0.36, 0.065, 0.85, '#a2a49c', Math.PI / 2);
    body.box(0, 1.12, 0.58, 0.75, 0.055, 0.08, '#303b40');
    body.box(-0.39, 1.12, 0.58, 0.08, 0.09, 0.18, '#20282d');
    body.box(0.39, 1.12, 0.58, 0.08, 0.09, 0.18, '#20282d');
    glass.box(0, 1.16, 0.68, 0.48, 0.34, 0.035, '#51737b', 0, -0.22);
    body.box(0, 0.64, -0.82, 0.38, 0.12, 0.35, primary);
  }

  if (police) {
    body.box(0, 0.79, l * 0.31, w * 0.68, 0.055, l * 0.24, '#315f85');
    for (const side of [-1, 1]) {
      body.box(side * w * 0.514, 0.77, -0.12, 0.045, 0.28, l * 0.87, '#315f85');
      body.box(side * w * 0.52, 1.45, 0.15, 0.04, 0.09, l * 0.64, '#e7eee9');
    }
    body.box(0, 1.97, -0.31, 1.55, 0.1, 0.38, '#243238');
  }

  const lightY = style === 'suv' || style === 'van' ? 0.92 : style === 'motorcycle' ? 0.91 : 0.69;
  const lightZ = style === 'motorcycle' ? 0.87 : l / 2 + 0.07;
  const lightGap = style === 'motorcycle' ? 0 : w * 0.32;
  const lightWidth = style === 'motorcycle' ? 0.29 : w * 0.2;
  for (const side of lightGap === 0 ? [0] : [-1, 1]) {
    headlights.box(side * lightGap, lightY, lightZ, lightWidth, style === 'motorcycle' ? 0.24 : 0.17, 0.055, '#fff0bd');
    brakes.box(side * lightGap, lightY, -l / 2 - 0.07, lightWidth, 0.17, 0.055, '#ff4938');
  }

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff', vertexColors: true, roughness: 0.47, metalness: 0.18,
  });
  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: '#fff1c2', emissive: '#ffe3a0', emissiveIntensity: 0.1, roughness: 0.25,
  });
  const brakeMaterial = new THREE.MeshStandardMaterial({
    color: '#a92724', emissive: '#ff3026', emissiveIntensity: 0.45, roughness: 0.3,
  });
  const bodyMesh = body.makeMesh(bodyMaterial, true);
  const glassMesh = glass.makeMesh(shared.glassMaterial);
  const headlightMesh = headlights.makeMesh(headlightMaterial);
  const brakeMesh = brakes.makeMesh(brakeMaterial);
  for (const mesh of [bodyMesh, glassMesh, headlightMesh, brakeMesh]) {
    if (mesh) group.add(mesh);
  }

  const policeLights = [];
  const policeGeometries = [];
  const policeMaterials = [];
  if (police) {
    shared.policeDecalMaterial ??= makePoliceDecal();
    const decalGeometry = new THREE.PlaneGeometry(1.35, 0.5);
    policeGeometries.push(decalGeometry);
    for (const side of [-1, 1]) {
      const decal = new THREE.Mesh(decalGeometry, shared.policeDecalMaterial);
      decal.position.set(side * (w * 0.52 + 0.025), 1.17, 0.05);
      decal.rotation.y = side * Math.PI / 2;
      group.add(decal);
    }
    const lightGeometry = new THREE.BoxGeometry(0.68, 0.17, 0.31);
    policeGeometries.push(lightGeometry);
    for (const [side, color] of [[-1, '#ff3545'], [1, '#35a7ff']]) {
      const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      const lens = new THREE.Mesh(lightGeometry, material);
      lens.position.set(side * 0.4, 2.08, -0.31);
      group.add(lens);
      const glow = new THREE.PointLight(color, 0, 11, 2);
      glow.position.set(side * 0.4, 2.17, -0.31);
      group.add(glow);
      policeLights.push({ material, glow, side });
      policeMaterials.push(material);
    }
  }

  const wheelGeometryKey = `${spec.key}:${spec.wheelRadius}:${spec.wheelWidth}`;
  if (!shared.wheelGeometries.has(wheelGeometryKey)) {
    shared.wheelGeometries.set(wheelGeometryKey, buildWheelGeometry(spec));
  }
  const wheelGeometry = shared.wheelGeometries.get(wheelGeometryKey);
  const wheels = [];
  const axleX = style === 'motorcycle' ? 0 : w / 2 + spec.wheelWidth * 0.08;
  for (const axle of [-1, 1]) {
    const sides = style === 'motorcycle' ? [0] : [-1, 1];
    for (const side of sides) {
      const mount = new THREE.Group();
      mount.position.set(side * axleX, wr, axle * wb / 2);
      const spin = new THREE.Group();
      const mesh = new THREE.Mesh(wheelGeometry, shared.wheelMaterial);
      mesh.receiveShadow = true;
      spin.add(mesh);
      mount.add(spin);
      group.add(mount);
      wheels.push({ mount, spin, front: axle > 0 });
    }
  }

  const smokeMaterial = new THREE.MeshBasicMaterial({
    color: '#3b4242', transparent: true, opacity: 0.28, depthWrite: false,
  });
  const smoke = new THREE.Group();
  const smokePuffs = [];
  for (let index = 0; index < 4; index += 1) {
    const puff = new THREE.Mesh(shared.smokeGeometry, smokeMaterial);
    smoke.add(puff);
    smokePuffs.push(puff);
  }
  smoke.position.set(0, style === 'motorcycle' ? 0.75 : 1.0, style === 'motorcycle' ? 0.1 : l * 0.28);
  smoke.visible = false;
  group.add(smoke);

  return {
    group, bodyMesh, bodyMaterial, headlightMaterial, brakeMaterial, wheels, smoke, smokePuffs, smokeMaterial,
    policeLights,
    ownedGeometries: [bodyMesh?.geometry, glassMesh?.geometry, headlightMesh?.geometry, brakeMesh?.geometry, ...policeGeometries].filter(Boolean),
    ownedMaterials: policeMaterials,
  };
}

function rayColliderTime(origin, end, collider, padding) {
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

export function createVehicles(stage, city, player, seed = city.seed) {
  const random = mulberry32((seed ^ 0x56e1c1e) | 0);
  const vehicles = [];
  const occupiedSpots = new Set();
  const shared = {
    glassMaterial: new THREE.MeshStandardMaterial({
      color: '#90b3ba', vertexColors: true, roughness: 0.19, metalness: 0.32,
      transparent: true, opacity: 0.82,
    }),
    wheelMaterial: new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.72, metalness: 0.17 }),
    wheelGeometries: new Map(),
    smokeGeometry: new THREE.IcosahedronGeometry(0.36, 1),
  };
  const parkingSpots = [];
  let nextId = 1;
  let parkedSequence = 0;
  let activeVehicle = null;
  let parkedTimer = 0;
  let chaseReady = false;
  let chaseYaw = 0;
  let elapsed = 0;

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const nextPosition = new THREE.Vector3();
  const collisionNormal = new THREE.Vector3();
  const relative = new THREE.Vector3();
  const target = new THREE.Vector3();
  const desiredCamera = new THREE.Vector3();
  const resolvedCamera = new THREE.Vector3();
  const currentCameraPosition = new THREE.Vector3();
  const previousCameraPosition = new THREE.Vector3();
  const currentLook = new THREE.Vector3();
  const previousLook = new THREE.Vector3();
  const renderLook = new THREE.Vector3();

  for (const block of city.blocks) {
    const alongOffsets = [-23, 23];
    for (const along of alongOffsets) {
      for (const side of [-1, 1]) {
        parkingSpots.push({
          id: `${block.id}-vertical-${side}-${along}`,
          x: block.x + side * (CITY.blockSize / 2 + 2.15),
          z: block.z + along,
          heading: side > 0 ? Math.PI : 0,
          district: block.district,
        });
        parkingSpots.push({
          id: `${block.id}-horizontal-${side}-${along}`,
          x: block.x + along,
          z: block.z + side * (CITY.blockSize / 2 + 2.15),
          heading: side > 0 ? -Math.PI / 2 : Math.PI / 2,
          district: block.district,
        });
      }
    }
  }

  function resolveType(requested) {
    if (requested && typeof requested === 'object' && requested.key) return requested;
    if (typeof requested === 'string') {
      const found = VEHICLES.types.find((type) => type.key === requested || type.name === requested || type.style === requested);
      if (found) return found;
    }
    return pick(random, VEHICLES.types);
  }

  function spawnVehicle(options = {}) {
    const spec = options.police ? resolveType('marea') : resolveType(options.type);
    const paints = options.police
      ? ['#e7eee9', '#315f85']
      : options.color ? [options.color, options.accent || '#e2c890'] : pick(random, PAINTS);
    const model = buildVehicleModel(spec, paints[0], paints[1], shared, Boolean(options.police));
    const heading = options.heading ?? 0;
    const vehicle = {
      id: `vehicle-${nextId++}`,
      name: options.police ? 'PDC Marea 4x4' : spec.name,
      type: spec.key,
      spec,
      model,
      group: model.group,
      position: new THREE.Vector3(options.x ?? 0, 0, options.z ?? 0),
      previousPosition: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      heading,
      previousHeading: heading,
      speed: 0,
      steer: 0,
      health: spec.health,
      maxHealth: spec.health,
      control: options.control || (options.police ? 'police' : 'parked'),
      police: Boolean(options.police),
      siren: Boolean(options.siren ?? options.police),
      justEntered: false,
      occupied: false,
      braking: false,
      handbrake: false,
      spotId: null,
      ai: null,
      collisionCooldown: 0,
      lastImpact: 0,
      wheelAngle: 0,
      engineRunning: spec.health > 0 && options.control !== 'parked' && options.control !== undefined,
    };
    vehicle.position.y = city.groundHeightAt(vehicle.position.x, vehicle.position.z);
    vehicle.previousPosition.copy(vehicle.position);
    vehicle.group.position.copy(vehicle.position);
    vehicle.group.rotation.y = heading;
    vehicle.group.userData.vehicle = vehicle;
    stage.scene.add(vehicle.group);
    vehicles.push(vehicle);
    return vehicle;
  }

  function detachSpot(vehicle) {
    if (!vehicle.spotId) return;
    occupiedSpots.delete(vehicle.spotId);
    vehicle.spotId = null;
  }

  function assignSpot(vehicle, spot) {
    detachSpot(vehicle);
    vehicle.spotId = spot.id;
    occupiedSpots.add(spot.id);
    vehicle.control = 'parked';
    vehicle.position.set(spot.x, city.groundHeightAt(spot.x, spot.z), spot.z);
    vehicle.previousPosition.copy(vehicle.position);
    vehicle.heading = spot.heading;
    vehicle.previousHeading = spot.heading;
    vehicle.velocity.set(0, 0, 0);
    vehicle.speed = 0;
    vehicle.health = vehicle.maxHealth;
    vehicle.engineRunning = false;
    vehicle.group.position.copy(vehicle.position);
    vehicle.group.rotation.y = spot.heading;
  }

  function availableSpot(origin, requireDistrict = true) {
    const candidates = parkingSpots.filter((spot) => {
      if (occupiedSpots.has(spot.id)) return false;
      if (requireDistrict && spot.district !== player.state.district) return false;
      const distance = Math.hypot(spot.x - origin.x, spot.z - origin.z);
      return distance < VEHICLES.parkedRadius && distance > 9;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const da = Math.hypot(a.x - origin.x, a.z - origin.z);
      const db = Math.hypot(b.x - origin.x, b.z - origin.z);
      return da - db;
    });
    return candidates[Math.floor(random() * Math.min(10, candidates.length))];
  }

  function spawnParkedCar(origin = player.state.position) {
    const spot = availableSpot(origin);
    if (!spot) return null;
    const type = VEHICLES.types[parkedSequence % VEHICLES.types.length];
    parkedSequence += 1;
    const vehicle = spawnVehicle({
      x: spot.x, z: spot.z, heading: spot.heading, control: 'parked',
      type: parkedSequence <= VEHICLES.types.length ? type : undefined,
    });
    vehicle.spotId = spot.id;
    occupiedSpots.add(spot.id);
    return vehicle;
  }

  function spawnTrafficCar(options = {}, z, heading, type) {
    if (typeof options === 'number') options = { x: options, z, heading, type };
    return spawnVehicle({ ...options, control: 'traffic' });
  }

  function nearestVehicle(x, z, maxDistance = VEHICLES.enterDistance) {
    if (typeof x === 'object') {
      maxDistance = z ?? VEHICLES.enterDistance;
      z = x.z;
      x = x.x;
    }
    let nearest = null;
    let nearestDistanceSq = maxDistance * maxDistance;
    for (const vehicle of vehicles) {
      if (vehicle === activeVehicle) continue;
      const dx = vehicle.position.x - x;
      const dz = vehicle.position.z - z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq <= nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearest = vehicle;
      }
    }
    return nearest;
  }

  function enter(vehicle) {
    if (!vehicle || activeVehicle || !vehicles.includes(vehicle)) return false;
    detachSpot(vehicle);
    vehicle.occupied = true;
    vehicle.control = 'player';
    vehicle.ai = null;
    activeVehicle = vehicle;
    vehicle.justEntered = true;
    if (vehicle.police) vehicle.siren = false;
    chaseReady = false;
    chaseYaw = vehicle.heading;
    player.enterVehicle(vehicle);
    return true;
  }

  function safeExitPosition(vehicle) {
    const candidates = [];
    const cosine = Math.cos(vehicle.heading);
    const sine = Math.sin(vehicle.heading);
    const distance = vehicle.spec.width / 2 + PLAYER.radius + 0.5;
    candidates.push(
      { x: vehicle.position.x + cosine * distance, z: vehicle.position.z - sine * distance },
      { x: vehicle.position.x - cosine * distance, z: vehicle.position.z + sine * distance },
      { x: vehicle.position.x - sine * (vehicle.spec.length / 2 + 1), z: vehicle.position.z - cosine * (vehicle.spec.length / 2 + 1) },
    );
    for (const candidate of candidates) {
      candidate.x = clamp(candidate.x, -WORLD.halfSize + 1, WORLD.halfSize - 1);
      candidate.z = clamp(candidate.z, -WORLD.halfSize + 1, WORLD.seawallZ - 1.1);
      let blocked = false;
      for (const collider of city.queryColliders(candidate.x, candidate.z, PLAYER.radius)) {
        const closestX = clamp(candidate.x, collider.minX, collider.maxX);
        const closestZ = clamp(candidate.z, collider.minZ, collider.maxZ);
        if (Math.hypot(candidate.x - closestX, candidate.z - closestZ) < PLAYER.radius + 0.08) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return { ...candidate, heading: vehicle.heading };
    }
    return { x: vehicle.position.x, z: vehicle.position.z, heading: vehicle.heading };
  }

  function exit() {
    if (!activeVehicle) return null;
    const vehicle = activeVehicle;
    const exitPosition = safeExitPosition(vehicle);
    vehicle.occupied = false;
    vehicle.control = 'parked';
    vehicle.braking = false;
    vehicle.handbrake = false;
    vehicle.steer = 0;
    activeVehicle = null;
    chaseReady = false;
    player.exitVehicle(exitPosition);
    return vehicle;
  }

  function damage(vehicle, amount) {
    if (!vehicle || amount <= 0) return;
    vehicle.health = Math.max(0, vehicle.health - amount);
    if (vehicle.health === 0) vehicle.engineRunning = false;
    const brightness = 0.32 + 0.68 * vehicle.health / vehicle.maxHealth;
    vehicle.model.bodyMaterial.color.setScalar(brightness);
  }

  function resolveWorldCollision(vehicle) {
    let strongestImpact = 0;
    collisionNormal.set(0, 0, 0);
    const spec = vehicle.spec;
    const radius = Math.max(0.42, spec.width * 0.47);
    const sampleOffsets = spec.style === 'motorcycle' ? [-0.55, 0.55] : [-0.34, 0, 0.34];
    for (let iteration = 0; iteration < 2; iteration += 1) {
      const candidates = city.queryColliders(vehicle.position.x, vehicle.position.z, spec.length * 0.65 + radius);
      let corrected = false;
      vehicleForward(vehicle, forward);
      for (const offsetFactor of sampleOffsets) {
        const sampleX = vehicle.position.x + forward.x * spec.length * offsetFactor;
        const sampleZ = vehicle.position.z + forward.z * spec.length * offsetFactor;
        for (const collider of candidates) {
          const closestX = clamp(sampleX, collider.minX, collider.maxX);
          const closestZ = clamp(sampleZ, collider.minZ, collider.maxZ);
          let dx = sampleX - closestX;
          let dz = sampleZ - closestZ;
          let distance = Math.hypot(dx, dz);
          if (distance >= radius) continue;
          let insideDepth = 0;
          if (distance < 0.00001) {
            const sideDistances = [
              { value: Math.abs(sampleX - collider.minX), x: -1, z: 0 },
              { value: Math.abs(collider.maxX - sampleX), x: 1, z: 0 },
              { value: Math.abs(sampleZ - collider.minZ), x: 0, z: -1 },
              { value: Math.abs(collider.maxZ - sampleZ), x: 0, z: 1 },
            ].sort((a, b) => a.value - b.value)[0];
            insideDepth = sideDistances.value;
            dx = sideDistances.x;
            dz = sideDistances.z;
            distance = 0;
          } else {
            dx /= distance;
            dz /= distance;
          }
          const penetration = radius + insideDepth - distance + 0.002;
          vehicle.position.x += dx * penetration;
          vehicle.position.z += dz * penetration;
          const into = vehicle.velocity.x * dx + vehicle.velocity.z * dz;
          if (into < 0) {
            strongestImpact = Math.max(strongestImpact, -into);
            collisionNormal.set(dx, 0, dz);
          }
          corrected = true;
        }
      }
      if (!corrected) break;
    }

    const minimum = -WORLD.halfSize + radius;
    const maximum = WORLD.halfSize - radius;
    const clampedX = clamp(vehicle.position.x, minimum, maximum);
    if (clampedX !== vehicle.position.x) {
      strongestImpact = Math.max(strongestImpact, Math.abs(vehicle.velocity.x));
      vehicle.position.x = clampedX;
      vehicle.velocity.x = 0;
    }
    const clampedZ = clamp(vehicle.position.z, minimum, WORLD.seawallZ - 1.0);
    if (clampedZ !== vehicle.position.z) {
      strongestImpact = Math.max(strongestImpact, Math.abs(vehicle.velocity.z));
      vehicle.position.z = clampedZ;
      vehicle.velocity.z = 0;
    }

    if (strongestImpact > 0) {
      if (collisionNormal.lengthSq() > 0) {
        const normalSpeed = vehicle.velocity.dot(collisionNormal);
        if (normalSpeed < 0) vehicle.velocity.addScaledVector(collisionNormal, -normalSpeed);
      }
      vehicle.velocity.multiplyScalar(Math.max(0.28, 1 - strongestImpact * 0.045));
      vehicle.speed = vehicle.velocity.dot(vehicleForward(vehicle, forward));
      vehicle.lastImpact = strongestImpact;
      if (strongestImpact > 2.4 && vehicle.collisionCooldown <= 0) {
        damage(vehicle, (strongestImpact - 2.4) * 2.15);
        vehicle.collisionCooldown = 0.32;
      }
    }
  }

  function resolveVehicleContacts(vehicle) {
    vehicleForward(vehicle, forward);
    for (const other of vehicles) {
      if (other === vehicle) continue;
      const dx = vehicle.position.x - other.position.x;
      const dz = vehicle.position.z - other.position.z;
      const distance = Math.hypot(dx, dz);
      const minimum = Math.max(1.05, (vehicle.spec.width + other.spec.width) * 0.57);
      if (distance >= minimum || distance > vehicle.spec.length * 0.7 + other.spec.length * 0.7) continue;
      const nx = distance > 0.001 ? dx / distance : forward.x;
      const nz = distance > 0.001 ? dz / distance : forward.z;
      const penetration = minimum - Math.max(distance, 0.001);
      vehicle.position.x += nx * penetration * 0.68;
      vehicle.position.z += nz * penetration * 0.68;
      if (!other.occupied) {
        other.position.x -= nx * penetration * 0.32;
        other.position.z -= nz * penetration * 0.32;
        detachSpot(other);
      }
      relative.copy(vehicle.velocity).sub(other.velocity);
      const impact = Math.max(0, -(relative.x * nx + relative.z * nz));
      const into = vehicle.velocity.x * nx + vehicle.velocity.z * nz;
      if (into < 0) {
        vehicle.velocity.x -= nx * into * 1.25;
        vehicle.velocity.z -= nz * into * 1.25;
      }
      if (impact > 2 && vehicle.collisionCooldown <= 0) {
        damage(vehicle, (impact - 2) * 1.35);
        damage(other, (impact - 2) * 0.75);
        vehicle.lastImpact = impact;
        other.lastImpact = impact;
        vehicle.collisionCooldown = 0.3;
      }
    }
  }

  function drive(vehicle, actions, dt) {
    const spec = vehicle.spec;
    vehicleForward(vehicle, forward);
    vehicleRight(vehicle, right);
    let signedSpeed = vehicle.velocity.dot(forward);
    lateral.copy(vehicle.velocity).addScaledVector(forward, -signedSpeed);
    const throttle = vehicle.health > 0 ? actions.forward : 0;
    let acceleration = 0;
    vehicle.braking = false;
    vehicle.handbrake = Boolean(actions.handbrake || actions.jump);

    if (throttle > 0) {
      if (signedSpeed < -0.55) {
        acceleration = spec.brake;
        vehicle.braking = true;
      } else {
        const softCap = clamp(1 - Math.pow(Math.max(0, signedSpeed) / spec.maxSpeed, 3), 0, 1);
        acceleration = spec.engine * softCap;
      }
    } else if (throttle < 0) {
      if (signedSpeed > 0.55) {
        acceleration = -spec.brake;
        vehicle.braking = true;
      } else {
        const softCap = clamp(1 - Math.pow(Math.max(0, -signedSpeed) / spec.reverseSpeed, 3), 0, 1);
        acceleration = -spec.engine * 0.62 * softCap;
      }
    }
    signedSpeed += acceleration * dt;
    if (vehicle.braking && throttle < 0 && signedSpeed < 0) signedSpeed = 0;
    if (vehicle.braking && throttle > 0 && signedSpeed > 0) signedSpeed = 0;

    const resistance = spec.rollingResistance + spec.drag * signedSpeed * signedSpeed + (vehicle.handbrake ? 3.4 : 0);
    if (Math.abs(signedSpeed) <= resistance * dt) signedSpeed = 0;
    else signedSpeed -= Math.sign(signedSpeed) * resistance * dt;
    if (signedSpeed > spec.maxSpeed) signedSpeed = THREE.MathUtils.damp(signedSpeed, spec.maxSpeed, 4, dt);
    if (signedSpeed < -spec.reverseSpeed) signedSpeed = THREE.MathUtils.damp(signedSpeed, -spec.reverseSpeed, 4, dt);

    vehicle.velocity.copy(lateral).addScaledVector(forward, signedSpeed);
    const maximumSteer = spec.steering / (1 + Math.abs(signedSpeed) * 0.034);
    const steerTarget = actions.right * maximumSteer;
    vehicle.steer = THREE.MathUtils.damp(vehicle.steer, steerTarget, 9.5, dt);
    if (Math.abs(signedSpeed) > 0.12) {
      const steeringSpeed = signedSpeed / spec.wheelbase * Math.tan(vehicle.steer);
      vehicle.heading -= steeringSpeed * dt * (vehicle.handbrake ? 1.22 : 0.88);
      vehicle.heading = shortAngle(vehicle.heading);
    }

    vehicleForward(vehicle, forward);
    vehicleRight(vehicle, right);
    signedSpeed = vehicle.velocity.dot(forward);
    const lateralSpeed = vehicle.velocity.dot(right);
    const grip = vehicle.handbrake ? spec.handbrakeGrip : spec.grip;
    const retainedLateral = lateralSpeed * Math.exp(-grip * dt);
    vehicle.velocity.copy(forward).multiplyScalar(signedSpeed).addScaledVector(right, retainedLateral);
    vehicle.speed = signedSpeed;
    nextPosition.copy(vehicle.position).addScaledVector(vehicle.velocity, dt);
    vehicle.position.copy(nextPosition);
    resolveWorldCollision(vehicle);
    resolveVehicleContacts(vehicle);
    vehicle.position.y = city.groundHeightAt(vehicle.position.x, vehicle.position.z);
  }

  function updateAppearance(vehicle, dt) {
    const operating = vehicle.health > 0 && (vehicle.control !== 'parked' || vehicle.occupied);
    vehicle.engineRunning = vehicle.health > 0 && vehicle.control !== 'parked';
    vehicle.model.headlightMaterial.emissiveIntensity = operating ? (vehicle.control === 'player' ? 2.2 : 1.35) : 0.04;
    vehicle.model.brakeMaterial.emissiveIntensity = vehicle.braking ? 3.8 : operating ? 0.72 : 0.28;
    vehicle.wheelAngle += vehicle.speed * dt / vehicle.spec.wheelRadius;
    for (const wheel of vehicle.model.wheels) {
      wheel.spin.rotation.x = vehicle.wheelAngle;
      if (wheel.front) wheel.mount.rotation.y = -vehicle.steer;
    }
    const damaged = vehicle.health < vehicle.maxHealth * 0.3;
    vehicle.model.smoke.visible = damaged;
    if (damaged) {
      for (let index = 0; index < vehicle.model.smokePuffs.length; index += 1) {
        const puff = vehicle.model.smokePuffs[index];
        const phase = (elapsed * 0.48 + index / vehicle.model.smokePuffs.length) % 1;
        puff.position.set(Math.sin(index * 4.1 + elapsed) * phase * 0.25, phase * 2.1, -phase * 0.4);
        puff.scale.setScalar(0.35 + phase * 1.45);
        puff.visible = vehicle.health > 0 || phase < 0.82;
      }
    }
    if (vehicle.police) {
      const redPhase = Math.floor(elapsed * 7.5) % 2 === 0;
      for (const light of vehicle.model.policeLights) {
        const active = vehicle.siren && (light.side < 0 ? redPhase : !redPhase);
        light.material.color.set(active ? (light.side < 0 ? '#ff3545' : '#35a7ff') : '#263c48');
        light.glow.intensity = active ? 18 : 0;
      }
    }
  }

  function resolveChaseCamera(origin, wanted, output) {
    output.copy(wanted);
    const midpointX = (origin.x + wanted.x) / 2;
    const midpointZ = (origin.z + wanted.z) / 2;
    const radius = Math.hypot(wanted.x - origin.x, wanted.z - origin.z) / 2 + 1;
    const candidates = city.queryColliders(midpointX, midpointZ, radius);
    let nearest = 1;
    for (const collider of candidates) {
      const hitTime = rayColliderTime(origin, wanted, collider, CAMERA.collisionPadding);
      if (hitTime !== null && hitTime > 0.04 && hitTime < nearest) nearest = hitTime;
    }
    if (nearest < 1) output.lerpVectors(origin, wanted, Math.max(0.05, nearest - 0.04));
    output.y = Math.max(output.y, city.groundHeightAt(output.x, output.z) + CAMERA.minGroundClearance);
    return output;
  }

  function updateChaseCamera(dt, context) {
    if (!activeVehicle) return;
    const speed = Math.abs(activeVehicle.speed);
    const aiming = Boolean(context?.combat?.aiming);
    if (aiming) {
      chaseYaw = player.state.aimYaw;
      player.getAimDirection(lateral);
      right.set(-Math.cos(activeVehicle.heading), 0, Math.sin(activeVehicle.heading));
      target.copy(activeVehicle.position).addScaledVector(right, 0.72);
      target.y += 1.32;
      desiredCamera.copy(target).addScaledVector(lateral, -CAMERA.aimDistance);
      currentLook.copy(target).addScaledVector(lateral, 18);
    } else {
      chaseYaw += shortAngle(activeVehicle.heading - chaseYaw) * (1 - Math.exp(-CAMERA.chaseYawSmoothing * dt));
      forward.set(Math.sin(chaseYaw), 0, Math.cos(chaseYaw));
      vehicleForward(activeVehicle, right);
      const distance = CAMERA.chaseDistance + speed * CAMERA.chaseSpeedDistance + activeVehicle.spec.length * 0.18;
      target.copy(activeVehicle.position);
      target.y += CAMERA.chaseTargetHeight;
      desiredCamera.copy(target).addScaledVector(forward, -distance);
      desiredCamera.y += CAMERA.chaseHeight + Math.min(2.1, speed * 0.025);
      currentLook.copy(activeVehicle.position).addScaledVector(right, CAMERA.chaseLookAhead + speed * CAMERA.chaseSpeedLookAhead);
      currentLook.y += CAMERA.chaseTargetHeight + 0.25;
    }
    resolveChaseCamera(target, desiredCamera, resolvedCamera);
    if (!chaseReady) {
      currentCameraPosition.copy(resolvedCamera);
      previousCameraPosition.copy(currentCameraPosition);
      chaseReady = true;
    } else {
      const smoothing = (aiming ? CAMERA.aimSmoothing || 16 : CAMERA.chaseSmoothing) / (1 + speed * 0.007);
      currentCameraPosition.x = THREE.MathUtils.damp(currentCameraPosition.x, resolvedCamera.x, smoothing, dt);
      currentCameraPosition.y = THREE.MathUtils.damp(currentCameraPosition.y, resolvedCamera.y, smoothing, dt);
      currentCameraPosition.z = THREE.MathUtils.damp(currentCameraPosition.z, resolvedCamera.z, smoothing, dt);
    }
    if (previousLook.lengthSq() === 0) previousLook.copy(currentLook);
    stage.camera.position.copy(currentCameraPosition);
    stage.camera.lookAt(currentLook);
  }

  function maintainParking() {
    const origin = player.state.position;
    const parked = vehicles.filter((vehicle) => vehicle.control === 'parked' && !vehicle.occupied && !vehicle.police);
    for (const vehicle of parked) {
      const distance = Math.hypot(vehicle.position.x - origin.x, vehicle.position.z - origin.z);
      const wrongDistrict = city.districtAt(vehicle.position.x, vehicle.position.z) !== player.state.district;
      if (distance > VEHICLES.recycleDistance || (wrongDistrict && distance > 145)) {
        const spot = availableSpot(origin);
        if (spot) assignSpot(vehicle, spot);
      }
    }
    let nearby = vehicles.filter((vehicle) => {
      if (vehicle.control !== 'parked' || vehicle.occupied || vehicle.police) return false;
      return city.districtAt(vehicle.position.x, vehicle.position.z) === player.state.district
        && Math.hypot(vehicle.position.x - origin.x, vehicle.position.z - origin.z) < VEHICLES.parkedRadius;
    }).length;
    while (nearby < VEHICLES.parkedCount) {
      const spawned = spawnParkedCar(origin);
      if (!spawned) break;
      nearby += 1;
    }
  }

  function driveAI(vehicle, controls, dt) {
    if (!vehicle || !vehicles.includes(vehicle) || vehicle === activeVehicle) return false;
    drive(vehicle, { ...IDLE_DRIVING, ...controls }, dt);
    return true;
  }

  function update(dt, context) {
    elapsed += dt;
    parkedTimer -= dt;
    for (const vehicle of vehicles) {
      vehicle.previousPosition.copy(vehicle.position);
      vehicle.previousHeading = vehicle.heading;
      vehicle.justEntered = false;
      vehicle.collisionCooldown = Math.max(0, vehicle.collisionCooldown - dt);
      vehicle.lastImpact = Math.max(0, vehicle.lastImpact - dt * 10);
    }
    previousCameraPosition.copy(currentCameraPosition);
    previousLook.copy(currentLook);

    if (!context.police?.inputLocked && context.actions.interactPressed) {
      if (activeVehicle) exit();
      else enter(nearestVehicle(player.state.position.x, player.state.position.z, VEHICLES.enterDistance));
    }
    if (activeVehicle) {
      drive(activeVehicle, context.police?.inputLocked ? IDLE_DRIVING : context.actions, dt);
      player.state.position.copy(activeVehicle.position);
      player.state.heading = activeVehicle.heading;
      player.state.district = city.districtAt(activeVehicle.position.x, activeVehicle.position.z);
    }
    for (const vehicle of vehicles) updateAppearance(vehicle, dt);
    updateChaseCamera(dt, context);
    if (parkedTimer <= 0) {
      maintainParking();
      parkedTimer = 1.25;
    }
  }

  function render(alpha) {
    for (const vehicle of vehicles) {
      vehicle.group.position.lerpVectors(vehicle.previousPosition, vehicle.position, alpha);
      vehicle.group.rotation.y = vehicle.previousHeading + shortAngle(vehicle.heading - vehicle.previousHeading) * alpha;
    }
    if (activeVehicle && chaseReady) {
      stage.camera.position.lerpVectors(previousCameraPosition, currentCameraPosition, alpha);
      stage.camera.position.y = Math.max(stage.camera.position.y, city.groundHeightAt(stage.camera.position.x, stage.camera.position.z) + CAMERA.minGroundClearance);
      renderLook.lerpVectors(previousLook, currentLook, alpha);
      stage.camera.lookAt(renderLook);
    }
  }

  function removeVehicle(vehicle) {
    const index = vehicles.indexOf(vehicle);
    if (index < 0 || vehicle === activeVehicle) return false;
    detachSpot(vehicle);
    stage.scene.remove(vehicle.group);
    for (const geometry of vehicle.model.ownedGeometries) geometry.dispose();
    vehicle.model.bodyMaterial.dispose();
    vehicle.model.headlightMaterial.dispose();
    vehicle.model.brakeMaterial.dispose();
    vehicle.model.smokeMaterial.dispose();
    for (const material of vehicle.model.ownedMaterials || []) material.dispose();
    vehicle.control = 'removed';
    vehicles.splice(index, 1);
    return true;
  }

  while (vehicles.length < VEHICLES.parkedCount) {
    if (!spawnParkedCar(player.state.position)) break;
  }

  return {
    vehicles,
    get activeVehicle() { return activeVehicle; },
    nearestVehicle,
    spawnVehicle,
    spawnTrafficCar,
    driveAI,
    removeVehicle,
    enter,
    exit,
    damage,
    update,
    render,
  };
}
