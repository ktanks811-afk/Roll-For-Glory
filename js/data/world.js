import { STREET_RACES, raceStart } from './streetRaces.js';
import { ESTATE_LOCATIONS, TRAPS } from './estate.js';

// Fort Worth — map layout. The city is a 12x12-block grid (150 m blocks)
// with a highway to the north, desert to the south, mountains to the west
// and the harbor to the south-east. Positions are metres; -z is north.

export const GRID = [];
for (let v = -900; v <= 900; v += 150) GRID.push(v);
export const BLOCK = 150;
export const ROAD_W = 16;          // city street, kerb to kerb
export const HWY_Z = -1350;        // Loop 820 centreline
export const HWY_X = [-2700, 2700];
export const HWY_W = 30;
export const DESERT_Z = 1050;      // desert starts south of here
export const DESERT_ROAD_END = 2700;
export const RIVER_X = -1650;
export const TUNNEL = [1450, 1900];
export const SEA_X = 1000;         // harbor water east of here (south half)

export const STREET_NS = ['Hulen St', 'Montgomery St', 'University Dr', 'Henderson St', 'Throckmorton St', 'Houston St', 'Main St', 'Commerce St', 'Jones St', 'Riverside Dr', 'Beach St', 'Oakland Blvd', 'Lake Worth Blvd'];
export const STREET_EW = ['NE 28th St', 'Stockyards Blvd', 'Exchange Ave', 'Northside Dr', 'Belknap St', 'Weatherford St', 'W 7th St', 'Lancaster Ave', 'Vickery Blvd', 'Rosedale St', 'Magnolia Ave', 'Berry St', 'Seminary Dr'];

export function districtAt(x, z) {
  if (z < -1000) return 'Loop 820';
  if (z > DESERT_Z) return 'Chisholm Flats';
  if (x < -1000) return z < -100 ? 'Cross Timbers' : 'Benbrook Hills';
  if (x > SEA_X) return z > 190 ? 'Lake Worth' : z > -1000 ? 'Stop Six' : 'Lake Worth Shore';
  if (Math.abs(x) <= 300 && Math.abs(z) <= 300) return 'Downtown';
  if (x > 300) return z > 600 ? 'Lakeside' : 'Riverside Industrial';
  if (x < -300) return 'Arlington Heights';
  return z < 0 ? 'Stockyards' : 'Near Southside';
}

export function blockCenter(i, j) {
  return { x: -825 + BLOCK * i, z: -825 + BLOCK * j };
}

// Point on the kerb of block (i,j), facing the street on `side`.
function front(i, j, side, along = 0) {
  const c = blockCenter(i, j);
  const d = BLOCK / 2 - 13;
  switch (side) {
    case 'N': return { x: c.x + along, z: c.z - d, face: Math.PI };
    case 'S': return { x: c.x + along, z: c.z + d, face: 0 };
    case 'E': return { x: c.x + d, z: c.z + along, face: Math.PI / 2 };
    case 'W': return { x: c.x - d, z: c.z + along, face: -Math.PI / 2 };
  }
}

// type: what pressing E does there. tier: rep tier to use it.
const L = (id, type, name, i, j, side, extra = {}) => ({ id, type, name, block: [i, j], side, ...front(i, j, side), ...extra });

export const LOCATIONS = [
  L('eastgate_studio', 'home', 'Eastgate Studio (Home)', 8, 6, 'W', { color: '#ffffff', icon: 'home' }),
  L('rusty_used', 'usedlot', "Rusty's Used Autos", 5, 9, 'N', { color: '#c8b98a', icon: 'car', contact: 'sal' }),
  L('auto_row', 'dealer', 'Cowtown Auto Row (Ford · Chevy · Dodge · Ram · Jeep · GMC · Cadillac)', 6, 4, 'S', { color: '#f2f2f2', icon: 'car',
    makes: ['ford', 'lincoln', 'chevrolet', 'gmc', 'cadillac', 'buick', 'dodge', 'chrysler', 'ram', 'jeep'] }),
  L('pacific_imports', 'dealer', 'Pacific Imports (Toyota · Honda · Nissan · Mazda · Subaru · Hyundai · Kia)', 7, 4, 'S', { color: '#f2f2f2', icon: 'car',
    makes: ['toyota', 'lexus', 'honda', 'acura', 'nissan', 'infiniti', 'mazda', 'subaru', 'mitsubishi', 'hyundai', 'kia', 'genesis', 'scion'] }),
  L('eurohaus', 'dealer', 'EuroHaus Motors (BMW · Mercedes · Audi · VW · Porsche)', 4, 4, 'S', { color: '#f2f2f2', icon: 'car',
    makes: ['bmw', 'mercedes', 'audi', 'volkswagen', 'porsche', 'volvo', 'mini', 'jaguar', 'landrover', 'alfaromeo'] }),
  L('volt_row', 'dealer', 'Volt Row EV Center (Tesla · Rivian · Lucid)', 3, 4, 'S', { color: '#13b3c4', icon: 'car', makes: ['tesla', 'rivian', 'lucid'] }),
  L('halo_exotics', 'dealer', 'Halo Exotics (Ferrari · Lamborghini · McLaren · Aston Martin · Bentley)', 5, 2, 'S', { color: '#e8c21a', icon: 'car',
    makes: ['ferrari', 'lamborghini', 'mclaren', 'astonmartin', 'bentley', 'rollsroyce', 'maserati', 'lotus', 'bugatti', 'koenigsegg', 'pagani'] }),
  L('torque_temple', 'perf', 'Torque Temple Performance', 9, 5, 'W', { color: '#e8641a', icon: 'wrench', contact: 'rosa' }),
  L('vega_kustoms', 'visual', 'Vega Kustoms', 3, 7, 'E', { color: '#d12a8a', icon: 'spray', contact: 'manny' }),
  L('second_chance', 'repair', 'Second Chance Collision', 7, 8, 'N', { color: '#1b4fc4', icon: 'repair' }),
  L('gas_westbrook', 'gas', 'Volt & Petrol', 2, 4, 'E', { color: '#1f8f3a', icon: 'gas' }),
  L('gas_harbor', 'gas', 'Gas-N-Go', 10, 8, 'W', { color: '#1f8f3a', icon: 'gas' }),
  L('gas_south', 'gas', 'Volt & Petrol', 6, 10, 'N', { color: '#1f8f3a', icon: 'gas' }),
  L('luckys', 'food', "Lucky's 24hr Diner", 6, 7, 'N', { color: '#e8c21a', icon: 'food' }),
  L('noodle', 'food', 'Midnight Noodle Bar', 9, 3, 'S', { color: '#e8c21a', icon: 'food' }),
  // corner stores: snacks, smokes and scratchers behind bulletproof glass
  L('corner_rosedale', 'corner', 'Rosedale Food Mart', 6, 9, 'N', { color: '#ff8a1a', icon: 'food' }),
  L('corner_northside', 'corner', 'Northside Quick Stop', 6, 2, 'S', { color: '#ff8a1a', icon: 'food' }),
  L('corner_riverside', 'corner', 'Riverside Mini Mart', 9, 4, 'W', { color: '#ff8a1a', icon: 'food' }),
  L('corner_camp_bowie', 'corner', 'Camp Bowie Corner Store', 2, 5, 'E', { color: '#ff8a1a', icon: 'food' }),
  L('threadline', 'clothing', 'Threadline Streetwear', 4, 6, 'E', { color: '#a01aff', icon: 'shirt' }),
  L('surplus', 'clothing', 'Riverside Army Surplus', 8, 9, 'W', { color: '#a01aff', icon: 'shirt', shop: 'surplus' }),
  L('bayline', 'realty', 'Bayline Realty', 5, 5, 'S', { color: '#1f8f3a', icon: 'key', contact: 'priya' }),
  L('pspd_central', 'police', 'FWPD Central Precinct', 5, 6, 'N', { color: '#1b4fc4', icon: 'shield' }),
  L('jps', 'hospital', 'JPS Hospital', 6, 8, 'W', { color: '#e0192e', icon: 'cross' }),   // John Peter Smith, the county trauma center on S Main St
  L('pspd_harbor', 'police', 'FWPD Lake Worth Precinct', 10, 10, 'N', { color: '#1b4fc4', icon: 'shield' }),
  L('harbor_loft', 'property', 'Lakeside Loft', 9, 10, 'N', { color: '#ffffff', icon: 'home' }),
  L('westside_house', 'property', 'Arlington Heights House', 1, 6, 'E', { color: '#ffffff', icon: 'home' }),
  L('hillcrest_villa', 'property', 'Hillcrest Villa', 0, 1, 'E', { color: '#ffffff', icon: 'home' }),
  L('foundry_warehouse', 'property', 'Foundry Warehouse Garage', 11, 3, 'W', { color: '#ffffff', icon: 'home' }),
  L('fairmount_craftsman', 'property', 'Fairmount Craftsman', 4, 9, 'N', { color: '#ffffff', icon: 'home' }),
  L('westover_estate', 'property', 'Westover Hills Estate', 0, 3, 'E', { color: '#ffffff', icon: 'home' }),
  L('rivercrest_mansion', 'property', 'Rivercrest Mansion', 1, 8, 'E', { color: '#ffffff', icon: 'home' }),
  L('trap_riverside', 'trap', 'Riverside Duplex', 10, 4, 'W', { color: '#8a1a1a', icon: 'home' }),
  L('hook_haul', 'work', 'Hook & Haul Towing', 10, 6, 'S', { color: '#f0a020', icon: 'tow' }),
  L('stockyards_show', 'carshow', 'Stockyards Car Show', 7, 3, 'W', { color: '#e8c21a', icon: 'trophy' }),
  L('pier9', 'meet', 'Pier 9 Lot', 11, 11, 'W', { color: '#ff1a2e', icon: 'meet', tier: 1 }),
  L('kessler_lot', 'meet', 'Kessler Mall Lot', 2, 9, 'N', { color: '#ff1a2e', icon: 'meet', tier: 2 }),
  // weekend night meet (Fri + Sat, 9 PM to 3 AM): ui/nightmeet.js
  L('gran_plaza', 'meet', 'La Gran Plaza Lot', 7, 10, 'N', { color: '#ff1a2e', icon: 'meet', weekend: true }),
  L('old_foundry', 'meet', 'The Old Foundry', 10, 2, 'S', { color: '#ff1a2e', icon: 'meet', tier: 3 }),
  // on the lawn in front of the pink granite courthouse (block 5,4; scenery draws the building)
  { id: 'courthouse', type: 'court', name: 'Tarrant County Courthouse', x: -75, z: -163, face: 0, color: '#c9a68a', icon: 'court' },
  { id: 'ironline', type: 'drag', name: 'Ironline Dragway', x: 34, z: 1260, face: Math.PI / 2, color: '#ff1a2e', icon: 'flag' },
  { id: 'glory_onramp', type: 'roll', name: 'Loop 820 On-Ramp', x: 12, z: -1180, face: Math.PI, color: '#ff1a2e', icon: 'flag', road: 'highway' },
  { id: 'ironside_start', type: 'roll', name: 'East Lancaster Runs', x: 312, z: 650, face: 0, color: '#ff1a2e', icon: 'flag', road: 'industrial' },
  { id: 'dustline_start', type: 'roll', name: 'Chisholm Trail Pkwy', x: 12, z: 1120, face: 0, color: '#ff1a2e', icon: 'flag', road: 'desert', tier: 2 },
  { id: 'northridge_start', type: 'roll', name: 'Cross Timbers Pass', x: -1120, z: -330, face: -Math.PI / 2, color: '#ff1a2e', icon: 'flag', road: 'mountain', tier: 4 },
  { id: 'gas_desert', type: 'gas', name: 'Last Chance Gas', x: -24, z: 1700, face: -Math.PI / 2, color: '#1f8f3a', icon: 'gas' },
  // street race start lines (routes in data/streetRaces.js)
  // trap houses, land for sale and the plug, off the city grid (data/estate.js)
  ...ESTATE_LOCATIONS,
  ...STREET_RACES.map(ev => { const st = raceStart(ev); return { id: ev.id, type: 'sprint', name: ev.name, x: st.x, z: st.z, face: st.h, color: '#ffbe1e', icon: 'flag', tier: ev.tier > 1 ? ev.tier : undefined, race: ev.id }; }),
];

export const LOC_BY_ID = Object.fromEntries(LOCATIONS.map(l => [l.id, l]));

// Homes. `slots` is garage capacity. Safehouses clear a pursuit in cooldown.
export const PROPERTIES = {
  eastgate_studio:   { name: 'Eastgate Studio', price: 0, slots: 2, desc: 'One room, one window, a two-car shared carport. Home.' },
  harbor_loft:       { name: 'Lakeside Loft', price: 42000, slots: 3, desc: 'Converted cannery loft with a view of the cranes.' },
  westside_house:    { name: 'Arlington Heights House', price: 135000, slots: 4, desc: 'Quiet street, four-car garage with a lift.' },
  hillcrest_villa:   { name: 'Hillcrest Villa', price: 780000, slots: 8, desc: 'Hillside glass house with a heated showroom garage.', tier: 4 },
  foundry_warehouse: { name: 'Foundry Warehouse Garage', price: 260000, slots: 12, desc: 'A crew HQ: dyno cell, paint booth, twelve bays.', tier: 3 },
  fairmount_craftsman: { name: 'Fairmount Craftsman', price: 340000, slots: 6, desc: 'Restored 1920s craftsman on a Southside street, six-car garage out back.', tier: 3, wall: '#7f8a6a', roof: '#4a3a2e' },
  westover_estate:   { name: 'Westover Hills Estate', price: 1450000, slots: 10, desc: 'Gated, a pool, and a ten-car gallery garage with a turntable.', tier: 4, wall: '#d9d0bc', roof: '#3a4a3a' },
  rivercrest_mansion: { name: 'Rivercrest Mansion', price: 3600000, slots: 14, desc: 'Country club money. Fourteen climate-controlled bays and a car elevator.', tier: 5, wall: '#e8e2d8', roof: '#2f3b4a', wallH: 5.2 },
  // trap houses (data/estate.js): customers knock, SWAT might too
  ...Object.fromEntries(Object.entries(TRAPS).map(([id, t]) => [id, { ...t, trap: true }])),
};

// Race roads available for roll racing (built by race/track.js).
export const ROADS = {
  industrial: { name: 'East Lancaster', theme: 'industrial', lanes: 4, traffic: 0.35, tier: 1, heat: 0.6, desc: 'Four lanes between the warehouses. Trucks at night.' },
  highway:    { name: 'Loop 820', theme: 'highway', lanes: 6, traffic: 0.55, tier: 1, heat: 1.0, desc: 'Six lanes, long and straight, and the troopers know it.' },
  desert:     { name: 'Chisholm Trail Pkwy', theme: 'desert', lanes: 2, traffic: 0.12, tier: 2, heat: 0.3, desc: 'Two-lane desert straight. Nothing out here but heat haze.' },
  mountain:   { name: 'Cross Timbers Pass Straight', theme: 'mountain', lanes: 2, traffic: 0.2, tier: 4, heat: 0.4, desc: 'The one straight piece of the pass. Pine trees and a long drop.' },
  strip:      { name: 'Ironline Dragway', theme: 'strip', lanes: 2, traffic: 0, tier: 1, heat: 0, desc: 'Sanctioned strip. Prepped surface, real timing.' },
};

export const ROLL_SPEEDS = [30, 40, 50, 60, 70];
export const ROLL_DISTANCES = [
  { id: 'eighth', name: '1/8 mile' }, { id: 'quarter', name: '1/4 mile' },
  { id: 'half', name: '1/2 mile' }, { id: 'mile', name: '1 mile' },
];
export const DRAG_DISTANCES = [
  { id: 'eighth', name: '1/8 mile' }, { id: 'quarter', name: '1/4 mile' }, { id: 'half', name: '1/2 mile' },
];

// Wager ceilings per tier.
export const WAGER_CAP = [0, 1500, 6000, 20000, 75000, 300000];

export const GAS = { regular: 3.79, premium: 4.59, e85: 2.99, kwh: 0.38 };
