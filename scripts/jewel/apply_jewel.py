# injects the Jeweler's Bench (_jewel_core.js + _jewel_game.js) into the MW Test index.html (idempotent), after cash flex,
# plus small hooks: PEOPLE body hook + dispose keep, myLook / cleanLook carry look.jw, jeweler places on the map
import sys, re, os
here = os.path.dirname(os.path.abspath(__file__))
p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', '..', 'index.html')
s = open(p).read()
src = open(os.path.join(here, '_jewel_core.js')).read() + open(os.path.join(here, '_jewel_game.js')).read()
B, E = '  // ==== jeweler (begin) ====\n', '  // ==== jeweler (end) ====\n'
s = re.sub(re.escape(B) + '.*?' + re.escape(E), '', s, flags=re.S)
anchor = '  // ==== cash flex (end) ====\n'
assert s.count(anchor) == 1
s = s.replace(anchor, anchor + B + '  (() => {\n' + src + '  })();\n' + E)
def once(old, new, tag):
    global s
    if tag in s: return
    assert s.count(old) == 1, old
    s = s.replace(old, new)
once('    return { root, upper, head, arms, lids, legs, knees, ankles, fores };\n',
     "    /*JWHOOK*/ if (look.jw && window.__jwHook) { try { window.__jwHook(look, { upper, head, fores, U, ringAt, seZ, neckR, inflate, HX, surf, Wl, W, fingers, lo: HN < 100, hideLower: !!(skimask || bandana), sleeveLong }); } catch (e) { console.warn('jewel', e); } }\n    return { root, upper, head, arms, lids, legs, knees, ankles, fores };\n", '/*JWHOOK*/')
once("P.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); mats.add(o.material); } });",
     "P.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (!o.material.userData.jwKeep) mats.add(o.material); } }); /*JWKEEP*/", '/*JWKEEP*/')
once("mask: w.mask || 'no_mask', bag: w.bag || 'no_bag' }; }",
     "mask: w.mask || 'no_mask', bag: w.bag || 'no_bag', ...(window.__jwLook ? window.__jwLook() : {}) }; } /*JWLOOK*/", '/*JWLOOK*/')
once("    return o;\n  }\n\n  class NetLocal {",
     "    if (Array.isArray(L.jw) && window.__jwClean) { const j = window.__jwClean(L.jw); if (j.length) o.jw = j; } /*JWCLEAN*/\n    return o;\n  }\n\n  class NetLocal {", '/*JWCLEAN*/')
once("addRoads(D); addRimShops(D); landmarkSpots(D);", "addRoads(D); addRimShops(D); if (window.__jwPlaces) window.__jwPlaces(D); landmarkSpots(D);", '__jwPlaces(D)')
open(p, 'w').write(s)
print('ok')
