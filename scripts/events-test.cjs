// Phase 3E event, championship, ranking and leaderboard tests (headless Chromium, Playwright).
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// ONLY=pass,logic,money,hr,yb,shots picks tests (default pass,logic,money,hr). Prints one JSON line per test; ERR lists page errors.
// pass:  off-screen passes (the ones the other pairs in a ladder run) next to a real pass, on the same physics
// logic: whole events with your rounds stood in by a pass of your own car: ladder, purse, points, a full season, unlocks
// money: no prize money for rounds that weren't raced (withdraw at once = only the entry spent)
// hr:    a real I-20 40-roll event, every round of yours driven on the highway
// yb:    a real Bracket Night round at Yello Belly: the dial-ins, the handicap tree, the slip with the ladder
const { chromium } = require('playwright');
const S = process.env.S, ONLY = (process.env.ONLY || 'pass,logic,money,hr').split(',');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const pg = await b.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF || 1) });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600))); pg.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /event|roll|yello/i.test(m.text()))) errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const shot = async n => { await ev(() => { let st = document.getElementById('t3dhide'); if (!st) { st = document.createElement('style'); st.id = 't3dhide'; document.head.appendChild(st); } st.textContent = '.pad,#radio,#card,#mini,#compass{display:none!important}'; }); await wait(700); await pg.screenshot({ path: S + '/b/t3e_' + n + '.png', timeout: 180000 }); };
  await ev(() => { const M = window.__map; M.S.cash = 1e7; M.S.rep = 9999; M.S.day = 1; try { M.closeCreator(); } catch (e) {} });
  await wait(1500);
  const CAR = process.env.CAR || 'dodge_charger_srt_hellcat_widebody_2020';
  const at = (x, z) => ev(`(() => { const M = window.__map; M.S.car = M.S.car && M.S.car.id === '${CAR}' ? M.S.car : M.newCar('${CAR}'); M.S.car.fuel = 100; M.foot.on = false; M.gbMode(false); M.startDrive(${x}, ${z}); M.setTime('night'); })()`);
  await at(5600, 1363); await wait(3000);
  for (let k = 0; k < 20; k++) { const ok = await ev(() => { const M = window.__map; if (M.foot.on) M.getIn(); const o = M.carObj(); return !!(o && o.userData.model); }); if (ok) break; await wait(1000); }
  await ev(() => { window.__yb.test.manual = true; const Y = window.__yb;
    window.__t = { run(n, dt, cond) { for (let i = 0; i < n; i++) { if (window.__t.drive) window.__t.drive(dt); Y.test.tick(dt); if (cond && cond()) return i + 1; } return -1; } }; });
  const runTo = async (cond, maxS = 120, dt = 1 / 60) => { for (let k = 0; k < maxS; k++) { const r = await ev(`window.__t.run(${Math.round(1 / dt)}, ${dt}, () => (${cond}))`); if (r > 0) return true; } return false; };

  if (ONLY.includes('pass')) {
    const r = await ev(() => { const Y = window.__yb, E = Y.ev, M = window.__map, out = [];
      const me = { name: 'me', car: M.S.car, skill: 0.9 };
      for (const r of [me, ...M.STREET3D.filter((x, i) => [0, 3, 7, 9].includes(i)), ...E.POOL.filter(x => ['Slim', 'Marco', 'J-Rock', 'Ky'].includes(x.name))]) {
        const yb = E.pass(r, E.DEFS.street), r60 = E.pass(r, E.DEFS.r60), dig = E.pass(r, E.DEFS.rdig);
        out.push({ n: r.name, car: r.car ? r.car.id : r.id, yb: { rt: +yb.rt.toFixed(3), et: yb.et && +yb.et.toFixed(3), mph: yb.mph && +yb.mph.toFixed(1), red: yb.red }, r60: { rt: +r60.rt.toFixed(3), t: r60.t && +r60.t.toFixed(3), mph: r60.mph && +r60.mph.toFixed(1) }, dig: dig.t && +dig.t.toFixed(3) }); }
      return out; });
    for (const x of r) console.log(JSON.stringify({ test: 'pass', ...x }));
  }
  // whole events: your rounds stood in by a pass of your car (the real-race version is the hr/yb tests)
  const logicEvent = id => ev(id => { const Y = window.__yb, E = Y.ev, M = window.__map, S = M.S; S.cash = Math.max(S.cash, 1e6); const c0 = S.cash, r0 = S.rep;
    const meR = { name: 'me', car: S.car, skill: 0.85 };
    if (!E.enter(id, 7.52)) return { id, entered: false, why: document.querySelector('#toast') && document.querySelector('#toast').textContent };
    const ev = E.EV.cur, rounds = [];
    while (!ev.over) { const o = E.opp(ev); if (!o) break; const mine = E.pass(meR, ev.def), theirs = E.pass(o.r, ev.def);
      const meE = ev.field.find(e => e.me);
      const won = E.judge(ev, meE, o, mine, theirs) === meE;
      rounds.push(`${o.r.name}: ${won ? 'W' : 'L'} ${mine.et && mine.et.toFixed(3)} vs ${theirs.et && theirs.et.toFixed(3)}`);
      M.evMineTest(won, mine, theirs); }
    const ladder = ev.rounds.map(rd => rd.map(p => `${p.a.me ? 'ME' : p.a.r.name}${p.b ? ' v ' + (p.b.me ? 'ME' : p.b.r.name) : ''} → ${p.w ? (p.w.me ? 'ME' : p.w.r.name) : '?'}`));
    return { id, field: ev.field.map(e => (e.me ? 'ME' : e.r.name) + (e.dial ? '@' + e.dial : '')), rounds, ladder, champ: ev.champ && (ev.champ.me ? 'ME' : ev.champ.r.name), wins: ev.wins, cash: S.cash - c0, rep: S.rep - r0, log: ev.log.slice(-3) }; }, id);
  if (ONLY.includes('logic')) {
    await ev(() => { const Y = window.__yb; window.__map.evMineTest = (w, a, b) => Y.ev.mine(w, a, b); });
    for (let d = 1; d <= 4; d++) { await ev(d => { window.__map.S.day = d; window.__yb.ev.EV.cur = null; }, d); for (const id of ['street', 'hp', 'bracket']) console.log(JSON.stringify({ test: 'logic', day: d, ...(await logicEvent(id)) })); }
    console.log(JSON.stringify({ test: 'logic', again: await logicEvent('street') }));   // same day: refused
    const lock = await ev(() => { const M = window.__map; return { invLocked: !!window.__yb.ev.DEFS.inv.lock(), unl: M.S.ybUnl || null, radialLegal: window.__yb.ev.DEFS.radial.ok(M.S.car) }; });
    await ev(() => { window.__map.S.day = 9; window.__yb.ev.EV.cur = null; });
    console.log(JSON.stringify({ test: 'logic', lock, inv: await logicEvent('inv') }));
    console.log(JSON.stringify({ test: 'tables', champs: await ev(() => window.__map.S.evChamp), rank: await ev(() => window.__yb.ev.rank('yb').slice(0, 10).map(e => `${e.name} ${e.pts} (${e.w}-${e.l}, ${e.ev} wins, ${e.titles} titles)`)),
      boards: await ev(() => Object.fromEntries(Object.entries(window.__yb.ev.board() || {}).slice(0, 6).map(([k, L]) => [k, L.slice(0, 3).map(e => `${e.who} ${e.et.toFixed(3)}`)]))), hist: await ev(() => (window.__map.S.evHist || []).slice(0, 4)) }));
  }
  if (ONLY.includes('money')) {
    const r = await ev(() => { const Y = window.__yb, E = Y.ev, M = window.__map, S = M.S; S.cash = Math.max(S.cash, 1e6); S.day = 20; E.EV.cur = null; const c0 = S.cash; E.enter('radial') || (M.S.car.drag = null);
      const ok = !!E.EV.cur; if (!ok) { E.enter('street'); } const fee = E.EV.cur.def.fee; E.withdraw(); return { entered: E.EV.cur.def.name, fee, spent: c0 - S.cash, over: E.EV.cur.over, champ: E.EV.cur.champ && E.EV.cur.champ.r.name, wins: E.EV.cur.wins, hist: S.evHist[0] }; });
    console.log(JSON.stringify({ test: 'money', ...r, ok: r.spent === r.fee }));
  }
  if (ONLY.includes('hr')) {
    await ev(() => { const M = window.__map, Y = window.__yb; M.S.day = 30; Y.ev.EV.cur = null; Y.roll.act = 'auto'; const c0 = M.S.cash; window.__t.c0 = c0; Y.ev.enter('r40'); const p = M.places().find(q => q.id === 'i20roll'); Y.ev.hrRace(p); });
    const rs = [];
    for (let k = 0; k < 3; k++) {
      await ev(() => { const M = window.__map, Y = window.__yb, H = Y.roll, d = M.drvS(), T = window.__t; T.go = null; M.keys.ArrowUp = false;
        T.drive = dt => { const zMe = Y.hw.lanes[1], st = H.st; if (!H.on) return; if (st === 'run' && T.go == null) T.go = H.t; if (T.go != null && H.t - T.go >= 0.2 && st === 'run') M.keys.ArrowUp = true; if (st === 'done') M.keys.ArrowUp = false; }; });
      await runTo(`window.__yb.roll.shown || !window.__yb.roll.on`, 200);
      const r = await ev(() => { const H = window.__yb.roll, E = window.__yb.ev.EV.cur, q = k => document.querySelector(`#ybhud [data-k="${k}"]`), M = window.__map;
        return { on: H.on, shown: H.shown, me: H.me && { t: H.me.done && +H.me.done.toFixed(3), jump: H.me.jump }, ai: H.ai && { n: H.opp.name, t: H.ai.done && +H.ai.done.toFixed(3) }, ev: E && { ri: E.ri, wins: E.wins, over: E.over, out: E.out, champ: E.champ && (E.champ.me ? 'ME' : E.champ.r.name), cash: E.cash, log: E.log.slice(-2) },
          slip: q('slip') && q('slip').innerText.replace(/\s+/g, ' ').slice(0, 500), next: !!document.querySelector('#ybhud [data-a="evnext"]'), cashNow: M.S.cash - window.__t.c0, hrMode: H.mode }; });
      rs.push(r); console.log(JSON.stringify({ test: 'hr', round: k, ...r }));
      if (process.env.SHOTS && k === 0) await shot('hr_slip');
      const nx = await ev(() => { const b = document.querySelector('#ybhud [data-a="evnext"]'); window.__map.keys.ArrowUp = false; if (b) { b.click(); return true; } return false; });
      if (!nx) break;
    }
    console.log(JSON.stringify({ test: 'hr-menu', rows: await ev(() => { const M = window.__map, p = M.places().find(q => q.id === 'i20roll'), m = window.__yb.roll.menu(p); return m.rows.filter(r => /🏁|rankings|Withdraw/.test(r.t)).map(r => `${r.t} | ${r.s} | ${r.btn}${r.off ? ' (off)' : ''}`); }) }));
  }
  if (ONLY.includes('yb')) {
    await ev(() => { const Y = window.__yb; if (Y.roll.on) Y.roll.close('left'); });
    await at(7056.5, 1162); await wait(3000);
    await ev(() => { const M = window.__map, Y = window.__yb, R = Y.race, d = M.drvS(); if (M.foot.on) M.getIn(); for (const A of R.ags.slice()) Y.agKill(A); R.ags.length = 0; R.run = null; R.fillT = 999; Object.assign(d, { x: 7056.5, z: 1162, yaw: 0, v: 0 }); M.physReset(); R.lane = 'L';
      M.S.day = 40; Y.ev.EV.cur = null; M.S.ybRec = M.S.ybRec || {}; M.S.ybRec[M.S.car.id] = Object.assign(M.S.ybRec[M.S.car.id] || {}, { e: { et: 7.54, mph: 98 } });
      const p = M.places().find(q => q.id === 'yellowbelly'); Y.panel(p); document.querySelector('#ybpanel [data-tab="ev"]').click(); });
    if (process.env.SHOTS) await shot('yb_events');
    const ent = await ev(() => { const btn = document.querySelector('#ybpanel [data-ev="enter"][data-id="bracket"]'); btn.click(); const E = window.__yb.ev.EV.cur; return { ok: !!E, field: E && E.field.map(e => (e.me ? 'ME' : e.r.name) + '@' + e.dial), opp: E && window.__yb.ev.opp(E).r.name }; });
    console.log(JSON.stringify({ test: 'yb-enter', ...ent }));
    if (process.env.SHOTS) await shot('yb_ladder');
    await ev(() => document.querySelector('#ybpanel [data-ev="race"]').click());
    // the scripted driver from the 3B test: out of the lanes, roll through the water, auto stage, gas just after your own green
    await ev(() => { const M = window.__map, Y = window.__yb, R = Y.race, d = M.drvS(), T = window.__t; const inp = { gas: 0, brake: 0, steer: 0, hb: 0 }; T.ph = 'out'; R.auto = false; T.gT = null;
      T.drive = dt => { const me = R.me; if (!me) return; const lx = Y.LANES[me.side === 'L' ? 0 : 1], rz = d.z + 1.45;
        if (T.ph === 'out') { window.__drvIn = () => inp; if (R.ph === 'wait') { inp.gas = 0; inp.brake = 0; return; } inp.steer = Math.max(-1, Math.min(1, (d.x - lx) * 0.5 - d.yaw * 2.5)); inp.gas = d.v < 2.5 ? 0.25 : 0; inp.brake = 0; if (rz < Y.water.z0 + 8) T.ph = 'auto0'; }
        else if (T.ph === 'auto0') { window.__drvIn = null; R.auto = true; T.ph = 'auto'; }
        else if (T.ph === 'auto') { const run = R.run; if (run && run.gT != null) { T.gT = run.gT + (me.hc || 0); T.hc = [me.hc, run.lanes[1] && run.lanes[1].hc, me.dial, run.lanes[1] && run.lanes[1].dial]; if (R.t >= T.gT + 0.06 - 0.25) { M.keys.ArrowUp = true; T.ph = 'run'; } } }
        else if (T.ph === 'run') { if (me.done != null || me.dq || (me.red && R.t - me.leave > 2)) { M.keys.ArrowUp = false; T.ph = 'shut'; } }
        else if (T.ph === 'shut') { M.keys.ArrowDown = d.v > 1; if (R.shown) { M.keys.ArrowDown = false; T.ph = 'end'; } } }; });
    const ok1 = await runTo(`window.__yb.race.ph === 'call'`, 150);
    await runTo(`window.__yb.race.run && window.__yb.race.run.st === 'tree'`, 200);
    if (process.env.SHOTS) { await runTo(`window.__yb.race.run && window.__yb.race.t > window.__yb.race.run.ta + 0.6`, 5, 1 / 120); await ev(() => { const C = window.__map.cam(); C.position.set(7060, 5.5, 1060); C.lookAt(7060, 1.2, 1084); C.updateMatrixWorld(); }); await shot('yb_tree'); }
    await runTo(`window.__yb.race.shown`, 200);
    const r = await ev(() => { const R = window.__yb.race, run = R.lastRun || R.run || {}, T = window.__t, E = window.__yb.ev.EV.cur, q = k => document.querySelector(`#ybhud [data-k="${k}"]`);
      return { ok: true, hc: T.hc, lanes: (run.lanes || []).map(L => ({ k: L.kind, rt: L.rt && +L.rt.toFixed(3), et: L.et && +L.et.toFixed(3), dial: L.dial, hc: L.hc && +L.hc.toFixed(2), red: L.red, dq: L.dq, done: L.done && +L.done.toFixed(3) })), win: run.win && run.win.kind, why: run.why, ev: E && { ri: E.ri, wins: E.wins, over: E.over, log: E.log.slice(-2) },
        slip: q('slip') && q('slip').innerText.replace(/\s+/g, ' ').slice(0, 700), next: !!document.querySelector('#ybhud [data-a="evnext"]') }; });
    console.log(JSON.stringify({ test: 'yb', ok1, ...r }));
    if (process.env.SHOTS) { await wait(500); await shot('yb_slip'); }
  }
  console.log('ERR', errs.filter(e => !/GPU stall|WebGL|deprecated/.test(e)).slice(0, 20).join('\n') || 'none'); await b.close();
})();
