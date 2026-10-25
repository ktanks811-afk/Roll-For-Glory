// Throttle Gossip: the city's news and rumors in one quick list, short enough
// to read at a red light. Big things you did make the news; every hour or
// so somebody hears something (a speed trap, a meet tonight, a cheap car, a
// rival looking for you, tonight's big game). New ones pop at the top of the
// screen while you drive (main.js), and tapping the pop opens the list.
//
// Save state: s.gossip = { items: [{ id, kind: 'news'|'rumor'|'tip'|'game',
//   icon, text, day, t, loc?, x?, z? }], unseen, pops (true = pop-ups on) }.
// DOM-free; tested in scripts/check-data.mjs.

import { emit, on } from './events.js';
import { gameTimeStr, dayName } from './state.js';
import { LOCATIONS, LOC_BY_ID, districtAt } from '../data/world.js';
import { stateAt } from '../data/states.js';
import { rivalsList, heatWord, HEATED_AT } from './feed.js';
import { gamesOn, odds, american, nowMin, clock } from './sportsbook.js';
import { LEAGUES } from '../data/sports.js';
import { MEET_NIGHTS, MEET_LOC } from './nightmeet.js';

export const GOSSIP_MAX = 40;
const pick = (a, r) => a[Math.floor(r() * a.length)];

export function ensureGossip(s) {
  const g = (s.gossip ??= {});
  g.items ??= [];
  g.unseen ??= 0;
  g.pops ??= true;
  return g;
}

export function addGossip(s, item) {
  const g = ensureGossip(s);
  if (g.items.slice(0, 8).some(x => x.text === item.text)) return null;
  const it = { id: 'gs' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36), day: s.time.day, t: gameTimeStr(s.time), ...item };
  g.items.unshift(it);
  if (g.items.length > GOSSIP_MAX) g.items.length = GOSSIP_MAX;
  g.unseen++;
  emit('gossip', it);
  return it;
}
export function markGossipSeen(s) { ensureGossip(s).unseen = 0; }

// ---------------------------------------------------------------- rumors
const TRAP = [
  'Twelve sitting by {loc} with the radar gun. Slow down through {d}.',
  'Unmarked Charger posted up near {loc}. {d} is hot right now.',
  'DWI checkpoint going up by {loc} tonight. Go around {d}.',
  'Two cruisers parked behind {loc}. They pulling everybody in {d}.',
];
const STREET = [
  'Heard somebody got a turbo Mustang doing roll races off {loc}. Bring cash.',
  'Word is the Hellcat crowd is meeting by {loc} after dark.',
  'Somebody left a whole parts car behind {loc}. Free to whoever gets there first, supposedly.',
  'Taco truck by {loc} got the best al pastor in {d}. Trust.',
  'Folks saying there\'s a car show popping up at {loc} this weekend.',
  'Somebody\'s selling clean rims out the trunk by {loc}. Prices are crazy low.',
];
const CITY = [
  'Rumor is gas is going up again this week. Fill up now.',
  'They saying the Stockyards are getting a new club. Opening soon.',
  'Somebody on the east side got signed. Ask around.',
  'Heard the feds been watching a couple trap houses on the south side.',
  'Rent on the north side about to jump. Landlords talking.',
  'Somebody saw a Lambo with paper tags on I-30. Who is that?',
];

const spot = (s, r, types) => {
  const here = s.pos ? stateAt(s.pos.x, s.pos.z) : 'tx';
  const list = LOCATIONS.filter(l => types.includes(l.type) && stateAt(l.x, l.z) === here);
  return list.length ? pick(list, r) : null;
};
const fillSpot = (tpl, l) => tpl.replace('{loc}', l ? l.name.replace(/\s*\(.*?\)\s*/g, ' ').trim() : 'the gas station').replace('{d}', l ? districtAt(l.x, l.z) : 'the city');

// Somebody heard something. One rumor (or none) for this hour.
export function rumorHour(s, r = Math.random) {
  if (r() > 0.45) return null;
  const roll = r(), h = s.time.min / 60;
  // the weekend meet
  if (MEET_NIGHTS.includes(dayName(s.time)) && h >= 15 && h < 23 && roll < 0.2 && LOC_BY_ID[MEET_LOC]) {
    const l = LOC_BY_ID[MEET_LOC];
    return addGossip(s, { kind: 'rumor', icon: '🏁', text: `Everybody pulling up to ${l.name} tonight. Crews from Dallas coming too.`, loc: l.id });
  }
  // a rival talking
  const rv = rivalsList(s).find(x => x.heat >= HEATED_AT);
  if (rv && roll < 0.32) return addGossip(s, { kind: 'rumor', icon: '👀', text: `${rv.name} been telling people they're looking for you. ${heatWord(rv.heat)}.` });
  // tonight's game
  if (roll < 0.45) {
    const now = nowMin(s), g = gamesOn(s.time.day).filter(x => x.start > now).sort((a, b) => a.start - b.start)[0];
    if (g) {
      const o = odds(g, now), fav = o.h <= o.a ? g.home : g.away;
      return addGossip(s, { kind: 'game', icon: LEAGUES[g.lg].icon, text: `${g.away.name} at ${g.home.name}, ${clock(g.start, s.time.day)}. ${fav.name} ${american(Math.min(o.h, o.a))}. Get your bets in.`, gid: g.id });
    }
  }
  // speed traps
  if (roll < 0.7) {
    const l = spot(s, r, ['gas', 'food', 'corner', 'mall']);
    if (l) return addGossip(s, { kind: 'tip', icon: '🚓', text: fillSpot(pick(TRAP, r), l), loc: l.id });
  }
  if (roll < 0.88) {
    const l = spot(s, r, ['gas', 'food', 'corner', 'mall', 'meet', 'roll']);
    return addGossip(s, { kind: 'rumor', icon: '🗣', text: fillSpot(pick(STREET, r), l), loc: l?.id });
  }
  return addGossip(s, { kind: 'rumor', icon: '☕', text: pick(CITY, r) });
}

// ---------------------------------------------------------------- news
// Things that happen to you, as the news tells it.
const NEWS = {
  busted: ['Police arrest a driver after a stop in {d}. The car was towed.', 'FWPD makes an arrest in {d}. Witnesses say the driver didn\'t see it coming.'],
  escaped: ['A driver got away from FWPD in {d} tonight. Police are still looking.', 'Chase through {d} ends with police losing the car. "We\'ll find them," says FWPD.'],
  pinks: ['Somebody lost their title in a street race tonight. Pink slips are back.'],
  bigWin: ['A {amt} street race went down in {d}. The whole east side is talking.'],
  raid: ['SWAT hits a house in {d}. Neighbors say it\'s been busy for weeks.'],
  warrant: ['Warrant out for a driver tied to recent incidents. FWPD asks the public for tips.'],
};
export function news(s, kind, vars = {}, r = Math.random) {
  const t = NEWS[kind];
  if (!t) return null;
  const d = s.pos ? districtAt(s.pos.x, s.pos.z) : 'Fort Worth';
  return addGossip(s, { kind: 'news', icon: '📰', text: pick(t, r).replace('{d}', d).replace('{amt}', vars.amt || 'big money') });
}

// ---------------------------------------------------------------- wiring
let wired = false;
export function initGossip(game) {
  if (wired) return; wired = true;
  const g = fn => d => { if (game.s) fn(game.s, d || {}); };
  on('busted', g((s, d) => { if (!d.ticket) news(s, 'busted'); }));
  on('pursuitEscaped', g(s => news(s, 'escaped')));
  on('warrant', g((s, d) => { if (d.added && Math.random() < 0.5) news(s, 'warrant'); }));
  on('raceFinished', g((s, d) => {
    if (d.pinks) news(s, 'pinks');
    else if ((d.wager || 0) >= 5000) news(s, 'bigWin', { amt: '$' + Math.round(d.wager).toLocaleString('en-US') });
  }));
}
