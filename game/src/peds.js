// Seeded sidewalk pedestrians. A corner graph keeps walkers on pavement; the only road edges
// are marked corner crossings. Fear reverses or reroutes those same safe paths, never into traffic.
import * as THREE from 'three';
import { PEDESTRIANS } from './config.js';
import { mulberry32, pick, range } from './random.js';

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const SHIRTS = ['#d66c50', '#e4c887', '#397381', '#e8ded0', '#6a8b73', '#a34f53', '#52708d'];
const TROUSERS = ['#263b44', '#4b514e', '#6b594b', '#34445c', '#777064'];
const SKINS = ['#6f412f', '#91573b', '#b87851', '#d49a71', '#e1b58d'];
const HAIR = ['#211d1c', '#3b2922', '#6b4931', '#171f24'];

function shortAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

class ColorBatch {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
  }

  add(geometry, color, x, y, z) {
    const transformed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    transformed.translate(x, y, z);
    const position = transformed.getAttribute('position');
    const normal = transformed.getAttribute('normal');
    const shade = new THREE.Color(color);
    for (let index = 0; index < position.count; index += 1) {
      this.positions.push(position.getX(index), position.getY(index), position.getZ(index));
      this.normals.push(normal.getX(index), normal.getY(index), normal.getZ(index));
      this.colors.push(shade.r, shade.g, shade.b);
    }
    transformed.dispose();
  }

  box(x, y, z, width, height, depth, color) {
    this.add(new THREE.BoxGeometry(width, height, depth), color, x, y, z);
  }

  sphere(x, y, z, radius, color) {
    this.add(new THREE.SphereGeometry(radius, 10, 7), color, x, y, z);
  }

  mesh(material, castShadow = false) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    return mesh;
  }
}

function makeWalkerModel(scene, random, material) {
  const group = new THREE.Group();
  group.name = 'Cobalto pedestrian';
  const shirt = pick(random, SHIRTS);
  const trousers = pick(random, TROUSERS);
  const skin = pick(random, SKINS);
  const hair = pick(random, HAIR);
  const shoes = '#252b2c';

  const body = new ColorBatch();
  body.box(0, 1.23, 0, 0.52, 0.62, 0.3, shirt);
  body.box(0, 1.02, 0, 0.43, 0.18, 0.28, trousers);
  body.sphere(0, 1.69, 0, 0.19, skin);
  body.box(0, 1.84, -0.015, 0.34, 0.12, 0.3, hair);
  body.box(0, 1.57, 0, 0.14, 0.12, 0.14, skin);
  const torso = body.mesh(material, true);
  group.add(torso);

  function makeLeg(x) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.98, 0);
    const upper = new ColorBatch();
    upper.box(0, -0.19, 0, 0.2, 0.38, 0.22, trousers);
    hip.add(upper.mesh(material));
    const knee = new THREE.Group();
    knee.position.set(0, -0.38, 0);
    const lower = new ColorBatch();
    lower.box(0, -0.19, 0, 0.17, 0.38, 0.18, trousers);
    lower.box(0, -0.42, 0.055, 0.2, 0.13, 0.31, shoes);
    knee.add(lower.mesh(material));
    hip.add(knee);
    group.add(hip);
    return { hip, knee };
  }

  function makeArm(x) {
    const shoulder = new THREE.Group();
    shoulder.position.set(x, 1.49, 0);
    const arm = new ColorBatch();
    arm.box(0, -0.22, 0, 0.17, 0.43, 0.19, shirt);
    arm.box(0, -0.52, 0, 0.14, 0.24, 0.15, skin);
    shoulder.add(arm.mesh(material));
    group.add(shoulder);
    return shoulder;
  }

  const leftLeg = makeLeg(-0.145);
  const rightLeg = makeLeg(0.145);
  const leftArm = makeArm(-0.36);
  const rightArm = makeArm(0.36);
  group.scale.setScalar(range(random, 0.91, 1.07));
  scene.add(group);
  return { group, torso, leftLeg, rightLeg, leftArm, rightArm };
}

function buildCornerGraph(city) {
  const nodes = [];
  const byBlock = new Map();
  for (const block of city.blocks) {
    const blockNodes = CORNERS.map(([sx, sz], corner) => {
      const node = {
        id: `${block.id}-corner-${corner}`,
        block,
        corner,
        x: block.x + sx * PEDESTRIANS.sidewalkOffset,
        z: block.z + sz * PEDESTRIANS.sidewalkOffset,
        neighbors: [],
      };
      nodes.push(node);
      return node;
    });
    byBlock.set(`${block.ix},${block.iz}`, blockNodes);
    for (let corner = 0; corner < 4; corner += 1) {
      const next = (corner + 1) % 4;
      blockNodes[corner].neighbors.push({ node: blockNodes[next], crossing: false });
      blockNodes[next].neighbors.push({ node: blockNodes[corner], crossing: false });
    }
  }

  function cross(a, b) {
    a.neighbors.push({ node: b, crossing: true });
    b.neighbors.push({ node: a, crossing: true });
  }

  for (const block of city.blocks) {
    const own = byBlock.get(`${block.ix},${block.iz}`);
    const east = byBlock.get(`${block.ix + 1},${block.iz}`);
    if (east) {
      cross(own[1], east[0]);
      cross(own[2], east[3]);
    }
    const south = byBlock.get(`${block.ix},${block.iz + 1}`);
    if (south) {
      cross(own[2], south[1]);
      cross(own[3], south[0]);
    }
  }
  return nodes;
}

export function createPeds(stage, city, seed = city.seed) {
  const random = mulberry32((seed ^ 0x51de4a1) | 0);
  const nodes = buildCornerGraph(city);
  const walkers = [];
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.88 });
  let gunshotCooldown = 0;

  function randomNode(origin, minimum = 8, maximum = PEDESTRIANS.respawnDistance) {
    for (let attempt = 0; attempt < 70; attempt += 1) {
      const node = pick(random, nodes);
      const distance = Math.hypot(node.x - origin.x, node.z - origin.z);
      if (distance >= minimum && distance <= maximum) return node;
    }
    return pick(random, nodes);
  }

  function nextWalkTarget(walker, previousNode) {
    let choices = walker.fromNode.neighbors.filter((edge) => edge.node !== previousNode);
    if (choices.length === 0) choices = walker.fromNode.neighbors;
    const streets = choices.filter((edge) => !edge.crossing);
    const crossings = choices.filter((edge) => edge.crossing);
    const selected = crossings.length > 0 && random() < 0.22 ? pick(random, crossings) : pick(random, streets.length ? streets : choices);
    walker.targetNode = selected.node;
    walker.crossing = selected.crossing;
  }

  function turnAway(walker, threatX, threatZ) {
    if (!walker.fromNode || !walker.targetNode) return;
    const fromDistance = Math.hypot(walker.fromNode.x - threatX, walker.fromNode.z - threatZ);
    const targetDistance = Math.hypot(walker.targetNode.x - threatX, walker.targetNode.z - threatZ);
    if (fromDistance > targetDistance + 1) {
      [walker.fromNode, walker.targetNode] = [walker.targetNode, walker.fromNode];
    }
  }

  function scare(walker, x, z, duration = PEDESTRIANS.fearDuration) {
    const wasCalm = walker.fear <= 0;
    walker.fear = Math.max(walker.fear, duration);
    walker.threatX = x;
    walker.threatZ = z;
    if (wasCalm) turnAway(walker, x, z);
  }

  function panic(x, z, radius, duration) {
    if (typeof x === 'object') {
      const origin = x;
      const suppliedRadius = z;
      const suppliedDuration = radius;
      x = origin.x;
      z = origin.z;
      radius = suppliedRadius ?? origin.radius;
      duration = suppliedDuration ?? origin.duration;
    }
    radius ??= PEDESTRIANS.gunshotRadius;
    duration ??= PEDESTRIANS.fearDuration;
    let frightened = 0;
    for (const walker of walkers) {
      if (Math.hypot(walker.position.x - x, walker.position.z - z) <= radius) {
        scare(walker, x, z, duration);
        frightened += 1;
      }
    }
    return frightened;
  }

  function placeWalker(walker, origin, initial = false) {
    const node = randomNode(origin, initial ? 10 : 70);
    walker.fromNode = node;
    walker.previousNode = null;
    walker.targetNode = null;
    nextWalkTarget(walker, null);
    walker.position.set(node.x, city.groundHeightAt(node.x, node.z), node.z);
    walker.previousPosition.copy(walker.position);
    walker.heading = range(random, -Math.PI, Math.PI);
    walker.previousHeading = walker.heading;
    walker.fear = 0;
  }

  for (let index = 0; index < PEDESTRIANS.count; index += 1) {
    const model = makeWalkerModel(stage.scene, random, material);
    const walker = {
      id: `pedestrian-${index + 1}`,
      model,
      position: new THREE.Vector3(),
      previousPosition: new THREE.Vector3(),
      heading: 0,
      previousHeading: 0,
      speed: range(random, PEDESTRIANS.walkSpeedMin, PEDESTRIANS.walkSpeedMax),
      phase: range(random, 0, Math.PI * 2),
      fear: 0,
      threatX: 0,
      threatZ: 0,
      fromNode: null,
      targetNode: null,
      crossing: false,
      bob: 0,
    };
    placeWalker(walker, city.playerSpawn, true);
    walkers.push(walker);
  }

  function chooseFleeTarget(walker) {
    let bestScore = -Infinity;
    let best = null;
    for (const edge of walker.fromNode.neighbors) {
      const distance = Math.hypot(edge.node.x - walker.threatX, edge.node.z - walker.threatZ);
      const score = distance + random() * 8 + (edge.crossing ? -3 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = edge;
      }
    }
    if (best) {
      walker.targetNode = best.node;
      walker.crossing = best.crossing;
    }
  }

  function update(dt, context) {
    const origin = context.player.state.position;
    gunshotCooldown = Math.max(0, gunshotCooldown - dt);
    const gunfire = context.actions.fire || context.actions.gunshotPressed;
    const punch = context.actions.punchPressed || context.actions.meleePressed;
    if ((gunfire || punch) && gunshotCooldown <= 0) {
      panic(origin.x, origin.z, punch ? 13 : PEDESTRIANS.gunshotRadius, punch ? 3.8 : PEDESTRIANS.fearDuration);
      gunshotCooldown = 0.32;
    }

    for (const walker of walkers) {
      if (Math.hypot(walker.position.x - origin.x, walker.position.z - origin.z) > PEDESTRIANS.recycleDistance) {
        placeWalker(walker, origin);
      }
      walker.previousPosition.copy(walker.position);
      walker.previousHeading = walker.heading;
      walker.fear = Math.max(0, walker.fear - dt);

      if (context.vehicles?.vehicles) {
        for (const vehicle of context.vehicles.vehicles) {
          if (Math.abs(vehicle.speed) < PEDESTRIANS.speedingCarThreshold) continue;
          const distance = Math.hypot(vehicle.position.x - walker.position.x, vehicle.position.z - walker.position.z);
          if (distance < PEDESTRIANS.speedingCarRadius) {
            scare(walker, vehicle.position.x, vehicle.position.z, 2.7);
          }
        }
      }

      let dx = walker.targetNode.x - walker.position.x;
      let dz = walker.targetNode.z - walker.position.z;
      let distance = Math.hypot(dx, dz);
      if (distance < 0.32) {
        const previous = walker.fromNode;
        walker.fromNode = walker.targetNode;
        if (walker.fear > 0) chooseFleeTarget(walker);
        else nextWalkTarget(walker, previous);
        dx = walker.targetNode.x - walker.position.x;
        dz = walker.targetNode.z - walker.position.z;
        distance = Math.hypot(dx, dz);
      }
      if (distance > 0.001) {
        dx /= distance;
        dz /= distance;
        const speed = walker.fear > 0 ? PEDESTRIANS.runSpeed : walker.speed;
        const step = Math.min(distance, speed * dt);
        walker.position.x += dx * step;
        walker.position.z += dz * step;
        const wantedHeading = Math.atan2(dx, dz);
        walker.heading += shortAngle(wantedHeading - walker.heading) * (1 - Math.exp(-12 * dt));
        walker.phase += dt * speed * (walker.fear > 0 ? 4.2 : 4.8);
      }
      walker.position.y = city.groundHeightAt(walker.position.x, walker.position.z);
      const stride = Math.sin(walker.phase) * (walker.fear > 0 ? 0.83 : 0.54);
      walker.model.leftLeg.hip.rotation.x = stride;
      walker.model.rightLeg.hip.rotation.x = -stride;
      walker.model.leftLeg.knee.rotation.x = Math.max(0, -Math.sin(walker.phase)) * 0.7;
      walker.model.rightLeg.knee.rotation.x = Math.max(0, Math.sin(walker.phase)) * 0.7;
      if (walker.fear > 0) {
        walker.model.leftArm.rotation.x = -2.62 + Math.sin(walker.phase) * 0.13;
        walker.model.rightArm.rotation.x = -2.62 - Math.sin(walker.phase) * 0.13;
        walker.model.leftArm.rotation.z = -0.28;
        walker.model.rightArm.rotation.z = 0.28;
      } else {
        walker.model.leftArm.rotation.x = -stride * 0.82;
        walker.model.rightArm.rotation.x = stride * 0.82;
        walker.model.leftArm.rotation.z = 0;
        walker.model.rightArm.rotation.z = 0;
      }
      walker.bob = Math.abs(Math.sin(walker.phase)) * (walker.fear > 0 ? 0.045 : 0.022);
    }
  }

  function render(alpha) {
    for (const walker of walkers) {
      const group = walker.model.group;
      group.position.lerpVectors(walker.previousPosition, walker.position, alpha);
      group.position.y += walker.bob;
      group.rotation.y = walker.previousHeading + shortAngle(walker.heading - walker.previousHeading) * alpha;
    }
  }

  return {
    walkers,
    update,
    render,
    panic,
    fleeFrom: panic,
  };
}
