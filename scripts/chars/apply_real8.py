#!/usr/bin/env python3
"""Character realism pass 8 (2026-11-27): necks that match the heads. Thicker, real-proportion
neck for the head size, the head's jaw/neck cut sized to it, and the neck shaded like the face:
shadow under the jaw and at the skull base, the same skin tone mottling. Idempotent (/*REAL8*/)."""
import sys, pathlib
P = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[2] / 'index.html')
s = P.read_text()
def rep(old, new, tag):
    global s
    if tag in s: return
    n = s.count(old)
    if n != 1: sys.exit(f'{tag}: expected 1 match, got {n}')
    s = s.replace(old, new)

rep("""    { const n0 = 0.068 * lerp(1, W, 0.5) * (FEM ? 0.88 : 1), n1 = 0.054 * lerp(1, W, 0.3) * (FEM ? 0.86 : 1);
      upper.add(mesh(limbP(""", """    { const n0 = 0.074 * lerp(1, W, 0.5) * (FEM ? 0.87 : 1), n1 = 0.0605 * lerp(1, W, 0.3) * (FEM ? 0.86 : 1); /*REAL8 neck*/
      upper.add(neckShade(limbP(""", 'REAL8 neck')
rep("""zo: -0.004 * (1 - t) }), true, 28, 10), neckMat)); }""", """zo: -0.004 * (1 - t) }), true, 28, 10), U(1.62), look)); }""", 'REAL8 neckcall')
rep("""    NECK.r = 0.054 * lerp(1, W, 0.3)""", """    NECK.r = 0.0605 * lerp(1, W, 0.3)""", 'REAL8 neckr')
# the neck mesh with its own shading baked into vertex colours (neckMat multiplies them)
rep("""  function buildFacialHair(look, g) {""", """  /*REAL8 neckshade*/ function neckShade(geo, top, look) {
    const P = geo.attributes.position, C = new Float32Array(P.count * 3), lum = (() => { const c = hex3(look.skin); return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; })();
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(x, z), front = Math.max(0, Math.cos(a)), back = Math.max(0, -Math.cos(a));
      const up = smooth(top - 0.11, top - 0.01, y);   // toward the head
      let k = 1 - (0.2 + 0.08 * (1 - lum)) * up * (0.45 + 0.55 * front) - 0.1 * up * back;   // the jaw's shadow, the skull base
      k *= 1 + 0.06 * (vnoise(x * 70 + 3, y * 70, z * 70) - 0.5) + 0.03 * (vnoise(x * 260, y * 260 + 5, z * 260) - 0.5);
      const warm = 0.025 * front * (1 - up);   // a little blood colour low on the throat
      C[i * 3] = k; C[i * 3 + 1] = k * (1 - warm); C[i * 3 + 2] = k * (1 - warm * 1.3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
    return mesh(geo, neckMat);
  }
  function buildFacialHair(look, g) {""", 'REAL8 neckshade')
rep("""  const neckMat = new THREE.MeshStandardMaterial({ map: neckTex, roughness: 0.56, metalness: 0, envMapIntensity: 0.45 });""",
"""  const neckMat = new THREE.MeshStandardMaterial({ map: neckTex, vertexColors: true, roughness: 0.56, metalness: 0, envMapIntensity: 0.45 }); /*REAL8 neckmat*/""", 'REAL8 neckmat')
P.write_text(s); print('real8 ok')
