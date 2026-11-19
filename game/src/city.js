// Pure, deterministic city data. This module has no renderer or browser dependencies: every
// footprint, prop and collision box can be inspected or reused by traffic and missions later.
import { BUILDING, CITY, PALETTE, WORLD } from './config.js';
import { chance, mulberry32, pick, range } from './random.js';

export const DISTRICTS = Object.freeze([
  'El Astillero',
  'La Marina',
  'Mercado Viejo',
  'Cerro Alto',
  'Playa Dorada',
  'Avenida Cobalto',
]);

const LANDMARK_GRIDS = new Map([
  ['1,7', { kind: 'docks', label: 'MUELLE COBALTO', detail: 'Working docks and cargo cranes' }],
  ['3,4', { kind: 'market', label: 'PLAZA DEL MERCADO', detail: 'Mercado Viejo market plaza' }],
  ['2,7', { kind: 'marina', label: 'PASEO DE LA MARINA', detail: 'Marina promenade and piers' }],
  ['7,1', { kind: 'villas', label: 'MIRADOR CERRO ALTO', detail: 'Hillside villas' }],
  ['5,8', { kind: 'hotels', label: 'HOTELES DORADOS', detail: 'Beach hotels' }],
  ['4,0', { kind: 'towers', label: 'TORRES DE COBALTO', detail: 'Downtown towers' }],
]);

function gridKey(x, z) {
  return `${x},${z}`;
}

function districtForGrid(ix, iz) {
  if (ix <= 1) return 'El Astillero';
  if (iz >= 6) return ix <= 3 ? 'La Marina' : 'Playa Dorada';
  if (ix >= 6) return iz <= 3 ? 'Cerro Alto' : 'Avenida Cobalto';
  if (ix === 5 || iz <= 1) return 'Avenida Cobalto';
  return 'Mercado Viejo';
}

export function generateCity(seed) {
  const random = mulberry32(seed);
  const blocks = [];
  const sidewalks = [];
  const roads = [];
  const lots = [];
  const buildings = [];
  const colliders = [];
  const palms = [];
  const lamps = [];
  const landmarkLots = [];
  const piers = [];
  const cranes = [];
  const containers = [];
  const marketStalls = [];
  const half = (CITY.blocks - 1) / 2;

  function addCollider(building) {
    colliders.push({
      id: building.id,
      type: 'building',
      minX: building.x - building.width / 2,
      maxX: building.x + building.width / 2,
      minZ: building.z - building.depth / 2,
      maxZ: building.z + building.depth / 2,
      minY: building.baseY,
      maxY: building.baseY + building.height,
    });
  }

  function addBuilding(lot, offsetX, offsetZ, width, depth, height, style, options = {}) {
    const palette = PALETTE.districts[lot.district];
    const floors = Math.max(1, Math.round(height / BUILDING.floorHeight));
    const building = {
      id: `building-${buildings.length}`,
      lotId: lot.id,
      district: lot.district,
      style,
      x: lot.x + offsetX,
      z: lot.z + offsetZ,
      baseY: CITY.sidewalkHeight,
      width,
      depth,
      height,
      floors,
      color: pick(random, palette.walls),
      accent: pick(random, palette.accents),
      roof: style === 'villa' ? 'hipped' : chance(random, 0.45) ? 'terrace' : 'flat',
      awning: options.awning ?? ((style === 'oldtown' || style === 'marina') && chance(random, 0.58)),
      balconies: options.balconies ?? ((style === 'hotel' || style === 'marina' || style === 'midrise') ? Math.min(12, floors) : 0),
    };
    buildings.push(building);
    lot.buildingIds.push(building.id);
    addCollider(building);
    return building;
  }

  function heightFor(style, multiplier = 1) {
    const [minimum, maximum] = BUILDING.heights[style];
    return range(random, minimum, maximum) * multiplier;
  }

  function populateLot(lot) {
    const district = lot.district;
    const landmark = lot.landmark?.kind;
    if (landmark === 'towers') {
      addBuilding(lot, -10, -8, 58, 66, range(random, 137, 158), 'tower', { balconies: 12 });
      addBuilding(lot, 30, 22, 20, 30, range(random, 27, 39), 'midrise');
      return;
    }
    if (district === 'El Astillero') {
      addBuilding(lot, 0, -22, range(random, 66, 76), 32, heightFor('warehouse'), 'warehouse');
      addBuilding(lot, 0, 22, range(random, 66, 76), 32, heightFor('warehouse'), 'warehouse');
      return;
    }
    if (district === 'Mercado Viejo') {
      const width = landmark === 'market' ? 31 : range(random, 33, 38);
      const depth = landmark === 'market' ? 27 : range(random, 29, 34);
      for (const x of [-25, 25]) {
        for (const z of [-25, 25]) {
          addBuilding(lot, x, z, width, depth, heightFor('oldtown'), 'oldtown', {
            awning: landmark === 'market' || chance(random, 0.7),
          });
        }
      }
      return;
    }
    if (district === 'Cerro Alto') {
      for (const x of [-25, 25]) {
        for (const z of [-25, 25]) {
          addBuilding(lot, x, z, range(random, 27, 32), range(random, 25, 30), heightFor('villa', landmark === 'villas' ? 1.15 : 1), 'villa');
        }
      }
      return;
    }
    if (district === 'La Marina') {
      for (const x of [-30, 0, 30]) {
        addBuilding(lot, x, 0, 23, range(random, 53, 64), heightFor('marina', landmark === 'marina' ? 0.8 : 1), 'marina');
      }
      return;
    }
    if (district === 'Playa Dorada') {
      for (const x of [-24, 24]) {
        addBuilding(lot, x, 0, 39, range(random, 57, 66), heightFor('hotel', landmark === 'hotels' ? 1.25 : 1), 'hotel');
      }
      return;
    }
    if (lot.iz <= 1 || chance(random, 0.38)) {
      addBuilding(lot, 0, 0, range(random, 52, 68), range(random, 57, 70), heightFor('tower'), 'tower');
    } else {
      for (const x of [-23, 23]) {
        addBuilding(lot, x, 0, 38, range(random, 56, 65), heightFor('midrise'), 'midrise');
      }
    }
  }

  for (let iz = 0; iz < CITY.blocks; iz += 1) {
    for (let ix = 0; ix < CITY.blocks; ix += 1) {
      const x = (ix - half) * CITY.pitch;
      const z = (iz - half) * CITY.pitch;
      const district = districtForGrid(ix, iz);
      const block = { id: `block-${ix}-${iz}`, ix, iz, x, z, size: CITY.blockSize, district };
      blocks.push(block);
      sidewalks.push({ id: block.id, x, z, width: CITY.blockSize, depth: CITY.blockSize, height: CITY.sidewalkHeight, district });
      const landmarkSpec = LANDMARK_GRIDS.get(gridKey(ix, iz));
      const lot = {
        id: `lot-${ix}-${iz}`,
        blockId: block.id,
        ix,
        iz,
        x,
        z,
        width: CITY.blockSize - CITY.sidewalkInset * 2,
        depth: CITY.blockSize - CITY.sidewalkInset * 2,
        district,
        kind: landmarkSpec?.kind ?? 'ordinary',
        landmark: landmarkSpec ? { ...landmarkSpec } : null,
        buildingIds: [],
      };
      lots.push(lot);
      populateLot(lot);
      if (landmarkSpec) {
        landmarkLots.push({ ...landmarkSpec, lotId: lot.id, x, z, width: lot.width, depth: lot.depth, district });
      }

      if (district === 'La Marina' || district === 'Playa Dorada' || (district === 'Cerro Alto' && chance(random, 0.5))) {
        palms.push({ x: x - 38, z: z + 48, height: range(random, 7.5, 11), rotation: range(random, 0, Math.PI * 2) });
        if (chance(random, 0.55)) palms.push({ x: x + 38, z: z + 48, height: range(random, 7, 10), rotation: range(random, 0, Math.PI * 2) });
      }
      lamps.push({ x: x - 48, z: z + 49, height: 5.6, rotation: 0 });
      lamps.push({ x: x + 48, z: z - 49, height: 5.6, rotation: Math.PI });
    }
  }

  for (let line = 0; line <= CITY.blocks; line += 1) {
    const coordinate = (line - CITY.blocks / 2) * CITY.pitch;
    const avenue = Math.abs(coordinate - CITY.pitch / 2) < 0.01;
    const width = avenue ? CITY.avenueWidth : CITY.roadWidth;
    roads.push({ id: `road-ns-${line}`, axis: 'z', x: coordinate, z: 0, width, depth: WORLD.size, height: CITY.roadHeight, avenue });
    roads.push({ id: `road-ew-${line}`, axis: 'x', x: 0, z: coordinate, width: WORLD.size, depth: width, height: CITY.roadHeight, avenue });
  }

  const landmarkDocks = landmarkLots.find((landmark) => landmark.kind === 'docks');
  const landmarkMarina = landmarkLots.find((landmark) => landmark.kind === 'marina');
  const landmarkMarket = landmarkLots.find((landmark) => landmark.kind === 'market');
  for (const x of [landmarkDocks.x - 34, landmarkDocks.x + 28]) {
    piers.push({ x, z: 635, width: 16, depth: 112, height: 0.45, kind: 'dock' });
  }
  for (const x of [landmarkMarina.x - 27, landmarkMarina.x + 27]) {
    piers.push({ x, z: 623, width: 9, depth: 88, height: 0.35, kind: 'marina' });
  }
  cranes.push(
    { x: landmarkDocks.x - 47, z: 605, height: 37, rotation: 0 },
    { x: landmarkDocks.x + 48, z: 622, height: 43, rotation: Math.PI },
  );
  for (let index = 0; index < 16; index += 1) {
    containers.push({
      x: landmarkDocks.x - 44 + (index % 8) * 12.5,
      z: landmarkDocks.z + 46 + Math.floor(index / 8) * 5.5,
      width: 11.5,
      depth: 4.6,
      height: 3.1,
      color: pick(random, PALETTE.districts['El Astillero'].walls),
    });
  }
  for (const x of [-10, 0, 10]) {
    for (const z of [-7, 7]) {
      marketStalls.push({
        x: landmarkMarket.x + x,
        z: landmarkMarket.z + z,
        width: 6,
        depth: 4,
        height: 2.4,
        color: pick(random, PALETTE.districts['Mercado Viejo'].accents),
      });
    }
  }

  for (let x = -WORLD.halfSize + 18; x < WORLD.halfSize; x += CITY.beachPalmSpacing) {
    palms.push({ x, z: WORLD.seawallZ - 6.2, height: range(random, 8, 12), rotation: range(random, 0, Math.PI * 2) });
    lamps.push({ x: x + 10, z: WORLD.seawallZ - 2.4, height: 5.2, rotation: Math.PI / 2 });
  }

  const seawall = {
    x: 0,
    z: WORLD.seawallZ,
    width: WORLD.size + 2,
    depth: 1.1,
    height: WORLD.seawallHeight,
  };
  colliders.push({
    id: 'seawall',
    type: 'seawall',
    minX: -WORLD.halfSize - 1,
    maxX: WORLD.halfSize + 1,
    minZ: WORLD.seawallZ - 0.55,
    maxZ: WORLD.seawallZ + 0.55,
    minY: 0,
    maxY: WORLD.seawallHeight,
  });

  const spawnPoints = [
    { name: 'avenida', x: CITY.pitch / 2, z: 165, heading: 0 },
    { name: 'market', x: landmarkMarket.x, z: landmarkMarket.z + 53, heading: Math.PI },
    { name: 'marina', x: landmarkMarina.x, z: WORLD.seawallZ - 10, heading: 0 },
    { name: 'docks', x: landmarkDocks.x, z: landmarkDocks.z + 53, heading: 0 },
    { name: 'beach', x: CITY.pitch / 2, z: WORLD.seawallZ - 10, heading: 0 },
    { name: 'hill', x: 372, z: -290, heading: Math.PI },
  ];

  function districtAt(x, z) {
    const ix = Math.max(0, Math.min(CITY.blocks - 1, Math.round(x / CITY.pitch + half)));
    const iz = Math.max(0, Math.min(CITY.blocks - 1, Math.round(z / CITY.pitch + half)));
    return blocks[iz * CITY.blocks + ix].district;
  }

  function groundHeightAt(x, z) {
    if (z > WORLD.halfSize) return CITY.roadHeight;
    const ix = Math.round(x / CITY.pitch + half);
    const iz = Math.round(z / CITY.pitch + half);
    if (ix < 0 || ix >= CITY.blocks || iz < 0 || iz >= CITY.blocks) return CITY.roadHeight;
    const block = blocks[iz * CITY.blocks + ix];
    if (Math.abs(x - block.x) <= CITY.blockSize / 2 && Math.abs(z - block.z) <= CITY.blockSize / 2) return CITY.sidewalkHeight;
    return CITY.roadHeight;
  }

  const spatialIndex = new Map();
  for (const collider of colliders) {
    const minCellX = Math.floor(collider.minX / CITY.colliderCellSize);
    const maxCellX = Math.floor(collider.maxX / CITY.colliderCellSize);
    const minCellZ = Math.floor(collider.minZ / CITY.colliderCellSize);
    const maxCellZ = Math.floor(collider.maxZ / CITY.colliderCellSize);
    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
        const key = gridKey(cellX, cellZ);
        if (!spatialIndex.has(key)) spatialIndex.set(key, []);
        spatialIndex.get(key).push(collider);
      }
    }
  }

  function queryColliders(x, z, radius = 0) {
    const result = [];
    const seen = new Set();
    const minCellX = Math.floor((x - radius) / CITY.colliderCellSize);
    const maxCellX = Math.floor((x + radius) / CITY.colliderCellSize);
    const minCellZ = Math.floor((z - radius) / CITY.colliderCellSize);
    const maxCellZ = Math.floor((z + radius) / CITY.colliderCellSize);
    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
        const candidates = spatialIndex.get(gridKey(cellX, cellZ));
        if (!candidates) continue;
        for (const collider of candidates) {
          if (seen.has(collider.id)) continue;
          seen.add(collider.id);
          result.push(collider);
        }
      }
    }
    return result;
  }

  return {
    seed,
    blocks,
    sidewalks,
    roads,
    lots,
    buildings,
    colliders,
    palms,
    lamps,
    landmarkLots,
    piers,
    cranes,
    containers,
    marketStalls,
    seawall,
    spawnPoints,
    playerSpawn: spawnPoints[0],
    districtAt,
    groundHeightAt,
    queryColliders,
  };
}
