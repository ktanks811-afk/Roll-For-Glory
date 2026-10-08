// Westward Texas expansion: Mineral Wells, Palo Pinto County and the I-20 corridor.
// The geometry is intentionally modular so the next westward expansion can continue
// from WEST.x0 without moving Fort Worth, Weatherford or Dallas.
import { WEST, WEST_CITY, BLOCK, XGRID_X, XGRID_Z, LOCATIONS } from '../data/world.js';

export function addWest({ buildings, lots, trees, props }, { landmarkBlock, roads } = {}) {
  const R = (a, b) => a + Math.random() * (b - a);
  const water = [];

  // Mineral Wells urban grid. Real-world geography informs the region names and
  // highway corridor; the gameplay streets are a simplified simulation.
  const gx0 = WEST_CITY.x0, gz0 = WEST_CITY.z0;
  const gx1 = WEST_CITY.x1, gz1 = WEST_CITY.z1;
  for (let x = gx0; x < gx1; x += BLOCK) for (let z = gz0; z < gz1; z += BLOCK) {
    const i = Math.round((x - gx0) / BLOCK), j = Math.round((z - gz0) / BLOCK);
    const loc = LOCATIONS.find(l => l.city === 'west' && l.block?.[0] === i && l.block?.[1] === j);
    const x0 = x + 14, z0 = z + 14, x1 = x + BLOCK - 14, z1 = z + BLOCK - 14;
    if (loc) { landmarkBlock?.(loc, x0, z0, x1, z1); continue; }

    if ((i + j) % 9 === 0) {
      lots.push({ x: x0, z: z0, w: x1 - x0, d: z1 - z0, kind: 'park' });
      for (let k = 0; k < 7; k++) trees.push({ x: R(x0 + 8, x1 - 8), z: R(z0 + 8, z1 - 8), r: R(2.5, 4.5), kind: 'tree' });
      continue;
    }
    if (j < 2 || i < 2 || i > 7) {
      lots.push({ x: x0, z: z0, w: x1 - x0, d: z1 - z0, kind: 'yard' });
      buildings.push({ x: x0 + 18, z: z0 + 18, w: 48, d: 38, h: R(5, 8), color: ['#6b3a2e','#5a4632','#3f4a5a','#7a4b3a'][(i + j) % 4], kind: 'house' });
      if (Math.random() < .7) trees.push({ x: R(x0 + 8, x1 - 8), z: R(z0 + 8, z1 - 8), r: R(2.5, 4.5), kind: 'tree' });
    } else if ((i * 3 + j) % 5 === 0) {
      buildings.push({ x: x0 + 5, z: z0 + 5, w: x1 - x0 - 10, d: 55, h: R(8, 13), color: '#676b70', kind: 'warehouse' });
      lots.push({ x: x0 + 5, z: z0 + 70, w: x1 - x0 - 10, d: 45, kind: 'parking' });
    } else {
      lots.push({ x: x0 + 3, z: z0 + 3, w: x1 - x0 - 6, d: z1 - z0 - 6, kind: 'yard' });
      buildings.push({ x: x0 + 10, z: z0 + 10, w: 55, d: 48, h: R(6, 11), color: '#74777b', kind: 'midrise' });
    }
  }

  // West I-20 corridor and the open Palo Pinto countryside.
  for (let k = 0; k < 75; k++) {
    const x = WEST.x0 + R(100, WEST.x1 - WEST.x0 - 100);
    const z = R(WEST.z0 + 80, WEST.z1 - 80);
    if (x > WEST_CITY.x0 - 120 && x < WEST_CITY.x1 + 120 && z > WEST_CITY.z0 - 120 && z < WEST_CITY.z1 + 120) continue;
    if (Math.abs(z + 1350) < 90) continue;
    lots.push({ x, z, w: R(45, 120), d: R(35, 100), kind: Math.random() < .55 ? 'field' : 'yard' });
    for (let n = 0; n < 3; n++) trees.push({ x: x + R(5, 90), z: z + R(5, 70), r: R(3, 6), kind: Math.random() < .7 ? 'tree' : 'pine' });
  }

  // Mineral Wells / Palo Pinto terrain: low mesas and wooded hills.
  for (let k = 0; k < 22; k++) {
    const x = R(WEST.x0 + 250, WEST.x1 - 250), z = R(WEST.z0 + 100, WEST.z1 - 100);
    if (Math.abs(z + 1350) < 160) { k--; continue; }
    const roadHit = roads?.nearestOnRoad(x, z);
    if (roadHit && roadHit.dist < Math.max(90, roadHit.edge.width / 2 + 18)) { k--; continue; }
    buildings.push({ x, z, w: R(35, 100), d: R(35, 90), h: R(8, 24), color: ['#66513e','#705944','#574837'][k % 3], kind: 'rock' });
  }

  // Lake Mineral Wells recreation area.
  water.push({ x: -9100, z: -250, w: 620, d: 360, kind: 'lake' });
  for (let k = 0; k < 45; k++) {
    trees.push({ x: R(-9250, -8400), z: R(-420, 220), r: R(3, 6), kind: 'pine' });
  }

  return { water };
}
