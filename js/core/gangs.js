// Gangs. Fort Worth's sets each hold a side of town and post up on a corner
// there (data/gangs.js). You get put on with one (jumped in, or by putting in
// work on their rivals) or start your own set. Respect from work ranks you up:
// higher ranks pay a bigger bag every morning and let more homies ride with
// you. Homies follow you on foot, hang out the windows on a drive-by and shoot
// back when a rival set opens up on you.
//
// Beef is per set, 0..100. Shooting their people, sliding on their corner and
// leaving their set all raise it; it cools a little every day, and you can pay
// to squash it. A set you have beef with (or your set's natural rivals) shoots
// on sight, and when the beef runs hot they come looking for you in a car.
//
// DOM-free: the world side (corners, shooting, the hit car) is world2d/gangs.js
// and the phone app is ui/gang.js.

import { on, emit } from './events.js';
import { game, earn, spend, canAfford, uid, tierOf } from './state.js';
import { sendMessage } from './story.js';
import { GANGS, GANG_IDS, RANKS, NICKS, FOUND_COST, RECRUIT_COST, HOMIE_DUES } from '../data/gangs.js';
import { LOCATIONS, districtAt } from '../data/world.js';
import { ensureArms } from '../data/weapons.js';

export const ROLL_MAX = 3;          // homies that can follow you around at once
export const HOSTILE_AT = 50;       // beef where a set starts shooting on sight
const JUMP_HP = 45;                 // getting jumped in hurts
const now = s => s.time.day * 1440 + s.time.min;

export function ensureGang(s) {
  s.gang ??= {};
  const g = s.gang;
  g.set ??= null;          // the set you're in: a GANGS id, or 'own'
  g.own ??= null;          // your own set: { name, color, hood }
  g.respect ??= 0;
  g.homies ??= [];         // { id, nick, rolling, out: day they're back from JPS or county }
  g.beef ??= {};
  for (const id of GANG_IDS) g.beef[id] ??= 0;
  g.truce ??= {};          // set id -> day the truce runs out
  g.offers ??= [];
  g.job ??= null;
  g.hit ??= null;          // a rival car coming for you: { gang, at }
  g.init ??= null;         // the set you're putting in work for, to get on
  g.stats ??= { drops: 0, driveBys: 0, jobs: 0, lost: 0 };
  g.day ??= s.time.day;
  return g;
}

// ---------------------------------------------------------------- who's who
export function setInfo(s, id) {
  if (!id) return null;
  if (id === 'own') {
    const o = ensureGang(s).own;
    return o ? { id, name: o.name, short: o.name, color: o.color, hood: o.hood, boss: null, rivals: [], own: true } : null;
  }
  const g = GANGS[id];
  return g ? { id, ...g } : null;
}
export const mySet = s => setInfo(s, ensureGang(s).set);

export function rankOf(s) {
  const g = ensureGang(s);
  if (g.set === 'own') return { n: RANKS.length, name: 'Big Homie', homies: Math.min(10, 3 + Math.floor(g.respect / 400)), bag: 0, next: null };
  let n = 0;
  for (let i = 0; i < RANKS.length; i++) if (g.respect >= RANKS[i].respect) n = i;
  return { n, ...RANKS[n], next: RANKS[n + 1] || null };
}
export const homieCap = s => (ensureGang(s).set ? rankOf(s).homies : 0);
export const readyHomies = s => ensureGang(s).homies.filter(h => !(h.out > s.time.day));
export const rollingHomies = s => readyHomies(s).filter(h => h.rolling);

// The sets that are natural enemies of yours.
export function rivalsOf(s) {
  const g = ensureGang(s);
  if (!g.set) return [];
  if (g.set === 'own') return GANG_IDS.filter(id => GANGS[id].hood === g.own?.hood);
  return GANGS[g.set]?.rivals || [];
}

// Does this set shoot at you on sight?
export function hostile(s, id) {
  const g = ensureGang(s);
  if (!GANGS[id] || id === g.set) return false;
  if ((g.truce[id] || 0) >= s.time.day) return false;
  return g.beef[id] >= HOSTILE_AT || rivalsOf(s).includes(id);
}

export function beefLabel(n) {
  return n >= 80 ? 'War' : n >= HOSTILE_AT ? 'Beef' : n >= 25 ? 'Tension' : 'Cool';
}

// ---------------------------------------------------------------- respect + beef
export function addRespect(s, n, why = '') {
  const g = ensureGang(s);
  if (!g.set || !n) return;
  const before = rankOf(s);
  g.respect = Math.max(0, Math.round(g.respect + n));
  const after = rankOf(s);
  if (after.n > before.n) {
    emit('toast', { kind: 'good', text: `Ranked up: ${after.name}. ${after.homies} homies can ride with you now.` });
    const boss = mySet(s)?.boss;
    if (boss) sendMessage(s, boss, `You ${after.name} now. Keep that same energy.`);
  } else if (why) emit('toast', { kind: 'good', text: `+${n} respect · ${why}` });
}

export function addBeef(s, id, n) {
  const g = ensureGang(s);
  if (!GANGS[id] || id === g.set) return;
  const before = g.beef[id];
  g.beef[id] = Math.max(0, Math.min(100, Math.round(before + n)));
  if (n > 0) delete g.truce[id];
  if (before < HOSTILE_AT && g.beef[id] >= HOSTILE_AT) emit('toast', { kind: 'bad', text: `${GANGS[id].name} want smoke with you now. Their corner shoots on sight.` });
}

// ---------------------------------------------------------------- getting on
export function joinBlocked(s, id) {
  const g = ensureGang(s), gg = GANGS[id];
  if (!gg) return 'No such set.';
  if (g.set) return 'You already claim a set.';
  if (g.beef[id] >= 25) return `${gg.short} don't trust you. Squash the beef first.`;
  if (g.job) return 'Finish the job you\'re on first.';
  return '';
}

// Get jumped in: take the beating, you're in.
export function jumpIn(s, id) {
  const why = joinBlocked(s, id);
  if (why) return why;
  const a = ensureArms(s);
  if (a.hp < 60) return 'You can\'t take a beating like this. Heal up first.';
  a.hp = Math.max(10, a.hp - JUMP_HP);
  putOn(s, id, `${GANGS[id].short} jumped you in. Thirteen seconds, no swinging back.`);
  return '';
}

// Or put in work on one of their rivals: when the job's done, you're in.
export function workIn(s, id) {
  const why = joinBlocked(s, id);
  if (why) return why;
  const g = ensureGang(s), gg = GANGS[id];
  const target = gg.rivals[Math.floor(Math.random() * gg.rivals.length)];
  g.init = id;
  g.job = { ...makeJob(s, 'hit', target, { by: id, init: true }), deadline: now(s) + 360 };
  sendMessage(s, gg.boss, `You want on? Go see about ${GANGS[target].name} on their corner in ${GANGS[target].hood}. Drop ${g.job.need} of them and you family.`);
  emit('toast', { kind: 'info', text: `Initiation: drop ${g.job.need} ${GANGS[target].short} on their corner.` });
  return '';
}

function putOn(s, id, text) {
  const g = ensureGang(s), gg = GANGS[id];
  g.set = id; g.init = null; g.respect = 0; g.homies = []; g.offers = [];
  for (const r of gg.rivals) g.beef[r] = Math.max(g.beef[r], 30);
  addHomie(s);
  sendMessage(s, gg.boss, `${text} Welcome to ${gg.name}. ${g.homies[0].nick} gon' ride with you. Check the Gang app for work.`);
  emit('toast', { kind: 'good', text: `You're ${gg.name} now.` });
  emit('gangJoined', { id });
  rollOffers(s);
}

export function foundBlocked(s) {
  const g = ensureGang(s);
  if (g.set) return 'You already claim a set.';
  if (tierOf(s.rep).n < 2) return 'Nobody follows a nobody. Get to Tier 2 first.';
  if (!canAfford(s, FOUND_COST)) return `You need ${FOUND_COST.toLocaleString()} to put a set together.`;
  return '';
}

// Start your own set in a hood (a turf hood id). The set already there won't like it.
export function found(s, name, hood, color = '#ff2a3a') {
  const why = foundBlocked(s);
  if (why) return why;
  name = String(name || '').trim().slice(0, 24);
  if (!name) return 'Name your set.';
  if (!spend(s, FOUND_COST, `Started ${name}`, { street: true })) return 'Not enough money.';
  const g = ensureGang(s);
  g.set = 'own'; g.own = { name, color, hood }; g.respect = 0; g.homies = []; g.init = null; g.offers = [];
  addHomie(s); addHomie(s);
  for (const id of GANG_IDS) if (GANGS[id].hood === hood) addBeef(s, id, 70);
  emit('toast', { kind: 'good', text: `${name} is official. ${hood} is home.` });
  emit('gangJoined', { id: 'own' });
  rollOffers(s);
  return '';
}

export function leave(s) {
  const g = ensureGang(s);
  if (!g.set) return;
  const was = g.set;
  g.set = null; g.own = null; g.respect = 0; g.homies = []; g.job = null; g.offers = [];
  if (was !== 'own') {
    addBeef(s, was, 70);
    sendMessage(s, GANGS[was].boss, 'You don\'t just walk away from this. Watch yourself.');
  }
  emit('gangJoined', { id: null });
}

// ---------------------------------------------------------------- homies
export const recruitCost = s => Math.round(RECRUIT_COST * (1 + ensureGang(s).homies.length * 0.25));

function addHomie(s) {
  const g = ensureGang(s);
  const used = new Set(g.homies.map(h => h.nick));
  const free = NICKS.filter(n => !used.has(n));
  const nick = free.length ? free[Math.floor(Math.random() * free.length)] : `Lil ${g.homies.length + 1}`;
  const h = { id: uid('hm'), nick, rolling: rollingHomies(s).length < ROLL_MAX, out: 0 };
  g.homies.push(h);
  return h;
}

export function recruitBlocked(s) {
  const g = ensureGang(s);
  if (!g.set) return 'Get on with a set first.';
  if (g.homies.length >= homieCap(s)) return `A ${rankOf(s).name} can only have ${homieCap(s)}. Rank up for more.`;
  if (!canAfford(s, recruitCost(s))) return `Putting somebody on costs ${recruitCost(s).toLocaleString()}.`;
  return '';
}
export function recruit(s) {
  const why = recruitBlocked(s);
  if (why) return why;
  spend(s, recruitCost(s), 'Put a homie on', { street: true });
  const h = addHomie(s);
  emit('toast', { kind: 'good', text: `${h.nick} is with you now.` });
  return '';
}

export function toggleRoll(s, id) {
  const h = ensureGang(s).homies.find(q => q.id === id);
  if (!h) return '';
  if (!h.rolling && rollingHomies(s).length >= ROLL_MAX) return `Only ${ROLL_MAX} can ride with you at once.`;
  h.rolling = !h.rolling;
  return '';
}

// A homie got hit or picked up: out for a couple of days.
export function homieDown(s, id, why = 'got hit') {
  const g = ensureGang(s), h = g.homies.find(q => q.id === id);
  if (!h) return;
  h.out = s.time.day + 2;
  g.stats.lost++;
  emit('toast', { kind: 'bad', text: `${h.nick} ${why}. He's at JPS for a couple days.` });
}

// ---------------------------------------------------------------- squashing it
export function squashCost(s, id) {
  const b = ensureGang(s).beef[id] || 0;
  return Math.round((300 + b * 60) * (rivalsOf(s).includes(id) ? 2 : 1) / 50) * 50;
}
export function squash(s, id) {
  const g = ensureGang(s);
  if (!GANGS[id]) return 'No such set.';
  if (!g.beef[id] && !rivalsOf(s).includes(id)) return 'There\'s no beef.';
  if (!spend(s, squashCost(s, id), `Squashed it with ${GANGS[id].short}`, { street: true })) return 'Not enough money.';
  g.beef[id] = 0;
  g.truce[id] = s.time.day + 3;
  if (g.hit?.gang === id) g.hit = null;
  sendMessage(s, GANGS[id].boss, 'Aight. We good. For now.');
  return '';
}

// ---------------------------------------------------------------- work
// hit: drop members on a rival corner (on foot or however)
// driveby: roll past a rival corner in a car while your homies hang out the windows
// collect: pick up the re-up from a store in your hood
// defend: a rival set is posted on your corner; run them off
export const JOB_KINDS = {
  hit:     { title: g => `Slide on ${g.short}`, need: 3, pay: 700, respect: 80, beef: 30, mins: 240 },
  driveby: { title: g => `Drive-by on ${g.short}`, need: 2, pay: 1100, respect: 120, beef: 40, mins: 240 },
  collect: { title: () => 'Collect the re-up', need: 1, pay: 600, respect: 30, beef: 0, mins: 180 },
  defend:  { title: g => `Run ${g.short} off the block`, need: 3, pay: 900, respect: 110, beef: 25, mins: 150 },
};

function storeIn(hood) {
  const spots = LOCATIONS.filter(l => ['gas', 'food', 'corner', 'clothing'].includes(l.type) && districtAt(l.x, l.z) === hood);
  return spots.length ? spots[Math.floor(Math.random() * spots.length)] : null;
}

export function makeJob(s, kind, gang, extra = {}) {
  const k = JOB_KINDS[kind], tgt = setInfo(s, gang);
  const job = { id: uid('gj'), kind, gang, need: k.need, got: 0, pay: k.pay, respect: k.respect, mins: k.mins, title: k.title(tgt || {}), ...extra };
  if (kind === 'collect') {
    const loc = storeIn(mySet(s)?.hood);
    job.loc = loc ? loc.id : null;
    job.where = loc ? loc.name : 'your corner';
  } else job.where = `${tgt.short} corner, ${kind === 'defend' ? 'your block' : tgt.hood}`;
  if (kind === 'driveby') job.where = `${tgt.short} corner, ${tgt.hood} (in a car)`;
  return job;
}

// Today's work: a hit and a drive-by on rivals, and a pickup.
export function rollOffers(s) {
  const g = ensureGang(s);
  g.offers = [];
  if (!g.set) return g.offers;
  const enemies = GANG_IDS.filter(id => hostile(s, id) || rivalsOf(s).includes(id));
  const pool = enemies.length ? enemies : GANG_IDS.filter(id => id !== g.set);
  const pick = () => pool[Math.floor(Math.random() * pool.length)];
  g.offers.push(makeJob(s, 'hit', pick()), makeJob(s, 'driveby', pick()), makeJob(s, 'collect', g.set));
  return g.offers;
}

export function takeJob(s, id) {
  const g = ensureGang(s);
  if (g.job) return 'You\'re already on something.';
  const o = g.offers.find(q => q.id === id);
  if (!o) return 'That\'s gone.';
  g.offers = g.offers.filter(q => q !== o);
  g.job = { ...o, deadline: now(s) + o.mins };
  return '';
}
export function dropJob(s) {
  const g = ensureGang(s);
  if (!g.job) return;
  if (g.job.init) g.init = null;
  g.job = null;
  addRespect(s, -20);
}
export const jobLeft = s => { const j = ensureGang(s).job; return j?.deadline ? j.deadline - now(s) : Infinity; };

// The world tells us something happened: kind 'hit' | 'driveby' | 'collect' | 'defend'.
export function progress(s, kind, gang, n = 1) {
  const g = ensureGang(s), j = g.job;
  if (!j || j.kind !== kind || (gang && j.gang !== gang)) return false;
  j.got = Math.min(j.need, j.got + n);
  if (j.got >= j.need) finishJob(s, true);
  else emit('toast', { kind: 'info', text: `${j.title}: ${j.got}/${j.need}` });
  return true;
}

function finishJob(s, ok) {
  const g = ensureGang(s), j = g.job;
  if (!j) return;
  g.job = null;
  if (!ok) {
    emit('toast', { kind: 'bad', text: `You never handled it: ${j.title}.` });
    if (j.init) { g.init = null; addBeef(s, j.by, 15); }
    else addRespect(s, -30);
    return;
  }
  if (j.init) {
    putOn(s, j.by, 'You did that.');
    earn(s, j.pay, `${GANGS[j.by].short}: initiation`, { dirty: true });
    return;
  }
  g.stats.jobs++;
  if (j.kind === 'driveby') g.stats.driveBys++;
  earn(s, j.pay, `${mySet(s)?.short || 'Set'}: ${j.title}`, { dirty: true });
  if (j.kind !== 'collect') addBeef(s, j.gang, JOB_KINDS[j.kind].beef);
  addRespect(s, j.respect, j.title);
}

// A rival set posts up on your corner: a defend job, whether you're on something or not.
export function invade(s, gang = null) {
  const g = ensureGang(s), set = mySet(s);
  if (!set || g.job) return null;
  const enemies = GANG_IDS.filter(id => hostile(s, id));
  gang ||= enemies[Math.floor(Math.random() * enemies.length)];
  if (!gang) return null;
  g.job = { ...makeJob(s, 'defend', gang), deadline: now(s) + JOB_KINDS.defend.mins };
  const from = set.boss || g.homies[0]?.nick || 'jojo';
  const text = `${GANGS[gang].name} posted up on our block in ${set.hood}. Pull up.`;
  if (set.boss) sendMessage(s, set.boss, text); else emit('toast', { kind: 'bad', text: `${from}: ${text}` });
  return g.job;
}

// ---------------------------------------------------------------- mornings
function newDay(s) {
  const g = ensureGang(s);
  for (const id of GANG_IDS) {
    const floor = rivalsOf(s).includes(id) ? 30 : 0;
    if (g.beef[id] > floor) g.beef[id] = Math.max(floor, g.beef[id] - 6);
  }
  if (!g.set) { g.offers = []; return; }
  const r = rankOf(s), ready = readyHomies(s).length;
  const bag = g.set === 'own' ? ready * HOMIE_DUES : r.bag;
  if (bag > 0) earn(s, bag, g.set === 'own' ? `${g.own.name}: dues from ${ready} homie${ready === 1 ? '' : 's'}` : `${mySet(s).short}: your bag (${r.name})`, { dirty: true });
  rollOffers(s);
  // hot beef: somebody comes looking for you
  if (!g.hit) {
    const hot = GANG_IDS.filter(id => hostile(s, id) && g.beef[id] >= 40).sort((a, b) => g.beef[b] - g.beef[a]);
    if (hot.length && Math.random() < 0.15 + g.beef[hot[0]] / 250) {
      g.hit = { gang: hot[0], at: now(s) + 120 + Math.floor(Math.random() * 600) };
      const boss = mySet(s)?.boss;
      const warn = `Word is ${GANGS[hot[0]].name} sliding on you today. Keep your head on a swivel.`;
      if (boss) sendMessage(s, boss, warn); else emit('toast', { kind: 'bad', text: warn });
    }
  }
  if (!g.job && Math.random() < 0.2) invade(s);
}

export function tick(s) {
  const g = ensureGang(s);
  for (let n = 0; g.day < s.time.day && n < 7; n++) { g.day++; newDay(s); }
  g.day = s.time.day;
  if (g.job && jobLeft(s) <= 0) finishJob(s, false);
}

let wired = false;
export function initGangs() {
  if (wired) return; wired = true;
  setInterval(() => { if (game.s) tick(game.s); }, 1000);
}
