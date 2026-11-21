// Crash + collision tests, realism phase 1 (2026-11-20). Headless Chromium (Playwright). Serve the repo on http://localhost:8765
// (PORT= to change) and set S to a folder that holds npm/node_modules/three (three@0.128.0). OUT= folder for the screenshots,
// CAR= car id (default the M5). Runs the real stepDrive (window.__crash.dbg.step) with a scripted driver into: a building at
// 30 mph (front-end damage, dents, hood buckles), a building's corner clipped at 40 mph (spin), a street light at 12 mph
// (holds) and 35 mph (breaks away), a fire hydrant at 20 mph (snaps off, geyser), a big tree at 25 mph, a parked cop car
// T-boned at 20 mph (it slides, heat goes up), and I-20's guardrail at 60 mph and 12 degrees (scrapes along it).
const { chromium } = require('playwright');
const S = process.env.S;
async function boot(opt = {}) {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: opt.vp || { width: 844, height: 390 } });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/WebGL|GPU|deprecated/i.test(t)) errs.push('console: ' + t.slice(0, 300)); } });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:' + (process.env.PORT || 8765) + '/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 240000 });
  await pg.evaluate(() => { const M = window.__map; M.S.cash = 1e7; try { M.closeCreator(); } catch (e) {} });
  return { b, pg, errs, ev: (f, a) => pg.evaluate(f, a) };
};
const OUT = process.env.OUT || '.';
(async () => {
  const { b, pg, errs, ev } = await boot({ vp: { width: 1280, height: 720 } });
  const CAR = process.env.CAR || 'bmw_m5_g90_2025';
  await ev(CAR => { const M = window.__map; M.S.car = M.newCar(CAR); M.S.car.fuel = 100; M.foot.on = false; M.startDrive(7056.5, 1300); }, CAR);
  await pg.waitForFunction(() => { const c = window.__crash.dbg.car; return c && c.userData.model && c.userData.model.userData.wheels; }, null, { timeout: 120000 });
  await pg.waitForTimeout(6000);
  await pg.waitForTimeout(1500);
  // helpers in the page
  await ev(() => {
    const M = window.__map, X = window.__crash, Dg = X.dbg, d = M.drvS(), T = M.TIRE;
    const R = M.rnd(), orig = R.render; R.render = function () { if (window.__hold && !window.__mine) return; return orig.apply(this, arguments); };
    window.__T = {
      run(x, z, yaw, v, sec, inp) {
        Object.assign(d, { x, z, yaw }); M.physReset(); d.px = null; Dg.step(1 / 60);
        Object.assign(d, { x, z, yaw }); d.px = x; d.pz = z; T.vx = -Math.sin(yaw) * v; T.vz = -Math.cos(yaw) * v; d.v = v; T.w = 0; if (T.vd) T.vd.sync = true;
        window.__drvIn = () => inp || { gas: 0.25, brake: 0, steer: 0, hb: 0 };
        const log = []; let t = 0;
        while (t < sec) { Dg.step(1 / 60); Dg.fx(1 / 60); t += 1 / 60; log.push([+t.toFixed(2), +(Math.hypot(T.vx, T.vz) * 2.237).toFixed(1), +(T.w * 57.3).toFixed(0), +d.x.toFixed(2), +d.z.toFixed(2), +(d.yaw * 57.3).toFixed(1)]); }
        window.__drvIn = () => ({ gas: 0, brake: 1, steer: 0, hb: 0 }); return log;
      },
      snap() { const c = M.S.car; return { body: Math.round(c.cond.body), lights: Math.round(c.cond.lights), eng: Math.round(c.cond.engine), tires: Math.round(c.cond.tires), hp: Math.round(M.S.health), dents: (c.dents || []).length, pull: +(c.pull || 0).toFixed(3), rad: +(c.rad || 0).toFixed(2), last: X.stats.last }; },
      fresh() { const c = M.S.car; c.cond.body = c.cond.lights = c.cond.engine = c.cond.tires = 100; c.dents = []; c.pull = 0; c.rad = 0; c.bag = false; M.S.health = 100; Dg.crDentRestore(Dg.car.userData.model); },
      shot(cx, cy, cz, lx, ly, lz) { const cam = M.cam(); cam.position.set(cx, cy, cz); cam.lookAt(lx, ly, lz); cam.updateMatrixWorld(); window.__hold = 1; window.__mine = 1; try { M.rnd().render(M.scn(), cam); } finally { window.__mine = 0; } },
      // a clear run-up of L m straight at (x, z): tries the four directions
      approach(x, z, L, off) {
        const Dg = window.__crash.dbg;
        for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
          const sx = Math.sin(yaw), sz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw); let ok = true;
          for (let t = 2.2; t <= L + 3 && ok; t += 0.8) { const px = x + sx * t + lx * off, pz = z + sz * t + lz * off;
            for (const b of Dg.solids.at(px, pz)) if (px > b.x0 - 1.6 && px < b.x1 + 1.6 && pz > b.z0 - 1.6 && pz < b.z1 + 1.6) ok = false;
            for (const p of Dg.crPosts().at(px, pz)) if (!p.down && Math.hypot(p.x - px, p.z - pz) < 1.8) ok = false;
            for (const p of Dg.crPlants(px, pz, 2, [])) if (Math.hypot(p.x - px, p.z - pz) < 1.8 + p.r) ok = false; }
          if (ok) return { x: x + sx * L + lx * off, z: z + sz * L + lz * off, yaw };
        }
        return null;
      },
      near(kind, x, z, R) { const G = Dg.crPosts(); let best = null; for (let i = -R; i <= R; i += 40) for (let j = -R; j <= R; j += 40) for (const p of G.at(x + i, z + j)) if (p.kind === kind && !p.down && window.__T.approach(p.x, p.z, 14, -0.4) && (!best || Math.hypot(p.x - x, p.z - z) < Math.hypot(best.x - x, best.z - z))) best = p; return best && { x: best.x, z: best.z, r: best.r, kind: best.kind }; },
    };
  });
  const shot = async (name, a) => { await ev(a => window.__T.shot(...a), a); await pg.waitForTimeout(400); await pg.screenshot({ path: OUT + '/' + name + '.png' }); await ev(() => { window.__hold = 0; }); };
  const R = {};
  // 1. head-on into a building at 30 mph: the front end caves in
  const wall = await ev(() => { const Dg = window.__crash.dbg; let best = null; for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) for (const bx of Dg.solids.at(7056 + i * 40, 1300 + j * 40)) { const w = bx.x1 - bx.x0, h = bx.z1 - bx.z0; if (!bx.park && w > 10 && h > 8 && (!best || Math.hypot((bx.x0 + bx.x1) / 2 - 7056, (bx.z0 + bx.z1) / 2 - 1300) < Math.hypot((best.x0 + best.x1) / 2 - 7056, (best.z0 + best.z1) / 2 - 1300))) best = bx; } return best; });
  R.wall = await ev(w => { window.__T.fresh(); const L = window.__T.run((w.x0 + w.x1) / 2, w.z1 + 14, 0, 30 / 2.237, 1.6); return { snap: window.__T.snap(), end: L[L.length - 1] }; }, wall);
  await pg.waitForTimeout(1500);
  { const d = await ev(() => { const d = window.__map.drvS(); return { x: d.x, z: d.z, yaw: d.yaw }; }); await shot('01-wall-30mph-front', [d.x + 4.2, 1.6, d.z - 2.6, d.x, 0.6, d.z - 1.8]); await shot('02-wall-30mph-side', [d.x + 5.5, 2.2, d.z + 1.5, d.x, 0.6, d.z - 0.8]); }
  // 2. clip a corner at 40 mph: spin
  R.corner = await ev(w => { window.__T.fresh(); const B = window.__crash.dbg.crBox(); const L = window.__T.run(w.x1 + B.hw - 0.6, w.z1 + 14, 0, 40 / 2.237, 2.2); return { snap: window.__T.snap(), maxYaw: Math.max(...L.map(r => Math.abs(r[2]))), endYaw: L[L.length - 1][5], endMph: L[L.length - 1][1] }; }, wall);
  // 3. a street light at 35 mph (breakaway) and one at 12 mph (it holds)
  const lamp = await ev(() => window.__T.near('lamp', 7056, 1300, 400));
  R.lampSlow = await ev(p => { window.__T.fresh(); const a = window.__T.approach(p.x, p.z, 12, -0.4); const L = window.__T.run(a.x, a.z, a.yaw, 12 / 2.237, 3.0, { gas: 0.1, brake: 0, steer: 0, hb: 0 }); return { snap: window.__T.snap(), endMph: L[L.length - 1][1] }; }, lamp);
  R.lampFast = await ev(p => { window.__T.fresh(); const a = window.__T.approach(p.x, p.z, 14, -0.4); const L = window.__T.run(a.x, a.z, a.yaw, 35 / 2.237, 1.0, { gas: 0, brake: 0, steer: 0, hb: 0 }); return { snap: window.__T.snap(), endMph: L[L.length - 1][1], fallen: window.__crash.fallen.length }; }, lamp);
  await ev(() => { for (let i = 0; i < 90; i++) window.__crash.dbg.fx(1 / 60); });
  await shot('03-light-pole-down', [lamp.x + 9, 3.5, lamp.z + 9, lamp.x, 0.8, lamp.z]);
  // 4. a hydrant at 20 mph
  const hyd = await ev(() => window.__T.near('hyd', 7056, 1300, 400));
  R.hyd = await ev(p => { window.__T.fresh(); const a = window.__T.approach(p.x, p.z, 12, -0.4); const L = window.__T.run(a.x, a.z, a.yaw, 20 / 2.237, 1.2, { gas: 0, brake: 0, steer: 0, hb: 0 }); return { snap: window.__T.snap(), endMph: L[L.length - 1][1], geysers: window.__crash.geysers.length }; }, hyd);
  await ev(() => { for (let i = 0; i < 90; i++) window.__crash.dbg.fx(1 / 60); });
  await shot('04-hydrant-geyser', [hyd.x + 9, 3.2, hyd.z + 9, hyd.x, 2.8, hyd.z]);
  // 5. a big tree trunk at 25 mph
  const tree = await ev(() => { const Dg = window.__crash.dbg; let best = null; for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) { const L = Dg.crPlants(7056 + i * 60, 1300 + j * 60, 4, []); for (const p of L) if (p.kind === 'tree' && p.r > 0.3 && !best && window.__T.approach(p.x, p.z, 12, -0.3)) best = p; } return best && { x: best.x, z: best.z, r: best.r }; });
  if (tree) R.tree = await ev(p => { window.__T.fresh(); const a = window.__T.approach(p.x, p.z, 12, -0.3); const L = window.__T.run(a.x, a.z, a.yaw, 25 / 2.237, 1.2, { gas: 0, brake: 0, steer: 0, hb: 0 }); return { tree: p, snap: window.__T.snap(), endMph: L[L.length - 1][1] }; }, tree);
  if (tree) { await pg.waitForTimeout(1500); const d = await ev(() => { const d = window.__map.drvS(); return { x: d.x, z: d.z, yaw: d.yaw }; }); await shot('05-tree-25mph', [d.x - Math.sin(d.yaw) * 6 + Math.cos(d.yaw) * 4, 2, d.z - Math.cos(d.yaw) * 6 - Math.sin(d.yaw) * 4, d.x, 0.7, d.z]); }
  // 6. a cop car parked across the road: T-bone it at 20 mph, it slides away
  R.cop = await ev(() => {
    const M = window.__map, C = window.__cops, d = M.drvS(); window.__T.fresh();
    const x = 7300, z = 1600; const u = C.copUnit('charger', x, z, Math.PI / 2, 'park', 555); u.sp = 0; u.a = null;
    const heat0 = M.S.heat || 0;
    const L = window.__T.run(x, z + 14, 0, 20 / 2.237, 1.8, { gas: 0, brake: 0, steer: 0, hb: 0 });
    for (let i = 0; i < 60; i++) { window.__crash.dbg.step(1 / 60); window.__crash.dbg.fx(1 / 60); }
    return { snap: window.__T.snap(), endMph: L[L.length - 1][1], copMoved: +Math.hypot(u.x - x, u.z - z).toFixed(2), copYaw: +(u.yaw * 57.3).toFixed(0), knock: !!u._crk, heat: (M.S.heat || 0) - heat0 };
  });
  await pg.waitForTimeout(1500); { const d = await ev(() => { const d = window.__map.drvS(); return { x: d.x, z: d.z }; }); await shot('06-cop-car-tboned', [d.x + 7, 3, d.z + 6, d.x, 0.7, d.z - 3]); }
  R.rail = await ev(() => { window.__T.fresh(); const zr = 1350 + 15.4; const L = window.__T.run(7600, zr - 6, Math.PI / 2 + 0.21, 60 / 2.237, 2.5, { gas: 0.3, brake: 0, steer: 0, hb: 0 }); const d = window.__map.drvS(); return { snap: window.__T.snap(), endMph: L[L.length - 1][1], z: +d.z.toFixed(2), yaw: +(d.yaw * 57.3).toFixed(1), railZ: zr }; });
  R.posts = await ev(() => window.__crash.postsN);
  console.log(JSON.stringify(R, null, 1));
  console.log('errors', errs.slice(0, 8)); await b.close();
})();
