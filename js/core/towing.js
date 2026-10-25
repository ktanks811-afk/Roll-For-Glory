// Hook & Haul Towing (the Tow app on your phone). A truck comes out, hooks
// your car wherever it sits (broken down, wrecked, or just left at a scene)
// and hauls it to the mechanic you pick. You ride along. The shop writes up
// a damage report, you choose what to fix, and then the truck can haul it on
// to one of your properties, or you drive it off the lot yourself.
//
// Save state: s.towJob = { shop, day, min } while your car sits at a shop
// waiting on the report (so the Tow app picks up where you left off).
//
// DOM-free so scripts/check-data.mjs can test it.

import { repairCosts, REPAIR_NAMES } from './repairs.js';
import { BREAKDOWNS, needsOil, oilChangeCost, changeOil, clearBreakdown } from './upkeep.js';
import { resetEngineWarnings } from '../sim/engine.js';
import { driveMinutes } from './travel.js';

export const TOW_HOOK = 85;        // hook-up fee ($)
export const TOW_PER_KM = 6;       // plus this per km of road
export const TOW_WAIT = 10;        // game minutes before the truck shows up, at least
export const OFF_LOT = 80;         // walk further than this from the shop and the job is done

// What a tow over `meters` of road costs, and how long it takes (the truck
// driving out to you, `pickup` metres, then hauling slower than you'd drive).
export function towQuote(meters, pickup = 0) {
  const km = meters / 1000;
  return {
    fee: Math.round(TOW_HOOK + km * TOW_PER_KM),
    minutes: Math.round(TOW_WAIT + driveMinutes(pickup) * 0.25 + driveMinutes(meters) * 0.6),
    km,
  };
}

// Why the truck won't come, or null.
// ctx: { car (the car to tow), policePhase, hot (driving a stolen car), racing, riding }
export function towBlock(s, ctx = {}) {
  const car = ctx.car;
  if (!car) return 'You don\'t have a car out to tow.';
  if (car.impound) return 'Your car is in the police impound lot. Sign it out at the Central Precinct.';
  if (car.stolen) return 'That car was stolen. The cops have to find it first.';
  if (ctx.policePhase && ctx.policePhase !== 'none') return 'Not with the cops on you. Lose them first.';
  if (ctx.hot) return 'You\'re in a stolen car. Ditch it first.';
  if (ctx.racing) return 'Finish the race first.';
  if (ctx.riding) return 'You\'re riding with someone. Get out first.';
  return null;
}

// How bad a part is, in the words a service writer would use.
export function severity(pct) {
  return pct >= 97 ? 'Good' : pct >= 75 ? 'Worn' : pct >= 45 ? 'Damaged' : pct >= 15 ? 'Bad' : 'Wrecked';
}

// Hours of shop time per job (the clock moves on while they work).
const LABOR = { body: 1.5, lights: 0.25, tires: 0.5, engine: 1.5, trans: 2, oil: 0.25 };
const REBUILD = 4;   // hours for a blown motor

// The shop's damage report on `car`: every part with its condition, what's
// wrong, what it costs at this shop (`rate`), and whether they'd recommend it.
// insured: Cowtown Mutual pays 70% of repairs (not oil changes).
export function damageReport(car, { rate = 1, insured = false } = {}) {
  const costs = repairCosts(car, rate), ins = insured ? 0.3 : 1;
  const items = Object.entries(costs).map(([k, cost]) => {
    const pct = Math.round(car.cond[k]);
    let note = severity(pct);
    if (k === 'engine' && car.engineBlown) note = 'Blown: spun a bearing, needs a full rebuild';
    else if (k === 'engine' && car.broken && car.broken !== 'trans') note = `${BREAKDOWNS[car.broken]?.name || 'Broken down'}${pct < 97 ? `, ${note.toLowerCase()}` : ''}`;
    else if (k === 'trans' && car.broken === 'trans') note = `${BREAKDOWNS.trans?.name || 'Transmission failure'}`;
    const must = (k === 'engine' && (car.engineBlown || (car.broken && car.broken !== 'trans' && pct < 30))) || (k === 'trans' && car.broken === 'trans' && pct < 22);
    return { k, name: k === 'engine' && car.engineBlown ? 'Engine rebuild' : REPAIR_NAMES[k], pct, note, cost: Math.round(cost * ins), must, recommend: cost > 0 && (must || pct < 75), hours: k === 'engine' && car.engineBlown ? REBUILD : LABOR[k] };
  }).filter(it => it.cost > 0 || it.must);
  if (needsOil(car) && (car.oil ?? 100) < 99) {
    const pct = Math.round(car.oil ?? 100), cost = Math.round(oilChangeCost(car) * rate * 100) / 100;
    items.push({ k: 'oil', name: 'Oil change', pct, note: pct < 20 ? 'Overdue' : pct < 45 ? 'Due soon' : 'Fine for now', cost, must: !!car.broken && car.broken !== 'trans' && pct <= 10, recommend: pct < 45 || (car.broken && car.broken !== 'trans'), hours: LABOR.oil });
  }
  const drivable = !car.engineBlown && !car.broken && (car.cond.engine ?? 100) > 0;
  return { items, drivable, total: items.reduce((a, it) => a + it.cost, 0) };
}

// Fix the chosen parts (keys from the report). Returns the hours the shop took.
export function applyRepairs(car, keys) {
  let hours = 0;
  for (const k of keys) {
    if (k === 'oil') { changeOil(car); hours += LABOR.oil; continue; }
    if (!(k in car.cond)) continue;
    hours += k === 'engine' && car.engineBlown ? REBUILD : LABOR[k];
    car.cond[k] = 100;
    if (k === 'engine' && car.engineBlown) { car.engineBlown = false; resetEngineWarnings(car); }
  }
  clearBreakdown(car);   // a breakdown clears once whatever caused it is fixed
  return hours;
}
