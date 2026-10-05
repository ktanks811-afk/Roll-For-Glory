// The Tarrant County courts. Getting arrested (or turning yourself in on a
// felony warrant) files a criminal case against you. A magistrate sets bail
// and a court date; you show up at the Tarrant County Courthouse on that day,
// or a bail-jumping warrant goes out. At the hearing the DA offers a plea
// deal, or you take it to trial with a public defender or a paid lawyer. A
// conviction means a fine, probation, county jail, state jail or prison,
// depending on the charge and your record. Time inside is simulated (the
// clock skips ahead and your businesses keep running) at a compressed rate:
// a 10-year bid is about two weeks of game time.
//
// Charges follow the Texas Penal Code classes. Fine-only stuff (Class C:
// speeding, red lights, loud exhaust) stays a ticket and never goes to court.
// DOM-free so check-data can test it.

import { uid, spend, canAfford } from './state.js';
import { emit } from './events.js';
import { theftClass } from './loot.js';
import { CHARGE_BY_KIND, stackCharges } from '../data/charges.js';

// Real Texas punishment ranges (days) and what bail usually looks like.
export const CLASSES = {
  C:   { rank: 0, name: 'Class C misdemeanor', short: 'Class C', felony: false, days: [0, 0], fine: [100, 500], bail: 0 },
  B:   { rank: 1, name: 'Class B misdemeanor', short: 'Class B', felony: false, days: [3, 180], fine: [300, 2000], bail: 500 },
  A:   { rank: 2, name: 'Class A misdemeanor', short: 'Class A', felony: false, days: [10, 365], fine: [500, 4000], bail: 1500 },
  SJF: { rank: 3, name: 'State jail felony', short: 'State jail felony', felony: true, days: [180, 730], fine: [1500, 10000], bail: 5000 },
  F3:  { rank: 4, name: 'Third-degree felony', short: '3rd-degree felony', felony: true, days: [730, 3650], fine: [2000, 10000], bail: 10000 },
  F2:  { rank: 5, name: 'Second-degree felony', short: '2nd-degree felony', felony: true, days: [730, 7300], fine: [3000, 10000], bail: 25000 },
  F1:  { rank: 6, name: 'First-degree felony', short: '1st-degree felony', felony: true, days: [1825, 36135], fine: [5000, 10000], bail: 75000 },
  CF:  { rank: 7, name: 'Capital felony', short: 'Capital felony', felony: true, days: [36135, 36135], fine: [0, 0], bail: 0 },
};
// the ladder drug and money charges climb (a capital felony is only ever murder)
const BY_RANK = Object.keys(CLASSES).filter(k => k !== 'CF').sort((a, b) => CLASSES[a].rank - CLASSES[b].rank);

// Murder is life. Parole comes up after 30 years; capital murder never does.
export const LIFE_PAROLE_YEARS = 30;

export const COURT_COSTS = 290;
export const BOND_FEE = 0.10;          // a bondsman keeps 10% of the bail
export const DOCKET = [8, 17];         // the courtroom is open 8 AM to 5 PM
export const DOCKET_HOUR = 9;          // your case is set for 9 AM
export const FINE_PER_DAY = 150;       // Texas lets you sit out an unpaid fine in jail
export const PROBATION_FEE = 60;       // weekly supervision fee
export const STORAGE_PER_DAY = 20;     // impound storage while you're locked up
export const IMPOUND_LOT = 'pspd_central';   // your car waits behind the Central Precinct

// What an offence from the street turns into in court. Anything not listed
// is a Class B. `tg`: a "3g" offence, so parole comes only after half the sentence.
export function classify(o) {
  const t = (o.text || '').toLowerCase();
  // drug charges carry their class in the kind: 'drugs_F2' (core/drugs.js)
  if (o.kind?.startsWith('drugs_') && CLASSES[o.kind.slice(6)]) return { cls: o.kind.slice(6), text: o.text };
  // money laundering too, sized by the amount: 'launder_F3' (core/bank.js)
  if (o.kind?.startsWith('launder_') && CLASSES[o.kind.slice(8)]) return { cls: o.kind.slice(8), text: o.text };
  switch (o.kind) {
    case 'speeding': case 'redlight': case 'noise': case 'reckless': case 'fta':
      return { cls: 'C', text: o.text };
    case 'burnout': return { cls: 'B', text: 'Racing on a highway (exhibition of speed).' };
    case 'hitrun': return { cls: 'B', text: 'Leaving the scene of an accident.' };
    case 'brandish': return { cls: 'B', text: 'Disorderly conduct: displaying a firearm.' };
    case 'evading': return /vehicle/.test(t) ? { cls: 'F3', text: 'Evading arrest or detention with a vehicle.' } : { cls: 'A', text: 'Evading arrest or detention.' };
    case 'shots': return /assault/.test(t) ? { cls: 'F2', text: 'Aggravated assault with a deadly weapon.', tg: true } : { cls: 'F3', text: 'Deadly conduct: discharging a firearm.' };
    case 'assault': return /officer|police/.test(t) ? { cls: 'F1', text: 'Aggravated assault on a public servant.', tg: true } : { cls: 'F2', text: 'Aggravated assault with a deadly weapon.', tg: true };
    case 'robbery': return { cls: 'F1', text: /mugging/.test(t) ? 'Aggravated robbery (armed mugging).' : `Aggravated robbery${o.text?.includes('—') ? ' — ' + o.text.split('—').pop().trim().replace(/\.$/, '') : ''}.`, tg: true };
    case 'driveby': return /gang/.test(t) ? { cls: 'F2', text: 'Engaging in organized criminal activity: deadly conduct (drive-by shooting).' } : { cls: 'F3', text: 'Deadly conduct: drive-by shooting.' };
    case 'chop': return /parts/i.test(t) ? { cls: 'SJF', text: 'Theft of property: stolen vehicle parts.' } : { cls: 'F3', text: 'Engaging in organized criminal activity: operating a chop shop.' };
    case 'stolen_goods': {
      // a stolen gun is a state jail felony whatever it's worth (Texas 31.03(e)(4)(C))
      let cls = theftClass(o.value || 0);
      if (o.guns > 0 && CLASSES[cls].rank < CLASSES.SJF.rank) cls = 'SJF';
      return { cls, text: `Theft of property (stolen goods${o.guns > 0 ? ', incl. a firearm' : cls === 'C' ? '' : `, ${o.value >= 2500 ? 'over $2,500' : o.value >= 750 ? 'over $750' : 'over $100'}`}).` };
    }
    case 'gta': return { cls: 'SJF', text: 'Unauthorized use of a motor vehicle (stolen car).' };
    case 'carjack': return /armed/i.test(t) ? { cls: 'F1', text: 'Aggravated robbery (armed carjacking).', tg: true } : { cls: 'F2', text: 'Robbery (carjacking).' };
    case 'auto': return { cls: 'F3', text: 'Possession of a prohibited weapon (machine gun).' };
    case 'bailjump': return { cls: o.felony ? 'F3' : 'A', text: o.felony ? 'Bail jumping and failure to appear (felony).' : 'Bail jumping and failure to appear.' };
    default: {
      // the rest of the Penal Code (data/charges.js)
      const c = CHARGE_BY_KIND[o.kind];
      if (c) return { cls: c.cls, text: c.text, tg: !!c.tg, life: !!c.life, lwop: !!c.lwop };
      return { cls: 'B', text: o.text || 'Misdemeanor offense.' };
    }
  }
}

export function ensureJustice(s) {
  s.justice ??= {};
  const j = s.justice;
  j.cases ??= [];          // open cases (normally just one)
  j.convictions ??= [];    // { day, text, cls, sentence }
  j.probation ??= null;    // { until, text, deferred, suspended: { days, cls, tg }, caseId }
  j.nextCause ??= 1712000 + Math.floor(Math.random() * 9000);
  return j;
}

export const openCase = s => ensureJustice(s).cases[0] || null;
export const topClass = charges => charges.reduce((top, c) => CLASSES[c.cls].rank > CLASSES[top].rank ? c.cls : top, 'C');
export const isFelonyCase = c => CLASSES[topClass(c.charges)].felony;
// Prior convictions; felonies count double.
export const priorScore = s => ensureJustice(s).convictions.reduce((t, c) => t + (CLASSES[c.cls]?.felony ? 2 : 1), 0);
export const courtName = c => isFelonyCase(c) ? `${['297th', '371st', '372nd', '396th', '432nd'][c.cause % 5]} District Court` : `County Criminal Court No. ${1 + c.cause % 10}`;
export const fmtCourt = d => `day ${d.day}, ${d.hour > 12 ? d.hour - 12 : d.hour}:00 ${d.hour >= 12 ? 'PM' : 'AM'}`;

// Splits what the police wrote down into criminal charges (court) and
// fine-only tickets (paid at booking). evidence: how solid the State's case
// is for each charge (0..1): caught in the act ≈ 0.85, a warrant from a
// plate photo ≈ 0.6.
// stack: let the DA add the related charges from data/charges.js on top
// (armed: you had a gun on you; felon: you have a prior felony conviction).
export function charge(items, evidence = 0.85, { stack = false, armed = false, felon = false, rng = Math.random } = {}) {
  const charges = [], tickets = [];
  const all = stack ? [...items, ...stackCharges(items, { armed, felon, rng })] : items;
  for (const o of all) {
    const c = classify(o);
    if (c.cls === 'C') { tickets.push({ ...o, fine: o.fine || CHARGE_BY_KIND[o.kind]?.fine || 0 }); continue; }
    if (charges.some(x => x.text === c.text)) continue;
    const ch = { cls: c.cls, text: c.text, tg: !!c.tg, evidence: (o.evidence ?? evidence) * (o.stacked ? 0.85 : 1) };
    if (c.life) { ch.life = true; if (c.lwop) ch.lwop = true; }
    charges.push(ch);
  }
  return { charges, tickets };
}

export const isLifeCase = c => c.charges.some(x => x.life);
export const hasFelonyPrior = s => ensureJustice(s).convictions.some(c => CLASSES[c.cls]?.felony);

// File a case, or add the new charges to the one you already have pending.
export function fileCase(s, charges, { surrender = false } = {}) {
  const j = ensureJustice(s);
  let c = j.cases[0];
  if (!c) {
    c = { id: uid('case'), cause: j.nextCause++, filed: s.time.day, charges: [], bond: { type: 'pending', amount: 0, paid: 0 }, fta: false, surrender, held: false };
    j.cases.push(c);
  }
  for (const ch of charges) if (!c.charges.some(x => x.text === ch.text)) c.charges.push(ch);
  const felony = isFelonyCase(c);
  c.date = { day: s.time.day + (felony ? 3 : 2), hour: DOCKET_HOUR };
  c.violation = !!j.probation;   // arrested while on probation: the State moves to revoke
  emit('case', { filed: c });
  return c;
}

// What the magistrate does at booking.
export function bailFor(s, c) {
  const top = topClass(c.charges);
  if (isLifeCase(c)) return { held: true, amount: 0, pr: false, why: 'Charged with murder. No bond.' };
  if (c.fta || c.violation || (top === 'F1' && priorScore(s) >= 2)) return { held: true, amount: 0, pr: false, why: c.fta ? 'You skipped court before.' : c.violation ? 'Probation violation hold.' : 'Danger to the community.' };
  const sorted = c.charges.map(x => CLASSES[x.cls].bail).sort((a, b) => b - a);
  let amount = sorted[0] + sorted.slice(1).reduce((t, b) => t + b * 0.25, 0);
  amount *= 1 + 0.5 * priorScore(s);
  if (c.surrender) amount *= 0.5;
  amount = Math.max(250, Math.round(amount / 250) * 250);
  // first-time misdemeanours, or turning yourself in on a lower felony: released on your word
  const pr = (!CLASSES[top].felony && priorScore(s) === 0) || (c.surrender && CLASSES[top].rank <= CLASSES.F3.rank && priorScore(s) === 0);
  return { held: false, amount, pr };
}

// type: 'pr' (free), 'cash' (refunded when you show up), 'surety' (10% to a bondsman, gone), 'held'
export function postBond(s, c, type) {
  const b = bailFor(s, c);
  if (type === 'held' || b.held) { c.bond = { type: 'held', amount: b.amount, paid: 0 }; c.held = true; return { ok: true }; }
  if (type === 'pr' && !b.pr) return { ok: false };
  const cost = type === 'cash' ? b.amount : type === 'surety' ? Math.round(b.amount * BOND_FEE) : 0;
  if (cost && !spend(s, cost, type === 'cash' ? 'Cash bail (refunded at court)' : 'Bail bondsman fee')) return { ok: false };
  c.bond = { type, amount: b.amount, paid: cost };
  c.held = false;
  return { ok: true, cost };
}

// 'early' | 'today' (open now) | 'late' (today, but the docket closed) | 'missed'
export function courtStatus(s, c) {
  const h = (s.time.min / 60) % 24;
  if (s.time.day < c.date.day) return 'early';
  if (s.time.day > c.date.day) return 'missed';
  if (h < DOCKET[0]) return 'early';
  return h < DOCKET[1] ? 'today' : 'late';
}

// Hourly: a case whose docket closed without you becomes a bail-jumping
// warrant. Your cash bail (or the bondsman's bond) is forfeited.
export function courtTick(s, addWarrant) {
  const c = openCase(s);
  if (!c || c.fta || c.held) return null;
  const st = courtStatus(s, c);
  if (st !== 'late' && st !== 'missed') return null;
  c.fta = true;
  const felony = isFelonyCase(c);
  const ch = classify({ kind: 'bailjump', felony });
  if (!c.charges.some(x => x.text === ch.text)) c.charges.push({ cls: ch.cls, text: ch.text, tg: false, evidence: 0.95 });
  const forfeited = c.bond.type === 'cash' ? c.bond.paid : 0;
  c.bond = { type: 'forfeited', amount: c.bond.amount, paid: 0 };
  addWarrant?.(s, { kind: 'bailjump', text: `Failure to appear — Cause No. ${c.cause} (${courtName(c)}).`, fine: 0, felony, caseId: c.id });
  return { case: c, forfeited };
}

// The State's plea offer on each charge. Short version: first-timers on
// misdemeanours get deferred adjudication, felonies get the low end.
export function pleaOffer(s, c) {
  return sentence(s, c.charges, { plea: true });
}

// conviction chance per charge at trial
export function convictChance(s, ch, privateLawyer) {
  return Math.max(0.08, Math.min(0.95, ch.evidence - (privateLawyer ? 0.2 : 0) + priorScore(s) * 0.03));
}

export const lawyerFee = c => ({ B: 1500, A: 2500, SJF: 5000, F3: 10000, F2: 20000, F1: 40000, CF: 75000 })[topClass(c.charges)] || 1500;

// Before anything else, a weak misdemeanour case can get dropped.
export function dismissChance(c) {
  const top = topClass(c.charges);
  if (CLASSES[top].felony || c.fta) return 0;
  const ev = Math.max(...c.charges.map(x => x.evidence));
  return ev < 0.7 ? 0.35 : 0.08;
}

const lerp = (a, b, t) => a + (b - a) * t;
const logLerp = (a, b, t) => Math.exp(lerp(Math.log(Math.max(1, a)), Math.log(Math.max(1, b)), t));
const roundDays = d => d >= 730 ? Math.round(d / 365) * 365 : d >= 120 ? Math.round(d / 30) * 30 : Math.max(1, Math.round(d));

// The punishment for the charges you were found guilty of.
// returns { kind: 'fine'|'deferred'|'probation'|'jail', fine, days (real), served (real days you actually do), facility, probationDays (game), cls, tg, text }
export function sentence(s, convicted, { plea = false, rng = Math.random } = {}) {
  if (!convicted.length) return { kind: 'none', fine: 0, days: 0, served: 0 };
  const cls = topClass(convicted), K = CLASSES[cls], tg = convicted.some(x => x.tg && x.cls === cls);
  // murder: life in TDCJ, plea or no plea. Capital murder is life without parole.
  const life = convicted.find(x => x.life);
  if (life) {
    const lwop = convicted.some(x => x.lwop);
    return { kind: 'jail', facility: 'prison', life: true, lwop, cls, tg: true, fine: 0, days: 0, served: 0, paroleYears: lwop ? 0 : LIFE_PAROLE_YEARS, text: lwop ? 'Life without parole' : 'Life' };
  }
  const priors = priorScore(s);
  const fine = Math.round(lerp(K.fine[0], K.fine[1], Math.min(1, (plea ? 0.15 : 0.45) + priors * 0.1)) / 50) * 50 + COURT_COSTS;
  // where in the range you land: pleas low, trials higher, priors and extra counts push it up
  const pos = Math.min(1, (plea ? 0.08 : 0.4 + rng() * 0.3) + priors * 0.12 + (convicted.length - 1) * 0.08);
  const days = roundDays(K.felony ? logLerp(K.days[0], K.days[1], pos) : lerp(K.days[0], K.days[1], pos));
  const base = { fine, cls, tg, days };
  if (cls === 'C') return { ...base, kind: 'fine', days: 0, served: 0 };
  // community supervision instead of time
  if (!K.felony) {
    if (priors === 0 && plea) return { ...base, kind: 'deferred', served: 0, probationDays: cls === 'A' ? 10 : 7, text: 'Deferred adjudication' };
    if (priors <= 1) return { ...base, kind: 'probation', served: 0, probationDays: cls === 'A' ? 10 : 7, text: 'Probation' };
  } else if (priors === 0 && (cls === 'SJF' || (cls === 'F3' && plea))) {
    return { ...base, kind: plea ? 'deferred' : 'probation', served: 0, probationDays: 14, days: Math.max(days, cls === 'F3' ? 730 : 365), text: plea ? 'Deferred adjudication' : 'Probation' };
  }
  const facility = !K.felony ? 'county' : cls === 'SJF' ? 'statejail' : 'prison';
  // good time in county jail, flat time in state jail, parole in prison (half for 3g offences)
  const frac = facility === 'county' ? 0.5 : facility === 'statejail' ? 0.8 : tg ? 0.5 : 0.3;
  return { ...base, kind: 'jail', facility, served: Math.max(1, Math.round(days * frac)) };
}

// Years you actually sit in TDCJ: each night you sleep in your bunk is a year.
export const prisonYears = sent => sent.life ? Infinity : Math.max(1, Math.ceil((sent.served || 0) / 365));

// Real days inside → game minutes. Square-root compressed: 30 days ≈ a day
// and a half, 2 years ≈ a week, 10 years ≈ two weeks.
export const gameMinutes = realDays => Math.max(6 * 60, Math.round(Math.sqrt(Math.max(0, realDays)) / 4 * 1440));
// and back again, for time-served credit while you waited in jail
export const realDaysFor = gameMin => Math.round((gameMin / 1440 * 4) ** 2);

export function fmtDays(d) {
  if (d >= 730) { const y = d / 365; return `${Math.round(y)} years`; }
  if (d >= 365) return '1 year';
  if (d >= 60) return `${Math.round(d / 30)} months`;
  return `${d} day${d === 1 ? '' : 's'}`;
}

export const FACILITY = {
  county: { name: 'Tarrant County Corrections Center', where: 'Downtown Fort Worth' },
  statejail: { name: 'TDCJ Lindsey State Jail', where: 'Jacksboro, TX' },
  prison: { name: 'TDCJ Wynne Unit', where: 'Huntsville, TX' },
  holding: { name: 'Tarrant County Jail', where: 'Downtown Fort Worth — awaiting court' },
};

// Close the case with a result. Convictions go on your record; probation is
// set up; cash bail comes back. Returns the money owed and the time to serve
// (the caller runs the jail sim).
// verdicts: [{ charge, guilty }]; plea: took the deal
export function resolveCase(s, c, verdicts, { plea = false, rng = Math.random, served = 0 } = {}) {
  const j = ensureJustice(s);
  const guilty = verdicts.filter(v => v.guilty).map(v => v.charge);
  let sent = sentence(s, guilty, { plea, rng });
  const refund = c.bond.type === 'cash' ? c.bond.paid : 0;
  // probation revoked: a new conviction while on probation brings the old sentence back
  let revoked = null;
  if (j.probation && guilty.length) {
    const p = j.probation, old = p.suspended;
    revoked = { text: p.text, days: old.days };
    const oldFrac = old.cls === 'SJF' ? 0.8 : CLASSES[old.cls]?.felony ? (old.tg ? 0.5 : 0.3) : 0.5;
    const extra = Math.max(1, Math.round(old.days * oldFrac));
    if (sent.kind === 'jail') { if (!sent.life) sent.served += extra; }
    else sent = { ...sent, kind: 'jail', facility: CLASSES[old.cls]?.felony ? (old.cls === 'SJF' ? 'statejail' : 'prison') : 'county', served: extra, days: old.days };
    if (p.deferred) j.convictions.push({ day: s.time.day, text: p.text, cls: old.cls, sentence: 'Adjudicated guilty (probation revoked)' });
    j.probation = null;
  }
  const credit = served;   // time already sat in jail waiting for court
  if (sent.kind === 'jail' && !sent.life) sent.served = Math.max(0, sent.served - credit);
  if (guilty.length && sent.kind !== 'deferred') for (const g of guilty) j.convictions.push({ day: s.time.day, text: g.text, cls: g.cls, sentence: describe(sent) });
  if (sent.kind === 'deferred' || sent.kind === 'probation') {
    j.probation = { until: s.time.day + sent.probationDays, text: guilty[0].text, deferred: sent.kind === 'deferred', suspended: { days: sent.days, cls: sent.cls, tg: sent.tg }, caseId: c.id };
  }
  j.cases = j.cases.filter(x => x !== c);
  emit('case', { closed: c, sentence: sent });
  return { sentence: sent, refund, revoked, credit, guilty };
}

export function describe(sent) {
  switch (sent.kind) {
    case 'none': return 'No conviction';
    case 'fine': return 'Fine';
    case 'deferred': return `Deferred adjudication (${fmtDays(sent.days)} suspended)`;
    case 'probation': return `Probation (${fmtDays(sent.days)} suspended)`;
    case 'jail': if (sent.life) return sent.lwop ? 'Life without parole in TDCJ' : 'Life in TDCJ';
      return `${fmtDays(sent.days)} ${sent.facility === 'county' ? 'county jail' : sent.facility === 'statejail' ? 'state jail' : 'TDCJ'}`;
    default: return '';
  }
}

// The fine and costs. Whatever you can't pay, you sit out in jail.
export function payFine(s, amount, label = 'Court fine + costs') {
  if (amount <= 0) return { paid: 0, layout: 0 };
  if (spend(s, amount, label)) return { paid: amount, layout: 0 };
  const have = Math.max(0, s.cash + s.bank);
  if (have > 0) spend(s, have, label + ' (partial)');
  const rest = amount - have;
  return { paid: have, layout: Math.ceil(rest / FINE_PER_DAY) };
}

// Daily: probation ends, the weekly fee comes due.
export function probationDay(s) {
  const j = ensureJustice(s), p = j.probation;
  if (!p) return null;
  if (s.time.day > p.until) { j.probation = null; return { done: true, deferred: p.deferred }; }
  if (s.time.day % 7 === 0 && canAfford(s, PROBATION_FEE)) spend(s, PROBATION_FEE, 'Probation supervision fee');
  return null;
}

export { BY_RANK };
