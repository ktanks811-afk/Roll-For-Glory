// Car upkeep: oil life, tire tread, everyday wear and breakdowns.
//
// Every mile wears the oil and the tires a little. Skip oil changes and the
// engine starts eating itself; run bald tires and one blows out; neglect the
// engine or transmission and the car breaks down on the side of the road.
// Fix it at a gas station (oil), Second Chance Collision (everything), or
// call the mobile mechanic / a tow from the phone (Bank → Roadside).
//
// Saves from before this existed have no `oil` or `broken` on their cars;
// ensureUpkeep() fills them in fresh so nobody loads into a dead car.

import { CAR_BY_ID } from '../data/cars.js';

// The city is compressed, so a tank should last a session, not a week.
// Driving burns fuel this many times faster than real mpg says.
export const FUEL_BURN = 7;
// Miles between oil changes on a stock motor. Built motors run hotter and
// need it sooner (see oilInterval).
export const OIL_MILES = 60;
// Miles a set of tires lasts with normal driving (burnouts eat them faster).
export const TIRE_MILES = 220;

export const BREAKDOWNS = {
  overheat: { name: 'Overheated', short: 'OVERHEATED', text: 'Steam is pouring out from under the hood and the engine shut itself off. Old oil and a tired motor will do that.', roadside: true },
  stall: { name: 'Stalled out', short: 'STALLED', text: 'The engine sputtered and died. It cranks but won\'t catch.', roadside: true },
  trans: { name: 'Transmission failed', short: 'NO GEARS', text: 'Grinding, a bang, then nothing. The engine revs but the car won\'t move. That transmission is done.', roadside: false },
};

export function ensureUpkeep(car) {
  if (!car) return car;
  car.oil ??= 100;
  if (car.broken && !BREAKDOWNS[car.broken]) delete car.broken;
  return car;
}

const isEv = car => CAR_BY_ID[car.modelId]?.asp === 'ev';
export function needsOil(car) { return !!car && !isEv(car); }

// Built motors (boost, nitrous, an aggressive tune) burn through oil faster.
export function oilInterval(spec) {
  const boost = spec?.boostLevel || 0, risk = spec?.engineRisk || 0;
  return Math.round(OIL_MILES / (1 + boost * 0.12 + Math.min(1.5, risk) * 0.5));
}

export function oilChangeCost(car) {
  const m = CAR_BY_ID[car.modelId];
  const synth = m.asp !== 'na' || (m.hp || 0) > 300;
  return synth ? 89.99 : 49.99;
}

export function oilLabel(car) {
  if (!needsOil(car)) return 'Electric (no oil)';
  const o = car.oil ?? 100;
  return o <= 0 ? 'OVERDUE: engine wearing' : o < 20 ? `${Math.round(o)}% · change it soon` : `${Math.round(o)}%`;
}

// Called every frame while driving. `miles` driven this frame, `slip` from the
// sim, `spec` for how hard the build is on oil. Returns an event or null:
// 'oilLow' | 'oilOut' | 'tiresLow' | 'blowout' | a BREAKDOWNS key.
const warned = new WeakMap();   // per car, kept out of the save
export function wearTick(car, miles, { spec, slip = 0, dt = 0, rng = Math.random } = {}) {
  if (!car?.cond || car.broken) return null;
  ensureUpkeep(car);
  const st = warned.get(car) || {};
  warned.set(car, st);
  const c = car.cond;
  // tires: tread wears with miles, faster when they're spinning
  if (c.tires > 1) c.tires = Math.max(1, c.tires - miles * (100 / TIRE_MILES) * (1 + Math.min(2, slip * 3)));
  // oil
  if (needsOil(car)) {
    car.oil = Math.max(0, car.oil - miles * 100 / oilInterval(spec));
    // dirty oil: the engine wears a little; no oil life left: it wears fast
    if (car.oil <= 0) c.engine = Math.max(1, c.engine - miles * 3);
    else if (car.oil < 20) c.engine = Math.max(1, c.engine - miles * 0.4);
  }
  // everyday wear on the gearbox; a worn engine wears it faster
  c.trans = Math.max(1, c.trans - miles * (0.06 + (c.engine < 40 ? 0.1 : 0)));

  // breakdowns: only cars that have been let go. Chances are per mile.
  if (miles > 0 && !car.hot) {
    const roll = p => rng() < p * miles;
    if (c.tires > 1 && c.tires < 12 && roll(0.25 + (12 - c.tires) * 0.04)) { c.tires = 0; return 'blowout'; }
    if (needsOil(car)) {
      const oilBad = car.oil <= 0 ? 1 : car.oil < 10 ? 0.1 : 0;
      if ((oilBad || c.engine < 30) && roll(0.05 + oilBad * 0.25 + (c.engine < 30 ? (30 - c.engine) * 0.012 : 0))) { car.broken = 'overheat'; return 'overheat'; }
      if (c.engine < 45 && car.oil < 25 && roll(0.06)) { car.broken = 'stall'; return 'stall'; }
    }
    if (c.trans < 22 && roll(0.08 + (22 - c.trans) * 0.02)) { car.broken = 'trans'; return 'trans'; }
  }

  // one-time warnings, re-armed once fixed
  if (needsOil(car)) {
    if (car.oil <= 0 && !st.oilOut) { st.oilOut = true; return 'oilOut'; }
    if (car.oil < 20 && !st.oilLow) { st.oilLow = true; return 'oilLow'; }
    if (car.oil >= 20) st.oilLow = st.oilOut = false;
  }
  if (c.tires > 1 && c.tires < 20 && !st.tiresLow) { st.tiresLow = true; return 'tiresLow'; }
  if (c.tires >= 20) st.tiresLow = false;
  return null;
}

export function wearMessage(ev, car) {
  const b = BREAKDOWNS[ev];
  if (b) return `🛠 Broke down: ${b.name}. ${b.roadside ? 'Call the mobile mechanic or a tow from your phone (Bank → Roadside).' : 'Call a tow from your phone (Bank → Roadside) to Second Chance Collision.'}`;
  return {
    oilLow: '🛢 Oil change due. Hit a gas station or Second Chance Collision before the engine starts paying for it.',
    oilOut: '🛢 Oil is shot. The engine is wearing every mile now. Change it before it overheats.',
    tiresLow: '🛞 Tires are getting bald. Bald tires blow out. Replace them at Second Chance Collision.',
    blowout: '💥 BLOWOUT! A bald tire let go. Grip is gone. Get new tires at Second Chance Collision.',
  }[ev] || '';
}

export function changeOil(car) { car.oil = 100; clearBreakdown(car); }

// Clears a breakdown once whatever caused it has been fixed.
export function clearBreakdown(car) {
  const c = car.cond, k = car.broken;
  if (!k) return;
  if (k === 'trans' ? c.trans >= 22 : (car.oil ?? 100) > 10 && c.engine >= 30 && !car.engineBlown) delete car.broken;
}

// Mobile mechanic on the side of the road: tops up oil, cools it down, gets
// it running. Not a real fix for a dead transmission.
export const MECHANIC_COST = 140;
export function roadsideFix(car) {
  if (!car?.broken || !BREAKDOWNS[car.broken].roadside) return false;
  if (needsOil(car)) car.oil = Math.max(car.oil ?? 0, 35);
  car.cond.engine = Math.max(car.cond.engine, 32);
  delete car.broken;
  return true;
}
