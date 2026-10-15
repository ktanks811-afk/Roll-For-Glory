// Colorado: the legal weed state (data/states.js 'co', Denver). Grow farms
// you buy and plant, dispensaries you buy and stock, and the strains that
// go through them. Rules live in core/weed.js, the screens in ui/weed.js;
// world2d/states.js draws the farms east of Denver along I-70 and E-470.
//
// No imports beyond data/states.js: core/weed.js, data/world.js and
// scripts/check-data.mjs all read this.

import { STATES } from './states.js';

// days: game days from clones to harvest (indoor, before a farm's `speed`).
// yield: ounces of dried flower per plant. clone: what each plant costs to put in.
// wholesale: what a licensed processor pays per oz. retail: the shelf price per oz.
export const STRAINS = [
  { id: 'bluedream', name: 'Blue Dream', kind: 'Sativa hybrid', days: 3, yield: 2.0, clone: 8, wholesale: 70, retail: 160, color: '#4a8ae8', blurb: 'Fast, heavy and cheap. Everybody\'s first grow.' },
  { id: 'gsc', name: 'Girl Scout Cookies', kind: 'Hybrid', days: 4, yield: 1.9, clone: 12, wholesale: 95, retail: 210, color: '#c8a46a', blurb: 'A steady seller on every shelf in Denver.' },
  { id: 'ogkush', name: 'OG Kush', kind: 'Indica', days: 4, yield: 1.8, clone: 12, wholesale: 100, retail: 220, color: '#5a8a3a', blurb: 'The classic. Gas.' },
  { id: 'gelato', name: 'Gelato', kind: 'Hybrid', days: 5, yield: 1.7, clone: 18, wholesale: 130, retail: 280, color: '#b06ae8', blurb: 'Purple, dessert-sweet, and the customers ask for it by name.' },
  { id: 'runtz', name: 'Runtz', kind: 'Hybrid', days: 6, yield: 1.6, clone: 25, wholesale: 165, retail: 340, color: '#ff6ab0', blurb: 'Candy terps and the bag appeal. Top shelf.' },
  { id: 'glitchog', name: 'Glitch OG', kind: 'House strain', days: 7, yield: 1.5, clone: 40, wholesale: 210, retail: 420, color: '#2cff7a', blurb: 'The studio\'s own cut. Slow, picky, and the most expensive jar in the state.' },
];
export const STRAIN_BY_ID = Object.fromEntries(STRAINS.map(g => [g.id, g]));

// Grow farms. plants: how many the farm holds. speed: days multiplier
// (greenhouses and outdoor take longer). quality: yield multiplier.
// upkeep: power, water and the license, every day. storm: outdoor crops can
// lose a share to a hailstorm (the odds per day, and the share lost).
export const FARMS = {
  grow_fivepoints: { name: 'Five Points Grow Room', kind: 'Indoor', plants: 60, price: 60000, upkeep: 300, speed: 1, quality: 1, wage: 150,
    desc: 'A converted auto shop off Downing St. Lights, fans, sixty pots. Small, fast and right in town.' },
  grow_commerce: { name: 'Commerce City Warehouse', kind: 'Indoor', plants: 250, price: 280000, upkeep: 1100, speed: 1, quality: 1.05, wage: 350,
    desc: 'A licensed warehouse grow off I-70 with climate control and a vault. Indoor, so every harvest comes in on time.' },
  grow_brighton: { name: 'Brighton Greenhouses', kind: 'Greenhouse', plants: 500, price: 520000, upkeep: 1500, speed: 1.2, quality: 1, wage: 500,
    desc: 'Six glass houses on the plains. Free sunshine, so it costs less to run per plant, but the crop takes a little longer.' },
  grow_highplains: { name: 'High Plains Farm', kind: 'Outdoor', plants: 1200, price: 900000, upkeep: 1800, speed: 1.5, quality: 0.9, wage: 900, storm: [0.05, 0.3],
    desc: 'Forty acres of outdoor rows off E-470. Huge harvests, slow, and a hailstorm can flatten part of the field.' },
  grow_arkansas: { name: 'Arkansas Valley Farm', kind: 'Outdoor', plants: 3000, price: 2000000, upkeep: 4000, speed: 1.6, quality: 0.9, wage: 1800, storm: [0.05, 0.3],
    desc: 'The biggest licensed grow in the state: a hundred acres, a drying barn and a trimming crew. Feeds every shop you own.' },
};
export const FARM_IDS = Object.keys(FARMS);

// Dispensaries. traffic: customers a day at fair prices. spend: how much
// each one pays against the shelf price (Cherry Creek pays more).
// staff: customers each budtender can serve in a day.
export const SHOPS = {
  disp_colfax: { name: 'Colfax Cannabis Co.', price: 150000, traffic: 120, spend: 1, rent: 400,
    desc: 'A corner shop on Colfax, open late. Steady walk-in traffic, nothing fancy.' },
  disp_rino: { name: 'RiNo Green', price: 260000, traffic: 170, spend: 1.05, rent: 650,
    desc: 'Murals, a tasting bar for the terps, and the brewery crowd from next door.' },
  disp_lodo: { name: 'LoDo Dispensary', price: 420000, traffic: 230, spend: 1.1, rent: 900,
    desc: 'Two blocks from Coors Field. Game days, the line goes out the door.' },
  disp_cherry: { name: 'Cherry Creek Apothecary', price: 750000, traffic: 300, spend: 1.3, rent: 1500,
    desc: 'Glass cases, a concierge and customers who don\'t look at the price tag.' },
};
export const SHOP_IDS = Object.keys(SHOPS);

export const OZ_PER_CUSTOMER = 0.3;    // an eighth to a half: about this much a sale
export const BUDTENDER = { pay: 160, serves: 45 };
export const TAX = 0.15;               // Colorado's retail marijuana tax, off the top of every sale
export const DISTRIBUTOR_MARKUP = 1.3; // the wholesale distributor charges this over the processor price
export const SELL_BACK = 0.7;          // what a business sells for, against what you paid
export const LEGAL_OZ = 2;             // what an adult can carry in Colorado without a charge

// How you price the shelf: cheaper brings more people in.
export const PRICE_LEVELS = [
  { id: 'value', name: 'Value', price: 0.85, traffic: 1.25, blurb: 'Cheap jars. More people, less each.' },
  { id: 'fair', name: 'Market', price: 1, traffic: 1, blurb: 'What everybody else on the block charges.' },
  { id: 'top', name: 'Top shelf', price: 1.2, traffic: 0.75, blurb: 'Premium prices. Fewer customers, more each.' },
];
export const LEVEL_BY_ID = Object.fromEntries(PRICE_LEVELS.map(l => [l.id, l]));

// ---------------------------------------------------------------- the map
// Denver's grid starts at (cx, cz). The farms sit out east of town on two
// roads (data/metro.js STATE_ROUTES.co): I-70 on the city's second street
// line, and E-470 north to south.
const CO = STATES.co;
export const I70_Z = CO.cz + 150;
export const E470_X = CO.cx + 2600;
const FACE = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 };
const P = (id, type, name, side, x0, z0, x1, z1, extra = {}) => {
  const mid = side === 'N' || side === 'S' ? (x0 + x1) / 2 : (z0 + z1) / 2;
  const at = side === 'N' ? { x: mid, z: z0 - 2 } : side === 'S' ? { x: mid, z: z1 + 2 } : side === 'W' ? { x: x0 - 2, z: mid } : { x: x1 + 2, z: mid };
  return { id, type, name, side, ...at, face: FACE[side], lot: { x0, z0, x1, z1 }, state: 'co', color: '#2cff7a', icon: 'leaf', ...extra };
};
// look: how world2d/states.js draws the lot
export const WEED_LOCATIONS = [
  P('grow_commerce', 'growfarm', FARMS.grow_commerce.name, 'S', CO.cx + 1420, I70_Z - 230, CO.cx + 1640, I70_Z - 28, { look: 'warehouse' }),
  P('grow_brighton', 'growfarm', FARMS.grow_brighton.name, 'N', CO.cx + 1800, I70_Z + 28, CO.cx + 2160, I70_Z + 300, { look: 'greenhouse' }),
  P('grow_highplains', 'growfarm', FARMS.grow_highplains.name, 'W', E470_X + 28, CO.cz + 450, E470_X + 520, CO.cz + 950, { look: 'outdoor' }),
  P('grow_arkansas', 'growfarm', FARMS.grow_arkansas.name, 'W', E470_X + 28, CO.cz + 1100, E470_X + 820, CO.cz + 1850, { look: 'outdoor' }),
];
