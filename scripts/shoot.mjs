// Screenshot runner with acceptance gates.
// Usage: node scripts/shoot.mjs [1|2|3|4|all] [--port 8080] [--out screenshots]
// Opens ?shot=N in headless Chromium, waits for __shotReady, prints __shotDebug, checks the
// minimums in docs/BUILD_SPEC.md §0a, and captures a 1280x720 JPEG under 256 KiB.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const num = (flag, d) => { const i = args.indexOf(flag); return i === -1 ? d : Number(args[i + 1]); };
const which = args.find((a) => /^[1-4]$|^all$/.test(a)) ?? 'all';
const httpPort = num('--port', 8080);
const outArg = args.indexOf('--out');
const outDir = resolve(outArg === -1 ? 'screenshots' : args[outArg + 1]);
const chrome = process.env.CHROME_BIN || '/home/eris/.local/bin/chromium';
const names = { 1: '1-avenida-chase', 2: '2-la-marina', 3: '3-firefight', 4: '4-bahia-wide' };
const shots = which === 'all' ? [1, 2, 3, 4] : [Number(which)];

mkdirSync(outDir, { recursive: true });
const profile = `/tmp/mf-shot-profile-${process.pid}`;
const dbg = 9333 + (process.pid % 400);
const proc = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--window-size=1280,720', 'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] });

const fail = (msg) => { console.error(`shoot: ${msg}`); try { proc.kill('SIGKILL'); } catch {} process.exit(1); };
async function version() {
  for (let i = 0; i < 140; i += 1) {
    try { const res = await fetch(`http://127.0.0.1:${dbg}/json/version`); if (res.ok) return res.json(); } catch {}
    await sleep(100);
  }
  fail('Chromium did not open its debugging port');
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    };
  }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
const openWs = async (url) => { const ws = new WebSocket(url); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); }); return new CDP(ws); };

function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m === 0xc0 || m === 0xc1 || m === 0xc2 || m === 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

function accept(n, d) {
  const bad = [];
  const need = (name, ok, detail) => { if (!ok) bad.push(`${name}${detail ? ' (' + detail + ')' : ''}`); };
  if (!d) return ['no __shotDebug'];
  need('errors', !d.errors, `errors=${d.errors}`);
  if (n === 1) {
    need('trafficNear', d.trafficNear >= 8, `${d.trafficNear}/8`);
    need('pedsNear', d.pedsNear >= 12, `${d.pedsNear}/12`);
    need('policeClose', d.policeClose >= 2, `${d.policeClose}/2`);
    need('roadblockUnits', d.roadblockUnits >= 2, `${d.roadblockUnits}/2`);
    need('roadblockDist', d.roadblockDist >= 80 && d.roadblockDist <= 110, `${d.roadblockDist} (80-110)`);
    need('heli.dist', d.heli && d.heli.dist >= 20 && d.heli.dist <= 40, `${d.heli?.dist} (20-40)`);
    need('heli.onScreen', !!(d.heli && d.heli.onScreen));
    need('heli.spotlight', !!(d.heli && d.heli.spotlightOnPlayer));
    need('minimapRoadSegments', d.minimapRoadSegments >= 25, `${d.minimapRoadSegments}/25`);
  } else if (n === 2) {
    need('pedsNear', d.pedsNear >= 12, `${d.pedsNear}/12`);
    need('cruiser<=40m', Array.isArray(d.policeDistances) && d.policeDistances.some((x) => x <= 40), JSON.stringify(d.policeDistances));
    need('minimapRoadSegments', d.minimapRoadSegments >= 25, `${d.minimapRoadSegments}/25`);
  } else if (n === 3) {
    const officers = (d.officerDistances || []).filter((x) => x >= 8 && x <= 15).length;
    need('officers 8-15m', officers >= 2, `${officers}/2 ${JSON.stringify(d.officerDistances)}`);
    need('wanted', d.wanted === 3, `wanted=${d.wanted}`);
    need('muzzleFlashes', d.muzzleFlashes >= 2, `${d.muzzleFlashes}/2`);
    need('minimapRoadSegments', d.minimapRoadSegments >= 20, `${d.minimapRoadSegments}/20`);
  } else if (n === 4) {
    need('trafficNear', d.trafficNear >= 10, `${d.trafficNear}/10`);
    need('boats', d.boats >= 2, `${d.boats}/2`);
    need('minimapRoadSegments', d.minimapRoadSegments >= 30, `${d.minimapRoadSegments}/30`);
  }
  return bad;
}

const v = await version();
console.log(`chromium ${v.Browser}`);
let failures = 0;

for (const n of shots) {
  const url = `http://127.0.0.1:${httpPort}/?shot=${n}`;
  const res = await fetch(`http://127.0.0.1:${dbg}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const target = await res.json();
  const cdp = await openWs(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  let ready = false;
  const started = Date.now();
  while (Date.now() - started < 50000) {
    try {
      const r = await cdp.send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
      if (r.result?.value) { ready = true; break; }
    } catch {}
    await sleep(250);
  }
  if (!ready) {
    const err = await cdp.send('Runtime.evaluate', { expression: '(window.__lastError||"no __shotReady")+" | "+document.title', returnByValue: true }).catch(() => null);
    console.log(`shot ${n}: NOT READY after 50 s (${err?.result?.value ?? 'no value'}) — capturing anyway`);
  }
  const dbgInfo = await cdp.send('Runtime.evaluate', { expression: 'JSON.stringify(window.__shotDebug||null)', returnByValue: true }).catch(() => null);
  const debug = dbgInfo?.result?.value ? JSON.parse(dbgInfo.result.value) : null;
  console.log(`shot ${n}: debug=${dbgInfo?.result?.value ?? 'null'}`);
  const bad = ready ? accept(n, debug) : ['__shotReady'];
  if (bad.length) { failures += 1; console.log(`shot ${n}: FAIL  ${bad.join('; ')}`); }
  else console.log(`shot ${n}: PASS`);
  await sleep(400);
  let quality = 86, bytes;
  for (;;) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false });
    bytes = Buffer.from(shot.data, 'base64');
    if (bytes.length < 256 * 1024 || quality <= 55) break;
    quality -= 8;
  }
  const file = resolve(outDir, `${names[n] || `shot-${n}`}.jpg`);
  writeFileSync(file, bytes);
  const size = statSync(file).size;
  const dim = jpegSize(bytes);
  if (size > 256 * 1024) { failures += 1; console.log(`shot ${n}: FAIL  file ${size} bytes > 256 KiB`); }
  if (dim && (dim.w !== 1280 || dim.h !== 720)) { failures += 1; console.log(`shot ${n}: FAIL  ${dim.w}x${dim.h}, not 1280x720`); }
  console.log(`shot ${n}: ${file} (${size} bytes, q${quality}, ${dim ? `${dim.w}x${dim.h}` : 'jpeg'}, ready=${ready})`);
  await cdp.send('Page.close').catch(() => {});
  try { cdp.ws.close(); } catch {}
}

try { proc.kill('SIGKILL'); } catch {}
if (failures) { console.log(`\n${failures} shot issue(s)`); process.exit(1); }
console.log('\nall shots pass');
process.exit(0);
