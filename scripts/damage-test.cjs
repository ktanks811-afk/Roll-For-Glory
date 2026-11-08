// Phase 4D damage tests (headless Chromium, Playwright, the real engine model and car physics).
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// Prints one JSON line per check; ERR lists page errors. SHOTS=1 OUT=dir saves the Car health screen.
const { chromium } = require('playwright');
const S = process.env.S;
const SCAT = 'dodge_charger_scat_pack_2015', HELL = 'dodge_charger_srt_hellcat_widebody_2020', MUS = 'ford_mustang_gt_2019';
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: process.env.SHOTS ? 2 : 1 });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},single(){return Promise.resolve({data:null})},upsert(){return Promise.resolve({})}}),auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){}}})', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a), log = o => console.log(JSON.stringify(o));
  const shot = async name => { await ev(() => document.querySelectorAll('canvas').forEach(cv => { if (!cv.closest('#englab')) cv.style.visibility = 'hidden'; })); await pg.screenshot({ path: (process.env.OUT || '.') + '/' + name + '.png', timeout: 120000 }); };
  await ev(() => { const M = window.__map; M.S.cash = 1e7; try { M.closeCreator(); } catch (e) {} });
  // drive the player's car on the real physics (not a muted test pull): `secs` of a script, warm motor, then what wore
  await ev(() => {
    const M = window.__map, D = M.DMG;
    window.__car = (id, o) => { const c = M.newCar(id); if (o && o.eng) c.eng = o.eng; c.fuel = 100; if (o && o.ecu) { c.tparts = ['ecu']; c.eb = Object.assign({}, c.eb || {}, { ecu: o.ecu }); } if (o && o.c) Object.assign(c, o.c); M.S.car = c; D.DMG.tt = null; D.DMG.ctx = null; return c; };
    window.__drive = (secs, script, o) => {
      const c = M.S.car, P = M.carPerf(), T = M.TIRE; D.ENGT.id = c.id; D.ENGT.T = (o && o.T) || 90; c.engT = D.ENGT.T; M.physReset(); const d = M.drvS(); d.yaw = 0; d.v = 0; d.steer = 0;
      const w0 = Object.assign({}, D.wrOf(c)), tr0 = c.cond.trans, ti0 = c.cond.tires, h = 1 / 240; let t = 0, x = 0, maxT = 0, maxTr = 0, maxRpm = 0;
      while (t < secs) { const I = script(t, x, d.v, T); M.physStep(I, P, h); const u = Math.max(0, d.v); x += u * h; T.vx = 0; T.vz = -u; T.w = 0; t += h; if (window.__frameBump) window.__frameBump();
        maxT = Math.max(maxT, D.ENGT.T); maxTr = Math.max(maxTr, D.DMG.tt || 0); if (T.vd) maxRpm = Math.max(maxRpm, T.vd.we * 30 / Math.PI); }
      const w = D.wrOf(c), out = {}; for (const k in w) { const dd = w0[k] - w[k]; if (dd > 0.0005) out[k] = +dd.toFixed(3); } if (tr0 - c.cond.trans > 0.0005) out.trans = +(tr0 - c.cond.trans).toFixed(3); if (ti0 - c.cond.tires > 0.0005) out.tires = +(ti0 - c.cond.tires).toFixed(3);
      return { wear: out, coolant: Math.round(maxT), trans: Math.round(maxTr), rpm: Math.round(maxRpm), mph: Math.round(d.v * 2.237), dist: Math.round(x) };
    };
    window.__wot = (t, x) => ({ gas: x < 402 ? 1 : 0, brake: x < 402 ? 0 : 0.6, steer: 0, hb: 0 });
  });

  // 1. factory cars, wide open, five quarter miles back to back: nothing but a little tread
  log(await ev(([SCAT, HELL, MUS]) => { const out = { test: 'factory: 5 street quarter miles' };
    for (const id of [SCAT, HELL, MUS]) { window.__car(id); const r = []; for (let i = 0; i < 5; i++) r.push(window.__drive(16, window.__wot)); const W = {}; for (const x of r) for (const k in x.wear) W[k] = +((W[k] || 0) + x.wear[k]).toFixed(3); out[id.slice(0, 24)] = `wear ${JSON.stringify(W)} coolant max ${Math.max(...r.map(x => x.coolant))} °C trans ${Math.max(...r.map(x => x.trans))} °C`; }
    return out; }, [SCAT, HELL, MUS]));

  // 2. detonation from the ECU spark map: sensors on catch it, sensors off it eats pistons
  log(await ev(([SCAT, HELL]) => { const out = { test: 'spark map past the knock limit (1 pass)' }, N7 = v => [v, v, v, v, v, v, v];
    for (const [id, tm, ks] of [[SCAT, 8, 1], [SCAT, 8, 0], [HELL, 4, 1], [HELL, 4, 0], [HELL, 8, 0]]) { window.__car(id, { ecu: { tm: N7(tm), ks } }); const r = window.__drive(16, window.__wot); out[`${id.slice(6, 20)} +${tm}° sensors ${ks ? 'on' : 'off'}`] = JSON.stringify(r.wear); }
    return out; }, [SCAT, HELL]));

  // 3. a lean map under boost (Hellcat), and on the NA 392
  log(await ev(([SCAT, HELL]) => { const out = { test: 'lean map (1 pass)' }, N7 = v => [v, v, v, v, v, v, v];
    for (const [id, l] of [[HELL, 0.8], [HELL, 0.9], [HELL, 0.98], [SCAT, 0.95], [SCAT, 1.02]]) { window.__car(id, { ecu: { tm: N7(0), lam: N7(l), ks: 1 } }); out[`${id.slice(6, 20)} λ ${l}`] = JSON.stringify(window.__drive(16, window.__wot).wear); }
    return out; }, [SCAT, HELL]));

  // 4. over-rev: the ECU limiter past the valve springs, and a manual money shift
  log(await ev(([SCAT]) => { const out = { test: 'over-rev (1 pass)' }, R = window.__map.engOf(window.__car(SCAT));
    out.springs = R.red + ' rpm';
    for (const d of [0, 300, 500, 700]) { window.__car(SCAT, { ecu: { tm: [0, 0, 0, 0, 0, 0, 0], rev: R.red + d, ks: 1 } }); const r = window.__drive(16, window.__wot); out['limiter +' + d] = `${JSON.stringify(r.wear)} peak ${r.rpm}`; }
    return out; }, [SCAT]));

  // 5. nitrous on cast pistons: a 150 shot, a 250, a 250 that runs lean (no fuel)
  log(await ev(([SCAT]) => { const M = window.__map, out = { test: 'nitrous (1 pass)' };
    for (const [n, nx] of [['wet 150', { kit: 'wet', s1: 150, s2: 0, ft: 0, add: { win: true }, set: { ret1: 3 } }], ['wet 250', { kit: 'wet', s1: 250, s2: 0, ft: 0, add: { win: true }, set: { ret1: 4 } }], ['dry 250, factory fuel', { kit: 'dry', s1: 250, s2: 0, ft: 0, add: { win: true }, set: { ret1: 2 } }]]) {
      window.__car(SCAT, { c: { nx, nosLb: 10, nosT: 303, nosAt: Date.now() } }); const r = window.__drive(16, (t, x) => Object.assign(window.__wot(t, x), { nos: x < 402 })); out[n] = JSON.stringify(r.wear) + ' why ' + JSON.stringify(Object.fromEntries(Object.entries(M.S.car.wrWhy || {}).map(([k, v]) => [k, +v.toFixed(2)]))); }
    return out; }, [SCAT]));

  // 6. tired oil: two minutes of hard driving on fresh oil, at 10%, and at 0%
  log(await ev(([MUS]) => { const out = { test: 'oil (2 min, WOT bursts)' };
    for (const oil of [100, 10, 0]) { window.__car(MUS, { c: { oil } }); const r = window.__drive(120, (t, x, v) => ({ gas: (t % 12) < 6 ? 1 : 0.15, brake: (t % 12) > 9 && v > 15 ? 0.5 : 0, steer: 0, hb: 0 })); out['oil ' + oil + '%'] = `${JSON.stringify(r.wear)} coolant ${r.coolant}`; }
    return out; }, [MUS]));

  // 7. heat: a long burnout (line lock on the strip's water box), holding it on the brakes (converter), a cold motor flogged
  log(await ev(([SCAT, MUS]) => { const M = window.__map, out = { test: 'heat' };
    window.__car(SCAT, { c: { lineLock: true } }); M.SURF.box = 1; let r = window.__drive(25, () => ({ gas: 1, brake: 1, steer: 0, hb: 0 })); M.SURF.box = 0; out['Scat Pack 25 s burnout'] = `${JSON.stringify(r.wear)} coolant ${r.coolant} trans ${r.trans} rpm ${r.rpm}`;
    window.__car(SCAT); r = window.__drive(20, () => ({ gas: 1, brake: 1, steer: 0, hb: 0 })); out['Scat Pack 20 s brake stand'] = `${JSON.stringify(r.wear)} coolant ${r.coolant} trans ${r.trans} rpm ${r.rpm}`;
    window.__car(SCAT); r = window.__drive(4, () => ({ gas: 1, brake: 1, steer: 0, hb: 0 })); out['Scat Pack 4 s brake stand'] = `${JSON.stringify(r.wear)} trans ${r.trans}`;
    window.__car(MUS); r = window.__drive(30, window.__wot, { T: 30 }); out['Mustang cold motor, WOT'] = `${JSON.stringify(r.wear)}`;
    return out; }, [SCAT, MUS]));

  // 8. a dual-clutch car: launches slip the clutch
  log(await ev(() => { const M = window.__map, out = { test: 'dual clutch launches' }; let id = null;
    for (const k of ['chevrolet_corvette_c8_2020', 'chevrolet_corvette_stingray_c8_2020']) { try { const c = M.newCar(k); M.S.car = c; if (M.carPerf().veh.tt === 'dct') { id = k; break; } } catch (e) {} }
    if (!id) { for (const k of M.CARS ? M.CARS.map(c => c.id) : []) { const c = M.newCar(k); M.S.car = c; try { if (M.carPerf().veh.tt === 'dct') { id = k; break; } } catch (e) {} } }
    if (!id) return Object.assign(out, { skip: 'no dct car found' });
    window.__car(id); let W = 0; for (let i = 0; i < 5; i++) { const r = window.__drive(6, (t, x) => ({ gas: 1, brake: 0, steer: 0, hb: 0 })); W += r.wear.clutch || 0; }
    out[id] = `clutch ${W.toFixed(3)}% over 5 launches`; return out; }));

  // 9. damage off: the worst of the above wears nothing
  log(await ev(([HELL]) => { const M = window.__map, D = M.DMG, out = { test: 'damage off' }, N7 = v => [v, v, v, v, v, v, v];
    D.dmgSet(false); window.__car(HELL, { ecu: { tm: N7(8), lam: N7(0.98), ks: 0 }, c: { oil: 0 } }); out['Hellcat +8° sensors off λ 0.98, no oil'] = JSON.stringify(window.__drive(16, window.__wot).wear); D.dmgSet(true);
    window.__car(HELL, { ecu: { tm: N7(8), lam: N7(0.98), ks: 0 }, c: { oil: 0 } }); out['same, damage on'] = JSON.stringify(window.__drive(16, window.__wot).wear);
    return out; }, [HELL]));

  // 10. what wear costs: tired rings, a sick turbo, a worn clutch; failed parts stop it
  log(await ev(([SCAT, HELL]) => { const M = window.__map, D = M.DMG, out = { test: 'wear costs' }, run = () => { const c = M.S.car, r = M.tuneRun(c, c.tune || {}, {}); return r.et ? r.et.toFixed(3) : 'no run'; };
    window.__car(SCAT); out['Scat Pack new'] = run(); D.wrOf(M.S.car).pist = 30; out['pistons 30%'] = run(); D.wrOf(M.S.car).valv = 20; out['+ valves 20%'] = run();
    window.__car(SCAT); M.S.car.cond.trans = 15; out['transmission 15%'] = run();
    window.__car(SCAT); D.wrOf(M.S.car).brg = 0; out['bearings failed'] = `dead ${D.engDead(M.S.car)}, top ${M.carPerf().top}`;
    window.__car(SCAT); M.S.car.cond.trans = 0; out['transmission failed'] = `top ${M.carPerf().top}`;
    window.__car('ford_f_150_regular_cab_2021', { eng: 'eb' }); out['EcoBoost new'] = run(); D.wrOf(M.S.car).fi = 30; out['turbo 30%'] = run(); D.wrOf(M.S.car).fi = 0; out['turbo failed'] = run();
    return out; }, [SCAT, HELL]));

  // 11. the mechanic: each worn part is a line with a price; fixing it puts it back to 100
  log(await ev(([SCAT]) => { const M = window.__map, D = M.DMG, out = { test: 'repair menu' }; M.S.cash = 1e7; const c = window.__car(SCAT); Object.assign(D.wrOf(c), { pist: 40, gask: 80, clutch: 60 }); c.cond.trans = 70;
    const m = D.MENUS.repair({ name: 'Test Shop' }); out.rows = m.rows.map(r => `${r.t} ${r.s} ${r.btn}`).join(' | ');
    m.rows.find(r => /Pistons/.test(r.t)).act(); out.afterPistons = D.wrGet(c, 'pist'); m.rows.find(r => /Fix everything/.test(r.t)).act(); out.afterAll = JSON.stringify(c.wr) + ' trans ' + c.cond.trans;
    return out; }, [SCAT]));

  // 12. the screen and the settings switch
  log(await ev(([HELL]) => { const M = window.__map, D = M.DMG, out = { test: 'screen' }; const c = window.__car(HELL); Object.assign(D.wrOf(c), { pist: 62, valv: 91, gask: 35, brg: 100, fi: 48, clutch: 100 }); c.cond.trans = 88; c.cond.tires = 54; c.wrWhy = { det: 21.4, heat: 8.2, cyl: 5.1, rev: 9, boost: 4.3, conv: 12, tire: 46 };
    D.dmgOpen(); const el = document.getElementById('englab'); out.parts = [...el.querySelectorAll('.dmp b')].map(b => b.textContent).join(', '); out.live = el.querySelector('#dmlive').textContent.slice(0, 120);
    el.querySelector('[data-dm="off"]').click(); out.offSaved = M.S.dmgOff; el.querySelector('[data-dm="on"]').click(); out.onSaved = M.S.dmgOff;
    return out; }, [HELL]));
  // 13. in the game: driving wears it live (stepDrive), a failed motor won't move the car, the old knock and anti-lag paths
  await ev(([SCAT]) => { const M = window.__map, D = M.DMG; D.DHL.open = false; const el = document.getElementById('englab'); if (el) el.hidden = true; const c = window.__car(SCAT, { ecu: { tm: [10, 10, 10, 10, 10, 10, 10], ks: 0 } }); D.ENGT.id = c.id; D.ENGT.T = 90; c.engT = 90; M.foot.on = false; try { M.gbMode(false); } catch (e) {} M.startDrive(5000, 1357); }, [SCAT]);
  await pg.waitForTimeout(3000);
  await ev(() => { const M = window.__map, D = M.DMG, c = M.S.car; if (M.foot.on) M.getIn(); D.ENGT.id = c.id; D.ENGT.T = 90; c.engT = 90; window.__drvIn = () => ({ gas: 1, brake: 0, steer: 0, hb: 0 }); });
  await pg.waitForTimeout(6000);
  log(await ev(() => { const M = window.__map, D = M.DMG, c = M.S.car, o = { test: 'live drive (6 s WOT, +10° sensors off)', mph: Math.round(M.drvS().v * 2.237), pistons: +D.wrGet(c, 'pist').toFixed(1), why: JSON.stringify(Object.fromEntries(Object.entries(c.wrWhy || {}).map(([k, v]) => [k, +v.toFixed(2)]))) };
    D.wrOf(c).pist = 0; M.drvS().v = 0; M.physReset(); return o; }));
  await pg.waitForTimeout(3000);
  log(await ev(() => { const M = window.__map, D = M.DMG; window.__drvIn = null; return { test: 'live drive, holed piston, 3 s WOT', mph: Math.round(M.drvS().v * 2.237), dead: D.engDead(M.S.car) }; }));
  await ev(([HELL]) => { const M = window.__map, D = M.DMG, c = window.__car(HELL); Object.assign(D.wrOf(c), { pist: 62, valv: 91, gask: 35, brg: 100, fi: 48, clutch: 100 }); c.cond.trans = 88; c.cond.tires = 54; c.wrWhy = { det: 21.4, heat: 8.2, cyl: 5.1, rev: 9, boost: 4.3, conv: 12, tire: 46 }; D.ENGT.id = c.id; D.ENGT.T = 104; D.DMG.oilT = 128; D.DMG.tt = 96; D.dmgOpen(); }, [HELL]);
  if (process.env.SHOTS) await shot('damage_health');
  log({ ERR: errs });
  await b.close();
})();
