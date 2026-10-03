// Gig work: legit driving shifts you actually play. Take a delivery run, a
// Ryde passenger or a tow call from the Hustle app (or the Hook & Haul yard),
// drive it, and get paid by how well you did it.
//
// The point is a reason to stay clean: dispatch runs a background check, so
// an open warrant keeps you off the schedule, a police chase gets you pulled
// off the job, and getting arrested suspends you and wipes your clean-shift
// streak (the streak is a pay bonus of up to +50%).

import { game, earn, earnBank, addRep, tierOf, activeCar } from './state.js';
import { hasWarrant } from './warrants.js';
import { sendMessage } from './story.js';
import { on } from './events.js';

export const GIGS = [
  { id: 'delivery', name: 'Delivery run', co: 'Slice Brothers Pizza', icon: '🍕', base: 110, perKm: 95,
    blurb: 'Grab the order and beat the clock. Late food and a smashed box cost you the tip.' },
  { id: 'ride', name: 'Ryde passenger', co: 'Ryde', icon: '🚘', base: 130, perKm: 110,
    blurb: 'Pick up a rider and drive smooth. Hard braking, speeding and crashes cost you stars.' },
  { id: 'tow', name: 'Tow call', co: 'Hook & Haul Towing', icon: '🛻', base: 200, perKm: 125,
    blurb: 'Hook a broken-down car to your dolly and haul it to the yard. Over 60 and it swings.' },
];
export const GIG_BY_ID = Object.fromEntries(GIGS.map(g => [g.id, g]));

export const TIER_MULT = [1, 1.4, 1.9, 2.6, 3.5];
export const STREAK_STEP = 0.05;          // +5% per clean shift in a row
export const STREAK_MAX = 0.5;            // up to +50%
export const RIDE_SPEED = 26;             // m/s (58 mph) — riders don't like it past this
export const TOW_SPEED = 27;              // m/s (60 mph) — the dolly starts to swing
export const LATE_FAIL = 90;              // seconds late before the order is cancelled

export function ensure(s) {
  s.gigs ??= { streak: 0, best: 0, done: 0, earned: 0, suspended: 0, log: [] };
  s.gigs.log ??= [];
  return s.gigs;
}

export const streakBonus = s => Math.min(STREAK_MAX, ensure(s).streak * STREAK_STEP);
export const tierMult = s => TIER_MULT[Math.max(0, Math.min(4, tierOf(s.rep).n - 1))];

// What dispatch offers for a run of `meters` (before how well you drive it).
export function quote(s, gig, meters) {
  const g = typeof gig === 'string' ? GIG_BY_ID[gig] : gig;
  return Math.round((g.base + g.perKm * meters / 1000) * tierMult(s) * (1 + streakBonus(s)));
}

// Why you can't take a shift right now, or null. `ctx` is what the open
// world knows: { policePhase, inCar, busy }.
export function blocked(s, ctx = {}) {
  const g = ensure(s);
  if (g.suspended && s.time.day <= g.suspended) return `Suspended after your arrest. You're back on the schedule Day ${g.suspended + 1}.`;
  if (hasWarrant(s)) return 'Background check failed: you have an open warrant. Clear it at the precinct or in the FWPD app first.';
  if (ctx.busy) return 'You\'re already on a shift.';
  const car = activeCar(s);
  if (!car || car.stolen) return 'You need a car to work these shifts.';
  if (car.engineBlown) return 'Your engine is blown. Get it rebuilt first.';
  if (ctx.policePhase && ctx.policePhase !== 'none') return 'Lose the cops first. Dispatch won\'t send you out hot.';
  return null;
}

// How the shift went: { late (s, >0 means late), dmg (body points lost),
// harsh (hard brakes/launches), speeding (s), swing (s over tow speed) }.
// Returns { pay, tip, stars, notes }.
export function grade(kind, quoted, r) {
  const notes = [];
  let pay = quoted, tip = 0, stars = 5;
  const dmg = Math.max(0, r.dmg || 0);
  if (kind === 'delivery') {
    if (r.late > 0) { pay *= Math.max(0.4, 1 - r.late / 120); notes.push(`${Math.ceil(r.late)}s late`); }
    else { tip = quoted * (0.12 + Math.min(0.13, -r.late / 600)); notes.push('On time'); }
    if (dmg > 1) { pay *= Math.max(0.5, 1 - dmg * 0.02); tip = 0; notes.push('The box got smashed'); }
    stars = r.late > 0 ? Math.max(1, 4 - r.late / 30) : dmg > 1 ? 3 : 5;
  } else if (kind === 'ride') {
    stars = 5 - (r.harsh || 0) * 0.5 - (r.speeding || 0) / 8 - dmg * 0.15;
    stars = Math.max(1, Math.min(5, stars));
    pay *= 0.6 + 0.08 * stars;
    if (stars >= 4.5) tip = quoted * 0.2;
    if (r.harsh) notes.push(`${r.harsh} hard stop${r.harsh > 1 ? 's' : ''}`);
    if (r.speeding > 1) notes.push('Speeding');
    if (dmg > 1) notes.push('You crashed with a rider');
  } else {
    const cut = Math.min(0.6, dmg * 0.025 + (r.swing || 0) * 0.03);
    pay *= 1 - cut;
    if (r.swing > 1) notes.push('The dolly was swinging');
    if (dmg > 1) notes.push('Banged up the tow');
    stars = Math.max(1, 5 - cut * 8);
    if (!cut) { tip = quoted * 0.1; notes.push('Clean haul'); }
  }
  return { pay: Math.round(pay), tip: Math.round(tip), stars: Math.round(stars * 10) / 10, notes };
}

// A finished shift: pay lands in your bank, tips in cash, the streak grows.
export function payOut(s, kind, quoted, result) {
  const g = ensure(s), gig = GIG_BY_ID[kind];
  const r = grade(kind, quoted, result);
  earnBank(s, r.pay, `${gig.co}: ${gig.name}`);
  if (r.tip) earn(s, r.tip, `${gig.co}: tip`);
  g.streak++; g.best = Math.max(g.best, g.streak); g.done++; g.earned += r.pay + r.tip;
  g.log.unshift({ day: s.time.day, kind, pay: r.pay + r.tip, stars: r.stars });
  if (g.log.length > 12) g.log.length = 12;
  addRep(s, 6, 'Clean shift');
  return r;
}

// Walked off, got chased or let the order go cold: no pay and the streak resets.
export function fail(s) {
  const g = ensure(s);
  g.streak = 0;
}

// Getting arrested costs you the gig apps for a day and the streak.
on('busted', d => {
  const s = game.s; if (!s || d?.ticket) return;
  const g = ensure(s);
  const had = g.done > 0 || g.streak > 0;
  g.streak = 0;
  g.suspended = s.time.day + 1;
  if (had) sendMessage(s, 'hustle', `Ryde, Slice Brothers and Hook & Haul all ran your name after the arrest. You're off the schedule until Day ${g.suspended + 1}, and your clean-shift bonus is gone.`);
});
