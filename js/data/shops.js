// Clothing, food and misc items. Clothing ids map onto the character
// model in gfx/character.js (slot + style + colour).

export const CLOTHES = [
  { id: 'hoodie_black', slot: 'top', style: 'hoodie', color: '#1a1a1a', name: 'Black Hoodie', price: 0 },
  { id: 'tee_white', slot: 'top', style: 'tee', color: '#e8e8e8', name: 'White Tee', price: 25 },
  { id: 'tee_red', slot: 'top', style: 'tee', color: '#b51818', name: 'Red Tee', price: 25 },
  { id: 'hoodie_grey', slot: 'top', style: 'hoodie', color: '#6d7078', name: 'Heather Hoodie', price: 60 },
  { id: 'bomber_olive', slot: 'top', style: 'jacket', color: '#4a5232', name: 'Olive Bomber', price: 140 },
  { id: 'racing_jacket', slot: 'top', style: 'jacket', color: '#c41b1b', name: 'Leather Racing Jacket', price: 420, tier: 2 },
  { id: 'varsity_crew', slot: 'top', style: 'jacket', color: '#0b1f4d', name: 'Crew Varsity Jacket', price: 260 },
  { id: 'silver_jacket', slot: 'top', style: 'jacket', color: '#b8bcc4', name: 'Silver Tech Shell', price: 900, tier: 3 },
  { id: 'jeans_blue', slot: 'bottom', style: 'jeans', color: '#2c3e66', name: 'Blue Jeans', price: 0 },
  { id: 'jeans_black', slot: 'bottom', style: 'jeans', color: '#151515', name: 'Black Denim', price: 70 },
  { id: 'cargo_tan', slot: 'bottom', style: 'cargo', color: '#7d6b4c', name: 'Tan Cargos', price: 65 },
  { id: 'track_black', slot: 'bottom', style: 'track', color: '#202020', name: 'Track Pants', price: 55 },
  { id: 'cap_black', slot: 'hat', style: 'cap', color: '#111111', name: 'Black Cap', price: 30 },
  { id: 'cap_red', slot: 'hat', style: 'cap', color: '#b51818', name: 'Red Cap', price: 30 },
  { id: 'beanie_grey', slot: 'hat', style: 'beanie', color: '#5b5f66', name: 'Grey Beanie', price: 25 },
  { id: 'no_hat', slot: 'hat', style: 'none', color: '#000000', name: 'No Hat', price: 0 },
  { id: 'kicks_white', slot: 'shoes', style: 'kicks', color: '#f0f0f0', name: 'White Kicks', price: 90 },
  { id: 'kicks_red', slot: 'shoes', style: 'kicks', color: '#c41b1b', name: 'Red Racers', price: 120 },
  { id: 'boots_black', slot: 'shoes', style: 'boots', color: '#1a1a1a', name: 'Black Boots', price: 110 },
  // Riverside Army Surplus: blackout gear. `conceal` is how much of your face
  // a mask hides (core/disguise.js). Vortex is a made-up brand.
  { id: 'no_mask', slot: 'mask', style: 'none', color: '#000000', name: 'No Mask', price: 0 },
  { id: 'skimask_black', slot: 'mask', style: 'skimask', color: '#0c0c0d', name: 'Vortex Black Ski Mask', price: 35, conceal: 0.55, shop: 'surplus' },
  { id: 'bandana_black', slot: 'mask', style: 'bandana', color: '#141414', name: 'Black Bandana (over the face)', price: 12, conceal: 0.3, shop: 'surplus' },
  { id: 'fleece_black', slot: 'top', style: 'hoodie', color: '#0f0f10', name: 'Vortex Black Tech Fleece Hoodie', price: 120, shop: 'surplus' },
  { id: 'joggers_black', slot: 'bottom', style: 'track', color: '#101011', name: 'Vortex Black Tech Fleece Joggers', price: 95, shop: 'surplus' },
  { id: 'cargo_black', slot: 'bottom', style: 'cargo', color: '#18181a', name: 'Black Work Cargos', price: 60, shop: 'surplus' },
  { id: 'kicks_blackout', slot: 'shoes', style: 'kicks', color: '#121212', name: 'Vortex Triple-Black Runners', price: 110, shop: 'surplus' },
  { id: 'boots_tactical', slot: 'shoes', style: 'boots', color: '#141414', name: 'Black Tactical Boots', price: 140, shop: 'surplus' },
  { id: 'beanie_black', slot: 'hat', style: 'beanie', color: '#121212', name: 'Black Watch Cap', price: 20, shop: 'surplus' },
];
export const MASKS = CLOTHES.filter(c => c.slot === 'mask' && c.conceal);
// The all-black fit the surplus store sells as one bundle (10% off).
export const BLACKOUT_FIT = ['skimask_black', 'fleece_black', 'joggers_black', 'kicks_blackout'];
export const BLACKOUT_DISCOUNT = 0.1;
export const CLOTH_BY_ID = Object.fromEntries(CLOTHES.map(c => [c.id, c]));

export const FOOD = [
  { id: 'coffee', name: 'Black Coffee', price: 4, energy: 15, desc: 'Keeps your reactions sharp.' },
  { id: 'burger', name: 'Double Smash Burger', price: 12, energy: 40, desc: "Lucky's classic." },
  { id: 'plate', name: 'Midnight Plate (eggs, hash, steak)', price: 22, energy: 70, desc: 'Fuel for a long night.' },
  { id: 'energy', name: 'Volt Energy Drink (to go)', price: 6, energy: 0, item: 'energyDrinks', desc: 'Keep one in the car. Drink from the phone.' },
];

export const SKIN_TONES = ['#f1d1b5', '#e0b590', '#c68e65', '#9c6644', '#6b4429', '#3f2a1a'];
export const HAIR_COLORS = ['#111111', '#3b2414', '#6b4423', '#b07b3e', '#d9c27a', '#9a9a9a', '#b51818', '#2a6bd1'];
export const HAIR_STYLES = ['short', 'buzz', 'long', 'curly', 'bun'];

export function defaultLook() {
  return { skin: SKIN_TONES[2], hair: HAIR_COLORS[0], hairStyle: 'short', build: 1,
    top: 'hoodie_black', bottom: 'jeans_blue', hat: 'no_hat', shoes: 'kicks_white', mask: 'no_mask' };
}
