// Riding along with other players on your server. Either side can start it:
// walk up to someone's car and ask to hop in, or pull up next to someone on
// foot and offer them a ride. The driver keeps driving their own car as usual;
// the passenger's game parks their character in that car and follows it (the
// position comes from the same live sync every car on the server uses).
//
// Messages go over the server channel as { k: 'rq', t, to, rid }:
//   ask    passenger → driver   "can I ride with you?"
//   offer  driver → passenger   "want a ride?"
//   yes / no / full / cancel    answers
//   drop   driver → passenger   "this is your stop"
//   out    passenger → driver   "I got out"

import { online } from './online.js';

export const RIDE_FOR = 20;    // seconds to answer
export const SEATS = 3;        // passengers per car
export const REACH = 7;        // metres: close enough to ask or offer from the street
export const KEEP = 40;        // metres: still close enough when the answer comes in

const rid = () => Math.random().toString(36).slice(2, 10);
const now = () => performance.now() / 1000;

class Rides {
  constructor() {
    this.out = null;          // { rid, to, name, kind: 'ask' | 'offer', at }
    this.inbox = new Map();   // rid -> { rid, from, name, kind, at }
    this.with = null;         // the driver you're riding with: { id, name }
    this.listeners = new Set();
    online.on((ev, m) => {
      if (ev === 'ride') this.got(m);
      if (ev === 'status' && !online.active) { this.out = null; this.inbox.clear(); }
    });
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev, d) { this.listeners.forEach(f => { try { f(ev, d); } catch { /* listener bug */ } }); }

  // Who's riding in my car right now (from their own state updates).
  riders() { return online.list().filter(p => p.ride && p.ride === online.id); }
  seatsLeft() { return SEATS - this.riders().length; }

  request(peer, kind) {
    if (!online.active || !peer) return false;
    if (this.out) this.cancel();
    const r = rid();
    this.out = { rid: r, to: peer.id, name: peer.name, kind, at: now() };
    online.send({ k: 'rq', t: kind, to: peer.id, rid: r });
    setTimeout(() => { if (this.out?.rid === r) { this.out = null; this.emit('expired', { name: peer.name, kind }); } }, RIDE_FOR * 1000);
    return true;
  }
  ask(peer) { return this.request(peer, 'ask'); }
  offer(peer) { return this.request(peer, 'offer'); }
  cancel() { if (this.out) online.send({ k: 'rq', t: 'cancel', to: this.out.to, rid: this.out.rid }); this.out = null; }
  answer(inv, t) {
    this.inbox.delete(inv.rid);
    online.send({ k: 'rq', t, to: inv.from, rid: inv.rid });
  }
  // The newest request still waiting on you.
  pending() { let last = null; for (const v of this.inbox.values()) last = v; return last; }

  drop(peer) { online.send({ k: 'rq', t: 'drop', to: peer.id, rid: 'drop' }); }
  // Riding state: online.ride goes out with every position update so everyone
  // else hides you (you're inside their car) and the driver sees you aboard.
  start(peer) { this.with = { id: peer.id, name: peer.name }; online.ride = peer.id; this.out = null; }
  stop(tell = true) {
    if (!this.with) return;
    if (tell) online.send({ k: 'rq', t: 'out', to: this.with.id, rid: 'out' });
    this.with = null; online.ride = '';
  }

  got(m) {
    const r = typeof m.rid === 'string' ? m.rid.slice(0, 12) : '';
    if (!r) return;
    const name = m.peer?.name || 'Racer';
    if (m.t === 'ask' || m.t === 'offer') {
      if (this.inbox.size >= 3) { online.send({ k: 'rq', t: 'no', to: m.from, rid: r }); return; }
      const inv = { rid: r, from: m.from, name, kind: m.t, at: now() };
      this.inbox.set(r, inv);
      setTimeout(() => { if (this.inbox.delete(r)) this.emit('gone', inv); }, RIDE_FOR * 1000);
      this.emit('request', inv);
    } else if (m.t === 'cancel') {
      const inv = this.inbox.get(r);
      if (inv && inv.from === m.from) { this.inbox.delete(r); this.emit('gone', inv); }
    } else if (m.t === 'drop') {
      if (this.with?.id === m.from) this.emit('dropped', { id: m.from, name });
    } else if (m.t === 'out') {
      this.emit('left', { id: m.from, name });
    } else if (this.out && this.out.rid === r && this.out.to === m.from) {
      const o = this.out; this.out = null;
      this.emit(m.t === 'yes' ? 'accepted' : m.t === 'full' ? 'full' : 'declined', o);
    }
  }
}

export const rides = new Rides();
