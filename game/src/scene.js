// The three.js world: golden-hour sky, sea, city geometry, street furniture and the bloom pass.
import * as THREE from 'three';
import { CFG } from './config.js';
import { RNG } from './rng.js';
import { buildCity } from './city.js';
import * as TEX from './textures.js';

const sunDir = new THREE.Vector3(-0.36, 0.2, -0.91).normalize();

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(1280, 720, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CFG.palette.fog, 260, 2100);
  const envTex = TEX.skyGradientTexture();
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = envTex;
  const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.2, 5200);
  camera.position.set(0, 4, 26);

  const city = buildCity();
  const rng = new RNG(CFG.seed ^ 0x51ed);

  // ---- light --------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xffd8b8, 0x2c5159, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc58e, 2.75);
  sun.position.copy(sunDir).multiplyScalar(420);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -170; sun.shadow.camera.right = 170;
  sun.shadow.camera.top = 170; sun.shadow.camera.bottom = -170;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 1400;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0007;
  sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0x73a6bd, 0.45);
  fill.position.set(120, 90, -180);
  scene.add(fill);

  // ---- sky, sun glow, clouds ---------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(3600, 32, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x0d4562) },
        uMid: { value: new THREE.Color(0xe8895f) },
        uLow: { value: new THREE.Color(0xffd39b) },
        uSunDir: { value: sunDir },
        uSunCol: { value: new THREE.Color(0xffe0ae) },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vDir; uniform vec3 uTop,uMid,uLow,uSunCol,uSunDir;
        void main(){
          float h = clamp(vDir.y*1.25+0.06, 0.0, 1.0);
          vec3 c = mix(uLow, uMid, smoothstep(0.0,0.2,h));
          c = mix(c, uTop, smoothstep(0.2,0.72,h));
          float sd = max(dot(normalize(vDir), uSunDir), 0.0);
          c += uSunCol * pow(sd, 420.0) * 5.0;
          c += uSunCol * pow(sd, 9.0) * 0.16;
          gl_FragColor = vec4(c, 1.0);
        }`,
      fog: false,
    }),
  );
  sky.frustumCulled = false; scene.add(sky);

  const glowTex = TEX.glowTexture();
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffdfae, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
  sunSprite.scale.set(460, 460, 1); scene.add(sunSprite);
  const sunCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff3d8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1 }));
  sunCore.scale.set(120, 120, 1); scene.add(sunCore);

  const clouds = [];
  for (let i = 0; i < 8; i++) {
    const tex = TEX.cloudTexture(i + 3);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.5 + rng.next() * 0.25, color: new THREE.Color(0xffd9c0) }));
    const a = rng.range(-2.4, 0.8), r = rng.range(900, 1800);
    s.position.set(Math.cos(a) * r, rng.range(180, 390), Math.sin(a) * r - 700);
    s.scale.set(rng.range(420, 760), rng.range(130, 230), 1);
    scene.add(s); clouds.push(s);
  }

  // ---- ground, roads, sidewalks -----------------------------------------
  const asphalt = TEX.asphaltTexture();
  const concrete = TEX.concreteTexture();
  const sandTex = TEX.sandTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, color: 0xa8a49c, roughness: 0.74, metalness: 0.02 });
  roadMat.map.repeat.set(1, 1);
  const walkMat = new THREE.MeshStandardMaterial({ map: concrete, color: 0xb8ae9b, roughness: 0.95 });
  const markMat = new THREE.MeshStandardMaterial({ color: 0xe9dfc3, roughness: 0.8, emissive: 0x20180c, emissiveIntensity: 1.0 });
  const cityGround = new THREE.Mesh(new THREE.BoxGeometry(2260, 0.3, 1400), new THREE.MeshStandardMaterial({ map: concrete, color: 0x958c7b, roughness: 0.96 }));
  cityGround.position.set(0, -0.16, -90); cityGround.receiveShadow = true; scene.add(cityGround);

  const roadMeshes = [];
  for (const r of city.roads) {
    const len = r.to - r.from;
    const g = r.axis === 'z' ? new THREE.BoxGeometry(r.w, 0.08, len) : new THREE.BoxGeometry(len, 0.08, r.w);
    const m = roadMat.clone(); m.map = asphalt.clone(); m.map.needsUpdate = true;
    m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
    m.map.repeat.set(r.axis === 'z' ? r.w / 7 : len / 7, r.axis === 'z' ? len / 7 : r.w / 7);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(r.axis === 'z' ? r.at : (r.from + r.to) / 2, 0.01, r.axis === 'z' ? (r.from + r.to) / 2 : r.at);
    mesh.receiveShadow = true; scene.add(mesh); roadMeshes.push(mesh);
    // sidewalks + curb + centre lines
    for (const side of [-1, 1]) {
      const sw = 5.2, off = r.w / 2 + sw / 2;
      const sg = r.axis === 'z' ? new THREE.BoxGeometry(sw, 0.24, len) : new THREE.BoxGeometry(len, 0.24, sw);
      const sm = new THREE.Mesh(sg, walkMat.clone()); sm.material.map = concrete.clone(); sm.material.map.needsUpdate = true;
      sm.material.map.wrapS = sm.material.map.wrapT = THREE.RepeatWrapping;
      sm.material.map.repeat.set(r.axis === 'z' ? 1.2 : len / 10, r.axis === 'z' ? len / 10 : 1.2);
      sm.position.set(r.axis === 'z' ? r.at + off * side : (r.from + r.to) / 2, 0.04, r.axis === 'z' ? (r.from + r.to) / 2 : r.at + off * side);
      sm.receiveShadow = true; scene.add(sm);
    }
    if (r.main) {
      for (const side of [-1, 1]) {
        const lg = r.axis === 'z' ? new THREE.BoxGeometry(0.14, 0.02, len) : new THREE.BoxGeometry(len, 0.02, 0.14);
        const lm = new THREE.Mesh(lg, markMat);
        lm.position.set(r.axis === 'z' ? r.at + side * 0.26 : (r.from + r.to) / 2, 0.07, r.axis === 'z' ? (r.from + r.to) / 2 : r.at + side * 0.26);
        scene.add(lm);
      }
    }
  }

  // lane dashes, crosswalks, manholes
  const dashGeo = new THREE.BoxGeometry(1, 1, 1);
  const dashes = [];
  for (const r of city.roads) {
    const offs = r.main ? [3.4, 10.2, -3.4, -10.2] : [4.0, -4.0];
    for (const off of offs) {
      for (let t = r.from + 5; t < r.to - 4; t += 10.5) {
        dashes.push({ x: r.axis === 'z' ? r.at + off : t, z: r.axis === 'z' ? t : r.at + off, rot: r.axis === 'z' ? 0 : 1 });
      }
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, markMat, dashes.length);
  dashes.forEach((d, i) => {
    const m = new THREE.Matrix4();
    if (d.rot) m.makeScale(3.2, 0.02, 0.16); else m.makeScale(0.16, 0.02, 3.2);
    m.setPosition(d.x, 0.075, d.z);
    dashMesh.setMatrixAt(i, m);
  });
  dashMesh.instanceMatrix.needsUpdate = true; scene.add(dashMesh);

  const stripes = [];
  const xs = CFG.avenues.map((a) => a.x), zs = [...CFG.streets.map((s) => s.z), CFG.coast.z];
  for (const ax of xs) for (const sz of zs) {
    for (let k = -2; k <= 2; k++) {
      stripes.push({ x: ax + k * 1.5, z: sz - 12.5, rot: 0 });
      stripes.push({ x: ax + k * 1.5, z: sz + 12.5, rot: 0 });
      stripes.push({ x: ax - 12.5, z: sz + k * 1.5, rot: 1 });
      stripes.push({ x: ax + 12.5, z: sz + k * 1.5, rot: 1 });
    }
  }
  const crossMesh = new THREE.InstancedMesh(dashGeo, markMat, stripes.length);
  stripes.forEach((s, i) => {
    const m = new THREE.Matrix4();
    if (s.rot) m.makeScale(5.0, 0.02, 0.7); else m.makeScale(0.7, 0.02, 5.0);
    m.setPosition(s.x, 0.078, s.z); crossMesh.setMatrixAt(i, m);
  });
  crossMesh.instanceMatrix.needsUpdate = true; scene.add(crossMesh);

  const manholeGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.02, 8);
  const manholeMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2d, roughness: 0.9 });
  const manholes = [];
  for (const r of city.roads) for (let t = r.from + 30; t < r.to - 20; t += 90) manholes.push({ x: r.axis === 'z' ? r.at + 2 : t, z: r.axis === 'z' ? t : r.at + 2 });
  const manholeMesh = new THREE.InstancedMesh(manholeGeo, manholeMat, manholes.length);
  manholes.forEach((m, i) => { const mat = new THREE.Matrix4(); mat.makeTranslation(m.x, 0.07, m.z); manholeMesh.setMatrixAt(i, mat); });
  scene.add(manholeMesh);

  // block plazas
  const plazaMat = new THREE.MeshStandardMaterial({ map: concrete, color: 0xa99d88, roughness: 0.97 });
  for (const b of city.blocks) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0, 0.16, b.z1 - b.z0), plazaMat);
    m.position.set((b.x0 + b.x1) / 2, 0.06, (b.z0 + b.z1) / 2);
    m.receiveShadow = true; scene.add(m);
  }

  // ---- buildings (one instanced draw, procedural facades) ----------------
  const allB = city.buildings.concat(city.upper);
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const seeds = new Float32Array(allB.length);
  const bmesh = new THREE.InstancedMesh(box, buildingMaterial(seeds), allB.length);
  const m4 = new THREE.Matrix4();
  allB.forEach((b, i) => {
    m4.makeScale(b.w, b.h, b.d); m4.setPosition(b.x, 0, b.z); bmesh.setMatrixAt(i, m4);
    bmesh.setColorAt(i, new THREE.Color(b.color));
    seeds[i] = (b.seed % 1000) / 1000;
  });
  box.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  bmesh.instanceMatrix.needsUpdate = true; bmesh.instanceColor.needsUpdate = true;
  bmesh.castShadow = true; bmesh.receiveShadow = true; scene.add(bmesh);

  // rooftop clutter
  const acs = city.roofProps.filter((p) => p.kind === 'ac');
  const tanks = city.roofProps.filter((p) => p.kind === 'tank');
  const ants = city.roofProps.filter((p) => p.kind === 'antenna');
  instancedBoxes(scene, acs.map((p) => ({ x: p.x, y: p.y, z: p.z, w: p.w, h: p.h, d: p.w, color: p.color })));
  if (tanks.length) {
    const tg = new THREE.CylinderGeometry(1, 1, 1, 7); tg.translate(0, 0.5, 0);
    const tm = new THREE.MeshStandardMaterial({ color: 0x9aa0a2, roughness: 0.85 });
    const tmesh = new THREE.InstancedMesh(tg, tm, tanks.length);
    tanks.forEach((p, i) => { const mm = new THREE.Matrix4(); mm.makeScale(p.w, p.h, p.w); mm.setPosition(p.x, p.y, p.z); tmesh.setMatrixAt(i, mm); tmesh.setColorAt(i, new THREE.Color(p.color)); });
    tmesh.castShadow = true; scene.add(tmesh);
  }
  instancedBoxes(scene, ants.map((p) => ({ x: p.x, y: p.y, z: p.z, w: p.w, h: p.h, d: p.w, color: p.color })));

  // awnings
  const awnMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const awn = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.28, 1), awnMat, Math.max(1, city.awnings.length));
  city.awnings.forEach((a, i) => {
    const mm = new THREE.Matrix4(); mm.makeScale(a.w, 1, a.d); mm.setPosition(a.x, a.y, a.z);
    const rot = new THREE.Matrix4().makeRotationY(a.rot); mm.premultiply(rot);
    awn.setMatrixAt(i, mm); awn.setColorAt(i, new THREE.Color(a.color));
  });
  awn.count = city.awnings.length; scene.add(awn);

  // neon shop signs
  const signMats = new Map();
  for (const s of city.signs) {
    const key = s.text;
    if (!signMats.has(key)) signMats.set(key, new THREE.MeshBasicMaterial({ map: TEX.signTexture(s.text, s.bg, s.fg), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), signMats.get(key));
    mesh.position.set(s.x, s.y, s.z); mesh.rotation.y = s.rot; scene.add(mesh);
  }

  // billboards
  for (const b of city.billboards) {
    const mat = new THREE.MeshBasicMaterial({ map: TEX.billboardTexture(b.title, b.sub), side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.h), mat);
    mesh.position.set(b.x, b.y, b.z); mesh.rotation.y = b.rot; scene.add(mesh);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x4b4d4c, roughness: 0.8 });
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, b.y, 0.22), legMat);
      leg.position.set(b.x + Math.cos(b.rot) * s * b.w * 0.33, b.y / 2, b.z - Math.sin(b.rot) * s * b.w * 0.33);
      scene.add(leg);
    }
  }

  // ---- palms, lamps, signals, furniture ---------------------------------
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.27, 4, 5); trunkGeo.translate(0, 2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7b5b3c, roughness: 0.95 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, city.palms.length);
  const frondGeo = palmFronds();
  const frondMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, city.palms.length);
  city.palms.forEach((p, i) => {
    let mm = new THREE.Matrix4(); mm.makeScale(p.s, p.s, p.s); mm.setPosition(p.x, 0, p.z);
    trunks.setMatrixAt(i, mm);
    mm = new THREE.Matrix4(); mm.makeRotationY(p.r); mm.multiply(new THREE.Matrix4().makeScale(p.s, p.s, p.s)); mm.setPosition(p.x, 3.9 * p.s, p.z);
    fronds.setMatrixAt(i, mm);
  });
  trunks.castShadow = true; fronds.castShadow = true; scene.add(trunks, fronds);

  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.2, 5); poleGeo.translate(0, 2.6, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x42484a, roughness: 0.75, metalness: 0.35 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, city.lamps.length);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleMat, city.lamps.length);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffdca0, emissive: 0xffb45e, emissiveIntensity: 5.5 });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 6, 5), bulbMat, city.lamps.length);
  const lampGlowPos = [], lampGlowCol = [];
  city.lamps.forEach((l, i) => {
    let mm = new THREE.Matrix4(); mm.makeTranslation(l.x, 0, l.z); poles.setMatrixAt(i, mm);
    const ax = l.x + Math.cos(l.rot) * 0.7, az = l.z + Math.sin(l.rot) * 0.7;
    mm = new THREE.Matrix4(); mm.makeRotationY(l.rot); mm.setPosition(l.x, 5.15, l.z); arms.setMatrixAt(i, mm);
    mm = new THREE.Matrix4(); mm.makeTranslation(ax, 5.15, az); bulbs.setMatrixAt(i, mm);
    lampGlowPos.push(ax, 5.1, az); lampGlowCol.push(1.0, 0.72, 0.36);
  });
  scene.add(poles, arms, bulbs);
  scene.add(makePoints(lampGlowPos, lampGlowCol, 3.2, glowTex, 1.1));

  const sigPoles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 3.6, 5), poleMat, city.signals.length);
  const sigBoxes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 1.0, 0.34), new THREE.MeshBasicMaterial({ map: TEX.signTexture('', '#15171a', '#64e07a'), toneMapped: false }), city.signals.length);
  city.signals.forEach((s, i) => {
    let mm = new THREE.Matrix4(); mm.makeTranslation(s.x, 1.8, s.z); sigPoles.setMatrixAt(i, mm);
    mm = new THREE.Matrix4(); mm.makeRotationY(s.rot); mm.setPosition(s.x, 3.1, s.z); sigBoxes.setMatrixAt(i, mm);
  });
  scene.add(sigPoles, sigBoxes);

  // benches, bins, hydrants, bus stops, market stalls
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6a45, roughness: 0.9 });
  const benchSeat = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.16, 0.6), woodMat, Math.max(1, city.benches.length));
  const benchBack = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.5, 0.12), woodMat, Math.max(1, city.benches.length));
  city.benches.forEach((b, i) => {
    let mm = new THREE.Matrix4(); mm.makeRotationY(b.rot); mm.setPosition(b.x, 0.62, b.z); benchSeat.setMatrixAt(i, mm);
    mm = new THREE.Matrix4(); mm.makeRotationY(b.rot); mm.setPosition(b.x, 0.92, b.z - Math.cos(b.rot) * 0.24); benchBack.setMatrixAt(i, mm);
  });
  benchSeat.count = benchBack.count = city.benches.length; scene.add(benchSeat, benchBack);
  instancedBoxes(scene, city.bins.map((b) => ({ x: b.x, y: 0.3, z: b.z, w: 0.55, h: 0.9, d: 0.55, color: 0x3c5146 })));
  instancedBoxes(scene, city.hydrants.map((h) => ({ x: h.x, y: 0.3, z: h.z, w: 0.28, h: 0.85, d: 0.28, color: 0xb23d33 })));
  for (const s of city.busStops) {
    const grp = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 0.1), new THREE.MeshStandardMaterial({ color: 0x9fc6c9, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.4 }));
    glass.position.y = 1.4; grp.add(glass);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 1.2), new THREE.MeshStandardMaterial({ color: 0xd6cbb4 }));
    roof.position.set(0, 2.55, 0.35); grp.add(roof);
    grp.position.set(s.x, 0.2, s.z); grp.rotation.y = s.rot; scene.add(grp);
  }
  const stallCloth = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.16, 1), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), Math.max(1, city.marketStalls.length));
  const stallTable = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.9, 1), woodMat, Math.max(1, city.marketStalls.length));
  city.marketStalls.forEach((s, i) => {
    let mm = new THREE.Matrix4(); mm.makeRotationY(s.rot); mm.setPosition(s.x, 2.4, s.z); mm.scale(new THREE.Vector3(2.6, 1, 2.0)); stallCloth.setMatrixAt(i, mm);
    mm = new THREE.Matrix4(); mm.makeRotationY(s.rot); mm.setPosition(s.x, 0.45, s.z); mm.scale(new THREE.Vector3(2.2, 1, 1.6)); stallTable.setMatrixAt(i, mm);
    stallCloth.setColorAt(i, new THREE.Color(s.color));
  });
  stallCloth.count = stallTable.count = city.marketStalls.length; scene.add(stallCloth, stallTable);

  // ---- beach, sea, pier, boats, lighthouse ------------------------------
  const beach = new THREE.Mesh(new THREE.BoxGeometry(2260, 0.5, 72), new THREE.MeshStandardMaterial({ map: sandTex, color: 0xe8d2a8, roughness: 1 }));
  beach.position.set(0, -0.1, 634); beach.receiveShadow = true; scene.add(beach);
  const promTex = concrete.clone(); promTex.wrapS = promTex.wrapT = THREE.RepeatWrapping; promTex.repeat.set(140, 3.2); promTex.needsUpdate = true;
  const promenade = new THREE.Mesh(new THREE.BoxGeometry(2260, 0.16, 44), new THREE.MeshStandardMaterial({ map: promTex, color: 0xc8b89c, roughness: 0.9 }));
  promenade.position.set(0, 0.04, 577); promenade.receiveShadow = true; scene.add(promenade);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x4c5557, roughness: 0.7, metalness: 0.35 });
  const rails = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.08, 1.15, 5), railMat, 280);
  for (let i = 0; i < 280; i++) { const m = new THREE.Matrix4(); m.makeTranslation(-1120 + i * 8, 0.7, 598.4); rails.setMatrixAt(i, m); }
  scene.add(rails);
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(2240, 0.1, 0.1), railMat); topRail.position.set(0, 1.25, 598.4); scene.add(topRail);
  const lotTex = asphalt.clone(); lotTex.wrapS = lotTex.wrapT = THREE.RepeatWrapping; lotTex.repeat.set(24, 4); lotTex.needsUpdate = true;
  const lot = new THREE.Mesh(new THREE.BoxGeometry(360, 0.12, 50), new THREE.MeshStandardMaterial({ map: lotTex, color: 0x8b8a82, roughness: 0.82 }));
  lot.position.set(-420, 0.07, 618); lot.receiveShadow = true; scene.add(lot);
  for (let i = 0; i < 13; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 9), markMat); s.position.set(-575 + i * 26, 0.14, 618); scene.add(s); }
  const seawall = new THREE.Mesh(new THREE.BoxGeometry(2260, 1.0, 1.6), new THREE.MeshStandardMaterial({ color: 0xc9bea8, roughness: 0.9 }));
  seawall.position.set(0, 0.3, 598); scene.add(seawall);
  for (const u of city.umbrellas) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 4), poleMat);
    pole.position.set(u.x, 1.1, u.z); scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.7, 7), new THREE.MeshStandardMaterial({ color: u.color, roughness: 0.9, side: THREE.DoubleSide }));
    top.position.set(u.x, 2.35, u.z); scene.add(top);
  }

  const water = makeWater();
  scene.add(water.mesh);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(2260, 5), new THREE.MeshBasicMaterial({ map: TEX.foamTexture(), transparent: true, opacity: 0.75, depthWrite: false, color: 0xfff4e6 }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.08, 668); scene.add(foam);

  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6b4c, roughness: 0.95 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(22, 0.5, 96), pierMat);
  pier.position.set(-486, 0.3, 704); scene.add(pier);

  const boatGrp = new THREE.Group();
  for (const b of city.boats) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(b.yacht ? 4.2 : 3.0, 1.1, b.yacht ? 13 : 8), new THREE.MeshStandardMaterial({ color: b.yacht ? 0xf2ead8 : 0xd8d2c2, roughness: 0.55, metalness: 0.1 }));
    hull.position.set(0, 0.2, 0); boatGrp.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(b.yacht ? 2.8 : 2.0, 1.3, b.yacht ? 4.4 : 2.6), new THREE.MeshStandardMaterial({ color: 0x4e6c74, roughness: 0.5 }));
    cab.position.set(0, 1.2, b.yacht ? -1 : 0); boatGrp.add(cab);
    if (b.yacht) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 9, 4), poleMat); mast.position.set(0, 5.0, -2.5); boatGrp.add(mast);
    }
    boatGrp.position.set(b.x, 0, b.z); boatGrp.rotation.y = b.rot; boatGrp.scale.setScalar(b.s);
    scene.add(boatGrp.clone());
  }
  scene.remove(boatGrp);

  const lh = city.lighthouse;
  const lhMat = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.8 });
  const lhRed = new THREE.MeshStandardMaterial({ color: 0xb5493f, roughness: 0.8 });
  const rock = new THREE.Mesh(new THREE.CylinderGeometry(13, 17, 3, 8), new THREE.MeshStandardMaterial({ color: 0x5b5a50, roughness: 1, flatShading: true }));
  rock.position.set(lh.x, 0.9, lh.z); rock.receiveShadow = true; scene.add(rock);
  const jetty = new THREE.Mesh(new THREE.BoxGeometry(26, 1.8, 104), new THREE.MeshStandardMaterial({ color: 0x8f8574, roughness: 0.95 }));
  jetty.position.set(lh.x, 0.5, lh.z + 36); jetty.receiveShadow = true; scene.add(jetty);
  for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.2, 5), new THREE.MeshStandardMaterial({ color: 0x3d4245 })); b.position.set(lh.x - 11 + i * 3.2, 1.9, lh.z + 80); scene.add(b); }
  const baseY = 2.4;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, lh.h, 8), lhMat);
  tower.position.set(lh.x, baseY + lh.h / 2, lh.z); tower.castShadow = true; scene.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.3, 3, 8), lhRed);
  band.position.set(lh.x, baseY + lh.h * 0.62, lh.z); scene.add(band);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 4 }));
  lantern.position.set(lh.x, baseY + lh.h + 0.7, lh.z); scene.add(lantern);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.6, 8), lhRed);
  cap.position.set(lh.x, baseY + lh.h + 2.2, lh.z); scene.add(cap);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(13, 80, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.rotation.z = Math.PI / 2; beam.position.set(lh.x, baseY + lh.h + 0.7, lh.z); scene.add(beam);

  // hills
  for (const h of city.hills) {
    const geo = new THREE.ConeGeometry(h.w / 2, h.h, 6);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: h.color, roughness: 1, flatShading: true }));
    mesh.position.set(h.x, h.h / 2 - 4, h.z); scene.add(mesh);
  }

  // gulls
  const gullMat = new THREE.MeshBasicMaterial({ color: 0xf4ece0, side: THREE.DoubleSide });
  const gulls = [];
  for (const g of city.gulls) {
    const bird = new THREE.Group();
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), gullMat);
    wing.rotation.x = -Math.PI / 2; bird.add(wing.clone(), wing.clone());
    bird.children[0].position.x = -0.7; bird.children[1].position.x = 0.7;
    bird.scale.setScalar(0.8 + rng.next() * 0.5);
    scene.add(bird); gulls.push({ bird, g });
  }

  // static glows: neon signs and windows are already emissive; street lamps use points above.
  const bloom = new Bloom(renderer, scene, camera);

  const clock = new THREE.Clock();
  let shadowTick = 0;
  const tmpV = new THREE.Vector3();

  const update = (dt, t, focus) => {
    water.uniforms.uTime.value = t;
    sky.position.copy(camera.position);
    sunSprite.position.copy(camera.position).add(tmpV.copy(sunDir).multiplyScalar(2200));
    sunCore.position.copy(sunSprite.position);
    foam.position.z = 668 + Math.sin(t * 0.7) * 1.2;
    beam.rotation.y = t * 0.45;
    for (const { bird, g } of gulls) {
      const a = t * 0.12 + g.ph;
      bird.position.set(g.x + Math.cos(a) * g.r, g.y + Math.sin(t * 0.8 + g.ph) * 1.2, g.z + Math.sin(a) * g.r);
      bird.rotation.y = -a + Math.PI / 2;
    }
    for (const c of clouds) c.position.x += dt * 1.6;
    if (focus) {
      sun.position.copy(focus).add(tmpV.copy(sunDir).multiplyScalar(300));
      sun.target.position.copy(focus);
      sun.target.updateMatrixWorld();
      if (++shadowTick % 4 === 0) renderer.shadowMap.needsUpdate = true;
    }
    bloom.setCamera(camera);
  };

  const render = () => bloom.render();
  const forceShadow = () => { renderer.shadowMap.needsUpdate = true; };
  return { renderer, scene, camera, city, sunDir, sun, water, bloom, update, render, forceShadow, sky, clouds, lighthouseBeam: beam };
}

// ---------- helpers --------------------------------------------------------

function buildingMaterial(seeds) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: sunDir },
      uSunCol: { value: new THREE.Color(0xffd0a0) },
      uFogColor: { value: new THREE.Color(CFG.palette.fog) },
      uFogNear: { value: 240 },
      uFogFar: { value: 2100 },
    },
    vertexShader: `
      attribute float aSeed;
      varying vec3 vLocal; varying vec3 vScale; varying vec3 vN; varying vec3 vW; varying float vSeed; varying vec3 vTint;
      void main(){
        vec3 p = position;
        vec4 wp = instanceMatrix * vec4(p, 1.0);
        vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vLocal = p; vSeed = aSeed; vTint = instanceColor;
        vN = normalize(mat3(instanceMatrix) * normal);
        vW = (modelMatrix * wp).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uSun, uSunCol, uFogColor; uniform float uFogNear, uFogFar;
      varying vec3 vLocal; varying vec3 vScale; varying vec3 vN; varying vec3 vW; varying float vSeed; varying vec3 vTint;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec3 n = normalize(vN);
        vec3 col;
        if (n.y > 0.55) {
          col = vTint * 0.38 + vec3(0.02,0.02,0.025);
          col *= 0.85 + 0.3 * h21(floor(vW.xz * 0.7));
        } else {
          float side = abs(n.x) > abs(n.z) ? 0.0 : 1.0;
          float width = side < 0.5 ? vScale.z : vScale.x;
          float u = side < 0.5 ? (vLocal.z + 0.5) * vScale.z : (vLocal.x + 0.5) * vScale.x;
          float y = vLocal.y * vScale.y;
          float winW = 2.5 + fract(vSeed * 7.13) * 0.9;
          float floorH = 3.5;
          vec2 g = vec2(u / winW, y / floorH);
          vec2 cell = floor(g); vec2 f = fract(g);
          vec2 aw = fwidth(g) * 0.85;
          float edge = min(u, width - u);
          float fx = smoothstep(0.16 - aw.x, 0.16 + aw.x, f.x) * (1.0 - smoothstep(0.84 - aw.x, 0.84 + aw.x, f.x));
          float fy = smoothstep(0.24 - aw.y, 0.24 + aw.y, f.y) * (1.0 - smoothstep(0.80 - aw.y, 0.80 + aw.y, f.y));
          float win = fx * fy;
          float detail = 1.0 - smoothstep(720.0, 1700.0, distance(vW, cameraPosition));
          win *= step(1.2, edge) * step(4.3, y) * detail;
          float ground = step(y, 4.2) * step(0.7, y);
          float shop = ground * step(0.06, f.x) * step(f.x, 0.94);
          float band = smoothstep(0.9, 1.0, f.y) * 0.16;
          col = vTint * (0.7 + 0.3 * h21(vec2(cell.x, vSeed * 3.0)));
          col *= 1.0 - band;
          vec3 glass = mix(vec3(0.07,0.14,0.17), vec3(0.35,0.55,0.58), h21(cell + vSeed));
          col = mix(col, glass, win * 0.62);
          float lit = step(0.74, h21(cell * 1.31 + vec2(vSeed * 11.0, side * 7.0)));
          vec3 wc = mix(vec3(1.0,0.63,0.3), vec3(0.48,0.76,1.0), step(0.62, h21(cell + 3.0)));
          float inten = 0.5 + 2.1 * h21(cell + 5.0);
          col += wc * win * lit * inten * 1.15;
          vec3 shopGlass = vec3(0.05,0.09,0.11);
          col = mix(col, shopGlass, shop * 0.7);
          col += vec3(1.0,0.62,0.28) * shop * (0.2 + 0.9 * h21(vec2(floor(u * 0.5), vSeed))) * 0.48;
        }
        float ndl = max(dot(n, normalize(uSun)), 0.0);
        vec3 lit = col * (0.52 + 0.78 * ndl) * mix(vec3(0.72,0.8,0.96), uSunCol, ndl * 0.75);
        float fog = smoothstep(uFogNear, uFogFar, distance(vW, cameraPosition));
        lit = mix(lit, uFogColor, fog);
        gl_FragColor = vec4(lit, 1.0);
      }`,
  });
}

function instancedBoxes(scene, list, material) {
  if (!list.length) return;
  const mat = material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, list.length);
  const m = new THREE.Matrix4();
  list.forEach((p, i) => {
    m.makeScale(p.w, p.h, p.d); m.setPosition(p.x, p.y + p.h / 2, p.z);
    mesh.setMatrixAt(i, m);
    if (mesh.instanceColor || p.color !== undefined) mesh.setColorAt(i, new THREE.Color(p.color ?? 0x9aa0a0));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

function palmFronds() {
  const pos = [], col = [];
  const c0 = new THREE.Color(0x315c2c), c1 = new THREE.Color(0x54823a), c2 = new THREE.Color(0x8cae52);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.18, len = 2.3 + (i % 3) * 0.55;
    const midX = Math.cos(a) * len * 0.48, midZ = Math.sin(a) * len * 0.48, midY = 0.72;
    const tipX = Math.cos(a) * len, tipZ = Math.sin(a) * len, tipY = -0.42 - (i % 2) * 0.3;
    const px = Math.cos(a + Math.PI / 2) * 0.26, pz = Math.sin(a + Math.PI / 2) * 0.26;
    const v = [
      [-px, 0, -pz], [px, 0, pz],
      [midX + px, midY, midZ + pz], [midX - px, midY, midZ - pz],
      [tipX, tipY, tipZ],
    ];
    const tri = [0, 1, 2, 0, 2, 3, 3, 2, 4];
    for (const k of tri) {
      pos.push(v[k][0], v[k][1], v[k][2]);
      const c = k === 4 ? c2 : k >= 2 ? c1 : c0;
      col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function makePoints(positions, colors, size, map, opacity = 1) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const m = new THREE.PointsMaterial({ size, map, vertexColors: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  return new THREE.Points(g, m);
}

function makeWater() {
  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: sunDir },
    uFogColor: { value: new THREE.Color(CFG.palette.fog) },
    uFogNear: { value: 240 },
    uFogFar: { value: 2100 },
    uDeep: { value: new THREE.Color(0x073b46) },
    uShallow: { value: new THREE.Color(0x139093) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime; varying vec3 vW;
      void main(){
        vec3 p = position;
        p.z += sin(p.x * 0.09 + uTime * 1.1) * 0.22 + sin(p.x * 0.21 - uTime * 0.7) * 0.12;
        vec4 wp = modelMatrix * vec4(p,1.0); vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime,uFogNear,uFogFar; uniform vec3 uSunDir,uFogColor,uDeep,uShallow; varying vec3 vW;
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        vec3 n = normalize(vec3(sin(vW.x*0.32+uTime*1.4)*0.09, 1.0, sin(vW.z*0.26-uTime*1.1)*0.09));
        float fres = pow(1.0 - max(dot(n,v),0.0), 3.0);
        vec3 col = mix(uDeep, uShallow, fres*0.85);
        float spec = pow(max(dot(reflect(-uSunDir,n),v),0.0), 90.0);
        col += vec3(1.0,0.72,0.4) * spec * 2.4;
        float spark = step(0.995, fract(sin(dot(floor(vW.xz*1.8), vec2(12.9898,78.233)) + uTime*0.6)*43758.5453));
        col += vec3(1.0,0.82,0.55) * spark * 0.55;
        float shore = smoothstep(660.0, 720.0, vW.z);
        col = mix(col, vec3(0.55,0.66,0.64), shore*0.22);
        float fog = smoothstep(uFogNear,uFogFar,distance(vW,cameraPosition));
        gl_FragColor = vec4(mix(col,uFogColor,fog),1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(7000, 4200, 90, 60), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, -0.28, 1800);
  return { mesh, uniforms };
}

// ---------- bloom ----------------------------------------------------------

class Bloom {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.w = 1280; this.h = 720;
    const opt = { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, depthBuffer: true };
    this.rtScene = new THREE.WebGLRenderTarget(this.w, this.h, opt);
    this.rtA = new THREE.WebGLRenderTarget(this.w / 2, this.h / 2, opt);
    this.rtB = new THREE.WebGLRenderTarget(this.w / 2, this.h / 2, opt);
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false; this.quadScene.add(this.quad);
    this.bright = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uThresh: { value: 0.78 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader: `uniform sampler2D tSrc; uniform float uThresh; varying vec2 vUv;
        void main(){ vec3 c=texture2D(tSrc,vUv).rgb; float l=max(c.r,max(c.g,c.b)); float k=max(l-uThresh,0.0)/max(l,0.001); gl_FragColor=vec4(c*k,1.0); }`,
      depthTest: false, depthWrite: false,
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uTexel: { value: new THREE.Vector2(1 / (this.w / 2), 1 / (this.h / 2)) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader: `uniform sampler2D tSrc; uniform vec2 uDir,uTexel; varying vec2 vUv;
        void main(){ vec2 o=uDir*uTexel; vec3 c=texture2D(tSrc,vUv).rgb*0.227;
          c+=texture2D(tSrc,vUv+o*1.3846).rgb*0.3162; c+=texture2D(tSrc,vUv-o*1.3846).rgb*0.3162;
          c+=texture2D(tSrc,vUv+o*3.2308).rgb*0.0702; c+=texture2D(tSrc,vUv-o*3.2308).rgb*0.0702;
          gl_FragColor=vec4(c,1.0); }`,
      depthTest: false, depthWrite: false,
    });
    this.comp = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: this.rtScene.texture }, tBloom: { value: this.rtB.texture }, uBloom: { value: 2.0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader: `uniform sampler2D tScene,tBloom; uniform float uBloom; varying vec2 vUv;
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
        void main(){ vec3 c=texture2D(tScene,vUv).rgb + texture2D(tBloom,vUv).rgb*uBloom; c=aces(c*1.32);
          gl_FragColor=vec4(pow(c,vec3(1.0/2.2)),1.0); }`,
      depthTest: false, depthWrite: false,
    });
    this.resize(this.w, this.h);
  }
  setCamera(cam) { this.camera = cam; }
  resize(w, h) {
    this.w = w; this.h = h;
    this.rtScene.setSize(w, h); this.rtA.setSize(w / 2, h / 2); this.rtB.setSize(w / 2, h / 2);
    this.blur.uniforms.uTexel.value.set(1 / (w / 2), 1 / (h / 2));
  }
  pass(mat, target) { this.quad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this.quadScene, this.quadCam); }
  render(t) {
    const r = this.renderer;
    r.setRenderTarget(this.rtScene); r.clear(); r.render(this.scene, this.camera);
    this.bright.uniforms.tSrc.value = this.rtScene.texture; this.pass(this.bright, this.rtA);
    this.blur.uniforms.tSrc.value = this.rtA.texture; this.blur.uniforms.uDir.value.set(1, 0); this.pass(this.blur, this.rtB);
    this.blur.uniforms.tSrc.value = this.rtB.texture; this.blur.uniforms.uDir.value.set(0, 1); this.pass(this.blur, this.rtA);
    this.comp.uniforms.tBloom.value = this.rtA.texture;
    this.quad.material = this.comp; r.setRenderTarget(null); r.render(this.quadScene, this.quadCam);
  }
}
