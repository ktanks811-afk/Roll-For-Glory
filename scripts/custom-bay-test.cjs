// Drive-in custom bay (2026-11-12). Headless Chromium on the real game. Serve the repo on PORT (default 8790) and set S to a folder
// holding npm/node_modules/three (three@0.128.0). OUT=dir saves screenshots. Pulls into a shop, walks every section,
// previews and buys paint / rims / tint / underglow / stance, opens and closes a Workshop overlay, drives out, and checks
// the purchases are on the car, the bay is freed and nothing threw. PORTRAIT=1 runs at phone portrait size.
const { chromium } = require('playwright');
const PORT = process.env.PORT || 8790, S = process.env.S, OUT = process.env.OUT, PORT_ = !!process.env.PORTRAIT;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: PORT_ ? { width: 390, height: 844 } : { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await pg.goto(`http://localhost:${PORT}/index.html?test=1`);
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms), shot = async n => { if (OUT) await pg.screenshot({ path: `${OUT}/${PORT_ ? 'p-' : ''}${n}.png` }); };
  const CAR = process.env.CAR || 'dodge_charger_srt_hellcat_widebody_2020';
  const p = await ev(car => { const M = window.__map, K = window.__ks; try { M.closeCreator(); } catch (e) {} M.S.car = M.newCar(car); M.S.car.fuel = 100; M.S.cash = 500000; M.foot.on = false;
    const p = K.places().find(q => q.type === 'visual') || K.places().find(q => q.type === 'perf'); M.startDrive(p.x, p.z); return { id: p.id, name: p.name, type: p.type }; }, CAR);
  console.log('shop', JSON.stringify(p));
  await wait(4000);
  await wait(8000); const mem0 = await ev(() => window.__ks.gpu()); console.log('gpu before', JSON.stringify(mem0));
  const opened = await ev(id => { const K = window.__ks; const p = K.places().find(q => q.id === id); return K.ksOpen(p); }, p.id);
  console.log('opened', opened);
  await wait(1200); await shot('01-drive-in');
  await wait(2200); await shot('02-door-down');
  await pg.waitForFunction(() => window.__ks.KS.phase === 'menu', null, { timeout: 30000, polling: 200 });
  await wait(2500); await shot('03-menu');
  const nav = async (title, n) => { await ev(t => { const K = window.__ks, i = K.KS.rows.findIndex(r => r.t.startsWith(t)); K.ksSelect(i); K.ksActivate(); }, title); await wait(n || 1800); };
  const pick = async (fn, n) => { const r = await ev(fn); await wait(n || 2200); return r; };
  // paint: preview a color, then buy it
  await nav('Respray');
  const paint = await pick(() => { const K = window.__ks, i = K.KS.rows.findIndex(r => r.sw && !r.on && r.t === 'Candy red') ; const j = i >= 0 ? i : K.KS.rows.findIndex(r => r.sw && !r.on); K.ksSelect(j); return { t: K.KS.rows[j].t, hex: K.KS.rows[j].sw, prev: K.KS.P.color, car: window.__map.S.car.color }; });
  await shot('04-paint-preview');
  await ev(() => window.__ks.ksActivate()); await wait(600);
  const painted = await ev(() => window.__map.S.car.color);
  await ev(() => window.__ks.ksBack()); await wait(600);
  // wheels: a line, preview a design, buy it
  await nav('Wheels'); await shot('05-wheels');
  await nav('Glitch', 1500); const line = await ev(() => window.__ks.KS.page.title);
  if (!/Glitch/.test(line)) await ev(() => { const K = window.__ks; K.ksBack(); });
  const rim = await pick(() => { const K = window.__ks; if (K.KS.page.title === 'Wheels') { const i = K.KS.rows.findIndex(r => r.go && r.img); K.ksSelect(i); K.ksActivate(); } const j = K.KS.rows.findIndex(r => r.fx && !r.on); K.ksSelect(j); return { line: K.KS.page.title, t: K.KS.rows[j].t, prev: K.KS.P.rims }; }, 3500);
  await shot('06-rim-preview');
  await ev(() => window.__ks.ksActivate()); await wait(800);
  const rims = await ev(() => window.__map.S.car.rims);
  await ev(() => { const K = window.__ks; K.ksBack(); K.ksBack(); }); await wait(600);
  // tint, underglow, stance
  await nav('Window tint'); await pick(() => { const K = window.__ks, i = K.KS.rows.findIndex(r => r.t.startsWith('Limo')); K.ksSelect(i); }); await shot('07-tint-preview'); await ev(() => window.__ks.ksActivate()); await wait(500); await ev(() => window.__ks.ksBack());
  await nav('Underglow'); await pick(() => { const K = window.__ks, i = K.KS.rows.findIndex(r => r.t === 'Royal purple'); K.ksSelect(i); }); await shot('08-neon-preview'); await ev(() => window.__ks.ksActivate()); await wait(500); await ev(() => window.__ks.ksBack());
  await nav('Stance'); await pick(() => { const K = window.__ks, i = K.KS.rows.findIndex(r => r.t === 'Slammed'); K.ksSelect(i); }); await shot('09-stance-preview'); await ev(() => window.__ks.ksActivate()); await wait(500);
  // preview then back out without buying: the car goes back
  await ev(() => { const K = window.__ks, i = K.KS.rows.findIndex(r => r.t === 'Lifted'); K.ksSelect(i); }); await wait(600); await ev(() => window.__ks.ksBack()); await wait(800);
  const st = await ev(() => { const c = window.__map.S.car; return { tintL: c.tintL, tint: c.tint, neon: c.neon, rh: [c.tune && c.tune.rhF, c.tune && c.tune.rhR], coils: (c.tparts || []).includes('coils'), cash: window.__map.S.cash }; });
  // workshop overlay opens on top and the bay comes back after
  await nav('Workshop'); await shot('10-workshop');
  await ev(() => { const K = window.__ks, i = K.KS.rows.findIndex(r => r.t.startsWith('Car audio')); K.ksSelect(i); K.ksActivate(); }); await wait(1500);
  const subOpen = await ev(() => window.__ks.KS.sub); console.log('menu', await ev(() => { const e = document.getElementById('menu'); return [e.hidden, e.getClientRects().length, getComputedStyle(e).display, e.textContent.slice(0, 80), window.__ks.KS.page.title, window.__ks.KS.rows[window.__ks.KS.sel].t]; })); await shot('11-audio-over-bay');
  await ev(() => window.__map.closeMenu ? window.__map.closeMenu() : document.querySelector('#menu [data-x]').click()); await wait(1500);
  const subClosed = await ev(() => window.__ks.KS.sub);
  await ev(() => window.__ks.ksBack()); await wait(400);
  // xbox pad: fake a controller, press RB (next section), down, B
  await ev(() => { const st = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0], connected: true }; window.__pad = st; navigator.getGamepads = () => [st]; });
  const press = async i => { await ev(i => { window.__pad.buttons[i].pressed = true; window.__pad.buttons[i].value = 1; }, i); await wait(250); await ev(i => { window.__pad.buttons[i].pressed = false; window.__pad.buttons[i].value = 0; }, i); await wait(250); };
  await press(5); const padPage = await ev(() => window.__ks.KS.page.title); await press(13); const padSel = await ev(() => window.__ks.KS.sel); await press(1); const padBack = await ev(() => window.__ks.KS.page.title);
  await ev(() => { delete navigator.getGamepads; }); await shot('12-after-pad');
  // underglow on the street car too, then drive out
  await ev(() => window.__ks.ksLeave()); await wait(1200); await shot('13-drive-out');
  await pg.waitForFunction(() => !window.__ks.KS.on, null, { timeout: 30000, polling: 200 });
  await wait(1500); console.log('gpu right after leaving', JSON.stringify(await ev(() => window.__ks.gpu())));
  await ev(() => window.__map.setTime && window.__map.setTime('night')); await wait(3000); await shot('14-street-night');
  const after = await ev(() => { const K = window.__ks.KS, M = window.__map, m = M.car && M.car.userData.model; return { on: K.on, scene: !!K.scene, trash: K.trash.length, neonOnStreet: !!(m && m.userData.ksNeon && m.userData.ksNeon.visible), cls: document.body.classList.contains('ks-on') }; });
  await wait(8000); const mem1 = await ev(() => window.__ks.gpu()); console.log('gpu after', JSON.stringify(mem1));
  const res = { paint, painted, rim, rims, st, subOpen, subClosed, padPage, padSel, padBack, after };
  console.log(JSON.stringify(res));
  const ok = opened && painted === paint.hex && rims && rims.id && st.tintL === 5 && st.tint && st.neon === '#9a3cff' && st.rh[0] === -7 && st.coils && subOpen && !subClosed && padPage !== 'Murda' && padSel === 1 && !after.on && !after.scene && !after.trash && after.neonOnStreet && !after.cls && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL', 'ERR', errs.join('\n').slice(0, 2000) || 'none'); await b.close(); process.exit(ok ? 0 : 1);
})();
