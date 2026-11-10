// Scenery realism check for the 3D game (headless Chromium, Playwright): trees, bushes, utility poles, power lines, birds.
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// Checks: every tree on the map became a plant with a species, nothing new stands in a street, detail levels fill in around
// the camera (and swap as it moves), the wires hang from the poles, birds sit on the wires and scatter when a car rolls up,
// a gunshot flushes them, and the Graphics tiers change the reach. SHOTS=1 saves pictures to SD (default scenery-shots).
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
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__scn && window.__cops, null, { timeout: 300000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms), out = {}, fail = [];
  const ok = (c, m) => { if (!c) fail.push(m); };
  await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} M.setTime('day'); window.__cops.COP.noPop = true; });
  await wait(1000);
  out.loop = await ev(async () => { const a = window.__scn.U.uTime.value; await new Promise(r => setTimeout(r, 1500)); return { t0: a, t1: window.__scn.U.uTime.value, creating: document.body.className }; });
  await wait(2500);
  // 1) the build
  out.stats = await ev(() => { const s = window.__scn.stats; return { trees: s.trees, plants: s.plants, poles: s.poles, spans: s.spans, drops: s.drops, wires: s.wires, byType: s.byType, ms: s.ms, inRoadAfter: window.__st.stats.inRoadAfter }; });
  ok(out.stats.trees > 40000, 'trees became plants'); ok(out.stats.poles > 5000 && out.stats.spans > 4000, 'utility poles + spans'); ok(out.stats.drops > 1000, 'house drops');
  ok(Object.values(out.stats.byType).filter(n => n > 0).length >= 12, 'all 12 plant types used');
  // 2) nothing new in a street: plants (trunk / bush footprint) and poles
  out.inRoad = await ev(() => { const D = window.__scn.debug, P = D.PL, on = window.__st.onRoad; let plants = 0, poles = 0, hedges = 0;
    for (let i = 0; i < P.n; i++) { if (D.SN_TYPES[P.T[i]].id === 'hedge') { if (on(P.X[i], P.Z[i])) hedges++; continue; } if (on(P.X[i], P.Z[i])) plants++; }
    for (const p of D.POLES) if (on(p.x, p.z)) poles++; return { plants, poles, hedges }; });
  ok(out.inRoad.poles === 0, 'no pole in a street'); ok(out.inRoad.plants + out.inRoad.hedges < 40, 'no plants in the streets');
  // 3) detail levels around the camera, and they follow it
  const lodAt = async (x, z) => { await ev(([x, z]) => { window.__cops.COP.cam = [x, 2, z, x + 30, 2, z]; }, [x, z]); await wait(4000);
    return ev(() => { const L = window.__scn.debug.LODM; const n = [0, 0, 0]; for (const T of L) if (T) for (let l = 0; l < 3; l++) if (T[l]) for (const m of T[l]) if (m) n[l] += m.im.count; return { n, near: window.__scn.stats.near, wires: window.__scn.stats.wiresDrawn }; }); };
  out.lodA = await lodAt(1505, -700); out.lodB = await lodAt(3200, 900);
  ok(out.lodA.n[0] >= 1 && out.lodA.n[1] > 50 && out.lodA.n[2] > 200, 'full / light / far trees around the camera');
  ok(JSON.stringify(out.lodA.n) !== JSON.stringify(out.lodB.n), 'detail levels follow the camera'); ok(out.lodA.wires > 50, 'wires drawn near the camera');
  // 4) the wires hang from the poles (each span's ends sit on a pole's crossarm)
  out.wireEnds = await ev(() => { const D = window.__scn.debug, W = D.WI; let bad = 0, n = 0; const poles = D.POLES;
    const G = new Map(); for (const p of poles) { const k = Math.floor(p.x / 20) * 100003 + Math.floor(p.z / 20); (G.get(k) || G.set(k, []).get(k)).push(p); }
    for (let w = 0; w < W.K.length; w += 37) { if (W.K[w] === 3) continue; n++; const x = W.A[w * 3], z = W.A[w * 3 + 2]; let best = 1e9;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of G.get((Math.floor(x / 20) + i) * 100003 + Math.floor(z / 20) + j) || []) best = Math.min(best, Math.hypot(p.x - x, p.z - z));
      if (best > 1.6) bad++; } return { checked: n, offPole: bad }; });
  ok(out.wireEnds.offPole === 0, 'every span starts on a pole');
  // 5) birds: sitting on the wires, a car rolling up flushes them
  await ev(() => { window.__cops.COP.cam = null; });
  await pg.waitForFunction(() => window.__scn.stats.birds && window.__scn.stats.birds.perched > 5, null, { timeout: 30000 }).catch(() => {});
  out.birds0 = await ev(() => window.__scn.stats.birds);
  ok(out.birds0 && out.birds0.perched > 5, 'birds on the wires');
  out.flush = await ev(async () => { const D = window.__scn.debug, B = D.BD, M = window.__map, d = M.drvS(); const b = B.perch[0]; if (!b) return { err: 'no perched bird' };
    const before = B.perch.length, flocks = B.flocks.length; Object.assign(d, { x: b.x + 4, z: b.z + 4, v: 12 });
    for (let k = 0; k < 30 && B.perch.length >= before; k++) await new Promise(r => setTimeout(r, 200)); d.v = 0;
    return { before, after: B.perch.length, flocksBefore: flocks, flocksAfter: B.flocks.length, fleeing: B.flocks.some(f => f.birds.some(q => q.state === 'flee')) }; });
  ok(out.flush.after < out.flush.before && out.flush.fleeing, 'a car rolling up flushes the birds');
  // a gunshot flushes everything near it
  await wait(4000);
  out.shot = await ev(async () => { const B = window.__scn.debug.BD; const b = B.perch[0] || B.ground[0]; if (!b) return { skip: 'nobody sitting' }; const n0 = B.perch.length + B.ground.length;
    window.__shotHook({ x: b.x, y: 1, z: b.z }, { x: 1, y: 0, z: 0 }, null, 0); for (let k = 0; k < 30 && B.perch.length + B.ground.length >= n0; k++) await new Promise(r => setTimeout(r, 200)); return { before: n0, after: B.perch.length + B.ground.length }; });
  ok(out.shot.skip || out.shot.after < out.shot.before, 'a gunshot flushes the birds');
  // 6) tiers: Low draws less, Ultra more
  const tierN = async t => { await ev(t => { window.__real.rlSetPref(t); window.__cops.COP.cam = [1505, 2, -700, 1535, 2, -700]; }, t); await wait(6000); return ev(() => { const s = window.__scn.stats; return { near: s.near, nearTris: s.nearTris, farTris: s.farTris }; }); };
  out.tLow = await tierN('low'); out.tUltra = await tierN('ultra'); await tierN('high');
  ok(out.tLow.nearTris < out.tUltra.nearTris, 'tiers change how much is drawn');
  // 7) night: flocks go to roost
  await ev(() => window.__map.setTime('night')); await wait(4000);
  out.night = await ev(() => window.__scn.stats.birds);
  if (process.env.SHOTS) {
    const sd = process.env.SD || 'scenery-shots'; fs.mkdirSync(sd, { recursive: true });
    await ev(() => window.__map.setTime('day'));
    for (const [n, cam] of [['street', [1505, 1.7, -690, 1505, 4, -760]], ['town', [1385, 45, -540, 1565, 0, -760]]]) { await ev(c => { window.__cops.COP.cam = c; }, cam); await wait(4000); await pg.screenshot({ path: `${sd}/${n}.png`, timeout: 240000 }); }
  }
  out.errors = errs.slice(0, 8); ok(!errs.length, 'no page errors');
  console.log(JSON.stringify(out, null, 1));
  console.log(fail.length ? 'FAIL: ' + fail.join('; ') : 'PASS: scenery');
  await b.close(); process.exit(fail.length ? 1 : 0);
})();
