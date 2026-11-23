  // ==== smooth turns (begin) ====
  // AI cars (hood regulars and opps, street-war cars, cops) drive real arcs through every corner, like a person would:
  // they pick their next two turns early, blink that way about 3 s before the corner, brake on a steady curve down to
  // the corner speed (brake lights on), sweep one clean arc (tight on a right, wide on a left, a U at a dead end) and roll
  // back up to speed. Straight-through intersections don't slow anybody down. The regulars on the shared clock run the
  // same arcs and blinkers off the clock, so every player sees the same car turning the same way with nothing sent.
  const TRN = { brake: 2.6, acc: 3.2, alat: 2.6, hot: 10, lead: 3.2, near: 30, on: 0.5, per: 0.8 };
  const trNorm = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
  // the corner at node n, coming from p and leaving to q, for a car driving `lane` m right of the center line.
  // u1 = where the arc starts on the p->n block, v2 = where it ends on the n->q block (both measured along the center line)
  function trCorner(g, p, n, q, lane, hot) {
    if (p == null || q == null || n == null || p === n || q === n) return null;
    const ax = g.nx[p], az = g.nz[p], cx = g.nx[n], cz = g.nz[n], bx = g.nx[q], bz = g.nz[q];
    const L1 = Math.hypot(cx - ax, cz - az), L2 = Math.hypot(bx - cx, bz - cz); if (!(L1 > 1 && L2 > 1)) return null;
    const d1x = (cx - ax) / L1, d1z = (cz - az) / L1, d2x = (bx - cx) / L2, d2z = (bz - cz) / L2;
    const cr = d1x * d2z - d1z * d2x, th = Math.abs(Math.atan2(cr, d1x * d2x + d1z * d2z)); if (th < 0.05) return null;
    const r1x = -d1z, r1z = d1x;
    let sg, R, sx, sz, u1, v2, TH = th;
    if (th > 2.85) {   // dead end: swing a U around the end of the street
      sg = -1; TH = Math.PI; R = Math.min(lane, 0.45 * L1, 0.45 * L2); if (R < 0.8) return null;
      sx = cx + r1x * lane - d1x * R; sz = cz + r1z * lane - d1z * R; u1 = L1 - R; v2 = R;
    } else {
      sg = cr > 0 ? 1 : -1;
      const p1x = cx + r1x * lane, p1z = cz + r1z * lane, p2x = cx - d2z * lane, p2z = cz + d2x * lane;
      const t1 = ((p2x - p1x) * d2z - (p2z - p1z) * d2x) / cr, Px = p1x + d1x * t1, Pz = p1z + d1z * t1, t2 = (Px - cx) * d2x + (Pz - cz) * d2z, tn = Math.tan(th / 2);
      const Rw = th < 0.6 ? 45 : hot ? (sg > 0 ? 9 : 11) : (sg > 0 ? 6 : 10.5);
      const dT = Math.min(Rw * tn, 0.55 * L1 + t1, 0.45 * L2 - t2); if (dT < 0.3) return null;
      R = dT / tn; sx = Px - d1x * dT; sz = Pz - d1z * dT; u1 = L1 + t1 - dT; v2 = t2 + dT;
      if (u1 < 0 || v2 > L2) return null;
    }
    const pre = L1 - u1;
    return { sg, th: TH, R, sx, sz, d1x, d1z, nx: sg * r1x, nz: sg * r1z, u1, v2, pre, zone: pre + v2, arc: R * TH, sig: TH > 0.55, v: Math.max(2.4, Math.sqrt((hot ? TRN.hot : TRN.alat) * R)) };
  }
  // a point on the corner's arc, f = 0..1 through it; o.dx/o.dz = the way the car points there
  function trArc(c, f, o) {
    const ph = clamp(f, 0, 1) * c.th, s = Math.sin(ph), k = Math.cos(ph), al = c.R * s, la = c.R * (1 - k);
    o.x = c.sx + c.d1x * al + c.nx * la; o.z = c.sz + c.d1z * al + c.nz * la; o.dx = c.d1x * k + c.nx * s; o.dz = c.d1z * k + c.nz * s; return o;
  }
  // put the car on its line: anything that knocked it off (a crash, a shove, a new route) eases out over a second or so
  function trPlace(e, p, dt) {
    let ox = e._tx == null ? e.x - p.x : e.x - e._tx, oz = e._tx == null ? e.z - p.z : e.z - e._tz;
    const px = e.x, pz = e.z;
    if (!(ox * ox + oz * oz < 36)) {   // way off its line (it was off doing something else): glide back over like before
      const k = 1 - Math.exp(-dt * 4); e.x += (p.x - e.x) * k; e.z += (p.z - e.z) * k; e._tx = null;
      e.yaw += trNorm(mtCarYaw(e.x - px, e.z - pz, p.dx, p.dz, dt) - e.yaw) * Math.min(1, dt * 8); return;
    }
    const k = Math.exp(-dt * 2.5); ox *= k; oz *= k;
    e.x = p.x + ox; e.z = p.z + oz; e._tx = p.x; e._tz = p.z;
    const yw = ox * ox + oz * oz > 0.25 ? mtCarYaw(e.x - px, e.z - pz, p.dx, p.dz, dt) : Math.atan2(-p.dx, -p.dz);
    e.yaw += trNorm(yw - e.yaw) * Math.min(1, dt * 10);
  }
  const _trP = { x: 0, z: 0, dx: 0, dz: -1 };
  // one step for a car on the road graph (e.a -> e.b, e.u metres along). cap = the most it may do right now (somebody in
  // front of it). next(o) picks the node after o.b. Sets e.sig (-1 left, 1 right, 0 none) and e.brk (brake lights).
  function trDrive(e, dt, want, cap, lane, hot, next) {
    const g = gpsGraph(); if (e.a == null || e.b == null) return;
    // somebody else moved it onto a different block (a ride, a route, a cop rejoining the roads): start the lookahead over
    if (e._ab !== e.a * 1e7 + e.b) { e._ab = e.a * 1e7 + e.b; e.pa = e._pa0 != null ? e._pa0 : null; e.nb = e._nb0 != null ? e._nb0 : null; e.nb2 = null; e._c0 = e._c1 = e._c2 = undefined; if (e._pa0 == null) e._tx = null; }
    e._pa0 = e._nb0 = null;
    if (e._hot !== hot) { e._hot = hot; e._c0 = e._c1 = e._c2 = undefined; }
    // a new route came in (opps homing on you, cops chasing): keep the turns already picked if it starts with them
    if (e.path !== e._np && e.nb != null) {
      const P = e.path;
      if (P && P[0] === e.nb) { P.shift(); if (e.nb2 != null) { if (P[0] === e.nb2) P.shift(); else { e.nb2 = null; e._c2 = undefined; } } }
      else if (!e._c1 || e.u < e._c1.u1 - 2) { e.nb = e.nb2 = null; e._c1 = e._c2 = undefined; }
      else { e.nb2 = null; e._c2 = undefined; e.path = null; }
      e._np = e.path;
    }
    const look = () => {
      if (e.nb == null) { e.nb = next(e); e.nb2 = null; e._c1 = e._c2 = undefined; }
      if (e.nb2 == null && e.nb != null && e.nb !== e.b) { e.nb2 = next({ a: e.b, b: e.nb, path: e.path, u: 0, x: e.x, z: e.z }); e._c2 = undefined; }
      e._np = e.path;
      if (e._c0 === undefined) e._c0 = trCorner(g, e.pa, e.a, e.b, lane, hot);
      if (e._c1 === undefined) e._c1 = trCorner(g, e.a, e.b, e.nb, lane, hot);
      if (e._c2 === undefined) e._c2 = trCorner(g, e.b, e.nb, e.nb2, lane, hot);
    };
    look();
    let ax = g.nx[e.a], az = g.nz[e.a], bx = g.nx[e.b], bz = g.nz[e.b], L = Math.max(0.1, Math.hypot(bx - ax, bz - az));
    let c0 = e._c0, c1 = e._c1; const c2 = e._c2;
    // the speed it wants: the corner coming up (or the one after it, across a short block), braking on a steady curve
    const brk = hot ? 6 : TRN.brake;
    let tgt = Math.min(want, cap);
    if (c1) { const d = c1.u1 - e.u; tgt = Math.min(tgt, d > 0 ? Math.sqrt(c1.v * c1.v + 2 * brk * d) : c1.v); }
    else if (c2) { const d = L - e.u + c2.u1; tgt = Math.min(tgt, Math.sqrt(c2.v * c2.v + 2 * brk * Math.max(0, d))); }
    if (c0 && e.u < c0.v2 && !(c1 && e.u >= c1.u1)) tgt = Math.min(tgt, c0.v);   // hold the corner speed until it's out of the arc
    const sp0 = e.sp, hard = cap < e.sp - 0.5;
    e.sp += clamp(tgt - e.sp, -(hard ? 9 : 4.5) * dt, (hot ? 9 : TRN.acc) * dt);
    e.brk = e.sp < sp0 - 0.6 * dt || (e.sp < 0.3 && tgt < 0.3);
    // along the line: through a corner the progress is stretched to the arc, so the car really does the speed it shows
    const sc = c1 && e.u >= c1.u1 ? c1.zone / c1.arc : c0 && e.u < c0.v2 ? c0.zone / c0.arc : 1;
    e.u += Math.max(0, e.sp) * dt * sc;
    if (e.u >= L) {
      const nb = e.nb != null ? e.nb : next(e); e.u -= L; e.pa = e.a; e.a = e.b; e.b = nb; e.nb = e.nb2; e.nb2 = null;
      e._c0 = c1 || null; e._c1 = e._c2 !== undefined && e.nb != null ? e._c2 : undefined; e._c2 = undefined; e._ab = e.a * 1e7 + e.b;
      if (e.a === e.b) { e.sp = 0; e.u = 0; e.nb = null; e._c1 = undefined; }
      look(); ax = g.nx[e.a]; az = g.nz[e.a]; bx = g.nx[e.b]; bz = g.nz[e.b]; L = Math.max(0.1, Math.hypot(bx - ax, bz - az)); c0 = e._c0; c1 = e._c1;
    }
    // where that puts it
    const u = Math.min(e.u, L), p = _trP;
    if (c1 && u >= c1.u1) trArc(c1, (u - c1.u1) / c1.zone, p);
    else if (c0 && u < c0.v2) trArc(c0, (c0.pre + u) / c0.zone, p);
    else { const gx = (bx - ax) / L, gz = (bz - az) / L; p.x = ax + gx * u - gz * lane; p.z = az + gz * u + gx * lane; p.dx = gx; p.dz = gz; }
    trPlace(e, p, dt);
    // the blinker: on for the next real turn from ~3 s out (30 m at least), through the arc, off once it's straight again
    let sig = 0;
    if (!hot) {
      const lead = Math.max(TRN.near, e.sp * TRN.lead);
      if (c1 && u >= c1.u1) sig = c1.sig ? c1.sg : 0;
      else if (c0 && u < c0.v2 && c0.sig) sig = c0.sg;
      else if (c1 && c1.sig && c1.u1 - u < lead) sig = c1.sg;
      else if (!c1 && e._c2 && e._c2.sig && L - u + e._c2.u1 < lead) sig = e._c2.sg;
    }
    e.sig = sig; e.sigT = performance.now() / 1000;
  }
  // a car somebody else is driving (their copy on the network): brake lights from the speed dropping
  function trRemote(e, sp, sig, dt) {
    if (e._rsp != null && sp < e._rsp - 0.05) e._rbt = 0.7; else e._rbt = Math.max(0, (e._rbt || 0) - dt);
    e._rsp = sp; e.brk = sp < 0.3 || e._rbt > 0; e.sig = sig || 0; e.sigT = performance.now() / 1000;
  }

  // ---------- the regulars' long loops: the same arcs, with the time each piece takes worked out once per loop ----------
  // straight pieces brake into and roll out of each corner; arcs are run at the corner speed. tt = the clock along the loop.
  function trTrack(R) {
    if (R.tk) return R.tk;
    const g = gpsGraph(), nd = R.nodes, N = nd.length, v = R.v, C = new Array(N).fill(null), VA = new Float32Array(N), LS = new Float32Array(N), TS = new Float32Array(N), T0 = new Float64Array(N);
    for (let i = 1; i < N - 1; i++) C[i] = trCorner(g, nd[i - 1], nd[i], nd[i + 1], 3.6, false);
    const segL = i => Math.max(0.1, Math.hypot(g.nx[nd[i + 1]] - g.nx[nd[i]], g.nz[nd[i + 1]] - g.nz[nd[i]]));
    for (let i = 0; i < N; i++) VA[i] = C[i] ? Math.min(v, C[i].v) : v;
    for (let i = 0; i < N - 1; i++) LS[i] = Math.max(0, (C[i + 1] ? C[i + 1].u1 : segL(i)) - (C[i] ? C[i].v2 : 0));
    for (let i = N - 2; i >= 0; i--) VA[i] = Math.min(VA[i], Math.sqrt(VA[i + 1] * VA[i + 1] + 2 * TRN.brake * LS[i]));
    for (let i = 0; i < N - 1; i++) VA[i + 1] = Math.min(VA[i + 1], Math.sqrt(VA[i] * VA[i] + 2 * TRN.acc * LS[i]));
    let t = 0;
    for (let i = 0; i < N - 1; i++) {
      T0[i] = t; let ts = 0; const Ls = LS[i];
      for (let k = 0; k < 6; k++) ts += Ls / 6 / trVel(v, VA[i], VA[i + 1], Ls, (k + 0.5) * Ls / 6);
      TS[i] = ts; t += ts + (C[i + 1] ? C[i + 1].arc / VA[i + 1] : 0);
    }
    T0[N - 1] = t;
    return R.tk = { C, VA, LS, TS, T0, Tl: Math.max(1, t) };
  }
  function trVel(v, v0, v1, Ls, x) { return Math.max(0.5, Math.min(v, Math.sqrt(v0 * v0 + 2 * TRN.acc * x), Math.sqrt(v1 * v1 + 2 * TRN.brake * Math.max(0, Ls - x)))); }
  // where regular n is at clock T: position, heading, speed, the block it's on (a, b, u) with the turns before and after, its blinker
  function trSched(R, T) {
    const K = trTrack(R), g = gpsGraph(), nd = R.nodes, N = nd.length, tt = (((T + R.ph / R.v) % K.Tl) + K.Tl) % K.Tl;
    let lo = 0, hi = N - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (K.T0[mid] <= tt) lo = mid; else hi = mid; }
    const i = lo, a = nd[i], b = nd[i + 1], ax = g.nx[a], az = g.nz[a], L = Math.max(0.1, Math.hypot(g.nx[b] - ax, g.nz[b] - az)), gx = (g.nx[b] - ax) / L, gz = (g.nz[b] - az) / L;
    const c0 = K.C[i], c1 = K.C[i + 1], Ls = K.LS[i], p = { x: 0, z: 0, dx: gx, dz: gz, yaw: 0, a, b, u: 0, v: R.v, cv: R.v, pa: i > 0 ? nd[i - 1] : null, nb: i + 2 < N ? nd[i + 2] : null, sig: 0 };
    let tau = tt - K.T0[i];
    if (tau < K.TS[i] || !c1) {
      // the straight: walk the six slices the time was worked out with
      let x = 0, sp = R.v; const dl = Ls / 6;
      for (let k = 0; k < 6; k++) { sp = trVel(R.v, K.VA[i], K.VA[i + 1], Ls, x + dl / 2); const st = dl / sp; if (tau <= st || k === 5) { x += Math.min(dl, tau * sp); break; } tau -= st; x += dl; }
      const u = (c0 ? c0.v2 : 0) + x; p.u = u; p.v = sp; p.x = ax + gx * u - gz * 3.6; p.z = az + gz * u + gx * 3.6;
      if (c1 && c1.sig && Ls - x < Math.max(TRN.near, sp * TRN.lead)) p.sig = c1.sg;
      else if (!c1 && i + 2 < N && K.C[i + 2] && K.C[i + 2].sig && L - u + K.C[i + 2].u1 < Math.max(TRN.near, sp * TRN.lead)) p.sig = K.C[i + 2].sg;
    } else {
      const f = clamp((tau - K.TS[i]) / Math.max(1e-3, c1.arc / K.VA[i + 1]), 0, 1); trArc(c1, f, p); p.v = K.VA[i + 1]; p.sig = c1.sig ? c1.sg : 0;
      let u = c1.u1 + f * c1.zone; if (u >= L && i + 2 < N) { u -= L; p.a = b; p.b = nd[i + 2]; p.pa = a; p.nb = i + 3 < N ? nd[i + 3] : null; } p.u = Math.min(u, L);
    }
    p.yaw = Math.atan2(-p.dx, -p.dz); return p;
  }

  // ---------- the lamps: hero cars blink their own signal lamps (sequential where they have them), everything else gets
  // small amber lamps at the four corners and red brake lamps, found on the real bumpers once per model and shared ----------
  const TRL = { amber: null, red: null, kit: new Map(), rc: null, keys: [['turnL', -1], ['turnR', 1]] };
  function trKit(m) {
    const id = (m.parent && m.parent.userData.carId) || m.uuid; if (TRL.kit.has(id)) return TRL.kit.get(id);
    let kit = null;
    try {
      m.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(m.matrixWorld).invert(), M = new THREE.Matrix4(), box = new THREE.Box3(), bb = new THREE.Box3(), meshes = [];
      m.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; const gg = o.geometry; if (!gg.boundingBox) gg.computeBoundingBox(); M.multiplyMatrices(inv, o.matrixWorld); bb.copy(gg.boundingBox).applyMatrix4(M); box.union(bb); meshes.push(o); });
      const W = box.max.x - box.min.x, H = box.max.y - box.min.y, cxm = (box.max.x + box.min.x) / 2;
      if (!box.isEmpty() && W > 1.2 && box.max.z - box.min.z > 2.6 && H > 0.7) {
        const rc = TRL.rc || (TRL.rc = new THREE.Raycaster()), O = new THREE.Vector3(), D = new THREE.Vector3();
        // the body surface at (x, y), looking in from the front (dir 1) or the back (dir -1), in the model's own frame
        const hit = (x, y, dir) => {
          O.set(x, y, dir > 0 ? box.min.z - 1 : box.max.z + 1).applyMatrix4(m.matrixWorld); D.set(0, 0, dir).transformDirection(m.matrixWorld);
          rc.set(O, D); rc.far = box.max.z - box.min.z + 2; const h = rc.intersectObjects(meshes, false)[0];
          if (!h) return dir > 0 ? box.min.z + 0.12 : box.max.z - 0.12;
          return h.point.applyMatrix4(inv).z - dir * 0.012;
        };
        const sx = W / 2 - Math.min(0.3, W * 0.14), yF = box.min.y + H * 0.46, yR = box.min.y + H * 0.56, bxr = W / 2 - 0.55, yB = box.min.y + H * 0.6;
        const side = s => [[cxm + s * sx, yF, hit(cxm + s * sx, yF, 1), 0.24, 0.1, 0.05], [cxm + s * sx, yR, hit(cxm + s * sx, yR, -1), 0.24, 0.13, 0.05]];
        kit = { L: trGeo(side(-1)), R: trGeo(side(1)), B: trGeo([-1, 1].map(s => [cxm + s * bxr, yB, hit(cxm + s * bxr, yB, -1), 0.26, 0.07, 0.05])) };
      }
    } catch (er) { console.warn('turn lamps: ' + er.message); kit = null; }
    TRL.kit.set(id, kit); return kit;
  }
  function trGeo(list) {
    const arrs = list.map(([x, y, z, w, h, d]) => { const b = new THREE.BoxGeometry(w, h, d).toNonIndexed(); b.translate(x, y, z); const a = b.attributes.position.array.slice(); b.dispose(); return a; });
    const P = new Float32Array(arrs.reduce((s, a) => s + a.length, 0)); let o = 0; for (const a of arrs) { P.set(a, o); o += a.length; }
    const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.BufferAttribute(P, 3)); G.computeBoundingSphere(); return G;
  }
  function trLampMake(m) {
    const kit = trKit(m); if (!kit) return m.userData.trM = null;
    TRL.amber = TRL.amber || new THREE.MeshBasicMaterial({ color: 0xffa21a, toneMapped: false });
    TRL.red = TRL.red || new THREE.MeshBasicMaterial({ color: 0xff1a12, toneMapped: false });
    const mk = (G, mat) => { const o = new THREE.Mesh(G, mat); o.visible = false; o.castShadow = o.receiveShadow = false; o.name = 'trLamp'; m.add(o); return o; };
    return m.userData.trM = { l: mk(kit.L, TRL.amber), r: mk(kit.R, TRL.amber), b: mk(kit.B, TRL.red) };
  }
  // light a car: sig -1 left / 1 right / 0, brk brake lamps, t seconds, ph its own blink phase
  function trLamps(m, sig, brk, t, ph) {
    if (!m) return; const U = m.userData, L = U.lamps, p = ((t + ph) % TRN.per + TRN.per) % TRN.per;
    if (L && L.turnL) {
      for (const [key, s] of TRL.keys) { const G = L[key]; if (!G) continue; const act = sig === s; for (let i = 0; i < G.length; i++) G[i].visible = act && (i === 0 ? p < TRN.on : p > (i - 1) * 0.11 && p < TRN.on + 0.05); }
      if (L.brake) for (const g of L.brake) g.visible = !!brk;
      return;
    }
    let M = U.trM; if (M === null) return;
    if (!M) { if (!sig && !brk) return; M = trLampMake(m); if (!M) return; }
    const on = p < TRN.on; M.l.visible = sig < 0 && on; M.r.visible = sig > 0 && on; M.b.visible = !!brk;
  }
  window.__turns = { TRN, TRL, trCorner, trArc, trDrive, trTrack, trSched, trLamps, trKit, graph: () => gpsGraph() };
  // ==== smooth turns (end) ====
