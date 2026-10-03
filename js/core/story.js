// Story campaign runner + phone messages + racer challenges.

import { on, emit } from './events.js';
import { game, earn, addRep, addFollowers, uid, gameTimeStr, tierOf } from './state.js';
import { CHAPTERS, currentStep } from '../data/story.js';
import { RACERS, RACER_BY_ID, contactInfo } from '../data/npcs.js';
import { LOC_BY_ID, ROADS } from '../data/world.js';

export function sendMessage(s, from, text, extra = {}) {
  const m = { id: uid('msg'), from, text, day: s.time.day, t: gameTimeStr(s.time), read: false, ...extra };
  s.messages.unshift(m);
  if (s.messages.length > 120) s.messages.length = 120;
  if (!s.contacts.includes(from) && (contactInfo(from).name !== from)) s.contacts.push(from);
  emit('message', m);
  return m;
}

function startStep(s) {
  const step = currentStep(s.story);
  if (!step) return;
  for (const [from, text] of step.start || []) sendMessage(s, from, text, step.where ? { action: { type: 'gps', loc: step.where } } : {});
}

function complete(s, step) {
  const r = step.reward || {};
  if (r.rep) addRep(s, r.rep, 'Story');
  if (r.cash) earn(s, r.cash, `Story: ${step.objective}`);
  if (r.followers) addFollowers(s, r.followers);
  s.story.done.push(step.id);
  emit('toast', { kind: 'good', text: `Objective complete: ${step.objective}` });
  s.story.step++;
  const ch = CHAPTERS[s.story.chapter];
  if (s.story.step >= ch.steps.length) {
    s.story.chapter++;
    s.story.step = 0;
    const next = CHAPTERS[s.story.chapter];
    if (next) emit('toast', { kind: 'good', text: `${next.title}` });
  }
  startStep(s);
}

export function initStory() {
  const check = (ev, data) => {
    const s = game.s;
    if (!s || !s.story.enabled) return;
    if (ev === 'raceFinished' && data.won && data.wager > 0) s.story.counters.wagerWinnings = (s.story.counters.wagerWinnings || 0) + data.wager;
    // loop: a single event can complete consecutive steps (e.g. rep threshold)
    for (let guard = 0; guard < 4; guard++) {
      const step = currentStep(s.story);
      if (!step || !step.done(ev, data || {}, s)) break;
      complete(s, step);
    }
  };
  for (const ev of ['carBought', 'partInstalled', 'raceFinished', 'meetVisited', 'pursuitEscaped', 'crewJoined', 'rep', 'tierUp']) {
    on(ev, d => check(ev, d));
  }
}

export function beginStory(s) {
  if (s.story.enabled) startStep(s);
  else sendMessage(s, 'jojo', 'Welcome to Fort Worth! Free roam mode — no story, just you, your phone and the street. Check Marketplace for a first car.');
}

// ---------------- racer challenges ----------------
const SPOTS = { roll: ['ironside_start', 'glory_onramp', 'dustline_start', 'northridge_start'], drag: ['ironline'] };

export function maybeChallenge(s) {
  if (!s.activeCar || Math.random() > 0.22) return;
  const tier = tierOf(s.rep).n;
  const pool = RACERS.filter(r => r.tier <= tier + 1 && r.tier >= tier - 1);
  const r = pool[Math.floor(Math.random() * pool.length)];
  if (!r) return;
  const type = r.style === 'drag' ? 'drag' : 'roll';
  const spots = SPOTS[type].filter(id => (LOC_BY_ID[id].tier || 1) <= tier);
  const loc = spots[Math.floor(Math.random() * spots.length)];
  const wager = Math.round(([0, 400, 1500, 5000, 15000, 60000][r.tier] * (0.6 + Math.random() * 0.8)) / 100) * 100;
  const speeds = [30, 40, 50, 60, 70];
  const ch = {
    id: uid('ch'), npcId: r.id, type, loc, wager,
    roll: speeds[Math.floor(Math.random() * speeds.length)],
    dist: type === 'drag' ? 'quarter' : ['quarter', 'half', 'half', 'mile'][Math.floor(Math.random() * 4)],
    expires: s.time.day + 2,
  };
  const where = LOC_BY_ID[loc].name;
  const text = type === 'drag'
    ? `${r.lines.taunt} Quarter mile at ${where}. $${wager.toLocaleString()} on it.`
    : `${r.lines.taunt} ${ch.roll}-roll, ${ch.dist === 'mile' ? 'one mile' : ch.dist === 'half' ? 'half mile' : 'quarter mile'} on ${ROADS[LOC_BY_ID[loc].road]?.name || where}. $${wager.toLocaleString()}.`;
  sendMessage(s, r.id, text, { action: { type: 'challenge', challenge: ch } });
}

export { RACER_BY_ID };
