// Stolen goods you carry around after a store robbery. Save key `s.loot`:
// [{ uid, id, name, value, hot: true, from, day }]. A fence or pawn shop buys
// it for a fraction of `value` (sellLoot). Get busted with it on you and it's
// seized, and you're charged with theft by the total value (seizeLoot), the
// same way drugs in your bag are (core/drugs.js seizeBag).

import { uid } from './state.js';
import { LOOT_BY_ID, STORE_LOOT } from '../data/loot.js';

export const FENCE_RATE = 0.4;     // what Sal pays on the dollar for hot goods

export function ensureLoot(s) {
  if (!Array.isArray(s.loot)) s.loot = [];
  return s.loot;
}

export function addLoot(s, id, from = '') {
  const def = LOOT_BY_ID[id];
  if (!def) return null;
  const item = { uid: uid('loot'), id, name: def.name, value: def.value, hot: true, from, day: s.time?.day ?? 0 };
  ensureLoot(s).push(item);
  return item;
}

export const lootValue = item => Math.max(0, Math.round(item?.value || 0));
export const lootTotal = s => ensureLoot(s).reduce((t, i) => t + lootValue(i), 0);

// Sell some (uids) or all (no uids) of it. Returns the cash paid.
export function sellLoot(s, uids = null, rate = FENCE_RATE) {
  const list = ensureLoot(s);
  const pick = uids ? list.filter(i => uids.includes(i.uid)) : list.slice();
  if (!pick.length) return 0;
  const paid = Math.round(pick.reduce((t, i) => t + lootValue(i), 0) * rate);
  s.loot = list.filter(i => !pick.includes(i));
  s.cash += paid;
  return paid;
}

// Roll what you grab from behind the counter: n items from that store's shelf.
export function rollLoot(type, n, rng = Math.random) {
  const table = STORE_LOOT[type];
  if (!table || n <= 0) return [];
  const total = table.reduce((t, [, w]) => t + w, 0), out = [];
  for (let k = 0; k < n; k++) {
    let r = rng() * total;
    for (const [id, w] of table) { r -= w; if (r <= 0) { out.push(id); break; } }
    if (out.length <= k) out.push(table[table.length - 1][0]);
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

// The police search you at booking: the goods go into evidence, and you get
// a record item for justice.classify ('stolen_goods').
export function seizeLoot(s) {
  const list = ensureLoot(s);
  if (!list.length) return [];
  const value = list.reduce((t, i) => t + lootValue(i), 0);
  s.loot = [];
  return [{ kind: 'stolen_goods', text: `Stolen goods on you (${list.length} item${list.length > 1 ? 's' : ''}).`, value, fine: Math.max(150, Math.round(value * 0.5)) }];
}
