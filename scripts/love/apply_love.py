#!/usr/bin/env python3
# Love + family: puts scripts/love/_love.js into index.html at the top level of the game, right after the gossip posts block
# (before story mode), and has the living NPCs keep each person's look so the one you date looks like the one you met.
# Safe to run again: it swaps the block between its markers.
import os, sys
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ip = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'index.html')
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '_love.js')).read().rstrip('\n') + '\n'
s = open(ip).read()
B, E = '  // ==== love + family (begin) ====', '  // ==== love + family (end) ====\n'
if B in s:
    i = s.index(B); j = s.index(E, i) + len(E); s = s[:i] + src + s[j:]
else:
    a = '  // ==== gossip posts (end) ====\n'
    assert s.count(a) == 1, 'gossip posts end marker'
    k = s.index(a) + len(a); s = s[:k] + src + s[k:]
# living NPCs keep the look each body was built from
for old, new in [
    ("try { LVW.looks.push({ P: hNameParts(PEOPLE.build(L, 1)), fem, old }); }", "try { LVW.looks.push({ P: hNameParts(PEOPLE.build(L, 1)), fem, old, L }); }"),
    ("if (use.length) { const B = use[who.look % use.length]; return hClone(B.P); }", "if (use.length) { const B = use[who.look % use.length], c = hClone(B.P); c.lvL = B.L; return c; }"),
    ("hDress(e, body); body.wrap.scale.setScalar(who.scale);", "hDress(e, body); e.lvL = body.lvL; body.wrap.scale.setScalar(who.scale);"),
]:
    if new not in s:
        assert s.count(old) == 1, old
        s = s.replace(old, new)
open(ip, 'w').write(s)
print('love + family applied', len(src), 'chars')
