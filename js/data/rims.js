// The Glitch rim pack: 44 wheels drawn from Kimari's rim sheets, packed into
// img/rims.webp (11 per row, 128 px each). Wheels 0-19 are the rim face only;
// 20-43 come with their tire and brakes already drawn. Sold as Wheels at
// Vega Kustoms and PartsHub under the made-up brand Glitch Wheel Co.
//
// [name, closest drawn style (for judging and fallbacks), main color, price]
const ROWS = [
  ['GW-5 Classic (silver)', 'five', '#c0c4c8', 1150],
  ['Redline Multi-Spoke (black, red lip)', 'split', '#1a1a1a', 1650],
  ['Rays-Style 6-Spoke (gold)', 'six', '#c9a24a', 1850],
  ['GW-5 Classic (gunmetal)', 'five', '#5b5f66', 1150],
  ['Lattice Mesh (silver)', 'mesh', '#c0c4c8', 2450],
  ['GW-5 Classic (black)', 'five', '#1a1a1a', 1150],
  ['Twelve Spoke (silver)', 'split', '#c0c4c8', 1350],
  ['Rays-Style 6-Spoke (bronze)', 'six', '#8a6a3a', 1850],
  ['Two-Piece Riveted 5 (silver)', 'five', '#c0c4c8', 2650],
  ['Blueline 10-Spoke (black, blue lip)', 'split', '#1a1a1a', 1650],
  ['Lattice Mesh (gold, polished lip)', 'mesh', '#c9a24a', 2850],
  ['Twin 6-Spoke (gunmetal)', 'six', '#5b5f66', 1250],
  ['Drag 8-Hole (polished)', 'dish', '#c0c4c8', 1450],
  ['GW-5 Track (black)', 'five', '#1a1a1a', 1250],
  ['GW-5 Sport (silver)', 'five', '#c0c4c8', 1150],
  ['Swirl Turbine (silver)', 'turbine', '#c0c4c8', 2250],
  ['Riveted 5 (black)', 'five', '#1a1a1a', 1550],
  ['GW-5 Candy (red)', 'five', '#c41b1b', 1450],
  ['Ten Spoke (silver)', 'split', '#c0c4c8', 1250],
  ['Blackout Steelie (gold lugs)', 'steel', '#1a1a1a', 650],
  ['Forged 5 (gunmetal)', 'five', '#5b5f66', 2650],
  ['Forged Mesh Two-Piece (silver)', 'mesh', '#c0c4c8', 3450],
  ['Forged 6-Spoke (bronze)', 'six', '#8a6a3a', 3150],
  ['Forged Multi-Spoke (black)', 'split', '#1a1a1a', 2950],
  ['Deep Dish Drag (polished)', 'dish', '#c0c4c8', 2450],
  ['Forged 5 (white)', 'five', '#f2f2f2', 2650],
  ['Forged Mesh (black, polished lip)', 'mesh', '#1a1a1a', 3450],
  ['Forged Mesh (gold, polished lip)', 'mesh', '#c9a24a', 3650],
  ['Forged 5 (gunmetal, blue calipers)', 'five', '#5b5f66', 2850],
  ['Deep Lip 5 (silver)', 'five', '#c0c4c8', 3050],
  ['Split 5 (black, red)', 'split', '#1a1a1a', 3250],
  ['Forged Multi-Spoke (bronze)', 'split', '#8a6a3a', 2950],
  ['Forged 6-Spoke (white)', 'six', '#f2f2f2', 3150],
  ['Forged 5 (matte black)', 'five', '#1a1a1a', 2650],
  ['Five Star (gold)', 'five', '#c9a24a', 2850],
  ['Twelve Spoke Forged (silver)', 'split', '#c0c4c8', 2950],
  ['Swirl Turbine (dark)', 'turbine', '#5b5f66', 3250],
  ['Beadlock Drag (black)', 'dish', '#1a1a1a', 1950],
  ['Forged Multi-Spoke (black, red lip)', 'split', '#1a1a1a', 3150],
  ['Forged Mesh (polished)', 'mesh', '#c0c4c8', 3650],
  ['Forged 5 (gunmetal, deep)', 'five', '#5b5f66', 2850],
  ['Ten Spoke Forged (bronze)', 'split', '#8a6a3a', 2950],
  ['Split 5 (candy blue)', 'split', '#1b4fc4', 3250],
  ['Deep Lip 5 (polished)', 'five', '#c0c4c8', 3450],
];

export const RIM_ATLAS = 'img/rims.webp';
export const RIM_CELL = 128, RIM_COLS = 11;
export const RIMS = ROWS.map(([name, style, color, price], i) => ({
  id: `gw${String(i).padStart(2, '0')}`, i, name, style, color, price, tire: i >= 20,
}));
export const RIM_BY_ID = Object.fromEntries(RIMS.map(r => [r.id, r]));

// Catalog rows for catalog.js: [brand, name, price, value, extra]
export const RIM_PRODUCTS = RIMS.map(r => ['Glitch Wheel Co.', `${r.name} (set)`, r.price, r.style, { color: r.color, rim: r.id }]);
