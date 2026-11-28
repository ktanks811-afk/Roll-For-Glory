  // ==== city calls (begin) ====
  // Kimari 2026-11-28: "make it where it's always active crime and the police will be busy sometimes and will be late to
  // calls at all times ... so as players drive they'll see police doing other calls".
  // The city runs its own crime around the clock: traffic stops, crashes, store robberies, fights, shootings and
  // disturbances, everywhere in town, whether you're there or not. The city is cut into beats (900 m squares), and each
  // beat has only four officers on the clock. Every call ties up one to three of them for a few minutes (driving there,
  // working the scene, clearing), so most of the time most of them are busy, calls stack up and get answered late (a
  // crash can sit there with nobody on it for minutes, then a unit rolls up lights and siren). Your own 911 calls go in
  // the same line: when the beat is tied up, units get to you late.
  // Nothing about it is random per screen: every call (where, what, when, how long, which unit) comes out of a hash of the
  // beat and the server's shared clock, so everybody on the server sees the same crash, the same unit pulling up to it,
  // the same suspect sitting cuffed on the curb, with no network traffic at all. A scene cop who sees you do something
  // gets taken off the scene to deal with you, and that unit is handed over online like any other cop car.
  const CC = { beats: new Map(), live: new Map(), units: [], bases: [], baseT: 0, det: null, tick: 0, ann: new Set(), annT: -99, toldT: -99, res: [], busy: new Map(), forced: [], err: 0, backT: -99, off: false };
  const CC_BEAT = 900, CC_SLOT = 36, CC_SH = 900, CC_OFF = 4, CC_P = 0.42, CC_MAXW = 300;
  const CC_KINDS = {
    stop: { w: 24, units: 1, dur: [70, 150], travel: [0, 0], name: 'a traffic stop' },
    crash: { w: 18, units: 1, dur: [130, 230], travel: [40, 95], name: 'a crash' },
    rob: { w: 14, units: 2, dur: [120, 210], travel: [35, 85], name: 'a robbery' },
    fight: { w: 16, units: 2, dur: [100, 180], travel: [35, 85], name: 'a fight' },
    shoot: { w: 10, units: 3, dur: [210, 320], travel: [30, 70], name: 'shots fired, one down' },
    dist: { w: 18, units: 1, dur: [90, 170], travel: [40, 95], name: 'a disturbance' },
  };
  const CC_KL = Object.keys(CC_KINDS), CC_WT = CC_KL.reduce((s, k) => s + CC_KINDS[k].w, 0);
  const CC_CARS = ['chevrolet_caprice_classic_box_chevy_1986', 'ford_f_150_regular_cab_2021', 'chevrolet_camaro_ss_2016', 'chevrolet_tahoe_2021', 'dodge_charger_scat_pack_2015', 'ford_mustang_gt_2019', 'chevrolet_nova_1972', 'kia_stinger_gt2_2022'];
  const CC_COLS = ['#1c1d21', '#e9e9e6', '#8b1018', '#23395d', '#5b5f66', '#2f4a2f', '#c9a227', '#6b3fa0', '#b9bcc1', '#7a4a22'];
  const ccH = (...a) => { let h = 2166136261; for (const v of a) { h ^= (v | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2); h = Math.imul(h, 16777619) >>> 0; } return h; };
  const ccR = (h, k) => (ccH(h, k) % 100000) / 100000;   // the same 0..1 on every screen
  const ccT = () => hNow() / 1000;                          // the server's clock
  const ccCap = () => phone ? 2 : 4, ccRV = () => phone ? 300 : 420;
  const ccSolid = (x, z, pad = 0.6) => solids.at(x, z).some(b => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad);

  // ---------- beats: the corners and the stores in each 900 m square ----------
  function ccBeat(i, j) {
    const k = i + ',' + j; let B = CC.beats.get(k); if (B) return B;
    const g = gpsGraph(), x0 = i * CC_BEAT, z0 = j * CC_BEAT, nodes = [];
    for (let a = Math.floor(x0 / 100); a < Math.floor((x0 + CC_BEAT) / 100); a++) for (let b = Math.floor(z0 / 100); b < Math.floor((z0 + CC_BEAT) / 100); b++) {
      const l = HOOD.nodeGrid.get(a + ',' + b); if (!l) continue;
      for (const n of l) if (g.adj[n].length >= 2 && g.nx[n] >= x0 && g.nx[n] < x0 + CC_BEAT && g.nz[n] >= z0 && g.nz[n] < z0 + CC_BEAT) nodes.push(n);
    }
    nodes.sort((p, q) => p - q);
    const cx = x0 + CC_BEAT / 2, cz = z0 + CC_BEAT / 2, town = inTown(cx, cz) || nodes.length > 60;
    const stores = DATA.P.filter(p => /^(gas|food|bank|pawn|clothing|dispensary|dealer|plug)$/.test(p.type) && p.x >= x0 && p.x < x0 + CC_BEAT && p.z >= z0 && p.z < z0 + CC_BEAT).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    B = { k, i, j, x0, z0, cx, cz, nodes, stores, town, rate: nodes.length < 6 ? 0 : town ? 1 : 0.3, sh: new Map() };
    CC.beats.set(k, B); return B;
  }
  const ccBeatAt = (x, z) => ccBeat(Math.floor(x / CC_BEAT), Math.floor(z / CC_BEAT));
  // the call (if any) that comes in during one 36 s slot of one beat
  function ccGen(B, k) {
    const h = ccH(B.i, B.j, k, 4111);
    if (!B.rate || ccR(h, 1) >= CC_P * B.rate) return null;
    let r = ccR(h, 2) * CC_WT, kind = CC_KL[0]; for (const q of CC_KL) { r -= CC_KINDS[q].w; if (r < 0) { kind = q; break; } }
    if (kind === 'rob' && !B.stores.length) kind = 'fight';
    const K = CC_KINDS[kind], lr = (a, i) => a[0] + (a[1] - a[0]) * ccR(h, i);
    return { id: `${B.i}.${B.j}.${k}`, B, h, kind, K, start: k * CC_SLOT + ccR(h, 3) * CC_SLOT * 0.9, dur: lr(K.dur, 4), travel: lr(K.travel, 5) * (B.town ? 1 : 1.8), units: K.units, node: B.nodes[Math.floor(ccR(h, 6) * B.nodes.length)] };
  }
  // dispatch: calls in the order they came in, each takes the officers that free up first. A traffic stop only happens
  // when somebody is free to make it. A call nobody gets to in time is dropped (the caller gave up, the drivers left).
  function ccRun(B, t0, t1, cut) {
    const free = new Array(CC_OFF).fill(t0), list = [];
    for (let k = Math.floor(t0 / CC_SLOT); k * CC_SLOT < t1; k++) {
      const c = ccGen(B, k); if (!c || c.start < t0 || c.start >= t1 || (cut != null && c.start > cut)) continue;
      free.sort((a, b) => a - b);
      const ta = Math.max(c.start, free[c.units - 1]);
      if (c.kind === 'stop' && ta > c.start + 1) continue;
      const wm = c.kind === 'shoot' ? 420 : CC_MAXW;
      if (ta - c.start > wm) { c.drop = true; c.assign = c.arrive = c.end = c.start + wm; list.push(c); continue; }
      c.assign = ta; c.arrive = ta + c.travel; c.end = c.arrive + c.dur;
      for (let u = 0; u < c.units; u++) free[u] = c.end + 25;
      list.push(c);
    }
    return { list, free };
  }
  // the calls of one 15-minute shift: always worked out from the start of the shift before, so the answer never changes
  function ccShift(B, s) {
    let r = B.sh.get(s); if (r) return r;
    r = ccRun(B, (s - 1) * CC_SH, (s + 1) * CC_SH).list.filter(c => c.start >= s * CC_SH);
    B.sh.set(s, r); while (B.sh.size > 4) B.sh.delete(B.sh.keys().next().value);
    return r;
  }
  function ccPhase(c, T) {
    if (T < c.start) return null;
    if (c.drop) return T < c.end ? 'pend' : null;
    if (T < c.assign) return 'pend';
    if (T < c.arrive) return 'enr';
    if (T < c.end) return 'on';
    if (T < c.end + 32) return 'leave';
    return null;
  }
  // how tied up a beat is right now (0..1), and when officers free up, with your own calls holding officers too
  function ccFree(B, T) {
    const s = Math.floor(T / CC_SH), fr = ccRun(B, (s - 1) * CC_SH, T + 1, T).free;
    CC.res = CC.res.filter(r => r.until > T);
    for (const r of CC.res) if (r.b === B.k) { fr.sort((a, b) => a - b); fr[0] = Math.max(fr[0], r.until); }
    return fr.sort((a, b) => a - b);
  }
  function ccBusy(x, z) {
    if (!HOOD.ready) return 0;
    const B = ccBeatAt(x, z); if (!B.rate) return 0;
    const T = ccT(), o = CC.busy.get(B.k); if (o && T - o.t < 5) return o.v;
    const v = ccFree(B, T).filter(f => f > T).length / CC_OFF; CC.busy.set(B.k, { t: T, v }); return v;
  }
  const ccCut = (x, z) => ccBusy(x, z) > 0.99 ? 1 : 0;
  // your 911 call: how long until somebody is free, then the drive over
  function ccWait(x, z, units) {
    if (!HOOD.ready) return { wait: 0, travel: 0 };
    const B = ccBeatAt(x, z), T = ccT(), fr = B.rate ? ccFree(B, T) : new Array(CC_OFF).fill(T);
    const u = clamp(units || 1, 1, CC_OFF), wait = clamp(fr[u - 1] - T, 0, 180), travel = (B.town ? 25 : 55) + copRand() * (B.town ? 35 : 60);
    if (B.rate) CC.res.push({ b: B.k, until: T + wait + travel + 120 });
    return { wait, travel, held: fr.filter(f => f > T).length };
  }

  // ---------- where a call happens: a road off its corner, the store, the curb ----------
  function ccEdge(c) {
    const g = gpsGraph(), n = c.node, adj = g.adj[n].map(a => a[0]).sort((a, b) => a - b), st = Math.floor(ccR(c.h, 7) * adj.length);
    let pick = null;
    for (let q = 0; q < adj.length; q++) { const b = adj[(st + q) % adj.length], L = Math.hypot(g.nx[b] - g.nx[n], g.nz[b] - g.nz[n]); if (L > 34) { pick = [b, L]; break; } }
    if (!pick) { const b = adj[st]; pick = [b, Math.max(1, Math.hypot(g.nx[b] - g.nx[n], g.nz[b] - g.nz[n]))]; }
    const [b, L] = pick, dx = (g.nx[b] - g.nx[n]) / L, dz = (g.nz[b] - g.nz[n]) / L;
    return { n, b, L, ax: g.nx[n], az: g.nz[n], dx, dz, rx: -dz, rz: dx, yaw: Math.atan2(-dx, -dz) };
  }
  const ccAt = (E, along, side) => [E.ax + E.dx * along + E.rx * side, E.az + E.dz * along + E.rz * side];
  // a car spot at the curb: as far over as it fits
  function ccCurb(E, along, sides) { for (const s of sides) { const p = ccAt(E, along, s); if (!ccSolid(p[0], p[1], 1.2)) return p; } return ccAt(E, along, sides[sides.length - 1]); }
  function ccWalkSpot(x, z, ox, oz) { for (let k = 0; k < 6; k++) { const px = x - ox * k * 0.8, pz = z - oz * k * 0.8; if (!ccSolid(px, pz, 0.4)) return [px, pz]; } return [x, z]; }
  // half the width of the street here (to the curb), from the map's own street pieces
  function ccHW(x, z) {
    let best = null, bd = 1e9;
    for (const e of streets.at(x, z)) { const horiz = Math.abs(e.bz - e.az) < 0.01, d = horiz ? (x >= Math.min(e.ax, e.bx) - 2 && x <= Math.max(e.ax, e.bx) + 2 ? Math.abs(z - e.az) : 1e9) : (z >= Math.min(e.az, e.bz) - 2 && z <= Math.max(e.az, e.bz) + 2 ? Math.abs(x - e.ax) : 1e9); if (d < bd && e.w) { bd = d; best = e; } }
    return best && bd < best.w ? clamp(best.w / 2, 4, 14) : 6.5;
  }
  function ccPlace(c) {
    if (c.pl) return c.pl;
    const E = ccEdge(c), h = c.h, mid = Math.max(10, E.L * (0.3 + ccR(h, 8) * 0.3)), P = { E, units: [], cars: [], spots: {} };
    const hw = ccHW(...ccAt(E, mid, 0)), CU = [hw - 1.3, hw - 1.8, hw - 2.4], SW = hw + 2.2; P.hw = hw;
    const car = (x, z, yaw, k) => ({ x, z, yaw, id: CC_CARS[(ccH(h, 20 + k) % (phone ? 4 : CC_CARS.length))], col: CC_COLS[ccH(h, 30 + k) % CC_COLS.length] });
    const unit = (x, z, yaw, k) => ({ x, z, yaw, kind: k === 0 ? (ccR(h, 40) < 0.62 ? 'charger' : 'tahoe') : ccR(h, 40 + k) < 0.5 ? 'charger' : 'tahoe', num: 100 + ccH(h, 50 + k) % 800 });
    const side = s => [E.rx * s, E.rz * s];
    if (c.kind === 'stop') {
      const a = ccCurb(E, mid, CU), u = ccCurb(E, mid - 8.5, CU);
      P.cars.push(car(a[0], a[1], E.yaw, 0)); P.units.push(unit(u[0], u[1], E.yaw, 0));
      P.spots.win = [a[0] - Math.cos(E.yaw) * 1.6 - Math.sin(E.yaw) * 0.3, a[1] + Math.sin(E.yaw) * 1.6 - Math.cos(E.yaw) * 0.3];
    } else if (c.kind === 'crash') {
      // two cars locked up in the intersection, one crossed into the other
      const x = E.ax + E.dx * 6, z = E.az + E.dz * 6;
      P.cars.push(car(x + E.rx * 1.2, z + E.rz * 1.2, E.yaw + 0.35, 0));
      P.cars.push(car(x - E.dx * 4.4 - E.rx * 1.4, z - E.dz * 4.4 - E.rz * 1.4, E.yaw + Math.PI / 2 + 0.2, 1));
      const u = ccCurb(E, 26, [hw - 2.2, hw - 2.8, hw - 3.4]); P.units.push(unit(u[0], u[1], E.yaw + Math.PI + 0.25, 0));
      P.spots.d1 = ccWalkSpot(x + E.rx * (hw - 0.5), z + E.rz * (hw - 0.5), ...side(1)); P.spots.d2 = ccWalkSpot(x + E.rx * (hw - 0.5) + E.dx * 2.2, z + E.rz * (hw - 0.5) + E.dz * 2.2, ...side(1));
      P.spots.cones = [ccAt(E, 13, 0.5), ccAt(E, 15, -1.5), ccAt(E, 17, -3.5), ccAt(E, -6, 2.5)];
    } else if (c.kind === 'rob') {
      const p = c.B.stores[Math.floor(ccR(h, 9) * c.B.stores.length)], [ox, oz] = outDir(p), tx = -oz, tz = ox;
      const fx = p.x + ox * 9, fz = p.z + oz * 9, fy = Math.atan2(ox, oz) + Math.PI / 2;
      P.store = p;
      for (let k = 0; k < 2; k++) { let x = fx + tx * (k ? 5 : -5) + ox * 3, z = fz + tz * (k ? 5 : -5) + oz * 3; if (ccSolid(x, z, 1.2)) { x += ox * 3; z += oz * 3; } P.units.push(unit(x, z, fy + (k ? Math.PI : 0) + (k ? 0.12 : -0.12), k)); }
      P.spots.clerk = ccWalkSpot(p.x + ox * 5.5, p.z + oz * 5.5, ox, oz);
      P.spots.perp = ccWalkSpot(fx + tx * 5 + ox * 0.6 - tx * 2.8, fz + tz * 5 + oz * 0.6 - tz * 2.8, ox, oz);
      P.spots.face = Math.atan2(ox, oz);
    } else if (c.kind === 'fight') {
      const s = ccWalkSpot(...ccAt(E, mid, SW + 0.8), ...side(1)); P.spots.f = s;
      const u0 = ccCurb(E, mid - 7, CU), u1 = ccCurb(E, mid + 7, CU);
      P.units.push(unit(u0[0], u0[1], E.yaw, 0)); P.units.push(unit(u1[0], u1[1], E.yaw + 0.1, 1));
      P.spots.curb = ccWalkSpot(...ccAt(E, mid, hw + 0.45), ...side(1));
    } else if (c.kind === 'shoot') {
      const s = ccWalkSpot(...ccAt(E, mid, SW + 1.5), ...side(1)); P.spots.v = s;
      const u0 = ccCurb(E, mid - 11, CU), u1 = ccCurb(E, mid + 11, CU), u2 = ccCurb(E, mid + 2, CU.map(v => -v));
      P.units.push(unit(u0[0], u0[1], E.yaw + 0.15, 0)); P.units.push(unit(u1[0], u1[1], E.yaw + Math.PI - 0.2, 1)); P.units.push(unit(u2[0], u2[1], E.yaw + Math.PI, 2));
      P.marks = []; for (let k = 0; k < 4 + (h % 4); k++) { const a = ccR(h, 60 + k) * Math.PI * 2, r = 2 + ccR(h, 70 + k) * 7; P.marks.push([s[0] + Math.sin(a) * r, s[1] + Math.cos(a) * r]); }
    } else {
      // a disturbance at a house: the unit at the curb, the people out front of the door
      const u = ccCurb(E, mid, CU); P.units.push(unit(u[0], u[1], E.yaw, 0));
      let door = null; for (let r = hw + 3; r < hw + 22 && !door; r += 1.5) { const q = ccAt(E, mid, r); if (ccSolid(q[0], q[1], 0)) door = ccAt(E, mid, r - 1.6); }
      P.spots.door = door || ccAt(E, mid, hw + 5);
    }
    // the way the first unit comes in: from a corner a drive away, on the roads
    c.pl = P; return P;
  }
  function ccRoute(c, k) {
    const P = c.pl, key = 'r' + k; if (P[key] !== undefined) return P[key];
    const g = gpsGraph(), D = Math.max(120, c.travel * 13), a = ccR(c.h, 80 + k) * Math.PI * 2;
    const s = hNearestNode(g.nx[c.node] + Math.sin(a) * D, g.nz[c.node] + Math.cos(a) * D);
    const path = s >= 0 && s !== c.node ? hRoute(s, c.node) : null, U = P.units[k];
    if (!path) return (P[key] = null);
    const pts = [[g.nx[s], g.nz[s]], ...path.map(n => [g.nx[n], g.nz[n]]), [U.x, U.z]];
    return (P[key] = ccLine(pts, 1.8));
  }
  // and the way it leaves: down the street and on to the next thing
  function ccLeave(c, k) {
    const P = c.pl, key = 'l' + k; if (P[key] !== undefined) return P[key];
    const g = gpsGraph(), E = P.E, U = P.units[k] || P.cars[0]; let a = E.n, b = E.b; const pts = [[U.x, U.z], [g.nx[b], g.nz[b]]];
    for (let q = 0; q < 4; q++) { const opts = g.adj[b].map(x => x[0]).filter(x => x !== a).sort((p, r) => p - r); if (!opts.length) break; const nb = opts[ccH(c.h, 90 + k * 7 + q) % opts.length]; a = b; b = nb; pts.push([g.nx[b], g.nz[b]]); }
    return (P[key] = ccLine(pts, 3.4));
  }
  // a path as a polyline with the lane offset baked in, measured
  function ccLine(pts, lane) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], dx = q[0] - o[0], dz = q[1] - o[1], l = Math.hypot(dx, dz) || 1;
      out.push(i === 0 || i === pts.length - 1 ? [p[0], p[1]] : [p[0] - dz / l * lane, p[1] + dx / l * lane]);
    }
    const cum = [0]; for (let i = 1; i < out.length; i++) cum.push(cum[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
    return { pts: out, cum, len: cum[cum.length - 1] };
  }
  function ccAlong(R, s) {
    s = clamp(s, 0, R.len); let i = 1; while (i < R.cum.length - 1 && R.cum[i] < s) i++;
    const a = R.pts[i - 1], b = R.pts[i], seg = (R.cum[i] - R.cum[i - 1]) || 1, f = (s - R.cum[i - 1]) / seg;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]))];
  }

  // ---------- people on a scene: officers, a detective, the folks involved ----------
  function ccOfficerBase() {
    if (!COP.officerBase) { try { COP.officerBase = hNameParts(PEOPLE.build(copOfficerLook(), 1)); } catch (e) { return null; } }
    return COP.officerBase;
  }
  function ccDetBase() {
    if (CC.det === null) return null; if (CC.det) return CC.det;
    try { let sd = 31337; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647; R(); CC.det = hNameParts(PEOPLE.build({ ...PEOPLE.randomLook(R, false), top: 'bomber_olive', bottom: 'cargo_black', shoes: 'boots_tactical', hat: 'no_hat', mask: 'no_mask', bag: 'no_bag', extras: ['glasses'], tats: [] }, 1)); } catch (e) { CC.det = null; }
    return CC.det;
  }
  // a handful of everyday people, the same handful on every screen, built one at a time so driving into a scene doesn't hitch
  function ccBase(k) {
    const i = k % 6; if (CC.bases[i]) return CC.bases[i];
    if (CC.bases[i] === null || frame - CC.baseT < 20) return null; CC.baseT = frame;
    try { let sd = 7001 + i * 977; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647; R(); CC.bases[i] = hNameParts(PEOPLE.build({ ...PEOPLE.randomLook(R, i % 3 === 1), mask: 'no_mask' }, 1)); } catch (e) { CC.bases[i] = null; }
    return CC.bases[i] || null;
  }
  // put somebody somewhere doing something; walking comes from how far they moved since the last frame
  function ccMan(L, role, base, x, z, yaw, act, t, dt) {
    let m = L.ppl[role];
    if (!m) { if (!base) return null; const P = hClone(base); P.wrap.rotation.order = 'YXZ'; scene.add(P.wrap); m = L.ppl[role] = { P, x, z, yaw, walk: 0, act: '' }; }
    const P = m.P, mv = Math.hypot(x - m.x, z - m.z), sp = dt > 0 ? mv / dt : 0;
    if (mv > 6) { m.x = x; m.z = z; }
    if (sp > 0.25 && act !== 'lie' && act !== 'sit') { m.walk += mv * Math.PI * 2 / (sp > 4 ? 3.6 : 1.6); animPerson(P, m.walk, 1, sp > 4 ? 1 : 0); if (act === 'cuff') { jlPose(P, 'cuff', 1); jlCuffOn(P, true); } }
    else {
      idlePerson(P, t + (role.length * 1.7));
      if (act === 'hands') jlPose(P, 'hands', 1);
      else if (act === 'cuff' || act === 'sit') { jlPose(P, 'cuff', 1, act === 'sit'); jlCuffOn(P, true); }
      else if (act === 'talk') { const w = Math.sin(t * 2.3 + role.length) * 0.5; P.arms[0].rotation.x = -0.5 + w * 0.5; P.fores[0].rotation.x = -0.9 + w * 0.4; P.arms[1].rotation.x = -0.2 - Math.max(0, -w) * 0.6; }
      else if (act === 'write') { P.arms[0].rotation.x = P.arms[1].rotation.x = -0.65; P.fores[0].rotation.x = P.fores[1].rotation.x = -1.1; P.arms[0].rotation.z = 0.25; P.arms[1].rotation.z = -0.25; if (P.head) P.head.rotation.x = 0.35; }
      else if (act === 'point') { P.arms[0].rotation.x = -1.45 + Math.sin(t * 3) * 0.08; P.fores[0].rotation.x = -0.1; }
      else if (act === 'fight') { const s = Math.sin(t * 7 + role.length), s2 = Math.sin(t * 7 + role.length + 2.4); P.arms[0].rotation.x = -1.1 - Math.max(0, s) * 0.6; P.arms[1].rotation.x = -1.1 - Math.max(0, s2) * 0.6; P.fores[0].rotation.x = P.fores[1].rotation.x = -1.3 + Math.max(0, s) * 0.7; if (P.upper) P.upper.rotation.y = s * 0.25; }
      else if (act === 'hip') { P.arms[0].rotation.z = 0.5; P.arms[1].rotation.z = -0.5; P.fores[0].rotation.x = P.fores[1].rotation.x = -1.4; }
    }
    m.x = x; m.z = z; m.yaw = yaw; m.act = act;
    // lying on the ground: tipped over backwards from the feet; sitting on the curb: dropped down onto it
    if (act === 'lie') { P.wrap.position.set(x, 0.14, z); P.wrap.rotation.set(-Math.PI / 2, yaw, 0); }
    else { P.wrap.position.set(x, act === 'sit' ? -0.42 * (P.root.scale.y || 1) : 0, z); P.wrap.rotation.set(0, yaw, 0); }
    P.wrap.visible = L.vis; return m;
  }
  function ccGone(L, role) { const m = L.ppl[role]; if (m) { scene.remove(m.P.wrap); delete L.ppl[role]; } }
  const ccFace = (ax, az, bx, bz) => Math.atan2(-(bx - ax), -(bz - az));
  const ccLerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

  // ---------- props: cones and flares at a crash, a sheet at a shooting ----------
  let CC_M = null;
  function ccMats() {
    if (CC_M) return CC_M;
    CC_M = { cone: new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.55 }), band: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }), flare: new THREE.MeshBasicMaterial({ color: 0xff3020, toneMapped: false }), sheet: new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.92 }), glass: new THREE.MeshStandardMaterial({ color: 0x9fb6c8, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.6 }),
      coneG: new THREE.ConeGeometry(0.2, 0.62, 12), bandG: new THREE.CylinderGeometry(0.115, 0.14, 0.09, 12), flareG: new THREE.CylinderGeometry(0.03, 0.03, 0.26, 6), sheetG: new THREE.BoxGeometry(0.72, 0.26, 1.85), glassG: new THREE.PlaneGeometry(0.1, 0.1) };
    return CC_M;
  }
  function ccCone(g, x, z) { const M = ccMats(), c = new THREE.Mesh(M.coneG, M.cone); c.position.set(x, 0.31, z); c.castShadow = true; g.add(c); const b = new THREE.Mesh(M.bandG, M.band); b.position.set(x, 0.36, z); g.add(b); }
  function ccFlare(g, x, z, a) { const M = ccMats(), f = new THREE.Mesh(M.flareG, M.flare); f.position.set(x, 0.04, z); f.rotation.set(Math.PI / 2, 0, a); f.userData.flare = 1; g.add(f); const l = new THREE.PointLight(0xff3020, 0, 9, 2); l.position.set(x, 0.35, z); l.userData.flare = 1; g.add(l); }
  function ccGlass(g, x, z, h) { const M = ccMats(); for (let k = 0; k < 14; k++) { const s = new THREE.Mesh(M.glassG, M.glass), a = ccR(h, 200 + k) * Math.PI * 2, r = ccR(h, 220 + k) * 3.2; s.position.set(x + Math.sin(a) * r, 0.02, z + Math.cos(a) * r); s.rotation.set(-Math.PI / 2, 0, a); s.scale.setScalar(0.5 + ccR(h, 240 + k)); g.add(s); } }

  // ---------- a scene coming into view, and going away ----------
  function ccMake(c) {
    const P = ccPlace(c), g = new THREE.Group(); g.name = 'city-call'; scene.add(g);
    const L = { c, P, g, ppl: {}, units: [], cars: [], vis: true, props: false, tape: null, sheet: null, ph: null };
    for (let k = 0; k < P.cars.length; k++) {
      const q = P.cars[k], cg = new THREE.Group(); cg.position.set(q.x, 0.12, q.z); cg.rotation.y = q.yaw; scene.add(cg);
      const o = { g: cg, model: null, x: q.x, z: q.z, yaw: q.yaw, sp: 0, k, cc: true, inCar: true };
      o.slot = lodCar(putCar(cg, q.id, q.col, m => {
        m.position.y = 0; o.model = m;
        // a crash: both cars crumpled where they met
        if (c.kind === 'crash') try { const D = CRX.dbg.crDentMesh, zf = (m.userData.crB && m.userData.crB.zF) || -2.1, zb = (m.userData.crB && m.userData.crB.zB) || 2.1; if (k === 0) { D(m, [0.45, 0.6, zf, -0.3, 1, 0.42, 1.0], cg); D(m, [-0.2, 0.92, zf * 0.9, 0, 1, 0.25, 0.8], cg); } else { D(m, [-0.95, 0.6, -0.4, 1, 0.1, 0.38, 1.1], cg); D(m, [-0.95, 0.95, 0.4, 1, 0, 0.22, 0.9], cg); } } catch (er) {}
      }));
      L.cars.push(o);
    }
    for (let k = 0; k < P.units.length; k++) {
      const U = P.units[k], u = copUnit(U.kind, U.x, U.z, U.yaw, 'cc', U.num, true);
      u.nid = `c:${c.id}:${k}`; u.cc = c; u.k = k; u.g.visible = false; CC.units.push(u); L.units.push(u);
    }
    if (c.kind === 'crash') { for (const s of P.spots.cones) ccCone(g, s[0], s[1]); ccFlare(g, ...ccAt(P.E, 10, -0.5), 0.4); ccFlare(g, ...ccAt(P.E, -4, 1.2), 1.9); ccGlass(g, P.E.ax + P.E.dx * 5, P.E.az + P.E.dz * 5, c.h); }
    CC.live.set(c.id, L); return L;
  }
  function ccDrop(L) {
    for (const r of Object.keys(L.ppl)) ccGone(L, r);
    for (const o of L.cars) { o.slot.userData.dead = true; scene.remove(o.g); }
    for (const u of L.units) { if (!u.taken) copKill(u); CC.units = CC.units.filter(q => q !== u); }
    if (L.tape) { L.tape.life = 0; }
    scene.remove(L.g); L.g.traverse(o => { if (o.isLight) o.dispose && o.dispose(); });
    CC.live.delete(L.c.id);
  }
  function ccUnits() { const out = []; for (const u of CC.units) if (!u.gone && !u.taken && !u.hid && u.g.visible) out.push(u); return out; }

  // ---------- each frame: where everybody on a scene is, from the call's own clock ----------
  function ccUnitAt(L, k, T, ph) {
    const c = L.c, U = L.P.units[k], u = L.units[k]; if (!u) return;
    const ta = c.assign + k * 6, f = c.travel > 0 ? (T - ta) / c.travel : 1;
    let x = U.x, z = U.z, yaw = U.yaw, show = true, lights = true, siren = false, sp = 0;
    // a unit that takes somebody in leaves the scene early (robbery, fight, disturbance)
    const early = L.leaveAt && L.leaveAt[k] != null && T > L.leaveAt[k];
    if (ph === 'pend' || (ph !== 'leave' && !early && f < 1)) {
      if (ph === 'pend' || f <= 0) show = false;
      else { const R = ccRoute(c, k); if (R) { const p = ccAlong(R, R.len * f); x = p[0]; z = p[1]; yaw = p[2]; sp = R.len / c.travel; siren = Math.hypot(U.x - x, U.z - z) > 50; } }
    } else if (ph === 'leave' || early) {
      const t0 = early ? L.leaveAt[k] : c.end + k * 3, R = ccLeave(c, k), s = Math.max(0, T - t0) * 11;
      lights = false; if (!R || s >= R.len) show = false; else { const p = ccAlong(R, s); x = p[0]; z = p[1]; yaw = s < 6 ? U.yaw + cNorm(p[2] - U.yaw) * (s / 6) : p[2]; sp = s > 0 ? 11 : 0; }
    }
    if (CNET.rem.has(u.nid)) { u.hid = true; show = false; }
    if (u.taken) show = false;
    const mv = Math.hypot(x - u.x, z - u.z); u.x = x; u.z = z; u.yaw = yaw; u.sp = sp; u.lights = lights && show; u.siren = siren && show;
    u.g.position.set(x, 0.12, z); u.g.rotation.y = yaw; u.g.visible = show && L.vis;
    const m = u.model; if (m && u.g.visible) { spinWheels(m, mv < 6 ? mv : 0); copLights(m, u.lights, L.t, u.ph); trLamps(m, 0, false, L.t, u.ph); }
  }
  function ccCarAt(L, k, T, ph) {
    const c = L.c, q = L.P.cars[k], o = L.cars[k]; if (!o) return;
    let x = q.x, z = q.z, yaw = q.yaw, show = true;
    // a stopped driver gets to go once the ticket's written; a wreck sits till the tow (it's gone when the call clears)
    if (c.kind === 'stop' && ph === 'leave') { const R = ccLeave(c, 9), s = Math.max(0, T - c.end + 2) * 10; if (!R || s >= R.len) show = false; else { const p = ccAlong(R, s); x = p[0]; z = p[1]; yaw = s < 6 ? q.yaw + cNorm(p[2] - q.yaw) * (s / 6) : p[2]; } }
    if (c.kind === 'crash' && ph === 'leave') show = false;
    const mv = Math.hypot(x - o.x, z - o.z); o.x = x; o.z = z; o.yaw = yaw;
    o.g.position.set(x, 0.12, z); o.g.rotation.y = yaw; o.g.visible = show && L.vis;
    const m = o.model; if (m && o.g.visible) { spinWheels(m, mv < 6 ? mv : 0); if (c.kind === 'crash' || (c.kind === 'stop' && ph !== 'leave')) ccHaz(m, true, L.t + k * 0.13); else ccHaz(m, false, 0); }
  }
  function ccHaz(m, on, t) {
    const U = m.userData, Lp = U.lamps, b = on && ((t % 0.8) < 0.42);
    if (Lp && Lp.turnL) { for (const [key] of TRL.keys) { const G = Lp[key]; if (G) for (const g of G) g.visible = b; } return; }
    let M = U.trM; if (M === null) return; if (!M) { if (!on) return; M = trLampMake(m); if (!M) return; } M.l.visible = M.r.visible = b;
  }
  // the people: what each kind of call looks like at each moment
  function ccPeople(L, T, ph, t, dt) {
    const c = L.c, P = L.P, S2 = P.spots, ts = T - c.arrive, on = ph === 'on', E = P.E, h = c.h;
    const uPos = k => { const u = L.units[k]; return u ? [u.x, u.z, u.yaw] : [E.ax, E.az, 0]; };
    const door = (k, s) => { const u = L.units[k]; if (!u) return [E.ax, E.az]; const cs = Math.cos(u.yaw), sn = Math.sin(u.yaw); return [u.x - cs * 1.4 * (s || 1) - sn * 0.4, u.z + sn * 1.4 * (s || 1) - cs * 0.4]; };
    // an officer walks from their door to a spot, works it, and walks back before the unit pulls off
    const officer = (role, k, spot, face, act, back) => {
      const B = ccOfficerBase(); if (!B) return;
      if (!on || ts < 1.5) { ccGone(L, role); return; }
      const d0 = door(k), end = back != null ? back : c.dur, walk = Math.max(2, Math.hypot(spot[0] - d0[0], spot[1] - d0[1]) / 1.6);
      let p = spot, y = face, a = act;
      if (ts < 1.5 + walk) { const f = (ts - 1.5) / walk; p = ccLerp(d0, spot, f); y = ccFace(d0[0], d0[1], spot[0], spot[1]); a = 'idle'; }
      else if (ts > end - walk - 1.5) { const f = clamp((ts - (end - walk - 1.5)) / walk, 0, 1); if (f >= 1) { ccGone(L, role); return; } p = ccLerp(spot, d0, f); y = ccFace(spot[0], spot[1], d0[0], d0[1]); a = 'idle'; }
      ccMan(L, role, B, p[0], p[1], y, a, t, dt);
    };
    if (c.kind === 'stop') {
      const w = S2.win, u = uPos(0); officer('o0', 0, w, ccFace(w[0], w[1], P.cars[0].x, P.cars[0].z) + 0.9, 'write', c.dur - 4);
    } else if (c.kind === 'crash') {
      const a = S2.d1, b = S2.d2, shown = ph === 'pend' || ph === 'enr' || on;
      if (shown) { ccMan(L, 'd1', ccBase(h), a[0], a[1], ccFace(a[0], a[1], b[0], b[1]), on ? 'idle' : 'talk', t, dt); ccMan(L, 'd2', ccBase(h + 1), b[0], b[1], ccFace(b[0], b[1], a[0], a[1]), on ? 'hip' : 'point', t, dt); }
      else { ccGone(L, 'd1'); ccGone(L, 'd2'); }
      const mid = [(a[0] + b[0]) / 2 - E.dx * 1.6, (a[1] + b[1]) / 2 - E.dz * 1.6];
      officer('o0', 0, mid, ccFace(mid[0], mid[1], a[0], a[1]), 'write');
    } else if (c.kind === 'rob') {
      const k0 = S2.clerk, caught = ccR(h, 11) < 0.6, face = S2.face;
      ccMan(L, 'clerk', ccBase(h + 2), k0[0], k0[1], on ? ccFace(k0[0], k0[1], k0[0] + Math.sin(face) * 2 + Math.cos(face) * 1.4, k0[1] + Math.cos(face) * 2 - Math.sin(face) * 1.4) : face, on ? 'talk' : 'point', t, dt);
      officer('o0', 0, [k0[0] + Math.sin(face) * 1.5 + Math.cos(face) * 0.9, k0[1] + Math.cos(face) * 1.5 - Math.sin(face) * 0.9], ccFace(k0[0] + Math.sin(face) * 1.5, k0[1] + Math.cos(face) * 1.5, k0[0], k0[1]), 'write');
      // they caught the one who did it: hands up, cuffs, in the back of the second car, which leaves with him
      if (caught && on) {
        const load = c.dur * 0.6, p = S2.perp, d1 = door(1, -1);
        L.leaveAt = L.leaveAt || {}; L.leaveAt[1] = c.arrive + load + 4;
        if (ts > 6 && ts < load) { ccMan(L, 'perp', ccBase(h + 3), p[0], p[1], ccFace(p[0], p[1], ...uPos(1)), ts < 12 ? 'hands' : 'cuff', t, dt); const op = [p[0] + Math.sin(face) * 0.9, p[1] + Math.cos(face) * 0.9]; if (ts > 8) ccMan(L, 'o1', ccOfficerBase(), op[0], op[1], ccFace(op[0], op[1], p[0], p[1]), 'idle', t, dt); }
        else if (ts >= load && ts < load + 3) { const f = (ts - load) / 3, q = ccLerp(p, d1, f); ccMan(L, 'perp', ccBase(h + 3), q[0], q[1], ccFace(p[0], p[1], d1[0], d1[1]), 'cuff', t, dt); ccMan(L, 'o1', ccOfficerBase(), q[0] + 0.6, q[1] + 0.4, ccFace(p[0], p[1], d1[0], d1[1]), 'idle', t, dt); if (L.units[1]) jPanel(L.units[1], 'doorR1', true); }
        else { ccGone(L, 'perp'); ccGone(L, 'o1'); if (L.units[1] && ts >= load + 3) jPanel(L.units[1], 'doorR1', false); }
      } else { ccGone(L, 'perp'); if (!caught) officer('o1', 1, [S2.perp[0], S2.perp[1]], face + 1.2, 'idle'); }
    } else if (c.kind === 'fight') {
      const f = S2.f, cb = S2.curb, pre = ph === 'pend' || ph === 'enr';
      if (pre) {
        // two of them squared up and swinging, circling each other, a couple people watching
        const a = t * 0.6 + (h % 7), r = 0.75, A = [f[0] + Math.cos(a) * r, f[1] + Math.sin(a) * r], B = [f[0] - Math.cos(a) * r, f[1] - Math.sin(a) * r];
        ccMan(L, 'f1', ccBase(h), A[0], A[1], ccFace(A[0], A[1], B[0], B[1]), 'fight', t, dt); ccMan(L, 'f2', ccBase(h + 4), B[0], B[1], ccFace(B[0], B[1], A[0], A[1]), 'fight', t, dt);
        const w1 = ccWalkSpot(f[0] + E.dx * 4, f[1] + E.dz * 4, E.rx, E.rz), w2 = ccWalkSpot(f[0] - E.dx * 3.5 + E.rx * 1.5, f[1] - E.dz * 3.5 + E.rz * 1.5, E.rx, E.rz);
        ccMan(L, 'w1', ccBase(h + 2), w1[0], w1[1], ccFace(w1[0], w1[1], f[0], f[1]), 'point', t, dt); ccMan(L, 'w2', ccBase(h + 5), w2[0], w2[1], ccFace(w2[0], w2[1], f[0], f[1]), 'idle', t, dt);
      } else if (on) {
        ccGone(L, 'w1'); ccGone(L, 'w2');
        const loadAt = c.dur * 0.82, seat = s => [cb[0] + E.dx * s, cb[1] + E.dz * s], faceRoad = ccFace(cb[0], cb[1], cb[0] - E.rx, cb[1] - E.rz);
        L.leaveAt = L.leaveAt || {}; L.leaveAt[1] = c.arrive + loadAt + 4;
        for (const [role, k, s] of [['f1', 0, -0.8], ['f2', 4, 0.8]]) {
          const q = seat(s);
          if (ts < 7) ccMan(L, role, ccBase(h + k), f[0] + s, f[1], ccFace(f[0], f[1], ...uPos(0)), 'hands', t, dt);
          else if (ts < 11) { const g = ccLerp([f[0] + s, f[1]], q, (ts - 7) / 4); ccMan(L, role, ccBase(h + k), g[0], g[1], ccFace(f[0], f[1], q[0], q[1]), 'cuff', t, dt); }
          else if (ts < loadAt) ccMan(L, role, ccBase(h + k), q[0], q[1], faceRoad, 'sit', t, dt);
          else ccGone(L, role);
        }
        const o0 = [cb[0] - E.rx * 1.6 - E.dx * 1.2, cb[1] - E.rz * 1.6 - E.dz * 1.2], o1 = [cb[0] - E.rx * 1.4 + E.dx * 2, cb[1] - E.rz * 1.4 + E.dz * 2];
        officer('o0', 0, o0, ccFace(o0[0], o0[1], cb[0], cb[1]), 'write'); officer('o1', 1, o1, ccFace(o1[0], o1[1], cb[0], cb[1]), 'hip', loadAt);
      } else { for (const r of ['f1', 'f2', 'w1', 'w2']) ccGone(L, r); }
    } else if (c.kind === 'shoot') {
      const v = S2.v, vy = ccR(h, 12) * Math.PI * 2;
      if (ph !== 'leave') ccMan(L, 'vic', ccBase(h + 1), v[0], v[1], vy, 'lie', t, dt); else ccGone(L, 'vic');
      // a covered body once the scene is set
      if (on && ts > 25 && !L.sheet) { const M = ccMats(), s = new THREE.Mesh(M.sheetG, M.sheet); s.position.set(v[0] - Math.sin(vy) * -0.85, 0.13, v[1] - Math.cos(vy) * -0.85); s.rotation.y = vy; s.scale.set(1.05, 1, 1.05); L.g.add(s); L.sheet = s; }
      if (L.sheet) { L.sheet.visible = on; const m = L.ppl.vic; if (m) m.P.wrap.visible = L.vis && !on; }
      if (ph === 'pend' || ph === 'enr') {
        const b1 = ccWalkSpot(v[0] + E.dx * 2.6 + E.rx * 1.4, v[1] + E.dz * 2.6 + E.rz * 1.4, E.rx, E.rz), b2 = ccWalkSpot(v[0] - E.dx * 5, v[1] - E.dz * 5, E.rx, E.rz);
        ccMan(L, 'b1', ccBase(h + 2), b1[0], b1[1], ccFace(b1[0], b1[1], v[0], v[1]), 'idle', t, dt); ccMan(L, 'b2', ccBase(h + 3), b2[0], b2[1], ccFace(b2[0], b2[1], v[0], v[1]), 'point', t, dt);
      } else { ccGone(L, 'b1'); ccGone(L, 'b2'); }
      // tape and the numbered markers go up a little after the first units get there
      if (on && ts > 18 && !L.tape && typeof scTape === 'function') { L.tape = scTape(v[0], v[1], P.marks, 'CC' + c.id); if (L.tape) L.tape.life = Math.max(30, c.end - T + 10); }
      if (L.tape && L.tape.g) L.tape.g.visible = L.vis && (on || ph === 'leave');
      const ring = k => { const a = (k + 0.3) * 1.9 + vy, r = 15.6; return ccWalkSpot(v[0] + Math.sin(a) * r, v[1] + Math.cos(a) * r, Math.sin(a), Math.cos(a)); };
      const r0 = ring(0), r1 = ring(1); officer('o0', 0, r0, ccFace(v[0], v[1], r0[0], r0[1]), 'hip'); officer('o1', 1, r1, ccFace(v[0], v[1], r1[0], r1[1]), 'idle');
      officer('o2', 2, [v[0] + Math.sin(vy) * 1.6, v[1] + Math.cos(vy) * 1.6], ccFace(v[0] + Math.sin(vy) * 1.6, v[1] + Math.cos(vy) * 1.6, v[0], v[1]), 'write');
      // the detective walks the markers
      if (on && ts > 60 && ts < c.dur - 10 && P.marks.length) { const n = P.marks.length, q = (ts - 60) / 9, i0 = Math.floor(q) % n, i1 = (i0 + 1) % n, f = clamp((q % 1) * 1.6, 0, 1), a = P.marks[i0], b = P.marks[i1], p = ccLerp(a, b, f); ccMan(L, 'det', ccDetBase(), p[0] + 0.7, p[1] + 0.5, f < 1 ? ccFace(a[0], a[1], b[0], b[1]) : ccFace(p[0], p[1], a[0], a[1]), f < 1 ? 'idle' : 'write', t, dt); }
      else ccGone(L, 'det');
    } else {
      const dr = S2.door, face = ccFace(dr[0], dr[1], E.ax + E.dx * 20, E.az + E.dz * 20), out = [dr[0] - E.rx * 1.6, dr[1] - E.rz * 1.6], arrest = ccR(h, 13) < 0.4;
      const r2 = [dr[0] + E.dx * 1.4 - E.rx * 0.6, dr[1] + E.dz * 1.4 - E.rz * 0.6];
      if (ph !== 'leave') ccMan(L, 'r1', ccBase(h + 5), dr[0], dr[1], ccFace(dr[0], dr[1], ...(on ? out : r2)), 'talk', t, dt); else ccGone(L, 'r1');
      if (!on && ph !== 'leave') ccMan(L, 'r2', ccBase(h), r2[0], r2[1], ccFace(r2[0], r2[1], dr[0], dr[1]), 'point', t, dt);
      else if (on && arrest) {
        const load = c.dur * 0.7, d0 = door(0, -1); L.leaveAt = L.leaveAt || {}; L.leaveAt[0] = c.arrive + c.dur * 0.7 + 6;
        if (ts < load - 6) ccMan(L, 'r2', ccBase(h), r2[0], r2[1], ccFace(r2[0], r2[1], ...out), ts < c.dur * 0.35 ? 'point' : 'cuff', t, dt);
        else if (ts < load) { const q = ccLerp(r2, d0, (ts - load + 6) / 6); ccMan(L, 'r2', ccBase(h), q[0], q[1], ccFace(r2[0], r2[1], d0[0], d0[1]), 'cuff', t, dt); if (L.units[0]) jPanel(L.units[0], 'doorR1', ts > load - 1.5); }
        else { ccGone(L, 'r2'); if (L.units[0]) jPanel(L.units[0], 'doorR1', false); }
      } else ccGone(L, 'r2');
      officer('o0', 0, out, ccFace(out[0], out[1], dr[0], dr[1]), 'idle', arrest ? c.dur * 0.7 + 4 : null);
    }
  }
  function ccScene(L, T, dt) {
    const c = L.c, ph = ccPhase(c, T); L.t = (L.t || 0) + dt;
    if (!ph) { ccDrop(L); return; }
    L.ph = ph;
    for (let k = 0; k < L.units.length; k++) ccUnitAt(L, k, T, ph);
    for (let k = 0; k < L.cars.length; k++) ccCarAt(L, k, T, ph);
    ccPeople(L, T, ph, performance.now() / 1000, dt);
    L.g.visible = L.vis;
    // flares burn while somebody's on it
    if (c.kind === 'crash') L.g.traverse(o => { if (!o.userData.flare) return; if (o.isLight) o.intensity = L.vis && ph !== 'leave' ? 1.2 + Math.sin(L.t * 23 + o.id) * 0.4 : 0; else o.visible = ph !== 'leave'; });
  }

  // ---------- picking which calls to show, the scanner, the step ----------
  const CC_SCAN = { stop: null, crash: '💥 crash', rob: '💰 robbery', fight: '👊 fight', shoot: '🔫 shots fired, one down', dist: '🏠 disturbance' };
  function ccCands(mx, mz, T) {
    const out = [], g = gpsGraph(), bi = Math.floor(mx / CC_BEAT), bj = Math.floor(mz / CC_BEAT), s = Math.floor(T / CC_SH), RV = ccRV();
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const B = ccBeat(bi + di, bj + dj); if (!B.rate) continue;
      for (const ss of [s - 1, s]) for (const c of ccShift(B, ss)) {
        const ph = ccPhase(c, T); if (!ph) continue;
        const d = Math.hypot(g.nx[c.node] - mx, g.nz[c.node] - mz); if (d > RV + 160) continue;
        out.push({ c, d, ph });
      }
    }
    for (const c of CC.forced) { const ph = ccPhase(c, T); if (ph) out.push({ c, d: Math.hypot(g.nx[c.node] - mx, g.nz[c.node] - mz) - 1e4, ph }); }
    return out.sort((a, b) => a.d - b.d);
  }
  function ccScanner(list, T) {
    if (T - CC.annT < 55 || !S || jBusy()) return;
    for (const { c, d, ph } of list) {
      if (d > 520 || !CC_SCAN[c.kind] || CC.ann.has(c.id + ph)) continue;
      if (ph !== 'pend' && ph !== 'enr') continue;
      CC.ann.add(c.id + ph); if (CC.ann.size > 200) CC.ann.clear(); CC.annT = T;
      const st = copStreet(...(c.pl ? [c.pl.E.ax, c.pl.E.az] : [gpsGraph().nx[c.node], gpsGraph().nz[c.node]]));
      const held = ccBusy(gpsGraph().nx[c.node], gpsGraph().nz[c.node]) > 0.99;
      if (ph === 'pend') toast(`📻 Scanner: ${CC_SCAN[c.kind]} on ${st}. ${held ? 'All units tied up, call is holding.' : 'Waiting on a unit.'}`, '');
      else toast(`📻 Scanner: unit ${c.pl ? c.pl.units[0].num : 100 + ccH(c.h, 50) % 800} en route, ${CC_SCAN[c.kind]} on ${st}. ETA ${Math.max(1, Math.round((c.arrive - T) / 60))} min.`, '');
      return;
    }
  }
  function ccStep(dt) {
    if (CC.off || !HOOD.ready || !S) return;
    const show = worldOn && driving && !inside && !ROLL.on && !STRIP.on;
    if (!show) { for (const L of CC.live.values()) { L.vis = false; L.g.visible = false; for (const u of L.units) u.g.visible = false; for (const o of L.cars) o.g.visible = false; for (const m of Object.values(L.ppl)) m.P.wrap.visible = false; if (L.tape && L.tape.g) L.tape.g.visible = false; } return; }
    const T = ccT(), [mx, mz] = copMe(), RV = ccRV();
    if ((CC.tick++ % 20) === 0) {
      const list = ccCands(mx, mz, T), want = new Set();
      for (const q of list) { if (want.size >= ccCap()) break; if (q.d < RV || CC.live.has(q.c.id) && q.d < RV + 120) want.add(q.c.id); }
      for (const L of [...CC.live.values()]) if (!want.has(L.c.id)) ccDrop(L);
      for (const q of list) if (want.has(q.c.id) && !CC.live.has(q.c.id)) ccMake(q.c);
      ccScanner(list, T);
    }
    for (const L of [...CC.live.values()]) {
      L.vis = true;
      try { ccScene(L, T, dt); } catch (e) { if (!CC.err) { CC.err = 1; console.warn('city calls: ' + e.message, e.stack); } ccDrop(L); }
    }
    // standing in the middle of somebody else's call: they tell you to back up
    if (foot.on && T - CC.backT > 25) for (const L of CC.live.values()) {
      if (L.ph !== 'on' || !L.units.length) continue; const s = L.P.spots, p = s.v || s.f || s.win || s.d1 || s.clerk || s.door; if (!p) continue;
      if (Math.hypot(p[0] - mx, p[1] - mz) < (L.c.kind === 'shoot' ? 14 : 5)) { CC.backT = T; toast(L.c.kind === 'shoot' ? '👮 "Sir, back up. This is a crime scene. Stay behind the tape."' : '👮 "Give us some room. Keep it moving."', ''); break; }
    }
  }
  // a cop working a scene still has eyes: catch them doing something in front of you and that unit comes off the call
  function ccTake(u) {
    const nu = copUnit(u.kind, u.x, u.z, u.yaw, 'patrol', u.num); nu.nid = u.nid; nu.lights = true; copJoin(nu);
    u.taken = true; u.g.visible = false; u.lights = u.siren = false;
    const L = CC.live.get(u.cc.id); if (L) for (const r of Object.keys(L.ppl)) if (/^o\d$/.test(r) && +r[1] === u.k) ccGone(L, r);
    return nu;
  }
  const _ccEyes = copEyes;
  copEyes = function (R, x, z) {
    const r = _ccEyes.apply(this, arguments); if (r || CC.off) return r;
    if (x == null) [x, z] = copMe();
    let best = null, bd = 1e9;
    for (const u of ccUnits()) { const L = CC.live.get(u.cc.id); if (!L || L.ph !== 'on') continue; const d = Math.hypot(u.x - x, u.z - z); if (d < bd && copSees(u, x, z, R)) { best = u; bd = d; } }
    return best ? { u: ccTake(best), rem: false } : null;
  };
  // your own 911 calls wait in the same line as everybody else's
  const _ccReport = copReport;
  copReport = function (x, z, why, o = {}) {
    if (!CC.off && !(o && (o.cc || /heard/.test(o.who || '')))) {
      const w = ccWait(x, z, o.units || 1);
      o = { ...o, cc: 1, delay: (o.delay != null ? o.delay : 12) + w.wait + w.travel };
      if (w.wait > 15 && cNow() - CC.toldT > 40) { CC.toldT = cNow(); setTimeout(() => toast(`📻 Dispatch is backed up: ${w.held} of ${CC_OFF} units on this side of town are on other calls. Your 911 call is holding, units about ${Math.max(1, Math.round((w.wait + w.travel) / 60))} min out.`, ''), 2500); }
    }
    return _ccReport.call(this, x, z, why, o);
  };
  // on the minimap: a call nobody's on yet pulses orange; the cop cars already show up red and blue
  const _ccMini = hoodMini;
  hoodMini = function (x, to, dpr, R, px, pz) {
    _ccMini.apply(this, arguments);
    if (CC.off) return; const fl = (performance.now() % 900) < 450;
    for (const L of CC.live.values()) {
      if (L.ph !== 'pend' && L.ph !== 'enr') continue; const e = L.P.E, s = L.P.spots, p = s.v || s.f || s.d1 || s.clerk || s.door || [e.ax, e.az];
      const dx = p[0] - px, dz = p[1] - pz; if (dx * dx + dz * dz > R * R * 1.4) continue;
      const q = to(p[0], p[1]); x.globalAlpha = fl ? 0.95 : 0.55; x.fillStyle = '#ff8a1a'; x.strokeStyle = '#141016'; x.lineWidth = dpr;
      x.beginPath(); x.moveTo(q[0], q[1] - 5 * dpr); x.lineTo(q[0] + 4.5 * dpr, q[1] + 3.5 * dpr); x.lineTo(q[0] - 4.5 * dpr, q[1] + 3.5 * dpr); x.closePath(); x.fill(); x.stroke(); x.globalAlpha = 1;
    }
  };
  const _ccStepStreet = stepStreet;
  stepStreet = function (t) {
    _ccStepStreet.apply(this, arguments);
    const n = performance.now(), dt = Math.min(0.05, (n - (CC.last || n)) / 1000); CC.last = n;
    try { ccStep(dt); } catch (e) { if (!CC.err) { CC.err = 1; console.warn('city calls: ' + e.message, e.stack); } }
  };
  // test hooks (and the crash code's collision list: the cars and units on a scene are solid)
  window.__citycalls = {
    CC, CC_KINDS, ccH, ccR, ccHW, ccBeat, ccBeatAt, ccGen, ccRun, ccShift, ccPhase, ccFree, ccBusy, ccWait, ccCands, ccPlace, ccStep, ccUnits, ccTake,
    movers(x, z, R, out) {
      for (const L of CC.live.values()) {
        for (const o of L.cars) if (o.g.visible && Math.abs(o.x - x) < R + 6 && Math.abs(o.z - z) < R + 6) out.push({ e: o, x: o.x, z: o.z, yaw: o.yaw, sp: 0, hw: 0.96, hl: 2.45, m: 1900, kind: 'hood' });
        for (const u of L.units) if (u.g.visible && !u.taken && Math.abs(u.x - x) < R + 6 && Math.abs(u.z - z) < R + 6) out.push({ e: u, x: u.x, z: u.z, yaw: u.yaw, sp: u.sp || 0, hw: 0.98, hl: 2.55, m: 2100, kind: 'cop' });
      }
      return out;
    },
    // a call right here, right now, in any phase (tests only): ago = seconds since it came in
    force(kind, x, z, o = {}) {
      const n = hNearestNode(x, z), B = ccBeatAt(x, z), K = CC_KINDS[kind], T = ccT(), h = o.h != null ? o.h : (Math.random() * 1e9) | 0;
      const c = { id: 'f' + h, B, h, kind, K, units: K.units, node: n, travel: o.travel != null ? o.travel : kind === 'stop' ? 0 : 40, dur: o.dur || 200 };
      c.start = T - (o.ago || 0); c.assign = c.start + (o.wait || 0); c.arrive = c.assign + c.travel; c.end = c.arrive + c.dur;
      if (kind === 'rob' && !B.stores.length) return null;
      CC.forced.push(c); CC.tick = 0; return c;
    },
    clear() { CC.forced = []; for (const L of [...CC.live.values()]) ccDrop(L); CC.tick = 0; },
  };
  // ==== city calls (end) ====
