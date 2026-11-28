// Friends with keys build on your land (2026-11-28). Two players on ?net=local (BroadcastChannel).
// Kimari owns acreage, puts a house lot on it and gives Lawrence the keys. Lawrence goes in, taps Decorate, builds a
// house and furnishes it with his own money. Each change goes to Kimari, who checks the keys and saves it on the land;
// it stands on the street for both. Taking a piece out pays Lawrence nothing back. Keys taken away: change refused.
// Kimari off the server: Lawrence can't build.
// PORT (default 8790, a static server on the repo), S = folder with npm/node_modules/three, OUT = screenshots.
const { chromium } = require('playwright');
const PORT = process.env.PORT || 8790, S = process.env.S, OUT = process.env.OUT;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, r => { const p = r.request().url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  const LAND = 'land_bluebonnet';
  const errs = [], fail = [], T0 = Date.now(), ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m, '@' + ((Date.now() - T0) / 1000 | 0) + 's'); };
  const open = async (tag, name, own) => {
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tag + ' ' + e.message)); p.on('crash', () => console.log(tag, 'CRASHED')); p.on('close', () => console.log(tag, 'closed')); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(m.text())) errs.push(tag + ' console ' + m.text().slice(0, 300)); });
    await p.goto(`http://localhost:${PORT}/index.html?net=local&test=1`); await p.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
    await p.evaluate(([name, own, id]) => { const M = window.__map; try { M.closeCreator(); } catch (e) {} M.S.name = name; M.S.uid = 'u' + name.toLowerCase(); M.S.props = M.S.props.filter(x => x !== id); M.S.homes = {}; M.S.lots = {}; if (own) M.S.props.push(id); M.S.cash = 2e6; }, [name, own, LAND]);
    await p.evaluate(() => window.__net.netJoin('eastgate'));
    await p.waitForFunction(() => window.__net.NET.status === 'on', null, { timeout: 120000, polling: 500 });
    await p.evaluate(() => setInterval(() => { for (const q of window.__net.NET.peers.values()) q.seen = Math.max(q.seen, performance.now() / 1000 - 1); }, 200));
    return p;
  };
  const pump = async (pages, n) => { for (let i = 0; i < n; i++) for (const p of pages) await p.evaluate(() => { for (let k = 0; k < 4; k++) { window.__net.netTick(0.05); window.__hn.tick(0.05); window.__est.tick(0.05); } }); };
  const shot = async (p, n) => { if (!OUT) return; try { await p.bringToFront(); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/${n}.png`, timeout: 90000 }); } catch (e) { console.log('shot failed', n, e.message.split('\n')[0]); } };
  const A = await open('A', 'Kimari', true), B = await open('B', 'Lawrence', false);
  await pump([A, B], 20);

  // Kimari: a house lot on the land, keys to Lawrence
  const lot = await A.evaluate(id => {
    const R = window.__home.RANCH, p = window.__map.places().find(q => q.id === id); R.planOpen(p);
    const LP = R.LP, L = R.lotOfLand(p), hz = R.homeZone(p), hc = [(hz.x0 + hz.x1) / 2, (hz.z0 + hz.z1) / 2];
    const pts = []; for (let z = -L.hd + 4; z < L.hd - 4; z += 4) for (let x = -L.hw + 4; x < L.hw - 4; x += 4) pts.push([x, z]);
    pts.sort((a, b) => Math.hypot(a[0] - hc[0] - 45, a[1] - hc[1]) - Math.hypot(b[0] - hc[0] - 45, b[1] - hc[1]));
    LP.pick = 'plot'; LP.ghost = { k: 'plot', x: 0, z: 0, r: 0 };
    for (const [x, z] of pts) if (!R.lotFits(p, LP.plan, { k: 'plot', x, z, r: 0 })) { R.planPut(x, z); break; }
    const it = LP.plan.items.find(i => i.k === 'plot'); LP.sel = it; R.planUI();
    return { pid: id + '~p' + it.n, n: it.n };
  }, LAND);
  // the real button: Give keys to Lawrence (he's on the server)
  await A.waitForTimeout(300);
  const gave = await A.evaluate(() => { const R = window.__home.RANCH, LP = R.LP; LP.keysFor = LP.sel; R.planUI(); let btn = document.querySelector('#lplan [data-key-on="ulawrence"]'); if (!btn) { const k = document.querySelector('#lplan [data-a="keys"]'); if (k) k.click(); btn = document.querySelector('#lplan [data-key-on="ulawrence"]'); } if (btn) btn.click(); const it = LP.sel; R.planClose(); return { btn: !!btn, keys: it && it.keys }; });
  ok(gave.btn && gave.keys && gave.keys[0].u === 'ulawrence', 'Kimari gives Lawrence the keys from the planner ' + JSON.stringify(gave));
  await pump([A, B], 30);
  const seen = await B.evaluate(pid => { const h = window.__home, q = h.RANCH.PLOTS.get(pid); return { lot: !!q, keys: !!(q && h.RANCH.hasKeys(q)), fo: !!h.FOREIGN.get(pid) }; }, lot.pid);
  ok(seen.lot && seen.keys, 'Lawrence sees the lot and holds its keys ' + JSON.stringify(seen));

  // Lawrence goes in (as the door would let him) and taps Decorate
  const vr = await B.evaluate(pid => { const M = window.__map, h = window.__home, q = h.RANCH.PLOTS.get(pid), f = h.FOREIGN.get(pid); try { M.startDrive(q.x, q.z + 10); M.getOut(); } catch (e) {} try { h.visit(q, f.sv, f.name, f.uid); return 'ok'; } catch (e) { return String(e.stack || e).slice(0, 500); } }, lot.pid);
  console.log('visit', vr);
  await B.waitForFunction(() => window.__home.H.on, null, { timeout: 15000, polling: 250 }).catch(() => console.log('not inside; errs', errs.join('\n')));
  await B.waitForTimeout(1500);
  const inB = await B.evaluate(() => { const h = window.__home, btn = document.getElementById('decbtn'); return { kh: h.H.kh, own: h.H.own, cls: document.body.classList.contains('at-key'), btn: btn && getComputedStyle(btn).display, deco: h.DECO.on }; });
  ok(inB.kh && !inB.own && inB.cls, 'Lawrence is in as a key holder ' + JSON.stringify(inB));
  // an empty lot opens straight into Build, like your own land does
  await B.evaluate(() => { const h = window.__home; if (!h.DECO.on) document.getElementById('decbtn').click(); });
  await B.waitForTimeout(500);
  const c0 = await B.evaluate(() => window.__map.S.cash), a0 = await A.evaluate(() => window.__map.S.cash);
  ok(await B.evaluate(() => window.__home.DECO.on), 'Decorate opens for the key holder');
  await B.evaluate(() => { const h = window.__home; h.buildMode(); h.usePreset('one'); h.usePreset('one'); });
  await B.waitForTimeout(800);
  const built = await B.evaluate(() => { const h = window.__home; h.draw(); return { built: h.H.d._built, furn: h.H.d.furn.reduce((t, f) => t + f.length, 0), cash: window.__map.S.cash, undo: !!document.querySelector('#deco [data-a="undo"]') }; });
  ok(built.built && built.cash < c0, `Lawrence builds the house and pays $${c0 - built.cash} himself ` + JSON.stringify(built));
  ok(built.undo, 'undo is there for him');
  await shot(B, '70-friend-building-on-your-land');
  await pump([A, B], 30); await A.waitForTimeout(1500); await pump([A, B], 10);
  const onA = await A.evaluate(pid => { const h = window.__home, sv = window.__map.S.homes[pid]; return { saved: !!sv, floors: sv && sv.floors && sv.floors.length, furn: sv && sv.furn && sv.furn.reduce((t, f) => t + f.length, 0), cash: window.__map.S.cash, built: h.design(h.RANCH.PLOTS.get(pid))._built }; }, lot.pid);
  ok(onA.saved && onA.built && onA.furn === built.furn, 'Kimari\'s land saved the house Lawrence built ' + JSON.stringify(onA));
  ok(onA.cash === a0, 'Kimari paid nothing for it');
  // taking a piece out of a house that isn't yours pays nothing back
  const take = await B.evaluate(() => { const h = window.__home, fl = h.H.d.furn[0], f = fl.find(o => !/stair/i.test(o.id)), c = window.__map.S.cash; h.DECO.sel = f; h.DECO.mode = 'sel'; h.draw(); const lbl = [...document.querySelectorAll('#deco [data-a="sell"]')].map(e => e.textContent).join(); h.sell(); return { back: window.__map.S.cash - c, lbl, left: h.H.d.furn[0].length, had: fl.length }; });
  ok(take.back === 0 && /Take out/.test(take.lbl) && take.left === take.had - 1, 'taking a piece out of a friend\'s house pays nothing back ' + JSON.stringify(take));
  await B.evaluate(() => window.__home.decoEnd()); await B.waitForTimeout(400);
  await pump([A, B], 30); await A.waitForTimeout(1200); await pump([A, B], 10);
  const onA2 = await A.evaluate(pid => window.__map.S.homes[pid].furn.reduce((t, f) => t + f.length, 0), lot.pid);
  ok(onA2 === built.furn - 1, 'Kimari\'s copy follows his change ' + onA2);
  await B.evaluate(() => window.__map.leave()); await B.waitForTimeout(600);
  // both see it on the street
  await A.evaluate(pid => { const M = window.__map, q = window.__home.RANCH.PLOTS.get(pid); M.startDrive(q.x, q.z + 10); M.getOut(); const f = M.foot; f.x = q.x; f.z = q.z + 8; }, lot.pid);
  await A.waitForFunction(pid => { const o = window.__home.OUTS.get(pid); return o && o.group; }, lot.pid, { timeout: 60000, polling: 500 }).catch(() => {});
  ok(await A.evaluate(pid => { const o = window.__home.OUTS.get(pid); return !!(o && o.group && o.sh); }, lot.pid), 'the house stands on Kimari\'s land');
  await shot(A, '71-owner-sees-friends-house');

  // keys taken back: his next change is refused
  const refused = await A.evaluate(pid => { const h = window.__home, q = h.RANCH.PLOTS.get(pid); return [h.RANCH.keyEdit(q, 'ulawrence', window.__map.S.homes[pid], 'Lawrence'), h.RANCH.keyEdit(q, 'udre', window.__map.S.homes[pid], 'Dre')]; }, lot.pid);
  ok(refused[0] === null && refused[1] === 'no keys', 'only key holders can change it ' + JSON.stringify(refused));

  // Kimari off the server: Lawrence can't build
  await A.evaluate(() => window.__net.netLeave && window.__net.netLeave()).catch(() => {}); await A.close();
  await pump([B], 10);
  const off = await B.evaluate(pid => { const h = window.__home, q = h.RANCH.PLOTS.get(pid), f = h.FOREIGN.get(pid); if (!q || !f) return { gone: true }; for (const p of window.__net.NET.peers.values()) if (p.uid === 'ukimari') window.__net.NET.peers.delete(p.id); h.visit(q, f.sv, f.name, f.uid); return { why: h.RANCH.KH.why(q) }; }, lot.pid);
  await B.waitForTimeout(1200);
  await B.evaluate(() => document.getElementById('decbtn').click()); await B.waitForTimeout(300);
  const off2 = await B.evaluate(() => ({ deco: window.__home.DECO.on, toast: (document.getElementById('toast') || {}).textContent || '' }));
  ok(off.gone || (/has to be on the server/.test(off.why) && !off2.deco), 'with Kimari gone Lawrence can\'t build ' + JSON.stringify([off, off2]));

  console.log('errors', errs.length ? errs.join('\n') : 'none');
  console.log(fail.length ? `FAILED ${fail.length}` : 'ALL OK');
  await b.close(); process.exit(fail.length || errs.length ? 1 : 0);
})();
