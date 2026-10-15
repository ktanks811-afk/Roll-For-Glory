// Boats: the dealer's catalog (jet skis to gigayachts), the marinas they
// live at, and every way you can dress one up. Prices are rough 2025-26 US
// numbers. Lengths and beams are meters, top speeds are m/s (1 m/s = 1.94 kn).
// Rules for owning them are core/boats.js; on the water it's world2d/boats.js;
// the art is gfx2d/boatArt.js.

// kind decides the shape the art draws and which upgrades fit:
// pwc (jet ski), bass, pontoon, wake, console, gofast, cruiser, yacht, superyacht
const B = (id, kind, make, model, price, L, W, top, extra = {}) => ({ id, kind, make, model, name: `${make} ${model}`, price, L, W, top, ...extra });

export const BOATS = [
  // ---------------- personal watercraft ----------------
  B('spark_trixx', 'pwc', 'Sea-Doo', 'Spark Trixx', 9800, 3.1, 1.2, 22, { accel: 7, turn: 2.6, seats: 3, desc: 'Light, flicky and cheap. Wheelies off the wake.' }),
  B('waverunner_fx', 'pwc', 'Yamaha', 'WaveRunner FX Cruiser SVHO', 19800, 3.6, 1.3, 30, { accel: 8, turn: 2.3, seats: 3, desc: 'Supercharged 1.8 L. Big seat, bigger top end.' }),
  B('rxpx_325', 'pwc', 'Sea-Doo', 'RXP-X 325', 20500, 3.4, 1.3, 31.5, { accel: 9, turn: 2.6, seats: 2, desc: 'The race ski. 325 hp and it corners like it\'s on rails.' }),
  B('ultra_310lx', 'pwc', 'Kawasaki', 'Jet Ski Ultra 310LX', 22300, 3.6, 1.2, 30.5, { accel: 8.5, turn: 2.2, seats: 3, desc: 'Supercharged, Bluetooth speakers built in.' }),
  // ---------------- small boats ----------------
  B('nitro_z21', 'bass', 'Nitro', 'Z21 Pro', 68000, 6.4, 2.4, 31, { accel: 5.5, turn: 1.7, seats: 3, desc: 'Metal flake bass boat with a 250 Mercury. Low and loud.' }),
  B('bennington_25qx', 'pontoon', 'Bennington', '25 QX Sport', 115000, 7.6, 2.6, 22, { accel: 3.6, turn: 1.3, seats: 14, desc: 'Tritoon party barge. Twin 350s on the back. The lake\'s living room.' }),
  B('mastercraft_x24', 'wake', 'MasterCraft', 'X24', 265000, 7.3, 2.6, 18, { accel: 4.5, turn: 1.5, seats: 16, desc: 'Surf wake on demand, tower speakers, ballast for days.' }),
  B('whaler_280', 'console', 'Boston Whaler', '280 Outrage', 420000, 8.5, 2.9, 22.5, { accel: 4.6, turn: 1.5, seats: 10, desc: 'Unsinkable center console. Twin Verados.' }),
  B('cigarette_42', 'gofast', 'Cigarette', '42 Nighthawk', 1350000, 12.8, 2.6, 46, { accel: 6.5, turn: 1.2, seats: 6, desc: 'Quad 450R Mercurys. 100 mph on flat water. Miami Vice energy.' }),
  B('searay_370', 'cruiser', 'Sea Ray', 'Sundancer 370', 760000, 11.6, 3.6, 18, { accel: 3.2, turn: 1.0, seats: 12, desc: 'Cabin, galley, sunpad up front. Weekend on the lake.' }),
  // ---------------- yachts ----------------
  B('azimut_60', 'yacht', 'Azimut', '60 Flybridge', 2900000, 18.5, 4.9, 16.5, { accel: 2.2, turn: 0.75, seats: 20, decks: 2, desc: 'Italian flybridge. Three cabins, a crew cabin, a hot tub fits up top.' }),
  B('manhattan_68', 'yacht', 'Sunseeker', 'Manhattan 68', 4600000, 21, 5.2, 15.5, { accel: 2.0, turn: 0.7, seats: 24, decks: 2, desc: 'British flybridge. Beach club at the stern, four cabins.' }),
  B('riva_88', 'yacht', 'Riva', '88 Florida', 9800000, 27, 6.2, 20.5, { accel: 2.3, turn: 0.65, seats: 30, decks: 2, desc: 'Fast Italian sport yacht. Pure jewelry on the water.' }),
  // ---------------- superyachts ----------------
  B('benetti_oasis', 'superyacht', 'Benetti', 'Oasis 40M', 28000000, 40, 8.5, 8.5, { accel: 1.1, turn: 0.4, seats: 60, decks: 3, desc: 'Fold-down terraces and a pool at the stern. 40 meters of party.' }),
  B('feadship_75', 'superyacht', 'Feadship', '75 m Custom', 135000000, 75, 12.5, 9.5, { accel: 0.8, turn: 0.28, seats: 120, decks: 4, desc: 'Dutch-built custom. Helipad, spa, cinema, the works.' }),
  B('lurssen_110', 'superyacht', 'Lürssen', '110 m Gigayacht', 340000000, 110, 18, 11, { accel: 0.65, turn: 0.2, seats: 200, decks: 5, desc: 'The biggest thing on the water. Two helipads, a submarine bay. Billionaire stuff.' }),
];
export const BOAT_BY_ID = Object.fromEntries(BOATS.map(b => [b.id, b]));
export const KIND_NAME = { pwc: 'Jet ski', bass: 'Bass boat', pontoon: 'Pontoon', wake: 'Wake boat', console: 'Center console', gofast: 'Go-fast', cruiser: 'Cruiser', yacht: 'Yacht', superyacht: 'Superyacht' };
export const ft = m => Math.round(m * 3.281);
export const knots = ms => ms * 1.944;
export const isBig = def => def.L >= 24;      // needs a deep-water marina

// ---------------------------------------------------------------- marinas
// Each sits on a shore: (x, z) is the door on land, `to` the way out over the
// water (N/S/E/W), `drive` the road in from the nearest highway. `deep` marinas take boats over 24 m (80 ft).
export const MARINAS = [
  { id: 'marina_harbor', name: 'Trinity Harbor Yacht Club', x: 996, z: 880, to: 'E', deep: true, area: 'Fort Worth Harbor', blurb: 'Fort Worth\'s big water. Superyachts tie up on the T-dock.' , drive: [[900, 900], [900, 912], [977, 912]] },
  { id: 'marina_lewisville', name: 'Lewisville Marina', x: 2436, z: -5420, to: 'E', deep: true, area: 'Lake Lewisville', blurb: 'Party cove central. Bait shop, fuel dock, ramp.' , drive: [[2200, -5378], [2417, -5378]] },
  { id: 'marina_eagle', name: 'Eagle Mountain Marina', x: -3050, z: -3966, to: 'N', area: 'Eagle Mountain Lake', blurb: 'Northwest of town off TX-199. Wake boats and pontoons.' , drive: [[-3008, -3900], [-3008, -3947]] },
  { id: 'marina_granbury', name: 'Granbury Harbor', x: -6114, z: 1290, to: 'E', area: 'Lake Granbury', blurb: 'By the US-377 bridge. Cruise under it to the south lake.' , drive: [[-6133, 1350], [-6133, 1332]] },
  { id: 'marina_whitney', name: 'Lake Whitney Marina', x: 2814, z: 8560, to: 'W', area: 'Lake Whitney', blurb: 'Clear water down south off TX-22.' , drive: [[2850, 8518], [2833, 8518]] },
  { id: 'marina_pk', name: 'Possum Kingdom Marina', x: -9186, z: -4740, to: 'W', area: 'Possum Kingdom Lake', blurb: 'Way out west. Hell\'s Gate cliffs and the clearest water in Texas.' , drive: [[-9000, -4782], [-9167, -4782]] },
  { id: 'marina_rayroberts', name: 'Ray Roberts Marina', x: 1186, z: -9600, to: 'E', area: 'Lake Ray Roberts', blurb: 'Up past Denton. Quiet, big and empty.' , drive: [[750, -9558], [1167, -9558]] },
  { id: 'marina_miami', name: 'Bayside Marina', x: 15506, z: 3540, to: 'E', deep: true, state: 'fl', area: 'Biscayne Bay', blurb: 'Downtown Miami on the bay. Cruise under the causeways.' , drive: [[15487, 3600], [15487, 3582]] },
];
export const MARINA_BY_ID = Object.fromEntries(MARINAS.map(m => [m.id, m]));
export const DIR = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
// the marina drive from the nearest road into each lot (world2d/roads.js builds them)
// (`drive` ends in the middle of the lot; it carries on to the front by the clubhouse door)
export const MARINA_ROADS = MARINAS.map(m => {
  const [dx, dz] = DIR[m.to], at = (u, v) => [Math.round(m.x - dx * u - dz * v), Math.round(m.z - dz * u + dx * v)];
  return { name: `${m.name.split(' ').slice(0, -1).join(' ') || m.name} Dr`, kind: 'farm', pts: [...m.drive, at(19, 23), at(6, 23)] };
});
// the marinas as map places (data/world.js adds these to LOCATIONS)
export const MARINA_LOCATIONS = MARINAS.map(m => ({
  id: m.id, type: 'marina', name: m.name, x: m.x, z: m.z, face: Math.atan2(DIR[m.to][1], DIR[m.to][0]), color: '#1bb8e8', icon: 'boat', ...(m.state ? { state: m.state } : {}),
}));

// ---------------------------------------------------------------- customizing
// Everything you can change. Prices scale with the boat: `per` is per square
// meter of boat (L x W), `flat` is fixed, `min` is the shortest boat it fits.
export const HULL_COLORS = [
  ['#f4f4f2', 'Arctic White'], ['#0d0d10', 'Gloss Black'], ['#1a2a4a', 'Navy'], ['#2a6bd1', 'Royal Blue'], ['#21b8d8', 'Miami Teal'],
  ['#c41b1b', 'Ferrari Red'], ['#ff6a00', 'Safety Orange'], ['#e8c21a', 'Yellow'], ['#2cbf5a', 'Lime'], ['#6a1ab8', 'Purple'],
  ['#ff3aa8', 'Hot Pink'], ['#9aa0a8', 'Gunmetal'], ['#c9a45a', 'Champagne Gold'], ['#5a3a22', 'Mahogany'], ['#3a4a2a', 'Olive'], ['#7a1414', 'Burgundy'],
];
export const FINISHES = [
  { id: 'gloss', name: 'Gloss', per: 0 }, { id: 'metallic', name: 'Metallic flake', per: 60 }, { id: 'pearl', name: 'Pearl', per: 90 },
  { id: 'matte', name: 'Matte', per: 80 }, { id: 'chrome', name: 'Mirror chrome', per: 420 }, { id: 'carbon', name: 'Exposed carbon', per: 300 },
];
export const WRAPS = [
  { id: 'none', name: 'None', per: 0 }, { id: 'boot', name: 'Boot stripe', per: 15 }, { id: 'racing', name: 'Twin racing stripes', per: 30 },
  { id: 'fade', name: 'Color fade', per: 55 }, { id: 'flames', name: 'Flames', per: 70 }, { id: 'waves', name: 'Ocean waves', per: 60 },
  { id: 'camo', name: 'Digital camo', per: 65 }, { id: 'checker', name: 'Checkered flag', per: 60 }, { id: 'tribal', name: 'Tribal', per: 65 },
  { id: 'money', name: 'Hundred-dollar bills', per: 90 }, { id: 'texas', name: 'Texas flag', per: 70 }, { id: 'diamond', name: 'Diamond plate', per: 80 },
];
export const DECKS = [
  { id: 'teak', name: 'Teak', color: '#b07a45', per: 0 }, { id: 'grey_teak', name: 'Grey teak', color: '#8f8a80', per: 40 },
  { id: 'black_teak', name: 'Black teak', color: '#2f2a26', per: 70 }, { id: 'white', name: 'White non-skid', color: '#e6e6e0', per: 10 },
  { id: 'carbon', name: 'Carbon', color: '#1d1e22', per: 160 }, { id: 'marble', name: 'Marble', color: '#e9e4dc', per: 260 },
];
export const TINTS = [
  { id: 'smoke', name: 'Smoke', color: '#2a333c' }, { id: 'black', name: 'Limo black', color: '#0b0c0f' },
  { id: 'blue', name: 'Blue mirror', color: '#2a5f9a' }, { id: 'gold', name: 'Gold mirror', color: '#b08a2a' }, { id: 'green', name: 'Emerald', color: '#1f5a40' },
];
export const INTERIORS = [
  { id: 'modern', name: 'Modern white', desc: 'White leather, oak, brushed steel.', per: 0, lux: 0 },
  { id: 'miami', name: 'Miami nights', desc: 'White and aqua, neon under every seat.', per: 120, lux: 6 },
  { id: 'ranch', name: 'Texas ranch', desc: 'Saddle leather, cowhide rugs, longhorns over the bar.', per: 140, lux: 7 },
  { id: 'versace', name: 'Black and gold', desc: 'Gold trim on everything, black marble, a crest on the carpet.', per: 260, lux: 12 },
  { id: 'zen', name: 'Tokyo minimal', desc: 'Pale wood, paper screens, a bonsai in every cabin.', per: 180, lux: 9 },
  { id: 'velvet', name: 'Red velvet', desc: 'Velvet booths, crystal chandeliers. Scarface vibes.', per: 220, lux: 10 },
  { id: 'jungle', name: 'Tropical', desc: 'Living plant walls, rattan, a fish tank in the floor.', per: 240, lux: 11 },
];
export const UPHOLSTERY = [['#f4f0e6', 'Bone'], ['#1b1b1d', 'Black'], ['#8a5a32', 'Saddle'], ['#c41b1b', 'Red'], ['#21b8d8', 'Aqua'], ['#c9a45a', 'Gold'], ['#2a6bd1', 'Blue']];
export const GLOWS = [
  ['none', 'Off'], ['#2a8bff', 'Blue'], ['#f2f6ff', 'White'], ['#2cff7a', 'Green'], ['#b44aff', 'Purple'], ['#ff2a3a', 'Red'], ['#21e8e0', 'Teal'], ['rainbow', 'Color cycle'],
];
export const FONTS = [
  { id: 'block', name: 'Block', css: '900 1em Arial, sans-serif' }, { id: 'script', name: 'Script', css: 'italic 700 1em Georgia, serif' },
  { id: 'serif', name: 'Classic', css: '700 1em Georgia, serif' }, { id: 'mono', name: 'Stencil', css: '700 1em "Courier New", monospace' },
];
export const FLAGS = [
  { id: 'texas', name: 'Texas' }, { id: 'usa', name: 'USA' }, { id: 'pirate', name: 'Jolly Roger' }, { id: 'crew', name: 'Your crew colors' },
  { id: 'mexico', name: 'Mexico' }, { id: 'cayman', name: 'Cayman Islands' }, { id: 'none', name: 'No flag' },
];
export const HORNS = [
  { id: 'stock', name: 'Stock horn', price: 0 }, { id: 'ship', name: 'Ship horn', price: 4500 }, { id: 'train', name: 'Train horn', price: 2500 },
  { id: 'dixie', name: 'La Cucaracha', price: 1200 }, { id: 'air', name: 'Air raid siren', price: 6000 },
];
export const SOUND = [
  { id: 'stock', name: 'Factory', price: 0, lux: 0 }, { id: 'tower', name: 'Wake tower speakers', price: 9000, lux: 3 },
  { id: 'jl', name: 'JL Audio full system', price: 28000, lux: 6 }, { id: 'club', name: 'Club rig with subs', price: 95000, lux: 10 },
];
// Engine stages: each one adds top speed and pull. cost is a share of the boat's price.
export const ENGINES = [
  { n: 0, name: 'Factory', top: 1, accel: 1, cost: 0 },
  { n: 1, name: 'Tuned (ECU, props)', top: 1.08, accel: 1.1, cost: 0.06 },
  { n: 2, name: 'Performance (bigger motors)', top: 1.16, accel: 1.22, cost: 0.14 },
  { n: 3, name: 'Race (built motors, surface drives)', top: 1.26, accel: 1.38, cost: 0.26 },
];
export const DRIVES = [
  { id: 'stock', name: 'Factory drive', turn: 1, cost: 0 },
  { id: 'pods', name: 'Joystick pod drives', turn: 1.35, cost: 0.05 },
  { id: 'thrusters', name: 'Bow and stern thrusters', turn: 1.2, cost: 0.02 },
];
// Add-ons for yachts: `min` is the shortest boat it fits on.
export const AMENITIES = [
  { id: 'jacuzzi', name: 'Jacuzzi on the top deck', min: 15, price: 180000, lux: 6 },
  { id: 'slide', name: 'Inflatable water slide', min: 15, price: 45000, lux: 3 },
  { id: 'dj', name: 'DJ booth', min: 15, price: 120000, lux: 4 },
  { id: 'toys', name: 'Water toys (Seabobs, floats, paddleboards)', min: 15, price: 90000, lux: 3 },
  { id: 'skiGarage', name: 'Jet ski garage (two skis)', min: 25, price: 600000, lux: 6 },
  { id: 'beachClub', name: 'Beach club with fold-down platform', min: 25, price: 2400000, lux: 9 },
  { id: 'cinema', name: 'Cinema', min: 25, price: 900000, lux: 6 },
  { id: 'gym', name: 'Gym and spa', min: 25, price: 650000, lux: 5 },
  { id: 'chef', name: 'Chef\'s galley + sushi bar', min: 25, price: 750000, lux: 6 },
  { id: 'pool', name: 'Glass-wall pool', min: 38, price: 3200000, lux: 12 },
  { id: 'helipad', name: 'Helipad', min: 38, price: 4500000, lux: 12 },
  { id: 'nightclub', name: 'Nightclub deck', min: 38, price: 2600000, lux: 10 },
  { id: 'skyLounge', name: 'Sky lounge bar', min: 38, price: 1800000, lux: 8 },
  { id: 'observatory', name: 'Glass-bottom lounge', min: 60, price: 12000000, lux: 14 },
  { id: 'sub', name: 'Triton submarine', min: 70, price: 24000000, lux: 18 },
  { id: 'helipad2', name: 'Second helipad + hangar', min: 90, price: 18000000, lux: 14 },
];
export const AMENITY_BY_ID = Object.fromEntries(AMENITIES.map(a => [a.id, a]));
export const CREW = [
  { id: 'captain', name: 'Captain', min: 15, wage: 900, lux: 3 },
  { id: 'chef', name: 'Private chef', min: 15, wage: 700, lux: 4 },
  { id: 'deck', name: 'Deckhands (2)', min: 15, wage: 600, lux: 2 },
  { id: 'stews', name: 'Stewards (3)', min: 25, wage: 1100, lux: 4 },
  { id: 'security', name: 'Security team', min: 25, wage: 1800, lux: 3 },
  { id: 'dj', name: 'Resident DJ', min: 15, wage: 1500, lux: 5 },
];

// A new boat's look straight off the lot
export function defaultCustom(def) {
  const white = !['gofast', 'bass'].includes(def.kind);
  return {
    hull: white ? '#f4f4f2' : def.kind === 'gofast' ? '#0d0d10' : '#c41b1b', hull2: '#21b8d8', finish: def.kind === 'bass' ? 'metallic' : 'gloss',
    wrap: def.kind === 'gofast' ? 'racing' : def.kind === 'bass' || def.kind === 'pwc' ? 'fade' : 'boot', stripe: '#1a2a4a',
    sup: '#f4f4f2', deck: 'teak', tint: 'smoke', interior: 'modern', uph: '#f4f0e6',
    under: 'none', accent: 'none', name: '', port: 'FORT WORTH, TX', font: 'script', nameColor: '#c9a45a', flag: 'texas',
    horn: 'stock', sound: 'stock', engine: 0, drive: 'stock', amen: [], crew: [],
  };
}
