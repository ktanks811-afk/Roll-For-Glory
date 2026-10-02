// The permanent half of online crews: a small database that stores crews,
// members, join requests and chat history, so a crew is still there when
// nobody is online. All access goes through Postgres functions (the tables
// have row level security and no policies, so the public key can't read or
// write them directly). A player is a random public id plus a private key kept
// in their save; every function that changes something checks the key, and the
// server only stores a hash of it.
//
// A same-browser implementation (localStorage) mirrors the rules for offline
// testing and `?net=local`.

import { SUPABASE_URL, SUPABASE_KEY, online } from './online.js';

const norm = r => (r && typeof r === 'object' ? r : {});

async function rpc(fn, args = {}) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST', signal: ctl.signal,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { /* not json */ }
    if (!res.ok) throw new Error((data && data.message) || `Crew server error (${res.status})`);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The crew server took too long to answer.');
    throw e;
  } finally { clearTimeout(to); }
}

class RemoteDB {
  list() { return rpc('rfg_crew_list').then(r => (Array.isArray(r) ? r : [])); }
  members(crew) { return rpc('rfg_crew_members_of', { p_crew: crew }).then(r => (Array.isArray(r) ? r : [])); }
  mine(u) { return rpc('rfg_crew_mine', { p_uid: u.uid, p_tok: u.tok }).then(norm); }
  create(u, c) { return rpc('rfg_crew_create', { p_id: c.id, p_name: c.name, p_tag: c.tag, p_color: c.color, p_motto: c.motto, p_open: c.open, p_uid: u.uid, p_tok: u.tok, p_uname: u.name, p_rep: u.rep }).then(norm); }
  join(u, crew) { return rpc('rfg_crew_join', { p_crew: crew, p_uid: u.uid, p_tok: u.tok, p_uname: u.name, p_rep: u.rep }).then(norm); }
  request(u, crew) { return rpc('rfg_crew_request', { p_crew: crew, p_uid: u.uid, p_tok: u.tok, p_uname: u.name, p_rep: u.rep }).then(norm); }
  cancelRequest(u) { return rpc('rfg_crew_cancel_request', { p_uid: u.uid, p_tok: u.tok }); }
  sync(u) { return rpc('rfg_crew_sync', { p_uid: u.uid, p_tok: u.tok, p_uname: u.name, p_rep: u.rep }); }
  leave(u) { return rpc('rfg_crew_leave', { p_uid: u.uid, p_tok: u.tok }); }
  pending(u) { return rpc('rfg_crew_pending', { p_uid: u.uid, p_tok: u.tok }).then(r => (Array.isArray(r) ? r : [])); }
  decide(u, target, accept) { return rpc('rfg_crew_decide', { p_uid: u.uid, p_tok: u.tok, p_target: target, p_accept: accept }); }
  kick(u, target) { return rpc('rfg_crew_kick', { p_uid: u.uid, p_tok: u.tok, p_target: target }); }
  edit(u, motto, open) { return rpc('rfg_crew_edit', { p_uid: u.uid, p_tok: u.tok, p_motto: motto, p_open: open }); }
  disband(u) { return rpc('rfg_crew_disband', { p_uid: u.uid, p_tok: u.tok }); }
  say(u, text) { return rpc('rfg_crew_say', { p_uid: u.uid, p_tok: u.tok, p_text: text }); }
  chat(u) { return rpc('rfg_crew_chat_get', { p_uid: u.uid, p_tok: u.tok }).then(r => (Array.isArray(r) ? r : [])); }
}

// Same rules, kept in localStorage so two tabs of one browser share it.
const KEY = 'rfg-localcrews';
class LocalDB {
  load() { try { return { crews: [], members: [], requests: [], chat: [], ...(JSON.parse(localStorage.getItem(KEY) || '{}')) }; } catch { return { crews: [], members: [], requests: [], chat: [] }; } }
  save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  auth(d, u) { return d.members.find(m => m.uid === u.uid && m.active && m.tok === u.tok); }
  async list() {
    const d = this.load();
    return d.crews.filter(c => !c.disbanded).map(c => { const ms = d.members.filter(m => m.crew_id === c.id && m.active); return { id: c.id, name: c.name, tag: c.tag, color: c.color, motto: c.motto, open: c.open, members: ms.length, rep: ms.reduce((t, m) => t + m.rep, 0), leader: ms.find(m => m.leader)?.name || '' }; })
      .sort((a, b) => b.members - a.members || b.rep - a.rep);
  }
  async members(crew) { return this.load().members.filter(m => m.crew_id === crew && m.active).map(m => ({ uid: m.uid, name: m.name, rep: m.rep, leader: m.leader, joined: m.joined })).sort((a, b) => (b.leader - a.leader) || (b.rep - a.rep)); }
  async mine(u) {
    const d = this.load(), m = this.auth(d, u);
    const c = m && d.crews.find(x => x.id === m.crew_id && !x.disbanded);
    if (c) return { crew: { id: c.id, name: c.name, tag: c.tag, color: c.color, motto: c.motto, open: c.open }, role: m.leader ? 'leader' : 'member' };
    const r = d.requests.find(x => x.uid === u.uid && x.tok === u.tok && x.status === 'pending');
    return r ? { pending: r.crew_id } : {};
  }
  put(d, u, crewId, leader) {
    const i = d.members.findIndex(m => m.uid === u.uid);
    const row = { crew_id: crewId, uid: u.uid, tok: u.tok, name: u.name.slice(0, 16), rep: Math.max(0, u.rep | 0), leader, active: true, joined: new Date().toISOString() };
    if (i >= 0) d.members[i] = row; else d.members.push(row);
    d.requests.forEach(r => { if (r.uid === u.uid && r.status === 'pending') r.status = 'cancelled'; });
  }
  async create(u, c) {
    const d = this.load();
    if (d.members.some(m => m.uid === u.uid && m.active)) throw new Error('You are already in a crew. Leave it first.');
    if (d.crews.some(x => x.name.toLowerCase() === c.name.toLowerCase())) throw new Error('That crew name is taken.');
    if (d.crews.some(x => x.tag === c.tag.toUpperCase())) throw new Error('That tag is taken.');
    d.crews.push({ id: c.id, name: c.name, tag: c.tag.toUpperCase(), color: c.color, motto: c.motto.slice(0, 40), open: !!c.open, disbanded: false });
    this.put(d, u, c.id, true); this.save(d); return this.mine(u);
  }
  async join(u, crew) {
    const d = this.load(), c = d.crews.find(x => x.id === crew && !x.disbanded);
    if (!c) throw new Error('That crew no longer exists.');
    if (!c.open) throw new Error('That crew is invite only. Send a request.');
    if (d.members.some(m => m.uid === u.uid && m.active)) throw new Error('You are already in a crew.');
    if (d.members.filter(m => m.crew_id === crew && m.active).length >= 50) throw new Error('That crew is full (50).');
    this.put(d, u, crew, false); this.save(d); return this.mine(u);
  }
  async request(u, crew) {
    const d = this.load();
    if (!d.crews.some(x => x.id === crew && !x.disbanded)) throw new Error('That crew no longer exists.');
    if (d.members.some(m => m.uid === u.uid && m.active)) throw new Error('You are already in a crew.');
    d.requests.forEach(r => { if (r.uid === u.uid && r.status === 'pending') r.status = 'cancelled'; });
    d.requests.push({ crew_id: crew, uid: u.uid, tok: u.tok, name: u.name.slice(0, 16), rep: u.rep | 0, status: 'pending' });
    this.save(d); return this.mine(u);
  }
  async cancelRequest(u) { const d = this.load(); d.requests.forEach(r => { if (r.uid === u.uid && r.tok === u.tok && r.status === 'pending') r.status = 'cancelled'; }); this.save(d); }
  async sync(u) { const d = this.load(), m = this.auth(d, u); if (m) { m.name = u.name.slice(0, 16); m.rep = Math.max(0, u.rep | 0); this.save(d); } }
  async leave(u) { const d = this.load(), m = this.auth(d, u); if (!m) return; if (m.leader) throw new Error('The leader disbands the crew instead of leaving.'); m.active = false; this.save(d); }
  lead(d, u) { const m = this.auth(d, u); if (!m || !m.leader) throw new Error('Only the leader can do that.'); return m; }
  async pending(u) { const d = this.load(), m = this.auth(d, u); if (!m || !m.leader) return []; return d.requests.filter(r => r.crew_id === m.crew_id && r.status === 'pending').map(r => ({ uid: r.uid, name: r.name, rep: r.rep })); }
  async decide(u, target, accept) {
    const d = this.load(), m = this.lead(d, u), r = d.requests.find(x => x.crew_id === m.crew_id && x.uid === target && x.status === 'pending');
    if (!r) throw new Error('That request is gone.');
    if (accept) { this.put(d, { uid: r.uid, tok: r.tok, name: r.name, rep: r.rep }, m.crew_id, false); r.status = 'accepted'; } else r.status = 'declined';
    this.save(d);
  }
  async kick(u, target) { const d = this.load(), m = this.lead(d, u); if (target === u.uid) throw new Error('You cannot kick yourself. Disband instead.'); const t = d.members.find(x => x.crew_id === m.crew_id && x.uid === target); if (t) t.active = false; this.save(d); }
  async edit(u, motto, open) { const d = this.load(), m = this.lead(d, u), c = d.crews.find(x => x.id === m.crew_id); c.motto = (motto || '').slice(0, 40); if (open !== null && open !== undefined) c.open = !!open; this.save(d); }
  async disband(u) {
    const d = this.load(), m = this.lead(d, u);
    d.members.forEach(x => { if (x.crew_id === m.crew_id) { x.active = false; x.leader = false; } });
    d.requests.forEach(r => { if (r.crew_id === m.crew_id && r.status === 'pending') r.status = 'cancelled'; });
    const c = d.crews.find(x => x.id === m.crew_id); c.disbanded = true; c.name = 'gone ' + c.id; c.tag = 'ZZ' + (d.crews.indexOf(c) % 100);
    this.save(d);
  }
  async say(u, text) { const d = this.load(), m = this.auth(d, u); if (!m) throw new Error('Join a crew first.'); const t = String(text).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 90); if (!t) return; d.chat.push({ crew_id: m.crew_id, uid: u.uid, name: m.name, text: t, t: new Date().toISOString() }); d.chat = d.chat.slice(-300); this.save(d); }
  async chat(u) { const d = this.load(), m = this.auth(d, u); return m ? d.chat.filter(c => c.crew_id === m.crew_id).slice(-50) : []; }
}

const remote = new RemoteDB(), local = new LocalDB();
export const crewdb = () => (online.kind === 'local' ? local : remote);
