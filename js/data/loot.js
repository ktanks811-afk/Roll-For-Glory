// Stolen goods from store robberies. `value` is what the thing is worth on
// the street (what a buyer pays retail-ish); a fence or pawn shop pays a
// fraction of it (core/loot.js). Rules for carrying and selling it live in
// core/loot.js, the robberies in world2d/combat.js.

export const LOOT = [
  { id: 'cigs',       name: 'Carton of Newports',        value: 95,   icon: '🚬' },
  { id: 'scratchers', name: 'Roll of lottery scratchers', value: 150, icon: '🎟' },
  { id: 'liquor',     name: 'Bottle of Hennessy',        value: 60,   icon: '🍾' },
  { id: 'vapes',      name: 'Box of vapes',              value: 120,  icon: '💨' },
  { id: 'giftcards',  name: 'Stack of gift cards',       value: 220,  icon: '💳' },
  { id: 'phones',     name: 'Prepaid phones',            value: 180,  icon: '📱' },
  { id: 'energy',     name: 'Case of energy drinks',     value: 40,   icon: '🥤' },
  { id: 'tipjar',     name: 'Tip jar',                   value: 35,   icon: '🫙' },
  { id: 'sneakers',   name: 'Pair of limited sneakers',  value: 340,  icon: '👟' },
  { id: 'chain',      name: 'Gold chain',                value: 650,  icon: '📿' },
  { id: 'watch',      name: 'Display-case watch',        value: 900,  icon: '⌚' },
  { id: 'tablet',     name: 'Register tablet',           value: 260,  icon: '📟' },
];
export const LOOT_BY_ID = Object.fromEntries(LOOT.map(l => [l.id, l]));

// What's behind the counter at each kind of store, with weights.
export const STORE_LOOT = {
  corner:   [['cigs', 4], ['scratchers', 3], ['liquor', 3], ['vapes', 3], ['phones', 2], ['energy', 2]],
  gas:      [['cigs', 4], ['scratchers', 4], ['vapes', 3], ['giftcards', 2], ['phones', 1], ['energy', 2]],
  food:     [['tipjar', 4], ['liquor', 2], ['tablet', 1]],
  clothing: [['sneakers', 4], ['chain', 2], ['watch', 1]],
};
