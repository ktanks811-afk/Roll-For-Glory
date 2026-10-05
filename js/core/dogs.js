// Your dogs: the kennel, coat genetics, breeding, training, the vet and the
// dog market at Cross Timbers Hog Dogs. Ported from Hogs & Dogs, so a dog has
// the same genes (10 loci), potentials, temperament and coat as it would
// there, and a litter inherits the same way.
//
// Dogs live at a place you own (s.kennel.dogs[i].home): ranch land, a lot, a
// house, or two at the apartment. Feed comes out of the bank every morning.
// DOM-free so check-data can test it.

import { spend, earn, earnBank, fmtMoney, tierOf } from './state.js';
import { PROPERTIES, LOC_BY_ID, COUNTRY } from '../data/world.js';
import { LAND } from '../data/estate.js';
import { STATS, TEMPS, LOCI, DEFAULT_FREQ, BREEDS, BREED_NAMES, CALL_M, CALL_F, SECOND_M, SECOND_F, HANDLE_M, HANDLE_F,
  DOG_ROOM, FEED_PER_DOG, VET_VISIT, VEST_PRICE, COLLAR_PRICE, LITTER_DAYS, DAM_REST } from '../data/dogs.js';
import { Coat } from '../gfx2d/dogCoat.js';

const R = Math.random;
const ri = (a, b) => Math.floor(R() * (b - a + 1)) + a;
const pick = a => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const avg = a => a.reduce((t, x) => t + x, 0) / a.length;
const r1 = n => Math.round(n * 10) / 10;
const q2 = n => Math.round(n * 100) / 100;
function gauss() { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const err = text => ({ ok: false, text });
export const ageStr = m => m < 12 ? `${m} mo` : `${Math.floor(m / 12)} yr${m % 12 ? ` ${m % 12} mo` : ''}`;
export const isAdult = d => d.age >= 12;
export const breedName = d => d.cross || d.breed;
export const short = b => BREEDS[b]?.short || b;

// ---------------------------------------------------------------- the kennel
export function ensureKennel(s) {
  const k = s.kennel ??= { dogs: [], nextId: 1, market: [], marketDay: 0, preg: [], names: [], vests: {}, collar: false, st: { hogs: 0, best: 0, bestName: '', hunts: 0, litters: 0, pups: 0, earned: 0 } };
  k.st ??= { hogs: 0, best: 0, bestName: '', hunts: 0, litters: 0, pups: 0, earned: 0 };
  k.vests ??= {};
  // older saves: "Dog" was a head count on the ranch screen. Each one becomes
  // a real dog of a real breed, living on that land.
  for (const [id, l] of Object.entries(s.estate?.land || {})) {
    const n = l?.animals?.dog;
    if (!n) continue;
    delete l.animals.dog;
    for (let i = 0; i < n; i++) k.dogs.push(makeDog(s, { breed: pick(['Black Mouth Cur', 'American Pit Bull Terrier', 'Catahoula Leopard Dog', 'German Rottweiler', 'Labrador Retriever']), age: ri(14, 40), home: id }));
  }
  return k;
}
export const dogsOf = s => ensureKennel(s).dogs;
export const dogById = (s, id) => dogsOf(s).find(d => d.id === id) || ensureKennel(s).market.find(d => d.id === id) || null;

// Every place you own that can keep dogs: [{ id, name, room, kind }]
export function dogHomes(s) {
  const out = [];
  for (const [id, l] of Object.entries(s.estate?.land || {})) {
    if (!l?.owned || !LAND[id]) continue;
    const loc = LOC_BY_ID[id], country = loc && loc.z > COUNTRY.z0;
    out.push({ id, name: PROPERTIES[id]?.name || LAND[id].name, room: country ? DOG_ROOM.country : DOG_ROOM.land, kind: country ? 'Ranch' : 'Lot' });
  }
  for (const id of s.properties || []) {
    const p = PROPERTIES[id];
    if (!p || p.trap || p.land) continue;
    out.push({ id, name: p.name, room: p.house ? DOG_ROOM.house : DOG_ROOM.apartment, kind: p.house ? 'House' : 'Apartment' });
  }
  return out.sort((a, b) => b.room - a.room);
}
export const dogsAt = (s, home) => dogsOf(s).filter(d => d.home === home);
export const roomAt = (s, home) => { const h = dogHomes(s).find(x => x.id === home); return h ? h.room - dogsAt(s, home).length : 0; };
export const totalRoom = s => dogHomes(s).reduce((t, h) => t + h.room, 0);
// the best place with room: where you are now if it has room, else the biggest
export function freeHome(s, prefer = null) {
  if (prefer && roomAt(s, prefer) > 0) return prefer;
  return dogHomes(s).find(h => roomAt(s, h.id) > 0)?.id || null;
}
export const homeName = (s, id) => dogHomes(s).find(h => h.id === id)?.name || PROPERTIES[id]?.name || LAND[id]?.name || 'Nowhere';
// a dog whose home was sold moves to wherever there's room
function rehome(s) {
  const homes = new Set(dogHomes(s).map(h => h.id));
  for (const d of dogsOf(s)) if (!homes.has(d.home)) d.home = freeHome(s) || dogHomes(s)[0]?.id || 'eastgate_studio';
}

// ---------------------------------------------------------------- names
const nameKey = n => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
function takenNames(s) {
  const k = ensureKennel(s), t = new Set(k.names);
  for (const d of [...k.dogs, ...k.market]) t.add(nameKey(d.name));
  return t;
}
export function makeName(s, sex) {
  const f = sex === 'F', call = f ? CALL_F : CALL_M, sec = f ? SECOND_F : SECOND_M, hand = f ? HANDLE_F : HANDLE_M, taken = takenNames(s);
  for (let i = 0; i < 60; i++) {
    const r = R(), c = pick(call);
    let n = r < 0.4 ? c : r < 0.78 ? `${c} ${pick(sec)}` : r < 0.92 ? `${pick(hand)} ${c}` : `${pick(hand)} ${c} ${pick(sec)}`;
    if (i > 30) n += ' ' + pick(['II', 'III', 'IV', 'Jr.']);
    if (n.length <= 22 && !taken.has(nameKey(n))) { remember(s, n); return n; }
  }
  let k = 2; const base = pick(call);
  while (taken.has(nameKey(`${base} ${k}`))) k++;
  remember(s, `${base} ${k}`); return `${base} ${k}`;
}
function remember(s, n) { const L = ensureKennel(s).names; L.push(nameKey(n)); if (L.length > 4000) L.splice(0, L.length - 4000); }
export function renameDog(s, id, name) {
  const d = dogsOf(s).find(x => x.id === id), n = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 22);
  if (!d) return err('No such dog.');
  if (n.length < 2) return err('Give the dog a real name.');
  const t = takenNames(s); t.delete(nameKey(d.name));
  if (t.has(nameKey(n))) return err('Another dog already has that name.');
  d.name = n; remember(s, n);
  return { ok: true, text: `Renamed ${n}.` };
}

// ---------------------------------------------------------------- genetics
export const has = (g, L, a) => g[L].includes(a), homo = (g, L, a) => g[L][0] === a && g[L][1] === a;
export function sortPair(L, p) { const o = LOCI[L].alleles; return p.slice().sort((a, b) => o.indexOf(a) - o.indexOf(b)); }
function sampleAllele(f) { let r = R(), acc = 0; for (const [a, p] of Object.entries(f)) { acc += p; if (r < acc) return a; } return Object.keys(f).find(k => f[k] > 0) || Object.keys(f)[0]; }
export function genesFor(b, rare = false) {
  const g = {};
  for (const L in LOCI) { const f = { ...DEFAULT_FREQ[L], ...((b.freq || {})[L] || {}) }; g[L] = sortPair(L, [sampleAllele(f), sampleAllele(f)]); }
  if (rare) {
    const never = (L, a) => ((b.freq || {})[L] || {})[a] === 0;
    const opts = [['D', ['d', 'd']], ['B', ['b', 'b']], ['M', ['M', 'm']], ['K', ['br', 'br']]].filter(([L, p]) => !never(L, p[0]));
    for (let i = 0, n = ri(1, 2); i < n && opts.length; i++) { const [L, p] = pick(opts); g[L] = sortPair(L, p); }
  }
  return g;
}
export function inheritLocus(L, a, b) {
  let x = pick(a.genes[L]), y = pick(b.genes[L]), mut = false;
  if (R() < 0.015) { const n = pick(LOCI[L].alleles); if (!a.genes[L].includes(n) && !b.genes[L].includes(n)) mut = true; x = n; }
  return { pair: sortPair(L, [x, y]), mut };
}
export const genoText = (d, L, sep = '/') => (d.genes[L] || []).join(sep);

// the colour of the coat for the map and the hunt: the base, the dark (eumelanin) and white
const EU_HEX = { Black: '#1f1c1a', Blue: '#5d6874', Liver: '#6b3a24', Lilac: '#9a8a90' };
const MERLE_LIGHT = { Black: '#8f98a1', Blue: '#aab3bb', Liver: '#c2896a', Lilac: '#cbbfc3' };
const PH_HEX = { Yellow: '#d7a456', Red: '#a4512a', Cream: '#ead6ad', Fawn: '#c7975f' };
export function phenotype(g) {
  const brown = homo(g, 'B', 'b'), dil = homo(g, 'D', 'd');
  const eu = brown ? (dil ? 'Lilac' : 'Liver') : (dil ? 'Blue' : 'Black');
  let base, pat = 'solid', merle = 0, white = 'none';
  const red = homo(g, 'E', 'e');
  if (red) base = brown ? (dil ? 'Fawn' : 'Red') : (dil ? 'Cream' : 'Yellow');
  else if (has(g, 'K', 'K')) base = eu;
  else if (has(g, 'K', 'br')) { base = 'Fawn'; pat = 'brindle'; }
  else { base = 'Fawn'; pat = has(g, 'A', 'at') && !has(g, 'A', 'ay') ? 'tan' : 'masked'; }
  if (!red && has(g, 'M', 'M')) merle = homo(g, 'M', 'M') ? 2 : 1;
  if (merle === 2) white = 'heavy';
  else if (homo(g, 'S', 'sw')) white = 'extreme';
  else if (!has(g, 'S', 'S')) white = 'piebald';
  else if (g.S[1] !== 'S') white = 'flash';
  const baseHex = merle ? MERLE_LIGHT[eu] : pat === 'tan' ? EU_HEX[eu] : (red || pat !== 'solid') ? PH_HEX[base] : EU_HEX[eu];
  return { eu, euHex: EU_HEX[eu], baseHex, pat, merle, white, red, white2: '#f2eee6' };
}

// the coat engine (gfx2d/dogCoat.js) names and rates the coat
for (const b of BREED_NAMES) if (!Coat.TEMPLATES[b]) Coat.TEMPLATES[b] = { code: b.split(/\s+/).map(w => w[0]).join('').toUpperCase() + 'G' };
export const dogMods = d => ({ whiteMod: d.whiteMod || 0, patMod: d.patMod ?? 0.5, coatInt: d.coatInt ?? 0.5, eyes: d.eyes || 'Auto', eyes2: d.eyes2 || d.eyes || 'Auto', merleMod: d.merleMod ?? 0.5, tickMod: d.tickMod ?? 0.5, speckMod: d.speckMod || 0, featherMod: d.featherMod ?? 0.3, featherDen: d.featherDen ?? 0.5, texture: d.texture || 0, seed: d.seed || 1 });
// a cross wears the build (silhouette) of one parent's breed
export function coatBreed(d) {
  if (d.breed !== 'Cross') return d.breed;
  const mix = `Mix (${d.build} build)`;
  return Coat.TEMPLATES[mix] ? mix : d.build || 'Black Mountain Cur';
}
const COATS = new Map();
export function coatSpec(d) {
  const key = coatBreed(d) + '|' + Object.keys(LOCI).map(L => (d.genes[L] || []).join('')).join('.') + '|' + Object.values(dogMods(d)).join(',');
  let c = COATS.get(key);
  if (!c) { c = Coat.fromGenotype(d.genes, dogMods(d), coatBreed(d)); if (COATS.size > 3000) COATS.clear(); COATS.set(key, c); }
  return c;
}
export const coatName = d => Coat.describe(coatSpec(d));
export const coatRar = d => Coat.rarity(coatSpec(d));
export const coatKey = d => coatBreed(d) + '|' + Object.keys(LOCI).map(L => (d.genes[L] || []).join('')).join('.') + '|' + Object.values(dogMods(d)).join(',');

// ---------------------------------------------------------------- making dogs
const newId = s => 'DOG-' + String(ensureKennel(s).nextId++).padStart(6, '0');
export const growFactor = age => age < 12 ? 0.3 + age / 12 * 0.2 : 0.5 + Math.min(age, 36) / 36 * 0.15;
function geneHealth(d) { if (homo(d.genes, 'M', 'M')) { d.hcap = 80; d.health = Math.min(d.health, 80); } }
function featherOf(breed) { const m = Coat.TEMPLATES[breed]?.mods; return m ? { featherMod: q2(clamp(m.featherMod + gauss() * 0.06, 0, 1)), featherDen: m.featherDen, texture: m.texture } : { featherMod: 0.3, featherDen: 0.5, texture: 0 }; }

export function makeDog(s, o) {
  const b = BREEDS[o.breed], pot = {};
  STATS.forEach(([k], i) => {
    const rg = b.range && b.range[i];
    const v = rg ? clamp(b.pot[i] + gauss() * (rg[1] - rg[0]) / 4, rg[0], rg[1]) : b.pot[i] + gauss() * 7;
    pot[k] = clamp(Math.round(v + (o.boost || 0)), 20, 99);
  });
  const age = o.age ?? ri(8, 40), sex = o.sex || pick(['M', 'F']);
  const d = {
    id: newId(s), name: o.name || '', breed: o.breed, cross: null, build: o.breed, sex, age, genes: genesFor(b, o.rare), pot, stats: {},
    kg: r1(b.kg[0] + R() * (b.kg[1] - b.kg[0])), temp: pick(TEMPS), health: 100, hcap: 100, energy: 100,
    hunt: { n: 0, bays: 0, catches: 0, hogs: 0, xp: 0 }, parents: null, gen: 0, base: b.price, mut: !!o.mut, cool: 0, trainedDay: 0,
    whiteMod: q2(clamp((R() - 0.5) * 0.3 + (b.whiteBias || 0), -0.4, 0.4)), patMod: q2(R()), coatInt: q2(b.coatInt ? b.coatInt[0] + R() * (b.coatInt[1] - b.coatInt[0]) : 0.3 + R() * 0.4),
    eyes: 'Auto', eyes2: 'Auto', merleMod: q2(0.2 + R() * 0.6), tickMod: q2(0.3 + R() * 0.4), speckMod: R() < (b.speck ?? 0.2) ? q2(R() * 0.7) : 0,
    ...featherOf(o.breed), seed: ri(1, 2 ** 30), home: o.home || null,
  };
  if (!d.name) d.name = makeName(s, sex);
  const gf = growFactor(age);
  STATS.forEach(([k]) => d.stats[k] = Math.min(pot[k], Math.round(pot[k] * gf * (0.9 + R() * 0.15))));
  if (b.health) d.vigor = ri(b.health[0], b.health[1]);
  if (b.noPiebald && d.genes.S[0] === 'sp' && d.genes.S[1] === 'sp') d.genes.S = ['S', 'sp'];
  geneHealth(d);
  return d;
}

const snap = d => ({ id: d.id, name: d.name, breed: breedName(d), coat: coatName(d) });
export function crossName(a, b) {
  const x = a.cross ? null : short(a.breed), y = b.cross ? null : short(b.breed);
  if (!x || !y) return 'Hog dog mix';
  if (x === y) return `${x} mix`;
  const c = [x, y].sort(); return `${c[0]} × ${c[1]}`;
}
export function makePuppy(s, sire, dam) {
  const same = sire.breed === dam.breed && !sire.cross && !dam.cross && sire.breed !== 'Cross';
  const genes = {}; let mut = false;
  for (const L in LOCI) { const r = inheritLocus(L, sire, dam); genes[L] = r.pair; if (r.mut) mut = true; }
  const pot = {};
  STATS.forEach(([k]) => pot[k] = clamp(Math.round((sire.pot[k] + dam.pot[k]) / 2 + gauss() * 6 + (same ? 0 : 1.5)), 15, 99));
  if (R() < 0.03) { const k = pick(STATS)[0]; pot[k] = clamp(pot[k] + 10, 0, 99); mut = true; }
  const inh = (k, def, sd) => q2(clamp(((sire[k] ?? def) + (dam[k] ?? def)) / 2 + gauss() * sd, 0, 1));
  const sex = pick(['M', 'F']);
  const d = {
    id: newId(s), name: '', breed: same ? sire.breed : 'Cross', cross: same ? null : crossName(sire, dam), build: pick([sire.build || sire.breed, dam.build || dam.breed]),
    sex, age: 0, genes, pot, stats: {}, kg: r1(clamp((sire.kg + dam.kg) / 2 + gauss() * 2.5, 9, 62)),
    temp: R() < 0.7 ? pick([sire.temp, dam.temp]) : pick(TEMPS), health: 100, hcap: 100, energy: 100,
    hunt: { n: 0, bays: 0, catches: 0, hogs: 0, xp: 0 }, parents: [snap(sire), snap(dam)], gen: Math.max(sire.gen || 0, dam.gen || 0) + 1,
    base: Math.round((sire.base + dam.base) / 2), mut, cool: 0, trainedDay: 0,
    whiteMod: q2(clamp(((sire.whiteMod || 0) + (dam.whiteMod || 0)) / 2 + gauss() * 0.05, -0.4, 0.4)), patMod: inh('patMod', 0.5, 0.1), coatInt: inh('coatInt', 0.5, 0.06),
    eyes: 'Auto', eyes2: 'Auto', merleMod: inh('merleMod', 0.5, 0.08), tickMod: inh('tickMod', 0.5, 0.08), speckMod: (sire.speckMod || dam.speckMod) ? inh('speckMod', 0, 0.08) : 0,
    featherMod: inh('featherMod', 0.3, 0.06), featherDen: inh('featherDen', 0.5, 0.05), texture: inh('texture', 0, 0.05), seed: ri(1, 2 ** 30), home: dam.home,
  };
  if (R() < 0.5) { const p = pick([sire, dam]); d.eyes = p.eyes || 'Auto'; d.eyes2 = p.eyes2 || d.eyes; }
  d.name = makeName(s, sex);
  STATS.forEach(([k]) => d.stats[k] = Math.round(pot[k] * 0.3));
  geneHealth(d);
  return d;
}

// What a litter from these two could look like: coat odds from 400 rolls.
export function predictCoats(a, b, n = 400) {
  const out = {};
  for (let i = 0; i < n; i++) {
    const g = {}; for (const L in LOCI) g[L] = sortPair(L, [pick(a.genes[L]), pick(b.genes[L])]);
    const fake = { breed: a.breed === b.breed && !a.cross && !b.cross ? a.breed : 'Cross', build: a.build || a.breed, genes: g,
      whiteMod: ((a.whiteMod || 0) + (b.whiteMod || 0)) / 2, patMod: ((a.patMod ?? 0.5) + (b.patMod ?? 0.5)) / 2, coatInt: ((a.coatInt ?? 0.5) + (b.coatInt ?? 0.5)) / 2, seed: a.seed };
    const c = coatSpec(fake), nm = Coat.describe(c);
    (out[nm] ??= { n: nm, p: 0, rar: Coat.rarity(c) }).p += 1 / n;
  }
  return Object.values(out).sort((x, y) => y.p - x.p);
}

// ---------------------------------------------------------------- scores + value
export const bayScore = d => { const s = d.stats; return s.trk * 0.4 + s.sta * 0.3 + s.int * 0.2 + s.spd * 0.1; };
export const catchScore = d => { const s = d.stats; return s.str * 0.4 + s.grip * 0.4 + s.spd * 0.2 + (d.temp === 'Gritty' ? 5 : 0); };
export const roleOf = d => bayScore(d) >= catchScore(d) ? 'bay' : 'catch';
export function rarPts(d) { const ap = avg(Object.values(d.pot)); return coatRar(d) + (ap >= 82 ? 2 : ap >= 72 ? 1 : 0) + (d.mut ? 2 : 0); }
export function rarTier(d) { const p = rarPts(d); return p >= 7 ? 4 : p >= 5 ? 3 : p >= 3 ? 2 : p >= 2 ? 1 : 0; }
export function dogValue(d) {
  const ap = avg(Object.values(d.pot)), ac = avg(Object.values(d.stats));
  let v = d.base * (0.45 + Math.pow(ap / 70, 3) * 0.7 + Math.pow(ac / 60, 2) * 0.4) * (1 + rarPts(d) * 0.16);
  v *= d.age < 6 ? 0.75 : d.age < 12 ? 0.9 : d.age > 96 ? 0.45 : d.age > 84 ? 0.65 : 1;
  v *= 1 + Math.min(0.3, (d.gen || 0) * 0.05);
  v *= 0.5 + d.health / 200;
  v += d.hunt.catches * 60 + d.hunt.bays * 35 + d.hunt.hogs * 20;
  return Math.max(120, Math.round(v / 5) * 5);
}
export const SELL_RATE = 0.8;

// ---------------------------------------------------------------- the dog market
export function refreshMarket(s, force = false) {
  const k = ensureKennel(s);
  if (!force && k.marketDay === s.time.day && k.market.length) return k.market;
  k.market = [];
  for (let i = 0; i < 10; i++) {
    let d;
    for (let t = 0; t < 20; t++) { d = makeDog(s, { breed: pick(BREED_NAMES), age: ri(3, 48) }); if (rarTier(d) < 4) break; }
    d.price = Math.round(dogValue(d) * (1.05 + R() * 0.3) / 5) * 5;
    k.market.push(d);
  }
  for (let i = 0; i < 3; i++) {
    let d;
    for (let t = 0; t < 20; t++) { d = makeDog(s, { breed: pick(BREED_NAMES), age: ri(12, 30), boost: ri(6, 12), rare: true, mut: R() < 0.25 }); if (rarTier(d) < 4) break; }
    d.price = Math.round(dogValue(d) * 1.25 / 5) * 5; d.featured = true;
    k.market.push(d);
  }
  k.marketDay = s.time.day;
  return k.market;
}
export function buyDog(s, id, home = null) {
  const k = ensureKennel(s), d = k.market.find(x => x.id === id);
  if (!d) return err('That dog already went home with somebody.');
  const to = freeHome(s, home);
  if (!to) return err(dogHomes(s).length ? 'No room for another dog. Buy land or a house, or sell one.' : 'You need somewhere to keep a dog.');
  if (!spend(s, d.price, `Cross Timbers Hog Dogs: ${d.name} (${breedName(d)})`)) return err('Not enough money.');
  k.market = k.market.filter(x => x !== d);
  delete d.price; delete d.featured; d.home = to;
  k.dogs.push(d);
  return { ok: true, text: `${d.name} is yours. ${d.sex === 'F' ? 'She' : 'He'} rides home to ${homeName(s, to)}.`, dog: d };
}
export function sellDog(s, id) {
  const k = ensureKennel(s), d = k.dogs.find(x => x.id === id);
  if (!d) return err('No such dog.');
  if (k.preg.some(p => p.dam === id)) return err('She\'s carrying a litter. Wait for the pups.');
  const v = Math.round(dogValue(d) * SELL_RATE);
  k.dogs = k.dogs.filter(x => x !== d);
  delete k.vests[id];
  earn(s, v, `Sold ${d.name} (${breedName(d)})`);
  return { ok: true, text: `${d.name} sold for ${fmtMoney(v)}.`, value: v };
}
export function moveDog(s, id, home) {
  const d = dogsOf(s).find(x => x.id === id);
  if (!d) return err('No such dog.');
  if (d.home === home) return err(`${d.name} already lives there.`);
  if (roomAt(s, home) <= 0) return err('No room there.');
  d.home = home;
  return { ok: true, text: `${d.name} moved to ${homeName(s, home)}.` };
}

// ---------------------------------------------------------------- care + training
export function trainGain(d, k) {
  const gap = d.pot[k] - d.stats[k];
  if (gap <= 0) return 0;
  let g = (gap * 0.16 + 1.2) * (0.8 + d.stats.int / 250);
  if (d.temp === 'Eager') g *= 1.2;
  if (d.temp === 'Stubborn') g *= 0.8;
  return Math.max(1, Math.min(gap, Math.round(g)));
}
export const trainedToday = (s, d) => d.trainedDay === s.time.day;
export function trainDog(s, id, k) {
  const d = dogsOf(s).find(x => x.id === id);
  if (!d) return err('No such dog.');
  if (!isAdult(d) && d.age < 6) return err(`${d.name} is too young. Start at 6 months.`);
  if (trainedToday(s, d)) return err(`${d.name} already worked today. Tomorrow.`);
  if (d.energy < 30) return err(`${d.name} is worn out.`);
  const g = trainGain(d, k);
  if (!g) return err(`${d.name} is as good at that as ${d.sex === 'F' ? 'she' : 'he'}'ll get.`);
  d.stats[k] += g; d.energy -= 30; d.trainedDay = s.time.day;
  return { ok: true, text: `${d.name}: +${g} ${STATS.find(x => x[0] === k)[1].toLowerCase()}.`, gain: g };
}
export function vet(s, id) {
  const d = dogsOf(s).find(x => x.id === id);
  if (!d) return err('No such dog.');
  if (d.health >= d.hcap) return err(`${d.name} is healthy.`);
  if (!spend(s, VET_VISIT, `Joshua Animal Clinic: ${d.name}`)) return err('Not enough money.');
  d.health = d.hcap;
  return { ok: true, text: `Doc stitched ${d.name} up. Good as new.` };
}
export function buyVest(s, id) {
  const k = ensureKennel(s), d = k.dogs.find(x => x.id === id);
  if (!d) return err('No such dog.');
  if (k.vests[id]) return err(`${d.name} already has a cut vest.`);
  if (!spend(s, VEST_PRICE, `Cut vest for ${d.name}`)) return err('Not enough money.');
  k.vests[id] = true;
  return { ok: true, text: `${d.name} has a Kevlar cut vest now. Tusks cut a lot less.` };
}
export function buyCollar(s) {
  const k = ensureKennel(s);
  if (k.collar) return err('You already run tracking collars.');
  if (!spend(s, COLLAR_PRICE, 'GPS tracking collars')) return err('Not enough money.');
  k.collar = true;
  return { ok: true, text: 'Tracking collars on every dog. You\'ll see where they are on the hunt.' };
}

// ---------------------------------------------------------------- breeding
export const canSire = d => d.sex === 'M' && isAdult(d) && d.health >= 40;
export const canDam = (s, d) => d.sex === 'F' && isAdult(d) && d.health >= 40 && !(d.cool > 0) && !ensureKennel(s).preg.some(p => p.dam === d.id);
export function breed(s, sireId, damId) {
  const k = ensureKennel(s), sire = k.dogs.find(d => d.id === sireId), dam = k.dogs.find(d => d.id === damId);
  if (!sire || !dam) return err('Pick a sire and a dam.');
  if (!canSire(sire)) return err(`${sire.name} can't sire a litter right now.`);
  if (!canDam(s, dam)) return err(dam.cool > 0 ? `${dam.name} needs ${dam.cool} more day${dam.cool > 1 ? 's' : ''} of rest.` : `${dam.name} can't be bred right now.`);
  const close = (sire.parents && dam.parents && sire.parents.some(p => dam.parents.some(q => q.id === p.id))) || dam.parents?.some(p => p.id === sire.id) || sire.parents?.some(p => p.id === dam.id);
  k.preg.push({ dam: dam.id, sire: JSON.parse(JSON.stringify(sire)), due: s.time.day + LITTER_DAYS });
  dam.cool = DAM_REST;
  return { ok: true, text: `${dam.name} was bred to ${sire.name}. Pups in ${LITTER_DAYS} days.${close ? ' They\'re close kin, so watch for weak pups.' : ''}`, close };
}
export const pregnancy = (s, damId) => ensureKennel(s).preg.find(p => p.dam === damId) || null;

// ---------------------------------------------------------------- the morning
// Feed, age, heal, grow; litters come due; the market restocks.
// Returns { notes, feed }.
export function dogsDay(s) {
  const k = ensureKennel(s), notes = [];
  rehome(s);
  const feed = k.dogs.length * FEED_PER_DOG;
  if (feed) { if (!spend(s, feed, `Dog feed (${k.dogs.length})`)) earnBank(s, -feed, 'Dog feed (overdrawn)'); }
  for (const d of k.dogs) {
    d.age++; d.energy = 100; d.health = Math.min(d.hcap, d.health + 8); if (d.cool > 0) d.cool--;
    const gf = growFactor(d.age);
    if (d.age <= 36) STATS.forEach(([x]) => d.stats[x] = Math.max(d.stats[x], Math.min(d.pot[x], Math.round(d.pot[x] * gf))));
    if (d.age > 96) STATS.forEach(([x]) => { if (R() < 0.3) d.stats[x] = Math.max(10, d.stats[x] - 1); });
    if (d.age === 12) notes.push(`🐕 ${d.name} is grown and ready to hunt.`);
  }
  const due = k.preg.filter(p => p.due <= s.time.day);
  k.preg = k.preg.filter(p => p.due > s.time.day);
  for (const p of due) {
    const dam = k.dogs.find(d => d.id === p.dam);
    if (!dam) continue;
    const n = Math.max(1, Math.min(ri(2, 7), Math.round(ri(2, 8) * dam.health / 100) || 1));
    const pups = Array.from({ length: n }, () => makePuppy(s, p.sire, dam));
    let kept = 0, sold = 0, soldN = 0;
    for (const pup of pups) {
      const to = freeHome(s, dam.home);
      if (to) { pup.home = to; k.dogs.push(pup); kept++; }
      else { sold += Math.round(dogValue(pup) * 0.7); soldN++; }
    }
    if (sold) earnBank(s, sold, `Sold ${soldN} pup${soldN > 1 ? 's' : ''} from ${dam.name}'s litter`);
    k.st.litters++; k.st.pups += n;
    notes.push(`🐶 ${dam.name} whelped ${n} pup${n > 1 ? 's' : ''} by ${p.sire.name}.${soldN ? ` No room for ${soldN}, so they went to neighbours for ${fmtMoney(sold)}.` : ''}`);
  }
  refreshMarket(s, true);
  return { notes, feed };
}

// tier gate for the better hunting grounds
export const groundOpen = (s, g) => !g.tier || tierOf(s.rep).n >= g.tier;
