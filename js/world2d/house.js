// A house on the map, built from a design (core/homes.js): the rooms on the
// ground floor with their furniture, solid outside walls with a front door,
// and the house itself (one, two or three stories, leaning like every other
// building) drawn over the top. Walk in and the house fades away so you can
// see the rooms, the way the garage roof does. DOM-free.
//
// Tiles map onto the lot through the garage's frame: u runs along the
// street, v runs from the street into the lot. Row 0 of the design is the
// row nearest the street.

import { TILE, GW, GD, FLOOR_H, ROOM_BY_ID, FURN_BY_ID } from '../data/homes.js';
import { idx, tileAt, isRoom, heights, footprint } from '../core/homes.js';

const WALL_T = 0.3;
// What the inside looks like: [x, z] of a local (u, v) point.
const toWorld = (F, u, v) => F.pt(u, v);

// Rectangles of equal height covering the tiles where h > 0 (greedy).
function pieces(h) {
  const used = new Uint8Array(GW * GD), out = [];
  for (let y = 0; y < GD; y++) for (let x = 0; x < GW; x++) {
    const v = h[idx(x, y)];
    if (!v || used[idx(x, y)]) continue;
    let w = 1;
    while (x + w < GW && h[idx(x + w, y)] === v && !used[idx(x + w, y)]) w++;
    let d = 1;
    grow: while (y + d < GD) { for (let k = 0; k < w; k++) if (h[idx(x + k, y + d)] !== v || used[idx(x + k, y + d)]) break grow; d++; }
    for (let a = 0; a < w; a++) for (let b = 0; b < d; b++) used[idx(x + a, y + b)] = 1;
    out.push({ x, y, w, d, f: v });
  }
  return out;
}

// The front door: the ground-floor room edge facing the street nearest the
// middle of the house. [x, y, side] where side is the tile edge ('n' = the
// street side of tile x, y).
function frontDoor(d) {
  const cand = [];
  for (let y = 0; y < GD; y++) for (let x = 0; x < GW; x++) {
    if (!isRoom(tileAt(d, 0, x, y))) continue;
    if (!isRoom(tileAt(d, 0, x, y - 1))) cand.push([x, y, 'n']);
  }
  if (!cand.length) return null;
  const xs = cand.map(c => c[0]), mid = (Math.min(...xs) + Math.max(...xs)) / 2;
  cand.sort((a, b) => (a[1] - b[1]) * 4 + Math.abs(a[0] - mid) - Math.abs(b[0] - mid));
  return cand[0];
}

// Builds the house on `out` (buildings, lots, props, houses). Returns the
// house record, with its bounding box.
export function houseBlock(out, loc, design, F, u0, v0, opts = {}) {
  const { buildings, lots, props, houses } = out;
  const T = TILE;
  const tileRect = (x, y, w = 1, d = 1) => F.rect(u0 + x * T, u0 + (x + w) * T, v0 + y * T, v0 + (y + d) * T);
  const h = heights(design);
  const wall = opts.wall || design.wall, roof = opts.roof || design.roof;
  const all = [];
  const addB = b => { buildings.push(b); all.push(b); return b; };
  const addL = l => { lots.push(l); all.push(l); return l; };

  // floors: runs of the same room along each row
  for (let y = 0; y < GD; y++) {
    for (let x = 0; x < GW;) {
      const c = tileAt(design, 0, x, y);
      if (c === '.') { x++; continue; }
      let w = 1; while (x + w < GW && tileAt(design, 0, x + w, y) === c) w++;
      addL({ ...tileRect(x, y, w, 1), kind: c === 'P' ? 'deck' : 'room', c: ROOM_BY_ID[c].c, loc: loc.id, room: c });
      x += w;
    }
  }
  // inside walls: between two different rooms, with a doorway in each run
  const iwall = (x0, y0, x1, y1) => {
    const r = F.rect(u0 + x0 * T - 0.09, u0 + x1 * T + 0.09, v0 + y0 * T - 0.09, v0 + y1 * T + 0.09);
    addL({ ...r, kind: 'iwall', loc: loc.id });
  };
  const runs = (getPair, len, other, place) => {
    for (let line = 1; line < other; line++) {
      let start = -1, key = null;
      for (let k = 0; k <= len; k++) {
        const pr = k < len ? getPair(line, k) : null;
        const kk = pr ? pr.join('') : null;
        if (kk !== key) {
          if (key && start >= 0) {
            const n = k - start, door = start + Math.floor((n - 1) / 2);
            if (door > start) place(line, start, door);
            if (door + 1 < k) place(line, door + 1, k);
          }
          start = k; key = kk;
        }
      }
    }
  };
  const pairAt = (a, b) => (isRoom(a) && isRoom(b) && a !== b ? [a, b].sort() : null);
  runs((y, x) => pairAt(tileAt(design, 0, x, y - 1), tileAt(design, 0, x, y)), GW, GD, (y, a, b) => iwall(a, y, b, y));
  runs((x, y) => pairAt(tileAt(design, 0, x - 1, y), tileAt(design, 0, x, y)), GD, GW, (x, a, b) => iwall(x, a, x, b));

  // furniture on the ground floor
  for (const f of design.furn[0] || []) {
    const Fd = FURN_BY_ID[f.id], fp = footprint(f);
    const r = tileRect(f.x, f.y, fp.w, fp.d);
    // which way it faces: r = 0 faces the street
    const dir = [[0, -1], [1, 0], [0, 1], [-1, 0]][f.r || 0];
    const fx = F.U.x * dir[0] + F.V.x * dir[1], fz = F.U.z * dir[0] + F.V.z * dir[1];
    const p = { ...r, k: 'furn', id: f.id, c: Fd.c, accent: Fd.accent, fx, fz, loc: loc.id };
    props.push(p); all.push(p);
  }

  // outside walls: every ground-floor room edge with no room on the other side
  const door = frontDoor(design);
  const wallH = (x, y) => Math.max(1, h[idx(x, y)]) * FLOOR_H;
  const edgeWall = (x0, y0, x1, y1, hh) => {
    const r = x0 === x1
      ? F.rect(u0 + x0 * T - WALL_T / 2, u0 + x0 * T + WALL_T / 2, v0 + y0 * T - WALL_T / 2, v0 + y1 * T + WALL_T / 2)
      : F.rect(u0 + x0 * T - WALL_T / 2, u0 + x1 * T + WALL_T / 2, v0 + y0 * T - WALL_T / 2, v0 + y0 * T + WALL_T / 2);
    addB({ ...r, h: hh, color: wall, kind: 'hwall', loc: loc.id });
  };
  // horizontal edges (between rows y-1 and y)
  for (let y = 0; y <= GD; y++) {
    let start = -1, hh = 0;
    for (let x = 0; x <= GW; x++) {
      const a = isRoom(tileAt(design, 0, x, y - 1)), b = isRoom(tileAt(design, 0, x, y));
      const on = x < GW && a !== b && !(door && door[2] === 'n' && door[0] === x && door[1] === y);
      const hx = on ? wallH(x, a ? y - 1 : y) : 0;
      if (start >= 0 && (!on || hx !== hh)) { edgeWall(start, y, x, y, hh); start = -1; }
      if (on && start < 0) { start = x; hh = hx; }
    }
  }
  for (let x = 0; x <= GW; x++) {
    let start = -1, hh = 0;
    for (let y = 0; y <= GD; y++) {
      const a = isRoom(tileAt(design, 0, x - 1, y)), b = isRoom(tileAt(design, 0, x, y));
      const on = y < GD && a !== b;
      const hy = on ? wallH(a ? x - 1 : x, y) : 0;
      if (start >= 0 && (!on || hy !== hh)) { edgeWall(x, start, x, y, hh); start = -1; }
      if (on && start < 0) { start = y; hh = hy; }
    }
  }

  // the house you see from outside: one block per run of equal height
  const ps = pieces(h).map(p => ({ ...tileRect(p.x, p.y, p.w, p.d), h: p.f * FLOOR_H + 0.4, floors: p.f }));
  let box = null;
  if (ps.length) {
    const x0 = Math.min(...ps.map(p => p.x)), z0 = Math.min(...ps.map(p => p.z));
    const x1 = Math.max(...ps.map(p => p.x + p.w)), z1 = Math.max(...ps.map(p => p.z + p.d));
    box = { x: x0, z: z0, w: x1 - x0, d: z1 - z0 };
    addB({ ...box, h: Math.max(...ps.map(p => p.h)), kind: 'home', noCollide: true, a: 1, pieces: ps, color: roof, wall, style: design.roofStyle || 'shingle',
      loc: loc.id, side: loc.side, label: opts.label || '' });
  }
  // the front door: shut on houses you don't own
  let panel = null, doorAt = null;
  if (door) {
    const r = F.rect(u0 + door[0] * T, u0 + (door[0] + 1) * T, v0 + door[1] * T - WALL_T / 2, v0 + door[1] * T + WALL_T / 2);
    panel = { x0: r.x, z0: r.z, x1: r.x + r.w, z1: r.z + r.d, h: 3, off: false, door: loc.id, house: true };
    doorAt = toWorld(F, u0 + (door[0] + 0.5) * T, v0 + door[1] * T - 2);
  }
  // porch / deck counts toward the footprint for the box, so trees stay off it
  for (let y = 0; y < GD; y++) for (let x = 0; x < GW; x++) if (tileAt(design, 0, x, y) === 'P') {
    const r = tileRect(x, y);
    box = box ? { x: Math.min(box.x, r.x), z: Math.min(box.z, r.z), w: Math.max(box.x + box.w, r.x + r.w) - Math.min(box.x, r.x), d: Math.max(box.z + box.d, r.z + r.d) - Math.min(box.z, r.z) } : { ...r };
  }
  const home = { id: loc.id, loc, F, u0, v0, floor0: design.floors[0], stories: Math.max(0, ...h), panel, door: doorAt, mass: all.find(b => b.kind === 'home') || null, box, all };
  if (houses) houses.push(home);
  return home;
}

// Is (x, z) inside this house's ground floor rooms?
export function inHouse(home, x, z) {
  const dx = x - home.F.O.x, dz = z - home.F.O.z;
  const u = dx * home.F.U.x + dz * home.F.U.z, v = dx * home.F.V.x + dz * home.F.V.z;
  const tx = Math.floor((u - home.u0) / TILE), ty = Math.floor((v - home.v0) / TILE);
  if (tx < 0 || ty < 0 || tx >= GW || ty >= GD) return false;
  return isRoom(home.floor0[idx(tx, ty)]);
}
