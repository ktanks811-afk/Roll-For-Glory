import { STREET_RACES, raceStart } from './streetRaces.js';
import { ESTATE_LOCATIONS, TRAPS } from './estate.js';
import { FOOD_SPOTS } from './food.js';

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
// Johnson County: farm country past the end of the desert, south of the city
export const COUNTRY = { x0: -3300, x1: 1000, z0: 3300, z1: 5800 };
export const COUNTRY_ROADS = { x: [-2800, -1500, 0, 700], z: [3600, 4500, 5400] };
// Dallas: east of Fort Worth down I-30, which carries on from the east end of
// Loop 820 past Arlington. Its own 10x10-block grid (150 m blocks); I-30 cuts
// through the middle of it (row 5), downtown and Deep Ellum north of the
// freeway, Oak Cliff and South Dallas south of it. world2d/dallas.js fills it in.
export const DALLAS = { x0: 4650, x1: 6150, z0: -2100, z1: -600 };
export const DGRID_X = [], DGRID_Z = [];
for (let v = DALLAS.x0; v <= DALLAS.x1; v += 150) DGRID_X.push(v);
for (let v = DALLAS.z0; v <= DALLAS.z1; v += 150) DGRID_Z.push(v);
export const I30_ROW = 5;                    // DGRID_Z[5] === HWY_Z: I-30 runs on that street line
export const I30_END = 6600;                 // where the freeway runs out east of Dallas
export const DALLAS_ZONE = { x0: 3300, x1: 6800, z0: -2500, z1: -250 };   // the corridor and the city, open to drive
export const DTRINITY_X = 4440;              // the Trinity River, west of downtown Dallas (80 m wide)
export const ARLINGTON_X = 3800;             // I-30 exit at the stadium
export const ARLINGTON_END = -700;           // Collins St runs south from the exit to here
export const inDallas = (x, z) => x > DALLAS.x0 - 12 && x < DALLAS.x1 + 12 && z > DALLAS.z0 - 12 && z < DALLAS.z1 + 12;
// North Texas: up I-35W from Loop 820, past the Alliance warehouses and the
// airport, Texas Motor Speedway at TX-114, Northlake and Argyle, Roanoke down
// 114, and Denton at the top with Lake Lewisville to the east. Denton is its
// own 8x8-block grid (150 m blocks); its west street line is I-35 itself.
// world2d/north.js fills it in.
export const NORTH = { x0: -1400, x1: 3200, z0: -7700, z1: -3300 };     // open to drive, north of the old map edge
export const DENTON = { x0: 0, x1: 1200, z0: -7000, z1: -5800 };
export const DNGRID_X = [], DNGRID_Z = [];
for (let v = DENTON.x0; v <= DENTON.x1; v += 150) DNGRID_X.push(v);
for (let v = DENTON.z0; v <= DENTON.z1; v += 150) DNGRID_Z.push(v);
export const I35_END = -7550;                // where I-35 runs out north of Denton
export const HTRACE_Z = -3900;               // Heritage Trace Pkwy, Alliance
export const WESTPORT_Z = -3660;             // Westport Pkwy, through the warehouses
export const TX114_Z = -4600;                // TX-114, west to Rhome and east to Roanoke
export const TX114_X = [-1300, 3150];
export const ROANOKE_X = 2200;               // Oak St; US-377 runs north from here to Denton
export const ROANOKE_END = -4220;            // Oak St runs south from 114 to here
export const US377_Z = -6250;                // US-377 comes into Denton on Dallas Dr (Denton row 5)
export const TMS = { x0: 300, x1: 1000, z0: -5300, z1: -4850 };   // Texas Motor Speedway: the oval (a ring of track)
export const TMS_PIT_X = 650;                // pit road from 114 up to the oval
export const AIRPORT_X = 900;                // Alliance Blvd, from Heritage Trace into the airport
export const LEWISVILLE = { x0: 2450, x1: 3150, z0: -6900, z1: -4900 };   // Lake Lewisville
export const inDenton = (x, z) => x > DENTON.x0 - 12 && x < DENTON.x1 + 12 && z > DENTON.z0 - 12 && z < DENTON.z1 + 12;
export const inNorth = (x, z) => z < NORTH.z1 && x > NORTH.x0 && x < NORTH.x1;
// either city grid outside Fort Worth (sidewalks, red lights, pavement)
export const inCityGrid = (x, z) => inDallas(x, z) || inDenton(x, z);

export const STREET_NS = ['Hulen St', 'Montgomery St', 'University Dr', 'Henderson St', 'Throckmorton St', 'Houston St', 'Main St', 'Commerce St', 'Jones St', 'Riverside Dr', 'Beach St', 'Oakland Blvd', 'Lake Worth Blvd'];
export const DSTREET_NS = ['Sylvan Ave', 'Riverfront Blvd', 'Lamar St', 'Griffin St', 'Akard St', 'Ervay St', 'Harwood St', 'Pearl St', 'Good Latimer Expy', 'Exposition Ave', 'Haskell Ave'];
export const DSTREET_EW = ['Lemmon Ave', 'McKinney Ave', 'Ross Ave', 'Elm St', 'Commerce St', 'I-30', 'Jefferson Blvd', 'Davis St', 'MLK Jr Blvd', 'Illinois Ave', 'Kiest Blvd'];
export const DNSTREET_NS = ['I-35', 'Bonnie Brae St', 'Avenue C', 'Carroll Blvd', 'Elm St', 'Locust St', 'Bell Ave', 'Wood St', 'Loop 288'];
export const DNSTREET_EW = ['University Dr', 'Sherman Dr', 'Oak St', 'Hickory St', 'Mulberry St', 'Dallas Dr', 'Eagle Dr', 'Teasley Ln', 'Hwy 380 Bypass'];
export const STREET_EW = ['NE 28th St', 'Stockyards Blvd', 'Exchange Ave', 'Northside Dr', 'Belknap St', 'Weatherford St', 'W 7th St', 'Lancaster Ave', 'Vickery Blvd', 'Rosedale St', 'Magnolia Ave', 'Berry St', 'Seminary Dr'];

export function districtAt(x, z) {
  if (x > DALLAS_ZONE.x0 && z < DALLAS_ZONE.z1 + 400) return dallasDistrict(x, z);
  if (z < NORTH.z1 && x > NORTH.x0 - 200) return northDistrict(x, z);
  if (z < HWY_Z - 60 && Math.abs(x) < 60) return 'I-35W';
  if (z < -1000) return 'Loop 820';
  if (z > COUNTRY.z0) return 'Johnson County';
  if (z > DESERT_Z) return 'Chisholm Flats';
  if (x < -1000) return z < -100 ? 'Cross Timbers' : 'Benbrook Hills';
  if (x > SEA_X) return z > 190 ? 'Lake Worth' : z > -1000 ? 'Stop Six' : 'Lake Worth Shore';
  if (Math.abs(x) <= 300 && Math.abs(z) <= 300) return 'Downtown';
  if (x > 300) return z > 600 ? 'Lakeside' : 'Riverside Industrial';
  if (x < -300) return 'Arlington Heights';
  return z < 0 ? 'Stockyards' : 'Near Southside';
}

function dallasDistrict(x, z) {
  if (x < DTRINITY_X - 60) return Math.abs(x - ARLINGTON_X) < 350 ? 'Arlington' : 'I-30';
  if (x > DALLAS.x1 + 40 || z < DALLAS.z0 - 40 || z > DALLAS.z1 + 40) return x > DALLAS.x1 ? 'East Dallas' : 'Dallas';
  const i = Math.floor((x - DALLAS.x0) / BLOCK), j = Math.floor((z - DALLAS.z0) / BLOCK);
  if (x < DALLAS.x0) return z < HWY_Z ? 'Trinity Groves' : 'Oak Cliff';
  if (j <= 4) {
    if (i <= 1) return 'West Dallas';
    if (j <= 1) return 'Uptown';
    return i >= 7 ? 'Deep Ellum' : 'Downtown Dallas';
  }
  return i <= 4 ? 'Oak Cliff' : 'South Dallas';
}
function northDistrict(x, z) {
  if (inDenton(x, z)) {
    const i = Math.floor((x - DENTON.x0) / BLOCK), j = Math.floor((z - DENTON.z0) / BLOCK);
    if (i >= 3 && i <= 5 && j <= 1) return 'TWU';
    if (i >= 3 && i <= 5 && j <= 4) return 'The Square';
    if (i <= 2 && j >= 3) return 'UNT';
    if (i <= 2) return 'North Denton';
    if (i >= 6 && j <= 4) return 'East Denton';
    return 'Southeast Denton';
  }
  if (z < DENTON.z1 + 40 && z > DENTON.z0 - 400 && x > -400 && x < LEWISVILLE.x0 - 100) return 'Denton';
  if (x > LEWISVILLE.x0 - 100 && z < LEWISVILLE.z1 + 60) return 'Lake Lewisville';
  if (x > TMS.x0 - 160 && x < TMS.x1 + 160 && z > TMS.z0 - 120 && z < TX114_Z) return 'Texas Motor Speedway';
  if (Math.abs(x - ROANOKE_X) < 380 && z > TX114_Z - 250 && z < ROANOKE_END + 120) return 'Roanoke';
  if (z > HTRACE_Z) return 'Alliance';
  if (z > TX114_Z - 20) return x > 300 ? 'Alliance Airport' : x > -40 ? 'I-35W' : 'Northlake';
  if (Math.abs(x) < 40) return 'I-35W';
  return x < 0 ? 'Argyle' : x > ROANOKE_X - 120 ? 'US-377' : 'Justin Prairie';
}
export const DENTON_DISTRICTS = ['TWU', 'The Square', 'UNT', 'North Denton', 'East Denton', 'Southeast Denton'];
export const NORTH_DISTRICTS = [...DENTON_DISTRICTS, 'Denton', 'Lake Lewisville', 'Texas Motor Speedway', 'Roanoke', 'Alliance', 'Alliance Airport', 'Northlake', 'Argyle', 'US-377', 'Justin Prairie'];
export const DALLAS_DISTRICTS = ['Uptown', 'Downtown Dallas', 'Deep Ellum', 'West Dallas', 'Oak Cliff', 'South Dallas'];

export function blockCenter(i, j, city) {
  if (city === 'denton') return { x: DENTON.x0 + BLOCK / 2 + BLOCK * i, z: DENTON.z0 + BLOCK / 2 + BLOCK * j };
  if (city === 'dallas') return { x: DALLAS.x0 + BLOCK / 2 + BLOCK * i, z: DALLAS.z0 + BLOCK / 2 + BLOCK * j };
  return { x: -825 + BLOCK * i, z: -825 + BLOCK * j };
}

// Point on the kerb of block (i,j), facing the street on `side`.
function front(i, j, side, along = 0, city) {
  const c = blockCenter(i, j, city);
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
// the same on a Dallas block
const D = (id, type, name, i, j, side, extra = {}) => ({ id, type, name, block: [i, j], city: 'dallas', side, ...front(i, j, side, 0, 'dallas'), ...extra });
// and on a Denton block
const N = (id, type, name, i, j, side, extra = {}) => ({ id, type, name, block: [i, j], city: 'denton', side, ...front(i, j, side, 0, 'denton'), ...extra });

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
  L('second_chance', 'repair', 'Second Chance Collision', 7, 8, 'N', { color: '#1b4fc4', icon: 'repair', tagline: 'Body · mechanical · tires · we work with all insurers' }),
  // more mechanic shops (same repair counter, own prices: `rate`)
  L('cowtown_tire', 'repair', 'Cowtown Tire & Lube', 4, 10, 'N', { color: '#1b4fc4', icon: 'repair', rate: 0.85, tagline: 'Tires, oil, brakes · cash price beats the dealer' }),
  L('northside_garage', 'repair', 'Northside Garage', 4, 1, 'S', { color: '#1b4fc4', icon: 'repair', rate: 0.95, tagline: 'Family shop since 1971 · trucks and classics' }),
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
  L('marchetti_salvage', 'chop', 'Marchetti Salvage', 10, 7, 'N', { color: '#c9752a', icon: 'wrench', contact: 'junior' }),
  L('cashcow_pawn', 'pawn', 'Cash Cow Pawn & Gold', 9, 7, 'W', { color: '#d4a017', icon: 'tow' }),
  L('hook_haul', 'work', 'Hook & Haul Towing', 10, 6, 'S', { color: '#f0a020', icon: 'tow' }),
  // car haulers and enclosed trailers (ui/trailers.js); only trucks pull them
  L('trailer_lot', 'trailers', 'Cowtown Trailer & Truck Sales', 9, 6, 'W', { color: '#f0a020', icon: 'tow' }),
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
  // Joshua, out in Johnson County (world2d/country.js draws the town)
  { id: 'gas_joshua', type: 'gas', name: 'Joshua Country Store', x: 36, z: 3705, face: Math.PI / 2, color: '#1f8f3a', icon: 'gas' },
  // Joshua's tire shop on FM 917 (world2d/country.js puts the building there)
  { id: 'joshua_lube', type: 'repair', name: 'Joshua Tire & Lube', x: 215, z: 3592, face: 0, side: 'S', color: '#1b4fc4', icon: 'repair', rate: 0.75, tagline: 'Country prices · farm trucks first, but we\'ll get to you' },
  // Arlington: the I-30 exit by the stadium (world2d/dallas.js)
  { id: 'arlington_service', type: 'repair', name: 'I-30 Truck & Auto', x: ARLINGTON_X + 250, z: HWY_Z + 20, face: 0, side: 'N', color: '#1b4fc4', icon: 'repair', rate: 1.05, tagline: 'Off the Arlington exit · open 24 hours · diesel and gas' },
  { id: 'gas_arlington', type: 'gas', name: 'Gas-N-Go Arlington', x: ARLINGTON_X - 250, z: HWY_Z + 20, face: 0, side: 'N', color: '#1f8f3a', icon: 'gas' },
  // ---------------- Dallas (block i,j on the Dallas grid; I-30 runs between rows 4 and 5) ----------------
  D('deep_ellum_motor', 'repair', 'Deep Ellum Motorworks', 8, 3, 'N', { color: '#1b4fc4', icon: 'repair', tagline: 'Tuner shop and full service · we fix what you broke at the meet' }),
  D('oakcliff_trans', 'repair', 'Oak Cliff Auto & Transmission', 2, 6, 'N', { color: '#1b4fc4', icon: 'repair', rate: 0.9, tagline: 'Transmissions our specialty · se habla español' }),
  D('uptown_euro', 'repair', 'Uptown Euro Service', 6, 1, 'S', { color: '#1b4fc4', icon: 'repair', rate: 1.3, tagline: 'BMW · Mercedes · Porsche · loaner cars, espresso, Uptown prices' }),
  D('mlk_wrench', 'repair', 'MLK Wrench House', 6, 8, 'N', { color: '#1b4fc4', icon: 'repair', rate: 0.8, tagline: 'Cheapest labor in Dallas · used parts when you ask' }),
  D('gas_deep_ellum', 'gas', 'Volt & Petrol', 7, 2, 'S', { color: '#1f8f3a', icon: 'gas' }),
  D('gas_oakcliff', 'gas', 'Gas-N-Go', 1, 7, 'E', { color: '#1f8f3a', icon: 'gas' }),
  D('corner_grand', 'corner', 'Grand Ave Food Mart', 7, 7, 'W', { color: '#ff8a1a', icon: 'food' }),
  D('corner_ellum', 'corner', 'Elm St Corner Store', 9, 3, 'W', { color: '#ff8a1a', icon: 'food' }),
  D('big_d_customs', 'perf', 'Big D Performance', 0, 3, 'E', { color: '#e8641a', icon: 'wrench', owner: 'Dre', tagline: 'Dre Vega, Rosa\'s cousin · dyno cell · Dallas' }),
  D('ellum_meet', 'meet', 'Deep Ellum Warehouse Lot', 9, 1, 'S', { color: '#ff1a2e', icon: 'meet', tier: 2 }),
  D('uptown_condo', 'property', 'Uptown High-Rise Condo', 4, 0, 'S', { color: '#ffffff', icon: 'home' }),
  D('kessler_tudor', 'property', 'Kessler Park Tudor', 0, 8, 'E', { color: '#ffffff', icon: 'home' }),
  // ---------------- North Texas (world2d/north.js) ----------------
  // Alliance: the Heritage Trace exit off I-35W, a travel center and a diesel shop on the south frontage
  { id: 'gas_alliance', type: 'gas', name: 'Speedway Travel Center', x: -130, z: HTRACE_Z + 14, face: 0, side: 'N', color: '#1f8f3a', icon: 'gas' },
  { id: 'alliance_diesel', type: 'repair', name: 'Alliance Truck & Diesel', x: 190, z: HTRACE_Z + 14, face: 0, side: 'N', color: '#1b4fc4', icon: 'repair', rate: 0.95, tagline: 'Big rigs, trailers and pickups · off I-35W at Heritage Trace' },
  // the Texas Motor Speedway lot, on 114 by the pit road (the oval itself is open to drive)
  { id: 'tms_lot', type: 'meet', name: 'Texas Motor Speedway Lot', x: TMS_PIT_X + 60, z: TX114_Z - 14, face: Math.PI, side: 'S', color: '#ff1a2e', icon: 'meet', tier: 3 },
  // Roanoke: Oak St off 114
  { id: 'roanoke_food', type: 'food', name: 'Oak Street Smokehouse', x: ROANOKE_X - 14, z: -4440, face: -Math.PI / 2, side: 'E', color: '#e8c21a', icon: 'food' },
  { id: 'roanoke_repair', type: 'repair', name: 'Roanoke Lube & Brake', x: ROANOKE_X + 14, z: -4360, face: Math.PI / 2, side: 'W', color: '#1b4fc4', icon: 'repair', rate: 0.85, tagline: 'Small-town shop on Oak St · oil, brakes and tires' },
  // Denton (block i,j on the Denton grid; I-35 is its west street line)
  N('denton_motor', 'repair', 'Denton Square Auto & Tire', 6, 4, 'N', { color: '#1b4fc4', icon: 'repair', rate: 0.9, tagline: 'A block off the Square · college-kid prices' }),
  N('gas_denton', 'gas', 'Volt & Petrol', 2, 2, 'S', { color: '#1f8f3a', icon: 'gas' }),
  N('gas_denton_east', 'gas', 'Gas-N-Go', 7, 5, 'W', { color: '#1f8f3a', icon: 'gas' }),
  N('corner_fry', 'corner', 'Fry St Food Mart', 2, 3, 'N', { color: '#ff8a1a', icon: 'food' }),
  N('corner_se_denton', 'corner', 'Southeast Quick Stop', 5, 6, 'W', { color: '#ff8a1a', icon: 'food' }),
  N('north_star_perf', 'perf', 'North Star Performance', 6, 1, 'S', { color: '#e8641a', icon: 'wrench', owner: 'Tee', tagline: 'Tee Mosley · built Speedway track cars for twenty years · Denton' }),
  N('fry_meet', 'meet', 'Fry Street Lot', 1, 2, 'S', { color: '#ff1a2e', icon: 'meet', tier: 2 }),
  N('denton_pd', 'police', 'Denton PD', 5, 5, 'N', { color: '#1b4fc4', icon: 'shield' }),
  N('denton_trucks', 'dealer', 'Denton County Trucks (Ford · Chevy · Ram · GMC)', 7, 2, 'W', { color: '#f2f2f2', icon: 'car', makes: ['ford', 'chevrolet', 'ram', 'gmc'] }),
  N('denton_diner', 'food', 'Mean Green Diner', 3, 5, 'N', { color: '#e8c21a', icon: 'food' }),
  N('denton_pawn', 'pawn', 'Denton Gold & Pawn', 6, 6, 'N', { color: '#d4a017', icon: 'tow' }),
  N('oak_victorian', 'property', 'Oak St Victorian', 7, 0, 'S', { color: '#ffffff', icon: 'home' }),
  N('bonnie_brae_ranch', 'property', 'Bonnie Brae Ranch House', 0, 1, 'E', { color: '#ffffff', icon: 'home' }),
  N('se_denton_starter', 'property', 'Southeast Denton Starter', 4, 7, 'N', { color: '#ffffff', icon: 'home' }),
  // street race start lines (routes in data/streetRaces.js)
  // trap houses, land for sale and the plug, off the city grid (data/estate.js)
  ...ESTATE_LOCATIONS,
  // taco trucks and diners, each on its own lot (data/food.js)
  ...FOOD_SPOTS,
  ...STREET_RACES.map(ev => { const st = raceStart(ev); return { id: ev.id, type: 'sprint', name: ev.name, x: st.x, z: st.z, face: st.h, color: '#ffbe1e', icon: 'flag', tier: ev.tier > 1 ? ev.tier : undefined, race: ev.id }; }),
];

export const LOC_BY_ID = Object.fromEntries(LOCATIONS.map(l => [l.id, l]));

// Homes. `slots` is garage capacity. Safehouses clear a pursuit in cooldown.
export const PROPERTIES = {
  eastgate_studio:   { name: 'Eastgate Studio', price: 0, slots: 2, desc: 'One room, one window, a two-car shared carport. Home.' },
  harbor_loft:       { name: 'Lakeside Loft', price: 42000, slots: 3, desc: 'Converted cannery loft with a view of the cranes.' },
  westside_house:    { name: 'Arlington Heights House', price: 135000, slots: 4, house: 'one', desc: 'Brick 1-story ranch on a quiet street, four-car garage with a lift.' },
  hillcrest_villa:   { name: 'Hillcrest Villa', price: 780000, slots: 8, house: 'two', desc: 'Hillside 2-story glass house with a heated showroom garage.', tier: 4 },
  foundry_warehouse: { name: 'Foundry Warehouse Garage', price: 260000, slots: 12, desc: 'A crew HQ: dyno cell, paint booth, twelve bays.', tier: 3 },
  fairmount_craftsman: { name: 'Fairmount Craftsman', price: 340000, slots: 6, house: 'two', desc: 'Restored 1920s 2-story craftsman on a Southside street, six-car garage out back.', tier: 3, wall: '#7f8a6a', roof: '#4a3a2e' },
  westover_estate:   { name: 'Westover Hills Estate', price: 1450000, slots: 10, house: 'two', desc: 'Gated 2-story, a pool, and a ten-car gallery garage with a turntable.', tier: 4, wall: '#d9d0bc', roof: '#3a4a3a' },
  // Stop Six houses off the grid (data/estate.js has where they are)
  six_bungalow:      { name: 'Cass St Bungalow', price: 64000, slots: 2, house: 'starter', desc: '1-story, two bedrooms, a porch and a carport you can close up. Stop Six.' },
  six_twostory:      { name: 'Amanda Ave Two-Story', price: 148000, slots: 4, house: 'two', desc: '2-story with the bedrooms upstairs and a four-car garage. Stop Six.' },
  six_threestory:    { name: 'Stalcup Heights Three-Story', price: 295000, slots: 6, house: 'three', desc: '3-story new build with a rooftop game room and a six-car garage. Stop Six.', tier: 2 },
  uptown_condo:      { name: 'Uptown High-Rise Condo', price: 520000, slots: 6, desc: 'Dallas. A corner unit over McKinney Ave with six spots in the private garage.', tier: 3 },
  kessler_tudor:     { name: 'Kessler Park Tudor', price: 410000, slots: 5, house: 'two', desc: 'Dallas. A 2-story Tudor on the Oak Cliff bluffs, five-car garage.', tier: 2, wall: '#c8b8a0', roof: '#3a3030' },
  oak_victorian:     { name: 'Oak St Victorian', price: 365000, slots: 6, house: 'three', desc: 'Denton. A restored 1890s Victorian on Oak St, three stories and a six-car carriage house.', tier: 3, wall: '#c9b48a', roof: '#4a2f3a' },
  bonnie_brae_ranch: { name: 'Bonnie Brae Ranch House', price: 118000, slots: 4, house: 'one', desc: 'Denton. A 1-story brick ranch by UNT, four-car garage. The freeway is right out back.' },
  se_denton_starter: { name: 'Southeast Denton Starter', price: 58000, slots: 2, house: 'starter', desc: 'Denton. Two bedrooms, a porch and a carport on Teasley Ln.' },
  rivercrest_mansion: { name: 'Rivercrest Mansion', price: 3600000, slots: 14, house: 'three', desc: 'Country club money. Three stories, fourteen climate-controlled bays and a car elevator.', tier: 5, wall: '#e8e2d8', roof: '#2f3b4a', wallH: 5.2 },
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
