// Engine reliability. Like a real build: bolt on a turbo, a blower or a big
// nitrous shot without the parts that support it and the motor lets go.
//
//   Internals   cast factory pistons and rods only take so much over stock
//               power. Forged internals (Engine Internals stage 2+) take a
//               lot more.
//   Tune        aftermarket boost on a stock ECU can't be fuelled or timed.
//   Fuel        injectors / pump that can't keep up run it lean.
//   Intercooler hot charge air on an add-on turbo or blower detonates.
//   Tune maps   too much boost or timing, or a lean AFR (Garage → Tune).
//
// Every second at wide-open throttle the stress wears the engine down. Push
// it far enough and it blows: no power until it's rebuilt at Second Chance
// Collision.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// How far over factory power each level of internals is good for.
const STRENGTH = [1, 1.12, 1.45, 1.9, 2.6];
const INTERNALS = ['factory cast internals', 'Stage 1 internals', 'forged Stage 2 internals', 'forged Stage 3 internals', 'Stage 4 billet internals'];

export function internalsLimit(model, engineStage = 0) {
  const base = model.asp === 'turbo' || model.asp === 'sc' ? 1.5 : 1.4;   // factory boosted motors are built stronger
  return base * STRENGTH[engineStage || 0];
}

// Stress at full throttle (0 = safe forever, ~1 = a few hard pulls from
// trouble, 2+ = it won't last) plus the reasons, each with its fix.
// ctx: { model, lv, ratio (power vs stock, before wear), rawMult, fuelCap,
//        fuelLimited, asp, knock, overRev, nosHp }
export function engineLoad({ model, lv, ratio, rawMult, fuelCap, fuelLimited, knock = 0, overRev = 0, nosHp = 0 }) {
  const out = { risk: 0, nosRisk: 0, reasons: [], ratio, limit: 0 };
  if (model.asp === 'ev') return out;
  const limit = internalsLimit(model, lv.engine);
  out.limit = limit;
  const pct = r => `${Math.round((r - 1) * 100)}%`;
  const needStage = r => { for (let i = (lv.engine || 0) + 1; i <= 4; i++) if (r <= internalsLimit(model, i)) return i; return 4; };
  const add = (risk, text, fix, nos = false) => { if (nos) out.nosRisk += risk; else out.risk += risk; out.reasons.push({ text, fix, nos, risk }); };

  if (ratio > limit) add((ratio / limit - 1) * 2.5,
    `Making ${pct(ratio)} more power than stock. The ${INTERNALS[lv.engine || 0]} are only good for about ${pct(limit)}.`,
    `Engine Internals stage ${needStage(ratio)} (forged pistons & rods)`);
  const addedBoost = (lv.turbo || 0) > 0 || (lv.supercharger || 0) > 0;
  if (addedBoost && !lv.ecu) add(0.5,
    'Extra boost on the stock ECU. It can\'t add the fuel or pull the timing the boost needs, so it runs lean and knocks.',
    'Tune / ECU (any stage)');
  if (fuelLimited && rawMult / fuelCap > 1.03) add((rawMult / fuelCap - 1.03) * 2.5 + 0.15,   // a few % over the injectors is still in the safe margin
    'The injectors and pump are maxed out. Past that it runs lean at full throttle.',
    `Fuel System stage ${Math.min(4, (lv.fuel || 0) + 1)}`);
  if (addedBoost && !lv.intercooler && model.asp === 'na') add(0.06 * ((lv.turbo || lv.supercharger) + 1),
    'No intercooler on an add-on turbo or blower. Hot charge air makes it detonate.',
    'Intercooler');
  if (knock > 0) add(knock * 1.2, 'Your engine map knocks (boost, timing or AFR in Garage → Tune).', 'Back off boost / timing, richen the AFR');
  if (overRev > 0) add(overRev * 1.5, 'Rev limiter set past where the valves float.', 'Lower the rev limiter or build the engine');

  if (nosHp > 0) {
    const nRatio = ratio + nosHp / model.hp;
    if (nRatio > limit) add((nRatio / limit - 1) * 2.5,
      `Spraying the ${nosHp} shot puts you ${pct(nRatio)} over stock, past what the ${INTERNALS[lv.engine || 0]} take.`,
      `Engine Internals stage ${needStage(nRatio)}, or a smaller shot`, true);
    if (nosHp >= 100 && !lv.fuel) add(0.35, `A ${nosHp} shot on the stock fuel pump goes lean the moment you hit the button.`, 'Fuel System stage 1+', true);
  }
  out.risk = clamp(out.risk, 0, 5);
  out.level = levelOf(out.risk + out.nosRisk * 0.5);
  return out;
}

export function levelOf(r) {
  return r <= 0.001 ? { id: 'safe', label: 'Safe', color: 'var(--green)' }
    : r < 0.35 ? { id: 'low', label: 'Some wear', color: 'var(--yellow)' }
    : r < 1 ? { id: 'high', label: 'High: it will wear out', color: '#ff8a1a' }
    : { id: 'danger', label: 'Grenade: it will blow', color: 'var(--red2)' };
}

// Rebuild cost at the repair shop.
export function rebuildCost(model) { return Math.round((3200 + model.msrp * 0.06) / 50) * 50; }

// Called every frame while you drive. Wears the engine at wide-open throttle
// and returns an event for the HUD: 'stress' (first time it's hurting),
// 'warn' (getting bad), 'critical' (about to go) or 'blown'.
const seen = new WeakMap();   // per car, kept out of the save
export function engineStress(car, spec, throttle, rpm, dt, nosOn = false) {
  if (!car?.cond || !spec || car.engineBlown) return null;
  const wot = throttle > 0.7 && rpm > spec.redline * 0.55;
  const risk = (spec.engineRisk || 0) + (nosOn ? spec.engineNosRisk || 0 : 0);
  if (!wot || risk <= 0) return null;
  const st = seen.get(car) || {};
  seen.set(car, st);
  car.cond.engine = Math.max(0, car.cond.engine - risk * 2.2 * dt);
  // a badly overloaded motor can let go all at once
  // (only once it's already knocking, so there's always a warning first)
  const snap = risk > 1.2 && car.cond.engine < 50 && Math.random() < (risk - 1.2) * 0.06 * dt;
  if (car.cond.engine <= 6 || snap) {
    car.engineBlown = true;
    car.cond.engine = 0;
    return 'blown';
  }
  if (car.cond.engine < 25 && !st.critical) { st.critical = true; return 'critical'; }
  if (car.cond.engine < 50 && !st.warn) { st.warn = true; return 'warn'; }
  if (!st.stress) { st.stress = true; return 'stress'; }
  return null;
}
// After a rebuild the warnings start over.
export function resetEngineWarnings(car) { seen.delete(car); }

export function engineMessage(ev, spec) {
  const why = (spec.engineReasons || [])[0];
  return ev === 'stress' ? `⚠ Engine under stress${why ? `: ${why.text.split('.')[0]}.` : '.'} Fix: ${why?.fix || 'supporting mods'}.`
    : ev === 'warn' ? '⚠ Engine is knocking. Rod bearings are going. Stay off it or fix the build.'
    : ev === 'critical' ? '🔥 Engine is about to let go! Back off now.'
    : ev === 'blown' ? '💥 You blew the motor. Call a tow (Bank → Roadside) to Second Chance Collision for a rebuild.'
    : '';
}
