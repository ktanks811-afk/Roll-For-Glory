// Aftermarket parts, passes 1-4 (2026-11-13). Headless Chromium on the real game. Serve the repo on PORT (default 8791) and set S to a
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
  const sel = async (title, n) => { const r = await ev(t => { const K = window.__ks, i = K.KS.rows.findIndex(r => r.t.includes(t)); if (i < 0) return null; K.ksSelect(i); const R = K.KS.rows[i]; return { t: R.t, s: R.s, price: R.price, on: !!R.on, off: !!R.off, prev: K.KS.P.px, meshes: (K.KS.model.userData.pxM || []).filter(o => o.userData.px !== 'exh' && o.userData.px !== 'drv').length }; }, title); await wait(n || 2600); return r; };
  const buy = async () => { await ev(() => window.__ks.ksActivate()); await wait(700); return ev(() => ({ px: window.__map.S.car.px, cash: window.__map.S.cash })); };
  const R = {};
  R.home = await nav('Aero & body parts'); await shot('01-parts-menu');
  R.slots = await ev(() => window.__ks.KS.rows.map(r => r.t));
  // canards: the double set needs a splitter first
  await nav('Canards'); R.needs = await sel('double canards', 400); await ev(() => window.__ks.ksBack()); await wait(400);
  // splitter: preview, back out without buying, then buy the race splitter in gloss carbon
  await nav('Front splitter'); R.pv = await sel('race splitter'); await shot('02-splitter-preview');
  await ev(() => window.__ks.ksBack()); await wait(900); R.afterBack = await ev(() => ({ px: window.__map.S.car.px || null, meshes: (window.__ks.KS.model.userData.pxM || []).filter(o => o.userData.px !== 'exh' && o.userData.px !== 'drv').length }));
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
  // exhaust & underside: the car goes up on the lift and shows the system the engine build has; change the build and it changes
  await nav('Exhaust & underside', 3500); await shot('14-lift-stock');
  R.ex0 = await ev(() => { const K = window.__ks.KS, m = K.model; return { lift: K.lift > 1, key: window.__px.pxExOf(window.__map.S.car, true), tris: m.userData.pxM.filter(o => o.userData.px === 'exh').reduce((s, o) => s + o.geometry.attributes.position.count / 3, 0) }; });
  await ev(() => { const c = window.__map.S.car; c.eb = Object.assign({}, c.eb, { hdr: 'longtube', cats: 'hfc', exh: 'xpipe' }); }); await wait(2500); await shot('15-lift-xpipe');
  R.ex1 = await ev(() => { const X = window.__px, K = window.__ks.KS, m = K.model, b = X.myBuild(), o = X.cleanBuild(JSON.parse(JSON.stringify(b))); return { key: X.pxExOf(window.__map.S.car), sent: b.q, got: (o.exq || []).join('|'), bad: X.cleanBuild({ q: 'longtube|hfc|rm -rf|1' }).exq || null, tris: m.userData.pxM.filter(o => o.userData.px === 'exh').reduce((s, o) => s + o.geometry.attributes.position.count / 3, 0) }; });
  await ev(() => { window.__ks.ksBack(); window.__ks.ksSelect(0); }); await wait(2500); R.down = await ev(() => window.__ks.KS.lift < 0.2);
  // brakes: the brake part on the car is real hardware behind the wheel. Preview a kit, buy it, paint it, and check the caliper
  // holds still while the wheel turns, that the kit is sized to the wheel, that it rides the online build and the sim
  await nav('Brakes', 2500); await shot('16-brakes-menu');
  R.bk0 = await ev(() => { const K = window.__ks, U = K.KS.model.userData; return { rows: K.KS.rows.length, g: U.wheels.map(w => (w.userData.pxbG || []).length).join('') }; });
  await sel('GT Big Brake Kit', 2200); await shot('17-brakes-preview');
  R.bkPv = await ev(() => { const U = window.__ks.KS.model.userData; return { g: U.wheels.map(w => (w.userData.pxbG || []).length).join(''), fit: U.pxbFit, bought: (window.__map.S.car.parts || {}).brakes || null, stockCal: (U.pxbCal || []).some(o => o.visible) }; });
  { const cb = await ev(() => window.__map.S.cash); await ev(() => window.__ks.ksActivate()); await wait(1200); R.bkBuy = await ev(() => ({ id: (window.__map.S.car.parts || {}).brakes || null, cash: window.__map.S.cash })); R.bkPaid = cb - R.bkBuy.cash; }
  R.bkSpin = await ev(() => { const m = window.__ks.KS.model, U = m.userData, w = U.wheels.slice().sort((a, b) => b.position.x - a.position.x)[0], G = w.userData.pxbG || [], rot = G[0], hub = G[1]; if (!hub) return null;
    const rd = o => { m.updateMatrixWorld(true); return Array.from(o.matrixWorld.elements); }, df = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    const z0 = w.rotation.z, y0 = w.rotation.y, h0 = rd(hub), r0 = rd(rot); w.rotation.z = z0 + 1.3; const h1 = rd(hub), r1 = rd(rot); w.rotation.y = y0 + 0.4; const h2 = rd(hub); w.rotation.z = z0; w.rotation.y = y0; m.updateMatrixWorld(true);
    return { hubSpin: df(h0, h1), rotorSpin: df(r0, r1), hubSteer: df(h1, h2) }; });
  await nav('Caliper color', 1200); await sel('Yellow', 1500); await ev(() => window.__ks.ksActivate()); await wait(1200); await shot('18-brakes-yellow');
  R.bkCol = await ev(() => { const X = window.__px, M = window.__map, c = M.S.car, U = window.__ks.KS.model.userData, b = X.myBuild(), o = X.cleanBuild(JSON.parse(JSON.stringify(b))); let hex = ''; (U.wheels[0].userData.pxbG || [])[1].traverse(q => { if (q.isMesh && q.material.clearcoat) hex = q.material.color.clone().convertLinearToSRGB().getHexString(); });
    return { cal: (c.look || {}).cal, hex, sent: b.k, got: o.bk, bad: X.cleanBuild({ k: ['brakes_zz', '#12'] }).bk || null, bT: X.veh(c).brakeTot, bT0: X.veh(Object.assign({}, c, { parts: Object.assign({}, c.parts, { brakes: undefined }) })).brakeTot }; });
  await ev(() => { window.__ks.ksBack(); }); await wait(500); await ev(() => { window.__ks.ksBack(); window.__ks.ksSelect(0); }); await wait(1200);
  // under the hood: the engine build's bolt-ons are plumbed in the car's own bay, stay under the closed hood, and ride the online build
  R.eng0 = await ev(() => (window.__ks.KS.model.userData.pxM || []).filter(o => o.userData.px === 'eng').length);
  await ev(() => { const c = window.__map.S.car; c.eb = Object.assign({}, c.eb, { intake: 'cai', cool: 'up', oil: 'up' }); }); await wait(2500);
  R.engPage = await nav('Under the hood', 3500); await shot('19-under-the-hood');
  R.eng = await ev(() => { const X = window.__px, c = window.__map.S.car, U = window.__ks.KS.model.userData, F = X.pxFit(c.id), M = (U.pxM || []).filter(o => o.userData.px === 'eng'); let tris = 0, over = 0;
    for (const o of M) { const p = o.geometry.attributes.position; tris += p.count / 3; for (let i = 0; i < p.count; i++) { const h = F.at(F.hood, p.getX(i), p.getZ(i)); if (h > 0.3 && p.getY(i) > h) over++; } }
    const b = X.myBuild(), o = X.cleanBuild(JSON.parse(JSON.stringify(b)));
    const all = {}; for (const [k, q] of Object.entries({ tt: { kit: 'turbo', ic: 1 }, t1: { kit: 'turbo1', ic: 1, cai: 1 }, cen: { kit: 'centri', ic: 1 }, ts: { kit: 'twinscrew' }, roots: { kit: 'roots' } })) { const G = X.pxBuild(c.id, { id: 'engT:' + k, gen: X.PXG.engbay, o: q }); all[k] = G ? G.reduce((s, g) => s + g.geo.attributes.position.count / 3, 0) : 0; }
    return { key: X.pxEngOf(c), rows: window.__ks.KS.rows.length, meshes: M.length, tris, over, sent: b.e, got: o.ebq, bad: X.cleanBuild({ e: 'cai|nuke|ic|||' }).ebq || null, all }; });
  await ev(() => { window.__ks.ksBack(); window.__ks.ksSelect(0); }); await wait(1500);
  // drivetrain & suspension: gearbox, propshaft, diff, arms and sway bars hang under the car's own belly (nothing inside the body,
  // nothing dragging on the ground); sway bars and a diff bought here change what is under the car and ride the online build
  R.drvPage = await nav('Drivetrain & suspension', 3500); await shot('20-drivetrain');
  const drvStat = () => ev(() => { const X = window.__px, K = window.__ks.KS, c = window.__map.S.car, U = K.model.userData, F = X.pxFit(c.id), M = (U.pxM || []).filter(o => o.userData.px === 'drv'); let tris = 0, inBody = 0, ymin = 9;
    for (const o of M) { const p = o.geometry.attributes.position; tris += p.count / 3; for (let i = 0; i < p.count; i++) { const v = F.at(F.bot, p.getX(i), p.getZ(i)), y = p.getY(i); if (v < 8 && y > v + 0.035) inBody++; if (y < ymin) ymin = y; } }
    return { lift: K.lift > 1, key: X.pxDrvOf(c, true), shown: (U.pxKey || '').split('%')[1] || '', rows: window.__ks.KS.rows.length, meshes: M.length, tris, inBody, ymin: +ymin.toFixed(3), tp: (c.tparts || []).join(), diff: (c.parts || {}).diff || null, cash: window.__map.S.cash }; });
  R.drv0 = await drvStat();
  await sel('sway bars', 2200); R.drvPv = await drvStat(); await ev(() => window.__ks.ksActivate()); await wait(1500); R.drvSw = await drvStat();
  await nav('Differential', 1500); R.dfRows = await ev(() => window.__ks.KS.rows.length); await ev(() => { window.__ks.ksSelect(1); }); await wait(2200); R.dfPv = await drvStat(); await ev(() => window.__ks.ksActivate()); await wait(1500); await shot('21-diff-swaybars'); R.drvDf = await drvStat();
  R.drvNet = await ev(() => { const X = window.__px, b = X.myBuild(), o = X.cleanBuild(JSON.parse(JSON.stringify(b))); return { sent: b.d, got: o.drq, bad: X.cleanBuild({ d: '0x1' }).drq || null, bad2: X.cleanBuild({ d: '0111' }).drq || null }; });
  await ev(() => { window.__ks.ksBack(); }); await wait(500); await ev(() => { window.__ks.ksBack(); window.__ks.ksSelect(0); }); await wait(2000);
  // interior: a wheel on the car's own column (it turns with the steering, the stock wheel is put away and comes back),
  // a cage bent to the cabin; both weigh what they say and ride the online build
  R.intPage = await nav('Interior parts', 2500); R.intRows = await ev(() => window.__ks.KS.rows.map(r => r.t));
  const intStat = () => ev(() => { const X = window.__px, K = window.__ks.KS, c = window.__map.S.car, U = K.model.userData, sg = U.anim && U.anim.steer ? U.anim.steer.map(s => s.g) : [];
    const mine = (U.pxM || []).filter(o => o.userData.px === 'stw'), cage = (U.pxM || []).filter(o => o.userData.px === 'cag'); let stock = 0, out = 0, top = -9, o1 = 0, o2 = 0, wz = 0; const F = X.pxFit(c.id);
    for (const g of sg) for (const ch of g.children) if (!ch.userData.px && ch.visible) stock++;
    for (const o of cage) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = F.at(F.top, x, z); if (y > top) top = y; const sz = F.sideZ(x, y - 0.04, y + 0.04); if (t > -8 && Math.abs(z) < 0.45 && y > t - 0.02) { out++; o1++; if (Math.abs(z) > wz) wz = Math.abs(z); } if (sz > 0.4 && Math.abs(z) > sz + 0.002) { out++; o2++; } } }
    return { o1, o2, wz: +wz.toFixed(3), top: +top.toFixed(3), px: Object.keys(c.px || {}).join(), stwOn: mine.length, onCol: mine.every(o => sg.includes(o.parent)), stock, cage: cage.length, out, kg: +X.kg(c).toFixed(1), cash: window.__map.S.cash, shot: K.shot, at: !!(window.__ks.KS_SHOTS[K.shot] || {}).at }; });
  R.int0 = await intStat();
  await nav('Steering wheel', 2000); R.stwPv = await sel('flat-bottom', 2600); R.stwPvS = await intStat(); await shot('22-steering-wheel'); await buy(); await wait(1200); R.stw = await intStat();
  R.stwTurn = await ev(() => { const K = window.__ks.KS, U = K.model.userData, o = (U.pxM || []).find(o => o.userData.px === 'stw'), g = o.parent, a = o.position.clone(), b = o.position.clone(), r0 = g.rotation.x; K.model.updateMatrixWorld(true);
    const p = o.geometry.attributes.position; let i = 0, d = 0; for (let k = 0; k < p.count; k++) { const q = Math.hypot(p.getY(k), p.getZ(k)); if (q > d) { d = q; i = k; } } a.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); g.rotation.x = r0 + 0.5; K.model.updateMatrixWorld(true); b.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); g.rotation.x = r0; return +a.distanceTo(b).toFixed(3); }).catch(e => String(e).slice(0, 200));
  await ev(() => window.__ks.ksBack()); await wait(600);
  await nav('Roll bar', 2000); R.cagPv = await sel('6-point', 2600); await shot('23-roll-cage'); await buy(); await wait(1200); R.cag = await intStat();
  R.intNet = await ev(() => { const X = window.__px, b = X.myBuild(), o = X.cleanBuild(JSON.parse(JSON.stringify(b))); return { sent: (b.x || []).map(e => e[0].split('-')[1]).join(), got: Object.keys(o.px || {}).join() }; });
  await ev(() => window.__ks.ksBack()); await wait(600); await nav('Steering wheel', 1500); await nav('Take it off', 1500);
  await ev(() => window.__ks.ksBack()); await wait(1500); R.stwOff = await intStat(); await ev(() => { window.__ks.ksBack(); window.__ks.ksSelect(0); }); await wait(1500);
  // drive out: the parts are on the street car and in the save
  await ev(() => window.__ks.ksLeave()); await pg.waitForFunction(() => !window.__ks.KS.on, null, { timeout: 30000, polling: 200 }); await wait(4000); await shot('13-street');
  R.street = await ev(() => { const M = window.__map, m = M.car && M.car.userData.model; return { bk: m ? m.userData.wheels.map(w => (w.userData.pxbG || []).filter(o => o.parent === w).length).join('') : '', exh: !!m && (m.userData.pxM || []).some(o => o.userData.px === 'exh'), meshes: m ? (m.userData.pxM || []).length : -1, saved: Object.keys((JSON.parse(JSON.stringify(M.S)).car || {}).px || {}).length }; });
  // every car: its whole catalog generates against its own body (a part that can't fit is not offered)
  R.all = await ev(async () => { const X = window.__px, M = window.__map, out = {}; const ids = ['bmw_m5_g90_2025', 'kia_stinger_gt2_2022', 'dodge_charger_srt_hellcat_widebody_2020', 'dodge_charger_scat_pack_2015', 'chevrolet_camaro_ss_2016', 'ford_mustang_gt_2019', 'dodge_challenger_rt_scat_pack_widebody_2019', 'chevrolet_corvette_stingray_c8_2020', 'chevrolet_corvette_z06_c7_2019', 'dodge_copperhead_1997', 'chevrolet_nova_1972', 'chevrolet_caprice_classic_box_chevy_1986', 'jeep_grand_cherokee_trackhawk_2018', 'mercedes_maybach_gls600_2021', 'chevrolet_tahoe_2021', 'mercedes_amg_g63_2019', 'ford_f_150_regular_cab_2021', 'ram_1500_trx_2021'];
    for (const id of ids) { await X.carData(id); const cat = X.pxCatalog(id); let fit = 0, tris = 0; const no = []; for (const P of cat) { const G = X.pxBuild(id, P); if (G) { fit++; tris += G.reduce((s, q) => s + q.geo.attributes.position.count / 3, 0); } else no.push(P.id); } const D = X.pxBuild(id, { id: 'drvT', gen: X.PXG.drive, o: { tr: 1, df: 1, sw: 1 } }), E = X.pxBuild(id, { id: 'exhT', gen: X.PXG.exhaust, o: { hdr: 'longtube', cats: 'hfc', exh: 'xpipe', dual: true } }), F = X.pxFit(id); let dt = 0, deep = 0, low = 9;
      for (const q of D || []) { const p = q.geo.attributes.position; dt += p.count / 3; for (let i = 0; i < p.count; i++) { const v = F.at(F.bot, p.getX(i), p.getZ(i)), y = p.getY(i); if (v < 8 && y > v + 0.035) deep++; if (y < low) low = y; } }
      for (const q of E || []) { const p = q.geo.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < low) low = p.getY(i); }
      out[id] = [cat.length, fit, Math.round(tris / Math.max(1, fit)), no.join(','), dt, deep, +low.toFixed(3)]; }
    return out; });
  console.log(JSON.stringify({ int0: R.int0, stwPvS: R.stwPvS, stw: R.stw, stwTurn: R.stwTurn, cag: R.cag, intNet: R.intNet, stwOff: R.stwOff, drv0: R.drv0, drvPv: R.drvPv, drvSw: R.drvSw, dfPv: R.dfPv, drvDf: R.drvDf, drvNet: R.drvNet, drvAll: Object.fromEntries(Object.entries(R.all).map(([k, v]) => [k.split('_').slice(0, 3).join('_'), v.slice(4)])), eng0: R.eng0, eng: R.eng, bk0: R.bk0, bkPv: R.bkPv, bkBuy: R.bkBuy, bkPaid: R.bkPaid, bkSpin: R.bkSpin, bkCol: R.bkCol, ex0: R.ex0, ex1: R.ex1, down: R.down, street: R.street, sim: R.sim })); console.log('base', JSON.stringify(base));
  const tot = Object.values(R.all).reduce((s, v) => [s[0] + v[0], s[1] + v[1]], [0, 0]); console.log('catalog', tot[0], 'parts,', tot[1], 'fit');
  const ok = opened && R.home && R.needs && R.needs.off && /Needs a front splitter/.test(R.needs.s) && R.pv && R.pv.meshes > 0 && !R.afterBack.px && R.afterBack.meshes === 0 && R.b1.px.spl[1] === 'cg' && R.paid > 0 && !R.needs2.off
    && R.wing.px.spo && R.lid.host === 'trunk' && !R.off.px.spl && !R.off.px.can && R.shelf.price === 0 && R.refitCost === 0 && R.refit.px.spl && R.sheet.rows.length >= 4
    && R.sim.kg > base.kg && R.sim.m > base.m && R.sim.cdA > base.cdA && R.sim.clR < base.clR - 0.1 && R.sim.clF < base.clF && R.net.same && Object.keys(R.net.bad || {}).join() === 'spl' && R.ex0.lift && R.ex0.tris > 500 && R.ex1.key && R.ex1.sent === R.ex1.key && R.ex1.got === R.ex1.key && !R.ex1.bad && R.ex1.tris !== R.ex0.tris && R.down && R.bk0.rows >= 8 && R.bk0.g === '0000' && R.bkPv.g === '2222' && !R.bkPv.bought && !R.bkPv.stockCal && R.bkPv.fit.f <= 380 && R.bkPv.fit.f >= 300 && R.bkBuy.id === 'brakes_7h' && R.bkPaid > 4000
    && R.bkSpin && R.bkSpin.hubSpin < 1e-5 && R.bkSpin.rotorSpin > 0.01 && R.bkSpin.hubSteer > 0.01 && R.bkCol.cal === '#e0b012' && R.bkCol.hex === 'e0b012' && R.bkCol.sent && R.bkCol.got && R.bkCol.got.join() === 'brakes_7h,#e0b012' && !R.bkCol.bad && R.bkCol.bT > R.bkCol.bT0 * 1.2 && R.eng0 === 0 && R.engPage && R.eng.key === 'cai|||rad|oil|' && R.eng.rows >= 6 && R.eng.meshes >= 3 && R.eng.tris > 800 && R.eng.over === 0 && R.eng.sent === R.eng.key && R.eng.got === R.eng.key && !R.eng.bad && Object.values(R.eng.all).every(n => n > 1000) && R.drvPage && R.drv0.lift && R.drv0.key === '000' && R.drv0.rows >= 3 && R.drv0.meshes >= 3 && R.drv0.tris > 1500 && R.drv0.inBody === 0 && R.drv0.ymin > 0.03 && R.drvPv.shown === '001' && !/sway/.test(R.drvPv.tp) && /sway/.test(R.drvSw.tp) && R.drvSw.cash < R.drv0.cash && R.drvSw.key === '001'
    && R.dfRows >= 3 && R.dfPv.shown === '011' && !R.dfPv.diff && R.drvDf.diff && R.drvDf.key === '011' && R.drvDf.cash < R.drvSw.cash && R.drvDf.tris > R.drvSw.tris && R.drvDf.inBody === 0 && R.drvNet.sent === '011' && R.drvNet.got === '011' && !R.drvNet.bad && !R.drvNet.bad2
    && R.intPage && R.intRows.some(t => /Steering wheel/.test(t)) && R.intRows.some(t => /Roll bar/.test(t)) && R.int0.stwOn === 0 && R.int0.stock > 0 && R.stwPvS.stwOn > 0 && R.stwPvS.at && R.stw.stwOn > 0 && R.stw.onCol && R.stw.stock === 0 && R.stw.cash < R.int0.cash && R.stw.kg < R.int0.kg && R.stwTurn > 0.05
    && R.cag.cage > 0 && R.cag.out === 0 && R.cag.kg > R.stw.kg + 20 && /stw/.test(R.intNet.sent) && /cag/.test(R.intNet.sent) && /stw/.test(R.intNet.got) && /cag/.test(R.intNet.got) && R.stwOff.stwOn === 0 && R.stwOff.stock === R.int0.stock && R.stwOff.cage > 0
    && Object.entries(R.all).every(([k, v]) => /tahoe|f_150|trx/.test(k) ? v[4] === 0 : v[4] > 1500 && v[5] === 0 && v[6] > 0.03) && R.street.bk === '2222' && R.street.exh && R.street.meshes > 0 && R.street.saved >= 4 && tot[1] >= tot[0] - 2 && !errs.length;
  if (!ok) { const D = Object.assign({}, R); delete D.all; console.log('detail', JSON.stringify(D), 'opened', opened); }
  console.log(ok ? 'PASS' : 'FAIL', 'ERR', errs.join('\n').slice(0, 2000) || 'none'); await b.close(); process.exit(ok ? 0 : 1);
})();
