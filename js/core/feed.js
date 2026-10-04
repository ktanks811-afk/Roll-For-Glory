// Throttle feed + rival texts. The city's pages and regular people post about
// what you do (races, busts, chases, stolen cars, big money, SWAT raids,
// drive-bys), and the racers you beat and the sets you have beef with text
// you threats. Answer a threat in Messages: run it back, talk back, or let it go.
//
// DOM-free; tested in scripts/check-data.mjs. Posts live in `s.feed` (older
// saves hold plain { day, text, likes } posts of your own, which still render).
// Everything else lives in `s.social`:
//   { seen: {stat snapshot}, rivals: { id: { heat, kind, day } }, unseen,
//     beefSeen: { gangId: level }, moneyDay, warrantDay }

import { on, emit } from './events.js';
import { game, uid, gameTimeStr, addFollowers, addRep, activeCar, modelOf, fmtMoney } from './state.js';
import { sendMessage, challengeFrom } from './story.js';
import * as GANG from './gangs.js';
import { PAGES, LOCALS, LOCAL_COLORS, STREET_CARS, REACT, COMMENTS, AMBIENT, RIVAL_TEXTS } from '../data/social.js';
import { RACER_BY_ID } from '../data/npcs.js';
import { GANGS, GANG_IDS } from '../data/gangs.js';
import { districtAt } from '../data/world.js';

export const FEED_MAX = 80;
export const HEATED_AT = 50;     // a rival this hot sends real threats
const BEEF_LEVELS = [25, 50, 75];

const pick = (a, rng) => a[Math.floor(rng() * a.length)];

export function ensureSocial(s) {
  s.feed ??= [];
  const so = (s.social ??= {});
  so.seen ??= snapshot(s);      // a save from before this: nothing old gets posted about
  so.rivals ??= {};
  so.unseen ??= 0;
  so.beefSeen ??= {};
  so.moneyDay ??= -1;
  so.warrantDay ??= -1;
  return so;
}

function snapshot(s) {
  return {
    stolen: s.stats?.carsStolen || 0,
    jacked: s.stats?.carjacked || 0,
    fenced: s.stats?.carsFenced || 0,
    raids: s.drugs?.raids || 0,
    driveBys: s.gang?.stats?.driveBys || 0,
  };
}

export function myHandle(s) { return '@' + (s.player.name.toLowerCase().replace(/\W+/g, '') || 'driver'); }

function where(s) { return s.pos ? districtAt(s.pos.x, s.pos.z) : 'Fort Worth'; }
function carWord(s) { const c = activeCar(s); return c ? modelOf(c)?.model || 'ride' : 'ride'; }

function author(key, rng) {
  if (key === 'local') { const h = pick(LOCALS, rng); return { name: h, handle: h, color: LOCAL_COLORS[h.length % LOCAL_COLORS.length] }; }
  const p = PAGES[key] || PAGES.tea;
  return { name: p.name, handle: p.handle, color: p.color, v: !!p.verified };
}

export function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}

// Put a post on the timeline. `about`: it's about you (followers, comments).
// `mood` picks the comments: 'good' | 'bad' | 'hot'.
export function addPost(s, { by, text, about = false, mood = 'good', rng = Math.random, mine = false }) {
  const so = ensureSocial(s);
  const reach = 30 + Math.sqrt(s.followers || 0) * 6;
  const likes = Math.round(reach * (about ? 2.5 : 1) * (0.5 + rng()));
  const nComments = about ? 1 + Math.floor(rng() * 3) : Math.floor(rng() * 2);
  const comments = [];
  for (let i = 0; i < nComments; i++) comments.push({ who: pick(LOCALS, rng), text: pick(COMMENTS[mood] || COMMENTS.good, rng) });
  const p = { id: uid('post'), day: s.time.day, t: gameTimeStr(s.time), text, likes, comments, about, mood };
  if (mine) p.mine = true;
  else Object.assign(p, { who: by.name, handle: by.handle, color: by.color, v: by.v });
  s.feed.unshift(p);
  if (s.feed.length > FEED_MAX) s.feed.length = FEED_MAX;
  if (!mine) so.unseen++;
  if (about && mood !== 'hot') addFollowers(s, Math.round(likes / 25));
  emit('post', p);
  return p;
}

// One or two pages react to something you did.
export function react(s, kind, vars = {}, { rng = Math.random, n = 1, mood } = {}) {
  const tpls = REACT[kind];
  if (!tpls) return [];
  const v = { me: myHandle(s), name: s.player.name, where: where(s), car: carWord(s), ...vars };
  const pool = [...tpls], out = [];
  const m = mood || (['raceLoss', 'busted', 'ticket', 'warrant', 'sentence', 'carjackedMe'].includes(kind) ? 'bad' : ['carStolen', 'raid', 'driveby'].includes(kind) ? 'hot' : 'good');
  for (let i = 0; i < n && pool.length; i++) {
    const [key, tpl] = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    out.push(addPost(s, { by: author(key, rng), text: fill(tpl, v), about: key !== 'local' || tpl.includes('{me}'), mood: m, rng }));
  }
  return out;
}

// ---------------------------------------------------------------- rivals
export function rival(s, id) { return ensureSocial(s).rivals[id] || null; }

function rivalName(id) {
  if (RACER_BY_ID[id]) return RACER_BY_ID[id].nick;
  if (GANGS[id]) return GANGS[id].short;
  return id;
}

export function bumpRival(s, id, n, kind) {
  const so = ensureSocial(s);
  const r = (so.rivals[id] ??= { heat: 0, kind, day: -1 });
  r.heat = Math.max(0, Math.min(100, Math.round(r.heat + n)));
  if (r.heat <= 0) delete so.rivals[id];
  return r;
}

// Who's got a problem with you, hottest first: [{ id, name, heat, kind, contact }].
export function rivalsList(s) {
  const so = ensureSocial(s);
  const out = Object.entries(so.rivals).map(([id, r]) => ({ id, name: rivalName(id), heat: r.heat, kind: r.kind, contact: r.kind === 'gang' ? GANGS[id]?.boss : id }));
  // sets you have beef with count even before they text
  for (const id of GANG_IDS) {
    const b = s.gang?.beef?.[id] || 0;
    if (b >= BEEF_LEVELS[0] && !so.rivals[id]) out.push({ id, name: GANGS[id].short, heat: b, kind: 'gang', contact: GANGS[id].boss });
  }
  return out.sort((a, b) => b.heat - a.heat);
}

export function heatWord(h) { return h >= 80 ? 'At war' : h >= HEATED_AT ? 'Heated' : h >= 25 ? 'Salty' : 'Watching'; }

// A rival texts you. Threats come with answers: run it back (racers), talk back, let it go.
export function rivalText(s, id, text, { answer = true } = {}) {
  const so = ensureSocial(s);
  const r = so.rivals[id];
  const from = GANGS[id] ? GANGS[id].boss : id;
  if (r) r.day = s.time.day;
  return sendMessage(s, from, text, answer ? { action: { type: 'rival', id } } : {});
}

// What a rival threat lets you do: [{ id, label, cost? }]
export function rivalOptions(s, id) {
  if (GANGS[id]) {
    const cost = GANG.squashCost(s, id);
    return [{ id: 'back', label: 'Talk back' }, { id: 'calm', label: `Squash it (${fmtMoney(cost)})`, cost }];
  }
  return [{ id: 'race', label: 'Run it back' }, { id: 'back', label: 'Talk back' }, { id: 'calm', label: 'Let it go' }];
}

// Answer a threat. Returns '' or why not.
export function answerRival(s, msg, choice, rng = Math.random) {
  const a = msg?.action;
  if (!a || a.type !== 'rival' || a.done) return 'Already handled.';
  const id = a.id, gang = !!GANGS[id];
  if (choice === 'race') {
    const r = RACER_BY_ID[id];
    if (!r || gang) return 'They don\'t race.';
    if (!s.activeCar) return 'You need a car to race.';
    if (!challengeFrom(s, r, pick(r.lines.rematch ? [r.lines.rematch, 'Bet. Pull up.'] : ['Bet. Pull up.'], rng))) return 'No spot open for that race yet.';
    bumpRival(s, id, -10, 'racer');
  } else if (choice === 'back') {
    bumpRival(s, id, 15, gang ? 'gang' : 'racer');
    addRep(s, 5, `Talked back to ${rivalName(id)}`);
    if (gang) GANG.addBeef(s, id, 10);
    else if (s.npc?.[id]) s.npc[id].rel = (s.npc[id].rel || 0) - 10;
    addPost(s, { mine: true, text: `${pick(['Keep my name out your mouth', 'Y\'all know where to find me', 'Talk is cheap. Pull up', 'Scared money don\'t make money'], rng)}, ${gang ? GANGS[id].short : '@' + rivalName(id).toLowerCase().replace(/\W+/g, '')}. 🤫`, about: true, rng });
  } else if (choice === 'calm') {
    if (gang) { const why = GANG.squash(s, id); if (why) return why; delete ensureSocial(s).rivals[id]; ensureSocial(s).beefSeen[id] = 0; }
    else { bumpRival(s, id, -30, 'racer'); if (s.npc?.[id]) s.npc[id].rel = (s.npc[id].rel || 0) + 5; }
  } else return 'Pick an answer.';
  a.done = choice;
  return '';
}

// ---------------------------------------------------------------- reacting to the game
export function onRace(s, d, rng = Math.random) {
  const r = d.npcId && RACER_BY_ID[d.npcId];
  const npc = r ? '@' + r.nick.toLowerCase().replace(/\W+/g, '') : 'some random';
  if (d.won) {
    react(s, d.pinks ? 'pinks' : d.wager >= 1000 ? 'raceWinMoney' : 'raceWin', { npc, amt: fmtMoney(d.wager || 0) }, { rng });
    if (!r) return;
    const h = bumpRival(s, r.id, d.pinks ? 40 : d.wager >= 1000 ? 25 : 15, 'racer');
    if (rng() < 0.75) rivalText(s, r.id, pick(h.heat >= HEATED_AT ? RIVAL_TEXTS.racerHeated : RIVAL_TEXTS.racerSore, rng));
  } else if (r) {
    if (rng() < 0.6) react(s, 'raceLoss', { npc }, { rng });
    bumpRival(s, r.id, -10, 'racer');
    if (rng() < 0.5) rivalText(s, r.id, pick(RIVAL_TEXTS.racerGloat, rng), { answer: false });
  }
}

export function onMoney(s, m, rng = Math.random) {
  const so = ensureSocial(s);
  if (m.amount < 5000 || so.moneyDay === s.time.day) return;
  so.moneyDay = s.time.day;
  if (rng() < 0.6) react(s, 'bigMoney', { amt: fmtMoney(m.amount) }, { rng });
}

// Stats the rest of the game keeps (stolen cars, carjackings, raids, drive-bys)
// and gang beef: post or text about whatever moved since last time.
export function statTick(s, rng = Math.random) {
  const so = ensureSocial(s), now = snapshot(s), was = so.seen;
  if (now.stolen > (was.stolen || 0)) react(s, 'carStolen', { car: pick(STREET_CARS, rng) }, { rng, n: 1 + (rng() < 0.4 ? 1 : 0) });
  if (now.jacked > (was.jacked || 0)) react(s, 'carjackedMe', {}, { rng });
  if (now.fenced > (was.fenced || 0)) {
    const car = pick(STREET_CARS, rng);
    react(s, 'fenced', { car }, { rng });
    // sometimes the car was somebody's: a set texts you about it
    const g = pick(GANG_IDS, rng);
    if (rng() < 0.25 && s.gang?.set !== g) { bumpRival(s, g, 20, 'gang'); GANG.addBeef(s, g, 10); rivalText(s, g, fill(pick(RIVAL_TEXTS.fenced, rng), { car })); }
  }
  if (now.raids > (was.raids || 0)) react(s, 'raid', {}, { rng, n: 2 });
  if (now.driveBys > (was.driveBys || 0)) {
    const tgt = GANG_IDS.filter(id => (s.gang?.beef?.[id] || 0) > 0).sort((a, b) => s.gang.beef[b] - s.gang.beef[a])[0];
    react(s, 'driveby', { gang: tgt ? GANGS[tgt].short : 'a rival' }, { rng });
  }
  so.seen = now;
  // a set's beef with you crossed a line: their big homie texts
  for (const id of GANG_IDS) {
    const b = s.gang?.beef?.[id] || 0;
    const lvl = BEEF_LEVELS.filter(x => b >= x).length;
    const seen = so.beefSeen[id] || 0;
    if (lvl > seen && s.gang?.set !== id) {
      const r = (so.rivals[id] ??= { heat: 0, kind: 'gang', day: -1 }); r.heat = Math.max(r.heat, b);
      const vars = { gang: GANGS[id].short, where: GANGS[id].hood };
      rivalText(s, id, fill(pick(lvl >= 3 ? RIVAL_TEXTS.gangWar : lvl === 2 ? RIVAL_TEXTS.gangHot : RIVAL_TEXTS.gangWarn, rng), vars));
    }
    so.beefSeen[id] = lvl;
  }
}

// Every game hour: background posts, grudges cool off, and a heated rival
// might send another threat.
export function feedHour(s, rng = Math.random) {
  const so = ensureSocial(s);
  if (rng() < 0.3) {
    const [key, tpl] = pick(AMBIENT, rng);
    addPost(s, { by: author(key, rng), text: tpl, rng });
  }
  for (const [id, r] of Object.entries(so.rivals)) {
    if (r.kind === 'racer') bumpRival(s, id, -1, 'racer');
    else if (GANGS[id]) { r.heat = s.gang?.beef?.[id] || 0; if (r.heat <= 0) delete so.rivals[id]; }
    if (!so.rivals[id] || r.heat < HEATED_AT || r.day === s.time.day || rng() > 0.08) continue;
    const vars = { gang: rivalName(id), where: GANGS[id]?.hood || 'the east side' };
    rivalText(s, id, fill(pick(r.kind === 'gang' ? RIVAL_TEXTS.gangHot : RIVAL_TEXTS.racerHeated, rng), vars));
  }
}

export function markSeen(s) { ensureSocial(s).unseen = 0; }

export function likePost(s, id) {
  const p = s.feed.find(x => x.id === id);
  if (!p) return;
  p.liked = !p.liked;
  p.likes += p.liked ? 1 : -1;
}

// ---------------------------------------------------------------- wiring
let wired = false;
export function initFeed() {
  if (wired) return; wired = true;
  const g = fn => d => { if (game.s) fn(game.s, d || {}); };
  on('raceFinished', g(onRace));
  on('money', g(onMoney));
  on('busted', g((s, d) => react(s, d.ticket ? 'ticket' : 'busted', {}, { n: d.ticket ? 1 : 2 })));
  on('pursuitEscaped', g((s, d) => react(s, 'escaped', {}, { n: (d.level || 1) >= 3 ? 2 : 1 })));
  on('warrant', g((s, d) => { const so = ensureSocial(s); if (d.added && so.warrantDay !== s.time.day) { so.warrantDay = s.time.day; react(s, 'warrant'); } }));
  on('case', g((s, d) => { if (d.closed && d.sentence?.kind === 'jail') react(s, 'sentence'); }));
  on('gangJoined', g((s, d) => { if (d.id) react(s, 'gangJoined', { gang: d.id === 'own' ? s.gang?.own?.name || 'their own set' : GANGS[d.id]?.name }); }));
  on('tierUp', g(s => react(s, 'tierUp')));
  setInterval(() => { if (game.s) statTick(game.s); }, 1500);
}
