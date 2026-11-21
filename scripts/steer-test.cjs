// Steering feel + dynamic joystick test (2026-11-21). Headless Chromium (Playwright), no server needed: the repo files
// are served to the page by Playwright's router. Set S to a folder that holds npm/node_modules/three (three@0.128.0).
// OUT= folder for screenshots. Checks:
//   - buttons: input ramps in (slower at speed) and springs back; sliding a held thumb from ◀ to ▶ switches sides
//   - Settings → Steering switches to the dynamic joystick; it appears where the thumb lands and steers proportionally
//   - the on-screen wheel follows the real front wheel angle; push/slide cues come on when the tires pass their limit
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..');
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),order(){return this},limit(){return this},then(f){return f({data:[]})}}),rpc:async()=>({data:null})});', contentType: 'application/javascript' }));
  await pg.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => {
    const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' });
  });
  await pg.goto('http://game.test/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 240000 });
  const ev = (f, a) => pg.evaluate(f, a), R = {};
  const shot = async n => { await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(OUT, n + '.png') }); };
  await ev(() => { const M = window.__map; M.S.cash = 1e7; try { M.closeCreator(); } catch (e) {} });
  await ev(() => { const M = window.__map; M.S.car = M.newCar('dodge_charger_srt_hellcat_widebody_2020'); M.S.car.fuel = 100; M.foot.on = false; M.startDrive(7056.5, 1300); });
  await pg.waitForTimeout(2500);
  await ev(() => { const M = window.__map; if (M.foot.on) M.getIn(); });
  await pg.waitForTimeout(1500);
  // simulate a press with real touch events on the buttons
  const bl = await pg.$('#b-left'), br = await pg.$('#b-right');
  const bbL = await bl.boundingBox(), bbR = await br.boundingBox();
  R.layout = { left: bbL, right: bbR };
  await pg.mouse.move(bbL.x + bbL.width / 2, bbL.y + bbL.height / 2); await pg.mouse.down();
  await pg.waitForTimeout(80); R.pressL = await ev(() => ({ l: !!window.__steer && document.getElementById('b-left').classList.contains('hold'), btn: +window.__steer.SF.btn.toFixed(2) }));
  await pg.waitForTimeout(500); R.heldL = await ev(() => ({ btn: +window.__steer.SF.btn.toFixed(2), steer: +window.__map.drvS().steer.toFixed(2) }));
  await shot('01-buttons-left');
  await pg.mouse.move(bbR.x + bbR.width / 2, bbR.y + bbR.height / 2, { steps: 4 });
  await pg.waitForTimeout(500); R.slidR = await ev(() => ({ r: document.getElementById('b-right').classList.contains('hold'), l: document.getElementById('b-left').classList.contains('hold'), btn: +window.__steer.SF.btn.toFixed(2) }));
  await pg.mouse.up(); await pg.waitForTimeout(400); R.released = await ev(() => ({ btn: +window.__steer.SF.btn.toFixed(3), r: document.getElementById('b-right').classList.contains('hold') }));
  // ramp: time for a held button to reach 0.9 at 5 mph and at 70 mph, and to spring back under 0.1 (60 fps)
  R.ramp = await ev(() => { const T = window.__steer, D = window.__map.drvS(), H = window.__map.hold, res = {}, v0 = D.v;
    if (!H) return 'no hold'; for (const mph of [5, 70]) { D.v = mph / 2.237; T.SF.btn = 0; H.left = true; let n = 0; while (T.SF.btn < 0.9 && n < 600) { T.SF.lastIn = performance.now() - 1000 / 60; T.sfTouch(); n++; }
      H.left = false; let m = 0; while (T.SF.btn > 0.1 && m < 600) { T.SF.lastIn = performance.now() - 1000 / 60; T.sfTouch(); m++; } res[mph + 'mph'] = { in_s: +(n / 60).toFixed(2), back_s: +(m / 60).toFixed(2) }; }
    D.v = v0; return res; });
  // ---- Settings → Steering → Dynamic joystick (through the phone UI)
  await ev(() => { window.__steer.sfSet('steer', 'dynamic'); });
  await pg.waitForTimeout(300);
  R.dyn = await ev(() => ({ body: document.body.classList.contains('dynsteer'), zone: getComputedStyle(document.getElementById('dst')).display, btnsVis: getComputedStyle(document.querySelector('.pad .steer')).visibility }));
  await shot('02-dynamic-idle');
  // thumb lands mid-left, drags 40 px left
  const x0 = 230, y0 = 260;
  await pg.mouse.move(x0, y0); await pg.mouse.down(); await pg.waitForTimeout(150);
  R.dynDown = await ev(() => { const b = document.getElementById('dst-base').getBoundingClientRect(); return { on: document.getElementById('dst').classList.contains('on'), cx: Math.round(b.left + b.width / 2), cy: Math.round(b.top + b.height / 2) }; });
  await pg.mouse.move(x0 - 30, y0, { steps: 5 }); await pg.waitForTimeout(600);
  R.dynHalf = await ev(() => ({ raw: +window.__steer.SF.k.raw.toFixed(2), touch: +window.__steer.sfTouch().toFixed(2), steer: +window.__map.drvS().steer.toFixed(2), delta: +(window.__map.TIRE.delta * 57.3).toFixed(1) }));
  await pg.mouse.move(x0 - 140, y0, { steps: 8 }); await pg.waitForTimeout(600);
  R.dynFull = await ev(() => ({ raw: +window.__steer.SF.k.raw.toFixed(2), touch: +window.__steer.sfTouch().toFixed(2), steer: +window.__map.drvS().steer.toFixed(2), wheel: document.querySelector('#dst-base .sfw-rot').getAttribute('transform') }));
  await shot('03-dynamic-full-left');
  await pg.mouse.move(x0 - 100, y0, { steps: 4 }); await pg.waitForTimeout(300);
  R.dynBack = await ev(() => ({ raw: +window.__steer.SF.k.raw.toFixed(2) }));
  await pg.mouse.up(); await pg.waitForTimeout(500);
  R.dynUp = await ev(() => ({ raw: window.__steer.SF.k.raw, on: document.getElementById('dst').classList.contains('on'), steer: +window.__map.drvS().steer.toFixed(3) }));
  // ---- the tire cues from the real physics: full lock at 50 mph (fronts push), then power oversteer with TC off (rear slides)
  R.cue = await ev(() => { const M = window.__map, d = M.drvS(), T = M.TIRE, h = 1 / 240, P0 = Object.assign({}, M.carPerf()), out = {};
    const reset = u0 => { Object.assign(d, { yaw: 0, v: 0, steer: 0 }); M.physReset(); T.vx = 0; T.vz = -u0; d.v = u0; };
    const ratios = () => { const f = T.fb; return f ? [Math.abs(T.delta - f[0]) / f[2], Math.abs(f[1]) / f[3]] : [0, 0]; };
    const run = (P, sec, ctl) => { let t = 0, mF = 0, mR = 0; while (t < sec) { const c = ctl(t); d.steer += (c.steer - d.steer) * (1 - Math.exp(-h * 7)); M.physStep(Object.assign({ brake: 0, hb: 0 }, c), P, h); t += h; const [a, b] = ratios(); mF = Math.max(mF, a); mR = Math.max(mR, b); } return { front: +mF.toFixed(2), rear: +mR.toFixed(2) }; };
    reset(22); out.fullLock50 = run(P0, 2, () => ({ gas: 0.4, steer: -1 }));
    reset(22); out.gentle50 = run(P0, 2, () => ({ gas: 0.3, steer: -0.15 }));
    reset(14); out.powerOver = run(Object.assign({}, P0, { tc: false }), 3, t => ({ gas: t < 1 ? 0.3 : 1, steer: 0.6 }));
    reset(0); return out; });
  // what the cues look like (state forced for the picture; the numbers above are the real physics)
  await ev(() => { window.__steer.SF.force = 2; }); await pg.mouse.move(150, 300); await pg.mouse.down(); await pg.mouse.move(110, 302, { steps: 4 }); await pg.waitForTimeout(400);
  await pg.screenshot({ path: path.join(OUT, '04-dynamic-sliding.png') }); await pg.mouse.up();
  await ev(() => { window.__steer.sfSet('steer', 'buttons'); window.__steer.SF.force = 1; }); await pg.waitForTimeout(500); await pg.screenshot({ path: path.join(OUT, '04b-buttons-pushing.png') }); await ev(() => { window.__steer.SF.force = null; });
  // portrait phone
  await ev(() => window.__steer.sfSet('steer', 'buttons'));
  await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(800); await shot('05-portrait-buttons');
  await ev(() => window.__steer.sfSet('steer', 'dynamic')); await pg.waitForTimeout(400); await shot('06-portrait-dynamic-idle');
  await pg.mouse.move(110, 640); await pg.mouse.down(); await pg.mouse.move(160, 640, { steps: 6 }); await pg.waitForTimeout(500); await shot('07-portrait-dynamic-right');
  R.portrait = await ev(() => ({ raw: +window.__steer.SF.k.raw.toFixed(2), touch: +window.__steer.sfTouch().toFixed(2) })); await pg.mouse.up();
  // the phone's Settings rows
  await pg.setViewportSize({ width: 844, height: 390 }); await pg.waitForTimeout(500);
  await pg.click('#phonebtn'); await pg.waitForTimeout(400);
  await ev(() => { const a = document.querySelector('.app[data-id="settings"]'); if (a) a.click(); });
  await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(OUT, '08-settings.png') });
  R.settingsRows = await ev(() => [...document.querySelectorAll('[data-sf]')].map(b => b.textContent));
  await ev(() => document.querySelector('[data-sf="steer"]').click()); await pg.waitForTimeout(200);
  R.afterTap = await ev(() => ({ ctl: window.__map.S.ctl, row: document.querySelector('[data-sf="steer"]').textContent }));
  R.errs = errs;
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})();
