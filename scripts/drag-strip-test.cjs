// Player-built drag strips (2026-11-28). Headless Chromium on the real game, files served from disk (no server).
// S = a folder holding npm/node_modules/three (three@0.128.0), OUT = dir for screenshots.
// Buy a big piece of land, put a 1/4 mile and a 1/8 mile strip on it in the planner (paid, fits rules), the strips show
// up as tracks for roll racing (and in the online invite's Where list), pull into the staging lanes, pick a racer and
// run a real dig on the tree to the slip. Then the same strip as a friend's land: it's on your server too.
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

  // the biggest piece of land there is (a Brazos ranch), yours
  const land = await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} M.S.cash = 5e7; M.S.rep = 9999; M.S.uid = M.S.uid || 'me-test'; M.S.name = M.S.name || 'Kimari';
    const L = M.places().filter(p => p.type === 'land' && p.lot).map(p => ({ p, a: (p.lot.x1 - p.lot.x0) * (p.lot.z1 - p.lot.z0) })).sort((a, b) => b.a - a.a);
    const p = L[0].p; M.S.props.push(p.id); return { id: p.id, name: p.name, w: Math.round(p.lot.x1 - p.lot.x0), d: Math.round(p.lot.z1 - p.lot.z0), acres: Math.round(L[0].a / 4047) }; });
  console.log('land', JSON.stringify(land));
  const LAND = land.id;
  await ev(id => { const R = window.__home.RANCH; R.planOpen(window.__map.places().find(q => q.id === id)); }, LAND); await wait(500);
  const cat = await ev(() => document.getElementById('lp-foot').textContent);
  ok(/Drag strip · 1\/4 mile/.test(cat) && /Drag strip · 1\/8 mile/.test(cat), 'both strips in the planner catalog');
  const put = (k, r, near) => ev(([k, r, near]) => {
    const R = window.__home.RANCH, LP = R.LP, p = LP.p, L = R.lotOfLand(p), c0 = window.__map.S.cash;
    LP.pick = k; LP.ghost = { k, x: 0, z: 0, r };
    const pts = []; for (let z = -L.hd + 4; z < L.hd - 4; z += 8) for (let x = -L.hw + 4; x < L.hw - 4; x += 8) pts.push([x, z]);
    pts.sort((a, b) => Math.hypot(a[0] - near[0], a[1] - near[1]) - Math.hypot(b[0] - near[0], b[1] - near[1]));
    for (const [x, z] of pts) { if (!R.lotFits(p, LP.plan, { k, x, z, r })) { R.planPut(x, z); return { k, x, z, paid: c0 - window.__map.S.cash }; } }
    LP.pick = null; return { k, none: true };
  }, [k, r, near]);
  const hz = await ev(() => { const R = window.__home.RANCH; return R.homeZone(R.LP.p); });
  const hc = hz ? [(hz.x0 + hz.x1) / 2, (hz.z0 + hz.z1) / 2] : [0, 0];
  const q = await put('strip4', 0, [hc[0] + 60, hc[1]]);
  ok(!q.none && q.paid === 450000, 'quarter mile strip put down and paid ' + JSON.stringify(q));
  const e8 = await put('strip8', 1, [hc[0], hc[1] + 120]);
  ok(!e8.none && e8.paid === 250000, 'eighth mile strip (turned) put down and paid ' + JSON.stringify(e8));
  const rule = await ev(() => { const R = window.__home.RANCH, LP = R.LP, it = LP.plan.items.find(i => i.k === 'strip4'); return R.lotFits(LP.p, LP.plan, { k: 'barn', x: it.x, z: it.z + 100, r: 0 }); });
  ok(!!rule, 'nothing goes on top of the strip: ' + rule);
  await ev(() => { const R = window.__home.RANCH; R.LP.sel = R.LP.plan.items.find(i => i.k === 'strip4'); R.planUI(); R.planFit(); R.planDraw(); }); await wait(400);
  ok(await ev(() => !!document.querySelector('#lp-foot [data-a="strip"]')), 'strip has a GPS-to-the-line button');
  await shot('50-planner-strips');

  // they're tracks now: in RR.tracks, in the invite's Where list, and a place you pull into
  const tr = await ev(id => { const RR = window.__yb.rr, ST = window.__home.STRIPS, mine = RR.tracks.filter(t => t.land === id), M = window.__map;
    return { n: mine.length, names: mine.map(t => t.name), lens: mine.map(t => Math.round(t.len)), inv: RR.invPlaces().filter(P => P.id.startsWith('trk:ps')).map(P => P.name + ' / ' + P.sub), room: mine.map(t => RR.roomFor(RR.trackCourse(t), 0, t.len)), places: [...ST.STRIPS.values()].map(v => v.p.type + ':' + v.p.name) }; }, LAND);
  ok(tr.n === 2 && tr.room.every(Boolean), 'both strips are race tracks with room for their distance ' + JSON.stringify(tr));
  ok(tr.inv.length === 2, 'online race invite can pick them ' + JSON.stringify(tr.inv));
  await ev(() => window.__home.RANCH.planClose());

  // pull into the quarter mile's staging lanes in a car
  const T4 = await ev(id => { const t = window.__yb.rr.tracks.find(t => t.land === id && t.len > 300); return t; }, LAND);
  await ev(() => { const M = window.__map; M.S.car = M.newCar('dodge_charger_srt_hellcat_widebody_2020'); M.S.car.fuel = 100; M.foot.on = false; M.gbMode(false); });
  await ev(([x, z]) => window.__map.startDrive(x, z), [T4.x - T4.dx * 10, T4.z - T4.dz * 10]); await wait(2500);
  for (let k = 0; k < 30; k++) { const r = await ev(() => { const M = window.__map; if (M.foot.on) M.getIn(); const o = M.carObj(); return !!(o && o.userData.model); }); if (r) break; await wait(1000); }
  await ev(([x, z, yaw]) => {
    const M = window.__map, Y = window.__yb, RR = Y.rr, d = M.drvS(); Y.test.manual = true;
    Object.assign(d, { x, z, yaw, v: 0, steer: 0 }); d.px = null;
    window.__t = { gas: 0, I() { const T = RR.race, I = Object.assign({}, RR.input()); I.gas = window.__t.gas; if (T) { const e = RR.lat(T.C, d.x, d.z) - T.meLat; let ye = d.yaw - RR.yaw(T.C); ye = Math.atan2(Math.sin(ye), Math.cos(ye)); I.steer = Math.max(-1, Math.min(1, e * 0.35 - ye * 2.2)); } return I; },
      run(n, dt, cond) { for (let i = 0; i < n; i++) { if (window.__t.each) window.__t.each(dt); window.__drvIn = window.__t.I; Y.test.tick(dt); if (cond && cond()) return i + 1; } return -1; } };
    window.__drvIn = window.__t.I;
  }, [T4.x - T4.dx * 10, T4.z - T4.dz * 10, Math.atan2(-T4.dx, -T4.dz)]);
  await ev(() => window.__t.run(30, 1 / 60));
  await pg.waitForFunction(() => !document.getElementById('card').hidden && document.getElementById('c-type').textContent === 'Drag strip', null, { timeout: 20000, polling: 250 }).catch(() => {});
  const card = await ev(() => { const c = document.getElementById('card'); return { shown: !c.hidden, type: document.getElementById('c-type').textContent, name: document.getElementById('c-name').textContent }; });
  ok(card.shown && card.type === 'Drag strip', 'pull up and the strip\'s card shows ' + JSON.stringify(card));
  await shot('51-strip-card');
  // the menu: the dig, the racers, race online
  const menu = await ev(id => { const M = window.__map, p = [...window.__home.STRIPS.STRIPS.values()].find(v => v.t.len > 300 && v.land === id).p; const m = M.MENUS.pstrip(p); window.__pm = m; return { title: m.title, sub: m.sub, rows: m.rows.map(r => r.t + ' | ' + r.btn) }; }, LAND);
  console.log('menu', JSON.stringify(menu, null, 1));
  ok(menu.rows.some(r => /^🏁 Dig on the tree/.test(r)) && menu.rows.some(r => /🌐 Race an online player/.test(r)) && menu.rows.filter(r => / \| Race \$/.test(r)).length >= 3 && !menu.rows.some(r => /^\d+ roll ·|^Pace/.test(r)), 'strip menu: dig on the tree, racers, race online');
  await ev(() => { const M = window.__map; M.openMenu(() => window.__pm); }); await wait(500); await shot('52-strip-menu');
  // pick the first racer: you're both put on the line on the strip
  const st = await ev(() => { const M = window.__map, RR = window.__yb.rr; M.S.rrPrefs = Object.assign(M.S.rrPrefs || {}, { d: 402.34, call: 'them', x: 1 }); const m = M.MENUS.pstrip([...window.__home.STRIPS.STRIPS.values()].find(v => v.t.len > 300).p); const r = m.rows.find(r => / \| Race \$/.test(r.t + ' | ' + r.btn) && !r.off); r.act(); const T = RR.race; if (T && T.A) T.A.jumpy = false; return T && { trk: T.C.trk, kind: T.C.kind, dist: Math.round(T.dist), v0: T.v0, opp: T.A && T.A.r.name, ph: T.ph }; });
  ok(st && st.trk === T4.id && st.kind === 'track' && st.dist === 402 && st.v0 === 0, 'a racer pick puts you both on the strip\'s line for a quarter-mile dig ' + JSON.stringify(st));
  await ev(() => window.__map.closeMenu && window.__map.closeMenu());
  await ev(() => window.__t.run(60, 1 / 60)); await wait(300);
  await shot('53-on-the-tree');
  // run it: gas a quarter second after the go
  await ev(() => { const RR = window.__yb.rr, t = window.__t; t.gas = 0; t.goT = null; t.each = () => { const T = RR.race; if (!T) return; if (T.go != null && t.goT == null) t.goT = T.t; if (t.goT != null && T.t - t.goT >= 0.25 && T.ph === 'run') t.gas = 1; if (T.ph === 'done') t.gas = 0; }; });
  let done = false, midShot = false;
  for (let k = 0; k < 150 && !done; k++) {
    done = await ev(() => window.__t.run(60, 1 / 60, () => !window.__yb.rr.race || window.__yb.rr.race.shown) > 0);
    if (!midShot && await ev(() => { const T = window.__yb.rr.race; return T && T.go != null && T.t - T.go > 3.5; })) { midShot = true; await shot('54-mid-pass'); }
  }
  const res = await ev(() => { const RR = window.__yb.rr, T = RR.race, M = window.__map, H = M.S.rrHist || [], sl = RR.q && RR.q('slip'); return { shown: T && T.shown, me: T && T.me.done && +T.me.done.toFixed(3), mph: T && T.me.mph && +T.me.mph.toFixed(1), ai: T && T.A && T.A.done && +T.A.done.toFixed(3), hist: H[0], slip: sl && !sl.hidden ? sl.innerText.replace(/\s+/g, ' ').slice(0, 300) : null }; });
  ok(done && res.shown && res.me > 8 && res.me < 16 && res.hist && /Quarter Mile/.test(res.hist.road || ''), 'the dig ran to the slip on the strip ' + JSON.stringify(res));
  await wait(400); await shot('55-slip');
  await ev(() => { window.__t.each = null; window.__t.gas = 0; window.__yb.rr.close('left'); });
  // the racer jumps the tree: you still run it out to the stripe and it's your win
  await ev(() => { const M = window.__map, RR = window.__yb.rr; const m = M.MENUS.pstrip([...window.__home.STRIPS.STRIPS.values()].find(v => v.t.len > 300).p); m.rows.find(r => / \| Race \$/.test(r.t + ' | ' + r.btn) && !r.off).act(); if (RR.race && RR.race.A) RR.race.A.jumpy = true;
    const t = window.__t; t.gas = 0; t.goT = null; t.each = () => { const T = RR.race; if (!T) return; if (T.go != null && t.goT == null) t.goT = T.t; if (t.goT != null && T.t - t.goT >= 0.25 && T.ph === 'run') t.gas = 1; if (T.ph === 'done') t.gas = 0; }; });
  for (let k = 0; k < 150; k++) if (await ev(() => window.__t.run(60, 1 / 60, () => !window.__yb.rr.race || window.__yb.rr.race.shown) > 0)) break;
  const jr = await ev(() => { const M = window.__map, H = M.S.rrHist || [], T = window.__yb.rr.race; return { aiJump: T && T.A && T.A.jump, me: H[0] && H[0].me, won: H[0] && H[0].won, why: H[0] && H[0].why }; });
  ok(jr.aiJump && jr.won && jr.me > 8, 'the racer jumps the tree: you run it out and win ' + JSON.stringify(jr));
  await ev(() => { window.__t.each = null; window.__t.gas = 0; window.__yb.rr.close('left'); window.__yb.test.manual = false; });

  // the strip from the air and at the start line
  const look = async (n, x, y, z, lx, ly, lz) => { await ev(([x, y, z, lx, ly, lz]) => { window.__home.RANCH.ranchStep(); const C = window.__map.cam(); window.__camHold = [x, y, z, lx, ly, lz]; C.position.set(x, y, z); C.lookAt(lx, ly, lz); C.updateMatrixWorld(); }, [x, y, z, lx, ly, lz]); await wait(2500); await shot(n); };
  const c = (s, lat, y) => [T4.x + T4.dx * s - T4.dz * lat, y, T4.z + T4.dz * s + T4.dx * lat];
  const geo = await ev(() => { const M = window.__map; return { hold: typeof window.__gcam }; });
  await ev(() => { window.__gcam = null; });
  // a chase-cam view from behind the line (the frame loop owns the camera; park the car there and look with __gcam)
  await ev(([x, z, yaw]) => { const M = window.__map, d = M.drvS(); Object.assign(d, { x, z, yaw, v: 0 }); d.px = null; }, [T4.x - T4.dx * 6 - T4.dz * 3.1, T4.z - T4.dz * 6 + T4.dx * 3.1, Math.atan2(-T4.dx, -T4.dz)]);
  await ev(() => window.__map.getOut && window.__map.getOut()); await wait(800);
  await ev(([x, z]) => { const F = window.__map.foot; F.x = x; F.z = z; F.target = null; }, [T4.x - T4.dx * 22, T4.z - T4.dz * 22]);
  const aerial = async (n, fx, fz, dx, dy, dz, ly) => { await ev(([fx, fz, dx, dy, dz, ly]) => { const F = window.__map.foot; F.x = fx; F.z = fz; F.target = null; const h = F.holder.rotation.y, c = Math.cos(h), s = Math.sin(h); window.__gcam = [dx * c - dz * s, dy, dx * s + dz * c, ly]; window.__home.RANCH.ranchStep(); }, [fx, fz, dx, dy, dz, ly]); await wait(3500); await shot(n); };
  const at = (s, lat) => [T4.x + T4.dx * s - T4.dz * lat, T4.z + T4.dz * s + T4.dx * lat];
  let [ax, az] = at(8, 0); await aerial('56-start-line', ax, az, -4, 3.5, -24, 2);
  [ax, az] = at(60, 0); await aerial('57-strip-aerial', ax, az, 0, 90, 120, 0);
  [ax, az] = at(402, 0); await aerial('58-finish', ax, az, 6, 5, 22, 4);
  await ev(() => { window.__gcam = null; });

  // a friend's land with a strip: it's a track on your server too (what packOut sends)
  const fr = await ev(id => {
    const h = window.__home, M = window.__map, p = M.places().find(q => q.id === id), sv = h.RANCH.packOut(p), RR = window.__yb.rr;
    const others = M.places().filter(q => q.type === 'land' && q.lot && q.id !== id && !M.S.props.includes(q.id)).map(q => ({ q, a: (q.lot.x1 - q.lot.x0) * (q.lot.z1 - q.lot.z0) })).sort((a, b) => b.a - a.a);
    const o = others[0].q, L = h.RANCH.lotOfLand(o), s2 = { lot: { n: 1, items: [] } };
    // a 1/8 mile that fits their land
    for (let z = -L.hd + 4; z < L.hd - 4 && !s2.lot.items.length; z += 8) for (let x = -L.hw + 4; x < L.hw - 4; x += 8) for (const r of [0, 1]) { const it = { k: 'strip8', x, z, r }; if (!h.RANCH.lotFits(o, { items: [] }, it) || !h.RANCH.homeZone(o)) { s2.lot.items.push(it); break; } if (s2.lot.items.length) break; }
    h.FOREIGN.set(o.id, { sv: s2, name: 'Lawrence', uid: 'lawrence-uid' }); h.rebuildOutside(o.id); h.RANCH.ranchSync(o.id); h.STRIPS.stripPush();
    const t = RR.tracks.find(t => t.land === o.id);
    const n1 = RR.tracks.filter(t => t.land === o.id).length;
    h.FOREIGN.get(o.id).sv = { lot: null }; h.RANCH.ranchSync(o.id); h.STRIPS.stripPush();
    return { mineSize: JSON.stringify(sv).length, mineStrips: sv.lot.items.filter(i => i.k.startsWith('strip')).length, land: o.id, fit: s2.lot.items.length, t: t && { name: t.name, owner: t.owner, len: Math.round(t.len) }, n1, after: RR.tracks.filter(t => t.land === o.id).length };
  }, LAND);
  ok(fr.mineStrips === 2, 'your strips ride along with your land to the server and your deed ' + JSON.stringify({ size: fr.mineSize, n: fr.mineStrips }));
  ok(fr.t && fr.t.owner === 'Lawrence' && /Lawrence's Eighth Mile/.test(fr.t.name) && fr.after === 0, 'a friend\'s strip is a track on your server, and goes when they take it down ' + JSON.stringify(fr));
  // remove your eighth mile: refund and the track goes
  const rm = await ev(id => { const R = window.__home.RANCH, M = window.__map; R.planOpen(M.places().find(q => q.id === id)); const it = R.LP.plan.items.find(i => i.k === 'strip8'), c0 = M.S.cash; R.planRemove(it); R.planRemove(it); R.planClose(); return { back: M.S.cash - c0, left: window.__yb.rr.tracks.filter(t => t.land === id).length }; }, LAND);
  ok(rm.back === 250000 && rm.left === 1, 'taking a strip down pays it back and takes the track off ' + JSON.stringify(rm));

  console.log('errors', errs.length ? errs.join('\n') : 'none');
  console.log(fail.length ? `FAILED ${fail.length}` : 'ALL OK');
  await b.close(); process.exit(fail.length || errs.length ? 1 : 0);
})();
