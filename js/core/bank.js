// Dirty money, the bank and the feds.
//
// Money from crime (drugs, robberies, Sal's chop shop, gang work, street
// bets) lands in your pocket as dirty cash (`s.dirty`, part of `s.cash`, see
// core/state.js). You can spend a little of it anywhere, but to put it in the
// bank or buy something big with it, it needs to look legit:
//
// - Cowtown Credit Union takes any cash, but federal law makes Denise file a
//   Currency Transaction Report (CTR) on more than $10,000 in cash in a day.
//   Breaking deposits up to stay under $10,000 is its own federal crime
//   (structuring), and the bank files a Suspicious Activity Report on it.
// - A dealer or seller who takes over $10,000 in cash files an IRS Form 8300.
// - Walking around with a big dirty stack gets people talking.
// - A business you own can run dirty cash through its books ("washing"). Up
//   to its daily capacity, it comes out as clean sales in your bank, minus
//   Keisha's 15%. Rush it past capacity and the books stop adding up.
//
// All of that builds federal attention (0–100). It cools off a little every
// quiet day. At 100, IRS Criminal Investigation indicts you for money
// laundering (a felony warrant, sized by Texas Penal Code 34.02) and seizes
// what it can trace in your account. Get arrested with a dirty stack on you
// and the cops seize it, plus a laundering charge if it's big enough.
//
// DOM-free so check-data can test it.

import { game, REPORT_LIMIT, dirtyOf, cleanOf, earnBank, fmtMoney, gameTimeStr } from './state.js';
import { emit, on } from './events.js';
import { sendMessage } from './story.js';
import { addWarrant } from './warrants.js';
import { BIZ_BY_ID, LEVEL_MULT, ensure as ensureHustle } from './hustle.js';

export { REPORT_LIMIT };
export const STRUCTURE_LOW = 8000;      // deposits from here to $9,999 look like structuring
export const HOLD_LIMIT = 25000;        // a dirty stack bigger than this gets noticed
export const WASH_CUT = 0.15;           // Keisha's fee for cooking the books
export const RUSH_MULT = 3;             // rushing the wash triples what goes through
export const SEIZE_MIN = 1000;          // cops ignore pocket money
export const DECAY = 3;                 // federal attention lost per quiet day

export const STAGES = [
  { at: 0,  name: 'Off the radar',          color: 'good', blurb: 'Nobody is looking at your money.' },
  { at: 30, name: 'Bank compliance noticed', color: 'warn', blurb: 'Your bank has flagged your account for review.' },
  { at: 60, name: 'IRS-CI opened a file',    color: 'bad',  blurb: 'Federal agents are pulling your bank records.' },
  { at: 85, name: 'Grand jury',              color: 'bad',  blurb: 'A federal grand jury is hearing your case. An indictment is close.' },
];
export const stageOf = heat => STAGES.reduce((t, x) => heat >= x.at ? x : t, STAGES[0]);

// Texas Penal Code 34.02: the class of money laundering goes by the amount.
export function launderClass(amount) {
  if (amount >= 300000) return 'F1';
  if (amount >= 150000) return 'F2';
  if (amount >= 30000) return 'F3';
  if (amount >= 2500) return 'SJF';
  if (amount >= 750) return 'A';
  return 'B';
}

export function ensureFeds(s) {
  s.dirty ??= 0;
  s.feds ??= {};
  const f = s.feds;
  f.heat ??= 0;
  f.day ??= 0;          // the day the counters below are for
  f.cashIn ??= 0;       // cash deposited today
  f.dirtyIn ??= 0;      // dirty cash deposited today
  f.ctr ??= false;      // a CTR was filed today
  f.near ??= [];        // days with an $8,000–$9,999 deposit
  f.proceeds ??= 0;     // dirty money the feds can trace (deposits, reports)
  f.washed ??= 0;       // lifetime, through your businesses
  f.ctrs ??= 0; f.sars ??= 0; f.reports ??= 0; f.indictments ??= 0; f.seized ??= 0;
  f.stage ??= 0;        // highest warning sent
  f.quiet ??= 0;        // last day something suspicious happened
  f.held ??= false;     // you were warned about the stack you carry
  f.log ??= [];         // { day, text, heat }
  s.wash ??= {};        // bizId -> { queue, rush }
  return f;
}

function rollDay(s) {
  const f = ensureFeds(s);
  if (f.day !== s.time.day) { f.day = s.time.day; f.cashIn = 0; f.dirtyIn = 0; f.ctr = false; }
  f.near = f.near.filter(d => d > s.time.day - 5);
  return f;
}

function note(s, text, heat = 0) {
  const f = ensureFeds(s);
  f.log.unshift({ day: s.time.day, text, heat: Math.round(heat) });
  if (f.log.length > 20) f.log.length = 20;
}

// Raise federal attention. Crossing a stage sends a warning; 100 is an indictment.
export function bumpFeds(s, amount, why) {
  const f = ensureFeds(s);
  amount = Math.max(0, Math.round(amount * 10) / 10);
  if (!amount) return null;
  f.heat = Math.min(100, f.heat + amount);
  f.quiet = s.time.day;
  note(s, why, amount);
  emit('feds', { heat: f.heat, amount, why });
  const st = STAGES.findIndex(x => x === stageOf(f.heat));
  if (st > f.stage) {
    f.stage = st;
    if (st === 1) sendMessage(s, 'teller', 'Hey, it\'s Denise at the credit union. Compliance asked me about the cash going through your account. Just so you know, they ask about everything over $10,000, and they ask about people who try to stay under it too.');
    if (st === 2) sendMessage(s, 'keisha', 'Heads up. A friend at the bank says IRS Criminal Investigation pulled your records. Slow down. Wash it through a business at a normal pace and stop putting cash in the bank.');
    if (st === 3) sendMessage(s, 'irs', 'TARGET LETTER: You are a target of a federal grand jury investigation into money laundering and structuring (18 U.S.C. § 1956, 31 U.S.C. § 5324). You may contact the U.S. Attorney\'s Office, Northern District of Texas.');
  }
  if (f.heat >= 100) return indict(s);
  return null;
}

// The feds come for you: a felony warrant and whatever they can trace in your account.
export function indict(s) {
  const f = ensureFeds(s);
  const amount = Math.max(2500, Math.round(f.proceeds));
  const cls = launderClass(amount);
  const w = addWarrant(s, {
    kind: `launder_${cls}`, felony: true, fine: 0,
    text: `Money laundering: ${fmtMoney(amount)} in criminal proceeds (IRS-CI federal case).`,
    evidence: 'Bank records, CTRs and Suspicious Activity Reports',
  });
  const seized = Math.max(0, Math.min(s.bank, Math.round(amount * 0.5)));
  s.bank -= seized;
  f.seized += seized;
  f.indictments++;
  f.proceeds = 0;
  f.heat = 45; f.stage = 1;
  note(s, `Indicted for money laundering${seized ? `, ${fmtMoney(seized)} seized from your account` : ''}`);
  sendMessage(s, 'irs', `INDICTMENT: A federal grand jury charged you with money laundering (${fmtMoney(amount)}). A warrant is out for your arrest.${seized ? ` ${fmtMoney(seized)} in your Cowtown Credit Union account was seized as criminal proceeds.` : ''} Turn yourself in at the courthouse or a precinct.`, { action: { type: 'gps', loc: 'courthouse' } });
  emit('toast', { kind: 'bad', text: `🏛 Federal indictment: money laundering${seized ? ` · ${fmtMoney(seized)} seized` : ''}` });
  return { warrant: w, amount, seized, cls };
}

// ---------------------------------------------------------------- the bank
// What the next cash deposit will trigger (for the UI's warning line).
export function depositPreview(s, amount, dirty) {
  const f = rollDay(s);
  amount = Math.max(0, Math.min(Math.round(amount), dirty ? dirtyOf(s) : cleanOf(s)));
  const total = f.cashIn + amount;
  return {
    amount,
    ctr: !f.ctr && total >= REPORT_LIMIT,
    structuring: amount >= STRUCTURE_LOW && amount < REPORT_LIMIT && f.near.length >= 1,
    left: Math.max(0, REPORT_LIMIT - f.cashIn),
  };
}

// Put cash in the bank. dirty: which pile it comes from.
export function depositCash(s, amount, dirty = false) {
  const f = rollDay(s);
  amount = Math.max(0, Math.min(Math.round(amount), dirty ? dirtyOf(s) : cleanOf(s)));
  if (!amount) return { ok: false, text: dirty ? 'You don\'t have any dirty cash.' : 'You don\'t have any clean cash.' };
  s.cash -= amount; s.bank += amount;
  if (dirty) s.dirty -= amount;
  s.ledger.unshift({ day: s.time.day, t: gameTimeStr(s.time), label: dirty ? 'Cash deposit (dirty)' : 'Deposit to Cowtown Credit Union', amount: 0 });
  f.cashIn += amount;
  const out = { ok: true, amount, ctr: false, sar: false, text: `Deposited ${fmtMoney(amount)}.` };
  let ind = null;
  if (dirty) {
    f.dirtyIn += amount;
    f.proceeds += amount;
    ind = bumpFeds(s, amount / 4000, `Deposited ${fmtMoney(amount)} in dirty cash`) || ind;
  }
  // a CTR goes in on more than $10,000 in cash in one day
  if (!f.ctr && f.cashIn >= REPORT_LIMIT) {
    f.ctr = true; f.ctrs++; out.ctr = true;
    if (f.dirtyIn > 0) {
      ind = bumpFeds(s, 6 + f.dirtyIn / 5000, `CTR filed on ${fmtMoney(f.cashIn)} in cash`) || ind;
      sendMessage(s, 'teller', `That's ${fmtMoney(f.cashIn)} in cash today, so I filed a Currency Transaction Report with the IRS. It's federal law over $10,000. Nothing personal, baby.`);
    } else note(s, `CTR filed on ${fmtMoney(f.cashIn)} (clean money, nothing to see)`);
    out.text += ' Denise filed a CTR.';
  }
  // breaking it up to stay under $10,000 is structuring
  if (amount >= STRUCTURE_LOW && amount < REPORT_LIMIT) {
    f.near.push(s.time.day);
    if (f.near.length >= 2) {
      f.near = []; f.sars++; out.sar = true;
      f.proceeds += amount;
      ind = bumpFeds(s, 18, 'Suspicious Activity Report: structuring deposits under $10,000') || ind;
      sendMessage(s, 'teller', 'I see what you\'re doing with the deposits just under $10,000. That\'s called structuring, and it\'s a crime by itself. I had to file a Suspicious Activity Report, and I\'m not allowed to tell you that I did.');
      out.text += ' The bank filed a Suspicious Activity Report.';
    }
  }
  out.indicted = ind;
  return out;
}

// ---------------------------------------------------------------- washing
export const ownedBiz = s => Object.entries(ensureHustle(s).biz).map(([id, b]) => ({ id, level: b.level, biz: BIZ_BY_ID[id] })).filter(x => x.biz);
// What a business can clean in a day without the books looking off.
export function washCap(s, id) {
  const own = ensureHustle(s).biz[id], b = BIZ_BY_ID[id];
  if (!own || !b) return 0;
  return Math.round((b.wash || b.daily * 3) * LEVEL_MULT[own.level] / 50) * 50;
}
export const washState = (s, id) => (ensureFeds(s), s.wash[id] ??= { queue: 0, rush: false });
export const washQueued = s => Object.values(ensureFeds(s) && s.wash).reduce((t, w) => t + (w.queue || 0), 0);

export function dropOff(s, id, amount) {
  if (!ensureHustle(s).biz[id]) return { ok: false, text: 'You don\'t own that business.' };
  amount = Math.max(0, Math.min(Math.round(amount), dirtyOf(s)));
  if (!amount) return { ok: false, text: 'You don\'t have any dirty cash.' };
  s.cash -= amount; s.dirty -= amount;
  const w = washState(s, id);
  w.queue += amount;
  const cap = washCap(s, id) * (w.rush ? RUSH_MULT : 1);
  if (!s.contacts.includes('keisha')) s.contacts.push('keisha');
  return { ok: true, text: `${fmtMoney(amount)} is in ${BIZ_BY_ID[id].name}'s books. About ${Math.max(1, Math.ceil(w.queue / cap))} day${Math.ceil(w.queue / cap) > 1 ? 's' : ''} to come out clean.` };
}
export function setRush(s, id, on) { washState(s, id).rush = !!on; }
// Take it back out, still dirty (say you're about to sell the place).
export function pullOut(s, id) {
  const w = washState(s, id), v = w.queue;
  if (!v) return { ok: false, text: 'Nothing in the books.' };
  w.queue = 0; s.cash += v; s.dirty = dirtyOf(s) + v;
  return { ok: true, text: `You took ${fmtMoney(v)} back out. Still dirty.` };
}

// Once a game day: each business pushes its share through the books.
export function washDay(s) {
  ensureFeds(s);
  const notes = [];
  for (const [id, w] of Object.entries(s.wash)) {
    if (!w.queue) continue;
    if (!ensureHustle(s).biz[id]) {     // you sold it: the cash comes back to you
      s.cash += w.queue; s.dirty = dirtyOf(s) + w.queue;
      notes.push(`${BIZ_BY_ID[id]?.name || 'Your old business'}: the new owner handed back ${fmtMoney(w.queue)} in dirty cash.`);
      w.queue = 0; continue;
    }
    const cap = washCap(s, id), max = cap * (w.rush ? RUSH_MULT : 1);
    const v = Math.min(w.queue, max);
    w.queue -= v;
    const net = Math.round(v * (1 - WASH_CUT));
    earnBank(s, net, `${BIZ_BY_ID[id].name}: sales (washed)`);
    s.feds.washed += v;
    notes.push(`${BIZ_BY_ID[id].name} washed ${fmtMoney(v)} → ${fmtMoney(net)} clean in your bank${w.queue ? ` (${fmtMoney(w.queue)} to go)` : ''}.`);
    if (v > cap) {
      s.feds.proceeds += v - cap;
      bumpFeds(s, 4 + (v - cap) / 5000, `${BIZ_BY_ID[id].name}'s sales jumped way past normal`);
    }
  }
  return notes;
}

// ---------------------------------------------------------------- every game day
export function fedsDay(s, rng = Math.random) {
  const f = rollDay(s);
  const notes = washDay(s);
  const d = dirtyOf(s);
  if (d > HOLD_LIMIT) {
    bumpFeds(s, Math.min(8, 1 + (d - HOLD_LIMIT) / 10000 * 2), `Carrying ${fmtMoney(d)} in dirty cash`);
    if (!f.held) { f.held = true; sendMessage(s, 'keisha', `Word is you're walking around with ${fmtMoney(d)} in cash. That's how people get caught. Buy a business and let me run it through the books, or the feds are going to notice before the cops do.`); }
  } else if (d < HOLD_LIMIT / 2) f.held = false;
  if (f.quiet < s.time.day - 1 && f.heat > 0) f.heat = Math.max(0, f.heat - DECAY);
  // cooled off: the next stage warning can come again
  f.stage = Math.min(f.stage, STAGES.findIndex(x => x === stageOf(f.heat)));
  if (f.heat >= 85 && rng() < 0.1) bumpFeds(s, 5, 'The grand jury heard more testimony');
  return notes;
}

// They searched you after an arrest: a big wad of dirty cash gets seized.
export function seizeCash(s) {
  const d = dirtyOf(s);
  if (d < SEIZE_MIN) return { items: [], seized: 0 };
  s.cash -= d; s.dirty = 0;
  const f = ensureFeds(s);
  f.seized += d;
  note(s, `FWPD seized ${fmtMoney(d)} in cash at booking`);
  const items = d >= 2500 ? [{ kind: `launder_${launderClass(d)}`, text: `Money laundering: ${fmtMoney(d)} in cash with no legit source.` }] : [];
  return { items, seized: d };
}

// A legit seller took over $10,000 of your dirty cash and filed IRS Form 8300.
on('cashReport', ({ s, amount, dirty }) => {
  s ||= game.s; if (!s) return;
  const f = ensureFeds(s);
  f.reports++;
  f.proceeds += dirty;
  bumpFeds(s, 5 + dirty / 5000, `Form 8300: paid ${fmtMoney(dirty)} of ${fmtMoney(amount)} in dirty cash`);
});
export const BIZ_NAME = id => BIZ_BY_ID[id]?.name || 'your business';
