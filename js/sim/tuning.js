// Garage → Tune. Every adjustment a real tuner makes, gated by the hardware
// that makes it adjustable in real life:
//
//   Engine map    boost, ignition timing, WOT air/fuel ratio, rev limiter,
//                 traction control. Needs an ECU tune (a stock ECU is locked).
//   Gearing       final drive (ring & pinion) for anyone; individual gear
//                 ratios need a built gearbox (Transmission stage 2+).
//   Suspension    ride height, springs, bump/rebound, sway bars need
//                 coilovers (Suspension stage 2+, springs and double-adjust
//                 dampers at stage 3+). Alignment (camber, toe) is always
//                 adjustable, with more camber range from camber plates.
//   Tires         pressures front and rear.
//   Brakes        front/rear bias needs a big brake kit with a bias valve.
//   Differential  accel / decel lock needs a limited-slip diff.
//   Aero          wing angle needs an adjustable GT wing.
//
// Defaults are the factory (or as-installed) setup and are exactly neutral:
// a car that has never been tuned drives and dynos the same as before.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Boost the turbo / blower makes as installed (psi).
export function baseBoost(model, lv) {
  if (lv.turbo > 0) return model.asp === 'turbo' ? 12 + [0, 3, 6, 10, 15][lv.turbo] : [0, 7, 10, 14, 20][lv.turbo];
  if (lv.supercharger > 0) return model.asp === 'sc' ? 9 + [0, 2, 4, 7, 10][lv.supercharger] : [0, 6, 8, 11, 15][lv.supercharger];
  return model.asp === 'turbo' ? 12 : model.asp === 'sc' ? 9 : 0;
}

const SPRING_DEF = [6, 7, 8, 10, 13];          // kg/mm, front, per suspension stage
const DROP_DEF = [0, 25, 45, 60, 70];          // mm lower than stock, per suspension stage

function aspOf(model, lv) {
  if (model.asp === 'ev') return 'ev';
  if (lv.turbo > 0) return 'turbo';
  if (lv.supercharger > 0) return 'sc';
  return model.asp;
}

// The full list of adjustments for this car, with ranges, defaults and why
// a group is locked. `redline` is the rpm the installed parts allow.
export function tuneSchema(model, lv, visual = {}, redline = model.redline) {
  const asp = aspOf(model, lv);
  const ev = asp === 'ev';
  const boosted = asp === 'turbo' || asp === 'sc';
  const bb = baseBoost(model, lv);
  const s = lv.suspension || 0;
  const sDef = SPRING_DEF[s];
  const groups = [];
  const g = (id, name, lock, note, items) => groups.push({ id, name, lock, note, items: items.filter(Boolean) });
  const f1 = v => v.toFixed(1);

  g('engine', 'Engine map', ev ? 'EVs have no fuel or ignition map. Power is set by the inverter.' : !lv.ecu ? 'Stock ECU is locked. Install a tune (PartsHub → Tune / ECU) to open the maps.' : null,
    'Tuned on the dyno with a wideband. Too much boost or timing, or a lean mixture, and the engine knocks. Knock pulls power and hurts the engine every time you go wide open.', [
      boosted && { k: 'boost', label: asp === 'sc' ? 'Boost (pulley)' : 'Boost target (wastegate)', unit: 'psi', min: Math.max(2, Math.round(bb * 0.5)), max: Math.round(bb * (1.25 + 0.12 * lv.ecu) + 2), step: 0.5, def: bb, fmt: f1 },
      { k: 'timing', label: 'Ignition timing', unit: '° vs base map', min: -6, max: 8, step: 0.5, def: 0, fmt: v => (v > 0 ? '+' : '') + f1(v) },
      { k: 'afr', label: 'Air / fuel ratio at WOT', unit: ':1', min: 10.5, max: 14, step: 0.1, def: boosted ? 11.3 : 12.4, fmt: f1 },
      { k: 'revLimit', label: 'Rev limiter', unit: 'rpm', min: Math.round((redline - 1500) / 100) * 100, max: Math.round((redline + 200 + 250 * (lv.engine || 0)) / 100) * 100, step: 100, def: redline, fmt: v => Math.round(v).toLocaleString() },
    ]);
  g('tc', 'Traction control', !(model.years[1] >= 2005 || lv.ecu >= 2) ? 'This car never had traction control. A Stage 2+ ECU or standalone adds it.' : null,
    'Cuts power when the driven wheels spin. Off for burnouts, drifting and a driver who can feather it.', [
      { k: 'tc', label: 'Traction control', unit: '', min: 0, max: 5, step: 1, def: 0, fmt: v => v ? `Level ${v}` : 'Off' },
    ]);
  const gears = ev ? [] : model.gears.map((r, i) => ({ k: `g${i + 1}`, label: `${i + 1}${['st', 'nd', 'rd'][i] || 'th'} gear`, unit: ':1', min: 0.85, max: 1.15, step: 0.01, def: 1, ratio: r, fmt: v => (r * v).toFixed(2) }));
  g('gearing', 'Gearing', null,
    'Shorter (higher number) = harder pull, lower top speed. Taller = the opposite. A ring & pinion swap changes every gear at once.', [
      { k: 'finalDrive', label: ev ? 'Reduction gear' : 'Final drive (ring & pinion)', unit: ':1', min: 0.85, max: 1.15, step: 0.01, def: 1, ratio: model.fd, fmt: v => (model.fd * v).toFixed(2) },
      ...(lv.transmission >= 2 ? gears : []),
    ]);
  if (!ev && lv.transmission < 2) groups[groups.length - 1].note += ' Individual gear ratios need a built gearbox (Transmission stage 2+).';

  g('susp', 'Suspension', s < 2 ? `${s ? 'Lowering springs aren\'t adjustable.' : 'Factory suspension isn\'t adjustable.'} Coilovers (Suspension stage 2+) open ride height, damping and sway bars.` : null,
    s < 3 ? 'Single-adjustable dampers: bump and rebound move together. Stage 3+ coilovers add spring rates and separate bump/rebound.' : 'Stiffer at one end = less grip at that end. Stiff front = understeer, stiff rear = oversteer.', [
      { k: 'rideF', label: 'Ride height front', unit: 'mm lower', min: 0, max: s >= 3 ? 90 : 70, step: 1, def: DROP_DEF[s], fmt: v => Math.round(v) },
      { k: 'rideR', label: 'Ride height rear', unit: 'mm lower', min: 0, max: s >= 3 ? 90 : 70, step: 1, def: DROP_DEF[s], fmt: v => Math.round(v) },
      s >= 3 && { k: 'springF', label: 'Spring rate front', unit: 'kg/mm', min: 4, max: 24, step: 0.5, def: sDef, fmt: f1 },
      s >= 3 && { k: 'springR', label: 'Spring rate rear', unit: 'kg/mm', min: 4, max: 24, step: 0.5, def: sDef * 0.9, fmt: f1 },
      { k: 'bumpF', label: s >= 3 ? 'Bump front' : 'Damping front', unit: 'clicks', min: 1, max: 20, step: 1, def: 10, fmt: v => Math.round(v) },
      s >= 3 && { k: 'rebF', label: 'Rebound front', unit: 'clicks', min: 1, max: 20, step: 1, def: 10, fmt: v => Math.round(v) },
      { k: 'bumpR', label: s >= 3 ? 'Bump rear' : 'Damping rear', unit: 'clicks', min: 1, max: 20, step: 1, def: 10, fmt: v => Math.round(v) },
      s >= 3 && { k: 'rebR', label: 'Rebound rear', unit: 'clicks', min: 1, max: 20, step: 1, def: 10, fmt: v => Math.round(v) },
      { k: 'arbF', label: 'Sway bar front', unit: '/10', min: 1, max: 10, step: 1, def: 5, fmt: v => Math.round(v) },
      { k: 'arbR', label: 'Sway bar rear', unit: '/10', min: 1, max: 10, step: 1, def: 5, fmt: v => Math.round(v) },
    ]);
  g('align', 'Alignment', null,
    s >= 3 ? 'Camber plates fitted: full camber range. Negative camber = more cornering grip, less straight-line bite.' : 'Factory eccentric bolts limit camber. Coilovers with camber plates (Suspension stage 3+) open the full range.', [
      { k: 'camberF', label: 'Camber front', unit: '°', min: s >= 3 ? -4.5 : -1.8, max: s >= 3 ? 0 : -0.3, step: 0.1, def: -0.8, fmt: f1 },
      { k: 'camberR', label: 'Camber rear', unit: '°', min: s >= 3 ? -3.5 : -2, max: s >= 3 ? 0 : -0.5, step: 0.1, def: -1.2, fmt: f1 },
      { k: 'toeF', label: 'Toe front', unit: 'mm (+ in / − out)', min: -4, max: 4, step: 0.5, def: 0, fmt: v => (v > 0 ? '+' : '') + f1(v) },
      { k: 'toeR', label: 'Toe rear', unit: 'mm (+ in / − out)', min: -4, max: 4, step: 0.5, def: 1, fmt: v => (v > 0 ? '+' : '') + f1(v) },
    ]);
  g('tires', 'Tire pressure', null,
    'About 32–34 psi hot is the sweet spot for cornering. Drag racers drop the drive tires to the high teens for a bigger contact patch.', [
      { k: 'pressF', label: 'Front', unit: 'psi', min: 12, max: 45, step: 0.5, def: 32, fmt: f1 },
      { k: 'pressR', label: 'Rear', unit: 'psi', min: 12, max: 45, step: 0.5, def: 32, fmt: f1 },
    ]);
  g('brakes', 'Brakes', (lv.brakes || 0) < 2 ? 'Factory proportioning valve. A Stage 2+ big brake kit adds an adjustable bias valve.' : null,
    'More rear bias rotates the car on corner entry, too much and the rears lock first and you spin.', [
      { k: 'brakeBias', label: 'Brake bias', unit: '% front', min: 50, max: 80, step: 1, def: 65, fmt: v => Math.round(v) },
    ]);
  g('diff', 'Differential', !lv.diff ? 'Open differential. Install a limited-slip diff to tune lockup.' : null,
    'Accel lock puts power down out of corners (and kicks the tail out on RWD). Decel lock settles the car on lift-off but resists turn-in.', [
      { k: 'diffAccel', label: 'Accel lock', unit: '%', min: 0, max: 100, step: 5, def: 45, fmt: v => Math.round(v) },
      { k: 'diffDecel', label: 'Decel lock', unit: '%', min: 0, max: 100, step: 5, def: 25, fmt: v => Math.round(v) },
    ]);
  g('aero', 'Aero', visual.spoiler !== 'gt' ? 'Needs an adjustable GT wing (PartsHub → Wings & Spoilers).' : null,
    'More angle = more rear downforce at speed, and more drag.', [
      { k: 'wing', label: 'Wing angle', unit: '°', min: 0, max: 14, step: 1, def: 6, fmt: v => Math.round(v) },
    ]);
  return groups;
}

// Value of setting k (falls back to its default).
export function tuneValue(tune, item) {
  const v = tune?.[item.k];
  return typeof v === 'number' && isFinite(v) ? clamp(v, item.min, item.max) : item.def;
}

// What the setup does to the car. Every number is relative to the default
// setup, so an untouched car gets all-neutral values.
export function tuneEffects(model, lv, tune = {}, visual = {}, redline = model.redline) {
  const schema = tuneSchema(model, lv, visual, redline);
  const val = {};
  for (const grp of schema) for (const it of grp.items) val[it.k] = grp.lock ? it.def : tuneValue(tune, it);
  // gearing: final drive always comes from the tune (older saves only have it)
  if (typeof tune.finalDrive === 'number') val.finalDrive = clamp(tune.finalDrive, 0.85, 1.15);
  const def = {};
  for (const grp of schema) for (const it of grp.items) def[it.k] = it.def;

  const asp = aspOf(model, lv);
  const boosted = asp === 'turbo' || asp === 'sc';
  const warn = [];
  const fx = {
    boostMult: 1, mapMult: 1, knock: 0, overRev: 0, redline: null, tc: val.tc || 0,
    fd: val.finalDrive ?? 1, gearMult: model.gears.map((_, i) => val[`g${i + 1}`] ?? 1),
    trac: 1, handling: 1, gripF: 1, gripR: 1, hcg: 0.52, stiff: 1, turnIn: 1,
    brakeShift: 0, brakeG: 1, diffPow: 0, diffLift: 0, downforce: 0, dragArea: 0, crr: 0.013,
    boost: val.boost ?? 0, values: val,
  };
  const rearDriven = model.drive !== 'FWD', frontDriven = model.drive !== 'RWD';

  // ---- engine ----
  if (asp !== 'ev') {
    const bb = baseBoost(model, lv);
    if (boosted) {
      const b = val.boost;
      fx.boostMult = (14.7 + b * 0.8) / (14.7 + bb * 0.8);
      const safe = bb * (1 + 0.06 * (lv.fuel || 0) + 0.05 * (lv.intercooler || 0) + 0.07 * (lv.engine || 0)) + 1;
      if (b > safe) { fx.knock += (b - safe) / Math.max(4, bb * 0.25) * 0.6; warn.push(`Boost is ${(b - safe).toFixed(1)} psi past what the fuel system, intercooler and internals can take.`); }
    }
    const t = val.timing;
    const tg = x => x <= 0 ? 0.013 * x : x <= 3 ? 0.009 * x : 0.027 - 0.004 * (x - 3);
    const kl = 3 + ((lv.fuel || 0) >= 2 ? 2 : (lv.fuel || 0) >= 1 ? 1 : 0) - Math.max(0, (val.boost ?? 0) - bb) * 0.25;
    if (t > kl) { fx.knock += (t - kl) * 0.2; warn.push(`${(t - kl).toFixed(1)}° more timing than this fuel and boost will take.`); }
    const best = boosted ? 11.8 : 12.8, stock = boosted ? 11.3 : 12.4, lean = boosted ? 12.2 : 13.3;
    const af = a => 1 - 0.028 * (a - best) ** 2;
    if (val.afr > lean) { fx.knock += (val.afr - lean) * 0.8; warn.push(`${val.afr.toFixed(1)}:1 is lean at full throttle${boosted ? ' on boost' : ''}. Detonation and melted pistons.`); }
    if (val.afr < 10.8) warn.push('So rich it\'s washing the cylinders and losing power.');
    fx.mapMult = (1 + tg(t)) * af(val.afr) / af(stock);
    // rev limiter
    if (val.revLimit !== redline) fx.redline = val.revLimit;
    const float = redline + 150 + 200 * (lv.engine || 0);
    if (val.revLimit > float) { fx.overRev = (val.revLimit - float) / 500; warn.push(`Valve float past ${Math.round(float).toLocaleString()} rpm. Build the engine (Engine Internals) before spinning it this high.`); }
    fx.knock = clamp(fx.knock, 0, 1);
    fx.mapMult *= 1 - 0.12 * fx.knock;   // the knock sensor pulls timing
  }

  // ---- suspension ----
  const s = lv.suspension || 0;
  const dF = val.rideF, dR = val.rideR, dAvg = (dF + dR) / 2, dDef = def.rideF;
  fx.hcg = 0.52 - (dAvg - dDef) / 1000 * 0.6;
  fx.handling *= 1 + (dAvg - dDef) * 0.0015;
  const springF = val.springF ?? SPRING_DEF[s], springR = val.springR ?? SPRING_DEF[s] * 0.9;
  const sfDef = def.springF ?? SPRING_DEF[s], srDef = def.springR ?? SPRING_DEF[s] * 0.9;
  const bottom = 35 + (springF + springR) / 2 * 3;
  if (dAvg > bottom) { fx.handling *= 1 - (dAvg - bottom) * 0.006; fx.trac *= 1 - (dAvg - bottom) * 0.004; warn.push(`Bottoming out: ${Math.round(dAvg)} mm low on ${((springF + springR) / 2).toFixed(1)} kg/mm springs. Go stiffer or raise it.`); }
  const rake = (dF - dR) - (def.rideF - def.rideR);         // + = nose lower than the tail
  fx.gripF *= 1 + rake * 0.002; fx.gripR *= 1 - rake * 0.002;
  if (rearDriven && rake < 0) fx.trac *= 1 + (-rake) * 0.0012;
  const dSpring = springF / sfDef - springR / srDef;
  fx.gripF *= 1 - 0.08 * dSpring; fx.gripR *= 1 + 0.08 * dSpring;
  const k = (springF / sfDef + springR / srDef) / 2;
  fx.stiff *= 1 + 0.25 * (k - 1);
  if (k > 1.5) fx.handling *= 1 - 0.1 * (k - 1.5);
  const bumpF = val.bumpF, bumpR = val.bumpR, rebF = val.rebF ?? bumpF, rebR = val.rebR ?? bumpR;
  const dDamp = ((bumpF + rebF) - (bumpR + rebR)) / 20;
  fx.gripF *= 1 - 0.04 * dDamp; fx.gripR *= 1 + 0.04 * dDamp;
  const dAvgClick = (bumpF + rebF + bumpR + rebR) / 4;
  fx.stiff *= 1 + 0.012 * (dAvgClick - 10);
  if (dAvgClick < 5) fx.handling *= 1 - (5 - dAvgClick) * 0.012;
  if (dAvgClick > 16) fx.handling *= 1 - (dAvgClick - 16) * 0.01;
  // launch: loose front extension and soft rear compression let the weight
  // come back onto the rear tires; FWD wants the nose held down instead
  const launchDamp = ((10 - rebF) + (10 - bumpR)) * 0.004;
  if (model.drive === 'RWD') fx.trac *= 1 + launchDamp;
  else if (model.drive === 'FWD') fx.trac *= 1 - launchDamp;
  else fx.trac *= 1 + launchDamp * 0.4;
  fx.gripF *= 1 - 0.025 * (val.arbF - 5); fx.gripR *= 1 - 0.025 * (val.arbR - 5);
  fx.stiff *= 1 + 0.01 * (val.arbF + val.arbR - 10);
  if (fx.stiff !== 1) fx.stiff = clamp(fx.stiff, 0.7, 1.5);

  // ---- alignment ----
  const camLat = (c, opt) => 1 - 0.012 * (Math.abs(c) - opt) ** 2;
  fx.gripF *= camLat(val.camberF, 3.0) / camLat(def.camberF, 3.0);
  fx.gripR *= camLat(val.camberR, 2.2) / camLat(def.camberR, 2.2);
  const camLon = c => 1 - 0.025 * Math.max(0, Math.abs(c) - 1);
  if (rearDriven) fx.trac *= camLon(val.camberR) / camLon(def.camberR) * (frontDriven ? 0.5 : 1) + (frontDriven ? 0.5 : 0);
  if (frontDriven) fx.trac *= camLon(val.camberF) / camLon(def.camberF) * (rearDriven ? 0.5 : 1) + (rearDriven ? 0.5 : 0);
  fx.turnIn *= 1 - 0.03 * (val.toeF - def.toeF);
  fx.gripR *= 1 + 0.015 * (val.toeR - def.toeR);
  fx.crr += 0.0006 * ((Math.abs(val.toeF) - Math.abs(def.toeF)) + (Math.abs(val.toeR) - Math.abs(def.toeR)));
  if (Math.abs(val.toeF) + Math.abs(val.toeR) > 5) warn.push('That much toe scrubs speed and chews through tires.');

  // ---- tires ----
  const pLat = p => 1 - 0.0006 * (p - 33) ** 2;
  const pLon = p => 1 + 0.006 * (32 - clamp(p, 14, 40)) - (p > 38 ? 0.01 * (p - 38) : 0);
  fx.gripF *= pLat(val.pressF) / pLat(def.pressF);
  fx.gripR *= pLat(val.pressR) / pLat(def.pressR);
  const dp = rearDriven && frontDriven ? (pLon(val.pressF) + pLon(val.pressR)) / 2 : rearDriven ? pLon(val.pressR) : pLon(val.pressF);
  fx.trac *= dp;
  fx.crr += 0.0003 * (64 - val.pressF - val.pressR) / 2;
  fx.crr = Math.max(0.010, fx.crr);
  if (Math.min(val.pressF, val.pressR) < 20) warn.push('Under 20 psi the sidewalls roll over in corners. Fine for the strip, sketchy on the street.');

  // ---- brakes ----
  fx.brakeShift = (def.brakeBias - val.brakeBias) / 100;     // + = more rear
  fx.brakeG *= 1 - 0.004 * Math.max(0, Math.abs(val.brakeBias - 65) - 3);
  if (val.brakeBias < 57) warn.push('Rear-heavy brake bias: the rears will lock first under hard braking.');

  // ---- diff ----
  fx.trac *= 1 + 0.0012 * (val.diffAccel - def.diffAccel);
  fx.diffPow = 0.002 * (val.diffAccel - def.diffAccel);
  fx.diffLift = 0.002 * (val.diffDecel - def.diffDecel);

  // ---- aero (a GT wing is downforce whether or not you touch it) ----
  if (visual.spoiler === 'gt') {
    fx.downforce = 0.03 * val.wing;                       // N per (m/s)^2
    fx.dragArea = fx.downforce / 3 / (0.5 * 1.225);       // L/D about 3
  }

  // overall cornering grip from the axle balance, and a balance figure (+ = oversteer)
  fx.handling *= (fx.gripF + fx.gripR) / 2;
  const mean = (fx.gripF + fx.gripR) / 2;
  fx.gripF /= mean; fx.gripR /= mean;
  fx.balance = fx.gripF - fx.gripR;
  fx.warnings = warn;
  return fx;
}

// Engine wear from knock / over-revving while you're on it. Returns true the
// moment the engine starts knocking (for a warning).
const knockT = new WeakMap();   // seconds since the last knock, per car (kept out of the save)
export function engineStress(car, spec, throttle, rpm, dt) {
  if (!car?.cond || !spec) return false;
  let hurt = 0;
  if (spec.knock > 0 && throttle > 0.7 && rpm > spec.redline * 0.55) hurt += spec.knock * 2.2;
  if (spec.overRev > 0 && rpm > spec.redline - 300) hurt += spec.overRev * 3;
  if (!hurt) { knockT.set(car, Math.max(0, (knockT.get(car) || 0) - dt)); return false; }
  car.cond.engine = Math.max(5, car.cond.engine - hurt * dt);
  const first = !(knockT.get(car) > 0);
  knockT.set(car, 4);
  return first;
}

// One-tap starting points. Only touches what this car can adjust.
export const PRESETS = {
  street: { label: 'Street', vals: {} },
  drag: { label: 'Drag', vals: { finalDrive: 1.08, pressF: 36, pressR: 18, rideF: 20, rideR: 40, rebF: 3, bumpF: 6, bumpR: 3, rebR: 14, arbF: 3, arbR: 3, camberF: -0.3, camberR: -0.5, toeF: 0, toeR: 0.5, diffAccel: 90, diffDecel: 10, tc: 0, brakeBias: 70, wing: 3 } },
  grip: { label: 'Track', vals: { finalDrive: 1.03, pressF: 33, pressR: 33, rideF: 65, rideR: 60, arbF: 6, arbR: 6, camberF: -2.8, camberR: -2.0, toeF: -0.5, toeR: 1.5, bumpF: 13, rebF: 13, bumpR: 12, rebR: 12, diffAccel: 55, diffDecel: 35, tc: 2, brakeBias: 63, wing: 10 } },
  drift: { label: 'Drift', vals: { finalDrive: 1.06, pressF: 30, pressR: 42, rideF: 60, rideR: 50, arbF: 5, arbR: 8, camberF: -4.0, camberR: -0.5, toeF: -2, toeR: -0.5, bumpF: 12, rebF: 12, bumpR: 13, rebR: 13, diffAccel: 100, diffDecel: 80, tc: 0, brakeBias: 58, wing: 2 } },
};
