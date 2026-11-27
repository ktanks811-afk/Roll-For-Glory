// Shooting scenes test (headless Chromium + Playwright; the repo is served by Playwright's router).
// S = folder with npm/node_modules/three (three@0.128.0). OUT = folder for screenshots. ONLY = 1..5 to run some stages.
// 1. a walk-up shootout between two sets: the police pull up and every shooter on both sides is held, cuffed and taken in
//    (one unit per person, more units roll in, the runner gets chased down on foot), tape + evidence markers go up
// 2. a drive-by: the car gets a felony stop, the shooter and the driver both come out and get cuffed
// 3. you were shooting too and you run: that's a pursuit
// 4. you were shooting too and you stay: you get arrested along with everybody, and they're booked with you
// 5. the sets and the follow-up: lookouts yell 12, payback gets queued, a jailed id stays gone, detectives, recruits
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
  pg.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && /jail|police|hood|scenes/i.test(m.text())) errs.push('console ' + m.text().slice(0, 400)); });
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
  const snap = async (n, f) => { const u = await ev(f); if (u) { fs.writeFileSync(path.join(OUT, n + '.jpg'), Buffer.from(u.split(',')[1], 'base64')); log({ snap: n }); } };
  const pump = (n, dt = 0.05) => ev(([n, dt]) => window.__jail.jPump(n, dt), [n, dt]);
  await ev(() => { try { window.__map.closeCreator(); } catch (e) {} });
  await pg.waitForFunction(() => { window.__hood.tick(0.05); return window.__hood.HOOD.ready; }, null, { timeout: 120000, polling: 500 });
  if (!(await ev(() => !!window.__scenes))) { log({ FAIL: 'no __scenes' }); process.exit(1); }

  // a fresh corner with its crew, you standing off to the side, no cops around
  const fresh = (id, dx, dz) => ev(([id, dx, dz]) => {
    const H = window.__hood, C = window.__cops, M = window.__map, f = M.foot, X = window.__scenes.SC;
    for (const u of C.COP.units.slice()) C.copKill(u); C.COP.phase = 'none'; C.COP.calls = []; C.COP.call = null; C.COP.noPop = true; M.S.heat = 0;
    if (H.WAR.ev) H.wEnd(H.WAR.ev, 'far'); X.sc = null; X.inc = []; X.order = null; X.mine = [];
    const b = H.HOOD.byId.get(id), c = b.corner; f.x = c.x + dx; f.z = c.z + dz; f.holder.position.set(f.x, 0, f.z);
    for (let i = 0; i < 30; i++) H.tick(0.05);
    for (const g of ['six_block', 'riverside', 'hemphill', 'everman', 'northside', 'poly', 'como', 'heights']) H.prime(g);
    for (const e of b.crew.slice()) { e.gone = true; H.HOOD.byEnt.delete(e.id); e.g.parent && e.g.parent.remove(e.g); } b.crew = []; b.down = 0;
    for (const k of Object.keys(H.HNET.dead)) delete H.HNET.dead[k]; for (const k of Object.keys(X.jailed)) delete X.jailed[k];
    H.spawn(); H.spawn(); H.hCrew(b); H.wS().on = 0;
    return { crew: b.crew.map(m => m.name), owner: H.hOwner(b), at: [Math.round(c.x), Math.round(c.z)] };
  }, [id, dx, dz]);
  const scState = () => ev(() => {
    const X = window.__scenes.SC, sc = X.sc, C = window.__cops.COP;
    const u2 = u => [u.id, u.mode, u.officer ? 'officer' : '', Math.round(u.x), Math.round(u.z)];
    return { scene: sc && { street: sc.street, t: Math.round(sc.t), sus: sc.sus.map(e => [e.name, e.gone ? 'gone' : e.down ? 'down' : e.jl ? e.jl.ph + (e.jl.run ? '/run' : '') + (e.jl.u ? '@' + e.jl.u.id : '') : e.mode, Math.round(e.x), Math.round(e.z), e.jl && e.jl.u ? +(e.jl.u.npcT || 0).toFixed(1) : '']), cars: sc.cars.map(e => [e.name, e.gone ? 'gone' : e.scStop ? 'stopping' : e.jl ? e.jl.ph : 'driving']), units: [...sc.units].filter(u => !u.gone).map(u2), booked: sc.booked.map(b => b.name + ' ' + b.ch.join('+')), ran: sc.ran },
      cop: C.phase, units: C.units.length, order: !!X.order, tapes: X.tapes.length, incs: X.inc.map(i => [i.id, i.me, i.sh.size, i.locked]) };
  });
  const aerial = () => { const X = window.__scenes.SC, sc = X.sc || (X.tapes[0] && X.tapes[0]); if (!sc) return null; return window.__map.snap(sc.x + 18, 34, sc.z + 22, sc.x, 0, sc.z); };
  const closeOn = () => { const J = window.__jail; const e = J.JL.npc.find(e => e.jl && e.jl.u && e.jl.u.officer && !e.gone) || J.JL.npc.find(e => !e.gone); if (!e) return null; return window.__map.snap(e.x + 5.5, 2.4, e.z + 4.5, e.x, 0.9, e.z); };
  const litUnit = (dx, dz) => ev(([dx, dz]) => { const C = window.__cops, X = window.__scenes.SC, w = window.__hood.WAR.ev, i = X.inc[X.inc.length - 1] || (w && w.ents[0]) || window.__hood.HOOD.byId.get('6,3').corner; const x = i.x + dx, z = i.z + dz, u = C.copUnit('charger', x, z, 0, 'chase'); u.off = true; u.lights = u.siren = true; return [Math.round(u.x), Math.round(u.z)]; }, [dx, dz]);

  if (!ONLY || ONLY.includes('1')) {
    log(Object.assign({ test: '1. corner' }, await fresh('6,3', 0, 42)));
    await ev(() => { const H = window.__hood; H.wStart(0, 0, { b: H.HOOD.byId.get('6,3'), atk: 'hemphill', kind: 'walk' }); });
    for (let i = 0; i < 150; i++) { await pump(8); const s = await ev(() => { const e = window.__hood.WAR.ev; return e && e.shots; }); if (s > 8) break; }
    log(Object.assign({ test: '1a. shooting', war: await ev(() => { const e = window.__hood.WAR.ev; return e && { k: e.kind, ph: e.phase, shots: e.shots, t: e.t, ents: e.ents.map(q => [Math.round(q.x), Math.round(q.z), q.mode, q.down]) }; }), shotOutWrapped: await ev(() => String(window.__scenes.SC.inc.length)) }, await scState()));
    log({ test: '1b. unit rolls up', at: await litUnit(40, 8) });
    for (let i = 0; i < 60; i++) { await pump(6); if (await ev(() => !!window.__scenes.SC.sc)) break; if (i % 10 === 9) log({ dbg: await ev(() => { const X = window.__scenes.SC, i = X.inc[0]; return { err: X.err || 0, tick: X.tick, inc: i && [Math.round(i.x), Math.round(i.z), i.locked], units: window.__cops.COP.units.map(u => [u.mode, u.lights, Math.round(u.x), Math.round(u.z), i && Math.round(Math.hypot(u.x - i.x, u.z - i.z))]) }; }) }); }
    log(Object.assign({ test: '1c. scene locked' }, await scState()));
    await pump(6); await snap('scene-01-hands-up', closeOn);
    let pic = 0;
    for (let i = 0; i < 160; i++) {
      await pump(10); const s = await scState();
      const cuffing = s.scene ? s.scene.sus.filter(q => /cuff|lead|load/.test(q[1])).length : 0, officers = s.scene ? s.scene.units.filter(u => u[2]).length : 0;
      if (pic === 0 && officers >= 2) { pic = 1; log(Object.assign({ test: '1d. several officers out at once', officers }, s)); await snap('scene-02-aerial', aerial); await snap('scene-03-cuffing', closeOn); await shot('scene-04-screen'); }
      if (pic === 1 && cuffing >= 2) { pic = 2; log(Object.assign({ test: '1e. two cuffings at once', cuffing }, s)); await snap('scene-05-two-cuffed', closeOn); await snap('scene-06-aerial-cuffs', aerial); }
      if (!s.scene) break;
      if (i % 20 === 19) log(Object.assign({ test: '1f. progress ' + i }, s));
    }
    log(Object.assign({ test: '1g. scene done' }, await scState(), { news: await ev(() => window.__hood.wS().log.slice(0, 4).map(n => n.text)), roster: await ev(() => ((window.__map.S.jail || {}).npcs || []).slice(0, 8).map(n => n.name + ': ' + n.ch)) }));
    await snap('scene-07-tape-after', aerial);
  }

  if (!ONLY || ONLY.includes('2')) {
    log(Object.assign({ test: '2. corner (drive-by)' }, await fresh('6,3', 0, 48)));
    const ok = await ev(() => { const H = window.__hood; return !!H.wStart(0, 0, { b: H.HOOD.byId.get('6,3'), atk: 'everman', kind: 'slide' }); });
    log({ test: '2a. drive-by started', ok });
    for (let i = 0; i < 6; i++) await pump(8);
    // (the car takes minutes to get there at swiftshader speed: count it as shooting from where it is, like on the way out)
    await ev(() => { const X = window.__scenes, e = window.__hood.WAR.ev.ents[0], f = window.__map.foot; for (let k = 0; k < 6; k++) X.scShot(e, e.x, e.z); });
    log({ test: '2b. shots then the car peels off', war: await ev(() => { const e = window.__hood.WAR.ev; return e && { ph: e.phase, shots: e.shots, car: e.ents.map(q => [Math.round(q.x), Math.round(q.z), q.gone, q.down, q.war && q.war.peel]) }; }), incs: (await scState()).incs, at: await litUnit(-40, 0) });
    for (let i = 0; i < 20; i++) { await pump(6); if (await ev(() => !!window.__scenes.SC.sc)) break; }
    log(Object.assign({ test: '2c. scene' }, await scState()));
    let pic = 0;
    for (let i = 0; i < 160; i++) {
      await pump(10); const s = await scState();
      if (pic === 0 && s.scene && s.scene.cars.some(c => c[1] === 'stopping')) await ev(() => { const e = window.__scenes.SC.sc.cars[0], f = window.__map.foot; f.x = e.x + 22; f.z = e.z + 18; f.holder.position.set(f.x, 0, f.z); });
      const out = await ev(() => { const X = window.__scenes.SC, sc = X.sc; if (!sc) return null; const e = sc.cars[0]; return e && !e.gone && e.parked && !e.inCar ? [e.x, e.z, e.yaw] : null; });
      if (pic === 0 && out) { pic = 1; await pump(30); log(Object.assign({ test: '2d. felony stop: both out' }, await scState())); await snap('scene-08-felony-stop', () => { const e = window.__scenes.SC.sc.cars[0]; return window.__map.snap(e.x + Math.cos(e.yaw) * 9 + Math.sin(e.yaw) * 6, 3.2, e.z - Math.sin(e.yaw) * 9 + Math.cos(e.yaw) * 6, e.parked ? e.parked.x : e.x, 0.8, e.parked ? e.parked.z : e.z); }); }
      if (!s.scene) break;
      if (i % 25 === 24) log(Object.assign({ test: '2e. progress ' + i }, s));
    }
    log(Object.assign({ test: '2f. done' }, await scState(), { news: await ev(() => window.__hood.wS().log.slice(0, 3).map(n => n.text)) }));
  }

  // you shooting it out with a corner
  const meShootout = async (id) => {
    log(Object.assign({ test: 'corner ' + id }, await fresh(id, 0, 22)));
    return ev(() => {
      const H = window.__hood, X = window.__scenes, f = window.__map.foot, b = H.HOOD.byId.get('6,3');
      for (const m of b.crew) { m.mode = 'fight'; m.t = 0; }
      for (let k = 0; k < 5; k++) X.scShot('me', f.x, f.z);
      for (const m of b.crew) X.scShot(m, m.x, m.z);
      return b.crew.length;
    });
  };
  if (!ONLY || ONLY.includes('3')) {
    log({ test: '3. you + a corner shootout', crew: await meShootout('6,3') });
    log({ at: await litUnit(35, 0) });
    for (let i = 0; i < 20; i++) { await pump(6); if (await ev(() => !!window.__scenes.SC.order)) break; }
    log(Object.assign({ test: '3a. told to get down' }, await scState(), { btn: await ev(() => !document.getElementById('scdown').hidden) }));
    await shot('scene-09-get-down');
    // run
    await ev(() => { const f = window.__map.foot; f.x += 22; f.holder.position.set(f.x, 0, f.z); });
    await pump(4);
    log(Object.assign({ test: '3b. ran: pursuit' }, await scState(), { inc: await ev(() => [...window.__jail.JL.inc]), heat: await ev(() => window.__map.S.heat) }));
    await ev(() => { const C = window.__cops; C.copEnd(''); window.__jail.JL.inc.clear(); window.__map.S.heat = 0; const s = window.__map.S; if (s.jail) s.jail.warrant = null; });
    for (let i = 0; i < 30 && await ev(() => !!window.__scenes.SC.sc); i++) await pump(20);
  }

  if (!ONLY || ONLY.includes('4')) {
    log({ test: '4. you + a corner, you stay', crew: await meShootout('6,3') });
    log({ at: await litUnit(35, 0) });
    for (let i = 0; i < 20; i++) { await pump(6); if (await ev(() => !!window.__scenes.SC.order)) break; }
    log(Object.assign({ test: '4a. told to get down' }, await scState()));
    await ev(() => document.getElementById('scdown').click());
    await pump(4);
    log(Object.assign({ test: '4b. hands up' }, await scState(), { me: await ev(() => { const st = window.__jail.JL.st; return st && { ph: st.ph, ch: st.ch }; }) }));
    for (let i = 0; i < 40; i++) { await pump(8); const ph = await ev(() => window.__jail.JL.st && window.__jail.JL.st.ph); if (ph === 'cuff' || ph === 'walk') break; }
    await pump(10);
    await shot('scene-10-you-cuffed'); await snap('scene-11-you-and-them', () => { const f = window.__map.foot; return window.__map.snap(f.x + 9, 4.5, f.z + 11, f.x - 3, 0.8, f.z - 6); });
    await snap('scene-12-aerial-you', aerial);
    log(Object.assign({ test: '4c. you in cuffs, them too' }, await scState()));
    for (let i = 0; i < 60; i++) { await pump(10); const ph = await ev(() => window.__jail.JL.st && window.__jail.JL.st.ph); if (ph === 'ride' || !ph) break; }
    await ev(() => window.__jail.jArrive()); await pg.waitForTimeout(2200);
    log({ test: '4d. booked, with them', jail: await ev(() => { const j = window.__map.S.jail; return { in: j.in, ch: j.ch, npcs: j.npcs.slice(0, 6).map(n => n.name) }; }), scene: (await scState()).scene });
    await shot('scene-13-booked');
    await ev(() => { const J = window.__jail; const j = window.__map.S.jail; for (let i = 0; i < 9 && j.stage === 'book'; i++) J.jBookNext(); });
    await pg.waitForTimeout(1200); await shot('scene-14-dayroom');
    await ev(() => { const j = window.__map.S.jail; j.until = Date.now() - 1000; window.__jail.jRelease(); });
    await pg.waitForTimeout(900);
  }

  if (!ONLY || ONLY.includes('5')) {
    log(Object.assign({ test: '5. corner' }, await fresh('6,3', 0, 30)));
    // lookouts
    const look = await ev(() => { const C = window.__cops, H = window.__hood, b = H.HOOD.byId.get('6,3'), u = C.copUnit('tahoe', b.corner.x + 30, b.corner.z, 0, 'patrol'); u.lights = true; u.sp = 0; window.__scenes.scLookouts(); return b.crew.map(m => m.bub ? 'said something' : '-'); });
    log({ test: '5a. lookout yells 12', look });
    // payback
    const pay = await ev(() => { const H = window.__hood, X = window.__scenes, b = H.HOOD.byId.get('6,3'); const ev = { done: false, quiet: false, def: H.hOwner(b), atk: 'riverside', b, ents: [], d0: 0, phase: 'out' }; b.crew[0].down = true; X.wEnd(ev); b.crew[0].down = false; return X.SC.pay.map(p => [p.atk, p.def, Math.round((p.at - Date.now()) / 1000) + 's']); });
    log({ test: '5b. payback queued', pay });
    // jailed ids stay gone (for the whole server)
    const gone = await ev(() => { const H = window.__hood, X = window.__scenes, b = H.HOOD.byId.get('6,3'), e = b.crew[1]; const id = e.id; X.scBookNow(Object.assign(e, { jl: { ch: ['deadly'], scene: false } })); return { id, gone: window.__scJailed(id), crew: b.crew.length }; });
    log({ test: '5c. jailed id stays gone', gone });
    // detectives
    const inv = await ev(() => { const X = window.__scenes; for (let k = 0; k < 6; k++) X.SC.inv.push({ at: 0, inc: { me: 8, meDrop: 1, drops: 1 }, street: 'Ramey Ave' }); X.scInvStep(); const j = window.__map.S.jail; const w = j && j.warrant; if (j) j.warrant = null; return w && w.ch; });
    log({ test: '5d. detectives', warrant: inv });
    // new faces once the corner cools off
    const rec = await ev(() => { const H = window.__hood, X = window.__scenes, b = H.HOOD.byId.get('6,3'); b.recruitAt = 0; b.down = 0; for (const k of Object.keys(X.SC.jailed)) delete X.SC.jailed[k]; const n0 = b.crew.length; X.scRecruit(); return [n0, b.crew.length, b.crew[b.crew.length - 1].name]; });
    log({ test: '5e. recruit', rec });
  }
  log({ ERR: errs.slice(0, 12), scErr: await ev(() => window.__scenes.SC.err || 0) });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
