  // ==== shooting scenes (begin) ====
  // When FWPD pulls up on a shooting they lock the whole scene down: everybody who was shooting (both sets, the drive-by
  // car, your homies and you) gets told to get on the ground, and every one of them gets cuffed and taken in. One unit per
  // person, more units roll in from across town until there are enough, and a unit that drops somebody off comes back for
  // the next one. Somebody always tries to run (an officer runs them down), the drive-by car gets a felony stop, the block
  // gets crime scene tape and numbered evidence markers, and if you were shooting and got away, detectives keep working it.
  // The sets fight back the way sets do: lookouts yell 12, a set that got hit spins back on the set that did it, and a corner
  // the police emptied out stays hot for a while before new faces get put on it.
  // Online: everybody sees the same units, officers, hands up and cuffs, the tape, and who got taken stays gone for everybody.
  const SC = { inc: [], seq: 0, sc: null, mine: [], jailed: {}, out: { scn: [], sjl: [] }, pay: [], look: {}, recT: 25, payT: 6, order: null, inv: [], mute: false, tapes: [], tick: 0 };
  const SC_MODES = /^(npcx|scx|scar|perim|xport)$/;
  const scCap = () => phone ? 5 : 8;
  const scD = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const scR = () => copRand();
  const scPick = a => a[Math.floor(scR() * a.length)];
  const SCL = {
    down: ['man I aint do nothin!', 'aight aight!', 'I aint even out here like that', 'yall got the wrong one', 'dont shoot!', 'my hands up!', 'this crazy bro', 'call my mama'],
    run: ['im gone!', 'nah nah nah', 'they aint catchin me', 'RUN!'],
    caught: ['aight! aight! Im done', 'man get off me!', 'I wasnt even runnin from yall', 'damn bro'],
    twelve: ['12! 12!', 'twelve on the block!', 'its hot, put it up', 'boys in blue, chill', 'twelve, everybody act normal'],
    patrol: ['act normal', 'here go 12', 'they bout to circle back'],
    car: ['we aint do nothin officer', 'man why yall pullin us over', 'this aint even my car'],
  };

  // ---------- incidents: every shot fired, who fired it and where ----------
  function scShot(who, x, z) {
    if (!isFinite(x) || !isFinite(z)) return;
    const now = cNow();
    let inc = SC.inc.find(i => Math.hypot(i.x - x, i.z - z) < 140 && now - i.last < 150);
    if (!inc) { inc = { id: ++SC.seq, x, z, t0: now, last: now, sh: new Map(), pos: [], me: 0, meDrop: 0, drops: 0, bodies: [], locked: false }; SC.inc.push(inc); }
    inc.last = now;
    if (who === 'me') { inc.me++; SC.mine.push({ t: now, x, z }); if (SC.mine.length > 40) SC.mine.shift(); }
    else if (who && who.id) inc.sh.set(who.id, who);
    if (!inc.pos.some(p => Math.hypot(p[0] - x, p[1] - z) < 2.5) && inc.pos.length < 14) inc.pos.push([x, z]);
    if (SC.inc.length > 8) SC.inc = SC.inc.filter(i => i.locked || now - i.last < 240).slice(-8);
  }
  const scIncAt = (x, z, R = 160) => { const now = cNow(); return SC.inc.find(i => Math.hypot(i.x - x, i.z - z) < R && now - i.last < 200) || null; };
  // you were shooting around here, lately
  const scMeShot = (x, z, R = 150, secs = 150) => { const now = cNow(); return SC.mine.some(s => now - s.t < secs && Math.hypot(s.x - x, s.z - z) < R); };
  // NPC shots (gang members, opps, the drive-by shooter, your homies): every one goes through hShotOut
  const _scShotOut = hShotOut;
  hShotOut = function (e, t, k) { try { if (e && !e.cop) scShot(e, e.x, e.z); } catch (er) {} return _scShotOut.apply(this, arguments); };
  // your shots (only real trigger pulls, not the aim crosshair)
  const _scShotHook = window.__shotHook;
  window.__shotHook = (O, D, best, t0) => { if (_scShotHook) _scShotHook(O, D, best, t0); if (window.__firing && S) try { scShot('me', O.x, O.z); } catch (er) {} };
  // bodies on the ground count for the evidence markers and the charges
  const _scDrop = hDrop;
  hDrop = function (e, by) { const r = _scDrop.apply(this, arguments); try { const i = e && scIncAt(e.x, e.z, 150); if (i) { i.drops++; if (i.bodies.length < 6) i.bodies.push([e.x, e.z]); } } catch (er) {} return r; };
  const _scCredit = hDropCredit;
  hDropCredit = function (e) { try { const i = e && scIncAt(e.x, e.z, 170); if (i) i.meDrop++; } catch (er) {} return _scCredit.apply(this, arguments); };
  // the per-arrest street news is one summary at the end of a scene, not eight toasts
  const _scNews = wNews;
  wNews = function () { if (SC.mute) return; return _scNews.apply(this, arguments); };

  // ---------- crime scene tape + numbered evidence markers (built the same on every screen) ----------
  let SC_TAPE_TEX = null, SC_MAT = null;
  function scTapeTex() {
    if (SC_TAPE_TEX) return SC_TAPE_TEX;
    const c = document.createElement('canvas'); c.width = 512; c.height = 32; const x = c.getContext('2d');
    x.fillStyle = '#f5d21c'; x.fillRect(0, 0, 512, 32); x.fillStyle = '#111'; x.font = '900 20px Arial'; x.textBaseline = 'middle';
    for (let i = 0; i < 2; i++) x.fillText('POLICE LINE  DO NOT CROSS', 8 + i * 256, 17);
    SC_TAPE_TEX = new THREE.CanvasTexture(c); SC_TAPE_TEX.wrapS = THREE.RepeatWrapping; return SC_TAPE_TEX;
  }
  function scMats() {
    if (SC_MAT) return SC_MAT;
    SC_MAT = { post: new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.6, metalness: 0.4 }), cone: new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.55 }), tent: {} };
    return SC_MAT;
  }
  function scTentMat(n) {
    const M = scMats(); if (M.tent[n]) return M.tent[n];
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#ffd21a'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#111'; x.font = '900 40px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 32, 35);
    const t = new THREE.CanvasTexture(c); return (M.tent[n] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, side: THREE.DoubleSide }));
  }
  const scSolid = (x, z, pad = 0.4) => solids.at(x, z).some(b => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad);
  function scTape(x, z, marks, key) {
    if (SC.tapes.some(t => t.key === key || Math.hypot(t.x - x, t.z - z) < 25)) return null;
    const g = new THREE.Group(); g.name = 'crime-scene'; const M = scMats(), R = 15, N = 12, posts = [];
    for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R; posts.push(scSolid(px, pz) ? null : [px, pz]); }
    const postG = new THREE.CylinderGeometry(0.05, 0.06, 1.05, 6), coneG = new THREE.ConeGeometry(0.2, 0.55, 10);
    const tex = scTapeTex(), tm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide });
    for (let i = 0; i < N; i++) {
      const p = posts[i]; if (!p) continue;
      const m = new THREE.Mesh(i % 3 ? postG : coneG, i % 3 ? M.post : M.cone); m.position.set(p[0], i % 3 ? 0.52 : 0.28, p[1]); g.add(m);
      const q = posts[(i + 1) % N]; if (!q) continue;
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (scSolid((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0)) continue;
      const t = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.13), tm.clone()); t.material.map = tex.clone(); t.material.map.needsUpdate = true; t.material.map.repeat.set(Math.max(1, L / 4), 1);
      t.userData.tape = 1; t.position.set((p[0] + q[0]) / 2, 0.95 - 0.04 * Math.sin(i), (p[1] + q[1]) / 2); t.rotation.y = -Math.atan2(q[1] - p[1], q[0] - p[0]); g.add(t);
    }
    // little yellow tents: casings where people were shooting from, and by anybody who went down
    const tentG = new THREE.PlaneGeometry(0.34, 0.3);
    (marks || []).slice(0, 10).forEach(([mx, mz], k) => {
      if (scSolid(mx, mz, 0.1)) return;
      const tg = new THREE.Group(); tg.position.set(mx + (k % 2 ? 0.6 : -0.6), 0, mz + 0.4); tg.rotation.y = k * 1.3;
      for (const s of [-1, 1]) { const p = new THREE.Mesh(tentG, scTentMat(k + 1)); p.position.set(0, 0.1, s * 0.06); p.rotation.x = s * 0.45; tg.add(p); }
      g.add(tg);
    });
    scene.add(g);
    const T = { key, x, z, g, life: 600, marks: (marks || []).slice(0, 10) }; SC.tapes.push(T); return T;
  }
  function scTapeStep(dt) {
    const [mx, mz] = copMe();
    for (const T of SC.tapes.slice()) if ((T.life -= dt) <= 0 || Math.hypot(T.x - mx, T.z - mz) > 500) { scene.remove(T.g); T.g.traverse(o => { if (o.isMesh && o.userData.tape) { o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); SC.tapes = SC.tapes.filter(o => o !== T); }
    for (const T of SC.tapes) T.g.visible = driving && !inside;
  }

  // ---------- locking down the scene ----------
  function scSuspects(inc, ev) {
    const L = [], add = (e, shooter) => {
      if (!e || e.gone || e.down || e.jl || e.cop || e.kind === 'ped' || e.meet || (HOOD.ride && HOOD.ride.e === e)) return;
      if (e.own && e.own !== 'me') return; if (e.inCar && !e.wcar) return;
      if (Math.hypot(e.x - inc.x, e.z - inc.z) > (e.wcar ? 320 : 150)) return;
      const o = L.find(q => q.e === e); if (o) { o.shot = o.shot || shooter; return; } L.push({ e, shot: shooter });
    };
    for (const e of inc.sh.values()) add(e, true);
    if (ev) { for (const e of ev.ents) add(e, true); for (const m of ev.b.crew) add(m, false); }
    // anybody still in a gunfight here (shooting at you, or your homies shooting back)
    for (const e of HOOD.ents) if ((e.mode === 'fight' || e.mode === 'aim' || (e.kind === 'homie' && e.gd)) && Math.hypot(e.x - inc.x, e.z - inc.z) < 120) add(e, e.mode === 'fight');
    return L;
  }
  function scCharges(s, inc) {
    const ch = [];
    if (s.shot) { ch.push('deadly', 'unl_carry'); if (inc.drops) ch.push(scR() < 0.45 ? 'murder' : 'agg_assault'); else if (scR() < 0.3) ch.push('agg_assault'); }
    else { ch.push('unl_carry'); if (scR() < 0.35) ch.push('pom'); if (scR() < 0.2) ch.push('warrant'); }
    return ch;
  }
  function scHold(e, ch, run) {
    hClaim(e); e.war = null; e.gd = 0; e.want = 0; e.gun = null;
    e.jl = { u: null, ch, why: 'scene', ph: 'stop', t: 0, scene: true, run: !!run };
    e.mode = run ? 'flee' : 'hands';
    if (!JL.npc.includes(e)) JL.npc.push(e);
    hSay(e, hPick(run ? SCL.run : SCL.down));
  }
  function scBind(e, u) {
    const A = e.jl; if (!A) return;
    A.u = u; A.t = 0; A.ph = 'stop'; u.scE = null; u.mode = 'npcx'; u.jlE = e; u.lights = true; u.siren = false; u.npcT = 0; u.off = true;
  }
  function scFree(u) { u.scE = null; if (u.mode === 'scx' || u.mode === 'scar') { u.mode = 'patrol'; u.lights = u.siren = false; copJoin(u); } }
  function scSpawn(sc, mode) {
    const e = copEntry(sc.x, sc.z, 110, 260) || copEntry(sc.x, sc.z, 200, 420); if (!e) return null;
    const u = copUnit(scR() < 0.55 ? 'charger' : 'tahoe', e[0], e[1], 0, mode || 'scx'); copOnRoad(u, e[0], e[1]); u.lights = u.siren = true; u.sc = sc; sc.units.add(u); sc.spawned++; return u;
  }
  function scLock(inc, u0) {
    inc.locked = true;
    const ev = WAR.ev && !WAR.ev.done && Math.hypot(WAR.ev.x - inc.x, WAR.ev.z - inc.z) < 170 ? WAR.ev : null;
    const L = scSuspects(inc, ev), [mx, mz] = copMe();
    const meIn = (inc.me > 0 || scMeShot(inc.x, inc.z)) && Math.hypot(mx - inc.x, mz - inc.z) < 170 && !jBusy() && !inside && driving;
    if (!L.length && !meIn) { inc.locked = 'empty'; return null; }
    const street = copStreet(inc.x, inc.z), sc = { inc, x: inc.x, z: inc.z, street, t: 0, sus: [], cars: [], units: new Set(), spawned: 0, booked: [], ran: 0, done: false, ev, meIn };
    SC.sc = sc;
    // everybody on foot: on the ground. Somebody always runs.
    const foot = L.filter(s => !s.e.inCar), runners = foot.length >= 3 ? 1 + (foot.length >= 6 && scR() < 0.5 ? 1 : 0) : foot.length === 2 && scR() < 0.4 ? 1 : 0;
    const runSet = new Set(foot.filter(s => s.e.kind !== 'homie').sort(() => scR() - 0.5).slice(0, runners).map(s => s.e));
    for (const s of L) {
      if (s.e.inCar) { sc.cars.push(s.e); s.e.scCh = ['deadly', 'unl_carry', 'agg_assault']; continue; }
      scHold(s.e, scCharges(s, inc), runSet.has(s.e)); sc.sus.push(s.e);
      if (runSet.has(s.e)) s.e.jl.ch.push('evade');
    }
    // the war is over the second the police are there
    if (ev) { ev.scene = true; if (ev.phase !== 'out' && ev.phase !== 'done') ev.phase = 'out'; for (const m of ev.b.crew) if (m.war && m.war.ev === ev) { m.war = null; if (!m.jl && !m.down) { m.gd = 0; m.mode = 'idle'; } } }
    // units: whoever is already lit up around here first, then more from across town
    const lit = COP.units.filter(u => !u.gone && u.lights && !SC_MODES.test(u.mode) && u.mode !== 'stop' && u.mode !== 'hold' && Math.hypot(u.x - inc.x, u.z - inc.z) < 260).sort((a, b) => scD(a, inc) - scD(b, inc));
    let meU = null;
    if (meIn && COP.phase !== 'chase') { meU = lit.filter(u => u.mode !== 'stop').sort((a, b) => Math.hypot(a.x - mx, a.z - mz) - Math.hypot(b.x - mx, b.z - mz))[0] || null; }
    for (const u of lit) { if (u === meU || (COP.phase === 'chase' && u.mode === 'chase')) continue; u.sc = sc; sc.units.add(u); u.mode = 'patrol'; }
    // close out the 911 call: this is a scene now
    if (COP.phase === 'search' && COP.call && Math.hypot(COP.call.x - inc.x, COP.call.z - inc.z) < 200) copEnd('');
    if (meU) { meU.mode = 'hold'; meU.lights = true; meU.siren = false; meU.sp *= 0.5; }
    scAssign(sc, true);
    copWhoop();
    toast(`🚨 FWPD locked down ${street}: "EVERYBODY ON THE GROUND! LET ME SEE YOUR HANDS!"${sc.sus.length + sc.cars.length ? ` ${sc.sus.length + sc.cars.length} being detained.` : ''}`, 'bad');
    if (meIn && COP.phase !== 'chase') scOrder(inc);
    else if (Math.hypot(mx - inc.x, mz - inc.z) < 45 && !jBusy()) setTimeout(() => toast('👮 "Back up! This is a crime scene. Stay behind the tape."', ''), 1800);
    // you were shooting and you're long gone: detectives pick it up
    if (inc.me > 0 && !meIn && !jBusy()) SC.inv.push({ at: cNow() + 45 + scR() * 50, inc, street });
    const marks = [...inc.pos, ...inc.bodies];
    scTape(inc.x, inc.z, marks, 'L' + inc.id);
    if (hOn()) SC.out.scn.push([Math.round(inc.x * 10), Math.round(inc.z * 10), marks.slice(0, 10).map(p => [Math.round(p[0] * 10), Math.round(p[1] * 10)]), hNow()]);
    return sc;
  }
  // a unit for everybody still standing there with their hands up, up to what the city can send at once
  function scAssign(sc, first) {
    const busy = u => !u.gone && u.sc === sc && (u.mode === 'scx' || u.mode === 'npcx' || u.mode === 'scar');
    let active = [...sc.units].filter(busy).length;
    const free = [...sc.units].filter(u => !u.gone && u.mode === 'patrol');
    const waiting = sc.sus.filter(e => !e.gone && !e.down && e.jl && e.jl.scene && !e.jl.u && ![...sc.units].some(u => u.scE === e && !u.gone && u.mode === 'scx')).sort((a, b) => (b.jl.run ? 1 : 0) - (a.jl.run ? 1 : 0) || scD(a, sc) - scD(b, sc));
    for (const e of waiting) {
      let u = free.sort((a, b) => scD(a, e) - scD(b, e)).shift();
      if (!u) { if (active >= scCap() || sc.spawned >= 14) break; u = scSpawn(sc, 'scx'); if (!u) break; }
      u.mode = 'scx'; u.scE = e; u.lights = true; u.siren = scD(u, e) > 60; u.scT = 0; u.sc = sc; active++;
      if (scD(u, e) < 45) scBind(e, u);
    }
    // the drive-by car: a unit runs it down
    for (const e of sc.cars) {
      if (e.gone || e.down || e.scStop || e.jl || [...sc.units].some(u => u.scE === e && u.mode === 'scar' && !u.gone)) continue;
      let u = free.shift(); if (!u) { if (active >= scCap() + 1) break; u = scSpawn(sc, 'scar'); if (!u) break; }
      u.mode = 'scar'; u.scE = e; u.lights = u.siren = true; u.scT = 0; u.sc = sc; active++;
      if (first) copSay(`Dispatch: units, the shooter's vehicle is fleeing ${copStreet(e.x, e.z)}. Light it up.`);
    }
  }
  // the unit drives over on the roads, then right up to them
  function scDrive(u, dt) {
    const e = u.scE;
    if (!e || e.gone || e.down || !e.jl || e.jl.u) { scFree(u); return; }
    const d = scD(u, e); u.scT = (u.scT || 0) + dt;
    if (d < 45) { scBind(e, u); return; }
    if (u.scT > 50) { copOnRoad(u, e.x, e.z); const g = gpsGraph(); u.x = g.nx[u.a]; u.z = g.nz[u.a]; u.scT = 20; }
    if (d < 75) { u.off = true; u.join = null; copSteer(u, dt, e.x, e.z, clamp(d * 0.7, 8, 22)); return; }
    if (u.off) copJoin(u);
    if (u.b == null && u.join == null) copJoin(u);
    u.t += dt; if (u.b != null && (u.t > 2 || !u.path)) { u.t = 0; const n = hNearestNode(e.x, e.z); if (n >= 0 && n !== u.b) u.path = hRoute(u.b, n) || null; }
    copRoad(u, dt, 30, true);
  }
  // the drive-by car: chase it, light it up, box it in
  function scCarChase(u, dt) {
    const e = u.scE;
    if (!e || e.gone || e.down) { scFree(u); return; }
    if (e.jl && !e.scStop) { scFree(u); return; }
    const d = scD(u, e); u.scT = (u.scT || 0) + dt;
    if (e.scStop) { const bx = e.x + Math.sin(e.yaw) * 7.5, bz = e.z + Math.cos(e.yaw) * 7.5, db = Math.hypot(bx - u.x, bz - u.z); copSteer(u, dt, bx, bz, clamp(db * 1.4, 0, 16)); if (db < 1.5) u.sp = 0; return; }
    if (d < 26) {
      e.scStop = { t: 0, u }; e.jl = { u: null, ch: e.scCh || ['deadly', 'unl_carry'], why: 'scene', ph: 'fstop', t: 0, scene: true };
      toast(`🚔 Felony stop: units boxed in the car from the drive-by on ${copStreet(e.x, e.z)}.`, 'bad'); copWhoop(); return;
    }
    if (u.scT > 70) { scFree(u); return; }
    if (d < 70) { u.off = true; u.join = null; copSteer(u, dt, e.x - Math.sin(e.yaw) * 2, e.z - Math.cos(e.yaw) * 2, Math.max(0, e.sp || 0) + 10); return; }
    if (u.off) copJoin(u);
    if (u.b == null && u.join == null) copJoin(u);
    u.t += dt; if (u.b != null && (u.t > 1.5 || !u.path)) { u.t = 0; const n = hNearestNode(e.x, e.z); if (n >= 0 && n !== u.b) u.path = hRoute(u.b, n) || null; }
    copRoad(u, dt, 40, true);
  }
  // the car rolls to a stop, then both of them come out with their hands up
  function scCarStop(e, dt) {
    const st = e.scStop; st.t += dt;
    e.sp = Math.max(0, (e.sp || 0) - 9 * dt); e.x -= Math.sin(e.yaw) * e.sp * dt; e.z -= Math.cos(e.yaw) * e.sp * dt; e.wo = Math.max(0, (e.wo || 0) - dt * 2.5); e.gd = 0;
    if (e.sp > 0.2 || st.t < 1.6) return;
    const sc = SC.sc, u = st.u; e.scStop = null;
    e.parked = { x: e.x, z: e.z, yaw: e.yaw }; e.inCar = false; e.wo = 0;
    const c = Math.cos(e.yaw), s = Math.sin(e.yaw), px = e.x, pz = e.z;
    e.x = px + c * 1.9; e.z = pz - s * 1.9;
    const ch = e.jl.ch; e.jl = null; scHold(e, ch, false); hSay(e, hPick(SCL.car));
    if (sc) sc.sus.push(e);
    // the driver
    const B = hBase(e.gang, 1);
    if (B) {
      const name = H_NICKS[(hHash(e.id) + 5) % H_NICKS.length];
      const dv = hEnt({ id: hXid('d'), own: 'me', ct: hNow(), desc: { k: 'member', g: hToNet(e.gang), n: name, gn: 'g19', v: 1 }, kind: 'member', gang: e.gang, blk: null, slider: true, name, x: px - c * 1.9, z: pz + s * 1.9, hx: px - c * 1.9, hz: pz + s * 1.9, yaw: e.yaw, mode: 'hands', gunId: 'g19' });
      hDress(dv, hClone(B)); hLabel(dv); scHold(dv, ['deadly', 'evade_veh'], false); if (sc) sc.sus.push(dv);
    }
    if (u && !u.gone && u.mode === 'scar') { u.mode = 'scx'; u.scE = e; u.scT = 0; scBind(e, u); }
    if (sc) scAssign(sc);
  }

  // ---------- one arrest at a time per unit, from the jail's NPC arrest (hands, cuffs, walk to the car, back seat) ----------
  const _scNpcUnit = jNpcUnit;
  jNpcUnit = function (u, dt) {
    const e = u.jlE, A = e && e.jl;
    if (A && A.run && (A.ph === 'stop' || A.ph === 'walk') && !e.gone && !e.down) { scRunner(u, e, A, dt); return; }
    SC.mute = !!(A && A.scene);
    // after a foot chase the unit pulls up to wherever the officer took them down
    const far = A && A.scene && (A.ph === 'cuff' || A.ph === 'lead') && e && !e.gone && scD(u, e) > 14, sp0 = u.sp;
    try { _scNpcUnit.apply(this, arguments); } finally { SC.mute = false; }
    if (far && u.jlE === e) { u.sp = sp0; const d = scD(u, e); copSteer(u, dt, e.x, e.z, clamp(d * 0.8, 0, 14)); if (A.ph === 'lead') A.t = Math.min(A.t, 10); }
    if (e && A && A.scene && !u.jlE && (e.gone || e.hide)) scBooked(e, A);
  };
  // the one who ran: the unit goes after them, an officer jumps out and takes them down
  function scRunner(u, e, A, dt) {
    u.npcT += dt; A.t += dt;
    const flee = (fx, fz) => { const dx = e.x - fx, dz = e.z - fz, l = Math.hypot(dx, dz) || 1, ax = dx / l, az = dz / l; if (!hFootMove(e, e.x + ax * 4, e.z + az * 4, dt, true)) { if (!hFootMove(e, e.x - az * 4, e.z + ax * 4, dt, true)) hFootMove(e, e.x + az * 4, e.z - ax * 4, dt, true); } e.mode = 'flee'; };
    if (A.ph === 'stop') {
      const d = scD(u, e); flee(u.x, u.z);
      copSteer(u, dt, e.x, e.z, Math.min(20, d * 1.3));
      // boxed in by a building: cut through on the next street over and come at them from there
      u.stkT = (u.stkT || 0) + dt; if (u.stkT > 2) { const mv = Math.hypot(u.x - (u.stkX || 0), u.z - (u.stkZ || 0)); u.stkT = 0; u.stkX = u.x; u.stkZ = u.z; if (mv < 1 && d > 14) { const l = d || 1, px = e.x + (u.x - e.x) / l * 14, pz = e.z + (u.z - e.z) / l * 14; if (!scSolid(px, pz, 1.6)) { u.x = px; u.z = pz; u.yaw = Math.atan2(-(e.x - px), -(e.z - pz)); } else { const g = gpsGraph(), n = hNearestNode(e.x, e.z); if (n >= 0) { u.x = g.nx[n]; u.z = g.nz[n]; } } } }
      if (d < 9 || u.npcT > 30) { u.sp = 0; A.ph = 'walk'; A.t = 0; copOfficer(u); toast(`🚔 ${e.name} took off running. Officer in foot pursuit.`, ''); }
      return;
    }
    u.sp *= Math.pow(0.05, dt);
    const o = u.officer; if (!o) { A.run = false; A.ph = 'cuff'; A.t = 0; return; }
    const od = copWalk(o, e.x, e.z, dt, 7.6);
    if (od > 1.1 && A.t < 20) { flee(o.x, o.z); e.fsp = Math.min(e.fsp || 0, 5.2); return; }
    A.run = false; A.ph = 'cuff'; A.t = 0; A.tackled = true; e.mode = 'hands'; o.yaw = e.yaw; o.P.wrap.rotation.y = o.yaw;
    hSay(e, hPick(SCL.caught)); toast(`👮 Officer ran ${e.name} down. Cuffs on.`, '');
    const sc = SC.sc; if (sc) sc.ran++;
  }
  function scBooked(e, A) {
    const sc = SC.sc; if (!sc || sc.booked.some(b => b.e === e)) return;
    const set = e.gang && setOf(e.gang) ? setOf(e.gang).short : '';
    sc.booked.push({ e, name: e.name, set, ch: A.ch });
    scMarkJailed(e);
  }
  function scMarkJailed(e) {
    if (!/^[mr]:/.test(e.id)) return;
    const t = hNow(); SC.jailed[e.id] = t; if (hOn() && SC.out.sjl.length < 12) SC.out.sjl.push([e.id, t]);
  }
  // book them right now (you're headed downtown, or they're far off): straight into the roster
  function scBookNow(e) {
    const A = e.jl; if (!A) return null;
    const u = A.u; if (u && !u.gone) { if (u.officer) copOfficerGone(u); u.jlE = null; u.mode = 'patrol'; u.lights = false; copJoin(u); }
    const j = jS(), set = e.gang && setOf(e.gang) ? setOf(e.gang).short : '';
    j.npcs.unshift({ id: e.id, name: e.name + (set ? ` (${set})` : ''), ch: A.ch.map(jName).join(', '), until: Date.now() + jDays(A.ch) * JDAY }); j.npcs.length = Math.min(j.npcs.length, 12);
    if (A.scene) scBooked(e, A);
    scMarkJailed(e); hKill(e); JL.npc = JL.npc.filter(q => q !== e);
    return e.name + (set ? ` (${set})` : '');
  }
  function scFlush() {
    const names = [];
    for (const e of JL.npc.slice()) if (e.jl && e.jl.scene && !e.gone) { const n = scBookNow(e); if (n) names.push(n); }
    if (SC.sc) scFinish(SC.sc, true);
    return names;
  }
  // when you get booked, everybody from the scene is booked with you (look for them in the dayroom)
  const _scBook = jBook;
  jBook = function () {
    let names = []; try { names = scFlush(); } catch (er) { console.warn('scenes: ' + er.message); }
    const r = _scBook.apply(this, arguments);
    if (names.length) setTimeout(() => toast(`Booked with you from the shooting: ${names.slice(0, 5).join(', ')}${names.length > 5 ? ` +${names.length - 5}` : ''}.`, ''), 2600);
    return r;
  };
  function scFinish(sc, quiet) {
    if (sc.done) return; sc.done = true; if (SC.sc === sc) SC.sc = null;
    const n = sc.booked.length;
    if (n) {
      const who = sc.booked.slice(0, 4).map(b => b.name + (b.set ? ` (${b.set})` : '')).join(', ');
      _scNews(`FWPD arrested ${n} at the shooting on ${sc.street}: ${who}${n > 4 ? ` and ${n - 4} more` : ''}.`, quiet ? null : sc.x, sc.z);
      // a corner that lost its people to the police stays empty and hot for a while
      const byBlk = new Map(); for (const b of sc.booked) { const blk = b.e.blk; if (blk) byBlk.set(blk, (byBlk.get(blk) || 0) + 1); }
      for (const [blk, k] of byBlk) if (k >= 2) { blk.down = Math.max(blk.down || 0, hNow() + 300000); blk.recruitAt = Date.now() + 300000; }
    }
    // one unit sits on the scene with its lights going for a bit
    const last = [...sc.units].filter(u => !u.gone && u.mode === 'patrol' && scD(u, sc) < 120).sort((a, b) => scD(a, sc) - scD(b, sc))[0];
    if (last && !quiet) { last.mode = 'perim'; last.perimT = 45; last.lights = true; last.siren = false; }
    for (const u of sc.units) if (!u.gone && (u.mode === 'scx' || u.mode === 'scar')) scFree(u);
    for (const T of SC.tapes) if (T.key === 'L' + sc.inc.id) T.life = Math.min(T.life, 150);
  }
  function scSceneStep(sc, dt) {
    sc.t += dt;
    for (const e of sc.cars) if (e.scStop && !e.gone) scCarStop(e, dt);
    // a held suspect whose unit got pulled away: back in line
    for (const e of sc.sus) if (e.jl && e.jl.u && e.jl.u.gone) e.jl.u = null;
    // the one that ran before anybody got to them keeps going
    for (const e of sc.sus) if (!e.gone && !e.down && e.jl && e.jl.run && !e.jl.u) { const l = Math.hypot(e.x - sc.x, e.z - sc.z) || 1; hFootMove(e, e.x + (e.x - sc.x) / l * 4, e.z + (e.z - sc.z) / l * 4, dt, true); e.mode = 'flee'; if (l > 160) { e.jl = null; JL.npc = JL.npc.filter(q => q !== e); hKill(e); _scNews(`${e.name} got away from the police on ${sc.street}.`, null, null); } }
    if ((SC.tick & 7) === 0) scAssign(sc);
    const left = sc.sus.filter(e => !e.gone && !e.down && e.jl && e.jl.scene).length + sc.cars.filter(e => !e.gone && !e.down && (e.scStop || [...sc.units].some(u => u.scE === e && u.mode === 'scar' && !u.gone))).length;
    const [mx, mz] = copMe();
    if (!left || sc.t > 300) { if (left) for (const e of sc.sus) if (e.jl && e.jl.scene && !e.gone) scBookNow(e); scFinish(sc); return; }
    // you drove off and left them to it: they finish the paperwork without you watching
    if (Math.hypot(mx - sc.x, mz - sc.z) > 700) { for (const e of sc.sus) if (e.jl && e.jl.scene && !e.gone) scBookNow(e); scFinish(sc, true); }
  }

  // ---------- you, when you were part of it ----------
  function scOrder(inc) {
    if (SC.order || jBusy()) return;
    const [mx, mz] = copMe();
    SC.order = { t: 0, x: mx, z: mz, inc };
    toast('👮 "YOU! GET ON THE GROUND! HANDS WHERE I CAN SEE THEM!" Get down, or run.', 'bad'); copWhoop();
    scDownBtn(true);
  }
  function scCharge() {
    jCharge('deadly'); jCharge('disch');
    const i = SC.order && SC.order.inc; if (i && i.meDrop) jCharge('murder');
    const A = S.arms3d; if (A && A.guns && A.guns.length && !(S.ltc)) jCharge('unl_carry');
  }
  function scOrderStep(dt) {
    const o = SC.order; if (!o) return;
    o.t += dt;
    if (jBusy() || inside || !driving) { SC.order = null; scDownBtn(false); return; }
    if (COP.phase === 'chase') { SC.order = null; scDownBtn(false); return; }
    const [mx, mz] = copMe(), moved = Math.hypot(mx - o.x, mz - o.z), sp = foot.on ? 0 : Math.hypot(TIRE.vx, TIRE.vz);
    if (moved > 14 || sp > 7) { SC.order = null; scDownBtn(false); scCharge(); jCharge(foot.on ? 'evade' : 'evade_veh'); copHeat(2); copChase('Shooter fled the crime scene.'); return; }
    if (o.give || (o.t > 6 && !gunsOut() && sp < 1)) {
      SC.order = null; scDownBtn(false); scCharge(); COP.chaseT = 0;
      if (COP.phase === 'search') copEnd('');
      if (!jlArrest('scene')) { toast('The officers have their hands full. Stay put.', ''); }
      return;
    }
    if (o.t > 6.5 && gunsOut()) { SC.order = null; scDownBtn(false); scCharge(); copHeat(1); copChase('Armed shooter refused to get down.'); }
  }
  function scDownBtn(on) {
    let b = document.getElementById('scdown');
    if (!b) { b = document.createElement('button'); b.id = 'scdown'; b.innerHTML = '🙌 Get down'; b.onclick = () => { const o = SC.order; if (!o) return; if (!foot.on && Math.hypot(TIRE.vx, TIRE.vz) > 2.5) { toast('Stop the car first.', 'bad'); return; } try { const G = window.__guns; if (G && G.GUN && G.GUN.want) G.gunToggle(); } catch (e) {} o.give = true; }; document.body.append(b); }
    b.hidden = !on;
  }
  // detectives: cameras, casings, somebody who talks
  function scInvStep() {
    const now = cNow();
    for (const v of SC.inv.slice()) {
      if (now < v.at) continue; SC.inv = SC.inv.filter(o => o !== v);
      if (jBusy()) continue;
      const i = v.inc, p = clamp(0.22 + 0.04 * Math.min(10, i.me) + (i.meDrop ? 0.35 : 0) + (i.drops ? 0.1 : 0), 0, 0.9);
      if (scR() < p) {
        const j = jS(), ch = [...new Set([...(j.warrant ? j.warrant.ch : []), 'deadly', 'disch', ...(i.meDrop ? ['murder'] : [])])];
        j.warrant = { ch, at: Date.now(), car: S.car ? S.car.id : '' }; save();
        toast(`🕵️ Detectives pulled doorbell cams from the shooting on ${v.street}. FWPD has a warrant out on you: ${jName(ch.includes('murder') ? 'murder' : 'deadly')}${ch.length > 1 ? ` +${ch.length - 1}` : ''}.`, 'bad');
      } else toast(`🕵️ Detectives canvassed ${v.street}. Nobody's talking. For now.`, 'good');
    }
  }

  // ---------- the sets: lookouts, payback, new faces on an empty corner ----------
  function scLookouts() {
    const [mx, mz] = copMe(), now = cNow(), all = [...COP.units, ...CNET.rem.values()].filter(u => !u.gone);
    for (const b of HOOD.blocks) {
      if (!b.crew.length || Math.hypot(b.corner.x - mx, b.corner.z - mz) > 220 || now - (SC.look[b.id] || -99) < 50) continue;
      const up = b.crew.filter(m => !m.gone && !m.down && !m.jl && !m.war && (!m.own || m.own === 'me')); if (!up.length) continue;
      const lit = all.find(u => u.lights && Math.hypot(u.x - b.corner.x, u.z - b.corner.z) < 65), roll = all.find(u => !u.lights && u.mode === 'patrol' && Math.hypot(u.x - b.corner.x, u.z - b.corner.z) < 32);
      if (!lit && !roll) continue;
      SC.look[b.id] = now;
      hSay(up[0], hPick(lit ? SCL.twelve : SCL.patrol), Math.hypot(b.corner.x - mx, b.corner.z - mz) < 40);
      if (lit) for (const m of up) if (m.mode === 'aim' || m.mode === 'fight') { m.mode = 'idle'; m.gd = 0; }
    }
  }
  // a set that got hit spins back on whoever did it, a few minutes later
  const _scWEnd = wEnd;
  wEnd = function (ev, why) {
    const was = ev && ev.done; const r = _scWEnd.apply(this, arguments);
    try {
      if (!was && ev && !ev.quiet && why !== 'far' && HOOD_SETS[ev.def] && HOOD_SETS[ev.atk]) {
        const dd = ev.b.crew.filter(m => m.down).length - ev.d0, ad = ev.ents.filter(e => e.down).length;
        if (dd > 0 || ev.scene) SC.pay.push({ atk: ev.def, def: ev.atk, at: Date.now() + (150 + scR() * 200) * 1000, from: ev.b.name, until: Date.now() + 1500000 });
        else if (ad > 0) SC.pay.push({ atk: ev.atk, def: ev.def, at: Date.now() + (200 + scR() * 200) * 1000, from: ev.b.name, until: Date.now() + 1500000 });
        if (SC.pay.length > 4) SC.pay.shift();
      }
    } catch (er) {}
    return r;
  };
  function scPayback() {
    if (WAR.ev || !SC.pay.length || !wS().on) return;
    const now = Date.now(); SC.pay = SC.pay.filter(p => p.until > now);
    const p = SC.pay.find(q => q.at <= now); if (!p) return;
    const G = window.__guns; if ((G && G.pv && G.pv.PV.down > 0) || inside || ROLL.on || HOOD.hold || SC.sc) return;
    const [mx, mz] = copMe();
    const peers = hOn() ? [...NET.peers.values()] : [];
    const b = HOOD.blocks.filter(b => hOwner(b) === p.def && b.crew.filter(m => !m.down && !m.gone && !m.jl).length >= 2 && hNow() >= b.down && Math.hypot(b.corner.x - mx, b.corner.z - mz) > 28 && Math.hypot(b.corner.x - mx, b.corner.z - mz) < 185 && b.crew.every(m => (!m.own || m.own === 'me') && m.mode === 'idle' && !m.war) && !peers.some(q => q.id < NET.id && Math.hypot(q.x - b.corner.x, q.z - b.corner.z) < 260))[0];
    if (!b) return;
    const ev = wStart(mx, mz, { b, atk: p.atk, kind: wHeatOf(p.atk, p.def) >= 50 || scR() < 0.5 ? 'slide' : 'walk' });
    if (!ev) return;
    SC.pay = SC.pay.filter(q => q !== p); ev.payback = true;
    _scNews(`${wShort(p.atk)} spun back on ${wShort(p.def)} at ${b.name} for what happened at ${p.from}.`, b.corner.x, b.corner.z);
  }
  // after the police clear a corner: once it cools off the set puts new people out there
  function scRecruit() {
    const [mx, mz] = copMe(), now = Date.now();
    for (const b of HOOD.blocks) {
      if (!b.crew.length || hNow() < b.down || (b.recruitAt && now < b.recruitAt) || Math.hypot(b.corner.x - mx, b.corner.z - mz) > 260) continue;
      const o = hOwner(b); if (!o || b.crew[0].gang !== o || b.crew.some(m => m.war || m.jl || (m.own && m.own !== 'me'))) continue;
      const n = 3 + (b.h % 2); if (b.crew.length >= n) continue;
      const have = new Set(b.crew.map(m => m.id)), k = [...Array(n).keys()].find(k => !have.has(`m:${b.id}:${k}`) && !hGoneDead(`m:${b.id}:${k}`) && !HOOD.byEnt.has(`m:${b.id}:${k}`));
      if (k == null) continue;
      const B = hBase(o, o === 'own' ? 0 : k % 3); if (!B) continue;
      const a = k / n * Math.PI * 2 + b.h, r = 1.6 + (k % 2) * 1.4, hx = b.corner.x + Math.cos(a) * r, hz = b.corner.z + Math.sin(a) * r, sp = wStreetSpot(b, 40) || [hx + 20, hz];
      const e = hEnt({ id: `m:${b.id}:${k}`, kind: 'member', gang: o, blk: b, name: H_NICKS[(b.h + k * 7 + 13) % H_NICKS.length], x: sp[0], z: sp[1], hx, hz, yaw: 0, gunId: ['g19', 'g20', 'arp'][(b.h + k) % 2] });
      hDress(e, hClone(B)); hLabel(e); b.crew.push(e); b.recruitAt = now + 90000;
      if (Math.hypot(b.corner.x - mx, b.corner.z - mz) < 120) hSay(e, hPick(['they put me on the block now', 'new day, same corner', 'yall heard what happened? its us now', 'big homie said hold it down']));
      return;
    }
  }

  // ---------- every frame (riding on the cops) ----------
  const _scThink = copThink;
  copThink = function (u, dt, mx, mz, d) {
    if (u.mode === 'scx') { scDrive(u, dt); return; }
    if (u.mode === 'scar') { scCarChase(u, dt); return; }
    if (u.mode === 'perim') { u.sp *= Math.pow(0.05, dt); u.lights = true; u.perimT -= dt; if (u.perimT <= 0) { u.mode = 'patrol'; u.lights = false; copJoin(u); } return; }
    return _scThink.apply(this, arguments);
  };
  // hands up / cuffs for every held or arrested NPC (yours and the ones other players run); runners run
  jNpcPoses = function () {
    if (!HOOD.ready) return;
    for (const e of HOOD.ents) {
      if (e.gone || e.down || !e.view || !e.view.P || !e.g.visible || e.inCar) continue;
      const A = e.jl; if (A && (A.run || A.ph === 'fstop')) continue;
      const m = A ? (A.ph === 'stop' || A.ph === 'walk' ? 'hands' : 'cuffed') : e.mode;
      if (m === 'hands') { jlPose(e.view.P, 'hands', 1); jlCuffOn(e.view.P, false); e.gd = 0; } else if (m === 'cuffed') { jlPose(e.view.P, 'cuff', 1); jlCuffOn(e.view.P, true); e.gd = 0; }
    }
  };
  function scStep(dt) {
    if (!S || !HOOD.ready) return;
    SC.tick++;
    const now = cNow();
    // a lit unit gets to where the shooting was: that's a scene
    if (!SC.sc && (SC.tick & 3) === 0) {
      for (const inc of SC.inc) {
        if (inc.locked || now - inc.last > 160) continue;
        const u = COP.units.find(u => !u.gone && u.lights && !SC_MODES.test(u.mode) && Math.hypot(u.x - inc.x, u.z - inc.z) < 100);
        if (!u) continue;
        if (COP.phase === 'chase' && !scSuspects(inc, null).length && !(WAR.ev && Math.hypot(WAR.ev.x - inc.x, WAR.ev.z - inc.z) < 170)) continue;
        if (scLock(inc, u)) break;
      }
    }
    if (SC.sc) scSceneStep(SC.sc, dt);
    scOrderStep(dt);
    if ((SC.tick & 15) === 0) { scInvStep(); scLookouts(); scTapeStep(dt * 16); }
    SC.payT -= dt; if (SC.payT <= 0) { SC.payT = 6; scPayback(); }
    SC.recT -= dt; if (SC.recT <= 0) { SC.recT = 30; if (!SC.sc) scRecruit(); }
  }
  const _scStepJ = jStep;
  jStep = function (dt) { _scStepJ.apply(this, arguments); try { scStep(dt); } catch (er) { if (!SC.err) { SC.err = 1; console.warn('scenes: ' + er.message, er.stack); } } };

  // ---------- online ----------
  window.__scJailed = id => { const t = SC.jailed[id]; return !!t && hNow() - t < 480000; };
  NET_HOOK.state.push(() => { const o = {}; if (SC.out.scn.length) o.scn = SC.out.scn.splice(0, 2); if (SC.out.sjl.length) o.sjl = SC.out.sjl.splice(0, 12); return o; });
  NET_HOOK.urgent.push(() => SC.out.scn.length > 0 || SC.out.sjl.length > 0);
  NET_HOOK.recv.push((p, m) => {
    if (m.k !== 's' || !S || !HOOD.ready) return;
    if (Array.isArray(m.sjl)) for (const a of m.sjl.slice(0, 12)) {
      if (!Array.isArray(a) || typeof a[0] !== 'string' || a[0].length > 48 || !/^[mr]:/.test(a[0]) || !hNum(a[1], 1e12, 1e14)) continue;
      SC.jailed[a[0]] = a[1]; const e = HOOD.byEnt.get(a[0]); if (e && e.own !== 'me' && !e.gone) hKill(e);
    }
    if (Array.isArray(m.scn)) for (const a of m.scn.slice(0, 2)) {
      if (!Array.isArray(a) || !hNum(a[0], -3e5, 3e5) || !hNum(a[1], -3e5, 3e5)) continue;
      const x = a[0] / 10, z = a[1] / 10, marks = Array.isArray(a[2]) ? a[2].slice(0, 10).filter(q => Array.isArray(q) && hNum(q[0], -3e5, 3e5) && hNum(q[1], -3e5, 3e5)).map(q => [q[0] / 10, q[1] / 10]) : [];
      const [mx, mz] = copMe(); if (Math.hypot(x - mx, z - mz) > 480) continue;
      scTape(x, z, marks, 'R' + p.id + ':' + a[0] + ':' + a[1]);
      // you were shooting there too: the officers on scene are talking to you as well
      if (scMeShot(x, z, 160, 160) && Math.hypot(x - mx, z - mz) < 170 && !jBusy() && !inside && COP.phase !== 'chase') { const i = scIncAt(x, z, 170) || { me: 1, meDrop: 0, x, z }; i.locked = true; scOrder(i); }
    }
  });
  {
    const st = document.createElement('style');
    st.textContent = `#scdown{position:fixed;right:calc(env(safe-area-inset-right,0px) + 14px);bottom:calc(env(safe-area-inset-bottom,0px) + 150px);z-index:31;font:800 16px var(--body);border-radius:12px;border:2px solid #fff;padding:12px 16px;background:#d23a2a;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.45);cursor:pointer;animation:scp .5s infinite alternate}#scdown[hidden]{display:none}@keyframes scp{to{transform:scale(1.07)}}body.phoning #scdown,body.indoors #scdown{display:none}`;
    document.head.append(st);
  }
  window.__scenes = { SC, scShot, scLock, scAssign, scSuspects, scOrder, scStep, scFlush, scBookNow, scTape, scPayback, scRecruit, scLookouts, scInvStep, scFinish, scMeShot, scDownBtn, wEnd: (...a) => wEnd(...a) };
  // ==== shooting scenes (end) ====
