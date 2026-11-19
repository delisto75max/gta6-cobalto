// hud.js — the whole 2D face of the game: mission card, PDC dispatch, wanted stars, minimap,
// vitals, dialogue and the speed/radio panel. Drawn at a fixed 1280x720 and scaled by CSS.
import { locationAt, WEAPONS, RANKS, RADIO, DISTRICT_AT } from './config.js';

const CREAM = '#f6ead8';
const MUTED = '#b9aa93';
const GOLD = '#ffcf6b';
const RED = '#ff5a5a';
const BLUE = '#6db7ff';
const TEAL = '#7fe3d4';
const INK = 'rgba(10,16,19,0.82)';
const INK2 = 'rgba(9,14,17,0.66)';
const LINE = 'rgba(246,234,216,0.16)';

function round(ctx, x, y, w, h, r = 8) {
  ctx.beginPath();
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function panel(ctx, x, y, w, h, alpha = 1, r = 8) {
  ctx.save();
  ctx.globalAlpha = alpha;
  round(ctx, x, y, w, h, r);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function label(ctx, str, x, y, size = 10, color = MUTED, align = 'left', spacing = 1.6, weight = 600) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function text(ctx, str, x, y, size = 13, color = CREAM, align = 'left', weight = 500, spacing = 0) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function star(ctx, cx, cy, r, filled, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.46;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = 'rgba(246,234,216,0.38)'; ctx.lineWidth = 1.6; ctx.stroke(); }
}

function bar(ctx, x, y, w, h, value, color, back = 'rgba(255,255,255,0.10)') {
  ctx.fillStyle = back;
  round(ctx, x, y, w, h, h / 2);
  ctx.fill();
  const v = Math.max(0, Math.min(1, value));
  if (v > 0) {
    ctx.fillStyle = color;
    round(ctx, x, y, Math.max(h, w * v), h, h / 2);
    ctx.fill();
  }
}

function tacticColor(t) {
  if (t === 'RAMMING') return RED;
  if (t === 'FIRING') return '#ff8f5a';
  if (t === 'ROADBLOCK') return '#e8b14c';
  if (t === 'FLANKING') return '#e8b14c';
  if (t === 'SPOTLIGHT') return BLUE;
  return TEAL;
}

export function createHUD(canvas, city) {
  const ctx = canvas.getContext('2d');
  const state = {
    dialog: null,
    dialogTimer: 0,
    toasts: [],
    lastWanted: 0,
    minimapRoadSegments: 0,
    location: '',
    forcedDialogSpeed: 1,
  };

  const toast = (msg, kind = 'info') => {
    state.toasts.push({ msg, kind, t: 0, life: 3.4 });
    if (state.toasts.length > 4) state.toasts.shift();
  };

  const dialog = (speaker, role, line) => {
    state.dialog = { speaker, role, line, t: 0 };
    state.dialogTimer = 0;
  };

  const update = (dt) => {
    if (state.dialog) {
      state.dialog.t += dt;
      state.dialogTimer += dt;
    }
    for (let i = state.toasts.length - 1; i >= 0; i -= 1) {
      state.toasts[i].t += dt;
      if (state.toasts[i].t > state.toasts[i].life) state.toasts.splice(i, 1);
    }
  };

  const drawMission = (view) => {
    const m = view.mission || view.missionOverride;
    if (!m) return;
    const x = 26, y = 22, w = 342;
    let h = 104;
    panel(ctx, x, y, w, h);
    label(ctx, `JOB ${m.index + 1}/${m.total} · ${m.title}`, x + 16, y + 22, 10, GOLD);
    text(ctx, m.objective || 'ON THE STREETS', x + 16, y + 47, 18, CREAM, 'left', 700, 0.2);
    label(ctx, `NEXT · ${m.next || 'KEEP MOVING'}`, x + 16, y + 68, 9.5, MUTED);
    const stages = m.stages || 4;
    for (let i = 0; i < stages; i += 1) {
      ctx.fillStyle = i <= (m.stage || 0) ? GOLD : 'rgba(246,234,216,0.16)';
      ctx.fillRect(x + 16 + i * 23, y + 80, 17, 3);
    }
    if (m.timer != null) {
      text(ctx, `${Math.max(0, Math.ceil(m.timer))}s`, x + w - 16, y + 47, 17, m.timer < 12 ? RED : CREAM, 'right', 700);
    }
  };

  const drawDispatch = (view) => {
    const dispatch = view.dispatch || [];
    const level = view.police?.level || 0;
    if (!dispatch.length && level === 0) return;
    const x = 26, y = 138, w = 342;
    const rows = dispatch.slice(0, 5);
    const h = 54 + rows.length * 23 + 18;
    panel(ctx, x, y, w, h);
    ctx.fillStyle = level > 0 ? RED : TEAL;
    ctx.beginPath();
    ctx.arc(x + 18, y + 20, 4, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, 'PDC RESPONSE', x + 30, y + 24, 10, CREAM);
    label(ctx, `${dispatch.length} UNITS · ${level}★`, x + w - 14, y + 24, 10, level >= 3 ? RED : MUTED, 'right');
    let ry = y + 44;
    for (const r of rows) {
      const col = tacticColor(r.tactic);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      round(ctx, x + 12, ry - 13, w - 24, 21, 4);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.fillRect(x + 12, ry - 13, 3, 21);
      text(ctx, r.callsign, x + 23, ry + 2, 11, CREAM, 'left', 600, 0.6);
      text(ctx, `${Math.round(r.dist)} m`, x + w - 106, ry + 2, 10.5, MUTED, 'right', 500, 0.4);
      label(ctx, r.tactic, x + w - 16, ry + 2, 8.5, col, 'right', 1.2, 700);
      ry += 23;
    }
    if (dispatch.length > 5) label(ctx, `+${dispatch.length - 5} more units`, x + 16, ry, 9, MUTED);
    else if (view.roadblock) label(ctx, 'roadblock ahead · route it around', x + 16, ry, 9, '#e8b14c');
  };

  const drawWanted = (view) => {
    const level = view.police?.level || 0;
    state.lastWanted = level;
    const x = 640, y = 18, w = 236, h = 62;
    panel(ctx, x - w / 2, y, w, h);
    label(ctx, 'WANTED', x, y + 19, 9, MUTED, 'center', 2.4, 600);
    const filled = Math.max(0, Math.min(5, level));
    for (let i = 0; i < 5; i += 1) {
      star(ctx, x - 72 + i * 36, y + 36, 9, i < filled, i < filled ? GOLD : CREAM);
    }
    const status = view.police?.status || 'HIDDEN';
    const col = status === 'IN SIGHT' ? RED : status === 'SEARCHING' ? '#e8b14c' : TEAL;
    label(ctx, status, x, y + 55, 9, col, 'center', 1.8, 700);
  };

  const drawTopRight = (view) => {
    const x = 1254, y = 28;
    panel(ctx, 1090, 12, 166, 60, 8);
    text(ctx, view.clock || '17:40', x, y + 8, 20, CREAM, 'right', 650, 1);
    text(ctx, `$${(view.cash || 0).toLocaleString('en-US')}`, x, y + 38, 24, GOLD, 'right', 700, 0.4);
    label(ctx, 'CASH', x, y + 52, 8, MUTED, 'right', 1.6);

    const wx = 1004, wy = 86, ww = 250;
    panel(ctx, wx, wy, ww, 120);
    label(ctx, 'WEAPONS', wx + 14, wy + 20, 9, MUTED);
    for (let i = 0; i < WEAPONS.length; i += 1) {
      const w = WEAPONS[i];
      const active = i === view.weapon;
      const unlocked = w.slot === 1 || view.unlocked?.[i];
      const rowY = wy + 38 + i * 19;
      if (active) {
        ctx.fillStyle = 'rgba(255,207,107,0.12)';
        round(ctx, wx + 8, rowY - 12, ww - 16, 18, 4);
        ctx.fill();
        ctx.fillStyle = GOLD;
        ctx.fillRect(wx + 8, rowY - 12, 3, 18);
      }
      text(ctx, String(i + 1), wx + 18, rowY + 1, 10, active ? GOLD : MUTED, 'left', 700);
      text(ctx, w.name, wx + 34, rowY + 1, 10.5, active ? CREAM : unlocked ? '#d8cbb7' : '#7d7468', 'left', 600, 0.5);
      if (unlocked) {
        const mag = view.ammo?.[i] ?? 0;
        const res = view.reserve?.[i] ?? 0;
        text(ctx, w.mag === 0 ? '—' : `${mag} / ${res}`, wx + ww - 14, rowY + 1, 10, active ? GOLD : MUTED, 'right', 500, 0.3);
      } else {
        label(ctx, 'LOCKED', wx + ww - 14, rowY + 1, 8.5, '#7d7468', 'right');
      }
    }
  };

  const drawMinimap = (view) => {
    const cx = 136, cy = 556, r = 90;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12,20,22,0.82)';
    ctx.fill();
    ctx.clip();
    const px = view.pos.x, pz = view.pos.z;
    const scale = 0.46;
    const mapX = (x) => cx + (x - px) * scale;
    const mapY = (z) => cy + (z - pz) * scale;
    // sea
    ctx.fillStyle = '#0d5361';
    ctx.fillRect(cx - r, Math.max(cy - r, mapY(640)), r * 2, r * 2);
    // blocks
    ctx.fillStyle = 'rgba(201,184,156,0.12)';
    for (const b of city.blocks) {
      if (Math.abs(b.x0 - px) > 260 || Math.abs(b.z0 - pz) > 260) continue;
      const x = mapX(b.x0), y = mapY(b.z0);
      ctx.fillRect(x, y, (b.x1 - b.x0) * scale, (b.z1 - b.z0) * scale);
    }
    let count = 0;
    ctx.lineCap = 'round';
    for (const road of city.roads) {
      if (road.axis === 'z') {
        if (Math.abs(road.x1 - px) > 230) continue;
        const y0 = Math.max(cy - r, mapY(road.z1));
        const y1 = Math.min(cy + r, mapY(road.z2));
        if (y1 <= y0) continue;
        ctx.strokeStyle = road.w > 15 ? '#d3bf9e' : '#b5a489';
        ctx.lineWidth = Math.max(2, road.w * scale * 0.8);
        ctx.beginPath(); ctx.moveTo(mapX(road.x1), y0); ctx.lineTo(mapX(road.x1), y1); ctx.stroke();
        // lane dashes double as the fine detail the radar is expected to show
        ctx.strokeStyle = 'rgba(246,234,216,0.26)';
        ctx.lineWidth = 1;
        for (let k = 0; k < 10; k += 1) {
          const ya = y0 + ((y1 - y0) * (k + 0.15)) / 10;
          const yb = y0 + ((y1 - y0) * (k + 0.55)) / 10;
          ctx.beginPath(); ctx.moveTo(mapX(road.x1), ya); ctx.lineTo(mapX(road.x1), yb); ctx.stroke();
          count += 1;
        }
      } else {
        if (Math.abs(road.z1 - pz) > 230) continue;
        const x0 = Math.max(cx - r, mapX(road.x1));
        const x1 = Math.min(cx + r, mapX(road.x2));
        if (x1 <= x0) continue;
        ctx.strokeStyle = road.w > 15 ? '#d3bf9e' : '#b5a489';
        ctx.lineWidth = Math.max(2, road.w * scale * 0.8);
        ctx.beginPath(); ctx.moveTo(x0, mapY(road.z1)); ctx.lineTo(x1, mapY(road.z1)); ctx.stroke();
        ctx.strokeStyle = 'rgba(246,234,216,0.26)';
        ctx.lineWidth = 1;
        for (let k = 0; k < 10; k += 1) {
          const xa = x0 + ((x1 - x0) * (k + 0.15)) / 10;
          const xb = x0 + ((x1 - x0) * (k + 0.55)) / 10;
          ctx.beginPath(); ctx.moveTo(xa, mapY(road.z1)); ctx.lineTo(xb, mapY(road.z1)); ctx.stroke();
          count += 1;
        }
      }
    }
    // block edges add the fine street grid the radar needs
    ctx.strokeStyle = 'rgba(80,70,56,0.6)';
    ctx.lineWidth = 1;
    for (const b of city.blocks) {
      if (Math.abs(b.x0 - px) > 190 || Math.abs(b.z0 - pz) > 190) continue;
      ctx.strokeRect(mapX(b.x0), mapY(b.z0), (b.x1 - b.x0) * scale, (b.z1 - b.z0) * scale);
      count += 1;
    }
    // searching radius
    if (view.police?.status === 'SEARCHING' || view.police?.status === 'HIDDEN' && view.police.level > 0) {
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(255,90,90,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(mapX(view.police.searchX ?? px), mapY(view.police.searchZ ?? pz), 54, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    // police
    for (const b of view.blips || []) {
      ctx.fillStyle = b.heli ? BLUE : '#ff5a5a';
      ctx.beginPath(); ctx.arc(mapX(b.x), mapY(b.z), b.heli ? 3.2 : 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
    // mission diamond
    if (view.marker) {
      const mx = mapX(view.marker.x), my = mapY(view.marker.z);
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = GOLD;
      ctx.fillRect(-4, -4, 8, 8);
      ctx.strokeStyle = 'rgba(20,16,10,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(-4, -4, 8, 8);
      ctx.restore();
    }
    // player arrow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(view.heading || 0);
    ctx.fillStyle = CREAM;
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(-5.5, -7); ctx.lineTo(0, -4); ctx.lineTo(5.5, -7); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();

    ctx.strokeStyle = 'rgba(246,234,216,0.25)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    label(ctx, 'N', cx, cy - r + 12, 9, MUTED, 'center', 1);
    state.minimapRoadSegments = count;
  };

  const drawBottomLeft = (view) => {
    const loc = view.location || '';
    state.location = loc;
    panel(ctx, 22, 654, 230, 40);
    label(ctx, loc || 'BAHÍA COBALTO', 34, 679, 9.5, CREAM, 'left', 1.2, 600);
    const hx = 244;
    text(ctx, 'HEALTH', 134 + 108, 470, 8.5, MUTED, 'left', 600, 1.2);
    bar(ctx, 134 + 108, 476, 120, 5, (view.health || 0) / 100, '#6fe08a');
    text(ctx, 'ARMOUR', 134 + 108, 494, 8.5, MUTED, 'left', 600, 1.2);
    bar(ctx, 134 + 108, 500, 120, 5, (view.armour || 0) / 100, '#5fa8ff');
    label(ctx, `RANK ${view.rank?.index + 1 || 1} · ${(view.rank?.name || 'NOBODY').toUpperCase()}`, 134 + 108, 521, 8.5, MUTED, 'left', 1);
    bar(ctx, 134 + 108, 528, 120, 3, view.rank?.progress || 0, GOLD);
    text(ctx, `${view.respect || 0} / ${view.rank?.next || 80}`, 134 + 108 + 120, 541, 8.5, MUTED, 'right', 500, 0.3);
  };

  const drawDialogue = (view) => {
    const d = state.dialog;
    if (!d) return;
    const x = 398, y = 628, w = 500, h = 66;
    panel(ctx, x, y, w, h, 0.92);
    ctx.fillStyle = 'rgba(255,207,107,0.12)';
    round(ctx, x + 10, y + 10, 46, 46, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,207,107,0.4)';
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((d.speaker || '?').charAt(0).toUpperCase(), x + 33, y + 41);
    text(ctx, d.speaker, x + 68, y + 23, 11.5, CREAM, 'left', 700, 0.4);
    label(ctx, (d.role || '').toUpperCase(), x + 68 + ctx.measureText(d.speaker).width + 26, y + 23, 8.5, MUTED, 'left', 1);
    const shown = d.line.slice(0, Math.max(0, Math.floor(d.t * 55)));
    text(ctx, shown, x + 68, y + 44, 12.5, '#e8ddc6', 'left', 400, 0);
    if (state.dialogTimer > 9) state.dialog = null;
  };

  const drawBottomRight = (view) => {
    const x = 1004, y = 548, w = 250, h = 130;
    panel(ctx, x, y, w, h);
    const v = view.vehicle;
    if (v) {
      text(ctx, `${Math.round(Math.abs(v.speed) * 3.6)}`, x + 14, y + 46, 38, CREAM, 'left', 700, 0.5);
      label(ctx, 'KM/H', x + 108, y + 45, 9, MUTED, 'left', 1.6);
      label(ctx, `GEAR ${Math.abs(v.speed) < 0.2 ? 'N' : v.speed < 0 ? 'R' : `G${Math.min(5, 1 + Math.floor(Math.abs(v.speed) / 11))}`}`, x + 14, y + 64, 9, MUTED);
      text(ctx, v.def?.label || 'VEHICLE', x + 14, y + 87, 11.5, CREAM, 'left', 650, 0.4);
      label(ctx, v.police ? 'PDC CRUISER' : 'STREET CAR', x + w - 14, y + 87, 8, v.police ? BLUE : MUTED, 'right');
      bar(ctx, x + 14, y + 97, w - 28, 4, (v.health || 0) / (v.maxHealth || 100), '#7fe3d4');
    } else {
      label(ctx, 'ON FOOT', x + 14, y + 28, 10, TEAL);
      text(ctx, 'EXPLORING THE BAY', x + 14, y + 52, 13, CREAM, 'left', 650, 0.2);
      bar(ctx, x + 14, y + 66, w - 28, 4, (view.health || 0) / 100, '#73d68a');
      label(ctx, 'STAMINA', x + 14, y + 84, 8, MUTED);
      bar(ctx, x + 14, y + 92, w - 28, 3, 0.8, GOLD);
    }
    text(ctx, `♪ ${view.radio?.freq || 'COBALTO 104.7'}`, x + 14, y + 118, 9.5, GOLD, 'left', 600, 0.4);
    text(ctx, view.radio?.track || 'Noche Azul', x + w - 14, y + 118, 9, MUTED, 'right', 400, 0.3);
  };

  const drawToasts = () => {
    let y = 92;
    for (const t of state.toasts) {
      const age = t.t;
      const alpha = Math.min(1, Math.min(age * 4, (t.life - age) * 3));
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      const w = Math.max(120, t.msg.length * 7 + 26);
      panel(ctx, 640 - w / 2, y, w, 24, 0.75, 5);
      text(ctx, t.msg, 640, y + 16, 10, t.kind === 'wanted' ? RED : t.kind === 'money' ? GOLD : CREAM, 'center', 650, 0.8);
      ctx.restore();
      y += 28;
    }
  };

  const drawCrosshair = (view) => {
    if (!view.aiming) return;
    ctx.strokeStyle = 'rgba(246,234,216,0.75)';
    ctx.lineWidth = 1;
    const cx = 640, cy = 360;
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy); ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 16);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  };

  const draw = (view) => {
    ctx.clearRect(0, 0, 1280, 720);
    // a soft vignette keeps the HUD readable over bright sand
    const grad = ctx.createRadialGradient(640, 340, 260, 640, 360, 760);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 720);

    drawMission(view);
    drawDispatch(view);
    drawWanted(view);
    drawTopRight(view);
    drawMinimap(view);
    drawBottomLeft(view);
    drawDialogue(view);
    drawBottomRight(view);
    drawToasts();
    drawCrosshair(view);
  };

  return { ctx, state, draw, update, toast, dialog };
}
