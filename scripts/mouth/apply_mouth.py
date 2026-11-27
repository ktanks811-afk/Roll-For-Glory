# Real mouth for the 3D characters (2026-11-27): parted lips, teeth, inner mouth; grillz sit on the teeth.
# Injects scripts/mouth/_mouth.js into the PEOPLE builder (before buildFace) and hooks the head. Idempotent.
import os, re
D = os.path.dirname(os.path.abspath(__file__)); p = os.path.join(D, '..', '..', 'index.html')
s = open(p).read(); src = open(os.path.join(D, '_mouth.js')).read()
B, E = '  // ==== mouth (begin) ====\n', '  // ==== mouth (end) ====\n'
if B in s: s = s[:s.index(B)] + s[s.index(E) + len(E):]
anchor = '  function buildFace(look, g, hideLower, hideAll, lids) {\n'
assert s.count(anchor) == 1
s = s.replace(anchor, B + src + E + anchor)
def once(old, new, tag):
    global s
    if tag in s: return
    assert s.count(old) == 1, old
    s = s.replace(old, new)
once("    head.add(mesh(shellGeo(() => 0), headMat));\n",
     "    head.add(mesh(shellGeo(() => 0), headMat)); if (MOUTH_CUT) buildMouth(look, head, HN < 100); /*MOUTH*/\n", '/*MOUTH*/')
once("    const hair = buildHair(look, skimask ? 'all' : (hatOn || durag) ? 'top' : null);\n",
     "    MOUTH_CUT = !(skimask || bandana); /*MOUTH3*/\n    const hair = buildHair(look, skimask ? 'all' : (hatOn || durag) ? 'top' : null);\n", '/*MOUTH3*/')
once("    buildEyewear(look, head);\n", "    buildEyewear(look, head); MOUTH_CUT = false; /*MOUTH4*/\n", '/*MOUTH4*/')
once("      if (best <= 1) { const e = at(bu, bv); out[j * W + i] = [e.p[0] - e.d[0] * 0.0003, e.p[1] - e.d[1] * 0.0003, e.p[2] - e.d[2] * 0.0003]; }\n    }\n",
     "      if (best <= 1) { const e = at(bu, bv); out[j * W + i] = [e.p[0] - e.d[0] * 0.0003, e.p[1] - e.d[1] * 0.0003, e.p[2] - e.d[2] * 0.0003]; S[j * W + i].snap = 1; }\n    }\n    if (MOUTH_CUT) for (let k = 0; k < S.length; k++) if (S[k].o <= 0 && !S[k].snap) mouthCut(out[k]); /*MOUTH5*/\n", '/*MOUTH5*/')
# the old painted-on grill strip: only when there is no mouth (masks)
once("    if (!hideLower && (look.extras.includes('grill') || look.extras.includes('plat_grill'))) {",
     "    if (!g.userData.mouth && !hideLower && (look.extras.includes('grill') || look.extras.includes('plat_grill'))) { /*MOUTH2*/", '/*MOUTH2*/')
# character upgrades that go with it:
# your own character is built at full detail on phones too (fine head + lips; NPCs and other players stay light)
once("    ME = PEOPLE.build(L, phone ? 1 : 0);", "    ME = PEOPLE.build(L, 0); /*MEHD*/", '/*MEHD*/')
# finer skin pores on the face (the shared pore map was repeated for the body and looked like bumps up close)
once("  const neckMat = new THREE.MeshStandardMaterial({ map: neckTex,",
     "  { const fp = poreTex.clone(); fp.needsUpdate = true; fp.wrapS = fp.wrapT = THREE.RepeatWrapping; fp.repeat.set(9, 7); headMat.bumpMap = fp; headMat.bumpScale = 0.00028; } /*FACEPORE*/\n  const neckMat = new THREE.MeshStandardMaterial({ map: neckTex,", '/*FACEPORE*/')
open(p, 'w').write(s); print('ok')
