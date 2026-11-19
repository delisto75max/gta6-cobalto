// Screenshot runner: node scripts/shoot.mjs [1|2|3|4|all] [--port 8080] [--out screenshots]
// Launches headless Chromium, opens ?shot=N, waits for window.__shotReady, prints window.__shotDebug
// (the scene's own acceptance numbers), captures 1280x720 JPEG under 256 KiB. Node 22, stdlib only.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const which = (args.find((a) => /^[1-4]$|^all$/.test(a)) ?? 'all');
const portArg = args.indexOf('--port');
const httpPort = portArg === -1 ? 8080 : Number(args[portArg + 1]);
const outArg = args.indexOf('--out');
const outDir = resolve(outArg === -1 ? 'screenshots' : args[outArg + 1]);
const chrome = process.env.CHROME_BIN || '/home/eris/.local/bin/chromium';
const names = { 1: '1-avenida-chase', 2: '2-la-marina', 3: '3-firefight', 4: '4-bahia-wide' };
const shots = which === 'all' ? [1, 2, 3, 4] : [Number(which)];

mkdirSync(outDir, { recursive: true });
const profile = `/tmp/mf-shot-profile-${process.pid}`;
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
  for (let i = 0; i < 100; i += 1) {
    try { const res = await fetch(`http://127.0.0.1:${dbg}/json/version`); if (res.ok) return await res.json(); } catch {}
    await sleep(100);
  }
  fail('Chromium did not open its debugging port');
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && this.pending.has(msg.id)) { const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
  }; }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}

async function openWs(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
  return new CDP(ws);
}

const v = await version();
console.log(`chromium ${v.Browser}`);

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
  while (Date.now() - started < 45000) {
    try {
      const r = await cdp.send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
      if (r.result?.value) { ready = true; break; }
    } catch {}
    await sleep(250);
  }
  if (!ready) {
    const err = await cdp.send('Runtime.evaluate', { expression: '(window.__lastError||"no __shotReady")+" | "+document.title', returnByValue: true }).catch(() => null);
    console.log(`shot ${n}: NOT READY after 45 s (${err?.result?.value ?? 'no value'}) — capturing anyway`);
  }
  const dbgInfo = await cdp.send('Runtime.evaluate', { expression: 'JSON.stringify(window.__shotDebug||null)', returnByValue: true }).catch(() => null);
  console.log(`shot ${n}: debug=${dbgInfo?.result?.value ?? 'null'}`);
  await sleep(400);
  let quality = 86;
  let bytes;
  for (;;) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false });
    bytes = Buffer.from(shot.data, 'base64');
    if (bytes.length < 256 * 1024 || quality <= 55) break;
    quality -= 8;
  }
  const file = resolve(outDir, `${names[n] || `shot-${n}`}.jpg`);
  writeFileSync(file, bytes);
  console.log(`shot ${n}: ${file} (${bytes.length} bytes, q${quality}, ready=${ready})`);
  await cdp.send('Page.close').catch(() => {});
  try { cdp.ws.close(); } catch {}
}

try { proc.kill('SIGKILL'); } catch {}
process.exit(0);
