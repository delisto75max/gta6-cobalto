// All simulation, world, camera and rendering knobs live here. Distances are metres,
// angles are radians, and colours are CSS hex strings consumed directly by three.js.

export const SEED = 1047;
export const STEP = 1 / 60;
export const MAX_FRAME = 0.1;

export const CITY = {
  blocks: 9,
  blockSize: 110,
  roadWidth: 14,
  avenueWidth: 20,
  pitch: 124,
  sidewalkHeight: 0.18,
  sidewalkInset: 8,
  roadHeight: 0.055,
  promenadeWidth: 14,
  lampSpacing: 52,
  beachPalmSpacing: 28,
  colliderCellSize: 62,
};

export const WORLD = {
  size: 1130,
  halfSize: 565,
  seawallZ: 579,
  seawallHeight: 1.05,
  beachEndZ: 700,
  seaWidth: 3600,
  seaDepth: 2400,
  seaLevel: -0.62,
};

export const BUILDING = {
  floorHeight: 3.15,
  roofCapHeight: 0.34,
  heights: {
    warehouse: [8, 15],
    oldtown: [9, 21],
    villa: [7, 13],
    marina: [17, 36],
    hotel: [30, 69],
    midrise: [34, 76],
    tower: [76, 146],
  },
};

export const PLAYER = {
  radius: 0.36,
  height: 1.82,
  maxHealth: 100,
  maxArmour: 100,
  startingArmour: 25,
  startingMoney: 800,
  walkSpeed: 4.15,
  sprintSpeed: 7.5,
  acceleration: 15,
  turnSpeed: 13,
  gravity: 25,
  jumpSpeed: 8.2,
  walkCycleSpeed: 9.5,
};

export const VEHICLES = {
  enterDistance: 4,
  parkedCount: 24,
  parkedRadius: 430,
  recycleDistance: 460,
  collisionSamples: 3,
  types: [
    {
      key: 'viento', name: 'Viento GT', style: 'coupe', width: 1.88, length: 4.28,
      wheelbase: 2.62, wheelRadius: 0.35, wheelWidth: 0.25, maxSpeed: 53, reverseSpeed: 11,
      engine: 15.8, brake: 27, drag: 0.006, rollingResistance: 0.52, steering: 0.64,
      grip: 9.2, handbrakeGrip: 0.72, health: 100,
    },
    {
      key: 'tiburon', name: 'Tiburón', style: 'muscle', width: 1.96, length: 4.72,
      wheelbase: 2.82, wheelRadius: 0.38, wheelWidth: 0.28, maxSpeed: 47, reverseSpeed: 10,
      engine: 13.2, brake: 25, drag: 0.007, rollingResistance: 0.58, steering: 0.58,
      grip: 7.7, handbrakeGrip: 0.58, health: 125,
    },
    {
      key: 'marea', name: 'Marea 4x4', style: 'suv', width: 2.02, length: 4.55,
      wheelbase: 2.72, wheelRadius: 0.43, wheelWidth: 0.29, maxSpeed: 38, reverseSpeed: 9,
      engine: 10.4, brake: 23, drag: 0.008, rollingResistance: 0.7, steering: 0.56,
      grip: 9.8, handbrakeGrip: 0.9, health: 155,
    },
    {
      key: 'cangrejo', name: 'Cangrejo', style: 'hatchback', width: 1.73, length: 3.72,
      wheelbase: 2.28, wheelRadius: 0.32, wheelWidth: 0.22, maxSpeed: 34, reverseSpeed: 8,
      engine: 8.8, brake: 21, drag: 0.009, rollingResistance: 0.74, steering: 0.62,
      grip: 8.4, handbrakeGrip: 0.85, health: 85,
    },
    {
      key: 'mula', name: 'Mula', style: 'van', width: 2.06, length: 5.08,
      wheelbase: 3.02, wheelRadius: 0.39, wheelWidth: 0.27, maxSpeed: 31, reverseSpeed: 7,
      engine: 8.1, brake: 21, drag: 0.01, rollingResistance: 0.82, steering: 0.5,
      grip: 10.2, handbrakeGrip: 1.1, health: 145,
    },
    {
      key: 'rayo', name: 'Rayo 250', style: 'motorcycle', width: 0.78, length: 2.18,
      wheelbase: 1.46, wheelRadius: 0.34, wheelWidth: 0.14, maxSpeed: 43, reverseSpeed: 4,
      engine: 14.4, brake: 25, drag: 0.007, rollingResistance: 0.45, steering: 0.48,
      grip: 11.5, handbrakeGrip: 1.4, health: 65,
    },
  ],
};

export const TRAFFIC = {
  count: 24,
  laneOffset: 2.45,
  minimumSpeed: 9,
  maximumSpeed: 16.5,
  acceleration: 4.2,
  braking: 10.5,
  visibilityDistance: 355,
  respawnMinimumDistance: 85,
  respawnMaximumDistance: 275,
};

export const PEDESTRIANS = {
  count: 52,
  walkSpeedMin: 1.15,
  walkSpeedMax: 1.75,
  runSpeed: 4.35,
  sidewalkOffset: 51.7,
  recycleDistance: 345,
  respawnDistance: 235,
  speedingCarRadius: 15,
  speedingCarThreshold: 12,
  gunshotRadius: 72,
  fearDuration: 6.5,
};

export const COMBAT = {
  armourAbsorption: 1,
  hitMarkerTime: 0.16,
  muzzleTime: 0.055,
  tracerTime: 0.085,
  tracerPoolSize: 72,
  sparkPoolSize: 240,
  weapons: [
    {
      key: 'cobre9', name: 'Cobre 9', slot: 1, magazineSize: 12, startingReserve: 60,
      automatic: false, fireInterval: 0.24, reloadTime: 1.25, damage: 34, range: 95,
      pellets: 1, spreadHip: 0.026, spreadAim: 0.007, recoil: 0.019,
    },
    {
      key: 'viento', name: 'Viento SMG', slot: 2, magazineSize: 30, startingReserve: 120,
      automatic: true, fireInterval: 0.078, reloadTime: 1.65, damage: 17, range: 72,
      pellets: 1, spreadHip: 0.061, spreadAim: 0.025, recoil: 0.009,
    },
    {
      key: 'rompe', name: 'Rompe', slot: 3, magazineSize: 2, startingReserve: 24,
      automatic: false, fireInterval: 0.62, reloadTime: 1.75, damage: 16, range: 34,
      pellets: 8, spreadHip: 0.105, spreadAim: 0.064, recoil: 0.062,
    },
  ],
};

export const POLICE = {
  maximumWanted: 5,
  heatThresholds: [0, 20, 65, 130, 210, 300],
  heat: {
    weaponFired: 22,
    pedestrianKilled: 72,
    officerHit: 38,
    officerKilled: 85,
    vehicleTheft: 48,
  },
  publicShotHeatCooldown: 1.2,
  outOfSightDecayDelay: 45,
  sightRange: 135,
  witnessRange: 90,
  cruiserCounts: [0, 1, 1, 2, 3, 4],
  cruiserSpawnMinimum: 48,
  cruiserSpawnMaximum: 88,
  investigateSpeed: 14,
  pursuitSpeed: 25,
  officerExitDistance: 15,
  officerWalkSpeed: 3.8,
  officerRunSpeed: 5.2,
  officerRange: 62,
  officerDamage: 9,
  officerSpread: 0.035,
  officerFireInterval: 0.23,
  officerBurstMinimum: 3,
  officerBurstMaximum: 5,
  officerBurstPause: 1.45,
  arrestDistance: 3,
  arrestDuration: 2,
  arrestWakeDistance: 5,
  outcomeFadeIn: 0.65,
  outcomeRespawnAt: 1.15,
  outcomeDuration: 2.3,
  bustedFine: 200,
  wastedFee: 350,
  bustedAmmoRetention: 0.5,
  sirenRange: 210,
  station: { x: CITY.pitch / 2, z: 289, heading: Math.PI },
  hospital: { x: CITY.pitch / 2, z: -103, heading: 0 },
};

export const CAMERA = {
  fov: 59,
  near: 0.12,
  distance: 9.6,
  aimDistance: 5.1,
  aimHeight: 2.05,
  aimShoulderOffset: 0.72,
  aimSmoothing: 16,
  minDistance: 4.2,
  maxDistance: 16,
  height: 3.0,
  targetHeight: 1.35,
  pitch: 0.1,
  minPitch: -0.16,
  maxPitch: 0.72,
  followSmoothing: 12,
  zoomSmoothing: 14,
  wheelSensitivity: 0.008,
  minGroundClearance: 0.65,
  collisionPadding: 0.24,
  chaseDistance: 8.8,
  chaseSpeedDistance: 0.115,
  chaseHeight: 3.7,
  chaseTargetHeight: 1.15,
  chaseLookAhead: 4.5,
  chaseSpeedLookAhead: 0.15,
  chaseSmoothing: 7.5,
  chaseYawSmoothing: 6.5,
};

export const INPUT = {
  mouseSensitivity: 0.00225,
};

export const RENDER = {
  maxPixelRatio: 1.5,
  drawDistance: 1900,
  fogDensity: 0.0005,
  exposure: 1.08,
  shadowMapSize: 2048,
  shadowRadius: 175,
  shadowNear: 10,
  shadowFar: 900,
  sunHeight: 320,
  sunOffsetX: -210,
  sunOffsetZ: -150,
  seaWaveSegments: 72,
  fpsSampleMilliseconds: 750,
};

export const WINDOWS = {
  tileWidth: 7,
  tileHeight: 6.3,
  textureSize: 128,
  emissiveIntensity: 0.34,
};

export const PALETTE = {
  skyTop: '#557f9b',
  skyUpper: '#93a8ae',
  skyHorizon: '#ffd39a',
  skyLower: '#dc8e6a',
  fog: '#e8b58d',
  sun: '#ffd3a0',
  hemisphereSky: '#a9d3df',
  hemisphereGround: '#b77a55',
  sea: '#247f91',
  seaDeep: '#175a70',
  foam: '#e9f2dc',
  asphalt: '#3e4448',
  avenue: '#343b40',
  lane: '#e4c77c',
  crosswalk: '#d9d9cd',
  sidewalk: '#b9ad99',
  promenade: '#cbbda5',
  sand: '#d9b878',
  wetSand: '#b99c6e',
  seawall: '#9b917e',
  palmTrunk: '#796047',
  palmLeaf: '#315f4b',
  palmLeafLight: '#46775b',
  lampPole: '#343b3d',
  lampGlow: '#ffd79a',
  jacket: '#183d4a',
  jacketPanel: '#d76f45',
  shirt: '#e8d8b8',
  trousers: '#26343d',
  skin: '#a96e4f',
  cap: '#bd553f',
  districts: {
    'El Astillero': {
      walls: ['#a85e49', '#bf7851', '#747d7a', '#bd9a66', '#657c7d'],
      accents: ['#e3b65f', '#274c58', '#723e35'],
    },
    'La Marina': {
      walls: ['#e1d7bf', '#b9d4cd', '#d6a783', '#8fb8bb', '#e8c9a4'],
      accents: ['#267580', '#da7654', '#f0c46d'],
    },
    'Mercado Viejo': {
      walls: ['#d4845b', '#dcb476', '#a9b08a', '#d6c1a0', '#b96552'],
      accents: ['#744a3c', '#2c6d68', '#e5b557'],
    },
    'Cerro Alto': {
      walls: ['#e4d4b4', '#d9b99a', '#c99173', '#eee0c4', '#b9b096'],
      accents: ['#914e39', '#765638', '#537568'],
    },
    'Playa Dorada': {
      walls: ['#ead7bd', '#e5ad91', '#aacbca', '#e8c891', '#d4d9cb'],
      accents: ['#dc7258', '#277e8c', '#e0aa4f'],
    },
    'Avenida Cobalto': {
      walls: ['#7c9298', '#a6ada5', '#c2ad92', '#687d89', '#b8c4bd'],
      accents: ['#d58555', '#244d61', '#d6b36b'],
    },
  },
};
