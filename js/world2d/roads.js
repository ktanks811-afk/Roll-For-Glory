// Road graph: intersections (nodes) and straight segments (edges).
// Traffic, police routing, GPS and the minimap all read from this.

import { GRID, HWY_Z, HWY_X, DESERT_ROAD_END, STREET_NS, STREET_EW, ROAD_W, HWY_W } from '../data/world.js';

export function buildRoads() {
  const nodes = [];
  const edges = [];
  const key = (x, z) => `${Math.round(x)},${Math.round(z)}`;
  const byKey = new Map();
  const node = (x, z) => {
    const k = key(x, z);
    if (byKey.has(k)) return byKey.get(k);
    const n = { id: nodes.length, x, z, edges: [] };
    nodes.push(n); byKey.set(k, n);
    return n;
  };
  const edge = (a, b, props) => {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    const e = { id: edges.length, a: a.id, b: b.id, ax: a.x, az: a.z, bx: b.x, bz: b.z, dx: dx / len, dz: dz / len, len, ...props };
    edges.push(e); a.edges.push(e.id); b.edges.push(e.id);
    return e;
  };

  const CITY = { kind: 'city', width: ROAD_W, lanes: [2, 6], speed: 15 };
  for (let i = 0; i < GRID.length; i++) for (let j = 0; j < GRID.length; j++) node(GRID[i], GRID[j]);
  for (let i = 0; i < GRID.length; i++) {
    for (let j = 0; j < GRID.length - 1; j++) {
      edge(node(GRID[i], GRID[j]), node(GRID[i], GRID[j + 1]), { ...CITY, name: STREET_NS[i] });
      edge(node(GRID[j], GRID[i]), node(GRID[j + 1], GRID[i]), { ...CITY, name: STREET_EW[i] });
    }
  }
  // Glory Highway and its connectors
  const HWY = { kind: 'highway', width: HWY_W, lanes: [3.6, 7.6, 11.6], speed: 30, name: 'Glory Highway' };
  const hx = [HWY_X[0], -900, 0, 900, HWY_X[1]];
  for (let i = 0; i < hx.length - 1; i++) edge(node(hx[i], HWY_Z), node(hx[i + 1], HWY_Z), HWY);
  for (const x of [-900, 0, 900]) edge(node(x, -900), node(x, HWY_Z), { ...CITY, name: 'Glory Hwy Connector', speed: 20 });
  // Dust Line Road into the desert
  const DES = { kind: 'desert', width: 11, lanes: [2.6], speed: 25, name: 'Dust Line Road' };
  edge(node(0, 900), node(0, 1800), DES);
  edge(node(0, 1800), node(0, DESERT_ROAD_END), DES);

  const graph = { nodes, edges, byKey };

  graph.nearestNode = (x, z) => {
    let best = null, bd = Infinity;
    for (const n of nodes) { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n; } }
    return best;
  };

  // Closest point on any edge. Returns { edge, s (distance from a), dist, x, z }.
  graph.nearestOnRoad = (x, z) => {
    let best = null;
    for (const e of edges) {
      let s = (x - e.ax) * e.dx + (z - e.az) * e.dz;
      s = Math.max(0, Math.min(e.len, s));
      const px = e.ax + e.dx * s, pz = e.az + e.dz * s;
      const d = Math.hypot(px - x, pz - z);
      if (!best || d < best.dist) best = { edge: e, s, dist: d, x: px, z: pz };
    }
    return best;
  };

  graph.onRoad = (x, z) => {
    const r = graph.nearestOnRoad(x, z);
    return r && r.dist < r.edge.width / 2 + 1 ? r : null;
  };

  // Dijkstra. Returns a list of node ids from -> to.
  graph.route = (fromId, toId) => {
    if (fromId === toId) return [fromId];
    const dist = new Float64Array(nodes.length).fill(Infinity);
    const prev = new Int32Array(nodes.length).fill(-1);
    const done = new Uint8Array(nodes.length);
    dist[fromId] = 0;
    for (;;) {
      let u = -1, ud = Infinity;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < ud) { ud = dist[i]; u = i; }
      if (u < 0 || u === toId) break;
      done[u] = 1;
      for (const eid of nodes[u].edges) {
        const e = edges[eid];
        const v = e.a === u ? e.b : e.a;
        const nd = ud + e.len / (e.speed || 15);
        if (nd < dist[v]) { dist[v] = nd; prev[v] = u; }
      }
    }
    if (prev[toId] < 0) return null;
    const path = [];
    for (let v = toId; v >= 0; v = prev[v]) { path.unshift(v); if (v === fromId) break; }
    return path;
  };

  graph.edgeBetween = (a, b) => {
    for (const eid of nodes[a].edges) { const e = edges[eid]; if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return e; }
    return null;
  };

  graph.streetName = (x, z) => {
    const r = graph.nearestOnRoad(x, z);
    return r && r.dist < 30 ? r.edge.name : null;
  };

  return graph;
}
