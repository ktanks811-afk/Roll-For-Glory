// Renders the engine sound offline (OfflineAudioContext + the game's own AudioWorklet generator and graph) for the
// cars/builds in exhaust-sound-sets.cjs, to WAV (and MP3 when ffmpeg is there), so builds can be listened to side by side.
// Each clip: cold-ish start, idle (the cam's lope), three blips, a rev to the limiter, lift off, then two pulls through a
// gear change and a lift-off (overrun pops), standing a few metres behind the car.
// S = folder with npm/node_modules/three (three@0.128.0). OUT = folder. IDS = comma list (default all). SECS = clip length.
// INCAR=1 renders from the driver's seat instead.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), S = process.env.S, OUT = process.env.OUT || 'exhaust-sound', INCAR = !!process.env.INCAR;
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', mp3: 'audio/mpeg', css: 'text/css', webmanifest: 'application/json', svg: 'image/svg+xml', glb: 'model/gltf-binary', m4a: 'audio/mp4' };
const SETS = require('./exhaust-sound-sets.cjs').filter(s => !process.env.IDS || process.env.IDS.split(',').includes(s.id));
function wav(file, L, R, sr) {
  const n = L.length, b = Buffer.alloc(44 + n * 4); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4); b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4); }
  fs.writeFileSync(file, b);
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
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
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__ea, null, { timeout: 300000, polling: 1000 });
  const stats = {};
  for (const set of SETS) {
    const r = await pg.evaluate(async ({ set, inCar }) => {
      const M = window.__map, X = window.__ea, c = M.newCar(set.car); c.eb = Object.assign({}, set.eb || {});
      const cfg = X.eaCfgOf(c), R = cfg.R, sr = 44100, secs = 27, fps = 60;
      // the run, frame by frame: free-revving (stepEngFree, like the key fob), then scripted pulls in gear
      X.ENGT.cold = 0; X.ENGT.add = 0; Object.assign(X.ENGFREE, { rpm: 0, a: 0, cut: false, on: false });
      const St = { hot: 0, dfcoT: 0, lastThr: 0, spool: 0, vk: null }, frames = [], seq = [[0, { start: 1, p: { rpm: R.idle, map: cfg.gen.mapIdle, thr: 0, cold: 0, vk: 0 } }]];
      const blip = (t, t0, len, a) => t >= t0 && t < t0 + len ? a : 0, red = R.red;
      for (let i = 1; i < secs * fps; i++) {
        const t = i / fps, dt = 1 / fps; let rpm, thr, cut = false, psi = 0, boost = 1;
        if (t < 15.5) {
          thr = t < 4.5 ? 0 : blip(t, 5, 0.18, 0.6) + blip(t, 6.4, 0.26, 0.9) + blip(t, 7.8, 0.12, 0.5) + (t >= 9.3 && t < 11.8 ? Math.min(1, (t - 9.3) * 2.5) : 0);
          const F = X.stepEngFree(dt, R, thr, true); rpm = F.rpm; cut = F.cut; psi = F.psi || 0; boost = R.boostKind === 'turbo' ? Math.min(1, Math.max(0, thr * rpm / (red * 0.5))) : 1;
        } else {
          // in gear: pull 1, shift, pull 2, lift off and coast down, then idle
          const u = t - 15.5, lo = Math.max(1700, red * 0.32), sh = red * 0.68;
          if (u < 3.2) { rpm = lo + (red * 0.97 - lo) * Math.pow(u / 3.2, 1.15); thr = 1; }
          else if (u < 3.45) { rpm = red * 0.97 + (sh - red * 0.97) * (u - 3.2) / 0.25; thr = 0; }
          else if (u < 7.4) { rpm = sh + (red * 0.97 - sh) * Math.pow((u - 3.45) / 3.95, 1.1); thr = 1; }
          else if (u < 10.4) { rpm = red * 0.97 + (1500 - red * 0.97) * (u - 7.4) / 3; thr = 0; }
          else { rpm = 1500 + (R.idle - 1500) * Math.min(1, (u - 10.4) / 0.8); thr = 0; }
          boost = R.boostKind === 'turbo' ? Math.min(1, Math.max(0, (u > 0.4 && thr > 0.5 ? 1 : 0))) : 1;
          const k = Math.min(R.psiTab.length - 1, Math.max(0, Math.round(rpm / R.step))); psi = (R.psiTab[k] || 0) * Math.min(1, thr * 1.4) * boost;
        }
        const P = X.eaParams(dt, cfg, { rpm, thr, cut, psi, boost, inCar, cold: 0 }, St);
        const m = { p: Object.assign(P.p, { vk: P.vk }) }; if (P.bov) m.bov = P.bov; seq.push([t, m]); frames.push([t, P.ig, P.ibf, P.vk, rpm]);
      }
      const off = new OfflineAudioContext(2, sr * secs, sr), url = URL.createObjectURL(new Blob([X.eaModSrc()], { type: 'application/javascript' }));
      await off.audioWorklet.addModule(url);
      const keep = { ctx: X.EA.ctx, st: X.EA.st, node: X.EA.node, gen: X.EA.gen };
      let n;
      try {
        X.EA.ctx = off; X.EA.st = 'worklet'; n = X.eaBuild(cfg, { cfg: cfg.gen, seq }); X.EA.node = n;
        X.eaPipes(cfg, 0, inCar, 0); n.out.gain.setValueAtTime(0.9, 0);
        let lv = -1; for (const [t, ig, ibf, vk] of frames) { n.ig.gain.setTargetAtTime(ig, t, 0.06); n.ib.frequency.setTargetAtTime(ibf, t, 0.06); if (Math.abs(vk - lv) > 0.02) { X.eaPipes(cfg, vk, inCar, t); lv = vk; } }
      } finally { Object.assign(X.EA, keep); }
      const buf = await off.startRendering(), L = buf.getChannelData(0), Rr = buf.getChannelData(1);
      const seg = (a, b2) => { let s2 = 0, pk = 0; for (let i = Math.floor(a * sr); i < b2 * sr; i++) { s2 += L[i] * L[i]; pk = Math.max(pk, Math.abs(L[i])); } return { rms: +Math.sqrt(s2 / ((b2 - a) * sr)).toFixed(4), pk: +pk.toFixed(3) }; };
      return { L: Array.from(L, v => Math.round(v * 32767)), R: Array.from(Rr, v => Math.round(v * 32767)), sr, idle: seg(2, 4.5), limiter: seg(10.5, 11.8), pull: seg(17, 22), coast: seg(23, 25.9) };
    }, { set, inCar: INCAR });
    const L = Float32Array.from(r.L, v => v / 32767), Rr = Float32Array.from(r.R, v => v / 32767), f = path.join(OUT, set.id + (INCAR ? '-incar' : ''));
    wav(f + '.wav', L, Rr, r.sr);
    try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', f + '.wav', '-b:a', '160k', f + '.mp3']); } catch (e) {}
    stats[set.id] = { label: set.label, idle: r.idle, limiter: r.limiter, pull: r.pull, coast: r.coast };
    console.log(JSON.stringify({ id: set.id, idle: r.idle, limiter: r.limiter, pull: r.pull, coast: r.coast }));
  }
  fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(stats, null, 1));
  if (errs.length) console.log('errors', errs.slice(0, 5));
  await b.close();
})();
