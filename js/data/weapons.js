// Weapons for the life-sim side of the game: every Glock model ever sold (by
// generation), AR pistols, a few melee weapons and ammo. Numbers are game
// stats (damage, rate, spread, price), not engineering data.
//
// Glock row: [model, label, caliber, magazine, MSRP, firstYear, size, gens, notes]

export const CAL = {
  '9mm':     { dmg: 22, per: 0.42, range: 38 },
  '.40 S&W': { dmg: 27, per: 0.58, range: 38 },
  '10mm':    { dmg: 33, per: 0.85, range: 42 },
  '.45 ACP': { dmg: 31, per: 0.72, range: 36 },
  '.380 ACP': { dmg: 17, per: 0.52, range: 28 },
  '.357 SIG': { dmg: 28, per: 0.85, range: 40 },
  '.45 GAP': { dmg: 29, per: 1.05, range: 36 },
  '.22 LR':  { dmg: 9, per: 0.16, range: 30 },
  '5.56':    { dmg: 36, per: 0.75, range: 62 },
  '.300 BLK': { dmg: 38, per: 1.15, range: 60 },
  '7.62x39': { dmg: 40, per: 0.6, range: 60 },
  '5.7x28':  { dmg: 24, per: 1.1, range: 48 },
};

// Handling by frame size: spread (degrees at rest), reload seconds, fire cooldown.
const SIZE = {
  micro:   { spread: 4.6, reload: 1.5, cd: 0.17 },
  sub:     { spread: 3.8, reload: 1.6, cd: 0.16 },
  compact: { spread: 3.0, reload: 1.75, cd: 0.15 },
  full:    { spread: 2.4, reload: 1.9, cd: 0.14 },
  comp:    { spread: 1.8, reload: 1.9, cd: 0.14 },   // long-slide competition guns
  arp:     { spread: 3.4, reload: 2.2, cd: 0.1 },
};

// model, label, caliber, mag, msrp, year, size, generations
const G = [
  ['17', 'Glock 17', '9mm', 17, 599, 1982, 'full', [1, 2, 3, 4, 5]],
  ['17L', 'Glock 17L', '9mm', 17, 760, 1988, 'comp', [0]],
  ['18', 'Glock 18', '9mm', 19, 0, 1986, 'compact', [0], { auto: true, restricted: 4 }],
  ['19', 'Glock 19', '9mm', 15, 559, 1988, 'compact', [3, 4, 5]],
  ['19X', 'Glock 19X', '9mm', 17, 699, 2019, 'compact', [5]],
  ['20', 'Glock 20', '10mm', 15, 699, 1991, 'full', [2, 3, 4]],
  ['21', 'Glock 21', '.45 ACP', 13, 649, 1990, 'full', [2, 3, 4]],
  ['22', 'Glock 22', '.40 S&W', 15, 599, 1990, 'full', [2, 3, 4]],
  ['23', 'Glock 23', '.40 S&W', 13, 569, 1990, 'compact', [2, 3, 4]],
  ['24', 'Glock 24', '.40 S&W', 15, 749, 1994, 'comp', [0]],
  ['25', 'Glock 25', '.380 ACP', 15, 549, 1995, 'compact', [0]],
  ['26', 'Glock 26', '9mm', 10, 539, 1995, 'sub', [3, 4, 5]],
  ['27', 'Glock 27', '.40 S&W', 9, 539, 1995, 'sub', [3, 4]],
  ['28', 'Glock 28', '.380 ACP', 10, 539, 1997, 'sub', [0]],
  ['29', 'Glock 29', '10mm', 10, 639, 1997, 'sub', [3, 4]],
  ['30', 'Glock 30', '.45 ACP', 10, 639, 1997, 'sub', [3, 4]],
  ['30S', 'Glock 30S', '.45 ACP', 10, 639, 2014, 'sub', [0]],
  ['31', 'Glock 31', '.357 SIG', 15, 599, 1998, 'full', [3, 4]],
  ['32', 'Glock 32', '.357 SIG', 13, 569, 1998, 'compact', [3, 4]],
  ['33', 'Glock 33', '.357 SIG', 9, 539, 1998, 'sub', [3, 4]],
  ['34', 'Glock 34', '9mm', 17, 749, 1998, 'comp', [3, 4, 5]],
  ['35', 'Glock 35', '.40 S&W', 15, 749, 1998, 'comp', [3, 4]],
  ['36', 'Glock 36', '.45 ACP', 6, 599, 1999, 'sub', [0]],
  ['37', 'Glock 37', '.45 GAP', 10, 599, 2003, 'full', [3, 4]],
  ['38', 'Glock 38', '.45 GAP', 8, 569, 2005, 'compact', [3]],
  ['39', 'Glock 39', '.45 GAP', 6, 539, 2005, 'sub', [3]],
  ['40', 'Glock 40 MOS', '10mm', 15, 899, 2015, 'comp', [4]],
  ['41', 'Glock 41', '.45 ACP', 13, 749, 2014, 'comp', [4]],
  ['42', 'Glock 42', '.380 ACP', 6, 449, 2014, 'micro', [0]],
  ['43', 'Glock 43', '9mm', 6, 499, 2015, 'micro', [0]],
  ['43X', 'Glock 43X', '9mm', 10, 499, 2019, 'micro', [0]],
  ['44', 'Glock 44', '.22 LR', 10, 379, 2019, 'compact', [0]],
  ['45', 'Glock 45', '9mm', 17, 629, 2020, 'full', [5]],
  ['47', 'Glock 47', '9mm', 17, 649, 2023, 'full', [5]],
  ['48', 'Glock 48', '9mm', 10, 499, 2019, 'micro', [0]],
];

// Later generations hold tighter groups and kick less.
const GEN_ADJ = { 0: 1, 1: 1.1, 2: 1.06, 3: 1, 4: 0.94, 5: 0.88 };
const GEN_YEAR = { 1: 1982, 2: 1988, 3: 1998, 4: 2010, 5: 2017 };   // when each generation arrived

export const GLOCKS = [];
for (const [model, label, cal, mag, msrp, year, size, gens, note = {}] of G) {
  for (const gen of gens) {
    const yr = gen === 0 ? year : Math.max(year, GEN_YEAR[gen]);
    const gk = gen ? ` Gen${gen}` : '';
    const sz = SIZE[size];
    const price = Math.round((msrp || 12000) * (1 + (gen ? (gen - 3) * 0.05 : 0)) / 10) * 10;
    GLOCKS.push({
      id: `glock_${model.toLowerCase()}${gen ? '_g' + gen : ''}`, kind: 'handgun', make: 'Glock', model: `G${model}`, name: `${label}${gk}`, gen, year: yr,
      cal, mag, price, size, spread: +(sz.spread * GEN_ADJ[gen]).toFixed(2), reload: sz.reload, cd: note.auto ? 0.055 : sz.cd, auto: !!note.auto,
      restricted: note.restricted || 0, melee: false, len: size === 'micro' ? 0.38 : size === 'sub' ? 0.42 : size === 'comp' ? 0.52 : 0.48,
    });
  }
}

// AR pistols ("ARPs")
const A = [
  ['ruger_ar556', 'Ruger', 'AR-556 Pistol', '5.56', 30, 749, 2017],
  ['psa_pa15', 'Palmetto State Armory', 'PA-15 Pistol', '5.56', 30, 579, 2015],
  ['dd_mk18', 'Daniel Defense', 'MK18 Pistol', '5.56', 30, 1849, 2019],
  ['bcm_recce11', 'Bravo Company', 'RECCE-11 Pistol', '5.56', 30, 1699, 2018],
  ['sw_mp15', 'Smith & Wesson', 'M&P15 Pistol', '5.56', 30, 899, 2018],
  ['sa_saint', 'Springfield Armory', 'Saint Victor Pistol', '5.56', 30, 1299, 2019],
  ['anderson_am15', 'Anderson', 'AM-15 Pistol', '5.56', 30, 549, 2016],
  ['sig_rattler', 'SIG Sauer', 'MCX Rattler', '.300 BLK', 30, 2399, 2017],
  ['aero_epc9', 'Aero Precision', 'EPC-9 (9mm AR)', '9mm', 32, 1149, 2020],
  ['wilson_ar9', 'Wilson Combat', 'AR9 Pistol', '9mm', 32, 1999, 2019],
  ['bca_762', 'Bear Creek Arsenal', '7.62x39 AR Pistol', '7.62x39', 30, 679, 2020],
  ['cmmg_banshee', 'CMMG', 'Banshee Mk57', '5.7x28', 20, 1649, 2020],
  ['dpms_oracle', 'DPMS', 'Oracle Pistol', '5.56', 30, 679, 2014],
  ['colt_le6920p', 'Colt', 'LE6920 AR Pistol', '5.56', 30, 1399, 2018],
];
export const ARPS = A.map(([id, make, name, cal, mag, price, year]) => ({
  id: `arp_${id}`, kind: 'arp', make, model: name, name: `${make} ${name}`, gen: 0, year, cal, mag, price, size: 'arp',
  spread: cal === '9mm' ? 3.0 : cal === '.300 BLK' ? 3.2 : 3.4, reload: SIZE.arp.reload, cd: SIZE.arp.cd, auto: false, restricted: 0, melee: false, len: 0.72,
}));

export const MELEE = [
  { id: 'bat', kind: 'melee', make: '', model: 'Baseball bat', name: 'Aluminum baseball bat', price: 45, dmg: 22, cd: 0.55, reach: 1.7, melee: true, len: 0.8, minAge: 18 },
  { id: 'crowbar', kind: 'melee', make: '', model: 'Crowbar', name: 'Steel crowbar', price: 28, dmg: 26, cd: 0.6, reach: 1.6, melee: true, len: 0.7, minAge: 18 },
  { id: 'knife', kind: 'melee', make: '', model: 'Combat knife', name: 'Fixed-blade combat knife', price: 70, dmg: 30, cd: 0.4, reach: 1.1, melee: true, len: 0.3, minAge: 18 },
];

export const WEAPONS = [...MELEE, ...GLOCKS, ...ARPS];
export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));

// Ammo is sold by the 50-round box; price follows the caliber.
export const AMMO_BOX = 50;
export const ammoBoxPrice = cal => Math.round(CAL[cal].per * AMMO_BOX * 100) / 100;

export const GEAR = [
  { id: 'vest', name: 'Level IIIA body armor', price: 380, blurb: 'Soaks up damage from a shot (wears out as it takes hits).' },
  { id: 'frt', name: 'Forced-reset trigger (FRT)', price: 380, blurb: 'Install it on any gun you own (My gear) and it fires full-auto while you hold the trigger. Sometimes it jams, sometimes it dumps a burst, and cops treat it as a machine gun. 21+.' },
  { id: 'holster', name: 'Concealed carry holster', price: 60, blurb: 'Keeps your pistol out of sight until you draw it: nobody reacts to a holstered gun.' },
];

// Federal-style age gates: handguns (and AR pistols, which count as handguns) 21+.
export const minAge = w => w.minAge ?? 21;

// Player's arms locker.
export function ensureArms(s) {
  s.arms ??= { guns: [], ammo: {}, equipped: null, armor: 0, holster: false, cooldown: {}, robberies: 0, hp: 100, frtKits: 0 };
  const a = s.arms;
  a.frtKits ??= 0; a.guns ??= []; a.ammo ??= {}; a.cooldown ??= {}; a.robberies ??= 0; a.hp ??= 100; a.armor ??= 0;
  return a;
}
export const frtKits = s => ensureArms(s).frtKits || 0;

// FRT fits any firearm (Glocks and AR pistols); melee has no trigger and the
// Glock 18 is already full-auto.
export const canFrt = def => !!def && !def.melee && !def.auto;

// Install or pull the FRT on one of the player's guns. Returns { ok, text }.
export function toggleFrt(s, uid) {
  const a = ensureArms(s), g = a.guns.find(x => x.uid === uid), def = g && WEAPON_BY_ID[g.id];
  if (!g) return { ok: false, text: 'That gun is gone.' };
  if (g.frt) { g.frt = false; a.frtKits = (a.frtKits || 0) + 1; return { ok: true, text: `FRT removed from the ${def.name}. Back to semi-auto.` }; }
  if (!canFrt(def)) return { ok: false, text: def.melee ? 'No trigger on that.' : 'Already full-auto.' };
  if (!(a.frtKits > 0)) return { ok: false, text: 'No FRT kit. Buy one under Gear.' };
  g.frt = true; a.frtKits--;
  return { ok: true, text: `FRT dropped in the ${def.name}. Hold the trigger… and pray it doesn't jam.` };
}
export const equippedGun = s => { const a = ensureArms(s); return a.guns.find(g => g.uid === a.equipped) || null; };

let n = 0;
export function giveWeapon(s, id, loaded = true) {
  const a = ensureArms(s), def = WEAPON_BY_ID[id];
  const g = { uid: `w${Date.now().toString(36)}${n++}`, id, loaded: 0 };
  if (!def.melee && loaded) { const put = Math.min(def.mag, a.ammo[def.cal] || 0); g.loaded = put; a.ammo[def.cal] = (a.ammo[def.cal] || 0) - put; }
  a.guns.push(g);
  if (!a.equipped) a.equipped = g.uid;
  return g;
}

// Buy something. Returns { ok, text }.
export function buyWeapon(s, id, rep, spend) {
  const def = WEAPON_BY_ID[id];
  if (!def) return { ok: false, text: 'Unknown item.' };
  if (s.player.age < minAge(def)) return { ok: false, text: `You have to be ${minAge(def)} to buy that. ID check failed.` };
  if (def.restricted && rep < def.restricted) return { ok: false, text: 'Restricted. Not sold online — you need real street connections.' };
  if (!spend(s, def.price, def.name)) return { ok: false, text: `Not enough money — ${def.name} is $${def.price.toLocaleString('en-US')}.` };
  const g = giveWeapon(s, id, true);
  return { ok: true, text: `${def.name} delivered to your mailbox.${!def.melee && g.loaded ? ` Loaded with ${g.loaded}.` : ''}` };
}

export function buyAmmo(s, cal, boxes, spend) {
  const a = ensureArms(s);
  if (s.player.age < 21 && ['9mm', '.40 S&W', '10mm', '.45 ACP', '.380 ACP', '.357 SIG', '.45 GAP', '5.7x28'].includes(cal)) return { ok: false, text: 'Handgun ammo is 21+.' };
  const price = ammoBoxPrice(cal) * boxes;
  if (!spend(s, price, `${boxes}× ${cal} ammo`)) return { ok: false, text: 'Not enough money.' };
  a.ammo[cal] = (a.ammo[cal] || 0) + AMMO_BOX * boxes;
  return { ok: true, text: `${boxes * AMMO_BOX} rounds of ${cal} delivered.` };
}
