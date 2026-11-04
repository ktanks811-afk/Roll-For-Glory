// Phase 3C launch, tire, suspension and wheelie tests (headless Chromium, Playwright).
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// Every pass runs the real car physics (window.__map.physStep) at 240 Hz on a prepped strip and times it from the beam
// (0.38 m rollout), like the Yello Belly boards. ONLY=street,slick,wheelie,setup,conv,wear picks tests.
// Prints one JSON line per pass; ERR lists page errors.
const { chromium } = require('playwright');
const S = process.env.S, ONLY = (process.env.ONLY || 'street,slick,wheelie,setup,conv,wear').split(',');
const HELL = 'dodge_charger_srt_hellcat_widebody_2020', MUS = 'ford_mustang_gt_2019', SCAT = 'dodge_charger_scat_pack_2015';
// drag pack index 7 = slicks, 0 = drag radials (DRAG_PACKS order)
const TESTS = {
  street: [{ n: 'Hellcat, street tires, launch control', car: HELL, lc: 1 }, { n: 'Hellcat, street tires, gas only', car: HELL },
    { n: 'Mustang GT, street tires, launch control', car: MUS, lc: 1 }, { n: 'C8, street tires, launch control', car: 'chevrolet_corvette_stingray_c8_2020', lc: 1 }],
  slick: [{ n: 'Hellcat, slicks cold (25 C)', car: HELL, lc: 1, pack: 7, psi: 16, tt: 25 }, { n: 'Hellcat, slicks hot (72 C)', car: HELL, lc: 1, pack: 7, psi: 16, tt: 72 },
    { n: 'Hellcat, slicks too hot (130 C)', car: HELL, lc: 1, pack: 7, psi: 16, tt: 130 }, { n: 'Hellcat, slicks hot, 32 psi', car: HELL, lc: 1, pack: 7, psi: 32, tt: 72 },
    { n: 'Hellcat, slicks hot, unprepped lot', car: HELL, lc: 1, pack: 7, psi: 16, tt: 72, noprep: 1 }],
  // synthetic power (pw) so a stock body can reach wheelie territory; the surface mu is raised to a sticky prepped track
  wheelie: [{ n: 'Mustang x2.4 power, slicks, loose front, high anti-squat, no wheelie bars', car: MUS, lc: 1, pack: 7, psi: 16, tt: 72, pw: 2.4, ext: 0, comp: 0, ast: 2, smu: 1.6, tc: 0 },
    { n: 'same car with wheelie bars', car: MUS, lc: 1, pack: 7, psi: 16, tt: 72, pw: 2.4, ext: 0, comp: 0, ast: 2, smu: 1.6, tc: 0, wbar: 1 },
    { n: 'same car, stiff front, low anti-squat', car: MUS, lc: 1, pack: 7, psi: 16, tt: 72, pw: 2.4, ext: 2, comp: 2, ast: 0, smu: 1.6, tc: 0 },
    { n: 'Hellcat x1.6 power on street tires (spins, no wheelie)', car: HELL, lc: 1, pw: 1.6, tc: 0 }],
  // a badly set up ~1,100 hp car against a properly set up 717 hp car
  setup: [{ n: 'Hellcat x1.55 power, street tires, cold, 35 psi, no TC, gas only', car: HELL, pw: 1.55, tc: 0, psi: 35, tt: 25 },
    { n: 'Hellcat stock power, hot slicks, 16 psi, launch control', car: HELL, lc: 1, pack: 7, psi: 16, tt: 72 }],
  conv: [{ n: 'Scat Pack, radials, stock converter', car: SCAT, lc: 1, pack: 0, psi: 18, tt: 60 }, { n: 'Scat Pack, radials, high stall +1,600', car: SCAT, lc: 1, pack: 0, psi: 18, tt: 60, conv: 2 }],
  wear: [{ n: 'Hellcat, no burnout', car: HELL, lc: 1 }, { n: 'Hellcat, 3 s burnout in the water box then a pass', car: HELL, burn: 3, lc: 1 }, { n: 'Hellcat, 6 s burnout then a pass', car: HELL, burn: 6, lc: 1 }],
};
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  await ev(() => { const M = window.__map; M.S.cash = 1e7; try { M.closeCreator(); } catch (e) {} });
  for (const name of ONLY) for (const c of TESTS[name] || []) {
    await ev(c => { const M = window.__map; M.S.car = M.newCar(c.car); M.S.car.fuel = 100;
      if (c.pack != null) { const k = M.DRAG_PACKS[c.pack]; M.S.car.drag = { pack: k.id, rim: k.rim, front: k.rim, fin: k.fin, bead: false, susp: { shocks: true, bars: true, wbar: !!c.wbar, ext: c.ext ?? 1, comp: c.comp ?? 1, asT: c.ast ?? 1, conv: !!c.conv, stall: c.conv || 1 } }; }
      if (c.psi) M.S.car.tune = Object.assign({}, M.S.car.tune, { psiR: c.psi });
      M.foot.on = false; M.gbMode(false); M.startDrive(7056.5, 1300); }, c);
    await wait(1200);
    const r = await ev(c => { const M = window.__map, d = M.drvS(), T = M.TIRE, Sf = M.SURF; if (M.foot.on) M.getIn();
      Object.assign(d, { x: 7056.5, z: 1300, yaw: 0, v: 0 }); M.physReset();
      const P = Object.assign({}, M.carPerf()); if (c.tc === 0) P.tc = false; P.pw *= c.pw || 1; const h = 1 / 240, step = (gas, brake) => M.physStep({ gas, brake, steer: 0, hb: 0 }, P, h);
      Sf.prep = c.noprep ? 0 : 1; Sf.mu = c.smu || 1; Sf.box = 0;
      for (let i = 0; i < 240; i++) step(0, 0);
      const out = {};
      if (c.burn) { T.vd.wJ = 0; Sf.box = 1; Sf.mu = 0.45; Sf.prep = 0; for (let i = 0; i < c.burn * 240; i++) step(0.85, 1); Sf.box = 0; Sf.mu = c.smu || 1; Sf.prep = c.noprep ? 0 : 1; for (let i = 0; i < 240; i++) step(0.2, 0); for (let i = 0; i < 240; i++) step(0, 1); for (let i = 0; i < 240; i++) step(0, 1); out.burnT = Math.round(Math.max(T.vd.tT[2], T.vd.tT[3])); out.burnWearPct = +(T.vd.wJ * 1.2e-6).toFixed(3); T.vd.wJ = 0; }
      T.vd.wJ = 0; if (c.tt) { T.vd.tT[2] = T.vd.tT[3] = c.tt; }
      d.v = 0; let x = 0, t = 0, t0 = null, liftMax = 0, barMax = 0, fzMin = 1e9, thMax = 0, spinMax = 0; const RO = 0.38, HOLD = c.lc ? 1.5 : 0, m = {};
      while (t < 16 && (t0 == null || x < RO + 201.2)) { step(1, t < HOLD ? 1 : 0); t += h; x += d.v * h; const st = T.vd;
        if (t >= HOLD && t - HOLD < 3) { liftMax = Math.max(liftMax, T.lift || 0); barMax = Math.max(barMax, T.bar || 0); fzMin = Math.min(fzMin, st.Fz[0] + st.Fz[1]); thMax = Math.max(thMax, st.th); spinMax = Math.max(spinMax, st.kap[2]); }
        if (t0 == null && x >= RO) { t0 = t; m.ro = +(t - HOLD).toFixed(3); }
        if (t0 != null) for (const [D, n] of [[18.288, '60ft'], [100.584, '330ft'], [201.168, 'et']]) if (m[n] == null && x >= RO + D) m[n] = +(t - t0).toFixed(3);
        if (t0 != null && m.ts == null && x >= RO + 181.05) m.ts = t; }
      m.mph = m.ts ? +(20.1168 / (t - m.ts) * 2.237).toFixed(1) : null; delete m.ts;
      return Object.assign(out, m, { liftCm: +(liftMax * 100).toFixed(1), wheelieBarN: Math.round(barMax), frontLoadMinN: Math.round(fzMin), pitchMaxDeg: +(thMax * 57.3).toFixed(1), rearSlipMax: +spinMax.toFixed(2), lcRpm: P.veh.lcRpm, stall: P.veh.stall , passWearPct: +((T.vd.wJ || 0) * 1.2e-6).toFixed(3) });
    }, c);
    console.log(JSON.stringify({ test: name, n: c.n, ...r }));
  }
  console.log('ERR', errs.join('\n').slice(0, 1500) || 'none'); await b.close();
})();
