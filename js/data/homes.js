// Houses you design yourself (core/homes.js has the rules, ui/builder.js
// the screen, world2d/house.js puts them on the map).
//
// A design is a grid of 2 m tiles, up to three floors. Each tile is a room
// type (or empty), furniture sits on the tiles, and the walls, roof and
// stairs follow from that, the way the Sims builds a house.

export const TILE = 2;            // metres per tile
export const GW = 16, GD = 12;    // the grid: 32 m along the street, 24 m deep
export const FLOOR_H = 3.2;       // one storey, metres
export const MAX_FLOORS = 3;

// Room types. Each painted tile costs `price` per floor. `c` is the floor
// colour you see once you walk in and the roof fades away.
export const ROOMS = [
  { id: 'L', name: 'Living room', c: '#8a6a4a', price: 1400, icon: '🛋' },
  { id: 'K', name: 'Kitchen',     c: '#c9c3b4', price: 1800, icon: '🍳' },
  { id: 'D', name: 'Dining',      c: '#7a5a3e', price: 1400, icon: '🍽' },
  { id: 'B', name: 'Bedroom',     c: '#6b5b7a', price: 1400, icon: '🛏' },
  { id: 'A', name: 'Bathroom',    c: '#b8d0d8', price: 2000, icon: '🛁' },
  { id: 'O', name: 'Office',      c: '#5a6a5a', price: 1400, icon: '💻' },
  { id: 'G', name: 'Game room',   c: '#3a3f5a', price: 1600, icon: '🎮' },
  { id: 'H', name: 'Hallway',     c: '#9a8a72', price: 1000, icon: '🚪' },
  { id: 'P', name: 'Porch / deck', c: '#8a6038', price: 400, icon: '🪵', open: true },   // no walls, no roof, ground floor only
];
export const ROOM_BY_ID = Object.fromEntries(ROOMS.map(r => [r.id, r]));

// Furniture. w × d in tiles (before turning it). room: where it can go
// (any room if left out). comfort: how good the place is to come home to.
export const FURNITURE = [
  // bedroom
  { id: 'bed',       name: 'Queen bed',        cat: 'Bedroom', w: 1, d: 1, price: 1200, comfort: 8,  c: '#e8e2d8', accent: '#6b2bd1', bed: true },
  { id: 'kingbed',   name: 'King bed',         cat: 'Bedroom', w: 2, d: 1, price: 3800, comfort: 14, c: '#f2efe8', accent: '#1b4fc4', bed: true },
  { id: 'dresser',   name: 'Dresser',          cat: 'Bedroom', w: 1, d: 1, price: 450,  comfort: 2,  c: '#6a4a2e' },
  { id: 'closet',    name: 'Walk-in closet',   cat: 'Bedroom', w: 1, d: 1, price: 2200, comfort: 4,  c: '#4a3a2e', accent: '#d9b21b' },
  // bathroom
  { id: 'toilet',    name: 'Toilet',           cat: 'Bath', w: 1, d: 1, price: 380,  comfort: 4, c: '#f4f4f4', room: 'A', toilet: true },
  { id: 'shower',    name: 'Shower',           cat: 'Bath', w: 1, d: 1, price: 900,  comfort: 4, c: '#a8d4e6', room: 'A' },
  { id: 'tub',       name: 'Soaking tub',      cat: 'Bath', w: 1, d: 1, price: 2400, comfort: 7, c: '#f4f4f4', accent: '#3fa9d6', room: 'A' },
  { id: 'sink',      name: 'Double vanity',    cat: 'Bath', w: 1, d: 1, price: 700,  comfort: 2, c: '#d8d4c8', room: 'A' },
  // kitchen
  { id: 'counter',   name: 'Counter',          cat: 'Kitchen', w: 1, d: 1, price: 600,  comfort: 1, c: '#d8d4c8', room: 'K' },
  { id: 'stove',     name: 'Six-burner stove', cat: 'Kitchen', w: 1, d: 1, price: 1800, comfort: 3, c: '#2a2a2e', room: 'K', cook: true },
  { id: 'fridge',    name: 'Fridge',           cat: 'Kitchen', w: 1, d: 1, price: 1500, comfort: 3, c: '#c8ccd2', room: 'K', fridge: true },
  { id: 'island',    name: 'Kitchen island',   cat: 'Kitchen', w: 2, d: 1, price: 2600, comfort: 4, c: '#e9e4da', accent: '#3a3f4a', room: 'K' },
  // living + dining
  { id: 'couch',     name: 'Couch',            cat: 'Living', w: 2, d: 1, price: 1400, comfort: 6, c: '#3a4a6a' },
  { id: 'sectional', name: 'Sectional',        cat: 'Living', w: 2, d: 2, price: 3900, comfort: 11, c: '#2a2a2e', accent: '#c41b1b' },
  { id: 'tv',        name: '85" TV',           cat: 'Living', w: 1, d: 1, price: 2600, comfort: 6, c: '#111215', accent: '#3fa9d6' },
  { id: 'table',     name: 'Dining table',     cat: 'Living', w: 2, d: 1, price: 1600, comfort: 4, c: '#7a5a3a' },
  { id: 'rug',       name: 'Rug',              cat: 'Living', w: 2, d: 2, price: 500,  comfort: 2, c: '#8a2a3a', flat: true },
  { id: 'plant',     name: 'Plant',            cat: 'Living', w: 1, d: 1, price: 90,   comfort: 1, c: '#2f6b3a' },
  { id: 'lamp',      name: 'Floor lamp',       cat: 'Living', w: 1, d: 1, price: 160,  comfort: 1, c: '#e8c21a' },
  // fun + office
  { id: 'desk',      name: 'Gaming desk',      cat: 'Fun', w: 1, d: 1, price: 1900, comfort: 4, c: '#1a1c22', accent: '#ff1a2e' },
  { id: 'pool',      name: 'Pool table',       cat: 'Fun', w: 2, d: 1, price: 4200, comfort: 7, c: '#1f6b3a', accent: '#6a4a2e' },
  { id: 'arcade',    name: 'Arcade cabinet',   cat: 'Fun', w: 1, d: 1, price: 2800, comfort: 5, c: '#2a1a4a', accent: '#2cff7a' },
  { id: 'bar',       name: 'Home bar',         cat: 'Fun', w: 2, d: 1, price: 5200, comfort: 8, c: '#3a2418', accent: '#d9b21b' },
  { id: 'trophy',    name: 'Trophy case',      cat: 'Fun', w: 1, d: 1, price: 1500, comfort: 3, c: '#4a3a2e', accent: '#e8c21a' },
  { id: 'safe',      name: 'Floor safe',       cat: 'Fun', w: 1, d: 1, price: 3500, comfort: 2, c: '#3a3d42' },
  // outside on the porch
  { id: 'grill',     name: 'Smoker grill',     cat: 'Outdoor', w: 1, d: 1, price: 1100, comfort: 4, c: '#1a1a1a', room: 'P' },
  { id: 'jacuzzi',   name: 'Hot tub',          cat: 'Outdoor', w: 2, d: 2, price: 9800, comfort: 12, c: '#d8d4c8', accent: '#3fa9d6', room: 'P' },
  { id: 'chairs',    name: 'Patio chairs',     cat: 'Outdoor', w: 1, d: 1, price: 300,  comfort: 2, c: '#6a4a2e', room: 'P' },
  // getting upstairs
  { id: 'stairs',    name: 'Staircase',        cat: 'Stairs', w: 1, d: 2, price: 3200, comfort: 0, c: '#6a4a2e', stairs: true },
];
export const FURN_BY_ID = Object.fromEntries(FURNITURE.map(f => [f.id, f]));
export const FURN_CATS = ['Bedroom', 'Bath', 'Kitchen', 'Living', 'Fun', 'Outdoor', 'Stairs'];

export const WALL_COLORS = ['#e8e2d8', '#d9c9a8', '#b8a58a', '#a0805e', '#8a3b2a', '#7f8a6a', '#5d6b7a', '#3a3f4a', '#f2f2f2', '#2a2a2e'];
export const ROOF_COLORS = ['#3a3330', '#5a4632', '#6b3a2e', '#2f3b4a', '#3a4a3a', '#45484d', '#7a7e83', '#1a1c22'];
export const ROOF_STYLES = [['shingle', 'Shingles'], ['metal', 'Metal'], ['flat', 'Flat']];

// ---------------------------------------------------------------- presets
// Rows run from the street (row 0) to the back. One string per row, one
// letter per tile, '.' for nothing.
const rows = r => r.map(s => s.padEnd(GW, '.')).join('').slice(0, GW * GD).padEnd(GW * GD, '.');
const F = (id, x, y, r = 0) => ({ id, x, y, r });

export const PRESETS = {
  // a starter: two bedrooms, one bath, a porch
  starter: { name: '1-story starter', wall: '#b8a58a', roof: '#5a4632', roofStyle: 'shingle',
    floors: [rows([
      'PPPPPP',
      'LLLKKK',
      'LLLKKK',
      'HHHHAA',
      'BBBBBB',
      'BBBBBB',
    ])],
    furn: [[F('chairs', 0, 0), F('grill', 5, 0), F('couch', 0, 1), F('tv', 2, 2), F('stove', 3, 1), F('fridge', 5, 1), F('counter', 4, 1),
      F('toilet', 4, 3), F('shower', 5, 3), F('bed', 0, 4), F('dresser', 2, 4), F('bed', 4, 5), F('plant', 5, 4)]] },
  // a one-story brick ranch: two bedrooms, a big bath, a den
  one: { name: '1-story ranch', wall: '#a0805e', roof: '#6b3a2e', roofStyle: 'shingle',
    floors: [rows([
      'PPPPPPPPPP',
      'LLLLLDDKKK',
      'LLLLLDDKKK',
      'LLLLLHHKKK',
      'BBBAAHHBBB',
      'BBBAAHHBBB',
      'BBBOOOOBBB',
    ])],
    furn: [[F('chairs', 1, 0), F('chairs', 3, 0), F('grill', 8, 0), F('sectional', 0, 1), F('tv', 3, 3), F('rug', 2, 1), F('table', 5, 1, 1),
      F('stove', 7, 1), F('fridge', 9, 1), F('island', 8, 2), F('counter', 9, 3),
      F('kingbed', 0, 4), F('dresser', 2, 6), F('toilet', 3, 4), F('tub', 4, 4), F('sink', 3, 5),
      F('bed', 8, 4), F('dresser', 9, 6), F('desk', 4, 6), F('trophy', 5, 6)]] },
  // two stories: living downstairs, bedrooms up
  two: { name: '2-story', wall: '#d9c9a8', roof: '#2f3b4a', roofStyle: 'shingle',
    floors: [rows([
      'PPPPPPPPPP',
      'LLLLLLKKKK',
      'LLLLLLKKKK',
      'LLLLHHDDDD',
      'GGGGHHDDDD',
      'GGGGHHAAOO',
    ]), rows([
      '..........',
      'BBBBBBBBBB',
      'BBBBBBBBBB',
      'BBAAHHAABB',
      'BBAAHHAABB',
      'BBBBHHBBBB',
    ])],
    furn: [[F('chairs', 0, 0), F('grill', 8, 0), F('sectional', 0, 1), F('tv', 3, 2), F('rug', 2, 1), F('stove', 6, 1), F('fridge', 9, 1), F('island', 7, 2), F('table', 7, 3),
      F('pool', 0, 4), F('arcade', 3, 5), F('stairs', 4, 4), F('toilet', 6, 5), F('desk', 8, 5)],
    [F('kingbed', 0, 1), F('dresser', 3, 1), F('closet', 0, 4), F('toilet', 2, 3), F('tub', 3, 4), F('shower', 6, 3), F('sink', 7, 4), F('kingbed', 8, 1), F('bed', 9, 5), F('tv', 6, 1)]] },
  // three stories: a big modern place with a rooftop game room
  three: { name: '3-story', wall: '#e8e2d8', roof: '#1a1c22', roofStyle: 'flat',
    floors: [rows([
      'PPPPPPPPPPPP',
      'LLLLLLLKKKKK',
      'LLLLLLLKKKKK',
      'LLLLLLLKKKKK',
      'DDDDHHHAAOOO',
      'DDDDHHHAAOOO',
    ]), rows([
      '............',
      'BBBBBBBBBBBB',
      'BBBBBBBBBBBB',
      'BBBAAHHAABBB',
      'BBBAAHHAABBB',
      'BBBBBHHBBBBB',
    ]), rows([
      '............',
      '............',
      '..GGGGGGGG..',
      '..GGGGGGGG..',
      '..GGGHHGGG..',
      '.....HH.....',
    ])],
    furn: [[F('chairs', 0, 0), F('chairs', 2, 0), F('grill', 11, 0), F('sectional', 0, 1), F('tv', 3, 3), F('rug', 2, 1), F('stove', 7, 1), F('fridge', 11, 1), F('island', 8, 2), F('counter', 11, 3),
      F('table', 0, 4), F('stairs', 5, 4), F('toilet', 7, 4), F('sink', 8, 5), F('desk', 10, 4), F('safe', 11, 5)],
    [F('kingbed', 0, 1), F('closet', 2, 1), F('toilet', 3, 3), F('tub', 4, 4), F('stairs', 5, 3), F('shower', 7, 3), F('sink', 8, 4), F('kingbed', 10, 1), F('bed', 11, 4), F('dresser', 9, 5)],
    [F('pool', 2, 2), F('bar', 6, 2), F('arcade', 9, 3), F('trophy', 2, 4), F('tv', 4, 4)]] },
};
export const PRESET_IDS = ['starter', 'one', 'two', 'three'];
