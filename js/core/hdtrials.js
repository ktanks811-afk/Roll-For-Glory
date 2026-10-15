// The Hogs & Dogs show and trial circuit, at the Cleburne Expo Center and the
// Rio Vista bay pen in Johnson County:
//  · Dog shows: a local show every week, a regional every 4th week, a National
//    every 12th. Judges with their own eye, a score card, Best of Breed →
//    Best in Group → Best in Show, CH and GCH titles.
//  · Bay pen practice trials: one dog, one hog, a minute on the clock.
//  · Sanctioned bay trials: real trial rules (every dog starts at 10.0, five
//    judges take 0.1 a fault, a 5-second hold is a catch and a DQ), Puppy Bay,
//    One Dog, Two Dog, Old & Young, the Bay Championship every February and
//    March with Best of the Best and a High Point dog; BCH, GBCH and Dual titles.
//  · Catch trials every week: three judges score the catch.
// One game day is a month (core/hd.js). DOM-free; ui/hdshows.js draws it.

import { BREEDS, STATS } from '../data/dogs.js';
import { HOOKS, ensureKennel, isAdult, catchScore, bayScore, coatRar, breedName } from './dogs.js';
import { ensureHd, RIVALS, ranchName, level, ribbon, hdLog, bump, weekOf, monthOf, yearKey, ordinal } from './hd.js';
import { merleBarred } from './hdkennel.js';
import { spend, earn, addRep } from './state.js';

const R = Math.random, ri = (a, b) => Math.floor(R() * (b - a + 1)) + a, pick = a => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const avg = a => a.reduce((t, x) => t + x, 0) / a.length;
function gauss() { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const err = text => ({ ok: false, text });
const shuffle = a => a.map(x => [R(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);

// ---------------------------------------------------------------- how a dog works a hog
// H&D's hunt style by breed (nose, voice, grit, catch...); a mix hunts like the
// blend of its ancestry.
const STYLE = {
  _: { voice: 0.6, grit: 1, catch: 0.8 },
  'Treeing Walker': { voice: 1, grit: 0.8, catch: 0.5 }, 'Plott Hound': { voice: 1, grit: 1.1, catch: 0.7 }, 'Black Mouth Cur': { voice: 0.35, grit: 1.2, catch: 0.95 },
  'Black Mountain Cur': { voice: 0.4, grit: 1.15, catch: 0.9 }, 'Mountain Cur': { voice: 0.4, grit: 1.25, catch: 0.9 }, 'Catahoula Leopard Dog': { voice: 0.45, grit: 1.2, catch: 0.8 },
  'Leopard Cur': { voice: 0.45, grit: 1.1, catch: 0.85 }, 'Blue Lacy': { voice: 0.55, grit: 1, catch: 0.7 }, 'Gordon Setter': { voice: 0.2, grit: 0.6, catch: 0.4 },
  'American Bulldog': { voice: 0.5, grit: 1.2, catch: 1.25 }, 'American Pit Bull Terrier': { voice: 0.4, grit: 1.3, catch: 1.15 }, 'Pit Bull Terrier × All Mastiff Mix': { voice: 0.45, grit: 1.3, catch: 1.24 },
  'Dogo Argentino': { voice: 0.4, grit: 1.25, catch: 1.3 }, 'Cane Corso': { voice: 0.5, grit: 1.3, catch: 1.22 }, 'German Rottweiler': { voice: 0.6, grit: 1.2, catch: 1.18 },
  'American Bully': { voice: 0.45, grit: 1.25, catch: 1.22 }, 'American English Coonhound': { voice: 1, grit: 0.85, catch: 0.5 }, 'Redbone Coonhound': { voice: 1, grit: 0.95, catch: 0.55 },
  'Black and Tan Coonhound': { voice: 1, grit: 0.85, catch: 0.5 }, 'Bluetick Coonhound': { voice: 1, grit: 0.95, catch: 0.55 }, 'Beagle': { voice: 1, grit: 0.7, catch: 0.3 },
  'Labrador Retriever': { voice: 0.4, grit: 0.9, catch: 0.75 }, 'Treeing Tennessee Brindle': { voice: 0.8, grit: 1.02, catch: 0.65 }, 'Kemmer Stock Mountain Cur': { voice: 0.5, grit: 1.2, catch: 0.85 },
  'Stephens Stock': { voice: 0.6, grit: 1.1, catch: 0.8 }, 'Florida Cracker Cur': { voice: 0.4, grit: 1.22, catch: 0.92 }, 'Jagdterrier': { voice: 0.75, grit: 1.35, catch: 0.9 },
  'Bull Arab': { voice: 0.1, grit: 1.25, catch: 1.18 }, 'Presa Canario': { voice: 0.45, grit: 1.3, catch: 1.28 }, 'Alapaha Blue Blood Bulldog': { voice: 0.45, grit: 1.22, catch: 1.22 },
};
export function huntProfile(d) {
  const anc = d.anc || { [d.breed]: 1 }, out = { voice: 0, grit: 0, catch: 0 }; let w = 0;
  for (const [b, f] of Object.entries(anc)) { const p = STYLE[b] || STYLE._; for (const k in out) out[k] += p[k] * f; w += f; }
  for (const k in out) out[k] /= w || 1;
  return out;
}
// the four things bay judges watch
export function bayTraits(d) {
  const s = d.stats, p = huntProfile(d), t = d.temp;
  return {
    grit: clamp(p.grit * (0.7 + s.sta / 300) * (t === 'Bold' || t === 'Gritty' ? 1.1 : t === 'Calm' ? 0.95 : 1), 0.3, 1.5),
    ctl: clamp(0.45 + s.obd / 200 + (1 - p.catch) * 0.45 - (t === 'Hot-headed' ? 0.15 : 0), 0.1, 1.25),
    voice: clamp(p.voice * (0.8 + s.int / 300), 0.2, 1.3),
    press: clamp((s.spd + s.str) / 140 * p.grit, 0.3, 1.4),
  };
}

// ---------------------------------------------------------------- titles
export const showTitle = d => d?.show?.title || '';
export const bayTitle = d => d?.bayT?.title || '';
export function dualTitle(d) { const a = showTitle(d), b = bayTitle(d); return a === 'GCH' && b === 'GBCH' ? 'Dual Grand Champion' : a && b ? 'Dual Champion' : ''; }
export const titles = d => [showTitle(d), bayTitle(d)].filter(Boolean).join(' ');
// titled dogs are worth 25% to 50% more
HOOKS.value.push(d => { const t = showTitle(d), b = bayTitle(d); return (t === 'GCH' ? 1.5 : t === 'CH' ? 1.25 : 1) * (b === 'GBCH' ? 1.4 : b === 'BCH' ? 1.2 : 1); });

// ---------------------------------------------------------------- dog shows
export const SHOW = {
  JUDGES: [
    { n: 'Mrs. Ada Thibodeaux', w: { build: 1.5, move: 1, coat: 0.8, temp: 0.9, cond: 0.9 }, say: 'a stickler for structure' },
    { n: 'Judge Ray Fontenot', w: { build: 1, move: 1.5, coat: 0.8, temp: 0.9, cond: 0.9 }, say: 'wants to see a dog move' },
    { n: 'Dr. Lena Broussard', w: { build: 0.9, move: 0.9, coat: 0.9, temp: 0.9, cond: 1.5 }, say: 'a vet who goes over every dog by hand' },
    { n: 'Mr. Cal Guidry', w: { build: 0.9, move: 0.9, coat: 0.8, temp: 1.5, cond: 0.9 }, say: 'hates a shy or snappy dog' },
    { n: 'Miss June Landry', w: { build: 0.9, move: 0.9, coat: 1.5, temp: 0.9, cond: 0.9 }, say: 'loves a rare, well-kept coat' },
    { n: 'Judge Earl Hebert', w: { build: 1.1, move: 1.1, coat: 1.1, temp: 1.1, cond: 1.1 }, say: 'judges the whole dog' },
  ],
  TIERS: { local: { n: 'Local show', fee: 120, pts: 1, mult: 1, diff: 0 }, regional: { n: 'Regional show', fee: 300, pts: 3, mult: 2.2, diff: 6 }, national: { n: 'National', fee: 800, pts: 5, mult: 5, diff: 12 } },
  PRIZE: { cls: [600, 300, 150], bob: 400, big: 1000, bis: 3000 },
  HANDLER: 500,
  PREP: {
    bath: { n: 'Bath & blow-out', ic: '🛁', cost: 40, days: 2, coat: 6, d: 'Clean, shiny coat for two days.' },
    trim: { n: 'Nails, ears & trim', ic: '✂️', cost: 80, days: 4, coat: 5, cond: 3, d: 'Neat and finished for four days.' },
    feed: { n: 'Conditioning feed plan', ic: '🥩', cost: 120, days: 7, cond: 8, d: 'A week of high-protein feed: harder muscle, better weight.' },
    ring: { n: 'Ring practice', ic: '🦮', cost: 0, energy: 10, d: 'Practice gaiting and stacking. Builds ring skill for good (up to 100).' },
  },
};
export function showsThisWeek(day) { const w = weekOf(day); return ['local', ...(w % 4 === 3 ? ['regional'] : []), ...(w % 12 === 11 ? ['national'] : [])]; }
export const showJudge = (day, tier) => SHOW.JUDGES[(weekOf(day) * 3 + (tier === 'regional' ? 1 : tier === 'national' ? 2 : 0)) % SHOW.JUDGES.length];
export const showClass = d => `${d.age < 12 ? 'Puppy' : d.age < 24 ? 'Junior' : 'Open'} ${d.sex === 'M' ? 'dogs' : 'bitches'}`;
export function showGroup(d) { if (d.breed === 'Cross') return 'Mixed breed'; const r = BREEDS[d.breed]?.role; return r === 'catch' ? 'Catch' : /Coonhound|Walker|Plott|Beagle|Brindle/.test(d.breed) ? 'Hound' : 'Cur'; }
export const showRec = d => d.show ??= { pts: 0, majors: 0, bob: 0, wins: 0, entered: {}, title: '', hist: [] };
export function showPrep(s, d) { const p = d.sprep ??= {}; for (const k in p) if (p[k] && p[k].until < s.time.day) delete p[k]; return p; }
const breedBase = b => BREEDS[b] ? avg(BREEDS[b].pot) : 62;
export function buildGrade(d) {
  if ((d.hcap || 100) < 100) return { k: 'defect', label: 'Unsound' };
  const std = d.anc ? Object.entries(d.anc).reduce((t, [b, f]) => t + breedBase(b) * f, 0) / (Object.values(d.anc).reduce((t, f) => t + f, 0) || 1) : breedBase(d.breed);
  const q = avg(Object.values(d.pot)) - std;
  return q >= 6 ? { k: 'good', label: 'Well built' } : q <= -6 ? { k: 'poor', label: 'Poorly built' } : { k: 'std', label: 'Breed standard' };
}
export function doShowPrep(s, id, k) {
  const d = ensureKennel(s).dogs.find(x => x.id === id), P = SHOW.PREP[k];
  if (!d || !P) return err('No such dog.');
  if (k === 'ring') {
    if (d.energy < P.energy) return err(`${d.name} is too tired to practice.`);
    d.energy -= P.energy; d.ring = Math.min(100, (d.ring || 20) + 6 + R() * 4);
    return { ok: true, text: `${d.name} practiced in the ring: ring skill ${Math.round(d.ring)}.` };
  }
  if (!spend(s, P.cost, `${P.n}: ${d.name}`)) return err('Not enough money.');
  showPrep(s, d)[k] = { until: s.time.day + P.days };
  return { ok: true, text: `${P.n} for ${d.name}.` };
}
export function scoreCard(s, d, J) {
  const p = showPrep(s, d), bg = buildGrade(d).k, st = d.stats, pot = x => clamp(x, 0, 100);
  const prepC = (p.bath ? SHOW.PREP.bath.coat : 0) + (p.trim ? SHOW.PREP.trim.coat : 0), prepK = (p.trim ? SHOW.PREP.trim.cond : 0) + (p.feed ? SHOW.PREP.feed.cond : 0);
  const c = {
    build: pot({ good: 82, std: 66, poor: 46, defect: 20 }[bg] + (avg(Object.values(d.pot)) - 60) * 0.25),
    move: pot(st.spd * 0.45 + st.sta * 0.25 + st.obd * 0.15 + (d.ring || 20) * 0.15),
    coat: pot(40 + coatRar(d) * 9 + prepC * 1.5 + (d.mut ? 6 : 0)),
    temp: pot(st.obd * 0.6 + 60 * 0.3 + (d.ring || 20) * 0.1),
    cond: pot(d.health * 0.55 + d.energy * 0.2 + prepK * 2 + (d.health < 50 ? -25 : 0)),
  };
  const tot = Object.keys(c).reduce((a, k) => a + c[k] * J.w[k], 0) / Object.values(J.w).reduce((a, b) => a + b, 0);
  return { c, tot };
}
function judgeNotes(c, J) {
  const best = Object.entries(c).sort((a, b) => b[1] - a[1]), lo = best[best.length - 1], W = { build: 'structure', move: 'movement', coat: 'coat', temp: 'temperament', cond: 'condition' };
  return `${J.n.split(' ').slice(-1)[0]}: "Lovely ${W[best[0][0]]}${best[1][1] > 70 ? ' and ' + W[best[1][0]] : ''}. ${lo[1] < 55 ? `Needs work on ${W[lo[0]]}.` : 'Little to fault.'}"`;
}
// the ring: how you gait, stack and bait the dog, against what this dog is like
function ringWork(d, ch, pro) {
  const obd = d.stats.obd, spd = d.stats.spd, skill = (d.ring || 20) / 100, why = []; let b = 0;
  if (ch.gait === 'brisk') { const ok = spd > 60 && obd > 45; b += ok ? 4 : -2; why.push(ok ? 'moved out beautifully at a brisk trot' : 'broke stride going too fast'); }
  else if (ch.gait === 'steady') { b += 2; why.push('moved steady and true'); }
  else { b += obd < 45 ? 2 : -1; why.push(obd < 45 ? 'stayed under control at a slow walk' : 'looked flat at a slow walk'); }
  if (ch.stack === 'free') { b += obd > 60 ? 4 : -3; why.push(obd > 60 ? 'free-stacked like a statue' : 'would not hold a free stack'); }
  else { b += 1 + skill * 2; why.push('hand-stacked square'); }
  if (ch.bait === 'bait') { b += 2; why.push('kept its eyes on the bait'); }
  else if (ch.bait === 'toy') { b += obd > 50 ? 3 : -2; why.push(obd > 50 ? 'ears up for the squeaky toy' : 'got silly over the squeaky toy'); }
  else { b += obd > 70 ? 3 : -1; why.push(obd > 70 ? 'showed itself off with no help' : 'lost interest without bait'); }
  b += skill * 3 + (R() - 0.5) * 3;
  if (pro) { b = Math.max(b, 0) + 6; why.unshift('the pro handler showed it to its best'); }
  return { b, why };
}
export function enterShow(s, id, tier, ch = {}) {
  const d = ensureKennel(s).dogs.find(x => x.id === id), T = SHOW.TIERS[tier], day = s.time.day;
  if (!d || !T || !showsThisWeek(day).includes(tier)) return err('That show isn\'t on this week.');
  if (d.age < 6) return err('Pups can show from 6 months.');
  if (merleBarred(d)) return err(`Merle is a disqualification in the ${d.breed} standard. The judge won't see ${d.name} in the ring.`);
  const R0 = showRec(d), key = tier + weekOf(day);
  if (R0.entered[key]) return err(`${d.name} already showed at this week's ${T.n.toLowerCase()}.`);
  const pro = !!ch.pro, fee = T.fee + (pro ? SHOW.HANDLER : 0);
  if (!spend(s, fee, `${T.n} entry: ${d.name}`)) return err('Not enough money.');
  R0.entered[key] = 1;
  const J = showJudge(day, tier), sc = scoreCard(s, d, J), rg = ringWork(d, ch, pro), mine = sc.tot + rg.b, M = T.mult, lv = level(s);
  const rival = () => 58 + T.diff + gauss() * 8 + lv * 0.6;
  const field = shuffle(RIVALS).slice(0, 5).map(n => ({ n, s: rival() }));
  field.push({ n: ranchName(s), s: mine, me: 1 }); field.sort((a, b) => b.s - a.s);
  const place = field.findIndex(x => x.me) + 1;
  const res = { tier, day, judge: J.n, cls: showClass(d), place, score: Math.round(mine), c: Object.fromEntries(Object.entries(sc.c).map(([k, v]) => [k, Math.round(v)])), notes: judgeNotes(sc.c, J), ring: rg.why, rounds: [], won: 0, pts: 0, title: '' };
  if (place <= 3) res.won += Math.round(SHOW.PRIZE.cls[place - 1] * M);
  if (place === 1) {
    res.pts += T.pts; R0.wins++;
    const beat = x => mine + gauss() * 4 > rival() + x;
    for (const [r, lbl, x, prize] of [['bob', 'Best of Breed', 3, SHOW.PRIZE.bob], ['big', `Best in Group (${showGroup(d)})`, 7, SHOW.PRIZE.big], ['bis', 'Best in Show', 11, SHOW.PRIZE.bis]]) {
      const ok = beat(x); res.rounds.push([lbl, ok]);
      if (!ok) break;
      res.won += Math.round(prize * M); res.pts += r === 'bob' ? 1 : r === 'big' ? 2 : 3;
      if (r === 'bob') R0.bob++;
    }
    if (tier !== 'local') R0.majors++;
  }
  R0.pts += res.pts;
  if (res.won) earn(s, res.won, `${T.n}: ${d.name} placed ${ordinal(place)}`);
  const was = R0.title;
  if (!R0.title && R0.pts >= 15 && R0.majors >= 2) { R0.title = 'CH'; R0.chPts = R0.pts; }
  else if (R0.title === 'CH' && R0.pts - (R0.chPts || 0) >= 25 && R0.bob >= 3) R0.title = 'GCH';
  res.title = R0.title !== was ? R0.title : '';
  R0.hist.unshift(res); R0.hist.length = Math.min(R0.hist.length, 12);
  if (place <= 3) ribbon(s, { at: T.n, ev: 'show', place, who: d.name });
  bump(s, 'shows'); if (res.rounds.some(r => r[0] === 'Best in Show' && r[1])) bump(s, 'bis');
  if (res.pts) addRep(s, res.pts * 15, `${d.name} won at the ${T.n.toLowerCase()}`);
  hdLog(s, `${T.n}: ${d.name} placed ${ordinal(place)} in ${res.cls}${res.rounds.filter(r => r[1]).length ? ', ' + res.rounds.filter(r => r[1]).map(r => r[0]).join(', ') : ''}${res.title ? `. ${d.name} is now a ${res.title === 'CH' ? 'Champion' : 'Grand Champion'}!` : '.'}`);
  return { ok: true, res, dog: d, text: `${d.name} placed ${ordinal(place)} of 6${res.won ? ` and won $${res.won.toLocaleString()}` : ''}.` };
}

// ---------------------------------------------------------------- bay pen practice trial
export const BAYT = { FEE: 200, PRIZE: [1600, 800, 400], SECS: 60 };
export const bayOk = (s, d) => isAdult(d) && d.health >= 50 && d.energy >= 20 && d.lastBayT !== s.time.day;
export function startBayPractice(s, id) {
  const d = ensureKennel(s).dogs.find(x => x.id === id);
  if (!d || !bayOk(s, d)) return err('That dog can\'t run today.');
  if (!spend(s, BAYT.FEE, `Bay pen trial entry: ${d.name}`)) return err('Not enough money.');
  d.energy -= 20; d.lastBayT = s.time.day;
  return { ok: true, B: { dog: d.id, ids: [d.id], name: d.name, t: 0, tr: bayTraits(d), m: { grit: 0, ctl: 10, voice: 0, press: 0 }, log: [], ang: 0, rad: 60, grab: 0, charge: 0, done: false, seed: ri(1, 1e6) } };
}
// one second of the pen
export function bayTick(B) {
  const T = B.tr; B.t++;
  B.ang += (0.3 + R() * 0.5) * (R() < 0.5 ? -1 : 1);
  B.rad = clamp(B.rad + (R() - 0.5) * 12 - (T.press - 0.8) * 6, 28, 80);
  if (R() < 0.16) {
    B.charge = 4;
    if (R() < T.grit * 0.72) { B.m.grit += 1.2; B.log.unshift(`${B.t}s  The hog charged and ${B.name} stood in its face.`); B.rad = Math.max(24, B.rad - 12); }
    else { B.m.grit -= 0.8; B.log.unshift(`${B.t}s  The hog charged and ${B.name} gave ground.`); B.rad = Math.min(90, B.rad + 25); }
  }
  if (R() < (1.2 - T.ctl) * 0.07) { B.m.ctl -= 2; B.grab = 3; B.log.unshift(`${B.t}s  ${B.name} GRABBED the hog. The judges mark it down.`); }
  B.m.voice += T.voice * (0.6 + R() * 0.5) / (BAYT.SECS / 14);
  B.m.press += (T.press * (1 - B.rad / 120) + R() * 0.2) / (BAYT.SECS / 12);
  if (B.charge > 0) B.charge--; if (B.grab > 0) B.grab--;
}
export const bayMarks = B => { const c = x => Math.round(clamp(x, 0, 10) * 10) / 10; return { grit: c(5 + B.m.grit), ctl: c(B.m.ctl), voice: c(B.m.voice), press: c(B.m.press) }; };
export function finishBayPractice(s, B) {
  B.done = true;
  const M = bayMarks(B), tot = Math.round((M.grit + M.ctl + M.voice + M.press) * 10) / 10, lv = 1 + level(s) * 0.02;
  const field = Array.from({ length: 7 }, () => ({ n: pick(RIVALS), s: Math.round(clamp(gauss() * 4.5 + 23 * lv, 8, 39) * 10) / 10 }));
  const all = [{ n: ranchName(s), s: tot, me: 1 }, ...field].sort((a, b) => b.s - a.s), place = all.findIndex(x => x.me) + 1, prize = BAYT.PRIZE[place - 1] || 0;
  Object.assign(B, { M, tot, field: all, place, prize });
  if (prize) earn(s, prize, `Bay pen trial: ${B.name} placed ${ordinal(place)}`);
  const d = ensureKennel(s).dogs.find(x => x.id === B.dog);
  if (d) { d.hunt.xp += Math.round(tot / 2); d.hunt.trials = (d.hunt.trials || 0) + 1; if (place === 1) d.hunt.trialWins = (d.hunt.trialWins || 0) + 1; if (R() < 0.5 && d.stats.obd < d.pot.obd) d.stats.obd++; }
  bump(s, 'bayTrials');
  if (place <= 3) ribbon(s, { at: 'Bay pen trial', ev: 'bay', place, who: B.name });
  hdLog(s, `Bay pen trial: ${B.name} scored ${tot}/40, placed #${place}${prize ? `, won $${prize}` : ''}.`);
  return B;
}

// ---------------------------------------------------------------- sanctioned bay trials
export const BAYC = {
  SECS: 120,
  CLASSES: {
    pup: { n: 'Puppy Bay', dogs: 1, d: 'Pups 6 to 18 months old.' },
    one: { n: 'One Dog', dogs: 1, d: 'One adult dog on the hog.' },
    two: { n: 'Two Dog', dogs: 2, d: 'Two adult dogs working the hog together.' },
    oy: { n: 'Old & Young', dogs: 2, d: 'A dog under 2 years with a dog over 4.' },
    bob: { n: 'Best of the Best', dogs: 1, d: 'Championship only: dogs that won a class this championship.' },
  },
  FEE: { week: 240, champ: 500 }, PRIZE: { week: [1200, 600, 300], champ: [5000, 2400, 1200] }, HP: 3000,
};
export const champSeason = day => [1, 2].includes(monthOf(day));      // February and March
const bayStore = s => { const h = ensureHd(s), b = h.bayc ??= {}; b.hp ??= {}; b.won ??= {}; b.paid ??= {}; return b; };
export const bayRec = d => d.bayT ??= { runs: 0, wins: 0, after: 0, dq: 0, best: 0, title: '' };
export function bayClassOk(s, d, c) {
  if (!d || d.health < 50 || d.energy < 20) return false;
  if ((d.lastBayC || {})[c] === s.time.day) return false;
  if (c === 'pup') return d.age >= 6 && d.age < 18;
  if (c === 'bob') return champSeason(s.time.day) && !!bayStore(s).won[yearKey(s.time.day) + ':' + d.id];
  return d.age >= 12;
}
export function bayClassWhy(s, d, c) {
  if ((d.lastBayC || {})[c] === s.time.day) return 'Ran this class today';
  if (d.health < 50 || d.energy < 20) return 'Tired or hurt';
  if (c === 'pup') return d.age < 6 ? 'Too young' : d.age >= 18 ? 'Too old for Puppy Bay' : '';
  if (c === 'bob') return 'Needs a class win this championship';
  return d.age < 12 ? 'Not grown yet' : '';
}
// two dogs on one hog cover each other's silences; either one can grab
function pairTraits(T1, T2) { if (!T2) return T1; return { grit: (T1.grit + T2.grit) / 2, ctl: Math.min(T1.ctl, T2.ctl) * 0.6 + (T1.ctl + T2.ctl) / 2 * 0.4, voice: Math.max(T1.voice, T2.voice), press: Math.min(1.4, (T1.press + T2.press) / 2 * 1.12) }; }
export function startSanctioned(s, c, ids) {
  const C = BAYC.CLASSES[c], k = ensureKennel(s), dogs = ids.slice(0, C.dogs).map(id => k.dogs.find(x => x.id === id)).filter(Boolean);
  if (dogs.length !== C.dogs) return err(C.dogs === 2 ? 'Pick two dogs.' : 'Pick a dog.');
  if (dogs.some(d => !bayClassOk(s, d, c))) return err('One of those dogs can\'t run this class today.');
  if (c === 'oy') { const a = dogs.map(d => d.age).sort((x, y) => x - y); if (!(a[0] < 24 && a[1] >= 48)) return err('Old & Young needs a dog under 2 years and one over 4.'); }
  const ch = champSeason(s.time.day), fee = ch ? BAYC.FEE.champ : BAYC.FEE.week;
  if (!spend(s, fee, `${ch ? 'Bay Championship' : 'Sanctioned bay trial'} entry (${C.n})`)) return err('Not enough money.');
  for (const d of dogs) { d.energy -= 20; (d.lastBayC ??= {})[c] = s.time.day; }
  const T = pairTraits(bayTraits(dogs[0]), dogs[1] && bayTraits(dogs[1]));
  return { ok: true, B: {
    champ: { c, ch, ids: dogs.map(d => d.id), J: [0, 0, 0, 0, 0], faults: [], silent: 0, hold: 0, dq: '', cat: Math.max(...dogs.map(d => huntProfile(d).catch)), voice: dogs.map(d => bayTraits(d).voice) },
    dog: dogs[0].id, ids: dogs.map(d => d.id), name: dogs.map(d => d.name).join(' & '), t: 0, tr: T, m: { grit: 0, ctl: 10, voice: 0, press: 0 }, log: [], ang: 0, rad: 60, grab: 0, charge: 0, done: false, seed: ri(1, 1e6),
  } };
}
// a fault: each of the five judges marks it (they don't all catch everything)
function fault(B, why) {
  const K = B.champ; let seen = 0;
  K.J = K.J.map(j => { if (R() < 0.86) { seen++; return j + 1; } return j; });
  K.faults.push(why);
  if (seen) B.log.unshift(`${B.t}s  −0.1  ${why}${seen < 5 ? ` (${seen} of 5 judges)` : ''}`);
}
export const sanctionedScore = B => Math.round(B.champ.J.reduce((a, j) => a + Math.max(0, 10 - j * 0.1), 0) / B.champ.J.length * 100) / 100;
export function sanctionedTick(B) {
  const K = B.champ, T = B.tr, n0 = B.log.length;
  bayTick(B);
  const fresh = B.log.slice(0, B.log.length - n0).join(' ');
  if (/gave ground/.test(fresh)) fault(B, 'let the hog move');
  if (/GRABBED/.test(fresh)) { fault(B, 'touched the hog'); if (R() < clamp((K.cat - 0.5) * 0.8, 0.05, 0.6)) K.hold = 1; }
  else if (K.hold) {
    if (R() < clamp(0.5 + (K.cat - 1) * 0.6, 0.3, 0.75)) { K.hold++; if (K.hold >= 5) { K.dq = 'held the hog 5 seconds: that\'s a catch'; B.log.unshift(`${B.t}s  DISQUALIFIED: ${B.name} caught the hog and held on.`); return; } }
    else { K.hold = 0; B.log.unshift(`${B.t}s  Let go of the hog.`); }
  }
  if (!K.hold) { if (R() < (1.25 - T.ctl) * 0.11) fault(B, 'looked off the hog'); if (B.rad > 66 && R() < 0.12) fault(B, 'stood off more than 5 feet'); }
  const bark = 1 - K.voice.reduce((p, v) => p * (1 - clamp(0.45 + v * 0.45, 0.3, 0.97)), 1);
  if (R() < bark) K.silent = 0; else if (++K.silent >= 5) { K.silent = 0; fault(B, 'went 5 seconds without barking'); }
}
export const sanctionedOver = B => B.t >= BAYC.SECS || !!B.champ.dq;
export function finishSanctioned(s, B) {
  B.done = true;
  const K = B.champ, C = BAYC.CLASSES[K.c], sc = K.dq ? 0 : sanctionedScore(B), lv = level(s) * 0.12, diff = (K.ch ? 2.5 : 0) + (K.c === 'bob' ? 3 : 0) - (K.c === 'pup' ? 3 : 0);
  const field = Array.from({ length: K.ch ? 11 : 7 }, () => { const f = Math.max(1, Math.round(15 - lv - diff + gauss() * 4)); return { n: pick(RIVALS), s: R() < 0.06 ? 0 : Math.round((10 - f * 0.1) * 100) / 100 }; });
  const all = [{ n: ranchName(s), s: sc, me: 1 }, ...field].sort((a, b) => b.s - a.s || (a.me ? -1 : 1));
  const place = K.dq ? all.length : all.findIndex(x => x.me) + 1, P = K.ch ? BAYC.PRIZE.champ : BAYC.PRIZE.week, prize = K.dq ? 0 : (P[place - 1] || 0);
  Object.assign(B, { tot: sc, field: all, place, prize, newT: [] });
  if (prize) earn(s, prize, `${K.ch ? 'Bay Championship' : 'Sanctioned bay trial'}: ${B.name} placed ${ordinal(place)}`);
  const k = ensureKennel(s), st = bayStore(s), yk = yearKey(s.time.day);
  for (const d of K.ids.map(id => k.dogs.find(x => x.id === id)).filter(Boolean)) {
    const r = bayRec(d); r.runs++; if (K.dq) r.dq++; r.best = Math.max(r.best || 0, sc);
    d.hunt.xp += Math.round(sc * 2); d.hunt.trials = (d.hunt.trials || 0) + 1;
    if (place === 1 && !K.dq) {
      d.hunt.trialWins = (d.hunt.trialWins || 0) + 1;
      if (r.title) r.after++; else r.wins++;
      if (K.ch && K.c !== 'bob') st.won[yk + ':' + d.id] = 1;
      if (K.ch) r.chWin = 1;
      const was = r.title;
      if (!r.title && r.wins >= 5) r.title = 'BCH'; else if (r.title === 'BCH' && r.after >= 8 && r.chWin) r.title = 'GBCH';
      if (r.title !== was) B.newT.push({ name: d.name, title: r.title, dual: dualTitle(d) });
    }
    if (K.ch && !K.dq && place <= 3) { const key = yk + ':' + d.id; st.hp[key] = (st.hp[key] || 0) + [10, 7, 5][place - 1]; }
  }
  bump(s, 'bayTrials');
  if (place <= 3 && !K.dq) ribbon(s, { at: K.ch ? 'Bay Championship' : 'Sanctioned bay trial', ev: 'bay', place, who: B.name });
  hdLog(s, `${K.ch ? 'Bay Championship' : 'Sanctioned bay trial'} (${C.n}): ${B.name} ${K.dq ? 'was disqualified for a catch' : `scored ${sc.toFixed(2)} and placed #${place}${prize ? `, won $${prize.toLocaleString()}` : ''}`}.${B.newT.map(t => ` ${t.name} is now a ${t.title === 'BCH' ? 'Bay Champion' : 'Grand Bay Champion'}!`).join('')}`);
  return B;
}
// after championship season the High Point dog is paid once
export function settleHighPoint(s) {
  const st = bayStore(s), cur = yearKey(s.time.day), k = ensureKennel(s), out = [];
  const ys = [...new Set(Object.keys(st.hp).map(x => x.split(':')[0]))].filter(y => !st.paid[y] && !(y === cur && champSeason(s.time.day)));
  for (const y of ys) {
    st.paid[y] = 1;
    const [key, p] = Object.entries(st.hp).filter(([x]) => x.startsWith(y + ':')).sort((a, b) => b[1] - a[1])[0], d = k.dogs.find(x => x.id === key.split(':')[1]);
    if (p >= 17 && d) { earn(s, BAYC.HP, `Bay Championship High Point dog: ${d.name}`); out.push(`🏆 ${d.name} is the High Point dog of the Bay Championship (${p} points): $${BAYC.HP.toLocaleString()}.`); }
  }
  return out;
}
export const highPointRace = s => { const st = bayStore(s), y = yearKey(s.time.day), k = ensureKennel(s); return Object.entries(st.hp).filter(([x]) => x.startsWith(y + ':')).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([x, p]) => ({ name: k.dogs.find(d => d.id === x.split(':')[1])?.name || '—', p })); };

// ---------------------------------------------------------------- catch trials
export const CTRIAL = { FEE: 200, PRIZE: [4000, 2000, 800] };
export const catchPool = s => ensureKennel(s).dogs.filter(d => isAdult(d) && d.health >= 50 && catchScore(d) >= bayScore(d) * 0.8);
export const catchThisWeek = s => { const h = ensureHd(s), w = weekOf(s.time.day); if (h.ctrial?.wk !== w) h.ctrial = { wk: w }; return h.ctrial; };
export function enterCatchTrial(s, id) {
  const T = catchThisWeek(s);
  if (T.res) return err('You already ran a dog in this week\'s catch trial.');
  const d = ensureKennel(s).dogs.find(x => x.id === id);
  if (!d) return err('Pick a catch dog.');
  if (!spend(s, CTRIAL.FEE, `Catch trial entry: ${d.name}`)) return err('Not enough money.');
  const sc = () => clamp(catchScore(d) * 0.55 + d.stats.grip * 0.25 + d.stats.str * 0.12 + d.stats.obd * 0.08 + gauss() * 6, 10, 100);
  const judges = [sc(), sc(), sc()].map(Math.round), mine = avg(judges);
  const field = shuffle(RIVALS).slice(0, 7).map(n => ({ n, s: 52 + gauss() * 9 + level(s) * 1.2 }));
  field.push({ n: ranchName(s), s: mine, me: 1 }); field.sort((a, b) => b.s - a.s);
  const place = field.findIndex(x => x.me) + 1;
  T.res = { dog: d.name, judges, place, field: field.slice(0, 5).map(x => ({ n: x.me ? `${ranchName(s)} (${d.name})` : x.n, s: Math.round(x.s), me: !!x.me })) };
  let text = `Catch trial: ${d.name} scored ${judges.join(' / ')} and placed ${ordinal(place)}.`;
  if (place <= 3) { const v = CTRIAL.PRIZE[place - 1]; earn(s, v, `Catch trial: ${d.name} placed ${ordinal(place)}`); text += ` Won $${v.toLocaleString()}!`; ribbon(s, { at: 'Catch trials', ev: 'catch', place, who: d.name }); }
  d.stats.grip = Math.min(d.pot.grip, d.stats.grip + 1);
  bump(s, 'catchTrials'); hdLog(s, text);
  return { ok: true, text, res: T.res };
}
export { breedName };
