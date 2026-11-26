// Bulletproofing tests (2026-11-26), headless Chromium via Playwright. No web server: a route serves the repo.
// S = a folder with npm/node_modules/three (three@0.128.0). OUT = folder for screenshots (optional). PORTRAIT=1 phone portrait.
// Checks: the new part types and their brands are in the catalog; the Health and Build tabs show the Bulletproof box;
// a "fix it" button puts the part on the draft and the draft's score goes up; installing the parts raises the limits the
// wear model uses; the failsafe and coatings slow lean / knock / heat / oil wear; turbo vs blower protection fit rules.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), S = process.env.S, OUT = process.env.OUT, PORTRAIT = !!process.env.PORTRAIT;
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', mp3: 'audio/mpeg', css: 'text/css', webmanifest: 'application/json', svg: 'image/svg+xml', glb: 'model/gltf-binary', m4a: 'audio/mp4' };
const log = o => console.log(JSON.stringify(o));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const ctx = await b.newContext({ viewport: PORTRAIT ? { width: 390, height: 844 } : { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF || 1) });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, r => { const p = r.request().url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await ctx.route(/^http:\/\/localhost:8767\/(.*)$/, r => { const u = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, ''), f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' }); });
  const errs = [], pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(t)) errs.push('console ' + t.slice(0, 300)); if (m.type() === 'warning' && /bulletproof/i.test(t)) errs.push('warn ' + t.slice(0, 300)); });
  await pg.goto('http://localhost:8767/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms), fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  const shot = async (n, sel) => { if (!OUT) return; await ev(sel => { let st = document.getElementById('t3dhide'); if (!st) { st = document.createElement('style'); st.id = 't3dhide'; document.head.appendChild(st); } st.textContent = '#toast{display:none!important}'; if (sel) { const e = document.querySelector(sel), r = document.getElementById('englab'); if (e && r) r.scrollTop += e.getBoundingClientRect().top - 60; } }, sel || null); await wait(600); await pg.screenshot({ path: `${OUT}/${PORTRAIT ? 'p-' : ''}${n}.png` }); };
  await ev(() => { const M = window.__map; M.S.cash = 1e6; try { M.closeCreator(); } catch (e) {} });
  const cat = await ev(() => { const { PC, ENG_CATS } = window.__map.PCAT; const n = {}; for (const k of ['block', 'valves', 'coat', 'safe', 'tprot', 'tbuild']) n[k] = PC.filter(p => p.cat === k).length; return { n, inCats: ['block', 'valves', 'coat', 'safe', 'tprot', 'tbuild'].every(k => ENG_CATS.includes(k)), total: PC.length }; });
  log({ catalog: cat }); ok(cat.inCats && Object.values(cat.n).every(v => v >= 5), 'catalog');
  const useCar = id => ev(id => { const M = window.__map; M.S.car = M.newCar(id); M.S.car.fuel = 100; M.S.car.oil = 100; M.S.dmgOff = false; }, id);
  // ---- Hellcat: Health tab, Build tab, a fix, install, limits ----
  await useCar('dodge_charger_srt_hellcat_widebody_2020');
  const h0 = await ev(() => { const M = window.__map; M.ELAB.elOpen('health'); const box = document.querySelector('#englab .bpbox'); const c = M.S.car, B = window.__bp.bpCalc(c, window.__map.ELAB ? null : null); return { box: !!box, txt: box && box.textContent.slice(0, 160) }; });
  const b0 = await ev(() => { const c = window.__map.S.car, B = window.__bp.bpCalc(c, window.__bp.ctx(c).R); return { score: B.score, label: B.label, tq: Math.round(B.tq / 1.3558), rows: B.rows.map(r => [r.k, Math.round(r.cap / (r.rpm ? 1 : 1.3558)), +r.mg.toFixed(2)]), weak: B.weak && B.weak.k, fixes: B.fixes.map(f => f.cat + ':' + f.id) }; });
  log({ hellcatHealth: h0, b0 }); ok(h0.box, 'health box'); await shot('01-health-bulletproof', '#englab .bpbox');
  // overload it: a twin-turbo kit on the Copperhead's V6 (forged pistons so it fits): way past the gaskets, bearings and box
  await useCar('dodge_copperhead_1997');
  const b1 = await ev(() => { const M = window.__map, c = M.S.car; M.S.cash = 1e6; M.ELAB.elOpen('build'); Object.assign(M.ELAB.LAB.draft, { pistons: 'boost', power: 'turbo' }); M.ELAB.elInstall(); window.__bp.DMG.ctxF = -1; M.ELAB.elOpen('health');
    const B = window.__bp.bpCalc(c, window.__bp.ctx(c).R); return { score: B.score, label: B.label, tq: Math.round(B.tq / 1.3558), weak: B.weak && B.weak.k, over: B.rows.filter(r => r.mg < 0).map(r => r.k), fixes: B.fixes.map(f => f.cat + ':' + f.id) }; });
  log({ b1 }); ok(b1.weak && b1.fixes.length && b1.score < b0.score, 'overloaded score + fixes'); await shot('02-health-overloaded', '#englab .bpbox');
  // the fix button: on the draft, Build tab shows the draft's box with a better score
  const fx = await ev(() => { const btn = document.querySelector('#englab .bpbox [data-bpfix]'); const id = btn && btn.dataset.bpfix; btn && btn.click(); const M = window.__map, L = M.ELAB.LAB, box = document.querySelector('#englab .bpbox');
    return { id, tab: M.ELAB.EL.tab, draft: L.draft && L.draft[id.split(':')[0]], box: !!box, txt: box && box.querySelector('.bpsc') && box.querySelector('.bpsc').textContent.slice(0, 80) }; });
  log({ fx }); ok(fx.tab === 'build' && fx.draft === fx.id.split(':')[1] && fx.box, 'fix to draft');
  await shot('03-build-draft-bulletproof', '#englab .bpbox');
  await useCar('dodge_charger_srt_hellcat_widebody_2020'); await ev(() => window.__map.ELAB.elOpen('build'));
  // build it all the way: draft every bulletproof part that fits, install, and the limits the wear model uses go up
  const inst = await ev(() => { const M = window.__map, c = M.S.car, X0 = window.__bp.ctx(c), s0 = { p: X0.sPist, g: X0.sGask, b: X0.sBrg, t: X0.sTr, f: X0.float };
    M.S.cash = 1e6; const L = M.ELAB.LAB; Object.assign(L.draft, { pistons: 'boost', rods: 'forged', crank: 'forged', studs: 'kit', gasket: 'mls', springs: 'up', block: 'sleeve', valves: 'ti', coat: 'full', safe: 'full', tprot: 'rotor', tbuild: 's3' });
    const why = {}; const D = M.S.car && window.__map.PCAT.engBuild ? null : null; M.ELAB.elInstall(); window.__bp.DMG.ctxF = -1;
    const X1 = window.__bp.ctx(c), s1 = { p: X1.sPist, g: X1.sGask, b: X1.sBrg, t: X1.sTr, f: X1.float }, B = window.__bp.bpCalc(c, X1.R);
    return { s0, s1, eb: ['block', 'valves', 'coat', 'safe', 'tprot', 'tbuild'].map(k => k + '=' + (c.eb[k] || '-')), score: B.score, label: B.label, res: X1.res, safe: X1.safe, cash: M.S.cash }; });
  log({ inst }); ok(inst.s1.p > inst.s0.p && inst.s1.g > inst.s0.g && inst.s1.b > inst.s0.b && inst.s1.t > inst.s0.t && inst.s1.f > inst.s0.f && inst.score > b1.score, 'limits up after install');
  await ev(() => window.__map.ELAB.elOpen('health')); await shot('04-health-built', '#englab .bpbox');
  // the failsafe and coatings: lean / knock / oil wear is slower than the same stress on a car without them
  const wear = await ev(() => { const M = window.__map, c = M.S.car, B = window.__bp; c.wr = {}; B.DMG.ctxF = -1; B.ctx(c);
    B.hit(c, 'pist', 10, 'lean'); B.hit(c, 'valv', 10, 'lean'); B.hit(c, 'brg', 10, 'oil'); B.hit(c, 'pist', 10, 'det'); const built = Object.assign({}, c.wr);
    const d = M.newCar('dodge_charger_srt_hellcat_widebody_2020'); M.S.car = d; d.wr = {}; B.DMG.ctxF = -1; B.ctx(d);
    B.hit(d, 'pist', 10, 'lean'); B.hit(d, 'valv', 10, 'lean'); B.hit(d, 'brg', 10, 'oil'); B.hit(d, 'pist', 10, 'det'); const stock = Object.assign({}, d.wr); M.S.car = c; B.DMG.ctxF = -1;
    return { built, stock, fsN: c.fsN || 0 }; });
  log({ wear }); ok(wear.built.pist > wear.stock.pist + 5 && wear.built.valv > wear.stock.valv && wear.built.brg > wear.stock.brg && wear.fsN > 0, 'protection slows wear');
  // a real drive on the built car with the wear model running: nothing throws
  await ev(() => { const M = window.__map, p = window.__ks.places().find(q => q.type === 'perf'); M.ELAB.elOpen && document.querySelector('#englab [data-x]') && document.querySelector('#englab [data-x]').click(); M.foot.on = false; M.startDrive(p.x, p.z); });
  await wait(5000);
  // ---- fit rules: turbo vs blower vs NA ----
  const fit = await ev(() => { const M = window.__map, B = window.__bp, out = {};
    for (const id of ['bmw_m5_g90_2025', 'dodge_charger_srt_hellcat_widebody_2020', 'dodge_copperhead_1997']) { const c = M.newCar(id), R = B.ctx(Object.assign(c, {})) && null; M.S.car = c; B.DMG.ctxF = -1; const X = B.ctx(c), D = X.R.D, b = X.R.b;
      out[id.split('_')[1]] = { bb: B.fits(D, b, 'tprot', 'bb') || 'ok', rotor: B.fits(D, b, 'tprot', 'rotor') || 'ok', billet: B.fits(D, b, 'block', 'billet') || 'ok', ti: B.fits(D, b, 'valves', 'ti') || 'ok' }; }
    return out; });
  log({ fit }); ok(fit.m5.bb === 'ok' && fit.m5.rotor !== 'ok' && fit.charger.rotor === 'ok' && fit.charger.bb !== 'ok' && fit.copperhead.bb !== 'ok' && fit.copperhead.billet !== 'ok', 'fit rules');
  // ---- M5 (turbo AWD) Build tab, and the brands page for a new part type ----
  await useCar('bmw_m5_g90_2025');
  const m5 = await ev(() => { const M = window.__map; M.ELAB.elOpen('build'); const box = document.querySelector('#englab .bpbox'), grp = [...document.querySelectorAll('#englab h4.elg')].map(x => x.textContent); return { box: !!box, grp }; });
  log({ m5 }); ok(m5.box && m5.grp.includes('Bulletproofing'), 'm5 build tab'); await shot('05-m5-build-bulletproof', '#englab .bpbox'); await shot('06-m5-bulletproofing-parts', '#englab h4.elg:last-of-type');
  await ev(() => window.__map.PCAT.pcOpen('block')); await wait(500); const pcN = await ev(() => document.querySelectorAll('#englab button').length); await shot('07-brands-block');
  // ---- an electric car: no box, no crash ----
  const ev1 = await ev(() => { const M = window.__map, ids = Object.keys(window.__map.CARS || {}); const id = (window.__map.carList ? window.__map.carList() : []).find(x => /tesla|taycan|lucid/.test(x)) || 'tesla_model_s_plaid_2022'; try { M.S.car = M.newCar(id); M.ELAB.elOpen('health'); return { id, box: !!document.querySelector('#englab .bpbox') }; } catch (e) { return { id, err: String(e) }; } });
  log({ ev: ev1, pcN });
  log({ errs }); ok(!errs.length, 'errors');
  console.log(fails.length ? 'FAIL ' + fails.join(', ') : 'PASS'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
