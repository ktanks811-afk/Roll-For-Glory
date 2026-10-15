// Luxe purchases: what you own, what it's worth today and the perks some of
// it unlocks (a helicopter makes teleports free and quick, a private jet does
// the same for flights). Catalog: data/luxury.js. Store: ui/luxe.js.

import { LUX, LUX_BY_ID, LUX_CATS } from '../data/luxury.js';
import { uid, addFollowers } from './state.js';

export function ensureLux(s) {
  if (!s.lux) s.lux = { items: [] };
  return s.lux;
}

const week = s => Math.floor(((s.time?.day ?? 1) - 1) / 7);
const SEED = Object.fromEntries(LUX_CATS.map((c, i) => [c.id, i * 2.17 + 0.6]));
// Where a category's market sits this week: about 1, swinging by its volatility.
export function marketIndex(cat, w, vol) {
  const k = SEED[cat] ?? 1;
  return 1 + vol * (Math.sin(w * 0.9 + k) + 0.6 * Math.sin(w * 0.37 + k * 3.1)) / 1.6;
}
export function marketTrend(s, cat) {
  const it = LUX.find(x => x.cat === cat), w = week(s);
  return marketIndex(cat, w, it.vol) - marketIndex(cat, w - 1, it.vol);
}

// What a piece you own resells for today.
export function valueOf(s, own) {
  const it = LUX_BY_ID[own.id];
  if (!it) return 0;
  const held = Math.max(0, week(s) - Math.floor(((own.day ?? 1) - 1) / 7));
  return Math.round(own.paid * it.keep * marketIndex(it.cat, week(s), it.vol) * (1 + it.grow) ** held);
}
// Today's sticker price (watches and art float with their market).
export const priceOf = (s, it) => Math.round(it.price * (it.cat === 'watch' || it.cat === 'art' || it.cat === 'collect' ? marketIndex(it.cat, week(s), it.vol) : 1) / 10) * 10;

// Followers a flex brings when you post it.
export const flexOf = it => Math.round(Math.min(25000, 40 + Math.sqrt(it.price) * 3));

export function buyLux(s, id, spend) {
  const it = LUX_BY_ID[id];
  if (!it) return { ok: false, text: 'Not in the catalog.' };
  const price = priceOf(s, it);
  if (!spend(s, price, `Luxe: ${it.brand} ${it.name}`)) return { ok: false, text: `That's ${price.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}. You're short.` };
  const L = ensureLux(s), own = { uid: uid('lux'), id, paid: price, day: s.time?.day ?? 1 };
  L.items.push(own);
  const flex = flexOf(it);
  addFollowers(s, flex);
  return { ok: true, own, price, flex };
}

export function sellLux(s, ownUid, earn) {
  const L = ensureLux(s), i = L.items.findIndex(x => x.uid === ownUid);
  if (i < 0) return { ok: false, text: 'You don\'t own that.' };
  const own = L.items[i], it = LUX_BY_ID[own.id], paid = valueOf(s, own);
  L.items.splice(i, 1);
  earn(s, paid, `Sold: ${it.brand} ${it.name}`);
  return { ok: true, paid, it };
}

export const ownsLux = (s, id) => !!s.lux?.items?.some(x => x.id === id);
export const luxTotal = s => (s.lux?.items || []).reduce((t, o) => t + valueOf(s, o), 0);

// What your collection lets you do.
export function luxPerks(s) {
  const out = { heli: false, jet: false, carFree: false };
  for (const o of s.lux?.items || []) {
    const it = LUX_BY_ID[o.id];
    if (it?.perk === 'heli') out.heli = true;
    if (it?.perk === 'jet') { out.jet = true; if (it.carFree) out.carFree = true; }
  }
  return out;
}
