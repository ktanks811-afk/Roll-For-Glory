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
  // more of Stop Six: houses for sale and lots, each fronting a side street
  P('six_bungalow', 'property', 'Cass St Bungalow', 'N', 1200, -141, 1330, -21, { color: '#ffffff', icon: 'home' }),
  P('six_twostory', 'property', 'Amanda Ave Two-Story', 'N', 1700, -741, 1830, -621, { color: '#ffffff', icon: 'home' }),
  P('six_threestory', 'property', 'Stalcup Heights Three-Story', 'N', 2150, -591, 2280, -471, { color: '#ffffff', icon: 'home' }),
  P('land_six_bunche', 'land', 'Empty Lot · Bunche Dr', 'N', 1150, -591, 1280, -471, { color: '#c8a46a', icon: 'key' }),
  P('land_six_stalcup', 'land', 'Empty Lot · Stalcup Rd', 'N', 2350, -441, 2480, -321, { color: '#c8a46a', icon: 'key' }),
  // Johnson County (world2d/country.js): ranch land on the farm roads
  P('land_crosscreek', 'land', 'Cross Creek Pasture', 'W', -1480, 3800, -1240, 4020, { color: '#c8a46a', icon: 'key' }),
  P('land_buffalo', 'land', 'Buffalo Creek Ranch', 'N', -1100, 4520, -800, 4800, { color: '#c8a46a', icon: 'key' }),
  P('land_nolan', 'land', 'Nolan River Acreage', 'W', -2780, 4700, -2500, 4980, { color: '#c8a46a', icon: 'key' }),
  P('land_homestead', 'land', 'Old Cleburne Rd Homestead', 'W', 20, 3980, 240, 4200, { color: '#c8a46a', icon: 'key' }),
  P('land_bluebonnet', 'land', 'Bluebonnet Hill Ranch', 'S', -700, 5100, -380, 5380, { color: '#c8a46a', icon: 'key' }),
  // oil leases: pumpjacks and a tank battery, $40k a day once they're yours
  P('rig_godley', 'rig', 'Godley Pumpjack Lease', 'N', -2400, 3620, -2240, 3760, { color: '#e8c21a', icon: 'oil' }),
  P('rig_cleburne', 'rig', 'Cleburne Well Pad', 'N', -900, 3620, -740, 3760, { color: '#e8c21a', icon: 'oil' }),
  P('rig_riovista', 'rig', 'Rio Vista Oil Lease', 'N', -2000, 4520, -1840, 4660, { color: '#e8c21a', icon: 'oil' }),
  P('rig_alvarado', 'rig', 'Alvarado Tank Battery', 'N', 300, 4520, 460, 4660, { color: '#e8c21a', icon: 'oil' }),
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
// short: what the finished house is called. ranch: the biggest fence the
// land has room for (index into FENCES); country land runs cattle.
export const LAND = {
  land_stopsix:     { name: 'Empty Lot · Stop Six', short: 'Stop Six', price: 16000, ranch: 0, desc: 'A cleared lot on a Stop Six side street. Close to everything that matters on the east side.' },
  land_six_bunche:  { name: 'Empty Lot · Bunche Dr', short: 'Bunche Dr', price: 14000, ranch: 0, desc: 'Corner of Bunche and the alley. The neighbours have been here since the sixties.' },
  land_six_stalcup: { name: 'Empty Lot · Stalcup Rd', short: 'Stalcup Rd', price: 21000, ranch: 0, desc: 'A wide lot by Stalcup Rd. Big enough for a real garage and a yard for the dogs.' },
  land_lakeworth:   { name: 'Lake Worth Acreage', short: 'Lake Worth', price: 54000, tier: 2, ranch: 1, desc: 'Two acres of grass by the lake road. Room for a real shop.' },
  land_chisholm:    { name: 'Chisholm Flats Ranch Land', short: 'Chisholm Flats', price: 38000, ranch: 1, desc: 'Flat desert ground off Chisholm Trail Pkwy. Nobody hears you rev it out here.' },
  land_homestead:   { name: 'Old Cleburne Rd Homestead', short: 'Old Cleburne Rd', price: 120000, ranch: 1, country: true, desc: 'Fifteen acres on the edge of Joshua, a stock tank and an old windmill.' },
  land_crosscreek:  { name: 'Cross Creek Pasture', short: 'Cross Creek', price: 185000, ranch: 2, country: true, desc: 'Twenty-five acres of coastal Bermuda on County Road 1016. Ready for cattle.' },
  land_nolan:       { name: 'Nolan River Acreage', short: 'Nolan River', price: 260000, ranch: 2, country: true, desc: 'Thirty-five acres down by the Nolan River, live oaks and a creek crossing.' },
  land_buffalo:     { name: 'Buffalo Creek Ranch', short: 'Buffalo Creek', price: 340000, ranch: 2, country: true, desc: 'Forty acres on FM 4, cross-fenced once, good grass. Horse country.' },
  land_bluebonnet:  { name: 'Bluebonnet Hill Ranch', short: 'Bluebonnet Hill', price: 520000, ranch: 2, country: true, tier: 3, desc: 'Sixty acres on the high ground. You can see the Fort Worth skyline from the porch.' },
};

// The garage you build on your land. The house goes up with it (`house`
// is the design you start from) and you can redesign it any time after.
// slots = garage spaces.
export const PLANS = [
  { id: 'starter',  name: '2-car garage',              price: 18000,   days: 1, slots: 2,   house: 'starter', wall: '#b8a58a', roof: '#5a4632', desc: 'A two-car garage you can close up.' },
  { id: 'ranch',    name: '4-car garage with a lift',  price: 42000,   days: 1, slots: 4,   house: 'one', wall: '#a0805e', roof: '#6b3a2e', desc: 'Four bays, a two-post lift and a workbench.' },
  { id: 'modern',   name: '6-car showroom',            price: 110000,  days: 2, slots: 6,   house: 'two', wall: '#d7d2c4', roof: '#2f343d', tier: 3, desc: 'Glass, polished concrete and a showroom you can see from the street.' },
  { id: 'compound', name: '10-car shop',               price: 300000,  days: 2, slots: 10,  house: 'three', wall: '#5d636b', roof: '#2a2e36', tier: 4, style: 'metal', wallH: 5.5, desc: 'A ten-bay shop with a dyno cell and a paint booth.' },
  { id: 'barn',     name: '25-car barn',               price: 850000,  days: 3, slots: 25,  house: 'three', wall: '#7a2a22', roof: '#3a3d42', tier: 4, style: 'metal', wallH: 6, desc: 'A red steel barn, 25 cars on the floor and on lifts.' },
  { id: 'hangar',   name: '50-car hangar',             price: 1900000, days: 3, slots: 50,  house: 'three', wall: '#9aa0a8', roof: '#5d636b', tier: 4, style: 'metal', wallH: 7, desc: 'An aircraft hangar with car lifts four high. Fifty cars.' },
  { id: 'vault',    name: '100-car collector vault',   price: 3900000, days: 4, slots: 100, house: 'three', wall: '#2a2e36', roof: '#15171b', tier: 4, style: 'metal', wallH: 7.5, desc: 'A showroom floor and three levels underground with a car elevator. One hundred cars.' },
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

// ---------------------------------------------------------------- oil
// Oil leases in Johnson County. Each pays $40,000 a game day into your bank
// once it's yours. `jacks` = how many pumpjacks nod on the pad.
export const RIG_PAY = 40000;
export const RIGS = {
  rig_godley:   { name: 'Godley Pumpjack Lease', price: 1000000, jacks: 2, desc: 'Two pumpjacks on FM 917 and a lease that runs another forty years.' },
  rig_cleburne: { name: 'Cleburne Well Pad', price: 1150000, jacks: 3, desc: 'Three wells on one pad, right on the farm road. Easy for the trucks.' },
  rig_riovista: { name: 'Rio Vista Oil Lease', price: 1300000, jacks: 3, desc: 'Barnett Shale gas and oil. The tank battery fills every night.' },
  rig_alvarado: { name: 'Alvarado Tank Battery', price: 1500000, jacks: 4, desc: 'Four jacks and six tanks by the county line. The crown of the county.' },
};
export const RIG_SELL = 0.75;      // what a lease sells back for

// ---------------------------------------------------------------- ranching
// Fence a pasture on your land, then stock it. cap = head of livestock.
export const FENCES = [
  { id: 'rail',  name: 'Split-rail paddock',  price: 9000,  cap: 6,  color: '#8a6038', desc: 'Cedar posts and two rails. Room for a few head.' },
  { id: 'wire',  name: 'Barbed-wire pasture', price: 28000, cap: 20, color: '#8a8f96', desc: 'Five strands of barbed wire round the back acreage.' },
  { id: 'ranch', name: 'White ranch fence',   price: 65000, cap: 40, color: '#f2f2f2', desc: 'Four-board white fence and a pipe gate. The kind people slow down to look at.' },
];
export const FENCE_BY_ID = Object.fromEntries(FENCES.map(f => [f.id, f]));
// feed: what it costs to keep one a day. pays: what it brings in a day
// (calves, milk, stud fees). Dogs don't need a pasture.
export const ANIMALS = [
  { id: 'cow',      name: 'Angus cow',      price: 2200, feed: 14, pays: 80,  pen: true, color: '#1e1e20', icon: '🐄', desc: 'Black Angus. Calves sell at the Cleburne sale barn.' },
  { id: 'longhorn', name: 'Texas Longhorn', price: 4800, feed: 18, pays: 140, pen: true, color: '#b06a32', icon: '🐂', desc: 'Horns six feet tip to tip. People pay to see them.' },
  { id: 'horse',    name: 'Quarter horse',  price: 8500, feed: 35, pays: 240, pen: true, color: '#7a4a2a', icon: '🐎', desc: 'A sorrel quarter horse. Stud and boarding fees.' },
  { id: 'dog',      name: 'Dog',            price: 450,  feed: 4,  pays: 0,   max: 4, color: '#8a6a4a', icon: '🐕', desc: 'Runs the yard and comes when you pull up.',
    breeds: [['Pit bull', '#9a8a7a'], ['German shepherd', '#6a4a2a'], ['Blue heeler', '#6a7a8a'], ['Rottweiler', '#1e1a18'], ['Golden retriever', '#d9a85a']] },
];
export const ANIMAL_BY_ID = Object.fromEntries(ANIMALS.map(a => [a.id, a]));
