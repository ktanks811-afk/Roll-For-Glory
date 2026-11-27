// Live engine audio test (real AudioContext, the AudioWorklet in real time): for a few builds, start the engine, idle,
// rev, and check the generator runs (fires, idles where it should, a big cam swings the idle more than stock), the output
// is clean (no NaN, no clipping runaway), and swapping builds rebuilds the voice.
// S = folder with npm/node_modules/three (three@0.128.0).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), S = process.env.S;
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', mp3: 'audio/mpeg', css: 'text/css', webmanifest: 'application/json', svg: 'image/svg+xml', glb: 'model/gltf-binary', m4a: 'audio/mp4' };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, r => { const p = r.request().url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await ctx.route(/^http:\/\/localhost:8766\/(.*)$/, r => { const u = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, ''), f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' }); });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); });
  await pg.goto('http://localhost:8766/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__ea, null, { timeout: 300000, polling: 1000 });
  const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
  const run = async (car, eb, thrFn, secs) => pg.evaluate(async ({ car, eb, thrFn, secs }) => {
    window.__eaHold = 1; const M = window.__map, X = window.__ea, c = M.newCar(car); c.eb = eb; const f = new Function('t', 'return ' + thrFn);
    X.ENGT.cold = 0; X.ENGT.add = 0; Object.assign(X.ENGFREE, { rpm: 0, a: 0, cut: false, on: false });
    if (X.EA.ctx && X.EA.ctx.state !== 'running') await X.EA.ctx.resume();
    let an = null, buf = null, peak = 0, nan = false, sum = 0, cnt = 0; const t0 = performance.now();
    await new Promise(res => { const tick = () => {
      const t = (performance.now() - t0) / 1000, cfg = X.EA.cfg, R = cfg && cfg.R, thr = f(t);
      const F = R ? X.stepEngFree(1 / 60, R, thr, true) : { rpm: 700, cut: false };
      X.eaFrame(1 / 60, c, { on: true, rpm: F.rpm, thr, cut: F.cut, psi: F.psi || 0, boost: 1, inCar: false, vol: 1, pan: 0 });
      const n = X.EA.node; if (n && !n.src.__pe) { n.src.__pe = 1; n.src.onprocessorerror = e => { window.__pe = String(e && (e.message || e.type)); }; } if (n && !an) { an = X.EA.ctx.createAnalyser(); an.fftSize = 2048; n.out.connect(an); buf = new Float32Array(an.fftSize); }
      if (an && t > 3) { an.getFloatTimeDomainData(buf); for (const v of buf) { if (!isFinite(v)) nan = true; peak = Math.max(peak, Math.abs(v)); sum += v * v; cnt++; } }
      if (t < secs) setTimeout(tick, 16); else res(); }; tick(); });
    X.EA.node && X.EA.node.post({ stat: 1 }); await new Promise(r => setTimeout(r, 150));
    const st = X.EA.stat || {}; return { pe: window.__pe, ctxSt: X.EA.ctx.state, ct: +X.EA.ctx.currentTime.toFixed(2), st: X.EA.st, mode: st.mode, rpm: Math.round(st.rpm || 0), fires: st.stat && st.stat.fires, weak: st.stat && st.stat.weak, min: st.stat && Math.round(st.stat.minRpm), max: st.stat && Math.round(st.stat.maxRpm), peak: +peak.toFixed(3), rms: +Math.sqrt(sum / Math.max(1, cnt)).toFixed(4), nan, key: X.EA.key, err: X.EA.err };
  }, { car, eb, thrFn, secs });
  const nova = 'chevrolet_nova_1972';
  const a = await run(nova, {}, '0', 7); console.log('stock idle', JSON.stringify(a));
  ok(a.st === 'worklet', 'worklet loaded (' + a.st + ' ' + a.err + ')'); ok(a.mode === 'run', 'stock running'); ok(a.fires > 100, 'stock fires'); ok(!a.nan, 'stock NaN'); ok(a.rms > 0.0005, 'stock audible'); ok(Math.abs(a.rpm - 750) < 80, 'stock idles ~750');
  const b2 = await run(nova, { cam: 'chop', hdr: 'longtube', exh: 'xpipe' }, '0', 7); console.log('chop idle', JSON.stringify(b2));
  ok(b2.key !== a.key, 'new build rebuilt the voice'); ok(b2.weak > 20 && a.weak === 0, 'chop cam lopes (weak burns), stock does not'); ok(!b2.nan, 'chop NaN'); ok(b2.mode === 'run', 'chop running');
  const c2 = await run(nova, { cam: 's3', hdr: 'longtube', exh: 'straight' }, 't > 1 && t < 2.5 ? 1 : 0', 5); console.log('straight rev', JSON.stringify(c2));
  ok(!c2.nan, 'straight NaN'); ok(c2.peak < 1.5, 'straight peak sane');
  const d = await run('dodge_charger_srt_hellcat_widebody_2020', {}, 't > 1 && t < 2 ? 1 : 0', 4); console.log('hellcat', JSON.stringify(d)); ok(!d.nan && d.mode === 'run', 'hellcat runs');
  const e = await run('bmw_m5_g90_2025', {}, '0', 4); console.log('m5', JSON.stringify(e)); ok(!e.nan && e.mode === 'run', 'm5 runs');
  const h = await run('suzuki_hayabusa_2025', {}, 't > 1 && t < 1.6 ? 1 : 0', 4); console.log('hayabusa', JSON.stringify(h)); ok(!h.nan && h.mode === 'run', 'hayabusa runs');
  if (errs.length) console.log('page errors', errs.slice(0, 5));
  ok(!errs.length, 'no page errors');
  console.log(fails.length ? 'FAIL: ' + fails.join('; ') : 'ALL PASS');
  await b.close(); process.exit(fails.length ? 1 : 0);
})();
