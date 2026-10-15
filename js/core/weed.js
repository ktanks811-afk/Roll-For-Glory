// The legal weed business in Colorado (data/weed.js). Buy a grow farm, put
// clones in, and harvest ounces a few game days later into the farm's vault.
// Buy a dispensary, keep its shelf stocked (from your own farms, or from the
// wholesale distributor), set your prices and staff it with budtenders, and
// every morning the day's sales settle into your bank, after the 15% tax.
//
// It's legal in Colorado, so the money is clean. Carry it home to Texas and
// it's loud in your bag like any other product (core/drugs.js).
//
// s.weed = { farms: { id: farm }, shops: { id: shop }, sold, earned, harvested }
// farm: { crop: { strain, plants, planted, ready } | null, vault: { strain: oz }, grower, last }
// shop: { shelf: { strain: oz }, level, staff, supply, today: { customers, oz, gross, net } }
// DOM-free so scripts/check-data.mjs can test it.

import { spend, earnBank, fmtMoney } from './state.js';
import { ensureDrugs } from './drugs.js';
import { STRAIN_BY_ID, FARMS, SHOPS, OZ_PER_CUSTOMER, BUDTENDER, TAX, DISTRIBUTOR_MARKUP, SELL_BACK, LEVEL_BY_ID } from '../data/weed.js';

const err = text => ({ ok: false, text });
const r1 = n => Math.round(n * 10) / 10;
export const ozText = n => `${r1(n).toLocaleString()} oz`;

export function ensureWeed(s) {
  s.weed ??= {};
  const w = s.weed;
  w.farms ??= {};
  w.shops ??= {};
  w.sold ??= 0;        // ounces sold over the counter, all time
  w.earned ??= 0;      // dispensary profit, all time
  w.harvested ??= 0;   // ounces harvested, all time
  return w;
}
export const ownsFarm = (s, id) => !!ensureWeed(s).farms[id];
export const ownsShop = (s, id) => !!ensureWeed(s).shops[id];
export const myFarms = s => Object.keys(ensureWeed(s).farms).filter(id => FARMS[id]);
export const myShops = s => Object.keys(ensureWeed(s).shops).filter(id => SHOPS[id]);
export const total = jar => Object.values(jar || {}).reduce((t, n) => t + (n || 0), 0);
const add = (jar, id, oz) => { jar[id] = r1((jar[id] || 0) + oz); if (jar[id] <= 0) delete jar[id]; };

// ---------------------------------------------------------------- buying and selling the businesses
export function buyFarm(s, id) {
  const f = FARMS[id];
  if (!f) return err('That isn\'t for sale.');
  if (ownsFarm(s, id)) return err('You already own it.');
  if (!spend(s, f.price, `Bought ${f.name}`)) return err(`It's ${fmtMoney(f.price)}. You're short.`);
  ensureWeed(s).farms[id] = { crop: null, vault: {}, grower: false, last: null };
  return { ok: true, text: `${f.name} is yours. Put some clones in.` };
}
export function sellFarm(s, id) {
  const w = ensureWeed(s), f = FARMS[id], farm = w.farms[id];
  if (!farm) return err('You don\'t own it.');
  const pay = Math.round(f.price * SELL_BACK);
  delete w.farms[id];
  earnBank(s, pay, `Sold ${f.name}`);
  return { ok: true, text: `Sold for ${fmtMoney(pay)}.${total(farm.vault) ? ' The new owner kept what was in the vault.' : ''}`, pay };
}
export function buyShop(s, id) {
  const d = SHOPS[id];
  if (!d) return err('That isn\'t for sale.');
  if (ownsShop(s, id)) return err('You already own it.');
  if (!spend(s, d.price, `Bought ${d.name}`)) return err(`It's ${fmtMoney(d.price)}. You're short.`);
  ensureWeed(s).shops[id] = { shelf: {}, level: 'fair', staff: staffNeeded(id, 'fair'), supply: true, today: null };
  return { ok: true, text: `${d.name} is yours. Stock the shelf and open the doors.` };
}
export function sellShop(s, id) {
  const w = ensureWeed(s), d = SHOPS[id];
  if (!w.shops[id]) return err('You don\'t own it.');
  const pay = Math.round(d.price * SELL_BACK);
  delete w.shops[id];
  earnBank(s, pay, `Sold ${d.name}`);
  return { ok: true, text: `Sold for ${fmtMoney(pay)}.`, pay };
}

// ---------------------------------------------------------------- growing
export const growDays = (farmId, strainId) => Math.ceil(STRAIN_BY_ID[strainId].days * FARMS[farmId].speed);
export const cloneCost = (strainId, plants) => STRAIN_BY_ID[strainId].clone * plants;
// what a full harvest should come to (before the luck of the grow)
export const expectedYield = (farmId, strainId, plants) => r1(plants * STRAIN_BY_ID[strainId].yield * FARMS[farmId].quality);

export function plant(s, farmId, strainId, plants = FARMS[farmId]?.plants) {
  const farm = ensureWeed(s).farms[farmId], f = FARMS[farmId], g = STRAIN_BY_ID[strainId];
  if (!farm) return err('You don\'t own that farm.');
  if (!g) return err('Pick a strain.');
  if (farm.crop) return err('There\'s already a crop in. Harvest it first.');
  plants = Math.max(1, Math.min(f.plants, Math.round(plants)));
  const cost = cloneCost(strainId, plants);
  if (!spend(s, cost, `${f.name}: ${plants} ${g.name} clones`)) return err(`${plants} clones is ${fmtMoney(cost)}. You're short.`);
  const day = s.time.day;
  farm.crop = { strain: strainId, plants, planted: day, ready: day + growDays(farmId, strainId) };
  return { ok: true, text: `${plants} ${g.name} in. Ready to harvest on day ${farm.crop.ready}.`, cost };
}
export const isReady = (s, farmId) => { const c = ensureWeed(s).farms[farmId]?.crop; return !!c && s.time.day >= c.ready; };
// 0..1, how far along the crop is
export function growth(s, farmId) {
  const c = ensureWeed(s).farms[farmId]?.crop;
  if (!c) return 0;
  return Math.max(0, Math.min(1, (s.time.day - c.planted + (s.time.min % 1440) / 1440) / Math.max(1, c.ready - c.planted)));
}

export function harvest(s, farmId, rng = Math.random) {
  const w = ensureWeed(s), farm = w.farms[farmId];
  if (!farm?.crop) return err('Nothing planted.');
  if (s.time.day < farm.crop.ready) return err(`Not ready yet. Day ${farm.crop.ready}.`);
  const c = farm.crop, oz = r1(expectedYield(farmId, c.strain, c.plants) * (0.85 + rng() * 0.3) * (c.hail ? 1 - c.hail : 1));
  add(farm.vault, c.strain, oz);
  w.harvested = r1(w.harvested + oz);
  farm.last = { strain: c.strain, plants: c.plants, oz, day: s.time.day };
  farm.crop = null;
  return { ok: true, text: `Harvested ${ozText(oz)} of ${STRAIN_BY_ID[c.strain].name}. It's drying in the vault.`, oz, strain: c.strain };
}

// Sell what's in the vault to a licensed processor, at the wholesale price.
export function sellWholesale(s, farmId, strainId = null) {
  const farm = ensureWeed(s).farms[farmId];
  if (!farm) return err('You don\'t own that farm.');
  let oz = 0, pay = 0;
  for (const [id, q] of Object.entries(farm.vault)) {
    if (strainId && id !== strainId) continue;
    oz += q; pay += q * STRAIN_BY_ID[id].wholesale;
    delete farm.vault[id];
  }
  if (!oz) return err('The vault is empty.');
  earnBank(s, Math.round(pay), `${FARMS[farmId].name}: wholesale to a processor`);
  return { ok: true, text: `A processor took ${ozText(oz)} for ${fmtMoney(Math.round(pay))}.`, pay: Math.round(pay), oz };
}

// Take some out of the vault and into your bag. It's loud now: legal in
// Colorado (up to data/weed.js LEGAL_OZ), a charge anywhere else.
export function takeToBag(s, farmId, oz = 1) {
  const farm = ensureWeed(s).farms[farmId];
  if (!farm) return err('You don\'t own that farm.');
  let left = Math.floor(oz), took = 0;
  for (const id of Object.keys(farm.vault).sort((a, b) => STRAIN_BY_ID[a].wholesale - STRAIN_BY_ID[b].wholesale)) {
    const n = Math.min(left, Math.floor(farm.vault[id]));
    if (n < 1) continue;
    add(farm.vault, id, -n); left -= n; took += n;
    if (!left) break;
  }
  if (!took) return err('Not a whole ounce in the vault.');
  const bag = ensureDrugs(s).bag;
  bag.loud = (bag.loud || 0) + took;
  return { ok: true, text: `${took} oz in your bag. Legal here. In Texas, that's loud, and that's a charge.`, oz: took };
}

// Grower: harvests the moment the crop is ready and puts the same strain right back in.
export function setGrower(s, farmId, on) {
  const farm = ensureWeed(s).farms[farmId];
  if (!farm) return err('You don\'t own that farm.');
  farm.grower = !!on;
  return { ok: true, text: on ? `Hired a head grower for ${fmtMoney(FARMS[farmId].wage)} a day. He harvests and replants on his own.` : 'You let the grower go.' };
}

// ---------------------------------------------------------------- the dispensary
export const shopOf = (s, id) => ensureWeed(s).shops[id];
export const level = shop => LEVEL_BY_ID[shop?.level] || LEVEL_BY_ID.fair;
export const traffic = (id, lvl = 'fair') => Math.round(SHOPS[id].traffic * (LEVEL_BY_ID[lvl] || LEVEL_BY_ID.fair).traffic);
export const staffNeeded = (id, lvl = 'fair') => Math.ceil(traffic(id, lvl) / BUDTENDER.serves);
export const demandOz = (id, lvl = 'fair') => r1(traffic(id, lvl) * OZ_PER_CUSTOMER);
export const shelfPrice = (id, strainId, lvl = 'fair') => Math.round(STRAIN_BY_ID[strainId].retail * SHOPS[id].spend * (LEVEL_BY_ID[lvl] || LEVEL_BY_ID.fair).price);
export const distributorPrice = strainId => Math.round(STRAIN_BY_ID[strainId].wholesale * DISTRIBUTOR_MARKUP);

export function setLevel(s, id, lvl) {
  const shop = shopOf(s, id);
  if (!shop || !LEVEL_BY_ID[lvl]) return err('No.');
  shop.level = lvl;
  return { ok: true, text: `Prices set to ${LEVEL_BY_ID[lvl].name}.` };
}
export function setStaff(s, id, n) {
  const shop = shopOf(s, id);
  if (!shop) return err('You don\'t own it.');
  shop.staff = Math.max(0, Math.min(20, Math.round(n)));
  return { ok: true, text: `${shop.staff} budtender${shop.staff === 1 ? '' : 's'} on the schedule.` };
}
export function setSupply(s, id, on) {
  const shop = shopOf(s, id);
  if (!shop) return err('You don\'t own it.');
  shop.supply = !!on;
  return { ok: true, text: on ? 'Your farms keep this shelf stocked every morning.' : 'You\'ll stock this shelf yourself.' };
}

// Buy from the wholesale distributor straight onto the shelf.
export function buyStock(s, id, strainId, oz) {
  const shop = shopOf(s, id), g = STRAIN_BY_ID[strainId];
  if (!shop || !g) return err('No.');
  oz = Math.max(1, Math.round(oz));
  const cost = distributorPrice(strainId) * oz;
  if (!spend(s, cost, `${SHOPS[id].name}: ${oz} oz ${g.name} from the distributor`)) return err(`${oz} oz is ${fmtMoney(cost)}. You're short.`);
  add(shop.shelf, strainId, oz);
  return { ok: true, text: `${oz} oz of ${g.name} on the shelf.`, cost };
}

// Move what your farms have in their vaults onto a shop's shelf, up to `want` oz.
export function restockFromFarms(s, id, want = Infinity) {
  const shop = shopOf(s, id);
  if (!shop) return err('You don\'t own it.');
  let moved = 0;
  for (const fid of myFarms(s)) {
    const v = ensureWeed(s).farms[fid].vault;
    // the good stuff goes on the shelf first
    for (const sid of Object.keys(v).sort((a, b) => STRAIN_BY_ID[b].retail - STRAIN_BY_ID[a].retail)) {
      const n = r1(Math.min(v[sid], want - moved));
      if (n <= 0) continue;
      add(v, sid, -n); add(shop.shelf, sid, n); moved = r1(moved + n);
    }
    if (moved >= want) break;
  }
  if (!moved) return err('Your farm vaults are empty.');
  return { ok: true, text: `${ozText(moved)} from your farms onto the shelf.`, oz: moved };
}

// One day of business. Customers come in at the level's traffic, as many as
// your budtenders can serve, and buy what's on the shelf (they want the
// good jars first). Returns the day's numbers; the money isn't paid here.
export function sellDay(s, id, rng = Math.random) {
  const shop = shopOf(s, id), d = SHOPS[id], lvl = level(shop);
  const want = Math.round(traffic(id, shop.level) * (0.85 + rng() * 0.3));
  const served = Math.min(want, shop.staff * BUDTENDER.serves);
  let need = r1(served * OZ_PER_CUSTOMER), oz = 0, gross = 0;
  const jars = Object.keys(shop.shelf).sort((a, b) => STRAIN_BY_ID[b].retail - STRAIN_BY_ID[a].retail);
  // half the crowd wants the top jar, the rest spreads down the shelf
  for (const sid of jars) {
    if (need <= 0) break;
    const n = r1(Math.min(shop.shelf[sid], sid === jars[jars.length - 1] ? need : Math.max(need * 0.5, 0.1)));
    if (n <= 0) continue;
    add(shop.shelf, sid, -n); need = r1(need - n); oz = r1(oz + n);
    gross += n * shelfPrice(id, sid, shop.level);
  }
  // still short? take whatever's left on the shelf
  for (const sid of Object.keys(shop.shelf)) {
    if (need <= 0) break;
    const n = r1(Math.min(shop.shelf[sid], need));
    add(shop.shelf, sid, -n); need = r1(need - n); oz = r1(oz + n);
    gross += n * shelfPrice(id, sid, shop.level);
  }
  const customers = oz ? Math.min(served, Math.round(oz / OZ_PER_CUSTOMER)) : 0;
  const tax = Math.round(gross * TAX), payroll = shop.staff * BUDTENDER.pay;
  const net = Math.round(gross - tax - payroll - d.rent);
  return { customers, walked: Math.max(0, want - customers), oz, gross: Math.round(gross), tax, payroll, rent: d.rent, net, level: lvl.id };
}

// ---------------------------------------------------------------- every game day
// Farms pay their upkeep and growers, growers harvest and replant, hail hits
// the outdoor fields, your shops restock from your farms and sell.
// Returns { notes, net } (net: the shops' profit, already in the bank).
export function weedDay(s, rng = Math.random) {
  const w = ensureWeed(s), notes = [];
  let cost = 0;
  for (const id of myFarms(s)) {
    const f = FARMS[id], farm = w.farms[id];
    cost += f.upkeep + (farm.grower ? f.wage : 0);
    if (farm.crop && f.storm && !farm.crop.hail && s.time.day < farm.crop.ready && rng() < f.storm[0]) {
      farm.crop.hail = f.storm[1];
      notes.push(`🌨 A hailstorm went through ${f.name}. About ${Math.round(f.storm[1] * 100)}% of the crop is gone.`);
    }
    if (farm.crop && isReady(s, id)) {
      if (farm.grower) {
        const h = harvest(s, id, rng), again = h.strain;
        const re = plant(s, id, again, farm.last.plants);
        notes.push(`🌿 ${f.name}: your grower harvested ${ozText(h.oz)} of ${STRAIN_BY_ID[again].name}${re.ok ? ' and put the next crop in' : `, but couldn't pay for the next clones`}.`);
      } else notes.push(`🌿 ${f.name}: the ${STRAIN_BY_ID[farm.crop.strain].name} is ready to harvest.`);
    }
  }
  if (cost) spend(s, cost, 'Grow farms: power, water, licenses and growers') || earnBank(s, -cost, 'Grow farms: upkeep (overdrawn)');
  let net = 0, oz = 0, customers = 0, empty = [];
  for (const id of myShops(s)) {
    const shop = w.shops[id];
    if (shop.supply) restockFromFarms(s, id, Math.max(0, demandOz(id, shop.level) * 2 - total(shop.shelf)));
    const r = sellDay(s, id, rng);
    shop.today = { ...r, day: s.time.day };
    net += r.net; oz = r1(oz + r.oz); customers += r.customers;
    if (!total(shop.shelf)) empty.push(SHOPS[id].name);
  }
  if (myShops(s).length) {
    w.sold = r1(w.sold + oz); w.earned += net;
    if (net > 0) earnBank(s, net, 'Dispensaries: sales, less tax, payroll and rent');
    else if (net < 0) spend(s, -net, 'Dispensaries: payroll and rent') || earnBank(s, net, 'Dispensaries: payroll and rent (overdrawn)');
    notes.push(`🌿 Your dispensaries served ${customers.toLocaleString()} customers, ${ozText(oz)}: ${net >= 0 ? fmtMoney(net) + ' profit' : 'a ' + fmtMoney(-net) + ' loss'} after tax, payroll and rent.`);
    if (empty.length) notes.push(`🫙 Empty shelves at ${empty.join(', ')}. Restock or plant more.`);
  }
  return { notes, net };
}

