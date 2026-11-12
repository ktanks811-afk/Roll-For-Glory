// Environment pass check for the 3D game (headless Chromium, Playwright): clouds + cloud shade, the countryside trees,
// the ground fix (no pale ground when the camera is low and level), grass at your feet, fences and hay bales,
// and pass 2: road wear, the horizon ring, cattle / windmills / pumpjacks, fireflies.
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// SHOTS=1 saves pictures to SD (default environment-shots).
const { chromium } = require('playwright');
const fs = require('fs');
const S = process.env.S;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 400))); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('error: ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase|fonts\.(googleapis|gstatic)/, r => r.abort());
  await pg.addInitScript(() => { localStorage.setItem('mw3d.gfx', 'high'); localStorage.setItem('mw3d.save.v1', JSON.stringify({ v: 1, made: true, cash: 50000, bank: 0, car: { id: 'dodge_charger_srt_hellcat_widebody_2021', color: '#b3121b', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 1, oil: 100, mods: {}, tint: false }, garage: [], at: { x: 1505, z: -700, yaw: 0, foot: false } })); });
  await pg.goto('http://localhost:8765/index.html?net=local');
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__env && window.__scn && window.__cops, null, { timeout: 400000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms), out = {}, fail = [];
  const ok = (c, m) => { if (!c) fail.push(m); };
  await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} M.setTime('day'); window.__cops.COP.noPop = true; });
  await ev(() => { const c = window.__map.rnd().domElement; c.setAttribute('data-shot', '1'); document.head.insertAdjacentHTML('beforeend', '<style>body *{visibility:hidden!important} canvas[data-shot]{visibility:visible!important}</style>'); });
  await wait(2000);
  // 1) the build
  out.stats = await ev(() => window.__env.stats);
  ok(out.stats.cloudShade && out.stats.cloudSky, 'clouds in the sky and on the ground');
  ok(out.stats.rural && out.stats.rural.trees > 30000 && out.stats.rural.trees < 70000, 'countryside trees');
  ok(out.stats.ground === 3, 'ground tiled + backdrop frame');
  ok(out.stats.fenceRuns > 200, 'fence runs along the country roads');
  // 2) no countryside tree in a street, a building or the water
  out.inRoad = await ev(() => { const P = window.__scn.debug.PL, on = window.__st.onRoad, L = window.__st.lib; let road = 0, solid = 0, n = 0;
    const O = window.__env.debug.EVOCC;   // only the countryside trees (the ones in open cells)
    for (let i = 0; i < P.n; i += 3) { const ci = Math.floor((P.X[i] - O.TX.x0) / O.CS), cj = Math.floor((P.Z[i] - O.TX.z0) / O.CS); if (ci < 0 || cj < 0 || ci >= O.NX || cj >= O.NZ || O.occ[cj * O.NX + ci]) continue;
      n++; if (on(P.X[i], P.Z[i])) road++; if (L.solidIn(P.X[i] - 0.3, P.Z[i] - 0.3, P.X[i] + 0.3, P.Z[i] + 0.3)) solid++; } return { checked: n, road, solid }; });
  ok(out.inRoad.checked > 8000 && out.inRoad.road === 0 && out.inRoad.solid === 0, 'no countryside tree in a street or a building');
  // 3) clouds drift and the shade moves
  out.drift = await ev(async () => { const E = window.__env.debug.EC.u, a = [E.x, E.y]; await new Promise(r => setTimeout(r, 2500)); return { a, b: [E.x, E.y], shade: E.w }; });
  ok(out.drift.b[0] !== out.drift.a[0] && out.drift.shade > 0, 'clouds drift + shade the ground by day');
  // 4) the low, level camera out in the country sees ground colour, not the pale backdrop
  const px = async (cam, tag) => { await ev(c => { window.__cops.COP.cam = c; }, cam); await wait(5000); const buf = await pg.screenshot({ clip: { x: 402, y: 372, width: 40, height: 14 }, timeout: 240000 }); if (process.env.SHOTS) fs.writeFileSync(`${process.env.SD || 'environment-shots'}-${tag}.png`, buf); return buf; };
  // average colour of a screenshot strip, decoded in the page (no PNG library needed)
  const avg = buf => ev(async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, bl = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; } const n = d.length / 4; return [r / n | 0, g / n | 0, bl / n | 0]; }, buf.toString('base64'));
  out.low = await avg(await px([-2600, 3, -1500, -3400, 3, -1300], 'low'));
  ok(out.low[1] < 150 && out.low[1] > out.low[2], 'low level camera sees green ground, not the pale backdrop');
  // 5) grass at your feet in town and the country, fences + bales by a country road, none from up high
  await ev(() => { window.__cops.COP.cam = [200, 1.6, 4512, 700, 1.0, 4512]; }); await wait(5000);
  out.road = await ev(() => Object.assign({}, window.__env.stats.fence, { grass: window.__env.stats.grass }));
  ok(out.road.grass > 300, 'grass by the country road'); ok(out.road.wood + out.road.tposts > 20 && out.road.wires > 40, 'fence posts + wire');
  await ev(() => { window.__cops.COP.cam = [1505, 1.7, -690, 1505, 4, -760]; }); await wait(5000);
  out.town = await ev(() => window.__env.stats.grass);
  ok(out.town > 50, 'grass along the town verges');
  await ev(() => { window.__cops.COP.cam = [1200, 260, -300, 2400, 0, -1500]; }); await wait(4000);
  out.high = await ev(() => ({ grass: window.__env.debug.EG.im.count, posts: window.__env.debug.EF.posts.count }));
  ok(out.high.grass === 0 && out.high.posts === 0, 'nothing close-up drawn from high up');
  // 6) tiers: Low has no grass, Ultra reaches further
  const tier = async t => { await ev(t => { window.__real.rlSetPref(t); window.__cops.COP.cam = [200, 1.6, 4512, 700, 1.0, 4512]; }, t); await wait(5000); return ev(() => window.__env.stats.grass); };
  out.tLow = await tier('low'); out.tUltra = await tier('ultra'); await tier('high');
  ok(out.tLow === 0 && out.tUltra > out.road.grass, 'tiers change the grass reach');
  // 8) pass 2: worn roads, the horizon ring, cattle + a windmill + a pumpjack out in the country, fireflies at night
  out.p2 = await ev(() => { const D = window.__env.debug, M = window.__map.scn(); return { wear: !!window.__env.stats.roadWear, horizon: !!(D.EH.mesh && D.EH.mesh.visible && M.getObjectByName('env-horizon')), air: !!D.EA.pts }; });
  ok(out.p2.wear && out.p2.horizon && out.p2.air, 'road wear + horizon ring + air built');
  const life = async cam => { await ev(c => { window.__cops.COP.cam = c; }, cam); await wait(5000); return ev(() => Object.assign({}, window.__env.stats.life)); };
  out.cows = await life([-7673, 1.7, 2911, -7680, 1, 2902]); out.mill = await life([-215, 2.2, 4340, -187, 6, 4365]); out.jack = await life([-2790, 2.2, -1428, -2802, 2.2, -1441]);
  ok(out.cows.cows > 5 && out.mill.mills > 0 && out.jack.jacks > 0, 'cattle, windmill and pumpjack in the country');
  // near town the herds keep to the open fields: no cow on a road or within 30 m of a building
  await life([1505, 1.7, -690, 1505, 4, -760]);
  out.townCows = await ev(() => { const P = window.__env.debug.EP, L = window.__st.lib; let n = 0, bad = 0; for (const im of [P.cowG, P.cowS]) { const a = im.instanceMatrix.array; for (let i = 0; i < im.count; i++) { const x = a[i * 16 + 12], z = a[i * 16 + 14]; n++; if (window.__st.onRoad(x, z) || L.solidIn(x - 30, z - 30, x + 30, z + 30)) bad++; } } return { n, bad }; });
  ok(out.townCows.bad === 0, 'no cattle on a road or beside a building');
  // 7) night: no cloud shade, clouds go dark
  await ev(() => window.__map.setTime('night')); await pg.waitForFunction(() => window.__env.debug.EC.u.w === 0, null, { timeout: 20000, polling: 250 }).catch(() => {});
  out.night = await ev(() => window.__env.debug.EC.u.w);
  ok(out.night === 0, 'no cloud shade at night');
  await ev(() => { window.__cops.COP.cam = [-2600, 1.8, -1500, -3400, 3, -1300]; }); await pg.waitForFunction(() => window.__env.debug.EA.U.uA.value > 0.3, null, { timeout: 60000, polling: 500 }).catch(() => {});
  out.flies = await ev(() => ({ a: window.__env.debug.EA.U.uA.value, on: window.__env.debug.EA.pts.visible }));
  ok(out.flies.on && out.flies.a > 0.3, 'fireflies over the grass at night');
  out.errors = errs.slice(0, 8); ok(!errs.length, 'no page errors');
  console.log(JSON.stringify(out, null, 1));
  console.log(fail.length ? 'FAIL: ' + fail.join('; ') : 'PASS: environment');
  await b.close(); process.exit(fail.length ? 1 : 0);
})();
