// Shot runner: node scripts/shoot.mjs [1|2|3|4|all] [--port 8080] [--out screenshots]
//
// Opens each staged scene in headless Chromium, waits for window.__shotReady, reads the numbers in
// window.__shotDebug, asserts the acceptance table from docs/BUILD_SPEC.md §0a, and captures a
// 1280x720 JPEG under 256 KiB. It never edits a scene: a short number means the scene must move.
// Node 22, standard library only (CDP over the browser's own WebSocket).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const which = args.find((a) => /^[1-4]$|^all$/.test(a)) ?? 'all';
const portArg = args.indexOf('--port');
const httpPort = portArg === -1 ? 8080 : Number(args[portArg + 1]);
const outArg = args.indexOf('--out');
const outDir = resolve(outArg === -1 ? 'screenshots' : args[outArg + 1]);
const chrome = process.env.CHROME_BIN || '/home/eris/.local/bin/chromium';
const names = { 1: '1-avenida-chase', 2: '2-la-marina', 3: '3-firefight', 4: '4-bahia-wide' };
const shots = which === 'all' ? [1, 2, 3, 4] : [Number(which)];
const READY_TIMEOUT = Number(process.env.SHOT_TIMEOUT_MS || 60000);

mkdirSync(outDir, { recursive: true });
const profile = `${process.env.TMPDIR || '/tmp'}/mf-shot-profile-${process.pid}`;
const dbg = 9333 + (process.pid % 200);
const proc = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--window-size=1280,720', 'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] });

const fail = (msg) => { console.error(`shoot: ${msg}`); try { proc.kill('SIGKILL'); } catch {} process.exit(1); };

async function version() {
  for (let i = 0; i < 120; i += 1) {
    try { const res = await fetch(`http://127.0.0.1:${dbg}/json/version`); if (res.ok) return await res.json(); } catch {}
    await sleep(100);
  }
  fail('Chromium did not open its debugging port');
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method) this.events.push(msg);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function openWs(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
  return new CDP(ws);
}

function jpegSize(buf) {
  for (let i = 2; i < buf.length - 9;) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

// The acceptance table, kept in one place. Extra fields in __shotDebug that the table does not
// mention are printed for the operator but do not decide a shot.
function judge(n, d) {
  const checks = [];
  const add = (name, ok, value, need) => checks.push({ name, ok: Boolean(ok), value, need });
  if (!d) return [{ name: 'debug object', ok: false, value: 'missing', need: 'present' }];
  if (n === 1) {
    add('trafficNear', d.trafficNear >= 8, d.trafficNear, '>= 8');
    add('pedsNear', d.pedsNear >= 12, d.pedsNear, '>= 12');
    add('policeClose', d.policeClose >= 2, d.policeClose, '>= 2');
    add('roadblockUnits', d.roadblockUnits >= 2, d.roadblockUnits, '>= 2');
    add('roadblockDist', d.roadblockDist >= 80 && d.roadblockDist <= 110, d.roadblockDist, '80..110');
    add('heli.dist', d.heli && d.heli.dist >= 20 && d.heli.dist <= 40, d.heli?.dist, '20..40');
    add('heli.onScreen', d.heli?.onScreen === true, d.heli?.onScreen, 'true');
    add('heli.spotlightOnPlayer', d.heli?.spotlightOnPlayer === true, d.heli?.spotlightOnPlayer, 'true');
    add('minimapRoadSegments', d.minimapRoadSegments >= 25, d.minimapRoadSegments, '>= 25');
  } else if (n === 2) {
    add('pedsNear', d.pedsNear >= 12, d.pedsNear, '>= 12');
    add('police inside 40 m', (d.policeDistances || []).some((x) => x <= 40), d.policeDistances, 'one <= 40');
    add('police lights on', d.policeLights === true, d.policeLights, 'true');
    add('minimapRoadSegments', d.minimapRoadSegments >= 25, d.minimapRoadSegments, '>= 25');
  } else if (n === 3) {
    const officers = d.officers || [];
    const inRange = officers.filter((x) => x >= 8 && x <= 15).length;
    add('officers 8..15 m', inRange >= 2, officers, '2 in range');
    add('player muzzle', d.muzzlePlayer === true, d.muzzlePlayer, 'true');
    add('police muzzle', d.muzzlePolice === true, d.muzzlePolice, 'true');
    add('wanted', d.wanted === 3, d.wanted, '3');
    add('minimapRoadSegments', d.minimapRoadSegments >= 20, d.minimapRoadSegments, '>= 20');
  } else if (n === 4) {
    add('trafficNear', d.trafficNear >= 10, d.trafficNear, '>= 10');
    add('boats', d.boats >= 2, d.boats, '>= 2');
    add('minimapRoadSegments', d.minimapRoadSegments >= 30, d.minimapRoadSegments, '>= 30');
    add('fog clear of city', d.fogClear === true, d.fogClear, 'true');
  }
  add('errors', (d.errors || 0) === 0, d.errors, '0');
  add('fps', (d.fps || 0) >= 20, d.fps, '>= 20');
  return checks;
}

const v = await version();
console.log(`chromium ${v.Browser}`);
let failed = 0;

for (const n of shots) {
  const url = `http://127.0.0.1:${httpPort}/?shot=${n}`;
  const res = await fetch(`http://127.0.0.1:${dbg}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const target = await res.json();
  const cdp = await openWs(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.bringToFront');

  let ready = false;
  let dbgInfo = null;
  const started = Date.now();
  while (Date.now() - started < READY_TIMEOUT) {
    try {
      const r = await cdp.send('Runtime.evaluate', {
        expression: 'JSON.stringify({ready:window.__shotReady===true,debug:window.__shotDebug||null,error:window.__lastError||null})',
        returnByValue: true,
      });
      const parsed = JSON.parse(r.result?.value || '{}');
      if (parsed.debug) dbgInfo = parsed.debug;
      if (parsed.ready) { ready = true; break; }
      if (parsed.error) { console.log(`shot ${n}: page error: ${parsed.error}`); }
    } catch {}
    await sleep(300);
  }
  if (!ready) {
    const err = await cdp.send('Runtime.evaluate', {
      expression: '(window.__lastError||"no __shotReady")+" | "+document.title',
      returnByValue: true,
    }).catch(() => null);
    console.log(`shot ${n}: NOT READY after ${Math.round(READY_TIMEOUT / 1000)} s (${err?.result?.value ?? 'no value'})`);
  }

  const checks = judge(n, dbgInfo);
  console.log(`shot ${n}: debug=${JSON.stringify(dbgInfo)}`);
  for (const c of checks) {
    console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}: ${JSON.stringify(c.value)} (need ${c.need})`);
    if (!c.ok) failed += 1;
  }

  // Console and request problems seen between navigation and capture.
  const consoleProblems = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown'
    || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
    || (e.method === 'Network.loadingFailed' && !/ERR_ABORTED/.test(e.params.errorText)));
  for (const e of consoleProblems.slice(0, 8)) {
    const text = e.params?.exceptionDetails?.exception?.description || e.params?.args?.map((a) => a.value ?? a.description).join(' ') || e.params?.errorText;
    console.log(`  console: ${text}`);
    failed += 1;
  }

  await sleep(350);
  let quality = 90;
  let bytes;
  for (;;) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false });
    bytes = Buffer.from(shot.data, 'base64');
    if (bytes.length < 256 * 1024 || quality <= 52) break;
    quality -= 6;
  }
  const size = jpegSize(bytes);
  const file = resolve(outDir, `${names[n] || `shot-${n}`}.jpg`);
  writeFileSync(file, bytes);
  const dimsOk = size && size.w === 1280 && size.h === 720;
  const bytesOk = bytes.length < 256 * 1024;
  console.log(`shot ${n}: ${file} (${bytes.length} bytes, ${size?.w}x${size?.h}, q${quality}, ready=${ready}, ${bytesOk ? 'size ok' : 'TOO BIG'}${dimsOk ? '' : ', WRONG DIMENSIONS'})`);
  if (!ready || !bytesOk || !dimsOk) failed += 1;

  await cdp.send('Page.close').catch(() => {});
  try { cdp.ws.close(); } catch {}
}

try { proc.kill('SIGKILL'); } catch {}
console.log(failed === 0 ? 'all shots accepted' : `${failed} shot check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
