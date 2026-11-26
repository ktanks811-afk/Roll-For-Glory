// Roll race tests for the new roll race system (2026-11-24), headless Chromium via Playwright.
// No web server needed: the page's files are served straight from the repo by a route. S = a folder with npm/node_modules/three
// (three@0.128.0). OUT = folder for screenshots (optional). ONLY=course,spot,here,pull,night,hood,net picks tests.
// Every race is real: your car on stepDrive, the racer on the same physics (physAs). The tests drive your car by holding the
// lane with the steering and pressing the gas RTD seconds after the third honk.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), S = process.env.S, OUT = process.env.OUT, ONLY = (process.env.ONLY || 'course,spot,here,pull,night,hood,net').split(',');
const log = o => console.log(JSON.stringify(o));
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', mp3: 'audio/mpeg', css: 'text/css', webmanifest: 'application/json', svg: 'image/svg+xml', glb: 'model/gltf-binary', m4a: 'audio/mp4' };
async function page(ctx, tag, q, errs) {
  const p = await ctx.newPage();
  p.on('crash', () => { errs.push(tag + ' CRASHED'); console.log(JSON.stringify({ crash: tag, errs: errs.slice(-8) })); });
  p.on('pageerror', e => errs.push(tag + ' ' + String(e.stack || e).slice(0, 500)));
  p.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(t)) errs.push(tag + ' console ' + t.slice(0, 300)); if (m.type() === 'warning' && /roll|pull-up/i.test(t)) errs.push(tag + ' warn ' + t.slice(0, 300)); });
  await p.goto('http://localhost:8765/index.html?test=1' + (q || ''));
  await p.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 240000, polling: 1000 });
  return p;
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF || 1) });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, r => { const p = r.request().url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await ctx.route(/^http:\/\/localhost:8765\/(.*)$/, r => { const u = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, ''), f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' }); });
  const errs = global.__errs = [];
  const shot = async (p, n) => { if (!OUT) return; await p.evaluate(() => { let st = document.getElementById('t3dhide'); if (!st) { st = document.createElement('style'); st.id = 't3dhide'; document.head.appendChild(st); } st.textContent = '#toast{display:none!important}'; }); await p.waitForTimeout(900); await p.screenshot({ path: OUT + '/' + n + '.png', timeout: 240000 }); };
  // set up a page: cash, rep, a car, in it, the frame loop's car step held so the test steps it
  const setup = async (p, car, x, z, yaw) => {
    await p.evaluate(() => { const M = window.__map; M.S.cash = 1e6; M.S.rep = 9999; try { M.closeCreator(); } catch (e) {} });
    await p.waitForTimeout(1200);
    await p.evaluate(([car, x, z]) => { const M = window.__map; M.S.car = M.newCar(car); M.S.car.fuel = 100; M.foot.on = false; M.gbMode(false); M.startDrive(x, z); M.setTime('night'); }, [car, x, z]);
    await p.waitForTimeout(2500);
    for (let k = 0; k < 30; k++) { const ok = await p.evaluate(() => { const M = window.__map; if (M.foot.on) M.getIn(); const o = M.carObj(); return !!(o && o.userData.model); }); if (ok) break; await p.waitForTimeout(1000); }
    await p.evaluate(([x, z, yaw]) => {
      const M = window.__map, Y = window.__yb, RR = Y.rr, d = M.drvS(); Y.test.manual = true;
      Object.assign(d, { x, z, yaw, v: 0, steer: 0 }); d.px = null;
      // the test driver: hold the lane you're in (or the race lane), the gas on a key, the pace's pedals while it's pacing
      window.__t = {
        lane: null, gas: 0, steer: true,
        I() { const T = RR.race, ph = T && T.ph, I = Object.assign({}, T && T.pace && (ph === 'pace' || ph === 'honk') ? RR.inFn() : RR.input());
          if (window.__t.gas != null && !(T && T.pace && (ph === 'pace' || ph === 'honk'))) I.gas = window.__t.gas;
          if (window.__t.hold != null && !(T && T.pace && (ph === 'pace' || ph === 'honk'))) { const e = window.__t.hold - d.v; I.gas = Math.max(0, Math.min(0.7, 0.08 + e * 0.25)); I.brake = e < -1.2 ? 0.25 : 0; }
          const C = T ? T.C : window.__t.C; if (C && window.__t.steer) { const lane = T ? T.meLat : window.__t.lane, e = RR.lat(C, d.x, d.z) - lane; let ye = d.yaw - RR.yaw(C); ye = Math.atan2(Math.sin(ye), Math.cos(ye)); I.steer = Math.max(-1, Math.min(1, e * 0.35 - ye * 2.2)); }
          return I; },
        run(n, dt, cond) { for (let i = 0; i < n; i++) { if (window.__t.each) window.__t.each(dt); window.__drvIn = window.__t.I; Y.test.tick(dt); if (cond && cond()) return i + 1; } return -1; }
      };
      window.__drvIn = window.__t.I;
    }, [x, z, yaw]);
  };
  const runTo = async (p, cond, maxS = 120, dt = 1 / 60) => { for (let k = 0; k < maxS; k++) { const r = await p.evaluate(`window.__t.run(${Math.round(1 / dt)}, ${dt}, () => (${cond}))`); if (r > 0) return true; } return false; };
  const raceState = p => p.evaluate(() => { const RR = window.__yb.rr, T = RR.race, M = window.__map, H = M.S.rrHist || [];
    const A = T && T.A, sl = RR.q && RR.q('slip'); return { on: RR.on, ph: T && T.ph, info: T && T.info, gap: T && T.oF != null && +(RR.S(T.C, M.drvS().x, M.drvS().z) + T.fA - T.oF).toFixed(2), oV: T && T.oV, road: T && T.C.name, v0: T && Math.round(T.v0 * 2.237), dist: T && Math.round(T.dist), me: T && { rt: T.me.rt && +T.me.rt.toFixed(3), t: T.me.done && +T.me.done.toFixed(3), mph: T.me.mph && +T.me.mph.toFixed(1), jump: T.me.jump, dq: T.me.dq, split: T.me.split.map(x => +x[0].toFixed(3)) },
      ai: A && { name: A.r.name, rt: +A.rt.toFixed(3), t: A.done && +A.done.toFixed(3), mph: A.mph && +A.mph.toFixed(1), shifts: A.shifts, missed: A.missed, jump: A.jump, split: A.split.map(x => +x[0].toFixed(3)) },
      them: T && T.them, res: T && T.res && T.res.res, slip: sl && !sl.hidden ? sl.innerText.replace(/\s+/g, ' ').slice(0, 500) : null, hist0: H[0], rec: M.S.rrRec, runs: M.S.streetRuns, cash: Math.round(M.S.cash), log: RR.log.slice(-14).map(e => e.k + (e.n ? e.n : '') + (e.who ? ':' + e.who : '') + (e.why ? ':' + e.why : '') + (e.k === 'never' ? JSON.stringify(e) : '')) }; });
  // drive one race to its slip: gas RTD after the go (or on cue for a jump test)
  const driveRace = async (p, o) => {
    await p.evaluate(o => { const RR = window.__yb.rr, t = window.__t; t.gas = 0; t.hold = null; t.goT = null;
      t.each = dt => { const T = RR.race; if (!T) return;
        if (!T.pace && (T.ph === 'pace' || T.ph === 'honk') && T.v0 > 0.5) t.hold = T.v0; else t.hold = null;
        if (o.jump && T.ph === 'honk' && T.honks >= 1) { t.hold = null; t.gas = 1; window.__map.keys.ArrowUp = true; }
        if (o.call && T.ph === 'honk' && T.caller === 'me' && T.honks < 3) { t.ht = (t.ht || 0) + dt; if (t.ht > 0.55) { t.ht = 0; RR.honk(); } }
        if (T.go != null && t.goT == null) t.goT = T.t;
        if (t.goT != null && T.t - t.goT >= o.rtd && T.ph === 'run') t.gas = 1;
        if (T.ph === 'done') t.gas = 0; }; }, o);
    const ok = await runTo(p, `window.__yb.rr.race && window.__yb.rr.race.shown || !window.__yb.rr.race`, o.maxS || 150);
    await p.evaluate(() => { window.__t.each = null; window.__t.gas = 0; window.__map.keys.ArrowUp = false; });
    return ok;
  };

  // ---------------- one player ----------------
  if (ONLY.some(x => x !== 'net')) {
    const A = await page(ctx, 'A', '', errs);
    await setup(A, process.env.CAR || 'dodge_charger_srt_hellcat_widebody_2020', 5600, 1357, -Math.PI / 2);

    if (ONLY.includes('course')) {
      const r = await A.evaluate(() => { const RR = window.__yb.rr, M = window.__map, out = [];
        for (const p of M.places().filter(p => p.type === 'roll' || p.type === 'sprint')) { const C = RR.spot(p, 1400); out.push([p.id, C && C.name, C && Math.round(C.ahead), C && C.hw, C && RR.maxDist(C, 60 / 2.237), C && RR.maxDist(C, 0)]); }
        const here = RR.course(-2000, -1352.5, -Math.PI / 2); return { spots: out, i20west: here && [here.name, Math.round(here.ahead), here.lanes] }; });
      log({ test: 'courses at every race spot: [id, road, straight ahead m, highway, max dist 60 roll, max dig]', ...r });
    }

    if (ONLY.includes('spot')) {
      const RACES = JSON.parse(process.env.RACES || JSON.stringify([
        { n: '60 roll, 1/2 mile, pace for me, vs Ghost (I-20 spot)', place: 'i20roll', opp: 3, v: 60, d: 804.67, pace: true, call: 'them', rtd: 0.22 },
        { n: 'Dig, 1/8 mile, vs Keisha (I-20 spot)', place: 'i20roll', opp: 1, v: 0, d: 201.17, pace: true, call: 'them', rtd: 0.25 },
        { n: '40 roll, 1/4 mile, I hold it, vs Twin (manual gearbox)', place: 'i20roll', opp: 4, v: 40, d: 402.34, pace: false, call: 'them', rtd: 0.2 },
        { n: '50 roll, 1/4, I call it (HONK x3), vs Big Dre', place: 'i20roll', opp: 5, v: 50, d: 402.34, pace: true, call: 'me', rtd: 0.0 },
        { n: 'Jump: gas on the first honk, 40 roll', place: 'i20roll', opp: 2, v: 40, d: 402.34, pace: true, call: 'them', jump: 1 },
        { n: '40 roll, 1/4 mile on a city street (East Lancaster Runs) vs Junebug', place: 'ironside_start', opp: 0, v: 40, d: 402.34, pace: true, call: 'them', rtd: 0.25 },
      ]));
      for (const [i, o] of RACES.entries()) {
        const st = await A.evaluate(o => { const M = window.__map, RR = window.__yb.rr; if (RR.race) RR.close('left'); const pf = M.S.rrPrefs = Object.assign(M.S.rrPrefs || {}, { v: o.v, d: o.d, pace: o.pace, call: o.call, x: 1 });
          const p = M.places().find(q => q.id === o.place); const ok = RR.startSpot(p, { r: M.STREET3D[o.opp] }); return { ok, road: RR.race && RR.race.C.name, cash: Math.round(M.S.cash) }; }, o);
        const ok = await driveRace(A, o);
        if (OUT && i === 0) { await shot(A, 'rr-slip'); }
        log({ test: 'spot race', n: o.n, started: st, ok, ...(await raceState(A)) });
        if (OUT && i === 0) {   // the replay, then the HUD mid-race from a fresh run
          await A.evaluate(() => document.querySelector('#rrhud [data-a="rep"]').click()); await A.evaluate(() => window.__t.run(200, 1 / 60)); await shot(A, 'rr-replay');
          await A.evaluate(() => { const RR = window.__yb.rr, M = window.__map; RR.close('left'); RR.startSpot(M.places().find(q => q.id === 'i20roll'), { r: M.STREET3D[3], v0: 60 / 2.237, dist: 804.67 }); });
          await runTo(A, `window.__yb.rr.race.ph === 'honk' && window.__yb.rr.race.honks >= 2`, 90); await shot(A, 'rr-honk');
          await runTo(A, `window.__yb.rr.race.go != null`, 30); await A.evaluate(() => { window.__t.gas = 1; }); await runTo(A, `window.__yb.rr.race.t - window.__yb.rr.race.go > 5`, 30); await shot(A, 'rr-run');
          await A.evaluate(() => { const M = window.__map, T = window.__yb.rr.race, C = M.cam(), p = [T.C.ox + T.C.dx * (T.finS - 40) + T.C.rx * 14, T.C.oz + T.C.dz * (T.finS - 40) + T.C.rz * 14]; C.position.set(p[0], 5, p[1]); C.lookAt(T.C.ox + T.C.dx * T.finS, 3, T.C.oz + T.C.dz * T.finS); C.updateMatrixWorld(); window.__map.renderer && 0; }); await shot(A, 'rr-finish-banner');
          await A.evaluate(() => { window.__t.gas = 0; window.__yb.rr.close('left'); });
        }
      }
    }

    if (ONLY.includes('here')) {   // from the Car panel, rolling on the big I-20 west of Fort Worth
      await A.evaluate(() => { const M = window.__map, RR = window.__yb.rr, d = M.drvS(); if (RR.race) RR.close('left'); Object.assign(d, { x: -6000, z: -1350 + 7, yaw: -Math.PI / 2, v: 0 }); d.px = null; window.__t.C = RR.course(d.x, d.z, d.yaw); window.__t.lane = 7; window.__t.hold = 30; });
      await runTo(A, `window.__map.drvS().v > 29`, 40);
      const menu = await A.evaluate(() => { const RR = window.__yb.rr, m = RR.hereMenu(); return { title: m.title, sub: m.sub, rows: m.rows.slice(0, 6).map(r => r.t) }; });
      log({ test: 'Car panel menu, rolling at 65 on I-20', menu });
      if (OUT) { await A.evaluate(() => window.__map.openMenu(window.__yb.rr.hereMenu)); await shot(A, 'rr-here-menu'); await A.evaluate(() => { document.getElementById('menu').hidden = true; }); }
      const st = await A.evaluate(() => { const M = window.__map, RR = window.__yb.rr, d = M.drvS(); window.__t.hold = null; M.S.rrPrefs.v = 60; M.S.rrPrefs.d = 1609.34; M.S.rrPrefs.pace = true; M.S.rrPrefs.call = 'them';
        return RR.start({ where: 'here', C: RR.course(d.x, d.z, d.yaw), r: M.STREET3D[7], v0: 60 / 2.237, dist: 1609.34, wager: 1200 }); });
      const ok = await driveRace(A, { rtd: 0.2, maxS: 200 });
      log({ test: 'here: 60 roll, 1 mile on I-20 vs Rell (Hellcat on radials)', started: st, ok, ...(await raceState(A)) });
    }

    if (ONLY.includes('pull')) {   // cruise on the highway till somebody pulls up, accept, race
      await A.evaluate(() => { const M = window.__map, RR = window.__yb.rr, d = M.drvS(); if (RR.race) RR.close('left'); Object.assign(d, { x: -9000, z: -1350 + 7, yaw: -Math.PI / 2, v: 0 }); d.px = null; window.__t.C = RR.course(d.x, d.z, d.yaw); window.__t.lane = 7; window.__t.hold = 26; RR.pullT = 1; });
      const got = await runTo(A, `window.__yb.rr.ask && window.__yb.rr.ask.kind === 'pull'`, 90);
      const ask = await A.evaluate(() => { const RR = window.__yb.rr, P = RR.ask && RR.ask.P; return P && { r: P.r.name, v0: Math.round(P.v0 * 2.237), d: Math.round(P.d), w: P.w, text: RR.q('ask').innerText.replace(/\s+/g, ' ') }; });
      log({ test: 'pull-up: a racer rolls up and asks', got, ask });
      if (OUT && got) await shot(A, 'rr-pullup');
      if (got) {
        await A.evaluate(() => { window.__t.hold = null; window.__yb.rr.q('ask').querySelector('.y').click(); });
        const ok = await driveRace(A, { rtd: 0.25 });
        log({ test: 'pull-up race', ok, ...(await raceState(A)) });
      }
    }

    if (ONLY.includes('night')) {   // Roll Night at the I-20 spot: semi, then the final if you win
      const r0 = await A.evaluate(() => { const M = window.__map, RR = window.__yb.rr; if (RR.race) RR.close('left'); M.S.rrNight = {}; window.__t.C = null; const p = M.places().find(q => q.id === 'i20roll'); RR.nightEnter(p); return { night: RR.night && RR.night.log, race: !!RR.race, opp: RR.race && RR.race.r.name }; });
      log({ test: 'Roll Night entered', ...r0 });
      let ok = await driveRace(A, { rtd: 0.18 });
      let st = await raceState(A); log({ test: 'Roll Night semi', ok, res: st.res, me: st.me, ai: st.ai, slip: st.slip });
      const fin = await A.evaluate(() => { const b = document.querySelector('#rrhud [data-a="nfinal"]'); if (b) { b.click(); return true; } return false; });
      if (fin) { ok = await driveRace(A, { rtd: 0.18 }); st = await raceState(A); log({ test: 'Roll Night final', ok, res: st.res, slip: st.slip, cash: st.cash }); }
      else log({ test: 'Roll Night: out in the semi (no final button)' });
    }

    if (ONLY.includes('hood')) {   // a hood regular runs you right where you're stopped: a dig on the street
      const st = await A.evaluate(() => { const M = window.__map, RR = window.__yb.rr, d = M.drvS(); if (RR.race) RR.close('left'); const p = M.places().find(p => p.type === 'roll' && !/i20/.test(p.id)) || M.places().find(p => p.type === 'sprint'), S0 = RR.spot(p, 500), L = RR.lanes(S0, S0.lanes[1]), q = [S0.ox + S0.rx * L[0], S0.oz + S0.rz * L[0]];
        Object.assign(d, { x: q[0], z: q[1], yaw: RR.yaw(S0), v: 0 }); d.px = null; window.__t.C = null;
        const C = RR.course(d.x, d.z, d.yaw); return { C: C && [C.name, Math.round(C.ahead)], ok: RR.hood(M.STREET3D[2]), v0: RR.race && Math.round(RR.race.v0 * 2.237) }; });
      const ok = st.ok ? await driveRace(A, { rtd: 0.3 }) : false;
      log({ test: 'hood regular runs you right here', started: st, ok, ...(await raceState(A)) });
    }
    log({ ERR: errs.slice(0, 12) });
    await A.close();
  }

  // ---------------- two players online ----------------
  if (ONLY.includes('net')) {
    const P1 = await page(ctx, 'P1', '&net=local', errs), P2 = await page(ctx, 'P2', '&net=local', errs);
    await P2.evaluate(() => { window.__map.S.name = 'Lawrence'; });
    await setup(P1, 'dodge_charger_srt_hellcat_widebody_2020', -6000, -1350 + 7, -Math.PI / 2);
    await setup(P2, 'chevrolet_camaro_ss_2016', -6000, -1350 + 2.6, -Math.PI / 2);
    // two full game pages drawing in software GL starve the test of time; the test steps the game itself, so stop the frame loop
    for (const p of [P1, P2]) await p.evaluate(() => { window.requestAnimationFrame = () => 0; });
    for (const p of [P1, P2]) await p.evaluate(() => window.__net.netJoin('eastgate'));
    for (const p of [P1, P2]) await p.waitForFunction(() => window.__net.NET.status === 'on', null, { timeout: 120000, polling: 500 });
    for (const p of [P1, P2]) await p.evaluate(() => setInterval(() => { for (const q of window.__net.NET.peers.values()) q.seen = Math.max(q.seen, performance.now() / 1000 - 1); }, 200));
    // both cruise at 40 side by side (each on their own physics), then P1 challenges P2
    for (const [p, lane] of [[P1, 7], [P2, 2.6]]) await p.evaluate(lane => { const RR = window.__yb.rr, d = window.__map.drvS(); window.__t.C = RR.course(d.x, d.z, d.yaw); window.__t.lane = lane; window.__t.hold = 17.9; }, lane);
    const pump = async n => { for (let i = 0; i < n; i++) { for (const p of [P1, P2]) await p.evaluate(() => { window.__t.run(6, 1 / 60); window.__net.netTick(0.1); }); await P1.waitForTimeout(30); } };
    await pump(40);
    const seen = await P1.evaluate(() => [...window.__net.NET.peers.values()].map(p => [p.name, Math.round(p.x), Math.round(p.z), +(p.sp || 0).toFixed(1), p.d3, p.inCar]));
    log({ test: 'online: P1 sees P2', seen });
    for (let i = 0; i < 20 && !(await P1.evaluate(() => window.__net.NET.peers.size)); i++) await pump(1);
    await P1.evaluate(() => { const RR = window.__yb.rr, p = [...window.__net.NET.peers.values()][0]; window.__map.S.rrPrefs = Object.assign(window.__map.S.rrPrefs || {}, { pace: true, call: 'them' }); RR.challenge(p, 40 / 2.237, 402.34, 500); });
    let asked = false; for (let i = 0; i < 40 && !asked; i++) { await pump(1); asked = await P2.evaluate(() => !!(window.__yb.rr.ask && window.__yb.rr.ask.kind === 'net')); }
    // (no invite screenshot here: a slow shot runs out the 15 s answer window)
    log({ test: 'online: P2 got the challenge', asked, text: asked && await P2.evaluate(() => window.__yb.rr.q('ask').innerText.replace(/\s+/g, ' ')) });
    if (asked) {
      const yes = await P2.evaluate(() => { window.__t.hold = null; const RR = window.__yb.rr, a0 = RR.ask, d = window.__map.drvS(), C0 = a0 && a0.C, mine = RR.course(d.x, d.z, d.yaw), pre = { ask: !!a0, C: C0 && [C0.dx, C0.dz, C0.w], mine: mine && [mine.dx, mine.dz], lat: C0 && RR.lat(C0, d.x, d.z), v: d.v, cash: window.__map.S.cash, driving: window.__map.driving };
        RR.q('ask').querySelector('.y').click(); return { pre, toast: document.getElementById('toast').textContent, on: RR.on, lat: RR.race ? null : [d.x, d.z, d.yaw] }; });
      log({ test: 'online: P2 said yes', yes });
      for (const p of [P1, P2]) await p.evaluate(() => { const RR = window.__yb.rr, t = window.__t; t.hold = null; t.gas = 0; t.goT = null;
        t.each = () => { const T = RR.race; if (!T) return; if (T.go != null && t.goT == null) t.goT = T.t; if (t.goT != null && T.t - t.goT > 0.22 && T.ph === 'run') t.gas = 1; if (T.ph === 'done') t.gas = 0; }; });
      let done = false;
      for (let i = 0; i < 400 && !done; i++) { if (process.env.DBG && i % 5 === 0) for (const [n, p] of [['P1', P1], ['P2', P2]]) console.log(n, i, JSON.stringify(await p.evaluate(() => { const T = window.__yb.rr.race, d = window.__map.drvS(); return T && { ph: T.ph, t: +T.t.toFixed(2), h: T.honks, v: +d.v.toFixed(1), x: Math.round(d.x), mem: performance.memory && Math.round(performance.memory.usedJSHeapSize / 1e6) }; })));
        await pump(1); done = (await P1.evaluate(() => !window.__yb.rr.race || window.__yb.rr.race.shown)) && (await P2.evaluate(() => !window.__yb.rr.race || window.__yb.rr.race.shown)); }
      log({ test: 'online race: P1 (host, Hellcat)', done, ...(await raceState(P1)) });
      log({ test: 'online race: P2 (Lawrence, Camaro)', done, ...(await raceState(P2)) });
      if (OUT) await shot(P2, 'rr-online-slip');
    }
    log({ ERR: errs.slice(0, 12) });
  }
  await b.close();
})().catch(e => { console.error(e); console.log(JSON.stringify({ ERRS: (global.__errs || []).slice(-12) })); process.exit(1); });
