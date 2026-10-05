// Real estate: buy and sell houses and trap houses, buy empty land and build
// your own house and garage on it. A finished build becomes a property like
// any other (a home, a safehouse, garage space): it is registered in
// PROPERTIES at runtime and the map puts the building up (world2d/estate.js).
// DOM-free so check-data can test it.

import { spend, earn, earnBank, fmtMoney, tierOf } from './state.js';
import { PROPERTIES, LOC_BY_ID } from '../data/world.js';
import { LAND, PLANS, PLAN_BY_ID, TRAPS, RIGS, RIG_PAY, RIG_SELL, FENCES, FENCE_BY_ID, ANIMAL_BY_ID } from '../data/estate.js';
import { ensureDrugs, trapState, units } from './drugs.js';
import { fromPreset, sanitize, cost as designCost, stories, comfort, check as checkDesign, cloneDesign } from './homes.js';

const err = text => ({ ok: false, text });
const STARTER = 'eastgate_studio';
export const SELL_RATE = 0.8;        // what a house sells for, of what you paid
export const LAND_SELL = 0.7;        // land and whatever you built on it
export const now = s => s.time.day * 1440 + s.time.min;

export function landState(s, id) {
  ensureDrugs(s);
  return s.estate.land[id] ??= { plan: null, ready: 0 };
}
export const ownsLand = (s, id) => !!s.estate?.land?.[id]?.owned;
export const isBuilt = (s, id) => { const l = s.estate?.land?.[id]; return !!(l?.owned && l.plan && l.ready <= now(s)); };
export const building = (s, id) => { const l = s.estate?.land?.[id]; return !!(l?.owned && l.plan && l.ready > now(s)); };

// The house on a piece of land: the one you designed, or the one that came
// with the garage you built (old saves).
export function houseDesign(s, id) {
  const l = s.estate?.land?.[id];
  if (!l?.plan) return null;
  if (l.design && !l.designOk) { l.design = sanitize(l.design); l.designOk = true; }
  return l.design || fromPreset(PLAN_BY_ID[l.plan]?.house || 'starter');
}
const STOREY = ['House', 'Ranch House', 'Two-Story', 'Three-Story'];

// The property entry a finished build adds (garage size, colours for the map).
export function builtProperty(landId, planId, design = fromPreset(PLAN_BY_ID[planId].house)) {
  const L = LAND[landId], P = PLAN_BY_ID[planId], n = stories(design);
  return { name: `${L.short || L.name} ${STOREY[n] || 'House'}`, price: L.price + P.price + designCost(design), slots: P.slots,
    desc: `${n}-story house and a ${P.name}.`, wall: P.wall, roof: P.roof, style: P.style, wallH: P.wallH, land: true, plan: planId, stories: n, comfort: comfort(design) };
}

// Puts this career's finished builds into PROPERTIES (and takes out another
// career's). Call after loading and whenever a build finishes.
export function registerBuilds(s) {
  for (const id of Object.keys(LAND)) {
    const loc = LOC_BY_ID[id];
    if (isBuilt(s, id)) {
      PROPERTIES[id] = builtProperty(id, s.estate.land[id].plan, houseDesign(s, id));
      if (!s.properties.includes(id)) s.properties.push(id);
      if (loc) Object.assign(loc, { name: PROPERTIES[id].name, icon: 'home', color: '#ffffff' });   // the map pin is a house now
    } else {
      if (loc) Object.assign(loc, { name: LAND[id].name, icon: 'key', color: '#c8a46a' });
      delete PROPERTIES[id];
      s.properties = s.properties.filter(x => x !== id);
      if (s.home === id) s.home = STARTER;
    }
  }
}

// Builds that just finished: [landId]. Registers them.
export function finishBuilds(s) {
  const done = [];
  for (const id of Object.keys(LAND)) {
    const l = s.estate?.land?.[id];
    if (l?.owned && l.plan && !l.done && l.ready <= now(s)) { l.done = true; done.push(id); }
  }
  if (done.length) registerBuilds(s);
  return done;
}

// ---------------------------------------------------------------- houses + trap houses
function capacityWithout(s, id) {
  return s.properties.filter(x => x !== id).reduce((n, x) => n + (PROPERTIES[x]?.slots || 0), 0);
}

export function buyProperty(s, id) {
  const p = PROPERTIES[id];
  if (!p || p.land) return err('That\'s not for sale.');
  if (s.properties.includes(id)) return err('You already own it.');
  if (p.tier && tierOf(s.rep).n < p.tier) return err(`Priya won't show it to you yet (tier ${p.tier}).`);
  if (!spend(s, p.price, `Bought ${p.name}`)) return err('Not enough money.');
  s.properties.push(id);
  if (!p.trap) s.home = id;
  else trapState(s, id);
  return { ok: true, text: p.trap ? `${p.name} is yours. Stock the stash and customers will start knocking.` : `${p.name} is yours.` };
}

export function sellProperty(s, id) {
  const p = PROPERTIES[id];
  if (!p || !s.properties.includes(id) || id === STARTER) return err('You can\'t sell that.');
  if (p.land) return sellLand(s, id);
  if (s.cars.length > capacityWithout(s, id)) return err(`Your cars wouldn't fit anywhere else. Sell a car or buy more garage space first.`);
  const value = Math.round(p.price * SELL_RATE);
  if (p.trap) {
    const t = trapState(s, id), bag = ensureDrugs(s).bag;
    for (const [k, q] of Object.entries(t.stash)) bag[k] = (bag[k] || 0) + q;
    if (t.safe) earn(s, t.safe, `${p.name}: emptied the safe`, { dirty: true });
    delete s.estate.traps[id];
  }
  s.properties = s.properties.filter(x => x !== id);
  if (s.home === id) s.home = STARTER;
  earnBank(s, value, `Sold ${p.name}`);
  return { ok: true, text: `Sold for ${fmtMoney(value)}.`, value };
}

// ---------------------------------------------------------------- land
export function buyLand(s, id) {
  const L = LAND[id];
  if (!L) return err('That\'s not for sale.');
  if (ownsLand(s, id)) return err('You already own it.');
  if (L.tier && tierOf(s.rep).n < L.tier) return err(`Needs tier ${L.tier}.`);
  if (!spend(s, L.price, `Bought ${L.name}`)) return err('Not enough money.');
  Object.assign(landState(s, id), { owned: true, plan: null, ready: 0, done: false });
  return { ok: true, text: `${L.name} is yours. Pick what to build on it.` };
}

// Start (or upgrade to) a build. An upgrade knocks down what's there and you
// get 30% of the old build back as credit.
// The first build puts up the garage and the house together; after that a
// bigger garage replaces the old one and the house stays as it is.
export const buildCost = (s, id, planId, design = null) => {
  const l = s.estate?.land?.[id], P = PLAN_BY_ID[planId];
  const credit = l?.plan && l.done ? Math.round(PLAN_BY_ID[l.plan].price * 0.3) : 0;
  const house = l?.plan ? 0 : designCost(design || fromPreset(P.house));
  return Math.max(0, P.price - credit) + house;
};
export function build(s, id, planId, design = null) {
  const P = PLAN_BY_ID[planId];
  if (!P || !ownsLand(s, id)) return err('You don\'t own that land.');
  const l = landState(s, id);
  if (building(s, id)) return err('The crew is already building.');
  if (l.plan && PLANS.indexOf(P) <= PLANS.indexOf(PLAN_BY_ID[l.plan])) return err('Pick something bigger than what\'s there.');
  if (P.tier && tierOf(s.rep).n < P.tier) return err(`The builder wants a bigger name first (tier ${P.tier}).`);
  const first = !l.plan;
  const house = first ? (design ? sanitize(cloneDesign(design)) : fromPreset(P.house)) : null;
  if (house && !checkDesign(house).ok) return err(checkDesign(house).errors[0]);
  const old = l.plan && l.done ? PROPERTIES[id]?.slots || 0 : 0;
  if (old && s.cars.length > capacityWithout(s, id)) return err('Your cars are parked in there. Move them out (sell one or buy more garage space) before the crew tears it down.');
  if (!spend(s, buildCost(s, id, planId, house), `Cowtown Custom Builders: ${house ? `${stories(house)}-story house + ` : ''}${P.name}`)) return err('Not enough money.');
  if (first && !l.design) l.design = house;
  if (!l.design) l.design = houseDesign(s, id);    // an old save: keep the house it came with
  l.designOk = true;
  Object.assign(l, { plan: planId, ready: now(s) + P.days * 1440, done: false });
  registerBuilds(s);    // an old build comes down while the new one goes up
  return { ok: true, text: `The crew breaks ground. Ready in ${P.days} game day${P.days > 1 ? 's' : ''}.` };
}

// Redesign the house on land you've built on. You pay for what's new; tear
// stuff out and you get half of it back. The crew works fast: it's done when
// you close the plans.
export function remodelCost(s, id, design) {
  const diff = designCost(design) - designCost(houseDesign(s, id));
  return diff >= 0 ? diff : Math.round(diff * 0.5);
}
export function remodel(s, id, design) {
  if (!isBuilt(s, id)) return err('Finish building first.');
  const d = sanitize(cloneDesign(design));
  const c = checkDesign(d);
  if (!c.ok) return err(c.errors[0]);
  const price = remodelCost(s, id, d);
  if (price > 0 && !spend(s, price, `Cowtown Custom Builders: remodel`)) return err('Not enough money.');
  if (price < 0) earn(s, -price, 'Cowtown Custom Builders: salvage');
  const l = landState(s, id);
  l.design = d; l.designOk = true;
  registerBuilds(s);
  return { ok: true, text: price > 0 ? `Done. ${fmtMoney(price)} well spent.` : price < 0 ? `Done. You got ${fmtMoney(-price)} back for what came out.` : 'Done.' };
}

export const landValue = (s, id) => {
  const L = LAND[id], l = s.estate?.land?.[id];
  if (!l?.owned) return 0;
  const fence = l.fence ? FENCE_BY_ID[l.fence]?.price || 0 : 0;
  const stock = Object.entries(l.animals || {}).reduce((t, [a, n]) => t + (ANIMAL_BY_ID[a]?.price || 0) * n * 0.6 / LAND_SELL, 0);
  return Math.round((L.price + (l.plan ? PLAN_BY_ID[l.plan].price + designCost(houseDesign(s, id)) : 0) + fence + stock) * LAND_SELL);
};
export function sellLand(s, id) {
  const L = LAND[id], l = s.estate?.land?.[id];
  if (!L || !l?.owned) return err('You don\'t own that.');
  if (isBuilt(s, id) && s.cars.length > capacityWithout(s, id)) return err(`Your cars wouldn't fit anywhere else. Sell a car or buy more garage space first.`);
  const value = landValue(s, id);
  delete s.estate.land[id];
  registerBuilds(s);
  earnBank(s, value, `Sold ${L.name}`);
  return { ok: true, text: `Sold for ${fmtMoney(value)}.`, value };
}

// For the realty screen: everything you own, worth, and what's in the stash.
export function portfolio(s) {
  let worth = 0;
  for (const id of s.properties) if (id !== STARTER && PROPERTIES[id] && !PROPERTIES[id].land) worth += Math.round(PROPERTIES[id].price * SELL_RATE);
  for (const [id, l] of Object.entries(s.estate?.land || {})) if (l.owned && LAND[id]) worth += landValue(s, id);
  for (const id of Object.keys(s.estate?.rigs || {})) if (RIGS[id]) worth += Math.round(RIGS[id].price * RIG_SELL);
  const stash = Object.keys(TRAPS).reduce((t, id) => t + units(s.estate?.traps?.[id]?.stash), 0);
  return { worth, stash };
}

// ---------------------------------------------------------------- oil
export const ownsRig = (s, id) => !!s.estate?.rigs?.[id];
export function buyRig(s, id) {
  const R = RIGS[id];
  if (!R) return err('That lease isn\'t for sale.');
  ensureDrugs(s); s.estate.rigs ??= {};
  if (ownsRig(s, id)) return err('You already own it.');
  if (!spend(s, R.price, `Bought ${R.name}`)) return err(`Not enough money. It's ${fmtMoney(R.price)}.`);
  s.estate.rigs[id] = { since: s.time.day, earned: 0 };
  return { ok: true, text: `${R.name} is yours. ${fmtMoney(RIG_PAY)} a day lands in your bank every morning.` };
}
export function sellRig(s, id) {
  const R = RIGS[id];
  if (!R || !ownsRig(s, id)) return err('You don\'t own that.');
  const value = Math.round(R.price * RIG_SELL);
  delete s.estate.rigs[id];
  earnBank(s, value, `Sold ${R.name}`);
  return { ok: true, text: `Sold for ${fmtMoney(value)}.`, value };
}
export const oilIncome = s => Object.keys(s.estate?.rigs || {}).filter(id => RIGS[id]).length * RIG_PAY;

// ---------------------------------------------------------------- ranching
// The pasture: the back of the lot, behind the house and the garage.
export function pasture(loc) {
  const r = loc.lot, depth = loc.side === 'N' || loc.side === 'S' ? r.z1 - r.z0 : r.x1 - r.x0;
  const front = Math.min(62, depth * 0.5), back = 4, sideIn = 4;
  if (loc.side === 'N') return { x0: r.x0 + sideIn, x1: r.x1 - sideIn, z0: r.z0 + front, z1: r.z1 - back };
  if (loc.side === 'S') return { x0: r.x0 + sideIn, x1: r.x1 - sideIn, z0: r.z0 + back, z1: r.z1 - front };
  if (loc.side === 'W') return { x0: r.x0 + front, x1: r.x1 - back, z0: r.z0 + sideIn, z1: r.z1 - sideIn };
  return { x0: r.x0 + back, x1: r.x1 - front, z0: r.z0 + sideIn, z1: r.z1 - sideIn };
}
export const herd = (s, id) => s.estate?.land?.[id]?.animals || {};
export const penCount = (s, id) => Object.entries(herd(s, id)).reduce((t, [a, n]) => t + (ANIMAL_BY_ID[a]?.pen ? n : 0), 0);
export const penCap = (s, id) => FENCE_BY_ID[s.estate?.land?.[id]?.fence]?.cap || 0;
export const fenceOptions = id => FENCES.slice(0, (LAND[id]?.ranch ?? 0) + 1);

export function buildFence(s, id, fenceId) {
  const F = FENCE_BY_ID[fenceId];
  if (!F || !ownsLand(s, id)) return err('You don\'t own that land.');
  if (!fenceOptions(id).includes(F)) return err('There isn\'t room for that much fence here.');
  const l = landState(s, id), cur = FENCE_BY_ID[l.fence];
  if (cur && FENCES.indexOf(cur) >= FENCES.indexOf(F)) return err('You already have that or better.');
  const price = F.price - (cur ? Math.round(cur.price * 0.5) : 0);
  if (!spend(s, price, `${F.name}: ${LAND[id].name}`)) return err('Not enough money.');
  l.fence = fenceId;
  return { ok: true, text: `${F.name} is up. Room for ${F.cap} head.` };
}

export function buyAnimal(s, id, animalId, n = 1) {
  const A = ANIMAL_BY_ID[animalId];
  if (!A || !ownsLand(s, id)) return err('You don\'t own that land.');
  const l = landState(s, id);
  l.animals ??= {};
  if (A.pen && !l.fence) return err('Build a fence first or they\'ll wander off.');
  if (A.pen && penCount(s, id) + n > penCap(s, id)) return err(`The pasture holds ${penCap(s, id)}. Build a bigger fence.`);
  if (A.max && (l.animals[animalId] || 0) + n > A.max) return err(`${A.max} is plenty.`);
  if (!spend(s, A.price * n, `${n} × ${A.name}`)) return err('Not enough money.');
  l.animals[animalId] = (l.animals[animalId] || 0) + n;
  return { ok: true, text: n > 1 ? `${n} ${A.name.toLowerCase()}s are yours.` : `Your new ${A.name.toLowerCase()} is out back.` };
}
export function sellAnimal(s, id, animalId) {
  const A = ANIMAL_BY_ID[animalId], l = s.estate?.land?.[id];
  if (!A || !l?.animals?.[animalId]) return err('You don\'t have one.');
  l.animals[animalId]--;
  if (!l.animals[animalId]) delete l.animals[animalId];
  const v = Math.round(A.price * 0.6);
  earn(s, v, `Sold a ${A.name.toLowerCase()}`);
  return { ok: true, text: `Sold for ${fmtMoney(v)}.` };
}

// One game day on the ranches and the oil leases: feed, calves, stud fees
// and oil money, all into the bank. Returns { oil, stock, notes }.
export function estateDay(s) {
  const notes = [];
  let oil = 0, stock = 0;
  for (const id of Object.keys(s.estate?.rigs || {})) {
    if (!RIGS[id]) continue;
    oil += RIG_PAY; s.estate.rigs[id].earned = (s.estate.rigs[id].earned || 0) + RIG_PAY;
  }
  for (const [id, l] of Object.entries(s.estate?.land || {})) {
    if (!l.owned || !l.animals) continue;
    for (const [a, n] of Object.entries(l.animals)) { const A = ANIMAL_BY_ID[a]; if (A) stock += (A.pays - A.feed) * n; }
  }
  if (oil) { earnBank(s, oil, 'Oil royalties'); notes.push(`🛢 Your oil leases paid ${fmtMoney(oil)}.`); }
  if (stock > 0) { earnBank(s, stock, 'Ranch: calves, stud fees, less feed'); notes.push(`🐄 The ranch cleared ${fmtMoney(stock)} after feed.`); }
  else if (stock < 0) spend(s, -stock, 'Ranch: feed') || earnBank(s, stock, 'Ranch: feed (overdrawn)');
  return { oil, stock, notes };
}
