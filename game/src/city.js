// city.js — the procedural shape of Bahía Cobalto: roads, lots, buildings, props, lanes and POIs.
// Pure data, no three.js: the scene builds meshes from it, traffic drives on it, the police picks
// spawn points from it, and the HUD draws its minimap from the same road list.
import {
  SEED, WORLD, AVE_X, STREET_Z, AVENUE_NAMES, STREET_NAMES, DISTRICTS, DISTRICT_AT,
  VEHICLES,
} from './config.js';
import { makeRng, range, int, pick, chance, hash2 } from './rng.js';

const SHOP_NAMES = [
  'BODEGA SOL', 'CAFÉ MAREA', 'TIENDA LUNA', 'PAN DORADO', 'FARMACIA BAHÍA',
  'CANTINA ROJA', 'PESCADERÍA NORTE', 'FLORES DE SAL', 'BARBERÍA COSTA', 'MERCADO 24',
  'HELADOS VELA', 'SODA COBALTO', 'LIBRERÍA FARO', 'TALLER RÁPIDO', 'CASA NUEZ',
  'JUGOS TROPICAL', 'ROPA BRISA', 'MUEBLES RÍO',
];

const BILLBOARDS = [
  { text: 'COBALTO COLA', sub: 'sabor de la bahía', color: '#d94f45' },
  { text: 'MAREA TOURS', sub: 'sunset cruises · muelle 4', color: '#2c8f96' },
  { text: 'CANGREJO MOTORS', sub: 'runs on sea air', color: '#d9a03c' },
  { text: 'PUERTO FM 88.1', sub: 'toda la noche', color: '#3f5f9b' },
  { text: 'SAL & SOL', sub: 'cocina de la costa', color: '#c46a45' },
  { text: 'VELA HOTELS', sub: 'golden hour, every hour', color: '#7a5a8e' },
];

const TINTS = {
  centro: [0xd9cbb4, 0xc9b79f, 0xb7c4c2, 0xd7b68e, 0xa9b7b5, 0xe2d3bd, 0xc2a98e],
  marina: [0xf0d9b5, 0xa8d4cf, 0xe8b7a0, 0xf2e3c6, 0x9fc4bd, 0xe6c9a4],
  mercado: [0xd9a06a, 0xc98b62, 0xe0b483, 0xb9795c, 0xe6c79a, 0xcf9468],
  playa: [0xf2ddb8, 0xa9d7d0, 0xeab7a4, 0xf6e8cd, 0xc7d8c5],
  astillero: [0x9aa6a3, 0x8d9a99, 0xb3b6a8, 0x6f7f82, 0xa59b87],
};

const POIS = {
  busStation: { x: -182, z: 612, name: 'Estación de Ómnibus', kind: 'bus' },
  laMarea: { x: 520, z: 566, name: 'La Marea', kind: 'bar' },
  docks: { x: -650, z: 520, name: 'Muelle Viejo', kind: 'docks' },
  mercadoDrop: { x: -420, z: 120, name: 'Mercado Viejo', kind: 'drop' },
  villa: { x: -420, z: -560, name: 'Villa Rueda', kind: 'villa' },
  mast: { x: 760, z: -460, name: 'Antena de Rueda', kind: 'mast' },
  lighthouse: { x: 1010, z: 594, name: 'Faro de Cobalto', kind: 'lighthouse' },
  warehouse: { x: 760, z: 470, name: 'Almacén del Puerto', kind: 'warehouse' },
  garage: { x: -120, z: 240, name: 'Taller Cobalto', kind: 'garage' },
  hospital: { x: 60, z: 480, name: 'Hospital de la Bahía', kind: 'hospital' },
  range: { x: 600, z: 548, name: 'Polígono La Marea', kind: 'range' },
  shop: { x: 120, z: 560, name: 'Tienda Cobalto', kind: 'shop' },
};

const ROAD_HALF = WORLD.roadW / 2;
const WALK = WORLD.walkW;

function blockBounds(x0, x1, z0, z1) {
  return {
    x0: x0 + ROAD_HALF + WALK,
    x1: x1 - ROAD_HALF - WALK,
    z0: z0 + ROAD_HALF + WALK,
    z1: z1 - ROAD_HALF - WALK,
  };
}

export function buildCity() {
  const rng = makeRng(SEED);
  const roads = [];
  const lanes = [];
  const sidewalkPaths = [];
  const trafficLights = [];
  const buildings = [];
  const collisions = [];
  const palms = [];
  const lights = [];
  const benches = [];
  const bins = [];
  const hydrants = [];
  const stalls = [];
  const umbrellas = [];
  const containers = [];
  const boats = [];
  const cranes = [];
  const rocks = [];
  const villas = [];
  const billboards = [];

  // ---- the road grid -------------------------------------------------------------------------
  for (let i = 0; i < AVE_X.length; i += 1) {
    const x = AVE_X[i];
    roads.push({
      id: `ave-${i}`, axis: 'z', x1: x, z1: -780, x2: x, z2: 640,
      w: x === 0 ? 18 : 14, name: AVENUE_NAMES[i], district: DISTRICT_AT(x, 0).name,
    });
  }
  for (let j = 0; j < STREET_Z.length; j += 1) {
    const z = STREET_Z[j];
    roads.push({
      id: `st-${j}`, axis: 'x', x1: -1080, z1: z, x2: 1080, z2: z,
      w: z === 600 ? 18 : 14, name: STREET_NAMES[j], district: DISTRICT_AT(0, z).name,
    });
  }

  // A switchback into the hills, drawn and driven as a narrow ribbon above the city edge.
  const hillRoad = [];
  for (let i = 0; i <= 9; i += 1) {
    const t = i / 9;
    const x = -120 + Math.sin(t * Math.PI * 2.1) * 150 - t * 60;
    const z = -610 - t * 165;
    hillRoad.push({ x, z, y: t * t * 34 + 1 });
  }

  // ---- city blocks and buildings -------------------------------------------------------------
  const xEdges = [-1080, ...AVE_X, 1080];
  const zEdges = [-780, ...STREET_Z, 640];
  const blocks = [];

  for (let xi = 0; xi < xEdges.length - 1; xi += 1) {
    for (let zi = 0; zi < zEdges.length - 1; zi += 1) {
      const rx0 = xEdges[xi], rx1 = xEdges[xi + 1];
      const rz0 = zEdges[zi], rz1 = zEdges[zi + 1];
      if (rx1 - rx0 < 60 || rz1 - rz0 < 60) continue;
      const b = blockBounds(rx0, rx1, rz0, rz1);
      if (b.x1 - b.x0 < 30 || b.z1 - b.z0 < 30) continue;
      const district = DISTRICT_AT((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
      const isHill = district.id === 'cerro';
      const park = !isHill && chance(rng, 0.07);
      const parking = !isHill && !park && chance(rng, 0.05);
      blocks.push({ ...b, district, park, parking, hill: isHill });
      if (isHill) {
        // hillside villas on terraces, no dense city grid
        for (let v = 0; v < 4; v += 1) {
          const x = range(rng, b.x0 + 20, b.x1 - 20);
          const z = range(rng, b.z0 + 12, b.z1 - 12);
          if (Math.abs(x - POIS.villa.x) < 34 && Math.abs(z - POIS.villa.z) < 34) continue;
          villas.push({ x, z, w: range(rng, 12, 22), d: range(rng, 10, 16), h: range(rng, 5, 9), rot: chance(rng, 0.5) ? 0 : Math.PI / 2, tint: pick(rng, [0xe6d4b5, 0xd9b999, 0xf0e0c4]) });
        }
        continue;
      }
      if (park || parking) {
        if (park) {
          for (let p = 0; p < 14; p += 1) {
            palms.push({
              x: range(rng, b.x0 + 6, b.x1 - 6), z: range(rng, b.z0 + 6, b.z1 - 6),
              h: range(rng, 7, 12), lean: range(rng, -0.14, 0.14), rot: range(rng, 0, Math.PI * 2),
            });
          }
        }
        continue;
      }

      const cols = Math.max(2, Math.min(4, Math.floor((b.x1 - b.x0) / 70)));
      const rows = Math.max(2, Math.min(4, Math.floor((b.z1 - b.z0) / 70)));
      const cw = (b.x1 - b.x0) / cols;
      const cd = (b.z1 - b.z0) / rows;

      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (chance(rng, 0.12)) continue;
          const lotX = b.x0 + c * cw + cw / 2;
          const lotZ = b.z0 + r * cd + cd / 2;
          const nearX = Math.abs(lotX - POIS.busStation.x) < 26 && Math.abs(lotZ - POIS.busStation.z) < 26;
          const nearPOI = Object.values(POIS).some((p) => Math.abs(lotX - p.x) < 22 && Math.abs(lotZ - p.z) < 22);
          if (nearX || nearPOI) continue;

          const w = cw * range(rng, 0.66, 0.9);
          const d = cd * range(rng, 0.64, 0.9);
          let h;
          if (district.id === 'centro') {
            h = chance(rng, 0.08) ? range(rng, 95, 128) : range(rng, 18, 82);
          } else if (district.id === 'marina') {
            h = range(rng, 12, 44);
            if (chance(rng, 0.12)) h = range(rng, 48, 66);
          } else if (district.id === 'playa') {
            h = range(rng, 14, 46);
          } else if (district.id === 'astillero') {
            h = range(rng, 7, 18);
          } else {
            h = range(rng, 7, 21);
          }
          const style = district.id === 'mercado' ? 2
            : district.id === 'astillero' ? 0
              : district.id === 'playa' ? (chance(rng, 0.5) ? 1 : 2)
                : (chance(rng, 0.55) ? 0 : 1);
          const tint = pick(rng, TINTS[district.id] || TINTS.centro);
          const shop = (c === 0 || r === 0 || c === cols - 1 || r === rows - 1) && chance(rng, 0.55);
          const sign = shop ? pick(rng, SHOP_NAMES) : null;
          buildings.push({
            x: lotX, z: lotZ, w, d, h, style, tint, shop, sign,
            district: district.id,
            roof: { ac: chance(rng, 0.7), tank: chance(rng, 0.35), antenna: chance(rng, 0.25) },
            balcony: (district.id === 'marina' || district.id === 'playa') && chance(rng, 0.35),
            floors: Math.max(2, Math.round(h / 3.4)),
          });
          collisions.push({ x0: lotX - w / 2, x1: lotX + w / 2, z0: lotZ - d / 2, z1: lotZ + d / 2, h });
        }
      }
    }
  }

  // ---- street props --------------------------------------------------------------------------
  const addPalm = (x, z, hMin = 7, hMax = 13) => palms.push({
    x, z, h: range(rng, hMin, hMax), lean: range(rng, -0.12, 0.12), rot: range(rng, 0, Math.PI * 2),
  });
  const addLight = (x, z, rot) => lights.push({ x, z, rot });
  const addBench = (x, z, rot) => benches.push({ x, z, rot });
  const addBin = (x, z) => bins.push({ x, z });
  const addHydrant = (x, z) => hydrants.push({ x, z });

  for (const road of roads) {
    const half = road.w / 2;
    const along = road.axis === 'z' ? (road.z2 - road.z1) : (road.x2 - road.x1);
    const start = road.axis === 'z' ? road.z1 : road.x1;
    const step = road.axis === 'z' ? 24 : 28;
    for (let t = 20; t < along - 20; t += step) {
      const x = road.axis === 'z' ? road.x1 : start + t;
      const z = road.axis === 'z' ? start + t : road.z1;
      const sideSign = ((t / step) | 0) % 2 === 0 ? 1 : -1;
      const off = half + WALK * 0.62;
      const px = road.axis === 'z' ? x + sideSign * off : x;
      const pz = road.axis === 'z' ? z : z + sideSign * off;
      if (road.axis === 'z' && Math.abs(px) < 1080) addPalm(px, pz, 7.5, 12.5);
      if (road.axis === 'x' && Math.abs(pz) < 800) addPalm(px, pz, 7, 12);
      if (((t / step) | 0) % 2 === 0) {
        if (road.axis === 'z') addLight(x - sideSign * (half + 1.2), z, 0);
        else addLight(x, z - sideSign * (half + 1.2), Math.PI / 2);
      }
      if (chance(rng, 0.24)) addBench(px + (road.axis === 'z' ? -sideSign * 1.2 : 2), pz + (road.axis === 'z' ? 2 : -sideSign * 1.2), road.axis === 'z' ? Math.PI / 2 : 0);
      if (chance(rng, 0.18)) addBin(px + (road.axis === 'z' ? -sideSign * 2 : -2), pz + (road.axis === 'z' ? -2 : -sideSign * 2));
      if (chance(rng, 0.12)) addHydrant(px + (road.axis === 'z' ? -sideSign * 2.4 : 2.4), pz + (road.axis === 'z' ? 2.4 : -sideSign * 2.4));
    }
    if (road.axis === 'z') {
      sidewalkPaths.push({ axis: 'z', fixed: road.x1 + half + WALK * 0.5, from: road.z1 + 8, to: road.z2 - 8, name: road.name });
      sidewalkPaths.push({ axis: 'z', fixed: road.x1 - half - WALK * 0.5, from: road.z1 + 8, to: road.z2 - 8, name: road.name });
    } else {
      sidewalkPaths.push({ axis: 'x', fixed: road.z1 + half + WALK * 0.5, from: road.x1 + 8, to: road.x2 - 8, name: road.name });
      sidewalkPaths.push({ axis: 'x', fixed: road.z1 - half - WALK * 0.5, from: road.x1 + 8, to: road.x2 - 8, name: road.name });
    }
  }

  // Intersections get signals and crosswalks (crosswalk geometry is drawn from the intersection
  // list in scene.js; signals are props here).
  const intersections = [];
  for (let i = 0; i < AVE_X.length; i += 1) {
    for (let j = 0; j < STREET_Z.length; j += 1) {
      const x = AVE_X[i], z = STREET_Z[j];
      intersections.push({ x, z, i, j });
      trafficLights.push({ x: x + 9.2, z: z + 9.2, rot: 0 });
      trafficLights.push({ x: x - 9.2, z: z - 9.2, rot: Math.PI });
    }
  }

  // ---- traffic lanes -------------------------------------------------------------------------
  let laneId = 0;
  for (let i = 0; i < AVE_X.length; i += 1) {
    const x = AVE_X[i];
    const wide = x === 0;
    const offsets = wide ? [-1.9, -5.4, 1.9, 5.4] : [-1.9, 1.9];
    for (const o of offsets) {
      lanes.push({
        id: laneId++, axis: 'z', fixed: x + o, dir: o < 0 ? 1 : -1,
        from: -772, to: 632, speed: range(rng, 10, 16), name: AVENUE_NAMES[i], offset: o,
      });
    }
  }
  for (let j = 0; j < STREET_Z.length; j += 1) {
    const z = STREET_Z[j];
    const wide = z === 600;
    const offsets = wide ? [-1.9, -5.4, 1.9, 5.4] : [-1.9, 1.9];
    for (const o of offsets) {
      lanes.push({
        id: laneId++, axis: 'x', fixed: z + o, dir: o < 0 ? -1 : 1,
        from: -1072, to: 1072, speed: range(rng, 9, 15), name: STREET_NAMES[j], offset: o,
      });
    }
  }

  // ---- beach, marina, docks ------------------------------------------------------------------
  for (let i = 0; i < 58; i += 1) {
    const x = range(rng, -1000, 1040);
    const z = range(rng, 646, 700);
    umbrellas.push({ x, z, color: pick(rng, [0xe45d4f, 0xf0c24f, 0x4aa7a0, 0xe58bad, 0xf4e4c4]), tilt: range(rng, -0.16, 0.16) });
  }
  // A busy hotel cluster in front of La Marina so the beach is not a void.
  for (let i = 0; i < 14; i += 1) {
    umbrellas.push({
      x: range(rng, 600, 760), z: range(rng, 648, 692),
      color: pick(rng, [0xe45d4f, 0xf0c24f, 0x4aa7a0, 0xe58bad, 0xf4e4c4]), tilt: range(rng, -0.16, 0.16),
    });
  }
  for (let i = 0; i < 12; i += 1) {
    palmssafe(palms, rng, range(rng, -1050, 1050), range(rng, 640, 684));
  }

  // Promenade furniture: the marina walk is the postcard, so it gets its own lamps, benches,
  // planters and kiosks rather than relying on the street loop.
  for (let x = 276; x <= 1004; x += 28) {
    addLight(x, 634, Math.PI);
    if ((x / 28 | 0) % 2 === 0 && (x < 470 || x > 532)) addPalm(x, 630, 8, 12);
    if ((x / 28 | 0) % 3 === 0) addBench(x, 637, Math.PI);
    if ((x / 28 | 0) % 4 === 0) addBin(x + 1.5, 636);
    if ((x / 28 | 0) % 5 === 0) addHydrant(x - 2, 636);
  }
  for (let x = 320; x <= 980; x += 92) {
    stalls.push({
      x, z: 620, rot: Math.PI / 2 + range(rng, -0.1, 0.1),
      color: pick(rng, [0xd9544a, 0xe0a83f, 0x3f8f8a, 0xd97f9f, 0x6f8f4f]),
      awning: pick(rng, [0xf1e3c4, 0xf4d0a0, 0xead6c4]),
    });
  }
  // A pier and a big motor yacht right where the promenade looks out to sea.
  const docks = [];
  docks.push({ x: 490, z: 694, w: 8, d: 38 });
  boats.push({ x: 500, z: 702, rot: Math.PI / 2, len: 36, beam: 8.6, hull: 0xf6efe0, cabin: 0xffffff });
  boats.push({ x: 560, z: 708, rot: Math.PI / 2, len: 30, beam: 7.2, hull: 0xefe6d6, cabin: 0xffffff });
  boats.push({ x: 560, z: 760, rot: Math.PI / 2, len: 46, beam: 10.2, hull: 0xf6efe0, cabin: 0xffffff });
  boats.push({ x: 100, z: 720, rot: Math.PI / 2, len: 32, beam: 7.6, hull: 0xefe6d6, cabin: 0xffffff });
  boats.push({ x: 300, z: 760, rot: Math.PI / 2, len: 22, beam: 5.4, hull: 0xe7e0cf, cabin: 0xd9ecea });

  // Marina: floating docks and moored yachts east of the centre.
  for (let i = 0; i < 7; i += 1) {
    const x = i === 0 ? 560 : i === 1 ? 676 : 600 + i * 62;
    const z = i < 2 ? 704 : 706 + (i % 3) * 12;
    boats.push({
      x, z, rot: Math.PI / 2 + range(rng, -0.12, 0.12),
      len: i < 2 ? 26 : range(rng, 8, 15), beam: i < 2 ? 6.4 : range(rng, 2.8, 4.4),
      hull: pick(rng, [0xf6efe0, 0xe7e0cf, 0xcfd9d6]),
      cabin: pick(rng, [0xffffff, 0xd9ecea]),
    });
  }
  for (let i = 0; i < 6; i += 1) docks.push({ x: 620 + i * 64, z: 694, w: 7, d: 34 });

  // Docks: containers, cranes, a warehouse apron.
  for (let i = 0; i < 34; i += 1) {
    containers.push({
      x: range(rng, -980, -520), z: range(rng, 470, 616), rot: chance(rng, 0.5) ? 0 : Math.PI / 2,
      w: range(rng, 5.5, 8.5), d: range(rng, 2.4, 2.9), h: range(rng, 2.4, 2.9),
      color: pick(rng, [0xc94f43, 0x3f7f8f, 0xd6a63c, 0x4f6f9b, 0x7f8f6f, 0xb56a3f]),
    });
  }
  cranes.push({ x: -860, z: 610, h: 40 }, { x: -700, z: 628, h: 44 });

  // Rocks and a lighthouse point at the east end of the bay.
  for (let i = 0; i < 22; i += 1) {
    rocks.push({ x: range(rng, 940, 1100), z: range(rng, 660, 760), s: range(rng, 1.5, 5.5) });
  }
  const lighthouse = { x: POIS.lighthouse.x, z: POIS.lighthouse.z, h: 34 };

  // Market stalls down Calle Mercado and along the marina promenade.
  for (let i = 0; i < 26; i += 1) {
    const marina = i % 2 === 0;
    stalls.push({
      x: marina ? range(rng, 300, 940) : range(rng, -980, -360),
      z: marina ? range(rng, 620, 640) : range(rng, -500, 300),
      rot: range(rng, 0, Math.PI * 2),
      color: pick(rng, [0xd9544a, 0xe0a83f, 0x3f8f8a, 0xd97f9f, 0x6f8f4f]),
      awning: pick(rng, [0xf1e3c4, 0xf4d0a0, 0xead6c4]),
    });
  }

  // Billboards over the boulevard, each with an invented brand.
  for (let i = 0; i < BILLBOARDS.length; i += 1) {
    billboards.push({
      x: -820 + i * 330, z: i % 2 === 0 ? 574 : 626, rot: i % 2 === 0 ? 0 : Math.PI,
      ...BILLBOARDS[i],
    });
  }

  // ---- POIs and landmarks --------------------------------------------------------------------
  const mast = { x: POIS.mast.x, z: POIS.mast.z, h: 62, health: 100 };

  const city = {
    rng, roads, lanes, sidewalkPaths, intersections, trafficLights,
    blocks, buildings, collisions, palms, lights, benches, bins, hydrants, stalls, umbrellas,
    containers, boats, cranes, rocks, villas, billboards, docks, lighthouse, mast,
    hillRoad, pois: POIS, districts: DISTRICTS,
    beach: { z0: 640, z1: 720 },
    sea: { z: 690 },
    bounds: { minX: -1080, maxX: 1080, minZ: -780, maxZ: 640 },
    groundY: () => 0,
  };

  // Spatial hash of building AABBs for cheap collision and line-of-sight tests.
  const grid = new Map();
  const cell = 48;
  for (const c of collisions) {
    for (let gx = Math.floor(c.x0 / cell); gx <= Math.floor(c.x1 / cell); gx += 1) {
      for (let gz = Math.floor(c.z0 / cell); gz <= Math.floor(c.z1 / cell); gz += 1) {
        const key = `${gx},${gz}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(c);
      }
    }
  }
  city.cellSize = cell;
  city.cellAt = (x, z) => {
    const gx = Math.floor(x / cell), gz = Math.floor(z / cell);
    return grid.get(`${gx},${gz}`) || null;
  };
  city.blocked = (x, z, r = 0.45) => {
    for (let gx = Math.floor((x - r) / cell); gx <= Math.floor((x + r) / cell); gx += 1) {
      for (let gz = Math.floor((z - r) / cell); gz <= Math.floor((z + r) / cell); gz += 1) {
        const list = grid.get(`${gx},${gz}`);
        if (!list) continue;
        for (const c of list) {
          if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) return c;
        }
      }
    }
    return null;
  };
  city.segmentBlocked = (ax, az, bx, bz) => {
    const steps = Math.min(160, Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 6)));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      if (city.blocked(ax + (bx - ax) * t, az + (bz - az) * t, 0.2)) return true;
    }
    return false;
  };
  city.nearestRoad = (x, z) => {
    let best = null, bestD = Infinity;
    for (const road of roads) {
      const d = road.axis === 'z' ? Math.abs(x - road.x1) : Math.abs(z - road.z1);
      if (d < bestD) { bestD = d; best = road; }
    }
    return { road: best, dist: bestD };
  };
  city.nearestLane = (x, z) => {
    let best = null, bestD = Infinity;
    for (const lane of lanes) {
      if (lane.axis === 'z' && z >= lane.from && z <= lane.to) {
        const d = Math.abs(x - lane.fixed);
        if (d < bestD) { bestD = d; best = lane; }
      } else if (lane.axis === 'x' && x >= lane.from && x <= lane.to) {
        const d = Math.abs(z - lane.fixed);
        if (d < bestD) { bestD = d; best = lane; }
      }
    }
    return { lane: best, dist: bestD };
  };
  city.lanePoint = (lane, s) => (lane.axis === 'z'
    ? { x: lane.fixed, z: lane.from + s }
    : { x: lane.from + s, z: lane.fixed });
  city.laneHeading = (lane) => {
    if (lane.axis === 'z') return lane.dir > 0 ? 0 : Math.PI;
    return lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  };

  return city;
}

function palmssafe(list, rng, x, z) {
  list.push({ x, z, h: range(rng, 6.5, 11.5), lean: range(rng, -0.15, 0.15), rot: range(rng, 0, Math.PI * 2) });
}

export { POIS, SHOP_NAMES };
