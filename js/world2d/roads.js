// Road graph: intersections (nodes) and straight segments (edges).
// Traffic, police routing, GPS and the minimap all read from this.

import { GRID, HWY_Z, HWY_X, DESERT_ROAD_END, STREET_NS, STREET_EW, ROAD_W, HWY_W, COUNTRY_ROADS, DGRID_X, DGRID_Z, DSTREET_NS, DSTREET_EW, I30_ROW, I30_END, ARLINGTON_X, ARLINGTON_END,
  DNGRID_X, DNGRID_Z, WGRID_X, WGRID_Z, DNSTREET_NS, DNSTREET_EW, I35_END, I20_WEST_END, WEST, WEST_CITY, HTRACE_Z, WESTPORT_Z, TX114_Z, TX114_X, ROANOKE_X, ROANOKE_END, US377_Z, TMS, TMS_PIT_X, AIRPORT_X } from '../data/world.js';

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
  // Loop 820 and its connectors
  const HWY = { kind: 'highway', width: HWY_W, lanes: [3.6, 7.6, 11.6], speed: 30, name: 'Loop 820' };
  const hx = [HWY_X[0], -900, 0, 900, HWY_X[1]];
  for (let i = 0; i < hx.length - 1; i++) edge(node(hx[i], HWY_Z), node(hx[i + 1], HWY_Z), HWY);
  for (const x of [-900, 0, 900]) edge(node(x, -900), node(x, HWY_Z), { ...CITY, name: 'I-35W', speed: 20 });
  // Chisholm Trail Pkwy into the desert
  const DES = { kind: 'desert', width: 11, lanes: [2.6], speed: 25, name: 'Chisholm Trail Pkwy' };
  edge(node(0, 900), node(0, 1800), DES);
  edge(node(0, 1800), node(0, DESERT_ROAD_END), DES);
  // Johnson County: the parkway runs on south into farm country, then a grid
  // of farm-to-market and county roads (world2d/country.js fills it in)
  edge(node(0, DESERT_ROAD_END), node(0, COUNTRY_ROADS.z[0]), DES);
  const FARM = { kind: 'desert', width: 10, lanes: [2.5], speed: 22 };
  const [cz0, cz1, cz2] = COUNTRY_ROADS.z, [cx0, cx1, cx2, cx3] = COUNTRY_ROADS.x;
  for (const [z, name] of [[cz0, 'FM 917'], [cz1, 'FM 4'], [cz2, 'County Road 1200']])
    for (const [a, b] of [[cx0, cx1], [cx1, cx2], [cx2, cx3]]) edge(node(a, z), node(b, z), { ...FARM, name });
  for (const [x, name] of [[cx0, 'County Road 802'], [cx1, 'County Road 1016'], [cx2, 'Old Cleburne Rd'], [cx3, 'Hwy 174']])
    for (const [a, b] of [[cz0, cz1], [cz1, cz2]]) edge(node(x, a), node(x, b), { ...FARM, name });

  // I-20: west from Fort Worth into Weatherford. Add the Loop 820/I-20 junction node so the graph is connected at the interchange.
  const I20 = { ...HWY, name: 'I-20' };
  edge(node(HWY_X[0], HWY_Z), node(I20_WEST_END, HWY_Z), I20);
  edge(node(HWY_X[0], -900), node(HWY_X[0], HWY_Z), { ...HWY, name: 'I-20 Connector' });
  for (let i=0;i<WGRID_X.length;i++) for (let j=0;j<WGRID_Z.length;j++) node(WGRID_X[i],WGRID_Z[j]);
  for (let i=0;i<WGRID_X.length;i++) for (let j=0;j<WGRID_Z.length-1;j++) edge(node(WGRID_X[i],WGRID_Z[j]),node(WGRID_X[i],WGRID_Z[j+1]),{...CITY,name:['Main St','Ranger Hwy','Center St','Garner Rd','Walnut St','South Bowie Ave','Farm Rd','FM 920','FM 730','Old Brock Rd','Eureka St','Hudson Oaks'][i]||'Weatherford St'});
  for (let j=0;j<WGRID_Z.length;j++) for (let i=0;i<WGRID_X.length-1;i++) edge(node(WGRID_X[i],WGRID_Z[j]),node(WGRID_X[i+1],WGRID_Z[j]),{...CITY,name:['Lakeway Dr','Palo Pinto St','Fort Worth Hwy','I-20 Frontage','Parker County Loop','Spring St','Oak St','Bankhead Rd','College Park','White Settlement Rd','Weatherford Pkwy'][j]||'Weatherford St'});
  // Connect I-20 into the Weatherford street graph; the highway segment is continuous, but the graph needs an explicit junction node.
  edge(node(I20_WEST_END, HWY_Z), node(WGRID_X[0], HWY_Z), I20);
  // County connectors keep the new Parker County acreage reachable without placing the lots on a street.
  edge(node(-5550, -600), node(-5550, -325), { ...CITY, name: 'Weatherford North Rd' });
  edge(node(-4200, -600), node(-4200, -375), { ...CITY, name: 'Parker Ridge Rd' });
  edge(node(-5100, -600), node(-5100, -325), { ...CITY, name: 'Aledo Ranch Rd' });

  // West Texas expansion: keep I-20 continuous from Weatherford toward Mineral Wells.
  edge(node(I20_WEST_END, HWY_Z), node(WEST.x0, HWY_Z), I20);
  // Keep the shared Parkway road profile initialized before the westward roads use it.
  const PKWY = { ...CITY, speed: 22 };
  const WUS = { ...PKWY, speed: 24 };
  // US-180 runs through Mineral Wells and continues west/east across the expansion.
  edge(node(WEST.x0, -1350), node(WEST_CITY.x0, -1350), { ...WUS, name: 'US-180' });
  edge(node(WEST_CITY.x1, -1350), node(WEST.x1, -1350), { ...WUS, name: 'US-180' });
  // US-281 north/south through Mineral Wells, plus the airport-side connector.
  edge(node(-9000, WEST.z0), node(-9000, WEST.z1), { ...WUS, name: 'US-281' });
  edge(node(-9750, -1050), node(-8250, -1050), { ...CITY, name: 'US-180 Frontage' });
  // Mineral Wells city grid.
  for (let x = WEST_CITY.x0; x <= WEST_CITY.x1; x += 150) node(x, WEST_CITY.z0);
  for (let z = WEST_CITY.z0; z <= WEST_CITY.z1; z += 150) node(WEST_CITY.x0, z);
  for (let x = WEST_CITY.x0; x <= WEST_CITY.x1; x += 150) {
    for (let z = WEST_CITY.z0; z < WEST_CITY.z1; z += 150)
      edge(node(x,z), node(x,z+150), { ...CITY, name: x === -9000 ? 'US-281' : ['Oak St','Elm St','Mesquite St','S Oak St','NE 1st Ave','SE 1st Ave','SE 6th Ave','NE 23rd St','FM 1195'][Math.round((x-WEST_CITY.x0)/150)] || 'Mineral Wells St' });
  }
  for (let z = WEST_CITY.z0; z <= WEST_CITY.z1; z += 150) {
    for (let x = WEST_CITY.x0; x < WEST_CITY.x1; x += 150)
      edge(node(x,z), node(x+150,z), z === -1350 ? { ...WUS, name: 'US-180' } : { ...CITY, name: ['W 2nd Ave','W 5th Ave','W Hubbard St','NW 6th Ave','NE 6th Ave','SE 6th Ave','SE 12th Ave','SE 16th Ave','Garrett Morris Pkwy'][Math.round((z-WEST_CITY.z0)/150)] || 'Mineral Wells Ave' });
  }
  // Rural connectors toward Palo Pinto, Santo and the west hills.
  edge(node(-9000, WEST.z0), node(-9000, WEST.z0 + 420), { ...PKWY, name: 'FM 337' });
  edge(node(-9000, WEST.z1), node(-9000, WEST.z1 + 650), { ...PKWY, name: 'FM 1195' });

  // I-30: on east from the end of Loop 820, past Arlington, over the Trinity
  // and right through Dallas, then a little way on out of town
  const I30 = { ...HWY, name: 'I-30' };
  const ix = [HWY_X[1], ARLINGTON_X, DGRID_X[0]];
  for (let i = 0; i < ix.length - 1; i++) edge(node(ix[i], HWY_Z), node(ix[i + 1], HWY_Z), I30);
  // the Arlington exit: Collins St runs south off the freeway into town
  edge(node(ARLINGTON_X, HWY_Z), node(ARLINGTON_X, ARLINGTON_END), { ...CITY, name: 'Collins St' });
  // Dallas: its own street grid; the I-30 row is freeway, the cross streets meet it at grade
  for (let i = 0; i < DGRID_X.length; i++) for (let j = 0; j < DGRID_Z.length; j++) node(DGRID_X[i], DGRID_Z[j]);
  for (let i = 0; i < DGRID_X.length; i++) for (let j = 0; j < DGRID_Z.length - 1; j++)
    edge(node(DGRID_X[i], DGRID_Z[j]), node(DGRID_X[i], DGRID_Z[j + 1]), { ...CITY, name: DSTREET_NS[i] });
  for (let j = 0; j < DGRID_Z.length; j++) for (let i = 0; i < DGRID_X.length - 1; i++)
    edge(node(DGRID_X[i], DGRID_Z[j]), node(DGRID_X[i + 1], DGRID_Z[j]), j === I30_ROW ? I30 : { ...CITY, name: DSTREET_EW[j] });
  edge(node(DGRID_X[DGRID_X.length - 1], HWY_Z), node(I30_END, HWY_Z), I30);

  // North Texas: I-35W on north from Loop 820 through Alliance, past the
  // speedway, to Denton (world2d/north.js builds what's along it)
  const I35 = { ...HWY, name: 'I-35W' };
  const nx = [HWY_Z, WESTPORT_Z, HTRACE_Z, TX114_Z, DNGRID_Z[DNGRID_Z.length - 1]];
  for (let i = 0; i < nx.length - 1; i++) edge(node(0, nx[i]), node(0, nx[i + 1]), I35);
  for (const [z, name, xs] of [[HTRACE_Z, 'Heritage Trace Pkwy', [-1200, 0, AIRPORT_X, 1700]], [WESTPORT_Z, 'Westport Pkwy', [-1200, 0, 1600]]])
    for (let i = 0; i < xs.length - 1; i++) edge(node(xs[i], z), node(xs[i + 1], z), { ...PKWY, name });
  edge(node(AIRPORT_X, HTRACE_Z), node(AIRPORT_X, HTRACE_Z - 230), { ...CITY, name: 'Alliance Blvd' });
  // TX-114, with the speedway's pit road and Roanoke on it
  const T114 = { ...PKWY, name: 'TX-114', speed: 25 };
  const tx = [TX114_X[0], 0, TMS_PIT_X, ROANOKE_X, TX114_X[1]];
  for (let i = 0; i < tx.length - 1; i++) edge(node(tx[i], TX114_Z), node(tx[i + 1], TX114_Z), T114);
  edge(node(TMS_PIT_X, TX114_Z), node(TMS_PIT_X, TMS.z1), { ...CITY, name: 'Speedway Pit Rd' });
  // the oval: a ring of track, no traffic, no speed limit
  const OVAL = { ...HWY, speed: 45, name: 'Texas Motor Speedway', track: true };
  const ring = [[TMS_PIT_X, TMS.z1], [TMS.x1, TMS.z1], [TMS.x1, TMS.z0], [TMS.x0, TMS.z0], [TMS.x0, TMS.z1], [TMS_PIT_X, TMS.z1]];
  for (let i = 0; i < ring.length - 1; i++) edge(node(...ring[i]), node(...ring[i + 1]), OVAL);
  // Roanoke: Oak St south off 114; US-377 north along the lake and into Denton on Dallas Dr
  edge(node(ROANOKE_X, TX114_Z), node(ROANOKE_X, ROANOKE_END), { ...CITY, name: 'Oak St' });
  const U377 = { ...PKWY, name: 'US-377', speed: 25 };
  edge(node(ROANOKE_X, TX114_Z), node(ROANOKE_X, US377_Z), U377);
  edge(node(ROANOKE_X, US377_Z), node(DNGRID_X[DNGRID_X.length - 1], US377_Z), U377);
  // Denton: its own grid; the west street line is I-35 itself, cross streets meet it at grade
  for (let i = 0; i < DNGRID_X.length; i++) for (let j = 0; j < DNGRID_Z.length; j++) node(DNGRID_X[i], DNGRID_Z[j]);
  for (let i = 0; i < DNGRID_X.length; i++) for (let j = 0; j < DNGRID_Z.length - 1; j++)
    edge(node(DNGRID_X[i], DNGRID_Z[j]), node(DNGRID_X[i], DNGRID_Z[j + 1]), i === 0 ? { ...I35, name: 'I-35' } : { ...CITY, name: DNSTREET_NS[i] });
  for (let j = 0; j < DNGRID_Z.length; j++) for (let i = 0; i < DNGRID_X.length - 1; i++)
    edge(node(DNGRID_X[i], DNGRID_Z[j]), node(DNGRID_X[i + 1], DNGRID_Z[j]), { ...CITY, name: DNSTREET_EW[j] });
  edge(node(0, DNGRID_Z[0]), node(0, I35_END), { ...I35, name: 'I-35' });

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
