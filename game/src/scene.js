// scene.js — the three.js face of Bahía Cobalto. It turns the city data into merged, instanced
// geometry: sky, sea, roads, painted buildings, palms, props, landmarks, and the small particle
// effects the rest of the game borrows. One draw call per repeated thing; no network assets.
import * as THREE from 'three';
import { PALETTE, SUN_DIR, WORLD, SEED } from './config.js';
import { makeRng, range, pick, chance } from './rng.js';
import { SHOP_NAMES } from './city.js';

// ---------------------------------------------------------------------------------------------
// Small canvas textures. Everything is painted here, so the game carries no image files.

function canvasTexture(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

function noise(g, w, h, rng, count, alpha, light = true) {
  for (let i = 0; i < count; i += 1) {
    const v = Math.floor(range(rng, light ? 120 : 0, light ? 255 : 120));
    g.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    g.fillRect(range(rng, 0, w), range(rng, 0, h), range(rng, 1, 3), range(rng, 1, 3));
  }
}

function facadeTexture(style) {
  const rng = makeRng(SEED + style * 977);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = style === 0 ? '#b9c3c4' : style === 1 ? '#cfc8bc' : '#d8c1a4';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, rng, 500, 0.04, false);
    const cols = 4, rows = 4;
    const cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = c * cw, y = r * ch;
        if (style === 0) {
          // curtain wall: broad glass with mullions
          g.fillStyle = '#55767e';
          g.fillRect(x + 4, y + 4, cw - 8, ch - 10);
          g.fillStyle = 'rgba(255, 214, 146, 0.8)';
          if (rng() < 0.18) g.fillRect(x + 6, y + 6, cw - 12, ch - 14);
          g.fillStyle = 'rgba(220, 235, 232, 0.5)';
          g.fillRect(x + 4, y + 4, cw - 8, 2);
          g.fillRect(x + cw / 2 - 1, y + 4, 2, ch - 10);
          g.fillStyle = '#9aa8a6';
          g.fillRect(x, y + ch - 6, cw, 3);
        } else if (style === 1) {
          // punched windows with sills and a deep reveal
          g.fillStyle = '#e6ddcd';
          g.fillRect(x + 5, y + 4, cw - 10, ch - 12);
          g.fillStyle = '#3f5d66';
          g.fillRect(x + 9, y + 8, cw - 18, ch - 20);
          g.fillStyle = 'rgba(255, 205, 130, 0.85)';
          if (rng() < 0.26) g.fillRect(x + 9, y + 8, cw - 18, ch - 20);
          g.fillStyle = 'rgba(180, 220, 220, 0.35)';
          g.fillRect(x + 9, y + 8, cw - 18, 3);
          g.fillStyle = '#f2e9d6';
          g.fillRect(x + 6, y + ch - 8, cw - 12, 3);
          g.fillStyle = 'rgba(0,0,0,0.14)';
          g.fillRect(x + 9, y + ch - 5, cw - 18, 2);
        } else {
          // warm stucco: shutters and a small balcony rail
          g.fillStyle = '#b97852';
          g.fillRect(x + 8, y + 5, cw - 16, ch - 12);
          g.fillStyle = '#435c60';
          g.fillRect(x + 12, y + 9, cw - 24, ch - 20);
          g.fillStyle = 'rgba(255, 205, 130, 0.6)';
          if (rng() < 0.2) g.fillRect(x + 12, y + 9, cw - 24, ch - 20);
          g.fillStyle = '#7f4c35';
          g.fillRect(x + 5, y + 9, 5, ch - 20);
          g.fillRect(x + cw - 10, y + 9, 5, ch - 20);
          g.fillStyle = '#5b4a3c';
          g.fillRect(x + 4, y + ch - 7, cw - 8, 2);
          g.fillStyle = 'rgba(0,0,0,0.16)';
          g.fillRect(x, y + ch - 1, cw, 1);
        }
      }
      g.fillStyle = 'rgba(0,0,0,0.09)';
      g.fillRect(0, r * ch, w, 1);
    }
  });
}

function asphaltTexture(seed) {
  const rng = makeRng(seed);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#5d6269';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, rng, 900, 0.1);
    for (let i = 0; i < 22; i += 1) {
      g.strokeStyle = `rgba(12,14,18,${range(rng, 0.08, 0.22)})`;
      g.lineWidth = range(rng, 0.6, 1.6);
      g.beginPath();
      let x = range(rng, 0, w), y = range(rng, 0, h);
      g.moveTo(x, y);
      for (let s = 0; s < 4; s += 1) { x += range(rng, -18, 18); y += range(rng, -18, 18); g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,236,200,0.05)';
    g.fillRect(0, 0, w, h);
  }, 1, 1);
}

function pavingTexture(seed) {
  const rng = makeRng(seed);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#c0ad93';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, rng, 400, 0.07, false);
    for (let y = 0; y < h; y += 32) {
      for (let x = 0; x < w; x += 32) {
        const v = range(rng, -10, 10);
        g.fillStyle = `rgba(${190 + v},${170 + v},${145 + v},0.45)`;
        g.fillRect(x + 1, y + 1, 30, 30);
      }
    }
    g.strokeStyle = 'rgba(68,56,44,0.55)';
    for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }, 1, 1);
}

function sandTexture(seed) {
  const rng = makeRng(seed);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#e0c392';
    g.fillRect(0, 0, w, h);
    noise(g, w, h, rng, 1600, 0.08);
    for (let i = 0; i < 40; i += 1) {
      g.strokeStyle = `rgba(170,140,96,${range(rng, 0.08, 0.18)})`;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(range(rng, 0, w), range(rng, 0, h), range(rng, 12, 40), 0, Math.PI * 2);
      g.stroke();
    }
  }, 1, 1);
}

function glowTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,240,210,0.85)');
    grad.addColorStop(0.6, 'rgba(255,190,120,0.25)');
    grad.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

function softCircle() {
  return canvasTexture(64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

function cloudTexture(seed) {
  const rng = makeRng(seed);
  return canvasTexture(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 16; i += 1) {
      const x = range(rng, 30, w - 30), y = range(rng, 38, h - 26), r = range(rng, 16, 40);
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,248,232,0.75)');
      grad.addColorStop(1, 'rgba(255,248,232,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

function signAtlas(names) {
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#1b2529';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i += 1) {
      const cx = (i % 4) * 256, cy = Math.floor(i / 4) * 256;
      const colors = ['#b33f36', '#2b7f86', '#c08a2f', '#3b4e78', '#81523f', '#446a4f'];
      g.fillStyle = colors[i % colors.length];
      g.fillRect(cx + 4, cy + 4, 248, 248);
      g.fillStyle = 'rgba(10,14,16,0.5)';
      g.fillRect(cx + 12, cy + 12, 232, 232);
      g.fillStyle = '#f6ead8';
      g.font = '700 28px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const words = (names[i % names.length] || 'COBALTO').split(' ');
      if (words.length > 1) {
        g.fillText(words[0], cx + 128, cy + 104, 210);
        g.fillText(words.slice(1).join(' '), cx + 128, cy + 142, 210);
      } else {
        g.fillText(words[0], cx + 128, cy + 128, 210);
      }
      g.strokeStyle = 'rgba(246,234,216,0.55)';
      g.lineWidth = 3;
      g.strokeRect(cx + 10, cy + 10, 236, 236);
    }
  });
}

function billboardTexture(brand) {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = brand.color;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(0, h * 0.62, w, h * 0.38);
    for (let i = 0; i < 12; i += 1) {
      g.fillStyle = 'rgba(255,240,210,0.07)';
      g.fillRect(range(makeRng(SEED + i), 0, w), 0, 2, h);
    }
    g.fillStyle = '#f8ecd8';
    g.font = '800 58px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(brand.text, w / 2, h * 0.43, w - 48);
    g.font = '500 24px system-ui, sans-serif';
    g.fillStyle = 'rgba(248,236,216,0.9)';
    g.fillText(brand.sub, w / 2, h * 0.72, w - 60);
    g.strokeStyle = 'rgba(248,236,216,0.5)';
    g.lineWidth = 4;
    g.strokeRect(10, 10, w - 20, h - 20);
  });
}

// ---------------------------------------------------------------------------------------------
// Geometry batching. A box batch merges thousands of boxes into one BufferGeometry.

const FACE_DEFS = [
  { n: [1, 0, 0], a: [0.5, -0.5, -0.5], b: [0.5, 0.5, -0.5], c: [0.5, 0.5, 0.5], d: [0.5, -0.5, 0.5], u: 1, v: 1 },
  { n: [-1, 0, 0], a: [-0.5, -0.5, 0.5], b: [-0.5, 0.5, 0.5], c: [-0.5, 0.5, -0.5], d: [-0.5, -0.5, -0.5], u: 1, v: 1 },
  { n: [0, 1, 0], a: [-0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [0.5, 0.5, -0.5], d: [-0.5, 0.5, -0.5], u: 1, v: 1 },
  { n: [0, -1, 0], a: [-0.5, -0.5, -0.5], b: [0.5, -0.5, -0.5], c: [0.5, -0.5, 0.5], d: [-0.5, -0.5, 0.5], u: 1, v: 1 },
  { n: [0, 0, 1], a: [-0.5, -0.5, 0.5], b: [0.5, -0.5, 0.5], c: [0.5, 0.5, 0.5], d: [-0.5, 0.5, 0.5], u: 1, v: 1 },
  { n: [0, 0, -1], a: [0.5, -0.5, -0.5], b: [-0.5, -0.5, -0.5], c: [-0.5, 0.5, -0.5], d: [0.5, 0.5, -0.5], u: 1, v: 1 },
];

class GeoBatch {
  constructor() {
    this.pos = []; this.norm = []; this.uv = []; this.col = []; this.idx = []; this.n = 0;
  }

  quad(verts, normal, uvs, color) {
    const base = this.n;
    const c = new THREE.Color(color);
    for (let i = 0; i < 4; i += 1) {
      this.pos.push(verts[i][0], verts[i][1], verts[i][2]);
      this.norm.push(normal[0], normal[1], normal[2]);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(c.r, c.g, c.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.n += 4;
  }

  box(x, y, z, w, h, d, color, uvScale = 0, rotY = 0) {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    for (const f of FACE_DEFS) {
      const verts = [];
      for (const key of ['a', 'b', 'c', 'd']) {
        const p = f[key];
        const px = p[0] * w, py = p[1] * h, pz = p[2] * d;
        verts.push([x + px * c - pz * s, y + py, z + px * s + pz * c]);
      }
      const uMax = uvScale > 0 ? Math.max(w, d) / uvScale : 0;
      const vMax = uvScale > 0 ? h / uvScale : 0;
      const uvs = [[0, 0], [0, vMax], [uMax, vMax], [uMax, 0]];
      const nx = f.n[0] * c - f.n[2] * s;
      const nz = f.n[0] * s + f.n[2] * c;
      this.quad(verts, [nx, f.n[1], nz], uvs, color);
    }
  }

  build(material) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    if (this.uv.some((v) => v !== 0)) geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setIndex(this.idx);
    geo.computeBoundingSphere();
    return new THREE.Mesh(geo, material);
  }

  cylinder(x, y, z, radius, length, segments, color, axis = 'x') {
    const c = new THREE.Color(color);
    const half = length / 2;
    const rings = [];
    for (let side = 0; side < 2; side += 1) {
      const offset = side === 0 ? -half : half;
      const ring = [];
      for (let i = 0; i < segments; i += 1) {
        const a = (i / segments) * Math.PI * 2;
        if (axis === 'x') ring.push([x + offset, y + Math.cos(a) * radius, z + Math.sin(a) * radius, 1, Math.cos(a), Math.sin(a)]);
        else ring.push([x + Math.cos(a) * radius, y + offset, z + Math.sin(a) * radius, Math.cos(a), 1, Math.sin(a)]);
      }
      rings.push(ring);
    }
    for (let i = 0; i < segments; i += 1) {
      const a = rings[0][i], b = rings[0][(i + 1) % segments], cc = rings[1][(i + 1) % segments], d = rings[1][i];
      const normal = axis === 'x'
        ? [0, (a[4] + b[4]) / 2, (a[5] + b[5]) / 2]
        : [(a[3] + b[3]) / 2, 0, (a[5] + b[5]) / 2];
      this.quad([[a[0], a[1], a[2]], [b[0], b[1], b[2]], [cc[0], cc[1], cc[2]], [d[0], d[1], d[2]]], normal, [[0, 0], [1, 0], [1, 1], [0, 1]], color);
    }
    for (const ring of rings) {
      const base = this.n;
      const cx = axis === 'x' ? (ring[0][0] < x ? x - half : x + half) : x;
      const cy = axis === 'y' ? (ring[0][1] < y ? y - half : y + half) : y;
      const cz = z;
      this.pos.push(cx, cy, cz); this.norm.push(axis === 'x' ? (cx < x ? -1 : 1) : 0, axis === 'y' ? (cy < y ? -1 : 1) : 0, 0);
      this.uv.push(0, 0); this.col.push(c.r, c.g, c.b);
      for (let i = 0; i < segments; i += 1) {
        const p = ring[i];
        this.pos.push(p[0], p[1], p[2]);
        this.norm.push(axis === 'x' ? (cx < x ? -1 : 1) : 0, axis === 'y' ? (cy < y ? -1 : 1) : 0, 0);
        this.uv.push(0, 0); this.col.push(c.r, c.g, c.b);
      }
      for (let i = 1; i <= segments; i += 1) {
        const i2 = (i % segments) + 1;
        if (i === segments) this.idx.push(base, base + i, base + 1);
        else this.idx.push(base, base + i, base + i2);
      }
      this.n += segments + 1;
    }
  }
}

class SignBatch {
  constructor() { this.pos = []; this.uv = []; this.idx = []; this.n = 0; }

  add(x, y, z, w, h, rotY, u0, v0) {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    const uvs = [[u0, v0 + 0.25], [u0 + 0.25, v0 + 0.25], [u0 + 0.25, v0], [u0, v0]];
    const base = this.n;
    for (let i = 0; i < 4; i += 1) {
      const px = corners[i][0], py = corners[i][1];
      this.pos.push(x + px * c, y + py, z + px * s);
      this.uv.push(uvs[i][0], uvs[i][1]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.n += 4;
  }

  build(material) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setIndex(this.idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, material);
  }
}

// A palm: leaning ring trunk, a crown, nine drooping fronds. One geometry, instanced.
function palmGeometry() {
  const b = new GeoBatch();
  const rings = 7, sides = 6;
  const pts = [];
  for (let i = 0; i <= rings; i += 1) {
    const t = i / rings;
    const centerX = Math.sin(t * 1.15) * 0.62;
    const radius = 0.22 * (1 - t * 0.45);
    const ring = [];
    for (let s = 0; s < sides; s += 1) {
      const a = (s / sides) * Math.PI * 2;
      ring.push([centerX + Math.cos(a) * radius, t, Math.sin(a) * radius, Math.cos(a), 0, Math.sin(a)]);
    }
    pts.push(ring);
  }
  for (let i = 0; i < rings; i += 1) {
    for (let s = 0; s < sides; s += 1) {
      const a = pts[i][s], bb = pts[i][(s + 1) % sides], c = pts[i + 1][(s + 1) % sides], d = pts[i + 1][s];
      const shade = 0.55 + i * 0.045;
      b.quad(
        [[a[0], a[1], a[2]], [bb[0], bb[1], bb[2]], [c[0], c[1], c[2]], [d[0], d[1], d[2]]],
        [a[3], 0.2, a[5]],
        [[0, 0], [1, 0], [1, 1], [0, 1]],
        new THREE.Color(0.42 * shade, 0.30 * shade, 0.18 * shade),
      );
    }
  }
  // crown
  b.box(0.62, 1.02, 0, 0.42, 0.3, 0.42, 0x5a6b32, 0);
  for (let f = 0; f < 9; f += 1) {
    const a = (f / 9) * Math.PI * 2 + (f % 2) * 0.16;
    const len = 1.75 + (f % 3) * 0.22;
    const droop = 0.38 + (f % 4) * 0.08;
    const segs = 3;
    for (let s = 0; s < segs; s += 1) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      const w0 = 0.26 * (1 - t0 * 0.7), w1 = 0.26 * (1 - t1 * 0.7);
      const px0 = 0.62 + Math.cos(a) * len * t0, pz0 = Math.sin(a) * len * t0;
      const px1 = 0.62 + Math.cos(a) * len * t1, pz1 = Math.sin(a) * len * t1;
      const py0 = 1.08 + Math.sin(t0 * Math.PI) * 0.24 - t0 * t0 * droop;
      const py1 = 1.08 + Math.sin(t1 * Math.PI) * 0.24 - t1 * t1 * droop;
      const ox = Math.cos(a + Math.PI / 2), oz = Math.sin(a + Math.PI / 2);
      const green = 0.32 + 0.12 * Math.sin(f * 1.7) + s * 0.02;
      b.quad(
        [[px0 - ox * w0, py0, pz0 - oz * w0], [px0 + ox * w0, py0, pz0 + oz * w0],
          [px1 + ox * w1, py1, pz1 + oz * w1], [px1 - ox * w1, py1, pz1 - oz * w1]],
        [0, 1, 0],
        [[0, 0], [1, 0], [1, 1], [0, 1]],
        new THREE.Color(0.09, green, 0.10),
      );
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.norm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  geo.setIndex(b.idx);
  geo.computeBoundingSphere();
  return geo;
}

function streetLightGeometry() {
  const b = new GeoBatch();
  b.box(0, 3.1, 0, 0.16, 6.2, 0.16, 0x3b4147, 0);
  b.box(0, 6.1, 0.62, 0.14, 0.14, 1.3, 0x3b4147, 0);
  b.box(0, 6.0, 1.3, 0.5, 0.18, 0.28, 0x2a2f35, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.norm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  geo.setIndex(b.idx);
  geo.computeVertexNormals();
  return geo;
}

function benchGeometry() {
  const b = new GeoBatch();
  b.box(0, 0.45, 0, 1.7, 0.1, 0.55, 0x7d5a3c, 0);
  b.box(0, 0.72, -0.24, 1.7, 0.55, 0.08, 0x7d5a3c, 0);
  b.box(-0.7, 0.22, 0, 0.1, 0.45, 0.5, 0x3f4347, 0);
  b.box(0.7, 0.22, 0, 0.1, 0.45, 0.5, 0x3f4347, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.norm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  geo.setIndex(b.idx);
  geo.computeVertexNormals();
  return geo;
}

function stallGeometry() {
  const b = new GeoBatch();
  b.box(0, 0.7, 0, 2.6, 0.12, 1.2, 0x8f6b4a, 0);
  b.box(0, 0.35, 0, 2.6, 0.7, 0.12, 0x6d5139, 0);
  b.box(-1.2, 1.2, -0.5, 0.08, 2.4, 0.08, 0x5a4632, 0);
  b.box(1.2, 1.2, -0.5, 0.08, 2.4, 0.08, 0x5a4632, 0);
  b.box(-1.2, 2.35, 0.3, 0.08, 0.08, 1.7, 0x5a4632, 0);
  b.box(1.2, 2.35, 0.3, 0.08, 0.08, 1.7, 0x5a4632, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.norm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  geo.setIndex(b.idx);
  geo.computeVertexNormals();
  return geo;
}

function umbrellaGeometry() {
  const geo = new THREE.ConeGeometry(1.55, 0.5, 10, 1, true);
  geo.translate(0, 2.15, 0);
  return geo;
}

function containerGeometry() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  return geo;
}

// ---------------------------------------------------------------------------------------------
// Sky and water shaders are small and self-contained; they set the golden-hour mood.

function makeSky(scene) {
  const uniforms = {
    uTop: { value: new THREE.Color(PALETTE.skyTop) },
    uMid: { value: new THREE.Color(PALETTE.skyMid) },
    uHorizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    uSun: { value: new THREE.Color(PALETTE.sun) },
    uSunDir: { value: new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uTop, uMid, uHorizon, uSun, uSunDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.32, h));
        col = mix(col, uTop, smoothstep(0.22, 0.92, h));
        float d = max(dot(normalize(vDir), normalize(uSunDir)), 0.0);
        col += uSun * pow(d, 220.0) * 1.6;
        col += uSun * pow(d, 9.0) * 0.20;
        float horizonGlow = exp(-abs(vDir.y) * 9.0) * 0.22;
        col += vec3(1.0, 0.55, 0.25) * horizonGlow;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3600, 40, 24), mat);
  sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}

function makeWater(scene) {
  const geo = new THREE.PlaneGeometry(5200, 2100, 96, 44);
  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime;
      varying vec3 vW;
      void main() {
        vec3 p = position;
        p.z += sin(p.x * 0.055 + uTime * 0.9) * 0.20 + cos(p.y * 0.07 - uTime * 0.7) * 0.14;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vW;
      void main() {
        float depth = smoothstep(650.0, 2300.0, vW.z);
        vec3 shallow = vec3(0.12, 0.46, 0.48);
        vec3 deep = vec3(0.018, 0.13, 0.20);
        vec3 col = mix(shallow, deep, depth);
        float band = sin(vW.x * 0.055 + vW.z * 0.03 + uTime * 0.9) * 0.5 + 0.5;
        col += vec3(0.02, 0.07, 0.065) * band;
        float wave = sin(vW.z * 0.42 + uTime * 1.3 + sin(vW.x * 0.09)) * 0.5 + 0.5;
        col += vec3(0.04, 0.12, 0.12) * pow(wave, 5.0);
        float lane = exp(-pow((vW.x + 620.0) / 620.0, 2.0));
        float glit = pow(max(0.0, sin(vW.z * 0.30 - uTime * 1.5 + sin(vW.x * 0.16))), 26.0);
        col += vec3(1.0, 0.70, 0.34) * glit * lane * 0.85;
        float shore = smoothstep(725.0, 655.0, vW.z);
        float foam = shore * (0.45 + 0.55 * sin(vW.x * 0.16 + uTime * 1.7));
        col = mix(col, vec3(0.97, 0.95, 0.87), clamp(foam, 0.0, 1.0) * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const water = new THREE.Mesh(geo, mat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.18, 1680);
  water.receiveShadow = false;
  scene.add(water);
  return { water, uniforms };
}

function makeHills(scene) {
  const rng = makeRng(SEED + 77);
  const geo = new THREE.PlaneGeometry(2800, 420, 56, 16);
  const pos = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = (y + 210) / 420;
    const h = Math.pow(Math.max(0, t - 0.15) / 0.85, 1.4) * (42 + 28 * Math.sin(x * 0.0027) + 14 * Math.sin(x * 0.009 + 1.3));
    pos.setZ(i, h);
    const shade = 0.72 + t * 0.2 + 0.08 * Math.sin(x * 0.01);
    colors.push(0.36 * shade, 0.40 * shade, 0.25 * shade);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const hills = new THREE.Mesh(geo, mat);
  hills.rotation.x = -Math.PI / 2;
  hills.position.set(0, -0.6, -760);
  hills.receiveShadow = true;
  scene.add(hills);

  // A far ridge, flat-shaded and hazy, closes the northern horizon.
  const b = new GeoBatch();
  for (let i = 0; i < 12; i += 1) {
    const x = -1400 + i * 250 + range(rng, -40, 40);
    b.box(x, range(rng, 22, 45) / 2, -980 + range(rng, -40, 40), range(rng, 220, 360), range(rng, 30, 70), range(rng, 120, 220), 0x6b7357, 0, range(rng, -0.3, 0.3));
  }
  const ridge = b.build(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  ridge.receiveShadow = false;
  scene.add(ridge);

  // A few low islands and a container ship anchor the far horizon.
  const islandMat = new THREE.MeshLambertMaterial({ color: 0x5e6b4c, flatShading: true });
  for (const [ix, iz, ir, ih] of [[900, 1500, 140, 26], [180, 1780, 210, 18], [-720, 1620, 160, 22]]) {
    const island = new THREE.Mesh(new THREE.ConeGeometry(ir, ih, 7), islandMat);
    island.position.set(ix, ih / 2 - 1.2, iz);
    island.scale.z = 0.55;
    scene.add(island);
  }
  const horizonShip = new GeoBatch();
  horizonShip.box(430, 5.5, 1180, 26, 9, 120, 0x344b57, 0);
  horizonShip.box(430, 12.5, 1130, 20, 6, 20, 0xd9d2c3, 0);
  horizonShip.box(430, 7.5, 1210, 22, 4, 30, 0x9b3f37, 0);
  const shipMesh = horizonShip.build(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  scene.add(shipMesh);

  return hills;
}

// ---------------------------------------------------------------------------------------------
// Particle pools: sparks (additive points), smoke (soft points), flashes (sprites).

class ParticlePool {
  constructor(scene, count, texture, size, additive, opacity) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.grav = new Float32Array(count);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo = geo;
    this.mat = new THREE.PointsMaterial({
      size, map: texture, vertexColors: true, transparent: true, opacity,
      depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(x, y, z, color, count, speed, life, spread = 0.6, gravity = 9) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i += 1) {
      const k = this.cursor;
      this.cursor = (this.cursor + 1) % this.count;
      this.pos[k * 3] = x + range(Math.random, -spread, spread);
      this.pos[k * 3 + 1] = y + range(Math.random, -spread * 0.4, spread * 0.4);
      this.pos[k * 3 + 2] = z + range(Math.random, -spread, spread);
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
      const sp = speed * (0.35 + Math.random() * 0.65);
      this.vel[k * 3] = Math.cos(a) * Math.cos(b) * sp;
      this.vel[k * 3 + 1] = Math.abs(Math.sin(b)) * sp * 0.9 + speed * 0.15;
      this.vel[k * 3 + 2] = Math.sin(a) * Math.cos(b) * sp;
      this.col[k * 3] = c.r; this.col[k * 3 + 1] = c.g; this.col[k * 3 + 2] = c.b;
      this.life[k] = life * (0.5 + Math.random() * 0.6);
      this.maxLife[k] = this.life[k];
      this.grav[k] = gravity;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }

  update(dt) {
    let live = false;
    for (let i = 0; i < this.count; i += 1) {
      if (this.life[i] <= 0) continue;
      live = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.25; }
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.col[i * 3] *= 0.995;
      this.col[i * 3 + 1] *= 0.995;
      this.col[i * 3 + 2] *= 0.995;
      if (f <= 0) { this.pos[i * 3 + 1] = -999; }
    }
    if (live) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
  }

  burst(pos, color, count, opts = {}) {
    this.spawn(pos.x, pos.y, pos.z, color, count,
      opts.speed ?? 5, opts.life ?? 0.5, opts.spread ?? 0.3, opts.gravity ?? 10);
  }
}

// ---------------------------------------------------------------------------------------------

export { GeoBatch };

export function createWorld(scene, city) {
  const rng = makeRng(SEED + 31);
  const glow = glowTexture();
  const soft = softCircle();

  const plainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const emissiveMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true });
  const roadMat = new THREE.MeshLambertMaterial({ map: asphaltTexture(SEED + 1), vertexColors: true });
  roadMat.emissive = new THREE.Color(0x1b1d20);
  roadMat.emissiveIntensity = 0.75;
  const sidewalkMat = new THREE.MeshLambertMaterial({ map: pavingTexture(SEED + 2), vertexColors: true });
  sidewalkMat.emissive = new THREE.Color(0x161310);
  sidewalkMat.emissiveIntensity = 0.5;
  const sandMat = new THREE.MeshLambertMaterial({ map: sandTexture(SEED + 3) });
  const colorMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const facadeMats = [facadeTexture(0), facadeTexture(1), facadeTexture(2)].map((map) =>
    new THREE.MeshLambertMaterial({ map, vertexColors: true }));

  // Ground under the whole city and the beach.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 2100),
    new THREE.MeshLambertMaterial({ color: 0x8f7f68 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.08, -40);
  ground.receiveShadow = true;
  scene.add(ground);

  const beach = new THREE.Mesh(new THREE.PlaneGeometry(2400, 62), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.01, 669);
  beach.receiveShadow = true;
  scene.add(beach);
  const wetSand = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 7),
    new THREE.MeshLambertMaterial({ color: 0xb79a72 }),
  );
  wetSand.rotation.x = -Math.PI / 2;
  wetSand.position.set(0, 0.03, 698);
  scene.add(wetSand);

  // A wide promenade deck in La Marina and the boardwalk along the beach.
  const boardwalk = new GeoBatch();
  boardwalk.box(0, 0.13, 642, 2260, 0.26, 7, 0x9a7b56, 0);
  for (let x = -1120; x < 1120; x += 4) boardwalk.box(x, 0.27, 642, 0.08, 0.02, 6.8, 0x6d563d, 0);
  const bw = boardwalk.build(plainMat);
  bw.receiveShadow = true;
  scene.add(bw);

  const promenade = new GeoBatch();
  promenade.box(640, 0.12, 625, 760, 0.24, 28, 0xd0b995, 4);
  promenade.box(640, 0.26, 612, 760, 0.12, 1.8, 0xb99f7d, 2);
  const prom = promenade.build(sidewalkMat);
  prom.receiveShadow = true;
  scene.add(prom);

  // ---- roads, sidewalks, paint ---------------------------------------------------------------
  const asphalt = new GeoBatch();
  const walks = new GeoBatch();
  const curbs = new GeoBatch();
  const paint = new GeoBatch();
  const crosswalks = new GeoBatch();

  for (const road of city.roads) {
    const len = road.axis === 'z' ? road.z2 - road.z1 : road.x2 - road.x1;
    const cx = road.axis === 'z' ? road.x1 : (road.x1 + road.x2) / 2;
    const cz = road.axis === 'z' ? (road.z1 + road.z2) / 2 : road.z1;
    const w = road.axis === 'z' ? road.w : len;
    const d = road.axis === 'z' ? len : road.w;
    asphalt.box(cx, 0.02, cz, w, 0.12, d, 0x9aa0a6, 22);
    for (const side of [-1, 1]) {
      const off = road.w / 2 + WORLD.walkW / 2;
      if (road.axis === 'z') {
        walks.box(road.x1 + side * off, 0.09, cz, WORLD.walkW, 0.18, d, 0xc0ad93, 3.2);
        curbs.box(road.x1 + side * (road.w / 2 + 0.18), 0.16, cz, 0.36, 0.26, d, 0xd8cbb7, 0);
      } else {
        walks.box(cx, 0.09, road.z1 + side * off, w, 0.18, WORLD.walkW, 0xc0ad93, 3.2);
        curbs.box(cx, 0.16, road.z1 + side * (road.w / 2 + 0.18), w, 0.26, 0.36, 0xd8cbb7, 0);
      }
    }
    // centre line and lane dashes
    if (road.axis === 'z') {
      paint.box(road.x1 - 0.18, 0.09, cz, 0.12, 0.02, d - 20, PALETTE.lineYellow, 0);
      paint.box(road.x1 + 0.18, 0.09, cz, 0.12, 0.02, d - 20, PALETTE.lineYellow, 0);
      for (let t = -len / 2 + 14; t < len / 2 - 14; t += 9) {
        for (const side of [-1, 1]) {
          paint.box(road.x1 + side * road.w * 0.28, 0.095, cz + t, 0.13, 0.02, 4.2, PALETTE.lineWhite, 0);
        }
      }
    } else {
      paint.box(cx, 0.09, road.z1 - 0.18, w - 20, 0.02, 0.12, PALETTE.lineYellow, 0);
      paint.box(cx, 0.09, road.z1 + 0.18, w - 20, 0.02, 0.12, PALETTE.lineYellow, 0);
      for (let t = -len / 2 + 14; t < len / 2 - 14; t += 9) {
        for (const side of [-1, 1]) {
          paint.box(cx + t, 0.095, road.z1 + side * road.w * 0.28, 4.2, 0.02, 0.13, PALETTE.lineWhite, 0);
        }
      }
    }
  }

  // Crosswalks and stop lines at every intersection.
  for (const it of city.intersections) {
    for (const d of [-1, 1]) {
      for (let i = 0; i < 7; i += 1) {
        crosswalks.box(it.x + d * 8.6, 0.1, it.z - 5.2 + i * 1.7, 3.4, 0.02, 0.8, 0xf2e7cf, 0);
        crosswalks.box(it.x - 5.2 + i * 1.7, 0.1, it.z + d * 8.6, 0.8, 0.02, 3.4, 0xf2e7cf, 0);
      }
      crosswalks.box(it.x + d * 10.5, 0.1, it.z + d * 4.5, 0.5, 0.02, 9, 0xf2e7cf, 0);
    }
  }

  const roadMesh = asphalt.build(roadMat);
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);
  const walkMesh = walks.build(sidewalkMat);
  walkMesh.receiveShadow = true;
  scene.add(walkMesh);
  scene.add(curbs.build(plainMat));
  scene.add(paint.build(plainMat));
  scene.add(crosswalks.build(plainMat));

  // manholes and patches
  const manholeGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.035, 10);
  const manholeMat = new THREE.MeshLambertMaterial({ color: 0x24282d });
  const manholes = new THREE.InstancedMesh(manholeGeo, manholeMat, 90);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 90; i += 1) {
    const lane = city.lanes[i % city.lanes.length];
    const s = range(rng, 40, 1200);
    const p = city.lanePoint(lane, s);
    m4.makeTranslation(p.x + range(rng, -1, 1), 0.1, p.z + range(rng, -1, 1));
    manholes.setMatrixAt(i, m4);
  }
  manholes.receiveShadow = true;
  scene.add(manholes);

  const patchGeo = new THREE.PlaneGeometry(1, 1);
  const patchMat = new THREE.MeshLambertMaterial({ color: 0x2b2f35 });
  const patches = new THREE.InstancedMesh(patchGeo, patchMat, 70);
  for (let i = 0; i < 70; i += 1) {
    const lane = city.lanes[(i * 7) % city.lanes.length];
    const p = city.lanePoint(lane, range(rng, 40, 1100));
    const s = new THREE.Object3D();
    s.position.set(p.x + range(rng, -2, 2), 0.095, p.z + range(rng, -2, 2));
    s.rotation.x = -Math.PI / 2;
    s.rotation.z = range(rng, 0, Math.PI);
    s.scale.set(range(rng, 1.5, 5), range(rng, 1.2, 4), 1);
    s.updateMatrix();
    patches.setMatrixAt(i, s.matrix);
  }
  scene.add(patches);

  // ---- buildings -----------------------------------------------------------------------------
  const facadeBatches = [new GeoBatch(), new GeoBatch(), new GeoBatch()];
  const roofBatch = new GeoBatch();
  const awningBatch = new GeoBatch();
  const shopGlowBatch = new GeoBatch();
  const signBatch = new SignBatch();
  const litWindows = [];

  for (const b of city.buildings) {
    const batch = facadeBatches[b.style] || facadeBatches[0];
    batch.box(b.x, b.h / 2 + 0.1, b.z, b.w, b.h, b.d, b.tint, 11.5);
    roofBatch.box(b.x, b.h + 0.35, b.z, b.w + 0.7, 0.7, b.d + 0.7, 0x8c8072, 0);
    // a setback tower breaks the box silhouette on the taller blocks
    if (b.h > 34 && b.w > 22 && b.d > 22 && rng() < 0.6) {
      const tw = b.w * range(rng, 0.52, 0.7), td = b.d * range(rng, 0.52, 0.7);
      batch.box(b.x, b.h + 5.2, b.z, tw, 10, td, b.tint, 11.5);
      roofBatch.box(b.x, b.h + 10.6, b.z, tw + 0.6, 0.6, td + 0.6, 0x8c8072, 0);
      roofBatch.box(b.x + 1.4, b.h + 11.6, b.z, 2.4, 1.2, 2.0, 0x7d8488, 0);
    }
    // a vertical accent band on the street face
    if (b.h > 24 && rng() < 0.55) {
      const nearAccent = city.nearestRoad(b.x, b.z).road;
      const ax = nearAccent.axis === 'z' ? (nearAccent.x1 > b.x ? 1 : -1) : 0;
      const az = nearAccent.axis === 'x' ? (nearAccent.z1 > b.z ? 1 : -1) : 0;
      roofBatch.box(
        ax !== 0 ? b.x + ax * (b.w / 2 + 0.08) : b.x + range(rng, -b.w * 0.2, b.w * 0.2),
        b.h * 0.52,
        az !== 0 ? b.z + az * (b.d / 2 + 0.08) : b.z + range(rng, -b.d * 0.2, b.d * 0.2),
        ax !== 0 ? 0.3 : 1.6, b.h * 0.82, az !== 0 ? 0.3 : 1.6,
        pick(rng, [0x8c4a3c, 0x2f5d62, 0xc49a52, 0x5a4d6b]), 0,
      );
    }
    if (b.roof.ac) {
      roofBatch.box(b.x + range(rng, -b.w / 3, b.w / 3), b.h + 1.35, b.z + range(rng, -b.d / 3, b.d / 3), 2.2, 1.1, 1.8, 0x7d8488, 0);
    }
    if (b.roof.tank) {
      roofBatch.box(b.x, b.h + 2.7, b.z, 2.2, 2.2, 2.2, 0x9a8a70, 0);
      roofBatch.box(b.x - 0.7, b.h + 1.0, b.z - 0.7, 0.18, 1.4, 0.18, 0x5c554b, 0);
      roofBatch.box(b.x + 0.7, b.h + 1.0, b.z + 0.7, 0.18, 1.4, 0.18, 0x5c554b, 0);
    }
    if (b.roof.antenna) {
      roofBatch.box(b.x, b.h + 3.4, b.z, 0.12, 5.5, 0.12, 0x5a5f63, 0);
    }

    // Which street is this lot facing?
    const near = city.nearestRoad(b.x, b.z);
    const road = near.road;
    let nx = 0, nz = 0;
    if (road.axis === 'z') {
      nx = road.x1 >= b.x ? 1 : -1;
    } else {
      nz = road.z1 >= b.z ? 1 : -1;
    }
    const faceX = b.x + nx * (b.w / 2 + 0.18);
    const faceZ = b.z + nz * (b.d / 2 + 0.18);
    const rotY = nx !== 0 ? Math.PI / 2 : 0;

    if (b.shop) {
      const aw = nx !== 0 ? 2.4 : Math.min(b.w * 0.7, 7);
      const ad = nx !== 0 ? Math.min(b.d * 0.7, 7) : 2.4;
      awningBatch.box(
        nx !== 0 ? b.x + nx * (b.w / 2 + 1.1) : b.x,
        3.15,
        nz !== 0 ? b.z + nz * (b.d / 2 + 1.1) : b.z,
        nx !== 0 ? 2.0 : aw, 0.26, nx !== 0 ? ad : 2.0,
        pick(rng, [0xc95545, 0x2d8787, 0xd2a03e, 0x476b8c, 0x7c4e3c]), 0,
      );
      const gw = nx !== 0 ? 0.14 : Math.min(b.w * 0.55, 6);
      const gd = nx !== 0 ? Math.min(b.d * 0.55, 6) : 0.14;
      shopGlowBatch.box(
        nx !== 0 ? b.x + nx * (b.w / 2 + 0.05) : b.x,
        1.95,
        nz !== 0 ? b.z + nz * (b.d / 2 + 0.05) : b.z,
        gw, 2.1, gd, 0xffd08a, 0,
      );
      const idx = Math.floor(rng() * 16);
      const signRot = nx !== 0 ? (nx > 0 ? Math.PI / 2 : -Math.PI / 2) : (nz > 0 ? 0 : Math.PI);
      signBatch.add(
        nx !== 0 ? b.x + nx * (b.w / 2 + 0.22) : b.x,
        4.55,
        nz !== 0 ? b.z + nz * (b.d / 2 + 0.22) : b.z,
        Math.min(nx !== 0 ? b.d * 0.55 : b.w * 0.55, 7.5), 1.5,
        signRot,
        (idx % 4) * 0.25, Math.floor(idx / 4) * 0.25,
      );
    }

    if (b.balcony) {
      for (let f = 3; f < b.floors - 1; f += 3) {
        const y = f * 3.4 + 0.4;
        roofBatch.box(
          nx !== 0 ? b.x + nx * (b.w / 2 + 0.45) : b.x,
          y,
          nz !== 0 ? b.z + nz * (b.d / 2 + 0.45) : b.z,
          nx !== 0 ? 0.9 : b.w * 0.5, 0.14, nx !== 0 ? b.d * 0.5 : 0.9, 0xd7c8b2, 0,
        );
        roofBatch.box(
          nx !== 0 ? b.x + nx * (b.w / 2 + 0.86) : b.x,
          y + 0.45,
          nz !== 0 ? b.z + nz * (b.d / 2 + 0.86) : b.z,
          nx !== 0 ? 0.08 : b.w * 0.5, 0.75, nx !== 0 ? b.d * 0.5 : 0.08, 0x8f8070, 0,
        );
      }
    }

    // warm lit windows on the street face
    if (b.h > 10) {
      const count = 3 + Math.floor(b.d * b.h / 380);
      for (let i = 0; i < count; i += 1) {
        const floor = 2 + Math.floor(rng() * Math.max(1, b.floors - 3));
        const along = range(rng, -0.4, 0.4);
        const y = floor * 3.4 + 1.6;
        litWindows.push({
          x: nx !== 0 ? b.x + nx * (b.w / 2 + 0.08) : b.x + along * b.w,
          y,
          z: nz !== 0 ? b.z + nz * (b.d / 2 + 0.08) : b.z + along * b.d,
          rot: nx !== 0 ? Math.PI / 2 : 0,
        });
      }
    }
  }

  const buildingsRoot = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const mesh = facadeBatches[i].build(facadeMats[i]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    buildingsRoot.add(mesh);
  }
  const roofs = roofBatch.build(plainMat);
  roofs.castShadow = true;
  roofs.receiveShadow = true;
  buildingsRoot.add(roofs);
  const awnings = awningBatch.build(plainMat);
  awnings.castShadow = true;
  buildingsRoot.add(awnings);
  buildingsRoot.add(shopGlowBatch.build(emissiveMat));
  scene.add(buildingsRoot);

  const signMesh = signBatch.build(new THREE.MeshBasicMaterial({ map: signAtlas(SHOP_NAMES), toneMapped: true }));
  scene.add(signMesh);

  // lit windows: one instanced quad
  if (litWindows.length) {
    const winGeo = new THREE.PlaneGeometry(0.95, 1.35);
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: true });
    const wins = new THREE.InstancedMesh(winGeo, winMat, litWindows.length);
    const d = new THREE.Object3D();
    litWindows.forEach((w, i) => {
      d.position.set(w.x, w.y, w.z);
      d.rotation.set(0, w.rot, 0);
      d.updateMatrix();
      wins.setMatrixAt(i, d.matrix);
    });
    scene.add(wins);
  }

  // ---- palm trees ----------------------------------------------------------------------------
  const palmGeo = palmGeometry();
  const palmMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, city.palms.length);
  const tmp = new THREE.Object3D();
  city.palms.forEach((p, i) => {
    tmp.position.set(p.x, 0, p.z);
    tmp.rotation.set(0, p.rot, p.lean);
    tmp.scale.set(range(rng, 2.1, 2.8), p.h, range(rng, 2.1, 2.8));
    tmp.updateMatrix();
    palms.setMatrixAt(i, tmp.matrix);
  });
  palms.castShadow = true;
  palms.receiveShadow = true;
  scene.add(palms);

  // ---- street lamps, lamps glow, signals -----------------------------------------------------
  const lightGeo = streetLightGeometry();
  const lightMesh = new THREE.InstancedMesh(lightGeo, plainMat, city.lights.length);
  const lampPositions = [];
  city.lights.forEach((l, i) => {
    tmp.position.set(l.x, 0, l.z);
    tmp.rotation.set(0, l.rot, 0);
    tmp.scale.set(1, 1, 1);
    tmp.updateMatrix();
    lightMesh.setMatrixAt(i, tmp.matrix);
    const fx = Math.sin(l.rot) * 1.3, fz = Math.cos(l.rot) * 1.3;
    lampPositions.push(l.x + fx, 6.0, l.z + fz);
  });
  lightMesh.castShadow = true;
  scene.add(lightMesh);

  const lampGeo = new THREE.BufferGeometry();
  lampGeo.setAttribute('position', new THREE.Float32BufferAttribute(lampPositions, 3));
  const lampMat = new THREE.PointsMaterial({
    size: 3.4, map: glow, color: 0xffd7a0, transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  scene.add(new THREE.Points(lampGeo, lampMat));

  // traffic light poles, with one glowing point per signal
  const tlBatch = new GeoBatch();
  for (const t of city.trafficLights) {
    tlBatch.box(t.x, 2.4, t.z, 0.18, 4.8, 0.18, 0x353a40, 0);
    tlBatch.box(t.x, 4.7, t.z, 1.1, 0.18, 0.18, 0x353a40, 0);
    tlBatch.box(t.x + 0.5, 4.45, t.z, 0.28, 0.5, 0.28, 0x24282d, 0);
  }
  const tlMesh = tlBatch.build(plainMat);
  tlMesh.castShadow = true;
  scene.add(tlMesh);
  const signalPositions = [];
  const signalColors = [];
  for (const t of city.trafficLights) {
    signalPositions.push(t.x + 0.5, 4.55, t.z);
    const c = new THREE.Color(chance(rng, 0.5) ? 0xff4d4d : 0x4dff9d);
    signalColors.push(c.r, c.g, c.b);
  }
  const sigGeo = new THREE.BufferGeometry();
  sigGeo.setAttribute('position', new THREE.Float32BufferAttribute(signalPositions, 3));
  sigGeo.setAttribute('color', new THREE.Float32BufferAttribute(signalColors, 3));
  scene.add(new THREE.Points(sigGeo, new THREE.PointsMaterial({
    size: 1.1, map: glow, vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  })));

  // ---- benches, bins, hydrants, stalls ------------------------------------------------------
  const addInstances = (geo, material, items, place, color) => {
    if (!items.length) return null;
    const mesh = new THREE.InstancedMesh(geo, material, items.length);
    items.forEach((item, i) => {
      place(item, tmp);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
      if (color) mesh.setColorAt(i, new THREE.Color(color(item)));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  addInstances(benchGeometry(), plainMat, city.benches, (b, o) => {
    o.position.set(b.x, 0.18, b.z); o.rotation.set(0, b.rot, 0); o.scale.set(1, 1, 1);
  });
  addInstances(new THREE.CylinderGeometry(0.35, 0.32, 1.0, 8), colorMat, city.bins, (b, o) => {
    o.position.set(b.x, 0.62, b.z); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
  }, () => 0x3f5a4c);
  addInstances(new THREE.CylinderGeometry(0.22, 0.24, 0.75, 7), colorMat, city.hydrants, (h, o) => {
    o.position.set(h.x, 0.5, h.z); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
  }, () => 0xb84f3f);
  addInstances(stallGeometry(), plainMat, city.stalls, (s, o) => {
    o.position.set(s.x, 0.18, s.z); o.rotation.set(0, s.rot, 0); o.scale.set(1, 1, 1);
  }, (s) => s.color);

  // stall awnings (striped by tint) as one more instanced batch
  const awningGeo = new THREE.BoxGeometry(1, 1, 1);
  addInstances(awningGeo, plainMat, city.stalls, (s, o) => {
    o.position.set(s.x, 2.42, s.z); o.rotation.set(0, s.rot, 0); o.scale.set(2.7, 0.1, 1.9);
  }, (s) => s.awning);

  // ---- beach umbrellas ----------------------------------------------------------------------
  const umbGeo = umbrellaGeometry();
  const umbMat = new THREE.MeshLambertMaterial({ flatShading: true, side: THREE.DoubleSide });
  const umbrellas = new THREE.InstancedMesh(umbGeo, umbMat, city.umbrellas.length);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 2.0, 6), poleMat, city.umbrellas.length);
  city.umbrellas.forEach((u, i) => {
    tmp.position.set(u.x, 0.03, u.z);
    tmp.rotation.set(u.tilt, 0, u.tilt * 0.5);
    tmp.scale.set(1, 1, 1);
    tmp.updateMatrix();
    umbrellas.setMatrixAt(i, tmp.matrix);
    umbrellas.setColorAt(i, new THREE.Color(u.color));
    tmp.position.set(u.x, 1.0, u.z); tmp.rotation.set(0, 0, 0); tmp.updateMatrix();
    poles.setMatrixAt(i, tmp.matrix);
  });
  umbrellas.castShadow = true;
  scene.add(umbrellas);
  scene.add(poles);

  // beach towels: tiny bright planes
  const towelGeo = new THREE.PlaneGeometry(1, 2);
  const towels = new THREE.InstancedMesh(towelGeo, new THREE.MeshLambertMaterial({ vertexColors: false }), 70);
  for (let i = 0; i < 70; i += 1) {
    tmp.position.set(range(rng, -1050, 1050), 0.06, range(rng, 648, 694));
    tmp.rotation.set(-Math.PI / 2, 0, range(rng, 0, Math.PI));
    tmp.scale.set(1, 1, 1);
    tmp.updateMatrix();
    towels.setMatrixAt(i, tmp.matrix);
    towels.setColorAt(i, new THREE.Color(pick(rng, [0xe45d4f, 0xf0c24f, 0x4aa7a0, 0xe58bad, 0xf4e4c4])));
  }
  scene.add(towels);

  // ---- marina docks and boats ---------------------------------------------------------------
  const dockBatch = new GeoBatch();
  for (const d of city.docks) {
    dockBatch.box(d.x, 0.1, d.z, d.w, 0.22, d.d, 0x9b7a55, 0);
    for (let i = 0; i < 7; i += 1) dockBatch.box(d.x, 0.2, d.z - d.d / 2 + 3 + i * 4.5, d.w, 0.06, 0.35, 0x6d563d, 0);
  }
  // sea wall / railing along the promenade
  dockBatch.box(640, 0.55, 642, 760, 0.35, 0.4, 0xcdbb9e, 0);
  dockBatch.box(640, 1.2, 642, 760, 0.08, 0.08, 0x4b555a, 0);
  for (let x = 280; x <= 1000; x += 6) dockBatch.box(x, 0.85, 642, 0.08, 0.75, 0.08, 0x4b555a, 0);
  const dockMesh = dockBatch.build(plainMat);
  dockMesh.receiveShadow = true;
  scene.add(dockMesh);

  const boats = [];
  for (const b of city.boats) {
    const bb = new GeoBatch();
    const big = b.len > 30;
    const hullColor = big ? 0x2f5566 : b.hull;
    bb.box(0, 0.55, 0, b.beam, 0.8, b.len, hullColor, 0);
    bb.box(0, 0.2, b.len * 0.28, b.beam * 0.8, 0.4, b.len * 0.32, hullColor, 0);
    bb.box(0, 0.52, 0, b.beam + 0.06, 0.12, b.len * 0.82, 0xe8e0cc, 0);
    bb.box(0, 1.2, -b.len * 0.06, b.beam * 0.62, 0.75, b.len * 0.34, b.cabin, 0);
    bb.box(0, 1.72, -b.len * 0.06, b.beam * 0.68, 0.12, b.len * 0.38, 0x9fb4b2, 0);
    // dark glass band and a windshield make the silhouette read as a vessel, not a dock
    bb.box(0, 1.3, -b.len * 0.06, b.beam * 0.64, 0.3, b.len * 0.3, 0x1d2a33, 0);
    bb.box(0, 1.28, b.len * 0.115, b.beam * 0.5, 0.3, 0.08, 0x24343c, 0);
    const mastH = b.len >= 36 ? 15 : b.len > 15 ? 6.8 : 2.6;
    bb.box(0, mastH / 2 + 1, -b.len * 0.02, 0.12, mastH, 0.12, 0xd9d2c3, 0);
    if (b.len >= 36) {
      bb.quad(
        [[0, 2.2, -2.6], [0, 15, -2.6], [0, 2.2, 4.6], [0, 2.2, 4.6]],
        [1, 0, 0],
        [[0, 0], [0, 1], [1, 0], [1, 0]],
        0xf7f0de,
      );
      bb.quad(
        [[0, 2.2, 4.6], [0, 15, -2.6], [0, 2.2, -2.6], [0, 2.2, -2.6]],
        [-1, 0, 0],
        [[0, 0], [0, 1], [1, 0], [1, 0]],
        0xf7f0de,
      );
      bb.box(0, 15.2, 0.8, 0.1, 0.5, 2.6, 0xd94f45, 0);
    }
    if (b.len > 15) {
      bb.box(0, 4.6, -b.len * 0.02, 0.08, 4.2, 1.6, 0xf4ecdc, 0);
      bb.box(0, 6.5, -b.len * 0.02, 0.1, 0.6, 1.2, 0xe45d4f, 0);
    }
    bb.box(0, 0.9, -b.len * 0.44, b.beam * 0.5, 0.5, 0.3, 0x3f5a66, 0);
    const mesh = bb.build(plainMat);
    mesh.position.set(b.x, 0, b.z);
    mesh.rotation.y = b.rot;
    mesh.castShadow = true;
    scene.add(mesh);
    boats.push({ mesh, baseY: 0, phase: rng() * Math.PI * 2 });
  }

  // ---- docks: containers, cranes, cargo ship -------------------------------------------------
  const contMesh = new THREE.InstancedMesh(containerGeometry(), new THREE.MeshLambertMaterial({ vertexColors: false }), city.containers.length);
  city.containers.forEach((c, i) => {
    tmp.position.set(c.x, c.h / 2 + 0.1, c.z);
    tmp.rotation.set(0, c.rot, 0);
    tmp.scale.set(c.w, c.h, c.d);
    tmp.updateMatrix();
    contMesh.setMatrixAt(i, tmp.matrix);
    contMesh.setColorAt(i, new THREE.Color(c.color));
  });
  contMesh.castShadow = true;
  contMesh.receiveShadow = true;
  scene.add(contMesh);

  const craneBatch = new GeoBatch();
  for (const c of city.cranes) {
    craneBatch.box(c.x - 4, c.h / 2, c.z, 1.1, c.h, 1.1, 0xd8b23c, 0);
    craneBatch.box(c.x + 4, c.h / 2, c.z, 1.1, c.h, 1.1, 0xd8b23c, 0);
    craneBatch.box(c.x, c.h, c.z, 9.2, 1.2, 1.4, 0xd8b23c, 0);
    craneBatch.box(c.x + 7, c.h - 2, c.z, 16, 0.8, 0.9, 0xd8b23c, 0);
    craneBatch.box(c.x + 14, c.h - 4, c.z, 0.25, 4, 0.25, 0x4a4f52, 0);
    craneBatch.box(c.x + 14, c.h - 6.2, c.z, 2.4, 1.2, 2.4, 0x8a6a3f, 0);
  }
  const craneMesh = craneBatch.build(plainMat);
  craneMesh.castShadow = true;
  scene.add(craneMesh);

  const shipBatch = new GeoBatch();
  shipBatch.box(-760, 3.0, 745, 34, 8, 105, 0x344b57, 0);
  shipBatch.box(-760, 7.6, 700, 26, 4, 20, 0xd9d2c3, 0);
  shipBatch.box(-760, 10.4, 704, 8, 4, 8, 0x9b3f37, 0);
  for (let i = 0; i < 5; i += 1) shipBatch.box(-760, 8.4, 660 + i * 13, 20, 4, 10, pick(rng, [0xc94f43, 0x3f7f8f, 0xd6a63c]), 0);
  const ship = shipBatch.build(plainMat);
  ship.castShadow = true;
  scene.add(ship);

  // ---- rocks and the lighthouse -------------------------------------------------------------
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0x6d6659, flatShading: true }), city.rocks.length);
  city.rocks.forEach((r, i) => {
    tmp.position.set(r.x, r.s * 0.3, r.z);
    tmp.rotation.set(range(rng, 0, 3), range(rng, 0, 3), 0);
    tmp.scale.set(r.s, r.s * 0.7, r.s);
    tmp.updateMatrix();
    rocks.setMatrixAt(i, tmp.matrix);
  });
  rocks.castShadow = true;
  scene.add(rocks);

  const lh = city.lighthouse;
  const lighthouse = new THREE.Group();
  const lhColors = [0xe8ddc8, 0xb84f3f];
  for (let i = 0; i < 7; i += 1) {
    const r0 = 3.2 - i * 0.28, r1 = 3.0 - i * 0.28;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(r1, r0, 5.2, 10),
      new THREE.MeshLambertMaterial({ color: lhColors[i % 2], flatShading: true }),
    );
    seg.position.set(lh.x, 2.6 + i * 5.2, lh.z);
    seg.castShadow = true;
    lighthouse.add(seg);
  }
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 2.2, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe6a8 }),
  );
  lampRoom.position.set(lh.x, 38.4, lh.z);
  lighthouse.add(lampRoom);
  const lhBeam = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 22, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  lhBeam.rotation.z = Math.PI / 2;
  const beamPivot = new THREE.Group();
  beamPivot.position.set(lh.x, 38, lh.z);
  lhBeam.position.set(11, 0, 0);
  beamPivot.add(lhBeam);
  lighthouse.add(beamPivot);
  scene.add(lighthouse);
  const lighthouseGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glow, color: 0xffd58a, transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  lighthouseGlow.position.set(lh.x, 38.4, lh.z);
  lighthouseGlow.scale.set(34, 34, 1);
  scene.add(lighthouseGlow);
  // ---- the radio mast on Cerro Alto ---------------------------------------------------------
  const mastGroup = new THREE.Group();
  const mastBatch = new GeoBatch();
  const mh = city.mast.h;
  for (let i = 0; i < 6; i += 1) {
    const y0 = (i / 6) * mh, y1 = ((i + 1) / 6) * mh;
    const w = 3.2 * (1 - i / 8);
    mastBatch.box(city.mast.x - w, (y0 + y1) / 2, city.mast.z, 0.2, y1 - y0, 0.2, 0x8f3f38, 0);
    mastBatch.box(city.mast.x + w, (y0 + y1) / 2, city.mast.z, 0.2, y1 - y0, 0.2, 0x8f3f38, 0);
    mastBatch.box(city.mast.x, (y0 + y1) / 2, city.mast.z - w, 0.2, y1 - y0, 0.2, 0x8f3f38, 0);
    mastBatch.box(city.mast.x, (y0 + y1) / 2, city.mast.z + w, 0.2, y1 - y0, 0.2, 0x8f3f38, 0);
    mastBatch.box(city.mast.x, y1, city.mast.z, w * 2, 0.14, w * 2, 0xbdb6a6, 0);
  }
  mastBatch.box(city.mast.x, mh + 1.4, city.mast.z, 0.16, 3, 0.16, 0xbdb6a6, 0);
  const mastMesh = mastBatch.build(plainMat);
  mastMesh.castShadow = true;
  mastGroup.add(mastMesh);
  const mastLight = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  mastLight.position.set(city.mast.x, mh + 3.2, city.mast.z);
  mastGroup.add(mastLight);
  scene.add(mastGroup);

  // ---- warehouses and the villa --------------------------------------------------------------
  const landmarkBatch = new GeoBatch();
  for (const p of [{ x: -650, z: 548, w: 54, d: 36, h: 13 }, { x: 760, z: 500, w: 46, d: 30, h: 12 }]) {
    landmarkBatch.box(p.x, p.h / 2, p.z, p.w, p.h, p.d, 0x8b9a95, 0);
    landmarkBatch.box(p.x, p.h + 0.6, p.z, p.w + 1, 1.2, p.d + 1, 0x5f6f6c, 0);
    for (let i = -1; i <= 1; i += 1) {
      landmarkBatch.box(p.x + i * 14, 3.2, p.z + p.d / 2 + 0.1, 9, 5.2, 0.3, 0x54666a, 0);
    }
  }
  // Villa Rueda: terrace, pool, low rooms
  const v = city.pois.villa;
  landmarkBatch.box(v.x, 2.2, v.z, 30, 4.4, 20, 0xf0e0c4, 0);
  landmarkBatch.box(v.x, 4.6, v.z - 2, 12, 0.4, 12, 0xd8c6a8, 0);
  landmarkBatch.box(v.x + 10, 0.3, v.z + 8, 12, 0.5, 7, 0x3f8f9a, 0);
  landmarkBatch.box(v.x - 11, 0.3, v.z + 8, 4, 0.5, 7, 0x3f8f9a, 0);
  for (let i = 0; i < 5; i += 1) {
    landmarkBatch.box(v.x - 14 + i * 7, 3.6, v.z + 8.5, 0.35, 3.2, 0.35, 0xd8c6a8, 0);
  }
  landmarkBatch.box(v.x, 7.4, v.z - 6, 1.2, 4.2, 1.2, 0xd8c6a8, 0);
  const landmarks = landmarkBatch.build(plainMat);
  landmarks.castShadow = true;
  landmarks.receiveShadow = true;
  scene.add(landmarks);

  // hillside villas
  const villaBatch = new GeoBatch();
  for (const h of city.villas) {
    villaBatch.box(h.x, h.h / 2 + 0.2, h.z, h.w, h.h, h.d, h.tint, 0, h.rot);
    villaBatch.box(h.x, h.h + 0.35, h.z, h.w + 1.2, 0.5, h.d + 1.2, 0xb7a68c, 0, h.rot);
    villaBatch.box(h.x + 4, 0.4, h.z + 4, 5, 0.4, 3, 0x3f8f9a, 0, h.rot);
  }
  const villaMesh = villaBatch.build(plainMat);
  villaMesh.castShadow = true;
  scene.add(villaMesh);

  // Bus shelter at the coast stop where Rafa starts.
  const busStop = new GeoBatch();
  busStop.box(-160, 1.35, 620, 7.2, 0.3, 3.0, 0x2f5d62, 0);
  busStop.box(-163.4, 1.35, 620, 0.18, 2.7, 0.18, 0x3d4348, 0);
  busStop.box(-156.6, 1.35, 620, 0.18, 2.7, 0.18, 0x3d4348, 0);
  busStop.box(-160, 0.55, 618.8, 5.4, 0.12, 0.55, 0x7d5a3c, 0);
  busStop.box(-160, 0.82, 619.1, 5.4, 0.55, 0.08, 0x7d5a3c, 0);
  busStop.box(-154.8, 2.3, 619.2, 0.16, 1.8, 0.16, 0x3d4348, 0);
  busStop.box(-154.8, 3.15, 619.2, 1.5, 0.9, 0.1, 0x2e7f8a, 0);
  const busMesh = busStop.build(plainMat);
  busMesh.castShadow = true;
  scene.add(busMesh);

  // ---- billboards ----------------------------------------------------------------------------
  for (const b of city.billboards) {
    const tex = billboardTexture(b);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    plane.position.set(b.x, 12, b.z);
    plane.rotation.y = b.rot;
    scene.add(plane);
    const poles = new GeoBatch();
    poles.box(b.x - 6, 6, b.z, 0.3, 12, 0.3, 0x4b5054, 0);
    poles.box(b.x + 6, 6, b.z, 0.3, 12, 0.3, 0x4b5054, 0);
    scene.add(poles.build(plainMat));
  }

  // ---- sky, sun, clouds, gulls ---------------------------------------------------------------
  const sky = makeSky(scene);
  const { water, uniforms: waterUniforms } = makeWater(scene);
  const hills = makeHills(scene);

  const sunMat = new THREE.SpriteMaterial({
    map: glow, color: 0xffe0b0, transparent: true, opacity: 0.95,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const sun = new THREE.Sprite(sunMat);
  sun.position.set(SUN_DIR.x * 2900, SUN_DIR.y * 2900, SUN_DIR.z * 2900);
  sun.scale.set(520, 520, 1);
  scene.add(sun);

  const cloudTextures = [cloudTexture(SEED + 11), cloudTexture(SEED + 12), cloudTexture(SEED + 13)];
  const clouds = [];
  for (let i = 0; i < 12; i += 1) {
    const sm = new THREE.SpriteMaterial({ map: pick(rng, cloudTextures), transparent: true, opacity: range(rng, 0.3, 0.6), depthWrite: false });
    const s = new THREE.Sprite(sm);
    s.position.set(range(rng, -1500, 1500), range(rng, 180, 380), range(rng, -1400, 900));
    const sc = range(rng, 260, 620);
    s.scale.set(sc, sc * 0.45, 1);
    scene.add(s);
    clouds.push({ sprite: s, speed: range(rng, 0.8, 2.2), baseX: s.position.x });
  }

  const gulls = [];
  const gullGeo = new THREE.BufferGeometry();
  const gullPos = new Float32Array(10 * 4 * 3);
  gullGeo.setAttribute('position', new THREE.BufferAttribute(gullPos, 3));
  const gullLines = new THREE.LineSegments(gullGeo, new THREE.LineBasicMaterial({ color: 0x3a3a38, transparent: true, opacity: 0.8 }));
  gullLines.frustumCulled = false;
  scene.add(gullLines);
  for (let i = 0; i < 10; i += 1) {
    gulls.push({ x: range(rng, -400, 900), y: range(rng, 24, 54), z: range(rng, 540, 760), phase: rng() * Math.PI * 2, speed: range(rng, 0.5, 1.1), radius: range(rng, 20, 70) });
  }

  // ---- lights --------------------------------------------------------------------------------
  scene.fog = new THREE.Fog(PALETTE.fog, 700, 3300);
  scene.background = new THREE.Color(PALETTE.skyMid);

  const hemi = new THREE.HemisphereLight(0xa8d8dc, 0xb08058, 1.12);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffe0c0, 0.22);
  scene.add(ambient);
  const sunLight = new THREE.DirectionalLight(0xffc482, 2.35);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -210;
  sunLight.shadow.camera.right = 210;
  sunLight.shadow.camera.top = 210;
  sunLight.shadow.camera.bottom = -210;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 900;
  sunLight.shadow.bias = -0.0006;
  sunLight.shadow.normalBias = 0.7;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // ---- particles ----------------------------------------------------------------------------
  const sparkPool = new ParticlePool(scene, 260, soft, 0.42, true, 0.95);
  const smokePool = new ParticlePool(scene, 180, soft, 3.4, false, 0.32);
  const flashSprites = [];
  for (let i = 0; i < 6; i += 1) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd98a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.set(1.6, 1.6, 1);
    scene.add(sp);
    flashSprites.push({ sprite: sp, life: 0 });
  }
  let flashCursor = 0;

  const fx = {
    spark(pos, color = 0xffc66b, count = 6) {
      sparkPool.spawn(pos.x, pos.y, pos.z, color, count, 6.5, 0.55, 0.18, 12);
    },
    dust(pos, color = 0xcbb99c, count = 8) {
      smokePool.spawn(pos.x, pos.y, pos.z, color, count, 2.2, 1.4, 0.6, 1.2);
    },
    smoke(pos, color = 0x55524c, count = 3) {
      smokePool.spawn(pos.x, pos.y, pos.z, color, count, 1.4, 2.2, 0.4, -1.2);
    },
    blood(pos) {
      sparkPool.spawn(pos.x, pos.y, pos.z, 0xa83232, 5, 3.2, 0.45, 0.2, 10);
    },
    flash(pos, scale = 1.6, color = 0xffd98a) {
      const f = flashSprites[flashCursor];
      flashCursor = (flashCursor + 1) % flashSprites.length;
      f.sprite.position.copy(pos);
      f.sprite.material.color.set(color);
      f.sprite.scale.set(scale, scale, 1);
      f.sprite.material.opacity = 1;
      f.life = 0.08;
    },
  };

  let time = 0;
  const world = {
    scene, sky, water, hills, sun, sunLight, fx, boats, clouds, gulls, lighthouse, mastGroup, mastLight,
    update(dt, focus) {
      time += dt;
      waterUniforms.uTime.value = time;
      for (const c of clouds) {
        c.sprite.position.x += c.speed * dt;
        if (c.sprite.position.x > 1800) c.sprite.position.x = -1800;
      }
      for (const b of boats) {
        b.mesh.position.y = b.baseY + Math.sin(time * 0.8 + b.phase) * 0.12;
        b.mesh.rotation.z = Math.sin(time * 0.55 + b.phase) * 0.012;
      }
      // gulls: simple flapping line pairs
      let k = 0;
      for (const g of gulls) {
        const a = time * g.speed + g.phase;
        const x = g.x + Math.cos(a) * g.radius;
        const z = g.z + Math.sin(a) * g.radius;
        const y = g.y + Math.sin(a * 2.3) * 1.4;
        const flap = Math.sin(time * 7 + g.phase) * 0.7;
        const pts = [
          [x - 1.6, y + flap * 0.3, z], [x, y, z],
          [x, y, z], [x + 1.6, y + flap * 0.3, z],
          [x - 0.4, y, z + 0.2], [x, y, z],
          [x, y, z], [x + 0.4, y, z + 0.2],
        ];
        for (const p of pts) { gullPos[k] = p[0]; gullPos[k + 1] = p[1]; gullPos[k + 2] = p[2]; k += 3; }
      }
      gullGeo.attributes.position.needsUpdate = true;
      // lighthouse beam sweeps the bay, the tower itself stays put
      beamPivot.rotation.y = Math.sin(time * 0.35) * 0.6;
      mastLight.visible = Math.sin(time * 2.2) > -0.2;
      for (const f of flashSprites) {
        if (f.life > 0) { f.life -= dt; f.sprite.material.opacity = Math.max(0, f.life / 0.08); }
      }
      sparkPool.update(dt);
      smokePool.update(dt);
      if (focus) {
        sunLight.target.position.set(focus.x, 0, focus.z);
        sunLight.position.set(focus.x + SUN_DIR.x * 520, SUN_DIR.y * 520, focus.z + SUN_DIR.z * 520);
        sunLight.target.updateMatrixWorld();
      }
    },
    timeNow: () => time,
    mastDown: false,
  };

  return world;
}
