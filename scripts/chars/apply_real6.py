#!/usr/bin/env python3
"""Character realism pass 6 (2026-11-27): beard hair texture + softer colour, finer brows,
shaded sclera, skin tone mottling, smoother shoulder caps under sleeves, hair-strand waves.
Idempotent: every edit carries /*REAL6*/ and is skipped once present."""
import sys, pathlib
P = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[2] / 'index.html')
s = P.read_text()
def rep(old, new, tag):
    global s
    if tag in s: return
    n = s.count(old)
    if n != 1: sys.exit(f'{tag}: expected 1 match, got {n}')
    s = s.replace(old, new)

# 1. beards: a fine short-hair texture, colour lifted off pure black toward the skin underneath, finer thickness noise
rep("""    const m = HAIRMAT.coil.clone(); m.color.copy(col(look.hair)).multiplyScalar(1.05);
    const geo = [shellGeo((d, p) => { const t = f.T(p); return t > 0.0004 ? t + 0.0012 * nz(d, 40) * smooth(0, 0.003, t) : -0.003; }, HN, 52, 0.4, 1)];""",
"""    const m = BEARDMAT.clone(); m.color.copy(col(mixHex(look.hair, shadeHex(look.skin, -0.4), 0.26))).multiplyScalar(1.35); /*REAL6 beard*/
    const geo = [shellGeo((d, p) => { const t = f.T(p) * 0.85; return t > 0.0004 ? t + (0.0011 * nz(d, 40) + 0.0006 * nz(d, 150, 3)) * smooth(0, 0.003, t) : -0.003; }, HN, 52, 0.4, 1)];""", 'REAL6 beard')
rep("""  const beadMat = new THREE.MeshStandardMaterial({ color: col('#e8c060'), metalness: 1, roughness: 0.25 });""",
"""  const beadMat = new THREE.MeshStandardMaterial({ color: col('#e8c060'), metalness: 1, roughness: 0.25 });
  /*REAL6 beardmat*/ const BEARDT = ctex(256, 256, (x, w, h) => {
    x.fillStyle = '#8c8c8c'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) { const v = 70 + rnd() * 185 | 0, a = Math.PI / 2 + (rnd() - 0.5) * 1.1, l = 2.5 + rnd() * 5, px = rnd() * w, py = rnd() * h;
      x.strokeStyle = `rgba(${v},${v},${v},0.7)`; x.lineWidth = 0.6 + rnd() * 0.8; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 2, py + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  });
  BEARDT.repeat.set(22, 12);
  // see-through specks so the darkened skin painted under the beard shows between hairs
  const BEARDA = ctex(256, 256, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1700; i++) { x.fillStyle = '#000'; const px = rnd() * w, py = rnd() * h; x.beginPath(); x.ellipse(px, py, 0.8 + rnd() * 1.4, 1.2 + rnd() * 2, rnd(), 0, 7); x.fill(); } }, false);
  BEARDA.repeat.set(22, 12);
  const BEARDMAT = new THREE.MeshStandardMaterial({ map: BEARDT, alphaMap: BEARDA, alphaTest: 0.5, bumpMap: BEARDT, bumpScale: 0.0018, roughness: 0.62, metalness: 0, envMapIntensity: 0.35, side: THREE.DoubleSide });""", 'REAL6 beardmat')

# 2. brows: lighter painted base and a thinner see-through hair strand
rep("""            const k = m * (0.45 + 0.55 * hair) * 0.92;""", """            const k = m * (0.3 + 0.7 * hair) * 0.72; /*REAL6 brow*/""", 'REAL6 brow')
rep("""  const browMat = new THREE.MeshStandardMaterial({ roughness: 0.9, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });""",
"""  const browMat = new THREE.MeshStandardMaterial({ roughness: 0.9, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }); /*REAL6 browmat*/""", 'REAL6 browmat')

# 3. sclera: shaded toward the edges, the upper lid's shadow, warm corners and faint veins
rep("""  const scleraMat = new THREE.MeshStandardMaterial({ color: col('#d6ccbf'), roughness: 0.12, envMapIntensity: 0.75 });""",
"""  /*REAL6 sclera*/ const scleraTex = ctex(256, 128, (x, W, H) => {
    const img = x.createImageData(W, H), a = img.data;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const ph = (i + 0.5) / W * Math.PI * 2, th = (j + 0.5) / H * Math.PI, dx = -Math.cos(ph) * Math.sin(th), dy = Math.cos(th), dz = Math.sin(ph) * Math.sin(th);
      let v = 0.62 + 0.38 * smooth(-0.1, 0.8, dz); v *= 1 - 0.22 * smooth(0.12, 0.5, dy) * smooth(-0.2, 0.6, dz);
      const corner = smooth(0.45, 0.85, Math.abs(dx)) * smooth(-0.1, 0.3, dz);
      let r = v, g = v * (1 - 0.1 * corner), b = v * (1 - 0.14 * corner);
      const o = (j * W + i) * 4; a[o] = r * 255; a[o + 1] = g * 255; a[o + 2] = b * 255; a[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    for (let k = 0; k < 26; k++) { const side = k % 2 ? 0.25 + 0.17 : 0.25 - 0.17, u = (side + (hash(k * 3.1) - 0.5) * 0.06) * W, v = (0.3 + hash(k * 7.7) * 0.4) * H;
      x.strokeStyle = `rgba(170,40,40,${0.12 + 0.12 * hash(k)})`; x.lineWidth = 0.5 + hash(k * 1.3) * 0.6; x.beginPath(); x.moveTo(u, v);
      let cx = u, cy = v; for (let q = 0; q < 4; q++) { cx += (k % 2 ? -1 : 1) * (2 + hash(k * 11 + q) * 4); cy += (hash(k * 5 + q) - 0.5) * 5; x.lineTo(cx, cy); } x.stroke(); }
  });
  const scleraMat = new THREE.MeshStandardMaterial({ map: scleraTex, color: col('#ebe3d8'), roughness: 0.1, envMapIntensity: 0.8 });""", 'REAL6 sclera')

# 4. skin: low and mid frequency tone mottling, a slightly darker hairline and jaw edge
rep("""      const f = fade ? fade(d, p) : 0;
      if (f > 0) {   // fine hairs: many dots of hair colour""",
"""      { /*REAL6 mottle*/ const m1 = vnoise(p[0] * 70 + 3, p[1] * 70, p[2] * 70) - 0.5, m2 = vnoise(p[0] * 260, p[1] * 260 + 5, p[2] * 260) - 0.5;
        const t = 1 + 0.07 * m1 + 0.035 * m2 - 0.06 * smooth(0.075, 0.1, p[1]) - 0.05 * smooth(-0.075, -0.1, p[1]) * smooth(0.03, -0.01, p[2] - 0.03);
        r *= t * (1 + 0.025 * m1); g *= t; b *= t * (1 - 0.02 * m1); }
      const f = fade ? fade(d, p) : 0;
      if (f > 0) {   // fine hairs: many dots of hair colour""", 'REAL6 mottle')

# 5. shoulders: the sleeve's cap tucked in and flatter so it no longer bulges like a ball
rep("""sg = ts === 'tank' ? [] : [ellipsoid([s * -0.004, -0.028, 0], [capR * 1.0, capR * 1.06 + inf * 0.2, capR * 0.9], 22)];""",
"""sg = ts === 'tank' ? [] : [ellipsoid([s * -0.006, -0.029, 0], [capR * 0.95, capR * 1.04 + inf * 0.2, capR * 0.9], 22)]; /*REAL6 cap*/""", 'REAL6 cap')

# 6. waves: softer ridges with hair strands running along them
rep("""        g.addColorStop(0, '#9a9a9a'); g.addColorStop(0.45, '#f4f4f4'); g.addColorStop(1, '#9a9a9a');""",
"""        g.addColorStop(0, '#a8a8a8'); g.addColorStop(0.45, '#e6e6e6'); g.addColorStop(1, '#a8a8a8'); /*REAL6 wave*/""", 'REAL6 wave')
rep("""      for (let i = 0; i < 1600; i++) { const v = 110 + rnd() * 140 | 0; x.fillStyle = `rgba(${v},${v},${v},0.35)`; x.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }""",
"""      for (let i = 0; i < 1600; i++) { const v = 110 + rnd() * 140 | 0; x.fillStyle = `rgba(${v},${v},${v},0.35)`; x.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
      for (let i = 0; i < 1400; i++) { const v = 90 + rnd() * 165 | 0, px = rnd() * w, py = rnd() * h, l = 6 + rnd() * 14; x.strokeStyle = `rgba(${v},${v},${v},0.45)`; x.lineWidth = 0.5 + rnd() * 0.7; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l / 2, py + (rnd() - 0.5) * 3, px + l, py + Math.sin(px * 0.8) * 2); x.stroke(); } /*REAL6 wave2*/""", 'REAL6 wave2')
# 7. eyes sit a millimetre deeper in their sockets (the white no longer pokes out past the lids in profile); a fuller chin
rep("""const p = surf(s * EYE_X, EYE_Y), c = [s * EYE_X, EYE_Y, p[2] - 0.0068];""", """const p = surf(s * EYE_X, EYE_Y), c = [s * EYE_X, EYE_Y, p[2] - 0.0079]; /*REAL6 eyez*/""", 'REAL6 eyez')
rep("""+ 0.009 * FS.chin * Math.exp(-((x / 0.024) ** 2) - (((y + 0.1) / 0.017) ** 2));""", """+ 0.0108 * FS.chin * Math.exp(-((x / 0.025) ** 2) - (((y + 0.1) / 0.018) ** 2)); /*REAL6 chin*/""", 'REAL6 chin')
P.write_text(s); print('real6 ok')
