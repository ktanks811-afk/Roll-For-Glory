// The chop shop. Bring a stolen car to Marchetti Salvage (Sal's nephew
// Junior) and strip it: catalytic converter, wheels, airbags, the engine.
// The parts go on your shelf at the shop and Junior buys them off you. A
// whole car to Sal pays 30% of its value; stripped all the way down it's
// closer to half, but it takes hours and every car you bring makes the shop
// hotter. When the shop is hot (or you pull in with the cops already on
// you), the Tarrant Regional Auto Crimes Task Force sweeps it: whatever's on
// the shelf goes into evidence and the gate gets padlocked for a few days.
//
// DOM-free so check-data can test it. The panel is ui/chop.js.

import { carValue, earn } from './state.js';
import { CAR_BY_ID, carName } from '../data/cars.js';

export const CHOP_LOC = 'marchetti_salvage';

// share: of what the car is worth. cond: the condition that scales it.
// Quick parts come off in minutes; the rest is a real teardown.
export const CHOP_PARTS = [
  { id: 'cat',      name: 'Catalytic converter',        mins: 15, share: 0,     quick: true },
  { id: 'wheels',   name: 'Wheels and tires',           mins: 20, share: 0.06,  quick: true, cond: 'tires' },
  { id: 'airbags',  name: 'Airbags',                    mins: 20, share: 0.035, quick: true },
  { id: 'stereo',   name: 'Head unit and electronics',  mins: 10, share: 0.025, quick: true },
  { id: 'lights',   name: 'Headlights and taillights',  mins: 15, share: 0.03,  quick: true, cond: 'lights' },
  { id: 'interior', name: 'Seats and interior',         mins: 30, share: 0.04 },
  { id: 'doors',    name: 'Doors, hood and fenders',    mins: 45, share: 0.08,  cond: 'body' },
  { id: 'trans',    name: 'Transmission',               mins: 60, share: 0.08,  cond: 'trans' },
  { id: 'engine',   name: 'Engine',                     mins: 90, share: 0.15,  cond: 'engine' },
];
export const PART_BY_ID = Object.fromEntries(CHOP_PARTS.map(p => [p.id, p]));

// The cars that get stolen most in Texas: their parts move fast.
export const MOVERS = ['honda', 'toyota', 'chevrolet', 'ford', 'nissan', 'dodge', 'gmc', 'ram', 'hyundai', 'kia'];
export const WANTED_BONUS = 1.4;     // Junior's buyers want these makes today
export const CLOSED_DAYS = 4;        // padlocked after a sweep

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round10 = v => Math.round(v / 10) * 10;

export function ensureChop(s) {
  s.chop ??= {};
  const c = s.chop;
  c.heat ??= 0;          // 0..100: how much attention the shop is getting
  c.shelf ??= [];        // { uid, part, make, car, base }
  c.closed ??= 0;        // padlocked until this day
  c.chopped ??= 0;
  c.earned ??= 0;
  c.wanted ??= null;     // { day, makes }
  return c;
}

export const isClosed = s => ensureChop(s).closed > s.time.day;

// Two makes Junior's buyers are asking for today.
export function wantedToday(s, rng = Math.random) {
  const c = ensureChop(s);
  if (c.wanted?.day !== s.time.day) {
    const a = MOVERS[Math.floor(rng() * MOVERS.length)];
    let b = a;
    while (b === a) b = MOVERS[Math.floor(rng() * MOVERS.length)];
    c.wanted = { day: s.time.day, makes: [a, b] };
  }
  return c.wanted.makes;
}

// Exotics have VINs stamped on everything and nobody local buys the parts.
export function isExotic(m) { return m.msrp >= 150000 || m.cls === 'Exotic' || m.cls === 'Supercar'; }

// What one part off this car is worth, before today's demand.
export function partBase(car, partId) {
  const m = CAR_BY_ID[car.modelId], p = PART_BY_ID[partId];
  if (!m || !p) return 0;
  const ev = m.asp === 'ev';
  if (partId === 'cat') {
    if (ev) return 0;      // no exhaust, no converter
    // the precious metals: trucks and SUVs carry more of them
    const big = m.body === 'truck' || m.body === 'suv';
    return round10((big ? 520 : 320) * (car.year < 2005 ? 0.75 : 1));
  }
  const cond = p.cond ? clamp((car.cond?.[p.cond] ?? 80) / 100, 0.25, 1) : 1;
  let share = p.share;
  if (ev && partId === 'engine') share = 0.2;   // battery pack and motor
  const make = MOVERS.includes(m.make) ? 1.15 : 1;
  const hot = isExotic(m) ? 0.55 : 1;
  return Math.max(40, round10(carValue(car) * share * cond * make * hot));
}

export function partName(partId, car) {
  const m = car && CAR_BY_ID[car.modelId];
  if (partId === 'engine' && m?.asp === 'ev') return 'Battery pack and motor';
  return PART_BY_ID[partId]?.name || partId;
}

// What Junior pays today for a part on the shelf.
export function partPrice(s, item) {
  return round10(item.base * (wantedToday(s).includes(item.make) ? WANTED_BONUS : 1));
}

// The parts list for a car, with today's prices. quick: just the fast stuff.
export function stripPlan(s, car, quick = false) {
  const m = CAR_BY_ID[car.modelId];
  const parts = CHOP_PARTS.filter(p => (!quick || p.quick) && partBase(car, p.id) > 0).map(p => {
    const base = partBase(car, p.id);
    return { id: p.id, name: partName(p.id, car), mins: p.mins, base, price: partPrice(s, { base, make: m.make }) };
  });
  return { parts, mins: parts.reduce((t, p) => t + p.mins, 0), total: parts.reduce((t, p) => t + p.price, 0) };
}

// How much heat a car brings into the shop.
export function carHeat(car, policeLevel = 0) {
  const h = car.hot || {}, m = CAR_BY_ID[car.modelId];
  let n = 10;
  if (h.reported) n += 8;
  if (h.kind === 'carjack') n += h.armed ? 10 : 5;
  if (m && isExotic(m)) n += 12;
  if (policeLevel >= 2) n += policeLevel * 5;   // they followed you in
  return n;
}

// Odds the task force hits the shop while you're in there working on a car.
// Scales with how long the job takes: an hour is a quarter of a full teardown.
export function sweepChance(s, policeLevel = 0, mins = 240) {
  const c = ensureChop(s);
  const shop = clamp((c.heat - 30) / 100, 0, 0.6) * 0.5;
  const cops = Math.max(0, policeLevel - 1) * 0.08;
  return clamp((shop + cops) * clamp(mins / 240, 0.25, 1.2), 0, 0.6);
}

// Odds of a sweep on a day you're not there.
export const dailySweepChance = s => clamp((ensureChop(s).heat - 45) / 110, 0, 0.5);

export function heatLabel(s) {
  const h = ensureChop(s).heat;
  return h < 20 ? ['Quiet', 'good'] : h < 45 ? ['Warm', 'warn'] : h < 70 ? ['Hot', 'bad'] : ['Burning', 'bad'];
}

// Strip the car: the parts go on your shelf. Returns what came off.
export function strip(s, car, { quick = false, policeLevel = 0 } = {}) {
  const c = ensureChop(s), m = CAR_BY_ID[car.modelId];
  const plan = stripPlan(s, car, quick);
  const title = carName(m, car.year);
  for (const p of plan.parts) c.shelf.push({ uid: Math.random().toString(36).slice(2), part: p.id, name: p.name, make: m.make, car: title, base: p.base });
  c.heat = clamp(c.heat + carHeat(car, policeLevel) * (quick ? 0.6 : 1), 0, 100);
  c.chopped++;
  s.stats.carsChopped = (s.stats.carsChopped || 0) + 1;
  return plan;
}

// Sell parts off the shelf to Junior. uids: which ones (all if omitted).
export function sellParts(s, uids = null) {
  const c = ensureChop(s);
  const sell = c.shelf.filter(i => !uids || uids.includes(i.uid));
  if (!sell.length) return 0;
  const pay = sell.reduce((t, i) => t + partPrice(s, i), 0);
  c.shelf = c.shelf.filter(i => !sell.includes(i));
  c.earned += pay;
  earn(s, pay, sell.length === 1 ? `Junior: ${sell[0].name}` : `Junior: ${sell.length} parts`, { dirty: true });
  return pay;
}

export const shelfValue = s => ensureChop(s).shelf.reduce((t, i) => t + partPrice(s, i), 0);

// The task force hits the shop: the shelf goes into evidence, the gate is
// padlocked. Returns what they took.
export function sweep(s) {
  const c = ensureChop(s);
  const took = { parts: c.shelf.length, value: shelfValue(s) };
  c.shelf = [];
  c.closed = s.time.day + CLOSED_DAYS;
  c.heat = 15;
  c.swept = (c.swept || 0) + 1;
  return took;
}

// Once a game day: the heat cools off, or the shop gets swept with nobody
// there. talked: Junior gave them your name (only if your parts were on the shelf).
export function chopDay(s, rng = Math.random) {
  const c = ensureChop(s);
  if (isClosed(s)) return null;
  const hit = c.heat > 0 && rng() < dailySweepChance(s);
  if (hit) {
    const took = sweep(s);
    return { swept: true, took, talked: took.parts > 0 && rng() < 0.5 };
  }
  c.heat = Math.max(0, Math.round((c.heat * 0.85 - 3) * 10) / 10);
  return null;
}

// What you're charged with if they catch you in the shop.
export const CHOP_CHARGE = { kind: 'chop', text: 'Operating a chop shop: dismantling a stolen vehicle.', fine: 4000 };
export const PARTS_CHARGE = { kind: 'chop', text: 'Theft: stolen vehicle parts found at Marchetti Salvage.', fine: 2500 };
