// The rest of the Hogs & Dogs ranch life: hunting gear (rifle, thermal, UTV,
// hog cage, CB radio), trail cams on the leases, corral traps on your land,
// landowner jobs, the trophy wall, and registration papers for your dogs.
// DOM-free.

import { HOGS, GROUND_BY_ID, HUNT_GROUNDS } from '../data/dogs.js';
import { LAND } from '../data/estate.js';
import { HOGG } from '../gfx2d/hogArt.js';
import { ensureHd, hdLog, bump, RIVALS, level } from './hd.js';
import { HOOKS, ensureKennel } from './dogs.js';
import { AFTER } from './hoghunt.js';
import { pinRoom, pinHogs, procPrice } from './hogpin.js';
import { spend, earn, earnBank, addRep } from './state.js';

const R = Math.random, ri = (a, b) => Math.floor(R() * (b - a + 1)) + a, pick = a => a[Math.floor(R() * a.length)];
const err = text => ({ ok: false, text });
const $ = n => '$' + Math.round(n).toLocaleString();

// ---------------------------------------------------------------- gear
export const GEAR = {
  rifle:   { name: 'Hog rifle',       price: 1800, icon: '🎯', desc: 'For night hunts: a clean shot on a bayed hog inside 40 m. Shot hogs only go to the processor.' },
  thermal: { name: 'Thermal scope',   price: 3200, icon: '🌡️', desc: 'Night hunts: see every hog within 70 m, hidden or not.' },
  utv:     { name: 'Side-by-side UTV', price: 9500, icon: '🛻', desc: 'Ride the lease instead of walking. You get to the bay a lot faster.' },
  cb:      { name: 'CB radio + GPS',  price: 650,  icon: '📻', desc: 'Turn the catch dogs loose from 70 m instead of 45.' },
  cage:    { name: 'Hog cage trailer', price: 2400, icon: '🚚', desc: 'Haul hogs alive: the live buyer pays 10% more.' },
};
export const gear = s => ensureHd(s).gear ??= {};
export const hasGear = (s, k) => !!gear(s)[k];
export function buyGear(s, k) {
  const G = GEAR[k]; if (!G) return err('No such gear.');
  if (hasGear(s, k)) return err(`You already have the ${G.name.toLowerCase()}.`);
  if (!spend(s, G.price, `Hunting gear: ${G.name}`)) return err(`You need ${$(G.price)}.`);
  gear(s)[k] = s.time.day;
  return { ok: true, text: `Bought the ${G.name.toLowerCase()}.` };
}
// what startHunt gets from your gear
export const huntOpts = (s, mode) => ({ mode, rifle: hasGear(s, 'rifle'), thermal: hasGear(s, 'thermal'), utv: hasGear(s, 'utv'), cb: hasGear(s, 'cb') });

// ---------------------------------------------------------------- trail cams
export const CAM_PRICE = 350;
export const cams = s => ensureHd(s).cams ??= {};
export function buyCam(s, groundId) {
  const g = GROUND_BY_ID[groundId]; if (!g) return err('No such lease.');
  if (cams(s)[groundId]) return err(`There's already a camera on ${g.name}.`);
  if (!spend(s, CAM_PRICE, `Trail camera: ${g.name}`)) return err(`A trail cam is ${$(CAM_PRICE)}.`);
  cams(s)[groundId] = { since: s.time.day, shots: [] };
  return { ok: true, text: `Strapped a trail cam to a post oak on ${g.name}.` };
}
// the giant boar showed up on this lease's camera in the last few days
export const giantSeen = (s, groundId) => { const c = cams(s)[groundId]; return !!(c?.giant && s.time.day - c.giant <= 5); };
function camDay(s, notes) {
  for (const [id, c] of Object.entries(cams(s))) {
    const g = GROUND_BY_ID[id]; if (!g) continue;
    const tot = g.hogs.reduce((t, [, w]) => t + w, 0), seen = {};
    for (let i = ri(1, g.count + 2); i > 0; i--) { let r = R() * tot, k = g.hogs[0][0]; for (const [kk, w] of g.hogs) { r -= w; if (r < 0) { k = kk; break; } } seen[k] = (seen[k] || 0) + 1; }
    const gp = (g.tier || 1) >= 3 ? 0.06 : 0.02;
    if (R() < gp) { seen.giant = 1; c.giant = s.time.day; notes.push(`📷 The trail cam on ${g.name} caught the giant boar! Hunt there in the next 5 days.`); }
    c.shots.unshift({ day: s.time.day, seen }); c.shots.length = Math.min(c.shots.length, 6);
  }
}

// ---------------------------------------------------------------- corral traps
export const TRAP_PRICE = 1500;
export const traps = s => ensureHd(s).traps ??= {};
export function buyTrap(s, landId) {
  const l = s.estate?.land?.[landId];
  if (!l?.owned || !LAND[landId]) return err('Set traps on land you own.');
  if (traps(s)[landId]) return err('There\'s already a corral trap there.');
  if (!spend(s, TRAP_PRICE, `Corral trap: ${LAND[landId].short || LAND[landId].name}`)) return err(`A corral trap is ${$(TRAP_PRICE)}.`);
  traps(s)[landId] = { since: s.time.day, caught: 0 };
  return { ok: true, text: 'Corral trap built and baited with corn.' };
}
function trapDay(s, notes) {
  for (const [id, t] of Object.entries(traps(s))) {
    if (!s.estate?.land?.[id]?.owned) { delete traps(s)[id]; continue; }
    if (R() > (LAND[id]?.country ? 0.35 : 0.15)) continue;
    let n = ri(1, 3), kept = 0, sold = 0, pay = 0;
    while (n-- > 0) {
      const w = ri(40, 140), seed = ri(1, 2e9);
      if (pinRoom(s) > 0) { const h = HOGG.fromWild({ seed, key: 'feral', w, sp: 1, end: 1, aggr: 0.5, day: s.time.day, area: 'trap' }); h.from = `Corral trap, day ${s.time.day}`; pinHogs(s).push(h); kept++; }
      else { pay += procPrice({ w, kind: 'feral' }); sold++; }
    }
    t.caught += kept + sold;
    if (pay) earnBank(s, pay, `Joshua Wild Game Processing: ${sold} trapped hog${sold > 1 ? 's' : ''}`);
    notes.push(`🪤 The corral trap on ${LAND[id].short || LAND[id].name} caught ${kept + sold} hog${kept + sold > 1 ? 's' : ''}${kept ? `, ${kept} into the Hog Pin` : ''}${sold ? `, ${sold} sold for ${$(pay)}` : ''}.`);
  }
}

// ---------------------------------------------------------------- landowner jobs
const RANCHERS = ['Earl Pruitt', 'Dottie Haskins', 'Wade McBride', 'the Alvarado ISD ag barn', 'Ray Teague', 'Bonnie Kowalski', 'Hector Salinas', 'the Rio Vista Baptist church', 'Lyle Brumley', 'Gus Pena'];
export const jobs = s => { const h = ensureHd(s); h.jobs ??= { board: [], active: [], day: -99, done: 0 }; return h.jobs; };
export function jobBoard(s) {
  const J = jobs(s);
  if (s.time.day - J.day >= 4 || !J.board.length) {
    J.day = s.time.day; J.board = [];
    for (let i = 0; i < 3; i++) {
      const g = pick(HUNT_GROUNDS.filter(x => !x.trip)), need = ri(2, 3 + (g.tier || 1)), days = ri(3, 6);
      J.board.push({ id: `J${s.time.day}-${i}`, who: pick(RANCHERS), ground: g.id, need, days, pay: Math.round((need * 450 + (g.tier || 1) * 600) / 50) * 50 });
    }
  }
  return J.board;
}
export function takeJob(s, id) {
  const J = jobs(s), j = J.board.find(x => x.id === id);
  if (!j) return err('That job is gone.');
  if (J.active.length >= 2) return err('Finish a job first. Two at a time.');
  J.board = J.board.filter(x => x !== j);
  J.active.push({ ...j, got: 0, due: s.time.day + j.days });
  return { ok: true, text: `${j.who} wants ${j.need} hogs off ${GROUND_BY_ID[j.ground].name} by day ${s.time.day + j.days}. The lease fee is on them.` };
}
// the lease is free while you have a job there
export const jobOn = (s, groundId) => jobs(s).active.find(j => j.ground === groundId) || null;
AFTER.push((s, h, sum) => {
  if (h.game) return;
  const J = jobs(s), n = sum.hogs.length, msgs = sum.jobNotes = [];
  for (const j of [...J.active]) {
    if (j.ground !== h.ground || !n) continue;
    j.got += n;
    if (j.got >= j.need) {
      earn(s, j.pay, `Hog job for ${j.who}`); addRep(s, 120, `Cleared hogs for ${j.who}`); J.done++; bump(s, 'jobs');
      J.active = J.active.filter(x => x !== j);
      msgs.push(`Job done for ${j.who}: paid ${$(j.pay)}.`); hdLog(s, msgs.at(-1));
    } else msgs.push(`${j.who}'s job: ${j.got} of ${j.need} hogs.`);
  }
});
function jobsDay(s, notes) {
  const J = jobs(s);
  for (const j of [...J.active]) if (s.time.day > j.due) { J.active = J.active.filter(x => x !== j); notes.push(`📋 ${j.who} gave the hog job to somebody else. You ran out of days.`); }
}

// ---------------------------------------------------------------- trophy wall
// big hogs and game are kept with the hog's seed, so the mount is that exact hog
export const trophies = s => ensureHd(s).trophies ??= [];
AFTER.push((s, h, sum) => {
  const L = trophies(s);
  for (const b of sum.hogs) {
    const H = HOGS[b.kind], big = H.game ? (H.rar >= 2) : (b.w >= 250 || b.kind === 'giant' || b.kind === 'ghost');
    if (!big) continue;
    L.push({ kind: b.kind, w: b.w, seed: b.seed, sex: b.sex, name: H.name, day: s.time.day, ground: sum.ground?.name, dogs: sum.dogs.filter(d => d.bays || d.catches).map(d => d.name).join(' & ') });
    if (b.kind === 'giant') { addRep(s, 500, 'Caught the giant boar'); bump(s, 'giants'); }
  }
  L.sort((a, b) => b.w - a.w); if (L.length > 16) L.length = 16;
});
// a mount for the wall: the hog rebuilt from its seed
export function mount(t, i) {
  if (HOGS[t.kind]?.game) return null;
  const key = t.kind === 'giant' ? 'russian' : t.kind;
  const h = HOGG.fromWild({ seed: t.seed || 1, key, w: t.w, sp: 1, end: 1, aggr: 0.5, sex: t.sex || 'M', day: t.day, area: 'mount' });
  h.id = `TR-${i}-${t.seed}`; h.name = `${t.w} lb ${t.name}`;
  return h;
}

// ---------------------------------------------------------------- papers
export const PAPERS_FEE = 250;
export function registerDog(s, id) {
  const d = ensureKennel(s).dogs.find(x => x.id === id);
  if (!d) return err('No such dog.');
  if (d.papers) return err(`${d.name} already has papers.`);
  if (!spend(s, PAPERS_FEE, `Registration papers: ${d.name}`)) return err(`Papers are ${$(PAPERS_FEE)}.`);
  const h = ensureHd(s); h.regN = (h.regN || 1000) + 1;
  d.papers = `MWK-${h.regN}`;
  return { ok: true, text: `${d.name} is registered as ${d.papers}. Papered dogs sell for more and can enter sanctioned trials.` };
}
HOOKS.value.push(d => (d.papers ? 1.15 : 1));

HOOKS.day.push((s, notes) => { if (!s.hd) return; camDay(s, notes); trapDay(s, notes); jobsDay(s, notes); });
export const rivalName = () => pick(RIVALS);
export { level };
