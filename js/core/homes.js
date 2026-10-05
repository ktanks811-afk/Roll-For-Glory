// House designs: rooms painted on a tile grid, up to three floors, and
// furniture on top. Works out what a design costs, how many stories it is,
// how comfortable it is to come home to, and what's wrong with it (an upper
// floor hanging over nothing, no stairs to get up there). DOM-free so
// check-data can test it; ui/builder.js is the screen, world2d/house.js
// puts the finished house on the map.

import { GW, GD, MAX_FLOORS, ROOM_BY_ID, FURN_BY_ID, PRESETS } from '../data/homes.js';

const EMPTY = '.'.repeat(GW * GD);
export const idx = (x, y) => y * GW + x;
export const inGrid = (x, y) => x >= 0 && y >= 0 && x < GW && y < GD;

export function cloneDesign(d) {
  return { v: 1, name: d.name || '', wall: d.wall, roof: d.roof, roofStyle: d.roofStyle || 'shingle',
    floors: [...d.floors], furn: d.furn.map(f => f.map(x => ({ ...x }))) };
}
export function fromPreset(id) {
  const p = PRESETS[id] || PRESETS.starter;
  const d = cloneDesign({ ...p, furn: p.furn || [] });
  while (d.furn.length < d.floors.length) d.furn.push([]);
  return d;
}
export function blankDesign() { return { v: 1, name: '', wall: '#d9c9a8', roof: '#3a3330', roofStyle: 'shingle', floors: [EMPTY], furn: [[]] }; }

export const tileAt = (d, f, x, y) => (inGrid(x, y) && d.floors[f]?.[idx(x, y)]) || '.';
export const isRoom = c => c !== '.' && c !== 'P';                  // walls and a roof go round these
export const isFloor = c => c !== '.';

// Furniture footprint in tiles, after turning it.
export function footprint(f) {
  const F = FURN_BY_ID[f.id];
  const odd = (f.r || 0) % 2 === 1;
  return { w: odd ? F.d : F.w, d: odd ? F.w : F.d };
}
export function furnTiles(f) {
  const { w, d } = footprint(f), out = [];
  for (let a = 0; a < w; a++) for (let b = 0; b < d; b++) out.push([f.x + a, f.y + b]);
  return out;
}
export function furnAt(d, fl, x, y) {
  return (d.furn[fl] || []).find(f => furnTiles(f).some(([a, b]) => a === x && b === y)) || null;
}

// ---------------------------------------------------------------- editing
// Paints the rectangle (x0,y0)-(x1,y1) on floor fl with room type `code`
// ('.' erases). Upper floors only paint over rooms below; the porch only
// goes on the ground floor. Furniture left on erased or wrong tiles goes.
export function paint(d, fl, x0, y0, x1, y1, code) {
  if (fl >= MAX_FLOORS) return 0;
  while (d.floors.length <= fl) { d.floors.push(EMPTY); d.furn.push([]); }
  const a = [...d.floors[fl]];
  let n = 0;
  for (let y = Math.max(0, Math.min(y0, y1)); y <= Math.min(GD - 1, Math.max(y0, y1)); y++)
    for (let x = Math.max(0, Math.min(x0, x1)); x <= Math.min(GW - 1, Math.max(x0, x1)); x++) {
      if (code !== '.' && fl > 0 && (code === 'P' || !isRoom(tileAt(d, fl - 1, x, y)))) continue;
      if (a[idx(x, y)] !== code) { a[idx(x, y)] = code; n++; }
    }
  d.floors[fl] = a.join('');
  tidy(d);
  return n;
}

// Furniture has to sit on the right kind of floor, inside the grid, not on
// top of other furniture.
export function canPlace(d, fl, f, ignore = null) {
  const F = FURN_BY_ID[f.id];
  if (!F) return 'No such thing.';
  for (const [x, y] of furnTiles(f)) {
    if (!inGrid(x, y)) return 'It doesn\'t fit there.';
    const c = tileAt(d, fl, x, y);
    if (!isFloor(c)) return 'Paint a room there first.';
    if (F.room && c !== F.room) return `That goes in the ${ROOM_BY_ID[F.room].name.toLowerCase()}.`;
    if (!F.room && c === 'P' && !F.flat) return 'That stays inside.';
    if (F.stairs && fl >= MAX_FLOORS - 1) return 'There\'s no floor above this one.';
    const other = (d.furn[fl] || []).find(o => o !== ignore && furnTiles(o).some(([a, b]) => a === x && b === y));
    if (other && !(F.flat || FURN_BY_ID[other.id].flat)) return `The ${FURN_BY_ID[other.id].name.toLowerCase()} is in the way.`;
  }
  return null;
}
export function place(d, fl, id, x, y, r = 0) {
  while (d.furn.length <= fl) d.furn.push([]);
  const f = { id, x, y, r };
  const why = canPlace(d, fl, f);
  if (why) return { ok: false, text: why };
  d.furn[fl].push(f);
  return { ok: true, f };
}
export function remove(d, fl, f) { d.furn[fl] = (d.furn[fl] || []).filter(o => o !== f); }
// Turn a piece a quarter; if it no longer fits, try nudging it back inside.
export function rotate(d, fl, f) {
  const old = { ...f };
  f.r = ((f.r || 0) + 1) % 4;
  for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    f.x = old.x + dx; f.y = old.y + dy;
    if (!canPlace(d, fl, f, f)) return true;
  }
  Object.assign(f, old);
  return false;
}

// Drops furniture that no longer has floor under it and upper-floor tiles
// that lost the room under them, and trims empty top floors.
export function tidy(d) {
  for (let fl = 1; fl < d.floors.length; fl++) {
    const a = [...d.floors[fl]];
    for (let y = 0; y < GD; y++) for (let x = 0; x < GW; x++) if (isFloor(a[idx(x, y)]) && (!isRoom(tileAt(d, fl - 1, x, y)) || a[idx(x, y)] === 'P')) a[idx(x, y)] = '.';
    d.floors[fl] = a.join('');
  }
  for (let fl = 0; fl < d.floors.length; fl++) d.furn[fl] = (d.furn[fl] || []).filter(f => !canPlace(d, fl, f, f));
  while (d.floors.length > 1 && !d.floors[d.floors.length - 1].replace(/\./g, '')) { d.floors.pop(); d.furn.pop(); }
  while (d.furn.length < d.floors.length) d.furn.push([]);
  return d;
}

// ---------------------------------------------------------------- what it is
export const roomTiles = (d, fl) => [...(d.floors[fl] || '')].filter(isRoom).length;
export const stories = d => d.floors.filter(f => [...f].some(isRoom)).length;
export const allFurn = d => d.furn.flat();

export function cost(d) {
  let n = 0;
  for (const f of d.floors) for (const c of f) if (c !== '.') n += ROOM_BY_ID[c]?.price || 0;
  for (const f of allFurn(d)) n += FURN_BY_ID[f.id]?.price || 0;
  return n;
}

// 0..100: furniture, space, and the basics (a bed, a toilet, a kitchen).
export function comfort(d) {
  const furn = allFurn(d).map(f => FURN_BY_ID[f.id]);
  let pts = furn.reduce((t, F) => t + (F?.comfort || 0), 0);
  let rooms = 0; for (let fl = 0; fl < d.floors.length; fl++) rooms += roomTiles(d, fl);
  pts += Math.min(30, rooms / 6);
  if (!furn.some(F => F?.bed)) pts *= 0.4;
  if (!furn.some(F => F?.toilet)) pts *= 0.6;
  return Math.max(0, Math.min(100, Math.round(pts * 0.8)));
}

export function counts(d) {
  const furn = allFurn(d).map(f => FURN_BY_ID[f.id]);
  return { beds: furn.filter(F => F?.bed).length, baths: furn.filter(F => F?.toilet).length, kitchen: furn.some(F => F?.cook) && furn.some(F => F?.fridge) };
}

// Problems that stop the crew from building it (errors), and things you'll
// probably want to fix (warnings).
export function check(d) {
  const errors = [], warnings = [];
  if (roomTiles(d, 0) < 4) errors.push('Paint at least a few rooms on the ground floor.');
  for (let fl = 1; fl < d.floors.length; fl++) {
    if (!roomTiles(d, fl)) continue;
    if (!(d.furn[fl - 1] || []).some(f => FURN_BY_ID[f.id].stairs)) errors.push(`Put a staircase on the ${fl === 1 ? 'ground' : '2nd'} floor so you can get up to the ${fl === 1 ? '2nd' : '3rd'}.`);
  }
  const c = counts(d);
  if (!c.beds) warnings.push('No bed. You won\'t sleep well here.');
  if (!c.baths) warnings.push('No toilet.');
  if (!c.kitchen) warnings.push('No kitchen (a stove and a fridge).');
  return { errors, warnings, ok: !errors.length };
}

export function summary(d) {
  const st = stories(d), c = counts(d);
  return `${st}-story · ${c.beds} bed${c.beds === 1 ? '' : 's'} · ${c.baths} bath${c.baths === 1 ? '' : 's'}`;
}

// The ground-floor footprint and the tallest floor over each tile, for the map.
export function heights(d) {
  const h = new Uint8Array(GW * GD);
  for (let fl = 0; fl < d.floors.length; fl++) for (let i = 0; i < GW * GD; i++) if (isRoom(d.floors[fl][i])) h[i] = fl + 1;
  return h;
}

// Old saves and bad data: make it a valid design or null.
export function sanitize(d) {
  if (!d || !Array.isArray(d.floors) || !d.floors.length) return null;
  const out = { v: 1, name: String(d.name || ''), wall: d.wall || '#d9c9a8', roof: d.roof || '#3a3330', roofStyle: d.roofStyle || 'shingle', floors: [], furn: [] };
  for (let fl = 0; fl < Math.min(MAX_FLOORS, d.floors.length); fl++) {
    const s = String(d.floors[fl] || '').slice(0, GW * GD).padEnd(GW * GD, '.');
    out.floors.push([...s].map(c => (ROOM_BY_ID[c] ? c : '.')).join(''));
    out.furn.push((d.furn?.[fl] || []).filter(f => FURN_BY_ID[f?.id]).map(f => ({ id: f.id, x: f.x | 0, y: f.y | 0, r: (f.r | 0) % 4 })));
  }
  return tidy(out);
}
