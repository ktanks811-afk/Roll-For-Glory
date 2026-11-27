// Character realism shots (2026-11-27). Opens the creator studio and renders a set of looks at face/body/side.
// S = folder with npm/node_modules/three (three@0.128.0), OUT = shot folder, TAG = filename prefix, ONLY = look names, VIEWS = face,body,side,...
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..'), TAG = process.env.TAG || '';
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
const LOOKS = {
  man: { body: 'm', skin: '#8d5524', hairStyle: 'waves', hair: '#111111', eyes: '#3b2414', facialHair: 'goatee', build: 1, height: 1, mus: 0.5, face: 11, top: 'tee_white', bottom: 'jeans_blue' },
  dark: { body: 'm', skin: '#4a2c1a', hairStyle: 'locs', hair: '#111111', eyes: '#2a1a10', facialHair: 'beard', build: 1.3, height: 1.2, mus: 0.7, face: 77, top: 'tee_red', bottom: 'jeans_blue' },
  light: { body: 'm', skin: '#e0b48c', hairStyle: 'taper', hair: '#3a2614', eyes: '#4a6a8a', facialHair: 'none', build: 0.8, height: 1, mus: 0.3, face: 303, top: 'hoodie_grey', bottom: 'jeans_blue' },
  woman: { body: 'f', skin: '#a0663a', hairStyle: 'silk_press', hair: '#1a0f0a', eyes: '#3b2414', facialHair: 'none', extras: ['lashes', 'lipgloss'], build: 1, height: 0.9, mus: 0.3, face: 5, top: 'crop_white', bottom: 'jeans_blue' },
};
const VIEWS = { face: ['head', 0.3], side: ['head', 1.25], bust: ['bust', 0.3], body: ['full', 0.35], back: ['full', 3.0] };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +(process.env.VW || 900), height: +(process.env.VH || 900) }, deviceScaleFactor: +(process.env.DPR || 1), hasTouch: true, isMobile: true });
  const save = { v: 1, made: true, name: 'Test', cash: 1000, car: { id: 'chevrolet_caprice_classic_box_chevy_1986', color: '#14161c', cond: {}, fuel: 1, oil: 100, mods: {} }, at: { x: 600, z: -150, yaw: 0, foot: true, fx: 603, fz: -150, fyaw: 0 }, wear: { top: 'tee_white', bottom: 'jeans_blue', hat: '', shoes: '' } };
  await ctx.addInitScript(s => { try { localStorage.setItem('mw3d.save.v1', s); } catch (e) {} }, JSON.stringify(save));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 500)));
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => r.fulfill({ path: S + '/npm/node_modules/three/' + req.url().split('three@0.128.0/')[1], contentType: 'application/javascript' }));
  await pg.route(/supabase|fonts\.(googleapis|gstatic)/, r => r.abort());
  await pg.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => { const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' }); r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' }); });
  await pg.goto('http://game.test/index.html?test=1&net=local');
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__crTest, null, { timeout: 400000, polling: 1000 });
  await pg.evaluate(() => { try { window.__map.closeCreator(); } catch (e) {} window.__map.openCreator(false); const st = document.createElement('style'); st.textContent = '#cr-dock,#cr-top,#cr-view,#cr-tabs{display:none!important}'; document.head.appendChild(st); });
  await pg.waitForTimeout(2000);
  const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(LOOKS), views = (process.env.VIEWS || 'face,side,body').split(',');
  for (const n of only) {
    await pg.evaluate(L => { const T = window.__crTest, base = { ...T.CR.look, extras: [], tats: [] }; T.set(Object.assign(base, L)); }, LOOKS[n]);
    for (const v of views) { const [fr, yaw] = VIEWS[v]; await pg.evaluate(([fr, yaw]) => window.__crTest.view(fr, yaw), [fr, yaw]); await pg.waitForTimeout(2200);
      await pg.screenshot({ path: path.join(OUT, TAG + n + '-' + v + '.png'), timeout: 120000 }); console.log('shot', n, v); }
  }
  console.log('errs', JSON.stringify(errs)); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
