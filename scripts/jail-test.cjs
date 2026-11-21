// County jail test (headless Chromium + Playwright, no server: the repo is served by Playwright's router).
// S = folder with npm/node_modules/three (three@0.128.0). OUT = folder for screenshots.
// 1. a chase you get away from -> a long search -> a warrant; a unit that spots you comes back for you
// 2. busted: hands up, cuffs, the walk to the unit, the back seat, the ride downtown, booking (5 steps + mugshot)
// 3. the cell block: the clock (1 day = 1 real minute), trusty good time, bondsman, release with your property back
// 4. NPCs: an everyday pickup and the shooters at a street war get cuffed and taken in
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
  pg.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && /jail|police|hood/i.test(m.text())) errs.push('console ' + m.text().slice(0, 400)); });
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
  const shot = async n => { await pg.waitForTimeout(500); await pg.screenshot({ path: path.join(OUT, n + '.png') }); log({ shot: n }); };
  const pump = (n, dt = 0.05) => ev(([n, dt]) => window.__jail.jPump(n, dt), [n, dt]);
  await ev(() => { try { window.__map.closeCreator(); } catch (e) {} });
  await pg.waitForFunction(() => { window.__hood.tick(0.05); return window.__hood.HOOD.ready; }, null, { timeout: 120000, polling: 500 });
  const jp = await ev(() => { const p = window.__jail.jailPlace(); return p && { x: p.x, z: p.z, face: p.face }; });
  log({ test: 'jail place', jp });
  const state = () => ev(() => { const J = window.__jail, st = J.JL.st, C = window.__cops.COP, S = window.__map.S; return { ph: st && st.ph, t: st && +st.t.toFixed(1), ch: st && st.ch, cop: C.phase, unseen: +(C.unseenT || 0).toFixed(1), heat: S.heat, warrant: S.jail && S.jail.warrant && S.jail.warrant.ch, inJail: !!(S.jail && S.jail.in), stage: S.jail && S.jail.stage, foot: [Math.round(window.__map.foot.x), Math.round(window.__map.foot.z)] }; });

  // put you on foot somewhere east of downtown, near roads
  const startAt = async (x, z) => ev(([x, z]) => { const M = window.__map; M.S.heat = 0; M.foot.on ? 0 : M.getOut(); M.foot.x = x; M.foot.z = z; M.foot.holder.position.set(x, 0, z); }, [x, z]);

  if (!ONLY || ONLY.includes('1')) {
    // 1. chase + lost + warrant
    await startAt(600, -150);
    await ev(() => { const C = window.__cops; C.COP.noPop = true; for (const u of C.COP.units.slice()) C.copKill(u); const [x, z] = [window.__map.foot.x + 160, window.__map.foot.z]; const u = C.copUnit('charger', x, z, 0, 'patrol'); C.copOnRoad(u, x, z); window.__map.S.heat = 2; C.copChase('Suspect fled a traffic stop.'); });
    await pump(4);
    log(Object.assign({ test: '1a. chase started' }, await state()));
    // teleport far away: they lose you, search, then put out a warrant
    await ev(() => { const M = window.__map; M.foot.x += 900; M.foot.z += 300; });
    for (let i = 0; i < 40; i++) { await pump(40); const s = await state(); if (s.cop !== 'chase' && s.cop !== 'search') break; }
    log(Object.assign({ test: '1b. lost them -> warrant' }, await state(), { searchFor: await ev(() => window.__jail.jlSearchFor()) }));
    await ev(() => { const C = window.__cops; for (const u of C.COP.units.slice()) C.copKill(u); C.COP.phase = 'none'; });
    // a unit rolls up and sees you: chase again on the warrant
    await ev(() => { const C = window.__cops, f = window.__map.foot, u = C.copUnit('tahoe', f.x + 15, f.z + 4, 0, 'patrol'); u.sp = 0; });
    await pump(16);
    log(Object.assign({ test: '1c. spotted with a warrant' }, await state()));
  }

  if (!ONLY || ONLY.includes('2')) {
    // 2. the arrest
    await ev(() => { const C = window.__cops; for (const u of C.COP.units.slice()) C.copKill(u); C.COP.phase = 'none'; C.COP.noPop = true; });
    await startAt(jp.x + 420, jp.z + 60);
    await ev(() => { const C = window.__cops, f = window.__map.foot, u = C.copUnit('charger', f.x + 9, f.z + 2, 1.2, 'chase'); u.lights = true; window.__jail.JL.inc.add('evade'); window.__jail.jlArrest('busted'); });
    await pump(14); await shot('jail-01-hands-up');
    log({ dbg: await ev(() => { const M = window.__map, ME = M.ME, c = M.cam(); return { vis: ME && ME.wrap.visible, par: ME && ME.wrap.parent && ME.wrap.parent.uuid === M.foot.holder.uuid, hv: M.foot.holder.visible, hp: M.foot.holder.position.toArray().map(Math.round), cam: c.position.toArray().map(v => +v.toFixed(1)), foot: [M.foot.x, M.foot.z].map(Math.round), fcam: M.foot.cam.toArray().map(v=>+v.toFixed(1)) }; }) });
    const snapMe = async n => { const u = await ev(() => { const f = window.__map.foot, y = f.yaw + 0.7; return window.__map.snap(f.x + Math.sin(y) * 3.6, 1.7, f.z + Math.cos(y) * 3.6, f.x, 1.0, f.z); }); fs.writeFileSync(path.join(OUT, n + '.jpg'), Buffer.from(u.split(',')[1], 'base64')); };
    await snapMe('jail-01b-hands-snap');
    for (let i = 0; i < 30; i++) { await pump(10); const s = await state(); if (s.ph === 'cuff') break; }
    await pump(16); log(Object.assign({ test: '2a. cuffing' }, await state())); await shot('jail-02-cuffed'); await snapMe('jail-02b-cuffed-snap');
    for (let i = 0; i < 40; i++) { await pump(10); const s = await state(); if (s.ph === 'door' || s.ph === 'in') break; }
    log(Object.assign({ test: '2b. at the door' }, await state())); await shot('jail-03-to-the-car'); await snapMe('jail-03b-door-snap');
    for (let i = 0; i < 40; i++) { await pump(10); const s = await state(); if (s.ph === 'ride') break; }
    log(Object.assign({ test: '2c. in the back seat' }, await state()));
    // look at the back seat from outside
    await ev(() => { const u = window.__jail.JL.st.u, c = window.__map.cam(); window.__jail.JL.camHold = 1; });
    const seat = await ev(() => { const u = window.__jail.JL.st.u, s = Math.sin(u.yaw), c = Math.cos(u.yaw); return window.__map.snap(u.x + c * 4.2 + s * 1.2, 1.6, u.z - s * 4.2 + c * 1.2, u.x, 0.9, u.z); });
    fs.writeFileSync(path.join(OUT, 'jail-04-back-seat.jpg'), Buffer.from(seat.split(',')[1], 'base64'));
    for (let i = 0; i < 6; i++) await pump(20);
    log(Object.assign({ test: '2d. riding' }, await state(), { dist: await ev(() => { const st = window.__jail.JL.st; return st && Math.round(Math.hypot(st.u.x - st.gx, st.u.z - st.gz)); }) }));
    await shot('jail-05-ride');
    for (let i = 0; i < 120; i++) { await pump(20); const s = await state(); if (s.inJail || !s.ph) break; }
    await pg.waitForTimeout(1600);
    log(Object.assign({ test: '2e. booked' }, await state()));
    await shot('jail-06-booking-property');
    await ev(() => window.__jail.jBookNext()); await ev(() => window.__jail.jBookNext()); await shot('jail-07-prints');
    for (let i = 0; i < 4; i++) await ev(() => window.__jail.jBookNext());
    await ev(() => window.__jail.jBookNext()); await shot('jail-08-mugshot');
    await ev(() => window.__jail.jBookNext()); await ev(() => window.__jail.jBookNext()); await shot('jail-09-magistrate');
    log({ test: '2f. booking', j: await ev(() => { const j = window.__map.S.jail; return { n: j.n, ch: j.ch, days: j.days, bond: window.__jail.jBond(j.ch), prop: j.prop && { cash: j.prop.cash, guns: j.prop.guns.length }, mug: !!j.mug, orange: j.orange }; }) });
    // 3. serve: sit it out
    await ev(() => window.__jail.jBookNext());
    await pg.waitForTimeout(900);
    log({ test: '3a. cell block', hud: await ev(() => document.getElementById('jlhud').textContent), stations: await ev(() => window.__map.IN.stations.map(s => s.name)), left: await ev(() => Math.round(window.__jail.jLeft() / 1000)) });
    await shot('jail-10-dayroom');
    await ev(() => { const M = window.__map; M.IN.pos.set(1, 0, -9.5); });
    await pg.waitForTimeout(700); await shot('jail-11-cell');
    await ev(() => window.__jail.jMop()); for (let i = 0; i < 6; i++) await ev(() => document.querySelector('#jlbook [data-go]').click());
    log({ test: '3b. trusty', left: await ev(() => Math.round(window.__jail.jLeft() / 1000)), good: await ev(() => window.__map.S.jail.good) });
    log({ test: '3c. leave blocked', left: await ev(() => { window.__map.leave(); return window.__map.IN.place && window.__map.IN.place.type; }) });
    // time served: release with your property
    await ev(() => { window.__map.S.jail.until = Date.now() - 1000; });
    const before = await ev(() => window.__map.S.cash);
    await ev(() => { const m = window.__jail.jHud(); window.__map.openMenu(() => window.__map.MENUS.__jr ? null : null); });
    await ev(() => { const J = window.__jail; J.jRelease(); });
    await pg.waitForTimeout(800);
    log({ test: '3d. released', inside: await ev(() => !!(window.__map.IN.place && document.body.classList.contains('indoors'))), cash: [before, await ev(() => window.__map.S.cash)], inJail: await ev(() => window.__map.S.jail.in), rec: await ev(() => window.__map.S.jail.rec.map(r => [r.n, r.days, r.out])) });
    await shot('jail-12-released');
  }

  if (!ONLY || ONLY.includes('4')) {
    // 4. NPC pickups
    const r = await ev(() => {
      const C = window.__cops, H = window.__hood, f = window.__map.foot; for (const u of C.COP.units.slice()) C.copKill(u); C.COP.phase = 'none';
      const c = H.HOOD.byId.get('6,3').corner; f.x = c.x + 18; f.z = c.z + 14; window.__map.S.heat = 0;
      for (let i = 0; i < 40; i++) { H.tick(0.05); }
      for (const g of ['six_block', 'riverside', 'hemphill', 'everman']) H.prime(g); H.spawn(); H.spawn(); H.wS().on = 0;
      const all = [...H.HOOD.byEnt.values()];
      const e = H.HOOD.byId.get('6,3').crew.find(e => !e.gone && !e.down && !e.inCar) || all.find(e => !e.gone && !e.down && !e.inCar);
      if (!e) return { ok: false, why: 'no ent', n: all.length, ready: H.HOOD.ready };
      const u = C.copUnit('charger', c.x + 40, c.z, 0, 'patrol'); C.copOnRoad(u, c.x + 40, c.z);
      return { ok: window.__jail.jNpcStart(e, u, ['warrant', 'pom'], 'stop'), name: e && e.name };
    });
    log({ test: '4a. NPC pickup started', r });
    let pic = 0;
    for (let i = 0; i < 80; i++) {
      await pump(10);
      const s = await ev(() => { const e = window.__jail.JL.npc[0]; return e ? { ph: e.jl.ph, mode: e.mode, x: Math.round(e.x), z: Math.round(e.z) } : null; });
      if (s && s.ph === 'cuff' && pic === 0) { pic = 1; await pump(14); const u = await ev(() => { const e = window.__jail.JL.npc[0]; return window.__map.snap(e.x + 3.5, 1.9, e.z + 3.5, e.x, 1.1, e.z); }); fs.writeFileSync(path.join(OUT, 'jail-13-npc-cuffed.jpg'), Buffer.from(u.split(',')[1], 'base64')); }
      if (!s) break;
    }
    log({ test: '4b. NPC booked', npcs: await ev(() => window.__map.S.jail.npcs.slice(0, 3)), news: await ev(() => window.__hood.wS().log.slice(0, 2).map(n => n.text)) });
  }
  log({ ERR: errs.slice(0, 12) });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
