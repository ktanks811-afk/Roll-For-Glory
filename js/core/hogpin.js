// The Hog Pin, from Hogs & Dogs: keep the hogs your dogs catch instead of
// sending them all to the processor. Every hog has its genes (gfx2d/hogArt.js)
// read from the hog that was caught, so a kept hog looks and grows like itself.
// Hogs in the pin eat, grow, breed and farrow; sell them to the live buyer at
// the Joshua auction or the processor, use them in the bay pen to train dogs,
// show them at the county fair weigh-off. Cut, tag and turn a hog loose and it
// may come back heavier on a later hunt.
//
// The pin lives on land you own: 20 hogs on each piece of country acreage,
// 4 on a city lot. DOM-free.

import { HOGG, HOG_RATION, HOG_ADULT } from '../gfx2d/hogArt.js';
import { HOGS } from '../data/dogs.js';
import { LAND } from '../data/estate.js';
import { ensureHd, hdLog, bump } from './hd.js';
import { HOOKS } from './dogs.js';
import { spend, earn, earnBank } from './state.js';

const R = Math.random, ri = (a, b) => Math.floor(R() * (b - a + 1)) + a;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const err = text => ({ ok: false, text });
export const FEED_PER_HOG = 4;              // $ a grown hog a day on the standard ration
export const PROC_PER_LB = 2.5;             // what the processor in Joshua pays (core/hoghunt.js uses the same)
export { HOG_RATION, HOG_ADULT };

export function pinCap(s) {
  let cap = 0;
  for (const [id, l] of Object.entries(s.estate?.land || {})) {
    if (l?.owned && LAND[id]) cap += LAND[id].country ? 20 : 4;
  }
  return cap;
}
export const pinHogs = s => ensureHd(s).hogs;
export const pinRoom = s => pinCap(s) - pinHogs(s).length;
export const feedNeed = s => { const R0 = HOG_RATION[ensureHd(s).hogPin.ration] || HOG_RATION.standard; return Math.ceil(pinHogs(s).reduce((t, h) => t + (h.age < 2 ? 0 : h.age < 6 ? 0.5 : 1) + (h.preg || h.nurse > 0 ? 0.5 : 0), 0) * R0.feed * FEED_PER_HOG); };

// what the buyers pay for a hog (pin hog or fresh off the hunt)
export const procPrice = (o, ground) => Math.round((o.wt || o.w) * PROC_PER_LB * (HOGS[o.kind || o.key]?.mult || o.mult || 1) * (ground === 'chalk' ? 1.2 : 1) * (o.barrow ? 1.25 : 1) * (o.bruise ? 0.8 : 1));
export const livePrice = (o, ground) => Math.round(procPrice({ ...o, barrow: false }, ground) * (o.sex === 'M' && (o.wt || o.w) >= 150 ? 1.35 : 1.05) * (o.tie || 1));

// ---------------------------------------------------------------- after a hunt
// sum.hogs[i] came off the hunt already sold to the processor (core/hoghunt.js
// settleHunt). These change your mind about one hog.
function takeBack(s, b, why) { if (b.sold === 'proc' && b.value) earnBank(s, -b.value, why); }
export function sellLive(s, b, ground) {
  if (b.sold !== 'proc') return err('That hog is already taken care of.');
  if (b.shot) return err('A shot hog only goes to the processor.');
  const v = livePrice(b, ground) * (ensureHd(s).gear?.cage ? 1.1 : 1), diff = Math.round(v - b.value);
  earnBank(s, diff, `Live buyer took the ${b.w} lb ${b.name.toLowerCase()} instead of the processor`);
  b.sold = 'live'; b.value = Math.round(v); bump(s, 'liveSold');
  return { ok: true, text: `The live buyer paid ${'$' + Math.round(v).toLocaleString()} for the ${b.w} lb ${b.name.toLowerCase()}.` };
}
export function keepHog(s, b, ground) {
  if (b.sold !== 'proc') return err('That hog is already taken care of.');
  if (b.shot) return err('A shot hog can only go to the processor or the freezer.');
  if (pinRoom(s) < 1) return err(pinCap(s) ? 'The Hog Pin is full. Sell a hog or buy more land.' : 'You need land for a Hog Pin. Country acreage holds 20 hogs.');
  takeBack(s, b, `Kept the ${b.w} lb ${b.name.toLowerCase()} for the Hog Pin`);
  const h = HOGG.fromWild({ seed: b.seed || ri(1, 2e9), key: b.kind, w: b.w, sp: b.sp || 1, end: b.end || 1, aggr: b.aggr ?? 0.5, sex: b.sex, day: s.time.day, area: ground });
  h.from = `Caught at the ${ground} lease, day ${s.time.day}`;
  pinHogs(s).push(h); b.sold = 'pin'; b.value = 0; b.pinId = h.id; bump(s, 'hogsKept');
  hdLog(s, `Kept ${h.name} (${h.id}), a ${h.w} lb ${h.type.toLowerCase()} ${h.sex === 'M' ? 'boar' : 'sow'}, in the Hog Pin.`);
  return { ok: true, text: `${h.name} rides home to the Hog Pin.`, hog: h };
}
export const tagged = s => ensureHd(s).tagged ??= [];
export function tagHog(s, b, ground) {
  if (b.sold !== 'proc') return err('That hog is already taken care of.');
  if (b.shot) return err('A shot hog can\'t be turned loose.');
  takeBack(s, b, `Tagged and turned loose the ${b.w} lb ${b.name.toLowerCase()}`);
  const h = ensureHd(s), n = h.tagN = (h.tagN || 0) + 1;
  tagged(s).push({ n, ground, w: b.w, kind: b.kind, sex: b.sex, day: s.time.day });
  b.sold = 'tag'; b.value = 0; b.tagN = n; bump(s, 'hogsTagged');
  hdLog(s, `${b.sex === 'M' ? 'Cut, tagged' : 'Tagged'} and turned the ${b.w} lb ${b.name.toLowerCase()} loose (tag #${n}).`);
  return { ok: true, text: `${b.sex === 'M' ? 'Cut, tagged' : 'Tagged'} and turned loose (tag #${n}). It'll grow on those grounds; the dogs may find it again.` };
}
// a tagged hog on these grounds may be the one the dogs find, heavier for the time it's had
export function tagForHunt(s, ground) {
  const L = tagged(s).filter(t => !t.back && t.ground === ground && s.time.day - t.day >= 4);
  if (!L.length || R() >= 0.4) return null;
  const t = L[ri(0, L.length - 1)];
  return { ...t, grown: Math.min(t.w + 150, Math.round(t.w + (s.time.day - t.day) * 4)) };
}

// ---------------------------------------------------------------- the pin
export function setRation(s, k) { if (!HOG_RATION[k]) return err('No such ration.'); ensureHd(s).hogPin.ration = k; return { ok: true, text: `The hogs are on the ${HOG_RATION[k].name.toLowerCase()} ration.` }; }
export function sellPinHog(s, id, to = 'live') {
  const h = ensureHd(s), hog = h.hogs.find(x => x.id === id);
  if (!hog) return err('No such hog.');
  if (hog.preg) return err(`${hog.name} is bred. Wait for the piglets.`);
  const v = to === 'live' ? Math.max(hog.price, livePrice({ ...hog, w: hog.w, kind: hog.key })) : procPrice({ w: hog.w, mult: hog.mult });
  earn(s, v, `${to === 'live' ? 'Joshua Livestock Auction' : 'Joshua Wild Game Processing'}: ${hog.name} (${hog.w} lb)`);
  h.hogs = h.hogs.filter(x => x !== hog);
  (h.hogRecords ??= []).unshift({ ...HOGG.snap(hog), sold: s.time.day, price: v }); h.hogRecords.length = Math.min(h.hogRecords.length, 100);
  hdLog(s, `Sold ${hog.name} (${hog.w} lb) for $${v.toLocaleString()}.`);
  return { ok: true, text: `${hog.name} sold for $${v.toLocaleString()}.` };
}
export function renameHog(s, id, name) { const hog = pinHogs(s).find(x => x.id === id); name = String(name || '').trim().slice(0, 24); if (!hog || !name) return err('Give it a name.'); hog.name = name; return { ok: true, text: `Renamed ${name}.` }; }
export function canBreedHogs(s, b, so) {
  const pr = [], hogs = pinHogs(s);
  if (!b || !so) return ['Pick a boar and a sow from your Hog Pin.'];
  if (!hogs.includes(b) || !hogs.includes(so)) pr.push('Only hogs in your Hog Pin can breed.');
  if (b.sex !== 'M') pr.push(`${b.name} is not a boar.`); if (so.sex !== 'F') pr.push(`${so.name} is not a sow.`);
  if (b.age < HOG_ADULT.M) pr.push(`${b.name} isn't mature yet (boars breed from ${HOG_ADULT.M} months).`);
  if (so.age < HOG_ADULT.F) pr.push(`${so.name} isn't mature yet (sows breed from ${HOG_ADULT.F} months).`);
  if (b.health < 60) pr.push(`${b.name} isn't healthy enough.`); if (so.health < 60) pr.push(`${so.name} isn't healthy enough.`);
  if (so.preg) pr.push(`${so.name} is already bred.`); if (so.cool > 0) pr.push(`${so.name} is still nursing.`);
  if (b.lastBred === s.time.day) pr.push(`${b.name} already bred a sow today.`);
  if (pinRoom(s) < 3) pr.push('Make room in the Hog Pin for a litter (at least 3 spaces).');
  return pr;
}
export function breedHogs(s, bId, sId) {
  const hogs = pinHogs(s), b = hogs.find(x => x.id === bId), so = hogs.find(x => x.id === sId), pr = canBreedHogs(s, b, so);
  if (pr.length) return err(pr[0]);
  so.preg = { boar: HOGG.snap(b), boarRef: b.id, day: s.time.day, due: s.time.day + 4 }; b.lastBred = s.time.day;
  hdLog(s, `${so.name} was bred to ${b.name}. Piglets due day ${s.time.day + 4}.`);
  return { ok: true, text: `${so.name} was bred to ${b.name}. Piglets in 4 days.` };
}
// every morning: feed (out of the bank), growth, health, litters
export function pinDay(s, notes = []) {
  const h = ensureHd(s), pin = h.hogPin, hogs = h.hogs;
  if (!hogs.length) return notes;
  const R0 = HOG_RATION[pin.ration] || HOG_RATION.standard, need = feedNeed(s);
  let fed = 1;
  if (need && !spend(s, need, `Hog feed (${hogs.length}, ${R0.name.toLowerCase()} ration)`)) { fed = 0.4; notes.push('🐷 Not enough money for hog feed. The hogs went short.'); }
  for (const g of hogs) {
    g.age++; if (g.cool > 0) g.cool--; if (g.nurse > 0) g.nurse--;
    g.cond = Math.min(100, (g.cond ?? 100) + 15);
    g.bc = clamp((g.bc ?? 100) + (fed >= 0.99 ? R0.bc : -12 * (1 - fed)), 30, 100);
    g.health = clamp((g.health ?? 100) + (fed >= 0.99 ? 3 : -5 * (1 - fed) - 1) + (g.age > 96 ? -1 : 0), 10, 100);
    const t = HOGG.target(g); g.wt = Math.max(2, g.wt + (t - g.wt) * (t > g.wt ? 0.4 : 0.25));
    HOGG.settle(g);
  }
  for (const so of hogs.filter(x => x.preg && x.preg.due <= s.time.day)) {
    const p = so.preg, key = HOGG.domKey(so);
    const b = hogs.find(x => x.id === p.boarRef) || { ...p.boar, genes: HOGG.randomGenes(key), anc: { [key]: 1 }, bl: { line: p.boar.name + "'s line", q: 10, gen: 0 }, gen: p.boar.gen || 0 };
    const pigs = HOGG.litter(b, so);
    so.preg = null; so.cool = 2; so.nurse = 2; so.litters = (so.litters || 0) + 1;
    if (hogs.includes(b)) b.sired = (b.sired || 0) + pigs.length;
    HOGG.reveal(pigs, hogs.includes(b) ? b : null, so);
    const room = pinRoom(s), keep = pigs.slice(0, Math.max(0, room)), extra = pigs.slice(keep.length);
    hogs.push(...keep);
    let m = `🐷 ${so.name} farrowed ${pigs.length} piglets by ${p.boar.name}!`;
    if (extra.length) { const v = extra.length * 70; earnBank(s, v, `Sold ${extra.length} feeder pigs`); m += ` No room for ${extra.length}; sold as feeder pigs for $${v}.`; }
    notes.push(m); hdLog(s, m); bump(s, 'hogLitters');
  }
  return notes;
}
HOOKS.day.push((s, notes) => pinDay(s, notes));

// ---------------------------------------------------------------- bay pen hogs
// A pin hog can be run in the bay pen to train dogs. It goes home tired.
export const trainHogs = s => pinHogs(s).filter(h => h.age >= 6 && (h.cond ?? 100) >= 40 && h.health >= 50);
export function useTrainHog(s, id, hard = false) {
  const hog = pinHogs(s).find(x => x.id === id);
  if (!hog) return null;
  hog.cond = Math.max(0, (hog.cond ?? 100) - (hard ? 45 : 30)); hog.uses = (hog.uses || 0) + 1;
  return hog;
}
