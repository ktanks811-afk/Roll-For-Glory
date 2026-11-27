  // ---------------------------------------------------------------------
  // A real mouth (2026-11-27): the lips part a little, with teeth, a dark
  // mouth behind them, and lips that roll inward at the edge. Grillz (the
  // jeweler's, or the old gold/platinum grill extras) sit on these teeth.
  // The head mesh is too coarse for a lip line, so the lips are their own
  // finer patch laid over the head (same skin texture), and the head under
  // them is pushed back out of the way.
  // ---------------------------------------------------------------------
  // a rounded box (superellipsoid, n = 4): a tooth
  function toothGeo(w, h, d, seg) {
    const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, Math.max(2, seg >> 1)), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), r = Math.pow(x ** 4 + y ** 4 + z ** 4, 0.25) || 1, k = 0.5 / r; P.setXYZ(i, x * k * w * 2, y * k * h * 2, z * k * d * 2); }
    g.computeVertexNormals(); return g;
  }
  const MOUTH = { G: 0.0016, WM: 0.0198, XW: 0.031, YT: -0.031, YB: -0.075, km: 0.7 };
  const mouthSeam = x => -0.0508 + 0.0012 * smooth(0.006, 0.022, Math.abs(x));
  const mouthGap = x => MOUTH.G * Math.pow(Math.max(0, 1 - (x / MOUTH.WM) ** 2), 0.8);
  // surf(), also giving the head direction the point came from (for the skin texture's uv)
  function surfD(x, y) {
    let dx = x / HX, dy = y / HY;
    for (let k = 0; k < 10; k++) { const dz = Math.sqrt(Math.max(0.0001, 1 - dx * dx - dy * dy)), p = headPoint(dx, dy, dz); dx += (x - p[0]) / HX; dy += (y - p[1]) / HY; }
    const dz = Math.sqrt(Math.max(0.0001, 1 - dx * dx - dy * dy)), L = Math.hypot(dx, dy, dz);
    return { p: headPoint(dx, dy, dz), d: [dx / L, dy / L, dz / L] };
  }
  const headUV = d => [(Math.atan2(d[0], d[2]) + Math.PI) / (2 * Math.PI), 1 - Math.acos(clamp(d[1], -1, 1)) / Math.PI];
  // push the head's own surface (and the hidden parts of beard/hair shells) back behind the lips; the lip patch
  // covers where it starts. shellGeo calls this for its hidden, un-snapped vertices while MOUTH_CUT is on.
  let MOUTH_CUT = false;
  function mouthCut(o) {
    const x = o[0], y = o[1], z = o[2]; if (z < 0.04) return;
    const q = (x / 0.024) ** 2 + ((y + 0.051) / 0.014) ** 2; if (q >= 1) return;
    o[2] = z - 0.026 * smooth(1, 0.55, q);
  }
  function buildMouth(look, g, lod) {
    const nu = lod ? 26 : 52, nv = lod ? 7 : 14, M = MOUTH, zs = surf(0, mouthSeam(0))[2];
    // wearing grillz (or the old grill extras) the lips part a little more, so they show
    const showing = look.extras.includes('grill') || look.extras.includes('plat_grill') || (Array.isArray(look.jw) && look.jw.some(j => j && j.k === 'more' && j.o && j.o.kind === 'grillz'));
    M.G = showing ? 0.0023 : 0.0016;
    // a lip: rows from its outer edge (y0) to the seam; the seam row opens by the gap and rolls inward
    const lip = top => gridGeo(nu, nv, (u, v) => {
      const x = lerp(-M.XW, M.XW, u), ym = mouthSeam(x), y0 = top ? lerp(M.YT, ym, v) : lerp(ym, M.YB, v);
      const S = surfD(x, y0), d = Math.abs(ym - y0), w = Math.exp(-((d / 0.0062) ** 2)), inM = smooth(M.WM, M.WM * 0.7, Math.abs(x));
      const y = y0 + (top ? 1 : -1) * mouthGap(x) * w, curl = 0.0027 * Math.exp(-((d / 0.0017) ** 2)) * inM;
      return [x, y, S.p[2] + 0.00025 - curl];
    }, (u, v) => { const x = lerp(-M.XW, M.XW, u), ym = mouthSeam(x); return headUV(surfD(x, top ? lerp(M.YT, ym, v) : lerp(ym, M.YB, v)).d); });
    g.add(mesh(lip(true), headMat, false)); g.add(mesh(lip(false), headMat, false));
    // the inside of the mouth: a dark pocket seen from within
    const inner = new THREE.MeshStandardMaterial({ color: col(mixHex(shadeHex(look.skin, -0.78), '#2a0c10', 0.55)), roughness: 0.9, side: THREE.BackSide });
    { const im = mesh(ellipsoid([0, mouthSeam(0) - 0.001, zs - 0.0095], [0.021, 0.011, 0.0095], lod ? 10 : 16), inner, false); im.receiveShadow = false; g.add(im); }
    // teeth on the same arch the jeweler's grillz are cut to, scaled to this mouth
    const km = M.km, Ra = 0.027 * km, front = zs - 0.0042, tipUp = mouthSeam(0) - 0.0004, tipLo = mouthSeam(0) - 0.001;
    const UP = [6.8, 7.6, 6.6, 8.6, 8.6, 6.6, 7.6, 6.8], LO = [7, 6.8, 5.8, 5.2, 5.2, 5.8, 6.8, 7], seg = lod ? 3 : 5, tg = [];
    for (const [W, top] of [[UP, true], [LO, false]]) {
      const ws = W.map(v => v / 1000 * km), inset = top ? 0 : 0.0014; let s = -ws.reduce((a, b) => a + b, 0) / 2;
      ws.forEach((w, i) => {
        const sc = s + w / 2; s += w; const th = sc / Ra, n = [Math.sin(th), 0, Math.cos(th)], h = top ? 0.009 : 0.008, back = 0.0009 + inset + 0.0026;
        const tip = (top ? tipUp : tipLo) + 0.0002 * Math.abs(i - 3.5) / 3.5 * (top ? 1 : -1);
        const c = [Ra * Math.sin(th) - n[0] * back, top ? tip + h / 2 : tip - h / 2, front - Ra * (1 - Math.cos(th)) - n[2] * back];
        const t = toothGeo(w * 0.47, h / 2, 0.0026, seg); t.rotateY(th); t.translate(...c); tg.push(t);
      });
    }
    const grill = look.extras.includes('grill') ? gold : look.extras.includes('plat_grill') ? plat : teethMat;
    // inside the head's own shadow, so they don't take shadows (the lips still frame them)
    const tm = mesh(mergeGeos(tg.map(prep)), grill, false); tm.receiveShadow = false; g.add(tm);
    g.userData.mouth = { seam: mouthSeam(0), zs, front, km, tipUp, tipLo, ra: Ra };
  }
