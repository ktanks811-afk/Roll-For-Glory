// Pull-ups: while you cruise, another racer rolls up next to you, revs it
// and flashes their lights. Answer (USE or the horn) and you both stop, line
// up and run a sprint from right there to a finish down the road. The rules
// live here (no DOM, tested in check-data); the car beside you is
// world2d/pullups.js and the race itself is the normal street race.

import { RACERS } from '../data/npcs.js';
import { WAGER_CAP } from '../data/world.js';
import { START_IN, racerSpec } from '../data/streetRaces.js';
import { metrics } from '../sim/powertrain.js';
import { tierOf, hourOf } from './state.js';

export const PULLUP = {
  firstAfter: [70, 130],    // seconds of driving before the first one
  every: [140, 260],        // then about this often (night: × NIGHT_MUL)
  nightMul: 0.6,
  minSpeed: 9,              // m/s (~20 mph): they only pull up on a moving car
  answerFor: 9,             // seconds you have to answer
  lineupFor: 25,            // seconds you have to stop and line up
  ignoredWait: 60,          // extra wait after you leave one hanging
  length: [800, 1500],      // race distance (m)
  maxTurns: 2,
};

const LINES = [
  'You running or what?', 'That thing fast or just loud?', 'Run it. Next light.', 'Let\'s see what it do.',
  'Pull up. Bet you can\'t hang.', 'Cute car. Race me.', 'You lost? Let\'s go.', 'Dig from right here. Your call.',
];

// Why nobody is pulling up on you right now (null = clear).
export function pullupBlock({ inCar, speed = 0, policePhase = 'none', racing, hot, broken, fuel = 1, towing, gig, meetRace, robbing }) {
  if (!inCar) return 'on foot';
  if (racing) return 'racing';
  if (policePhase && policePhase !== 'none') return 'cops';
  if (hot) return 'hot car';
  if (broken) return 'broken';
  if (fuel < 0.12) return 'fuel';
  if (towing) return 'towing';
  if (gig) return 'gig';
  if (meetRace) return 'meet race';
  if (robbing) return 'robbing';
  if (speed < PULLUP.minSpeed) return 'slow';
  return null;
}

// Seconds of driving until the next one shows up.
export function nextPullupIn(s, rng = Math.random, first = false) {
  const [a, b] = first ? PULLUP.firstAfter : PULLUP.every;
  const h = hourOf(s.time);
  const night = h >= 20 || h < 4;
  return (a + rng() * (b - a)) * (night && !first ? PULLUP.nightMul : 1);
}

// Who pulls up: a named racer near your rep with a car near yours, or a
// random street racer built to your speed (`street()` makes one).
const piCache = new Map();
export function racerPi(r) {
  if (!piCache.has(r.id)) piCache.set(r.id, metrics(racerSpec(r)).pi);
  return piCache.get(r.id);
}
export function pickChallenger(s, myPi, street, rng = Math.random) {
  const tier = tierOf(s.rep).n;
  const named = RACERS.filter(r => r.style !== 'drag' && r.tier <= tier + 1 && r.tier >= tier - 1 && Math.abs(racerPi(r) - myPi) < 160);
  if (named.length && rng() < 0.45) return named[Math.floor(rng() * named.length)];
  return street();
}

// What they put on it: a slice of the tier's cap they can cover and you can
// match, rounded to $50. Broke or way quicker than them: just for rep.
export function pullupWager(s, npc, myPi, rng = Math.random) {
  const tier = tierOf(s.rep).n;
  if (myPi - racerPi(npc) > 120) return 0;
  const cap = WAGER_CAP[tier] || 0;
  const want = cap * (0.08 + rng() * 0.17);
  const w = Math.min(want, npc.money || 0, (s.cash || 0) + (s.bank || 0));
  return w < 100 ? 0 : Math.floor(w / 50) * 50;
}

export function pullupLine(npc, rng = Math.random) {
  const own = [npc.lines?.greet, npc.lines?.taunt].filter(Boolean);
  const pool = npc.generic ? LINES : [...own, ...LINES.slice(0, 3)];
  return pool[Math.floor(rng() * pool.length)];
}

// A sprint from where you're sitting: down the road you're on in the way
// you're facing, maybe a turn or two, finish PULLUP.length metres out.
// Returns a street race event (same shape as data/streetRaces.js) or null
// when there's no road to run (off-road, dead end too close).
export function pullupRoute(roads, x, z, h, rng = Math.random) {
  // the road under you that best lines up with the way you're facing (at a
  // crossing both streets are under you: take the one you're driving along)
  const fx = Math.sin(h), fz = -Math.cos(h);
  let on = null, best = -Infinity;
  for (const e of roads.edges) {
    const s = Math.max(0, Math.min(e.len, (x - e.ax) * e.dx + (z - e.az) * e.dz));
    const px = e.ax + e.dx * s, pz = e.az + e.dz * s, d = Math.hypot(px - x, pz - z);
    if (d > e.width / 2 + 3) continue;
    const score = Math.abs(fx * e.dx + fz * e.dz) - d * 0.02;
    if (score > best) { best = score; on = { edge: e, s, x: px, z: pz }; }
  }
  if (!on) return null;
  const e0 = on.edge;
  const fwd = fx * e0.dx + fz * e0.dz >= 0;
  let dir = fwd ? [e0.dx, e0.dz] : [-e0.dx, -e0.dz];
  const corners = [[on.x - dir[0] * START_IN, on.z - dir[1] * START_IN]];
  let node = fwd ? e0.b : e0.a, prev = e0, total = fwd ? e0.len - on.s : on.s, turns = 0, turned = false;
  const want = PULLUP.length[0] + rng() * (PULLUP.length[1] - PULLUP.length[0]);
  const names = [e0.name];
  for (let guard = 0; guard < 40; guard++) {
    const n = roads.nodes[node];
    if (total >= want) {
      // never finish right on the heels of a corner: at least 80 m of straight to the line
      const back = turned ? Math.min(total - want, Math.max(0, prev.len - 80)) : total - want;
      corners.push([n.x - dir[0] * back, n.z - dir[1] * back]);
      break;
    }
    const opts = n.edges.map(id => roads.edges[id]).filter(e => e.id !== prev.id)
      .map(e => ({ e, to: e.a === node ? e.b : e.a, d: e.a === node ? [e.dx, e.dz] : [-e.dx, -e.dz] }));
    if (!opts.length) { corners.push([n.x, n.z]); break; }    // dead end: the finish is the end of the road
    const dot = o => o.d[0] * dir[0] + o.d[1] * dir[1];
    const straight = opts.find(o => dot(o) > 0.97);
    let pick = straight;
    if (!straight || (turns < PULLUP.maxTurns && total > 250 && rng() < 0.35)) {
      const side = opts.filter(o => Math.abs(dot(o)) < 0.4);
      pick = side.length ? side[Math.floor(rng() * side.length)] : straight || opts[0];
    }
    turned = dot(pick) < 0.9999;
    if (turned) { corners.push([n.x, n.z]); if (pick !== straight) turns++; }
    if (pick.e.name && pick.e.name !== names[names.length - 1]) names.push(pick.e.name);
    dir = pick.d; node = pick.to; prev = pick.e; total += pick.e.len;
  }
  let len = 0;
  for (let i = 1; i < corners.length; i++) len += Math.hypot(corners[i][0] - corners[i - 1][0], corners[i][1] - corners[i - 1][1]);
  if (corners.length < 2 || len - START_IN < 350) return null;
  return {
    id: 'pullup', adhoc: true, name: `${names[0] || 'Street'} pull-up`, tier: 1, kind: 'sprint', heat: 0.6,
    desc: `From a dig on ${names[0] || 'the street'}${names.length > 1 ? `, onto ${names.slice(1).join(' and ')}` : ''}.`,
    corners,
  };
}
