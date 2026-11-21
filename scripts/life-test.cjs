// Living NPCs tests (headless Chromium + swiftshader, Playwright). Serve the repo on PORT (default 8781);
// S = folder with npm/node_modules/three (three@0.128.0). OUT = folder for screenshots (optional). X/Z = where you stand.
// PART=1 one player: walkers on routines (spawned, on the sidewalk, moving with the clock), named locals, talking, memory,
// runs, reactions (aim, shots, car), the crowd that films, the neighborhood's read on you, cost per frame.
// PART=2 two players on the same server (?net=local): same walkers at the same spots, a scared one shows up as the other's.
const { chromium } = require('playwright');
const fs = require('fs');
const PORT = process.env.PORT || 8781, S = process.env.S, OUT = process.env.OUT, X = +(process.env.X || -700), Z = +(process.env.Z || -100), PART = process.env.PART || '1';
const log = o => console.log(JSON.stringify(o));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, r => { const p = r.request().url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  const save = { v: 1, made: true, name: 'Kimari', cash: 25000, bank: 0, car: { id: 'chevrolet_caprice_classic_box_chevy_1986', color: '#b3121b', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 1, oil: 100, mods: {} }, at: { x: X, z: Z, yaw: 0, foot: true, fx: X, fz: Z, fyaw: 0 } };
  await ctx.addInitScript(s => { if (!localStorage.getItem('mw3d.save.v1')) localStorage.setItem('mw3d.save.v1', s); }, JSON.stringify(save));
  const errs = [];
  const open = async (tag, q) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push(tag + ' console ' + m.text().slice(0, 300)); }); await p.goto(`http://localhost:${PORT}/index.html${q}`); await p.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 }); return p; };
  const prep = async p => {
    await p.evaluate(() => { window.__step = (n, dt = 0.05) => { for (let k = 0; k < n; k++) { try { window.__hood.tick(dt); if (window.__net && window.__net.NET.status === 'on') window.__net.netTick(dt); } catch (e) { (window.__terr = window.__terr || []).push(e.message + ' ' + (e.stack || '').split('\n')[1]); } } }; });
    await p.waitForFunction(() => { window.__hood.tick(0.05); return window.__hood.HOOD.ready; }, null, { timeout: 120000, polling: 500 });
  };
  const fill = (p, n = 40) => p.evaluate(n => { const L = window.__life, f = window.__guns.foot; for (let i = 0; i < n; i++) { L.lvSpawn(f.x, f.z); window.__step(2); } }, n);
  const shot = async (p, name, cam) => { if (!OUT || !cam) return; const u = await p.evaluate(a => window.__map.snap(...a), cam); fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(u.split(',')[1], 'base64')); };
  // a camera a few meters off somebody, looking at them
  const camOn = (p, id, back = 5, side = 2.5, h = 1.9) => p.evaluate(([id, back, side, h]) => { const e = window.__hood.HOOD.byEnt.get(id); if (!e) return null; const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw); return [e.x + fx * back + fz * side, h, e.z + fz * back - fx * side, e.x, 1.1, e.z]; }, [id, back, side, h]);

  if (PART === '1') {
    const A = await open('A', '?test=1'); await prep(A);
    const t0 = Date.now(); await fill(A, 45);
    const st = await A.evaluate(() => { const L = window.__life, h = window.__hood, f = window.__guns.foot, peds = h.HOOD.ents.filter(e => e.kind === 'ped' && !e.gone);
      return { looks: L.LVW.looks.length, plans: L.LVW.stats, peds: peds.length, inside: peds.filter(e => e.hide).length, locals: peds.filter(e => e.local).map(e => `${e.name} (${e.local.role} ${e.local.place})`),
        walkers: peds.filter(e => !e.local).map(e => [e.name, e.pl.arch, e.mode, e.hide ? 'inside' : 'out', Math.round(Math.hypot(e.x - f.x, e.z - f.z)) + 'm', window.__st.onRoad(e.x, e.z) ? 'ROAD' : 'sidewalk']) }; });
    log({ test: '1. people around you (Como, daytime)', secs: (Date.now() - t0) / 1000, ...st });

    // 2. the clock walks them: smooth (no jumps), on the sidewalk except crossings, in and out of doors
    const walk = await A.evaluate(() => {
      const h = window.__hood, L = window.__life, out = { steps: 0, maxJump: 0, onRoad: 0, crossing: 0, samples: 0, wentIn: 0, cameOut: 0, curbStops: 0 }, last = new Map(), wasIn = new Map();
      for (let i = 0; i < 240; i++) {
        h.HNET.clk += 250; window.__step(5, 0.05);
        for (const e of h.HOOD.ents) { if (e.kind !== 'ped' || e.gone || e.local || e.own) continue; const s = L.lvAt(e.pl, h.hNow() / 1000); if (!s) continue;
          const p = last.get(e.id); if (p && !e.hide && !wasIn.get(e.id)) out.maxJump = Math.max(out.maxJump, Math.hypot(e.x - p[0], e.z - p[1])); last.set(e.id, [e.x, e.z]);
          if (wasIn.get(e.id) === false && e.hide) out.wentIn++; if (wasIn.get(e.id) === true && !e.hide) out.cameOut++; wasIn.set(e.id, !!e.hide);
          if (!e.hide) { out.samples++; if (window.__st.onRoad(e.x, e.z)) { if (s.cross || s.curb) out.crossing++; else out.onRoad++; } if (s.curb) out.curbStops++; } }
        out.steps++; if (i % 20 === 0) L.lvSpawn(window.__guns.foot.x, window.__guns.foot.z);
      }
      out.maxJump = +out.maxJump.toFixed(2); return out; });
    log({ test: '2. a minute of walking on the clock (0.25 s steps)', ...walk });

    // 3. cost per frame with everybody out
    const cost = await A.evaluate(() => { const L = window.__life, f = window.__guns.foot, n = 30; let a = performance.now(); for (let i = 0; i < n; i++) window.__hood.tick(1 / 60); const ht = (performance.now() - a) / n; a = performance.now(); for (let i = 0; i < n; i++) L.lifeTick(1 / 60); const lt = (performance.now() - a) / n; a = performance.now(); for (let i = 0; i < 10; i++) L.lvSpawn(f.x, f.z); return { hoodTickMs: +ht.toFixed(2), lifeTickMs: +lt.toFixed(2), spawnPassMs: +((performance.now() - a) / 10).toFixed(2), peds: window.__hood.HOOD.ents.filter(e => e.kind === 'ped' && !e.gone).length, meshesPerPerson: (() => { const e = window.__hood.HOOD.ents.find(e => e.kind === 'ped' && !e.gone); let m = 0; e && e.g.traverse(o => { if (o.isMesh) m++; }); return m; })() }; });
    log({ test: '3. cost', ...cost });

    // pictures: a walker on the sidewalk, then the street from head height
    const w1 = await A.evaluate(() => { const f = window.__guns.foot, e = window.__hood.HOOD.ents.filter(e => e.kind === 'ped' && !e.gone && !e.hide && !e.local).sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z))[0]; return e && e.id; });
    if (w1) { await A.evaluate(id => { const e = window.__hood.HOOD.byEnt.get(id), f = window.__guns.foot; f.x = e.x - Math.sin(e.yaw) * 7; f.z = e.z - Math.cos(e.yaw) * 7; }, w1); await A.evaluate(() => window.__step(6)); await shot(A, '01-walker', await camOn(A, w1, 5.5, 2.2, 1.7)); }
    await A.evaluate(() => { const f = window.__guns.foot; f.x = -700; f.z = -100; }); await fill(A, 20);

    // 4. a named local: talk, name, $20, the menu, memory, work once they trust you
    const loc = await A.evaluate(() => { const f = window.__guns.foot, l = window.__hood.HOOD.ents.filter(e => e.local && !e.gone).sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z))[0]; return l && l.id; });
    if (loc) {
      await A.evaluate(id => { const e = window.__hood.HOOD.byEnt.get(id), f = window.__guns.foot; f.x = e.x - Math.sin(e.hyaw) * 1.8; f.z = e.z - Math.cos(e.hyaw) * 1.8; window.__step(4); }, loc);
      const talk = await A.evaluate(id => { const h = window.__hood, L = window.__life, e = h.HOOD.byEnt.get(id), out = {};
        let M = h.hTalkMenu(e)(); out.first = { title: M.title, sub: M.sub, rows: M.rows.map(r => r.t + (r.off ? ' (locked)' : '')) };
        M.rows.find(r => r.t === 'Wsg').act(); out.greet = e.bub && e.bub.userData ? 'said something' : 'quiet';
        M.rows.find(r => r.t.startsWith('What\'s your name')).act();
        M.rows.find(r => r.t.startsWith('Here, take')).act();
        M.rows.find(r => r.t.startsWith('Look out for them')).act();
        out.mem = L.lvMem(e); out.tier = L.lvTier(e);
        M = h.hTalkMenu(e)(); out.second = M.rows.map(r => r.t + (r.off ? ' (locked)' : ''));
        const work = M.rows.find(r => r.t === 'Got any work for me?'); if (work) work.act();
        out.run = L.lvS().q && { what: L.lvS().q.what, to: L.lvS().q.name, pay: L.lvS().q.pay };
        out.mode = e.mode; out.own = e.own; return out; }, loc);
      log({ test: '4. talking to a local', ...talk });
      await A.evaluate(() => window.__step(3)); await shot(A, '02-local-talking', await camOn(A, loc, 3.2, 1.6, 1.75));
      // drive the run: stand at the drop and the clock checks it
      const run = await A.evaluate(() => { const L = window.__life, q = L.lvS().q; if (!q) return null; const f = window.__guns.foot, cash = window.__map.S.cash; f.x = q.x; f.z = q.z; L.lvQuestStep(f.x, f.z); return { paid: window.__map.S.cash - cash, doneRuns: L.lvS().done, giverNow: L.lvS().mem[q.from] && Math.round(L.lvS().mem[q.from].a), news: L.lvS().news.slice(0, 2).map(n => n.txt) }; });
      log({ test: '4b. finishing the run', ...run });
      await A.evaluate(() => { const f = window.__guns.foot; f.x = -700; f.z = -100; }); await fill(A, 10);
    }

    // 5. greeting lines change with context and don't repeat
    const lines = await A.evaluate(() => { const L = window.__life, e = window.__hood.HOOD.ents.find(e => e.kind === 'ped' && !e.gone && !e.local && !L.lvMem(e)), out = {};
      const say = () => L.lvGreetLine(e); if (!e) return null; out.stranger = [say(), say(), say(), say()];
      L.lvRemember(e, 'gift', 60, 0); out.friend = [say(), say(), say()];
      L.lvRepAdd(e.x, e.z, -60, 0, 0); out.hatedBlock = [say(), say(), say()];
      L.lvRepAdd(e.x, e.z, 60, 0, 0); window.__map.S.health = 30; out.hurt = [say(), say()]; window.__map.S.health = 100;
      return out; });
    log({ test: '5. what people say', ...lines });

    // 6. a gun on them: hands up; then shots: duck, run, film
    const aim = await A.evaluate(() => { const h = window.__hood, f = window.__guns.foot, G = window.__guns, e = h.HOOD.ents.filter(e => e.kind === 'ped' && !e.gone && !e.hide && !e.local && !e.own).sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z))[0]; if (!e) return null;
      f.x = e.x + 6; f.z = e.z; f.camYaw = Math.atan2(6, 0); f.yaw = f.camYaw; const was = G.GUN.want; G.GUN.want = true; window.__step(3); const r = { id: e.id, mode: e.mode, said: e.bub ? 1 : 0, fear: window.__life.lvMem(e) && window.__life.lvMem(e).f }; window.__aimId = e.id; return r; });
    log({ test: '6a. pointing a gun at somebody', ...aim });
    if (aim) { await A.evaluate(() => window.__step(2)); await shot(A, '03-hands-up', await camOn(A, aim.id, 4, 1.5, 1.7)); }
    await A.evaluate(() => { window.__guns.GUN.want = false; window.__step(2); });
    await fill(A, 10);
    const shots = await A.evaluate(() => { const L = window.__life, h = window.__hood, f = window.__guns.foot; L.lvEvent('shots', f.x, f.z); window.__step(2); const c = {}; for (const e of h.HOOD.ents) if (e.kind === 'ped' && !e.gone && !e.hide) c[e.mode] = (c[e.mode] || 0) + 1; return { modes: c, rep: L.lvRep(window.__map.districtAt ? 'x' : 'x') && L.lvRepTier(f.x, f.z), news: L.lvS().news.slice(0, 2).map(n => n.txt) }; });
    log({ test: '6b. shots fired', ...shots });
    const cw = await A.evaluate(() => { const f = window.__guns.foot, e = window.__hood.HOOD.ents.find(e => e.kind === 'ped' && !e.gone && e.mode === 'cower'); return e && e.id; });
    if (cw) { await A.evaluate(() => window.__step(1)); await shot(A, '04-ducking', await camOn(A, cw, 4, 2, 1.6)); }
    for (let i = 0; i < 8; i++) await A.evaluate(() => window.__step(20, 0.05));
    log({ test: '6c. 8 s later', modes: await A.evaluate(() => { const c = {}; for (const e of window.__hood.HOOD.ents) if (e.kind === 'ped' && !e.gone && !e.hide) c[e.mode] = (c[e.mode] || 0) + 1; return c; }), gone: await A.evaluate(() => window.__life.LVW.off.size) });

    // 7. somebody gets dropped: news, the block's read on you, people come film it
    await A.evaluate(() => { const f = window.__guns.foot; f.x = -700; f.z = -100; }); await A.evaluate(() => { window.__hood.HNET.clk += 600000; }); await fill(A, 30);
    const drop = await A.evaluate(() => { const L = window.__life, h = window.__hood, f = window.__guns.foot, e = h.HOOD.ents.filter(e => e.kind === 'ped' && !e.gone && !e.hide && !e.own && !e.local).sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z))[0]; if (!e) return null;
      const before = { ...L.lvRep(window.__life.LVW && (window.__map.S && '') || '') }, d0 = L.lvRepTier(e.x, e.z); h.hDrop(e, 'me'); window.__dropAt = [e.x, e.z];
      return { who: e.name, tierBefore: d0, tierAfter: L.lvRepTier(e.x, e.z), heat: window.__map.S.heat, news: L.lvS().news.slice(0, 2).map(n => n.txt), gossip: (window.__map.S.gossip || { items: [] }).items.slice(0, 1).map(i => i.text) }; });
    log({ test: '7a. dropping somebody walking by', ...drop });
    if (drop) {
      await A.evaluate(() => { const L = window.__life; L.LVW.scenes.forEach(s => s.t -= 8000); L.lvScenes(); });
      for (let i = 0; i < 10; i++) await A.evaluate(() => window.__step(20, 0.05));
      const film = await A.evaluate(() => { const [x, z] = window.__dropAt; return window.__hood.HOOD.ents.filter(e => e.kind === 'ped' && !e.gone && e.mode === 'film').map(e => [e.name, Math.round(Math.hypot(e.x - x, e.z - z)) + 'm from the body']); });
      log({ test: '7b. the crowd films it', film });
      const at = await A.evaluate(() => window.__dropAt);
      await shot(A, '05-crowd-filming', [at[0] + 16, 6, at[1] + 12, at[0], 0.6, at[1]]);
    }

    // 8. your car: they jump out the way
    await A.evaluate(() => { const f = window.__guns.foot; f.x = -700; f.z = -100; window.__hood.HNET.clk += 600000; }); await fill(A, 30);
    const car = await A.evaluate(() => { const h = window.__hood, L = window.__life, f = window.__guns.foot, T = window.__guns.test, drv = T.drv, e = h.HOOD.ents.filter(e => e.kind === 'ped' && !e.gone && !e.down && !e.hide && !e.own && !e.local)[0]; if (!e) return null;
      const yaw = 0.3; drv.x = e.x + Math.sin(yaw) * 9; drv.z = e.z + Math.cos(yaw) * 9; drv.yaw = yaw; drv.v = 12; f.on = false;
      L.lifePed(e, 0.05, drv.x, drv.z, 9); const r = { mode: e.mode, own: e.own, mem: L.lvMem(e) && L.lvMem(e).ev.map(v => v[0]) };
      // and one that doesn't move: hit
      const e2 = h.HOOD.ents.filter(o => o.kind === 'ped' && !o.gone && !o.down && !o.hide && !o.own && !o.local && o !== e)[0]; if (e2) { drv.x = e2.x + Math.sin(yaw) * 1.5; drv.z = e2.z + Math.cos(yaw) * 1.5; drv.v = 6; L.lifePed(e2, 0.05, drv.x, drv.z, 1.5); r.hit = { mode: e2.mode, hp: Math.round(e2.hp), down: !!e2.down, news: L.lvS().news[0] && L.lvS().news[0].txt }; }
      f.on = true; drv.v = 0; return r; });
    log({ test: '8. your car', ...car });

    // 9. the Hood app shows your name around town
    log({ test: '9. Hood app', rows: await A.evaluate(() => window.__hood.hoodMenu().rows.slice(0, 7).map(r => r.t + ' | ' + r.s)) });
    // 10. night: fewer people, different crowd
    const night = await A.evaluate(() => { const L = window.__life, h = window.__hood, f = window.__guns.foot; for (const e of h.HOOD.ents.filter(e => e.kind === 'ped')) { e.gone = true; h.HOOD.byEnt.delete(e.id); e.g.parent && e.g.parent.remove(e.g); } h.HOOD.ents = h.HOOD.ents.filter(e => !e.gone); L.LVW.off.clear();
      const T = document.querySelector('#panel-time [data-t="night"]'); window.__map.setTime ? window.__map.setTime('night') : T && T.click(); for (let i = 0; i < 40; i++) { L.lvSpawn(f.x, f.z); window.__step(2); }
      const peds = h.HOOD.ents.filter(e => e.kind === 'ped' && !e.gone); const arch = {}; for (const e of peds) if (e.pl) arch[e.pl.arch] = (arch[e.pl.arch] || 0) + 1; return { peds: peds.length, locals: peds.filter(e => e.local).length, arch }; });
    log({ test: '10. at night', ...night });
    log({ ERR: errs.slice(0, 10), terr: await A.evaluate(() => (window.__terr || []).slice(0, 5)) });
  }

  if (PART === '2') {
    const A = await open('A', '?net=local'), B = await open('B', '?net=local');
    await B.evaluate(() => { window.__map.S.name = 'Lawrence'; });
    for (const p of [A, B]) await p.evaluate(() => window.__net.netJoin('eastgate'));
    for (const p of [A, B]) await p.waitForFunction(() => window.__net.NET.status === 'on', null, { timeout: 120000, polling: 500 });
    for (const p of [A, B]) await p.evaluate(() => setInterval(() => { for (const q of window.__net.NET.peers.values()) q.seen = Math.max(q.seen, performance.now() / 1000 - 1); }, 200));
    for (const p of [A, B]) await prep(p);
    for (let i = 0; i < 6; i++) for (const p of [A, B]) await p.evaluate(() => window.__step(4));
    await B.evaluate(([x, z]) => { const f = window.__guns.foot; f.x = x + 4; f.z = z; }, [X, Z]);
    for (const p of [A, B]) await fill(p, 45);
    const T0 = await A.evaluate(() => window.__hood.hNow() / 1000);
    const clk = await Promise.all([A, B].map(p => p.evaluate(() => window.__hood.hNow() - Date.now())));
    const list = p => p.evaluate(T => { const h = window.__hood; return h.HOOD.ents.filter(e => e.kind === 'ped' && !e.gone && !e.own).map(e => { const s = e.pl ? window.__life.lvAt(e.pl, T) : { x: e.hx, z: e.hz }; return [e.id, e.name, s ? Math.round(s.x) : null, s ? Math.round(s.z) : null]; }).sort(); }, T0);
    const [la, lb] = [await list(A), await list(B)];
    const both = la.filter(x => lb.some(y => y[0] === x[0]));
    const same = both.filter(x => { const y = lb.find(y => y[0] === x[0]); return y[1] === x[1] && Math.abs(y[2] - x[2]) <= 2 && Math.abs(y[3] - x[3]) <= 2; });
    log({ test: '1. same people, same spots, nothing sent', clockDiffMs: clk[0] - clk[1], onA: la.length, onB: lb.length, onBoth: both.length, sameNameAndSpot: same.length, sample: both.slice(0, 4) });
    // A scares one: A's game runs them, B sees them run
    const id = await A.evaluate(() => { const h = window.__hood, L = window.__life, e = h.HOOD.ents.find(e => e.kind === 'ped' && !e.gone && !e.hide && !e.own && !e.local); if (!e) return null; const f = window.__guns.foot; L.lvEvent('shots', e.x + 10, e.z); return e.id; });
    for (let i = 0; i < 8; i++) for (const p of [A, B]) await p.evaluate(() => window.__step(3));
    log({ test: '2. A scares one, B sees it', id, A: await A.evaluate(id => { const e = window.__hood.HOOD.byEnt.get(id); return e ? [e.own, e.mode] : 'gone (went inside)'; }, id), B: await B.evaluate(id => { const e = window.__hood.HOOD.byEnt.get(id); return e ? [e.own ? 'run by A' : 'on the clock', e.mode] : 'gone'; }, id) });
    log({ ERR: errs.slice(0, 10), terr: [await A.evaluate(() => (window.__terr || []).slice(0, 5)), await B.evaluate(() => (window.__terr || []).slice(0, 5))] });
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
