// Player car in the open world. Longitudinal motion comes from the same
// powertrain sim the races use; steering is a bicycle model with lateral
// grip, so cars understeer, slide and drift depending on tires and build.

import { newSim, stepSim, shiftUp, shiftDown } from '../sim/powertrain.js';
import { DIMS } from '../gfx2d/carSprite.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Vehicle {
  constructor(car, model, spec, x, z, h) {
    this.car = car; this.model = model; this.spec = spec;
    this.dims = DIMS[model.body] || DIMS.sedan;
    this.x = x; this.z = z; this.h = h;
    this.vx = 0; this.vz = 0;
    this.sim = newSim(spec, { v: 0 });
    this.sim.nos = car.nos ?? spec.nosSecs;
    this.rev = 0;           // reverse speed (m/s, negative)
    this.steer = 0;
    this.yawRate = 0;
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

  // inp: { throttle, brake, steer(-1..1), handbrake, nitrous, shiftUp, shiftDown, auto }
  // env: { grip (surface*weather), drag (extra rolling drag), noFuel }
  update(dt, inp, env) {
    const spec = this.spec;
    const fx = Math.sin(this.h), fz = -Math.cos(this.h);
    const rx = Math.cos(this.h), rz = Math.sin(this.h);
    let vF = this.vx * fx + this.vz * fz;
    let vR = this.vx * rx + this.vz * rz;

    if (inp.shiftUp && shiftUp(spec, this.sim)) this.shifted = true;
    if (inp.shiftDown) shiftDown(spec, this.sim);

    let throttle = env.noFuel ? 0 : inp.throttle;
    let brake = inp.brake;
    // reverse gear when stopped and holding brake
    if (vF < 0.4 && this.rev === 0 && brake > 0.5 && throttle < 0.1 && this.stillT > 0.25) this.rev = -0.01;
    if (vF < 0.4) this.stillT = (this.stillT || 0) + dt; else this.stillT = 0;
    if (this.rev < 0) {
      if (brake > 0.1) this.rev = Math.max(-9, this.rev - 3.2 * dt * brake);
      else if (throttle > 0.1) this.rev = Math.min(0, this.rev + 9 * dt);
      else this.rev = Math.min(0, this.rev + 2 * dt);
      if (this.rev >= -0.005 && throttle > 0.1) this.rev = 0;
      this.sim.v = 0;
      stepSim(spec, this.sim, { throttle: 0.15, brake: 0, auto: true }, dt);
      this.sim.v = 0;
      vF = this.rev;
      this.braking = false;
    } else {
      this.sim.v = Math.max(0, vF);
      stepSim(spec, this.sim, { throttle, brake, nitrous: inp.nitrous, auto: inp.auto }, dt);
      // surface drag (grass, sand)
      if (env.drag) this.sim.v = Math.max(0, this.sim.v - env.drag * dt * (0.3 + this.sim.v * 0.06));
      vF = this.sim.v;
      this.braking = brake > 0.1;
    }

    // steering: less lock at speed
    const speed = Math.abs(vF);
    const maxSteer = 0.6 / (1 + speed / 14);
    const target = inp.steer * maxSteer;
    this.steer += (target - this.steer) * Math.min(1, dt * 8);
    const wb = this.dims.L * 0.6;
    let yaw = vF / wb * Math.tan(this.steer);
    const grip = (env.grip ?? 1) * clamp(spec.handling, 0.6, 1.8);
    // grip limit on yaw (understeer)
    const maxYaw = (grip * 9.81 * 1.05) / Math.max(4, speed);
    yaw = clamp(yaw, -maxYaw, maxYaw);
    let latGrip = 7.5 * grip;
    if (inp.handbrake && speed > 4) { latGrip *= 0.18; yaw *= 1.45; vF *= Math.pow(0.55, dt); this.sim.v = Math.max(0, vF); }
    // power oversteer on RWD when the rears are spinning
    if (spec.drive === 'RWD' && this.sim.slip > 0.15 && speed > 4) { latGrip *= 0.5; yaw *= 1 + Math.min(0.6, this.sim.slip * 0.5); }
    this.yawRate += (yaw - this.yawRate) * Math.min(1, dt * 10);
    this.h += this.yawRate * dt;
    vR *= Math.exp(-latGrip * dt);
    // sliding carries some momentum sideways after the heading changes
    const nfx = Math.sin(this.h), nfz = -Math.cos(this.h), nrx = Math.cos(this.h), nrz = Math.sin(this.h);
    const oldVx = this.vx, oldVz = this.vz;
    const newVx = nfx * vF + nrx * vR, newVz = nfz * vF + nrz * vR;
    const blend = Math.min(1, dt * latGrip * 0.9);
    this.vx = oldVx + (newVx - oldVx) * blend;
    this.vz = oldVz + (newVz - oldVz) * blend;
    // keep the longitudinal part from the sim exact
    const fNow = this.vx * nfx + this.vz * nfz;
    this.vx += nfx * (vF - fNow); this.vz += nfz * (vF - fNow);
    this.slipAngle = Math.atan2(this.vx * nrx + this.vz * nrz, Math.max(1, Math.abs(vF)));

    this.x += this.vx * dt;
    this.z += this.vz * dt;
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
    // scrub speed
    this.vx *= 0.92; this.vz *= 0.92;
    const fx = Math.sin(this.h), fz = -Math.cos(this.h);
    this.sim.v = Math.max(0, this.vx * fx + this.vz * fz);
    if (this.rev < 0) this.rev = Math.min(0, -Math.max(0, -(this.vx * fx + this.vz * fz)));
    return -vn;
  }
}
