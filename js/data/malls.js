// Malls around DFW you can pull up to and walk into: a directory of stores
// (clothes, kicks, western wear, jewelry), a food court, and the mall itself
// to walk around in. ui/mall.js runs the inside. Fort Worth's malls sit on a
// city block (map.js landmarkBlock); the ones out in the big towns are the
// mall landmarks in data/metro.js, and the front door is on the south side
// of the main building (world2d/metro.js tags it).

import { TOWN_BY_ID } from './metro.js';

// Open 10 AM to 9 PM, Sunday noon to 6 PM.
export const MALL_HOURS = { open: 10, close: 21, sunOpen: 12, sunClose: 18 };
// day is the game day (day 1 is a Monday, like core/state.js dayName).
export const isSunday = day => (((day - 1) % 7) + 7) % 7 === 6;
export const mallOpen = (day, hour) => isSunday(day) ? hour >= MALL_HOURS.sunOpen && hour < MALL_HOURS.sunClose : hour >= MALL_HOURS.open && hour < MALL_HOURS.close;

// The stores. `shop` picks the clothes they carry (MALL_CLOTHES below).
export const MALL_STORES = {
  kicks: { name: 'Kicks Lounge', icon: '👟', kind: 'clothes', shop: 'kicks', blurb: 'Fresh pairs on the wall. The line out front means a drop.' },
  hype: { name: 'Hype District', icon: '🧢', kind: 'clothes', shop: 'hype', blurb: 'Streetwear: heavyweight hoodies, graphic tees, fitted caps.' },
  denim: { name: 'Indigo Denim Co.', icon: '👖', kind: 'clothes', shop: 'denim', blurb: 'Raw denim, stacked jeans, trucker jackets.' },
  western: { name: 'Cowtown Western Wear', icon: '🤠', kind: 'clothes', shop: 'western', blurb: 'Pearl snaps, ropers, Wranglers. Fort Worth dress code.' },
  jersey: { name: 'Sideline Jerseys', icon: '🏈', kind: 'clothes', shop: 'jersey', blurb: 'Home team colors. Football, hoops, baseball.' },
  mercado: { name: 'El Mercado', icon: '🪅', kind: 'clothes', shop: 'mercado', blurb: 'Stalls down the middle of the mall: fútbol jerseys, sombreros on the wall, botas.' },
  designer: { name: 'Maison Noir', icon: '🖤', kind: 'clothes', shop: 'designer', blurb: 'Glass cases, a doorman, prices with no decimals.' },
  jewelry: { name: 'Diamond District Jewelers', icon: '💎', kind: 'jewelry', blurb: 'Chains, watches and rings behind the glass. The guard by the door watches your hands.' },
  food: { name: 'Food Court', icon: '🍜', kind: 'food', blurb: 'Orange chicken samples, pretzels, a smoothie line.' },
};

// The malls. Fort Worth ones: fw = [i, j, side]. The rest: town + mark (the
// mall landmark's label in data/metro.js).
export const MALLS = [
  { id: 'mall_gran_plaza', name: 'La Gran Plaza', fw: [7, 11, 'N'], color: '#ff5a1a', stores: ['mercado', 'western', 'kicks', 'jersey', 'jewelry', 'food'],
    blurb: 'Off I-35W and Seminary on the south side. Mercado stalls, quinceañera dresses, western wear and a food court that smells like elotes. The lot out front turns into a car meet on weekend nights.' },
  { id: 'mall_hulen', name: 'Hulen Mall', fw: [3, 10, 'S'], color: '#ff5a1a', stores: ['hype', 'denim', 'kicks', 'jersey', 'jewelry', 'food'],
    blurb: 'Southwest Fort Worth, Hulen St and I-20. Department stores on both ends, everybody from Crowley and TCU in the middle.' },
  { id: 'mall_ridgmar', name: 'Ridgmar Mall', fw: [1, 2, 'N'], color: '#ff5a1a', stores: ['western', 'denim', 'hype', 'food'],
    blurb: 'West Fort Worth off I-30. Half the stores are gone but the ones left are cheap, and nobody bothers you.' },
  { id: 'mall_parks', name: 'The Parks Mall at Arlington', town: 'arlington', mark: 'THE PARKS MALL', color: '#ff5a1a', stores: ['hype', 'kicks', 'jersey', 'denim', 'jewelry', 'food'],
    blurb: 'I-20 and Cooper St. Two floors, an ice rink, and every high schooler in Arlington on a Saturday.' },
  { id: 'mall_northpark', name: 'NorthPark Center', town: 'northdallas', mark: 'NORTHPARK CENTER', color: '#e8c21a', stores: ['designer', 'hype', 'kicks', 'jewelry', 'food'],
    blurb: 'Northwest Hwy and US-75. Art in the hallways, valet out front, designer stores the size of houses.' },
  { id: 'mall_galleria', name: 'Galleria Dallas', town: 'northdallas', mark: 'GALLERIA DALLAS', color: '#e8c21a', stores: ['designer', 'denim', 'kicks', 'jewelry', 'food'],
    blurb: 'LBJ and the Dallas North Tollway. Glass roof, ice rink in the middle, a Christmas tree four stories tall.' },
  { id: 'mall_town_east', name: 'Town East Mall', town: 'eastdallas', mark: 'TOWN EAST MALL', color: '#ff5a1a', stores: ['hype', 'kicks', 'jersey', 'western', 'jewelry', 'food'],
    blurb: 'Mesquite, LBJ and Town East Blvd. East side shopping since 1971.' },
  { id: 'mall_collin_creek', name: 'Collin Creek Mall', town: 'plano', mark: 'COLLIN CREEK MALL', color: '#ff5a1a', stores: ['denim', 'hype', 'kicks', 'food'],
    blurb: 'Plano, off US-75. Half torn down and built back as shops and apartments around a creek.' },
  { id: 'mall_vista_ridge', name: 'Vista Ridge Mall', town: 'lewisville', mark: 'VISTA RIDGE MALL', color: '#ff5a1a', stores: ['hype', 'kicks', 'jersey', 'food'],
    blurb: 'Lewisville, I-35E and FM 3040. A carousel, a movie theater, a parking lot made for doing donuts after close.' },
  { id: 'mall_stonebriar', name: 'Stonebriar Centre', town: 'frisco', mark: 'STONEBRIAR CENTRE', color: '#e8c21a', stores: ['designer', 'hype', 'kicks', 'jersey', 'jewelry', 'food'],
    blurb: 'Frisco, Sam Rayburn Tollway and the Dallas North Tollway. New money, new trucks, an ice rink and a carousel.' },
];
export const MALL_BY_ID = Object.fromEntries(MALLS.map(m => [m.id, m]));
export const MALL_BY_MARK = Object.fromEntries(MALLS.filter(m => m.mark).map(m => [`${m.town}:${m.mark}`, m]));

// Where a town mall's main building and front door are. world2d/metro.js
// builds a mall landmark the same way (mark('mall', ...)).
export function mallMarkRect(m) {
  const t = TOWN_BY_ID[m.town], k = t.marks.find(x => x[4] === 'mall' && x[5] === m.mark);
  const x0 = t.x0 + k[0] * t.b + 14, z0 = t.z0 + k[2] * t.b + 14, x1 = t.x0 + (k[1] + 1) * t.b - 14, z1 = t.z0 + (k[3] + 1) * t.b - 14;
  return { x0, z0, x1, z1, W: x1 - x0, D: z1 - z0 };
}
export function mallDoor(m) {
  const r = mallMarkRect(m);
  return { x: (r.x0 + r.x1) / 2, z: r.z0 + r.D * 0.75 + 6, face: 0 };
}

// What the stores sell. Same slots and styles as data/shops.js CLOTHES, so
// they show on your character.
export const MALL_CLOTHES = [
  // Kicks Lounge
  { id: 'mk_jordan_bred', slot: 'shoes', style: 'kicks', color: '#b51818', name: 'Ascend Retro 11 "Bred"', price: 230, shop: 'kicks', brand: 'ascend' },
  { id: 'mk_af1_white', slot: 'shoes', style: 'kicks', color: '#f4f4f4', name: 'Vortex Air 1 Low "Triple White"', price: 115, shop: 'kicks', brand: 'vortex' },
  { id: 'mk_foams', slot: 'shoes', style: 'kicks', color: '#2a2f3a', name: 'Onyx Foam Runners', price: 180, shop: 'kicks' },
  { id: 'mk_dunk_panda', slot: 'shoes', style: 'kicks', color: '#d8d8d8', name: 'Vortex Skate Low "Panda"', price: 140, shop: 'kicks', brand: 'vortex' },
  { id: 'mk_uni_blue', slot: 'shoes', style: 'kicks', color: '#5fa8e8', name: 'Ascend Retro 4 "University Blue"', price: 260, shop: 'kicks', tier: 2, brand: 'ascend' },
  { id: 'mk_slides', slot: 'shoes', style: 'kicks', color: '#151515', name: 'Black Slides and Socks', price: 65, shop: 'kicks' },
  { id: 'mk_vx_cushion', slot: 'shoes', style: 'kicks', color: '#6a6e74', name: 'Vortex Air Cushion 95 "Neon"', price: 185, shop: 'kicks', brand: 'vortex' },
  { id: 'mk_vx_black', slot: 'shoes', style: 'kicks', color: '#141414', name: 'Vortex Air 1 Low "Triple Black"', price: 120, shop: 'kicks', brand: 'vortex' },
  { id: 'mk_as_military', slot: 'shoes', style: 'kicks', color: '#e8e8e8', name: 'Ascend Retro 4 "Military Black"', price: 215, shop: 'kicks', brand: 'ascend' },
  { id: 'mk_as_chicago', slot: 'shoes', style: 'kicks', color: '#c41b1b', name: 'Ascend Retro 1 High "Chicago"', price: 180, shop: 'kicks', brand: 'ascend' },
  { id: 'mk_as_concord', slot: 'shoes', style: 'kicks', color: '#f6f6f6', name: 'Ascend Retro 11 "Concord"', price: 240, shop: 'kicks', brand: 'ascend', tier: 2 },
  { id: 'mk_kr_boost', slot: 'shoes', style: 'kicks', color: '#151515', name: 'Kronos Boost Runner "Core Black"', price: 190, shop: 'kicks', brand: 'kronos' },
  { id: 'mk_kr_shell', slot: 'shoes', style: 'kicks', color: '#f0f0f0', name: 'Kronos Shell Toes', price: 100, shop: 'kicks', brand: 'kronos' },
  { id: 'mk_ol_low', slot: 'shoes', style: 'kicks', color: '#ebe6da', name: 'Off Lane Low "Arrow"', price: 480, shop: 'kicks', brand: 'offlane', tier: 2 },
  // Hype District
  { id: 'mh_hoodie_box', slot: 'top', style: 'hoodie', color: '#c41b1b', name: 'Red Box-Logo Hoodie', price: 190, shop: 'hype' },
  { id: 'mh_hoodie_cream', slot: 'top', style: 'hoodie', color: '#e8dcc0', name: 'Cream Essentials Hoodie', price: 110, shop: 'hype' },
  { id: 'mh_tee_graphic', slot: 'top', style: 'tee', color: '#2a2a2a', name: 'Vintage Rap Tee', price: 55, shop: 'hype' },
  { id: 'mh_tee_purple', slot: 'top', style: 'tee', color: '#6a2ac4', name: 'Purple Puff-Print Tee', price: 60, shop: 'hype' },
  { id: 'mh_puffer', slot: 'top', style: 'jacket', color: '#141414', name: 'Black Puffer Jacket', price: 320, shop: 'hype' },
  { id: 'mh_track_green', slot: 'bottom', style: 'track', color: '#1f5a32', name: 'Green Nylon Track Pants', price: 85, shop: 'hype' },
  { id: 'mh_fitted', slot: 'hat', style: 'cap', color: '#0b1f4d', name: 'Navy Fitted Cap', price: 45, shop: 'hype' },
  { id: 'mh_beanie_orange', slot: 'hat', style: 'beanie', color: '#e8641a', name: 'Safety Orange Beanie', price: 30, shop: 'hype' },
  { id: 'mh_vx_fleece', slot: 'top', style: 'hoodie', color: '#7a7e86', name: 'Vortex Tech Fleece Hoodie (Grey)', price: 130, shop: 'hype', brand: 'vortex' },
  { id: 'mh_vx_joggers', slot: 'bottom', style: 'track', color: '#7a7e86', name: 'Vortex Tech Fleece Joggers (Grey)', price: 110, shop: 'hype', brand: 'vortex' },
  { id: 'mh_vx_tank', slot: 'top', style: 'tank', color: '#121212', name: 'Vortex Training Tank', price: 35, shop: 'hype', brand: 'vortex' },
  { id: 'mh_kr_jacket', slot: 'top', style: 'jacket', color: '#121212', name: 'Kronos Firebird Track Jacket', price: 95, shop: 'hype', brand: 'kronos' },
  { id: 'mh_kr_pants', slot: 'bottom', style: 'track', color: '#121212', name: 'Kronos Three-Bar Track Pants', price: 80, shop: 'hype', brand: 'kronos' },
  { id: 'mh_ol_hoodie', slot: 'top', style: 'hoodie', color: '#121212', name: 'Off Lane Arrow Hoodie', price: 650, shop: 'hype', brand: 'offlane', tier: 2 },
  { id: 'mh_ol_tee', slot: 'top', style: 'tee', color: '#f2f2f2', name: 'Off Lane Diagonal Tee', price: 380, shop: 'hype', brand: 'offlane' },
  { id: 'mh_gg_hoodie', slot: 'top', style: 'hoodie', color: '#6a2ac4', name: 'Glitch Gang "BUILD. PLAY. GLITCH." Hoodie', price: 85, shop: 'hype', brand: 'glitch' },
  { id: 'mh_gg_tee', slot: 'top', style: 'tee', color: '#121212', name: 'Glitch Gang Logo Tee', price: 40, shop: 'hype', brand: 'glitch' },
  { id: 'mh_mws_tee', slot: 'top', style: 'tee', color: '#f2f2f2', name: 'Murda Worth Supply Lone Star Tee', price: 35, shop: 'hype', brand: 'mws' },
  { id: 'mh_mws_tank', slot: 'top', style: 'tank', color: '#f2f2f2', name: 'Murda Worth Supply Wife Beater', price: 25, shop: 'hype', brand: 'mws' },
  { id: 'mh_mws_cap', slot: 'hat', style: 'cap', color: '#121212', name: 'Murda Worth Supply Snapback', price: 40, shop: 'hype', brand: 'mws' },
  // Indigo Denim Co.
  { id: 'md_stacked', slot: 'bottom', style: 'jeans', color: '#1e2a44', name: 'Stacked Flare Jeans', price: 150, shop: 'denim' },
  { id: 'md_ripped', slot: 'bottom', style: 'jeans', color: '#5a7aa8', name: 'Light-Wash Ripped Jeans', price: 95, shop: 'denim' },
  { id: 'md_grey', slot: 'bottom', style: 'jeans', color: '#55585e', name: 'Washed Grey Denim', price: 90, shop: 'denim' },
  { id: 'md_trucker', slot: 'top', style: 'jacket', color: '#3a5580', name: 'Denim Trucker Jacket', price: 130, shop: 'denim' },
  { id: 'md_carpenter', slot: 'bottom', style: 'cargo', color: '#a07a44', name: 'Duck Canvas Carpenter Pants', price: 85, shop: 'denim' },
  // Cowtown Western Wear
  { id: 'mw_pearlsnap', slot: 'top', style: 'jacket', color: '#7a2a2a', name: 'Pearl-Snap Western Shirt', price: 70, shop: 'western' },
  { id: 'mw_wranglers', slot: 'bottom', style: 'jeans', color: '#24324f', name: 'Starched Wranglers', price: 55, shop: 'western' },
  { id: 'mw_ropers', slot: 'shoes', style: 'boots', color: '#6a4423', name: 'Brown Roper Boots', price: 180, shop: 'western' },
  { id: 'mw_gator', slot: 'shoes', style: 'boots', color: '#3a2a1a', name: 'Caiman Belly Boots', price: 650, shop: 'western', tier: 2 },
  { id: 'mw_cap_ranch', slot: 'hat', style: 'cap', color: '#5a4a2a', name: 'Feed Store Cap', price: 25, shop: 'western' },
  { id: 'mw_carhartt', slot: 'top', style: 'jacket', color: '#8a6a2a', name: 'Duck Chore Coat', price: 140, shop: 'western' },
  // Sideline Jerseys
  { id: 'mj_dallas_star', slot: 'top', style: 'tee', color: '#0b1f4d', name: 'Dallas Star Jersey (Navy)', price: 130, shop: 'jersey' },
  { id: 'mj_dallas_white', slot: 'top', style: 'tee', color: '#eef0f4', name: 'Dallas Star Jersey (White)', price: 130, shop: 'jersey' },
  { id: 'mj_mavs', slot: 'top', style: 'tee', color: '#0a5ac4', name: 'Dallas Hoops Jersey (Blue)', price: 120, shop: 'jersey' },
  { id: 'mj_rangers', slot: 'top', style: 'tee', color: '#c41b2a', name: 'Arlington Baseball Jersey (Red)', price: 110, shop: 'jersey' },
  { id: 'mj_cap_star', slot: 'hat', style: 'cap', color: '#9aa0aa', name: 'Silver Star Snapback', price: 38, shop: 'jersey' },
  // El Mercado
  { id: 'mm_mexico', slot: 'top', style: 'tee', color: '#1a7a3a', name: 'Mexico Fútbol Jersey (Green)', price: 45, shop: 'mercado' },
  { id: 'mm_mexico_blk', slot: 'top', style: 'tee', color: '#121212', name: 'Mexico Fútbol Jersey (Black)', price: 45, shop: 'mercado' },
  { id: 'mm_botas', slot: 'shoes', style: 'boots', color: '#2a1810', name: 'Pointy Botas Vaqueras', price: 120, shop: 'mercado' },
  { id: 'mm_tejana', slot: 'hat', style: 'cap', color: '#d9c8a0', name: 'Straw Gorra', price: 18, shop: 'mercado' },
  { id: 'mm_track', slot: 'bottom', style: 'track', color: '#1a3a7a', name: 'Club Track Pants', price: 35, shop: 'mercado' },
  // Maison Noir (designer, rep-locked)
  { id: 'mx_monogram', slot: 'top', style: 'hoodie', color: '#3a2a1a', name: 'Monogram Hoodie', price: 1450, shop: 'designer', tier: 2, brand: 'maison' },
  { id: 'mx_leather', slot: 'top', style: 'jacket', color: '#0c0c0c', name: 'Black Lambskin Biker', price: 4800, shop: 'designer', tier: 3, brand: 'maison' },
  { id: 'mx_tee_logo', slot: 'top', style: 'tee', color: '#f2f2f2', name: 'Logo Tape Tee', price: 620, shop: 'designer', brand: 'maison' },
  { id: 'mx_cargo', slot: 'bottom', style: 'cargo', color: '#202020', name: 'Nylon Designer Cargos', price: 1200, shop: 'designer', tier: 2, brand: 'maison' },
  { id: 'mx_runners', slot: 'shoes', style: 'kicks', color: '#e8e8e8', name: 'Chunky Designer Runners', price: 1100, shop: 'designer', brand: 'maison' },
  { id: 'mx_redbottoms', slot: 'shoes', style: 'boots', color: '#0e0e0e', name: 'Royale Red-Bottom Spike Boots', price: 1650, shop: 'designer', tier: 3, brand: 'royale' },
  { id: 'mx_bucket', slot: 'hat', style: 'beanie', color: '#5a4a3a', name: 'Monogram Bucket Hat', price: 690, shop: 'designer', brand: 'maison' },
  { id: 'mx_mono_tee', slot: 'top', style: 'tee', color: '#3a2a1a', name: 'Maison Noir Monogram Tee', price: 750, shop: 'designer', brand: 'maison' },
  { id: 'mx_tank', slot: 'top', style: 'tank', color: '#121212', name: 'Maison Noir Ribbed Tank', price: 480, shop: 'designer', brand: 'maison' },
  { id: 'mx_mono_kicks', slot: 'shoes', style: 'kicks', color: '#5a4a3a', name: 'Maison Noir Monogram Sneakers', price: 1250, shop: 'designer', brand: 'maison', tier: 2 },
  { id: 'mx_ry_hoodie', slot: 'top', style: 'hoodie', color: '#121212', name: 'Royale Gold Crown Hoodie', price: 1100, shop: 'designer', brand: 'royale' },
  { id: 'mx_ry_hightop', slot: 'shoes', style: 'kicks', color: '#121212', name: 'Royale Red-Bottom High-Tops', price: 1450, shop: 'designer', brand: 'royale', tier: 2 },
];

// Walking around: what can happen in an hour at the mall. Weights.
export const MALL_WALK = [
  ['recognized', 4],   // somebody knows you from Throttle
  ['number', 3],       // you leave with a number
  ['fitpic', 3],       // a fit pic by the fountain
  ['drop', 2],         // a line for a sneaker drop
  ['security', 2],     // mall cops follow you around
  ['window', 4],       // nothing: window shopping
];
