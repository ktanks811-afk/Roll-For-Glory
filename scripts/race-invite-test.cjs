// Online race invite tests (2026-11-28): invite, counter, line up, both bets held, the winner takes the pot. Based on roll-race-test.cjs, headless Chromium via Playwright.
// No web server needed: the page's files are served straight from the repo by a route. S = a folder with npm/node_modules/three
// (three@0.128.0). OUT = folder for screenshots (optional). ONLY=dig,roll picks tests.
// Every race is real: your car on stepDrive, the racer on the same physics (physAs). The tests drive your car by holding the
// lane with the steering and pressing the gas RTD seconds after the third honk.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), S = process.env.S, OUT = process.env.OUT, ONLY = (process.env.ONLY || "dig,roll").split(',');
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
  const shot = async (p, n) => { if (!OUT) return; await p.evaluate(() => { let st = document.getElementById('t3dhide'); if (!st) { st = document.createElement('style'); st.id = 't3dhide'; document.head.appendChild(st); } st.textContent = '#toast{display:none!important}'; try { const M = window.__map; M.rnd().render(M.scn(), M.cam()); } catch (e) {} }); await p.waitForTimeout(900); await p.screenshot({ path: OUT + '/' + n + '.png', timeout: 240000 }); };
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


  // ---------------- two players online, far apart ----------------
  const P1 = await page(ctx, 'P1', '&net=local', errs), P2 = await page(ctx, 'P2', '&net=local', errs);
  await P2.evaluate(() => { window.__map.S.name = 'Lawrence'; });
  await setup(P1, 'dodge_charger_srt_hellcat_widebody_2020', -6000, -1350 + 7, -Math.PI / 2);
  await setup(P2, 'chevrolet_camaro_ss_2016', 2000, 300, 0);
  for (const p of [P1, P2]) await p.evaluate(() => { window.requestAnimationFrame = () => 0; window.__map.S.cash = 50000; window.__map.S.bank = 200000; });
  for (const p of [P1, P2]) await p.evaluate(() => window.__net.netJoin('eastgate'));
  for (const p of [P1, P2]) await p.waitForFunction(() => window.__net.NET.status === 'on', null, { timeout: 120000, polling: 500 });
  for (const p of [P1, P2]) await p.evaluate(() => setInterval(() => { for (const q of window.__net.NET.peers.values()) q.seen = Math.max(q.seen, performance.now() / 1000 - 1); }, 200));
  for (const p of [P1, P2]) await p.evaluate(() => { window.__t.steer = false; window.__t.gas = 0; window.__t.hold = null; });
  const pump = async n => { for (let i = 0; i < n; i++) { for (const p of [P1, P2]) await p.evaluate(() => { window.__t.run(6, 1 / 60); window.__net.netTick(0.1); }); await P1.waitForTimeout(30); } };
  await pump(30);
  for (let i = 0; i < 30 && !(await P1.evaluate(() => window.__net.NET.peers.size)); i++) await pump(1);
  const money = p => p.evaluate(() => ({ cash: Math.round(window.__map.S.cash), bank: Math.round(window.__map.S.bank), total: Math.round(window.__map.S.cash + window.__map.S.bank) }));
  const waitFor = async (p, cond, n = 60) => { for (let i = 0; i < n; i++) { if (await p.evaluate(cond)) return true; await pump(1); } return false; };
  const race = async (rt1, rt2) => {
    for (const [p, rtd] of [[P1, rt1], [P2, rt2]]) await p.evaluate(rtd => { const RR = window.__yb.rr, t = window.__t; t.hold = null; t.gas = 0; t.goT = null; t.steer = true;
      t.each = () => { const T = RR.race; if (!T) return; if (!T.pace && (T.ph === 'pace' || T.ph === 'honk') && T.v0 > 0.5) t.hold = T.v0; else t.hold = null;
        if (T.go != null && t.goT == null) t.goT = T.t; if (t.goT != null && T.t - t.goT > rtd && T.ph === 'run') t.gas = 1; if (T.ph === 'done') t.gas = 0; }; }, rtd);
    let done = false;
    for (let i = 0; i < 500 && !done; i++) { await pump(1); done = (await P1.evaluate(() => !window.__yb.rr.race || window.__yb.rr.race.shown)) && (await P2.evaluate(() => !window.__yb.rr.race || window.__yb.rr.race.shown)); }
    for (const p of [P1, P2]) await p.evaluate(() => { window.__t.each = null; window.__t.gas = 0; });
    return done;
  };
  const peerId = p => p.evaluate(() => window.__net.NET.id);

  if (ONLY.includes('dig')) {
    // P1 invites P2 (13 km away) to a dig on the Yello Belly strip, $25,000; P2 counters at $40,000; P1 takes it
    const before = [await money(P1), await money(P2)], id2 = await peerId(P2);
    await P1.evaluate(id => window.__yb.rr.invite(id), id2);
    await P1.evaluate(() => { const box = document.querySelector('#rrinv .box'), c = s => box.querySelector(s).click();
      c('[data-type="dig"]'); c('[data-d="402.34"]'); c('[data-where="trk:yb"]');
      const w = document.querySelector('#rrinv [data-in="w"]'); w.value = '25000'; w.dispatchEvent(new Event('input')); w.dispatchEvent(new Event('change')); });
    const form = await P1.evaluate(() => document.querySelector('#rrinv .box').innerText.replace(/\s+/g, ' ').slice(0, 900));
    log({ test: 'invite form', form });
    if (OUT) await shot(P1, 'inv-01-form');
    await P1.evaluate(() => document.querySelector('#rrinv .send').click());
    const got = await waitFor(P2, () => !!(window.__yb.rr.neg && window.__yb.rr.ask));
    log({ test: 'P2 got the invite', got, card: got && await P2.evaluate(() => window.__yb.rr.q('ask').innerText.replace(/\s+/g, ' ')) });
    if (OUT && got) await shot(P2, 'inv-02-got-invite');
    await P2.evaluate(() => { const el = window.__yb.rr.q('ask'); el.querySelector('.c').click(); el.querySelector('.cw').value = '40000'; el.querySelector('.y').click(); });
    const ctr = await waitFor(P1, () => !!(window.__yb.rr.neg && window.__yb.rr.ask));
    log({ test: 'P1 got the counter', ctr, card: ctr && await P1.evaluate(() => window.__yb.rr.q('ask').innerText.replace(/\s+/g, ' ')) });
    if (OUT && ctr) await shot(P1, 'inv-03-counter');
    await P1.evaluate(() => window.__yb.rr.q('ask').querySelector('.y').click());
    const on = await waitFor(P1, () => !!window.__yb.rr.race, 80);
    const st = async p => p.evaluate(() => { const T = window.__yb.rr.race, d = window.__map.drvS(); return T && { road: T.C.name, kind: T.C.kind, v0: T.v0, dist: Math.round(T.dist), w: T.wager, host: T.host, lat: +window.__yb.rr.lat(T.C, d.x, d.z).toFixed(2), x: Math.round(d.x), z: Math.round(d.z), cash: Math.round(window.__map.S.cash), bank: Math.round(window.__map.S.bank) }; });
    log({ test: 'both on the line', on, P1: await st(P1), P2: await st(P2) });
    await pump(4);
    if (OUT) await shot(P2, 'inv-04-on-the-line');
    const done = await race(0.2, 0.45);
    const r1 = await raceState(P1), r2 = await raceState(P2), after = [await money(P1), await money(P2)];
    log({ test: 'dig result P1', done, res: r1.res, me: r1.me, them: r1.them });
    log({ test: 'dig result P2', done, res: r2.res, me: r2.me, them: r2.them });
    log({ test: 'money (P1 should be +40k and P2 -40k, or the other way)', before, after, d1: after[0].total - before[0].total, d2: after[1].total - before[1].total });
    if (OUT) { await shot(P1, 'inv-05-slip-p1'); await shot(P2, 'inv-06-slip-p2'); }
    for (const p of [P1, P2]) await p.evaluate(() => window.__yb.rr.close('drive'));
    await pump(5);
  }
  if (ONLY.includes('roll')) {
    // P2 invites P1 to a 60 roll, custom 2,000 ft, near P2, $10,000; P1 says run it right away. Then a call-off gives the bets back.
    const before = [await money(P1), await money(P2)], id1 = await peerId(P1);
    await P2.evaluate(id => window.__yb.rr.invite(id), id1);
    await P2.evaluate(() => { const box = () => document.querySelector('#rrinv .box'), c = s => box().querySelector(s).click();
      c('[data-type="roll"]'); c('[data-v="60"]'); c('[data-d="cu"]');
      const cu = document.querySelector('#rrinv [data-in="cu"]'); cu.value = '2000'; cu.dispatchEvent(new Event('input')); cu.dispatchEvent(new Event('change'));
      c('[data-unit="ft"]'); c('[data-where="near"]');
      const w = document.querySelector('#rrinv [data-in="w"]'); w.value = '10000'; w.dispatchEvent(new Event('input')); w.dispatchEvent(new Event('change')); });
    log({ test: 'roll invite form', form: await P2.evaluate(() => document.querySelector('#rrinv .box').innerText.replace(/\s+/g, ' ').slice(0, 900)) });
    if (OUT) await shot(P2, 'inv-07-roll-form');
    await P2.evaluate(() => document.querySelector('#rrinv .send').click());
    const got = await waitFor(P1, () => !!(window.__yb.rr.neg && window.__yb.rr.ask));
    log({ test: 'P1 got the roll invite', got, card: got && await P1.evaluate(() => window.__yb.rr.q('ask').innerText.replace(/\s+/g, ' ')) });
    await P1.evaluate(() => window.__yb.rr.q('ask').querySelector('.y').click());
    const on = await waitFor(P2, () => !!window.__yb.rr.race, 80);
    log({ test: 'roll: both racing', on, p1: await P1.evaluate(() => { const T = window.__yb.rr.race; return T && [T.C.name, Math.round(T.dist), Math.round(T.v0 * 2.237), T.wager]; }) });
    const done = await race(0.25, 0.25);
    const r1 = await raceState(P1), r2 = await raceState(P2), after = [await money(P1), await money(P2)];
    log({ test: 'roll result P1', done, res: r1.res, me: r1.me, them: r1.them, log: r1.log });
    log({ test: 'roll result P2', done, res: r2.res, me: r2.me, them: r2.them });
    log({ test: 'roll money', d1: after[0].total - before[0].total, d2: after[1].total - before[1].total });
    if (OUT) await shot(P1, 'inv-08-roll-slip');
    // call-off before the go: rematch, then P1 calls it off on the line -> both get their bets back
    const b2 = [await money(P1), await money(P2)];
    await P1.evaluate(() => { const b = window.__yb.rr.q('slip').querySelector('[data-a="rematch"]'); if (b) b.click(); });
    const got2 = await waitFor(P2, () => !!(window.__yb.rr.neg && window.__yb.rr.ask));
    if (got2) await P2.evaluate(() => window.__yb.rr.q('ask').querySelector('.y').click());
    const on2 = await waitFor(P1, () => !!window.__yb.rr.race, 80);
    const held = [await money(P1), await money(P2)];
    await P1.evaluate(() => window.__yb.rr.close('off')); await pump(6);
    const a2 = [await money(P1), await money(P2)];
    log({ test: 'rematch then call-off: bets held, then back', got2, on2, held: [held[0].total - b2[0].total, held[1].total - b2[1].total], back: [a2[0].total - b2[0].total, a2[1].total - b2[1].total], p2race: await P2.evaluate(() => !!window.__yb.rr.race) });
  }
  log({ ERR: errs.slice(0, 12) });
  await b.close();
})().catch(e => { console.error(e); console.log(JSON.stringify({ ERRS: (global.__errs || []).slice(-12) })); process.exit(1); });
