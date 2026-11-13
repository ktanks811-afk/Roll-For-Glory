// Aftermarket parts, pass 1 (2026-11-13). Headless Chromium on the real game. Serve the repo on PORT (default 8791) and set S to a
// folder holding npm/node_modules/three (three@0.128.0). OUT=dir saves screenshots, PORTRAIT=1 runs at phone size, CAR= picks the car.
// Pulls into a custom bay, opens Aero & body parts, previews and buys parts through the menu, checks the requirement rule, the
// finishes, the shelf (free refit), the build sheet, the sim (weight, drag, downforce), the online build round trip, that a wing
// opens with the trunk lid, that the parts are on the street car after driving out, and that every car's catalog fits its body.
const { chromium } = require('playwright');
const PORT = process.env.PORT || 8791, S = process.env.S, OUT = process.env.OUT, PORT_ = !!process.env.PORTRAIT;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: PORT_ ? { width: 390, height: 844 } : { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if ((m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) || /^part |^parts/.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await pg.goto(`http://localhost:${PORT}/index.html?test=1`);
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms), shot = async n => { if (OUT) await pg.screenshot({ path: `${OUT}/${PORT_ ? 'p-' : ''}${n}.png` }); };
  const CAR = process.env.CAR || 'bmw_m5_g90_2025';
  await ev(car => { const M = window.__map, K = window.__ks; try { M.closeCreator(); } catch (e) {} M.S.car = M.newCar(car); M.S.car.color = '#c9ced6'; M.S.car.fuel = 100; M.S.cash = 500000; M.foot.on = false;
    const p = K.places().find(q => q.type === 'visual'); M.startDrive(p.x, p.z); window.__p = p; }, CAR);
  await wait(10000);
  const base = await ev(() => { const X = window.__px, c = window.__map.S.car, V = X.veh(c); return { m: V.m, cdA: V.cdA, clF: V.clF, clR: V.clR, kg: X.kg(c) }; });
  const opened = await ev(() => window.__ks.ksOpen(window.__p));
  await pg.waitForFunction(() => window.__ks.KS.model, null, { timeout: 120000, polling: 500 });
  await ev(() => window.__ks.ksSkip()); await wait(2500);
  const nav = async (title, n) => { const ok = await ev(t => { const K = window.__ks, i = K.KS.rows.findIndex(r => r.t.includes(t)); if (i < 0) return false; K.ksSelect(i); K.ksActivate(); return true; }, title); await wait(n || 1500); return ok; };
  const sel = async (title, n) => { const r = await ev(t => { const K = window.__ks, i = K.KS.rows.findIndex(r => r.t.includes(t)); if (i < 0) return null; K.ksSelect(i); const R = K.KS.rows[i]; return { t: R.t, s: R.s, price: R.price, on: !!R.on, off: !!R.off, prev: K.KS.P.px, meshes: (K.KS.model.userData.pxM || []).length }; }, title); await wait(n || 2600); return r; };
  const buy = async () => { await ev(() => window.__ks.ksActivate()); await wait(700); return ev(() => ({ px: window.__map.S.car.px, cash: window.__map.S.cash })); };
  const R = {};
  R.home = await nav('Aero & body parts'); await shot('01-parts-menu');
  R.slots = await ev(() => window.__ks.KS.rows.map(r => r.t));
  // canards: the double set needs a splitter first
  await nav('Canards'); R.needs = await sel('double canards', 400); await ev(() => window.__ks.ksBack()); await wait(400);
  // splitter: preview, back out without buying, then buy the race splitter in gloss carbon
  await nav('Front splitter'); R.pv = await sel('race splitter'); await shot('02-splitter-preview');
  await ev(() => window.__ks.ksBack()); await wait(900); R.afterBack = await ev(() => ({ px: window.__map.S.car.px || null, meshes: (window.__ks.KS.model.userData.pxM || []).length }));
  await nav('Front splitter'); await nav('Finish'); await sel('Gloss carbon', 1800); await shot('03-finish-carbon'); await ev(() => window.__ks.ksActivate()); await wait(700);
  const c0 = await ev(() => window.__map.S.cash); R.pick = await sel('race splitter', 600); R.b1 = await buy(); R.paid = c0 - R.b1.cash;
  await ev(() => window.__ks.ksBack()); await wait(400);
  await nav('Canards'); R.needs2 = await sel('double canards'); await shot('04-canards'); await buy(); await ev(() => window.__ks.ksBack()); await wait(400);
  await nav('Side skirts'); await sel('skirt blades'); await shot('05-skirts'); await buy(); await ev(() => window.__ks.ksBack()); await wait(400);
  await nav('Rear diffuser'); await sel('track diffuser'); await shot('06-diffuser'); await buy(); await ev(() => window.__ks.ksBack()); await wait(400);
  await nav('Spoiler & wing'); await sel('ducktail'); await shot('07-ducktail-preview'); await sel('GT wing'); await shot('08-gt-wing'); R.wing = await buy();
  // the wing stands on the trunk lid: open the lid and it goes up with it
  R.lid = await ev(() => { const K = window.__ks.KS, m = K.model, U = m.userData, w = U.pxM.find(o => o.userData.px === 'spo'), name = Object.keys(U.panels).find(n => U.panels[n].g === w.parent); window.__map.setPanels(m, 'trunk', true); return { host: name || '' }; });
  await wait(2500); await shot('09-wing-opens-with-lid'); await ev(() => window.__map.setPanels(window.__ks.KS.model, 'trunk', false)); await wait(1200);
  await ev(() => window.__ks.ksBack()); await wait(400);
  if (await nav('Hood scoop')) { await sel('louvers'); await shot('10-hood'); await buy(); await ev(() => window.__ks.ksBack()); await wait(400); }
  // take the splitter off: the canards that need it come off too, and both sit on the shelf (free to refit)
  await nav('Front splitter'); await sel('Take it off', 500); R.off = await buy(); R.shelf = await sel('race splitter', 500); const c1 = await ev(() => window.__map.S.cash); R.refit = await buy(); R.refitCost = c1 - R.refit.cash;
  await ev(() => window.__ks.ksBack()); await wait(400);
  await nav('Build sheet', 1800); await shot('11-build-sheet'); R.sheet = await ev(() => ({ sub: window.__ks.KS.page.sub, rows: window.__ks.KS.rows.map(r => r.t) }));
  await ev(() => { const K = window.__ks; K.ksBack(); K.ksBack(); }); await wait(2500); await shot('12-built');
  // the sim and the online build
  R.sim = await ev(() => { const X = window.__px, c = window.__map.S.car, V = X.veh(c), s = X.pxSum(c); return { m: V.m, cdA: V.cdA, clF: V.clF, clR: V.clR, kg: X.kg(c), sum: s }; });
  R.net = await ev(() => { const X = window.__px, b = X.myBuild(), o = X.cleanBuild(JSON.parse(JSON.stringify(b))), bad = X.cleanBuild({ x: [['zz-spl-rc', 'cg'], ['m5g90-xxx-1', 'cg'], ['m5g90-spl-rc', 'nope'], 7] }); return { sent: b.x, got: o.px, same: X.pxKey(o) === X.pxKey(window.__map.S.car), bad: bad.px || null }; });
  // drive out: the parts are on the street car and in the save
  await ev(() => window.__ks.ksLeave()); await pg.waitForFunction(() => !window.__ks.KS.on, null, { timeout: 30000, polling: 200 }); await wait(4000); await shot('13-street');
  R.street = await ev(() => { const M = window.__map, m = M.car && M.car.userData.model; return { meshes: m ? (m.userData.pxM || []).length : -1, saved: Object.keys((JSON.parse(JSON.stringify(M.S)).car || {}).px || {}).length }; });
  // every car: its whole catalog generates against its own body (a part that can't fit is not offered)
  R.all = await ev(async () => { const X = window.__px, M = window.__map, out = {}; const ids = ['bmw_m5_g90_2025', 'kia_stinger_gt2_2022', 'dodge_charger_srt_hellcat_widebody_2020', 'dodge_charger_scat_pack_2015', 'chevrolet_camaro_ss_2016', 'ford_mustang_gt_2019', 'dodge_challenger_rt_scat_pack_widebody_2019', 'chevrolet_corvette_stingray_c8_2020', 'chevrolet_corvette_z06_c7_2019', 'dodge_copperhead_1997', 'chevrolet_nova_1972', 'chevrolet_caprice_classic_box_chevy_1986', 'jeep_grand_cherokee_trackhawk_2018', 'mercedes_maybach_gls600_2021', 'chevrolet_tahoe_2021', 'mercedes_amg_g63_2019', 'ford_f_150_regular_cab_2021', 'ram_1500_trx_2021'];
    for (const id of ids) { await X.carData(id); const cat = X.pxCatalog(id); let fit = 0, tris = 0; const no = []; for (const P of cat) { const G = X.pxBuild(id, P); if (G) { fit++; tris += G.reduce((s, q) => s + q.geo.attributes.position.count / 3, 0); } else no.push(P.id); } out[id] = [cat.length, fit, Math.round(tris / Math.max(1, fit)), no.join(',')]; }
    return out; });
  console.log(JSON.stringify(R).slice(0, 5000)); console.log('base', JSON.stringify(base));
  const tot = Object.values(R.all).reduce((s, v) => [s[0] + v[0], s[1] + v[1]], [0, 0]); console.log('catalog', tot[0], 'parts,', tot[1], 'fit');
  const ok = opened && R.home && R.needs && R.needs.off && /Needs a front splitter/.test(R.needs.s) && R.pv && R.pv.meshes > 0 && !R.afterBack.px && R.afterBack.meshes === 0 && R.b1.px.spl[1] === 'cg' && R.paid > 0 && !R.needs2.off
    && R.wing.px.spo && R.lid.host === 'trunk' && !R.off.px.spl && !R.off.px.can && R.shelf.price === 0 && R.refitCost === 0 && R.refit.px.spl && R.sheet.rows.length >= 4
    && R.sim.kg > base.kg && R.sim.m > base.m && R.sim.cdA > base.cdA && R.sim.clR < base.clR - 0.1 && R.sim.clF < base.clF && R.net.same && Object.keys(R.net.bad || {}).join() === 'spl' && R.street.meshes > 0 && R.street.saved >= 4 && tot[1] >= tot[0] - 2 && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL', 'ERR', errs.join('\n').slice(0, 2000) || 'none'); await b.close(); process.exit(ok ? 0 : 1);
})();
