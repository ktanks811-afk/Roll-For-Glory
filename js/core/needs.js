// Hunger and sleep: two meters on the player, 0..100.
//   food   — how full you are. Taco trucks, diners, gas station hot dogs.
//   energy — how rested you are. Sleep at a place you own; coffee helps.
//
// Kept light on purpose. They only drain while you're out in the world (a
// full belly lasts most of a game day), nothing hurts you, and the only cost
// of ignoring them is a slower run and slower reactions on the tree.
// DOM-free so check-data can test it.

export const FOOD_HOURS = 16;     // full → empty, in game hours (1 game hour = 1 real minute)
export const ENERGY_HOURS = 20;   // rested → exhausted
export const LOW = 25, VERY_LOW = 8, OK_AGAIN = 40;

const clamp = v => Math.max(0, Math.min(100, v));

export function ensureNeeds(s) {
  s.player.energy = clamp(s.player.energy ?? 100);
  s.player.food = clamp(s.player.food ?? 100);
  s.inventory ??= {};
  s.inventory.tacos ??= 0;
  s.inventory.energyDrinks ??= 0;
  s.needs ??= { warned: {} };
  s.needs.warned ??= {};
  return s.player;
}

export const hungry = s => s.player.food < LOW;
export const tired = s => s.player.energy < LOW;

// Running speed: a little slower when you're running on empty.
export function runMul(s) {
  return (s.player.food <= VERY_LOW ? 0.85 : 1) * (s.player.energy <= VERY_LOW ? 0.85 : 1);
}

// `mins` game minutes passed out in the world. Returns a heads-up the first
// time a meter gets low (and again if it gets very low), or null.
export function tickNeeds(s, mins) {
  const p = ensureNeeds(s);
  p.food = clamp(p.food - mins * 100 / (FOOD_HOURS * 60));
  // an empty stomach tires you out faster
  p.energy = clamp(p.energy - mins * 100 / (ENERGY_HOURS * 60) * (p.food < VERY_LOW ? 1.5 : 1));
  return warn(s, 'food', p.food, ['🌮 Getting hungry. Grab some tacos or hit a diner.', '🌮 Starving. You\'re slowing down, go eat.'])
    || warn(s, 'energy', p.energy, ['😴 Getting tired. A coffee or a night\'s sleep at home.', '😴 Exhausted. Your reactions are shot, go home and sleep.']);
}

function warn(s, k, v, [low, veryLow]) {
  const w = s.needs.warned;
  if (v > OK_AGAIN) { w[k] = 0; return null; }
  if (v < VERY_LOW && (w[k] || 0) < 2) { w[k] = 2; return veryLow; }
  if (v < LOW && !w[k]) { w[k] = 1; return low; }
  return null;
}

export function eat(s, item) {
  const p = ensureNeeds(s);
  p.food = clamp(p.food + (item.food || 0));
  p.energy = clamp(p.energy + (item.energy || 0));
}

// Things in your bag you can eat anywhere.
export const BAG = [
  { id: 'tacos', name: 'Tacos to go', icon: '🌮', food: 35, energy: 5 },
  { id: 'energyDrinks', name: 'Volt Energy Drink', icon: '⚡', food: 0, energy: 25 },
];

export function eatFromBag(s, id) {
  const it = BAG.find(b => b.id === id);
  ensureNeeds(s);
  if (!it || !(s.inventory[id] > 0)) return false;
  s.inventory[id]--;
  eat(s, it);
  return true;
}

// Sleeping at home: fully rested, and you wake up a bit hungry.
export function sleep(s, mins) {
  const p = ensureNeeds(s);
  p.energy = 100;
  p.food = clamp(Math.max(Math.min(p.food, 10), p.food - mins / 60 * 2));
}

// A nap: part of the way rested.
export function nap(s, mins) {
  const p = ensureNeeds(s);
  p.energy = clamp(p.energy + mins / 60 * 20);
}

export function meterLabel(v) {
  return v >= 70 ? 'good' : v >= LOW ? 'ok' : v >= VERY_LOW ? 'low' : 'empty';
}
