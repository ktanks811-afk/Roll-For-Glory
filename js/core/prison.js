// TDCJ: doing your time for real. A state jail or prison sentence puts you on
// the chain bus to the Wynne Unit in Huntsville (ui/prison.js draws the
// compound). Every night you sleep in your bunk is a year off your sentence.
// The days in between are yours: work your job, hit the weight pile, play
// spades for soups, hustle contraband (and catch new charges), and fight your
// case from the law library.
//
// Murder is life. Parole doesn't come up for 30 years and capital murder never
// gets parole at all, so the only way out is to win an appeal, and the
// appeals never run out: a motion for new trial, the Second Court of Appeals,
// the Court of Criminal Appeals, state habeas, federal habeas, and then one
// successive writ after another for as long as you live.
//
// Save key: s.prison (null when you're free). DOM-free so check-data can test it.

import { spend, canAfford, uid } from './state.js';
import { ensureJustice, LIFE_PAROLE_YEARS, prisonYears, describe, CLASSES } from './justice.js';
import { CHARGE_BY_KIND } from '../data/charges.js';

export const UNITS = {
  prison: { name: 'TDCJ Wynne Unit', where: 'Huntsville, TX' },
  statejail: { name: 'TDCJ Lindsey State Jail', where: 'Jacksboro, TX' },
};

// The appeal ladder. years: how long a ruling takes (in nights slept);
// odds: chance of winning with a lawyer / filing it yourself; fee: the lawyer.
export const APPEALS = [
  { id: 'mnt', name: 'Motion for new trial', court: 'Trial court', years: 1, odds: [0.06, 0.03], fee: 15000 },
  { id: 'direct', name: 'Direct appeal', court: 'Second Court of Appeals, Fort Worth', years: 2, odds: [0.08, 0.03], fee: 35000 },
  { id: 'pdr', name: 'Petition for discretionary review', court: 'Texas Court of Criminal Appeals', years: 1, odds: [0.04, 0.015], fee: 25000 },
  { id: 'habeas', name: 'State habeas writ (Art. 11.07)', court: 'Texas Court of Criminal Appeals', years: 2, odds: [0.05, 0.02], fee: 40000 },
  { id: 'federal', name: 'Federal habeas petition (§ 2254)', court: 'U.S. District Court, Southern District of Texas', years: 3, odds: [0.04, 0.01], fee: 50000 },
  { id: 'successive', name: 'Successive writ', court: 'Texas Court of Criminal Appeals', years: 1, odds: [0.02, 0.007], fee: 20000 },
];
export const appealAt = stage => APPEALS[Math.min(stage, APPEALS.length - 1)];

export const JOBS = {
  field: { name: 'Field squad', desc: 'Hoe in hand under the Texas sun. Unpaid, but the board notices.' },
  kitchen: { name: 'Kitchen', desc: 'Up at 3 AM making biscuits. Extra food.' },
  shop: { name: 'Vocational auto shop', desc: 'Rebuilding State vehicles. You stay sharp on cars.' },
  laundry: { name: 'Laundry', desc: 'Folding whites all day. Quiet.' },
};

export const COMMISSARY = [
  { id: 'soup', name: 'Ramen soup', price: 1, food: 25, icon: '🍜' },
  { id: 'honeybun', name: 'Honey bun', price: 2, food: 20, energy: 5, icon: '🥐' },
  { id: 'chips', name: 'Hot chips + summer sausage', price: 4, food: 35, icon: '🌶' },
  { id: 'coffee', name: 'Instant coffee', price: 3, energy: 30, icon: '☕' },
  { id: 'stamps', name: 'Book of stamps', price: 10, icon: '✉' },
  { id: 'radio', name: 'Clear-case radio', price: 40, respect: 5, icon: '📻', once: true },
  { id: 'shoes', name: 'Commissary sneakers', price: 55, respect: 6, icon: '👟', once: true },
];

const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

// Off to TDCJ. sent: the sentence from justice.sentence(); crime: the top charge.
export function enterPrison(s, sent, { crime = '', evidence = 0.85, cause = 0 } = {}) {
  const facility = sent.facility === 'statejail' ? 'statejail' : 'prison';
  s.prison = {
    id: uid('tdcj'),
    tdcj: 2400000 + Math.floor(Math.random() * 900000),
    facility,
    crime, cause,
    sentence: describe(sent),
    life: !!sent.life, lwop: !!sent.lwop,
    years: sent.life ? null : prisonYears(sent),
    paroleAt: sent.life && !sent.lwop ? (sent.paroleYears || LIFE_PAROLE_YEARS) : null,
    served: 0,
    startDay: s.time.day,
    evidence,
    conduct: 50,         // the parole board reads your file
    respect: 10,         // the yard reads you
    strength: 0,
    books: 0,            // your trust fund (commissary money)
    job: 'field',
    owned: [],
    day: { worked: false, ate: false, lifted: false, chapel: false, visit: false, hustled: false, fought: false },
    appeal: { stage: 0, pending: null, log: [] },
    infractions: 0,
    log: [],
  };
  return s.prison;
}

export const inPrison = s => !!s?.prison;
export const yearsLeft = p => p.life ? Infinity : Math.max(0, p.years - p.served);

// Your people put money on your books (out of your bank).
export function putOnBooks(s, amount) {
  const p = s.prison;
  if (!p || amount <= 0 || !canAfford(s, amount)) return false;
  if (!spend(s, amount, 'TDCJ trust fund deposit')) return false;
  p.books += amount;
  return true;
}

export function buy(s, id) {
  const p = s.prison, it = COMMISSARY.find(x => x.id === id);
  if (!p || !it || p.books < it.price) return { ok: false };
  if (it.once && p.owned.includes(id)) return { ok: false, have: true };
  p.books -= it.price;
  if (it.food) s.player.food = clamp((s.player.food ?? 100) + it.food);
  if (it.energy) s.player.energy = clamp((s.player.energy ?? 100) + it.energy);
  if (it.respect) p.respect = clamp(p.respect + it.respect);
  if (it.once) p.owned.push(id);
  return { ok: true, item: it };
}

// Once a day each. Returns a line for the log, or null when it's done for today.
export function work(s) {
  const p = s.prison;
  if (p.day.worked) return null;
  p.day.worked = true;
  p.conduct = clamp(p.conduct + 3);
  s.player.energy = clamp((s.player.energy ?? 100) - 20);
  if (p.job === 'kitchen') s.player.food = clamp((s.player.food ?? 100) + 25);
  return `${JOBS[p.job].name}: a full shift. The officer marks you present.`;
}

export function chow(s) {
  const p = s.prison;
  if (p.day.ate) return null;
  p.day.ate = true;
  s.player.food = clamp((s.player.food ?? 100) + 60);
  return 'Chow hall: beans, cornbread, a square of cake. You eat it all.';
}

export function lift(s) {
  const p = s.prison;
  if (p.day.lifted) return null;
  p.day.lifted = true;
  p.strength = clamp(p.strength + 2);
  p.respect = clamp(p.respect + 1);
  s.player.energy = clamp((s.player.energy ?? 100) - 15);
  return `Weight pile. Strength ${p.strength}.`;
}

export function chapel(s) {
  const p = s.prison;
  if (p.day.chapel) return null;
  p.day.chapel = true;
  p.conduct = clamp(p.conduct + 2);
  return 'Chapel service. The chaplain remembers your name.';
}

// Spades for soups. bet in dollars of commissary.
export function spades(s, bet, rng = Math.random) {
  const p = s.prison;
  bet = Math.min(bet, p.books);
  if (bet <= 0) return { ok: false };
  const win = rng() < 0.47 + p.respect / 1000;
  p.books += win ? bet : -bet;
  return { ok: true, win, bet };
}

// Moving phones and tobacco. Good money, and a new charge if you get caught.
export function hustle(s, rng = Math.random) {
  const p = s.prison;
  if (p.day.hustled) return { ok: false };
  p.day.hustled = true;
  const caught = rng() < 0.18;
  if (!caught) {
    const pay = 40 + Math.floor(rng() * 120);
    p.books += pay;
    p.respect = clamp(p.respect + 2);
    return { ok: true, caught: false, pay };
  }
  const kind = rng() < 0.5 ? 'prison_phone' : 'prison_contraband';
  return { ok: true, caught: true, ...newCase(s, kind) };
}

// Somebody tests you on the yard. Win or lose, a case if the officers see it.
export function fight(s, rng = Math.random) {
  const p = s.prison;
  if (p.day.fought) return { ok: false };
  p.day.fought = true;
  const win = rng() < 0.35 + p.strength / 200 + p.respect / 400;
  p.respect = clamp(p.respect + (win ? 8 : -4));
  s.player.energy = clamp((s.player.energy ?? 100) - 25);
  const caught = rng() < 0.3;
  return { ok: true, win, caught, ...(caught ? newCase(s, 'inmate_assault') : {}) };
}

// A disciplinary case that the DA files: a new conviction and more time.
function newCase(s, kind) {
  const p = s.prison, c = CHARGE_BY_KIND[kind];
  const add = c.cls === 'F2' ? 3 : 2;
  p.infractions++;
  p.conduct = clamp(p.conduct - 30);
  if (!p.life) p.years += add;
  ensureJustice(s).convictions.push({ day: s.time.day, text: c.text, cls: c.cls, sentence: p.life ? 'Stacked on a life sentence' : `${add} more years TDCJ` });
  return { charge: c.text, added: p.life ? 0 : add };
}

// File the next appeal. lawyer: pay the fee for a real attorney.
export function fileAppeal(s, lawyer = false) {
  const p = s.prison, a = p.appeal;
  if (a.pending) return { ok: false, why: 'pending' };
  const A = appealAt(a.stage);
  if (lawyer && !spend(s, A.fee, `Appellate attorney: ${A.name}`)) return { ok: false, why: 'money' };
  a.pending = { stage: a.stage, lawyer, filed: p.served, decide: p.served + A.years };
  return { ok: true, appeal: A };
}

// How good a shot this appeal has. A thin case at trial makes a better appeal.
export function appealOdds(p, stage, lawyer) {
  const A = appealAt(stage);
  const weak = clamp(1 + (0.85 - (p.evidence ?? 0.85)) * 4, 0.5, 3);
  return A.odds[lawyer ? 0 : 1] * weak;
}

// Lights out: a year goes by. Returns what happened, for the screen.
// out: 'served' | 'parole' | 'appeal' when you walk out.
export function sleepYear(s, rng = Math.random) {
  const p = s.prison;
  p.served++;
  s.player.energy = 100;
  s.player.food = clamp((s.player.food ?? 100) - 35);
  const ev = { year: p.served, out: null, appeal: null, parole: null };
  // a ruling comes down
  const a = p.appeal;
  if (a.pending && p.served >= a.pending.decide) {
    const A = appealAt(a.pending.stage), won = rng() < appealOdds(p, a.pending.stage, a.pending.lawyer);
    a.log.push({ year: p.served, name: A.name, court: A.court, won });
    ev.appeal = { name: A.name, court: A.court, won };
    a.pending = null;
    if (won) { ev.out = 'appeal'; return ev; }
    a.stage++;
  }
  // a set sentence runs out
  if (!p.life && p.served >= p.years) { ev.out = 'served'; return ev; }
  // a life sentence: the board sees you every year once you've done 30
  if (p.life && !p.lwop && p.served >= p.paroleAt) {
    const chance = clamp(0.06 + p.conduct / 600 - p.infractions * 0.02, 0.01, 0.3);
    const granted = rng() < chance;
    ev.parole = { granted };
    if (granted) { ev.out = 'parole'; return ev; }
  }
  p.day = { worked: false, ate: false, lifted: false, chapel: false, visit: false, hustled: false, fought: false };
  return ev;
}

// Walking out. An appeal you won takes the conviction off your record.
export function leavePrison(s, how) {
  const p = s.prison;
  if (!p) return null;
  if (how === 'appeal') {
    const j = ensureJustice(s);
    for (const c of j.convictions) if (c.text === p.crime || (p.life && CLASSES[c.cls]?.felony && c.day >= p.startDay - 1 && /life/i.test(c.sentence || ''))) c.sentence = 'Conviction reversed on appeal';
    j.convictions = j.convictions.filter(c => c.sentence !== 'Conviction reversed on appeal');
  }
  s.prison = null;
  return { years: p.served, how };
}
