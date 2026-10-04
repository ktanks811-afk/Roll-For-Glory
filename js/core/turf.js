// Crew turf. Fort Worth's neighborhoods each belong to a crew (or nobody).
// Your crew claims an open hood by repping it: drive around in it. A rival's
// hood is taken in a turf war: beat their members in challenge races until
// their hold breaks. Hoods you hold pay street tax every morning, and rival
// crews come at them: when they move on one, beat their racer before the
// deadline or they take it.
//
// Turf lives in the save (s.turf), and is about the single-player crew
// (s.crew): your own crew, or the NPC crew you joined.

import { on, emit } from './events.js';
import { game, earn, addRep, uid, tierOf } from './state.js';
import { sendMessage } from './story.js';
import { RACERS, CREWS } from '../data/npcs.js';
import { LOCATIONS, LOC_BY_ID, districtAt } from '../data/world.js';

// box: [x0, x1, z0, z1] in world metres (for the phone's turf map), c: a drivable spot inside.
export const HOODS = [
  { id: 'Downtown', owner: 'apex_syndicate', take: 1200, box: [-300, 300, -300, 300], c: [0, 0] },
  { id: 'Stockyards', aka: 'North Side', owner: 'iron_saints', take: 600, box: [-300, 300, -1000, -300], c: [0, -650] },
  { id: 'Riverside Industrial', short: 'Riverside', owner: 'iron_saints', take: 500, box: [300, 1000, -1000, 600], c: [650, -200] },
  { id: 'Near Southside', short: 'Southside', owner: 'midnight_static', take: 450, box: [-300, 300, 300, 1050], c: [0, 650] },
  { id: 'Lakeside', owner: 'midnight_static', take: 450, box: [300, 1000, 600, 1050], c: [650, 825] },
  { id: 'Arlington Heights', owner: 'velvet_ghosts', take: 700, box: [-1000, -300, -1000, 1050], c: [-650, 0] },
  { id: 'Stop Six', owner: null, take: 400, box: [1000, 2700, -1000, 190], c: [1700, -400] },
  { id: 'Benbrook Hills', owner: null, take: 300, box: [-2700, -1000, -100, 1050], c: [-1500, 450] },
  { id: 'Cross Timbers', owner: 'dust_devils', take: 350, box: [-2700, -1000, -1000, -100], c: [-1500, -550] },
  { id: 'Chisholm Flats', owner: 'dust_devils', take: 300, box: [-2700, 2700, 1050, 2000], c: [0, 1500] },
];
export const HOOD_BY_ID = Object.fromEntries(HOODS.map(h => [h.id, h]));

export const CLAIM_SECS = 45;     // seconds of driving in an open hood to claim it
const WAR_HIT = 50;               // hold a rival loses per turf-war win
const ATTACK_CHANCE = 0.3;        // per day, that a rival moves on one of your hoods
const MEMBER_CUT = 0.4;           // your share of the take when you're a member, not the founder

export function ensureTurf(s) {
  if (!s.turf) s.turf = { day: s.time.day, hoods: {}, war: null, attack: null, cooldown: {} };
  const t = s.turf;
  t.cooldown ??= {};
  for (const h of HOODS) t.hoods[h.id] ??= { owner: h.owner, hold: h.owner ? 100 : 0, claim: 0 };
  // a crew you founded owns its turf as 'me'; leaving it (or switching crews) gives that turf up
  const crewId = s.crew ? (s.crew.npcCrew || 'me:' + s.crew.name) : null;
  if (t.mine !== crewId) {
    for (const h of Object.values(t.hoods)) { if (h.owner === 'me') { h.owner = null; h.hold = 0; } h.claim = 0; }
    t.mine = crewId; t.war = null; t.attack = null;
  }
  return t;
}

// The owner key your crew uses: 'me' for a crew you founded, the NPC crew's id if you joined one.
export const myKey = s => (s.crew ? (s.crew.npcCrew || 'me') : null);

export function ownerInfo(s, key) {
  if (!key) return { name: 'Nobody', color: '#555a63', short: 'Open' };
  if (key === 'me') return { name: s.crew?.name || 'Your crew', color: s.crew?.color || '#ff2a3a', short: s.crew?.name || 'Yours', mine: true };
  const c = CREWS[key];
  return { name: c?.name || key, color: c?.color || '#888', short: c?.name || key, mine: key === myKey(s) };
}

export const hoodOf = (x, z) => HOOD_BY_ID[districtAt(x, z)] || null;
export const myHoods = s => { const k = myKey(s); return k ? HOODS.filter(h => ensureTurf(s).hoods[h.id].owner === k) : []; };
export const dailyTake = s => {
  const sum = myHoods(s).reduce((t, h) => t + h.take, 0);
  return Math.round(s.crew?.npcCrew ? sum * MEMBER_CUT : sum);
};

// Short label for the HUD: who runs the block you're on.
export function turfLabel(s, x, z) {
  const h = hoodOf(x, z);
  if (!h || !s) return '';
  const st = ensureTurf(s).hoods[h.id];
  if (!st.owner) return st.claim > 0 && myKey(s) ? `claiming ${Math.floor(st.claim)}%` : 'open turf';
  const o = ownerInfo(s, st.owner);
  return o.mine ? 'your turf' : `${o.short} turf`;
}

// The crew member who'll race you for a hood: the strongest one who'd take your call.
export function crewRacer(s, crew, exclude = null) {
  const tier = tierOf(s.rep).n;
  const pool = RACERS.filter(r => r.crew === crew && r.tier <= tier + 1 && r.id !== exclude);
  if (!pool.length) return exclude ? crewRacer(s, crew) : null;
  const top = Math.max(...pool.map(r => r.tier));
  const best = pool.filter(r => r.tier === top);
  return best[Math.floor(Math.random() * best.length)];
}

// The closest race spot you're allowed to use.
function spotFor(s, h, type) {
  const tier = tierOf(s.rep).n;
  const spots = LOCATIONS.filter(l => l.type === type && (l.tier || 1) <= tier);
  if (!spots.length) return LOC_BY_ID.ironline;
  return spots.reduce((a, b) => (Math.hypot(b.x - h.c[0], b.z - h.c[1]) < Math.hypot(a.x - h.c[0], a.z - h.c[1]) ? b : a));
}

function challenge(s, r, h, text, days) {
  const type = r.style === 'drag' ? 'drag' : 'roll';
  const loc = spotFor(s, h, type);
  const ch = {
    id: uid('ch'), npcId: r.id, type, loc: loc.id, wager: 0, turf: h.id,
    roll: [40, 50, 60][Math.floor(Math.random() * 3)], dist: type === 'drag' ? 'quarter' : 'half',
    expires: s.time.day + days,
  };
  sendMessage(s, r.id, `${text} ${type === 'drag' ? `Quarter mile at ${loc.name}.` : `${ch.roll}-roll at ${loc.name}.`} No money, just the block.`, { action: { type: 'challenge', challenge: ch } });
  return ch;
}

// Why you can't start a war on a hood right now ('' when you can).
export function warBlocked(s, id) {
  const t = ensureTurf(s), st = t.hoods[id], k = myKey(s);
  if (!k) return 'Join or start a crew first.';
  if (!st.owner) return '';
  if (st.owner === k) return 'Already yours.';
  if (t.war) return t.war.hood === id ? 'War already on.' : `You're already at war over ${t.war.hood}.`;
  if ((t.cooldown[id] || 0) > s.time.day) return 'They just ran you off. Try tomorrow.';
  if (!crewRacer(s, st.owner)) return `${ownerInfo(s, st.owner).name} won't race you yet. Get more rep.`;
  return '';
}

export function startWar(s, id) {
  const why = warBlocked(s, id);
  if (why) return why;
  const t = ensureTurf(s), h = HOOD_BY_ID[id], st = t.hoods[id];
  if (!st.owner) return 'Nobody holds it. Drive around in it to claim it.';
  const r = crewRacer(s, st.owner);
  const ch = challenge(s, r, h, `So you want ${h.id}? ${r.lines.taunt}`, 2);
  t.war = { hood: id, crew: st.owner, npcId: r.id, chId: ch.id, wins: 0, expires: ch.expires };
  emit('toast', { kind: 'info', text: `Turf war on for ${h.id}. ${r.nick} texted you: accept it in Messages.` });
  return '';
}

function flip(s, id, to) {
  const st = ensureTurf(s).hoods[id];
  st.owner = to; st.hold = to ? 100 : 0; st.claim = 0;
}

// A turf race just finished.
function onRace({ won, npcId }) {
  const s = game.s; if (!s || !npcId) return;
  const t = ensureTurf(s), k = myKey(s);
  const w = t.war;
  if (w && w.npcId === npcId && k) {
    const st = t.hoods[w.hood], h = HOOD_BY_ID[w.hood], them = ownerInfo(s, w.crew).name;
    if (st.owner !== w.crew) t.war = null;
    else if (won) {
      st.hold = Math.max(0, st.hold - WAR_HIT); w.wins++;
      if (st.hold <= 0) {
        flip(s, w.hood, k); t.war = null;
        if (s.crew) s.crew.rep += 300;
        addRep(s, 150, `Took ${h.id} from ${them}`);
        emit('toast', { kind: 'good', text: `${h.id} is ${k === 'me' ? s.crew.name : ownerInfo(s, k).name} turf now.` });
        emit('turf', { hood: w.hood, owner: k });
      } else {
        const r = crewRacer(s, w.crew, npcId);
        const ch = challenge(s, r, h, `${them} aren't done. ${r.lines.taunt}`, 2);
        Object.assign(w, { npcId: r.id, chId: ch.id, expires: ch.expires });
        emit('toast', { kind: 'good', text: `${h.id} is cracking: ${them} are down to ${st.hold}% hold. ${r.nick} wants a run.` });
      }
    } else {
      st.hold = Math.min(100, st.hold + 25); t.war = null; t.cooldown[w.hood] = s.time.day + 1;
      emit('toast', { kind: 'bad', text: `${them} kept ${h.id}. Regroup and try again tomorrow.` });
    }
  }
  const a = t.attack;
  if (a && a.npcId === npcId) {
    const h = HOOD_BY_ID[a.hood], them = ownerInfo(s, a.crew).name;
    t.attack = null;
    if (t.hoods[a.hood].owner !== k) return;
    if (won) {
      t.hoods[a.hood].hold = 100;
      if (s.crew) s.crew.rep += 150;
      addRep(s, 80, `Defended ${h.id}`);
      emit('toast', { kind: 'good', text: `You ran ${them} out of ${h.id}.` });
    } else {
      flip(s, a.hood, a.crew);
      emit('toast', { kind: 'bad', text: `${them} took ${h.id}.` });
      emit('turf', { hood: a.hood, owner: a.crew });
    }
  }
}

// One morning: pay the take, settle deadlines, and maybe a rival makes a move.
function newDay(s) {
  const t = ensureTurf(s), k = myKey(s);
  if (t.war && t.war.expires < s.time.day) {
    t.war = null;
    sendMessage(s, 'jojo', 'You never showed up for that turf race. Nobody takes a crew seriously that ducks its own war.');
  }
  if (t.attack && t.attack.expires < s.time.day) {
    const a = t.attack; t.attack = null;
    if (k && t.hoods[a.hood].owner === k) { flip(s, a.hood, a.crew); sendMessage(s, a.npcId, `You never came to defend ${a.hood}. It's ours now.`); emit('turf', { hood: a.hood, owner: a.crew }); }
  }
  if (!k) return;
  const mine = myHoods(s);
  for (const h of mine) t.hoods[h.id].hold = Math.min(100, t.hoods[h.id].hold + 20);
  const take = dailyTake(s);
  if (take > 0) {
    earn(s, take, `Street tax: ${mine.length} hood${mine.length === 1 ? '' : 's'}${s.crew.npcCrew ? ' (your cut)' : ''}`, { dirty: true });
    s.crew.rep += 20 * mine.length;
  }
  if (!t.attack && mine.length && Math.random() < ATTACK_CHANCE) attack(s);
}

export function attack(s, hoodId = null) {
  const t = ensureTurf(s), k = myKey(s);
  const mine = myHoods(s); if (!k || !mine.length || t.attack) return null;
  const h = hoodId ? HOOD_BY_ID[hoodId] : mine[Math.floor(Math.random() * mine.length)];
  if (!h || t.hoods[h.id].owner !== k) return null;
  const crews = Object.keys(CREWS).filter(c => c !== k && crewRacer(s, c));
  if (!crews.length) return null;
  const crew = crews[Math.floor(Math.random() * crews.length)];
  const r = crewRacer(s, crew);
  const ch = challenge(s, r, h, `${CREWS[crew].name} are taking ${h.id}. Stop me or it's ours.`, 2);
  t.attack = { hood: h.id, crew, npcId: r.id, chId: ch.id, expires: ch.expires };
  t.hoods[h.id].hold = Math.max(10, t.hoods[h.id].hold - 40);
  return t.attack;
}

// Repping an open hood: called with the player's spot every tick while in the world.
let lastHood = null;
export function presence(s, p, dt) {
  const h = hoodOf(p.x, p.z), k = myKey(s), t = ensureTurf(s);
  if (h?.id !== lastHood) {
    lastHood = h?.id || null;
    if (h && k) {
      const st = t.hoods[h.id], o = ownerInfo(s, st.owner);
      emit('toast', { kind: 'info', text: !st.owner ? `${h.id} is open turf. Drive around in it to claim it.` : o.mine ? `Back on your turf: ${h.id}.` : `Entering ${o.name} turf: ${h.id}.` });
    }
  }
  if (!h || !k || !p.inCar) return;
  const st = t.hoods[h.id];
  if (st.owner) return;
  const before = st.claim;
  st.claim = Math.min(100, st.claim + dt * 100 / CLAIM_SECS);
  if (Math.floor(st.claim / 25) > Math.floor(before / 25) && st.claim < 100) emit('toast', { kind: 'info', text: `Repping ${h.id}: ${Math.floor(st.claim)}%` });
  if (st.claim >= 100) {
    flip(s, h.id, k);
    s.crew.rep += 150;
    addRep(s, 60, `Claimed ${h.id}`);
    emit('toast', { kind: 'good', text: `${h.id} is ${ownerInfo(s, k).name} turf now. It pays ${h.take.toLocaleString()} a day in street tax.` });
    emit('turf', { hood: h.id, owner: k });
  }
}

// Run the mornings that went by (sleeping skips several).
export function catchUp(s) {
  const t = ensureTurf(s);
  for (let n = 0; t.day < s.time.day && n < 7; n++) { t.day++; newDay(s); }
  t.day = s.time.day;
}

let wired = false;
export function initTurf(app) {
  if (wired) return; wired = true;
  on('raceFinished', onRace);
  let last = performance.now();
  setInterval(() => {
    const now = performance.now(), dt = Math.min(2, (now - last) / 1000); last = now;
    const s = game.s; if (!s) return;
    catchUp(s);
    const w = app.world;
    if (app.mode === 'world' && w && !w.paused) presence(s, w.playerState(), dt);
  }, 500);
}

