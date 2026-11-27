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
  const shot = async (n, ms = 2500) => { await wait(ms); await pg.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); };
  const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} if (window.__cops) window.__cops.COP.noPop = true; });
  await wait(4000);
  const J = () => window.__jewel;
  // places
  const pl = await ev(() => { const D = window.__jewel.data(); const all = D ? D.P : []; return all.filter(p => p.type === 'jeweler').map(p => p.name + '@' + p.x + ',' + p.z); }).catch(() => []);
  console.log('jewelers', pl); ok(pl.length === 2, 'two jewelers on the map');
  const benchWait = () => pg.waitForFunction(() => { const B = window.__jewel.JB; return B.on && !B.busy && (B.item || B.tab === 'mine'); }, null, { timeout: 180000, polling: 300 });
  const open = async (tab, preset, me) => {
    await ev(([tab, preset, me]) => { const W = window.__jewel, B = W.JB; if (!B.on) W.jbOpen({ name: 'Glitch Ice Co.', rate: 1 }, tab); B.tab = tab; if (preset != null) { B.st = B.st || {}; B.st[tab] = { ...W.JW.DEF[tab], ...W.JW.PRESETS[tab][preset][1] }; } B.nameTouched = false; B.mode = me ? 'me' : 'display'; }, [tab, preset, me]);
    await ev(() => { const W = window.__jewel; W.JB.el.querySelector('[data-t="' + W.JB.tab + '"]').click(); });
    await benchWait();
  };
  if (on('bench')) {
    const shots = [['chain', 0, '01-bench-name-tennis'], ['chain', 2, '02-bench-iced-cuban'], ['chain', 3, '03-bench-medallion-rope'], ['chain', 5, '04-bench-block-name-cuban'], ['watch', 0, '05-bench-bust-down'], ['watch', 3, '06-bench-gold-chrono'], ['more', 0, '07-bench-pinky-ring'], ['more', 6, '08-bench-grillz']];
    for (const [t, p, n] of shots) { await open(t, p, false); await ev(() => { const B = window.__jewel.JB; B.ctl.autoRotate = false; window.__jewel.jbFit(true); }); await shot(n, 1500); const inf = await ev(() => { const B = window.__jewel.JB; return { price: B.price, name: B.name, tris: B.info && Math.round(B.info.st.tris), gems: B.info && B.info.st.gems }; }); console.log(n, JSON.stringify(inf)); ok(inf.price > 0, n + ' priced ' + inf.price); }
  }
  // buy a full set
  const buys = [['chain', 2], ['chain', 0], ['watch', 0], ['more', 0], ['more', 3], ['more', 5], ['more', 6]];
  for (const [t, p] of buys) { await open(t, p, false); await ev(() => document.querySelector('#jwb-buy').click()); await wait(300); }
  const own = await ev(() => ({ n: window.__jewel.jwOwned().length, worn: window.__jewel.jwWorn().map(j => j.name), cash: window.__guns.S.cash, bank: window.__guns.S.bank, look: (window.__jwLook().jw || []).length }));
  console.log('owned', JSON.stringify(own)); ok(own.n === 7 && own.worn.length === 7 && own.look === 7, 'bought + wearing 7 pieces');
  if (on('bench')) {
    await open('chain', 2, true); await ev(() => { window.__jewel.JB.ctl.autoRotate = false; }); await shot('09-bench-on-me-cuban', 2500);
    await open('watch', 0, true); await shot('10-bench-on-me-watch', 2500);
    await ev(() => { const W = window.__jewel; W.JB.tab = 'mine'; W.JB.el.querySelector('[data-t="mine"]').click(); }); await benchWait(); await shot('11-my-jewelry', 2000);
  }
  await ev(() => window.__jewel.jbClose());
  // on your character in the world
  const waitBody = () => pg.waitForFunction(() => { const M = window.__guns.ME; if (!M) return false; let n = 0; M.root.traverse(o => { if (o.name && o.name.startsWith('jw:')) n++; }); return n >= 7; }, null, { timeout: 180000, polling: 500 }).then(() => true).catch(() => false);
  ok(await waitBody(), 'all 7 pieces on your body');
  const parts = await ev(() => { const M = window.__guns.ME, o = []; M.root.traverse(x => { if (x.name && x.name.startsWith('jw:')) { let t = 0; x.traverse(m => { if (m.isMesh) t += m.geometry.attributes.position.count / 3; }); o.push(x.name + ':' + Math.round(t / 1000) + 'k'); } }); return o; });
  console.log('on body', parts.join(' '));
  const cam = async (n, yaw, dist, pitch, lift, off) => {
    await ev(([yaw, dist, pitch, lift, off]) => { const P = window.__photo; if (!P.PM.on) P.pmOpen(); P.PM.pose = 0; const f = window.__guns.foot; P.PM.yaw = f.yaw + Math.PI + yaw; P.PM.dist = dist; P.PM.pitch = pitch; P.PM.lift = lift; P.PM.fov = dist < 1.5 ? 38 : 60; P.PM.off.set(...(off || [0, 0, 0])); }, [yaw, dist, pitch, lift, off]);
    await shot(n, 3500);
  };
  await cam('12-photo-full', 0.15, 2.4, 0.05, -0.2);
  await cam('13-photo-chest', 0.1, 0.8, 0.05, -0.06);
  await cam('14-photo-chest-side', 0.6, 0.8, 0.1, -0.06);
  await cam('15-photo-left-wrist', -0.9, 0.9, 0.05, -0.58);
  await cam('16-photo-right-hand', 1.0, 0.9, 0.05, -0.6);
  await cam('17-photo-face', 0.05, 0.75, 0.0, 0.16);
  await cam('18-photo-ear', 1.2, 0.75, 0.0, 0.16);
  // online friend wearing jewelry
  if (on('online')) {
    await ev(() => window.__net.netJoin('eastgate'));
    await pg.waitForFunction(() => window.__net.NET.status === 'on', null, { timeout: 60000, polling: 500 });
    await ev(() => {
      const ch = new BroadcastChannel('rfg:eastgate'), NET = window.__net.NET, f = window.__guns.foot, t0 = Date.now();
      const F = window.__fake = { ch, q: 0, got: null };
      const look = { skin: '#6b4429', hair: '#111111', hairStyle: 'locs', top: 'tee_black', bottom: 'jeans_black', shoes: 'kicks_white', hat: 'no_hat', facialHair: 'goatee', extras: [], jw: [{ k: 'chain', o: { style: 'cuban', width: 12, iced: true, pendant: 'medallion', text: 'LM', font: 'old', psize: 6 } }, { k: 'watch', o: { finish: 'pave', iceCase: true, iceBand: true, comp: 'none' } }, { k: 'more', o: { kind: 'grillz', gset: 'both' } }] };
      const x = f.x + 1.4, z = f.z + 0.2;
      F.timer = setInterval(() => {
        ch.postMessage({ k: '_p', id: 'F2', t: t0 });
        if (!F.said || Date.now() - F.said > 3000) { F.said = Date.now(); ch.postMessage({ k: 'h', id: 'F2', n: 'Lawrence', m: 'chevrolet_caprice_classic_box_chevy_1986', m3: 'chevrolet_caprice_classic_box_chevy_1986', v: { paint: '#6a1fb3' }, l: {}, t: 1, lk: look, gn: 0 }); }
        ch.postMessage({ k: 's', id: 'F2', q: ++F.q, x, z, h: -f.yaw, v: 0, r: 0, a: 0, c: 0, f: 0 });
        const q = NET.peers.get('F2'); if (q) q.seen = performance.now() / 1000 + 1e5;
      }, 100);
      ch.onmessage = e => { if (e.data && e.data.k === 'h' && e.data.lk && e.data.id !== 'F2') F.got = e.data.lk.jw || null; };
    });
    await pg.waitForFunction(() => { const p = window.__net.NET.peers.get('F2'); if (!p || !p.view || !p.view.P) return false; let n = 0; p.view.P.root.traverse(o => { if (o.name && o.name.startsWith('jw:')) n++; }); return n >= 3; }, null, { timeout: 120000, polling: 500 }).catch(() => {});
    const fr = await ev(() => { const p = window.__net.NET.peers.get('F2'); const o = []; if (p && p.view && p.view.P) p.view.P.root.traverse(x => { if (x.name && x.name.startsWith('jw:')) o.push(x.name); }); return { look: p && p.look && p.look.jw, on: o }; });
    console.log('friend', JSON.stringify(fr)); ok(fr.on.length >= 3, 'friend online wears their chain, watch and grillz');
    await cam('19-online-both', 0.35, 2.2, 0.05, 0.05, [0.7, 0, 0]);
    await cam('20-online-friend-chest', 0.35, 1.2, 0.05, 0.25, [1.4, 0, 0]);
    await wait(4000);
    const mine = await ev(() => window.__fake.got);
    ok(Array.isArray(mine) && mine.length === 7, 'my jewelry goes out in my hello look (' + (mine ? mine.length : 0) + ')');
  }
  await ev(() => window.__photo.pmClose());
  // take off + sell
  const sold = await ev(() => { const W = window.__jewel, id = W.jwOwned()[0].id; W.jwWear(id, false); return W.jwWorn().length; });
  ok(sold === 6, 'take one off: 6 worn');
  console.log('errs', errs.slice(0, 20));
  ok(!errs.length, 'no page errors');
  console.log(fail.length ? 'FAILED ' + fail.length : 'ALL OK');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
