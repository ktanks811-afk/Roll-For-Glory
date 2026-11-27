// Jail life test (headless Chromium + Playwright, the repo served by Playwright's router).
// S = folder with npm/node_modules/three (three@0.128.0). OUT = folder for screenshots.
// 1. county: the connect, selling to inmates, a fight you start, a shakedown with a write-up and seg, beef that walks up on you, other people's fights
// 2. felony time: the chain bus to the TDCJ unit, whites, the yard, the weight pile, a yard fight, release back to Fort Worth
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..'), ONLY = process.env.ONLY || '';
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
const log = o => console.log(JSON.stringify(o));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const save = { v: 1, made: true, name: 'Kimari', cash: 4200, bank: 9000, car: { id: 'chevrolet_caprice_classic_box_chevy_1986', color: '#b3121b', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 1, oil: 100, mods: {} }, at: { x: 600, z: -150, yaw: 0, foot: true, fx: 600, fz: -150, fyaw: 0 } };
  await ctx.addInitScript(s => { if (!localStorage.getItem('mw3d.save.v1')) localStorage.setItem('mw3d.save.v1', s); }, JSON.stringify(save));
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && /jail|police|hood/i.test(m.text())) errs.push('console ' + m.text().slice(0, 400)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),rpc:async()=>({data:null})});', contentType: 'application/javascript' }));
  await pg.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => {
    const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' });
  });
  await pg.goto('http://game.test/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a);
  const shot = async n => { await pg.waitForTimeout(500); await pg.screenshot({ path: path.join(OUT, n + '.png') }); log({ shot: n }); };
  const pump = (n, dt = 0.05) => ev(([n, dt]) => window.__jail.jPump(n, dt), [n, dt]);
  await ev(() => { try { window.__map.closeCreator(); } catch (e) {} });
  await pg.waitForFunction(() => { window.__hood.tick(0.05); return window.__hood.HOOD.ready; }, null, { timeout: 120000, polling: 500 });
  const jp = await ev(() => { const p = window.__jail.jailPlace(); return p && { x: p.x, z: p.z, face: p.face }; });
  log({ test: 'jail place', jp });
  const state = () => ev(() => { const J = window.__jail, st = J.JL.st, C = window.__cops.COP, S = window.__map.S; return { ph: st && st.ph, t: st && +st.t.toFixed(1), ch: st && st.ch, cop: C.phase, unseen: +(C.unseenT || 0).toFixed(1), heat: S.heat, warrant: S.jail && S.jail.warrant && S.jail.warrant.ch, inJail: !!(S.jail && S.jail.in), stage: S.jail && S.jail.stage, foot: [Math.round(window.__map.foot.x), Math.round(window.__map.foot.z)] }; });
  const Y = f => ev(f);
  const st = () => ev(() => { const j = window.__map.S.jail, M = window.__map; return { unit: j.unit || 'county', place: M.IN.place && M.IN.place.id, rep: j.rep, str: j.str, cb: j.cb, stash: j.st, bank: M.S.bank, health: Math.round(M.S.health), days: j.days, wu: j.wu, solo: j.solo > Date.now(), hud: document.getElementById('jlhud') && document.getElementById('jlhud').textContent }; });
  // book you in on a warrant and sit it out
  const lockUp = async ch => { await ev(ch => { const J = window.__jail, S = window.__map.S; S.jail = S.jail || {}; S.jail.warrant = { ch, at: Date.now() }; J.jBook(true); }, ch); await pg.waitForTimeout(800); await ev(() => { const J = window.__jail; for (let i = 0; i < 12 && J.jS().stage === 'book'; i++) J.jBookNext(); }); await pg.waitForTimeout(1500); await ev(() => { const j = window.__map.S.jail; j.until = Date.now() + 90 * 60000; }); };   // the headless browser is slow; keep the sentence from running out mid-test
  const fightOut = async (style) => { for (let i = 0; i < 160; i++) { const f = await ev(s => { const Yd = window.__yard, F = Yd.YD.fight; if (!F) return 'done'; if (F.res) return 'res'; const op = F.op; if (op.a && op.at < op.a.hit && op.at > 0.02) Yd.ydAct('block'); else Yd.ydAct(s === 'hook' && Math.random() < 0.4 ? 'hook' : 'jab'); return 'on'; }, style); if (f === 'done') break; await pg.waitForTimeout(90); } };

  if (!ONLY || ONLY.includes('1')) {
    await lockUp(['pom', 'unl_carry']);
    log(Object.assign({ test: '1a. county, cell' }, await st(), { stations: await ev(() => window.__map.IN.stations.map(s => s.name)) }));
    await ev(() => { window.__map.S.bank = 2000; });
    // the connect
    const buy = await ev(() => { const Y = window.__yard, m = Y.ydConnect(); const r = m.rows.filter(r => /Weed|Squares|Shank|Bars/.test(r.t)); r.forEach(x => x.act()); r[0].act(); return { title: m.title, bought: r.map(x => x.t) }; });
    log(Object.assign({ test: '1b. bought from the connect', buy }, await st()));
    // sell to whoever wants something you have
    const sold = await ev(() => { const Y = window.__yard, j = Y.ydJ(), ims = Y.ydInmates(); let out = []; for (const m of ims) { if (!m.want) continue; j.cb[m.want] = (j.cb[m.want] | 0) + 1; const t = Y.ydTalk(m); const r = t.rows.find(r => /^Sell/.test(r.t)); out.push([m.name, m.want, r && r.btn]); r.act(); } return { out, people: Y.ydPeople().rows.map(r => r.t + ' | ' + r.s) }; });
    log(Object.assign({ test: '1c. sold', sold }, await st()));
    // walk to the dayroom and call somebody out
    await ev(() => { const M = window.__map; M.IN.pos.set(5, 0, -2); });
    const who = await ev(() => { const Y = window.__yard, m = Y.ydInmates().find(m => Y.ydQ(m)); return { name: m && m.name, ok: m && Y.ydFight(m, 'callout') }; });
    log({ test: '1d. fight started', who });
    await pg.waitForTimeout(600); await ev(() => window.__yard.ydAct('jab')); await pg.waitForTimeout(120); await shot('life-01-fight');
    await ev(() => window.__yard.ydAct('hook')); await pg.waitForTimeout(300); await shot('life-02-fight-hook');
    await fightOut('hook');
    await pg.waitForTimeout(1500);
    log(Object.assign({ test: '1e. fight over' }, await st(), { toast: await ev(() => { const t = document.querySelector('.toast,#toast'); return t && t.textContent; }) }));
    await shot('life-03-after-fight');
    // shakedown with something on you
    await ev(() => { const S = window.__map.S; S.jail.solo = 0; window.__yard.ydSegStep(); const j = window.__yard.ydJ(); j.cb = { weed: 2, shank: 1 }; j.st = {}; });
    let found = false; for (let i = 0; i < 8 && !found; i++) { await ev(() => { const j = window.__yard.ydJ(); if (!(j.cb.weed > 0)) j.cb = { weed: 2, shank: 1 }; window.__map.S.jail.solo = 0; window.__yard.ydSegStep(); window.__yard.ydShake(); }); await pg.waitForTimeout(1000); found = await ev(() => window.__map.S.jail.solo > Date.now()); }
    log(Object.assign({ test: '1f. shakedown', found }, await st()));
    await shot('life-04-seg');
    // out of seg, then somebody walks up on you
    await ev(() => { const S = window.__map.S; S.jail.solo = Date.now() - 1; window.__yard.ydSegStep(); window.__map.IN.pos.set(5, 0, -2); });
    await pg.waitForTimeout(400);
    const beef = await ev(() => window.__yard.ydBeef());
    await pg.waitForTimeout(1500); await shot('life-05-beef');
    log({ test: '1g. beef card', beef, card: await ev(() => { const b = document.getElementById('jlbook'); return b && !b.hidden && b.textContent.slice(0, 160); }) });
    await ev(() => document.querySelector('#jlbook [data-c="0"]').click());
    await pg.waitForTimeout(500); await fightOut('jab'); await pg.waitForTimeout(1200);
    log(Object.assign({ test: '1h. beef fight over' }, await st()));
    // other people's fight
    await ev(() => { const S = window.__map.S; S.jail.solo = Date.now() - 1; window.__yard.ydSegStep(); window.__map.IN.pos.set(10, 0, 3.5); window.__map.IN.camYaw = 2.6; });
    const amb = await ev(() => window.__yard.ydAmbient()); await pg.waitForTimeout(3000); await shot('life-06-dayroom-fight');
    log({ test: '1i. ambient fight', amb });
    await pg.waitForTimeout(6500);
  }

  if (!ONLY || ONLY.includes('2')) {
    // felony: booked in the county, then the chain bus to TDCJ
    await ev(() => { const S = window.__map.S; if (S.jail && S.jail.in) { S.jail.until = Date.now() - 1; window.__jail.jRelease(); } });
    await pg.waitForTimeout(800);
    await lockUp(['agg_assault']);
    await pg.waitForTimeout(3000);
    log(Object.assign({ test: '2a. TDCJ' }, await st()));
    await ev(() => { const M = window.__map; M.IN.pos.set(-7.5, 0, 4); M.IN.camYaw = -0.9; });
    await pg.waitForTimeout(800); await shot('life-07-tdcj-dorm');
    await ev(() => { const M = window.__map; M.IN.pos.set(-6, 0, -9.5); M.IN.camYaw = -0.6; window.__map.LOOK && (window.__map.LOOK.pitch = 0.45); });
    await pg.waitForTimeout(900); await shot('life-08-tdcj-yard');
    await ev(() => { const M = window.__map; M.IN.pos.set(-10, 0, -13); window.__yard.ydWork('lift'); });
    for (let i = 0; i < 8; i++) { await ev(() => { const b = document.querySelector('#jlbook [data-go]'); b && b.click(); }); await pg.waitForTimeout(150); }
    log(Object.assign({ test: '2b. weight pile' }, await st()));
    await ev(() => { const M = window.__map; M.IN.pos.set(6, 0, -11); });
    const who = await ev(() => { const Y = window.__yard, m = Y.ydInmates().find(m => Y.ydQ(m)); return { name: m && m.name, ok: m && Y.ydFight(m, 'callout') }; });
    await pg.waitForTimeout(700); await ev(() => window.__yard.ydAct('jab')); await pg.waitForTimeout(120); await shot('life-09-yard-fight');
    await fightOut('hook'); await pg.waitForTimeout(1500);
    log(Object.assign({ test: '2c. yard fight', who }, await st()));
    const phone = await ev(() => window.__yard.jPhoneW().rows.map(r => r.t));
    log({ test: '2d. TDCJ phone (no bond)', phone });
    // time served: the chain bus back
    await ev(() => { const S = window.__map.S; S.jail.solo = 0; S.jail.until = Date.now() - 1; window.__yard.jReleaseW(); });
    await pg.waitForTimeout(1200);
    log({ test: '2e. released', inJail: await ev(() => !!window.__map.S.jail.in), unit: await ev(() => window.__map.S.jail.unit), inside: await ev(() => !!window.__map.IN.place && document.body.classList.contains('indoors')) });
  }
  if (!ONLY || ONLY.includes('3')) {
    // 3. auto release: the clock runs out and you're walked out, no release desk
    await ev(() => { const S = window.__map.S; if (S.jail && S.jail.in) { S.jail.until = Date.now() - 1; window.__yard.jReleaseW(); } });
    await pg.waitForTimeout(800);
    await lockUp(['pom']);
    await ev(() => { window.__map.S.jail.until = Date.now() + 2500; });
    log(Object.assign({ test: '3a. locked up, 2.5 s left' }, await st()));
    await pg.waitForTimeout(3500); await shot('life-10-time-served');
    for (let i = 0; i < 20 && await ev(() => !!window.__map.S.jail.in); i++) await pg.waitForTimeout(500);
    await pg.waitForTimeout(800);
    log({ test: '3b. auto released', inJail: await ev(() => !!window.__map.S.jail.in), inside: await ev(() => !!(window.__map.IN.place && document.body.classList.contains('indoors'))), cash: await ev(() => window.__map.S.cash), rec: await ev(() => window.__map.S.jail.rec.slice(0, 1).map(r => [r.n, r.out])) });
    await shot('life-11-walked-out');
    // TDCJ time runs out while the game's closed: you come back already out
    await lockUp(['agg_assault']); await pg.waitForTimeout(3000);
    const unit = await ev(() => window.__map.S.jail.unit);
    await ev(() => { window.__map.S.jail.until = Date.now() - 1; });
    for (let i = 0; i < 20 && await ev(() => !!window.__map.S.jail.in); i++) await pg.waitForTimeout(500);
    await pg.waitForTimeout(800);
    log({ test: '3c. TDCJ auto release', unitBefore: unit, inJail: await ev(() => !!window.__map.S.jail.in), unit: await ev(() => window.__map.S.jail.unit), inside: await ev(() => document.body.classList.contains('indoors')) });
    // NPCs: an arrested set member is gone while his time runs, back after, and it makes the news
    const npc = await ev(async () => { const S = window.__map.S, j = S.jail; j.npcs.unshift({ id: 'test_npc', name: 'Tank (Six Block)', ch: 'warrant', until: Date.now() + 1500 }); const before = window.__scJailed ? window.__scJailed('test_npc') : null; await new Promise(r => setTimeout(r, 3500)); return { before, after: window.__scJailed ? window.__scJailed('test_npc') : null, news: window.__hood.wS().log.slice(0, 2).map(n => n.text) }; });
    log({ test: '3d. NPC released', npc });
  }
  log({ ERR: errs.slice(0, 12) });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
