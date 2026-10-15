// Real estate on the map. DOM-free (check-data builds the map in node).
//
// Map time (addEstate): the places off the city grid get their ground
// cleared of filler scenery, the Stop Six trap house is built as a drive-in
// garage, land for sale is a dirt lot, and the plug gets his corner store.
//
// Run time (applyEstate): houses you built on your land go up on the map
// (and come down again if you load a different career), and so do the ones
// other players on your server built on theirs (setForeignLand).
// Customers and SWAT raids are in world2d/trap.js.

import { garageBlock } from './map.js';
import { RectGrid } from './rectGrid.js';
import { ESTATE_LOCATIONS, RIGS, FENCE_BY_ID, LAND, DEV_BY_ID } from '../data/estate.js';
import { PROPERTIES } from '../data/world.js';
import { registerBuilds, isBuilt, houseDesign, pasture, homesite, builtProperty, devOf, devLayout, rentRoll, now } from '../core/estate.js';

const overlaps = (o, r, pad = 0) => o.x < r.x1 + pad && o.x + (o.w || 0) > r.x0 - pad && o.z < r.z1 + pad && o.z + (o.d || 0) > r.z0 - pad;
const inLot = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
const keep = (arr, fn) => { let j = 0; for (let i = 0; i < arr.length; i++) if (fn(arr[i])) arr[j++] = arr[i]; arr.length = j; };

// ---------------------------------------------------------------- map time
export function addEstate(out) {
  const { buildings, lots, trees, props } = out;
  out.oil = [];
  // make room: the filler houses, yards and trees on every lot go. One pass
  // over what was already on the map (with the lots bucketed so each thing
  // only checks the lots near it), then each lot below only has to clear what
  // the lots before it put down.
  const rule = {
    b: r => b => b.loc || b.noCollide || !overlaps(b, r, 1),
    l: r => l => l.kind === 'lane' || l.loc || !overlaps(l, r, -1),
    t: r => t => !inLot(t.x, t.z, r, t.r),
    p: r => p => !inLot(p.x, p.z, r, 1),
  };
  const lotGrid = new RectGrid(200);
  for (const loc of ESTATE_LOCATIONS) lotGrid.add(loc.lot, loc.lot.x0, loc.lot.z0, loc.lot.x1, loc.lot.z1);
  const clearAll = (arr, k, box) => arr && keep(arr, o => { const [x0, z0, x1, z1] = box(o); return !lotGrid.some(x0, z0, x1, z1, r => !rule[k](r)(o)); });
  clearAll(buildings, 'b', b => [b.x - 2, b.z - 2, b.x + (b.w || 0) + 2, b.z + (b.d || 0) + 2]);
  clearAll(lots, 'l', l => [l.x - 2, l.z - 2, l.x + (l.w || 0) + 2, l.z + (l.d || 0) + 2]);
  clearAll(trees, 't', t => [t.x - Math.abs(t.r) - 2, t.z - Math.abs(t.r) - 2, t.x + Math.abs(t.r) + 2, t.z + Math.abs(t.r) + 2]);
  clearAll(props, 'p', p => [p.x - 2, p.z - 2, p.x + 2, p.z + 2]);
  const base = { b: buildings.length, l: lots.length, t: trees.length, p: props?.length };
  const keepNew = (arr, from, fn) => { let j = from; for (let i = from; i < arr.length; i++) if (fn(arr[i])) arr[j++] = arr[i]; arr.length = j; };
  for (const loc of ESTATE_LOCATIONS) {
    const r = loc.lot, w = r.x1 - r.x0, d = r.z1 - r.z0;
    keepNew(buildings, base.b, rule.b(r));
    keepNew(lots, base.l, rule.l(r));
    keepNew(trees, base.t, rule.t(r));
    if (props) keepNew(props, base.p, rule.p(r));
    if (loc.type === 'trap' || loc.type === 'property') garageBlock(out, loc, r.x0, r.z0, r.x1, r.z1, PROPERTIES[loc.id]);
    else if (loc.type === 'rig') oilPad(out, loc);
    else if (loc.type === 'land') {
      // a big ranch: grass all over and a cleared homesite by the gate (world2d/brazos.js puts the trees back)
      const hs = homesite(loc);
      if (LAND[loc.id]?.huge) lots.push({ x: r.x0, z: r.z0, w, d, kind: 'field', c: '#4f6a2e', dir: 'none', loc: loc.id });
      const dirt = { x: hs.x0, z: hs.z0, w: hs.x1 - hs.x0, d: hs.z1 - hs.z0, kind: 'dirt', loc: loc.id, landLot: true };
      dirt.w0 = dirt.w; dirt.d0 = dirt.d;
      lots.push(dirt);
    } else if (loc.type === 'salebarn') saleBarn(out, loc);
    else if (loc.type === 'kennel') kennel(out, loc);
    else if (loc.type === 'hoghunt') hogLease(out, loc);
    else if (loc.type === 'baypen') bayPen(out, loc);
    else if (loc.type === 'expo') expo(out, loc);
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

// Cross Timbers Hog Dogs: the kennel building up front, chain-link runs out
// back with a dog house in each, and a gravel lot.
function kennel(out, loc) {
  const { buildings, lots } = out, r = loc.lot, w = r.x1 - r.x0;
  lots.push({ x: r.x0 + 2, z: r.z0 + 2, w: w - 4, d: r.z1 - r.z0 - 4, kind: 'caliche', loc: loc.id });
  buildings.push({ x: r.x0 + 50, z: r.z1 - 44, w: 60, d: 26, h: 6, color: '#7a5a3a', kind: 'landmark', label: 'Cross Timbers Hog Dogs', labelColor: loc.color, loc: loc.id, shop: 'kennel', side: 'S', accent: loc.color });
  for (let k = 0; k < 6; k++) {
    const x = r.x0 + 12 + k * 23, z = r.z0 + 12, t = 0.2;
    for (const [fx, fz, fw, fd] of [[x, z, 18, t], [x, z + 34, 18, t], [x, z, t, 34], [x + 18, z, t, 34]]) buildings.push({ x: fx, z: fz, w: fw, d: fd, h: 1.8, color: '#a8adb3', kind: 'fence', loc: loc.id });
    buildings.push({ x: x + 6, z: z + 4, w: 6, d: 5, h: 2.2, color: ['#8a3b2a', '#c8b28a', '#5d636b'][k % 3], kind: 'house', loc: loc.id });
  }
}

// The hog lease: a caliche pad by the gate, a deer stand, and the river
// bottoms behind it (the woods stay; only the pad is cleared).
function hogLease(out, loc) {
  const { buildings, lots, trees } = out, r = loc.lot;
  lots.push({ x: r.x0 + 110, z: r.z0 + 2, w: 80, d: 40, kind: 'caliche', loc: loc.id });
  buildings.push({ x: r.x0 + 130, z: r.z0 + 46, w: 40, d: 18, h: 4, color: '#6a5a42', kind: 'landmark', label: 'Nolan River Hog Lease', labelColor: '#e8c89a', loc: loc.id, shop: 'hoghunt', side: 'N', accent: loc.color });
  let seed = 23;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 140; k++) {
    const x = r.x0 + 6 + rnd() * (r.x1 - r.x0 - 12), z = r.z0 + 70 + rnd() * (r.z1 - r.z0 - 76);
    trees.push({ x, z, r: 3 + rnd() * 3.5, kind: rnd() < 0.7 ? 'tree' : 'pine' });
  }
  for (let k = 0; k < 40; k++) {
    const x = r.x0 + 6 + rnd() * (r.x1 - r.x0 - 12), z = r.z0 + 70 + rnd() * 40;
    if (x > r.x0 + 100 && x < r.x0 + 200) continue;
    trees.push({ x, z, r: 2.5 + rnd() * 3, kind: 'tree' });
  }
}

// The Rio Vista Bay Pen: a round hog-proof pen (panels on posts), the judges'
// stand and a covered bleacher, a row of dog boxes on the trucks' side.
function bayPen(out, loc) {
  const { buildings, lots } = out, r = loc.lot, w = r.x1 - r.x0, d = r.z1 - r.z0;
  lots.push({ x: r.x0 + 2, z: r.z0 + 2, w: w - 4, d: d - 4, kind: 'caliche', loc: loc.id });
  const cx = r.x0 + w * 0.6, cz = r.z0 + d * 0.55, R = 34, n = 16;
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2, x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R;
    buildings.push({ x: x - 3, z: z - 3, w: 6, d: 6, h: 1.6, color: '#a8adb3', kind: 'fence', loc: loc.id });
  }
  buildings.push({ x: r.x0 + 14, z: r.z0 + 40, w: 36, d: 20, h: 5, color: '#6a4a2e', kind: 'landmark', label: 'Rio Vista Bay Pen', labelColor: loc.color, loc: loc.id, shop: 'baypen', side: 'N', accent: loc.color });
  buildings.push({ x: r.x0 + 14, z: r.z0 + 72, w: 30, d: 12, h: 3, color: '#8a7a5a', kind: 'store', loc: loc.id });
  for (let k = 0; k < 5; k++) buildings.push({ x: r.x0 + 12 + k * 10, z: r.z1 - 22, w: 7, d: 5, h: 2, color: ['#c8b28a', '#5d636b'][k % 2], kind: 'house', loc: loc.id });
}

// The Cleburne Expo Center: the show arena, a horse barn, the fair midway
// (a Ferris wheel and a couple of tents) and a big parking lot up front.
function expo(out, loc) {
  const { buildings, lots } = out, r = loc.lot, w = r.x1 - r.x0, d = r.z1 - r.z0;
  lots.push({ x: r.x0 + 2, z: r.z0 + 2, w: w - 4, d: 46, kind: 'parking', loc: loc.id });
  lots.push({ x: r.x0 + 2, z: r.z0 + 50, w: w - 4, d: d - 52, kind: 'caliche', loc: loc.id });
  buildings.push({ x: r.x0 + 20, z: r.z0 + 60, w: 100, d: 60, h: 10, color: '#5d636b', kind: 'landmark', label: 'Cleburne Expo Center', labelColor: loc.color, loc: loc.id, shop: 'expo', side: 'N', accent: loc.color });
  buildings.push({ x: r.x0 + 140, z: r.z0 + 60, w: 60, d: 28, h: 6, color: '#8a3b2a', kind: 'store', loc: loc.id });
  for (const [fx, fz, fw, fd] of [[r.x0 + 140, r.z0 + 100, 60, 0.3], [r.x0 + 140, r.z0 + 150, 60, 0.3], [r.x0 + 140, r.z0 + 100, 0.3, 50], [r.x0 + 200, r.z0 + 100, 0.3, 50]]) buildings.push({ x: fx, z: fz, w: fw, d: fd, h: 1.4, color: '#e8e2d4', kind: 'fence', loc: loc.id });
  buildings.push({ x: r.x0 + 30, z: r.z0 + 150, w: 22, d: 22, h: 14, color: '#d9822b', kind: 'tank', round: true, loc: loc.id });
  for (let k = 0; k < 3; k++) buildings.push({ x: r.x0 + 64 + k * 22, z: r.z0 + 158, w: 16, d: 14, h: 4, color: ['#c0392b', '#f1f1f1', '#2c6fbb'][k], kind: 'store', loc: loc.id });
}

// ---------------------------------------------------------------- run time
// Land other players on your server own: { landId: { name, land } }, where
// land is a cleaned build (net/builds.js): { owned, plan, design, fence }.
let FOREIGN = {};
export function setForeignLand(m) { FOREIGN = m || {}; }

// Removes what an earlier career put up, then builds this career's houses
// and everyone else's.
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
    const mine = !!s.estate?.land?.[loc.id]?.owned, other = mine ? null : FOREIGN[loc.id];
    const built = mine ? isBuilt(s, loc.id) : !!(other?.land?.plan && other.land.design);
    // the dirt lot shows until a house stands on it
    for (const l of map.lots) if (l.landLot && l.loc === loc.id) { l.w = built ? 0 : l.w0; l.d = built ? 0 : l.d0; }
    // a fenced pasture out back, with a gate on the side nearest the house
    const fl = mine ? s.estate.land[loc.id] : other?.land;
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
    // rentals out back: yours (framing while the crew works) or another player's
    // (they go up after the house so the house's yard doesn't paint over their streets)
    const dv = mine ? devOf(s, loc.id) : other?.land?.dev ? { id: other.land.dev, ready: 0 } : null;
    const devRect = dv ? pasture(loc) : null;
    const dev = () => dv && put(map, devBlock(loc, dv.id, mine && dv.ready > now(s), other?.name, mine ? rentRoll(s, loc.id) : null), all);
    if (!built) { dev(); continue; }
    const r = homesite(loc);
    const out = { buildings: [], lots: [], garages: [], trees: [], props: [], houses: [], R: (a, b) => (a + b) / 2 };
    if (mine) garageBlock(out, loc, r.x0, r.z0, r.x1, r.z1, PROPERTIES[loc.id], houseDesign(s, loc.id));
    else {
      // somebody else's: their house and garage, with their name on the roof
      garageBlock(out, loc, r.x0, r.z0, r.x1, r.z1, builtProperty(loc.id, other.land.plan, other.land.design), other.land.design);
      for (const g of out.garages) { g.roof.label = `${other.name}'s`; g.owner = other.name; g.label = `${other.name}'s place`; }
      for (const hs of out.houses) hs.owner = other.name;
    }
    if (devRect) keep(out.trees, t => !inLot(t.x, t.z, devRect, t.r));
    put(map, out, all);
    dev();
  }
  map.estateAdded = { all };
}

// Puts what a builder made (out) on the map at run time, with colliders, and
// remembers every piece in `all` so applyEstate can take it down again.
function put(map, out, all) {
  for (const p of out.props) {
    map.props.push(p); const e = { type: 'p', o: p };
    map.drawGrid.insert(e, p.x, p.z, p.x + (p.w || 0), p.z + (p.d || 0)); all.push(p, e);
  }
  for (const hs of out.houses) {
    map.houses.push(hs); all.push(hs);
    for (const pn of hs.panels || (hs.panel ? [hs.panel] : [])) { map.colliders.push(pn); map.grid.insert(pn, pn.x0, pn.z0, pn.x1, pn.z1); all.push(pn); }
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

// A neighborhood or apartment complex on the back of a piece of land
// (core/estate.js lays it out). framing: the crew is still on it, so it's
// slabs and lumber. owner: another player's, and their name goes on the sign.
const HOME_ROOFS = ['#5a4632', '#6b3a2e', '#3f4a5a', '#7a4b3a', '#4a4a4a', '#2f343d', '#6a5a4c'];
const APT_ROOFS = ['#8a5a4a', '#9a7a62', '#7a7e83', '#a0805e'];
const CAR_COLORS = ['#c0392b', '#f1f1f1', '#2c3e50', '#7f8c8d', '#1f4e8a', '#111111', '#b8b8b8', '#8a6a3a'];
// roll: yours (rentRoll), so the tenants' cars match how full it is
export function devBlock(loc, devId, framing = false, owner = null, roll = null) {
  const D = DEV_BY_ID[devId], lay = devLayout(loc, devId);
  const out = { buildings: [], lots: lay.lots.map(l => ({ ...l, loc: loc.id })), garages: [], trees: [], props: [], houses: [] };
  const sign = owner ? `${owner}'s ${D.short}` : `${LAND[loc.id]?.short || ''} ${D.short}`.trim();
  lay.slots.forEach((r, k) => {
    if (D.pool && k === 0) {
      // the leasing office and the pool by the gate
      const wide = r.w >= r.d, ow = wide ? 14 : r.w, od = wide ? r.d : 14;
      out.buildings.push({ x: r.x, z: r.z, w: ow, d: od, h: framing ? 1 : 4, color: framing ? '#c8b08a' : '#d7d2c4', kind: framing ? 'frame' : 'store', loc: loc.id, label: framing ? null : sign, labelColor: '#ffd84a' });
      if (!framing) out.props.push(wide ? { k: 'pool', x: r.x + ow + 3, z: r.z + 2, w: r.w - ow - 5, d: r.d - 4 } : { k: 'pool', x: r.x + 2, z: r.z + od + 3, w: r.w - 4, d: r.d - od - 5 });
      return;
    }
    const pal = D.kind === 'apts' ? APT_ROOFS : HOME_ROOFS;
    out.buildings.push({ ...r, h: framing ? 1 : D.h, color: framing ? '#c8b08a' : pal[(k * 5 + loc.id.length) % pal.length], kind: framing ? 'frame' : D.kind === 'apts' ? 'midrise' : 'house', loc: loc.id, devUnit: true,
      label: !framing && !D.pool && k === 0 ? sign : null, labelColor: '#ffd84a' });
  });
  // tenants' cars
  if (!framing) {
    const full = roll ? (roll.units ? roll.leased / roll.units : 0) : 0.8;
    const n = Math.round(lay.spots.length * full * (D.kind === 'apts' ? 0.7 : 1));
    lay.spots.slice(0, n).forEach((p, k) => {
      const len = 4.4, wid = 1.9, c = CAR_COLORS[(k * 3 + loc.id.length) % CAR_COLORS.length];
      out.buildings.push(p.along === 'x' ? { x: p.x - len / 2, z: p.z - wid / 2, w: len, d: wid, h: 1.5, color: c, kind: 'parked', loc: loc.id } : { x: p.x - wid / 2, z: p.z - len / 2, w: wid, d: len, h: 1.5, color: c, kind: 'parked', loc: loc.id });
    });
  }
  return out;
}
