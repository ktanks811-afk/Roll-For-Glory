// Where to eat in Fort Worth and what's on the menu. The rules for the
// hunger and energy meters live in core/needs.js; the map pieces are built
// by world2d/eats.js.
//
// Like the estate places (data/estate.js), each spot carries its own lot
// rectangle, which the map clears of filler scenery and builds on. The
// marker sits on the kerb just outside the lot, on the side facing the street.

const FACE = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 };
const P = (id, name, menu, side, x0, z0, x1, z1, extra = {}) => {
  const mid = side === 'N' || side === 'S' ? (x0 + x1) / 2 : (z0 + z1) / 2;
  const at = side === 'N' ? { x: mid, z: z0 - 2 } : side === 'S' ? { x: mid, z: z1 + 2 } : side === 'W' ? { x: x0 - 2, z: mid } : { x: x1 + 2, z: mid };
  return { id, type: 'food', name, menu, side, ...at, face: FACE[side], lot: { x0, z0, x1, z1 }, color: '#e8c21a', icon: 'food', ...extra };
};

// truck: a taco truck parked at the kerb with a few picnic tables.
// Otherwise a sit-down place with a parking strip in front.
export const FOOD_SPOTS = [
  P('taco_magnolia', 'Tacos La Güera (truck)', 'taco', 'N', -122, 315, -78, 343, { truck: true, sign: 'TACOS' }),
  P('taco_lancaster', 'El Rey del Taco (truck)', 'taco', 'W', 465, 200, 493, 244, { truck: true, sign: 'TACOS' }),
  P('taco_stopsix', 'Stop Six Taco Stop (truck)', 'taco', 'N', 1700, -291, 1744, -263, { truck: true, sign: 'TACOS' }),
  P('cowtown_diner', 'Cowtown Diner', 'diner', 'N', 40, -735, 110, -680, { sign: 'Cowtown Diner' }),
  P('heights_bbq', 'Heights Smokehouse BBQ', 'bbq', 'S', -560, -70, -490, -15, { sign: 'Smokehouse BBQ' }),
];

// food: how much it fills you up. energy: how much it wakes you up.
// item: goes in your bag to eat later (tap the meters on the HUD).
export const MENUS = {
  taco: [
    { id: 'pastor', name: 'Three al pastor tacos', price: 7, food: 35, energy: 5, desc: 'Onion, cilantro, lime. Green salsa if you\'re scared.' },
    { id: 'barbacoa', name: 'Barbacoa plate', price: 11, food: 55, energy: 5, desc: 'Rice, beans, tortillas on the side.' },
    { id: 'elote', name: 'Elote in a cup', price: 4, food: 15, energy: 0, desc: 'Mayo, cotija, chile. Messy.' },
    { id: 'horchata', name: 'Horchata', price: 3.5, food: 5, energy: 12, desc: 'Cold, sweet, gone in a minute.' },
    { id: 'tacos_togo', name: 'Tacos to go (foil wrapped)', price: 8, food: 0, energy: 0, item: 'tacos', desc: 'Keep them in the car. Eat from the meters on your screen.' },
  ],
  diner: [
    { id: 'cfs', name: 'Chicken fried steak', price: 16, food: 75, energy: 10, desc: 'Cream gravy, mashed potatoes. The Cowtown way.' },
    { id: 'biscuits', name: 'Biscuits and gravy', price: 9, food: 45, energy: 5, desc: 'Sausage gravy, two biscuits.' },
    { id: 'pie', name: 'Slice of pecan pie', price: 5, food: 20, energy: 10, desc: 'Warm, with a scoop of vanilla.' },
    { id: 'coffee', name: 'Bottomless coffee', price: 3, food: 0, energy: 30, desc: 'The waitress keeps it coming.' },
  ],
  bbq: [
    { id: 'brisket', name: 'Brisket plate', price: 18, food: 80, energy: 5, desc: 'Half a pound, pickles, onions, white bread.' },
    { id: 'sandwich', name: 'Chopped beef sandwich', price: 10, food: 50, energy: 5, desc: 'Sauce on the side.' },
    { id: 'tea', name: 'Sweet tea', price: 2.5, food: 0, energy: 15, desc: 'Sweeter than it has any right to be.' },
  ],
};
