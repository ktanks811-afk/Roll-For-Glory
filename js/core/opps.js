// Street beef with the regulars on a server. Heat builds when one of them
// talks down on you, picks with you, flashes a gun or posts on you, and when
// you talk back, post on them, or shoot. At 100 they're your opp: they spin
// on you (drive-bys, walk-downs) wherever you're online until it's squashed.
//
// DOM-free; tested in scripts/check-data.mjs. The world side (who says what,
// sliding, shooting) is in net/bots.js. Lives in `s.opps`:
//   { list: { key: { name, server, who, heat, opp, since, day, ... } }, stats }
// where key = `${server}:${who}` (the same regular on every phone).

import { addPost, myHandle, fill } from './feed.js';
import { sendMessage } from './story.js';
import { addRep } from './state.js';
import * as B from '../data/beefTalk.js';
import { LOCAL_COLORS } from '../data/social.js';

export const OPP_AT = 100;
export const SALTY_AT = 20;    // they post on you
export const HOT_AT = 50;      // they text you
const pick = (a, rng) => a[Math.floor(rng() * a.length) % a.length];

export function ensureOpps(s) {
  const o = (s.opps ??= {});
  o.list ??= {};
  o.stats ??= { slid: 0, hit: 0, smoked: 0, gotSmoked: 0, squashed: 0 };
  o.day ??= s.time?.day ?? 0;
  return o;
}

export const oppKey = (server, who) => `${server}:${who}`;
export const handleOf = name => String(name || '').toLowerCase().replace(/[^\w.]/g, '') || 'somebody';

export function beefWith(s, key) { return ensureOpps(s).list[key] || null; }
export function isOpp(s, key) { return !!beefWith(s, key)?.opp; }
export function opps(s) { return Object.entries(ensureOpps(s).list).filter(([, r]) => r.opp).map(([key, r]) => ({ key, ...r })); }

// Everybody with heat on you, hottest first.
export function beefList(s) {
  return Object.entries(ensureOpps(s).list).map(([key, r]) => ({ key, ...r })).sort((a, b) => (b.opp - a.opp) || b.heat - a.heat);
}
export function beefWord(r) { return r.opp ? 'Opp' : r.heat >= HOT_AT ? 'Heated' : r.heat >= SALTY_AT ? 'Salty' : 'Lookin'; }

// Their author card on Throttle.
export function author(name) { return { name, handle: handleOf(name), color: LOCAL_COLORS[name.length % LOCAL_COLORS.length] }; }

// More (or less) heat with one of them. Returns { r, became, posted, texted }.
// `why` lands on the record; `rng` keeps tests steady.
export function addBeef(s, key, name, n, { rng = Math.random, why = '' } = {}) {
  const o = ensureOpps(s);
  const r = (o.list[key] ??= { name, server: key.split(':')[0], who: +key.split(':')[1] || 0, heat: 0, opp: false, since: -1, day: s.time.day, posted: false, texted: false });
  r.name = name || r.name;
  const was = r.heat;
  r.heat = Math.max(0, Math.min(OPP_AT, Math.round(r.heat + n)));
  r.day = s.time.day;
  if (why) r.why = why;
  const out = { r, became: false, posted: false, texted: false };
  if (!r.opp && r.heat <= 0) { delete o.list[key]; return out; }
  // salty: they post on you
  if (!r.posted && was < SALTY_AT && r.heat >= SALTY_AT) {
    r.posted = true; out.posted = true;
    addPost(s, { by: author(r.name), text: fill(pick(B.POSTS, rng), { me: myHandle(s) }), about: true, mood: 'bad', rng });
  }
  // heated: they text
  if (!r.texted && was < HOT_AT && r.heat >= HOT_AT && r.heat < OPP_AT) {
    r.texted = true; out.texted = true;
    sendMessage(s, r.name, pick(B.DMS, rng), { action: { type: 'opp', key } });
  }
  if (!r.opp && r.heat >= OPP_AT) { makeOpp(s, key, r.name, rng); out.became = true; }
  return out;
}

export function makeOpp(s, key, name, rng = Math.random) {
  const o = ensureOpps(s);
  const r = o.list[key] ?? addBeef(s, key, name, 1, { rng }).r;
  if (r.opp) return r;
  r.opp = true; r.heat = OPP_AT; r.since = s.time.day;
  r.slid = 0; r.hits = 0; r.gotHit = 0;
  sendMessage(s, r.name, pick(B.OPP_DMS, rng), { action: { type: 'opp', key } });
  addPost(s, { by: { name: 'Murda Worth Tea ☕', handle: 'murdaworthtea', color: '#a01aff', v: true }, text: fill(pick(B.TEA, rng), { me: myHandle(s), them: '@' + handleOf(r.name), where: 'the server' }), about: true, mood: 'hot', rng });
  return r;
}

// You start it.
//   'talk' : talk down on them (+35)
//   'post' : post on them on Throttle (+45, a little rep)
//   'opp'  : straight to opps
export function startBeef(s, key, name, how, rng = Math.random) {
  if (how === 'post') {
    addPost(s, { mine: true, text: fill(pick(B.DISS, rng), { them: handleOf(name) }), about: true, rng });
    addRep(s, 3, `Posted on ${name}`);
    return addBeef(s, key, name, 45, { rng, why: 'You posted on them' });
  }
  if (how === 'opp') {
    const out = addBeef(s, key, name, OPP_AT, { rng, why: 'You started it' });
    return out;
  }
  return addBeef(s, key, name, 35, { rng, why: 'You talked down on them' });
}

// What an opp text lets you do.
export function oppOptions(s, key) {
  const r = beefWith(s, key);
  if (!r) return [];
  if (r.opp) return [{ id: 'post', label: 'Post on \'em' }, { id: 'squash', label: 'Try to squash it' }];
  return [{ id: 'opp', label: 'Pull up then' }, { id: 'post', label: 'Post on \'em' }, { id: 'squash', label: 'Let it go' }];
}

// Try to end it. `temper` (0..1) is how hot-headed they are. Returns '' or why not.
export function squash(s, key, temper = 0.5, rng = Math.random) {
  const o = ensureOpps(s), r = o.list[key];
  if (!r) return 'There\'s no beef with them.';
  if (!r.opp) { r.heat = Math.max(0, r.heat - 30); if (!r.heat) delete o.list[key]; return ''; }
  if (r.tried === s.time.day) return 'You already reached out today. Give it a day.';
  r.tried = s.time.day;
  // fresh beef and hotheads don't squash; somebody you smoked never does
  const days = s.time.day - r.since;
  const chance = Math.max(0.05, 0.55 - temper * 0.45 + Math.min(0.3, days * 0.06) - (r.gotHit || 0) * 0.15);
  if (rng() > chance) { sendMessage(s, r.name, pick(B.SQUASH_NO, rng)); return `${r.name} ain't squashing it.`; }
  delete o.list[key];
  o.stats.squashed++;
  sendMessage(s, r.name, pick(B.SQUASH_YES, rng));
  return '';
}

// Answer one of their texts.
export function answerOpp(s, msg, choice, temper = 0.5, rng = Math.random) {
  const a = msg?.action;
  if (!a || a.type !== 'opp' || a.done) return 'Already handled.';
  const r = beefWith(s, a.key);
  if (!r) { a.done = 'gone'; return 'That beef is over.'; }
  let why = '';
  if (choice === 'opp') makeOpp(s, a.key, r.name, rng);
  else if (choice === 'post') startBeef(s, a.key, r.name, 'post', rng);
  else if (choice === 'squash') why = squash(s, a.key, temper, rng);
  else return 'Pick an answer.';
  a.done = choice;
  return why;
}

// After they slid on you. `hitYou`: they hit you; `lit`: you shot their car up;
// `smoked`: you dropped them.
export function afterSlide(s, key, { hitYou = false, lit = false, smoked = false, where = 'Fort Worth', rng = Math.random } = {}) {
  const o = ensureOpps(s), r = o.list[key];
  if (!r) return;
  r.slid = (r.slid || 0) + 1; o.stats.slid++;
  if (hitYou) { r.hits = (r.hits || 0) + 1; o.stats.hit++; }
  if (smoked) { r.gotHit = (r.gotHit || 0) + 1; o.stats.smoked++; addRep(s, 25, `Held it down against ${r.name}`); }
  else if (lit) { r.gotHit = (r.gotHit || 0) + 1; addRep(s, 10, `Shot back at ${r.name}`); }
  r.last = s.time.day;
  if (rng() < 0.7) addPost(s, { by: { name: 'Fort Worth Scanner 🚨', handle: 'fwscanner', color: '#1b4fc4', v: true }, text: fill(pick(B.SCANNER, rng), { where }), mood: 'hot', rng });
  if (rng() < 0.6) addPost(s, { by: author(r.name), text: fill(pick(hitYou ? B.GOT_YOU : smoked || lit ? B.LIT_UP : B.MISSED, rng), {}) + (rng() < 0.5 ? ' ' + myHandle(s) : ''), about: true, mood: 'bad', rng });
}

// You dropped them outside of a slide (you started shooting).
export function smokedThem(s, key, name, rng = Math.random) {
  const out = addBeef(s, key, name, OPP_AT, { rng, why: 'You dropped them' });
  out.r.gotHit = (out.r.gotHit || 0) + 1;
  ensureOpps(s).stats.smoked++;
  return out;
}

// Once a game day: beef that never turned into opps cools off.
export function coolOff(s) {
  const o = ensureOpps(s);
  if (o.day === s.time.day) return;
  const days = Math.max(1, s.time.day - o.day);
  o.day = s.time.day;
  for (const [k, r] of Object.entries(o.list)) {
    if (r.opp) continue;
    r.heat -= 8 * days;
    if (r.heat <= 0) delete o.list[k];
  }
}
