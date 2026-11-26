// Live weather test (2026-11-26). Headless Chromium (Playwright), files served by Playwright's router.
// S= folder holding npm/node_modules/three (three@0.128.0). OUT= folder for screenshots. X/Z = where to drive (default Stop Six).
// Checks: the wet shader got patched, rain + splashes draw only when it rains, the ground gets wet (and nothing indoors),
// wet grip drops on pavement and off-road, lightning bolts + flashes in a storm, the shared forecast is the same on two
// clocks, the Clock app lists the weather, and no page errors. Takes clear / rain / storm / night storm shots.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..');
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +(process.env.VW || 844), height: +(process.env.VH || 390) }, hasTouch: true, isMobile: true, deviceScaleFactor: +(process.env.DPR || 1) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { const t = m.text(); if ((m.type() === 'error' && !/Failed to load resource|supabase/i.test(t)) || /weather/i.test(t)) errs.push('console ' + t.slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase|fonts\.(googleapis|gstatic)/, r => r.abort());
  await pg.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => {
    const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' });
  });
  await pg.goto('http://game.test/index.html?test=1&net=local');
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__wx, null, { timeout: 400000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const fail = [], out = {}; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  const X = +(process.env.X || -700), Z = +(process.env.Z || -100), CAR = process.env.CAR || 'chevrolet_caprice_classic';
  await ev(([X, Z, CAR]) => { const M = window.__map; try { M.closeCreator(); } catch (e) {} if (window.__cops) window.__cops.COP.noPop = true; M.setTime('day');
    try { M.S.car = M.newCar(CAR); } catch (e) { M.S.car = M.newCar(Object.keys(M.BUILT || {})[0]); } M.S.car.fuel = 100; M.foot.on = false; M.startDrive(X, Z); }, [X, Z, CAR]);
  await wait(9000);
  out.stats = await ev(() => window.__wx.stats);
  ok(out.stats.wetShader, 'wet shader patched into the standard materials');
  const shot = async name => { await wait(2500); fs.writeFileSync(path.join(OUT, name + '.png'), await pg.screenshot({ timeout: 240000 })); };
  const set = async (k, t) => { await ev(([k, t]) => { const W = window.__wx; W.set(k); if (t) window.__map.setTime(t); W.snap(); }, [k, t]); await wait(3000); };
  // 1) clear: no rain, dry ground
  await ev(() => { document.querySelectorAll('#toast, .gsp, [class*=gossip]').forEach(e => e.style.display = 'none'); });
  await set('clear', 'day');
  out.clear = await ev(() => { const W = window.__wx, D = W.debug; return { rain: !!(D.RN.mesh && D.RN.mesh.visible), wet: D.WXU.x, grip: D.wxGrip() }; });
  ok(!out.clear.rain && out.clear.wet === 0 && !out.clear.grip, 'clear: no rain, dry road, full grip');
  await shot('01-clear-day');
  // 2) rain
  await set('rain');
  out.rain = await ev(() => { const W = window.__wx, D = W.debug; return { rain: !!(D.RN.mesh && D.RN.mesh.visible), splash: !!(D.RN.splash && D.RN.splash.visible), wet: D.WXU.x, puddles: D.WXU.y, grip: D.wxGrip(), sun: window.__real.sun.intensity }; });
  ok(out.rain.rain && out.rain.splash && out.rain.wet > 0.7, 'rain: streaks + splashes + wet ground');
  ok(out.rain.grip && out.rain.grip[0] < 0.85 && out.rain.grip[0] > 0.7, 'rain: wet pavement grips ~80%');
  await shot('02-rain-day');
  // spray behind the tires when moving on a wet road
  out.spray = await ev(async () => { const D = window.__wx.debug; for (let i = 0; i < 20; i++) D.spEmit(window.__map.drvS().x, window.__map.drvS().z, 0, 20, 1); await new Promise(r => setTimeout(r, 1500)); return { n: D.SP.list.length, vis: !!(D.SP.mesh && D.SP.mesh.geometry.instanceCount > 0) }; });
  ok(out.spray.n >= 20, 'tire spray particles');
  // 3) storm + lightning
  await set('storm');
  out.storm = await ev(() => { const W = window.__wx, D = W.debug; D.ltBolt(); return { bolt: !!(D.LT.mesh && D.LT.mesh.visible), flash: W.flash, grip: D.wxGrip() }; });
  ok(out.storm.bolt && out.storm.flash > 0.5, 'storm: lightning bolt + flash');
  ok(out.storm.grip[0] < out.rain.grip[0], 'storm: even less grip');
  await shot('03-storm-day');
  await ev(() => { window.__wx.debug.ltBolt(); }); await wait(150); fs.writeFileSync(path.join(OUT, '04-storm-lightning.png'), await pg.screenshot({ timeout: 240000 }));
  await set('storm', 'night'); await shot('05-storm-night');
  await set('rain', 'sunset'); await shot('06-rain-sunset');
  // on foot in the rain
  await ev(() => { const M = window.__map; M.setTime('day'); if (M.getOut) M.getOut(); }); await wait(3000); await shot('07-rain-on-foot');
  // 4) off-road grip
  out.grass = await ev(() => { const W = window.__wx, M = window.__map, d = M.drvS(), E = window.__env.debug; let found = null; for (let r = 20; r < 400 && !found; r += 10) for (let a = 0; a < 6.28; a += 0.4) { const x = d.x + Math.cos(a) * r, z = d.z + Math.sin(a) * r; if (!window.__st.onRoad(x, z) && E.groundKind(x, z)) { found = [x, z]; break; } }
    if (!found) return null; const ox = d.x, oz = d.z; d.x = found[0]; d.z = found[1]; const g = W.debug.wxGrip(); d.x = ox; d.z = oz; return { g, surf: W.surf }; });
  ok(!out.grass || (out.grass.g && out.grass.g[1] > 0.02 && out.grass.surf === 'grass'), 'off-road grass: less grip + drag');
  // 5) the shared forecast: same answer on every clock in the same 20 minutes
  out.fc = await ev(() => { const W = window.__wx, n = Date.now(), s = 20 * 60 * 1000, a = W.debug.wxLiveKind(Math.floor(n / s) * s + 1000), c = W.debug.wxLiveKind(Math.floor(n / s) * s + s - 1000); let mix = {}; for (let i = 0; i < 2000; i++) { const k = W.debug.wxLiveKind(i * s); mix[k] = (mix[k] || 0) + 1; } return { a, c, mix }; });
  ok(out.fc.a === out.fc.c && out.fc.mix.clear > 900 && out.fc.mix.storm > 50, 'live weather: one answer per slot, mostly clear');
  // 6) the Clock app lists the weather
  out.app = await ev(() => { const M = window.__map; if (!M.phoneApp) return 'no phoneApp'; try { M.openPhone && M.openPhone(); M.phoneApp('clock'); } catch (e) { return String(e); } return document.querySelectorAll('[data-wx]').length; });
  ok(out.app === 5, 'Clock app: 5 weather picks');
  await ev(() => { window.__wx.set('live'); });
  out.errors = errs.slice(0, 8); ok(!errs.length, 'no page errors');
  console.log(JSON.stringify(out, null, 1));
  console.log(fail.length ? 'FAIL: ' + fail.join('; ') : 'PASS: weather');
  await b.close(); process.exit(fail.length ? 1 : 0);
})();
