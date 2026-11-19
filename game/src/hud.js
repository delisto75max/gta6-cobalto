// The HUD: mission card, PDC dispatch, wanted stars, radar, vitals, dialogue, speed and toasts.
import { clamp } from './rng.js';

const CREAM = '#f4ead6', DIM = 'rgba(244,234,214,.55)', AMBER = '#ffc36a', RED = '#ff5c52', TEAL = '#6fe0cf', BLUE = '#76aaff';
const PANEL = 'rgba(9,13,19,.74)', BORDER = 'rgba(255,255,255,.14)';

export class HUD {
  constructor(canvas, city) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.city = city;
    this.lastRoadSegments = 0; this.t = 0; this.damageFlash = 0; this.mapScale = 0.2;
  }
  rr(x, y, w, h, r) {
    const c = this.ctx; c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  panel(x, y, w, h, r = 10, fill = PANEL) {
    const c = this.ctx;
    this.rr(x, y, w, h, r); c.fillStyle = fill; c.fill();
    c.strokeStyle = BORDER; c.lineWidth = 1; c.stroke();
  }
  text(s, x, y, size = 12, color = CREAM, weight = 500, align = 'left', spacing = 0) {
    const c = this.ctx;
    c.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle';
    if (spacing) {
      const chars = [...s], widths = chars.map((ch) => c.measureText(ch).width);
      const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
      let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
      for (let i = 0; i < chars.length; i++) { c.textAlign = 'left'; c.fillText(chars[i], cx, y); cx += widths[i] + spacing; }
    } else c.fillText(s, x, y);
  }
  bar(x, y, w, h, pct, color, bg = 'rgba(255,255,255,.12)') {
    const c = this.ctx;
    this.rr(x, y, w, h, h / 2); c.fillStyle = bg; c.fill();
    if (pct > 0) { this.rr(x, y, Math.max(h, w * clamp(pct, 0, 1)), h, h / 2); c.fillStyle = color; c.fill(); }
  }
  star(x, y, r, filled) {
    const c = this.ctx; c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.46 : r;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
    if (filled) { c.fillStyle = '#ffd36e'; c.fill(); c.strokeStyle = 'rgba(255,190,80,.8)'; c.lineWidth = 1; c.stroke(); }
    else { c.strokeStyle = 'rgba(255,255,255,.26)'; c.lineWidth = 1.4; c.stroke(); }
  }
  draw(st) {
    const c = this.ctx;
    c.clearRect(0, 0, 1280, 720);
    this.t += 1 / 60;
    const m = st.missions, p = st.player, pol = st.police, v = st.vehicle;
    const mission = m && m.mission ? m.mission : null;
    const disp = pol ? pol.dispatch() : { rows: [], units: 0, status: 'HIDDEN', officers: 0 };
    this.drawMission(mission, m, st);
    this.drawDispatch(disp, pol);
    this.drawWanted(pol, disp);
    this.drawTopRight(st);
    this.drawMinimap(st, m, pol);
    this.drawVitals(st, p);
    this.drawDialogue(st, m);
    this.drawVehicle(st, v);
    this.drawToasts(st);
    this.drawCrosshair(st);
    this.drawDamage(st);
  }
  drawMission(mission, m, st) {
    const x = 24, y = 22, w = 344, h = 112;
    this.panel(x, y, w, h);
    const idx = m && m.index >= 0 ? m.index + 1 : 0;
    const label = mission ? `JOB ${idx}/8 · ${mission.title}` : 'FREE ROAM · AVENIDA COBALTO';
    this.text(label, x + 16, y + 18, 10, AMBER, 700, 'left', 1.4);
    const obj = m ? m.objective() : 'EXPLORE THE CITY';
    this.text(obj, x + 16, y + 44, obj.length > 30 ? 17 : 19, CREAM, 700);
    const nxt = m ? m.nextText() : 'FIND A MARKER · PRESS E';
    this.text(nxt, x + 16, y + 70, 10, DIM, 600, 'left', 0.8);
    const stages = mission ? mission.stages.length : 0;
    for (let i = 0; i < 8; i++) {
      const px = x + 16 + i * 20, py = y + 92;
      this.rr(px, py, 14, 4, 2);
      this.ctx.fillStyle = i < (m ? m.stage + 1 : 0) ? AMBER : 'rgba(255,255,255,.14)';
      this.ctx.fill();
    }
    if (m && m.timer > 0 && m.active) this.text(`${Math.ceil(m.timer)}s`, x + w - 16, y + 18, 11, RED, 700, 'right');
  }
  drawDispatch(disp, pol) {
    const x = 24, y = 146, w = 344, h = 38 + Math.max(1, Math.min(5, disp.rows.length)) * 21 + 20;
    if (!pol || pol.wanted === 0) {
      this.panel(x, y, w, 40);
      this.text('● PDC RESPONSE', x + 14, y + 21, 10, 'rgba(255,255,255,.4)', 700, 'left', 1.2);
      this.text('NO ACTIVE UNITS', x + w - 14, y + 21, 10, 'rgba(255,255,255,.3)', 600, 'right', 0.8);
      return;
    }
    this.panel(x, y, w, h);
    this.ctx.beginPath(); this.ctx.arc(x + 18, y + 17, 4, 0, 7); this.ctx.fillStyle = RED; this.ctx.fill();
    this.text('PDC RESPONSE', x + 28, y + 17, 10, CREAM, 700, 'left', 1.3);
    this.text(`${disp.units} UNITS · ${pol.wanted}★`, x + w - 14, y + 17, 10, AMBER, 700, 'right', 0.6);
    const rows = disp.rows.slice(0, 5);
    rows.forEach((r, i) => {
      const ry = y + 38 + i * 21;
      const col = r.tactic === 'RAMMING' || r.tactic === 'FIRING' ? RED : r.tactic === 'SPOTLIGHT' ? BLUE : AMBER;
      this.ctx.fillStyle = col; this.ctx.fillRect(x + 14, ry - 4, 2, 10);
      this.text(r.id, x + 22, ry, 10.5, CREAM, 600);
      this.text(`${Math.round(r.d)} m`, x + 176, ry, 10, DIM, 600, 'right');
      this.text(r.tactic, x + w - 14, ry, 9, col, 700, 'right', 0.8);
    });
    const more = disp.rows.length - rows.length;
    const foot = more > 0 ? `+${more} more units` : 'all units engaged';
    this.text(foot, x + 14, y + h - 10, 9, DIM, 600, 'left', 0.5);
    if (pol.roadblock) this.text(`ROADBLOCK ${Math.round(pol.roadblock.dist)} m`, x + w - 14, y + h - 10, 9, RED, 700, 'right', 0.5);
  }
  drawWanted(pol, disp) {
    const cx = 640, y = 22, w = 226, h = 56;
    this.panel(cx - w / 2, y, w, h);
    this.text('WANTED', cx - 50, y + 15, 9, DIM, 700, 'left', 1.6);
    for (let i = 0; i < 5; i++) this.star(cx - 46 + i * 23, y + 34, 8, pol && pol.wanted > i);
    const status = pol ? (pol.wanted === 0 ? 'HIDDEN' : disp.status) : 'HIDDEN';
    const col = status === 'IN SIGHT' ? RED : status === 'SEARCHING' ? AMBER : TEAL;
    this.text(status, cx + w / 2 - 14, y + 15, 10, col, 800, 'right', 1.0);
    this.text(pol ? `${pol.wanted} STAR${pol.wanted === 1 ? '' : 'S'}` : '0 STARS', cx + w / 2 - 14, y + 40, 9, DIM, 600, 'right', 0.6);
  }
  drawTopRight(st) {
    const x = 1256;
    this.panel(1006, 14, 250, 164, 10, 'rgba(9,13,19,.78)');
    this.text(`17:${String(st.minutes % 60).padStart(2, '0')}`, x, 28, 11, DIM, 600, 'right', 1.2);
    this.text(`$${(st.cash || 0).toLocaleString('en-US')}`, x, 58, 26, AMBER, 800, 'right');
    this.text('CASH', x, 78, 9, DIM, 600, 'right', 1.4);
    const rows = [['1', 'FISTS', '—', true], ['2', 'VESPER', st.player.weapon === 'vesper' ? `${st.player.ammo.vesper}/${st.player.reserve.vesper}` : '', true], ['3', 'MAKO', st.player.unlocked.mako ? (st.player.weapon === 'mako' ? `${st.player.ammo.mako}/${st.player.reserve.mako}` : 'READY') : 'LOCKED', !!st.player.unlocked.mako], ['4', 'BREAKER', st.player.unlocked.breaker ? (st.player.weapon === 'breaker' ? `${st.player.ammo.breaker}/${st.player.reserve.breaker}` : 'READY') : 'LOCKED', !!st.player.unlocked.breaker]];
    rows.forEach((r, i) => {
      const ry = 105 + i * 18, active = st.player.weapon === r[1].toLowerCase();
      if (active) { this.rr(x - 214, ry - 9, 214, 17, 4); this.ctx.fillStyle = 'rgba(255,195,106,.13)'; this.ctx.fill(); this.ctx.strokeStyle = 'rgba(255,195,106,.5)'; this.ctx.stroke(); }
      this.text(r[0], x - 206, ry, 9, active ? AMBER : DIM, 700);
      this.text(r[1], x - 190, ry, 10.5, r[3] ? CREAM : 'rgba(255,255,255,.3)', active ? 700 : 600);
      this.text(r[2], x - 12, ry, 9.5, active ? AMBER : r[3] ? DIM : 'rgba(255,255,255,.25)', 600, 'right');
    });
  }
  drawMinimap(st, missionSet, pol) {
    const mission = missionSet && missionSet.mission;
    const cx = 118, cy = 538, R = 94, scale = this.mapScale;
    const p = st.player, px = p.inVehicle ? p.inVehicle.pos.x : p.pos.x, pz = p.inVehicle ? p.inVehicle.pos.z : p.pos.z;
    const locName = st.districtName === st.streetName ? st.districtName : `${st.districtName} · ${st.streetName}`;
    this.text(locName.toUpperCase(), 24, 432, 10, DIM, 700, 'left', 1.1);
    const c = this.ctx;
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip();
    c.fillStyle = '#101820'; c.fillRect(cx - R, cy - R, R * 2, R * 2);
    // water
    const wz = cy + (600 - pz) * scale;
    if (wz < cy + R) { c.fillStyle = '#0d5964'; c.fillRect(cx - R, Math.max(cy - R, wz), R * 2, R * 2); }
    // beach
    const bz = cy + (570 - pz) * scale;
    if (bz < cy + R) { c.fillStyle = '#6f6248'; c.fillRect(cx - R, Math.max(cy - R, bz), R * 2, cy + R - Math.max(cy - R, bz)); }
    // blocks
    for (const b of this.city.blocks) {
      const x1 = cx + (b.x0 - px) * scale, z1 = cy + (b.z0 - pz) * scale;
      if (x1 > cx + R || z1 > cy + R || x1 + (b.x1 - b.x0) * scale < cx - R || z1 + (b.z1 - b.z0) * scale < cy - R) continue;
      c.fillStyle = '#1b2830'; c.fillRect(x1, z1, (b.x1 - b.x0) * scale, (b.z1 - b.z0) * scale);
    }
    // roads
    let segs = 0;
    for (const s of this.city.minimapSegments) {
      const x1 = cx + (s.x1 - px) * scale, z1 = cy + (s.z1 - pz) * scale;
      const x2 = cx + (s.x2 - px) * scale, z2 = cy + (s.z2 - pz) * scale;
      if (Math.max(x1, x2) < cx - R || Math.min(x1, x2) > cx + R || Math.max(z1, z2) < cy - R || Math.min(z1, z2) > cy + R) continue;
      c.strokeStyle = s.main ? '#d9cba8' : '#8f9b9f'; c.lineWidth = Math.max(2, s.w * scale * 0.55);
      c.beginPath(); c.moveTo(x1, z1); c.lineTo(x2, z2); c.stroke(); segs++;
    }
    this.lastRoadSegments = segs;
    // search radius
    if (pol && pol.wanted > 0 && pol.status === 'SEARCHING') {
      c.strokeStyle = 'rgba(255,92,82,.65)'; c.setLineDash([4, 3]); c.lineWidth = 1;
      c.beginPath(); c.arc(cx + (pol.lastSeen.x - px) * scale, cy + (pol.lastSeen.z - pz) * scale, 46, 0, 7); c.stroke(); c.setLineDash([]);
    }
    // mission marker
    if (missionSet) {
      const mp = missionSet.markerPos();
      if (mp) {
        let mx = cx + (mp.x - px) * scale, mz = cy + (mp.z - pz) * scale;
        const d = Math.hypot(mx - cx, mz - cy);
        if (d > R - 10) { mx = cx + (mx - cx) / d * (R - 10); mz = cy + (mz - cy) / d * (R - 10); }
        c.save(); c.translate(mx, mz); c.rotate(Math.PI / 4);
        c.fillStyle = '#ffd36e'; c.fillRect(-4, -4, 8, 8); c.strokeStyle = '#3a2a12'; c.lineWidth = 1; c.strokeRect(-4, -4, 8, 8); c.restore();
      }
    }
    // police blips
    if (pol) {
      for (const u of pol.units) {
        const bx = cx + (u.v.pos.x - px) * scale, bz = cy + (u.v.pos.z - pz) * scale;
        if (Math.hypot(bx - cx, bz - cy) < R) {
          c.fillStyle = Math.sin(this.t * 10) > 0 ? RED : BLUE; c.beginPath(); c.arc(bx, bz, 3, 0, 7); c.fill();
        }
      }
      if (pol.heli.active) {
        const hx = cx + (pol.heli.g.position.x - px) * scale, hz = cy + (pol.heli.g.position.z - pz) * scale;
        if (Math.hypot(hx - cx, hz - cy) < R) { c.fillStyle = BLUE; c.beginPath(); c.arc(hx, hz, 4, 0, 7); c.fill(); c.fillStyle = '#0b0f14'; c.font = '700 6px system-ui'; c.textAlign = 'center'; c.fillText('K', hx, hz + 0.5); }
      }
    }
    // player arrow
    const ang = Math.atan2(Math.sin(p.heading), Math.cos(p.heading));
    c.save(); c.translate(cx, cy); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 9); c.lineTo(-6, -6); c.lineTo(0, -3); c.lineTo(6, -6); c.closePath();
    c.fillStyle = '#fff4dc'; c.fill(); c.strokeStyle = '#1b2730'; c.lineWidth = 1.5; c.stroke(); c.restore();
    c.restore();
    c.beginPath(); c.arc(cx, cy, R, 0, 7); c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.arc(cx, cy, R - 3, 0, 7); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.stroke();
    this.text('N', cx, cy - R + 11, 10, 'rgba(255,255,255,.6)', 800, 'center', 0.5);
  }
  drawVitals(st, p) {
    const x = 24, y = 646, w = 188;
    this.text('HEALTH', x, y, 8.5, DIM, 700, 'left', 1.2);
    this.text(String(Math.round(p.health)), x + w, y, 9, CREAM, 700, 'right');
    this.bar(x, y + 8, w, 7, p.health / 100, p.health > 35 ? '#69d68a' : RED);
    this.text('ARMOUR', x, y + 25, 8.5, DIM, 700, 'left', 1.2);
    this.text(String(Math.round(p.armour)), x + w, y + 25, 9, CREAM, 700, 'right');
    this.bar(x, y + 33, w, 7, p.armour / 100, TEAL);
    this.text(`RANK ${st.rank + 1} · ${st.rankName}`, x, y + 52, 8.5, AMBER, 700, 'left', 0.8);
    this.text(`${st.respect % 500}/500`, x + w, y + 52, 8.5, DIM, 600, 'right');
    this.bar(x, y + 60, w, 4, (st.respect % 500) / 500, AMBER);
  }
  drawDialogue(st, m) {
    const line = m && m.line;
    if (!line) return;
    const x = 372, y = 594, w = 536, h = 92;
    this.panel(x, y, w, h, 12, 'rgba(9,13,19,.82)');
    const c = this.ctx;
    c.beginPath(); c.arc(x + 46, y + 46, 25, 0, 7); c.fillStyle = 'rgba(255,195,106,.14)'; c.fill(); c.strokeStyle = 'rgba(255,195,106,.5)'; c.stroke();
    this.text(line.speaker.slice(0, 1), x + 46, y + 47, 20, AMBER, 800, 'center');
    this.text(line.speaker.toUpperCase(), x + 84, y + 28, 11, AMBER, 800, 'left', 1.0);
    this.text(line.role, x + 84, y + 44, 9, DIM, 600, 'left', 0.4);
    this.text(line.text, x + 84, y + 68, 12.5, CREAM, 500);
  }
  drawVehicle(st, v) {
    if (!v) {
      this.text('ON FOOT', 1256, 574, 10, DIM, 700, 'right', 1.4);
      this.text('♪ COBALTO 104.7 — Noche Azul', 1256, 698, 9, DIM, 500, 'right', 0.4);
      return;
    }
    const spd = Math.round(Math.abs(v.speed) * 3.6);
    this.text(String(spd), 1214, 584, 54, CREAM, 800, 'right');
    this.text('KM/H', 1256, 604, 10, DIM, 700, 'right', 1.2);
    const gear = spd < 4 ? 'N' : spd < 28 ? 'G1' : spd < 55 ? 'G2' : spd < 85 ? 'G3' : spd < 115 ? 'G4' : 'G5';
    this.text(gear, 1256, 626, 10, AMBER, 700, 'right', 0.8);
    this.text(v.spec.name.toUpperCase(), 1256, 642, 10, CREAM, 600, 'right', 0.8);
    this.text('CONDITION', 1128, 660, 8, DIM, 700, 'left', 0.8);
    this.bar(1128, 668, 128, 5, v.health / 100, v.health > 40 ? TEAL : RED);
    this.text('♪ COBALTO 104.7 — Noche Azul', 1256, 698, 9, DIM, 500, 'right', 0.4);
  }
  drawToasts(st) {
    if (!st.toasts) return;
    st.toasts.slice(-4).forEach((t, i) => {
      const a = clamp(t.t / 0.5, 0, 1);
      this.ctx.globalAlpha = a;
      const y = 96 + i * 26;
      this.rr(640 - 92, y - 11, 184, 22, 5); this.ctx.fillStyle = 'rgba(9,13,19,.78)'; this.ctx.fill();
      this.text(t.text, 640, y, 10, t.color || AMBER, 800, 'center', 1.1);
      this.ctx.globalAlpha = 1;
    });
  }
  drawCrosshair(st) {
    const c = this.ctx, x = 640, y = 360;
    const aim = st.player.aim || st.mode === 'aim';
    c.globalAlpha = aim ? 0.95 : 0.55;
    c.strokeStyle = aim ? '#ffd9a0' : 'rgba(255,255,255,.75)'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(x - 9, y); c.lineTo(x - 4, y); c.moveTo(x + 4, y); c.lineTo(x + 9, y);
    c.moveTo(x, y - 9); c.lineTo(x, y - 4); c.moveTo(x, y + 4); c.lineTo(x, y + 9); c.stroke();
    c.fillStyle = '#fff0cf'; c.beginPath(); c.arc(x, y, 1.4, 0, 7); c.fill();
    c.globalAlpha = 1;
  }
  drawDamage(st) {
    const h = st.player.health;
    if (h > 35) return;
    const c = this.ctx, a = (1 - h / 35) * 0.4;
    const g = c.createRadialGradient(640, 360, 260, 640, 360, 700);
    g.addColorStop(0, 'rgba(255,30,20,0)'); g.addColorStop(1, `rgba(190,12,8,${a})`);
    c.fillStyle = g; c.fillRect(0, 0, 1280, 720);
  }
}
