  // ==== gossip posts (begin) ====
  // ---------- Gossip posts (2026-11-21, Kimari: "add where you can post on gossip app like instagram"). The Gossip app gets
  // a Feed, Activity and your profile next to the old News list. Post a picture from the Camera roll or straight out of
  // photo mode with a caption and your spot. The city reacts on its own clock: likes roll in, people comment about what's
  // in the picture (your car, the spot, night shots, your crew), you pick up followers, and a post can go viral and make the
  // News. Pages and locals post their own stuff too, the big gossip shows up as page posts, and now and then somebody on the
  // street snaps a picture of YOU and posts it. Online, real players on your server see your post right away and can like,
  // comment and follow you; with supabase/rfg_gram.sql run, posts also stay up for every server and for players who were
  // offline. Saved on S.gram; pictures live in IndexedDB 'mw3d-gram' (this device). ----------
  const GR = { tab: 'feed', view: null, draft: null, urls: new Map(), sql: null, t: 0, popT: 0, popTab: null, popAt: 0, spotT: 0, npcT: 0, syncT: 0, inboxT: 0, sentT: 0,
    err: 0, wire: new Map(), cam: null, busy: false, loading: new Set(), roll: [], tapT: 0, tapId: '' };
  const GR_PAGES = {
    scanner: { n: 'Fort Worth Scanner 🚨', av: '#1b4fc4', v: 1 }, cowtownstreetz: { n: 'Cowtown Streetz 🏁', av: '#e0192e', v: 1 }, murdaworthtea: { n: 'Murda Worth Tea ☕', av: '#a01aff', v: 1 },
    dfw5news: { n: 'DFW 5 News (not really)', av: '#2a7bff', v: 1 }, fortworthpd: { n: 'FWPD', av: '#0b2a6b', v: 1 }, '817eats': { n: '817 Eats 🌮', av: '#e8641a', v: 1 },
  };
  const GR_LOCALS = ['tay_on_rosedale', 'stopsix_shay', 'lilbit817', 'hemphillhoney', 'cowtowncarlos', 'northside_nae', 'dre.817', 'big_ced_fw', 'kiki_got_keys', 'jayy.boostedd',
    'mama_dunbar', 'westside_wes', 'trinity_tre', 'yolanda.817', 'boosted_benny', 'lowkey_lexx', 'stockyard_steph', 'mookie_mph', 'polytechnic_p', 'como_queen', 'lancaster_lu',
    'eastside_ej', 'bigbody_brent', 'riverside_rae', 'handley_hank', 'lil_ced.817', 'nae_nae_fw', 'tre_gotdat', 'samirah.tx', 'dj_cowtown', 'shawty_from_six', 'jdub_817',
    'ms_dorothy_fw', 'ricky_rims', 'boostedby_b', 'cash_carlos', 'kay.lancaster', 'g_money_fw', 'tink817', 'wheelie_wayne'];
  const GR_COLORS = ['#ff1a6a', '#e8641a', '#1f8f3a', '#2a7bff', '#a01aff', '#e8c21a', '#1b8fd1', '#c41b1b', '#12a39a', '#d14fb3'];
  const GR_CARDS = ['linear-gradient(135deg,#ff2d55,#8a1fd1)', 'linear-gradient(135deg,#1b4fc4,#0a1a4a)', 'linear-gradient(135deg,#f0a020,#a03a00)', 'linear-gradient(135deg,#1f8f3a,#063a18)', 'linear-gradient(135deg,#2a2c33,#08090b)', 'linear-gradient(135deg,#c41b1b,#3a0606)', 'linear-gradient(135deg,#12a39a,#073a4a)'];
  const GR_LIFE = ['Taco truck on Hemphill hitting tonight 🌮 go before they run out', 'Who tryna slide to the meet at {place} later? 🏁', 'Gas in {d} is crazy rn ⛽😭', 'Fort Worth weather bipolar fr ☀️🌧', 'Selling my {car}, clean title, runs good. DM me 💯',
    'Stockyards on a Friday >>>', 'Need a plug for some rims, 22s or bigger. Who got em?', 'Sunset over downtown different today 🌇', 'Who got the loudest car in {d}? Pull up, I\'ll wait.', 'Just got my car back from the shop and it\'s ALREADY making noises 😭',
    'Rent due and I\'m at the mall. Make it make sense 🛍', 'If you see a white Charger with no plates in {d}, that\'s my cousin. Leave him alone 😂', 'Woke up, chose peace. Then I got on I-30 🙃', 'Whoever parked at {place} with the music up, I felt that in my chest 🔊',
    'Somebody come get their dog off Lancaster 🐕', 'Big Mama cooking Sunday, don\'t ask me for nothing till Monday 🍗', 'New wrap coming soon 👀 guess the color', 'Twelve deep on the east side tonight, drive careful y\'all 🚓',
    'They opening a new spot on Magnolia, who been?', 'Car wash then the meet. That\'s the whole plan today 🧽', '{d} at night got a vibe you can\'t explain', 'Who wanna run it on the strip this weekend? Bring cash 💸'];
  const GR_SPOT_CAR = ['Seen this {car} in {d} 👀 who is this?? @{me}', '{car} on the street in {d} looking crazy 😮‍💨', 'Somebody tell me who owns this {car} in {d}', 'This {car} just pulled up by me in {d}. Clean. 🔥', 'Spotted @{me} in the {car} in {d}. Y\'all see this??'];
  const GR_SPOT_FOOT = ['Is that @{me} walking through {d}?? 👀', 'Caught @{me} out in {d} today 📸', '@{me} out here in {d} like it\'s nothing', 'Ran into @{me} in {d}. Real one fr 💯', 'Not @{me} in {d} looking for trouble 😭'];
  const GR_GOOD = ['🔥🔥🔥', 'Hard 😤', 'Different breed', 'Tell em', 'GOAT behavior 🐐', 'Murda Worth stand UP', 'This go crazy', 'Heat 🔥', 'Clean af', 'Big mood', 'Ok I see you 👀', 'Yessir 💯', 'W', 'Too hard', 'Pull up to the meet tonight', 'Main character energy', 'Who took this? Fire', 'Love this 😍', 'Facts', 'Ayyy 🙌'];
  const GR_HATE = ['Mid 😂', 'Who is this', 'Ok and?', 'Posting for likes 💀', 'Your car slow tho', 'Bro thinks he famous 😭', 'Fake flex', 'L'];
  const GR_CAR = ['That {car} hard 🔥', '{car} clean af', 'What rims are those?', 'Need a ride in that {car}', 'How much for the {car}?', 'What you got under the hood?', '{car} sounds crazy in person', 'Tint level?? 👀', 'Bet I smoke that {car} 😂'];
  const GR_PLACE = ['{d} stand up 🙌', 'Where in {d} is this?', 'I was just at {place}!', 'That\'s my side of town', '{d} don\'t play', 'Hold on, I know exactly where this is 😂'];
  const GR_NIGHT = ['Night shots hit different 🌙', 'The lighting 😮‍💨', 'Up late huh 👀', 'City lights >>>'];
  const GR_CREW = ['The squad 💯', 'Who\'s that with you?', 'Gang 🤞', 'Y\'all deep 😂', 'Squad goals'];
  const GR_CAPS = [[/race|run it|won|smoke|strip|drag/i, ['Run it back 🏁', 'Who you beat?', 'Clip or it didn\'t happen', 'I got next']], [/money|cash|bag|rich|\$/i, ['Money talk 💸', 'Bag secured', 'Put me on 🙏']],
    [/\bfit\b|drip|outfit|fresh/i, ['Fit hard 😮‍💨', 'Drip check passed ✅', 'Where you get that?']], [/stop ?six|east ?side|como|poly/i, ['Stop Six stand up 🙌', 'East side!!', 'Hood certified']],
    [/love|bae|baby|wife|girl/i, ['Cute 🥹', 'Awww', 'Couple goals']], [/god|bless|grateful|thankful/i, ['🙏🙏', 'Blessed fr', 'Amen']]];
  const GR_REPLY = ['Facts 💯', 'Fr fr', '😂😂', 'Appreciate you', 'Say less', 'You already know', '🙏', 'Bet', 'Lmaooo', 'Real'];
  const grPick = a => a[Math.floor(Math.random() * a.length)];
  const grText = (t, n) => String(t == null ? '' : t).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  const grHandleOf = n => { let h = String(n || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9._]/g, '').replace(/^[._]+|[._]+$/g, '').slice(0, 18); if (h.length < 3) h = (h || 'racer') + '817'; return h; };
  const grCleanH = h => (String(h || '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24) || 'racer');
  const grColor = h => GR_COLORS[[...String(h)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % GR_COLORS.length];
  const grFill = (t, c) => t.replace(/\{car\}/g, c.car || 'whip').replace(/\{d\}/g, c.d || 'Fort Worth').replace(/\{place\}/g, c.place || c.d || 'the gas station').replace(/\{me\}/g, gram().h);
  const grNum = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : Number(n || 0).toLocaleString();
  const grAgo = t => { const m = Math.round((Date.now() - (t || Date.now())) / 60000); return m < 1 ? 'just now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : Math.round(m / 1440) + 'd'; };
  const grId = () => netMe().uid + '_' + Date.now().toString(36);
  const grIdOk = id => typeof id === 'string' && /^[a-z0-9]{6,16}_[a-z0-9]{6,10}$/.test(id);
  const grNpcH = () => grPick(GR_LOCALS);
  function gram() {
    const g = S.gram || (S.gram = {});
    if (!g.h) g.h = grHandleOf(S.name);
    if (g.bio == null) g.bio = ''; if (g.npcF == null) g.npcF = 18 + Math.floor(Math.random() * 25) + Math.min(400, Math.round((S.rep || 0) * 0.6));
    g.rf = g.rf || {}; g.fw = g.fw || {}; g.posts = g.posts || []; g.feed = g.feed || []; g.act = g.act || []; g.unseen = g.unseen || 0; g.lastPost = g.lastPost || 0; g.since = g.since || 0;
    return g;
  }
  const grFollowers = () => gram().npcF + Object.keys(gram().rf).length;
  const grFind = id => { const g = gram(); return g.posts.find(p => p.id === id) || g.feed.find(p => p.id === id) || null; };
  const grMineId = id => gram().posts.some(p => p.id === id);

  // ---------- pictures: IndexedDB on this device; object URLs while the phone shows them ----------
  const GDB = { db: null, pruneT: 0 };
  function gdb() {
    if (GDB.db) return Promise.resolve(GDB.db);
    return new Promise((res, rej) => { try { const r = indexedDB.open('mw3d-gram', 1); r.onupgradeneeded = () => r.result.createObjectStore('i', { keyPath: 'id' }); r.onsuccess = () => res(GDB.db = r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
  }
  const gTx = (mode, fn) => gdb().then(db => new Promise((res, rej) => { const tx = db.transaction('i', mode), rq = fn(tx.objectStore('i')); tx.oncomplete = () => res(rq ? rq.result : undefined); tx.onerror = () => rej(tx.error); }));
  const grImgGet = id => gTx('readonly', st => st.get(id)).then(r => (r ? r.blob : null)).catch(() => null);
  const grImgDel = id => gTx('readwrite', st => st.delete(id)).catch(() => {});
  async function grImgPut(id, blob) {
    try { await gTx('readwrite', st => st.put({ id, blob, at: Date.now() })); } catch (e) { return false; }
    if (Date.now() - GDB.pruneT > 60000) { GDB.pruneT = Date.now(); setTimeout(grPrune, 15000); }   // later: the post it belongs to isn't saved yet
    return true;
  }
  async function grPrune() {
    try { const g = gram(), keep = new Set([...g.posts, ...g.feed].map(p => p.id)), keys = await gTx('readonly', st => st.getAllKeys()); for (const k of keys || []) if (!keep.has(k)) await grImgDel(k); } catch (e) {}
  }
  // fit a picture: no wider than 1.91:1 or taller than 4:5, like the real app, then shrink it
  async function grShrink(blob, maxW, q) {
    let bmp = null, url = null;
    try { bmp = await createImageBitmap(blob); } catch (e) { url = URL.createObjectURL(blob); bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; }); }
    const w = bmp.width, h = bmp.height; let sx = 0, sy = 0, sw = w, sh = h;
    if (sw / sh > 1.91) { sw = Math.round(sh * 1.91); sx = (w - sw) >> 1; } else if (sh / sw > 1.25) { sh = Math.round(sw * 1.25); sy = (h - sh) >> 1; }
    const k = Math.min(1, maxW / sw), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
    c.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
    if (url) URL.revokeObjectURL(url); if (bmp.close) bmp.close();
    const out = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
    return { c, blob: out };
  }
  const grUrlFromData = async d => { try { return await (await fetch(d)).blob(); } catch (e) { return null; } };
  async function grUrl(id) {
    if (GR.urls.has(id)) return GR.urls.get(id);
    let b = await grImgGet(id);
    if (!b) { const p = grFind(id); if (p && p.by === 'net' && GR.sql) { try { const d = await grRpc('rfg_gram_img', { p_id: id }); if (typeof d === 'string' && d.startsWith('data:image/jpeg;base64,')) { b = await grUrlFromData(d); if (b) grImgPut(id, b); } } catch (e) {} } }
    if (!b) return null;
    if (GR.urls.size > 90) { for (const u of GR.urls.values()) URL.revokeObjectURL(u); GR.urls.clear(); }
    const u = URL.createObjectURL(b); GR.urls.set(id, u); return u;
  }
  function grHydrate(root) {
    root.querySelectorAll('img[data-img]').forEach(im => { const id = im.dataset.img; grUrl(id).then(u => { if (u) { im.src = u; im.closest('.gr-media') && im.closest('.gr-media').classList.remove('wait'); } else im.closest('.gr-media') && im.closest('.gr-media').classList.add('gone'); }); });
  }

  // ---------- the server (supabase/rfg_gram.sql) ----------
  // ?net=local keeps it in this browser so two tabs can test it, like the friends mailbox
  async function grRpc(fn, args) {
    if (typeof NET_LOCAL !== 'undefined' && NET_LOCAL) return grLocalRpc(fn, args);
    if (GR.sql === false) throw new Error('no gram server');
    try { const r = await netRpc(fn, args); GR.sql = true; return r; }
    catch (e) { if (/Could not find the function|does not exist|\(404\)|PGRST202/i.test(e.message || '')) GR.sql = false; throw e; }
  }
  function grLocalRpc(fn, a) {
    const K = 'rfg-localgram3d', d = (() => { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } })();
    d.posts = d.posts || []; d.likes = d.likes || []; d.cms = d.cms || []; d.fol = d.fol || [];
    const now = new Date().toISOString(); let out = null;
    if (fn === 'rfg_gram_post') { if (!d.posts.some(p => p.id === a.p_id)) d.posts.unshift({ id: a.p_id, uid: a.p_uid, name: frClean(S.name), handle: grCleanH(a.p_handle), cap: grText(a.p_cap, 300), loc: grText(a.p_loc, 60), img: a.p_img || null, at: now }); d.posts.length = Math.min(d.posts.length, 40); out = true; }
    else if (fn === 'rfg_gram_delete') { d.posts = d.posts.filter(p => !(p.id === a.p_id && p.uid === a.p_uid)); out = true; }
    else if (fn === 'rfg_gram_feed') out = d.posts.map(p => ({ id: p.id, uid: p.uid, name: p.name, handle: p.handle, cap: p.cap, loc: p.loc, has_img: !!p.img, at: p.at, likes: d.likes.filter(l => l.post_id === p.id).length, comments: d.cms.filter(c => c.post_id === p.id).length, liked: d.likes.some(l => l.post_id === p.id && l.uid === a.p_uid) }));
    else if (fn === 'rfg_gram_img') { const p = d.posts.find(p => p.id === a.p_id); out = p ? p.img : null; }
    else if (fn === 'rfg_gram_like') { d.likes = d.likes.filter(l => !(l.post_id === a.p_id && l.uid === a.p_uid)); if (a.p_on) d.likes.push({ post_id: a.p_id, uid: a.p_uid, handle: grCleanH(a.p_handle), at: now }); out = d.likes.filter(l => l.post_id === a.p_id).length; }
    else if (fn === 'rfg_gram_comment') { if (!d.cms.some(c => c.id === a.p_cid)) d.cms.push({ id: a.p_cid, post_id: a.p_id, uid: a.p_uid, handle: grCleanH(a.p_handle), body: grText(a.p_body, 240), at: now }); out = true; }
    else if (fn === 'rfg_gram_comments') out = d.cms.filter(c => c.post_id === a.p_id);
    else if (fn === 'rfg_gram_follow') { d.fol = d.fol.filter(f => !(f.uid === a.p_uid && f.who === a.p_who)); if (a.p_on) d.fol.push({ uid: a.p_uid, who: a.p_who, handle: grCleanH(a.p_handle), at: now }); out = true; }
    else if (fn === 'rfg_gram_inbox') {
      const mine = new Set(d.posts.filter(p => p.uid === a.p_uid).map(p => p.id)), since = a.p_since;
      out = [...d.likes.filter(l => mine.has(l.post_id) && l.uid !== a.p_uid && l.at > since).map(l => ({ kind: 'like', uid: l.uid, handle: l.handle, post_id: l.post_id, at: l.at })),
        ...d.cms.filter(c => mine.has(c.post_id) && c.uid !== a.p_uid && c.at > since).map(c => ({ kind: 'comment', uid: c.uid, handle: c.handle, post_id: c.post_id, cid: c.id, body: c.body, at: c.at })),
        ...d.fol.filter(f => f.who === a.p_uid && f.at > since).map(f => ({ kind: 'follow', uid: f.uid, handle: f.handle, at: f.at }))];
    }
    try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {}
    return Promise.resolve(out);
  }
  const grCanSql = () => !!(S.homeServer && S.uid && S.crewKey) && GR.sql !== false;
  function grSql(fn, args) { if (!grCanSql()) return Promise.resolve(null); const me = netMe(); return grRpc(fn, { p_uid: me.uid, p_tok: me.tok, ...args }).catch(e => { if (!GR.err) { GR.err = 1; console.warn('gram', fn, e.message); } return null; }); }

  // ---------- what's in the picture, for the comments ----------
  function grCtx() {
    const x = foot.on ? foot.x : drv.x, z = foot.on ? foot.z : drv.z, pl = placeNear(x, z, 90);
    const nearCar = !!(S.car && (!foot.on || (foot.park && Math.hypot(foot.park.x - x, foot.park.z - z) < 25)));
    let crew = 0; if (netOn()) for (const p of NET.peers.values()) if (!p.fresh && Math.hypot(p.x - x, p.z - z) < 40) crew++;
    return { d: districtAt(x, z) || regionAt(x, z) || 'Fort Worth', place: pl ? goShort(pl.name) : '', car: nearCar ? carOf(S.car.id).model : '', night: timeName === 'night', crew, at: Date.now() };
  }

  // ---------- activity: likes stack up into one line per post, comments and follows get their own ----------
  function grAct(a, pop) {
    const g = gram(); a.at = a.at || Date.now();
    if (a.k === 'lk') { const o = g.act.find(x => x.k === 'lk' && x.pid === a.pid && !!x.real === !!a.real && Date.now() - x.at < 120000); if (o) { o.n += a.n; o.who = [...new Set([...a.who, ...o.who])].slice(0, 2); o.at = a.at; g.act.splice(g.act.indexOf(o), 1); g.act.unshift(o); save(); return; } }
    if (a.k === 'fl') { const o = g.act.find(x => x.k === 'fl' && !x.real && !a.real && Date.now() - x.at < 300000); if (o) { o.n += a.n; o.at = a.at; g.act.splice(g.act.indexOf(o), 1); g.act.unshift(o); save(); return; } }
    g.act.unshift(a); g.act.length = Math.min(g.act.length, 60); g.unseen++; save();
    if (pop) grPop(a);
  }
  const grActText = a => a.k === 'lk' ? `<b>${esc(a.who[0] || 'Somebody')}</b>${a.n > 1 ? (a.who[1] && a.n === 2 ? ` and <b>${esc(a.who[1])}</b>` : ` and ${grNum(a.n - 1)} others`) : ''} liked your post.`
    : a.k === 'cm' ? `<b>${esc(a.h)}</b> commented: ${esc(a.t)}` : a.k === 'fl' ? (a.real ? `<b>${esc(a.h)}</b> started following you.` : `${grNum(a.n)} new ${a.n > 1 ? 'people' : 'person'} followed you.`)
    : a.k === 'tag' ? `<b>${esc(a.h)}</b> posted a picture of you.` : a.k === 'rp' ? `<b>${esc(a.h)}</b> replied: ${esc(a.t)}` : a.k === 'vr' ? `Your post is going viral 🔥 ${grNum(a.n)} likes.` : esc(a.t || '');
  function grPop(a) {
    const now = Date.now(); if (!gossip().pops || now - GR.popT < 25000 || PH.open && PH.app === 'gossip') return;
    GR.popT = now; GR.popTab = a.k === 'tag' ? 'feed' : 'act'; GR.popAt = now;
    const tmp = document.createElement('div'); tmp.innerHTML = grActText(a);
    goPop(a.k === 'lk' ? '❤️' : a.k === 'cm' || a.k === 'rp' ? '💬' : a.k === 'fl' ? '👤' : a.k === 'tag' ? '📸' : '🔥', 'Gossip', tmp.textContent, 'gossip');
  }

  // ---------- your post goes up: how the city takes it ----------
  function grPlan(p, ctx) {
    const f = grFollowers(); let L = f * (0.1 + Math.random() * 0.16) + 2 + Math.random() * 5;
    if (p.img) L *= 1.6; if (p.cap.length > 3) L *= 1.08; if (/#\w/.test(p.cap)) L *= 1.12; if (ctx.night) L *= 1.1; if (ctx.car) L *= 1.25; if (ctx.crew) L *= 1 + Math.min(3, ctx.crew) * 0.12;
    if ((Date.now() - (gram().lastPost || 0)) / 60000 < 3) L *= 0.55;   // three posts in a row and people scroll past
    L *= 1 + Math.min(1.5, (S.rep || 0) / 400);
    const viral = Math.random() < 0.05 + (ctx.car ? 0.02 : 0) + (ctx.crew ? 0.02 : 0); if (viral) L *= 4 + Math.random() * 5;
    L = Math.max(3, Math.round(L));
    return { L, C: Math.max(1, Math.min(40, Math.round(L * (0.05 + Math.random() * 0.05)))), F: Math.round(L * (0.03 + Math.random() * 0.05)) + (viral ? 12 + Math.floor(Math.random() * 30) : 0), t0: Date.now(), gl: 0, gc: 0, gf: 0, viral, ctx };
  }
  function grNpcComment(p, ctx) {
    ctx = ctx || (p.pl && p.pl.ctx) || {};
    const pools = [[GR_GOOD, 5]];
    if (ctx.car) pools.push([GR_CAR, 4]); if (ctx.d) pools.push([GR_PLACE, 2]); if (ctx.night) pools.push([GR_NIGHT, 1.5]); if (ctx.crew) pools.push([GR_CREW, 2.5]);
    for (const [re, l] of GR_CAPS) if (re.test(p.cap || '')) pools.push([l, 3]);
    if (Math.random() < 0.1) pools.push([GR_HATE, 6]);
    let r = Math.random() * pools.reduce((a, x) => a + x[1], 0), pool = pools[0][0]; for (const [l, w] of pools) { if ((r -= w) <= 0) { pool = l; break; } }
    let h = grNpcH(), t = grFill(grPick(pool), ctx);
    // your opps keep tabs on you
    const opp = S.hood && S.hood.opps && S.hood.opps[0]; if (opp && Math.random() < 0.06) { h = grHandleOf(opp.name || 'opp_block') ; t = grPick([`Keep posting your location 👀`, `We see you in ${ctx.d || 'the city'}`, `Enjoy it while it last 😂`]); }
    return { id: 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), h, t, at: Date.now() };
  }
  async function grPublish(d) {
    const g = gram(), me = netMe(), ctx = d.ctx || grCtx(), id = grId();
    let wire = null;
    if (d.blob) {
      const big = await grShrink(d.blob, 1080, 0.86); if (!(await grImgPut(id, big.blob || d.blob))) { toast('Could not keep the picture on this phone.', 'bad'); return null; }
      const sm = await grShrink(d.blob, 420, 0.6); wire = sm.c.toDataURL('image/jpeg', 0.6); if (wire.length > 150000) wire = sm.c.toDataURL('image/jpeg', 0.4);
    }
    const p = { id, by: 'me', u: me.uid, n: me.name, h: g.h, av: grColor(g.h), at: Date.now(), cap: grText(d.cap, 300), loc: d.loc ? ctx.place || ctx.d : '', img: !!d.blob, card: d.blob ? null : d.card || grPick(GR_CARDS), lk: 0, likers: [], cm: [], ru: {} };
    p.pl = grPlan(p, ctx);
    g.posts.unshift(p); for (const q of g.posts.splice(60)) grImgDel(q.id);
    g.lastPost = Date.now(); save();
    if (wire) { GR.wire.set(id, wire); if (GR.wire.size > 3) GR.wire.delete(GR.wire.keys().next().value); }
    if (netOn()) netSend({ k: 'gp', p: grWireOf(p), img: wire || undefined });
    grSql('rfg_gram_post', { p_id: id, p_handle: g.h, p_cap: p.cap, p_loc: p.loc, p_img: wire });
    return p;
  }
  const grWireOf = p => ({ id: p.id, h: p.h, n: p.n, cap: p.cap, loc: p.loc, at: p.at, img: p.img ? 1 : 0, card: p.card || undefined });
  function grDelete(id) {
    const g = gram(), i = g.posts.findIndex(p => p.id === id); if (i < 0) return;
    g.posts.splice(i, 1); g.act = g.act.filter(a => a.pid !== id); grImgDel(id); save();
    if (netOn()) netSend({ k: 'gx', pid: id }); grSql('rfg_gram_delete', { p_id: id });
  }

  // ---------- the city posts too ----------
  function grNpcPost(o) {
    const g = gram(), ctx = o.ctx || grCtx(), h = o.h || grNpcH(), pg = GR_PAGES[h];
    const p = { id: o.id || 'n_' + Date.now().toString(36) + Math.floor(Math.random() * 1e3), by: 'npc', h, n: pg ? pg.n : h, av: pg ? pg.av : grColor(h), v: pg ? 1 : 0, at: Date.now(), cap: grText(o.cap, 300), loc: o.loc || '',
      img: !!o.img, card: o.img ? null : o.card || grPick(GR_CARDS), cardText: o.cardText || '', lk: o.lk != null ? o.lk : Math.round((pg ? 120 : 6) + Math.random() * (pg ? 900 : 140)), likers: [], cm: [], me: false, tag: !!o.tag };
    const nc = o.nc != null ? o.nc : Math.floor(Math.random() * 4);
    for (let i = 0; i < nc; i++) p.cm.push(grNpcComment(p, ctx));
    if (o.tag) p.cm.push({ id: 'n' + Date.now().toString(36) + 't', h: grNpcH(), t: `That's @${g.h}!! 😂`, at: Date.now() });
    g.feed.unshift(p); for (const q of g.feed.splice(50)) if (q.img) grImgDel(q.id);
    save(); return p;
  }
  function grNpcLife() { const c = grCtx(); const t = grFill(grPick(GR_LIFE), { ...c, car: grPick(['Charger', 'Caprice', 'Tahoe', 'Camaro', 'Mustang', 'F-150', 'Impala', 'Challenger']) }); return grNpcPost({ cap: t, cardText: t, loc: Math.random() < 0.5 ? c.d : '' }); }
  // big gossip shows up as a post from one of the pages
  const _grAddGossip = addGossip;
  addGossip = function (it) {
    const item = _grAddGossip.apply(this, arguments);
    try { if (item && S && /news|rumor|tip/.test(item.kind || '') && Math.random() < 0.55) { const h = item.kind === 'tip' ? grPick(['scanner', 'fortworthpd']) : item.kind === 'news' ? grPick(['dfw5news', 'scanner', 'cowtownstreetz']) : 'murdaworthtea'; grNpcPost({ h, cap: item.text, cardText: `${item.icon || ''} ${item.text}`.trim(), nc: 1 + Math.floor(Math.random() * 3) }); } } catch (e) {}
    return item;
  };

  // ---------- somebody on the street snaps you ----------
  function grSpotWhy() { return { S: !!S, worldOn, driving, inside, creating, menu: !!menuFn, ph: PH.open, pm: !!(window.__photo && window.__photo.PM.on), roll: ROLL.on, strip: STRIP.on, hid: document.hidden }; }
  function grSpotOk() { return !!(S && worldOn && driving && !inside && !creating && !menuFn && !PH.open && !(window.__photo && window.__photo.PM.on) && !ROLL.on && !STRIP.on && !document.hidden); }
  function grSnap() {
    const tg = foot.on ? foot.holder.position : car ? car.position : null; if (!tg) return null;
    const src = renderer.domElement, W = src.width, H = src.height; if (!W || !H) return null;
    const cam = GR.cam || (GR.cam = new THREE.PerspectiveCamera(50, 1, 0.25, 2500)), T = window.__guns && window.__guns.test, sol = T && T.solids;
    let best = null;
    for (let k = 0; k < 10 && !best; k++) {
      const a = Math.random() * Math.PI * 2, d = (foot.on ? 5 : 8) + Math.random() * 5, x = tg.x + Math.sin(a) * d, z = tg.z + Math.cos(a) * d;
      const inB = sol && sol.at && sol.at(x, z).some(b => x > b.x0 - 0.5 && x < b.x1 + 0.5 && z > b.z0 - 0.5 && z < b.z1 + 0.5);
      if (!inB) best = [x, z];
    }
    if (!best) return null;
    const gy = T && T.groundAt ? T.groundAt(best[0], best[1]) : tg.y;
    cam.aspect = W / H; cam.fov = foot.on ? 42 : 48; cam.updateProjectionMatrix();
    cam.position.set(best[0], (isFinite(gy) ? gy : 0) + 1.55, best[1]); cam.lookAt(tg.x, tg.y + (foot.on ? 1.0 : 0.8), tg.z);
    const vis = ME && ME.wrap ? ME.wrap.visible : null; if (ME && ME.wrap && foot.on) ME.wrap.visible = true;
    renderer.render(scene, cam);
    const cw = Math.min(W, Math.round(H * 0.8)), out = document.createElement('canvas'); out.width = 432; out.height = 540;
    out.getContext('2d').drawImage(src, (W - cw) >> 1, 0, cw, H, 0, 0, 432, 540);
    if (vis !== null) ME.wrap.visible = vis;
    renderer.render(scene, camera);   // put the real frame back before the browser shows the canvas
    return out;
  }
  async function grSpot() {
    if (!grSpotOk()) return false;
    let c; try { c = grSnap(); } catch (e) { return false; } if (!c) return false;
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8)); if (!blob) return false;
    const ctx = grCtx(), h = grNpcH(), id = 'n_' + Date.now().toString(36) + 's';
    const cap = grFill(grPick(foot.on || !S.car ? GR_SPOT_FOOT : GR_SPOT_CAR), { ...ctx, car: S.car ? carOf(S.car.id).model : 'car' });
    if (!(await grImgPut(id, blob))) return false;
    grNpcPost({ id, h, cap, img: true, loc: ctx.place || ctx.d, ctx, tag: true, nc: 1 + Math.floor(Math.random() * 3), lk: Math.round(20 + Math.random() * 120 + grFollowers() * 0.2) });
    gram().npcF += 1 + Math.floor(Math.random() * 6);
    grAct({ k: 'tag', h, pid: id }, true);
    return true;
  }

  // ---------- online: real players on your server ----------
  function grPeerPost(p, m) {
    const w = m.p; if (!w || typeof w !== 'object' || !grIdOk(w.id) || grMineId(w.id)) return;
    const uid = p.uid || w.id.split('_')[0]; if (w.id.split('_')[0] !== uid) return;
    const g = gram(); if (g.feed.some(q => q.id === w.id)) return;
    const h = grCleanH(w.h), q = { id: w.id, by: 'net', u: uid, n: nName(w.n || p.name), h, av: grColor(h), at: Math.min(Date.now(), +w.at || Date.now()), cap: grText(w.cap, 300), loc: grText(w.loc, 60), img: !!w.img, card: !w.img && typeof w.card === 'string' && /^linear-gradient\([#\w,(). %-]{0,120}\)$/.test(w.card) ? w.card : !w.img ? GR_CARDS[0] : null, lk: 0, likers: [], cm: [], ru: {}, me: false };
    g.feed.unshift(q); for (const x of g.feed.splice(50)) if (x.img) grImgDel(x.id); save();
    if (q.img && typeof m.img === 'string' && m.img.length < 160000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(m.img)) grUrlFromData(m.img).then(b => b && grImgPut(q.id, b).then(() => grRefresh()));
    if (Date.now() - q.at < 600000) { const fol = g.fw[uid] || frOf(uid); if (fol || Math.random() < 0.5) { const now = Date.now(); if (gossip().pops && now - GR.popT > 20000 && !(PH.open && PH.app === 'gossip')) { GR.popT = now; GR.popTab = 'feed'; GR.popAt = now; goPop('📲', 'Gossip', `@${h} just posted${q.cap ? ': ' + q.cap.slice(0, 60) : ''}`, 'gossip'); } } }
    grRefresh();
  }
  function grPeerLike(p, m) {
    if (!grIdOk(m.pid) || !p.uid) return; const q = grFind(m.pid); if (!q) return;
    q.ru = q.ru || {}; const had = !!q.ru[p.uid], h = grCleanH(m.h);
    if (m.on && !had) { q.ru[p.uid] = h; q.lk++; q.likers = [h, ...q.likers.filter(x => x !== h)].slice(0, 6); if (q.by === 'me') grAct({ k: 'lk', pid: q.id, n: 1, who: [h], real: 1 }, true); }
    else if (!m.on && had) { delete q.ru[p.uid]; q.lk = Math.max(0, q.lk - 1); }
    save(); grRefresh();
  }
  function grPeerComment(p, m) {
    if (!grIdOk(m.pid) || !p.uid || typeof m.cid !== 'string' || !m.cid.startsWith(p.uid + '_')) return; const q = grFind(m.pid); if (!q) return;
    const t = grText(m.t, 240); if (!t || q.cm.some(c => c.id === m.cid)) return;
    const h = grCleanH(m.h); q.cm.push({ id: m.cid, h, t, at: Date.now(), u: p.uid }); if (q.cm.length > 60) q.cm.splice(0, q.cm.length - 60); q.cc = Math.max(q.cc || 0, q.cm.length);
    if (q.by === 'me') grAct({ k: 'cm', pid: q.id, h, t, real: 1 }, true);
    save(); grRefresh();
  }
  function grPeerFollow(p, m) {
    if (!p.uid || m.to !== S.uid) return; const g = gram(), h = grCleanH(m.h);
    if (m.on && !g.rf[p.uid]) { g.rf[p.uid] = h; grAct({ k: 'fl', h, n: 1, real: 1 }, true); }
    else if (!m.on && g.rf[p.uid]) delete g.rf[p.uid];
    save(); grRefresh();
  }
  NET_HOOK.recv.push((p, m) => {
    if (!S || !m || typeof m.k !== 'string' || m.k[0] !== 'g' || m.k.length !== 2) return;
    try {
      if (m.k === 'gp') grPeerPost(p, m);
      else if (m.k === 'gl') grPeerLike(p, m);
      else if (m.k === 'gc') grPeerComment(p, m);
      else if (m.k === 'gf') grPeerFollow(p, m);
      else if (m.k === 'gx' && grIdOk(m.pid) && p.uid && m.pid.startsWith(p.uid + '_')) { const g = gram(), i = g.feed.findIndex(q => q.id === m.pid); if (i >= 0) { g.feed.splice(i, 1); grImgDel(m.pid); save(); grRefresh(); } }
    } catch (e) { if (!GR.err) { GR.err = 1; console.warn('gram recv', e); } }
  });
  function grResend() {
    const now = Date.now(); if (now - GR.sentT < 45000 || !netOn()) return; GR.sentT = now;
    const mine = gram().posts.filter(p => now - p.at < 6 * 3600000).slice(0, 2);
    mine.forEach((p, i) => setTimeout(() => { if (netOn()) netSend({ k: 'gp', p: grWireOf(p), img: GR.wire.get(p.id) }); }, 600 + i * 900));
  }
  // a new face on the server asks once
  { let seen = new Set(); NET_HOOK.recv.push((p, m) => { if (m && m.k === 'h' && !seen.has(p.id)) { seen.add(p.id); if (seen.size > 200) seen = new Set(); setTimeout(grResend, 1500 + Math.random() * 2000); } }); }

  // likes, comments and follows you make
  function grLike(id, on) {
    const q = grFind(id); if (!q) return;
    if (on == null) on = !q.me; if (!!q.me === on) return;
    q.me = on; q.lk = Math.max(0, q.lk + (on ? 1 : -1)); if (on) q.likers = [gram().h, ...q.likers.filter(h => h !== gram().h)].slice(0, 6); save();
    if (q.by === 'net' || q.by === 'me') { if (netOn()) netSend({ k: 'gl', pid: id, on: on ? 1 : 0, h: gram().h }); grSql('rfg_gram_like', { p_id: id, p_handle: gram().h, p_on: on }); }
  }
  function grComment(id, text) {
    const q = grFind(id), t = grText(text, 240); if (!q || !t) return false;
    const cid = grId(); q.cm.push({ id: cid, h: gram().h, t, at: Date.now(), mine: 1 }); q.cc = (q.cc || 0) + 1; save();
    if (q.by === 'net' || q.by === 'me') { if (netOn()) netSend({ k: 'gc', pid: id, cid, t, h: gram().h }); grSql('rfg_gram_comment', { p_cid: cid, p_id: id, p_handle: gram().h, p_body: t }); }
    // the person (or page) answers you sometimes; on your own post, somebody answers you
    if (q.by === 'npc' || q.by === 'me') {
      const who = q.by === 'npc' ? q.h : (q.cm.filter(c => !c.mine && !c.u).slice(-1)[0] || {}).h;
      if (who && Math.random() < (q.by === 'npc' ? 0.45 : 0.3)) setTimeout(() => { if (!S || !grFind(id)) return; const r = { id: 'n' + Date.now().toString(36) + 'r', h: who, t: `@${gram().h} ${grPick(GR_REPLY)}`, at: Date.now() }; q.cm.push(r); save(); grAct({ k: 'rp', pid: id, h: who, t: r.t }, true); grRefresh(); }, 6000 + Math.random() * 20000);
    }
    return true;
  }
  function grFollow(q, on) {
    const g = gram(); if (q.by === 'net') { if (on) g.fw[q.u] = q.h; else delete g.fw[q.u]; if (netOn()) netSend({ k: 'gf', to: q.u, on: on ? 1 : 0, h: g.h }); grSql('rfg_gram_follow', { p_who: q.u, p_handle: g.h, p_on: on }); }
    else { const k = 'n:' + q.h; if (on) g.fw[k] = q.h; else delete g.fw[k]; }
    save();
  }
  const grFollowing = q => !!gram().fw[q.by === 'net' ? q.u : 'n:' + q.h];

  // ---------- the server: posts from every server, and what happened while you were away ----------
  async function grSync(force) {
    if (!grCanSql() || GR.busy) return; const now = Date.now();
    if (!force && now - GR.syncT < (PH.open && PH.app === 'gossip' ? 40000 : 150000)) return;
    GR.busy = true; GR.syncT = now;
    try {
      const me = netMe(), g = gram(), rows = await grRpc('rfg_gram_feed', { p_uid: me.uid, p_limit: 40 });
      if (Array.isArray(rows)) for (const r of rows) {
        if (!grIdOk(r.id) || r.uid === me.uid) { const mp = g.posts.find(p => p.id === r.id); if (mp && r.likes != null) mp.srvLk = r.likes; continue; }
        let q = g.feed.find(p => p.id === r.id); const h = grCleanH(r.handle);
        if (!q) { q = { id: r.id, by: 'net', u: r.uid, n: nName(r.name), h, av: grColor(h), at: Math.min(now, Date.parse(r.at) || now), cap: grText(r.cap, 300), loc: grText(r.loc, 60), img: !!r.has_img, card: r.has_img ? null : GR_CARDS[0], lk: 0, likers: [], cm: [], ru: {}, me: false }; g.feed.push(q); }
        q.lk = Math.max(+r.likes || 0, q.me ? 1 : 0); q.cc = +r.comments || 0; q.me = !!r.liked;
      }
      g.feed.sort((a, b) => b.at - a.at); for (const x of g.feed.splice(50)) if (x.img) grImgDel(x.id);
      const since = new Date(g.since || now - 86400000).toISOString(), inbox = await grRpc('rfg_gram_inbox', { p_uid: me.uid, p_tok: me.tok, p_since: since });
      if (Array.isArray(inbox)) for (const n of inbox) {
        const at = Date.parse(n.at) || now; g.since = Math.max(g.since || 0, at); const h = grCleanH(n.handle), q = n.post_id && g.posts.find(p => p.id === n.post_id);
        if (n.kind === 'like' && q) { q.ru = q.ru || {}; if (!q.ru[n.uid]) { q.ru[n.uid] = h; q.lk++; q.likers = [h, ...q.likers.filter(x => x !== h)].slice(0, 6); grAct({ k: 'lk', pid: q.id, n: 1, who: [h], real: 1, at }); } }
        else if (n.kind === 'comment' && q && !q.cm.some(c => c.id === n.cid)) { const t = grText(n.body, 240); q.cm.push({ id: n.cid, h, t, at, u: n.uid }); grAct({ k: 'cm', pid: q.id, h, t, real: 1, at }); }
        else if (n.kind === 'follow' && !g.rf[n.uid]) { g.rf[n.uid] = h; grAct({ k: 'fl', h, n: 1, real: 1, at }); }
      }
      save(); grRefresh();
    } catch (e) { /* offline or no server: try later */ } finally { GR.busy = false; }
  }
  async function grLoadComments(q) {
    if (q.by !== 'net' || !grCanSql()) return;
    try { const rows = await grRpc('rfg_gram_comments', { p_id: q.id }); if (!Array.isArray(rows)) return; for (const r of rows) if (!q.cm.some(c => c.id === r.id)) q.cm.push({ id: r.id, h: grCleanH(r.handle), t: grText(r.body, 240), at: Date.parse(r.at) || Date.now(), u: r.uid, mine: r.uid === S.uid ? 1 : 0 }); q.cm.sort((a, b) => a.at - b.at); save(); grRefresh(); } catch (e) {}
  }

  // ---------- every couple of seconds: the city reacts ----------
  function grTick() {
    const g = gram(), now = Date.now();
    for (const p of g.posts) {
      const pl = p.pl; if (!pl || pl.done) continue; const age = (now - pl.t0) / 1000;
      const wantL = Math.floor(pl.L * (1 - Math.exp(-age / 140))), wantC = Math.floor(pl.C * (1 - Math.exp(-Math.max(0, age - 12) / 220))), wantF = Math.floor(pl.F * (1 - Math.exp(-age / 260)));
      let nl = 0, nf = 0; const who = [];
      while (pl.gl < wantL) { pl.gl++; p.lk++; nl++; const h = grNpcH(); if (who.length < 2 && !who.includes(h)) who.push(h); if (p.likers.length < 6 || Math.random() < 0.2) p.likers = [h, ...p.likers.filter(x => x !== h)].slice(0, 6); }
      while (pl.gc < wantC) { pl.gc++; const c = grNpcComment(p); p.cm.push(c); grAct({ k: 'cm', pid: p.id, h: c.h, t: c.t }, pl.gc <= 3); }
      while (pl.gf < wantF) { pl.gf++; g.npcF++; nf++; }
      if (nl) grAct({ k: 'lk', pid: p.id, n: nl, who }, pl.gl === nl || pl.gl >= pl.L * 0.5 && pl.gl - nl < pl.L * 0.5);
      if (nf) grAct({ k: 'fl', n: nf });
      if (pl.viral && !pl.vNews && pl.gl > pl.L * 0.45) { pl.vNews = 1; grAct({ k: 'vr', pid: p.id, n: p.lk }, true); setTimeout(() => _grAddGossip({ kind: 'news', icon: '🔥', text: `@${g.h}'s post is going viral. ${grNum(p.lk)} likes and counting.` }), 4000); }
      if (age > 1800) pl.done = 1;
    }
    // somebody in the city posts every couple of minutes; somebody snaps you every few
    if (worldOn && driving && now > GR.npcT) { GR.npcT = now + (90 + Math.random() * 150) * 1000; if (g.feed.length === 0 || Math.random() < 0.8) grNpcLife(); if (PH.open && PH.app === 'gossip') grRefresh(); }
    if (!GR.spotT) GR.spotT = now + (150 + Math.random() * 120) * 1000;
    if (now > GR.spotT && grSpotOk()) { GR.spotT = now + (300 + Math.random() * 300) * 1000; grSpot().then(ok => { if (!ok) GR.spotT = Date.now() + 60000; else grRefresh(); }); }
    grSync();
  }

  // ---------- the app ----------
  function grCss() {
    if (document.getElementById('gr-css')) return;
    const st = document.createElement('style'); st.id = 'gr-css';
    st.textContent = `
.gr-tabs { display: flex; border-bottom: 1px solid var(--line); background: #0e0f12; flex: 0 0 auto; }
.gr-tabs button { flex: 1; background: none; border: 0; border-bottom: 2px solid transparent; color: var(--muted); font: 700 13px var(--body); padding: 9px 2px 7px; cursor: pointer; position: relative; white-space: nowrap; }
.gr-tabs button.on { color: var(--fg); border-bottom-color: #ff2d55; } .gr-tabs button.new { color: #fff; } .gr-tabs button.new i { background: linear-gradient(135deg,#ff2d55,#8a1fd1); border-radius: 8px; padding: 2px 9px; font-style: normal; }
.gr-tabs em { font-style: normal; background: #e0483a; color: #fff; border-radius: 8px; font-size: 10px; padding: 0 5px; margin-left: 3px; }
.gr-wrap { display: flex; flex-direction: column; gap: 14px; padding: 8px 0 16px; width: 100%; max-width: 440px; margin: 0 auto; box-sizing: border-box; }
.gr-post { display: flex; flex-direction: column; gap: 6px; }
.gr-ph { display: flex; align-items: center; gap: 9px; padding: 0 12px; } .gr-ph > div { flex: 1; min-width: 0; cursor: pointer; } .gr-ph b { display: block; font-size: 14px; } .gr-ph span { display: block; color: var(--muted); font-size: 12px; }
.gr-ph .v { color: #3aa0ff; font-size: 12px; margin-left: 3px; } .gr-ph .net { color: #6fdc8c; font-size: 11px; margin-left: 4px; font-weight: 600; }
.gr-av { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-style: normal; font-weight: 800; color: #fff; flex: 0 0 auto; font-size: 15px; box-shadow: 0 0 0 2px #0e0f12, 0 0 0 3px #ff2d55; text-transform: uppercase; }
.gr-av.big { width: 72px; height: 72px; font-size: 30px; }
.gr-media { position: relative; background: #000; min-height: 120px; display: flex; justify-content: center; }
.gr-media img { width: 100%; height: auto; max-height: 62vh; object-fit: contain; display: block; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.gr-media.wait img { min-height: 160px; } .gr-media.gone::after { content: 'Picture not on this phone'; color: var(--muted); font-size: 12px; position: absolute; top: 50%; left: 0; right: 0; text-align: center; }
.gr-media .heart { position: absolute; left: 50%; top: 50%; font-size: 80px; transform: translate(-50%, -50%) scale(0); opacity: 0; pointer-events: none; transition: transform .25s ease, opacity .5s ease .25s; }
.gr-media .heart.go { transform: translate(-50%, -50%) scale(1); opacity: 1; transition: transform .2s ease; }
.gr-card { width: 100%; aspect-ratio: 5 / 4; max-height: 46vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 18px 22px; box-sizing: border-box; font: 800 19px var(--body); line-height: 1.3; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,.35); overflow: hidden; }
.gr-acts { display: flex; gap: 14px; padding: 0 12px; align-items: center; } .gr-acts button { background: none; border: 0; color: var(--fg); font-size: 24px; padding: 0; cursor: pointer; line-height: 1; } .gr-acts button.on { color: #ff2d55; }
.gr-acts .sp { flex: 1; }
.gr-lk { padding: 0 12px; font-size: 14px; } .gr-cap, .gr-c { margin: 0; padding: 0 12px; font-size: 14px; line-height: 1.35; overflow-wrap: anywhere; } .gr-cap b, .gr-c b { margin-right: 5px; cursor: pointer; }
.gr-c { color: #d6d9e0; } .gr-vc { background: none; border: 0; color: var(--muted); font: 600 13px var(--body); text-align: left; padding: 0 12px; cursor: pointer; }
.gr-time { padding: 0 12px; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
.gr-new { padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
.gr-roll { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; } .gr-roll img, .gr-grid > * { width: 100%; aspect-ratio: 1; object-fit: cover; background: #222; cursor: pointer; border: 0; padding: 0; display: block; }
.gr-roll img.on { outline: 3px solid #ff2d55; outline-offset: -3px; }
.gr-prev { width: 100%; max-height: 40vh; object-fit: contain; background: #000; border-radius: 10px; }
.gr-new textarea { background: #0b0c0f; border: 1px solid var(--line); border-radius: 10px; color: var(--fg); font: 500 15px var(--body); padding: 10px; min-height: 66px; resize: none; }
.gr-chip { align-self: flex-start; background: #17181d; border: 1px solid var(--line); border-radius: 16px; color: var(--fg); font: 600 13px var(--body); padding: 6px 12px; cursor: pointer; } .gr-chip.on { border-color: #ff2d55; color: #ff8aa3; }
.gr-share { background: linear-gradient(135deg,#ff2d55,#8a1fd1) !important; color: #fff !important; border: 0 !important; font-size: 16px !important; padding: 12px !important; }
.gr-prof { display: flex; gap: 14px; align-items: center; padding: 12px; } .gr-stats { flex: 1; display: flex; justify-content: space-around; text-align: center; } .gr-stats b { display: block; font-size: 17px; } .gr-stats span { color: var(--muted); font-size: 12px; }
.gr-bio { padding: 0 12px 8px; font-size: 14px; } .gr-bio b { display: block; } .gr-bio p { margin: 2px 0 0; color: #d6d9e0; white-space: pre-wrap; }
.gr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; } .gr-grid .t { display: flex; align-items: center; justify-content: center; font: 700 11px var(--body); color: #fff; padding: 6px; text-align: center; overflow: hidden; }
.gr-act { display: flex; gap: 10px; align-items: center; padding: 8px 12px; border-bottom: 1px solid #1b1c22; cursor: pointer; } .gr-act div { flex: 1; font-size: 14px; line-height: 1.3; } .gr-act small { color: var(--muted); margin-left: 4px; } .gr-act i { font-style: normal; font-size: 20px; width: 26px; text-align: center; }
.gr-send { display: flex; gap: 6px; padding: 8px 12px; position: sticky; bottom: 0; background: #0e0f12; border-top: 1px solid var(--line); }
.gr-note { color: var(--muted); font-size: 12px; padding: 0 12px; margin: 0; }
@media (orientation: landscape) and (max-height: 500px) {
  .gr-wrap { max-width: 620px; padding: 8px 10px 16px; }
  .gr-post { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); column-gap: 12px; row-gap: 6px; align-content: start; align-items: start; }
  .gr-post > * { grid-column: 2; } .gr-post > .gr-media { grid-column: 1; grid-row: 1 / span 12; border-radius: 8px; overflow: hidden; }
  .gr-post .gr-ph, .gr-post .gr-acts, .gr-post .gr-lk, .gr-post .gr-cap, .gr-post .gr-c, .gr-post .gr-vc, .gr-post .gr-time { padding-left: 0; padding-right: 0; }
  .gr-media img { max-height: 58vh; } .gr-card { max-height: 58vh; aspect-ratio: 4 / 3; font-size: 15px; padding: 12px; }
  .gr-roll, .gr-grid { grid-template-columns: repeat(5, 1fr); }
  .gr-new { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px 12px; align-items: start; } .gr-new > * { grid-column: 2; } .gr-new > .gr-prev, .gr-new > .gr-card { grid-column: 1; grid-row: 1 / span 8; max-height: 60vh; }
  .gr-new.pick { display: flex; }
}`;
    document.head.append(st);
  }
  const grAv = (p, big) => `<i class="gr-av${big ? ' big' : ''}" style="background:${p.av || grColor(p.h)}">${esc((p.h || '?').replace(/[^a-z0-9]/g, '')[0] || '?')}</i>`;
  function grPostHtml(p, full) {
    const g = gram(), cms = full ? p.cm : p.cm.slice(-2), cc = Math.max(p.cc || 0, p.cm.length);
    return `<div class="gr-post" data-id="${esc(p.id)}">
      <div class="gr-ph">${grAv(p)}<div data-u="${esc(p.id)}"><b>${esc(p.h)}${p.v ? '<span class="v">✔</span>' : ''}${p.by === 'net' ? '<span class="net">● player</span>' : ''}</b><span>${esc(p.loc || (p.by === 'npc' ? (GR_PAGES[p.h] ? GR_PAGES[p.h].n : '') : p.n || ''))}</span></div>${p.by === 'me' && full ? '<button class="btn" data-del="1">🗑</button>' : ''}</div>
      <div class="gr-media${p.img ? ' wait' : ''}" data-tap="${esc(p.id)}">${p.img ? `<img data-img="${esc(p.id)}" alt="">` : `<div class="gr-card" style="background:${p.card || GR_CARDS[0]}">${esc(p.cardText || p.cap || '')}</div>`}<span class="heart">❤️</span></div>
      <div class="gr-acts"><button data-like="${esc(p.id)}" class="${p.me ? 'on' : ''}" aria-label="Like">${p.me ? '❤️' : '🤍'}</button><button data-open="${esc(p.id)}" aria-label="Comments">💬</button><span class="sp"></span>${p.tag ? '<span class="gr-note" style="padding:0">📸 You\'re in this</span>' : ''}</div>
      <b class="gr-lk">${grNum(p.lk)} ${p.lk === 1 ? 'like' : 'likes'}</b>
      ${p.cap && p.img ? `<p class="gr-cap"><b data-u="${esc(p.id)}">${esc(p.h)}</b>${esc(p.cap)}</p>` : ''}
      ${!full && cc > 2 ? `<button class="gr-vc" data-open="${esc(p.id)}">View all ${cc} comments</button>` : ''}
      ${cms.map(c => `<p class="gr-c"><b>${esc(c.h)}</b>${esc(c.t)}</p>`).join('')}
      <span class="gr-time">${grAgo(p.at)}${p.by === 'me' && p.pl && !p.pl.done ? ' · still coming in' : ''}</span></div>`;
  }
  function grTabs() {
    const g = gram(), gs = gossip(), t = GR.tab;
    return `<div class="gr-tabs"><button data-tab="feed" class="${t === 'feed' ? 'on' : ''}">🏠 Feed</button><button data-tab="news" class="${t === 'news' ? 'on' : ''}">📰 News${gs.unseen && t !== 'news' ? `<em>${gs.unseen}</em>` : ''}</button><button data-tab="act" class="${t === 'act' ? 'on' : ''}">❤️${g.unseen ? `<em>${g.unseen > 99 ? '99+' : g.unseen}</em>` : ''}</button><button data-tab="me" class="${t === 'me' ? 'on' : ''}">👤 Me</button><button data-tab="new" class="new"><i>＋</i></button></div>`;
  }
  function grWireTabs(sc) {
    sc.querySelectorAll('.gr-tabs [data-tab]').forEach(b => b.onclick = () => { const t = b.dataset.tab; GR.view = null; if (t === 'new') { grNew(); return; } GR.tab = t; gossipApp(sc); });
  }
  function grWirePosts(sc) {
    sc.querySelectorAll('[data-like]').forEach(b => b.onclick = () => { grLike(b.dataset.like); grRefresh(); });
    sc.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { GR.view = 'post:' + b.dataset.open; const q = grFind(b.dataset.open); if (q) grLoadComments(q); gossipApp(sc); });
    sc.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { const q = grFind(b.dataset.u); if (!q) return; GR.view = q.by === 'me' ? null : 'u:' + q.id; if (q.by === 'me') GR.tab = 'me'; gossipApp(sc); });
    // double tap the picture to like it
    sc.querySelectorAll('[data-tap]').forEach(m => m.onclick = () => {
      const id = m.dataset.tap, now = performance.now();
      if (GR.tapId === id && now - GR.tapT < 350) { GR.tapT = 0; const h = m.querySelector('.heart'); h.classList.add('go'); setTimeout(() => h.classList.remove('go'), 650); const q = grFind(id); if (q && !q.me) { grLike(id, true); setTimeout(grRefresh, 700); } return; }
      GR.tapId = id; GR.tapT = now;
    });
    const del = sc.querySelector('[data-del]'); if (del) del.onclick = () => { const id = GR.view && GR.view.slice(5); if (!id) return; if (del.dataset.sure) { grDelete(id); GR.view = null; GR.tab = 'me'; gossipApp(sc); toast('Post deleted.'); } else { del.dataset.sure = 1; del.textContent = 'Delete it?'; } };
    grHydrate(sc);
  }
  function grFeedHtml() {
    const g = gram(), all = [...g.posts, ...g.feed].sort((a, b) => b.at - a.at).slice(0, 40);
    if (!all.length) return `<p class="mk-note" style="padding:12px">Nothing yet. Tap ＋ to post your first pic, or open the Camera to take one. People around the city post here too.</p>`;
    return all.map(p => grPostHtml(p)).join('');
  }
  function grMeHtml(who) {
    const g = gram(), me = !who, posts = me ? g.posts : [...g.posts, ...g.feed].filter(p => (who.by === 'net' ? p.u === who.u : p.by === 'npc' && p.h === who.h));
    const hs = [...String(who ? who.h : '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 3);
    const fol = me ? grFollowers() : who.by === 'net' ? null : GR_PAGES[who.h] ? 12000 + hs % 90000 : 80 + hs % 900;
    const following = me ? Object.keys(g.fw).length : who.by === 'net' ? null : 50 + hs % 400, h = me ? g.h : who.h, av = me ? { h: g.h, av: grColor(g.h) } : who;
    return `<div class="gr-prof">${grAv(av, true)}<div class="gr-stats"><div><b>${posts.length}</b><span>posts</span></div><div><b>${fol == null ? '–' : grNum(fol)}</b><span>followers</span></div><div><b>${following == null ? '–' : grNum(following)}</b><span>following</span></div></div></div>
      <div class="gr-bio"><b>${esc(me ? S.name || h : who.n || h)}${!me && who.by === 'net' ? ' <span class="gr-note" style="padding:0;color:#6fdc8c">● real player</span>' : ''}</b>${me ? (g.bio ? `<p>${esc(g.bio)}</p>` : '') : GR_PAGES[h] ? '<p>The city\'s page. Tag us.</p>' : ''}</div>
      <div style="display:flex;gap:6px;padding:0 12px 10px">${me ? '<button class="btn" data-a="edit" style="flex:1">Edit profile</button><button class="btn" data-a="cam" style="flex:1">📸 Camera</button>' : `<button class="btn${grFollowing(who) ? '' : ' go'}" data-a="fol" style="flex:1">${grFollowing(who) ? 'Following ✓' : 'Follow'}</button>${who.by === 'net' && frOf(who.u) ? '<button class="btn" data-a="dm" style="flex:1">Message</button>' : ''}`}</div>
      ${me && GR.edit ? `<div class="gr-new" style="padding-top:0"><label class="gr-note" style="padding:0">Username</label><input class="go-in" id="gr-h" maxlength="18" value="${esc(g.h)}"><label class="gr-note" style="padding:0">Bio</label><textarea id="gr-bio" maxlength="150">${esc(g.bio)}</textarea><button class="btn go" data-a="saveprof">Save</button></div>` : ''}
      <div class="gr-grid">${posts.map(p => p.img ? `<img data-img="${esc(p.id)}" data-open="${esc(p.id)}" alt="">` : `<button class="t" data-open="${esc(p.id)}" style="background:${p.card || GR_CARDS[0]}">${esc((p.cardText || p.cap).slice(0, 60))}</button>`).join('')}</div>
      ${posts.length ? '' : `<p class="mk-note" style="padding:12px">${me ? 'No posts yet. Tap ＋ up top.' : 'No posts yet.'}</p>`}
      ${me && !S.homeServer ? '<p class="gr-note" style="padding-top:8px">Pick a home server in the Online app so real players can see your posts on every server.</p>' : ''}`;
  }
  function grActHtml() {
    const g = gram();
    return g.act.length ? g.act.map(a => `<div class="gr-act" data-pid="${esc(a.pid || '')}"><i>${a.k === 'lk' ? '❤️' : a.k === 'cm' || a.k === 'rp' ? '💬' : a.k === 'fl' ? '👤' : a.k === 'tag' ? '📸' : '🔥'}</i><div>${grActText(a)}${a.real ? ' <span style="color:#6fdc8c;font-size:11px">● player</span>' : ''}<small>${grAgo(a.at)}</small></div></div>`).join('')
      : '<p class="mk-note" style="padding:12px">Likes, comments and new followers show up here.</p>';
  }
  function grNewHtml() {
    const d = GR.draft || {};
    if (!d.blob && !d.text) return `<div class="gr-new pick"><b>New post</b><span class="gr-note" style="padding:0">Pick a picture from your Camera roll, take a new one, or write something.</span>
      <div style="display:flex;gap:6px"><button class="btn" data-a="cam" style="flex:1">📸 Take a picture</button><button class="btn" data-a="text" style="flex:1">Aa Just text</button></div>
      <div class="gr-roll" id="gr-roll"><span class="gr-note" style="grid-column:1/-1;padding:0">Loading your Camera roll…</span></div></div>`;
    const ctx = d.ctx || {};
    return `<div class="gr-new">${d.blob ? `<img class="gr-prev" id="gr-prev" alt="">` : `<div class="gr-card" style="background:${d.card || GR_CARDS[0]};border-radius:10px">${esc(d.cap || 'Type it below')}</div>`}
      <textarea id="gr-cap" maxlength="300" placeholder="${d.blob ? 'Write a caption… #MurdaWorth' : 'What\'s on your mind?'}">${esc(d.cap || '')}</textarea>
      <button class="gr-chip${d.loc !== false ? ' on' : ''}" data-a="loc">📍 ${esc(ctx.place || ctx.d || 'Fort Worth')}${d.loc !== false ? '' : ' (off)'}</button>
      ${ctx.car ? `<span class="gr-note" style="padding:0">🚗 Your ${esc(ctx.car)} is in it. People love a car pic.</span>` : ''}
      <button class="btn gr-share" data-a="share">Share</button><button class="btn" data-a="back">${d.blob ? 'Pick another' : 'Back'}</button>
      ${netOn() ? '<span class="gr-note" style="padding:0">Everybody on your server sees it right away.</span>' : '<span class="gr-note" style="padding:0">You\'re offline: the city still sees it. Go online so real players do too.</span>'}</div>`;
  }
  async function grFillRoll(sc) {
    const el = sc.querySelector('#gr-roll'); if (!el) return;
    for (const u of GR.roll) URL.revokeObjectURL(u); GR.roll = [];
    const all = window.__photo ? await window.__photo.pAll() : [];
    if (!sc.isConnected || !el.isConnected) return;
    el.innerHTML = all.length ? '' : '<span class="gr-note" style="grid-column:1/-1;padding:0">No pictures yet. Take one with the Camera (or press P).</span>';
    for (const r of all.slice(0, 45)) { const u = URL.createObjectURL(r.blob); GR.roll.push(u); const im = document.createElement('img'); im.src = u; im.onclick = () => { GR.draft = { blob: r.blob, cap: '', loc: true, ctx: grCtx() }; gossipApp(sc); }; el.appendChild(im); }
  }
  function grNew(blob) { GR.tab = 'new'; GR.view = null; GR.draft = blob ? { blob, cap: '', loc: true, ctx: grCtx() } : null; gossipApp(phoneEl('ph-screen')); }
  function grRender(sc) {
    const g = gram(); PH.app = 'gossip'; sc.className = 'ph-screen';
    let title = 'Gossip', body = '';
    const v = GR.view, q = v && (v.startsWith('post:') || v.startsWith('u:')) ? grFind(v.slice(v.indexOf(':') + 1)) : null;
    if (v && v.startsWith('post:') && q) { title = 'Post'; body = `<div class="gr-wrap">${grPostHtml(q, true)}</div><div class="gr-send"><input class="go-in" id="gr-cm" maxlength="240" placeholder="Add a comment…"><button class="btn go" data-a="cm">Post</button></div>`; }
    else if (v && v.startsWith('u:') && q) { title = q.h; body = grMeHtml(q); }
    else if (GR.tab === 'me') { title = g.h; body = grMeHtml(null); }
    else if (GR.tab === 'act') { title = 'Activity'; body = grActHtml(); g.unseen = 0; save(); }
    else if (GR.tab === 'new') { title = 'New post'; body = grNewHtml(); }
    else { body = `<div class="gr-wrap">${grFeedHtml()}</div>`; }
    const st = sc.scrollTop, same = sc.dataset.grv === (v || GR.tab);
    sc.innerHTML = phoneHead(esc(title)) + (v ? '' : grTabs()) + body; sc.dataset.grv = v || GR.tab;
    if (same) sc.scrollTop = st;
    sc.querySelector('.ph-back').onclick = () => { if (GR.view) { GR.view = null; gossipApp(sc); } else if (GR.tab === 'new') { GR.tab = 'feed'; GR.draft = null; gossipApp(sc); } else phoneHome(); };
    grWireTabs(sc); grWirePosts(sc);
    const A = a => sc.querySelector(`[data-a="${a}"]`), on = (a, f) => { const b = A(a); if (b) b.onclick = f; };
    on('cam', () => { closePhone(); if (window.__photo) window.__photo.pmOpen(); });
    on('text', () => { GR.draft = { text: true, cap: '', card: grPick(GR_CARDS), loc: true, ctx: grCtx() }; gossipApp(sc); });
    on('loc', () => { GR.draft.cap = (sc.querySelector('#gr-cap') || {}).value || ''; GR.draft.loc = GR.draft.loc === false; gossipApp(sc); });
    on('back', () => { GR.draft = null; gossipApp(sc); });
    on('share', async () => {
      const d = GR.draft, cap = (sc.querySelector('#gr-cap') || {}).value || ''; if (!d || GR.posting) return;
      if (!d.blob && !grText(cap, 300)) { toast('Write something first.', 'bad'); return; }
      GR.posting = true; const b = A('share'); if (b) { b.disabled = true; b.textContent = 'Posting…'; }
      try { const p = await grPublish({ blob: d.blob, cap, loc: d.loc !== false, ctx: d.ctx, card: d.card }); if (p) { GR.draft = null; GR.tab = 'feed'; toast('Posted to Gossip 📲', 'good'); } }
      finally { GR.posting = false; if (PH.open && PH.app === 'gossip') gossipApp(phoneEl('ph-screen')); }
    });
    on('cm', () => { const i = sc.querySelector('#gr-cm'); if (i && grComment(q.id, i.value)) { i.value = ''; gossipApp(sc); const s = phoneEl('ph-screen'); s.scrollTop = s.scrollHeight; } });
    const ci = sc.querySelector('#gr-cm'); if (ci) ci.onkeydown = e => { if (e.key === 'Enter') A('cm').click(); };
    on('fol', () => { grFollow(q, !grFollowing(q)); gossipApp(sc); });
    on('dm', () => { phoneApp('friends'); });
    on('edit', () => { GR.edit = !GR.edit; gossipApp(sc); });
    on('saveprof', () => { const h = grHandleOf((sc.querySelector('#gr-h') || {}).value || g.h), b = grText((sc.querySelector('#gr-bio') || {}).value, 150); g.h = h; g.bio = b; for (const p of g.posts) { p.h = h; p.av = grColor(h); } GR.edit = false; save(); gossipApp(sc); toast('Profile saved.', 'good'); });
    sc.querySelectorAll('.gr-act[data-pid]').forEach(r => r.onclick = () => { const id = r.dataset.pid; if (id && grFind(id)) { GR.view = 'post:' + id; gossipApp(sc); } });
    const pv = sc.querySelector('#gr-prev'); if (pv && GR.draft && GR.draft.blob) { const u = URL.createObjectURL(GR.draft.blob); pv.onload = () => URL.revokeObjectURL(u); pv.src = u; }
    if (GR.tab === 'new' && !GR.draft && !v) grFillRoll(sc);
    gossip().unseen = 0;
    if (GR.tab === 'feed' && !v) grSync();
  }
  // redraw what's on the phone without losing what you're typing
  function grRefresh() {
    if (!(PH.open && PH.app === 'gossip')) return; const sc = phoneEl('ph-screen');
    const a = document.activeElement; if (a && /INPUT|TEXTAREA/.test(a.tagName) && sc.contains(a)) return;
    if (GR.tab === 'new' || GR.tab === 'news' && !GR.view) return;
    gossipApp(sc);
  }
  const _grNews = gossipApp;
  gossipApp = function (sc) {
    goCss(); grCss();
    if (GR.popTab && Date.now() - GR.popAt < 15000) { GR.tab = GR.popTab; GR.view = null; } GR.popTab = null;
    if (GR.tab === 'news' && !GR.view) {
      _grNews(sc); sc.dataset.grv = 'news';
      const at = sc.querySelector('.liveticker') || sc.querySelector('.ph-head'); at.insertAdjacentHTML('afterend', grTabs()); grWireTabs(sc);
      return;
    }
    grRender(sc);
  };
  // the badge on the home screen counts new activity too
  const _grPhoneHome = phoneHome;
  phoneHome = function () {
    _grPhoneHome.apply(this, arguments);
    try { const n = gossip().unseen + gram().unseen, b = document.querySelector('#ph-screen .app[data-id="gossip"]'); if (b) { const e = b.querySelector('.go-badge'); if (e) e.textContent = n > 99 ? '99+' : n; else if (n) b.insertAdjacentHTML('afterbegin', `<span class="go-badge">${n > 99 ? '99+' : n}</span>`); } } catch (e) {}
  };
  // photo mode: post the picture you just took
  { const row = document.querySelector('#pm-sheet .row');
    if (row) { row.insertAdjacentHTML('afterbegin', '<button class="big" id="gr-pm-post" style="background:linear-gradient(135deg,#ff2d55,#8a1fd1) !important;color:#fff !important;border:0 !important">📲 Post to Gossip</button>');
      document.getElementById('gr-pm-post').onclick = () => { const P = window.__photo, r = P && P.PM.last; if (!r || !r.blob) return; const blob = r.blob; P.pmClose(); openPhone(); grNew(blob); }; } }
  setInterval(() => { if (!S || !worldOn) return; try { grTick(); } catch (e) { if (!GR.err) { GR.err = 1; console.warn('gram tick', e); } } }, 2000);
  window.__gram = { grSpotWhy, GR, gram, addGossip: it => addGossip(it), grPublish, grPlan, grTick, grSpot, grSnap, grNpcPost, grNpcLife, grLike, grComment, grFollow, grSync, grNew, grRender, grRefresh, grCtx, grDelete, grUrl, grImgGet, grShrink, grLocalRpc };
  // ==== gossip posts (end) ====
