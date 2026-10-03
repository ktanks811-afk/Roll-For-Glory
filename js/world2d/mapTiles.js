// Map tiles for the minimap and the phone's Map app: 400 m squares drawn
// straight from the city's real roads, buildings, lots and water, built on
// demand and kept in a small cache. Sharp at any zoom, no giant pre-rendered
// picture needed.

import { DESERT_Z } from '../data/world.js';
import { BACKROAD } from './map.js';

export const TILE = 400;          // metres per tile
export const TS = 1.0;            // tile resolution, pixels per metre
const LOT_COLOR = { park: '#27402a', yard: '#2c3828', parking: '#363840', gas: '#3d3f45', strip: '#4a4b50',
  plaza: '#6a4a3e', trail: '#7a6a4a', lane: '#7d828c', dirt: '#5e5040', field: '#34421f', sand: '#a8956a', pond: '#16405e', court: '#5a3a2a', lot: '#3d3f45', junk: '#45403a' };

export function buildTile(map, i, j) {
  const x0 = i * TILE - 1, z0 = j * TILE - 1, W = TILE + 2;
  const c = document.createElement('canvas'); c.width = c.height = Math.ceil(W * TS);
  const g = c.getContext('2d');
  g.scale(TS, TS); g.translate(-x0, -z0);
  const inside = (x, z, w, d) => x + w >= x0 && x <= x0 + W && z + d >= z0 && z <= z0 + W;
  // ground: grass, then desert, hills and the city grid
  g.fillStyle = '#1b2417'; g.fillRect(x0, z0, W, W);
  g.fillStyle = '#6a5b43'; if (z0 + W > DESERT_Z) g.fillRect(x0, Math.max(z0, DESERT_Z), W, z0 + W - Math.max(z0, DESERT_Z));
  g.fillStyle = '#222b1d'; g.fillRect(-3300, -1000, 2300, DESERT_Z + 1000);
  g.fillStyle = '#2a2c31'; g.fillRect(-985, -985, 1970, 1970);
  for (const w of map.water) if (inside(w.x, w.z, w.w, w.d)) { g.fillStyle = '#12304a'; g.fillRect(w.x, w.z, w.w, w.d); g.strokeStyle = '#1d4b70'; g.lineWidth = 3; g.strokeRect(w.x, w.z, w.w, w.d); }
  const items = map.drawGrid.query(x0, z0, x0 + W, z0 + W);
  for (const it of items) if (it.type === 'l') { const l = it.o; g.fillStyle = LOT_COLOR[l.kind] || '#333'; g.fillRect(l.x, l.z, l.w, l.d); }
  // roads: dark casing first, then the surface
  const edges = [];
  for (const e of map.roads.edges) {
    const minx = Math.min(e.ax, e.bx) - e.width, maxx = Math.max(e.ax, e.bx) + e.width, minz = Math.min(e.az, e.bz) - e.width, maxz = Math.max(e.az, e.bz) + e.width;
    if (maxx < x0 || minx > x0 + W || maxz < z0 || minz > z0 + W) continue;
    edges.push(e);
  }
  const wid = e => Math.max(e.width * (e.kind === 'highway' ? 1.1 : 1.3), 4.5 / TS);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const road = (e, w, color) => { g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(e.ax, e.az); g.lineTo(e.bx, e.bz); g.stroke(); };
  for (const e of edges) road(e, wid(e) + 3 / TS, '#14161a');
  g.strokeStyle = '#14161a'; g.lineWidth = 8; g.beginPath(); BACKROAD.forEach(([x, z], k) => k ? g.lineTo(x, z) : g.moveTo(x, z)); g.stroke();
  for (const e of edges) road(e, wid(e), e.kind === 'highway' ? '#d9ad1f' : e.kind === 'desert' ? '#b79f74' : '#9ca1ac');
  for (const e of edges) if (e.kind === 'highway') { g.setLineDash([14, 14]); road(e, 1.6, 'rgba(255,255,255,.65)'); g.setLineDash([]); }
  g.strokeStyle = '#a8aab0'; g.lineWidth = 5; g.beginPath(); BACKROAD.forEach(([x, z], k) => k ? g.lineTo(x, z) : g.moveTo(x, z)); g.stroke();
  for (const it of items) if (it.type === 'b') {
    const b = it.o;
    if (b.kind === 'parked') continue;
    g.fillStyle = b.kind === 'stands' ? '#5a5f69' : '#4b515d'; g.fillRect(b.x, b.z, b.w, b.d);
    g.strokeStyle = '#2b2f37'; g.lineWidth = 1.4; g.strokeRect(b.x + 0.5, b.z + 0.5, b.w - 1, b.d - 1);
  }
  return c;
}

export class TileCache {
  constructor(max = 56) { this.max = max; this.tiles = new Map(); }
  get size() { return this.tiles.size; }
  has(i, j) { return this.tiles.has(i + ',' + j); }
  get(i, j) {
    const key = i + ',' + j, c = this.tiles.get(key);
    if (c) { this.tiles.delete(key); this.tiles.set(key, c); }   // most recently used goes last
    return c || null;
  }
  // Build the missing tiles in view, nearest first, at most `budget` per call.
  ensure(map, i0, i1, j0, j1, cx, cz, budget = 1) {
    const want = [];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (!this.has(i, j)) want.push([i, j, Math.hypot((i + 0.5) * TILE - cx, (j + 0.5) * TILE - cz)]);
    want.sort((a, b) => a[2] - b[2]);
    for (const [i, j] of want.slice(0, budget)) this.tiles.set(i + ',' + j, buildTile(map, i, j));
    while (this.tiles.size > this.max) this.tiles.delete(this.tiles.keys().next().value);
    return want.length > budget ? want.length - budget : 0;   // still missing after this call
  }
}

// One cache shared by the minimap and the Map app.
export const tileCache = new TileCache(56);
