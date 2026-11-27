# injects _flex.js (cash flex) into the MW Test index.html (idempotent), right after photo mode, inside the guns block
import sys, re, os
p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'index.html')
s = open(p).read()
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '_flex.js')).read()
B, E = '  // ==== cash flex (begin) ====\n', '  // ==== cash flex (end) ====\n'
s = re.sub(re.escape(B) + '.*?' + re.escape(E), '', s, flags=re.S)
anchor = '  // ==== photo mode (end) ====\n'
assert s.count(anchor) == 1
s = s.replace(anchor, anchor + B + src + E)
open(p, 'w').write(s)
print('ok')
