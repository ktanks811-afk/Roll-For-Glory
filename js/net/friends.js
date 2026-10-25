// Friends: the real people you play with. Add them from your home server,
// from whoever's online with you right now, or by their friend code, then
// text them from Messages like any other contact.
//
// Friend lists and conversations live in each save, so the server is just a
// mailbox (supabase/rfg_friends.sql), like Cowtown Pay: your game drops a
// note there (a text, a friend request, an accept, an unfriend) and theirs
// picks it up the next time it checks, right away if you're online together
// (a 'dm' nudge on the server channel), otherwise within a minute or when
// they next play. `?net=local` swaps in a same-browser copy.
//
// Save state: s.friends = { list: [{ uid, name, st, since }], sent: n }
//   st: 'friend' | 'out' (you asked) | 'in' (they asked you)
// Texts to and from a friend are ordinary s.messages with from = 'f:<uid>';
// the ones you sent carry mine: true.

import { game, gameTimeStr } from '../core/state.js';
import { emit } from '../core/events.js';
import { sendMessage } from '../core/story.js';
import { online, SERVER_BY_ID } from './online.js';
import { rpc, me, deeds } from './deeds.js';
import { pay } from './pay.js';

const CHECK_EVERY = 30000;
export const TEXT_MAX = 240;
const cleanName = n => String(n ?? '').replace(/[^\w .'\-]/g, '').trim().slice(0, 16) || 'Racer';
const cleanText = t => String(t ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, TEXT_MAX);
const cleanUid = u => (typeof u === 'string' && /^[a-z0-9]{6,16}$/.test(u) ? u : '');

export const fid = uid => 'f:' + uid;
export const isFriendId = id => typeof id === 'string' && id.startsWith('f:');
// A friend code is your career id, shown in capitals: MW-ABCD-EFGHJK.
export const friendCode = s => { me(s); return 'MW-' + s.uid.toUpperCase().replace(/^(.{4})/, '$1-'); };
export const parseFriendCode = t => { let c = String(t || '').toLowerCase().replace(/[^a-z0-9]/g, ''); if (c.length === 12 && c.startsWith('mw')) c = c.slice(2); return c.length >= 6 && c.length <= 16 ? c : null; };

export function ensureFriends(s) {
  s.friends ??= {};
  s.friends.list ??= [];
  s.friends.sent ??= 0;
  return s.friends;
}
export const friendOf = (s, uid) => ensureFriends(s).list.find(f => f.uid === uid) || null;
export const friendsList = s => ensureFriends(s).list.filter(f => f.st === 'friend');
export const requestsIn = s => ensureFriends(s).list.filter(f => f.st === 'in');
export function friendInfo(s, id) {
  const f = friendOf(s, String(id).slice(2));
  return { id, name: f ? f.name : 'Player', color: '#2a7bff', role: f?.st === 'friend' ? 'Friend · real player' : 'Real player', friend: true };
}

const remote = {
  find: code => rpc('rfg_player_find', { p_code: code }).then(r => (Array.isArray(r) ? r[0] : null) || null),
  send: (u, to, kind, body) => rpc('rfg_dm_send', { p_uid: u.uid, p_tok: u.tok, p_to: to, p_kind: kind, p_body: body }),
  inbox: u => rpc('rfg_dm_inbox', { p_uid: u.uid, p_tok: u.tok }).then(r => (Array.isArray(r) ? r : [])),
};

// Same rules in localStorage (players come from the local deed registry).
const LKEY = 'rfg-localdms', DKEY = 'rfg-localdeeds';
const local = {
  load() { try { return { list: [], n: 0, ...JSON.parse(localStorage.getItem(LKEY) || '{}') }; } catch { return { list: [], n: 0 }; } },
  save(d) { localStorage.setItem(LKEY, JSON.stringify(d)); },
  members() { try { return JSON.parse(localStorage.getItem(DKEY) || '{}').members || {}; } catch { return {}; } },
  async find(code) { const m = this.members()[code]; return m ? { uid: m.uid, name: m.name, server: m.server } : null; },
  async send(u, to, kind, body) {
    const ms = this.members(), m = ms[u.uid], r = ms[to];
    if (!m || m.tok !== u.tok) throw new Error('Pick a home server first');
    if (to === u.uid) throw new Error('That\'s you');
    if (!r) throw new Error('No player with that code');
    const d = this.load();
    d.list.push({ id: ++d.n, from_uid: u.uid, from_name: m.name, to_uid: to, kind, body: cleanText(body) });
    this.save(d);
    return { ok: true, to: r.name };
  },
  async inbox(u) {
    const m = this.members()[u.uid];
    if (!m || m.tok !== u.tok) return [];
    const d = this.load(), got = d.list.filter(x => x.to_uid === u.uid);
    d.list = d.list.filter(x => x.to_uid !== u.uid);
    this.save(d);
    return got;
  },
};

// Apply one note from the mailbox to the save. DOM-free; check-data tests it.
export function receive(s, n) {
  const fr = ensureFriends(s), uid = cleanUid(n.from_uid);
  if (!uid || uid === s.uid) return null;
  const name = cleanName(n.from_name), body = cleanText(n.body);
  let f = friendOf(s, uid);
  if (f) f.name = name;
  if (n.kind === 'req') {
    if (f?.st === 'friend') return null;
    if (f?.st === 'out') { f.st = 'friend'; f.since = s.time.day; sendMessage(s, fid(uid), `${name} added you back. You're friends now.`, { sys: true }); return 'friend'; }
    if (!f) fr.list.push(f = { uid, name, st: 'in', since: s.time.day });
    sendMessage(s, fid(uid), `${name} wants to add you as a friend.`, { action: { type: 'friend', uid }, sys: true });
    return 'req';
  }
  if (n.kind === 'ok') {
    if (!f) fr.list.push(f = { uid, name, st: 'friend', since: s.time.day });
    else { f.st = 'friend'; f.since = s.time.day; }
    sendMessage(s, fid(uid), `${name} accepted your friend request.`, { sys: true });
    return 'ok';
  }
  if (n.kind === 'bye') { if (f) fr.list.splice(fr.list.indexOf(f), 1); return 'bye'; }
  if (n.kind === 'text' && body) {
    if (!f) fr.list.push(f = { uid, name, st: 'in', since: s.time.day });
    sendMessage(s, fid(uid), body);
    return 'text';
  }
  return null;
}

class Friends {
  constructor() {
    this.busy = false;
    this.timer = null;
    online.on((ev, m) => { if (ev === 'dm' && game.s && m?.u === game.s.uid) this.check(game.s); });
  }
  get db() { return online.kind === 'local' ? local : remote; }

  // People you could add: on your home server, and online with you right now.
  async suggestions(s) {
    me(s);
    const known = new Set(ensureFriends(s).list.map(f => f.uid));
    const here = online.active ? online.list().filter(p => p.uid && p.uid !== s.uid).map(p => ({ uid: p.uid, name: cleanName(p.name), where: 'Online with you' })) : [];
    let server = [];
    try { server = (await pay.players(s)).map(p => ({ ...p, where: `${SERVER_BY_ID[s.homeServer]?.name || 'Your'} server` })); } catch { /* offline */ }
    const out = [], seen = new Set();
    for (const p of [...here, ...server]) if (!seen.has(p.uid) && !known.has(p.uid) && p.uid !== s.uid) { seen.add(p.uid); out.push(p); }
    return out;
  }
  async find(code) { const c = parseFriendCode(code); if (!c) return null; try { const r = await this.db.find(c); return r ? { uid: cleanUid(r.uid), name: cleanName(r.name), server: r.server } : null; } catch { return null; } }

  async post(s, to, kind, body = '') {
    if (!s.homeServer) return { ok: false, text: 'Pick a home server in the Online app first. That puts you in the player registry so friends can find you.' };
    try {
      let r;
      try { r = await this.db.send(me(s), to, kind, body); }
      catch (e) {
        if (!/home server/i.test(e.message)) throw e;
        const j = await deeds.join(s, s.homeServer);
        if (!j.ok || j.offline) throw e;
        r = await this.db.send(me(s), to, kind, body);
      }
      online.send({ k: 'dm', u: to });
      return { ok: true, to: cleanName(r?.to) };
    } catch (e) { return { ok: false, text: e.message || 'Couldn\'t reach the server.' }; }
  }

  async add(s, p) {
    const f = friendOf(s, p.uid);
    if (f?.st === 'friend') return { ok: true, text: `${f.name} is already your friend.` };
    if (f?.st === 'in') return this.accept(s, p.uid);
    const r = await this.post(s, p.uid, 'req');
    if (!r.ok) return r;
    if (!f) ensureFriends(s).list.push({ uid: p.uid, name: cleanName(r.to || p.name), st: 'out', since: s.time.day });
    ensureFriends(s).sent++;
    return { ok: true, text: `Friend request sent to ${cleanName(r.to || p.name)}.` };
  }
  async accept(s, uid) {
    const f = friendOf(s, uid);
    if (!f) return { ok: false, text: 'That request is gone.' };
    const r = await this.post(s, uid, 'ok');
    if (!r.ok) return r;
    f.st = 'friend'; f.since = s.time.day;
    for (const m of s.messages) if (m.from === fid(uid) && m.action?.type === 'friend') m.action.done = 'yes';
    emit('friend', { uid });
    return { ok: true, text: `You and ${f.name} are friends now.` };
  }
  async remove(s, uid) {
    const fr = ensureFriends(s), f = friendOf(s, uid);
    if (!f) return { ok: true };
    fr.list.splice(fr.list.indexOf(f), 1);
    for (const m of s.messages) if (m.from === fid(uid) && m.action?.type === 'friend') m.action.done = 'no';
    this.post(s, uid, 'bye');
    return { ok: true, text: `Removed ${f.name}.` };
  }
  async text(s, uid, body) {
    body = cleanText(body);
    if (!body) return { ok: false, text: 'Type something first.' };
    const f = friendOf(s, uid);
    if (!f || f.st !== 'friend') return { ok: false, text: 'You can text friends once they add you back.' };
    const r = await this.post(s, uid, 'text', body);
    if (!r.ok) return r;
    s.messages.unshift({ id: 'msg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), from: fid(uid), text: body, day: s.time.day, t: gameTimeStr(s.time), read: true, mine: true });
    if (s.messages.length > 120) s.messages.length = 120;
    return { ok: true };
  }

  async check(s) {
    if (!s?.homeServer || this.busy || !s.uid || !s.crewKey) return [];
    this.busy = true;
    const out = [];
    try { for (const n of await this.db.inbox(me(s))) { const k = receive(s, n); if (k) out.push(k); } }
    catch { /* offline: try again next time */ }
    finally { this.busy = false; }
    return out;
  }
  start() {
    if (this.timer) return;
    const tick = () => { if (game.s) this.check(game.s); };
    this.timer = setInterval(tick, CHECK_EVERY);
    setTimeout(tick, 4000);
  }
}

export const friends = new Friends();
