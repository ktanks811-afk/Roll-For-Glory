// Owning boats: buying, selling, what customizing costs, hauling between
// marinas, slip fees, crew, charters and yacht parties. Catalog and options
// are data/boats.js; driving one is world2d/boats.js; screens are ui/marina.js.

import { BOATS, BOAT_BY_ID, MARINA_BY_ID, FINISHES, WRAPS, DECKS, INTERIORS, ENGINES, DRIVES, AMENITY_BY_ID, CREW, HORNS, SOUND, defaultCustom, isBig, ft } from '../data/boats.js';
import { uid, addRep, addFollowers } from './state.js';

export function ensureBoats(s) {
  if (!s.boats || Array.isArray(s.boats)) s.boats = { fleet: [], partyDay: 0 };
  for (const b of s.boats.fleet) b.custom = { ...defaultCustom(BOAT_BY_ID[b.id]), ...b.custom };
  return s.boats;
}
export const fleet = s => ensureBoats(s).fleet.filter(b => BOAT_BY_ID[b.id]);
export const defOf = b => BOAT_BY_ID[b.id];
export const boatName = b => b.custom?.name ? `"${b.custom.name}"` : defOf(b).name;
export const canBerth = (def, marina) => !isBig(def) || !!marina?.deep;

// ---------------------------------------------------------------- what it costs
const byId = (list, id) => list.find(x => x.id === id) || list[0];
// Every line of a change from one look to another: [{ label, cost }]
export function customLines(def, a, b) {
  const area = def.L * def.W, L = def.L, out = [];
  const add = (label, cost) => { if (cost > 0) out.push({ label, cost: Math.round(cost / 10) * 10 }); };
  if (a.hull !== b.hull || a.finish !== b.finish) add(`Paint: ${byId(FINISHES, b.finish).name.toLowerCase()} hull`, 250 + area * (55 + byId(FINISHES, b.finish).per));
  if (a.wrap !== b.wrap || (b.wrap !== 'none' && (a.stripe !== b.stripe || a.hull2 !== b.hull2))) add(`Graphics: ${byId(WRAPS, b.wrap).name.toLowerCase()}`, b.wrap === 'none' ? 150 + area * 6 : 150 + area * byId(WRAPS, b.wrap).per);
  if (a.sup !== b.sup) add('Superstructure paint', 200 + area * 25);
  if (a.deck !== b.deck) add(`Decking: ${byId(DECKS, b.deck).name.toLowerCase()}`, 300 + area * (20 + 0.6 * byId(DECKS, b.deck).per));
  if (a.tint !== b.tint) add('Window tint', 200 + area * 8);
  if (a.interior !== b.interior) add(`Interior: ${byId(INTERIORS, b.interior).name.toLowerCase()}`, 500 + area * (30 + byId(INTERIORS, b.interior).per));
  if (a.uph !== b.uph) add('Upholstery', 300 + area * 15);
  if (a.under !== b.under) add('Underwater lights', b.under === 'none' ? 0 : 800 + L * 120);
  if (a.accent !== b.accent) add('Deck LED strips', b.accent === 'none' ? 0 : 500 + L * 90);
  if (a.name !== b.name || a.port !== b.port || a.font !== b.font || a.nameColor !== b.nameColor) add('Lettering: name and hailing port', 350 + L * 30);
  if (a.flag !== b.flag) add('Flag', 80);
  if (a.horn !== b.horn) add(`Horn: ${byId(HORNS, b.horn).name.toLowerCase()}`, byId(HORNS, b.horn).price);
  if (a.sound !== b.sound) add(`Sound: ${byId(SOUND, b.sound).name}`, byId(SOUND, b.sound).price * Math.max(1, L / 10));
  if (b.engine > a.engine) add(`Engines: ${ENGINES[b.engine].name.toLowerCase()}`, def.price * (ENGINES[b.engine].cost - ENGINES[a.engine].cost));
  if (b.engine < a.engine) add('Engines back to a lower stage', 400 + L * 50);
  if (a.drive !== b.drive) add(`Drive: ${byId(DRIVES, b.drive).name.toLowerCase()}`, def.price * byId(DRIVES, b.drive).cost);
  for (const id of b.amen) if (!a.amen.includes(id)) add(AMENITY_BY_ID[id].name, AMENITY_BY_ID[id].price);
  return out;
}
export const customCost = (def, a, b) => customLines(def, a, b).reduce((t, l) => t + l.cost, 0);

export function applyCustom(s, boat, next, spend) {
  const def = defOf(boat), cost = customCost(def, boat.custom, next);
  if (cost > 0 && !spend(s, cost, `Boat work: ${boatName(boat)}`)) return { ok: false, text: 'You\'re short for that.' };
  boat.custom = JSON.parse(JSON.stringify(next));
  boat.spent = (boat.spent || 0) + cost;
  return { ok: true, cost };
}

// ---------------------------------------------------------------- how it runs
export function boatSpec(boat) {
  const def = defOf(boat), c = boat.custom, e = ENGINES[c.engine] || ENGINES[0], d = byId(DRIVES, c.drive);
  const cond = Math.max(0.55, (boat.cond ?? 100) / 100);
  return { L: def.L, W: def.W, kind: def.kind, top: def.top * e.top * (0.7 + 0.3 * cond), accel: def.accel * e.accel, turn: def.turn * d.turn };
}
export function luxScore(boat) {
  const def = defOf(boat), c = boat.custom;
  let n = Math.round(def.L / 3) + (byId(INTERIORS, c.interior).lux || 0) + (byId(SOUND, c.sound).lux || 0);
  for (const id of c.amen) n += AMENITY_BY_ID[id]?.lux || 0;
  for (const id of c.crew) n += CREW.find(x => x.id === id)?.lux || 0;
  if (c.under !== 'none') n += 2;
  if (c.finish === 'chrome') n += 4;
  return n;
}

// ---------------------------------------------------------------- buying and selling
export function buyBoat(s, id, marinaId, spend) {
  const def = BOAT_BY_ID[id], m = MARINA_BY_ID[marinaId];
  if (!def || !m) return { ok: false, text: 'Not for sale here.' };
  if (!canBerth(def, m)) return { ok: false, text: `The ${def.name} is ${ft(def.L)} ft. ${m.name} can't take boats over 80 ft. Buy it at a deep-water marina.` };
  if (!spend(s, def.price, `Boat: ${def.name}`)) return { ok: false, text: 'You\'re short for that.' };
  const b = { uid: uid('boat'), id, custom: defaultCustom(def), marina: marinaId, cond: 100, hours: 0, paid: def.price, spent: 0, day: s.time?.day ?? 1, owed: 0, charter: false };
  ensureBoats(s).fleet.push(b);
  addFollowers(s, Math.round(Math.min(20000, Math.sqrt(def.price) * 2)));
  return { ok: true, boat: b };
}
// Boats lose value with hours on them; half of what you spent dressing it up comes back.
export function resaleOf(s, b) {
  const def = defOf(b), age = Math.max(0, (s.time?.day ?? 1) - (b.day ?? 1));
  const dep = Math.max(0.45, 0.82 - age * 0.0015 - (b.hours || 0) * 0.002);
  return Math.round((def.price * dep * Math.max(0.6, (b.cond ?? 100) / 100) + (b.spent || 0) * 0.45) / 100) * 100;
}
export function sellBoat(s, buid, earn) {
  const B = ensureBoats(s), i = B.fleet.findIndex(b => b.uid === buid);
  if (i < 0) return { ok: false, text: 'Not your boat.' };
  const b = B.fleet[i], paid = resaleOf(s, b) - (b.owed || 0);
  B.fleet.splice(i, 1);
  earn(s, paid, `Sold boat: ${boatName(b)}`);
  return { ok: true, paid };
}

// Hauling it to another marina: on a trailer for small boats, a heavy-haul
// crew for big ones, a ship for anything going to or from Miami.
export function haulQuote(b, toId) {
  const def = defOf(b), from = MARINA_BY_ID[b.marina], to = MARINA_BY_ID[toId];
  if (!to || to.id === b.marina) return null;
  if (!canBerth(def, to)) return { block: `${to.name} can't take a boat this big.` };
  const sea = (from?.state || 'tx') !== (to.state || 'tx');
  const fee = Math.round((def.L < 9 ? 450 + def.L * 60 : 800 + def.L * def.L * 60) * (sea ? 4 : 1) / 10) * 10;
  return { fee, days: sea ? 2 : def.L < 9 ? 0 : 1 };
}
export function haulBoat(s, b, toId, spend) {
  const q = haulQuote(b, toId);
  if (!q || q.block) return { ok: false, text: q?.block || 'Already there.' };
  if (!spend(s, q.fee, `Boat haul: ${boatName(b)}`)) return { ok: false, text: 'You\'re short for that.' };
  b.marina = toId;
  b.ready = (s.time?.day ?? 1) + q.days;
  return { ok: true, fee: q.fee, days: q.days };
}

// Why you can't take it out right now, or null.
export function launchBlock(s, b) {
  if (b.charter) return 'It\'s out on charter. Take it off charter first.';
  if ((b.owed || 0) > 0) return `The marina is holding it for ${b.owed.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in slip fees.`;
  if (b.ready && b.ready > (s.time?.day ?? 1)) return 'It\'s still on the truck. It gets here tomorrow.';
  if ((b.cond ?? 100) < 25) return 'It\'s too beat up to run. Get it repaired first.';
  return null;
}
export const repairCost = b => Math.round((100 - (b.cond ?? 100)) * defOf(b).price * 0.0012 / 10) * 10;

// ---------------------------------------------------------------- every morning
// Slip fees (per foot, more at the deep-water clubs and in Miami), crew wages
// and charter income.
export function slipFee(b) {
  const m = MARINA_BY_ID[b.marina], def = defOf(b);
  return Math.round(ft(def.L) * (m?.state === 'fl' ? 9 : m?.deep ? 5 : 3));
}
export const crewWages = b => (b.custom.crew || []).reduce((t, id) => t + (CREW.find(c => c.id === id)?.wage || 0), 0);
export const charterRate = (s, b) => Math.round(resaleOf(s, b) * 0.0011 * (1 + luxScore(b) / 60) * (b.custom.crew.includes('captain') ? 1 : 0.6));

export function boatsDay(s, spend, earn) {
  const notes = [];
  if (!s.boats?.fleet?.length) return { notes };
  let fees = 0, income = 0;
  for (const b of fleet(s)) {
    const due = slipFee(b) + crewWages(b) + (b.owed || 0);
    if (spend(s, due, `Marina: ${boatName(b)}`)) { fees += due; b.owed = 0; } else b.owed = due;
    if (b.charter) { const r = charterRate(s, b); earn(s, r, `Charter: ${boatName(b)}`); income += r; b.hours = (b.hours || 0) + 6; b.cond = Math.max(40, (b.cond ?? 100) - 0.6); }
  }
  const fm = n => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  if (income) notes.push(`⚓ Charters paid ${fm(income)}. Marinas and crew: ${fm(fees)}.`);
  else if (fees > 5000) notes.push(`⚓ Marinas and crew: ${fm(fees)}.`);
  if (fleet(s).some(b => b.owed)) notes.push('⚓ A marina is holding one of your boats for unpaid slip fees.');
  return { notes };
}

// ---------------------------------------------------------------- yacht party
export function partyQuote(b) {
  const def = defOf(b), lux = luxScore(b);
  return { cost: Math.round((2000 + def.L * def.L * 25 + lux * 1500) / 100) * 100, followers: Math.round(80 + lux * def.L * 6), rep: Math.round(20 + lux * 3 + def.L) };
}
export function throwParty(s, b, spend) {
  const B = ensureBoats(s), day = s.time?.day ?? 1;
  if (B.partyDay === day) return { ok: false, text: 'You already threw one today. Let the boat dry out.' };
  const q = partyQuote(b);
  if (!spend(s, q.cost, `Yacht party: ${boatName(b)}`)) return { ok: false, text: 'You\'re short for that.' };
  B.partyDay = day;
  addFollowers(s, q.followers);
  addRep(s, q.rep, 'Yacht party');
  b.cond = Math.max(30, (b.cond ?? 100) - 2);
  return { ok: true, ...q };
}

export { BOATS };
