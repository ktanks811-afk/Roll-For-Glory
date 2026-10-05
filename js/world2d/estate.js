// Real estate on the map. DOM-free (check-data builds the map in node).
//
// Map time (addEstate): the places off the city grid get their ground
// cleared of filler scenery, the Stop Six trap house is built as a drive-in
// garage, land for sale is a dirt lot, and the plug gets his corner store.
//
// Run time (applyEstate): houses you built on your land go up on the map
// (and come down again if you load a different career).
// Customers and SWAT raids are in world2d/trap.js.

import { garageBlock } from './map.js';
import { ESTATE_LOCATIONS, RIGS, FENCE_BY_ID } from '../data/estate.js';
import { PROPERTIES } from '../data/world.js';
import { registerBuilds, isBuilt, houseDesign, pasture } from '../core/estate.js';

const overlaps = (o, r, pad = 0) => o.x < r.x1 + pad && o.x + (o.w || 0) > r.x0 - pad && o.z < r.z1 + pad && o.z + (o.d || 0) > r.z0 - pad;
const inLot = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
const keep = (arr, fn) => { let j = 0; for (let i = 0; i < arr.length; i++) if (fn(arr[i])) arr[j++] = arr[i]; arr.length = j; };

// ---------------------------------------------------------------- map time
export function addEstate(out) {
  const { buildings, lots, trees, props } = out;
  out.oil = [];
  for (const loc of ESTATE_LOCATIONS) {
    const r = loc.lot, w = r.x1 - r.x0, d = r.z1 - r.z0;
    // make room: the filler houses, yards and trees on this lot go
    keep(buildings, b => b.loc || b.noCollide || !overlaps(b, r, 1));
    keep(lots, l => l.kind === 'lane' || l.loc || !overlaps(l, r, -1));
    keep(trees, t => !inLot(t.x, t.z, r, t.r));
    if (props) keep(props, p => !inLot(p.x, p.z, r, 1));
    if (loc.type === 'trap' || loc.type === 'property') garageBlock(out, loc, r.x0, r.z0, r.x1, r.z1, PROPERTIES[loc.id]);
    else if (loc.type === 'rig') oilPad(out, loc);
    else if (loc.type === 'land') {
      const dirt = { x: r.x0, z: r.z0, w, d, kind: 'dirt', loc: loc.id, landLot: true };
      dirt.w0 = w; dirt.d0 = d;
      lots.push(dirt);
    } else if (loc.type === 'salebarn') saleBarn(out, loc);
    else if (loc.type === 'plug') {
      // corner store: the building at the back of the lot, a strip of parking in front
      lots.push({ x: r.x0 + 2, z: r.z0 + 1, w: w - 4, d: 14, kind: 'parking', loc: loc.id });
      buildings.push({ x: r.x0 + 8, z: r.z0 + 17, w: w - 16, d: d - 22, h: 5, color: '#5a4a3a', kind: 'landmark', label: "Lil Tre's", labelColor: loc.color, loc: loc.id, shop: 'plug', side: loc.side, accent: loc.color });
    }
  }
}

// An oil lease: a caliche pad, pumpjacks nodding on it (world2d/ranch.js
// animates them), a row of tanks and a separator.
function oilPad(out, loc) {
  const { buildings, lots } = out, r = loc.lot, w = r.x1 - r.x0, d = r.z1 - r.z0;
  const R = RIGS[loc.id];
  lots.push({ x: r.x0 + 4, z: r.z0 + 4, w: w - 8, d: d - 8, kind: 'caliche', loc: loc.id });
  // the lease road in from the street side
  lots.push({ x: loc.x - 4, z: Math.min(loc.z, r.z0 + 4), w: 8, d: Math.abs(loc.z - (r.z0 + 4)) + 2, kind: 'caliche', loc: loc.id });
  const jacks = [];
  for (let k = 0; k < R.jacks; k++) {
    const jx = r.x0 + 18 + (k % 2) * (w - 52), jz = r.z0 + 22 + Math.floor(k / 2) * 46;
    const b = { x: jx, z: jz, w: 12, d: 4, h: 4, color: '#2a2b2e', kind: 'pumpjack', loc: loc.id, phase: k * 1.7 };
    buildings.push(b); jacks.push(b);
  }
  // tank battery along the back
  for (let k = 0; k < Math.min(6, R.jacks + 2); k++) buildings.push({ x: r.x0 + 10 + k * 9, z: r.z1 - 22, w: 7, d: 7, h: 7, color: '#c8c2b4', kind: 'tank', round: true, loc: loc.id });
  buildings.push({ x: r.x1 - 30, z: r.z1 - 24, w: 14, d: 6, h: 3.5, color: '#5d636b', kind: 'store', loc: loc.id });
  out.oil.push({ id: loc.id, jacks });
}

// The sale barn: a caliche lot to swing a trailer round in, the auction barn
// at the back, and holding pens of cattle down the side.
function saleBarn(out, loc) {
  const { buildings, lots, props } = out, r = loc.lot, w = r.x1 - r.x0, d = r.z1 - r.z0;
  lots.push({ x: r.x0 + 2, z: r.z0 + 2, w: w - 4, d: d - 4, kind: 'caliche', loc: loc.id });
  buildings.push({ x: r.x0 + 40, z: r.z1 - 58, w: 80, d: 44, h: 9, color: '#8a3b2a', kind: 'landmark', label: 'Joshua Livestock Auction', labelColor: loc.color, loc: loc.id, shop: 'salebarn', side: 'N', accent: loc.color });
  // pens along the west side, four of them, with a few head waiting in each
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const px0 = r.x0 + 8, pw = 26, pd = 22, t = 0.25;
  for (let k = 0; k < 4; k++) {
    const pz = r.z0 + 30 + k * (pd + 2);
    for (const [x, z, ww, dd] of [[px0, pz, pw, t], [px0, pz + pd, pw, t], [px0, pz, t, pd], [px0 + pw, pz, t, pd - 6]]) buildings.push({ x, z, w: ww, d: dd, h: 1.3, color: '#9aa0a6', kind: 'fence', loc: loc.id });
    if (props) for (let c = 0; c < 3 + (k % 3); c++) props.push({ k: 'cow', x: px0 + 3 + rnd() * (pw - 6), z: pz + 3 + rnd() * (pd - 6), w: 0, d: 0, c: ['#1e1e20', '#6a3a22', '#b06a32'][(k + c) % 3], a: rnd() * 6.28 });
  }
}

// ---------------------------------------------------------------- run time
// Removes what an earlier career put up, then builds this career's houses.
export function applyEstate(map, s) {
  registerBuilds(s);
  const old = map.estateAdded;
  if (old) {
    const dead = new Set(old.all);
    keep(map.buildings, b => !dead.has(b)); keep(map.lots, l => !dead.has(l)); keep(map.trees, t => !dead.has(t)); keep(map.props, p => !dead.has(p));
    keep(map.colliders, c => !dead.has(c)); keep(map.garages, g => !dead.has(g)); keep(map.houses, h => !dead.has(h));
    for (const grid of [map.grid, map.drawGrid]) for (const arr of grid.map.values()) keep(arr, e => !dead.has(e) && !dead.has(e.o));
  }
  const all = [];
  const fence = (x, z, w, d, F, loc) => {
    const b = { x, z, w, d, h: 1.3, color: F.color, kind: 'fence', loc };
    const e = { type: 'b', o: b };
    map.buildings.push(b); map.drawGrid.insert(e, b.x, b.z, b.x + b.w, b.z + b.d);
    const c = { x0: b.x, z0: b.z, x1: b.x + b.w, z1: b.z + b.d, h: 1.3, b };
    map.colliders.push(c); map.grid.insert(c, c.x0, c.z0, c.x1, c.z1);
    all.push(b, e, c);
  };
  for (const loc of ESTATE_LOCATIONS) {
    if (loc.type !== 'land') continue;
    const built = isBuilt(s, loc.id);
    // the dirt lot shows until a house stands on it
    for (const l of map.lots) if (l.landLot && l.loc === loc.id) { l.w = built ? 0 : l.w0; l.d = built ? 0 : l.d0; }
    // a fenced pasture out back, with a gate on the side nearest the house
    const fl = s.estate?.land?.[loc.id];
    if (fl?.owned && fl.fence && FENCE_BY_ID[fl.fence]) {
      const P = pasture(loc), F = FENCE_BY_ID[fl.fence], t = 0.25, gate = 7;
      const gx = (P.x0 + P.x1) / 2, gz = (P.z0 + P.z1) / 2;
      // the side facing the street gets the gate
      const front = loc.side === 'N' ? 'n' : loc.side === 'S' ? 's' : loc.side === 'W' ? 'w' : 'e';
      const side = (which, a0, a1, at) => {
        const horiz = which === 'n' || which === 's';
        const g0 = (horiz ? gx : gz) - gate / 2, g1 = g0 + gate;
        const segs = which === front ? [[a0, g0], [g1, a1]] : [[a0, a1]];
        for (const [p, q] of segs) if (horiz) fence(p, at - t / 2, q - p, t, F, loc.id); else fence(at - t / 2, p, t, q - p, F, loc.id);
      };
      side('n', P.x0, P.x1, P.z0); side('s', P.x0, P.x1, P.z1); side('w', P.z0, P.z1, P.x0); side('e', P.z0, P.z1, P.x1);
    }
    if (!built) continue;
    const r = loc.lot;
    const out = { buildings: [], lots: [], garages: [], trees: [], props: [], houses: [], R: (a, b) => (a + b) / 2 };
    garageBlock(out, loc, r.x0, r.z0, r.x1, r.z1, PROPERTIES[loc.id], houseDesign(s, loc.id));
    for (const p of out.props) {
      map.props.push(p); const e = { type: 'p', o: p };
      map.drawGrid.insert(e, p.x, p.z, p.x + (p.w || 0), p.z + (p.d || 0)); all.push(p, e);
    }
    for (const hs of out.houses) {
      map.houses.push(hs); all.push(hs);
      if (hs.panel) { map.colliders.push(hs.panel); map.grid.insert(hs.panel, hs.panel.x0, hs.panel.z0, hs.panel.x1, hs.panel.z1); all.push(hs.panel); }
    }
    for (const b of out.buildings) {
      const e = { type: 'b', o: b };
      map.buildings.push(b); map.drawGrid.insert(e, b.x, b.z, b.x + b.w, b.z + b.d); all.push(b, e);
      if (b.noCollide) continue;
      const c = { x0: b.x, z0: b.z, x1: b.x + b.w, z1: b.z + b.d, h: b.h, b };
      map.colliders.push(c); map.grid.insert(c, c.x0, c.z0, c.x1, c.z1); all.push(c);
    }
    for (const l of out.lots) { map.lots.push(l); const e = { type: 'l', o: l }; map.drawGrid.insert(e, l.x, l.z, l.x + l.w, l.z + l.d); all.push(l, e); }
    for (const t of out.trees) { map.trees.push(t); const e = { type: 't', o: t }; map.drawGrid.insert(e, t.x - t.r, t.z - t.r, t.x + t.r, t.z + t.r); all.push(t, e); }
    for (const g of out.garages) {
      g.panel = { x0: g.door.x, z0: g.door.z, x1: g.door.x + g.door.w, z1: g.door.z + g.door.d, h: 4, off: false, door: g.id };
      map.colliders.push(g.panel); map.grid.insert(g.panel, g.panel.x0, g.panel.z0, g.panel.x1, g.panel.z1);
      map.garages.push(g); all.push(g, g.panel);
    }
  }
  map.estateAdded = { all };
}
