// Canvas-painted textures: asphalt, concrete, sand, glows, clouds, shop signs, billboards.
import * as THREE from 'three';

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

const noise = (g, w, h, n, alpha, lo, hi) => {
  for (let i = 0; i < n; i++) {
    const v = lo + Math.random() * (hi - lo);
    g.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
};

export function asphaltTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#2c2f36'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 2600, 0.22, 40, 125);
    for (let i = 0; i < 8; i++) {
      g.strokeStyle = 'rgba(18,19,23,.45)'; g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      let x = Math.random() * w, y = Math.random() * h;
      g.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); }
      g.stroke();
    }
  });
}

export function concreteTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b8ad98'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 1600, 0.16, 120, 210);
    g.strokeStyle = 'rgba(80,74,64,.2)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke();
    }
  });
}

export function sandTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e3c997'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) {
      const v = 170 + Math.random() * 70;
      g.fillStyle = `rgba(${v},${v - 18},${v - 55},.3)`;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    g.strokeStyle = 'rgba(190,160,110,.18)'; g.lineWidth = 2;
    for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 0, 7); g.stroke(); }
  });
}

export function glowTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.22, 'rgba(255,255,255,.75)');
    gr.addColorStop(0.55, 'rgba(255,255,255,.2)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, false);
}

export function smokeTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,.85)');
    gr.addColorStop(0.5, 'rgba(255,255,255,.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, false);
}

export function cloudTexture(seed = 1) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return canvasTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = w * 0.5 + (rnd() - 0.5) * w * 0.62;
      const y = h * 0.55 + (rnd() - 0.5) * h * 0.3;
      const r = 14 + rnd() * 34;
      const edge = Math.min(x, w - x) / (w * 0.5);
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(255,236,220,${0.42 * Math.min(1, edge * 2)})`);
      rg.addColorStop(0.55, `rgba(255,214,196,${0.18 * Math.min(1, edge * 2)})`);
      rg.addColorStop(1, 'rgba(255,210,190,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }, false);
}

const signCache = new Map();
export function signTexture(text, bg = '#12141c', fg = '#ffd77a', border = '#ff9d5c') {
  const key = text + bg + fg;
  if (signCache.has(key)) return signCache.get(key);
  const t = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.font = '700 66px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 4);
  }, false);
  signCache.set(key, t);
  return t;
}

export function billboardTexture(title, sub, bg = '#1a2430', fg = '#ffe0a3') {
  return canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, bg); gr.addColorStop(1, '#0c1118');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e5a45c'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    g.textAlign = 'center';
    g.fillStyle = fg; g.font = '800 74px system-ui, sans-serif';
    g.fillText(title, w / 2, 120);
    g.fillStyle = '#8fd6cf'; g.font = '600 30px system-ui, sans-serif';
    g.fillText(sub, w / 2, 186);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = 'rgba(255,255,255,.08)';
      g.fillRect(20, 30 + i * 12, w - 40, 2);
    }
  }, false);
}

export function foamTexture() {
  return canvasTex(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const r = 3 + Math.random() * 10;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,.9)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }, true);
}

export function skyGradientTexture() {
  return canvasTex(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0d405c');
    gr.addColorStop(0.42, '#4a7e8c');
    gr.addColorStop(0.66, '#e89466');
    gr.addColorStop(0.82, '#ffd39a');
    gr.addColorStop(1, '#ffe9c4');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, false);
}
