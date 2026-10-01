// Port Solace map content: districts, buildings, lots, trees, water,
// landmarks and colliders. Generated from a fixed seed so the city is the
// same every time you play.

import { GRID, BLOCK, ROAD_W, HWY_Z, HWY_X, HWY_W, DESERT_Z, DESERT_ROAD_END, RIVER_X, TUNNEL, SEA_X, LOCATIONS, districtAt } from '../data/world.js';
import { buildRoads } from './roads.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const ROOFS = {
  downtown: ['#3a3f4a', '#2f343d', '#454b57', '#353a44', '#2a2e36', '#4b515c'],
  mid: ['#5a5148', '#4d4b52', '#5e5a55', '#45474f', '#6a5f52', '#504a45'],
  industrial: ['#6b6f75', '#5d6167', '#7a7e83', '#4f5358'],
  residential: ['#6b3a2e', '#3f4a5a', '#5a4632', '#2f3b2f', '#6e6e6e', '#7a4b3a', '#4a3a4a'],
  harbor: ['#58606a', '#6b4f3a', '#3d5a6b'],
};

export function buildMap() {
  const rnd = mulberry32(1337);
  const R = (a, b) => a + rnd() * (b - a);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const roads = buildRoads();
  const buildings = [];   // { x, z, w, d, h, color, kind, label? }
  const lots = [];        // { x, z, w, d, kind: 'parking'|'park'|'yard'|'gas' }
  const trees = [];       // { x, z, r, kind: 'tree'|'pine'|'cactus'|'palm' }
  const water = [];       // { x, z, w, d }
  const rocks = [];       // { x, z, w, d, h, color } desert mesas
  const hills = [];       // { x, z, r }
  const signs = [];       // { x, z, text, color }

  const half = BLOCK / 2;
  const inset = ROAD_W / 2 + 6;          // road half width + sidewalk
  const locBlocks = new Map();
  for (const l of LOCATIONS) if (l.block) locBlocks.set(`${l.block[0]},${l.block[1]}`, l);

  for (let i = 0; i < GRID.length - 1; i++) {
    for (let j = 0; j < GRID.length - 1; j++) {
      const cx = GRID[i] + half, cz = GRID[j] + half;
      const x0 = GRID[i] + inset, z0 = GRID[j] + inset, x1 = GRID[i + 1] - inset, z1 = GRID[j + 1] - inset;
      const W = x1 - x0, D = z1 - z0;
      const dist = districtAt(cx, cz);
      const loc = locBlocks.get(`${i},${j}`);
      if (loc) { landmarkBlock(loc, x0, z0, x1, z1); continue; }
      if (dist === 'Downtown') {
        if (rnd() < 0.08) { park(x0, z0, W, D); continue; }
        const n = 2, g = 6, s = (W - g) / n;
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
          const shrink = R(0, 6);
          buildings.push({ x: x0 + a * (s + g) + shrink / 2, z: z0 + b * (s + g) + shrink / 2, w: s - shrink, d: s - shrink, h: R(45, 190), color: pick(ROOFS.downtown), kind: 'tower' });
        }
      } else if (dist === 'Ironside Industrial' || dist === 'Harbor District') {
        if (rnd() < 0.5) {
          buildings.push({ x: x0 + 4, z: z0 + 4, w: W - 8, d: D * R(0.45, 0.6), h: R(10, 18), color: pick(ROOFS.industrial), kind: 'warehouse' });
          lots.push({ x: x0 + 4, z: z0 + D * 0.66, w: W - 8, d: D * 0.32, kind: 'parking' });
        } else {
          buildings.push({ x: x0 + 4, z: z0 + 4, w: W * 0.55, d: D - 8, h: R(12, 22), color: pick(ROOFS.industrial), kind: 'warehouse' });
          for (let k = 0; k < 4; k++) buildings.push({ x: x0 + W * 0.62 + (k % 2) * 22, z: z0 + 10 + Math.floor(k / 2) * 50, w: 16, d: 40, h: 5, color: pick(['#8a3b2a', '#2a5a8a', '#3a7a3a', '#8a7a2a']), kind: 'containers' });
        }
      } else if (dist === 'Westbrook Residential') {
        if (rnd() < 0.12) { park(x0, z0, W, D); continue; }
        const n = 4, s = W / n;
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
          if ((a === 1 || a === 2) && (b === 1 || b === 2)) { trees.push({ x: x0 + a * s + s / 2, z: z0 + b * s + s / 2, r: R(3, 5), kind: 'tree' }); continue; }
          const hx = x0 + a * s + 4, hz = z0 + b * s + 4;
          lots.push({ x: x0 + a * s + 1, z: z0 + b * s + 1, w: s - 2, d: s - 2, kind: 'yard' });
          buildings.push({ x: hx + R(0, 3), z: hz + R(0, 3), w: R(12, 16), d: R(11, 14), h: R(5, 8), color: pick(ROOFS.residential), kind: 'house' });
          if (rnd() < 0.6) trees.push({ x: x0 + a * s + R(3, s - 3), z: z0 + b * s + R(3, s - 3), r: R(2.5, 4), kind: 'tree' });
        }
      } else {
        if (rnd() < 0.1) { park(x0, z0, W, D); continue; }
        if (rnd() < 0.2) {
          lots.push({ x: x0 + 2, z: z0 + 2, w: W - 4, d: D * 0.45, kind: 'parking' });
          buildings.push({ x: x0 + 4, z: z0 + D * 0.52, w: W - 8, d: D * 0.45, h: R(8, 14), color: pick(ROOFS.mid), kind: 'store' });
          continue;
        }
        const n = 3, g = 4, s = (W - g * 2) / n;
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
          if (a === 1 && b === 1) { lots.push({ x: x0 + s + g, z: z0 + s + g, w: s, d: s, kind: 'parking' }); continue; }
          buildings.push({ x: x0 + a * (s + g), z: z0 + b * (s + g), w: s - R(0, 4), d: s - R(0, 4), h: R(10, 42), color: pick(ROOFS.mid), kind: 'midrise' });
        }
      }
    }
  }

  function park(x0, z0, W, D) {
    lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park' });
    for (let k = 0; k < 18; k++) trees.push({ x: x0 + R(4, W - 4), z: z0 + R(4, D - 4), r: R(3, 6), kind: 'tree' });
  }

  // A landmark block: the business building sits behind its entrance.
  function landmarkBlock(loc, x0, z0, x1, z1) {
    const W = x1 - x0, D = z1 - z0;
    const t = loc.type;
    const big = t === 'dealer' || t === 'usedlot' || t === 'meet' || t === 'police' || t === 'perf';
    let bw = big ? W * 0.6 : W * 0.45, bd = big ? D * 0.45 : D * 0.4;
    if (t === 'meet') { bw = W * 0.35; bd = D * 0.25; }
    // put the building towards the back, away from the entrance side
    let bx = (x0 + x1) / 2 - bw / 2, bz = (z0 + z1) / 2 - bd / 2;
    const fx = loc.x, fz = loc.z;
    if (loc.face === 0) bz = z0 + 6;                       // entrance south
    else if (loc.face === Math.PI) bz = z1 - bd - 6;       // entrance north
    else if (loc.face > 0) bx = x0 + 6;                     // entrance east
    else bx = x1 - bw - 6;                                  // entrance west
    const color = { home: '#4a3f38', dealer: '#d9dde2', usedlot: '#8a7a5a', perf: '#3a3a3a', visual: '#3a2a3a', repair: '#3d4452',
      gas: '#e8e8e8', food: '#7a2e24', clothing: '#2a2a3a', realty: '#2f4a3a', police: '#24324a', property: '#5a4a3a', meet: '#3a3a3a' }[t] || '#444';
    if (t === 'gas') {
      lots.push({ x: x0 + 2, z: z0 + 2, w: W - 4, d: D - 4, kind: 'gas' });
      buildings.push({ x: bx, z: bz, w: 26, d: 16, h: 5, color: '#d0d0d0', kind: 'store', label: loc.name, labelColor: loc.color });
      buildings.push({ x: (x0 + x1) / 2 - 18, z: (z0 + z1) / 2 - 8, w: 36, d: 20, h: 6, color: '#e9e9e9', kind: 'canopy', noCollide: true, label: 'GAS' });
      return;
    }
    if (t === 'meet' || t === 'dealer' || t === 'usedlot' || t === 'perf' || t === 'repair' || t === 'police') {
      lots.push({ x: x0 + 2, z: z0 + 2, w: W - 4, d: D - 4, kind: 'parking' });
    } else if (t === 'home' || t === 'property') {
      lots.push({ x: x0 + 2, z: z0 + 2, w: W - 4, d: D - 4, kind: 'yard' });
      for (let k = 0; k < 6; k++) trees.push({ x: x0 + R(5, W - 5), z: z0 + R(5, D - 5), r: R(2.5, 4), kind: 'tree' });
    }
    buildings.push({ x: bx, z: bz, w: bw, d: bd, h: t === 'police' ? 22 : t === 'property' && loc.id === 'hillcrest_villa' ? 9 : big ? 12 : 9, color, kind: 'landmark', label: loc.name.split(' (')[0], labelColor: loc.color, loc: loc.id });
  }

  // ---------------- outside the grid ----------------
  // Glory Highway: tunnel hill and the river bridge
  hills.push({ x: (TUNNEL[0] + TUNNEL[1]) / 2, z: HWY_Z, r: 330 });
  water.push({ x: RIVER_X - 45, z: -3200, w: 90, d: 3200 - 1000, kind: 'river' });
  water.push({ x: SEA_X + 10, z: 250, w: 3000, d: 3800, kind: 'sea' });
  // piers
  for (let k = 0; k < 4; k++) buildings.push({ x: SEA_X + 10, z: 420 + k * 140, w: 120, d: 16, h: 1, color: '#6b5a44', kind: 'pier', noCollide: true });

  // highway shoulders: trees and sound walls
  for (let x = HWY_X[0]; x < HWY_X[1]; x += 60) {
    if (x > TUNNEL[0] - 40 && x < TUNNEL[1] + 40) continue;
    if (Math.abs(x - RIVER_X) < 70) continue;
    trees.push({ x: x + R(-10, 10), z: HWY_Z - HWY_W / 2 - R(14, 40), r: R(4, 7), kind: 'pine' });
    trees.push({ x: x + R(-10, 10), z: HWY_Z + HWY_W / 2 + R(14, 40), r: R(4, 7), kind: 'pine' });
  }
  // between the city and the highway
  for (let k = 0; k < 260; k++) {
    const x = R(-1000, 1000), z = R(-1300, -950);
    if (Math.abs(x + 900) < 20 || Math.abs(x) < 20 || Math.abs(x - 900) < 20 || z > HWY_Z - 30 && z < HWY_Z + 30) continue;
    trees.push({ x, z, r: R(3, 6), kind: rnd() < 0.5 ? 'pine' : 'tree' });
  }
  // West hills / Northridge mountains
  for (let k = 0; k < 26; k++) hills.push({ x: R(-3200, -1150), z: R(-1800, 900), r: R(150, 420) });
  for (let k = 0; k < 900; k++) {
    const x = R(-3200, -1000), z = R(-1250, 1000);
    if (onBackroad(x, z, 14)) continue;
    trees.push({ x, z, r: R(3, 6), kind: 'pine' });
  }
  // Desert: mesas and cacti
  for (let k = 0; k < 40; k++) {
    const x = R(-2600, 2600), z = R(DESERT_Z + 150, DESERT_ROAD_END + 400);
    if (Math.abs(x) < 120) continue;
    rocks.push({ x, z, w: R(40, 160), d: R(40, 140), h: R(10, 40), color: pick(['#a0583a', '#b8693f', '#8f4d33']) });
  }
  for (let k = 0; k < 700; k++) {
    const x = R(-2800, 2800), z = R(DESERT_Z + 20, DESERT_ROAD_END + 400);
    if (Math.abs(x) < 16 || (x > 40 && x < 140 && z > 1180 && z < 1950)) continue;
    trees.push({ x, z, r: R(0.8, 1.6), kind: 'cactus' });
  }
  // Last Chance Gas out in the desert
  lots.push({ x: -95, z: 1660, w: 80, d: 80, kind: 'gas' });
  buildings.push({ x: -90, z: 1665, w: 22, d: 14, h: 5, color: '#c8b28a', kind: 'store', label: 'Last Chance Gas', labelColor: '#1f8f3a' });
  buildings.push({ x: -70, z: 1690, w: 30, d: 18, h: 6, color: '#e9e9e9', kind: 'canopy', noCollide: true, label: 'GAS' });
  // palms along the harbor
  for (let z = 300; z < 1000; z += 22) trees.push({ x: SEA_X - 8, z, r: 3, kind: 'palm' });

  // Ironline Dragway (scenery — the race itself runs in race mode)
  const strip = { x: 70, z: 1190, w: 40, d: 760 };
  lots.push({ ...strip, kind: 'strip' });
  buildings.push({ x: 116, z: 1300, w: 24, d: 420, h: 9, color: '#5a5f69', kind: 'stands', label: 'IRONLINE DRAGWAY', labelColor: '#ff1a2e' });
  buildings.push({ x: 40, z: 1220, w: 22, d: 18, h: 16, color: '#3a3f4a', kind: 'tower' });
  lots.push({ x: 20, z: 1150, w: 160, d: 40, kind: 'parking' });

  // ---------------- colliders ----------------
  const colliders = [];
  for (const b of buildings) if (!b.noCollide) colliders.push({ x0: b.x, z0: b.z, x1: b.x + b.w, z1: b.z + b.d, h: b.h, b });
  for (const r of rocks) colliders.push({ x0: r.x, z0: r.z, x1: r.x + r.w, z1: r.z + r.d, h: r.h });
  // water is solid
  colliders.push({ x0: RIVER_X - 45, z0: -3200, x1: RIVER_X + 45, z1: HWY_Z - HWY_W / 2 - 4, h: 0, water: true });
  colliders.push({ x0: RIVER_X - 45, z0: HWY_Z + HWY_W / 2 + 4, x1: RIVER_X + 45, z1: -1000, h: 0, water: true });
  colliders.push({ x0: SEA_X + 10, z0: 250, x1: SEA_X + 3000, z1: 4100, h: 0, water: true });
  // tunnel hill walls (the tunnel itself is open)
  colliders.push({ x0: TUNNEL[0], z0: HWY_Z - 300, x1: TUNNEL[1], z1: HWY_Z - HWY_W / 2 - 2, h: 30, hill: true });
  colliders.push({ x0: TUNNEL[0], z0: HWY_Z + HWY_W / 2 + 2, x1: TUNNEL[1], z1: HWY_Z + 300, h: 30, hill: true });
  // world edge
  colliders.push({ x0: -4000, z0: -4000, x1: 4000, z1: -3300, h: 0 });
  colliders.push({ x0: -4000, z0: 3300, x1: 4000, z1: 4000, h: 0 });
  colliders.push({ x0: -4000, z0: -4000, x1: -3300, z1: 4000, h: 0 });
  colliders.push({ x0: 3300, z0: -4000, x1: 4000, z1: 4000, h: 0 });

  const grid = new SpatialGrid(100);
  colliders.forEach(c => grid.insert(c, c.x0, c.z0, c.x1, c.z1));
  const drawGrid = new SpatialGrid(150);
  buildings.forEach(b => drawGrid.insert({ type: 'b', o: b }, b.x, b.z, b.x + b.w, b.z + b.d));
  lots.forEach(l => drawGrid.insert({ type: 'l', o: l }, l.x, l.z, l.x + l.w, l.z + l.d));
  trees.forEach(t => drawGrid.insert({ type: 't', o: t }, t.x - t.r, t.z - t.r, t.x + t.r, t.z + t.r));
  rocks.forEach(r => drawGrid.insert({ type: 'r', o: r }, r.x, r.z, r.x + r.w, r.z + r.d));

  return { roads, buildings, lots, trees, water, rocks, hills, signs, colliders, grid, drawGrid, backroad: BACKROAD };
}

// Northridge Pass: a winding two-lane through the west hills.
export const BACKROAD = [
  [-900, -300], [-1050, -310], [-1180, -380], [-1300, -360], [-1420, -460], [-1540, -430], [-1650, -540],
  [-1780, -500], [-1900, -620], [-2050, -580], [-2200, -700], [-2380, -650],
];
function onBackroad(x, z, pad) {
  for (let i = 0; i < BACKROAD.length - 1; i++) {
    const [ax, az] = BACKROAD[i], [bx, bz] = BACKROAD[i + 1];
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    if (Math.hypot(ax + dx * t - x, az + dz * t - z) < pad) return true;
  }
  return false;
}
export { onBackroad };

export class SpatialGrid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  key(i, j) { return i * 100003 + j; }
  insert(o, x0, z0, x1, z1) {
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const k = this.key(i, j);
        if (!this.map.has(k)) this.map.set(k, []);
        this.map.get(k).push(o);
      }
  }
  query(x0, z0, x1, z1, out = new Set()) {
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const arr = this.map.get(this.key(i, j));
        if (arr) for (const o of arr) out.add(o);
      }
    return out;
  }
}

// Circle vs collider rects. Returns the deepest push, or null.
export function collideCircle(map, x, z, r) {
  let best = null;
  for (const c of map.grid.query(x - r, z - r, x + r, z + r)) {
    const px = Math.max(c.x0, Math.min(x, c.x1));
    const pz = Math.max(c.z0, Math.min(z, c.z1));
    let dx = x - px, dz = z - pz;
    let d = Math.hypot(dx, dz);
    let pen;
    if (d === 0) {
      // centre inside the rect: push out the nearest side
      const l = x - c.x0, rr = c.x1 - x, t = z - c.z0, b = c.z1 - z;
      const m = Math.min(l, rr, t, b);
      if (m === l) { dx = -1; dz = 0; } else if (m === rr) { dx = 1; dz = 0; } else if (m === t) { dx = 0; dz = -1; } else { dx = 0; dz = 1; }
      pen = m + r; d = 1;
    } else {
      if (d >= r) continue;
      pen = r - d;
    }
    const nx = dx / d, nz = dz / d;
    if (!best || pen > best.pen) best = { nx, nz, pen, c };
  }
  return best;
}

// Line of sight blocked by anything taller than a car?
export function lineOfSight(map, x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.ceil(len / 6);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    for (const c of map.grid.query(x, z, x, z)) {
      if (c.h > 3 && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return false;
    }
  }
  return true;
}
