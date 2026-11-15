// The Moto Shop's parts show on the Hayabusa: extended swingarm (arm, wheel, chain, wheelbase), nitrous bottle, turbo kit, Öhlins spring.
// Needs the repo served on PORT (default 8791) and S=<dir with npm/node_modules/three>. OUT=<dir> saves screenshots.
const { chromium } = require('playwright'), fs = require('fs');
const PORT = process.env.PORT || 8791, S = process.env.S, OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 600 } });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => r.fulfill({ path: S + '/npm/node_modules/three/' + req.url().split('three@0.128.0/')[1], contentType: 'application/javascript' }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' })); await ctx.route(/supabase/, r => r.abort());
  const save = { v: 1, made: true, name: 'Test', cash: 250000, bank: 0, car: { id: 'suzuki_hayabusa_2025', color: '#c9ccd2', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 0.8, oil: 100, mods: {} }, at: { x: 1650, z: -400, yaw: 0, foot: true, fx: 1650, fz: -400, fyaw: 0 } };
  await ctx.addInitScript(s => localStorage.setItem('mw3d.save.v1', s), JSON.stringify(save));
  const errs = [], p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 400))); p.on('console', m => { if (m.type() === 'warning' && /bike parts/.test(m.text())) errs.push('console ' + m.text()); });
  await p.goto(`http://localhost:${PORT}/index.html`); await p.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
  await p.waitForTimeout(1500); await p.evaluate(() => window.__map.getIn());
  await p.waitForFunction(() => window.__map.carObj() && window.__map.carObj().userData.model, null, { timeout: 120000, polling: 500 });
  await p.evaluate(() => { window.__in = { gas: 0, brake: 0, steer: 0, hb: 0 }; window.__drvIn = () => window.__in; window.__moto.tick(60, 1 / 60); });
  const set = spec => p.evaluate(spec => { const M = window.__map, c = M.S.car, m = M.carObj().userData.model, U = m.userData; c.moto = c.moto || {}; c.moto.p = Object.assign({}, spec); window.__moto.applyLook(m, c); window.__moto.tick(20, 1 / 60);
    const sw = U.anim.swing[0].g; let minX = 1, same = true; sw.traverse(o => { if (!o.isMesh || o.userData.px) return; o.geometry.computeBoundingBox(); minX = Math.min(minX, o.geometry.boundingBox.min.x); if (o.userData.pxG0 && o.geometry !== o.userData.pxG0) same = false; });
    let spr = ''; U.anim.shock[0].g.traverse(o => { if (o.isMesh && o.userData.pxSpr) spr = o.material.color.getHexString(); });
    const parts = (U.pxmM || []), bb = new THREE.Box3(); for (const o of parts) { o.geometry.computeBoundingBox(); bb.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrix)); }
    const ch = U.anim.chainT[0].g.matrix.elements, B = window.__moto.bikeSpec(c);
    return { key: U.pxmKey, n: parts.length, attached: parts.every(o => o.parent === U.inner && o.userData.px === 'bike'), nan: parts.some(o => { const a = o.geometry.attributes.position.array; for (let i = 0; i < a.length; i++) if (a[i] !== a[i]) return true; return false; }),
      axR: U.rig.axR.x, wR: U.rig.wR.matrix.elements[12], wRy: U.rig.wR.matrix.elements[13], minX, same, spr, L: B.L, chain: Math.hypot(ch[0], ch[1], ch[2]), bb: parts.length ? [bb.min.toArray(), bb.max.toArray()] : null }; }, spec);
  const shot = async name => { if (!OUT) return; fs.mkdirSync(OUT, { recursive: true }); const url = await p.evaluate(() => { const M = window.__map, m = M.carObj().userData.model, R = M.rnd(), sc = M.scn(), cam = new THREE.PerspectiveCamera(30, M.cam().aspect, 0.01, 5000), W = M.ME.wrap, v0 = W.visible; W.visible = false;
      const ctr = new THREE.Vector3(); m.getWorldPosition(ctr); ctr.y += 0.6; const yaw = M.drvS().yaw + Math.PI * 0.62; cam.position.set(ctr.x + Math.sin(yaw) * 4.4, ctr.y + 0.5, ctr.z + Math.cos(yaw) * 4.4); cam.lookAt(ctr); cam.updateMatrixWorld(); R.render(sc, cam); W.visible = v0; return R.domElement.toDataURL('image/png'); });
    fs.writeFileSync(OUT + '/' + name + '.png', Buffer.from(url.split(',')[1], 'base64')); };
  const R = {}; R.stock = await set({}); await shot('bike-stock');
  R.a6 = await set({ arm: 'a6' }); R.a10 = await set({ arm: 'a10', nos: 'n100', turbo: 't2', ecu: 'flash', inj: 'hi', eng: 'bb', susp: 'ohl' }); await shot('bike-drag');
  R.net = await p.evaluate(() => { const X = window.__px, b = X.myBuild(), o = X.cleanBuild(JSON.parse(JSON.stringify(b))); return { sent: b.m, got: o.moto, bad: X.cleanBuild({ m: ['a99', 'x', 1, null, 'zz'] }).moto || null }; });
  R.nos = await set({ nos: 'n50' }); R.tb = await set({ turbo: 't1', ecu: 'flash', inj: 'hi' }); R.back = await set({});
  console.log(JSON.stringify(R));
  const near = (a, b, e = 0.004) => Math.abs(a - b) < e, e6 = 6 * 0.0254, e10 = 10 * 0.0254;
  const ok = R.stock.n === 0 && near(R.stock.axR, -0.74) && R.stock.same && R.stock.spr !== 'e8c417'
    && near(R.a6.axR, -0.74 - e6) && near(R.a6.wR, -0.74 - e6) && near(R.a6.minX, R.stock.minX - e6) && !R.a6.same && near(R.a6.L, R.stock.L + e6) && R.a6.chain > R.stock.chain * 1.15 && near(R.a6.wRy, R.stock.wRy, 0.02) && R.a6.n === 0
    && near(R.a10.axR, -0.74 - e10) && near(R.a10.minX, R.stock.minX - e10) && R.a10.n >= 10 && R.a10.attached && !R.a10.nan && R.a10.spr === 'e8c417' && R.a10.bb[1][2] < 0.24 && R.a10.bb[0][2] > -0.31 && R.a10.bb[0][1] > 0.15
    && R.nos.n >= 5 && R.nos.n < R.a10.n && R.nos.bb[1][2] < -0.1 && near(R.nos.axR, -0.74) && R.nos.same && R.tb.n >= 5 && R.tb.bb[0][0] > 0.05 && R.tb.bb[1][0] < 0.47 && R.tb.attached
    && R.net.sent && R.net.sent.join() === 'a10,n100,t2,ohl,stock' && R.net.got && R.net.got.p.arm === 'a10' && R.net.got.p.turbo === 't2' && !R.net.got.p.exh && !R.net.bad
    && R.back.n === 0 && R.back.same && near(R.back.minX, R.stock.minX, 1e-6) && near(R.back.axR, -0.74) && R.back.spr === R.stock.spr && near(R.back.chain, R.stock.chain, 0.01) && !errs.length;
  console.log(ok ? 'PASS' : 'FAIL', 'ERR', errs.join('\n').slice(0, 1500) || 'none'); await b.close(); process.exit(ok ? 0 : 1);
})();
