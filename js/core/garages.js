// Your garages: which of your properties each car is parked at, where the car
// you drove is right now (out on a street, left behind in a chase, in the
// impound lot, on the trailer), and a car hauler that moves cars between your
// garages for a fee. The phone's Garage app (ui/garageApp.js) shows all of it.
//
// Save state: car.garage = the property id it's parked at (cars you aren't
// driving). Old saves have none: settle() parks them at home first, then at
// whichever garage has room. s.carLeft = { day, t, x, z, why } when you got
// out of your car in the middle of a police chase and left it there.
//
// DOM-free; tested in scripts/check-data.mjs.

import { PROPERTIES, LOC_BY_ID, districtAt } from '../data/world.js';
import { carName, CAR_BY_ID } from '../data/cars.js';
import { BREAKDOWNS, needsOil } from './upkeep.js';

export const HAUL_BASE = 150;      // the car hauler's hook-up fee
export const HAUL_PER_KM = 4;
export const HAUL_MIN = 45;        // game minutes it takes, at least

const ok = (extra = {}) => ({ ok: true, ...extra });
const err = text => ({ ok: false, text });

// Every property you own that has parking, home first.
export function garagesOf(s) {
  const ids = [...new Set(s.properties || [])].filter(id => (PROPERTIES[id]?.slots || 0) > 0 && LOC_BY_ID[id]);
  ids.sort((a, b) => (b === s.home) - (a === s.home));
  return ids.map(id => ({ id, name: PROPERTIES[id].name, slots: PROPERTIES[id].slots, loc: LOC_BY_ID[id], cars: (s.cars || []).filter(c => c.uid !== s.activeCar && c.garage === id) }));
}

// Give every parked car a garage (old saves, sold houses, a car you just
// stopped driving). Returns how many it moved.
export function settle(s) {
  const gs = garagesOf(s), ids = new Set(gs.map(g => g.id));
  const used = Object.fromEntries(gs.map(g => [g.id, 0]));
  for (const c of s.cars || []) if (c.uid !== s.activeCar && ids.has(c.garage)) used[c.garage]++;
  let n = 0;
  for (const c of s.cars || []) {
    if (c.uid === s.activeCar) continue;
    if (ids.has(c.garage)) continue;
    const g = gs.find(x => used[x.id] < x.slots) || gs[0];
    if (!g) continue;
    c.garage = g.id; used[g.id]++; n++;
  }
  return n;
}

export const freeAt = (s, id) => { const g = garagesOf(s).find(x => x.id === id); return g ? g.slots - g.cars.length : 0; };

// Where a car is and what it's doing.
// kind: driving | out | left | impound | trailer | rig | stolen | garage
export function whereIs(s, car, pos = s.carPos) {
  if (!car) return null;
  if (car.impound) return { kind: 'impound', text: 'In the FWPD impound lot', loc: LOC_BY_ID.pspd_central || null };
  if (car.stolen) return { kind: 'stolen', text: 'Stolen. The cops are looking for it.' };
  if (s.tow?.car === car.uid) return { kind: 'trailer', text: 'Riding on your trailer' };
  if (s.tow?.rig && s.tow.truck === car.uid) return { kind: 'rig', text: `Parked out with the trailer in ${districtAt(s.tow.rig.x, s.tow.rig.z)}`, x: s.tow.rig.x, z: s.tow.rig.z };
  if (car.uid === s.activeCar) {
    if (s.carLeft) return { kind: 'left', text: `Left on the street in ${districtAt(s.carLeft.x, s.carLeft.z)} during a chase (day ${s.carLeft.day}, ${s.carLeft.t})`, x: s.carLeft.x, z: s.carLeft.z };
    if (s.pos?.inCar) return { kind: 'driving', text: 'You\'re driving it' };
    if (pos) return { kind: 'out', text: `Parked in ${districtAt(pos.x, pos.z)}`, x: pos.x, z: pos.z };
    const home = LOC_BY_ID[s.home];
    return { kind: 'out', text: `Out front at ${PROPERTIES[s.home]?.name || 'home'}`, x: home?.x, z: home?.z };
  }
  const g = car.garage && PROPERTIES[car.garage];
  return { kind: 'garage', text: g ? `In the garage at ${g.name}` : 'In your garage', garage: car.garage, x: LOC_BY_ID[car.garage]?.x, z: LOC_BY_ID[car.garage]?.z };
}

// What needs looking at, worst first: [{ text, bad }].
export function carStatus(car) {
  const out = [];
  if (car.broken) out.push({ text: BREAKDOWNS[car.broken]?.name || 'Broken down', bad: true });
  const body = car.cond?.body ?? 100, eng = car.cond?.engine ?? 100;
  if (body < 50) out.push({ text: `Body ${Math.round(body)}%: needs the body shop`, bad: true });
  else if (body < 85) out.push({ text: `Body ${Math.round(body)}%` });
  if (eng < 60) out.push({ text: `Engine ${Math.round(eng)}%`, bad: eng < 35 });
  const fuel = car.fuel ?? 1;
  if (CAR_BY_ID[car.modelId]?.asp !== 'ev') {
    if (fuel < 0.15) out.push({ text: `Fuel ${Math.round(fuel * 100)}%: almost empty`, bad: true });
    else if (fuel < 0.4) out.push({ text: `Fuel ${Math.round(fuel * 100)}%` });
  }
  if (needsOil(car)) {
    const o = car.oil ?? 100;
    if (o <= 0) out.push({ text: 'Oil change overdue', bad: true });
    else if (o < 20) out.push({ text: `Oil ${Math.round(o)}%: change it soon` });
  }
  if ((car.cond?.tires ?? 100) < 20) out.push({ text: 'Tires are bald', bad: true });
  if (car.hot) out.push({ text: 'Hot car', bad: true });
  return out;
}

// The car hauler: what it costs to bring `car` to garage `to`.
export function haulQuote(s, car, to) {
  const dest = LOC_BY_ID[to];
  const w = whereIs(s, car);
  if (!dest || !PROPERTIES[to]?.slots) return { block: 'That property has no garage.' };
  if (!car) return { block: 'No car.' };
  if (w.kind === 'garage' && car.garage === to) return { block: 'It\'s already parked there.' };
  if (car.uid === s.activeCar) return { block: 'You\'re driving that one. Park it in a garage from home first.' };
  if (w.kind === 'impound') return { block: 'Sign it out of the impound lot first.' };
  if (w.kind === 'stolen') return { block: 'Nobody will haul a stolen car.' };
  if (w.kind === 'trailer' || w.kind === 'rig') return { block: 'It\'s out with your trailer.' };
  if (freeAt(s, to) <= 0) return { block: `${PROPERTIES[to].name} is full.` };
  const km = w.x != null ? Math.hypot(dest.x - w.x, dest.z - w.z) / 1000 : 5;
  return { fee: Math.round(HAUL_BASE + km * HAUL_PER_KM), minutes: Math.round(HAUL_MIN + km * 2.5), km };
}

// Move it. `pay(amount, label)` -> bool (state.spend). Returns { ok, text }.
export function haulCar(s, uid, to, pay) {
  const car = (s.cars || []).find(c => c.uid === uid);
  const q = haulQuote(s, car, to);
  if (q.block) return err(q.block);
  if (!pay(q.fee, `Car hauler: ${carName(CAR_BY_ID[car.modelId], car.year)} to ${PROPERTIES[to].name}`)) return err(`The hauler wants $${q.fee}. You're short.`);
  car.garage = to;
  return ok({ text: `The hauler is taking your ${CAR_BY_ID[car.modelId]?.model || 'car'} to ${PROPERTIES[to].name}. It'll be there in about ${q.minutes} minutes.`, minutes: q.minutes });
}

// The car you were driving goes in the garage at `at` (switching cars at a property).
export function parkActive(s, at) {
  const c = (s.cars || []).find(x => x.uid === s.activeCar);
  if (c && PROPERTIES[at]?.slots) c.garage = at;
}

// The police chase hook (world2d/world.js): you got out and ran.
export function noteLeft(s, x, z, t) { if (!s.carLeft) s.carLeft = { day: s.time.day, t, x, z, why: 'chase' }; }
export function clearLeft(s) { if (s.carLeft) s.carLeft = null; }
