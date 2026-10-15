// The marinas on land: a clubhouse with the marina's name on the roof, a
// parking lot and a ramp down to the water. The docks out over the water,
// and the boats in them, are drawn by world2d/boats.js.

import { MARINAS, DIR } from '../data/boats.js';

export function addMarinas({ buildings, lots, props }) {
  for (const m of MARINAS) {
    const [dx, dz] = DIR[m.to];
    // local frame: u inland from the door, v along the shore
    const rect = (u0, v0, u1, v1) => {
      const ax = m.x - dx * u0 - dz * v0, az = m.z - dz * u0 + dx * v0, bx = m.x - dx * u1 - dz * v1, bz = m.z - dz * u1 + dx * v1;
      return { x: Math.min(ax, bx), z: Math.min(az, bz), w: Math.abs(bx - ax), d: Math.abs(bz - az) };
    };
    // the clubhouse sits back from the door; you walk up to its front by the water
    buildings.push({ ...rect(7, -16, 27, 16), h: m.deep ? 11 : 7, color: m.deep ? '#e9edf2' : '#c9b48e', kind: 'store', label: m.name.toUpperCase(), labelColor: '#1bb8e8', loc: m.id, shop: 'marina', side: m.to, accent: '#1bb8e8' });
    // the lot beside it, and a concrete ramp into the water
    lots.push({ ...rect(-2, 20, 40, 64), kind: 'parking' });
    lots.push({ ...rect(-14, -30, 2, -22), kind: 'lot' });
    // umbrellas and benches out front along the seawall
    for (const [v, c] of [[-24, '#1bb8e8'], [24, '#f4f4f4'], [36, '#1a2a4a']]) { const r = rect(-8, v, -8, v); props.push({ k: 'umbrella', x: r.x, z: r.z, r: 1.8, c }); }
    for (const v of [-12, 12]) props.push({ k: 'bench', ...rect(-11, v - 1.5, -10.4, v + 1.5) });
  }
}
