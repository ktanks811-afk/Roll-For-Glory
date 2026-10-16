// Prison breaks. If your sentence is too long to sit through, plan a way out
// of the Wynne Unit (core/prison.js, ui/prison.js) from the back fence:
//
//   tunnel   Dig out from under 12 Building with a sharpened spoon, a night
//            at a time. Slow, and a cell search can find it, but the night you
//            break through you're very likely gone.
//   fence    Over the wire. Wire cutters from the voc shop, a wool blanket for
//            the razor wire, and you need to watch the towers first.
//   laundry  Out in the back of the laundry truck. You have to work laundry,
//            and your people put an envelope in a laundry officer's hand.
//   crew     Your people on the outside hit the van on a hospital run. You
//            need a phone to set it up and it costs real money.
//
// Get caught and it's a new felony (attempted escape), more years, your line
// class drops and the plan is blown. Make it and you're a fugitive: a felony
// escape warrant, a manhunt, and if they ever pick you up again you go
// straight back to TDCJ with the rest of your time plus the escape stacked
// on top (world.onBusted → recapture()).
//
// Save keys: s.prison.escape while you plan, s.fugitive once you're out.
// DOM-free so check-data can test it.

import { spend, canAfford } from './state.js';
import { newCase, UNITS } from './prison.js';
import { ensureJustice } from './justice.js';
import { addWarrant } from './warrants.js';

export const CONTRABAND = [
  { id: 'spoon', name: 'Sharpened spoon', price: 15, icon: '🥄', bust: 0.04, desc: 'Digs through cinder block, slowly.' },
  { id: 'blanket', name: 'Wool blanket', price: 40, icon: '🧣', bust: 0.03, desc: 'Thrown over the razor wire.' },
  { id: 'cutters', name: 'Wire cutters out of the voc shop', price: 300, icon: '✂', bust: 0.12, desc: 'Through the chain link in under a minute.' },
  { id: 'phone', name: 'Smuggled cell phone', price: 450, icon: '📱', bust: 0.12, desc: 'Call your people on the outside.' },
];
export const ITEM_BY_ID = Object.fromEntries(CONTRABAND.map(i => [i.id, i]));

export const BRIBE = 2500;      // an envelope for the laundry officer, from your bank
export const CREW_PAY = 25000;  // the outside crew, from your bank
export const ESCAPE_YEARS = 3;  // added for an attempt, or for the escape when you're caught

export const PLANS = {
  tunnel: { name: 'Tunnel out', desc: 'Dig out from under 12 Building with a sharpened spoon, one night at a time. A shakedown can find the hole.', items: ['spoon'] },
  fence: { name: 'Over the wire', desc: 'Cut the fence on the back side of the yard at night and throw a blanket over the razor wire. Watch the towers first.', items: ['cutters', 'blanket'] },
  laundry: { name: 'The laundry truck', desc: 'Ride out in a cart of dirty whites when the truck goes to the Ellis Unit. You have to work laundry, and the officer has to be paid.', items: [] },
  crew: { name: 'Outside crew', desc: 'Fake chest pains. Your people hit the transport van on the way to the hospital in Huntsville. Expensive, and the best shot.', items: ['phone'] },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const night = s => { const hr = (s.time.min / 60) % 24; return hr >= 20 || hr < 5; };

export function ensureBreak(s) {
  const p = s.prison;
  if (!p) return null;
  return p.escape ??= { plan: null, dig: 0, scout: 0, items: [], bribed: false, paid: false, attempts: 0 };
}

export function choosePlan(s, id) { const e = ensureBreak(s); if (e && PLANS[id]) e.plan = id; return e; }

// The connect at the back of the yard. Paid off your books; a shakedown can take it.
export function buyItem(s, id, rng = Math.random) {
  const p = s.prison, e = ensureBreak(s), it = ITEM_BY_ID[id];
  if (!p || !it) return { ok: false };
  if (e.items.includes(id)) return { ok: false, have: true };
  if (p.books < it.price) return { ok: false, why: 'books' };
  p.books -= it.price;
  if (rng() < it.bust) return { ok: true, caught: true, item: it, ...newCase(s, id === 'phone' ? 'prison_phone' : 'prison_contraband') };
  e.items.push(id);
  return { ok: true, caught: false, item: it };
}

// Tunnel: one night of digging a day. Returns the new progress, or a case if a shakedown finds it.
export function dig(s, rng = Math.random) {
  const p = s.prison, e = ensureBreak(s);
  if (!e.items.includes('spoon')) return { ok: false, why: 'spoon' };
  if (p.day.dug) return { ok: false, why: 'today' };
  if (e.dig >= 100) return { ok: false, why: 'done' };
  p.day.dug = true;
  s.player.energy = clamp((s.player.energy ?? 100) - 25, 0, 100);
  if (rng() < 0.07) {
    e.dig = 0; e.items = e.items.filter(i => i !== 'spoon');
    return { ok: true, caught: true, ...newCase(s, 'escape_attempt', ESCAPE_YEARS) };
  }
  const got = Math.round(14 + p.strength / 8 + rng() * 10);
  e.dig = Math.min(100, e.dig + got);
  return { ok: true, caught: false, got, dig: e.dig };
}

// Fence: sit on the bleachers and time the towers. Once a day, up to 3.
export function scout(s) {
  const p = s.prison, e = ensureBreak(s);
  if (p.day.scouted || e.scout >= 3) return { ok: false };
  p.day.scouted = true;
  e.scout++;
  return { ok: true, scout: e.scout };
}

export function bribeOfficer(s) {
  const e = ensureBreak(s);
  if (e.bribed) return { ok: false, have: true };
  if (!canAfford(s, BRIBE) || !spend(s, BRIBE, 'An envelope for a laundry officer')) return { ok: false, why: 'money' };
  e.bribed = true;
  return { ok: true };
}

export function payCrew(s) {
  const e = ensureBreak(s);
  if (e.paid) return { ok: false, have: true };
  if (!canAfford(s, CREW_PAY) || !spend(s, CREW_PAY, 'Outside crew for a breakout')) return { ok: false, why: 'money' };
  e.paid = true;
  return { ok: true };
}

// What's still missing before you can go. [] means ready.
export function missing(s) {
  const p = s.prison, e = ensureBreak(s), out = [];
  const P = PLANS[e?.plan];
  if (!P) return ['Pick a plan'];
  for (const i of P.items) if (!e.items.includes(i)) out.push(`Get ${ITEM_BY_ID[i].name.toLowerCase()}`);
  if (e.plan === 'tunnel' && e.dig < 100) out.push(`Finish the tunnel (${e.dig}% dug)`);
  if (e.plan === 'fence' && e.scout < 1) out.push('Watch the towers at least once');
  if (e.plan === 'laundry' && p.job !== 'laundry') out.push('Get a laundry job (job board)');
  if (e.plan === 'laundry' && !e.bribed) out.push('Pay the laundry officer');
  if (e.plan === 'crew' && !e.paid) out.push('Pay the outside crew');
  return out;
}

// The chance it works, if you go right now.
export function odds(s) {
  const p = s.prison, e = ensureBreak(s);
  switch (e?.plan) {
    case 'tunnel': return 0.8;
    case 'fence': return clamp(0.18 + e.scout * 0.12 + p.strength / 300 + (night(s) ? 0.12 : 0), 0.05, 0.75);
    case 'laundry': return clamp(0.5 + p.conduct / 500, 0.3, 0.7);
    case 'crew': return 0.72;
  }
  return 0;
}

// Go. ok: you're out (call escape() next). Otherwise a new case and more time.
export function attempt(s, rng = Math.random) {
  const p = s.prison, e = ensureBreak(s);
  if (missing(s).length) return { ok: false, why: 'not ready' };
  e.attempts++;
  if (rng() < odds(s)) return { ok: true, plan: e.plan };
  const plan = e.plan;
  const r = newCase(s, 'escape_attempt', ESCAPE_YEARS);
  p.conduct = clamp(p.conduct - 20, 0, 100);
  p.respect = clamp(p.respect + 5, 0, 100);   // the yard respects the try
  if (plan === 'fence') s.player.energy = clamp((s.player.energy ?? 100) - 40, 0, 100);
  p.escape = { plan: null, dig: 0, scout: 0, items: [], bribed: false, paid: false, attempts: e.attempts };
  return { ok: false, caught: true, plan, ...r };
}

// You made it. The rest of your sentence waits for you.
export function escape(s, plan) {
  const p = s.prison;
  const { escape: _, ...kept } = p;
  s.fugitive = { prison: kept, day: s.time.day, unit: UNITS[p.facility].name, plan };
  s.prison = null;
  addWarrant(s, { kind: 'escape', text: `Escape from TDCJ custody (${UNITS[p.facility].name}).`, fine: 25000, felony: true, evidence: 'Your TDCJ photo is on every news station' });
  return s.fugitive;
}

export const isFugitive = s => !!s?.fugitive;

// Picked up again: back to the same unit with the escape stacked on, plus
// two years for each new felony on the sheet. Returns what was added.
export function recapture(s, newFelonies = 0) {
  const f = s.fugitive;
  if (!f) return null;
  const p = f.prison;
  const add = ESCAPE_YEARS + 2 * Math.max(0, newFelonies);
  if (!p.life) p.years += add;
  p.conduct = 5;
  p.infractions = (p.infractions || 0) + 1;
  p.day = { worked: false, ate: false, lifted: false, chapel: false, visit: false, hustled: false, fought: false };
  p.log = [...(p.log || []), { text: `Recaptured after ${Math.max(0, s.time.day - f.day)} days out. Escape conviction: ${p.life ? 'stacked on your life sentence' : `${add} more years`}.`, kind: 'bad' }];
  ensureJustice(s).convictions.push({ day: s.time.day, text: 'Escape from a penal institution.', cls: 'F3', sentence: p.life ? 'Stacked on a life sentence' : `${add} more years TDCJ` });
  s.prison = p;
  s.fugitive = null;
  return { added: p.life ? 0 : add, unit: f.unit };
}
