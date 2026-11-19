// Procedural Bahía Cobalto: roads, blocks, buildings, props, lanes, sidewalk paths and POIs.
// Pure data (no three.js): the renderer, the HUD minimap and the game systems all read this.
import { CFG } from './config.js';
import { RNG, clamp } from './rng.js';

const COLORS = {
  cobalto: [0x8fb6c4, 0x6f95a6, 0xd8c6a2, 0xa8bcc2, 0xc7a37a, 0x7fa9a0, 0xb9c9c4],
  marina: [0xf0c39a, 0xe8a98c, 0xd98f78, 0xf2dcb8, 0x9fc9b6, 0xe7e2cf, 0xe6b9a0],
  mercado: [0xc97b58, 0xd99a63, 0xb8644c, 0xe0bd8f, 0xa95a48, 0xd8b07a],
  astillero: [0x7f8d90, 0x9a8f78, 0x6c7f85, 0x8a7b66, 0xa4a094, 0x8c7460],
  playa: [0xf3e2c3, 0xe9c9a2, 0xa9d3c9, 0xf0b9a0, 0xd8e3dd, 0xf2cda4],
  cerro: [0xe4d7bf, 0xd6b28a, 0xc78f6a, 0xefe3cd, 0xc9b39a],
};
const AWNING = [0xd95c4c, 0xe6a13c, 0x3f9e93, 0xc85a83, 0x4e7fb0, 0xdec35a];
const SIGNS = [
  ['LA MAREA', '#14202b', '#ffd27a'], ['CANGREJO', '#20161a', '#ff8a62'],
  ['SOLARIS', '#101c26', '#8ee6dd'], ['TIENDA MAR', '#241a12', '#ffd27a'],
  ['RADIO 104.7', '#141018', '#ff9ec7'], ['PESCADO', '#0f1c1a', '#a8e6a0'],
  ['HOTEL ALBA', '#1d1610', '#ffdf9e'], ['FARMACIA', '#0f1a22', '#8fd6ff'],
  ['MUEBLES', '#1c140f', '#ffb46e'], ['CERVEZA COSTA', '#121a12', '#d8f08a'],
];

export function buildCity() {
  const rng = new RNG(CFG.seed);
  const city = {
    roads: [], blocks: [], buildings: [], upper: [], roofProps: [], palms: [], lamps: [],
    signals: [], awnings: [], signs: [], billboards: [], benches: [], bins: [], hydrants: [],
    busStops: [], umbrellas: [], boats: [], containers: [], cranes: [], marketStalls: [],
    lanes: [], pedPaths: [], minimapSegments: [], hills: [], poi: {}, water: [], gulls: [],
  };

  // ---- road network -------------------------------------------------------
  for (const a of CFG.avenues) {
    city.roads.push({ axis: 'z', at: a.x, w: a.w, name: a.name, main: !!a.main, from: CFG.world.minZ, to: CFG.world.maxZ });
  }
  for (const s of CFG.streets) {
    city.roads.push({ axis: 'x', at: s.z, w: s.w, name: s.name, from: CFG.world.minX, to: CFG.world.maxX });
  }
  city.roads.push({ axis: 'x', at: CFG.coast.z, w: CFG.coast.w, name: CFG.coast.name, main: true, coastal: true, from: CFG.world.minX, to: CFG.world.maxX });

  const xs = CFG.avenues.map((a) => a.x).sort((a, b) => a - b);
  const zs = CFG.streets.map((s) => s.z).sort((a, b) => a - b);
  const xe = [CFG.world.minX, ...xs, CFG.world.maxX];
  const ze = [CFG.world.minZ, ...zs, CFG.coast.z, CFG.world.maxZ];

  const districtAt = (x, z) => {
    if (z > CFG.world.beachZ) return 'playa';
    if (z > 420 && x >= 620) return 'astillero';
    if (z > 360 && x < 220) return 'marina';
    if (x > 150 && z > -180 && z < 420) return 'mercado';
    if (z < -390) return 'cerro';
    return 'cobalto';
  };
  const districtInfo = (id) => CFG.districts.find((d) => d.id === id) || CFG.districts[0];
  const streetAt = (x, z) => {
    let best = city.roads[0], bd = 1e9;
    for (const r of city.roads) {
      const d = Math.abs((r.axis === 'z' ? x : z) - r.at);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  };

  // ---- blocks & buildings -------------------------------------------------
  for (let i = 0; i < xe.length - 1; i++) {
    for (let j = 0; j < ze.length - 1; j++) {
      const x0 = xe[i] + (i === 0 ? 8 : roadHalf(CFG, 'z', xe[i]) + 5);
      const x1 = xe[i + 1] - (i + 1 === xe.length - 1 ? 8 : roadHalf(CFG, 'z', xe[i + 1]) + 5);
      const z0 = ze[j] + (j === 0 ? 8 : roadHalf(CFG, 'x', ze[j]) + 5);
      const z1 = ze[j + 1] - (j + 1 === ze.length - 1 ? 8 : roadHalf(CFG, 'x', ze[j + 1]) + 5);
      if (x1 - x0 < 42 || z1 - z0 < 42) continue;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const district = districtAt(cx, cz);
      if (cz > CFG.world.beachZ - 10) continue;
      const block = { x0, x1, z0, z1, district };
      city.blocks.push(block);
      if (district === 'playa' && cz > 585) continue;
      const nx = district === 'astillero' ? 1 : district === 'cobalto' ? 3 : 2;
      const nz = district === 'astillero' ? 1 : district === 'cerro' ? 1 : 2;
      const gap = district === 'mercado' ? 7 : 10;
      const lw = (x1 - x0 - gap * (nx - 1)) / nx;
      const ld = (z1 - z0 - gap * (nz - 1)) / nz;
      for (let a = 0; a < nx; a++) {
        for (let b = 0; b < nz; b++) {
          const lx0 = x0 + a * (lw + gap), lz0 = z0 + b * (ld + gap);
          const inset = rng.range(2, 6);
          const w = lw - inset * 2, d = ld - inset * 2;
          const bx = lx0 + lw / 2, bz = lz0 + ld / 2;
          if (w < 12 || d < 12) continue;
          const style = district === 'cobalto' ? 'tower' : district === 'mercado' ? 'old'
            : district === 'astillero' ? 'ware' : district === 'cerro' ? 'villa'
              : district === 'playa' ? 'hotel' : 'mid';
          const palette = COLORS[district] || COLORS.cobalto;
          const color = palette[rng.int(0, palette.length - 1)];
          let h = styleHeight(style, rng, bz);
          const base = { x: bx, z: bz, w, d, h, color, seed: rng.int(0, 65535), style, district };
          city.buildings.push(base);
          if (style === 'tower' && h > 52 && rng.chance(0.68)) {
            const up = { ...base, w: w * rng.range(0.6, 0.78), d: d * rng.range(0.6, 0.78), h: h * 0.34 + 10, upper: true };
            city.upper.push(up);
            base.h = h * 0.66;
          }
          addRoofProps(city, base, rng);
          // storefronts only on the sunny, walkable frontages
          const near = nearestRoad(city, bx, bz);
          if (near.dist < 72 && style !== 'ware' && style !== 'villa' && h > 5) {
            addFrontage(city, base, near, rng);
          }
        }
      }
    }
  }

  // ---- street life: palms, lamps, signals, furniture ----------------------
  const addPalm = (x, z, s = 1) => city.palms.push({ x, z, s: s * rng.range(1.5, 2.15), r: rng.range(0, 6.28) });
  for (const r of city.roads) {
    const step = r.main ? 34 : 46;
    for (let t = r.from + 24; t < r.to - 20; t += step) {
      for (const side of [-1, 1]) {
        const off = r.w / 2 + 3.4;
        const x = r.axis === 'z' ? r.at + off * side : t;
        const z = r.axis === 'z' ? t : r.at + off * side;
        if (districtAt(x, z) === 'playa' && z > 560) continue;
        const roll = rng.next();
        if (roll < (r.main ? 0.75 : 0.38)) addPalm(x, z);
        if (roll > 0.62) city.lamps.push({ x: r.axis === 'z' ? r.at + (r.w / 2 + 2.1) * side : t, z: r.axis === 'z' ? t : r.at + (r.w / 2 + 2.1) * side, rot: r.axis === 'z' ? (side > 0 ? -1.57 : 1.57) : (side > 0 ? 3.14 : 0) });
      }
    }
  }
  // promenade and beach palms
  for (let x = -1080; x < 1050; x += 26) {
    if (x > 620 && x < 760) continue;
    addPalm(x + rng.range(-4, 4), 574 + rng.range(-2, 2), 1.15);
    if (rng.chance(0.45)) addPalm(x + rng.range(-8, 8), 622 + rng.range(-6, 10), rng.range(0.8, 1.2));
  }
  // traffic signals at intersections
  for (const ax of xs) {
    for (const sz of zs) {
      const aw = CFG.avenues.find((a) => a.x === ax).w, sw = CFG.streets.find((s) => s.z === sz).w;
      city.signals.push({ x: ax + aw / 2 + 2.6, z: sz - sw / 2 - 2.6, rot: 0 });
      city.signals.push({ x: ax - aw / 2 - 2.6, z: sz + sw / 2 + 2.6, rot: 3.14 });
      city.signals.push({ x: ax + aw / 2 + 2.6, z: sz + sw / 2 + 2.6, rot: 1.57 });
    }
  }
  // benches, bins, hydrants along the promenade + downtown sidewalks
  for (let x = -1060; x < 1040; x += 48) {
    if (rng.chance(0.6)) city.benches.push({ x: x + rng.range(-8, 8), z: 583, rot: rng.chance(0.5) ? 0 : 3.14 });
    if (rng.chance(0.5)) city.bins.push({ x: x + rng.range(-16, 16), z: 579 });
    if (rng.chance(0.35)) city.hydrants.push({ x: x + rng.range(-20, 20), z: 556 });
  }
  for (let z = -720; z < 500; z += 74) {
    city.benches.push({ x: 21, z, rot: -1.57 });
    city.bins.push({ x: -21, z: z + 20 });
  }
  city.busStops.push({ x: -311, z: 152, rot: 1.57 }, { x: 335, z: 102, rot: -1.57 }, { x: -646, z: 236, rot: 1.57 });
  // beach umbrellas + towels
  for (let i = 0; i < 64; i++) {
    const x = i < 46 ? rng.range(-1010, 430) : rng.range(-650, -260);
    const z = i < 46 ? rng.range(612, 652) : rng.range(612, 654);
    city.umbrellas.push({ x, z, color: [0xe45b4f, 0xe6a23c, 0x3f9e93, 0xd95c86, 0xf0e0b0][rng.int(0, 4)] });
  }
  // market stalls in Mercado Viejo
  for (let i = 0; i < 18; i++) {
    city.marketStalls.push({ x: rng.range(180, 610), z: rng.range(-120, 320), rot: rng.range(0, 3.14), color: AWNING[rng.int(0, 5)] });
  }
  // harbour: containers, cranes, boats
  for (let i = 0; i < 44; i++) {
    const x = 700 + (i % 7) * 22, z = 380 + Math.floor(i / 7) * 18;
    city.containers.push({ x, z, h: rng.range(5, 9), color: [0xb5523f, 0x3f6d8a, 0x4f7f54, 0xc59a45, 0x8a8f96][rng.int(0, 4)] });
  }
  city.cranes.push({ x: 690, z: 470, rot: 0.2 }, { x: 840, z: 510, rot: -0.35 }, { x: 1020, z: 430, rot: 0.5 });
  for (let i = 0; i < 9; i++) {
    city.boats.push({ x: rng.range(-620, -120), z: rng.range(704, 760), s: rng.range(0.8, 1.5), rot: rng.range(0, 6.28), yacht: i < 4 });
  }
  city.boats.push({ x: 260, z: 724, s: 1.2, rot: 0.6 }, { x: 410, z: 748, s: 0.9, rot: 2.4 });
  city.boats.push({ x: -560, z: 672, s: 1.25, rot: 0.4, yacht: true }, { x: -452, z: 678, s: 0.95, rot: 1.9, yacht: true }, { x: -382, z: 668, s: 1.1, rot: 2.8 });
  city.boats.push({ x: -300, z: 682, s: 1.3, rot: 1.1, yacht: true }, { x: -210, z: 676, s: 0.9, rot: 2.2 }, { x: -380, z: 688, s: 1.15, rot: 0.7, yacht: true });
  // gulls over the bay
  for (let i = 0; i < 14; i++) city.gulls.push({ x: rng.range(-700, 500), z: rng.range(610, 780), y: rng.range(18, 48), r: rng.range(12, 34), ph: rng.range(0, 6.28) });
  // hills north of the city
  for (let i = 0; i < 9; i++) {
    city.hills.push({ x: -1200 + i * 280 + rng.range(-60, 60), z: -1280 - rng.range(0, 160), w: rng.range(620, 980), h: rng.range(80, 160), color: [0x6f7c62, 0x7d8568, 0x666f58][rng.int(0, 2)] });
  }
  city.hills.push({ x: -760, z: -1120, w: 880, h: 62, color: 0x7b856c }, { x: 540, z: -1160, w: 940, h: 78, color: 0x707a64 });

  // ---- POIs ---------------------------------------------------------------
  city.poi = {
    busStation: { x: -312, z: 158, name: 'Terminal Norte', icon: 'bus' },
    laMarea: { x: -486, z: 570, name: 'La Marea', icon: 'bar' },
    docks: { x: 862, z: 486, name: 'Almacén 4', icon: 'dock' },
    mercado: { x: 420, z: 58, name: 'Mercado Viejo', icon: 'shop' },
    villa: { x: -228, z: -512, name: 'Villa Rueda', icon: 'house' },
    mast: { x: 690, z: -486, name: 'Radio Mast', icon: 'mast' },
    lighthouse: { x: -486, z: 660, name: 'Faro Cobalto', icon: 'light' },
    warehouse: { x: -146, z: 516, name: 'Bodega La Marina', icon: 'dock' },
    hospital: { x: -34, z: -22, name: 'Hospital Cobalto', icon: 'cross' },
    garage: { x: 126, z: 246, name: 'Taller Marea', icon: 'wrench' },
    range: { x: -530, z: 596, name: 'Polígono', icon: 'target' },
    tienda: { x: -58, z: 186, name: 'Tienda', icon: 'shop' },
  };

  // ---- traffic lanes ------------------------------------------------------
  for (const r of city.roads) {
    const offs = r.main ? [3.4, 10.2, -3.4, -10.2] : [4.0, -4.0];
    for (const off of offs) {
      const dir = off > 0 ? 1 : -1;
      const speed = r.main ? rng.range(10, 15) : rng.range(8, 12);
      if (r.axis === 'z') city.lanes.push({ axis: 'z', at: r.at + off, dir, from: r.from, to: r.to, speed, main: !!r.main, road: r.name });
      else city.lanes.push({ axis: 'x', at: r.at + off, dir, from: r.from, to: r.to, speed, main: !!r.main, road: r.name });
    }
  }

  // ---- sidewalk paths for pedestrians ------------------------------------
  for (const r of city.roads) {
    for (const side of [-1, 1]) {
      const off = r.w / 2 + 2.8;
      if (r.axis === 'z') city.pedPaths.push({ axis: 'z', at: r.at + off * side, from: r.from + 20, to: r.to - 20, district: districtAt(r.at + off * side, 0) });
      else city.pedPaths.push({ axis: 'x', at: r.at + off * side, from: r.from + 20, to: r.to - 20, district: districtAt(0, r.at + off * side) });
    }
  }
  city.pedPaths.push({ axis: 'x', at: 574, from: -1080, to: 1040, district: 'marina', promenade: true });
  city.pedPaths.push({ axis: 'x', at: 624, from: -1040, to: 460, district: 'playa', sand: true });

  // ---- billboards & lighthouse -------------------------------------------
  city.billboards = [
    { x: -22, z: -220, y: 11, w: 12, h: 6, rot: 1.57, title: 'MAREA 4x4', sub: 'AGUANTA TODO' },
    { x: 22, z: 240, y: 13, w: 12, h: 6, rot: -1.57, title: 'COBALTO 104.7', sub: 'NOCHE AZUL' },
    { x: 320, z: 462, y: 12, w: 14, h: 7, rot: 0.1, title: 'SOLARIS', sub: 'ENERGÍA DEL SUR' },
    { x: -640, z: 534, y: 10, w: 11, h: 5.5, rot: 0.2, title: 'BEBE AGUA', sub: 'AGUA DE COBALTO' },
    { x: 860, z: 380, y: 12, w: 13, h: 6.5, rot: -0.4, title: 'ASTILLERO', sub: 'CARGA Y DESCARGA' },
    { x: -980, z: 120, y: 10, w: 11, h: 5.5, rot: 1.57, title: 'PLAYA DORADA', sub: 'SOL TODO EL AÑO' },
  ];
  city.lighthouse = { x: -486, z: 660, h: 24 };

  // ---- minimap segments ---------------------------------------------------
  for (const ax of xs) {
    const stops = [-780, ...zs, 540, 600];
    for (let k = 0; k < stops.length - 1; k++) if (stops[k + 1] - stops[k] > 1) city.minimapSegments.push({ x1: ax, z1: stops[k], x2: ax, z2: stops[k + 1], w: CFG.avenues.find((a) => a.x === ax).w, main: ax === 0 });
  }
  for (const sz of [...zs, 540]) {
    const stops = [-1120, ...xs, 1120];
    for (let k = 0; k < stops.length - 1; k++) if (stops[k + 1] - stops[k] > 1) city.minimapSegments.push({ x1: stops[k], z1: sz, x2: stops[k + 1], z2: sz, w: sz === 540 ? 28 : 16, main: sz === 540 });
  }

  // ---- collision hash -----------------------------------------------------
  const HASH = 64;
  const hash = new Map();
  const key = (ix, iz) => ix + ':' + iz;
  const solid = city.buildings.filter((b) => !b.upper);
  for (const b of solid) {
    const x0 = Math.floor((b.x - b.w / 2) / HASH), x1 = Math.floor((b.x + b.w / 2) / HASH);
    const z0 = Math.floor((b.z - b.d / 2) / HASH), z1 = Math.floor((b.z + b.d / 2) / HASH);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const k = key(ix, iz); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(b);
    }
  }
  city.hash = hash; city.hashKey = key; city.hashSize = HASH;

  city.collide = (pos, r, out) => {
    const H = city.hashSize;
    const x = pos.x, z = pos.z;
    let hit = false;
    for (let ix = Math.floor((x - r) / H); ix <= Math.floor((x + r) / H); ix++) {
      for (let iz = Math.floor((z - r) / H); iz <= Math.floor((z + r) / H); iz++) {
        const arr = hash.get(key(ix, iz)); if (!arr) continue;
        for (const b of arr) {
          const px = b.w / 2 + r - Math.abs(x - b.x);
          const pz = b.d / 2 + r - Math.abs(z - b.z);
          if (px > 0 && pz > 0) {
            hit = true;
            if (px < pz) { const s = Math.sign(x - b.x) || 1; pos.x += s * px; if (out) { out.x = s * px; out.z = 0; } }
            else { const s = Math.sign(z - b.z) || 1; pos.z += s * pz; if (out) { out.x = 0; out.z = s * pz; } }
          }
        }
      }
    }
    return hit;
  };
  city.buildingAt = (x, z) => {
    const arr = hash.get(key(Math.floor(x / HASH), Math.floor(z / HASH)));
    if (!arr) return null;
    for (const b of arr) if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return b;
    return null;
  };
  city.isWater = (x, z) => z > 664 || (z > 640 && Math.abs(x + 486) < 16);
  city.isBeach = (x, z) => z > 598 && z <= 664;
  city.districtAt = districtAt;
  city.districtInfo = districtInfo;
  city.streetAt = streetAt;
  return city;
}

function roadHalf(cfg, axis, at) {
  if (axis === 'z') { const a = cfg.avenues.find((v) => v.x === at); return a ? a.w / 2 : 8; }
  if (at === cfg.coast.z) return cfg.coast.w / 2;
  const s = cfg.streets.find((v) => v.z === at); return s ? s.w / 2 : 8;
}

function nearestRoad(city, x, z) {
  let best = { dist: 1e9, road: city.roads[0], dir: 1, side: 1 };
  for (const r of city.roads) {
    const d = r.axis === 'z' ? Math.abs(x - r.at) : Math.abs(z - r.at);
    if (d < best.dist) best = { dist: d, road: r, dir: r.axis === 'z' ? Math.sign(x - r.at) : Math.sign(z - r.at) || 1 };
  }
  return best;
}

function styleHeight(style, rng, z) {
  if (style === 'tower') return rng.chance(0.18) ? rng.range(22, 40) : rng.range(42, 106);
  if (style === 'hotel') return rng.range(14, 38);
  if (style === 'mid') return rng.range(10, 30);
  if (style === 'old') return rng.range(7, 17);
  if (style === 'ware') return rng.range(6, 14);
  return rng.range(5, 10);
}

function addRoofProps(city, b, rng) {
  const top = b.h;
  const n = rng.chance(0.75) ? rng.int(1, 3) : 0;
  for (let i = 0; i < n; i++) {
    const kind = rng.chance(0.55) ? 'ac' : rng.chance(0.5) ? 'tank' : 'antenna';
    const px = b.x + rng.range(-b.w * 0.32, b.w * 0.32);
    const pz = b.z + rng.range(-b.d * 0.32, b.d * 0.32);
    if (kind === 'ac') city.roofProps.push({ kind, x: px, y: top, z: pz, w: rng.range(1.2, 2.6), h: rng.range(0.7, 1.5), color: 0x8d9296 });
    else if (kind === 'tank') city.roofProps.push({ kind, x: px, y: top, z: pz, w: rng.range(1.3, 2.2), h: rng.range(2, 3.6), color: 0x9aa0a2 });
    else city.roofProps.push({ kind, x: px, y: top, z: pz, w: 0.16, h: rng.range(3, 8), color: 0xd7d2c6 });
  }
}

function addFrontage(city, b, near, rng) {
  const alongX = near.road.axis === 'z';
  const dir = near.road.axis === 'z' ? Math.sign(b.x - near.road.at) || 1 : Math.sign(b.z - near.road.at) || 1;
  const fx = alongX ? b.x + dir * (b.w / 2 + 0.2) : b.x;
  const fz = alongX ? b.z : b.z + dir * (b.d / 2 + 0.2);
  const rot = alongX ? (dir > 0 ? 1.57 : -1.57) : (dir > 0 ? 0 : 3.14);
  const width = Math.min(11, (alongX ? b.d : b.w) * 0.62);
  if (width > 3.2 && rng.chance(0.8)) {
    city.awnings.push({ x: fx + (alongX ? dir * 0.8 : 0), y: 3.1, z: fz + (alongX ? 0 : dir * 0.8), w: width, d: 1.8, rot, color: AWNING[rng.int(0, AWNING.length - 1)] });
  }
  if (width > 4.5 && rng.chance(0.42)) {
    const sign = SIGNS[rng.int(0, SIGNS.length - 1)];
    city.signs.push({ x: fx + (alongX ? dir * 0.22 : 0), y: rng.range(4.6, 6.8), z: fz + (alongX ? 0 : dir * 0.22), w: Math.min(7.2, width * 0.86), h: 1.35, rot, text: sign[0], bg: sign[1], fg: sign[2] });
  }
}
