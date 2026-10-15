// Phone performance check: an iPhone-sized landscape screen with the CPU
// slowed down, timing the boot and the frame rate walking and driving.
//   python3 -m http.server 8123 &  then  npm run perf   (PROFILE=1 writes a CPU profile)
import { chromium } from 'playwright';
import fs from 'fs';
const URL = process.env.URL || 'http://localhost:8123/index.html?auth=local';
const SLOW = +(process.env.SLOW || 4);
const exe = process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const b = await chromium.launch({ executablePath: exe, args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW });
const t0 = Date.now();
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__rfg, null, { timeout: 120000 });
const bootMs = Date.now() - t0;
const timing = await p.evaluate(() => ({ js: performance.getEntriesByType('resource').filter(r => /\.js/.test(r.name)).length, marks: performance.getEntriesByType('measure').map(m => [m.name, Math.round(m.duration)]) }));
await p.click('text=New Game'); await p.fill('[data-name]', 'Perf'); await p.click('text=Hit the streets');
await p.waitForTimeout(2500);
// fps sampler: frame times inside the page
const sample = async (ms) => p.evaluate(ms => new Promise(res => {
  const ts = []; let last = performance.now(); const end = last + ms;
  const f = now => { ts.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else { ts.sort((a, b) => a - b); res({ fps: Math.round(1000 * ts.length / ts.reduce((a, b) => a + b, 0)), p50: +ts[ts.length >> 1].toFixed(1), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1), worst: +ts[ts.length - 1].toFixed(1) }); } };
  requestAnimationFrame(f);
}), ms);
const walk = await (async () => { await p.keyboard.down('KeyW'); const r = await sample(4000); await p.keyboard.up('KeyW'); return r; })();
// a car, then drive down a long road at speed through town
await p.evaluate(async () => { const S = await import('./js/core/state.js'); const { CARS } = await import('./js/data/cars.js'); const s = window.__rfg.game.s; const m = CARS.find(c => /Mustang/.test(c.model)) || CARS[0]; const c = S.newCar(m.id); s.cars.push(c); s.activeCar = c.uid; const w = window.__rfg.app.world; w.refreshCar(); w.inCar = true; w.paused = false; const v = w.vehicle; v.x = -400; v.z = 598; v.h = Math.PI / 2; v.sim.v = 20; w.cam.x = v.x; w.cam.z = v.z; });
await p.waitForTimeout(500);
if (process.env.PROFILE) await cdp.send('Profiler.enable'), await cdp.send('Profiler.start');
if (process.env.TRACE) await b.startTracing(p, { path: process.env.TRACE, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'cc', 'gpu'] });
await p.keyboard.down('KeyW');
const drive = await sample(6000);
await p.keyboard.up('KeyW');
if (process.env.TRACE) await b.stopTracing();
if (process.env.PROFILE) { const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(process.env.PROFILE, JSON.stringify(profile)); }
const st = await p.evaluate(() => { const w = window.__rfg.app.world; return { speed: Math.round(w.vehicle.speed), x: Math.round(w.vehicle.x), z: Math.round(w.vehicle.z), traffic: w.traffic.cars.length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) + 'MB' : '?' }; });
console.log(JSON.stringify({ slow: SLOW + 'x', bootMs, timing, walk, drive, st, errs }, null, 1));
await b.close();
