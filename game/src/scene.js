// three.js presentation only. Static city geometry is merged or instanced up front; the only
// geometry changed during play is the sea's small procedural wave grid.
import * as THREE from 'three';
import { BUILDING, CAMERA, CITY, PALETTE, RENDER, WINDOWS, WORLD } from './config.js';
import { chance, mulberry32 } from './random.js';

const UP = new THREE.Vector3(0, 1, 0);

function addBox(list, x, y, z, width, height, depth, rotation = 0, color = null) {
  list.push({ x, y, z, width, height, depth, rotation, color });
}

function makeInstances(scene, geometry, material, boxes, castShadow = true, receiveShadow = true) {
  const mesh = new THREE.InstancedMesh(geometry, material, boxes.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const color = new THREE.Color();
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    position.set(box.x, box.y, box.z);
    scale.set(box.width ?? 1, box.height ?? 1, box.depth ?? 1);
    rotation.setFromAxisAngle(UP, box.rotation ?? 0);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
    if (box.color !== null && box.color !== undefined) mesh.setColorAt(index, color.set(box.color));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  scene.add(mesh);
  return mesh;
}

function setTextureFiltering(texture, renderer, srgb = true) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
}

function makeFacadeTextures(renderer) {
  const size = WINDOWS.textureSize;
  const facadeCanvas = document.createElement('canvas');
  const glowCanvas = document.createElement('canvas');
  facadeCanvas.width = facadeCanvas.height = size;
  glowCanvas.width = glowCanvas.height = size;
  const facade = facadeCanvas.getContext('2d');
  const glow = glowCanvas.getContext('2d');
  const random = mulberry32(913);
  facade.fillStyle = '#ddd8cb';
  facade.fillRect(0, 0, size, size);
  glow.fillStyle = '#000000';
  glow.fillRect(0, 0, size, size);
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const x = column * 64;
      const y = row * 64;
      facade.fillStyle = '#c6c2b8';
      facade.fillRect(x, y + 61, 64, 3);
      facade.fillStyle = '#eee9dc';
      facade.fillRect(x + 10, y + 9, 44, 4);
      const lit = chance(random, 0.28);
      const windowGradient = facade.createLinearGradient(x + 13, y + 14, x + 51, y + 47);
      windowGradient.addColorStop(0, lit ? '#a98258' : '#46616c');
      windowGradient.addColorStop(0.52, lit ? '#d1aa73' : '#233d49');
      windowGradient.addColorStop(0.55, lit ? '#bb945f' : '#54717a');
      windowGradient.addColorStop(1, '#1b303a');
      facade.fillStyle = windowGradient;
      facade.fillRect(x + 13, y + 14, 38, 34);
      facade.fillStyle = '#aaa99f';
      facade.fillRect(x + 31, y + 14, 2, 34);
      facade.fillRect(x + 13, y + 29, 38, 2);
      if (lit) {
        glow.fillStyle = chance(random, 0.4) ? '#ffd396' : '#c9925e';
        glow.fillRect(x + 13, y + 14, 38, 34);
        glow.fillStyle = '#362719';
        glow.fillRect(x + 31, y + 14, 2, 34);
        glow.fillRect(x + 13, y + 29, 38, 2);
      }
    }
  }
  const map = new THREE.CanvasTexture(facadeCanvas);
  const emissiveMap = new THREE.CanvasTexture(glowCanvas);
  setTextureFiltering(map, renderer);
  setTextureFiltering(emissiveMap, renderer);
  return { map, emissiveMap };
}

function mergeBuildings(buildings) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  for (const building of buildings) {
    const indexed = new THREE.BoxGeometry(building.width, building.height, building.depth);
    const geometry = indexed.toNonIndexed();
    indexed.dispose();
    geometry.translate(building.x, building.baseY + building.height / 2, building.z);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    const color = new THREE.Color(building.color);
    const vertexColors = new Float32Array(position.count * 3);
    for (const group of geometry.groups) {
      const isRoof = group.materialIndex === 2 || group.materialIndex === 3;
      const horizontal = group.materialIndex < 2 ? building.depth : building.width;
      for (let vertex = group.start; vertex < group.start + group.count; vertex += 1) {
        if (isRoof) {
          uv.setXY(vertex, 0.025, 0.025);
        } else {
          uv.setXY(vertex, uv.getX(vertex) * horizontal / WINDOWS.tileWidth, uv.getY(vertex) * building.height / WINDOWS.tileHeight);
        }
        const shade = isRoof ? 0.72 : 1;
        vertexColors[vertex * 3] = color.r * shade;
        vertexColors[vertex * 3 + 1] = color.g * shade;
        vertexColors[vertex * 3 + 2] = color.b * shade;
      }
    }
    positions.push(...position.array);
    normals.push(...normal.array);
    uvs.push(...uv.array);
    colors.push(...vertexColors);
    geometry.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}

function buildSky(scene) {
  const radius = RENDER.drawDistance * 0.94;
  const geometry = new THREE.SphereGeometry(radius, 36, 22);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const top = new THREE.Color(PALETTE.skyTop);
  const upper = new THREE.Color(PALETTE.skyUpper);
  const horizon = new THREE.Color(PALETTE.skyHorizon);
  const lower = new THREE.Color(PALETTE.skyLower);
  const sample = new THREE.Color();
  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index) / radius;
    if (y > 0.32) sample.copy(upper).lerp(top, Math.min(1, (y - 0.32) / 0.55));
    else if (y >= 0) sample.copy(horizon).lerp(upper, y / 0.32);
    else sample.copy(horizon).lerp(lower, Math.min(1, -y * 3));
    colors[index * 3] = sample.r;
    colors[index * 3 + 1] = sample.g;
    colors[index * 3 + 2] = sample.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false });
  const sky = new THREE.Mesh(geometry, material);
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  scene.add(sky);
  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(31, 20, 12),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sunDisc.position.set(-760, 265, -1270);
  scene.add(sunDisc);
  return sky;
}

function buildGround(scene, city) {
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD.size + 160, 0.3, WORLD.beachEndZ + WORLD.halfSize + 100),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  ground.position.set(0, -0.24, (WORLD.beachEndZ - WORLD.halfSize) / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  const roads = city.roads.map((road) => ({
    x: road.x,
    y: road.height / 2,
    z: road.z,
    width: road.width,
    height: road.height,
    depth: road.depth,
    color: road.avenue ? PALETTE.avenue : PALETTE.asphalt,
  }));
  makeInstances(scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96 }), roads, false, true);

  const sidewalks = city.sidewalks.map((sidewalk) => ({
    x: sidewalk.x,
    y: sidewalk.height / 2,
    z: sidewalk.z,
    width: sidewalk.width,
    height: sidewalk.height,
    depth: sidewalk.depth,
    color: PALETTE.sidewalk,
  }));
  makeInstances(scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), sidewalks, false, true);

  const markings = [];
  const nearIntersection = (value) => {
    const line = (Math.round(value / CITY.pitch + CITY.blocks / 2) - CITY.blocks / 2) * CITY.pitch;
    return Math.abs(value - line) < CITY.avenueWidth * 0.7;
  };
  for (const road of city.roads) {
    const length = road.axis === 'z' ? road.depth : road.width;
    for (let offset = -length / 2 + 5; offset < length / 2 - 5; offset += 10) {
      const x = road.axis === 'z' ? road.x : offset;
      const z = road.axis === 'z' ? offset : road.z;
      const crossing = road.axis === 'z' ? nearIntersection(z) : nearIntersection(x);
      if (crossing) continue;
      addBox(markings, x, CITY.roadHeight + 0.009, z, road.axis === 'z' ? 0.17 : 4.2, 0.012, road.axis === 'z' ? 4.2 : 0.17);
    }
  }
  for (let ix = 0; ix <= CITY.blocks; ix += 1) {
    for (let iz = 0; iz <= CITY.blocks; iz += 1) {
      const x = (ix - CITY.blocks / 2) * CITY.pitch;
      const z = (iz - CITY.blocks / 2) * CITY.pitch;
      for (const side of [-1, 1]) {
        for (let stripe = -4; stripe <= 4; stripe += 2) {
          addBox(markings, x + stripe, CITY.roadHeight + 0.01, z + side * 9.2, 0.72, 0.014, 3.1);
          addBox(markings, x + side * 9.2, CITY.roadHeight + 0.01, z + stripe, 3.1, 0.014, 0.72);
        }
      }
    }
  }
  const markingMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.crosswalk, roughness: 0.85, emissive: PALETTE.lane, emissiveIntensity: 0.045 });
  makeInstances(scene, new THREE.BoxGeometry(1, 1, 1), markingMaterial, markings, false, true);

  const promenade = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD.size, 0.12, CITY.promenadeWidth),
    new THREE.MeshStandardMaterial({ color: PALETTE.promenade, roughness: 0.9 }),
  );
  promenade.position.set(0, CITY.roadHeight - 0.06, WORLD.halfSize + CITY.promenadeWidth / 2);
  promenade.receiveShadow = true;
  scene.add(promenade);

  const beachDepth = WORLD.beachEndZ - WORLD.seawallZ;
  const beachGeometry = new THREE.PlaneGeometry(WORLD.size + 20, beachDepth, 28, 12);
  beachGeometry.rotateX(-Math.PI / 2);
  const beachPositions = beachGeometry.getAttribute('position');
  const beachColors = new Float32Array(beachPositions.count * 3);
  const dry = new THREE.Color(PALETTE.sand);
  const wet = new THREE.Color(PALETTE.wetSand);
  const sandColor = new THREE.Color();
  for (let index = 0; index < beachPositions.count; index += 1) {
    const progress = (beachPositions.getZ(index) + beachDepth / 2) / beachDepth;
    beachPositions.setY(index, -0.03 - progress * 0.57);
    sandColor.copy(dry).lerp(wet, progress * 0.82);
    beachColors[index * 3] = sandColor.r;
    beachColors[index * 3 + 1] = sandColor.g;
    beachColors[index * 3 + 2] = sandColor.b;
  }
  beachGeometry.setAttribute('color', new THREE.BufferAttribute(beachColors, 3));
  beachGeometry.computeVertexNormals();
  const beach = new THREE.Mesh(beachGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  beach.position.z = WORLD.seawallZ + beachDepth / 2;
  beach.receiveShadow = true;
  scene.add(beach);
}

function buildBuildings(scene, city, renderer) {
  const textures = makeFacadeTextures(renderer);
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map: textures.map,
    emissiveMap: textures.emissiveMap,
    emissive: new THREE.Color(PALETTE.lampGlow),
    emissiveIntensity: WINDOWS.emissiveIntensity,
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.03,
  });
  const buildings = new THREE.Mesh(mergeBuildings(city.buildings), material);
  buildings.castShadow = true;
  buildings.receiveShadow = true;
  scene.add(buildings);

  const caps = [];
  const villaRoofs = [];
  const awnings = [];
  const balconies = [];
  for (const building of city.buildings) {
    const top = building.baseY + building.height;
    addBox(caps, building.x, top + BUILDING.roofCapHeight / 2, building.z, building.width + 0.45, BUILDING.roofCapHeight, building.depth + 0.45, 0, building.accent);
    if (building.roof === 'hipped') {
      villaRoofs.push({ x: building.x, y: top + 1.25, z: building.z, width: building.width * 0.72, height: 2.5, depth: building.depth * 0.72, color: building.accent });
    }
    if (building.awning) {
      addBox(awnings, building.x, building.baseY + 2.65, building.z + building.depth / 2 + 0.85, building.width * 0.78, 0.18, 1.9, 0, building.accent);
    }
    for (let floor = 1; floor < building.balconies; floor += 2) {
      const y = building.baseY + (floor + 0.28) * building.height / building.floors;
      addBox(balconies, building.x, y, building.z + building.depth / 2 + 0.43, building.width * 0.82, 0.19, 1.02, 0, building.accent);
    }
  }
  const capMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82 });
  makeInstances(scene, new THREE.BoxGeometry(1, 1, 1), capMaterial, caps);
  const roofGeometry = new THREE.ConeGeometry(1, 1, 4);
  roofGeometry.rotateY(Math.PI / 4);
  makeInstances(scene, roofGeometry, capMaterial, villaRoofs);
  makeInstances(scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.68 }), awnings);
  if (balconies.length > 0) makeInstances(scene, new THREE.BoxGeometry(1, 1, 1), capMaterial, balconies);
}

function makePalmCrown() {
  const positions = [];
  const colors = [];
  const dark = new THREE.Color(PALETTE.palmLeaf);
  const light = new THREE.Color(PALETTE.palmLeafLight);
  for (let leaf = 0; leaf < 9; leaf += 1) {
    const angle = leaf / 9 * Math.PI * 2;
    const outwardX = Math.cos(angle);
    const outwardZ = Math.sin(angle);
    const sideX = -outwardZ;
    const sideZ = outwardX;
    const points = [
      [0, 0.25, 0.13],
      [1.25, 0.48, 0.5],
      [3.6, -0.82, 0.04],
    ];
    for (let segment = 0; segment < 2; segment += 1) {
      const startRadius = points[segment][0];
      const previousHeight = points[segment][1];
      const previousWidth = points[segment][2];
      const nextRadius = points[segment + 1][0];
      const nextHeight = points[segment + 1][1];
      const nextWidth = points[segment + 1][2];
      const vertices = [
        [outwardX * startRadius + sideX * previousWidth, previousHeight, outwardZ * startRadius + sideZ * previousWidth],
        [outwardX * startRadius - sideX * previousWidth, previousHeight, outwardZ * startRadius - sideZ * previousWidth],
        [outwardX * nextRadius + sideX * nextWidth, nextHeight, outwardZ * nextRadius + sideZ * nextWidth],
        [outwardX * startRadius - sideX * previousWidth, previousHeight, outwardZ * startRadius - sideZ * previousWidth],
        [outwardX * nextRadius - sideX * nextWidth, nextHeight, outwardZ * nextRadius - sideZ * nextWidth],
        [outwardX * nextRadius + sideX * nextWidth, nextHeight, outwardZ * nextRadius + sideZ * nextWidth],
      ];
      for (const vertex of vertices) {
        positions.push(...vertex);
        const color = leaf % 2 === 0 ? light : dark;
        colors.push(color.r, color.g, color.b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildProps(scene, city) {
  const trunks = city.palms.map((palm) => ({
    x: palm.x,
    y: palm.height / 2 + CITY.sidewalkHeight,
    z: palm.z,
    width: 1,
    height: palm.height,
    depth: 1,
    rotation: palm.rotation,
  }));
  makeInstances(scene, new THREE.CylinderGeometry(0.16, 0.28, 1, 7), new THREE.MeshStandardMaterial({ color: PALETTE.palmTrunk, roughness: 1 }), trunks);
  const crowns = city.palms.map((palm) => ({
    x: palm.x,
    y: palm.height + CITY.sidewalkHeight,
    z: palm.z,
    width: 0.85 + palm.height / 18,
    height: 0.85 + palm.height / 18,
    depth: 0.85 + palm.height / 18,
    rotation: palm.rotation,
  }));
  makeInstances(scene, makePalmCrown(), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 }), crowns);

  const poles = [];
  const arms = [];
  const bulbs = [];
  for (const lamp of city.lamps) {
    const offsetX = Math.sin(lamp.rotation) * 0.62;
    const offsetZ = Math.cos(lamp.rotation) * 0.62;
    addBox(poles, lamp.x, lamp.height / 2 + CITY.sidewalkHeight, lamp.z, 1, lamp.height, 1);
    addBox(arms, lamp.x + offsetX / 2, lamp.height + CITY.sidewalkHeight - 0.1, lamp.z + offsetZ / 2, Math.abs(offsetX) + 0.08, 0.08, Math.abs(offsetZ) + 0.08);
    addBox(bulbs, lamp.x + offsetX, lamp.height + CITY.sidewalkHeight - 0.23, lamp.z + offsetZ, 0.34, 0.25, 0.34);
  }
  makeInstances(scene, new THREE.CylinderGeometry(0.055, 0.09, 1, 6), new THREE.MeshStandardMaterial({ color: PALETTE.lampPole, roughness: 0.7, metalness: 0.35 }), poles);
  makeInstances(scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: PALETTE.lampPole, roughness: 0.7 }), arms);
  makeInstances(scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: PALETTE.lampGlow, emissive: PALETTE.lampGlow, emissiveIntensity: 2.1, roughness: 0.35 }), bulbs, false);

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  makeInstances(scene, unitBox, new THREE.MeshStandardMaterial({ color: '#675b49', roughness: 0.95 }), city.piers.map((pier) => ({
    x: pier.x, y: pier.height / 2 - 0.05, z: pier.z, width: pier.width, height: pier.height, depth: pier.depth,
  })));
  makeInstances(scene, unitBox, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.72, metalness: 0.12 }), city.containers.map((container) => ({
    ...container, y: CITY.sidewalkHeight + container.height / 2,
  })));

  const stalls = [];
  for (const stall of city.marketStalls) {
    addBox(stalls, stall.x, stall.height, stall.z, stall.width, 0.2, stall.depth, 0, stall.color);
    addBox(stalls, stall.x, 0.62, stall.z, stall.width * 0.82, 1.1, stall.depth * 0.68, 0, '#8b6748');
  }
  makeInstances(scene, unitBox, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.86 }), stalls);

  const craneParts = [];
  for (const crane of city.cranes) {
    const cosine = Math.cos(crane.rotation);
    const sine = Math.sin(crane.rotation);
    addBox(craneParts, crane.x, crane.height / 2, crane.z, 1.7, crane.height, 1.7, 0, '#d1a344');
    addBox(craneParts, crane.x + cosine * 11, crane.height, crane.z - sine * 11, 34, 1.35, 1.35, crane.rotation, '#d1a344');
    addBox(craneParts, crane.x, crane.height - 2.2, crane.z, 3.4, 3.5, 3, crane.rotation, '#b17238');
    addBox(craneParts, crane.x + cosine * 23, crane.height - 10, crane.z - sine * 23, 0.13, 19, 0.13, 0, '#4b4e48');
  }
  makeInstances(scene, unitBox, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.65, metalness: 0.35 }), craneParts);

  const wall = new THREE.Mesh(new THREE.BoxGeometry(city.seawall.width, city.seawall.height, city.seawall.depth), new THREE.MeshStandardMaterial({ color: PALETTE.seawall, roughness: 0.94 }));
  wall.position.set(city.seawall.x, city.seawall.height / 2, city.seawall.z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
  const railBoxes = [];
  for (let x = -WORLD.halfSize; x <= WORLD.halfSize; x += 6) {
    addBox(railBoxes, x, WORLD.seawallHeight + 0.31, WORLD.seawallZ, 0.09, 0.64, 0.09);
  }
  addBox(railBoxes, 0, WORLD.seawallHeight + 0.58, WORLD.seawallZ, WORLD.size, 0.07, 0.07);
  makeInstances(scene, unitBox, new THREE.MeshStandardMaterial({ color: PALETTE.lampPole, roughness: 0.72, metalness: 0.25 }), railBoxes);
}

function buildSea(scene) {
  const geometry = new THREE.PlaneGeometry(WORLD.seaWidth, WORLD.seaDepth, RENDER.seaWaveSegments, Math.round(RENDER.seaWaveSegments * 0.6));
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  positions.setUsage(THREE.DynamicDrawUsage);
  const base = new Float32Array(positions.array);
  const material = new THREE.MeshStandardMaterial({
    color: PALETTE.sea,
    roughness: 0.28,
    metalness: 0.24,
    emissive: PALETTE.seaDeep,
    emissiveIntensity: 0.13,
  });
  const sea = new THREE.Mesh(geometry, material);
  sea.position.set(0, WORLD.seaLevel, WORLD.beachEndZ + WORLD.seaDepth / 2);
  sea.receiveShadow = true;
  scene.add(sea);

  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size + 30, 3.5),
    new THREE.MeshBasicMaterial({ color: PALETTE.foam, transparent: true, opacity: 0.48, depthWrite: false }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, WORLD.seaLevel + 0.09, WORLD.beachEndZ - 0.8);
  scene.add(foam);
  return { sea, positions, base, foam };
}

export function createScene(canvas, city) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = RENDER.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(PALETTE.fog);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PALETTE.fog, RENDER.fogDensity);
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, CAMERA.near, RENDER.drawDistance);
  const sky = buildSky(scene);
  buildGround(scene, city);
  buildBuildings(scene, city, renderer);
  buildProps(scene, city);
  const sea = buildSea(scene);

  const hemisphere = new THREE.HemisphereLight(PALETTE.hemisphereSky, PALETTE.hemisphereGround, 1.35);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 3.15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
  sun.shadow.camera.left = -RENDER.shadowRadius;
  sun.shadow.camera.right = RENDER.shadowRadius;
  sun.shadow.camera.top = RENDER.shadowRadius;
  sun.shadow.camera.bottom = -RENDER.shadowRadius;
  sun.shadow.camera.near = RENDER.shadowNear;
  sun.shadow.camera.far = RENDER.shadowFar;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);
  const sunTarget = new THREE.Vector3(0, 0, 130);
  sun.position.set(RENDER.sunOffsetX, RENDER.sunHeight, RENDER.sunOffsetZ + 130);
  sun.target.position.copy(sunTarget);

  let elapsed = 0;
  let normalCountdown = 0;

  function update(dt, context) {
    elapsed += dt;
    if (context.player?.state) sunTarget.copy(context.player.state.position);
    sunTarget.y = 0;
    sun.position.set(sunTarget.x + RENDER.sunOffsetX, RENDER.sunHeight, sunTarget.z + RENDER.sunOffsetZ);
    sun.target.position.copy(sunTarget);
    for (let index = 0; index < sea.positions.count; index += 1) {
      const offset = index * 3;
      const x = sea.base[offset];
      const z = sea.base[offset + 2];
      sea.positions.array[offset + 1] = Math.sin(x * 0.027 + elapsed * 0.85) * 0.13 + Math.cos(z * 0.052 - elapsed * 0.62) * 0.08;
    }
    sea.positions.needsUpdate = true;
    normalCountdown -= 1;
    if (normalCountdown <= 0) {
      sea.sea.geometry.computeVertexNormals();
      normalCountdown = 3;
    }
    sea.foam.position.z = WORLD.beachEndZ - 0.8 + Math.sin(elapsed * 0.72) * 0.7;
    sea.foam.material.opacity = 0.43 + Math.sin(elapsed * 0.55) * 0.07;
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render() {
    sky.position.copy(camera.position);
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', resize);
  return { renderer, scene, camera, update, render, resize };
}
