// Stolen goods you carry around, and the two ways to turn them into cash at
// Cash Cow Pawn & Gold: the counter (better money, but they run serial
// numbers and a hot item gets flagged to FWPD) or Dre, the fence in the back
// (never flags anything, pays less, and pays even less when the cops are
// looking for you). Get arrested with stolen goods on you and they're
// seized as evidence: theft by receiving, classed by total value.
// DOM-free so check-data can test it.
//
// Shared shape (other systems call addLoot/rollLoot to hand the player loot):
//   s.loot.items: [{ uid, id, name, kind, value, day, from }]

import { uid } from './state.js';
import { LOOT, LOOT_BY_ID, LOOT_ROLLS, PAWN } from '../data/loot.js';
import { WEAPON_BY_ID, ensureArms } from '../data/weapons.js';
import { addWarrant } from './warrants.js';
import { theftClass } from './justice.js';

export { theftClass };

export function ensureLoot(s) {
  s.loot ??= {};
  const l = s.loot;
  l.items ??= [];
  l.fenced ??= 0;     // lifetime cash from Dre
  l.pawned ??= 0;     // lifetime cash from the counter
  l.flagged ??= 0;    // items the counter flagged to the police
  return l;
}

export const lootItems = s => ensureLoot(s).items;
export const lootValue = items => items.reduce((t, i) => t + i.value, 0);

// Hand the player one stolen item. opts: { from, value, name }
export function addLoot(s, id, opts = {}) {
  const def = LOOT_BY_ID[id];
  if (!def) return null;
  const item = { uid: uid('lt'), id, name: opts.name || def.name, kind: def.kind, value: Math.round(opts.value ?? def.value), day: s.time?.day ?? 1, from: opts.from || 'street' };
  ensureLoot(s).items.push(item);
  return item;
}

// Random loot for a source ('mug', 'store', 'car', 'house'). Adds and returns the items.
export function rollLoot(s, source, rng = Math.random) {
  const r = LOOT_ROLLS[source];
  if (!r || rng() > r.chance) return [];
  const pool = LOOT.filter(l => l.src[source]);
  const total = pool.reduce((t, l) => t + l.src[source], 0);
  const n = 1 + Math.floor(rng() * r.max);
  const out = [];
  for (let k = 0; k < n; k++) {
    let x = rng() * total, def = pool[pool.length - 1];
    for (const l of pool) { x -= l.src[source]; if (x <= 0) { def = l; break; } }
    // a little variety in condition and model year
    out.push(addLoot(s, def.id, { from: source, value: def.value * (0.75 + rng() * 0.5) }));
  }
  return out;
}

// "iPhone 17 Pro, 14k gold chain" for a toast.
export const lootNames = items => items.map(i => i.name).join(', ');

// How hot an item still is: 1 the day you took it, cooling to 0.2 after a
// week (the report is still in the system, just nobody is looking for it).
export function hotness(s, item) {
  const age = Math.max(0, (s.time?.day ?? 1) - item.day);
  return Math.max(0.2, 1 - (age / PAWN.coolDays) * 0.8);
}

// Chance the counter's serial check flags this item to the police.
export function flagChance(s, item) {
  const def = LOOT_BY_ID[item.id];
  return Math.min(0.9, (def?.serial ?? 0.5) * hotness(s, item) * 0.85);
}

export const counterOffer = item => Math.round(item.value * PAWN.counter);

// The fence's share of street value at this police heat, or null when he
// won't deal with you at all.
export function fenceShare(s, heat = s.heat || 0) {
  if (heat >= PAWN.fenceRefuse) return null;
  const warrants = (s.warrants || []).length;
  return Math.max(PAWN.fenceMin, PAWN.fence - Math.floor(heat) * PAWN.fenceHeatCut - Math.min(3, warrants) * PAWN.fenceWarrantCut);
}
export function fenceOffer(s, item, heat) {
  const share = fenceShare(s, heat);
  return share == null ? 0 : Math.round(item.value * share);
}

function take(s, uids) {
  const l = ensureLoot(s), set = new Set(uids);
  const out = l.items.filter(i => set.has(i.uid));
  l.items = l.items.filter(i => !set.has(i.uid));
  return out;
}

// Sell items to Dre. earn(s, amount, label) is passed in (state.earn).
// Returns { ok, paid, items, text }.
export function sellToFence(s, uids, earn, heat) {
  const share = fenceShare(s, heat);
  if (share == null) return { ok: false, paid: 0, items: [], text: 'Dre won\'t touch you right now. "You hot. Come back when they stop looking for you."' };
  const items = take(s, uids);
  if (!items.length) return { ok: false, paid: 0, items, text: 'Nothing to sell.' };
  const paid = items.reduce((t, i) => t + Math.round(i.value * share), 0);
  earn(s, paid, `Fenced ${items.length === 1 ? items[0].name : items.length + ' items'}`);
  ensureLoot(s).fenced += paid;
  return { ok: true, paid, items, text: '' };
}

// Pawn one item over the counter. They run the serial while you wait: if it
// comes back stolen they keep it, call it in, and a warrant goes out.
// Returns { ok, flagged, paid, item, warrant }.
export function pawnItem(s, itemUid, earn, rng = Math.random) {
  const l = ensureLoot(s);
  const item = l.items.find(i => i.uid === itemUid);
  if (!item) return { ok: false, flagged: false, paid: 0, item: null };
  const flagged = rng() < flagChance(s, item);
  take(s, [itemUid]);
  if (flagged) {
    l.flagged++;
    const off = theftOffence([item]);
    const warrant = addWarrant(s, { kind: 'theft', text: off.text, fine: Math.max(250, Math.round(item.value * 0.5)), felony: off.value >= 2500 || item.kind === 'gun', value: off.value, evidence: `Serial number hit at Cash Cow Pawn: ${item.name}` });
    return { ok: true, flagged: true, paid: 0, item, warrant };
  }
  const paid = counterOffer(item);
  earn(s, paid, `Pawned ${item.name}`);
  l.pawned += paid;
  return { ok: true, flagged: false, paid, item };
}

// Your own guns: the counter buys them legally (paperwork, no questions).
export function ownGunOffer(g) {
  const def = WEAPON_BY_ID[g?.id];
  return def ? Math.round(def.price * PAWN.ownGun * (g.frt ? 0 : 1)) : 0;
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
  ensureLoot(s).pawned += paid;
  return { ok: true, paid, text: '', def };
}

export function theftOffence(items) {
  const value = lootValue(items);
  const guns = items.filter(i => i.kind === 'gun').length;
  return { kind: 'theft', value, fine: Math.max(150, Math.round(value * 0.3)),
    text: `Theft by receiving: stolen property worth $${value.toLocaleString('en-US')}${guns ? ` (incl. ${guns} stolen firearm${guns > 1 ? 's' : ''})` : ''}.` };
}

// They search you after an arrest: stolen goods are evidence. Returns the
// offences to charge (empty when you're clean) and empties your bag.
export function seizeLoot(s) {
  const l = ensureLoot(s);
  if (!l.items.length) return [];
  const items = l.items;
  l.items = [];
  return [theftOffence(items)];
}
