// Your record with FWPD. Tickets you sign for are due in a few days; leave one
// unpaid, outrun a pursuit, or get away with a robbery or a shooting and a
// warrant goes out in your name. It lives in the save, so it follows your
// account between sessions. While one is open, patrols run your plate and
// recognise you on sight, and a traffic stop ends in handcuffs.
//
// Warrants clear when you pay the fines (misdemeanours only, at a station or
// in the FWPD app), turn yourself in at a station (tickets and misdemeanours
// 25% off; felonies get filed in court with a low bail), or get arrested
// (everything becomes charges or fines; see core/justice.js).

import { spend, fmtMoney, uid } from './state.js';
import { emit } from './events.js';

export const CITATION_DAYS = 3;       // a signed ticket is due this many game days later
export const FTA_FEE = 250;           // failure-to-appear fee added when a ticket becomes a warrant
export const SURRENDER_DISCOUNT = 0.25;
const FELONY_KINDS = new Set(['robbery', 'shots', 'assault', 'auto']);

export function ensureRecord(s) {
  s.citations ??= [];   // { id, text, fine, due }
  s.warrants ??= [];    // { id, kind, text, fine, day, felony }
  return s;
}

export const hasWarrant = s => !!s?.warrants?.length;
export const hasFelony = s => !!s?.warrants?.some(w => w.felony);
export const warrantTotal = s => (s?.warrants || []).reduce((t, w) => t + w.fine, 0);
export const citationTotal = s => (s?.citations || []).reduce((t, c) => t + c.fine, 0);
// A court warrant (you skipped your court date) can't be paid off.
export const payable = w => !w.felony && w.kind !== 'bailjump';
// What paying (without surrendering) clears: unpaid tickets + misdemeanour warrants.
export const payableTotal = s => citationTotal(s) + (s?.warrants || []).filter(payable).reduce((t, w) => t + w.fine, 0);

export function addWarrant(s, w) {
  ensureRecord(s);
  const have = s.warrants.find(x => x.kind === w.kind && x.text === w.text);
  if (have) { have.fine += w.fine; have.felony ||= !!w.felony; return have; }
  const item = { id: uid('wr'), day: s.time.day, felony: false, evidence: '', ...w };
  s.warrants.push(item);
  emit('warrant', { added: item });
  return item;
}

// A ticket you signed for instead of paying on the spot.
export function signCitation(s, items, total) {
  ensureRecord(s);
  const text = items.length === 1 ? items[0].text : `${items[0].text} (+${items.length - 1} more)`;
  const c = { id: uid('cit'), text, fine: Math.round(total), due: s.time.day + CITATION_DAYS };
  s.citations.push(c);
  return c;
}

// Once a day: tickets past their due date turn into warrants.
export function citationsDue(s) {
  ensureRecord(s);
  const late = s.citations.filter(c => c.due < s.time.day);
  if (!late.length) return [];
  s.citations = s.citations.filter(c => c.due >= s.time.day);
  return late.map(c => addWarrant(s, { kind: 'fta', text: `Failure to pay citation — ${c.text}`, fine: c.fine + FTA_FEE }));
}

// You got away. Whatever they saw you do, plus the evading charge, goes on a warrant.
// seen: false when no officer ever got eyes on you (a dispatch that never
// found you), so there is nobody you evaded.
// A crime committed in a mask (r.conceal, see core/disguise.js) only becomes
// a warrant if the witnesses or cameras can still tell it was you; the rest
// stay open cases against an unknown suspect. `evidence` says what ties a
// warrant to you, for the day it goes in front of a judge.
export function warrantForEscape(s, record = [], level = 1, seen = true, rng = Math.random) {
  const felonyCrime = record.some(r => FELONY_KINDS.has(r.kind));
  const out = [];
  out.unidentified = 0;
  if (seen) out.push(addWarrant(s, level >= 2 || felonyCrime
    ? { kind: 'evading', text: 'Evading arrest (in a vehicle).', fine: 1500 + 500 * level, felony: true, evidence: 'Officers ran your plate' }
    : { kind: 'evading', text: 'Evading detention (fled a stop).', fine: 600, evidence: 'Officers ran your plate' }));
  for (const r of record) {
    if (r.kind === 'noise' || r.kind === 'evading') continue;
    if (r.conceal > 0 && rng() < r.conceal) { out.unidentified++; s.stats && (s.stats.unsolved = (s.stats.unsolved || 0) + 1); continue; }
    out.push(addWarrant(s, { kind: r.kind, text: r.text, fine: r.fine || 250, felony: FELONY_KINDS.has(r.kind),
      evidence: r.conceal > 0 ? 'A witness picked you out despite the disguise' : 'Witnesses and cameras got your face' }));
  }
  return out;
}

// An arrest: every warrant and unpaid ticket comes off the board. Returns the
// offences for the booking officer (core/justice.js charge() sorts them into
// court charges and fines), the fine-only total, and how many warrants that was.
// How strong the State's case on a warrant is (0..1), from what tied it to you.
const strength = w => /disguise/i.test(w.evidence || '') ? 0.5 : /plate/i.test(w.evidence || '') ? 0.7 : /face|camera/i.test(w.evidence || '') ? 0.75 : 0.6;

export function takeWarrants(s) {
  ensureRecord(s);
  const n = s.warrants.length;
  const items = s.warrants.filter(w => w.kind !== 'bailjump').map(w => ({ kind: w.kind, text: w.text, fine: w.fine, felony: w.felony, evidence: strength(w) }));
  const tickets = citationTotal(s);
  s.warrants = []; s.citations = [];
  if (n) emit('warrant', { cleared: n });
  return { items, tickets, n };
}

// Everything on file is settled. Returns what it cost (not charged here).
export function serveAll(s) {
  ensureRecord(s);
  const total = warrantTotal(s) + citationTotal(s);
  const n = s.warrants.length;
  s.warrants = []; s.citations = [];
  if (n) emit('warrant', { cleared: n });
  return total;
}

// Pay tickets + misdemeanour warrants. Felony warrants stay until you surrender or are arrested.
export function payFines(s) {
  ensureRecord(s);
  const total = payableTotal(s);
  if (!total) return { ok: false, total };
  if (!spend(s, total, 'FWPD fines (warrants + citations)')) return { ok: false, total };
  s.citations = [];
  s.warrants = s.warrants.filter(w => !payable(w));
  emit('warrant', { cleared: true });
  return { ok: true, total };
}

// What turning yourself in costs up front: tickets and misdemeanours, 25% off.
export const surrenderTotal = s => Math.round(payableTotal(s) * (1 - SURRENDER_DISCOUNT));

// Walk into a station and turn yourself in: tickets and misdemeanour warrants
// are paid at 25% off; felony warrants (and a skipped court date) come back as
// `felonies` for the caller to file in court. A few hours in a holding cell
// (the caller moves the clock).
export function surrender(s) {
  ensureRecord(s);
  const total = surrenderTotal(s);
  if (!(s.warrants.length || s.citations.length)) return { ok: false, total: 0 };
  if (total && !spend(s, total, 'FWPD — turned yourself in')) return { ok: false, total };
  const felonies = s.warrants.filter(w => w.felony && w.kind !== 'bailjump');
  const skipped = s.warrants.some(w => w.kind === 'bailjump');
  const n = s.warrants.length;
  s.warrants = []; s.citations = [];
  if (n) emit('warrant', { cleared: n });
  s.heat = 0;
  return { ok: true, total, felonies: felonies.map(w => ({ kind: w.kind, text: w.text, felony: true, evidence: strength(w) })), skipped };
}
