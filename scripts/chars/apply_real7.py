#!/usr/bin/env python3
"""Character realism pass 7 (2026-11-27): a real head shape. The skull's lower half no longer
closes as a round egg under the face: below the jaw line it curves in to the neck, so the jaw,
the angle under the ear and the nape read like a real head; a nasion dip between the eyes and a
cheek hollow. Idempotent (/*REAL7 ...*/ markers)."""
import sys, pathlib
P = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[2] / 'index.html')
s = P.read_text()
def rep(old, new, tag):
    global s
    if tag in s: return
    n = s.count(old)
    if n != 1: sys.exit(f'{tag}: expected 1 match, got {n}')
    s = s.replace(old, new)

# head: nasion + cheek hollow (inside the face block), then the jaw/neck cut at the end
rep("""      z += f * 0.004 * FS.brow * Math.exp(-((y - 0.026) ** 2) / 0.00008) * smooth(0.06, 0.0, Math.abs(x) - 0.01);   // brow ridge""",
"""      z += f * 0.004 * FS.brow * Math.exp(-((y - 0.026) ** 2) / 0.00008) * smooth(0.06, 0.0, Math.abs(x) - 0.01);   // brow ridge
      z -= f * 0.0035 * Math.exp(-((x / 0.011) ** 2) - (((y - 0.013) / 0.007) ** 2)); /*REAL7 nasion*/
      z -= f * 0.0045 * (0.4 + 0.6 * JAW) * Math.exp(-(((Math.abs(x) - 0.047) / 0.013) ** 2) - (((y + 0.042) / 0.016) ** 2));   // the hollow under the cheekbone""", 'REAL7 nasion')
rep("""      z -= f * 0.0018 * Math.exp(-((x / 0.022) ** 4) - (((y + 0.0508) / 0.0016) ** 2));
    }
    return [x, y, z];""",
"""      z -= f * 0.0018 * Math.exp(-((x / 0.022) ** 4) - (((y + 0.0508) / 0.0016) ** 2));
    }
    { /*REAL7 neckcut*/ // under the jaw line (chin -> angle under the ear -> base of the skull) the head curves in onto the neck
      const zc = NECK.zc, hz = z - zc, rr = Math.hypot(x, hz);
      const yj = z > 0.015 ? lerp(-0.066, -0.112, smooth(0.015, 0.1, z) ** 1.15) : lerp(-0.066, -0.03, smooth(0.015, -0.095, z));
      const below = yj - y;
      if (below > 0 && rr > NECK.r) { const w = smooth(0, 0.032, below), nr = lerp(rr, NECK.r, w * w * (3 - 2 * w)); x *= nr / rr; z = zc + hz * nr / rr; }
    }
    return [x, y, z];""", 'REAL7 neckcut')
rep("""  let JAW = 1;   // 1: a man's square jaw, 0: a woman's""", """  let JAW = 1;   // 1: a man's square jaw, 0: a woman's
  const NECK = { r: 0.047, zc: -0.008 }; /*REAL7 neckvar*/""", 'REAL7 neckvar')
# the neck radius in head space, set per person before the head is built
rep("""    const head = new THREE.Group(); head.position.set(0, U(1.648 - (FEM ? 0.016 : 0.01)), 0.014); head.scale.setScalar(FEM ? 1.04 : 1.05);""",
"""    const head = new THREE.Group(); head.position.set(0, U(1.648 - (FEM ? 0.016 : 0.01)), 0.014); head.scale.setScalar(FEM ? 1.04 : 1.05);
    NECK.r = 0.054 * lerp(1, W, 0.3) * (FEM ? 0.86 : 1) / (FEM ? 1.04 : 1.05) * 0.9; /*REAL7 neckr*/""", 'REAL7 neckr')
# the neck leans forward a little more from the shoulders to the head
rep("""upper.add(mesh(limbP([0, U(1.4), -0.008], [0, U(1.62), 0.006],""", """upper.add(mesh(limbP([0, U(1.4), -0.017], [0, U(1.62), 0.004], /*REAL7 neckslant*/""", 'REAL7 neckslant')

# beards: thousands of fine hair cards growing out of the beard's base layer, down the face and out at the edges
rep("""  function buildFacialHair(look, g) {""", """  /*REAL7 beardcards*/
  const BCT = ctex(128, 128, (x, w, h) => {   // 4 strips of fine tapered hairs (white = hair, the alpha carries the gaps)
    x.clearRect(0, 0, w, h);
    for (let c = 0; c < 4; c++) for (let k = 0; k < 9; k++) {
      const x0 = c * 32 + 2 + rnd() * 28, bend = (rnd() - 0.5) * 6, l = 0.6 + rnd() * 0.4, v = 150 + rnd() * 105 | 0;
      x.strokeStyle = `rgba(${v},${v},${v},1)`; x.lineCap = 'round';
      for (let q = 0; q < 6; q++) { const t0 = q / 6, t1 = (q + 1) / 6; if (t1 > l) break; x.lineWidth = 1.6 * (1 - t0 / l) + 0.3;
        x.beginPath(); x.moveTo(x0 + bend * t0 * t0, h * (1 - t0)); x.lineTo(x0 + bend * t1 * t1, h * (1 - t1)); x.stroke(); }
    }
  });
  const BCMAT = new THREE.MeshStandardMaterial({ map: BCT, alphaTest: 0.35, transparent: false, roughness: 0.6, metalness: 0, envMapIntensity: 0.35, side: THREE.DoubleSide });
  function beardCards(f, look, mat, lo) {
    let sd = 1234567; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const NU = lo ? 90 : 210, NV = lo ? 45 : 105, P = [], N = [], UV = [], I = [];
    const up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3(), gdir = new THREE.Vector3(), side = new THREE.Vector3(), dir = new THREE.Vector3(), q = new THREE.Vector3();
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) {
      const u = 0.2 + 0.6 * (i + R()) / NU, v = 0.47 + 0.45 * (j + R()) / NV, d = dirOf(u, v), p = headPoint(d[0], d[1], d[2]), t = f.T(p);
      if (t < 0.00025 || R() > Math.min(1, 0.25 + t / 0.0016)) continue;
      n.set(p[0] / HX / HX, p[1] / HY / HY, p[2] / HZ / HZ).normalize();
      if (look.facialHair !== 'long_beard' && n.y < -0.75) continue;
      // grows down the face, outward on the mustache, then leans off the skin
      gdir.set(0, -1, 0).addScaledVector(n, n.y).normalize();
      const stache = p[1] > -0.05 && p[2] > 0.05 && Math.abs(p[0]) < 0.032;
      if (stache) gdir.x += Math.sign(p[0]) * 0.55;
      gdir.addScaledVector(n, -gdir.dot(n)).normalize();
      const lean = 0.35 + 0.25 * R();
      dir.copy(gdir).multiplyScalar(Math.cos(lean)).addScaledVector(n, Math.sin(lean)).normalize();
      dir.x += (R() - 0.5) * 0.35; dir.normalize();
      side.crossVectors(dir, n).normalize();
      const L = (stache ? 0.004 : 0.0032) + Math.max(t, 0.0012) * (f.long ? 2.6 : 2.0) + R() * 0.002, Wd = 0.0026 + R() * 0.0012;
      const root = q.set(p[0], p[1], p[2]).addScaledVector(n, t * 0.35);
      const b = P.length / 3, c = (R() * 4 | 0) / 4;
      for (let r = 0; r <= 2; r++) {
        const tt = r / 2, droop = tt * tt * L * 0.35;
        for (const sx of [-0.5, 0.5]) {
          P.push(root.x + dir.x * L * tt + side.x * Wd * sx + gdir.x * droop, root.y + dir.y * L * tt + side.y * Wd * sx + gdir.y * droop - droop * 0.3, root.z + dir.z * L * tt + side.z * Wd * sx + gdir.z * droop);
          N.push(n.x, n.y, n.z); UV.push(c + (sx + 0.5) * 0.25, tt);
        }
      }
      for (let r = 0; r < 2; r++) { const a = b + r * 2; I.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); geo.setIndex(I);
    const m = BCMAT.clone(); m.color.copy(mat.color).multiplyScalar(1.45);
    const ms = mesh(geo, m, false); ms.receiveShadow = false; return ms;
  }
  function buildFacialHair(look, g) {""", 'REAL7 beardcards')
rep("""    g.add(mesh(mergeGeos(geo.map(prep)), m));
  }""", """    g.add(mesh(mergeGeos(geo.map(prep)), m));
    g.add(beardCards(f, look, m, HN < 100)); /*REAL7 addcards*/
  }""", 'REAL7 addcards')
rep("""const geo = [shellGeo((d, p) => { const t = f.T(p) * 0.85; return t > 0.0004""", """const geo = [shellGeo((d, p) => { const t = f.T(p) * 0.85 - 0.0007; /*REAL7 shellin*/ return t > 0.0004""", 'REAL7 shellin')
# stubble: an even shadow of hair under the skin plus fine dark dots, not big coloured specks
rep("""if (s > 0 && n > 0.35) { const k = s * 0.6; r *= lerp(1, tint[0] * 0.9, k); g *= lerp(1, tint[1] * 0.9, k); b *= lerp(1, tint[2] * 0.9, k); }""",
"""if (s > 0) { /*REAL7 stubble*/ const k = s * (0.26 + (n > 0.6 ? 0.2 : 0)); const sr = lerp(1, Math.min(1, tint[0] * 0.9 + 0.12), k), sg = lerp(1, Math.min(1, tint[1] * 0.9 + 0.12), k), sb = lerp(1, Math.min(1, tint[2] * 0.9 + 0.14), k); const l = (sr + sg + sb) / 3; r *= l; g *= l; b *= lerp(l, sb, 0.5); }""", 'REAL7 stubble')
# long beard: hanging strands over the part that hangs off the chin
rep("""    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal'""", """    if (f.long) { /*REAL7 longcards*/
      const RG = [[-0.08, 0.046, 0.032, 0.073], [-0.12, 0.042, 0.03, 0.082], [-0.16, 0.032, 0.024, 0.086], [-0.2, 0.016, 0.014, 0.088], [-0.215, 0.002, 0.002, 0.088]];
      const at = y => { for (let k = 0; k < RG.length - 1; k++) if (y >= RG[k + 1][0]) { const a = RG[k], b = RG[k + 1], t = (y - a[0]) / (b[0] - a[0]); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; } return RG[RG.length - 1].slice(1); };
      for (let k = 0, K = lo ? 260 : 900; k < K; k++) {
        const a = (R() - 0.5) * Math.PI * 2, y = lerp(-0.075, -0.195, R() ** 1.3), [rx, rz, zo] = at(y), L = 0.035 + R() * 0.045, y2 = Math.max(-0.222, y - L), [rx2, rz2, zo2] = at(y2), sh = 1.02 + R() * 0.06;
        const p0 = [rx * Math.sin(a) * sh, y, zo + rz * Math.cos(a) * sh], p1 = [rx2 * Math.sin(a) * sh * 0.9, y2, zo2 + rz2 * Math.cos(a) * sh * 0.9];
        n.set(Math.sin(a), 0, Math.cos(a)); dir.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); const Lr = dir.length(); dir.normalize(); side.crossVectors(dir, n).normalize();
        const Wd = 0.004 + R() * 0.002, b = P.length / 3, c = (R() * 4 | 0) / 4;
        for (let r = 0; r <= 2; r++) { const tt = r / 2; for (const sx of [-0.5, 0.5]) { P.push(p0[0] + dir.x * Lr * tt + side.x * Wd * sx + n.x * 0.002 * Math.sin(tt * 3), p0[1] + dir.y * Lr * tt + side.y * Wd * sx, p0[2] + dir.z * Lr * tt + side.z * Wd * sx + n.z * 0.002 * Math.sin(tt * 3)); N.push(n.x, n.y, n.z); UV.push(c + (sx + 0.5) * 0.25, tt); } }
        for (let r = 0; r < 2; r++) { const q2 = b + r * 2; I.push(q2, q2 + 1, q2 + 3, q2, q2 + 3, q2 + 2); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal'""", 'REAL7 longcards')
# skull: fuller above the ears (parietal), a rounder, slightly lower crown instead of an egg top
rep("""    let x = dx * HX * lerp(1, FS.fw, smooth(0.45, -0.1, dy)), y = dy * HY, z = dz * HZ;""",
"""    let x = dx * HX * lerp(1, FS.fw, smooth(0.45, -0.1, dy)), y = dy * HY, z = dz * HZ;
    if (dy > 0) { const sk = Math.sin(Math.PI * Math.min(1, dy)); x *= 1 + 0.075 * sk; z *= 1 + 0.03 * sk * (dz < 0 ? 1.4 : 0.6); y *= 1 - 0.035 * smooth(0.55, 1, dy); } /*REAL7 skull*/""", 'REAL7 skull')
P.write_text(s); print('real7 ok')
