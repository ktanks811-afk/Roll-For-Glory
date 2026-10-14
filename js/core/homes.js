// House designs: rooms painted on a tile grid, up to five floors, furniture
// on top and walls you draw yourself along the tile edges. Works out what a
// design costs, how many stories it is, how comfortable it is to come home
// to, and what's wrong with it (an upper floor hanging over nothing, no
// stairs to get up there). A staircase opens the floor above it: you can't
// build up until there's a way up. DOM-free so
// check-data can test it; ui/builder.js is the screen, world2d/house.js
// puts the finished house on the map.

import { GW, GD, MAX_FLOORS, FLOOR_NAMES, ROOM_BY_ID, FURN_BY_ID, WALL_BY_ID, PRESETS } from '../data/homes.js';

const EMPTY = '.'.repeat(GW * GD);
export const idx = (x, y) => y * GW + x;
export const inGrid = (x, y) => x >= 0 && y >= 0 && x < GW && y < GD;

export function cloneDesign(d) {
  return { v: 1, name: d.name || '', wall: d.wall, roof: d.roof, roofStyle: d.roofStyle || 'shingle',
    floors: [...d.floors], furn: d.furn.map(f => f.map(x => ({ ...x }))), walls: d.floors.map((_, k) => (d.walls?.[k] || []).map(w => ({ ...w }))) };
}
export function fromPreset(id) {
  const p = PRESETS[id] || PRESETS.starter;
  const d = cloneDesign({ ...p, furn: p.furn || [] });
  while (d.furn.length < d.floors.length) d.furn.push([]);
  return d;
}
export function blankDesign() { return { v: 1, name: '', wall: '#d9c9a8', roof: '#3a3330', roofStyle: 'shingle', floors: [EMPTY], furn: [[]], walls: [[]] }; }
const grow = (d, fl) => { while (d.floors.length <= fl) d.floors.push(EMPTY); while (d.furn.length < d.floors.length) d.furn.push([]); d.walls ??= []; while (d.walls.length < d.floors.length) d.walls.push([]); };

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
  if (code !== '.' && !floorOpen(d, fl)) return 0;
  grow(d, fl);
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
    if (!F.stairs && !F.flat && fl > 0 && stairwell(d, fl).has(idx(x, y))) return 'That\'s where the stairs come up.';
    const other = (d.furn[fl] || []).find(o => o !== ignore && furnTiles(o).some(([a, b]) => a === x && b === y));
    if (other && !(F.flat || FURN_BY_ID[other.id].flat)) return `The ${FURN_BY_ID[other.id].name.toLowerCase()} is in the way.`;
  }
  return null;
}
export function place(d, fl, id, x, y, r = 0) {
  grow(d, fl);
  const f = { id, x, y, r };
  const why = canPlace(d, fl, f);
  if (why) return { ok: false, text: why };
  d.furn[fl].push(f);
  // a staircase opens the floor above: the landing at the top goes in with it
  const opened = FURN_BY_ID[id].stairs ? landing(d, fl) : 0;
  return { ok: true, f, opened: FURN_BY_ID[id].stairs ? fl + 1 : null, landing: opened };
}

// ---------------------------------------------------------------- stairs
export const hasStairs = (d, fl) => (d.furn[fl] || []).some(f => FURN_BY_ID[f.id]?.stairs);
// You can build on a floor once there's a staircase up to it.
export const floorOpen = (d, fl) => fl === 0 || (fl < MAX_FLOORS && roomTiles(d, fl - 1) > 0 && hasStairs(d, fl - 1));
// Tiles on floor fl where a staircase from the floor below comes up.
export function stairwell(d, fl) {
  const out = new Set();
  if (fl < 1) return out;
  for (const f of d.furn[fl - 1] || []) if (FURN_BY_ID[f.id]?.stairs) for (const [x, y] of furnTiles(f)) out.add(idx(x, y));
  return out;
}
// Paints a hallway landing on the floor above the stairs on floor fl, where
// there's nothing yet. Returns how many tiles it painted.
export function landing(d, fl) {
  if (fl + 1 >= MAX_FLOORS) return 0;
  grow(d, fl + 1);
  const a = [...d.floors[fl + 1]];
  let n = 0;
  for (const i of stairwell(d, fl + 1)) if (a[i] === '.' && isRoom(d.floors[fl][i])) { a[i] = 'H'; n++; }
  d.floors[fl + 1] = a.join('');
  return n;
}

// ---------------------------------------------------------------- walls you draw
// An edge is { o: 'h' | 'v', x, y }: 'h' runs along the top of tile (x, y)
// (between rows y-1 and y), 'v' down its left side (between columns x-1 and
// x). d.walls[fl] lists the ones you've drawn: { o, x, y, k } with k a kind
// from WALLS.
export const edgeTiles = (o, x, y) => (o === 'h' ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]]);
export const edgeOk = (o, x, y) => (o === 'h' ? x >= 0 && x < GW && y >= 0 && y <= GD : x >= 0 && x <= GW && y >= 0 && y < GD);
export function wallAt(d, fl, o, x, y) { return (d.walls?.[fl] || []).find(w => w.o === o && w.x === x && w.y === y)?.k || null; }
// What's on an edge: 'outer' (a room on one side only), 'inner' (rooms both
// sides), 'open' (porch or nothing on one side, floor on the other) or null.
export function edgeType(d, fl, o, x, y) {
  const [[ax, ay], [bx, by]] = edgeTiles(o, x, y), a = tileAt(d, fl, ax, ay), b = tileAt(d, fl, bx, by);
  if (isRoom(a) && isRoom(b)) return 'inner';
  if (isRoom(a) || isRoom(b)) return 'outer';
  if (isFloor(a) || isFloor(b)) return 'open';
  return null;
}
// Draws a straight line of wall from grid corner (cx0, cy0) toward (cx1, cy1)
// (it snaps to whichever way you dragged more). kind '.' takes walls out.
// Only goes where there's floor on at least one side. Returns edges changed.
export function drawWall(d, fl, cx0, cy0, cx1, cy1, kind) {
  if (!floorOpen(d, fl) && kind !== '.') return 0;
  grow(d, fl);
  const list = d.walls[fl];
  const horiz = Math.abs(cx1 - cx0) >= Math.abs(cy1 - cy0);
  const edges = [];
  if (horiz) { const y = cy0; for (let x = Math.min(cx0, cx1); x < Math.max(cx0, cx1); x++) edges.push(['h', x, y]); }
  else { const x = cx0; for (let y = Math.min(cy0, cy1); y < Math.max(cy0, cy1); y++) edges.push(['v', x, y]); }
  let n = 0;
  for (const [o, x, y] of edges) {
    if (!edgeOk(o, x, y)) continue;
    const i = list.findIndex(w => w.o === o && w.x === x && w.y === y);
    if (kind === '.') { if (i >= 0) { list.splice(i, 1); n++; } continue; }
    if (!WALL_BY_ID[kind] || !edgeType(d, fl, o, x, y)) continue;
    if (i >= 0) { if (list[i].k !== kind) { list[i].k = kind; n++; } }
    else { list.push({ o, x, y, k: kind }); n++; }
  }
  return n;
}
export const allWalls = d => (d.walls || []).flat();
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
  d.walls ??= [];
  for (let fl = 1; fl < d.floors.length; fl++) {
    const a = [...d.floors[fl]];
    for (let y = 0; y < GD; y++) for (let x = 0; x < GW; x++) if (isFloor(a[idx(x, y)]) && (!isRoom(tileAt(d, fl - 1, x, y)) || a[idx(x, y)] === 'P')) a[idx(x, y)] = '.';
    d.floors[fl] = a.join('');
  }
  for (let fl = 0; fl < d.floors.length; fl++) d.furn[fl] = (d.furn[fl] || []).filter(f => !canPlace(d, fl, f, f));
  while (d.floors.length > 1 && !d.floors[d.floors.length - 1].replace(/\./g, '')) { d.floors.pop(); d.furn.pop(); }
  while (d.furn.length < d.floors.length) d.furn.push([]);
  while (d.walls.length < d.floors.length) d.walls.push([]);
  d.walls.length = d.floors.length;
  // walls only stand where there's floor beside them
  for (let fl = 0; fl < d.floors.length; fl++) d.walls[fl] = (d.walls[fl] || []).filter(w => edgeOk(w.o, w.x, w.y) && WALL_BY_ID[w.k] && edgeType(d, fl, w.o, w.x, w.y));
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
  for (const w of allWalls(d)) n += WALL_BY_ID[w.k]?.price || 0;
  return n;
}

// 0..100: furniture, space, and the basics (a bed, a toilet, a kitchen).
export function comfort(d) {
  const furn = allFurn(d).map(f => FURN_BY_ID[f.id]);
  let pts = furn.reduce((t, F) => t + (F?.comfort || 0), 0);
  let rooms = 0; for (let fl = 0; fl < d.floors.length; fl++) rooms += roomTiles(d, fl);
  pts += Math.min(30, rooms / 6);
  pts += Math.min(10, allWalls(d).reduce((t, w) => t + (WALL_BY_ID[w.k]?.light || 0), 0) / 2);   // daylight
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
    if (!hasStairs(d, fl - 1)) errors.push(`Put a staircase on the ${FLOOR_NAMES[fl - 1].toLowerCase()} so you can get up to the ${FLOOR_NAMES[fl].toLowerCase()}.`);
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
  const out = { v: 1, name: String(d.name || ''), wall: d.wall || '#d9c9a8', roof: d.roof || '#3a3330', roofStyle: d.roofStyle || 'shingle', floors: [], furn: [], walls: [] };
  for (let fl = 0; fl < Math.min(MAX_FLOORS, d.floors.length); fl++) {
    const s = String(d.floors[fl] || '').slice(0, GW * GD).padEnd(GW * GD, '.');
    out.floors.push([...s].map(c => (ROOM_BY_ID[c] ? c : '.')).join(''));
    out.furn.push((Array.isArray(d.furn?.[fl]) ? d.furn[fl] : []).filter(f => FURN_BY_ID[f?.id]).map(f => ({ id: f.id, x: f.x | 0, y: f.y | 0, r: (f.r | 0) % 4 })));
    const seen = new Set();
    out.walls.push((Array.isArray(d.walls?.[fl]) ? d.walls[fl] : []).slice(0, 600).filter(w => w && (w.o === 'h' || w.o === 'v') && WALL_BY_ID[w.k])
      .map(w => ({ o: w.o, x: w.x | 0, y: w.y | 0, k: w.k })).filter(w => { const key = w.o + w.x + ',' + w.y; if (seen.has(key)) return false; seen.add(key); return true; }));
  }
  return tidy(out);
}
