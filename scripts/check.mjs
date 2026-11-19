// Console / request / runtime checker for COBALTO.
// Usage: node scripts/check.mjs [url|1..4] [--port 8080] [--seconds 10] [--eval "expr"] [--shot]
// Prints console errors, exceptions, failed requests, window.__lastError and window.__shotDebug.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const num = (flag, d) => { const i = args.indexOf(flag); return i === -1 ? d : Number(args[i + 1]); };
const seconds = num('--seconds', 10);
const port = num('--port', 8080);
const evalIdx = args.indexOf('--eval');
const evalExpr = evalIdx === -1 ? null : args[evalIdx + 1];
const pngIdx = args.indexOf('--png');
const pngPath = pngIdx === -1 ? null : args[pngIdx + 1];
const raw = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--seconds' && args[i - 1] !== '--port' && args[i - 1] !== '--eval' && args[i - 1] !== '--png');
const url = !raw ? `http://127.0.0.1:${port}/` : /^\d$/.test(raw) ? `http://127.0.0.1:${port}/?shot=${raw}` : raw;
const chrome = process.env.CHROME_BIN || '/home/eris/.local/bin/chromium';
const dbg = 9600 + (process.pid % 300);
const profile = `/tmp/mf-check-profile-${process.pid}`;
const proc = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
  `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`, '--no-first-run',
  '--window-size=1280,720', 'about:blank',
], { stdio: 'ignore' });

const fail = (m) => { console.error('check: ' + m); try { proc.kill('SIGKILL'); } catch {} process.exit(1); };
async function version() {
  for (let i = 0; i < 120; i += 1) {
    try { const r = await fetch(`http://127.0.0.1:${dbg}/json/version`); if (r.ok) return r.json(); } catch {}
    await sleep(100);
  }
  fail('chromium did not start');
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  }; }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
const openWs = async (u) => { const ws = new WebSocket(u); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); }); return new CDP(ws); };

const v = await version();
console.log(`chromium ${v.Browser}`);
const target = await (await fetch(`http://127.0.0.1:${dbg}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
const cdp = await openWs(target.webSocketDebuggerUrl);
const problems = [];
cdp.ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) problems.push(`console.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
  if (m.method === 'Runtime.exceptionThrown') problems.push(`exception: ${m.params.exceptionDetails.text} ${m.params.exceptionDetails.exception?.description ?? ''}`);
  if (m.method === 'Network.loadingFailed') problems.push(`request failed: ${m.params.errorText}`);
  if (m.method === 'Network.requestWillBeSent' && /^https?:/.test(m.params.request.url) && !/^http:\/\/(127\.0\.0\.1|localhost)/.test(m.params.request.url)) problems.push(`external request: ${m.params.request.url}`);
});
await cdp.send('Runtime.enable');
await cdp.send('Network.enable');
await cdp.send('Page.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await sleep(seconds * 1000);
const state = await cdp.send('Runtime.evaluate', {
  expression: `JSON.stringify({ready:window.__shotReady===true,title:document.title,error:window.__lastError||null,debug:window.__shotDebug||null})`,
  returnByValue: true,
}).catch(() => ({ result: { value: '{}' } }));
console.log(`url: ${url}`);
console.log(`state: ${state.result?.value}`);
if (evalExpr) {
  const r = await cdp.send('Runtime.evaluate', { expression: evalExpr, returnByValue: true, awaitPromise: true }).catch((e) => ({ exceptionDetails: { text: e.message } }));
  console.log('eval:', JSON.stringify(r.result?.value ?? r.exceptionDetails?.text ?? r));
}
if (pngPath) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(pngPath, Buffer.from(shot.data, 'base64'));
  console.log('png:', pngPath);
}
if (!problems.length) console.log('no console errors');
else { console.log(`${problems.length} problem(s):`); for (const p of problems.slice(0, 60)) console.log('  ' + p); }
try { proc.kill('SIGKILL'); } catch {}
process.exit(problems.length ? 1 : 0);
