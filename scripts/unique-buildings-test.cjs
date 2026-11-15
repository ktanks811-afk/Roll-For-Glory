// Unique buildings check for the 3D game (headless Chromium, Playwright): every house is rolled from its own recipe
// (no more six repeated designs), the near houses build into cells and free again, stores come in all seven kinds
// with their walk-in doors, midrises use the wider facade set, and the page throws nothing.
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
const { chromium } = require('playwright');
const S = process.env.S;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 400))); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('error: ' + m.text().slice(0, 300)); if (/^house \d+:/.test(m.text())) errs.push(m.text()); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase|fonts\.(googleapis|gstatic)/, r => r.abort());
  await pg.addInitScript(() => { localStorage.setItem('mw3d.save.v1', JSON.stringify({ v: 1, made: true, cash: 50000, bank: 0, car: { id: 'dodge_charger_srt_hellcat_widebody_2021', color: '#b3121b', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 1, oil: 100, mods: {}, tint: false }, garage: [], at: { x: 1505, z: -700, yaw: 0, foot: false } })); });
  await pg.goto('http://localhost:8765/index.html?net=local');
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__uq && window.__cops, null, { timeout: 400000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms), out = {}, fail = [], ok = (c, m) => { if (!c) fail.push(m); };
  await ev(() => { try { window.__map.closeCreator(); } catch (e) {} window.__cops.COP.noPop = true; });
  // 1) every house its own: thousands of different recipes, all seven families, no houses.json fetched
  out.variety = await ev(() => { const U = window.__uq, fam = {}; for (const H of U.HS.list) { const r = U.recipe(H); fam[r.fam] = (fam[r.fam] || 0) + 1; } return { houses: U.HS.list.length, unique: U.variety(), fam }; });
  ok(out.variety.unique > out.variety.houses * 0.6, 'most houses have a look of their own');
  ok(Object.keys(out.variety.fam).length >= 8, 'every house family shows up');
  out.housesJson = await ev(() => performance.getEntriesByType('resource').some(e => /houses\.json/.test(e.name)));
  ok(!out.housesJson, 'houses.json no longer loaded');
  // 2) near houses are built around you and freed when you leave
  await pg.waitForFunction(() => window.__uq.stats.live > 10, null, { timeout: 120000, polling: 500 }).catch(() => {});
  out.home = Object.assign({}, await ev(() => window.__uq.stats));
  ok(out.home.live > 10 && out.home.tris > 5000, 'houses built near the start');
  await ev(() => { const M = window.__map, d = M.drvS(); Object.assign(d, { x: -9450, z: 1700, v: 0 }); M.physReset(); window.__cops.COP.cam = [-9450, 2, 1720, -9450, 3, 1680]; });
  await pg.waitForFunction(() => window.__uq.stats.freed > 5, null, { timeout: 120000, polling: 500 }).catch(() => {});
  out.away = Object.assign({}, await ev(() => window.__uq.stats));
  ok(out.away.freed > 5, 'cells freed when you leave');
  // 3) stores: all seven kinds, walk-in doors, signs; midrise styles
  out.stores = await ev(() => window.__uq.SST); out.mid = await ev(() => Object.keys(window.__mid).length);
  ok(['bodega', 'main', 'strip', 'fast', 'auto', 'modern', 'bigbox'].every(k => out.stores[k] > 5), 'all seven store kinds');
  ok(out.mid >= 18, 'midrises use the wider facade set');
  out.doors = await ev(() => window.__bld.gen.filter(g => g.type === 'gstore').length);
  ok(out.doors > 1000, 'stores keep their walk-in doors');
  out.gpu = await ev(() => window.__uq.dbg());
  out.errors = errs.slice(0, 8); ok(!errs.length, 'no page errors');
  console.log(JSON.stringify(out, null, 1));
  console.log(fail.length ? 'FAIL: ' + fail.join('; ') : 'PASS: unique buildings');
  await b.close(); process.exit(fail.length ? 1 : 0);
})();
