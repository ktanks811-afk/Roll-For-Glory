// Trailers: buy one at Cowtown Trailer Sales, hitch it to a truck at home,
// load one of your other cars on it, and haul it to a meet or a race. Stop
// anywhere and unload: the truck and trailer stay parked there (the "rig")
// while you drive the car. Pull the car back up to the trailer to load it
// and you're in the truck again.
//
// Save state (created lazily):
//   s.trailers = [{ uid, id, stock? }]               trailers you own (stock:
//                                                    head on a stock trailer, core/livestock.js)
//   s.tow = { trailer, truck, car, rig, shown }
//     trailer: uid of the hitched trailer (null = nothing hitched)
//     truck:   uid of the truck it's hitched to
//     car:     uid of the car riding on it (null = empty)
//     rig:     { x, z, h, th } where the truck and trailer are parked while
//              you drive the car you unloaded (null = they're with you)
//     shown:   the last game day you rolled into a meet on the trailer
//
// DOM-free so scripts/check-data.mjs can test it.

import { TRAILERS, TRAILER_BY_ID, TRAILER_RESALE } from '../data/trailers.js';
import { CAR_BY_ID, carName } from '../data/cars.js';
import { dimsOf } from '../data/carShapes.js';

const ok = (extra = {}) => ({ ok: true, ...extra });
const err = text => ({ ok: false, text });
let n = 0;
const newUid = () => `trl_${Date.now().toString(36)}${(n++).toString(36)}`;

export function ensureTow(s) {
  s.trailers ??= [];
  s.tow ??= { trailer: null, truck: null, car: null, rig: null, shown: 0 };
  const t = s.tow;
  // tidy up anything that went missing (a sold car, a sold trailer)
  const has = uid => s.cars.some(c => c.uid === uid);
  if (t.trailer && !s.trailers.some(x => x.uid === t.trailer)) Object.assign(t, { trailer: null, truck: null, car: null, rig: null });
  if (t.truck && !has(t.truck)) Object.assign(t, { trailer: null, truck: null, car: null, rig: null });
  if (t.car && !has(t.car)) t.car = null;
  // you're driving the truck again (switched at home, sold the other car): the rig is with you
  if (t.rig && s.activeCar === t.truck) t.rig = null;
  // you're driving the car that was on the trailer: it isn't on the trailer any more
  if (t.car && s.activeCar === t.car) t.car = null;
  return t;
}

export const canPull = model => model?.cls === 'Truck';
export const carModel = (s, uid) => CAR_BY_ID[s.cars.find(c => c.uid === uid)?.modelId];
export const trailerDef = tr => tr ? TRAILER_BY_ID[tr.id] : null;
// Head of cattle or horses riding on a trailer.
export const headOnTrailer = tr => Object.values(tr?.stock || {}).reduce((a, b) => a + b, 0);
export const ownedTrailers = s => (s.trailers || []).map(t => ({ ...t, def: TRAILER_BY_ID[t.id] })).filter(t => t.def);

// The trailer hitched up right now and its definition, or null.
export function hitched(s) {
  const t = ensureTow(s);
  const tr = t.trailer && s.trailers.find(x => x.uid === t.trailer);
  return tr ? { ...tr, def: TRAILER_BY_ID[tr.id] } : null;
}

export function fits(def, model) {
  if (!def || !model) return false;
  return dimsOf(model).L <= def.maxCar + 1e-6;
}

// Cars that aren't sitting in a garage bay: the one on the trailer and the
// truck while it's parked out with the trailer.
export function awayFromGarage(s) {
  const t = ensureTow(s), out = new Set();
  if (t.car) out.add(t.car);
  if (t.rig && t.truck) out.add(t.truck);
  return out;
}

// What slows the truck down: 0 = nothing hitched.
export function towDrag(s) {
  const h = hitched(s);
  if (!h || s.tow.rig) return 0;
  return s.tow.car || headOnTrailer(h) ? h.def.loadedSlow : h.def.slow;
}

// ---------------------------------------------------------------- buying
export function buyTrailer(s, id, spend) {
  ensureTow(s);
  const def = TRAILER_BY_ID[id];
  if (!def) return err('No such trailer.');
  if (s.trailers.length >= 3) return err('You\'ve got nowhere to keep another trailer. Sell one first.');
  if (!spend(s, def.price, `Cowtown Trailer Sales: ${def.name}`)) return err(`You need ${def.price.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.`);
  const tr = { uid: newUid(), id };
  s.trailers.push(tr);
  return ok({ trailer: tr, def });
}

export const resaleOf = tr => Math.round((TRAILER_BY_ID[tr.id]?.price || 0) * TRAILER_RESALE);

export function sellTrailer(s, uid, earn) {
  const t = ensureTow(s);
  const tr = s.trailers.find(x => x.uid === uid);
  if (!tr) return err('That trailer isn\'t yours.');
  if (t.trailer === uid && t.rig) return err('That trailer is parked out with your truck. Go load up and bring it home first.');
  if (t.trailer === uid && t.car) return err('There\'s a car on that trailer. Unload it first.');
  if (headOnTrailer(tr)) return err('There\'s livestock on that trailer. Sell them at the sale barn or turn them out at your ranch first.');
  if (t.trailer === uid) Object.assign(t, { trailer: null, truck: null, car: null, rig: null });
  s.trailers = s.trailers.filter(x => x !== tr);
  const pay = resaleOf(tr);
  earn(s, pay, `Sold trailer: ${TRAILER_BY_ID[tr.id]?.name || 'trailer'}`);
  return ok({ paid: pay });
}

// ---------------------------------------------------------------- at home
export function hitch(s, uid) {
  const t = ensureTow(s);
  const tr = s.trailers.find(x => x.uid === uid);
  const truck = s.cars.find(c => c.uid === s.activeCar);
  if (!tr) return err('That trailer isn\'t yours.');
  if (!truck || truck.stolen) return err('You need a truck to pull a trailer.');
  if (!canPull(CAR_BY_ID[truck.modelId])) return err(`The ${CAR_BY_ID[truck.modelId]?.model || 'car'} can't pull a trailer. Switch to a truck.`);
  if (t.rig) return err('Your rig is still parked out. Go load up first.');
  if (t.trailer && t.trailer !== uid && t.car) return err('Unload the car off the other trailer first.');
  Object.assign(t, { trailer: uid, truck: truck.uid, car: t.trailer === uid ? t.car : null, rig: null });
  return ok({ def: TRAILER_BY_ID[tr.id] });
}

export function unhitch(s) {
  const t = ensureTow(s);
  if (!t.trailer) return err('Nothing is hitched up.');
  if (t.rig) return err('Your rig is parked out. Go load up first.');
  Object.assign(t, { trailer: null, truck: null, car: null, rig: null });
  return ok();
}

// Why a car can't go on the hitched trailer, or '' if it can.
export function loadBlock(s, uid) {
  const t = ensureTow(s), h = hitched(s);
  const car = s.cars.find(c => c.uid === uid);
  if (!h) return 'Hitch a trailer first.';
  if (h.def.kind === 'stock') return 'That\'s a stock trailer. It hauls cattle and horses, not cars.';
  if (!car) return 'That car isn\'t yours.';
  if (uid === t.truck) return 'That\'s the truck pulling it.';
  if (t.car && t.car !== uid) return 'There\'s already a car on the trailer.';
  if (car.stolen) return 'That car was stolen. The cops have to find it first.';
  if (car.impound) return 'That car is in the impound lot.';
  if (s.hustle?.rentals?.includes(uid)) return 'That car is rented out.';
  const model = CAR_BY_ID[car.modelId];
  if (!fits(h.def, model)) return `The ${model?.model || 'car'} is too long for the ${h.def.name}.`;
  return '';
}

export function loadCar(s, uid) {
  const t = ensureTow(s);
  if (s.activeCar !== t.truck) return err('Take the truck out to load up.');
  const why = loadBlock(s, uid);
  if (why) return err(why);
  t.car = uid;
  return ok({ model: carModel(s, uid) });
}

export function unloadAtHome(s) {
  const t = ensureTow(s);
  if (!t.car) return err('The trailer is empty.');
  t.car = null;
  return ok();
}

// You switched cars at home while the rig was parked out: a buddy brings the
// truck and trailer back to the house.
export function bringRigHome(s) {
  const t = ensureTow(s);
  if (!t.rig) return false;
  t.rig = null;
  return true;
}

// ---------------------------------------------------------------- out on the road
// Unload where you stopped. pos: { x, z, h } of the truck, th: trailer heading.
export function dropRig(s, pos, th) {
  const t = ensureTow(s), h = hitched(s);
  if (!h || !t.car) return err('Nothing on the trailer.');
  if (s.activeCar !== t.truck) return err('You\'re not in the truck.');
  const car = s.cars.find(c => c.uid === t.car);
  if (!car) { t.car = null; return err('Nothing on the trailer.'); }
  t.rig = { x: pos.x, z: pos.z, h: pos.h, th };
  s.activeCar = car.uid;
  t.car = null;
  return ok({ car, model: CAR_BY_ID[car.modelId], def: h.def });
}

// Load the car you're driving back on and climb into the truck.
export function pickUpRig(s) {
  const t = ensureTow(s);
  if (!t.rig) return err('Your truck isn\'t parked out.');
  const uid = s.activeCar;
  if (!uid || uid === t.truck) return err('Drive a car up to the trailer to load it.');
  const why = loadBlock(s, uid);
  if (why) return err(why);
  const rig = t.rig;
  t.car = uid;
  t.rig = null;
  s.activeCar = t.truck;
  return ok({ rig, model: carModel(s, uid) });
}

// Rolling into a meet with your car on a trailer gets you noticed, once a night.
export function meetEntrance(s, def) {
  const t = ensureTow(s);
  if (t.shown === s.time.day) return 0;
  t.shown = s.time.day;
  return def.kind === 'enclosed' ? 40 : 25;
}

export function describe(s) {
  const t = ensureTow(s), h = hitched(s);
  if (!h) return 'No trailer hitched.';
  const truck = carModel(s, t.truck), load = carModel(s, t.car), head = headOnTrailer(h);
  return `${h.def.name} on the ${truck ? carName(truck) : 'truck'}${load ? `, carrying the ${carName(load)}` : head ? `, ${head} head on board` : ', empty'}${t.rig ? ' (parked out)' : ''}.`;
}

export { TRAILERS, TRAILER_BY_ID };
