// New rim lines + rim menu pictures (2026-11-09). Headless Chromium on the real game.
// Serve the repo on http://localhost:8765 and set S to a folder holding npm/node_modules/three (three@0.128.0).
// Draws every rim's picture through the in-game pipeline (fails on any empty picture), opens the rim menu,
// and checks spinners spin up with the wheels and keep coasting after the wheels stop.
const { chromium } = require('playwright');
const S = process.env.S;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a);
  const pics = await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} let n = 0, bad = [];
    for (const d of M.FORGED.ALL) { const u = M.rimPicDraw([d.id, 'chrome', 20, d.wire ? 'gold' : ''].join('|')); n++; if (!u || u.length < 2000) bad.push(d.id); }
    return { lines: M.FORGED.LINES.length, rims: n, bad }; });
  console.log('pictures', JSON.stringify(pics));
  await ev(() => { const M = window.__map; M.S.car = M.newCar('chevrolet_caprice_classic_box_chevy_1986'); M.RIMUI.line = 'pb'; M.openMenu(() => M.MENUS.rims({ name: 'Glitch Wheel Co.', rate: 1 })); });
  const t0 = Date.now(); await pg.waitForFunction(() => document.querySelectorAll('#menu img.rp.on').length === 10, null, { timeout: 120000, polling: 200 }).catch(() => {});
  const shown = await ev(() => document.querySelectorAll('#menu img.rp.on').length);
  console.log('menu pictures after', Date.now() - t0, 'ms:', await ev(() => [document.querySelectorAll('#menu img.rp.on').length, document.querySelectorAll('#menu img.rp').length].join('/')));
  await ev(() => { const M = window.__map; M.closeMenu && M.closeMenu(); M.S.car.fuel = 100; M.S.car.rims = { id: 'sp1', fin: 'chrome', dia: 22 }; M.foot.on = false; M.startDrive(7056.5, 1300); });
  await pg.waitForTimeout(3000); await ev(() => window.__map.rimRefresh(window.__map.S.car));
  await pg.waitForFunction(() => window.__map.SPIN.size === 4, null, { timeout: 60000, polling: 250 }).catch(() => {});
  for (let i = 0; i < 20; i++) { await ev(() => { const M = window.__map; for (const w of new Set([...M.SPIN].map(e => e.w))) w.rotation.z -= 1.2; }); await pg.waitForTimeout(66); }
  const moving = await ev(() => [...window.__map.SPIN].map(e => +e.om.toFixed(1)));
  await pg.waitForTimeout(3000);
  const stopped = await ev(() => [...window.__map.SPIN].map(e => +e.om.toFixed(1)));
  console.log('spinners', JSON.stringify({ count: moving.length, moving, stopped3s: stopped }));
  const ok = !pics.bad.length && shown === 10 && moving.length === 4 && stopped.every(v => Math.abs(v) > 5) && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL', 'ERR', errs.join('\n').slice(0, 1500) || 'none'); await b.close(); process.exit(ok ? 0 : 1);
})();
