// What a mechanic charges to fix each part of a car (the repair counter in
// ui/places.js and the tow truck's damage report in core/towing.js).
// DOM-free so scripts/check-data.mjs can test it.

import { modelOf } from './state.js';
import { rebuildCost } from '../sim/engine.js';

export const REPAIR_NAMES = { body: 'Body & paint', lights: 'Lights', tires: 'Tires (replace set)', engine: 'Engine', trans: 'Transmission' };

export function repairCosts(car, rate = 1) {
  const m = modelOf(car);
  const c = car.cond;
  const lux = m.msrp;
  const cost = {
    body: (100 - c.body) / 100 * (900 + lux * 0.03),
    lights: (100 - c.lights) / 100 * (300 + lux * 0.006),
    tires: c.tires < 99 ? (100 - c.tires) / 100 * (500 + lux * 0.004) : 0,
    engine: car.engineBlown ? rebuildCost(m) : (100 - c.engine) / 100 * (1800 + lux * 0.05),
    trans: (100 - c.trans) / 100 * (1400 + lux * 0.035),
  };
  for (const k in cost) cost[k] = Math.round(cost[k] * rate / 5) * 5;
  return cost;
}
