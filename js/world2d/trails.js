// Cross Timbers Trail Park (data/trails.js): a mowed meadow cut with dirt
// trails, cedar and post oak in between, a stock tank, the office and the
// rental barn by the gate, and a gravel lot for trailers. Own seed, DOM-free
// (check-data builds the map in node).

import { TRAIL_LOT, TRAIL_OFFICE, TRAILS, TRAIL_W } from '../data/trails.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// every leg of every trail as a rectangle, so the trees stay off them
export function trailStrips() {
  const out = [], h = TRAIL_W / 2;
  for (const t of TRAILS) {
    const c = t.corners, pts = t.kind === 'circuit' ? [...c, c[0]] : c;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      out.push({ x: Math.min(ax, bx) - h, z: Math.min(az, bz) - h, w: Math.abs(bx - ax) + 2 * h, d: Math.abs(bz - az) + 2 * h });
    }
  }
  return out;
}

export function addTrailPark({ buildings, lots, trees }) {
  const rnd = mulberry32(2481), R = (a, b) => a + rnd() * (b - a);
  const L = TRAIL_LOT, o = TRAIL_OFFICE;
  lots.push({ x: L.x0, z: L.z0, w: L.x1 - L.x0, d: L.z1 - L.z0, kind: 'field' });
  const tank = { x: -4440, z: 3200, w: 70, d: 50, kind: 'pond' };
  lots.push(tank);
  const strips = trailStrips();
  for (const s of strips) lots.push({ ...s, kind: 'dirt' });
  // gravel lot and the drive in from FM 2481
  const yard = { x: L.x0 + 4, z: o.z + o.d + 6, w: 60, d: 50 };
  lots.push({ ...yard, kind: 'caliche' }, { x: L.x0 - 22, z: o.z - 14, w: 30, d: 12, kind: 'caliche' });
  buildings.push({ x: o.x, z: o.z, w: o.w, d: o.d, h: 6, color: '#7a4b32', kind: 'store', label: 'CROSS TIMBERS TRAIL PARK', labelColor: '#ff8a1a', loc: 'trail_park', side: 'W' });
  buildings.push({ x: o.x + o.w + 8, z: o.z - 4, w: 30, d: 22, h: 7, color: '#8a3b2a', kind: 'barn' });
  // fence posts down the road side
  for (let z = L.z0; z < L.z1; z += 6) if (z < o.z - 20 || z > yard.z + yard.d + 4) buildings.push({ x: L.x0, z, w: 0.4, d: 0.4, h: 1.2, color: '#6a5232', kind: 'fence', noCollide: true });
  // cedar and post oak everywhere the trails, the tank and the buildings aren't
  const clear = [...strips, tank, { x: o.x - 30, z: o.z - 30, w: o.w + 80, d: o.d + 100 }].map(r => ({ x0: r.x - 7, z0: r.z - 7, x1: r.x + r.w + 7, z1: r.z + r.d + 7 }));
  for (let k = 0; k < 420; k++) {
    const x = R(L.x0 + 12, L.x1 - 8), z = R(L.z0 + 8, L.z1 - 8), r = R(2.5, 5);
    if (clear.some(c => x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1)) continue;
    trees.push({ x, z, r, kind: rnd() < 0.45 ? 'pine' : 'tree' });
  }
}
