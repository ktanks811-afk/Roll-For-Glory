// Grip and slide tests (2026-11-09) (headless Chromium, Playwright). Serve the repo on http://localhost:8765 (PORT= to change)
// and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// Runs the real car physics (window.__map.physStep, 240 Hz) with a scripted driver:
//   skid: 200 ft skidpad, the most lateral g the car holds for a second on the circle
//   step: full steering input at 67 mph for 2.5 s, then straight (how far the tail steps out, how it settles)
//   power: steady 30 mph corner, floor it with traction control off until the tail is out CAT degrees, then lift and
//          countersteer like a driver (power10/20/30: SPUN means it couldn't be caught)
//   corner / corneroff: full gas + full lock at 40 mph with traction control on / off
//   pull: straight-line pulls from 20/40/60 mph, TC on and off (NZ=1 adds a phone player's tiny steering taps, PW= scales power)
//   lift: lift off mid-corner at 50 mph; hb: handbrake turn at 40 mph then catch it
// CARS=id,id ONLY=skid,step,... LN=log every N steps; G='{"lsy":0.12}' overrides window.__grip; FO=1 adds per-tire loads/forces.
// Each log row: [t s, mph, body slip °, yaw °/s, lateral g, front wheel angle °, tire slip angles, wheel spin ratios, ESC, rpm, gear, lockup, throttle, TC torque, ESC level]
const { chromium } = require('playwright');
const S = process.env.S, CARS = (process.env.CARS || 'dodge_charger_srt_hellcat_widebody_2020').split(','), ONLY = (process.env.ONLY || 'skid,step,power,corner,pull').split(',');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 844, height: 390 } });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:' + (process.env.PORT || 8765) + '/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a);
  await ev(G => { if (G && window.__grip) Object.assign(window.__grip, JSON.parse(G)); const M = window.__map; M.S.cash = 1e7; try { M.closeCreator(); } catch (e) {} }, process.env.G || '');
  for (const car of CARS) {
    await ev(car => { const M = window.__map; M.S.car = M.newCar(car); M.S.car.fuel = 100; M.foot.on = false; M.gbMode(false); M.startDrive(7056.5, 1300); }, car);
    await pg.waitForTimeout(1000);
    const res = await ev(({ car, ONLY, TC, LN, FO, CAT, PW, NZ }) => {
      const M = window.__map, d = M.drvS(), T = M.TIRE, Sf = M.SURF; if (M.foot.on) M.getIn();
      const h = 1 / 240, LOGN = LN, process_FORCES = FO, process_CAT = CAT, PWK = PW, NOISE = NZ; const P0 = Object.assign({}, M.carPerf()); if (TC === '0') P0.tc = false;
      const st = () => { const u = d.v, sy = Math.sin(d.yaw), cy = Math.cos(d.yaw), v = T.vx * -cy + T.vz * sy; return { u, v, r: T.w, beta: Math.atan2(v, Math.max(0.5, Math.abs(u))) * 57.3, ay: T.ay }; };
      const reset = (u0) => { Object.assign(d, { x: 7056.5, z: 1300, yaw: 0, v: 0, steer: 0 }); M.physReset(); Sf.prep = 0; Sf.mu = 1; Sf.box = 0; T.vx = 0; T.vz = -u0; d.v = u0; };
      const run = (P, sec, ctl, log) => { let t = 0; const out = []; let k = 0;
        while (t < sec) { const c = ctl(t, st()); d.steer += (c.steer - d.steer) * (1 - Math.exp(-h * 7)); M.physStep({ gas: c.gas || 0, brake: c.brake || 0, steer: c.steer, hb: c.hb || 0 }, P, h); t += h;
          if (++k % (LOGN) === 0 && log) { const s = st(), vd = T.vd; out.push([+t.toFixed(1), +(s.u * 2.237).toFixed(0), +s.beta.toFixed(1), +(s.r * 57.3).toFixed(0), +(s.ay / 9.81).toFixed(2), +(T.delta * 57.3).toFixed(1), vd ? vd.al.map(a => +(a * 57.3).toFixed(0)).join('/') : '', vd ? vd.kap.map(a => +a.toFixed(2)).join('/') : '', +(vd.esc||0).toFixed(2), Math.round(vd.we*9.549), vd.g, vd.lock?1:0, +T.thr.toFixed(2), +vd.tcK.toFixed(2), +(vd.escF||0).toFixed(3)].concat(process_FORCES ? [vd.Fz.map(x=>Math.round(x)).join('/'), vd.fx.map(x=>Math.round(x)).join('/'), vd.fy.map(x=>Math.round(x)).join('/')] : [])); }
          if (Math.abs(st().beta) > 70) { out.push(['SPUN', +t.toFixed(1)]); break; } }
        return out; };
      const spdCtl = (tgt, s) => ({ gas: Math.max(0, Math.min(1, (tgt - s.u) * 0.5 + 0.15)), brake: s.u > tgt + 2 ? 0.3 : 0 });
      const R = {};
      if (ONLY.includes('pad')) { // constant steer, slowly raise speed: how much g before it lets go, and how it lets go
        reset(8); R.pad = run(P0, 22, (t, s) => Object.assign(spdCtl(8 + t * 1.3, s), { steer: 0.35 }), true); }
      if (ONLY.includes('step')) { reset(30); R.step = run(P0, 5, (t, s) => Object.assign(spdCtl(30, s), { steer: t < 2.5 ? 1 : 0 }), true); }
      // power oversteer: steady corner, floor it (TC off) until the tail is out by CATCH degrees, then lift and countersteer like a driver
      for (const cat of (process_CAT || [10, 20, 30])) if (ONLY.includes('power')) { const P = Object.assign({}, P0, { tc: false }); reset(14); let caught = null;
        R['power' + cat] = run(P, 7, (t, s) => { if (t < 2) return Object.assign(spdCtl(14, s), { steer: 0.6 }); if (caught == null && Math.abs(s.beta) < cat) return { gas: 1, steer: 0.6 }; if (caught == null) caught = t;
          return { gas: 0.2, steer: Math.max(-1, Math.min(1, s.beta / 10 - s.r * 57.3 / 50)) }; }, true); R['power' + cat].unshift(['caught at beta', cat]); }
      if (ONLY.includes('skid')) { // 200 ft skidpad (30.5 m radius): a driver holds the circle while the speed creeps up
        reset(10); let sI = 0.2, best = 0, acc = [], spun = 0, tEnd = 0;
        const out = run(P0, 40, (t, s) => { const want = Math.max(10, 10 + t * 0.35), err = s.u / 30.5 - s.r; sI = Math.max(-1, Math.min(1, sI + err * 0.02)); acc.push(Math.abs(s.u * s.u / 30.5 * 0 + s.ay)); if (acc.length > 240) acc.shift();
          if (Math.abs(err) < 0.03 && acc.length === 240) best = Math.max(best, acc.reduce((a, b) => a + b, 0) / 240 / 9.81); tEnd = t; return Object.assign(spdCtl(want, s), { steer: sI }); }, !!process_FORCES);
        R.skid = [['max steady g on a 200 ft skidpad', +best.toFixed(3)]].concat(out); }
      // straight-line pulls: rolling at V0 mph, floor it with the wheel straight; a phone player taps tiny corrections (noise)
      for (const v0 of [20, 40, 60]) for (const tc of [1, 0]) if (ONLY.includes('pull')) { const P = Object.assign({}, P0, { tc: tc ? P0.tc : false }); P.pw *= +(PWK || 1); reset(v0 / 2.237);
        let mb = 0, mr = 0, my = 0, y = 0, sp = 0, seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const out = run(P, 7, (t, s) => { mb = Math.max(mb, Math.abs(s.beta)); mr = Math.max(mr, Math.abs(s.r * 57.3)); y += s.v * h; my = Math.max(my, Math.abs(y)); if (T.lit) sp += h;
          return { gas: 1, steer: NOISE ? (rnd() - 0.5) * 0.15 : 0 }; }, !!process_FORCES);
        R['pull' + v0 + (tc ? 'tc' : 'off')] = [['max body slip', +mb.toFixed(1), 'max yaw', +mr.toFixed(0), 'sideways drift m', +my.toFixed(2), 'wheelspin s', +sp.toFixed(2), 'mph', +(d.v * 2.237).toFixed(0)]].concat(out); }
      if (ONLY.includes('corner')) { reset(18); R.corner = run(P0, 6, (t, s) => t < 4 ? { gas: 1, steer: 1 } : { gas: 0.3, steer: 0 }, true); }
      if (ONLY.includes('corneroff')) { reset(18); R.corneroff = run(Object.assign({}, P0, { tc: false }), 6, (t, s) => t < 4 ? { gas: 1, steer: 1 } : { gas: 0.3, steer: 0 }, true); }
      if (ONLY.includes('lift')) { reset(22); R.lift = run(P0, 5, (t, s) => t < 2.5 ? Object.assign(spdCtl(22 + t, s), { steer: 0.7 }) : { gas: 0, steer: 0.7 }, true); }
      if (ONLY.includes('hb')) { reset(18); R.hb = run(P0, 5, (t, s) => t < 0.8 ? { gas: 0.3, steer: 0.7 } : t < 1.4 ? { gas: 0, steer: 1, hb: 1 } : { gas: 0.4, steer: Math.max(-1, Math.min(1, s.beta / 10 - s.r * 57.3 / 50)) }, true); }
      return R;
    }, { car, ONLY, TC: process.env.TC, LN: +(process.env.LN || 24), FO: !!process.env.FO, CAT: process.env.CAT ? process.env.CAT.split(',').map(Number) : null, PW: process.env.PW || 1, NZ: !!process.env.NZ });
    console.log('=== ' + car);
    for (const k in res) { console.log('-- ' + k + '  [t, mph, beta°, yaw°/s, ay g, delta°, slipAngles, kappas, esc]'); for (const r of res[k]) console.log(JSON.stringify(r)); }
  }
  console.log('ERR', errs.join('\n').slice(0, 1500) || 'none'); await b.close();
})();
