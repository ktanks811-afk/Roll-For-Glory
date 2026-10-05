// Teleport (fast travel): from the phone Map, jump straight to a place and
// take your car with you, trailer and all. It isn't free: it costs a fee,
// the clock moves on (most of the time the drive would have taken) and the
// tank burns what the drive would have burned.
//
// You can't teleport out of trouble: not with the cops on you or heat on
// your name, not in a stolen car, not mid race, shift or texted job, and not
// in a car that won't run.
//
// DOM-free so scripts/check-data.mjs can test it.

import { carMpg, tankGallons } from './state.js';
import { FUEL_BURN } from './upkeep.js';

export const TRAVEL_BASE = 20;        // flat fee ($)
export const TRAVEL_PER_KM = 9;       // plus this per km of road
export const TRAVEL_TIME = 0.6;       // share of the drive time that passes
export const TRAVEL_MIN = 5;          // at least this many game minutes
export const TRAVEL_NEAR = 60;        // closer than this (m) and you're already there
export const CAR_REACH = 40;          // on foot this close to your car, it comes with you

// Game minutes the drive would take (1 real second = 1 game minute, ~19 m/s).
export const driveMinutes = meters => meters / 19;

// What a teleport over `meters` of road costs. `car` is the car coming along (or null).
export function travelQuote(meters, car = null) {
  const km = meters / 1000;
  const fee = Math.round(TRAVEL_BASE + km * TRAVEL_PER_KM);
  const minutes = Math.max(TRAVEL_MIN, Math.round(driveMinutes(meters) * TRAVEL_TIME));
  // fuel as a steady cruise would burn it (same math as driving, part throttle)
  const fuel = car ? (meters / 1609.34 / carMpg(car) * 0.9 * FUEL_BURN) / tankGallons(car) : 0;
  return { fee, minutes, fuel, km };
}

// Why you can't teleport right now, or null if you can.
// ctx: { policePhase, heat, hot, racing, gig, robbing, car (coming along), meters }
export function travelBlock(s, ctx = {}) {
  if ((ctx.policePhase && ctx.policePhase !== 'none') || (ctx.heat ?? s.heat ?? 0) >= 1) return 'Not with the cops on you. Lose them and let the heat cool off first.';
  if (ctx.hot) return 'Not in a stolen car. You have to drive that one yourself.';
  if (ctx.racing) return 'Finish the race first.';
  if (ctx.gig) return 'You\'re on a shift. Finish it or drop it first.';
  if (s.missions?.active) return `Finish the job you took by text first (${s.missions.active.title}).`;
  if (ctx.robbing) return 'Not in the middle of a robbery.';
  const car = ctx.car;
  if (car) {
    if (car.engineBlown) return 'Your engine is blown. It isn\'t going anywhere.';
    if (car.broken) return 'Your car is broken down. Get it fixed first (Bank → Roadside).';
    if (ctx.meters != null && (car.fuel ?? 1) < travelQuote(ctx.meters, car).fuel) return 'Not enough gas to get there. Fill up first.';
  }
  if (ctx.meters != null && ctx.meters < TRAVEL_NEAR) return 'You\'re already here.';
  return null;
}

// Where the car lands: the curb lane of the nearest road, on the side the
// place is on, pointing along the road. `near` is roads.nearestOnRoad(x, z).
export function curbSpot(near, x, z) {
  const e = near.edge, lanes = e.lanes || [2];
  const off = lanes[lanes.length - 1];
  // the side vector for driving along +d is (-dz, dx); pick the direction that puts the place on our side
  const side = (-e.dz) * (x - near.x) + e.dx * (z - near.z);
  const dir = side >= 0 ? 1 : -1, dx = e.dx * dir, dz = e.dz * dir;
  return { x: near.x - dz * off, z: near.z + dx * off, h: Math.atan2(dx, -dz) };
}
