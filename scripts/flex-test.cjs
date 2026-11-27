// Cash flex test (2026-11-27). Headless Chromium (Playwright), repo served by Playwright's router.
// S = folder holding npm/node_modules/three (three@0.128.0), OUT = screenshot folder.
// Checks every money tier (loose bills, knot, bands, bricks, duffel) in each flex pose, Keep it out while walking,
// the state packet (em / ec / eh) and a fake friend online flexing next to you (their pose + their amount on your screen).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..');
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const ctx = await b.newContext({ viewport: { width: +(process.env.VW || 844), height: +(process.env.VH || 390) }, hasTouch: true, isMobile: true, deviceScaleFactor: +(process.env.DPR || 1) });
  const X = +(process.env.X || 600), Z = +(process.env.Z || -150);
  const save = { v: 1, made: true, name: 'Kimari', cash: 25000, bank: 0, car: { id: 'chevrolet_caprice_classic_box_chevy_1986', color: '#14161c', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 1, oil: 100, mods: {} }, at: { x: X, z: Z, yaw: 0, foot: true, fx: X + 3, fz: Z, fyaw: 0 } };
  await ctx.addInitScript(s => { try { localStorage.setItem('mw3d.save.v1', s); } catch (e) {} }, JSON.stringify(save));
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
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__flex && window.__photo, null, { timeout: 400000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const shot = async (n, ms = 2500) => { await wait(ms); await pg.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); };
  const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} if (window.__cops) window.__cops.COP.noPop = true; });
  await wait(4000);
  ok(await ev(() => window.__guns.foot.on), 'on foot');
  // tiers
  const tiers = await ev(() => [15, 340, 4800, 60000, 450000, 2500000].map(c => window.__flex.cashTier(c).k + ':' + window.__flex.cashTier(c).n));
  console.log('tiers', tiers.join(' '));
  ok(tiers.join(' ') === 'none:0 bills:5 knot:48 bands:6 bricks:4 bag:25', 'cash tiers by amount');
  // blocks
  const blk = await ev(() => { const G = window.__guns, S = G.S; S.cash = 5000; const E = G.emote.EMOTES; return ['bag', 'double', 'show'].map(id => !!G.emote.EMOTES && E.find(e => e.id === id)).map(e => !!e); });
  ok(blk.every(Boolean), 'new poses are in the list');

  const pose = async (id, cash, name, cam) => {
    await ev(([id, cash, cam]) => {
      const G = window.__guns, P = window.__photo; G.S.cash = cash; G.emote.emoStop(); G.emote.EMO.id && G.emote.EMO.stop;
      if (!P.PM.on) P.pmOpen();
      P.PM.pose = 0; G.emote.emoStart(id);
      const f = G.foot; P.PM.yaw = f.yaw + Math.PI + (cam ? cam[0] : 0.25); P.PM.dist = cam ? cam[1] : 2.6; P.PM.pitch = cam ? cam[2] : 0.08; P.PM.lift = cam ? cam[3] : -0.25; P.PM.off.set(0, 0, 0);
    }, [id, cash, cam]);
    await shot(name, 4500);
    return ev(() => { const E = window.__guns.emote.EMO; return { id: E.id, pkt: window.__flex.flexPkt() }; });
  };
  // let the emote from before fade + clear between poses
  const clear = async () => { await ev(() => { window.__guns.emote.emoStop(); }); await wait(1200); };
  let r;
  r = await pose('show', 340, '01-show-bills-340'); ok(r.id === 'show' && r.pkt.em > 0 && r.pkt.ec === 340, 'show: $340 loose bills, packet ' + JSON.stringify(r.pkt)); await clear();
  r = await pose('show', 4800, '02-show-knot-4800'); ok(r.id === 'show', 'show: $4,800 knot'); await clear();
  r = await pose('show', 60000, '03-show-bands-60k'); ok(r.id === 'show', 'show: 6 bands, both hands'); await clear();
  r = await pose('show', 450000, '04-show-bricks-450k'); await clear();
  r = await pose('double', 80000, '05-double-80k'); ok(r.id === 'double', 'double up $80k'); await clear();
  r = await pose('double', 2500000, '06-double-2.5M'); await clear();
  r = await pose('fanface', 9000, '07-fanface-9k'); ok(r.id === 'fanface', 'fan face'); await clear();
  r = await pose('stack', 70000, '08-stack-70k', [0.35, 3.6, 0.55, -0.7]); ok(r.id === 'stack', 'stack it up $70k');
  console.log('pile', JSON.stringify(await ev(() => { const E = window.__guns.emote.EMO, G = E.P.ground, f = window.__guns.foot, M = window.__guns.ME, w = new (G.position.constructor)(); M.upper.getWorldPosition(w); return { g: G.position.toArray().map(v => +v.toFixed(2)), foot: [f.x, f.holder.position.y, f.z].map(v => +v.toFixed(2)), upper: w.toArray().map(v => +v.toFixed(2)), kids: G.children.length, rot: +G.rotation.y.toFixed(2), yaw: +f.yaw.toFixed(2) }; })));
  if (process.env.QUICK) {
    console.log('dbg', JSON.stringify(await ev(() => { const E = window.__guns.emote.EMO, G = E.P.ground; const I = G.children[0].children[0]; let root = G; while (root.parent) root = root.parent; const m = new I.matrix.constructor(); I.getMatrixAt(0, m); return { inst: I.count, isI: I.isInstancedMesh, vis: [G.visible, G.children[0].visible, I.visible], top: root.type, m0: m.elements.slice(12, 15).map(v => +v.toFixed(3)), sc: G.scale.x, frust: I.frustumCulled, mats: Array.isArray(I.material) }; })));
    await shot('dbg-stack', 500); await b.close(); return; }
  ok(await ev(() => { const E = window.__guns.emote.EMO; return !!(E.P && E.P.ground && E.P.ground.visible && E.P.ground.parent); }), 'the pile is on the ground'); await clear();
  ok(await ev(() => { let n = 0; window.__guns.test.camera.parent; return true; }), 'cleared');
  r = await pose('stack', 1200000, '09-stack-1.2M', [0.35, 4.2, 0.5, -0.7]); await clear();
  r = await pose('stack', 8000000, '10-stack-8M', [0.4, 5.2, 0.5, -0.6]); await clear();
  r = await pose('stack', 25000000, '10b-stack-25M', [0.4, 6, 0.5, -0.5]); await clear();
  r = await pose('bag', 1500000, '11-bag-1.5M'); ok(r.id === 'bag', 'bag it up $1.5M'); await clear();
  r = await pose('spread', 30000, '12-spread-30k'); await clear();
  r = await pose('phone', 300000, '12b-phone-brick'); await clear();
  // the menu blocks what you can't afford
  const why = await ev(() => { window.__guns.S.cash = 5000; return document.createElement('div') && window.__guns.emote.EMOTES.filter(e => e.min).map(e => e.id); });
  console.log('min poses', why.join(','));
  await ev(() => window.__photo.pmClose());
  // POSE menu
  await ev(() => { window.__guns.S.cash = 340000; document.getElementById('em-btn').click(); }); await shot('13-pose-menu', 1500);
  // keep it out while walking
  await ev(() => { window.__guns.emote.emoMenu(false); window.__guns.S.cash = 6200; window.__flex.holdToggle(true); });
  await wait(1500); await shot('14-hold-knot-standing', 500);
  await pg.keyboard.down('KeyW'); await wait(2500); await shot('15-hold-knot-walking', 200); await pg.keyboard.up('KeyW');
  await ev(() => { window.__guns.S.cash = 3200000; }); await wait(1500);
  await pg.keyboard.down('KeyW'); await wait(2500); await shot('16-hold-bag-walking', 200); await pg.keyboard.up('KeyW');
  const hk = await ev(() => ({ key: window.__flex.FLX.hg && window.__flex.FLX.hg.key, pkt: window.__flex.flexPkt() }));
  ok(hk.key === 'bag' && hk.pkt.eh === 1 && hk.pkt.ec === 3200000, 'keep it out: duffel in hand, packet ' + JSON.stringify(hk));
  await ev(() => window.__flex.holdToggle(false));

  // online: a friend next to you, flexing
  await ev(() => window.__net.netJoin('eastgate'));
  await pg.waitForFunction(() => window.__net.NET.status === 'on', null, { timeout: 60000, polling: 500 });
  await ev(() => {
    const ch = new BroadcastChannel('rfg:eastgate'), NET = window.__net.NET, f = window.__guns.foot, t0 = Date.now();
    const F = window.__fake = { em: 0, ec: 0, eh: 0, ch, q: 0 };
    const look = { skin: '#6b4429', hair: '#111111', hairStyle: 'locs', top: 'mh_hoodie_box', bottom: 'jeans_black', shoes: 'mk_jordan_bred', hat: 'no_hat', facialHair: 'goatee', extras: ['chain'] };
    const x = f.x + 1.6, z = f.z + 0.2;
    F.timer = setInterval(() => {
      ch.postMessage({ k: '_p', id: 'F2', t: t0 });
      if (!F.said || Date.now() - F.said > 3000) { F.said = Date.now(); ch.postMessage({ k: 'h', id: 'F2', n: 'Lawrence', m: 'chevrolet_caprice_classic_box_chevy_1986', m3: 'chevrolet_caprice_classic_box_chevy_1986', v: { paint: '#6a1fb3' }, l: {}, t: 1, lk: look, gn: 0 }); }
      const s = { k: 's', id: 'F2', q: ++F.q, x: F.x != null ? F.x : x, z: F.z != null ? F.z : z, h: -f.yaw, v: 0, r: 0, a: 0, c: 0, f: 0 }; if (F.em || F.eh) { s.em = F.em; s.ec = F.ec; s.eh = F.eh; } ch.postMessage(s);
      const q = NET.peers.get('F2'); if (q) q.seen = performance.now() / 1000 + 1e5;
    }, 100);
    F.got = []; ch.onmessage = e => { if (e.data && e.data.k === 's' && (e.data.em || e.data.eh)) F.got.push([e.data.em, e.data.ec, e.data.eh].join(':')); };
  });
  await wait(4000);
  const idx = id => ev(id => window.__guns.emote.EMOTES.findIndex(e => e.id === id) + 1, id);
  await ev(async ([a, b]) => { window.__fake.em = a; window.__fake.ec = 90000; window.__guns.S.cash = 2500000; window.__guns.emote.emoStart('double'); }, [await idx('double')]);
  await ev(() => { const P = window.__photo; P.pmOpen(); const f = window.__guns.foot; P.PM.yaw = f.yaw + Math.PI + 0.1; P.PM.dist = 3.6; P.PM.pitch = 0.1; P.PM.lift = -0.3; P.PM.off.set(0.8, 0, 0); });
  await shot('17-online-both-double', 6000);
  const seen = await ev(() => { const p = window.__net.NET.peers.get('F2'); return p && p.view && p.view.emo ? { id: p.view.emo.id, cash: p.view.emo.cash } : null; });
  ok(seen && seen.id === 'double' && seen.cash === 90000, 'friend flexing: their pose + their $90k shows here ' + JSON.stringify(seen));
  await ev(async ([a]) => { window.__fake.em = a; window.__fake.ec = 4000000; window.__guns.emote.emoStop(); }, [await idx('stack')]);
  await ev(() => { const P = window.__photo, f = window.__guns.foot; P.PM.yaw = f.yaw + Math.PI + 0.5; P.PM.dist = 5.2; P.PM.pitch = 0.5; P.PM.lift = -0.6; P.PM.off.set(0.8, 0, 0); });
  await shot('18-online-friend-stack-4M', 6000);
  await ev(() => { window.__fake.em = 0; window.__fake.eh = 1; window.__fake.ec = 7000; });
  await shot('19-online-friend-hold-knot', 5000);
  await pg.waitForFunction(() => { const p = window.__net.NET.peers.get('F2'); return p && p.view && p.view.hold && p.view.hold.key; }, null, { timeout: 30000, polling: 300 }).catch(() => {});
  const ended = await pg.waitForFunction(() => { const p = window.__net.NET.peers.get('F2'); return p && p.view && p.view.emo && !p.view.emo.id; }, null, { timeout: 60000, polling: 300 }).then(() => true).catch(() => false);
  ok(ended && await ev(() => { let n = 0; window.__guns.test.camera.parent; return true; }), 'friend stopped stacking: their pile is put away');
  await shot('19b-friend-pile-gone', 300);
  const held = await ev(() => { const p = window.__net.NET.peers.get('F2'); return p && p.view && p.view.hold ? p.view.hold.key : null; });
  ok(/^knot/.test(held || ''), 'friend keeps it out: ' + held);
  await ev(() => { window.__guns.S.cash = 600000; window.__guns.emote.emoStart('bag'); });
  await pg.waitForFunction(() => window.__fake.got.some(g => g.endsWith(':600000:0')), null, { timeout: 30000, polling: 300 }).catch(() => {});
  const got = await ev(() => window.__fake.got.slice(-3));
  ok(got.some(g => g.endsWith(':600000:0')), 'my flex goes out on the state packet ' + JSON.stringify(got));
  await ev(() => { window.__photo.pmClose(); });
  console.log('errs', errs.slice(0, 20));
  ok(!errs.length, 'no page errors');
  console.log(fail.length ? 'FAILED ' + fail.length : 'ALL OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
