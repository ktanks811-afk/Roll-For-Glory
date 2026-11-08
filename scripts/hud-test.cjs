// Phase 5B driving HUD tests (headless Chromium, Playwright). Serve the repo on http://localhost:8765, S = folder with npm/node_modules/three.
// Checks which side gauges show for which car, that they read the simulation, the diagnostics panel, the settings toggles and the layout.
const { chromium } = require('playwright'); const S = process.env.S;
const log = o => console.log(JSON.stringify(o));
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 500)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({})', contentType: 'application/javascript' }));
  await pg.goto('http://localhost:8765/index.html?test=1'); await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 180000 });
  const ev = (f, a) => pg.evaluate(f, a);
  const drive = async (id, nos) => { await ev(([id, nos]) => { const M = window.__map; try { M.closeCreator(); } catch (e) {} const c = M.newCar(id); c.fuel = 100; if (nos) { c.nx = { kit: 'wet', s1: 150, s2: 0, ft: 0, add: { win: true }, set: { ret1: 3 } }; c.nosLb = 8; c.nosT = 303; c.nosAt = Date.now(); } M.S.hud = {}; M.S.car = c; M.foot.on = false; M.startDrive(7056.5, 1300); }, [id, nos]);
    await pg.waitForFunction(() => document.body.classList.contains('incar') && document.body.classList.contains('hx-on'), null, { timeout: 90000 }); await pg.waitForFunction(() => window.__map.TIRE.vd, null, { timeout: 60000 }).catch(() => {}); await pg.waitForTimeout(3000); };
  const read = () => ev(() => { const q = k => document.querySelector(`#hudx [data-h="${k}"]`), vis = k => !q(k).hidden;
    return { temp: vis('temp') ? q('temp').textContent.replace(/\s+/g, ' ').trim() : null, boost: vis('boost') ? q('boost').textContent.replace(/\s+/g, ' ').trim() : null, nos: vis('nos') ? q('nos').textContent.replace(/\s+/g, ' ').trim() : null, slip: vis('slip') ? q('slip').textContent.replace(/\s+/g, ' ').trim() : null }; });
  await drive('dodge_charger_scat_pack_2015', false); log(Object.assign({ test: 'Scat Pack (NA, no nitrous): no boost or nitrous gauge' }, await read()));
  await drive('dodge_charger_srt_hellcat_widebody_2020', true); log(Object.assign({ test: 'Hellcat + wet 150: all four' }, await read()));
  // floor it: boost rises off vacuum, the diagnostics read the physics
  await ev(() => window.__map.HUDX.hudSet('diag', true)); await pg.keyboard.down('ArrowUp'); await pg.waitForTimeout(2500);
  log(Object.assign({ test: 'Hellcat floored 2.5 s' }, await read(), { diag: await ev(() => document.getElementById('hdiag').textContent.replace(/\s+/g, ' ').slice(0, 400)), diagShown: await ev(() => getComputedStyle(document.getElementById('hdiag')).display) }));
  await pg.keyboard.up('ArrowUp');
  // settings toggles hide each gauge, and the whole panel
  log(await ev(async () => { const M = window.__map, H = M.HUDX, out = { test: 'toggles' }; H.hudSet('boost', false); H.hudSet('diag', false); await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 4; i++) H.hudxFrame(); out.boostHidden = document.querySelector('#hudx [data-h="boost"]').hidden; out.diag = getComputedStyle(document.getElementById('hdiag')).display; H.hudSet('side', false); H.hudxFrame(); out.side = getComputedStyle(document.getElementById('hudx')).display; M.S.hud = {}; return out; }));
  // nothing covers the Car button or the steering on this phone
  log(await ev(() => { const r = s => document.querySelector(s).getBoundingClientRect(), hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom, out = { test: 'layout 844x390' };
    const hx = r('#hudx'), car = r('#carbtn'), nos = r('#nosbtn'), lc = r('#lcbtn'), st = r('.pad .steer'); out.hudx = [hx.top, hx.bottom].map(Math.round).join('-'); out['NOS over Car'] = hit(nos, car); out['LAUNCH over NOS'] = hit(lc, nos); out['gauges over steering'] = hit(hx, st); return out; }));
  log({ ERR: errs });
  await b.close();
})();
