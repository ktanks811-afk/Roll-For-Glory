// Rim sizes + drag tire widths (2026-11-08). Headless Chromium + the real car physics (window.__map.physStep, 240 Hz).
// Serve the repo on http://localhost:8765 and set S to a folder holding npm/node_modules/three (three@0.128.0).
// Every pass: launch control where the car has it, hot tires, timed from the beam (0.38 m rollout) on a prepped strip
// (drag packs) or the street (rims). Prints one JSON line per pass; ERR lists page errors.
const { chromium } = require('playwright');
const S = process.env.S;
const HELL = 'dodge_charger_srt_hellcat_widebody_2020', BOX = 'chevrolet_caprice_classic_box_chevy_1986', SCAT = 'dodge_charger_scat_pack_2015';
const T = [
  { n: 'Hellcat stock wheels (street)', car: HELL, lc: 1 },
  ...[20, 24, 26, 30].map(dia => ({ n: `Hellcat on ${dia}s (street)`, car: HELL, lc: 1, rims: dia })),
  { n: 'Box Chevy stock wheels (street)', car: BOX },
  ...[15, 22, 26, 30].map(dia => ({ n: `Box Chevy on ${dia}s (street)`, car: BOX, rims: dia })),
  ...['s28', 's29', 's30', 's32', 's33', 's345'].map(sz => ({ n: `Hellcat Weld V-Series slicks ${sz} (prep)`, car: HELL, lc: 1, pack: 'vser', size: sz, tubs: 2, prep: 1, tt: 72, psi: 16 })),
  ...['r275', 'r295', 'r315', 'r355', 'r33'].map(sz => ({ n: `Hellcat M&H radial vs radial ${sz} (prep)`, car: HELL, lc: 1, pack: 'rvr', size: sz, tubs: 2, prep: 1, tt: 72, psi: 16 })),
  ...['r275', 'r315', 'r355'].map(sz => ({ n: `Scat Pack Nitto NT555R ${sz} (prep)`, car: SCAT, lc: 1, pack: 'nittor', size: sz, tubs: 2, prep: 1, tt: 60, psi: 16 })),
  // a built car (x1.7 power, ~1,200 hp) is where the narrow tires can't hold it and width pays
  ...['s28', 's30', 's32', 's33', 's345'].map(sz => ({ n: `Built Hellcat x1.7 slicks ${sz} (prep)`, car: HELL, lc: 1, pack: 'vser', size: sz, tubs: 2, prep: 1, tt: 72, psi: 16, pw: 1.7 })),
  ...['r275', 'r315', 'r355', 'r33'].map(sz => ({ n: `Built Hellcat x1.7 radials ${sz} (prep)`, car: HELL, lc: 1, pack: 'rvr', size: sz, tubs: 2, prep: 1, tt: 72, psi: 16, pw: 1.7 })),
  ...['r275', 'r355'].map(sz => ({ n: `Built Hellcat x1.7 radials ${sz}, street (no prep)`, car: HELL, lc: 1, pack: 'rvr', size: sz, tubs: 2, tt: 60, psi: 16, pw: 1.7 })),
].filter(c => !process.env.ONLY || c.n.includes(process.env.ONLY));
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a);
  await ev(() => { const M = window.__map; M.S.cash = 1e7; try { M.closeCreator(); } catch (e) {} });
  for (const c of T) {
    await ev(c => { const M = window.__map; M.S.car = M.newCar(c.car); M.S.car.fuel = 100; if (c.tubs) M.S.car.tubs = c.tubs;
      if (c.rims) M.S.car.rims = { id: 'ls1', fin: 'chrome', dia: c.rims };
      if (c.pack) { const k = M.DRAG_PACKS.find(x => x.id === c.pack); M.S.car.drag = { pack: k.id, rim: k.rim, front: k.rim, fin: k.fin, bead: true, size: c.size, susp: { shocks: true, bars: true, wbar: true, ext: 1, comp: 1, asT: 1 } }; }
      if (c.psi) M.S.car.tune = Object.assign({}, M.S.car.tune, { psiR: c.psi });
      M.foot.on = false; M.gbMode(false); M.startDrive(7056.5, 1300); }, c);
    await pg.waitForTimeout(800);
    const r = await ev(c => { const M = window.__map, d = M.drvS(), T = M.TIRE, Sf = M.SURF; if (M.foot.on) M.getIn();
      Object.assign(d, { x: 7056.5, z: 1300, yaw: 0, v: 0 }); M.physReset();
      const P = Object.assign({}, M.carPerf()); P.pw *= c.pw || 1; const h = 1 / 240, step = (gas, brake) => M.physStep({ gas, brake, steer: 0, hb: 0 }, P, h);
      Sf.prep = c.prep ? 1 : 0; Sf.mu = 1; Sf.box = 0;
      for (let i = 0; i < 240; i++) step(0, 0);
      if (c.tt) T.vd.tT[2] = T.vd.tT[3] = c.tt;
      d.v = 0; let x = 0, t = 0, t0 = null, spin = 0; const RO = 0.38, HOLD = c.lc ? 1.5 : 0, m = {};
      while (t < 25 && (t0 == null || x < RO + 402.34)) { step(1, t < HOLD ? 1 : 0); t += h; x += d.v * h;
        if (t >= HOLD && t - HOLD < 2) spin = Math.max(spin, T.vd.kap[2]);
        if (t0 == null && x >= RO) t0 = t;
        if (m.s60 == null && d.v >= 26.82 && t >= HOLD) m.s60 = +(t - HOLD).toFixed(2);
        if (t0 != null) for (const [D, n] of [[18.288, '60ft'], [201.168, 'eighth'], [402.34, 'et']]) if (m[n] == null && x >= RO + D) m[n] = +(t - t0).toFixed(3); }
      m.mph = +(d.v * 2.237).toFixed(1);
      const V = P.veh; return Object.assign(m, { rearSlipMax: +spin.toFixed(2), tireIn: +(V.R[2] * 2 / 0.0254).toFixed(1), rearMu: +V.mu[2].toFixed(3), rearFn: Math.round(V.Fn[2]), wheelKg: +(V.Iw[2] / V.R[2] ** 2 / 0.62).toFixed(1), cgM: +V.h.toFixed(3) });
    }, c);
    console.log(JSON.stringify({ n: c.n, ...r }));
  }
  // the models: a Box Chevy on 30s sits up on its tires, a Hellcat on 34.5 slicks has wide rears in the tubs
  console.log('ERR', errs.join('\n').slice(0, 1500) || 'none'); await b.close();
})();
