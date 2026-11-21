// Story mode test (2026-11-21). Headless Chromium (Playwright), repo files served by Playwright's router.
// S = folder holding npm/node_modules/three (three@0.128.0). OUT = screenshot folder. UNTIL = last mission id to play (default t12).
// Plays a fresh save from the creator through the Prologue and Tier 1: answers calls, picks choices (PICK=index),
// walks/teleports to each objective, serves trap phone customers, fakes the roll race, and shoots the cutscenes.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const S = process.env.S, OUT = process.env.OUT || '.', ROOT = path.resolve(__dirname, '..'), UNTIL = process.env.UNTIL || 't12', PICK = +(process.env.PICK || 0), MAXSHOTS = +(process.env.SHOTS || 60), LIFE = process.env.LIFE || '';
const TYPES = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg', css: 'text/css', svg: 'image/svg+xml', glb: 'model/gltf-binary' };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: +(process.env.DPR || 1) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600)));
  pg.on('crash', () => { console.log('PAGE CRASH ' + new Date().toISOString()); try { fs.writeFileSync(path.join(OUT, 'story-test.log'), log.join('\n') + '\nCRASH\n' + errs.join('\n')); } catch (e) {} });
  pg.on('console', m => { const t = m.text(); if (/story/i.test(t)) errs.push('console: ' + t.slice(0, 400)); });
  await pg.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, (r, req) => { const p = req.url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await pg.route(/supabase/, r => r.fulfill({ body: 'export const createClient=()=>({channel:()=>({on(){return this},subscribe(){return this},send(){},track(){} }),from:()=>({select(){return this},eq(){return this},upsert:async()=>({}),insert:async()=>({}),order(){return this},limit(){return this},then(f){return f({data:[]})}}),rpc:async()=>({data:null})});', contentType: 'application/javascript' }));
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  await pg.route(/^http:\/\/game\.test\/(.*)$/, (r, req) => {
    const p = decodeURIComponent(new URL(req.url()).pathname).replace(/^\/+/, '') || 'index.html', f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ path: f, contentType: TYPES[path.extname(f).slice(1)] || 'application/octet-stream' });
  });
  await pg.goto('http://game.test/index.html?test=1');
  await pg.waitForFunction(() => window.__map && window.__map.ready, null, { timeout: 300000 });
  const ev = (f, a) => pg.evaluate(f, a);
  let nShot = 0; const seen = new Set(), log = [];
  { const _p = log.push.bind(log); log.push = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); return _p(...a); }; }
  const shot = async n => { if (nShot >= MAXSHOTS) return; nShot++; await pg.screenshot({ path: path.join(OUT, String(nShot).padStart(2, '0') + '-' + n.replace(/[^a-z0-9]+/gi, '-').slice(0, 40) + '.png') }); };
  // fresh save: the creator is open; finish it -> the story offer
  await ev(() => { document.getElementById('cr-go').click(); });
  await pg.waitForTimeout(2500);
  await shot('offer');
  await ev(() => { const b = document.querySelector('#sy-banner .act button'); if (b) b.click(); });
  await ev(([p, f]) => { const T = window.__story; T.SY.autoPick = p; T.SY.autoAnswer = true; T.SY.autoRetry = true; T.SY.fast = f; }, [PICK, !!process.env.FAST]);
  if (process.env.JUMP) await ev(id => window.__story.jump(id), process.env.JUMP);
  const t0 = Date.now();
  let lastObj = '', stuck = 0;
  while (Date.now() - t0 < 50 * 60000) {
    const st = await ev(() => { const T = window.__story, SY = T.SY, s = T.sy(), sub = document.getElementById('sy-sub');
      const M = window.__map;
      return { m: s.m, seg: s.seg, done: s.done.slice(), next: s.next, lock: SY.lock, sub: sub.classList.contains('on') ? sub.textContent : '', obj: SY.obj, talk: SY.talk ? SY.talk.who : null,
        choice: !document.getElementById('sy-choice').hidden, call: document.getElementById('sy-call').classList.contains('on'), pin: T.pinAt(), mk: T.mk(), orders: s.orders.map(o => [o.x, o.z, o.set, o.name]), cash: M.S ? M.S.cash : 0, title: document.getElementById('sy-title').classList.contains('on') ? document.querySelector('#sy-title h1').textContent : '' }; });
    if (st.done.includes(UNTIL)) { log.push('reached ' + UNTIL); break; }
    if (st.title && !seen.has('T' + st.title)) { seen.add('T' + st.title); await shot('title-' + st.title); }
    if (st.sub) { const k = (st.m || '') + st.sub; if (!seen.has(k)) { seen.add(k); log.push(`${st.m}/${st.seg} ${st.sub.slice(0, 120)}`); if (!/^Big Mama📞|📞/.test(st.sub) || nShot < MAXSHOTS) await shot(`${st.m}-${st.sub.slice(0, 30)}`); } await ev(() => window.__story.advance()); await pg.waitForTimeout(120); continue; }
    if (st.choice) { await shot(`${st.m}-choice`); await pg.waitForTimeout(400); continue; }
    if (st.lock) { await pg.waitForTimeout(300); continue; }
    if (st.obj !== lastObj) { lastObj = st.obj; stuck = 0; log.push(`OBJ ${st.m}/${st.seg}: ${st.obj}`); if (st.obj) await shot(`obj-${st.m}`); }
    // satisfy objectives
    const o = st.obj || '';
    if (st.talk) { await ev(() => { const T = window.__story; const A = T.SY.actors.get(T.SY.talk.who); const M = window.__map; if (A) { if (!M.foot.on) M.getOut && M.getOut(); M.foot.x = A.x + 1.4; M.foot.z = A.z + 0.4; } }); await pg.waitForTimeout(700); await ev(() => { const T = window.__story; if (T.SY.talk) T.SY.talk.go(); }); continue; }
    if (/Get in/.test(o)) { await ev(() => { const M = window.__map; if (M.foot.on) M.getIn(); }); await pg.waitForTimeout(600); continue; }
    if (/Serve|serve|Keep serving/.test(o) || (/new number/.test(o))) {
      if (st.orders.length) { const [x, z, set] = st.orders[0]; await ev(([x, z]) => { const M = window.__map; if (!M.foot.on) M.getOut(); M.foot.x = x + 1.2; M.foot.z = z + 0.8; }, [x, z]); await pg.waitForTimeout(900);
        if (!set) await ev(() => { const T = window.__story, s = T.sy(), M = window.__map; const o = s.orders.find(o => !o.set && Math.hypot(o.x - M.foot.x, o.z - M.foot.z) < 3); if (o) { if (s.pack < o.qty) s.pack = o.qty + 5; T.syServe(o); } });
      } else await ev(() => { const s = window.__story.sy(); if (s.pack < 3) s.pack = 10; window.__story.syNewOrder(); });
      continue;
    }
    if (/Keep Ramey Ave stocked/.test(o)) { await ev(() => { const T = window.__story, s = T.sy(), R = T.syTrap('ramey'); s.pack += 40; T.syTrapMenu(R).rows.find(r => /Drop off/.test(r.t)).act(); for (let i = 0; i < 6; i++) T.syTrapTick(); }); await shot('trap-menu'); await pg.waitForTimeout(500); continue; }
    if (/Pick up the cash/.test(o)) { await ev(() => { const T = window.__story, R = T.syTrap('ramey'), M = window.__map; const q = T.syTrapPos(R); if (!M.foot.on) M.getOut(); M.foot.x = q.x; M.foot.z = q.z; if (!R.cash) R.cash = 500; }); await pg.waitForTimeout(900); await ev(() => { const T = window.__story; window.__map.openMenu && window.__map.openMenu(() => T.syTrapMenu(T.syTrap('ramey'))); }).catch(() => {}); await pg.waitForTimeout(500); await shot('trap-run-menu'); await ev(() => { const T = window.__story; T.syTrapMenu(T.syTrap('ramey')).rows[0].act(); window.__map.closeMenu && window.__map.closeMenu(); }); await pg.waitForTimeout(500); continue; }
    if (/Get away from Ramey/.test(o)) { await ev(() => { const M = window.__map; if (M.foot.on) { M.foot.x += 400; } else { M.drvS().x += 400; } }); await pg.waitForTimeout(900); continue; }
    if (/Get out and walk/.test(o)) { await ev(() => { const M = window.__map; if (!M.foot.on) M.getOut(); }); await pg.waitForTimeout(900); continue; }
    if (/Win a drag race/.test(o)) { await ev(irl => { const s = window.__story.sy(); s.dragWins = (s.dragWins || 0) + 1; s.lastDragAt = irl ? 'ironline' : 'yellowbelly'; }, /Ironline Dragway/.test(o)); await pg.waitForTimeout(600); continue; }
    if (/Pay off Big Lou/.test(o)) { await ev(() => { const M = window.__map, s = window.__story.sy(); M.S.cash += Math.max(0, s.debt - s.paid) + 1000; }); await pg.waitForTimeout(500); continue; }
    if (/Get a car/.test(o)) { await ev(() => window.__story.giveCar()); await pg.waitForTimeout(800); continue; }
    if (/Get \$|Get a car/.test(o)) { await ev(() => { const M = window.__map; M.S.cash += 12000; }); await pg.waitForTimeout(500); continue; }
    if (/Run a roll race/.test(o)) { await shot('roll-spot'); await ev(() => { const M = window.__map; M.S.streetRuns = (M.S.streetRuns || 0) + 1; M.S.streetWins = (M.S.streetWins || 0) + 1; }); await pg.waitForTimeout(600); continue; }
    if (/Walk around Stop Six|Head back to Stop Six/.test(o)) { await ev(() => { const M = window.__map; if (!M.foot.on) M.getOut(); M.foot.x = 1700; M.foot.z = -300; }); await pg.waitForTimeout(800); continue; }
    if (st.pin && o) { await ev(([x, z, s]) => { const M = window.__map; if (M.foot.on) { M.foot.x = x + 1; M.foot.z = z + 1; } else { M.drvS().x = x; M.drvS().z = z; } }, [st.pin[0], st.pin[1]]).catch(async () => { await ev(([x, z]) => { const M = window.__map; if (M.foot.on) { M.foot.x = x + 1; M.foot.z = z + 1; } }, [st.pin[0], st.pin[1]]); }); await pg.waitForTimeout(900); continue; }
    if (!o && !st.m && !st.next && LIFE && st.done.includes('t2k')) { await ev(k => window.__story.syPlayLife(k), LIFE); await pg.waitForTimeout(800); continue; }
    if (!o && !st.m && st.next) { await ev(() => { window.__story.sy().nextT = 0; }); await pg.waitForTimeout(800); continue; }
    stuck++; if (stuck > 60) { log.push('STUCK ' + JSON.stringify(st).slice(0, 400)); await shot('stuck'); break; }
    await pg.waitForTimeout(500);
  }
  const fin = await ev(() => { const s = window.__story.sy(); return { done: s.done, meters: s.meters, flags: s.flags, journal: s.journal.length, met: s.met, debt: s.debt, paid: s.paid, served: s.served, tier: s.tier, texts: Object.keys(s.texts) }; });
  // the phone apps
  for (const app of ['story', 'texts', 'trap']) { await ev(a => { const M = window.__map; M.openPhone ? M.openPhone() : document.getElementById('phonebtn').click(); }, app).catch(() => {}); await ev(a => { document.querySelector(`#ph-screen .app[data-id="${a}"]`)?.click(); }, app); await pg.waitForTimeout(500); await shot('app-' + app); }
  await ev(() => { document.querySelector('#ph-screen .app[data-id="story"]')?.click(); }).catch(() => {}); await pg.waitForTimeout(300); await ev(() => { document.querySelector('#ph-screen [data-t="lives"]')?.click(); }).catch(() => {}); await pg.waitForTimeout(500); await shot('app-lives');
  fs.writeFileSync(path.join(OUT, 'story-test.log'), log.join('\n') + '\n\nFINAL ' + JSON.stringify(fin, null, 1) + '\n\nERRORS\n' + errs.join('\n'));
  console.log(JSON.stringify({ fin, errs: errs.slice(0, 20), steps: log.length, minutes: ((Date.now() - t0) / 60000).toFixed(1) }, null, 1));
  await b.close();
})();
