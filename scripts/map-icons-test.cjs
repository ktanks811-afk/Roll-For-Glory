// Driving map name icons + zoom on waypoint (2026-11-21). Headless Chromium, files served by Playwright's router.
// S = folder with npm/node_modules/three (three@0.128.0); OUT = screenshot folder.
// Checks: minimap draws icon badges + names (not dots), no page errors, the minimap closes in on a near waypoint,
// tapping the minimap opens the Map zoomed in on the waypoint with its card, the Map's 🚩 button does the same.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..');
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),order(){return this},limit(){return this},then(f){return f({data:[]})}}),rpc:async()=>({data:null})});', contentType: 'application/javascript' }));
  await pg.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => {
    const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' });
  });
  await pg.goto('http://game.test/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 240000 });
  const ev = (f, a) => pg.evaluate(f, a), R = {};
  const shot = async (n, clip) => { await pg.waitForTimeout(500); await pg.screenshot({ path: path.join(OUT, n + '.png'), clip }); };
  // start driving downtown Fort Worth where places are thick
  const start = await ev(() => { const M = window.__map, I = window.__mapicons; M.S.cash = 1e7; try { M.closeCreator(); } catch (e) {}
    const P = I.DATA.P; let best = null, bn = 0; for (const p of P) { let n = 0; for (const q of P) if (Math.hypot(q.x - p.x, q.z - p.z) < 300) n++; if (n > bn) { bn = n; best = p; } }
    M.S.car = M.newCar('dodge_charger_srt_hellcat_widebody_2020'); M.S.car.fuel = 100; M.foot.on = false; M.startDrive(best.x + 30, best.z + 30); return { at: best.name, nearby: bn }; });
  R.start = start;
  await pg.waitForTimeout(3000);
  await ev(() => { const M = window.__map; if (M.foot.on) M.getIn(); });
  await pg.waitForTimeout(2000);
  R.mini = await ev(() => { const I = window.__mapicons; return { near: I.MI.near.length, icons: I.MI.ico.size, labels: I.MI.lab.size, boxes: I.MI.boxes.length, r: Math.round(I.MINI.r) }; });
  const mb = await (await pg.$('#mini')).boundingBox();
  const clip = { x: Math.max(0, mb.x - 8), y: Math.max(0, mb.y - 8), width: mb.width + 16, height: mb.height + 40 };
  await shot('01-screen'); await shot('02-minimap-close', clip);
  // set a waypoint at a place ~150 m away: minimap should close in on it
  const wp = await ev(() => { const M = window.__map, I = window.__mapicons, d = M.drvS(); let best = null, bd = 1e9;
    for (const p of I.DATA.P) { const dd = Math.abs(Math.hypot(p.x - d.x, p.z - d.z) - 150); if (dd < bd) { bd = dd; best = p; } }
    I.setPin(best.name, best.x, best.z); return { name: best.name, dist: Math.round(Math.hypot(best.x - d.x, best.z - d.z)) }; });
  R.wp = wp; await pg.waitForTimeout(2500);
  R.miniZoom = await ev(() => Math.round(window.__mapicons.MINI.r));
  await shot('03-minimap-waypoint', clip);
  // tap the minimap
  await pg.touchscreen.tap(mb.x + mb.width / 2, mb.y + mb.height / 2); await pg.waitForTimeout(800);
  R.tap = await ev(() => { const I = window.__mapicons, c = document.querySelector('#bigmap .bm-card'); return { open: I.BM.open, k: +I.BM.k.toFixed(2), card: c && !c.hidden ? c.querySelector('h3').textContent : null, pinBtn: !document.querySelector('#bigmap [data-a="pin"]').hidden }; });
  await shot('04-map-on-waypoint');
  // zoom out, then the 🚩 button brings you back
  await ev(() => { const I = window.__mapicons; I.bmGo('tx'); }); await pg.waitForTimeout(400);
  await ev(() => document.querySelector('#bigmap [data-a="pin"]').click()); await pg.waitForTimeout(500);
  R.flag = await ev(() => { const I = window.__mapicons; return { k: +I.BM.k.toFixed(2), dx: Math.round(I.BM.cx - I.pin.position.x) }; });
  await ev(() => window.__mapicons.closeBigMap());
  // far waypoint: arrow on the rim
  await ev(() => { const I = window.__mapicons, M = window.__map, d = M.drvS(); I.setPin('Far test spot', d.x + 3000, d.z + 2000); }); await pg.waitForTimeout(1500);
  R.miniFar = await ev(() => Math.round(window.__mapicons.MINI.r));
  // drive fast: map zooms out, fewer names
  await ev(() => { const I = window.__mapicons; I.pin.visible = false; }); await ev(() => { window.__map.drvS().v = 30; }); await pg.waitForTimeout(1500);
  await shot('05-minimap-speed', clip);
  // portrait phone
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(1200);
  const mb2 = await (await pg.$('#mini')).boundingBox(); await shot('06-portrait', { x: 0, y: 0, width: 390, height: Math.min(844, mb2.y + mb2.height + 60) });
  // cost of a minimap frame
  R.ms = await ev(() => { const t = performance.now(); for (let i = 0; i < 200; i++) window.__mapicons.MI.near.length && 0; const M = window.__map; return null; });
  R.errs = errs;
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
