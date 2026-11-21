#!/usr/bin/env python3
# Gossip posts: puts scripts/gram/_gram.js into index.html at the top level of the game, right after photo mode's block
# closes (before story mode), so it can use photo mode (window.__photo), Gossip (addGossip, gossipApp) and the online hooks.
# Safe to run again: it swaps the block between its markers.
import os
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ip = os.path.join(root, 'index.html'); src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '_gram.js')).read().rstrip('\n') + '\n'
s = open(ip).read()
B, E = '  // ==== gossip posts (begin) ====', '  // ==== gossip posts (end) ====\n'
if B in s:
    i = s.index(B); j = s.index(E, i) + len(E); s = s[:i] + src + s[j:]
else:
    k = s.index('  // ===== STORY BEGIN =====')
    s = s[:k] + src + s[k:]
open(ip, 'w').write(s)
print('gossip posts applied', len(src), 'chars')
