// Fluid motion test (2026-11-21). Headless Chromium (Playwright), files served by Playwright's router (no server).
// S= folder holding npm/node_modules/three (three@0.128.0). OUT= folder for screenshots. FILE= page to load (default index.html).
// Steps the real game by hand at 60 Hz (headless draws ~1 fps) and prints numbers:
//   - chase camera: distance behind the car while accelerating hard and braking (before: grew with speed)
//   - chase camera: how smooth its swing is through a slalom (largest frame-to-frame change in yaw rate)
//   - on foot (only when the page has window.__motion): speed ramp from a stand, stop distance, the biggest one-frame
//     jump of the hip joint when you start walking (a pop from the idle pose shows up here)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..'), FILE = process.env.FILE || 'index.html';
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +(process.env.VW || 844), height: +(process.env.VH || 390) }, hasTouch: true, isMobile: true, deviceScaleFactor: +(process.env.DPR || 1) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase|fonts\.(googleapis|gstatic)/, r => r.abort());
  await pg.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => {
    const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' });
  });
  await pg.goto('http://game.test/' + FILE + '?test=1&net=local');
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__crash, null, { timeout: 400000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  const NEW = await ev(() => !!window.__motion);
  console.log(NEW ? 'page has fluid motion' : 'page WITHOUT fluid motion (baseline)');
  await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} if (window.__cops) window.__cops.COP.noPop = true; });
  await wait(1500);
  // hold the game's own frames while we step it by hand
  await ev(() => { const M = window.__map, R = M.rnd(), orig = R.render; R.render = function () { if (window.__hold && !window.__mine) return; return orig.apply(this, arguments); };
    window.__shot = () => { window.__mine = 1; try { R.render(M.scn(), M.cam()); } finally { window.__mine = 0; } }; });
  const shot = async n => { await ev(() => window.__shot()); await pg.screenshot({ path: path.join(OUT, n + '.png') }); };

  // ---------- car ----------
  await ev(() => { const M = window.__map; M.S.car = M.newCar('dodge_charger_srt_hellcat_widebody_2020'); M.S.car.fuel = 100; M.foot.on = false; M.startDrive(7056.5, 1300); });
  await pg.waitForFunction(() => { const c = window.__crash.dbg.car; return c && c.userData.model && c.userData.model.userData.wheels; }, null, { timeout: 120000 });
  await wait(4000);
  // find a long clear straight: I-20 style test strip = any direction with no solids for 900 m from a road point
  const run = await ev(() => {
    const M = window.__map, Dg = window.__crash.dbg, d = M.drvS(), T = M.TIRE, cam = M.cam();
    window.__hold = 1;
    // a long straight: try headings from the start spot, keep the one that stays clear longest
    let best = null;
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const sx = -Math.sin(yaw), sz = -Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw); let L = 0;
      for (let t = 0; t < 1500; t += 2) { let hit = false; for (const o of [-1.6, 0, 1.6]) { const px = d.x + sx * t + lx * o, pz = d.z + sz * t + lz * o; for (const bb of Dg.solids.at(px, pz)) if (px > bb.x0 - 0.5 && px < bb.x1 + 0.5 && pz > bb.z0 - 0.5 && pz < bb.z1 + 0.5) hit = true; } if (hit) break; L = t; }
      if (!best || L > best.L) best = { yaw, L };
    }
    const x0 = d.x, z0 = d.z;
    const drive = (x, z, yaw, sec, inp) => {
      Object.assign(d, { x, z, yaw }); M.physReset(); d.px = null; Dg.step(1 / 60); Object.assign(d, { x, z, yaw }); d.px = x; d.pz = z; d.camYaw = yaw;
      const log = []; let t = 0;
      while (t < sec) { window.__drvIn = () => inp(t); Dg.step(1 / 60); t += 1 / 60;
        const sp = Math.hypot(T.vx, T.vz), dist = Math.hypot(cam.position.x - d.x, cam.position.z - d.z);
        log.push([t, sp, dist, d.camYaw, cam.fov, cam.position.y]); }
      return log;
    };
    // 1) full throttle down the straight then hard on the brakes
    const A = drive(x0, z0, best.yaw, Math.min(14, best.L / 30), () => ({ gas: 1, brake: 0, steer: 0, hb: 0 }));
    const top = A.reduce((m, r) => Math.max(m, r[1]), 0), endCam = A[A.length - 1][2], startCam = A[30][2], maxCam = A.reduce((m, r) => Math.max(m, r[2]), 0), fovTop = A[A.length - 1][4];
    window.__shotA = { x: d.x, z: d.z };
    const xb = d.x, zb = d.z, vxb = T.vx, vzb = T.vz;
    let Bl = [];
    { let t = 0; while (t < 3) { window.__drvIn = () => ({ gas: 0, brake: 1, steer: 0, hb: 0 }); Dg.step(1 / 60); t += 1 / 60; Bl.push([t, Math.hypot(T.vx, T.vz), Math.hypot(cam.position.x - d.x, cam.position.z - d.z)]); } }
    const minBrakeCam = Bl.reduce((m, r) => Math.min(m, r[2]), 1e9);
    // 2) a slalom at ~45 mph: how smoothly the camera swings (the yaw rate's biggest one-frame change)
    const S2 = drive(x0, z0, best.yaw, 6, t => ({ gas: 0.35, brake: 0, steer: t > 1.2 ? Math.sign(Math.sin((t - 1.2) * Math.PI / 0.9)) * 0.6 : 0, hb: 0 }));
    let jerk = 0, prevRate = null;
    for (let i = 1; i < S2.length; i++) { let dy = S2[i][3] - S2[i - 1][3]; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const rate = dy * 60; if (prevRate != null && S2[i][0] > 1.3) jerk = Math.max(jerk, Math.abs(rate - prevRate)); prevRate = rate; }
    window.__drvIn = () => ({ gas: 0, brake: 1, steer: 0, hb: 0 });
    return { straight: best.L, top: top * 2.237, startCam, endCam, maxCam, minBrakeCam, fovTop, jerk, base: cam.fov };
  });
  console.log('car', JSON.stringify(run, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
  ok(run.top > 30, `Hellcat reached ${run.top.toFixed(0)} mph on a ${run.straight} m straight`);
  if (NEW) {
    ok(run.maxCam < 15.5, `chase cam stays close at speed: ${run.startCam.toFixed(1)} m behind at the start, ${run.endCam.toFixed(1)} m at ${run.top.toFixed(0)} mph (max ${run.maxCam.toFixed(1)})`);
    ok(run.minBrakeCam > 9.5, `hard braking doesn't swing the camera into the car (closest ${run.minBrakeCam.toFixed(1)} m)`);
  } else console.log(`baseline: cam ${run.startCam.toFixed(1)} m at start, ${run.endCam.toFixed(1)} m at top speed (max ${run.maxCam.toFixed(1)}), closest while braking ${run.minBrakeCam.toFixed(1)}`);
  console.log(`slalom camera yaw-rate jerk ${run.jerk.toFixed(3)} rad/s per frame`);

  // a screenshot at speed: run 5 s of throttle and draw
  await ev(() => { const M = window.__map, Dg = window.__crash.dbg; for (let i = 0; i < 300; i++) { window.__drvIn = () => ({ gas: 1, brake: 0, steer: 0, hb: 0 }); Dg.step(1 / 60); } });
  await shot((NEW ? '' : 'before-') + 'car-at-speed');
  await ev(() => { const M = window.__map, Dg = window.__crash.dbg; for (let i = 0; i < 40; i++) { window.__drvIn = () => ({ gas: 0, brake: 0, steer: 1, hb: 0 }); Dg.step(1 / 60); } });
  await shot((NEW ? '' : 'before-') + 'car-turning');
  await ev(() => { const M = window.__map, Dg = window.__crash.dbg; for (let i = 0; i < 400; i++) { window.__drvIn = () => ({ gas: 0, brake: 1, steer: 0, hb: 0 }); Dg.step(1 / 60); } window.__drvIn = null; });

  // ---------- on foot ----------
  if (NEW) {
    await ev(() => { window.__map.getOut(); });
    await ev(() => { window.__hold = 1; });
    const F = await ev(() => {
      const M = window.__map, Mo = window.__motion, f = M.foot, K = M.keys;
      for (let i = 0; i < 30; i++) Mo.foot(1 / 60);
      const out = { ramp: [], stop: 0, pop: 0 };
      const ME = () => window.__map.PEOPLE && f.holder.children[0];
      let prevHip = null, P = null;
      f.holder.traverse(o => { if (!P && o.name === 'legL') P = o; });
      K.KeyW = true; f.camYaw = f.yaw;
      for (let i = 0; i < 60; i++) { Mo.foot(1 / 60); const sp = Math.hypot(f.vx, f.vz); if (i % 6 === 5) out.ramp.push(+sp.toFixed(2)); }
      K.ShiftLeft = true; for (let i = 0; i < 60; i++) Mo.foot(1 / 60); out.run = +Math.hypot(f.vx, f.vz).toFixed(2); K.ShiftLeft = false;
      for (let i = 0; i < 40; i++) Mo.foot(1 / 60);
      K.KeyW = false; const x0 = f.x, z0 = f.z; let n = 0; while (Math.hypot(f.vx, f.vz) > 0.03 && n < 200) { Mo.foot(1 / 60); n++; } out.stop = +Math.hypot(f.x - x0, f.z - z0).toFixed(2); out.stopT = +(n / 60).toFixed(2);
      for (let i = 0; i < 40; i++) Mo.foot(1 / 60);
      return out;
    });
    console.log('foot', JSON.stringify(F));
    ok(F.ramp[0] < 2.0 && F.ramp[F.ramp.length - 1] > 2.3, `walk builds up: ${F.ramp.join(' → ')} m/s over the first second`);
    ok(F.run > 6.5, `runs at ${F.run} m/s`);
    ok(F.stop > 0.05 && F.stop < 1.2 && F.stopT < 0.5, `stops in ${F.stop} m (${F.stopT} s) after letting go`);
    // the hip's biggest one-frame jump when you set off from a stand (the old idle → stride switch popped ~0.4 rad)
    const pop = await ev(() => {
      const M = window.__map, Mo = window.__motion, f = M.foot, K = M.keys; let P = null; f.holder.traverse(o => { if (!P && o.name === 'legL') P = o; });
      if (!P) { let L = null; f.holder.traverse(o => { if (!L && o.isObject3D && o.parent && o.parent.name === 'upper') L = o; }); }
      for (let i = 0; i < 40; i++) Mo.foot(1 / 60);
      const legs = []; f.holder.traverse(o => { if (o.children.length && /leg/i.test(o.name || '')) legs.push(o); });
      const read = () => window.__motion && window.__motion.lastLeg ? window.__motion.lastLeg() : null;
      K.KeyW = true; let pv = null, mx = 0; const ME = window.__motion.me && window.__motion.me();
      for (let i = 0; i < 40; i++) { Mo.foot(1 / 60); const v = ME ? ME.legs[0].rotation.x : 0; if (pv != null) mx = Math.max(mx, Math.abs(v - pv)); pv = v; }
      K.KeyW = false; for (let i = 0; i < 40; i++) Mo.foot(1 / 60);
      return { mx, has: !!ME };
    });
    if (pop.has) ok(pop.mx < 0.2, `no pop setting off: hip moves at most ${pop.mx.toFixed(3)} rad in one frame`);
    // a running turn, for a picture of the lean
    await ev(() => { const M = window.__map, Mo = window.__motion, f = M.foot, K = M.keys; K.KeyW = true; K.ShiftLeft = true; for (let i = 0; i < 70; i++) Mo.foot(1 / 60); K.KeyA = true; for (let i = 0; i < 10; i++) Mo.foot(1 / 60); });
    const lean = await ev(() => window.__map.foot.lean);
    ok(Math.abs(lean) > 0.04, `leans into a running turn (${(lean * 57.3).toFixed(1)}°)`);
    await shot('foot-run-turn');
    await ev(() => { const K = window.__map.keys; K.KeyW = K.ShiftLeft = K.KeyA = false; for (let i = 0; i < 12; i++) window.__motion.foot(1 / 60); });
    await shot('foot-stopping');
  }
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await b.close();
  console.log(fail.length ? `\n${fail.length} FAILED` : '\nALL OK');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
