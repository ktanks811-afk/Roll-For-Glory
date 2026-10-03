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

  // A drivable route between two points, snapped onto the roads at both ends
  // so the line follows the street you're on instead of cutting across
  // blocks to the nearest intersection. `heading` (radians, the car's facing)
  // makes routes that start with a U-turn cost a little more.
  // Returns { path: [[x, z], …], names: [street name of each segment], meters }.
  graph.routeBetween = (x0, z0, x1, z1, heading = null) => {
    const s = graph.nearestOnRoad(x0, z0), t = graph.nearestOnRoad(x1, z1);
    const se = s.edge, te = t.edge;
    let mid, names;
    if (se.id === te.id) { mid = []; names = [se.name]; }
    else {
      const dist = new Float64Array(nodes.length).fill(Infinity);
      const prev = new Int32Array(nodes.length).fill(-1);
      const done = new Uint8Array(nodes.length);
      for (const [id, d, sgn] of [[se.a, s.s, -1], [se.b, se.len - s.s, 1]]) {
        let c = d / (se.speed || 15);
        if (heading != null && (Math.sin(heading) * se.dx - Math.cos(heading) * se.dz) * sgn < -0.5) c += 6;
        if (c < dist[id]) dist[id] = c;
      }
      for (;;) {
        let u = -1, ud = Infinity;
        for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < ud) { ud = dist[i]; u = i; }
        if (u < 0) break;
        done[u] = 1;
        for (const eid of nodes[u].edges) {
          const e = edges[eid], v = e.a === u ? e.b : e.a, nd = ud + e.len / (e.speed || 15);
          if (nd < dist[v]) { dist[v] = nd; prev[v] = u; }
        }
      }
      const endA = dist[te.a] + t.s / (te.speed || 15), endB = dist[te.b] + (te.len - t.s) / (te.speed || 15);
      if (!Number.isFinite(Math.min(endA, endB))) return { path: [[x0, z0], [x1, z1]], names: [null], meters: Math.hypot(x1 - x0, z1 - z0) };
      const ids = [];
      for (let v = endA <= endB ? te.a : te.b; v >= 0; v = prev[v]) ids.unshift(v);
      mid = ids.map(id => [nodes[id].x, nodes[id].z]);
      names = [se.name];
      for (let i = 1; i < ids.length; i++) names.push(graph.edgeBetween(ids[i - 1], ids[i])?.name ?? null);
      names.push(te.name);
    }
    const path = [[x0, z0], [s.x, s.z], ...mid, [t.x, t.z], [x1, z1]];
    names = [null, ...names, null];
    // drop zero-length steps (e.g. already standing on a corner)
    const outP = [path[0]], outN = [];
    for (let i = 1; i < path.length; i++) {
      const a = outP[outP.length - 1], b = path[i];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5) { if (names[i - 1] && outN.length) outN[outN.length - 1] ??= names[i - 1]; continue; }
      outP.push(b); outN.push(names[i - 1]);
    }
    if (outP.length === 1) { outP.push([x1, z1]); outN.push(null); }
    let meters = 0;
    for (let i = 1; i < outP.length; i++) meters += Math.hypot(outP[i][0] - outP[i - 1][0], outP[i][1] - outP[i - 1][1]);
    return { path: outP, names: outN, meters };
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
