// Brazos country: big-ranch land south of Johnson County. FM 916 across the
// top, FM 2331 down the middle to the Brazos River, and five ranches of 400
// to 1,000 acres (data/estate.js) with live oak motts, cedar on the ridges
// and stock tanks. A feed store with pumps at the crossroads. The ranches'
// homesites by their gates stay clear for the house and the barn
// (world2d/estate.js builds those). Own seed. DOM-free.

import { BRAZOS, FM916_Z, FM916_X, FM2331_END } from '../data/world.js';
import { ESTATE_LOCATIONS, LAND } from '../data/estate.js';
import { homesite } from '../core/estate.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const BRAZOS_RIVER = { x: BRAZOS.x0, z: 10000, w: BRAZOS.x1 - BRAZOS.x0, d: 70, kind: 'river' };
export const BRAZOS_STORE = { x: 250, z: 5996, w: 100, d: 90 };

export function addBrazos({ buildings, lots, trees, props }) {
  const rnd = mulberry32(916);
  const R = (a, b) => a + rnd() * (b - a);
  const B = BRAZOS;
  const ranches = ESTATE_LOCATIONS.filter(l => LAND[l.id]?.huge);
  const sites = ranches.map(l => { const h = homesite(l); return { x0: h.x0 - 12, z0: h.z0 - 12, x1: h.x1 + 12, z1: h.z1 + 12 }; });
  const st = BRAZOS_STORE;
  const keep = [...sites, { x0: st.x - 10, z0: st.z - 10, x1: st.x + st.w + 10, z1: st.z + st.d + 10 }];
  const onRoad = (x, z, pad) => (Math.abs(x) < 5 + pad && z > FM916_Z - 300 && z < FM2331_END + 10) || (Math.abs(z - FM916_Z) < 5 + pad && x > FM916_X[0] - 10 && x < FM916_X[1] + 10);
  const ok = (x, z, pad = 10) => x > B.x0 + 6 && x < B.x1 - 6 && z > B.z0 + 30 && z < BRAZOS_RIVER.z - 8 && !onRoad(x, z, pad) && !keep.some(k => x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1);
  const tree = (x, z, r, kind) => { if (ok(x, z, r + 4)) trees.push({ x, z, r, kind }); };

  // the feed store and its pumps, on the north side of FM 916
  lots.push({ ...st, kind: 'gas' });
  buildings.push({ x: st.x + 52, z: st.z + 6, w: 42, d: 26, h: 6, color: '#8a6a4a', kind: 'barn', label: 'Brazos Feed & Fuel', labelColor: '#1f8f3a', loc: 'gas_brazos', shop: 'gas', side: 'S' });
  buildings.push({ x: st.x + 8, z: st.z + st.d - 34, w: 34, d: 20, h: 6, color: '#e9e9e9', kind: 'canopy', noCollide: true, label: 'GAS', loc: 'gas_brazos' });
  for (let k = 0; k < 6; k++) props.push({ k: 'bale', x: st.x + 60 + k * 5, z: st.z + 40, r: 0.9, c: '#c9a94a' });

  // live oak motts: clumps of a dozen or so, all over
  for (let k = 0; k < 260; k++) {
    const cx = R(B.x0 + 40, B.x1 - 40), cz = R(B.z0 + 60, BRAZOS_RIVER.z - 40), n = 5 + Math.floor(rnd() * 14), spread = R(14, 40);
    for (let t = 0; t < n; t++) tree(cx + R(-spread, spread), cz + R(-spread, spread), R(3.5, 7), 'tree');
  }
  // cedar on the ridges in the west, scattered mesquite everywhere
  for (let k = 0; k < 900; k++) { const x = R(B.x0 + 20, -1500), z = R(B.z0 + 40, BRAZOS_RIVER.z - 20); tree(x, z, R(2.5, 4.5), 'pine'); }
  for (let k = 0; k < 1400; k++) tree(R(B.x0 + 20, B.x1 - 20), R(B.z0 + 40, BRAZOS_RIVER.z - 20), R(2, 3.5), 'tree');
  // pecans along the river bottom
  for (let x = B.x0 + 10; x < B.x1 - 10; x += R(8, 18)) tree(x, BRAZOS_RIVER.z - R(10, 60), R(4, 7.5), 'tree');

  // stock tanks: two or three on every ranch, a few more out on the open range
  for (const l of ranches) {
    const r = l.lot, n = 2 + Math.floor((LAND[l.id].acres || 400) / 400);
    for (let k = 0; k < n; k++) {
      for (let tries = 0; tries < 20; tries++) {
        const w = R(40, 90), d = R(30, 60), x = R(r.x0 + 30, r.x1 - w - 30), z = R(r.z0 + 220, r.z1 - d - 30);
        if (!ok(x, z, 20) || !ok(x + w, z + d, 20)) continue;
        lots.push({ x, z, w, d, kind: 'pond', loc: l.id });
        break;
      }
    }
  }
  for (let k = 0; k < 6; k++) { const x = R(B.x0 + 60, B.x1 - 140), z = R(B.z0 + 80, BRAZOS_RIVER.z - 120); if (ok(x, z, 20) && ok(x + 70, z + 50, 20) && !ranches.some(l => x < l.lot.x1 && x + 70 > l.lot.x0 && z < l.lot.z1 && z + 50 > l.lot.z0)) lots.push({ x, z, w: R(40, 70), d: R(30, 50), kind: 'pond' }); }

  // the county line: a tree row along the fence where Johnson County ends
  for (let x = B.x0 + 8; x < B.x1 - 8; x += R(14, 26)) if (Math.abs(x) > 16) trees.push({ x, z: B.z0 + R(6, 14), r: R(3.5, 6), kind: 'tree' });

  return { water: [BRAZOS_RIVER] };
}
