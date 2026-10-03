// Player car in the open world. Longitudinal motion comes from the same
// powertrain sim the races use; steering is a bicycle model with lateral
// grip, so cars understeer, slide and drift depending on tires and build.

import { newSim, stepSim, shiftUp, shiftDown } from '../sim/powertrain.js';
import { dimsFor } from '../gfx2d/carSprite.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const G = 9.81;
const HCG = 0.52;              // centre-of-gravity height (m)
const SUBSTEP = 1 / 240;
const BURN_CREEP = 1.0;        // m/s the car creeps while it burns out in a straight line
const HANDBRAKE_DECEL = 5.2;

export class Vehicle {
  constructor(car, model, spec, x, z, h) {
    this.car = car; this.model = model; this.spec = spec;
    this.dims = dimsFor(model);
    this.x = x; this.z = z; this.h = h;
    this.vx = 0; this.vz = 0;
    this.sim = newSim(spec, { v: 0 });
    this.sim.nos = car.nos ?? spec.nosSecs;
    this.rev = 0;           // reverse speed (m/s, negative)
    this.steer = 0;          // road-wheel angle (rad)
    this.steerIn = 0;        // damped stick / key input
    this.ax = 0;
    this.yawRate = 0;
    this.latG = 0; this.lonG = 0; this.skid = 0; this.burning = false;
    this.slipF = 0; this.slipR = 0;
    this.slipAngle = 0;
    this.lastImpact = 0;
    this.braking = false;
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get fwd() { return { x: Math.sin(this.h), z: -Math.cos(this.h) }; }

  setSpec(spec) {
    const v = this.sim.v, g = Math.min(this.sim.gear, spec.gears.length - 1);
    this.spec = spec;
    this.sim = newSim(spec, { v, gear: g });
    this.sim.nos = this.car.nos ?? spec.nosSecs;
  }

  // inp: { throttle, brake, steer(-1..1), handbrake, nitrous, shiftUp, shiftDown, auto, burnout }
  // env: { grip (surface*weather), drag (extra rolling drag), noFuel }
  //
  // Longitudinal speed comes from the powertrain sim. Sideways motion is a
  // real bicycle model: each axle has a slip angle, a tire curve that peaks
  // and then lets go, weight that moves forward under braking and back under
  // power, and a friction circle so a tire can't corner and put its power or
  // brakes down at the same time. That is what gives FWD its push, RWD its
  // snap on the throttle, trail-braking rotation and handbrake slides.
  update(dt, inp, env) {
    const spec = this.spec;
    const fx = Math.sin(this.h), fz = -Math.cos(this.h);
    const rx = Math.cos(this.h), rz = Math.sin(this.h);
    let u0 = this.vx * fx + this.vz * fz;       // forward speed (m/s)
    let vy = this.vx * rx + this.vz * rz;       // sideways speed, + = right

    if (inp.shiftUp && shiftUp(spec, this.sim)) this.shifted = true;
    if (inp.shiftDown) shiftDown(spec, this.sim);

    const throttle = env.noFuel ? 0 : inp.throttle;
    const brake = inp.brake;
    // gas + brake with no 2-step = burnout. Brakes pin the non-driven axle,
    // the driven tires light up. With a 2-step the same combo is launch hold.
    const burn = !env.noFuel && !!inp.burnout && throttle > 0.3 && brake > 0.3 && u0 < 9 && this.rev > -1;
    this.burning = burn;

    let u1;
    // reverse gear when stopped and holding brake
    if (u0 < 0.4 && this.rev === 0 && brake > 0.5 && throttle < 0.1 && this.stillT > 0.25) this.rev = -0.01;
    if (u0 < 0.4) this.stillT = (this.stillT || 0) + dt; else this.stillT = 0;
    if (this.rev < 0) {
      if (brake > 0.1) this.rev = Math.max(-9, this.rev - 3.2 * dt * brake);
      else if (throttle > 0.1) this.rev = Math.min(0, this.rev + 9 * dt);
      else this.rev = Math.min(0, this.rev + 2 * dt);
      if (this.rev >= -0.005 && throttle > 0.1) this.rev = 0;
      this.sim.v = 0;
      stepSim(spec, this.sim, { throttle: 0.15, brake: 0, auto: true }, dt);
      this.sim.v = 0;
      u1 = this.rev;
      this.braking = false;
    } else {
      this.sim.v = Math.max(0, u0);
      stepSim(spec, this.sim, { throttle, brake: burn ? 0 : brake, nitrous: inp.nitrous, auto: inp.auto }, dt);
      if (env.drag) this.sim.v = Math.max(0, this.sim.v - env.drag * dt * (0.3 + this.sim.v * 0.06));
      if (burn) {
        // the brakes hold the car back while the drive wheels spin
        this.sim.v = Math.min(this.sim.v, Math.max(BURN_CREEP + 2.4 * Math.abs(this.steerIn), u0 - 14 * dt));   // straight: nearly in place; steering: carve donuts
        this.sim.slip = Math.max(this.sim.slip, 0.55 + 0.45 * throttle);
        this.sim.tireTemp = Math.min(1.2, this.sim.tireTemp + dt * 0.35);
      }
      if (inp.handbrake && u0 > 1) this.sim.v = Math.max(0, this.sim.v - HANDBRAKE_DECEL * dt);
      u1 = this.sim.v;
      this.braking = brake > 0.1 && !burn;
    }

    // ---- steering: wheel-angle limit shrinks with speed, input is damped ----
    const wb = this.dims.L * 0.6;
    const mu = clamp(spec.handling * (env.grip ?? 1), 0.25, 2.0) * 0.98;
    const speed = Math.abs(u0);
    const rate = 80;     // the wheel follows the stick/arrow instantly
    this.steerIn += clamp(inp.steer - this.steerIn, -rate * dt, rate * dt);
    const lock = clamp((0.1 / (1 + speed / 18) + 1.9 * mu * G * wb / (speed * speed + 30)) * (spec.turnIn || 1), 0.07, 0.58 * Math.max(1, spec.turnIn || 1));   // arrow keys are all-or-nothing, so full lock has to bite at any speed
    let target = this.steerIn * lock;
    // a touch of counter-steer help so a slide is catchable on a thumb stick
    const beta = Math.atan2(vy, Math.max(2, Math.abs(u0)));
    if (u0 > 3.5 && Math.abs(beta) > 0.1 && !burn) {
      const w = Math.abs(inp.steer) < 0.25 ? 0.9 : 0.35;
      target += clamp(-beta * w, -0.32, 0.32);
    }
    target = clamp(target, -0.6, 0.6);
    this.steer += (target - this.steer) * Math.min(1, dt * 45);
    const d = this.steer;

    // ---- dynamics ----
    const m = spec.mass, wf = clamp(spec.wf ?? 0.54, 0.4, 0.7);
    const A = wb * (1 - wf), B = wb * wf;                      // CG to front / rear axle
    const Iz = m * wb * wb * 0.24;
    const Nf0 = m * G * wf, Nr0 = m * G * (1 - wf);
    const stiff = clamp(clamp(9 + 3.5 * (spec.handling - 1), 7, 14) * (spec.stiffAdj || 1), 6, 16);
    const axRaw = (u1 - u0) / Math.max(dt, 1e-4);
    this.ax += (axRaw - this.ax) * Math.min(1, dt * 7);
    const ax = clamp(this.ax, -1.3 * G, 1.0 * G);
    const hcg = spec.hcg || HCG;
    const Nf = clamp(Nf0 - m * ax * hcg / wb, 0.3 * Nf0, 1.8 * Nf0);
    const Nr = m * G - Nf + (spec.downforce || 0) * u0 * u0;   // a GT wing pushes the rear down at speed
    // how much of each tire's grip the throttle / brakes are already using
    const Fx = m * ax;
    const drive = spec.drive;
    let rhoF, rhoR;
    if (Fx >= 0) {
      const sh = drive === 'FWD' ? 1 : drive === 'RWD' ? 0 : 0.32;
      rhoF = Fx * sh / (mu * Nf); rhoR = Fx * (1 - sh) / (mu * Nr);
    } else {
      // brake bias follows the load (a proportioning valve), so the rears don't lock first
      const rs = clamp(0.85 * Nr / (m * G) + (spec.brakeShift || 0), 0.05, 0.5);   // + brake bias from the tune
      rhoF = -Fx * (1 - rs) / (mu * Nf); rhoR = -Fx * rs / (mu * Nr);
    }
    // Good tires: power and brakes barely eat into cornering grip, and the car stays planted.
    // Tires at 10% or less: the old greasy, tail-happy behaviour.
    const grippy = (this.car.cond?.tires ?? 100) > 10;
    if (grippy) { rhoF *= 0.5; rhoR *= 0.5; }
    const spin = this.sim.slip;
    const spinNow = spin;
    if (spin > 0) {
      const lit = (0.7 + 0.3 * Math.min(1, spin)) * (grippy ? 0.45 : 1);
      if (drive !== 'RWD') rhoF = Math.max(rhoF, lit * (drive === 'AWD' ? 0.65 : 1));
      if (drive !== 'FWD') rhoR = Math.max(rhoR, lit * (drive === 'AWD' ? 0.9 : 1));
    }
    let rearLock = 1;
    if (inp.handbrake && u0 > 1.5) { rhoR = 1; rearLock = 0.5; }
    if (burn) {
      if (drive === 'FWD') { rhoF = 1; rhoR = Math.max(rhoR, 0.45); }
      else if (drive === 'RWD') { rhoR = 1; rhoF = Math.max(rhoF, 0.4); }
      else { rhoF = 0.85; rhoR = 1; }
    }
    rhoF = Math.min(1, rhoF); rhoR = Math.min(1, rhoR);
    // tires hold a little less per kilo when heavily loaded; fronts give up first
    const loadF = 1 - 0.1 * (Nf / Nf0 - 1), loadR = 1 - 0.1 * (Nr / Nr0 - 1);
    const peakF0 = 0.93 * mu * Nf * loadF * Math.max(0.2, Math.sqrt(1 - rhoF * rhoF));
    const peakR0 = mu * Nr * loadR * Math.max(0.2, Math.sqrt(1 - rhoR * rhoR)) * rearLock;
    // chassis setup: axle balance from springs / bars / camber / pressures,
    // and the diff: accel lock lets go of the driven axle under power,
    // decel lock plants the rear (and resists turn-in) off throttle
    const pull = Fx > 0 ? Math.min(1, Fx / (mu * m * G * 0.5)) : 0;
    let dF = spec.gripF || 1, dR = spec.gripR || 1;
    if (spec.diffPow && pull) { if (drive === 'FWD') dF *= 1 - spec.diffPow * pull; else dR *= 1 - spec.diffPow * pull * (drive === 'AWD' ? 0.5 : 1); }
    if (spec.diffLift && Fx <= 0) { dR *= 1 + spec.diffLift * 0.5; dF *= 1 - spec.diffLift * 0.3; }
    const peakF = peakF0 * dF, peakR = peakR0 * dR;

    const n = Math.max(1, Math.ceil(dt / SUBSTEP));
    const h = dt / n;
    const dyn = this.rev < 0 || u0 < 0 ? 0 : burn ? 1 : clamp((u0 - 1.5) / 3, 0, 1);
    let u = u0, r = this.yawRate, v = vy;
    let x = this.x, z = this.z, hd = this.h;
    let aF = 0, aR = 0, fyF = 0, fyR = 0;
    for (let i = 0; i < n; i++) {
      const uTarget = u1;                                // powertrain's number wins in the long run
      const uEff = Math.max(Math.abs(u), burn ? 2.5 : 1.5);
      aF = Math.atan2(v + A * r, uEff) - d;
      aR = Math.atan2(v - B * r, uEff);
      fyF = -peakF * Math.sin(1.45 * Math.atan(stiff * aF));
      fyR = -peakR * Math.sin(1.45 * Math.atan(stiff * aR));
      const vDot = (fyF * Math.cos(d) + fyR) / m - u * r;
      const rDot = (A * fyF * Math.cos(d) - B * fyR) / Iz;
      let nr = r + rDot * h, nv = v + vDot * h;
      if (grippy && !inp.handbrake && !burn) nv *= Math.exp(-3.5 * dyn * h);   // planted: sideways speed is bled off
      if (dyn < 1) {
        const rk = u * Math.tan(d) / wb;
        nr = dyn * nr + (1 - dyn) * rk;
        nv = dyn * nv + (1 - dyn) * v * Math.exp(-10 * h);
      }
      r = nr; v = nv;
      // cornering scrub: sideways-sliding tires drag the car back
      const scrub = (Math.abs(fyF * Math.sin(aF)) + Math.abs(fyR * Math.sin(aR)) + Math.abs(fyF * Math.sin(d))) / m;
      u += (uTarget - u0) / n + (v * r - scrub * Math.sign(u || 1)) * h * dyn;
      hd += r * h;
      x += (u * Math.sin(hd) + v * Math.cos(hd)) * h;
      z += (-u * Math.cos(hd) + v * Math.sin(hd)) * h;
    }
    // Turn assist: the instant you hold left or right the car should be turning
    // as hard as the tires allow. If the tire model is lagging behind (front
    // tires saturated, power-on push), add the missing yaw and swing the
    // velocity round with it so the car actually changes direction.
    let dTh = 0;
    if (u > 1.2 && !burn && !inp.handbrake && this.rev >= 0 && Math.abs(inp.steer) > 0.05) {
      const rMax = 0.9 * mu * G / Math.max(u, 4);
      const want = clamp(u * Math.tan(d) / wb, -rMax, rMax);
      if (Math.abs(want) > Math.abs(r) && want * (r || want) >= 0) {
        const dr = (want - r) * Math.min(1, dt * 14) * (spinNow > 0.1 ? 0.55 : 0.9);
        r += dr; dTh = dr * dt * 0 + dr * dt;
      }
    }
    hd += dTh;
    this.h = hd; this.x = x; this.z = z;
    this.yawRate = r;
    const nfx = Math.sin(hd), nfz = -Math.cos(hd), nrx = Math.cos(hd), nrz = Math.sin(hd);
    this.vx = nfx * u + nrx * v;
    this.vz = nfz * u + nrz * v;
    if (dTh) { const c = Math.cos(dTh), sn = Math.sin(dTh); const vx = this.vx * c - this.vz * sn, vz = this.vx * sn + this.vz * c; this.vx = vx; this.vz = vz; }
    if (this.rev >= 0) this.sim.v = Math.max(0, u);
    else this.rev = Math.min(0, u);

    // numbers for the world / camera / sounds
    this.slipAngle = Math.atan2(v, Math.max(1, Math.abs(u)));
    this.slipF = aF; this.slipR = aR;
    this.latG = (fyF * Math.cos(d) + fyR) / (m * G);
    this.lonG = ax / G;
    const slideR = Math.abs(aR) > 0.2 * (0.7 + 0.3 * mu) && peakR > 0 && u > 3;
    const slideF = Math.abs(aF) > 0.24 && u > 3;
    const lockUp = brake > 0.95 && u0 > 8 && Math.abs(Fx) > 0.95 * mu * m * G * 0.9;
    this.skid = (slideR || slideF || lockUp || burn || (spin > 0.25 && u < 14)) ? Math.min(1, 0.4 + Math.abs(aR) * 2 + spin * 0.5) : 0;
    if (this.sim.nosOn) this.car.nos = this.sim.nos;
  }

  // Points used for collision (front and rear circles).
  circles() {
    const f = this.dims.L * 0.28, r = this.dims.W / 2 + 0.05;
    const fx = Math.sin(this.h), fz = -Math.cos(this.h);
    return [{ x: this.x + fx * f, z: this.z + fz * f, r }, { x: this.x - fx * f, z: this.z - fz * f, r }];
  }

  // Push out of a surface with normal (nx, nz). Returns impact speed.
  bounce(nx, nz, pen) {
    this.x += nx * pen; this.z += nz * pen;
    const vn = this.vx * nx + this.vz * nz;
    if (vn >= 0) return 0;
    this.vx -= nx * vn * 1.35; this.vz -= nz * vn * 1.35;
    this.yawRate *= 0.55;
    // scrub speed
    this.vx *= 0.92; this.vz *= 0.92;
    const fx = Math.sin(this.h), fz = -Math.cos(this.h);
    this.sim.v = Math.max(0, this.vx * fx + this.vz * fz);
    if (this.rev < 0) this.rev = Math.min(0, -Math.max(0, -(this.vx * fx + this.vz * fz)));
    return -vn;
  }
}
