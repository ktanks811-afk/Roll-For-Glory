// Online crews. Real players found crews, other players join them, and members
// chat and see each other live. Like the rest of online play there is no
// server logic and nothing is stored anywhere: a crew lives in its members'
// saves, and the directory is whoever is connected right now (realtime
// presence on one shared "crews" channel).
//
// Because clients trust nothing, leader powers are signed: the founder makes an
// ECDSA key pair, the public half is published with the crew, and members pin it
// when they join. Accepting a join request, kicking and disbanding are signed
// commands that every member verifies against that pinned key. Impersonating a
// leader isn't possible; the secret key never leaves the founder's save.

import { LocalTransport, SupabaseTransport, online } from './online.js';

export const CREW_FEE = 1500;
export const CREW_COLORS = ['#e0192e', '#2a7bff', '#2bd96b', '#ffc21a', '#a01aff', '#13b3c4', '#ff6a1a', '#f2f2f2'];
const MAX_CHAT = 80;
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

export const cleanCrewName = s => String(s ?? '').replace(/[^\w .'\-]/g, '').trim().replace(/\s+/g, ' ').slice(0, 20);
export const cleanTag = s => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
const cleanMotto = s => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
const cleanText = s => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 90);
const cleanColor = c => (/^#[0-9a-fA-F]{6}$/.test(String(c)) ? String(c) : '#e0192e');
const cleanId = s => (/^[a-z0-9]{6,12}$/.test(String(s)) ? String(s) : '');

// ---------------------------------------------------------------- keys
export async function newCrewKeys() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const j = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { pk: `${j.x}.${j.y}`, sk: j.d };
}
async function importPub(pk) {
  const [x, y] = String(pk).split('.');
  return crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x, y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
}
async function sign(pk, sk, text) {
  const [x, y] = pk.split('.');
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x, y, d: sk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(text)));
}
async function verify(pk, text, sig) {
  try { return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await importPub(pk), unb64u(sig), new TextEncoder().encode(text)); } catch { return false; }
}
const cmdText = m => `${m.c}|${m.crew}|${m.to}|${m.ts}|${m.nz}`;

// ---------------------------------------------------------------- lobby
class CrewLobby {
  constructor() {
    this.status = 'off';      // off | connecting | on | error
    this.error = '';
    this.id = '';
    this.players = new Map(); // player id -> clean meta
    this.listeners = new Set();
    this.chat = [];
    this.requests = [];       // join requests for the crew I lead: { id, name, uid, t }
    this.seenNonces = new Set();
    this.me = { name: 'Racer', uid: '', rep: 0, where: '', crew: null, sk: '' };
    this.pending = null;      // my outstanding request: { crew, pk }
  }

  get active() { return this.status === 'on'; }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev, d) { this.listeners.forEach(f => { try { f(ev, d); } catch { /* a listener bug must not kill the lobby */ } }); }
  get kind() { return online.kind; }

  // me: { name, uid, rep, where, crew: { id, name, tag, color, motto, open, pk, role } | null, sk }
  setMe(me) {
    this.me = { ...this.me, ...me };
    if (this.active) this.tr?.update(this.meta());
  }
  meta() {
    const m = this.me, c = m.crew;
    return {
      n: String(m.name).slice(0, 16), u: String(m.uid).slice(0, 12), rp: Math.max(0, Math.round(m.rep || 0)), w: String(m.where || '').slice(0, 12),
      cr: c ? { i: c.id, n: c.name, t: c.tag, c: c.color, m: c.motto || '', o: c.open ? 1 : 0, pk: c.pk, r: c.role === 'leader' ? 'l' : 'm' } : undefined,
    };
  }

  async connect() {
    if (this.status === 'connecting' || this.status === 'on') return true;
    this.status = 'connecting'; this.error = ''; this.emit('status');
    this.id = Math.random().toString(36).slice(2, 10);
    try {
      const T = this.kind === 'local' ? LocalTransport : SupabaseTransport;
      this.tr = new T('crews', m => this.receive(m), this.id, list => this.onPresence(list));
      await this.tr.open(String(this.me.name).slice(0, 16), this.meta());
    } catch (e) {
      this.status = 'error'; this.error = e.message || 'Could not connect';
      try { this.tr?.close(); } catch { /* ignore */ }
      this.tr = null; this.emit('status');
      return false;
    }
    this.status = 'on'; this.emit('status');
    return true;
  }
  disconnect() {
    try { this.tr?.close(); } catch { /* ignore */ }
    this.tr = null; this.status = 'off'; this.players.clear(); this.requests = []; this.emit('status');
  }

  // Presence -> sanitised player table (everything from other clients is hostile).
  onPresence(list) {
    this.players.clear();
    for (const { id, meta } of list) {
      if (!meta || typeof meta !== 'object') continue;
      const p = { id: String(id).slice(0, 16), name: cleanCrewName(meta.n) || 'Racer', uid: String(meta.u || '').slice(0, 12), rep: Math.max(0, Math.min(1e9, +meta.rp || 0)), where: /^[a-z0-9]{0,12}$/.test(meta.w || '') ? meta.w : '', crew: null };
      const c = meta.cr;
      if (c && typeof c === 'object' && cleanId(c.i) && /^[\w-]{40,50}\.[\w-]{40,50}$/.test(String(c.pk))) {
        p.crew = { id: c.i, name: cleanCrewName(c.n), tag: cleanTag(c.t), color: cleanColor(c.c), motto: cleanMotto(c.m), open: c.o ? 1 : 0, pk: c.pk, leader: c.r === 'l' };
        if (p.crew.name.length < 2 || p.crew.tag.length < 2) p.crew = null;
      }
      this.players.set(p.id, p);
    }
    this.requests = this.requests.filter(r => this.players.has(r.id));
    this.emit('dir');
  }

  // Live crews: grouped by crew id, members counted only if they carry the same pinned key.
  directory() {
    const byId = new Map();
    for (const p of this.players.values()) {
      if (!p.crew) continue;
      let g = byId.get(p.crew.id);
      if (!g) { g = { ...p.crew, members: [], rep: 0 }; byId.set(p.crew.id, g); }
      else if (p.crew.leader && !g.leaderSeen) Object.assign(g, p.crew);
      if (p.crew.leader) g.leaderSeen = true;
      if (p.crew.pk !== g.pk) continue;
      g.members.push(p); g.rep += p.rep;
    }
    return [...byId.values()].filter(g => g.members.length).sort((a, b) => b.members.length - a.members.length || b.rep - a.rep);
  }
  crewMembers(crewId) { return (this.directory().find(g => g.id === crewId)?.members) || []; }
  nameTaken(name, tag, exceptId = '') {
    return this.directory().some(g => g.id !== exceptId && (g.name.toLowerCase() === name.toLowerCase() || g.tag === tag));
  }

  // ---------------------------------------------------------------- sending
  send(msg) { try { this.tr?.send({ ...msg, id: this.id }); } catch { /* dropped */ } }
  say(text) {
    const t = cleanText(text), c = this.me.crew;
    if (!t || !c || !this.active) return;
    this.send({ k: 'cc', crew: c.id, n: this.me.name, x: t });
    this.addChat(this.me.name, t, true);
  }
  addChat(name, text, mine = false) {
    this.chat.push({ name, text, mine, t: Date.now() });
    if (this.chat.length > MAX_CHAT) this.chat.shift();
    this.emit('chat', { name, text, mine });
  }
  request(g) {
    if (!this.active) return false;
    this.pending = { crew: g.id, pk: g.pk, name: g.name };
    this.send({ k: 'req', crew: g.id, n: this.me.name, u: this.me.uid });
    return true;
  }
  async command(c, to) {
    const crew = this.me.crew;
    if (!crew || crew.role !== 'leader' || !this.me.sk) return false;
    const m = { k: 'cmd', c, crew: crew.id, to, ts: Date.now(), nz: Math.random().toString(36).slice(2, 10) };
    m.sig = await sign(crew.pk, this.me.sk, cmdText(m));
    this.send(m);
    return true;
  }
  accept(reqId) { this.requests = this.requests.filter(r => r.id !== reqId); this.emit('dir'); return this.command('acc', reqId); }
  decline(reqId) { this.requests = this.requests.filter(r => r.id !== reqId); this.emit('dir'); }
  kick(playerId) { return this.command('kick', playerId); }
  disband() { return this.command('disband', '*'); }

  // ---------------------------------------------------------------- receiving
  async receive(m) {
    if (!m || typeof m !== 'object' || typeof m.id !== 'string' || m.id === this.id || m.id.length > 16) return;
    const crew = this.me.crew, sender = this.players.get(m.id);
    if (m.k === 'cc') {
      // crew chat: only from someone who is in my crew (per presence), only to my crew
      if (crew && m.crew === crew.id && sender?.crew?.id === crew.id && sender.crew.pk === crew.pk) {
        const t = cleanText(m.x); if (t) this.addChat(cleanCrewName(m.n) || sender.name, t);
      }
    } else if (m.k === 'req') {
      if (crew && crew.role === 'leader' && m.crew === crew.id && sender && !this.requests.some(r => r.id === m.id)) {
        this.requests.push({ id: m.id, name: cleanCrewName(m.n) || sender.name, uid: String(m.u || '').slice(0, 12), t: Date.now() });
        this.emit('request', this.requests[this.requests.length - 1]);
      }
    } else if (m.k === 'cmd') {
      if (typeof m.sig !== 'string' || typeof m.nz !== 'string' || this.seenNonces.has(m.nz) || Math.abs(Date.now() - (+m.ts || 0)) > 60000) return;
      if (m.c === 'acc' && this.pending && m.crew === this.pending.crew && m.to === this.id) {
        if (await verify(this.pending.pk, cmdText(m), m.sig)) { this.seenNonces.add(m.nz); const p = this.pending; this.pending = null; this.emit('accepted', p); }
      } else if ((m.c === 'kick' || m.c === 'disband') && crew && m.crew === crew.id && (m.to === this.id || m.to === '*') && crew.role !== 'leader') {
        if (await verify(crew.pk, cmdText(m), m.sig)) { this.seenNonces.add(m.nz); this.emit(m.c === 'kick' ? 'kicked' : 'disbanded', crew); }
      }
    }
  }
}

export const lobby = new CrewLobby();
