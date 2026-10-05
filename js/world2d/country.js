// Johnson County: farm country south of the desert, where Chisholm Trail
// Pkwy runs out into farm-to-market roads. Hay fields, pastures with cattle,
// stock tanks, farmhouses with barns and silos, tree lines along the fence
// rows, and the little town of Joshua with a country store. The ranch land
// and oil leases for sale are in data/estate.js (world2d/estate.js builds
// them); nothing here goes on a road, a lot for sale or a business.
// Own seed, so the rest of the map stays exactly as it was. DOM-free.

import { COUNTRY, COUNTRY_ROADS, LOCATIONS } from '../data/world.js';
import { ESTATE_LOCATIONS } from '../data/estate.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const HAY = ['#7d7a3a', '#8a7a3e', '#6b7a34', '#9a8a4a'];
const PASTURE = ['#4a6a2c', '#55682e', '#46602a', '#5e7238'];
const ROOFS = ['#6b3a2e', '#3f4a5a', '#7a7e83', '#8a3b2a', '#5a4632', '#45484d'];
const COWS = ['#1e1e20', '#1e1e20', '#6a3a22', '#e8e2d8', '#b06a32'];

export const JOSHUA = { gas: { x: 30, z: 3660, w: 80, d: 80 } };

export function addCountry({ buildings, lots, trees, props, roads }) {
  const rnd = mulberry32(5150);
  const R = (a, b) => a + rnd() * (b - a);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const C = COUNTRY, [X0, X1, X2, X3] = COUNTRY_ROADS.x, [Z0, Z1, Z2] = COUNTRY_ROADS.z;

  // ---------------- what nothing may touch ----------------
  const keepOut = [
    ...ESTATE_LOCATIONS.filter(l => l.lot.z0 > C.z0 - 50).map(l => ({ x0: l.lot.x0 - 8, z0: l.lot.z0 - 8, x1: l.lot.x1 + 8, z1: l.lot.z1 + 8 })),
    ...LOCATIONS.filter(l => l.z > C.z0 - 50).map(l => ({ x0: l.x - 25, z0: l.z - 25, x1: l.x + 25, z1: l.z + 25 })),
    { x0: JOSHUA.gas.x - 4, z0: JOSHUA.gas.z - 4, x1: JOSHUA.gas.x + JOSHUA.gas.w + 4, z1: JOSHUA.gas.z + JOSHUA.gas.d + 4 },
  ];
  const roadEdges = roads.edges.filter(e => Math.max(e.az, e.bz) > C.z0 - 100);
  const nearRoad = (x0, z0, x1, z1, pad) => roadEdges.some(e => {
    const h = e.width / 2 + pad;
    return x0 < Math.max(e.ax, e.bx) + h && x1 > Math.min(e.ax, e.bx) - h && z0 < Math.max(e.az, e.bz) + h && z1 > Math.min(e.az, e.bz) - h;
  });
  const taken = [];
  const free = (x0, z0, x1, z1, pad = 8) => x0 > C.x0 + 20 && x1 < C.x1 - 20 && z0 > C.z0 + 10 && z1 < C.z1 - 20
    && !nearRoad(x0, z0, x1, z1, pad) && !keepOut.some(k => x0 < k.x1 && x1 > k.x0 && z0 < k.z1 && z1 > k.z0)
    && !taken.some(k => x0 < k.x1 + 2 && x1 > k.x0 - 2 && z0 < k.z1 + 2 && z1 > k.z0 - 2);
  const claim = (x0, z0, x1, z1) => { taken.push({ x0, z0, x1, z1 }); };

  // ---------------- Joshua: a store, a feed barn, a church, a water tower ----------------
  const g = JOSHUA.gas;
  lots.push({ ...g, kind: 'gas' });
  buildings.push({ x: g.x + 40, z: g.z + 10, w: 30, d: 16, h: 5, color: '#c8b28a', kind: 'store', label: 'Joshua Country Store', labelColor: '#1f8f3a' });
  buildings.push({ x: g.x + 6, z: g.z + 30, w: 30, d: 20, h: 6, color: '#e9e9e9', kind: 'canopy', noCollide: true, label: 'GAS' });
  const town = [
    { x: 140, z: Z0 + 16, w: 46, d: 30, h: 7, color: '#8a3b2a', kind: 'barn', label: 'Feed & Seed' },
    { x: 200, z: Z0 + 16, w: 34, d: 24, h: 6, color: '#d9d9d9', kind: 'store', label: 'Dollar Store' },
    { x: 250, z: Z0 + 16, w: 26, d: 22, h: 6, color: '#7a4a32', kind: 'store', label: 'Joshua Cafe' },
    { x: 300, z: Z0 + 18, w: 22, d: 34, h: 9, color: '#e8e2d8', kind: 'church' },
    { x: 140, z: Z0 - 50, w: 40, d: 26, h: 6, color: '#5d636b', kind: 'store', label: 'Johnson Co. Co-op' },
    { x: 200, z: Z0 - 46, w: 30, d: 22, h: 5, color: '#9a7a5a', kind: 'store', label: 'Tire & Lube' },
  ];
  for (const b of town) { buildings.push(b); claim(b.x - 4, b.z - 4, b.x + b.w + 4, b.z + b.d + 4); lots.push({ x: b.x - 3, z: b.z > Z0 ? Z0 + 6 : b.z + b.d + 2, w: b.w + 6, d: b.z > Z0 ? b.z - Z0 - 7 : Z0 - 6 - b.z - b.d - 2, kind: 'parking' }); }
  buildings.push({ x: 360, z: Z0 + 30, w: 10, d: 10, h: 26, color: '#c8ccd2', kind: 'watertower', round: true, label: 'JOSHUA', labelColor: '#1b4fc4' });
  claim(350, Z0 + 20, 380, Z0 + 50);
  // a few houses on the edge of town
  for (let k = 0; k < 9; k++) {
    const x = 420 + k * 30, z = Z0 + 18 + (k % 2) * 40;
    if (!free(x - 2, z - 2, x + 16, z + 14, 6)) continue;
    lots.push({ x: x - 3, z: z - 3, w: 22, d: 20, kind: 'yard' });
    buildings.push({ x, z, w: R(11, 14), d: R(10, 12), h: R(4.5, 6), color: pick(ROOFS), kind: 'house' });
    claim(x - 4, z - 4, x + 20, z + 18);
  }

  // ---------------- farmsteads on the roads: house, barn, silo, a yard ----------------
  const farmstead = (x, z) => {
    if (!free(x, z, x + 70, z + 60)) return false;
    claim(x, z, x + 70, z + 60);
    lots.push({ x, z, w: 70, d: 60, kind: 'yard' });
    lots.push({ x: x + 6, z: z + 6, w: 26, d: 6, kind: 'dirt' });
    buildings.push({ x: x + 6, z: z + 14, w: 14, d: 12, h: R(5, 7), color: pick(ROOFS), kind: 'house' });
    buildings.push({ x: x + 34, z: z + 10, w: 24, d: 30, h: R(7, 9), color: pick(['#8a3b2a', '#7a2a22', '#6b6f75', '#8a6a4a']), kind: 'barn' });
    buildings.push({ x: x + 60, z: z + 12, w: 7, d: 7, h: R(12, 18), color: '#b8bcc2', kind: 'silo', round: true });
    for (let k = 0; k < 4; k++) props.push({ k: 'bale', x: x + R(8, 60), z: z + R(44, 56), r: 0.9, c: '#c9a94a' });
    for (let k = 0; k < 4; k++) trees.push({ x: x + R(2, 30), z: z + R(30, 58), r: R(3, 5), kind: 'tree' });
    return true;
  };
  // try spots just off each road
  for (const z of [Z0, Z1, Z2]) for (let x = X0 + 60; x < X3; x += R(160, 260)) farmstead(x, z + 16) || farmstead(x, z - 76);
  for (const x of [X0, X1, X2, X3]) for (let z = Z0 + 60; z < Z2; z += R(180, 300)) farmstead(x + 16, z) || farmstead(x - 86, z);

  // ---------------- fields, pastures, woods and stock tanks ----------------
  const CELL = 110;
  for (let x = C.x0 + 30; x < C.x1 - CELL; x += CELL) {
    for (let z = C.z0 + 20; z < C.z1 - CELL; z += CELL) {
      const x0 = x + 6, z0 = z + 6, x1 = x + CELL - 6, z1 = z + CELL - 6;
      if (!free(x0, z0, x1, z1, 6)) {
        // a smaller piece of it, maybe
        if (rnd() < 0.5) for (let k = 0; k < 6; k++) { const tx = R(x0, x1), tz = R(z0, z1); if (free(tx - 4, tz - 4, tx + 4, tz + 4, 7)) trees.push({ x: tx, z: tz, r: R(3, 5.5), kind: 'tree' }); }
        continue;
      }
      const r = rnd();
      if (r < 0.34) {
        lots.push({ x: x0, z: z0, w: x1 - x0, d: z1 - z0, kind: 'field', c: pick(HAY), dir: rnd() < 0.5 ? 'x' : 'z' });
        if (rnd() < 0.5) for (let k = 0; k < 8; k++) props.push({ k: 'bale', x: R(x0 + 4, x1 - 4), z: R(z0 + 4, z1 - 4), r: R(0.8, 1.1), c: '#c9a94a' });
      } else if (r < 0.62) {
        lots.push({ x: x0, z: z0, w: x1 - x0, d: z1 - z0, kind: 'field', c: pick(PASTURE), dir: 'none' });
        const n = 3 + Math.floor(rnd() * 8);
        for (let k = 0; k < n; k++) props.push({ k: 'cow', x: R(x0 + 4, x1 - 4), z: R(z0 + 4, z1 - 4), w: 0, d: 0, c: pick(COWS), a: R(0, 6.28) });
        if (rnd() < 0.3) { const px = R(x0 + 15, x1 - 45), pz = R(z0 + 15, z1 - 35); lots.push({ x: px, z: pz, w: R(22, 34), d: R(16, 24), kind: 'pond' }); }
      } else if (r < 0.82) {
        const n = 10 + Math.floor(rnd() * 16);
        for (let k = 0; k < n; k++) trees.push({ x: R(x0, x1), z: R(z0, z1), r: R(3, 6.5), kind: rnd() < 0.8 ? 'tree' : 'pine' });
      } else if (r < 0.88) {
        lots.push({ x: R(x0 + 10, x1 - 50), z: R(z0 + 10, z1 - 40), w: R(28, 44), d: R(20, 30), kind: 'pond' });
        for (let k = 0; k < 5; k++) trees.push({ x: R(x0, x1), z: R(z0, z1), r: R(3, 5), kind: 'tree' });
      } else {
        for (let k = 0; k < 3; k++) trees.push({ x: R(x0, x1), z: R(z0, z1), r: R(3.5, 6), kind: 'tree' });
      }
      claim(x0, z0, x1, z1);
    }
  }

  // ---------------- tree lines along the fence rows and the county line ----------------
  for (const e of roadEdges) {
    if (Math.min(e.az, e.bz) < C.z0) continue;
    for (let s = 20; s < e.len - 20; s += R(14, 40)) {
      const side = rnd() < 0.5 ? -1 : 1, off = e.width / 2 + R(9, 14);
      const tx = e.ax + e.dx * s - e.dz * off * side, tz = e.az + e.dz * s + e.dx * off * side;
      if (!keepOut.some(k => tx > k.x0 && tx < k.x1 && tz > k.z0 && tz < k.z1) && !taken.some(k => tx > k.x0 && tx < k.x1 && tz > k.z0 && tz < k.z1)) trees.push({ x: tx, z: tz, r: R(3, 5), kind: 'tree' });
    }
  }
  for (let z = 4060; z < C.z1; z += R(12, 22)) trees.push({ x: C.x1 - R(4, 14), z, r: R(4, 7), kind: 'tree' });
  for (let x = C.x0; x < C.x1; x += R(12, 22)) trees.push({ x, z: C.z1 - R(4, 14), r: R(4, 7), kind: rnd() < 0.5 ? 'tree' : 'pine' });
  for (let z = C.z0; z < C.z1; z += R(12, 22)) trees.push({ x: C.x0 + R(4, 14), z, r: R(4, 7), kind: 'pine' });
}
