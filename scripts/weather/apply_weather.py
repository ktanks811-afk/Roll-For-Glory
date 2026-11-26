#!/usr/bin/env python3
"""Inject scripts/weather/_weather.js into index.html right after the environment block (idempotent)."""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
html_p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'index.html')
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '_weather.js'), encoding='utf-8').read().rstrip('\n') + '\n'
s = open(html_p, encoding='utf-8').read()
B, E = '  // ==== weather (begin) ====', '  // ==== weather (end) ====\n'
if B in s:
    a = s.index(B); b = s.index(E, a) + len(E); s = s[:a] + src + s[b:]
else:
    anchor = '  // ==== environment (end) ====\n'
    assert anchor in s, 'environment end marker missing'
    i = s.index(anchor) + len(anchor); s = s[:i] + src + s[i:]
open(html_p, 'w', encoding='utf-8').write(s)
print('weather injected')
