// Your house and garage online (2026-11-16). Two players on ?net=local (BroadcastChannel, deeds and saved builds in
// localStorage). Kimari builds a house and a designed garage on a lot: Lawrence sees it go up on the street live, sees
// the garage door roll up when Kimari drives up to it ('hdo'), and gets a locked door with Knock. Then Kimari logs off
// and a third player joins: the house and garage are still there, read off the saved deed (rfg_builds_get, 'h3').
// PORT (default 8790), S = folder with npm/node_modules/three (three@0.128.0), OUT = folder for screenshots.
const { chromium } = require('playwright');
const PORT = process.env.PORT || 8790, S = process.env.S, OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, r => { const p = r.request().url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  const LAND = 'land_stopsix';
  const save = { v: 1, made: true, name: 'Kimari', cash: 2000000, bank: 0, props: [LAND], car: { id: 'chevrolet_caprice_classic_box_chevy_1986', color: '#b3121b', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 100, oil: 100, mods: {} }, at: { x: 2265, z: -300, yaw: 0, foot: true, fx: 2265, fz: -300, fyaw: 0 } };
  await ctx.addInitScript(s => { if (!localStorage.getItem('mw3d.save.v1')) localStorage.setItem('mw3d.save.v1', s); }, JSON.stringify(save));
  const errs = [], fail = [], ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  const open = async (tag, name, own) => {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tag + ' ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push(tag + ' console ' + m.text().slice(0, 300)); });
    await p.goto(`http://localhost:${PORT}/index.html?net=local&test=1`); await p.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
    await p.evaluate(([name, own, id]) => { const M = window.__map; try { M.closeCreator(); } catch (e) {} M.S.name = name; M.S.uid = 'u' + name.toLowerCase(); if (!own) { M.S.props = M.S.props.filter(x => x !== id); M.S.homes = {}; } else if (!M.S.props.includes(id)) M.S.props.push(id); M.S.cash = 2e6; }, [name, own, LAND]);
    await p.evaluate(() => window.__net.netJoin('eastgate'));
    await p.waitForFunction(() => window.__net.NET.status === 'on', null, { timeout: 120000, polling: 500 });
    await p.evaluate(() => setInterval(() => { for (const q of window.__net.NET.peers.values()) q.seen = Math.max(q.seen, performance.now() / 1000 - 1); }, 200));
    return p;
  };
  const pump = async (pages, n) => { for (let i = 0; i < n; i++) for (const p of pages) await p.evaluate(() => { for (let k = 0; k < 4; k++) { window.__net.netTick(0.05); window.__hn.tick(0.05); window.__est.tick(0.05); } }); };
  const shot = async (p, n) => { if (!OUT) return; try { await p.bringToFront(); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/${n}.png`, timeout: 90000 }); } catch (e) { console.log("shot failed", n, e.message.split("\n")[0]); } };
  const A = await open('A', 'Kimari', true), B = await open('B', 'Lawrence', false);
  await pump([A, B], 20);
  // Kimari builds
  await A.evaluate(id => window.__map.enter(id), LAND); await A.waitForTimeout(1500);
  await A.evaluate(() => { const h = window.__home; if (!h.DECO.on) h.decoStart(); h.buildMode(); h.usePreset('one'); h.usePreset('one'); h.setGarage(4); h.gxEdit(g => Object.assign(g, { st: 'glass', dr: 'glass', fl: 'epoxy', lt: 'hex', ex: ['tools', 'neon', 'lift'], sign: 'KIMARI' })); h.decoEnd(); });
  await A.evaluate(() => window.__map.leave()); await pump([A, B], 30);
  const seen = await B.evaluate(id => { const f = window.__home.FOREIGN.get(id); return f && { name: f.name, garN: f.sv.garN, gx: f.sv.gx && f.sv.gx.st }; }, LAND);
  ok(seen && seen.name === 'Kimari' && seen.garN === 4 && seen.gx === 'glass', 'Lawrence sees Kimari\'s house and garage design live ' + JSON.stringify(seen));
  // Lawrence walks up to the street in front of it
  await B.evaluate(() => { const M = window.__map; M.startDrive(2265, -300); M.getOut(); });
  const W = await B.evaluate(id => { const F = window.__map.foot, o = window.__home.OUTS.get(id); F.x = o.anchor[0]; F.z = o.anchor[1] - 6; return true; }, LAND);
  await B.waitForFunction(id => { const o = window.__home.OUTS.get(id); return o && o.group && o.sh; }, LAND, { timeout: 60000, polling: 500 });
  const doors = await B.evaluate(id => { const o = window.__home.OUTS.get(id), sh = o.sh, w = (a, b) => o.pl.toWorld(a, b); return { front: w(sh.door.x, sh.door.z - 0.9), gar: w(sh.gdoors[0].m, sh.gdoors[0].z - 4.5), n: sh.gdoors.length, ry: o.ry }; }, LAND);
  ok(doors.n === 2, 'garage on the street with its 2 doors for Lawrence');
  // Kimari drives up to the garage: Lawrence sees the door go up
  await A.evaluate(([g, ry]) => { const M = window.__map; M.startDrive(g[0], g[1]); if (M.foot.on) { if (!M.foot.park) M.foot.park = { x: g[0], z: g[1], yaw: ry + Math.PI }; M.getIn(); } const d = M.drv; d.x = g[0]; d.z = g[1]; d.yaw = ry + Math.PI; d.v = 0; }, [doors.gar, doors.ry]);
  await A.waitForTimeout(2500); await pump([A, B], 20); await B.waitForTimeout(3000);
  const up = await B.evaluate(id => window.__home.OUTS.get(id).sh.gdoors.map(g => [g.want, +g.k.toFixed(2)]), LAND);
  ok(up.every(([w]) => w === 1), 'Lawrence sees Kimari\'s garage doors open ' + JSON.stringify(up));
  await B.evaluate(([g, ry]) => { const f = window.__map.foot; f.x = g[0] - Math.sin(ry) * 4; f.z = g[1] - Math.cos(ry) * 4; const h = f.holder.rotation.y, c = Math.cos(h), s = Math.sin(h), dx = -Math.sin(ry) * 9, dz = -Math.cos(ry) * 9; window.__gcam = [dx * c - dz * s, 4, dx * s + dz * c, 1.8]; }, [doors.gar, doors.ry]);
  await B.waitForTimeout(3000); await shot(B, 'online-01-lawrence-sees-door-open');
  // Lawrence at the front door: locked
  await B.evaluate(f => { window.__gcam = null; const F = window.__map.foot; F.x = f[0]; F.z = f[1]; F.target = null; }, doors.front); await B.waitForTimeout(2500);
  const lp = await B.evaluate(() => { const e = document.getElementById('prompt'); return { on: !e.hidden, t: e.textContent }; });
  ok(lp.on && /Kimari's front door/.test(lp.t) && /Knock/.test(lp.t), 'Lawrence gets a locked front door ' + JSON.stringify(lp));
  await B.evaluate(() => document.getElementById('p-use').click()); await B.waitForTimeout(800);
  const menu = await B.evaluate(() => ({ inside: window.__home.H.on, menu: document.getElementById('menu').textContent.slice(0, 160) }));
  ok(!menu.inside && /Knock/.test(menu.menu), 'locked: Lawrence can knock but not walk in ' + JSON.stringify(menu));
  await shot(B, 'online-02-lawrence-locked');
  // Kimari logs off; a new player still sees the house from the saved deed
  await A.evaluate(() => window.__net.netLeave ? window.__net.netLeave() : null).catch(() => {}); await A.close(); await B.close();
  const C = await open('C', 'Dre', false);
  await pump([C], 20); await C.waitForTimeout(2000); await pump([C], 10);
  const kept = await C.evaluate(id => { const f = window.__home.FOREIGN.get(id); return f && { name: f.name, saved: f.saved, garN: f.sv.garN, gx: f.sv.gx && f.sv.gx.ex }; }, LAND);
  ok(kept && kept.name === 'Kimari' && kept.saved && kept.garN === 4, 'Kimari offline: the house is still on the street from the deed ' + JSON.stringify(kept));
  await C.evaluate(() => { const M = window.__map; M.startDrive(2265, -300); M.getOut(); });
  await C.evaluate(id => { const F = window.__map.foot, o = window.__home.OUTS.get(id); F.x = o.anchor[0] - 14; F.z = o.anchor[1] - 18; const h = F.holder.rotation.y, c = Math.cos(h), s = Math.sin(h), dx = -6, dz = -10; window.__gcam = [dx * c - dz * s, 7, dx * s + dz * c, 2]; }, LAND);
  await C.waitForFunction(id => { const o = window.__home.OUTS.get(id); return o && o.group; }, LAND, { timeout: 60000, polling: 500 });
  await C.waitForTimeout(3500); await shot(C, 'online-03-offline-house-still-there');
  console.log('errors', errs.length ? errs.join('\n') : 'none');
  console.log(fail.length ? `FAILED ${fail.length}` : 'ALL OK');
  await b.close(); process.exit(fail.length || errs.length ? 1 : 0);
})();
