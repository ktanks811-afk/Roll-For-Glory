// Dyno cell tests (2026-11-26), headless Chromium via Playwright. No web server: a route serves the repo.
// S = a folder with npm/node_modules/three (three@0.128.0). OUT = folder for screenshots (optional). PORTRAIT=1 phone portrait.
// CARS = comma list of car ids to pull (default: Hellcat Widebody, M5 G90 (turbo AWD), Stinger GT2, Copperhead (manual)).
// Each car: open the cell, a pull in the 1:1 gear, a back-to-back pull (heat soak reads lower), fans, a pull in a low gear
// (reads lower), then the sheets are on the car. Then: nitrous on the dyno, the bay's Dyno row, the Engine Lab's Dyno sheets tab.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), S = process.env.S, OUT = process.env.OUT, PORTRAIT = !!process.env.PORTRAIT;
const CARS = (process.env.CARS || 'dodge_charger_srt_hellcat_widebody_2020,bmw_m5_g90_2025,kia_stinger_gt2_2022,dodge_copperhead_1997').split(',');
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', mp3: 'audio/mpeg', css: 'text/css', webmanifest: 'application/json', svg: 'image/svg+xml', glb: 'model/gltf-binary', m4a: 'audio/mp4' };
const log = o => console.log(JSON.stringify(o));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const ctx = await b.newContext({ viewport: PORTRAIT ? { width: 390, height: 844 } : { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF || 1) });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, r => { const p = r.request().url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await ctx.route(/^http:\/\/localhost:8766\/(.*)$/, r => { const u = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, ''), f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' }); });
  const errs = [];
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(t)) errs.push('console ' + t.slice(0, 300)); if (m.type() === 'warning' && /dyno/i.test(t)) errs.push('warn ' + t.slice(0, 300)); });
  await pg.goto('http://localhost:8766/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const shot = async n => { if (!OUT) return; await ev(() => { let st = document.getElementById('t3dhide'); if (!st) { st = document.createElement('style'); st.id = 't3dhide'; document.head.appendChild(st); } st.textContent = '#toast{display:none!important}'; }); await wait(700); await pg.screenshot({ path: `${OUT}/${PORTRAIT ? 'p-' : ''}${n}.png`, timeout: 240000 }); };
  await ev(() => { const M = window.__map; M.S.cash = 1e6; try { M.closeCreator(); } catch (e) {} });
  const perf = await ev(() => { const p = window.__ks.places().find(q => q.type === 'perf'); return { id: p.id, name: p.name, x: p.x, z: p.z }; });
  log({ shop: perf });
  const pull = async (tag, set) => {
    await ev(set => { const D = window.__dy, DY = D.DY; DY.fast = 30; if (set) Object.assign(DY, set); DY.sp = D.dySpec(window.__map.S.car); D.dyStartPull(); }, set || null);
    let midShot = false;
    for (let k = 0; k < 240; k++) {
      const st = await ev(() => { const DY = window.__dy.DY; return { ph: DY.ph, rpm: Math.round(DY.rpm), sheet: !!DY.sheet }; });
      if (tag && !midShot && st.ph === 'pull' && st.rpm > 0) { const sp = await ev(() => window.__dy.DY.sp.red); if (st.rpm > sp * 0.55) { midShot = true; await shot(tag); } }
      if (st.ph === 'idle' && st.sheet) break; await wait(250);
    }
    return ev(() => { const DY = window.__dy.DY, s = DY.sheet; return s ? { whp: s.whp, sae: Math.round(s.whp * s.cfS), wtq: Math.round(s.wtq * s.cfS), nP: s.nP, g: s.g, crank: s.crank, iat: s.iat, pts: s.pts.length, notes: s.notes, nos: s.nos, nosHp: s.nosHp } : null; });
  };
  const res = {};
  let first = true;
  for (const id of CARS) {
    await ev(id => { const M = window.__map; M.S.car = M.newCar(id); M.S.car.fuel = 100; M.foot.on = false; }, id);
    const ok = await ev(id => window.__dy.dyOpen(window.__ks.places().find(q => q.id === id)), perf.id);
    for (let k = 0; k < 80; k++) { const ph = await ev(() => window.__dy.DY.ph); if (ph === 'idle') break; await wait(500); }
    const info = await ev(() => { const DY = window.__dy.DY, sp = DY.sp; return { model: !!DY.model, g1: sp.g1 + 1, gears: sp.ratios.length, drive: sp.V.drive, tt: sp.V.tt, red: sp.red, nS: sp.nS, amb: DY.amb, Pd: DY.Pd, front: DY.front && DY.front.visible, rootRot: DY.root.rotation.y }; });
    if (first) { await wait(1500); await shot('01-cell'); }
    const p1 = await pull(first ? '02-pull' : null, first && OUT ? { fast: 3 } : null);
    if (first) { await ev(() => { window.__dy.DY.autoCam = true; window.__dy.DY.shot = 'screen'; }); await wait(2500); await shot('03-monitor'); await ev(() => { window.__dy.DY.shot = 'quarter'; }); await wait(2500); await shot('04-sheet'); }
    const p2 = await pull(null, { fan: false });
    await ev(() => { const DY = window.__dy.DY; DY.fan = true; DY.iat = DY.amb + 1; DY.clt = 90; });
    const g = await ev(() => Math.max(1, window.__dy.DY.sp.g1 - 2));
    const p3 = await pull(null, { gear: g, fan: true });
    await ev(() => { window.__dy.DY.gear = -1; });
    const saved = await ev(() => (window.__map.S.car.dyn || []).length);
    res[id] = { ok, info, p1, p2: p2 && p2.sae, p2i: p2 && p2.iat, p3: p3 && { sae: p3.sae, g: p3.g }, saved };
    log({ car: id, ok, info, p1, p2: p2 && { sae: p2.sae, iat: p2.iat }, p3: p3 && { sae: p3.sae, g: p3.g }, saved });
    if (first && OUT) { await ev(() => { window.__dy.DY.shot = 'wheel'; window.__dy.DY.autoCam = false; }); await wait(2500); await shot('05-drums'); await ev(() => { window.__dy.DY.shot = 'rear'; }); await wait(2500); await shot('06-rear'); }
    await ev(() => window.__dy.dyClose(true)); await wait(800);
    first = false;
  }
  // nitrous on the dyno
  const nos = await (async () => {
    await ev(() => { const M = window.__map; M.S.car = M.newCar('dodge_charger_scat_pack_2015'); M.S.car.fuel = 100; M.S.car.nx = { kit: 'wet', s1: 100, add: {}, set: {} }; M.S.car.nosLb = 10; }, null);
    await ev(id => window.__dy.dyOpen(window.__ks.places().find(q => q.id === id)), perf.id);
    for (let k = 0; k < 80; k++) { const ph = await ev(() => window.__dy.DY.ph); if (ph === 'idle') break; await wait(500); }
    const hasKit = await ev(() => !!window.__dy.DY.sp.X);
    const dry = await pull(null, { nos: false });
    await ev(() => { const DY = window.__dy.DY; DY.iat = DY.amb + 1; });
    const wet = await pull(null, { nos: true, fan: true });
    const lb = await ev(() => window.__map.S.car.nosLb);
    if (OUT) { await ev(() => { window.__dy.DY.shot = 'screen'; }); await wait(2500); await shot('07-nitrous-sheet'); }
    await ev(() => window.__dy.dyClose(true)); await wait(500);
    return { hasKit, dry: dry && dry.sae, wet: wet && wet.sae, nosHp: wet && wet.nosHp, lb };
  })();
  log({ nos });
  // the Engine Lab's Dyno sheets tab
  // put the first car's sheets back on a car to look at the tab
  const tab = await ev(() => { const M = window.__map; M.ELAB.elOpen('dyno'); const el = document.getElementById('englab'); return { shown: !el.hidden, txt: el.textContent.slice(0, 160), tabs: [...el.querySelectorAll('.eltabs button')].map(b => b.textContent) }; });
  await wait(800);
  log({ tab });
  // a car with pulls: the Scat Pack from the nitrous test
  await ev(() => { const M = window.__map; const el = document.getElementById('englab'); if (el) el.hidden = true; }, null);
  // the bay: a perf shop's drive-in bay has the Dyno row, it opens the cell and comes back to the bay
  const bay = await (async () => {
    await ev(() => { const M = window.__map; M.S.car = M.newCar('dodge_charger_srt_hellcat_widebody_2020'); M.S.car.fuel = 100; M.foot.on = false; }, null);
    await ev(p => window.__map.startDrive(p.x, p.z), perf); await wait(5000);
    for (let k = 0; k < 30; k++) { const ok = await ev(() => { const M = window.__map; if (M.foot.on && M.getIn) M.getIn(); const o = M.carObj && M.carObj(); return !!(o && o.userData.model); }); if (ok) break; await wait(1000); }
    const opened = await ev(id => window.__ks.ksOpen(window.__ks.places().find(q => q.id === id)), perf.id);
    await ev(() => window.__ks.ksSkip()); await wait(1500);
    const row = await ev(() => { const K = window.__ks, i = K.KS.rows.findIndex(r => r.t === 'Dyno cell'); if (i < 0) return -1; K.ksSelect(i); K.ksActivate(); return i; });
    await wait(1500);
    const inDy = await ev(() => window.__dy.DY.on);
    for (let k = 0; k < 40; k++) { const ph = await ev(() => window.__dy.DY.ph); if (ph === 'idle') break; await wait(500); }
    if (OUT) await shot('08-from-bay');
    await ev(() => window.__dy.dyClose(true)); await wait(1500);
    const back = await ev(() => ({ ks: window.__ks.KS.on, cls: document.body.classList.contains('ks-on'), dy: document.body.classList.contains('dy-on') }));
    if (OUT) await shot('09-back-in-bay');
    // the Engine Lab tab with this car's pulls
    await ev(() => { const DY = window.__dy.DY; }, null);
    return { opened, row, inDy, back };
  })();
  log({ bay });
  // sheets tab on a car with pulls
  await ev(() => window.__ks.ksLeave()); await wait(500);
  // the Dyno sheets tab with real pulls on it
  const tab2 = await (async () => {
    // pull twice on the bay car so the tab has curves to overlay
    await ev(id => window.__dy.dyOpen(window.__ks.places().find(q => q.id === id)), perf.id);
    for (let k = 0; k < 80; k++) { const ph = await ev(() => window.__dy.DY.ph); if (ph === 'idle') break; await wait(500); }
    await pull(null); await ev(() => { const DY = window.__dy.DY; DY.iat = DY.amb; }); await pull(null, { gear: 3 });
    await ev(() => window.__dy.dyClose(true)); await wait(500);
    const r = await ev(() => { const M = window.__map; M.ELAB.elOpen('dyno'); const el = document.getElementById('englab'); el.querySelectorAll('[data-dys]')[1] && el.querySelectorAll('[data-dys]')[1].click(); return { rows: el.querySelectorAll('[data-dys]').length, canvas: !!el.querySelector('#dyscv') }; });
    await wait(800); if (OUT) await shot('10-engine-lab-sheets');
    await ev(() => { const el = document.getElementById('englab'); const x = el.querySelector('[data-x]'); if (x) x.click(); });
    return r;
  })();
  log({ tab2 });
  // ECU map slots: two maps, switch between them, valet locks it down
  const em = await ev(() => { const M = window.__map, E = window.__em, c = M.S.car = M.newCar('dodge_charger_srt_hellcat_widebody_2020'); c.tparts = (c.tparts || []).concat('ecu');
    M.ELAB.elOpen('ecu'); const el = document.getElementById('englab'), slots = el.querySelectorAll('[data-em]').length;
    const m = E.emOf(c); E.emSwitch(c, 1); c.eb.ecu.tm = c.eb.ecu.tm.map(() => 2); c.eb.ecu.rev = 6600; E.emSync(c);
    E.emSwitch(c, 0); const a = { tm: c.eb.ecu.tm[3], rev: c.eb.ecu.rev }; E.emSwitch(c, 1); const b = { tm: c.eb.ecu.tm[3], rev: c.eb.ecu.rev };
    E.emSwitch(c, 'v'); const v = { rev: c.eb.ecu.rev, ped: c.eb.ecu.ped, valet: m.valet }; E.emSwitch(c, 1); const back = { tm: c.eb.ecu.tm[3], rev: c.eb.ecu.rev, valet: m.valet };
    M.ELAB.elOpen('ecu'); const txt = document.getElementById('englab').textContent.includes('Strip map is live'); const x = document.querySelector('#englab [data-x]'); if (x) x.click();
    return { slots, a, b, v, back, txt }; });
  log({ em });
  const H = res[CARS[0]];
  const checks = {
    allOpened: Object.values(res).every(r => r.ok && r.info.model),
    sane: Object.values(res).every(r => r.p1 && r.p1.sae > r.p1.crank * 0.6 && r.p1.sae < r.p1.crank * 0.98 && r.p1.pts > 20),
    heatSoak: Object.values(res).every(r => r.p2i < r.p1.iat + 3 || r.p2 <= r.p1.sae),   // (screenshots give the fans time to cool it)
    lowGearLower: Object.values(res).every(r => !r.p3 || r.p3.sae <= r.p1.sae),
    saved: Object.values(res).every(r => r.saved >= 3),
    nitrous: nos.hasKit && nos.wet > nos.dry + 40 && nos.lb < 10,
    tab: tab.shown && tab.tabs.includes('Dyno sheets'),
    bay: bay.opened && bay.row >= 0 && bay.inDy && bay.back.ks && bay.back.cls && !bay.back.dy,
    tab2: tab2.rows >= 2 && tab2.canvas,
    ecuMaps: em.slots === 4 && em.a.tm === 0 && em.b.tm === 2 && em.b.rev === 6600 && em.v.rev <= 3500 && em.v.valet && em.back.tm === 2 && !em.back.valet && em.txt,
    noErr: !errs.length };
  log(checks);
  const ok = Object.values(checks).every(Boolean);
  console.log(ok ? 'PASS' : 'FAIL', 'ERR', errs.join('\n').slice(0, 3000) || 'none');
  await b.close(); process.exit(ok ? 0 : 1);
})();
