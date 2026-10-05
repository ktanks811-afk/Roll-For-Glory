// Dallas: east of Fort Worth down I-30. The freeway carries on from the east
// end of Loop 820, past Arlington (the stadium exit, a gas station and a
// truck shop), over the Trinity River and straight through Dallas: downtown
// towers and Reunion Tower, Uptown, Deep Ellum's brick blocks, the West
// Dallas warehouses, the Oak Cliff bungalows and Bishop Arts, South Dallas
// and Fair Park with the Cotton Bowl. The street grid itself is in
// world2d/roads.js and the businesses on it are in data/world.js (city:
// 'dallas'); map.js builds their buildings with `landmarkBlock`.
// Own seed, so Fort Worth stays exactly as it was. DOM-free.

import { DALLAS, DGRID_X, DGRID_Z, I30_ROW, I30_END, DALLAS_ZONE, DTRINITY_X, ARLINGTON_X, ARLINGTON_END, HWY_Z, HWY_W, HWY_X, BLOCK, ROAD_W, LOCATIONS, districtAt } from '../data/world.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const GLASS = ['#3a4a5e', '#2f3d4f', '#46566a', '#33404f', '#2a3542', '#4e5f73', '#5a6878'];
const MID = ['#5a5148', '#4d4b52', '#5e5a55', '#45474f', '#6a5f52', '#504a45'];
const BRICK = ['#8a3b2a', '#7a4a32', '#9a5a3a', '#6e3a2a', '#a0583a', '#8a6a4a', '#5a3a30'];
const MURAL = ['#d12a8a', '#e8c21a', '#1b9fc4', '#e8641a', '#7a2ad1', '#2ac46a'];
const IND = ['#6b6f75', '#5d6167', '#7a7e83', '#4f5358'];
const ROOFS = ['#6b3a2e', '#3f4a5a', '#5a4632', '#2f3b2f', '#6e6e6e', '#7a4b3a', '#4a3a4a', '#585048'];

// Dallas blocks that hold a landmark instead of filler
const SPECIAL = {
  '2,4': 'reunion', '2,3': 'dealey', '5,1': 'klyde', '8,6': 'fairpark', '8,7': 'cottonbowl', '2,7': 'bishop', '3,7': 'bishop',
};

export function addDallas(out, { landmarkBlock }) {
  const { buildings, lots, trees, props } = out;
  const rnd = mulberry32(214);
  const R = (a, b) => a + rnd() * (b - a);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const dout = { ...out, R };          // landmarks and garages here draw from the Dallas seed
  const water = [];
  const park = (x0, z0, W, D, n = 16) => {
    lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park' });
    for (let k = 0; k < n; k++) trees.push({ x: x0 + R(4, W - 4), z: z0 + R(4, D - 4), r: R(3, 6), kind: 'tree' });
  };
  const locBlocks = new Map();
  for (const l of LOCATIONS) if (l.city === 'dallas') locBlocks.set(`${l.block[0]},${l.block[1]}`, l);

  // ---------------- the city blocks ----------------
  const inset = ROAD_W / 2 + 6, hwyInset = HWY_W / 2 + 6;
  for (let i = 0; i < DGRID_X.length - 1; i++) {
    for (let j = 0; j < DGRID_Z.length - 1; j++) {
      const x0 = DGRID_X[i] + inset, x1 = DGRID_X[i + 1] - inset;
      const z0 = DGRID_Z[j] + (j === I30_ROW ? hwyInset : inset), z1 = DGRID_Z[j + 1] - (j + 1 === I30_ROW ? hwyInset : inset);
      const W = x1 - x0, D = z1 - z0;
      const loc = locBlocks.get(`${i},${j}`);
      if (loc) { landmarkBlock(loc, x0, z0, x1, z1, dout); continue; }
      const sp = SPECIAL[`${i},${j}`];
      if (sp) { special(sp, x0, z0, x1, z1); continue; }
      const dist = districtAt((x0 + x1) / 2, (z0 + z1) / 2);
      if (dist === 'Downtown Dallas') downtown(x0, z0, W, D);
      else if (dist === 'Uptown') uptown(x0, z0, W, D);
      else if (dist === 'Deep Ellum') ellum(x0, z0, W, D);
      else if (dist === 'West Dallas') warehouses(x0, z0, W, D);
      else neighbourhood(x0, z0, W, D, dist === 'South Dallas');
    }
  }

  function downtown(x0, z0, W, D) {
    if (rnd() < 0.08) { lots.push({ x: x0, z: z0, w: W, d: D, kind: 'plaza' }); for (let k = 0; k < 8; k++) trees.push({ x: x0 + R(6, W - 6), z: z0 + R(6, D - 6), r: R(2.5, 4), kind: 'tree' }); return; }
    const n = 2, g = 6, s = (W - g) / n, t = (D - g) / n;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const shrink = R(0, 6);
      buildings.push({ x: x0 + a * (s + g) + shrink / 2, z: z0 + b * (t + g) + shrink / 2, w: s - shrink, d: t - shrink, h: R(60, 260), color: pick(GLASS), kind: 'tower' });
    }
  }
  function uptown(x0, z0, W, D) {
    if (rnd() < 0.14) { park(x0, z0, W, D); return; }
    const n = 3, g = 5, s = (W - g * 2) / n, t = (D - g * 2) / n;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      if (a === 1 && b === 1) { lots.push({ x: x0 + s + g, z: z0 + t + g, w: s, d: t, kind: 'parking' }); continue; }
      buildings.push({ x: x0 + a * (s + g), z: z0 + b * (t + g), w: s - R(0, 4), d: t - R(0, 4), h: rnd() < 0.3 ? R(60, 120) : R(16, 50), color: pick(rnd() < 0.5 ? GLASS : MID), kind: rnd() < 0.3 ? 'tower' : 'midrise' });
    }
  }
  // Deep Ellum: a ring of narrow two- and three-story brick storefronts on
  // every street, murals on some, a parking lot in the middle
  function ellum(x0, z0, W, D) {
    const deep = 26;
    for (const [side, len] of [['N', W], ['S', W], ['W', D - deep * 2], ['E', D - deep * 2]]) {
      let u = 0;
      while (u < len - 6) {
        const w = Math.min(len - u, R(9, 18));
        const h = R(6, 13), color = rnd() < 0.18 ? pick(MURAL) : pick(BRICK);
        if (side === 'N') buildings.push({ x: x0 + u, z: z0, w: w - 0.8, d: deep, h, color, kind: 'store' });
        else if (side === 'S') buildings.push({ x: x0 + u, z: z0 + D - deep, w: w - 0.8, d: deep, h, color, kind: 'store' });
        else if (side === 'W') buildings.push({ x: x0, z: z0 + deep + u, w: deep, d: w - 0.8, h, color, kind: 'store' });
        else buildings.push({ x: x0 + W - deep, z: z0 + deep + u, w: deep, d: w - 0.8, h, color, kind: 'store' });
        u += w;
      }
    }
    lots.push({ x: x0 + deep + 3, z: z0 + deep + 3, w: W - deep * 2 - 6, d: D - deep * 2 - 6, kind: 'parking' });
  }
  function warehouses(x0, z0, W, D) {
    if (rnd() < 0.5) {
      buildings.push({ x: x0 + 4, z: z0 + 4, w: W - 8, d: D * R(0.45, 0.6), h: R(9, 16), color: pick(IND), kind: 'warehouse' });
      lots.push({ x: x0 + 4, z: z0 + D * 0.66, w: W - 8, d: D * 0.32, kind: 'parking' });
    } else {
      buildings.push({ x: x0 + 4, z: z0 + 4, w: W * 0.55, d: D - 8, h: R(10, 20), color: pick(IND), kind: 'warehouse' });
      lots.push({ x: x0 + W * 0.6, z: z0 + 4, w: W * 0.4 - 4, d: D - 8, kind: 'junk' });
    }
  }
  // Oak Cliff and South Dallas: bungalows on yards; South Dallas has more
  // empty lots, churches and corner lots
  function neighbourhood(x0, z0, W, D, south) {
    if (rnd() < (south ? 0.06 : 0.1)) { park(x0, z0, W, D); return; }
    const n = 4, s = W / n, t = D / n;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const lx = x0 + a * s, lz = z0 + b * t;
      if ((a === 1 || a === 2) && (b === 1 || b === 2)) { trees.push({ x: lx + s / 2, z: lz + t / 2, r: R(3, 5.5), kind: 'tree' }); continue; }
      if (south && rnd() < 0.14) { lots.push({ x: lx + 1, z: lz + 1, w: s - 2, d: t - 2, kind: 'dirt' }); if (rnd() < 0.5) trees.push({ x: lx + R(4, s - 4), z: lz + R(4, t - 4), r: R(2.5, 4), kind: 'tree' }); continue; }
      if (south && rnd() < 0.04) { buildings.push({ x: lx + 3, z: lz + 3, w: s - 8, d: t - 10, h: 9, color: '#e8e2d8', kind: 'church' }); continue; }
      lots.push({ x: lx + 1, z: lz + 1, w: s - 2, d: t - 2, kind: 'yard' });
      buildings.push({ x: lx + 4 + R(0, 3), z: lz + 4 + R(0, 3), w: R(south ? 10 : 12, south ? 13 : 16), d: R(10, 13), h: R(4.5, 7), color: pick(ROOFS), kind: 'house' });
      if (rnd() < 0.6) trees.push({ x: lx + R(3, s - 3), z: lz + R(3, t - 3), r: R(2.5, 4.5), kind: 'tree' });
    }
  }

  function special(kind, x0, z0, x1b, z1b) {
    const W = x1b - x0, D = z1b - z0, cx = x0 + W / 2, cz = z0 + D / 2;
    if (kind === 'reunion') {
      // Reunion Tower: the ball on the stick, next to the hotel
      lots.push({ x: x0, z: z0, w: W, d: D, kind: 'plaza' });
      buildings.push({ x: cx - 34, z: cz - 12, w: 24, d: 24, h: 170, color: '#c8ccd2', kind: 'tower', round: true, label: 'REUNION TOWER', labelColor: '#ffd84a' });
      buildings.push({ x: cx + 4, z: z0 + 6, w: 40, d: D - 12, h: 95, color: '#7a8a9a', kind: 'tower' });
      for (let k = 0; k < 10; k++) trees.push({ x: x0 + R(4, 40), z: z0 + R(4, D - 4), r: R(2.5, 4), kind: 'tree' });
    } else if (kind === 'dealey') {
      lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park' });
      buildings.push({ x: x0 + 8, z: z0 + 8, w: 34, d: 22, h: 24, color: '#9a5a3a', kind: 'midrise', label: 'Book Depository' });
      for (let k = 0; k < 14; k++) trees.push({ x: x0 + R(50, W - 4), z: z0 + R(4, D - 4), r: R(3, 5), kind: 'tree' });
    } else if (kind === 'klyde') {
      // Klyde Warren Park: the deck park over the freeway, lawn and food trucks
      lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park' });
      lots.push({ x: x0 + 10, z: cz - 14, w: W - 20, d: 28, kind: 'plaza' });
      for (let k = 0; k < 5; k++) buildings.push({ x: x0 + 14 + k * 20, z: cz - 3, w: 7, d: 3, h: 3, color: pick(MURAL), kind: 'store', noCollide: true });
      for (let k = 0; k < 20; k++) { const z = rnd() < 0.5 ? z0 + R(4, D / 2 - 18) : z0 + R(D / 2 + 18, D - 4); trees.push({ x: x0 + R(4, W - 4), z, r: R(2.5, 4.5), kind: 'tree' }); }
    } else if (kind === 'fairpark') {
      // Fair Park: the Esplanade, the art deco halls and the Texas Star
      lots.push({ x: x0, z: z0, w: W, d: D, kind: 'plaza' });
      lots.push({ x: cx - 8, z: z0 + 10, w: 16, d: D - 20, kind: 'pond' });
      buildings.push({ x: x0 + 6, z: z0 + 10, w: 26, d: D - 20, h: 14, color: '#d9c8a4', kind: 'midrise', label: 'Hall of State' });
      buildings.push({ x: x1b - 32, z: z0 + 10, w: 26, d: D - 20, h: 12, color: '#d9c8a4', kind: 'midrise' });
      buildings.push({ x: cx + 16, z: z0 + 8, w: 22, d: 22, h: 60, color: '#d12a3a', kind: 'tower', round: true, label: 'TEXAS STAR', labelColor: '#ffd84a', noCollide: false });
    } else if (kind === 'cottonbowl') {
      lots.push({ x: x0, z: z0, w: W, d: D, kind: 'parking' });
      buildings.push({ x: x0 + 8, z: z0 + 8, w: W - 16, d: D - 16, h: 22, color: '#8a8f98', kind: 'stands', round: true, label: 'COTTON BOWL', labelColor: '#e8c21a' });
    } else if (kind === 'bishop') {
      // Bishop Arts: little shops facing the street, a patio and trees
      lots.push({ x: x0, z: z0, w: W, d: D, kind: 'plaza' });
      for (let u = 0; u < W - 8; u += R(10, 15)) buildings.push({ x: x0 + u, z: z0, w: 9, d: 20, h: R(5, 8), color: rnd() < 0.3 ? pick(MURAL) : pick(BRICK), kind: 'store' });
      for (let u = 0; u < W - 8; u += R(10, 15)) buildings.push({ x: x0 + u, z: z0 + D - 20, w: 9, d: 20, h: R(5, 8), color: pick(BRICK), kind: 'store' });
      lots.push({ x: x0 + 4, z: z0 + 26, w: W - 8, d: D - 52, kind: 'parking' });
      for (let k = 0; k < 8; k++) trees.push({ x: x0 + R(4, W - 4), z: z0 + R(24, 28), r: R(2, 3), kind: 'tree' });
    }
  }

  // ---------------- the Trinity River, west of downtown ----------------
  const RV = { x0: DTRINITY_X - 40, x1: DTRINITY_X + 40 };
  for (const [za, zb] of [[DALLAS_ZONE.z0 - 200, HWY_Z - HWY_W / 2 - 6], [HWY_Z + HWY_W / 2 + 6, DALLAS_ZONE.z1 + 200]]) {
    const w = { x: RV.x0, z: za, w: RV.x1 - RV.x0, d: zb - za, kind: 'river' };
    water.push(w);
  }
  // the I-30 bridge: just its rails, the freeway runs right over the water
  for (const z of [HWY_Z - HWY_W / 2 - 2.2, HWY_Z + HWY_W / 2 + 0.6]) buildings.push({ x: RV.x0 - 8, z, w: RV.x1 - RV.x0 + 16, d: 1.6, h: 1.2, color: '#9a9ca2', kind: 'pier', noCollide: true });
  // the levees: a strip of grass and a trail on each bank
  lots.push({ x: RV.x0 - 70, z: DALLAS_ZONE.z0, w: 66, d: DALLAS_ZONE.z1 - DALLAS_ZONE.z0, kind: 'park', lawn: true });
  lots.push({ x: RV.x1 + 4, z: DALLAS_ZONE.z0, w: 66, d: DALLAS_ZONE.z1 - DALLAS_ZONE.z0, kind: 'park', lawn: true });
  lots.push({ x: RV.x1 + 30, z: DALLAS_ZONE.z0, w: 4, d: DALLAS_ZONE.z1 - DALLAS_ZONE.z0, kind: 'trail' });
  // the Margaret Hunt Hill bridge's white arch, upstream (scenery: no road on it)
  buildings.push({ x: RV.x0 - 4, z: -1900, w: RV.x1 - RV.x0 + 8, d: 10, h: 2, color: '#e8e8e8', kind: 'pier', noCollide: true, label: 'MARGARET HUNT HILL BRIDGE' });

  // ---------------- Arlington: the stadium exit ----------------
  const AX = ARLINGTON_X, hs = HWY_Z - HWY_W / 2, hn = HWY_Z + HWY_W / 2;
  // AT&T Stadium and Globe Life Field north of the freeway, a sea of parking around them
  lots.push({ x: AX - 330, z: hs - 470, w: 660, d: 440, kind: 'parking' });
  buildings.push({ x: AX - 150, z: hs - 400, w: 280, d: 220, h: 42, color: '#b8bfc8', kind: 'stands', round: true, label: 'AT&T STADIUM', labelColor: '#1b4fc4' });
  buildings.push({ x: AX + 170, z: hs - 380, w: 130, d: 130, h: 36, color: '#8a9aa8', kind: 'warehouse', label: 'GLOBE LIFE FIELD', labelColor: '#c41b1b' });
  // the gas station and the truck shop on the south frontage
  for (const l of LOCATIONS.filter(l => l.id === 'gas_arlington' || l.id === 'arlington_service')) {
    const lx0 = l.x - 50, lz0 = hn + 2;
    if (l.type === 'gas') {
      lots.push({ x: lx0, z: lz0, w: 100, d: 90, kind: 'gas' });
      buildings.push({ x: l.x - 18, z: lz0 + 52, w: 36, d: 18, h: 5, color: '#d0d0d0', kind: 'store', label: l.name, labelColor: l.color, loc: l.id, shop: 'gas', side: 'N', accent: l.color });
      buildings.push({ x: l.x - 20, z: lz0 + 12, w: 40, d: 20, h: 6, color: '#e9e9e9', kind: 'canopy', noCollide: true, label: 'GAS', loc: l.id });
    } else {
      lots.push({ x: lx0, z: lz0, w: 100, d: 90, kind: 'parking' });
      buildings.push({ x: l.x - 24, z: lz0 + 10, w: 48, d: 30, h: 9, color: '#3d4452', kind: 'landmark', label: l.name, labelColor: l.color, loc: l.id, shop: 'repair', side: 'N', accent: l.color });
    }
  }
  // Arlington: rows of houses either side of Collins St
  for (let z = hn + 130; z < DALLAS_ZONE.z1 - 30; z += 40) {
    for (let x = AX - 560; x < AX + 560; x += 34) {
      if (Math.abs(x + 9 - AX) < 30 || rnd() < 0.3) continue;
      lots.push({ x: x - 3, z: z - 3, w: 26, d: 24, kind: 'yard' });
      buildings.push({ x: x + R(0, 3), z: z + R(0, 3), w: R(11, 15), d: R(10, 13), h: R(4.5, 6.5), color: pick(ROOFS), kind: 'house' });
      if (rnd() < 0.5) trees.push({ x: x + R(0, 20), z: z + 16 + R(0, 3), r: R(2.5, 4), kind: 'tree' });
    }
  }

  // ---------------- trees: freeway shoulders, the countryside in between, the edge of town ----------------
  const busy = [
    { x0: AX - 340, z0: hs - 480, x1: AX + 340, z1: hn + 110 },
    { x0: RV.x0 - 80, z0: DALLAS_ZONE.z0, x1: RV.x1 + 80, z1: DALLAS_ZONE.z1 },
    { x0: DALLAS.x0 - 20, z0: DALLAS.z0 - 20, x1: DALLAS.x1 + 20, z1: DALLAS.z1 + 20 },
    { x0: AX - 12, z0: hn, x1: AX + 12, z1: ARLINGTON_END + 10 },
    { x0: AX - 570, z0: hn + 120, x1: AX + 570, z1: DALLAS_ZONE.z1 },
  ];
  const clear = (x, z, pad = 0) => !busy.some(b => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad)
    && Math.abs(z - HWY_Z) > HWY_W / 2 + 10;
  for (let x = HWY_X[1]; x < I30_END; x += 55) {
    for (const s of [-1, 1]) {
      const tx = x + R(-10, 10), tz = HWY_Z + s * (HWY_W / 2 + R(14, 40));
      if (clear(tx, tz)) trees.push({ x: tx, z: tz, r: R(4, 7), kind: rnd() < 0.5 ? 'pine' : 'tree' });
    }
  }
  for (let k = 0; k < 1100; k++) {
    const x = R(HWY_X[1] + 50, DALLAS_ZONE.x1 - 10), z = R(DALLAS_ZONE.z0 + 10, DALLAS_ZONE.z1 - 10);
    if (x < 3300 && z > -1000) continue;            // Stop Six's side streets
    if (!clear(x, z, 12)) continue;
    trees.push({ x, z, r: R(3, 6.5), kind: rnd() < 0.7 ? 'tree' : 'pine' });
  }
  // a few farm fields between the towns
  for (let k = 0; k < 14; k++) {
    const x = R(3350, DTRINITY_X - 260), z = rnd() < 0.5 ? R(DALLAS_ZONE.z0 + 20, hs - 140) : R(hn + 60, DALLAS_ZONE.z1 - 120);
    const w = R(90, 160), d = R(70, 120);
    if (!clear(x, z, 10) || !clear(x + w, z + d, 10)) continue;
    lots.push({ x, z, w, d, kind: 'field', c: pick(['#55682e', '#6b7a34', '#7d7a3a', '#4a6a2c']), dir: rnd() < 0.5 ? 'x' : 'z' });
  }
  keepTreesOff(trees, lots, buildings);
  return { water, props };
}

// nothing grows on a building or a field (trees went down first, fields after)
function keepTreesOff(trees, lots, buildings) {
  const solid = [...lots.filter(l => l.kind === 'field' && l.x > 3300), ...buildings.filter(b => b.x > 3300 && b.kind !== 'pier')];
  for (let i = trees.length - 1; i >= 0; i--) {
    const t = trees[i];
    if (t.x < 3300) continue;
    if (solid.some(o => t.x > o.x - 1 && t.x < o.x + o.w + 1 && t.z > o.z - 1 && t.z < o.z + o.d + 1)) trees.splice(i, 1);
  }
}
