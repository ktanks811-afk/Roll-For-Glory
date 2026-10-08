// Home servers and house deeds. Every career picks one online server as its
// home, and each server holds SERVER_CAP careers. Houses, trap houses and lots
// are deeded per server: once a real player on your server owns one, it's
// gone for everybody else on that server (other servers have their own copy
// of Fort Worth). Sell it and it goes back on the market.
//
// The registry is a small Supabase database reached through Postgres
// functions (supabase/rfg_servers.sql); a career proves who it is with the
// same id + private key that online crews use. `?net=local` swaps in a
// same-browser copy for testing. If the registry can't be reached the game
// carries on: buying just isn't checked against other players until it can.

import { SUPABASE_URL, SUPABASE_KEY, SERVER_CAP, SERVER_BY_ID, online } from './online.js';
import { PROPERTIES } from '../data/world.js';
import { LAND } from '../data/estate.js';

const rnd = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
export function ensureIdentity(s) { s.uid ??= rnd(10); s.crewKey ??= rnd(24); return s.uid; }
export const me = s => { ensureIdentity(s); return { uid: s.uid, tok: s.crewKey, name: String(s.player?.name || 'Racer').slice(0, 16) }; };

// Everything this career owns that can be deeded: bought houses and trap
// houses (not the free starter apartment) and land.
export function deedable(s) {
  const out = (s.properties || []).filter(id => PROPERTIES[id] && PROPERTIES[id].price > 0 && !PROPERTIES[id].land && !LAND[id]);
  for (const [id, l] of Object.entries(s.estate?.land || {})) if (l?.owned && LAND[id]) out.push(id);
  return [...new Set(out)];
}
export const isDeedable = id => !!LAND[id] || (PROPERTIES[id] && PROPERTIES[id].price > 0);

export async function rpc(fn, args = {}) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 9000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST', signal: ctl.signal,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { /* not json */ }
    if (!res.ok) {
      const e = new Error((data && data.message) || `Server error (${res.status})`);
      e.missing = res.status === 404;   // registry not installed yet
      throw e;
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The server took too long to answer.');
    throw e;
  } finally { clearTimeout(to); }
}

const remote = {
  counts: () => rpc('rfg_server_counts').then(r => Object.fromEntries((Array.isArray(r) ? r : []).map(x => [x.server, x.members]))),
  join: (u, server, props) => rpc('rfg_server_join', { p_uid: u.uid, p_tok: u.tok, p_name: u.name, p_server: server, p_props: props }),
  leave: u => rpc('rfg_server_leave', { p_uid: u.uid, p_tok: u.tok }),
  deeds: server => rpc('rfg_deeds_get', { p_server: server }).then(r => (Array.isArray(r) ? r : [])),
  claim: (u, prop) => rpc('rfg_deed_claim', { p_uid: u.uid, p_tok: u.tok, p_prop: prop }),
  release: (u, prop) => rpc('rfg_deed_release', { p_uid: u.uid, p_tok: u.tok, p_prop: prop }),
};

// Same rules in localStorage, so two tabs of one browser share it.
const LKEY = 'rfg-localdeeds';
const local = {
  load() { try { return { members: {}, deeds: {}, ...JSON.parse(localStorage.getItem(LKEY) || '{}') }; } catch { return { members: {}, deeds: {} }; } },
  save(d) { localStorage.setItem(LKEY, JSON.stringify(d)); },
  async counts() { const out = {}; for (const m of Object.values(this.load().members)) out[m.server] = (out[m.server] || 0) + 1; return out; },
  async join(u, server, props) {
    const d = this.load(), m = d.members[u.uid];
    if (m && m.tok !== u.tok) throw new Error('That career belongs to someone else');
    const moving = !m || m.server !== server;
    if (moving && Object.values(d.members).filter(x => x.server === server && x.uid !== u.uid).length >= SERVER_CAP) return { ok: false, full: true };
    const conflicts = props.map(p => d.deeds[server + ':' + p]).filter(x => x && x.uid !== u.uid).map(x => ({ prop: x.prop, name: x.name }));
    if (conflicts.length && moving) return { ok: false, conflicts };
    d.members[u.uid] = { uid: u.uid, tok: u.tok, name: u.name, server };
    for (const p of props) d.deeds[server + ':' + p] ??= { server, prop: p, uid: u.uid, name: u.name };
    this.save(d);
    return { ok: true, server, conflicts };
  },
  async leave(u) { const d = this.load(); if (d.members[u.uid]?.tok !== u.tok) return; delete d.members[u.uid]; this.save(d); },
  async deeds(server) { return Object.values(this.load().deeds).filter(x => x.server === server).map(({ prop, uid, name }) => ({ prop, uid, name })); },
  async claim(u, prop) {
    const d = this.load(), m = d.members[u.uid];
    if (!m || m.tok !== u.tok) throw new Error('Pick a home server first');
    const k = m.server + ':' + prop;
    d.deeds[k] ??= { server: m.server, prop, uid: u.uid, name: u.name };
    this.save(d);
    return { ok: d.deeds[k].uid === u.uid, name: d.deeds[k].name };
  },
  async release(u, prop) { /* Permanent deeds cannot be released. */ },
};

class Deeds {
  constructor() {
    this.server = null;        // whose deeds are loaded
    this.owners = new Map();   // prop -> { uid, name }
    this.loadedAt = 0;
    this.down = false;         // registry unreachable / not installed
    this.listeners = new Set();
    online.on((ev, d) => { if (ev === 'deed') this.gotLive(d); });
  }
  get db() { return online.kind === 'local' ? local : remote; }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach(f => { try { f(); } catch { /* listener bug */ } }); }

  async counts() { try { const c = await this.db.counts(); this.down = false; return c; } catch { this.down = true; return null; } }

  // Make `server` this career's home (or check in). Returns { ok, full?, conflicts? }.
  async join(s, server) {
    if (!SERVER_BY_ID[server]) return { ok: false, error: 'No such server' };
    try {
      const r = await this.db.join(me(s), server, deedable(s));
      this.down = false;
      if (r?.ok) { s.homeServer = server; await this.load(server, true); }
      return r || { ok: false };
    } catch (e) {
      // Registry not reachable: still let them play on the server they picked.
      this.down = true;
      s.homeServer = server;
      return { ok: true, offline: true, error: e.message };
    }
  }
  async leave(s) { try { await this.db.leave(me(s)); } catch { /* best effort */ } s.homeServer = null; this.owners.clear(); this.server = null; this.emit(); }

  async load(server, force = false) {
    if (!server) return;
    if (!force && this.server === server && performance.now() - this.loadedAt < 15000) return;
    try {
      const rows = await this.db.deeds(server);
      this.server = server; this.loadedAt = performance.now(); this.down = false;
      this.owners = new Map(rows.map(r => [r.prop, { uid: r.uid, name: r.name }]));
      this.emit();
    } catch { this.down = true; }
  }

  // Who owns `prop` on your server, if it isn't you (null = free or yours).
  takenBy(s, prop) {
    if (!s.homeServer || this.server !== s.homeServer) return null;
    const o = this.owners.get(prop);
    return o && o.uid !== s.uid ? o.name : null;
  }

  // Before a purchase: lock the deed on your server. { ok, name? }
  async claim(s, prop) {
    if (!s.homeServer || !isDeedable(prop)) return { ok: true };
    try {
      const r = await this.db.claim(me(s), prop);
      this.down = false;
      if (r?.ok) { this.owners.set(prop, { uid: s.uid, name: me(s).name }); online.send({ k: 'deed', p: prop, n: me(s).name, u: s.uid }); }
      else if (r?.name) this.owners.set(prop, { uid: '?', name: r.name });
      this.emit();
      return r || { ok: true };
    } catch (e) {
      // Not registered here yet (new install, or the registry was down when you picked): register now and retry once.
      if (/home server/i.test(e.message) && !this.retrying) {
        this.retrying = true;
        try { const j = await this.join(s, s.homeServer); if (j.ok && !j.offline) return await this.claim(s, prop); } finally { this.retrying = false; }
      }
      this.down = true;
      return { ok: true, offline: true };
    }
  }
  // Deeds are permanent. Kept as a compatibility no-op for older purchase code.
  async release(s, prop) { return { ok: true, permanent: true }; }

  gotLive(d) {
    if (!d || typeof d.p !== 'string' || !isDeedable(d.p) || online.room !== this.server) return;
    if (d.n) this.owners.set(d.p, { uid: String(d.u || '?').slice(0, 16), name: String(d.n).replace(/[^\w .'\-]/g, '').slice(0, 16) || 'Racer' });
    else if (this.owners.get(d.p)?.uid === d.u) this.owners.delete(d.p);
    this.emit();
  }
}

export const deeds = new Deeds();
