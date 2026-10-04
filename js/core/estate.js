// Real estate: buy and sell houses and trap houses, buy empty land and build
// your own house and garage on it. A finished build becomes a property like
// any other (a home, a safehouse, garage space): it is registered in
// PROPERTIES at runtime and the map puts the building up (world2d/estate.js).
// DOM-free so check-data can test it.

import { spend, earn, earnBank, fmtMoney, tierOf } from './state.js';
import { PROPERTIES, LOC_BY_ID } from '../data/world.js';
import { LAND, PLANS, PLAN_BY_ID, TRAPS } from '../data/estate.js';
import { ensureDrugs, trapState, units } from './drugs.js';

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

// The property entry a finished build adds (garage size, colours for the map).
export function builtProperty(landId, planId) {
  const L = LAND[landId], P = PLAN_BY_ID[planId];
  return { name: `${P.name.split(' + ')[0]} · ${L.name.replace(/^Empty Lot · /, '')}`, price: L.price + P.price, slots: P.slots, desc: P.desc,
    wall: P.wall, roof: P.roof, style: P.style, wallH: P.wallH, land: true, plan: planId };
}

// Puts this career's finished builds into PROPERTIES (and takes out another
// career's). Call after loading and whenever a build finishes.
export function registerBuilds(s) {
  for (const id of Object.keys(LAND)) {
    const loc = LOC_BY_ID[id];
    if (isBuilt(s, id)) {
      PROPERTIES[id] = builtProperty(id, s.estate.land[id].plan);
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
export const buildCost = (s, id, planId) => {
  const l = s.estate?.land?.[id], P = PLAN_BY_ID[planId];
  const credit = l?.plan && l.done ? Math.round(PLAN_BY_ID[l.plan].price * 0.3) : 0;
  return Math.max(0, P.price - credit);
};
export function build(s, id, planId) {
  const P = PLAN_BY_ID[planId];
  if (!P || !ownsLand(s, id)) return err('You don\'t own that land.');
  const l = landState(s, id);
  if (building(s, id)) return err('The crew is already building.');
  if (l.plan && PLANS.indexOf(P) <= PLANS.indexOf(PLAN_BY_ID[l.plan])) return err('Pick something bigger than what\'s there.');
  if (P.tier && tierOf(s.rep).n < P.tier) return err(`The builder wants a bigger name first (tier ${P.tier}).`);
  const old = l.plan && l.done ? PROPERTIES[id]?.slots || 0 : 0;
  if (old && s.cars.length > capacityWithout(s, id)) return err('Your cars are parked in there. Move them out (sell one or buy more garage space) before the crew tears it down.');
  if (!spend(s, buildCost(s, id, planId), `Cowtown Custom Builders: ${P.name}`)) return err('Not enough money.');
  Object.assign(l, { plan: planId, ready: now(s) + P.days * 1440, done: false });
  registerBuilds(s);    // an old build comes down while the new one goes up
  return { ok: true, text: `The crew breaks ground. Ready in ${P.days} game day${P.days > 1 ? 's' : ''}.` };
}

export function sellLand(s, id) {
  const L = LAND[id], l = s.estate?.land?.[id];
  if (!L || !l?.owned) return err('You don\'t own that.');
  if (isBuilt(s, id) && s.cars.length > capacityWithout(s, id)) return err(`Your cars wouldn't fit anywhere else. Sell a car or buy more garage space first.`);
  const value = Math.round((L.price + (l.plan ? PLAN_BY_ID[l.plan].price : 0)) * LAND_SELL);
  delete s.estate.land[id];
  registerBuilds(s);
  earnBank(s, value, `Sold ${L.name}`);
  return { ok: true, text: `Sold for ${fmtMoney(value)}.`, value };
}

// For the realty screen: everything you own, worth, and what's in the stash.
export function portfolio(s) {
  let worth = 0;
  for (const id of s.properties) if (id !== STARTER && PROPERTIES[id] && !PROPERTIES[id].land) worth += Math.round(PROPERTIES[id].price * SELL_RATE);
  for (const [id, l] of Object.entries(s.estate?.land || {})) if (l.owned) worth += Math.round((LAND[id].price + (l.plan ? PLAN_BY_ID[l.plan].price : 0)) * LAND_SELL);
  const stash = Object.keys(TRAPS).reduce((t, id) => t + units(s.estate?.traps?.[id]?.stash), 0);
  return { worth, stash };
}
