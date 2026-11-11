// Memory check for the 3D game (MW Test): how much the page holds as you play, the thing that makes iPhone Safari
// kill the tab ("A problem repeatedly occurred"). Serve the repo on http://localhost:8765 and set S to a folder that holds
// npm/node_modules/three (three@0.128.0). Counts GPU bytes by wrapping WebGL uploads/deletes, plus the JS heap.
// STEPS=boot,cars,tour,yb,hr,leave picks steps. CARS=n hero cars to cycle through, IDLE/LEAVE=ms to wait after,
// TEXLIST=1 lists the biggest textures, EVAL=file runs a snippet in the page after boot. PORT (default 8765).
const { chromium } = require('playwright');
const S = process.env.S, STEPS = (process.env.STEPS || 'boot,cars,yb,hr,leave').split(',');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF || 2) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 400))); pg.on('console', m => { if (m.type() === 'error' || /memory|MEM/.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await pg.addInitScript(() => {
    window.__texList = new Map(); const G = window.__gpu = { buf: 0, tex: 0, rb: 0, nBuf: 0, nTex: 0 }, size = new WeakMap(), bound = {}, tb = {};
    const BPP = { 6408: 4, 6407: 3, 6409: 1, 6406: 1, 6410: 2, 33326: 4, 34836: 16, 34842: 8, 6402: 4 }, TY = { 5126: 4, 5131: 2, 36193: 2 };
    for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) { if (!C) continue; const P = C.prototype;
      const bb = P.bindBuffer; P.bindBuffer = function (t, x) { bound[t] = x; return bb.call(this, t, x); };
      const bd = P.bufferData; P.bufferData = function (t, d, u) { const x = bound[t]; const n = typeof d === 'number' ? d : d ? d.byteLength : 0; if (x) { G.buf += n - (size.get(x) || 0); size.set(x, n); } return bd.apply(this, arguments); };
      const db = P.deleteBuffer; P.deleteBuffer = function (x) { if (x && size.has(x)) { G.buf -= size.get(x); size.delete(x); } return db.call(this, x); };
      const bt = P.bindTexture; P.bindTexture = function (t, x) { tb[t] = x; return bt.call(this, t, x); };
      const ti = P.texImage2D; P.texImage2D = function (t, lvl, ifmt) { let w, h, ty, fmt; if (arguments.length >= 8) { w = arguments[3]; h = arguments[4]; fmt = arguments[6]; ty = arguments[7]; } else { const s = arguments[5]; w = s.videoWidth || s.width; h = s.videoHeight || s.height; fmt = arguments[3]; ty = arguments[4]; }
        const key = t === 3553 ? 3553 : 34067, x = tb[key]; if (x && lvl === 0) { const n = w * h * (BPP[fmt] || 4) * ((TY[ty] || 1)) * 1.33; const prev = size.get(x) || 0; const add = t === 3553 ? n : (size.get(x) ? n : n); G.tex += add - (t === 3553 ? prev : 0); size.set(x, (t === 3553 ? 0 : prev) + add); if (window.__texList) window.__texList.set(x, [w, h, Math.round(size.get(x) / 1e5) / 10, (arguments.length >= 8 ? (arguments[8] ? 'data' : 'RT') : arguments[5].constructor.name) + ' fmt' + fmt + ' ty' + ty + ' ' + (new Error().stack.split('\n').filter(l => /index\.html/.test(l)).slice(0, 4).map(l => l.trim().split(':').slice(-2, -1)[0]).join('<'))]); } return ti.apply(this, arguments); };
      const dt = P.deleteTexture; P.deleteTexture = function (x) { if (window.__texList) window.__texList.delete(x); if (x && size.has(x)) { G.tex -= size.get(x); size.delete(x); } return dt.call(this, x); };
    }
  });
  const cdp = await ctx.newCDPSession(pg);
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const rows = [];
  const snap = async (name) => { await wait(2500); try { await cdp.send('HeapProfiler.collectGarbage'); } catch (e) {} await wait(300);
    const hu = await cdp.send('Runtime.getHeapUsage'); const r = await ev(() => { const g = window.__gpu, m = window.__map.rnd().info.memory, C = window.__map.CARS3D; return { gpuBufMB: Math.round(g.buf / 1e6), gpuTexMB: Math.round(g.tex / 1e6), geos: m.geometries, tex: m.textures, carsCached: C ? Object.keys(C.done).length : null, carsFreed: C ? C.freed : null, blocksDropped: window.__map.MEM ? window.__map.MEM.dropped : null }; });
    r.heapMB = Math.round(hu.usedSize / 1e6); r.extMB = Math.round(((hu.embedderHeapUsedSize || 0) + (hu.backingStorageSize || 0)) / 1e6); r.totalMB = r.heapMB + r.extMB + r.gpuBufMB + r.gpuTexMB; rows.push({ step: name, ...r }); console.log(JSON.stringify({ step: name, ...r })); };
  // the peak while the city builds (the moment a phone is most likely to give up on a cold start)
  let peak = 0, polling = true; const poll = (async () => { while (polling) { try { const hu = await cdp.send('Runtime.getHeapUsage'); peak = Math.max(peak, hu.usedSize + (hu.embedderHeapUsedSize || 0) + (hu.backingStorageSize || 0)); } catch (e) {} await new Promise(r => setTimeout(r, 250)); } })();
  await pg.goto('http://localhost:' + (process.env.PORT || 8765) + '/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 240000 });
  polling = false; await poll; console.log(JSON.stringify({ step: 'loading peak (page memory, before the GPU)', peakMB: Math.round(peak / 1e6) }));
  await ev(() => { const M = window.__map; M.S.cash = 1e7; M.S.rep = 9999; try { M.closeCreator(); } catch (e) {} });
  const drive = async (x, z, yaw) => {
    await ev(`(() => { const M = window.__map; if (!M.S.car) { M.S.car = M.newCar('dodge_charger_srt_hellcat_widebody_2020'); } M.S.car.fuel = 100; M.foot.on = false; M.gbMode(false); M.startDrive(${x}, ${z}); })()`);
    for (let k = 0; k < 30; k++) { const ok = await ev(() => { const M = window.__map; if (M.foot.on) M.getIn(); const o = M.carObj(); return !!(o && o.userData.model); }); if (ok) break; await wait(1000); }
    await ev(`(() => { const M = window.__map, d = M.drvS(); Object.assign(d, { x: ${x}, z: ${z}, yaw: ${yaw}, v: 0 }); M.physReset(); })()`);
  };
  if (STEPS.includes('boot')) { await drive(1516, -560, 0); await snap('boot + driving in Stop Six');
    if (process.env.TEXLIST) console.log(await ev(() => [...window.__texList.values()].sort((a, b) => b[2] - a[2]).slice(0, 25).map(t => t.join(' ')).join('\n'))); }
  if (process.env.EVAL) console.log(await ev(require('fs').readFileSync(process.env.EVAL, 'utf8')));
  if (STEPS.includes('cars')) {
    // swap your car through the hero cars, like buying/driving many cars in one sitting
    const ids = await ev(() => window.__map.BUILT.slice()); const n = +(process.env.CARS || ids.length);
    for (const id of ids.slice(0, n)) { await ev(id => { const M = window.__map; M.S.car = M.newCar(id); M.syncCarModel(); }, id);
      for (let k = 0; k < 40; k++) { const ok = await ev(id => { const o = window.__map.carObj(); return !!(o && o.userData.model && o.userData.carId === id) || !!(window.__map.CARS3D && window.__map.CARS3D.done[id]); }, id); if (ok) break; await wait(500); } }
    await snap('after driving ' + n + ' different cars');
    await wait(+(process.env.IDLE || 0)); if (process.env.IDLE) await snap('idle ' + process.env.IDLE + ' ms later');
  }
  if (STEPS.includes('tour')) {
    // drive around the whole map: a spread of towns far apart, a few seconds in each
    const pts = await ev(() => { const P = window.__map.places().filter(p => p.type !== 'land' && p.type !== 'property'), out = []; for (let k = 0; k < +(window.__tourN || 8); k++) { let best = null, bd = -1; for (const p of P) { const d = Math.min(...out.map(o => Math.hypot(o.x - p.x, o.z - p.z)), 1e9) * (out.length ? 1 : Math.random()); if (d > bd && Math.abs(p.x) < 30000 && Math.abs(p.z) < 30000) { bd = d; best = p; } } out.push(best); } return out.map(p => [p.x, p.z, p.name]); });
    for (const [x, z, name] of pts) { await drive(x, z, 0); await ev(() => { const d = window.__map.drvS(); d.v = 15; }); await wait(4000); }
    await snap('after a tour of ' + pts.length + ' towns (' + pts.map(p => p[2]).slice(0, 4).join(', ') + '…)');
  }
  if (STEPS.includes('yb')) { await drive(7056.5, 1162, 0); await wait(1500); await ev(() => { const Y = window.__yb; if (Y && !Y.race.run) Y.test.startFill(); }); await wait(8000); await snap('Yello Belly racing'); }
  if (STEPS.includes('hr')) { await ev(() => { const E = window.__yb && window.__yb.ev; if (E) E.EV.cur = null; }); await drive(5600, 1363, -Math.PI / 2); await ev(() => { const M = window.__map, H = window.__yb.roll; Object.assign(H, { mode: 'roll60', act: 'auto', dist: 804.67 }); H.start(M.places().find(q => q.id === 'i20roll'), M.STREET3D[3]); }); await wait(8000); await snap('I-20 roll race'); }
  if (STEPS.includes('leave')) { await ev(() => { try { window.__yb.roll.stop && window.__yb.roll.stop(); } catch (e) {} }); await drive(1516, -560, 0); await wait(+(process.env.LEAVE || 5000)); await snap('back in Stop Six'); }
  console.log('errors: ' + errs.length); for (const e of errs.slice(0, 12)) console.log('  ' + e);
  await b.close();
})();
