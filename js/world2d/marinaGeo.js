// Where boats can go and how each marina's docks are laid out. No browser
// APIs here, so scripts/check-data.mjs can test it in Node.

import { DIR } from '../data/boats.js';

const PIER_W = 4;

// ---------------------------------------------------------------- where boats can go
// Every water rect plus the gaps between two of them that a bridge spans.
export function navRects(map) {
  if (map._nav) return map._nav;
  const ws = map.water.filter(w => w.w > 30 && w.d > 30);
  const out = ws.map(w => ({ x0: w.x, z0: w.z, x1: w.x + w.w, z1: w.z + w.d }));
  for (let i = 0; i < ws.length; i++) for (let j = 0; j < ws.length; j++) {
    if (i === j) continue;
    const a = out[i], b = out[j];
    const gz = b.z0 - a.z1, gx = b.x0 - a.x1;
    const ox0 = Math.max(a.x0, b.x0), ox1 = Math.min(a.x1, b.x1), oz0 = Math.max(a.z0, b.z0), oz1 = Math.min(a.z1, b.z1);
    if (gz > 0 && gz <= 45 && ox1 - ox0 > 10) out.push({ x0: ox0, z0: a.z1, x1: ox1, z1: b.z0, channel: true });
    if (gx > 0 && gx <= 45 && oz1 - oz0 > 10) out.push({ x0: a.x1, z0: oz0, x1: b.x0, z1: oz1, channel: true });
  }
  map._nav = out;
  return out;
}

// ---------------------------------------------------------------- the marinas' docks
// Local frame: u runs out from the shore over the water, v across it.
export function marinaLayout(m) {
  const [dx, dz] = DIR[m.to];
  const sx = m.x + dx * 14, sz = m.z + dz * 14;            // where the dock meets the shore
  const P = m.deep ? 150 : 90, T = m.deep ? 150 : 70;      // main pier length, T-head length
  const at = (u, v) => ({ x: sx + dx * u - dz * v, z: sz + dz * u + dx * v });
  const rect = (u0, v0, u1, v1) => { const a = at(u0, v0), b = at(u1, v1); return { x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) }; };
  const out = Math.atan2(dx, -dz);                          // a heading pointing out over the water
  const piers = [rect(-14, -PIER_W / 2, P, PIER_W / 2), rect(P, -T / 2, P + 5, T / 2)];
  const slips = [];                                         // small boats, bow in to the finger piers
  for (let u = 16; u < P - 14; u += 16) {
    for (const side of [-1, 1]) {
      piers.push(rect(u - 0.75, side * PIER_W / 2, u + 0.75, side * 14));
      slips.push({ ...at(u + 8, side * 9), h: out + (side > 0 ? -Math.PI / 2 : Math.PI / 2), max: 13 });
    }
  }
  const berths = [];                                        // big boats, alongside the T-head
  return { m, sx, sz, dx, dz, P, T, at, out, piers, slips, berths, area: rect(-20, -T / 2 - 40, P + 60, T / 2 + 40),
    // out past the T-head and the big boats tied to it, pointing at open water
    launch: (def) => ({ ...at(P + 5 + (m.deep ? 24 : 10) + def.L / 2, 0), h: out }),
    // where a boat of length L ties up on the T-head outer side, at slot k
    berth: (def, k) => { const v = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.min(T / 2, def.L * 0.55 + 4); return { ...at(P + 5 + def.W / 2 + 1.5, def.L > T * 0.7 ? 0 : v), h: out + Math.PI / 2 }; },
    lamps: [at(0, 0), at(P / 2, 0), at(P, -T / 2 + 4), at(P, T / 2 - 4), at(P, 0)],
  };
}

