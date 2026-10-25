// Quick destinations for the Map and Ryde apps: the places you go most, so
// you're not scrolling through the whole city to find them.
//   - Your stuff: your cars (where you left them) and your properties.
//   - Favorites: places you starred (up to FAV_MAX), in your order.
//   - Recents: the last RECENT_MAX places you set the GPS to.
//
// Save state: s.nav = { fav: [{ id?, label, x, z }], recent: [same] }. `id` is a
// LOCATIONS id when it's a place (pins have none). DOM-free; tested in
// scripts/check-data.mjs.

import { LOCATIONS, LOC_BY_ID, PROPERTIES, districtAt } from '../data/world.js';
import { carName, CAR_BY_ID } from '../data/cars.js';
import { whereIs } from './garages.js';

export const FAV_MAX = 8;
export const RECENT_MAX = 6;

export function ensureNav(s) {
  s.nav ??= {};
  s.nav.fav ??= [];
  s.nav.recent ??= [];
  return s.nav;
}

const same = (a, b) => (a.id && b.id ? a.id === b.id : Math.hypot(a.x - b.x, a.z - b.z) < 15);
const placeAt = (x, z) => LOCATIONS.find(l => Math.abs(l.x - x) < 1 && Math.abs(l.z - z) < 1);
const entry = (t) => ({ ...(t.id && LOC_BY_ID[t.id] ? { id: t.id } : placeAt(t.x, t.z) ? { id: placeAt(t.x, t.z).id } : {}), label: String(t.label || t.name || 'Pin').slice(0, 40), x: Math.round(t.x), z: Math.round(t.z) });

// The GPS was set somewhere: put it at the top of recents.
export function noteRecent(s, t) {
  if (!t || !isFinite(t.x) || !isFinite(t.z)) return;
  const n = ensureNav(s), e = entry(t);
  n.recent = [e, ...n.recent.filter(r => !same(r, e))].slice(0, RECENT_MAX);
}

export const isFav = (s, t) => ensureNav(s).fav.some(f => same(f, t));
// Star or unstar a place. Returns true when it's a favorite now.
export function toggleFav(s, t) {
  const n = ensureNav(s), e = entry(t);
  const i = n.fav.findIndex(f => same(f, e));
  if (i >= 0) { n.fav.splice(i, 1); return false; }
  if (n.fav.length >= FAV_MAX) n.fav.pop();
  n.fav.unshift(e);
  return true;
}

// Your cars and your properties, as quick destinations:
// [{ key, kind: 'car' | 'home' | 'property', icon, label, sub, x, z, id? }]
export function myPlaces(s) {
  const out = [];
  const act = (s.cars || []).find(c => c.uid === s.activeCar);
  if (act) {
    const w = whereIs(s, act);
    if (w && w.x != null && w.kind !== 'driving') out.push({ key: 'car', kind: 'car', icon: w.kind === 'left' ? '🚨' : '🚗', label: `Your ${CAR_BY_ID[act.modelId]?.model || 'car'}`, sub: w.text, x: w.x, z: w.z });
  }
  if (s.tow?.rig && s.tow.truck) {
    const t = (s.cars || []).find(c => c.uid === s.tow.truck);
    if (t) out.push({ key: 'rig', kind: 'car', icon: '🚚', label: `Your ${carName(CAR_BY_ID[t.modelId])} + trailer`, sub: `Parked out in ${districtAt(s.tow.rig.x, s.tow.rig.z)}`, x: s.tow.rig.x, z: s.tow.rig.z });
  }
  const props = [...new Set(s.properties || [])].filter(id => LOC_BY_ID[id]);
  props.sort((a, b) => (b === s.home) - (a === s.home));
  for (const id of props) {
    const l = LOC_BY_ID[id], p = PROPERTIES[id];
    const parked = (s.cars || []).filter(c => c.uid !== s.activeCar && c.garage === id).length;
    out.push({ key: 'p:' + id, kind: id === s.home ? 'home' : 'property', icon: id === s.home ? '🏠' : '🏡', label: p?.name || l.name, sub: `${id === s.home ? 'Home · ' : ''}${districtAt(l.x, l.z)}${p?.slots ? ` · ${parked} car${parked === 1 ? '' : 's'} parked` : ''}`, x: l.x, z: l.z, id });
  }
  return out;
}
