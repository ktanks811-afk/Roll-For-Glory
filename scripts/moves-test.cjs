// Porches + jump / crouch / roll test (2026-11-21). Headless Chromium (Playwright), no server needed: the repo files are
// served to the page by Playwright's router. Set S to a folder that holds npm/node_modules/three (three@0.128.0).
// OUT= folder for screenshots. Checks:
//   - city houses: porches are low enough, there are steps out front, the porch/steps are ground you stand on, and you
//     can walk up the steps onto the porch (but not straight up the porch side unless you jump)
//   - jump (Space / A / button) leaves the ground and lands; crouch (C / B / button) creeps; roll (Z / LB / button) dives ahead
//   - walk-in home patios are ground you stand on with a step down
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..');
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +(process.env.VW || 844), height: +(process.env.VH || 390) }, hasTouch: true, isMobile: true, deviceScaleFactor: +(process.env.DPR || 1) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); });
  await pg.addInitScript(() => { window.__pad = null; const g = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => []; navigator.getGamepads = () => window.__pad ? [window.__pad] : g(); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase|fonts\.(googleapis|gstatic)/, r => r.abort());
  await pg.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => {
    const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' });
  });
  await pg.goto('http://game.test/index.html?test=1&net=local');
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__uq && window.__moves, null, { timeout: 400000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const shot = async n => { await wait(300); await pg.screenshot({ path: path.join(OUT, n + '.png') }); };
  const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} if (window.__cops) window.__cops.COP.noPop = true; });
  await wait(1500);
  const until = (f, a, ms = 60000) => pg.waitForFunction(f, a, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);
  const grounded = () => until(() => { const M = window.__moves.MV; return !M.air && !(M.roll > 0); });
  // a per-frame recorder: highest feet, frames
  await ev(() => { const R = window.__rec = { maxY: 0, n: 0 }; const f = () => { const h = window.__home.foot.holder; if (h) R.maxY = Math.max(R.maxY, h.position.y); R.n++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const fps = await (async () => { const a = await ev(() => window.__rec.n); await wait(2000); return (await ev(() => window.__rec.n) - a) / 2; })();
  console.log('fps', fps);
  ok(await ev(() => window.__home.foot.on), 'on foot at the start');

  // 1) porch heights across every city house
  const fams = await ev(() => { const U = window.__uq, out = { max: 0, raised: 0, n: 0 }; for (const H of U.HS.list) { const r = U.recipe(H); out.n++; out.max = Math.max(out.max, r.fh); if (r.fh > 0.3) out.raised++; } return out; });
  ok(fams.max <= 0.49, `porch floors lowered: highest ${fams.max.toFixed(2)} m over ${fams.n} houses (${fams.raised} raised)`);

  // 2) a raised shotgun house in Stop Six: stand at the street, the cell builds, walks + steps show up
  const pick = await ev(() => {
    const U = window.__uq, f = window.__home.foot; let best = null;
    for (const H of U.HS.list) { const r = U.recipe(H); if (r.fh < 0.42 || (r.porch !== 'full' && r.porch !== 'wrap')) continue; const d = Math.hypot(H.cx - 7056, H.cz - 1300); if (!best || d < best.d) best = { H, d }; }
    const H = best.H; f.x = H.cx - Math.sin(H.ry) * 30; f.z = H.cz - Math.cos(H.ry) * 30; f.target = null;
    return { i: U.HS.list.indexOf(H), cx: H.cx, cz: H.cz, ry: H.ry, fh: U.recipe(H).fh };
  });
  console.log('house', JSON.stringify(pick));
  await pg.waitForFunction(i => window.__uq.HS.list[i].walked, pick.i, { timeout: 120000, polling: 500 }).catch(() => {});
  const W = await ev(p => {
    const M = window.__moves, H = window.__uq.HS.list[p.i], seen = new Set(), list = [];
    for (let dx = -20; dx <= 20; dx += 10) for (let dz = -20; dz <= 20; dz += 10) for (const o of M.walks.at(H.cx + dx, H.cz + dz)) { if (seen.has(o)) continue; seen.add(o); list.push(o); }
    // local frame: +z into the lot, x along the street
    const cs = Math.cos(H.ry), sn = Math.sin(H.ry), loc = (x, z) => { const dx = x - H.cx, dz = z - H.cz; return [dx * cs - dz * sn, dx * sn + dz * cs]; };
    const L = list.map(o => { const a = loc(o.x0, o.z0), b = loc(o.x1, o.z1); return { x0: Math.min(a[0], b[0]), z0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), z1: Math.max(a[1], b[1]), y: o.y, w: o }; }).filter(o => Math.abs(o.x0) < 15 && Math.abs(o.z0) < 20);
    L.sort((a, b) => a.y - b.y);
    const porch = L[L.length - 1], step = L[0];
    return { walked: !!H.walked, n: L.length, porch: porch && { ...porch, w: 0 }, step: step && { ...step, w: 0 }, all: L.map(o => [+o.x0.toFixed(2), +o.z0.toFixed(2), +o.x1.toFixed(2), +o.z1.toFixed(2), +o.y.toFixed(2)]) };
  }, pick);
  console.log('walks', JSON.stringify(W.all));
  ok(W.walked && W.n >= 2 && W.porch.y > 0.35 && W.step.y < W.porch.y, `porch ${W.porch && W.porch.y.toFixed(2)} m with ${W.n - 1} step(s) out front`);
  // world point from house-local
  const toW = (x, z) => [pick.cx + x * Math.cos(pick.ry) + z * Math.sin(pick.ry), pick.cz - x * Math.sin(pick.ry) + z * Math.cos(pick.ry)];
  const sx = (W.step.x0 + W.step.x1) / 2;
  // walk up from 3 m in front of the steps, facing the house
  const place = async (lx, lz) => { const [x, z] = toW(lx, lz); await ev(([x, z, ry]) => { const f = window.__home.foot; f.x = x; f.z = z; f.target = null; f.gy = null; f.yaw = f.camYaw = ry + Math.PI; }, [x, z, pick.ry]); await wait(600); };
  const camBehind = async () => ev(() => { window.__home.LOOK.pitch = 0.22; });
  await place(sx, W.step.z0 - 3); await camBehind(); await shot('01-steps-street');
  const y0 = await ev(() => window.__home.foot.holder.position.y);
  await pg.keyboard.down('KeyW'); await until(y => window.__home.foot.holder.position.y > y, W.porch.y - 0.05, 300000); await pg.keyboard.up('KeyW'); await wait(500);
  const up = await ev(() => ({ y: window.__home.foot.holder.position.y, gy: window.__home.foot.gy }));
  ok(up.y > W.porch.y - 0.05, `walked up the steps onto the porch: feet at ${up.y.toFixed(2)} (from ${y0.toFixed(2)})`);
  await ev(() => { const f = window.__home.foot; f.camYaw += Math.PI * 0.8; }); await wait(1200); await shot('02-on-the-porch');
  // the open end of the porch (no steps, no railing): too high to walk up, a jump gets you on
  const zm = (W.porch.z0 + W.porch.z1) / 2;
  const placeEnd = async d => { const [x, z] = toW(W.porch.x0 - d, zm); await ev(([x, z, ry]) => { const f = window.__home.foot, wx = Math.cos(ry), wz = -Math.sin(ry); f.x = x; f.z = z; f.target = null; f.gy = null; f.yaw = f.camYaw = Math.atan2(-wx, -wz); }, [x, z, pick.ry]); await wait(600); };
  await placeEnd(1.6);
  { await pg.keyboard.down('KeyW'); await until(n => window.__rec.n > n, (await ev(() => window.__rec.n)) + 60, 120000); await pg.keyboard.up('KeyW'); await wait(300); }
  const blocked = await ev(() => window.__home.foot.holder.position.y);
  ok(blocked < 0.3, `porch end too high to step onto without the steps (feet ${blocked.toFixed(2)})`);
  await placeEnd(1.0);
  await pg.keyboard.down('KeyW'); await pg.keyboard.press('Space'); await until(() => window.__moves.MV.air); await until(() => !window.__moves.MV.air); await pg.keyboard.up('KeyW'); await wait(300);
  const jumped = await ev(() => window.__home.foot.holder.position.y);
  if (process.env.DBG) { console.log('side', side, 'toW', JSON.stringify(toW(side, W.porch.z0))); console.log(JSON.stringify(await ev(() => window.__dbg))); }
  ok(jumped > W.porch.y - 0.05, `jumped up onto the porch (feet ${jumped.toFixed(2)})`);

  // 3) out in the open: jump, crouch, roll
  await place(sx, W.step.z0 - 6);
  const g0 = await ev(() => window.__home.foot.holder.position.y);
  await ev(() => { const f = window.__home.foot; f.camYaw = f.yaw + 1.3; window.__rec.maxY = 0; }); await wait(800);
  await ev(() => { window.__moves.MV.req.j = 1; window.__shotAt = null; const t = () => { const M = window.__moves.MV; if (M.air && M.vy < 0.6) window.__shotAt = 1; else requestAnimationFrame(t); }; requestAnimationFrame(t); });
  await until(() => window.__shotAt); await pg.screenshot({ path: path.join(OUT, '03-jump.png') });
  ok(await grounded(), 'landed');
  const peak = await ev(() => window.__rec.maxY);
  ok(peak - g0 > 0.5 && peak - g0 < 0.9, `jump: ${(peak - g0).toFixed(2)} m up`);
  await pg.keyboard.press('KeyC'); await until(() => window.__moves.MV.cw > 0.95);
  ok(await ev(() => window.__moves.MV.crouch), 'crouched (C)');
  await shot('04-crouch');
  const c0 = await ev(() => [window.__home.foot.x, window.__home.foot.z]);
  // compare with standing: same number of frames
  const stride = async () => { const a = await ev(() => [window.__home.foot.x, window.__home.foot.z, window.__rec.n]); await pg.keyboard.down('KeyW'); await until(n => window.__rec.n > n, a[2] + 40, 120000); await pg.keyboard.up('KeyW'); const c = await ev(() => [window.__home.foot.x, window.__home.foot.z]); return Math.hypot(c[0] - a[0], c[1] - a[1]); };
  const creep = await stride();
  await pg.keyboard.press('KeyC'); await until(() => window.__moves.MV.cw < 0.05); const walkD = await stride(); await pg.keyboard.press('KeyC'); await until(() => window.__moves.MV.cw > 0.95);
  ok(creep > 0.1 && creep < walkD * 0.6, `crouch walk is a creep: ${creep.toFixed(2)} m vs ${walkD.toFixed(2)} m standing`);
  await pg.keyboard.down('KeyW'); await wait(400); await shot('05-crouch-walk'); await pg.keyboard.up('KeyW');
  await pg.keyboard.press('KeyC'); await until(() => window.__moves.MV.cw < 0.05);
  ok(!(await ev(() => window.__moves.MV.crouch)), 'stood back up');
  const r0 = await ev(() => [window.__home.foot.x, window.__home.foot.z]);
  await ev(() => { const f = window.__home.foot; f.camYaw = f.yaw + 1.45; }); await wait(600);
  await ev(() => { window.__shotAt = null; const t = () => { const M = window.__moves.MV; if (M.roll / 0.8 > 0.4) window.__shotAt = 1; else requestAnimationFrame(t); }; requestAnimationFrame(t); });
  await pg.keyboard.press('KeyZ'); await until(() => window.__shotAt); await pg.screenshot({ path: path.join(OUT, '06-roll.png') });
  await grounded(); await wait(300);
  const r1 = await ev(() => [window.__home.foot.x, window.__home.foot.z]);
  const rl = Math.hypot(r1[0] - r0[0], r1[1] - r0[1]);
  ok(rl > 2.5 && rl < 5.5, `roll dives ${rl.toFixed(2)} m`);
  ok(await ev(() => !window.__moves.MV.roll && !window.__home.foot.holder.children.some(c => c.rotation.x)), 'roll finished upright');

  // 4) touch buttons and the pad
  const btns = await ev(() => ['mv-jump', 'mv-crouch', 'mv-roll'].map(id => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return { id, vis: r.width > 0 && getComputedStyle(e.parentNode).display !== 'none', x: r.x, y: r.y }; }));
  ok(btns.every(b => b.vis), 'touch buttons up while walking ' + JSON.stringify(btns.map(b => [b.id, Math.round(b.x), Math.round(b.y)])));
  await ev(() => { const f = window.__home.foot; f.camYaw = f.yaw; window.__home.LOOK.pitch = 0.15; }); await wait(600); await shot('07-buttons');
  const jb = btns[0]; await pg.touchscreen.tap(jb.x + 20, jb.y + 20);
  ok(await until(() => window.__moves.MV.air, null, 20000), 'JUMP button jumps');
  await grounded();
  const cb = btns[1]; await pg.touchscreen.tap(cb.x + 20, cb.y + 20);
  ok(await until(() => window.__moves.MV.crouch && document.getElementById('mv-crouch').classList.contains('on'), null, 20000), 'CROUCH button crouches (lit)');
  await pg.touchscreen.tap(cb.x + 20, cb.y + 20); await until(() => !window.__moves.MV.crouch, null, 20000);
  const rb = btns[2]; await pg.touchscreen.tap(rb.x + 20, rb.y + 20);
  ok(await until(() => window.__moves.MV.roll > 0, null, 20000), 'ROLL button rolls');
  await grounded();
  const pad = async (i, ms = 1500) => { await ev(i => { const bt = Array.from({ length: 17 }, (_, k) => ({ pressed: k === i, value: k === i ? 1 : 0 })); window.__pad = { axes: [0, 0, 0, 0], buttons: bt }; }, i); await wait(ms); await ev(() => { window.__pad = { axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; }); };
  await pad(0); ok(await until(() => window.__moves.MV.air || window.__rec.maxY > 0.4, null, 5000), 'pad A jumps'); await grounded();
  await pad(1); ok(await until(() => window.__moves.MV.crouch, null, 5000), 'pad B crouches'); await pad(1); await until(() => !window.__moves.MV.crouch, null, 5000);
  await ev(() => { window.__rolled = 0; const t = () => { if (window.__moves.MV.roll > 0) window.__rolled = 1; else requestAnimationFrame(t); }; requestAnimationFrame(t); });
  await pad(4); ok(await until(() => window.__rolled, null, 5000), 'pad LB rolls'); await grounded();
  await ev(() => { window.__pad = null; });

  // 5) a walk-in home's patio: ground you stand on, a step down off it
  const home = await ev(() => {
    const Hm = window.__home; for (const o of Hm.OUTS.values()) { const d = Hm.design(o.p); if (!d || !d.floors || !d.floors[0] || !d.floors[0].includes('P')) continue; return { id: o.p.id, x: o.anchor[0], z: o.anchor[1] }; } return null;
  });
  if (home) {
    await ev(h => { const f = window.__home.foot; f.x = h.x; f.z = h.z + 25; f.target = null; }, home);
    await pg.waitForFunction(id => { const o = window.__home.OUTS.get(id); return o && o.group && o.ws && o.ws.length; }, home.id, { timeout: 60000, polling: 500 }).catch(() => {});
    const pw = await ev(id => { const o = window.__home.OUTS.get(id); return o && o.ws ? { n: o.ws.length, ys: [...new Set(o.ws.map(r => +r.y.toFixed(2)))], r: o.ws.find(r => r.y > 0.3) } : null; }, home.id);
    ok(pw && pw.n > 0 && pw.ys.some(y => y > 0.3) && pw.ys.some(y => y < 0.2), 'home patio + step are ground ' + JSON.stringify(pw && { n: pw.n, ys: pw.ys }));
    if (pw && pw.r) {
      const g = await ev(r => window.__moves.groundAt((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), pw.r);
      ok(g > 0.3, `standing on the patio puts you at ${g.toFixed(2)} m`);
      await ev(r => { const f = window.__home.foot; f.x = (r.x0 + r.x1) / 2; f.z = (r.z0 + r.z1) / 2; f.gy = null; window.__home.LOOK.pitch = 0.3; }, pw.r); await wait(1500); await shot('08-home-patio');
    }
  } else console.log('no home with a patio nearby');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fail.length ? `\n${fail.length} FAILED` : '\nALL OK');
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
