#!/usr/bin/env python3
"""Shooting scenes: inject scripts/scenes/_scenes.js into the built index.html (inside the police IIFE, right before
`// ==== county jail (end) ====`) and patch the police / jail / street-war code it builds on.
Idempotent: re-running replaces the block between the markers and skips patches already applied.
Usage: python3 scripts/scenes/apply_scenes.py index.html"""
import re, sys, pathlib

path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'index.html')
src = path.read_text()
mod = (pathlib.Path(__file__).parent / '_scenes.js').read_text().rstrip('\n') + '\n'

BEGIN, END = '  // ==== shooting scenes (begin) ====', '  // ==== shooting scenes (end) ====\n'
if BEGIN in src:
    a = src.index(BEGIN); b = src.index(END, a) + len(END)
    src = src[:a] + mod + src[b:]
else:
    anchor = '  // ==== county jail (end) ====\n'
    assert src.count(anchor) == 1, 'jail end marker'
    src = src.replace(anchor, mod + anchor)

SCM = '/^(npcx|scx|scar|perim|xport)$/'
patches = [
    # copEnd: units busy at a scene (or driving you downtown) keep doing that
    ('for (const u of COP.units) { u.lights = u.siren = false; if (u.officer) copOfficerGone(u); if (u.mode !== \'park\')',
     f'for (const u of COP.units) {{ if ({SCM}.test(u.mode)) continue; u.lights = u.siren = false; if (u.officer) copOfficerGone(u); if (u.mode !== \'park\')'),
    # copChase: a pursuit doesn't pull units off of somebody they're cuffing
    ('for (const u of COP.units) if (!u.gone && Math.hypot(u.x - COP.lastSeen[0], u.z - COP.lastSeen[1]) < 600) { u.mode = \'chase\';',
     f'for (const u of COP.units) if (!u.gone && !{SCM}.test(u.mode) && Math.hypot(u.x - COP.lastSeen[0], u.z - COP.lastSeen[1]) < 600) {{ u.mode = \'chase\';'),
    # copRespond: same for backup
    ("const free = COP.units.filter(u => u.mode !== 'chase' && Math.hypot(u.x - mx, u.z - mz) < 600)",
     f"const free = COP.units.filter(u => u.mode !== 'chase' && !{SCM}.test(u.mode) && Math.hypot(u.x - mx, u.z - mz) < 600)"),
    # copPopulate: scene units stay out longer before they go home
    ("Math.hypot(u.x - mx, u.z - mz) > (u.mode === 'chase' ? 900 : 640)",
     "Math.hypot(u.x - mx, u.z - mz) > (/^(chase|npcx|scx|scar|perim)$/.test(u.mode) ? 900 : 640)"),
    # jUnitNear: the unit that takes you isn't one that's on its way to somebody else
    ("if (o.gone || o.mode === 'npcx' || o.mode === 'xport') continue; const d = Math.hypot(o.x - mx, o.z - mz);",
     "if (o.gone || o.mode === 'npcx' || o.mode === 'xport' || o.mode === 'scx' || o.mode === 'scar') continue; const d = Math.hypot(o.x - mx, o.z - mz);"),
    # the old "two shooters at a street war" pickup is replaced by the whole scene
    ("if (ev && (ev.phase === 'hot' || ev.phase === 'out') && !ev.jlDone) {",
     "if (!window.__scenes && ev && (ev.phase === 'hot' || ev.phase === 'out') && !ev.jlDone) {"),
    # street wars: the police pulling up doesn't scatter everybody any more (the scene holds them)
    ("if (ev.phase === 'hot' && C && C.COP && (",
     "if (ev.phase === 'hot' && !window.__scenes && C && C.COP && ("),
    # street wars: nobody in cuffs gets despawned out from under the officer
    ("if (ev.outT > 100) { for (const e of ev.ents) if (!e.gone && !e.down) hKill(e); wEnd(ev); }",
     "if (ev.outT > 100) { for (const e of ev.ents) if (!e.gone && !e.down && !e.jl) hKill(e); wEnd(ev); }"),
    ("for (const e of ev.ents) if (!e.gone && !e.down && why === 'far') hKill(e);",
     "for (const e of ev.ents) if (!e.gone && !e.down && !e.jl && why === 'far') hKill(e);"),
    # who got taken to jail stays gone for the whole server (like the dead)
    ("const hGoneDead = id => { const a = hDeadAge(id);",
     "const hGoneDead = id => { if (window.__scJailed && window.__scJailed(id)) return true; const a = hDeadAge(id);"),
    # a slider in cuffs doesn't despawn when you're down the street
    ("if (e.kind === 'member' && e.slider && !e.down && d > (e.wcar ? 520 : 260)) { hKill(e); continue; }",
     "if (e.kind === 'member' && e.slider && !e.down && !e.jl && d > (e.wcar ? 520 : 260)) { hKill(e); continue; }"),
    # online: more units ride on the state packet (a scene can have 8)
    ("Math.hypot(a.x - mx, a.z - mz) - Math.hypot(b.x - mx, b.z - mz)).slice(0, 8);",
     "Math.hypot(a.x - mx, a.z - mz) - Math.hypot(b.x - mx, b.z - mz)).slice(0, 10);"),
]
for old, new in patches:
    if new in src:
        continue
    n = src.count(old)
    assert n == 1, f'patch anchor found {n}x: {old[:70]}'
    src = src.replace(old, new)

path.write_text(src)
print('shooting scenes applied:', path)
