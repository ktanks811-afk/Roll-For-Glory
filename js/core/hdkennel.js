// Kennel life from Hogs & Dogs: the Breeding Lab's 100 named mixes and the
// Genetic Discovery Book, the alpha male and fights for alpha, coyotes coming
// onto the place at night, the breed book, and the memorial wall for dogs
// that didn't make it. Hooks into core/dogs.js (HOOKS) so every litter, every
// morning and every dog's value goes through here. DOM-free.

import { STATS } from '../data/dogs.js';
import { MIX_RAW, MIX_ALIAS, BREED_FACTS, NOMERLE } from '../data/hdref.js';
import { BREEDS } from '../data/dogs.js';
import { HOOKS, ensureKennel, isAdult, breedName, catchScore, bayScore } from './dogs.js';
import { ensureHd, hdLog, bump, seasonOf } from './hd.js';
import { earnBank } from './state.js';

const R = Math.random, ri = (a, b) => Math.floor(R() * (b - a + 1)) + a;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const avg = a => a.reduce((t, x) => t + x, 0) / a.length;
const r1 = n => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- the Breeding Lab
// A recipe says how a named mix is made: which two breeds run through the pup,
// which coat genes it needs and how many generations of crossing. A pup whose
// own inherited genes fit a recipe is that mix.
export const TRAITS = {
  merle: d => d.genes.M.includes('M'),
  dilute: d => d.genes.D[0] === 'd' && d.genes.D[1] === 'd',
  chocolate: d => d.genes.B[0] === 'b' && d.genes.B[1] === 'b',
  red: d => d.genes.E[0] === 'e' && d.genes.E[1] === 'e',
  brindle: d => !TRAITS.red(d) && !d.genes.K.includes('K') && d.genes.K.includes('br'),
  black: d => !TRAITS.red(d) && d.genes.K.includes('K'),
  tan: d => !TRAITS.red(d) && !d.genes.K.includes('K') && d.genes.A[0] === 'at',
  saddle: d => !TRAITS.red(d) && !d.genes.K.includes('K') && d.genes.A[0] === 'as',
  ticked: d => d.genes.T.includes('T'),
  white: d => d.genes.S.some(a => a !== 'S'),
  xwhite: d => d.genes.S.includes('sw') && d.genes.S[0] !== 'S',
  tri: d => (TRAITS.tan(d) || TRAITS.saddle(d)) && TRAITS.white(d),
};
export const TRAIT_WORDS = { merle: 'merle', dilute: 'dilute blue', chocolate: 'chocolate', red: 'red / yellow', brindle: 'brindle', black: 'solid black', tan: 'tan points', saddle: 'saddle', ticked: 'ticking', white: 'white markings', xwhite: 'mostly white', tri: 'tri-colour' };
const PICK = { Rare: 1, Epic: 0.7, Legendary: 0.5 };
export const MIX_RAR_COLOR = { Rare: '#3aa0ff', Epic: '#b45cff', Legendary: '#ffb020' };

export const MIXES = MIX_RAW.trim().split('\n').map(line => {
  const [n, name, a, bs, req, gen] = line.split('|');
  const Bs = bs.split('/').map(b => MIX_ALIAS[b] || b), A = MIX_ALIAS[a] || a, B = Bs[0], need = req ? req.split('+') : [], g = +gen || 1;
  const bodyType = /Bull|Bully|Mastiff|Dogo|Corso/.test(A) ? 'bully' : /Coonhound|Walker|Plott|Beagle|Bluetick|Redbone/.test(A) ? 'hound' : 'cur';
  const rarity = g >= 3 ? 'Legendary' : (g >= 2 || need.length >= 2) ? 'Epic' : 'Rare';
  const kA = (BREEDS[A] || { kg: [20, 30] }).kg, kB = (BREEDS[B] || { kg: [20, 30] }).kg;
  const mods = bodyType === 'bully' ? { str: 4, grip: 4, sta: 1 } : bodyType === 'hound' ? { trk: 4, sta: 3, spd: 1 } : { spd: 2, sta: 2, int: 2, trk: 1 };
  if (rarity === 'Legendary') for (const k in mods) mods[k] += 3;
  return { id: +n, name, A, B, alt: Bs.slice(1).map(b => [A, b]), need, gen: g, rarity, bodyType, mods, size: [Math.round((kA[0] + kB[0]) / 2), Math.round((kA[1] + kB[1]) / 2)] };
});
export const MIX_BY_ID = Object.fromEntries(MIXES.map(m => [m.id, m]));
const isMixed = d => !!d && d.breed === 'Cross';
const ancOf = d => d?.anc || (d ? { [d.breed]: 1 } : {});
const pairsOf = r => [[r.A, r.B], ...r.alt];
const ancOK = (anc, r) => pairsOf(r).some(([A, B]) => { const a = anc[A] || 0, b = anc[B] || 0; return a >= 0.2 && b >= 0.2 && a + b >= 0.75; });
export const traitsOK = (d, r) => r.need.every(t => TRAITS[t] && TRAITS[t](d));
const xgen = d => d ? d.xgen ?? (isMixed(d) ? 1 : 0) : 0;
// purebred × purebred = 1, a mix × a purebred = 2+, a mix × a mix = 3+
function genOf(pup, A, B) {
  if (!isMixed(pup)) return null;
  const ma = isMixed(A), mb = isMixed(B), g = Math.max(xgen(A), xgen(B));
  if (!ma && !mb) return 1;
  return ma && mb ? Math.max(g + 1, 3) : Math.max(2, g + 1);
}
// what a pairing could ever make, before any pup exists
export function pairRecipes(A, B) {
  const anc = {};
  for (const p of [A, B]) for (const [k, v] of Object.entries(ancOf(p))) anc[k] = (anc[k] || 0) + v / 2;
  return MIXES.filter(r => ancOK(anc, r));
}
function resolve(pup, A, B) {
  const g = pup.xgen || 0, anc = ancOf(pup);
  const fits = MIXES.filter(r => ancOK(anc, r) && g >= r.gen && traitsOK(pup, r)).sort((x, y) => (y.need.length - x.need.length) || (y.gen - x.gen) || (x.id - y.id));
  if (!fits.length) return null;
  const fitOf = f => Math.max(...pairsOf(f).map(([P, Q]) => (anc[P] || 0) + (anc[Q] || 0)));
  const top = fits.filter(f => f.need.length === fits[0].need.length && f.gen === fits[0].gen), best = Math.max(...top.map(fitOf)), tied = top.filter(f => fitOf(f) >= best - 1e-6);
  let x = R() * tied.reduce((t, f) => t + PICK[f.rarity], 0), r = tied[0];
  for (const f of tied) { x -= PICK[f.rarity]; if (x <= 0) { r = f; break; } }
  const pq = (avg(Object.values(A.pot)) + avg(Object.values(B.pot))) / 2, boost = 1 + clamp((pq - 65) / 40, 0, 0.4) + ((A.mix || B.mix) ? 0.1 : 0);
  return { r, legend: R() < 0.04 * boost };
}
function applyMix(pup, { r, legend }) {
  pup.mix = { id: r.id, name: r.name, rarity: r.rarity, legend: !!legend };
  pup.cross = r.name;
  for (const [k, v] of Object.entries(r.mods)) pup.pot[k] = clamp(pup.pot[k] + v, 15, 99);
  if (legend) { for (const [k] of STATS) pup.pot[k] = clamp(pup.pot[k] + ri(6, 10), 15, 99); pup.hcap = 100; pup.health = 100; }
  pup.kg = r1(clamp(pup.kg, r.size[0], r.size[1]));
  if (BREEDS[r.A]) pup.build = r.A;     // the recipe's body
  STATS.forEach(([k]) => pup.stats[k] = Math.round(pup.pot[k] * 0.3));
}
export const mixBook = s => ensureHd(s).mixBook ??= {};
HOOKS.pup.push((s, pup, sire, dam) => {
  const g = genOf(pup, sire, dam);
  if (g != null) { pup.xgen = g; }
  if (!isMixed(pup)) return;
  const hit = resolve(pup, sire, dam);
  if (!hit) return;
  applyMix(pup, hit);
  const B = mixBook(s);
  if (!B[hit.r.id]) {
    B[hit.r.id] = { day: s.time.day, dog: pup.name, sire: sire.name, dam: dam.name, gen: pup.xgen || 1, legend: !!hit.legend };
    (ensureHd(s).newMixes ??= []).push(hit.r.id);
    hdLog(s, `NEW BREED DISCOVERED: ${hit.r.name} (#${hit.r.id}, ${hit.r.rarity}) from ${sire.name} × ${dam.name}.`);
  }
});
// named mixes and legends are worth more
HOOKS.value.push(d => !d.mix ? 1 : d.mix.legend ? 1.8 : d.mix.rarity === 'Legendary' ? 1.5 : d.mix.rarity === 'Epic' ? 1.3 : 1.15);

// ---------------------------------------------------------------- the breed book
export const factsOf = breed => BREED_FACTS[breed] || null;
export const packRole = b => { const F = BREED_FACTS[b] || {}, r = F.role || ''; return !F.hog ? 'other' : /strike/i.test(r) ? 'strike' : /catch|holder/i.test(r) ? 'catch' : 'bay'; };
export const merleBarred = d => !d.cross && d.breed !== 'Cross' && NOMERLE.includes(d.breed) && d.genes.M.includes('M');

// ---------------------------------------------------------------- the memorial
// A dog that dies goes on the wall; its record stays.
export function loseDog(s, d, why) {
  const k = ensureKennel(s), h = ensureHd(s);
  k.dogs = k.dogs.filter(x => x !== d);
  k.preg = k.preg.filter(p => p.dam !== d.id);
  (h.memorial ??= []).unshift({ day: s.time.day, id: d.id, name: d.name, breed: breedName(d), why, hunt: { ...d.hunt } });
  if (h.memorial.length > 40) h.memorial.length = 40;
  hdLog(s, `🕊️ ${d.name} ${why}.`);
}
const hurt = (d, n) => { d.health = clamp(Math.round(d.health - n), 1, d.hcap || 100); };

// ---------------------------------------------------------------- the alpha
// The top grown male leads. Now and then another male challenges him and they
// fight it out in the yard. Fights hurt, and once in a while one ends in a death.
export const alphaSt = s => ensureHd(s).alpha ??= { id: null, since: 0, last: 0, fights: 0, deaths: 0, won: {}, hist: [] };
const males = s => ensureKennel(s).dogs.filter(d => d.sex === 'M' && isAdult(d));
export function alphaPower(d) {
  const st = d.stats;
  let p = st.str + st.grip * 0.8 + st.sta * 0.4 + 50 * 0.4 + (d.kg || 25) * 0.6 + d.health * 0.3;
  if (d.health < 50) p -= 15;
  if (d.age > 96) p -= (d.age - 96) * 0.5;
  return p;
}
export const packRank = s => males(s).sort((a, b) => alphaPower(b) - alphaPower(a));
export const isAlpha = (s, d) => !!d && ensureHd(s).alpha?.id === d.id;
export const alphaDog = s => { const id = alphaSt(s).id; return id ? ensureKennel(s).dogs.find(d => d.id === id) || null : null; };
function crown(s, d, why) { const st = alphaSt(s); st.id = d.id; st.since = s.time.day; st.hist.unshift({ day: s.time.day, id: d.id, name: d.name, why }); st.hist.length = Math.min(st.hist.length, 20); }
export function alphaFight(s, a, c) {
  const st = alphaSt(s), pa = alphaPower(a), pc = alphaPower(c), pWin = 1 / (1 + Math.exp(-(pc - pa) / 12));
  const cWins = R() < pWin, W = cWins ? c : a, L = cWins ? a : c, close = Math.abs(pa - pc) < 15;
  const dmgL = ri(10, close ? 32 : 24), dmgW = ri(3, close ? 16 : 10);
  hurt(L, dmgL); hurt(W, dmgW);
  const catchy = d => catchScore(d) > bayScore(d);
  const dead = R() < 0.05 + (catchy(a) && catchy(c) ? 0.06 : 0) + (close ? 0.04 : 0) + (L.health <= 25 ? 0.06 : 0);
  st.fights++; st.last = s.time.day; st.won[W.id] = (st.won[W.id] || 0) + 1;
  const res = { kind: 'alpha', day: s.time.day, a: a.name, c: c.name, aId: a.id, cId: c.id, W: W.name, L: L.name, dmgW, dmgL, newAlpha: cWins, dead: null };
  if (cWins) crown(s, c, `beat ${a.name}`);
  if (dead) { st.deaths++; res.dead = L.name; loseDog(s, L, `was killed fighting ${W.name} for alpha`); }
  hdLog(s, `⚔️ Alpha fight: ${c.name} challenged ${a.name}. ${cWins ? `${c.name} won and is the new alpha.` : `${a.name} held on as alpha.`}${dead ? ` ${L.name} died of his wounds.` : ''}`);
  return res;
}
export function alphaDaily(s, force = false) {
  const st = alphaSt(s), M = packRank(s), k = ensureKennel(s);
  if (st.id && !k.dogs.some(d => d.id === st.id)) st.id = null;
  if (!M.length) return null;
  if (!st.id) { crown(s, M[0], M.length > 1 ? 'top dog in the kennel' : 'only grown male'); return null; }
  if (M.length < 2 || (!force && (s.time.day < 10 || s.time.day - st.last < 5))) return null;
  const a = alphaDog(s), ch = M.filter(d => d !== a && d.health >= 50);
  if (!a || !ch.length) return null;
  const gap = alphaPower(a) - alphaPower(ch[0]);
  const p = 0.04 + Math.max(0, 0.10 * (1 - gap / 40)) + (a.health < 60 ? 0.10 : 0) + (a.age > 108 ? 0.05 : 0);
  return force || R() < p ? alphaFight(s, a, ch[0]) : null;
}
// the alpha hunts with a little more grit (core/hoghunt.js reads it)
export const alphaGrit = (s, d) => isAlpha(s, d) ? 1.06 : 1;

// ---------------------------------------------------------------- coyotes
// Some nights a pack comes in after the kennels. The best grown dogs go out
// after them; each kill pays the $40 county bounty. No dogs fit to fight, and
// they may take a hog from the Hog Pin.
export const COYOTE_BOUNTY = 40;
export const coyPower = d => (d.stats.str + d.stats.grip + d.stats.spd * 0.5) / 2.5;
export function coyoteRaid(s, force = false) {
  const h = ensureHd(s), st = h.coy ??= { raids: 0, killed: 0, lost: 0, last: null }, k = ensureKennel(s);
  if (!k.dogs.length && !h.hogs.length) return null;
  if (!force && (s.time.day < 8 || st.last === s.time.day || R() >= (['Winter', 'Fall'].includes(seasonOf(s.time.day)) ? 0.08 : 0.05))) return null;
  st.last = s.time.day; st.raids++;
  const n = ri(2, 5), pack = Array.from({ length: n }, () => ({ hp: ri(28, 40), w: ri(22, 38), dead: false }));
  const def = k.dogs.filter(d => isAdult(d) && d.health >= 30).sort((a, b) => coyPower(b) - coyPower(a)).slice(0, 6), bites = new Map(), kills = [];
  for (let round = 0; round < 14; round++) {
    const up = def.filter(d => (bites.get(d) || 0) < 25), alive = pack.filter(c => !c.dead);
    if (!up.length || !alive.length) break;
    for (const d of up) { const c = alive[ri(0, alive.length - 1)]; if (c.dead) continue; c.hp -= ri(4, 9) * coyPower(d) / 60; if (c.hp <= 0) { c.dead = true; kills.push({ w: c.w, by: d.name }); } }
    for (const c of pack.filter(x => !x.dead)) { const d = up[ri(0, up.length - 1)]; if (R() < 0.45) bites.set(d, (bites.get(d) || 0) + ri(2, 6)); }
    if (pack.filter(c => !c.dead).length <= n / 2 && R() < 0.5) break;
  }
  const fled = pack.filter(c => !c.dead).length, bitten = [];
  for (const [d, b] of bites) if (b >= 5) { const dmg = Math.min(30, b); hurt(d, dmg); bitten.push({ n: d.name, dmg }); }
  let lost = null;
  if (!kills.length && fled && h.hogs.length) {
    const pin = h.hogs.slice().sort((a, b) => (a.wt || 0) - (b.wt || 0))[0];
    h.hogs = h.hogs.filter(x => x !== pin); lost = `The coyotes got ${pin.name} from the Hog Pin.`; st.lost++;
  }
  const pay = kills.length * COYOTE_BOUNTY;
  if (pay) earnBank(s, pay, `County coyote bounty (${kills.length})`);
  st.killed += kills.length; bump(s, 'coyotes', kills.length);
  hdLog(s, `🐺 ${n} coyotes came onto the place in the night. ${kills.length ? `Your dogs killed ${kills.length} (${pay ? `$${pay}` : ''} bounty)` : 'Your dogs couldn\'t catch one'}${fled ? `, ${fled} ran off` : ''}.${lost ? ' ' + lost : ''}`);
  return { kind: 'coyotes', day: s.time.day, n, def: def.map(d => d.name), kills, fled, bitten, lost, pay };
}

// every morning: the alpha, maybe coyotes. The night's events wait in
// s.hd.events for the UI to show.
HOOKS.day.push((s, notes) => {
  const h = ensureHd(s), ev = h.events ??= [];
  const f = alphaDaily(s); if (f) { ev.push(f); notes.push(`⚔️ ${f.c} challenged ${f.a} for alpha. ${f.newAlpha ? `${f.c} is the new alpha.` : `${f.a} held on.`}${f.dead ? ` ${f.dead} died of his wounds.` : ''}`); }
  const c = coyoteRaid(s); if (c) { ev.push(c); notes.push(`🐺 Coyotes hit the kennel last night: ${c.kills.length} killed${c.pay ? ` ($${c.pay} bounty)` : ''}${c.bitten.length ? `, ${c.bitten.length} dog${c.bitten.length > 1 ? 's' : ''} bitten` : ''}.`); }
  if (ev.length > 6) ev.splice(0, ev.length - 6);
});
