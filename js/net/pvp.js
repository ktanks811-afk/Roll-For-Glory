// Head-to-head races against real players on your server: roll races and
// drag races. The invite goes over the server channel; once it's accepted
// both cars get a private race channel of their own (so 15 Hz race updates
// don't eat the whole server's message budget).
//
// Each player drives their own car on their own phone with the normal race
// scene (race2d/race.js); the other car on screen is the other player, moved
// by what their game reports. Times are measured on each side from that
// side's own green light / third honk, so network lag never decides a race.
// Whoever is quicker on their own clock wins; leave mid-race and you forfeit.

import { online, LocalTransport, SupabaseTransport } from './online.js';

const INVITE_FOR = 25;        // seconds to answer
const SEND_HZ = 15;           // race updates per second
const LOST_AFTER = 8;         // seconds of silence mid-race = they left

export const PVP_ROLLS = [30, 40, 60];
export const PVP_DISTS = { roll: ['quarter', 'half'], drag: ['eighth', 'quarter'] };
export const PVP_WAGERS = [0, 500, 1000, 5000, 10000, 25000];

const n = (v, lo, hi, d = 0) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const rid = () => Math.random().toString(36).slice(2, 10);

// Whatever comes in about a race is checked before anything uses it.
export function cleanCfg(m) {
  const type = m.ty === 'drag' ? 'drag' : 'roll';
  const dist = PVP_DISTS[type].includes(m.di) ? m.di : PVP_DISTS[type][1];
  const roll = PVP_ROLLS.includes(m.ro) ? m.ro : 40;
  const wager = PVP_WAGERS.includes(m.wa) ? m.wa : 0;
  return { type, dist, roll, wager };
}
const SUM_KEYS = ['rt', 'time', 'elapsed', 'trap', 'peak', 'spin'];
export function cleanFin(m) {
  const out = { red: !!m.red, jump: !!m.jump, finished: !!m.fin, crashes: Math.round(n(m.crashes, 0, 50)), shifts: Math.round(n(m.shifts, 0, 50)), wheelie: Math.round(n(m.wheelie, 0, 99)) };
  for (const k of SUM_KEYS) out[k] = typeof m[k] === 'number' && isFinite(m[k]) ? n(m[k], -1, 999) : null;
  out.splits = {};
  if (m.splits && typeof m.splits === 'object') for (const k of ['sixty', 'three30', 'eighth', 'thousand', 'quarter', 'half', 'sixtyMph', 'three30Mph', 'eighthMph', 'thousandMph', 'quarterMph', 'halfMph']) if (typeof m.splits[k] === 'number' && isFinite(m.splits[k])) out.splits[k] = n(m.splits[k], 0, 999);
  return out;
}

// The private channel for one race.
export class RaceLink {
  constructor(id, host, peerName) {
    Object.assign(this, { id, host, peerName });
    this.me = rid();
    this.theyReady = false; this.started = false; this.tree = null;
    this.state = null; this.stateAt = 0; this.fin = null; this.gone = false; this.lastHeard = performance.now() / 1000;
    this.sendT = 0; this.hiT = 0; this.goSent = 0;
  }
  async open() {
    const T = online.transportKind === 'local' ? LocalTransport : SupabaseTransport;
    this.tr = new T('race-' + this.id, m => this.receive(m), this.me, null);
    await this.tr.open('race');
    this.say({ k: 'hi' });
  }
  say(m) { try { this.tr?.send({ ...m, id: this.me }); } catch { /* dropped */ } }
  receive(m) {
    if (!m || typeof m !== 'object' || m.id === this.me) return;
    this.lastHeard = performance.now() / 1000;
    if (m.k === 'hi') { if (!this.theyReady) { this.theyReady = true; this.say({ k: 'hi' }); } }
    else if (m.k === 'go') { this.theyReady = true; if (!this.host) this.started = true; }
    else if (m.k === 'tree') { if (!this.host && this.tree == null) this.tree = n(m.d, 0.3, 3, 1); }
    else if (m.k === 'p') { this.state = m; this.stateAt = this.lastHeard; }
    else if (m.k === 'fin') { if (!this.fin) this.fin = cleanFin(m); this.say({ k: 'ack' }); }
    else if (m.k === 'ack') this.acked = true;
    else if (m.k === 'bye') this.gone = true;
  }
  // Called every race frame. Returns true once both sides are in.
  tick(dt) {
    const now = performance.now() / 1000;
    this.hiT -= dt;
    if (!this.started) {
      if (this.hiT <= 0) { this.hiT = 0.5; this.say({ k: 'hi' }); }
      if (this.host && this.theyReady) { this.started = true; this.say({ k: 'go' }); this.goSent = 2; this.goT = 0.25; }
    } else if (this.host && this.goSent > 0) {
      // the go is repeated a couple of times in case one goes missing
      this.goT -= dt; if (this.goT <= 0) { this.goT = 0.25; this.goSent--; this.say({ k: 'go' }); }
    }
    if (this.started && now - this.lastHeard > LOST_AFTER) this.gone = true;
    return this.started;
  }
  sendState(dt, st) {
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = 1 / SEND_HZ;
    this.say({ k: 'p', ...st });
  }
  sendTree(d) { this.say({ k: 'tree', d }); }
  sendFin(f) {
    this.say({ k: 'fin', ...f });
    // resend until they confirm
    let tries = 0;
    const iv = setInterval(() => { if (this.acked || ++tries > 12 || !this.tr) clearInterval(iv); else this.say({ k: 'fin', ...f }); }, 500);
  }
  close() { try { this.say({ k: 'bye' }); this.tr?.close(); } catch { /* closed */ } this.tr = null; }
}

// Invites in and out.
class Pvp {
  constructor() {
    this.out = null;          // { rid, to, name, cfg, at }
    this.inbox = new Map();   // rid -> { rid, from, name, cfg, at }
    this.listeners = new Set();
    this.busy = () => false;  // set by the UI: true while already racing
    online.on((ev, m) => { if (ev === 'pvp') this.got(m); if (ev === 'status' && !online.active) { this.out = null; this.inbox.clear(); } });
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev, d) { this.listeners.forEach(f => { try { f(ev, d); } catch { /* listener bug */ } }); }

  challenge(peer, cfg) {
    if (!online.active || !peer) return false;
    const r = rid();
    this.out = { rid: r, to: peer.id, name: peer.name, cfg, at: performance.now() / 1000 };
    online.send({ k: 'pv', t: 'ask', to: peer.id, rid: r, ty: cfg.type, di: cfg.dist, ro: cfg.roll, wa: cfg.wager });
    setTimeout(() => { if (this.out?.rid === r) { this.out = null; this.emit('expired', { name: peer.name }); } }, INVITE_FOR * 1000);
    return true;
  }
  cancel() { if (this.out) online.send({ k: 'pv', t: 'cancel', to: this.out.to, rid: this.out.rid }); this.out = null; }
  answer(inv, yes) {
    this.inbox.delete(inv.rid);
    online.send({ k: 'pv', t: yes ? 'yes' : 'no', to: inv.from, rid: inv.rid });
  }

  got(m) {
    const r = typeof m.rid === 'string' ? m.rid.slice(0, 12) : '';
    if (!r) return;
    if (m.t === 'ask') {
      if (this.busy() || this.inbox.size >= 3) { online.send({ k: 'pv', t: 'busy', to: m.from, rid: r }); return; }
      const inv = { rid: r, from: m.from, name: m.peer?.name || 'Racer', peer: m.peer, cfg: cleanCfg(m), at: performance.now() / 1000 };
      this.inbox.set(r, inv);
      setTimeout(() => { if (this.inbox.delete(r)) this.emit('gone', inv); }, INVITE_FOR * 1000);
      this.emit('invite', inv);
    } else if (m.t === 'cancel') {
      const inv = this.inbox.get(r);
      if (inv && inv.from === m.from) { this.inbox.delete(r); this.emit('gone', inv); }
    } else if (this.out && this.out.rid === r && this.out.to === m.from) {
      const o = this.out; this.out = null;
      if (m.t === 'yes') this.emit('accepted', { ...o, peer: m.peer });
      else this.emit(m.t === 'busy' ? 'busy' : 'declined', o);
    }
  }
}

export const pvp = new Pvp();
