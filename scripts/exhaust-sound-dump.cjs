// Dumps the engine-audio config (eaCfgOf) for a set of cars and builds to JSON, so the exhaust/cam sound can be rendered
// offline (scripts/exhaust-sound-render.cjs) without loading the whole game each time.
// S = folder with npm/node_modules/three (three@0.128.0). OUT = JSON file.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), S = process.env.S, OUT = process.env.OUT || 'ea-cfgs.json';
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', mp3: 'audio/mpeg', css: 'text/css', webmanifest: 'application/json', svg: 'image/svg+xml', glb: 'model/gltf-binary', m4a: 'audio/mp4' };
const SETS = require('./exhaust-sound-sets.cjs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, r => { const p = r.request().url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),then(f){f({data:[]})}}),auth:{getSession:async()=>({data:{}}),onAuthStateChange(){} } });', contentType: 'application/javascript' }));
  await ctx.route(/^http:\/\/localhost:8766\/(.*)$/, r => { const u = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, ''), f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' }); });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  await pg.goto('http://localhost:8766/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
  const out = await pg.evaluate(SETS => {
    const M = window.__map, r = {};
    for (const s of SETS) {
      const c = M.newCar(s.car); c.eb = Object.assign({}, s.eb || {}); if (s.sku) c.eb.sku = s.sku;
      const cfg = window.__moto.ea(c), R = cfg.R;
      r[s.id] = { label: s.label, car: s.car, eb: c.eb, gen: cfg.gen, H: cfg.H, ex: cfg.ex, valve: cfg.valve, turbo: cfg.turbo, carb: cfg.carb, flat: cfg.flat, boostKind: cfg.boostKind,
        R: { disp: R.disp, idle: R.idle, red: R.red, ov: R.ov, vac: R.vac, res: R.res, cov: R.cov, psi: R.psi, hp: R.hp, tq: R.tq, cam: R.cam, kin: R.X.kin, hdrK: R.X.hdrK, eng: R.D.id || R.D.name, cyl: R.D.cyl, fo: R.D.fo, vt: R.D.vt, exh: R.D.exh } };
    }
    return r;
  }, SETS);
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(Object.keys(out).length + ' configs', errs.slice(0, 3));
  await b.close();
})();
