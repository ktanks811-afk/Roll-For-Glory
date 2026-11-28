// City calls online test: two players on one server see the same calls, and a scene cop that comes off a call for one
// player is handed over to the other one (their copy of that unit steps aside). The repo is served by Playwright's router.
// S = folder with npm/node_modules/three (three@0.128.0). OUT = folder for screenshots (optional).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const S = process.env.S, OUT = process.env.OUT, ROOT = path.resolve(__dirname, '..');
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
const log = o => console.log(JSON.stringify(o));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, r => { const p = r.request().url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => {
    const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' });
  });
  const save = { v: 1, made: true, name: 'Kimari', cash: 25000, bank: 0, car: { id: 'chevrolet_caprice_classic_box_chevy_1986', color: '#b3121b', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 1, oil: 100, mods: {} }, at: { x: 600, z: -150, yaw: 0, foot: true, fx: 600, fz: -150, fyaw: 0 } };
  await ctx.addInitScript(s => { if (!localStorage.getItem('mw3d.save.v1')) localStorage.setItem('mw3d.save.v1', s); }, JSON.stringify(save));
  const errs = [];
  const open = async (tag, q) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push(tag + ' console ' + m.text().slice(0, 300)); }); await p.goto(`http://game.test/index.html${q}`); await p.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 }); return p; };
  const step = () => { try { window.__hood.tick(0.05); window.__cops.step(0.05); window.__citycalls.ccStep(0.05); } catch (e) { (window.__terr = window.__terr || []).push(e.message + ' ' + (e.stack || '').split('\n')[1]); } if (window.__net && window.__net.NET.status === 'on') window.__net.netTick(0.05); };
  const pumpAll = async (pages, n) => { for (let i = 0; i < n; i++) { for (const p of pages) await p.evaluate(n => { for (let k = 0; k < n; k++) window.__step(); }, 4); await pages[0].waitForTimeout(10); } };
  const A = await open('A', '?net=local'), B = await open('B', '?net=local');
  await B.evaluate(() => { window.__map.S.name = 'Lawrence'; });
  for (const p of [A, B]) await p.evaluate(() => window.__net.netJoin('eastgate'));
  for (const p of [A, B]) await p.waitForFunction(() => window.__net.NET.status === 'on', null, { timeout: 120000, polling: 500 });
  for (const p of [A, B]) await p.evaluate(() => setInterval(() => { for (const q of window.__net.NET.peers.values()) q.seen = Math.max(q.seen, performance.now() / 1000 - 1); }, 200));
  for (const p of [A, B]) { await p.evaluate(`window.__step = ${step.toString()}`); await p.waitForFunction(() => { window.__hood.tick(0.05); return window.__hood.HOOD.ready; }, null, { timeout: 120000, polling: 500 }); await p.evaluate(() => { window.__cops.COP.noPop = true; for (const u of window.__cops.COP.units.slice()) window.__cops.copKill(u); }); }
  let fails = 0; const check = (ok, what, o) => { if (!ok) fails++; log(Object.assign({ [ok ? 'PASS' : 'FAIL']: what }, o || {})); };
  // a call with officers on scene somewhere near the start, from A's schedule
  const pick = await A.evaluate(() => {
    const X = window.__citycalls, f = window.__guns.foot, T = (Date.now() + window.__hood.HNET.clk) / 1000, g = window.__turns.graph();
    for (let r = 0; r < 4; r++) { const q = X.ccCands(f.x + r * 400, f.z, T).find(q => q.ph === 'on' && T < q.c.end - 120); if (q) return { id: q.c.id, kind: q.c.kind, x: g.nx[q.c.node], z: g.nz[q.c.node] }; }
    return null;
  });
  log({ pick });
  if (!pick) { log({ FAIL: 'no call on scene nearby' }); process.exit(1); }
  for (const [p, dx] of [[A, 0], [B, 6]]) await p.evaluate(([x, z]) => { const f = window.__guns.foot; f.x = x; f.z = z; f.holder.position.set(x, 0, z); window.__citycalls.CC.tick = 0; }, [pick.x + dx, pick.z + 20]);
  await pumpAll([A, B], 10);
  const live = p => p.evaluate(() => { const X = window.__citycalls; return { clk: Math.round(window.__hood.HNET.clk), calls: [...X.CC.live.values()].map(L => [L.c.id, L.c.kind, L.ph, L.units.map(u => [Math.round(u.x), Math.round(u.z), u.g.visible]).join(' ')]).sort() }; });
  const la = await live(A), lb = await live(B);
  log({ A: la, B: lb });
  const ids = l => l.calls.map(c => c[0] + c[2]).join(',');
  check(la.calls.length > 0 && ids(la) === ids(lb), 'both players see the same calls in the same phase', { a: ids(la), b: ids(lb) });
  const pos = l => (l.calls.find(c => c[0] === pick.id) || [])[3];
  check(pos(la) && pos(la) === pos(lb), 'the units on that call sit in the same spots on both screens', { a: pos(la), b: pos(lb) });
  if (OUT) for (const [p, n] of [[A, 'online-A'], [B, 'online-B']]) { const u = await p.evaluate(id => { const L = window.__citycalls.CC.live.get(id); const u = L.units[0]; return window.__map.snap(u.x + 16, 12, u.z + 18, u.x, 0.6, u.z); }, pick.id); fs.writeFileSync(path.join(OUT, `cc-${n}.jpg`), Buffer.from(u.split(',')[1], 'base64')); log({ snap: n }); }
  // A pulls a gun in front of a scene cop: that cop comes off the call for A, and B's copy of the same unit steps aside
  const took = await A.evaluate(id => { const L = window.__citycalls.CC.live.get(id), u = L.units[0], f = window.__guns.foot; f.x = u.x + 8; f.z = u.z + 3; f.holder.position.set(f.x, 0, f.z); const e = window.__cops.copEyes(50); if (e) { e.u.mode = 'chase'; e.u.lights = e.u.siren = true; } return e && e.u.nid; }, pick.id);
  log({ took });
  await pumpAll([A, B], 14);
  const bs = await B.evaluate(nid => { const X = window.__citycalls, C = window.__cops; const u = X.CC.units.find(u => u.nid === nid); return { remote: C.CNET.rem.has(nid), ownCopyHidden: !!(u && (u.hid || !u.g.visible)) }; }, took);
  check(took && bs.remote && bs.ownCopyHidden, 'B sees the unit that came off the call (handed over, no double)', bs);
  log({ ERR: errs.slice(0, 10), terr: [await A.evaluate(() => (window.__terr || []).slice(0, 5)), await B.evaluate(() => (window.__terr || []).slice(0, 5))] });
  check(!errs.length, 'no errors');
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
