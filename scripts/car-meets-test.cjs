// Live car meets tests (headless Chromium + swiftshader, Playwright). Serve the repo on PORT (default 8781);
// S = folder with npm/node_modules/three (three@0.128.0). OUT = folder for screenshots (optional).
// Two players on the same server (?net=local): the same meet gets picked and announced for both, the lot fills with the same
// built cars and people, the groups say the same lines at the same time, and someone you start beef with shows up as yours
// on the other player's screen. Plus: the phone caps (models per meet), the parked map cars leave the lot, no errors.
const { chromium } = require('playwright');
const PORT = process.env.PORT || 8781, S = process.env.S, OUT = process.env.OUT;
const log = o => console.log(JSON.stringify(o));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, r => { const p = r.request().url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  const save = { v: 1, made: true, name: 'Kimari', cash: 25000, bank: 0, car: { id: 'chevrolet_caprice_classic_box_chevy_1986', color: '#b3121b', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 1, oil: 100, mods: {} }, at: { x: 225, z: 590, yaw: 0, foot: true, fx: 225, fz: 590, fyaw: 0 } };
  await ctx.addInitScript(s => { if (!localStorage.getItem('mw3d.save.v1')) localStorage.setItem('mw3d.save.v1', s); }, JSON.stringify(save));
  const errs = [];
  const open = async (tag, q) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push(tag + ' console ' + m.text().slice(0, 300)); }); await p.goto(`http://localhost:${PORT}/index.html${q}`); await p.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 }); return p; };
  const step = () => { try { window.__hood.tick(0.05); } catch (e) { (window.__terr = window.__terr || []).push(e.message + ' ' + (e.stack || '').split('\n')[1]); } if (window.__net && window.__net.NET.status === 'on') window.__net.netTick(0.05); };
  const pumpAll = async (pages, n) => { for (let i = 0; i < n; i++) { for (const p of pages) await p.evaluate(n => { for (let k = 0; k < n; k++) window.__step(); }, 4); await pages[0].waitForTimeout(10); } };
  const A = await open('A', '?net=local'), B = await open('B', '?net=local');
  await B.evaluate(() => { window.__map.S.name = 'Lawrence'; });
  for (const p of [A, B]) await p.evaluate(() => window.__net.netJoin('eastgate'));
  for (const p of [A, B]) await p.waitForFunction(() => window.__net.NET.status === 'on', null, { timeout: 120000, polling: 500 });
  for (const p of [A, B]) await p.evaluate(() => setInterval(() => { for (const q of window.__net.NET.peers.values()) q.seen = Math.max(q.seen, performance.now() / 1000 - 1); }, 200));
  for (const p of [A, B]) { await p.evaluate(`window.__step = ${step.toString()}`); await p.waitForFunction(() => { window.__hood.tick(0.05); return window.__hood.HOOD.ready; }, null, { timeout: 120000, polling: 500 }); }
  await pumpAll([A, B], 10);   // shared clock + seed settle
  // walk both of them to whichever meet the server has on right now
  const where = await A.evaluate(() => { const m = window.__meet, f = window.__guns.foot, p = m.mtCurrent(f.x, f.z), L = m.mtLot(p); return { id: p.id, x: L.cx - L.ox * 20, z: L.cz - L.oz * 20, cx: L.cx, cz: L.cz, ox: L.ox, oz: L.oz }; });
  for (const [p, dx] of [[A, 0], [B, 4]]) await p.evaluate(([x, z]) => { const f = window.__guns.foot; f.x = x; f.z = z; }, [where.x + dx, where.z]);
  for (let i = 0; i < 25; i++) await pumpAll([A, B], 2);
  const meetOf = p => p.evaluate(() => { const M = window.__meet.MT.live; if (!M) return null; return { place: M.p.id, slot: M.slot, seed: M.seed, ents: M.ents.filter(e => !e.gone).map(e => e.id + '|' + (e.mk.car ? e.carId + '|' + e.color + '|' + e.pr.r.b.rims.join('/') : 'fan') + '|' + e.name).sort(), models: [...new Set(M.ents.filter(e => e.mk.car).map(e => e.carId))].length, gossip: (window.__map.S.gossip ? window.__map.S.gossip.items : []).filter(g => g.icon === '🏁').map(g => g.text).slice(0, 1) }; });
  const ma = await meetOf(A), mb = await meetOf(B);
  log({ test: '1. same meet for both players', where: where.id, A: ma && [ma.place, ma.slot, ma.ents.length, 'models ' + ma.models, ma.gossip], B: mb && [mb.place, mb.slot, mb.ents.length, 'models ' + mb.models], sameCrowd: !!ma && !!mb && JSON.stringify(ma.ents) === JSON.stringify(mb.ents), sample: ma && ma.ents.slice(0, 3) });
  // 2. the talk lines line up (same clock, same lines, nothing sent)
  let match = 0, seen = 0;
  for (let i = 0; i < 6; i++) {
    await pumpAll([A, B], 2);
    const [la, lb] = await Promise.all([A, B].map(p => p.evaluate(() => window.__meet.MT.live ? window.__meet.MT.live.ppl.groups.map(G => G.sp && !G.sp.gone && G.sp.bub ? G.sp.id + ':' + G.said : '').filter(Boolean) : [])));
    for (const x of la) { seen++; if (lb.includes(x)) match++; }
  }
  log({ test: '2. groups talking in sync', linesSeenOnA: seen, alsoOnB: match });
  const lines = await A.evaluate(() => { const out = []; const M = window.__meet.MT.live; for (const e of M.ents) if (e.bub) out.push(e.name + ': ' + e.sayTxt); return out; });
  log({ test: '2b. what they are saying right now', lines });
  // 3. talk to one: the meet menu, then start beef so A owns them; B sees A running them
  const talk = await A.evaluate(() => { const M = window.__meet.MT.live, e = M.ents.find(e => e.mk.car && !e.gone); const m = window.__hood.hTalkMenu(e)(); return { id: e.id, title: m.title, sub: m.sub, rows: m.rows.map(r => r.t) }; });
  log({ test: '3a. talk menu at the meet', talk });
  await A.evaluate(id => { const h = window.__hood, e = h.HOOD.byEnt.get(id), m = h.hTalkMenu(e)(); m.rows.find(r => r.t === 'Pop the hood').act(); m.rows.find(r => r.t === 'Talk down').act(); e.mode = 'fight'; e.t = 0; }, talk.id);
  for (let i = 0; i < 10; i++) await pumpAll([A, B], 2);
  log({ test: '3b. beef: A runs them, B sees it', A: await A.evaluate(id => { const e = window.__hood.HOOD.byEnt.get(id); return e && [e.own, e.mode]; }, talk.id), B: await B.evaluate(id => { const e = window.__hood.HOOD.byEnt.get(id); return e && [e.own ? 'remote' : 'local', e.mode]; }, talk.id) });
  // 4. parked map cars left the lot
  log({ test: '4. parked map cars skipped on the lot', skipped: await A.evaluate(() => { const PK = window.__map.PK, M = window.__meet.MT.live; let n = 0; for (const l of PK.grid.values()) for (const s of l) if (PK.skip(s)) n++; return n; }) });
  if (OUT) {
    const L = where, rx = L.oz, rz = -L.ox;
    for (const [n, a] of [['meet-aerial', [L.cx - L.ox * 34 + rx * 26, 24, L.cz - L.oz * 34 + rz * 26, L.cx, 0, L.cz]], ['meet-aisle', [L.cx - rx * 20, 2.2, L.cz - rz * 20, L.cx + rx * 4, 0.9, L.cz + rz * 4]], ['meet-row', [L.cx + rx * 18 - L.ox * 2, 2.0, L.cz + rz * 18 - L.oz * 2, L.cx, 0.9, L.cz]]]) {
      const u = await A.evaluate(a => window.__map.snap(...a), a); require('fs').writeFileSync(`${OUT}/${n}.jpg`, Buffer.from(u.split(',')[1], 'base64'));
    }
  }
  log({ ERR: errs.slice(0, 10), terr: [await A.evaluate(() => (window.__terr || []).slice(0, 5)), await B.evaluate(() => (window.__terr || []).slice(0, 5))] });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
