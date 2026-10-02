// Gas + brake held together. Shared by drag races, car meets and the open
// world so they all behave the same.
//
//  - Without a 2-step: the engine just revs into the factory limiter and
//    bounces off it. Loud, but no flames.
//  - With a 2-step: the engine sits on a launch rev limiter at the rpm you
//    set, and every limiter cut can throw a flame out the exhaust. Higher
//    stages hold the rpm tighter and burn bigger. Flames come ONLY from the
//    2-step, never from plain revving.
//
// Not for electric cars: they have no rpm to hold.

import { FX } from '../data/parts.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The launch rpm a fresh car starts at (turbos like to spool first).
export function optimalLaunchRpm(spec) {
  return spec.asp === 'turbo' ? spec.redline * 0.62 : spec.redline * 0.48;
}

// Cylinder count for the engine sound.
export function cylindersOf(m) {
  const e = m.engine || '';
  return m.asp === 'ev' ? 0 : /V12|W12/.test(e) ? 12 : /V10/.test(e) ? 10 : /V8|W16/.test(e) ? 8 : /V6|I6|Flat-6|Rotary/.test(e) ? 6 : /I3/.test(e) ? 3 : /I5/.test(e) ? 5 : 4;
}

// The rpm the player has dialed in (Garage → Tune), or the default.
export function launchRpmSetting(spec, car) {
  const want = car?.tune?.twoStepRpm;
  return want ? clamp(want, 2000, spec.redline * 0.92) : optimalLaunchRpm(spec);
}

export class RevLimiter {
  constructor(spec, target) {
    this.spec = spec;
    this.level = spec.twoStep || 0;
    this.target = target ?? optimalLaunchRpm(spec);
    this.rpm = spec.idle + 400;
    this.phase = 0;
    this.flame = 0;          // 0..1+, how big the flames are right now
    this.flames = 0;         // how many flame bursts so far
    this.hot = 0;            // seconds spent on the limiter
  }

  get active() { return this.level > 0; }

  // Where the limiter holds: the launch rpm with a 2-step, near the redline without.
  get ceiling() { return this.level > 0 ? this.target : this.spec.redline * 0.97; }
  get tol() { return this.level > 0 ? FX.twostep.tol[this.level] : 450; }

  // engaged = gas and brake both down. Returns { rpm, flame, bang }.
  update(dt, engaged) {
    let bang = false;
    if (!engaged) {
      this.rpm += (this.spec.idle + 400 - this.rpm) * Math.min(1, dt * 3);
      this.hot = 0;
    } else if (this.rpm < this.ceiling - this.tol) {
      this.rpm = Math.min(this.ceiling, this.rpm + 4800 * dt);        // winding up to the limiter
    } else {
      // on the limiter: the rpm saws up and down around the set point
      const hz = this.level > 0 ? FX.twostep.hz[this.level] : 12;
      const before = this.phase;
      this.phase += dt * hz;
      this.rpm = this.ceiling - this.tol * (0.5 + 0.5 * Math.sin(this.phase * Math.PI * 2));
      this.hot += dt;
      if (Math.floor(this.phase) !== Math.floor(before) && this.level > 0 && Math.random() < FX.twostep.pop[this.level]) {
        bang = true;
        this.flames++;
        this.flame = Math.max(this.flame, FX.twostep.flame[this.level] * (0.7 + Math.random() * 0.6));
      }
    }
    this.flame = Math.max(0, this.flame - dt * 8);
    return { rpm: this.rpm, flame: this.flame, bang };
  }

  // The rpm you leave the line at when you let go of the brake. A tighter
  // 2-step leaves closer to the set point; without one it's wherever the
  // limiter happened to be.
  releaseRpm() {
    if (this.level > 0) return this.target + (Math.random() - 0.5) * 2 * this.tol;
    return this.rpm;
  }
}
