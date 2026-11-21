// Gossip posts tests (headless Chromium + swiftshader, Playwright). Serve the repo on PORT (default 8782);
// S = folder with npm/node_modules/three (three@0.128.0). OUT = folder for screenshots (optional).
// PART=1 one player: post from photo mode, caption, the city reacts (likes, comments, followers, activity), NPC posts,
// page posts from gossip, somebody snaps you, comments and replies, profile, phone layouts.
// PART=2 two players on the same server (?net=local): A posts, B sees it with the picture, B likes/comments/follows,
// A gets it as real activity; the saved server copy (local stand-in for supabase/rfg_gram.sql) feeds a third player.
const { chromium } = require('playwright');
const PORT = process.env.PORT || 8782, S = process.env.S, OUT = process.env.OUT, PART = process.env.PART || '1';
const log = o => console.log(JSON.stringify(o));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)$/, r => { const p = r.request().url().split('three@0.128.0/')[1]; r.fulfill({ path: S + '/npm/node_modules/three/' + p, contentType: 'application/javascript' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
  const save = { v: 1, made: true, name: 'Kimari', cash: 25000, bank: 0, rep: 60, car: { id: 'dodge_charger_srt_hellcat_widebody_2020', color: '#b3121b', cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 }, fuel: 1, oil: 100, mods: {} }, at: { x: -700, z: -100, yaw: 0 } };
  await ctx.addInitScript(s => { if (!localStorage.getItem('mw3d.save.v1')) localStorage.setItem('mw3d.save.v1', s); }, JSON.stringify(save));
  const errs = [];
  const open = async (tag, q) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(tag + ' ' + e.message)); p.on('console', m => { if ((m.type() === 'error' || /gram/.test(m.text())) && !/Failed to load resource|supabase/i.test(m.text())) errs.push(tag + ' console ' + m.text().slice(0, 300)); }); await p.goto(`http://localhost:${PORT}/index.html${q}`, { timeout: 180000 }); await p.waitForFunction(() => window.__map && window.__map.ready && window.__gram, null, { timeout: 300000, polling: 1000 }); return p; };
  const shot = async (p, name) => { if (!OUT) return; await p.bringToFront(); await p.screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 }); };
  const openGossip = async (p, tab, view) => { await p.evaluate(([tab, view]) => { const G = window.__gram; G.GR.tab = tab; G.GR.view = view || null; if (document.getElementById('phone').hidden) document.getElementById('phonebtn').click(); const a = document.querySelector('#ph-screen .app[data-id="gossip"]'); if (a) a.click(); else G.grRefresh(); }, [tab, view]); await p.waitForTimeout(1800); };
  const close = p => p.evaluate(() => { const ph = document.getElementById('phone'); if (!ph.hidden) document.getElementById('phonebtn').click(); });

  if (PART === '1') {
    const A = await open('A', '?test=1');
    await A.waitForTimeout(3000);
    const seed = await A.evaluate(() => { const G = window.__gram; for (let i = 0; i < 3; i++) G.grNpcLife(); window.__gram.addGossip({ kind: 'news', icon: '🏁', text: 'A $5,000 street race went down on East Lancaster. The whole east side is talking.' }); window.__gram.addGossip({ kind: 'rumor', icon: '🗣', text: 'Word is the Hellcat crowd is meeting by the Stop Six Shell after dark.' }); return { feed: G.gram().feed.map(p => [p.h, p.cap.slice(0, 50)]), handle: G.gram().h, followers: G.gram().npcF }; });
    log({ test: '1. the city posts (life + pages from gossip)', ...seed });

    const pm = await A.evaluate(async () => { const P = window.__photo; P.pmOpen(); await new Promise(r => setTimeout(r, 800)); P.pmSnap(); for (let i = 0; i < 40 && !document.getElementById('pm-sheet').classList.contains('open'); i++) await new Promise(r => setTimeout(r, 250)); return { on: P.PM.on, sheet: document.getElementById('pm-sheet').classList.contains('open'), postBtn: !!document.getElementById('gr-pm-post') }; });
    log({ test: '2. photo mode sheet has Post to Gossip', ...pm });
    await A.waitForTimeout(1200); await shot(A, '01-photo-sheet');
    await A.evaluate(() => document.getElementById('gr-pm-post').click()); await A.waitForTimeout(2500);
    await shot(A, '02-new-post');
    await A.fill('#gr-cap', 'Hellcat out in Stop Six tonight 😤 #MurdaWorth');
    await A.evaluate(() => document.querySelector('[data-a="share"]').click());
    await A.waitForFunction(() => window.__gram.gram().posts.length > 0, null, { timeout: 150000, polling: 300 }).catch(async e => { log({ FAIL: 'share', errs, st: await A.evaluate(() => ({ posting: window.__gram.GR.posting, draft: !!window.__gram.GR.draft, toast: document.body.innerText.slice(-300) })) }); throw e; });
    await A.waitForTimeout(2500);
    const post = await A.evaluate(async () => { const G = window.__gram, p = G.gram().posts[0], b = await G.grImgGet(p.id); return { id: p.id, cap: p.cap, loc: p.loc, img: p.img, blobKB: b ? Math.round(b.size / 1024) : 0, rawImg: await new Promise(r => { const q = indexedDB.open('mw3d-gram', 1); q.onsuccess = () => { const t = q.result.transaction('i').objectStore('i').get(p.id); t.onsuccess = () => r(t.result ? Object.keys(t.result).join(',') + ' ' + (t.result.blob && t.result.blob.constructor.name) + ' ' + (t.result.blob && t.result.blob.size) : 'none'); t.onerror = () => r('err'); }; }), plan: { likes: p.pl.L, comments: p.pl.C, followers: p.pl.F, viral: p.pl.viral, ctx: p.pl.ctx }, tab: G.GR.tab }; });
    log({ test: '3. posted', ...post });
    await shot(A, '03-feed-just-posted');

    const after = await A.evaluate(() => { const G = window.__gram, g = G.gram(), p = g.posts[0], f0 = g.npcF; for (const m of [1, 2, 4, 8]) { p.pl.t0 = Date.now() - m * 60000; G.grTick(); } return { likes: p.lk, likers: p.likers, comments: p.cm.map(c => c.h + ': ' + c.t), followersGained: g.npcF - f0, activity: g.act.slice(0, 6).map(a => a.k + ' ' + (a.n || '') + ' ' + (a.h || (a.who || []).join(','))), unseen: g.unseen }; });
    log({ test: '4. the city reacts over 8 minutes', ...after });
    await A.evaluate(() => { document.getElementById('ph-screen').scrollTop = 0; window.__gram.grRefresh(); }); await A.waitForTimeout(1500); await shot(A, '04-feed-likes');
    await A.evaluate(() => { const G = window.__gram, p = G.gram().posts[0]; G.GR.view = 'post:' + p.id; G.grRefresh(); }); await A.waitForTimeout(1200);
    await A.fill('#gr-cm', 'Appreciate y\'all 🙏'); await A.evaluate(() => document.querySelector('[data-a="cm"]').click()); await A.waitForTimeout(1500); await shot(A, '05-post-comments');
    await A.evaluate(() => { const G = window.__gram; G.GR.view = null; G.GR.tab = 'act'; G.grRefresh(); }); await A.waitForTimeout(1200); await shot(A, '06-activity');

    await close(A); await A.waitForTimeout(500);
    log({ spotDiag: await A.evaluate(() => window.__gram.grSpotWhy()) });
    const spot = await A.evaluate(async () => { const G = window.__gram, ok = await G.grSpot(); const p = G.gram().feed[0]; return { ok, by: p.h, cap: p.cap, tag: p.tag, img: p.img, act: G.gram().act[0] && G.gram().act[0].k }; });
    log({ test: '5. somebody on the street posts you', ...spot });
    await openGossip(A, 'feed'); await A.evaluate(() => { document.getElementById('ph-screen').scrollTop = 0; }); await A.waitForTimeout(1500); await shot(A, '07-spotted');
    const lk = await A.evaluate(() => { const G = window.__gram, q = G.gram().feed.find(p => p.by === 'npc'); const lk0 = q.lk; G.grLike(q.id, true); return { id: q.id, before: lk0, after: q.lk, me: q.me }; });
    log({ test: '6. like an NPC post', ...lk });
    await A.evaluate(() => { const G = window.__gram; G.GR.tab = 'me'; G.GR.view = null; G.grRefresh(); }); await A.waitForTimeout(1500); await shot(A, '08-profile');
    await A.evaluate(() => window.__gram.grNew()); await A.waitForTimeout(600);
    await A.waitForSelector('[data-a="text"]'); await A.evaluate(() => document.querySelector('[data-a="text"]').click()); await A.waitForSelector('#gr-cap');
    if (await A.$('#gr-cap')) { await A.fill('#gr-cap', 'Who tryna slide to the meet tonight? 🏁'); await A.evaluate(() => document.querySelector('[data-a="share"]').click()); await A.waitForFunction(() => window.__gram.gram().posts.length > 1, null, { timeout: 120000, polling: 500 }); await A.waitForTimeout(1500); await shot(A, '08b-text-post'); }
    log({ test: '7. text post', posts: await A.evaluate(() => window.__gram.gram().posts.map(p => [p.img ? 'pic' : 'text', p.cap])) });
    await A.setViewportSize({ width: 390, height: 844 }); await A.evaluate(() => { const G = window.__gram; G.GR.tab = 'feed'; G.GR.view = null; G.grRefresh(); document.getElementById('ph-screen').scrollTop = 0; }); await A.waitForTimeout(2000); await shot(A, '09-portrait-feed');
    await A.evaluate(() => { const G = window.__gram; G.GR.tab = 'me'; G.grRefresh(); }); await A.waitForTimeout(1200); await shot(A, '10-portrait-profile');
    await A.evaluate(() => { const G = window.__gram, p = G.gram().posts[0]; p.pl.t0 = Date.now() - 30 * 60000; G.grTick(); document.querySelector('.ph-back').click(); }); await A.waitForTimeout(800);
    log({ test: '8. home badge', badge: await A.evaluate(() => { const e = document.querySelector('#ph-screen .app[data-id="gossip"] .go-badge'); return e ? e.textContent : null; }) });
    await A.setViewportSize({ width: 844, height: 390 }); await close(A); await A.waitForTimeout(800);
    const cost = await A.evaluate(() => { const G = window.__gram, t = performance.now(), c = G.grSnap(); return { snapMs: Math.round(performance.now() - t), size: c && [c.width, c.height] }; });
    log({ test: '9. street snap cost (swiftshader)', ...cost });
    log({ ERR: errs.slice(0, 12) });
  }

  if (PART === '2') {
    const A = await open('A', '?net=local'), B = await open('B', '?net=local');
    await B.evaluate(() => { window.__map.S.name = 'Lawrence'; delete window.__map.S.gram; window.__map.S.uid = 'lawrence01'; });
    for (const p of [A, B]) await p.evaluate(() => window.__net.netJoin('eastgate'));
    for (const p of [A, B]) await p.waitForFunction(() => window.__net.NET.status === 'on', null, { timeout: 120000, polling: 500 });
    for (const p of [A, B]) await p.evaluate(() => setInterval(() => { for (const q of window.__net.NET.peers.values()) q.seen = Math.max(q.seen, performance.now() / 1000 - 1); }, 200));
    for (let i = 0; i < 20; i++) { for (const p of [A, B]) await p.evaluate(() => { try { window.__net.netTick(0.1); } catch (e) {} }); await A.waitForTimeout(150); }
    log({ test: '0. both online', peersA: await A.evaluate(() => [...window.__net.NET.peers.values()].map(p => [p.name, p.uid])), peersB: await B.evaluate(() => [...window.__net.NET.peers.values()].map(p => [p.name, p.uid])) });
    const pid = await A.evaluate(async () => { const G = window.__gram, c = G.grSnap(); const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85)); const p = await G.grPublish({ blob, cap: 'Pull up to Stop Six 🏁', loc: true }); return p.id; });
    await B.waitForFunction(id => window.__gram.gram().feed.some(p => p.id === id), pid, { timeout: 120000, polling: 300 });
    await B.waitForTimeout(1500);
    const seen = await B.evaluate(async id => { const G = window.__gram, q = G.gram().feed.find(p => p.id === id); let b = null; for (let i = 0; i < 30 && !b; i++) { b = await G.grImgGet(id); if (!b) await new Promise(r => setTimeout(r, 2000)); } return { by: q.by, h: q.h, cap: q.cap, loc: q.loc, picKB: b ? Math.round(b.size / 1024) : 0 }; }, pid);
    log({ test: '1. B sees A\'s post live with the picture', pid, ...seen });
    await openGossip(B, 'feed'); await B.waitForTimeout(1500); await shot(B, '20-online-B-sees-post');
    await B.evaluate(id => { const G = window.__gram, q = G.gram().feed.find(p => p.id === id); G.grLike(id, true); G.grComment(id, 'That go hard bro 🔥'); G.grFollow(q, true); }, pid);
    await A.bringToFront(); await A.waitForFunction(id => { const p = window.__gram.gram().posts.find(p => p.id === id); return p && p.cm.some(c => c.u) && Object.keys(window.__gram.gram().rf).length; }, pid, { timeout: 90000, polling: 500 }).catch(() => log({ note: 'A still waiting on B' }));
    const got = await A.evaluate(id => { const G = window.__gram, g = G.gram(), p = g.posts.find(p => p.id === id); return { likes: p.lk, realLikers: p.ru, comments: p.cm.filter(c => c.u).map(c => c.h + ': ' + c.t), realFollowers: g.rf, activity: g.act.filter(a => a.real).map(a => a.k + ' ' + (a.h || (a.who || []).join(','))) }; }, pid);
    log({ test: '2. A gets B\'s like, comment and follow as real activity', ...got });
    await openGossip(A, 'act'); await A.waitForTimeout(1200); await shot(A, '21-online-A-activity');
    await A.evaluate(id => window.__gram.grComment(id, 'Appreciate it twin'), pid); await B.bringToFront(); await B.waitForFunction(id => window.__gram.gram().feed.find(p => p.id === id).cm.length > 1, pid, { timeout: 90000, polling: 500 }).catch(() => {});
    log({ test: '3. A answers, B sees it', onB: await B.evaluate(id => window.__gram.gram().feed.find(p => p.id === id).cm.map(c => c.h + ': ' + c.t), pid) });
    await B.close();
    const C = await open('C', '?net=local');
    await C.evaluate(() => { const S = window.__map.S; S.name = 'Tre'; delete S.gram; S.homeServer = 'glory'; S.uid = 'tttttttt'; S.crewKey = 'x'.repeat(24); });
    const fromSrv = await C.evaluate(async id => { const G = window.__gram; await G.grSync(true); const q = G.gram().feed.find(p => p.id === id); const u = q && await G.grUrl(id); return q ? { by: q.by, h: q.h, likes: q.lk, comments: q.cc, pic: !!u } : null; }, pid);
    log({ test: '4. a player who was offline sees it from the server copy', ...fromSrv });
    log({ ERR: errs.slice(0, 12) });
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
