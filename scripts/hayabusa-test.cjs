// 2025 Suzuki Hayabusa + two-wheel physics tests (headless Chromium, Playwright). Serve the repo on http://localhost:8765,
// S = folder with npm/node_modules/three (three@0.128.0). Steps the game with __moto.tick (no rendering needed), so it runs
// the same on a slow software GPU. Checks: the model's moving rig, launches with and without the aids, launch control,
// braking, a countersteered turn, generic bikes (sport + cruiser), the Moto Shop parts and their power, no page errors.
const { chromium } = require('playwright'); const S = process.env.S, PORT = process.env.PORT || 8765;
const log = o => console.log(JSON.stringify(o));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 500))); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()) || /rides:|bike rig|bike look/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({})', contentType: 'application/javascript' }));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pg.goto(`http://localhost:${PORT}/index.html?test=1`); await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 240000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a);
  let fails = 0; const check = (name, ok, info) => { if (!ok) fails++; log(Object.assign({ test: name, ok: !!ok }, info || {})); };
  const ride = async (id, x, z) => {
    await ev(([id, x, z]) => { const M = window.__map; try { M.closeCreator(); } catch (e) {} const c = M.newCar(id); c.fuel = 100; M.S.car = c; M.foot.on = false; M.startDrive(x, z); const D = M.drvS(); D.x = x; D.z = z; D.yaw = 0; D.v = 0; M.TIRE.vx = M.TIRE.vz = M.TIRE.w = 0; M.TIRE.vd = null; window.__in = { gas: 0, brake: 0, steer: 0, hb: 0 }; window.__drvIn = () => window.__in; }, [id, x, z]);
    await pg.waitForFunction(() => window.__map.carObj() && window.__map.carObj().userData.model, null, { timeout: 120000, polling: 500 });
    await ev(() => window.__moto.tick(60, 1 / 60));
  };
  // a straight-line run: full throttle for T seconds (optionally launch control), returns 0-60, 1/8 mile, max wheelie, crash
  const run = (cfg) => ev((cfg) => {
    const M = window.__moto, c = window.__map.S.car, o = M.mtOf(c); Object.assign(o.el, cfg.el || {}); o.p = Object.assign({}, cfg.p || {}); M.BK.lcArm = !!cfg.lc; M.gbMode(false);
    const I = window.__in; Object.assign(I, { gas: 0, brake: 0, steer: 0, hb: 0 }); M.tick(30, 1 / 60);
    let t = 0, D = window.__map.drvS(), x0 = D.x, z0 = D.z, t60 = 0, t8 = 0, v8 = 0, maxTh = 0, crash = '', maxG = 0;
    if (cfg.lc) { I.hb = 1; I.gas = 1; M.tick(60, 1 / 60); I.hb = 0; } else I.gas = 1;
    for (let i = 0; i < 60 * cfg.T; i++) { M.tick(1, 1 / 60); t += 1 / 60; const st = M.BK.st, d = Math.hypot(window.__map.drvS().x - x0, window.__map.drvS().z - z0);
      maxTh = Math.max(maxTh, st.th); maxG = Math.max(maxG, st.g); if (!t60 && st.u >= 26.82) t60 = t; if (!t8 && d >= 201.2) { t8 = t; v8 = st.u; } if (st.crash) { crash = st.crash.kind; break; } }
    I.gas = 0; return { t60: +t60.toFixed(2), t8: +t8.toFixed(2), mph8: Math.round(v8 * 2.237), wheelie: +(maxTh * 57.3).toFixed(1), gear: maxG, crash };
  }, cfg);

  await ride('suzuki_hayabusa_2025', 7056.5, 1180);
  const rig = await ev(() => { const m = window.__map.carObj().userData.model, U = m.userData; return { bike: !!U.bike, rig: !!U.rig, parts: Object.keys(U.rig ? U.rig.parts : {}), kits: Object.keys(U.kits || {}), tft: (U.screens || []).map(s => s.k) }; });
  check('Hayabusa model has the moving rig', rig.bike && rig.rig && ['bsteer', 'fork', 'swing', 'shock', 'chainT', 'nd_tach'].every(k => rig.parts.includes(k)) && rig.tft.includes('tft'), rig);
  const stock = await run({ T: 8 });
  check('stock launch (TC 4, anti-lift 5): quick, no crash, the front stays near the ground', stock.t60 > 2.6 && stock.t60 < 4.0 && !stock.crash && stock.wheelie < 10 && stock.t8 > 6.8 && stock.t8 < 8.2, stock);
  await ride('suzuki_hayabusa_2025', 7056.5, 1180);
  const lc = await run({ T: 8, lc: true, el: { tc: 2, wc: 3 } });
  check('launch control + anti-lift 3: held wheelie, no crash', lc.t60 > 2.5 && lc.t60 < 3.8 && !lc.crash && lc.wheelie > 2 && lc.wheelie < 14, lc);
  await ride('suzuki_hayabusa_2025', 7056.5, 1180);
  const wh = await run({ T: 5, el: { tc: 3, wc: 0 } });
  check('anti-lift off: it wheelies (and can loop if you hold it)', wh.wheelie > 5 || wh.crash === 'loop', wh);
  // braking from 60 mph
  await ride('suzuki_hayabusa_2025', 7056.5, 1180);
  const br = await ev(() => { const M = window.__moto, I = window.__in; M.mtOf(window.__map.S.car).el = { mode: 'A', tc: 4, wc: 5, lc: 2, qs: 1, ebc: 2, abs: 1 }; M.gbMode(false); I.gas = 1; let n = 0; while (M.BK.st.u < 27 && n++ < 600) M.tick(1, 1 / 60);
    I.gas = 0; I.brake = 1; const D = window.__map.drvS(), x0 = D.x, z0 = D.z, u0 = M.BK.st.u; let t = 0, stoppie = 0; while (M.BK.st.u > 0.3 && t < 8) { M.tick(1, 1 / 60); t += 1 / 60; stoppie = Math.min(stoppie, M.BK.st.th); } I.brake = 0;
    return { from: Math.round(u0 * 2.237), dist: +Math.hypot(window.__map.drvS().x - x0, window.__map.drvS().z - z0).toFixed(1), t: +t.toFixed(2), stoppie: +(stoppie * 57.3).toFixed(1), crash: M.BK.st.crash && M.BK.st.crash.kind }; });
  check('60-0 mph on the brakes: short, straight, ABS keeps the rear down', br.dist > 30 && br.dist < 52 && !br.crash && br.stoppie > -8, br);
  // a turn in the open: the bike countersteers into a lean
  await ride('suzuki_hayabusa_2025', 1650, -400);
  const tu = await ev(() => { const M = window.__moto, I = window.__in; M.gbMode(false); I.gas = 0.6; let n = 0; while (M.BK.st.u < 11 && n++ < 400) M.tick(1, 1 / 60);
    I.gas = 0.3; I.steer = 0.8; let dmin = 0; for (let i = 0; i < 150; i++) { M.tick(1, 1 / 60); dmin = Math.min(dmin, M.BK.st.delta * Math.sign(I.steer)); }
    const st = M.BK.st, r = { u: +st.u.toFixed(1), lean: +(st.phi * 57.3).toFixed(1), counter: +(dmin * 57.3).toFixed(2), crash: st.crash && st.crash.kind }; I.steer = 0; I.gas = 0; I.brake = 1; M.tick(120, 1 / 60); I.brake = 0; return r; });
  check('turn: countersteer first, then a real lean', Math.abs(tu.lean) > 15 && tu.counter < 0 && !tu.crash, tu);
  // the shop: parts change power the way real ones do
  const shop = await ev(() => { const M = window.__moto, c = window.__map.S.car, o = M.mtOf(c), hp = () => Math.round(M.mtHpNow(c)), r = {};
    o.p = {}; r.stock = hp(); o.p.ecu = 'flash'; r.flash = hp(); o.p.exh = 'full'; r.full = hp(); o.p.inj = 'hi'; o.p.turbo = 't1'; r.turbo8 = hp(); o.p = {};
    r.rows = M.motoShop({ rate: 1 }).rows.length; return r; });
  check('Moto Shop: stock ~188 hp, a flash + full system ~10-15% more, 8 psi turbo ~300+', shop.stock > 180 && shop.stock < 195 && shop.full / shop.stock > 1.08 && shop.full / shop.stock < 1.2 && shop.turbo8 > 280 && shop.turbo8 < 360 && shop.rows >= 6, shop);
  // other bikes ride the same physics with their own numbers
  for (const id of ['kawasaki_ninja_h2_2019', 'harley_street_glide_2024']) {
    await ride(id, 7056.5, 1180); const g = await run({ T: 8 });
    check(id + ' rides the bike physics and shifts', g.t60 > 1.5 && g.t60 < 8 && g.gear >= 2 && !g.crash, g);
  }
  check('no page errors', errs.length === 0, { errs: errs.slice(0, 8) });
  log({ done: true, fails });
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
