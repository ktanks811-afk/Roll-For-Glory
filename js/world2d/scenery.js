// Fills the empty ground around Fort Worth and gives it its landmarks:
// Sundance Square, the courthouse, the Stockyards (pens, coliseum, honky-tonk)
// and the Trinity River with its trail. Plus shrubs, hedges, pools and parked
// cars inside the city blocks, street trees, a ring of buildings along the
// outer streets, suburbs between the city and Loop 820, farms north of the
// loop, a Lake Worth beach neighbourhood and a little town on Chisholm Trail Pkwy. It has its own seed, so the original city stays exactly
// as it was. Nothing new is placed on a road, a race start or a business.
//
// Side streets ("lanes") are drawn as lots: you can drive on them, but they
// are not in the road graph, so traffic, police routing and the GPS ignore them.

import { BACKROAD } from './map.js';
import { GRID, HWY_Z, HWY_W, DESERT_Z, SEA_X, RIVER_X, TUNNEL, LOCATIONS, districtAt } from '../data/world.js';

const HOUSE_ROOFS = ['#6b3a2e', '#3f4a5a', '#5a4632', '#2f3b2f', '#6e6e6e', '#7a4b3a', '#4a3a4a', '#585048', '#3a4f5f'];
const SIX_ROOFS = ['#5a4632', '#6e6e6e', '#3f4a5a', '#7a4b3a', '#4a3a4a', '#585048', '#8a7a62', '#2f3b2f', '#6b3a2e'];
const MID_ROOFS = ['#5a5148', '#4d4b52', '#5e5a55', '#45474f', '#6a5f52', '#504a45'];
const IND_ROOFS = ['#6b6f75', '#5d6167', '#7a7e83', '#4f5358'];
const CAR_COLORS = ['#c41b1b', '#1b4fc4', '#e8e8e8', '#222326', '#8a8d93', '#2f6b3a', '#d9b21b', '#5a2a6a', '#b8b8bc', '#6a3a22', '#0f2a4a'];
const RUST = ['#6a3a22', '#7a5a3a', '#5a4a3a', '#8a4a2a', '#4a4038'];
const SHRUB = ['#2f5a2a', '#3a6a30', '#2a4f26', '#44702f', '#355f3a'];
const FLOWERS = ['#d12a8a', '#e8c21a', '#e8641a', '#f2f2f2', '#a01aff', '#ff4a5a'];
const CROPS = ['#55682e', '#6b7a34', '#7d7a3a', '#4a6a2c', '#8a7a3e', '#5e7238'];

const BRICK = ['#8a3b2a', '#7a4a32', '#9a5a3a', '#6e3a2a', '#a0583a', '#8a6a4a'];

export function addScenery({ roads, buildings, lots, trees, rocks, props, water, rng, Grid, onBackroad }) {
  const rnd = rng;
  const R = (a, b) => a + rnd() * (b - a);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const overlap = (a, b, pad = 0) => a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.z - pad < b.z + b.d && a.z + a.d + pad > b.z;
  const inside = (x, z, r) => x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d;

  // ---------------- Fort Worth landmarks: make room in their blocks ----------------
  const blockRect = (i, j) => ({ x: GRID[i] + 14, z: GRID[j] + 14, w: 122, d: 122 });
  const SQUARE = blockRect(6, 5), COURT = blockRect(5, 4), PENS = blockRect(6, 1), COLISEUM = blockRect(6, 2), HONKY = blockRect(7, 1);
  for (const r of [SQUARE, COURT, PENS, COLISEUM, HONKY]) {
    const inR = o => o.x >= r.x - 1 && o.z >= r.z - 1 && o.x + (o.w || 0) <= r.x + r.w + 1 && o.z + (o.d || 0) <= r.z + r.d + 1;
    keep(buildings, b => b.loc || !inR(b)); keep(lots, l => !inR(l)); keep(trees, t => !inR(t));
  }
  // the Stockyards are low brick and timber, not mid-rises
  for (const b of buildings) {
    if (b.loc || districtAt(b.x + b.w / 2, b.z + b.d / 2) !== 'Stockyards') continue;
    if (b.kind === 'midrise' || b.kind === 'store' || b.kind === 'tower') { b.color = pick(BRICK); b.h = Math.min(b.h, R(7, 15)); }
  }
  // Trinity River: north of Loop 820, joining the West Fork, bridges where the farm roads cross
  const TRINITY = { x: RIVER_X + 45, z: -1745, w: 2650 - RIVER_X - 45, d: 60 };
  const riverOut = [];
  {
    const gaps = [[-1080, 5], [0, 19], [540, 5]];          // the farm roads, and I-35W on its way north
    let x0 = TRINITY.x;
    for (const [gx, half] of [...gaps, [null, 0]]) {
      const x1 = gx == null ? TRINITY.x + TRINITY.w : gx - half;
      const w = { x: x0, z: TRINITY.z, w: x1 - x0, d: TRINITY.d, kind: 'river' };
      water.push(w); riverOut.push(w);
      if (gx != null) { buildings.push({ x: gx - half - 2, z: TRINITY.z - 4, w: half * 2 + 4, d: TRINITY.d + 8, h: 1, color: '#8a8b8f', kind: 'pier', noCollide: true }); x0 = gx + half; }
    }
  }

  // ---------------- what nothing may touch ----------------
  const roadGrid = new Grid(100);
  for (const e of roads.edges) {
    const h = e.width / 2;
    const r = { x: Math.min(e.ax, e.bx) - h, z: Math.min(e.az, e.bz) - h, w: Math.abs(e.bx - e.ax) + 2 * h, d: Math.abs(e.bz - e.az) + 2 * h };
    roadGrid.insert(r, r.x, r.z, r.x + r.w, r.z + r.d);
  }
  const solid = new Grid(50);
  const addSolid = b => solid.insert(b, b.x, b.z, b.x + b.w, b.z + b.d);
  buildings.forEach(addSolid);
  rocks.forEach(addSolid);
  const keepOut = [
    ...LOCATIONS.map(l => ({ x: l.x - 18, z: l.z - 18, w: 36, d: 36 })),
    { x: 0, z: 1130, w: 200, d: 850 },                                  // Ironline Dragway and its paddock
    { x: -100, z: 1655, w: 90, d: 90 },                                  // Last Chance Gas
    { x: RIVER_X - 60, z: -3300, w: 120, d: 2330 },                      // river
    { x: SEA_X, z: 240, w: 2400, d: 3200 },                              // harbor / sea
    { x: TUNNEL[0] - 60, z: HWY_Z - 340, w: TUNNEL[1] - TUNNEL[0] + 120, d: 680 },   // tunnel hill
    { x: TRINITY.x, z: TRINITY.z - 8, w: TRINITY.w, d: TRINITY.d + 16 },                 // Trinity River and its trail
  ];
  const lanes = [];   // side streets: houses and props stay off these too
  const keepGrid = new Grid(100);
  keepOut.forEach(k => keepGrid.insert(k, k.x, k.z, k.x + k.w, k.z + k.d));
  // any rect in the grid overlapping r? (no Set allocation: this runs tens of thousands of times)
  const hits = (grid, r, pad) => {
    const c = grid.cell;
    for (let i = Math.floor((r.x - pad) / c); i <= Math.floor((r.x + r.w + pad) / c); i++)
      for (let j = Math.floor((r.z - pad) / c); j <= Math.floor((r.z + r.d + pad) / c); j++) {
        const arr = grid.map.get(grid.key(i, j));
        if (arr) for (const o of arr) if (overlap(r, o, pad)) return true;
      }
    return false;
  };
  const BR = { x: -2400, z: -720, w: 1520, d: 440 };   // Cross Timbers Pass bounding box
  const blocked = (r, pad = 0, solids = true) => {
    if (hits(roadGrid, r, pad) || hits(keepGrid, r, 0)) return true;
    if (overlap(r, BR, 30) && onBackroad(r.x + r.w / 2, r.z + r.d / 2, Math.hypot(r.w, r.d) / 2 + 7 + pad)) return true;
    for (const l of lanes) if (overlap(r, l, pad)) return true;
    return solids && hits(solid, r, pad);
  };
  const addB = (b, pad = 1.5) => { if (blocked(b, pad)) return false; b.fill = true; buildings.push(b); addSolid(b); return true; };
  const lot = l => { lots.push(l); return l; };
  const lane = l => { l.kind = l.kind || 'lane'; lots.push(l); lanes.push(l); return l; };
  const shrub = (x, z, r = R(0.7, 1.5), c = pick(SHRUB)) => props.push({ k: 'shrub', x, z, r, c });
  const shrubIfClear = (x, z, r) => { if (!blocked({ x: x - 1, z: z - 1, w: 2, d: 2 }, 0.3)) shrub(x, z, r); };
  const hedge = (r) => props.push({ k: 'hedge', ...r });
  const tree = (x, z, r = R(2.5, 4.5), kind = 'tree') => trees.push({ x, z, r, kind });
  // a parked car (or truck) that you bump into; `along` = 'x' or 'z'
  const parked = (x, z, along, len = 4.5, wid = 1.9, color = pick(CAR_COLORS), pad = 0.2) =>
    addB(along === 'x' ? { x: x - len / 2, z: z - wid / 2, w: len, d: wid, h: 1.5, color, kind: 'parked' } : { x: x - wid / 2, z: z - len / 2, w: wid, d: len, h: 1.5, color, kind: 'parked' }, pad);
  // fill the stalls drawLots paints (every 3 m along x, a row at the top and bottom)
  const parkCars = (l, p = 0.45, colors = CAR_COLORS) => {
    if (l.d < 13) return;
    for (let sx = 3; sx < l.w - 3; sx += 3) {
      if (rnd() < p) parked(l.x + sx + 1.5, l.z + 3.5, 'z', 4.4, 1.9, pick(colors));
      if (rnd() < p) parked(l.x + sx + 1.5, l.z + l.d - 3.5, 'z', 4.4, 1.9, pick(colors));
    }
  };
  const nearLocation = (x, z, r) => LOCATIONS.some(l => Math.hypot(l.x - x, l.z - z) < r);

  landmarks();

  // ---------------- tidy-up: nothing grows in the sea ----------------
  const inSea = (x, z) => x > SEA_X - 4 && z > 246;
  keep(rocks, r => !(r.x + r.w > SEA_X - 4 && r.z + r.d > 246));
  keep(trees, t => !inSea(t.x, t.z));

  // ---------------- inside the existing city blocks ----------------
  const isLandmarkLot = l => LOCATIONS.some(loc => loc.block && loc.x > l.x - 20 && loc.x < l.x + l.w + 20 && loc.z > l.z - 20 && loc.z < l.z + l.d + 20) && l.w > 60;
  const cityLots = lots.slice();
  for (const l of cityLots) {
    if (l.kind === 'yard' && l.w < 40) backyard(l);
    else if (l.kind === 'park' && !l.lawn) parkDetails(l);
    else if (l.kind === 'parking' && !isLandmarkLot(l)) parkCars(l, 0.4);
  }
  for (const b of buildings.slice()) {
    if (b.kind === 'midrise' || b.kind === 'tower' || b.kind === 'store') {
      for (let k = 0; k < 3; k++) {          // planters and bushes against the walls
        const side = Math.floor(rnd() * 4), t = R(0.15, 0.85), off = R(1.4, 2.4);
        const x = side === 0 ? b.x + b.w * t : side === 1 ? b.x + b.w + off : side === 2 ? b.x + b.w * t : b.x - off;
        const z = side === 0 ? b.z - off : side === 1 ? b.z + b.d * t : side === 2 ? b.z + b.d + off : b.z + b.d * t;
        shrubIfClear(x, z, R(0.8, 1.3));
      }
      if (b.kind !== 'tower' && rnd() < 0.35) dumpster(b);
    } else if (b.kind === 'warehouse') {
      for (let k = 0; k < 5; k++) crate(b);
      if (rnd() < 0.7) dumpster(b);
    }
  }
  // street trees along the city sidewalks (not in front of businesses)
  for (const e of roads.edges) {
    if (e.kind !== 'city' || Math.abs(e.az) > 900 || Math.abs(e.bz) > 900) continue;
    const dist = districtAt((e.ax + e.bx) / 2, (e.az + e.bz) / 2);
    if (dist === 'Riverside Industrial' || dist === 'Lakeside') continue;
    const step = dist === 'Downtown' ? 18 : 24;
    for (let s = 20; s < e.len - 20; s += step) {
      for (const side of [-1, 1]) {
        const off = e.width / 2 + 4.2;
        const x = e.ax + e.dx * s - e.dz * off * side, z = e.az + e.dz * s + e.dx * off * side;
        if (nearLocation(x, z, 30) || Math.abs(x) > 905 || Math.abs(z) > 905) continue;
        if (blocked({ x: x - 1.6, z: z - 1.6, w: 3.2, d: 3.2 }, 0)) continue;
        tree(x, z, R(1.8, 2.6), 'street');
      }
    }
  }

  // ---------------- a ring of buildings along the outer streets ----------------
  for (let k = 0; k < GRID.length - 1; k++) {
    const from = GRID[k] + 14, to = GRID[k + 1] - 14, mid = (from + to) / 2;
    ringStrip('x', -900, -1, from, to, districtAt(mid, -950));   // north edge
    ringStrip('x', 900, 1, from, to, districtAt(mid, 950));      // south edge
    ringStrip('z', -900, -1, from, to, 'Arlington Heights'); // west edge
    ringStrip('z', 900, 1, from, to, districtAt(950, mid) === 'Lake Worth' ? 'Lakeside' : districtAt(940, mid));   // east edge
  }

  // ---------------- North Side suburbs between the city and Loop 820 ----------------
  clearTrees({ x: -985, z: -1290, w: 1970, d: 305 });
  for (const c of [-1045, -1150, -1255]) {
    for (const [a, b] of [[-892, -8], [8, 892]]) {
      lane({ x: a, z: c - 4.5, w: b - a, d: 9 });
      houseRow('x', c, 4.5, -1, a + 14, b - 14, { roofs: HOUSE_ROOFS, depth: c === -1255 ? 26 : 47 });   // back yards meet halfway
      houseRow('x', c, 4.5, 1, a + 14, b - 14, { roofs: HOUSE_ROOFS, depth: 47 });
    }
  }

  // ---------------- farms, forest and a truck stop north of the highway ----------------
  const CELL = 180, FX0 = -2700, FZ0 = HWY_Z - 60;               // cells run north from just past the shoulder pines
  const farmLanes = [
    lane({ x: -1080 - 3.5, z: -2860, w: 7, d: HWY_Z - HWY_W / 2 + 2860 + 1, kind: 'dirt' }),
    lane({ x: 540 - 3.5, z: -2860, w: 7, d: HWY_Z - HWY_W / 2 + 2860 + 1, kind: 'dirt' }),
    lane({ x: -1540, z: FZ0 - 4 * CELL - 3.5, w: 3940, d: 7, kind: 'dirt' }),
  ];
  for (let i = 0; i < 30; i++) for (let j = 0; j < 10; j++) {
    const x = FX0 + i * CELL, z = FZ0 - (j + 1) * CELL;
    const cell = { x: x + 8, z: z + 8, w: CELL - 16, d: CELL - 16 };
    if (j === 0 && (i === 16 || i === 17)) { if (i === 16) truckStop(x, z + CELL); continue; }
    if (j === 0 && i === 12) { motel(x, z + CELL); continue; }
    if (blocked(cell, 0)) { forest(cell, 0.5); continue; }
    const byLane = farmLanes.some(l => overlap(cell, l, 10));
    const r = rnd();
    if (byLane && r < 0.3) farmstead(cell, farmLanes.find(l => overlap(cell, l, 10)));
    else if (r < 0.6) field(cell);
    else if (r < 0.82) forest(cell, 1);
    else meadow(cell);
  }
  // the far west, past the farms, is all forest
  for (let k = 0; k < 500; k++) { const x = R(-3250, -2700), z = R(-3250, HWY_Z - 40); if (!blocked({ x, z, w: 1, d: 1 }, 2, false)) tree(x, z, R(3, 6), 'pine'); }

  // ---------------- West Hills: ranches, and cabins along Cross Timbers Pass ----------------
  for (let x = -3200; x < -1000; x += 200) for (let z = -950; z < 1000; z += 200) {
    const cell = { x: x + 10, z: z + 10, w: 180, d: 180 };
    if (overlap(cell, BR, 40) || blocked(cell, 0)) continue;
    const r = rnd();
    if (r < 0.18) farmstead(cell, null); else if (r < 0.4) field(cell);
  }
  for (let i = 0; i < BACKROAD.length - 1; i++) {
    const [ax, az] = BACKROAD[i], [bx, bz] = BACKROAD[i + 1], len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let s = 30; s < len - 20; s += 55) {
      if (rnd() < 0.35) continue;
      const side = rnd() < 0.5 ? -1 : 1, off = R(20, 30);
      const cx = ax + (bx - ax) * s / len + nx * off * side, cz = az + (bz - az) * s / len + nz * off * side;
      if (addB({ x: cx - 4.5, z: cz - 3.5, w: 9, d: 7, h: 5, color: pick(['#5a4632', '#6b3a2e', '#3f4a5a', '#4a3a2a']), kind: 'house' }, 1)) {
        lot({ x: cx - 9, z: cz - 8, w: 18, d: 16, kind: 'dirt' });
        if (rnd() < 0.5) parked(cx + 7, cz, 'z', 5.2, 2, pick([...CAR_COLORS, ...RUST]));
      }
    }
  }

  // ---------------- Stop Six: the historic east side ----------------
  // Tight streets of small single-family homes, corner stores and churches
  // at the crossings, Dunbar High with its football field, and Cobb Park.
  const SIX_EW = [-750, -600, -450, -300, -150, 0], SIX_NS = [1500, 2100], SIX_X1 = 2620;
  for (const c of SIX_EW) lane({ x: 908, z: c - 4.5, w: SIX_X1 - 908 + 4.5, d: 9 });
  for (const c of SIX_NS) lane({ x: c - 4.5, z: -754.5, w: 9, d: 759 });
  lane({ x: SIX_X1 - 4.5, z: -754.5, w: 9, d: 945 });
  // Dunbar High School
  addB({ x: 1010, z: -990, w: 120, d: 44, h: 12, color: '#8a4a32', kind: 'landmark', label: 'Dunbar High School', labelColor: '#e8c21a' }, 0);
  lot({ x: 1145, z: -995, w: 130, d: 76, kind: 'track' });
  lot({ x: 1155, z: -985, w: 110, d: 56, kind: 'gridiron' });
  addB({ x: 1160, z: -916, w: 100, d: 5, h: 3, color: '#9aa0a8', kind: 'crate' }, 0);   // bleachers
  parkCars(lot({ x: 1010, z: -936, w: 120, d: 104, kind: 'parking' }), 0.35);
  lot({ x: 1150, z: -898, w: 28, d: 15, kind: 'court' }); lot({ x: 1185, z: -898, w: 28, d: 15, kind: 'court' });
  addB({ x: 1225, z: -900, w: 45, d: 30, h: 8, color: '#7a4a32', kind: 'store' }, 0.5);   // gym
  for (let x = 1290; x < 1380; x += 9) tree(x, -985 + R(0, 150), R(3, 5));
  // Cobb Park
  cityPark({ x: 1970, z: -990, w: 640, d: 165 });
  for (let k = 0; k < 60; k++) tree(R(1975, 2605), R(-985, -830), R(3, 6));
  addB({ x: 2270, z: -925, w: 18, d: 10, h: 4, color: '#6a5a4a', kind: 'store', label: 'Cobb Park', labelColor: '#9fe870' }, 0.5);
  // corner stores and churches where the streets cross
  for (const x of [...SIX_NS, SIX_X1]) for (const z of SIX_EW) {
    const r = rnd(), sx = rnd() < 0.5 ? -1 : 1, sz = rnd() < 0.5 ? -1 : 1;
    if (r < 0.4) {
      const w = 15, d = 12, bx = sx > 0 ? x + 8 : x - 8 - w, bz = sz > 0 ? z + 14 : z - 14 - d;
      if (addB({ x: bx, z: bz, w, d, h: 4.5, color: pick(['#c8b28a', '#8a8d93', '#b8574a', '#5a6a7a']), kind: 'store' }, 0.5))
        lot({ x: bx, z: sz > 0 ? z + 5.5 : z - 13.5, w, d: 8, kind: 'lot' });
    } else if (r < 0.7) {
      const w = 16, d = 26, bx = sx > 0 ? x + 9 : x - 9 - w, bz = sz > 0 ? z + 9 : z - 9 - d;
      addB({ x: bx, z: bz, w, d, h: 9, color: pick(['#e8e2d8', '#8a3b2a', '#d7d2c4', '#7a4a32']), kind: 'church' }, 0.5);
    }
  }
  const SIX = { roofs: SIX_ROOFS, depth: 64, pitch: 21, small: true };
  const cuts = [920, ...SIX_NS, SIX_X1];
  for (const c of SIX_EW) for (let k = 0; k < cuts.length - 1; k++) {
    const from = cuts[k] + (k ? 6 : 6), to = cuts[k + 1] - 6;
    houseRow('x', c, 4.5, -1, from, to, SIX); houseRow('x', c, 4.5, 1, from, to, SIX);
  }
  houseRow('z', SIX_X1, 4.5, 1, -745, 180, { ...SIX, depth: 34 });

  // ---------------- Lake Worth: a beach and a lighthouse ----------------
  lot({ x: SEA_X + 10, z: 196, w: 3200 - SEA_X - 10, d: 54, kind: 'sand' });
  for (let x = SEA_X + 30; x < 3180; x += 34) tree(x + R(-4, 4), 212 + R(-4, 4), 3, 'palm');
  for (let x = SEA_X + 40; x < 3120; x += R(14, 30)) {   // umbrellas and towels
    if (rnd() < 0.3) continue;
    const ux = x, uz = R(222, 244);
    props.push({ k: 'towel', x: ux - 0.9, z: uz + 1.4, w: 1.8, d: 0.9, c: pick(FLOWERS) });
    props.push({ k: 'umbrella', x: ux, z: uz, r: R(1.4, 1.9), c: pick(['#c41b1b', '#1b4fc4', '#e8c21a', '#2f6b3a', '#d12a8a', '#e8641a']) });
  }
  for (let x = 1300; x < 3100; x += 420) addB({ x, z: 228, w: 3, d: 3, h: 4, color: '#c41b1b', kind: 'hut' }, 0);
  buildings.push({ x: 1700, z: 250, w: 12, d: 160, h: 1, color: '#6b5a44', kind: 'pier', noCollide: true });
  addB({ x: 3150, z: 200, w: 12, d: 12, h: 26, color: '#f2f2f2', kind: 'lighthouse', round: true }, 0);
  // the open ground between the shore streets
  for (const band of [{ z: -1325, d: 325, x0: 1000 }, { z: -1000, d: 400, x0: 2660 }, { z: -600, d: 400, x0: 2660 }, { z: -200, d: 390, x0: 2660 }]) {
    for (let x = band.x0; x < 3200; x += 200) {
      const cell = { x: x + 10, z: band.z + 10, w: 180, d: band.d - 20 };
      if (blocked(cell, 0)) { forest(cell, 0.4); continue; }
      const r = rnd();
      if (r < 0.3) forest(cell, 0.8); else if (r < 0.55) field(cell); else if (r < 0.75) cityPark(cell); else meadow(cell);
    }
  }

  // ---------------- Chisholm Flats: a little town on Chisholm Trail Pkwy ----------------
  const town = [{ x: -260, z: 1780, w: 245, d: 620 }, { x: 14, z: 1985, w: 240, d: 420 }];
  for (const t of town) { keep(rocks, r => !overlap(r, t, 4)); keep(trees, tr => !inside(tr.x, tr.z, t)); }
  rebuildSolid();
  desertTown();
  // solar farm east of Chisholm Trail Pkwy
  for (let r = 0; r < 14; r++) for (let q = 0; q < 3; q++) {
    const p = { x: 320 + q * 110, z: 2200 + r * 18, w: 96, d: 7, h: 1.2, color: '#1d2a44', kind: 'solar' };
    if (!blocked(p, 1)) { p.fill = true; buildings.push(p); addSolid(p); }
  }
  // sagebrush all over the desert
  for (let k = 0; k < 1400; k++) {
    const x = R(-2900, 2900), z = R(DESERT_Z + 15, 3250);
    if (Math.abs(x) < 14 || inSea(x, z)) continue;
    if (keepOut.some(r => inside(x, z, r))) continue;
    props.push({ k: 'sage', x, z, r: R(0.6, 1.3), c: pick(['#7d7a4a', '#8a8150', '#6e6d44', '#9a8a5a']) });
  }
  // little bushes across the grassland and the west hills
  for (let k = 0; k < 1600; k++) {
    const x = R(-3200, 3200), z = R(-3200, DESERT_Z - 10);
    if (Math.abs(x) < 990 && Math.abs(z) < 990) continue;
    if (blocked({ x: x - 1, z: z - 1, w: 2, d: 2 }, 1)) continue;
    shrub(x, z, R(0.8, 1.8));
  }

  // nothing grows through a roof or a side street
  const clearRects = buildings.filter(b => !b.noCollide && b.kind !== 'parked').concat(lanes, lots.filter(l => l.kind === 'pond' || l.kind === 'court' || l.kind === 'pool' || l.kind === 'drive' || l.kind === 'parking' || l.kind === 'lot' || l.kind === 'junk'));
  const clearGrid = new Grid(60);
  clearRects.forEach(r => clearGrid.insert(r, r.x, r.z, r.x + r.w, r.z + r.d));
  const at = (x, z) => clearGrid.map.get(clearGrid.key(Math.floor(x / 60), Math.floor(z / 60))) || [];
  keep(trees, t => { for (const r of at(t.x, t.z)) if (t.x > r.x - 0.5 && t.x < r.x + r.w + 0.5 && t.z > r.z - 0.5 && t.z < r.z + r.d + 0.5) return false; return true; });
  keep(props, p => {
    if (p.k !== 'shrub' && p.k !== 'sage') return true;
    for (const r of at(p.x, p.z)) if (inside(p.x, p.z, r)) return false;
    return true;
  });

  return { water: riverOut };

  // ================= builders =================

  function landmarks() {
    const put = b => { b.fill = true; buildings.push(b); addSolid(b); return b; };
    // Sundance Square: brick plaza, fountain, brick buildings around the edge, cafe umbrellas
    {
      const r = SQUARE;
      lot({ ...r, kind: 'plaza' });
      put({ x: r.x + 4, z: r.z + 4, w: 40, d: 30, h: 22, color: '#8a3b2a', kind: 'midrise', label: 'Sundance Square', labelColor: '#e8c21a' });
      put({ x: r.x + r.w - 44, z: r.z + 4, w: 40, d: 30, h: 16, color: '#9a5a3a', kind: 'midrise' });
      put({ x: r.x + 4, z: r.z + r.d - 30, w: 34, d: 26, h: 18, color: '#7a4a32', kind: 'midrise' });
      put({ x: r.x + r.w - 38, z: r.z + r.d - 30, w: 34, d: 26, h: 26, color: '#6e3a2a', kind: 'midrise' });
      put({ x: r.x + r.w / 2 - 6, z: r.z + r.d / 2 - 6, w: 12, d: 12, h: 1.4, color: '#7fb8d8', kind: 'fountain', round: true });
      for (let k = 0; k < 10; k++) {
        const a = k / 10 * Math.PI * 2;
        props.push({ k: 'umbrella', x: r.x + r.w / 2 + Math.cos(a) * 24, z: r.z + r.d / 2 + Math.sin(a) * 18, r: 1.6, c: pick(['#c41b1b', '#1b4fc4', '#2f6b3a', '#e8c21a']) });
      }
      for (let k = 0; k < 8; k++) shrub(r.x + 50 + k * 3.4, r.z + 36, 1.1);
      for (let k = 0; k < 8; k++) shrub(r.x + 50 + k * 3.4, r.z + r.d - 36, 1.1);
    }
    // Tarrant County Courthouse: pink granite on a lawn
    {
      const r = COURT;
      lot({ ...r, kind: 'park', lawn: true });
      put({ x: r.x + 26, z: r.z + 30, w: 70, d: 56, h: 24, color: '#c9a68a', kind: 'landmark', label: 'Tarrant County Courthouse', labelColor: '#ffffff' });
      put({ x: r.x + r.w / 2 - 7, z: r.z + 34, w: 14, d: 14, h: 34, color: '#d8c0a8', kind: 'dome', round: true });
      for (let s = 6; s < r.w - 6; s += 8) { tree(r.x + s, r.z + 8, R(2.5, 3.5)); tree(r.x + s, r.z + r.d - 8, R(2.5, 3.5)); }
    }
    // Stockyards: cattle pens with fences, cows, a barn
    {
      const r = PENS;
      lot({ ...r, kind: 'dirt' });
      const pw = 28, pd = 36;
      for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) {
        if (a === 0 && b === 0) continue;
        const px = r.x + 3 + a * (pw + 2), pz = r.z + 3 + b * (pd + 3);
        hedge({ x: px, z: pz, w: pw, d: 0.4, fence: true }); hedge({ x: px, z: pz + pd, w: pw, d: 0.4, fence: true });
        hedge({ x: px, z: pz, w: 0.4, d: pd, fence: true }); hedge({ x: px + pw, z: pz, w: 0.4, d: pd - 6, fence: true });
        const n = 3 + Math.floor(rnd() * 6);
        for (let k = 0; k < n; k++) props.push({ k: 'cow', x: px + R(3, pw - 3), z: pz + R(3, pd - 3), r: 1.1, a: R(0, Math.PI), c: pick(['#5a3a22', '#2a2422', '#8a5a3a', '#e8e2d8', '#6a4a32']) });
      }
      put({ x: r.x + 4, z: r.z + 4, w: 24, d: 30, h: 9, color: '#8a2e24', kind: 'barn' });
    }
    // Cowtown Coliseum with its lot
    {
      const r = COLISEUM;
      const pl = lot({ x: r.x, z: r.z + 66, w: r.w, d: r.d - 66, kind: 'parking' });
      put({ x: r.x + 16, z: r.z + 6, w: 90, d: 54, h: 15, color: '#b8693f', kind: 'landmark', label: 'Cowtown Coliseum', labelColor: '#e8c21a' });
      parkCars(pl, 0.5);
    }
    // a big honky-tonk on the north side
    {
      const r = HONKY;
      const pl = lot({ x: r.x, z: r.z + 56, w: r.w, d: r.d - 56, kind: 'parking' });
      put({ x: r.x + 6, z: r.z + 6, w: 110, d: 46, h: 10, color: '#5a4632', kind: 'landmark', label: 'Cowtown Honky-Tonk', labelColor: '#ff4a5a' });
      parkCars(pl, 0.6);
    }
    // Trinity Trail along the south bank
    lot({ x: TRINITY.x, z: TRINITY.z + TRINITY.d + 1, w: TRINITY.w, d: 3, kind: 'trail' });
    for (let x = TRINITY.x + 10; x < TRINITY.x + TRINITY.w; x += R(14, 30)) { const tz = TRINITY.z + TRINITY.d + R(6, 12), r = R(3, 5); if (Math.abs(x) > 26) tree(x, tz, r); }
  }

  function rebuildSolid() { solid.map.clear(); buildings.forEach(addSolid); rocks.forEach(addSolid); }

  function clearTrees(r) { keep(trees, t => !inside(t.x, t.z, r)); }

  function backyard(l) {
    const tries = (n, fn) => { for (let k = 0; k < n; k++) if (fn()) return true; return false; };
    if (rnd() < 0.35) tries(6, () => {
      const p = { x: l.x + R(1.5, l.w - 8.5), z: l.z + R(1.5, l.d - 5.5), w: 7, d: 4 };
      if (blocked(p, 1.2)) return false;
      props.push({ k: 'pool', ...p }); solid.insert(p, p.x, p.z, p.x + p.w, p.z + p.d); return true;
    });
    if (rnd() < 0.75) hedge({ x: l.x + l.w - 0.9, z: l.z + 1, w: 0.9, d: l.d - 2 });
    if (rnd() < 0.75) hedge({ x: l.x + 1, z: l.z + l.d - 0.9, w: l.w - 2, d: 0.9 });
    const n = 2 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) shrubIfClear(l.x + R(2, l.w - 2), l.z + R(2, l.d - 2), R(0.6, 1.2));
    if (rnd() < 0.3) { const fx = l.x + R(2, l.w - 6), fz = l.z + R(2, l.d - 3); if (!blocked({ x: fx, z: fz, w: 4, d: 1.4 }, 0.3)) props.push({ k: 'flowers', x: fx, z: fz, w: 4, d: 1.4, c: pick(FLOWERS) }); }
  }

  function parkDetails(l) {
    // bushes around the edge, gaps where the paths come out
    for (let s = 3; s < l.w - 3; s += R(4, 7)) {
      if (Math.abs(s - l.w / 2) < 4) continue;
      shrub(l.x + s, l.z + 1.6); shrub(l.x + s, l.z + l.d - 1.6);
    }
    for (let s = 3; s < l.d - 3; s += R(4, 7)) {
      if (Math.abs(s - l.d / 2) < 4) continue;
      shrub(l.x + 1.6, l.z + s); shrub(l.x + l.w - 1.6, l.z + s);
    }
    const q = [[0, 0], [1, 0], [0, 1], [1, 1]].sort(() => rnd() - 0.5);
    const qw = l.w / 2 - 6, qd = l.d / 2 - 6;
    const qr = ([a, b]) => ({ x: l.x + 4 + a * (l.w / 2 + 2), z: l.z + 4 + b * (l.d / 2 + 2), w: qw - 4, d: qd - 4 });
    if (rnd() < 0.6) { const r = qr(q[0]); const p = lot({ x: r.x + 4, z: r.z + 6, w: r.w - 8, d: r.d - 12, kind: 'pond' }); clearTrees({ x: p.x - 2, z: p.z - 2, w: p.w + 4, d: p.d + 4 }); }
    if (rnd() < 0.5) { const r = qr(q[1]); const c = lot({ x: r.x + (r.w - 28) / 2, z: r.z + (r.d - 15) / 2, w: 28, d: 15, kind: 'court' }); clearTrees({ x: c.x - 3, z: c.z - 3, w: c.w + 6, d: c.d + 6 }); }
    // flowerbed in the middle and benches along the paths
    props.push({ k: 'flowers', x: l.x + l.w / 2 - 4, z: l.z + l.d / 2 - 4, w: 8, d: 8, c: pick(FLOWERS), round: true });
    for (let k = 0; k < 4; k++) {
      const t = R(0.12, 0.38) + (k & 1 ? 0.5 : 0);
      if (k < 2) props.push({ k: 'bench', x: l.x + l.w * t, z: l.z + l.d / 2 + 2.2, w: 2.4, d: 0.8 });
      else props.push({ k: 'bench', x: l.x + l.w / 2 + 2.2, z: l.z + l.d * t, w: 0.8, d: 2.4 });
    }
  }

  function cityPark(c) {
    const l = lot({ ...c, kind: 'park' });
    for (let k = 0; k < 14; k++) tree(c.x + R(4, c.w - 4), c.z + R(4, c.d - 4), R(3, 6));
    parkDetails(l);
  }

  function dumpster(b) {
    for (let k = 0; k < 4; k++) {
      const alongX = rnd() < 0.5;
      const x = alongX ? b.x + R(1, b.w - 4) : (rnd() < 0.5 ? b.x - 2.6 : b.x + b.w + 0.6);
      const z = alongX ? (rnd() < 0.5 ? b.z - 2.6 : b.z + b.d + 0.6) : b.z + R(1, b.d - 4);
      if (addB({ x, z, w: alongX ? 3 : 2, d: alongX ? 2 : 3, h: 1.6, color: pick(['#2f6b3a', '#1b4fc4', '#5a5f69']), kind: 'dumpster' }, 0.6)) return;
    }
  }

  function crate(b) {
    for (let k = 0; k < 3; k++) {
      const side = Math.floor(rnd() * 4), t = R(0.05, 0.9), off = R(1.2, 6);
      const s = R(1.6, 2.6), h = R(1.2, 2.6);
      const x = side === 0 ? b.x + b.w * t : side === 1 ? b.x + b.w + off : side === 2 ? b.x + b.w * t : b.x - off - s;
      const z = side === 0 ? b.z - off - s : side === 1 ? b.z + b.d * t : side === 2 ? b.z + b.d + off : b.z + b.d * t;
      if (addB({ x, z, w: s, d: s, h, color: pick(['#8a6a3a', '#7a5a32', '#6a5a4a', '#9a7a42']), kind: 'crate' }, 0.6)) return;
    }
  }

  // Houses along one side of a street. axis 'x': the street runs along x at
  // z = c ('z': along z at x = c). dir: which side (+1 = +z / +x). u runs along
  // the street, v away from its centreline.
  function houseRow(axis, c, half, dir, from, to, st) {
    const pitch = st.pitch || 26, depth = st.depth || 32;
    const rect = (u0, u1, v0, v1) => {
      const a = c + dir * v0, b = c + dir * v1, lo = Math.min(a, b), hi = Math.max(a, b);
      return axis === 'x' ? { x: u0, z: lo, w: u1 - u0, d: hi - lo } : { x: lo, z: u0, w: hi - lo, d: u1 - u0 };
    };
    const pt = (u, v) => axis === 'x' ? { x: u, z: c + dir * v } : { x: c + dir * v, z: u };
    for (let u = from; u + pitch <= to; u += pitch) {
      const yard = rect(u + 0.5, u + pitch - 0.5, half + 2, half + depth);
      if (blocked(yard, 0)) continue;
      if (rnd() < 0.08) {                                    // an empty lot: grass and a tree or two
        lot({ ...yard, kind: 'yard' });
        for (let k = 0; k < 3; k++) { const p = pt(u + R(3, pitch - 3), half + R(4, depth - 3)); tree(p.x, p.z, R(2.5, 4)); }
        continue;
      }
      const hw = st.small ? R(9, Math.min(12, pitch - 5)) : R(12, Math.min(16, pitch - 6)), hd = st.small ? R(8, 10) : R(10, 13), set = half + R(5, 8);
      const off = u + R(1.5, pitch - hw - 1.5);
      const house = { ...rect(off, off + hw, set, set + hd), h: R(5, 8), color: pick(st.roofs), kind: 'house' };
      lot({ ...yard, kind: 'yard' });
      if (!addB(house, 0.5)) continue;
      // driveway from the street to the side of the house, sometimes a car on it
      const du = rnd() < 0.5 ? off - 3.8 : off + hw + 0.4;
      if (du > u + 0.6 && du + 3.4 < u + pitch - 0.6) {
        lot({ ...rect(du, du + 3.4, half, set + 6), kind: 'drive' });
        if (rnd() < 0.45) { const p = pt(du + 1.7, half + 4); parked(p.x, p.z, axis === 'x' ? 'z' : 'x'); }
      }
      if (rnd() < 0.6) hedge(rect(u + 0.5, u + pitch - 0.5, half + depth - 0.9, half + depth));
      if (rnd() < 0.4) hedge(rect(u + pitch - 1.4, u + pitch - 0.5, set + hd + 1, half + depth));
      for (let k = 0; k < 3; k++) { const p = pt(off + R(0, hw), set - R(1, 2.2)); shrubIfClear(p.x, p.z, R(0.6, 1.1)); }
      if (rnd() < 0.3 && set + hd + 8 < half + depth) {
        const pu = off + R(0, Math.max(0, hw - 7));
        const p = rect(pu, pu + 7, set + hd + 2.5, set + hd + 6.5);
        if (!blocked(p, 0.5)) { props.push({ k: 'pool', ...p }); solid.insert(p, p.x, p.z, p.x + p.w, p.z + p.d); }
      }
      if (rnd() < 0.65) { const p = pt(u + R(3, pitch - 3), set + hd + R(3, depth - hd - (set - half) - 3)); tree(p.x, p.z, R(2.5, 4)); }
    }
  }

  // One outer-street frontage: 122 m along the street, 68 m deep.
  function ringStrip(axis, c, dir, from, to, district) {
    const rect = (u0, u1, v0, v1) => {
      const a = c + dir * v0, b = c + dir * v1, lo = Math.min(a, b), hi = Math.max(a, b);
      return axis === 'x' ? { x: u0, z: lo, w: u1 - u0, d: hi - lo } : { x: lo, z: u0, w: hi - lo, d: u1 - u0 };
    };
    if (district === 'Arlington Heights') {
      houseRow(axis, c, 14, dir, from, to, { roofs: HOUSE_ROOFS, depth: 66, pitch: 30 });
      for (let k = 0; k < 4; k++) { const u = R(from + 4, to - 4), v = R(58, 78); tree(axis === 'x' ? u : c + dir * v, axis === 'x' ? c + dir * v : u, R(3, 5)); }
    } else if (district === 'Riverside Industrial' || district === 'Lakeside') {
      const yard = lot({ ...rect(from + 2, to - 2, 16, 34), kind: 'parking' });
      const wh = { ...rect(from + 4, to - 4, 36, 36 + R(26, 40)), h: R(9, 16), color: pick(IND_ROOFS), kind: 'warehouse' };
      if (addB(wh)) { for (let k = 0; k < 6; k++) crate(wh); }
      parkCars(yard, 0.25, ['#e8e8e8', '#8a8d93', '#c41b1b', '#1b4fc4', '#d9b21b']);
    } else {
      const pl = lot({ ...rect(from + 2, to - 2, 16, 33), kind: 'parking' });
      parkCars(pl, 0.4);
      const n = rnd() < 0.5 ? 2 : 3, g = 4, s = (to - from - 4 - g * (n - 1)) / n;
      for (let k = 0; k < n; k++) {
        const u0 = from + 2 + k * (s + g);
        const b = { ...rect(u0, u0 + s - R(0, 4), 36, 36 + R(18, 40)), h: R(8, 30), color: pick(MID_ROOFS), kind: rnd() < 0.5 ? 'store' : 'midrise' };
        addB(b);
      }
      for (let u = from + 4; u < to - 4; u += 7) { const r = rect(u, u, 34.6, 34.6); shrubIfClear(r.x, r.z, R(0.7, 1.1)); }
    }
  }

  function field(c) {
    const l = lot({ ...c, kind: 'field', c: pick(CROPS), dir: rnd() < 0.5 ? 'x' : 'z' });
    if (rnd() < 0.5) for (let s = 4; s < c.w; s += R(7, 11)) tree(c.x + s, c.z - 5, R(3, 4.5));   // windbreak
    if (rnd() < 0.25) addB({ x: c.x + R(10, c.w - 20), z: c.z + c.d + 1, w: 8, d: 5, h: 3, color: '#7a4b3a', kind: 'shed' }, 0);
    return l;
  }

  function forest(c, density) {
    const n = Math.floor(48 * density);
    for (let k = 0; k < n; k++) {
      const x = c.x + R(0, c.w), z = c.z + R(0, c.d);
      if (blocked({ x: x - 1, z: z - 1, w: 2, d: 2 }, 2, false)) continue;
      tree(x, z, R(3, 6), rnd() < 0.65 ? 'pine' : 'tree');
    }
  }

  function meadow(c) {
    for (let k = 0; k < 6; k++) tree(c.x + R(0, c.w), c.z + R(0, c.d), R(3, 6));
    for (let k = 0; k < 30; k++) shrub(c.x + R(0, c.w), c.z + R(0, c.d), R(0.8, 1.8));
  }

  function farmstead(c, ln) {
    // house + barn + silo on a yard next to the farm lane, fields behind
    const vertical = ln && ln.w < ln.d;
    const yard = !ln ? { x: c.x, z: c.z, w: 90, d: 70 } : vertical
      ? { x: ln.x < c.x + c.w / 2 ? c.x : c.x + c.w - 70, z: c.z + 20, w: 70, d: 90 }
      : { x: c.x + 30, z: ln.z < c.z + c.d / 2 ? c.z : c.z + c.d - 70, w: 100, d: 70 };
    lot({ ...yard, kind: 'dirt' });
    addB({ x: yard.x + 8, z: yard.z + 8, w: 16, d: 12, h: 7, color: pick(HOUSE_ROOFS), kind: 'house' }, 0.5);
    addB({ x: yard.x + 34, z: yard.z + 30, w: 24, d: 18, h: 10, color: '#8a2e24', kind: 'barn' }, 0.5);
    addB({ x: yard.x + 12, z: yard.z + 40, w: 8, d: 8, h: 16, color: '#b8bcc2', kind: 'silo', round: true }, 0.5);
    parked(yard.x + 30, yard.z + 12, 'x', 5.6, 2.1, pick(['#c41b1b', '#2f6b3a', '#e8e8e8', '#0f2a4a']));
    for (let k = 0; k < 6; k++) tree(yard.x + R(0, yard.w), yard.z + R(0, yard.d), R(3, 5));
    // the rest of the cell is crops
    const rest = !ln ? { x: c.x, z: c.z + 76, w: c.w, d: c.d - 76 } : vertical
      ? { x: yard.x === c.x ? c.x + 76 : c.x, z: c.z, w: c.w - 76, d: c.d }
      : { x: c.x, z: yard.z === c.z ? c.z + 76 : c.z, w: c.w, d: c.d - 76 };
    if (rest.w > 30 && rest.d > 30) lot({ ...rest, kind: 'field', c: pick(CROPS), dir: rnd() < 0.5 ? 'x' : 'z' });
  }

  // Truck stop on the north shoulder: a big lot of parked rigs, a diner and a shop.
  function truckStop(x, zEdge) {
    const z = zEdge - 4;
    const pl = lot({ x: x + 10, z: z - 150, w: 340, d: 150, kind: 'lot' });
    addB({ x: x + 30, z: z - 140, w: 40, d: 22, h: 7, color: '#c8b28a', kind: 'store' }, 0);
    addB({ x: x + 80, z: z - 140, w: 30, d: 18, h: 6, color: '#7a2e24', kind: 'store' }, 0);
    for (const tz of [z - 122, z - 72, z - 30]) for (let k = 0; k < 26; k++) {
      if (rnd() < 0.3) continue;
      parked(x + 150 + k * 7, tz, 'z', 20, 2.6, pick(['#e8e8e8', '#c41b1b', '#1b4fc4', '#222326', '#d9b21b', '#2f6b3a']), 0.4);
    }
    for (let k = 0; k < 4; k++) addB({ x: x + 135, z: z - 140 + k * 34, w: 4, d: 10, h: 1.6, color: '#9aa0a8', kind: 'crate' }, 0);   // diesel islands
    parkCars(lot({ x: x + 30, z: z - 112, w: 90, d: 24, kind: 'parking' }), 0.5);
    for (let s = 14; s < 340; s += 9) shrub(x + 10 + s, z - 152);
    return pl;
  }

  function motel(x, zEdge) {
    const z = zEdge - 4;
    const pl = lot({ x: x + 20, z: z - 70, w: 140, d: 66, kind: 'parking' });
    addB({ x: x + 20, z: z - 110, w: 140, d: 16, h: 7, color: '#6a4a3a', kind: 'store' }, 0);
    addB({ x: x + 20, z: z - 94, w: 16, d: 20, h: 7, color: '#6a4a3a', kind: 'store' }, 0);
    props.push({ k: 'pool', x: x + 120, z: z - 90, w: 14, d: 7 });
    parkCars(pl, 0.45);
    for (let k = 0; k < 6; k++) tree(x + R(5, 175), z - R(115, 170), R(3, 5));
  }

  function desertTown() {
    // motel and diner on the west side of the road
    lot({ x: -150, z: 1790, w: 132, d: 30, kind: 'lot' });
    addB({ x: -150, z: 1822, w: 110, d: 14, h: 6, color: '#b8693f', kind: 'store' }, 0);
    addB({ x: -150, z: 1836, w: 14, d: 34, h: 6, color: '#b8693f', kind: 'store' }, 0);
    props.push({ k: 'pool', x: -120, z: 1845, w: 12, d: 6 });
    for (let k = 0; k < 14; k++) if (rnd() < 0.4) parked(-145 + k * 9, 1794, 'z', 4.5, 1.9, pick([...CAR_COLORS, ...RUST]));
    lot({ x: -110, z: 1900, w: 92, d: 34, kind: 'lot' });
    addB({ x: -100, z: 1936, w: 40, d: 18, h: 5, color: '#e8e8e8', kind: 'store' }, 0);
    for (let k = 0; k < 8; k++) if (rnd() < 0.5) parked(-104 + k * 10, 1904, 'z');
    addB({ x: -60, z: 1990, w: 9, d: 9, h: 18, color: '#9aa0a8', kind: 'watertower', round: true }, 0);
    // junkyard: a fenced lot full of wrecks
    const jy = lot({ x: -230, z: 2150, w: 140, d: 120, kind: 'junk' });
    hedge({ x: jy.x, z: jy.z, w: jy.w, d: 0.5, fence: true }); hedge({ x: jy.x, z: jy.z + jy.d - 0.5, w: jy.w, d: 0.5, fence: true });
    hedge({ x: jy.x, z: jy.z, w: 0.5, d: jy.d, fence: true }); hedge({ x: jy.x + jy.w - 0.5, z: jy.z + 20, w: 0.5, d: jy.d - 20, fence: true });
    for (let k = 0; k < 40; k++) parked(jy.x + R(6, jy.w - 6), jy.z + R(6, jy.d - 6), rnd() < 0.5 ? 'x' : 'z', 4.4, 1.9, pick(RUST), 0.6);
    addB({ x: jy.x + 8, z: jy.z + 8, w: 14, d: 10, h: 4, color: '#5a5f69', kind: 'shed' }, 0);
    // trailer park on the east side, past the dragway
    const tp = lot({ x: 20, z: 2010, w: 200, d: 360, kind: 'dirt' });
    lane({ x: 14, z: 2186, w: 206, d: 8, kind: 'lane' });
    for (let k = 0; k < 9; k++) for (const s of [-1, 1]) {
      if (rnd() < 0.15) continue;
      const tx = 30 + k * 21, tz = s < 0 ? 2186 - 6 - 14 : 2194 + 6;
      if (addB({ x: tx, z: tz, w: 5, d: 14, h: 3.4, color: pick(['#d7d2c4', '#c9b38f', '#9aa0a8', '#e0ddd2', '#8fa6b3']), kind: 'trailer' }, 0.5) && rnd() < 0.5)
        parked(tx + 9, tz + 7, 'z', 4.6, 1.9, pick([...CAR_COLORS, ...RUST]));
    }
    for (let k = 0; k < 8; k++) shrub(tp.x + R(0, tp.w), tp.z + R(0, tp.d), R(0.8, 1.4), '#7d7a4a');
  }
}

function keep(arr, fn) { let j = 0; for (let i = 0; i < arr.length; i++) if (fn(arr[i])) arr[j++] = arr[i]; arr.length = j; }
