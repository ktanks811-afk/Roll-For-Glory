// Hauling livestock in the stock trailer: load cattle and horses off your
// pasture, haul them to the Joshua sale barn and sell them at the day's
// auction price, or buy at the auction and haul them home. Selling from the
// ranch screen only gets you 60%; the auction pays what the market pays.
//
// Save state: each stock trailer in s.trailers carries its own
// `stock: { cow: n, longhorn: n, horse: n }`, so the head stay on that trailer
// whatever happens to the truck (core/tow.js owns the rest).
//
// DOM-free so scripts/check-data.mjs can test it.

import { ANIMALS, ANIMAL_BY_ID, LAND } from '../data/estate.js';
import { ensureTow, hitched } from './tow.js';
import { TRAILER_BY_ID } from '../data/trailers.js';
import { ownsLand, landState, penCount, penCap } from './estate.js';

const err = text => ({ ok: false, text });
export const HAULED = ANIMALS.filter(a => a.pen);           // what rides in a stock trailer (not the dogs)
export const COMMISSION = 0.08;                              // the auction's cut when you sell

// The head on the hitched stock trailer ({} when there isn't one).
export function stockOn(s) {
  const t = ensureTow(s);
  const tr = t.trailer && s.trailers.find(x => x.uid === t.trailer);
  if (!tr || TRAILER_BY_ID[tr.id]?.kind !== 'stock') return {};
  return tr.stock ??= {};
}
export const headOn = s => Object.values(stockOn(s)).reduce((a, b) => a + b, 0);

// The stock trailer behind the truck you're driving, or null.
export function stockRig(s) {
  const t = ensureTow(s), h = hitched(s);
  if (!h || h.def.kind !== 'stock' || t.rig || s.activeCar !== t.truck) return null;
  return h;
}
export const roomOn = s => { const h = stockRig(s); return h ? h.def.head - headOn(s) : 0; };

// Why the trailer can't load or unload right now, or ''.
export function haulBlock(s) {
  const t = ensureTow(s), h = hitched(s);
  if (!h || h.def.kind !== 'stock') return 'Hitch a stock trailer to your truck first.';
  if (t.rig) return 'Your truck is parked out somewhere.';
  if (s.activeCar !== t.truck) return 'Bring the truck that\'s pulling the stock trailer.';
  return '';
}

// Pasture → trailer. n = how many (capped at what fits and what's there).
export function loadStock(s, landId, kind, n = 1) {
  const why = haulBlock(s);
  if (why) return err(why);
  const A = ANIMAL_BY_ID[kind];
  if (!A?.pen) return err('That doesn\'t ride in a stock trailer.');
  if (!ownsLand(s, landId)) return err('That isn\'t your land.');
  const l = landState(s, landId), have = l.animals?.[kind] || 0;
  const k = Math.min(n, have, roomOn(s));
  if (!have) return err(`There's no ${A.name.toLowerCase()} in the pasture.`);
  if (k <= 0) return err('The trailer is full.');
  l.animals[kind] -= k;
  if (!l.animals[kind]) delete l.animals[kind];
  const st = stockOn(s);
  st[kind] = (st[kind] || 0) + k;
  return { ok: true, n: k, text: `Loaded ${k} ${plural(A, k)} on the trailer.` };
}

// Trailer → pasture, as many as the fence holds.
export function unloadStock(s, landId, kind = null) {
  const why = haulBlock(s);
  if (why) return err(why);
  if (!ownsLand(s, landId)) return err('That isn\'t your land.');
  const l = landState(s, landId);
  if (!l.fence) return err(`Build a fence at ${LAND[landId]?.short || 'your land'} first or they'll wander off.`);
  const st = stockOn(s);
  let room = penCap(s, landId) - penCount(s, landId), moved = 0;
  for (const k of kind ? [kind] : Object.keys(st)) {
    const m = Math.min(st[k] || 0, room);
    if (m <= 0) continue;
    l.animals ??= {};
    l.animals[k] = (l.animals[k] || 0) + m;
    st[k] -= m; if (!st[k]) delete st[k];
    room -= m; moved += m;
  }
  if (!moved) return err(headOn(s) ? 'The pasture is full. Build a bigger fence.' : 'The trailer is empty.');
  return { ok: true, n: moved, text: `Turned ${moved} head out into the pasture.${headOn(s) ? ` ${headOn(s)} still on the trailer: no room.` : ''}` };
}

// ---------------------------------------------------------------- the sale barn
// The day's auction price for one head: 85% to 130% of list, different for
// each kind and each day. Selling, the barn keeps its commission.
export function marketRate(s, kind) {
  let h = (s.time.day + 1) * 2654435761 ^ [...kind].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h ^= h >>> 12;
  return 0.85 + ((h >>> 0) % 1000) / 1000 * 0.45;
}
export const buyPrice = (s, kind) => Math.round(ANIMAL_BY_ID[kind].price * marketRate(s, kind) / 10) * 10;
export const sellPrice = (s, kind) => Math.round(ANIMAL_BY_ID[kind].price * marketRate(s, kind) * (1 - COMMISSION) / 10) * 10;

export function sellStock(s, kind, n, earn) {
  const why = haulBlock(s);
  if (why) return err(why);
  const st = stockOn(s), A = ANIMAL_BY_ID[kind];
  const k = Math.min(n, st[kind] || 0);
  if (!A || k <= 0) return err('None of those on the trailer.');
  const each = sellPrice(s, kind), pay = each * k;
  st[kind] -= k; if (!st[kind]) delete st[kind];
  earn(s, pay, `Sale barn: ${k} ${plural(A, k)}`);
  return { ok: true, n: k, paid: pay, text: `Sold ${k} ${plural(A, k)} at ${money(each)} a head. ${money(pay)} after the barn's cut.` };
}

export function buyStock(s, kind, n, spend) {
  const why = haulBlock(s);
  if (why) return err(why);
  const A = ANIMAL_BY_ID[kind];
  if (!A?.pen) return err('The barn doesn\'t sell those.');
  const k = Math.min(n, roomOn(s));
  if (k <= 0) return err('The trailer is full.');
  const cost = buyPrice(s, kind) * k;
  if (!spend(s, cost, `Sale barn: bought ${k} ${plural(A, k)}`)) return err(`You need ${money(cost)}.`);
  const st = stockOn(s);
  st[kind] = (st[kind] || 0) + k;
  return { ok: true, n: k, cost, text: `Bought ${k} ${plural(A, k)} for ${money(cost)}. They're on the trailer: haul them home and unload them at your ranch.` };
}

const plural = (A, k) => { const n = A.id === 'horse' ? 'quarter horse' : A.name; return k === 1 ? n : `${n}s`; };
const money = v => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
