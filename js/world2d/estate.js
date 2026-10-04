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
import { ESTATE_LOCATIONS } from '../data/estate.js';
import { PROPERTIES } from '../data/world.js';
import { registerBuilds, isBuilt } from '../core/estate.js';

const overlaps = (o, r, pad = 0) => o.x < r.x1 + pad && o.x + (o.w || 0) > r.x0 - pad && o.z < r.z1 + pad && o.z + (o.d || 0) > r.z0 - pad;
const inLot = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
const keep = (arr, fn) => { let j = 0; for (let i = 0; i < arr.length; i++) if (fn(arr[i])) arr[j++] = arr[i]; arr.length = j; };

// ---------------------------------------------------------------- map time
export function addEstate(out) {
  const { buildings, lots, trees, props } = out;
  for (const loc of ESTATE_LOCATIONS) {
    const r = loc.lot, w = r.x1 - r.x0, d = r.z1 - r.z0;
    // make room: the filler houses, yards and trees on this lot go
    keep(buildings, b => b.loc || b.noCollide || !overlaps(b, r, 1));
    keep(lots, l => l.kind === 'lane' || l.loc || !overlaps(l, r, -1));
    keep(trees, t => !inLot(t.x, t.z, r, t.r));
    if (props) keep(props, p => !inLot(p.x, p.z, r, 1));
    if (loc.type === 'trap') garageBlock(out, loc, r.x0, r.z0, r.x1, r.z1, PROPERTIES[loc.id]);
    else if (loc.type === 'land') {
      const dirt = { x: r.x0, z: r.z0, w, d, kind: 'dirt', loc: loc.id, landLot: true };
      dirt.w0 = w; dirt.d0 = d;
      lots.push(dirt);
    } else if (loc.type === 'plug') {
      // corner store: the building at the back of the lot, a strip of parking in front
      lots.push({ x: r.x0 + 2, z: r.z0 + 1, w: w - 4, d: 14, kind: 'parking', loc: loc.id });
      buildings.push({ x: r.x0 + 8, z: r.z0 + 17, w: w - 16, d: d - 22, h: 5, color: '#5a4a3a', kind: 'landmark', label: "Lil Tre's", labelColor: loc.color, loc: loc.id, shop: 'plug', side: loc.side, accent: loc.color });
    }
  }
}

// ---------------------------------------------------------------- run time
// Removes what an earlier career put up, then builds this career's houses.
export function applyEstate(map, s) {
  registerBuilds(s);
  const old = map.estateAdded;
  if (old) {
    const dead = new Set(old.all);
    keep(map.buildings, b => !dead.has(b)); keep(map.lots, l => !dead.has(l)); keep(map.trees, t => !dead.has(t));
    keep(map.colliders, c => !dead.has(c)); keep(map.garages, g => !dead.has(g));
    for (const grid of [map.grid, map.drawGrid]) for (const arr of grid.map.values()) keep(arr, e => !dead.has(e) && !dead.has(e.o));
  }
  const all = [];
  for (const loc of ESTATE_LOCATIONS) {
    if (loc.type !== 'land') continue;
    const built = isBuilt(s, loc.id);
    // the dirt lot shows until a house stands on it
    for (const l of map.lots) if (l.landLot && l.loc === loc.id) { l.w = built ? 0 : l.w0; l.d = built ? 0 : l.d0; }
    if (!built) continue;
    const r = loc.lot;
    const out = { buildings: [], lots: [], garages: [], trees: [], R: (a, b) => (a + b) / 2 };
    garageBlock(out, loc, r.x0, r.z0, r.x1, r.z1, PROPERTIES[loc.id]);
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
