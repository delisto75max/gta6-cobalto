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
  walkSpeed: 4.15,
  sprintSpeed: 7.5,
  acceleration: 15,
  turnSpeed: 13,
  gravity: 25,
  jumpSpeed: 8.2,
  walkCycleSpeed: 9.5,
};

export const CAMERA = {
  fov: 59,
  near: 0.12,
  distance: 9.6,
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
