// House builder upgrade (2026-11-28). Headless Chromium on the real game. Serve the repo on PORT (default 8790),
// S = a folder holding npm/node_modules/three (three@0.128.0), OUT = dir for screenshots.
// Land A: drag to draw rooms and walls (live price), undo/redo with the money, French doors, a slider, a pool,
// floor finishes, inside paint, gable roof + board & batten, new furniture (place, nudge, copy). Land B: the Mansion
// plan (3 floors, theater, studio, pool). Land C: Modern + pool. Saves round-trip through pack/design (online).
const { chromium } = require('playwright');
const PORT = process.env.PORT || 8790, S = process.env.S, OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  // no server needed: the repo's files are served straight from disk (ROOT, default the repo)
  const path = require('path'), fs = require('fs'), ROOT = process.env.ROOT || path.join(__dirname, '..');
  const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };
  await pg.route(/^http:\/\/mw\.local\//, r => { const u = new URL(r.request().url()), f = path.join(ROOT, decodeURIComponent(u.pathname)); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' }); r.fulfill({ path: f, contentType: TYPES[path.extname(f)] || 'application/octet-stream' }); });
  await pg.goto(`http://mw.local/index.html?test=1`);
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms), shot = async n => { if (OUT) await pg.screenshot({ path: `${OUT}/${n}.png` }); };
  const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  const lands = await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} M.S.cash = 5e7; M.S.car = M.newCar('chevrolet_caprice_classic_1990'); M.S.car.fuel = 100;
    const P = M.places().filter(q => q.type === 'land').slice(0, 3); for (const p of P) M.S.props.push(p.id); return P.map(p => ({ id: p.id, name: p.name, x: p.x, z: p.z })); });
  console.log('lands', JSON.stringify(lands));
  const cash = () => ev(() => window.__map.S.cash);

  // ---------- land A: build it by hand
  const A = lands[0];
  await ev(id => window.__map.enter(id), A.id); await wait(1500);
  await ev(() => { const h = window.__home; if (!h.DECO.on) h.decoStart(); h.buildMode(); });
  const drag = (a, bb, kind) => ev(([a, bb, kind]) => { const h = window.__home, f = kind === 'wall' ? h.cornerXZ : h.tileXZ; const p0 = f(a[0], a[1]), p1 = f(bb[0], bb[1]);
    const down = h.dragDown(p0); h.dragMove({ x: (p0.x + p1.x) / 2, z: (p0.z + p1.z) / 2 }); h.dragMove(p1); const est = h.DECO.est && Object.assign({}, h.DECO.est), tip = document.querySelector('#deco .dn').textContent; h.dragUp(p1); return { down, est, tip }; }, [a, bb, kind]);
  let c0 = await cash();
  await ev(() => window.__home.tool({ t: 'room', c: 'L' }));
  const r1 = await drag([3, 1], [8, 4], 'rect');
  let c1 = await cash();
  ok(r1.down && r1.est && r1.est.w === 6 && r1.est.h === 4 && r1.est.diff === 24 * 1400, 'drag shows the room and its price before you let go ' + JSON.stringify(r1));
  ok(c0 - c1 === 24 * 1400, `living room charged ${c0 - c1}`);
  await ev(() => window.__home.tool({ t: 'room', c: 'K' })); await drag([9, 1], [12, 4], 'rect');
  await ev(() => window.__home.tool({ t: 'room', c: 'B' })); await drag([3, 5], [7, 7], 'rect');
  await ev(() => window.__home.tool({ t: 'room', c: 'A' })); await drag([8, 5], [9, 7], 'rect');
  await ev(() => window.__home.tool({ t: 'room', c: 'T' })); await drag([10, 5], [12, 7], 'rect');
  await ev(() => window.__home.tool({ t: 'room', c: 'P' })); await drag([3, 0], [12, 0], 'rect'); await drag([3, 8], [12, 11], 'rect');
  await ev(() => window.__home.tool({ t: 'room', c: 'W' })); await drag([5, 9], [10, 10], 'rect');
  const fl0 = await ev(() => window.__home.H.d.floors[0]);
  ok((fl0.match(/W/g) || []).length === 12 && (fl0.match(/T/g) || []).length === 9, 'pool and home theater laid');
  // undo / redo: the pool comes out and the money comes back, then goes back in
  c0 = await cash();
  await ev(() => window.__home.undo()); c1 = await cash();
  const noPool = await ev(() => (window.__home.H.d.floors[0].match(/W/g) || []).length);
  ok(noPool === 0 && c1 - c0 === 12 * (3500 - 400), `undo takes the pool out (back to deck) and refunds every dollar: ${c1 - c0}`);
  await ev(() => window.__home.redo()); const c2 = await cash();
  ok((await ev(() => (window.__home.H.d.floors[0].match(/W/g) || []).length)) === 12 && c1 - c2 === 12 * (3500 - 400), 'redo puts it back and charges again');
  // walls: French doors and a slider out the back, a wide opening, a brick accent wall
  await ev(() => window.__home.tool({ t: 'wall', k: 'french' })); await drag([5, 8], [6, 8], 'wall');
  await ev(() => window.__home.tool({ t: 'wall', k: 'slider' })); await drag([10, 8], [11, 8], 'wall');
  await ev(() => window.__home.tool({ t: 'wall', k: 'arch' })); await drag([9, 2], [9, 3], 'wall');
  await ev(() => window.__home.tool({ t: 'wall', k: 'brickw' })); await drag([10, 5], [10, 6], 'wall');
  const walls = await ev(() => window.__home.H.d.walls[0].map(w => w.k).sort().join(','));
  ok(/arch/.test(walls) && /brickw/.test(walls) && /french/.test(walls) && /slider/.test(walls), 'new walls in ' + walls);
  await shot('01-build-drag');
  // a drag in progress: the outline and the price
  await ev(() => { const h = window.__home; h.tool({ t: 'room', c: 'B' }); const p0 = h.tileXZ(3, 5), p1 = h.tileXZ(12, 7); h.dragDown(p0); h.dragMove(p1); });
  await wait(600); await shot('02-drag-preview');
  await ev(() => { const h = window.__home; h.DRAG.on = false; h.DECO.est = null; h.buildMode(); });
  // finishes + paint + outside
  c0 = await cash();
  await ev(() => window.__home.finEdit('L', 'marble')); c1 = await cash();
  ok(c0 - c1 === 24 * 900, `marble floor in the living room ${c0 - c1}`);
  await ev(() => { const h = window.__home; h.finEdit('B', 'walnut'); h.finEdit('K', 'herring'); h.finEdit('A', 'blackm'); h.finEdit('T', 'carpet'); });
  await ev(() => { const h = window.__home, d = h.H.d; Object.assign(d, { iw: '#ece6da', trim: '#1a1c22', door: '#22345a', skin: 'batten', roofStyle: 'gable', wall: '#f2f2f2', roof: '#2a2a2e' }); h.decoEnd(); h.decoStart(); });
  // furniture: theater seats + screen, loungers, an umbrella, nudge, copy
  const placeIt = (id, x, y, r) => ev(([id, x, y, r]) => { const h = window.__home; h.buy(id); const f = h.DECO.f; f.x = x; f.y = y; f.r = r; h.showPlace(); const why = h.DECO.why; if (why) h.cancelPlace(); else h.confirmPlace(); return why; }, [id, x, y, r]);
  const wh = [await placeIt('screen', 11, 7, 0), await placeIt('theater', 11, 6, 2), await placeIt('lounger', 3, 9, 0), await placeIt('umbrella', 11, 9, 0), await placeIt('sectional', 3, 2, 0), await placeIt('tv', 6, 1, 2)];
  ok(wh.every(w => !w), 'new pieces placed ' + JSON.stringify(wh));
  const nud = await ev(() => { const h = window.__home; h.IN.camYaw = 0; h.buy('plant'); const f = h.DECO.f; f.x = 7; f.y = 3; h.draw(); h.nudge(1, 0); const a = [f.x, f.y]; h.nudge(0, 1); const b = [f.x, f.y]; h.cancelPlace && 0; return { a, b }; });
  ok(nud.a[0] !== 7 || nud.a[1] !== 3, 'nudge moves it a tile ' + JSON.stringify(nud));
  await ev(() => { const h = window.__home; if (h.DECO.mode === 'place') { if (h.DECO.why) h.cancelPlace(); else h.confirmPlace(); } });
  const cp = await ev(() => { const h = window.__home, src = h.H.d.furn[0].find(f => f.id === 'lounger'); src.look = { s: 1, c: { main: '#22345a' } }; h.tapTile(src.x, src.y); const btn = document.querySelector('[data-a="copy"]'); if (!btn) return { mode: h.DECO.mode, sel: h.DECO.sel, src, html: document.getElementById('deco').innerHTML.slice(0, 300) }; btn.click(); const f = h.DECO.f; const r = { id: f.id, look: f.look, why: h.DECO.why }; h.confirmPlace(); return r; });
  ok(cp.id === 'lounger' && cp.look && cp.look.s === 1 && !cp.why, 'copy buys the same piece in the same style ' + JSON.stringify(cp));
  ok(!!(await ev(() => { const h = window.__home; return h.H.sh.solids[0].some(s => s.h === 0.5); })), 'the pool is solid (you walk round it)');
  ok(!!(await ev(() => window.__home.canPlace(window.__home.H.d, 0, { id: 'chairs', x: 6, y: 9, r: 0 }))), 'nothing goes in the pool');
  // the save carries it all (this is what other players get)
  const rt = await ev(id => { const h = window.__home, d = h.H.d, pk = h.pack(d), p = window.__map.places().find(q => q.id === id), d2 = h.design(p, JSON.parse(JSON.stringify(pk))); return { fin: d2.fin, iw: d2.iw, skin: d2.skin, roof: d2.roofStyle, walls: d2.walls[0].length === d.walls[0].length, furn: d2.furn[0].length === d.furn[0].length, pool: (d2.floors[0].match(/W/g) || []).length }; }, A.id);
  ok(rt.fin.L === 'marble' && rt.iw === '#ece6da' && rt.skin === 'batten' && rt.roof === 'gable' && rt.walls && rt.furn && rt.pool === 12, 'pack -> design round trip (online) ' + JSON.stringify(rt));
  await ev(() => window.__home.draw()); await wait(1500); await shot('03-builder-overview');
  await ev(() => { const h = window.__home; h.DECO.sel = null; h.DECO.mode = 'paint'; h.DECO.finRoom = 'L'; h.draw(); }); await wait(800); await shot('04-paint-panel');
  await ev(() => window.__home.decoEnd()); await wait(800);
  // inside views
  const inView = async (n, tx, ty, yaw, pitch) => { await ev(([tx, ty, yaw, pitch]) => { const h = window.__home, IN = h.IN, p = h.tileXZ(tx, ty); IN.pos.set(p.x, 0, p.z); IN.avatar.position.copy(IN.pos); IN.camYaw = yaw; IN.yaw = yaw; h.LOOK.pitch = pitch; IN.target = null; }, [tx, ty, yaw, pitch]); await wait(2200); await shot(n); };
  await inView('05-inside-living-marble', 5, 3, Math.PI * 0.85, 0.2);
  await inView('06-inside-theater', 11, 5, 0, 0.25);
  await inView('07-inside-french-doors', 6, 7, Math.PI, 0.15);

  // ---------- land B: the Mansion plan; land C: Modern + pool
  const plan = async (land, id) => {
    await ev(() => window.__map.leave()); await wait(800);
    await ev(id => window.__map.enter(id), land.id); await wait(1500);
    const c0 = await cash();
    const r = await ev(id => { const h = window.__home; if (!h.DECO.on) h.decoStart(); h.buildMode(); h.usePreset(id); h.usePreset(id); const d = h.H.d, pr = h.PRESETS[id];
      const want = pr.furn.map(l => l.length), got = d.furn.map(l => l.length), lost = pr.furn.map((l, k) => l.filter(f => !d.furn[k].some(g => g.id === f.id && g.x === f.x && g.y === f.y)).map(f => `${f.id}@${f.x},${f.y}`));
      return { floors: d.floors.length, want, got, lost, summary: h.summary(d), skin: d.skin, roof: d.roofStyle, fin: d.fin }; }, id);
    console.log(id, JSON.stringify(r), 'cost', c0 - await cash());
    return r;
  };
  const B = await plan(lands[1], 'mansion');
  ok(B.floors === 3 && B.lost.every(l => !l.length), 'mansion built with every piece ' + JSON.stringify(B.lost));
  await wait(1500); await shot('08-mansion-builder');
  await ev(() => window.__home.decoEnd()); await wait(800);
  await inView('09-mansion-studio', 12, 6, 0.3, 0.2);
  await inView('10-mansion-living', 4, 2, Math.PI * 0.8, 0.2);
  const Cc = await plan(lands[2], 'modern');
  ok(Cc.floors === 2 && Cc.lost.every(l => !l.length), 'modern built with every piece ' + JSON.stringify(Cc.lost));
  await wait(1500); await shot('11-modern-builder');
  await ev(() => window.__home.decoEnd()); await wait(800);

  // ---------- out on the street: each house from the front and the back
  await ev(() => window.__map.leave()); await wait(1500);
  for (const [i, land] of lands.entries()) {
    if (false) { await ev(l => { const M = window.__map; M.startDrive(l.x, l.z); }, land); await wait(2500);
    await ev(() => { const M = window.__map; M.getOut(); if (!M.foot.park) M.foot.park = { x: M.drv.x, z: M.drv.z, yaw: M.drv.yaw }; }); await wait(2500); }
    else { await ev(l => { const F = window.__map.foot; F.x = l.x; F.z = l.z; F.target = null; window.__gcam = null; }, land); await wait(2500); }
    await pg.waitForFunction(id => { const o = window.__home.OUTS.get(id); return o && o.sh; }, land.id, { timeout: 30000, polling: 500 }).catch(() => {});
    const W = await ev(id => { const o = window.__home.OUTS.get(id); if (!o || !o.sh) return null; const sh = o.sh, w = (a, b) => o.pl.toWorld(a, b); return { front: w(sh.door.x, sh.door.z - 12), back: w(sh.door.x, sh.door.z + 30), ry: o.ry }; }, land.id);
    if (!W) { const dbg = await ev(id => { const o = window.__home.OUTS.get(id), c = window.__map.camera || {}; return { has: !!o, group: !!(o && o.group), proxy: !!(o && o.proxy), anchor: o && o.anchor, foot: [window.__map.foot.x, window.__map.foot.z], saved: !!window.__map.S.homes[id], built: window.__home.design(o.p)._built }; }, land.id); ok(false, 'house on the street ' + land.id + ' ' + JSON.stringify(dbg)); continue; }
    const rot = (dx, dz) => { const c = Math.cos(W.ry), s = Math.sin(W.ry); return [dx * c + dz * s, -dx * s + dz * c]; };
    const view = async (n, f, dx, dy, dz, ly) => { await ev(([fx, fz, dx, dy, dz, ly]) => { const F = window.__map.foot, h = F.holder.rotation.y, c = Math.cos(h), s = Math.sin(h); F.x = fx; F.z = fz; F.target = null; window.__gcam = [dx * c - dz * s, dy, dx * s + dz * c, ly || 1.5]; }, [f[0], f[1], dx, dy, dz, ly]); await wait(3200); await shot(n); };
    { const [a, c] = rot(-8, -14); await view(`${12 + i * 2}-street-front-${['custom', 'mansion', 'modern'][i]}`, W.front, a, 6, c, 4); }
    { const [a, c] = rot(10, 12); await view(`${13 + i * 2}-back-pool-${['custom', 'mansion', 'modern'][i]}`, W.back, a, 9, c, 2); }
    await ev(() => { window.__gcam = null; });
  }
  console.log('errors', errs.length ? errs.join('\n') : 'none');
  console.log(fail.length ? `FAILED ${fail.length}` : 'ALL OK');
  await b.close(); process.exit(fail.length || errs.length ? 1 : 0);
})();
