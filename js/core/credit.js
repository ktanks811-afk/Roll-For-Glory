// Your credit score, and the loans it gets you.
//
// Cowtown Credit Union pulls a 300–850 score (FICO-style) built from how you
// handle what you owe in the game:
//
// - Payment history: every loan payment made on time, and every JPS bill
//   paid by its due date or through a payment plan, raises it. A missed loan
//   payment, a medical bill gone past due, an account sold to collections, a
//   court judgment, a defaulted loan or a repossession pulls it down hard.
//   Those marks fade over FADE game days and drop off after DROP days.
// - What you owe right now: accounts sitting in collections or judgment, and
//   loans you've barely paid down.
// - Age of credit: how long since your first account.
// - New credit: every application is a hard inquiry for INQ_DAYS days.
//
// The score sets your terms: whether the credit union lends to you at all, how
// much, the APR, how much down a dealer wants to finance a car, and even what
// Cowtown Mutual charges for insurance (Texas lets insurers use credit).
//
// Loans pay once every LOAN_CYCLE game days by autopay from checking, and each
// cycle counts as a month of the loan (so the APR means what it says). Miss
// one and there's a late fee and a mark; let it sit DEFAULT_AFTER days and
// the loan defaults: a car loan gets the car repossessed, and whatever is
// still owed goes to Lone Star Recovery, who sue and garnish your bank account
// like they do with medical debt.
//
// DOM-free so check-data can test it. The screens are in ui/phone.js (Bank).

import { fmtMoney, uid, gameTimeStr, carValue, modelOf } from './state.js';
import { emit, on } from './events.js';
import { sendMessage } from './story.js';

export const MIN = 300, MAX = 850, START = 650;
export const LOAN_CYCLE = 7;        // game days between payments ("a month" of the loan)
export const LATE_FEE = 39;
export const DEFAULT_AFTER = 14;    // days a payment can sit unpaid before the loan defaults
export const COLLECT_FEE = 0.2;
export const SUE_AFTER = 7;         // days in collections before Lone Star sues
export const GARNISH_EVERY = 7;
export const FADE = 60;             // days for a mark to fade to its floor
export const DROP = 150;            // days before a mark falls off your report
export const INQ_DAYS = 14;
export const MAX_LOANS = 4;
export const PERSONAL_TERMS = [6, 12, 24];
export const AUTO_TERMS = [12, 24, 36];

// What each mark costs you when it's fresh.
export const MARKS = {
  late:        { pts: 40,  name: 'Late payment' },
  bill_late:   { pts: 30,  name: 'Medical bill past due' },
  collections: { pts: 90,  name: 'Account sent to collections' },
  judgment:    { pts: 110, name: 'Civil judgment' },
  default:     { pts: 120, name: 'Loan charged off' },
  repo:        { pts: 60,  name: 'Vehicle repossessed' },
};

// The bands, best first. apr/autoApr are yearly; max is the biggest personal
// loan; carMax is the most a dealer will finance; down is the least down.
export const BANDS = [
  { min: 800, name: 'Exceptional', color: 'good', apr: 0.069, autoApr: 0.049, max: 150000, carMax: 2000000, down: 0,    ins: 0.85 },
  { min: 740, name: 'Very good',   color: 'good', apr: 0.099, autoApr: 0.069, max: 75000,  carMax: 500000,  down: 0.05, ins: 0.92 },
  { min: 670, name: 'Good',        color: 'good', apr: 0.149, autoApr: 0.099, max: 30000,  carMax: 200000,  down: 0.10, ins: 1 },
  { min: 580, name: 'Fair',        color: 'warn', apr: 0.229, autoApr: 0.159, max: 8000,   carMax: 80000,   down: 0.20, ins: 1.15 },
  { min: 300, name: 'Poor',        color: 'bad',  apr: null,  autoApr: 0.249, max: 0,      carMax: 40000,   down: 0.35, ins: 1.35 },
];
export const bandOf = score => BANDS.find(b => score >= b.min) || BANDS[BANDS.length - 1];

export function ensureCredit(s) {
  s.credit ??= {};
  const c = s.credit;
  c.opened ??= null;    // day of your first account
  c.ontime ??= 0;       // on-time payments, lifetime
  c.marks ??= [];       // { day, kind, text }
  c.inq ??= [];         // days you applied for credit
  c.loans ??= [];
  c.hist ??= [];        // { day, score }
  c.band ??= null;      // last band you were told about
  return c;
}

const fade = age => age >= DROP ? 0 : Math.max(0.25, 1 - age / FADE);
const openLoans = s => ensureCredit(s).loans.filter(l => l.status === 'open');
const collectionLoans = s => ensureCredit(s).loans.filter(l => l.status === 'collections' || l.status === 'judgment');
export const activeLoans = s => ensureCredit(s).loans.filter(l => l.status !== 'paid' && l.balance > 0);
export const loanDebt = s => activeLoans(s).reduce((t, l) => t + l.balance, 0);
const medBills = s => (s.health?.bills || []).filter(b => b.status !== 'paid' && b.balance > 0);

// The score and what went into it.
export function scoreParts(s) {
  const c = ensureCredit(s), day = s.time.day;
  const parts = [];
  const add = (label, pts) => { pts = Math.round(pts); if (pts) parts.push({ label, pts }); };
  add('On-time payments', Math.min(140, c.ontime * 4));
  if (c.opened != null) add('Age of credit', Math.min(30, day - c.opened));
  for (const m of c.marks) {
    const f = fade(day - m.day);
    if (f) add(`${MARKS[m.kind]?.name || 'Mark'}: ${m.text} (day ${m.day})`, -(MARKS[m.kind]?.pts || 30) * f);
  }
  const owedColl = collectionLoans(s).length + medBills(s).filter(b => b.status === 'collections' || b.status === 'judgment').length;
  if (owedColl) add(`${owedColl} account${owedColl > 1 ? 's' : ''} in collections right now`, -45 * owedColl);
  const late = openLoans(s).filter(l => l.late != null).length + medBills(s).filter(b => b.status === 'late').length;
  if (late) add(`${late} payment${late > 1 ? 's' : ''} past due right now`, -20 * late);
  const open = openLoans(s);
  if (open.length) {
    const u = open.reduce((t, l) => t + l.balance, 0) / Math.max(1, open.reduce((t, l) => t + l.principal, 0));
    add('Loan balances vs. what you borrowed', u > 0.9 ? -30 : u > 0.6 ? -18 : u > 0.3 ? -6 : 0);
    if (open.length >= 3) add('Lots of open loans', -12);
  }
  if (c.loans.some(l => l.status === 'paid' && l.paidClean)) add('Paid a loan off', 10);
  const inq = c.inq.filter(d => day - d < INQ_DAYS).length;
  if (inq) add(`${inq} recent application${inq > 1 ? 's' : ''} (hard inquiries)`, -5 * inq);
  const score = Math.max(MIN, Math.min(MAX, START + parts.reduce((t, p) => t + p.pts, 0)));
  return { score, parts };
}
export const creditScore = s => scoreParts(s).score;
export const creditBand = s => bandOf(creditScore(s));

function mark(s, kind, text) {
  const c = ensureCredit(s);
  c.marks.unshift({ day: s.time.day, kind, text: String(text).slice(0, 60) });
  if (c.marks.length > 30) c.marks.length = 30;
  emit('creditChange', { s });
}
function opened(s) { const c = ensureCredit(s); c.opened ??= s.time.day; }

// Other systems report payments and trouble here (JPS bills, core/health.js).
on('credit', ({ s, kind, text }) => {
  if (!s) return;
  opened(s);
  if (kind === 'ontime') ensureCredit(s).ontime++;
  else if (MARKS[kind]) mark(s, kind, text || '');
});

// Your insurance premium: cars, then your credit.
export function insurancePremium(s) {
  const base = 40 + s.cars.reduce((a, c) => a + carValue(c), 0) * 0.0022;
  return Math.round(base * creditBand(s).ins);
}

// ---------------------------------------------------------------- loans
// The level payment for `principal` over `n` cycles at a yearly `apr`.
export function payment(principal, apr, n) {
  const r = apr / 12;
  if (!r) return Math.ceil(principal / n);
  return Math.ceil(principal * r / (1 - Math.pow(1 + r, -n)));
}
export const totalCost = (principal, apr, n) => payment(principal, apr, n) * n;

// Why the credit union would say no (null = it can lend).
function blocker(s, kind) {
  const c = ensureCredit(s);
  if (collectionLoans(s).length) return 'You have a loan in collections with us. Pay that off first.';
  if (medBills(s).some(b => b.status === 'judgment')) return 'There\'s a court judgment against you. Satisfy it first.';
  if (openLoans(s).length >= MAX_LOANS) return `You already have ${MAX_LOANS} open loans.`;
  if (kind === 'personal' && !creditBand(s).apr) return `A ${creditScore(s)} is too low for a personal loan. Fair credit (580+) or better.`;
  return null;
}

// What you'd be offered. kind: 'personal' | 'auto'. price: the car (auto).
export function offer(s, kind = 'personal', price = 0) {
  const score = creditScore(s), band = bandOf(score);
  const no = blocker(s, kind);
  if (kind === 'personal') return { ok: !no, why: no, score, band, apr: band.apr, max: Math.max(0, band.max - loanDebt(s)), terms: PERSONAL_TERMS };
  const down = Math.ceil(price * band.down / 100) * 100;
  const fin = Math.min(price - down, band.carMax);
  return { ok: !no && price > 0, why: no, score, band, apr: band.autoApr, down: price - fin, financed: fin, terms: AUTO_TERMS };
}

function newLoan(s, { kind, principal, apr, n, label, carUid }) {
  const c = ensureCredit(s);
  opened(s);
  c.inq.push(s.time.day);
  c.inq = c.inq.filter(d => s.time.day - d < INQ_DAYS * 2);
  const l = { id: uid('loan'), kind, label, carUid: carUid || null, principal, balance: principal, apr, n, left: n,
    pmt: payment(principal, apr, n), opened: s.time.day, next: s.time.day + LOAN_CYCLE, late: null, missed: 0, status: 'open',
    acct: 'CCU-' + String(Math.floor(100000 + Math.random() * 900000)) };
  c.loans.unshift(l);
  c.loans = c.loans.filter((x, i) => i < 12 || x.status !== 'paid');
  emit('creditChange', { s });
  return l;
}

// Take a personal loan: the money lands in checking.
export function takeLoan(s, amount, n) {
  const o = offer(s, 'personal');
  amount = Math.round(amount / 100) * 100;
  if (!o.ok) return { ok: false, text: o.why };
  if (!PERSONAL_TERMS.includes(n)) return { ok: false, text: 'Pick a term.' };
  if (amount < 500) return { ok: false, text: 'The smallest loan is $500.' };
  if (amount > o.max) return { ok: false, text: `With a ${o.score} the most you can borrow right now is ${fmtMoney(o.max)}.` };
  const l = newLoan(s, { kind: 'personal', principal: amount, apr: o.apr, n, label: 'Personal loan' });
  s.bank += amount;
  s.ledger.unshift({ day: s.time.day, t: gameTimeStr(s.time), label: `Personal loan deposited (${l.acct})`, amount });
  emit('money', { amount, label: 'Personal loan from Cowtown Credit Union' });
  return { ok: true, loan: l, text: `Approved. ${fmtMoney(amount)} is in your checking account. ${fmtMoney(l.pmt)} every ${LOAN_CYCLE} days, ${n} payments.` };
}

// A dealer finances `principal` on a car you just drove off with.
export function financeCar(s, car, principal, n) {
  const o = offer(s, 'auto', principal);
  if (!o.ok) return { ok: false, text: o.why };
  if (!AUTO_TERMS.includes(n)) return { ok: false, text: 'Pick a term.' };
  const m = car ? modelOf(car) : null;
  const l = newLoan(s, { kind: 'auto', principal: Math.round(principal), apr: o.apr, n, label: m ? `Auto loan · ${car.year} ${m.model}` : 'Auto loan', carUid: car?.uid });
  return { ok: true, loan: l };
}

function settle(s, l, amount, label) {
  s.bank -= amount; s.stats.expenses += amount;
  s.ledger.unshift({ day: s.time.day, t: gameTimeStr(s.time), label, amount: -amount });
  if (s.ledger.length > 100) s.ledger.length = 100;
  emit('money', { amount: -amount, label });
}

// Pay toward a loan from checking (extra payments go to principal).
export function payLoan(s, l, amount = l.balance) {
  amount = Math.min(Math.round(amount), l.balance, Math.floor(s.bank));
  if (amount <= 0) return { ok: false, text: s.bank < 1 ? 'Your checking account is empty.' : 'Nothing owed.' };
  const coll = l.status === 'collections' || l.status === 'judgment';
  settle(s, l, amount, coll ? `Lone Star Recovery (${l.acct})` : `${l.label} payment`);
  l.balance -= amount;
  if (!coll && l.late != null && amount >= Math.min(l.pmt, l.balance + amount)) { l.late = null; l.next = s.time.day + LOAN_CYCLE; l.left = Math.max(1, l.left - 1); }
  if (l.balance <= 0) {
    l.balance = 0;
    l.paidClean = !coll && !l.missed;
    l.status = 'paid'; l.late = null;
    if (!coll) opened(s);
    emit('creditChange', { s });
    return { ok: true, paid: true, text: `${coll ? 'Collections account' : l.label} paid in full.` };
  }
  return { ok: true, text: `Paid ${fmtMoney(amount)}. ${fmtMoney(l.balance)} left.` };
}

// The car behind an auto loan was sold or traded in: the payoff comes out of
// the sale before you see a dime (returns what's left for you).
export function payoffOnSale(s, carUid, proceeds) {
  const l = ensureCredit(s).loans.find(x => x.status === 'open' && x.carUid === carUid);
  if (!l) return { proceeds, payoff: 0 };
  const payoff = Math.min(l.balance, proceeds);
  l.balance -= payoff;
  if (l.balance <= 0) { l.balance = 0; l.status = 'paid'; l.paidClean = !l.missed; }
  else l.carUid = null;   // sold upside down: you keep paying the rest
  emit('creditChange', { s });
  return { proceeds: proceeds - payoff, payoff };
}
export const lienOn = (s, carUid) => ensureCredit(s).loans.find(x => x.status === 'open' && x.carUid === carUid) || null;

function toCollections(s, l, notes) {
  l.status = 'collections'; l.sold = s.time.day; l.late = null;
  l.balance = Math.round(l.balance * (1 + COLLECT_FEE));
  mark(s, 'default', l.label);
  notes.push({ from: 'collections', text: `This is Lone Star Recovery Services. Cowtown Credit Union charged off your ${l.label.toLowerCase()} (${l.acct}) and placed it with us. You owe ${fmtMoney(l.balance)} (includes a ${Math.round(COLLECT_FEE * 100)}% collection fee). Pay it in the Bank app or we take you to court.` });
}

// The repo truck comes for a financed car. Auction money comes off the balance.
function repossess(s, l, notes) {
  const car = s.cars.find(c => c.uid === l.carUid);
  if (car) {
    const auction = Math.round(carValue(car) * 0.6);
    s.cars = s.cars.filter(c => c !== car);
    s.myListings = (s.myListings || []).filter(x => x.carUid !== car.uid);
    if (s.activeCar === car.uid) s.activeCar = s.cars[0]?.uid || null;
    l.balance = Math.max(0, l.balance - auction);
    l.carUid = null;
    mark(s, 'repo', `${car.year} ${modelOf(car)?.model || 'car'}`);
    notes.push({ from: 'repo', text: `DFW Recovery picked up your ${car.year} ${modelOf(car)?.make || ''} ${modelOf(car)?.model || 'car'} for Cowtown Credit Union last night. It sold at auction for ${fmtMoney(auction)}.${l.balance ? ` You still owe ${fmtMoney(l.balance)}.` : ' That covered the loan.'}` });
    emit('repo', { s, carUid: car.uid });
  }
  if (l.balance > 0) toCollections(s, l, notes);
  else { l.status = 'paid'; emit('creditChange', { s }); }
}

function garnish(s, l, notes) {
  const take = Math.min(Math.max(0, Math.floor(s.bank)), l.balance);
  l.garnish = s.time.day;
  if (take <= 0) { notes.push({ from: 'collections', text: `Garnishment on ${l.acct}: your bank account was empty. ${fmtMoney(l.balance)} still owed.` }); return; }
  s.bank -= take; s.stats.expenses += take; l.balance -= take;
  emit('money', { amount: -take, label: `Bank garnishment (${l.acct})` });
  if (l.balance <= 0) { l.balance = 0; l.status = 'paid'; }
  notes.push({ from: 'collections', text: `Garnishment: ${fmtMoney(take)} taken from your bank account for ${l.acct}.${l.balance ? ` ${fmtMoney(l.balance)} still owed.` : ' Judgment satisfied.'}` });
}

// One game day: autopay, late notices, defaults, garnishment, and the score.
export function creditDay(s) {
  const c = ensureCredit(s), day = s.time.day, notes = [];
  for (const l of c.loans) {
    if (l.status === 'open' && day >= l.next) {
      if (l.late == null) l.balance += Math.round(l.balance * l.apr / 12);   // this cycle's interest
      const due = l.left <= 1 ? l.balance : Math.min(l.balance, l.pmt);
      if (s.bank >= due) {
        settle(s, l, due, `${l.label} payment`);
        l.balance -= due;
        l.left = Math.max(1, l.left - 1);
        if (l.late == null) c.ontime++;
        l.late = null; l.next = day + LOAN_CYCLE;
        if (!l.balance) {
          l.status = 'paid'; l.paidClean = !l.missed;
          notes.push({ from: 'teller', text: `Your ${l.label.toLowerCase()} (${l.acct}) is paid off. ${l.paidClean ? 'Every payment on time. That looks real good on your credit.' : 'Congratulations, baby.'}` });
        }
      } else if (l.late == null) {
        l.late = day; l.missed++;
        l.balance += LATE_FEE;
        l.next = day + 1;
        mark(s, 'late', l.label);
        notes.push({ from: 'teller', text: `Your ${fmtMoney(l.pmt)} payment on ${l.acct} bounced. Checking only had ${fmtMoney(Math.max(0, s.bank))}. That's a ${fmtMoney(LATE_FEE)} late fee and it hit your credit. Put money in checking and autopay tries again tomorrow.${l.kind === 'auto' ? ' Don\'t let it go too long or they\'ll come get the car.' : ''}` });
      } else if (day - l.late >= DEFAULT_AFTER) {
        if (l.kind === 'auto' && l.carUid) repossess(s, l, notes); else toCollections(s, l, notes);
      } else {
        l.next = day + 1;
        if (day - l.late === DEFAULT_AFTER - 4) notes.push({ from: 'teller', text: `${l.acct} is ${day - l.late} days past due. In 4 more days the loan defaults${l.kind === 'auto' ? ' and the car gets repossessed' : ' and goes to collections'}.` });
      }
    } else if (l.status === 'collections' && day > l.sold + SUE_AFTER) {
      l.status = 'judgment'; l.balance += 54;
      mark(s, 'judgment', l.acct);
      notes.push({ from: 'collections', text: `You were sued in Tarrant County Justice Court over ${l.acct} and didn't answer. Default judgment: ${fmtMoney(l.balance)}. A writ of garnishment has been served on your bank account.` });
      garnish(s, l, notes);
    } else if (l.status === 'judgment' && day >= l.garnish + GARNISH_EVERY) garnish(s, l, notes);
  }
  // the daily score, and a text when your band changes
  const score = creditScore(s), band = bandOf(score);
  c.hist.push({ day, score });
  if (c.hist.length > 30) c.hist.shift();
  if (c.band && c.band !== band.name) {
    const up = BANDS.findIndex(b => b.name === band.name) < BANDS.findIndex(b => b.name === c.band);
    notes.push({ from: 'teller', text: up ? `Good news: your credit score is up to ${score}. That's ${band.name} credit now, so your loan rates just got better.` : `Your credit score dropped to ${score} (${band.name}). Loans are going to cost you more until you clean it up.` });
  }
  c.band = band.name;
  return notes;
}
