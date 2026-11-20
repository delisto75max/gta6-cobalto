// The HUD: mission card, PDC dispatch, wanted stars, 2.5D radar, vitals, crew strip and speed.
import { clamp } from './rng.js';

const CREAM = '#f6ecd8', DIM = 'rgba(246,236,216,.55)', FAINT = 'rgba(246,236,216,.32)';
const AMBER = '#ffc36a', GOLD = '#ffd77e', RED = '#ff5a4e', TEAL = '#63e2d2', BLUE = '#7fb2ff';
const PANEL_TOP = 'rgba(14,20,27,.88)', PANEL_BOT = 'rgba(5,8,12,.84)', BORDER = 'rgba(255,255,255,.13)';
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

const CREW = [
  { key: 'Z', name: 'SWAP PLATES', glyph: 'plate' },
  { key: 'X', name: 'QUICK FIX', glyph: 'wrench' },
  { key: 'C', name: 'EYES OUT', glyph: 'eye' },
];

function rgb(hex) {
  const n = typeof hex === 'number' ? hex : parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function tint(hex, mul = 1, alpha = 1) {
  const [r, g, b] = rgb(hex);
  return `rgba(${Math.round(r * mul)},${Math.round(g * mul)},${Math.round(b * mul)},${alpha})`;
}

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
  panel(x, y, w, h, r = 10, accent = null, top = PANEL_TOP, bottom = PANEL_BOT) {
    const c = this.ctx;
    this.rr(x, y, w, h, r);
    const g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    c.fillStyle = g; c.fill();
    c.strokeStyle = BORDER; c.lineWidth = 1; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.05)'; c.beginPath();
    c.moveTo(x + r, y + 0.6); c.lineTo(x + w - r, y + 0.6); c.stroke();
    if (accent) {
      c.fillStyle = accent;
      this.rr(x + 0.5, y + 9, 2.6, h - 18, 1.3); c.fill();
    }
  }
  text(s, x, y, size = 12, color = CREAM, weight = 500, align = 'left', spacing = 0) {
    const c = this.ctx;
    c.font = `${weight} ${size}px ${FONT}`;
    c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle';
    if (spacing) {
      const chars = [...s], widths = chars.map((ch) => c.measureText(ch).width);
      const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
      let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
      for (let i = 0; i < chars.length; i++) { c.textAlign = 'left'; c.fillText(chars[i], cx, y); cx += widths[i] + spacing; }
    } else c.fillText(s, x, y);
  }
  bar(x, y, w, h, pct, color, bg = 'rgba(255,255,255,.1)') {
    const c = this.ctx;
    this.rr(x, y, w, h, h / 2); c.fillStyle = bg; c.fill();
    if (pct > 0) {
      const g = c.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, color); g.addColorStop(1, tint(color, 0.72));
      this.rr(x, y, Math.max(h, w * clamp(pct, 0, 1)), h, h / 2); c.fillStyle = g; c.fill();
    }
  }
  star(x, y, r, filled) {
    const c = this.ctx; c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.46 : r;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
    if (filled) {
      c.save(); c.shadowColor = 'rgba(255,190,80,.85)'; c.shadowBlur = 7;
      c.fillStyle = GOLD; c.fill(); c.restore();
      c.strokeStyle = 'rgba(255,236,180,.9)'; c.lineWidth = 0.8; c.stroke();
    } else { c.strokeStyle = 'rgba(255,255,255,.24)'; c.lineWidth = 1.3; c.stroke(); }
  }

  // ---- weapon silhouettes -------------------------------------------------
  weaponIcon(kind, x, y, s, color) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.scale(s / 24, s / 24);
    c.fillStyle = color; c.strokeStyle = color; c.lineWidth = 1.6; c.lineJoin = 'round';
    if (kind === 'fist') {
      c.beginPath();
      c.moveTo(3, 10); c.lineTo(15, 10); c.lineTo(15, 8.6);
      for (let i = 0; i < 4; i++) {
        const fx = 15.4 + i * 1.9;
        c.lineTo(fx, 8.6); c.arc(fx - 0.2, 6.4, 1.5, 0, Math.PI, true);
      }
      c.lineTo(21.4, 17); c.lineTo(17, 21); c.lineTo(7, 21); c.lineTo(5, 18); c.lineTo(3, 18); c.closePath();
      c.fill();
      c.fillRect(1.2, 12, 2.4, 6);
    } else if (kind === 'pistol') {
      c.fillRect(3, 7.4, 17.5, 3.4);
      c.fillRect(19.5, 8.2, 3, 1.9);
      c.beginPath(); c.moveTo(8, 10.6); c.lineTo(14, 10.6); c.lineTo(12.2, 20); c.lineTo(6.4, 20); c.lineTo(7, 15); c.closePath(); c.fill();
      c.lineWidth = 1.5; c.beginPath(); c.arc(14.6, 13.4, 2.6, -0.5, 2.2); c.stroke();
    } else if (kind === 'smg') {
      c.fillRect(4, 8, 15, 4.2);
      c.fillRect(19, 9, 4.5, 2.2);
      c.fillRect(7, 12, 4, 7.2);
      c.fillRect(12.4, 12, 3.2, 5.4);
      c.fillRect(1, 9.4, 3.2, 2.6);
      c.fillRect(15, 5.6, 3.4, 2.4);
    } else if (kind === 'shotgun') {
      c.fillRect(2, 8.8, 20.5, 2.2);
      c.fillRect(7.4, 8, 7.6, 4.6);
      c.fillRect(9.6, 12.2, 7, 3.1);
      c.beginPath(); c.moveTo(1, 7.2); c.lineTo(7.2, 7.2); c.lineTo(7.2, 13.6); c.lineTo(1, 14.6); c.closePath(); c.fill();
      c.fillRect(14.6, 6.2, 3.2, 1.8);
    }
    c.restore();
  }
  lockIcon(x, y, s, color) {
    const c = this.ctx;
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = Math.max(1, s * 0.13);
    c.beginPath(); c.arc(x, y, s * 0.32, Math.PI, 0); c.stroke();
    c.fillRect(x - s * 0.44, y, s * 0.88, s * 0.62);
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
    this.drawCrew(pol);
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
    this.panel(x, y, w, h, 10, AMBER);
    const idx = m && m.index >= 0 ? m.index + 1 : 0;
    const label = mission ? `JOB ${String(idx).padStart(2, '0')} / 08 · ${mission.title}` : 'FREE ROAM · AVENIDA COBALTO';
    this.text(label, x + 16, y + 19, 10, AMBER, 800, 'left', 1.5);
    const obj = m ? m.objective() : 'EXPLORE THE CITY';
    this.text(obj, x + 16, y + 46, obj.length > 30 ? 17 : 19, CREAM, 800);
    const nxt = m ? m.nextText() : 'FIND A MARKER · PRESS E';
    this.text(nxt, x + 16, y + 71, 9.5, DIM, 600, 'left', 0.9);
    const stages = mission ? mission.stages.length : 0;
    for (let i = 0; i < 8; i++) {
      const px = x + 16 + i * 20, py = y + 92;
      this.rr(px, py, 14, 4, 2);
      this.ctx.fillStyle = i < (m ? m.stage + 1 : 0) ? AMBER : 'rgba(255,255,255,.12)';
      this.ctx.fill();
    }
    if (stages) this.text(`${Math.min(stages, m.stage + 1)}/${stages}`, x + w - 16, y + 94, 8.5, DIM, 700, 'right', 0.8);
    if (m && m.timer > 0 && m.active) this.text(`${Math.ceil(m.timer)}s`, x + w - 16, y + 19, 11, RED, 800, 'right');
  }

  drawDispatch(disp, pol) {
    const x = 24, y = 146, w = 344, h = 38 + Math.max(1, Math.min(5, disp.rows.length)) * 21 + 20;
    if (!pol || pol.wanted === 0) {
      this.panel(x, y, w, 40, 9, 'rgba(120,200,190,.5)');
      this.text('● PDC RESPONSE', x + 14, y + 21, 10, 'rgba(255,255,255,.42)', 800, 'left', 1.3);
      this.text('NO ACTIVE UNITS', x + w - 14, y + 21, 9.5, 'rgba(255,255,255,.32)', 600, 'right', 0.9);
      return;
    }
    this.panel(x, y, w, h, 9, RED);
    this.ctx.beginPath(); this.ctx.arc(x + 19, y + 17, 4, 0, 7);
    this.ctx.fillStyle = Math.sin(this.t * 6) > -0.2 ? RED : 'rgba(255,90,78,.25)';
    this.ctx.fill();
    this.text('PDC RESPONSE', x + 29, y + 17, 10, CREAM, 800, 'left', 1.4);
    this.text(`${disp.units} UNITS · ${pol.wanted}★`, x + w - 14, y + 17, 9.5, AMBER, 800, 'right', 0.7);
    const rows = disp.rows.slice(0, 5);
    rows.forEach((r, i) => {
      const ry = y + 39 + i * 21;
      const hot = r.tactic === 'RAMMING' || r.tactic === 'FIRING';
      const col = hot ? RED : r.tactic === 'SPOTLIGHT' ? BLUE : AMBER;
      this.ctx.fillStyle = 'rgba(255,255,255,.045)';
      this.rr(x + 12, ry - 9, w - 24, 18, 3); this.ctx.fill();
      this.ctx.fillStyle = col; this.ctx.fillRect(x + 12, ry - 9, 2.2, 18);
      this.text(r.id, x + 22, ry, 10, CREAM, 600);
      this.text(`${Math.round(r.d)} m`, x + 186, ry, 9.5, DIM, 700, 'right');
      this.text(r.tactic, x + w - 14, ry, 8.5, col, 800, 'right', 0.9);
    });
    const more = disp.rows.length - rows.length;
    const foot = more > 0 ? `+${more} more units` : 'all units engaged';
    this.text(foot, x + 14, y + h - 10, 8.5, DIM, 600, 'left', 0.5);
    if (pol.roadblock) this.text(`ROADBLOCK ${Math.round(pol.roadblock.dist)} m`, x + w - 14, y + h - 10, 8.5, RED, 800, 'right', 0.5);
  }

  drawWanted(pol, disp) {
    const cx = 640, y = 22, w = 228, h = 58;
    this.panel(cx - w / 2, y, w, h, 10, null, 'rgba(14,20,27,.9)', 'rgba(5,8,12,.86)');
    this.text('WANTED', cx - 54, y + 16, 9, DIM, 800, 'left', 1.8);
    for (let i = 0; i < 5; i++) this.star(cx - 48 + i * 24, y + 35, 8.5, pol && pol.wanted > i);
    const status = pol ? (pol.wanted === 0 ? 'HIDDEN' : disp.status) : 'HIDDEN';
    const col = status === 'IN SIGHT' ? RED : status === 'SEARCHING' ? AMBER : TEAL;
    this.text(status, cx + w / 2 - 14, y + 16, 9.5, col, 800, 'right', 1.1);
    this.text(pol ? `${pol.wanted} STAR${pol.wanted === 1 ? '' : 'S'}` : '0 STARS', cx + w / 2 - 14, y + 41, 9, DIM, 600, 'right', 0.7);
  }

  drawTopRight(st) {
    const c = this.ctx;
    const x = 1256, panelX = 1006;
    this.panel(panelX, 14, 250, 202, 10);
    this.text(`17:${String(st.minutes % 60).padStart(2, '0')}`, x, 30, 10.5, DIM, 700, 'right', 1.3);
    this.text(`$${(st.cash || 0).toLocaleString('en-US')}`, x, 60, 25, AMBER, 800, 'right');
    this.text('CASH', x, 80, 8.5, DIM, 700, 'right', 1.5);
    const pl = st.player;
    const specs = [
      { key: '1', id: 'fists', name: 'FISTS', icon: 'fist', ammo: 'MELEE', unlocked: true },
      { key: '2', id: 'vesper', name: 'VESPER', icon: 'pistol', ammo: st.player.unlocked.vesper ? `${pl.ammo.vesper}/${pl.reserve.vesper}` : 'LOCKED', unlocked: !!pl.unlocked.vesper },
      { key: '3', id: 'mako', name: 'MAKO', icon: 'smg', ammo: st.player.unlocked.mako ? `${pl.ammo.mako}/${pl.reserve.mako}` : 'LOCKED', unlocked: !!pl.unlocked.mako },
      { key: '4', id: 'breaker', name: 'BREAKER', icon: 'shotgun', ammo: st.player.unlocked.breaker ? `${pl.ammo.breaker}/${pl.reserve.breaker}` : 'LOCKED', unlocked: !!pl.unlocked.breaker },
    ];
    const cw = 112, ch = 47, gx = 8, gy = 7;
    specs.forEach((s, i) => {
      const cx = panelX + 11 + (i % 2) * (cw + gx);
      const cy = 92 + Math.floor(i / 2) * (ch + gy);
      const active = pl.weapon === s.id;
      const lit = active && s.unlocked;
      this.rr(cx, cy, cw, ch, 7);
      const g = c.createLinearGradient(cx, cy, cx, cy + ch);
      g.addColorStop(0, lit ? 'rgba(255,195,106,.19)' : 'rgba(255,255,255,.045)');
      g.addColorStop(1, lit ? 'rgba(255,195,106,.07)' : 'rgba(255,255,255,.015)');
      c.fillStyle = g; c.fill();
      c.strokeStyle = lit ? 'rgba(255,195,106,.75)' : s.unlocked ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.06)';
      c.lineWidth = lit ? 1.4 : 1; c.stroke();
      if (lit) { c.save(); c.shadowColor = 'rgba(255,180,80,.5)'; c.shadowBlur = 10; c.stroke(); c.restore(); }
      const iconCol = s.unlocked ? (lit ? GOLD : 'rgba(246,236,216,.78)') : 'rgba(246,236,216,.26)';
      this.weaponIcon(s.icon, cx + 8, cy + 9, 26, iconCol);
      if (!s.unlocked) this.lockIcon(cx + 20, cy + 26, 10, 'rgba(246,236,216,.4)');
      this.text(s.name, cx + 42, cy + 15, 9.2, s.unlocked ? (lit ? GOLD : CREAM) : 'rgba(246,236,216,.3)', 800, 'left', 0.45);
      this.text(s.ammo, cx + 42, cy + 31, s.unlocked ? 9 : 8, lit ? AMBER : s.unlocked ? DIM : 'rgba(246,236,216,.22)', 700, 'left', 0.4);
      this.rr(cx + cw - 19, cy + 6, 13, 11, 2.5);
      c.fillStyle = lit ? 'rgba(255,195,106,.9)' : 'rgba(255,255,255,.12)'; c.fill();
      this.text(s.key, cx + cw - 12.5, cy + 11.5, 7.5, lit ? '#1a1206' : DIM, 800, 'center');
    });
  }

  drawCrew(pol) {
    const x = 1006, y = 468, w = 250, h = 68;
    this.panel(x, y, w, h, 10);
    this.text('CREW', x + 12, y + 12, 8, DIM, 800, 'left', 1.6);
    const hot = pol && (pol.status === 'IN SIGHT' || pol.wanted >= 3);
    this.text(hot ? 'ENGAGED' : 'READY', x + w - 12, y + 12, 8, hot ? RED : TEAL, 800, 'right', 1.1);
    CREW.forEach((a, i) => {
      const cw = 74, ch = 44, cx = x + 8 + i * (cw + 5), cy = y + 19;
      this.rr(cx, cy, cw, ch, 6);
      const g = this.ctx.createLinearGradient(cx, cy, cx, cy + ch);
      g.addColorStop(0, 'rgba(99,226,210,.09)'); g.addColorStop(1, 'rgba(255,255,255,.02)');
      this.ctx.fillStyle = g; this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(99,226,210,.22)'; this.ctx.lineWidth = 1; this.ctx.stroke();
      const rx = cx + 14, ry = cy + 14, r = 9.5;
      // cooldown ring: full track + ready sweep
      const c = this.ctx;
      c.beginPath(); c.arc(rx, ry, r + 2, 0, 7); c.strokeStyle = 'rgba(255,255,255,.1)'; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.arc(rx, ry, r + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2); c.strokeStyle = 'rgba(99,226,210,.85)'; c.lineWidth = 2; c.stroke();
      this.crewGlyph(a.glyph, rx, ry, 12, TEAL);
      this.rr(cx + cw - 18, cy + 3, 14, 12, 2.5);
      c.fillStyle = 'rgba(255,255,255,.1)'; c.fill();
      this.text(a.key, cx + cw - 11, cy + 9.5, 7.5, TEAL, 800, 'center');
      this.text(a.name, cx + cw / 2, cy + ch - 9, 7.6, 'rgba(246,236,216,.82)', 800, 'center', 0.3);
    });
  }
  crewGlyph(kind, x, y, s, color) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.scale(s / 24, s / 24);
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 2; c.lineCap = 'round';
    if (kind === 'plate') {
      c.strokeRect(-8, -6, 12, 8); c.strokeRect(-4, -3, 12, 8);
    } else if (kind === 'wrench') {
      c.beginPath(); c.moveTo(-7, 7); c.lineTo(4, -4); c.stroke();
      c.beginPath(); c.arc(6, -6, 4, 0.6, 5.4); c.stroke();
    } else {
      c.beginPath(); c.ellipse(0, 0, 9, 5.5, 0, 0, 7); c.stroke();
      c.beginPath(); c.arc(0, 0, 2.4, 0, 7); c.fill();
    }
    c.restore();
  }

  drawMinimap(st, missionSet, pol) {
    const mission = missionSet && missionSet.mission;
    const cx = 118, cy = 548, R = 88, scale = this.mapScale;
    const p = st.player, px = p.inVehicle ? p.inVehicle.pos.x : p.pos.x, pz = p.inVehicle ? p.inVehicle.pos.z : p.pos.z;
    const c = this.ctx;
    const locName = st.districtName === st.streetName ? st.districtName : `${st.districtName} · ${st.streetName}`;
    // location + district heat
    c.save(); c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = 4;
    const dinfo = st.city.districtInfo(st.city.districtAt(px, pz));
    c.fillStyle = `rgb(${rgb(dinfo.color).join(',')})`;
    c.fillRect(24, 400, 8, 8);
    this.text(locName.toUpperCase(), 38, 404, 10, CREAM, 800, 'left', 1.15);
    const heat = clamp(((pol ? pol.wanted : 0) / 5) * 0.74 + (pol ? Math.min(6, pol.units.length) : 0) * 0.035, 0, 1);
    this.text('HEAT', 24, 422, 7.5, DIM, 800, 'left', 1.4);
    const bx = 52, bw = 118, segs = 16, gap = 1.4, sw = (bw - gap * (segs - 1)) / segs;
    for (let i = 0; i < segs; i++) {
      const on = i / segs < heat;
      c.fillStyle = on ? (heat > 0.62 ? RED : heat > 0.3 ? AMBER : TEAL) : 'rgba(255,255,255,.09)';
      this.rr(bx + i * (sw + gap), 419, sw, 5, 1.5); c.fill();
    }
    this.text(`${Math.round(heat * 100)}%`, 182, 422, 7.5, heat > 0.62 ? RED : DIM, 800, 'left', 0.5);
    c.restore();

    // 2.5D oblique projection: +z runs down and slightly right
    const proj = (wx, wz) => {
      const dx = (wx - px) * scale, dz = (wz - pz) * scale;
      return [cx + dx + dz * 0.16, cy + dz * 0.66];
    };
    c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip();
    const bg = c.createLinearGradient(cx, cy - R, cx, cy + R);
    bg.addColorStop(0, '#0a1218'); bg.addColorStop(1, '#0c1a20');
    c.fillStyle = bg; c.fillRect(cx - R, cy - R, R * 2, R * 2);
    // sea + sand bands
    const seaY = proj(px, 664)[1], sandY = proj(px, 598)[1];
    if (seaY < cy + R) {
      const sg = c.createLinearGradient(cx, seaY, cx, cy + R);
      sg.addColorStop(0, '#1a8a8b'); sg.addColorStop(1, '#0b4f5c');
      c.fillStyle = sg; c.fillRect(cx - R, Math.max(cy - R, seaY), R * 2, R * 2);
      c.fillStyle = 'rgba(255,238,205,.5)'; c.fillRect(cx - R, seaY - 1, R * 2, 1.4);
    }
    if (sandY < cy + R) {
      c.fillStyle = '#a48b62'; c.fillRect(cx - R, Math.max(cy - R, sandY), R * 2, Math.max(0, seaY - sandY));
    }
    // ground blocks
    for (const b of this.city.blocks) {
      const [x1, y1] = proj(b.x0, b.z0), [x2, y2] = proj(b.x1, b.z1);
      if (x1 > cx + R || y1 > cy + R || x2 < cx - R || y2 < cy - R) continue;
      c.fillStyle = '#111c22'; c.fillRect(x1, y1, x2 - x1, y2 - y1);
    }
    // roads
    let segs2 = 0;
    for (const s of this.city.minimapSegments) {
      const [x1, y1] = proj(s.x1, s.z1), [x2, y2] = proj(s.x2, s.z2);
      if (Math.max(x1, x2) < cx - R || Math.min(x1, x2) > cx + R || Math.max(y1, y2) < cy - R || Math.min(y1, y2) > cy + R) continue;
      c.strokeStyle = s.main ? 'rgba(232,210,168,.78)' : 'rgba(148,166,170,.52)';
      c.lineWidth = Math.max(1.6, s.w * scale * 0.5);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); segs2++;
    }
    this.lastRoadSegments = segs2;
    // extruded building blocks
    for (const b of this.city.buildings) {
      const [x1, y1] = proj(b.x - b.w / 2, b.z - b.d / 2), [x2] = proj(b.x + b.w / 2, b.z - b.d / 2);
      const [x4, y4] = proj(b.x - b.w / 2, b.z + b.d / 2), [x3] = proj(b.x + b.w / 2, b.z + b.d / 2);
      if (Math.max(x1, x2) < cx - R || Math.min(x1, x2) > cx + R || Math.max(y1, y4) < cy - R || Math.min(y1, y4) > cy + R) continue;
      const e = clamp(b.h * scale * 0.62, 2.2, 22);
      c.fillStyle = tint(b.color, 0.2);
      c.beginPath(); c.moveTo(x4, y4); c.lineTo(x3, y4); c.lineTo(x3, y4 - e); c.lineTo(x4, y4 - e); c.closePath(); c.fill();
      c.fillStyle = tint(b.color, 0.13);
      c.beginPath(); c.moveTo(x3, y4); c.lineTo(x3, y4 - e); c.lineTo(x2, y1 - e); c.lineTo(x2, y1); c.closePath(); c.fill();
      c.fillStyle = tint(b.color, 0.36);
      c.beginPath(); c.moveTo(x1, y1 - e); c.lineTo(x2, y1 - e); c.lineTo(x3, y4 - e); c.lineTo(x4, y4 - e); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.09)'; c.lineWidth = 0.6; c.stroke();
      if (b.h > 40) { c.fillStyle = 'rgba(255,206,128,.5)'; c.fillRect(x1 + (x3 - x1) * 0.3, y1 - e + (y4 - y1) * 0.3, 1.2, 1.2); }
    }
    // search radius
    if (pol && pol.wanted > 0 && pol.status === 'SEARCHING') {
      const [sx, sy] = proj(pol.lastSeen.x, pol.lastSeen.z);
      c.strokeStyle = 'rgba(255,92,82,.65)'; c.setLineDash([4, 3]); c.lineWidth = 1;
      c.beginPath(); c.arc(sx, sy, 42, 0, 7); c.stroke(); c.setLineDash([]);
    }
    // mission marker
    if (missionSet) {
      const mp = missionSet.markerPos();
      if (mp) {
        let [mx, my] = proj(mp.x, mp.z);
        const d = Math.hypot(mx - cx, my - cy);
        if (d > R - 9) { mx = cx + (mx - cx) / d * (R - 9); my = cy + (my - cy) / d * (R - 9); }
        c.save(); c.translate(mx, my); c.rotate(Math.PI / 4);
        c.fillStyle = GOLD; c.shadowColor = 'rgba(255,200,90,.9)'; c.shadowBlur = 8;
        c.fillRect(-3.6, -3.6, 7.2, 7.2); c.restore();
        c.strokeStyle = '#3a2a12'; c.lineWidth = 1; c.strokeRect(mx - 3.6, my - 3.6, 7.2, 7.2);
      }
    }
    // police + helicopter blips
    if (pol) {
      for (const u of pol.units) {
        const [bx, by] = proj(u.v.pos.x, u.v.pos.z);
        if (Math.hypot(bx - cx, by - cy) < R) {
          c.fillStyle = Math.sin(this.t * 10) > 0 ? RED : BLUE;
          c.beginPath(); c.arc(bx, by, 2.7, 0, 7); c.fill();
        }
      }
      if (pol.heli.active) {
        const [hx, hy] = proj(pol.heli.g.position.x, pol.heli.g.position.z);
        if (Math.hypot(hx - cx, hy - cy) < R) {
          c.fillStyle = BLUE; c.beginPath(); c.arc(hx, hy, 4, 0, 7); c.fill();
          c.fillStyle = '#08121c'; c.font = `800 6px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('K', hx, hy + 0.4);
        }
      }
    }
    // player arrow
    const ang = Math.atan2(Math.sin(p.heading), Math.cos(p.heading));
    c.save(); c.translate(cx, cy); c.scale(1, 0.82); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 8.5); c.lineTo(-5.6, -5.6); c.lineTo(0, -2.6); c.lineTo(5.6, -5.6); c.closePath();
    c.fillStyle = '#fff6e0'; c.fill(); c.strokeStyle = '#16232b'; c.lineWidth = 1.5; c.stroke(); c.restore();
    c.restore();
    // glass rim
    c.beginPath(); c.arc(cx, cy, R, 0, 7); c.strokeStyle = 'rgba(255,255,255,.26)'; c.lineWidth = 1.6; c.stroke();
    c.beginPath(); c.arc(cx, cy, R - 2.6, Math.PI * 1.08, Math.PI * 1.92); c.strokeStyle = 'rgba(255,255,255,.11)'; c.lineWidth = 1; c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 6;
      const r1 = R - (i % 3 === 0 ? 6 : 3.5);
      c.strokeStyle = i % 3 === 0 ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.18)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.lineTo(cx + Math.cos(a) * (R - 1), cy + Math.sin(a) * (R - 1)); c.stroke();
    }
    this.text('N', cx, cy - R + 11, 9, 'rgba(255,255,255,.7)', 800, 'center', 0.6);
  }

  drawVitals(st, p) {
    const x = 24, y = 648, w = 188;
    this.panel(x - 12, y - 8, w + 24, 70, 8, null, 'rgba(8,12,17,.62)', 'rgba(8,12,17,.4)');
    const c = this.ctx; c.save(); c.shadowColor = 'rgba(0,0,0,.8)'; c.shadowBlur = 4;
    this.text('HEALTH', x, y, 8.5, DIM, 800, 'left', 1.3);
    this.text(String(Math.round(p.health)), x + w, y, 9, CREAM, 800, 'right');
    this.bar(x, y + 8, w, 6, p.health / 100, p.health > 35 ? '#6fe08e' : RED);
    this.text('ARMOUR', x, y + 24, 8.5, DIM, 800, 'left', 1.3);
    this.text(String(Math.round(p.armour)), x + w, y + 24, 9, CREAM, 800, 'right');
    this.bar(x, y + 32, w, 6, p.armour / 100, TEAL);
    this.text(`RANK ${st.rank + 1} · ${st.rankName}`, x, y + 50, 8.5, AMBER, 800, 'left', 0.9);
    this.text(`XP ${st.respect % 500}/500`, x + w, y + 50, 8.5, DIM, 600, 'right');
    this.bar(x, y + 58, w, 3.5, (st.respect % 500) / 500, AMBER);
    c.restore();
  }

  drawDialogue(st, m) {
    const line = m && m.line;
    if (!line) return;
    const x = 372, y = 594, w = 536, h = 92;
    this.panel(x, y, w, h, 12, AMBER, 'rgba(11,16,22,.9)', 'rgba(5,8,12,.86)');
    const c = this.ctx;
    c.beginPath(); c.arc(x + 46, y + 46, 25, 0, 7);
    const pg = c.createLinearGradient(x + 21, y + 21, x + 71, y + 71);
    pg.addColorStop(0, 'rgba(255,195,106,.24)'); pg.addColorStop(1, 'rgba(255,120,70,.1)');
    c.fillStyle = pg; c.fill(); c.strokeStyle = 'rgba(255,195,106,.55)'; c.lineWidth = 1.2; c.stroke();
    this.text(line.speaker.slice(0, 1), x + 46, y + 47, 19, GOLD, 800, 'center');
    this.text(line.speaker.toUpperCase(), x + 84, y + 27, 11, GOLD, 800, 'left', 1.0);
    this.text(line.role, x + 84, y + 43, 8.5, DIM, 600, 'left', 0.4);
    this.text(line.text, x + 84, y + 68, 12.5, CREAM, 500);
  }

  drawVehicle(st, v) {
    if (!v) {
      this.text('ON FOOT', 1256, 574, 10, DIM, 800, 'right', 1.5);
      this.text('♪ COBALTO 104.7 — Noche Azul', 1256, 698, 9, DIM, 500, 'right', 0.4);
      return;
    }
    const spd = Math.round(Math.abs(v.speed) * 3.6);
    const c = this.ctx; c.save(); c.shadowColor = 'rgba(0,0,0,.85)'; c.shadowBlur = 6;
    this.text(String(spd), 1214, 586, 54, CREAM, 800, 'right');
    this.text('KM/H', 1256, 606, 9.5, DIM, 800, 'right', 1.4);
    const gear = spd < 4 ? 'N' : spd < 28 ? 'G1' : spd < 55 ? 'G2' : spd < 85 ? 'G3' : spd < 115 ? 'G4' : 'G5';
    this.text(gear, 1256, 626, 10, AMBER, 800, 'right', 0.9);
    this.text(v.spec.name.toUpperCase(), 1256, 642, 9.5, CREAM, 700, 'right', 0.9);
    this.text('CONDITION', 1128, 660, 7.5, DIM, 800, 'left', 0.9);
    this.bar(1128, 668, 128, 4.5, v.health / 100, v.health > 40 ? TEAL : RED);
    c.restore();
    this.text('♪ COBALTO 104.7 — Noche Azul', 1256, 698, 9, DIM, 500, 'right', 0.4);
  }

  drawToasts(st) {
    if (!st.toasts) return;
    st.toasts.slice(-4).forEach((t, i) => {
      const a = clamp(t.t / 0.5, 0, 1);
      this.ctx.globalAlpha = a;
      const y = 96 + i * 26;
      this.panel(640 - 92, y - 11, 184, 22, 5, null, 'rgba(9,13,19,.88)', 'rgba(9,13,19,.78)');
      this.text(t.text, 640, y, 10, t.color || AMBER, 800, 'center', 1.2);
      this.ctx.globalAlpha = 1;
    });
  }

  drawCrosshair(st) {
    const c = this.ctx, x = 640, y = 360;
    const aim = st.player.aim || st.mode === 'aim';
    c.globalAlpha = aim ? 0.95 : 0.5;
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
