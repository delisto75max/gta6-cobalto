// menus.js — title, pause, city map, settings, controls, death and the ending card, all painted on
// the same 2D canvas as the HUD so the game needs no DOM screens.
const CREAM = '#f6ead8';
const MUTED = '#c0b19a';
const GOLD = '#ffcf6b';
const INK = 'rgba(8,14,17,0.86)';

function font(ctx, size, weight = 500) {
  ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
}

function spaced(ctx, str, x, y, spacing = 0) {
  if (!('letterSpacing' in ctx)) { ctx.fillText(str, x, y); return; }
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  ctx.letterSpacing = '0px';
}

function panel(ctx, x, y, w, h, r = 10, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.strokeStyle = 'rgba(246,234,216,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function titleSky(ctx, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, 540);
  sky.addColorStop(0, '#0d3b50');
  sky.addColorStop(0.45, '#4f97a4');
  sky.addColorStop(0.72, '#e7ad76');
  sky.addColorStop(1, '#ffd39a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1280, 720);

  // sun over the bay
  const sx = 870, sy = 400;
  const glow = ctx.createRadialGradient(sx, sy, 6, sx, sy, 260);
  glow.addColorStop(0, 'rgba(255,245,210,0.98)');
  glow.addColorStop(0.16, 'rgba(255,214,150,0.75)');
  glow.addColorStop(0.55, 'rgba(255,170,100,0.2)');
  glow.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 280, sy - 280, 560, 560);
  ctx.fillStyle = '#fff2c9';
  ctx.beginPath(); ctx.arc(sx, sy, 34, 0, Math.PI * 2); ctx.fill();

  // clouds
  for (let i = 0; i < 5; i += 1) {
    const cx = 120 + i * 270 + Math.sin(t * 0.02 + i) * 20;
    const cy = 120 + (i % 3) * 55;
    const cg = ctx.createRadialGradient(cx, cy, 4, cx, cy, 80);
    cg.addColorStop(0, 'rgba(255,244,226,0.22)');
    cg.addColorStop(1, 'rgba(255,244,226,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(cx - 90, cy - 50, 180, 100);
  }

  // sea
  const sea = ctx.createLinearGradient(0, 500, 0, 720);
  sea.addColorStop(0, '#2d7d86');
  sea.addColorStop(0.5, '#155a6b');
  sea.addColorStop(1, '#0a3b4b');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 500, 1280, 220);
  for (let i = 0; i < 40; i += 1) {
    const y = 520 + i * 5;
    ctx.fillStyle = `rgba(255,215,160,${0.06 - i * 0.001})`;
    ctx.fillRect(0, y, 1280, 1);
  }
  // sun reflection
  for (let i = 0; i < 18; i += 1) {
    const w = 30 + (i % 4) * 26 + Math.sin(t * 0.8 + i) * 8;
    ctx.fillStyle = `rgba(255,214,150,${0.16 - i * 0.007})`;
    ctx.fillRect(sx - w / 2, 510 + i * 7, w, 3);
  }
}

function skyline(ctx) {
  const rng = (n) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  ctx.fillStyle = '#153f45';
  let x = -20;
  let i = 0;
  while (x < 1300) {
    const w = 34 + rng(i) * 80;
    const h = 60 + rng(i + 4) * 250;
    ctx.fillRect(x, 500 - h, w, h + 10);
    // windows
    ctx.fillStyle = 'rgba(255,205,140,0.22)';
    for (let yy = 500 - h + 12; yy < 490; yy += 14) {
      for (let xx = x + 7; xx < x + w - 7; xx += 12) {
        if (rng(xx * 3 + yy) > 0.45) ctx.fillRect(xx, yy, 3, 5);
      }
    }
    ctx.fillStyle = '#153f45';
    x += w + 8 + rng(i + 9) * 20;
    i += 1;
  }
  // palms at the edges
  ctx.strokeStyle = '#0d2b30';
  ctx.lineWidth = 7;
  for (const px of [80, 170, 1130, 1210]) {
    ctx.beginPath();
    ctx.moveTo(px, 520);
    ctx.quadraticCurveTo(px + 12, 400, px + 4, 320);
    ctx.stroke();
    ctx.lineWidth = 6;
    for (let f = 0; f < 7; f += 1) {
      const a = -Math.PI / 2 + (f - 3) * 0.4;
      ctx.beginPath();
      ctx.moveTo(px + 4, 320);
      ctx.quadraticCurveTo(px + 4 + Math.cos(a) * 70, 320 + Math.sin(a) * 45 - 20, px + 4 + Math.cos(a) * 120, 320 + Math.sin(a) * 80 + 15);
      ctx.stroke();
    }
    ctx.lineWidth = 7;
  }
}

export function drawTitle(ctx, t, index, options) {
  titleSky(ctx, t);
  skyline(ctx);
  const fade = ctx.createLinearGradient(0, 0, 0, 300);
  fade.addColorStop(0, 'rgba(4,12,15,0.5)');
  fade.addColorStop(1, 'rgba(4,12,15,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 1280, 300);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = CREAM;
  font(ctx, 108, 800);
  spaced(ctx, 'COBALTO', 64, 168, 10);
  ctx.fillStyle = GOLD;
  font(ctx, 21, 600);
  spaced(ctx, 'BAHÍA CALIENTE', 70, 202, 12);
  ctx.fillStyle = MUTED;
  font(ctx, 12, 500);
  spaced(ctx, 'A COASTAL CRIME STORY · GOLDEN HOUR · SIX DISTRICTS', 72, 228, 3);
  ctx.restore();

  // a police helicopter and a red/blue glow on the water keep the cover in the crime genre
  ctx.save();
  ctx.fillStyle = 'rgba(8,16,18,0.9)';
  ctx.beginPath();
  ctx.ellipse(1042, 196, 34, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(1008, 191, 16, 6);
  ctx.fillRect(1074, 193, 38, 4);
  ctx.fillRect(1106, 184, 4, 12);
  ctx.strokeStyle = 'rgba(8,16,18,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(1010, 184); ctx.lineTo(1074, 184); ctx.stroke();
  const beam = ctx.createLinearGradient(1042, 210, 860, 500);
  beam.addColorStop(0, 'rgba(255,228,170,0.30)');
  beam.addColorStop(1, 'rgba(255,228,170,0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(1042, 210); ctx.lineTo(830, 500); ctx.lineTo(920, 500); ctx.closePath(); ctx.fill();
  const rg = ctx.createRadialGradient(1010, 540, 0, 1010, 540, 46);
  rg.addColorStop(0, 'rgba(255,60,70,0.38)'); rg.addColorStop(1, 'rgba(255,60,70,0)');
  ctx.fillStyle = rg; ctx.fillRect(964, 494, 92, 92);
  const bg = ctx.createRadialGradient(1050, 548, 0, 1050, 548, 46);
  bg.addColorStop(0, 'rgba(70,120,255,0.34)'); bg.addColorStop(1, 'rgba(70,120,255,0)');
  ctx.fillStyle = bg; ctx.fillRect(1004, 502, 92, 92);
  ctx.restore();

  // menu

  const items = options;
  panel(ctx, 50, 266, 344, 208, 10, 0.78);
  const x = 72, y = 300;
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const active = i === index;
    if (active) {
      ctx.fillStyle = 'rgba(12,20,22,0.72)';
      ctx.fillRect(x - 14, y + i * 44 - 25, 300, 36);
      ctx.fillStyle = GOLD;
      ctx.fillRect(x - 14, y + i * 44 - 25, 3, 36);
    }
    ctx.fillStyle = active ? CREAM : MUTED;
    font(ctx, 20, active ? 700 : 500);
    ctx.textAlign = 'left';
    spaced(ctx, it.label, x, y + i * 44, active ? 2 : 0);
    if (it.note) {
      ctx.fillStyle = 'rgba(192,177,154,0.7)';
      font(ctx, 10, 500);
      ctx.fillText(it.note, x + 250, y + i * 44 - 3);
    }
  }

  ctx.fillStyle = 'rgba(246,234,216,0.65)';
  font(ctx, 11, 500);
  ctx.textAlign = 'left';
  ctx.fillText('↑ ↓  choose     ENTER  select     WASD  drive & walk     MOUSE  look     E  enter car', 72, 664);
  ctx.fillStyle = 'rgba(246,234,216,0.35)';
  font(ctx, 10, 500);
  ctx.fillText('COBALTO · an original game made for the Bahía Caliente bounty', 72, 688);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,207,107,0.7)';
  font(ctx, 10, 600);
  ctx.fillText('17:40 · 24°C · BAHÍA COBALTO', 1208, 664);
}

export function drawPause(ctx, index) {
  ctx.fillStyle = 'rgba(3,8,10,0.62)';
  ctx.fillRect(0, 0, 1280, 720);
  panel(ctx, 470, 150, 340, 420);
  ctx.textAlign = 'left';
  ctx.fillStyle = CREAM;
  font(ctx, 30, 800);
  spaced(ctx, 'PAUSED', 500, 205, 4);
  const items = ['RESUME', 'CITY MAP', 'SETTINGS', 'CONTROLS', 'SAVE GAME', 'QUIT TO TITLE'];
  for (let i = 0; i < items.length; i += 1) {
    const active = i === index;
    ctx.fillStyle = active ? GOLD : MUTED;
    font(ctx, 16, active ? 700 : 500);
    spaced(ctx, `${active ? '▸ ' : '   '}${items[i]}`, 500, 260 + i * 46, active ? 1.5 : 0);
  }
  ctx.fillStyle = 'rgba(246,234,216,0.45)';
  font(ctx, 10, 500);
  ctx.fillText('ESC resumes · ↑ ↓ choose · ENTER select', 500, 540);
}

export function drawMap(ctx, city, player, marker, missionTitle) {
  ctx.fillStyle = '#0b171b';
  ctx.fillRect(0, 0, 1280, 720);
  const scale = 0.48;
  const cx = 640, cy = 350;
  const mx = (x) => cx + (x - player.pos.x) * scale;
  const my = (z) => cy + (z - player.pos.z) * scale;

  // land / sea
  ctx.fillStyle = '#1a2d2b';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#0e4c5a';
  ctx.fillRect(0, my(640), 1280, 400);
  // districts
  const tints = { cerro: '#31402b', centro: '#3b3127', mercado: '#3d2e25', astillero: '#293234', marina: '#233b3a', playa: '#3c3527' };
  for (const d of city.districts) {
    ctx.fillStyle = tints[d.id] || '#333';
    ctx.fillRect(mx(d.x0), my(d.z0), (d.x1 - d.x0) * scale, (d.z1 - d.z0) * scale);
  }
  // blocks
  ctx.strokeStyle = 'rgba(200,180,150,0.12)';
  ctx.lineWidth = 1;
  for (const b of city.blocks) {
    ctx.strokeRect(mx(b.x0), my(b.z0), (b.x1 - b.x0) * scale, (b.z1 - b.z0) * scale);
  }
  // roads
  for (const r of city.roads) {
    ctx.strokeStyle = r.w > 15 ? '#d9c6a5' : '#a8977d';
    ctx.lineWidth = Math.max(2, r.w * scale * 0.8);
    ctx.beginPath();
    ctx.moveTo(mx(r.x1), my(r.z1));
    ctx.lineTo(mx(r.x2), my(r.z2));
    ctx.stroke();
  }
  // POIs
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const [key, p] of Object.entries(city.pois)) {
    const x = mx(p.x), y = my(p.z);
    ctx.fillStyle = '#ffcf6b';
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(246,234,216,0.8)';
    ctx.fillText(p.name.toUpperCase(), x, y - 7);
  }
  // marker
  if (marker) {
    const x = mx(marker.x), y = my(marker.z);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffcf6b';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
  }
  // player
  ctx.save();
  ctx.translate(mx(player.pos.x), my(player.pos.z));
  ctx.rotate(player.heading);
  ctx.fillStyle = CREAM;
  ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-6, -8); ctx.lineTo(0, -4); ctx.lineTo(6, -8); ctx.closePath(); ctx.fill();
  ctx.restore();

  // frame
  ctx.strokeStyle = 'rgba(246,234,216,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(28, 24, 1224, 672);
  ctx.textAlign = 'left';
  ctx.fillStyle = CREAM;
  font(ctx, 24, 800);
  spaced(ctx, 'BAHÍA COBALTO', 52, 62, 4);
  ctx.fillStyle = MUTED;
  font(ctx, 11, 500);
  spaced(ctx, 'CITY MAP · TAB TO CLOSE', 54, 84, 2);
  if (missionTitle) {
    ctx.fillStyle = GOLD;
    font(ctx, 12, 600);
    ctx.textAlign = 'right';
    ctx.fillText(`NEXT JOB · ${missionTitle}`, 1224, 66);
  }
  // legend
  panel(ctx, 980, 596, 244, 82, 8);
  ctx.textAlign = 'left';
  ctx.fillStyle = GOLD; ctx.fillRect(996, 615, 9, 9);
  ctx.fillStyle = MUTED; font(ctx, 10, 500); ctx.fillText('MISSION', 1012, 624);
  ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(1080, 619, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = MUTED; ctx.fillText('YOU', 1090, 624);
  ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(1150, 619, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = MUTED; ctx.fillText('PDC', 1160, 624);
  ctx.fillStyle = MUTED; ctx.fillText('N ↑', 996, 652);
}

export function drawSettings(ctx, settings, index) {
  ctx.fillStyle = 'rgba(3,8,10,0.72)';
  ctx.fillRect(0, 0, 1280, 720);
  panel(ctx, 430, 150, 420, 420);
  ctx.textAlign = 'left';
  ctx.fillStyle = CREAM;
  font(ctx, 28, 800);
  spaced(ctx, 'SETTINGS', 470, 205, 4);
  const rows = [
    ['VOLUME', `${Math.round(settings.volume * 100)}%`],
    ['MOUSE SENSITIVITY', settings.sensitivity.toFixed(2)],
    ['INVERT LOOK', settings.invertY ? 'ON' : 'OFF'],
    ['HUD SCALE', `${Math.round(settings.hudScale * 100)}%`],
  ];
  for (let i = 0; i < rows.length; i += 1) {
    const active = i === index;
    ctx.fillStyle = active ? GOLD : MUTED;
    font(ctx, 14, active ? 700 : 500);
    ctx.fillText(`${active ? '▸ ' : '  '}${rows[i][0]}`, 470, 270 + i * 52);
    ctx.textAlign = 'right';
    ctx.fillText(`◂ ${rows[i][1]} ▸`, 810, 270 + i * 52);
    ctx.textAlign = 'left';
  }
  ctx.fillStyle = 'rgba(246,234,216,0.4)';
  font(ctx, 10, 500);
  ctx.fillText('← → adjust · ESC back', 470, 540);
}

export function drawControls(ctx) {
  ctx.fillStyle = 'rgba(3,8,10,0.78)';
  ctx.fillRect(0, 0, 1280, 720);
  panel(ctx, 300, 90, 680, 560);
  ctx.textAlign = 'left';
  ctx.fillStyle = CREAM;
  font(ctx, 26, 800);
  spaced(ctx, 'CONTROLS', 340, 145, 4);
  const rows = [
    ['W A S D / ARROWS', 'walk, drive, steer'],
    ['MOUSE', 'look (click to lock the pointer), wheel zooms'],
    ['SHIFT', 'sprint on foot · handbrake in a car'],
    ['SPACE', 'jump'],
    ['E', 'enter / exit a car, talk, pick up'],
    ['LMB / RMB', 'fire / aim'],
    ['R', 'reload'],
    ['1 2 3 4 / Q', 'weapon slots'],
    ['H', 'horn'],
    ['TAB', 'city map'],
    ['[ ]', 'radio station'],
    ['F5 / F9', 'quick save / quick load'],
    ['ESC', 'pause'],
  ];
  for (let i = 0; i < rows.length; i += 1) {
    ctx.fillStyle = GOLD;
    font(ctx, 11, 700);
    ctx.fillText(rows[i][0], 340, 195 + i * 31);
    ctx.fillStyle = MUTED;
    font(ctx, 11, 500);
    ctx.fillText(rows[i][1], 560, 195 + i * 31);
  }
  ctx.fillStyle = 'rgba(246,234,216,0.4)';
  font(ctx, 10, 500);
  ctx.fillText('ESC back', 340, 620);
}

export function drawDead(ctx, t) {
  ctx.fillStyle = `rgba(40,6,8,${0.35 + Math.sin(t * 2) * 0.06})`;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  font(ctx, 68, 800);
  spaced(ctx, 'FLATLINE', 640, 340, 10);
  ctx.fillStyle = CREAM;
  font(ctx, 14, 500);
  ctx.fillText('The bay spits you out at the hospital. $250 and your heat, gone.', 640, 386);
  ctx.fillStyle = 'rgba(246,234,216,0.55)';
  font(ctx, 11, 500);
  ctx.fillText('ENTER  respawn', 640, 430);
}

export function drawEnding(ctx, t, state) {
  ctx.fillStyle = 'rgba(4,10,12,0.78)';
  ctx.fillRect(0, 0, 1280, 720);
  const g = ctx.createRadialGradient(640, 300, 10, 640, 300, 500);
  g.addColorStop(0, 'rgba(255,200,120,0.14)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  font(ctx, 12, 700);
  spaced(ctx, 'THE BAY IS YOURS', 640, 220, 6);
  ctx.fillStyle = CREAM;
  font(ctx, 76, 800);
  spaced(ctx, 'HIGH TIDE', 640, 310, 8);
  ctx.fillStyle = MUTED;
  font(ctx, 15, 500);
  ctx.fillText('Rafa Cordero walked into the lighthouse with nothing and walked out with the coast.', 640, 360);
  ctx.fillText(`Cash $${(state.cash || 0).toLocaleString('en-US')} · Respect ${state.respect || 0} · Eight jobs closed`, 640, 392);
  ctx.fillStyle = 'rgba(246,234,216,0.5)';
  font(ctx, 11, 500);
  ctx.fillText('ENTER  back to the city', 640, 470);
}
