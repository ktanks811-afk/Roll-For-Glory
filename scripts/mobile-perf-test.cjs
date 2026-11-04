// Phase 3F phone performance check for the 3D game (headless Chromium, Playwright).
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// An iPhone-sized landscape screen (844x390, 3x) with the CPU slowed SLOW times (default 4).
// SCENES=world,yb,ybev,hr picks scenes. For each it prints frame JS time (p50/p95/worst), draw calls, triangles,
// live lights/shadow casters and the top functions by self time from a CPU profile (PROF=1).
// Headless Chromium draws with a software GPU, so frame rates here are not phone frame rates:
// the JS time per frame and the draw calls / triangles are the numbers to compare.
const { chromium } = require('playwright');
const S = process.env.S, SLOW = +(process.env.SLOW || 4), SCENES = (process.env.SCENES || 'world,yb,ybev,hr').split(','), SEC = +(process.env.SEC || 6);
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: +(process.env.VW || 844), height: +(process.env.VH || 390) }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF || 3) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 500))); pg.on('console', m => { if (m.type() === 'error') errs.push('error: ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  // time every animation-frame callback (the game's whole frame: physics, AI, audio, scene, render submit)
  await pg.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window); window.__ft = []; window.__ftOn = false;
    window.requestAnimationFrame = f => raf(t => { const a = performance.now(); try { f(t); } finally { if (window.__ftOn) window.__ft.push(performance.now() - a); } });
  });
  const cdp = await ctx.newCDPSession(pg);
  const t0 = Date.now();
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 240000 });
  const boot = Date.now() - t0;
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  await ev(() => { const M = window.__map; M.S.cash = 1e7; M.S.rep = 9999; try { M.closeCreator(); } catch (e) {} });
  await wait(1500);
  // per-frame render counts: reset at the start of each frame, read at the end (post passes add a few quads)
  await ev(() => { const r = window.__map.rnd(); r.info.autoReset = false; const raf = window.requestAnimationFrame; window.__ri = [];
    const tick = () => { if (window.__ftOn) window.__ri.push([r.info.render.calls, r.info.render.triangles]); r.info.reset(); raf(tick); }; raf(tick); });
  const sample = async (name, setup) => {
    await setup(); await wait(2500);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW });
    if (process.env.PROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
    await ev(() => { window.__ft = []; window.__ri = []; window.__ftOn = true; });
    await wait(SEC * 1000);
    await ev(() => { window.__ftOn = false; });
    let top = null;
    if (process.env.PROF) { const { profile } = await cdp.send('Profiler.stop'); const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n])); const dts = profile.timeDeltas; let tot = 0;
      for (let i = 0; i < profile.samples.length; i++) { const n = byId.get(profile.samples[i]), f = n.callFrame, k = (f.functionName || '(anon)') + ':' + (f.lineNumber + 1); const d = dts[i] || 0; tot += d; self.set(k, (self.get(k) || 0) + d); }
      top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, +(process.env.TOP || 22)).map(([k, v]) => k + ' ' + (100 * v / tot).toFixed(1) + '%'); }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const r = await ev(() => { const ft = window.__ft.slice().sort((a, b) => a - b), ri = window.__ri, q = p => +ft[Math.min(ft.length - 1, Math.floor(ft.length * p))].toFixed(1);
      const calls = ri.map(x => x[0]).sort((a, b) => a - b), tris = ri.map(x => x[1]).sort((a, b) => a - b), sc = window.__map.scn(); let lights = 0, casters = 0, vis = 0, inst = 0;
      sc.traverseVisible(o => { vis++; if (o.isLight && o.intensity > 0) lights++; if (o.castShadow && o.isMesh) casters++; if (o.isInstancedMesh) inst += o.count; });
      const mem = window.__map.rnd().info.memory;
      return { frames: ft.length, jsMs: { p50: q(0.5), p95: q(0.95), worst: q(1) }, calls: calls[calls.length >> 1], tris: tris[tris.length >> 1], lights, casters, visObjs: vis, instances: inst, geos: mem.geometries, tex: mem.textures, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null, carLod: window.__map.CLOD ? window.__map.CLOD.n.join('/') : null }; });
    console.log(JSON.stringify({ scene: name, slow: SLOW + 'x', ...r, top }));
  };
  const drive = async (x, z, yaw, extra) => {
    await ev(`(() => { const M = window.__map; if (!M.S.car) { M.S.car = M.newCar('dodge_charger_srt_hellcat_widebody_2020'); } M.S.car.fuel = 100; M.foot.on = false; M.gbMode(false); M.startDrive(${x}, ${z}); M.setTime('night'); })()`);
    for (let k = 0; k < 20; k++) { const ok = await ev(() => { const M = window.__map; if (M.foot.on) M.getIn(); const o = M.carObj(); return !!(o && o.userData.model); }); if (ok) break; await wait(1000); }
    await ev(`(() => { const M = window.__map, d = M.drvS(); Object.assign(d, { x: ${x}, z: ${z}, yaw: ${yaw}, v: 0 }); M.physReset(); ${extra || ''} })()`);
  };
  if (SCENES.includes('world')) await sample('open world, Stop Six at night', () => drive(1516, -560, 0));
  if (SCENES.includes('yb')) await sample('Yello Belly staging lanes, a pair racing', async () => { await drive(7056.5, 1162, 0); await wait(1500); await ev(() => { const Y = window.__yb; if (!Y.race.run) Y.test.startFill(); }); });
  if (SCENES.includes('ybev')) await sample('Yello Belly event night (full crowd), a pair racing', async () => { await drive(7056.5, 1162, 0); await ev(() => { const Y = window.__yb, E = Y.ev; E.EV.cur = { def: Object.values(E.DEFS).find(d => d.where === 'yb'), over: false, round: 0, field: [] }; if (!Y.race.run) Y.test.startFill(); }); });
  if (SCENES.includes('hr')) await sample('I-20 roll race under way', async () => { await ev(() => { const E = window.__yb.ev; if (E) E.EV.cur = null; }); await drive(5600, 1363, -Math.PI / 2); await ev(() => { const M = window.__map, H = window.__yb.roll; Object.assign(H, { mode: 'roll60', act: 'auto', dist: 804.67 }); H.start(M.places().find(q => q.id === 'i20roll'), M.STREET3D[3]); }); });
  // drive: follow the GPS route to Yello Belly from a few spots around Grand Prairie, on the real car physics (a simple
  // look-ahead driver holds ~30 mph and slows for the turns). Reports route length, time, wall hits and where it ended.
  if (SCENES.includes('drive')) {
    await drive(7056.5, 1162, 0);
    const res = [];
    for (const [ox, oz] of [[-700, -700], [-1100, -350]]) {
      const r = await ev(([ox, oz]) => { const M = window.__map, Y = window.__yb, d = M.drvS(), G = M.gps(), p = M.places().find(q => q.id === 'yellowbelly');
        Y.test.manual = true; window.__drvIn = null;
        Object.assign(d, { x: p.x + ox, z: p.z + oz, yaw: 0, v: 0 }); M.physReset(); M.setPin(p.name, p.x, p.z);
        if (!G.pts || G.pts.length < 2) return { err: 'no route' };
        const P = G.pts.map(q => q.slice()), len = Math.round(G.len), first = P[0];
        Object.assign(d, { x: first[0], z: first[1], yaw: Math.atan2(-(P[1][0] - first[0]), -(P[1][1] - first[1])), v: 0 }); M.physReset();
        let i = 1, t = 0, hits = 0, was = false, maxV = 0; const dt = 1 / 60, inp = { gas: 0, brake: 0, steer: 0, hb: 0 }; window.__drvIn = () => inp;
        const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
        while (t < 400) {
          while (i < P.length - 1 && Math.hypot(P[i][0] - d.x, P[i][1] - d.z) < 9) i++;
          const tx = P[i][0], tz = P[i][1], err = wrap(Math.atan2(-(tx - d.x), -(tz - d.z)) - d.yaw);
          const nx = P[Math.min(P.length - 1, i + 1)], turn = i < P.length - 1 ? Math.abs(wrap(Math.atan2(-(nx[0] - tx), -(nx[1] - tz)) - Math.atan2(-(tx - P[i - 1][0]), -(tz - P[i - 1][1])))) : 0;
          const near = Math.hypot(tx - d.x, tz - d.z), want = turn > 0.6 && near < 30 ? 6 : 13.5;
          inp.steer = Math.max(-1, Math.min(1, err * 2.2)); inp.gas = d.v < want ? Math.min(0.6, (want - d.v) * 0.3) : 0; inp.brake = d.v > want + 1.5 ? 0.5 : 0;
          Y.test.tick(dt); t += dt; maxV = Math.max(maxV, d.v);
          if (d.hitting && !was) hits++; was = !!d.hitting;
          if (i >= P.length - 1 && Math.hypot(P[P.length - 1][0] - d.x, P[P.length - 1][1] - d.z) < 12) break;
        }
        window.__drvIn = null; Y.test.manual = false;
        const end = Math.round(Math.hypot(p.x - d.x, p.z - d.z)), card = document.querySelector('#card') && document.querySelector('#card').innerText.replace(/\s+/g, ' ').slice(0, 80);
        return { from: [Math.round(first[0]), Math.round(first[1])], routeM: len, streets: [...new Set(G.names || [])].slice(0, 6), secs: Math.round(t), hits, maxMph: Math.round(maxV * 2.237), endFromGateM: end, arrived: t < 400 };
      }, [ox, oz]);
      res.push(r);
    }
    console.log(JSON.stringify({ scene: 'drive to Yello Belly on the GPS route', res }));
  }
  // touch: with a race on (Yello Belly test & tune in the lanes, then an I-20 "I drive it" roll race), press and hold the
  // on-screen gas and steering with real touch events: the pedal must be the thing under your finger and the car must get the input.
  // Then reload the page and check the save is still there.
  if (SCENES.includes('touch')) {
    const press = async (id, ms) => { const b = await ev(id => { const e = document.getElementById(id), r = e.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y); return { x, y, top: top && (top.closest('#' + id) ? id : (top.id || top.className || top.tagName)) }; }, id);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y }] }); await wait(ms);
      const st = await ev(() => { const M = window.__map, d = M.drvS(); return { hold: Object.keys(M.hold).filter(k => M.hold[k]), gas: +(d.gas || 0).toFixed(2), steer: +(d.steer || 0).toFixed(2) }; });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(200); return { id, under: b.top, ...st }; };
    const out = {};
    await drive(7056.5, 1162, 0); await ev(() => { const M = window.__map, Y = window.__yb; Y.test.manual = false; window.__drvIn = null; Y.start(M.places().find(q => q.id === 'yellowbelly'), null, 0); });
    await wait(1500); out.yb = { on: await ev(() => window.__yb.race.on), gas: await press('b-gas', 700), left: await press('b-left', 700) };
    await ev(() => { const Y = window.__yb; Y.close && Y.close('left'); });
    await drive(5600, 1363, -Math.PI / 2); await ev(() => { const M = window.__map, H = window.__yb.roll; Object.assign(H, { mode: 'roll40', act: 'manual', dist: 402.34 }); H.start(M.places().find(q => q.id === 'i20roll'), M.STREET3D[3]); });
    await wait(1500); out.hr = { on: await ev(() => window.__yb.roll.on), gas: await press('b-gas', 700), right: await press('b-right', 700) };
    await ev(() => { const H = window.__yb.roll; if (H.on) H.close('left'); });
    const before = await ev(() => { const M = window.__map; M.S.ybTestMark = 'kept'; try { M.sleep && 0; } catch (e) {} const k = Object.keys(localStorage); return { keys: k.length, car: M.S.car && M.S.car.id, garage: (M.S.garage || []).length }; });
    await ev(() => { try { window.dispatchEvent(new Event('pagehide')); } catch (e) {} });
    await pg.reload(); await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 240000 }); await wait(1500);
    const after = await ev(() => { const M = window.__map; return { keys: Object.keys(localStorage).length, car: M.S.car && M.S.car.id, garage: (M.S.garage || []).length, made: !!M.S.made, mark: M.S.ybTestMark || null, ybRec: !!M.S.ybRec, evRank: !!M.S.evRank }; });
    out.save = { before, after };
    console.log(JSON.stringify({ scene: 'touch controls during races + save survives a reload', ...out }));
  }
  // lod: one AI car at the strip seen from 15, 45 and 110 m, drawn at each detail level (draw calls, and SHOTS=1 crops to compare by eye)
  if (SCENES.includes('lod')) {
    await drive(7056.5, 1162, 0); await ev(() => { window.__yb.test.manual = true; const Y = window.__yb; Y.race.ags.slice().forEach(A => Y.agKill(A)); window.__lodA = Y.agSpawn(window.__map.STREET3D[3], 7046, 1100, 0); Y.race.fillT = 1e9; });
    for (let k = 0; k < 20; k++) { if (await ev(() => !!window.__lodA.m)) break; await wait(500); }
    const out = [];
    for (const d of [15]) {   // every level drawn up close: if level 2 looks like level 0 at 15 m, nothing you'd notice is gone further out
      const r = await ev(d => { const M = window.__map, rr = M.rnd(), sc = M.scn(), cam = M.cam(), A = window.__lodA, m = A.m, C = M.CLOD;
        cam.fov = 50 * Math.min(1, 15 / d) + 0; cam.position.set(A.x - d * 0.6, 1.6 + d * 0.04, A.z - d * 0.8); cam.lookAt(A.x, 0.8, A.z); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
        const meas = () => { rr.info.autoReset = false; rr.info.reset(); rr.render(sc, cam); const o = rr.info.render.calls; rr.info.autoReset = true; return o; };
        const lv = []; const R0 = C.R; for (const R of [[1e9, 1e9], [0, 1e9], [0, 0]]) { if (m.userData.clod) m.userData.clod.lvl = -1; C.R = R; M.clodStep(); lv.push(meas()); } C.R = R0; if (m.userData.clod) m.userData.clod.lvl = -1; M.clodStep();
        return { d, calls: lv, auto: m.userData.clod ? m.userData.clod.lvl : null }; }, d);
      out.push(r);
      if (process.env.SHOTS) for (const L of [0, 1, 2]) { await ev(() => { let st = document.getElementById('t3fhide'); if (!st) { st = document.createElement('style'); st.id = 't3fhide'; document.head.appendChild(st); } st.textContent = '.pad,#radio,#card,#mini,#compass{display:none!important}'; }); await ev(L => { const M = window.__map, C = M.CLOD, m = window.__lodA.m; C.force = L; M.clodStep(); }, L); await wait(400); await pg.screenshot({ path: S + '/b/lod_' + d + '_' + L + '.png', clip: { x: 0.3 * (+(process.env.VW || 844)), y: 0.25 * (+(process.env.VH || 390)), width: 0.4 * (+(process.env.VW || 844)), height: 0.5 * (+(process.env.VH || 390)) }, timeout: 240000 }); }
    }
    await ev(() => { window.__map.CLOD.force = null; const c = window.__map.cam(); c.fov = 50; c.updateProjectionMatrix(); window.__yb.test.manual = false; });
    console.log(JSON.stringify({ scene: 'car detail levels (one AI car, draw calls at level 0/1/2)', out }));
  }
  console.log(JSON.stringify({ bootMs: boot, ERR: errs.slice(0, 8) }));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
