// Side hustles: passive income. Take a job, buy a business, or rent out your
// spare cars — they pay into your bank every game day whether you're racing,
// cruising or not even playing (while you're away they keep earning at a
// reduced rate, up to 8 real hours).
//
// A game day is 24 real minutes. Prices are tuned so a business pays itself
// back in roughly 30 game days (about 12 hours of play), and the big ones
// need rep to even get in the door.

import { game, earnBank, spend, tierOf, carValue, fmtMoney } from './state.js';
import { sendMessage } from './story.js';
import { emit, on } from './events.js';

const TAX = 0.88;                       // paychecks are taxed
const AWAY_RATE = 0.25;                 // offline earnings vs playing
const AWAY_CAP_SEC = 8 * 3600;
const GAME_DAY_SEC = 1440;              // 1 real second = 1 game minute

// Jobs: no money down, steady pay, a few slots. Needs a car to get to work.
export const JOBS = [
  { id: 'pizza',   name: 'Delivery driver',        co: 'Slice Brothers Pizza',   pay: 90,  tier: 1, blurb: 'Hot pies, bad tips, a parking ticket now and then.', mishap: { p: 0.07, text: 'parking ticket', cost: 45 } },
  { id: 'ryde',    name: 'Rideshare shifts',       co: 'Ryde',                   pay: 150, tier: 1, blurb: 'Your phone dings, strangers get in.', mishap: { p: 0.05, text: 'a rider threw up in the back', cost: 80 } },
  { id: 'tow',     name: 'Tow dispatcher',         co: 'Hook & Haul Towing',     pay: 210, tier: 2, blurb: 'You sit at the radio. Somebody else drives.', mishap: { p: 0.04, text: 'a customer disputed the bill', cost: 120 } },
  { id: 'parts',   name: 'Parts counter',          co: 'Torque Temple',          pay: 260, tier: 2, blurb: 'You know your part numbers. Rosa likes that.', mishap: null },
  { id: 'valet',   name: 'Valet lead',             co: 'Halo Exotics',           pay: 360, tier: 3, blurb: 'Parking cars you can\'t afford. Don\'t scratch them.', mishap: { p: 0.03, text: 'a scuffed wheel on a client car', cost: 400 } },
  { id: 'wrench',  name: 'Shop mechanic',          co: 'Vega Kustoms',           pay: 470, tier: 4, blurb: 'Manny lets you wrench on real builds.', mishap: null },
  { id: 'crew',    name: 'Pit crew chief',         co: 'Ironline Dragway',       pay: 680, tier: 5, blurb: 'Race-day money, every day.', mishap: null },
];

// Businesses cost real money and pay more. Upgrades raise the take.
export const BIZ = [
  { id: 'taco',   name: 'Tailpipe Tacos',        icon: '🌮', price: 9000,    tier: 1, daily: 320,   blurb: 'A food truck that parks outside every meet.' },
  { id: 'laundromat', name: 'Spin Cycle Laundromat', icon: '🫧', price: 15000, tier: 1, daily: 450, wash: 4000, blurb: 'Coin machines, cash only, and nobody counts the quarters. Built for washing money.' },
  { id: 'wash',   name: 'Suds & Slides Car Wash', icon: '🧽', price: 18000,   tier: 2, daily: 630,   blurb: 'Hand wash, wax, and gossip.' },
  { id: 'tow',    name: 'Cowtown Tow Yard',  icon: '🛻', price: 36000,   tier: 2, daily: 1260,  blurb: 'Impound fees are a beautiful thing.' },
  { id: 'detail', name: 'Gloss & Wrap Studio',   icon: '🎨', price: 62000,   tier: 3, daily: 2170,  blurb: 'Paint protection, wraps, ceramic coat.' },
  { id: 'parts',  name: 'PartsHub Storefront',   icon: '📦', price: 125000,  tier: 4, daily: 4375,  blurb: 'You resell the shop\'s own parts back to it.' },
  { id: 'shop',   name: 'Dyno & Performance Shop', icon: '🔧', price: 310000, tier: 4, daily: 10850, blurb: 'Dyno days, installs, tuning.' },
  { id: 'strip',  name: 'Ironline Dragway stake', icon: '🏁', price: 780000,  tier: 5, daily: 27300, blurb: 'A cut of every gate, every wager, every burger.' },
];
export const BIZ_BY_ID = Object.fromEntries(BIZ.map(b => [b.id, b]));
export const JOB_BY_ID = Object.fromEntries(JOBS.map(j => [j.id, j]));

export const LEVEL_MULT = [0, 1, 1.55, 2.3];
export const upgradeCost = (b, level) => Math.round(b.price * (level === 1 ? 0.6 : 1.4));
export const sellValue = (b, level) => Math.round(b.price * 0.5 + (level > 1 ? upgradeCost(b, 1) * 0.4 : 0) + (level > 2 ? upgradeCost(b, 2) * 0.4 : 0));
export const jobSlots = tier => [1, 1, 2, 2, 3][Math.max(0, Math.min(4, tier - 1))];
export const RENTAL_RATE = 0.0026;       // of the car's value, per day
export const rentalSlots = s => Math.max(0, Math.min(5, s.cars.length - 1));

export function ensure(s) {
  s.hustle ??= { jobs: [], biz: {}, rentals: [], lastReal: Date.now(), total: 0, week: 0, away: null, log: [] };
  s.hustle.lastReal ??= Date.now();
  return s.hustle;
}

// ------------------------------------------------------------------ income
export function jobIncome(s) { return ensure(s).jobs.reduce((t, id) => t + Math.round(JOB_BY_ID[id].pay * TAX), 0); }
export function bizIncome(s) { return Object.entries(ensure(s).biz).reduce((t, [id, b]) => t + Math.round(BIZ_BY_ID[id].daily * LEVEL_MULT[b.level]), 0); }
export function rentalIncome(s) {
  const h = ensure(s);
  return h.rentals.reduce((t, uid) => { const c = s.cars.find(x => x.uid === uid); return t + (c ? Math.round(carValue(c) * RENTAL_RATE) : 0); }, 0);
}
export const dailyIncome = s => jobIncome(s) + bizIncome(s) + rentalIncome(s);

// One game day of income. Returns { gross, costs, net, notes[] }.
export function runDay(s, rng = Math.random) {
  const h = ensure(s);
  const notes = [];
  let gross = jobIncome(s) + bizIncome(s) + rentalIncome(s), costs = 0;
  // job mishaps
  for (const id of h.jobs) {
    const m = JOB_BY_ID[id].mishap;
    if (m && rng() < m.p) { costs += m.cost; notes.push(`${JOB_BY_ID[id].co}: ${m.text} (−${fmtMoney(m.cost)})`); }
  }
  // business luck
  for (const [id, b] of Object.entries(h.biz)) {
    const inc = Math.round(BIZ_BY_ID[id].daily * LEVEL_MULT[b.level]);
    const r = rng();
    if (r < 0.05) { const c = inc * 2; costs += c; notes.push(`${BIZ_BY_ID[id].name}: ${['health inspection fine', 'a break-in overnight', 'equipment broke down', 'a lawsuit scare'][Math.floor(rng() * 4)]} (−${fmtMoney(c)})`); }
    else if (r > 0.96) { const c = Math.round(inc * 1.5); gross += c; notes.push(`${BIZ_BY_ID[id].name}: ${['a viral post sent a crowd your way', 'a huge weekend', 'a sponsor ordered in bulk'][Math.floor(rng() * 3)]} (+${fmtMoney(c)})`); }
  }
  // rentals: renters are rough on cars; insurance covers most of it
  for (const uid of [...h.rentals]) {
    const c = s.cars.find(x => x.uid === uid);
    if (!c) { h.rentals = h.rentals.filter(x => x !== uid); continue; }
    if (rng() < 0.03) {
      const cost = s.insurance ? 250 : Math.round(carValue(c) * 0.03);
      costs += cost; c.cond.body = Math.max(20, c.cond.body - (s.insurance ? 5 : 15));
      notes.push(`A renter dinged your ${c.year} ${c.modelId.split('_').slice(0, 2).join(' ')} (−${fmtMoney(cost)}${s.insurance ? ', insurance covered the rest' : ''})`);
    }
  }
  const net = gross - costs;
  if (gross || costs) earnBank(s, net, 'Side hustles');
  h.total += net; h.week += net;
  return { gross, costs, net, notes };
}

// Called once per game day (main.js newDay).
export function newDay(s) {
  const h = ensure(s);
  if (!h.jobs.length && !Object.keys(h.biz).length && !h.rentals.length) return null;
  const r = runDay(s);
  h.log.unshift({ day: s.time.day, net: r.net, notes: r.notes }); h.log.length = Math.min(h.log.length, 14);
  for (const n of r.notes) emit('toast', { kind: 'info', text: n });
  if (s.time.day % 7 === 0) {
    sendMessage(s, 'hustle', `📈 Weekly report: your side hustles made ${fmtMoney(h.week)} this week (about ${fmtMoney(dailyIncome(s))}/day). Deposited to your bank.`);
    h.week = 0;
  }
  return r;
}

// While the game was closed, the businesses kept running.
export function settleAway(s, now = Date.now()) {
  const h = ensure(s);
  // remember when we last paid out for this career, so reloading an old save can't pay the same hours twice
  const key = 'rollforglory.settled.' + (s.player?.name || '');
  let mark = 0; try { mark = +localStorage.getItem(key) || 0; } catch { /* storage blocked */ }
  const last = Math.max(h.lastReal || now, mark);
  try { localStorage.setItem(key, String(now)); } catch { /* storage blocked */ }
  const sec = Math.max(0, Math.min(AWAY_CAP_SEC, (now - last) / 1000));
  h.lastReal = now;
  if (!dailyIncome(s) || sec < 600) return null;                   // under ten minutes: nothing to report
  const days = sec / GAME_DAY_SEC * AWAY_RATE;
  const net = Math.round(dailyIncome(s) * days);
  if (net <= 0) return null;
  earnBank(s, net, 'Side hustles (while you were away)');
  h.total += net;
  h.away = { net, hours: Math.round(sec / 360) / 10 };
  return h.away;
}

// ------------------------------------------------------------------ actions
const err = text => ({ ok: false, text });

export function hire(s, id) {
  const h = ensure(s), j = JOB_BY_ID[id], t = tierOf(s.rep).n;
  if (!j) return err('No such job.');
  if (h.jobs.includes(id)) return err('You already work there.');
  if (t < j.tier) return err(`${j.co} wants a bigger name first (tier ${j.tier}).`);
  if (!s.cars.length) return err('You need a car to get to work.');
  if (h.jobs.length >= jobSlots(t)) return err(`You can only hold ${jobSlots(t)} job${jobSlots(t) > 1 ? 's' : ''} at your level. Quit one first.`);
  h.jobs.push(id);
  return { ok: true, text: `Hired: ${j.name} at ${j.co}. ~${fmtMoney(Math.round(j.pay * TAX))}/day after tax.` };
}
export function quit(s, id) { const h = ensure(s); h.jobs = h.jobs.filter(x => x !== id); return { ok: true, text: 'You quit.' }; }

export function buyBiz(s, id) {
  const h = ensure(s), b = BIZ_BY_ID[id];
  if (!b) return err('No such business.');
  if (h.biz[id]) return err('You already own it.');
  if (tierOf(s.rep).n < b.tier) return err(`Nobody will sell you that yet (needs tier ${b.tier}).`);
  if (!spend(s, b.price, `Bought ${b.name}`)) return err('Not enough money.');
  h.biz[id] = { level: 1, since: s.time.day };
  return { ok: true, text: `You own ${b.name}. It pays into your bank every day.` };
}
export function upgradeBiz(s, id) {
  const h = ensure(s), b = BIZ_BY_ID[id], own = h.biz[id];
  if (!own) return err('You don\'t own that.');
  if (own.level >= 3) return err('Already maxed out.');
  const cost = upgradeCost(b, own.level);
  if (!spend(s, cost, `Upgraded ${b.name}`)) return err('Not enough money.');
  own.level++;
  return { ok: true, text: `${b.name} is now level ${own.level}.` };
}
export function sellBiz(s, id) {
  const h = ensure(s), own = h.biz[id];
  if (!own) return err('You don\'t own that.');
  const v = sellValue(BIZ_BY_ID[id], own.level);
  earnBank(s, v, `Sold ${BIZ_BY_ID[id].name}`);
  delete h.biz[id];
  return { ok: true, text: `Sold for ${fmtMoney(v)}.` };
}

export function toggleRental(s, uid) {
  const h = ensure(s);
  if (h.rentals.includes(uid)) { h.rentals = h.rentals.filter(x => x !== uid); return { ok: true, text: 'Car pulled off the rental fleet.' }; }
  if (uid === s.activeCar) return err('That\'s the car you\'re driving. Switch cars first.');
  if (h.rentals.length >= rentalSlots(s)) return err(`Your fleet is full (${rentalSlots(s)}).`);
  h.rentals.push(uid);
  return { ok: true, text: 'On the rental fleet. Renters will pay daily.' };
}

// Losing your freedom costs you your day job.
on('busted', d => {
  const s = game.s; if (!s || d?.ticket) return;
  const h = ensure(s);
  if (h.jobs.length && Math.random() < 0.4) {
    const id = h.jobs.splice(Math.floor(Math.random() * h.jobs.length), 1)[0];
    sendMessage(s, 'hustle', `${JOB_BY_ID[id].co} saw the news. You're fired.`);
  }
});
