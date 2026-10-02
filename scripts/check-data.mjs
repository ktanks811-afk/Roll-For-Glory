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
console.log(`${CARS.length} cars, ${CATALOG.length} products, ${new Set(CATALOG.map(p => p.brand)).size} brands, ${RACERS.length} racers — ${fails ? fails + ' problems' : 'all good'}`);
process.exit(fails ? 1 : 0);
