// Phase 4A nitrous tests (headless Chromium, Playwright, the real car physics).
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// Prints one JSON line per check; ERR lists page errors. CAR picks the test car (default the Scat Pack Charger, NA 392).
const { chromium } = require('playwright');
const S = process.env.S, CAR = process.env.CAR || 'dodge_charger_scat_pack_2015';
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const pg = await b.newPage({ viewport: { width: 844, height: 390 } });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},single(){return Promise.resolve({data:null})},upsert(){return Promise.resolve({})}}),auth:{getSession:()=>Promise.resolve({data:{session:null}}),onAuthStateChange(){}}})', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a), log = o => console.log(JSON.stringify(o));
  await ev(car => { const M = window.__map; M.S.cash = 1e7; try { M.closeCreator(); } catch (e) {} M.S.car = M.newCar(car); M.S.car.fuel = 100; }, CAR);
  await pg.waitForTimeout(800);

  // 1. the bottle: N2O vapour pressure against published data (70°F 760 psi, 86°F 916 psi, 97°F 1050 psi)
  log(await ev(() => { const N = window.__map.NX, F = f => (f - 32) * 5 / 9 + 273.15; return { test: 'vapour', at70F: Math.round(N.nxPsi(F(70))), at86F: Math.round(N.nxPsi(F(86))), at97F: Math.round(N.nxPsi(F(97))), at32F: Math.round(N.nxPsi(F(32))) }; }));

  // 2. passes on the street with and without, for shots, kits and setups (bottle full at 86°F unless set)
  const pass = (nx, extra) => ev(([nx, extra]) => { const M = window.__map, c = M.S.car; c.nx = nx; c.nosLb = extra && extra.lb != null ? extra.lb : null; c.nosT = extra && extra.T != null ? extra.T : null; c.nosAt = Date.now();
    if (extra && extra.eb) c.eb = extra.eb; const t = M.tuneOf ? M.tuneOf(c) : (c.tune || {}), a = M.tuneRun(c, t, { nos: 0 }), r = M.tuneRun(c, t, { nos: 1 }), X = M.NX.nxSpec(c);
    const o = { et0: a.et && +a.et.toFixed(3), et: r.et && +r.et.toFixed(3), mph0: a.trap && +a.trap.toFixed(1), mph: r.trap && +r.trap.toFixed(1), spin0: +a.spin.toFixed(2), spin: +r.spin.toFixed(2) };
    if (r.nos) Object.assign(o, { nosHp: Math.round(r.nos.hp), usedLb: +(r.nos.used / 0.4536).toFixed(3), det: +r.nos.det.toFixed(2) });
    if (X) Object.assign(o, { jet: X.d1.toFixed(4), fuelJet: X.fd1.toFixed(4) });
    delete c.eb; return o; }, [nx, extra]);
  const kit = (k, s1, more) => Object.assign({ kit: k, s1, s2: 0, ft: 0, jf: null, add: { prog: false, win: true, heat: false, purge: false, pump: false, btl15: false }, set: { mode: 'auto', on: 3000, off: 0, ret1: 2 } }, more || {});
  log({ test: 'none', ...(await pass(null)) });
  log({ test: 'wet 100', ...(await pass(kit('wet', 100))) });
  log({ test: 'wet 250', ...(await pass(kit('wet', 250))) });
  log({ test: 'plate 300 (pump)', ...(await pass(kit('plate', 300, { add: { win: true, pump: true }, set: { mode: 'auto', on: 3000, ret1: 6 } }))) });
  log({ test: 'wet 150 progressive 40% over 1.2 s', ...(await pass(kit('wet', 150, { add: { win: true, prog: true }, set: { mode: 'auto', on: 3000, start: 40, ramp: 1.2, ret1: 3, g0: 1, g1: 9 } }))) });
  log({ test: 'wet 150 cold bottle 50°F', ...(await pass(kit('wet', 150), { T: 283.15 })) });
  log({ test: 'wet 150 1 lb left', ...(await pass(kit('wet', 150), { lb: 1 })) });
  log({ test: 'wet 150 no window switch, no retard', ...(await pass(kit('wet', 150, { add: { win: false }, set: { mode: 'auto', ret1: 0 } }))) });
  log({ test: 'wet 150 jetted lean (-3)', ...(await pass(kit('wet', 150, { ft: -3 }))) });
  log({ test: 'dry 100', ...(await pass(kit('dry', 100))) });

  // 3. steady output vs bottle pressure (the jet card is rated at 950 psi) and vs rpm
  log(await ev(() => { const M = window.__map, c = M.S.car; c.nx = { kit: 'wet', s1: 100, s2: 0, ft: 0, add: { win: true }, set: { ret1: 2 } }; const X = M.NX.nxSpec(c), out = { test: 'steady wet 100' };
    for (const p of [600, 750, 850, 950, 1000]) out['hp@' + p] = Math.round(M.NX.nxSteady(X, 5000, p, 450, 550).hp);
    for (const n of [2500, 4000, 6000]) out['addLbft@' + n] = Math.round(M.NX.nxSteady(X, n, 950, 450, 550).Tn / 1.3558);
    return out; }));

  // 4. the bottle over repeated passes: pressure drop from boiling off, recovery with the heater
  log(await ev(() => { const M = window.__map, N = M.NX, c = M.S.car; c.nx = { kit: 'wet', s1: 150, s2: 0, ft: 0, add: { win: true, heat: true }, set: { ret1: 3, hOn: 1, hSet: 920 } }; const X = N.nxSpec(c), S0 = N.nxState(X, X.cap, 303.15), out = { test: 'bottle', psi0: Math.round(S0.psi) };
    const I = { nos: 1 }; for (let p = 0; p < 3; p++) { for (let i = 0; i < 240 * 8; i++) N.nxPhys(X, S0, I, 5000, 1, 3, 1, false, false, 450, 550, true, 1 / 240); out['afterPass' + (p + 1)] = Math.round(S0.psi) + ' psi ' + (S0.m / 0.4536).toFixed(2) + ' lb'; }
    for (let i = 0; i < 240 * 120; i++) N.nxPhys(X, S0, { nos: 0 }, 2000, 0, 3, 1, false, false, 100, 550, true, 1 / 240); out.after2minHeater = Math.round(S0.psi) + ' psi';
    return out; }));

  // 5. AI racers with a kit (Ghost's one-tap kit is now a real 75 shot wet kit) on the same physics, off screen
  log(await ev(() => { const Y = window.__yb, E = Y.ev, M = window.__map, out = { test: 'ai' };
    for (const r of M.STREET3D.filter(x => /Ghost|Twin|Nita/.test(x.name))) { const p = E.pass(r, E.DEFS.street), q = E.pass(r, E.DEFS.r60); out[r.name] = { yb: p.et && +p.et.toFixed(3), r60: q.et && +q.et.toFixed(3) }; }
    return out; }));

  // 6. the Nitrous screen renders
  log(await ev(() => { const M = window.__map, c = M.S.car; c.nx = { kit: 'plate', s1: 200, s2: 100, ft: 0, add: { win: true, prog: true, heat: true, purge: true }, set: { mode: 'auto' } }; M.NX.nxOpen(); const el = document.getElementById('englab');
    return { test: 'screen', open: !el.hidden, buttons: el.querySelectorAll('button').length, dyno: !!document.getElementById('nxdyno'), note: (document.getElementById('nxdn') || {}).textContent }; }));
  if (process.env.SHOTS) { await pg.screenshot({ path: (process.env.OUT || '.') + '/nitrous_screen.png' }); }
  // 7. live in the game: on the I-20 eastbound lanes, armed, floored; then a purge (the bottle, buttons, cloud and sound run)
  await ev(() => { const M = window.__map; M.NX.nxOpen(); document.querySelector('#englab [data-x]').click();
    M.S.car.nx = { kit: 'wet', s1: 150, s2: 0, ft: 0, add: { win: true, purge: true, heat: true }, set: { mode: 'auto', on: 3000, ret1: 3 } }; M.S.car.nosLb = 10; M.S.car.nosT = 303; M.foot.on = false; M.gbMode(false); M.startDrive(5000, 1357); });
  await pg.waitForTimeout(3000);
  await ev(() => { const M = window.__map; if (M.foot.on) M.getIn(); M.NX.NOSI.arm = true; window.__drvIn = () => ({ gas: 1, brake: 0, steer: 0, hb: 0 }); });
  await pg.waitForTimeout(6000);
  log(await ev(() => { const M = window.__map, T = M.TIRE, n = T.nx, b = document.getElementById('nosbtn'); return { test: 'live', mph: Math.round(M.drvS().v * 2.237), sprayHp: n && Math.round(n.hp), psi: n && Math.round(n.psi), lbSaved: +(M.S.car.nosLb || 0).toFixed(2), btn: b && b.textContent, shown: b && getComputedStyle(b).display }; }));
  await ev(() => { const M = window.__map; M.NX.NOSI.arm = false; window.__drvIn = () => ({ gas: 0, brake: 1, steer: 0, hb: 0 }); });
  await pg.waitForTimeout(4000);
  await ev(() => { window.__map.NX.NOSI.purge = true; }); await pg.waitForTimeout(800);
  log(await ev(() => { const M = window.__map, n = M.TIRE.nx, p = document.getElementById('pgbtn'); return { test: 'purge', pg: n && +n.pg.toFixed(3), line: n && +n.line.toFixed(2), pgBtn: p && p.className, smoke: (window.__map.SMOKE || {}).list ? window.__map.SMOKE.list.length : 'n/a' }; }));
  await ev(() => { window.__map.NX.NOSI.purge = false; window.__drvIn = null; });
  console.log('ERR', JSON.stringify(errs));
  await b.close();
})();
