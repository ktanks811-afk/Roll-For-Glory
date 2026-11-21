// Solid objects test (2026-11-21, "Fix collisions with solid objects"). Same setup as crash-test.cjs (S, PORT, OUT, CAR).
// Counts the solid street props (lamps, hydrants, poles, signal poles, stop signs, trash cans, benches), drives into a signal
// pole at 25 mph (stops), a trash can and a bench slow and fast (can flies, bench stops you slow and flips fast), 150 mph into
// I-20's rail at 60/20/15 fps, a 2 m box at 150 mph at 60/20/12 fps (no tunneling), the rail scrape at 60 mph, and the on-foot
// push-out from a lamp, signal pole, hydrant and a cop car.
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
  R.kinds = await ev(() => { const G = window.__crash.dbg.crPosts(), c = {}; const seen = new Set(); for (const L of G.m.values()) for (const o of L) if (!seen.has(o)) { seen.add(o); c[o.kind] = (c[o.kind] || 0) + 1; } return { c, n: window.__crash.postsN, sig: (window.__sigPoles || []).length }; });
  const near = k => ev(k => { const Dg = window.__crash.dbg, G = Dg.crPosts(); let best = null; for (let i = -10; i <= 10; i++) for (let j = -10; j <= 10; j++) for (const p of G.at(7056 + i * 40, 1300 + j * 40)) if (p.kind === k && !p.down && (!best || Math.hypot(p.x - 7056, p.z - 1300) < Math.hypot(best.x - 7056, best.z - 1300))) best = p; return best && { x: best.x, z: best.z, r: best.r }; }, k);
  const hitIt = (p, mph, sec) => ev(([p, mph, sec]) => { window.__T.fresh(); const G = window.__crash.dbg.crPosts(), hid = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const o of G.at(p.x + i * 20, p.z + j * 20)) if (!o.down && Math.hypot(o.x - p.x, o.z - p.z) > 0.05 && Math.hypot(o.x - p.x, o.z - p.z) < 18) { o.down = true; hid.push(o); } const a = window.__T.approach(p.x, p.z, 8, 0); for (const o of hid) o.down = false; if (!a) return 'no approach'; for (const o of hid) o.down = true; const L = window.__T.run(a.x, a.z, a.yaw, mph / 2.237, sec, { gas: 0, brake: 0, steer: 0, hb: 0 }); for (const o of hid) o.down = false; const d = window.__map.drvS(); return { endMph: L[L.length - 1][1], last: window.__crash.stats.last ? window.__crash.stats.last.kind + ' ' + window.__crash.stats.last.mph : 'no hit', dist: +Math.hypot(d.x - p.x, d.z - p.z).toFixed(2), fallen: window.__crash.fallen.length }; }, [p, mph, sec]);
  for (const k of ['signal', 'sign', 'can', 'bench']) { const p = await near(k); R[k] = p ? { p, slow: await hitIt(p, k === 'signal' ? 25 : 3.5, k === 'signal' ? 1.6 : 4.5), fast: k === 'signal' ? null : await hitIt(p, 25, 1.2) } : 'none'; if (p) { await ev(() => { for (let i = 0; i < 60; i++) window.__crash.dbg.fx(1 / 60); }); await shot('20-' + k, [p.x + 7, 2.8, p.z + 7, p.x, 0.8, p.z]); } }
  // tunneling: 150 mph straight at I-20's guardrail, at 20 fps (a slow phone frame)
  R.tunnel = await ev(() => { const M = window.__map, T = M.TIRE, d = M.drvS(), Dg = window.__crash.dbg; window.__T.fresh(); const zr = 1350 + 15.4, out = {};
    for (const [fps, mph] of [[60, 150], [20, 150], [15, 120]]) { const x = 7600, z = zr - 12, yaw = Math.PI; Object.assign(d, { x, z, yaw }); M.physReset(); d.px = null; Dg.step(1 / 60); Object.assign(d, { x, z, yaw }); d.px = x; d.pz = z; T.vx = 0; T.vz = mph / 2.237; d.v = mph / 2.237; T.w = 0; if (T.vd) T.vd.sync = true; window.__drvIn = () => ({ gas: 0, brake: 0, steer: 0, hb: 0 });
      let maxZ = -1e9; for (let i = 0; i < fps * 1.2; i++) { Dg.step(1 / fps); maxZ = Math.max(maxZ, d.z); } out[fps + 'fps_' + mph] = { maxZpastRail: +(maxZ - zr).toFixed(2), endZ: +(d.z - zr).toFixed(2), swept: window.__crash.stats.swept || 0 }; }
    return out; });
  R.parkedFast = await ev(() => { const M = window.__map, d = M.drvS(), Dg = window.__crash.dbg, T = M.TIRE; let w = null; for (let i = -8; i <= 8 && !w; i++) for (let j = -8; j <= 8 && !w; j++) for (const bx of Dg.solids.at(7056 + i * 40, 1300 + j * 40)) if (bx.park && window.__T.approach((bx.x0 + bx.x1) / 2, (bx.z0 + bx.z1) / 2, 40, 0)) { w = bx; break; } if (!w) return 'none';
    const out = {}; for (const fps of [60, 15]) { window.__T.fresh(); const cx = (w.x0 + w.x1) / 2, cz = (w.z0 + w.z1) / 2, a = window.__T.approach(cx, cz, 40, 0); const x = a.x, z = a.z, yaw = a.yaw; Object.assign(d, { x, z, yaw }); M.physReset(); d.px = null; Dg.step(1 / 60); Object.assign(d, { x, z, yaw }); d.px = x; d.pz = z; const v = 150 / 2.237; T.vx = -Math.sin(yaw) * v; T.vz = -Math.cos(yaw) * v; d.v = v; T.w = 0; if (T.vd) T.vd.sync = true; window.__drvIn = () => ({ gas: 0, brake: 0, steer: 0, hb: 0 });
      const s0 = window.__crash.stats.swept || 0; for (let i = 0; i < fps * 0.8; i++) Dg.step(1 / fps); const along = (d.x - x) * -Math.sin(yaw) + (d.z - z) * -Math.cos(yaw); out[fps + 'fps'] = { travelled: +along.toFixed(1), toCenter: 40, passedThrough: along > 41.5, swept: (window.__crash.stats.swept || 0) - s0, dv: window.__crash.stats.last && window.__crash.stats.last.mph }; }
    return out; });
  // a building wall at 160 mph, 20 fps
  R.wallFast = await ev(() => { const M = window.__map, T = M.TIRE, d = M.drvS(), Dg = window.__crash.dbg; let w = null; for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) for (const bx of Dg.solids.at(7056 + i * 40, 1300 + j * 40)) if (!bx.park && !bx.rail && bx.x1 - bx.x0 > 3 && bx.x1 - bx.x0 < 8 && bx.z1 - bx.z0 > 3 && !w) w = bx; if (!w) return 'no small building';
    window.__T.fresh(); const x = (w.x0 + w.x1) / 2, z = w.z1 + 30; const L = window.__T.run(x, z, 0, 160 / 2.237, 0.05); for (let i = 0; i < 30; i++) Dg.step(1 / 20); return { w: [w.x0, w.z0, w.x1, w.z1], endZ: +d.z.toFixed(2), inside: d.z < w.z1 && d.z > w.z0 - 3, passed: d.z < w.z0 }; });
  // the guardrail scrape still keeps its speed (the sweep must not snag on a rail you're already against)
  R.rail = await ev(() => { window.__T.fresh(); const X = window.__crash; const hits = []; const oi = X.dbg.crImpact; X.onHit2 = 1; const _f = X.dbg.crFind; window.__railHits = hits; const o = X.onHit; X.onHit = a => { hits.push([a.zone, +a.mph.toFixed(1), a.ev && a.ev.O && a.ev.O.kind]); return o && o(a); }; const zr = 1350 + 15.4; const L = window.__T.run(7600, zr - 6, Math.PI / 2 + 0.21, 60 / 2.237, 2.5, { gas: 0.3, brake: 0, steer: 0, hb: 0 }); const d = window.__map.drvS(); X.onHit = o; return { endMph: L[L.length - 1][1], z: +(d.z - zr).toFixed(2), hits: hits.slice(0, 12), trace: L.filter((r, i) => i % 15 == 0).map(r => [r[0], r[1], r[4]]) }; });
  // on foot: walking into a lamp, a signal pole, a trunk, a cop car
  R.foot = await ev(() => { const X = window.__crash.dbg, G = X.crPosts(), out = {}; for (const k of ['lamp', 'signal', 'trunk', 'hyd']) { let p = null; for (let i = -10; i <= 10 && !p; i++) for (let j = -10; j <= 10 && !p; j++) for (const o of G.at(7056 + i * 40, 1300 + j * 40)) if (o.kind === k) { p = o; break; } if (!p) { out[k] = 'none'; continue; } const r = X.crFootPush(p.x + 0.05, p.z, 0.35); out[k] = +Math.hypot(r[0] - p.x, r[1] - p.z).toFixed(2) + ' (min ' + (p.r + 0.35).toFixed(2) + ')'; }
    const C = window.__cops; const u = C.copUnit('charger', 7300, 1600, 0, 'park', 777); const r = X.crFootPush(7300.2, 1600.5, 0.35); out.copCar = r.map(v => +v.toFixed(2)); return out; });
  R.thinWall = await ev(() => { const M = window.__map, d = M.drvS(), Dg = window.__crash.dbg, T = M.TIRE; const zr = 1350 + 15.4, wz = zr - 8, wx = 7650;
    const w = { x0: wx - 1, z0: wz - 5, x1: wx + 1, z1: wz + 5 }; Dg.solids.add(w, w.x0, w.z0, w.x1, w.z1);   // a 2 m thick box (a parked car side-on)
    const out = {}; for (const fps of [60, 20, 12]) { window.__T.fresh(); const x = wx + 30, z = wz, yaw = Math.PI / 2; Object.assign(d, { x, z, yaw }); M.physReset(); d.px = null; Dg.step(1 / 60); Object.assign(d, { x, z, yaw }); d.px = x; d.pz = z; const v = 150 / 2.237; T.vx = -v; T.vz = 0; d.v = v; T.w = 0; if (T.vd) T.vd.sync = true; window.__drvIn = () => ({ gas: 0, brake: 0, steer: 0, hb: 0 });
      const s0 = window.__crash.stats.swept || 0; let minX = 1e9; for (let i = 0; i < fps * 0.6; i++) { Dg.step(1 / fps); minX = Math.min(minX, d.x); } out[fps + 'fps'] = { endX: +(d.x - wx).toFixed(2), minX: +(minX - wx).toFixed(2), passedThrough: d.x < wx, swept: (window.__crash.stats.swept || 0) - s0, dv: window.__crash.stats.last && window.__crash.stats.last.mph }; }
    w.x0 = w.x1 = w.z0 = w.z1 = -1e9; return out; });
  R.stopStats = await ev(() => window.__crash.stats.swept || 0);
  console.log(JSON.stringify(R, null, 1));
  console.log('errors', errs.slice(0, 8)); await b.close();
})();
