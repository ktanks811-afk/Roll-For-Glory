// Online crews, live half. Crews themselves are permanent (see crewdb.js); this
// is the realtime layer on top: who from each crew is online right now and
// which server they're on (realtime presence on one shared "crews" channel),
// instant crew chat, and a "poke" so everyone refreshes the moment the leader
// accepts, kicks or edits something. Everything arriving here is untrusted:
// it is sanitised and only ever used for display. The database decides who is
// actually in a crew.

import { LocalTransport, SupabaseTransport, online } from './online.js';

export const CREW_FEE = 1500;
export const CREW_COLORS = ['#e0192e', '#2a7bff', '#2bd96b', '#ffc21a', '#a01aff', '#13b3c4', '#ff6a1a', '#f2f2f2'];
const MAX_CHAT = 80;

export const cleanCrewName = s => String(s ?? '').replace(/[^\w .'\-]/g, '').trim().replace(/\s+/g, ' ').slice(0, 20);
export const cleanTag = s => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
const cleanText = s => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 90);
const cleanId = s => (/^[a-z0-9]{8}$/.test(String(s)) ? String(s) : '');

class CrewLobby {
  constructor() {
    this.status = 'off';      // off | connecting | on | error
    this.error = '';
    this.id = '';
    this.players = new Map(); // presence id -> { id, name, uid, crew (id), where }
    this.listeners = new Set();
    this.chat = [];           // live chat lines for my crew (history comes from the database)
    this.me = { name: 'Racer', uid: '', crewId: '', where: '' };
  }

  get active() { return this.status === 'on'; }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev, d) { this.listeners.forEach(f => { try { f(ev, d); } catch { /* a listener bug must not kill the lobby */ } }); }

  setMe(me) { this.me = { ...this.me, ...me }; if (this.active) this.tr?.update(this.meta()); }
  meta() { const m = this.me; return { n: String(m.name).slice(0, 16), u: String(m.uid).slice(0, 16), c: m.crewId || '', w: m.where || '' }; }

  async connect() {
    if (this.status === 'connecting' || this.status === 'on') return true;
    this.status = 'connecting'; this.error = ''; this.emit('status');
    this.id = Math.random().toString(36).slice(2, 10);
    try {
      const T = online.kind === 'local' ? LocalTransport : SupabaseTransport;
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
    this.tr = null; this.status = 'off'; this.players.clear(); this.emit('status');
  }

  onPresence(list) {
    this.players.clear();
    for (const { id, meta } of list) {
      if (!meta || typeof meta !== 'object') continue;
      this.players.set(String(id).slice(0, 16), {
        id: String(id).slice(0, 16), name: cleanCrewName(meta.n) || 'Racer', uid: String(meta.u || '').slice(0, 16),
        crew: cleanId(meta.c), where: /^[a-z0-9]{0,12}$/.test(meta.w || '') ? meta.w : '',
      });
    }
    this.emit('dir');
  }
  // members of a crew that are online right now, keyed by their public uid
  onlineByUid() { const m = new Map(); for (const p of this.players.values()) if (p.uid) m.set(p.uid, p); return m; }
  onlineCount(crewId) { let n = 0; for (const p of this.players.values()) if (p.crew === crewId) n++; return n; }

  send(msg) { try { this.tr?.send({ ...msg, id: this.id }); } catch { /* dropped */ } }
  // instant chat for people online (the database keeps the history)
  say(text) {
    const t = cleanText(text);
    if (!t || !this.me.crewId || !this.active) return;
    this.send({ k: 'cc', crew: this.me.crewId, n: this.me.name, x: t });
    this.addChat(this.me.name, t, true);
  }
  poke() { if (this.me.crewId) this.send({ k: 'poke', crew: this.me.crewId }); }
  pokeCrew(crewId) { if (cleanId(crewId)) this.send({ k: 'poke', crew: crewId }); }
  addChat(name, text, mine = false) {
    this.chat.push({ name, text, mine, t: Date.now() });
    if (this.chat.length > MAX_CHAT) this.chat.shift();
    this.emit('chat', { name, text, mine });
  }

  receive(m) {
    if (!m || typeof m !== 'object' || typeof m.id !== 'string' || m.id === this.id || m.id.length > 16) return;
    const sender = this.players.get(m.id), mine = this.me.crewId;
    if (m.k === 'cc') {
      if (mine && m.crew === mine && sender?.crew === mine) { const t = cleanText(m.x); if (t) this.addChat(cleanCrewName(m.n) || sender.name, t); }
    } else if (m.k === 'poke') {
      this.emit('poke', { crew: cleanId(m.crew) });
    }
  }
}

export const lobby = new CrewLobby();
