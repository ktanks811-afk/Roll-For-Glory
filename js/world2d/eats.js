// Food spots on the map (data/food.js). DOM-free (check-data builds the map in node).
// Each spot's lot is cleared of filler scenery, then a taco truck with picnic
// tables, or a small restaurant with a parking strip, goes up facing the street.

import { FOOD_SPOTS } from '../data/food.js';

const overlaps = (o, r, pad = 0) => o.x < r.x1 + pad && o.x + (o.w || 0) > r.x0 - pad && o.z < r.z1 + pad && o.z + (o.d || 0) > r.z0 - pad;
const inLot = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
const keep = (arr, fn) => { let j = 0; for (let i = 0; i < arr.length; i++) if (fn(arr[i])) arr[j++] = arr[i]; arr.length = j; };

// A rectangle in the lot's own frame: u runs along the street front, v goes
// back from the front edge. Returns world x/z/w/d.
function frame(loc) {
  const r = loc.lot, side = loc.side;
  const len = side === 'N' || side === 'S' ? r.x1 - r.x0 : r.z1 - r.z0;
  const dep = side === 'N' || side === 'S' ? r.z1 - r.z0 : r.x1 - r.x0;
  const rect = (u, v, lu, lv) => {
    if (side === 'N') return { x: r.x0 + u, z: r.z0 + v, w: lu, d: lv };
    if (side === 'S') return { x: r.x0 + u, z: r.z1 - v - lv, w: lu, d: lv };
    if (side === 'W') return { x: r.x0 + v, z: r.z0 + u, w: lv, d: lu };
    return { x: r.x1 - v - lv, z: r.z0 + u, w: lv, d: lu };
  };
  return { len, dep, rect };
}

export function addEats(out) {
  const { buildings, lots, trees, props } = out;
  for (const loc of FOOD_SPOTS) {
    const r = loc.lot;
    // make room on the lot, and around the marker so nothing crowds the door
    const near = { x0: Math.min(r.x0, loc.x - 16), z0: Math.min(r.z0, loc.z - 16), x1: Math.max(r.x1, loc.x + 16), z1: Math.max(r.z1, loc.z + 16) };
    keep(buildings, b => b.loc || b.noCollide || (!overlaps(b, r, 1) && !(b.fill && overlaps(b, near))));
    keep(lots, l => l.kind === 'lane' || l.loc || !overlaps(l, r, -1));
    keep(trees, t => !inLot(t.x, t.z, r, t.r));
    if (props) keep(props, p => !inLot(p.x, p.z, r, 1));
    const { len, dep, rect } = frame(loc);
    lots.push({ ...rect(0, 0, len, dep), kind: loc.truck ? 'lot' : 'parking', loc: loc.id });
    if (loc.truck) {
      // the truck sits at the kerb, serving window toward the sidewalk
      const tl = Math.min(10, len - 4);
      buildings.push({ ...rect((len - tl) / 2, 1, tl, 3.6), h: 3.4, color: '#f2f2f2', kind: 'store', label: loc.sign, labelColor: loc.color, loc: loc.id, shop: 'food', side: loc.side, accent: '#e8641a' });
      // picnic tables behind it
      for (let k = 0; k < 3; k++) {
        const u = len * (0.2 + k * 0.3) - 1.2;
        if (props) props.push({ k: 'bench', ...rect(u, dep * 0.55, 2.4, 1.4) });
      }
    } else {
      // parking strip at the front, the restaurant behind it
      lots.push({ ...rect(2, 1, len - 4, 14), kind: 'parking', loc: loc.id });
      buildings.push({ ...rect(6, 17, len - 12, dep - 20), h: 6, color: loc.menu === 'bbq' ? '#5a3a2a' : '#7a2e24', kind: 'landmark', label: loc.sign, labelColor: loc.color, loc: loc.id, shop: 'food', side: loc.side, accent: loc.color });
    }
  }
}
