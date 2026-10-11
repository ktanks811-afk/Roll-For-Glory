// The drug game. Buy product from the plug, carry it in your bag or stash it
// at a trap house you own, and serve the customers who come knocking. Every
// customer you serve is foot traffic the neighbours see: the busier the
// house, the better the odds that Tarrant County SWAT kicks the door in.
//
// Getting arrested with product on you adds possession charges (or delivery,
// if you're holding enough to sell) to the case, and they take the product.
// Charges go through core/justice.js like any other offence: kind 'drugs_<class>'.
// DOM-free so check-data can test it.

import { spend, earn, fmtMoney, isNight } from './state.js';
import { DRUGS, DRUG_BY_ID, TRAPS, WORKER_PAY, WORKER_CUT } from '../data/estate.js';
import { CLASSES, BY_RANK } from './justice.js';

export const INTENT_UNITS = 4;      // holding this much (or any at a trap house) reads as "for sale"
export const CLOSED_DAYS = 2;       // a raided house is boarded up this long
const DECAY = 0.6;                  // foot traffic left after each game day
const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const AMOUNT = { loud: q => `${q} oz of weed`, percs: q => `${q * 10} pills`, lean: q => `${pl(q, 'pint')} of codeine syrup`, powder: q => `${pl(q, 'eight-ball')} of cocaine` };

export function ensureDrugs(s) {
  s.drugs ??= {};
  const d = s.drugs;
  d.bag ??= {};            // product on you: { drugId: units }
  d.prices ??= null;       // today's market: { drugId: { buy, street } }
  d.priceDay ??= 0;
  d.sold ??= 0;            // customers served, all time
  d.earned ??= 0;
  d.raids ??= 0;
  d.reputation ??= {};       // trap/drug customer trust
  d.surveillance ??= {};     // how much attention each address has attracted
  d.lastSaleDay ??= 0;
  d.market ??= {};            // demand/quality modifiers for the current day
  s.estate ??= {};
  s.estate.traps ??= {};
  s.estate.land ??= {};
  s.estate.rigs ??= {};    // oil leases you own (core/estate.js)
  return d;
}

export function trapState(s, id) {
  ensureDrugs(s);
  return s.estate.traps[id] ??= { stash: {}, safe: 0, traffic: 0, served: 0, worker: false, closed: 0 };
}

export const units = bag => Object.values(bag || {}).reduce((t, n) => t + (n || 0), 0);
export const ownsTrap = (s, id) => s.properties.includes(id) && !!TRAPS[id];
export const myTraps = s => Object.keys(TRAPS).filter(id => s.properties.includes(id));
export const isClosed = (s, id) => trapState(s, id).closed > s.time.day;

// Today's prices. They drift every game day, the street pays more at night
// and when a product is scarce.
function hash(n) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
export function prices(s) {
  const d = ensureDrugs(s);
  if (!d.prices || d.priceDay !== s.time.day) {
    d.prices = Object.fromEntries(DRUGS.map((g, k) => {
      const swing = 0.82 + hash(s.time.day * 31 + k * 977) * 0.36;
      const demand = 0.78 + hash(s.time.day * 97 + k * 71) * 0.44;
      return [g.id, { buy: Math.round(g.buy * swing / 5) * 5, street: Math.round(g.street * demand / 5) * 5, demand }];
    }));
    d.priceDay = s.time.day;
  }
  return d.prices;
}

export function marketMood(s, id) {
  const p = prices(s)[id]; const q = p?.demand || 1;
  return q > 1.12 ? 'Very strong demand' : q > 1.03 ? 'Strong demand' : q < 0.88 ? 'Soft demand' : 'Normal demand';
}

// ---------------------------------------------------------------- the plug
const err = text => ({ ok: false, text });
export function buy(s, id, n = 1) {
  const g = DRUG_BY_ID[id];
  if (!g || n < 1) return err('He doesn\'t have that.');
  const cost = prices(s)[id].buy * n;
  if (!spend(s, cost, `Lil Tre: ${n} × ${g.name}`, { street: true })) return err(`That's ${fmtMoney(cost)}. Come back with the money.`);
  const bag = ensureDrugs(s).bag;
  bag[id] = (bag[id] || 0) + n;
  return { ok: true, text: `+${n} ${g.unit === 'oz' ? 'oz' : '×'} ${g.name}. It's in your bag.`, cost };
}

// Sell back to the plug at half the street price: quick and safe, not much money.
export function dump(s, id, n = 1) {
  const bag = ensureDrugs(s).bag;
  n = Math.min(n, bag[id] || 0);
  if (n < 1) return err('You don\'t have any.');
  const pay = Math.round(prices(s)[id].street * 0.5) * n;
  bag[id] -= n; if (!bag[id]) delete bag[id];
  earn(s, pay, `Sold ${n} × ${DRUG_BY_ID[id].name} back to the plug`, { dirty: true });
  return { ok: true, text: `He gives you ${fmtMoney(pay)}.`, pay };
}

// Move product between your bag and a trap house's stash.
export function moveStash(s, trapId, toStash) {
  const t = trapState(s, trapId), bag = ensureDrugs(s).bag;
  const [from, to] = toStash ? [bag, t.stash] : [t.stash, bag];
  let n = 0;
  for (const [id, q] of Object.entries(from)) { to[id] = (to[id] || 0) + q; n += q; delete from[id]; }
  return n;
}

// ---------------------------------------------------------------- customers
// Who's at the door: they want something you have (stash first, then your bag).
export function customer(s, trapId, rng = Math.random) {
  const t = trapState(s, trapId), bag = ensureDrugs(s).bag;
  const have = DRUGS.filter(g => (t.stash[g.id] || 0) + (bag[g.id] || 0) > 0).sort((a,b) => (prices(s)[b.id].demand || 1) - (prices(s)[a.id].demand || 1));
  if (!have.length) return null;
  const g = have[Math.floor(rng() * have.length)];
  const avail = (t.stash[g.id] || 0) + (bag[g.id] || 0);
  const repKey = `${trapId}:${g.id}`;
  const trust = Math.min(0.22, (ensureDrugs(s).reputation[repKey] || 0) * 0.025);
  const qty = Math.min(avail, 1 + (rng() < (0.35 + trust) ? 1 : 0) + (rng() < (0.12 + trust * 0.5) ? 1 : 0));
  const night = isNight(s.time) ? 1.12 : 1;
  const each = Math.round(prices(s)[g.id].street * (0.88 + rng() * 0.24) * night * (1 + trust) / 5) * 5;
  const types = WHO;
  const who = types[Math.floor(rng() * types.length)];
  const attention = Math.min(1, (t.traffic / 45) + (ensureDrugs(s).surveillance[trapId] || 0));
  return { drug: g.id, qty, price: each * qty, who, trust, attention, mood: marketMood(s, g.id) };
}
const WHO = ['a nervous college kid', 'a regular in a work vest', 'a dude on a bike', 'two girls in a Charger', 'an older man who says "you know me"', 'a guy who won\'t take his hood off', 'somebody\'s cousin', 'a lady in scrubs', 'a kid from Dunbar\'s old class', 'a trucker passing through'];

// The odds this customer is the one that brings SWAT, given the house's
// recent foot traffic. ~1% per sale on a quiet house, 6% at 25 customers,
// 15%+ once the whole block is talking.
export function raidChance(s, trapId, heat = s.heat || 0) {
  const t = trapState(s, trapId), risk = TRAPS[trapId]?.risk ?? 1;
  const d = ensureDrugs(s), attention = Math.min(1, (d.surveillance[trapId] || 0) + t.traffic / 60);
  const timeRisk = isNight(s.time) ? 0.82 : 1.08;
  return Math.min(0.35, 0.00045 * Math.pow(t.traffic + 1, 1.38) * risk * (1 + attention * 1.8) * timeRisk * (heat >= 2 ? 1.5 : 1));
}
export function heatLabel(p) {
  return p < 0.02 ? ['Quiet', 'good'] : p < 0.05 ? ['People are noticing', 'warn'] : p < 0.1 ? ['Hot. The block is talking', 'bad'] : ['SWAT is watching the house', 'bad'];
}

// Hand it over. Returns { ok, pay, raid } — raid: true means the door is about to come in.
export function serve(s, trapId, c, rng = Math.random) {
  const t = trapState(s, trapId), bag = ensureDrugs(s).bag;
  let need = c.qty;
  const fromStash = Math.min(need, t.stash[c.drug] || 0);
  t.stash[c.drug] = (t.stash[c.drug] || 0) - fromStash; if (!t.stash[c.drug]) delete t.stash[c.drug];
  need -= fromStash;
  if (need > (bag[c.drug] || 0)) return err('You ran out.');
  if (need) { bag[c.drug] -= need; if (!bag[c.drug]) delete bag[c.drug]; }
  earn(s, c.price, `Served ${c.who.replace(/^an? /, '')}`, { dirty: true });
  const d = ensureDrugs(s);
  d.sold++; d.earned += c.price;
  t.served++;
  const key = `${trapId}:${c.drug}`;
  d.reputation[key] = Math.min(12, (d.reputation[key] || 0) + (c.trust > 0 ? 1 : 0.35));
  d.surveillance[trapId] = Math.min(1, (d.surveillance[trapId] || 0) + 0.018 + t.traffic * 0.0007);
  d.lastSaleDay = s.time.day;
  const raid = rng() < raidChance(s, trapId);
  t.traffic += 1;
  return { ok: true, pay: c.price, raid };
}

// ---------------------------------------------------------------- the law
const up = (cls, n = 1) => BY_RANK[Math.min(BY_RANK.length - 1, BY_RANK.indexOf(cls) + n)];
// What a search turns up, as offences for justice.charge(). intent: caught
// selling (a trap house), or holding enough that it can't be "personal use".
export function drugOffences(bag, { intent = false } = {}) {
  const out = [];
  const total = units(bag);
  for (const g of DRUGS) {
    const q = bag[g.id] || 0;
    if (!q) continue;
    let row = g.law[0];
    for (const r of g.law) if (q >= r[0]) row = r;
    let cls = row[1], text = `${row[2]}: ${AMOUNT[g.id](q)}.`;
    if (intent || total >= INTENT_UNITS) {
      cls = up(cls);
      text = `${g.id === 'loud' ? 'Delivery of marijuana' : 'Manufacture or delivery of a controlled substance'}: ${AMOUNT[g.id](q)}.`;
    }
    out.push({ kind: 'drugs_' + cls, text, fine: Math.round(CLASSES[cls].fine[0]) });
  }
  return out;
}

// Arrested: they search you. Returns the offences and empties your bag.
export function seizeBag(s, opts) {
  const d = ensureDrugs(s);
  if (!units(d.bag)) return [];
  const items = drugOffences(d.bag, opts);
  d.bag = {};
  return items;
}

// A raid takes everything in the house: product, the safe, and the house is boarded up.
export function raidHouse(s, trapId) {
  const t = trapState(s, trapId);
  const took = { product: units(t.stash), safe: t.safe, stash: t.stash };
  t.stash = {}; t.safe = 0; t.traffic = 0; t.worker = false;
  t.closed = s.time.day + CLOSED_DAYS;
  ensureDrugs(s).raids++;
  return took;
}

// ---------------------------------------------------------------- every game day
// The house cools off, prices move, and if you hired somebody to work the
// door, he sells out of the stash (into the safe) and might get raided.
// Returns { notes: [text], raids: [{ trapId, took }] }.
export function drugsDay(s, rng = Math.random) {
  ensureDrugs(s);
  const notes = [], raids = [];
  prices(s);
  for (const id of myTraps(s)) {
    const t = trapState(s, id), T = TRAPS[id];
    t.traffic = Math.round(t.traffic * DECAY * 10) / 10;
    ensureDrugs(s).surveillance[id] = Math.max(0, (ensureDrugs(s).surveillance[id] || 0) * 0.72);
    if (!t.worker || t.closed > s.time.day) continue;
    if (!spend(s, WORKER_PAY, `${T.name}: paid the door`, { street: true })) { t.worker = false; notes.push(`${T.name}: you couldn't pay your worker, so he walked.`); continue; }
    let n = 0, take = 0, raided = false;
    const want = Math.round(T.worker * (0.7 + rng() * 0.6));
    for (let k = 0; k < want; k++) {
      const have = DRUGS.filter(g => t.stash[g.id] > 0);
      if (!have.length) break;
      const g = have[Math.floor(rng() * have.length)];
      t.stash[g.id]--; if (!t.stash[g.id]) delete t.stash[g.id];
      take += Math.round(prices(s)[g.id].street * (0.85 + rng() * 0.3) * (1 - WORKER_CUT));
      n++;
      if (rng() < raidChance(s, id) * 0.8) { raided = true; break; }
      t.traffic++;
    }
    t.safe += take; t.served += n;
    ensureDrugs(s).sold += n; ensureDrugs(s).earned += take;
    ensureDrugs(s).surveillance[id] = Math.min(1, (ensureDrugs(s).surveillance[id] || 0) + n * 0.012);
    if (raided) raids.push({ trapId: id, took: raidHouse(s, id), sold: n });
    else if (n) notes.push(`${T.name}: your worker served ${n} customer${n > 1 ? 's' : ''}. ${fmtMoney(take)} in the safe.`);
    else notes.push(`${T.name}: the stash is empty, so your worker sat on the porch all day.`);
  }
  return { notes, raids };
}
