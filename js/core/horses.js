// Horses and the county fair, from Hogs & Dogs. Horses need country acreage
// (6 stalls on each piece of Johnson County land). Every horse carries real
// coat genetics (gfx2d/horseArt.js): breed two of the same breed and the foal
// is drawn from both of them. The fair comes four times a year (one game day
// is a month, so days 1, 4, 7 and 10 of every 12): Best in Show for dogs,
// Barrel Racing and Cutting for horses, the Hog Weigh-Off for pin hogs and a
// cattle auction. DOM-free.

import { HG, HSTATS, HBREED, HB_FEE, HB_ADULT, HORSE_BREEDS, horseValue } from '../gfx2d/horseArt.js';
import { LAND } from '../data/estate.js';
import { ensureHd, hdLog, bump, ribbon, RIVALS, monthOf, seasonOf, level, ordinal } from './hd.js';
import { HOOKS, ensureKennel } from './dogs.js';
import { spend, earn, addRep } from './state.js';
import { buildGrade } from './hdtrials.js';
import { pinHogs } from './hogpin.js';

const R = Math.random, gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const err = text => ({ ok: false, text });
const $ = n => '$' + Math.round(n).toLocaleString();
export { HSTATS, HB_ADULT };
export const STUD_FEE = HB_FEE * 2;               // the vet and the stud fee
export const HORSE_DNA = 300;
export const horses = s => ensureHd(s).horses;
export const horsePrice = h => Math.round(horseValue(h) * 2);
export const trainCost = s => 80 + level(s) * 16;
export const isGrown = h => h.age >= 24;

export function stalls(s) {
  let n = 0;
  for (const [id, l] of Object.entries(s.estate?.land || {})) {
    if (l?.owned && LAND[id]?.country) n += 6;
  }
  return n;
}
export const stallsFree = s => stalls(s) - horses(s).length - ensureHd(s).hpreg.length;

export function horseMarket(s, force) {
  const h = ensureHd(s);
  if (force || !h.horseMarket.length || h.mktDay == null || s.time.day - h.mktDay >= 3) {
    h.horseMarket = []; h.mktDay = s.time.day;
    const names = Object.keys(HORSE_BREEDS);
    for (let i = 0; i < 4; i++) h.horseMarket.push(HG.create(names[Math.floor(R() * names.length)], { age: 24 + Math.floor(R() * 60) }));
  }
  return h.horseMarket;
}
export function buyHorse(s, id) {
  const h = ensureHd(s), x = h.horseMarket.find(m => m.id === id);
  if (!x) return err('That horse is gone.');
  if (!stalls(s)) return err('Horses need country land. Buy acreage in Johnson County: 6 stalls a piece.');
  if (stallsFree(s) < 1) return err('Every stall is full. Sell a horse or buy more land.');
  const p = horsePrice(x);
  if (!spend(s, p, `Bought ${x.name}, ${x.breed}`)) return err(`You need ${$(p)}.`);
  h.horseMarket = h.horseMarket.filter(m => m !== x); x.bought = s.time.day; h.horses.push(x); bump(s, 'horsesBought');
  hdLog(s, `Bought ${x.name} (${x.gid}), a ${x.coat.toLowerCase()} ${x.breed}.`);
  return { ok: true, text: `${x.name} is in the barn.` };
}
export function sellHorse(s, id) {
  const h = ensureHd(s), x = h.horses.find(m => m.id === id);
  if (!x) return err('No such horse.');
  if (h.hpreg.some(p => p.dam === x.id)) return err(`${x.name} is in foal.`);
  const p = Math.round(horsePrice(x) * 0.8);
  earn(s, p, `Sold ${x.name}, ${x.breed}`);
  h.horses = h.horses.filter(m => m !== x);
  hdLog(s, `Sold ${x.name} for ${$(p)}.`);
  return { ok: true, text: `${x.name} sold for ${$(p)}.` };
}
export function renameHorse(s, id, name) { const x = horses(s).find(m => m.id === id); name = String(name || '').trim().slice(0, 24); if (!x || !name) return err('Give it a name.'); x.name = name; return { ok: true, text: `Renamed ${name}.` }; }
export function trainHorse(s, id, k) {
  const x = horses(s).find(m => m.id === id), c = trainCost(s);
  if (!x || !HSTATS.some(([q]) => q === k)) return err('Pick a horse and a skill.');
  if (x.lastTrain === s.time.day) return err(`${x.name} already worked today.`);
  const gap = x.pot[k] - x[k]; if (gap <= 0) return err(`${x.name} is at its limit there.`);
  if (!spend(s, c, `Horse training: ${x.name}`)) return err(`You need ${$(c)}.`);
  const gain = Math.max(1, Math.min(gap, Math.round((gap * 0.14 + 1) * (0.6 + x.trn / 120))));
  x.tr = x.tr || {}; x.tr[k] = (x.tr[k] || 0) + gain; x.lastTrain = s.time.day; x.trained = (x.trained || 0) + 1; x.bond = Math.min(100, x.bond + 2);
  HG.settle(x);
  return { ok: true, text: `${x.name} +${gain} ${HSTATS.find(([q]) => q === k)[1].toLowerCase()}.` };
}
export function dnaTest(s, id) {
  const x = horses(s).find(m => m.id === id); if (!x) return err('No such horse.');
  if (!spend(s, HORSE_DNA, `DNA test: ${x.name}`)) return err(`You need ${$(HORSE_DNA)}.`);
  x.known = Object.fromEntries(Object.keys(x.genes).map(l => [l, 1]));
  return { ok: true, text: `${x.name}'s coat genes are on file.` };
}
// same breed only, both 3 years old, a free stall for the foal
export function canBreedHorses(s, sire, dam) {
  const pr = HG.canBreed(sire, dam).filter(p => !/need|stall/.test(p));
  if (!pr.length && stallsFree(s) < 1) pr.push('There is no stall free for a foal. Buy more country land.');
  return pr;
}
export function breedHorses(s, sId, dId) {
  const h = ensureHd(s), sire = h.horses.find(m => m.id === sId), dam = h.horses.find(m => m.id === dId), pr = canBreedHorses(s, sire, dam);
  if (pr.length) return err(pr[0]);
  if (!spend(s, STUD_FEE, `Vet and stud fee: ${dam.name} × ${sire.name}`)) return err(`You need ${$(STUD_FEE)}.`);
  const due = s.time.day + HBREED[dam.breed].gest;
  h.hpreg.push({ dam: dam.id, sire: HG.snap(sire), sireRef: sire.id, due, day: s.time.day });
  hdLog(s, `${dam.name} was bred to ${sire.name}. Foal due day ${due}.`);
  return { ok: true, text: `${dam.name} was bred to ${sire.name}. The foal is due day ${due}.` };
}
export const foalOdds = (sire, dam) => HG.predict(sire, dam, 200);
HOOKS.day.push((s, notes) => {
  const h = ensureHd(s);
  for (const x of h.horses) x.age++;
  if (h.horses.length || h.hpreg.length) HG.daily(notes);
  if (h.horses.length) {
    const feed = h.horses.length * 12;
    if (!spend(s, feed, `Hay and grain (${h.horses.length} horse${h.horses.length > 1 ? 's' : ''})`)) for (const x of h.horses) x.health = Math.max(20, (x.health ?? 100) - 8);
  }
});

// ---------------------------------------------------------------- the county fair
export const FAIR_MONTHS = [0, 3, 6, 9];
export const FAIR_FEE = 150;
export const FAIR_HEAD = 2600;    // fair buyers pay more a head than the sale barn
export const FAIR_EV = {
  show: { name: 'Best in Show', icon: '🐕', kind: 'dog', prize: [3000, 1500, 600], how: 'Build, coat, rarity, obedience and condition.',
    pool: s => ensureKennel(s).dogs.filter(d => d.age >= 12 && d.health >= 40),
    score: d => ({ good: 30, std: 20, poor: 8, defect: 0 }[buildGrade(d)?.k] ?? 15) + (d.rar || 0) * 8 + d.stats.obd * 0.25 + d.health * 0.1 + 10, base: 43 },
  barrel: { name: 'Barrel Racing', icon: '🐎', kind: 'horse', prize: [2400, 1200, 500], how: 'Agility, speed, training and bond.',
    pool: s => horses(s).filter(h => isGrown(h) && (h.health ?? 100) >= 60), score: h => h.agi * 0.45 + h.spd * 0.35 + h.trn * 0.1 + h.bond * 0.1, base: 59 },
  cutting: { name: 'Cutting', icon: '🐄', kind: 'horse', prize: [2400, 1200, 500], how: 'Work ability, agility, intelligence and temperament.',
    pool: s => horses(s).filter(h => isGrown(h) && (h.health ?? 100) >= 60), score: h => h.wrk * 0.4 + h.agi * 0.3 + h.int * 0.2 + h.tmp * 0.1, base: 59 },
  weigh: { name: 'Hog Weigh-Off', icon: '🐗', kind: 'hog', prize: [2000, 1000, 400], how: 'The heaviest, best-conditioned hog from your Hog Pin.',
    pool: s => pinHogs(s).filter(h => h.age >= 6), score: h => h.w / 4 + (h.bc ?? 80) * 0.1, base: 55 },
};
export const fairOpen = (day) => FAIR_MONTHS.includes(monthOf(day));
export const fairName = day => `${seasonOf(day)} fair`;
export function fairNext(s) { for (let d = s.time.day + 1; d < s.time.day + 13; d++) if (fairOpen(d)) return d - s.time.day; return 0; }
export function fairState(s) { const h = ensureHd(s); if (!h.fair || h.fair.day !== s.time.day) h.fair = { day: s.time.day, entered: {}, sold: 0 }; return h.fair; }
export function enterFair(s, ev, id) {
  if (!fairOpen(s.time.day)) return err("The fair isn't in town today.");
  const E = FAIR_EV[ev], F = fairState(s);
  if (!E) return err('No such event.');
  if (F.entered[ev]) return err('You already entered that event at this fair.');
  const who = E.pool(s).find(x => x.id === id);
  if (!who) return err('Pick an entry.');
  if (!spend(s, FAIR_FEE, `County fair entry: ${E.name}`)) return err(`The entry is ${$(FAIR_FEE)}.`);
  const mine = E.score(who) + R() * 14, names = [...RIVALS].sort(() => R() - 0.5);
  const field = names.slice(0, 7).map(n => ({ n, s: E.base + gauss() * 8 + level(s) * 1.5 + R() * 14 }));
  field.push({ n: 'You', s: mine, me: 1, who: who.name }); field.sort((a, b) => b.s - a.s);
  const place = field.findIndex(x => x.me) + 1;
  F.entered[ev] = { place, who: who.name, field: field.slice(0, 5).map(x => ({ n: x.n, me: !!x.me, who: x.who })) };
  let text = `${E.name}: ${who.name} placed ${ordinal(place)} of ${field.length}`;
  if (place <= 3) {
    const v = E.prize[place - 1]; earn(s, v, `${fairName(s.time.day)}: ${E.name}, ${ordinal(place)}`);
    text += ` and won ${$(v)} and a ${['blue', 'red', 'white'][place - 1]} ribbon!`;
    ribbon(s, { at: fairName(s.time.day), ev: E.name, place, who: who.name });
    if (place === 1) addRep(s, 150, `${E.name} win at the county fair`);
  }
  if (E.kind === 'horse') who.bond = Math.min(100, who.bond + 3);
  hdLog(s, text);
  return { ok: true, text, place };
}
export function fairAuction(s) {
  if (!fairOpen(s.time.day)) return err("The fair isn't in town today.");
  const F = fairState(s), herd = cattleOwned(s), n = Math.min(5 - F.sold, herd.total);
  if (n <= 0) return err(F.sold >= 5 ? 'The fair buyers took 5 head already.' : 'You have no cattle to sell.');
  let left = n;
  for (const l of herd.list) { const t = Math.min(left, l.animals.cow); l.animals.cow -= t; if (!l.animals.cow) delete l.animals.cow; left -= t; if (!left) break; }
  F.sold += n; const v = n * FAIR_HEAD;
  earn(s, v, `Cattle auction at the county fair (${n} head)`);
  return { ok: true, text: `Sold ${n} head at the fair for ${$(v)}.` };
}
// the Angus on your land (data/estate.js ANIMALS 'cow', kept per piece in land.animals)
function cattleOwned(s) {
  const list = [];
  for (const l of Object.values(s.estate?.land || {})) if (l?.owned && l.animals?.cow > 0) list.push(l);
  return { list, total: list.reduce((t, l) => t + l.animals.cow, 0) };
}
