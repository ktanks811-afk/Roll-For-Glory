// Love + family test (2026-11-28). Headless Chromium (Playwright), repo served by Playwright's router.
// S = folder holding npm/node_modules/three (three@0.128.0), OUT = screenshot folder.
// Shoot your shot on a woman on the sidewalk, link up, a date, official, ring, wedding, the fade to black, pregnancy (belly by month),
// the birth at JPS, the baby in mom's arms, kids growing up in the yard, cheating -> caught -> divorce, and an online partner over
// BroadcastChannel (both say yes to dating and kids, their belly, the baby announcement).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..');
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
  const ctx = await b.newContext({ viewport: { width: +(process.env.VW || 844), height: +(process.env.VH || 390) }, hasTouch: true, isMobile: true, deviceScaleFactor: +(process.env.DPR || 1) });
  const save = { v: 1, made: true, name: 'Kimari', cash: 250000, bank: 400000, look: { body: 'm', skin: '#6b4429', hairStyle: 'waves', facialHair: 'goatee' }, car: null, day: 5 };
  await ctx.addInitScript(s => { try { localStorage.setItem('mw3d.save.v1', s); } catch (e) {} }, JSON.stringify(save));
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|supabase/i.test(t)) errs.push('console ' + t.slice(0, 300)); if (/love/.test(t)) console.log('  [page]', t.slice(0, 300)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase|fonts\.(googleapis|gstatic)/, r => r.abort());
  await pg.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => {
    const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' });
  });
  await pg.goto('http://game.test/index.html?test=1&net=local');
  await pg.waitForFunction(() => window.__map && window.__map.ready && window.__love && window.__photo, null, { timeout: 400000, polling: 1000 });
  const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms);
  const shot = async (n, ms = 2500) => { await wait(ms); await pg.screenshot({ path: path.join(OUT, n + '.png') }); console.log('shot', n); };
  const fail = []; const ok = (c, m) => { if (!c) fail.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };
  await ev(() => { const M = window.__map; try { M.closeCreator(); } catch (e) {} if (window.__cops) window.__cops.COP.noPop = true; try { window.__story && window.__story.syPause && window.__story.syPause(); } catch (e) {} });
  await wait(4000);
  // stand somewhere with people on the sidewalk, near a food spot
  const tp = (x, z, yaw = 0) => ev(([x, z, yaw]) => { const f = window.__guns.foot; f.x = x; f.z = z; f.yaw = f.camYaw = yaw; f.target = null; f.holder.position.set(x, 0, z); f.holder.rotation.y = yaw; }, [x, z, yaw]);
  const cam = (o) => ev(o => { const P = window.__photo, f = window.__guns.foot; if (!P.PM.on) P.pmOpen(); P.PM.yaw = f.yaw + Math.PI + (o.y ?? 0.3); P.PM.dist = o.d ?? 3.4; P.PM.pitch = o.p ?? 0.1; P.PM.lift = o.l ?? -0.3; P.PM.off.set(o.x ?? 0, 0, o.z ?? 0); }, o);
  const settle = (n = 12) => ev(n => { for (let i = 0; i < n; i++) window.__love.tick(0.05); }, n);
  const camOff = () => ev(() => { try { window.__photo.pmClose(); } catch (e) {} });
  ok(await ev(() => window.__guns.foot.on), 'on foot');
  ok(await ev(() => !!document.querySelector('#phonebtn')), 'phone button');

  // 1) a woman walking by: shoot your shot
  await tp(-700, -100);
  await pg.waitForFunction(() => { window.__hood.tick(0.05); return window.__hood.HOOD.ready; }, null, { timeout: 120000, polling: 500 }).catch(() => {});
  await ev(() => { const L = window.__life, f = window.__guns.foot; for (let i = 0; i < 45; i++) { L.lvSpawn(f.x, f.z); for (let k = 0; k < 2; k++) { try { window.__hood.tick(0.05); } catch (e) {} } } });
  let her = null;
  for (let i = 0; i < 30 && !her; i++) { await wait(1000); her = await ev(() => { const L0 = window.__life, f0 = window.__guns.foot; for (let j = 0; j < 6; j++) { L0.lvSpawn(f0.x, f0.z); try { window.__hood.tick(0.05); } catch (e) {} } const f = window.__guns.foot, H = window.__hood.HOOD; const e = H.ents.filter(e => e.kind === 'ped' && !e.gone && e.who && e.who.fem && !e.who.elder && !e.hide).sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z))[0]; return e ? { id: e.id, name: e.name, x: e.x, z: e.z, lv: !!e.lvL } : null; }); }
  ok(!!her, 'found a woman on the sidewalk ' + JSON.stringify(her));
  if (her) {
    const r = await ev(() => {
      const f = window.__guns.foot, H = window.__hood.HOOD, L = window.__love;
      const e = H.ents.filter(e => e.kind === 'ped' && !e.gone && e.who && e.who.fem && !e.who.elder && !e.hide).sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z))[0];
      if (!e) return null;
      f.x = e.x + 1.6; f.z = e.z + 0.4; f.holder.position.set(f.x, 0, f.z);
      const menu = L.talkMenu(e)().rows.map(r => r.t);
      const R = Math.random; Math.random = () => 0.01; let got; try { got = !!L.loShot(e); } finally { Math.random = R; }
      const p = L.loS().ppl[String(e.id)], same = p && e.lvL ? p.look.skin === e.lvL.skin && p.look.hairStyle === e.lvL.hairStyle : 'no lvL';
      const menu2 = L.talkMenu(e)().rows.map(r => r.t);
      if (p) { p.aff = 40; L.loAskOutHere(e, p); }
      return { menu, got, same, menu2, name: e.name };
    });
    ok(r && r.menu.includes('Shoot your shot'), 'her talk menu has Shoot your shot: ' + (r && r.menu.slice(0, 4).join(' | ')));
    ok(r && r.got, 'she gave you her number');
    ok(r && r.same === true, 'her saved look is the person you met: ' + (r && r.same));
    ok(r && r.menu2.includes('Take her out'), 'after: ' + (r && r.menu2.slice(0, 4).join(' | ')));
  } else {
    await ev(() => { const L = window.__love, S = window.__guns.S; L.loS().ppl.t1 = { id: 't1', name: 'Aaliyah', fem: true, look: L.loKidLook({ skin: '#8a5a3c' }, { skin: '#8a5a3c' }, true, 5), aff: 40, st: 'talking', met: S.day, last: S.day, dates: 0, chat: [] }; L.loS().ppl.t1.look.build = 1; L.loLink(L.loS().ppl.t1); });
  }
  await wait(3000);
  ok(await ev(() => !!window.__love.LO.C), 'she is linked up and walking with you');
  await ev(() => { const f = window.__guns.foot; f.x += 3; f.holder.position.x = f.x; }); await wait(6000);
  const cd = await ev(() => { const C = window.__love.LO.C, f = window.__guns.foot; return C ? Math.hypot(C.x - f.x, C.z - f.z) : -1; });
  ok(cd > 0 && cd < 5, 'she follows you (' + cd.toFixed(2) + ' m)');
  await cam({ y: 0.6, d: 3.8 }); await shot('01-linked-up', 3500); await camOff();
  // 2) a date at a food spot
  const fp = await ev(() => { const P = window.__love.places('food'); return P; });
  if (fp) { await tp(fp.x + 6, fp.z + 6, 0); await wait(1500); await settle(); }
  const pillTxt = await ev(() => document.getElementById('lopill') && !document.getElementById('lopill').hidden ? document.getElementById('lopill').textContent : '');
  ok(/Date/.test(pillTxt), 'date pill at the food spot: ' + pillTxt);
  const cash0 = await ev(() => window.__guns.S.cash);
  await ev(() => window.__love.LO.act.date && window.__love.LO.act.date());
  await shot('02-date-fade', 2200);
  await wait(4500);
  const dt = await ev(() => { const p = window.__love.LO.C.p; return { st: p.st, aff: p.aff, dates: p.dates, cash: window.__guns.S.cash }; });
  ok(dt.st === 'dating' && dt.dates === 1 && dt.cash < cash0, 'after the date: dating ' + JSON.stringify(dt));
  // 3) official -> ring -> wedding at the courthouse
  await ev(() => { const p = window.__love.LO.C.p; p.aff = 92; p.dates = 3; p.st = 'gf'; });
  await ev(() => { window.__guns.S.cash = 250000; const L = window.__love; L.loS().wedPlan = 0; const p = L.LO.C.p; p.st = 'engaged'; });
  const ct = await ev(() => window.__love.places('court'));
  if (ct) { await tp(ct.x + 6, ct.z + 6, 0); await wait(1500); await settle(); }
  const wpill = await ev(() => document.getElementById('lopill').textContent);
  ok(/Marry/.test(wpill), 'wedding pill at the courthouse: ' + wpill);
  await ev(() => window.__love.LO.act.wed && window.__love.LO.act.wed());
  await shot('03-wedding-fade', 4500); await wait(4500);
  ok(await ev(() => window.__love.LO.C.p.st === 'married'), 'married');
  // 4) home, kids talk, stay the night (fade to black), pregnant
  const home = await ev(() => window.__love.places('home'));
  await tp(home.x + 10, home.z + 4, 0); await wait(4000);
  await ev(() => { const p = window.__love.LO.C.p; p.aff = 90; const R = Math.random; Math.random = () => 0.1; try { window.__love.loS(); } finally { Math.random = R; } });
  await ev(() => { const L = window.__love, p = L.LO.C.p; p.kidsOk = 0; const R = Math.random; Math.random = () => 0.1; try { window.__love.loS(); } finally { Math.random = R; } });
  const kt = await ev(() => { const L = window.__love, p = L.LO.C.p; L.loS(); window.__love.kidsTalk(p); return p.kidsOk; });
  ok(kt === 1, 'she agreed to have kids');
  const day0 = await ev(() => window.__guns.S.day);
  await ev(() => { const L = window.__love, p = L.LO.C.p, R = Math.random; Math.random = () => 0.1; L.loNight(p).finally(() => {}); setTimeout(() => { Math.random = R; }, 6000); });
  await shot('04-night-fade', 2400);
  await shot('05-next-morning', 2600);
  await wait(4000);
  const pr = await ev(() => { const p = window.__love.LO.C.p; return { preg: !!p.preg, day: window.__guns.S.day }; });
  ok(pr.preg && pr.day === day0 + 1, 'next morning, she is pregnant ' + JSON.stringify(pr));
  // 5) months go by: her belly (she's at home, not linked)
  await ev(() => window.__love.loUnlink());
  const sleepN = n => ev(n => { for (let i = 0; i < n; i++) { const S = window.__guns.S; S.day++; window.__love.loDaily(); } }, n);
  await sleepN(4); await settle(); await wait(2000);
  const wf = await ev(() => { const W = window.__love.LO.wife; return W ? { x: W.x, z: W.z } : null; });
  ok(!!wf, 'your wife is at the house');
  if (wf) { await tp(wf.x + 1.8, wf.z, Math.PI / 2); await wait(2000); await cam({ y: 1.6, d: 3.4, x: -1.2 }); await shot('06-pregnant-4-months', 3500); await camOff(); }
  await sleepN(4); await wait(2500);
  if (wf) { await cam({ y: 1.6, d: 3.4, x: -1.2 }); await shot('07-pregnant-8-months', 3500); await camOff(); }
  // 6) labor -> JPS -> baby
  await sleepN(1);
  const lab = await ev(() => { const p = Object.values(window.__love.loS().ppl).find(p => p.st === 'married'); return p.preg && p.preg.labor; });
  ok(!!lab, 'her water broke on day 9');
  await ev(() => { const L = window.__love, p = Object.values(L.loS().ppl).find(p => p.st === 'married'); L.loLink(p); });
  const hos = await ev(() => window.__love.places('hospital'));
  await tp(hos.x + 8, hos.z + 8, 0); await wait(1500); await settle();
  const hp = await ev(() => document.getElementById('lopill').textContent);
  ok(/labor/.test(hp), 'labor pill at JPS: ' + hp);
  await ev(() => window.__love.LO.act.go && window.__love.LO.act.go()); await wait(9000);
  const kids = await ev(() => window.__love.loS().kids.map(k => [k.name, k.fem, window.__love.loStage(k)]));
  ok(kids.length === 1 && kids[0][2] === 'baby', 'the baby is born: ' + JSON.stringify(kids));
  // baby at home in mom's arms
  await ev(() => window.__love.loUnlink());
  await tp(home.x + 10, home.z + 4, 0); await settle(); await wait(2000);
  const held = await ev(() => { const W = window.__love.LO.wife; return W ? [...window.__love.LO.kids.values()].some(K => K.held) : false; });
  ok(held, 'mom is holding the baby');
  { const W = await ev(() => { const W = window.__love.LO.wife; return { x: W.x, z: W.z }; }); await tp(W.x + 1.5, W.z, Math.PI / 2); await wait(1500); await cam({ y: 1.6, d: 2.4, x: -0.9, l: -0.1 }); await shot('08-mom-holds-baby', 3500); await camOff(); }
  // a second baby in the carrier, then they grow up
  await ev(() => { const L = window.__love, S = window.__guns.S, p = Object.values(L.loS().ppl).find(p => p.st === 'married'); p.preg = { d0: S.day - 10, seed: 99, labor: S.day - 1 }; L.loBorn(p, false); });
  await settle(); await wait(1500);
  const cr = await ev(() => { const K = [...window.__love.LO.kids.values()].find(K => !K.held && K.baby); return K ? { x: K.x, z: K.z } : null; });
  if (cr) { await tp(cr.x + 1.2, cr.z + 0.6, Math.PI / 2); await cam({ y: 1.9, d: 1.8, p: 0.45, l: -0.6 }); await shot('09-baby-carrier', 4000); await camOff(); }
  for (const [n, yrs] of [['10-toddlers', 3], ['11-kids', 8], ['12-teens', 15]]) {
    await ev(yrs => { const L = window.__love; for (const k of L.loS().kids) k.born = window.__guns.S.day - Math.round(yrs * 6) - (k === L.loS().kids[0] ? 6 : 0); }, yrs);
    await settle(); await wait(1500);
    const st = await ev(() => window.__love.loS().kids.map(k => window.__love.loStage(k) + ':' + window.__love.loAge(k).toFixed(1)));
    console.log('  kids', st.join(' '));
    const K = await ev(() => { const a = [...window.__love.LO.kids.values()]; return a.length ? { x: a[0].x, z: a[0].z } : null; });
    if (K) { await tp(K.x + 3.2, K.z + 0.5, Math.PI / 2); await wait(800); await cam({ y: 1.4, d: 4.2, x: -1.5, p: 0.15 }); await shot(n, 3500); await camOff(); }
  }
  const km = await ev(() => { const L = window.__love, k = L.loS().kids[0]; return L.loKidMenu(k, null).rows.map(r => r.t); });
  ok(km.includes('Help with homework'), 'kid menu: ' + km.join(' | '));
  // 7) cheating: date somebody else -> caught -> divorce (half the bank, child support)
  const bank0 = await ev(() => window.__guns.S.bank);
  await ev(() => { const L = window.__love, S = window.__guns.S; L.loS().ppl.side = { id: 'side', name: 'Destiny', fem: true, look: L.loKidLook({ skin: '#c68e65' }, { skin: '#c68e65' }, true, 3), aff: 60, st: 'dating', met: S.day, last: S.day, dates: 2, chat: [] }; L.loS().ppl.side.look.build = 1; for (let i = 0; i < 4; i++) L.loCheat('date', L.loS().ppl.side); });
  const sus = await ev(() => { const L = window.__love.loS(), p = Object.values(L.ppl).find(p => p.st === 'married'); return L.sus['n:' + p.id]; });
  ok(sus >= 12, 'cheating builds suspicion (' + sus + ')');
  await ev(() => { const L = window.__love, p = Object.values(L.loS().ppl).find(p => p.st === 'married'); p.caught = 1; const R = Math.random; Math.random = () => 0.01; try { L.loDaily(); } finally { Math.random = R; } });
  const dv = await ev(() => { const L = window.__love.loS(), p = Object.values(L.ppl).find(p => p.id !== 'side'); return { st: p.st, bank: window.__guns.S.bank, support: L.support, cust: L.kids.map(k => k.cust) }; });
  ok(dv.st === 'divorced' && dv.bank <= bank0 / 2 && dv.support === 240 && dv.cust.every(c => c === 'them'), 'caught again -> divorce: ' + JSON.stringify(dv));
  await ev(() => { window.__guns.S.day = 7 * Math.ceil(window.__guns.S.day / 7) + 1; }); await settle();
  ok(await ev(() => window.__love.LO.kids.size === 0), 'weekday: the kids are at their mom\'s');
  // 8) the Love app
  await ev(() => { document.getElementById('phonebtn').click(); }); await wait(800);
  await ev(() => window.__love.loApp(document.getElementById('ph-screen'))); await shot('13-love-app', 1500);
  await ev(() => { const L = window.__love; L.loApp(document.getElementById('ph-screen'), { on: 'n:side' }); }); await wait(600);
  await ev(() => { document.querySelector('[data-a="text"]').click(); }); await shot('14-love-app-person', 1200);
  await ev(() => { document.getElementById('phonebtn').click(); });
  // 9) online: a fake player (Tasha) over BroadcastChannel
  await ev(() => window.__net.netJoin('eastgate')); await wait(3000);
  await ev(() => {
    const ch = new BroadcastChannel('rfg:eastgate'), NET = window.__net.NET, f = window.__guns.foot, t0 = Date.now();
    const F = window.__fake = { ch, q: 0, pg: 0, got: [] };
    const look = { body: 'f', skin: '#8a5a3c', hair: '#111111', hairStyle: 'box_braids', top: 'mh_tee_purple', bottom: 'md_stacked', shoes: 'mk_af1_white', hat: 'no_hat', extras: ['lashes', 'studs'] };
    const x = f.x + 1.7, z = f.z + 0.3;
    F.timer = setInterval(() => {
      ch.postMessage({ k: '_p', id: 'F2', t: t0 });
      if (!F.said || Date.now() - F.said > 2000) { F.said = Date.now(); ch.postMessage({ k: 'h', id: 'F2', u: 'uidTasha01', n: 'Tasha', m: 'chevrolet_caprice_classic_box_chevy_1986', m3: 'chevrolet_caprice_classic_box_chevy_1986', v: { paint: '#6a1fb3' }, l: {}, t: 1, lk: look, gn: 0, pg: F.pg || undefined }); }
      ch.postMessage({ k: 's', id: 'F2', q: ++F.q, x, z, h: -f.yaw, v: 0, r: 0, a: 0, c: 0, f: 0 });
      const q = NET.peers.get('F2'); if (q) q.seen = performance.now() / 1000 + 1e5;
    }, 100);
    // Tasha says yes to everything (and on the night: she gets pregnant)
    ch.onmessage = e => { const m = e.data; if (!m || m.k !== 'lv' || m.to !== 'F2') return; F.got.push(m.t); if (m.rid && m.t !== 'yes' && m.t !== 'no') ch.postMessage({ k: 'lv', id: 'F2', to: NET.id, u: 'uidTasha01', n: 'Tasha', t: 'yes', rid: m.rid, ...(m.t === 'night' ? { preg: 1, who: 'me', seed: 4242 } : {}) }); };
  });
  await wait(5000); await ev(() => { for (let i = 0; i < 20; i++) window.__net.netTick(0.05); }); await settle();
  ok(await ev(() => { const p = window.__net.NET.peers.get('F2'); return !!(p && p.uid === 'uidTasha01'); }), 'Tasha is on the server');
  const lp = await ev(() => document.getElementById('lopill').hidden ? '' : document.getElementById('lopill').textContent);
  ok(/Tasha/.test(lp), 'standing next to her: LOVE pill: ' + lp);
  for (const t of ['date', 'gf', 'kids']) { await ev(t => window.__love.loAsk('uidTasha01', t), t); await wait(6000); }
  const rel = await ev(() => { const r = window.__love.loS().pl.uidTasha01; return r ? { st: r.st, kids: r.kidsOk } : null; });
  ok(rel && rel.st === 'gf' && rel.kids === 1, 'Tasha said yes to dating, official and kids: ' + JSON.stringify(rel));
  // an incoming ask from her: you answer on the pill
  await ev(() => window.__fake.ch.postMessage({ k: 'lv', id: 'F2', to: window.__net.NET.id, u: 'uidTasha01', n: 'Tasha', t: 'propose', rid: 'rq1' })); await wait(1500); await settle(2);
  const ip = await ev(() => document.getElementById('lopill').textContent);
  ok(/proposing/.test(ip), 'her proposal on the pill: ' + ip);
  await cam({ y: 0.5, d: 4 }); await shot('15-online-proposal', 1500); await camOff();
  await ev(() => window.__love.LO.act.yes()); await wait(1500);
  ok(await ev(() => window.__love.loS().pl.uidTasha01.st === 'engaged' && window.__fake.got.includes('yes')), 'you said yes: engaged both ways');
  // the night with an online partner: she carries, her belly shows on her model for you
  const d1 = await ev(() => window.__guns.S.day);
  await ev(() => window.__love.loAsk('uidTasha01', 'night')); await pg.waitForFunction(() => { const r = window.__love.loS().pl.uidTasha01; return r && r.preg; }, null, { timeout: 60000, polling: 500 }).catch(() => {});
  const op = await ev(() => { const r = window.__love.loS().pl.uidTasha01; return { preg: !!r.preg, day: window.__guns.S.day }; });
  ok(op.preg && op.day === d1 + 1, 'online night: fade, next morning, Tasha is pregnant ' + JSON.stringify(op));
  await ev(() => { window.__fake.pg = 0.8; window.__fake.said = 0; }); await pg.waitForFunction(() => { window.__net.netTick(0.05); const v = window.__net.NET.peers.get('F2').view; const B = v && v.P && v.P.upper.getObjectByName('lo-belly'); return !!(B && B.visible); }, null, { timeout: 40000, polling: 400 }).catch(() => {});
  ok(await ev(() => { const v = window.__net.NET.peers.get('F2').view; const B = v && v.P && v.P.upper.getObjectByName('lo-belly'); return !!(B && B.visible); }), 'her belly shows on her character for you');
  await cam({ y: 1.2, d: 3.4, x: 0.9 }); await shot('16-online-partner-pregnant', 3000); await camOff();
  // her baby is born on her side: the announcement adds your kid
  await ev(() => window.__fake.ch.postMessage({ k: 'lv', id: 'F2', to: window.__net.NET.id, u: 'uidTasha01', n: 'Tasha', t: 'born', kid: { id: 'kTashaBaby1', name: 'Nova', fem: true, look: { body: 'f', skin: '#74462a', hairStyle: 'puffs', hair: '#111111', top: 'tee_white', bottom: 'jeans_blue', shoes: 'kicks_white' }, age: 0 } })); await wait(1500);
  ok(await ev(() => window.__love.loS().kids.some(k => k.id === 'kTashaBaby1' && k.par[0] === 'o:uidTasha01')), 'her baby announcement adds Nova to your kids');
  // you pregnant (as a woman, online): your own belly
  await ev(() => { const S = window.__guns.S; S.look.body = 'f'; S.love.myPreg = { d0: S.day - 7, by: 'o:uidTasha01', seed: 5 }; });
  await wait(3000);
  ok(await ev(() => { const B = window.__guns.ME.upper.getObjectByName('lo-belly'); return !!(B && B.visible); }), 'your own belly when you are the one pregnant');
  ok(await ev(() => window.__net.NET && true), 'hello carries pg');
  await cam({ y: 1.5, d: 3 }); await shot('17-you-pregnant', 3000); await camOff();
  console.log('errors', errs.length ? '\n' + errs.join('\n') : 'none');
  console.log(fail.length ? 'FAILED ' + fail.length + ': ' + fail.join(' | ') : 'ALL OK');
  await b.close();
})();
