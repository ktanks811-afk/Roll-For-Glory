  // ---------- wearing it: PEOPLE calls __jwHook while it builds a body with look.jw ----------
  // Each piece is built once per (piece, body shape, detail) as a template that is never drawn; every body gets its own
  // copy of the geometry, so PEOPLE.dispose frees it like the rest of the body. Metals and stones are shared materials.
  const JWH = { tpl: new Map(), r: null, watches: new Set(), rid: 0, gen: 0 };
  const jwRid = r => r.__jwId || (r.__jwId = ++JWH.rid);
  const jwSlot = sp => { const k = JW.kindOf(sp); return k === 'chain' ? 'neck' : k === 'watch' ? 'watch' : k; };
  const JW_SLOT_MAX = { neck: 3, watch: 1, bracelet: 2, ring: 2, studs: 1, grillz: 1 };
  function jwTpl(key, mk) {
    if (JWH.tpl.has(key)) { const v = JWH.tpl.get(key); JWH.tpl.delete(key); JWH.tpl.set(key, v); return v; }
    const p = mk(); JWH.tpl.set(key, p);
    while (JWH.tpl.size > 18) { const [k, old] = JWH.tpl.entries().next().value; JWH.tpl.delete(k); old.then(t => t && t.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (!o.material.userData.jwKeep) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } } })).catch(() => {}); }
    return p;
  }
  function jwCopy(t) {
    const g = t.clone(true);
    g.traverse(o => { if (o.isMesh) { o.geometry = o.geometry.clone(); if (!o.material.userData.jwKeep) { o.material = o.material.clone(); if (o.material.map) { o.material.map = o.material.map.clone(); o.material.map.needsUpdate = true; } } } });
    g.userData.jw = t.userData.jw; return g;
  }
  const jwSm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // a chain's path on this body: round the base of the neck, over the shoulders, down the chest by its length.
  // The shirt/torso is treated as a surface (the same rings PEOPLE builds it from), and every point of the chain is
  // pushed out until it rests on that surface by half the chain's thickness: on top of the collar at the back, on the
  // trapezius at the sides, flat on the chest at the front. Nothing sinks in, nothing floats.
  function jwBodyCurve(B, lay) {
    const top = B.ringAt(1.6), rx = top.rx + 0.004, rz = top.rz + 0.004, y0 = B.U(1.478);   // round the collar at the base of the neck
    const F = (x, y, z) => { const r = B.ringAt(y + 0.95), n = r.n || 2; return Math.pow(Math.pow(Math.abs(x) / r.rx, n) + Math.pow(Math.abs(z - r.zo) / r.rz, n), 1 / n); };
    const grad = (x, y, z) => { const e = 0.0015; return new THREE.Vector3(F(x + e, y, z) - F(x - e, y, z), F(x, y + e, z) - F(x, y - e, z), F(x, y, z + e) - F(x, y, z - e)).divideScalar(2 * e); };
    // sw: how much this point is lifted straight up instead of pushed out (the sides ride up onto the trapezius
    // next to the neck rather than sliding out across the shoulders)
    const UP = new THREE.Vector3(0, 1, 0);
    const push = (p, off, sw = 0) => {
      for (let k = 0; k < 12; k++) {
        const g = grad(p.x, p.y, p.z), gl = g.length() || 1, d = (F(p.x, p.y, p.z) - 1) / gl;
        if (d >= off - 0.0002) break;
        const gn = g.clone().divideScalar(gl), su = sw * Math.min(1, Math.max(0, gn.y * 2.5)), dir = gn.clone().multiplyScalar(1 - su).addScaledVector(UP, su).normalize();   // only lift where there's a slope to ride up
        p.addScaledVector(dir, (off - d) / Math.max(0.3, dir.dot(gn)));
      }
      return p;
    };
    const swOf = a => Math.pow(Math.sin(a), 2) * (1 - jwSm(-0.1, 0.55, Math.cos(a)));
    const front = (x, y) => { const r = B.ringAt(y + 0.95); return r.rz * B.seZ(x / (r.rx + 0.001), r.n) + r.zo; };
    const pt = (a, D, off) => {
      const ca = Math.cos(a), w = (1 + ca) / 2, x = Math.sin(a) * (rx + D * 0.16 * w), y = y0 - D * Math.pow(w, 2.2) - 0.006 * (1 - Math.abs(ca));
      let z = top.zo + ca * rz; if (ca > -0.2) z += (front(x, y) - z) * jwSm(-0.2, 0.35, ca);
      return push(new THREE.Vector3(x, y, z), off, swOf(a));
    };
    const mk = (D, off) => {
      let pts = []; for (let i = 0; i < 96; i++) pts.push(pt(Math.PI + i / 96 * Math.PI * 2, D, off));
      // a real chain hangs in smooth curves: relax the bumps the shoulders put in, then make sure it is still outside
      for (let k = 0; k < 4; k++) pts = pts.map((p, i) => p.clone().multiplyScalar(0.5).addScaledVector(pts[(i + 95) % 96], 0.25).addScaledVector(pts[(i + 1) % 96], 0.25));
      pts.forEach((p, i) => push(p, off, swOf(Math.PI + i / 96 * Math.PI * 2)));
      return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    };
    // h = half the chain's thickness (the build passes it)
    const curveFor = (L, h) => {
      const off = (h || 0.002) + lay + 0.0006;
      // the game's collar runs ~12% bigger round than a real neck base: scale so a 20" still lands at the collarbone
      L *= 1.12;
      let lo = 0, hi = 0.5; for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2; if (mk(m, off).getLength() < L) lo = m; else hi = m; }
      const c = mk((lo + hi) / 2, off); c.arcLengthDivisions = 1500;
      // the links lie flat on the body: their face follows the surface under them
      c.normalAt = (p, u) => {
        const w = (1 - Math.cos(u * Math.PI * 2)) / 2, soft = new THREE.Vector3(p.x, 0, p.z - top.zo).normalize().multiplyScalar(0.35 + 0.65 * w).add(new THREE.Vector3(0, 0.75 * (1 - w), 0)).normalize();
        const g = grad(p.x, p.y, p.z); return g.lengthSq() > 1e-9 ? g.normalize().multiplyScalar(0.55).addScaledVector(soft, 0.45).normalize() : soft;
      };
      return c;
    };
    return { curve: curveFor, chestFront: y => front(0, y) + lay + 0.001 };
  }
  function jwBodySig(B) { const r = y => { const q = B.ringAt(y); return [q.rx, q.rz, q.zo].map(v => v.toFixed(3)).join(','); }; return [B.neckR.rx.toFixed(3), B.neckR.rz.toFixed(3), B.inflate, r(1.45), r(1.35), r(1.25), r(1.15)].join('|'); }
  // where each slot goes on this body, and what it needs to fit
  function jwPlace(sp, idx, B, look) {
    const k = JW.kindOf(sp), V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const forearm = s => { const el = V3(s * 0.03, -0.285, -0.008), wr = V3(s * 0.042, -0.545, 0.024), d = wr.clone().sub(el); const a = d.clone().normalize(); return { wr: d, a, el }; };
    if (k === 'chain') { // stacked chains hang a little lower each, so a second chain layers under the first instead of on top of it
      const lay = idx * 0.0018, bc = jwBodyCurve(B, lay); const more = idx * 0.06; return { par: B.upper, C: { curve: (L, h) => bc.curve(L + more, h), chestFront: bc.chestFront }, sig: jwBodySig(B) + '|' + idx, put: g => {} }; }
    if (k === 'watch' || (k === 'bracelet')) {
      const s = k === 'watch' ? 1 : idx === 0 ? -1 : 1, F = forearm(s), rw = 0.027 * (B.Wl || 1);
      // with the arms hanging, the back of the wrist faces out (x = s) and the wrist is wider front-to-back than it is
      // thick: the body's forearm is round r at the wrist, stretched 1.22x along z (FOREARM's sq)
      const f = V3(s, 0, 0.08).normalize(); f.addScaledVector(F.a, -f.dot(F.a)).normalize();
      if (k === 'watch') {
        const up = B.sleeveLong ? 0.013 : 0.025, t = 1 - up / F.wr.length(), rr = rw + (0.036 * (B.Wl || 1) * 0.96 - rw) * (1 - Math.pow(t, 0.9)), sq = 1 + 0.22 * jwSm(0.4, 1, t);
        const C = { wrist: { A: rr * sq + 0.0014, B: rr + 0.0012 } };
        return { par: B.fores[s > 0 ? 1 : 0], C, sig: (rw * 1000).toFixed(1) + (B.sleeveLong ? 'L' : ''), put: g => {   // long sleeves end 3 cm above the wrist: the watch sits below the cuff
          const zc = g.userData.pillowZ, cen = F.wr.clone().addScaledVector(F.a, -up), y = new THREE.Vector3().crossVectors(f, F.a);
          g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(F.a, y, f)); g.position.copy(cen).addScaledVector(f, -zc);
        } };
      }
      const up = idx === 1 && B.hasWatch ? 0.06 : 0.012;
      return { par: B.fores[s > 0 ? 1 : 0], C: { wristR: rw * 1.3 }, sig: (rw * 1000).toFixed(1), put: g => {
        const xx = f.clone(), yy = new THREE.Vector3().crossVectors(F.a, xx); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xx, yy, F.a));
        g.position.copy(F.wr).addScaledVector(F.a, -up).addScaledVector(f, -rw * 0.12);
      } };
    }
    if (k === 'ring') {
      const s = -1, F = forearm(s), wrA = F.wr.clone().add(F.el), hp = [wrA.x + s * 0.004, wrA.y - 0.052, wrA.z + 0.004];
      const fs = B.fingers ? B.fingers(s, hp) : null, S = JW.full(sp), want = S.head === 'cluster' || S.head === 'signet' ? 3 : 2, fi = idx === 0 ? want : want === 3 ? 2 : 3;
      const seg = fs ? fs[fi].segs[0] : { a: [hp[0], hp[1] - 0.04, hp[2]], b: [hp[0] - s * 0.01, hp[1] - 0.07, hp[2]], r0: 0.009 };
      const a = V3(...seg.a).sub(F.el), b = V3(...seg.b).sub(F.el), d = b.clone().sub(a), len = d.length(); d.normalize();
      const bk = V3(s, 0, 0); bk.addScaledVector(d, -bk.dot(d)).normalize(); const zz = new THREE.Vector3().crossVectors(d, bk);
      const fr = (seg.r0 + ((seg.r1 || seg.r0) - seg.r0) * 0.42) * 1.05; /* the finger is 6% wider one way */ return { par: B.fores[0], C: { fingerR: fr }, sig: fr.toFixed(4) + fi, put: g => { g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(d, bk, zz)); g.position.copy(a).addScaledVector(d, len * 0.42); } };
    }
    if (k === 'studs') return { par: B.head, C: {}, sig: '', put: g => {
      for (const [nm, s] of [['EarringL', -1], ['EarringR', 1]]) { const e = g.getObjectByName(nm); if (e) { e.position.set(s * (B.HX + 0.0062), -0.026, -0.006); e.rotation.set(0, s * Math.PI / 2, 0); } }
    } };
    if (k === 'grillz') {
      if (B.hideLower) return null; const m = B.surf(0, -0.051);
      return { par: B.head, C: { biteGap: -0.0072 }, sig: '', put: g => { g.scale.set(1.1, 0.62, 1.15); g.position.set(0, -0.0508 + 0.0034, m[2] + 0.0011); } };   // front teeth just proud of the lip line, so the grill shows between closed lips
    }
    return null;
  }
  function jwTick() { if (!JWH.watches.size) return; const d = new Date(); for (const r of JWH.watches) { let o = r; while (o.parent) o = o.parent; if (!o.isScene) { if (!r.userData.seen || Date.now() - r.userData.seen > 60000) JWH.watches.delete(r); continue; } r.userData.seen = Date.now(); JW.setHands(r, d); } }
  setInterval(jwTick, 1000);
  window.__jwHook = (look, B) => {
    const list = Array.isArray(look.jw) ? look.jw : [], r = JWH.r || renderer, q = JWH.q != null ? JWH.q : B.lo ? 0 : 1, used = {}, jobs = [];
    B.hasWatch = list.some(sp => sp && sp.k === 'watch');
    for (const raw of list.slice(0, 10)) {
      const sp = JW.clean(raw); if (!sp) continue; const slot = jwSlot(sp), idx = used[slot] || 0; if (idx >= (JW_SLOT_MAX[slot] || 1)) continue; used[slot] = idx + 1;
      const P = jwPlace(sp, idx, B, look); if (!P || !P.par) continue;
      const key = [jwRid(r), q, JSON.stringify(JW.compact(sp)), P.sig, JW.isFontsReady() ? 1 : 0].join('#');
      const C = { q, r, ...P.C };
      jobs.push(jwTpl(key, () => JW.build(sp, C).then(t => { if (t.userData.pillow) t.userData.pillowZ = t.userData.pillow.zc; return t; })).then(t => {
        const g = jwCopy(t); g.userData.pillowZ = t.userData.pillowZ; g.name = 'jw:' + slot; P.put(g); P.par.add(g);
        if (slot === 'watch') { g.userData.live = t.userData.live; g.userData.chrono = t.userData.chrono; JW.setHands(g, new Date()); JWH.watches.add(g); }
        return g;
      }).catch(e => { console.warn('jewel', e); return null; }));
    }
    B.upper.userData.jwReady = Promise.all(jobs);
  };
  // your worn pieces (S.jewels by id in S.wear.jw), in the order you put them on
  const jwOwned = () => (S && Array.isArray(S.jewels)) ? S.jewels : [];
  const jwWornIds = () => (S && S.wear && Array.isArray(S.wear.jw)) ? S.wear.jw : [];
  const jwWorn = () => jwWornIds().map(id => jwOwned().find(j => j.id === id)).filter(Boolean);
  window.__jwLook = () => { const w = jwWorn(); return w.length ? { jw: w.map(j => JW.compact({ k: j.k, o: j.o })) } : {}; };
  window.__jwClean = arr => arr.slice(0, 10).map(JW.clean).filter(Boolean).map(JW.compact);
  function jwRedress() {
    try { dressAvatar(); } catch (e) {}
    try { const N = window.__net && window.__net.NET; if (N) N.helloT = 0; } catch (e) {}
  }
  function jwWear(id, on) {
    if (!S.wear) S.wear = {}; let w = jwWornIds().filter(x => x !== id && jwOwned().some(j => j.id === x));
    if (on) { const p = jwOwned().find(j => j.id === id); if (!p) return; const slot = jwSlot(p), same = w.filter(x => jwSlot(jwOwned().find(j => j.id === x)) === slot); if (same.length >= JW_SLOT_MAX[slot]) w = w.filter(x => x !== same[0]); w.push(id); }
    S.wear.jw = w; save(); jwRedress();
  }
  // fonts: when the pendant lettering fonts arrive, rebuild anybody wearing lettering
  JW.fontsP.then(() => { try { meKey = ''; dressAvatar(); const N = window.__net && window.__net.NET; if (N) for (const p of N.peers.values()) if (p.view) p.view.lookKey = ''; } catch (e) {} });
  { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,600;6..96,700&family=DM+Sans:wght@400;500;700&family=Pacifico&family=UnifrakturMaguntia&family=Archivo+Black&display=swap'; document.head.appendChild(l); }

  // ---------- the bench: the artifact's screen, in the game ----------
  const JB = { on: false, el: null, tab: 'chain', st: null, name: '', nameTouched: false, shop: null, r: null, scene: null, cam: null, ctl: null, item: null, disp: null, P: null, mode: 'display', buildId: 0, price: 0, info: null, raf: 0, sel: null, busy: false };
  const JB_CSS = `
  #jwb{position:fixed;inset:0;z-index:80;display:grid;grid-template-columns:minmax(0,1fr) min(400px,46vw);background:#110d0e;color:#f2ece6;font:15px/1.45 'DM Sans',system-ui,sans-serif;-webkit-user-select:none;user-select:none}
  #jwb[hidden]{display:none}
  #jwb button{text-transform:none;letter-spacing:0;cursor:pointer}
  #jwb .tabs{flex-wrap:nowrap;overflow-x:auto}#jwb .tab{flex:none}
  #jwb .st{position:relative;overflow:hidden;background:#2a0910;touch-action:none}
  #jwb .st canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
  #jwb .hint{position:absolute;top:10px;left:12px;color:#f3dfe2;opacity:.7;font-size:12px;pointer-events:none}
  #jwb .sb{position:absolute;top:8px;right:8px;display:flex;gap:6px}
  #jwb .sb button{min-height:38px;padding:0 13px;border-radius:999px;border:1px solid #ffffff40;background:#00000040;color:#fff;font:600 13px 'DM Sans',sans-serif}
  #jwb .sb .on{background:#e6bd55;color:#2a0910;border-color:#e6bd55}
  #jwb .busy{position:absolute;top:52px;right:12px;color:#f3dfe2;font-size:12px;opacity:0;transition:opacity .2s;pointer-events:none}#jwb .busy.on{opacity:.85}
  #jwb .tag{position:absolute;left:14px;bottom:14px;max-width:min(320px,calc(100% - 28px));background:#fbf8f2;color:#22161a;padding:10px 14px 9px 30px;border-radius:4px 14px 14px 4px;box-shadow:0 10px 30px #0006;transform:rotate(-2deg);pointer-events:none}
  #jwb .tag .hole{position:absolute;left:11px;top:50%;width:9px;height:9px;margin-top:-4px;border-radius:50%;background:#3d0d18}
  #jwb .tag b{display:block;font-size:12px;font-weight:500;line-height:1.3}#jwb .tag strong{display:block;font:700 28px/1.1 'Bodoni Moda',Georgia,serif;white-space:nowrap}#jwb .tag small{display:block;font-size:12px;color:#6b5a5e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #jwb aside{background:#1a1416;border-left:1px solid #2e2427;overflow:auto;-webkit-overflow-scrolling:touch;padding:10px 14px 24px}
  #jwb header{display:flex;align-items:center;gap:8px}#jwb h1{font:700 22px/1.05 'Bodoni Moda',Georgia,serif;margin:0;flex:1}
  #jwb .shop{color:#a8999b;font-size:12px;margin:2px 0 8px}
  #jwb .x{min-width:40px;min-height:40px;border-radius:999px;border:1px solid #2e2427;background:#241c1e;color:#fff;font-size:18px}
  #jwb .tabs{display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap}
  #jwb .tab{font:600 13px 'DM Sans',sans-serif;min-height:38px;padding:0 12px;border-radius:999px;border:1px solid #2e2427;background:#241c1e;color:#f2ece6}
  #jwb .tab.on{background:#e6bd55;color:#1a0b0f;border-color:#e6bd55}
  #jwb .presets{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:4px}
  #jwb .preset{flex:none;min-height:38px;padding:0 12px;border-radius:10px;border:1px dashed #e6bd55;background:transparent;color:#f2ece6;font:500 13px 'DM Sans',sans-serif;white-space:nowrap}
  #jwb .f{border:0;margin:0;padding:9px 0;border-bottom:1px solid #2e2427}
  #jwb .f .lg{display:flex;justify-content:space-between;width:100%;font-weight:700;font-size:13px;margin-bottom:6px}
  #jwb output{font-weight:500;color:#e6bd55}
  #jwb .chips{display:flex;flex-wrap:wrap;gap:5px}
  #jwb .chip{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 11px;border-radius:10px;border:1px solid #2e2427;background:#241c1e;color:#f2ece6;font:500 13px 'DM Sans',sans-serif}
  #jwb .chip i{width:14px;height:14px;border-radius:50%;box-shadow:inset 0 0 0 1px #0003}
  #jwb .chip.on{background:#e6bd55;color:#1a0b0f;border-color:#e6bd55}
  #jwb input[type=text]{width:100%;box-sizing:border-box;font:16px 'DM Sans',sans-serif;min-height:40px;padding:6px 10px;border-radius:10px;border:1px solid #2e2427;background:#241c1e;color:#f2ece6;-webkit-user-select:text;user-select:text}
  #jwb input[type=range]{width:100%;height:36px;accent-color:#e6bd55;margin:0}
  #jwb .tog{display:flex;align-items:center;justify-content:space-between;min-height:44px;font-weight:700;font-size:13px}
  #jwb .tog input{width:22px;height:22px;accent-color:#e6bd55}
  #jwb .out{padding-top:12px}#jwb .out label{font-weight:700;font-size:13px}
  #jwb .btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  #jwb .pri{flex:1 1 100%;min-height:48px;border:0;border-radius:12px;background:#e6bd55;color:#1a0b0f;font:700 16px 'DM Sans',sans-serif}
  #jwb .pri:disabled{opacity:.5}
  #jwb .gh{flex:1 1 auto;min-height:42px;border-radius:12px;border:1px solid #2e2427;background:transparent;color:#f2ece6;font:600 14px 'DM Sans',sans-serif}
  #jwb .note{font-size:12px;color:#a8999b;margin:8px 0 0}
  #jwb .mine{list-style:none;margin:6px 0;padding:0}
  #jwb .mine li{display:flex;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid #2e2427}
  #jwb .mine li span{flex:1;display:flex;flex-direction:column;min-width:0}
  #jwb .mine li b{font-weight:500;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #jwb .mine li small{color:#e6bd55;font-weight:700;font-size:12px}
  #jwb .mine li.sel{background:#2a1a1e}
  #jwb .mine button{min-height:38px;padding:0 10px;border-radius:10px;border:1px solid #2e2427;background:#241c1e;color:#f2ece6;font:600 12px 'DM Sans',sans-serif}
  #jwb .mine button.wear{background:#e6bd55;color:#1a0b0f;border-color:#e6bd55}
  @media (max-width:700px) and (orientation:portrait){#jwb{grid-template-columns:1fr;grid-template-rows:48vh 1fr}#jwb aside{border-left:0}}
  `;
  const jbEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function jbDom() {
    if (JB.el) return JB.el;
    const st = document.createElement('style'); st.textContent = JB_CSS; document.head.appendChild(st);
    const el = JB.el = document.createElement('div'); el.id = 'jwb'; el.hidden = true;
    el.innerHTML = `<section class="st"><div class="hint">Drag to turn · pinch to zoom</div><div class="sb"><button id="jwb-me" type="button">On me</button><button id="jwb-reset" type="button">Reset</button></div><div class="busy" id="jwb-busy">Setting stones…</div>
      <div class="tag"><span class="hole"></span><b id="jwb-tn">…</b><strong id="jwb-tp">$0</strong><small id="jwb-tm"></small></div></section>
      <aside><header><h1>Jeweler's Bench</h1><button class="x" id="jwb-x" type="button" aria-label="Close">✕</button></header><div class="shop" id="jwb-shop"></div>
      <div class="tabs" id="jwb-tabs"><button class="tab" data-t="chain">Chains</button><button class="tab" data-t="watch">Watches</button><button class="tab" data-t="more">Rings &amp; more</button><button class="tab" data-t="mine">My jewelry</button></div>
      <div id="jwb-design"><div class="presets" id="jwb-presets"></div><div id="jwb-ctl"></div>
      <div class="out"><label for="jwb-name">Name it</label><input type="text" id="jwb-name" maxlength="48" autocomplete="off" spellcheck="false"><div class="btns"><button class="pri" id="jwb-buy" type="button">Buy</button></div><p class="note" id="jwb-pay"></p></div></div>
      <div id="jwb-minep"><ul class="mine" id="jwb-mine"></ul><p class="note" id="jwb-minenote"></p></div>
      <p class="note" id="jwb-status" role="status"></p></aside>`;
    document.body.appendChild(el);
    const $j = id => el.querySelector('#' + id);
    el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') jbClose(); });
    el.addEventListener('keyup', e => e.stopPropagation());
    $j('jwb-x').onclick = jbClose;
    $j('jwb-reset').onclick = () => jbFit(true);
    $j('jwb-me').onclick = () => { JB.mode = JB.mode === 'me' ? 'display' : 'me'; jbBuild(true); };
    $j('jwb-tabs').onclick = e => { const b = e.target.closest('.tab'); if (!b || (JB.shopOnlyMine && b.dataset.t !== 'mine')) return; JB.tab = b.dataset.t; JB.nameTouched = false; if (JB.tab === 'mine') JB.sel = JB.sel || (jwWorn()[0] || jwOwned()[0] || {}).id || null; jbRender(); jbBuild(true); };
    $j('jwb-presets').onclick = e => { const b = e.target.closest('.preset'); if (!b) return; JB.st[JB.tab] = { ...JW.DEF[JB.tab], ...JW.PRESETS[JB.tab][+b.dataset.p][1] }; JB.nameTouched = false; jbRender(); jbBuild(true); };
    const ctl = $j('jwb-ctl');
    ctl.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; JB.st[JB.tab][b.dataset.k] = b.dataset.v; jbRender(); jbQueue(); });
    ctl.addEventListener('input', e => { const t = e.target; if (t.type === 'range') { JB.st[JB.tab][t.dataset.k] = +t.value; const o = el.querySelector('#jwo-' + t.dataset.k); if (o) o.textContent = t.value + ' ' + t.dataset.u; jbQueue(); } else if (t.type === 'text') { JB.st[JB.tab][t.dataset.k] = t.value; jbQueue(400); } });
    ctl.addEventListener('change', e => { const t = e.target; if (t.type !== 'checkbox') return; JB.st[JB.tab][t.dataset.k] = t.checked; jbRender(); jbQueue(); });
    $j('jwb-name').addEventListener('input', () => { JB.nameTouched = true; JB.name = $j('jwb-name').value; jbTag(); });
    $j('jwb-buy').onclick = jbBuy;
    $j('jwb-mine').onclick = e => {
      const b = e.target.closest('button'), li = e.target.closest('li[data-id]'); if (!li) return; const id = li.dataset.id;
      if (b && b.dataset.a === 'wear') { const on = !jwWornIds().includes(id); jwWear(id, on); const p = jwOwned().find(j => j.id === id); jbStatus(on ? `Wearing ${p.name}.` : `Took off ${p.name}.`); }
      else if (b && b.dataset.a === 'sell') { jbSell(id); return; }
      JB.sel = id; jbRender(); jbBuild(true);
    };
    return el;
  }
  const jbStatus = t => { if (JB.el) JB.el.querySelector('#jwb-status').textContent = t || ''; };
  function jbField(f, v, S) {
    const label = f.lab ? f.lab(S) : f.label;
    if (f.type === 'chips') return `<div class="f"><div class="lg">${label}</div><div class="chips">${f.opts.map(([k, l, c]) => `<button type="button" class="chip${k === v ? ' on' : ''}" data-k="${f.id}" data-v="${k}">${c ? `<i style="background:${c}"></i>` : ''}${l}</button>`).join('')}</div></div>`;
    if (f.type === 'range') return `<div class="f"><div class="lg"><span>${label}</span><output id="jwo-${f.id}">${v} ${f.unit}</output></div><input type="range" data-k="${f.id}" data-u="${f.unit}" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}"></div>`;
    if (f.type === 'text') return `<div class="f"><div class="lg">${label}</div><input type="text" data-k="${f.id}" maxlength="${f.max}" value="${jbEsc(v || '')}" autocomplete="off" spellcheck="false"></div>`;
    return `<label class="f tog"><span>${label}</span><input type="checkbox" data-k="${f.id}" ${v ? 'checked' : ''}></label>`;
  }
  const jbRate = () => JB.shop ? JB.shop.rate : 1;
  const jbPrice = p => Math.round(p * jbRate() / 5) * 5;
  function jbRender() {
    const el = JB.el, $j = id => el.querySelector('#' + id), mine = JB.tab === 'mine';
    el.querySelectorAll('.tab').forEach(b => { b.classList.toggle('on', b.dataset.t === JB.tab); b.hidden = JB.shopOnlyMine && b.dataset.t !== 'mine'; });
    $j('jwb-shop').textContent = JB.shop ? `${JB.shop.name}${JB.shop.rate !== 1 ? ` · prices ${JB.shop.rate < 1 ? Math.round((1 - JB.shop.rate) * 100) + '% under' : Math.round((JB.shop.rate - 1) * 100) + '% over'} the bench` : ''}` : 'Your jewelry. Design and buy new pieces at a jeweler.';
    $j('jwb-design').hidden = mine; $j('jwb-minep').hidden = !mine;
    $j('jwb-me').classList.toggle('on', JB.mode === 'me'); $j('jwb-me').textContent = JB.mode === 'me' ? 'On the velvet' : 'On me';
    if (!mine) {
      const S = JB.st[JB.tab];
      $j('jwb-ctl').innerHTML = JW.SCHEMA[JB.tab].filter(f => !f.show || f.show(S)).map(f => jbField(f, S[f.id], S)).join('');
      $j('jwb-presets').innerHTML = JW.PRESETS[JB.tab].map(([n], i) => `<button type="button" class="preset" data-p="${i}">${jbEsc(n)}</button>`).join('');
      if (!JB.nameTouched) JB.name = JW.autoName({ k: JB.tab, o: S });
      $j('jwb-name').value = JB.name;
    } else {
      const own = jwOwned(), worn = jwWornIds();
      $j('jwb-mine').innerHTML = own.length ? own.map(j => `<li data-id="${j.id}" class="${j.id === JB.sel ? 'sel' : ''}"><span><b>${jbEsc(j.name)}</b><small>${money(j.price)}${worn.includes(j.id) ? ' · wearing' : ''}</small></span><button type="button" data-a="wear" class="${worn.includes(j.id) ? '' : 'wear'}">${worn.includes(j.id) ? 'Take off' : 'Wear'}</button>${JB.shop ? `<button type="button" data-a="sell">Sell ${money(Math.round(j.price * 0.4))}</button>` : ''}</li>`).join('')
        : '<li><span><b>Nothing yet.</b><small>Design a piece on the other tabs</small></span></li>';
      $j('jwb-minenote').textContent = `Wear up to 3 chains, a watch, 2 bracelets, 2 rings, earrings and grillz at once. Everybody online sees what you wear.${JB.shop ? ' The jeweler buys pieces back at 40%.' : ''}`;
    }
    jbTag();
  }
  function jbTag() {
    const el = JB.el; if (!el) return; const $j = id => el.querySelector('#' + id), I = JB.info;
    const mine = JB.tab === 'mine', p = mine ? jwOwned().find(j => j.id === JB.sel) : null;
    $j('jwb-tn').textContent = mine ? (p ? p.name : 'My jewelry') : (JB.name || 'Untitled piece');
    $j('jwb-tp').textContent = mine ? (p ? money(p.price) : '') : money(JB.price);
    $j('jwb-tm').textContent = I ? `${I.grams.toFixed(1)} g${I.st.gems ? ` · ${I.st.ct.toFixed(2)} ct · ${I.st.gems} stones` : ''}` : '';
    if (!mine) {
      const v = JB.price, buy = $j('jwb-buy'), can = S.cash >= v || (S.bank || 0) >= v;
      buy.textContent = JB.busy ? 'Setting stones…' : `Buy & wear · ${money(v)}`; buy.disabled = JB.busy || !can;
      $j('jwb-pay').textContent = `Cash on you ${money(S.cash)} · bank ${money(S.bank || 0)}. Cash first; if it's short, it goes on your bank card.`;
    }
  }
  let jbT = 0; const jbQueue = (ms = 80) => { clearTimeout(jbT); jbT = setTimeout(() => jbBuild(false), ms); };
  function jbSetup() {
    if (JB.r) return true;
    try {
      const st = JB.el.querySelector('.st'), r = JB.r = new THREE.WebGLRenderer({ antialias: true });
      r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; st.prepend(r.domElement);
      const sc = JB.scene = new THREE.Scene();
      const vc = document.createElement('canvas'); vc.width = vc.height = 512; const x = vc.getContext('2d'), g = x.createRadialGradient(256, 200, 10, 256, 256, 380); g.addColorStop(0, '#74203a'); g.addColorStop(0.45, '#3e0d19'); g.addColorStop(1, '#120407'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
      JB.velvetBg = new THREE.CanvasTexture(vc); JB.velvetBg.encoding = THREE.sRGBEncoding;
      const cc = document.createElement('canvas'); cc.width = cc.height = 256; const y = cc.getContext('2d'), gg = y.createLinearGradient(0, 0, 0, 256); gg.addColorStop(0, '#3a4250'); gg.addColorStop(0.6, '#1a1d23'); gg.addColorStop(1, '#0c0d10'); y.fillStyle = gg; y.fillRect(0, 0, 256, 256);
      JB.charBg = new THREE.CanvasTexture(cc); JB.charBg.encoding = THREE.sRGBEncoding;
      const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.07, 0.05, 0.05), side: THREE.BackSide })));
      const panel = (w, h, px, py, pz, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i * 0.97, i * 0.92), side: THREE.DoubleSide })); m.position.set(px, py, pz); m.lookAt(0, 0, 0); es.add(m); };
      panel(5, 1.6, 0, 4.6, 1, 9); panel(1.4, 3.5, -4.6, 1, 2, 5); panel(1.4, 3, 4.6, 0.5, 2.5, 4); panel(7, 0.5, 0, -1.5, 4.6, 3); panel(1, 4, 3, 2, -4.6, 7); panel(3, 0.8, -2, -4.6, -1, 1.5); panel(0.4, 3, -2.5, 3, 4, 6);
      const pm = new THREE.PMREMGenerator(r); JB.env = pm.fromScene(es, 0.02).texture; pm.dispose(); es.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      sc.environment = JB.env; sc.background = JB.velvetBg;
      const key = JB.key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(0.5, 1, 0.8); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0002; key.shadow.normalBias = 0.0004; sc.add(key, key.target);
      const fill = new THREE.DirectionalLight(0xffe8d0, 0.8); fill.position.set(-1, -0.3, 0.6); sc.add(fill);
      JB.hemi = new THREE.HemisphereLight(0xfff4e8, 0x302624, 0.5); sc.add(JB.hemi);
      JB.cam = new THREE.PerspectiveCamera(30, 1, 0.001, 50);
      const ctl = JB.ctl = new THREE.OrbitControls(JB.cam, r.domElement); ctl.enableDamping = true; ctl.minDistance = 0.01; ctl.maxDistance = 8; ctl.autoRotate = true; ctl.autoRotateSpeed = 0.9;
      ctl.addEventListener('start', () => { ctl.autoRotate = false; });
      JB.velvet = new THREE.MeshStandardMaterial({ color: jbLin('#3a0c17'), roughness: 0.95 }); JB.disp = new THREE.Group(); sc.add(JB.disp);
      JB.floor = new THREE.Mesh(new THREE.CircleGeometry(3, 48), new THREE.MeshStandardMaterial({ color: jbLin('#2b2b2e'), roughness: 0.85 })); JB.floor.rotation.x = -Math.PI / 2; JB.floor.receiveShadow = true; sc.add(JB.floor);
      return true;
    } catch (e) { console.warn('bench renderer', e); JB.r = null; return false; }
  }
  const jbLin = h => new THREE.Color(h).convertSRGBToLinear();
  function jbFree() {
    cancelAnimationFrame(JB.raf); JB.raf = 0;
    if (JB.P) { JB.scene.remove(JB.P.root); try { PEOPLE.dispose(JB.P); } catch (e) {} JB.P = null; }
    if (JB.item) { jbDispose(JB.item); JB.item = null; }
    if (JB.r) {
      try { JB.ctl.dispose(); } catch (e) {}
      JB.scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (!o.material.userData.jwKeep) o.material.dispose(); } });
      JB.env.dispose(); JB.velvetBg.dispose(); JB.charBg.dispose();
      const rid = JB.r.__jwId; for (const [k, v] of [...JWH.tpl]) if (k.startsWith(rid + '#')) { JWH.tpl.delete(k); v.then(t => t && jbDispose(t)).catch(() => {}); }
      JW.dropRenderer(JB.r); JB.r.dispose(); try { JB.r.forceContextLoss(); } catch (e) {} JB.r.domElement.remove(); JB.r = null;
    }
  }
  function jbDispose(g) { if (g.parent) g.parent.remove(g); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (!o.material.userData.jwKeep) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } } }); }
  function jbResize() { if (!JB.r) return; const st = JB.el.querySelector('.st'), w = st.clientWidth || 400, h = st.clientHeight || 300; JB.r.setSize(w, h, false); JB.cam.aspect = w / h; JB.cam.updateProjectionMatrix(); }
  function jbLoop() {
    if (!JB.on || !JB.r) return; JB.raf = requestAnimationFrame(jbLoop);
    const now = performance.now(); if (now - (JB.ht || 0) > 500) { JB.ht = now; JB.scene.traverse(o => { if (o.name === 'jw:watch' || (o.userData.jw && o.userData.jw.kind === 'watch')) JW.setHands(o, new Date()); }); }
    JB.ctl.update(); JB.r.render(JB.scene, JB.cam);
  }
  // what the bench is showing: the piece you're designing, or the one you picked under My jewelry
  function jbSpec() { if (JB.tab === 'mine') { const p = jwOwned().find(j => j.id === JB.sel); return p ? { k: p.k, o: { ...JW.DEF[p.k], ...p.o } } : null; } return { k: JB.tab, o: { ...JB.st[JB.tab] } }; }
  async function jbBuild(refit) {
    if (!JB.on || !JB.r) return; const id = ++JB.buildId, sp = jbSpec();
    JB.busy = true; JB.el.querySelector('#jwb-busy').classList.add('on'); jbTag();
    let item = null, P = null;
    try {
      if (sp) {
        // always price it from the full-detail piece on the velvet
        item = await JW.build(sp, { q: 2, r: JB.r });
        if (JB.mode === 'me') {
          const slot = jwSlot(sp), others = jwWorn().filter(j => jwSlot(j) !== slot).map(j => JW.compact({ k: j.k, o: j.o }));
          JWH.r = JB.r; JWH.q = 2; try { P = PEOPLE.build({ ...myLook(), jw: [JW.compact(sp), ...others] }, 0); } finally { JWH.r = null; JWH.q = null; }
          await (P.upper.userData.jwReady || Promise.resolve());
        }
      }
    } catch (e) { console.warn('bench build', e); jbStatus('Something went wrong building that piece: ' + e.message); }
    if (id !== JB.buildId || !JB.on) { if (item) jbDispose(item); if (P) PEOPLE.dispose(P); return; }
    if (JB.item) jbDispose(JB.item); if (JB.P) { JB.scene.remove(JB.P.root); PEOPLE.dispose(JB.P); JB.P = null; }
    JB.disp.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); JB.disp.clear();
    JB.item = item; JB.info = item ? item.userData.jw : null; JB.price = item ? jbPrice(item.userData.jw.price) : 0;
    if (JB.mode === 'me' && P) {
      JB.P = P; P.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); JB.scene.add(P.root); P.root.updateMatrixWorld(true);
      JB.scene.background = JB.charBg; JB.floor.visible = true; JB.hemi.intensity = 0.9;
    } else if (item) {
      JB.scene.add(item); JB.scene.background = JB.velvetBg; JB.floor.visible = false; JB.hemi.intensity = 0.25; jbDisplay(item, sp);
    }
    JB.busy = false; JB.el.querySelector('#jwb-busy').classList.remove('on'); jbTag();
    jbFit(refit);
  }
  // the velvet under it, like the artifact's tray
  function jbDisplay(item, sp) {
    const b = new THREE.Box3().setFromObject(item); if (b.isEmpty()) return; const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()), R = Math.max(sz.x, sz.y, sz.z), kind = JW.kindOf(sp);
    const plane = w => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), JB.velvet); m.receiveShadow = true; return m; };
    if (kind === 'chain' || kind === 'studs') { const m = plane(R * 9); m.position.set(c.x, c.y, kind === 'studs' ? -0.0035 : b.min.z - Math.max(0.0015, R * 0.008)); JB.disp.add(m); }
    else { const m = plane(R * 12); m.rotation.x = -Math.PI / 2; m.position.set(c.x, b.min.y - 0.0001, c.z); JB.disp.add(m); }
    item.traverse(o => { if (o.isMesh) o.castShadow = o.name !== 'Crystal'; });
  }
  function jbFocusBox() {
    if (JB.mode === 'me' && JB.P) { const b = new THREE.Box3(); JB.P.root.traverse(o => { if (o.name && o.name.startsWith('jw:') && o.name === 'jw:' + jwSlot(jbSpec() || { k: 'chain' })) b.expandByObject(o); }); if (!b.isEmpty()) return b; return new THREE.Box3().setFromObject(JB.P.root); }
    return JB.item ? new THREE.Box3().setFromObject(JB.item) : null;
  }
  function jbFit(full) {
    if (!JB.r) return; const b = jbFocusBox(); if (!b || b.isEmpty()) return; const s = b.getBoundingSphere(new THREE.Sphere()); if (!isFinite(s.radius) || s.radius <= 0) return;
    const sp = jbSpec(), kind = sp ? JW.kindOf(sp) : 'chain', me = JB.mode === 'me' && JB.P;
    let dir; if (me) { const side = { watch: [0.9, 0.25, 0.8], bracelet: [-0.9, 0.2, 0.8], ring: [-0.8, 0.15, 0.8], studs: [0.9, 0.1, 0.5], grillz: [0.15, 0.05, 1] }[kind] || [0.25, 0.12, 1]; dir = new THREE.Vector3(...side).normalize(); }
    else dir = (full ? (kind === 'chain' ? new THREE.Vector3(0.16, 0.06, 1) : kind === 'watch' ? new THREE.Vector3(0.42, 0.22, 1) : { ring: new THREE.Vector3(0.45, 0.75, 1), bracelet: new THREE.Vector3(0.12, 1.1, 0.8), studs: new THREE.Vector3(0.15, 0.12, 1), grillz: new THREE.Vector3(0.3, 0.08, 1) }[kind]) : JB.cam.position.clone().sub(JB.ctl.target)).normalize();
    const asp = Math.min(1, JB.cam.aspect), rr = me ? Math.max(s.radius * 1.6, kind === 'chain' ? 0.12 : 0.06) : s.radius, d = rr / Math.sin(THREE.MathUtils.degToRad(JB.cam.fov / 2)) / asp * 1.02;
    JB.ctl.target.copy(s.center); JB.cam.position.copy(s.center).addScaledVector(dir, d); JB.cam.near = d / 300; JB.cam.far = d * 40; JB.cam.updateProjectionMatrix();
    const sc = JB.key.shadow.camera, r = (me ? 0.5 : s.radius * 1.5); JB.key.position.copy(s.center).add(new THREE.Vector3(0.5, 1, 0.8).normalize().multiplyScalar(r * 4)); JB.key.target.position.copy(s.center); sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = r * 0.3; sc.far = r * 10; sc.updateProjectionMatrix();
    if (full) JB.ctl.autoRotate = !me;
  }
  function jbPay(v, what) {
    v = Math.round(v);
    if (S.cash >= v) return spend(v, what);
    if ((S.bank || 0) >= v) { S.bank -= v; S.log.unshift(`-${money(v)} ${what} (card)`); S.log.length = Math.min(S.log.length, 30); save(); refreshStats(); return true; }
    toast(`Not enough for ${what} (${money(v)}). Cash ${money(S.cash)}, bank ${money(S.bank || 0)}.`, 'bad'); return false;
  }
  function jbBuy() {
    if (JB.busy || !JB.info || JB.tab === 'mine') return;
    const sp = { k: JB.tab, o: { ...JB.st[JB.tab] } }, name = (JB.name || JW.autoName(sp)).slice(0, 48), v = JB.price;
    if (!jbPay(v, name)) { jbTag(); return; }
    if (!Array.isArray(S.jewels)) S.jewels = [];
    const id = 'j' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    S.jewels.push({ id, k: sp.k, o: JW.compact(sp).o, name, price: v, shop: JB.shop ? JB.shop.name : '', day: S.day });
    jwWear(id, true); save();
    toast(`💎 ${name}: ${money(v)}. You've got it on.`, 'good'); jbStatus(`Bought ${name} for ${money(v)}. You're wearing it; see My jewelry to take it off or swap.`);
    jbTag();
  }
  function jbSell(id) {
    const i = jwOwned().findIndex(j => j.id === id); if (i < 0 || !JB.shop) return; const p = jwOwned()[i], v = Math.round(p.price * 0.4);
    jwWear(id, false); S.jewels.splice(i, 1); earn(v, `Sold ${p.name} to ${JB.shop.name}`); jbStatus(`Sold ${p.name} for ${money(v)}.`);
    if (JB.sel === id) JB.sel = (jwOwned()[0] || {}).id || null; jbRender(); jbBuild(true);
  }
  // shop: { name, rate } at a jeweler; null from the phone (My jewelry only)
  function jbOpen(shop, tab) {
    if (!S) return; jbDom(); closeMenu();
    if (!JB.st) JB.st = { chain: { ...JW.DEF.chain }, watch: { ...JW.DEF.watch }, more: { ...JW.DEF.more } };
    JB.shop = shop || null; JB.shopOnlyMine = !shop; JB.tab = shop ? (tab || (JB.tab === 'mine' ? 'chain' : JB.tab)) : 'mine'; JB.mode = 'display'; JB.nameTouched = false;
    if (JB.tab === 'mine') JB.sel = (jwWorn()[0] || jwOwned()[0] || {}).id || null;
    JB.el.hidden = false; JB.on = true; document.body.classList.add('jwb-open');
    if (!jbSetup()) { jbStatus('The 3D preview needs WebGL.'); }
    jbRender(); jbResize(); jbStatus('');
    if (!JB.ro) { JB.ro = new ResizeObserver(() => jbResize()); JB.ro.observe(JB.el.querySelector('.st')); }
    jbLoop(); jbBuild(true);
  }
  function jbClose() { if (!JB.on) return; JB.on = false; JB.buildId++; clearTimeout(jbT); JB.el.hidden = true; document.body.classList.remove('jwb-open'); jbFree(); }

  // ---------- jewelers on the map, the counter in every mall, the phone app ----------
  const JW_SHOPS = [
    { id: 'glitch_ice', name: 'Glitch Ice Co.', bx: 720, bz: 375, rate: 1, color: '#e6bd55', tagline: 'Custom jeweler · chains, pendants, watches, grillz · made on the bench in front of you' },
    { id: 'stopsix_gold', name: 'Stop Six Gold & Diamonds', bx: 2116, bz: -580, rate: 0.9, color: '#ff9cc2', tagline: 'Neighborhood jeweler · Cubans, names, grillz · 10% under the big shops' },
  ];
  window.__jwPlaces = D => {
    const B = D.B;
    for (const s of JW_SHOPS) {
      if (D.P.some(p => p.id === s.id)) continue;
      let bi = -1; for (let i = 0; i < B.length; i += 8) if (Math.abs(B[i] + B[i + 2] / 2 - s.bx) < 3 && Math.abs(B[i + 1] + B[i + 3] / 2 - s.bz) < 3) { bi = i; break; }
      if (bi < 0) continue;
      const w = B[bi + 2], d = B[bi + 3], cx = B[bi] + w / 2, cz = B[bi + 1] + d / 2, [fx, fz, dist] = streetFace(cx, cz);
      const half = fx ? w / 2 : d / 2, out = Math.min(half + 3, Math.max(half + 1, dist - 6)), face = Math.atan2(fx, fz);
      D.P.push({ id: s.id, name: s.name, type: 'jeweler', x: Math.round(cx + fx * out), z: Math.round(cz + fz * out), face, color: s.color, icon: 'gem', rate: s.rate, tagline: s.tagline });
    }
  };
  STYLE.jeweler = 'jeweler';
  ROOM.jeweler = { W: 16, D: 12, floor: 'marble', wall: '#4a1420', rep: 4 };
  PLACE_ICON.jeweler = '💎';
  { const f = MAP_FILTERS.find(x => x[0] === 'money'); if (f && f[2] && !f[2].includes('jeweler')) f[2].push('jeweler'); }
  // a few of the bench's presets in the glass, built from the real pieces
  async function jwCaseShow(x, y, z, picks) {
    const room = IN.room;
    for (const [i, [k, pi]] of picks.entries()) {
      try {
        const sp = { k, o: { ...JW.DEF[k], ...JW.PRESETS[k][pi][1] } }, t = await JW.build(sp, { q: 1, r: renderer });
        if (IN.room !== room) { jbDispose(t); return; }
        if (k === 'chain') t.rotation.x = -Math.PI / 2; else if (k === 'watch') t.rotation.x = -Math.PI / 2 * 0.6;
        t.scale.setScalar(1.6); t.position.set(x + (i - (picks.length - 1) / 2) * 0.55, y, z); room.add(t);
        const b = new THREE.Box3().setFromObject(t); t.position.y += y - b.min.y + 0.002;
        if (k === 'watch') JWH.watches.add(t);
      } catch (e) { console.warn('case', e); }
    }
  }
  FURNISH.jeweler = function (p, W, D) {
    const shop = { name: p.name, rate: p.rate || 1 };
    for (const [x0, x1] of [[-6.6, -2.2], [2.2, 6.6]]) { counter(x0, -1.2, x1, -0.4, '#2a0a12', '#3a0c17'); glassWall(x0, -1.25, x1, -1.19, 1.4); glassWall(x0, -0.41, x1, -0.35, 1.4); }
    rbox(-W / 2 + 0.2, 0, -D / 2 + 0.2, W / 2 - 0.2, 2.6, -D / 2 + 0.7, '#2a0a12');
    for (let i = 0; i < 7; i++) rbox(-W / 2 + 1 + i * 2, 1.1, -D / 2 + 0.7, -W / 2 + 2.4 + i * 2, 1.9, -D / 2 + 0.8, '#3a0c17', false);
    desk(0, -D / 2 + 2.2); counter(-1.3, -D / 2 + 1.5, 1.3, -D / 2 + 2.6, '#3a0c17', '#e6bd55');
    station('Jewelry counter', 0, -D / 2 + 4, () => { jbOpen(shop); return null; }, 2.4);
    station('Display cases', -4.4, 0.6, () => { jbOpen(shop, 'chain'); return null; }, 2);
    station('Watches', 4.4, 0.6, () => { jbOpen(shop, 'watch'); return null; }, 2);
    plant(-W / 2 + 1, D / 2 - 2); plant(W / 2 - 1, D / 2 - 2);
    jwCaseShow(-4.4, 1.07, -0.8, [['chain', 2], ['chain', 1], ['chain', 3]]);
    jwCaseShow(4.4, 1.07, -0.8, [['watch', 0], ['watch', 1], ['more', 0]]);
  };
  { const _mall = FURNISH.mall; FURNISH.mall = function (p, W, D) { _mall(p, W, D); counter(3.2, -2.4, 5.6, -1.6, '#2a0a12', '#e6bd55'); station('Custom jewelry', 4.4, -0.6, () => { jbOpen({ name: `${p.name.replace(/ \(.*\)$/, '')} custom counter`, rate: 1.15 }); return null; }, 1.7); }; }
  PHONE_APPS.splice(Math.max(0, PHONE_APPS.findIndex(a => a.id === 'settings')), 0, { id: 'jewelry', name: 'Jewelry', icon: '💎', bg: 'linear-gradient(135deg,#74203a,#1a0508)' });
  { const _ph = phoneApp; phoneApp = function (id) { if (id === 'jewelry') { closePhone(); jbOpen(null); return; } return _ph.apply(this, arguments); }; }
  window.__jewel = { data: () => { try { return DATA; } catch (e) { return null; } }, JW, JWH, JB, jbOpen, jbClose, jwWear, jwWorn, jwOwned, jbBuild, jbFit, JW_SHOPS };
