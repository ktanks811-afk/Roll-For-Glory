// Stolen goods you carry around. Save key `s.loot`:
// [{ uid, id, name, value, hot: true, from, day }]. Store robberies, muggings
// and stolen cars hand them out; Cash Cow Pawn & Gold buys them two ways:
// the counter (better money, but they run serial numbers and a hot item gets
// flagged to FWPD) or Dre, the fence in the back (never flags anything, pays
// less, and pays even less when the cops are looking for you). Get busted
// with it on you and it's seized, and you're charged with theft by the total
// value (seizeLoot), the same way drugs in your bag are (core/drugs.js seizeBag).
// DOM-free so check-data can test it.

import { uid } from './state.js';
import { LOOT_BY_ID, STORE_LOOT, STREET_LOOT, PAWN } from '../data/loot.js';
import { WEAPON_BY_ID, ensureArms } from '../data/weapons.js';
import { addWarrant } from './warrants.js';

export const FENCE_RATE = PAWN.fence;     // what the fence pays on the dollar with no heat on you

export function ensureLoot(s) {
  if (!Array.isArray(s.loot)) s.loot = Array.isArray(s.loot?.items) ? s.loot.items : [];   // { items } shape from an early pawn-shop build
  return s.loot;
}

// from: where it came from (a store's name, 'a mugging'...). opts.value overrides the price.
export function addLoot(s, id, from = '', opts = {}) {
  const def = LOOT_BY_ID[id];
  if (!def) return null;
  const item = { uid: uid('loot'), id, name: def.name, value: Math.round(opts.value ?? def.value), hot: true, from, day: s.time?.day ?? 0 };
  ensureLoot(s).push(item);
  return item;
}

export const lootValue = item => Math.max(0, Math.round(item?.value || 0));
export const lootTotal = s => ensureLoot(s).reduce((t, i) => t + lootValue(i), 0);
export const lootKind = item => LOOT_BY_ID[item?.id]?.kind || 'other';
export const lootNames = items => items.map(i => i.name).join(', ');

// Sell some (uids) or all (no uids) of it. Returns the cash paid.
export function sellLoot(s, uids = null, rate = FENCE_RATE) {
  const list = ensureLoot(s);
  const pick = uids ? list.filter(i => uids.includes(i.uid)) : list.slice();
  if (!pick.length) return 0;
  const paid = Math.round(pick.reduce((t, i) => t + lootValue(i), 0) * rate);
  s.loot = list.filter(i => !pick.includes(i));
  s.cash += paid; s.dirty = (s.dirty || 0) + paid;   // fenced goods pay in dirty cash (core/bank.js)
  return paid;
}

const pickFrom = (table, rng) => {
  const total = table.reduce((t, [, w]) => t + w, 0);
  let r = rng() * total;
  for (const [id, w] of table) { r -= w; if (r <= 0) return id; }
  return table[table.length - 1][0];
};

// Roll what you grab from behind the counter: n items from that store's shelf.
export function rollLoot(type, n, rng = Math.random) {
  const table = STORE_LOOT[type];
  if (!table || n <= 0) return [];
  const out = [];
  for (let k = 0; k < n; k++) out.push(pickFrom(table, rng));
  return out;
}

// Off a person you mug ('mug') or out of a car you steal ('car'): maybe
// nothing, maybe a couple of things. Adds and returns the items.
export function grabLoot(s, source, from = '', rng = Math.random) {
  const src = STREET_LOOT[source];
  if (!src || rng() > src.chance) return [];
  const n = 1 + Math.floor(rng() * src.max), out = [];
  for (let k = 0; k < n; k++) {
    const id = pickFrom(src.table, rng);
    out.push(addLoot(s, id, from, { value: LOOT_BY_ID[id].value * (0.75 + rng() * 0.5) }));   // condition and model year vary
  }
  return out;
}

// Texas Penal Code 31.03: theft (including holding goods you know are stolen)
// is graded by value.
export function theftClass(value) {
  if (value >= 30000) return 'F3';
  if (value >= 2500) return 'SJF';
  if (value >= 750) return 'A';
  if (value >= 100) return 'B';
  return 'C';
}

const goodsOffence = (items, text) => {
  const value = items.reduce((t, i) => t + lootValue(i), 0);
  const guns = items.filter(i => lootKind(i) === 'gun').length;
  return { kind: 'stolen_goods', text, value, guns, fine: Math.max(150, Math.round(value * 0.5)) };
};

// The police search you at booking: the goods go into evidence, and you get
// a record item for justice.classify ('stolen_goods').
export function seizeLoot(s) {
  const list = ensureLoot(s);
  if (!list.length) return [];
  s.loot = [];
  return [goodsOffence(list, `Stolen goods on you (${list.length} item${list.length > 1 ? 's' : ''}).`)];
}

// ---------------------------------------------------------------- the pawn shop

// How hot an item still is: 1 the day you took it, cooling to 0.2 after a
// week (the report is still in the system, just nobody is looking for it).
export function hotness(s, item) {
  const age = Math.max(0, (s.time?.day ?? 1) - (item.day ?? 0));
  return Math.max(0.2, 1 - (age / PAWN.coolDays) * 0.8);
}

// Chance the counter's serial check flags this item to the police.
export function flagChance(s, item) {
  return Math.min(0.9, (LOOT_BY_ID[item.id]?.serial ?? 0.5) * hotness(s, item) * 0.85);
}

export const counterOffer = item => Math.round(lootValue(item) * PAWN.counter);

// The fence's share of street value at this police heat, or null when he
// won't deal with you at all.
export function fenceShare(s, heat = s.heat || 0) {
  if (heat >= PAWN.fenceRefuse) return null;
  const warrants = (s.warrants || []).length;
  return Math.max(PAWN.fenceMin, PAWN.fence - Math.floor(heat) * PAWN.fenceHeatCut - Math.min(3, warrants) * PAWN.fenceWarrantCut);
}
export function fenceOffer(s, item, heat) {
  const share = fenceShare(s, heat);
  return share == null ? 0 : Math.round(lootValue(item) * share);
}

// Sell items to Dre. earn(s, amount, label) is passed in (state.earn).
// Returns { ok, paid, items, text }.
export function sellToFence(s, uids, earn, heat) {
  const share = fenceShare(s, heat);
  if (share == null) return { ok: false, paid: 0, items: [], text: 'Dre won\'t touch you right now. "You hot. Come back when they stop looking for you."' };
  const list = ensureLoot(s), items = list.filter(i => uids.includes(i.uid));
  if (!items.length) return { ok: false, paid: 0, items, text: 'Nothing to sell.' };
  s.loot = list.filter(i => !items.includes(i));
  const paid = items.reduce((t, i) => t + Math.round(lootValue(i) * share), 0);
  earn(s, paid, `Fenced ${items.length === 1 ? items[0].name : items.length + ' items'}`, { dirty: true });
  return { ok: true, paid, items, text: '' };
}

// Pawn one item over the counter. They run the serial while you wait: if it
// comes back stolen they keep it, call it in, and a warrant goes out.
// Returns { ok, flagged, paid, item, warrant }.
export function pawnItem(s, itemUid, earn, rng = Math.random) {
  const list = ensureLoot(s), item = list.find(i => i.uid === itemUid);
  if (!item) return { ok: false, flagged: false, paid: 0, item: null };
  const flagged = rng() < flagChance(s, item);
  s.loot = list.filter(i => i !== item);
  if (flagged) {
    const off = goodsOffence([item], `Stolen property pawned at Cash Cow Pawn (${item.name}).`);
    const warrant = addWarrant(s, { kind: 'stolen_goods', text: off.text, fine: off.fine, value: off.value, guns: off.guns, felony: off.value >= 2500 || off.guns > 0, evidence: `Serial number hit at Cash Cow Pawn: ${item.name}` });
    return { ok: true, flagged: true, paid: 0, item, warrant };
  }
  const paid = counterOffer(item);
  earn(s, paid, `Pawned ${item.name}`, { dirty: true });
  return { ok: true, flagged: false, paid, item };
}

// Your own guns: the counter buys them legally (paperwork, no questions).
export function ownGunOffer(g) {
  const def = WEAPON_BY_ID[g?.id];
  return def && !g.frt ? Math.round(def.price * PAWN.ownGun) : 0;
}
export function sellOwnGun(s, gunUid, earn) {
  const a = ensureArms(s), g = a.guns.find(x => x.uid === gunUid), def = g && WEAPON_BY_ID[g.id];
  if (!g) return { ok: false, paid: 0, text: 'That gun is gone.' };
  if (g.frt) return { ok: false, paid: 0, text: '"That\'s got a forced-reset trigger in it. I can\'t take that, and you didn\'t show it to me."' };
  const paid = ownGunOffer(g);
  if (g.loaded && def.cal) a.ammo[def.cal] = (a.ammo[def.cal] || 0) + g.loaded;
  a.guns = a.guns.filter(x => x.uid !== gunUid);
  if (a.equipped === gunUid) a.equipped = a.guns[0]?.uid || null;
  earn(s, paid, `Sold ${def.name} at Cash Cow Pawn`);
  return { ok: true, paid, text: '', def };
}
