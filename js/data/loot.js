// Stolen goods: what you can take off people, out of stores and out of cars,
// and what it's worth on the street. `value` is the street value (what a
// buyer would pay used); the pawn counter and the fence pay a cut of it.
// `serial`: how traceable it is (0..1). Phones and laptops have IMEIs and
// serials the pawn shop runs through LeadsOnline; gold has none.
// `src`: where it turns up and how often (relative weight).

export const LOOT = [
  { id: 'phone',        kind: 'electronics', name: 'iPhone 17 Pro',          value: 520,  serial: 0.85, src: { mug: 6, store: 1, car: 2, house: 2 } },
  { id: 'android',      kind: 'electronics', name: 'Galaxy S26',             value: 300,  serial: 0.8,  src: { mug: 5, store: 1, car: 2, house: 1 } },
  { id: 'earbuds',      kind: 'electronics', name: 'AirPods Pro',            value: 110,  serial: 0.4,  src: { mug: 4, store: 2, car: 3, house: 1 } },
  { id: 'laptop',       kind: 'electronics', name: 'MacBook Pro',            value: 900,  serial: 0.9,  src: { mug: 1, car: 3, house: 3 } },
  { id: 'tablet',       kind: 'electronics', name: 'iPad Air',               value: 330,  serial: 0.85, src: { mug: 1, car: 2, house: 2 } },
  { id: 'console',      kind: 'electronics', name: 'PlayStation 5',          value: 280,  serial: 0.7,  src: { house: 3, store: 1 } },
  { id: 'speaker',      kind: 'electronics', name: 'JBL Boombox',            value: 190,  serial: 0.35, src: { car: 2, house: 2 } },
  { id: 'vapes',        kind: 'other',       name: 'Carton of vapes',        value: 160,  serial: 0,    src: { store: 4 } },
  { id: 'scratchers',   kind: 'other',       name: 'Roll of scratch-offs',   value: 240,  serial: 0.6,  src: { store: 3 } },
  { id: 'cigs',         kind: 'other',       name: 'Cartons of Newports',    value: 130,  serial: 0,    src: { store: 4 } },
  { id: 'watch',        kind: 'jewelry',     name: 'Apple Watch',            value: 230,  serial: 0.75, src: { mug: 3, car: 1, house: 1 } },
  { id: 'gold_chain',   kind: 'jewelry',     name: '14k gold chain',         value: 650,  serial: 0,    src: { mug: 2, house: 2 } },
  { id: 'cuban_link',   kind: 'jewelry',     name: 'Cuban link chain',       value: 1800, serial: 0.1,  src: { mug: 0.4, house: 1 } },
  { id: 'diamond_ring', kind: 'jewelry',     name: 'Diamond ring',           value: 1300, serial: 0.25, src: { mug: 0.6, house: 1.5 } },
  { id: 'rolex',        kind: 'jewelry',     name: 'Rolex Submariner',       value: 9500, serial: 0.7,  src: { mug: 0.12, house: 0.3, car: 0.05 } },
  { id: 'glovebox_gun', kind: 'gun',         name: 'Glock 19 (glovebox)',    value: 420,  serial: 0.95, src: { car: 1.2, house: 0.6 } },
  { id: 'register_gun', kind: 'gun',         name: 'Taurus G3 (under the counter)', value: 260, serial: 0.95, src: { store: 1 } },
  { id: 'shotgun',      kind: 'gun',         name: 'Mossberg 500 shotgun',   value: 380,  serial: 0.95, src: { store: 0.3, house: 0.5 } },
];
export const LOOT_BY_ID = Object.fromEntries(LOOT.map(l => [l.id, l]));
export const LOOT_KINDS = { electronics: 'Electronics', jewelry: 'Jewelry', gun: 'Guns', other: 'Other' };
export const LOOT_ICON = { electronics: '📱', jewelry: '💍', gun: '🔫', other: '📦' };

// How many items a source usually gives up: chance of anything, then 1..max.
export const LOOT_ROLLS = {
  mug:   { chance: 0.55, max: 2 },
  store: { chance: 0.75, max: 3 },
  car:   { chance: 0.5,  max: 2 },
  house: { chance: 0.95, max: 4 },
};

// Cash Cow Pawn & Gold on East Lancaster. The counter pays more and runs
// serial numbers; Dre in the back room pays less and never asks.
export const PAWN = {
  counter: 0.42,       // share of street value paid over the counter
  fence: 0.33,         // the fence's base share
  fenceHeatCut: 0.06,  // each level of police heat takes this off the fence's share
  fenceWarrantCut: 0.05,
  fenceMin: 0.12,
  fenceRefuse: 4,      // heat at or above this: the fence won't deal with you
  coolDays: 7,         // goods cool off: the theft report goes stale after a week
  ownGun: 0.45,        // the counter buys your own (clean) guns at this share of the price
};
