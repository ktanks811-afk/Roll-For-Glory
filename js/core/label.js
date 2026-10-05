// Your record label. Start one, find artists where they hang out around Fort
// Worth and Dallas, sign them in person, cut records at a studio, drop them
// with a promo budget, and the streams pay the label every day. Artists grow
// their fanbase, play weekend shows, get locked up, and want a bigger cut
// once they blow up. DOM-free so check-data can test it.

import { spend, earnBank, fmtMoney, dayName } from './state.js';
import { LOC_BY_ID } from '../data/world.js';
import { LABEL_COST, STREAM_PAY, MAX_ROSTER, STUDIOS, KINDS, PROMO_BY_ID, ARTISTS, ARTIST_BY_ID, TITLE_A, TITLE_B } from '../data/label.js';

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
  const ask = askOf(s, a);
  return {
    standard: { advance: ask, cut: STANDARD_CUT },
    cheap: { advance: Math.round(ask * CHEAP_ADVANCE / 100) * 100, cut: CHEAP_CUT },
  };
}

// Why you can't sign this artist right now, or null. `near` is whether you're standing at their spot.
export function signBlock(s, id, near) {
  const L = ensureLabel(s), a = ARTIST_BY_ID[id];
  if (!a) return 'Nobody by that name.';
  if (!L.name) return 'Start your label first.';
  if (signed(s, id)) return `${a.name} is already on ${L.name}.`;
  if (!L.known.includes(id)) return 'You haven\'t heard of them yet.';
  if (L.roster.length >= MAX_ROSTER) return `Your roster is full (${MAX_ROSTER}). Drop somebody first.`;
  if ((L.cooldown?.[id] || 0) > s.time.day) return `${a.name} isn't taking your calls right now.`;
  if (L.clout < cloutNeeded(a)) return `${a.name} wants to see a label with a hit first (clout ${Math.floor(L.clout)} of ${cloutNeeded(a)}).`;
  if (!near) return `You have to meet ${a.name} in person.`;
  return null;
}

export function signArtist(s, id, deal = 'standard', near = true) {
  const L = ensureLabel(s), a = ARTIST_BY_ID[id];
  const why = signBlock(s, id, near);
  if (why) return err(why);
  const d = dealsFor(s, a)[deal];
  if (!d) return err('No such deal.');
  if (!spend(s, d.advance, `${a.name}: signing advance`)) return err(`The advance is ${fmtMoney(d.advance)}.`);
  L.roster.push({ id, signedDay: s.time.day, cut: d.cut, advance: d.advance, buzz: buzzOf(s, id), buzz0: buzzOf(s, id), jailed: null, demand: null, shows: 0 });
  return { ok: true, text: `${a.name} signed to ${L.name}. They keep ${Math.round(d.cut * 100)}% of the royalties.` };
}

export function dropArtist(s, id) {
  const L = ensureLabel(s), r = signed(s, id);
  if (!r) return err('They\'re not on your label.');
  L.roster = L.roster.filter(x => x.id !== id);
  L.sessions = L.sessions.filter(x => x.artist !== id);
  (L.scene ??= {})[id] = { buzz: r.buzz };
  (L.cooldown ??= {})[id] = s.time.day + 14;
  return { ok: true, text: `You let ${artistName(id)} go. Their records stay in your catalog.` };
}

// ---------------------------------------------------------------- the studio
export function sessionCost(studioId, kind) { return Math.round(KINDS[kind].cost * (STUDIOS[studioId]?.rate || 1)); }

export function bookSession(s, studioId, artistId, kind) {
  const L = ensureLabel(s), r = signed(s, artistId), K = KINDS[kind], st = STUDIOS[studioId];
  if (!L.name) return err('Start your label first.');
  if (!st || !K) return err('Pick a studio and a project.');
  if (!r) return err('Sign them first.');
  if (r.jailed) return err(`${artistName(artistId)} is in jail. Bail them out first.`);
  if (L.sessions.some(x => x.artist === artistId && !x.done)) return err(`${artistName(artistId)} is already in the studio.`);
  const cost = sessionCost(studioId, kind);
  if (!spend(s, cost, `${st.name}: ${K.name} session`)) return err(`The session is ${fmtMoney(cost)}.`);
  const a = ARTIST_BY_ID[artistId];
  // the room, the artist and the day: a great artist in a great room still has off weeks
  const quality = Math.round(clamp(a.talent * 0.82 + st.q + R(-10, 14) + (kind === 'album' ? 3 : 0), 5, 99));
  const ses = { id: 'ses' + Math.random().toString(36).slice(2, 8), artist: artistId, kind, studio: studioId, start: s.time.day, ready: s.time.day + K.days, quality, title: makeTitle(), done: false };
  L.sessions.push(ses);
  return { ok: true, ses, text: `${a.name} is in the booth at ${st.name}. The ${K.name.toLowerCase()} is done in ${K.days} day${K.days > 1 ? 's' : ''}.` };
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
  const rel = { id: 'rel' + Math.random().toString(36).slice(2, 8), artist: ses.artist, title: ses.title, kind: ses.kind, quality: ses.quality, day: s.time.day, promo: promoId, viral, daily: first, peak: first, total: 0, earned: 0, last: 0 };
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
  return { ok: true, text: `${artistName(id)} is out. "I owe you."` };
}
export function answerDemand(s, id, yes, rnd = Math.random) {
  const r = signed(s, id);
  if (!r?.demand) return err('Nothing to answer.');
  if (yes) { r.cut = r.demand.cut; r.demand = null; return { ok: true, text: `${artistName(id)} keeps ${Math.round(r.cut * 100)}% now. They're happy.` }; }
  r.demand = null;
  if (rnd() < 0.5) { dropArtist(s, id); return { ok: true, left: true, text: `${artistName(id)} walked. A bigger label picked them up the same day.` }; }
  return { ok: true, text: `${artistName(id)} is mad, but they're staying.` };
}

// ---------------------------------------------------------------- the day
// Streams pay out, fans grow, the weekend shows, the A&R finds someone new,
// and trouble happens. Returns { notes: [text], texts: [text], paid }.
export function labelDay(s, rnd = Math.random) {
  const L = s.label, out = { notes: [], texts: [], paid: 0 };
  if (!L?.name) return out;
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
  let gross = 0, artistsCut = 0, streams = 0;
  for (const rel of L.releases) {
    if (rel.daily < 200) { rel.last = 0; continue; }
    const today = rel.daily;
    const r = signed(s, rel.artist), cut = r ? r.cut : rel.cut ?? STANDARD_CUT;
    rel.cut = cut;
    const g = today * STREAM_PAY;
    rel.total += today; rel.last = today;
    rel.earned += Math.round(g * (1 - cut));
    gross += g; artistsCut += g * cut; streams += today;
    if (r) r.buzz = Math.round(Math.min(5e6, r.buzz + today * 0.015));
    rel.daily = Math.round(today * KINDS[rel.kind].decay);
  }
  // weekend shows
  let shows = 0;
  if (['Fri', 'Sat'].includes(dayName(s.time).slice(0, 3))) {
    for (const r of L.roster) if (!r.jailed && r.buzz >= 3000) { const fee = Math.min(250000, 800 + r.buzz * 0.09); shows += fee * 0.25; r.shows++; }
  }
  const pay = Math.round(gross - artistsCut + shows);
  if (pay > 0) { earnBank(s, pay, `${L.name}: streams${shows ? ' + shows' : ''}`); L.earned += pay; out.paid = pay; out.notes.push(`🎤 ${L.name} made ${fmtMoney(pay)} today (${fmtStreams(streams)} streams${shows ? `, ${fmtMoney(Math.round(shows))} from shows` : ''}).`); }
  L.streams += streams;
  L.clout = Math.min(100, L.clout + streams / 250000);
  // trouble: jail, and artists who blew up wanting more
  for (const r of [...L.roster]) {
    const a = ARTIST_BY_ID[r.id];
    if (r.jailed) { r.buzz = Math.round(r.buzz * 0.98); continue; }
    if (a.street && rnd() < 0.015) {
      r.jailed = { day: s.time.day, bail: bailOf(r) };
      out.texts.push(`${a.name} got locked up last night. Bail is ${fmtMoney(r.jailed.bail)}. No shows and no studio till they're out. Post it from the Label app.`);
      continue;
    }
    if (!r.demand && r.cut < 0.5 && r.buzz > Math.max(r.buzz0, 2000) * 3 && rnd() < 0.03) {
      r.demand = { cut: Math.min(0.5, Math.round((r.cut + 0.1) * 100) / 100), day: s.time.day };
      out.texts.push(`${a.name} has ${r.buzz.toLocaleString()} fans now and their manager is calling. They want ${Math.round(r.demand.cut * 100)}% of the royalties, up from ${Math.round(r.cut * 100)}%. Answer in the Label app.`);
    }
  }
  return out;
}
export const hangName = a => LOC_BY_ID[a.hang]?.name || a.hood;
