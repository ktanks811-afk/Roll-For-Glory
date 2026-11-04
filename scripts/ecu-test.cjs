// Phase 4C ECU tests (headless Chromium, Playwright, the real engine model and car physics).
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// Prints one JSON line per check; ERR lists page errors. SHOTS=1 OUT=dir saves the ECU screen.
const { chromium } = require('playwright');
const S = process.env.S;
const SCAT = 'dodge_charger_scat_pack_2015', HELL = 'dodge_charger_srt_hellcat_widebody_2020', MUS = 'ford_mustang_gt_2019', F150 = 'ford_f_150_regular_cab_2021';
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: process.env.SHOTS ? 2 : 1 });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},single(){return Promise.resolve({data:null})},upsert(){return Promise.resolve({})}}),auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){}}})', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a), log = o => console.log(JSON.stringify(o));
  const shot = async name => { await ev(() => document.querySelectorAll('canvas').forEach(cv => { if (!cv.closest('#englab')) cv.style.visibility = 'hidden'; })); await pg.screenshot({ path: (process.env.OUT || '.') + '/' + name + '.png', timeout: 120000 }); };
  const clk = async q => { await ev(q => document.querySelector(q).click(), q); await pg.waitForTimeout(80); };
  await ev(() => { const M = window.__map; M.S.cash = 1e7; try { M.closeCreator(); } catch (e) {} });
  // a car with the tuner and these ECU settings, its engine and a street quarter mile (no prep)
  await ev(() => {
    const M = window.__map;
    window.__ecuRun = (id, eng, ecu, extra) => {
      const c = M.newCar(id); if (eng) c.eng = eng; c.fuel = 100; c.tparts = ['ecu']; if (extra && extra.eb) c.eb = Object.assign({}, extra.eb); if (ecu) c.eb = Object.assign({}, c.eb || {}, { ecu });
      if (extra && extra.c) Object.assign(c, extra.c); M.S.car = c; const R = M.engOf(c), r = M.tuneRun(c, c.tune || {}, extra && extra.nos ? { nos: 1 } : {});
      return { c, R, r, o: { hp: Math.round(R.hp), tq: Math.round(R.tq / 1.3558), et: r.et ? +r.et.toFixed(3) : null, mph: +r.trap.toFixed(1), knock: +(r.P.knock || 0).toFixed(2), warn: R.warn.filter(w => /knock|Deton|Lean|rich|phaser/i.test(w)).map(w => w.slice(0, 60)) } };
    };
    window.__N7 = v => [v, v, v, v, v, v, v];
  });

  // 1. the tuner on with the factory maps changes nothing in the engine: same table, same peaks
  log(await ev(([SCAT, HELL, MUS, F150]) => {
    const M = window.__map, out = { test: 'factory maps = factory engine' };
    for (const [id, eng] of [[SCAT, null], [HELL, null], [MUS, null], [F150, 'eb'], ['mercedes_amg_g63_2019', null], ['chevrolet_caprice_classic_box_chevy_1986', 'b454']]) {
      const a = M.newCar(id); if (eng) a.eng = eng; const R0 = M.engOf(a); const c = M.newCar(id); if (eng) c.eng = eng; c.tparts = ['ecu']; c.eb = { ecu: M.ECU.ecuFull(c) }; const R1 = M.engOf(c);
      let d = 0; for (let i = 0; i < R0.tab.length; i++) d = Math.max(d, Math.abs(R0.tab[i] - R1.tab[i])); out[(eng ? id.slice(0, 10) + ':' + eng : id).slice(0, 26)] = `${Math.round(R0.hp)}=${Math.round(R1.hp)} hp, max table diff ${d.toFixed(4)} N·m`;
    }
    return out;
  }, [SCAT, HELL, MUS, F150]));

  // 2. spark sweep: an NA 392 on 93 (margin before knock) against the knock-limited Hellcat
  for (const id of [SCAT, HELL, MUS]) log(await ev(id => { const out = { test: 'spark sweep', car: id.slice(0, 22) };
    for (const t of [-4, -2, 0, 2, 4, 6, 8]) { const x = window.__ecuRun(id, null, { tm: window.__N7(t), ks: 1 }).o; out[(t > 0 ? '+' : '') + t] = `${x.hp} hp ${x.et} knock ${x.knock}`; }
    const off = window.__ecuRun(id, null, { tm: window.__N7(6), ks: 0 }).o; out['+6 sensors off'] = `${off.hp} hp ${off.et} knock ${off.knock} ${off.warn.join(' / ')}`; return out; }, id));

  // 3. mixture sweep (lambda), factory timing
  for (const id of [SCAT, HELL]) log(await ev(id => { const out = { test: 'lambda sweep', car: id.slice(0, 22) };
    for (const l of [0.72, 0.78, 0.82, 0.87, 0.92, 0.98]) { const x = window.__ecuRun(id, null, { tm: window.__N7(0), lam: window.__N7(l), ks: 1 }).o; out[l] = `${x.hp} hp ${x.et}${x.warn.length ? ' ⚠ ' + x.warn.join(' / ') : ''}`; }
    const rt = window.__ecuRun(id, null, { tm: window.__N7(3), lam: window.__N7(0.76), ks: 1 }).o; out['rich 0.76 + 3°'] = `${rt.hp} hp ${rt.et} knock ${rt.knock}`; return out; }, id));

  // 4. cam phasers (VVT): advance fills the low end, retard the top
  log(await ev(MUS => { const out = { test: 'vvt', car: 'Mustang GT (Coyote)' };
    for (const v of [[0, 0], [8, 0], [0, -8], [8, -8], [-8, 8]]) { const k = window.__ecuRun(MUS, null, { tm: window.__N7(0), vvt: v, ks: 1 }), R = k.R; out[v.join('/')] = `${k.o.hp} hp @${R.nP} ${k.o.tq} lb-ft @${R.nT}, 2500 rpm ${Math.round(R.tab[25] / 1.3558)} lb-ft, ${k.o.et}`; }
    return out; }, MUS));

  // 5. boost by gear: the Hellcat's bypass caps 1st/2nd; the EcoBoost on a boost controller gets a target per gear
  log(await ev(([HELL, F150]) => { const out = { test: 'boost by gear' };
    for (const [n, bst] of [['Hellcat full', null], ['Hellcat 1st 6 psi', [6]], ['Hellcat 1st 4, 2nd 8', [4, 8]]]) { const k = window.__ecuRun(HELL, null, { tm: window.__N7(0), bst: bst || [], ks: 1 }); out[n] = `${k.o.et} @ ${k.o.mph} t60 ${k.r.t60.toFixed(2)} spin ${k.r.spin.toFixed(2)}s`; }
    const eb = { fi: { bc: true, target: 22 } };
    for (const [n, bst] of [['EcoBoost 22 psi all gears', null], ['EcoBoost 1st 10, 2nd 16, then 22', [10, 16]]]) { const k = window.__ecuRun(F150, 'eb', { tm: window.__N7(0), bst: bst || [], ks: 1 }, { eb }); const T = k.c && window.__map.carPerf().veh.E.tabG; out[n] = `${k.o.hp} hp ${k.o.et} @ ${k.o.mph} t60 ${k.r.t60.toFixed(2)} spin ${k.r.spin.toFixed(2)}s` + (T ? ` · 4000 rpm torque by gear ${T.slice(1, 4).map(t => t ? Math.round(t[40] / 1.3558) : 'base').join('/')} vs ${Math.round(k.R.tab[40] / 1.3558)}` : ''); }
    const nb = window.__ecuRun(F150, 'eb', { tm: window.__N7(0), bst: [10], ks: 1 }); out['EcoBoost 1st 10, no boost controller'] = `${nb.o.et} (ignored: the wastegate spring sets it)`;
    return out; }, [HELL, F150]));

  // 6. limiter, shift points, pedal map, idle (Scat Pack)
  log(await ev(SCAT => { const out = { test: 'limits and shifts', car: 'Scat Pack' }, M = window.__map;
    for (const [n, e] of [['factory', {}], ['limiter 6,900', { rev: 6900 }], ['limiter 7,100', { rev: 7100 }], ['upshift 5,800', { up: 5800 }], ['upshift 6,300 + limiter 6,900', { up: 6300, rev: 6900 }], ['pedal Race', { ped: 'race' }], ['pedal Eco', { ped: 'eco' }], ['idle 900', { idle: 900 }]]) {
      const k = window.__ecuRun(SCAT, null, Object.assign({ tm: window.__N7(0), ks: 1 }, e)), V = M.carPerf().veh; out[n] = `${k.o.et} @ ${k.o.mph} (limiter ${V.red}, idle ${V.idle}, shift ${V.upW || 'factory'}, pedal ${V.ped})`; }
    return out; }, SCAT));

  // 7. launch control from the line (brake + gas, release): the 2-step rpm, and launch retard spooling a turbo on the line
  const launch = (id, eng, ecu, extra) => ev(([id, eng, ecu, extra]) => {
    const M = window.__map, k = window.__ecuRun(id, eng, ecu, extra), d = M.drvS(), T = M.TIRE; Object.assign(d, { x: 7056.5, z: 1300, yaw: 0, v: 0 }); M.physReset();
    const P = Object.assign({}, M.carPerf()), h = 1 / 240, step = (gas, brake) => M.physStep({ gas, brake, steer: 0, hb: 0 }, P, h); M.SURF.prep = 0; M.SURF.mu = 1; M.SURF.box = 0;
    for (let i = 0; i < 240; i++) step(0, 0); let rpm = 0, boost = 0; for (let i = 0; i < 2.5 * 240; i++) { step(1, 1); rpm = Math.abs(T.vd.we) * 30 / Math.PI; boost = T.boost || 0; } T.lcT0 = T.lcT || 0;
    d.v = 0; let x = 0, t = 0, t60 = null; while (t < 6 && x < 18.288 + 0.38) { step(1, 0); t += h; x += d.v * h; } t60 = t;
    return { hold: Math.round(rpm), spooled: Math.round(boost * 100) + '%', launchBoostTorque: Math.round((T.lcT0 || 0) / 1.3558) + ' lb-ft', '60ft': +t60.toFixed(3) };
  }, [id, eng, ecu, extra]);
  { const out = { test: 'launch control (street, from the line)' };
    for (const lc of [0, 2000, 3000, 4500]) out['Scat ' + (lc || 'off')] = await launch(SCAT, null, { tm: [0, 0, 0, 0, 0, 0, 0], ks: 1, lc });
    const eb = { eb: { fi: { bc: true, target: 18 } } };
    out['EcoBoost LC 2,800'] = await launch(F150, 'eb', { tm: [0, 0, 0, 0, 0, 0, 0], ks: 1, lc: 2800 }, eb);
    out['EcoBoost LC 2,800 + 15° retard'] = await launch(F150, 'eb', { tm: [0, 0, 0, 0, 0, 0, 0], ks: 1, lc: 2800, lcRet: 15 }, eb);
    log(out); }

  // 8. nitrous activation through the ECU: the window, the gears and the retard come from the ECU
  log(await ev(SCAT => { const M = window.__map, out = { test: 'ECU nitrous activation' };
    const nx = { kit: 'wet', s1: 100, s2: 0, ft: 0, add: {}, set: { ret1: 0 } };
    for (const [n, nos] of [['no window switch, ECU off', null], ['ECU on 3,500-6,200, gears 2+, 2° retard', { en: 1, on: 3500, off: 6200, g0: 2, g1: 9, wot: 90, ret: 2 }]]) {
      const k = window.__ecuRun(SCAT, null, { tm: [0, 0, 0, 0, 0, 0, 0], ks: 1, nos: nos || undefined }, { c: { nx }, nos: 1 }), X = M.NX.nxSpec(k.c);
      out[n] = `${k.o.et} @ ${k.o.mph}, window ${X.win ? X.on + '-' + X.off : 'none'}, gears ${X.gl ? X.g0 + '+' : 'any'}, retard ${X.ret1}°, peak shot ${k.r.nos ? Math.round(k.r.nos.hp) : 0} hp`; }
    return out; }, SCAT));

  // 9. the screen: buy the tuner, edit cells, every tab, sliders, drag test, back to factory
  await ev(SCAT => { const M = window.__map, c = M.newCar(SCAT); c.fuel = 100; M.S.car = c; M.ECU.ECL.tab = 'spark'; M.ECU.ecuOpen(); }, SCAT);
  const ui = { test: 'ECU screen' }; ui.locked = await ev(() => !!document.querySelector('#englab [data-buyecu]'));
  await clk('#englab [data-buyecu]'); ui.bought = await ev(() => window.__map.S.car.tparts.includes('ecu'));
  await clk('#englab [data-cell="tm|3|0.5"]'); await clk('#englab [data-cell="tm|3|0.5"]'); await clk('#englab [data-cell="lam|2|-0.01"]');
  ui.cells = await ev(() => JSON.stringify(window.__map.S.car.eb.ecu.tm) + ' ' + JSON.stringify(window.__map.S.car.eb.ecu.lam));
  if (process.env.SHOTS) { await ev(() => { document.getElementById('englab').scrollTop = 0; }); await shot('ecu_spark_chart'); await ev(() => { document.getElementById('englab').scrollTop = 330; }); await shot('ecu_spark_table'); }
  for (const t of ['boost', 'limits', 'drive', 'nos', 'cams', 'spark']) { await clk(`#englab [data-tab="${t}"]`); ui[t] = await ev(() => !!document.querySelector('#englab h3')); }
  await clk('#englab [data-test]'); ui.test_run = await ev(() => document.querySelector('#englab [data-test]').nextElementSibling.textContent);
  await clk('#englab [data-reset]'); ui.reset = await ev(() => !(window.__map.S.car.eb || {}).ecu);
  // a turbo car's boost tab with a controller, and a laptop shortcut
  await ev(F150 => { const M = window.__map, c = M.newCar(F150); c.eng = 'eb'; c.fuel = 100; c.tparts = ['ecu']; c.eb = { fi: { bc: true, target: 20 } }; M.S.car = c; M.ECU.ECL.tab = 'boost'; M.ECU.ecuOpen(); }, F150);
  await ev(() => { const i = document.querySelector('#englab [data-bst="1"]'); i.value = 9; i.dispatchEvent(new Event('change')); });
  ui.turboGear1 = await ev(() => window.__map.S.car.eb.ecu.bst[0]);
  if (process.env.SHOTS) await shot('ecu_boost_by_gear');
  log(ui);
  console.log('ERR', JSON.stringify(errs)); await b.close();
})();
