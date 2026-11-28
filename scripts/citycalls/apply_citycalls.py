#!/usr/bin/env python3
"""City calls: inject scripts/citycalls/_citycalls.js into the built index.html (inside the police IIFE, right after the
shooting scenes block, before `// ==== county jail (end) ====`) and patch the police code it builds on.
Idempotent: re-running replaces the block between the markers and skips patches already applied.
Usage: python3 scripts/citycalls/apply_citycalls.py index.html"""
import sys, pathlib

path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
src = path.read_text()
mod = (pathlib.Path(__file__).parent / '_citycalls.js').read_text().rstrip('\n') + '\n'

BEGIN, END = '  // ==== city calls (begin) ====', '  // ==== city calls (end) ====\n'
if BEGIN in src:
    a = src.index(BEGIN); b = src.index(END, a) + len(END)
    src = src[:a] + mod + src[b:]
else:
    anchor = '  // ==== shooting scenes (end) ====\n'
    assert src.count(anchor) == 1, 'shooting scenes end marker'
    src = src.replace(anchor, anchor + mod)

ALL_OLD, ALL_NEW = '[...COP.units, ...CNET.rem.values()]', '[...COP.units, ...CNET.rem.values(), ...ccUnits()]'
if ALL_NEW not in src:
    n = src.count(ALL_OLD); assert n == 5, f'cop lists: {n}'
    src = src.replace(ALL_OLD, ALL_NEW)

patches = [
    # online: a scene unit that comes off its call to deal with you is handed over like any other cop car
    ("!/^[px]:/.test(nid)", "!/^[pxc]:/.test(nid)"),
    # fewer patrols cruising around when every officer on the beat is tied up on a call
    ("want = inTown(mx, mz) ? (phone ? 2 : 3) : 1;", "want = Math.max(1, (inTown(mx, mz) ? (phone ? 2 : 3) : 1) - ccCut(mx, mz));"),
    # backup for a pursuit comes slower and thinner when the beat is busy
    ("want = Math.min(phone ? 4 : 6, Math.max(UNITS_FOR[lv], extra || 0) + (COP.chaseT > 40 ? 1 : 0));",
     "want = Math.max(1, Math.min(phone ? 4 : 6, Math.max(UNITS_FOR[lv], extra || 0) + (COP.chaseT > 40 ? 1 : 0)) - ccCut(mx, mz));"),
    ("if (COP.spawnT > 0) return; COP.spawnT = 3.5;", "if (COP.spawnT > 0) return; COP.spawnT = 3.5 + 5 * ccBusy(mx, mz);"),
    # the cars and units on a scene are solid to your car (and dent when you hit them)
    ("kind: 'racer' }); }\n    return out;", "kind: 'racer' }); }\n    if (window.__citycalls) window.__citycalls.movers(x, z, R, out);   // city calls\n    return out;"),
]
for old, new in patches:
    if new in src: continue
    assert src.count(old) == 1, 'patch anchor: ' + old[:70]
    src = src.replace(old, new)

path.write_text(src)
print('city calls applied', len(mod), 'bytes')
