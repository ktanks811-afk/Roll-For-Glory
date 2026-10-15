// Out-of-state cities (data/states.js): Atlanta, Los Angeles, Miami and
// Denver (pines, the Front Range to the north and the grow farms out east). Each
// is an 8x8-block grid with its own look (Atlanta's trees, LA's palms and
// hills, Miami's beach and stucco), the places on it (data/world.js, city:
// the state id) built by map.js's landmarkBlock, and an airport west of
// town where the plane drops you and your car. Own seed per city. DOM-free.

import { LOCATIONS } from '../data/world.js';
import { STATES, STATE_N, STATE_BLOCK, AIRPORT_ROW, cityRect, regionRect } from '../data/states.js';
import { WEED_LOCATIONS } from '../data/weed.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const LOOK = {
  ga: { roofs: ['#6b3a2e', '#3f4a5a', '#5a4632', '#7a4b3a', '#4a4a4a'], towers: ['#3a3f4a', '#2f343d', '#45505e'], tree: 'tree', trees: 7, seed: 404 },
  ca: { roofs: ['#b06a32', '#c8a46a', '#d9c9a8', '#8a5a3a', '#e8e2d8'], towers: ['#45484d', '#5d636b', '#3a3f4a'], tree: 'palm', trees: 3, seed: 213 },
  fl: { roofs: ['#f2e2c8', '#e8c8a8', '#ffd8b0', '#c8e0e8', '#f2f2f2'], towers: ['#d0d4da', '#c8ccd2', '#9aa3ad'], tree: 'palm', trees: 4, seed: 305 },
  co: { roofs: ['#5a4632', '#3f4a5a', '#7a4b3a', '#6e6e6e', '#4a4a4a', '#8a3b2a'], towers: ['#3a3f4a', '#45505e', '#5d636b'], tree: 'pine', trees: 5, seed: 720 },
};

export function addStates({ buildings, lots, trees, props }, { landmarkBlock } = {}) {
  const water = [];
  for (const st of Object.values(STATES)) {
    const rnd = mulberry32(LOOK[st.id].seed), R = (a, b) => a + rnd() * (b - a), pick = a => a[Math.floor(rnd() * a.length)];
    const L = LOOK[st.id], c = cityRect(st), reg = regionRect(st);
    const locs = new Map();
    for (const l of LOCATIONS) if (l.city === st.id) locs.set(`${l.block[0]},${l.block[1]}`, l);
    const downtown = (i, j) => i >= 2 && i <= 5 && j >= 2 && j <= 5;
    for (let i = 0; i < STATE_N; i++) for (let j = 0; j < STATE_N; j++) {
      const bx = c.x0 + i * STATE_BLOCK, bz = c.z0 + j * STATE_BLOCK;
      const x0 = bx + 14, z0 = bz + 14, x1 = bx + STATE_BLOCK - 14, z1 = bz + STATE_BLOCK - 14, W = x1 - x0, D = z1 - z0;
      const loc = locs.get(`${i},${j}`);
      if (loc) { landmarkBlock?.(loc, x0, z0, x1, z1); continue; }
      if ((i * 5 + j * 3) % 11 === 0) {
        lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park' });
        for (let k = 0; k < 10; k++) trees.push({ x: R(x0 + 6, x1 - 6), z: R(z0 + 6, z1 - 6), r: R(3, 5.5), kind: L.tree });
        continue;
      }
      if (downtown(i, j) && rnd() < 0.75) {
        // towers
        const n = 2, g = 6, s = (W - g) / n;
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) buildings.push({ x: x0 + a * (s + g) + R(0, 4), z: z0 + b * (s + g) + R(0, 4), w: s - R(2, 6), d: s - R(2, 6), h: R(40, st.id === 'ga' ? 220 : 160), color: pick(L.towers), kind: 'tower' });
        continue;
      }
      if (rnd() < 0.2) {
        lots.push({ x: x0 + 2, z: z0 + 2, w: W - 4, d: D * 0.45, kind: 'parking' });
        buildings.push({ x: x0 + 4, z: z0 + D * 0.52, w: W - 8, d: D * 0.45, h: R(7, 12), color: pick(L.towers), kind: 'store' });
        continue;
      }
      // houses, four by four
      const n = 4, s = W / n;
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
        if ((a === 1 || a === 2) && (b === 1 || b === 2)) { if (rnd() < 0.6) trees.push({ x: x0 + a * s + s / 2, z: z0 + b * s + s / 2, r: R(3, 5), kind: L.tree }); continue; }
        lots.push({ x: x0 + a * s + 1, z: z0 + b * s + 1, w: s - 2, d: s - 2, kind: 'yard' });
        buildings.push({ x: x0 + a * s + 4 + R(0, 3), z: z0 + b * s + 4 + R(0, 3), w: R(12, 16), d: R(11, 14), h: R(5, 8), color: pick(L.roofs), kind: 'house' });
        if (st.id === 'fl' && rnd() < 0.35) props.push({ k: 'pool', x: x0 + a * s + s - 9, z: z0 + b * s + s - 8, w: 6, d: 5 });
      }
      for (let k = 0; k < L.trees; k++) trees.push({ x: R(x0 + 3, x1 - 3), z: R(z0 + 3, z1 - 3), r: R(2.5, 4), kind: L.tree });
    }
    // palms or oaks down the edge of every street
    for (let k = 0; k <= STATE_N; k++) for (let m = 0; m < STATE_N; m++) {
      if (rnd() < 0.5) trees.push({ x: c.x0 + k * STATE_BLOCK + 10, z: c.z0 + m * STATE_BLOCK + R(20, 130), r: L.tree === 'palm' ? 2.6 : 3.5, kind: L.tree });
    }

    // the airport: terminal on the south side of Airport Blvd, the apron and a runway behind it
    const ay = c.z0 + AIRPORT_ROW * STATE_BLOCK, ax0 = c.x0 - 560, ax1 = c.x0 - 60;
    lots.push({ x: ax0, z: ay + 22, w: ax1 - ax0, d: 60, kind: 'parking' });
    buildings.push({ x: c.x0 - 430, z: ay + 30, w: 200, d: 40, h: 14, color: '#c8ccd2', kind: 'landmark', label: LOCATIONS.find(l => l.id === st.airport)?.name || `${st.city} Airport`, labelColor: '#5fd3ff', loc: st.airport, shop: 'airport', side: 'N', accent: '#5fd3ff' });
    buildings.push({ x: c.x0 - 180, z: ay + 36, w: 14, d: 14, h: 36, color: '#d0d4da', kind: 'tower' });
    lots.push({ x: ax0, z: ay + 90, w: ax1 - ax0, d: 110, kind: 'lot' });                  // the apron
    lots.push({ x: reg.x0 + 20, z: ay + 220, w: ax1 - reg.x0 - 20, d: 50, kind: 'lot' });   // the runway
    for (let x = reg.x0 + 40; x < ax1 - 20; x += 30) lots.push({ x, z: ay + 244, w: 14, d: 2, kind: 'caliche' });
    for (const jx of [ax0 + 70, ax0 + 230, ax0 + 390]) {
      buildings.push({ x: jx - 3.5, z: ay + 100, w: 7, d: 46, h: 5, color: '#f2f2f2', kind: 'parked' });
      buildings.push({ x: jx - 22, z: ay + 114, w: 44, d: 7, h: 3, color: '#e0e0e0', kind: 'parked' });
      buildings.push({ x: jx - 8, z: ay + 140, w: 16, d: 4, h: 4, color: '#e0e0e0', kind: 'parked' });
    }
    // Denver's grow farms out east (data/weed.js)
    const farms = WEED_LOCATIONS.filter(l => l.state === st.id && l.lot);
    for (const f of farms) growLot(f, { buildings, lots, props }, R);
    // round the edge: woods in Atlanta, the hills over LA, the beach and the ocean off Miami
    if (st.id === 'fl') {
      // the bayfront: a strip of sand and palms (Biscayne Bay, the causeways and Miami Beach are world2d/metro.js)
      lots.push({ x: c.x1 + 30, z: reg.z0, w: 90, d: reg.z1 - reg.z0, kind: 'sand' });
      for (let z = reg.z0 + 10; z < reg.z1; z += 22) trees.push({ x: c.x1 + 26, z, r: 3, kind: 'palm' });
      for (let z = reg.z0 + 30; z < reg.z1 - 30; z += R(30, 60)) props.push({ k: 'umbrella', x: c.x1 + R(60, 110), z, r: 1.6, c: pick(['#ff1a2e', '#2c6fbb', '#e8c21a', '#2cff7a']) });
    }
    const edgeOk = (x, z) => !(x > c.x0 - 30 && x < c.x1 + 30 && z > c.z0 - 30 && z < c.z1 + 30) && !(x < c.x0 && Math.abs(z - ay) < 300) && !(st.id === 'fl' && x > c.x1)
      && !(x > c.x1 + 20 && x < c.x1 + 280 && z > c.z0 + 120 && z < c.z0 + 400)    // the land for sale
      && !farms.some(f => x > f.lot.x0 - 12 && x < f.lot.x1 + 12 && z > f.lot.z0 - 12 && z < f.lot.z1 + 12);
    for (let k = 0; k < 1800; k++) {
      const x = R(reg.x0 + 10, reg.x1 - 10), z = R(reg.z0 + 10, reg.z1 - 10);
      if (!edgeOk(x, z)) continue;
      if (st.id === 'co' && z < c.z0 - 60 && rnd() < 0.1) { buildings.push({ x, z: z - 40, w: R(60, 140), d: R(40, 80), h: R(20, 45), color: pick(['#6a6a72', '#7a7a80', '#8a8a90', '#e8eef2']), kind: 'rock' }); continue; }
      if (st.id === 'ca' && z < c.z0 - 40 && rnd() < 0.08) { buildings.push({ x, z: z - 30, w: R(40, 110), d: R(30, 60), h: R(10, 30), color: pick(['#8a7a5a', '#7a6a4a', '#9a8a6a']), kind: 'rock' }); continue; }
      if (st.id === 'co' && x > c.x1 + 200 && rnd() < 0.7) continue;   // the plains east of town are open
      trees.push({ x, z, r: R(3, 6), kind: st.id === 'ga' ? (rnd() < 0.6 ? 'pine' : 'tree') : st.id === 'ca' ? (rnd() < 0.5 ? 'tree' : 'palm') : st.id === 'co' ? (rnd() < 0.75 ? 'pine' : 'tree') : 'palm' });
    }
  }
  return { water };
}

// A grow farm's lot: a warehouse with a gravel yard, a row of greenhouses,
// or open outdoor rows with a drying barn. The labelled building is the
// door you walk up to (loc), right by the marker.
function growLot(f, { buildings, lots, props }, R) {
  const { x0, z0, x1, z1 } = f.lot, W = x1 - x0, D = z1 - z0;
  const label = { label: f.name, labelColor: '#2cff7a', loc: f.id, shop: 'growfarm', side: f.side, accent: '#2cff7a' };
  // the office sits at the edge facing the road
  const ow = 26, od = 16;
  const office = f.side === 'S' ? { x: (x0 + x1) / 2 - ow / 2, z: z1 - od - 4 } : f.side === 'N' ? { x: (x0 + x1) / 2 - ow / 2, z: z0 + 4 }
    : f.side === 'W' ? { x: x0 + 4, z: (z0 + z1) / 2 - ow / 2 } : { x: x1 - od - 4, z: (z0 + z1) / 2 - ow / 2 };
  const ns = f.side === 'N' || f.side === 'S';
  lots.push({ x: x0, z: z0, w: W, d: D, kind: 'lot' });
  if (f.look === 'warehouse') {
    lots.push({ x: x0 + 4, z: z0 + 4, w: W - 8, d: D - 8, kind: 'parking' });
    buildings.push({ x: x0 + 14, z: z0 + 14, w: W - 28, d: D * 0.55, h: 14, color: '#8a8f96', kind: 'warehouse', ...label });
    for (let k = 0; k < 4; k++) props.push({ k: 'hedge', x: x0 + 20 + k * 40, z: z0 + 6, w: 30, d: 2 });
    return;
  }
  if (f.look === 'greenhouse') {
    const n = 6, gw = (W - 40) / n;
    for (let k = 0; k < n; k++) buildings.push({ x: x0 + 20 + k * gw + 3, z: z0 + 50, w: gw - 6, d: D - 70, h: 6, color: '#cfe8d8', kind: 'store' });
    buildings.push({ x: office.x, z: office.z, w: ns ? ow : od, d: ns ? od : ow, h: 7, color: '#3a4a3a', kind: 'landmark', ...label });
    return;
  }
  // outdoor: rows and rows, a drying barn at the back
  lots.push({ x: x0 + 40, z: z0 + 20, w: W - 60, d: D - 40, kind: 'field', c: '#3f7a2e', dir: 'z' });
  buildings.push({ x: x1 - 70, z: z0 + 30, w: 50, d: 80, h: 10, color: '#7a3a2a', kind: 'barn' });
  for (let z = z0 + 30; z < z1 - 30; z += R(70, 120)) props.push({ k: 'shrub', x: x0 + 36, z, r: 2, c: '#2f6a2a' });
  buildings.push({ x: office.x, z: office.z, w: ns ? ow : od, d: ns ? od : ow, h: 7, color: '#3a4a3a', kind: 'landmark', ...label });
}
