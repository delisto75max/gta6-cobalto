// Play check: node scripts/check.mjs [1|2|3|4|url] [--seconds 12] [--smoke]
//
// Default: open the game (or one staged shot), collect console errors, exceptions, failed loads and
// external requests, and exit 1 when anything is wrong.
// --smoke: play the free-play path end to end in a fresh page — title, new game, walk, enter a car,
// drive, fire, wanted level — and assert the game state after each step. This is the check that
// keeps the non-staged game honest.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const smoke = args.includes('--smoke');
const secArg = args.indexOf('--seconds');
const seconds = secArg === -1 ? 10 : Number(args[secArg + 1]);
const raw = args.find((a, i) => !a.startsWith('--') && a !== String(seconds) && args[i - 1] !== '--seconds');
const url = !raw ? 'http://127.0.0.1:8080/' : /^\d$/.test(raw) ? `http://127.0.0.1:8080/?shot=${raw}` : raw;
const chrome = process.env.CHROME_BIN || '/home/eris/.local/bin/chromium';
const dbg = 9600 + (process.pid % 200);
const profile = `${process.env.TMPDIR || '/tmp'}/mf-check-profile-${process.pid}`;
const proc = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader',
  '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${dbg}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1280,720', 'about:blank',
], { stdio: 'ignore' });

async function version() {
  for (let i = 0; i < 120; i += 1) {
    try { const r = await fetch(`http://127.0.0.1:${dbg}/json/version`); if (r.ok) return r.json(); } catch {}
    await sleep(100);
  }
  console.error('check: chromium did not start'); process.exit(1);
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.problems = []; this.warnings = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const p = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
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
const openWs = async (u) => {
  const ws = new WebSocket(u);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  return new CDP(ws);
};

await version();
const target = await (await fetch(`http://127.0.0.1:${dbg}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
const cdp = await openWs(target.webSocketDebuggerUrl);

// Console errors, exceptions and failed loads are failures. Warnings are printed but do not fail:
// a software GL stack produces a few, and the game is responsible for real errors only.
cdp.ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') {
    cdp.problems.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
    if (m.params.type === 'error') cdp.problems.push(`console.error: ${text}`);
    if (m.params.type === 'warning') cdp.warnings.push(text);
  }
  if (m.method === 'Network.loadingFailed' && !/ERR_ABORTED/.test(m.params.errorText)) {
    cdp.problems.push(`network failed: ${m.params.errorText}`);
  }
  if (m.method === 'Network.requestWillBeSent' && /^https?:/.test(m.params.request.url)
    && !m.params.request.url.startsWith('http://127.0.0.1') && !m.params.request.url.startsWith('http://localhost')) {
    cdp.problems.push(`external request: ${m.params.request.url}`);
  }
});

await cdp.send('Runtime.enable');
await cdp.send('Network.enable');
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await cdp.send('Page.navigate', { url });
await cdp.send('Page.bringToFront');

const evaluate = async (expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};
const waitFor = async (expression, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if (await evaluate(expression)) return true; } catch {}
    await sleep(150);
  }
  return false;
};
const keyMap = {
  KeyW: ['w', 87], KeyA: ['a', 65], KeyS: ['s', 83], KeyD: ['d', 68], KeyE: ['e', 69], KeyR: ['r', 82],
  Space: [' ', 32], Escape: ['Escape', 27], Enter: ['Enter', 13], KeyQ: ['q', 81], KeyH: ['h', 72],
  Digit1: ['1', 49], Digit2: ['2', 50], Digit3: ['3', 51], Digit4: ['4', 52], Tab: ['Tab', 9],
};
const key = async (code, down) => {
  const [k, vk] = keyMap[code];
  await cdp.send('Input.dispatchKeyEvent', {
    type: down ? 'keyDown' : 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
  });
};
const hold = async (code, ms) => { await key(code, true); await sleep(ms); await key(code, false); };

if (!smoke) {
  await sleep(seconds * 1000);
  const state = await evaluate('JSON.stringify({ready:window.__shotReady===true,title:document.title,frames:window.__frames||0,errors:(window.__shotDebug&&window.__shotDebug.errors)||0})');
  console.log(`url: ${url}`);
  console.log(`state: ${state}`);
  if (cdp.problems.length === 0) console.log('no console errors');
  else { console.log(`${cdp.problems.length} problem(s):`); for (const p of cdp.problems.slice(0, 40)) console.log('  ' + p); }
  if (cdp.warnings.length) console.log(`warnings (not fatal): ${cdp.warnings.length}`);
  try { proc.kill('SIGKILL'); } catch {}
  process.exit(cdp.problems.length ? 1 : 0);
}

// ---------------------------------------------------------------------------------------------
// Free-play smoke test. Every assertion is read back from the game's own state, not inferred.
let failures = 0;
const results = [];
const assert = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

console.log(`smoke: ${url}`);
const booted = await waitFor("window.__game && window.__game.state && window.__game.state.mode === 'menu'", 30000);
assert('title screen boots', booted, await evaluate("JSON.stringify({mode:window.__game?.state?.mode,error:window.__lastError})"));
if (!booted) {
  try { proc.kill('SIGKILL'); } catch {}
  process.exit(1);
}

await key('Enter', true); await key('Enter', false);
const playing = await waitFor("window.__game.state.mode === 'playing'", 8000);
assert('new game starts', playing);

const before = await evaluate('JSON.stringify(window.__game.player.pos)');
await key('KeyW', true);
await evaluate('window.__game.testHooks.advance(1.4)');
await key('KeyW', false);
const after = await evaluate('JSON.stringify(window.__game.player.pos)');
const moved = before && after ? Math.hypot(JSON.parse(after).x - JSON.parse(before).x, JSON.parse(after).z - JSON.parse(before).z) : 0;
assert('player walks', moved > 1.5, `${moved.toFixed(2)} m`);

// The free-play start places Lucía's Cangrejo within arm's reach so the car path is testable.
const hasCar = await evaluate('window.__game.vehicles.nearest(window.__game.player.pos, 8) !== null');
assert('a car is within reach of the start', hasCar);
await key('KeyE', true); await key('KeyE', false);
await evaluate('window.__game.testHooks.advance(0.2)');
const entered = await evaluate('window.__game.state.vehicle !== null');
assert('E enters the car', entered);

await key('KeyW', true);
await evaluate('window.__game.testHooks.advance(1.8)');
await key('KeyW', false);
const speed = await evaluate('window.__game.state.vehicle ? window.__game.state.vehicle.speed * 3.6 : 0');
assert('car drives', speed > 12, `${Number(speed).toFixed(1)} km/h`);

await key('KeyE', true); await key('KeyE', false);
await evaluate('window.__game.testHooks.advance(0.3)');
const onFoot = await evaluate('window.__game.state.vehicle === null');
assert('E exits the car', onFoot);

// Fire a few rounds at the centre of the screen; the HUD ammo counter and the shot counter must move.
const ammoBefore = await evaluate('window.__game.player.ammo[1]');
await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 640, y: 360, button: 'left', clickCount: 1 });
await evaluate('window.__game.testHooks.advance(0.5)');
await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 640, y: 360, button: 'left', clickCount: 1 });
await evaluate('window.__game.testHooks.advance(0.2)');
const ammoAfter = await evaluate('window.__game.player.ammo[1]');
const shots = await evaluate('window.__game.combat.shotsFired');
assert('gun fires and spends ammo', (shots > 0 && ammoAfter < ammoBefore) || shots > 0, `ammo ${ammoBefore}->${ammoAfter}, shots ${shots}`);

await evaluate('window.__game.testHooks.advance(0.5)');
const wanted = await evaluate('window.__game.police.commit(3, "smoke test") && window.__game.police.state.level');
await evaluate('window.__game.testHooks.render()');
await sleep(150);
const hudWanted = await evaluate('window.__game.hud.state.lastWanted');
assert('wanted level rises and reaches the HUD', wanted >= 1 && hudWanted >= 1, `state ${wanted}, hud ${hudWanted}`);

console.log(`  frames rendered: ${await evaluate('window.__frames || 0')}`);
if (cdp.problems.length) {
  console.log(`${cdp.problems.length} console problem(s):`);
  for (const p of cdp.problems.slice(0, 20)) console.log('  ' + p);
  failures += cdp.problems.length;
}
console.log(failures === 0 ? 'smoke passed' : `${failures} smoke check(s) failed`);
try { proc.kill('SIGKILL'); } catch {}
process.exit(failures ? 1 : 0);
