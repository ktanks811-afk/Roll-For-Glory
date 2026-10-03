// Missions texted to your phone. People you know (Rosa, Manny, Dre, Jojo, Zed)
// text you a favor: pick something up, drop it off, beat the clock. Accept it
// in Messages or the Missions app, the GPS takes you to each stop, and the pay
// lands when you make the last drop. Zed's "hot" runs pay best but the package
// draws police attention, and getting busted with it ends the job.
//
// A game minute is one real second, so time limits are in game minutes.

import { game, earn, addRep, tierOf, uid, fmtMoney, gameTimeStr } from './state.js';
import { sendMessage } from './story.js';
import { on } from './events.js';
import { LOCATIONS, LOC_BY_ID } from '../data/world.js';

const DRIVE_MPS = 16;           // a fair city pace for the time limit, slower than the map's ETA
const ARRIVE_M = 25;            // same radius the GPS uses for "Arrived"
const OFFER_HOURS = 6;          // how long an offer stays open
const MAX_OFFERS = 2;

// Places worth sending someone to. Police, courts and far-out race roads make bad drop points.
const STOPS = () => LOCATIONS.filter(l => !['police', 'court', 'roll', 'drag'].includes(l.type) && Math.abs(l.x) < 1500 && Math.abs(l.z) < 1500);
const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];

// Who sends what. `to` pins the drop-off; `from` pins the pickup. The text gets
// {a} (pickup) and {b} (drop-off) filled in.
export const KINDS = [
  { id: 'parts', from: 'rosa', title: 'Parts run', pay: 260, rep: 25, to: 'torque_temple',
    text: 'Got a customer car on the lift and no gaskets. A box is waiting at {a}. Bring it to the shop before I lose the bay.',
    verbs: ['Pick up the gasket box', 'Drop it at Torque Temple'], thanks: 'That\'s the one. You saved me a day. Paid you.' },
  { id: 'paint', from: 'manny', title: 'Paint pickup', pay: 300, rep: 25, to: 'vega_kustoms',
    text: 'My candy red order got dropped at {a} by mistake. Grab it and bring it to Vega Kustoms. Don\'t bake it in the sun.',
    verbs: ['Grab the paint order', 'Bring it to Vega Kustoms'], thanks: 'Color\'s perfect. Here\'s your cut.' },
  { id: 'ride', from: 'jojo', title: 'Come get me', pay: 160, rep: 15,
    text: 'Bro my ride bailed. I\'m at {a}. Take me to {b}? I\'ll throw you gas money, promise.',
    verbs: ['Pick up Jojo', 'Drop Jojo off'], thanks: 'You\'re a real one. Sent you the money, for real this time.' },
  { id: 'vip', from: 'kingpin', title: 'VIP shuttle', pay: 520, rep: 60, tier: 2,
    text: 'Got a sponsor rep at {a} who wants to see the scene. Drive them to {b}. Clean car, no stunts, don\'t be late.',
    verbs: ['Pick up the sponsor rep', 'Drop them at the spot'], thanks: 'They loved it. Good look. Payment sent.' },
  { id: 'hot', from: 'zed', title: 'Hot package', pay: 900, rep: 40, hot: true, tier: 2,
    text: 'Duffel bag at {a}. Don\'t open it. Get it to {b}. Cops are looking for it, so move fast and stay clean.',
    verbs: ['Grab the duffel', 'Drop the duffel'], thanks: 'Clean drop. Pleasure doing business. Cash is yours.' },
];
export const KIND_BY_ID = Object.fromEntries(KINDS.map(k => [k.id, k]));

export const now = s => s.time.day * 1440 + s.time.min;

export function ensure(s) {
  s.missions ??= { offers: [], active: null, done: 0, failed: 0, earned: 0, log: [] };
  return s.missions;
}

// Distance in meters through the stops, as the crow flies, from a start point.
const legs = (stops, x, z) => stops.reduce((a, l) => { const d = a.d + Math.hypot(l.x - a.x, l.z - a.z); return { d, x: l.x, z: l.z }; }, { d: 0, x, z }).d;

// Build one mission offer. Returns null when nothing sensible fits.
export function makeOffer(s, kindId, r = Math.random) {
  const tier = tierOf(s.rep).n;
  const pool = KINDS.filter(k => (k.tier || 1) <= tier && (!kindId || k.id === kindId));
  const k = pick(pool, r);
  if (!k) return null;
  const all = STOPS();
  const b = k.to ? LOC_BY_ID[k.to] : null;
  const a = pick(all.filter(l => l.id !== k.to && (!b || Math.hypot(l.x - b.x, l.z - b.z) > 250)), r);
  if (!a) return null;
  const bb = b || pick(all.filter(l => l.id !== a.id && Math.hypot(l.x - a.x, l.z - a.z) > 300), r);
  if (!bb) return null;
  const scale = 1 + 0.6 * (tier - 1);
  const dist = Math.hypot(bb.x - a.x, bb.z - a.z);
  const pay = Math.round(k.pay * scale * (0.85 + dist / 2500) / 10) * 10;
  return {
    id: uid('job'), kind: k.id, from: k.from, title: k.title, hot: !!k.hot,
    stops: [a.id, bb.id], pay, rep: Math.round(k.rep * scale),
    text: k.text.replace('{a}', a.name).replace('{b}', bb.name),
    expires: now(s) + OFFER_HOURS * 60,
  };
}

// Text the player an offer. `force` skips the dice and the "busy" checks.
export function offerMission(s, { force = false, kind = null } = {}) {
  const m = ensure(s);
  m.offers = m.offers.filter(o => o.expires > now(s));
  if (!force && (m.active || m.offers.length >= MAX_OFFERS || !s.activeCar || Math.random() > 0.3)) return null;
  const o = makeOffer(s, kind);
  if (!o) return null;
  m.offers.push(o);
  sendMessage(s, o.from, `${o.text} ${fmtMoney(o.pay)}${o.hot ? ' 🔥' : ''}.`, { action: { type: 'mission', id: o.id } });
  return o;
}

export const offerById = (s, id) => ensure(s).offers.find(o => o.id === id) || null;
export const offerOpen = (s, o) => !!o && o.expires > now(s) && !ensure(s).active;

// The stop you're heading to right now.
export function currentStop(s) {
  const a = ensure(s).active;
  return a ? LOC_BY_ID[a.stops[a.stage]] : null;
}
export function stopLabel(a) {
  const k = KIND_BY_ID[a.kind];
  return k.verbs[a.stage] || 'Next stop';
}
export const timeLeft = s => { const a = ensure(s).active; return a ? a.deadline - now(s) : 0; };
export const fmtLeft = min => min >= 60 ? `${Math.floor(min / 60)}h ${String(Math.floor(min % 60)).padStart(2, '0')}m` : `${Math.max(0, Math.floor(min))}m`;

// Accept an offer: starts the clock and points the GPS at the pickup.
export function acceptMission(s, id, world) {
  const m = ensure(s);
  const o = offerById(s, id);
  if (!offerOpen(s, o)) return { ok: false, why: m.active ? 'Finish the job you already took first.' : 'That offer expired.' };
  m.offers = m.offers.filter(x => x.id !== id);
  const p = world?.playerState() || s.pos || { x: 0, z: 0 };
  const stops = o.stops.map(sid => LOC_BY_ID[sid]);
  const limit = Math.round(legs(stops, p.x, p.z) * 1.4 / DRIVE_MPS * 1.5 + 4);
  m.active = { ...o, stage: 0, started: now(s), deadline: now(s) + limit, limit };
  pointGps(s, world);
  return { ok: true, mission: m.active };
}

export function declineMission(s, id) {
  const m = ensure(s);
  m.offers = m.offers.filter(o => o.id !== id);
}

export function pointGps(s, world) {
  const a = ensure(s).active, l = currentStop(s);
  if (a && l && world) world.setGps(l.x, l.z, `${a.title}: ${l.name}`);
}

function finish(s, ok, why, world) {
  const m = ensure(s), a = m.active;
  if (!a) return;
  m.active = null;
  if (s.gps && s.gps.label?.startsWith(a.title + ':')) { s.gps = null; if (world) world.gpsPath = null; }
  m.log.unshift({ title: a.title, from: a.from, ok, pay: ok ? a.pay : 0, day: s.time.day, t: gameTimeStr(s.time), why: why || '' });
  if (m.log.length > 20) m.log.length = 20;
  if (ok) {
    m.done++; m.earned += a.pay;
    earn(s, a.pay, `Mission: ${a.title}`);
    addRep(s, a.rep, a.title);
    sendMessage(s, a.from, KIND_BY_ID[a.kind].thanks);
  } else {
    m.failed++;
    addRep(s, -Math.round(a.rep / 2), `Failed: ${a.title}`);
    sendMessage(s, a.from, why === 'busted' ? 'You got picked up with my stuff?? Lose my number for a while.' : why === 'quit' ? 'You bailed on me. Noted.' : 'Too late. I had to get somebody else.');
  }
}

export function abandonMission(s, world) { finish(s, false, 'quit', world); }

// Called by the world every frame (cheap). Advances stops, runs the clock.
export function missionTick(world, p, toast) {
  const s = world.s;
  const a = s.missions?.active;
  if (!a) return;
  if (now(s) > a.deadline) { toast?.(`⏱ Out of time: ${a.title}`, 'bad'); finish(s, false, 'late', world); return; }
  const l = currentStop(s);
  if (!l) { finish(s, false, 'late', world); return; }
  const d = Math.hypot(l.x - p.x, l.z - p.z);
  if (d < ARRIVE_M) {
    if (!world.inCar) {
      if (!a.footHint) { a.footHint = true; toast?.('Bring your car. This job needs wheels.', 'info'); }
      return;
    }
    a.stage++; a.footHint = false;
    if (a.stage >= a.stops.length) { finish(s, true, '', world); return; }
    toast?.(`✔ ${KIND_BY_ID[a.kind].verbs[a.stage - 1]}. Next: ${currentStop(s).name}`, 'good');
    if (a.hot) world.police?.addHeat(0.9, 'Caller reports a suspicious bag handoff.', world.hud || world.ui?.hud);
    pointGps(s, world);
    return;
  }
  // GPS got cleared (arrived somewhere else, or tapped Clear): put the job back on it once you move off
  if (!s.gps && d > 60) pointGps(s, world);
}

on('busted', () => {
  const s = game.s;
  if (s?.missions?.active) finish(s, false, 'busted', null);
});
