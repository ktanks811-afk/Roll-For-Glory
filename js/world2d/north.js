// North Texas: up I-35W from Loop 820. The Alliance warehouses and truck
// courts at Heritage Trace with a travel center and a diesel shop, Alliance
// Airport's runway and cargo jets, the Northlake subdivisions, Texas Motor
// Speedway at TX-114 (the oval is a ring of track you can drive, the pit
// road comes off 114), the little Oak St main street in Roanoke, Argyle's
// ranches and the open prairie, then Denton at the top: the courthouse on the
// Square, UNT and its stadium, Fry Street, TWU's tower, old Victorian streets
// and Southeast Denton, with Lake Lewisville off to the east along US-377.
// The street grid is in world2d/roads.js and the businesses are in
// data/world.js (city: 'denton'); map.js builds their buildings with
// `landmarkBlock`. Own seed, so the rest of the map stays as it was. DOM-free.

import { NORTH, DENTON, DNGRID_X, DNGRID_Z, I35_END, HTRACE_Z, WESTPORT_Z, TX114_Z, ROANOKE_X, ROANOKE_END, TMS, TMS_PIT_X, AIRPORT_X, LEWISVILLE, HWY_Z, HWY_W, BLOCK, ROAD_W, LOCATIONS, LOC_BY_ID, districtAt } from '../data/world.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const BRICK = ['#8a3b2a', '#7a4a32', '#9a5a3a', '#6e3a2a', '#a0583a', '#8a6a4a', '#5a3a30'];
const MURAL = ['#d12a8a', '#e8c21a', '#1b9fc4', '#e8641a', '#7a2ad1', '#2ac46a'];
const WARE = ['#c9ccd1', '#b8bcc2', '#d6d8dc', '#a9aeb5', '#c2b8a8'];
const ROOFS = ['#6b3a2e', '#3f4a5a', '#5a4632', '#2f3b2f', '#6e6e6e', '#7a4b3a', '#4a3a4a', '#585048'];
const VICTORIAN = ['#7a4a5a', '#4a5a7a', '#5a7a5a', '#8a6a3a', '#6a4a3a'];
const CROPS = ['#55682e', '#6b7a34', '#7d7a3a', '#4a6a2c', '#8a7a3e'];
const TRAILERS = ['#e8e8e8', '#d9d9d9', '#c41b1b', '#1b4fc4', '#f2f2f2', '#2f6b3a'];

// Denton blocks that hold a landmark instead of filler
const SPECIAL = { '4,3': 'courthouse', '4,0': 'twu', '1,7': 'apogee', '1,5': 'unt' };

export function addNorth(out, { landmarkBlock, roads }) {
  const { buildings, lots, trees, props } = out;
  const rnd = mulberry32(76201);
  const R = (a, b) => a + rnd() * (b - a);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const nout = { ...out, R };          // landmarks and garages here draw from this seed
  const water = [];

  // ---------------- what nothing may touch ----------------
  const edges = roads.edges.filter(e => Math.min(e.az, e.bz) < HWY_Z - 40 && Math.max(e.ax, e.bx) > NORTH.x0 - 100 && Math.min(e.ax, e.bx) < NORTH.x1 + 100);
  const onRoad = (x0, z0, x1, z1, pad) => edges.some(e => {
    const h = e.width / 2 + pad;
    return x0 < Math.max(e.ax, e.bx) + h && x1 > Math.min(e.ax, e.bx) - h && z0 < Math.max(e.az, e.bz) + h && z1 > Math.min(e.az, e.bz) - h;
  });
  const busy = [];
  const claim = (x0, z0, x1, z1) => busy.push({ x0, z0, x1, z1 });
  const isBusy = (x0, z0, x1, z1, pad = 0) => busy.some(b => x0 < b.x1 + pad && x1 > b.x0 - pad && z0 < b.z1 + pad && z1 > b.z0 - pad);
  const inZone = (x0, z0, x1, z1) => x0 > NORTH.x0 + 10 && x1 < NORTH.x1 - 10 && z0 > NORTH.z0 + 10 && z1 < NORTH.z1 - 120;
  const free = (x0, z0, x1, z1, pad = 6) => inZone(x0, z0, x1, z1) && !onRoad(x0, z0, x1, z1, pad) && !isBusy(x0, z0, x1, z1, 2);
  const bld = (b, pad = 4) => { if (!free(b.x, b.z, b.x + b.w, b.z + b.d, pad)) return false; buildings.push(b); claim(b.x, b.z, b.x + b.w, b.z + b.d); return true; };
  // the Denton grid, the lake and every business are spoken for
  claim(DENTON.x0 - 20, DENTON.z0 - 20, DENTON.x1 + 20, DENTON.z1 + 20);
  claim(LEWISVILLE.x0 - 60, LEWISVILLE.z0 - 60, LEWISVILLE.x1 + 60, LEWISVILLE.z1 + 60);
  for (const l of LOCATIONS) if (!l.city && l.z < NORTH.z1) claim(l.x - 22, l.z - 22, l.x + 22, l.z + 22);
  const park = (x0, z0, W, D, n = 14) => {
    lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park' });
    for (let k = 0; k < n; k++) trees.push({ x: x0 + R(4, W - 4), z: z0 + R(4, D - 4), r: R(3, 6), kind: 'tree' });
  };

  // ================= Denton =================
  const locBlocks = new Map();
  for (const l of LOCATIONS) if (l.city === 'denton') locBlocks.set(`${l.block[0]},${l.block[1]}`, l);
  const inset = ROAD_W / 2 + 6, hwyInset = HWY_W / 2 + 6;
  for (let i = 0; i < DNGRID_X.length - 1; i++) {
    for (let j = 0; j < DNGRID_Z.length - 1; j++) {
      const x0 = DNGRID_X[i] + (i === 0 ? hwyInset : inset), x1 = DNGRID_X[i + 1] - inset;
      const z0 = DNGRID_Z[j] + inset, z1 = DNGRID_Z[j + 1] - inset;
      const W = x1 - x0, D = z1 - z0;
      const loc = locBlocks.get(`${i},${j}`);
      if (loc) { landmarkBlock(loc, x0, z0, x1, z1, nout); continue; }
      const sp = SPECIAL[`${i},${j}`];
      if (sp) { special(sp, x0, z0, x1, z1); continue; }
      const dist = districtAt((x0 + x1) / 2, (z0 + z1) / 2);
      if (dist === 'The Square' || (i === 2 && j === 4)) storefronts(x0, z0, W, D);   // the Square, and Fry Street by campus
      else if (dist === 'TWU' || dist === 'UNT') campus(x0, z0, W, D);
      else if (dist === 'East Denton' && j <= 1) victorians(x0, z0, W, D);
      else neighbourhood(x0, z0, W, D, dist === 'Southeast Denton');
    }
  }

  // the Square and Fry Street: a ring of narrow brick storefronts, a lot in the middle
  function storefronts(x0, z0, W, D) {
    const deep = 24;
    for (const [side, len] of [['N', W], ['S', W], ['W', D - deep * 2], ['E', D - deep * 2]]) {
      let u = 0;
      while (u < len - 6) {
        const w = Math.min(len - u, R(9, 16));
        const h = R(6, 11), color = rnd() < 0.15 ? pick(MURAL) : pick(BRICK);
        if (side === 'N') buildings.push({ x: x0 + u, z: z0, w: w - 0.8, d: deep, h, color, kind: 'store' });
        else if (side === 'S') buildings.push({ x: x0 + u, z: z0 + D - deep, w: w - 0.8, d: deep, h, color, kind: 'store' });
        else if (side === 'W') buildings.push({ x: x0, z: z0 + deep + u, w: deep, d: w - 0.8, h, color, kind: 'store' });
        else buildings.push({ x: x0 + W - deep, z: z0 + deep + u, w: deep, d: w - 0.8, h, color, kind: 'store' });
        u += w;
      }
    }
    lots.push({ x: x0 + deep + 3, z: z0 + deep + 3, w: W - deep * 2 - 6, d: D - deep * 2 - 6, kind: 'parking' });
  }
  // a quad: lawn and walks in the middle, brick halls around it
  function campus(x0, z0, W, D) {
    lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park', lawn: true });
    lots.push({ x: x0 + W / 2 - 2, z: z0, w: 4, d: D, kind: 'trail' });
    lots.push({ x: x0, z: z0 + D / 2 - 2, w: W, d: 4, kind: 'trail' });
    const hall = (x, z, w, d) => buildings.push({ x, z, w, d, h: R(12, 22), color: pick(BRICK), kind: 'midrise' });
    hall(x0 + 4, z0 + 4, W / 2 - 12, 30); hall(x0 + W / 2 + 8, z0 + 4, W / 2 - 12, 30);
    hall(x0 + 4, z0 + D - 34, W / 2 - 12, 30); hall(x0 + W / 2 + 8, z0 + D - 34, W / 2 - 12, 30);
    for (let k = 0; k < 10; k++) {
      const x = x0 + R(6, W - 6), z = z0 + R(40, D - 40);
      if (Math.abs(x - (x0 + W / 2)) > 4 && Math.abs(z - (z0 + D / 2)) > 4) trees.push({ x, z, r: R(3, 5.5), kind: 'tree' });
    }
  }
  // Oak St and the old north side: big painted Victorians on deep lots
  function victorians(x0, z0, W, D) {
    const n = 3, s = W / n, t = D / 2;
    for (let a = 0; a < n; a++) for (let b = 0; b < 2; b++) {
      const lx = x0 + a * s, lz = z0 + b * t;
      lots.push({ x: lx + 1, z: lz + 1, w: s - 2, d: t - 2, kind: 'yard' });
      buildings.push({ x: lx + 6, z: lz + (b ? t - 26 : 8), w: s - 14, d: 18, h: R(8, 11), color: pick(VICTORIAN), kind: 'house' });
      trees.push({ x: lx + R(4, s - 4), z: lz + (b ? R(4, 20) : R(t - 20, t - 4)), r: R(4, 6.5), kind: 'tree' });
    }
  }
  function neighbourhood(x0, z0, W, D, south) {
    if (rnd() < 0.08) { park(x0, z0, W, D); return; }
    const n = 4, s = W / n, t = D / n;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const lx = x0 + a * s, lz = z0 + b * t;
      if ((a === 1 || a === 2) && (b === 1 || b === 2)) { trees.push({ x: lx + s / 2, z: lz + t / 2, r: R(3, 5.5), kind: 'tree' }); continue; }
      if (south && rnd() < 0.12) { lots.push({ x: lx + 1, z: lz + 1, w: s - 2, d: t - 2, kind: 'dirt' }); continue; }
      if (south && rnd() < 0.04) { buildings.push({ x: lx + 3, z: lz + 3, w: s - 8, d: t - 10, h: 9, color: '#e8e2d8', kind: 'church' }); continue; }
      lots.push({ x: lx + 1, z: lz + 1, w: s - 2, d: t - 2, kind: 'yard' });
      buildings.push({ x: lx + 4 + R(0, 3), z: lz + 4 + R(0, 3), w: R(south ? 10 : 12, south ? 13 : 16), d: R(10, 13), h: R(4.5, 7), color: pick(ROOFS), kind: 'house' });
      if (rnd() < 0.6) trees.push({ x: lx + R(3, s - 3), z: lz + R(3, t - 3), r: R(2.5, 4.5), kind: 'tree' });
    }
  }
  function special(kind, x0, z0, x1, z1) {
    const W = x1 - x0, D = z1 - z0, cx = x0 + W / 2, cz = z0 + D / 2;
    if (kind === 'courthouse') {
      // the 1896 courthouse on the Square: pink granite, a clock tower, a lawn all round
      lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park', lawn: true });
      lots.push({ x: x0 + 6, z: z0 + 6, w: W - 12, d: D - 12, kind: 'plaza' });
      buildings.push({ x: cx - 26, z: cz - 22, w: 52, d: 44, h: 18, color: '#c9a68a', kind: 'midrise', label: 'DENTON COUNTY COURTHOUSE', labelColor: '#ffd84a' });
      buildings.push({ x: cx - 6, z: cz - 6, w: 12, d: 12, h: 34, color: '#b8957a', kind: 'tower' });
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        trees.push({ x: cx + Math.cos(a) * (W / 2 - 12), z: cz + Math.sin(a) * (D / 2 - 12), r: R(3, 4.5), kind: 'tree' });
      }
    } else if (kind === 'twu') {
      // TWU: the tower over a lawn, the Little Chapel in the Woods in the trees
      lots.push({ x: x0, z: z0, w: W, d: D, kind: 'park', lawn: true });
      buildings.push({ x: cx - 16, z: cz - 16, w: 32, d: 32, h: 75, color: '#d9d0bc', kind: 'tower', label: 'TWU', labelColor: '#a01a3a' });
      buildings.push({ x: x0 + 8, z: z1 - 26, w: 22, d: 16, h: 8, color: '#9a7a5a', kind: 'church' });
      for (let k = 0; k < 18; k++) { const x = x0 + R(4, W - 4), z = z0 + R(4, D - 4); if (Math.hypot(x - cx, z - cz) > 30 && !(x < x0 + 34 && z > z1 - 30)) trees.push({ x, z, r: R(3, 5.5), kind: 'tree' }); }
    } else if (kind === 'apogee') {
      lots.push({ x: x0, z: z0, w: W, d: D, kind: 'parking' });
      buildings.push({ x: x0 + 10, z: z0 + 10, w: W - 20, d: D - 20, h: 22, color: '#2f6b3a', kind: 'stands', round: true, label: 'APOGEE STADIUM', labelColor: '#2ac46a' });
    } else if (kind === 'unt') {
      lots.push({ x: x0, z: z0, w: W, d: D, kind: 'plaza' });
      buildings.push({ x: x0 + 8, z: z0 + 8, w: W - 16, d: 40, h: 20, color: '#8a5a3a', kind: 'midrise', label: 'UNT', labelColor: '#2ac46a' });
      buildings.push({ x: x0 + 8, z: z1 - 44, w: 46, d: 36, h: 16, color: '#7a4a32', kind: 'midrise' });
      buildings.push({ x: x1 - 54, z: z1 - 44, w: 46, d: 36, h: 16, color: '#9a5a3a', kind: 'midrise' });
      for (let k = 0; k < 8; k++) trees.push({ x: x0 + R(60, W - 60), z: z0 + R(54, D - 50), r: R(3, 4.5), kind: 'tree' });
    }
  }

  // ================= Alliance =================
  // the travel center and the diesel shop on the Heritage Trace frontage
  for (const id of ['gas_alliance', 'alliance_diesel']) {
    const l = LOC_BY_ID[id];
    const lx0 = l.x - 50, lz0 = HTRACE_Z + ROAD_W / 2 + 2;
    if (l.type === 'gas') {
      lots.push({ x: lx0, z: lz0, w: 100, d: 90, kind: 'gas' });
      buildings.push({ x: l.x - 22, z: lz0 + 52, w: 44, d: 20, h: 5, color: '#d0d0d0', kind: 'store', label: l.name, labelColor: l.color, loc: l.id, shop: 'gas', side: 'N', accent: l.color });
      buildings.push({ x: l.x - 22, z: lz0 + 12, w: 44, d: 22, h: 6, color: '#e9e9e9', kind: 'canopy', noCollide: true, label: 'GAS · DIESEL', loc: l.id });
    } else {
      lots.push({ x: lx0, z: lz0, w: 100, d: 90, kind: 'parking' });
      buildings.push({ x: l.x - 30, z: lz0 + 10, w: 60, d: 32, h: 10, color: '#3d4452', kind: 'landmark', label: l.name, labelColor: l.color, loc: l.id, shop: 'repair', side: 'N', accent: l.color });
      for (let k = 0; k < 4; k++) buildings.push({ x: lx0 + 8 + k * 22, z: lz0 + 58, w: 3, d: 20, h: 3.6, color: pick(TRAILERS), kind: 'parked' });
    }
    claim(lx0 - 4, lz0 - 4, lx0 + 104, lz0 + 94);
  }
  // distribution centers: long, low and pale, truck courts full of trailers
  for (const [za, zb] of [[HTRACE_Z + ROAD_W / 2 + 10, WESTPORT_Z - ROAD_W / 2 - 10], [WESTPORT_Z + ROAD_W / 2 + 10, NORTH.z1 - 150]]) {
    for (const [xa, xb] of [[-1180, -HWY_W / 2 - 14], [HWY_W / 2 + 14, 1580]]) {
      let x = xa;
      while (x < xb - 80) {
        const w = Math.min(xb - x, R(130, 230)), D = zb - za;
        if (free(x, za, x + w, zb, 2)) {
          const d = D * R(0.48, 0.58), north = rnd() < 0.5;          // the building on one side, the truck court on the other
          const bz = north ? za : zb - d, cz = north ? za + d + 4 : za, cd = D - d - 4;
          buildings.push({ x: x + 4, z: bz, w: w - 8, d, h: R(11, 15), color: pick(WARE), kind: 'warehouse', label: rnd() < 0.25 ? pick(['AMAZON FREIGHT', 'NORTHLINK LOGISTICS', 'BNSF INTERMODAL', 'LONE STAR COLD STORAGE', 'GALAXY PARCEL']) : undefined, labelColor: '#3a3f4a' });
          lots.push({ x: x + 4, z: cz, w: w - 8, d: cd, kind: 'lot' });
          for (let u = x + 10; u < x + w - 12; u += 6) if (rnd() < 0.55) buildings.push({ x: u, z: north ? cz + 2 : cz + cd - 18, w: 2.6, d: 16, h: 3.6, color: pick(TRAILERS), kind: 'parked' });
          claim(x, za, x + w, zb);
        }
        x += w + R(12, 30);
      }
    }
  }

  // ================= Alliance Airport =================
  {
    const rx = 1250, rz0 = TX114_Z + 50, rz1 = HTRACE_Z - 40;
    lots.push({ x: rx, z: rz0, w: 50, d: rz1 - rz0, kind: 'strip' });            // the runway
    lots.push({ x: rx - 50, z: rz0 + 30, w: 14, d: rz1 - rz0 - 60, kind: 'lot' });   // taxiway
    claim(rx - 60, rz0 - 10, rx + 60, rz1 + 10);
    const ax0 = 360, ax1 = 1180, apz0 = -4310, apz1 = HTRACE_Z - 240;
    lots.push({ x: ax0, z: apz0, w: ax1 - ax0, d: apz1 - apz0, kind: 'lot' });      // the apron
    lots.push({ x: rx - 40, z: apz0 + 20, w: 40, d: 30, kind: 'lot' });
    claim(ax0 - 4, apz0 - 4, ax1 + 4, apz1 + 4);
    for (let k = 0; k < 4; k++) {
      const hx = ax0 + 10 + k * 200;
      buildings.push({ x: hx, z: apz0 - 80, w: 170, d: 72, h: 15, color: '#9aa3ad', kind: 'warehouse', label: k === 1 ? 'ALLIANCE AIRPORT' : k === 3 ? 'AIR CARGO' : undefined, labelColor: '#1b4fc4' });
    }
    claim(ax0, apz0 - 84, ax1, apz0);
    buildings.push({ x: AIRPORT_X + 40, z: apz1 - 40, w: 16, d: 16, h: 38, color: '#d0d4da', kind: 'tower' });   // control tower
    buildings.push({ x: AIRPORT_X + 60, z: apz1 - 34, w: 60, d: 26, h: 8, color: '#c8ccd2', kind: 'store', label: 'TERMINAL', labelColor: '#1b4fc4' });
    // cargo jets parked on the apron, noses to the hangars
    for (const jx of [470, 690, 1030]) {
      buildings.push({ x: jx - 3.5, z: apz0 + 12, w: 7, d: 46, h: 5, color: '#f2f2f2', kind: 'parked' });
      buildings.push({ x: jx - 22, z: apz0 + 26, w: 44, d: 7, h: 3, color: '#e0e0e0', kind: 'parked' });
      buildings.push({ x: jx - 8, z: apz0 + 52, w: 16, d: 4, h: 4, color: '#e0e0e0', kind: 'parked' });
    }
  }

  // ================= Northlake: subdivisions west of I-35W =================
  for (let z = HTRACE_Z - ROAD_W / 2 - 40; z > TX114_Z + 30; z -= 44) {
    for (let x = -1180; x < -HWY_W / 2 - 40; x += 34) {
      if (rnd() < 0.18) continue;
      if (!free(x - 3, z - 3, x + 23, z + 21, 6)) continue;
      lots.push({ x: x - 3, z: z - 3, w: 26, d: 24, kind: 'yard' });
      buildings.push({ x: x + R(0, 3), z: z + R(0, 3), w: R(12, 16), d: R(11, 14), h: R(4.5, 7), color: pick(ROOFS), kind: 'house' });
      if (rnd() < 0.5) trees.push({ x: x + R(0, 20), z: z + 17 + R(0, 3), r: R(2.5, 4), kind: 'tree' });
      claim(x - 3, z - 3, x + 23, z + 21);
    }
  }

  // ================= Texas Motor Speedway =================
  {
    const T = TMS, tw = HWY_W / 2;
    // the infield: grass, the infield road, the media center
    lots.push({ x: T.x0 + tw + 4, z: T.z0 + tw + 4, w: T.x1 - T.x0 - 2 * tw - 8, d: T.z1 - T.z0 - 2 * tw - 8, kind: 'park', lawn: true });
    lots.push({ x: T.x0 + 60, z: T.z0 + 80, w: T.x1 - T.x0 - 120, d: 10, kind: 'lot' });
    lots.push({ x: T.x0 + 60, z: T.z1 - 90, w: T.x1 - T.x0 - 120, d: 10, kind: 'lot' });
    buildings.push({ x: (T.x0 + T.x1) / 2 - 40, z: (T.z0 + T.z1) / 2 - 25, w: 80, d: 50, h: 10, color: '#3a3f4a', kind: 'midrise', label: 'INFIELD MEDIA CENTER', labelColor: '#e8c21a' });
    // a start/finish line across the front stretch, by the pit road
    lots.push({ x: TMS_PIT_X + 40, z: T.z1 - tw, w: 3, d: HWY_W, kind: 'strip' });
    // the grandstands: east, west and the long back side
    buildings.push({ x: T.x1 + tw + 12, z: T.z0 - 10, w: 60, d: T.z1 - T.z0 + 20, h: 26, color: '#5a5f69', kind: 'stands', label: 'TEXAS MOTOR SPEEDWAY', labelColor: '#ff1a2e' });
    buildings.push({ x: T.x0 - tw - 72, z: T.z0 - 10, w: 60, d: T.z1 - T.z0 + 20, h: 22, color: '#5a5f69', kind: 'stands' });
    buildings.push({ x: T.x0 - 10, z: T.z0 - tw - 72, w: T.x1 - T.x0 + 20, d: 60, h: 24, color: '#5a5f69', kind: 'stands', label: 'THE GREAT AMERICAN SPEEDWAY', labelColor: '#e8c21a' });
    // pit garages along the front stretch, either side of the pit road
    for (const [a, b] of [[T.x0 + 20, TMS_PIT_X - 20], [TMS_PIT_X + 20, T.x1 - 20]])
      for (let x = a; x < b - 20; x += 36) buildings.push({ x, z: T.z1 + tw + 6, w: 32, d: 22, h: 6, color: pick(['#c41b1b', '#e8e8e8', '#1b4fc4']), kind: 'store' });
    // the lot between the speedway and 114 (the meet is on the east half)
    lots.push({ x: T.x0 - 140, z: T.z1 + tw + 34, w: TMS_PIT_X - ROAD_W / 2 - 4 - (T.x0 - 140), d: TX114_Z - ROAD_W / 2 - 2 - (T.z1 + tw + 34), kind: 'parking' });
    lots.push({ x: TMS_PIT_X + ROAD_W / 2 + 4, z: T.z1 + tw + 34, w: T.x1 + 140 - (TMS_PIT_X + ROAD_W / 2 + 4), d: TX114_Z - ROAD_W / 2 - 2 - (T.z1 + tw + 34), kind: 'parking' });
    claim(T.x0 - tw - 90, T.z0 - tw - 90, T.x1 + tw + 90, TX114_Z - ROAD_W / 2);
  }

  // ================= Roanoke: Oak St off 114 =================
  {
    const x = ROANOKE_X, h = ROAD_W / 2;
    const row = (bx, w, side) => {
      for (let z = TX114_Z + h + 12; z < ROANOKE_END - 20; z += R(12, 18)) {
        const d = Math.min(R(10, 16), ROANOKE_END - 20 - z);
        if (d < 6) break;
        let loc = null;
        for (const id of ['roanoke_food', 'roanoke_repair']) { const l = LOC_BY_ID[id]; if (l.side === side && z < l.z + 18 && z + d > l.z - 18) loc = l; }   // the shop's own building goes there
        if (loc) continue;
        buildings.push({ x: bx, z, w, d: d - 0.8, h: R(5, 8), color: rnd() < 0.15 ? pick(MURAL) : pick(BRICK), kind: 'store' });
      }
    };
    row(x - h - 33, 24, 'E'); row(x + h + 8, 24, 'W');
    const food = LOC_BY_ID.roanoke_food, shop = LOC_BY_ID.roanoke_repair;
    buildings.push({ x: x - h - 35, z: food.z - 14, w: 26, d: 28, h: 6, color: '#7a2e24', kind: 'landmark', label: food.name, labelColor: food.color, loc: food.id, shop: 'food', side: 'E', accent: food.color });
    buildings.push({ x: x + h + 8, z: shop.z - 16, w: 32, d: 32, h: 8, color: '#3d4452', kind: 'landmark', label: shop.name, labelColor: shop.color, loc: shop.id, shop: 'repair', side: 'W', accent: shop.color });
    lots.push({ x: x + h + 42, z: shop.z - 16, w: 30, d: 32, kind: 'parking' });
    claim(x - h - 40, TX114_Z, x + h + 72, ROANOKE_END);
    // houses around the old town
    for (let z = TX114_Z + 40; z < ROANOKE_END + 60; z += 40)
      for (let hx = x - 300; hx < x + 300; hx += 34) {
        if (rnd() < 0.25 || !free(hx - 3, z - 3, hx + 23, z + 21, 6)) continue;
        lots.push({ x: hx - 3, z: z - 3, w: 26, d: 24, kind: 'yard' });
        buildings.push({ x: hx + R(0, 3), z: z + R(0, 3), w: R(11, 15), d: R(10, 13), h: R(4.5, 6.5), color: pick(ROOFS), kind: 'house' });
        if (rnd() < 0.5) trees.push({ x: hx + R(0, 20), z: z + 16 + R(0, 3), r: R(2.5, 4), kind: 'tree' });
        claim(hx - 3, z - 3, hx + 23, z + 21);
      }
    // the water tower
    bld({ x: x + 120, z: TX114_Z + 30, w: 14, d: 14, h: 30, color: '#d8d8d8', kind: 'tower', round: true, label: 'ROANOKE', labelColor: '#1b4fc4' });
  }

  // ================= Lake Lewisville =================
  {
    const L = LEWISVILLE;
    water.push({ x: L.x0, z: L.z0, w: L.x1 - L.x0, d: L.z1 - L.z0, kind: 'sea' });
    // the beach all round (four strips: the water's drawn under the lots)
    lots.push({ x: L.x0 - 30, z: L.z0 - 30, w: L.x1 - L.x0 + 60, d: 30, kind: 'sand' }, { x: L.x0 - 30, z: L.z1, w: L.x1 - L.x0 + 60, d: 30, kind: 'sand' },
      { x: L.x0 - 30, z: L.z0, w: 30, d: L.z1 - L.z0, kind: 'sand' }, { x: L.x1, z: L.z0, w: 30, d: L.z1 - L.z0, kind: 'sand' });
    // a marina: boat ramp, docks, a bait shop
    for (let k = 0; k < 4; k++) buildings.push({ x: L.x0, z: -5600 + k * 40, w: 70, d: 5, h: 1, color: '#6b5a44', kind: 'pier', noCollide: true });
    lots.push({ x: L.x0 - 120, z: -5620, w: 90, d: 160, kind: 'parking' });
    buildings.push({ x: L.x0 - 200, z: -5600, w: 60, d: 24, h: 6, color: '#5a7a8a', kind: 'store', label: 'LEWISVILLE MARINA', labelColor: '#1b9fc4' });
    for (let k = 0; k < 10; k++) buildings.push({ x: L.x0 - 110 + (k % 5) * 14, z: -5600 + Math.floor(k / 5) * 60, w: 3, d: 9, h: 2.2, color: pick(['#e8e8e8', '#1b4fc4', '#c41b1b']), kind: 'parked' });
    claim(L.x0 - 210, -5630, L.x0, -5450);
  }

  // ================= the country in between =================
  // shoulder trees along the freeways and highways
  for (let z = NORTH.z1 - 130; z > I35_END; z -= 50) for (const s of [-1, 1]) {
    const tx = s * (HWY_W / 2 + R(14, 36)), tz = z + R(-10, 10);
    if (free(tx - 1, tz - 1, tx + 1, tz + 1, 3)) trees.push({ x: tx, z: tz, r: R(4, 7), kind: rnd() < 0.5 ? 'pine' : 'tree' });
  }
  // ranches, hay fields and pasture
  for (let k = 0; k < 260; k++) {
    const x = R(NORTH.x0 + 20, NORTH.x1 - 200), z = R(NORTH.z0 + 20, NORTH.z1 - 200);
    const w = R(110, 200), d = R(90, 170);
    if (!free(x, z, x + w, z + d, 10)) continue;
    lots.push({ x, z, w, d, kind: 'field', c: pick(CROPS), dir: rnd() < 0.7 ? (rnd() < 0.5 ? 'x' : 'z') : 'none' });
    claim(x, z, x + w, z + d);
    if (rnd() < 0.3) {   // a farmhouse and a barn at one corner
      const fx = x + 6, fz = z + 6;
      buildings.push({ x: fx, z: fz, w: 14, d: 12, h: 6, color: pick(ROOFS), kind: 'house' });
      buildings.push({ x: fx + 22, z: fz, w: 20, d: 16, h: 8, color: '#8a3b2a', kind: 'barn' });
    }
  }
  // woods everywhere else
  for (let k = 0; k < 4200; k++) {
    const x = R(NORTH.x0 + 15, NORTH.x1 - 15), z = R(NORTH.z0 + 15, NORTH.z1 - 15);
    if (!free(x - 1, z - 1, x + 1, z + 1, 6)) continue;
    trees.push({ x, z, r: R(3, 6.5), kind: rnd() < 0.65 ? 'tree' : 'pine' });
  }
  // a few trees in the parking lots' medians stay; anything on a building goes
  keepTreesOff(trees, buildings);
  return { water, props };
}

function keepTreesOff(trees, buildings) {
  const solid = buildings.filter(b => b.z < NORTH.z1 + 40 && b.kind !== 'pier' && !b.noCollide);
  for (let i = trees.length - 1; i >= 0; i--) {
    const t = trees[i];
    if (t.z > NORTH.z1 + 40) continue;
    if (solid.some(o => t.x > o.x - 1 && t.x < o.x + o.w + 1 && t.z > o.z - 1 && t.z < o.z + o.d + 1)) trees.splice(i, 1);
  }
}

