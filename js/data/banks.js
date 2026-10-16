// Banks: a branch in every town and a few in every city, on every map.
// Walk in to use the teller (deposits and withdrawals), case the place, or
// plan a heist on it (core/heist.js, ui/heist.js). Draw a gun at the counter
// instead and it's a teller-line robbery (world2d/combat.js): fast, small,
// and the FBI takes the case.
//
// Each row: [id, name, city, i, j, side, tier]. city: null for Fort Worth's
// own grid, otherwise the grid the block is on (dallas, denton, weatherford,
// west, a state id, or a town id from data/metro.js). data/world.js turns
// these into LOCATIONS (type 'bank').
//
// No imports: data/world.js reads this file.

// tier: how big the bank is. vault: cash in the vault [min, max]; drawers:
// what the teller line holds; guards and cams make it harder; response: how
// long (game minutes) before the first units roll up once an alarm goes off;
// lock: the vault is on a time lock (you have to wait it out or cut it).
export const BANK_TIERS = {
  branch: { name: 'Branch', vault: [60000, 160000], drawers: [4000, 12000], guards: 1, cams: 2, response: 6, lock: false },
  city: { name: 'City bank', vault: [160000, 420000], drawers: [8000, 22000], guards: 2, cams: 5, response: 4, lock: false },
  hq: { name: 'Headquarters', vault: [500000, 1400000], drawers: [15000, 40000], guards: 3, cams: 9, response: 3, lock: true },
};

export const BANK_COLOR = '#d4af37';

export const BANK_SPOTS = [
  // ---------------- Fort Worth ----------------
  ['bank_cowtown', 'Cowtown National Bank', null, 6, 6, 'W', 'hq'],
  ['bank_stockyards', 'Stockyards Savings & Loan', null, 5, 1, 'S', 'city'],
  ['bank_magnolia', 'Magnolia Community Bank', null, 7, 9, 'N', 'branch'],
  ['bank_camp_bowie', 'Camp Bowie Trust', null, 2, 2, 'E', 'city'],
  ['bank_poly', 'Poly Federal Credit Union', null, 9, 9, 'W', 'branch'],
  ['bank_riverside', 'Trinity River Bank', null, 10, 3, 'W', 'branch'],
  ['bank_crowley', 'Crowley State Bank', null, 2, 10, 'N', 'branch'],
  // ---------------- Dallas ----------------
  ['bank_elm', 'Elm Street Bank & Trust', 'dallas', 3, 3, 'S', 'hq'],
  ['bank_uptown', 'McKinney Avenue Private Bank', 'dallas', 7, 0, 'S', 'city'],
  ['bank_oakcliff', 'Oak Cliff Savings', 'dallas', 3, 8, 'N', 'branch'],
  ['bank_south_dallas', 'MLK Community Credit Union', 'dallas', 7, 6, 'W', 'branch'],
  // ---------------- Denton, Weatherford, Mineral Wells ----------------
  ['bank_denton', 'Denton County State Bank', 'denton', 3, 3, 'E', 'city'],
  ['bank_denton_east', 'Eagle Federal Credit Union', 'denton', 6, 2, 'S', 'branch'],
  ['bank_weatherford', 'Parker County National Bank', 'weatherford', 4, 4, 'N', 'branch'],
  ['bank_mineral_wells', 'Crazy Water Savings', 'west', 4, 4, 'N', 'branch'],
  // ---------------- the towns ----------------
  ['bank_burleson', 'Burleson State Bank', 'burleson', 3, 2, 'S', 'branch'],
  ['bank_cleburne', 'Johnson County Bank', 'cleburne', 2, 2, 'N', 'branch'],
  ['bank_granbury', 'Lake Granbury Savings', 'granbury', 3, 2, 'S', 'branch'],
  ['bank_azle', 'Azle Farmers Bank', 'azle', 3, 1, 'S', 'branch'],
  ['bank_stephenville', 'Erath County Bank', 'stephenville', 3, 2, 'W', 'branch'],
  ['bank_arlington', 'Arlington Savings Bank', 'arlington', 1, 1, 'S', 'city'],
  ['bank_grandprairie', 'Grand Prairie Federal', 'grandprairie', 3, 2, 'S', 'branch'],
  ['bank_mansfield', 'Mansfield State Bank', 'mansfield', 4, 3, 'N', 'branch'],
  ['bank_cedarhill', 'Cedar Hill Community Bank', 'cedarhill', 10, 3, 'S', 'branch'],
  ['bank_waxahachie', 'Ellis County National Bank', 'waxahachie', 3, 1, 'N', 'branch'],
  ['bank_ennis', 'Ennis Kolache Country Bank', 'ennis', 2, 2, 'S', 'branch'],
  ['bank_hillsboro', 'Hill County Bank', 'hillsboro', 2, 3, 'N', 'branch'],
  ['bank_alvarado', 'Alvarado State Bank', 'alvarado', 2, 2, 'N', 'branch'],
  ['bank_eastdallas', 'Lakewood Bank', 'eastdallas', 6, 2, 'S', 'branch'],
  ['bank_northdallas', 'Preston Center Private Bank', 'northdallas', 9, 2, 'S', 'city'],
  ['bank_carrollton', 'Carrollton Federal Savings', 'carrollton', 7, 1, 'S', 'branch'],
  ['bank_lewisville', 'Lewisville Lake Bank', 'lewisville', 4, 7, 'S', 'branch'],
  ['bank_plano', 'Legacy National Bank', 'plano', 2, 2, 'S', 'hq'],
  ['bank_frisco', 'Frisco Star Bank', 'frisco', 4, 3, 'S', 'city'],
  ['bank_mckinney', 'Collin County Savings', 'mckinney', 4, 2, 'N', 'branch'],
  ['bank_sanger', 'Sanger Farmers & Merchants', 'sanger', 3, 2, 'S', 'branch'],
  ['bank_decatur', 'Wise County Bank', 'decatur', 1, 2, 'N', 'branch'],
  // ---------------- Atlanta ----------------
  ['bank_atl_peachtree', 'Peachtree Federal Bank', 'ga', 2, 4, 'N', 'hq'],
  ['bank_atl_buckhead', 'Buckhead Private Bank', 'ga', 3, 1, 'S', 'city'],
  ['bank_atl_zone6', 'Candler Road Credit Union', 'ga', 5, 6, 'N', 'branch'],
  ['bank_atl_decatur', 'DeKalb Savings', 'ga_decatur', 2, 2, 'S', 'branch'],
  ['bank_atl_eastpoint', 'East Point Community Bank', 'ga_eastpoint', 7, 1, 'S', 'branch'],
  // ---------------- Los Angeles ----------------
  ['bank_la_downtown', 'Pacific Coast Bank', 'ca', 4, 3, 'S', 'hq'],
  ['bank_la_hollywood', 'Sunset Savings', 'ca', 2, 1, 'S', 'city'],
  ['bank_la_compton', 'Compton Community Bank', 'ca', 4, 7, 'N', 'branch'],
  ['bank_la_eastla', 'Whittier Blvd Savings', 'ca_eastla', 6, 3, 'N', 'branch'],
  ['bank_la_inglewood', 'Inglewood Federal', 'ca_inglewood', 3, 2, 'N', 'branch'],
  // ---------------- Miami ----------------
  ['bank_mia_brickell', 'Biscayne Trust', 'fl', 2, 4, 'S', 'hq'],
  ['bank_mia_havana', 'Banco de la Calle Ocho', 'fl', 2, 7, 'N', 'branch'],
  ['bank_mia_beach', 'Ocean Drive Savings', 'fl', 7, 3, 'W', 'city'],
  ['bank_mia_mbeach', 'Collins Avenue Bank', 'fl_beach', 2, 5, 'S', 'branch'],
  ['bank_mia_gables', 'Coral Gables Private Bank', 'fl_gables', 3, 1, 'S', 'city'],
  // ---------------- Denver ----------------
  ['bank_den_lodo', 'Mile High Savings', 'co', 2, 2, 'S', 'hq'],
  ['bank_den_cherry', 'Cherry Creek Private Bank', 'co', 5, 6, 'N', 'city'],
  ['bank_den_five_points', 'Colfax Credit Union', 'co', 4, 3, 'S', 'branch'],
];
