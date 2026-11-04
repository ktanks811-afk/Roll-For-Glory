// Phase 4B forced-induction tests (headless Chromium, Playwright, the real engine model and car physics).
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// Prints one JSON line per check; ERR lists page errors. SHOTS=1 OUT=dir saves the Boost screen.
const { chromium } = require('playwright');
const S = process.env.S;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 844, height: 390 } });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},single(){return Promise.resolve({data:null})},upsert(){return Promise.resolve({})}}),auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){}}})', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a), log = o => console.log(JSON.stringify(o));
  await ev(() => { const M = window.__map; M.S.cash = 1e7; try { M.closeCreator(); } catch (e) {} });

  // 1. the factory hardware each boosted engine gets sized to, and its boost / charge temperature / spool vs rpm
  log(await ev(() => {
    const M = window.__map, out = { test: 'factory' };
    for (const [id, eng] of [['dodge_charger_srt_hellcat_widebody_2020', null], ['chevrolet_camaro_ss_2016', 'hc'], ['ford_mustang_gt_2019', 'coyote_sc'], ['ford_f_150_regular_cab_2021', 'eb'], ['mercedes_amg_g63_2019', null], ['mercedes_amg_g63_2019', 'b800'], ['chevrolet_caprice_classic_box_chevy_1986', 'b454']]) {
      const c = M.newCar(id); if (eng) c.eng = eng; const R = M.engOf(c), H = R.fiH, o = { hp: Math.round(R.hp), tq: Math.round(R.tq / 1.3558) };
      if (H.kind === 'turbo') Object.assign(o, { turbos: H.n, inducer: +H.ind.toFixed(1), ar: +H.ar.toFixed(2) }); else Object.assign(o, H.kind === 'centri' ? { imp: H.imp, ratio: +H.ratio.toFixed(2) } : { rotorL: H.vb, ratio: +H.ratio.toFixed(2) });
      for (const n of [2000, 3000, 4500, 6000]) { const f = M.FI.fiTabAt(R.fiTab, n); o['@' + n] = `${f.psi.toFixed(1)} psi ${Math.round(f.T2 - 273)}C` + (H.kind === 'turbo' ? ` gate ${Math.round(f.gate * 100)}% spool ${f.tau.toFixed(2)}s` : ` drive ${Math.round(f.drive / 745.7)}hp`); }
      out[(eng || id).slice(0, 14)] = o;
    }
    return out;
  }));

  // 2. builds on the Scat Pack (NA 392): kits, then the hardware changes on them; quarter mile, street launch, no prep
  const run = (name, eb, extra) => ev(([name, eb, extra]) => {
    const M = window.__map, c = M.newCar('dodge_charger_scat_pack_2015'); c.fuel = 100; c.eb = eb; if (extra) Object.assign(c, extra); M.S.car = c;
    const R = M.engOf(c), t = M.tuneOf ? M.tuneOf(c) : (c.tune || {}), r = M.tuneRun(c, t, {}), o = { test: name, hp: Math.round(R.hp), tq: Math.round(R.tq / 1.3558), psi: +R.psi.toFixed(1), et: r.et && +r.et.toFixed(3), mph: r.trap && +r.trap.toFixed(1), spin: +r.spin.toFixed(2) };
    if (R.fiH) { const T = R.fiTab; o.boost = [2500, 3500, 5000, 6400].map(n => M.FI.fiTabAt(T, n).psi.toFixed(1)).join(' / '); o.T2max = Math.round(Math.max(...T.slice(15, 65).map(f => f.T2)) - 273); }
    const w = R.warn.filter(x => /compressor|wastegate|rotor|impeller|shaft|charge air|Knock|Fuel/i.test(x)).map(x => x.split(':')[0]); if (w.length) o.warn = w;
    return o;
  }, [name, eb, extra || null]);
  const IC = { ic: 'fmic' };
  log(await run('NA 392', {}));
  log(await run('twin turbo kit 12 psi', { power: 'turbo', pistons: 'boost', inj: 'i80', pump: 'p450' }));
  log(await run('twin turbo kit, 0.48 A/R housings', { power: 'turbo', pistons: 'boost', inj: 'i80', pump: 'p450', fi: { ar: 0.48 } }));
  log(await run('twin turbo kit, 1.06 A/R housings', { power: 'turbo', pistons: 'boost', inj: 'i80', pump: 'p450', fi: { ar: 1.06 } }));
  log(await run('single turbo kit 14 psi', { power: 'turbo1', pistons: 'boost', inj: 'i80', pump: 'p450' }));
  log(await run('single 88 mm at 20 psi, controller', { power: 'turbo1', pistons: 'boost', inj: 'i120', pump: 'dual', fi: { ind: 88, ar: 1.15, gate: 'ext60', bc: true, target: 20 } }));
  log(await run('single 60 mm at 20 psi (too small)', { power: 'turbo1', pistons: 'boost', inj: 'i120', pump: 'dual', fi: { ind: 60, bc: true, target: 20 } }));
  log(await run('single kit, tiny housing + internal gate (creep)', { power: 'turbo1', pistons: 'boost', inj: 'i120', pump: 'dual', fi: { ar: 0.35, target: 8 } }));
  log(await run('single kit, no intercooler', { power: 'turbo1', pistons: 'boost', inj: 'i80', pump: 'p450', fi: { ic: 'none' } }));
  log(await run('twin-screw kit 8 psi', { power: 'twinscrew', pistons: 'boost', inj: 'i80', pump: 'p450' }));
  log(await run('twin-screw kit, 10% smaller pulley', { power: 'twinscrew', pistons: 'boost', inj: 'i80', pump: 'p450', fi: { pul: 10 } }));
  log(await run('twin-screw kit, 2.9 L rotors', { power: 'twinscrew', pistons: 'boost', inj: 'i80', pump: 'p450', fi: { vb: 2.9 } }));
  log(await run('roots kit 10 psi (no intercooler)', { power: 'roots', pistons: 'boost', inj: 'i80', pump: 'p450' }));
  log(await run('centrifugal kit 12 psi', { power: 'centri', pistons: 'boost', inj: 'i80', pump: 'p450' }));
  log(await run('centrifugal kit, 15% smaller pulley', { power: 'centri', pistons: 'boost', inj: 'i80', pump: 'p450', fi: { pul: 15 } }));

  // 3. intercooler heat soak: back-to-back passes on the Hellcat's air-to-water cooler, then the same with an ice tank
  log(await ev(() => {
    const M = window.__map, out = { test: 'heat soak (Hellcat)' }, c = M.newCar('dodge_charger_srt_hellcat_widebody_2020'); c.fuel = 100; M.S.car = c; const t = M.tuneOf ? M.tuneOf(c) : (c.tune || {});
    for (const ice of [false, true]) {
      c.eb = ice ? { fi: { ic: 'ice' } } : {}; c.icW = null; c.ice = ice ? 8 : 0; c.icAt = Date.now(); const r = [];
      for (let i = 0; i < 4; i++) { const p = M.tuneRun(c, t, {}); M.VEH_CACHE && M.VEH_CACHE.clear && M.VEH_CACHE.clear(); r.push(`${p.et.toFixed(3)} (water ${Math.round(p.fi.icw - 273)}C${ice ? ', ice ' + p.fi.ice.toFixed(1) + ' kg' : ''})`); c.icW = p.fi.icw; c.ice = p.fi.ice; c.icAt = Date.now(); }
      out[ice ? 'ice tank' : 'factory'] = r.join(', ');
    }
    return out;
  }));

  // 4. the Boost screen renders (factory turbo car, then a blower car); compressor map and dyno drawn
  for (const [id, eng] of [['mercedes_amg_g63_2019', null], ['dodge_charger_srt_hellcat_widebody_2020', null], ['dodge_charger_scat_pack_2015', null]]) {
    log(await ev(([id, eng]) => { const M = window.__map, c = M.newCar(id); if (eng) c.eng = eng; M.S.car = c; M.FI.fiOpen(); const el = document.getElementById('englab');
      return { test: 'screen ' + id.slice(0, 20), open: !el.hidden, buttons: el.querySelectorAll('button').length, map: !!document.getElementById('fimap'), dyno: !!document.getElementById('fidyno'), note: ((document.getElementById('fimapn') || {}).textContent || '').slice(0, 220), warn: [...el.querySelectorAll('.warn')].map(w => w.textContent.slice(0, 80)) }; }, [id, eng]));
    if (process.env.SHOTS) { await pg.evaluate(() => document.querySelectorAll('canvas').forEach(cv => { if (!cv.closest('#englab')) cv.style.visibility = 'hidden'; })); await pg.screenshot({ path: (process.env.OUT || '.') + '/boost_' + id.slice(0, 12) + '.png', fullPage: false }); }
  }
  // 5. buy a kit through the screen, change the turbo, see it take
  log(await ev(() => { const M = window.__map, c = M.newCar('dodge_charger_scat_pack_2015'); M.S.car = c; M.S.cash = 1e7; c.eb = { pistons: 'boost', inj: 'i80', pump: 'p450' }; M.FI.fiOpen(); const el = document.getElementById('englab'), k = el.querySelector('[data-kit="turbo1"]'); k.click();
    const R1 = M.engOf(c); el.querySelector('[data-ind="72"]').click(); const R2 = M.engOf(c); el.querySelector('[data-bc]').click();
    return { test: 'buy + tune', power: c.eb.power, fi: c.eb.fi, hp1: Math.round(R1.hp), hp72: Math.round(R2.hp), ind: R2.fiH.ind, target: R2.fiH.target, slider: !!el.querySelector('[data-tg]') }; }));
  console.log('ERR', JSON.stringify(errs));
  await b.close();
})();
