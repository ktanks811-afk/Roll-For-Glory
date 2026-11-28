// Online engine sound test (headless Chromium, two players over ?net=local, real AudioContext + worklet): player A sits in
// a built Nova with the engine running, player B stands next to it. Checks A sends its motor (es) on the hello and its
// revs (er/eg) on the state packets, B builds a voice from A's motor (same engine key as A's own), follows A's revs,
// is louder up close than far away, and drops the voice when A shuts it off.
// S = folder with npm/node_modules/three (three@0.128.0).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), S = process.env.S;
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', mp3: 'audio/mpeg', css: 'text/css', webmanifest: 'application/json', svg: 'image/svg+xml', glb: 'model/gltf-binary', m4a: 'audio/mp4' };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, r => { const p = r.request().url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),rpc:async()=>({data:null}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await ctx.route(/^http:\/\/localhost:8766\/(.*)$/, r => { const u = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, ''), f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' }); });
  const car = (eb) => ({ id: 'chevrolet_nova_1972', color: '#b3121b', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 1, oil: 100, mods: {}, eb });
  const saveA = { v: 1, made: true, name: 'Kimari', cash: 25000, bank: 0, car: car({ cam: 'chop', hdr: 'longtube', exh: 'xpipe' }), at: { x: 600, z: -150, yaw: 0, foot: false } };
  const saveB = { v: 1, made: true, name: 'Lawrence', cash: 25000, bank: 0, car: car({}), at: { x: 600, z: -150, yaw: 0, foot: true, fx: 606, fz: -150, fyaw: 0 } };
  const errs = [], fails = [], ok = (c, m) => { if (!c) fails.push(m); };
  const open = async (tag, save) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(tag + ' ' + String(e.stack || e).slice(0, 400)));
    p.on('console', m => { const t = m.text(); if ((m.type() === 'error' && !/Failed to load resource|supabase/i.test(t)) || /peer engine sound|engine audio/i.test(t)) errs.push(tag + ' console ' + t.slice(0, 300)); });
    await p.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); localStorage.setItem('mw3d.save.v1', s); } }, JSON.stringify(save));
    await p.goto('http://localhost:8766/index.html?net=local&test=1');
    await p.waitForFunction(() => window.__map && window.__map.ready && window.__ea && window.__nv, null, { timeout: 300000, polling: 1000 });
    return p;
  };
  // pages share localStorage: open A, let it read its save, then B
  const A = await open('A', saveA); await A.waitForTimeout(500);
  const B = await open('B', saveB);
  for (const p of [A, B]) await p.evaluate(() => window.__net.netJoin('eastgate'));
  for (const p of [A, B]) await p.waitForFunction(() => window.__net.NET.status === 'on', null, { timeout: 120000, polling: 500 });
  // a page in the background gets no animation frames: pump A's network by hand so its packets keep coming
  for (const p of [A, B]) await p.evaluate(() => { setInterval(() => { window.__net.netTick(0.05); window.__nv.nvStep(0.05); }, 50); setInterval(() => { for (const q of window.__net.NET.peers.values()) q.seen = Math.max(q.seen, performance.now() / 1000 - 1); }, 200); });
  // audio needs a running context on both
  for (const p of [A, B]) await p.waitForFunction(async () => { const E = window.__ea.EA; if (E.ctx && E.ctx.state !== 'running') await E.ctx.resume(); return E.ctx && E.ctx.state === 'running' || E.st === 'idle'; }, null, { timeout: 60000, polling: 500 });
  const info = p => p.evaluate(() => { const M = window.__map, d = M.drvS(), E = window.__ea.EA; return { st: E.st, ctx: E.ctx && E.ctx.state, on: E.on, rpm: Math.round(E.rpm || 0), key: E.key, x: Math.round(d.x), z: Math.round(d.z), car: M.S && M.S.car && M.S.car.id, eb: M.S && M.S.car && JSON.stringify(M.S.car.eb) }; });
  console.log('A', JSON.stringify(await info(A))); console.log('B', JSON.stringify(await info(B)));
  const peerOnB = () => B.evaluate(() => { const p = [...window.__net.NET.peers.values()][0], N = window.__nv.NV; return p && { name: p.name, car: p.car, inCar: p.inCar, es: p.es, er: p.er, eg: p.eg, x: Math.round(p.x), z: Math.round(p.z), voices: N.list.map(o => ({ key: o.cfg.key, rpm: Math.round(o.rpm), thr: +o.thr.toFixed(2), g: +o.n.out.gain.value.toFixed(3) })) }; });
  // swiftshader runs a frame or two a second: wait on what we expect rather than a fixed time
  const until = async (fn, arg, ms = 30000) => { try { await B.waitForFunction(fn, arg, { timeout: ms, polling: 250 }); } catch (e) { console.log('timed out waiting: ' + fn.toString().slice(0, 120)); } };
  const P0 = 'const p = [...window.__net.NET.peers.values()][0], o = window.__nv.NV.list[0];';
  await until(new Function(P0 + 'return p && p.es && p.er > 0 && o && o.n.out.gain.value > 0.2'));
  let s = await peerOnB(); console.log('B sees A', JSON.stringify(s));
  const aKey = (await info(A)).key;
  ok(s && s.es && s.es.b && s.es.b.cam === 'chop', 'A sent its motor build (es) on the hello');
  ok(s && s.er > 300, 'A sends revs (er) while the engine runs');
  ok(s && s.voices.length === 1, 'B built a voice for A');
  ok(s && s.voices[0] && s.voices[0].key === aKey, 'B voice is the same engine as A hears (' + (s && s.voices[0] && s.voices[0].key) + ' vs ' + aKey + ')');
  ok(s && s.voices[0] && s.voices[0].g > 0.2, 'B hears A up close');
  // A revs it (the generator on B follows): hold the gas on A's engine audio values
  // stepEngineSound overwrites EA.rpm each frame; pin it by holding the loop's own audio and setting the values ourselves
  await A.evaluate(() => { window.__eaHold = 1; const E = window.__ea.EA; E.rpm = 5200; E.thr = 1; });
  await until(new Function(P0 + 'return p && p.er >= 5000 && o && o.rpm > 4500'));
  s = await peerOnB(); console.log('A revving', JSON.stringify(s));
  ok(s && s.er >= 5000 && s.eg >= 0.9, 'B gets A\'s revs and gas'); ok(s && s.voices[0] && s.voices[0].rpm > 4500, 'B voice follows A\'s revs');
  // listen from far away
  // the camera follows B every frame, so move B (in its car, or on foot) itself
  const moveB = async dx => B.evaluate(dx => { const p = [...window.__net.NET.peers.values()][0] || { x: 600, z: -150 }, d = window.__map.drvS(), g = window.__guns && window.__guns.foot; d.x = p.x + dx; d.z = p.z; d.v = 0; if (g && g.on) { g.x = p.x + dx; g.z = p.z; } }, dx);
  await moveB(120); await until(new Function(P0 + 'return o && o.n.out.gain.value < 0.2')); const far = await B.evaluate(() => { const o = window.__nv.NV.list[0], p = [...window.__net.NET.peers.values()][0], c = window.__map.cam().position; return o ? { g: +o.n.out.gain.value.toFixed(3), d: Math.round(Math.hypot(p.x - c.x, p.z - c.z)) } : { g: -1 }; });
  await moveB(6); await until(new Function(P0 + 'return o && o.n.out.gain.value > 0.4')); const near = await B.evaluate(() => { const o = window.__nv.NV.list[0], p = [...window.__net.NET.peers.values()][0], c = window.__map.cam().position; return o ? { g: +o.n.out.gain.value.toFixed(3), d: Math.round(Math.hypot(p.x - c.x, p.z - c.z)) } : { g: -1 }; });
  console.log('far', JSON.stringify(far), 'near', JSON.stringify(near));
  ok(far.g >= 0 && near.g > far.g * 2, 'louder up close than far away');
  // A shuts it off
  await A.evaluate(() => { const E = window.__ea.EA; E.on = false; E.rpm = 0; });
  await until(new Function(P0 + 'return (!p || p.er === 0) && !window.__nv.NV.list.length'));
  s = await peerOnB(); console.log('A off', JSON.stringify(s));
  // (the test transport can briefly lose a page that stalls on swiftshader, so A may be gone instead of at 0 rpm)
  const vAfter = await B.evaluate(() => window.__nv.NV.list.length); console.log('voices after off', vAfter);
  ok((!s || s.er === 0) && vAfter === 0, 'voice drops when A shuts it off');
  if (errs.length) console.log('page errors', errs.slice(0, 6));
  ok(!errs.length, 'no page errors');
  console.log(fails.length ? 'FAIL: ' + fails.join('; ') : 'ALL PASS');
  await b.close(); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
