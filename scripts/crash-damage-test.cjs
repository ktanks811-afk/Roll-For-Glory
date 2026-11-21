// Crash damage tests, realism phase 1B (2026-11-21, "real collision damage like gta 6"). Same setup as crash-test.cjs:
// serve the repo on http://localhost:8765 (PORT=), S = folder with npm/node_modules/three, OUT = screenshot folder, CAR = car id.
// Checks: 20 mph wall (windshield cracks, hood springs, front lights out), 50 mph wall (windshield + front door glass out,
// hood tears off), a 32 mph T-bone on the right doors (doors hang, side glass out, flat tire), smoke then fire from a dead
// motor, a cop car you hit at 35 mph gets dented, and the body/tire/engine shop clears it all.
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
      fresh() { const c = M.S.car; for (const k of ["body","tires","engine"]) try { window.__crash.onFix && window.__crash.onFix(c, k); } catch (e) {} c.fire = 0; c.cond.body = c.cond.lights = c.cond.engine = c.cond.tires = 100; c.dents = []; c.pull = 0; c.rad = 0; c.bag = false; M.S.health = 100; Dg.crDentRestore(Dg.car.userData.model); },
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
  const st = () => ev(() => { const c = window.__map.S.car, M3 = window.__crash.dbg.car.userData.model, D = M3.userData.cd; return { gls: JSON.stringify(c.gls || {}), nGlass: D && D.glass.length, glassBig: D && D.glass.filter(g => g.big).length, lout: Object.keys(c.lout || {}).length, nLamps: D && D.lamps.length, pan: JSON.stringify(c.pan || {}), panels: D && D.panels.map(p => p.k).join(','), flat: JSON.stringify(c.flat || []), fire: c.fire || 0, parts: window.__crash.CD.parts.length, snap: window.__T.snap() }; });
  const wall = await ev(() => { const Dg = window.__crash.dbg; let best = null; for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) for (const bx of Dg.solids.at(7056 + i * 40, 1300 + j * 40)) { const w = bx.x1 - bx.x0, h = bx.z1 - bx.z0; if (!bx.park && w > 10 && h > 8 && (!best || Math.hypot((bx.x0 + bx.x1) / 2 - 7056, (bx.z0 + bx.z1) / 2 - 1300) < Math.hypot((best.x0 + best.x1) / 2 - 7056, (best.z0 + best.z1) / 2 - 1300))) best = bx; } return best; });
  const where = () => ev(() => { const d = window.__map.drvS(); return { x: d.x, z: d.z, yaw: d.yaw }; });
  const around = (d, ang, dist, h, ly) => { const a = d.yaw + ang; return [d.x - Math.sin(a) * dist, h, d.z - Math.cos(a) * dist, d.x, ly, d.z]; };
  // A. 20 mph front: cracked windshield, sprung hood, front lights out
  R.f20 = await ev(w => { window.__T.fresh(); window.__T.run((w.x0 + w.x1) / 2, w.z1 + 10, 0, 20 / 2.237, 1.6, { gas: 0, brake: 0, steer: 0, hb: 0 }); return 1; }, wall); R.f20 = await st();
  // drive off with the sprung hood to see it flap
  await ev(() => { const d = window.__map.drvS(); window.__T.run(d.x, d.z + 3, Math.PI, 3, 0.1, { gas: 0, brake: 0, steer: 0, hb: 0 }); window.__crash.CD.dbg.step(0.5); });
  { const d = await where(); await shot('07-20mph-cracked-glass-sprung-hood', around(d, 0.5, 6, 2.0, 0.8)); await shot('07b-windshield-close', around(d, 0.15, 3.6, 2.4, 1.0)); }
  // B. 50 mph front into the same wall: windshield gone, hood off, airbag
  R.f50 = await ev(w => { window.__T.fresh(); window.__T.run((w.x0 + w.x1) / 2, w.z1 + 14, 0, 50 / 2.237, 1.4, { gas: 0, brake: 0, steer: 0, hb: 0 }); for (let i = 0; i < 120; i++) window.__crash.CD.dbg.step(1 / 60); return 1; }, wall); R.f50 = await st();
  { const d = await where(); await shot('08-50mph-hood-off-glass-out', around(d, 0.6, 6.5, 2.4, 0.8)); await shot('09-50mph-top', around(d, 0.2, 4, 4.5, 0.6)); await shot('09b-50mph-profile', around(d, Math.PI / 2, 6.5, 1.0, 0.7)); }
  // C. side slam: slide sideways into the wall at 30 mph -> door hangs, side glass out, flat tire maybe
  // a car T-bones you in the right front door at 32 mph (the hit itself, fed straight into the damage)
  R.sideLog = await ev(() => { window.__T.fresh(); const M = window.__map, d = M.drvS(), X = window.__crash, T = M.TIRE; T.vx = T.vz = 0; T.w = 0;
    const cs = Math.cos(d.yaw), sn = Math.sin(d.yaw), B = X.dbg.crBox(), lx = B.hw, lz = -0.6;   // car frame -> world: (x c + z s, -x s + z c)
    const px = d.x + lx * cs + lz * sn, pz = d.z - lx * sn + lz * cs, nx = -cs, nz = sn;
    X.simT = (X.simT || 0) + 5000; X.dbg.crImpact({ dv: 32 / 2.237, px, pz, nx, nz, O: { kind: 'hood' } });
    X.simT += 5000; X.dbg.crImpact({ dv: 19 / 2.237, px: d.x + lx * cs + 1.45 * sn, pz: d.z - lx * sn + 1.45 * cs, nx, nz, O: { kind: 'wall2' } });
    return X.stats.last; }); R.side = await st();
  await ev(() => { for (let i = 0; i < 30; i++) window.__crash.CD.dbg.step(1 / 60); });
  { const d = await where(); await shot('10-side-hit-door-glass', around(d, -Math.PI / 2, 6, 1.8, 0.8)); }
  // D. hurt motor smoke, then fire
  R.smoke = await ev(() => { const c = window.__map.S.car, CD = window.__crash.CD; c.cond.engine = 30; for (let i = 0; i < 120; i++) CD.dbg.step(1 / 60); const a = CD.smoke ? CD.smoke.P.length : 0; c.cond.engine = 0; c.fire = 1; for (let i = 0; i < 120; i++) CD.dbg.step(1 / 60); return { grey: a, fire: CD.smoke.FP.length, black: CD.smoke.P.length }; });
  { const d = await where(); await shot('11-engine-fire', around(d, 0.6, 7.5, 2.2, 1.6)); }
  // E. T-bone a cop car at 35: it dents
  await ev(() => { const C = window.__cops; window.__T.fresh(); window.__U = C.copUnit('charger', 7300, 1600, Math.PI / 2, 'park', 556); window.__U.sp = 0; window.__U.a = null; const d = window.__map.drvS(); d.x = 7300; d.z = 1614; });
  await pg.waitForFunction(() => !!window.__U.model, null, { timeout: 60000 }).catch(() => {});
  R.npc = await ev(() => { const x = 7300, z = 1600, u = window.__U;
    const m = u.model; let pos0 = null; if (m) { pos0 = []; m.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) pos0.push([o, o.geometry.attributes.position.array.slice()]); }); }
    window.__T.run(x, z + 14, 0, 35 / 2.237, 1.4, { gas: 0, brake: 0, steer: 0, hb: 0 }); for (let i = 0; i < 60; i++) { window.__crash.dbg.step(1 / 60); window.__crash.dbg.fx(1 / 60); }
    let mx = 0; if (pos0) for (const [o, a] of pos0) { const b = o.geometry.attributes.position.array; if (b.length !== a.length) continue; for (let i = 0; i < a.length; i++) mx = Math.max(mx, Math.abs(a[i] - b[i])); }
    return { crD: u._crD, moved: Math.hypot(u.x - x, u.z - z).toFixed(2), maxVertMove: +mx.toFixed(3), hasModel: !!m, dentSet: window.__crash.CD.npcDent.size }; });
  { const u = await ev(() => { const u = window.__U; return { x: u.x, z: u.z }; }); await ev(() => { const d = window.__map.drvS(); d.x += 30; window.__T.run(d.x, d.z, 0, 0, 0.05); }); await shot('12-cop-car-dented', [u.x + 1.5, 1.8, u.z + 6.5, u.x, 0.7, u.z]); }
  // F. body shop fixes it all
  R.fixed = await ev(() => { const M = window.__map, c = M.S.car; for (const k of ['body', 'tires', 'engine']) window.__crash.onFix && window.__crash.onFix(c, k); return { gls: c.gls, pan: c.pan, flat: c.flat, fire: c.fire }; });
  console.log(JSON.stringify(R, null, 1));
  console.log('errors', errs.slice(0, 8)); await b.close();
})();
