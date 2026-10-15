import { STREET_RACES, raceStart } from './streetRaces.js';
import { ESTATE_LOCATIONS, TRAPS } from './estate.js';
import { FOOD_SPOTS } from './food.js';
import { STATES, STATE_BLOCK, AIRPORT_ROW, stateAt, stateDistrict } from './states.js';
import { TOWN_BY_ID, metroDistrict, townAt, townBlockCenter } from './metro.js';
import { MARINA_LOCATIONS } from './boats.js';

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
// Brazos country: big-ranch land south of Johnson County, past County Road
// 1200. Tracts of 400 to 1,000 acres (data/estate.js) along FM 916 across
// the top and FM 2331 down the middle; world2d/brazos.js fills it in.
export const BRAZOS = { x0: -3300, x1: 1900, z0: 5800, z1: 10100 };
export const FM916_Z = 6100;                 // across the top, x -3200..1850
export const FM916_X = [-3200, 1850];
export const FM2331_END = 9985;              // Old Cleburne Rd carries on south as FM 2331 (x = 0)
export const inBrazos = (x, z) => x > BRAZOS.x0 && x < BRAZOS.x1 && z > BRAZOS.z0 && z < BRAZOS.z1;
// how far out anything can be (online positions are clamped to this)
export const WORLD_R = 30000;
// Dallas: east of Fort Worth down I-30, which carries on from the east end of
// Loop 820 past Arlington. Its own 10x10-block grid (150 m blocks); I-30 cuts
// through the middle of it (row 5), downtown and Deep Ellum north of the
// freeway, Oak Cliff and South Dallas south of it. world2d/dallas.js fills it in.
export const WEATHERFORD = { x0: -5700, x1: -3900, z0: -2100, z1: -600 };
export const WGRID_X = [], WGRID_Z = [];
for (let v = WEATHERFORD.x0; v <= WEATHERFORD.x1; v += 150) WGRID_X.push(v);
for (let v = WEATHERFORD.z0; v <= WEATHERFORD.z1; v += 150) WGRID_Z.push(v);
export const I20_WEST_END = -6000;
// West Texas growth zone: the map can keep expanding west without changing the
// core Fort Worth coordinates. This first step reaches Mineral Wells / Palo Pinto.
export const WEST = { x0: -10800, x1: -5700, z0: -2250, z1: 450 };
export const XGRID_X = [], XGRID_Z = [];
for (let v = WEST.x0 + 600; v <= WEST.x1 - 150; v += 150) XGRID_X.push(v);
for (let v = WEST.z0 + 150; v <= WEST.z1 - 150; v += 150) XGRID_Z.push(v);
export const WEST_CITY = { x0: -9750, x1: -8250, z0: -1950, z1: -750 };
export const inWest = (x, z) => x > WEST.x0 && x < WEST.x1 && z > WEST.z0 && z < WEST.z1;
export const inWestCity = (x, z) => x > WEST_CITY.x0 - 20 && x < WEST_CITY.x1 + 20 && z > WEST_CITY.z0 - 20 && z < WEST_CITY.z1 + 20;
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
export const inWeatherford = (x, z) => x > WEATHERFORD.x0 - 12 && x < WEATHERFORD.x1 + 12 && z > WEATHERFORD.z0 - 12 && z < WEATHERFORD.z1 + 12;
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
// any city grid outside Fort Worth (sidewalks, red lights, pavement): Dallas,
// Denton, Mineral Wells and every town on the big map (data/metro.js)
export const inCityGrid = (x, z) => inDallas(x, z) || inDenton(x, z) || inWestCity(x, z) || !!townAt(x, z);

export const STREET_NS = ['Hulen St', 'Montgomery St', 'University Dr', 'Henderson St', 'Throckmorton St', 'Houston St', 'Main St', 'Commerce St', 'Jones St', 'Riverside Dr', 'Beach St', 'Oakland Blvd', 'Everman Pkwy'];
export const DSTREET_NS = ['Sylvan Ave', 'Riverfront Blvd', 'Lamar St', 'Griffin St', 'Akard St', 'Ervay St', 'Harwood St', 'Pearl St', 'Good Latimer Expy', 'Exposition Ave', 'Haskell Ave'];
export const DSTREET_EW = ['Lemmon Ave', 'McKinney Ave', 'Ross Ave', 'Elm St', 'Commerce St', 'I-30', 'Jefferson Blvd', 'Davis St', 'MLK Jr Blvd', 'Illinois Ave', 'Kiest Blvd'];
export const DNSTREET_NS = ['I-35', 'Bonnie Brae St', 'Avenue C', 'Carroll Blvd', 'Elm St', 'Locust St', 'Bell Ave', 'Wood St', 'Loop 288'];
export const DNSTREET_EW = ['University Dr', 'Sherman Dr', 'Oak St', 'Hickory St', 'Mulberry St', 'Dallas Dr', 'Eagle Dr', 'Teasley Ln', 'Hwy 380 Bypass'];
export const STREET_EW = ['NE 28th St', 'Stockyards Blvd', 'Exchange Ave', 'Northside Dr', 'Belknap St', 'Weatherford St', 'W 7th St', 'Lancaster Ave', 'Vickery Blvd', 'Rosedale St', 'Magnolia Ave', 'Berry St', 'Seminary Dr'];

export function districtAt(x, z) {
  if (x > 9000) { const st = stateAt(x, z); if (st !== 'tx') return metroDistrict(x, z) || stateDistrict(st, x, z); }
  // the towns, lakes and country past the old edges of the map (data/metro.js)
  const big = metroDistrict(x, z);
  if (big) return big;
  if (inWeatherford(x, z)) return weatherfordDistrict(x, z);
  if (inWest(x, z)) return westDistrict(x, z);
  if (x > DALLAS_ZONE.x0 && z < DALLAS_ZONE.z1 + 400) return dallasDistrict(x, z);
  if (z < NORTH.z1 && x > NORTH.x0 - 200) return northDistrict(x, z);
  if (z < HWY_Z - 60 && Math.abs(x) < 60) return 'I-35W';
  if (z < -1000) return 'Loop 820';
  if (z > BRAZOS.z0 && inBrazos(x, z)) return x > 0 ? 'Hill County' : z > 8800 ? 'Brazos River' : 'Bosque County';
  if (z > COUNTRY.z0) return 'Johnson County';
  if (z > DESERT_Z) return 'Burleson';
  if (x < -1000) return z < -100 ? 'Lake Worth' : 'Benbrook Hills';
  if (x > SEA_X) return z > 190 ? 'Everman' : z > -1000 ? 'Stop Six' : 'Everman Shore';
  if (Math.abs(x) <= 300 && Math.abs(z) <= 300) return 'Downtown';
  if (x > 300) return z > 600 ? 'Near Southside' : z >= 300 ? 'Poly' : 'Riverside Industrial';
  // the west side, north to south: Arlington Heights, Como, TCU, North Crowley, then Crowley
  if (x < -300) return z < 0 ? 'Arlington Heights' : z < 300 ? 'Como' : z < 600 ? 'TCU' : z < 750 ? 'North Crowley' : 'Crowley';
  return z < 0 ? 'Stockyards' : 'Near Southside';
}

function westDistrict(x, z) {
  if (inWestCity(x, z)) {
    const i = Math.floor((x - WEST_CITY.x0) / BLOCK), j = Math.floor((z - WEST_CITY.z0) / BLOCK);
    if (j <= 2) return 'Mineral Wells North';
    if (i <= 2) return 'Mineral Wells West';
    if (i >= 6) return 'Mineral Wells East';
    return 'Mineral Wells';
  }
  if (z < -1650) return 'Palo Pinto County';
  if (x < -9300) return 'Palo Pinto Mountains';
  return 'West I-20';
}
function weatherfordDistrict(x, z) { const i=Math.floor((x-WEATHERFORD.x0)/BLOCK), j=Math.floor((z-WEATHERFORD.z0)/BLOCK); if(j<=1) return 'Weatherford North'; if(i>=7) return 'Weatherford East'; if(j>=8) return 'Weatherford South'; return 'Weatherford'; }
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
export const WEATHERFORD_DISTRICTS = ['Weatherford','Weatherford North','Weatherford East','Weatherford South'];
export const WEST_DISTRICTS = ['Mineral Wells','Mineral Wells North','Mineral Wells West','Mineral Wells East','Palo Pinto County','Palo Pinto Mountains','West I-20'];
// Fort Worth's house-and-yard neighbourhoods (map.js and scenery.js build them alike)
export const LEAFY = new Set(['Arlington Heights', 'Como', 'TCU', 'North Crowley', 'Crowley', 'Poly']);
export const DALLAS_DISTRICTS = ['Uptown', 'Downtown Dallas', 'Deep Ellum', 'West Dallas', 'Oak Cliff', 'South Dallas'];

export function blockCenter(i, j, city) {
  if (city === 'denton') return { x: DENTON.x0 + BLOCK / 2 + BLOCK * i, z: DENTON.z0 + BLOCK / 2 + BLOCK * j };
  if (city === 'dallas') return { x: DALLAS.x0 + BLOCK / 2 + BLOCK * i, z: DALLAS.z0 + BLOCK / 2 + BLOCK * j };
  if (city === 'weatherford') return { x: WEATHERFORD.x0 + BLOCK / 2 + BLOCK * i, z: WEATHERFORD.z0 + BLOCK / 2 + BLOCK * j };
  if (city === 'west') return { x: WEST_CITY.x0 + BLOCK / 2 + BLOCK * i, z: WEST_CITY.z0 + BLOCK / 2 + BLOCK * j };
  if (STATES[city]) return { x: STATES[city].cx + STATE_BLOCK / 2 + STATE_BLOCK * i, z: STATES[city].cz + STATE_BLOCK / 2 + STATE_BLOCK * j };
  if (TOWN_BY_ID[city]) return townBlockCenter(TOWN_BY_ID[city], i, j);
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
const W = (id, type, name, i, j, side, extra = {}) => ({ id, type, name, block: [i, j], city: 'weatherford', side, ...front(i, j, side, 0, 'weatherford'), ...extra });
const X = (id, type, name, i, j, side, extra = {}) => ({ id, type, name, block: [i, j], city: 'west', side, ...front(i, j, side, 0, 'west'), ...extra });
// on a block of an out-of-state city (data/states.js): S('ga')(…)
const S = st => (id, type, name, i, j, side, extra = {}) => ({ id, type, name, block: [i, j], city: st, state: st, side, ...front(i, j, side, 0, st), ...extra });
const GA = S('ga'), CA = S('ca'), FL = S('fl');
// on a block of one of the new towns (data/metro.js): TW('plano')(…)
const TW = id => (pid, type, name, i, j, side, extra = {}) => ({ id: pid, type, name, block: [i, j], city: id, ...(TOWN_BY_ID[id].state ? { state: TOWN_BY_ID[id].state } : {}), side, ...front(i, j, side, 0, id), ...extra });
const REP = '#1b4fc4', GASC = '#1f8f3a', FOOD = '#e8c21a', CORNER = '#ff8a1a', HOME = '#ffffff', MEET = '#ff1a2e', MIC = '#c04aff';
// places in the new towns: gas, food, mechanics, corner stores, a few meets, studios and dealers, and houses for sale
const TOWN_PLACES = [
  // Fort Worth's south and west
  TW('burleson')('burleson_gas', 'gas', 'Burleson Fuel Stop', 5, 1, 'N', { color: GASC, icon: 'gas' }),
  TW('burleson')('burleson_repair', 'repair', 'Old Town Burleson Auto', 3, 0, 'S', { color: REP, icon: 'repair', rate: 0.85, tagline: 'Two bays and a coffee pot · trucks, hot rods, whatever you drag in' }),
  TW('burleson')('burleson_food', 'food', 'Hidden Creek Cafe', 3, 3, 'N', { color: FOOD, icon: 'food' }),
  TW('burleson')('burleson_house', 'property', 'Hidden Creek Ranch House', 6, 4, 'N', { color: HOME, icon: 'home' }),
  TW('cleburne')('cleburne_gas', 'gas', 'Cleburne Country Fuel', 0, 1, 'E', { color: GASC, icon: 'gas' }),
  TW('cleburne')('cleburne_cafe', 'food', 'Main St Cafe', 2, 1, 'S', { color: FOOD, icon: 'food', menu: 'diner' }),
  TW('granbury')('granbury_gas', 'gas', 'Lakeside Fuel', 1, 1, 'S', { color: GASC, icon: 'gas' }),
  TW('granbury')('granbury_repair', 'repair', 'Lake Granbury Auto', 4, 4, 'N', { color: REP, icon: 'repair', rate: 0.9, tagline: 'Boats on Monday, cars the rest of the week' }),
  TW('granbury')('granbury_food', 'food', 'Pearl St Catfish', 3, 1, 'N', { color: FOOD, icon: 'food' }),
  TW('granbury')('granbury_lake', 'property', 'Lake Granbury Waterfront', 6, 2, 'E', { color: HOME, icon: 'home' }),
  TW('granbury')('granbury_meet', 'meet', 'Granbury Square Lot', 2, 4, 'N', { color: MEET, icon: 'meet', tier: 2 }),
  TW('azle')('azle_gas', 'gas', 'Azle Fuel Center', 1, 1, 'S', { color: GASC, icon: 'gas' }),
  TW('azle')('azle_corner', 'corner', 'Azle Quick Stop', 4, 3, 'N', { color: CORNER, icon: 'food' }),
  TW('stephenville')('steph_gas', 'gas', 'Erath County Fuel', 4, 1, 'W', { color: GASC, icon: 'gas' }),
  TW('stephenville')('steph_food', 'food', 'Cowboy Capital Diner', 3, 3, 'N', { color: FOOD, icon: 'food', menu: 'diner' }),
  TW('stephenville')('steph_repair', 'repair', 'Erath County Truck & Tire', 5, 4, 'N', { color: REP, icon: 'repair', rate: 0.75, tagline: 'Dairy-country prices · farm trucks, stock trailers, your car too' }),
  // between Fort Worth and Dallas, and south of Dallas
  TW('arlington')('arl_gas', 'gas', 'Volt & Petrol', 0, 2, 'E', { color: GASC, icon: 'gas' }),
  TW('arlington')('arl_repair', 'repair', 'Pioneer Pkwy Auto', 4, 3, 'N', { color: REP, icon: 'repair', rate: 0.95, tagline: 'Arlington since 1984 · brakes, tires, AC and engines' }),
  TW('arlington')('arl_corner', 'corner', 'Abram St Food Mart', 5, 0, 'S', { color: CORNER, icon: 'food' }),
  TW('arlington')('arl_wings', 'food', 'Cooper St Wings', 1, 4, 'N', { color: FOOD, icon: 'food' }),
  TW('arlington')('arl_automall', 'dealer', 'Arlington Auto Mall (Ford · Chevy · Toyota · Honda · Nissan)', 6, 3, 'S', { color: '#f2f2f2', icon: 'car', makes: ['ford', 'chevrolet', 'gmc', 'toyota', 'honda', 'nissan', 'hyundai', 'kia'] }),
  TW('arlington')('arl_meet', 'meet', 'Six Flags Overflow Lot', 6, 1, 'E', { color: MEET, icon: 'meet', tier: 2 }),
  TW('arlington')('arl_twostory', 'property', 'South Arlington Two-Story', 2, 6, 'N', { color: HOME, icon: 'home' }),
  TW('grandprairie')('gp_gas', 'gas', 'Gas-N-Go', 3, 0, 'S', { color: GASC, icon: 'gas' }),
  TW('grandprairie')('gp_trans', 'repair', 'Great Southwest Transmission', 4, 2, 'N', { color: REP, icon: 'repair', rate: 0.85, tagline: 'Transmissions and rear ends · Grand Prairie' }),
  TW('grandprairie')('gp_corner', 'corner', 'Wheatland Food Mart', 6, 5, 'N', { color: CORNER, icon: 'food' }),
  TW('grandprairie')('gp_tacos', 'food', 'Duncanville Taqueria', 2, 6, 'N', { color: FOOD, icon: 'food', menu: 'taco' }),
  TW('grandprairie')('gp_starter', 'property', 'Duncanville Starter', 5, 7, 'N', { color: HOME, icon: 'home' }),
  TW('mansfield')('mans_gas', 'gas', 'Mansfield Fuel', 2, 0, 'S', { color: GASC, icon: 'gas' }),
  TW('mansfield')('mans_bbq', 'food', 'Mansfield Smokehouse', 4, 2, 'N', { color: FOOD, icon: 'food' }),
  TW('mansfield')('mans_brick', 'property', 'Mansfield Brick Two-Story', 6, 4, 'N', { color: HOME, icon: 'home' }),
  TW('cedarhill')('ch_gas', 'gas', 'Volt & Petrol', 2, 1, 'S', { color: GASC, icon: 'gas' }),
  TW('cedarhill')('ch_repair', 'repair', 'DeSoto Auto & Tire', 5, 2, 'N', { color: REP, icon: 'repair', rate: 0.9, tagline: 'Southern Dallas County · honest work, fair price' }),
  TW('cedarhill')('ch_corner', 'corner', 'Lancaster Food Mart', 9, 4, 'N', { color: CORNER, icon: 'food' }),
  TW('cedarhill')('ch_studio', 'studio', 'Hampton Road Studios', 4, 4, 'S', { color: MIC, icon: 'mic' }),
  TW('cedarhill')('ch_meet', 'meet', 'Lancaster Airport Lot', 8, 1, 'E', { color: MEET, icon: 'meet', tier: 2 }),
  TW('cedarhill')('ch_estate', 'property', 'Cedar Hill Hilltop Estate', 0, 3, 'E', { color: HOME, icon: 'home' }),
  TW('waxahachie')('wax_gas', 'gas', 'Ellis County Fuel', 1, 1, 'S', { color: GASC, icon: 'gas' }),
  TW('waxahachie')('wax_repair', 'repair', 'Ellis County Auto', 6, 2, 'N', { color: REP, icon: 'repair', rate: 0.8, tagline: 'Gingerbread town, country rates' }),
  TW('waxahachie')('wax_cafe', 'food', 'Courthouse Square Cafe', 2, 4, 'N', { color: FOOD, icon: 'food', menu: 'diner' }),
  TW('waxahachie')('wax_victorian', 'property', 'Waxahachie Victorian', 5, 4, 'N', { color: HOME, icon: 'home' }),
  TW('ennis')('ennis_gas', 'gas', 'Ennis Travel Stop', 0, 1, 'E', { color: GASC, icon: 'gas' }),
  TW('ennis')('ennis_kolache', 'food', 'Ennis Kolache Shop', 2, 1, 'N', { color: FOOD, icon: 'food' }),
  TW('hillsboro')('hb_gas', 'gas', 'Hillsboro Travel Center', 4, 3, 'N', { color: GASC, icon: 'gas' }),
  TW('hillsboro')('hb_diesel', 'repair', 'Hill County Diesel', 1, 4, 'N', { color: REP, icon: 'repair', rate: 0.8, tagline: 'Off I-35E · big rigs, stock trailers and pickups' }),
  TW('hillsboro')('hb_grill', 'food', 'Outlet Mall Grill', 5, 4, 'N', { color: FOOD, icon: 'food' }),
  TW('alvarado')('alv_gas', 'gas', 'Alvarado Fuel', 2, 0, 'S', { color: GASC, icon: 'gas' }),
  TW('alvarado')('alv_corner', 'corner', 'Venus Mini Mart', 6, 2, 'N', { color: CORNER, icon: 'food' }),
  TW('alvarado')('alv_farm', 'property', 'Alvarado Farmhouse', 0, 4, 'E', { color: HOME, icon: 'home' }),
  // Dallas grows
  TW('eastdallas')('ed_gas', 'gas', 'Gas-N-Go', 2, 6, 'N', { color: GASC, icon: 'gas' }),
  TW('eastdallas')('ed_repair', 'repair', 'Buckner Blvd Collision', 5, 7, 'N', { color: REP, icon: 'repair', rate: 0.85, tagline: 'Body, paint and frame · Pleasant Grove' }),
  TW('eastdallas')('ed_corner', 'corner', 'Garland Rd Food Mart', 3, 3, 'S', { color: CORNER, icon: 'food' }),
  TW('eastdallas')('ed_bbq', 'food', 'Mesquite BBQ Pit', 8, 7, 'S', { color: FOOD, icon: 'food' }),
  TW('eastdallas')('ed_meet', 'meet', 'Town East Lot', 9, 1, 'S', { color: MEET, icon: 'meet', tier: 2 }),
  TW('eastdallas')('ed_perf', 'perf', 'Garland Speed & Dyno', 7, 2, 'N', { color: '#e8641a', icon: 'wrench', owner: 'Quan', tagline: 'Quan Tran · turbo Hondas, Supras and street-car dyno tuning · Garland' }),
  TW('eastdallas')('ed_studio', 'studio', 'Pleasant Grove Sound', 6, 8, 'N', { color: MIC, icon: 'mic' }),
  TW('eastdallas')('ed_whiterock', 'property', 'White Rock Lake House', 1, 1, 'E', { color: HOME, icon: 'home' }),
  TW('northdallas')('nd_gas', 'gas', 'Volt & Petrol', 8, 1, 'S', { color: GASC, icon: 'gas' }),
  TW('northdallas')('nd_euro', 'repair', 'Preston Euro Motors', 4, 0, 'S', { color: REP, icon: 'repair', rate: 1.35, tagline: 'Porsche, Ferrari, Bentley · Park Cities prices' }),
  TW('northdallas')('nd_luxury', 'dealer', 'Park Cities Luxury (BMW · Mercedes · Porsche · Lexus)', 9, 6, 'N', { color: '#f2f2f2', icon: 'car', makes: ['bmw', 'mercedes', 'porsche', 'lexus', 'audi', 'genesis', 'landrover', 'volvo'] }),
  TW('northdallas')('nd_corner', 'corner', 'Harry Hines Food Mart', 1, 7, 'E', { color: CORNER, icon: 'food' }),
  TW('northdallas')('nd_tacos', 'food', 'Lower Greenville Tacos', 8, 7, 'N', { color: FOOD, icon: 'food', menu: 'taco' }),
  TW('northdallas')('nd_studio', 'studio', 'Love Field Records', 1, 6, 'E', { color: MIC, icon: 'mic' }),
  TW('northdallas')('nd_meet', 'meet', 'NorthPark Garage Lot', 10, 4, 'W', { color: MEET, icon: 'meet', tier: 3 }),
  TW('northdallas')('nd_preston', 'property', 'Preston Hollow Estate', 4, 1, 'E', { color: HOME, icon: 'home' }),
  TW('northdallas')('nd_highland', 'property', 'Highland Park Mansion', 5, 5, 'S', { color: HOME, icon: 'home' }),
  TW('northdallas')('nd_lakehighlands', 'property', 'Lake Highlands Ranch', 12, 2, 'N', { color: HOME, icon: 'home' }),
  TW('carrollton')('car_gas', 'gas', 'Gas-N-Go', 2, 1, 'S', { color: GASC, icon: 'gas' }),
  TW('carrollton')('car_corner', 'corner', 'Josey Ln Food Mart', 4, 4, 'N', { color: CORNER, icon: 'food' }),
  TW('carrollton')('car_repair', 'repair', 'Addison Auto Haus', 7, 3, 'N', { color: REP, icon: 'repair', rate: 1.1, tagline: 'German cars and Japanese imports · Addison' }),
  TW('carrollton')('car_kbbq', 'food', 'Koreatown BBQ', 5, 2, 'S', { color: FOOD, icon: 'food' }),
  TW('lewisville')('lv_gas', 'gas', 'Lakeside Fuel', 4, 5, 'N', { color: GASC, icon: 'gas' }),
  TW('lewisville')('lv_repair', 'repair', 'Lewisville Lakeside Auto', 1, 6, 'N', { color: REP, icon: 'repair', rate: 0.95, tagline: 'Boat trailers, lake trucks and daily drivers' }),
  TW('lewisville')('lv_grill', 'food', 'Old Town Lewisville Grill', 4, 6, 'S', { color: FOOD, icon: 'food' }),
  TW('lewisville')('lv_meet', 'meet', 'Vista Ridge Lot', 6, 9, 'N', { color: MEET, icon: 'meet', tier: 2 }),
  TW('lewisville')('lv_flowermound', 'property', 'Flower Mound Two-Story', 2, 2, 'N', { color: HOME, icon: 'home' }),
  TW('plano')('plano_gas', 'gas', 'Volt & Petrol', 4, 2, 'S', { color: GASC, icon: 'gas' }),
  TW('plano')('plano_exotics', 'dealer', 'Legacy Exotics (Ferrari · Lamborghini · McLaren · Rolls-Royce)', 1, 1, 'S', { color: '#e8c21a', icon: 'car', makes: ['ferrari', 'lamborghini', 'mclaren', 'astonmartin', 'bentley', 'rollsroyce', 'maserati', 'lotus', 'bugatti', 'koenigsegg', 'pagani'] }),
  TW('plano')('plano_import', 'repair', 'Plano Import Service', 7, 4, 'N', { color: REP, icon: 'repair', rate: 1.15, tagline: 'Lexus, Acura, Infiniti · loaners and a clean waiting room' }),
  TW('plano')('plano_corner', 'corner', 'Richardson Food Mart', 5, 6, 'N', { color: CORNER, icon: 'food' }),
  TW('plano')('plano_pho', 'food', 'Plano Pho House', 8, 2, 'N', { color: FOOD, icon: 'food' }),
  TW('plano')('plano_penthouse', 'property', 'Legacy Glass Penthouse', 3, 0, 'S', { color: HOME, icon: 'home' }),
  TW('plano')('plano_richardson', 'property', 'Richardson Ranch', 10, 7, 'N', { color: HOME, icon: 'home' }),
  TW('frisco')('frisco_gas', 'gas', 'Volt & Petrol', 1, 2, 'E', { color: GASC, icon: 'gas' }),
  TW('frisco')('frisco_perf', 'perf', 'Frisco Tuning Lab', 5, 1, 'S', { color: '#e8641a', icon: 'wrench', owner: 'Jaylen', tagline: 'Jaylen Ross · E85 conversions, big turbos, launch control · Frisco' }),
  TW('frisco')('frisco_meet', 'meet', 'The Star Lot', 2, 5, 'E', { color: MEET, icon: 'meet', tier: 4 }),
  TW('frisco')('frisco_estate', 'property', 'Frisco Gated Estate', 0, 0, 'S', { color: HOME, icon: 'home' }),
  TW('mckinney')('mck_gas', 'gas', 'Collin County Fuel', 1, 1, 'S', { color: GASC, icon: 'gas' }),
  TW('mckinney')('mck_bistro', 'food', 'Historic Square Bistro', 4, 4, 'N', { color: FOOD, icon: 'food' }),
  TW('mckinney')('mck_repair', 'repair', 'McKinney Truck & Auto', 6, 4, 'N', { color: REP, icon: 'repair', rate: 1.0, tagline: 'Square deal on the square · since 1962' }),
  TW('mckinney')('mck_craftsman', 'property', 'McKinney Craftsman', 2, 4, 'N', { color: HOME, icon: 'home' }),
  // up north and out west of Denton
  TW('sanger')('sanger_gas', 'gas', 'Sanger Travel Stop', 2, 3, 'W', { color: GASC, icon: 'gas' }),
  TW('sanger')('sanger_steak', 'food', 'Sanger Steakhouse', 3, 0, 'S', { color: FOOD, icon: 'food' }),
  TW('decatur')('decatur_gas', 'gas', 'Wise County Fuel', 1, 1, 'S', { color: GASC, icon: 'gas' }),
  TW('decatur')('decatur_food', 'food', 'Decatur Square Diner', 5, 2, 'N', { color: FOOD, icon: 'food', menu: 'diner' }),
  TW('decatur')('decatur_diesel', 'repair', 'Wise County Diesel', 0, 4, 'E', { color: REP, icon: 'repair', rate: 0.8, tagline: 'Oilfield trucks and ranch rigs · Decatur' }),
  TW('decatur')('decatur_ranch', 'property', 'Decatur Ranch House', 6, 5, 'N', { color: HOME, icon: 'home' }),
  // out of state
  TW('ga_decatur')('ga_dec_gas', 'gas', 'QuikTrip', 1, 4, 'S', { color: GASC, icon: 'gas' }),
  TW('ga_decatur')('ga_dec_soul', 'food', 'Decatur Soul Food', 2, 1, 'N', { color: FOOD, icon: 'food' }),
  TW('ga_decatur')('ga_dec_corner', 'corner', 'Candler Rd Quick Shop', 6, 5, 'N', { color: CORNER, icon: 'food' }),
  TW('ga_decatur')('ga_dec_studio', 'studio', 'DeKalb Sound', 3, 3, 'S', { color: MIC, icon: 'mic' }),
  TW('ga_decatur')('ga_stonemtn', 'property', 'Stone Mountain Estate', 6, 1, 'E', { color: HOME, icon: 'home' }),
  TW('ga_eastpoint')('ga_ep_gas', 'gas', 'QuikTrip', 2, 1, 'S', { color: GASC, icon: 'gas' }),
  TW('ga_eastpoint')('ga_ep_corner', 'corner', 'Washington Rd Food Mart', 7, 2, 'N', { color: CORNER, icon: 'food' }),
  TW('ga_eastpoint')('ga_ep_meet', 'meet', 'Camp Creek Lot', 1, 2, 'N', { color: MEET, icon: 'meet', tier: 2 }),
  TW('ca_eastla')('ca_ela_tacos', 'food', 'Boyle Heights Tacos', 2, 2, 'N', { color: FOOD, icon: 'food', menu: 'taco' }),
  TW('ca_eastla')('ca_ela_corner', 'corner', 'Whittier Blvd Market', 3, 6, 'N', { color: CORNER, icon: 'food' }),
  TW('ca_eastla')('ca_ela_body', 'repair', 'Montebello Body & Paint', 7, 4, 'N', { color: REP, icon: 'repair', rate: 1.1, tagline: 'Candy paint, collision and smog' }),
  TW('ca_eastla')('ca_downey', 'property', 'Downey Ranch', 6, 6, 'N', { color: HOME, icon: 'home' }),
  TW('ca_inglewood')('ca_ing_gas', 'gas', 'Arco', 1, 1, 'S', { color: GASC, icon: 'gas' }),
  TW('ca_inglewood')('ca_ing_food', 'food', 'Inglewood Chicken & Waffles', 6, 2, 'N', { color: FOOD, icon: 'food' }),
  TW('ca_inglewood')('ca_ing_meet', 'meet', 'SoFi Lot', 5, 1, 'W', { color: MEET, icon: 'meet', tier: 3 }),
  TW('fl_beach')('fl_mb_cafe', 'food', 'Ocean Terrace Cafe', 3, 5, 'E', { color: FOOD, icon: 'food', menu: 'diner' }),
  TW('fl_beach')('fl_mb_drip', 'clothing', 'Lincoln Rd Boutique', 1, 6, 'N', { color: '#a01aff', icon: 'shirt' }),
  TW('fl_beach')('fl_mb_meet', 'meet', 'South Pointe Lot', 2, 7, 'S', { color: MEET, icon: 'meet', tier: 3 }),
  TW('fl_beach')('fl_oceanfront', 'property', 'Collins Ave Oceanfront Condo', 3, 1, 'E', { color: HOME, icon: 'home' }),
  TW('fl_gables')('fl_cg_gas', 'gas', 'Wawa', 6, 1, 'S', { color: GASC, icon: 'gas' }),
  TW('fl_gables')('fl_cg_corner', 'corner', 'Bird Rd Mini Mart', 8, 2, 'N', { color: CORNER, icon: 'food' }),
  TW('fl_gables')('fl_cg_repair', 'repair', 'Coconut Grove Auto', 7, 0, 'S', { color: REP, icon: 'repair', rate: 1.1, tagline: 'Euro and exotic service under the banyan trees' }),
  TW('fl_gables')('fl_gables', 'property', 'Coral Gables Mediterranean', 0, 1, 'E', { color: HOME, icon: 'home' }),
];
// an out-of-state airport: the terminal on the south side of the airport road, west of town
const airport = (st, id, name) => ({ id, type: 'airport', name, x: STATES[st].cx - 330, z: STATES[st].cz + AIRPORT_ROW * STATE_BLOCK + 14, face: 0, side: 'N', state: st, color: '#5fd3ff', icon: 'plane' });

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
  L('corner_como', 'corner', 'Horne St Food Mart', 2, 7, 'N', { color: '#ff8a1a', icon: 'food' }),
  L('corner_camp_bowie', 'corner', 'Camp Bowie Corner Store', 2, 5, 'E', { color: '#ff8a1a', icon: 'food' }),
  L('threadline', 'clothing', 'Threadline Streetwear', 4, 6, 'E', { color: '#a01aff', icon: 'shirt' }),
  L('surplus', 'clothing', 'Riverside Army Surplus', 8, 9, 'W', { color: '#a01aff', icon: 'shirt', shop: 'surplus' }),
  L('bayline', 'realty', 'Bayline Realty', 5, 5, 'S', { color: '#1f8f3a', icon: 'key', contact: 'priya' }),
  L('pspd_central', 'police', 'FWPD Central Precinct', 5, 6, 'N', { color: '#1b4fc4', icon: 'shield' }),
  L('jps', 'hospital', 'JPS Hospital', 6, 8, 'W', { color: '#e0192e', icon: 'cross' }),   // John Peter Smith, the county trauma center on S Main St
  L('pspd_harbor', 'police', 'FWPD Southside Precinct', 10, 10, 'N', { color: '#1b4fc4', icon: 'shield' }),
  L('harbor_loft', 'property', 'Southside Loft', 9, 10, 'N', { color: '#ffffff', icon: 'home' }),
  L('westside_house', 'property', 'Como House', 1, 6, 'E', { color: '#ffffff', icon: 'home' }),
  L('hillcrest_villa', 'property', 'Hillcrest Villa', 0, 1, 'E', { color: '#ffffff', icon: 'home' }),
  L('foundry_warehouse', 'property', 'Foundry Warehouse Garage', 11, 3, 'W', { color: '#ffffff', icon: 'home' }),
  L('fairmount_craftsman', 'property', 'Fairmount Craftsman', 4, 9, 'N', { color: '#ffffff', icon: 'home' }),
  L('westover_estate', 'property', 'Westover Hills Estate', 0, 3, 'E', { color: '#ffffff', icon: 'home' }),
  L('rivercrest_mansion', 'property', 'Rivercrest Mansion', 1, 8, 'E', { color: '#ffffff', icon: 'home' }),
  L('trap_riverside', 'trap', 'Riverside Duplex', 10, 4, 'W', { color: '#8a1a1a', icon: 'home' }),
  L('marchetti_salvage', 'chop', 'Marchetti Salvage', 10, 7, 'N', { color: '#c9752a', icon: 'wrench', contact: 'junior' }),
  // recording studios: cut records for your label (ui/label.js)
  // VirL Studios: the best room in the game, a block off Downtown
  L('virl_studios', 'studio', 'VirL Studios', 7, 6, 'S', { color: '#ffc21a', icon: 'mic', h: 30, top: true }),
  L('magnolia_sound', 'studio', 'Magnolia Sound', 4, 8, 'N', { color: '#c04aff', icon: 'mic' }),
  L('trap_house_studios', 'studio', 'Trap House Studios', 3, 6, 'S', { color: '#c04aff', icon: 'mic' }),
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
  // the Cultural District just west of Downtown, and TCU on the west side (scenery.js draws them)
  { id: 'dickies_arena', type: 'landmark', name: 'Dickies Arena', x: -375, z: -13, face: 0, color: '#e8c21a', icon: 'arena',
    blurb: 'The 14,000-seat arena in the Cultural District, just west of Downtown. Rodeo in the winter, the biggest concerts in Fort Worth the rest of the year. Book an arena headline for one of your artists in the Label app and this is where they play.' },
  { id: 'tcu', type: 'landmark', name: 'TCU', x: -525, z: 313, face: Math.PI, color: '#a46be0', icon: 'school',
    blurb: 'Texas Christian University, between Como and North Crowley. Horned Frogs purple everywhere, Frog Fountain out front and Amon G. Carter Stadium next door. On game days the whole west side turns purple.' },
  // on the lawn in front of the pink granite courthouse (block 5,4; scenery draws the building)
  { id: 'courthouse', type: 'court', name: 'Tarrant County Courthouse', x: -75, z: -163, face: 0, color: '#c9a68a', icon: 'court' },
  { id: 'ironline', type: 'drag', name: 'Ironline Dragway', x: 34, z: 1260, face: Math.PI / 2, color: '#ff1a2e', icon: 'flag' },
  { id: 'glory_onramp', type: 'roll', name: 'Loop 820 On-Ramp', x: 12, z: -1180, face: Math.PI, color: '#ff1a2e', icon: 'flag', road: 'highway' },
  { id: 'ironside_start', type: 'roll', name: 'East Lancaster Runs', x: 312, z: 650, face: 0, color: '#ff1a2e', icon: 'flag', road: 'industrial' },
  { id: 'dustline_start', type: 'roll', name: 'Chisholm Trail Pkwy', x: 12, z: 1120, face: 0, color: '#ff1a2e', icon: 'flag', road: 'desert', tier: 2 },
  { id: 'northridge_start', type: 'roll', name: 'Lake Worth Pass', x: -1120, z: -330, face: -Math.PI / 2, color: '#ff1a2e', icon: 'flag', road: 'mountain', tier: 4 },
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
  D('ellum_lab', 'studio', 'Deep Ellum Sound Lab', 8, 2, 'S', { color: '#c04aff', icon: 'mic' }),
  D('the_kitchen', 'studio', 'The Kitchen', 7, 4, 'N', { color: '#c04aff', icon: 'mic' }),
  D('inner_circle', 'studio', 'Inner Circle', 5, 1, 'E', { color: '#c04aff', icon: 'mic' }),
  D('ellum_meet', 'meet', 'Deep Ellum Warehouse Lot', 9, 1, 'S', { color: '#ff1a2e', icon: 'meet', tier: 2 }),
  D('uptown_condo', 'property', 'Uptown High-Rise Condo', 4, 0, 'S', { color: '#ffffff', icon: 'home' }),
  D('kessler_tudor', 'property', 'Kessler Park Tudor', 0, 8, 'E', { color: '#ffffff', icon: 'home' }),
  // ---------------- Weatherford / Parker County ----------------
  W('weatherford_perf', 'perf', 'Parker County Performance', 6, 3, 'S', { color: '#e8641a', icon: 'wrench', owner: 'Marcus' }),
  W('weatherford_repair', 'repair', 'Weatherford Auto & Tire', 2, 6, 'N', { color: '#1b4fc4', icon: 'repair', rate: 0.9, tagline: 'Local shop · trucks, classics and street cars' }),
  W('weatherford_gas', 'gas', 'Parker County Fuel', 8, 5, 'W', { color: '#1f8f3a', icon: 'gas' }),
  W('weatherford_meet', 'meet', 'Weatherford Backroad Lot', 4, 8, 'N', { color: '#ff1a2e', icon: 'meet', tier: 2 }),
  W('weatherford_luxury', 'property', 'Aledo Ridge Estate', 2, 1, 'S', { color: '#ffffff', icon: 'home' }),
  W('weatherford_ranch', 'property', 'Parker County Ranch House', 8, 8, 'N', { color: '#ffffff', icon: 'home' }),
  W('weatherford_warehouse', 'property', 'I-20 Warehouse Garage', 10, 4, 'W', { color: '#ffffff', icon: 'home' }),
  // ---------------- West Texas growth zone (world2d/west.js) ----------------
  X('mineral_wells_perf', 'perf', 'Palo Pinto Performance', 5, 3, 'S', { color: '#e8641a', icon: 'wrench', owner: 'Ray' }),
  X('mineral_wells_repair', 'repair', 'Mineral Wells Auto & Tire', 2, 5, 'N', { color: '#1b4fc4', icon: 'repair', rate: 0.85, tagline: 'West-side shop · trucks, classics and street cars' }),
  X('mineral_wells_gas', 'gas', 'Mineral Wells Fuel', 7, 2, 'W', { color: '#1f8f3a', icon: 'gas' }),
  X('mineral_wells_meet', 'meet', 'US-180 Backroad Lot', 3, 6, 'N', { color: '#ff1a2e', icon: 'meet', tier: 2 }),
  X('mineral_wells_home', 'property', 'Mineral Wells Ranch House', 1, 1, 'S', { color: '#ffffff', icon: 'home' }),
  X('palo_pinto_warehouse', 'property', 'Palo Pinto Warehouse Garage', 8, 5, 'W', { color: '#ffffff', icon: 'home' }),
  X('west_i20_estate', 'property', 'West I-20 Estate', 9, 2, 'N', { color: '#ffffff', icon: 'home' }),
  { id: 'west_180_run', type: 'roll', name: 'US-180 West Runs', x: -7200, z: -1350, face: Math.PI / 2, color: '#ff1a2e', icon: 'flag', road: 'west_highway', tier: 2 },
  { id: 'mineral_wells_drag', type: 'roll', name: 'Mineral Wells Airport Run', x: -9000, z: -650, face: 0, color: '#ff1a2e', icon: 'flag', road: 'west_highway', tier: 3 },
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
  // Alliance Airport: the terminal at the top of Alliance Blvd. Flights to
  // Atlanta, LA and Miami (ui/flights.js); your car rides cargo.
  { id: 'air_alliance', type: 'airport', name: 'Alliance Airport Terminal', x: AIRPORT_X + 10, z: HTRACE_Z - 216, face: -Math.PI / 2, side: 'W', state: 'tx', color: '#5fd3ff', icon: 'plane' },
  // Brazos country, out FM 916 past the big ranches: a feed store with pumps
  { id: 'gas_brazos', type: 'gas', name: 'Brazos Feed & Fuel', x: 300, z: FM916_Z - 14, face: 0, side: 'S', color: '#1f8f3a', icon: 'gas' },
  // ---------------- out of state: Atlanta, Los Angeles, Miami (data/states.js, world2d/states.js) ----------------
  airport('ga', 'air_atl', 'Hartsfield-Jackson Atlanta'),
  GA('atl_studio', 'studio', 'Zone 6 Sound', 6, 5, 'N', { color: '#c04aff', icon: 'mic' }),
  GA('atl_peachtree', 'studio', 'Peachtree Platinum Studios', 3, 3, 'S', { color: '#c04aff', icon: 'mic' }),
  GA('atl_plug', 'plug', 'Bankhead Connect', 1, 5, 'E', { color: '#2cff7a', icon: 'tow', stock: ['lean', 'percs', 'loud'], rate: 0.6, tagline: 'Bankhead · lean and percs for less than Texas' }),
  GA('atl_trucks', 'dealer', 'Peach State Motors (Chevy · GMC · Cadillac · Dodge · Ram)', 4, 6, 'N', { color: '#f2f2f2', icon: 'car', makes: ['chevrolet', 'gmc', 'cadillac', 'dodge', 'ram', 'chrysler', 'buick'] }),
  GA('atl_perf', 'perf', 'Old National Speed', 2, 7, 'N', { color: '#e8641a', icon: 'wrench', owner: 'Kel', tagline: 'Kel Brooks · donks, Hellcats and turbo LS swaps · Atlanta' }),
  GA('atl_repair', 'repair', 'Moreland Ave Auto', 5, 4, 'W', { color: '#1b4fc4', icon: 'repair', rate: 0.95, tagline: 'East Atlanta · fair prices, fast turnaround' }),
  GA('atl_gas', 'gas', 'QuikTrip', 1, 4, 'S', { color: '#1f8f3a', icon: 'gas' }),
  GA('atl_corner', 'corner', 'Candler Rd Food Mart', 6, 6, 'W', { color: '#ff8a1a', icon: 'food' }),
  GA('atl_wings', 'food', 'Lemon Pepper Wing Spot', 3, 5, 'N', { color: '#e8c21a', icon: 'food' }),
  GA('atl_drip', 'clothing', 'Little Five Points Drip', 5, 2, 'S', { color: '#a01aff', icon: 'shirt' }),
  GA('atl_meet', 'meet', 'Old National Hwy Lot', 4, 7, 'N', { color: '#ff1a2e', icon: 'meet', tier: 2 }),
  GA('atl_buckhead', 'property', 'Buckhead Gated Estate', 2, 1, 'S', { color: '#ffffff', icon: 'home' }),
  GA('atl_eastatl', 'property', 'East Atlanta Bungalow', 6, 3, 'W', { color: '#ffffff', icon: 'home' }),
  airport('ca', 'air_lax', 'LAX'),
  CA('la_sunset', 'studio', 'Sunset Blvd Recorders', 4, 1, 'S', { color: '#c04aff', icon: 'mic' }),
  CA('la_plug', 'plug', 'Venice Beach Collective', 1, 4, 'E', { color: '#2cff7a', icon: 'tow', stock: ['loud', 'smoke', 'exo'], rate: 0.55, tagline: 'Venice · loud by the pound, California prices' }),
  CA('la_exotics', 'dealer', 'Beverly Hills Exotics (Ferrari · Lamborghini · McLaren · Rolls-Royce)', 2, 2, 'S', { color: '#e8c21a', icon: 'car', makes: ['ferrari', 'lamborghini', 'mclaren', 'astonmartin', 'bentley', 'rollsroyce', 'maserati', 'lotus', 'bugatti', 'koenigsegg', 'pagani', 'porsche'] }),
  CA('la_jdm', 'dealer', 'Gardena JDM Imports (Toyota · Nissan · Honda · Mazda · Subaru)', 5, 6, 'N', { color: '#f2f2f2', icon: 'car', makes: ['toyota', 'lexus', 'honda', 'acura', 'nissan', 'infiniti', 'mazda', 'subaru', 'mitsubishi', 'scion'] }),
  CA('la_ev', 'dealer', 'Silicon Beach EV (Tesla · Rivian · Lucid)', 1, 3, 'E', { color: '#13b3c4', icon: 'car', makes: ['tesla', 'rivian', 'lucid'] }),
  CA('la_perf', 'perf', 'Hawthorne Speed Shop', 5, 7, 'N', { color: '#e8641a', icon: 'wrench', owner: 'Nori', tagline: 'Nori Sato · 2JZ, RB and K-swap builds · LA' }),
  CA('la_lowrider', 'visual', 'East LA Lowriders', 7, 5, 'W', { color: '#d12a8a', icon: 'spray', tagline: 'Candy paint, chrome and hydraulics' }),
  CA('la_repair', 'repair', 'Crenshaw Auto Care', 3, 4, 'N', { color: '#1b4fc4', icon: 'repair', rate: 1.2, tagline: 'California labor rates · smog check while you wait' }),
  CA('la_gas', 'gas', 'Arco', 4, 4, 'S', { color: '#1f8f3a', icon: 'gas' }),
  CA('la_tacos', 'food', "Leo's Taco Truck", 6, 3, 'S', { color: '#e8c21a', icon: 'food', menu: 'taco' }),
  CA('la_meet', 'meet', 'Angeles Crest Turnout', 3, 0, 'S', { color: '#ff1a2e', icon: 'meet', tier: 3 }),
  CA('la_hills', 'property', 'Hollywood Hills Glass House', 5, 0, 'S', { color: '#ffffff', icon: 'home' }),
  CA('la_compton', 'property', 'Compton Starter', 3, 6, 'N', { color: '#ffffff', icon: 'home' }),
  airport('fl', 'air_mia', 'Miami International'),
  FL('mia_studio', 'studio', 'Biscayne Bay Studios', 5, 2, 'E', { color: '#c04aff', icon: 'mic' }),
  FL('mia_plug', 'plug', 'Little Havana Connect', 2, 6, 'N', { color: '#2cff7a', icon: 'tow', stock: ['powder', 'molly', 'ice'], rate: 0.5, tagline: 'Little Havana · straight off the boat, half what Texas pays' }),
  FL('mia_exotics', 'dealer', 'Ocean Drive Exotics (Lamborghini · Ferrari · Bentley)', 6, 4, 'E', { color: '#e8c21a', icon: 'car', makes: ['ferrari', 'lamborghini', 'mclaren', 'bentley', 'rollsroyce', 'maserati', 'astonmartin', 'porsche', 'mercedes'] }),
  FL('mia_perf', 'perf', 'Hialeah Speed', 1, 2, 'S', { color: '#e8641a', icon: 'wrench', owner: 'Rafa', tagline: 'Rafa Ortiz · Coyote swaps and nitrous · Miami' }),
  FL('mia_repair', 'repair', 'Flagler Street Garage', 3, 4, 'S', { color: '#1b4fc4', icon: 'repair', rate: 1.05, tagline: 'Body, mechanical and salt-air rust' }),
  FL('mia_gas', 'gas', 'Wawa', 4, 1, 'S', { color: '#1f8f3a', icon: 'gas' }),
  FL('mia_corner', 'corner', 'Calle Ocho Mini Mart', 3, 6, 'N', { color: '#ff8a1a', icon: 'food' }),
  FL('mia_cafe', 'food', 'Cafecito Ventanita', 4, 6, 'N', { color: '#e8c21a', icon: 'food', menu: 'diner' }),
  FL('mia_meet', 'meet', 'Ocean Drive Lot', 6, 6, 'E', { color: '#ff1a2e', icon: 'meet', tier: 3 }),
  FL('mia_brickell', 'property', 'Brickell Penthouse', 4, 3, 'S', { color: '#ffffff', icon: 'home' }),
  FL('mia_hialeah', 'property', 'Hialeah House', 1, 6, 'N', { color: '#ffffff', icon: 'home' }),
  // the new towns on the big map (data/metro.js)
  ...TOWN_PLACES,
  // street race start lines (routes in data/streetRaces.js)
  // trap houses, land for sale and the plug, off the city grid (data/estate.js)
  ...ESTATE_LOCATIONS,
  // taco trucks and diners, each on its own lot (data/food.js)
  ...FOOD_SPOTS,
  ...MARINA_LOCATIONS,   // marinas on the lakes and Miami's bay (data/boats.js)
  ...STREET_RACES.map(ev => { const st = raceStart(ev); return { id: ev.id, type: 'sprint', name: ev.name, x: st.x, z: st.z, face: st.h, color: '#ffbe1e', icon: 'flag', tier: ev.tier > 1 ? ev.tier : undefined, race: ev.id }; }),
];

export const LOC_BY_ID = Object.fromEntries(LOCATIONS.map(l => [l.id, l]));

// Homes. `slots` is garage capacity. Safehouses clear a pursuit in cooldown.
export const PROPERTIES = {
  eastgate_studio:   { name: 'Eastgate Studio', price: 0, slots: 2, desc: 'One room, one window, a two-car shared carport. Home.' },
  harbor_loft:       { name: 'Southside Loft', price: 42000, slots: 3, desc: 'Converted cannery loft with a view of the cranes.' },
  westside_house:    { name: 'Como House', price: 135000, slots: 4, house: 'one', desc: 'Brick 1-story ranch on a quiet street, four-car garage with a lift.' },
  hillcrest_villa:   { name: 'Hillcrest Villa', price: 780000, slots: 8, house: 'two', desc: 'Hillside 2-story glass house with a heated showroom garage.', tier: 4 },
  foundry_warehouse: { name: 'Foundry Warehouse Garage', price: 260000, slots: 12, desc: 'A crew HQ: dyno cell, paint booth, twelve bays.', tier: 3 },
  mineral_wells_home: { name: 'Mineral Wells Ranch House', price: 175000, slots: 6, house: 'one', desc: 'A west-side ranch house with six garage spots and room to grow.' },
  palo_pinto_warehouse: { name: 'Palo Pinto Warehouse Garage', price: 385000, slots: 16, house: 'two', desc: 'A large west-side warehouse with a private showroom and sixteen bays.', tier: 3 },
  west_i20_estate: { name: 'West I-20 Estate', price: 620000, slots: 10, house: 'two', desc: 'A gated acreage estate west of Mineral Wells with a ten-car gallery.', tier: 4 },
  weatherford_luxury: { name: 'Aledo Ridge Estate', price: 540000, slots: 10, house: 'two', desc: 'A gated Parker County estate with a ten-car gallery garage.', tier: 3 },
  weatherford_ranch: { name: 'Parker County Ranch House', price: 185000, slots: 6, house: 'one', desc: 'A country ranch house with six garage spots and room to grow.' },
  weatherford_warehouse: { name: 'I-20 Warehouse Garage', price: 310000, slots: 12, house: 'two', desc: 'A large I-20 warehouse with a private showroom and twelve bays.', tier: 3 },
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
  // out of state (data/states.js)
  atl_buckhead:      { name: 'Buckhead Gated Estate', price: 2400000, slots: 12, house: 'three', desc: 'Atlanta. Three stories behind a gate on West Paces Ferry, a twelve-car garage.', tier: 4, wall: '#e8e2d8', roof: '#2f343d' },
  atl_eastatl:       { name: 'East Atlanta Bungalow', price: 215000, slots: 3, house: 'starter', desc: 'Atlanta. A craftsman bungalow by the Village, three-car garage out back.' },
  la_hills:          { name: 'Hollywood Hills Glass House', price: 6200000, slots: 16, house: 'three', desc: 'Los Angeles. Glass on three floors over the city lights, a sixteen-car gallery.', tier: 5, wall: '#f2f2f2', roof: '#1a1c22', style: 'flat' },
  la_compton:        { name: 'Compton Starter', price: 265000, slots: 3, house: 'starter', desc: 'Los Angeles. Two bedrooms, a lowrider in every driveway on the block.' },
  mia_brickell:      { name: 'Brickell Penthouse', price: 3300000, slots: 10, desc: 'Miami. The top floor over Biscayne Bay and ten spots in the private garage.', tier: 4 },
  mia_hialeah:       { name: 'Hialeah House', price: 240000, slots: 3, house: 'one', desc: 'Miami. A one-story stucco house with a palm out front and a three-car garage.', wall: '#f2e2c8', roof: '#b06a32' },
  rivercrest_mansion: { name: 'Rivercrest Mansion', price: 3600000, slots: 14, house: 'three', desc: 'Country club money. Three stories, fourteen climate-controlled bays and a car elevator.', tier: 5, wall: '#e8e2d8', roof: '#2f3b4a', wallH: 5.2 },
  // the new towns (data/metro.js)
  burleson_house:    { name: 'Hidden Creek Ranch House', price: 165000, slots: 4, house: 'one', desc: 'Burleson. A brick 1-story on a cul-de-sac, four-car garage and a back porch.' },
  granbury_lake:     { name: 'Lake Granbury Waterfront', price: 690000, slots: 8, house: 'two', desc: 'Granbury. Two stories on the water, a boat dock and an eight-car garage.', tier: 3, wall: '#d9d0bc', roof: '#3a4a5a' },
  arl_twostory:      { name: 'South Arlington Two-Story', price: 189000, slots: 4, house: 'two', desc: 'Arlington. Four bedrooms upstairs, four cars below, Six Flags fireworks on Saturdays.' },
  gp_starter:        { name: 'Duncanville Starter', price: 72000, slots: 2, house: 'starter', desc: 'Duncanville. Two bedrooms and a carport, I-20 traffic for a lullaby.' },
  mans_brick:        { name: 'Mansfield Brick Two-Story', price: 245000, slots: 5, house: 'two', desc: 'Mansfield. A new-build 2-story on a corner lot, five-car garage.', tier: 2 },
  ch_estate:         { name: 'Cedar Hill Hilltop Estate', price: 880000, slots: 10, house: 'two', desc: 'Cedar Hill. Up on the escarpment, the Dallas skyline from the pool, a ten-car garage.', tier: 3, wall: '#e8e2d8', roof: '#2f3b4a' },
  wax_victorian:     { name: 'Waxahachie Victorian', price: 310000, slots: 5, house: 'three', desc: 'Waxahachie. A gingerbread Victorian off the square, a five-car carriage house.', tier: 2, wall: '#c9b48a', roof: '#4a2f3a' },
  alv_farm:          { name: 'Alvarado Farmhouse', price: 128000, slots: 4, house: 'one', desc: 'Alvarado. A white farmhouse with a tin roof and a four-car shop out back.' },
  ed_whiterock:      { name: 'White Rock Lake House', price: 960000, slots: 8, house: 'two', desc: 'East Dallas. A mid-century house over White Rock Lake, eight cars in the garage.', tier: 3, style: 'flat' },
  nd_preston:        { name: 'Preston Hollow Estate', price: 4800000, slots: 16, house: 'three', desc: 'Preston Hollow. Three stories behind a gate, a sixteen-car gallery and a guest house.', tier: 5, wall: '#e8e2d8', roof: '#2f343d', wallH: 5.2 },
  nd_highland:       { name: 'Highland Park Mansion', price: 3900000, slots: 12, house: 'three', desc: 'Highland Park. Old money, three stories and a twelve-car garage under the oaks.', tier: 4, wall: '#d9d0bc', roof: '#3a3030' },
  nd_lakehighlands:  { name: 'Lake Highlands Ranch', price: 330000, slots: 4, house: 'one', desc: 'Lake Highlands. A 1-story ranch on a quiet street, four-car garage.', tier: 2 },
  lv_flowermound:    { name: 'Flower Mound Two-Story', price: 445000, slots: 6, house: 'two', desc: 'Flower Mound. A big 2-story by the lake, six-car garage and a pool.', tier: 2 },
  plano_penthouse:   { name: 'Legacy Glass Penthouse', price: 1250000, slots: 8, desc: 'Plano. The top floor at Legacy West, eight spots in the private garage.', tier: 4 },
  plano_richardson:  { name: 'Richardson Ranch', price: 265000, slots: 4, house: 'one', desc: 'Richardson. A 1-story brick ranch, four-car garage, ten minutes from everything.' },
  frisco_estate:     { name: 'Frisco Gated Estate', price: 2100000, slots: 14, house: 'three', desc: 'Frisco. Three stories in a gated community, a fourteen-car garage with a lift.', tier: 4, wall: '#e8e2d8', roof: '#3a4a3a' },
  mck_craftsman:     { name: 'McKinney Craftsman', price: 395000, slots: 5, house: 'two', desc: 'McKinney. A restored craftsman two blocks off the square, five-car garage.', tier: 2, wall: '#7f8a6a', roof: '#4a3a2e' },
  decatur_ranch:     { name: 'Decatur Ranch House', price: 158000, slots: 4, house: 'one', desc: 'Decatur. A ranch house on the edge of town, a four-car shop and room for horses.' },
  ga_stonemtn:       { name: 'Stone Mountain Estate', price: 760000, slots: 8, house: 'two', desc: 'Atlanta. A 2-story by Stone Mountain Park, eight-car garage.', tier: 3 },
  ca_downey:         { name: 'Downey Ranch', price: 690000, slots: 4, house: 'one', desc: 'Los Angeles. A Downey ranch house with a four-car garage and a lowrider driveway.', tier: 3, wall: '#f2e2c8', roof: '#b06a32' },
  fl_oceanfront:     { name: 'Collins Ave Oceanfront Condo', price: 2600000, slots: 8, desc: 'Miami Beach. Ocean on one side, the bay on the other, eight spots downstairs.', tier: 4 },
  fl_gables:         { name: 'Coral Gables Mediterranean', price: 1900000, slots: 8, house: 'two', desc: 'Coral Gables. Barrel tile, a courtyard fountain and an eight-car garage.', tier: 4, wall: '#f2e2c8', roof: '#b06a32' },
  // trap houses (data/estate.js): customers knock, SWAT might too
  ...Object.fromEntries(Object.entries(TRAPS).map(([id, t]) => [id, { ...t, trap: true }])),
};

// Race roads available for roll racing (built by race/track.js).
export const ROADS = {
  industrial: { name: 'East Lancaster', theme: 'industrial', lanes: 4, traffic: 0.35, tier: 1, heat: 0.6, desc: 'Four lanes between the warehouses. Trucks at night.' },
  highway:    { name: 'Loop 820', theme: 'highway', lanes: 6, traffic: 0.55, tier: 1, heat: 1.0, desc: 'Six lanes, long and straight, and the troopers know it.' },
  desert:     { name: 'Chisholm Trail Pkwy', theme: 'desert', lanes: 2, traffic: 0.12, tier: 2, heat: 0.3, desc: 'Two-lane desert straight. Nothing out here but heat haze.' },
  mountain:   { name: 'Lake Worth Pass Straight', theme: 'mountain', lanes: 2, traffic: 0.2, tier: 4, heat: 0.4, desc: 'The one straight piece of the pass. Pine trees and a long drop.' },
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
