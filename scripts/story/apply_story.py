#!/usr/bin/env python3
"""Apply the story mode module (_story.js) to the 3D game's index.html. Idempotent.
usage: python3 apply_story.py <index.html>"""
import sys, os, re
path = sys.argv[1]
src = open(path, encoding='utf-8').read()
mod = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '_story.js'), encoding='utf-8').read()
if not mod.endswith('\n'):
    mod += '\n'
if '// ===== STORY BEGIN =====' in src:
    src = re.sub(r'  // ===== STORY BEGIN =====.*?// ===== STORY END =====\n', lambda m: mod, src, flags=re.S)
else:
    anchor = "\n  boot();\n})();\n</script>"
    if src.count(anchor) != 1:
        sys.exit('apply_story: anchor not found')
    src = src.replace(anchor, "\n" + mod + anchor[1:])
open(path, 'w', encoding='utf-8').write(src)
print('apply_story: ok')
