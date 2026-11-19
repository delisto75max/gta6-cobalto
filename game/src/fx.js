// Lightweight effects: smoke/spark particles, skid marks, tracers and muzzle flashes.
import * as THREE from 'three';
import * as TEX from './textures.js';

const PVERT = `
  attribute float aSize; attribute float aAlpha; varying float vA; varying vec3 vC;
  void main(){ vC=color; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0);
    gl_PointSize = aSize * (420.0 / max(1.0,-mv.z)); gl_Position = projectionMatrix*mv; }`;
const PFRAG = `uniform sampler2D uMap; varying float vA; varying vec3 vC;
  void main(){ vec4 t=texture2D(uMap,gl_PointCoord); if(t.a*vA<0.01) discard; gl_FragColor=vec4(vC*t.rgb,t.a*vA); }`;

class Pool {
  constructor(scene, n, additive) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.grow = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = g;
    const m = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: additive ? TEX.glowTexture() : TEX.smokeTexture() } },
      vertexShader: PVERT, fragmentShader: PFRAG,
      transparent: true, depthWrite: false, vertexColors: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false; scene.add(this.points);
    this.additive = additive;
  }
  spawn(x, y, z, vx, vy, vz, r, g, b, size, life, grav = 0, drag = 0.98, grow = 0) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.col[k] = r; this.col[k + 1] = g; this.col[k + 2] = b;
    this.size[i] = size; this.alpha[i] = 1; this.life[i] = this.max[i] = life;
    this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
  }
  update(dt) {
    const { pos, vel, life, max, size, alpha, grow, grav, drag } = this;
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      life[i] -= dt;
      const k = i * 3;
      vel[k + 1] += grav[i] * dt;
      const d = Math.pow(drag[i], dt * 60);
      vel[k] *= d; vel[k + 1] *= d; vel[k + 2] *= d;
      pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
      size[i] += grow[i] * dt;
      alpha[i] = Math.max(0, life[i] / max[i]);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.smoke = new Pool(scene, 480, false);
    this.spark = new Pool(scene, 520, true);
    this.flashes = [];
    const glow = TEX.glowTexture();
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd08a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      s.scale.set(2, 2, 1); s.visible = false; scene.add(s); this.flashes.push({ s, life: 0 });
    }
    this.light = new THREE.PointLight(0xffb060, 0, 26, 2); scene.add(this.light); this.lightLife = 0;
    this.skid = new SkidPool(scene);
    this.tracer = new TracerPool(scene);
  }
  muzzle(x, y, z, size = 1) {
    const f = this.flashes.find((v) => v.life <= 0) || this.flashes[0];
    f.s.position.set(x, y, z); f.s.scale.setScalar(size * 1.4); f.s.visible = true; f.s.material.opacity = 1; f.life = 0.07;
    this.light.position.set(x, y, z); this.light.intensity = 18; this.lightLife = 0.08;
    for (let i = 0; i < 4; i++) this.spark.spawn(x, y, z, (Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8, 1, 0.7, 0.3, 0.12, 0.18, -18);
  }
  impact(x, y, z, n = 6, color = [1, 0.65, 0.3]) {
    for (let i = 0; i < n; i++) this.spark.spawn(x, y, z, (Math.random() - 0.5) * 9, Math.random() * 7, (Math.random() - 0.5) * 9, color[0], color[1], color[2], 0.1 + Math.random() * 0.1, 0.25 + Math.random() * 0.2, -20, 0.985);
    this.light.position.set(x, y, z); this.light.intensity = 8; this.lightLife = 0.05;
  }
  smokePuff(x, y, z, s = 1, dark = false) {
    const c = dark ? 0.16 : 0.5;
    this.smoke.spawn(x, y, z, (Math.random() - 0.5) * 1.2, 0.6 + Math.random(), (Math.random() - 0.5) * 1.2, c, c * 0.95, c * 0.9, 0.3 * s, 0.7 + Math.random() * 0.6, 0.4, 0.985, 1.4 * s);
  }
  dust(x, z, s = 1) {
    for (let i = 0; i < 3; i++) this.smoke.spawn(x + (Math.random() - 0.5), 0.25, z + (Math.random() - 0.5), (Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2, 0.72, 0.6, 0.42, 0.35 * s, 0.55, 0.2, 0.97, 1.2);
  }
  spray(x, z) {
    for (let i = 0; i < 3; i++) this.smoke.spawn(x + (Math.random() - 0.5) * 2, 0.25, z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 1.8, (Math.random() - 0.5) * 2, 0.8, 0.87, 0.86, 0.3, 0.45, -3, 0.98, 0.8);
  }
  boom(x, y, z) {
    for (let i = 0; i < 26; i++) this.spark.spawn(x, y, z, (Math.random() - 0.5) * 22, Math.random() * 18, (Math.random() - 0.5) * 22, 1, 0.5 + Math.random() * 0.4, 0.15, 0.2 + Math.random() * 0.25, 0.5 + Math.random() * 0.5, -16, 0.985);
    for (let i = 0; i < 14; i++) this.smoke.spawn(x, y, z, (Math.random() - 0.5) * 8, 2 + Math.random() * 6, (Math.random() - 0.5) * 8, 0.12, 0.1, 0.09, 0.7, 1.6, 1.2, 0.98, 2.4);
    this.light.position.set(x, y, z); this.light.intensity = 120; this.lightLife = 0.35;
  }
  skidMark(x, z, rot, w = 0.24) { this.skid.add(x, z, rot, w); }
  shotTracer(a, b) { this.tracer.add(a, b); }
  update(dt) {
    this.smoke.update(dt); this.spark.update(dt); this.skid.update(); this.tracer.update(dt);
    for (const f of this.flashes) {
      if (f.life > 0) { f.life -= dt; f.s.material.opacity = Math.max(0, f.life / 0.07); if (f.life <= 0) f.s.visible = false; }
    }
    if (this.lightLife > 0) { this.lightLife -= dt; this.light.intensity *= Math.max(0, 1 - dt * 20); if (this.lightLife <= 0) this.light.intensity = 0; }
  }
}

class SkidPool {
  constructor(scene) {
    this.n = 700; this.i = 0;
    this.pos = new Float32Array(this.n * 6 * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setDrawRange(0, 0);
    const m = new THREE.MeshBasicMaterial({ color: 0x151515, transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.mesh = new THREE.Mesh(this.geo, m); this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  add(x, z, rot, w) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    const c = Math.cos(rot), s = Math.sin(rot);
    const dx = c * 0.5, dz = s * 0.5, px = -s * w, pz = c * w;
    const o = i * 18;
    const v = [
      x - dx - px, 0.085, z - dz - pz, x - dx + px, 0.085, z - dz + pz, x + dx + px, 0.085, z + dz + pz,
      x - dx - px, 0.085, z - dz - pz, x + dx + px, 0.085, z + dz + pz, x + dx - px, 0.085, z + dz - pz,
    ];
    for (let k = 0; k < 18; k++) this.pos[o + k] = v[k];
    this.geo.attributes.position.needsUpdate = true;
    this.geo.setDrawRange(0, Math.min(this.n, this.i || this.n) * 6);
  }
  update() {}
}

class TracerPool {
  constructor(scene) {
    this.n = 48; this.i = 0;
    this.pos = new Float32Array(this.n * 6);
    this.col = new Float32Array(this.n * 6);
    this.life = new Float32Array(this.n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.LineSegments(g, m); this.mesh.frustumCulled = false; scene.add(this.mesh);
    this.geo = g;
  }
  add(a, b) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    const o = i * 6;
    this.pos[o] = a.x; this.pos[o + 1] = a.y; this.pos[o + 2] = a.z;
    this.pos[o + 3] = b.x; this.pos[o + 4] = b.y; this.pos[o + 5] = b.z;
    this.col[o] = 1; this.col[o + 1] = 0.78; this.col[o + 2] = 0.4;
    this.col[o + 3] = 1; this.col[o + 4] = 0.55; this.col[o + 5] = 0.2;
    this.life[i] = 0.09;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] > 0) {
        this.life[i] -= dt;
        if (this.life[i] <= 0) { const o = i * 6; for (let k = 0; k < 6; k++) this.col[o + k] = 0; any = true; }
      }
    }
    if (any) this.geo.attributes.color.needsUpdate = true;
  }
}
