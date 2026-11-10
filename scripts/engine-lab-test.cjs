// One engine system tests: the Engine Lab's tabs (Build, Parts, Boost, Nitrous, ECU, Swap, Health), the shared draft,
// crate swaps on the engine model, the new part types, old Engine Build swaps converting on load, the drivetrain parts.
// Serve the repo on http://localhost:8765 and set S to a folder that holds npm/node_modules/three (three@0.128.0).
// SHOTS=1 OUT=dir saves each tab at iPhone size. Prints one JSON line per check; ERR lists page errors.
const { chromium } = require('playwright');
const S = process.env.S, OUT = process.env.OUT || '.';
const SCAT = 'dodge_charger_scat_pack_2015', HELL = 'dodge_charger_srt_hellcat_widebody_2020', BOX = 'chevrolet_caprice_classic_box_chevy_1986', MUS = 'ford_mustang_gt_2019';
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
  await ev(() => { const M = window.__map; M.S.cash = 1e7; try { M.closeCreator(); } catch (e) {} window.__car = (id, eb) => { M.S.cash = 1e7; const c = M.newCar(id); c.fuel = 100; c.eb = Object.assign({}, eb || {}); M.S.car = c; return c; }; });

  // 1. factory power is unchanged by the new part types (none on = same engine)
  log(await ev(([a, b2, c3]) => { const M = window.__map, out = { test: 'factory cars' }; for (const id of [a, b2, c3]) { const c = window.__car(id); out[id.slice(0, 24)] = M.carHp(c) + ' hp'; } return out; }, [SCAT, HELL, MUS]));

  // 2. the catalog: new part types and how many brand parts
  log(await ev(() => { const K = window.__map.PCAT, out = { test: 'catalog', total: K.PC.length, brands: new Set(K.PC.map(s => s.brand)).size, dup: K.PC.length - K.PC_BY.size };
    for (const k of ['rockers', 'lifters', 'timing', 'gasket', 'studs', 'bal', 'fly', 'tuner', 'fuelk', 'icool', 'wgate', 'meth']) out[k] = K.PC.filter(s => s.cat === k).length;
    out.badBase = K.PC.filter(s => !(s.cat === 'cam' ? s.base === 'cat' : (K.ENG_PARTS[s.cat] && K.ENG_PARTS[s.cat].opts[s.base]) || ['coil', 'shock', 'sspr', 'tbar', 'arb'].includes(s.cat))).map(s => s.id).slice(0, 5); return out; }));

  // 3. what the new parts do on a 392 (rockers, lifters + springs and the redline, underdrive pulley, water-meth on a blower car, flywheel)
  log(await ev(([SCAT, HELL]) => { const M = window.__map, K = M.PCAT, out = { test: 'new parts on the engine model' };
    const put = (c, ids) => { const eb = Object.assign({}, c.eb); for (const id of ids) { const s = K.PC_BY.get(id); eb[s.cat] = s.base; eb.sku = Object.assign({}, eb.sku, { [s.cat]: s.id }); } c.eb = eb; M.VEH_CACHE && M.VEH_CACHE.clear && M.VEH_CACHE.clear(); return c; };
    const R = c => { const r = M.engOf(c); return `${Math.round(r.hp)} hp red ${r.red} Ie ${r.Ie.toFixed(3)}${r.psi ? ' ' + r.psi.toFixed(1) + ' psi' : ''}${r.warn.length ? ' ⚠' : ''}`; };
    const f = (cat, re) => K.PC.find(s => s.cat === cat && re.test(s.name));
    out.stock = R(window.__car(SCAT));
    out['1.8 rockers'] = R(put(window.__car(SCAT), [f('rockers', /1\.8 ratio/).id]));
    out['solid rollers + springs'] = R(put(window.__car(SCAT), [f('springs', /dual/).id, f('lifters', /solid/).id]));
    out['gear drive + damper'] = R(put(window.__car(SCAT), [f('timing', /gear/).id, f('bal', /harmonic/).id]));
    out['25% underdrive'] = R(put(window.__car(SCAT), [f('bal', /25%/).id]));
    out['.060 MLS'] = R(put(window.__car(SCAT), [f('gasket', /\.060/).id]));
    out['hellcat stock'] = R(window.__car(HELL));
    out['hellcat + meth'] = R(put(window.__car(HELL), [f('meth', /Stage 3/).id]));
    out['solid lifters, no springs (fits?)'] = K.pcFits(window.__car(SCAT), M.engDefOf(window.__car(SCAT)), K.engBuild(window.__car(SCAT)), f('lifters', /solid/)) || 'fits';
    out['wastegate on NA (fits?)'] = K.pcFits(window.__car(SCAT), M.engDefOf(window.__car(SCAT)), K.engBuild(window.__car(SCAT)), f('wgate', /Tial/)) || 'fits';
    return out; }, [SCAT, HELL]));

  // 4. crate swaps on the engine model: every crate makes its rated power in a box Chevy, and takes parts
  log(await ev(BOX => { const M = window.__map, E = M.ELAB, out = { test: 'crate motors in a box Chevy' };
    for (const [id] of E.CRATES) { const c = window.__car(BOX); c.engX = id; out[id] = `${M.carHp(c)} hp (rated ${E.ENG_DB[id].hp})`; }
    const c = window.__car(BOX); c.engX = 'lm7'; const K = M.PCAT, t = K.PC.find(s => s.cat === 'power' && s.base === 'turbo1' && /7685.*14 psi/.test(s.name)); c.eb = { power: 'turbo1', sku: { power: t.id }, pistons: 'boost', inj: 'i80', pump: 'p450' };
    out['junkyard 5.3 + ' + t.name] = M.carHp(c) + ' hp'; out.cfg = JSON.stringify(E.crateCfg(c)); return out; }, BOX));

  // 5. an old Engine Build page swap converts on load to the same motor on the engine model
  log(await ev(BOX => { const M = window.__map, c = window.__car(BOX); c.swap = { cfg: { engKey: 'hellcat', brandKey: 'kooks', finKey: 'raw', pipeKey: 'catx', powKey: 'factory', lvl: 0, fuelKey: 'p93', tunerKey: 'hpt', intK: { piston: 'stock', rod: 'stock', crank: 'stock', cam: 'stock', head: 'stock' } }, snd: {}, hp: 707, label: 'Hellcat 6.2 SC' };
    M.ELAB.engMigrate(c); const c2 = window.__car(BOX); c2.swap = { cfg: { engKey: 'ls3', brandKey: 'kooks', pipeKey: 'catx', powKey: 'whipple30', lvl: 2, fuelKey: 'e85', intK: { cam: 'big', piston: 'forged' } }, hp: 760, label: 'LS3 6.2' }; M.ELAB.engMigrate(c2);
    return { test: 'old Engine Build swaps convert', hellcat: `${c.engX} ${M.carHp(c)} hp (was 707) swap gone ${!c.swap}`, ls3: `${c2.engX} ${M.carHp(c2)} hp (was 760) eb ${JSON.stringify(c2.eb).slice(0, 160)} fuel ${c2.tune && c2.tune.fuel}` }; }, BOX));

  // 6. the Engine Lab: open every tab on a Scat Pack, the shared draft carries from Parts to Build, Install pays once
  log(await ev(SCAT => { const M = window.__map, E = M.ELAB, K = M.PCAT, c = window.__car(SCAT), out = { test: 'one Engine Lab' }; E.elOpen('build');
    const el = document.getElementById('englab'); out.tabs = [...el.querySelectorAll('[data-elt]')].map(b => b.textContent + (b.disabled ? '(off)' : '')).join(' ');
    for (const [k] of E.EL_TABS) { if (k === 'chassis') continue; E.elGo(k); out[k] = (el.querySelector('.elhd h2') || {}).textContent + ' · rows ' + el.querySelectorAll('button').length; }
    E.elGo('parts'); K.PCL.cat = 'hdr'; K.pcRender(); const s = K.PC.find(x => x.cat === 'hdr' && /Kooks 1-7\/8" long-tube/.test(x.name)) || K.PC.find(x => x.cat === 'hdr' && x.base === 'longtube'); K.PCL.q = s.name; K.PCL.sel = s.id; K.pcRender();
    el.querySelector(`[data-try="${s.id}"]`).click(); const s2 = K.PC.find(x => x.cat === 'rockers' && /1\.8 ratio/.test(x.name)); K.PCL.cat = 'rockers'; K.PCL.q = s2.name; K.PCL.sel = s2.id; K.pcRender(); el.querySelector(`[data-try="${s2.id}"]`).click();
    out.draft = (el.querySelector('.eldraft') || {}).textContent; E.elGo('build'); out.buildDraft = (el.querySelector('.eldraft') || {}).textContent + ' · dyno draft ' + [...el.querySelectorAll('.s')].find(x => /Draft peak hp/.test(x.textContent)).textContent;
    const cash0 = M.S.cash, hp0 = M.carHp(c); el.querySelector('[data-elinst]').click(); out.install = `paid ${cash0 - M.S.cash}, ${hp0} -> ${M.carHp(c)} hp, hdr ${c.eb.hdr}, rockers ${c.eb.rockers}, draft left ${E.elDraft(c).n}`;
    // a tuner from the catalog unlocks the ECU, a flex fuel kit E85
    E.elGo('parts'); const tn = K.PC.find(x => x.cat === 'tuner' && /HP Tuners/.test(x.name)), fk = K.PC.find(x => x.cat === 'fuelk' && /Zeitronix/.test(x.name)); M.S.cash = 1e7; K.pcBuy(c, tn); K.pcBuy(c, fk);
    out.unlocks = `eb ${JSON.stringify(c.eb.sku)} tparts ${c.tparts.join(',')} fuel ${c.tune && c.tune.fuel} ${M.carHp(c)} hp`;
    // drivetrain parts from the old parts counter
    K.PCL.cat = 'pt:transmission'; K.PCL.q = ''; K.PCL.n = 100; K.pcRender(); out.drivetrain = el.querySelectorAll('.pcr').length + ' transmission parts';
    return out; }, SCAT));

  // 7. swap tab: a crate swap and back to the factory motor
  log(await ev(SCAT => { const M = window.__map, E = M.ELAB, c = window.__car(SCAT), out = { test: 'swap tab' }; c.eb = { hdr: 'longtube' }; E.SWL.q = 'hellephant'; E.elOpen('swap'); const el = document.getElementById('englab');
    let bt = el.querySelector('[data-sw="x:hellephant"]'); bt.click(); bt = el.querySelector('[data-sw="x:hellephant"]'); out.ask = bt.textContent; bt.click(); out.cash = M.S.cash; out.sameCar = M.S.car === c;
    out.after = `${c.engX} ${M.carHp(c)} hp, eb ${JSON.stringify(c.eb)}, hd ${(el.querySelector('.elsum') || {}).textContent}`;
    const k = el.querySelector('[data-sw^="k:"]'); if (k) { k.click(); el.querySelector(`[data-sw="${k.dataset.sw}"]`).click(); out.back = `${c.eng} engX ${c.engX || '-'} ${M.carHp(c)} hp`; } return out; }, SCAT));

  // 8. phone width: the header and tabs fit
  if (process.env.SHOTS) {
    await pg.setViewportSize({ width: 390, height: 844 });
    for (const t of ['build', 'parts', 'boost', 'swap']) { await ev(([SCAT, t]) => { const M = window.__map; window.__car(SCAT); M.ELAB.elOpen(t); }, [SCAT, t]); await pg.waitForTimeout(400); await pg.screenshot({ path: `${OUT}/lab-${t}.png` }); }
    await ev(() => { const K = window.__map.PCAT; K.PCL.cat = 'lifters'; K.PCL.sel = K.PC.find(s => s.cat === 'lifters').id; K.pcRender(); window.__map.ELAB.elGo('parts'); }); await pg.waitForTimeout(300); await pg.screenshot({ path: `${OUT}/lab-parts-lifters.png` });
  }
  log({ ERR: errs });
  await b.close();
})();
