// Street race events: point-to-point sprints and circuits on the real Fort
// Worth streets of the open world. Each route is a list of corners on the
// road grid; the legs between corners run straight along one road. Race a
// rival 1v1 (cash or pink slips) or run it solo against the course record.

import { buildSpec, stepSim, newSim, MPH } from '../sim/powertrain.js';
import { CAR_BY_ID } from './cars.js';
import { partLevels } from './parts.js';
import { RACER_BY_ID } from './npcs.js';

// corners: [x, z] intersections, driven in order. The race starts START_IN
// metres down the first leg. laps > 1 makes it a circuit back to the start.
export const START_IN = 45;

export const STREET_RACES = [
  { id: 'sr_sundance', name: 'Sundance Square Sprint', tier: 1, kind: 'sprint', heat: 0.7, record: 'tiny',
    desc: 'Up Main St through downtown, around the courthouse blocks and back down Jones St.',
    corners: [[0, 300], [0, -300], [300, -300], [300, 150], [150, 150], [150, 300]] },
  { id: 'sr_stockyards', name: 'Stockyards Sprint', tier: 1, kind: 'sprint', heat: 0.6, record: 'keys',
    desc: 'North on Throckmorton to NE 28th, across the Stockyards and down to Exchange Ave.',
    corners: [[-300, -450], [-300, -900], [300, -900], [300, -600], [600, -600]] },
  { id: 'sr_magnolia', name: 'Magnolia Mile', tier: 1, kind: 'sprint', heat: 0.5, record: 'lowkey',
    desc: 'A flat-out mile down Magnolia Ave, then a hard right and left onto Seminary Dr.',
    corners: [[-600, 600], [600, 600], [600, 900], [900, 900]] },
  { id: 'sr_eastside', name: 'East Side Run', tier: 2, kind: 'sprint', heat: 0.8, record: 'static',
    desc: 'Across Stockyards Blvd and the whole length of Lake Worth Blvd on the east side.',
    corners: [[600, -750], [900, -750], [900, 750], [600, 750]] },
  { id: 'sr_loop820', name: 'Loop 820 Blast', tier: 2, kind: 'sprint', heat: 1.2, record: 'glitch',
    desc: 'Up I-35W, a high-speed run along Loop 820 and back down into the city.',
    corners: [[0, -300], [0, -1350], [900, -1350], [900, -600]] },
  { id: 'sr_heights', name: 'Arlington Heights Circuit', tier: 3, kind: 'circuit', laps: 2, heat: 0.6, record: 'ghostline',
    desc: 'Two laps of the Heights: Montgomery, Weatherford, Henderson and Rosedale.',
    corners: [[-750, -150], [-450, -150], [-450, 450], [-750, 450]] },
  { id: 'sr_chisholm', name: 'Chisholm Trail Top End', tier: 3, kind: 'sprint', heat: 0.4, record: 'redline',
    desc: 'Out of the city and down the parkway into the flats. Nothing but top speed.',
    corners: [[0, 750], [0, 900], [0, 2700]] },
  { id: 'sr_i35w', name: 'I-35W Speedway Run', tier: 3, kind: 'sprint', heat: 1.1, record: 'static',
    desc: 'From Loop 820 straight up I-35W past the Alliance warehouses, then east on 114 to the speedway gates.',
    corners: [[0, -1350], [0, -4600], [650, -4600], [650, -4850]] },
  { id: 'sr_tms', name: 'Texas Motor Speedway Oval', tier: 4, kind: 'circuit', laps: 3, heat: 0.2, record: 'ghostline',
    desc: 'Three laps of the speedway. No cops, no traffic, no speed limit. Just flat out.',
    corners: [[650, -4850], [1000, -4850], [1000, -5300], [300, -5300], [300, -4850]] },
  { id: 'sr_denton', name: 'Denton Square Circuit', tier: 2, kind: 'circuit', laps: 2, heat: 0.7, record: 'keys',
    desc: 'Two laps round the courthouse: Elm, Oak, Locust and Mulberry, past Fry Street.',
    corners: [[600, -6400], [600, -6700], [750, -6700], [750, -6400]] },
];
export const STREET_RACE_BY_ID = Object.fromEntries(STREET_RACES.map(r => [r.id, r]));

// purse for beating the course record solo, per event tier
export const TRIAL_PURSE = [0, 400, 1200, 3000, 8000, 20000];
// seconds after the rival crosses the line before the race is called
export const FINISH_GRACE = 5;

const unit = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return [dx / L, dz / L]; };

// Where the race starts: on the first leg, facing the first corner.
export function raceStart(ev) {
  const [a, b] = ev.corners;
  const [ux, uz] = unit(a, b);
  return { x: a[0] + ux * START_IN, z: a[1] + uz * START_IN, h: Math.atan2(ux, -uz), dir: [ux, uz] };
}

// The whole route as a polyline from the start line to the finish line, plus
// the checkpoints along it (each corner, the lap line, the finish) and the
// distance along the route of each.
export function raceRoute(ev) {
  const st = raceStart(ev);
  const c = ev.corners;
  const pts = [[st.x, st.z]];
  const cps = [];
  const laps = ev.kind === 'circuit' ? (ev.laps || 2) : 1;
  for (let lap = 0; lap < laps; lap++) {
    for (let i = 1; i < c.length; i++) { pts.push(c[i]); cps.push(pts.length - 1); }
    if (ev.kind === 'circuit') { pts.push(c[0]); cps.push(pts.length - 1); pts.push([st.x, st.z]); cps.push(pts.length - 1); }
  }
  // drop the corner-at-the-start checkpoint on a circuit: the lap line is right after it
  const along = [0];
  for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const checkpoints = cps.filter(i => ev.kind !== 'circuit' || !(pts[i][0] === c[0][0] && pts[i][1] === c[0][1])).map(i => ({ x: pts[i][0], z: pts[i][1], s: along[i], idx: i }));
  // how hard each corner turns (radians, 0 = straight on)
  const turn = pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return 0;
    const [ax, az] = unit(pts[i - 1], p), [bx, bz] = unit(p, pts[i + 1]);
    return Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz));
  });
  return { pts, along, length: along[along.length - 1], checkpoints, turn, laps };
}

// Point and heading at distance s along the route.
export function routeAt(route, s) {
  const { pts, along } = route;
  s = Math.max(0, Math.min(route.length, s));
  let i = 1;
  while (i < pts.length - 1 && along[i] < s) i++;
  const a = pts[i - 1], b = pts[i], L = along[i] - along[i - 1] || 1, t = (s - along[i - 1]) / L;
  const [ux, uz] = unit(a, b);
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, ux, uz, i };
}

// The fastest a driver takes a corner that turns `ang` radians on tires with grip mu.
export function cornerSpeed(ang, mu, skill) {
  if (ang < 0.15) return Infinity;
  const r = 9 + 22 * (1 - Math.min(1, ang / (Math.PI / 2)));       // tighter turn, tighter line
  return Math.sqrt(Math.max(0.6, mu) * 9.81 * r) * (0.82 + 0.3 * skill);
}

// One step of a rival driving the route: throttle and brake from the speed it
// wants (straight-line top end, or what the next corner allows), longitudinal
// motion from the same powertrain sim as the player. `d` is the driver
// { spec, sim, s, skill, block (speed cap from traffic ahead, or Infinity) }.
export function driveRoute(route, d, dt) {
  const mu = (d.spec.mu || 1) * (d.wet || 1);   // wet = the weather's grip factor
  const brakeA = 6.5 * Math.min(1.25, mu) * (0.85 + 0.2 * d.skill);
  let want = d.block ?? Infinity;
  // look ahead at the next few corners
  for (let i = 1; i < route.pts.length - 1; i++) {
    const ahead = route.along[i] - d.s;
    if (ahead < -2) continue;
    if (ahead > 400) break;
    const vc = cornerSpeed(route.turn[i], mu, d.skill);
    if (vc < Infinity) want = Math.min(want, Math.sqrt(vc * vc + 2 * brakeA * Math.max(0, ahead - 4)));
  }
  const v = d.sim.v;
  let throttle = 1, brake = 0;
  if (v > want + 0.6) { throttle = 0; brake = Math.min(1, (v - want) / 5 + 0.3); }
  else if (v > want - 1.5) throttle = 0.35;
  if (d.sim.slip > 0.3 && Math.random() < d.skill) throttle = Math.min(throttle, 0.7);
  stepSim(d.spec, d.sim, { throttle, brake, auto: true, nitrous: d.sim.nos > 0 && throttle === 1 && v > 20 && want - v > 15 }, dt);
  // the sim's own brakes are gentle; real braking from the driver's foot
  if (brake > 0) d.sim.v = Math.max(want, d.sim.v - brakeA * brake * dt);
  d.thr = throttle;
  d.s += d.sim.v * dt;
  return d.s >= route.length;
}

// A racer's car as a sim spec.
export function racerSpec(r) {
  return buildSpec(CAR_BY_ID[r.car.model], partLevels(r.car.parts), {});
}

// Course record: the named record holder's time on an empty road (cached).
const recordCache = new Map();
export function courseRecord(ev) {
  if (recordCache.has(ev.id)) return recordCache.get(ev.id);
  const r = RACER_BY_ID[ev.record];
  const route = raceRoute(ev);
  const spec = racerSpec(r);
  const d = { spec, sim: newSim(spec, { tireTemp: 0.7 }), s: 0, skill: r.skill };
  const dt = 1 / 30;
  let t = 0;
  const rnd = Math.random;
  Math.random = () => 0.5;        // the record is the same every time
  try { while (t < 600 && !driveRoute(route, d, dt)) t += dt; } finally { Math.random = rnd; }
  const out = { time: Math.round(t * 10) / 10, holder: r, topMph: d.sim.peakV * MPH };
  recordCache.set(ev.id, out);
  return out;
}

export function fmtRaceTime(t) {
  if (t == null || !isFinite(t)) return '—';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

// Will a rival put their car up against yours? Pink slips need roughly even
// cars (they won't hand theirs to a faster car, or take a junker for it) and
// a free garage spot for the car you'd win.
export function pinkSlipCheck({ myPi, theirPi, myValue, theirValue, freeSlots, stolen }) {
  if (stolen) return 'That car is stolen. Nobody signs a title over for a stolen car.';
  if (freeSlots <= 0) return 'No room in your garages for another car. Buy a bigger place or sell one first.';
  if (myPi - theirPi > 90) return '"Nah. Your car is way quicker. Not for my title."';
  if (myValue < theirValue * 0.45) return `"Your car isn't worth half of mine. Put up something real."`;
  return null;
}
