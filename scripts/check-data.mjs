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
import { SPRITE_CATS } from '../js/data/mustangParts.js';
import fs from 'fs';
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
// the Mustang's real part pictures: every picture exists, and every one can be bought
{
  const parts = JSON.parse(fs.readFileSync('assets/mustang/parts.json', 'utf8'));
  for (const name of ['body', 'bodyglass', 'bodypaint']) if (!parts[name] || !fs.existsSync(`assets/mustang/parts/${name}.png`)) bad(`missing picture ${name}`);
  const S650 = CAR_BY_ID.ford_mustang_gt_s650_2024, DH = CAR_BY_ID.ford_mustang_dark_horse_2024;
  const factory0 = new Set(['frontBumper', 'rearBumper', 'hood', 'roof', 'trunk', 'grille']);
  for (const [cat, def] of Object.entries(SPRITE_CATS)) {
    def.pics.forEach((name, i) => {
      if (!parts[name] || !fs.existsSync(`assets/mustang/parts/${name}.png`)) bad(`${cat}: missing picture ${name}`);
      const items = CATALOG.filter(p => p.cat === cat && p.design === i && fits(p, S650));
      if (!items.length && !(i === 0 && factory0.has(cat))) bad(`${cat} picture ${name} has no part to buy`);
      if (items.length && !CATALOG.some(p => p.cat === cat && p.design === i && fits(p, DH))) bad(`${cat} picture ${name} does not fit the Dark Horse`);
    });
  }
  // the new picture parts are Mustang-only
  const civic2 = CAR_BY_ID.honda_civic_ex_1996;
  if (CATALOG.some(p => ['mirrors', 'handles', 'emblem', 'roof', 'trunk', 'grille', 'plate'].includes(p.cat) && fits(p, civic2))) bad('Mustang picture parts should not fit a Civic');
}
console.log(`${CARS.length} cars, ${CATALOG.length} products, ${new Set(CATALOG.map(p => p.brand)).size} brands, ${RACERS.length} racers — ${fails ? fails + ' problems' : 'all good'}`);
process.exit(fails ? 1 : 0);
