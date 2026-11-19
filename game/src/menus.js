// Title, pause, city map, settings, controls, death and ending screens.
import { CFG } from './config.js';

const CREAM = '#f4ead6', DIM = 'rgba(244,234,214,.55)', AMBER = '#ffc36a', RED = '#ff5c52';

export class Menus {
  constructor(canvas, city) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.city = city; this.t = 0; }
  clear() { this.ctx.clearRect(0, 0, 1280, 720); }
  rr(x, y, w, h, r) { const c = this.ctx; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  txt(s, x, y, size, color = CREAM, weight = 600, align = 'left', spacing = 0) {
    const c = this.ctx; c.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle';
    if (spacing) {
      const chars = [...s], ws = chars.map((ch) => c.measureText(ch).width);
      let cx = align === 'center' ? x - (ws.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)) / 2 : x;
      for (let i = 0; i < chars.length; i++) { c.textAlign = 'left'; c.fillText(chars[i], cx, y); cx += ws[i] + spacing; }
    } else c.fillText(s, x, y);
  }
  drawTitle(st) {
    const c = this.ctx; c.clearRect(0, 0, 1280, 720);
    const g = c.createLinearGradient(0, 0, 900, 0);
    g.addColorStop(0, 'rgba(6,10,15,.86)'); g.addColorStop(0.55, 'rgba(6,10,15,.36)'); g.addColorStop(1, 'rgba(6,10,15,0)');
    c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
    this.txt('AN ORIGINAL OPEN-WORLD CRIME STORY', 88, 118, 10, AMBER, 700, 'left', 2.4);
    const tg = c.createLinearGradient(88, 150, 560, 260);
    tg.addColorStop(0, '#ffe3ae'); tg.addColorStop(0.55, '#ffb36b'); tg.addColorStop(1, '#ff7d59');
    c.font = '900 108px system-ui, -apple-system, "Segoe UI", sans-serif'; c.fillStyle = tg; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText('COBALTO', 82, 210);
    c.strokeStyle = 'rgba(255,211,150,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(88, 262); c.lineTo(548, 262); c.stroke();
    this.txt('BAHÍA CALIENTE', 92, 292, 22, '#e9f4ee', 600, 'left', 8);
    this.txt('SIX DISTRICTS · ONE LONG NIGHT · A CITY THAT NEVER FORGETS', 92, 326, 10, DIM, 600, 'left', 1.3);
    const items = ['NEW GAME', st.hasSave ? 'CONTINUE' : 'CONTINUE (EMPTY)', 'SETTINGS', 'CONTROLS'];
    items.forEach((it, i) => {
      const y = 406 + i * 46, sel = st.menuIndex === i, off = !st.hasSave && i === 1;
      if (sel) {
        this.rr(82, y - 20, 292, 36, 6); c.fillStyle = 'rgba(255,195,106,.14)'; c.fill(); c.strokeStyle = 'rgba(255,195,106,.55)'; c.lineWidth = 1; c.stroke();
        c.fillStyle = AMBER; c.fillRect(82, y - 20, 3, 36);
      }
      this.txt(it, 104, y, 17, off ? 'rgba(255,255,255,.26)' : sel ? '#fff1d6' : CREAM, sel ? 700 : 500, 'left', 1.4);
    });
    this.txt('KEYBOARD + MOUSE · A GAME BY ERIS FOR MAKE.FUN', 88, 650, 9, DIM, 600, 'left', 1.4);
    this.txt('BAHÍA COBALTO · 17:40 · GOLDEN HOUR', 1200, 52, 10, 'rgba(255,255,255,.5)', 600, 'right', 1.2);
    this.txt('v1.0', 1200, 70, 9, 'rgba(255,255,255,.3)', 500, 'right');
  }
  drawPause(st) {
    this.clear();
    const c = this.ctx; c.fillStyle = 'rgba(5,9,14,.72)'; c.fillRect(0, 0, 1280, 720);
    this.txt('PAUSED', 640, 176, 42, CREAM, 800, 'center', 4);
    this.txt('BAHÍA COBALTO', 640, 210, 10, AMBER, 700, 'center', 3);
    const items = ['RESUME', 'CITY MAP', 'SETTINGS', 'CONTROLS', 'SAVE GAME', 'QUIT TO TITLE'];
    items.forEach((it, i) => {
      const y = 290 + i * 44, sel = st.menuIndex === i;
      if (sel) { this.rr(490, y - 18, 300, 34, 6); c.fillStyle = 'rgba(255,195,106,.14)'; c.fill(); c.strokeStyle = 'rgba(255,195,106,.5)'; c.stroke(); }
      this.txt(it, 640, y, 15, sel ? '#fff1d6' : CREAM, sel ? 700 : 500, 'center', 1.6);
    });
    this.txt('ESC RESUME · TAB MAP · F5 SAVE · F9 LOAD', 640, 660, 9, DIM, 600, 'center', 1.0);
  }
  drawMap(st) {
    this.clear();
    const c = this.ctx; c.fillStyle = 'rgba(5,9,14,.9)'; c.fillRect(0, 0, 1280, 720);
    const cx = 640, cy = 360, s = 0.42;
    const px = st.player.inVehicle ? st.player.inVehicle.pos.x : st.player.pos.x;
    const pz = st.player.inVehicle ? st.player.inVehicle.pos.z : st.player.pos.z;
    const X = (x) => cx + (x - 0) * s, Z = (z) => cy + (z + 60) * s;
    // sea + beach
    c.fillStyle = '#0c4d58'; c.fillRect(X(-1120), Z(600), 2240 * s, 220 * s);
    c.fillStyle = '#6e6047'; c.fillRect(X(-1120), Z(560), 2240 * s, 42 * s);
    c.fillStyle = '#0b1117'; c.fillRect(X(-1120), Z(-780), 2240 * s, 1360 * s);
    for (const b of this.city.blocks) { c.fillStyle = '#1b2830'; c.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * s, (b.z1 - b.z0) * s); }
    for (const r of this.city.roads) {
      c.strokeStyle = r.main ? 'rgba(217,203,168,.8)' : 'rgba(143,155,159,.55)'; c.lineWidth = Math.max(2, r.w * s * 0.6);
      c.beginPath();
      if (r.axis === 'z') { c.moveTo(X(r.at), Z(r.from)); c.lineTo(X(r.at), Z(r.to)); }
      else { c.moveTo(X(r.from), Z(r.at)); c.lineTo(X(r.to), Z(r.at)); }
      c.stroke();
    }
    // district labels
    const labels = [['AVENIDA COBALTO', 0, 20], ['LA MARINA', -430, 500], ['MERCADO VIEJO', 430, 180], ['EL ASTILLERO', 830, 430], ['PLAYA DORADA', -820, 610], ['CERRO ALTO', -560, -520]];
    for (const [name, x, z] of labels) this.txt(name, X(x), Z(z), 9, 'rgba(255,255,255,.5)', 700, 'center', 1.6);
    const poi = Object.values(this.city.poi);
    for (const p of poi) {
      c.beginPath(); c.arc(X(p.x), Z(p.z), 3, 0, 7); c.fillStyle = AMBER; c.fill();
      this.txt(p.name.toUpperCase(), X(p.x) + 8, Z(p.z), 8, 'rgba(255,255,255,.6)', 600, 'left', 0.4);
    }
    if (st.missions && st.missions.markerPos()) {
      const mp = st.missions.markerPos();
      c.save(); c.translate(X(mp.x), Z(mp.z)); c.rotate(Math.PI / 4); c.fillStyle = '#ffd36e'; c.fillRect(-7, -7, 14, 14); c.restore();
    }
    c.save(); c.translate(X(px), Z(pz)); c.rotate(Math.atan2(Math.sin(st.player.heading), Math.cos(st.player.heading)));
    c.beginPath(); c.moveTo(0, 12); c.lineTo(-7, -8); c.lineTo(0, -4); c.lineTo(7, -8); c.closePath(); c.fillStyle = '#fff4dc'; c.fill(); c.strokeStyle = '#0b1117'; c.stroke(); c.restore();
    this.txt('CIUDAD DE BAHÍA COBALTO', 640, 68, 13, CREAM, 800, 'center', 4);
    this.txt('TAB / ESC TO CLOSE', 640, 692, 9, DIM, 600, 'center', 1.2);
    this.txt(`${Math.round(px)}, ${Math.round(pz)} · ${st.districtName}`, 1200, 68, 9, DIM, 600, 'right', 0.8);
  }
  drawSettings(st) {
    this.clear();
    const c = this.ctx; c.fillStyle = 'rgba(5,9,14,.9)'; c.fillRect(0, 0, 1280, 720);
    this.txt('SETTINGS', 640, 120, 32, CREAM, 800, 'center', 4);
    const rows = [['MASTER VOLUME', `${Math.round(st.settings.volume * 100)}%`], ['MOUSE SENSITIVITY', st.settings.sens.toFixed(2)], ['INVERT Y', st.settings.invert ? 'ON' : 'OFF'], ['HUD SCALE', `${Math.round(st.settings.hudScale * 100)}%`]];
    rows.forEach((r, i) => {
      const y = 250 + i * 58, sel = st.menuIndex === i;
      if (sel) { this.rr(400, y - 22, 480, 44, 8); c.fillStyle = 'rgba(255,195,106,.13)'; c.fill(); c.strokeStyle = 'rgba(255,195,106,.5)'; c.stroke(); }
      this.txt(r[0], 430, y, 13, sel ? '#fff1d6' : CREAM, sel ? 700 : 500, 'left', 1.2);
      this.txt(r[1], 850, y, 13, AMBER, 700, 'right');
    });
    this.txt('↑ ↓ SELECT · ← → CHANGE · ESC BACK', 640, 650, 9, DIM, 600, 'center', 1.1);
  }
  drawControls(st) {
    this.clear();
    const c = this.ctx; c.fillStyle = 'rgba(5,9,14,.9)'; c.fillRect(0, 0, 1280, 720);
    this.txt('CONTROLS', 640, 110, 32, CREAM, 800, 'center', 4);
    const left = [['W A S D', 'MOVE / DRIVE'], ['SHIFT', 'SPRINT / HANDBRAKE'], ['SPACE', 'JUMP'], ['E', 'ENTER / EXIT VEHICLE'], ['LMB', 'FIRE'], ['RMB', 'AIM'], ['R', 'RELOAD'], ['1 2 3 4 / Q', 'WEAPONS']];
    const right = [['TAB', 'CITY MAP'], ['ESC', 'PAUSE'], ['F5 / F9', 'QUICK SAVE / LOAD'], ['H', 'HORN'], ['[ ]', 'RADIO STATION'], ['MOUSE', 'ORBIT CAMERA'], ['WHEEL', 'ZOOM'], ['ENTER', 'CONFIRM']];
    left.forEach((r, i) => { this.txt(r[0], 250, 220 + i * 40, 12, AMBER, 700, 'right', 1.4); this.txt(r[1], 280, 220 + i * 40, 12, CREAM, 500); });
    right.forEach((r, i) => { this.txt(r[0], 730, 220 + i * 40, 12, AMBER, 700, 'right', 1.4); this.txt(r[1], 760, 220 + i * 40, 12, CREAM, 500); });
    this.txt('ESC BACK', 640, 650, 9, DIM, 600, 'center', 1.1);
  }
  drawDead(st) {
    this.clear();
    const c = this.ctx; c.fillStyle = 'rgba(40,4,4,.5)'; c.fillRect(0, 0, 1280, 720);
    this.txt('WASTED', 640, 320, 74, '#ff5c52', 900, 'center', 8);
    this.txt('THE CITY ALWAYS GETS PAID', 640, 376, 11, 'rgba(255,220,200,.7)', 700, 'center', 3);
    this.txt(`HOSPITAL BILL  $250 · RESPAWNING IN ${Math.ceil(st.deadTimer)}`, 640, 430, 11, CREAM, 600, 'center', 1.2);
  }
  drawEnding(st) {
    this.clear();
    const c = this.ctx; const g = c.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, 'rgba(5,9,14,.4)'); g.addColorStop(1, 'rgba(5,9,14,.92)'); c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
    this.txt('HIGH TIDE', 640, 230, 62, AMBER, 900, 'center', 8);
    this.txt('THE STORY IS OVER. THE CITY IS NOT.', 640, 292, 12, CREAM, 600, 'center', 2.2);
    this.txt(`CASH $${(st.cash || 0).toLocaleString('en-US')}   ·   RESPECT ${st.respect}   ·   ${st.rankName}`, 640, 348, 13, AMBER, 700, 'center', 1.2);
    this.txt('FREE ROAM UNLOCKED · PRESS ENTER', 640, 470, 11, DIM, 600, 'center', 1.4);
  }
}
