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
  const A = await open('A', '?net=local'), B = await open('B', '?net=local');
  await B.evaluate(() => { window.__map.S.name = 'Lawrence'; });
  for (const p of [A, B]) await p.evaluate(() => window.__net.netJoin('eastgate'));
  for (const p of [A, B]) await p.waitForFunction(() => window.__net.NET.status === 'on', null, { timeout: 120000, polling: 500 });
  for (const p of [A, B]) await p.evaluate(() => setInterval(() => { for (const q of window.__net.NET.peers.values()) q.seen = Math.max(q.seen, performance.now() / 1000 - 1); }, 200));
  await setup(A, 0); await setup(B, 8);
  const lead = await A.evaluate(() => window.__net.NET.id) < await B.evaluate(() => window.__net.NET.id) ? A : B, other = lead === A ? B : A;
  // no police this time, and a softer corner, so the drops show
  for (const p of [A, B]) await p.evaluate(() => { const C = window.__cops; C.copReport = () => null; C.copWitnessCall = () => null; });
  await lead.evaluate(() => { const h = window.__hood, b = h.HOOD.byId.get('6,3'); for (const m of b.crew) m.hp = 20; window.__ev = h.wStart(0, 0, { b, atk: 'everman', kind: 'slide' }); for (const e of window.__ev.ents) e.hp = 400; });
  let pic = false;
  for (let i = 0; i < 90; i++) {
    await pumpAll([A, B], 4); const s = await state(lead);
    if (s.ev && s.ev.ents[0] && s.ev.ents[0][6] >= 1 && !pic) {
      pic = true;
      const seen = await other.evaluate(() => { const e = window.__hood.HOOD.ents.find(e => e.wcar && !e.gone); return e && [e.id.slice(0, 14), Math.round(e.x), Math.round(e.z), +(e.wo || 0).toFixed(2), e.wseat, e.inCar, !!e.model, e.own ? 'remote' : 'local']; });
      log({ test: 'online: other player sees the drive-by car + shooter', lead: s.ev.ents[0], other: seen });
      if (OUT) for (const [p, n] of [[lead, 'driveby-close'], [other, 'driveby-other-player']]) { await p.evaluate(() => { const e = window.__hood.HOOD.ents.find(e => e.wcar && !e.gone); const s = e.wseat ? -1 : 1, rx = Math.cos(e.yaw) * s, rz = -Math.sin(e.yaw) * s; window.__map.view(e.x + rx * 7 + Math.sin(e.yaw) * 5, 2.6, e.z + rz * 7 + Math.cos(e.yaw) * 5, e.x, e.z); }); await p.screenshot({ path: OUT + '/' + n + '.png', timeout: 120000 }); }
    }
    if (!s.ev || s.ev.phase === 'out') break;
  }
  log(Object.assign({ test: 'drive-by result (lead)' }, await state(lead)));
  log({ test: 'other player: corner crew', crew: await other.evaluate(() => window.__hood.HOOD.byId.get('6,3').crew.map(m => [m.id, m.down ? 'DOWN' : 'up', m.own ? 'remote' : 'local'])), news: await other.evaluate(() => window.__hood.wS().log.slice(0, 2).map(n => n.text)) });
  log({ ERR: errs.slice(0, 10), terr: [await A.evaluate(() => (window.__terr || []).slice(0, 5)), await B.evaluate(() => (window.__terr || []).slice(0, 5))] });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
