// Used-car market: valuation (depreciation, mileage, condition, title) and
// the Marketplace listing generator — mostly cheap, tired, high-mileage cars,
// with the occasional gem.

import { CARS, CAR_BY_ID, CURRENT_YEAR, carName } from './cars.js';
import { CATALOG } from './catalog.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

export function avgCond(c) {
  return (c.body + c.lights + c.tires + c.engine + c.trans) / 5;
}

// What a car is worth on the private market.
export function marketValue(model, year, miles, cond, title = 'Clean') {
  const age = Math.max(0, CURRENT_YEAR - year);
  let v;
  if (model.market && age > 3) {
    v = model.market * clamp(1.15 - miles / 200000 * 0.35, 0.6, 1.15);
  } else {
    const dep = age === 0 ? 0.9 : 0.82 * Math.pow(0.87, age - 1);
    v = Math.max(model.msrp * dep, model.msrp * 0.15, 3500);
    v *= clamp(1.1 - miles / 300000 * 0.55, 0.5, 1.1);
  }
  v *= 0.55 + 0.45 * Math.pow(avgCond(cond) / 100, 1.2);
  v *= title === 'Salvage' ? 0.55 : title === 'Rebuilt' ? 0.72 : 1;
  return v;
}

export function roundPrice(v) {
  if (v < 1000) return Math.max(300, Math.round(v / 50) * 50);
  if (v < 10000) return Math.round(v / 100) * 100;
  if (v < 100000) return Math.round(v / 500) * 500;
  return Math.round(v / 5000) * 5000;
}

// Mileage wears parts down. Fresh cars ~100, 250k-mile cars ~50.
export function condFromMiles(miles) {
  const wear = clamp(miles / 300000, 0, 1);
  const r = () => rnd(-8, 8);
  return {
    body: clamp(100 - wear * 45 + r(), 25, 100),
    lights: clamp(100 - wear * 30 + r(), 30, 100),
    tires: clamp(rnd(35, 100), 10, 100),
    engine: clamp(100 - wear * 50 + r(), 20, 100),
    trans: clamp(100 - wear * 45 + r(), 20, 100),
  };
}

const ISSUES = [
  { text: 'Check engine light on (probably an O2 sensor)', fx: c => { c.engine -= 8; }, w: 3 },
  { text: 'Needs tires soon', fx: c => { c.tires = Math.min(c.tires, 22); }, w: 3 },
  { text: 'Transmission slips going into 3rd', fx: c => { c.trans = Math.min(c.trans, 38); }, w: 1.5 },
  { text: 'Burns a little oil, nothing crazy', fx: c => { c.engine = Math.min(c.engine, 62); }, w: 2 },
  { text: 'Rust on the rear quarters', fx: c => { c.body = Math.min(c.body, 55); }, w: 2 },
  { text: 'Minor fender bender, driver door dented', fx: c => { c.body = Math.min(c.body, 65); }, w: 2 },
  { text: 'One headlight cracked', fx: c => { c.lights = Math.min(c.lights, 45); }, w: 1.5 },
  { text: "AC doesn't blow cold", fx: () => {}, w: 2, price: 0.93 },
  { text: 'Needs brakes', fx: () => {}, w: 1.5, price: 0.95 },
  { text: 'Head gasket is going, runs rough. Sold as-is', fx: c => { c.engine = Math.min(c.engine, 28); }, w: 0.8, price: 0.6 },
  { text: 'Rod knock. Mechanic special. AS-IS NO REFUNDS', fx: c => { c.engine = Math.min(c.engine, 14); }, w: 0.5, price: 0.45 },
  { text: 'Clutch slipping at high rpm', fx: c => { c.trans = Math.min(c.trans, 50); }, w: 1, manual: true },
  { text: 'Exhaust leak, sounds louder than it should', fx: c => { c.engine -= 5; }, w: 1.5 },
  { text: 'Windshield cracked', fx: c => { c.body -= 6; }, w: 1.5 },
];
const PERKS = [
  { text: 'New tires last month', fx: c => { c.tires = 100; } },
  { text: 'Recent oil change + tune-up', fx: c => { c.engine = Math.min(100, c.engine + 10); } },
  { text: 'Garage kept, non-smoker', fx: c => { c.body = Math.min(100, c.body + 12); } },
  { text: 'Service records available', fx: c => { c.engine = Math.min(100, c.engine + 6); c.trans = Math.min(100, c.trans + 6); } },
  { text: 'Cold AC, everything works', fx: () => {} },
];

const FIRST = ['Mike', 'Jose', 'Tasha', 'DeShawn', 'Kevin', 'Maria', 'Tyler', 'Brittany', 'Luis', 'Kim', 'Andre', 'Jessica', 'Rob', 'Nguyen', 'Carlos',
  'Aaliyah', 'Dave', 'Priya', 'Jake', 'Marcus', 'Sam', 'Lupe', 'Trevor', 'Ashley', 'Omar', 'Hank', 'Destiny', 'Chris', 'Tony', 'Fatima'];
const LAST = ['R.', 'M.', 'Johnson', 'G.', 'Smith', 'L.', 'Williams', 'T.', 'Nguyen', 'Garcia', 'B.', 'Davis', 'Hernandez', 'K.', 'Brown', 'P.'];
const DISTRICTS = ['Arlington Heights', 'Near Southside', 'Riverside', 'Lakeside', 'Stockyards', 'Downtown', 'Eastgate', 'Chisholm Flats'];
const OPENERS = [
  'Runs and drives.', 'Daily driver, never left me stranded.', 'Selling because I got a company car.', 'Moving out of state, need it gone.',
  'Wife says it has to go.', 'Upgraded to a truck.', 'Project car I never finished.', 'Bought it to flip.', 'Second owner.',
  'First car, very reliable.', 'Grandpa\'s car, low miles for the year.',
];
const CLOSERS = [
  'No lowballs, I know what I have.', 'Cash only. Pink slip in hand.', 'Serious buyers only.', 'OBO.', 'Price is firm.',
  'Will consider trades.', 'Don\'t ask "is this available" — if it\'s up, it\'s available.', 'Test drives with proof of license.', '',
];

// Cheaper cars show up far more often, like real life.
function weightFor(model) {
  const age = Math.max(1, CURRENT_YEAR - model.years[1]);
  const approx = model.market || model.msrp * Math.pow(0.87, age);
  return 1 / Math.pow(Math.max(2000, approx), 0.75);
}
const WEIGHTS = CARS.map(weightFor);
const WSUM = WEIGHTS.reduce((a, b) => a + b, 0);
function weightedCar() {
  let r = Math.random() * WSUM;
  for (let i = 0; i < CARS.length; i++) { r -= WEIGHTS[i]; if (r <= 0) return CARS[i]; }
  return CARS[0];
}

const BOLT_ONS = CATALOG.filter(p => ['intake', 'exhaust', 'suspension', 'wheels', 'tint', 'ecu'].includes(p.cat) && p.price < 1500 && !p.makes && !p.eng);

let seq = 0;
export function makeListing(model = weightedCar()) {
  const maxYear = Math.min(model.years[1], CURRENT_YEAR - (model.years[1] >= CURRENT_YEAR - 1 ? 1 : 0));
  const year = Math.round(rnd(model.years[0], Math.max(model.years[0], maxYear)));
  const age = Math.max(1, CURRENT_YEAR - year);
  let miles = 13500 * Math.pow(age, 0.85) * rnd(0.6, 1.25);
  if (Math.random() < 0.25) miles *= rnd(1.25, 1.5);  // high-mileage special
  if (model.market && Math.random() < 0.6) miles *= rnd(0.25, 0.6); // collectors drive less
  miles = Math.round(Math.min(miles, 340000) / 100) * 100;

  const cond = condFromMiles(miles);
  const issues = [];
  let priceMult = 1;
  const nIssues = miles > 150000 ? Math.floor(rnd(1, 3.6)) : miles > 70000 ? Math.floor(rnd(0, 2.4)) : Math.floor(rnd(0, 1.3));
  const pool = ISSUES.filter(i => !i.manual || /MT/.test(model.transCode));
  for (let i = 0; i < nIssues; i++) {
    const tot = pool.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * tot, pickd = pool[0];
    for (const it of pool) { r -= it.w; if (r <= 0) { pickd = it; break; } }
    if (issues.includes(pickd.text)) continue;
    pickd.fx(cond); issues.push(pickd.text); priceMult *= pickd.price || 1;
  }
  const perks = [];
  if (Math.random() < 0.45) { const p = pick(PERKS); p.fx(cond); perks.push(p.text); }
  for (const k in cond) cond[k] = Math.round(clamp(cond[k], 5, 100));

  const titleRoll = Math.random();
  const title = titleRoll < 0.07 ? 'Salvage' : titleRoll < 0.17 ? 'Rebuilt' : 'Clean';

  // a few previous-owner mods
  const mods = {};
  const visual = {};
  if (Math.random() < 0.35) {
    const n = Math.floor(rnd(1, 3.5));
    for (let i = 0; i < n; i++) {
      const p = pick(BOLT_ONS);
      if (p.visual) visual[p.cat] = p.value; else mods[p.cat] = p.id;
    }
  }
  const color = Math.random() < 0.6 ? pick(['#9aa0a8', '#24262b', '#f2f2f2', '#3d4452', '#7a1414', '#1b4fc4', '#c8b98a', '#5a5d63', '#0d0d0d', '#4a5232']) : model.color;

  const value = marketValue(model, year, miles, cond, title) * priceMult;
  const greed = rnd(0.9, 1.3);
  const price = roundPrice(value * greed);
  const firm = Math.random() < 0.2;
  const floor = firm ? price * 0.97 : Math.min(price * rnd(0.78, 0.94), value * rnd(0.95, 1.1));

  const desc = [pick(OPENERS), ...perks, ...issues.map(s => s + '.'), Object.keys(mods).length || Object.keys(visual).length ? 'Has some mods, ask.' : '', firm ? 'Price is firm.' : pick(CLOSERS)]
    .filter(Boolean).join(' ');

  return {
    id: `ls_${Date.now().toString(36)}_${(seq++).toString(36)}`,
    modelId: model.id, year, miles, cond, title, issues, perks, mods, visual: { ...visual, paint: color },
    price, floor: Math.round(floor), value: Math.round(value), firm, patience: firm ? 1 : Math.floor(rnd(2, 4)),
    seller: { name: `${pick(FIRST)} ${pick(LAST)}`, rating: +(rnd(3.6, 5)).toFixed(1), color: `hsl(${Math.floor(rnd(0, 360))} 45% 45%)` },
    district: pick(DISTRICTS), posted: Math.floor(rnd(1, 140)), desc,
    title_: `${year} ${carName(model)}`,
  };
}

export function generateListings(count = 30) {
  const out = [];
  // guarantee a handful of real beaters a broke new player can afford
  const cheap = CARS.filter(c => !c.market && c.msrp < 30000 && c.years[1] < 2016);
  const old = CARS.filter(c => !c.market && c.msrp < 30000 && c.years[1] < 2012);
  for (let i = 0, got = 0; got < 4 && i < 120; i++) {         // at least four that really cost under $4,500
    const l = makeListing(pick(old));
    if (l.price <= 4500) { out.push(l); got++; }
  }
  for (let i = 0; i < 2; i++) out.push(makeListing(pick(cheap)));
  while (out.length < count) out.push(makeListing());
  return out;
}

// Haggling. Returns { result: 'accept'|'counter'|'decline'|'blocked', price?, msg }
export function negotiate(listing, offer) {
  if (listing.patience <= 0) return { result: 'blocked', msg: 'Seller stopped replying.' };
  if (offer >= listing.price) return { result: 'accept', price: listing.price, msg: 'Deal. When can you come get it?' };
  if (offer >= listing.floor) return { result: 'accept', price: Math.round(offer), msg: pick(['Ok deal.', 'Fine, you got it.', 'Deal if you can come today.', 'Ugh ok. Deal.']) };
  listing.patience--;
  if (offer < listing.floor * 0.75) {
    return { result: listing.patience <= 0 ? 'blocked' : 'decline', msg: pick(['lol no', 'Not even close.', 'Did you read the listing?', 'No lowballs.', 'Seen.']) };
  }
  const counter = roundPrice(Math.max(listing.floor, (listing.price + offer) / 2));
  listing.price = counter;
  return { result: 'counter', price: counter, msg: `Best I can do is $${counter.toLocaleString('en-US')}.` };
}

// Offers from buyers when the player lists a car for sale.
export function buyerOffer(value, asking) {
  const ratio = asking / value;
  if (ratio > 1.35) return null;
  const chance = clamp(1.3 - ratio, 0.05, 0.6);
  if (Math.random() > chance) return null;
  const amount = roundPrice(Math.min(asking, value * rnd(0.72, 1.02)));
  return { amount, name: `${pick(FIRST)} ${pick(LAST)}`, msg: pick(['Is this still available?', 'Would you take', 'Cash today:', 'Can do', 'Hi! Interested.']) };
}

export { CAR_BY_ID };
