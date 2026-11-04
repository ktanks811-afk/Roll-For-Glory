// I-20 roll race tests (Phase 3D) (headless Chromium, Playwright).
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// ONLY=race,pull picks tests. RACES=JSON list overrides the race list. Prints one JSON line per test; ERR lists page errors.
// race: full in-world roll races vs AI racers (pace, honks, go, finish, slip). pull: pure-physics highway pulls per car and roll speed.
const { chromium } = require('playwright');
const S = process.env.S, ONLY = (process.env.ONLY || 'race,pull').split(',');
const RACES = JSON.parse(process.env.RACES || JSON.stringify([
  { n: '60 roll, 1/2 mile, pace for me, vs Ghost', mode: 'roll60', dist: 804.67, act: 'auto', opp: 3, rtd: 0.2 },
  { n: '20 roll, 1/4 mile, vs Twin (manual gearbox)', mode: 'roll20', dist: 402.34, act: 'auto', opp: 4, rtd: 0.2 },
  { n: '40 roll, custom 0.3 mile, I drive it, vs Big Dre', mode: 'roll40', dist: -1, custD: 0.3, act: 'manual', opp: 5, rtd: 0.2 },
  { n: '70 roll, 1 mile, vs Nita', mode: 'roll70', dist: 1609.34, act: 'auto', opp: 6, rtd: 0.2 },
  { n: 'Custom 50 roll... 30 roll, 1/8, vs Keisha', mode: 'roll30', dist: 201.17, act: 'auto', opp: 1, rtd: 0.2 },
  { n: 'Dig, 1/8 mile, vs Keisha', mode: 'dig', dist: 201.17, act: 'auto', opp: 1, rtd: 0.25 },
  { n: 'Jump: gas before the third honk, 50 roll', mode: 'roll50', dist: 402.34, act: 'auto', opp: 3, jump: 1 },
]));
const CARS = (process.env.CARS || 'dodge_charger_srt_hellcat_widebody_2020,ford_mustang_gt_2019,chevrolet_camaro_ss_2016,ram_1500_trx_2021,chevrolet_tahoe_2021,mercedes_amg_g63_2019').split(',');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const pg = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF || 1) });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600))); pg.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /roll|I-20/.test(m.text()))) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const shot = async n => { await ev(() => { let st = document.getElementById('t3dhide'); if (!st) { st = document.createElement('style'); st.id = 't3dhide'; document.head.appendChild(st); } st.textContent = '.pad,#radio,#card,#mini,#compass{display:none!important}'; }); await wait(700); await pg.screenshot({ path: S + '/b/t3d_' + n + '.png', timeout: 180000 }); };
  await ev(() => { const M = window.__map; M.S.cash = 1e7; M.S.rep = 9999; try { M.closeCreator(); } catch (e) {} });
  await wait(1500);
  const CAR = process.env.CAR || 'dodge_charger_srt_hellcat_widebody_2020';
  await ev(`(() => { const M = window.__map; M.S.car = M.newCar('${CAR}'); M.S.car.fuel = 100; M.foot.on = false; M.gbMode(false); M.startDrive(5600, 1363); M.setTime('night'); })()`);
  await wait(3000);
  for (let k = 0; k < 20; k++) { const ok = await ev(() => { const M = window.__map; if (M.foot.on) M.getIn(); const o = M.carObj(); return !!(o && o.userData.model); }); if (ok) break; await wait(1000); }
  await ev(() => { window.__yb.test.manual = true; const Y = window.__yb, M = window.__map;
    window.__t = { run(n, dt, cond) { for (let i = 0; i < n; i++) { if (window.__t.drive) window.__t.drive(dt); Y.test.tick(dt); if (cond && cond()) return i + 1; } return -1; } }; });
  const runTo = async (cond, maxS = 120, dt = +(process.env.DT || 1 / 60)) => { for (let k = 0; k < maxS; k++) { const r = await ev(`window.__t.run(${Math.round(1 / dt)}, ${dt}, () => (${cond}))`); if (r > 0) return true; } return false; };

  if (ONLY.includes('race')) for (const [i, o] of RACES.entries()) {
    await ev(o => { const M = window.__map, Y = window.__yb, H = Y.roll, d = M.drvS(); if (H.on) H.close('left'); M.keys.ArrowUp = false;
      Object.assign(H, { mode: o.mode, act: o.act, dist: o.dist }); if (o.custD) H.custD = o.custD;
      const p = M.places().find(q => q.id === 'i20roll'); H.start(p, M.STREET3D[o.opp]);
      const T = window.__t; T.ph = 'pre'; T.log = []; T.go = null; T.lastLog = 0;
      // the driver: steer down the lane; in "I drive it" hold the number with the pedal; go RTD after the third honk
      T.drive = dt => { const zMe = Y.hw.lanes[1], st = H.st; if (!H.on) return;
        const steer = Math.max(-1, Math.min(1, (d.z - zMe) * 0.5 - (d.yaw + Math.PI / 2) * 2.5));
        if (o.jump && st === 'honk' && H.honks === 1) M.keys.ArrowUp = true;
        if (H.man && (st === 'pace' || st === 'honk')) { const e = H.v0 - d.v; window.__drvIn = () => ({ gas: Math.max(0, Math.min(0.6, 0.06 + e * 0.25)), brake: e < -1.2 ? 0.2 : 0, steer, hb: 0 }); }
        else if (window.__drvIn && window.__drvIn.name !== 'hrIn' && st !== 'pace' && st !== 'honk') window.__drvIn = null;
        if (st === 'run' && T.go == null) T.go = H.t;
        if (T.go != null && H.t - T.go >= o.rtd && !M.keys.ArrowUp && st === 'run') M.keys.ArrowUp = true;
        if (st === 'done') M.keys.ArrowUp = false;
        if (H.t - T.lastLog > 0.25 && T.log.length < 80 && (st === 'honk' || st === 'run')) { T.lastLog = H.t; const vd = M.TIRE.vd, A = H.ai, av = A && A.st.t.vd;
          T.log.push([+(H.t - (T.go || H.t)).toFixed(2), st, +(d.v * 2.237).toFixed(1), M.TIRE.gA, vd && Math.round(Math.abs(vd.we) * 30 / Math.PI), A && +(A.v * 2.237).toFixed(1), A && (A.gb ? 'm' + A.gb.g : av && av.g), A && Math.round(Math.abs(av ? av.we : 0) * 30 / Math.PI), A && +((d.x + H.fA) - (A.x + A.fA)).toFixed(2)]); } };
    }, o);
    const ok = await runTo(`window.__yb.roll.shown || !window.__yb.roll.on`, 160);
    if (process.env.SHOTS && i === 0) { /* covered below */ }
    const r = await ev(() => { const H = window.__yb.roll, A = H.ai, M = window.__map, q = k => document.querySelector(`#ybhud [data-k="${k}"]`); M.keys.ArrowUp = false;
      return { on: H.on, shown: H.shown, man: H.man, v0mph: Math.round(H.v0 * 2.237), dist: Math.round(H.dist), me: H.me, ai: A && { rt: +A.rt.toFixed(3), t: A.done && +A.done.toFixed(3), mph: A.mph && +A.mph.toFixed(1), top: +(A.top * 2.237).toFixed(1), shifts: A.shifts, missed: A.missed, tier: H.opp && A.sk },
        slip: q('slip') && q('slip').innerText.replace(/\s+/g, ' ').slice(0, 420), hist: (M.S.rollHist || [])[0], rec: M.S.rollRec, log: window.__t.log }; });
    console.log(JSON.stringify({ test: 'race', n: o.n, ok, ...r }));
    if (process.env.SHOTS && i === 0) {
      await shot('slip');
      await ev(() => document.querySelector('#ybhud [data-a="rep"]').click());
      await ev(() => window.__t.run(150, 1 / 60)); await shot('replay');
      await ev(() => { window.__t.drive = null; const H = window.__yb.roll; H.close('left'); });
    }
  }
  if (process.env.SHOTS) {   // the HUD mid-race and the closure, from a fresh 60 roll
    await ev(() => { const M = window.__map, Y = window.__yb, H = Y.roll, d = M.drvS(); Object.assign(H, { mode: 'roll60', act: 'auto', dist: 804.67 }); H.start(M.places().find(q => q.id === 'i20roll'), M.STREET3D[3]); window.__t.drive = null; });
    await runTo(`window.__yb.roll.st === 'honk' && window.__yb.roll.honks >= 2`, 90); await shot('honk');
    await ev(() => { const M = window.__map, H = window.__yb.roll, C = M.cam(), x = H.zone0 - 20; C.position.set(x - 18, 3.2, 1350 - 4); C.lookAt(x, 1.2, 1357); C.updateMatrixWorld(); }); await shot('closure');
    await runTo(`window.__yb.roll.go != null`, 30); await ev(() => { window.__map.keys.ArrowUp = true; }); await runTo(`window.__yb.roll.t - window.__yb.roll.go > 4`, 30); await shot('run');
    await ev(() => { const M = window.__map, H = window.__yb.roll, C = M.cam(), x = H.finX; C.position.set(x - 30, 4, 1350 - 6); C.lookAt(x, 3, 1357); C.updateMatrixWorld(); }); await shot('finish');
    await ev(() => { window.__map.keys.ArrowUp = false; window.__yb.roll.close('left'); });
  }
  // pure physics: hold the roll speed in whatever gear the box picks for 4 s, then floor it; time to 1/4 mile, the gears it
  // picked (kickdown), and 60-100 / 40-100 style splits. Same car, shorter final drive, to show gearing matters.
  if (ONLY.includes('pull')) for (const CAR2 of CARS) for (const gear of [0, 1]) {
    if (gear && !/mustang|camaro/.test(CAR2)) continue;
    await ev(o => { const M = window.__map; M.S.car = M.newCar(o.car); M.S.car.fuel = 100; if (o.gear) { M.S.car.tparts = (M.S.car.tparts || []).concat('gears'); M.S.car.tune = Object.assign({}, M.S.car.tune, { fd: 3.42 * 1.18 }); } }, { car: CAR2, gear });
    await wait(400);
    const r = await ev(o => { const M = window.__map, d = M.drvS(), T = M.TIRE, Sf = M.SURF, P = Object.assign({}, M.carPerf()), h = 1 / 240, out = [];
      Sf.prep = 0; Sf.mu = 1; Sf.box = 0;
      for (const mph of [20, 30, 40, 50, 60, 70]) {
        const v0 = mph / 2.237; Object.assign(d, { x: 5000, z: 1357, yaw: -Math.PI / 2, v: v0 }); M.physReset(); T.vx = v0; T.vz = 0;   // yaw -90 deg faces +x
        for (let i = 0; i < 240 * 4; i++) { const e = v0 - d.v; M.physStep({ gas: Math.max(0, Math.min(0.6, 0.06 + e * 0.25)), brake: 0, steer: 0, hb: 0 }, P, h); }
        const g0 = T.vd.g, rpm0 = Math.round(Math.abs(T.vd.we) * 30 / Math.PI); let x = 0, t = 0, gs = [g0], gT = null, m = {}, spool = null;
        while (t < 40 && x < 402.34) { M.physStep({ gas: 1, brake: 0, steer: 0, hb: 0 }, P, h); t += h; x += d.v * h; if (P.turbo && spool == null && T.boost > 0.9) spool = +t.toFixed(2); if (T.vd.g !== gs[gs.length - 1]) { gs.push(T.vd.g); if (gT == null) gT = +t.toFixed(2); }
          const mp = d.v * 2.237; for (const s of [60, 80, 100, 120]) if (mp >= s && m[s] == null && mph < s) m[s] = +t.toFixed(2); }
        out.push({ mph, g0, rpm0, kick: gs.slice(0, 4).join('>'), kickAt: gT, q: +t.toFixed(2), trap: +(d.v * 2.237).toFixed(1), to: m, spool90: spool });
      }
      return { car: o.car, gear: o.gear, fd: P.veh.fd, out };
    }, { car: CAR2, gear });
    console.log(JSON.stringify({ test: 'pull', ...r }));
  }
  console.log('ERR', errs.join('\n').slice(0, 2000) || 'none'); await b.close();
})();
