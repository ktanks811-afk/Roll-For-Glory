// Longitudinal vehicle simulation shared by every race, the open world and
// the dyno. One source of truth: if a part adds power here, it shows up in
// the dyno chart, the 0-60 figure, the drag strip and the highway alike.

import { FX, PERF_IDS } from '../data/parts.js';
import { WHEEL_R } from '../data/cars.js';
import { tuneEffects } from './tuning.js';

const HP_W = 745.7;
const LBFT_NM = 1.3558;
const G = 9.81;
const RHO = 1.225;
export const MPH = 2.23694; // m/s -> mph
export const DIST = { eighth: 201.17, quarter: 402.34, half: 804.67, mile: 1609.34 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TC_SLIP = [0, 0.3, 0.18, 0.1, 0.05, 0.02];
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };


// ---------------------------------------------------------------------------
// Spec: factory figures + installed parts + condition -> numbers the sim uses
// ---------------------------------------------------------------------------
export function buildSpec(model, parts = {}, cond = {}, tune = {}, visual = {}) {
  const L = k => parts[k] || 0;
  let mult = FX.engine.hp[L('engine')] * FX.intake.hp[L('intake')] * FX.exhaust.hp[L('exhaust')] * FX.ecu.hp[L('ecu')];
  let asp = model.asp;
  let boostLevel = 0;
  if (L('turbo') > 0) {
    mult *= model.asp === 'turbo' ? FX.turboUp.hp[L('turbo')] : FX.turboKit.hp[L('turbo')];
    asp = 'turbo'; boostLevel = L('turbo');
  } else if (L('supercharger') > 0) {
    mult *= model.asp === 'sc' ? FX.scUp.hp[L('supercharger')] : FX.scKit.hp[L('supercharger')];
    asp = 'sc'; boostLevel = L('supercharger');
  }
  if (asp !== 'na') mult *= FX.intercooler.hp[L('intercooler')];
  const baseRedline = model.redline + FX.engine.redline[L('engine')] + FX.ecu.redline[L('ecu')];
  // Garage → Tune: boost, timing, AFR, gearing, chassis setup (neutral if untouched)
  const tf = tuneEffects(model, Object.fromEntries(PERF_IDS.map(k => [k, L(k)])), tune || {}, visual || {}, baseRedline);
  mult *= tf.boostMult;

  const fuelCap = FX.fuel.cap[L('fuel')];
  const fuelLimited = mult > fuelCap;
  if (fuelLimited) mult = fuelCap;

  const c = k => (cond[k] ?? 100) / 100;
  const engHealth = c('engine') < 0.25 ? 0.55 : 0.7 + 0.3 * c('engine');

  const hp = model.hp * mult * engHealth * tf.mapMult;
  const redline = baseRedline;

  let shiftBase = FX.transmission.shift[L('transmission')];
  const code = model.transCode || '';
  if (/EV/.test(code)) shiftBase = 0.02;
  else if (/DCT/.test(code)) shiftBase *= 0.45;
  else if (/AT|CVT/.test(code)) shiftBase *= 0.75;
  const shiftTime = shiftBase * (1 + (1 - c('trans')) * 1.5);

  // full grip until the tires are nearly gone: they only go greasy at 10% or less
  const tc = c('tires');
  const tireHealth = tc >= 0.15 ? 1 : tc > 0.10 ? 0.75 + 0.25 * (tc - 0.10) / 0.05 : 0.35 + 0.4 * (tc / 0.10);
  const mu = model.grip * FX.tires.mu[L('tires')] * tireHealth;

  const driveFrac = model.drive === 'AWD' ? 1
    : model.drive === 'RWD' ? (1 - model.wf) + 0.2 + 0.02 * L('suspension')
    : model.wf - 0.04;

  const spec = {
    id: model.id, body: model.body, drive: model.drive, asp, boostLevel,
    hpTarget: hp,
    tqTarget: model.tq * LBFT_NM * mult * engHealth * tf.mapMult,
    redline, idle: model.asp === 'ev' ? 0 : 850,
    lim: model.lim && L('ecu') < 2 ? model.lim / 2.23694 : null,
    peakTqRpm: Math.min(model.peakTqRpm, redline * 0.85) * (asp === 'turbo' && model.asp !== 'turbo' ? 0.85 : 1),
    spoolRpm: asp === 'turbo' ? redline * (0.34 + 0.035 * Math.max(0, boostLevel - 1)) : 0,
    spoolTime: asp === 'turbo' ? 0.25 + 0.07 * boostLevel : 0,
    mass: model.kg * FX.weight.mult[L('weight')] + (L('nitrous') ? 14 : 0),
    mu, trac: FX.diff.trac[L('diff')] * FX.suspension.trac[L('suspension')] * tf.trac,
    wf: model.wf ?? 0.54, driveFrac, eff: model.drive === 'AWD' ? 0.8 : model.drive === 'FWD' ? 0.88 : 0.86,
    gears: model.gears.map((g, i) => g * (tf.gearMult[i] ?? 1)), fd: model.fd * tf.fd,
    wheelR: WHEEL_R[model.body] || 0.32,
    cd: model.cd, area: model.area,
    shiftTime,
    clutchCap: model.tq * LBFT_NM * FX.clutch.cap[L('clutch')],
    nosHp: FX.nitrous.hp[L('nitrous')], nosSecs: FX.nitrous.secs[L('nitrous')],
    lv: { ...parts },
    twoStep: L('twostep'),
    launchControl: L('twostep') >= 1,
    brakeG: 0.85 * FX.brakes.force[L('brakes')] * tf.brakeG,
    handling: FX.suspension.handling[L('suspension')] * mu * tf.handling,
    fuelLimited,
    // chassis setup read by the open-world handling model
    gripF: tf.gripF, gripR: tf.gripR, hcg: tf.hcg, stiffAdj: tf.stiff, turnIn: tf.turnIn,
    brakeShift: tf.brakeShift, diffPow: tf.diffPow, diffLift: tf.diffLift,
    downforce: tf.downforce, dragArea: tf.dragArea, crr: tf.crr, tc: tf.tc,
    knock: tf.knock, overRev: tf.overRev, boostPsi: tf.boost, balance: tf.balance, tuneWarnings: tf.warnings,
    curveRedline: redline,
  };
  fitCurve(spec);
  if (tf.redline) { spec.redline = tf.redline; figures(spec); }
  spec.shiftRpm = computeShiftPoints(spec);
  return spec;
}

// Torque shape, normalized so its peak is 1 (at full boost).
function shape(spec, rpm, fEnd) {
  const rl = spec.curveRedline || spec.redline;
  const r = rpm / rl;
  const pt = spec.peakTqRpm / rl;
  const idleR = spec.idle / rl;
  if (spec.asp === 'ev') return r < pt ? 1 : Math.max(0.05, pt / r);
  const fLow = spec.asp === 'sc' ? 0.82 : spec.asp === 'turbo' ? 0.78 : 0.64;
  let f;
  if (r < pt) f = fLow + (1 - fLow) * Math.sin(Math.PI / 2 * clamp((r - idleR) / (pt - idleR), 0, 1));
  else f = 1 - (1 - fEnd) * Math.pow((r - pt) / (1 - pt), 1.4);
  if (spec.asp === 'turbo') f *= 0.5 + 0.5 * smooth(spec.spoolRpm * 0.55, spec.spoolRpm * 1.2, rpm);
  return Math.max(0.05, f);
}

function peakPower(spec, tpk, fEnd) {
  let best = 0;
  for (let rpm = 1000; rpm <= spec.redline; rpm += 100) {
    best = Math.max(best, tpk * shape(spec, rpm, fEnd) * rpm * Math.PI / 30);
  }
  return best;
}

// Choose the curve's falloff (and if needed its peak) so the computed peak
// power lands on the hp figure. Keeps advertised and simulated numbers equal.
function fitCurve(spec) {
  const P = spec.hpTarget * HP_W;
  let tpk = spec.tqTarget;
  let lo = 0.15, hi = 1.0;
  if (peakPower(spec, tpk, hi) < P) {
    tpk *= P / peakPower(spec, tpk, hi);
    spec.fEnd = hi;
  } else if (peakPower(spec, tpk, lo) > P) {
    tpk *= P / peakPower(spec, tpk, lo);
    spec.fEnd = lo;
  } else {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (peakPower(spec, tpk, mid) > P) hi = mid; else lo = mid;
    }
    spec.fEnd = (lo + hi) / 2;
  }
  spec.tpk = tpk;
  figures(spec);
}

// display figures straight off the curve
function figures(spec) {
  let maxT = 0, maxP = 0, maxPRpm = 0, maxTRpm = 0;
  for (let rpm = 1000; rpm <= spec.redline; rpm += 50) {
    const t = torqueAt(spec, rpm);
    const p = t * rpm * Math.PI / 30;
    if (t > maxT) { maxT = t; maxTRpm = rpm; }
    if (p > maxP) { maxP = p; maxPRpm = rpm; }
  }
  spec.hp = Math.round(maxP / HP_W);
  spec.tq = Math.round(maxT / LBFT_NM);
  spec.hpRpm = maxPRpm;
  spec.tqRpm = maxTRpm;
}

// Engine torque (Nm) at full throttle and full boost.
export function torqueAt(spec, rpm) {
  if (rpm > spec.redline + 50) return 0;
  return spec.tpk * shape(spec, Math.max(rpm, spec.idle), spec.fEnd);
}

export function dynoCurve(spec, step = 250) {
  const out = [];
  for (let rpm = 1500; rpm <= spec.redline; rpm += step) {
    const t = torqueAt(spec, rpm);
    out.push({ rpm, hp: t * rpm * Math.PI / 30 / HP_W, tq: t / LBFT_NM });
  }
  return out;
}

function computeShiftPoints(spec) {
  const pts = [];
  const g = spec.gears;
  for (let i = 0; i < g.length - 1; i++) {
    let shiftAt = spec.redline * 0.985;
    for (let rpm = spec.peakTqRpm; rpm < spec.redline; rpm += 50) {
      const cur = torqueAt(spec, rpm) * g[i];
      const nextRpm = rpm * g[i + 1] / g[i];
      const nxt = torqueAt(spec, nextRpm) * g[i + 1];
      if (nxt >= cur) { shiftAt = Math.min(rpm, shiftAt); break; }
    }
    pts.push(shiftAt);
  }
  return pts;
}

export function gearTopSpeed(spec, gearIdx) {
  return spec.redline / (spec.gears[gearIdx] * spec.fd) * spec.wheelR * Math.PI / 30;
}

// Best gear to be in at a given speed for a roll race (most wheel torque
// without being near the limiter).
export function bestGearFor(spec, v) {
  let best = spec.gears.length - 1, bestF = -1;
  for (let i = 0; i < spec.gears.length; i++) {
    const rpm = wheelRpm(spec, v, i);
    if (rpm > spec.redline * 0.9) continue;
    const f = torqueAt(spec, Math.max(rpm, spec.idle)) * spec.gears[i];
    if (f > bestF) { bestF = f; best = i; }
  }
  return best;
}

export function wheelRpm(spec, v, gearIdx) {
  return v / spec.wheelR * spec.gears[gearIdx] * spec.fd * 30 / Math.PI;
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------
export function newSim(spec, opts = {}) {
  const v = opts.v || 0;
  const gear = opts.gear ?? (v > 1 ? bestGearFor(spec, v) : 0);
  return {
    x: 0, v, gear, rpm: Math.max(spec.idle, wheelRpm(spec, v, gear)),
    shiftT: 0, pendingGear: gear, boost: v > 1 ? 0.6 : 0, nos: spec.nosSecs, nosOn: false,
    slip: 0, spinTime: 0, limiter: false, tireTemp: opts.tireTemp ?? 0.5,
    launchHeld: 0, t: 0, shifts: 0, missedShift: 0, peakV: v, draft: 0,
  };
}

export function shiftUp(spec, s) {
  if (s.shiftT > 0 || s.gear >= spec.gears.length - 1) return false;
  s.pendingGear = s.gear + 1; s.shiftT = spec.shiftTime; s.shifts++;
  return true;
}
export function shiftDown(spec, s) {
  if (s.shiftT > 0 || s.gear <= 0) return false;
  const rpmAfter = wheelRpm(spec, s.v, s.gear - 1);
  if (rpmAfter > spec.redline * 1.02) return false; // box refuses a money shift
  s.pendingGear = s.gear - 1; s.shiftT = spec.shiftTime * 0.8;
  return true;
}

// input: { throttle 0-1, brake 0-1, nitrous bool, auto bool, launchRpm?, perfect? }
export function stepSim(spec, s, input, dt) {
  s.t += dt;
  const throttle = clamp(input.throttle || 0, 0, 1);
  const brake = clamp(input.brake || 0, 0, 1);

  if (s.shiftT > 0) {
    s.shiftT -= dt;
    if (s.shiftT <= 0) { s.gear = s.pendingGear; s.shiftT = 0; }
  }
  const ratio = spec.gears[s.gear] * spec.fd;
  const rpmW = s.v / spec.wheelR * ratio * 30 / Math.PI;

  // Clutch slip off the line: engine sits at launch rpm (held by the driver
  // or launch control) until the wheels catch up.
  const slipRpm = input.launchRpm || (spec.idle + throttle * spec.redline * 0.42);
  const clutchSlipping = spec.asp !== 'ev' && s.gear === 0 && rpmW < slipRpm && s.shiftT <= 0 && throttle > 0.05;
  let rpm = clutchSlipping ? slipRpm : Math.max(spec.idle, rpmW);

  // Turbo spool lag
  if (spec.asp === 'turbo') {
    const target = throttle * smooth(spec.spoolRpm * 0.5, spec.spoolRpm, rpm);
    const k = target > s.boost ? dt / spec.spoolTime : dt * 4;
    s.boost += (target - s.boost) * Math.min(1, k);
  } else s.boost = throttle;

  s.limiter = rpm >= spec.redline;
  let tq = s.limiter ? 0 : torqueAt(spec, rpm) * throttle;
  if (spec.asp === 'turbo') tq *= 0.62 + 0.38 * s.boost / Math.max(0.01, throttle || 1);
  if (clutchSlipping) tq = Math.min(tq, spec.clutchCap);

  let fDrive = s.shiftT > 0 || (spec.lim && s.v > spec.lim) ? 0 : tq * ratio * spec.eff / spec.wheelR;

  s.nosOn = false;
  if (input.nitrous && s.nos > 0 && throttle > 0.8 && s.shiftT <= 0 && spec.nosHp > 0) {
    s.nos = Math.max(0, s.nos - dt);
    s.nosOn = true;
    fDrive += spec.nosHp * HP_W / Math.max(s.v, 9) * spec.eff;
  }

  // Traction: tire temp (from burnouts) helps, speed adds a little downforce.
  const tempF = 0.9 + 0.22 * Math.min(1, s.tireTemp);
  const down = (spec.downforce || 0) * s.v * s.v * (spec.drive === 'FWD' ? 0.2 : 1);
  const fTrac = spec.mu * spec.trac * (G * spec.mass * spec.driveFrac + down) * tempF * (1 + s.v * 0.0012);
  if (input.perfect && fDrive > fTrac * 1.03) fDrive = fTrac * 1.03;
  // traction control: cuts power the moment the driven wheels start to spin
  else if (spec.tc && !input.burnout && fDrive > fTrac * (1 + TC_SLIP[spec.tc])) fDrive = fTrac * (1 + TC_SLIP[spec.tc]);

  let fx = fDrive;
  if (fDrive > fTrac) {
    s.slip = clamp(fDrive / fTrac - 1, 0, 1.5);
    fx = fTrac * (1 - 0.18 * Math.min(1, s.slip));
    s.spinTime += dt;
    if (!clutchSlipping) rpm = Math.min(spec.redline, rpm * (1 + 0.35 * Math.min(1, s.slip)));
    s.tireTemp = Math.min(1.2, s.tireTemp + dt * 0.08 * s.slip);
  } else {
    s.slip = Math.max(0, s.slip - dt * 4);
  }
  s.tireTemp = Math.max(0.3, s.tireTemp - dt * 0.004);

  const aero = (0.5 * RHO * spec.cd * spec.area + (spec.dragArea || 0) * 0.5 * RHO) * s.v * s.v * (1 - (s.draft || 0));
  const roll = s.v > 0.1 ? spec.mass * G * (spec.crr || 0.013) : 0;
  const brakeF = s.v > 0.05 ? brake * spec.brakeG * G * spec.mass : 0;
  const engineBrake = throttle < 0.05 && s.v > 1 && s.shiftT <= 0 ? ratio * 4 : 0;

  const a = (fx - aero - roll - brakeF - engineBrake) / spec.mass;
  s.accel = a;
  s.v = Math.max(0, s.v + a * dt);
  s.x += s.v * dt;
  if (s.v > s.peakV) s.peakV = s.v;
  // rpm display eases toward the computed value
  s.rpm += (rpm - s.rpm) * Math.min(1, dt * 18);

  if (input.auto && s.shiftT <= 0) {
    if (s.gear < spec.gears.length - 1 && s.rpm >= spec.shiftRpm[s.gear] - 10 && !clutchSlipping) shiftUp(spec, s);
    else if (s.gear > 0 && s.rpm < spec.redline * 0.32 && throttle < 0.5) shiftDown(spec, s);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Performance figures (cached)
// ---------------------------------------------------------------------------
const metricCache = new Map();
export function metrics(spec) {
  const key = JSON.stringify([spec.id, spec.hp, spec.tq, spec.mass, spec.mu, spec.trac, spec.shiftTime, spec.fd, spec.gears, spec.redline, spec.tpk, spec.nosHp, spec.asp, spec.downforce, spec.dragArea, spec.crr, spec.tc]);
  if (metricCache.has(key)) return metricCache.get(key);

  const s = newSim(spec, { tireTemp: 0.6 });
  const dt = 1 / 120;
  const out = { zero60: null, zero100: null, eighth: null, quarter: null, half: null, mile: null,
    quarterTrap: 0, halfTrap: 0, topSpeed: 0, sixtyFt: null };
  const launchRpm = spec.asp === 'turbo' ? spec.redline * 0.62 : spec.redline * 0.5;
  let lastV = 0, stable = 0;
  while (s.t < 160) {
    stepSim(spec, s, { throttle: 1, auto: true, perfect: true, launchRpm }, dt);
    const mph = s.v * MPH;
    if (out.sixtyFt === null && s.x >= 18.29) out.sixtyFt = s.t;
    if (out.zero60 === null && mph >= 60) out.zero60 = s.t;
    if (out.zero100 === null && mph >= 100) out.zero100 = s.t;
    if (out.eighth === null && s.x >= DIST.eighth) out.eighth = s.t;
    if (out.quarter === null && s.x >= DIST.quarter) { out.quarter = s.t; out.quarterTrap = mph; }
    if (out.half === null && s.x >= DIST.half) { out.half = s.t; out.halfTrap = mph; }
    if (out.mile === null && s.x >= DIST.mile) out.mile = s.t;
    if (Math.abs(s.v - lastV) < 0.0004 && s.shiftT <= 0) { if (++stable > 240) break; } else stable = 0;
    lastV = s.v;
  }
  out.topSpeed = s.peakV * MPH;
  out.pi = perfIndexFrom(out.quarter);
  out.cls = perfClass(out.pi);
  metricCache.set(key, out);
  return out;
}

export function perfIndexFrom(quarter) {
  if (!quarter) return 100;
  return Math.round(clamp((17.5 - quarter) / (17.5 - 8.2), 0, 1) * 899 + 100);
}
export function perfClass(pi) {
  return pi >= 900 ? 'S+' : pi >= 800 ? 'S' : pi >= 650 ? 'A' : pi >= 500 ? 'B' : pi >= 330 ? 'C' : 'D';
}
