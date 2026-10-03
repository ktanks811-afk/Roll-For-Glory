// Data sanity checks: every car simulates sensibly, every catalog item is
// well-formed, NPC builds reference real cars, the market generates
// affordable first cars. Run with: npm run check:data
import { CARS, CAR_BY_ID } from '../js/data/cars.js';
import { CATALOG, ITEM_BY_ID, fits } from '../js/data/catalog.js';
import { RACERS } from '../js/data/npcs.js';
import { LOCATIONS } from '../js/data/world.js';
import { generateListings } from '../js/data/market.js';
import { buildSpec, metrics } from '../js/sim/powertrain.js';
import { partLevels } from '../js/data/parts.js';
import { RevLimiter } from '../js/sim/twostep.js';
import { createState, newCar, game } from '../js/core/state.js';
import * as H from '../js/core/hustle.js';
import { SERVERS, SERVER_CAP } from '../js/net/online.js';
import { Vehicle } from '../js/world2d/vehicle.js';
import { GLOCKS, ARPS, WEAPONS, WEAPON_BY_ID, CAL, buyWeapon, buyAmmo, ensureArms, giveWeapon, minAge, canFrt, toggleFrt } from '../js/data/weapons.js';
import { spend } from '../js/core/state.js';
import { buildMap, collideCircle } from '../js/world2d/map.js';
import { PROPERTIES } from '../js/data/world.js';
import { shapeOf, hasShape, dimsOf } from '../js/data/carShapes.js';
import { sideGeo } from '../js/gfx2d/sideCar.js';
import { soundProfile, harmonics, firingHz, noiseDb, liveNoiseDb, hearingRange, exhaustDb, LEGAL_DB } from '../js/sim/sound.js';

let fails = 0;
const bad = (msg) => { fails++; console.error('FAIL', msg); };

const ids = new Set();
for (const c of CARS) {
  if (ids.has(c.id)) bad(`duplicate car id ${c.id}`);
  ids.add(c.id);
  const m = metrics(buildSpec(c, {}, {}));
  if (!m.quarter || m.quarter < 8 || m.quarter > 19) bad(`${c.id} quarter ${m.quarter}`);
  if (!m.zero60 || m.zero60 < 1.8 || m.zero60 > 12) bad(`${c.id} 0-60 ${m.zero60}`);
  if (Math.abs(buildSpec(c, {}, {}).hp - c.hp) / c.hp > 0.03) bad(`${c.id} hp drifts from spec`);
}
for (const p of CATALOG) {
  if (!p.brand || !p.name || !(p.price >= 0)) bad(`bad product ${p.id}`);
  if (!p.visual && !(p.stage >= 1 && p.stage <= 4)) bad(`bad stage ${p.id}`);
}
for (const r of RACERS) {
  const m = CAR_BY_ID[r.car.model];
  if (!m) { bad(`racer ${r.id} car ${r.car.model} missing`); continue; }
  metrics(buildSpec(m, partLevels(r.car.parts), {}));
}
for (const l of LOCATIONS) if (!isFinite(l.x) || !isFinite(l.z)) bad(`location ${l.id} has no position`);
let worst = Infinity;
for (let i = 0; i < 200; i++) worst = Math.min(worst, generateListings(30).filter(l => l.price <= 4500).length);
if (worst < 4) bad(`a new game can start with only ${worst} cars under $4,500`);
const listings = generateListings(40);
if (listings.filter(l => l.price <= 4500).length < 4) bad('not enough affordable first cars on Marketplace');
// fitment spot checks
const civic = CAR_BY_ID.honda_civic_ex_1996, tesla = CAR_BY_ID.tesla_model_3_performance_2024;
if (!CATALOG.some(p => p.cat === 'turbo' && fits(p, civic))) bad('no turbo fits a Civic');
if (CATALOG.some(p => p.cat === 'turbo' && fits(p, tesla))) bad('a turbo fits a Tesla');
// 2-step: part exists, fits ICE cars, never EVs, and flames only come with it
if (CATALOG.filter(p => p.cat === 'twostep').length < 15) bad('too few 2-step products');
if (CATALOG.some(p => p.cat === 'twostep' && fits(p, tesla))) bad('a 2-step fits a Tesla');
if (!CATALOG.some(p => p.cat === 'twostep' && fits(p, civic))) bad('no 2-step fits a Civic');
const mustang = CAR_BY_ID.ford_mustang_gt_2015 || CARS.find(c => c.asp !== 'ev' && c.years[1] >= 2020);
if (!CATALOG.some(p => p.cat === 'twostep' && fits(p, mustang))) bad('no 2-step fits a modern car');
{
  const stock = buildSpec(mustang, {}, {});
  if (stock.twoStep || stock.launchControl) bad('stock car has a 2-step');
  const ts = buildSpec(mustang, partLevels({ twostep: CATALOG.find(p => p.cat === 'twostep' && fits(p, mustang)).id }), {});
  if (!ts.twoStep || !ts.launchControl) bad('installed 2-step not in spec');
  for (const lvl of [0, 1, 2, 3, 4]) {
    const rl = new RevLimiter({ ...stock, twoStep: lvl }, 5000);
    for (let i = 0; i < 600; i++) rl.update(1 / 60, true);
    if ((lvl === 0) !== (rl.flames === 0)) bad(`2-step stage ${lvl} flame count ${rl.flames}`);
    if (lvl > 0 && rl.flames < 2) bad(`2-step stage ${lvl} produced almost no flames over 10s`);
  }
}
// engine sound: every car maps to the right firing pattern
{
  const want = (make, model, kind, extra) => {
    const c = CARS.find(x => x.make === make && x.model.includes(model) && (!extra || (x.trim + ' ' + x.engine).includes(extra)));
    if (!c) return bad(`sound check: no ${make} ${model} ${extra || ''}`);
    const p = soundProfile(c, {});
    if (p.kind !== kind) bad(`${make} ${model} ${extra || ''} should sound like ${kind}, got ${p.kind}`);
  };
  want('mazda', 'RX-7', 'rotary'); want('mazda', 'RX-8', 'rotary');
  want('ford', 'Mustang', 'v8x', 'Coyote'); want('dodge', 'Challenger', 'v8x', 'R/T');
  want('chevrolet', 'Corvette', 'v8f', 'LT6'); want('chevrolet', 'Corvette', 'v8x', 'LS1');
  want('ferrari', '458', 'v8f'); want('ferrari', 'F8', 'v8f'); want('mclaren', '720S', 'v8f'); want('mercedes', 'E63', 'v8x');
  want('porsche', '911', 'flat6', 'GT3'); want('subaru', 'Impreza', 'flat4', 'EJ257'); want('subaru', 'WRX', 'flat4eq', 'FA24');
  want('toyota', 'Supra', 'i6', '2JZ'); want('bmw', 'M3', 'i6', 'S54'); want('toyota', 'GR Corolla', 'i3');
  want('audi', 'TT RS', 'i5'); want('lamborghini', 'Huracán', 'v10'); want('lamborghini', 'Aventador', 'v12');
  want('bugatti', 'Veyron', 'w16'); want('bentley', 'Continental', 'w12'); want('nissan', 'GT-R', 'v6', 'VR38'); want('nissan', 'GT-R', 'i6', 'RB26');
  want('tesla', 'Model 3', 'ev'); want('buick', 'Grand National', 'v6odd'); want('honda', 'Civic', 'i4', 'B16A2');
  for (const c of CARS) {
    const p = soundProfile(c, {});
    if (p.kind === 'ev') continue;
    const h = harmonics(p);
    const top = h.indexOf(Math.max(...h));
    if (top !== p.n) bad(`${c.id}: strongest harmonic is ${top}, expected the firing order ${p.n}`);
    if (![...h].every(Number.isFinite)) bad(`${c.id}: bad harmonics`);
    // firing frequency at 3000 rpm must match n/2 pulses per crank turn
    if (Math.abs(firingHz(p, 3000) - p.n * 25) > 1e-9) bad(`${c.id}: firing frequency`);
  }
  const hc = CARS.find(c => c.model === 'Challenger' && /Hellcat/.test(c.trim));
  if (soundProfile(hc, {}).blowerKind !== 'screw') bad('Hellcat should have a twin-screw whine');
  const gt = CARS.find(c => c.model === 'Mustang' && /GT500/.test(c.trim));
  if (soundProfile(gt, {}).blowerKind !== 'roots') bad('GT500 should have a roots whine');
  // exhaust parts make it louder, brighter and burblier
  const m0 = soundProfile(CAR_BY_ID.ford_mustang_gt_s650_2024, {}), m4 = soundProfile(CAR_BY_ID.ford_mustang_gt_s650_2024, { exhaust: 4 });
  if (!(m4.loud > m0.loud && m4.cut > m0.cut && m4.burble > m0.burble && m4.grit > m0.grit)) bad('exhaust stage does not change the sound');
  if (soundProfile(CAR_BY_ID.tesla_model_3_performance_2024, { exhaust: 4 }).kind !== 'ev') bad('EV sound changed with exhaust');
}
// exhaust loudness: long tubes + straight pipes are way louder than a cat-back, and illegal
{
  const ex = CATALOG.filter(p => p.cat === 'exhaust');
  for (const p of ex) if (typeof p.db !== 'number') bad(`exhaust ${p.id} has no dB rating`);
  const named = n => ex.find(p => p.name.includes(n));
  const catback = named('Street Series Cat-Back'), longTube = named('Long Tube Headers + X-Pipe'), offroad = named('Off-Road Long Tubes + Straight Pipes');
  if (!(catback.db < longTube.db && longTube.db < offroad.db)) bad('cat-back < long tubes < long tubes + straight pipes');
  if (offroad.db < 20) bad('long tubes + straight pipes should add 20+ dB');
  const mus = CAR_BY_ID.ford_mustang_gt_s650_2024;
  const stockDb = noiseDb(mus, {}), cbDb = noiseDb(mus, { exhaust: catback.id }), wildDb = noiseDb(mus, { exhaust: offroad.id });
  if (!(stockDb < LEGAL_DB && cbDb < LEGAL_DB)) bad(`a stock/cat-back Mustang should be street legal (${stockDb}, ${cbDb})`);
  if (!(wildDb > LEGAL_DB)) bad(`long tubes + straight pipes should be over the limit (${wildDb})`);
  const civic = CAR_BY_ID.honda_civic_ex_1996;
  if (noiseDb(civic, { exhaust: catback.id }) > LEGAL_DB) bad('a Civic with a cat-back should be legal');
  if (noiseDb(tesla, {}) > 70) bad('EVs are quiet');
  const loud0 = soundProfile(mus, {}, {}).loud, loud1 = soundProfile(mus, { exhaust: 3 }, { exhaust: offroad.id }).loud;
  if (!(loud1 > loud0 * 1.9)) bad(`straight pipes should be wayyy louder in the mix (${loud0} → ${loud1})`);
  if (!(liveNoiseDb(wildDb, 1, 0.8) > liveNoiseDb(wildDb, 0, 0.3))) bad('flooring it should be louder than cruising');
  if (!(hearingRange(110) > hearingRange(90) * 2)) bad('louder cars are heard from farther away');
  if (exhaustDb({ exhaust: 3 }) !== 15) bad('NPC stage-based exhaust dB');
}
// servers instead of codes
{
  if (SERVERS.length < 6) bad('need a real list of servers');
  if (new Set(SERVERS.map(sv => sv.id)).size !== SERVERS.length) bad('duplicate server ids');
  if (!(SERVER_CAP >= 8 && SERVER_CAP <= 32)) bad('server cap');
}
// side hustles: passive income balance + rules
{
  for (const b of H.BIZ) {
    const payback = b.price / b.daily;
    if (payback < 20 || payback > 45) bad(`${b.id}: pays back in ${payback.toFixed(0)} days`);
  }
  for (let i = 1; i < H.BIZ.length; i++) if (H.BIZ[i].price < H.BIZ[i - 1].price) bad('businesses should get pricier');
  for (const j of H.JOBS) if (!(j.pay >= 60 && j.pay <= 800)) bad(`${j.id} pay`);
  const s = createState({ name: 'T', age: 25, look: {}, story: false });
  game.s = s;
  s.cars.push(newCar('ford_mustang_gt_s650_2024'), newCar('honda_civic_ex_1996')); s.activeCar = s.cars[0].uid;
  if (!H.hire(s, 'pizza').ok) bad('a nobody can take the pizza job');
  if (H.hire(s, 'ryde').ok) bad('tier-1 should only hold one job');
  if (H.hire(s, 'crew').ok) bad('tier-1 can\'t be pit crew chief');
  const bank0 = s.bank;
  const day = H.runDay(s, () => 0.5);
  if (day.net !== Math.round(90 * 0.88) || s.bank - bank0 !== day.net) bad(`one day of the pizza job paid ${day.net}`);
  if (H.buyBiz(s, 'taco').ok) bad('could buy a $9k business with $4.5k');
  s.cash = 50000; s.rep = 1600;
  if (!H.buyBiz(s, 'taco').ok) bad('buy the taco truck');
  if (H.buyBiz(s, 'detail').ok) bad('tier-3 business at tier 2');
  const inc1 = H.bizIncome(s); H.upgradeBiz(s, 'taco'); const inc2 = H.bizIncome(s);
  if (!(inc2 > inc1 * 1.4)) bad('upgrades should raise income');
  if (H.toggleRental(s, s.activeCar).ok) bad('cannot rent out the car you drive');
  if (!H.toggleRental(s, s.cars[1].uid).ok || H.rentalIncome(s) <= 0) bad('rental fleet');
  const total = H.dailyIncome(s);
  // away: 8h cap, quarter rate, nothing for a short break
  const t0 = Date.now(); s.hustle.lastReal = t0 - 3600 * 1000 * 30;
  const away = H.settleAway(s, t0);
  const expect = Math.round(total * (8 * 3600 / 1440) * 0.25);
  if (!away || Math.abs(away.net - expect) > 2) bad(`away income ${away?.net} vs ${expect}`);
  if (H.settleAway(s, t0 + 60 * 1000)) bad('a minute away should pay nothing');
  const sold = H.sellBiz(s, 'taco'); if (!sold.ok || s.hustle.biz.taco) bad('sell business');
}

// ---- driving physics: stable, grippy, and each drivetrain behaves like itself ----
{
  const DT = 1 / 60;
  const mk = (model, parts = {}, tires = 100) => { const spec = buildSpec(model, parts, { tires }); return new Vehicle({ nos: 0, cond: { tires }, parts }, model, spec, 0, 0, 0); };
  const run = (v, secs, f, env = { grip: 1, drag: 0 }) => {
    const log = [];
    for (let t = 0; t < secs; t += DT) { v.update(DT, { throttle: 0, brake: 0, steer: 0, handbrake: false, nitrous: false, auto: true, ...f(t, v) }, env); log.push({ sp: v.speed, yaw: v.yawRate, lat: v.latG, beta: v.slipAngle, h: v.h, skid: v.skid, x: v.x, z: v.z }); }
    return log;
  };
  const cruise = (v, target) => ({ throttle: Math.max(0, Math.min(1, (target - v.speed) * 0.5)), brake: v.speed > target + 2 ? 0.3 : 0 });
  const byDrive = d => CARS.find(c => c.drive === d && ['coupe', 'sedan', 'hatch', 'muscle'].includes(c.body) && c.hp < 330);
  const radiusAfterFloorIt = {}, wornBeta = {};
  for (const d of ['FWD', 'RWD', 'AWD']) {
    const m = byDrive(d);
    // 1. brake from 27 m/s: 0.6-1.3 g
    const v = mk(m); run(v, 30, (t, vv) => cruise(vv, 27)); const s0 = v.speed;
    const bl = run(v, 8, () => ({ brake: 1 })); const stop = bl.findIndex(e => e.sp < 0.3) * DT;
    const g = s0 / stop / 9.81;
    if (!(g > 0.6 && g < 1.3)) bad(`${m.id} braking ${g.toFixed(2)} g`);
    // 2. full lock at 15 m/s: grip-limited, around 0.5-1.1 g, never a spin
    const v2 = mk(m); run(v2, 30, (t, vv) => cruise(vv, 15));
    const l2 = run(v2, 3, (t, vv) => ({ ...cruise(vv, 15), steer: 1 }));
    const gmax = Math.max(...l2.map(e => Math.abs(e.lat)));
    if (!(gmax > 0.5 && gmax < 1.2)) bad(`${m.id} cornering ${gmax.toFixed(2)} g`);
    if (Math.max(...l2.map(e => Math.abs(e.beta))) > 0.5) bad(`${m.id} spins out on full lock at 15 m/s`);
    // 3. power on mid-corner. Good tires stay planted for every drivetrain; tires at 5% push (FWD) or snap (RWD)
    const floorIt = tires => {
      const v3 = mk(m, {}, tires); run(v3, 30, (t, vv) => cruise(vv, 20)); run(v3, 1.5, (t, vv) => ({ ...cruise(vv, 20), steer: 0.4 }));
      const r0 = v3.speed / Math.abs(v3.yawRate);
      const lw = run(v3, 1.2, () => ({ throttle: 1, steer: 0.4 }));
      return { ratio: v3.speed / Math.abs(v3.yawRate) / r0, beta: Math.max(...lw.map(e => Math.abs(e.beta))) };
    };
    const good = floorIt(100), worn = floorIt(5);
    if (good.beta > 0.2) bad(`${m.id} (${d}) fishtails on good tires: slip angle ${good.beta.toFixed(2)} rad`);
    if (!(good.ratio > 0.8 && good.ratio < 2.2)) bad(`${m.id} (${d}) good tires: radius ratio ${good.ratio.toFixed(2)}`);
    radiusAfterFloorIt[d] = worn.ratio; wornBeta[d] = worn.beta;
    // 4. handbrake at speed swings the tail out
    const v4 = mk(m); run(v4, 30, (t, vv) => cruise(vv, 20));
    const hb = run(v4, 1.2, () => ({ steer: 0.8, handbrake: true }));
    if (!(Math.max(...hb.map(e => Math.abs(e.beta))) > 0.5)) bad(`${m.id} handbrake does not slide the rear`);
    // 5. burnout: gas + brake pins the car and lights up the driven tires
    const v5 = mk(m); const bo = run(v5, 2.5, () => ({ throttle: 1, brake: 1, burnout: true }));
    if (!v5.burning || v5.sim.slip < 0.5 || v5.skid < 0.5 || v5.speed > 3) bad(`${m.id} burnout: burning ${v5.burning} slip ${v5.sim.slip} speed ${v5.speed}`);
  }
  if (process.env.DBG) console.error("radius ratios", radiusAfterFloorIt);
  if (!(radiusAfterFloorIt.FWD > 1.25)) bad(`FWD on worn tires should understeer when you floor it mid-corner (${radiusAfterFloorIt.FWD?.toFixed(2)}x radius)`);
  if (!(radiusAfterFloorIt.RWD < 0.85)) bad(`RWD on worn tires should tighten its line when you floor it mid-corner (${radiusAfterFloorIt.RWD?.toFixed(2)}x radius)`);
  // burnout needs gas AND brake, and a 2-step turns it into launch hold instead
  { const m = byDrive('RWD'); const v = mk(m); run(v, 1, () => ({ throttle: 1, burnout: true })); if (v.burning) bad('gas alone is not a burnout');
    const v2 = mk(m); run(v2, 0.5, () => ({ brake: 1, burnout: true })); if (v2.burning) bad('brake alone is not a burnout');
    const v3 = mk(m, { twostep: 1 }); if (!(v3.spec.twoStep >= 1)) bad('2-step part sets spec.twoStep'); }
  // donuts: RWD burnout with the wheel turned goes round
  { const m = byDrive('RWD'); const v = mk(m); const l = run(v, 4, () => ({ throttle: 1, brake: 1, burnout: true, steer: 1 })); if (!(Math.abs(v.h) > 3)) bad(`RWD donut only turned ${v.h.toFixed(1)} rad`); if (Math.hypot(v.x, v.z) > 12) bad('donut drifts away'); }
  // nothing explodes: every car, random inputs, 25 s
  for (const c of CARS) {
    const v = mk(c); let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let st = 0, sb = 0, ss = 0, sh = false;
    for (let t = 0; t < 25; t += DT) {
      if (Math.floor(t * 2) !== Math.floor((t - DT) * 2)) { st = rnd() < 0.7 ? 1 : 0; sb = rnd() < 0.2 ? 1 : 0; ss = [-1, 0, 1][Math.floor(rnd() * 3)]; sh = rnd() < 0.15; }
      v.update(DT, { throttle: st, brake: sb, steer: ss, handbrake: sh, auto: true, burnout: true }, { grip: 1, drag: 0 });
      if (!Number.isFinite(v.x + v.z + v.h) || v.speed > 150 || Math.abs(v.yawRate) > 9) { bad(`${c.id} physics blew up at ${t.toFixed(1)}s (speed ${v.speed}, yaw ${v.yawRate})`); break; }
    }
  }
}

// ---- buildings you pull up to, and drive-in garages ----
{
  const map = buildMap();
  const gar = map.garages;
  for (const id of Object.keys(PROPERTIES)) if (!gar.find(g => g.id === id)) bad(`no garage building for ${id}`);
  for (const g of gar) {
    const P = PROPERTIES[g.id];
    if (g.bays.length < P.slots - 1) bad(`${g.id} has ${g.bays.length} bays for ${P.slots} slots`);
    if (!g.roof || g.roof.kind !== 'roof' || g.roof.a !== 1) bad(`${g.id} roof`);
    // the door is solid until you own the place, and open after
    g.panel.off = false;
    const car = r => collideCircle(map, r.x, r.z, 1.1);
    const dir = g.inDir;
    const walk = (from, to, steps = 60) => { for (let i = 0; i <= steps; i++) { const t = i / steps; if (car({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t })) return false; } return true; };
    if (walk(g.park, g.center)) bad(`${g.id}: closed garage door should block the way in`);
    g.panel.off = true;
    if (!walk(g.park, g.center)) bad(`${g.id}: can't drive from the driveway to the middle of the garage`);
    for (const b of g.bays) if (collideCircle(map, b.x, b.z, 0.9)) bad(`${g.id}: a bay is inside a wall`);
    if (collideCircle(map, g.park.x, g.park.z, 1)) bad(`${g.id}: driveway spot is blocked`);
    g.panel.off = false;
  }
  // every business is a building right at its marker, with a front door side
  for (const l of LOCATIONS) {
    if (!l.block || l.type === 'home' || l.type === 'property') continue;
    const bs = map.buildings.filter(b => b.loc === l.id);
    if (!bs.length) { bad(`${l.id} has no building`); continue; }
    const near = Math.min(...bs.map(b => Math.hypot(Math.max(b.x - l.x, 0, l.x - (b.x + b.w)), Math.max(b.z - l.z, 0, l.z - (b.z + b.d)))));
    if (near > 12) bad(`${l.id}: nearest building is ${near.toFixed(0)} m from the marker`);
    if (l.type !== 'gas' && !bs.some(b => b.side === l.side)) bad(`${l.id}: building front does not face the street`);
  }
  for (const l of LOCATIONS) if ((l.type === 'roll' || l.type === 'drag') && !map.buildings.some(b => b.kind === 'gantry' && b.loc === l.id)) bad(`${l.id} has no start gantry`);
}

// ---- filler scenery stays off the roads and away from businesses and race starts ----
{
  const t0 = performance.now();
  const map = buildMap();
  const ms = performance.now() - t0;
  if (ms > 1500) bad(`buildMap took ${ms.toFixed(0)} ms`);
  if (map.buildings.length < 2500 || map.props.length < 4000) bad(`map looks empty: ${map.buildings.length} buildings, ${map.props.length} props`);
  const ROADKINDS = new Set(['gantry', 'canopy', 'pier', 'roof']);
  for (const b of map.buildings) {
    if (b.noCollide || ROADKINDS.has(b.kind) || b.loc) continue;
    for (const e of map.roads.edges) {
      const h = e.width / 2;
      if (b.x < Math.max(e.ax, e.bx) + h && b.x + b.w > Math.min(e.ax, e.bx) - h && b.z < Math.max(e.az, e.bz) + h && b.z + b.d > Math.min(e.az, e.bz) - h) { bad(`${b.kind} at ${b.x.toFixed(0)},${b.z.toFixed(0)} sits on ${e.name}`); break; }
    }
    if (!b.fill) continue;
    for (const l of LOCATIONS) {
      const dx = Math.max(b.x - l.x, 0, l.x - (b.x + b.w)), dz = Math.max(b.z - l.z, 0, l.z - (b.z + b.d));
      if (Math.hypot(dx, dz) < 15) bad(`${b.kind} at ${b.x.toFixed(0)},${b.z.toFixed(0)} crowds ${l.id}`);
    }
  }
  // every race start and business marker is reachable: nothing solid on it
  for (const l of LOCATIONS) if (collideCircle(map, l.x, l.z, 1.5)) bad(`${l.id} marker is blocked`);
}

// ---- every car has its own design sheet, and it describes a real car ----
{
  for (const c of CARS) {
    if (!hasShape(c.id)) { bad(`${c.id} has no design sheet in carShapes.js`); continue; }
    const sh = shapeOf(c), d = dimsOf(c);
    if (!(sh.L > 3.5 && sh.L < 6.1 && sh.W > 1.6 && sh.W < 2.25 && sh.H > 1.05 && sh.H < 2.1)) bad(`${c.id} odd size ${sh.L}x${sh.W}x${sh.H}`);
    if (!(sh.WB / sh.L > 0.5 && sh.WB / sh.L < 0.68)) bad(`${c.id} wheelbase ${sh.WB} of ${sh.L}`);
    if (!(sh.fo > sh.tr && sh.ro > sh.tr)) bad(`${c.id} wheels hang off the car (fo ${sh.fo.toFixed(2)}, ro ${sh.ro.toFixed(2)})`);
    if (!(sh.xCowl < sh.xA && sh.xA < sh.xC && sh.xC <= sh.xD && sh.xD < 1)) bad(`${c.id} roofline fractions out of order`);
    if (!(d.L === sh.L && d.W === sh.W)) bad(`${c.id} dimsOf mismatch`);
    const geo = sideGeo(sh);
    if (!geo.pts.every(p => Number.isFinite(p.x + p.y + p.r)) || !Number.isFinite(geo.fx + geo.rx + geo.cy + geo.R)) bad(`${c.id} side geometry is not finite`);
    if (!(geo.fx < geo.rx && geo.R > 20 && geo.R < 200)) bad(`${c.id} side wheel placement`);
    if (geo.frontLow.x >= geo.rearLow.x) bad(`${c.id} greenhouse collapsed`);
    // truck/SUV/sports sanity: pickups are the long ones, supercars the low ones
    if (sh.arch === 'P' && sh.L < 4.7) bad(`${c.id} pickup too short`);
    if (sh.arch === 'X' && sh.H > 1.3) bad(`${c.id} mid-engine car too tall`);
  }
  const s1 = shapeOf(CAR_BY_ID.honda_civic_ex_1996), s2 = shapeOf(CAR_BY_ID.ford_f_150_raptor_2021);
  if (!(s2.L > s1.L * 1.3 && s2.W > s1.W)) bad('a Raptor should be much bigger than a Civic');
  if (shapeOf(CAR_BY_ID.ford_mustang_gt_s650_2024).arch === shapeOf(CAR_BY_ID.chevrolet_corvette_stingray_c8_2020).arch) bad('Mustang and C8 share a roofline archetype');
}

// ---- police are patient: a few seconds of speeding in sight, not one frame ----
{
  const { PoliceSystem } = await import('../js/world2d/police.js');
  const map = buildMap();
  const st = createState({ name: 'T', age: 25, look: {}, story: false });
  const P = new PoliceSystem(map, st);
  const cop = { x: 20, z: 0, update() {}, police: true };
  P.patrols = [cop];
  const calls = [];
  const w = { player: { x: 0, z: 0, vx: 0, vz: 0, speed: 30, h: 0, inCar: true, carName: 'x' }, inCity: false, traffic: { spawnNear() { return null; } }, trafficCtx: {}, hud: { radio() {} }, audio: { siren() {}, music() {} },
    streetAt: () => 'Main St', districtAt: () => 'Downtown', liveDb: 70, offence: null };
  P.startChase = () => calls.push('chase');
  w.offence = { heat: 0.45 / 60, text: 'Speeding', kind: 'speeding', fine: 200 };
  for (let i = 0; i < 60; i++) P.update(1 / 60, w);                 // 1 s of speeding right in front of a cop
  if (calls.length) bad('one second of speeding should not start a chase');
  for (let i = 0; i < 60 * 3; i++) P.update(1 / 60, w);
  if (!calls.length) bad('sustained speeding in front of a cop should start a chase');
  const P2 = new PoliceSystem(map, st); P2.patrols = [{ x: 200, z: 0, update() {}, police: true }]; P2.startChase = () => calls.push('far');
  calls.length = 0;
  for (let i = 0; i < 60 * 6; i++) P2.update(1 / 60, w);
  if (calls.length) bad('a cop 200 m away should not see you speed');
}

// ---- arrow keys turn the car quickly at any speed ----
{
  const DT = 1 / 60;
  const m = CARS.find(c => c.id === 'ford_mustang_gt_s197_2005');
  for (const sp of [10, 20, 30, 45]) {
    const v = new Vehicle({ nos: 0, cond: {}, parts: {} }, m, buildSpec(m, {}, {}), 0, 0, 0);
    const step = inp => v.update(DT, { throttle: 0, brake: 0, steer: 0, auto: true, ...inp }, { grip: 1, drag: 0 });
    for (let t = 0; t < 40; t += DT) step({ throttle: Math.max(0, Math.min(1, (sp - v.speed) * 0.5)), brake: v.speed > sp + 2 ? 0.3 : 0 });
    let t50 = -1, peak = 0;
    for (let t = 0; t < 2; t += DT) { step({ steer: 1, throttle: Math.max(0, Math.min(1, (sp - v.speed) * 0.5)) }); peak = Math.max(peak, Math.abs(v.latG)); if (t50 < 0 && Math.abs(v.latG) > 0.5) t50 = t; }
    if (t50 < 0 || t50 > 0.25) bad(`holding right at ${sp} m/s takes ${t50 < 0 ? "forever" : t50.toFixed(2) + " s"} to reach 0.5 g`);
    if (peak < (sp <= 10 ? 0.6 : 0.7)) bad(`full lock at ${sp} m/s only reaches ${peak.toFixed(2)} g`);
  }
}

// ---- weapons: every Glock, AR pistols, shopping rules ----
{
  const models = new Set(GLOCKS.map(g => g.model));
  for (const m of ['G17', 'G17L', 'G18', 'G19', 'G19X', 'G20', 'G21', 'G22', 'G23', 'G24', 'G25', 'G26', 'G27', 'G28', 'G29', 'G30', 'G30S', 'G31', 'G32', 'G33', 'G34', 'G35', 'G36', 'G37', 'G38', 'G39', 'G40', 'G41', 'G42', 'G43', 'G43X', 'G44', 'G45', 'G47', 'G48']) if (!models.has(m)) bad(`missing ${m}`);
  if (GLOCKS.length < 55) bad(`only ${GLOCKS.length} Glock entries`);
  if (ARPS.length < 10) bad('AR pistols');
  if (new Set(WEAPONS.map(w => w.id)).size !== WEAPONS.length) bad('duplicate weapon ids');
  for (const w of WEAPONS) {
    if (!w.melee && !(CAL[w.cal] && w.mag > 0 && w.price > 0 && w.spread > 0 && w.cd > 0 && w.reload > 0)) bad(`${w.id} stats`);
  }
  const g17 = WEAPON_BY_ID.glock_17_g5, g26 = WEAPON_BY_ID.glock_26_g5;
  if (!(g17.mag === 17 && g17.cal === '9mm' && g26.mag === 10 && g26.spread > g17.spread)) bad('G17 / G26 specs');
  if (WEAPON_BY_ID.glock_17_g5.spread >= WEAPON_BY_ID.glock_17_g3.spread) bad('Gen5 should group tighter than Gen3');
  const st = createState({ name: 'T', age: 19, look: {}, story: false });
  st.cash = 50000;
  if (buyWeapon(st, 'glock_19_g5', 0, spend).ok) bad('a 19-year-old cannot buy a handgun');
  if (!buyWeapon(st, 'bat', 0, spend).ok) bad('a 19-year-old can buy a bat');
  st.player.age = 25;
  if (buyWeapon(st, 'glock_18', 0, spend).ok) bad('the Glock 18 is restricted');
  buyAmmo(st, '9mm', 2, spend);
  const before = st.cash;
  const r = buyWeapon(st, 'glock_19_g5', 0, spend);
  if (!r.ok || before - st.cash !== WEAPON_BY_ID.glock_19_g5.price) bad('buying a Glock charges its price');
  const gun = ensureArms(st).guns.find(g => g.id === 'glock_19_g5');
  if (!gun || gun.loaded !== 15 || st.arms.ammo['9mm'] !== 85) bad(`new Glock should arrive with a loaded mag (loaded ${gun?.loaded}, reserve ${st.arms.ammo['9mm']})`);
  if (minAge(WEAPON_BY_ID.knife) !== 18 || minAge(g17) !== 21) bad('age gates');
  const poor = createState({ name: 'P', age: 30, look: {}, story: false }); poor.cash = 10;
  if (buyWeapon(poor, 'glock_17_g5', 0, spend).ok) bad('cannot buy without money');
  // FRT drops into any firearm, not melee or the already-auto G18
  for (const w of WEAPONS) if (canFrt(w) !== (!w.melee && !w.auto)) bad(`FRT fit wrong for ${w.id}`);
  const ar = giveWeapon(st, 'arp_dd_mk18'), bat = giveWeapon(st, 'bat');
  st.arms.frtKits = 1;
  if (!toggleFrt(st, ar.uid).ok || !ar.frt || st.arms.frtKits !== 0) bad('FRT should install on an AR pistol');
  if (toggleFrt(st, gun.uid).ok || gun.frt) bad('FRT installed with no kit left');
  if (!toggleFrt(st, ar.uid).ok || ar.frt || st.arms.frtKits !== 1) bad('removing an FRT should return the kit');
  if (toggleFrt(st, bat.uid).ok || bat.frt) bad('FRT on a bat');
  if (!toggleFrt(st, gun.uid).ok || !gun.frt) bad('FRT should install on a Glock 19');
}
console.log(`${CARS.length} cars, ${CATALOG.length} products, ${new Set(CATALOG.map(p => p.brand)).size} brands, ${RACERS.length} racers — ${fails ? fails + ' problems' : 'all good'}`);
process.exit(fails ? 1 : 0);
