// Data sanity checks: every car simulates sensibly, every catalog item is
// well-formed, NPC builds reference real cars, the market generates
// affordable first cars. Run with: npm run check:data
import { CARS, CAR_BY_ID } from '../js/data/cars.js';
import { CATALOG, ITEM_BY_ID, fits } from '../js/data/catalog.js';
import { RACERS } from '../js/data/npcs.js';
import { LOCATIONS } from '../js/data/world.js';
import { generateListings } from '../js/data/market.js';
import { buildSpec, metrics, launchCheck } from '../js/sim/powertrain.js';
import { partLevels } from '../js/data/parts.js';
import { RevLimiter } from '../js/sim/twostep.js';
import { createState, newCar, game } from '../js/core/state.js';
import * as H from '../js/core/hustle.js';
import * as GIG from '../js/core/gigs.js';
import { SERVERS, SERVER_CAP } from '../js/net/online.js';
import { Vehicle } from '../js/world2d/vehicle.js';
import { GLOCKS, ARPS, WEAPONS, WEAPON_BY_ID, CAL, buyWeapon, buyAmmo, ensureArms, giveWeapon, minAge, canFrt, toggleFrt } from '../js/data/weapons.js';
import { spend } from '../js/core/state.js';
import { buildMap, collideCircle } from '../js/world2d/map.js';
import { PROPERTIES } from '../js/data/world.js';
import { shapeOf, hasShape, dimsOf } from '../js/data/carShapes.js';
import { sideGeo } from '../js/gfx2d/sideCar.js';
import { CARJACK, canCarjack, carjackChance, carjackChoices, resolveCarjack, strippedCar } from '../js/data/carjack.js';
import * as GANG from '../js/core/gangs.js';
import { GANGS, GANG_IDS, GANG_CONTACTS, RANKS } from '../js/data/gangs.js';
import { HOOD_BY_ID } from '../js/core/turf.js';
import { STREET_RACES, raceRoute, courseRecord, cornerSpeed, pinkSlipCheck } from '../js/data/streetRaces.js';
import { soundProfile, harmonics, firingHz, noiseDb, liveNoiseDb, hearingRange, exhaustDb, LEGAL_DB } from '../js/sim/sound.js';

import * as DR from '../js/core/drugs.js';
import * as EST from '../js/core/estate.js';
import { applyEstate } from '../js/world2d/estate.js';
import { LAND, PLANS, TRAPS, DRUGS } from '../js/data/estate.js';
import { charge as chargeOf } from '../js/core/justice.js';

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
  for (const l of LOCATIONS) if ((l.type === 'roll' || l.type === 'drag' || l.type === 'sprint') && !map.buildings.some(b => b.kind === 'gantry' && b.loc === l.id)) bad(`${l.id} has no start gantry`);
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

// ---- warrants: unpaid tickets, escapes, paying, surrendering ----
{
  const W = await import('../js/core/warrants.js');
  const st = createState({ name: 'W', age: 25, look: {}, story: false });
  st.cash = 20000; st.time.day = 4;
  if (W.hasWarrant(st)) bad('a new career starts with a warrant');
  W.signCitation(st, [{ kind: 'speeding', text: 'Speeding — 72 in a 45.', fine: 400 }], 400);
  st.time.day = 4 + W.CITATION_DAYS; W.citationsDue(st);
  if (W.hasWarrant(st) || st.citations.length !== 1) bad('a ticket turned into a warrant before its due date');
  st.time.day++; const late = W.citationsDue(st);
  if (late.length !== 1 || !W.hasWarrant(st) || W.hasFelony(st) || st.citations.length) bad('an overdue ticket should become a misdemeanour warrant');
  if (st.warrants[0].fine !== 400 + W.FTA_FEE) bad('late fee not added to the warrant');
  // outrunning a stop is a misdemeanour; a level-3 chase with a robbery is a felony
  W.warrantForEscape(st, [{ kind: 'noise', text: 'loud', fine: 400 }], 1);
  if (W.hasFelony(st) || !st.warrants.some(w => w.kind === 'evading') || st.warrants.some(w => w.kind === 'noise')) bad('fleeing a traffic stop should be a misdemeanour warrant (and noise stays a ticket)');
  const quiet = createState({ name: 'Q', age: 25, look: {}, story: false });
  if (W.warrantForEscape(quiet, [], 1, false).length) bad('no evading warrant when no officer ever saw you');
  const payable = W.payableTotal(st);
  W.warrantForEscape(st, [{ kind: 'robbery', text: 'Armed robbery — test.', fine: 6000 }], 3);
  if (!W.hasFelony(st) || W.payableTotal(st) !== payable) bad('felony warrants must not be payable online');
  const cash = st.cash, r = W.payFines(st);
  if (!r.ok || cash - st.cash !== payable || st.warrants.some(w => !w.felony) || !W.hasFelony(st)) bad('paying fines should clear tickets + misdemeanours only');
  W.signCitation(st, [{ kind: 'speeding', text: 'Speeding.', fine: 400 }], 400);
  const c2 = st.cash, sr = W.surrender(st);
  if (!sr.ok || W.hasWarrant(st) || st.citations.length || c2 - st.cash !== Math.round(400 * (1 - W.SURRENDER_DISCOUNT))) bad('turning yourself in should pay tickets at 25% off and clear every warrant');
  if (!sr.felonies.some(f => f.kind === 'robbery')) bad('turning yourself in on a felony should hand it to the courts');
  W.warrantForEscape(st, [], 2);
  if (W.serveAll(st) !== 2500 || W.hasWarrant(st)) bad('an arrest should serve every warrant');
}
// ---- courts: charges, bail, court dates, pleas, trials, sentences, probation ----
{
  const J = await import('../js/core/justice.js');
  const W = await import('../js/core/warrants.js');
  const fresh = () => { const s = createState({ name: 'Court', age: 25, look: {}, story: false }); s.cash = 500000; s.time.day = 10; s.time.min = 9 * 60; return s; };
  const rng0 = () => 0.5;
  // tickets stay tickets; crimes go to court with Texas classes
  const { charges, tickets } = J.charge([
    { kind: 'speeding', text: 'Speeding — 88 in a 45.', fine: 700 },
    { kind: 'robbery', text: 'Armed robbery — Amazin\' Mart.', fine: 6000 },
    { kind: 'evading', text: 'Evading arrest (in a vehicle).' },
    { kind: 'burnout', text: 'Exhibition of speed (burnout).', fine: 450 },
  ]);
  if (tickets.length !== 1 || tickets[0].kind !== 'speeding') bad('speeding should stay a fine-only ticket');
  const cls = Object.fromEntries(charges.map(c => [c.text.split(' ')[0], c.cls]));
  if (cls.Aggravated !== 'F1' || cls.Evading !== 'F3' || cls.Racing !== 'B') bad('charge classes: ' + JSON.stringify(cls));
  if (J.classify({ kind: 'evading', text: 'Evading detention (fled a stop).' }).cls !== 'A') bad('evading on foot is a Class A');
  // a first-time misdemeanour: free personal bond, court in 2 days, deferred adjudication on a plea
  {
    const s = fresh();
    const c = J.fileCase(s, J.charge([{ kind: 'hitrun', text: 'Hit-and-run collision.' }]).charges);
    if (c.date.day !== 12 || c.date.hour !== 9) bad('misdemeanour court date should be 2 days out at 9 AM');
    const b = J.bailFor(s, c);
    if (!b.pr || b.held || b.amount !== 500) bad('first-time Class B should get a personal bond: ' + JSON.stringify(b));
    if (J.courtStatus(s, c) !== 'early') bad('court is not today yet');
    s.time.day = 12; s.time.min = 10 * 60;
    if (J.courtStatus(s, c) !== 'today') bad('court should be open on the day');
    const offer = J.pleaOffer(s, c);
    if (offer.kind !== 'deferred') bad('first-time misdemeanour plea should be deferred adjudication, got ' + offer.kind);
    const r = J.resolveCase(s, c, c.charges.map(ch => ({ charge: ch, guilty: true })), { plea: true });
    if (J.openCase(s) || !s.justice.probation?.deferred || s.justice.convictions.length) bad('deferred adjudication: case closed, probation, no conviction');
    s.time.day = s.justice.probation.until + 1;
    if (!J.probationDay(s)?.done || s.justice.probation) bad('probation should end');
  }
  // a felony: real bail, 3 days out, missing court is bail jumping and forfeits cash bail
  {
    const s = fresh();
    const c = J.fileCase(s, charges);
    if (c.date.day !== 13 || !J.isFelonyCase(c)) bad('felony court date should be 3 days out');
    const b = J.bailFor(s, c);
    if (b.held || b.pr || b.amount < 75000) bad('aggravated robbery bail: ' + JSON.stringify(b));
    const cash = s.cash;
    if (!J.postBond(s, c, 'surety').ok || cash - s.cash !== Math.round(b.amount * J.BOND_FEE)) bad('a bondsman should cost 10%');
    s.time.day = 13; s.time.min = 16 * 60;
    if (J.courtTick(s, W.addWarrant)) bad('docket still open at 4 PM');
    s.time.min = 17 * 60 + 5;
    const f = J.courtTick(s, W.addWarrant);
    if (!f || !c.fta || !s.warrants.some(w => w.kind === 'bailjump' && w.felony)) bad('missing court should issue a felony bail-jumping warrant');
    if (!c.charges.some(x => /Bail jumping/.test(x.text))) bad('bail jumping should be added to the case');
    if (!J.bailFor(s, c).held) bad('no bail after skipping court');
    // arrested on it: the warrant is served, the case stays and gets a new date
    const t = W.takeWarrants(s);
    if (t.items.length || s.warrants.length) bad('a bail-jumping warrant should not be charged twice');
    // pleading to aggravated robbery is prison, even for a first-timer, with parole at half
    const offer = J.pleaOffer(s, c);
    if (offer.kind !== 'jail' || offer.facility !== 'prison' || offer.days < 1825 || offer.served !== Math.round(offer.days * 0.5)) bad('aggravated robbery plea: ' + JSON.stringify(offer));
    // trial is worse than the deal
    const trial = J.sentence(s, c.charges, { plea: false, rng: rng0 });
    if (trial.days <= offer.days) bad('a trial conviction should be worse than the plea deal');
    J.resolveCase(s, c, c.charges.map(ch => ({ charge: ch, guilty: true })), { plea: true });
    if (s.justice.convictions.length !== c.charges.length || J.priorScore(s) < 2) bad('convictions go on the record and count as priors');
    // priors make the next one worse
    const again = J.sentence(s, J.charge([{ kind: 'hitrun', text: 'Hit-and-run.' }]).charges, { plea: true });
    if (again.kind !== 'jail' || again.facility !== 'county') bad('a misdemeanour with felony priors should mean county jail, got ' + again.kind);
  }
  // acquitted on everything: no conviction, cash bail back
  {
    const s = fresh();
    const c = J.fileCase(s, J.charge([{ kind: 'shots', text: 'Discharging a firearm in public.' }]).charges);
    J.postBond(s, c, 'cash');
    const r = J.resolveCase(s, c, c.charges.map(ch => ({ charge: ch, guilty: false })));
    if (r.sentence.kind !== 'none' || r.refund !== c.bond.paid || r.refund <= 0 || s.justice.convictions.length) bad('acquittal: nothing on the record, bail refunded');
  }
  // a new conviction on probation revokes it
  {
    const s = fresh();
    s.justice.probation = { until: 30, text: 'Racing on a highway.', deferred: false, suspended: { days: 90, cls: 'B' } };
    const c = J.fileCase(s, J.charge([{ kind: 'brandish', text: 'Brandishing.' }]).charges);
    if (!J.bailFor(s, c).held) bad('arrested on probation: held for revocation');
    const r = J.resolveCase(s, c, c.charges.map(ch => ({ charge: ch, guilty: true })), { plea: true });
    if (!r.revoked || r.sentence.kind !== 'jail' || s.justice.probation) bad('probation should be revoked into jail time');
  }
  // time served counts; unpaid fines are sat out
  {
    const s = fresh();
    const sent = J.sentence(s, [{ cls: 'A', text: 'x', evidence: 1 }, { cls: 'A', text: 'y', evidence: 1 }].map(x => x), { plea: false, rng: rng0 });
    const c = J.fileCase(s, [{ cls: 'A', text: 'x', evidence: 1 }, { cls: 'A', text: 'y', evidence: 1 }]);
    s.justice.convictions.push({ day: 1, text: 'p', cls: 'B' }, { day: 2, text: 'q', cls: 'B' });
    const r = J.resolveCase(s, c, c.charges.map(ch => ({ charge: ch, guilty: true })), { plea: false, rng: rng0, served: 10000 });
    if (r.sentence.kind !== 'jail' || r.sentence.served !== 0) bad('time served should cover the sentence: ' + JSON.stringify(r.sentence));
    s.cash = 100; s.bank = 0;
    const f = J.payFine(s, 1000);
    if (f.paid !== 100 || f.layout !== Math.ceil(900 / J.FINE_PER_DAY)) bad('an unpaid fine should be sat out in jail');
  }
  // time inside is compressed but still means something
  if (J.gameMinutes(30) < 1440 || J.gameMinutes(3650) < 10 * 1440 || J.gameMinutes(3650) > 20 * 1440) bad('jail time compression');
  if (Math.abs(J.realDaysFor(J.gameMinutes(400)) - 400) > 5) bad('time-served conversion should round-trip');
  if (!LOCATIONS.some(l => l.id === 'courthouse' && l.type === 'court')) bad('the courthouse needs a door');
}
// ---- disguises: ski mask + all black keeps witnesses from naming you ----
{
  const D = await import('../js/core/disguise.js');
  const W = await import('../js/core/warrants.js');
  const { CLOTHES, CLOTH_BY_ID, BLACKOUT_FIT } = await import('../js/data/shops.js');
  for (const c of CLOTHES) if (!['top', 'bottom', 'hat', 'shoes', 'mask'].includes(c.slot)) bad(`clothing ${c.id} has an unknown slot ${c.slot}`);
  for (const id of BLACKOUT_FIT) if (!CLOTH_BY_ID[id] || CLOTH_BY_ID[id].shop !== 'surplus') bad(`blackout fit item ${id} is not sold at the surplus store`);
  if (!LOCATIONS.some(l => l.shop === 'surplus' && l.type === 'clothing')) bad('no store sells the ski mask');
  if (CLOTHES.some(c => /nike/i.test(c.name))) bad('use the made-up brand, not a real trademark');
  const plain = { top: 'tee_white', bottom: 'jeans_blue', shoes: 'kicks_white', hat: 'no_hat', mask: 'no_mask' };
  const black = { ...plain, top: 'fleece_black', bottom: 'joggers_black', shoes: 'kicks_blackout' };
  const full = { ...black, mask: 'skimask_black' };
  if (D.concealment(plain) !== 0) bad('a plain outfit should not hide you');
  if (!D.allBlack(black) || D.masked(black)) bad('all-black detection is off');
  if (!(D.concealment(black) > 0 && D.concealment(black) < D.concealment(black, true))) bad('all black should help, and help more at night');
  if (!(D.concealment(full, true) >= 0.85 && D.concealment(full) > D.concealment({ ...plain, mask: 'skimask_black' }))) bad('mask + all black at night should be close to unrecognisable');
  if (D.concealment({ ...plain, top: 'hoodie_black', bottom: 'jeans_black', shoes: 'boots_black' }) !== D.concealment(black)) bad('the black clothes Threadline already sells should count as black');
  // a robbery done fully masked at night leaves no warrant when the witness can't ID; unmasked always does
  const st = createState({ name: 'M', age: 25, look: {}, story: false });
  const rob = conceal => [{ kind: 'robbery', text: 'Armed robbery — test.', fine: 6000, conceal }];
  let wr = W.warrantForEscape(st, rob(D.concealment(full, true)), 1, false, () => 0.5);
  if (wr.length || wr.unidentified !== 1 || W.hasWarrant(st)) bad('a masked robbery nobody could ID should not become a warrant');
  wr = W.warrantForEscape(st, rob(D.concealment(full, true)), 1, false, () => 0.99);
  if (wr.length !== 1 || !/despite the disguise/.test(st.warrants[0].evidence)) bad('a witness who does pick you out should still put out a warrant');
  W.serveAll(st);
  wr = W.warrantForEscape(st, rob(0), 1, false, () => 0);
  if (wr.length !== 1 || !st.warrants[0].evidence) bad('an unmasked robbery should always become a warrant with evidence');
  // pulling the mask down and up remembers which one
  const ms = createState({ name: 'K', age: 25, look: { ...plain }, story: false });
  if (D.toggleMask(ms) !== null) bad('toggling a mask you do not own should do nothing');
  ms.player.outfits.push('bandana_black', 'skimask_black');
  D.toggleMask(ms); ms.player.look.mask = 'skimask_black'; D.toggleMask(ms);
  if (D.masked(ms.player.look) || D.toggleMask(ms) !== true || ms.player.look.mask !== 'skimask_black') bad('mask toggle should put back the last mask worn');
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

// carjackings: rare, only when it makes sense, and resisting is a real risk
{
  const ok = { inCar: true, stopped: true, inCity: true, policeActive: false, heat: 0, inGarage: false, busy: false, playTime: 3600, day: 10, lastDay: -99, night: true };
  if (!canCarjack(ok)) bad('carjack should be possible stopped in the city at night');
  for (const [k, v] of [['inCar', false], ['stopped', false], ['inCity', false], ['policeActive', true], ['heat', 2], ['inGarage', true], ['busy', true], ['playTime', 60], ['lastDay', 9]])
    if (canCarjack({ ...ok, [k]: v })) bad(`carjack allowed with ${k}=${v}`);
  // expected wait while sitting still: tens of minutes at night, over an hour by day
  const night = 1 / carjackChance(ok, 1), day = 1 / carjackChance({ ...ok, night: false }, 1);
  if (!(night >= 20 * 60 && day >= 60 * 60 && day > night)) bad(`carjacks are not rare enough (night every ${night | 0}s, day every ${day | 0}s stopped)`);
  if (!(CARJACK.gapDays >= 2)) bad('carjacks need a gap of days between them');
  if (carjackChoices(true).map(c => c.value).join() !== 'give,flee,gun') bad('armed carjack choices');
  if (carjackChoices(false).map(c => c.value).join() !== 'give,flee,fight') bad('unarmed carjack choices');
  // run each choice many times with a seeded rng
  let seed = 7; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const sim = ch => { const n = 4000; let keep = 0, hurt = 0, hurtAny = 0; for (let i = 0; i < n; i++) { const o = resolveCarjack(ch, rng); keep += o.keep; hurt += o.hurt; hurtAny += o.hurt > 0; } return { keep: keep / n, hurt: hurt / n, hurtAny: hurtAny / n }; };
  const give = sim('give'), flee = sim('flee'), gun = sim('gun'), fight = sim('fight');
  if (give.keep !== 0 || give.hurtAny !== 0) bad('giving up the car loses it and never hurts you ' + JSON.stringify(give));
  if (!(flee.keep > 0.7 && flee.keep < 0.98 && flee.hurtAny > 0.2)) bad('fleeing usually works but can get you shot ' + JSON.stringify(flee));
  if (!(gun.keep > 0.8 && gun.hurtAny > 0.3)) bad('pulling a gun usually keeps the car, at a cost ' + JSON.stringify(gun));
  if (!(fight.keep > 0.2 && fight.keep < 0.4 && fight.hurt > gun.hurt)) bad('fighting barehanded is the worst gamble ' + JSON.stringify(fight));
  for (let i = 0; i < 200; i++) { const o = resolveCarjack('give', rng); if (o.wallet < 0 || o.wallet > 0.6) bad('wallet share out of range'); if (o.keep) bad('kept car after giving it up'); }
  const jc = newCar(CARS[0].id); jc.nos = 3; strippedCar(jc, rng);
  if (!(jc.cond.body < 100 && jc.fuel <= 0.15 && jc.nos === 0)) bad('a recovered car comes back beat up and low on gas ' + JSON.stringify({ c: jc.cond, f: jc.fuel, n: jc.nos }));
}
// drag packs: max launch grip, and enough power makes the car wheelie until it's tuned out
{
  const camaro = CAR_BY_ID.chevrolet_camaro_ss_2016;
  if (!CATALOG.some(p => p.cat === 'dragpack' && fits(p, civic))) bad('no drag pack fits a Civic');
  if (CATALOG.some(p => p.cat === 'wheeliebar' && fits(p, civic))) bad('wheelie bars fit a front-drive car');
  if (!CATALOG.some(p => p.cat === 'wheeliebar' && fits(p, camaro))) bad('no wheelie bars fit a Camaro');
  for (const c of CARS) if (launchCheck(buildSpec(c, {}, {})).maxPitch > 0) bad(`stock ${c.id} wheelies`);
  const big = { turbo: 4, ecu: 3, fuel: 4, engine: 4, intercooler: 3 };
  const noPack = launchCheck(buildSpec(camaro, big, {}));
  const pack = launchCheck(buildSpec(camaro, { ...big, dragpack: 4 }, {}));
  const tuned = launchCheck(buildSpec(camaro, { ...big, dragpack: 4 }, {}, { frontExt: 10, rearComp: 10, pwr1: 75 }));
  const bars = launchCheck(buildSpec(camaro, { ...big, dragpack: 4, wheeliebar: 2 }, {}));
  const mild = launchCheck(buildSpec(camaro, { intake: 1, exhaust: 1, dragpack: 2 }, {}));
  const fwd = launchCheck(buildSpec(civic, { turbo: 4, ecu: 3, fuel: 4, engine: 4, intercooler: 3, dragpack: 4 }, {}));
  if (!(pack.spin < noPack.spin * 0.6)) bad(`drag pack barely cut wheelspin (${noPack.spin.toFixed(2)}s -> ${pack.spin.toFixed(2)}s)`);
  if (!(pack.maxPitch > 0.45)) bad(`a 1400 hp Camaro on a drag pack should wheelie hard (pitch ${pack.maxPitch.toFixed(2)})`);
  if (!(tuned.maxPitch < 0.1)) bad(`stiff drag shocks + 1st-gear power cut didn't tune the wheelie out (${tuned.maxPitch.toFixed(2)})`);
  if (!(bars.maxPitch <= 0.4)) bad(`wheelie bars didn't catch the wheelie (${bars.maxPitch.toFixed(2)})`);
  if (mild.maxPitch > 0 || mild.spin > 0.1) bad('a mild build on a drag pack should just hook');
  if (fwd.maxPitch > 0) bad('a front-drive car wheelied');
  const dflt = buildSpec(camaro, { dragpack: 2 }, {}), same = buildSpec(camaro, { dragpack: 2 }, {}, { frontExt: 5, rearComp: 5 });
  if (dflt.wheelieF !== same.wheelieF || dflt.trac !== same.trac) bad('default drag shock settings are not neutral');
  if (!(buildSpec(camaro, { dragpack: 3 }, {}).handling < buildSpec(camaro, {}, {}).handling)) bad('front skinnies should cost cornering grip');
}
// ---- gig shifts: driving well pays, driving badly costs you, staying clean is worth it ----
{
  const g = (k, r) => GIG.grade(k, 1000, { late: -30, dmg: 0, harsh: 0, speeding: 0, swing: 0, ...r });
  const ontime = g('delivery', {}), late = g('delivery', { late: 60 }), smashed = g('delivery', { dmg: 10 });
  if (!(ontime.pay + ontime.tip > late.pay + late.tip && late.pay > 0)) bad('a late delivery should pay less than an on-time one');
  if (!(smashed.pay < ontime.pay && !smashed.tip)) bad('a smashed delivery should cost the tip and pay');
  const smooth = g('ride', {}), rough = g('ride', { harsh: 4, speeding: 10 });
  if (!(smooth.stars === 5 && rough.stars < 3 && rough.pay < smooth.pay && !rough.tip)) bad('Ryde stars do not follow how you drive');
  const clean = g('tow', {}), swung = g('tow', { swing: 10, dmg: 8 });
  if (!(swung.pay < clean.pay && swung.pay >= 400)) bad('tow pay should drop (not vanish) when the dolly swings');
  const s = createState({ name: 'Gig', age: 25, look: {}, story: false });
  const q0 = GIG.quote(s, 'delivery', 1000);
  GIG.ensure(s).streak = 4;
  if (GIG.quote(s, 'delivery', 1000) !== Math.round(q0 * 1.2)) bad('clean streak should add 5% a shift');
  GIG.ensure(s).streak = 99;
  if (GIG.streakBonus(s) !== GIG.STREAK_MAX) bad('clean streak bonus should cap');
  s.warrants = [{ kind: 'fta', fine: 100 }];
  if (!/warrant/.test(GIG.blocked(s) || '')) bad('a warrant should keep you off the schedule');
  s.warrants = [];
  s.gigs.suspended = s.time.day;
  if (!/Suspended/.test(GIG.blocked(s) || '')) bad('an arrest should suspend you from shifts');
  if (GIG.GIGS.some(x => !x.co || !x.icon || !(x.base > 0))) bad('a gig is missing its company, icon or pay');
}
// ---- car shows: judging, entrants, crowd votes ----
{
  const CS = await import('../js/core/carshow.js');
  const { defaultVisual: dv } = await import('../js/data/parts.js');
  const { VISUAL_CATALOG } = await import('../js/data/catalog.js');
  const civic = CAR_BY_ID.honda_civic_ex_1996;
  const stock = CS.judge(civic, dv(civic), { body: 100 }, {});
  const built = CS.judge(civic, { ...dv(civic), paint: '#6b2bd1', finish: 'pearl', wheels: 'six', wheelColor: '#c9a24a', wheelSize: '18', kit: 'wide', tint: 'medium', spoiler: 'lip', headlights: 'led' }, { body: 100 }, {});
  if (!(built.total > stock.total + 40)) bad(`a full build should out-score stock (${built.total} vs ${stock.total})`);
  const beat = CS.judge(civic, dv(civic), { body: 30 }, {});
  if (!(beat.total < stock.total)) bad('a beat-up body should lose points');
  const clown = CS.judge(civic, { ...dv(civic), finish: 'chrome', decal: 'flames', neon: '#ff1a2e', spoiler: 'gt' }, { body: 100 }, {});
  if (!(clown.parts.cohesion < 0)) bad('every loud mod at once should hurt cohesion');
  // every value the judges read is one Vega Kustoms sells (or a stock value)
  const sold = new Set(VISUAL_CATALOG.map(p => p.value));
  for (const tier of [1, 3, 5]) {
    const es = CS.makeEntrants(tier);
    if (es.length !== 5) bad(`car show tier ${tier} has ${es.length} entrants`);
    for (const e of es) {
      if (!CAR_BY_ID[e.modelId]) bad(`car show entrant ${e.id} drives an unknown car`);
      for (const k of ['finish', 'kit', 'tint', 'spoiler', 'decal']) if (e.visual[k] !== dv(CAR_BY_ID[e.modelId])[k] && !sold.has(e.visual[k])) bad(`entrant ${e.name}: ${k} ${e.visual[k]} is not sold anywhere`);
      if (!isFinite(CS.judge(CAR_BY_ID[e.modelId], e.visual, e.cond, e.levels).total)) bad(`entrant ${e.name} has no score`);
    }
  }
  // the crowd: everyone votes once, the best build wins most of the time but not always
  const field = CS.makeEntrants(2).map(e => ({ ...e, visual: { ...e.visual, decal: 'none', neon: 'none' } }));
  field.push({ id: 'me', modelId: civic.id, visual: { ...dv(civic), paint: '#6b2bd1', finish: 'pearl', wheels: 'six', wheelColor: '#c9a24a', kit: 'wide', tint: 'medium', spoiler: 'lip', headlights: 'led', frontBumper: 'splitter', rearBumper: 'diffuser', skirts: 'aero', interior: '#7a1212' }, cond: { body: 100 }, levels: { turbo: 3, engine: 2 } });
  const b = CS.crowdVote(field);
  if (b.length !== CS.VOTERS || b.some(x => x < 0 || x >= field.length)) bad('every voter casts exactly one valid vote');
  const t = CS.tally(b, field.length);
  if (t.reduce((a, c) => a + c, 0) !== CS.VOTERS) bad('vote tally does not add up');
  if (t.filter(x => x > 0).length < 2) bad('the crowd should split its votes');
  if (!(CS.prizeFor(1, 3).cash > CS.prizeFor(2, 3).cash && CS.prizeFor(1, 4).cash > CS.prizeFor(1, 1).cash && CS.prizeFor(0, 1).cash === 0)) bad('car show prizes are off');
  if (!CS.isShowTime({ day: 6, min: 12 * 60 }, 'Sat') || CS.isShowTime({ day: 6, min: 20 * 60 }, 'Sat') || CS.isShowTime({ day: 3, min: 12 * 60 }, 'Wed')) bad('car show hours are off');
  if (!LOCATIONS.some(l => l.type === 'carshow')) bad('the car show needs a lot on the map');
}
// ---- Glitch rim pack: every rim is on the atlas and sold as a wheel ----
{
  const { RIMS, RIM_COLS } = await import('../js/data/rims.js');
  const fs = await import('node:fs');
  if (!fs.existsSync(new URL('../img/rims.webp', import.meta.url))) bad('rim atlas img/rims.webp is missing');
  if (RIMS.length !== 44 || Math.ceil(RIMS.length / RIM_COLS) !== 4) bad('rim pack should be 44 wheels on a 4-row atlas');
  for (const r of RIMS) {
    const p = CATALOG.find(x => x.rim === r.id);
    if (!p || p.cat !== 'wheels' || !p.visual) bad(`rim ${r.id} is not sold as a wheel`);
    if (!['five', 'six', 'split', 'turbine', 'mesh', 'dish', 'steel'].includes(r.style)) bad(`rim ${r.id} has no fallback style`);
  }
  if (ITEM_BY_ID.vis_a5?.name !== 'Dial In 18" (set)' || ITEM_BY_ID.vis_ci?.cat !== 'interior') bad('adding rims moved older product ids (saves would break)');
}
// ---- street races: every leg runs on a real road, records are sane, pink slips have rules ----
{
  const map = buildMap();
  const ids = new Set();
  for (const ev of STREET_RACES) {
    if (ids.has(ev.id)) bad(`duplicate street race ${ev.id}`);
    ids.add(ev.id);
    if (!RACERS.some(r => r.id === ev.record)) bad(`${ev.id}: record holder ${ev.record} is not a racer`);
    const r = raceRoute(ev);
    for (let i = 1; i < r.pts.length; i++) {
      const [ax, az] = r.pts[i - 1], [bx, bz] = r.pts[i];
      if (ax !== bx && az !== bz) bad(`${ev.id}: leg ${i} is not along one street`);
      for (let t = 0; t <= 1; t += 0.05) if (!map.roads.onRoad(ax + (bx - ax) * t, az + (bz - az) * t)) { bad(`${ev.id}: leg ${i} leaves the road`); break; }
    }
    if (r.length < 1200) bad(`${ev.id} is only ${r.length.toFixed(0)} m`);
    const last = r.checkpoints[r.checkpoints.length - 1];
    if (!last || last.s !== r.length) bad(`${ev.id}: the last checkpoint is not the finish`);
    const rec = courseRecord(ev);
    if (!(rec.time > 15 && rec.time < 240)) bad(`${ev.id}: course record ${rec.time}s`);
    if (courseRecord(ev).time !== rec.time) bad(`${ev.id}: course record is not stable`);
  }
  if (!(cornerSpeed(Math.PI / 2, 1, 0.5) < cornerSpeed(0.6, 1, 0.5))) bad('a 90° corner should be slower than a kink');
  if (!(cornerSpeed(Math.PI / 2, 1.2, 0.5) > cornerSpeed(Math.PI / 2, 0.9, 0.5))) bad('stickier tires should corner faster');
  const fair = { myPi: 400, theirPi: 420, myValue: 9000, theirValue: 12000, freeSlots: 1, stolen: false };
  if (pinkSlipCheck(fair)) bad('an even pink-slip race was refused');
  if (!pinkSlipCheck({ ...fair, freeSlots: 0 })) bad('pink slips allowed with a full garage');
  if (!pinkSlipCheck({ ...fair, myPi: 600 })) bad('pink slips allowed against a much slower car');
  if (!pinkSlipCheck({ ...fair, myValue: 2000 })) bad('pink slips allowed with a junker against a nice car');
}
// ---- gangs: getting on, ranks, homies, beef, work ----
{
  for (const id of GANG_IDS) {
    const g = GANGS[id];
    if (!HOOD_BY_ID[g.hood]) bad(`gang ${id}: unknown hood ${g.hood}`);
    if (!GANG_CONTACTS[g.boss]) bad(`gang ${id}: no big homie contact`);
    if (g.rivals.some(r => !GANGS[r] || r === id)) bad(`gang ${id}: bad rival`);
  }
  if (RANKS.some((r, i) => i && !(r.respect > RANKS[i - 1].respect && r.homies >= RANKS[i - 1].homies))) bad('gang ranks should climb');
  const s = createState({ name: 'Gang', age: 22, look: {}, story: false });
  game.s = s;
  GANG.ensureGang(s);
  if (GANG.hostile(s, 'six_block')) bad('a set should not shoot at someone with no beef');
  s.arms = undefined; ensureArms(s); s.arms.hp = 100;
  if (GANG.jumpIn(s, 'six_block')) bad('could not get jumped in');
  if (s.gang.set !== 'six_block' || s.arms.hp !== 55 || s.gang.homies.length !== 1) bad('getting jumped in should hurt and come with a homie');
  if (!GANG.hostile(s, 'hemphill') || GANG.hostile(s, 'six_block')) bad('your set\'s rivals should shoot on sight, your own set should not');
  if (GANG.rankOf(s).name !== 'Lil Homie') bad('new members start as Lil Homie');
  GANG.addRespect(s, 160);
  if (GANG.rankOf(s).name !== 'Soldier' || GANG.homieCap(s) !== 2) bad('respect should rank you up');
  s.cash = 5000;
  if (GANG.recruit(s) || s.gang.homies.length !== 2) bad('could not recruit a homie');
  if (!GANG.recruitBlocked(s)) bad('recruiting past the rank cap was allowed');
  if (s.gang.offers.length !== 3) bad('a member should have work offered');
  const hit = s.gang.offers.find(o => o.kind === 'hit');
  if (GANG.takeJob(s, hit.id)) bad('could not take a hit');
  const cash = s.cash, rep = s.gang.respect, beef = s.gang.beef[hit.gang];
  for (let i = 0; i < hit.need; i++) GANG.progress(s, 'hit', hit.gang);
  if (s.gang.job || s.cash !== cash + hit.pay || s.gang.respect !== rep + hit.respect || !(s.gang.beef[hit.gang] > beef)) bad('finishing a hit should pay, add respect and beef');
  s.gang.beef.como = 60;
  if (!GANG.hostile(s, 'como')) bad('hot beef should make a set shoot on sight');
  s.cash = 1e5;
  if (GANG.squash(s, 'como') || GANG.hostile(s, 'como') || s.gang.beef.como !== 0) bad('squashing beef should cool a set off');
  GANG.leave(s);
  if (s.gang.set || !(s.gang.beef.six_block >= GANG.HOSTILE_AT)) bad('leaving your set should put you at war with it');
  s.rep = 1e6;
  if (GANG.found(s, 'Rosedale Gang', 'Stop Six') || s.gang.set !== 'own' || !GANG.hostile(s, 'six_block')) bad('starting a set in a taken hood should start beef');
  s.time.day += 1; const before = s.cash; GANG.tick(s);
  if (!(s.cash > before)) bad('your own set should pay dues in the morning');
  const { classify } = await import('../js/core/justice.js');
  if (classify({ kind: 'driveby', text: 'Drive-by shooting (gang activity).' }).cls !== 'F2') bad('a gang drive-by should be a 2nd-degree felony');
  game.s = null;
}
// ---- drugs, trap houses, land you build on ----
{
  const st = createState({ name: 'D', age: 25, look: {}, story: false });
  game.s = st; st.cash = 5e6; st.rep = 40000;
  // the plug: buying puts it in your bag, prices hold for the day
  const pr = DR.prices(st);
  for (const g of DRUGS) if (!(pr[g.id].buy > 0 && pr[g.id].street > pr[g.id].buy)) bad(`${g.id}: street price should beat the plug's`);
  if (!DR.buy(st, 'loud', 2).ok || st.drugs.bag.loud !== 2) bad('buying from the plug');
  // the law: a little is possession, a lot is delivery, all of it goes to court
  const small = DR.drugOffences({ loud: 1 }), big = DR.drugOffences({ powder: 6 });
  if (small[0]?.kind !== 'drugs_B') bad(`an ounce of weed should be a Class B, got ${small[0]?.kind}`);
  if (!/delivery/i.test(big[0]?.text) || big[0]?.kind !== 'drugs_F1') bad(`six 8-balls should be delivery (F1), got ${big[0]?.kind}`);
  const ch = chargeOf(big).charges;
  if (ch[0]?.cls !== 'F1') bad('drug offences do not reach court as felonies');
  // a trap house: customers want what you have, every sale raises the heat
  if (!EST.buyProperty(st, 'trap_stopsix').ok || st.home === 'trap_stopsix') bad('buying a trap house (and it should not become home)');
  DR.moveStash(st, 'trap_stopsix', true);
  if (DR.units(st.drugs.bag) || DR.units(DR.trapState(st, 'trap_stopsix').stash) !== 2) bad('stashing product');
  DR.buy(st, 'percs', 80); DR.moveStash(st, 'trap_stopsix', true);
  const before = DR.raidChance(st, 'trap_stopsix');
  let served = 0;
  for (let k = 0; k < 30; k++) { const c = DR.customer(st, 'trap_stopsix'); if (c && DR.serve(st, 'trap_stopsix', c, () => 0.99).ok) served++; }
  if (served < 20) bad(`only ${served} customers got served`);
  if (!(DR.raidChance(st, 'trap_stopsix') > before * 4)) bad('more customers should make a raid much more likely');
  if (DR.serve(st, 'trap_stopsix', DR.customer(st, 'trap_stopsix') || { drug: 'percs', qty: 1, price: 1, who: 'x' }, () => 0).raid !== true) bad('an unlucky sale should bring SWAT');
  const took = DR.raidHouse(st, 'trap_stopsix');
  if (!took.product || DR.units(DR.trapState(st, 'trap_stopsix').stash) || !DR.isClosed(st, 'trap_stopsix')) bad('a raid should take the stash and board the house up');
  // a day goes by: the house cools off
  const t = DR.trapState(st, 'trap_stopsix'); t.traffic = 20; DR.drugsDay(st);
  if (!(t.traffic < 20)) bad('trap traffic should cool off overnight');
  // land: buy, build, and the house goes up on the map with a working garage
  const map = buildMap();
  for (const id of Object.keys(LAND)) {
    if (!map.lots.some(l => l.loc === id && l.kind === 'dirt')) bad(`${id}: no lot on the map`);
    if (!EST.buyLand(st, id).ok) bad(`buying ${id}`);
    if (!EST.build(st, id, 'compound').ok) bad(`building on ${id}`);
    if (EST.isBuilt(st, id)) bad(`${id} built instantly`);
  }
  st.time.day += 5;
  if (EST.finishBuilds(st).length !== Object.keys(LAND).length) bad('builds did not finish');
  applyEstate(map, st);
  for (const id of Object.keys(LAND)) {
    const g = map.garages.find(q => q.id === id), P = PROPERTIES[id];
    if (!g || !P || P.slots !== 10 || !st.properties.includes(id)) { bad(`${id}: built house missing (garage ${!!g}, property ${!!P})`); continue; }
    if (g.bays.length < P.slots - 1) bad(`${id}: ${g.bays.length} bays for ${P.slots}`);
    g.panel.off = true;
    for (let i = 0; i <= 40; i++) { const k = i / 40; if (collideCircle(map, g.park.x + (g.center.x - g.park.x) * k, g.park.z + (g.center.z - g.park.z) * k, 1.1)) { bad(`${id}: can't drive into the built garage`); break; } }
    for (const b of g.bays) if (collideCircle(map, b.x, b.z, 0.9)) bad(`${id}: a bay is inside a wall`);
    if (map.lots.find(l => l.loc === id && l.kind === 'dirt').w !== 0) bad(`${id}: the dirt lot still shows under the house`);
  }
  // loading another career takes those houses down again
  const fresh = createState({ name: 'E', age: 25, look: {}, story: false });
  applyEstate(map, fresh);
  for (const id of Object.keys(LAND)) if (map.garages.some(g => g.id === id) || PROPERTIES[id]) bad(`${id}: a house from another career stayed up`);
  game.s = st; applyEstate(map, st);
  if (!EST.sellLand(st, 'land_stopsix').ok || PROPERTIES.land_stopsix) bad('selling land you built on');
  for (const id of Object.keys(LAND)) { delete PROPERTIES[id]; }
}
// dirty money, the bank, washing it through a business, and the feds
{
  const BK = await import('../js/core/bank.js');
  const { earn, spend: pay, dirtyOf, cleanOf } = await import('../js/core/state.js');
  const { classify } = await import('../js/core/justice.js');
  const mk = () => { const s = createState({ name: 'Bank', age: 25, look: {}, story: false }); s.rep = 2000; s.time.day = 5; game.s = s; return s; };
  // an old save: all cash is clean
  const old = mk(); delete old.dirty; old.cash = 9000;
  if (dirtyOf(old) !== 0 || cleanOf(old) !== 9000) bad('old saves should treat cash as clean');
  const s = mk(); s.cash = 1000;
  earn(s, 5000, 'Served a fiend', { dirty: true });
  if (s.cash !== 6000 || dirtyOf(s) !== 5000) bad(`dirty earnings: cash ${s.cash}, dirty ${dirtyOf(s)}`);
  // small buys spend the dirty cash first
  pay(s, 500, 'Gas'); if (dirtyOf(s) !== 4500 || cleanOf(s) !== 1000) bad('small buys should spend dirty cash first');
  // a clean deposit is fine, a dirty one draws attention
  let r = BK.depositCash(s, 1000, false);
  if (!r.ok || s.bank !== 1000 || BK.ensureFeds(s).heat !== 0) bad('clean deposit');
  r = BK.depositCash(s, 4500, true);
  if (!r.ok || dirtyOf(s) !== 0 || s.feds.heat <= 0) bad('dirty deposit should raise federal attention');
  // over $10,000 in a day: a CTR
  const c = mk(); c.cash = 12000; c.dirty = 12000;
  r = BK.depositCash(c, 12000, true);
  if (!r.ctr || c.feds.ctrs !== 1) bad('a CTR should be filed over $10,000');
  // structuring: two $9,500 deposits in a few days
  const st = mk(); st.cash = 19000; st.dirty = 19000;
  BK.depositCash(st, 9500, true); st.time.day++;
  r = BK.depositCash(st, 9500, true);
  if (!r.sar || st.feds.sars !== 1 || r.ctr) bad('structuring should get a SAR and dodge the CTR');
  // a big dirty-cash purchase: Form 8300; with clean money in the bank it isn't touched
  const b = mk(); b.cash = 20000; b.dirty = 20000; b.bank = 30000;
  pay(b, 15000, 'Bought a car');
  if (dirtyOf(b) !== 20000 || b.bank !== 15000 || BK.ensureFeds(b).reports) bad('big buys should use the bank before dirty cash');
  b.bank = 0; pay(b, 15000, 'Bought another car');
  if (b.feds.reports !== 1 || b.feds.heat <= 0) bad('paying $15,000 in dirty cash should file a Form 8300');
  // the plug doesn't file paperwork
  const p = mk(); p.cash = 12000; p.dirty = 12000; pay(p, 11000, 'Lil Tre', { street: true });
  if (BK.ensureFeds(p).reports) bad('street buys should not be reported');
  // washing through a business
  const w = mk(); w.cash = 30000; w.dirty = 0;
  if (!H.buyBiz(w, 'laundromat').ok) bad('buying the laundromat');
  w.cash += 10000; w.dirty = 10000;
  const cap = BK.washCap(w, 'laundromat');
  if (cap !== 4000) bad(`laundromat washes ${cap}/day`);
  if (!BK.dropOff(w, 'laundromat', 10000).ok || dirtyOf(w) !== 0) bad('dropping off dirty cash');
  const bank0 = w.bank;
  BK.washDay(w);
  if (w.bank - bank0 !== Math.round(4000 * (1 - BK.WASH_CUT)) || w.wash.laundromat.queue !== 6000) bad(`wash at normal pace: +${w.bank - bank0}, ${w.wash.laundromat.queue} left`);
  if (w.feds.heat) bad('normal-pace washing should be quiet');
  BK.setRush(w, 'laundromat', true); BK.washDay(w);
  if (w.wash.laundromat.queue !== 0 || !(w.feds.heat > 0)) bad('rushing should finish the wash and raise attention');
  // feds cool off on quiet days
  const q = mk(); BK.ensureFeds(q).heat = 20; q.feds.quiet = 1; BK.fedsDay(q, () => 1);
  if (q.feds.heat !== 20 - BK.DECAY) bad('federal attention should cool off');
  // carrying a big stack draws attention
  const h = mk(); h.cash = 80000; h.dirty = 80000; BK.fedsDay(h, () => 1);
  if (!(h.feds.heat > 0)) bad('carrying a big dirty stack');
  // 100: indictment, felony warrant, account seized
  const i = mk(); i.bank = 50000; BK.ensureFeds(i).heat = 95; i.feds.proceeds = 40000;
  const ind = BK.bumpFeds(i, 10, 'test');
  if (!ind || !i.warrants.some(x => x.kind === 'launder_F3' && x.felony) || i.bank !== 30000) bad('indictment at 100');
  if (classify({ kind: 'launder_F3', text: 'x' }).cls !== 'F3' || BK.launderClass(5000) !== 'SJF' || BK.launderClass(400000) !== 'F1') bad('laundering classes');
  // arrested with a stack
  const a = mk(); a.cash = 6000; a.dirty = 5000;
  const sz = BK.seizeCash(a);
  if (sz.seized !== 5000 || a.cash !== 1000 || sz.items[0]?.kind !== 'launder_SJF') bad('seizing dirty cash at booking');
}
// ---- JPS hospital: injuries heal, bills go to collections, then garnishment ----
{
  const HL = await import('../js/core/health.js');
  if (!LOCATIONS.some(l => l.id === HL.HOSPITAL && l.type === 'hospital')) bad('JPS needs a door on the map');
  for (const cause of ['shot', 'crash']) for (const sev of [0, 0.5, 1]) {
    const c = HL.diagnose(cause, sev, () => 0.5);
    if (!c.kinds.length || c.kinds.some(k => !HL.INJURIES[k])) bad(`diagnose ${cause} ${sev}: unknown injury`);
    if (c.stayH < 6 || c.stayH > 60) bad(`diagnose ${cause} ${sev}: ${c.stayH} h stay`);
    if (c.total < 2000 || c.total > 15000) bad(`diagnose ${cause} ${sev}: bill ${c.total}`);
  }
  const st = createState({ name: 'H', age: 25, look: {}, story: false });
  st.cash = 0; st.bank = 900;
  const b = HL.admit(st, HL.diagnose('shot', 0.6, () => 0.1));
  const m = HL.healthMods(st);
  if (!(m.speed < 1 && m.noRun && m.cap < 100)) bad('a leg GSW should slow you down ' + JSON.stringify(m));
  if (b.status !== 'open' || b.balance !== b.total) bad('a new bill should be open for the full amount');
  // ignore it: past due, collections (+20%), sued, the bank account garnished; cash is safe
  const before = b.balance; st.cash = 300;
  const seen = [];
  for (let d = 0; d < 20; d++) { st.time.day++; HL.healthDay(st); seen.push(b.status); }
  for (const k of ['late', 'collections', 'judgment']) if (!seen.includes(k)) bad(`an ignored bill never went ${k}: ${seen.join(',')}`);
  if (st.bank !== 0 || st.cash !== 300) bad(`garnishment should empty the bank and leave cash (bank ${st.bank}, cash ${st.cash})`);
  if (b.balance !== Math.round(before * 1.2) + HL.SUIT_COSTS - 900) bad(`judgment balance ${b.balance}`);
  if (HL.followUp(st, st.health.injuries[0])) bad('the clinic should turn you away while the account is past due');
  // JPS Connection and a plan
  const st2 = createState({ name: 'H2', age: 25, look: {}, story: false });
  st2.cash = 400; st2.bank = 2000;
  const b2 = HL.admit(st2, HL.diagnose('crash', 0.3, () => 0.9));
  const full = b2.balance;
  if (!HL.applyConnection(st2, b2) || b2.balance !== Math.round(full * HL.CONNECTION_SHARE)) bad('JPS Connection should cut the bill to 10%');
  if (!HL.startPlan(st2, b2) || b2.status !== 'plan') bad('payment plan did not start');
  for (let d = 0; d < 7 * HL.PLAN_WEEKS + 1; d++) { st2.time.day++; HL.healthDay(st2); }
  if (b2.status !== 'paid') bad(`a plan you can afford should pay off the bill (${b2.status}, ${b2.balance} left)`);
  // healing
  const j = st2.health.injuries[0];
  if (!HL.followUp(st2, j) || !j.followUp) bad('follow-up visit failed');
  HL.heal(st2, 99999);
  if (HL.injured(st2) || HL.healthMods(st2).speed !== 1) bad('injuries should heal');
}
console.log(`${CARS.length} cars, ${CATALOG.length} products, ${new Set(CATALOG.map(p => p.brand)).size} brands, ${RACERS.length} racers — ${fails ? fails + ' problems' : 'all good'}`);
process.exit(fails ? 1 : 0);
