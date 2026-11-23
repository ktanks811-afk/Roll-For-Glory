// Smooth AI turns + turn signals test (2026-11-22). Headless Chromium (Playwright), files served by Playwright's router.
// S= folder holding npm/node_modules/three (three@0.128.0). OUT= folder for screenshots (SHOTS=1 to take them).
// 1) drives AI cars over the real road graph at 60 Hz, the old way (copied below) and the new way, and compares:
//    biggest one-frame heading change, heading jerk, how often a car snaps sideways, speed through corners,
//    and how early the blinker comes on before each real turn
// 2) the regulars on the shared clock: same checks, and that two clocks a frame apart give the same car (no network needed)
// 3) a real regular and a cop car in the game: blinkers and brake lamps light, screenshots from behind at a corner
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..');
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +(process.env.VW || 844), height: +(process.env.VH || 390) }, hasTouch: true, isMobile: true, deviceScaleFactor: +(process.env.DPR || 1) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); if (/turn lamps/.test(m.text())) errs.push(m.text()); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase|fonts\.(googleapis|gstatic)/, r => r.abort());
  await pg.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => {
    const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' });
  });
  await pg.goto('http://game.test/index.html?test=1&net=local');
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__turns && window.__hood, null, { timeout: 400000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} if (window.__cops) window.__cops.COP.noPop = true; });
  await wait(1500);

  // ---------- 1) the road-graph driver, old vs new ----------
  const r1 = await ev(() => {
    const T = window.__turns, g = T.graph(), N = g.nx.length;
    let sd = 12345; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const inCity = n => Math.abs(g.nx[n]) < 950 && Math.abs(g.nz[n]) < 950;
    const next = e => { const adj = g.adj[e.b] || [], o = adj.filter(a => a[0] !== e.a && inCity(a[0])); return ((o.length ? o : adj)[Math.floor(rnd() * (o.length ? o : adj).length)] || [e.a])[0]; };
    const norm = a => Math.atan2(Math.sin(a), Math.cos(a));
    // the old hDrive (before 2026-11-22), copied as it was
    const yawOf = (dx, dz, gx, gz, dt) => { const d = Math.hypot(dx, dz); return d > 0.6 * dt && dx * gx + dz * gz > 0 ? Math.atan2(-dx, -dz) : Math.atan2(-gx, -gz); };
    function oldDrive(e, dt, want = 14) {
      const ax = g.nx[e.a], az = g.nz[e.a], bx = g.nx[e.b], bz = g.nz[e.b], L = Math.max(0.1, Math.hypot(bx - ax, bz - az));
      let tgt = want; if (L - e.u < 16) tgt = Math.min(tgt, 6);
      e.sp += Math.max(-9 * dt, Math.min(4.5 * dt, tgt - e.sp)); e.u += e.sp * dt;
      if (e.u >= L) { e.u -= L; const nb = next(e); e.a = e.b; e.b = nb; if (e.a === e.b) { e.sp = 0; e.u = 0; } }
      const ax2 = g.nx[e.a], az2 = g.nz[e.a], bx2 = g.nx[e.b], bz2 = g.nz[e.b], L2 = Math.max(0.1, Math.hypot(bx2 - ax2, bz2 - az2)), gx = (bx2 - ax2) / L2, gz = (bz2 - az2) / L2;
      const u = Math.min(e.u, L2), tx = ax2 + gx * u - gz * 3.6, tz = az2 + gz * u + gx * 3.6, k = 1 - Math.exp(-dt * 6), ox = e.x, oz = e.z;
      e.x += (tx - e.x) * k; e.z += (tz - e.z) * k; e.yaw += norm(yawOf(e.x - ox, e.z - oz, gx, gz, dt) - e.yaw) * Math.min(1, dt * 8);
    }
    const starts = []; for (let k = 0; k < 6; k++) { let n; do { n = Math.floor(rnd() * N); } while (!inCity(n) || g.adj[n].length < 3); starts.push(n); }
    const run = (fn, n0, sec) => {
      const e = { a: n0, b: g.adj[n0][0][0], u: 0, sp: 0, yaw: 0, x: g.nx[n0], z: g.nz[n0], path: null };
      e.yaw = Math.atan2(-(g.nx[e.b] - e.x), -(g.nz[e.b] - e.z));
      const dt = 1 / 60, st = { maxYawStep: 0, maxYawJerk: 0, side: 0, sideMax: 0, frames: 0, turns: 0, cornerV: [], sigLead: [], noSig: 0, wrongSig: 0 };
      let prevRate = null, prevBlk = e.a + ':' + e.b, sigOn = 0, sigSide = 0;
      for (let f = 0; f < sec * 60; f++) {
        const ox = e.x, oz = e.z, oy = e.yaw; fn(e, dt); st.frames++;
        if (f < 120) { prevRate = null; continue; }
        const dy = norm(e.yaw - oy), rate = dy / dt; st.maxYawStep = Math.max(st.maxYawStep, Math.abs(dy) * 180 / Math.PI);
        if (prevRate != null) st.maxYawJerk = Math.max(st.maxYawJerk, Math.abs(rate - prevRate) / dt); prevRate = rate;
        // sideways slip: motion across the way it points (a car snapping into a lane)
        const mx = e.x - ox, mz = e.z - oz, fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw), lat = Math.abs(mx * -fz + mz * fx) / dt;
        if (lat > 1) st.side++; st.sideMax = Math.max(st.sideMax, lat);
        // the blinker: how long it was on before the heading really started to swing
        if (e.sig) { if (!sigOn) { sigOn = f; sigSide = e.sig; } } else sigOn = 0;
        const blk = e.a + ':' + e.b;
        if (blk !== prevBlk) {
          const pts = prevBlk.split(':').map(Number), A = pts[0], B = pts[1], C = e.b, d1x = g.nx[B] - g.nx[A], d1z = g.nz[B] - g.nz[A], d2x = g.nx[C] - g.nx[B], d2z = g.nz[C] - g.nz[B];
          const th = Math.atan2(d1x * d2z - d1z * d2x, d1x * d2x + d1z * d2z);
          if (Math.abs(th) > 0.6 && Math.abs(th) < 2.8) { st.turns++; st.cornerV.push(e.sp); if (fn !== oldDrive) { if (!sigOn) st.noSig++; else { st.sigLead.push((f - sigOn) / 60); if (sigSide !== (th > 0 ? 1 : -1)) st.wrongSig++; } } }
          prevBlk = blk;
        }
      }
      st.sideRate = st.side / st.frames; return st;
    };
    const newDrive = (e, dt) => T.trDrive(e, dt, 14, 99, 3.6, false, next);
    const agg = fn => { const all = starts.map(n => { sd = n * 7 + 1; return run(fn, n, 150); }); const cv = all.flatMap(s => s.cornerV), sl = all.flatMap(s => s.sigLead);
      return { turns: all.reduce((s, a) => s + a.turns, 0), maxYawStepDeg: Math.max(...all.map(s => s.maxYawStep)), maxYawJerk: Math.max(...all.map(s => s.maxYawJerk)), sideSlipFrames: all.reduce((s, a) => s + a.sideRate, 0) / all.length, sideMax: Math.max(...all.map(s => s.sideMax)),
        cornerMph: cv.length ? cv.reduce((a, b) => a + b, 0) / cv.length * 2.237 : 0, cornerMphMax: cv.length ? Math.max(...cv) * 2.237 : 0, noSig: all.reduce((s, a) => s + a.noSig, 0), wrongSig: all.reduce((s, a) => s + a.wrongSig, 0), sigLeadMin: sl.length ? Math.min(...sl) : null, sigLeadAvg: sl.length ? sl.reduce((a, b) => a + b, 0) / sl.length : null };
    };
    return { old: agg(oldDrive), now: agg(newDrive) };
  });
  const f2 = (k, v) => typeof v === 'number' ? +v.toFixed(3) : v;
  console.log('old ', JSON.stringify(r1.old, f2)); console.log('new ', JSON.stringify(r1.now, f2));
  ok(r1.now.turns > 20, `new drivers made ${r1.now.turns} real turns`);
  ok(r1.now.maxYawStepDeg < r1.old.maxYawStepDeg && r1.now.maxYawStepDeg < 4, `biggest one-frame heading change ${r1.old.maxYawStepDeg.toFixed(2)}° -> ${r1.now.maxYawStepDeg.toFixed(2)}°`);
  ok(r1.now.maxYawJerk < r1.old.maxYawJerk / 2, `heading jerk ${r1.old.maxYawJerk.toFixed(0)} -> ${r1.now.maxYawJerk.toFixed(0)} rad/s³`);
  ok(r1.now.sideSlipFrames < 0.01, `frames sliding sideways > 1 m/s: ${(r1.old.sideSlipFrames * 100).toFixed(1)}% -> ${(r1.now.sideSlipFrames * 100).toFixed(2)}%`);
  ok(r1.now.cornerMphMax < 16, `corner speed avg ${r1.now.cornerMph.toFixed(1)} mph, max ${r1.now.cornerMphMax.toFixed(1)} mph (old avg ${r1.old.cornerMph.toFixed(1)})`);
  ok(r1.now.noSig === 0 && r1.now.wrongSig === 0, `blinker on for every real turn (${r1.now.noSig} missed, ${r1.now.wrongSig} wrong side)`);
  ok(r1.now.sigLeadMin != null && r1.now.sigLeadMin > 1.5, `blinker comes on ${r1.now.sigLeadMin && r1.now.sigLeadMin.toFixed(1)} s (avg ${r1.now.sigLeadAvg && r1.now.sigLeadAvg.toFixed(1)} s) before the block changes`);

  // ---------- 2) the regulars on the shared clock ----------
  const r2 = await ev(() => {
    const T = window.__turns, H = window.__hood, R = H.hRoutes().list, norm = a => Math.atan2(Math.sin(a), Math.cos(a));
    const t0 = performance.now(); T.trTrack(R[0]); const build1 = performance.now() - t0; const t1 = performance.now(); for (const r of R) T.trTrack(r); const buildAll = performance.now() - t1;
    let maxJump = 0, maxYaw = 0, sig = 0, frames = 0, minV = 99, wrap = 0, sameClock = true;
    for (const r of R.slice(0, 12)) {
      let p0 = null; const T0 = 1e6 + r.i * 77;
      for (let f = 0; f < 60 * 120; f++) {
        const p = T.trSched(r, T0 + f / 60); frames++;
        if (p0) { const d = Math.hypot(p.x - p0.x, p.z - p0.z); if (d > 5) wrap++; else { maxJump = Math.max(maxJump, Math.abs(d - (p.v + p0.v) / 2 / 60)); maxYaw = Math.max(maxYaw, Math.abs(norm(p.yaw - p0.yaw)) * 180 / Math.PI); } }
        if (p.sig) sig++; minV = Math.min(minV, p.v); p0 = p;
      }
      const a = T.trSched(r, T0 + 33.3), b2 = T.trSched(r, T0 + 33.3); if (a.x !== b2.x || a.sig !== b2.sig) sameClock = false;
    }
    return { routes: R.length, build1, buildAll, maxJump, maxYaw, sigShare: sig / frames, minV, wrap, sameClock };
  });
  console.log('regs', JSON.stringify(r2, f2));
  ok(r2.maxJump < 0.12, `scheduled regulars move smoothly (largest frame error ${r2.maxJump.toFixed(3)} m)`);
  ok(r2.maxYaw < 4, `scheduled regulars turn smoothly (largest one-frame heading change ${r2.maxYaw.toFixed(2)}°)`);
  ok(r2.sigShare > 0.05 && r2.minV < 6, `scheduled regulars blink ${(r2.sigShare * 100).toFixed(0)}% of the time and slow to ${(r2.minV * 2.237).toFixed(0)} mph for corners`);
  ok(r2.sameClock, 'same clock = same car, same blinker (nothing to send online)');
  ok(r2.buildAll < 400, `all ${r2.routes} loops worked out in ${r2.buildAll.toFixed(0)} ms (first one ${r2.build1.toFixed(1)} ms)`);

  // hold the game's own frames so the shots come from our camera behind the car
  await ev(() => { const M = window.__map, R = M.rnd(), orig = R.render; R.render = function () { if (window.__hold && !window.__mine) return; return orig.apply(this, arguments); };
    window.__shot = () => { const e = window.__tt, cam = M.cam(), fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw); cam.position.set(e.x - fx * 10 + fz * 2.5, 3.6, e.z - fz * 10 - fx * 2.5); cam.lookAt(e.x + fx * 4, 0.9, e.z + fz * 4); cam.updateMatrixWorld();
      window.__mine = 1; try { R.render(M.scn(), cam); } finally { window.__mine = 0; } }; });
  // ---------- 3) in the game: a regular and a cop blinking at a real corner ----------
  const r3 = await ev(async () => {
    const M = window.__map, T = window.__turns, H = window.__hood, C = window.__cops && window.__cops.COP;
    M.foot.on = true;
    // a city corner: a node with 4 roads
    const g = T.graph(); let n = -1; for (let i = 0; i < g.nx.length; i++) if (g.adj[i].length === 4 && Math.abs(g.nx[i] + 300) < 250 && Math.abs(g.nz[i]) < 250) { n = i; break; }
    if (n < 0) return { err: 'no corner' };
    return { n, x: g.nx[n], z: g.nz[n], adj: g.adj[n].map(a => a[0]) };
  });
  console.log('corner', JSON.stringify(r3));
  if (!r3.err) {
    // put a regular two blocks out, heading into the corner to turn right, and a cop behind it turning left
    const r4 = await ev(async (c) => {
      const M = window.__map, T = window.__turns, H = window.__hood, g = T.graph();
      const a = c.adj[0], dx = c.x - g.nx[a], dz = c.z - g.nz[a];
      // the road that makes a right turn (cross > 0 is a right in this map)
      const q = c.adj.slice(1).find(o => { const ex = g.nx[o] - c.x, ez = g.nz[o] - c.z; return dx * ez - dz * ex > 0.5 * Math.hypot(dx, dz) * Math.hypot(ex, ez); }) || c.adj[1];
      const L = Math.hypot(dx, dz);
      let e = null; const t1 = performance.now(); while (!(e = H.hReg('test:turner', { mode: 'cruise', inCar: true, want: 13 })) && performance.now() - t1 < 90000) await new Promise(r => setTimeout(r, 500));
      if (!e) return { err: 'no crowd' }; H.hClaim(e);
      Object.assign(e, { a, b: c.n, u: Math.max(0, L - 70), sp: 12, x: g.nx[a], z: g.nz[a], yaw: Math.atan2(-(c.x - g.nx[a]), -(c.z - g.nz[a])), path: [q], nb: null });
      window.__tt = e; H.HOOD.ents.splice(H.HOOD.ents.indexOf(e), 1);   // drive it ourselves: the street loop leaves it alone
      await new Promise(r => { const t0 = performance.now(); const w = () => (e.model || performance.now() - t0 > 60000) ? r() : setTimeout(w, 200); w(); });
      return { model: !!e.model, id: e.carId, lamps: !!(e.model && e.model.userData.lamps && e.model.userData.lamps.turnL) };
    }, r3);
    console.log('turner', JSON.stringify(r4));
    const log = [];
    for (let k = 0; k < 64; k++) {
      const s = await ev(() => {
        const e = window.__tt, M = window.__map, H = window.__hood, cam = M.cam(); window.__hold = 1;
        // drive it with the game's own driver and draw its lamps the way the street loop does
        const T = window.__turns, g = T.graph(), nx = o => { const adj = g.adj[o.b], q = adj.filter(a => a[0] !== o.a); return (q.length ? q : adj)[0][0]; }, t = performance.now() / 1000;
        for (let i = 0; i < 9; i++) T.trDrive(e, 1 / 60, 13, 99, 3.6, false, o => (o.path && o.path.length ? o.path.shift() : nx(o)));
        e.g.position.set(e.x, 0, e.z); e.slot.position.set(0, 0.12, 0); e.slot.rotation.y = e.yaw; e.g.visible = true; e.slot.visible = true; let p = e.g; while (p) { p.visible = true; p = p.parent; } if (e.view.P) e.view.P.wrap.visible = false;
        T.trLamps(e.model, e.sig, e.brk, t, 0.3);
        const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw); cam.position.set(e.x - fx * 11, 4.2, e.z - fz * 11); cam.lookAt(e.x + fx * 6, 0.8, e.z + fz * 6); cam.updateMatrixWorld();
        const m = e.model, U = m && m.userData, L = U && U.lamps, trM = U && U.trM;
        const lit = L && L.turnL ? { L: L.turnL.some(g => g.visible), R: L.turnR.some(g => g.visible), B: !!(L.brake && L.brake.some(g => g.visible)) } : trM ? { L: trM.l.visible, R: trM.r.visible, B: trM.b.visible } : null;
        return { sig: e.sig, brk: e.brk, sp: +e.sp.toFixed(2), u: +e.u.toFixed(1), a: e.a, b: e.b, lit };
      });
      log.push(s);
      if (process.env.SHOTS && k % 4 === 0) { await ev(() => window.__shot()); await pg.screenshot({ path: path.join(OUT, `turn-${String(k).padStart(2, '0')}.png`) }); }
    }
    console.log(log.map(s => `${s.a}>${s.b} u${s.u} v${s.sp} sig${s.sig} brk${s.brk ? 1 : 0} lit${s.lit ? (s.lit.L ? 'L' : '') + (s.lit.R ? 'R' : '') + (s.lit.B ? 'B' : '') : '-'}`).join('\n'));
    ok(log.some(s => s.sig && s.lit && (s.lit.L || s.lit.R)), 'the regular\'s signal lamps light up on the street');
    ok(log.some(s => s.lit && s.lit.B), 'brake lamps light while it slows for the corner');
  }
  ok(!errs.length, `no page errors (${errs.length})`); if (errs.length) console.log(errs.slice(0, 8).join('\n'));
  console.log(fail.length ? `\n${fail.length} FAILED` : '\nALL OK');
  await b.close(); process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
