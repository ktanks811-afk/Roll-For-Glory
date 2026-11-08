// Street wars tests (headless Chromium + swiftshader, Playwright). Serve the repo on PORT (default 8781);
// S = folder with npm/node_modules/three (three@0.128.0). OUT = folder for screenshots (optional).
// Rival sets on their own: a talk-down, a walk-up shootout and a drive-by with a shooter on the door, the 911 call they
// cause (not pinned on you), and online: a second player sees the same car, shooter and drops.
const { chromium } = require('playwright');
const PORT = process.env.PORT || 8781, S = process.env.S, OUT = process.env.OUT;
const log = o => console.log(JSON.stringify(o));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, r => { const p = r.request().url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  const save = { v: 1, made: true, name: 'Kimari', cash: 25000, bank: 0, car: { id: 'chevrolet_caprice_classic_box_chevy_1986', color: '#b3121b', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 1, oil: 100, mods: {} }, at: { x: 600, z: -150, yaw: 0, foot: true, fx: 600, fz: -150, fyaw: 0 } };
  await ctx.addInitScript(s => { if (!localStorage.getItem('mw3d.save.v1')) localStorage.setItem('mw3d.save.v1', s); }, JSON.stringify(save));
  const errs = [];
  const open = async (tag, q) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push(tag + ' console ' + m.text().slice(0, 300)); }); await p.goto(`http://localhost:${PORT}/index.html${q}`); await p.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 }); return p; };
  const step = () => { try { window.__hood.tick(0.05); window.__cops.step(0.05); } catch (e) { (window.__terr = window.__terr || []).push(e.message + ' ' + (e.stack || '').split('\n')[1]); } if (window.__net && window.__net.NET.status === 'on') window.__net.netTick(0.05); };
  const pumpAll = async (pages, n) => { for (let i = 0; i < n; i++) { for (const p of pages) await p.evaluate(n => { for (let k = 0; k < n; k++) window.__step(); }, 4); await pages[0].waitForTimeout(10); } };
  const setup = async (p, dx) => {
    await p.evaluate(`window.__step = ${step.toString()}`);
    await p.waitForFunction(() => { window.__hood.tick(0.05); return window.__hood.HOOD.ready; }, null, { timeout: 120000, polling: 500 });
    await p.evaluate(dx => { const h = window.__hood, c = h.HOOD.byId.get('6,3').corner, f = window.__guns.foot; f.x = c.x + dx; f.z = c.z + 30; for (const g of ['six_block', 'riverside', 'hemphill', 'everman']) h.prime(g); h.spawn(); h.spawn(); h.wS().on = 0; }, dx);
  };
  const state = p => p.evaluate(() => { const h = window.__hood, ev = h.WAR.ev, b = h.HOOD.byId.get('6,3');
    return { ev: ev && { kind: ev.kind, phase: ev.phase, t: +ev.t.toFixed(1), shots: ev.shots, atk: ev.atk, def: ev.def, called: ev.called, ents: ev.ents.map(e => [e.id.slice(0, 14), Math.round(e.x), Math.round(e.z), e.down ? 'DOWN' : e.gone ? 'gone' : 'up', e.mode, e.inCar ? 'car' : 'foot', +(e.wo || 0).toFixed(2), e.gd]) },
      crew: b.crew.map(m => [m.id, m.down ? 'DOWN' : 'up', m.mode, Math.round(m.hp), m.gd]), news: h.wS().log.slice(0, 3).map(n => n.text), heat: h.wS().heat }; });
  const A = await open('A', '?test=1');
  await setup(A, 0);
  log({ test: 'corner crew at 6,3', crew: (await state(A)).crew });

  // 1. talk-down
  await A.evaluate(() => { const h = window.__hood; h.wStart(0, 0, { b: h.HOOD.byId.get('6,3'), atk: 'riverside', kind: 'talk' }); });
  for (let i = 0; i < 16; i++) { await pumpAll([A], 6); const s = await state(A); if (!s.ev || s.ev.phase === 'out') break; }
  log(Object.assign({ test: '1. talk-down' }, await state(A)));
  for (let i = 0; i < 12 && await A.evaluate(() => !!window.__hood.WAR.ev); i++) await pumpAll([A], 6);
  await A.evaluate(() => { const h = window.__hood; if (h.WAR.ev) h.wEnd(h.WAR.ev, 'far'); });

  // 2. walk-up shootout
  await A.evaluate(() => { const h = window.__hood, b = h.HOOD.byId.get('6,3'); for (const m of b.crew) { m.war = null; if (!m.down) m.mode = 'idle'; } h.wStart(0, 0, { b, atk: 'hemphill', kind: 'walk' }); });
  let shotAt = null;
  for (let i = 0; i < 40; i++) { await pumpAll([A], 6); const s = await state(A); if (s.ev && s.ev.shots > 6 && !shotAt && OUT) { shotAt = i; const u = await A.evaluate(() => { const ev = window.__hood.WAR.ev, c = ev.b.corner, a = ev.ents[0]; return window.__map.snap((c.x + a.x) / 2 + 14, 5, (c.z + a.z) / 2 + 10, (c.x + a.x) / 2, 1, (c.z + a.z) / 2); }); require('fs').writeFileSync(OUT + '/walkup.jpg', Buffer.from(u.split(',')[1], 'base64')); } if (!s.ev || s.ev.phase === 'out') break; }
  log(Object.assign({ test: '2. walk-up shootout' }, await state(A), { calls: await A.evaluate(() => window.__cops.COP.calls.map(c => [c.why, c.who, c.npc, Math.round(c.at - 0)])), copPhase: await A.evaluate(() => window.__cops.COP.phase), heatOnYou: await A.evaluate(() => window.__map.S.heat || 0) }));
  for (let i = 0; i < 20 && await A.evaluate(() => !!window.__hood.WAR.ev); i++) await pumpAll([A], 6);
  await A.evaluate(() => { const h = window.__hood; if (h.WAR.ev) h.wEnd(h.WAR.ev, 'far'); });

  // 3. drive-by: bring a fresh corner back, a car from the rival set rolls up and the shooter climbs out on the door
  await A.evaluate(() => { const h = window.__hood, b = h.HOOD.byId.get('6,3'); for (const e of b.crew.slice()) { e.gone = true; h.HOOD.byEnt.delete(e.id); e.g.parent && e.g.parent.remove(e.g); } b.crew = []; b.down = 0; for (const id of Object.keys(h.HNET.dead)) delete h.HNET.dead[id]; h.spawn(); h.wS().log.length = 0; });
  await A.evaluate(() => window.__cops.copEnd());   // the last call's units clear first
  const okStart = await A.evaluate(() => { const h = window.__hood; return !!h.wStart(0, 0, { b: h.HOOD.byId.get('6,3'), atk: 'everman', kind: 'slide' }); });
  log({ test: '3. drive-by started', okStart });
  let pic = false;
  for (let i = 0; i < 90; i++) {
    await pumpAll([A], 6); const s = await state(A);
    if (s.ev && s.ev.ents[0] && s.ev.ents[0][6] >= 1 && !pic) { pic = true; log(Object.assign({ test: '3. shooter on the door' }, s)); if (OUT) { const u = await A.evaluate(() => { const e = window.__hood.WAR.ev.ents[0], s = e.wseat ? -1 : 1, rx = Math.cos(e.yaw) * s, rz = -Math.sin(e.yaw) * s; return window.__map.snap(e.x + rx * 6.5 + Math.sin(e.yaw) * 4, 2.4, e.z + rz * 6.5 + Math.cos(e.yaw) * 4, e.x, 1.2, e.z); }); require('fs').writeFileSync(OUT + '/driveby.jpg', Buffer.from(u.split(',')[1], 'base64')); } }
    if (!s.ev || s.ev.phase === 'out') break;
  }
  log(Object.assign({ test: '3. drive-by result' }, await state(A)));
  log({ test: 'Hood app rows', rows: await A.evaluate(() => { const h = window.__hood; h.wS().on = 1; return h.hoodMenu().rows.map(r => r.t).filter(t => /Street|Beef|slid|Drive|held|shot|took|tense|scatter/.test(t)); }) });
  log({ ERR: errs.slice(0, 10), terr: await A.evaluate(() => (window.__terr || []).slice(0, 5)) });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
