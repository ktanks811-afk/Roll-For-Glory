// Yello Belly Phase 3B race tests (headless Chromium, Playwright).
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// ONLY=beams,tree,ai,me,red,fps,burn,sport,soak picks tests. Prints one JSON line per test; ERR lists page errors.
// Phase 3B tests: beams, tree, AI pair, player run, red light, frame-rate independence, burnout, soak
const { chromium } = require('playwright');
const S = process.env.S, ONLY = (process.env.ONLY || 'beams,tree,ai,me,red,fps,burn,soak').split(',');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const pg = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF || 1) });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600))); pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms), out = {};
  const shot = async (n, cam) => { if (cam) { await ev(c => { const C = window.__map.cam(); let [x, y, z, lx, ly, lz] = c; if (typeof x === 'string') { const A = window.__yb.race.ags.find(a => a.r.name === x) || window.__yb.race.ags[0]; if (A) [x, y, z, lx, ly, lz] = [A.x + y, 2.2, A.z + z, A.x, 0.9, A.z - 2]; } C.position.set(x, y, z); C.lookAt(lx, ly, lz); C.updateMatrixWorld(); }, cam); await wait(900); } await ev(h => { let st = document.getElementById('t3bhide'); if (!st) { st = document.createElement('style'); st.id = 't3bhide'; document.head.appendChild(st); } st.textContent = h ? '.pad,#radio,#card,#mini,#compass{display:none!important}' : ''; }, !!cam); if (cam) await wait(400); await pg.screenshot({ path: S + '/b/t3b_' + n + '.png' }); };
  await ev(() => { const M = window.__map; M.S.cash = 1e7; M.S.rep = 9999; try { M.closeCreator(); } catch (e) {} });
  await wait(1500);
  const CAR = process.env.CAR || 'dodge_charger_srt_hellcat_widebody_2020';
  await ev(`(() => { const M = window.__map; M.S.car = M.newCar('${CAR}'); M.S.car.fuel = 100; M.foot.on = false; M.gbMode(false); M.startDrive(7056.5, 1162); M.setTime('night'); })()`);
  await wait(3000);
  await ev(() => { const M = window.__map, d = M.drvS(); if (M.foot.on) M.getIn(); Object.assign(d, { x: 7056.5, z: 1162, yaw: 0, v: 0 }); M.physReset(); window.__yb.test.manual = true; });
  // in-page helpers: tick n frames at dt, until cond
  await ev(() => {
    const Y = window.__yb, M = window.__map;
    window.__t = { run(n, dt, cond) { for (let i = 0; i < n; i++) { if (window.__t.drive) window.__t.drive(dt); Y.test.tick(dt); if (cond && cond()) return i + 1; } return -1; } };
  });
  const runTo = async (cond, maxS = 120, dt = 1 / 60) => { for (let k = 0; k < maxS; k++) { const r = await ev(`window.__t.run(${Math.round(1 / dt)}, ${dt}, () => (${cond}))`); if (r > 0) return true; } return false; };

  if (ONLY.includes('dbg')) {
    const tr = await ev(() => { const Y = window.__yb, R = Y.race, M = window.__map; const A = Y.agSpawn(M.STREET3D[+(window.DBGR || 9)], Y.LANES[0], 1100, 0); const run = Y.newRun('ai', [], {}); const L = Y.mkLane('ai', 'L', A); L.fA = A.fA; L.c = Y.halfChord(A.rT); L.Ap = A.z - A.fA; A.lane = L; A.run = run; run.lanes = [L]; A.track = true; A.ph = 'pull'; R.run = run;
      const out = []; for (let i = 0; i < 60 * 40; i++) { Y.test.tick(1 / 60); if (i % 15 === 0) { const vd = A.st.t.vd; out.push([+(i / 60).toFixed(2), A.ph, +(A.z - A.fA - Y.SL).toFixed(3), +A.st.v.toFixed(2), +A.gas.toFixed(3), +A.brk.toFixed(2), vd && vd.rev, vd && vd.g, vd && Math.round(vd.we * 30 / Math.PI), L.pre, L.stg].join(' ')); } if (A.ph === 'staged' && i > 600) break; } return out; });
    console.log(tr.join('\n'));
  }
  if (ONLY.includes('dbg2')) {
    const tr = await ev(() => { const Y = window.__yb, R = Y.race, M = window.__map; const A = Y.agSpawn(M.STREET3D[+(window.DBGR || 8)], 7091, 1120, Math.PI); A.ph = 'ret'; A.path = [[7091, 1172], [7080, 1178.5], [7036, 1178.5], [6990, 1178], [6963, 1166], [6963, 1126]]; A.pi = 0; A.vMax = 6.7;
      const out = []; for (let i = 0; i < 60 * 90; i++) { Y.test.tick(1 / 60); if (i % 30 === 0) out.push([+(i / 60).toFixed(1), A.ph, A.pi, +A.x.toFixed(1), +A.z.toFixed(1), +A.yaw.toFixed(2), +A.st.v.toFixed(2), +A.gas.toFixed(2), +A.brk.toFixed(2)].join(' ')); if (A.ph === 'park') break; } return out; });
    console.log(tr.join('\n'));
  }
  if (ONLY.includes('beams')) out.beams = await ev(() => {
    const Y = window.__yb, SL = Y.SL, c = Y.halfChord(0.36), L = Y.mkLane('me', 'L'); L.c = c; const st = A => { Y.beamsAt(L, A); return (L.pre ? 'P' : '-') + (L.stg ? 'S' : '-') + (L.deep ? 'D' : ''); };
    const res = { c: +c.toFixed(4), far: st(SL + 1), pre: st(SL + 0.3), staged: st(SL + 0.1), deep: st(SL - 0.15), gone: st(SL - 0.3) };
    // a synthetic run at a constant 10 m/s from the line: leave, splits and finish land where they should
    const run = Y.newRun('me', [L], { dist: 201.17 }); run.gT = 0; run.ta = -0.4; run.st = 'tree'; L.Ap = SL + 0.1;
    let A = SL + 0.1, t = 0.05; const h = 1 / 240; while (L.done == null && t < 40) { const A1 = A - 10 * h; Y.crossing(run, L, A, A1, t, t + h, 10); A = A1; t += h; }
    res.leave = +L.leave.toFixed(4); res.expLeave = +(0.05 + (0.1 + c) / 10).toFixed(4); res.rt = +L.rt.toFixed(4);
    res.s60 = +L.split['60 ft'].t.toFixed(4); res.exp60 = +((18.29 - 2 * c) / 10).toFixed(4); res.et = +L.et.toFixed(4); res.expEt = +((201.17 - 2 * c) / 10).toFixed(4); res.mph = +L.mph.toFixed(3); res.expMph = +(10 * 2.237).toFixed(3);
    return res;
  });
  if (ONLY.includes('tree')) out.tree = await ev(() => {
    const Y = window.__yb, out = {};
    for (const tr of ['pro', 'sport']) { const L = Y.mkLane('me', 'L'); L.pre = L.stg = true; const run = Y.newRun('me', [L], { tree: tr }); Y.treeDrop(run, 10); const seq = []; for (let t = 9.9; t < 12; t += 0.05) { const lit = Y.treeLit(run, L, t + 1e-6).filter(i => i >= 2).join(''); if (!seq.length || seq[seq.length - 1][1] !== lit) seq.push([+(t - 10).toFixed(2), lit]); } out[tr] = { gT: +(run.gT - 10).toFixed(3), seq }; }
    return out;
  });
  console.log(JSON.stringify(out));

  if (ONLY.includes('ai')) {
    await ev(() => { window.__yb.test.startFill(); });
    const R = 'window.__yb.race';
    await runTo(`${R}.ags.some(A => A.ph === 'burn' && A.t > 1.2)`, 90); await shot('ai_burn', [7072, 3.2, 1121, 7060, 0.8, 1106]);
    const burn = await ev(() => window.__yb.race.ags.map(A => ({ n: A.r.name, ph: A.ph, rearT: A.st.t.vd && A.st.t.vd.tT.map(x => +x.toFixed(1)), rpm: Math.round(Math.abs(A.st.t.vd.we) * 30 / Math.PI), z: +A.z.toFixed(2), v: +A.st.v.toFixed(2) })));
    await runTo(`${R}.run && ${R}.run.st === 'tree'`, 120); await shot('ai_staged', [7060, 5.5, 1060, 7060, 1.2, 1084]);
    const staged = await ev(() => window.__yb.race.run.lanes.map(L => ({ s: L.side, A: +(L.A - window.__yb.SL).toFixed(3), pre: L.pre, stg: L.stg, burn: +L.burnT.toFixed(2), tMax: +L.tMax.toFixed(1) })));
    await runTo(`${R}.run && ${R}.run.lanes.every(L => L.leave != null && window.__yb.race.t - L.leave > 1.0)`, 30); await shot('ai_launch', [7060, 4.5, 1030, 7060, 1, 1062]);
    await runTo(`${R}.lastRun`, 90);
    const res = await ev(() => { const run = window.__yb.race.lastRun; if (!run) return { none: window.__yb.race.ags.map(A => A.r.name + ':' + A.ph + ':' + A.z.toFixed(1)) }; return { win: run.win && run.win.side, margin: run.margin, lanes: run.lanes.map(L => ({ s: L.side, n: L.who.r.name, car: L.who.c.id, rt: L.rt && +L.rt.toFixed(3), s60: L.split['60 ft'] && +L.split['60 ft'].t.toFixed(3), s330: L.split['330 ft'] && +L.split['330 ft'].t.toFixed(3), et: L.et && +L.et.toFixed(3), mph: L.mph && +L.mph.toFixed(2), red: L.red, dq: L.dq, spin: +L.spinT.toFixed(2) })) }; });
    const home = await runTo(`window.__yb.race.ags.every(A => A.ph === 'park')`, 200);
    const parked = await ev(() => window.__yb.race.ags.map(A => ({ n: A.r.name, ph: A.ph, x: +A.x.toFixed(1), z: +A.z.toFixed(1) })));
    console.log('AI', JSON.stringify({ burn, staged, res, home, parked }));
  }
  // one run of yours, scripted: drive out of the lanes, optional burnout, auto stage, press the gas RTD after the green
  const meRun = async (o) => {
    const OPP = o.opp != null ? o.opp : -1, RTD = o.rtd != null ? o.rtd : 0.1, LANE = o.lane || 'L', DT = o.dt || 1 / 60, tag = o.tag || 'me';
    await ev(`(() => { const M = window.__map, Y = window.__yb, R = Y.race, d = M.drvS(); if (Y.race.on) Y.close('left'); for (const A of R.ags.slice()) Y.agKill(A); R.ags.length = 0; R.run = null; R.fillT = 999; Object.assign(d, { x: 7056.5, z: 1162, yaw: 0, v: 0 }); M.physReset(); R.lane = '${LANE}'; R.tree = '${o.tree || 'pro'}'; R.dist = ${o.dist || 201.17}; const p = M.places().find(q => q.id === 'yellowbelly'); Y.start(p, ${OPP} >= 0 ? M.STREET3D[${OPP}] : null, ${OPP} >= 0 ? M.STREET3D[${OPP}].wager : 0); })()`);
    await ev(`(() => { const M = window.__map, Y = window.__yb, R = Y.race, d = M.drvS(), T = window.__t; const inp = { gas: 0, brake: 0, steer: 0, hb: 0 }; T.ph = 'out'; T.bt = 0; T.stT = 0; R.auto = false;
      T.drive = dt => { const me = R.me; if (!me) return; const lx = Y.LANES[me.side === 'L' ? 0 : 1], rz = d.z + 1.45;
        if (T.ph === 'out') { window.__drvIn = () => inp; if (R.ph === 'wait') { inp.gas = 0; inp.brake = 0; return; } inp.steer = Math.max(-1, Math.min(1, (d.x - lx) * 0.5 - d.yaw * 2.5)); inp.gas = d.v < 2.5 ? 0.25 : 0; inp.brake = 0; if (rz < Y.water.z0 + 8) T.ph = ${o.burn === 0 ? "'auto0'" : "'stop'"}; }
        else if (T.ph === 'stop') { inp.gas = 0; inp.brake = d.v > 0.65 ? 0.8 : 0; inp.steer = 0; if (Math.abs(d.v) < 0.1) T.ph = 'burn'; }
        else if (T.ph === 'burn') { inp.gas = 1; inp.brake = 1; T.bt += dt; if (T.bt > ${o.burn || 2.6}) { inp.gas = 0; inp.brake = 0; T.ph = 'auto0'; } }
        else if (T.ph === 'auto0') { window.__drvIn = null; R.auto = true; T.ph = 'auto'; }
        else if (T.ph === 'auto') { const run = R.run; if (run && (${o.early ? 1 : 0} ? (run.lanes.every(L => L.pre && L.stg) && R.t > (T.stT = T.stT || R.t) + 0.3) : (run.gT != null && R.t >= run.gT + ${RTD} - 0.25))) { M.keys.ArrowUp = true; T.ph = 'run'; } }
        else if (T.ph === 'run') { if (me.done != null || me.dq || (me.red && R.t - me.leave > 2)) { M.keys.ArrowUp = false; T.ph = 'shut'; } }
        else if (T.ph === 'shut') { M.keys.ArrowDown = d.v > 1; if (R.shown) { M.keys.ArrowDown = false; T.ph = 'end'; } } }; })()`);
    const ok1 = await runTo(`window.__yb.race.ph === 'call'`, 150, DT);
    if (process.env.TRACE) { const tr = await ev(() => { const out = [], M = window.__map, d = M.drvS(), R = window.__yb.race; for (let i = 0; i < 60 * 30; i++) { window.__t.drive(1 / 60); window.__yb.test.tick(1 / 60); if (i % 20 === 0) out.push([+(i / 60).toFixed(2), R.ph, window.__t.ph, +d.x.toFixed(2), +d.z.toFixed(2), +d.yaw.toFixed(2), +d.v.toFixed(2), R.on, M.TIRE.vd && M.TIRE.vd.rev, window.__drvIn ? 'in' : '-'].join(' ')); if (!R.on) break; } return out; }); console.log(tr.join('\n')); }
    let burnT = null;
    if (o.burn !== 0) { await runTo(`window.__t.ph === 'burn' && window.__t.bt > 1.6`, 120, DT); if (o.shots) await shot(tag + '_burn', [7066.6, 2.6, 1098, 7057, 0.7, 1110]); }
    await runTo(`window.__t.ph === 'auto' || window.__t.ph === 'run'`, 120, DT); burnT = await ev(() => window.__map.TIRE.vd.tT.map(x => +x.toFixed(1)));
    await runTo(`window.__yb.race.run && window.__yb.race.run.st !== 'stage'`, 150, DT); if (o.shots) await shot(tag + '_staged', [7060, 5.5, 1060, 7060, 1.2, 1084]);
    await runTo(`window.__yb.race.me && window.__yb.race.me.leave != null && window.__yb.race.t - window.__yb.race.me.leave > 0.9`, 60, DT); if (o.shots) await shot(tag + '_launch', [7060, 4.5, 1030, 7060, 1, 1062]);
    await runTo(`window.__yb.race.shown`, 100, DT); if (o.shots) { await wait(700); await shot(tag + '_slip'); }
    const res = await ev(() => { const R = window.__yb.race, run = R.run || {}, L = x => x && { s: x.side, k: x.kind, n: x.kind === 'ai' ? x.who.r.name : 'me', rt: x.rt && +x.rt.toFixed(3), s60: x.split['60 ft'] && +x.split['60 ft'].t.toFixed(3), s330: x.split['330 ft'] && +x.split['330 ft'].t.toFixed(3), et: x.et && +x.et.toFixed(3), mph: x.mph && +x.mph.toFixed(2), red: x.red, dq: x.dq, burn: +x.burnT.toFixed(2), tMax: +x.tMax.toFixed(0), spin: +x.spinT.toFixed(2) }; const d = window.__map.drvS(); return { dbg: [R.ph, window.__t.ph, +d.x.toFixed(1), +d.z.toFixed(1), +d.v.toFixed(2), R.run && R.run.st, R.on], lanes: (run.lanes || []).map(L), win: run.win ? run.win.kind : null, margin: run.margin, shown: R.shown, slip: R.q && R.q('slip').innerText.replace(/\s+/g, ' ').slice(0, 400) }; });
    await ev(() => { window.__t.drive = null; window.__map.keys.ArrowUp = window.__map.keys.ArrowDown = false; const b = document.querySelector('#ybhud [data-a="done"]'); if (b) b.click(); });
    return { ok1, burnT, res };
  };
  if (ONLY.includes('me')) console.log('ME', JSON.stringify(await meRun({ opp: +(process.env.OPP || 3), shots: true, tag: 'me' })));
  if (ONLY.includes('red')) console.log('RED', JSON.stringify(await meRun({ opp: 1, early: true, tag: 'red', shots: true })));
  if (ONLY.includes('fps')) { const a = await meRun({ dt: 1 / 30, burn: 0, rtd: 0.05 }), c = await meRun({ dt: 1 / 120, burn: 0, rtd: 0.05 }); console.log('FPS', JSON.stringify({ dt30: a.res.lanes[0], dt120: c.res.lanes[0] })); }
  if (ONLY.includes('burn')) { const a = await meRun({ burn: 0, rtd: 0.05 }), c = await meRun({ burn: 3.0, rtd: 0.05 }); console.log('BURN', JSON.stringify({ none: [a.burnT, a.res.lanes[0]], burn: [c.burnT, c.res.lanes[0]] })); }
  if (ONLY.includes('sport')) console.log('SPORT', JSON.stringify(await meRun({ opp: 5, tree: 'sport', rtd: 0.05, lane: 'R', shots: true, tag: 'sport' })));
  if (ONLY.includes('soak')) {
    const rs = [];
    for (let i = 0; i < (+process.env.N || 4); i++) {
      await ev(() => { const R = window.__yb.race; for (const A of R.ags) if (A.ph === 'park') A.park = 999; R.fillT = 0.1; R.lastRun = null; });
      await runTo(`window.__yb.race.run && window.__yb.race.run.kind === 'ai'`, 60);
      await runTo(`window.__yb.race.lastRun`, 200);
      rs.push(await ev(() => { const run = window.__yb.race.lastRun; window.__yb.race.lastRun = null; return run ? run.lanes.map(L => `${L.who ? L.who.r.name : 'me'}:${L.red ? 'RED' : L.dq || (L.et && L.et.toFixed(3))} rt ${L.rt && L.rt.toFixed(3)}${run.win === L ? ' W' : ''}`).join(' | ') : 'none'; }));
      await runTo(`!window.__yb.race.run`, 30);
    }
    console.log('SOAK', JSON.stringify({ rs, ags: await ev(() => window.__yb.race.ags.map(A => A.r.name + ':' + A.ph)), voices: await ev(() => window.__yb.VO.list.length), heap: await ev(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1) }));
  }
  console.log('ERR', errs.filter(e => !/GPU stall|WebGL|deprecated/.test(e)).slice(0, 20).join('\n'));
  await b.close();
})();
