// Ranch income (2026-11-28). Headless Chromium on the real game, files served from disk (no server).
// S = a folder holding npm/node_modules/three (three@0.128.0), OUT = dir for screenshots.
// Everything on your land pays every night you sleep (pumpjack oil, calves, strips, garden...), water on the land
// adds 20% to cattle and horses, empty lots pay nothing, and the planner has a ledger.
const { chromium } = require('playwright');
const S = process.env.S, OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const pg = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); if (m.type() === 'warning' && /roll|strip|ranch/i.test(m.text())) errs.push('warn ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  const path = require('path'), fs = require('fs'), ROOT = process.env.ROOT || path.join(__dirname, '..');
  const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };
  await pg.route(/^http:\/\/mw\.local\//, r => { const u = new URL(r.request().url()), f = path.join(ROOT, decodeURIComponent(u.pathname)); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' }); r.fulfill({ path: f, contentType: TYPES[path.extname(f)] || 'application/octet-stream' }); });
  await pg.goto('http://mw.local/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const shot = async n => { if (!OUT) return; await ev(() => { let st = document.getElementById('t3dhide'); if (!st) { st = document.createElement('style'); st.id = 't3dhide'; document.head.appendChild(st); } st.textContent = '#toast{display:none!important}'; }); for (let i = 0; i < 3; i++) { try { await pg.screenshot({ path: `${OUT}/${n}.png`, timeout: 60000 }); return; } catch (e) { console.log('retry shot', n); } } };
  const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };

  const land = await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} M.S.cash = 5e7; M.S.uid = M.S.uid || 'me-test';
    const L = M.places().filter(p => p.type === 'land' && p.lot).map(p => ({ p, a: (p.lot.x1 - p.lot.x0) * (p.lot.z1 - p.lot.z0) })).sort((a, b) => b.a - a.a);
    const p = L[0].p; M.S.props.push(p.id); return p.id; });
  await ev(id => window.__home.RANCH.planOpen(window.__map.places().find(q => q.id === id)), land); await wait(400);
  const put = (k) => ev(k => { const R = window.__home.RANCH, LP = R.LP, p = LP.p, L = R.lotOfLand(p); LP.pick = k; LP.ghost = { k, x: 0, z: 0, r: 0 };
    for (let z = -L.hd + 40; z < L.hd - 4; z += 8) for (let x = -L.hw + 40; x < L.hw - 4; x += 8) if (!R.lotFits(p, LP.plan, { k, x, z, r: 0 })) { R.planPut(x, z); return true; } return false; }, k);
  const p0 = await ev(() => { const R = window.__home.RANCH; return window.__home.PAY.ranchPay(R.LP.p).total; });
  ok(p0 === 0, 'raw land pays nothing');
  for (const k of ['pumpjack', 'cattle', 'strip4', 'garden']) ok(await put(k), k + ' put down');
  const p1 = await ev(() => window.__home.PAY.ranchPay(window.__home.RANCH.LP.p));
  ok(p1.total === 1800 + 650 + 1500 + 40, 'pays per day: ' + JSON.stringify(p1));
  ok(await put('pond'), 'pond put down');
  const p2 = await ev(() => window.__home.PAY.ranchPay(window.__home.RANCH.LP.p).total);
  ok(p2 === 1800 + 780 + 1500 + 40, 'water on the land: cattle +20% ' + p2);
  ok(await put('plot'), 'empty house lot');
  ok(await ev(() => window.__home.PAY.ranchPay(window.__home.RANCH.LP.p).total) === p2, 'an empty lot pays no rent');
  // sleep: the money comes in
  const sl = await ev(() => { const M = window.__map, c0 = M.S.cash, d0 = M.S.day; window.__home.PAY.sleep(); return { got: M.S.cash - c0, day: M.S.day - d0, log: M.S.log.slice(0, 6), last: M.S.ranchLast }; });
  ok(sl.day === 1 && sl.last && sl.last.total === p2 && sl.log.some(l => /Ranch income/.test(l)), 'sleeping pays the ranch ' + JSON.stringify(sl));
  // the ledger
  await ev(() => { const R = window.__home.RANCH; R.LP.sel = null; R.planUI(); document.querySelector('#lp-foot [data-a="ledger"]').click(); }); await wait(500);
  const led = await ev(() => document.getElementById('lp-foot').innerText);
  ok(/Ranch ledger/.test(led) && /Pumpjack/.test(led) && /oil/.test(led) && /Last night/.test(led), 'ledger lists what pays');
  await shot('60-ranch-ledger');
  await ev(() => { document.querySelector('#lp-foot [data-a="ledger"]').click(); }); await wait(300); await shot('61-planner-pay');
  console.log('errors', errs.length ? errs.join('\n') : 'none');
  console.log(fail.length ? `FAILED ${fail.length}` : 'ALL OK');
  await b.close(); process.exit(fail.length || errs.length ? 1 : 0);
})();
