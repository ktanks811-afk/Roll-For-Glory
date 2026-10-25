// Character looks: hairstyles, facial hair, eyes, extras and where you came up.
// Drawn by gfx2d/hair.js (portrait) and gfx2d/person.js (top-down).
//
// group: 'black' = coils, waves, braids and locs; 'white' = straight and wavy
// cuts; 'any' = works on anybody. Every style is open to every character.
// td: the top-down shape ('cap' default, 'big', 'none', 'tail', 'long',
// 'locs', 'tall', 'puffs', 'bun', 'mohawk').

export const HAIR_GROUPS = [
  { id: 'black', name: 'Coils, braids & locs' },
  { id: 'white', name: 'Straight & wavy' },
  { id: 'any', name: 'Everybody' },
];

export const HAIRSTYLES = [
  // coils, waves, braids and locs
  { id: 'waves', name: '360 Waves', group: 'black' },
  { id: 'caesar', name: 'Low Caesar', group: 'black' },
  { id: 'taper', name: 'Taper & Sponge Curls', group: 'black' },
  { id: 'curly', name: 'Curly Top', group: 'black' },
  { id: 'short_afro', name: 'Short Fro', group: 'black', td: 'big' },
  { id: 'afro', name: 'Big Afro', group: 'black', td: 'big' },
  { id: 'high_top', name: 'High Top Fade', group: 'black', td: 'tall' },
  { id: 'frohawk', name: 'Frohawk', group: 'black', td: 'mohawk' },
  { id: 'twists', name: 'Two-Strand Twists', group: 'black' },
  { id: 'cornrows', name: 'Cornrows', group: 'black' },
  { id: 'braids_back', name: 'Feed-In Braids', group: 'black', td: 'long' },
  { id: 'box_braids', name: 'Box Braids', group: 'black', td: 'long' },
  { id: 'fulani', name: 'Fulani Braids', group: 'black', td: 'long' },
  { id: 'locs', name: 'Locs', group: 'black', td: 'locs' },
  { id: 'loc_updo', name: 'Locs Tied Up', group: 'black', td: 'bun' },
  { id: 'freeform', name: 'Freeform Dreads', group: 'black', td: 'locs' },
  { id: 'bantu', name: 'Bantu Knots', group: 'black', td: 'puffs' },
  { id: 'puff', name: 'Afro Puff', group: 'black', td: 'bun' },
  { id: 'puffs', name: 'Two Puffs', group: 'black', td: 'puffs' },
  { id: 'silk_press', name: 'Silk Press', group: 'black', td: 'long' },
  // straight and wavy
  { id: 'short', name: 'Short & Neat', group: 'white' },
  { id: 'crew', name: 'Crew Cut', group: 'white' },
  { id: 'side_part', name: 'Side Part', group: 'white' },
  { id: 'slick', name: 'Slicked Back', group: 'white' },
  { id: 'pompadour', name: 'Pompadour', group: 'white', td: 'tall' },
  { id: 'spiky', name: 'Spiky', group: 'white' },
  { id: 'undercut', name: 'Undercut', group: 'white' },
  { id: 'french_crop', name: 'French Crop', group: 'white' },
  { id: 'curtains', name: 'Curtains', group: 'white' },
  { id: 'flow', name: 'Surfer Flow', group: 'white', td: 'long' },
  { id: 'mullet', name: 'Mullet', group: 'white', td: 'long' },
  { id: 'shag', name: 'Shag', group: 'white', td: 'long' },
  { id: 'long', name: 'Long Straight', group: 'white', td: 'long' },
  { id: 'ponytail', name: 'Ponytail', group: 'white', td: 'tail' },
  { id: 'bob', name: 'Bob', group: 'white' },
  { id: 'pixie', name: 'Pixie Cut', group: 'white' },
  { id: 'cowboy', name: 'Cowboy Flow', group: 'white', td: 'long' },
  // everybody
  { id: 'buzz', name: 'Buzz Cut', group: 'any' },
  { id: 'bun', name: 'Top Knot', group: 'any', td: 'bun' },
  { id: 'mohawk', name: 'Mohawk', group: 'any', td: 'mohawk' },
  { id: 'bald', name: 'Bald', group: 'any', td: 'none' },
];
export const HAIR_BY_ID = Object.fromEntries(HAIRSTYLES.map(h => [h.id, h]));

export const FACIAL_HAIR = [
  { id: 'none', name: 'Clean' },
  { id: 'stubble', name: 'Stubble' },
  { id: 'mustache', name: 'Mustache' },
  { id: 'goatee', name: 'Goatee' },
  { id: 'chinstrap', name: 'Chin Strap' },
  { id: 'beard', name: 'Full Beard' },
  { id: 'long_beard', name: 'Long Beard' },
];

export const EYE_COLORS = ['#2a1a10', '#4a2c17', '#6b4a24', '#7a6a2e', '#3f7a4a', '#3d6fa8', '#7d8a94'];

export const BROWS = [
  { id: 'natural', name: 'Natural' },
  { id: 'thick', name: 'Thick' },
  { id: 'thin', name: 'Thin' },
  { id: 'slit', name: 'Eyebrow Slit' },
  { id: 'sleek', name: 'Sleek Arch' },
  { id: 'arched', name: 'High Arch' },
  { id: 'laminated', name: 'Brushed Up' },
];

// small things that ride on the portrait. group sorts them in the creator.
// Only one of each `pick` group at a time (one pendant chain, one choker).
export const EXTRA_GROUPS = [
  { id: 'jewelry', name: 'Chains & grills' },
  { id: 'pierce', name: 'Piercings' },
  { id: 'face', name: 'Face' },
];
export const EXTRAS = [
  { id: 'chain', name: 'Gold Chain', group: 'jewelry', pick: 'pendant' },
  { id: 'plat_chain', name: 'Platinum Chain', group: 'jewelry', pick: 'pendant' },
  { id: 'cuban', name: 'Cuban Link', group: 'jewelry', pick: 'choker' },
  { id: 'plat_cuban', name: 'Platinum Cuban', group: 'jewelry', pick: 'choker' },
  { id: 'plat_rope', name: 'Platinum Rope', group: 'jewelry', pick: 'rope' },
  { id: 'tennis', name: 'Iced Tennis Chain', group: 'jewelry', pick: 'rope' },
  { id: 'grill', name: 'Gold Grill', group: 'jewelry', pick: 'grill' },
  { id: 'plat_grill', name: 'Platinum Grill', group: 'jewelry', pick: 'grill' },
  { id: 'studs', name: 'Diamond Studs', group: 'pierce' },
  { id: 'nose_stud', name: 'Nose Stud', group: 'pierce' },
  { id: 'nose_ring', name: 'Nose Ring', group: 'pierce' },
  { id: 'septum', name: 'Septum Ring', group: 'pierce' },
  { id: 'brow_ring', name: 'Eyebrow Ring', group: 'pierce' },
  { id: 'lip_ring', name: 'Lip Ring', group: 'pierce' },
  { id: 'shades', name: 'Shades', group: 'face', pick: 'eyes' },
  { id: 'glasses', name: 'Glasses', group: 'face', pick: 'eyes' },
  { id: 'teardrop', name: 'Teardrop Tat', group: 'face' },
  { id: 'neck_tat', name: 'Neck Tat', group: 'face' },
  { id: 'freckles', name: 'Freckles', group: 'face' },
  { id: 'durag', name: 'Durag', group: 'face' },
];
export const EXTRA_BY_ID = Object.fromEntries(EXTRAS.map(e => [e.id, e]));
// platinum pieces draw in white metal, the rest in gold
export const PLATINUM = new Set(['plat_chain', 'plat_cuban', 'plat_rope', 'tennis', 'plat_grill']);

// Ink. look.tats is a list of these; 'full' covers everything below the
// neck. Each piece only shows where skin does: a wife beater shows both
// sleeves and the top of a chest piece, a tee only the forearms.
export const TATTOOS = [
  { id: 'sleeve_r', name: 'Right Sleeve' },
  { id: 'sleeve_l', name: 'Left Sleeve' },
  { id: 'half_r', name: 'Right Half Sleeve' },
  { id: 'half_l', name: 'Left Half Sleeve' },
  { id: 'hands', name: 'Hand Tats' },
  { id: 'chest', name: 'Chest Piece' },
  { id: 'stomach', name: 'Stomach Script' },
  { id: 'back', name: 'Back Piece' },
  { id: 'legs', name: 'Leg Sleeves' },
  { id: 'neck', name: 'Throat Piece' },
  { id: 'face', name: 'Face Tats' },
  { id: 'full', name: 'Full Body' },
];
export const INKS = [
  { id: 'bw', name: 'Black & Grey' },
  { id: 'color', name: 'Color' },
];
// 'full' gives every body piece (not the face)
export function hasTat(look, id) {
  const t = look?.tats;
  return Array.isArray(t) && (t.includes(id) || (id !== 'face' && t.includes('full')) || (id === 'half_r' && t.includes('sleeve_r')) || (id === 'half_l' && t.includes('sleeve_l')));
}

// Made-up brands (no real trademarks). logo is how gfx2d/brand.js draws it.
export const BRANDS = {
  vortex: { name: 'Vortex', logo: 'vee' },
  ascend: { name: 'Ascend', logo: 'wing' },
  kronos: { name: 'Kronos', logo: 'bars' },
  offlane: { name: 'Off Lane', logo: 'diag' },
  maison: { name: 'Maison Noir', logo: 'mono' },
  royale: { name: 'Royale', logo: 'crown' },
  glitch: { name: 'Glitch Gang', logo: 'glitch' },
  mws: { name: 'Murda Worth Supply', logo: 'star' },
};

// Where you came up. A small head start, different for each.
export const ORIGINS = [
  { id: 'fresh', name: 'Fresh Start', blurb: 'New in town with a clean slate. $4,500 cash.', apply: () => {} },
  { id: 'stopsix', name: 'Stop Six Raised', blurb: 'The east side knows your name. +60 REP, +80 followers.', apply: s => { s.rep += 60; s.followers += 80; } },
  { id: 'hustler', name: 'Hustler', blurb: 'Came up with a little paper. +$2,500 cash, but $2,000 of it is dirty.', apply: s => { s.cash += 2500; s.dirty = (s.dirty || 0) + 2000; } },
  { id: 'working', name: 'Working Man', blurb: 'Years on the line at the plant. +$4,000 clean in the bank.', apply: s => { s.bank += 4000; } },
  { id: 'influencer', name: 'Influencer', blurb: 'Big following, small wallet. +900 followers, $1,500 less cash.', apply: s => { s.followers += 900; s.cash -= 1500; } },
  { id: 'gearhead', name: 'Gearhead', blurb: 'Grew up under a hood on the Northside. +40 REP, +$1,000 cash.', apply: s => { s.rep += 40; s.cash += 1000; } },
];
export const ORIGIN_BY_ID = Object.fromEntries(ORIGINS.map(o => [o.id, o]));
