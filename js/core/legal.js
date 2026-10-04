// Lawyers and snitches.
//
// Lawyers: hire one for a case (a one-time fee that scales with the top
// charge) or keep one on retainer (a weekly fee; they take any case filed
// while they're on it). A lawyer argues bail down at the magistrate, gets you
// a better plea deal, files motions that can get the case thrown out, and has
// a much better shot at trial. The tiers live in data/lawyers.js; the court
// rules that use them are in core/justice.js.
//
// Snitches: your homies (core/gangs.js) and the people working your trap
// doors (core/drugs.js) know what you've done. When one of them gets picked
// up, detectives lean on them, and the next morning they either hold it down
// or give up your name. Bail them out first and they come home; send them a
// lawyer or put money on their books and they're less likely to fold. A
// snitch's statement puts a felony warrant out for you (or new charges on the
// case you already have), backed by an informant: shakier in court, and a
// good lawyer tears it apart. You can also cooperate with the DA yourself for
// a lighter deal, but the streets find out.
//
// DOM-free so check-data can test it.

import { spend, earn, uid, addRep } from './state.js';
import { emit } from './events.js';
import { sendMessage } from './story.js';
import { LAWYERS, SET_CODE } from '../data/lawyers.js';
import { NICKS } from '../data/gangs.js';
import { TRAPS } from '../data/estate.js';
import { CLASSES, ensureJustice, openCase, lawyerFee, lawyerOf, charge, bailFor, isFelonyCase } from './justice.js';
import { addWarrant } from './warrants.js';
import { ensureGang, mySet, rankOf, readyHomies, leave as leaveSet, addBeef } from './gangs.js';
import { ensureDrugs, myTraps, trapState } from './drugs.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round50 = n => Math.round(n / 50) * 50;
const err = text => text;   // functions below return '' on success, or why not

// ---------------------------------------------------------------- lawyers
// What this lawyer charges to take this case. Free if they're on retainer
// and the case came in while they were.
export function caseFee(s, c, id) {
  const L = LAWYERS[id];
  if (!L || !c) return 0;
  if (c.retained && c.lawyer === id) return 0;
  return Math.max(500, round50(lawyerFee(c) * L.fee));
}

// Hire (or trade up to) a lawyer for the open case. If you posted cash bail,
// they file a motion to reduce it and you get the difference back.
export function hireForCase(s, c, id) {
  const L = LAWYERS[id];
  if (!L || !c) return err('No such lawyer.');
  if (c.lawyer === id) return err(`${L.name} already has your case.`);
  const cur = lawyerOf(c);
  if (cur && cur.fee >= L.fee) return err(`${cur.name} is already on it.`);
  const fee = caseFee(s, c, id);
  if (!spend(s, fee, `${L.firm}: retainer for Cause No. ${c.cause}`)) return err(`${L.name} wants ${fee.toLocaleString()} up front.`);
  c.lawyer = id; c.retained = false;
  const refund = bondReview(s, c);
  sendMessage(s, id, `I've got your case, Cause No. ${c.cause}. Don't talk to anybody about it, and I mean anybody. ${refund ? `I got your bail reduced; ${refund.toLocaleString()} is coming back to you. ` : ''}See you at the courthouse.`, { action: { type: 'legal' } });
  return '';
}

// Motion to reduce bond: cash bail gets recalculated with your lawyer arguing.
export function bondReview(s, c) {
  if (c.bond?.type !== 'cash' || c.fta) return 0;
  const b = bailFor(s, c);
  if (b.held || b.amount >= c.bond.paid) return 0;
  const back = c.bond.paid - b.amount;
  c.bond.paid = b.amount; c.bond.amount = b.amount;
  earn(s, back, 'Bail reduced (motion to reduce bond)');
  return back;
}

export const retainerActive = s => { const r = ensureJustice(s).retainer; return r && r.until >= s.time.day && LAWYERS[r.id] ? r : null; };

// Keep a lawyer on call. Paid a week at a time.
export function setRetainer(s, id) {
  const L = LAWYERS[id], j = ensureJustice(s);
  if (!L) return err('No such lawyer.');
  if (retainerActive(s)?.id === id) return err(`${L.name} is already on retainer.`);
  if (!spend(s, L.retainer, `${L.firm}: weekly retainer`)) return err(`${L.name} wants ${L.retainer.toLocaleString()} a week.`);
  j.retainer = { id, until: s.time.day + 6 };
  sendMessage(s, id, `You're on my client list. If you get picked up, tell them you want your lawyer and call me. Not one more word.`, { action: { type: 'legal' } });
  return '';
}
export function dropRetainer(s) { ensureJustice(s).retainer = null; }

// Daily: the retainer renews out of your account, or lapses.
export function retainerDay(s) {
  const j = ensureJustice(s), r = j.retainer;
  if (!r || r.until >= s.time.day) return null;
  const L = LAWYERS[r.id];
  if (L && spend(s, L.retainer, `${L.firm}: weekly retainer`)) { r.until = s.time.day + 6; return { renewed: true }; }
  j.retainer = null;
  if (L) sendMessage(s, L.id, 'Your retainer payment didn\'t go through, so you\'re off my client list. Call me when you can pay.');
  return { lapsed: true };
}

// The lawyer who'd tell you who's talking: the one on your case, or on retainer.
export function discoveryLawyer(s) {
  const c = openCase(s), L = lawyerOf(c);
  if (L?.discovery) return L;
  const r = retainerActive(s);
  return r && LAWYERS[r.id].discovery ? LAWYERS[r.id] : null;
}

// ---------------------------------------------------------------- informants
export function ensureInformants(s) {
  s.informants ??= {};
  const n = s.informants;
  n.held ??= [];       // your people sitting in county right now
  n.talked ??= [];     // { name, day, what: [text], heard } who gave you up
  n.coop ??= 0;        // the day you cooperated with the DA (0: never)
  n.marked ??= 0;      // the day the streets found out
  n.day ??= s.time.day;
  return n;
}

// How solid a homie is, 0..100. Old saves never rolled one, so it comes from the id.
export function loyaltyOf(s, h) {
  if (h.loyal == null) { let x = 0; for (const ch of String(h.id || h.nick)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; h.loyal = 40 + x % 35; }
  return h.loyal;
}

// What a locked-up person could tell detectives about you.
export function dirtOn(s, e) {
  const out = [], g = ensureGang(s), set = mySet(s);
  if (e.kind === 'homie') {
    if (g.stats.driveBys > 0) out.push({ kind: 'driveby', text: `Drive-by shooting (gang activity)${set ? `, ${set.name}` : ''}.` });
    else if (g.stats.drops > 0) out.push({ kind: 'shots', text: 'Aggravated assault with a deadly weapon (gang shooting).' });
    if (set) out.push({ kind: 'eoca', text: `Engaging in organized criminal activity (${set.name}).` });
  }
  const trap = e.kind === 'worker' ? e.ref : (ensureDrugs(s).sold > 0 && myTraps(s)[0]);
  if (trap && TRAPS[trap]) out.push({ kind: 'drugs_F2', text: `Manufacture or delivery of a controlled substance (the ${TRAPS[trap].name}).` });
  return out;
}

// Their own charge sets how long they sit and how hard detectives lean.
const PICKUP = [
  { cls: 'B', why: 'possession of marijuana' },
  { cls: 'A', why: 'unlawful carrying of a weapon' },
  { cls: 'SJF', why: 'possession of a controlled substance' },
  { cls: 'F3', why: 'a felon-in-possession gun charge' },
];
const HELD_DAYS = { B: 1, A: 2, SJF: 3, F3: 3, F2: 4, F1: 5 };
export const bailCost = e => Math.max(150, round50((CLASSES[e.cls]?.bail || 1000) * 0.1));
export const lawyerCost = e => round50(({ B: 1500, A: 2500, SJF: 5000, F3: 10000, F2: 20000, F1: 40000 })[e.cls] * 0.25);
export const BOOKS = 200;      // commissary money, a few times
export const BOOKS_MAX = 3;

// Somebody of yours just got booked into county.
// kind: 'homie' (ref: homie id) | 'worker' (ref: trap id). codef: picked up with you.
export function pickup(s, { kind, ref, name, cls, why, codef = false }, rng = Math.random) {
  const n = ensureInformants(s);
  if (n.held.some(e => e.ref === ref)) return null;
  let loyal = 30;
  if (kind === 'homie') {
    const h = ensureGang(s).homies.find(q => q.id === ref);
    if (!h) return null;
    loyal = loyaltyOf(s, h);
    name = h.nick;
    h.jail = true; h.rolling = false;
    h.out = s.time.day + (HELD_DAYS[cls] || 3);
  } else name ||= NICKS[Math.floor(rng() * NICKS.length)];
  const e = { id: uid('ci'), kind, ref, name, cls, why, codef, day: s.time.day, talkAt: s.time.day + 1, out: s.time.day + (HELD_DAYS[cls] || 3), loyal, lawyer: false, books: 0, decided: false };
  n.held.push(e);
  sendMessage(s, 'tcjail', `Collect call from ${name}: "${codef ? 'They booked me right after you' : `They got me on ${why}`}. Bail is ${bailCost(e).toLocaleString()} through a bondsman. Detectives keep coming in asking about you. Come get me, or at least send me a lawyer."`, { action: { type: 'legal' } });
  emit('toast', { kind: 'bad', text: `${name} got booked into county. Detectives are going to lean on him.` });
  return e;
}

// Your rolling homies get booked right along with you.
export function coDefendants(s, cls = 'A') {
  const g = ensureGang(s);
  if (!g.set) return [];
  // whatever you did, they get charged as a party to it, capped at a 3rd-degree felony
  const c = !CLASSES[cls] || cls === 'C' ? 'A' : CLASSES[cls].rank > CLASSES.F3.rank ? 'F3' : cls;
  return readyHomies(s).filter(h => h.rolling).map(h => pickup(s, { kind: 'homie', ref: h.id, cls: c, why: 'riding with you when you got arrested', codef: true })).filter(Boolean);
}

// The chance they give you up when detectives sit them down.
export function talkChance(s, e) {
  const base = { B: 0.08, A: 0.14, SJF: 0.22, F3: 0.3, F2: 0.4, F1: 0.5 }[e.cls] ?? 0.25;
  let p = base + 0.25 - e.loyal / 200;
  if (e.lawyer) p -= 0.22;
  p -= e.books * 0.05;
  if (e.codef) p += 0.1;        // the DA offers them a deal to testify against you
  if (e.kind === 'homie') { const g = ensureGang(s); p -= rankOf(s).n * 0.02 + (SET_CODE[g.set] || 0) / 200; }
  if (ensureInformants(s).coop) p += 0.1;     // you folded first, and they know it
  return clamp(p, 0.02, 0.85);
}

const heldBy = (s, id) => ensureInformants(s).held.find(e => e.id === id);

export function bailOut(s, id) {
  const e = heldBy(s, id);
  if (!e) return err('He\'s not in there anymore.');
  if (!spend(s, bailCost(e), `Bailed out ${e.name}`)) return err(`The bondsman wants ${bailCost(e).toLocaleString()}.`);
  release(s, e, true);
  emit('toast', { kind: 'good', text: `${e.name} is out. He won't forget that.` });
  return '';
}
export function sendLawyer(s, id) {
  const e = heldBy(s, id);
  if (!e) return err('He\'s not in there anymore.');
  if (e.lawyer) return err('He already has a lawyer.');
  if (!spend(s, lawyerCost(e), `Lawyer for ${e.name}`)) return err(`A lawyer for him costs ${lawyerCost(e).toLocaleString()}.`);
  e.lawyer = true; e.loyal = Math.min(100, e.loyal + 10);
  return '';
}
export function putOnBooks(s, id) {
  const e = heldBy(s, id);
  if (!e) return err('He\'s not in there anymore.');
  if (e.books >= BOOKS_MAX) return err('His books are good.');
  if (!spend(s, BOOKS, `Commissary for ${e.name}`)) return err('Not enough money.');
  e.books++; e.loyal = Math.min(100, e.loyal + 3);
  return '';
}

// Out of county: bailed, or their own case ran its course.
function release(s, e, bailed = false) {
  const n = ensureInformants(s);
  n.held = n.held.filter(x => x !== e);
  if (e.kind !== 'homie') return;
  const h = ensureGang(s).homies.find(q => q.id === e.ref);
  if (!h) return;
  h.jail = false; h.out = s.time.day;
  if (bailed) h.loyal = Math.min(100, loyaltyOf(s, h) + 15);
  else if (!e.talked) h.loyal = Math.min(100, loyaltyOf(s, h) + 10);
}

// They folded. Their statement becomes charges against you.
export function snitch(s, e, rng = Math.random) {
  const n = ensureInformants(s), dirt = dirtOn(s, e);
  e.decided = true;
  if (!dirt.length) return null;     // he had nothing to give them
  e.talked = true;
  const c = openCase(s);
  let filed = 0;
  if (c && !c.fta) {
    // you're already on bond: the DA adds what he told them to your case
    for (const ch of charge(dirt.map(d => ({ ...d, evidence: 0.6, ci: e.name }))).charges) if (!c.charges.some(x => x.text === ch.text)) { c.charges.push(ch); filed++; }
    if (e.codef) for (const ch of c.charges) if (!ch.ci) ch.evidence = Math.min(0.95, ch.evidence + 0.1);
  } else {
    for (const d of dirt) { addWarrant(s, { kind: d.kind, text: d.text.replace(/\.$/, ' (informant statement).'), fine: 0, felony: true, evidence: 'A confidential informant gave a statement', ci: e.name }); filed++; }
  }
  const heard = rng() < 0.5;
  n.talked.unshift({ name: e.name, day: s.time.day, what: dirt.map(d => d.text), heard });
  n.talked.length = Math.min(n.talked.length, 12);
  // he's in protective custody now; he's not one of yours anymore
  if (e.kind === 'homie') {
    const g = ensureGang(s);
    g.homies = g.homies.filter(h => h.id !== e.ref);
    g.stats.lost++;
  }
  n.held = n.held.filter(x => x !== e);
  const boss = mySet(s)?.boss;
  if (heard) {
    const text = `Word is ${e.name} was in an interview room with Gang Unit detectives for three hours. He's PC'd up now. Watch what you say.`;
    if (boss) sendMessage(s, boss, text); else sendMessage(s, 'jojo', text);
  }
  emit('toast', { kind: 'bad', text: c && !c.fta ? `Somebody talked. The DA added ${filed} charge${filed === 1 ? '' : 's'} to your case.` : 'Somebody talked. There\'s a felony warrant out for you now.' });
  emit('snitched', { name: e.name, filed, heard });
  return { filed, heard, toCase: !!(c && !c.fta) };
}

// Every morning: detectives sit down whoever's in, people come home, and
// now and then one of your homies gets picked up on his own.
export function informantsDay(s, rng = Math.random) {
  const n = ensureInformants(s), notes = [];
  for (const e of [...n.held]) {
    if (!e.decided && e.talkAt <= s.time.day) {
      if (rng() < talkChance(s, e)) snitch(s, e, rng);
      else { e.decided = true; e.loyal = Math.min(100, e.loyal + 5); }
    }
    if (n.held.includes(e) && e.out <= s.time.day) {
      release(s, e);
      notes.push(e.kind === 'homie' ? `${e.name} is home from county. He held it down.` : `${e.name} got out of county. He's done working doors for you.`);
    }
  }
  const g = ensureGang(s);
  if (g.set) {
    const free = readyHomies(s).filter(h => !n.held.some(e => e.ref === h.id));
    const p = 0.04 + Math.min(0.06, g.stats.jobs * 0.004) + ((s.heat || 0) > 1 ? 0.03 : 0);
    if (free.length && rng() < p) {
      const h = free[Math.floor(rng() * free.length)], k = PICKUP[Math.floor(rng() * PICKUP.length)];
      pickup(s, { kind: 'homie', ref: h.id, cls: k.cls, why: k.why }, rng);
    }
  }
  n.day = s.time.day;
  return { notes };
}

// SWAT hit a trap house while your worker was on the door: he's booked.
export function workerBusted(s, trapId, rng = Math.random) {
  if (!TRAPS[trapId]) return null;
  const t = trapState(s, trapId);
  const name = t.workerName || NICKS[Math.floor(rng() * NICKS.length)];
  t.workerName = null;
  return pickup(s, { kind: 'worker', ref: trapId, name, cls: 'F2', why: `the raid on the ${TRAPS[trapId].name}` }, rng);
}

// ---------------------------------------------------------------- cooperating
// Give the DA a name for a better deal. Needs a felony case and somebody to give up.
export function cooperateBlocked(s, c) {
  if (!c || !isFelonyCase(c)) return 'The DA only deals on felonies.';
  if (c.coop) return 'You already made a deal on this case.';
  const g = ensureGang(s);
  if (!g.set && !myTraps(s).length && !ensureDrugs(s).sold) return 'You don\'t know anything the DA wants.';
  return '';
}

// You signed the proffer. Whether the streets find out comes back with the sentence.
export function cooperate(s, c, rng = Math.random) {
  const why = cooperateBlocked(s, c);
  if (why) return { why };
  const n = ensureInformants(s), g = ensureGang(s);
  c.coop = true; n.coop = s.time.day;
  const out = { exposed: rng() < 0.55, lost: 0 };
  if (!out.exposed) return out;
  n.marked = s.time.day;
  addRep(s, -150, 'Snitched');
  if (g.set === 'own') {
    const keep = Math.ceil(g.homies.length / 2);
    out.lost = g.homies.length - keep;
    g.homies = g.homies.slice(0, keep);
    g.respect = Math.floor(g.respect / 2);
  } else if (g.set) {
    const was = g.set;
    out.lost = g.homies.length;
    leaveSet(s);
    addBeef(s, was, 30);   // leaving is 70; a snitch is 100
    out.kicked = was;
  }
  return out;
}

// Names behind the informant charges on your case (only a lawyer with discovery finds out).
export const informantsOn = c => [...new Set((c?.charges || []).map(x => x.ci).filter(Boolean))];

export { LAWYERS };
