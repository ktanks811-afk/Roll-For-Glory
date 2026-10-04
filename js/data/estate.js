// Real estate and the drug game: what's for sale, where it is, and what the
// product is worth. Rules live in core/drugs.js and core/estate.js; the map
// pieces outside the city grid are built by world2d/estate.js.
//
// Places off the city grid carry their own lot rectangle (`lot`), which the
// map clears of filler scenery and builds on. Their marker sits on the kerb
// just outside the lot, on the `side` that faces the street.

const FACE = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 };
// x0..x1, z0..z1 is the lot. The marker goes 2 m out from the front edge.
const P = (id, type, name, side, x0, z0, x1, z1, extra = {}) => {
  const mid = side === 'N' || side === 'S' ? (x0 + x1) / 2 : (z0 + z1) / 2;
  const at = side === 'N' ? { x: mid, z: z0 - 2 } : side === 'S' ? { x: mid, z: z1 + 2 } : side === 'W' ? { x: x0 - 2, z: mid } : { x: x1 + 2, z: mid };
  return { id, type, name, side, ...at, face: FACE[side], lot: { x0, z0, x1, z1 }, ...extra };
};

// ---------------------------------------------------------------- the map
export const ESTATE_LOCATIONS = [
  // Stop Six, on the lane north of Ramey Ave
  P('trap_stopsix', 'trap', 'Ramey Ave Trap House', 'N', 1560, -441, 1650, -340, { color: '#8a1a1a', icon: 'home' }),
  P('plug', 'plug', "Lil Tre's Corner Store", 'N', 1880, -141, 1950, -95, { color: '#2cff7a', icon: 'tow' }),
  P('land_stopsix', 'land', 'Empty Lot · Stop Six', 'N', 2200, -291, 2330, -172, { color: '#c8a46a', icon: 'key' }),
  // east of Stop Six, back off the lake road
  P('land_lakeworth', 'land', 'Lake Worth Acreage', 'W', 2628, -560, 2770, -430, { color: '#c8a46a', icon: 'key' }),
  // out on Chisholm Trail Pkwy, past the trailer park
  P('land_chisholm', 'land', 'Chisholm Flats Ranch Land', 'W', 12, 2420, 140, 2540, { color: '#c8a46a', icon: 'key' }),
];

// Trap houses are properties too (they have a garage and count as a
// safehouse), so their entries live next to the homes in data/world.js.
// risk: how fast the neighbours and the narcotics unit notice the foot traffic.
// rush: how many customers come knocking compared to a quiet block.
export const TRAPS = {
  trap_stopsix:   { name: 'Ramey Ave Trap House', price: 22000, slots: 2, risk: 1.0, rush: 1.3, worker: 6,
    desc: 'Boarded side window, a porch that sees everything. Customers already know the address.', wall: '#7a6a58', roof: '#3a3330' },
  trap_riverside: { name: 'Riverside Duplex', price: 58000, slots: 3, risk: 0.7, rush: 0.9, worker: 4, tier: 2,
    desc: 'Two units behind a tire shop. Quieter street, fewer eyes, fewer customers.', wall: '#6a6f75', roof: '#45484d' },
};

// Land you buy empty and build on. Construction takes game days.
export const LAND = {
  land_stopsix:   { name: 'Empty Lot · Stop Six', price: 16000, desc: 'A cleared lot on a Stop Six side street. Close to everything that matters on the east side.' },
  land_lakeworth: { name: 'Lake Worth Acreage', price: 54000, tier: 2, desc: 'Two acres of grass by the lake road. Room for a real shop.' },
  land_chisholm:  { name: 'Chisholm Flats Ranch Land', price: 38000, desc: 'Flat desert ground off Chisholm Trail Pkwy. Nobody hears you rev it out here.' },
};

// What you can build on your land. slots = garage spaces.
export const PLANS = [
  { id: 'starter',  name: 'Starter Home + 2-car garage',     price: 32000,  days: 1, slots: 2,  wall: '#b8a58a', roof: '#5a4632', desc: 'Two bedrooms, a porch and a carport you can close up.' },
  { id: 'ranch',    name: 'Ranch House + 4-car garage',      price: 98000,  days: 2, slots: 4,  wall: '#a0805e', roof: '#6b3a2e', desc: 'Brick ranch, big kitchen, a four-car garage with a lift.' },
  { id: 'modern',   name: 'Modern Build + 6-car showroom',   price: 265000, days: 3, slots: 6,  wall: '#d7d2c4', roof: '#2f343d', tier: 3, desc: 'Glass, concrete and a showroom you can see from the street.' },
  { id: 'compound', name: 'Compound + 10-car shop',          price: 740000, days: 4, slots: 10, wall: '#5d636b', roof: '#2a2e36', tier: 4, style: 'metal', wallH: 5.5, desc: 'Main house, guest house, and a ten-bay shop with a dyno cell.' },
];
export const PLAN_BY_ID = Object.fromEntries(PLANS.map(p => [p.id, p]));

// ---------------------------------------------------------------- product
// unit: what one of these is. buy: what the plug charges. street: what a
// customer usually pays. law: how much you're holding → the charge (Texas
// Health & Safety Code penalty groups, simplified to units on you).
export const DRUGS = [
  { id: 'loud',   name: 'Loud',   what: 'weed',          unit: 'oz',      buy: 140, street: 240, color: '#5fbf3a',
    law: [[1, 'B', 'Possession of marijuana'], [3, 'A', 'Possession of marijuana (over 2 oz)'], [5, 'SJF', 'Possession of marijuana (over 4 oz)'], [80, 'F3', 'Possession of marijuana (over 5 lb)']] },
  { id: 'percs',  name: 'Percs',  what: 'pills',         unit: '10 pills', buy: 95, street: 175, color: '#3aa0ff',
    law: [[1, 'SJF', 'Possession of a controlled substance (PG 1)'], [2, 'F3', 'Possession of a controlled substance (PG 1, over 1 g)'], [5, 'F2', 'Possession of a controlled substance (PG 1, over 4 g)'], [60, 'F1', 'Possession of a controlled substance (PG 1, over 200 g)']] },
  { id: 'lean',   name: 'Lean',   what: 'codeine syrup', unit: 'pint',    buy: 160, street: 300, color: '#b44aff',
    law: [[1, 'A', 'Possession of a controlled substance (PG 4)'], [3, 'SJF', 'Possession of a controlled substance (PG 4, over 28 g)'], [10, 'F3', 'Possession of a controlled substance (PG 4, over 200 g)']] },
  { id: 'powder', name: 'Powder', what: 'cocaine',       unit: '8-ball',  buy: 190, street: 340, color: '#f2f2f2',
    law: [[1, 'F3', 'Possession of a controlled substance (PG 1, over 1 g)'], [2, 'F2', 'Possession of a controlled substance (PG 1, over 4 g)'], [58, 'F1', 'Possession of a controlled substance (PG 1, over 200 g)']] },
];
export const DRUG_BY_ID = Object.fromEntries(DRUGS.map(d => [d.id, d]));

export const WORKER_PAY = 150;         // a day, for somebody to answer the door when you're not there
export const WORKER_CUT = 0.15;        // and he keeps a piece of every sale
