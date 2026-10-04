// Stolen goods: from store robberies, muggings, the glovebox of a car you
// steal. `value` is what the thing is worth on the street (what a buyer pays
// retail-ish); a fence or pawn shop pays a fraction of it (core/loot.js).
// `kind` groups it at the pawn shop. `serial`: how traceable it is (0..1):
// phones and laptops have IMEIs and serials the pawn counter runs through
// LeadsOnline; gold has none. Rules for carrying and selling it live in
// core/loot.js, the robberies in world2d/combat.js.

export const LOOT = [
  { id: 'cigs',         kind: 'other',       name: 'Carton of Newports',         value: 95,   icon: '🚬', serial: 0 },
  { id: 'scratchers',   kind: 'other',       name: 'Roll of lottery scratchers', value: 150,  icon: '🎟', serial: 0.6 },
  { id: 'liquor',       kind: 'other',       name: 'Bottle of Hennessy',         value: 60,   icon: '🍾', serial: 0 },
  { id: 'vapes',        kind: 'other',       name: 'Box of vapes',               value: 120,  icon: '💨', serial: 0 },
  { id: 'giftcards',    kind: 'other',       name: 'Stack of gift cards',        value: 220,  icon: '💳', serial: 0.5 },
  { id: 'phones',       kind: 'electronics', name: 'Prepaid phones',             value: 180,  icon: '📱', serial: 0.5 },
  { id: 'energy',       kind: 'other',       name: 'Case of energy drinks',      value: 40,   icon: '🥤', serial: 0 },
  { id: 'tipjar',       kind: 'other',       name: 'Tip jar',                    value: 35,   icon: '🫙', serial: 0 },
  { id: 'sneakers',     kind: 'other',       name: 'Pair of limited sneakers',   value: 340,  icon: '👟', serial: 0.1 },
  { id: 'chain',        kind: 'jewelry',     name: 'Gold chain',                 value: 650,  icon: '📿', serial: 0 },
  { id: 'watch',        kind: 'jewelry',     name: 'Display-case watch',         value: 900,  icon: '⌚', serial: 0.4 },
  { id: 'tablet',       kind: 'electronics', name: 'Register tablet',            value: 260,  icon: '📟', serial: 0.8 },
  // off people and out of cars
  { id: 'phone',        kind: 'electronics', name: 'iPhone 17 Pro',              value: 520,  icon: '📱', serial: 0.85 },
  { id: 'android',      kind: 'electronics', name: 'Galaxy S26',                 value: 300,  icon: '📱', serial: 0.8 },
  { id: 'earbuds',      kind: 'electronics', name: 'AirPods Pro',                value: 110,  icon: '🎧', serial: 0.4 },
  { id: 'laptop',       kind: 'electronics', name: 'MacBook Pro',                value: 900,  icon: '💻', serial: 0.9 },
  { id: 'ipad',         kind: 'electronics', name: 'iPad Air',                   value: 330,  icon: '📱', serial: 0.85 },
  { id: 'speaker',      kind: 'electronics', name: 'JBL Boombox',                value: 190,  icon: '🔊', serial: 0.35 },
  { id: 'apple_watch',  kind: 'jewelry',     name: 'Apple Watch',                value: 230,  icon: '⌚', serial: 0.75 },
  { id: 'cuban_link',   kind: 'jewelry',     name: 'Cuban link chain',           value: 1800, icon: '📿', serial: 0.1 },
  { id: 'diamond_ring', kind: 'jewelry',     name: 'Diamond ring',               value: 1300, icon: '💍', serial: 0.25 },
  { id: 'rolex',        kind: 'jewelry',     name: 'Rolex Submariner',           value: 9500, icon: '⌚', serial: 0.7 },
  { id: 'glovebox_gun', kind: 'gun',         name: 'Glock 19 (glovebox)',        value: 420,  icon: '🔫', serial: 0.95 },
];
export const LOOT_BY_ID = Object.fromEntries(LOOT.map(l => [l.id, l]));
export const LOOT_KINDS = { electronics: 'Electronics', jewelry: 'Jewelry', gun: 'Guns', other: 'Other' };

// What's behind the counter at each kind of store, with weights.
export const STORE_LOOT = {
  corner:   [['cigs', 4], ['scratchers', 3], ['liquor', 3], ['vapes', 3], ['phones', 2], ['energy', 2]],
  gas:      [['cigs', 4], ['scratchers', 4], ['vapes', 3], ['giftcards', 2], ['phones', 1], ['energy', 2]],
  food:     [['tipjar', 4], ['liquor', 2], ['tablet', 1]],
  clothing: [['sneakers', 4], ['chain', 2], ['watch', 1]],
};

// What you get off a person you mug and out of a car you steal (core/loot.js
// grabLoot): the chance of anything, up to `max` items, from the weighted table.
export const STREET_LOOT = {
  mug: { chance: 0.55, max: 2, table: [['phone', 6], ['android', 5], ['earbuds', 4], ['apple_watch', 3], ['chain', 2], ['laptop', 1], ['ipad', 1], ['diamond_ring', 0.6], ['cuban_link', 0.4], ['rolex', 0.12]] },
  car: { chance: 0.5,  max: 2, table: [['phone', 2], ['android', 2], ['earbuds', 3], ['laptop', 3], ['ipad', 2], ['speaker', 2], ['apple_watch', 1], ['glovebox_gun', 1.2], ['rolex', 0.05]] },
};

// Cash Cow Pawn & Gold on East Lancaster. The counter pays more and runs
// serial numbers; Dre in the back room pays less and never asks.
export const PAWN = {
  counter: 0.42,       // share of street value paid over the counter
  fence: 0.36,         // the fence's base share
  fenceHeatCut: 0.06,  // each level of police heat takes this off the fence's share
  fenceWarrantCut: 0.05,
  fenceMin: 0.12,
  fenceRefuse: 4,      // heat at or above this: the fence won't deal with you
  coolDays: 7,         // goods cool off: the theft report goes stale after a week
  ownGun: 0.45,        // the counter buys your own (clean) guns at this share of the price
};
