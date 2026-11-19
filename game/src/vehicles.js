// Low-poly vehicle models, arcade driving physics, damage, police lightbars and shared light glows.
import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { clamp, angleWrap } from './rng.js';
import * as TEX from './textures.js';

const GLASS = 0x1b2a33, DARK = 0x17191c, CHROME = 0x8f9296;
const POLICE = { name: 'PDC Cruiser', w: 2.15, d: 4.85, h: 1.35, accel: 16, top: 47, grip: 7.6, brake: 23, mass: 1.2, kind: 'police' };

const MODELS = {
  cangrejo: (c) => [
    [1.9, 0.52, 3.8, 0, 0.56, 0, c], [1.68, 0.5, 1.9, 0, 1.05, -0.2, c],
    [1.72, 0.3, 1.6, 0, 1.12, -0.18, GLASS], [1.8, 0.16, 1.1, 0, 0.86, 1.4, c],
    [1.9, 0.18, 0.24, 0, 0.42, 1.92, DARK], [1.9, 0.18, 0.24, 0, 0.42, -1.92, DARK],
    [0.26, 0.6, 0.6, -0.92, 0.3, 1.22, DARK], [0.26, 0.6, 0.6, 0.92, 0.3, 1.22, DARK],
    [0.26, 0.6, 0.6, -0.92, 0.3, -1.22, DARK], [0.26, 0.6, 0.6, 0.92, 0.3, -1.22, DARK],
  ],
  marea: (c) => [
    [2.2, 0.72, 4.5, 0, 0.68, 0, c], [2.0, 0.72, 2.6, 0, 1.34, -0.15, c],
    [2.04, 0.36, 2.2, 0, 1.38, -0.15, GLASS], [2.1, 0.2, 1.0, 0, 0.98, 1.65, c],
    [2.24, 0.2, 0.26, 0, 0.44, 2.22, DARK], [2.24, 0.2, 0.26, 0, 0.44, -2.22, DARK],
    [2.0, 0.08, 1.4, 0, 1.78, -0.2, DARK],
    [0.3, 0.72, 0.72, -1.04, 0.36, 1.4, DARK], [0.3, 0.72, 0.72, 1.04, 0.36, 1.4, DARK],
    [0.3, 0.72, 0.72, -1.04, 0.36, -1.4, DARK], [0.3, 0.72, 0.72, 1.04, 0.36, -1.4, DARK],
  ],
  mula: (c) => [
    [2.3, 1.3, 5.2, 0, 1.0, 0, c], [2.24, 0.86, 1.5, 0, 1.9, 1.65, c],
    [2.1, 0.4, 1.3, 0, 1.95, 1.66, GLASS], [2.2, 0.1, 3.2, 0, 1.7, -0.75, c],
    [2.36, 0.2, 0.26, 0, 0.46, 2.55, DARK], [2.36, 0.2, 0.26, 0, 0.46, -2.55, DARK],
    [0.32, 0.78, 0.78, -1.08, 0.4, 1.55, DARK], [0.32, 0.78, 0.78, 1.08, 0.4, 1.55, DARK],
    [0.32, 0.78, 0.78, -1.08, 0.4, -1.6, DARK], [0.32, 0.78, 0.78, 1.08, 0.4, -1.6, DARK],
  ],
  viento: (c) => [
    [2.05, 0.4, 4.3, 0, 0.45, 0, c], [1.62, 0.4, 1.7, 0, 0.83, -0.3, c],
    [1.66, 0.28, 1.5, 0, 0.86, -0.34, GLASS], [1.9, 0.12, 1.4, 0, 0.68, 1.55, c],
    [2.0, 0.14, 0.22, 0, 0.34, 2.1, DARK], [1.9, 0.1, 0.6, 0, 1.03, -1.9, c],
    [0.3, 0.5, 0.62, -0.94, 0.28, 1.22, DARK], [0.3, 0.5, 0.62, 0.94, 0.28, 1.22, DARK],
    [0.32, 0.54, 0.66, -0.95, 0.3, -1.3, DARK], [0.32, 0.54, 0.66, 0.95, 0.3, -1.3, DARK],
  ],
  tiburon: (c) => [
    [2.12, 0.48, 4.9, 0, 0.5, 0, c], [1.78, 0.44, 2.0, 0, 0.94, -0.35, c],
    [1.82, 0.3, 1.75, 0, 0.98, -0.4, GLASS], [2.0, 0.1, 2.1, 0, 0.72, 1.55, c],
    [2.0, 0.1, 0.7, 0, 0.74, -1.9, CHROME], [2.14, 0.16, 0.24, 0, 0.38, 2.4, DARK],
    [0.32, 0.58, 0.7, -0.98, 0.31, 1.35, DARK], [0.32, 0.58, 0.7, 0.98, 0.31, 1.35, DARK],
    [0.34, 0.62, 0.74, -0.98, 0.33, -1.45, DARK], [0.34, 0.62, 0.74, 0.98, 0.33, -1.45, DARK],
  ],
  rayo: (c) => [
    [0.36, 0.44, 2.0, 0, 0.72, 0, c], [0.4, 0.26, 0.6, 0, 1.0, -0.15, DARK],
    [0.5, 0.08, 0.08, 0, 1.14, 0.62, CHROME], [0.12, 0.55, 0.55, 0, 0.34, 1.02, DARK],
    [0.12, 0.55, 0.55, 0, 0.34, -1.02, DARK], [0.34, 0.1, 0.7, 0, 0.6, -0.72, c],
  ],
  police: (c) => [
    [2.14, 0.55, 4.8, 0, 0.54, 0, 0xe9e7df], [1.8, 0.48, 2.0, 0, 1.02, -0.35, 0xe9e7df],
    [1.84, 0.32, 1.78, 0, 1.05, -0.38, GLASS], [2.0, 0.14, 1.6, 0, 0.82, 1.5, 0x1d2328],
    [0.7, 0.55, 1.7, 0, 0.55, 0.25, 0x1d2328], [2.16, 0.18, 0.26, 0, 0.38, 2.36, DARK],
    [0.34, 0.6, 0.72, -0.98, 0.32, 1.32, DARK], [0.34, 0.6, 0.72, 0.98, 0.32, 1.32, DARK],
    [0.36, 0.64, 0.76, -0.98, 0.34, -1.42, DARK], [0.36, 0.64, 0.76, 0.98, 0.34, -1.42, DARK],
  ],
};

function mergeModel(parts) {
  const pos = [], nor = [], col = [];
  const c = new THREE.Color();
  for (const [w, h, d, x, y, z, hex] of parts) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    const p = g.attributes.position, n = g.attributes.normal;
    c.set(hex);
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i) + x, p.getY(i) + y, p.getZ(i) + z);
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      col.push(c.r, c.g, c.b);
    }
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

const modelCache = new Map();
function modelGeo(type, color) {
  const key = type + ':' + color;
  if (!modelCache.has(key)) {
    const f = MODELS[type] || MODELS.tiburon;
    modelCache.set(key, mergeModel(f(color)));
  }
  return modelCache.get(key);
}

export class VehicleLights {
  constructor(scene) {
    this.max = 260;
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    this.size = new Float32Array(this.max);
    this.n = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: TEX.glowTexture() } },
      vertexShader: `attribute float aSize; varying vec3 vC; void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*(420.0/max(1.0,-mv.z)); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vC; void main(){ vec4 t=texture2D(uMap,gl_PointCoord); gl_FragColor=vec4(vC*t.rgb,t.a*0.9); }`,
      transparent: true, depthWrite: false, depthTest: true, vertexColors: true, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; scene.add(this.points);
  }
  begin() { this.n = 0; }
  add(x, y, z, r, g, b, s) {
    if (this.n >= this.max) return;
    const i = this.n++, k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.col[k] = r; this.col[k + 1] = g; this.col[k + 2] = b; this.size[i] = s;
  }
  end() {
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}

export class VehicleShadows {
  constructor(scene) {
    this.max = 90;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: TEX.glowTexture(), color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }), this.max);
    this.mesh.frustumCulled = false; this.mesh.rotation.x = 0;
    scene.add(this.mesh);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3();
    this.e = new THREE.Euler(-Math.PI / 2, 0, 0);
  }
  begin() { this.n = 0; }
  add(x, z, rot, w, d) {
    if (this.n >= this.max) return;
    this.p.set(x, 0.09, z); this.q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -rot)); this.s.set(w, d, 1);
    this.m.compose(this.p, this.q, this.s); this.mesh.setMatrixAt(this.n++, this.m);
  }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; }
}

export function createVehicle(scene, type, opts = {}) {
  const spec = type === 'police' ? POLICE : VEHICLES[type] || VEHICLES.cangrejo;
  const color = opts.color ?? spec.color ?? 0xcccccc;
  const simple = opts.simple ?? true;
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.28 });
  const body = new THREE.Mesh(modelGeo(type, color), mat);
  body.castShadow = true; body.receiveShadow = true; group.add(body);
  const wheels = [];
  if (!simple) {
    const wg = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 8); wg.rotateZ(Math.PI / 2);
    const wm = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.9 });
    const xs = [-spec.w / 2 + 0.02, spec.w / 2 - 0.02], zs = [spec.d * 0.3, -spec.d * 0.3];
    for (const x of xs) for (const z of zs) {
      const wh = new THREE.Mesh(wg, wm); wh.position.set(x, 0.34, z); group.add(wh); wheels.push({ mesh: wh, front: z > 0, x, z });
    }
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xffd8c0, emissive: 0xff2a08, emissiveIntensity: 12, roughness: 0.3 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffc46a, emissiveIntensity: 5, roughness: 0.3 });
    for (const x of [-spec.w * 0.32, spec.w * 0.32]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.07), tailMat); tl.position.set(x, 0.64, -spec.d * 0.5 - 0.02); group.add(tl);
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.07), headMat); hl.position.set(x, 0.62, spec.d * 0.5 + 0.02); group.add(hl);
    }
  }
  let lightbar = null;
  if (type === 'police') {
    lightbar = { red: null, blue: null, pool: null, light: null };
    const lb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.26), new THREE.MeshStandardMaterial({ color: 0x22262b, emissive: 0x111111 }));
    lb.position.set(0, 1.36, -0.3); group.add(lb);
    const rm = new THREE.MeshStandardMaterial({ color: 0xff2a20, emissive: 0xff1a10, emissiveIntensity: 6 });
    const bm = new THREE.MeshStandardMaterial({ color: 0x2255ff, emissive: 0x1040ff, emissiveIntensity: 6 });
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.24), rm); r.position.set(-0.3, 1.44, -0.3); group.add(r);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.24), bm); b.position.set(0.3, 1.44, -0.3); group.add(b);
    lightbar.red = rm; lightbar.blue = bm;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 9), new THREE.MeshBasicMaterial({ map: TEX.glowTexture(), color: 0xff3344, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.1; group.add(pool); lightbar.pool = pool;
    const pl = new THREE.PointLight(0xff2233, 14, 16, 2); pl.position.set(0, 1.4, -0.3); group.add(pl); lightbar.light = pl;
  }
  scene.add(group);
  const v = {
    type, spec, color, group, body, wheels, lightbar, simple,
    pos: new THREE.Vector3(opts.x ?? 0, 0, opts.z ?? 0), heading: opts.heading ?? 0,
    speed: 0, steer: 0, health: 100, occupied: false, ai: !!opts.ai, police: type === 'police',
    maxHealth: 100, dead: false, smokeT: 0, siren: opts.siren ?? false, sirenPhase: Math.random() * 6,
    brakeT: 0, skidT: 0, lane: opts.lane ?? null, targetSpeed: opts.speed ?? 11, spin: 0,
  };
  v.group.position.set(v.pos.x, 0.02, v.pos.z);
  v.group.rotation.y = v.heading;
  return v;
}

export function forward(h) { return { x: Math.sin(h), z: Math.cos(h) }; }

export function updateVehicle(v, dt, ctrl, city, fx, audio) {
  if (v.dead) return;
  const s = v.spec;
  let throttle = ctrl.throttle || 0, brake = ctrl.brake || 0, steer = ctrl.steer || 0;
  const hand = !!ctrl.handbrake;
  if (v.ai) { throttle = ctrl.throttle ?? 0; brake = ctrl.brake ?? 0; steer = ctrl.steer ?? 0; }
  const prevSpeed = v.speed;
  if (throttle > 0) v.speed += throttle * s.accel * dt;
  if (brake > 0) v.speed = Math.max(0, v.speed - brake * s.brake * dt);
  v.speed -= v.speed * (hand ? 1.7 : 0.42) * dt;
  v.speed = clamp(v.speed, -11, s.top);
  if (Math.abs(v.speed) < 0.06 && !throttle) v.speed = 0;
  v.steer += (steer - v.steer) * Math.min(1, 9 * dt);
  const grip = hand ? 0.42 : 1;
  const spd = Math.abs(v.speed);
  const turn = v.steer * (0.35 + 0.65 * Math.min(1, spd / 13)) * 1.45 * dt * (v.speed < 0 ? -1 : 1);
  v.heading = angleWrap(v.heading + turn * grip);
  const f = forward(v.heading);
  v.pos.x += f.x * v.speed * dt; v.pos.z += f.z * v.speed * dt;
  const p = { x: v.pos.x, z: v.pos.z }, out = { x: 0, z: 0 };
  const r = Math.min(s.w, s.d) * 0.46;
  if (city.collide(p, r, out)) {
    v.pos.x = p.x; v.pos.z = p.z;
    const imp = Math.abs(v.speed);
    if (imp > 3) {
      v.health -= imp * 1.4; v.speed *= -0.2;
      if (fx) { fx.impact(v.pos.x - f.x * 1.5, 0.6, v.pos.z - f.z * 1.5, 5); fx.smokePuff(v.pos.x, 0.6, v.pos.z, 0.7, true); }
      if (audio) audio.crash(Math.min(1, imp / 25));
    } else { v.speed *= -0.08; }
  }
  if (city.isWater(v.pos.x, v.pos.z)) { v.pos.x -= f.x * 1.5; v.pos.z -= f.z * 1.5; v.speed *= -0.3; }
  if (v.health <= 0 && !v.dead) { v.dead = true; if (fx) fx.boom(v.pos.x, 1.1, v.pos.z); }
  v.health = clamp(v.health, 0, 100);
  v.group.position.set(v.pos.x, 0.02, v.pos.z);
  v.group.rotation.y = v.heading;
  const roll = -v.steer * clamp(spd / s.top, 0, 1) * 0.075;
  v.group.rotation.z = roll;
  v.group.rotation.x = clamp((v.speed - prevSpeed) / Math.max(dt, 0.001) * -0.002, -0.05, 0.05);
  for (const w of v.wheels) {
    w.mesh.rotation.x += v.speed * dt / 0.34;
    if (w.front) w.mesh.rotation.y = v.steer * 0.5;
  }
  // tyre smoke, dust and skid marks
  const slipping = hand && spd > 4 || Math.abs(v.steer) > 0.75 && spd > 12;
  v.skidT -= dt;
  if (slipping && v.skidT <= 0 && fx) {
    v.skidT = 0.045;
    const side = { x: Math.cos(v.heading), z: -Math.sin(v.heading) };
    for (const s2 of [-1, 1]) fx.skidMark(v.pos.x + side.x * s.w * 0.4 * s2, v.pos.z + side.z * s.w * 0.4 * s2, v.heading, 0.22);
    fx.smokePuff(v.pos.x + side.x * s.w * 0.45, 0.28, v.pos.z + side.z * s.w * 0.45, 0.5);
    fx.smokePuff(v.pos.x - side.x * s.w * 0.45, 0.28, v.pos.z - side.z * s.w * 0.45, 0.5);
  }
  if (v.health < 38 && !v.dead) {
    v.smokeT -= dt;
    if (v.smokeT <= 0 && fx) { v.smokeT = 0.18; fx.smokePuff(v.pos.x, 0.9, v.pos.z + f.z * 1.2, 0.6, true); }
  }
  if (v.police && v.lightbar) {
    v.sirenPhase += dt * 9;
    const on = Math.sin(v.sirenPhase) > 0;
    v.lightbar.red.emissiveIntensity = on ? 7 : 0.3;
    v.lightbar.blue.emissiveIntensity = on ? 0.3 : 7;
    v.lightbar.pool.material.color.setHex(on ? 0xff2233 : 0x2244ff);
    v.lightbar.pool.material.opacity = 0.45;
    if (v.lightbar.light) { v.lightbar.light.color.setHex(on ? 0xff2233 : 0x2244ff); v.lightbar.light.intensity = on ? 18 : 12; }
  }
}

export function nearestVehicle(list, pos, maxDist = 4) {
  let best = null, bd = maxDist * maxDist;
  for (const v of list) {
    if (v.occupied || v.dead) continue;
    const dx = v.pos.x - pos.x, dz = v.pos.z - pos.z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

export function addVehicleLights(v, lights) {
  const f = forward(v.heading), s = v.spec;
  const sx = Math.cos(v.heading), sz = -Math.sin(v.heading);
  const y = v.type === 'rayo' ? 0.7 : 0.55;
  lights.add(v.pos.x + f.x * (s.d * 0.5 + 0.06) + sx * s.w * 0.34, y, v.pos.z + f.z * (s.d * 0.5 + 0.06) + sz * s.w * 0.34, 1.0, 0.9, 0.66, 0.55);
  lights.add(v.pos.x + f.x * (s.d * 0.5 + 0.06) - sx * s.w * 0.34, y, v.pos.z + f.z * (s.d * 0.5 + 0.06) - sz * s.w * 0.34, 1.0, 0.9, 0.66, 0.55);
  lights.add(v.pos.x - f.x * (s.d * 0.5 + 0.06) + sx * s.w * 0.34, y, v.pos.z - f.z * (s.d * 0.5 + 0.06) + sz * s.w * 0.34, 1.0, 0.1, 0.07, 0.48);
  lights.add(v.pos.x - f.x * (s.d * 0.5 + 0.06) - sx * s.w * 0.34, y, v.pos.z - f.z * (s.d * 0.5 + 0.06) - sz * s.w * 0.34, 1.0, 0.1, 0.07, 0.48);
  lights.add(v.pos.x - f.x * (s.d * 0.5 + 0.08), y - 0.02, v.pos.z - f.z * (s.d * 0.5 + 0.08), 1.0, 0.16, 0.06, 0.78);
  lights.add(v.pos.x + f.x * (s.d * 0.5 + 0.08), y - 0.02, v.pos.z + f.z * (s.d * 0.5 + 0.08), 1.0, 0.86, 0.52, 0.7);
  if (v.police && v.siren) {
    const on = Math.sin(v.sirenPhase) > 0;
    lights.add(v.pos.x - sx * 0.3, 1.5, v.pos.z - sz * 0.3, on ? 1 : 0.2, on ? 0.1 : 0.1, on ? 0.1 : 1, 1.3);
    lights.add(v.pos.x + sx * 0.3, 1.5, v.pos.z + sz * 0.3, on ? 0.2 : 1, 0.1, on ? 1 : 0.1, 1.3);
  }
}
