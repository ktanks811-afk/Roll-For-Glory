// City calls test (headless Chromium + Playwright; the repo is served by Playwright's router).
// S = folder with npm/node_modules/three (three@0.128.0). OUT = folder for screenshots. ONLY = 1..5 to run some stages.
// 1. the schedule: calls come out the same every time (same on every screen), the beats are busy, calls go late or get dropped
// 2. every kind of call on screen: traffic stop, crash, robbery, fight, shooting, disturbance (on scene, and before cops get there)
// 3. a unit driving in to a call with lights and siren
// 4. your 911 call waits in line behind the city's calls
// 5. a cop working a scene sees you pull a gun and comes off the call for you
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..'), ONLY = process.env.ONLY || '';
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
const log = o => console.log(JSON.stringify(o));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const save = { v: 1, made: true, name: 'Kimari', cash: 4200, bank: 9000, car: { id: 'chevrolet_caprice_classic_box_chevy_1986', color: '#b3121b', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 1, oil: 100, mods: {} }, at: { x: 600, z: -150, yaw: 0, foot: true, fx: 600, fz: -150, fyaw: 0 } };
  await ctx.addInitScript(s => { if (!localStorage.getItem('mw3d.save.v1')) localStorage.setItem('mw3d.save.v1', s); }, JSON.stringify(save));
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && /city calls|police|hood|scenes/i.test(m.text())) errs.push('console ' + m.text().slice(0, 400)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),rpc:async()=>({data:null})});', contentType: 'application/javascript' }));
  await pg.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => {
    const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' });
  });
  await pg.goto('http://game.test/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a);
  const shot = async n => { await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(OUT, n + '.png'), timeout: 240000 }); log({ shot: n }); };
  const snap = async (n, f, a) => { const u = await ev(f, a); if (u) { fs.writeFileSync(path.join(OUT, n + '.jpg'), Buffer.from(u.split(',')[1], 'base64')); log({ snap: n }); } };
  // the game's own loop keeps running too; this pushes extra frames of the hood, police and the calls
  const pump = (n, dt = 0.05) => ev(([n, dt]) => { for (let i = 0; i < n; i++) { window.__jail.jPump(1, dt); window.__citycalls.ccStep(dt); } }, [n, dt]);
  await ev(() => { try { window.__map.closeCreator(); } catch (e) {} });
  await pg.waitForFunction(() => { window.__hood.tick(0.05); return window.__hood.HOOD.ready; }, null, { timeout: 120000, polling: 500 });
  if (!(await ev(() => !!window.__citycalls))) { log({ FAIL: 'no __citycalls' }); process.exit(1); }
  let fails = 0; const check = (ok, what, o) => { if (!ok) fails++; log(Object.assign({ [ok ? 'PASS' : 'FAIL']: what }, o || {})); };
  const quiet = () => ev(() => { const C = window.__cops; for (const u of C.COP.units.slice()) C.copKill(u); C.COP.phase = 'none'; C.COP.calls = []; C.COP.call = null; C.COP.noPop = true; window.__map.S.heat = 0; });
  const goTo = (x, z) => ev(([x, z]) => { const f = window.__map.foot; f.x = x; f.z = z; f.holder.position.set(x, 0, z); }, [x, z]);

  if (!ONLY || ONLY.includes('1')) {
    const r = await ev(() => {
      const X = window.__citycalls, T = Date.now() / 1000, s = Math.floor(T / 900);
      const pack = () => { const out = []; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const B = X.ccBeat(i, j); for (const c of X.ccShift(B, s)) out.push([c.id, c.kind, Math.round(c.start), Math.round(c.assign), Math.round(c.arrive), Math.round(c.end), c.node, !!c.drop]); } return out; };
      const a = pack(); X.CC.beats.clear(); const bb = pack();
      let busy = 0, n = 0, late = [], drops = 0, calls = 0, kinds = {};
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const B = X.ccBeat(i, j); if (!B.rate) continue; for (let t = s * 900; t < (s + 1) * 900; t += 60) { busy += X.ccFree(B, t).filter(f => f > t).length / 4; n++; } for (const c of X.ccShift(B, s)) { calls++; kinds[c.kind] = (kinds[c.kind] || 0) + 1; if (c.drop) drops++; else if (c.kind !== 'stop') late.push(c.assign - c.start + c.travel); } }
      late.sort((p, q) => p - q);
      return { same: JSON.stringify(a) === JSON.stringify(bb), calls, kinds, drops, busyPct: Math.round(100 * busy / Math.max(1, n)), lateMedian: Math.round(late[late.length >> 1] || 0), lateMax: Math.round(late[late.length - 1] || 0), sample: a.slice(0, 4) };
    });
    check(r.same, '1a. same calls every time (every screen works them out the same)');
    check(r.calls > 40, '1b. crime all over town', { calls: r.calls, kinds: r.kinds });
    check(r.busyPct >= 60, '1c. officers mostly busy', { busyPct: r.busyPct });
    check(r.lateMedian >= 60, '1d. calls answered late', { lateMedianSec: r.lateMedian, lateMax: r.lateMax, dropped: r.drops });
    log({ sample: r.sample });
  }

  // a call of each kind right next to you, on scene, then a picture of it
  const scenePic = async (name, kind, o, cam) => {
    const c = await ev(([kind, o]) => { const X = window.__citycalls; X.clear(); const f = window.__map.foot; const c = X.force(kind, f.x, f.z, o); return c && { id: c.id, node: c.node }; }, [kind, o]);
    if (!c) { log({ skip: name }); return null; }
    await pump(40, 0.05); await pg.waitForTimeout(1500); await pump(30, 0.05);
    const st = await ev(id => {
      const X = window.__citycalls, L = X.CC.live.get(id); if (!L) return null; const s = L.P.spots, p = s.v || s.f || s.win || s.d1 || s.clerk || s.door || [L.P.E.ax, L.P.E.az];
      return { ph: L.ph, p: [Math.round(p[0]), Math.round(p[1])], E: [L.P.E.rx, L.P.E.rz, L.P.E.dx, L.P.E.dz], hw: L.P.hw, units: L.units.map(u => [u.kind, u.g.visible, u.lights, Math.round(u.x), Math.round(u.z), !!u.model]), cars: L.cars.map(o => [o.g.visible, !!o.model]), ppl: Object.entries(L.ppl).map(([r, m]) => r + ':' + m.act), tape: !!L.tape };
    }, c.id);
    log(Object.assign({ scene: name }, st || { missing: true }));
    if (st) await snap(name, ([p, E, cam]) => window.__map.snap(p[0] - E[0] * cam[0] + E[2] * cam[2], cam[1], p[1] - E[1] * cam[0] + E[3] * cam[2], p[0], 0.6, p[1]), [st.p, st.E, cam || [16, 14, 18]]);
    delete (st || {}).E;
    return st;
  };
  if (!ONLY || ONLY.includes('2')) {
    await quiet(); await goTo(600, -150);
    const near = await ev(() => { const X = window.__citycalls, f = window.__map.foot; return X.ccCands(f.x, f.z, Date.now() / 1000).slice(0, 6).map(q => [q.c.kind, q.ph, Math.round(q.d)]); });
    log({ test: '2. calls near you right now', near });
    const s1 = await scenePic('cc-01-traffic-stop', 'stop', { ago: 20, dur: 200 }, [10, 6, 12]);
    check(s1 && s1.ph === 'on' && s1.units[0][1] && s1.units[0][2] && s1.ppl.some(p => /^o0/.test(p)), '2a. traffic stop: unit lit up behind the car, officer at the window', s1);
    const s2 = await scenePic('cc-02-crash-on-scene', 'crash', { ago: 70, travel: 40, dur: 200 }, [14, 9, 14]);
    check(s2 && s2.ph === 'on' && s2.cars.length === 2 && s2.ppl.length >= 3, '2b. crash: two wrecked cars, drivers, an officer', s2);
    const s3 = await scenePic('cc-03-crash-no-cops-yet', 'crash', { ago: 30, wait: 120, travel: 40 }, [14, 9, 14]);
    check(s3 && s3.ph === 'pend' && s3.units.every(u => !u[1]), '2c. crash nobody is on yet (units tied up)', s3);
    const hc = await ev(() => { const X = window.__citycalls; let h = 1; while (!(X.ccR(h, 11) < 0.6)) h++; return h; });
    const s4 = await scenePic('cc-04-robbery-cuffed', 'rob', { ago: 62, travel: 40, dur: 200, h: hc }, [10, 6, 12]);
    check(s4 && s4.ppl.some(p => /^perp:(cuff|hands)/.test(p)) && s4.units.length === 2, '2h. robbery: the one they caught is in cuffs by the car', s4);
    const s5 = await scenePic('cc-05-fight-going', 'fight', { ago: 10, wait: 120 }, [9, 5, 10]);
    check(s5 && s5.ppl.filter(p => /fight/.test(p)).length === 2, '2d. a fight going on, nobody there to stop it yet', s5);
    const s6 = await scenePic('cc-06-fight-cuffed-curb', 'fight', { ago: 75, travel: 40, dur: 200 }, [9, 5, 10]);
    check(s6 && s6.ppl.filter(p => /sit/.test(p)).length === 2, '2e. fight: both cuffed on the curb', s6);
    const s7 = await scenePic('cc-07-shooting-tape', 'shoot', { ago: 140, travel: 40, dur: 300 }, [20, 16, 22]);
    check(s7 && s7.tape && s7.units.filter(u => u[1] && u[2]).length === 3, '2f. shooting: three units, tape and markers', s7);
    const s8 = await scenePic('cc-08-disturbance', 'dist', { ago: 60, travel: 40, dur: 200 }, [12, 7, 14]);
    check(s8 && s8.ph === 'on' && s8.units[0][1], '2g. disturbance at a house', s8);
    await shot('cc-09-screen');
  }

  if (!ONLY || ONLY.includes('3')) {
    await quiet();
    const c = await ev(() => { const X = window.__citycalls; X.clear(); const f = window.__map.foot; const c = X.force('crash', f.x, f.z, { ago: 15, travel: 45 }); return c.id; });
    await pump(30, 0.05); await pg.waitForTimeout(1000); await pump(10, 0.05);
    const u = await ev(id => { const L = window.__citycalls.CC.live.get(id); const u = L && L.units[0]; return u && { ph: L.ph, vis: u.g.visible, lights: u.lights, siren: u.siren, x: Math.round(u.x), z: Math.round(u.z), yaw: u.yaw, to: [Math.round(L.P.units[0].x), Math.round(L.P.units[0].z)] }; }, c);
    check(u && u.ph === 'enr' && u.vis && u.lights && u.siren, '3. a unit on its way: lights and siren, on the roads', u);
    if (u) await snap('cc-10-unit-en-route', u => window.__map.snap(u.x + Math.sin(u.yaw) * 14 + 4, 4, u.z + Math.cos(u.yaw) * 14 + 4, u.x, 0.8, u.z), u);
  }

  if (!ONLY || ONLY.includes('4')) {
    await quiet(); await ev(() => window.__citycalls.clear());
    const r = await ev(() => {
      const C = window.__cops, X = window.__citycalls, f = window.__map.foot, B = X.ccBeatAt(f.x, f.z), now = performance.now() / 1000;
      // everybody on this side of town is busy for the next few minutes
      const T = Date.now() / 1000; X.CC.res = []; for (let i = 0; i < 4; i++) X.CC.res.push({ b: B.k, until: T + 150 + i * 20 });
      const c = C.copReport(f.x, f.z, 'a person with a gun out', { units: 1 });
      return { delay: Math.round(c.at - now), busy: X.ccBusy(f.x, f.z) };
    });
    check(r.delay >= 150, '4. your 911 call holds behind the city\'s calls', r);
  }

  if (!ONLY || ONLY.includes('5')) {
    await quiet();
    const c = await ev(() => { const X = window.__citycalls; X.clear(); const f = window.__map.foot; return X.force('fight', f.x, f.z, { ago: 90, travel: 40, dur: 300 }).id; });
    await pump(40, 0.05); await pg.waitForTimeout(800); await pump(20, 0.05);
    const r = await ev(id => {
      const X = window.__citycalls, C = window.__cops, L = X.CC.live.get(id); if (!L) return null; const u = L.units[0], f = window.__map.foot;
      f.x = u.x + 9; f.z = u.z + 3; f.holder.position.set(f.x, 0, f.z);
      const e = C.copEyes(50); return { got: !!e, taken: L.units.some(q => q.taken), inCop: e ? C.COP.units.includes(e.u) : false, nid: e && e.u.nid };
    }, c);
    check(r && r.got && r.taken && r.inCop && /^c:/.test(r.nid), '5. a scene cop sees you and comes off the call', r);
  }

  check(!errs.length, 'no errors', { errs: errs.slice(0, 6) });
  log({ done: true, fails });
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
