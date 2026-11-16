// Custom garages + your house on the street with locked doors (2026-11-16). Headless Chromium on the real game.
// Serve the repo on PORT (default 8790), S = a folder holding npm/node_modules/three (three@0.128.0), OUT=dir for
// screenshots. Buys a lot, builds a 2-story house and a 6-car garage, designs the garage (brick, carriage doors,
// checker floor, hex lights, tool wall, lift, tires, lounge, neon, flags), checks the cost was charged, shoots the
// garage inside, then the house from the street at several angles, walks to the front door (locked: keypad red),
// unlocks it and walks in, drives up to the garage (the door rolls up) and pulls in (the car is in a bay).
// FOREIGN=1 also shows the same house as another player's (locked door, knock) on the same page.
const { chromium } = require('playwright');
const PORT = process.env.PORT || 8790, S = process.env.S, OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await pg.goto(`http://localhost:${PORT}/index.html?test=1`);
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms), shot = async n => { if (OUT) await pg.screenshot({ path: `${OUT}/${n}.png` }); };
  const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  // a lot of land, yours
  const land = await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} M.S.cash = 2e6; M.S.car = M.newCar('chevrolet_caprice_classic_1990'); M.S.car.fuel = 100;
    const P = window.__map.places().filter(q => q.type === 'land'); const p = P.find(q => q.id === (window.__LAND || '')) || P[0]; M.S.props.push(p.id); M.S.garage = [M.newCar('dodge_charger_srt_hellcat_widebody_2020'), M.newCar('chevrolet_camaro_ss_2017')]; return { id: p.id, name: p.name, x: p.x, z: p.z }; });
  console.log('land', JSON.stringify(land));
  await ev(id => window.__map.enter(id), land.id); await wait(1500);
  const built = await ev(() => { const h = window.__home; if (!h.DECO.on) h.decoStart(); h.buildMode(); h.usePreset('two'); h.usePreset('two'); h.setGarage(6); return { garN: h.H.d.garN, built: h.H.d._built, cash: window.__map.S.cash }; });
  ok(built.garN === 6 && built.built, 'house + 6-car garage built ' + JSON.stringify(built));
  const c0 = await ev(() => window.__map.S.cash);
  await ev(() => { const h = window.__home; h.gxEdit(g => Object.assign(g, { st: 'brick', dr: 'carriage', fl: 'checker', lt: 'hex', wc: '#2a2b2e', ex: ['tools', 'lift', 'tires', 'lounge', 'neon', 'flags', 'cabinets'], sign: 'GLITCH GARAGE' })); });
  const c1 = await ev(() => window.__map.S.cash), gx = await ev(() => window.__home.H.d.gx);
  ok(c0 - c1 === 18000 + 4500 * 3 + 9000 + 8500 + 12000 + 9500 + 2500 + 7000 + 3000 + 600 + 5500, `garage design charged ${c0 - c1}`);
  ok(gx.st === 'brick' && gx.ex.length === 7 && gx.sign === 'GLITCH GARAGE', 'design saved on the house');
  ok(await ev(id => !!window.__map.S.homes[id].gx, land.id), 'design in the save');
  // the garage panel in Build
  await ev(() => { document.querySelector('[data-a="garage"]').click(); }); await wait(800); await shot('01-garage-designer');
  await ev(() => window.__home.decoEnd()); await wait(800);
  // inside the garage: the cars in their bays, the first one up on the lift
  const lifted = await ev(() => { const IN = window.__home.IN; let up = 0; IN.room.traverse(o => { if (o.userData && o.userData.model && o.parent && o.parent.position && o.parent.position.y > 1.5) up++; }); const cars = []; IN.room.traverse(o => { if (o.position && o.position.y > 1.6 && o.position.y < 1.8) cars.push(o.position.y); }); return cars.length; });
  ok(lifted > 0, 'a car up on the lift');
  const gIn = await ev(() => { const H = window.__home.H, g = H.sh.gar2, IN = window.__home.IN; IN.pos.set(-(g.x0 + g.x1) / 2, 0, -(g.z0 + 2)); IN.avatar.position.copy(IN.pos); IN.camYaw = Math.PI; IN.yaw = Math.PI; return { w: g.x1 - g.x0, d: g.z1 - g.z0 }; });
  console.log('garage', JSON.stringify(gIn));
  await wait(2500); await shot('02-garage-inside-front');
  await ev(() => { const H = window.__home.H, g = H.sh.gar2, IN = window.__home.IN; IN.pos.set(-(g.x0 + 1.5), 0, -(g.z1 - 2.8)); IN.avatar.position.copy(IN.pos); IN.camYaw = -Math.PI / 2 - 0.5; window.__home.LOOK.pitch = 0.25; });
  await wait(2500); await shot('03-garage-inside-back');
  await ev(() => { const IN = window.__home.IN; IN.camYaw = 0.6; window.__home.LOOK.pitch = 0.5; }); await wait(2000); await shot('04-garage-inside-lift');
  // out on the street
  await ev(() => { window.__map.leave(); }); await wait(1500);
  await ev(l => { const M = window.__map; M.startDrive(l.x, l.z); }, land); await wait(2500);
  await ev(() => { const M = window.__map; M.getOut(); if (!M.foot.park) M.foot.park = { x: M.drv.x, z: M.drv.z, yaw: M.drv.yaw };   /* the game starts you on foot: getOut is a no-op */ }); await wait(1500);
  const out = await ev(id => { const o = window.__home.OUTS.get(id); return o && { group: !!o.group, sh: !!(o.sh && o.sh.fdoor), doors: o.sh ? o.sh.gdoors.length : 0, anchor: o.anchor, ry: o.ry }; }, land.id);
  ok(out && out.group && out.sh && out.doors === 3, 'house and garage stand on the street with doors ' + JSON.stringify(out));
  // camera shots round it: put the player at a spot and the camera at an offset from them
  const view = async (n, fx, fz, dx, dy, dz, ly) => {
    await ev(([fx, fz, dx, dy, dz, ly]) => { const f = window.__map.foot, h = f.holder.rotation.y, c = Math.cos(h), s = Math.sin(h); f.x = fx; f.z = fz; f.target = null; window.__gcam = [dx * c - dz * s, dy, dx * s + dz * c, ly || 1.5]; }, [fx, fz, dx, dy, dz, ly]);
    await wait(3000); await shot(n);
  };
  const W = await ev(id => { const o = window.__home.OUTS.get(id), sh = o.sh, g = sh.gar2, w = (a, b) => o.pl.toWorld(a, b); return { front: w(sh.door.x, sh.door.z - 0.9), gar: w((g.x0 + g.x1) / 2, g.z0 - 6), gc: w((g.x0 + g.x1) / 2, (g.z0 + g.z1) / 2), hc: w(sh.door.x, sh.door.z + 5), ry: o.ry, side: w(g.x1 + 0.9, g.door), street: w(sh.door.x - 8, sh.door.z - 26), back: w(sh.door.x - 6, g.z1 + 20) }; }, land.id);
  const rot = (dx, dz) => { const c = Math.cos(W.ry), s = Math.sin(W.ry); return [dx * c + dz * s, -dx * s + dz * c]; };
  { const [a, b2] = rot(0, -30); await view('05-street-front', W.street[0], W.street[1], a * 0.2, 9, b2 * 0.2, 4); }
  { const [a, b2] = rot(-24, -24); await view('06-street-left', W.gc[0], W.gc[1], a, 12, b2, 2); }
  { const [a, b2] = rot(26, -18); await view('07-street-right', W.hc[0], W.hc[1], a, 10, b2, 3); }
  { const [a, b2] = rot(-20, 28); await view('08-from-back', W.gc[0], W.gc[1], a, 16, b2, 1); }
  { const [a, b2] = rot(0, -9); await view('09-garage-doors', W.gar[0], W.gar[1], a, 3.2, b2, 2); }
  await ev(() => { window.__gcam = null; });
  // walk up to the front door: locked for others, yours unlocks
  await ev(f => { const F = window.__map.foot; F.x = f[0]; F.z = f[1]; F.target = null; window.__gcam = null; }, W.front); await wait(1500);
  const pr = await ev(() => { const e = document.getElementById('prompt'); return { on: !e.hidden, t: e.textContent }; });
  ok(pr.on && /front door/i.test(pr.t) && /Unlock/.test(pr.t), 'front door prompt ' + JSON.stringify(pr));
  { const [a, b2] = rot(1.8, -3.2); await ev(([dx, dz]) => { const f = window.__map.foot, h = f.holder.rotation.y, c = Math.cos(h), s = Math.sin(h); window.__gcam = [dx * c - dz * s, 2.0, dx * s + dz * c, 1.4]; }, [a, b2]); }
  await wait(2000); await shot('10-front-door-locked');
  await ev(() => document.getElementById('p-use').click()); await wait(500); await shot('11-front-door-unlocking');
  await wait(1500);
  const inHouse = await ev(id => ({ inside: window.__home.H.on, p: window.__home.H.p && window.__home.H.p.id }), land.id);
  ok(inHouse.inside && inHouse.p === land.id, 'walked in the front door');
  await ev(() => { window.__gcam = null; window.__map.leave(); }); await wait(1200);
  // back in the car, drive up to the garage: the door rolls up, pull in
  await ev(() => { const M = window.__map; if (M.foot.on) M.getIn(); }); await wait(500);
  await ev(([g, ry]) => { const d = window.__map.drv; d.x = g[0]; d.z = g[1] + 0; d.yaw = ry + Math.PI; d.v = 0; }, [W.gar, W.ry]); await pg.waitForFunction(id => window.__home.OUTS.get(id).sh.gdoors.every(g => g.k > 0.6), land.id, { timeout: 60000, polling: 500 }).catch(() => {});
  const opening = await ev(id => window.__home.OUTS.get(id).sh.gdoors.map(g => +g.k.toFixed(2)), land.id);
  ok(opening.some(k => k > 0.3), 'garage door rolls up as you pull up ' + JSON.stringify(opening));
  await shot('12-garage-door-open');
  const pp = await ev(() => { const e = document.getElementById('prompt'); return { on: !e.hidden, t: e.textContent }; });
  ok(pp.on && /Pull in/.test(pp.t), 'pull-in prompt ' + JSON.stringify(pp));
  const n0 = await ev(() => window.__map.S.garage.length);
  await ev(() => document.getElementById('p-use').click()); await wait(2500);
  const pulled = await ev(() => ({ inside: window.__home.H.on, car: !!window.__map.S.car, n: window.__map.S.garage.length, first: window.__map.S.garage.map(c => c.id) }));
  ok(pulled.inside && !pulled.car && pulled.n === n0 + 1, 'pulled in: car in a bay, you inside ' + JSON.stringify(pulled));
  await wait(1500); await shot('13-pulled-in');
  // someone else's: the same house as another player's on the server
  if (process.env.FOREIGN) {
    await ev(() => window.__map.leave()); await wait(800);
    const fo = await ev(id => { const M = window.__map, h = window.__home; const sv = h.pack(h.design(window.__map.places().find(q => q.id === id))); M.S.props = M.S.props.filter(x => x !== id); h.FOREIGN.set(id, { sv, name: 'Lawrence', uid: 'u2' }); h.rebuildOutside(id); const o = h.OUTS.get(id); return { built: !!o.group }; }, land.id);
    await wait(1500);
    await ev(() => { const M = window.__map; if (!M.foot.on) M.getOut(); }); await wait(600);
    await ev(f => { const F = window.__map.foot; F.x = f[0]; F.z = f[1]; F.target = null; }, W.front); await wait(4000);
    const lp = await ev(() => { const e = document.getElementById('prompt'); return { on: !e.hidden, t: e.textContent }; });
    ok(/Lawrence's front door/.test(lp.t) && /Knock/.test(lp.t), 'someone else\'s front door is locked ' + JSON.stringify(lp));
    await ev(() => document.getElementById('p-use').click()); await wait(800);
    ok(!(await ev(() => window.__home.H.on)), 'locked: you can\'t walk in');
    await shot('14-locked-other-player');
  }
  console.log('errors', errs.length ? errs.join('\n') : 'none');
  console.log(fail.length ? `FAILED ${fail.length}` : 'ALL OK');
  await b.close(); process.exit(fail.length || errs.length ? 1 : 0);
})();
