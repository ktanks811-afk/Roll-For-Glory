  // ---------- cash flex (Kimari 2026-11-27: "pull out money and depending on how much you got you can flex it all and take pictures") ----------
  // What comes out of your pocket is what's on you (S.cash), shaped like real money: a few loose bills, a rubber-banded knot,
  // $10,000 bands with the mustard strap, $100,000 bricks (ten bands, two black rubber bands) and past $1M a duffel bag full
  // of bricks. New money poses in the POSE menu and in photo mode: Show it, Double up, Fan face, Stack it up (a pile on the
  // ground in front of you that grows with your money), Bag it up. "Keep it out" holds your money in your hand while you walk.
  // Other players online see all of it: the pose, the right amount and the money in your hand.
  const FLX = { hold: false, hw: 0, hg: null, hkey: '', hph: 0, px: 0, pz: 0, sent: '', geo: null };
  const CASH_ICONS = { none: '🫥', bills: '💵', knot: '🧻', bands: '💴', bricks: '🧱', bag: '👜' };
  function cashTier(c) {
    c = Math.max(0, Math.floor(c || 0));
    if (c < 20) return { k: 'none', n: 0 };
    if (c < 1000) return { k: 'bills', n: Math.min(12, Math.floor(c / 100) + Math.floor(c % 100 / 20)) || 1 };
    if (c < 10000) return { k: 'knot', n: Math.floor(c / 100) };
    if (c < 100000) return { k: 'bands', n: Math.floor(c / 10000) };
    if (c < 1000000) return { k: 'bricks', n: Math.floor(c / 100000) };
    return { k: 'bag', n: Math.floor(c / 100000) };
  }
  function cashWords(c) {
    const T = cashTier(c), n = T.n;
    return T.k === 'none' ? 'Nothing to pull out. Withdraw cash at a bank.' : T.k === 'bills' ? `${n} loose bill${n > 1 ? 's' : ''}`
      : T.k === 'knot' ? `a ${money(Math.floor(c / 100) * 100)} knot` : T.k === 'bands' ? `${n} band${n > 1 ? 's' : ''} ($10k each)`
      : T.k === 'bricks' ? `${n} brick${n > 1 ? 's' : ''} ($100k each)` : `a duffel bag: ${n} bricks`;
  }
  // a $20 for the change (the $100s are BILL.mat)
  function bill20Tex() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 216; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 512, 216); g.addColorStop(0, '#dfe1cf'); g.addColorStop(0.5, '#e6d9c6'); g.addColorStop(1, '#d7dccb'); x.fillStyle = g; x.fillRect(0, 0, 512, 216);
    x.strokeStyle = 'rgba(90,100,70,0.16)'; for (let i = -216; i < 512; i += 7) { x.beginPath(); x.moveTo(i, 216); x.lineTo(i + 216, 0); x.stroke(); }
    x.strokeStyle = '#55684f'; x.lineWidth = 6; x.strokeRect(10, 10, 492, 196); x.lineWidth = 2; x.strokeRect(20, 20, 472, 176);
    x.fillStyle = '#c3c9b0'; x.beginPath(); x.ellipse(256, 108, 58, 72, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#55684f'; x.lineWidth = 4; x.stroke();
    x.fillStyle = '#5f6e58'; x.beginPath(); x.arc(256, 92, 24, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(256, 158, 42, 32, 0, Math.PI, 0); x.fill();
    x.fillStyle = '#34503a'; x.font = '900 52px Arial, sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillText('20', 34, 54); x.fillText('20', 34, 164); x.textAlign = 'right'; x.fillText('20', 480, 54); x.fillText('20', 480, 164);
    x.font = '700 16px Georgia, serif'; x.textAlign = 'center'; x.fillText('MURDA WORTH RESERVE NOTE', 256, 30); x.fillText('TWENTY', 256, 196);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; if ('encoding' in t) t.encoding = THREE.sRGBEncoding; return t;
  }
  // the end of a rolled knot: paper wound round and round
  function spiralTex() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#cfd8c3'; x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(60,80,60,0.55)'; x.lineWidth = 1.2; x.beginPath();
    for (let a = 0; a < Math.PI * 2 * 11; a += 0.08) { const r = 3 + a * 0.88; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.stroke();
    const t = new THREE.CanvasTexture(c); if ('encoding' in t) t.encoding = THREE.sRGBEncoding; return t;
  }
  function flexInit() {
    billInit(); if (FLX.geo) return;
    const keep = g => { g.userData.keep = true; return g; };
    FLX.geo = { band: keep(new THREE.BoxGeometry(0.156, 0.0115, 0.066)), strap: keep(new THREE.BoxGeometry(0.034, 0.0121, 0.0675)), unit: keep(new THREE.BoxGeometry(1, 1, 1)) };
    FLX.mat20 = new THREE.MeshStandardMaterial({ map: bill20Tex(), roughness: 0.82, side: THREE.DoubleSide });
    FLX.capMat = new THREE.MeshStandardMaterial({ map: spiralTex(), roughness: 0.9 });
    FLX.wrapMat = new THREE.MeshStandardMaterial({ map: BILL.tex, roughness: 0.78 });
    FLX.nylon = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.78, metalness: 0.05, side: THREE.DoubleSide });
    FLX.lining = new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.95, side: THREE.BackSide });
    FLX.zip = new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 0.35, metalness: 0.85 });
    FLX.web = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
  }
  // many bands in one go: an instanced mesh of bands, one of mustard straps, one of black rubber bands (3 draw calls for any amount)
  // b = [[x, y(bottom), z, ry], ...]; r = rubber bands [[x, y(centre), z, ry, sx, sy, sz], ...]
  const _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fp = new THREE.Vector3(), _fs = new THREE.Vector3(), _fe = new THREE.Euler(), _fy = new THREE.Vector3(0, 1, 0);
  function bandBlock(b, r) {
    const g = new THREE.Group();
    if (b.length) {
      const B = new THREE.InstancedMesh(FLX.geo.band, BILL.bandMats, b.length), St = new THREE.InstancedMesh(FLX.geo.strap, BILL.strap, b.length);
      b.forEach((s, i) => { _fq.setFromAxisAngle(_fy, s[3] || 0); _fm.compose(_fp.set(s[0], s[1] + 0.00575, s[2]), _fq, _fs.set(1, 1, 1)); B.setMatrixAt(i, _fm); St.setMatrixAt(i, _fm); });
      B.castShadow = St.castShadow = true; g.add(B, St);
    }
    if (r && r.length) {
      const R = new THREE.InstancedMesh(FLX.geo.unit, BILL.rubber, r.length);
      r.forEach((s, i) => { _fq.setFromAxisAngle(_fy, s[3] || 0); _fm.compose(_fp.set(s[0], s[1], s[2]), _fq, _fs.set(s[4], s[5], s[6])); R.setMatrixAt(i, _fm); });
      g.add(R);
    }
    return g;
  }
  // a $100,000 brick: ten bands, two side by side, five high, two black rubber bands round it. Origin: bottom centre
  const BRICK = { x: 0.156, z: 0.134, h: 0.0575 };
  function brickInto(b, r, x, y, z, ry) {
    const c = Math.cos(ry), s = Math.sin(ry), j = () => (Math.random() - 0.5) * 0.003;
    for (let l = 0; l < 5; l++) for (const dz of [-0.0335, 0.0335]) b.push([x + dz * s + j(), y + l * 0.0115, z + dz * c + j(), ry + (Math.random() - 0.5) * 0.02]);
    for (const dx of [-0.046, 0.046]) r.push([x + dx * c, y + BRICK.h / 2, z - dx * s, ry, 0.008, BRICK.h + 0.003, BRICK.z + 0.003]);
  }
  function makeBrickReal() { const b = [], r = []; brickInto(b, r, 0, 0, 0, 0); const g = bandBlock(b, r); g.userData.h = BRICK.h; return g; }
  // a stack of n bands (n <= 9), origin bottom centre
  function makeBands(n) { const b = []; for (let i = 0; i < n; i++) b.push([0, i * 0.0118, 0, (Math.random() - 0.5) * 0.06]); const g = bandBlock(b); g.userData.h = n * 0.0118; return g; }
  // a knot: the bills rolled up tight, a rubber band round the middle. Standing up, origin at its centre
  function makeKnot(n) {
    const r = clamp(Math.sqrt(n * 0.00011 * 0.156 / Math.PI) * 1.15, 0.01, 0.034);
    const g = new THREE.Group(), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.066, 22, 1), [FLX.wrapMat, FLX.capMat, FLX.capMat]); m.castShadow = true; g.add(m);
    const rb = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.0012, r + 0.0012, 0.0055, 22, 1, true), BILL.rubber); rb.position.y = 0.01; g.add(rb);
    g.userData.h = 0.066; g.userData.r = r; return g;
  }
  // a few loose bills, folded in half the long way and fanned a little: $100s and the $20s
  function makeBills(cash) {
    const h = Math.floor(cash / 100), t = Math.floor(cash % 100 / 20), n = clamp(h + t, 1, 12), f = makeFan(n);
    f.userData.bills.forEach((m, i) => { if (i < Math.min(t, n)) m.material = FLX.mat20; });
    f.userData.spread = 0.35 + n * 0.05; return f;
  }
  // a black duffel, unzipped on top, bricks showing. Length along x, origin bottom centre
  function makeDuffel(nb) {
    const g = new THREE.Group(), R = 0.165, L = 0.6, gap = 1.25, sy = 0.86;
    const bodyG = new THREE.CylinderGeometry(R, R, L, 22, 1, true, Math.PI / 2 + gap / 2, Math.PI * 2 - gap).rotateZ(Math.PI / 2).scale(1, sy, 1);
    const body = new THREE.Mesh(bodyG, FLX.nylon); body.position.y = R * sy; body.castShadow = true; g.add(body);
    const inner = new THREE.Mesh(bodyG, FLX.lining); inner.scale.setScalar(0.985); inner.position.y = R * sy; g.add(inner);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(R, 22), FLX.nylon); e.scale.y = sy; e.rotation.y = sx * Math.PI / 2; e.position.set(sx * L / 2, R * sy, 0); g.add(e); }
    // the zipper either side of the opening, the handles over it, a strap seam
    const zy = R * sy + Math.cos(gap / 2) * R * sy, zz = Math.sin(gap / 2) * R;
    for (const s of [-1, 1]) {
      const z = new THREE.Mesh(FLX.geo.unit, FLX.zip); z.scale.set(L * 0.96, 0.006, 0.012); z.position.set(0, zy, s * zz); g.add(z);
      const hd = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.009, 6, 14, Math.PI), FLX.web); hd.position.set(0, zy - 0.01, s * (zz + 0.01)); hd.rotation.x = s * 0.25; g.add(hd);
      const wb = new THREE.Mesh(FLX.geo.unit, FLX.web); wb.scale.set(0.035, R * sy * 1.6, 0.004); wb.position.set(s * 0.13, R * sy * 0.9, R + 0.002); g.add(wb);
      const wb2 = wb.clone(); wb2.position.z = -R - 0.002; g.add(wb2);
    }
    // bricks inside: the top layer shows through the zip, the last few sit up in the opening
    const b = [], r = [], cnt = clamp(nb, 1, 14), y0 = R * sy * 1.18; let k = 0;
    for (const z of [-0.07, 0.07]) for (const x of [-0.17, 0, 0.17]) if (k++ < cnt) brickInto(b, r, x, y0, z, (Math.random() - 0.5) * 0.12);
    if (cnt > 6) brickInto(b, r, -0.06, y0 + BRICK.h, 0.01, 0.35);
    if (cnt > 8) brickInto(b, r, 0.12, y0 + BRICK.h * 0.8, -0.02, -0.25);
    g.add(bandBlock(b, r));
    g.userData.h = R * sy * 2; return g;
  }
  // the pile on the ground (Stack it up): bands in short stacks, bricks in a pyramid, a bag beside it past $1M.
  // Origin: the ground at its front-centre, +z away from you (toward whoever's looking at you)
  function makePile(cash) {
    const T = cashTier(cash), b = [], r = [], g = new THREE.Group();
    if (T.k === 'bands') {
      const n = Math.min(9, T.n), cols = Math.ceil(n / 3);
      for (let i = 0; i < n; i++) { const c = i % cols, l = Math.floor(i / cols); b.push([(c - (cols - 1) / 2) * 0.17, l * 0.0118, 0.05, (Math.random() - 0.5) * 0.1]); }
    } else {
      // bricks: up to 150 shown ($15M); every one past that is in the bags
      let left = Math.min(150, T.n); const cols = clamp(Math.ceil(Math.cbrt(left) * 1.7), 1, 9), rows = clamp(Math.ceil(cols * 0.55), 1, 5);
      for (let l = 0; left > 0 && l < 12; l++) {
        const C = Math.max(1, cols - l), Rw = Math.max(1, rows - l);
        for (let j = 0; j < Rw && left > 0; j++) for (let i = 0; i < C && left > 0; i++, left--) brickInto(b, r, (i - (C - 1) / 2) * (BRICK.x + 0.004), l * BRICK.h, 0.08 + (j - (Rw - 1) / 2) * (BRICK.z + 0.004) + (rows - 1) / 2 * (BRICK.z + 0.004), (Math.random() - 0.5) * 0.05);
      }
      if (T.k === 'bag') {
        const bags = clamp(Math.ceil((T.n - 150) / 25), 1, 4);
        for (let i = 0; i < bags; i++) { const d = makeDuffel(Math.min(14, T.n)); d.position.set((i % 2 ? -1 : 1) * (cols * 0.08 + 0.42), Math.floor(i / 2) * 0.27, 0.12 + Math.floor(i / 2) * 0.05); d.rotation.y = (i % 2 ? 1 : -1) * 0.5; g.add(d); }
      }
    }
    g.add(bandBlock(b, r)); return g;
  }
  // what your hand holds for a tier ("show it" and "keep it out"); turned so the money's face looks out of the hand
  function makeHeld(cash, both) {
    const T = cashTier(cash);
    if (T.k === 'bills') { const f = makeBills(cash); setFan(f, 0.55); f.userData.kind = 'fan'; return f; }
    if (T.k === 'knot') { const k = makeKnot(T.n); k.userData.kind = 'knot'; return k; }
    if (T.k === 'bands') { const s = makeBands(clamp(both ? Math.ceil(T.n / 2) : T.n, 1, 5)); s.userData.kind = 'block'; return s; }
    const s = T.k === 'bag' && !both ? makeBrickReal() : makeBrickReal(); s.userData.kind = 'block'; return s;
  }

  // ---------- the new money poses ----------
  EMOTES.push(
    { id: 'show', name: 'Show it', icon: '✊🏾', cash: 1, flx: 1, min: 20 },
    { id: 'double', name: 'Double up', icon: '🙌🏾', cash: 1, flx: 1, min: 20000 },
    { id: 'fanface', name: 'Fan face', icon: '🪭', cash: 1, flx: 1, min: 1000 },
    { id: 'stack', name: 'Stack it up', icon: '🧱', cash: 1, flx: 1, min: 10000 },
    { id: 'bag', name: 'Bag it up', icon: '👜', cash: 1, flx: 1, min: 250000 },
  );
  const _emoBlockF = emoBlock;
  emoBlock = function (e) {
    const c = S.cash || 0;
    if (e.min && c < e.min) return c < 20 ? 'No cash on you. Withdraw some at a bank.' : `${e.name} needs ${money(e.min)} on you. You have ${money(c)}. Withdraw more at a bank.`;
    return _emoBlockF(e);
  };
  function flexProps(M, E, id, cash) {
    flexInit(); const P = E.P, T = cashTier(cash), two = (T.k === 'bands' && T.n >= 2) || (T.k !== 'bands' && T.n >= 2 && T.k !== 'knot' && T.k !== 'bills');
    if (id === 'show') { P.hR = makeHeld(cash, two); E.props.add(P.hR); if (two) { P.hL = makeHeld(cash, true); E.props.add(P.hL); } }
    if (id === 'double') { P.hR = makeHeld(cash, true); P.hL = makeHeld(cash, true); E.props.add(P.hR, P.hL); }
    if (id === 'fanface') { P.fan = makeFan(clamp(fanCount(cash), 14, 40)); E.props.add(P.fan); }
    if (id === 'stack') { P.ground = makePile(cash); P.ground.visible = false; scene.add(P.ground); }
    if (id === 'bag') { P.bag = makeDuffel(T.n); E.props.add(P.bag); }
  }
  // puts a held block / knot / fan at a hand point h, its face toward the camera (+z), tipped by a
  function placeHeld(o, h, side, a, shake) {
    const k = o.userData.kind;
    if (k === 'block') { o.position.set(h.x + side * 0.01, h.y - 0.02, h.z + 0.05); o.rotation.set(Math.PI / 2 - 0.28 + a, 0, side * 0.18 + shake); o.translateY(-(o.userData.h || 0) / 2); o.translateZ(0); }
    else if (k === 'knot') { o.position.set(h.x + side * 0.012, h.y + 0.04, h.z + 0.05); o.rotation.set(-0.25 + a, 0, side * 0.25 + shake); }
    else { o.position.set(h.x, h.y - 0.01, h.z + 0.04); o.rotation.set(-0.3 + a, 0, -side * 0.15 + shake); }
  }
  const _xa = new THREE.Vector3(), _xb = new THREE.Vector3(), _xc = new THREE.Vector3(), _xw = new THREE.Vector3();
  const XPOLE = { rWide: new THREE.Vector3(-1, -0.55, -0.25), lWide: new THREE.Vector3(1, -0.55, -0.25), rDn: new THREE.Vector3(-0.6, -0.2, -1), lDn: new THREE.Vector3(0.6, -0.2, -1), rHip: new THREE.Vector3(-1, 0.2, -0.8), lHip: new THREE.Vector3(0.8, 0.2, -1) };
  function flexAnim(M, E, e, t, w, bob, sp) {
    const P = E.P, id = E.id, F = { hL: null, hR: null, wL: w, wR: w, pL: null, pR: null };
    const r = smooth01(t / 0.45), shake = t > 0.5 ? Math.sin(t * 8) * 0.04 : 0;
    if (id === 'show') {
      // pull it out of the pocket and hold it up to the lens, a little shake on it
      const hr = F.hR = _xa.set(lerp(-0.2, P.hL ? -0.17 : -0.1, r), lerp(0.04, 0.46, r) + bob, lerp(0.1, 0.44, r)); F.pR = XPOLE.rDn;
      placeHeld(P.hR, hr, -1, (1 - r) * 0.6, shake);
      if (P.hL) { const hl = F.hL = _xb.set(lerp(0.2, 0.17, r), lerp(0.04, 0.46, r) - bob, lerp(0.1, 0.44, r)); F.pL = XPOLE.lDn; placeHeld(P.hL, hl, 1, (1 - r) * 0.6, -shake); }
      else { F.hL = _xb.set(0.2, 0.03, -0.02); F.pL = XPOLE.lHip; }
      if (M.head) M.head.rotation.z = 0.1 * w;
      if (t > 0.2 && !E.flick) { E.flick = 1; ESND.riffle(3, sp); }
    } else if (id === 'double') {
      // a stack in each hand, arms out wide
      const lift = 0.5 + Math.sin(t * 2.2) * 0.012;
      const hr = F.hR = _xa.set(lerp(-0.2, -0.44, r), lerp(0.05, lift, r), lerp(0.1, 0.22, r)), hl = F.hL = _xb.set(lerp(0.2, 0.44, r), lerp(0.05, lift, r), lerp(0.1, 0.22, r));
      F.pR = XPOLE.rWide; F.pL = XPOLE.lWide; placeHeld(P.hR, hr, -1, -0.15, shake); placeHeld(P.hL, hl, 1, -0.15, -shake);
      flexLean(M, -0.06 * w);
      if (t > 0.3 && !E.flick) { E.flick = 1; ESND.riffle(4, sp); }
    } else if (id === 'fanface') {
      // the fan opened right in front of your mouth, eyes over the top of it
      const open = smooth01((t - 0.3) / 0.6), hr = F.hR = _xa.set(-0.035, lerp(0.2, 0.5, r), lerp(0.2, 0.25, r)); F.pR = XPOLE.rDn;
      P.fan.position.set(hr.x + 0.01, hr.y + 0.005, hr.z + 0.035); P.fan.rotation.set(-0.12, 0, 0.04 + shake * 0.5); setFan(P.fan, open);
      F.hL = _xb.set(0.2, 0.03, -0.02); F.pL = XPOLE.lHip;
      if (M.head) M.head.rotation.z = -0.08 * w;
      const k = Math.floor(open * 8); if (k > (E.flick || 0) && open < 1) { E.flick = k; ESND.riffle(2, sp); }
    } else if (id === 'stack') {
      // the pile on the ground in front of you; you stand behind it with your hands out over it
      const G = P.ground; if (G) {
        M.upper.updateMatrixWorld(true); M.upper.getWorldPosition(_xw); _xc.set(0, 0, 1).transformDirection(M.upper.matrixWorld); _xc.y = 0; _xc.normalize();
        const fy = M.wrap ? M.wrap.getWorldPosition(_xb).y : _xw.y - 1;
        G.position.set(_xw.x + _xc.x * 0.34, fy, _xw.z + _xc.z * 0.34); G.rotation.y = Math.atan2(_xc.x, _xc.z); G.visible = E.w > 0.05 && (!M.wrap || M.wrap.visible);
        G.scale.setScalar(smooth01(t / 0.5) * 0.05 + 0.95);
      }
      const op = smooth01((t - 0.2) / 0.5);
      F.hR = _xa.set(lerp(-0.2, -0.44, op), lerp(0.05, 0.3, op) + bob, lerp(0.08, 0.3, op)); F.hL = _xb.set(lerp(0.2, 0.44, op), lerp(0.05, 0.3, op) - bob, lerp(0.08, 0.3, op));
      F.pR = XPOLE.rWide; F.pL = XPOLE.lWide;
      if (M.head) M.head.rotation.x = 0.06 * w;
      if (t > 0.3 && !E.flick) { E.flick = 1; ESND.riffle(5, sp); }
    } else if (id === 'bag') {
      // the duffel held up in front by both handles, tipped so the zip faces the lens
      const B = P.bag, hy = lerp(0.0, 0.2, r), hz = lerp(0.18, 0.33, r);
      B.position.set(0, hy - 0.27, hz + 0.02); B.rotation.set(lerp(0.1, 0.62, r), 0, Math.sin(t * 2) * 0.02);
      F.hR = _xa.set(-0.08, hy, hz); F.hL = _xb.set(0.08, hy, hz); F.pR = XPOLE.rDn; F.pL = XPOLE.lDn;
      flexLean(M, 0.05 * w);
      if (t > 0.25 && !E.flick) { E.flick = 1; ESND.toss(sp); }
    }
    return F;
  }
  const flexLean = (M, a) => { M.upper.rotation.x += a; };

  // ---------- keep it out: your money in your right hand while you walk around ----------
  function holdKey(cash) { const T = cashTier(cash); return T.k === 'bag' ? 'bag' : T.k + ':' + (T.k === 'bands' ? Math.min(5, T.n) : T.k === 'bills' ? T.n : T.k === 'knot' ? Math.round(Math.sqrt(T.n)) : 1); }
  function holdBuild(M, H, cash) {
    if (H.g) { if (H.g.parent) H.g.parent.remove(H.g); H.g.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && !o.geometry.userData.keep && o.geometry !== BILL.geo) o.geometry.dispose(); }); H.g = null; }
    H.key = ''; if (!M || cashTier(cash).k === 'none') return;
    flexInit(); H.key = holdKey(cash);
    H.g = H.key === 'bag' ? makeDuffel(cashTier(cash).n) : makeHeld(cash, false);
    if (H.key === 'bag') H.g.userData.kind = 'bag';
    M.upper.add(H.g); H.M = M;
  }
  // hand point for carrying, with the walk's arm swing (ph = stride phase, sw = how hard you're moving)
  function holdPose(M, H, w, ph, sw) {
    const g = H.g; if (!g) return;
    const s = Math.sin(ph) * sw;
    if (g.userData.kind === 'bag') {
      // a duffel hangs off your right hand by the handles, swinging a little
      const h = _xa.set(-0.25, 0.0 + Math.abs(s) * 0.01, 0.02 + s * 0.06);
      g.position.set(h.x - 0.01, h.y - 0.3, h.z); g.rotation.set(s * 0.18, Math.PI / 2, 0.06);
      armIK(M, 0, h, XPOLE.rHip, w);
    } else {
      // money in your fist down by your side, the face of it turned out
      const h = _xa.set(-0.235, 0.06 + Math.abs(s) * 0.02, 0.07 + s * 0.12);
      placeHeld(g, h, -1, -0.9 - s * 0.3, 0);
      armIK(M, 0, h, XPOLE.rHip, w);
    }
    g.visible = w > 0.02;
  }
  function holdToggle(on) {
    on = on == null ? !FLX.hold : on;
    if (on && cashTier(S.cash).k === 'none') { toast('No cash on you. Withdraw some at a bank.', 'bad'); on = false; }
    FLX.hold = on; if (on) { flexInit(); ESND.riffle(3); toast(`Pulled it out: ${cashWords(S.cash)}.`, 'good'); }
    if (EMO.menu) emoMenu(true);
  }
  function holdStep(dt) {
    const want = FLX.hold && foot.on && !inside && !creating && !EMO.id && !GUN.want && !(PM.poseW > 0) && ME && cashTier(S.cash).k !== 'none';
    if (FLX.hold && cashTier(S.cash).k === 'none') { FLX.hold = false; toast('Out of cash.', ''); }
    FLX.hw = clamp(FLX.hw + (want ? 1 : -1) * dt / 0.25, 0, 1);
    if (FLX.hw <= 0) { if (FLX.hg && FLX.hg.g) FLX.hg.g.visible = false; return; }
    const H = FLX.hg || (FLX.hg = { g: null, key: '', M: null });
    if (H.M !== ME || H.key !== holdKey(S.cash) || !H.g) holdBuild(ME, H, S.cash);
    const v = Math.hypot(foot.x - FLX.px, foot.z - FLX.pz) / Math.max(dt, 1e-3); FLX.px = foot.x; FLX.pz = foot.z;
    const sw = clamp(v / 4, 0, 1); FLX.hph += dt * (v > 0.2 ? 5 + v * 0.9 : 0);
    holdPose(ME, H, smooth01(FLX.hw), FLX.hph, sw);
  }

  // ---------- the POSE menu: what you've got, and Keep it out ----------
  { const st = document.createElement('style'); st.textContent = `
#em-menu .fx-hold { width: 100%; flex-direction: row !important; justify-content: center; gap: 8px !important; margin: 2px 0 8px; padding: 9px 4px !important; font-size: 13px !important; background: #1f3a26 !important; border-color: #5fbf73 !important; }
#em-menu .fx-hold.on { background: #5fbf73 !important; color: #0d1a10 !important; }
#em-menu .fx-tier { display: flex; align-items: center; gap: 8px; margin: 0 2px 6px; color: rgba(255,255,255,0.8); font: 600 12px var(--body); } #em-menu .fx-tier i { font-style: normal; font-size: 20px; }
#pm-poses .fx-hold { width: 100%; margin-bottom: 6px; }`; document.head.appendChild(st); }
  const _emoMenuFx = emoMenu;
  emoMenu = function (open) {
    _emoMenuFx(open); if (!EMO.menu) return;
    const m = gEl('em-menu'); if (!m) return;
    const sm = [...m.querySelectorAll('small')].find(x => x.previousElementSibling && /MONEY/.test(x.previousElementSibling.textContent));
    const T = cashTier(S.cash);
    if (sm) sm.outerHTML = `<div class="fx-tier"><i>${CASH_ICONS[T.k]}</i><span>${esc(cashWords(S.cash))}</span></div><button class="fx-hold ${FLX.hold ? 'on' : ''}" id="fx-hold">${FLX.hold ? '✋🏾 Put it up' : '💵 Keep it out'}</button>`;
    const hb = gEl('fx-hold'); if (hb) { hb.classList.toggle('off', T.k === 'none'); hb.onclick = () => holdToggle(); }
  };
  const _pmPosesFx = pmPoses;
  pmPoses = function (open) {
    _pmPosesFx(open); const m = pmE('pm-poses'); if (!m.classList.contains('open')) return;
    const h = [...m.querySelectorAll('h4')].find(x => /MONEY/.test(x.textContent)); if (!h) return;
    h.insertAdjacentHTML('afterend', `<small>${esc(money(S.cash || 0) + ' on you · ' + cashWords(S.cash))}</small><button class="fx-hold ${FLX.hold ? 'on' : ''}" id="pm-fx-hold">${FLX.hold ? '✋🏾 Put it up' : '💵 Keep it out'}</button>`);
    gEl('pm-fx-hold').onclick = () => { holdToggle(); pmPoses(true); };
  };
  pmE('pm-posebtn').onclick = () => pmPoses();

  // ---------- online: the pose, how much and the money in your hand ride on your state packets ----------
  // em = pose (EMOTES index + 1), ec = the cash on you (2 significant figures), eh = 1 while you keep it out
  const ec2 = c => { c = Math.max(0, Math.floor(c || 0)); if (c < 100) return c; const p = Math.pow(10, Math.floor(Math.log10(c)) - 1); return Math.floor(c / p) * p; };
  function flexPkt() {
    const live = foot.on && !inside, em = live && EMO.id && !EMO.stop ? EMOTES.findIndex(e => e.id === EMO.id) + 1 : 0, eh = live && FLX.hold && FLX.hw > 0.5 ? 1 : 0;
    return { em, eh, ec: em || eh ? ec2(S.cash) : 0 };
  }
  NET_HOOK.urgent.push(() => { const k = flexPkt(); return (k.em + ':' + k.eh + ':' + (k.em || k.eh ? holdKey(k.ec) : '')) !== FLX.sent; });
  NET_HOOK.state.push(() => { const k = flexPkt(); FLX.sent = k.em + ':' + k.eh + ':' + (k.em || k.eh ? holdKey(k.ec) : ''); return k.em || k.eh ? k : {}; });
  NET_HOOK.recv.push((p, m) => {
    if (m.k !== 's') return;
    const em = m.em | 0; p.em = em > 0 && em <= EMOTES.length ? em : 0; p.eh = m.eh ? 1 : 0; p.ec = nNum(m.ec, 0, 1e10, 0);
  });
  const _xs = new THREE.Vector3();
  NET_HOOK.draw.push((p, v, dt) => {
    const P = v.P; if (!P) return;
    const E = v.emo || (v.emo = { id: null, t: 0, w: 0, stop: false, P: null, props: null, flick: 0, M: null, ck: '' });
    const free = !p.inCar && !p.dead && P.wrap.visible;
    const want = free && p.em ? EMOTES[p.em - 1] : null, ck = holdKey(p.ec);
    _xs.set(p.x, (v.g ? v.g.position.y : 0) + 1.2, p.z);
    if (want && (E.id !== want.id || E.M !== P || E.ck !== ck)) {
      if (E.id && E.M === P && E.id === want.id) { emoDrop(E); emoProps(P, E, want.id, p.ec); E.ck = ck; }   // same pose, more or less money: swap the props in place
      else { emoDrop(E); E.id = want.id; E.t = 0; E.w = 0; E.stop = false; E.flick = 0; E.M = P; E.ck = ck; emoProps(P, E, want.id, p.ec); }
    }
    if (!want && E.id) E.stop = true;
    if (E.id) {
      E.t += dt; E.w = clamp(E.w + (E.stop ? -1 : 1) * dt / 0.3, 0, 1);
      if (E.stop && E.w <= 0) { emoDrop(E); E.id = null; }
      else emoAnim(P, E, dt, v.gun && v.gun.b, _xs);
    }
    // the money in their hand
    const H = v.hold || (v.hold = { g: null, key: '', M: null, w: 0, ph: 0, px: p.x, pz: p.z });
    const hw = free && p.eh && !E.id && !p.gd && !(v.pzW > 0) ? 1 : 0;
    H.w = clamp(H.w + (hw ? 1 : -1) * dt / 0.25, 0, 1);
    if (H.w <= 0) { if (H.g) H.g.visible = false; return; }
    if (H.M !== P || H.key !== ck || !H.g) holdBuild(P, H, p.ec);
    const sp = Math.hypot(p.x - H.px, p.z - H.pz) / Math.max(dt, 1e-3); H.px = p.x; H.pz = p.z; H.ph += dt * (sp > 0.2 ? 5 + sp * 0.9 : 0);
    holdPose(P, H, smooth01(H.w), H.ph, clamp(sp / 4, 0, 1));
  });
  NET_HOOK.kill.push(v => { if (v.emo) { emoDrop(v.emo); v.emo.id = null; } if (v.hold) holdBuild(null, v.hold, 0); });

  // ---------- hooks ----------
  const _stepFootFx = stepFoot;
  stepFoot = function (dt) { _stepFootFx(dt); if (S) holdStep(dt); };
  window.__flex = { FLX, cashTier, cashWords, makePile, makeDuffel, makeKnot, makeHeld, holdToggle, flexPkt, ec2, holdKey };
