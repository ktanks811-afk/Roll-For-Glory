// The sportsbook: real-time games on the game clock, odds, live betting and
// the LiveTicker. Every game is worked out from a seed (the day, the league
// and the time slot), so the schedule and every score are the same each time
// you look, with nothing to store but your bets. Scores come in as the game
// plays: open the app at halftime and you see the halftime score.
//
// Save state: s.book = { bets: [{ id, gid, pick: 'h'|'a', stake, dec, live,
//   day, t, done, won, paid }], won, lost } (won/lost are money totals).
// DOM-free; tested in scripts/check-data.mjs.

import { LEAGUES, LEAGUE_IDS } from '../data/sports.js';
import { DAY_NAMES } from './state.js';

export const VIG = 0.045;          // the book's cut, built into the odds
export const LIVE_CUTOFF = 0.85;   // live betting closes this far into a game
export const STAKE_MAX = [0, 1000, 5000, 20000, 50000, 100000, 250000, 500000];
const HOME_EDGE = 2.5;

export const nowMin = s => (s.time.day - 1) * 1440 + s.time.min;

// ---------------------------------------------------------------- seeds
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = hash(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- the schedule
// The games on game day `day`: [{ id, lg, home, away, start, end, p }]
// (start/end are absolute game minutes; p = chance the home side wins).
export function gamesOn(day) {
  const dn = DAY_NAMES[(day - 1) % 7], out = [];
  for (const lg of LEAGUE_IDS) {
    const L = LEAGUES[lg];
    if (!L.days.includes(dn)) continue;
    const r = rng(`${lg}:${day}:card`);
    // a different set of matchups every day, nobody plays twice the same day
    const order = L.teams.map((t, i) => [r(), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    L.slots.forEach((slot, k) => {
      const hi = order[k * 2], ai = order[k * 2 + 1];
      if (hi == null || ai == null) return;
      const h = L.teams[hi], a = L.teams[ai];
      const start = (day - 1) * 1440 + slot;
      const p = 1 / (1 + Math.pow(10, -((h[2] + (lg === 'fight' ? 0 : HOME_EDGE)) - a[2]) / 14));
      out.push({ id: `${day}:${lg}:${k}`, lg, home: { name: h[0], ab: h[1] }, away: { name: a[0], ab: a[1] }, start, end: start + L.len, p });
    });
  }
  return out.sort((a, b) => a.start - b.start);
}
export function gameById(id) {
  const day = +String(id).split(':')[0];
  return day > 0 ? gamesOn(day).find(g => g.id === id) || null : null;
}

// ---------------------------------------------------------------- playing a game
// The final score and when each score happened: { h, a, events: [{ at, side, pts }] }
// (at = 0..1 of the way through). Ties don't happen; fights end in a KO or the cards.
const cache = new Map();
export function playOut(g) {
  if (cache.has(g.id)) return cache.get(g.id);
  const r = rng(g.id + ':play'), L = LEAGUES[g.lg];
  const homeWins = r() < g.p;
  const ev = [];
  const add = (side, pts, at) => ev.push({ at, side, pts });
  let h = 0, a = 0;
  if (L.score === 'fight') {
    const ko = r() < 0.55, at = ko ? 0.15 + r() * 0.8 : 1;
    add(homeWins ? 'h' : 'a', 1, at);
    if (homeWins) h = 1; else a = 1;
    const out = { h, a, events: ev, ko, round: ko ? Math.min(5, 1 + Math.floor(at * 5)) : 5 };
    cache.set(g.id, out); return out;
  }
  const gen = () => {
    if (L.score === 'football') { const n = 3 + Math.floor(r() * 5); let t = 0; for (let i = 0; i < n; i++) t += r() < 0.62 ? 7 : 3; return t; }
    if (L.score === 'hoops') return 92 + Math.floor(r() * 36);
    if (L.score === 'baseball') return Math.floor(r() * r() * 9);
    return Math.floor(r() * r() * 6);   // hockey
  };
  let w = gen(), l = gen();
  if (l >= w) { const bump = L.score === 'football' ? (r() < 0.5 ? 3 : 7) : L.score === 'hoops' ? 1 + Math.floor(r() * 12) : 1; w = l + bump; }
  h = homeWins ? w : l; a = homeWins ? l : w;
  const chunks = (side, total) => {
    let left = total;
    while (left > 0) {
      const pts = L.score === 'football' ? (left % 7 === 0 || left >= 10 && r() < 0.62 ? Math.min(7, left) : Math.min(3, left)) : L.score === 'hoops' ? Math.min(left, 2 + Math.floor(r() * 9)) : 1;
      add(side, pts, 0.02 + r() * 0.96); left -= pts;
    }
  };
  chunks('h', h); chunks('a', a);
  ev.sort((x, y) => x.at - y.at);
  const out = { h, a, events: ev };
  cache.set(g.id, out); return out;
}

// Where a game stands at game minute `now`:
// { state: 'pre'|'live'|'final', f (0..1), h, a, label }
export function scoreAt(g, now) {
  const L = LEAGUES[g.lg], po = playOut(g);
  if (now < g.start) return { state: 'pre', f: 0, h: 0, a: 0, label: '' };
  let f = Math.min(1, (now - g.start) / (g.end - g.start));
  if (L.score === 'fight' && po.ko && f >= po.events[0].at) f = 1;
  let h = 0, a = 0;
  for (const e of po.events) if (e.at <= f) { if (e.side === 'h') h += e.pts; else a += e.pts; }
  if (f >= 1) {
    const label = L.score === 'fight' ? (po.ko ? `KO R${po.round}` : 'Decision') : 'Final';
    return { state: 'final', f: 1, h: po.h, a: po.a, label };
  }
  const per = Math.min(L.per, 1 + Math.floor(f * L.per));
  const label = L.score === 'baseball' ? `${(f * L.per) % 1 < 0.5 ? 'Top' : 'Bot'} ${per}` : `${L.perName}${per}`;
  return { state: 'live', f, h, a, label };
}

// ---------------------------------------------------------------- odds
// The book's chance on the home side right now: the pregame line, moved by
// the score and how much time is left. (It doesn't know how it ends.)
export function liveP(g, now) {
  const sc = scoreAt(g, now), L = LEAGUES[g.lg];
  if (sc.state === 'final') return sc.h > sc.a ? 1 : 0;
  if (sc.state === 'pre' || L.score === 'fight') return g.p;
  const left = Math.max(0.02, 1 - sc.f);
  const scale = { football: 14, hoops: 13, baseball: 3.2, hockey: 2.2 }[L.score] || 10;
  const z0 = Math.log(g.p / (1 - g.p));                              // the pregame edge…
  const lead = (sc.h - sc.a) / (scale * Math.sqrt(left));            // …and the lead, worth more as the clock runs down
  return 1 / (1 + Math.exp(-(z0 * Math.sqrt(left) + lead * 1.7)));
}
// Decimal payout (stake x this comes back on a win) for picking side `pick`.
export function priceOf(p) { const q = Math.min(0.97, Math.max(0.03, p * (1 + VIG))); return Math.round(100 / q) / 100; }
export function odds(g, now) { const p = liveP(g, now); return { h: priceOf(p), a: priceOf(1 - p) }; }
// American odds, like the ticker shows (-150, +130).
export function american(dec) { return dec >= 2 ? `+${Math.round((dec - 1) * 100)}` : `${-Math.round(100 / (dec - 1))}`; }

// ---------------------------------------------------------------- bets
export function ensureBook(s) {
  s.book ??= {};
  s.book.bets ??= [];
  s.book.won ??= 0;
  s.book.lost ??= 0;
  return s.book;
}
export const stakeMax = tier => STAKE_MAX[Math.max(1, Math.min(STAKE_MAX.length - 1, tier))];

// Can you bet on game g right now? '' if yes, else why not.
export function closedWhy(g, now) {
  const sc = scoreAt(g, now);
  if (sc.state === 'final') return 'That one\'s over.';
  if (sc.state === 'live' && (sc.f >= LIVE_CUTOFF || LEAGUES[g.lg].score === 'fight')) return 'Betting is closed on this one.';
  return '';
}

// Place a bet. pay(amount, label) -> bool. Returns { ok, text, bet }.
export function placeBet(s, gid, pick, stake, tier, pay) {
  const g = gameById(gid), now = nowMin(s);
  stake = Math.round(stake);
  if (!g) return { ok: false, text: 'That game isn\'t on the board.' };
  const why = closedWhy(g, now);
  if (why) return { ok: false, text: why };
  if (pick !== 'h' && pick !== 'a') return { ok: false, text: 'Pick a side.' };
  if (!(stake >= 10)) return { ok: false, text: 'The minimum bet is $10.' };
  const max = stakeMax(tier);
  if (stake > max) return { ok: false, text: `Your limit is $${max.toLocaleString('en-US')} a bet. More rep, bigger limit.` };
  const side = pick === 'h' ? g.home : g.away, dec = odds(g, now)[pick];
  if (!pay(stake, `Bet: ${side.name} (${LEAGUES[g.lg].short})`)) return { ok: false, text: 'You don\'t have that much cash on you.' };
  const live = scoreAt(g, now).state === 'live';
  const bet = { id: 'bet' + now.toString(36) + Math.floor(Math.random() * 1e6).toString(36), gid, pick, stake, dec, live, day: s.time.day, t: s.time.min };
  ensureBook(s).bets.unshift(bet);
  if (s.book.bets.length > 60) s.book.bets.length = 60;
  return { ok: true, bet, text: `$${stake.toLocaleString('en-US')} on ${side.name} at ${american(dec)}. Pays $${Math.round(stake * dec).toLocaleString('en-US')}.` };
}

// Settle every bet whose game is over. pay(amount, label) puts winnings in
// your pocket. Returns [{ bet, game, won, amount, text }].
export function settleBets(s, pay) {
  const b = ensureBook(s), now = nowMin(s), out = [];
  for (const bet of b.bets) {
    if (bet.done) continue;
    const g = gameById(bet.gid);
    if (!g) { bet.done = true; continue; }
    const sc = scoreAt(g, now);
    if (sc.state !== 'final') continue;
    const won = (sc.h > sc.a) === (bet.pick === 'h');
    bet.done = true; bet.won = won;
    const side = bet.pick === 'h' ? g.home : g.away, other = bet.pick === 'h' ? g.away : g.home;
    if (won) { bet.paid = Math.round(bet.stake * bet.dec); b.won += bet.paid - bet.stake; pay(bet.paid, `Bet won: ${side.name}`); }
    else b.lost += bet.stake;
    out.push({ bet, game: g, won, amount: won ? bet.paid : bet.stake, text: `${won ? '✅' : '❌'} ${side.name} ${won ? 'beat' : 'lost to'} ${other.name} ${Math.max(sc.h, sc.a)}-${Math.min(sc.h, sc.a)}. ${won ? `You collect $${bet.paid.toLocaleString('en-US')}.` : `You lose $${bet.stake.toLocaleString('en-US')}.`}` });
  }
  return out;
}

// ---------------------------------------------------------------- the LiveTicker
// What's on now, what just ended and what's next: [{ id, lg, icon, text, live, mine }]
export function ticker(s, { max = 14 } = {}) {
  const now = nowMin(s), day = s.time.day;
  const mine = new Set(ensureBook(s).bets.filter(b => !b.done).map(b => b.gid));
  const games = [...gamesOn(day - 1), ...gamesOn(day), ...gamesOn(day + 1)].filter(g => g.end > now - 240 && g.start < now + 1440);
  const items = games.map(g => {
    const sc = scoreAt(g, now), L = LEAGUES[g.lg], o = odds(g, now);
    const fav = o.h <= o.a ? g.home : g.away, favDec = Math.min(o.h, o.a);
    const text = sc.state === 'pre'
      ? `${g.away.ab} @ ${g.home.ab} · ${clock(g.start, day)} · ${fav.ab} ${american(favDec)}`
      : `${g.away.ab} ${sc.a} – ${g.home.ab} ${sc.h} · ${sc.label}`;
    return { id: g.id, lg: g.lg, icon: L.icon, text, live: sc.state === 'live', final: sc.state === 'final', mine: mine.has(g.id), start: g.start };
  });
  const rank = x => (x.mine ? 0 : 3) + (x.live ? 0 : x.final ? 2 : 1);
  return items.sort((a, b) => rank(a) - rank(b) || a.start - b.start).slice(0, max);
}
export function clock(abs, today) {
  const day = Math.floor(abs / 1440) + 1, m = abs % 1440, h = Math.floor(m / 60), mm = m % 60;
  const t = `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  return day === today ? t : day === today + 1 ? `Tmrw ${t}` : `${DAY_NAMES[(day - 1) % 7]} ${t}`;
}
