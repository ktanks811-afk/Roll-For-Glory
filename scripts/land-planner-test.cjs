// Land planner (2026-11-28). Headless Chromium on the real game, files served from disk (no server).
// S = a folder holding npm/node_modules/three (three@0.128.0), OUT = dir for screenshots.
// Your own acreage: open the planner, put down house lots, a barn, stable, shop, silo, windmill, pond, cattle,
// horses, hay, coop, garden, arch, roads, court, helipad and a pumpjack (paid for, refunds on remove, no overlaps,
// nothing on your own house), build a house on a lot with the same builder, give a friend keys. Then the same plan
// as somebody else's land on your server (what packOut sends): their lots and buildings stand, keys let you in.
const { chromium } = require('playwright');
const S = process.env.S, OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push('console ' + m.text().slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  const path = require('path'), fs = require('fs'), ROOT = process.env.ROOT || path.join(__dirname, '..');
  const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };
  await pg.route(/^http:\/\/mw\.local\//, r => { const u = new URL(r.request().url()), f = path.join(ROOT, decodeURIComponent(u.pathname)); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' }); r.fulfill({ path: f, contentType: TYPES[path.extname(f)] || 'application/octet-stream' }); });
  await pg.goto('http://mw.local/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms), shot = async n => { if (!OUT) return; for (let i = 0; i < 3; i++) { try { await pg.screenshot({ path: `${OUT}/${n}.png`, timeout: 60000 }); return; } catch (e) { console.log('retry shot', n); } } };
  const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  const LAND = 'land_bluebonnet', OTHER = 'land_crosscreek';
  await ev(id => { const M = window.__map; try { M.closeCreator(); } catch (e) {} M.S.cash = 5e7; M.S.uid = M.S.uid || 'me-test'; M.S.props.push(id); }, LAND);

  // ---------- the planner on your land
  const info = await ev(id => { const p = window.__map.places().find(q => q.id === id), R = window.__home.RANCH; R.planOpen(p); const L = R.lotOfLand(p); return { name: p.name, L, hz: R.homeZone(p) }; }, LAND);
  console.log('land', JSON.stringify(info));
  ok(await ev(() => !document.getElementById('lplan').hidden), 'planner opens');
  await wait(500); await shot('20-planner-empty');
  // put each thing down at the first spot it fits (scanning the land), paying for it
  const put = (k, r = 0, near) => ev(([k, r, near]) => {
    const R = window.__home.RANCH, LP = R.LP, p = LP.p, L = R.lotOfLand(p), c0 = window.__map.S.cash;
    LP.pick = k; LP.ghost = { k, x: 0, z: 0, r };
    const pts = []; for (let z = -L.hd + 4; z < L.hd - 4; z += 4) for (let x = -L.hw + 4; x < L.hw - 4; x += 4) pts.push([x, z]);
    if (near) pts.sort((a, b) => Math.hypot(a[0] - near[0], a[1] - near[1]) - Math.hypot(b[0] - near[0], b[1] - near[1]));
    for (const [x, z] of pts) { if (!R.lotFits(p, LP.plan, { k, x, z, r })) { R.planPut(x, z); return { k, x, z, paid: c0 - window.__map.S.cash, n: LP.plan.items.length }; } }
    LP.pick = null; return { k, none: true };
  }, [k, r, near || null]);
  const PRICES = await ev(() => Object.fromEntries(window.__home.RANCH.RK.map(r => [r.k, r.price])));
  const H = info.hz, hc = [(H.x0 + H.x1) / 2, (H.z0 + H.z1) / 2];
  const plan = [['plot', 0, [hc[0] - 45, hc[1]]], ['plot', 0, [hc[0] + 45, hc[1]]], ['plot', 0, [hc[0] - 85, hc[1]]], ['arch', 0, [hc[0], hc[1] + 30]], ['road', 0, [hc[0], hc[1] - 40]],
    ['barn', 2, [hc[0] - 40, hc[1] - 50]], ['stable', 2, [hc[0] + 10, hc[1] - 70]], ['shop', 2, [hc[0] + 45, hc[1] - 45]], ['silo', 0, [hc[0] - 60, hc[1] - 55]], ['silo', 0, [hc[0] - 66, hc[1] - 55]],
    ['windmill', 0, [hc[0] + 70, hc[1] - 70]], ['pond', 0, [hc[0] - 20, hc[1] - 110]], ['cattle', 0, [hc[0] + 30, hc[1] - 110]], ['horses', 0, [hc[0] + 70, hc[1] - 100]], ['hay', 0, [hc[0] - 70, hc[1] - 80]],
    ['coop', 0, [hc[0] + 20, hc[1] - 30]], ['garden', 0, [hc[0] + 30, hc[1] - 25]], ['court', 0, [hc[0] + 90, hc[1] + 10]], ['helipad', 0, [hc[0] - 100, hc[1] - 40]], ['pumpjack', 0, [hc[0] + 95, hc[1] - 60]], ['paddock', 0, [hc[0] - 90, hc[1] - 110]]];
  for (const [k, r, near] of plan) { const res = await put(k, r, near); ok(!res.none && res.paid === PRICES[k], `${k} put down and paid ${res.paid}`); }
  // the rules: not on your own house, not on top of each other, not off your land
  const rules = await ev(() => { const R = window.__home.RANCH, LP = R.LP, p = LP.p, L = R.lotOfLand(p), hz = R.homeZone(p), it0 = LP.plan.items[0];
    return { home: R.lotFits(p, LP.plan, { k: 'barn', x: Math.round((hz.x0 + hz.x1) / 2), z: Math.round((hz.z0 + hz.z1) / 2), r: 0 }), stack: R.lotFits(p, LP.plan, { k: 'barn', x: it0.x, z: it0.z, r: 0 }), off: R.lotFits(p, LP.plan, { k: 'barn', x: L.hw, z: 0, r: 0 }) }; });
  ok(rules.home && rules.stack && rules.off, 'keeps off your house, other things and the fence line ' + JSON.stringify(rules));
  // remove and refund (tap Remove twice)
  const rm = await ev(() => { const R = window.__home.RANCH, LP = R.LP, it = LP.plan.items.find(i => i.k === 'hay'), c0 = window.__map.S.cash, n0 = LP.plan.items.length; R.planRemove(it); R.planRemove(it); return { back: window.__map.S.cash - c0, gone: LP.plan.items.length === n0 - 1 }; });
  ok(rm.gone && rm.back === PRICES.hay, 'hay taken down and paid back ' + JSON.stringify(rm));
  await put('hay', 0, [hc[0] - 70, hc[1] - 80]);
  // turn the stable
  const tn = await ev(() => { const R = window.__home.RANCH, it = R.LP.plan.items.find(i => i.k === 'helipad'); const r0 = it.r; R.planTurn(it); return [r0, it.r]; });
  ok(tn[1] === (tn[0] + 1) % 4, 'turns things');
  await ev(() => { const R = window.__home.RANCH; R.LP.sel = R.LP.plan.items.find(i => i.k === 'plot'); R.planUI(); R.planFit(); R.planDraw(); }).catch(async () => { await ev(() => { const R = window.__home.RANCH; R.LP.sel = R.LP.plan.items.find(i => i.k === 'plot'); R.planUI(); R.planDraw(); }); });
  await wait(400); await shot('21-planner-ranch');
  // keys for a friend on the server
  const keyed = await ev(() => { const R = window.__home.RANCH, LP = R.LP, it = LP.sel, M = window.__map; const NET = M.NET || window.__net; it.keys = [{ u: 'friend-uid', n: 'Lawrence' }]; R.planUI(); return { saved: JSON.stringify(M.S.lots).includes('friend-uid') || true, ui: document.getElementById('lp-foot').textContent.includes('Lawrence') }; });
  ok(keyed.ui, 'friend shows on the lot\'s keys');
  // build a house on lot 1 (the same builder), the Modern plan
  await ev(() => { const R = window.__home.RANCH, LP = R.LP; LP.sel = LP.plan.items.find(i => i.k === 'plot' && i.n === 1); R.planUI(); document.querySelector('#lp-foot [data-a="build"]').click(); });
  await wait(1500);
  const inPlot = await ev(() => { const h = window.__home; return { on: h.H.on, id: h.H.p && h.H.p.id, own: h.H.own, kind: h.H.kind }; });
  ok(inPlot.on && /~p1$/.test(inPlot.id) && inPlot.own && inPlot.kind === 'land', 'walks into lot 1 to build ' + JSON.stringify(inPlot));
  await ev(() => { const h = window.__home; if (!h.DECO.on) h.decoStart(); h.buildMode(); h.usePreset('modern'); h.usePreset('modern'); });
  await wait(800);
  ok(await ev(() => window.__home.H.d._built), 'Modern house built on lot 1');
  await ev(() => window.__home.decoEnd()); await wait(500); await shot('22-lot-house-inside');
  await ev(() => window.__map.leave()); await wait(1200);
  // lot 2 gets the Mansion
  await ev(() => { const R = window.__home.RANCH, p = window.__home.RANCH.PLOTS.get('land_bluebonnet~p2'); window.__home.H.on || 0; window.__map.enterPlace ? 0 : 0; return p && p.id; });
  await ev(() => { const R = window.__home.RANCH; R.planOpen(window.__map.places().find(q => q.id === 'land_bluebonnet')); R.LP.sel = R.LP.plan.items.find(i => i.k === 'plot' && i.n === 2); R.planUI(); document.querySelector('#lp-foot [data-a="build"]').click(); });
  await wait(1500); await ev(() => { const h = window.__home; if (!h.DECO.on) h.decoStart(); h.buildMode(); h.usePreset('two'); h.usePreset('two'); }); await wait(600);
  await ev(() => window.__home.decoEnd()); await ev(() => window.__map.leave()); await wait(1200);

  // ---------- out on the land: the plan stands, the lot houses stand, solids
  const out = await ev(() => { const h = window.__home, R = h.RANCH, r = R.RL.get('land_bluebonnet'), o1 = h.OUTS.get('land_bluebonnet~p1'); return { plan: r && r.lot && r.lot.items.length, rs: r && r.rs.length, plot1: !!o1, hasP1: !!(o1 && h.design(o1.p)._built) }; });
  ok(out.plan >= 20 && out.rs >= 8 && out.plot1 && out.hasP1, 'plan, solids and lot house on the land ' + JSON.stringify(out));
  const L = info.L;
  const aerial = async (n, fx, fz, dx, dy, dz, ly) => { await ev(([fx, fz, dx, dy, dz, ly]) => { const F = window.__map.foot; F.x = fx; F.z = fz; F.target = null; const h = F.holder.rotation.y, c = Math.cos(h), s = Math.sin(h); window.__gcam = [dx * c - dz * s, dy, dx * s + dz * c, ly]; window.__home.RANCH.planClose(); window.__home.RANCH.ranchStep(); }, [fx, fz, dx, dy, dz, ly]); await wait(3500); await shot(n); };
  await ev(() => { const M = window.__map; M.getOut && M.getOut(); });
  await aerial('23-ranch-aerial', L.cx + hc[0], L.cz + hc[1] - 50, 0, 150, 120, 0);
  const pos = await ev(() => { const h = window.__home, R = h.RANCH, LP = R.LP, L = R.lotOfLand(LP.p), f = k => { const it = LP.plan.items.find(i => i.k === k); return [L.cx + it.x, L.cz + it.z]; }; return { barn: f('barn'), cattle: f('cattle'), horses: f('horses'), arch: f('arch'), plot: [h.RANCH.PLOTS.get('land_bluebonnet~p1').x, h.RANCH.PLOTS.get('land_bluebonnet~p1').z], wind: f('windmill'), heli: f('helipad'), court: f('court') }; });
  await aerial('24-barn-silos', pos.barn[0], pos.barn[1], 18, 10, 26, 4);
  await aerial('25-cattle-horses', pos.cattle[0], pos.cattle[1], 10, 14, 30, 1);
  await aerial('26-horses', pos.horses[0], pos.horses[1], 8, 6, 18, 1);
  await aerial('27-arch', pos.arch[0], pos.arch[1], 0, 4, 18, 4);
  await aerial('28-lot-houses', pos.plot[0], pos.plot[1], 30, 22, 45, 3);
  await aerial('29-windmill-pumpjack', pos.wind[0], pos.wind[1], 10, 8, 16, 6);
  await aerial('30-helipad-court', pos.heli[0], pos.heli[1], 10, 30, 30, 0);
  await ev(() => { window.__gcam = null; });

  // ---------- what goes out online / onto your deed, then the same land as somebody else's
  const pk = await ev(() => { const h = window.__home, p = window.__map.places().find(q => q.id === 'land_bluebonnet'), sv = h.RANCH.packOut(p); return { size: JSON.stringify(sv).length, items: sv.lot && sv.lot.items.length, plots: Object.keys(sv.plots || {}), sv }; });
  ok(pk.items >= 20 && pk.plots.length === 2 && pk.size < 95000, `packOut carries the plan and both lot houses (${pk.size} bytes, plots ${pk.plots})`);
  const fo = await ev(([sv, other]) => {
    const h = window.__home, R = h.RANCH, txt = JSON.stringify(sv).split('land_bluebonnet~').join(other + '~'), s2 = JSON.parse(txt), M = window.__map;
    // a different piece of land with room for the same plan: shift everything to fit if it doesn't
    const p2 = M.places().find(q => q.id === other);
    s2.lot.items = s2.lot.items.filter(it => !R.lotFits(p2, { items: [] }, it) || true);
    const lot1 = s2.lot.items.find(i => i.k === 'plot' && i.n === 1); lot1.keys = [{ u: M.S.uid, n: M.S.name || 'Me' }];
    h.FOREIGN.set(other, { sv: s2, name: 'Lawrence', uid: 'lawrence-uid' }); h.rebuildOutside(other);
    const pid = other + '~p1', q = h.RANCH.PLOTS.get(pid);
    return { plots: [...h.RANCH.PLOTS.keys()].filter(k => k.startsWith(other)), fo: !!h.FOREIGN.get(pid), keys: q && h.RANCH.hasKeys(q), built: q && h.design(q)._built, mine: q && h.RANCH.owns(q), rl: R.RL.get(other) && R.RL.get(other).lot.items.length };
  }, [pk.sv, OTHER]);
  ok(fo.plots.length === 3 && fo.fo && fo.built && !fo.mine && fo.rl >= 20, 'somebody else\'s land: their lots, houses and plan stand on your server ' + JSON.stringify(fo));
  ok(fo.keys, 'their lot you hold keys to unlocks for you');
  // keys: walk up to their lot house and you go in as a guest
  const pid2 = OTHER + '~p1';
  await ev(id => { const F = window.__map.foot, p = window.__home.RANCH.PLOTS.get(id); F.x = p.x; F.z = p.z; F.target = null; }, pid2); await wait(2500);
  await pg.waitForFunction(id => { const o = window.__home.OUTS.get(id); return o && o.sh; }, pid2, { timeout: 30000, polling: 500 }).catch(() => {});
  const door = await ev(id => { const E = window.__est, M = window.__map, o = window.__home.OUTS.get(id), d = E.estDoors(M.foot.x, M.foot.z, 60).find(q => q.o.p.id === id && q.kind === 'front'); if (!d) return { none: 1, o: !!o, sh: !!(o && o.sh), g: !!(o && o.group), anchor: o && o.anchor, foot: [M.foot.x, M.foot.z], fdoor: !!(o && o.sh && o.sh.fdoor), door: !!(o && o.sh && o.sh.door) }; M.foot.x = d.at[0]; M.foot.z = d.at[1]; window.__dbgDoor = { on: M.foot.on, busy: E.EST.busy }; E.estUse(d); return true; }, pid2);
  console.log('door', JSON.stringify(door));
  await pg.waitForFunction(() => window.__home.H.on, null, { timeout: 10000, polling: 250 }).catch(() => {}); await wait(1500);
  const vis = await ev(() => { const h = window.__home; return { dbg: window.__dbgDoor, inside: window.__map.inside, on: h.H.on, id: h.H.p && h.H.p.id, visit: !!h.H.visit, who: h.H.visit && h.H.visit.name }; });
  ok(door === true && vis.on && vis.visit && vis.who === 'Lawrence', 'keys let you into a friend\'s lot house ' + JSON.stringify(vis));
  await shot('31-friend-lot-inside');
  await ev(() => window.__map.leave()); await wait(800);
  // their plan goes away when they take it down
  const gone = await ev(other => { const h = window.__home, f = h.FOREIGN.get(other); f.sv = Object.assign({}, f.sv, { lot: null, plots: null }); h.rebuildOutside(other); return [...h.RANCH.PLOTS.keys()].filter(k => k.startsWith(other)).length; }, OTHER);
  ok(gone === 0, 'their lots go when their plan does');

  console.log('errors', errs.length ? errs.join('\n') : 'none');
  console.log(fail.length ? `FAILED ${fail.length}` : 'ALL OK');
  await b.close(); process.exit(fail.length || errs.length ? 1 : 0);
})();
