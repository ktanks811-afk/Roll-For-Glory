// The big map (data/metro.js): builds every new town block by block, the
// landmarks (Six Flags, the malls, the stadiums, the courthouses, DFW
// Airport), the lakes, Miami's bay and beach, and fills the open country
// between with farms, pasture, woods and hills. Each town has its own seed,
// so the rest of the map is exactly as it was. DOM-free (check-data builds
// the map in node).
//
// Runs after everything else in map.js: the ground under the towns, lakes
// and new highways is cleared of the old filler first, then built on.

import { LOCATIONS } from '../data/world.js';
import { ALL_TOWNS, ROUTES, STATE_ROUTES, LAKES, DFW, COUNTRYSIDE, MIAMI_BAY, MIAMI_OCEAN, CAUSEWAYS, townStyle, townMark } from '../data/metro.js';
import { STATES, cityRect, regionRect } from '../data/states.js';
import { RectGrid } from './rectGrid.js';
import { MALL_BY_MARK } from '../data/malls.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const seedOf = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const keep = (arr, fn) => { let j = 0; for (let i = 0; i < arr.length; i++) if (fn(arr[i])) arr[j++] = arr[i]; arr.length = j; };

const LOOK = {
  tx: { roofs: ['#6b3a2e', '#3f4a5a', '#5a4632', '#2f3b2f', '#6e6e6e', '#7a4b3a', '#4a3a4a', '#585048'], tree: 'tree' },
  ga: { roofs: ['#6b3a2e', '#3f4a5a', '#5a4632', '#7a4b3a', '#4a4a4a'], tree: 'tree' },
  ca: { roofs: ['#b06a32', '#c8a46a', '#d9c9a8', '#8a5a3a', '#e8e2d8'], tree: 'palm' },
  fl: { roofs: ['#f2e2c8', '#e8c8a8', '#ffd8b0', '#c8e0e8', '#f2f2f2'], tree: 'palm' },
};
const MID = ['#5a5148', '#4d4b52', '#5e5a55', '#45474f', '#6a5f52', '#504a45'];
const TOWER = ['#3a3f4a', '#2f343d', '#454b57', '#353a44', '#2a2e36', '#4b515c'];
const IND = ['#6b6f75', '#5d6167', '#7a7e83', '#4f5358'];
const BRICK = ['#8a3b2a', '#7a4a32', '#9a5a3a', '#6e3a2a', '#a0583a', '#8a6a4a', '#5a4a3a'];
const CROPS = ['#55682e', '#6b7a34', '#7d7a3a', '#4a6a2c', '#8a7a3e', '#5e7238', '#9a8a4a'];

export function addMetro(out, { landmarkBlock, roads }) {
  const { buildings, lots, trees, props, rocks } = out;
  const water = [];

  // ---------------- clear the ground: towns, lakes, DFW and the new highways ----------------
  const clearRects = [];
  for (const t of ALL_TOWNS) clearRects.push({ x0: t.x0 - 10, z0: t.z0 - 10, x1: t.x1 + 10, z1: t.z1 + 10 });
  for (const l of LAKES) clearRects.push({ x0: l.x0 - 10, z0: l.z0 - 10, x1: l.x1 + 10, z1: l.z1 + 10 });
  clearRects.push({ x0: DFW.x0, z0: DFW.z0, x1: DFW.x1, z1: DFW.z1 });
  for (const r of [...ROUTES, ...Object.values(STATE_ROUTES).flat()]) {
    const h = (r.kind === 'highway' ? 15 : 8) + 8;
    for (let k = 0; k < r.pts.length - 1; k++) {
      const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1];
      clearRects.push({ x0: Math.min(ax, bx) - h, z0: Math.min(az, bz) - h, x1: Math.max(ax, bx) + h, z1: Math.max(az, bz) + h });
    }
  }
  const clearGrid = new RectGrid(200);
  for (const r of clearRects) clearGrid.add(r, r.x0, r.z0, r.x1, r.z1);
  const hits = (x0, z0, x1, z1) => clearGrid.some(x0, z0, x1, z1, r => x1 > r.x0 && x0 < r.x1 && z1 > r.z0 && z0 < r.z1);
  keep(buildings, b => b.loc || !hits(b.x, b.z, b.x + b.w, b.z + b.d));
  keep(lots, l => l.loc || l.landLot || !hits(l.x, l.z, l.x + l.w, l.z + l.d));
  keep(trees, t => !hits(t.x - t.r, t.z - t.r, t.x + t.r, t.z + t.r));
  keep(props, p => !hits(p.x, p.z, p.x + (p.w || 0), p.z + (p.d || 0)));
  keep(rocks, r => !hits(r.x, r.z, r.x + r.w, r.z + r.d));

  // ---------------- the towns ----------------
  const placesByTown = new Map();
  for (const l of LOCATIONS) if (l.city && l.block) { if (!placesByTown.has(l.city)) placesByTown.set(l.city, new Map()); placesByTown.get(l.city).set(l.block.join(), l); }
  for (const t of ALL_TOWNS) buildTown(t, placesByTown.get(t.id) || new Map());

  function buildTown(t, places) {
    const rnd = mulberry32(seedOf(t.id)), R = (a, b) => a + rnd() * (b - a), pick = a => a[Math.floor(rnd() * a.length)];
    const look = LOOK[t.state || 'tx'];
    const hwyInset = 24;
    const done = new Set();
    for (let i = 0; i < t.nx; i++) for (let j = 0; j < t.nz; j++) {
      const bx = t.x0 + i * t.b, bz = t.z0 + j * t.b;
      // set back further from a freeway than from a street
      // (and a little further on the town's outside edge, where a highway can end on the corner)
      const top = t.hwy && t.hwy.row === j ? hwyInset : j === 0 ? 17 : 14, bot = t.hwy && t.hwy.row === j + 1 ? hwyInset : j === t.nz - 1 ? 17 : 14;
      const lft = t.hwy && t.hwy.col === i ? hwyInset : i === 0 ? 17 : 14, rgt = t.hwy && t.hwy.col === i + 1 ? hwyInset : i === t.nx - 1 ? 17 : 14;
      const x0 = bx + lft, z0 = bz + top, x1 = bx + t.b - rgt, z1 = bz + t.b - bot;
      const loc = places.get(`${i},${j}`);
      if (loc) { landmarkBlock(loc, x0, z0, x1, z1); continue; }
      const mk = townMark(t, i, j);
      if (mk >= 0) {
        if (done.has(mk)) continue;
        done.add(mk);
        const m = t.marks[mk];
        mark(m[4], m[5], t.x0 + m[0] * t.b + 14, t.z0 + m[2] * t.b + 14, t.x0 + (m[1] + 1) * t.b - 14, t.z0 + (m[3] + 1) * t.b - 14, { R, pick, rnd, look, t });
        continue;
      }
      let style = townStyle(t, i, j);
      if ((style === 'res' || style === 'rich' || style === 'mix') && rnd() < 0.07) style = 'park';
      if (style === 'res' && rnd() < 0.1) style = 'apts';
      if (style === 'mix' && rnd() < 0.18) style = 'shop';
      block(style, x0, z0, x1, z1, { R, pick, rnd, look });
    }
    // street trees down the sidewalks
    for (let i = 0; i <= t.nx; i++) for (let j = 0; j < t.nz; j++) if (rnd() < 0.35) {
      const x = t.x0 + i * t.b + (rnd() < 0.5 ? -11 : 11), z = t.z0 + j * t.b + R(24, t.b - 24);
      if (townMark(t, Math.min(t.nx - 1, i), j) < 0 && !(t.hwy && t.hwy.col === i)) trees.push({ x, z, r: look.tree === 'palm' ? 2.6 : R(2.5, 3.5), kind: look.tree });
    }
  }

  function block(style, x0, z0, x1, z1, { R, pick, rnd, look }) {
    const W = x1 - x0, D = z1 - z0;
    const tree = (x, z, r = R(2.5, 4)) => trees.push({ x, z, r, kind: look.tree === 'palm' && rnd() < 0.5 ? 'tree' : look.tree });
    switch (style) {
      case 'park': {
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park' });
        for (let k = 0; k < 12; k++) tree(R(x0 + 5, x1 - 5), R(z0 + 5, z1 - 5), R(3, 5.5));
        if (rnd() < 0.4) lots.push({ x: x0 + W * 0.3, z: z0 + D * 0.35, w: W * 0.4, d: D * 0.3, kind: 'pond' });
        return;
      }
      case 'res': {
        // eight houses round the edge facing the streets, a shared yard in the middle
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'yard' });
        const s = W / 3, q = D / 3;
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
          if (a === 1 && b === 1) { if (rnd() < 0.5) props.push({ k: 'pool', x: x0 + s + 12, z: z0 + q + 12, w: 9, d: 6 }); tree(x0 + s * 1.5 + R(-12, 12), z0 + q * 1.5 + R(-8, 8)); continue; }
          const hw = R(13, 17), hd = Math.min(R(11, 14), q - 4);
          const hx = x0 + a * s + (a === 0 ? 3 : a === 2 ? s - hw - 3 : (s - hw) / 2), hz = z0 + b * q + (b === 0 ? 2 : b === 2 ? q - hd - 2 : (q - hd) / 2);
          buildings.push({ x: hx, z: hz, w: hw, d: hd, h: R(5, 8), color: pick(look.roofs), kind: 'house' });
          if (rnd() < 0.5) tree(x0 + a * s + R(4, s - 4), z0 + b * q + R(4, q - 4));
        }
        return;
      }
      case 'rich': {
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'yard' });
        const s = W / 2, q = D / 2;
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
          const hw = R(20, 26), hd = Math.min(R(16, 20), q - 10), hx = x0 + a * s + (a ? s - hw - 6 : 6), hz = z0 + b * q + (b ? q - hd - 5 : 5);
          buildings.push({ x: hx, z: hz, w: hw, d: hd, h: R(7, 11), color: pick(look.roofs), kind: 'house' });
          props.push({ k: 'pool', x: a ? hx - 14 : hx + hw + 4, z: hz + 4, w: 9, d: 7 });
          for (let k = 0; k < 2; k++) tree(x0 + a * s + R(5, s - 5), z0 + b * q + R(q * 0.6, q - 5), R(3, 5));
        }
        return;
      }
      case 'apts': {
        lots.push({ x: x0 + 2, z: z0 + 2, w: W - 4, d: D - 4, kind: 'parking' });
        const n = 3, g = 8, s = (D - 20 - g * (n - 1)) / n;
        for (let k = 0; k < n; k++) buildings.push({ x: x0 + 14, z: z0 + 10 + k * (s + g), w: W - 28, d: s, h: R(9, 14), color: pick(MID), kind: 'midrise' });
        for (let k = 0; k < 4; k++) tree(R(x0 + 4, x1 - 4), rnd() < 0.5 ? z0 + 5 : z1 - 5);
        return;
      }
      case 'mix': {
        const n = 3, g = 4, s = (W - g * 2) / n, q = (D - g * 2) / n;
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
          if (a === 1 && b === 1) { lots.push({ x: x0 + s + g, z: z0 + q + g, w: s, d: q, kind: 'parking' }); continue; }
          buildings.push({ x: x0 + a * (s + g), z: z0 + b * (q + g), w: s - R(0, 4), d: q - R(0, 4), h: R(9, 34), color: pick(MID), kind: 'midrise' });
        }
        return;
      }
      case 'shop': {
        lots.push({ x: x0 + 2, z: z0 + 2, w: W - 4, d: D * 0.5, kind: 'parking' });
        buildings.push({ x: x0 + 4, z: z0 + D * 0.56, w: W - 8, d: D * 0.42, h: R(7, 11), color: pick(MID), kind: 'store' });
        buildings.push({ x: x0 + 8, z: z0 + 8, w: 18, d: 14, h: 5, color: pick(MID), kind: 'store' });
        return;
      }
      case 'ind': {
        buildings.push({ x: x0 + 4, z: z0 + 4, w: W - 8, d: D * R(0.45, 0.6), h: R(10, 16), color: pick(IND), kind: 'warehouse' });
        lots.push({ x: x0 + 4, z: z0 + D * 0.66, w: W - 8, d: D * 0.32, kind: 'parking' });
        return;
      }
      case 'down': {
        const n = 2, g = 6, s = (W - g) / n, q = (D - g) / n;
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
          const sh = R(0, 6);
          buildings.push({ x: x0 + a * (s + g) + sh / 2, z: z0 + b * (q + g) + sh / 2, w: s - sh, d: q - sh, h: R(35, 120), color: pick(TOWER), kind: 'tower' });
        }
        return;
      }
      case 'square': {
        // an old downtown: a row of narrow brick storefronts down every side
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'parking' });
        const n = 5, s = W / n, q = D / n;
        for (let k = 0; k < n; k++) {
          buildings.push({ x: x0 + k * s + 0.5, z: z0, w: s - 1, d: 22, h: R(6, 11), color: pick(BRICK), kind: 'store' });
          buildings.push({ x: x0 + k * s + 0.5, z: z1 - 22, w: s - 1, d: 22, h: R(6, 11), color: pick(BRICK), kind: 'store' });
        }
        for (let k = 1; k < n - 1; k++) {
          buildings.push({ x: x0, z: z0 + k * q + 0.5, w: 22, d: q - 1, h: R(6, 10), color: pick(BRICK), kind: 'store' });
          buildings.push({ x: x1 - 22, z: z0 + k * q + 0.5, w: 22, d: q - 1, h: R(6, 10), color: pick(BRICK), kind: 'store' });
        }
        return;
      }
      case 'campus': {
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park' });
        buildings.push({ x: x0 + 8, z: z0 + 8, w: W * 0.4, d: D * 0.3, h: R(14, 24), color: pick(BRICK), kind: 'midrise' });
        buildings.push({ x: x1 - W * 0.4 - 8, z: z1 - D * 0.3 - 8, w: W * 0.4, d: D * 0.3, h: R(14, 24), color: pick(BRICK), kind: 'midrise' });
        for (let k = 0; k < 6; k++) tree(R(x0 + 6, x1 - 6), R(z0 + D * 0.4, z0 + D * 0.6));
        return;
      }
    }
  }

  // A landmark over one or more blocks (the streets inside it are left out).
  function mark(kind, label, x0, z0, x1, z1, { R, pick, rnd, look, t }) {
    const W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const sign = (b, color = '#e8c21a') => buildings.push({ ...b, label, labelColor: color });
    const ring = (x, z, w, d, t, kindL) => { lots.push({ x, z, w, d: t, kind: kindL }, { x, z: z + d - t, w, d: t, kind: kindL }, { x, z, w: t, d, kind: kindL }, { x: x + w - t, z, w: t, d, kind: kindL }); };
    switch (kind) {
      case 'coaster': {
        // the park: lawn, a ring of coaster track, rides, a lake, the gate and a parking lot along the front
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park' });
        lots.push({ x: x0 + 4, z: z1 - 60, w: W - 8, d: 56, kind: 'parking' });
        ring(x0 + 20, z0 + 20, W - 40, D - 110, 5, 'track');
        ring(x0 + 60, z0 + 60, W * 0.4, D * 0.3, 4, 'track');
        lots.push({ x: cx + 10, z: cz - 40, w: W * 0.25, d: D * 0.18, kind: 'pond' });
        for (let k = 0; k < 10; k++) buildings.push({ x: R(x0 + 40, x1 - 60), z: R(z0 + 40, z1 - 140), w: R(8, 20), d: R(8, 20), h: R(6, 18), color: pick(['#d12a8a', '#1b4fc4', '#e8c21a', '#ff1a2e', '#2cff7a', '#a01aff']), kind: 'store' });
        sign({ x: cx - 30, z: z1 - 84, w: 60, d: 18, h: 14, color: '#3a3a6a', kind: 'store' }, '#ff1a2e');
        for (let k = 0; k < 24; k++) trees.push({ x: R(x0 + 6, x1 - 6), z: R(z0 + 6, z1 - 70), r: R(3, 5), kind: 'tree' });
        return;
      }
      case 'mall': {
        // a mall you can walk into (data/malls.js) has its front door on the south side
        const mall = t && MALL_BY_MARK[`${t.id}:${label}`];
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'parking' });
        sign({ x: x0 + W * 0.2, z: z0 + D * 0.25, w: W * 0.6, d: D * 0.5, h: 14, color: '#cfc8bc', kind: 'store', ...(mall ? { loc: mall.id, shop: 'mall', side: 'S', accent: mall.color } : {}) }, mall ? mall.color : '#ffffff');
        for (const [ax, az] of [[x0 + W * 0.12, cz - 20], [x1 - W * 0.12 - 30, cz - 20]]) buildings.push({ x: ax, z: az, w: 30, d: 40, h: 16, color: '#b8b0a4', kind: 'store' });
        return;
      }
      case 'stadium': {
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'parking' });
        const sx = x0 + W * 0.18, sz = z0 + D * 0.18, sw = W * 0.64, sd = D * 0.64, th = 16;
        lots.push({ x: sx + th, z: sz + th, w: sw - 2 * th, d: sd - 2 * th, kind: 'gridiron' });
        sign({ x: sx, z: sz, w: sw, d: th, h: 24, color: '#5a5f69', kind: 'stands' }, '#ffffff');
        buildings.push({ x: sx, z: sz + sd - th, w: sw, d: th, h: 24, color: '#5a5f69', kind: 'stands' });
        buildings.push({ x: sx, z: sz + th, w: th, d: sd - 2 * th, h: 24, color: '#5a5f69', kind: 'stands' });
        buildings.push({ x: sx + sw - th, z: sz + th, w: th, d: sd - 2 * th, h: 24, color: '#5a5f69', kind: 'stands' });
        return;
      }
      case 'field': {
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'parking' });
        lots.push({ x: x0 + 30, z: z0 + 24, w: W - 60, d: D * 0.55, kind: 'gridiron' });
        sign({ x: x0 + 30, z: z0 + 28 + D * 0.55, w: W - 60, d: 14, h: 9, color: '#5a5f69', kind: 'stands' });
        return;
      }
      case 'arena': {
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'parking' });
        sign({ x: x0 + W * 0.25, z: z0 + D * 0.25, w: W * 0.5, d: D * 0.5, h: 18, color: '#6a5a4a', kind: 'store' });
        return;
      }
      case 'racetrack': {
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park' });
        ring(x0 + 18, z0 + 18, W - 36, D - 70, 12, 'dirt');
        lots.push({ x: x0 + 4, z: z1 - 46, w: W - 8, d: 42, kind: 'parking' });
        sign({ x: x0 + 40, z: z1 - 66, w: W - 80, d: 14, h: 14, color: '#5a5f69', kind: 'stands' });
        return;
      }
      case 'dragstrip': {
        // a quarter mile running north from the start line at the south end,
        // grandstands down the east side, the tower by the line, pits on the west
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'yard' });
        const sx = x0 + 22, sw = 26;
        lots.push({ x: sx, z: z0 + 6, w: sw, d: D - 12, kind: 'strip' });
        lots.push({ x: x0 + 2, z: z0 + 30, w: 18, d: D - 120, kind: 'parking' });
        sign({ x: sx + sw + 8, z: z0 + 60, w: 18, d: D - 160, h: 9, color: '#5a5f69', kind: 'stands' }, '#ffd23a');
        buildings.push({ x: sx + sw + 6, z: z1 - 70, w: 16, d: 14, h: 15, color: '#3a3f4a', kind: 'tower' });
        lots.push({ x: sx + sw + 4, z: z1 - 50, w: W - sw - 26, d: 46, kind: 'parking' });
        return;
      }
      case 'airfield': {
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'yard' });
        const horiz = W >= D;
        if (horiz) { lots.push({ x: x0 + 10, z: cz - 18, w: W - 20, d: 36, kind: 'lot' }); for (let x = x0 + 30; x < x1 - 30; x += 30) lots.push({ x, z: cz - 1, w: 14, d: 2, kind: 'caliche' }); }
        else { lots.push({ x: cx - 18, z: z0 + 10, w: 36, d: D - 20, kind: 'lot' }); for (let z = z0 + 30; z < z1 - 30; z += 30) lots.push({ x: cx - 1, z, w: 2, d: 14, kind: 'caliche' }); }
        const hx = horiz ? x0 + 20 : x0 + 8, hz = horiz ? z1 - 50 : z0 + 20;
        for (let k = 0; k < 3; k++) buildings.push(horiz ? { x: hx + k * 44, z: hz, w: 36, d: 30, h: 9, color: '#8a8f97', kind: 'warehouse' } : { x: hx, z: hz + k * 44, w: 30, d: 36, h: 9, color: '#8a8f97', kind: 'warehouse' });
        sign(horiz ? { x: x1 - 70, z: z1 - 44, w: 50, d: 24, h: 12, color: '#c8ccd2', kind: 'store' } : { x: x1 - 44, z: z1 - 70, w: 24, d: 50, h: 12, color: '#c8ccd2', kind: 'store' }, '#5fd3ff');
        return;
      }
      case 'park': {
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park' });
        lots.push({ x: cx - W * 0.2, z: cz - D * 0.15, w: W * 0.4, d: D * 0.3, kind: 'pond' });
        sign({ x: x0 + 6, z: z0 + 6, w: 14, d: 10, h: 4, color: '#6a4a2e', kind: 'shed' }, '#2cff7a');
        for (let k = 0; k < 40; k++) { const x = R(x0 + 5, x1 - 5), z = R(z0 + 5, z1 - 5); if (Math.abs(x - cx) < W * 0.22 && Math.abs(z - cz) < D * 0.17) continue; trees.push({ x, z, r: R(3, 6), kind: look.tree === 'palm' ? 'palm' : rnd() < 0.4 ? 'pine' : 'tree' }); }
        return;
      }
      case 'courthouse': {
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park' });
        sign({ x: cx - 24, z: cz - 24, w: 48, d: 48, h: 24, color: '#c9a68a', kind: 'landmark' }, '#ffffff');
        for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; trees.push({ x: cx + Math.cos(a) * (W / 2 - 12), z: cz + Math.sin(a) * (D / 2 - 12), r: R(3, 4.5), kind: 'tree' }); }
        return;
      }
      case 'ind': block('ind', x0, z0, x1, z1, { R, pick, rnd, look }); return;
    }
  }

  // ---------------- DFW Airport ----------------
  {
    const rnd = mulberry32(972), R = (a, b) => a + rnd() * (b - a);
    const { x0, z0, x1, z1 } = DFW;
    lots.push({ x: x0, z: z0, w: x1 - x0, d: z1 - z0, kind: 'yard' });
    for (const rz of [z0 + 60, z1 - 110]) { lots.push({ x: x0 + 20, z: rz, w: x1 - x0 - 40, d: 50, kind: 'lot' }); for (let x = x0 + 40; x < x1 - 40; x += 34) lots.push({ x, z: rz + 24, w: 16, d: 2, kind: 'caliche' }); }
    // terminals on the apron in the middle, the road in from SH-360 ends at them
    const ty = (z0 + z1) / 2 - 75;
    lots.push({ x: x0 + 210, z: ty - 20, w: x1 - x0 - 230, d: 190, kind: 'lot' });
    for (let k = 0; k < 4; k++) buildings.push({ x: x0 + 240 + k * 190, z: ty + 30, w: 120, d: 46, h: 14, color: '#c8ccd2', kind: 'store', ...(k === 0 ? { label: 'DFW AIRPORT', labelColor: '#5fd3ff' } : {}) });
    buildings.push({ x: x0 + 210 + 4 * 190 - 40, z: ty - 10, w: 16, d: 16, h: 44, color: '#d0d4da', kind: 'tower' });
    for (let k = 0; k < 6; k++) { const jx = x0 + 260 + k * 120; buildings.push({ x: jx - 3.5, z: ty + 96, w: 7, d: 44, h: 5, color: '#f2f2f2', kind: 'parked' }, { x: jx - 21, z: ty + 110, w: 42, d: 7, h: 3, color: '#e0e0e0', kind: 'parked' }); }
    lots.push({ x: x0 + 20, z: ty - 20, w: 180, d: 190, kind: 'parking' });
    for (let k = 0; k < 30; k++) trees.push({ x: R(x0 + 10, x1 - 10), z: rnd() < 0.5 ? z0 + R(4, 40) : z1 - R(4, 30), r: R(3, 5), kind: 'tree' });
  }

  // ---------------- lakes ----------------
  for (const l of LAKES) {
    const gaps = (l.gaps || []).filter(g => g[2] === 'z').map(g => [g[0] - g[1], g[0] + g[1]]).sort((a, b) => a[0] - b[0]);
    let z = l.z0;
    for (const [ga, gb] of [...gaps, [l.z1, l.z1]]) {
      if (ga > z) water.push({ x: l.x0, z, w: l.x1 - l.x0, d: ga - z, kind: 'lake' });
      if (gb < l.z1) buildings.push({ x: l.x0 - 6, z: ga - 2, w: l.x1 - l.x0 + 12, d: 2, h: 1.2, color: '#9a9ca2', kind: 'pier', noCollide: true }, { x: l.x0 - 6, z: gb, w: l.x1 - l.x0 + 12, d: 2, h: 1.2, color: '#9a9ca2', kind: 'pier', noCollide: true });
      z = gb;
    }
    const rnd = mulberry32(seedOf(l.name));
    for (let k = 0; k < 40; k++) {
      const side = k % 4, s = rnd();
      const x = side < 2 ? l.x0 + s * (l.x1 - l.x0) : side === 2 ? l.x0 - 8 - rnd() * 20 : l.x1 + 8 + rnd() * 20;
      const zz = side >= 2 ? l.z0 + s * (l.z1 - l.z0) : side === 0 ? l.z0 - 8 - rnd() * 20 : l.z1 + 8 + rnd() * 20;
      trees.push({ x, z: zz, r: 3 + rnd() * 3, kind: rnd() < 0.5 ? 'pine' : 'tree' });
    }
  }

  // ---------------- Miami: Biscayne Bay, the causeways, the beach and the Atlantic ----------------
  {
    const fl = STATES.fl, c = cityRect(fl), reg = regionRect(fl);
    const rows = CAUSEWAYS.map(k => c.z0 + k).sort((a, b) => a - b);
    let z = reg.z0;
    for (const rz of [...rows, null]) {
      const zb = rz == null ? reg.z1 : rz - 12;
      water.push({ x: MIAMI_BAY.x0, z, w: MIAMI_BAY.x1 - MIAMI_BAY.x0, d: zb - z, kind: 'sea' });
      if (rz != null) { for (const zz of [rz - 12, rz + 10]) buildings.push({ x: MIAMI_BAY.x0 - 4, z: zz, w: MIAMI_BAY.x1 - MIAMI_BAY.x0 + 8, d: 2, h: 1.2, color: '#9a9ca2', kind: 'pier', noCollide: true }); z = rz + 12; }
    }
    water.push({ x: MIAMI_OCEAN, z: reg.z0, w: reg.x1 - MIAMI_OCEAN, d: reg.z1 - reg.z0, kind: 'sea' });
    lots.push({ x: MIAMI_OCEAN - 140, z: reg.z0, w: 140, d: reg.z1 - reg.z0, kind: 'sand' });
    const rnd = mulberry32(3050);
    for (let zz = reg.z0 + 10; zz < reg.z1; zz += 22) trees.push({ x: MIAMI_OCEAN - 150, z: zz, r: 3, kind: 'palm' });
    for (let zz = reg.z0 + 30; zz < reg.z1 - 30; zz += 30 + rnd() * 30) props.push({ k: 'umbrella', x: MIAMI_OCEAN - 120 + rnd() * 100, z: zz, r: 1.6, c: ['#ff1a2e', '#2c6fbb', '#e8c21a', '#2cff7a'][Math.floor(rnd() * 4)] });
  }

  // ---------------- the country ----------------
  // the roads, so nothing out here lands on one
  const RC = 200, roadCells = new Map(), rk = (i, j) => i * 100003 + j;
  for (const e of roads.edges) {
    const h = e.width / 2 + 5, r = { x0: Math.min(e.ax, e.bx) - h, z0: Math.min(e.az, e.bz) - h, x1: Math.max(e.ax, e.bx) + h, z1: Math.max(e.az, e.bz) + h };
    for (let i = Math.floor(r.x0 / RC); i <= Math.floor(r.x1 / RC); i++) for (let j = Math.floor(r.z0 / RC); j <= Math.floor(r.z1 / RC); j++) { const k = rk(i, j); if (!roadCells.has(k)) roadCells.set(k, []); roadCells.get(k).push(r); }
  }
  const onRoad = (x0, z0, x1, z1) => {
    for (let i = Math.floor(x0 / RC); i <= Math.floor(x1 / RC); i++) for (let j = Math.floor(z0 / RC); j <= Math.floor(z1 / RC); j++)
      for (const r of roadCells.get(rk(i, j)) || []) if (x1 > r.x0 && x0 < r.x1 && z1 > r.z0 && z0 < r.z1) return true;
    return false;
  };
  const taken = [
    ...ALL_TOWNS.map(t => ({ x0: t.x0 - 40, z0: t.z0 - 40, x1: t.x1 + 40, z1: t.z1 + 40 })),
    ...LAKES.map(l => ({ x0: l.x0 - 30, z0: l.z0 - 30, x1: l.x1 + 30, z1: l.z1 + 30 })),
    { x0: DFW.x0 - 20, z0: DFW.z0 - 20, x1: DFW.x1 + 20, z1: DFW.z1 + 20 },
    ...out.waterAll.map(w => ({ x0: w.x - 20, z0: w.z - 20, x1: w.x + w.w + 20, z1: w.z + w.d + 20 })),
    ...LOCATIONS.map(l => l.lot ? { x0: l.lot.x0 - 20, z0: l.lot.z0 - 20, x1: l.lot.x1 + 20, z1: l.lot.z1 + 20 } : { x0: l.x - 40, z0: l.z - 40, x1: l.x + 40, z1: l.z + 40 }),
  ];
  const takenGrid = new RectGrid(200);
  for (const r of taken) takenGrid.add(r, r.x0, r.z0, r.x1, r.z1);
  const free = (x0, z0, x1, z1) => !takenGrid.some(x0, z0, x1, z1, r => x1 > r.x0 && x0 < r.x1 && z1 > r.z0 && z0 < r.z1) && !onRoad(x0, z0, x1, z1);
  const seen = new Set();
  for (const c of COUNTRYSIDE) {
    const rnd = mulberry32(seedOf(c.name + c.x0 + ',' + c.z0)), R = (a, b) => a + rnd() * (b - a), pick = a => a[Math.floor(rnd() * a.length)];
    const S = 460;
    for (let gx = Math.floor(c.x0 / S) * S; gx < c.x1; gx += S) for (let gz = Math.floor(c.z0 / S) * S; gz < c.z1; gz += S) {
      const k = gx + ',' + gz;
      if (seen.has(k)) continue;
      const cx = gx + S / 2, cz = gz + S / 2;
      if (cx < c.x0 || cx >= c.x1 || cz < c.z0 || cz >= c.z1) continue;
      seen.add(k);
      country(c.look, gx + 30, gz + 30, gx + S - 30, gz + S - 30, { R, pick, rnd });
    }
  }

  function country(look, x0, z0, x1, z1, { R, pick, rnd }) {
    const tree = (x, z, kind, r = R(3, 6)) => { if (free(x - r, z - r, x + r, z + r)) trees.push({ x, z, r, kind }); };
    const put = (b, into = buildings) => { if (!free(b.x, b.z, b.x + b.w, b.z + b.d)) return false; into.push(b); return true; };
    const field = (c) => {
      for (let tries = 0; tries < 3; tries++) {
        const w = R(140, x1 - x0), d = R(120, z1 - z0), x = R(x0, x1 - w), z = R(z0, z1 - d);
        if (put({ x, z, w, d, kind: 'field', c, dir: rnd() < 0.5 ? 'x' : 'z' }, lots)) return { x, z, w, d };
      }
      return null;
    };
    const farmstead = () => {
      const x = R(x0, x1 - 90), z = R(z0, z1 - 70);
      if (!free(x - 6, z - 6, x + 96, z + 76)) return;
      lots.push({ x, z, w: 90, d: 70, kind: 'yard' });
      buildings.push({ x: x + 8, z: z + 10, w: R(14, 18), d: R(11, 14), h: R(5, 7), color: pick(LOOK.tx.roofs), kind: 'house' });
      buildings.push({ x: x + 48, z: z + 8, w: 26, d: 30, h: R(7, 9), color: pick(['#8a3b2a', '#7a2a22', '#6b6f75', '#8a6a4a']), kind: 'barn' });
      if (rnd() < 0.5) buildings.push({ x: x + 78, z: z + 10, w: 7, d: 7, h: R(12, 18), color: '#b8bcc2', kind: 'silo', round: true });
      for (let k = 0; k < 3; k++) trees.push({ x: x + R(4, 40), z: z + R(40, 66), r: R(3, 5), kind: 'tree' });
    };
    const r = rnd();
    if (look === 'farm') {
      if (r < 0.75) field(pick(CROPS));
      if (rnd() < 0.3) farmstead();
      if (rnd() < 0.5) for (let k = 0; k < 8; k++) tree(R(x0, x1), rnd() < 0.5 ? z0 : z1, 'tree');
    } else if (look === 'ranch') {
      if (r < 0.6) field('#4f6a2e');
      if (rnd() < 0.2) farmstead();
      if (rnd() < 0.25) { const pw = R(24, 40), pd = R(18, 30), px = R(x0, x1 - pw), pz = R(z0, z1 - pd); put({ x: px, z: pz, w: pw, d: pd, kind: 'pond' }, lots); }
      for (let k = 0; k < 7; k++) tree(R(x0, x1), R(z0, z1), 'tree', R(2.5, 4.5));
    } else if (look === 'woods') {
      for (let k = 0; k < 16; k++) tree(R(x0, x1), R(z0, z1), rnd() < 0.45 ? 'pine' : 'tree');
      if (r < 0.15) farmstead();
    } else if (look === 'hills') {
      for (let k = 0; k < 2; k++) if (rnd() < 0.6) { const w = R(40, 140), d = R(40, 120); put({ x: R(x0, x1 - w), z: R(z0, z1 - d), w, d, h: R(8, 30), color: pick(['#66513e', '#705944', '#574837', '#7a6a52']) }, rocks); }
      for (let k = 0; k < 9; k++) tree(R(x0, x1), R(z0, z1), rnd() < 0.7 ? 'pine' : 'tree');
      if (r < 0.1) field('#6a6a3a');
    }
  }

  return { water };
}
