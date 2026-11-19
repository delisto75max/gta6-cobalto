// Console/error checker: node scripts/check.mjs [url-or-shot] [--seconds 12]
// Opens the game (default http://127.0.0.1:8080/), collects console errors, exceptions and failed
// requests for a few seconds, prints them, and exits 1 when something is wrong.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const secArg = args.indexOf('--seconds');
const seconds = secArg === -1 ? 12 : Number(args[secArg + 1]);
const raw = args.find((a) => !a.startsWith('--') && a !== String(seconds));
const url = !raw ? 'http://127.0.0.1:8080/' : /^\d$/.test(raw) ? `http://127.0.0.1:8080/?shot=${raw}` : raw;
const chrome = process.env.CHROME_BIN || '/home/eris/.local/bin/chromium';
const dbg = 9600 + (process.pid % 200);
const profile = `/tmp/mf-check-profile-${process.pid}`;
const proc = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1280,720', 'about:blank'], { stdio: 'ignore' });

async function version() {
  for (let i = 0; i < 100; i += 1) {
    try { const r = await fetch(`http://127.0.0.1:${dbg}/json/version`); if (r.ok) return r.json(); } catch {}
    await sleep(100);
  }
  console.error('check: chromium did not start'); process.exit(1);
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } }; }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); }); }
}
const openWs = async (u) => { const ws = new WebSocket(u); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); }); return new CDP(ws); };

await version();
const t = await (await fetch(`http://127.0.0.1:${dbg}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
const cdp = await openWs(t.webSocketDebuggerUrl);
const problems = [];
cdp.ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) problems.push(`console.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
  if (m.method === 'Runtime.exceptionThrown') problems.push(`exception: ${m.params.exceptionDetails.text} ${m.params.exceptionDetails.exception?.description ?? ''}`);
  if (m.method === 'Network.loadingFailed') problems.push(`network failed: ${m.params.errorText} ${m.params.requestId}`);
  if (m.method === 'Network.requestWillBeSent' && /^https?:/.test(m.params.request.url) && !m.params.request.url.startsWith('http://127.0.0.1') && !m.params.request.url.startsWith('http://localhost')) problems.push(`external request: ${m.params.request.url}`);
});
await cdp.send('Runtime.enable');
await cdp.send('Network.enable');
await cdp.send('Page.enable');
await cdp.send('Page.navigate', { url });
await sleep(seconds * 1000);
const state = await cdp.send('Runtime.evaluate', { expression: 'JSON.stringify({ready:window.__shotReady===true,title:document.title,frames:window.__frames||0})', returnByValue: true }).catch(() => ({ result: { value: '{}' } }));
console.log(`url: ${url}`);
console.log(`state: ${state.result?.value}`);
if (problems.length === 0) console.log('no console errors');
else { console.log(`${problems.length} problem(s):`); for (const p of problems.slice(0, 40)) console.log('  ' + p); }
try { proc.kill('SIGKILL'); } catch {}
process.exit(problems.length ? 1 : 0);
