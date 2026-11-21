  // ==== living npcs (begin) ====
  // People who live here. Folks walk the sidewalks between their houses and the spots on their own little routines (work and
  // errands in the day, food and home at sunset, the corner and the club at night), named locals hold down their store fronts
  // and porches, and everybody notices you: they look at you, nod or mean-mug, put their hands up when you point a gun at them,
  // duck and run at shots, jump out of the way of your car, crowd around and film after somebody gets dropped, and talk about
  // it after (on the street, then in Throttle Gossip). Each neighborhood keeps its own read on you (respect, fear, how known
  // you are) and the people you deal with remember you (what you did, how they feel about you), which changes what they say,
  // whether they'll help you, give you work, look out for you, or call the police on you.
  // Online: a walker's whole trip is worked out from the server's shared clock and the map, so every player sees the same
  // people in the same places with nothing sent. Once somebody deals with one (talks, scares, hits them) that player's game
  // runs them and sends them like the other hood people (hClaim / hPack), and they stay off the clock till they go inside.
  const LVW = { plans: new Map(), anchors: new Map(), bgrid: null, offs: new Map(), off: new Set(), looks: [], tmp: {}, recent: [], scenes: [], said: new Map(),
    cap: phone ? 6 : 14, lcap: phone ? 3 : 8, pool: phone ? 6 : 12, budget: phone ? 2 : 4, slot: 300, last: 0, err: 0, nodT: 0, banT: 4, lookT: 0, qT: 0, sp: 0, lastShot: -99, shotNewsT: 0, stats: { plans: 0, fail: 0, spawned: 0 } };
  for (const m of ['walk', 'dwell', 'chat', 'cower', 'panic', 'film', 'hands', 'fall', 'post']) if (!H_MODES.includes(m)) H_MODES.push(m);
  const lvRng = s => { let sd = hHash(s) * 7 + 13 || 1; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647; R(); R(); return R; };
  const lvPhase = () => timeName === 'night' ? 2 : timeName === 'sunset' ? 1 : 0;
  const lvWhen = () => { const p = lvPhase(); if (p === 2) return 'tonight'; if (p === 1) return 'this evening'; return new Date().getHours() < 12 ? 'this morning' : 'today'; };
  const lvDist = (x, z) => districtAt(x, z) || 'Fort Worth';
  function lvS() {
    const h = hS(), l = h.life || (h.life = {});
    l.mem = l.mem || {}; l.rep = l.rep || {}; l.news = l.news || []; l.look = l.look || {}; if (l.q === undefined) l.q = null; l.done = l.done || 0;
    return l;
  }

  // ---------- memory: who remembers what you did ----------
  // the named locals, the corners and the server's regulars keep it in the save; folks on the sidewalk only for the session
  const lvKeeps = id => /^(p:[LH]:|m:|r:)/.test(id);
  function lvMem(e, make) {
    const keep = lvKeeps(e.id), store = keep ? lvS().mem : LVW.tmp;
    let m = store[e.id];
    if (!m && make) {
      m = store[e.id] = { n: e.name, a: 0, f: 0, met: 0, t: Date.now(), ev: [] };
      if (keep) { const ks = Object.keys(store); if (ks.length > 90) { ks.sort((a, b) => store[a].t - store[b].t); for (const k of ks.slice(0, ks.length - 90)) delete store[k]; } }
    }
    return m || null;
  }
  function lvRemember(e, code, da = 0, df = 0) {
    if (!e || !e.id) return null;
    const m = lvMem(e, true); m.n = e.name; m.a = clamp(m.a + da, -100, 100); m.f = clamp(m.f + df, 0, 100); m.t = Date.now();
    m.ev.unshift([code, Date.now()]); m.ev.length = Math.min(m.ev.length, 6); if (code === 'talk') m.met++;
    return m;
  }
  // how they feel about you, one word
  function lvTier(e) {
    const m = lvMem(e); if (!m) return 'stranger';
    if (m.f >= 55) return 'scared'; if (m.a >= 50) return 'friend'; if (m.a <= -40) return 'enemy'; if (m.a <= -12) return 'sour'; if (m.a >= 18) return 'cool';
    return m.met ? 'known' : 'stranger';
  }

  // ---------- your name in each neighborhood ----------
  function lvRep(d) { const R = lvS().rep; return R[d] || (R[d] = { r: 0, f: 0, k: 0 }); }
  function lvRepAdd(x, z, r = 0, f = 0, k = 0) {
    const R = lvRep(lvDist(x, z)); R.r = clamp(R.r + r, -100, 100); R.f = clamp(R.f + f, 0, 100); R.k = clamp(R.k + k, 0, 100);
    return R;
  }
  // how the block you're on sees you
  function lvRepTier(x, z) {
    const R = lvRep(lvDist(x, z));
    if (R.r >= 60) return 'hero'; if (R.r <= -35) return 'hated'; if (R.f >= 55 && R.r < 30) return 'feared'; if (R.r >= 25) return 'respected'; if (R.k >= 20) return 'known';
    return 'unknown';
  }
  const LV_TIER_NAME = { hero: 'Neighborhood hero', respected: 'Respected', known: 'Known', unknown: 'Nobody knows you yet', feared: 'Feared', hated: 'Hated' };

  // ---------- what people say ----------
  // {me} your name, {d} the neighborhood, {street} a street, {car} your car, {when} the time of day, {news} what happened
  const LV_L = {
    'g.stranger': ['hey', 'how you doin', 'mm-hm', 'you good?', 'hey there', 'whats up', 'yo', 'afternoon'],
    'g.stranger.0': ['good morning', 'mornin', 'beautiful day huh', 'hot out here already'],
    'g.stranger.1': ['evening', 'sun going down finally', 'long day huh'],
    'g.stranger.2': ['kinda late to be walking around', 'you lost?', 'its late bruh', 'night'],
    'g.known': ['hey {me}', 'there go {me}', 'wsg {me}', 'oh hey, you again', 'whats good {me}'],
    'g.cool': ['{me}! whats good', 'my dude {me}', 'aye {me}, you straight?', 'look who it is'],
    'g.friend': ['{me}!! there go my favorite person', 'you know you family round here {me}', 'aye thats my folks right there', '{me}! you eat today? come by later'],
    'g.sour': ['oh. you', 'mm', 'what you want', 'keep it short', 'you got a lot of nerve coming back over here'],
    'g.enemy': ['get away from me', 'i got nothing to say to you', 'you got some nerve', 'dont even look at me'],
    'g.scared': ['p-please, i dont want no trouble', 'im not looking for problems', 'w-what you need?', 'i aint seen nothing'],
    'g.rep.hero': ['{me}! the whole {d} rocks with you', 'thats {me}, they love you over here', 'you good over here {me}, anything you need'],
    'g.rep.respected': ['respect {me}', 'they talk good about you round here', 'heard good things'],
    'g.rep.known': ['aint you {me}?', 'i seen you around', 'you the one with the {car}?'],
    'g.rep.feared': ['...', 'yes sir', 'aint no problem here', 'we good, we good'],
    'g.rep.hated': ['you aint welcome round here', 'people know what you did', 'i should call somebody on you', 'go somewhere else'],
    's.hurt': ['you bleeding!', 'you need a doctor bro', 'damn what happened to you', 'you look rough, JPS is that way'],
    's.heat': ['police been riding round looking for somebody', 'they looking for somebody who look like you', 'you hot right now, i can tell'],
    's.gun': ['why you got that out', 'put that away man', 'whoa, chill with that'],
    's.car': ['that {car} hard', 'that your {car}? clean', 'i used to have one like that'],
    's.night': ['be careful out here tonight', 'stay safe tonight', 'this side get crazy after dark'],
    's.news': ['you hear {news}?', 'they said {news}', 'everybody talking bout how {news}', 'word is {news}'],
    'pass': ['hey', 'mornin', 'excuse me', 'how you doin', 'nice day', 'scuse me', 'hey now', '*nods*'],
    'pass.2': ['*nods*', 'night', 'be safe'],
    'pass.feared': ['*looks down*', '*steps aside*', '...'],
    'pass.hero': ['{me}!', 'aye thats {me}', 'love you {me}!', 'wsg {me}'],
    'bump': ['excuse you', 'watch it', 'damn, my bad', 'you see me walking right?', 'scuse me'],
    'dodge': ['WHOA!', 'watch where you going!', 'you crazy?!', 'slow down!!', 'you almost hit me!'],
    'hitcar': ['AHH!', 'you hit me!!', 'somebody call 911!', 'my leg!!'],
    'hands': ['dont shoot!', 'please! i got kids', 'take whatever you want', 'whoa whoa whoa', 'im not doing nothing!'],
    'shots': ['GET DOWN!', 'oh my god!', 'run!!', 'they shooting!', 'not again'],
    'film': ['yall seeing this?', 'im posting this', 'damn they got him', 'somebody call 911', 'its always this side'],
    'downtalk': ['who you talking to?', 'you dont know me like that', 'aight. remember that', 'wow. ok', 'boy bye'],
    'downtalk.scared': ['ok ok, im leaving', 'sorry, sorry', 'i dont want no problems'],
    'gift': ['thank you!! god bless', 'appreciate you fr', 'you didnt have to do that', 'you a real one'],
    'beg': ['you got a dollar?', 'spare some change?', 'can you help me out with something to eat?'],
    'nonews': ['nothing much, same ol', 'quiet today', 'just trying to make it', 'aint heard nothing', 'everything been calm'],
    'bye': ['aight be safe', 'later', 'take care now', 'see you round'],
    // what they remember about you
    'm.gift': ['appreciate you again for earlier', 'you the one looked out for me', 'still thankful for that'],
    'm.job': ['good looking on that run', 'you handled that, i appreciate you'],
    'm.down': ['you got a lot of mouth', 'oh you that loud one from before', 'still remember what you said'],
    'm.shot': ['you the one was shooting at me!', 'stay away from me!', 'you tried to kill me!'],
    'm.aim': ['you pointed a gun at me', 'last time you pulled a gun on me'],
    'm.hitcar': ['you the one hit me with your car!', 'my leg still hurt from you'],
    'm.ride': ['need another ride?', 'you back? where we going'],
    'm.race_w': ['you got lucky last time', 'run it back sometime'],
    'm.race_l': ['you cant beat me', 'you want another L?'],
    'm.help': ['you the one helped out', 'good looking on before'],
    // the corners among themselves, the regulars, the walkers
    'crew': [['yall seen the cops on {street}?', 'they been sitting there all day'], ['who got the plate tonight?', 'not me, i got the gas last time'], ['{d} been quiet', 'too quiet'], ['bro owe me 20', 'he aint paying that lol'],
      ['yall hear {news}?', 'yeah that was crazy'], ['its hot as hell', 'thats Texas'], ['who that pulling up?', 'nobody, chill'], ['big homie said hold it down', 'we got it'], ['you seen my lighter?', 'check your pocket'], ['im hungry fr', 'go to the store then']],
    'pair': [['girl i told you', 'stop lying lol'], ['what time you gotta be at work?', 'too early'], ['you hear {news}?', 'yeah my cousin told me'], ['lets go to the store', 'you buying?'],
      ['my mama said come by sunday', 'ok ok'], ['you see that car?', 'that was hard'], ['its hot', 'Texas man'], ['i gotta stop spending money', 'you say that every week'], ['where you parked?', 'down the street']],
    'local': ['{name} out here every day', 'been on this street 30 years', 'you need anything, you come see me', 'i seen everything out here'],
  };
  const LV_NEWS = {
    shots: ['somebody was letting off shots on {street}', 'shots went off over by {street}'],
    drop: ['somebody got dropped on {street}', 'they caught somebody on {street}'],
    bystander: ['somebody shot a regular person on {street}. thats foul', 'a innocent man got shot on {street}'],
    hitrun: ['somebody ran a man over on {street} and kept going', 'somebody hit a lady with they car on {street}'],
    race: ['{who} been out here racing on {street}', '{who} smoked somebody on {street}'],
    gift: ['{who} out here looking out for people', '{who} gave somebody money on {street}'],
    job: ['{who} been doing runs for folks round here'],
  };
  // pick a line nobody said lately (to you or near you), filled in
  function lvFill(t, e, o = {}) {
    const car = S.car ? (carOf(S.car.id).model || 'car') : 'car', [mx, mz] = hMe();
    return t.replace(/\{me\}/g, S.name || 'bro').replace(/\{d\}/g, lvDist(mx, mz)).replace(/\{street\}/g, () => o.street || (streetAt(mx, mz) || {}).name || hPick(H_STREETS))
      .replace(/\{car\}/g, car).replace(/\{when\}/g, lvWhen()).replace(/\{news\}/g, o.news || 'what happened').replace(/\{name\}/g, e ? e.name : 'them').replace(/\{who\}/g, o.who || 'somebody');
  }
  function lvPick(keys, e, o) {
    let all = []; for (const k of keys) if (LV_L[k]) all = all.concat(LV_L[k]);
    if (!all.length) return '';
    const mine = (e && LVW.said.get(e.id)) || [];
    const fresh = all.filter(t => !LVW.recent.includes(t) && !mine.includes(t)), t = hPick(fresh.length ? fresh : all);
    LVW.recent.push(t); if (LVW.recent.length > 40) LVW.recent.shift();
    if (e) { mine.push(t); if (mine.length > 8) mine.shift(); LVW.said.set(e.id, mine); if (LVW.said.size > 200) LVW.said.delete(LVW.said.keys().next().value); }
    return lvFill(t, e, o);
  }
  // the freshest story from this neighborhood (or next door, once it's had time to get around)
  function lvNewsFor(x, z) {
    const d = lvDist(x, z), now = Date.now(), N = lvS().news;
    const it = N.find(n => now - n.t < 30 * 60000 && (n.d === d || now - n.t > 4 * 60000)); return it || null;
  }
  // what somebody says first: what they remember, how the block sees you, what's going on, how they feel about you
  function lvGreetLine(e) {
    const [mx, mz] = hMe(), tier = lvTier(e), rt = lvRepTier(mx, mz), m = lvMem(e), ph = lvPhase(), G = window.__guns, keys = [];
    const ev = m && m.ev.find(v => LV_L['m.' + v[0]]); if (ev && Date.now() - ev[1] < 3 * 3600000 && hRnd() < 0.7) return lvPick(['m.' + ev[0]], e);
    if (tier === 'scared' || tier === 'enemy') return lvPick(['g.' + tier], e);
    if (S.health < 45 && hRnd() < 0.6) return lvPick(['s.hurt'], e);
    if (G && G.GUN && G.GUN.want && hRnd() < 0.7) return lvPick(['s.gun'], e);
    if ((S.heat || 0) >= 2 && hRnd() < 0.4) return lvPick(['s.heat'], e);
    if ((rt === 'feared' || rt === 'hated' || rt === 'hero') && tier !== 'friend' && hRnd() < 0.6) return lvPick(['g.rep.' + rt], e);
    const nw = lvNewsFor(mx, mz); if (nw && hRnd() < 0.25) return lvPick(['s.news'], e, { news: nw.txt });
    keys.push('g.' + tier); if (tier === 'stranger') keys.push('g.stranger.' + ph);
    if ((rt === 'respected' || rt === 'known') && tier === 'stranger') keys.push('g.rep.' + rt);
    if (ph === 2 && hRnd() < 0.3) keys.push('s.night');
    return lvPick(keys, e);
  }

  // ---------- the map: front doors on the street ----------
  function lvGrid() {
    if (LVW.bgrid) return LVW.bgrid;
    const G = LVW.bgrid = new Map(), B = DATA.B, K = DATA.kinds;
    for (let i = 0; i < B.length; i += 8) {
      const k = K[B[i + 5]]; if (!/^(house|home|store|church|midrise|tower|warehouse|landmark)$/.test(k)) continue;
      const cx = B[i] + B[i + 2] / 2, cz = B[i + 1] + B[i + 3] / 2, kk = Math.floor(cx / 100) + ',' + Math.floor(cz / 100);
      let l = G.get(kk); if (!l) G.set(kk, l = []); l.push(i);
    }
    return G;
  }
  const lvOnRoad = (x, z) => window.__st && window.__st.onRoad ? window.__st.onRoad(x, z) : false;
  const lvSolid = (x, z, r = 0.3) => solids.at(x, z).some(b => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r);
  // which side of a building faces a street, and where its door is
  function lvDoor(x0, z0, w, d) {
    const cx = x0 + w / 2, cz = z0 + d / 2; let best = null, bd = 1e9;
    for (const [sx, sz, ox, oz] of [[cx, z0 + d, 0, 1], [cx, z0, 0, -1], [x0 + w, cz, 1, 0], [x0, cz, -1, 0]]) {
      for (let k = 3; k <= 17; k += 2) { if (k >= bd) break; if (lvOnRoad(sx + ox * k, sz + oz * k)) { if (k < bd) { bd = k; best = [sx, sz, ox, oz]; } break; } }
    }
    if (!best) return null;
    const [sx, sz, ox, oz] = best, dx = sx + ox * 0.9, dz = sz + oz * 0.9;
    if (lvSolid(dx, dz, 0.1)) return null;
    return { x: dx, z: dz, ox, oz, ux: sx + ox * Math.min(bd - 1.2, 3), uz: sz + oz * Math.min(bd - 1.2, 3), road: bd };
  }
  function lvAnchors(ci, cj) {
    const key = ci + ',' + cj; let A = LVW.anchors.get(key); if (A) return A;
    A = []; const B = DATA.B, K = DATA.kinds, list = lvGrid().get(key) || [];
    for (const i of list) {
      const k = K[B[i + 5]], dr = lvDoor(B[i], B[i + 1], B[i + 2], B[i + 3]); if (!dr) continue;
      A.push({ id: 'b' + i, bi: i, kind: k === 'house' || k === 'home' ? 'home' : k === 'church' ? 'church' : k === 'store' ? 'store' : 'work', ...dr });
    }
    for (const p of DATA.P) { if (Math.floor(p.x / 100) !== ci || Math.floor(p.z / 100) !== cj || !STYLE[p.type] || !/^[\w-]{1,40}$/.test(p.id)) continue; const [ox, oz] = outDir(p); A.push({ id: 'P' + p.id, p, kind: lvGroup(p.type), x: p.x + ox * 1.2, z: p.z + oz * 1.2, ox, oz, ux: p.x + ox * 3.5, uz: p.z + oz * 3.5, road: 8 }); }
    LVW.anchors.set(key, A); if (LVW.anchors.size > 260) LVW.anchors.delete(LVW.anchors.keys().next().value);
    return A;
  }
  function lvGroup(t) {
    if (/^(food|diner)$/.test(t)) return 'food';
    if (/^(gas|corner|liquor|pawn|bank|clothing|mall|boutique|dispensary)$/.test(t)) return 'errand';
    if (/^(meet|carshow|club|studio|roll)$/.test(t)) return 'social';
    if (/^(property|home)$/.test(t)) return 'home';
    return 'work';
  }
  // ---------- daily routines: who's out, where they're headed ----------
  const LV_ARCH = { worker: { sp: [1.35, 1.55], n: [{ work: 1, food: 0.4, errand: 0.3, social: 0.1, home: 0.3 }, { home: 1, food: 0.6, errand: 0.35, social: 0.2, work: 0.1 }, { home: 1, food: 0.35, social: 0.2 }] },
    shopper: { sp: [1.2, 1.4], n: [{ errand: 1, food: 0.5, social: 0.2, home: 0.3 }, { errand: 0.8, food: 0.7, home: 0.5 }, { food: 0.6, errand: 0.5, home: 0.6 }] },
    elder: { sp: [0.9, 1.1], n: [{ errand: 0.6, church: 0.8, food: 0.4, home: 0.6, social: 0.3 }, { home: 0.9, church: 0.6, food: 0.3 }, { home: 1 }] },
    youth: { sp: [1.3, 1.6], n: [{ social: 0.7, food: 0.6, errand: 0.4, home: 0.2 }, { social: 0.9, food: 0.6, home: 0.3 }, { social: 1, food: 0.5, home: 0.3 }] },
    night: { sp: [1.2, 1.45], n: [{ errand: 0.5, food: 0.5 }, { social: 0.9, food: 0.5 }, { social: 1, food: 0.6, errand: 0.3 }] } };
  const LV_MIX = [[['worker', 0.3], ['shopper', 0.3], ['elder', 0.16], ['youth', 0.2], ['night', 0.04]], [['worker', 0.25], ['shopper', 0.2], ['elder', 0.08], ['youth', 0.3], ['night', 0.17]], [['worker', 0.1], ['shopper', 0.05], ['youth', 0.35], ['night', 0.5]]];
  const LV_FIRST = { m: ['Darnell', 'Marcus', 'Luis', 'Tony', 'Kevin', 'Andre', 'Jose', 'Terrell', 'Chris', 'Ray', 'DeAndre', 'Miguel', 'Tyrone', 'Jamal', 'Cedric', 'Hector', 'Willie', 'Earl', 'Calvin', 'Rodney', 'Javier', 'Dwayne', 'Ricky', 'Otis'],
    f: ['Keisha', 'Tasha', 'Maria', 'Brianna', 'Shay', 'Monique', 'Gloria', 'Destiny', 'Imani', 'Rosa', 'Tiana', 'Yolanda', 'Pearl', 'Ruby', 'Bernice', 'Lupe', 'Kiara', 'Aaliyah', 'Denise', 'Carmen', 'Janelle', 'Erica'] };
  const LV_SLOT_N = [0.32, 0.24, 0.12];   // walkers per front door per 5 minutes: day, sunset, night (shops and offices send more)
  function lvCellCount(ci, cj, ph) {
    const A = lvAnchors(ci, cj); if (!A.length) return 0;
    const shops = A.filter(a => a.kind !== 'home').length, n = (A.length - shops) * LV_SLOT_N[ph] + shops * LV_SLOT_N[ph] * 2 * (ph === 2 ? 1.5 : 1);
    const R = lvRng(HNET.seed + ':cn:' + ci + ',' + cj + ':' + ph); return Math.min(6, Math.floor(n + R()));
  }
  // who they are: worked out from their id, so everybody sees the same person
  function lvPersona(id, arch) {
    const R = lvRng('who:' + id), elder = arch === 'elder', fem = R() < 0.48;
    const nm = (fem ? LV_FIRST.f : LV_FIRST.m)[Math.floor(R() * (fem ? LV_FIRST.f : LV_FIRST.m).length)];
    return { fem, elder, name: elder ? (fem ? 'Ms. ' : 'Mr. ') + nm : nm, temper: R(), brave: R(), look: Math.floor(R() * 997), scale: elder ? 0.95 + R() * 0.04 : 0.96 + R() * 0.08, sp: 0 };
  }
  // the walk between two doors: out the door, along the sidewalk (corner to corner, crossing at the intersections), in the next door
  const lvOffCache = new Map();
  function lvWalkOff(ax, az, bx, bz, s) {
    const k = Math.round(ax) + ',' + Math.round(az) + ',' + Math.round(bx) + ',' + Math.round(bz) + ',' + s; let o = lvOffCache.get(k); if (o !== undefined) return o;
    const L = Math.max(0.1, Math.hypot(bx - ax, bz - az)), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz * s, nz = ux * s, mx = (ax + bx) / 2, mz = (az + bz) / 2;
    o = 6.5; for (let r = 2; r <= 22; r += 0.5) if (!lvOnRoad(mx + nx * r, mz + nz * r) && !lvOnRoad(mx + nx * r + ux * 3, mz + nz * r + uz * 3)) { o = r + 1.2; break; }
    lvOffCache.set(k, o); if (lvOffCache.size > 3000) lvOffCache.delete(lvOffCache.keys().next().value);
    return o;
  }
  function lvLeg(W, A, B, sp, R) {
    const nA = hNearestNode(A.ux, A.uz), nB = hNearestNode(B.ux, B.uz); if (nA < 0 || nB < 0) return false;
    const g = gpsGraph(), r = nA === nB ? [] : hRoute(nA, nB); if (!r || r.length > 40) return false;
    const nodes = [nA, ...r], s = R() < 0.5 ? 1 : -1, pts = [[A.x, A.z, 0], [A.ux, A.uz, 0]];
    if (nodes.length >= 2) {
      const seg = []; for (let i = 0; i + 1 < nodes.length; i++) { const ax = g.nx[nodes[i]], az = g.nz[nodes[i]], bx = g.nx[nodes[i + 1]], bz = g.nz[nodes[i + 1]], L = Math.max(0.1, Math.hypot(bx - ax, bz - az)); seg.push({ ax, az, bx, bz, L, ux: (bx - ax) / L, uz: (bz - az) / L, o: lvWalkOff(ax, az, bx, bz, s) }); }
      const nrm = q => [-q.uz * s * q.o, q.ux * s * q.o];
      const proj = (q, x, z) => { const t = clamp((x - q.ax) * q.ux + (z - q.az) * q.uz, 0, q.L), [ox, oz] = nrm(q); return [q.ax + q.ux * t + ox, q.az + q.uz * t + oz]; };
      pts.push([...proj(seg[0], A.ux, A.uz), 0]);
      for (let j = 1; j < seg.length; j++) {
        const p = seg[j - 1], q = seg[j], dot = p.ux * q.ux + p.uz * q.uz, [o1x, o1z] = nrm(p), [o2x, o2z] = nrm(q);
        if (dot < -0.9) continue;
        if (dot > 0.92) pts.push([q.ax + o2x, q.az + o2z, 0]);
        else pts.push([q.ax + o1x + o2x, q.az + o1z + o2z, 0]);
      }
      pts.push([...proj(seg[seg.length - 1], B.ux, B.uz), 0]);
    }
    pts.push([B.ux, B.uz, 0], [B.x, B.z, 0]);
    let t = W.t[W.t.length - 1];
    for (let i = 1; i < pts.length; i++) {
      const [px, pz] = pts[i - 1], [qx, qz] = pts[i], L = Math.hypot(qx - px, qz - pz); if (L < 0.05) continue;
      // cut the stretch where it goes over a road (a side street meeting the block, the street at the corner) so they
      // stop at the curb and cross there instead of strolling through the lane
      const n = Math.max(1, Math.ceil(L)), cuts = [0]; let on = lvOnRoad(px, pz);
      for (let k = 1; k <= n; k++) { const u = k / n, o = lvOnRoad(px + (qx - px) * u, pz + (qz - pz) * u); if (o !== on) { cuts.push(on ? u : (k - 1) / n); on = o; } }
      cuts.push(1);
      for (let k = 1; k < cuts.length; k++) {
        const u0 = cuts[k - 1], u1 = cuts[k], l = L * (u1 - u0); if (l < 0.05) continue;
        const ax = px + (qx - px) * u0, az = pz + (qz - pz) * u0, bx = px + (qx - px) * u1, bz = pz + (qz - pz) * u1;
        const cross = lvOnRoad((ax + bx) / 2, (az + bz) / 2);
        if (cross && l > 4) { t += 0.7 + R() * 1.6; W.x.push(ax); W.z.push(az); W.t.push(t); W.f.push(1); }   // stop at the curb, look both ways
        t += l / (sp * (cross ? 1.18 : 1)); W.x.push(bx); W.z.push(bz); W.t.push(t); W.f.push(cross ? 3 : 0);
      }
    }
    return true;
  }
  // where they're going: the best mix of what they need, how far it is, and a little chance
  function lvDest(R, from, need, ci, cj, used) {
    const C = []; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { for (const q of lvAnchors(ci + a, cj + b)) C.push(q); }
    let best = null, bs = 0;
    for (const q of C) {
      if (q === from || used.includes(q.id)) continue; const d = Math.hypot(q.x - from.x, q.z - from.z); if (d < 45 || d > 270) continue;
      const g = q.kind === 'store' ? 'errand' : q.kind, w = need[g] || 0; if (!w) continue;
      const sc = w * (0.5 + R()) / (1 + d / 170); if (sc > bs) { bs = sc; best = q; }
    }
    return best;
  }
  function lvMakePlan(id) {
    const m = /^p:(\d+):([0-2]):(-?\d+),(-?\d+):(\d+)$/.exec(id); if (!m) return null;
    const slot = +m[1], ph = +m[2], ci = +m[3], cj = +m[4], k = +m[5];
    // every other one might walk with the one before (a couple, two friends)
    if (k % 2 === 1 && lvRng(HNET.seed + ':pair:' + id)() < 0.4) { const P0 = lvPlan(`p:${slot}:${ph}:${ci},${cj}:${k - 1}`); return P0 ? { ...P0, mate: 0.78, who: lvPersona(id, P0.arch), id } : null; }
    const R = lvRng(HNET.seed + ':' + id), A = lvAnchors(ci, cj); if (!A.length) return null;
    const from = A[Math.floor(R() * A.length)];
    let arch = 'shopper', roll = R(); for (const [a, w] of LV_MIX[ph]) { if (roll < w) { arch = a; break; } roll -= w; }
    const AR = LV_ARCH[arch], sp = AR.sp[0] + R() * (AR.sp[1] - AR.sp[0]), need = AR.n[ph];
    const t0 = slot * LVW.slot + R() * LVW.slot, W = { x: [from.x], z: [from.z], t: [t0], f: [2] };
    W.x.push(from.x); W.z.push(from.z); W.t.push(t0 + 0.4); W.f.push(0);
    const d1 = lvDest(R, from, need, ci, cj, []); if (!d1) return null;
    if (!lvLeg(W, from, d1, sp, R)) return null;
    // there for a while: inside (out of sight) or posted up out front (the corner, the meet)
    const outside = d1.kind === 'social' || (d1.kind === 'errand' && R() < 0.2), stay = outside ? 35 + R() * 80 : 25 + R() * 70;
    W.x.push(outside ? d1.ux : d1.x); W.z.push(outside ? d1.uz : d1.z); W.t.push(W.t[W.t.length - 1] + stay); W.f.push(outside ? 4 : 2);
    if (outside) { W.x.push(d1.ux); W.z.push(d1.uz); W.t.push(W.t[W.t.length - 1] + 0.2); W.f.push(0); }
    else { W.x.push(d1.x); W.z.push(d1.z); W.t.push(W.t[W.t.length - 1] + 0.2); W.f.push(0); }
    // then home, or one more stop
    const home = from.kind === 'home' && R() < 0.7 ? from : lvDest(R, d1, need, Math.floor(d1.x / 100), Math.floor(d1.z / 100), [from.id]) || from;
    if (outside) { const O = { ...d1, x: d1.ux, z: d1.uz }; if (!lvLeg(W, O, home, sp, R)) W.f[W.f.length - 1] = 2; }
    else if (!lvLeg(W, d1, home, sp, R)) W.f[W.f.length - 1] = 2;
    W.f[W.f.length - 1] = 2;
    const end = W.t[W.t.length - 1]; if (end - t0 > 900) return null;
    return { id, arch, sp, W, t0, end, who: lvPersona(id, arch), mate: 0 };
  }
  function lvPlan(id) {
    if (LVW.plans.has(id)) return LVW.plans.get(id);
    let P = null; try { P = lvMakePlan(id); } catch (er) { P = null; }
    LVW.stats.plans++; if (!P) LVW.stats.fail++;
    LVW.plans.set(id, P); if (LVW.plans.size > 500) LVW.plans.delete(LVW.plans.keys().next().value);
    return P;
  }
  // where the clock says they are
  function lvAt(P, T) {
    const W = P.W; if (T < W.t[0] || T >= P.end) return null;
    let lo = 0, hi = W.t.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (W.t[mid] <= T) lo = mid; else hi = mid; }
    const ax = W.x[lo], az = W.z[lo], bx = W.x[hi], bz = W.z[hi], f = W.f[hi], u = clamp((T - W.t[lo]) / Math.max(1e-3, W.t[hi] - W.t[lo]), 0, 1);
    const L = Math.hypot(bx - ax, bz - az), moving = L > 0.05;
    let x = ax + (bx - ax) * u, z = az + (bz - az) * u, yaw = moving ? Math.atan2(-(bx - ax), -(bz - az)) : null;
    if (yaw === null) for (let i = lo; i > 0 && yaw === null; i--) if (Math.hypot(W.x[i] - W.x[i - 1], W.z[i] - W.z[i - 1]) > 0.05) yaw = Math.atan2(-(W.x[i] - W.x[i - 1]), -(W.z[i] - W.z[i - 1]));
    if (P.mate && yaw !== null) { const c = Math.cos(yaw), s = Math.sin(yaw); x += c * P.mate; z -= s * P.mate; }
    return { x, z, yaw: yaw || 0, moving, hide: f === 2 && !moving, post: f === 4, curb: f === 1 && !moving, cross: f === 3, i: hi };
  }

  // ---------- the people themselves ----------
  // a couple dozen extra looks, built one at a time while you play so it never hitches
  function lvGrow() {
    if (LVW.looks.length >= LVW.pool) return;   // one per spawn pass (twice a second)
    const i = LVW.looks.length, R = lvRng('look:' + i), fem = i % 2 === 1, L = PEOPLE.randomLook(R, fem);
    const old = i % 5 === 3 || i % 5 === 4;
    if (old) { L.hair = R() < 0.5 ? '#9a9a9a' : '#e8e8e8'; L.hat = 'no_hat'; L.extras = L.extras.filter(x => !/grill|chain|cuban|tennis|septum|nose/.test(x)); }   // the older folks
    try { LVW.looks.push({ P: hNameParts(PEOPLE.build(L, 1)), fem, old }); } catch (er) { LVW.pool = LVW.looks.length; }
  }
  function lvBody(who) {
    const fit = LVW.looks.filter(l => l.fem === who.fem && !!who.elder === l.old), use = fit.length ? fit : LVW.looks.filter(l => l.fem === who.fem);
    if (use.length) { const B = use[who.look % use.length]; return hClone(B.P); }
    return crowdPerson(who.look);
  }
  function lvEnt(id, P, who, extra) {
    const body = lvBody(who); if (!body) return null;
    const e = hEnt(Object.assign({ id, kind: 'ped', name: who.name, who, pl: P, mode: 'walk', hp: who.elder ? 70 : 90, ox: 0, oz: 0, hy: 0, hx: 0 }, extra));
    hDress(e, body); body.wrap.scale.setScalar(who.scale);
    if (lvMem(e) && lvMem(e).met) hLabel(e);
    LVW.stats.spawned++; return e;
  }
  function lvMakeWalker(id) {
    if (LVW.off.has(id) || hGoneDead(id)) return null;
    const P = lvPlan(id); if (!P) return null;
    const s = lvAt(P, hNow() / 1000); if (!s) return null;
    const e = lvEnt(id, P, P.who, { x: s.x, z: s.z, yaw: s.yaw }); if (e) e.hide = s.hide; return e;
  }
  // named locals: the clerk smoking out front, the mechanic, the OG on the corner, the lady on her porch
  const LV_ROLE = { errand: 'Works at', food: 'Cooks at', work: 'Works at', social: 'Always at', home: 'Lives on', church: 'Deacon at' };
  function lvLocalAt(a, ph) {
    const R = lvRng(HNET.seed + ':local:' + a.id), roll = R(), porch = a.kind === 'home';
    if (porch ? roll > 0.045 : roll > 0.55) return null;
    const who = lvPersona('L' + a.id, porch || R() < 0.25 ? 'elder' : 'worker');
    if (porch && ph === 2) return null;
    if (!porch && ph === 2 && !/corner|gas|food|liquor|club/.test(a.p ? a.p.type : '')) return null;
    if (!porch && a.p && a.p.type === 'corner') who.name = (who.fem ? 'Ms. ' : 'Unc ') + who.name.replace(/^(Ms\.|Mr\.) /, '');
    const side = R() < 0.5 ? 1 : -1, tx = -a.oz, tz = a.ox;
    for (const k of [side, -side]) { const x = a.ux + tx * 2.2 * k, z = a.uz + tz * 2.2 * k; if (!lvSolid(x, z, 0.4) && !lvOnRoad(x, z)) return { who, x, z, yaw: Math.atan2(-a.ox, -a.oz) + Math.PI, place: a.p ? goShort(a.p.name) : streetAt(a.x, a.z) ? streetAt(a.x, a.z).name : lvDist(a.x, a.z), role: LV_ROLE[a.kind] || 'Always at', porch }; }
    if (!lvSolid(a.ux, a.uz, 0.4)) return { who, x: a.ux, z: a.uz, yaw: Math.atan2(-a.ox, -a.oz) + Math.PI, place: a.p ? goShort(a.p.name) : lvDist(a.x, a.z), role: LV_ROLE[a.kind] || 'Always at', porch };
    return null;
  }
  function lvMakeLocal(id) {
    if (hGoneDead(id)) return null;
    const m = /^p:L:(-?\d+),(-?\d+):(.+)$/.exec(id); if (!m) return null;
    const a = lvAnchors(+m[1], +m[2]).find(q => q.id === m[3]); if (!a) return null;
    const L = lvLocalAt(a, lvPhase()); if (!L) return null;
    return lvEnt(id, null, L.who, { x: L.x, z: L.z, yaw: L.yaw, hx: L.x, hz: L.z, hyaw: L.yaw, mode: 'post', local: L, hp: 100 });
  }
  // somebody else's game told us about one of ours: make the same person
  const _lvMake = hMake;
  hMake = function (id, d) {
    if (typeof id === 'string' && id.startsWith('p:')) { try { return id.startsWith('p:L:') ? lvMakeLocal(id) : lvMakeWalkerAny(id); } catch (er) { return null; } }
    return _lvMake.apply(this, arguments);
  };
  function lvMakeWalkerAny(id) { const P = lvPlan(id); if (!P) return null; const s = lvAt(P, hNow() / 1000) || { x: P.W.x[0], z: P.W.z[0], yaw: 0 }; return lvEnt(id, P, P.who, { x: s.x, z: s.z, yaw: s.yaw }); }

  // ---------- spawning around you ----------
  function lvSpawn(mx, mz) {
    lvGrow(); if (LVW.looks.length < Math.min(4, LVW.pool) && CROWD.length < CROWD_N) return;
    const T = hNow() / 1000, slot = Math.floor(T / LVW.slot), ph = lvPhase(), ci0 = Math.floor(mx / 100), cj0 = Math.floor(mz / 100);
    const peds = HOOD.ents.filter(e => e.kind === 'ped' && !e.gone), walkers = peds.filter(e => !e.local), locals = peds.filter(e => e.local);
    // too far: gone (the ones you're dealing with stay)
    for (const e of peds) { const d = Math.hypot(e.x - mx, e.z - mz); if (d > (e.own ? 320 : e.local ? 200 : 175)) hKill(e); }
    let budget = LVW.budget; const cand = [], lc = [];
    const cells = []; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const cx = (ci0 + a) * 100 + 50, cz = (cj0 + b) * 100 + 50, d = Math.hypot(cx - mx, cz - mz); if (d < 190) cells.push([d, ci0 + a, cj0 + b]); }
    cells.sort((p, q) => p[0] - q[0]);
    for (const [, ci, cj] of cells) {
      if (!LVW.anchors.has(ci + ',' + cj)) { if (budget <= 0) continue; budget--; }
      const A = lvAnchors(ci, cj);
      for (const a of A) { const id = `p:L:${ci},${cj}:${a.id}`; if (HOOD.byEnt.has(id) || hGoneDead(id)) continue; const L = lvLocalAt(a, ph); if (L && Math.hypot(L.x - mx, L.z - mz) < 150) lc.push([Math.hypot(L.x - mx, L.z - mz), id]); }
      const n = lvCellCount(ci, cj, ph);
      for (let s = slot - 2; s <= slot; s++) for (let k = 0; k < n; k++) {
        const id = `p:${s}:${ph}:${ci},${cj}:${k}`; if (HOOD.byEnt.has(id) || LVW.off.has(id) || hGoneDead(id)) continue;
        if (!LVW.plans.has(id)) { if (budget <= 0) continue; budget--; }
        const P = lvPlan(id); if (!P) continue; const st = lvAt(P, T); if (!st) continue;
        const d = Math.hypot(st.x - mx, st.z - mz); if (d > 150) continue;
        // don't pop in right in front of you: only out a door, inside, or further off
        if (d < 50 && !st.hide && T - P.t0 > 3 && performance.now() - LVW.born > 20000) continue;
        cand.push([d, id]);
      }
    }
    lc.sort((p, q) => p[0] - q[0]); for (const [, id] of lc.slice(0, Math.max(0, LVW.lcap - locals.length))) lvMakeLocal(id);
    cand.sort((p, q) => p[0] - q[0]); let room = LVW.cap - walkers.length;
    for (const [, id] of cand) { if (room <= 0) break; if (lvMakeWalker(id)) room--; }
    // over the cap (you drove somewhere busier): the furthest ones you can't see go first
    const live = HOOD.ents.filter(e => e.kind === 'ped' && !e.gone && !e.local && !e.own).sort((p, q) => Math.hypot(q.x - mx, q.z - mz) - Math.hypot(p.x - mx, p.z - mz));
    for (let i = 0; i < live.length - LVW.cap; i++) if (live[i].hide || Math.hypot(live[i].x - mx, live[i].z - mz) > 90) hKill(live[i]);
  }

  // ---------- moving: on the clock, then by themselves once somebody deals with them ----------
  function lvSmooth(e, x, z, dt, yawWant) {
    const ox = e.x, oz = e.z, k = 1 - Math.exp(-dt * 7);
    e.x += (x - e.x) * k; e.z += (z - e.z) * k;
    const v = Math.hypot(e.x - ox, e.z - oz) / Math.max(dt, 1e-3); e.vs = (e.vs || 0) + (v - (e.vs || 0)) * Math.min(1, dt * 6);
    const want = e.vs > 0.25 ? Math.atan2(-(e.x - ox), -(e.z - oz)) : yawWant;
    if (want != null) { const dy = hNorm(want - e.yaw), mx = dt * (e.vs > 2.5 ? 7 : 4.5); e.yaw += clamp(dy, -mx, mx); }
    if (e.vs > 0.25) { e.walk += dt * e.vs * Math.PI * 2 / (e.vs > 3.5 ? 3.8 : 1.45); e.moving = e.vs > 3.5 ? 2 : 1; e.mvT = performance.now(); e.mvR = e.vs > 3.5; }
  }
  // personal space: they step around you, each other and anything else on the sidewalk, then drift back onto their line
  function lvAvoid(e, dt, mx, mz, d) {
    let px = 0, pz = 0;
    const R = lvRepTier(e.x, e.z), wide = (R === 'feared' || R === 'hated' || lvTier(e) === 'scared') ? 3.2 : 1.6;
    if (foot.on && d < wide) { const k = (wide - d) / wide; px += (e.x - mx) / Math.max(d, 0.2) * k * 2.4; pz += (e.z - mz) / Math.max(d, 0.2) * k * 2.4; }
    for (const o of HOOD.ents) { if (o === e || o.gone || o.inCar || o.hide || o.down) continue; const dx = e.x - o.x, dz = e.z - o.z, dd = dx * dx + dz * dz; if (dd > 1.2 || dd < 1e-4) continue; const q = Math.sqrt(dd), k = (1.1 - q) / 1.1; px += dx / q * k * 1.4; pz += dz / q * k * 1.4; }
    e.ox = clamp((e.ox + px * dt * 3) * Math.exp(-dt * 0.9), -2.4, 2.4); e.oz = clamp((e.oz + pz * dt * 3) * Math.exp(-dt * 0.9), -2.4, 2.4);
  }
  // off the clock: follow the rest of their trip on their own (the next point that's ahead of them), in the next door and gone
  function lvFollow(e, dt, run) {
    const W = e.pl && e.pl.W; if (!W) return lvGoIn(e, dt, run);
    if (e.wi == null) { let bi = W.x.length - 1, bd = 1e9; for (let i = 1; i < W.x.length; i++) { const d = Math.hypot(W.x[i] - e.x, W.z[i] - e.z); if (d < bd && W.t[i] >= hNow() / 1000 - 5) { bd = d; bi = i; } } e.wi = bi; }
    while (e.wi < W.x.length && W.f[e.wi] === 1) e.wi++;
    if (e.wi >= W.x.length) { lvGone(e); return; }
    const tx = W.x[e.wi], tz = W.z[e.wi];
    if (Math.hypot(tx - e.x, tz - e.z) < 0.6) { if (W.f[e.wi] === 2) { lvGone(e); return; } e.wi++; return; }
    lvStep(e, tx, tz, dt, run);
  }
  function lvStep(e, tx, tz, dt, run) {
    if (!hFootMove(e, tx, tz, dt, run)) {
      e.stuck = (e.stuck || 0) + dt; const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz) || 1, sp = (run ? 5 : 1.4) * dt;
      e.x += dx / d * sp; e.z += dz / d * sp; e.yaw += hNorm(Math.atan2(-dx, -dz) - e.yaw) * Math.min(1, dt * 8); e.walk += dt * (run ? 5 : 1.4) * Math.PI * 2 / (run ? 3.8 : 1.55); e.moving = run ? 2 : 1;
    } else e.stuck = 0;
  }
  // the closest door that isn't toward the trouble
  function lvGoIn(e, dt, run, from) {
    if (!e.door) {
      let best = null, bs = 1e9; const ci = Math.floor(e.x / 100), cj = Math.floor(e.z / 100);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const q of lvAnchors(ci + a, cj + b)) {
        const d = Math.hypot(q.x - e.x, q.z - e.z); if (d > 90) continue;
        const toward = from ? Math.hypot(q.x - from[0], q.z - from[1]) < Math.hypot(e.x - from[0], e.z - from[1]) - 4 : false;
        const sc = d + (toward ? 120 : 0); if (sc < bs) { bs = sc; best = q; }
      }
      e.door = best ? [best.ux, best.uz, best.x, best.z] : [e.x + (from ? (e.x - from[0]) : 1) * 30, e.z + (from ? (e.z - from[1]) : 0) * 30, null, null];
      e.dstep = 0;
    }
    const [ux, uz, dx, dz] = e.door, at = e.dstep ? [dx, dz] : [ux, uz];
    if (at[0] == null || Math.hypot(at[0] - e.x, at[1] - e.z) < 0.7) { if (e.dstep || dx == null) { lvGone(e); return; } e.dstep = 1; return; }
    lvStep(e, at[0], at[1], dt, run);
  }
  // inside (or out of sight): done for good, nobody brings them back off the clock
  function lvGone(e) { LVW.off.add(e.id); hKill(e); }
  function lvClaim(e) { if (e.own && e.own !== 'me') return false; if (!e.own) hClaim(e); LVW.off.add(e.id); return true; }

  // ---------- the brain ----------
  function lifePed(e, dt, mx, mz, d) {
    e.far = d > (phone ? 65 : 125) && e.own !== 'me';   // too far to matter on a phone: not drawn
    if (e.down || (e.own && e.own !== 'me')) return;
    e.t = (e.t || 0) + dt;
    const G = window.__guns, aiming = !!(G && G.GUN && G.GUN.want && foot.on);
    // your car coming at them: jump out the way, or get hit
    if (hInCar() && !e.hide && Math.abs(drv.v) > 3.5 && d < 4 + Math.abs(drv.v) && e.mode !== 'fall') {
      const fx = -Math.sin(drv.yaw) * Math.sign(drv.v), fz = -Math.cos(drv.yaw) * Math.sign(drv.v), rx = e.x - mx, rz = e.z - mz, ahead = rx * fx + rz * fz, side = rx * -fz + rz * fx;
      if (ahead > -2.4 && ahead < 2.6 && Math.abs(side) < 1.15 && !e.hitT) { lvCarHit(e, Math.abs(drv.v)); return; }
      if (ahead > 2 && ahead < 3 + Math.abs(drv.v) * 0.9 && Math.abs(side) < 2.4 && e.mode !== 'panic' && !e.dodged) {
        if (lvClaim(e)) { e.dodged = true; const sg = side >= 0 ? 1 : -1; e.jx = -fz * sg * 2.6; e.jz = fx * sg * 2.6; e.mode = 'panic'; e.t = 0; e.from = [mx, mz]; e.door = null; hSay(e, lvPick(['dodge'], e)); lvRemember(e, 'car_close', -8, 6); lvRepAdd(e.x, e.z, -1, 1, 0); return; }
      }
    }
    // a gun on them
    if (aiming && d < 24 && !e.hide && e.mode !== 'panic' && e.mode !== 'fall' && e.mode !== 'cower') {
      const cy = foot.camYaw != null ? foot.camYaw : foot.yaw, fx = -Math.sin(cy), fz = -Math.cos(cy), rx = (e.x - mx) / Math.max(d, 0.1), rz = (e.z - mz) / Math.max(d, 0.1);
      if (rx * fx + rz * fz > 0.975 && e.mode !== 'hands' && lvClaim(e)) { e.mode = 'hands'; e.t = 0; hSay(e, lvPick(['hands'], e), true); lvRemember(e, 'aim', -15, 25); lvRepAdd(e.x, e.z, -2, 3, 1); if (lvRepTier(e.x, e.z) === 'hated' || e.who.brave > 0.6) lvCall(e, 'man with a gun', 0.55); }
    }
    if (!e.own) return lvOnClock(e, dt, mx, mz, d);
    lvOffClock(e, dt, mx, mz, d, aiming);
  }
  function lvOnClock(e, dt, mx, mz, d) {
    if (e.local) return lvLocal(e, dt, mx, mz, d);
    const s = lvAt(e.pl, hNow() / 1000); if (!s) { hKill(e); return; }
    e.hide = s.hide; e.mode = s.post ? 'post' : s.hide ? 'dwell' : 'walk';
    if (s.hide) { e.x = s.x; e.z = s.z; e.ox = e.oz = 0; return; }
    lvAvoid(e, dt, mx, mz, d);
    lvSmooth(e, s.x + e.ox, s.z + e.oz, dt, s.curb ? s.yaw + Math.sin(e.t * 1.7) * 0.9 : s.post ? lvPostYaw(e, s.yaw) : s.yaw);
    e.curb = s.curb;
    // walking past you: a nod, a hey, or eyes down
    if (foot.on && d < 3.6 && d > 1 && !e.nod && performance.now() - LVW.nodT > 5000) {
      const toMe = Math.atan2(-(mx - e.x), -(mz - e.z)); if (Math.abs(hNorm(toMe - e.yaw)) < 1.2) {
        e.nod = true; const rt = lvRepTier(e.x, e.z), r = hRnd();
        if (rt === 'hero' || (rt === 'respected' && r < 0.6)) { LVW.nodT = performance.now(); hSay(e, lvPick(['pass.hero'], e)); }
        else if (rt === 'feared' || rt === 'hated') { LVW.nodT = performance.now(); if (r < 0.5) hSay(e, lvPick(['pass.feared'], e)); }
        else if (r < 0.4) { LVW.nodT = performance.now(); hSay(e, lvPick(['pass', lvPhase() === 2 ? 'pass.2' : 'pass'], e)); }
      }
    }
    // walked right into you
    if (foot.on && d < 0.65 && !e.bumped) { e.bumped = true; hSay(e, lvPick(['bump'], e)); lvRemember(e, 'bump', -3, 0); }
  }
  // posted out front: face the street, turn to watch people come by
  const lvPostYaw = (e, y) => { const ph = Math.floor(hNow() / 9000 + hHash(e.id) % 7); return y + ((hHash(e.id + ph) % 100) / 100 - 0.5) * 1.6; };
  function lvLocal(e, dt, mx, mz, d) {
    e.mode = 'post'; e.hide = false;
    const ph = Math.floor((hNow() / 1000 + hHash(e.id) % 11) / 11), q = hHash(e.id + ':' + ph), tx = e.hx + ((q % 100) / 100 - 0.5) * 2.4, tz = e.hz + ((Math.floor(q / 100) % 100) / 100 - 0.5) * 2.4;
    if (e.local.porch) { lvSmooth(e, e.hx, e.hz, dt, d < 12 ? Math.atan2(-(mx - e.x), -(mz - e.z)) : e.hyaw); return; }
    if (d < 7) lvSmooth(e, e.x, e.z, dt, Math.atan2(-(mx - e.x), -(mz - e.z))); else lvSmooth(e, tx, tz, dt, lvPostYaw(e, e.hyaw));
    if (foot.on && d < 5 && !e.nod && performance.now() - LVW.nodT > 4000) { e.nod = true; LVW.nodT = performance.now(); const t = lvTier(e); if (t !== 'stranger' || hRnd() < 0.5) hSay(e, lvGreetLine(e)); }
    if (d > 14) e.nod = false;
  }
  function lvOffClock(e, dt, mx, mz, d, aiming) {
    const run = e.mode === 'panic';
    switch (e.mode) {
      case 'chat': {
        e.chatT = (e.chatT || 10) - dt; lvSmooth(e, e.x, e.z, dt, Math.atan2(-(mx - e.x), -(mz - e.z)));
        if ((e.chatT <= 0 && menuFn === null) || d > 6) { if (e.chatT > -50 && d < 8) hSay(e, lvPick(['bye'], e)); e.mode = e.local ? 'home' : 'walk'; e.chatT = 0; }
        return;
      }
      case 'hands': {
        lvSmooth(e, e.x, e.z, dt, Math.atan2(-(mx - e.x), -(mz - e.z)));
        if (aiming && d < 26) { e.t = Math.min(e.t, 0.5); return; }
        if (e.t > 2.5) { e.mode = e.who.brave > 0.75 && !e.local ? 'walk' : 'panic'; e.t = 0; e.from = [mx, mz]; e.door = null; }
        return;
      }
      case 'cower': { if (e.t > (e.cowT || 3)) { e.mode = e.film ? 'film' : 'panic'; e.t = 0; e.door = null; } return; }
      case 'fall': { if (e.t > 2.6) { e.mode = 'panic'; e.t = 0; e.door = null; e.from = [mx, mz]; hSay(e, lvPick(['hitcar'], e), true); } return; }
      case 'film': {
        const sc = e.scene; if (!sc) { e.mode = 'walk'; return; }
        if (!e.spot) { const a = Math.atan2(e.z - sc.z, e.x - sc.x), r = 12 + (hHash(e.id) % 6); e.spot = [sc.x + Math.cos(a) * r, sc.z + Math.sin(a) * r]; }
        if (Math.hypot(e.spot[0] - e.x, e.spot[1] - e.z) > 0.8) lvStep(e, e.spot[0], e.spot[1], dt, false);
        else { e.yaw += hNorm(Math.atan2(-(sc.x - e.x), -(sc.z - e.z)) - e.yaw) * Math.min(1, dt * 4); if (e.t > 3 && !e.saidF && hRnd() < dt * 0.3) { e.saidF = true; hSay(e, lvPick(['film'], e)); } }
        if (e.t > 28 + (hHash(e.id) % 14)) { e.mode = e.local ? 'home' : 'walk'; e.spot = null; e.scene = null; }
        return;
      }
      case 'panic': {
        if (e.jx) { const k = Math.min(1, dt * 7); e.x += e.jx * k; e.z += e.jz * k; e.jx *= 1 - k; e.jz *= 1 - k; e.moving = 2; e.walk += dt * 8; if (Math.abs(e.jx) + Math.abs(e.jz) < 0.15) { e.jx = e.jz = 0; e.mode = e.local ? 'home' : 'walk'; } return; }
        if (e.local && e.t > 12) { e.mode = 'home'; return; }
        lvGoIn(e, dt, true, e.from); if (!e.gone && e.t > 4 && Math.random() < dt * 0.15) hSay(e, lvPick(['shots'], e));
        return;
      }
      case 'home': {   // a local walking back to their spot, then theirs again (back on the clock for everybody)
        if (Math.hypot(e.hx - e.x, e.hz - e.z) > 0.6) { lvStep(e, e.hx, e.hz, dt, false); return; }
        e.mode = 'post'; if (d > 30) e.own = null; return;
      }
      case 'post': { if (e.local) { lvLocal(e, dt, mx, mz, d); if (d > 40) e.own = null; return; } e.mode = 'walk'; return; }
      case 'leave': { if (e.local) { e.mode = 'home'; return; } lvGoIn(e, dt, false); return; }
      case 'idle': case 'walk': default: {
        if (e.local) { e.mode = 'home'; return; }
        e.mode = 'walk'; lvFollow(e, dt, run);
      }
    }
  }
  // your car hit them: knocked down, hurt (or worse), everybody saw it
  function lvCarHit(e, v) {
    if (!lvClaim(e)) return;
    e.hitT = 1; const dmg = v * 7.5;
    lvRemember(e, 'hitcar', -50, 40); lvEvent('hitrun', e.x, e.z, { victim: e });
    e.hp -= dmg; if (e.hp <= 0) { hDrop(e, 'me'); return; }
    e.mode = 'fall'; e.t = 0; hSay(e, lvPick(['hitcar'], e), true);
  }
  // they pick up the phone
  function lvCall(e, why, p) {
    const C = window.__cops; if (!C || !C.copWitnessCall || hRnd() > p) return;
    try { C.copWitnessCall(e.x, e.z, why, 6, false, 1, { lines: ['yeah 911?', "I'm calling the police", 'hello 911?'] }); } catch (er) {}
  }

  // ---------- what happened: people see it, react, and talk about it ----------
  // nobody around, nobody saw it: no story, no name
  function lvWitnesses(x, z, R) {
    let n = 0; for (const e of HOOD.ents) if (!e.gone && !e.down && !e.hide && e.kind !== 'homie' && Math.hypot(e.x - x, e.z - z) < R) n++;
    if (typeof STREET !== 'undefined') for (const q of STREET.list) { const w = q.P.wrap.position; if (Math.hypot(w.x - x, w.z - z) < R) n++; }
    return n;
  }
  function lvNews(kind, x, z, o = {}) {
    const T = LV_NEWS[kind]; if (!T) return null;
    const d = lvDist(x, z), st = (streetAt(x, z) || {}).name || d, R = lvRep(d), car = S.car ? carOf(S.car.id).model : '';
    const who = R.k >= 15 ? (S.name || 'somebody') : car && hInCar() ? `somebody in a ${car}` : 'somebody';
    const txt = lvFill(hPick(T), null, { street: st, who }), N = lvS().news;
    if (N.length && N[0].k === kind && N[0].d === d && Date.now() - N[0].t < 90000) return N[0];
    const it = { t: Date.now(), k: kind, d, txt }; N.unshift(it); N.length = Math.min(N.length, 16);
    // the big ones get around town
    if (/bystander|hitrun|drop/.test(kind) && typeof addGossip === 'function') { try { addGossip({ kind: 'rumor', icon: kind === 'hitrun' ? '🚗' : '🗣', text: `People in ${d} saying ${txt}.` }); } catch (er) {} }
    return it;
  }
  function lvEvent(kind, x, z, o = {}) {
    const wit = lvWitnesses(x, z, kind === 'shots' ? 90 : 55);
    if (kind === 'shots') {
      lvReactAll(x, z, 75, 'shots');
      if (!wit) return; lvRepAdd(x, z, -1, 3, 0);
      if (Date.now() - LVW.shotNewsT > 60000) { LVW.shotNewsT = Date.now(); lvNews('shots', x, z); }
      return;
    }
    if (kind === 'drop') {
      lvReactAll(x, z, 60, 'shots'); LVW.scenes.push({ x, z, t: performance.now() }); if (LVW.scenes.length > 4) LVW.scenes.shift();
      if (!wit) return;
      const v = o.victim, mine = o.by === 'me';
      if (v && v.kind === 'ped' && v.hitT) return;
      if (v && v.kind === 'ped') { if (mine) { lvRepAdd(x, z, -20, 14, 4); lvNews('bystander', x, z); } else lvNews('drop', x, z); return; }
      if (mine) { const set = hS().set, b = hBlockAt(x, z), home = set && b && hOwner(b) === set; lvRepAdd(x, z, home ? 3 : -4, 9, 4); }
      lvNews('drop', x, z); return;
    }
    if (kind === 'hitrun') { lvReactAll(x, z, 30, 'shock'); if (!wit) return; lvRepAdd(x, z, -10, 4, 2); lvNews('hitrun', x, z); const C = window.__cops; if (C && C.copWitnessCall) try { C.copWitnessCall(x, z, 'hit and run', 70, true, 0.7, { lines: ['they hit somebody!', 'yeah 911, a car just hit somebody'] }); } catch (er) {} return; }
    if (kind === 'race') { if (!wit) return; lvRepAdd(x, z, 1, 0, o.won ? 4 : 1); if (o.won) lvNews('race', x, z); return; }
    if (kind === 'gift') { lvRepAdd(x, z, o.big ? 3 : 1, 0, 1); if (o.big || hRnd() < 0.3) lvNews('gift', x, z); return; }
    if (kind === 'job') { lvRepAdd(x, z, 4, 0, 3); if (hRnd() < 0.5) lvNews('job', x, z); }
  }
  // everybody close enough to hear it does something about it
  function lvReactAll(x, z, R, why) {
    const [mx, mz] = hMe();
    for (const e of HOOD.ents) {
      if (e.gone || e.down || e.hide || e.kind !== 'ped' || (e.own && e.own !== 'me')) continue;
      const d = Math.hypot(e.x - x, e.z - z); if (d > R || e.mode === 'fall') continue;
      if (!lvClaim(e)) continue;
      const byMe = Math.hypot(mx - x, mz - z) < 6;
      if (byMe && d < 30) lvRemember(e, 'saw_shot', -10, 15);
      e.from = [x, z]; e.door = null; e.t = 0;
      if (why === 'shock') { e.mode = 'cower'; e.cowT = 1.5; e.film = e.who.brave > 0.55; e.scene = { x, z }; continue; }
      if (d < 22 || e.who.brave < 0.35) { e.mode = 'cower'; e.cowT = 1.6 + (hHash(e.id) % 30) / 10; e.film = e.who.brave > 0.7 && !e.local; e.scene = { x, z }; if (d < 22 && hRnd() < 0.5) hSay(e, lvPick(['shots'], e)); }
      else if (e.who.brave > 0.72 && !e.local) { e.mode = 'film'; e.scene = { x, z }; }
      else e.mode = 'panic';
    }
    if (typeof STREET !== 'undefined') for (const q of STREET.list) { const w = q.P.wrap.position; if (Math.hypot(w.x - x, w.z - z) < R) q.cow = performance.now() + 3500 + (q.ph || 0) * 400; }
  }
  // after a drop: a few people who stuck around walk up and film it
  function lvScenes() {
    const now = performance.now(); LVW.scenes = LVW.scenes.filter(s => now - s.t < 60000);
    for (const sc of LVW.scenes) {
      if (now - sc.t < 7000 || sc.filled) continue; sc.filled = true; let n = 0;
      for (const e of HOOD.ents) { if (n >= 4 || e.gone || e.down || e.hide || e.kind !== 'ped' || e.local || (e.own && e.own !== 'me')) continue; const d = Math.hypot(e.x - sc.x, e.z - sc.z); if (d > 95 || d < 6) continue; if (e.mode === 'panic' && e.who.brave < 0.5) continue; if (!lvClaim(e)) continue; e.mode = 'film'; e.t = 0; e.scene = sc; e.spot = null; n++; }
    }
  }

  // ---------- hooks into what you already do ----------
  const _lvShotHook = window.__shotHook;
  window.__shotHook = (O, D, best, t0) => {
    try { if (O && performance.now() / 1000 - LVW.lastShot > 0.35) { LVW.lastShot = performance.now() / 1000; lvEvent('shots', O.x, O.z); } } catch (er) {}
    return _lvShotHook ? _lvShotHook(O, D, best, t0) : undefined;
  };
  const _lvDrop = hDrop;
  hDrop = function (e, by = 'me') {
    const was = e.down; const r = _lvDrop.apply(this, arguments);
    if (!was && e.down && by !== 'net') try {
      if (by === 'me') lvRemember(e, 'shot', -60, 50);
      lvEvent('drop', e.x, e.z, { victim: e, by });
      if (e.kind === 'ped' && by === 'me') { toast(`You dropped ${e.name}, just somebody walking by. ${lvDist(e.x, e.z)} won't forget that.`, 'bad'); S.heat = Math.min(5, (S.heat || 0) + 1); }
    } catch (er) {}
    return r;
  };
  const _lvShotAt = hShotAt;
  hShotAt = function (e, dmg) {
    if (e.kind === 'ped' && !e.down) { lvRemember(e, 'shot', -40, 40); if (lvClaim(e)) { e.mode = 'panic'; e.t = 0; e.door = null; const [mx, mz] = hMe(); e.from = [mx, mz]; } }
    else if (e.kind === 'member' || e.kind === 'reg') lvRemember(e, 'shot', -35, 20);
    return _lvShotAt.apply(this, arguments);
  };
  const _lvRide = hRideAsk;
  hRideAsk = function (e) { const r = _lvRide.apply(this, arguments); if (HOOD.ride && HOOD.ride.e === e) lvRemember(e, 'ride', 6, 0); return r; };

  // ---------- talking to people ----------
  function lvOnTalk(e) {
    if (e.kind === 'ped' && /^(walk|post|dwell|chat|film|home|idle)$/.test(e.mode || 'walk') && !e.hide) { if (lvClaim(e) || e.own === 'me') { e.mode = 'chat'; e.chatT = 14; e.t = 0; } }
    const m = lvRemember(e, 'talk', 1, -2);
    if (m.met === 1 && e.kind === 'ped' && !e.label) hLabel(e);
  }
  function lvTalkMenu(e) {
    return () => {
      if (e.gone) return null;
      const rows = [], m = lvMem(e, true), tier = lvTier(e), L = e.local, [mx, mz] = hMe(), q = lvS().q, scared = tier === 'scared' || tier === 'enemy';
      rows.push({ t: 'Wsg', s: m.met > 1 ? `You've talked ${m.met} times` : 'Say what\'s up', btn: 'Talk', act: () => { e.chatT = 14; hSay(e, lvGreetLine(e), true); } });
      if (!m.introduced) rows.push({ t: 'What\'s your name?', s: 'Get to know them', btn: 'Ask', act: () => { m.introduced = 1; e.chatT = 14; hSay(e, scared ? '...why you need to know' : L ? `${e.name}. ${L.role.toLowerCase()} ${L.place}` : hPick([`${e.name}`, `im ${e.name}`, `${e.name}, and you?`]), true); if (!e.label) hLabel(e); lvRemember(e, 'name', 2, 0); } });
      rows.push({ t: 'What\'s going on around here?', s: 'News, rumors, who to watch for', btn: 'Ask', act: () => { e.chatT = 14; lvAskNews(e); } });
      if (q && q.to && q.toId === e.id) rows.push({ t: `Drop off ${q.what}`, s: `From ${q.fromName}`, btn: 'Hand it over', act: () => { lvQuestDone(e); closeMenu(); } });
      if (L) {
        const work = !q && (m.a >= 15 || (lvRepTier(mx, mz) === 'respected' || lvRepTier(mx, mz) === 'hero'));
        rows.push({ t: 'Got any work for me?', s: q ? 'You already got a run going' : work ? 'They might need something done' : 'They don\'t know you like that yet', btn: 'Ask', off: !!q, act: () => { e.chatT = 14; if (!work) { hSay(e, hPick(['i dont know you like that yet', 'come back around more, then we talk', 'maybe one day']), true); return; } lvQuestGive(e); closeMenu(); } });
        const lk = lvS().look[e.id];
        rows.push({ t: lk ? 'Stop looking out for me' : 'Look out for me', s: lk ? 'They text you when the police come through' : m.a >= 50 ? 'Text you when the police come through here' : 'Only for people they really rock with', btn: lk ? 'Stop' : 'Ask', off: !lk && m.a < 50, act: () => { const S2 = lvS(); if (S2.look[e.id]) delete S2.look[e.id]; else { S2.look[e.id] = { n: e.name, d: lvDist(e.x, e.z), x: e.hx, z: e.hz }; hSay(e, 'i got you. i see 12, you gon know', true); } save(); } });
      } else {
        rows.push({ t: 'Where\'s the closest food or gas?', s: 'They point you to it (GPS)', btn: 'Ask', act: () => { e.chatT = 14; lvDirections(e); } });
      }
      rows.push({ t: 'Here, take $20', s: tier === 'friend' ? 'They already love you' : 'Makes their day', btn: money(20), act: () => { if (!spend(20, `gave ${e.name} $20`)) return; hSay(e, lvPick(['gift'], e), true); lvRemember(e, 'gift', 12, -10); lvEvent('gift', e.x, e.z, {}); refreshStats(); } });
      rows.push({ t: 'Look out for them ($100)', s: 'Help them out for real', btn: money(100), act: () => { if (!spend(100, `helped ${e.name} out`)) return; hSay(e, lvPick(['gift'], e), true); lvRemember(e, 'gift', 28, -20); lvEvent('gift', e.x, e.z, { big: true }); refreshStats(); } });
      rows.push({ t: 'Talk down', s: 'Disrespect them', btn: 'Talk down', act: () => { lvRemember(e, 'down', -25, 12); lvRepAdd(e.x, e.z, -2, 2, 0); const sc = e.who.temper < 0.4 || lvTier(e) === 'scared'; hSay(e, lvPick([sc ? 'downtalk.scared' : 'downtalk'], e), true); if (sc && e.kind === 'ped' && !L) { e.mode = 'leave'; e.door = null; } closeMenu(); } });
      const rt = lvRepTier(mx, mz);
      return { title: e.name, sub: `${L ? `${L.role} ${L.place}` : lvArchName(e)} · ${LV_TIER_WORD[tier]} · ${lvDist(mx, mz)}: ${LV_TIER_NAME[rt]}`, rows };
    };
  }
  const LV_TIER_WORD = { stranger: 'Stranger', known: 'Knows you', cool: 'Cool with you', friend: 'Friend', sour: 'Not feeling you', enemy: 'Hates you', scared: 'Scared of you' };
  const lvArchName = e => ({ worker: 'On the way to work', shopper: 'Running errands', elder: 'From round here', youth: 'Out with friends', night: 'Out tonight' })[e.pl && e.pl.arch] || 'Local';
  function lvAskNews(e) {
    const [mx, mz] = hMe(), tier = lvTier(e);
    if (tier === 'enemy' || tier === 'scared') { hSay(e, hPick(['i dont know nothing', 'aint seen nothing', 'leave me alone']), true); return; }
    const nw = lvNewsFor(mx, mz), C = window.__cops, hot = C && C.COP && C.COP.units ? C.COP.units.filter(u => !u.gone && Math.hypot(u.x - mx, u.z - mz) < 400) : [];
    const r = hRnd();
    if (hot.length && r < 0.35) { const u = hot[0], st = (streetAt(u.x, u.z) || {}).name; hSay(e, st ? `police been sitting on ${st}` : 'police riding round heavy today', true); return; }
    if (nw && r < 0.75) { hSay(e, lvFill(hPick(LV_L['s.news']), e, { news: nw.txt }), true); return; }
    if (typeof MT !== 'undefined' && MT.live && MT.live.p && r < 0.9) { const p = MT.live.p; hSay(e, `they got a car meet at ${goShort(p.name)} right now`, true); setPin(p.name, p.x, p.z); return; }
    const opp = Object.values(hS().regs).find(R => R.opp); if (opp && r < 0.95) { hSay(e, `somebody named ${opp.name} been asking about you`, true); return; }
    hSay(e, lvPick(['nonews'], e), true);
  }
  function lvDirections(e) {
    let best = null, bd = 1e9; for (const p of DATA.P) { if (!/^(food|gas|corner)$/.test(p.type)) continue; const d = Math.hypot(p.x - e.x, p.z - e.z); if (d < bd) { bd = d; best = p; } }
    if (!best || bd > 3000) { hSay(e, 'nothing round here for real', true); return; }
    setPin(best.name, best.x, best.z); hSay(e, `${goShort(best.name)}, ${bd < 250 ? 'right down the street' : bd < 700 ? 'couple blocks that way' : 'kinda far, you gon need a ride'}`, true);
  }
  // add to the corners' and the regulars' talk menus: they remember you too
  const _lvTalk = hTalkMenu;
  hTalkMenu = function (e) {
    try { lvOnTalk(e); } catch (er) {}
    if (e.kind === 'ped') return lvTalkMenu(e);
    const fn = _lvTalk.apply(this, arguments);
    return () => {
      const M = fn(); if (!M || !M.rows) return M;
      try {
        const tier = lvTier(e), m = lvMem(e);
        if (M.rows[0] && M.rows[0].t === 'Wsg') M.rows[0].act = () => hSay(e, e.kind === 'member' && e.gang === hS().set ? hPick(HL.homie) : lvGreetLine(e), true);
        if (!M.rows.some(r => r.t === 'What\'s the word?')) M.rows.splice(1, 0, { t: 'What\'s the word?', s: 'What\'s been going on out here', btn: 'Ask', act: () => lvAskNews(e) });
        for (const r of M.rows) {
          if (r.t === 'Talk down' && !r.lv) { const a = r.act; r.lv = 1; r.act = () => { lvRemember(e, 'down', -20, 6); const [mx, mz] = hMe(); lvRepAdd(mx, mz, -1, 2, 0); a(); }; }
          if (r.t === 'Squash it' && !r.lv) { const a = r.act; r.lv = 1; r.act = () => { lvRemember(e, 'squash', 15, -10); a(); }; }
        }
        if (m && m.met > 1) M.sub = `${M.sub} · ${LV_TIER_WORD[tier]}`;
      } catch (er) {}
      return M;
    };
  };

  // ---------- runs for the locals (work that opens up once they trust you) ----------
  const LV_RUN = [['a plate of food', 'their cousin'], ['an envelope', 'a friend'], ['a package', 'their nephew'], ['some keys', 'their sister'], ['a bag of tools', 'a buddy'], ['a cake', 'their auntie']];
  function lvQuestGive(e) {
    const L = e.local, ci = Math.floor(e.x / 100), cj = Math.floor(e.z / 100), R = lvRng(e.id + ':run:' + lvS().done), C = [];
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { if (Math.abs(a) + Math.abs(b) < 2) continue; for (const q of lvAnchors(ci + a, cj + b)) if (q.kind === 'home') C.push(q); }
    if (!C.length) { hSay(e, 'nah im good right now', true); return; }
    const to = C[Math.floor(R() * C.length)], [what, who] = LV_RUN[Math.floor(R() * LV_RUN.length)], d = Math.hypot(to.x - e.x, to.z - e.z), pay = Math.round((120 + d * 0.6) / 10) * 10;
    const st = (streetAt(to.x, to.z) || {}).name || lvDist(to.x, to.z);
    lvS().q = { from: e.id, fromName: e.name, what, who, x: to.ux, z: to.uz, pay, t: Date.now(), name: `${who} on ${st}` };
    setPin(`Drop off: ${what}`, to.ux, to.uz); hSay(e, `take this ${what.replace(/^an? /, '')} to my ${who.replace('their ', '')} on ${st}. ill pay you ${money(pay)}`, true);
    toast(`Run for ${e.name}: take ${what} to ${who} on ${st}. Pays ${money(pay)}.`, 'good'); save();
  }
  function lvQuestStep(mx, mz) {
    const q = lvS().q; if (!q) return;
    if (Date.now() - q.t > 45 * 60000) { lvS().q = null; toast(`${q.fromName}'s run expired.`, 'bad'); save(); return; }
    if (Math.hypot(q.x - mx, q.z - mz) < 9 && (foot.on || Math.abs(drv.v) < 2)) lvQuestDone(null);
  }
  function lvQuestDone() {
    const q = lvS().q; if (!q) return; lvS().q = null; lvS().done++;
    earn(q.pay, `run for ${q.fromName}`);
    const m = lvS().mem[q.from]; if (m) { m.a = clamp(m.a + 18, -100, 100); m.ev.unshift(['job', Date.now()]); m.ev.length = Math.min(m.ev.length, 6); }
    const [mx, mz] = hMe(); lvEvent('job', mx, mz, {});
    toast(`Dropped off ${q.what}. ${q.fromName} paid you ${money(q.pay)} and rocks with you more now.`, 'good'); save(); refreshStats();
  }
  // locals who look out for you: a text when the police come through their block
  function lvLookouts(mx, mz) {
    const L = lvS().look, ids = Object.keys(L); if (!ids.length || performance.now() - LVW.lookT < 45000) return;
    const C = window.__cops; if (!C || !C.COP || !C.COP.units) return;
    for (const id of ids) {
      const o = L[id]; if (Math.hypot(o.x - mx, o.z - mz) > 420) continue;
      const u = C.COP.units.find(u => !u.gone && Math.hypot(u.x - o.x, u.z - o.z) < 220 && Math.hypot(u.x - mx, u.z - mz) < 380); if (!u) continue;
      LVW.lookT = performance.now(); const st = (streetAt(u.x, u.z) || {}).name || o.d;
      toast(`📱 ${o.n}: 12 coming down ${st}. be careful`, (S.heat || 0) > 0 ? 'bad' : ''); return;
    }
  }

  // ---------- life between them: the corners talk, friends walk and talk, locals greet people going by ----------
  function lvSayQuiet(e, t) { if (!e || e.gone || !t) return; const was = HNET.sayRx; HNET.sayRx = true; try { hSay(e, t); } finally { HNET.sayRx = was; } }
  function lvBanter(mx, mz) {
    const w = Math.floor(hNow() / 7000);
    if (w === LVW.banW) return; LVW.banW = w;
    // every player on the server picks the same line at the same time, nothing sent
    for (const b of HOOD.blocks) {
      if (!b.crew.length || (w + hHash(b.id)) % 3) continue; const d = Math.hypot(b.corner.x - mx, b.corner.z - mz); if (d > 45 || d < 4) continue;
      const up = b.crew.filter(m => !m.down && !m.gone && m.mode === 'idle' && !(m.own && m.own !== 'me')); if (up.length < 2) continue;
      const pair = LV_L.crew[hHash(b.id + ':' + w) % LV_L.crew.length], a = up[w % up.length], c = up[(w + 1) % up.length], nw = lvNewsFor(b.corner.x, b.corner.z), o = { news: nw ? nw.txt : 'what happened on Berry' };
      lvSayQuiet(a, lvFill(pair[0], a, o)); setTimeout(() => lvSayQuiet(c, lvFill(pair[1], c, o)), 2600);
      a.talkTo = c; c.talkTo = a; a.talkT = c.talkT = 6;
    }
    for (const e of HOOD.ents) {
      if (e.kind !== 'ped' || e.gone || e.hide || e.local || !e.pl || !e.pl.mate || e.own || (w + hHash(e.id)) % 2) continue;
      const d = Math.hypot(e.x - mx, e.z - mz); if (d > 30) continue;
      const m = /^(p:\d+:\d:-?\d+,-?\d+:)(\d+)$/.exec(e.id), mate = m && HOOD.byEnt.get(m[1] + (+m[2] - 1)); if (!mate || mate.gone || mate.hide) continue;
      const pair = LV_L.pair[hHash(e.id + ':' + w) % LV_L.pair.length], nw = lvNewsFor(e.x, e.z), o = { news: nw ? nw.txt : 'they opened a new spot' };
      lvSayQuiet(mate, lvFill(pair[0], mate, o)); setTimeout(() => lvSayQuiet(e, lvFill(pair[1], e, o)), 2400);
      e.talkTo = mate; mate.talkTo = e; e.talkT = mate.talkT = 5;
    }
    // a local says something to somebody walking by
    for (const e of HOOD.ents) {
      if (!e.local || e.gone || e.mode !== 'post' || (w + hHash(e.id)) % 4) continue; if (Math.hypot(e.x - mx, e.z - mz) > 35) continue;
      const p = HOOD.ents.find(o => o.kind === 'ped' && !o.local && !o.gone && !o.hide && Math.hypot(o.x - e.x, o.z - e.z) < 6); if (!p) continue;
      lvSayQuiet(e, hPick([`hey ${p.who.fem ? 'baby' : 'young man'}`, 'how you doing', `${lvPhase() === 0 ? 'mornin' : 'evenin'}`, 'tell your mama i said hey', 'you be safe now'])); e.talkTo = p; e.talkT = 4;
      setTimeout(() => lvSayQuiet(p, hPick(['hey!', 'hey now', 'doing good', 'you too', '*waves*'])), 1800); p.talkTo = e; p.talkT = 4;
    }
  }

  // ---------- body language: where they look, how they stand ----------
  let lvPhoneGeo = null, lvPhoneMat = null;
  function lvPhone(e, P, on) {
    if (on && !e.phoneM && P.fores && P.fores[1]) { lvPhoneGeo = lvPhoneGeo || new THREE.BoxGeometry(0.075, 0.15, 0.012); lvPhoneMat = lvPhoneMat || new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.3, metalness: 0.4, emissive: 0x2a3a5a, emissiveIntensity: 0.5 }); const m = new THREE.Mesh(lvPhoneGeo, lvPhoneMat); m.position.set(0, -0.26, 0.04); m.rotation.x = 0.4; P.fores[1].add(m); e.phoneM = m; }
    if (e.phoneM) e.phoneM.visible = !!on;
  }
  function lvPose(e, P, now, mx, mz, d) {
    const pose = e.mode === 'hands' ? 'hands' : e.mode === 'cower' ? 'cower' : e.mode === 'film' && !e.moving ? 'film' : e.mode === 'fall' ? 'fall' : e.moving ? '' :
      (e.mode === 'post' || e.mode === 'chat' || e.curb) ? lvIdlePose(e, now) : '';
    lvPhone(e, P, pose === 'film' || pose === 'phone');
    const Hs = P.root.scale.y || 1;
    if (pose === 'fall') { P.wrap.rotation.x = -Math.PI / 2; P.wrap.position.y = 0.14; return; }
    if (pose === 'hands') { for (let i = 0; i < 2; i++) { P.arms[i].rotation.x = -2.75 + Math.sin(now * 9 + i) * 0.04; P.arms[i].rotation.z = (i ? 1 : -1) * 0.42; if (P.fores) P.fores[i].rotation.x = -0.55; } }
    else if (pose === 'cower') {
      P.root.position.y -= 0.36 * Hs; P.upper.rotation.x = 0.62;
      for (let i = 0; i < 2; i++) { P.legs[i].rotation.x = -1.2; if (P.knees) { P.knees[i].rotation.x = 2.05; P.ankles[i].rotation.x = -0.8; } P.arms[i].rotation.x = -2.5; P.arms[i].rotation.z = (i ? 1 : -1) * 0.75; if (P.fores) P.fores[i].rotation.x = -2.1; }
      if (P.head) P.head.rotation.x = 0.5;
    }
    else if (pose === 'film') { P.arms[1].rotation.x = -1.45; P.arms[1].rotation.z = 0.28; if (P.fores) P.fores[1].rotation.x = -1.0; P.arms[0].rotation.x = -0.2; if (P.head) P.head.rotation.x = 0.05; }
    else if (pose === 'phone') { P.arms[1].rotation.x = -0.55; if (P.fores) P.fores[1].rotation.x = -1.75; if (P.head) P.head.rotation.x = 0.38; }
    else if (pose === 'cross') { for (let i = 0; i < 2; i++) { P.arms[i].rotation.x = -0.42; P.arms[i].rotation.z = (i ? -1 : 1) * 0.32; if (P.fores) P.fores[i].rotation.x = -1.95; } }
    else if (pose === 'hips') { for (let i = 0; i < 2; i++) { P.arms[i].rotation.z = (i ? 1 : -1) * 0.62; P.arms[i].rotation.x = 0.15; if (P.fores) P.fores[i].rotation.x = -1.4; } }
    // talking: hands move with the words
    if (e.bub && !pose && !e.moving && P.fores) { P.fores[0].rotation.x = -0.55 + Math.sin(now * 5.3 + e.ph) * 0.35; P.arms[0].rotation.x = -0.25 + Math.sin(now * 3.1 + e.ph) * 0.12; }
    if (e.mode === 'post' && e.who && e.who.elder) P.upper.rotation.x += 0.1;
  }
  const lvIdlePose = (e, now) => ['', 'phone', 'cross', '', 'hips', 'phone'][hHash(e.id + ':' + Math.floor(now / 11 + (e.ph || 0))) % 6];
  // heads turn: to you when you're close and in front of them, to whoever they're talking to, to the scene, to a loud car going by
  function lvGaze(e, P, dt, mx, mz, d, loud) {
    if (!P.head) return;
    let tx = null, tz = null;
    if (e.talkT > 0 && e.talkTo && !e.talkTo.gone) { tx = e.talkTo.x; tz = e.talkTo.z; e.talkT -= dt; }
    else if (e.scene && (e.mode === 'film' || e.mode === 'cower')) { tx = e.scene.x; tz = e.scene.z; }
    else if (d < 11 && !e.hide) { tx = mx; tz = mz; }
    else if (loud && d < 28) { tx = mx; tz = mz; }
    let want = 0;
    if (tx != null) { const rel = hNorm(Math.atan2(-(tx - e.x), -(tz - e.z)) - e.yaw); if (Math.abs(rel) < 2.0) want = clamp(rel, -1.15, 1.15); }
    // scared of you: eyes somewhere else
    const shy = tx === mx && e.kind === 'ped' && (lvTier(e) === 'scared' || lvRepTier(e.x, e.z) === 'feared');
    if (shy) want = -Math.sign(want || 1) * 0.5;
    e.hy = (e.hy || 0) + (want - (e.hy || 0)) * Math.min(1, dt * 5);
    P.head.rotation.y += e.hy * 0.7; P.upper.rotation.y += e.hy * 0.25; if (shy) P.head.rotation.x += 0.22;
  }
  function lvBody2(dt, now, mx, mz) {
    const loud = hInCar() && Math.abs(drv.v) > 18;
    for (const e of HOOD.ents) {
      if (e.gone || e.down || e.inCar || !e.g.visible) continue;
      const P = e.view.P; if (!P || !P.wrap.visible) continue;
      const d = Math.hypot(e.x - mx, e.z - mz);
      if (e.kind === 'ped') { e.lod = d < 30 ? 1 : d < 70 ? 2 : 4; if (e.af === frame || e.mode === 'fall') lvPose(e, P, now, mx, mz, d); }
      if (e.af !== frame || d > 30 || e.gd || e.mode === 'fight' || e.mode === 'aim') continue;
      lvGaze(e, P, dt * (e.lod || 1), mx, mz, d, loud);
    }
    // the folks posted by the doors: look at you, duck at shots
    if (typeof STREET !== 'undefined') for (const q of STREET.list) {
      const w = q.P.wrap.position, d = Math.hypot(w.x - mx, w.z - mz); if (d > 26) continue;
      if (q.cow && now * 1000 < q.cow) { const P = q.P, Hs = P.root.scale.y || 1; P.root.position.y -= 0.36 * Hs; P.upper.rotation.x = 0.62; for (let i = 0; i < 2; i++) { P.legs[i].rotation.x = -1.2; if (P.knees) { P.knees[i].rotation.x = 2.05; P.ankles[i].rotation.x = -0.8; } P.arms[i].rotation.x = -2.5; P.arms[i].rotation.z = (i ? 1 : -1) * 0.75; if (P.fores) P.fores[i].rotation.x = -2.1; } continue; }
      if (d < 10 && q.P.head) { const rel = hNorm(Math.atan2(-(mx - w.x), -(mz - w.z)) - q.P.wrap.rotation.y); q.hy = (q.hy || 0) + ((Math.abs(rel) < 2 ? clamp(rel, -1.1, 1.1) : 0) - (q.hy || 0)) * Math.min(1, dt * 4); q.P.head.rotation.y += q.hy * 0.7; q.P.upper.rotation.y += q.hy * 0.2; }
    }
  }

  // ---------- every frame ----------
  function lifeTick(dt) {
    if (!HOOD.ready || !driving || !S) return;
    if (!LVW.born) LVW.born = performance.now();
    { const [x, z] = hMe(); if (LVW.at && Math.hypot(x - LVW.at[0], z - LVW.at[1]) > 120) LVW.born = performance.now(); LVW.at = [x, z]; }   // fast travel: fill in around you
    const [mx, mz] = hMe(), now = performance.now() / 1000;
    if ((frame & 31) === 7) { lvSpawn(mx, mz); lvScenes(); lvQuestStep(mx, mz); lvLookouts(mx, mz); }
    if ((frame & 15) === 3) lvBanter(mx, mz);
    for (const e of HOOD.ents) if (e.kind === 'ped' && e.own && e.own !== 'me') LVW.off.add(e.id);
    lvBody2(dt, now, mx, mz);
  }
  const _lvHoodTick = hoodTick;
  hoodTick = function (dt) {
    const rc = HOOD.racing && !ROLL.on ? HOOD.racing : null;
    const r = _lvHoodTick.apply(this, arguments);
    try {
      if (rc && !rc.gone) { const won = (S.log[0] || '').includes('win'); lvRemember(rc, won ? 'race_w' : 'race_l', won ? -4 : 6, 0); lvEvent('race', rc.x, rc.z, { won }); }
      lifeTick(dt);
    } catch (er) { if (!LVW.err) { LVW.err = 1; console.error('life', er); } }
    return r;
  };
  // sleeping it off: people calm down, the stories get old
  const _lvSleep = sleep;
  sleep = function () {
    const r = _lvSleep.apply(this, arguments);
    try { const l = lvS(); for (const R of Object.values(l.rep)) { R.f = Math.round(R.f * 0.8); if (R.r < 0) R.r = Math.min(0, R.r + 4); R.k = Math.max(0, R.k - 1); } l.news = l.news.filter(n => Date.now() - n.t < 3600000); for (const m of Object.values(l.mem)) m.f = Math.round(m.f * 0.7); LVW.tmp = {}; save(); } catch (er) {}
    return r;
  };
  // the Hood app: what each part of town thinks of you, and the locals you know
  const _lvHoodMenu = hoodMenu;
  hoodMenu = function () {
    const M = _lvHoodMenu.apply(this, arguments);
    try {
      const l = lvS(), [mx, mz] = hMe(), d = lvDist(mx, mz), R = lvRep(d), add = [];
      add.push({ t: `Your name in ${d}: ${LV_TIER_NAME[lvRepTier(mx, mz)]}`, s: `Respect ${Math.round(R.r)} · Fear ${Math.round(R.f)} · Known ${Math.round(R.k)}`, btn: 'OK', act: () => {} });
      const others = Object.entries(l.rep).filter(([k, v]) => k !== d && (Math.abs(v.r) + v.f + v.k) > 3).sort((a, b) => (Math.abs(b[1].r) + b[1].f + b[1].k) - (Math.abs(a[1].r) + a[1].f + a[1].k)).slice(0, 3);
      if (others.length) add.push({ t: 'Around town', s: others.map(([k, v]) => `${k}: ${v.r >= 25 ? 'respected' : v.r <= -35 ? 'hated' : v.f >= 55 ? 'feared' : v.k >= 20 ? 'known' : 'quiet'}`).join(' · '), btn: 'OK', act: () => {} });
      const known = Object.entries(l.mem).filter(([id, m]) => id.startsWith('p:') && m.met).sort((a, b) => b[1].a - a[1].a).slice(0, 4);
      if (known.length) add.push({ t: 'Locals you know', s: known.map(([, m]) => `${m.n} (${m.a >= 50 ? 'friend' : m.a >= 18 ? 'cool' : m.a <= -12 ? 'not feeling you' : 'knows you'})`).join(' · '), btn: 'OK', act: () => {} });
      if (l.q) add.push({ t: `Run for ${l.q.fromName}`, s: `Take ${l.q.what} to ${l.q.name} · ${money(l.q.pay)}`, btn: 'GPS', act: () => setPin(`Drop off: ${l.q.what}`, l.q.x, l.q.z) });
      if (l.news[0]) add.push({ t: `Word on the street: ${l.news[0].txt}`, s: `${l.news[0].d} · ${Math.max(1, Math.round((Date.now() - l.news[0].t) / 60000))} min ago`, btn: 'OK', act: () => {} });
      M.rows.splice(Math.min(M.rows.length, hS().set ? 3 : 1), 0, ...add);
    } catch (er) {}
    return M;
  };
  window.__life = { lifePed, lvCarHit, lvOffClock, lvQuestStep, lvScenes, lvBanter, lvLookouts, LVW, lvS, lvPlan, lvAt, lvAnchors, lvSpawn, lvEvent, lvRepTier, lvRep, lvRepAdd, lvMem, lvTier, lvRemember, lvGreetLine, lvTalkMenu, lvQuestGive, lvNewsFor, lvPick, lifeTick, lvMakeWalker, lvMakeLocal, lvLocalAt, lvGrow, lvReactAll, lvDoor };
  // ==== living npcs (end) ====
