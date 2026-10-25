// Rental businesses: a Sea-Doo rental dock at a marina, and Cross Timbers
// Trail Park (data/trails.js) with rental 4-wheelers, trail horses and
// weekend trail rides. You buy in, buy the fleet, set your prices and staff
// it, and every morning yesterday's business settles into your bank:
// customers come with good weather and weekends, stay away from high prices
// and rain, and wear out (or wreck) the equipment as they go.
//
// s.outfit = { docks: { marinaId: dock }, park: park | null, earned }
// dock: { skis: [{ id, model, cond }], price, staff, today, earned, opened }
// park: { quads: [{ id, cond }], horses, price, guides, rep, ride: { day } | null, today, earned }
// DOM-free so scripts/check-data.mjs can test it.

import { spend, earnBank, fmtMoney, dayName, uid } from './state.js';
import { BOAT_BY_ID, MARINA_BY_ID } from '../data/boats.js';
import { wx } from './weather.js';

const err = text => ({ ok: false, text });
const WEEKEND = new Set(['Fri', 'Sat', 'Sun']);
export const isWeekend = s => WEEKEND.has(dayName(s.time));

// ---------------------------------------------------------------- Sea-Doo rentals
export const DOCK_LEASE = 25000;         // to set up a rental dock at a marina
export const DOCK_RENT = 120;            // a day, to the marina
export const SKI_MODELS = ['spark_trixx', 'rxpx_325', 'waverunner_fx', 'ultra_310lx'];   // jet skis from data/boats.js
export const MAX_SKIS = 12;
export const SKIS_PER_HAND = 4;          // one dock hand keeps four skis moving
export const DOCK_HAND = 150;            // a day
export const SKI_INSURE = 6;             // a ski a day
export const SKI_FUEL = 14;              // an hour it's out
// $/hour at each price level, and how much it changes demand
export const SKI_PRICES = { low: { rate: 79, pull: 1.25, name: 'Low ($79/hr)' }, fair: { rate: 109, pull: 1, name: 'Fair ($109/hr)' }, high: { rate: 149, pull: 0.7, name: 'High ($149/hr)' } };
// how busy the lake is
export const LAKE_PULL = { marina_lewisville: 1.25, marina_harbor: 1.1, marina_eagle: 1, marina_granbury: 1, marina_pk: 0.9, marina_whitney: 0.8, marina_rayroberts: 0.7, marina_miami: 1.4 };

// ---------------------------------------------------------------- the trail park
export const PARK_PRICE = 240000;
export const PARK_RESALE = 0.6;
export const QUAD_MODEL = 'polaris_sportsman_570_2021';
export const QUAD_PRICE = 8000;
export const MAX_QUADS = 20;
export const HORSE_PRICE = 3500;
export const MAX_HORSES = 12;
export const HORSE_FEED = 12;            // a horse a day
export const QUADS_PER_GUIDE = 5;
export const GUIDE = 150;                // a day
export const PARK_UPKEEP = 220;          // insurance, the office, the gate, mowing
// a ride on a rental quad / a guided horseback ride
export const PARK_PRICES = { low: { quad: 60, horse: 45, pull: 1.25, name: 'Low ($60 quad · $45 horse)' }, fair: { quad: 85, horse: 55, pull: 1, name: 'Fair ($85 quad · $55 horse)' }, high: { quad: 120, horse: 75, pull: 0.7, name: 'High ($120 quad · $75 horse)' } };
// a Saturday trail ride: DJ, food trucks, security, the arena lights
export const RIDE_COST = 8000;
export const RIDE_GATE = 25;             // a head
export const RIDE_VENDORS = 1800;        // the vendors' booth fees

export function ensureOutfit(s) {
  s.outfit ??= {};
  const o = s.outfit;
  o.docks ??= {};
  o.park ??= null;
  o.earned ??= 0;
  return o;
}
const dockOf = (s, id) => ensureOutfit(s).docks[id] || null;
export const myDocks = s => Object.keys(ensureOutfit(s).docks).filter(id => MARINA_BY_ID[id]);
export const hasDock = (s, id) => !!dockOf(s, id);
export const ownsPark = s => !!ensureOutfit(s).park;

// how the weather sends people out (or home)
export function weatherPull(s) { const w = s.weather || 'clear'; return w === 'storm' ? 0 : w === 'rain' ? 0.25 : w === 'fog' ? 0.6 : w === 'cloudy' ? 0.85 : 1; }

export function openDock(s, marinaId) {
  if (!MARINA_BY_ID[marinaId]) return err('No marina there.');
  if (hasDock(s, marinaId)) return err('You already run the rental dock here.');
  if (!spend(s, DOCK_LEASE, `Sea-Doo rentals: dock lease at ${MARINA_BY_ID[marinaId].name}`)) return err(`The lease is ${fmtMoney(DOCK_LEASE)}. You're short.`);
  ensureOutfit(s).docks[marinaId] = { skis: [], price: 'fair', staff: 0, today: null, earned: 0, opened: s.time.day };
  return { ok: true, text: `You've got a rental dock at ${MARINA_BY_ID[marinaId].name}. Buy some skis and hire a dock hand.` };
}

export function buySki(s, marinaId, model) {
  const d = dockOf(s, marinaId), def = BOAT_BY_ID[model];
  if (!d) return err('Lease a dock first.');
  if (!def || !SKI_MODELS.includes(model)) return err('That\'s not a jet ski.');
  if (d.skis.length >= MAX_SKIS) return err(`The dock holds ${MAX_SKIS} skis.`);
  if (!spend(s, def.price, `Sea-Doo rentals: ${def.name}`)) return err(`It's ${fmtMoney(def.price)}. You're short.`);
  d.skis.push({ id: uid('ski'), model, cond: 100 });
  return { ok: true, text: `${def.name} is on the dock.` };
}

export function sellSki(s, marinaId, skiId) {
  const d = dockOf(s, marinaId), k = d?.skis.find(x => x.id === skiId);
  if (!k) return err('No such ski.');
  const pay = Math.round(BOAT_BY_ID[k.model].price * 0.45 * (0.4 + 0.6 * k.cond / 100));
  d.skis = d.skis.filter(x => x !== k);
  earnBank(s, pay, `Sea-Doo rentals: sold a ${BOAT_BY_ID[k.model].name}`);
  return { ok: true, pay };
}

export const skiServiceCost = d => Math.round(d.skis.reduce((t, k) => t + (100 - k.cond) * BOAT_BY_ID[k.model].price * 0.0015, 0) / 10) * 10;
export function serviceSkis(s, marinaId) {
  const d = dockOf(s, marinaId);
  if (!d) return err('No dock.');
  const cost = skiServiceCost(d);
  if (!cost) return err('Every ski is good to go.');
  if (!spend(s, cost, 'Sea-Doo rentals: service')) return err(`Service is ${fmtMoney(cost)}. You're short.`);
  for (const k of d.skis) k.cond = 100;
  return { ok: true, cost };
}

export function setDock(s, marinaId, { price, staff }) {
  const d = dockOf(s, marinaId);
  if (!d) return err('No dock.');
  if (price && SKI_PRICES[price]) d.price = price;
  if (staff != null) d.staff = Math.max(0, Math.min(Math.ceil(MAX_SKIS / SKIS_PER_HAND), staff | 0));
  return { ok: true };
}

export function closeDock(s, marinaId) {
  const d = dockOf(s, marinaId);
  if (!d) return err('No dock.');
  let pay = Math.round(DOCK_LEASE * 0.4);
  for (const k of d.skis) pay += Math.round(BOAT_BY_ID[k.model].price * 0.45 * (0.4 + 0.6 * k.cond / 100));
  delete ensureOutfit(s).docks[marinaId];
  earnBank(s, pay, `Sea-Doo rentals: closed the ${MARINA_BY_ID[marinaId].name} dock`);
  return { ok: true, pay };
}

// One day at one dock. rng for tests.
export function dockDay(s, marinaId, rng = Math.random) {
  const d = dockOf(s, marinaId);
  const P = SKI_PRICES[d.price] || SKI_PRICES.fair;
  const ready = d.skis.filter(k => k.cond > 30);
  const handsNeeded = Math.ceil(ready.length / SKIS_PER_HAND);
  const staffed = ready.length ? Math.min(1, d.staff / Math.max(1, handsNeeded)) : 0;
  const base = isWeekend(s) ? 7 : 4;                       // hours a ski rents out on a good day
  let hours = 0, gross = 0, fuel = 0;
  const wrecks = [];
  for (const k of ready) {
    const h = Math.max(0, Math.min(10, base * weatherPull(s) * P.pull * (LAKE_PULL[marinaId] || 1) * staffed * (0.75 + rng() * 0.5)));
    const hh = Math.round(h * 2) / 2;
    hours += hh; gross += hh * P.rate; fuel += hh * SKI_FUEL;
    k.cond = Math.max(0, k.cond - hh * (0.6 + rng() * 0.5));
    if (hh > 0 && rng() < 0.012 * hh / 4) { k.cond = Math.min(k.cond, 25); wrecks.push(BOAT_BY_ID[k.model].name); }
  }
  const costs = DOCK_RENT + d.staff * DOCK_HAND + d.skis.length * SKI_INSURE + fuel;
  const net = Math.round(gross - costs);
  d.today = { hours, gross: Math.round(gross), costs: Math.round(costs), net, wrecks, idle: d.skis.length - ready.length };
  d.earned += net;
  return d.today;
}

// ---------------------------------------------------------------- the park
export function buyPark(s) {
  const o = ensureOutfit(s);
  if (o.park) return err('The park is already yours.');
  if (!spend(s, PARK_PRICE, 'Bought Cross Timbers Trail Park')) return err(`The park is ${fmtMoney(PARK_PRICE)}. You're short.`);
  o.park = { quads: [], horses: 0, price: 'fair', guides: 0, rep: 20, ride: null, today: null, earned: 0, since: s.time.day };
  return { ok: true, text: 'Cross Timbers Trail Park is yours. Stock the rental barn and hire some guides.' };
}

export function sellPark(s) {
  const o = ensureOutfit(s), p = o.park;
  if (!p) return err('You don\'t own the park.');
  const pay = Math.round(PARK_PRICE * PARK_RESALE + p.quads.reduce((t, q) => t + QUAD_PRICE * 0.4 * (0.4 + 0.6 * q.cond / 100), 0) + p.horses * HORSE_PRICE * 0.6);
  o.park = null;
  earnBank(s, pay, 'Sold Cross Timbers Trail Park');
  return { ok: true, pay };
}

export function buyQuads(s, n = 1) {
  const p = ensureOutfit(s).park;
  if (!p) return err('Buy the park first.');
  n = Math.min(n, MAX_QUADS - p.quads.length);
  if (n <= 0) return err(`The barn holds ${MAX_QUADS} quads.`);
  if (!spend(s, QUAD_PRICE * n, `Trail park: ${n} rental quad${n > 1 ? 's' : ''}`)) return err(`That's ${fmtMoney(QUAD_PRICE * n)}. You're short.`);
  for (let i = 0; i < n; i++) p.quads.push({ id: uid('quad'), cond: 100 });
  return { ok: true, n };
}

export function buyHorses(s, n = 1) {
  const p = ensureOutfit(s).park;
  if (!p) return err('Buy the park first.');
  n = Math.min(n, MAX_HORSES - p.horses);
  if (n <= 0) return err(`The pens hold ${MAX_HORSES} trail horses.`);
  if (!spend(s, HORSE_PRICE * n, `Trail park: ${n} trail horse${n > 1 ? 's' : ''}`)) return err(`That's ${fmtMoney(HORSE_PRICE * n)}. You're short.`);
  p.horses += n;
  return { ok: true, n };
}

export const quadServiceCost = p => Math.round(p.quads.reduce((t, q) => t + (100 - q.cond) * QUAD_PRICE * 0.0018, 0) / 10) * 10;
export function serviceQuads(s) {
  const p = ensureOutfit(s).park;
  if (!p) return err('No park.');
  const cost = quadServiceCost(p);
  if (!cost) return err('The whole fleet runs fine.');
  if (!spend(s, cost, 'Trail park: quad service')) return err(`Service is ${fmtMoney(cost)}. You're short.`);
  for (const q of p.quads) q.cond = 100;
  return { ok: true, cost };
}

export function setPark(s, { price, guides }) {
  const p = ensureOutfit(s).park;
  if (!p) return err('No park.');
  if (price && PARK_PRICES[price]) p.price = price;
  if (guides != null) p.guides = Math.max(0, Math.min(Math.ceil(MAX_QUADS / QUADS_PER_GUIDE) + 2, guides | 0));
  return { ok: true };
}

// Book the trail ride for the coming Saturday (or today, if it's Saturday morning).
export function bookTrailRide(s) {
  const p = ensureOutfit(s).park;
  if (!p) return err('Buy the park first.');
  if (p.ride) return err('A trail ride is already on the books.');
  const toSat = (5 - ((s.time.day - 1) % 7) + 7) % 7;
  if (!spend(s, RIDE_COST, 'Trail park: trail ride (DJ, vendors, security)')) return err(`Putting one on runs ${fmtMoney(RIDE_COST)}. You're short.`);
  p.ride = { day: s.time.day + toSat };
  return { ok: true, day: p.ride.day, text: toSat ? `Trail ride is on for Saturday (day ${p.ride.day}).` : 'Trail ride is on for today.' };
}

// One day at the park. Rides are counted the night they happen.
export function parkDay(s, rng = Math.random) {
  const p = ensureOutfit(s).park;
  const P = PARK_PRICES[p.price] || PARK_PRICES.fair;
  const ready = p.quads.filter(q => q.cond > 30);
  const pull = weatherPull(s) * P.pull * (0.7 + p.rep / 100) * (0.8 + rng() * 0.4);
  const crowd = (isWeekend(s) ? 34 : 12) * pull;
  const guidesNeeded = Math.ceil(ready.length / QUADS_PER_GUIDE) + (p.horses ? 1 : 0);
  const staffed = guidesNeeded ? Math.min(1, p.guides / guidesNeeded) : 0;
  const quadRides = Math.round(Math.min(crowd * 0.7, ready.length * 4) * staffed);
  const horseRides = Math.round(Math.min(crowd * 0.35, p.horses * 3) * staffed);
  let gross = quadRides * P.quad + horseRides * P.horse;
  const notes = [];
  // the rental quads take a beating, and now and then somebody rolls one
  for (const q of ready) {
    const uses = ready.length ? quadRides / ready.length : 0;
    q.cond = Math.max(0, q.cond - uses * (1.2 + rng() * 0.8));
    if (uses > 0 && rng() < 0.006 * uses) { q.cond = Math.min(q.cond, 20); notes.push('a renter rolled a quad in the creek bottom'); }
  }
  // the trail ride
  let ride = null;
  if (p.ride && p.ride.day <= s.time.day) {
    if (p.ride.day === s.time.day) {
      const heads = Math.round((150 + p.rep * 4.5) * (s.weather === 'storm' ? 0.15 : s.weather === 'rain' ? 0.45 : 1) * (0.8 + rng() * 0.4));
      const take = heads * RIDE_GATE + RIDE_VENDORS;
      gross += take;
      p.rep = Math.min(100, p.rep + (heads > 300 ? 8 : heads > 150 ? 5 : 1));
      ride = { heads, take };
    }
    p.ride = null;
  }
  const costs = p.guides * GUIDE + p.horses * HORSE_FEED + PARK_UPKEEP + p.quads.length * 5;
  const net = Math.round(gross - costs);
  // the park's name gets around (or goes stale)
  p.rep = Math.max(5, Math.min(100, p.rep + (quadRides + horseRides > 20 ? 0.4 : -0.2)));
  p.today = { quadRides, horseRides, gross: Math.round(gross), costs: Math.round(costs), net, ride, notes };
  p.earned += net;
  return p.today;
}

// Every morning: settle every dock and the park into the bank.
export function outfitDay(s, rng = Math.random) {
  const o = ensureOutfit(s), notes = [];
  let net = 0;
  const docks = myDocks(s);
  if (docks.length) {
    let hours = 0, dn = 0;
    const wrecks = [];
    for (const id of docks) { const t = dockDay(s, id, rng); hours += t.hours; dn += t.net; wrecks.push(...t.wrecks); }
    net += dn;
    notes.push(`🌊 Sea-Doo rentals: ${hours} hours on the water, ${dn >= 0 ? 'made' : 'lost'} ${fmtMoney(Math.abs(dn))}.${wrecks.length ? ` A renter beached a ${wrecks[0]}.` : ''}`);
  }
  if (o.park) {
    const t = parkDay(s, rng);
    net += t.net;
    notes.push(t.ride ? `🤠 Trail ride at Cross Timbers: ${t.ride.heads} riders came out. The park ${t.net >= 0 ? 'made' : 'lost'} ${fmtMoney(Math.abs(t.net))}.`
      : `🏁 Trail park: ${t.quadRides} quad rides, ${t.horseRides} horseback, ${t.net >= 0 ? 'made' : 'lost'} ${fmtMoney(Math.abs(t.net))}.${t.notes.length ? ` (${t.notes[0]})` : ''}`);
  }
  if (net > 0) earnBank(s, net, 'Rental businesses: yesterday\'s take, less staff and upkeep');
  else if (net < 0) spend(s, -net, 'Rental businesses: staff and upkeep') || earnBank(s, net, 'Rental businesses: upkeep (overdrawn)');
  o.earned += net;
  return { notes, net };
}
