// Free-play smoke test: title -> new game -> walk -> enter car -> drive -> fire -> wanted -> mission.
// Usage: node scripts/smoke.mjs [--port 8090] [--png out.png]
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const num = (f, d) => { const i = args.indexOf(f); return i === -1 ? d : Number(args[i + 1]); };
const port = num('--port', 8090);
const pngIdx = args.indexOf('--png');
const png = pngIdx === -1 ? null : args[pngIdx + 1];
const chrome = process.env.CHROME_BIN || '/home/eris/.local/bin/chromium';
const dbg = 9900 + (process.pid % 80);
const profile = `/tmp/mf-smoke-profile-${process.pid}`;
const proc = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`, '--no-first-run',
  '--window-size=1280,720', 'about:blank',
], { stdio: 'ignore' });

async function version() {
  for (let i = 0; i < 120; i++) { try { const r = await fetch(`http://127.0.0.1:${dbg}/json/version`); if (r.ok) return r.json(); } catch {} await sleep(100); }
  throw new Error('chromium did not start');
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } }; }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
const openWs = async (u) => { const ws = new WebSocket(u); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); }); return new CDP(ws); };
const evalv = async (cdp, expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result?.value;
};
const key = async (cdp, k, code, vk, down = true) => cdp.send('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
const tap = async (cdp, k, code, vk) => { await key(cdp, k, code, vk, true); await sleep(90); await key(cdp, k, code, vk, false); await sleep(120); };

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };

await version();
const target = await (await fetch(`http://127.0.0.1:${dbg}/json/new?${encodeURIComponent(`http://127.0.0.1:${port}/`)}`, { method: 'PUT' })).json();
const cdp = await openWs(target.webSocketDebuggerUrl);
const problems = [];
cdp.ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') problems.push(`exception: ${m.params.exceptionDetails.text} ${m.params.exceptionDetails.exception?.description ?? ''}`);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push(`console.error: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
});
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Page.bringToFront').catch(() => {});
await sleep(2500);
await evalv(cdp, 'window.__tick ? window.__tick(90) : 0');
let s = await evalv(cdp, 'JSON.stringify({mode:__state.mode,time:__state.time})').then(JSON.parse);
check('title screen boots', s.mode === 'title', `mode=${s.mode} time=${s.time.toFixed(2)}`);

await tap(cdp, 'Enter', 'Enter', 13);
await evalv(cdp, 'window.__tick(4)');
s = await evalv(cdp, 'JSON.stringify({mode:__state.mode})').then(JSON.parse);
check('new game starts', s.mode === 'playing', `mode=${s.mode}`);

const before = await evalv(cdp, 'JSON.stringify({x:__state.player.pos.x,z:__state.player.pos.z})').then(JSON.parse);
await key(cdp, 'w', 'KeyW', 87, true);
await evalv(cdp, 'window.__tick(70)');
await key(cdp, 'w', 'KeyW', 87, false);
const after = await evalv(cdp, 'JSON.stringify({x:__state.player.pos.x,z:__state.player.pos.z})').then(JSON.parse);
const walked = Math.hypot(after.x - before.x, after.z - before.z);
check('walk', walked > 0.8, `moved ${walked.toFixed(2)} m`);

await evalv(cdp, '(() => { const c=__traffic.cars.find(v=>v.type==="cangrejo"&&v.parked); if (c) { __state.player.pos.set(c.pos.x,0.15,c.pos.z+2.2); } return !!c; })()');
await evalv(cdp, 'window.__tick(1)');
await tap(cdp, 'e', 'KeyE', 69);
await evalv(cdp, 'window.__tick(3)');
s = await evalv(cdp, 'JSON.stringify({car:!!__state.player.inVehicle, name:__state.player.inVehicle?__state.player.inVehicle.spec.name:null})').then(JSON.parse);
check('enter car', s.car === true, s.name || 'no vehicle');

await key(cdp, 'w', 'KeyW', 87, true);
await evalv(cdp, 'window.__tick(100)');
await key(cdp, 'w', 'KeyW', 87, false);
s = await evalv(cdp, 'JSON.stringify({speed:__state.player.inVehicle?__state.player.inVehicle.speed:0, simple:__state.player.inVehicle?__state.player.inVehicle.simple:null, parts:__state.player.inVehicle?__state.player.inVehicle.group.children.length:0})').then(JSON.parse);
check('drive', s.speed > 4, `speed ${s.speed.toFixed(1)} m/s, detailed=${!s.simple}, parts=${s.parts}`);

const shot = await evalv(cdp, `(() => { const before=__police.wanted; const hit=__combat.fire(__state.player,__police,__peds,__traffic,__world.city); return JSON.stringify({wanted:__police.wanted,before,hit:!!hit}); })()`).then(JSON.parse);
check('fire weapon', shot.before !== undefined, `wanted ${shot.before} -> ${shot.wanted}`);
check('wanted level', shot.wanted > 0, `wanted=${shot.wanted}`);

s = await evalv(cdp, 'JSON.stringify({active:__missions.active,objective:__missions.objective(),index:__missions.index})').then(JSON.parse);
check('mission running', s.active === true && !!s.objective, `job ${s.index + 1} ${s.objective}`);

const hud = await evalv(cdp, 'JSON.stringify({w:__world.renderer.info.render.calls, err:window.__lastError})').then(JSON.parse);
check('no runtime error', !hud.err, hud.err || 'clean');
check('no console problems', problems.length === 0, problems.slice(0, 3).join(' | '));

if (png) {
  await evalv(cdp, 'window.__tick(1)');
  const im = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
  writeFileSync(png, Buffer.from(im.data, 'base64'));
  console.log('png:', png);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
try { proc.kill('SIGKILL'); } catch {}
process.exit(failed.length ? 1 : 0);
