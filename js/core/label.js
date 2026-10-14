// Your record label. Start one, find artists where they hang out around Fort
// Worth and Dallas, sign them in person, cut records at a studio, drop them
// with a promo budget, and the streams pay the label every day. Artists grow
// their fanbase, play weekend shows, get locked up, and want a bigger cut
// once they blow up. Rival labels chase the same talent and poach yours, a
// showcase every month brings in new names, the label fronts shows and tours
// (recouped from the artist's back end, same as bail), and SoundScan ranks
// everybody each week. DOM-free so check-data can test it.

import { spend, earnBank, fmtMoney, dayName } from './state.js';
import { LOC_BY_ID } from '../data/world.js';
import { LABEL_COST, STREAM_PAY, MAX_ROSTER, STUDIOS, KINDS, KIND_IDS, PROMO_BY_ID, ARTISTS, ARTIST_BY_ID, TITLE_A, TITLE_B, PRODUCER_BY_ID,
  RIVALS, RIVAL_BY_ID, RIVAL_ROSTER, NEW_FIRST, NEW_CORE, NEW_LAST, NEW_GENRES, NEW_HOODS, NEW_BIOS, SHOWCASE_SPOTS, MONTH,
  GIG_BY_ID, LABEL_SHOW_SHARE, MERCH } from '../data/label.js';

const err = text => ({ ok: false, text });
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const R = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const MEET_RANGE = 70;            // how close you have to be to an artist's spot to sign them
const KNOWN_AT_START = 6;
export const STANDARD_CUT = 0.2, CHEAP_CUT = 0.4, CHEAP_ADVANCE = 0.35;

export function ensureLabel(s) {
  s.label ??= { name: null, founded: null, clout: 0, known: [], roster: [], sessions: [], releases: [], earned: 0, streams: 0, log: [] };
  const L = s.label;
  if (!L.known.length) L.known = ARTISTS.filter(a => !cloutNeeded(a)).sort(() => Math.random() - 0.5).slice(0, KNOWN_AT_START).map(a => a.id);
  L.newcomers ??= []; L.rivalOf ??= {}; L.rv ??= {}; L.recouped ??= 0;
  L.ss ??= { wk: weekOf(s.time.day), cur: {}, hist: [] };
  for (const a of L.newcomers) ARTIST_BY_ID[a.id] = a;
  for (const r of L.roster) { r.mood ??= 70; r.debt ??= 0; r.wallet ??= 0; r.nextAsk ??= s.time.day + 20; r.gigs ??= []; }
  // every rival starts with a few artists of their own
  if (!L.seeded) {
    L.seeded = true;
    for (const rv of RIVALS) for (let i = 0; i < 3; i++) toRival(s, newArtist(s, rv.reach - 6).id, rv.id, 90 + Math.round(Math.random() * 200));
  }
  return L;
}
export const hasLabel = s => !!s.label?.name;
export const signed = (s, id) => s.label?.roster.find(r => r.id === id);
export const artistName = id => ARTIST_BY_ID[id]?.name || id;

export function startLabel(s, name) {
  const L = ensureLabel(s);
  if (L.name) return err('You already run a label.');
  name = String(name || '').trim().slice(0, 32);
  if (name.length < 2) return err('Give the label a name.');
  if (!spend(s, LABEL_COST, `Started ${name}`)) return err(`Starting a label costs ${fmtMoney(LABEL_COST)}.`);
  L.name = name; L.founded = s.time.day;
  return { ok: true, text: `${name} is official. Go find some talent.` };
}

// ---------------------------------------------------------------- scouting + signing
// Clout the label needs before this artist takes the meeting.
export const cloutNeeded = a => Math.max(0, Math.round((a.talent - 66) * 3));
// What they want up front, now (their fans grow while they wait).
export function askOf(s, a) {
  const buzz = buzzOf(s, a.id);
  return Math.round((Math.pow(a.talent, 3) / 45 + buzz * 0.4) / 100) * 100;
}
export const buzzOf = (s, id) => signed(s, id)?.buzz ?? s.label?.scene?.[id]?.buzz ?? ARTIST_BY_ID[id]?.buzz ?? 0;
export const stars = talent => Math.round(clamp(talent / 20, 0.5, 5) * 2) / 2;

export function dealsFor(s, a) {
  const ask = askOf(s, a), rv = rivalOf(s, a.id);
  if (rv) return { buyout: { advance: buyoutOf(s, a), cut: STANDARD_CUT } };
  return {
    standard: { advance: ask, cut: STANDARD_CUT },
    cheap: { advance: Math.round(ask * CHEAP_ADVANCE / 100) * 100, cut: CHEAP_CUT },
  };
}
// What it takes to buy an artist out of a rival's contract: their ask plus what the rival paid.
export const buyoutOf = (s, a) => Math.round(askOf(s, a) * 1.5 * (rivalOf(s, a.id)?.bid || 1) / 100) * 100;

// Why you can't sign this artist right now, or null. `near` is whether you're standing at their spot.
export function signBlock(s, id, near, deal = null) {
  const L = ensureLabel(s), a = ARTIST_BY_ID[id];
  if (!a) return 'Nobody by that name.';
  if (!L.name) return 'Start your label first.';
  if (signed(s, id)) return `${a.name} is already on ${L.name}.`;
  const rv = rivalOf(s, id);
  if (!L.known.includes(id) && !a.featured && !rv) return 'You haven\'t heard of them yet.';
  if (rv && deal !== 'buyout') return `${a.name} is signed to ${rv.name} till day ${L.rivalOf[id].until}. You'd have to buy out the deal.`;
  if (L.roster.length >= MAX_ROSTER) return `Your roster is full (${MAX_ROSTER}). Drop somebody first.`;
  if ((L.cooldown?.[id] || 0) > s.time.day) return `${a.name} isn't taking your calls right now.`;
  if (L.clout < cloutNeeded(a)) return `${a.name} wants to see a label with a hit first (clout ${Math.floor(L.clout)} of ${cloutNeeded(a)}).`;
  if (!near) return `You have to meet ${a.name} in person.`;
  return null;
}

export function signArtist(s, id, deal = 'standard', near = true) {
  const L = ensureLabel(s), a = ARTIST_BY_ID[id];
  const why = signBlock(s, id, near, deal);
  if (why) return err(why);
  const d = dealsFor(s, a)[deal];
  if (!d) return err('No such deal.');
  const rv = rivalOf(s, id);
  if (!spend(s, d.advance, `${a.name}: ${rv ? `buyout from ${rv.name}` : 'signing advance'}`)) return err(`${rv ? 'The buyout' : 'The advance'} is ${fmtMoney(d.advance)}.`);
  delete L.rivalOf[id];
  addToRoster(s, id, d);
  return { ok: true, text: `${a.name} signed to ${L.name}${rv ? `, bought out from ${rv.name}` : ''}. They keep ${Math.round(d.cut * 100)}% of the royalties.` };
}
function addToRoster(s, id, d) {
  const L = s.label, b = buzzOf(s, id);
  if (!L.known.includes(id)) L.known.push(id);
  L.roster.push({ id, signedDay: s.time.day, cut: d.cut, advance: d.advance, buzz: b, buzz0: b, jailed: null, demand: null, shows: 0, mood: 70, debt: 0, wallet: 0, nextAsk: s.time.day + 30 + Math.round(Math.random() * 15), gigs: [] });
}

export function dropArtist(s, id) {
  const L = ensureLabel(s), r = signed(s, id);
  if (!r) return err('They\'re not on your label.');
  L.roster = L.roster.filter(x => x.id !== id);
  L.sessions = L.sessions.filter(x => x.artist !== id);
  (L.scene ??= {})[id] = { buzz: r.buzz };
  (L.cooldown ??= {})[id] = s.time.day + 14;
  return { ok: true, text: `You let ${artistName(id)} go. Their records stay in your catalog.${r.debt >= 1 ? ` The ${fmtMoney(Math.round(r.debt))} they owed is written off.` : ''}` };
}

// ---------------------------------------------------------------- the studio
export function sessionCost(studioId, kind) { return Math.round(KINDS[kind].cost * (STUDIOS[studioId]?.rate || 1)); }

export function bookSession(s, studioId, artistId, kind, producerId = null) {
  const L = ensureLabel(s), r = signed(s, artistId), K = KINDS[kind], st = STUDIOS[studioId];
  if (!L.name) return err('Start your label first.');
  if (!st || !K) return err('Pick a studio and a project.');
  if (!r) return err('Sign them first.');
  if (r.jailed) return err(`${artistName(artistId)} is in jail. Bail them out first.`);
  if (r.gig) return err(`${artistName(artistId)} is out doing shows till day ${r.gig.end}.`);
  if (L.sessions.some(x => x.artist === artistId && !x.done)) return err(`${artistName(artistId)} is already in the studio.`);
  const cost = sessionCost(studioId, kind);
  const producer = producerId ? PRODUCER_BY_ID[producerId] : null;
  if (producerId && !producer) return err('That producer is unavailable.');
  const a = ARTIST_BY_ID[artistId];
  const producerQ = producer?.q || 0;
  const producerRate = producer?.rate || 1;
  const finalCost = Math.round(cost * producerRate);
  if (!spend(s, finalCost, `${st.name}: ${K.name}${producer ? ` with ${producer.name}` : ''}`)) return err(`The session is ${fmtMoney(finalCost)}.`);
  const quality = Math.round(clamp(a.talent * 0.82 + st.q + producerQ + R(-10, 14) + (kind === 'album' ? 3 : 0), 5, 99));
  const ses = { id: 'ses' + Math.random().toString(36).slice(2, 8), artist: artistId, producer: producerId || null, kind, studio: studioId, start: s.time.day, ready: s.time.day + K.days, quality, title: makeTitle(), done: false };
  L.sessions.push(ses);
  return { ok: true, ses, text: `${a.name} is in the booth at ${st.name}${producer ? ` with ${producer.name}` : ''}. The ${K.name.toLowerCase()} is done in ${K.days} day${K.days > 1 ? 's' : ''}.` };
}
export const makeTitle = () => `${pick(TITLE_A)} ${pick(TITLE_B)}`;
export const finished = s => (s.label?.sessions || []).filter(x => !x.done && x.ready <= s.time.day);

// Quality words, for sessions and releases.
export const gradeOf = q => q >= 88 ? 'Classic' : q >= 78 ? 'Fire' : q >= 66 ? 'Solid' : q >= 52 ? 'Decent' : q >= 38 ? 'Mid' : 'Trash';

// Day-one streams for a record of this quality, by an artist with this many fans.
export function dayOne(quality, buzz, kind, lift = 1) {
  return Math.round(Math.pow(quality / 50, 3) * 40000 * Math.pow(1 + buzz / 20000, 0.6) * KINDS[kind].mult * lift);
}

export function release(s, sesId, promoId = 'none', rnd = Math.random) {
  const L = ensureLabel(s), ses = L.sessions.find(x => x.id === sesId), P = PROMO_BY_ID[promoId];
  if (!ses || ses.done) return err('Nothing to release.');
  if (ses.ready > s.time.day) return err('It\'s not finished yet.');
  if (!P) return err('Pick a promo plan.');
  const r = signed(s, ses.artist);
  if (P.cost && !spend(s, P.cost, `Promo: ${ses.title}`)) return err(`That promo costs ${fmtMoney(P.cost)}.`);
  const buzz = r?.buzz ?? buzzOf(s, ses.artist);
  const viral = rnd() < 0.04 + P.viral + Math.max(0, ses.quality - 70) / 200;
  const first = Math.round(dayOne(ses.quality, buzz, ses.kind, P.lift) * (viral ? 3 : 1));
  const rel = { id: 'rel' + Math.random().toString(36).slice(2, 8), artist: ses.artist, title: ses.title, kind: ses.kind, quality: ses.quality, day: s.time.day, promo: promoId, viral, daily: first, peak: first, total: 0, earned: 0, last: 0, sales: 0 };
  ses.done = true;
  L.sessions = L.sessions.filter(x => !x.done);
  L.releases.unshift(rel);
  if (L.releases.length > 60) L.releases.length = 60;
  const word = KINDS[ses.kind].name.toLowerCase();
  return { ok: true, rel, text: viral ? `"${rel.title}" went viral on Throttle. ${fmtStreams(first)} streams on day one.` : `"${rel.title}" is out. The ${word} should do about ${fmtStreams(first)} streams tomorrow.` };
}

export function fmtStreams(n) { return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(Math.round(n)); }
// Where a release sits on the Throttle chart today (null below #100).
export function chartPos(daily) {
  if (!(daily > 0)) return null;
  const p = Math.round(100 * Math.pow(20000 / daily, 0.55));
  return p <= 100 ? Math.max(1, p) : null;
}

// ---------------------------------------------------------------- trouble
export const bailOf = r => Math.round((5000 + r.buzz * 0.08) / 100) * 100;
export function postBail(s, id) {
  const r = signed(s, id);
  if (!r?.jailed) return err('They\'re not locked up.');
  const b = r.jailed.bail;
  if (!spend(s, b, `Bail: ${artistName(id)}`)) return err(`Bail is ${fmtMoney(b)}.`);
  r.jailed = null;
  r.debt = (r.debt || 0) + b;
  r.mood = Math.min(100, (r.mood ?? 70) + 15);
  return { ok: true, text: `${artistName(id)} is out. "I owe you." The ${fmtMoney(b)} goes on their tab and comes out of their royalties.` };
}

// What they're asking for: a bigger cut, or a cash bonus.
export const demandText = d => d.bonus ? `a ${fmtMoney(d.bonus)} bonus` : `${Math.round(d.cut * 100)}% of the royalties`;
export function answerDemand(s, id, yes, rnd = Math.random) {
  const r = signed(s, id);
  if (!r?.demand) return err('Nothing to answer.');
  const d = r.demand, name = artistName(id);
  if (yes) {
    if (d.bonus) { if (!spend(s, d.bonus, `${name}: bonus`)) return err(`The bonus is ${fmtMoney(d.bonus)}.`); }
    else r.cut = d.cut;
    r.demand = null; r.mood = Math.min(100, (r.mood ?? 70) + 20); r.nextAsk = s.time.day + 30 + Math.round(rnd() * 20);
    return { ok: true, text: d.bonus ? `${name} got the bonus. They're happy.` : `${name} keeps ${Math.round(r.cut * 100)}% now. They're happy.` };
  }
  r.demand = null; r.nextAsk = s.time.day + 25 + Math.round(rnd() * 15);
  if (rnd() < leaveOdds(r)) { const x = leaveForRival(s, id, rnd); return { ok: true, left: true, paid: x.paid, text: `${name} walked. ${x.text}` }; }
  r.mood = Math.max(0, (r.mood ?? 70) - 25);
  return { ok: true, text: `${name} is mad, but they're staying. Rival labels can smell it.` };
}
// The chance they walk when you say no. Unhappy artists walk more.
export const leaveOdds = r => clamp(0.25 + (60 - (r.mood ?? 70)) / 100, 0.15, 0.85);

// A rival is offering one of your artists a deal. Match it with a re-up bonus, or let them go.
export function answerOffer(s, id, match) {
  const r = signed(s, id);
  if (!r?.offer) return err('Nobody is offering them anything.');
  const o = r.offer, rv = RIVAL_BY_ID[o.rival], name = artistName(id);
  if (match) {
    if (!spend(s, o.amount, `${name}: re-up bonus`)) return err(`Matching takes ${fmtMoney(o.amount)}.`);
    r.offer = null; r.mood = Math.min(100, (r.mood ?? 70) + 35);
    return { ok: true, text: `You matched ${rv.name}. ${name} is staying with you.` };
  }
  const x = leaveForRival(s, id, Math.random, o.rival);
  return { ok: true, left: true, paid: x.paid, text: `${name} signed with ${rv.name}. ${x.text}` };
}

// An artist leaves your label for a rival. The rival pays off what they owe you.
function leaveForRival(s, id, rnd = Math.random, rid = null) {
  const r = signed(s, id), a = ARTIST_BY_ID[id];
  const rv = RIVAL_BY_ID[rid] || bestRival(s, a, rnd) || RIVALS[RIVALS.length - 1];
  const debt = Math.round(r?.debt || 0);
  if (r) r.debt = 0;
  dropArtist(s, id);
  toRival(s, id, rv.id, 120 + Math.round(rnd() * 120));
  if (debt > 0) { earnBank(s, debt, `${rv.name} paid off ${a.name}'s debt`); s.label.recouped += debt; }
  return { paid: debt, text: `${rv.name} picked them up${debt > 0 ? ` and paid off the ${fmtMoney(debt)} they owed you` : ''}. Their records stay in your catalog.` };
}

// ---------------------------------------------------------------- rival labels
export const rivalOf = (s, id) => { const c = s.label?.rivalOf?.[id]; return c && c.until > s.time.day ? RIVAL_BY_ID[c.rival] : null; };
export const rivalRoster = (s, rid) => Object.entries(s.label?.rivalOf || {}).filter(([, c]) => c.rival === rid && c.until > s.time.day).map(([id]) => id);
function toRival(s, id, rid, days) { s.label.rivalOf[id] = { rival: rid, until: s.time.day + days }; }
// What a rival would pay this artist up front.
export const rivalBid = (s, a, rv, rnd = Math.random) => Math.round(askOf(s, a) * rv.bid * (0.9 + rnd() * 0.3) / 100) * 100;
// The rival that wants this artist most and has room for them.
function bestRival(s, a, rnd = Math.random) {
  const ok = RIVALS.filter(rv => rv.reach >= a.talent && rivalRoster(s, rv.id).length < RIVAL_ROSTER);
  return ok.length ? ok[Math.floor(rnd() * ok.length * 0.999)] : null;
}
// A brand new name on the scene (showcases, rival signings).
function newArtist(s, top = 75) {
  const L = s.label;
  let name = '';
  for (let i = 0; i < 25; i++) { name = `${pick(NEW_FIRST)} ${pick(NEW_CORE)}${pick(NEW_LAST)}`.trim(); if (!Object.values(ARTIST_BY_ID).some(a => a.name === name)) break; }
  const talent = Math.round(R(42, Math.max(52, top)));
  const a = { id: 'nc_' + Math.random().toString(36).slice(2, 9), name, real: name, genre: pick(NEW_GENRES), hood: pick(NEW_HOODS), hang: pick(SHOWCASE_SPOTS), talent, buzz: Math.round(R(300, 1200) + talent * 20), bio: pick(NEW_BIOS), newcomer: true, born: s.time.day, ...(Math.random() < 0.35 ? { street: true } : {}) };
  L.newcomers.push(a); ARTIST_BY_ID[a.id] = a;
  return a;
}

// ---------------------------------------------------------------- the monthly showcase
// Every 28 days the A&R puts four upcoming artists on a stage. Rivals show up
// with offers; beat them in person on the night or they sign with somebody else.
export const nextShowcase = day => Math.ceil(day / MONTH) * MONTH;
function announceShowcase(s, day, rnd) {
  const L = s.label, lineup = [], bids = {}, perf = {};
  for (let i = 0; i < 4; i++) {
    const a = newArtist(s, 82);
    lineup.push(a.id);
    perf[a.id] = Math.round(clamp(a.talent + R(-14, 16), 10, 99));
    const rv = bestRival(s, a, rnd);
    if (rv && rnd() < 0.85) bids[a.id] = { rival: rv.id, amount: rivalBid(s, a, rv, rnd) };
  }
  L.showcase = { day, loc: SHOWCASE_SPOTS[Math.floor(day / MONTH) % SHOWCASE_SPOTS.length], lineup, bids, perf, signed: {}, done: false };
  return L.showcase;
}
// What it takes to sign a showcase act: beat the best rival offer.
export function showcasePrice(s, id) {
  const sc = s.label?.showcase, a = ARTIST_BY_ID[id];
  const bid = sc?.bids?.[id]?.amount || 0;
  return Math.max(Math.round(askOf(s, a) * 0.8 / 100) * 100, Math.round(bid * 1.1 / 100) * 100);
}
export function showcaseBlock(s, id, near) {
  const L = ensureLabel(s), sc = L.showcase;
  if (!L.name) return 'Start your label first.';
  if (!sc || !sc.lineup.includes(id)) return 'They\'re not on the showcase.';
  if (sc.signed[id]) return sc.signed[id] === 'you' ? 'Already yours.' : `${RIVAL_BY_ID[sc.signed[id]]?.name || 'Someone'} got them.`;
  if (s.time.day < sc.day) return `The showcase is day ${sc.day}.`;
  if (s.time.day > sc.day) return 'The showcase is over.';
  if (L.roster.length >= MAX_ROSTER) return `Your roster is full (${MAX_ROSTER}).`;
  if (!near) return `Be at ${LOC_BY_ID[sc.loc]?.name || 'the showcase'} tonight to make your offer.`;
  return null;
}
export function signAtShowcase(s, id, near = true) {
  const why = showcaseBlock(s, id, near);
  if (why) return err(why);
  const sc = s.label.showcase, a = ARTIST_BY_ID[id], price = showcasePrice(s, id);
  if (!spend(s, price, `${a.name}: showcase signing`)) return err(`It takes ${fmtMoney(price)} to beat the other offers.`);
  sc.signed[id] = 'you';
  addToRoster(s, id, { advance: price, cut: STANDARD_CUT });
  const beat = sc.bids[id] ? ` You beat ${RIVAL_BY_ID[sc.bids[id].rival].name}.` : '';
  return { ok: true, text: `${a.name} signed to ${s.label.name} off the showcase stage.${beat}` };
}

// ---------------------------------------------------------------- shows and tours
// The label fronts the money. If the artist has cash of their own and no debt
// they chip in first; whatever the label puts up goes on their tab and comes
// back out of their share of the door, the merch and their royalties.
export function gigFront(r, G) { const own = (r.debt || 0) >= 1 ? 0 : Math.min(Math.floor(r.wallet || 0), G.front); return { own, label: G.front - own }; }
export const gigFans = (r, G) => Math.min(G.cap, Math.round(r.buzz * G.draw));
export const gigForecast = (r, G) => Math.round(gigFans(r, G) * G.nights * G.ticket * (1 + MERCH));
export function gigBlock(s, id, gigId) {
  const L = s.label, r = signed(s, id), G = GIG_BY_ID[gigId];
  if (!r) return 'Sign them first.';
  if (!G) return 'No such show.';
  if (r.jailed) return `${artistName(id)} is in jail.`;
  if (r.gig) return `${artistName(id)} is already booked till day ${r.gig.end}.`;
  if (L.sessions.some(x => x.artist === id && !x.done && x.ready > s.time.day)) return `${artistName(id)} is in the studio.`;
  if (r.buzz < G.minFans) return `Promoters want ${G.minFans.toLocaleString()} fans for a ${G.name.toLowerCase()}.`;
  return null;
}
export function bookGig(s, id, gigId) {
  const why = gigBlock(s, id, gigId);
  if (why) return err(why);
  const r = signed(s, id), G = GIG_BY_ID[gigId], f = gigFront(r, G);
  if (f.label > 0 && !spend(s, f.label, `Fronted ${artistName(id)}: ${G.name}`)) return err(`The label has to front ${fmtMoney(f.label)}.`);
  r.wallet -= f.own; r.debt += f.label;
  r.gig = { id: gigId, start: s.time.day, end: s.time.day + G.days, front: G.front, fronted: f.label };
  return { ok: true, text: `${artistName(id)} is booked: ${G.name} at ${G.venue}. ${f.label ? `You fronted ${fmtMoney(f.label)}, it's on their tab.` : 'They paid for it themselves.'}${f.own && f.label ? ` They put in ${fmtMoney(f.own)}.` : ''}` };
}
function settleGig(s, r, rnd) {
  const G = GIG_BY_ID[r.gig.id], a = ARTIST_BY_ID[r.id];
  let fans = 0;
  for (let n = 0; n < G.nights; n++) fans += Math.min(G.cap, Math.round(r.buzz * G.draw * (0.65 + rnd() * 0.6) * (0.8 + (r.mood ?? 70) / 350)));
  const door = fans * G.ticket, total = Math.round(door * (1 + MERCH));
  const label = Math.round(total * LABEL_SHOW_SHARE), artist = total - label;
  const rec = Math.min(r.debt, artist);
  r.debt -= rec; r.wallet += artist - rec;
  r.buzz = Math.round(Math.min(5e6, r.buzz + fans * 0.6));
  const full = fans / (G.cap * G.nights);
  r.mood = clamp((r.mood ?? 70) + (full > 0.7 ? 6 : full < 0.35 ? -10 : 0), 0, 100);
  r.shows += G.nights;
  const log = { id: G.id, day: s.time.day, fans, total, label, recouped: Math.round(rec), front: r.gig.front };
  r.gigs.unshift(log); if (r.gigs.length > 8) r.gigs.length = 8;
  r.gig = null;
  const pay = label + Math.round(rec);
  const verdict = full > 0.9 ? 'Sold out.' : full > 0.6 ? 'Good crowd.' : full > 0.35 ? 'Half empty.' : 'Rough night. Nobody came.';
  return { pay, rec, text: `${a.name}'s ${G.name.toLowerCase()} is done. ${verdict} ${fans.toLocaleString()} tickets, ${fmtMoney(total)} with merch. The label's cut is ${fmtMoney(label)}${rec >= 1 ? ` plus ${fmtMoney(Math.round(rec))} back off their tab` : ''}.${r.debt >= 1 ? ` They still owe ${fmtMoney(Math.round(r.debt))}.` : ''}` };
}

// ---------------------------------------------------------------- SoundScan
// Every stream and sale gets counted by the week. Units = pure sales plus one
// unit per 1,500 streams, the way the real charts do it.
export const weekOf = day => Math.floor((day - 1) / 7) + 1;
export const SEA = 1500;
const SALE_RATE = { single: 0.0004, ep: 0.0008, mixtape: 0.0006, album: 0.0012 };
export const salesOf = (streams, kind, quality) => Math.round(streams * (SALE_RATE[kind] || 0.0005) * (0.6 + quality / 100));
export const unitsOf = ([st, sa]) => Math.round(sa + st / SEA);
function tally(L, id, st, sa) { const c = (L.ss.cur[id] ??= [0, 0]); c[0] += st; c[1] += sa; }
// Rows for a week: [{ id, st, sa, u }] best first. `cur` = this week so far.
export function ssRows(by) { return Object.entries(by).map(([id, v]) => ({ id, st: v[0], sa: v[1], u: unitsOf(v) })).filter(x => x.u > 0).sort((a, b) => b.u - a.u); }
// Who an artist records for right now: 'you', a rival id, or 'indie'.
export const ownerOf = (s, id) => signed(s, id) ? 'you' : s.label?.rivalOf?.[id]?.until > s.time.day ? s.label.rivalOf[id].rival : 'indie';
function rollWeek(s, out) {
  const L = s.label, rows = ssRows(L.ss.cur);
  L.ss.hist.unshift({ wk: L.ss.wk, by: Object.fromEntries(rows.slice(0, 60).map(x => [x.id, [x.st, x.sa]])), owner: Object.fromEntries(rows.slice(0, 60).map(x => [x.id, ownerOf(s, x.id)])) });
  if (L.ss.hist.length > 8) L.ss.hist.length = 8;
  rows.forEach((x, i) => { const r = signed(s, x.id); if (r && (!r.peak || i + 1 < r.peak)) r.peak = i + 1; });
  const mine = rows.findIndex(x => signed(s, x.id));
  if (mine >= 0) out.texts.push(`SoundScan week ${L.ss.wk}: ${artistName(rows[mine].id)} finished #${mine + 1} in DFW with ${rows[mine].u.toLocaleString()} units (${rows[mine].sa.toLocaleString()} sales, ${fmtStreams(rows[mine].st)} streams). Full breakdown in the Label app.`);
  L.ss.cur = {}; L.ss.wk = weekOf(s.time.day);
}
// Everybody who isn't on your label: rival acts drop records, indie names get some plays.
function simulateScene(s, rnd) {
  const L = s.label;
  const scene = new Set([...L.known, ...ARTISTS.filter(a => a.featured).map(a => a.id), ...Object.keys(L.rivalOf)]);
  for (const id of scene) {
    const a = ARTIST_BY_ID[id];
    if (!a || signed(s, id)) continue;
    const rv = rivalOf(s, id), v = (L.rv[id] ??= { d: 0, k: 'single', q: 50, b: buzzOf(s, id) });
    if (rnd() < (rv ? 1 / 18 : 1 / 45)) {
      v.k = KIND_IDS[Math.floor(rnd() * KIND_IDS.length * 0.999)];
      v.q = Math.round(clamp(a.talent * 0.82 + (rv?.q || 0) + R(-10, 14), 5, 99));
      v.d = dayOne(v.q, v.b, v.k, rv ? 1.2 : 1);
    }
    const st = Math.round(v.d + v.b * (rv ? 0.2 : 0.08));
    tally(L, id, st, salesOf(v.d, v.k, v.q));
    v.d = v.d < 200 ? 0 : Math.round(v.d * KINDS[v.k].decay);
    v.b = Math.round(Math.min(5e6, v.b + v.d * 0.01));
    (L.scene ??= {})[id] = { buzz: v.b };
  }
}

// ---------------------------------------------------------------- the day
// Streams pay out, fans grow, the weekend shows, the A&R finds someone new,
// and trouble happens. Returns { notes: [text], texts: [text], paid }.
export function labelDay(s, rnd = Math.random) {
  const L = s.label, out = { notes: [], texts: [], paid: 0 };
  if (!L?.name) return out;
  ensureLabel(s);
  const day = s.time.day;
  if (weekOf(day) !== L.ss.wk) rollWeek(s, out);
  // rival contracts that ran out
  for (const [id, c] of Object.entries(L.rivalOf)) if (c.until <= day) {
    delete L.rivalOf[id];
    const a = ARTIST_BY_ID[id];
    if (!a) continue;
    if (!L.known.includes(id)) L.known.push(id);
    out.texts.push(`${a.name}'s deal with ${RIVAL_BY_ID[c.rival]?.name || 'their label'} is up. They're a free agent. They hang out by ${hangName(a)}.`);
  }
  // rivals sign names off the scene
  for (const rv of RIVALS) {
    if (rnd() >= 0.012 * rv.aggro || rivalRoster(s, rv.id).length >= RIVAL_ROSTER) continue;
    const free = L.known.map(id => ARTIST_BY_ID[id]).filter(a => a && !a.featured && !signed(s, a.id) && !rivalOf(s, a.id) && a.talent <= rv.reach && !L.showcase?.lineup?.includes(a.id));
    if (!free.length) continue;
    const a = free[Math.floor(rnd() * free.length * 0.999)];
    toRival(s, a.id, rv.id, 90 + Math.round(rnd() * 110));
    out.texts.push(`${rv.name} just signed ${a.name}. If you want them, you'll have to buy out the deal: ${fmtMoney(buyoutOf(s, a))}.`);
  }
  // the monthly showcase: lineup a week out, the night itself, then whoever you didn't sign goes elsewhere
  const sc = L.showcase;
  if (sc && !sc.done && day > sc.day) {
    sc.done = true;
    const went = [];
    for (const id of sc.lineup) if (!sc.signed[id]) {
      const b = sc.bids[id];
      if (b && rivalRoster(s, b.rival).length < RIVAL_ROSTER) { sc.signed[id] = b.rival; toRival(s, id, b.rival, 120 + Math.round(rnd() * 120)); went.push(`${artistName(id)} to ${RIVAL_BY_ID[b.rival].name}`); }
      else if (!L.known.includes(id)) L.known.push(id);
    }
    if (went.length) out.texts.push(`After the showcase: ${went.join(', ')}.`);
  }
  if ((!L.showcase || L.showcase.done) && nextShowcase(day) - day <= 7 && nextShowcase(day) > day) {
    const n = announceShowcase(s, nextShowcase(day), rnd);
    out.texts.push(`Showcase on day ${n.day} at ${LOC_BY_ID[n.loc]?.name}: ${n.lineup.map(artistName).join(', ')}. Rival labels will be there with offers. Be there that night if you want to sign somebody.`);
  } else if (L.showcase && !L.showcase.done && L.showcase.day === day) {
    out.texts.push(`The showcase is tonight at ${LOC_BY_ID[L.showcase.loc]?.name}. Pull up and make your offers before the other labels do.`);
  }
  // a new name on the scene every couple of days
  if (rnd() < 0.5) {
    const next = ARTISTS.filter(a => !L.known.includes(a.id)).sort((a, b) => a.talent - b.talent)[0];
    if (next) { L.known.push(next.id); out.texts.push(`Somebody you need to hear: ${next.name} (${next.genre}, ${next.hood}). They hang out by ${hangName(next)}. Go see them in person.`); }
  }
  // records that finished in the studio
  for (const ses of L.sessions) if (!ses.done && !ses.told && ses.ready <= s.time.day) {
    ses.told = true;
    out.texts.push(`${artistName(ses.artist)}'s ${KINDS[ses.kind].name.toLowerCase()} "${ses.title}" is mixed and mastered. It's ${gradeOf(ses.quality).toLowerCase()}. Drop it from the Label app whenever you're ready.`);
  }
  // streams
  let gross = 0, artistsCut = 0, streams = 0, recoup = 0;
  for (const rel of L.releases) {
    if (rel.daily < 200) { rel.last = 0; continue; }
    const today = rel.daily;
    const r = signed(s, rel.artist), cut = r ? r.cut : rel.cut ?? STANDARD_CUT;
    rel.cut = cut;
    const g = today * STREAM_PAY;
    rel.total += today; rel.last = today;
    rel.earned += Math.round(g * (1 - cut));
    gross += g; artistsCut += g * cut; streams += today;
    const sales = salesOf(today, rel.kind, rel.quality);
    rel.sales = (rel.sales || 0) + sales;
    tally(L, rel.artist, today, sales);
    if (r) { const share = g * cut, rec = Math.min(r.debt, share); r.debt -= rec; recoup += rec; r.wallet += share - rec; }
    if (r) r.buzz = Math.round(Math.min(5e6, r.buzz + today * 0.015));
    rel.daily = Math.round(today * KINDS[rel.kind].decay);
  }
  // weekend shows
  let shows = 0;
  if (['Fri', 'Sat'].includes(dayName(s.time).slice(0, 3))) {
    for (const r of L.roster) if (!r.jailed && !r.gig && r.buzz >= 3000) {
      const fee = Math.min(250000, 800 + r.buzz * 0.09), share = fee * 0.75, rec = Math.min(r.debt, share);
      shows += fee * 0.25; r.shows++; r.debt -= rec; recoup += rec; r.wallet += share - rec;
    }
  }
  // booked shows and tours that wrapped up last night
  let gigs = 0;
  for (const r of L.roster) if (r.gig && day >= r.gig.end) { const g = settleGig(s, r, rnd); gigs += g.pay - g.rec; recoup += g.rec; out.texts.push(g.text); }
  shows += gigs;
  L.recouped += recoup;
  const pay = Math.round(gross - artistsCut + shows + recoup);
  if (pay > 0) { earnBank(s, pay, `${L.name}: streams${shows ? ' + shows' : ''}${recoup >= 1 ? ' + recouped' : ''}`); L.earned += pay; out.paid = pay; out.notes.push(`🎤 ${L.name} made ${fmtMoney(pay)} today (${fmtStreams(streams)} streams${shows ? `, ${fmtMoney(Math.round(shows))} from shows` : ''}${recoup >= 1 ? `, ${fmtMoney(Math.round(recoup))} recouped` : ''}).`); }
  simulateScene(s, rnd);
  L.streams += streams;
  L.clout = Math.min(1000, L.clout + streams / 250000);
  // trouble: jail, artists who want more money, rivals circling
  for (const r of [...L.roster]) {
    const a = ARTIST_BY_ID[r.id];
    if (r.offer && day > r.offer.until) {
      const rv = RIVAL_BY_ID[r.offer.rival], x = leaveForRival(s, r.id, rnd, r.offer.rival);
      out.paid += x.paid;
      out.texts.push(`You never answered, so ${a.name} took the ${rv.name} deal. ${x.text}`);
      continue;
    }
    if (r.demand && day - r.demand.day > 5) {
      const x = answerDemand(s, r.id, false, rnd);
      out.paid += x.paid || 0;
      out.texts.push(`${a.name} waited on you for a week. ${x.text}`);
      if (x.left) continue;
    }
    if (r.jailed) { r.buzz = Math.round(r.buzz * 0.98); r.mood = Math.max(0, (r.mood ?? 70) - 1); continue; }
    if (r.gig) continue;
    if (a.street && rnd() < 0.015) {
      r.jailed = { day, bail: bailOf(r) };
      out.texts.push(`${a.name} got locked up last night. Bail is ${fmtMoney(r.jailed.bail)}. No shows and no studio till they're out. If you post it, it goes on their tab. Post it from the Label app.`);
      continue;
    }
    if (!r.demand && r.cut < 0.5 && r.buzz > Math.max(r.buzz0, 2000) * 3 && rnd() < 0.03) {
      r.demand = { cut: Math.min(0.5, Math.round((r.cut + 0.1) * 100) / 100), day };
      out.texts.push(`${a.name} has ${r.buzz.toLocaleString()} fans now and their manager is calling. They want ${Math.round(r.demand.cut * 100)}% of the royalties, up from ${Math.round(r.cut * 100)}%. Answer in the Label app.`);
    } else if (!r.demand && !r.offer && day >= r.nextAsk) {
      // every month or so they want more
      r.demand = rnd() < 0.5 && r.cut < 0.5
        ? { cut: Math.min(0.5, Math.round((r.cut + 0.05) * 100) / 100), day }
        : { bonus: Math.round((1500 + r.buzz * 0.12) / 500) * 500, day };
      out.texts.push(`${a.name} is asking for more money: ${demandText(r.demand)}. If you say no they might leave, and rival labels are watching. Answer in the Label app.`);
    } else if (!r.offer && !r.demand && (r.mood ?? 70) < 45 && rnd() < 0.05) {
      const rv = bestRival(s, a, rnd) || RIVALS[RIVALS.length - 1];
      r.offer = { rival: rv.id, amount: Math.round(rivalBid(s, a, rv, rnd) * 0.6 / 500) * 500 || 5000, day, until: day + 3 };
      out.texts.push(`${rv.name} is in ${a.name}'s DMs with a ${fmtMoney(r.offer.amount)} offer. Match it with a re-up bonus or they're gone in 3 days.`);
    }
  }
  return out;
}
export const hangName = a => LOC_BY_ID[a.hang]?.name || a.hood;
