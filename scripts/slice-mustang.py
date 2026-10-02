"""Cuts the Mustang customization sheet (assets/mustang/sheet.png) into one
transparent PNG per part, and writes assets/mustang/parts.json describing them.
Run: python3 scripts/slice-mustang.py   (needs pillow + numpy)"""
import json, os
from PIL import Image
import numpy as np

SRC = 'assets/mustang/sheet.png'
OUT = 'assets/mustang/parts'
im = Image.open(SRC).convert('RGBA')
A = np.array(im)

def split_row(box, n, axis='x'):
    """Split a region holding n sprites along an axis using the gaps in opaque pixels."""
    x0, y0, x1, y1 = box
    m = A[y0:y1, x0:x1, 3] > 128
    prof = m.any(axis=0 if axis == 'x' else 1)
    runs, start = [], None
    for i, v in enumerate(prof):
        if v and start is None: start = i
        if not v and start is not None: runs.append([start, i]); start = None
    if start is not None: runs.append([start, len(prof)])
    # merge the closest runs until n remain; drop specks
    runs = [r for r in runs if r[1] - r[0] > 3]
    while len(runs) > n:
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = gaps.index(min(gaps)); runs[i] = [runs[i][0], runs[i + 1][1]]; del runs[i + 1]
    if len(runs) < n:                       # touching sprites: fall back to equal slices
        w = (len(prof)) / n; runs = [[int(i * w), int((i + 1) * w)] for i in range(n)]
    out = []
    for a, b in runs:
        out.append((x0 + a, y0, x0 + b, y1) if axis == 'x' else (x0, y0 + a, x1, y0 + b))
    return out

PARTS = {}
CIRCLES = {}   # sprites that must be cut out as a circle (they overlap their neighbours)
def add(name, box): PARTS[name] = box
def add_row(prefix, box, n, axis='x'):
    for i, b in enumerate(split_row(box, n, axis)): add(f'{prefix}{i}', b)

add('body', (14, 40, 684, 234))
for i, b in enumerate([(703, 33, 844, 114), (850, 33, 980, 114), (987, 34, 1110, 114)]): add(f'hood{i}', b)
add_row('trunk', (1124, 34, 1524, 104), 3)
for i, b in enumerate([(699, 160, 836, 219), (837, 160, 976, 219), (972, 160, 1096, 224)]): add(f'roof{i}', b)
add_row('spoiler', (1108, 160, 1526, 232), 4)
add('fbumper0', (6, 271, 255, 358)); add('fbumper1', (265, 264, 513, 358)); add('fbumper2', (523, 258, 750, 358))
add('rbumper0', (768, 270, 968, 358)); add('rbumper1', (973, 265, 1167, 355)); add('rbumper2', (1171, 270, 1335, 353)); add('rbumper3', (1344, 266, 1528, 354))
for i, b in enumerate([(13, 400, 218, 447), (223, 401, 417, 449), (423, 400, 610, 452), (615, 397, 807, 452)]): add(f'skirt{i}', b)
for i, b in enumerate([(832, 404, 996, 454), (1001, 402, 1169, 454), (1176, 404, 1344, 454), (1351, 405, 1520, 453)]): add(f'grille{i}', b)
for i, b in enumerate([(14, 504, 70, 560), (72, 500, 117, 539), (113, 496, 175, 558), (173, 497, 232, 558), (231, 493, 292, 558)]): add(f'mirror{i}', b)
for i, b in enumerate([(316, 525, 373, 557), (376, 525, 432, 557), (436, 525, 488, 557), (491, 525, 546, 557)]): add(f'handle{i}', b)
for i, b in enumerate([(571, 500, 772, 564), (778, 491, 882, 562), (884, 493, 973, 559)]): add(f'window{i}', b)
# headlights: three columns, each holds two stacked
hl = 0
for col in [(999, 498, 1089, 573), (1088, 498, 1177, 573), (1175, 498, 1262, 573)]:
    for b in split_row(col, 2, 'y'): add(f'headlight{hl}', b); hl += 1
for i, b in enumerate([(1269, 498, 1356, 556), (1365, 498, 1433, 559), (1441, 497, 1524, 560)]): add(f'taillight{i}', b)
WHEEL_D = 94
for i in range(9):
    cx = 58 + i * (696 - 58) / 8
    CIRCLES[f'wheel{i}'] = (cx, 680.0, WHEEL_D / 2)
    add(f'wheel{i}', (int(cx - 48), 632, int(cx + 48), 728))
add_row('tire', (753, 632, 928, 728), 4)
add_row('brake', (938, 632, 1213, 726), 4)
for i, b in enumerate([(1230, 632, 1297, 672), (1231, 677, 1300, 727), (1306, 674, 1374, 727), (1396, 674, 1523, 727)]): add(f'tip{i}', b)
for i, b in enumerate(split_row((1305, 620, 1523, 674), 2)): add(f'system{i}', b)
for i, b in enumerate([(13, 790, 41, 868), (45, 790, 72, 868), (78, 790, 105, 868), (113, 790, 140, 868), (148, 790, 177, 874)]): add(f'coil{i}', b)
for i, b in enumerate([(184, 790, 392, 858), (397, 786, 609, 858), (612, 785, 824, 858), (831, 777, 1053, 858)]): add(f'ride{i}', b)
add('decalsheet', (1075, 785, 1255, 859)); add('badge50', (1265, 786, 1330, 846)); add('decalpony', (1348, 785, 1415, 818))
add('decalstripe', (1432, 791, 1485, 859)); add('decalcheck', (1491, 792, 1522, 887))
add('emblem50w', (11, 943, 70, 973)); add('emblem50r', (77, 943, 135, 973)); add('emblempony0', (141, 935, 242, 984)); add('emblempony1', (252, 935, 354, 984))
add('emblemgt0', (362, 938, 434, 969)); add('emblemgt1', (450, 928, 531, 969))
add('plate0', (563, 929, 651, 989)); add('plate1', (663, 927, 766, 990)); add('plate2', (779, 925, 890, 990))

manifest = {}
os.makedirs(OUT, exist_ok=True)
for name, (x0, y0, x1, y1) in PARTS.items():
    c = A[y0:y1, x0:x1].copy()
    a = c[..., 3]
    if name in CIRCLES:
        # the wheels overlap their neighbours: find this wheel's own circle from its top and bottom
        # edges (those can't be touched by a neighbour) and cut everything outside it away
        m = a >= 120
        rows = np.where(m.any(axis=1))[0]
        top, bot = rows.min(), rows.max()
        tx = np.where(m[top + 1])[0]; bx = np.where(m[bot - 1])[0]
        cxl = (tx.min() + tx.max() + bx.min() + bx.max()) / 4.0
        cyl = (top + bot) / 2.0
        r = (bot - top) / 2.0 - 1.5
        yy, xx = np.mgrid[0:m.shape[0], 0:m.shape[1]]
        a = np.where((xx + 0.5 - cxl) ** 2 + (yy + 0.5 - cyl) ** 2 <= r * r, a, 0)
        c[..., 3] = a
    # trim to the opaque pixels
    ys, xs = np.where(c[..., 3] > 0)
    if len(xs) == 0: print('EMPTY', name); continue
    c = c[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(c).save(f'{OUT}/{name}.png', optimize=True)
    manifest[name] = [int(c.shape[1]), int(c.shape[0])]
json.dump(manifest, open('assets/mustang/parts.json', 'w'), indent=0)
print(len(manifest), 'parts')

# ---- extra layers derived from the body: the see-through glass, and what counts as paint ----
from scipy import ndimage as ndi
body = np.array(Image.open(f'{OUT}/body.png').convert('RGBA'))
# the cut-out keeps a smoky halo around the car: remove everything outside the black outline
_L = body[..., :3].astype(int).mean(axis=2)
_barrier = ndi.binary_dilation((body[..., 3] > 0) & (_L < 22), iterations=1)
_lab, _n = ndi.label(~_barrier)
_border = set(np.unique(np.concatenate([_lab[0], _lab[-1], _lab[:, 0], _lab[:, -1]]))) - {0}
body[np.isin(_lab, list(_border)), 3] = 0
Image.fromarray(body).save(f'{OUT}/body.png')
op = body[..., 3] > 0
outside, _ = ndi.label(~op)
border = set(np.unique(np.concatenate([outside[0], outside[-1], outside[:, 0], outside[:, -1]])))
glass = (~op) & ~np.isin(outside, list(border))
glass = ndi.binary_closing(glass, iterations=1) & ~op
gimg = np.zeros(body.shape, np.uint8); gimg[glass] = (255, 255, 255, 255)
Image.fromarray(gimg).save(f'{OUT}/bodyglass.png')
rgb = body[..., :3].astype(int)
L = rgb.mean(axis=2); S = rgb.max(axis=2) - rgb.min(axis=2)
paint = op & (S < 38) & (L >= 16) & (L <= 175)
paint = ndi.binary_opening(paint, iterations=1)
pimg = np.zeros(body.shape, np.uint8); pimg[paint] = (255, 255, 255, 255)
Image.fromarray(pimg).save(f'{OUT}/bodypaint.png')
manifest['bodyglass'] = manifest['bodypaint'] = [body.shape[1], body.shape[0]]
json.dump(manifest, open('assets/mustang/parts.json', 'w'), indent=0)
print('glass px', int(glass.sum()), 'paint px', int(paint.sum()))
