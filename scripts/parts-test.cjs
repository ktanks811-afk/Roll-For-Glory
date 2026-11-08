// Phase 5A parts catalog + launch control button tests (headless Chromium, Playwright, the real engine model and car physics).
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// BASE=path/to/old/index.html also loads that build and checks factory cars make the same power and ETs on both.
// Prints one JSON line per check; ERR lists page errors. SHOTS=1 OUT=dir saves the catalog screen.
const { chromium } = require('playwright');
const S = process.env.S;
const C8 = 'chevrolet_corvette_stingray_c8_2020', SCAT = 'dodge_charger_scat_pack_2015', HELL = 'dodge_charger_srt_hellcat_widebody_2020', MUS = 'ford_mustang_gt_2019';
const log = o => console.log(JSON.stringify(o));
async function page(b, base) {
  const pg = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: process.env.SHOTS ? 2 : 1 });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},single(){return Promise.resolve({data:null})},upsert(){return Promise.resolve({})}}),auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){}}})', contentType: 'application/javascript' }));
  if (base) await pg.route(/\/index\.html/, r => r.fulfill({ path: base, contentType: 'text/html' }));
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  await pg.evaluate(() => { const M = window.__map; M.S.cash = 1e7; try { M.closeCreator(); } catch (e) {} });
  return { pg, errs, ev: (f, a) => pg.evaluate(f, a) };
}
// factory power, redline and a quarter mile on the drag pull
const factory = ids => { const M = window.__map, out = {}; for (const id of ids) { const c = M.newCar(id); c.fuel = 100; M.S.car = c; const R = M.engOf(c), r = M.tuneRun(c, c.tune || {}); out[id.slice(0, 26)] = `${Math.round(R.hp)} hp ${Math.round(R.tq / 1.3558)} lb-ft red ${R.red} · 60 ${(r.t60 || r.z60 || 0).toFixed ? (r.t60 || r.z60 || 0).toFixed(2) : r.t60} · ¼ ${(r.et || r.qt || 0).toFixed ? (r.et || r.qt || 0).toFixed(2) : r.et} @ ${Math.round(r.trap || r.mph || 0)}`; } return out; };

(async () => {
  const b = await chromium.launch();
  const A = await page(b), ev = A.ev;
  await ev(() => {
    const M = window.__map, K = M.PCAT;
    window.__car = (id, eb) => { const c = M.newCar(id); c.fuel = 100; c.eb = Object.assign({}, eb || {}); M.S.car = c; return c; };
    // install catalog part ids on a build (base + sku), the way pcBuy does
    window.__put = (c, ids) => { const eb = Object.assign({}, c.eb); for (const id of ids) { const s = K.PC_BY.get(id); if (!s) throw new Error('no part ' + id); eb[s.cat] = s.base; eb.sku = Object.assign({}, eb.sku, { [s.cat]: s.id }); if (s.cat === 'power') delete eb.fi; } c.eb = eb; return c; };
    window.__find = (cat, f) => K.PC.filter(s => s.cat === cat && f(s));
    window.__R = c => { const R = M.engOf(c); return `${Math.round(R.hp)} hp ${Math.round(R.tq / 1.3558)} lb-ft peak ${R.nP} red ${R.red}${R.psi ? ' ' + R.psi.toFixed(1) + ' psi' : ''} fuel cap ${Math.round(R.X ? R.X.fuelHp : 0)} hp${R.warn && R.warn.length ? ' ⚠ ' + R.warn[0].slice(0, 60) : ''}`; };
  });

  // 1. how many parts, per category, and how many brands
  log(await ev(() => { const K = window.__map.PCAT, out = { test: 'catalog size', total: K.PC.length, brands: new Set(K.PC.map(s => s.brand)).size, dupIds: K.PC.length - K.PC_BY.size };
    for (const k of K.ENG_CATS) out[k] = K.PC.filter(s => s.cat === k).length; out.badBase = K.PC.filter(s => !(s.cat === 'cam' ? s.base === 'cat' : K.ENG_PARTS[s.cat] && K.ENG_PARTS[s.cat].opts[s.base])).map(s => s.id).slice(0, 5); return out; }));

  // 2. factory cars: same power and ETs as before the catalog (BASE build)
  const fac = await ev(factory, [SCAT, HELL, MUS]); log(Object.assign({ test: 'factory (this build)' }, fac));
  if (process.env.BASE) { const B = await page(b, process.env.BASE); const f0 = await B.ev(factory, [SCAT, HELL, MUS]); log(Object.assign({ test: 'factory (before the catalog)', same: JSON.stringify(f0) === JSON.stringify(fac) }, f0)); if (B.errs.length) log({ ERR_BASE: B.errs }); await B.pg.close(); }

  // 3. injectors: a turbo kit on the 392 against stock-size and big injectors, then the pump, the regulator
  log(await ev(SCAT => { const out = { test: 'fuel system on a 392 with a turbo kit' }, F = window.__find;
    const kit = F('power', s => s.base === 'turbo' && /Precision|Garrett|Borg/i.test(s.name))[0] || F('power', s => s.base === 'turbo')[0]; out.kit = kit.name;
    const inj = n => F('inj', s => s.o.inj >= n)[0], pump = n => F('pump', s => s.o.pump >= n)[0];
    out['kit only'] = window.__R(window.__put(window.__car(SCAT), [kit.id]));
    for (const n of [80, 120, 220]) { const i = inj(n); out[i.name] = window.__R(window.__put(window.__car(SCAT), [kit.id, i.id])); }
    const p = pump(450), i = inj(120); out['+ ' + p.name] = window.__R(window.__put(window.__car(SCAT), [kit.id, i.id, p.id]));
    const fp = F('fpr', () => true)[0]; out['+ ' + fp.name] = window.__R(window.__put(window.__car(SCAT), [kit.id, i.id, p.id, fp.id]));
    const bp = pump(1000); out['220s + ' + bp.name] = window.__R(window.__put(window.__car(SCAT), [kit.id, inj(220).id, bp.id]));
    out['80s + ' + bp.name] = window.__R(window.__put(window.__car(SCAT), [kit.id, inj(80).id, bp.id]));
    out['80s + ' + bp.name + ' + ' + fp.name] = window.__R(window.__put(window.__car(SCAT), [kit.id, inj(80).id, bp.id, fp.id]));
    out['NA, 220s only'] = window.__R(window.__put(window.__car(SCAT), [inj(220).id]));
    return out; }, SCAT));

  // 4. headers: primary size vs the motor, finish, and what each does to the sound (rasp = higher tone, more dB)
  log(await ev(SCAT => { const M = window.__map, out = { test: 'headers on a 392 (power and sound)' }, F = window.__find;
    const c0 = window.__car(SCAT), a0 = M.eaCfgOf(c0); out.factory = `${window.__R(c0)} · hdr tone ${a0.H.t.toFixed(2)} dB ${a0.H.db.toFixed(1)} f ${a0.H.f}`;
    for (const [br, pr, fin] of [['Kooks', 1.75, 'raw'], ['Kooks', 1.875, 'raw'], ['Kooks', 2, 'raw'], ['Kooks', 1.875, 'cer-blk'], ['Hedman', 1.875, 'raw'], ['Kooks', 1.625, 'raw'], ['Hooker', 1.625, 'raw']]) {
      const s = F('hdr', s => s.brand === br && s.o.prim === pr && s.base === 'longtube' && (fin === 'raw' ? s.name.includes('polished') : s.name.includes('black ceramic')))[0]; if (!s) { out[`${br} ${pr} ${fin}`] = 'missing'; continue; }
      const c = window.__put(window.__car(SCAT), [s.id]), a = M.eaCfgOf(c); out[s.name.slice(0, 60)] = `${window.__R(c)} · tone ${a.H.t.toFixed(2)} dB ${a.H.db.toFixed(1)} f ${a.H.f}`; }
    const sh = F('hdr', s => s.base === 'shorty' && s.brand === 'Kooks')[0], c = window.__put(window.__car(SCAT), [sh.id]); out[sh.name.slice(0, 60)] = `${window.__R(c)} · tone ${M.eaCfgOf(c).H.t.toFixed(2)}`;
    return out; }, SCAT));

  // 5. exhaust brands: each one sounds different (low-pass, gain, drone notch, how open)
  log(await ev(SCAT => { const M = window.__map, out = { test: 'cat-back brands on a 392 (open-valve sound)' }, F = window.__find, seen = new Set();
    const f = c => { const e = M.eaCfgOf(c).ex.open; return `lp ${Math.round(e.lp)} g ${e.g.toFixed(2)} notch ${e.notch} open ${e.o.toFixed(2)} · ${Math.round(M.engOf(c).hp)} hp`; };
    out.factory = f(window.__car(SCAT));
    for (const s of F('exh', s => s.base === 'perf')) { if (seen.has(s.brand) || seen.size >= 8) continue; seen.add(s.brand); out[s.name.slice(0, 50)] = f(window.__put(window.__car(SCAT), [s.id])); }
    const st = F('exh', s => s.base === 'straight')[0]; out[st.name.slice(0, 50)] = f(window.__put(window.__car(SCAT), [st.id]));
    const cat = F('cats', s => s.base === 'off')[0]; out['straight + ' + cat.name.slice(0, 40)] = f(window.__put(window.__car(SCAT), [st.id, cat.id]));
    return out; }, SCAT));

  // 6. valvetrain and bottom end: springs and rods raise the redline, a big cam needs springs
  log(await ev(SCAT => { const out = { test: 'springs, rods, cams, plugs, coils on a 392' }, F = window.__find;
    out.factory = window.__R(window.__car(SCAT));
    const sp = F('springs', () => true).sort((a, b) => b.o.red - a.o.red)[0], ro = F('rods', () => true)[0], cam = F('cam', s => s.o.d > 240)[0] || F('cam', () => true).slice(-1)[0];
    out['+ ' + sp.name] = window.__R(window.__put(window.__car(SCAT), [sp.id]));
    out['+ ' + ro.name] = window.__R(window.__put(window.__car(SCAT), [ro.id]));
    out['cam ' + cam.name] = window.__R(window.__put(window.__car(SCAT), [cam.id]));
    out['cam + springs'] = window.__R(window.__put(window.__car(SCAT), [cam.id, sp.id]));
    const pl = F('plugs', () => true)[0], ig = F('ign', () => true)[0];
    out['+ ' + pl.name + ' (oct)'] = window.__map.engOf(window.__put(window.__car(SCAT), [pl.id])).X.oct + ' vs ' + window.__map.engOf(window.__car(SCAT)).X.oct;
    out['+ ' + ig.name] = window.__R(window.__put(window.__car(SCAT), [ig.id]));
    return out; }, SCAT));

  // 7. drivetrain and cooling: converter stall, clutch capacity, radiator/oil/trans coolers in the damage model
  log(await ev(([SCAT, MUS]) => { const M = window.__map, out = { test: 'converter, clutch, coolers (C8 DCT for the clutch)' }, F = window.__find, K = M.PCAT;
    const V = c => M.vehOf(c, 0);
    const cS = window.__car(SCAT), v0 = V(cS); out['392 auto factory'] = `type ${v0.tt || (v0.tr && v0.tr.type)} stall ${v0.stall || (v0.T && v0.T.stall) || '?'}`;
    const cv = F('conv', s => s.o.stall >= 3500)[0]; const v1 = V(window.__put(window.__car(SCAT), [cv.id])); out['+ ' + cv.name] = `stall ${v1.stall || (v1.T && v1.T.stall) || '?'}`;
    out['fits a manual?'] = K.pcFits(window.__car(MUS), M.engDefOf(M.S.car), K.engBuild(M.S.car, M.engDefOf(M.S.car)), cv) || 'fits';
    const cm = window.__car(MUS), w0 = V(cm); out['C8 factory'] = `type ${w0.tt} clutchCap ${Math.round(w0.clutchCap || (w0.T && w0.T.clutchCap) || 0)}`;
    const cl = F('clutch', s => s.o.clK >= 1.6)[0] || F('clutch', () => true).slice(-1)[0]; const w1 = V(window.__put(window.__car(MUS), [cl.id])); out['+ ' + cl.name] = `clutchCap ${Math.round(w1.clutchCap || (w1.T && w1.T.clutchCap) || 0)}`;
    out.coolers = ['cool', 'oil', 'tcool'].map(k => F(k, () => true).length + ' ' + k).join(', ');
    return out; }, [SCAT, C8]));

  // 8. buy and install from the catalog screen: money, the build, the hp on the car, and the Engine Lab shows it
  log(await ev(SCAT => { const M = window.__map, K = M.PCAT, F = window.__find, out = { test: 'buy & install' };
    const c = window.__car(SCAT); M.S.cash = 50000; const hp0 = M.carHp(c), s = F('hdr', s => s.brand === 'Kooks' && s.o.prim === 1.875 && s.base === 'longtube')[0];
    K.pcOpen('hdr'); K.PCL.sel = s.id; K.pcRender(); out.preview = (document.querySelector('.pcv') || {}).textContent || 'none (not on the first page)';
    K.pcBuy(c, s); out.cash = `${50000} -> ${M.S.cash} (price ${s.price})`; out.build = `hdr ${c.eb.hdr} sku ${c.eb.sku && c.eb.sku.hdr}`; out.hp = `${hp0} -> ${M.carHp(c)}`;
    out.onCar = (document.querySelector('#englab') || {}).textContent.includes('on the car ✓');
    M.S.cash = 10; const c2 = window.__car(SCAT); K.pcBuy(c2, s); out.broke = c2.eb.sku ? 'installed anyway (bad)' : 'refused';
    K.pcOpen('inj'); K.PCL.q = 'Injector Dynamics'; K.pcRender(); out.search = document.querySelectorAll('#englab .pcr').length + ' rows for "Injector Dynamics"';
    K.pcClose(); M.S.cash = 1e7; return out; }, SCAT));

  // 9. the launch control button: armed, floored, the brakes hold it; tap again and it goes
  log(await ev(SCAT => { const M = window.__map, K = M.PCAT, T = M.TIRE, out = { test: 'launch control button' };
    const c = window.__car(SCAT); const P = M.carPerf(); M.physReset(); const d = M.drvS(); d.yaw = 0; d.v = 0; d.steer = 0; const h = 1 / 240;
    K.LCB.arm = false; K.lcbTap(); out.armed = K.LCB.arm;
    let rpm = 0, v = 0; for (let t = 0; t < 2.5; t += h) { M.physStep({ gas: 1, brake: 0, steer: 0, hb: 0, lca: K.LCB.arm }, P, h); const u = Math.max(0, d.v); T.vx = 0; T.vz = -u; T.w = 0; if (T.vd) rpm = T.vd.we * 30 / Math.PI; v = d.v; }
    out.held = `${(v * 2.237).toFixed(1)} mph at ${Math.round(rpm)} rpm after 2.5 s floored`;
    K.lcbTap(); out.armedAfterGo = K.LCB.arm; let x = 0, t60 = 0; for (let t = 0; t < 6; t += h) { M.physStep({ gas: 1, brake: 0, steer: 0, hb: 0, lca: K.LCB.arm }, P, h); const u = Math.max(0, d.v); x += u * h; T.vx = 0; T.vz = -u; T.w = 0; if (!t60 && x >= 18.29) t60 = t; }
    out.go = `${(d.v * 2.237).toFixed(0)} mph after 6 s, 60 ft ${t60.toFixed(2)} s`;
    // the button is on screen in the car (on a phone layout) and off on foot
    window.__map.PCAT.LCB.arm = false; return out; }, SCAT));
  log(await ev(() => { const M = window.__map, K = M.PCAT; const out = { test: 'launch button UI' };
    try { M.lcbFrame ? M.lcbFrame(true) : null; } catch (e) {}
    const b = document.getElementById('lcbtn'); out.exists = !!b; if (b) { document.body.classList.add('lc-ok'); const r = b.getBoundingClientRect(); out.rect = [r.x, r.y, r.width, r.height].map(Math.round).join(','); out.label = b.textContent; }
    return out; }));

  // 10. suspension parts: what each changes on the real launch (rear squat, nose rise, 60 ft) on a Scat Pack
  log(await ev(SCAT => { const M = window.__map, K = M.PCAT, F = window.__find, out = { test: 'suspension parts on a Scat Pack launch' };
    out.count = K.SUS_CATS.map(k => F(k, () => true).length + ' ' + k).join(', ');
    const run = (ids, nm) => { const c = window.__car(SCAT); c.sus = {}; for (const id of ids) { const s = K.PC_BY.get(id); c.sus[s.cat] = id; } M.VEH_CACHE && M.VEH_CACHE.clear && M.VEH_CACHE.clear(); const r = K.susSquat(c); out[nm] = `rear squat ${r.sq.toFixed(2)} in, nose up ${r.nose.toFixed(2)} in, 60 ft ${r.t60.toFixed(3)}`; };
    run([], 'factory');
    const pick = (k, f) => F(k, f)[0].id;
    run([pick('coil', s => s.brand === 'Viking' && s.tags === 'drag')], 'Viking drag coilovers');
    run([pick('shock', s => s.o.ext === 0.4)], 'drag shocks, loose front soft rear');
    run([pick('sspr', s => s.name.includes('drag-launch'))], 'drag-launch springs');
    run([pick('tbar', s => s.o.as === 0.45)], 'high anti-squat');
    run([pick('coil', s => s.tags === 'track')], 'track coilovers');
    run([pick('coil', s => s.brand === 'Viking' && s.tags === 'drag'), pick('tbar', s => s.o.as === 0.25), pick('sspr', s => s.name.includes('drag-launch'))], 'full drag setup');
    const c = window.__car(SCAT); K.pcOpen('coil'); K.PCL.sel = K.PC.find(s => s.cat === 'coil').id; K.pcRender(); out.preview = (document.querySelector('.pcv') || {}).textContent || 'none';
    K.pcBuy(c, K.PC_BY.get(K.PCL.sel)); out.bought = JSON.stringify(c.sus); K.pcClose();
    return out; }, SCAT));

  // 11. the body moves over planted wheels: pose a squat and check where the wheels end up
  log(await ev(SCAT => { const M = window.__map, K = M.PCAT, out = { test: 'body over planted wheels' };
    window.__car(SCAT); M.foot.on = false; M.startDrive(7056.5, 1300); return 'ok'; }, SCAT));
  await A.pg.waitForFunction(() => { const c = window.__map.carObj(); return c && c.userData.model && c.userData.model.userData.wheels && c.userData.model.userData.wheels.length; }, null, { timeout: 90000 }).catch(() => {});
  log(await ev(() => { const M = window.__map, K = M.PCAT, out = { test: 'body over planted wheels' }, car = M.carObj(), m = car && car.userData.model; if (!m) return { test: out.test, err: 'no model' };
    const T = K.tunePose(m), wy = () => m.userData.wheels.map(w => { const v = w.getWorldPosition(new (w.position.constructor)()); return +v.y.toFixed(3); });
    m.rotation.x = 0; m.rotation.z = 0; K.susPlant(m, { th: 0, ph: 0, zc: 0 }, T); m.updateMatrixWorld(true); const rest = wy();
    K.tunePose(m); m.rotation.x = 0.04 * 1.25; K.susPlant(m, { th: 0.04, ph: 0, zc: 0.01 }, T); m.updateMatrixWorld(true); const sq = wy();
    out.wheelY_rest = rest.join(','); out.wheelY_squat = sq.join(','); out.maxMove = Math.max(...rest.map((y, i) => Math.abs(y - sq[i]))).toFixed(3) + ' m';
    return out; }));

  if (process.env.SHOTS) {
    await ev(() => { const M = window.__map, K = M.PCAT; window.__car('dodge_charger_scat_pack_2015'); K.pcOpen('hdr'); const s = K.PC.find(s => s.cat === 'hdr' && s.brand === 'Kooks' && s.o.prim === 1.875 && s.base === 'longtube'); K.PCL.sort = 'price-'; K.PCL.sel = null; K.pcRender(); });
    await ev(() => document.querySelectorAll('canvas').forEach(cv => cv.style.visibility = 'hidden'));
    await A.pg.screenshot({ path: (process.env.OUT || '.') + '/catalog-headers.png', timeout: 120000 });
    await ev(() => { const K = window.__map.PCAT; const L = document.querySelector('#englab [data-sel]'); if (L) L.click(); });
    await A.pg.screenshot({ path: (process.env.OUT || '.') + '/catalog-preview.png', timeout: 120000 });
    await ev(() => { const K = window.__map.PCAT; K.pcOpen('inj'); });
    await A.pg.screenshot({ path: (process.env.OUT || '.') + '/catalog-injectors.png', timeout: 120000 });
  }
  log({ ERR: A.errs });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
