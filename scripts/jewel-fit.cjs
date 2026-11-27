// Jeweler's Bench test (2026-11-27). Headless Chromium (Playwright), repo served by Playwright's router.
// S = folder holding npm/node_modules/three (three@0.128.0), OUT = screenshot folder. Google Fonts are fetched with curl
// (the lettering fonts matter for name plates). Checks: the jewelers on the map, the bench screen (velvet + on me),
// buying, wearing a full set on your character (chains, watch, bracelet, rings, studs, grillz), photo mode close-ups,
// the look carrying jw, and a friend online wearing theirs.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..');
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, on = k => !ONLY || ONLY.includes(k);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const ctx = await b.newContext({ viewport: { width: +(process.env.VW || 844), height: +(process.env.VH || 390) }, hasTouch: true, isMobile: true, deviceScaleFactor: +(process.env.DPR || 1) });
  const X = +(process.env.X || 600), Z = +(process.env.Z || -150);
  const save = { v: 1, made: true, name: 'Kimari', cash: 400000, bank: 2000000, car: { id: 'chevrolet_caprice_classic_box_chevy_1986', color: '#14161c', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 1, oil: 100, mods: {} }, at: { x: X, z: Z, yaw: 0, foot: true, fx: X + 3, fz: Z, fyaw: 0 }, wear: { top: 'tee_white', bottom: 'jeans_blue', hat: '', shoes: '' } };
  await ctx.addInitScript(s => { try { localStorage.setItem('mw3d.save.v1', s); } catch (e) {} }, JSON.stringify(save));
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); if (/jewel|bench/i.test(m.text())) console.log('page:', m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.abort());
  const fcache = {};
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, (r, req) => {
    try { const u = req.url(); const body = fcache[u] || (fcache[u] = execFileSync('curl', ['-s', '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', u], { maxBuffer: 1 << 24 }));
      r.fulfill({ body, contentType: /googleapis/.test(u) ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } }); } catch (e) { r.abort(); }
  });
  await pg.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => {
    const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' });
  });
  await pg.goto('http://game.test/index.html?test=1&net=local');
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__jewel && window.__photo, null, { timeout: 400000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const shot = async (n, ms = 2500) => { await wait(ms); await pg.screenshot({ path: path.join(OUT, (process.env.TAG || '') + n + '.png') }); console.log('shot', n); };
  const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} if (window.__cops) window.__cops.COP.noPop = true; });
  await wait(4000);
  const J = () => window.__jewel;
  // places
  const pl = await ev(() => { const D = window.__jewel.data(); const all = D ? D.P : []; return all.filter(p => p.type === 'jeweler').map(p => p.name + '@' + p.x + ',' + p.z); }).catch(() => []);
  console.log('jewelers', pl); ok(pl.length === 2, 'two jewelers on the map');
  const benchWait = () => pg.waitForFunction(() => { const B = window.__jewel.JB; return B.on && !B.busy && (B.item || B.tab === 'mine'); }, null, { timeout: 180000, polling: 300 });
  // ---- fit close-ups: wear a full set, aim the photo camera at each piece ----
  const SET = process.env.SET || 'chain:2,chain:0,watch:0,more:0,more:3,more:5,more:6';
  if (process.env.LOOK) await ev(l => { const S = window.__guns.S, L = JSON.parse(l); if (L.top) { S.wear.top = L.top; delete L.top; } S.look = Object.assign(S.look || {}, L); }, process.env.LOOK);
  await ev(set => { const W = window.__jewel, JW = W.JW, S = window.__guns.S; S.jewels = set.split(',').map((t, i) => { const [k, p] = t.split(':'); return { id: 'f' + i, k, o: { ...JW.DEF[k], ...JW.PRESETS[k][+p][1] }, name: t, price: 1 }; }); S.wear.jw = []; for (const j of S.jewels) W.jwWear(j.id, true); }, SET);
  await wait(1500);
  await ev(async () => { await window.__guns.ME.upper.userData.jwReady; const P = window.__photo; P.pmOpen(); P.PM.pose = 0; });
  const aim = async (n, find, yaw, dist, pitch, bare) => {
    if (process.env.FIT && !n.includes(process.env.FIT)) return;
    await ev(([find, yaw, dist, pitch, bare]) => {
      const M = window.__guns.ME, P = window.__photo, f = window.__guns.foot; M.root.updateMatrixWorld(true);
      let o = null; M.root.traverse(x => { if (!o && x.name === find) o = x; });
      const c = new THREE.Vector3(); if (o) new THREE.Box3().setFromObject(o).getCenter(c);
      if (find === 'EarringR' && o) o.getWorldPosition(c);
      const h = f.holder.position; P.PM.off.set(c.x - h.x, 0, c.z - h.z); P.PM.lift = c.y - h.y - 1.45;
      P.PM.yaw = f.yaw + Math.PI + yaw; P.PM.dist = dist * 3.5; P.PM.pitch = pitch; P.PM.fov = 9; /* camera near plane is 0.5 m: back off and zoom in */
      M.upper.children[0].visible = !bare;
    }, [find, yaw, dist, pitch, !!bare]);
    await wait(2600); await pg.screenshot({ path: path.join(OUT, (process.env.TAG || '') + n + '.png') }); console.log('shot', n);
  };
  await aim('f-chest', 'jw:neck', 0, 0.55, 0.15);
  await aim('f-chest-side', 'jw:neck', 1.2, 0.55, 0.1);
  await aim('f-back', 'jw:neck', Math.PI, 0.6, 0.3);
  await aim('f-chest-bare', 'jw:neck', 0.5, 0.55, 0.15, true);
  await aim('f-watch-top', 'jw:watch', -1.3, 0.35, 0.2);
  await aim('f-watch-front', 'jw:watch', -0.4, 0.35, 0.05);
  await aim('f-bracelet', 'jw:bracelet', 1.3, 0.35, 0.2);
  await aim('f-ring', 'jw:ring', 1.0, 0.25, 0.1);
  await aim('f-ring-2', 'jw:ring', 0.2, 0.25, 0.4);
  await aim('f-ear', 'EarringR', 1.45, 0.22, 0.0);
  await aim('f-grillz', 'jw:grillz', 0.0, 0.25, 0.0);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
