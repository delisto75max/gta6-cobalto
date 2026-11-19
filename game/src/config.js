// Tunables, palette, city grid, vehicles and weapons for COBALTO: BAHÍA CALIENTE.
export const CFG = {
  seed: 0xc0ba170,
  time: 17.68,
  world: { minX: -1120, maxX: 1120, minZ: -780, maxZ: 600, seaZ: 690, beachZ: 604, coastZ: 540 },
  avenues: [
    { x: -960, w: 16, name: 'Calle Sereno' },
    { x: -640, w: 16, name: 'Avenida Brisa' },
    { x: -320, w: 16, name: 'Calle Marea' },
    { x: 0, w: 28, name: 'Avenida Cobalto', main: true },
    { x: 320, w: 16, name: 'Calle Mercado' },
    { x: 640, w: 16, name: 'Avenida Astillero' },
    { x: 960, w: 16, name: 'Calle Sal' },
  ],
  streets: [
    { z: -620, w: 16, name: 'Calle Norte' },
    { z: -380, w: 16, name: 'Calle Cumbre' },
    { z: -140, w: 16, name: 'Calle Laurel' },
    { z: 100, w: 16, name: 'Calle Sol' },
    { z: 340, w: 16, name: 'Calle Coral' },
  ],
  coast: { z: 540, w: 28, name: 'Malecón Cobalto' },
  districts: [
    { id: 'cobalto', name: 'Avenida Cobalto', short: 'CENTRO', color: 0xd9b26a },
    { id: 'marina', name: 'La Marina', short: 'MARINA', color: 0x76c7bd },
    { id: 'mercado', name: 'Mercado Viejo', short: 'MERCADO', color: 0xd8885f },
    { id: 'astillero', name: 'El Astillero', short: 'ASTILLERO', color: 0x8ba0a8 },
    { id: 'playa', name: 'Playa Dorada', short: 'PLAYA', color: 0xe9c98a },
    { id: 'cerro', name: 'Cerro Alto', short: 'CERRO', color: 0x9e9a70 },
  ],
  palette: {
    skyTop: 0x15506b, skyMid: 0xe98a5f, skyLow: 0xffd9a0,
    fog: 0xe7b58b, sun: 0xffd2a1, sea: 0x0e6c74, sand: 0xe6cfa5,
    asphalt: 0x2d3038, concrete: 0xb9ae99, line: 0xf2ead4,
  },
};

export const VEHICLES = {
  cangrejo: { name: 'Cangrejo', w: 2.0, d: 4.1, h: 1.25, accel: 11, top: 33, grip: 7.0, brake: 18, mass: 1.0, color: 0x93a06b, kind: 'beater' },
  marea: { name: 'Marea 4x4', w: 2.3, d: 4.7, h: 1.75, accel: 10, top: 36, grip: 6.2, brake: 17, mass: 1.4, color: 0xd8d2bf, kind: 'suv' },
  mula: { name: 'Mula', w: 2.4, d: 5.6, h: 2.2, accel: 8, top: 29, grip: 5.4, brake: 15, mass: 1.8, color: 0xc9c2a9, kind: 'van' },
  viento: { name: 'Viento GT', w: 2.15, d: 4.5, h: 1.1, accel: 17, top: 52, grip: 8.2, brake: 24, mass: 0.85, color: 0xe2673f, kind: 'sport' },
  tiburon: { name: 'Tiburón', w: 2.2, d: 5.0, h: 1.25, accel: 14, top: 46, grip: 6.9, brake: 21, mass: 1.15, color: 0x2b3b55, kind: 'muscle' },
  rayo: { name: 'Rayo 250', w: 0.9, d: 2.3, h: 1.25, accel: 15, top: 44, grip: 7.8, brake: 20, mass: 0.55, color: 0xd9c54e, kind: 'bike' },
};

export const WEAPONS = {
  fists: { slot: 1, name: 'FISTS', dmg: 9, rate: 0.32, range: 2.4, melee: true },
  vesper: { slot: 2, name: 'VESPER', dmg: 34, mag: 12, reserve: 96, rate: 0.2, auto: false, spread: 0.006, range: 130 },
  mako: { slot: 3, name: 'MAKO', dmg: 22, mag: 30, reserve: 180, rate: 0.085, auto: true, spread: 0.018, range: 150 },
  breaker: { slot: 4, name: 'BREAKER', dmg: 11, pellets: 8, mag: 8, reserve: 48, rate: 0.78, spread: 0.055, range: 70 },
};

export const RANKS = ['NOBODY', 'RUNNER', 'WHEELMAN', 'SHOT CALLER', 'FIXER', 'KINGPIN'];

export const STORY = {
  city: 'Bahía Cobalto',
  hero: 'Rafa Cordero',
  sister: 'Lucía',
  villain: 'Don Ismael Rueda',
  captain: 'Capitana Verónica Salas',
  bar: 'La Marea',
  radio: 'COBALTO 104.7',
};
