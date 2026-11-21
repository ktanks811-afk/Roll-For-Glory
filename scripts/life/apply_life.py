#!/usr/bin/env python3
# Living NPCs: puts scripts/life/_life.js into index.html (inside the hood code, right before window.__hood) and makes the
# few one-line hooks it needs in the hood and police code. Safe to run again: it swaps the block between its markers.
import re, sys, os
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ip = os.path.join(root, 'index.html'); src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '_life.js')).read().rstrip('\n') + '\n'
s = open(ip).read()
B, E = '  // ==== living npcs (begin) ====', '  // ==== living npcs (end) ====\n'
if B in s:
    i = s.index(B); j = s.index(E, i) + len(E); s = s[:i] + src + s[j:]
else:
    k = s.index('  window.__hood = { dbgRoute(')
    s = s[:k] + src + s[k:]
def sub(old, new, n=1):
    global s
    if new in s: return
    c = s.count(old)
    if c != n: sys.exit(f'patch anchor found {c}x (want {n}): {old[:70]}')
    s = s.replace(old, new)
# people on the sidewalk can get dropped for the whole server too
sub("if (!/^[mrhv]:/.test(e.id)) return false;", "if (!/^[mrhvp]:/.test(e.id)) return false;")
sub("it[0].length > 48 || !/^[mrhv]:/.test(it[0])", "it[0].length > 48 || !/^[mrhvp]:/.test(it[0])")
# their brain, and their animation skipping frames when they're far
sub("      else if (e.war) wBrain(e, dt, mx, mz, d);\n", "      else if (e.war) wBrain(e, dt, mx, mz, d);\n      else if (e.kind === 'ped') lifePed(e, dt, mx, mz, d);\n")
sub("          if (!e.down) { if (e.moving) animPerson(", "          if (!e.down && !(e.lod > 1 && (frame + (e.ph * 10 | 0)) % e.lod)) { e.af = frame; if (e.moving) animPerson(")
# nobody inside a building is next to you
sub("      if (!e.down && e.kind !== 'homie' && e.mode !== 'fight'", "      if (!e.down && !e.hide && e.kind !== 'homie' && e.mode !== 'fight'")
# folks on the sidewalk pick up the phone too
sub("if (e.gone || e.down || e.kind !== 'reg' || e.opp || e.mode === 'fight'", "if (e.gone || e.down || e.hide || (e.kind !== 'reg' && e.kind !== 'ped') || e.opp || e.mode === 'fight'")
# too far to matter on a phone: not drawn
sub("e.g.visible = vis && !e.hide && !(e.kind === 'homie'", "e.g.visible = vis && !e.hide && !e.far && !(e.kind === 'homie'")
open(ip, 'w').write(s)
print('living npcs applied', len(src), 'chars')
