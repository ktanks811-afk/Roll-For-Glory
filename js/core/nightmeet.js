// Weekend night meets: Friday and Saturday nights a Fort Worth parking lot
// fills with builds. Crews roll in together, you pull into the spotlight for
// tips and rep, and races get set up right there and run on the street race
// routes. Pure logic so scripts/check-data.mjs can test it; the screen is in
// ui/nightmeet.js.

import { CAR_BY_ID } from '../data/cars.js';
import { RACERS, CREWS } from '../data/npcs.js';
import { STREET_RACES } from '../data/streetRaces.js';
import { judge, makeEntrants } from './carshow.js';
import { defaultVisual, partLevels } from '../data/parts.js';

export const MEET_NIGHTS = ['Fri', 'Sat'];
export const MEET_OPEN = 21, MEET_CLOSE = 3;       // 9 PM until 3 AM
export const MEET_LOC = 'gran_plaza';
export const MAX_BURNOUTS = 3;
// what a crew-vs-crew callout puts on the line, by rep tier
export const CREW_POT = [0, 1000, 2500, 6000, 15000, 40000];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayOf = d => DAYS[(((d - 1) % 7) + 7) % 7];

// The game day the meet going on right now started on, or 0 if the lot is
// empty. After midnight it still belongs to the night before.
export function meetNight(time) {
  const h = (time.min / 60) % 24;
  if (h >= MEET_OPEN && MEET_NIGHTS.includes(dayOf(time.day))) return time.day;
  if (h < MEET_CLOSE && MEET_NIGHTS.includes(dayOf(time.day - 1))) return time.day - 1;
  return 0;
}

// Your meet record. Older saves don't have one; the per-night fields reset
// when a new night starts.
export function meetRecord(s) {
  const r = (s.nightMeet ??= { night: 0, shown: false, burnouts: 0, raced: [], called: false, nights: 0, crowns: 0, tips: 0, wins: 0 });
  const n = meetNight(s.time);
  if (n && r.night !== n) Object.assign(r, { night: n, shown: false, burnouts: 0, raced: [], called: false, nights: r.nights + 1 });
  return r;
}

// How many people are out: more on Saturday, more as your name grows.
export function crowdSize(tier, night) {
  return 60 + 35 * tier + (dayOf(night) === 'Sat' ? 30 : 0);
}

const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];

// Who pulled up tonight: two or three crews with their racers (racers can be
// raced), plus locals with themed builds. `skip` is the NPC crew you run with,
// so they show up as your people instead of rivals; `mates` are racers in
// your crew (they park with you, not on the lot).
export function lineup(tier, { skip = null, mates = [], rnd = Math.random } = {}) {
  const crewIds = Object.keys(CREWS).filter(id => id !== skip && (id !== 'apex_syndicate' || tier >= 4));
  const crews = crewIds.sort(() => rnd() - 0.5).slice(0, tier >= 3 ? 3 : 2);
  const out = [];
  for (const c of crews) {
    const members = RACERS.filter(r => r.crew === c && r.tier <= tier + 1 && r.style !== 'drag' && !mates.includes(r.id)).sort((a, b) => b.tier - a.tier).slice(0, 2);
    for (const r of members) {
      const m = CAR_BY_ID[r.car.model];
      out.push({ id: 'r_' + r.id, racer: r.id, crew: c, name: `${r.name} "${r.nick}"`, nick: r.nick, modelId: m.id, year: r.car.year,
        visual: { ...defaultVisual(m), plate: r.nick.toUpperCase().slice(0, 7), ...r.car.visual }, cond: { body: 96 }, levels: partLevels(r.car.parts || {}), parts: r.car.parts || {}, color: r.color });
    }
  }
  // a couple of solo racers who'll run anybody
  const solo = RACERS.filter(r => !r.crew && r.tier <= tier + 1 && r.tier >= tier - 1 && r.style !== 'drag' && !mates.includes(r.id)).sort(() => rnd() - 0.5).slice(0, 2);
  for (const r of solo) {
    const m = CAR_BY_ID[r.car.model];
    out.push({ id: 'r_' + r.id, racer: r.id, crew: null, name: `${r.name} "${r.nick}"`, nick: r.nick, modelId: m.id, year: r.car.year,
      visual: { ...defaultVisual(m), plate: r.nick.toUpperCase().slice(0, 7), ...r.car.visual }, cond: { body: 94 }, levels: partLevels(r.car.parts || {}), parts: r.car.parts || {}, color: r.color });
  }
  // locals who came to show, not race
  for (const e of makeEntrants(tier, 9, rnd)) {
    if (out.length >= 10) break;
    if (e.id.startsWith('r_')) continue;
    out.push({ ...e, id: 'l_' + out.length, racer: null, crew: null, nick: e.name.split(' ')[0] });
  }
  const rolled = crews.filter(c => out.some(e => e.crew === c));
  for (const e of out) e.score = judge(CAR_BY_ID[e.modelId], e.visual, e.cond, e.levels).total;
  return { crews: rolled, cars: out };
}

// Crew members who roll in with you. A founder's recruits, or the NPC crew
// you joined (up to three of them).
export function crewWithYou(s) {
  if (!s.crew) return [];
  return (s.crew.members || []).map(id => RACERS.find(r => r.id === id)).filter(Boolean).slice(0, 3);
}

// Pull into the spotlight. The crowd sizes your build up against the lot.
// `crew` = how many of your crew are parked with you (each adds hype).
export function spotlight({ score, lot, tier, crowd, crew = 0, burnouts = 0, rnd = Math.random }) {
  const scores = lot.map(e => e.score);
  const avg = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
  const rank = 1 + scores.filter(x => x > score).length;
  const crown = rank === 1;
  const raw = 45 + (score - avg) * 1.1 + crew * 6 + burnouts * 5 + (crown ? 10 : 0);
  const hype = Math.round(Math.max(5, Math.min(100, raw * (0.9 + rnd() * 0.2))));
  const tips = Math.round(crowd * (hype / 100) * (2 + tier * 1.5) / 10) * 10 + (crown ? 500 * tier : 0);
  const rep = Math.round(hype / 4 * Math.sqrt(tier)) + (crown ? 25 * tier : 0);
  const followers = Math.round(hype * crowd / 25) + (crown ? 150 * tier : 0);
  return { rank, of: scores.length + 1, crown, hype, tips, rep, followers };
}

// A burnout in the aisle: the crowd goes up, and so does the chance somebody
// calls it in.
export function burnout({ hp = 200, rnd = Math.random } = {}) {
  const hype = Math.round(6 + Math.min(14, hp / 60) + rnd() * 4);
  return { hype, followers: hype * 3, heat: 0.25 };
}

// Do the cops pull in and break it up? Heat you already have and every
// burnout tonight make it likelier.
export function copsChance(heat = 0, burnouts = 0) {
  return Math.min(0.85, 0.03 + heat * 0.07 + burnouts * 0.12);
}

// A street race route for a run set up at the meet: one the player can enter.
export function meetRoute(tier, rnd = Math.random) {
  const ok = STREET_RACES.filter(ev => (ev.tier || 1) <= tier);
  return pick(rnd, ok.length ? ok : STREET_RACES);
}

// The rival crew that calls your crew out, if any: their best racer here.
export function callout(s, cars) {
  if (!s.crew) return null;
  const mine = s.crew.npcCrew;
  return cars.filter(e => e.racer && e.crew && e.crew !== mine).sort((a, b) => RACERS.find(r => r.id === b.racer).tier - RACERS.find(r => r.id === a.racer).tier)[0] || null;
}

// What winning or losing a race set up at the meet adds on top of the street
// race payout: the whole lot watched it.
export function meetRaceBonus({ won, crew, tier, pot = 0 }) {
  if (!won) return { rep: crew ? -10 * tier : 0, followers: 10, crewRep: 0, cash: crew ? -pot : 0 };
  return { rep: 20 * tier + (crew ? 40 * tier : 0), followers: 60 * tier + (crew ? 120 * tier : 0), crewRep: crew ? 250 * tier : 0, cash: crew ? pot : 0 };
}
