  // ==== love + family (begin) ====
  // Dating, marriage, cheating, pregnancy and kids (2026-11-28, Kimari: "talk to females and get in relationships ... marry have kids
  // and the whole nine ... baby characters ... cheat on your wife ... 2 online players can agree to be in a relationship and agree to have kids").
  //  - Women on the sidewalk and the locals get "Shoot your shot" in their talk menu. Get her number and she's in the Love app.
  //  - Levels: Talking -> Dating -> Girlfriend -> Engaged -> Married (or Ex / Divorced). Affection 0-100 moves with texts, dates, gifts and how you treat her.
  //  - Link up and she walks with you (rides along in the car). Dates happen at food spots, malls, marinas and landmarks.
  //  - Marriage: buy a ring, propose, pick a venue, have the wedding there. Your wife lives at your house.
  //  - Cheating: flirting, dates and nights with somebody else while you're taken build suspicion. Get caught and it's a fight,
  //    a breakup, keyed car, or a divorce that takes half the bank and child support for the kids.
  //  - Kids only when you BOTH agree to have kids. Her belly grows over 9 days, then the baby is born at JPS. Babies grow into
  //    toddlers, kids, teens and grown-ups (1 day = 2 months), and live at your house. Baby and kid characters are their own models.
  //  - Spending the night is a fade to black: lights go out, cut to the next morning. Nothing is shown. Kids are never part of it.
  //  - Online: two players both have to say yes to dating, being official, getting engaged, marriage, having kids and spending the night.
  //    Packets { k: 'lv', t, to, u, rid, ... }. The pregnant player's belly shows for everybody (hello field pg).
  const LO_ST = ['talking', 'dating', 'gf', 'engaged', 'married'];
  const LO_WORD = { talking: 'Talking', dating: 'Dating', gf: 'Official', engaged: 'Engaged', married: 'Married', ex: 'Ex', divorced: 'Divorced' };
  const LO_WORD_F = { gf: 'Girlfriend', married: 'Wife' }, LO_WORD_M = { gf: 'Boyfriend', married: 'Husband' };
  const LO_TAKEN = new Set(['gf', 'engaged', 'married']);
  const LO_DATE = { food: { icon: '🍽', what: 'dinner', cost: 85, aff: 9 }, mall: { icon: '🛍', what: 'shopping', cost: 400, aff: 12 }, marina: { icon: '⛵', what: 'a sunset boat ride', cost: 550, aff: 15 }, landmark: { icon: '🌆', what: 'a walk', cost: 30, aff: 7 }, clothing: { icon: '👗', what: 'a shopping trip', cost: 250, aff: 10 } };
  const LO_VENUE = [{ type: 'court', name: 'Courthouse wedding', cost: 600, aff: 6 }, { type: 'landmark', name: 'Big wedding at a landmark', cost: 18000, aff: 14 }, { type: 'marina', name: 'Wedding on the water', cost: 32000, aff: 18 }];
  const LO_RINGS = [{ id: 'r1', name: 'Simple band', cost: 900, k: 0 }, { id: 'r2', name: '1 carat solitaire', cost: 6500, k: 0.08 }, { id: 'r3', name: '3 carat VVS', cost: 28000, k: 0.16 }, { id: 'r4', name: '6 carat flawless', cost: 95000, k: 0.24 }];
  const LO_GIFTS = [{ n: 'Flowers', c: 60, a: 4 }, { n: 'Her favorite food', c: 35, a: 3 }, { n: 'Perfume', c: 180, a: 6 }, { n: 'Nails and hair appointment', c: 260, a: 8 }, { n: 'Designer bag', c: 2800, a: 14 }, { n: 'Tennis bracelet', c: 9500, a: 20 }];
  const LO_KID_N = { f: ['Amani', 'Zuri', 'Nova', 'Kali', 'Aaliyah', 'Imani', 'Skye', 'Nyla', 'Ariana', 'Journee', 'Kennedi', 'Royalty', 'Sanaa', 'Laila', 'Mia'], m: ['Kairo', 'Josiah', 'Legend', 'Kingston', 'Jalen', 'Messiah', 'Zion', 'Amir', 'Kaden', 'Elijah', 'Micah', 'Kash', 'Jace', 'Malik', 'Ezra'] };
  const LO_SAY = {
    yes: ['ok you smooth, put your number in', 'hmm.. ok here', 'i like your confidence. text me', 'you got 5 minutes, go', 'i was hoping you would ask'],
    no: ['im good, thank you', 'i got a man', 'not today', 'lol no', 'you not my type sorry', 'nah i\'m busy'],
    dateYes: ['ok pull up', 'finally lol. where we going', 'yes. dont be late', 'ok you got me'],
    dateNo: ['not tonight', 'i\'m tired, another day', 'you gotta text me more first', 'i\'m busy rn'],
    hi: ['hey you', 'wyd', 'there go my baby', 'hey stranger', 'took you long enough'],
    mad: ['dont talk to me', 'oh NOW you wanna talk', 'you know what you did', 'leave me alone'],
    happy: ['i had fun tonight', 'you really know how to treat me', 'we need to do that again', 'best date ever fr'],
  };
  const LO = { C: null, home: null, kids: new Map(), wife: null, pill: null, pillKey: '', act: {}, inbox: new Map(), out: null, fade: null, near: null, dateAt: null, nearPeer: null, err: 0, lt: 0, spot: null, bellyMe: null, tick: 0 };
  const loPick = a => a[Math.floor(Math.random() * a.length)];
  function loS() {
    const L = S.love || (S.love = {});
    L.ppl = L.ppl || {}; L.pl = L.pl || {}; L.kids = L.kids || []; L.sus = L.sus || {}; L.pref = L.pref || 'women'; L.box = L.box || []; L.rings = L.rings || []; L.support = L.support || 0;
    return L;
  }
  const loMeFem = () => (myLook().body || 'm') === 'f';
  const loWord = (p, st) => { st = st || p.st; return (p.fem ? LO_WORD_F : LO_WORD_M)[st] || LO_WORD[st] || st; };
  const loRank = st => LO_ST.indexOf(st);
  const loKey = p => (p.uid ? 'o:' + p.uid : 'n:' + p.id);
  function loByKey(k) { const L = loS(); return k && k[0] === 'o' ? L.pl[k.slice(2)] : k ? L.ppl[k.slice(2)] : null; }
  const loAll = () => { const L = loS(); return [...Object.values(L.ppl), ...Object.values(L.pl)]; };
  const loTaken = () => loAll().filter(p => LO_TAKEN.has(p.st));
  const loHe = p => (p.fem ? 'she' : 'he'), loHer = p => (p.fem ? 'her' : 'him'), loHis = p => (p.fem ? 'her' : 'his');
  const loWants = fem => { const pr = loS().pref; return pr === 'both' || (pr === 'women') === !!fem; };
  function loLog(p, w, m) { p.chat = p.chat || []; p.chat.push([w, m, S.day]); if (p.chat.length > 40) p.chat.splice(0, p.chat.length - 40); }
  function loAff(p, d) { p.aff = Math.max(0, Math.min(100, Math.round((p.aff || 0) + d))); }
  const loHome = () => DATA.P.find(p => p.type === 'home');
  const loMe = () => (foot.on || !driving ? [foot.x, foot.z] : [drv.x, drv.z]);
  const loWait = ms => new Promise(r => setTimeout(r, ms));
  const loY = (x, z) => { try { return groundAt(x, z) || 0; } catch (e) { return 0; } };

  // ---------- looks: her look from the person you met; kids' looks from both parents ----------
  function loLookOf(e) {
    if (e.lvL) return { ...e.lvL, extras: [...(e.lvL.extras || [])], tats: [...(e.lvL.tats || [])] };
    let sd = 1; for (const c of String(e.id)) sd = (sd * 31 + c.charCodeAt(0)) % 2147483647; sd = sd || 7;
    const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647; R();
    return Object.assign(PEOPLE.randomLook(R, !!(e.who && e.who.fem)), { mask: 'no_mask' });
  }
  const loHex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function loKidLook(a, b, fem, seed) {
    let sd = seed % 2147483646 + 1; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647; R(); R();
    const G = PEOPLE.GAME, pick = x => x[Math.floor(R() * x.length)];
    const ca = loHex(a.skin || G.DEFAULT.skin), cb = loHex(b.skin || G.DEFAULT.skin), t = 0.3 + R() * 0.4, mix = ca.map((v, i) => v * t + cb[i] * (1 - t));
    let skin = G.SKIN_TONES[0], bd = 1e9; for (const s of G.SKIN_TONES) { const c = loHex(s), d = c.reduce((q, v, i) => q + (v - mix[i]) ** 2, 0); if (d < bd) { bd = d; skin = s; } }
    const black = s => ['black', 'any'].includes((PEOPLE.HAIR_BY[s] || {}).group);
    const curly = black(a.hairStyle) || black(b.hairStyle);
    const hairs = fem ? (curly ? ['puffs', 'puff', 'box_braids', 'bantu', 'braids_back', 'twists', 'fulani'] : ['ponytail', 'bob', 'long', 'bun']) : (curly ? ['waves', 'caesar', 'taper', 'curly', 'short_afro', 'twists', 'high_top'] : ['short', 'crew', 'side_part', 'french_crop', 'buzz']);
    return {
      body: fem ? 'f' : 'm', skin, hairStyle: pick(hairs), hair: R() < 0.5 ? (a.hair || '#111111') : (b.hair || '#111111'), eyes: R() < 0.5 ? (a.eyes || G.DEFAULT.eyes) : (b.eyes || G.DEFAULT.eyes),
      brows: 'natural', facialHair: 'none', build: R() < 0.5 ? 0 : 1, height: 1, extras: fem && R() < 0.4 ? ['studs'] : [], tats: [], ink: 'bw',
      top: pick(fem ? ['tee_white', 'mh_tee_purple', 'hoodie_grey', 'mh_hoodie_cream', 'mj_mavs'] : ['tee_white', 'tee_red', 'hoodie_grey', 'mj_mavs', 'mh_gg_tee', 'mj_rangers']),
      bottom: pick(['jeans_blue', 'track_black', 'md_grey', 'mh_vx_joggers']), shoes: pick(['kicks_white', 'kicks_red', 'mk_af1_white', 'mk_dunk_panda']),
      hat: 'no_hat', mask: 'no_mask', bag: 'no_bag', face: Math.floor(R() * 1e6), mus: 0.2,
    };
  }
  // the kid's stage from their age in years (1 day = 2 months)
  const loAge = k => Math.max(0, (S.day - k.born) / 6);
  function loStage(k) { const a = loAge(k); return a < 1.5 ? 'baby' : a < 4 ? 'toddler' : a < 12 ? 'kid' : a < 18 ? 'teen' : 'grown'; }
  const LO_STAGE = { baby: 'Baby', toddler: 'Toddler', kid: 'Kid', teen: 'Teen', grown: 'Grown' };
  const loAgeTxt = k => { const a = loAge(k); return a < 1 ? `${Math.max(0, Math.round(a * 12))} months` : `${Math.floor(a)} ${Math.floor(a) === 1 ? 'year' : 'years'}`; };
  const loKidScale = k => { const a = loAge(k); return a < 4 ? 0.5 + (a - 1.5) * 0.03 : a < 12 ? 0.56 + (a - 4) * 0.033 : a < 18 ? 0.83 + (a - 12) * 0.026 : 1; };

  // ---------- models: a grown person, a baby (swaddled, its own model), a kid (kid proportions) ----------
  function loBuild(look) { const P = PEOPLE.build({ ...look, mask: 'no_mask' }, phone ? 1 : 0), wrap = new THREE.Group(); P.root.rotation.y = Math.PI; wrap.add(P.root); P.wrap = wrap; return P; }
  function loBaby(k) {
    const g = new THREE.Group(), skin = new THREE.MeshStandardMaterial({ color: new THREE.Color(k.look.skin).convertSRGBToLinear(), roughness: 0.6 });
    const blanket = new THREE.MeshStandardMaterial({ color: new THREE.Color(k.fem ? '#f2b8cf' : '#a9cdf0').convertSRGBToLinear(), roughness: 0.92 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), blanket); body.scale.set(0.95, 0.85, 1.75); body.position.set(0, 0, 0.02); g.add(body);
    const fold = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.03, 8, 18, Math.PI * 1.3), blanket); fold.rotation.set(Math.PI / 2, 0, Math.PI * 0.85); fold.position.set(0, 0.035, -0.13); g.add(fold);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.068, 18, 14), skin); head.position.set(0, 0.03, -0.18); g.add(head);
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.071, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), blanket); hat.position.copy(head.position); hat.rotation.x = -0.9; g.add(hat);
    const dark = new THREE.MeshBasicMaterial({ color: 0x1a1210 });
    for (const s of [-1, 1]) { const ey = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), dark); ey.position.set(s * 0.024, 0.062, -0.235); ey.scale.set(1.3, 0.35, 1); g.add(ey); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), skin); hd.position.set(s * 0.05, 0.06, -0.09); g.add(hd); }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), skin); nose.position.set(0, 0.04, -0.245); g.add(nose);
    g.userData.head = head; return g;
  }
  // a carrier seat for the baby when nobody's holding it
  function loCarrier(k) {
    const g = new THREE.Group(), shell = new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.55 }), pad = new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.95 });
    const tub = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), shell); tub.scale.set(0.8, 0.7, 1.35); tub.position.y = 0.2; g.add(tub);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.5), pad); seat.position.y = 0.06; g.add(seat);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.016, 8, 24, Math.PI), shell); handle.position.y = 0.2; handle.rotation.y = Math.PI / 2; g.add(handle);
    const B = loBaby(k); B.position.set(0, 0.17, 0.02); B.rotation.x = 0.35; g.add(B); g.userData.baby = B; return g;
  }
  function loKidModel(k) {
    const st = loStage(k);
    if (st === 'baby') { const g = loCarrier(k), wrap = new THREE.Group(); wrap.add(g); return { baby: true, wrap, g }; }
    const P = loBuild({ ...k.look, build: st === 'toddler' ? 2 : k.look.build }), s = loKidScale(k);
    P.wrap.scale.setScalar(s); if (P.head) P.head.scale.setScalar(Math.min(1.45, Math.pow(1 / s, 0.62)));
    return { P, wrap: P.wrap, st };
  }
  // pregnant belly on anybody built by PEOPLE: grows with k (0..1), in the color of their top
  function loBelly(P, k) {
    if (!P || !P.upper) return;
    let B = P.upper.getObjectByName('lo-belly');
    if (k < 0.12) { if (B) B.visible = false; return; }
    if (!B) {
      let col = '#2a2c33'; P.upper.traverse(o => { if (col === '#2a2c33' && o.isMesh && o.material && o.material.userData && o.material.userData.cloth && o.material.color) col = '#' + o.material.color.clone().convertLinearToSRGB().getHexString(); });
      B = new THREE.Mesh(new THREE.SphereGeometry(0.12, 22, 16), new THREE.MeshStandardMaterial({ color: new THREE.Color(col).convertSRGBToLinear(), roughness: 0.85 })); B.name = 'lo-belly'; B.castShadow = true; P.upper.add(B);
    }
    const q = Math.min(1, (k - 0.12) / 0.88); B.visible = true;
    const c = LO.bc || { y: 0.05, yq: 0.03, z: 0.03, zq: 0.075 }; B.scale.set(0.85 + q * 0.25, 0.95 + q * 0.22, 0.3 + q * 1.05); B.position.set(0, c.y + q * c.yq, c.z + q * c.zq);
  }
  const loPregK = pr => (pr ? Math.min(1, (S.day - pr.d0 + (pr.f || 0)) / 9) : 0);

  // ---------- the person with you (linked up), walking at your side or riding in your car ----------
  function loLink(p, x, z) {
    loUnlink(true); if (!p || p.uid) return;
    const P = loBuild(p.look), [mx, mz] = loMe(); x = x ?? mx + 2.5; z = z ?? mz + 2.5;
    scene.add(P.wrap); P.wrap.position.set(x, 0, z);
    LO.C = { key: loKey(p), p, P, x, z, yaw: 0, ph: 0, t: Math.random() * 9, car: !foot.on, bub: null, bubT: 0, saidT: 0 };
    loS().with = LO.C.key; save();
    if (LO.wife && LO.wife.key === LO.C.key) loWifeOff();
  }
  function loUnlink(quiet) {
    const C = LO.C; if (!C) return; scene.remove(C.P.wrap); PEOPLE.dispose(C.P); LO.C = null; if (!quiet) { loS().with = null; save(); }
  }
  function loSay(who, text) {
    if (!who || !text) return; const g = who.P ? who.P.wrap : who.wrap; if (!g) return;
    if (who.bub) { g.remove(who.bub); who.bub.material.map.dispose(); who.bub.material.dispose(); }
    const s = textSprite(text, 28, '#ffd0e4'); s.position.set(0, 2.25 / (g.scale.y || 1), 0); s.scale.set(0.022 * s.userData.aspect, 0.022, 1); g.add(s); who.bub = s; who.bubT = 4.2;
  }
  function loStepWalker(W, tx, tz, dt, close) {
    const dx = tx - W.x, dz = tz - W.z, d = Math.hypot(dx, dz);
    if (d > 45) { W.x = tx; W.z = tz; }
    else if (d > close) { const run = d > 7, sp = run ? 5.6 : d > 3.2 ? 2.4 : 1.6, k = Math.min(1, sp * dt / d); W.x += dx * k; W.z += dz * k; W.yaw = Math.atan2(-dx, -dz); W.ph += dt * sp * Math.PI * 2 / (run ? 3.4 : 1.5); animPerson(W.P, W.ph, 1, run ? 1 : 0); return true; }
    idlePerson(W.P, W.t); return false;
  }
  function loStepC(dt) {
    const C = LO.C; if (!C) return;
    C.t += dt; const inCar = driving && !foot.on;
    if (inside || inCar) { C.P.wrap.visible = false; C.car = true; return; }
    if (C.car) { C.car = false; const yaw = foot.yaw || 0; C.x = foot.x + Math.cos(yaw) * 1.6; C.z = foot.z - Math.sin(yaw) * 1.6; }
    C.P.wrap.visible = true;
    const yaw = foot.yaw || 0, tx = foot.x - Math.cos(yaw) * 1.1 + Math.sin(yaw) * 0.6, tz = foot.z + Math.sin(yaw) * 1.1 + Math.cos(yaw) * 0.6;
    const moving = loStepWalker(C, tx, tz, dt, 1.1);
    if (!moving) { const fy = Math.atan2(-(foot.x - C.x), -(foot.z - C.z)); C.yaw += Math.atan2(Math.sin(fy - C.yaw), Math.cos(fy - C.yaw)) * Math.min(1, dt * 2); }
    C.P.wrap.position.set(C.x, loY(C.x, C.z), C.z);
    let dy = C.yaw - C.P.wrap.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); C.P.wrap.rotation.y += dy * Math.min(1, dt * 8);
    loBelly(C.P, loPregK(C.p.preg));
    if (C.bub) { C.bubT -= dt; if (C.bubT <= 0) { C.P.wrap.remove(C.bub); C.bub.material.map.dispose(); C.bub.material.dispose(); C.bub = null; } }
  }

  // ---------- home: your wife and the kids at the house ----------
  function loHomeSpot(i) {
    const h = loHome(); if (!h) return null;
    LO.spots = LO.spots || [];
    if (!LO.spots.length) {
      for (let r = 7; r <= 22 && LO.spots.length < 7; r += 1.5) for (let a = 0; a < 16 && LO.spots.length < 7; a++) {
        const an = a / 16 * Math.PI * 2 + r, x = h.x + Math.cos(an) * r, z = h.z + Math.sin(an) * r;
        if (!lvSolid(x, z, 0.8) && !lvOnRoad(x, z) && !LO.spots.some(s => Math.hypot(s[0] - x, s[1] - z) < 2.4)) LO.spots.push([x, z]);
      }
      if (!LO.spots.length) LO.spots.push([h.x + 8, h.z + 8]);
    }
    return LO.spots[i % LO.spots.length];
  }
  function loWifeOff() { const W = LO.wife; if (!W) return; scene.remove(W.wrap); PEOPLE.dispose(W.P); if (W.held) W.held = null; LO.wife = null; }
  function loKidOff(id) { const K = LO.kids.get(id); if (!K) return; scene.remove(K.wrap); if (K.P) PEOPLE.dispose(K.P); LO.kids.delete(id); }
  function loAtHome(r = 60) { const h = loHome(); if (!h) return false; const [x, z] = loMe(); return Math.hypot(h.x - x, h.z - z) < r; }
  function loStepHome(dt) {
    const L = loS(), h = loHome(), [mx, mz] = loMe(), near = h && !inside && Math.hypot(h.x - mx, h.z - mz) < (phone ? 90 : 140);
    const spouse = Object.values(L.ppl).find(p => p.st === 'married' && (!LO.C || LO.C.key !== loKey(p)));
    if (!near || !spouse) loWifeOff();
    else if (!LO.wife || LO.wife.key !== loKey(spouse)) { loWifeOff(); const P = loBuild(spouse.look), s = loHomeSpot(0); scene.add(P.wrap); LO.wife = { key: loKey(spouse), p: spouse, P, wrap: P.wrap, x: s[0], z: s[1], yaw: 0, ph: 0, t: Math.random() * 9, hx: s[0], hz: s[1], go: null, goT: 3 }; }
    const weekend = S.day % 7 === 6 || S.day % 7 === 0;
    const show = near ? L.kids.filter(k => loStage(k) !== 'grown' && (k.cust !== 'them' || weekend)).slice(0, phone ? 3 : 5) : [];
    for (const id of [...LO.kids.keys()]) if (!show.some(k => k.id === id)) loKidOff(id);
    // the newest baby is in mom's arms when she's home, the rest in the carrier or out in the yard
    const babyHeld = LO.wife && show.find(k => loStage(k) === 'baby' && k.par && k.par.includes(LO.wife.key));
    show.forEach((k, i) => {
      let K = LO.kids.get(k.id); const st = loStage(k), held = babyHeld === k;
      if (K && (K.st !== st || K.held !== held || (K.P && Math.abs(K.wrap.scale.x - loKidScale(k)) > 0.04))) { loKidOff(k.id); K = null; }
      if (!K) {
        const M = held ? { baby: true, wrap: loBaby(k), held: true } : loKidModel(k), s = loHomeSpot(i + 1);
        K = { k, ...M, st, held, x: s[0], z: s[1], hx: s[0], hz: s[1], yaw: Math.random() * 6, ph: 0, t: Math.random() * 9, go: null, goT: 2 + Math.random() * 4 };
        if (!held) scene.add(K.wrap); LO.kids.set(k.id, K);
      }
      if (held) { if (LO.wife && K.wrap.parent !== LO.wife.P.upper) { LO.wife.P.upper.add(K.wrap); K.wrap.position.set(0.02, 0.33, 0.19); K.wrap.rotation.set(0.15, Math.PI / 2 + 0.2, Math.PI / 2 - 0.25); K.wrap.scale.setScalar(1); } return; }
      K.t += dt;
      if (K.baby) { K.wrap.position.set(K.x, loY(K.x, K.z), K.z); K.wrap.rotation.y = K.yaw; return; }
      // kids wander the yard and come over to you
      const me = Math.hypot(mx - K.x, mz - K.z) < 9 && foot.on;
      K.goT -= dt; if (!K.go && K.goT <= 0) { K.goT = 3 + Math.random() * 6; const a = Math.random() * 6.28, r = Math.random() * 3.5; K.go = me && Math.random() < 0.6 ? [mx + Math.cos(a) * 1.6, mz + Math.sin(a) * 1.6] : [K.hx + Math.cos(a) * r, K.hz + Math.sin(a) * r]; if (lvSolid(K.go[0], K.go[1], 0.4) || lvOnRoad(K.go[0], K.go[1])) K.go = null; }
      if (K.go) { const dx = K.go[0] - K.x, dz = K.go[1] - K.z, d = Math.hypot(dx, dz), sp = K.st === 'toddler' ? 0.9 : 1.6, s = K.wrap.scale.x;
        if (d < 0.2) K.go = null; else { const q = Math.min(1, sp * dt / d); K.x += dx * q; K.z += dz * q; K.yaw = Math.atan2(-dx, -dz); K.ph += dt * sp * Math.PI * 2 / (1.4 * s); animPerson(K.P, K.ph, 1, K.st === 'kid' && d > 2 ? 0.5 : 0); } }
      else { idlePerson(K.P, K.t); if (me) { const fy = Math.atan2(-(mx - K.x), -(mz - K.z)); K.yaw += Math.atan2(Math.sin(fy - K.yaw), Math.cos(fy - K.yaw)) * Math.min(1, dt * 3); } }
      K.wrap.position.set(K.x, loY(K.x, K.z), K.z); let dy = K.yaw - K.wrap.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); K.wrap.rotation.y += dy * Math.min(1, dt * 8);
      if (K.bub) { K.bubT -= dt; if (K.bubT <= 0) { K.wrap.remove(K.bub); K.bub.material.map.dispose(); K.bub.material.dispose(); K.bub = null; } }
    });
    const W = LO.wife; if (!W) return;
    W.t += dt;
    const hold = !!babyHeld;
    if (!hold) { W.goT -= dt; if (!W.go && W.goT <= 0) { W.goT = 4 + Math.random() * 8; const a = Math.random() * 6.28, r = Math.random() * 3; W.go = [W.hx + Math.cos(a) * r, W.hz + Math.sin(a) * r]; if (lvSolid(W.go[0], W.go[1], 0.4)) W.go = null; } }
    if (W.go && !hold) { if (!loStepWalker(W, W.go[0], W.go[1], dt, 0.25)) W.go = null; } else idlePerson(W.P, W.t);
    if (hold && W.P.fores) { W.P.arms[0].rotation.x = W.P.arms[1].rotation.x = -0.55; W.P.arms[0].rotation.z = 0.25; W.P.arms[1].rotation.z = -0.35; W.P.fores[0].rotation.x = -1.5; W.P.fores[1].rotation.x = -1.25; }
    if (foot.on && Math.hypot(mx - W.x, mz - W.z) < 7) { const fy = Math.atan2(-(mx - W.x), -(mz - W.z)); W.yaw += Math.atan2(Math.sin(fy - W.yaw), Math.cos(fy - W.yaw)) * Math.min(1, dt * 2); }
    W.wrap.position.set(W.x, loY(W.x, W.z), W.z); let dy = W.yaw - W.wrap.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); W.wrap.rotation.y += dy * Math.min(1, dt * 8);
    loBelly(W.P, loPregK(W.p.preg));
    if (W.bub) { W.bubT -= dt; if (W.bubT <= 0) { W.wrap.remove(W.bub); W.bub.material.map.dispose(); W.bub.material.dispose(); W.bub = null; } }
  }

  // ---------- meeting people: shoot your shot from the talk menu ----------
  function loCanFlirt(e) {
    if (!e || e.gone || e.dead || !e.who || e.who.elder || e.minor || /lil bit/i.test(e.name || '')) return false;
    return loWants(e.who.fem);
  }
  function loShot(e) {
    const L = loS(), id = String(e.id); let p = L.ppl[id];
    if (p) return p;
    const m = lvMem(e, true), tier = lvTier(e), feared = tier === 'scared' || tier === 'enemy';
    let odds = 0.32 + Math.min(0.25, (m.a || 0) / 160) + (S.cash >= 5000 ? 0.08 : 0) + (S.cash >= 50000 ? 0.06 : 0) + Math.min(0.12, (S.rep || 0) / 800) + (S.car && driving && Math.hypot(drv.x - e.x, drv.z - e.z) < 25 ? 0.05 : 0) + (myLook().jw ? 0.05 : 0);
    if (feared) odds = 0.06; if (e.lvShotNo) odds *= 0.25;
    loCheat('flirt', null);
    if (Math.random() > odds) { e.lvShotNo = 1; hSay(e, loPick(LO_SAY.no), true); lvRemember(e, 'shot', -3, 0); return null; }
    p = L.ppl[id] = { id, name: e.name, fem: !!e.who.fem, look: loLookOf(e), aff: 18 + Math.round((m.a || 0) / 4), st: 'talking', met: S.day, last: S.day, dates: 0, nights: 0, kidsOk: 0, preg: null, chat: [], where: e.local ? e.local.place : null };
    loLog(p, 'me', 'Saved your number 😊'); loLog(p, 'them', loPick(['this me', 'hey its ' + e.name, 'dont be weird lol', 'text me']));
    hSay(e, loPick(LO_SAY.yes), true); lvRemember(e, 'number', 10, 0);
    toast(`💕 Got ${e.name}'s number. She's in your Love app.`.replace('She\'s', p.fem ? 'She\'s' : 'He\'s'), 'good'); save();
    return p;
  }
  // ask them out right there: they come along with you
  function loAskOutHere(e, p) {
    if (!p) return;
    if (LO.C && LO.C.key === loKey(p)) { toast(`${p.name} is already with you.`); return; }
    const ok = p.aff >= 22 || p.st !== 'talking';
    loCheat('date', p);
    if (!ok || (p.mad && p.mad > S.day)) { hSay(e, loPick(LO_SAY.dateNo), true); return; }
    hSay(e, loPick(LO_SAY.dateYes), true);
    try { e.g.visible = false; e.mode = 'leave'; e.door = null; e.lvTaken = 1; LVW.off.add(e.id); } catch (er) {}
    loLink(p, e.x, e.z); toast(`${p.name} is rolling with you. Take ${loHer(p)} somewhere: food, a mall, a marina or a landmark.`, 'good');
  }
  const _loTalk = hTalkMenu;
  hTalkMenu = function (e) {
    const fn = _loTalk.apply(this, arguments);
    if (!loCanFlirt(e) || e.kind !== 'ped') return fn;
    return () => {
      const M = fn(); if (!M || !M.rows) return M;
      try {
        const p = loS().ppl[String(e.id)];
        if (!p) M.rows.splice(1, 0, { t: 'Shoot your shot', s: e.lvShotNo ? 'Already curved you once' : 'Ask for ' + (e.who.fem ? 'her' : 'his') + ' number', btn: '💕 Ask', act: () => { const q = loShot(e); if (q) openMenu(hTalkMenu(e)); } });
        else {
          M.sub = `${M.sub} · 💕 ${loWord(p)} · ${p.aff}%`;
          M.rows.splice(1, 0, { t: `Take ${loHer(p)} out`, s: p.aff >= 22 || p.st !== 'talking' ? `${loHe(p)[0].toUpperCase() + loHe(p).slice(1)} comes with you right now` : 'Text more first', btn: '💕 Ask', act: () => { closeMenu(); loAskOutHere(e, p); } },
            { t: 'Compliment', s: p.compD === S.day ? 'Already did today' : 'Make their day', btn: 'Say it', off: p.compD === S.day, act: () => { p.compD = S.day; loAff(p, 3); hSay(e, loPick(['stoppp 😊', 'you sweet', 'i know lol', 'thank you'])); save(); } });
        }
      } catch (er) {}
      return M;
    };
  };

  // ---------- cheating: anything with somebody else while you're taken ----------
  function loCheat(kind, withP) {
    const L = loS(), w = { flirt: 1, date: 3, night: 7, ask: 2, gf: 4 }[kind] || 1, wk = withP ? loKey(withP) : null;
    for (const q of loTaken()) {
      const k = loKey(q); if (k === wk) continue;
      L.sus[k] = (L.sus[k] || 0) + w;
      // right in front of them: caught on the spot
      if (LO.C && LO.C.key === k && kind !== 'flirt') { loCaught(q, withP ? withP.name : 'somebody', true); continue; }
      if (LO.C && LO.C.key === k && kind === 'flirt' && Math.random() < 0.6) { loSay(LO.C, loPick(['excuse me??', 'oh you gon do that in front of me', 'who is SHE']).replace('SHE', withP && !withP.fem ? 'HE' : 'SHE')); loAff(q, -12); }
      // an online partner close by sees it, or hears about it
      if (q.uid && netOn()) { const pr = [...NET.peers.values()].find(v => v.uid === q.uid); if (pr) { const [mx, mz] = loMe(), d = Math.hypot(pr.x - mx, pr.z - mz); if (d < 120 || Math.random() < 0.15 * w) loNetSend(pr.id, 'cheat', { w: withP ? withP.name : 'somebody', what: kind }); } }
    }
    if ((kind === 'date' || kind === 'night') && loTaken().some(q => loKey(q) !== wk)) { const [x, z] = loMe(); addGossip({ kind: 'gossip', icon: '👀', text: `Spotted: ${S.name || 'somebody'} out with ${withP ? withP.name : 'somebody new'} in ${districtAt(x, z) || 'Fort Worth'}. Somebody's partner bout to find out...` }); }
  }
  function loCaught(p, withName, onSpot) {
    const L = loS(), k = loKey(p); L.sus[k] = 0; p.caught = (p.caught || 0) + 1; p.mad = S.day + 2; loAff(p, onSpot ? -45 : -35);
    loLog(p, 'them', onSpot ? `I'm RIGHT HERE and you with ${withName}??` : loPick([`So you been out with ${withName}?? Somebody sent me pics.`, `Don't lie to me. I KNOW about ${withName}.`, `My cousin seen you with ${withName}. We need to talk.`]));
    if (p.uid) return;   // online partners decide for themselves (they get the cheat packet)
    if (onSpot && LO.C && LO.C.key === k) { loSay(LO.C, loPick(['WOW. we done', 'you dead to me', 'i cant believe you'])); }
    const keyed = S.car && Math.random() < 0.45 && p.st !== 'married';
    if (keyed) { S.car.cond.body = Math.max(10, S.car.cond.body - 25); }
    if (p.st === 'married') {
      if (p.caught >= 2 || p.aff < 45) return loDivorce(p, 'caught');
      loLog(p, 'them', 'One more time and I\'m calling a lawyer.'); goPop('💔', p.name, `Caught you with ${withName}. One more time and it's a divorce.`, 'love');
    } else if (p.caught >= 2 || p.aff < 40) {
      const was = p.st; p.st = 'ex'; p.kidsOk = 0; if (LO.C && LO.C.key === k) loUnlink();
      goPop('💔', p.name, `Caught you with ${withName}. ${p.fem ? 'She' : 'He'} broke up with you.${keyed ? ' And keyed your car.' : ''}`, 'love');
      addGossip({ kind: 'gossip', icon: '💔', text: `${p.name} just put ${S.name || 'somebody'} on blast for cheating. ${was === 'engaged' ? 'Engagement OFF.' : 'It\'s over.'}` });
    } else goPop('💔', p.name, `Caught you with ${withName}. ${p.fem ? 'She' : 'He'}'s pissed.${keyed ? ' Keyed your car too.' : ''}`, 'love');
    save(); refreshStats();
  }
  function loDivorce(p, why) {
    const L = loS(); p.st = 'divorced'; p.kidsOk = 0; if (LO.C && LO.C.key === loKey(p)) loUnlink();
    let msg = `${p.name} filed for divorce.`;
    if (!p.uid) {
      const half = Math.round(S.bank / 2), fee = 2500; S.bank -= half; S.bank = Math.max(0, S.bank - fee);
      const kids = L.kids.filter(k => k.par && k.par.includes(loKey(p)) && loStage(k) !== 'grown');
      for (const k of kids) k.cust = 'them';
      L.support = kids.length * 120;
      msg += ` ${p.fem ? 'She' : 'He'} took ${money(half)} (half the bank) plus ${money(fee)} in lawyer fees.${kids.length ? ` ${kids.length === 1 ? 'Your kid lives' : 'The kids live'} with ${loHer(p)} now. Child support ${money(L.support)} a day, you get them on weekends.` : ''}`;
      addGossip({ kind: 'gossip', icon: '⚖️', text: `It's official: ${p.name} and ${S.name || 'their husband'} are getting divorced.${why === 'caught' ? ' Cheating, word is.' : ''}` });
    }
    loLog(p, 'them', why === 'caught' ? 'My lawyer will call you.' : 'It\'s over.'); goPop('⚖️', 'Divorce', msg, 'love'); toast(msg, 'bad'); save(); refreshStats();
  }

  // ---------- the fade to black ----------
  function loFadeEl() {
    if (LO.fade) return LO.fade;
    const st = document.createElement('style');
    st.textContent = `#lofade{position:fixed;inset:0;z-index:80;background:#000;opacity:0;pointer-events:none;transition:opacity 1.1s ease;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#f1ece4;text-align:center;padding:24px}
#lofade.on{opacity:1;pointer-events:auto}#lofade h2{font:400 26px Bungee,Impact,sans-serif;letter-spacing:.04em;margin:0 0 8px;color:#ffb3d1}#lofade p{font:600 15px var(--body);margin:0;opacity:.85;max-width:420px}
#lopill{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 88px);z-index:31;display:flex;gap:8px;align-items:center;background:rgba(26,14,22,0.88);color:#f6e8ef;border:1px solid rgba(255,140,190,0.55);border-radius:14px;padding:6px 8px 6px 12px;font:600 14px var(--body);max-width:94vw}
#lopill[hidden]{display:none}#lopill span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#lopill button{font:800 13px var(--body);letter-spacing:.03em;border-radius:10px;border:0;padding:7px 11px;background:#d6457f;color:#fff;cursor:pointer;white-space:nowrap}#lopill button.no{background:#3a3244}
body.phoning #lopill,body.creating #lopill{display:none}
.lo-sc{padding:0 12px 16px}.lo-sc h4{margin:14px 2px 6px;font:800 12px var(--body);letter-spacing:.08em;text-transform:uppercase;opacity:.65}
.lo-card{display:flex;gap:10px;align-items:center;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:10px;margin:6px 0;cursor:pointer}
.lo-card .av{width:40px;height:40px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;font-size:20px;background:linear-gradient(135deg,#ff6aa6,#7a1a4a)}
.lo-card .tx{flex:1;min-width:0}.lo-card b{display:block;font-size:15px}.lo-card span{font-size:12px;opacity:.7}
.lo-bar{height:6px;border-radius:4px;background:rgba(255,255,255,0.1);margin-top:5px;overflow:hidden}.lo-bar u{display:block;height:100%;background:linear-gradient(90deg,#ff6aa6,#ff2d6a)}
.lo-btns{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.lo-btns .btn{flex:1 1 44%;min-width:120px;font-size:13px;padding:9px 8px}.lo-btns .btn small{display:block;opacity:.7;font-weight:600;font-size:11px}
.lo-chat{display:flex;flex-direction:column;gap:5px;margin:8px 0}.lo-chat i{font-style:normal;max-width:78%;padding:7px 10px;border-radius:14px;font-size:13px;background:#2b2a31;align-self:flex-start}.lo-chat i.me{background:#d6457f;align-self:flex-end}
.lo-note{font-size:12px;opacity:.75;margin:4px 2px 8px;line-height:1.35}.lo-seg{display:flex;gap:6px;margin:6px 0}.lo-seg .btn{flex:1;font-size:12px;padding:8px 4px}.lo-seg .btn.on{background:#d6457f;color:#fff}`;
    document.head.append(st);
    const el = document.createElement('div'); el.id = 'lofade'; el.innerHTML = '<h2></h2><p></p>'; document.body.append(el); LO.fade = el; return el;
  }
  async function loBlack(steps, mid) {
    const el = loFadeEl(); LO.busy = true;
    try {
      for (let i = 0; i < steps.length; i++) {
        el.querySelector('h2').textContent = steps[i][0]; el.querySelector('p').textContent = steps[i][1] || '';
        if (i === 0) { el.classList.add('on'); await loWait(1300); }
        if (i === 1 && mid) { try { mid(); } catch (er) { console.warn('love', er); } }
        await loWait(steps[i][2] || 2200);
      }
      if (steps.length === 1 && mid) { try { mid(); } catch (er) { console.warn('love', er); } }
    } finally { el.classList.remove('on'); LO.busy = false; }
    await loWait(1100);
  }
  // spend the night: a fade to black and the next morning. Nothing is shown.
  async function loNight(p, rolled) {
    if (LO.busy) return;
    p.nights = (p.nights || 0) + 1; p.last = S.day; loAff(p, 5);
    let preg = false;
    if (!p.uid) {
      loCheat('night', p);
      if (p.kidsOk && !p.preg && !loS().myPreg && p.fem !== loMeFem() && Math.random() < 0.4) preg = true;
    } else preg = !!rolled;
    try { closeMenu(); closePhone(); } catch (er) {}
    await loBlack([['🌙', 'The lights go out...', 2400], ['The next morning', '', 2200]], () => {
      try { sleep(); } catch (er) {} try { setTime('day'); } catch (er) {}
      if (preg && !p.uid) { p.preg = { d0: S.day, seed: Math.floor(Math.random() * 1e9) }; }
    });
    if (!p.uid) { if (LO.C && LO.C.key === loKey(p)) loSay(LO.C, loPick(['good morning 🥰', 'i could get used to this', 'morning baby'])); loLog(p, 'them', loPick(['last night was nice 🥰', 'good morning handsome', 'you up?']).replace('handsome', p.fem ? 'handsome' : 'beautiful')); }
    if (preg && !p.uid) setTimeout(() => { loLog(p, 'them', 'Ummm... I\'m late. I took a test. I\'m pregnant 😳'); goPop('🍼', p.name, 'I took a test... I\'m pregnant!', 'love'); save(); }, 2500);
    save();
  }

  // ---------- dates, the wedding, the birth: things that happen where you are ----------
  function loNearPlace(types, r) { const [x, z] = loMe(); let best = null, bd = r; for (const q of DATA.P) { if (!types.includes(q.type)) continue; const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } } return best; }
  async function loDoDate(q) {
    const C = LO.C; if (!C) return; const p = C.p, D = LO_DATE[q.type];
    if (!spend(D.cost, `Date: ${D.what}`)) return;
    p.dateAt = p.dateAt || {}; p.dateAt[q.id] = S.day;
    await loBlack([[D.icon, `${D.what[0].toUpperCase() + D.what.slice(1)} at ${goShort(q.name)}`, 2200], ['Two hours later', '', 1600]], () => {
      const was = p.st; p.dates = (p.dates || 0) + 1; p.last = S.day; loAff(p, D.aff + (p.mad > S.day ? -6 : 0)); if (p.st === 'talking') p.st = 'dating';
      loCheat('date', p);
      if (was === 'talking') toast(`You and ${p.name} are dating now. ${p.aff}% affection.`, 'good'); else toast(`${p.name} had a good time. ${p.aff}% affection.`, 'good');
    });
    loSay(C, loPick(LO_SAY.happy)); loLog(p, 'them', loPick(LO_SAY.happy)); save(); refreshStats();
  }
  async function loWed(q, v) {
    const C = LO.C; if (!C) return; const p = C.p;
    if (!spend(v.cost, v.name)) return;
    await loBlack([['💍', `${v.name} at ${goShort(q.name)}`, 2600], ['"I do."', `${S.name || 'You'} and ${p.name}`, 2600]], () => {
      p.st = 'married'; p.wed = S.day; loAff(p, v.aff); delete loS().wedPlan;
    });
    loSay(C, 'i love you 💍'); toast(`You married ${p.name}! ${p.fem ? 'She' : 'He'} lives at your house now.`, 'good');
    addGossip({ kind: 'gossip', icon: '💍', text: `${S.name || 'Somebody'} and ${p.name} just got MARRIED at ${goShort(q.name)}. Congrats to the newlyweds!` });
    save(); refreshStats();
  }
  function loBorn(p, missed) {
    const L = loS(), pr = p.preg; if (!pr) return; p.preg = null;
    const fem = Math.random() < 0.5, used = new Set(L.kids.map(k => k.name)), names = LO_KID_N[fem ? 'f' : 'm'].filter(n => !used.has(n));
    const mom = p.fem ? p.look : myLook(), dad = p.fem ? myLook() : p.look;
    const k = { id: 'k' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: loPick(names.length ? names : LO_KID_N[fem ? 'f' : 'm']), fem, born: S.day, look: loKidLook(mom, dad, fem, pr.seed), par: [loKey(p)], bond: missed ? 35 : 60, fed: S.day };
    L.kids.push(k); loAff(p, missed ? -15 : 12);
    loLog(p, 'them', missed ? `You missed it. ${k.name} is here. ${k.fem ? 'Your daughter' : 'Your son'}.` : `We did it. Meet ${k.name} 🥹`);
    goPop('👶', missed ? p.name : 'JPS', `${k.fem ? 'It\'s a girl' : 'It\'s a boy'}! ${k.name} was born${missed ? ' while you were gone' : ''}.`, 'love');
    addGossip({ kind: 'gossip', icon: '👶', text: `Congrats to ${S.name || 'somebody'} and ${p.name} on baby ${k.name}! 🍼` });
    save(); return k;
  }
  async function loDeliver(p) {
    await loBlack([['🏥', 'JPS Labor & Delivery', 2400], ['Hours later...', '', 1800]], () => { const k = loBorn(p, false); if (k) LO.lastBorn = k.name; });
    toast(`${LO.lastBorn || 'The baby'} is here. Mom and baby are coming home.`, 'good');
  }

  // ---------- each day (sleep): pregnancy, labor, kids growing, affection, getting caught, child support ----------
  const _loSleep = sleep;
  sleep = function () {
    const r = _loSleep.apply(this, arguments);
    try { loDaily(); } catch (e) { console.warn('love daily', e); }
    return r;
  };
  function loDaily() {
    const L = loS();
    for (const p of Object.values(L.ppl)) {
      if (LO_TAKEN.has(p.st) || p.st === 'dating') {
        const away = S.day - (p.last || S.day);
        if (away >= 2) loAff(p, p.st === 'married' ? -3 : -2);
        if (away >= 3 && Math.random() < 0.5) loLog(p, 'them', loPick(['you forgot about me?', 'hello??', 'must be nice to be busy', 'u alive?']));
      }
      if (p.preg) {
        const d = S.day - p.preg.d0;
        if (d === 3 || d === 6) loLog(p, 'them', d === 3 ? 'The baby is the size of a lemon 🍋 I\'m showing now' : 'Baby kicking all night 😩 come rub my feet');
        if (d >= 9 && !p.preg.labor) { p.preg.labor = S.day; const h = DATA.P.find(q => q.type === 'hospital'); loLog(p, 'them', 'MY WATER BROKE. GET TO JPS NOW 🚨'); if (h) setPin('JPS: the baby is coming', h.x, h.z); goPop('🚨', p.name, 'My water broke! Get to JPS now!', 'love'); }
        else if (p.preg.labor && S.day > p.preg.labor) loBorn(p, true);
      }
      if (LO_TAKEN.has(p.st) && (L.sus[loKey(p)] || 0) > 0) {
        const s = L.sus[loKey(p)], odds = 1 - Math.exp(-s * 0.09);
        if (Math.random() < odds) loCaught(p, 'somebody else', false); else L.sus[loKey(p)] = Math.max(0, s - 1);
      }
    }
    // you, pregnant (online partner)
    const mp = L.myPreg;
    if (mp) { const d = S.day - mp.d0; if (d >= 9) loMyBorn(); else if (d === 4) toast('🍼 You\'re showing now.', 'good'); }
    for (const k of L.kids) {
      const was = k.stage || loStage(k), now = loStage(k); k.stage = now;
      if (now !== was) goPop('🎂', k.name, `${k.name} is a ${LO_STAGE[now].toLowerCase()} now (${loAgeTxt(k)}).`, 'love');
      if (k.cust !== 'them' && now !== 'grown' && S.day - (k.seen || k.born) > 3) k.bond = Math.max(0, (k.bond || 50) - 2);
    }
    if (L.support > 0) {
      const n = L.kids.filter(k => k.cust === 'them' && loStage(k) !== 'grown').length; L.support = n * 120;
      if (L.support) { if (S.bank >= L.support) S.bank -= L.support; else S.cash = Math.max(0, S.cash - L.support); toast(`Child support: -${money(L.support)}`, 'bad'); }
    }
    save();
  }

  // ---------- each frame ----------
  const _loStepStreet = stepStreet;
  stepStreet = function (t) {
    _loStepStreet.apply(this, arguments);
    if (!S || !worldOn) return;
    const n = performance.now(), dt = Math.min(0.05, (n - (LO.lt || n)) / 1000); LO.lt = n;
    try {
      if (!LO.C && loS().with && !LO.tried) { LO.tried = 1; const p = loByKey(loS().with); if (p && !p.uid && p.st !== 'ex' && p.st !== 'divorced') loLink(p); }
      loStepC(dt); loStepHome(dt); loStepMe(); loPillStep();
    } catch (e) { if (LO.err++ < 5) console.warn('love frame: ' + e.message, e.stack); }
  };
  function loStepMe() {
    const k = loPregK(loS().myPreg);
    if (ME) { if (k > 0 || LO.bellyMe) { loBelly(ME, k); LO.bellyMe = k > 0 ? ME : null; } }
  }
  function loPillStep() {
    if (!LO.pill) { loFadeEl(); LO.pill = document.createElement('div'); LO.pill.id = 'lopill'; LO.pill.hidden = true; document.body.append(LO.pill); LO.pill.addEventListener('click', ev => { const b = ev.target.closest('button'); if (b && LO.act[b.dataset.a]) LO.act[b.dataset.a](); }); }
    if ((LO.tick = (LO.tick + 1) % 6) && LO.pillKey !== '?') return;
    const L = loS(), act = {}, [mx, mz] = loMe(); let html = '';
    const esc2 = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
    let inv = null; for (const v of LO.inbox.values()) inv = v;
    const C = LO.C;
    if (LO.busy) html = '';
    else if (inv) { html = `<span>💕 <b>${esc2(inv.name)}</b> ${esc2(LO_ASK[inv.t] ? LO_ASK[inv.t][1] : 'wants something')}</span><button data-a="yes">YES</button><button class="no" data-a="no">NO</button>`; act.yes = () => loAnswer(inv, true); act.no = () => loAnswer(inv, false); }
    else if (C && foot.on && !inside) {
      const p = C.p, h = DATA.P.find(q => q.type === 'hospital');
      const plan = L.wedPlan, vq = plan != null && p.st === 'engaged' ? loNearPlace([LO_VENUE[plan].type], 40) : null;
      const dq = loNearPlace(Object.keys(LO_DATE), 32);
      if (p.preg && p.preg.labor && h && Math.hypot(h.x - mx, h.z - mz) < 45) { html = `<span>🏥 <b>${esc2(p.name)}</b> is in labor</span><button data-a="go">GO IN</button>`; act.go = () => loDeliver(p); }
      else if (vq) { const v = LO_VENUE[plan]; html = `<span>💍 Marry <b>${esc2(p.name)}</b> here · ${money(v.cost)}</span><button data-a="wed">I DO</button>`; act.wed = () => loWed(vq, v); }
      else if (dq && !(p.dateAt && p.dateAt[dq.id] === S.day)) { const D = LO_DATE[dq.type]; html = `<span>${D.icon} Date: ${esc2(D.what)} at ${esc2(goShort(dq.name))} · ${money(D.cost)}</span><button data-a="date">START</button>`; act.date = () => loDoDate(dq); }
      else if (loAtHome(30) && LO_ST.indexOf(p.st) >= 1) { html = `<span>🏠 <b>${esc2(p.name)}</b> came home with you</span><button data-a="night">🌙 STAY THE NIGHT</button>`; act.night = () => loAskNight(p); }
    }
    if (!html && !LO.busy && foot.on && !inside) {
      // your family at home
      let best = null, bd = 2.8;
      if (LO.wife && Math.hypot(LO.wife.x - mx, LO.wife.z - mz) < bd) { best = { w: LO.wife }; bd = Math.hypot(LO.wife.x - mx, LO.wife.z - mz); }
      for (const K of LO.kids.values()) { if (K.held) continue; const d = Math.hypot(K.x - mx, K.z - mz); if (d < bd) { bd = d; best = { k: K }; } }
      if (best && best.w) { const p = best.w.p; html = `<span>💍 <b>${esc2(p.name)}</b> · ${loWord(p)} · ${p.aff}%</span><button data-a="talk">TALK</button>`; act.talk = () => openMenu(() => loWifeMenu(best.w)); }
      else if (best && best.k) { const k = best.k.k; html = `<span>${loStage(k) === 'baby' ? '👶' : '🧒'} <b>${esc2(k.name)}</b> · ${loAgeTxt(k)}</span><button data-a="talk">${loStage(k) === 'baby' ? 'HOLD' : 'TALK'}</button>`; act.talk = () => openMenu(() => loKidMenu(k, best.k)); }
      else if (netOn()) {
        // an online player right next to you
        let pn = null, pd = 4; for (const v of NET.peers.values()) { if (v.fresh || v.inCar || !v.uid) continue; const d = Math.hypot(v.x - mx, v.z - mz); if (d < pd) { pd = d; pn = v; } }
        if (pn) { const r = L.pl[pn.uid]; html = `<span>💕 <b>${esc2(pn.name)}</b>${r ? ' · ' + esc2(loWord(r)) : ''}</span><button data-a="love">LOVE</button>`; act.love = () => { openPhone(); phoneApp('love'); loApp(phoneEl('ph-screen'), { on: 'o:' + pn.uid, name: pn.name }); }; }
      }
    }
    if (!html && C && !LO.busy && driving && !foot.on) html = `<span>💕 <b>${esc2(C.p.name)}</b> is riding with you</span>`;
    LO.act = act;
    if (html !== LO.pillKey) { LO.pillKey = html; LO.pill.innerHTML = html; }
    const show = !!html && worldOn && !creating; if (LO.pill.hidden === show) LO.pill.hidden = !show;
  }
  function loAskNight(p) {
    if (p.uid) return;
    if (p.mad > S.day || p.aff < 40 || loRank(p.st) < 1) { if (LO.C) loSay(LO.C, loPick(['not tonight', 'i\'m going home tonight', 'we not there yet'])); toast(`${p.name} wants to go home tonight.`); return; }
    loNight(p);
  }

  // ---------- your wife at the house ----------
  function loWifeMenu(W) {
    const p = W.p, rows = [];
    rows.push({ t: 'Hey baby', s: 'Spend a minute with her', btn: 'Talk', act: () => { p.last = S.day; if (p.talkD !== S.day) { p.talkD = S.day; loAff(p, 2); } loSay(W, p.mad > S.day ? loPick(LO_SAY.mad) : p.preg ? loPick(['these feet hurt', 'baby kicking', 'i want some wings']) : loPick(LO_SAY.hi)); } });
    rows.push({ t: `Take ${loHer(p)} out`, s: 'Comes with you', btn: 'Let\'s go', act: () => { closeMenu(); const x = W.x, z = W.z; loWifeOff(); loLink(p, x, z); } });
    rows.push({ t: 'Stay in tonight', s: '🌙 Fade to black, next morning', btn: 'Go inside', off: p.mad > S.day, act: () => loNight(p) });
    rows.push({ t: 'Talk about kids', s: p.kidsOk ? 'You both want kids. It can happen when you stay in.' : 'See if you both want kids', btn: p.kidsOk ? 'Stop trying' : 'Talk', act: () => loKidsTalk(p, W) });
    rows.push({ t: 'Divorce', s: 'Half the bank and lawyer fees', btn: 'File', act: () => { if (!loSure('div' + p.id)) { toast('Tap File again to divorce.'); return; } closeMenu(); loDivorce(p, 'you'); } });
    return { title: p.name, sub: `${loWord(p)} · ${p.aff}%${p.preg ? ` · 🍼 ${Math.min(9, S.day - p.preg.d0)}/9 months` : ''}`, rows };
  }
  function loSure(k) { const now = Date.now(); if (LO.sure === k && now - LO.sureT < 4000) { LO.sure = null; return true; } LO.sure = k; LO.sureT = now; return false; }
  function loKidsTalk(p, W) {
    if (p.kidsOk) { p.kidsOk = 0; loLog(p, 'me', 'Let\'s hold off on kids for now'); loLog(p, 'them', 'ok, that\'s fine'); toast(`You and ${p.name} are holding off on kids.`); save(); return; }
    if (p.fem === loMeFem()) { toast('You two can adopt from the Love app.'); return; }
    const yes = p.st === 'married' ? p.aff >= 50 : p.st === 'engaged' ? p.aff >= 65 : p.st === 'gf' && p.aff >= 80;
    loLog(p, 'me', 'You want kids with me?');
    if (yes) { p.kidsOk = 1; loLog(p, 'them', 'Yes. I want a family with you 🥹'); toast(`You and ${p.name} both want kids. It can happen when you stay the night.`, 'good'); }
    else loLog(p, 'them', loRank(p.st) < 2 ? 'Slow down lol, we just started' : 'I\'m not ready yet. Ask me again later');
    if (W) loSay(W, p.chat[p.chat.length - 1][1]);
    save();
  }
  // ---------- your kids ----------
  function loKidMenu(k, K) {
    const st = loStage(k), rows = [], bond = () => { k.seen = S.day; save(); };
    const kSay = t => K && loSay(K, t);
    if (st === 'baby') {
      rows.push({ t: 'Pick up and hold', s: 'Rock them to sleep', btn: 'Hold', act: () => { k.bond = Math.min(100, (k.bond || 50) + 4); bond(); kSay(loPick(['*giggles*', '*coos*', '*yawns*', 'ba ba'])); } });
      rows.push({ t: 'Feed', s: 'Bottle time', btn: money(12), off: k.fed === S.day, act: () => { if (!spend(12, 'Formula')) return; k.fed = S.day; k.bond = Math.min(100, (k.bond || 50) + 3); bond(); kSay('*happy noises*'); } });
      rows.push({ t: 'Change diaper', s: 'Somebody gotta do it', btn: money(6), act: () => { if (!spend(6, 'Diapers')) return; k.bond = Math.min(100, (k.bond || 50) + 2); bond(); kSay('*kicks feet*'); } });
    } else {
      rows.push({ t: 'Hug', s: 'They missed you', btn: 'Hug', act: () => { k.bond = Math.min(100, (k.bond || 50) + 3); bond(); kSay(loPick(st === 'teen' ? ['ok ok i love you too', 'dad stop lol'] : ['i love you!', 'you back!!', 'pick me up!'])); } });
      rows.push({ t: st === 'toddler' ? 'Play peekaboo' : st === 'kid' ? 'Play catch in the yard' : 'Shoot hoops', s: 'Quality time', btn: 'Play', act: () => { k.bond = Math.min(100, (k.bond || 50) + 5); bond(); S.energy = Math.max(0, S.energy - 5); kSay(loPick(['again again!', 'you cant catch me', 'haha', 'that was fun'])); } });
      if (st !== 'toddler') rows.push({ t: 'Help with homework', s: 'School matters', btn: 'Help', act: () => { k.school = Math.min(100, (k.school || 50) + 6); k.bond = Math.min(100, (k.bond || 50) + 2); bond(); kSay(loPick(['oh that makes sense now', 'thank you!', 'math is hard'])); } });
      rows.push({ t: st === 'teen' ? 'Give them money' : 'Allowance', s: 'Spoil them a little', btn: money(st === 'teen' ? 100 : 20), act: () => { if (!spend(st === 'teen' ? 100 : 20, 'Allowance: ' + k.name)) return; k.bond = Math.min(100, (k.bond || 50) + 3); bond(); kSay(loPick(['yesss thank you', 'can i get more', 'ur the best'])); } });
      rows.push({ t: 'Buy new clothes and shoes', s: 'Fresh for school', btn: money(180), act: () => { if (!spend(180, 'Clothes: ' + k.name)) return; const R = Math.random, pick = a => a[Math.floor(R() * a.length)]; k.look.top = pick(['mh_tee_purple', 'mh_hoodie_box', 'mj_dallas_star', 'mh_gg_hoodie', 'mj_mavs', 'tee_white']); k.look.shoes = pick(['mk_jordan_bred', 'mk_uni_blue', 'mk_af1_white', 'mk_dunk_panda']); k.bond = Math.min(100, (k.bond || 50) + 4); bond(); loKidOff(k.id); } });
    }
    return { title: k.name, sub: `${k.fem ? 'Daughter' : 'Son'} · ${LO_STAGE[st]} · ${loAgeTxt(k)} · Bond ${Math.round(k.bond || 50)}%`, rows };
  }

  // ---------- online: two players both say yes ----------
  const LO_ASK = {
    date: ['Ask out', 'wants to date you', 'dating'], gf: ['Make it official', 'wants to make it official', 'gf'], propose: ['Propose', 'is proposing to you 💍', 'engaged'],
    wed: ['Get married', 'wants to get married right now 💍', 'married'], kids: ['Have kids together', 'wants to have kids with you', null], night: ['Spend the night', 'wants you to spend the night 🌙', null], adopt: ['Adopt a baby', 'wants to adopt a baby with you', null],
  };
  function loNetSend(to, t, extra) { netSend({ k: 'lv', t, to, u: S.uid, n: netMe().name, ...(extra || {}) }); }
  function loPeerByUid(uid) { for (const v of NET.peers.values()) if (v.uid === uid) return v; return null; }
  function loAsk(uid, t) {
    if (!netOn()) { toast('You need to be online.', 'bad'); return; }
    const pr = loPeerByUid(uid); if (!pr) { toast('They\'re not on your server right now.', 'bad'); return; }
    const [mx, mz] = loMe(), d = Math.hypot(pr.x - mx, pr.z - mz);
    if (d > (t === 'night' ? 12 : 40)) { toast(`Get closer to ${pr.name} first.`); return; }
    if (t === 'date' || t === 'gf' || t === 'propose') loCheat(t === 'date' ? 'ask' : 'gf', loS().pl[uid] || { uid });
    const rid = Math.random().toString(36).slice(2, 10); LO.out = { rid, to: pr.id, uid, t, name: pr.name };
    loNetSend(pr.id, t, { rid });
    setTimeout(() => { if (LO.out && LO.out.rid === rid) { LO.out = null; toast(`${pr.name} never answered.`); } }, 25000);
    toast(`Asked ${pr.name}: ${LO_ASK[t][0].toLowerCase()}. Waiting on their answer.`, 'good');
  }
  function loPlRec(uid, name, look) { const L = loS(); const r = L.pl[uid] || (L.pl[uid] = { uid, name, st: 'talking', aff: 50, since: S.day, kidsOk: 0, chat: [] }); r.name = name || r.name; if (look) { r.fem = look.body === 'f'; r.look = look; } return r; }
  function loApply(uid, t, name, look, x) {
    const r = loPlRec(uid, name, look);
    if (LO_ASK[t] && LO_ASK[t][2]) { r.st = LO_ASK[t][2]; if (t === 'wed') r.wed = S.day; }
    if (t === 'kids') r.kidsOk = 1;
    if (t === 'adopt') { const k = x && x.kid ? loKidIn(x.kid, uid) : null; if (k) goPop('👶', 'Adoption', `${k.name} is home with you and ${r.name}.`, 'love'); }
    const msg = { date: `You and ${r.name} are dating.`, gf: `You and ${r.name} are official.`, propose: `You and ${r.name} are engaged! 💍`, wed: `You and ${r.name} are married! 💍`, kids: `You and ${r.name} both want kids.` }[t];
    if (msg) { toast(msg, 'good'); loLog(r, 'them', msg); }
    if (t === 'wed') addGossip({ kind: 'gossip', icon: '💍', text: `${S.name || 'Somebody'} and ${r.name} just got married! 💍` });
    save();
  }
  // a kid record from the other player (born or adopted): your copy, same id
  function loKidIn(m, uid) {
    if (!m || typeof m.id !== 'string' || !/^k\w{4,24}$/.test(m.id)) return null;
    const L = loS(); if (L.kids.some(k => k.id === m.id)) return null;
    const look = cleanLook(m.look); if (!look) return null;
    const k = { id: m.id, name: String(m.name || 'Baby').replace(/[^\w '\-]/g, '').slice(0, 16) || 'Baby', fem: !!m.fem, born: S.day - Math.max(0, Math.min(200, +m.age || 0)), look: { ...look, extras: [], tats: [] }, par: ['o:' + uid], bond: 55, fed: S.day };
    L.kids.push(k); save(); return k;
  }
  async function loAnswer(inv, yes) {
    LO.inbox.delete(inv.rid); LO.pillKey = '?';
    const pr = NET.peers.get(inv.from);
    if (!yes || !pr) { if (pr) loNetSend(inv.from, 'no', { rid: inv.rid }); return; }
    const extra = { rid: inv.rid };
    if (inv.t === 'night') {
      // whoever carries the baby: only when you both agreed to kids, one of you is a woman and one isn't
      const r = loPlRec(pr.uid, pr.name, pr.look), meF = loMeFem(), themF = !!(pr.look && pr.look.body === 'f');
      if (r.kidsOk && meF !== themF && !loS().myPreg && !r.preg && Math.random() < 0.4) { extra.preg = 1; extra.who = meF ? 'me' : 'you'; extra.seed = Math.floor(Math.random() * 1e9); }
      loNetSend(inv.from, 'yes', extra); loNightOnline(r, pr, extra, true); return;
    }
    if (inv.t === 'adopt') { const r = loPlRec(pr.uid, pr.name, pr.look), fem = Math.random() < 0.5, k = { id: 'k' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: loPick(LO_KID_N[fem ? 'f' : 'm']), fem, look: loKidLook(myLook(), pr.look || myLook(), fem, Math.floor(Math.random() * 1e9)), age: 0 }; extra.kid = k; loNetSend(inv.from, 'yes', extra); const mine = loKidIn(k, pr.uid); if (mine) goPop('👶', 'Adoption', `${mine.name} is home with you and ${r.name}.`, 'love'); return; }
    loNetSend(inv.from, 'yes', extra); loApply(pr.uid, inv.t, pr.name, pr.look);
  }
  function loNightOnline(r, pr, x, answered) {
    let carrier = null; if (x.preg) carrier = answered ? (x.who === 'me' ? 'me' : 'them') : (x.who === 'me' ? 'them' : 'me');
    loNight(r, false).then(() => {
      if (carrier === 'me') { loS().myPreg = { d0: S.day, by: 'o:' + r.uid, seed: x.seed }; toast('🍼 You took a test... you\'re pregnant!', 'good'); goPop('🍼', 'Pregnant', `You and ${r.name} are having a baby!`, 'love'); }
      else if (carrier === 'them') { r.preg = { d0: S.day, seed: x.seed }; goPop('🍼', r.name, `${r.name} is pregnant! You're having a baby.`, 'love'); }
      save();
    });
  }
  function loMyBorn() {
    const L = loS(), mp = L.myPreg; if (!mp) return; L.myPreg = null;
    const r = loByKey(mp.by), fem = Math.random() < 0.5, used = new Set(L.kids.map(k => k.name)), names = LO_KID_N[fem ? 'f' : 'm'].filter(n => !used.has(n));
    const k = { id: 'k' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: loPick(names.length ? names : LO_KID_N[fem ? 'f' : 'm']), fem, born: S.day, look: loKidLook(myLook(), (r && r.look) || myLook(), fem, mp.seed || 7), par: [mp.by], bond: 70, fed: S.day };
    L.kids.push(k); goPop('👶', 'JPS', `${fem ? 'It\'s a girl' : 'It\'s a boy'}! ${k.name} is here.`, 'love');
    if (r && r.uid) { r.preg = null; const msg = { k: 'lv', t: 'born', u: S.uid, n: netMe().name, kid: { id: k.id, name: k.name, fem: k.fem, look: k.look, age: 0 } }; const pr = loPeerByUid(r.uid); if (pr && netOn()) netSend({ ...msg, to: pr.id }); else { L.box.push({ uid: r.uid, msg }); L.box = L.box.slice(-6); } }
    save();
  }
  NET_HOOK.recv.push((p, m, now) => {
    if (!S || !m) return;
    // somebody we owe a baby announcement just showed up
    if (m.k === 'h' && typeof m.u === 'string') { const L = loS(), keep = []; for (const b of L.box) { if (b.uid === m.u) setTimeout(() => netSend({ ...b.msg, to: p.id }), 1200); else keep.push(b); } if (keep.length !== L.box.length) { L.box = keep; save(); } const r = L.pl[m.u]; if (r && p.look) { r.fem = p.look.body === 'f'; r.look = p.look; } }
    if (m.k !== 'lv' || m.to !== NET.id || typeof m.u !== 'string' || m.u.length > 24) return;
    const L = loS(), t = m.t, rid = typeof m.rid === 'string' ? m.rid.slice(0, 12) : '', name = typeof m.n === 'string' ? m.n.slice(0, 24) : p.name;
    p.uid = p.uid || m.u;
    if (LO_ASK[t]) {
      if (!rid || LO.inbox.size >= 3) return;
      LO.inbox.set(rid, { rid, from: m.id, uid: m.u, name, t }); LO.pillKey = '?';
      setTimeout(() => { if (LO.inbox.delete(rid)) LO.pillKey = '?'; }, 25000);
      toast(`💕 ${name} ${LO_ASK[t][1]}`);
    } else if ((t === 'yes' || t === 'no') && LO.out && LO.out.rid === rid && LO.out.uid === m.u) {
      const o = LO.out; LO.out = null;
      if (t === 'no') { toast(`${o.name} said no.`); return; }
      if (o.t === 'night') { const r = loPlRec(m.u, name, p.look); loNightOnline(r, p, { preg: m.preg, who: m.who, seed: +m.seed || 7 }, false); return; }
      if (o.t === 'adopt') { const k = loKidIn(m.kid, m.u); if (k) goPop('👶', 'Adoption', `${k.name} is home with you and ${name}.`, 'love'); return; }
      loApply(m.u, o.t, name, p.look);
    } else if (t === 'born') { const k = loKidIn(m.kid, m.u); const r = L.pl[m.u]; if (r) r.preg = null; if (k) goPop('👶', name, `${k.fem ? 'It\'s a girl' : 'It\'s a boy'}! ${k.name} is here.`, 'love'); }
    else if (t === 'break' || t === 'divorce') { const r = L.pl[m.u]; if (r) { r.st = t === 'divorce' ? 'divorced' : 'ex'; r.kidsOk = 0; toast(`💔 ${name} ${t === 'divorce' ? 'divorced you' : 'broke up with you'}.`, 'bad'); save(); } }
    else if (t === 'cheat') { const r = L.pl[m.u]; if (r && LO_TAKEN.has(r.st)) { const w = typeof m.w === 'string' ? m.w.slice(0, 24) : 'somebody'; LO.caughtP = { uid: m.u, name, w }; goPop('🚨', 'Caught', `${name} was out with ${w}. Break up or let it slide? (Love app)`, 'love'); loLog(r, 'them', `(you caught ${loHer(r)} with ${w})`); save(); } }
  });
  // your belly, for everybody else
  NET_HOOK.hello.push(() => { const k = loPregK(loS && S && S.love ? S.love.myPreg : null); return k > 0 ? { pg: +k.toFixed(2) } : {}; });
  NET_HOOK.recv.push((p, m) => { if (m && m.k === 'h') p.lvPg = typeof m.pg === 'number' ? Math.max(0, Math.min(1, m.pg)) : 0; });
  NET_HOOK.draw.push((p, v) => { if (v && v.P && (p.lvPg || v.lvBelly)) { loBelly(v.P, p.lvPg || 0); v.lvBelly = p.lvPg > 0; } });

  // ---------- the Love app ----------
  PHONE_APPS.splice(Math.max(0, PHONE_APPS.findIndex(a => a.id === 'settings')), 0, { id: 'love', name: 'Love', icon: '💕', bg: 'linear-gradient(135deg,#ff6aa6,#8a1048)' });
  { const _ph = phoneApp; phoneApp = function (id) { if (id === 'love') return loApp(phoneEl('ph-screen')); return _ph.apply(this, arguments); }; }
  function loApp(sc, view) {
    if (!sc) return; PH.app = 'love'; LO.view = view || null; loFadeEl();
    const L = loS(), esc2 = esc, v = LO.view;
    sc.className = 'ph-screen';
    let body = '';
    const card = (key, p, sub) => `<div class="lo-card" data-open="${esc2(key)}"><div class="av">${p.uid ? '🎮' : p.fem ? '👩🏾' : '👨🏾'}</div><div class="tx"><b>${esc2(p.name)}</b><span>${esc2(sub)}</span><div class="lo-bar"><u style="width:${Math.max(3, p.aff || 0)}%"></u></div></div></div>`;
    if (!v) {
      const people = loAll().sort((a, b) => (loRank(b.st) - loRank(a.st)) || (b.aff - a.aff));
      body += `<div class="lo-sc">`;
      if (L.myPreg) body += `<div class="lo-note">🍼 You're pregnant · ${Math.min(9, S.day - L.myPreg.d0)}/9 months</div>`;
      if (LO.caughtP) { const c = LO.caughtP; body += `<div class="lo-card" style="border-color:#e0483a"><div class="av">🚨</div><div class="tx"><b>${esc2(c.name)} was out with ${esc2(c.w)}</b><span>What you gonna do?</span><div class="lo-btns"><button class="btn" data-caught="break">Break up</button><button class="btn" data-caught="slide">Let it slide</button></div></div></div>`; }
      body += `<h4>Your people</h4>` + (people.length ? people.map(p => card(loKey(p), p, `${loWord(p)} · ${p.aff || 0}%${p.preg ? ' · 🍼 pregnant' : ''}${LO.C && LO.C.key === loKey(p) ? ' · with you' : ''}`)).join('') : `<div class="lo-note">Nobody yet. Walk up to somebody, hit TALK and shoot your shot. Online, stand next to another player and tap LOVE.</div>`);
      const kids = L.kids;
      if (kids.length) body += `<h4>Your kids</h4>` + kids.map(k => `<div class="lo-card" data-kid="${esc2(k.id)}"><div class="av" style="background:linear-gradient(135deg,#7fd1ff,#2a6fd1)">${loStage(k) === 'baby' ? '👶' : loStage(k) === 'grown' ? '🧑🏾' : '🧒🏾'}</div><div class="tx"><b>${esc2(k.name)}</b><span>${k.fem ? 'Daughter' : 'Son'} · ${LO_STAGE[loStage(k)]} · ${loAgeTxt(k)}${k.cust === 'them' ? ' · weekends' : ''}</span><div class="lo-bar"><u style="width:${Math.max(3, k.bond || 50)}%;background:linear-gradient(90deg,#7fd1ff,#2a6fd1)"></u></div></div></div>`).join('');
      if (netOn()) {
        const [mx, mz] = loMe(), near = [...NET.peers.values()].filter(q => q.uid && !q.fresh && Math.hypot(q.x - mx, q.z - mz) < 60);
        body += `<h4>Players near you</h4>` + (near.length ? near.map(q => card('o:' + q.uid, { uid: q.uid, name: q.name, aff: (L.pl[q.uid] || {}).aff || 0 }, L.pl[q.uid] ? loWord(L.pl[q.uid]) : `${Math.round(Math.hypot(q.x - mx, q.z - mz))} m away · tap to ask`)).join('') : `<div class="lo-note">Nobody close. Get within 40 m of another player.</div>`);
      }
      if (L.support) body += `<div class="lo-note">Child support: ${money(L.support)} a day.</div>`;
      body += `<h4>Interested in</h4><div class="lo-seg">${['women', 'men', 'both'].map(x => `<button class="btn${L.pref === x ? ' on' : ''}" data-pref="${x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div>`;
      body += `<div class="lo-note">Kids only happen when you both agree to have kids. Staying the night fades to black and cuts to the next morning.</div></div>`;
    } else if (v.kid) {
      const k = L.kids.find(q => q.id === v.kid);
      if (k) { const st = loStage(k); body += `<div class="lo-sc"><h4>${k.fem ? 'Daughter' : 'Son'} · ${LO_STAGE[st]} · ${loAgeTxt(k)}</h4><div class="lo-note">Bond ${Math.round(k.bond || 50)}%${k.school ? ` · School ${Math.round(k.school)}%` : ''}. ${st === 'grown' ? `${k.name} is grown and moved out.` : k.cust === 'them' ? 'Lives with their other parent. You get them on weekends at your house.' : 'Lives at your house. Go home to see them.'}</div><div class="lo-btns"><input class="go-in" data-kname maxlength="16" value="${esc2(k.name)}" style="flex:1 1 60%;font:16px var(--body);padding:8px;border-radius:10px;border:1px solid #444;background:#111;color:#fff;user-select:text;-webkit-user-select:text"><button class="btn" data-a="rename">Rename</button></div>${st !== 'grown' ? `<div class="lo-btns"><button class="btn" data-a="gohome">🏠 GPS home</button><button class="btn" data-a="kidgift">🎁 Send a gift<small>${money(150)}</small></button></div>` : ''}</div>`; }
    } else if (v.on) {
      const p = loByKey(v.on), online = v.on[0] === 'o', uid = online ? v.on.slice(2) : null, pr = online ? loPeerByUid(uid) : null;
      const P = p || (online ? { uid, name: v.name || (pr && pr.name) || 'Player', st: null, aff: 0 } : null);
      if (P) {
        const st = P.st, r = loRank(st), with_ = LO.C && LO.C.key === v.on, b = [];
        const add = (a, t, sm, off) => b.push(`<button class="btn" data-a="${a}" ${off ? 'disabled' : ''}>${t}${sm ? `<small>${sm}</small>` : ''}</button>`);
        body += `<div class="lo-sc"><h4>${st ? esc2(loWord(P)) : 'Not together'}${P.aff ? ` · ${P.aff}% affection` : ''}${P.preg ? ` · 🍼 ${Math.min(9, S.day - P.preg.d0)}/9 months` : ''}</h4>`;
        if (P.aff) body += `<div class="lo-bar" style="height:8px;margin:0 2px 8px"><u style="width:${P.aff}%"></u></div>`;
        if (!online) {
          if (st === 'ex' || st === 'divorced') { body += `<div class="lo-note">${st === 'ex' ? 'You two broke up.' : 'You\'re divorced.'} ${P.aff >= 60 ? `${loHe(P)[0].toUpperCase() + loHe(P).slice(1)} might take you back.` : 'Win them back with texts and gifts.'}</div>`; add('back', 'Ask for another chance', `Needs ${60}%`, P.aff < 60); add('text', 'Text', 'Say something'); add('gift', 'Send a gift', 'Flowers and more'); add('delete', 'Delete number', 'Gone for good'); }
          else {
            add('text', '💬 Text', 'Say something'); add('call', with_ ? '👋 Send home' : '📞 Link up', with_ ? 'They go home' : 'They come to you', !with_ && (P.mad > S.day || (st === 'talking' && P.aff < 22)));
            add('gift', '🎁 Send a gift', 'Flowers, perfume, bags');
            if (r >= 1) add('date', '📍 Date spots', 'GPS to the closest');
            if (st === 'dating') add('gf', 'Make it official', P.aff < 55 || (P.dates || 0) < 2 ? 'Needs 55% + 2 dates' : 'Ask them', P.aff < 55 || (P.dates || 0) < 2);
            if (st === 'gf') add('ring', '💍 Buy a ring + propose', P.aff < 70 ? 'Needs 70%' : 'Ask them', P.aff < 70);
            if (st === 'engaged') add('plan', '💒 Plan the wedding', L.wedPlan != null ? LO_VENUE[L.wedPlan].name : 'Pick a venue');
            if (r >= 2) add('kids', P.kidsOk ? '🍼 Stop trying for kids' : '🍼 Talk about kids', P.kidsOk ? 'You both want kids' : 'You both have to agree');
            if (r >= 2 && P.fem === loMeFem()) add('adopt', '👶 Adopt a baby', money(5000));
            add('break', st === 'married' ? '⚖️ Divorce' : '💔 Break up', st === 'married' ? 'Half the bank' : 'It\'s over');
          }
          if (with_) body += `<div class="lo-note">${esc2(P.name)} is with you. Walk into a food spot, mall, marina or landmark for a date${r >= 1 ? ', or take them home to stay the night' : ''}.</div>`;
        } else {
          const near = !!pr;
          if (!near) body += `<div class="lo-note">${esc2(P.name)} isn't on your server right now. Asking needs you both online and close.</div>`;
          if (!st || st === 'ex' || st === 'divorced') add('ask:date', '💕 Ask out', 'They have to say yes', !near);
          if (st === 'dating' || st === 'talking') add('ask:gf', 'Make it official', 'They have to say yes', !near);
          if (st === 'gf') add('ask:propose', '💍 Propose', 'They have to say yes', !near);
          if (st === 'engaged') add('ask:wed', '💒 Get married', 'Both say I do', !near);
          if (r >= 2) add('ask:kids', P.kidsOk ? '🍼 You both want kids' : '🍼 Have kids together', 'They have to say yes', !near || P.kidsOk);
          if (r >= 1) add('ask:night', '🌙 Spend the night', 'Stand together · fades to black', !near);
          if (r >= 2) add('ask:adopt', '👶 Adopt a baby', 'Together', !near);
          if (st && st !== 'ex' && st !== 'divorced') add('obreak', st === 'married' ? '⚖️ Divorce' : '💔 Break up', 'Ends it for both');
        }
        body += `<div class="lo-btns">${b.join('')}</div>`;
        if (LO.sub === 'text' && !online) body += `<div class="lo-btns">${['Wyd 👀', 'Good morning beautiful ☀️', 'I miss you', 'Send you $100 for nails 💅', 'Come outside'].map((t, i) => `<button class="btn" data-say="${i}">${esc2(t.replace('beautiful', P.fem ? 'beautiful' : 'handsome'))}</button>`).join('')}</div>`;
        if (LO.sub === 'gift') body += `<div class="lo-btns">${LO_GIFTS.map((g, i) => `<button class="btn" data-gift="${i}">${esc2(g.n)}<small>${money(g.c)}</small></button>`).join('')}</div>`;
        if (LO.sub === 'ring') body += `<div class="lo-btns">${LO_RINGS.map((g, i) => `<button class="btn" data-ring="${i}">${esc2(g.name)}<small>${money(g.cost)}</small></button>`).join('')}</div>`;
        if (LO.sub === 'plan') body += `<div class="lo-btns">${LO_VENUE.map((g, i) => `<button class="btn${L.wedPlan === i ? ' go' : ''}" data-venue="${i}">${esc2(g.name)}<small>${money(g.cost)}</small></button>`).join('')}</div><div class="lo-note">Then link up with ${esc2(P.name)} and go to the venue together.</div>`;
        if (P.chat && P.chat.length) body += `<div class="lo-chat">${P.chat.slice(-14).map(c => `<i class="${c[0] === 'me' ? 'me' : ''}">${esc2(c[1])}</i>`).join('')}</div>`;
        body += `</div>`;
      }
    }
    const title = !v ? 'Love' : v.kid ? esc2((L.kids.find(q => q.id === v.kid) || {}).name || 'Kid') : esc2((loByKey(v.on) || {}).name || v.name || 'Player');
    sc.innerHTML = phoneHead('💕 ' + title) + `<div class="ph-body">${body}</div>`;
    const back = sc.querySelector('.ph-back'); if (back) back.onclick = () => { LO.sub = null; if (v) loApp(sc); else phoneHome(); };
    const re = () => loApp(sc, LO.view);
    sc.querySelectorAll('[data-open]').forEach(el => el.onclick = () => { LO.sub = null; loApp(sc, { on: el.dataset.open, name: el.querySelector('b').textContent }); });
    sc.querySelectorAll('[data-kid]').forEach(el => el.onclick = () => loApp(sc, { kid: el.dataset.kid }));
    sc.querySelectorAll('[data-pref]').forEach(el => el.onclick = () => { L.pref = el.dataset.pref; save(); re(); });
    sc.querySelectorAll('[data-caught]').forEach(el => el.onclick = ev => { ev.stopPropagation(); const c = LO.caughtP; LO.caughtP = null; if (c && el.dataset.caught === 'break') { const r = L.pl[c.uid]; if (r) { const was = r.st; r.st = was === 'married' ? 'divorced' : 'ex'; r.kidsOk = 0; const pr = loPeerByUid(c.uid); if (pr) loNetSend(pr.id, was === 'married' ? 'divorce' : 'break'); toast(`You ${was === 'married' ? 'divorced' : 'broke up with'} ${c.name}.`, 'bad'); } } save(); re(); });
    const P = v && v.on ? loByKey(v.on) : null, k = v && v.kid ? L.kids.find(q => q.id === v.kid) : null;
    sc.querySelectorAll('[data-say]').forEach(el => el.onclick = () => {
      const i = +el.dataset.say; if (!P) return;
      if (i === 3 && !spend(100, 'Sent ' + P.name + ' $100')) return;
      loLog(P, 'me', el.textContent); P.textD = P.textD || {};
      const fresh = P.textD[i] !== S.day; P.textD[i] = S.day;
      if (P.mad > S.day) loLog(P, 'them', loPick(LO_SAY.mad));
      else { loAff(P, fresh ? [2, 3, 3, 6, 1][i] : 0); loLog(P, 'them', [loPick(['nun just laying down', 'at work 😩', 'thinking bout you', 'getting my hair done']), loPick(['good morning 🥰', 'morning!!', 'you sweet']), loPick(['i miss you more', 'come see me then', 'prove it']), loPick(['omg thank you 😍', 'you the best', 'ok you spoil me']), loPick(['omw', 'im outside 👀', 'give me 10 min'])][i]); if (i === 4 && !LO.C && P.aff >= 22) { loLink(P); toast(`${P.name} pulled up.`, 'good'); } }
      save(); re();
    });
    sc.querySelectorAll('[data-gift]').forEach(el => el.onclick = () => { const g = LO_GIFTS[+el.dataset.gift]; if (!P || !spend(g.c, `Gift for ${P.name}: ${g.n}`)) return; loAff(P, g.a); if (P.mad > S.day && g.c >= 180) P.mad = 0; loLog(P, 'me', `Sent you ${g.n.toLowerCase()} 🎁`); loLog(P, 'them', loPick(['omg 😍', 'you didnt have to do that', 'this why i fw you', 'ok you forgiven 😒'])); save(); re(); });
    sc.querySelectorAll('[data-ring]').forEach(el => el.onclick = () => { const g = LO_RINGS[+el.dataset.ring]; if (!P || !spend(g.cost, `Ring: ${g.name}`)) return; const yes = Math.random() < Math.min(0.97, 0.35 + (P.aff - 70) / 50 + g.k + (P.dates || 0) * 0.02); loLog(P, 'me', `Will you marry me? 💍 (${g.name})`); if (yes) { P.st = 'engaged'; P.ring = g.id; loAff(P, 10); loLog(P, 'them', 'YES!!! YES 😭💍'); toast(`${P.name} said YES! You're engaged.`, 'good'); addGossip({ kind: 'gossip', icon: '💍', text: `${S.name || 'Somebody'} put a ring on ${P.name}'s finger! Engaged!` }); } else { loAff(P, -8); loLog(P, 'them', 'I... I\'m not ready. I\'m sorry.'); toast(`${P.name} said not yet. Keep the ring and try again later. (Ring sold back for half.)`, 'bad'); earn(Math.round(g.cost / 2), 'Ring sold back'); } LO.sub = null; save(); re(); });
    sc.querySelectorAll('[data-venue]').forEach(el => el.onclick = () => { L.wedPlan = +el.dataset.venue; const vv = LO_VENUE[L.wedPlan], [mx, mz] = loMe(); let best = null, bd = 1e12; for (const q of DATA.P) if (q.type === vv.type) { const d = Math.hypot(q.x - mx, q.z - mz); if (d < bd) { bd = d; best = q; } } if (best) setPin(`Wedding: ${goShort(best.name)}`, best.x, best.z); toast(`${vv.name}. GPS set${best ? ': ' + goShort(best.name) : ''}. Bring ${P ? P.name : 'them'}.`, 'good'); save(); re(); });
    sc.querySelectorAll('[data-a]').forEach(el => el.onclick = () => {
      const a = el.dataset.a;
      if (a.startsWith('ask:')) { loAsk(v.on.slice(2), a.slice(4)); return; }
      if (a === 'obreak') { if (!loSure('ob' + v.on)) { toast('Tap again to end it.'); return; } const r = loByKey(v.on); if (r) { const was = r.st; r.st = was === 'married' ? 'divorced' : 'ex'; r.kidsOk = 0; const pr = loPeerByUid(r.uid); if (pr) loNetSend(pr.id, was === 'married' ? 'divorce' : 'break'); toast(`It's over with ${r.name}.`, 'bad'); save(); } re(); return; }
      if (a === 'rename' && k) { const n = sc.querySelector('[data-kname]').value.replace(/[^\w '\-]/g, '').trim().slice(0, 16); if (n) { k.name = n; save(); toast(`Renamed to ${n}.`, 'good'); } re(); return; }
      if (a === 'gohome') { const h = loHome(); if (h) { setPin('Home', h.x, h.z); closePhone(); toast('GPS set: home', 'good'); } return; }
      if (a === 'kidgift' && k) { if (spend(150, 'Gift for ' + k.name)) { k.bond = Math.min(100, (k.bond || 50) + 6); save(); toast(`${k.name} loved it.`, 'good'); } re(); return; }
      if (!P) return;
      if (a === 'text' || a === 'gift' || a === 'ring' || a === 'plan') { LO.sub = LO.sub === a ? null : a; re(); return; }
      if (a === 'call') { if (LO.C && LO.C.key === v.on) { loUnlink(); loLog(P, 'me', 'I\'ll get with you later'); toast(`${P.name} went home.`); } else { loCheat('date', P); if (P.aff < 22 && P.st === 'talking') { loLog(P, 'them', 'idk you like that yet lol'); } else { loLink(P); loLog(P, 'me', 'Pull up?'); loLog(P, 'them', 'omw 😘'); closePhone(); toast(`${P.name} pulled up.`, 'good'); return; } } save(); re(); return; }
      if (a === 'date') { const q = (() => { const [mx, mz] = loMe(); let best = null, bd = 1e12; for (const x of DATA.P) if (LO_DATE[x.type]) { const d = Math.hypot(x.x - mx, x.z - mz); if (d < bd) { bd = d; best = x; } } return best; })(); if (q) { setPin(`Date: ${goShort(q.name)}`, q.x, q.z); closePhone(); toast(`GPS set: ${goShort(q.name)} (${LO_DATE[q.type].what}).${LO.C ? '' : ` Link up with ${P.name} first.`}`, 'good'); } return; }
      if (a === 'gf') { const yes = P.aff >= 55 && Math.random() < 0.55 + (P.aff - 55) / 60; loLog(P, 'me', 'So what are we? I want you to be mine'); loCheat('gf', P); if (yes) { P.st = 'gf'; loAff(P, 6); loLog(P, 'them', 'I thought you\'d never ask 🥰'); toast(`You and ${P.name} are official.`, 'good'); } else { loAff(P, -3); loLog(P, 'them', 'Let\'s keep getting to know each other first'); } save(); re(); return; }
      if (a === 'kids') { loKidsTalk(P); re(); return; }
      if (a === 'adopt') { if (!spend(5000, 'Adoption')) return; const fem = Math.random() < 0.5, kk = { id: 'k' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: loPick(LO_KID_N[fem ? 'f' : 'm']), fem, born: S.day, look: loKidLook(myLook(), P.look, fem, Math.floor(Math.random() * 1e9)), par: [v.on], bond: 60, fed: S.day }; L.kids.push(kk); goPop('👶', 'Adoption', `${kk.name} is home with you and ${P.name}.`, 'love'); save(); re(); return; }
      if (a === 'back') { P.st = 'dating'; P.mad = 0; P.caught = 0; loLog(P, 'them', 'Last chance. Don\'t make me regret it.'); toast(`${P.name} took you back.`, 'good'); save(); re(); return; }
      if (a === 'delete') { if (!loSure('del' + P.id)) { toast('Tap again to delete.'); return; } delete L.ppl[P.id]; save(); loApp(sc); return; }
      if (a === 'break') { if (!loSure('br' + P.id)) { toast(P.st === 'married' ? 'Tap again to file for divorce.' : 'Tap again to break up.'); return; } if (P.st === 'married') loDivorce(P, 'you'); else { P.st = 'ex'; P.kidsOk = 0; loAff(P, -30); if (LO.C && LO.C.key === v.on) loUnlink(); loLog(P, 'me', 'I think we should stop talking'); loLog(P, 'them', loPick(['wow ok', 'your loss', 'fine. lose my number'])); toast(`You broke up with ${P.name}.`, 'bad'); } save(); re(); return; }
    });
  }
  window.__love = { talkMenu: e => hTalkMenu(e), LO, loS, loLink, loUnlink, loShot, loAskOutHere, loNight, loBorn, loDaily, loDivorce, loCaught, loCheat, loBelly, loKidLook, loKidModel, loStage, loAge, loApp, loAsk, loAnswer, loDoDate, loWed, loDeliver, loMyBorn, loPregK, loCanFlirt, loWifeMenu, loKidMenu, LO_VENUE, LO_DATE, loHomeSpot, kidsTalk: loKidsTalk,
    tick: (dt = 0.05) => { loStepC(dt); loStepHome(dt); loStepMe(); LO.pillKey = '?'; loPillStep(); },
    places: t => { const [x, z] = loMe(); let best = null, bd = 1e12; for (const q of DATA.P) if (q.type === t) { const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } } return best ? { x: best.x, z: best.z, name: best.name, id: best.id } : null; } };
  // ==== love + family (end) ====
