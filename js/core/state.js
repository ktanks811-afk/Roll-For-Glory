// The save-game state and the helpers every system uses to change it.
// All money, rep and car mutations go through here so the ledger, tier-ups
// and notifications stay consistent.

import { CAR_BY_ID, CURRENT_YEAR } from '../data/cars.js';
import { defaultVisual, partLevels, PERF_IDS } from '../data/parts.js';
import { ITEM_BY_ID } from '../data/catalog.js';
import { marketValue } from '../data/market.js';
import { buildSpec, metrics } from '../sim/powertrain.js';
import { emit } from './events.js';

export const TIERS = [
  { n: 1, name: 'Nobody', rep: 0 },
  { n: 2, name: 'Local Racer', rep: 1500 },
  { n: 3, name: 'Established', rep: 5000 },
  { n: 4, name: 'Elite', rep: 14000 },
  { n: 5, name: 'Underground Legend', rep: 35000 },
];

export const game = { s: null };

let uidCounter = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${(uidCounter++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export function createState({ name, age, look, story = true }) {
  return {
    version: 2,
    created: Date.now(),
    playTime: 0,
    player: { name, age, look, energy: 100, outfits: ['hoodie_black', 'jeans_blue', 'no_hat', 'kicks_white'] },
    cash: 4500,
    dirty: 0,            // how much of `cash` is dirty money (core/bank.js)
    bank: 0,
    rep: 0,
    xp: 0,
    heat: 0,
    citations: [],       // signed tickets not paid yet: { id, text, fine, due }
    warrants: [],        // open warrants: { id, kind, text, fine, day, felony } (core/warrants.js)
    justice: { cases: [], convictions: [], probation: null },   // court cases, criminal history (core/justice.js)
    followers: 40,
    cars: [],
    activeCar: null,
    properties: ['eastgate_studio'],
    home: 'eastgate_studio',
    inventory: { energyDrinks: 0 },
    partsBin: [],        // { pid, uid } owned parts not installed
    orders: [],          // { id, items:[pid], arriveDay, total }
    listings: [],        // Marketplace listings currently visible
    listingsDay: 0,
    myListings: [],      // cars the player is selling { carUid, asking, offers:[] }
    contacts: ['jojo', 'sal', 'rosa'],
    messages: [],
    feed: [],
    npc: {},
    crew: null,
    story: { enabled: story, chapter: 0, step: 0, done: [], counters: {} },
    stats: { races: 0, wins: 0, losses: 0, earnings: 0, expenses: 0, bestEt: null, bestEtCar: null, bestTrap: 0, pursuitsEscaped: 0, busted: 0, meets: 0, wagersWon: 0, miles: 0 },
    ledger: [],
    time: { day: 1, min: 9 * 60 },
    weather: 'clear',
    pos: null,
    parked: {},          // carUid -> { x, z, rot }
    insurance: false,
    sponsor: null,
    challenges: {},
    gps: null,
  };
}

export function tierOf(rep) {
  let t = TIERS[0];
  for (const x of TIERS) if (rep >= x.rep) t = x;
  return t;
}
export function nextTier(rep) { return TIERS.find(t => t.rep > rep) || null; }
export function racingLevel(xp) { return Math.floor(Math.sqrt(xp / 120)) + 1; }

export function fmtMoney(n, cents = false) {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  return `${sign}$${cents ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(v).toLocaleString('en-US')}`;
}
export function fmtMiles(m) { return `${Math.round(m).toLocaleString('en-US')} mi`; }

export function gameTimeStr(t) {
  const h = Math.floor(t.min / 60) % 24, m = Math.floor(t.min % 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
}
export function hourOf(t) { return (t.min / 60) % 24; }
export function isNight(t) { const h = hourOf(t); return h >= 20 || h < 5; }
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function dayName(t) { return DAY_NAMES[(t.day - 1) % 7]; }

// ---------------- money ----------------
function log(s, label, amount) {
  s.ledger.unshift({ day: s.time.day, t: gameTimeStr(s.time), label, amount });
  if (s.ledger.length > 100) s.ledger.length = 100;
}

// Cash on hand is one pile, but part of it can be dirty: money from drugs,
// robberies, chop-shop cars, gang work and street bets. `s.dirty` is that
// part (never more than `s.cash`); the rest is clean. Old saves have no
// `dirty`, so all their cash counts as clean. See core/bank.js for what the
// bank and the feds do with it.
export const REPORT_LIMIT = 10000;   // cash over this in one go gets reported to the IRS
export function dirtyOf(s) {
  const d = Math.max(0, Math.min(Math.round(s.dirty || 0), Math.max(0, Math.round(s.cash))));
  s.dirty = d;
  return d;
}
export const cleanOf = s => Math.max(0, s.cash - dirtyOf(s));

// dirty: money from crime. It lands in your pocket as dirty cash.
export function earn(s, amount, label, { dirty = false } = {}) {
  amount = Math.round(amount);
  s.cash += amount;
  if (dirty && amount > 0) s.dirty = dirtyOf(s) + amount;
  s.stats.earnings += amount;
  log(s, dirty ? `${label} (dirty)` : label, amount);
  emit('money', { amount, label, dirty });
}

// Income that is paid straight into the bank (paychecks, business profits).
export function earnBank(s, amount, label) {
  amount = Math.round(amount);
  s.bank += amount;
  if (amount > 0) s.stats.earnings += amount;
  log(s, label, amount);
  emit('money', { amount, label });
}

// Small buys get paid with dirty cash first (nobody asks where a few hundred
// came from). A legit purchase over $10,000 uses clean cash and the bank
// first; if dirty cash still has to cover it, the seller files the IRS form
// and the feds hear about it ('cashReport'). street: the plug, the set, a
// bet — nobody there reports anything, so dirty cash goes first.
export function spend(s, amount, label, { fromBank = true, street = false } = {}) {
  amount = Math.round(amount * 100) / 100;
  const total = s.cash + (fromBank ? s.bank : 0);
  if (total < amount) {
    emit('toast', { kind: 'bad', text: `Not enough money — need ${fmtMoney(amount)}` });
    return false;
  }
  const dirty = dirtyOf(s), clean = s.cash - dirty, bank = fromBank ? s.bank : 0;
  let left = amount, fromDirty = 0, fromClean = 0, fromBankAmt = 0;
  const take = (have) => { const v = Math.min(have, left); left -= v; return v; };
  if (street || amount < REPORT_LIMIT) { fromDirty = take(dirty); fromClean = take(clean); fromBankAmt = take(bank); }
  else { fromClean = take(clean); fromBankAmt = take(bank); fromDirty = take(dirty); }
  s.cash -= fromDirty + fromClean;
  s.dirty = dirty - fromDirty;
  s.bank -= fromBankAmt;
  s.stats.expenses += amount;
  log(s, label, -amount);
  emit('money', { amount: -amount, label });
  if (!street && amount >= REPORT_LIMIT && fromDirty > 0) emit('cashReport', { s, amount, dirty: fromDirty, label });
  return true;
}
export function canAfford(s, amount) { return s.cash + s.bank >= amount; }

// Plain deposits only take clean cash. Dirty cash goes in through
// core/bank.js depositCash(), which is where the feds start paying attention.
export function deposit(s, amount) {
  amount = Math.min(Math.round(amount), cleanOf(s));
  if (amount <= 0) return 0;
  s.cash -= amount; s.bank += amount;
  log(s, 'Deposit to Cowtown Credit Union', 0);
  return amount;
}
export function withdraw(s, amount) {
  amount = Math.min(Math.round(amount), s.bank);
  if (amount <= 0) return 0;
  s.bank -= amount; s.cash += amount;
  log(s, 'ATM withdrawal', 0);
  return amount;
}

// ---------------- rep ----------------
export function addRep(s, amount, reason) {
  const before = tierOf(s.rep).n;
  s.rep = Math.max(0, Math.round(s.rep + amount));
  if (amount) emit('rep', { amount, reason });
  const after = tierOf(s.rep).n;
  if (after > before) emit('tierUp', { tier: TIERS[after - 1] });
}
export function addFollowers(s, n) { s.followers = Math.max(0, Math.round(s.followers + n)); }

// ---------------- cars ----------------
export function newCar(modelId, extra = {}) {
  const model = CAR_BY_ID[modelId];
  return {
    uid: uid('car'), modelId,
    year: Math.min(model.years[1], CURRENT_YEAR),
    miles: 12,
    title: 'Clean',
    parts: Object.fromEntries(PERF_IDS.map(k => [k, null])),
    visual: defaultVisual(model),
    cond: { body: 100, lights: 100, tires: 100, engine: 100, trans: 100 },
    tune: { finalDrive: 1 },
    fuel: 1, nos: 0,
    stats: { races: 0, wins: 0, losses: 0, bestEt: null, bestTrap: 0 },
    paid: model.msrp,
    ...extra,
  };
}

export function getCar(s, id) { return s.cars.find(c => c.uid === id) || null; }
export function activeCar(s) { return getCar(s, s.activeCar); }
export function modelOf(car) { return CAR_BY_ID[car.modelId]; }

const specCache = new WeakMap();
export function carSpec(car) {
  const key = JSON.stringify([car.parts, car.cond, car.tune, car.visual?.spoiler]);
  const hit = specCache.get(car);
  if (hit && hit.key === key) return hit.spec;
  const spec = buildSpec(CAR_BY_ID[car.modelId], partLevels(car.parts), car.cond, car.tune, car.visual);
  specCache.set(car, { key, spec });
  return spec;
}
export function carMetrics(car) { return metrics(carSpec(car)); }
export function levels(car) { return partLevels(car.parts); }

export function partsValue(car) {
  let v = 0;
  for (const id of Object.values(car.parts)) {
    if (typeof id === 'string' && ITEM_BY_ID[id]) v += ITEM_BY_ID[id].price;
  }
  return v;
}

export function carValue(car) {
  const model = CAR_BY_ID[car.modelId];
  return Math.round((marketValue(model, car.year, car.miles, car.cond, car.title) + partsValue(car) * 0.4) / 10) * 10;
}

// Real-world-ish fuel economy, used for fuel burn and the spec sheet.
export function carMpg(car) {
  const m = CAR_BY_ID[car.modelId];
  if (m.asp === 'ev') return 110; // MPGe
  const spec = carSpec(car);
  return Math.max(7, Math.min(42, 52 - spec.hp / 17 - m.kg / 110));
}
export function tankGallons(car) {
  const m = CAR_BY_ID[car.modelId];
  return m.asp === 'ev' ? 75 : m.body === 'truck' ? 26 : m.body === 'suv' ? 24 : m.kg > 1800 ? 19 : 14;
}
export function needsPremium(car) { return carSpec(car).hp > 280 || CAR_BY_ID[car.modelId].asp !== 'na'; }

export function garageCapacity(s, PROPERTIES) {
  return s.properties.reduce((n, id) => n + (PROPERTIES[id]?.slots || 0), 0);
}
