// config.js — the game's single source of tuned numbers, names and tables.
// Everything the city, the cars, the weapons and the HUD agree on lives here.

export const SEED = 20261119;

export const WORLD = {
  minX: -1120, maxX: 1120,
  minZ: -820, maxZ: 820,
  coastZ: 640,
  seaEdge: 690,
  roadW: 14,
  walkW: 4.5,
  laneW: 3.4,
  blockMargin: 7,
};

export const AVE_X = [-900, -600, -300, 0, 300, 600, 900];
export const STREET_Z = [-600, -300, 0, 300, 600];

export const AVENUE_NAMES = [
  'Calle Brisa', 'Paseo del Puerto', 'Calle Ámbar', 'Avenida Cobalto',
  'Calle Sirena', 'Avenida Marea', 'Avenida Faro',
];
export const STREET_NAMES = ['Camino Alto', 'Calle Cobre', 'Calle Mercado', 'Calle Sal', 'Bulevar Coral'];

// Palette: golden hour on a painted coast. Values are three.js hex colours.
export const PALETTE = {
  skyTop: 0x1c5d78,
  skyMid: 0x79bcc6,
  skyHorizon: 0xffd2a0,
  sun: 0xffc77d,
  sunDisc: 0xfff0c8,
  fog: 0xf0c69a,
  seaDeep: 0x0a4f63,
  seaShallow: 0x2495a0,
  foam: 0xf7f1dc,
  sand: 0xe2c79a,
  sandWet: 0xc9a97c,
  asphalt: 0x2c3139,
  asphaltWarm: 0x383a3d,
  sidewalk: 0xb9a891,
  curb: 0xd8cbb7,
  lineWhite: 0xf4ead4,
  lineYellow: 0xf2c14e,
  grass: 0x5f7d4f,
  hill: 0x6d7a54,
  hillFar: 0x7b8062,
  windowWarm: 0xffd38a,
  windowCool: 0x9fd6d2,
  cream: 0xf6ead8,
  gold: 0xffcf6b,
  red: 0xff5a5a,
  blue: 0x66b8ff,
  teal: 0x7fe3d4,
};

// Districts are rectangles with a name, a signature street and a tint for the minimap.
export const DISTRICTS = [
  { id: 'cerro', name: 'Cerro Alto', street: 'Camino Alto', x0: -1120, x1: 1120, z0: -820, z1: -520, tint: '#6d7a54' },
  { id: 'centro', name: 'Avenida Cobalto', street: 'Avenida Cobalto', x0: -330, x1: 330, z0: -520, z1: 330, tint: '#b58b62' },
  { id: 'mercado', name: 'Mercado Viejo', street: 'Calle Mercado', x0: -1120, x1: -330, z0: -520, z1: 330, tint: '#c08462' },
  { id: 'astillero', name: 'El Astillero', street: 'Paseo del Puerto', x0: -1120, x1: -250, z0: 330, z1: 640, tint: '#7d8b8d' },
  { id: 'marina', name: 'La Marina', street: 'Malecón Cobalto', x0: 250, x1: 1120, z0: 330, z1: 640, tint: '#5f9ea2' },
  { id: 'playa', name: 'Playa Dorada', street: 'Bulevar Coral', x0: -1120, x1: 1120, z0: 640, z1: 820, tint: '#d8b878' },
];

export const PLAYER_START = { x: -182, z: 606, heading: Math.PI * 0.5 };

export const VEHICLES = {
  cangrejo: {
    id: 'cangrejo', label: 'Cangrejo', klass: 'Beater', shape: 'sedan',
    width: 1.86, length: 4.15, height: 1.38,
    accel: 8.2, brake: 18, drag: 0.34, top: 31, grip: 7.0, steer: 1.02, mass: 1.0, health: 95,
    colors: [0x9b6a4c, 0x87908a, 0x8e4f45, 0xb0a07d, 0x5f727c],
  },
  marea: {
    id: 'marea', label: 'Marea 4x4', klass: 'SUV', shape: 'suv',
    width: 2.05, length: 4.75, height: 1.78,
    accel: 8.6, brake: 17, drag: 0.32, top: 36, grip: 7.6, steer: 0.94, mass: 1.25, health: 130,
    colors: [0xd9cbb0, 0x5f7d72, 0x394955, 0xc06a4e, 0x8e9a76],
  },
  mula: {
    id: 'mula', label: 'Mula', klass: 'Van', shape: 'van',
    width: 2.12, length: 5.35, height: 2.15,
    accel: 6.7, brake: 15, drag: 0.3, top: 28, grip: 5.9, steer: 0.82, mass: 1.5, health: 150,
    colors: [0xe4dcc8, 0xb7c0ba, 0x7f6a58, 0x54666e],
  },
  viento: {
    id: 'viento', label: 'Viento GT', klass: 'Sports', shape: 'sports',
    width: 1.92, length: 4.4, height: 1.14,
    accel: 13.6, brake: 20, drag: 0.2, top: 52, grip: 8.4, steer: 1.16, mass: 1.05, health: 105,
    colors: [0xd8463f, 0x2f9b9b, 0xe6c45c, 0x3f5f9b, 0xece0cd],
  },
  tiburon: {
    id: 'tiburon', label: 'Tiburón', klass: 'Muscle', shape: 'muscle',
    width: 2.0, length: 4.65, height: 1.28,
    accel: 12.2, brake: 17, drag: 0.24, top: 47, grip: 6.7, steer: 1.05, mass: 1.2, health: 120,
    colors: [0x314b6b, 0x8d2f2f, 0xd6c7a1, 0x2f2f33, 0x8a6b3c],
  },
  rayo: {
    id: 'rayo', label: 'Rayo 250', klass: 'Motorcycle', shape: 'bike',
    width: 0.82, length: 2.2, height: 1.18,
    accel: 12.8, brake: 16, drag: 0.18, top: 46, grip: 5.4, steer: 1.34, mass: 0.55, health: 60,
    colors: [0xd85a3e, 0x2c6d7a, 0xe3d3b0, 0x33333a],
  },
};

export const WEAPONS = [
  { id: 'fists', slot: 1, name: 'FISTS', mag: 0, reserve: 0, damage: 9, rate: 0.34, range: 2.6, spread: 0, pellets: 1, auto: false, reload: 0, sound: 'punch' },
  { id: 'vesper', slot: 2, name: 'VESPER', mag: 12, reserve: 96, damage: 34, rate: 0.23, range: 145, spread: 0.006, pellets: 1, auto: false, reload: 1.05, sound: 'pistol' },
  { id: 'mako', slot: 3, name: 'MAKO', mag: 30, reserve: 180, damage: 22, rate: 0.085, range: 125, spread: 0.018, pellets: 1, auto: true, reload: 1.55, sound: 'smg' },
  { id: 'breaker', slot: 4, name: 'BREAKER', mag: 8, reserve: 32, damage: 12, rate: 0.82, range: 48, spread: 0.058, pellets: 8, auto: false, reload: 1.85, sound: 'shotgun' },
];

export const RANKS = [
  { at: 0, name: 'Nobody' },
  { at: 80, name: 'Runner' },
  { at: 220, name: 'Wheelman' },
  { at: 420, name: 'Shot Caller' },
  { at: 700, name: 'Fixer' },
  { at: 1100, name: 'Kingpin' },
];

export const RADIO = [
  { freq: 'COBALTO 104.7', track: 'Noche Azul', mood: 'slow' },
  { freq: 'MAREA 92.3', track: 'Sal y Miel', mood: 'bright' },
  { freq: 'PUERTO 88.1', track: 'Marea Negra', mood: 'dark' },
];

export const SUN_DIR = (() => {
  const x = -0.72, y = 0.265, z = 0.42;
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
})();

export const CAMERA = { fov: 60, minDist: 3.4, maxDist: 10.5, height: 1.62 };

export const DISTRICT_AT = (x, z) => {
  if (z < -520) return DISTRICTS[0];
  if (z > 640) return DISTRICTS[5];
  if (x > 330 && z > 330) return DISTRICTS[4];
  if (x < -330 && z > 330) return DISTRICTS[3];
  if (x < -330) return DISTRICTS[2];
  return DISTRICTS[1];
};

export const nearestStreetName = (x, z) => {
  let best = Infinity, name = 'Avenida Cobalto';
  for (let i = 0; i < AVE_X.length; i += 1) {
    const d = Math.abs(x - AVE_X[i]);
    if (d < best) { best = d; name = AVENUE_NAMES[i]; }
  }
  for (let j = 0; j < STREET_Z.length; j += 1) {
    const d = Math.abs(z - STREET_Z[j]);
    if (d < best) { best = d; name = STREET_NAMES[j]; }
  }
  return name;
};

export const locationAt = (x, z) => {
  const district = DISTRICT_AT(x, z);
  const street = nearestStreetName(x, z);
  return street === district.name ? district.name : `${district.name} · ${street}`;
};
