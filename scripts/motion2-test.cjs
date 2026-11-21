// Fluid motion part 2 test (2026-11-21): falls, hair swing, locals stepping round you. Same harness as motion-test.cjs.
// S= folder holding npm/node_modules/three (three@0.128.0). OUT= folder for screenshots.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..');
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: +(process.env.DPR || 1) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase|fonts\.(googleapis|gstatic)/, r => r.abort());
  await pg.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => {
    const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' });
  });
  await pg.goto('http://game.test/index.html?test=1&net=local');
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__motion, null, { timeout: 400000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} if (window.__cops) window.__cops.COP.noPop = true; });
  await wait(1500);
  await ev(() => { const M = window.__map, R = M.rnd(), orig = R.render; R.render = function () { if (window.__hold && !window.__mine) return; return orig.apply(this, arguments); };
    window.__shot = (cx, cy, cz, lx, ly, lz) => { const c = M.cam(); c.position.set(cx, cy, cz); c.lookAt(lx, ly, lz); c.updateMatrixWorld(); window.__mine = 1; try { R.render(M.scn(), c); } finally { window.__mine = 0; } }; window.__hold = 1; });

  // a test person with locs, standing a few metres in front of you
  const P0 = await ev(() => {
    const M = window.__map, f = M.foot, T = M.ELAB.THREE, D = M.PEOPLE.GAME.DEFAULT;
    const P = M.PEOPLE.build({ ...D, hairStyle: 'locs', skin: '#6b4429', top: 'tee_white' }, 0); const w = new T.Group(); P.root.rotation.y = Math.PI; w.add(P.root); P.wrap = w;
    const x = f.x - Math.sin(f.yaw) * 4, z = f.z - Math.cos(f.yaw) * 4; w.position.set(x, 0.2, z); w.rotation.y = f.yaw + Math.PI / 2; M.scn().add(w); window.__tp = P;
    const hh = P.head.getObjectByName('hairHang'); return { x, z, yaw: f.yaw, hang: !!hh, n: hh ? hh.children.length : 0 };
  });
  ok(P0.hang && P0.n > 0, `locs hang as their own swinging piece (${P0.n} mesh)`);
  const cam = (h = 1.2, d = 3.2, side = 0) => [P0.x + Math.cos(P0.yaw) * d + Math.sin(P0.yaw) * side, h + 0.6, P0.z - Math.sin(P0.yaw) * d + Math.cos(P0.yaw) * side, P0.x, h, P0.z];
  // hair: standing still vs running
  const hair = await ev(() => {
    const Mo = window.__motion, P = window.__tp, H = P.head.getObjectByName('hairHang'), out = {};
    let ph = 0; for (let i = 0; i < 40; i++) { Mo.mtPose(P, 0, 0, 1, 0, i / 60); H.userData.t = performance.now() - 16; }
    out.still = H.rotation.x;
    let mx = -1, mn = 9; for (let i = 0; i < 120; i++) { ph += 0.016 * 7.2 * Math.PI * 2 / 3.8; H.userData.t = performance.now() - 16; Mo.mtPose(P, 1, ph, 1, 1, i / 60); if (i > 40) { mx = Math.max(mx, H.rotation.x); mn = Math.min(mn, H.rotation.x); } }
    out.runMax = mx; out.runMin = mn; return out;
  });
  console.log('hair', JSON.stringify(hair));
  ok(Math.abs(hair.still) < 0.03 && hair.runMax > 0.15 && hair.runMax - hair.runMin > 0.03, `hair hangs still standing (${hair.still.toFixed(3)}), swings back ${hair.runMin.toFixed(2)}–${hair.runMax.toFixed(2)} rad running`);
  await ev(c => window.__shot(...c), cam(1.2, 3.2)); await pg.screenshot({ path: path.join(OUT, '20-hair-running.png') });

  // falls: knees give, goes over, bounce, slack
  const fallAt = async t => ev(([t]) => { const Mo = window.__motion, P = window.__tp; P._F = P._F || {}; P._F.t = -1; let a = 0, s = 0; const dt = 1 / 60; while (s < t) { a = Mo.mtFall(P, P.wrap, true, dt, P._F); s += dt; } P.wrap.position.y = 0.2 + 0.12 * a; return { a, rx: P.wrap.rotation.x }; }, [t]);
  const seq = [];
  for (const [t, n] of [[0.15, '21-fall-knees'], [0.4, '22-fall-going'], [0.66, '23-fall-hit'], [1.5, '24-fall-down']]) { const r = await fallAt(t); seq.push([t, +r.a.toFixed(2), +r.rx.toFixed(2)]); await ev(c => window.__shot(...c), cam(0.9, 3.4)); await pg.screenshot({ path: path.join(OUT, n + '.png') }); }
  console.log('fall', JSON.stringify(seq));
  ok(seq[0][1] < 0.1 && seq[1][1] > 0.2 && seq[1][1] < 0.9 && seq[3][1] === 1, 'falls over time instead of snapping flat');
  await ev(() => { const P = window.__tp; window.__motion.mtFall(P, P.wrap, false, 1 / 60, P._F); P.wrap.rotation.x = 0; P.wrap.parent.remove(P.wrap); });

  // locals step round you: a fake local walking straight at a point behind you
  const av = await ev(() => {
    const M = window.__map, Mo = window.__motion, f = M.foot; if (!Mo.hFootMove) return null;
    const fx = -Math.sin(f.yaw), fz = -Math.cos(f.yaw);
    const e = { x: f.x + fx * 6, z: f.z + fz * 6, yaw: 0, walk: 0 }, tx = f.x - fx * 6, tz = f.z - fz * 6;
    let closest = 9, n = 0, reached = false;
    for (let i = 0; i < 600; i++) { const moved = Mo.hFootMove(e, tx, tz, 1 / 60, false); if (!moved && Math.hypot(tx - e.x, tz - e.z) < 0.5) { reached = true; break; } closest = Math.min(closest, Math.hypot(e.x - f.x, e.z - f.z)); n++; }
    return { closest, reached, secs: n / 60, left: Math.hypot(tx - e.x, tz - e.z) };
  });
  console.log('avoid', JSON.stringify(av));
  if (av) ok(av.closest > 0.7 && (av.reached || av.left < 1), `a local walking through your spot steps round you (closest ${av.closest.toFixed(2)} m) and still gets there`);
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
  await b.close();
  console.log(fail.length ? `\n${fail.length} FAILED` : '\nALL OK');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
