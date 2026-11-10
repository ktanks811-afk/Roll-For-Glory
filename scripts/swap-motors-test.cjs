// Swap motor tests: the 444-motor swap list (every one makes its rated power on the engine model, builds a car and an
// engine sound config without errors), the motors built in-game for the bay (fours, sixes, rotaries, V10s, V12s, diesels),
// and the Swap tab (makes, layouts, air, search, sort, tap twice to swap, parts on a swapped motor).
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// SHOTS=1 OUT=dir saves the Swap tab at iPhone size. Prints one JSON line per check; ERR lists page errors.
const { chromium } = require('playwright');
const S = process.env.S, OUT = process.env.OUT || '.';
const BOX = 'chevrolet_caprice_classic_box_chevy_1986', SCAT = 'dodge_charger_scat_pack_2015';
const log = o => console.log(JSON.stringify(o));
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: process.env.SHOTS ? 2 : 1 });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},single(){return Promise.resolve({})},upsert(){return Promise.resolve({})}}),auth:{getSession:()=>Promise.resolve({data:{}})}})', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:8765/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a);
  await ev(() => { const M = window.__map; M.S.cash = 1e8; try { M.closeCreator(); } catch (e) {} window.__car = (id, x) => { M.S.cash = 1e8; const c = M.newCar(id); c.fuel = 100; c.eb = {}; if (x) c.engX = x; M.S.car = c; return c; }; });

  // 1. factory cars are untouched
  log(await ev(([a, b2]) => { const M = window.__map; return { test: 'factory cars', scat: M.carHp(window.__car(a)) + ' hp', box: M.carHp(window.__car(b2)) + ' hp' }; }, [SCAT, BOX]));

  // 2. the list: how many, by make and by layout, no duplicate ids, prices sane
  log(await ev(() => { const E = window.__map.ELAB, by = {}, lay = {}; for (const x of E.XENG) { by[x.brand] = (by[x.brand] || 0) + 1; lay[x.lay] = (lay[x.lay] || 0) + 1; }
    return { test: 'swap list', motors: E.XENG.length, ids: new Set(E.XENG.map(x => x.id)).size, cheapest: Math.min(...E.XENG.map(x => x.price)), dearest: Math.max(...E.XENG.map(x => x.price)), by, lay }; }));

  // 3. every motor in a box Chevy: rated power and torque from the engine model, a drivable car, an engine sound config, a motor for the bay
  log(await ev(BOX => { const M = window.__map, E = M.ELAB, out = { test: 'every swap motor on the engine model', ok: 0, off: [], warn: [], thrown: [], bay: { engineStand: 0, builtHere: 0, none: [] }, tris: 0 }; const t0 = performance.now();
    for (const x of E.XENG) { try { const c = window.__car(BOX, x.id), D = E.ENG_DB[x.id], R = M.engOf(c), hp = M.carHp(c);
      if (Math.abs(R.hp / D.hp - 1) > 0.07 || Math.abs(R.tq / D.tq - 1) > 0.07) out.off.push(`${x.id} ${Math.round(R.hp)}/${D.hp} hp ${Math.round(R.tq / 1.3558)}/${Math.round(D.tq / 1.3558)} lb-ft`); else out.ok++;
      if (R.warn.length) out.warn.push(x.id); const V = M.vehOf(c), ea = M.eaCfgOf(c); if (!V || !V.E || !(V.E.tab || V.E.tq) || !ea || !ea.gen || !ea.gen.ev.length || !(hp > 0)) out.thrown.push(x.id + ' incomplete');
      if (E.crateCfg(c)) out.bay.engineStand++; else { const g = E.genMotor(c); if (g && g.parts.length && g.box[1][2] > g.box[0][2]) { out.bay.builtHere++; out.tris = Math.max(out.tris, g.tris); } else out.bay.none.push(x.id); }
    } catch (e) { out.thrown.push(x.id + ' ' + String(e).slice(0, 90)); } }
    out.ms = Math.round(performance.now() - t0); return out; }, BOX));

  // 4. a few on a timeslip: the same box Chevy with a junkyard 4.8, a 2JZ, a Hellcat-class blower motor and an F1 V10
  log(await ev(BOX => { const M = window.__map, out = { test: 'quarter mile in a box Chevy' };
    for (const id of [null, 'lr4', '2jzgte', 'k20a', '13brew', 'cum67', 'viper5', 'f812', 'demon170', 'f1v10', 'topfuel']) { const c = window.__car(BOX, id); try { const r = M.tuneRun(c, c.tune || {}, {}); const V = M.vehOf(c); out[id || 'stock 305'] = `${M.carHp(c)} hp · 0-60 ${r.t60.toFixed(1)} s · ${r.et.toFixed(2)} s @ ${Math.round(r.trap)} mph · rear gear x${V.swG.toFixed(2)}`; } catch (e) { out[id || 'stock'] = 'ERR ' + String(e).slice(0, 80); } }
    return out; }, BOX));

  // 4b. every motor makes a full pass in a Scat Pack (8-speed automatic, traction control): no stalls, no blow-ups in the physics
  log(await ev(SCAT => { const M = window.__map, E = M.ELAB, out = { test: 'every swap motor runs the quarter in a Scat Pack', ran: 0, bad: [] }; let slow = ['', 0], quick = ['', 99];
    for (const x of E.XENG) { const c = window.__car(SCAT, x.id); try { const r = M.tuneRun(c, c.tune || {}, {}); if (!(r.et > 6 && r.et < 30) || !(r.trap > 30)) out.bad.push(`${x.id} et ${r.et} trap ${r.trap}`); else { out.ran++; if (r.et > slow[1]) slow = [x.id, r.et]; if (r.et < quick[1]) quick = [x.id, r.et]; } } catch (e) { out.bad.push(x.id + ' ' + String(e).slice(0, 70)); } }
    out.slowest = slow[0] + ' ' + slow[1].toFixed(2) + ' s'; out.quickest = quick[0] + ' ' + quick[1].toFixed(2) + ' s'; return out; }, SCAT));

  // 5. the Swap tab: filters, search and sort, then tap twice to swap, then parts on the new motor
  log(await ev(BOX => { const M = window.__map, E = M.ELAB, K = M.PCAT, c = window.__car(BOX), out = { test: 'Swap tab' }, el = () => document.getElementById('englab'); E.elOpen('swap');
    const rows = () => el().querySelectorAll('.pcr').length, cntTxt = () => [...el().querySelectorAll('.note')].map(n => n.textContent).find(t => /^\d[\d,]* motors?/.test(t));
    out.title = [...el().querySelectorAll('h3')].map(h => h.textContent).join(' | '); out.all = cntTxt() + ' · rows shown ' + rows(); out.makes = el().querySelectorAll('[data-swb]').length - 1; out.layouts = el().querySelectorAll('[data-swt]').length - 1;
    const pick = (sel, v) => { el().querySelector(`[${sel}="${v}"]`).click(); return cntTxt(); };
    out.toyota = pick('data-swb', 'Toyota / Lexus'); out['toyota straight 6'] = pick('data-swt', 'i6'); pick('data-swb', ''); out.rotary = pick('data-swt', 'rot'); out.diesel = pick('data-swt', 'dsl'); out['v10 v12 16'] = pick('data-swt', 'big'); pick('data-swt', 'all');
    const setSel = (sel, v) => { const s = el().querySelector(sel); s.value = v; s.onchange({ target: s }); return cntTxt(); };
    out.turbo = setSel('[data-swa]', 'turbo'); out.blown = setSel('[data-swa]', 'sc'); out.na = setSel('[data-swa]', 'na'); setSel('[data-swa]', 'all');
    setSel('[data-sws]', 'hp-'); out.mostPower = el().querySelector('.pcr .pct b').textContent; setSel('[data-sws]', 'red-'); out.highestRev = el().querySelector('.pcr .pct b').textContent; setSel('[data-sws]', 'price'); out.cheapest = el().querySelector('.pcr .pct b').textContent + ' ' + el().querySelector('.pcr [data-sw]').textContent;
    E.SWL.q = '2jz'; E.swRender(); out['search 2jz'] = [...el().querySelectorAll('.pcr .pct b')].map(x => x.textContent).join(' / ');
    E.SWL.q = '2jz-gte twin'; E.swRender(); const cash0 = M.S.cash, hp0 = M.carHp(c); let bt = el().querySelector('[data-sw^="x:"]'); out.button = bt.textContent; bt.click(); bt = el().querySelector('[data-sw^="x:"]'); out.asked = bt.textContent; bt.click();
    out.swapped = `${c.engX} · ${hp0} -> ${M.carHp(c)} hp · paid ${cash0 - M.S.cash} · eb ${JSON.stringify(c.eb)}`; out.inItNow = !!el().querySelector('.pcr.sel button[disabled]');
    // a bigger single turbo kit can't go on (already boosted); cams, injectors and an exhaust can
    const D = M.engDefOf(c), bb = K.engBuild(c), fit = (cat, re) => { const s = K.PC.find(z => z.cat === cat && (!re || re.test(z.name))); return s ? (K.pcFits(c, D, bb, s) || 'fits') : 'none'; };
    out.fits = { cam: fit('cam'), inj: fit('inj'), exh: fit('exh'), turboKit: fit('power', /turbo/), rockers: fit('rockers'), meth: fit('meth') };
    E.elGo('build'); out.build = (el().querySelector('.elhd h2') || {}).textContent + ' · groups ' + el().querySelectorAll('h4.elg').length; E.elGo('boost'); out.boost = (el().querySelector('.elhd h2') || {}).textContent; E.elGo('ecu'); out.ecu = (el().querySelector('.elhd h2') || {}).textContent; E.elGo('health'); out.health = (el().querySelector('.elhd h2') || {}).textContent;
    // saved and loaded: the motor comes back
    const c2 = JSON.parse(JSON.stringify(c)); out.reload = `${c2.engX} ${M.carHp(c2)} hp`; return out; }, BOX));

  // 6. the odd ones on the Build tab: a rotary, a diesel (no gas grades), a carbureted V12, a 16 cylinder
  log(await ev(BOX => { const M = window.__map, E = M.ELAB, out = { test: 'Build tab on a rotary, a diesel, a V12 and a W16' }, el = () => document.getElementById('englab');
    for (const id of ['13brew', 'cum12v', 'miura', 'w16c', 'rs3']) { const c = window.__car(BOX, id); E.elOpen('build'); const st = [...el().querySelectorAll('.g .s')].slice(0, 6).map(s => s.textContent.replace(/\s+/g, ' ')).join(' ; '); const fuelRow = el().querySelector('[data-fuel]'); out[id] = st + ' ; fuel buttons ' + (fuelRow && !fuelRow.closest('[hidden]') ? 'shown' : 'hidden') + ' ; ' + M.carHp(c) + ' hp'; }
    return out; }, BOX));

  if (process.env.SHOTS) {
    await ev(BOX => { const E = window.__map.ELAB; window.__car(BOX); E.SWL.q = ''; E.SWL.brand = ''; E.SWL.type = 'all'; E.elOpen('swap'); document.getElementById('englab').scrollTop = 0; }, BOX); await pg.waitForTimeout(300); await pg.screenshot({ path: OUT + '/swap-all.png' });
    await ev(() => { const E = window.__map.ELAB, el = document.getElementById('englab'); E.SWL.sort = 'hp-'; E.SWL.brand = 'Toyota / Lexus'; E.swRender(); const h = [...el.querySelectorAll('h3')].find(x => /Swap motors/.test(x.textContent)); el.scrollTop = h.offsetTop - 60; }); await pg.waitForTimeout(300); await pg.screenshot({ path: OUT + '/swap-toyota.png' });
    await ev(() => { const E = window.__map.ELAB, el = document.getElementById('englab'); E.SWL.brand = ''; E.SWL.type = 'rot'; E.swRender(); const h = [...el.querySelectorAll('h3')].find(x => /Swap motors/.test(x.textContent)); el.scrollTop = h.offsetTop - 60; }); await pg.waitForTimeout(300); await pg.screenshot({ path: OUT + '/swap-rotary.png' });
    await ev(() => { const E = window.__map.ELAB, el = document.getElementById('englab'); E.SWL.type = 'all'; E.SWL.q = 'hemi'; E.SWL.sort = 'price'; E.swRender(); const h = [...el.querySelectorAll('h3')].find(x => /Swap motors/.test(x.textContent)); el.scrollTop = h.offsetTop - 60; }); await pg.waitForTimeout(300); await pg.screenshot({ path: OUT + '/swap-search.png' });
  }
  console.log('ERR', JSON.stringify(errs)); await b.close();
})();
