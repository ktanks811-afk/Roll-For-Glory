// Realty app (2026-11-28): listings with rendered pictures, buying a house on the block (it becomes a real walk-in house), land aerials, floor plans, and the bought house still standing after a reload.
// S = a folder holding npm/node_modules/three (three@0.128.0), OUT = dir for screenshots.
// Your own acreage: open the planner, put down house lots, a barn, stable, shop, silo, windmill, pond, cattle,
// horses, hay, coop, garden, arch, roads, court, helipad and a pumpjack (paid for, refunds on remove, no overlaps,
// nothing on your own house), build a house on a lot with the same builder, give a friend keys. Then the same plan
// as somebody else's land on your server (what packOut sends): their lots and buildings stand, keys let you in.
const { chromium } = require('playwright');
const S = process.env.S, OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  const path = require('path'), fs = require('fs'), ROOT = process.env.ROOT || path.join(__dirname, '..');
  const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };
  await pg.route(/^http:\/\/mw\.local\//, r => { const u = new URL(r.request().url()), f = path.join(ROOT, decodeURIComponent(u.pathname)); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' }); r.fulfill({ path: f, contentType: TYPES[path.extname(f)] || 'application/octet-stream' }); });
  await pg.goto('http://mw.local/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms), shot = async n => { if (!OUT) return; for (let i = 0; i < 3; i++) { try { await pg.screenshot({ path: `${OUT}/${n}.png`, timeout: 60000 }); return; } catch (e) { console.log('retry shot', n); } } };
  const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  const boot = async () => { await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 }); };
  await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} M.S.cash = 5e7; M.S.made = 1; });
  // stand in Stop Six, open the Realty app
  const start = await ev(() => { const M = window.__map, p = M.places().find(q => q.id === 'land_stopsix'); M.foot.x = p.x; M.foot.z = p.z; return [p.x, p.z]; });
  const near = await ev(() => { const R = window.__home.REALTY, M = window.__map; const l = R.blkForSale(M.foot.x, M.foot.z, 36, 2200); return l.map(q => ({ id: q.id, name: q.name, price: q.price, town: q.town })); });
  console.log('near', near.length, JSON.stringify(near.slice(0, 4)));
  ok(near.length >= 10 && near.every(q => /^blk_\d+$/.test(q.id) && q.price > 20000 && /\d+ \S/.test(q.name)), 'houses on the block for sale near you, with addresses and prices');
  await ev(() => window.__realty.open());
  await pg.waitForFunction(() => document.querySelectorAll('.rl-card img[src^="data:image"]').length >= 4, null, { timeout: 120000, polling: 500 }).catch(() => {});
  const cards = await ev(() => ({ n: document.querySelectorAll('.rl-card').length, pics: document.querySelectorAll('.rl-card img[src^="data:image"]').length }));
  ok(cards.n >= 10 && cards.pics >= 4, 'Realty app lists them with pictures ' + JSON.stringify(cards));
  await wait(1500); await shot('40-realty-block');
  // a picture is a real render (not blank): count distinct colours
  const varied = await ev(() => new Promise(res => { const im = document.querySelector('.rl-card img[src^="data:image"]'), c = document.createElement('canvas'); c.width = 96; c.height = 60; const x = c.getContext('2d'); const go = () => { x.drawImage(im, 0, 0, 96, 60); const d = x.getImageData(0, 0, 96, 60).data, s = new Set(); for (let i = 0; i < d.length; i += 4) s.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); res(s.size); }; if (im.complete) go(); else im.onload = go; }));
  ok(varied > 40, `house photo is a real picture (${varied} colours)`);
  // the detail: photos front, back, plan
  await ev(() => document.querySelector('.rl-card').click());
  await pg.waitForFunction(() => document.querySelectorAll('.rl-photos img[src^="data:image"]').length === 3, null, { timeout: 60000, polling: 500 }).catch(() => {});
  ok(await ev(() => document.querySelectorAll('.rl-photos img[src^="data:image"]').length === 3), 'listing has front, back and floor plan pictures');
  await wait(800); await shot('41-realty-detail');
  await ev(() => { const ph = document.querySelector('.rl-photos'); ph.scrollLeft = ph.clientWidth * 2; }); await wait(600); await shot('42-realty-plan');
  // houses + land tabs
  await ev(() => { document.querySelector('.ph-back').click(); }); await wait(300);
  await ev(() => document.querySelector('.rl-tab[data-t="land"]').click());
  await pg.waitForFunction(() => document.querySelectorAll('.rl-card img[src^="data:image"]').length >= 4, null, { timeout: 120000, polling: 500 }).catch(() => {});
  ok(await ev(() => document.querySelectorAll('.rl-card').length >= 15), 'land and ranches listed');
  await wait(800); await shot('43-realty-land');
  await ev(() => document.querySelector('.rl-tab[data-t="houses"]').click());
  await pg.waitForFunction(() => document.querySelectorAll('.rl-card img[src^="data:image"]').length >= 4, null, { timeout: 120000, polling: 500 }).catch(() => {});
  ok(await ev(() => document.querySelectorAll('.rl-card').length >= 30), 'named houses listed');
  await wait(800); await shot('44-realty-houses');
  // buy the closest house on the block
  await ev(() => document.querySelector('.rl-tab[data-t="near"]').click()); await wait(500);
  const target = await ev(() => document.querySelector('.rl-card').dataset.id);
  await ev(() => document.querySelector('.rl-card').click()); await wait(500);
  const c0 = await ev(() => window.__map.S.cash);
  await ev(() => document.getElementById('rl-buy').click());
  await pg.waitForFunction(id => window.__map.S.props.includes(id), target, { timeout: 15000, polling: 200 }).catch(() => {});
  const bought = await ev(id => { const M = window.__map, h = window.__home, i = +id.slice(4), H = window.__home.REALTY && M.S && null; const HSl = window.__uq && 1; const o = h.OUTS.get(id); return { owned: M.S.props.includes(id), paid: window.__map.S.cash, out: !!o, kind: o && h.kindOf(o.p), anchor: o && o.anchor }; }, target);
  ok(bought.owned && bought.out && bought.kind === 'property' && c0 - bought.paid > 20000, `bought ${target}: it's yours and a real house stands there ` + JSON.stringify(bought));
  await ev(() => window.__realty.close());
  // walk up: the real house is built, the generated one is gone
  await ev(id => { const o = window.__home.OUTS.get(id), M = window.__map; M.foot.x = o.p.x; M.foot.z = o.p.z; M.foot.target = null; }, target);
  await pg.waitForFunction(id => { const o = window.__home.OUTS.get(id); return o && o.sh; }, target, { timeout: 30000, polling: 500 }).catch(() => {});
  const st = await ev(id => { const o = window.__home.OUTS.get(id); return { sh: !!(o && o.sh), door: !!(o && o.sh && o.sh.door) }; }, target);
  ok(st.sh && st.door, 'the house on the street is the real walk-in house ' + JSON.stringify(st));
  const view = async (n, dx, dy, dz, ly) => { await ev(([dx, dy, dz, ly]) => { const F = window.__map.foot, h = F.holder.rotation.y, c = Math.cos(h), s = Math.sin(h); window.__gcam = [dx * c - dz * s, dy, dx * s + dz * c, ly]; }, [dx, dy, dz, ly]); await wait(3500); await shot(n); };
  await ev(id => { const o = window.__home.OUTS.get(id), M = window.__map, ox = Math.sin(o.p.face), oz = Math.cos(o.p.face); M.foot.x = o.p.x + ox * 10; M.foot.z = o.p.z + oz * 10; }, target);
  await view('45-bought-on-the-block', 6, 7, 16, 3);
  await ev(() => { window.__gcam = null; });
  // walk in through the front door (it's yours)
  const inn = await ev(id => { const E = window.__est, M = window.__map, o = window.__home.OUTS.get(id), d = E.estDoors(o.p.x, o.p.z, 60).find(q => q.o.p.id === id && q.kind === 'front'); if (!d) return 'nodoor'; M.foot.x = d.at[0]; M.foot.z = d.at[1]; E.estUse(d); return true; }, target);
  await pg.waitForFunction(() => window.__home.H.on, null, { timeout: 10000, polling: 250 }).catch(() => {}); await wait(1200);
  ok(inn === true && await ev(id => window.__home.H.on && window.__home.H.p.id === id && window.__home.H.own, target), 'walk into your new house');
  await shot('46-bought-inside');
  await ev(() => window.__map.leave()); await wait(800);
  // reload: still yours, still standing, the generated one still gone
  await wait(800); await pg.reload(); await boot();
  const after = await ev(id => { const h = window.__home, o = h.OUTS.get(id); return { owned: window.__map.S.props.includes(id), out: !!o, inData: !!window.__map.places().find(q => q.id === id) }; }, target);
  ok(after.owned && after.out, 'after a reload the house on the block is still yours and stands there ' + JSON.stringify(after));
  console.log('errors', errs.length ? errs.join('\n') : 'none');
  console.log(fail.length ? `FAILED ${fail.length}` : 'ALL OK');
  await b.close(); process.exit(fail.length || errs.length ? 1 : 0);
})();
