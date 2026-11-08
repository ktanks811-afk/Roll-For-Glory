// Phase 5 pro tune shops tests (headless Chromium, Playwright, the real engine model).
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// Prints one JSON line per check; ERR lists page errors. SHOTS=1 OUT=dir saves the shop menus.
const { chromium } = require('playwright');
const S = process.env.S;
const SCAT = 'dodge_charger_scat_pack_2015', HELL = 'dodge_charger_srt_hellcat_widebody_2020', MUS = 'ford_mustang_gt_2019', G63 = 'mercedes_amg_g63_2019', BOX = 'chevrolet_caprice_classic_box_chevy_1986';
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: process.env.SHOTS ? 2 : 1 });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},single(){return Promise.resolve({data:null})},upsert(){return Promise.resolve({})}}),auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){}}})', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a), log = o => console.log(JSON.stringify(o));
  await ev(() => { const M = window.__map; M.S.cash = 1e8; M.S.dmgOff = false; try { M.closeCreator(); } catch (e) {} });
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null, run = k => !only || only.includes(k);

  // 1. tunes from four shops on a few cars: hp against factory and the ideal tune, five tunes each so the spread shows
  if (run('tunes')) for (const id of [SCAT, HELL, MUS, G63, BOX]) log(await ev(([id]) => {
    const M = window.__map, X = M.PRO, out = { test: 'pro tunes', car: id.slice(0, 26) }, t0 = performance.now();
    for (const sid of ['frisco_perf', 'torque_temple', 'atl_perf', 'mineral_wells_perf']) {
      const P = X.PRO_SHOPS[sid], hs = [];
      for (let i = 0; i < 5; i++) { const c = M.newCar(id); M.S.car = c; const r = X.proTuneJob(c, P, { id: sid, name: sid }, false); hs.push(`${r.hp}${r.knock ? 'k' : ''}`); out.fac = r.fac; out.ideal = r.ideal; }
      out[P.who.split(' ')[0]] = hs.join(' ');
    }
    const c = M.newCar(id); M.S.car = c; const r = X.proTuneJob(c, X.PRO_SHOPS.torque_temple, { id: 'x', name: 'x' }, true); out.canned = r.hp; out.msPerTune = Math.round((performance.now() - t0) / 21);
    return out; }, [id]));

  // 2. a tune result in detail (notes, quarter mile)
  if (run('detail')) log(await ev(([id]) => { const M = window.__map, X = M.PRO, c = M.newCar(id); M.S.car = c; const r = X.proTuneJob(c, X.PRO_SHOPS.big_d_customs, { id: 'big_d_customs', name: 'Big D' }, false);
    const e = M.ECU.ecuOf(c); return { test: 'drag tune detail', hp: `${r.before} -> ${r.hp} (ideal ${r.ideal})`, q: r.q.toFixed(2), et: `${r.et0 && r.et0.toFixed(2)} -> ${r.et && r.et.toFixed(2)}`, tm: e.tm.join(','), lam: e.lam.join(','), lc: e.lc, ped: e.ped, up: e.up, notes: r.notes }; }, [SCAT]));

  // 3. build plans at each level and the spread of finished builds from a great and a bad shop
  if (run('builds')) for (const id of [SCAT, MUS, BOX, HELL]) log(await ev(([id]) => {
    const M = window.__map, X = M.PRO, out = { test: 'builds', car: id.slice(0, 26) };
    for (const pk of ['fresh', 'street', 'strip', 'allout']) { const c = M.newCar(id); M.S.car = c; const pl = X.proPlan(c, X.PRO_SHOPS.frisco_perf, pk); out[pk] = `${M.carHp(c)} -> ${pl.est} hp est, $${pl.price} (${pl.got.join(',')})`; }
    for (const sid of ['frisco_perf', 'mineral_wells_perf']) { const P = X.PRO_SHOPS[sid], hs = [];
      for (let i = 0; i < 6; i++) { const c = M.newCar(id); M.S.car = c; const pl = X.proPlan(c, P, 'strip'); const j = { shop: sid, pk: 'strip', car: c, plan: pl, roll: X.proRoll(P, 2), hp0: 0 }; const r = X.proFinish(j); hs.push(`${r.hp}/${r.est}${r.grade}${j.roll.tag ? '(' + j.roll.tag + ')' : ''}`); }
      out['strip ' + P.who.split(' ')[0]] = hs.join(' '); }
    return out; }, [id]));

  // 4. drop off and pick up through the game: the car leaves, comes back built
  if (run('drop')) log(await ev(([id]) => { const M = window.__map, X = M.PRO, p = M.places().find(q => q.id === 'torque_temple');
    const c = M.newCar(id); M.S.car = c; M.S.garage = []; M.S.proJobs = []; M.S.cash = 1e8; const pl = X.proPlan(c, X.PRO_SHOPS.torque_temple, 'street'); const cash = M.S.cash; X.proDrop(p, X.PRO_SHOPS.torque_temple, pl, false);
    const o = { test: 'drop off + pick up', carGone: M.S.car === null, jobs: M.S.proJobs.length, paid: cash - M.S.cash, readyNow: X.proReady(M.S.proJobs[0]) };
    M.S.proJobs[0].ready = Date.now() - 1; X.proPickup(p, 0); o.back = M.S.car === c; o.jobsAfter = M.S.proJobs.length; o.hp = M.carHp(c); o.build = c.proBuild; o.bq = c.eb.bq; o.saveKB = Math.round(JSON.stringify(M.S).length / 1024); return o; }, [SCAT]));

  if (process.env.SHOTS) {
    const OUT = process.env.OUT || '.', shot = async n => { await pg.waitForTimeout(150); await pg.screenshot({ path: OUT + '/' + n + '.png', timeout: 120000 }); };
    await ev(([id]) => { const M = window.__map, c = M.newCar(id); c.color = '#7a1820'; M.S.car = c; M.S.proJobs = []; window.__p = M.places().find(q => q.id === 'big_d_customs'); M.openMenu(() => M.DMG.MENUS.protune(window.__p)); }, [SCAT]);
    await shot('pro-menu');
    const st = await ev(() => { const M = window.__map; M.closeMenu && M.closeMenu(); M.enter('big_d_customs'); return M.use('Pro tuner'); }); log({ test: 'stations in Big D', st });
    await pg.waitForTimeout(1500); await pg.screenshot({ path: OUT + '/pro-in-shop.png', timeout: 120000 });
    await ev(() => { const M = window.__map; M.openMenu(() => M.PRO.proPlanMenu(window.__p, 'strip')); }); await shot('pro-quote');
    await ev(() => { const M = window.__map, X = M.PRO, r = X.proTuneJob(M.S.car, X.PRO_SHOPS.big_d_customs, window.__p, false); M.openMenu(() => X.proResultMenu(window.__p, r)); }); await shot('pro-tune-result');
    await ev(() => { const M = window.__map, X = M.PRO, c = M.S.car, pl = X.proPlan(c, X.PRO_SHOPS.big_d_customs, 'allout'); const j = { shop: 'big_d_customs', pk: 'allout', car: c, plan: pl, roll: X.proRoll(X.PRO_SHOPS.big_d_customs, 3), hp0: M.carHp(c) }; const r = X.proFinish(j); r.day = M.S.day; M.openMenu(() => X.proResultMenu(window.__p, r)); }); await shot('pro-build-result');
  }
  log({ ERR: errs });
  await b.close();
})();
