// Riding along in another player's car, and carrying players in yours (the
// requests themselves are in net/ride.js). As a passenger your character sits
// in their car: you can't walk, the camera rides with their car, and USE (or
// your get-in/out button) gets you out once they slow down. As the driver
// nothing changes for you except a tag saying who's aboard.

import { online } from '../net/online.js';
import { rides, REACH, KEEP } from '../net/ride.js';
import { dimsFor } from '../gfx2d/carSprite.js';
import { pad } from '../core/gamepad.js';
import { esc } from '../ui/dom.js';
import { audio } from '../core/audio.js';

const OUT_SPEED = 4;   // m/s: the car has to be about stopped to climb out
const BESIDE = 4.5;    // metres: right at their door, USE goes to them even by a shop door

export class RideAlong {
  constructor(w) {
    this.w = w;
    this.near = null;       // a player you could ask or offer right now
    this.off = rides.on((ev, d) => this.onEvent(ev, d));
  }

  get riding() { return rides.with; }
  get peer() { return rides.with ? online.peers.get(rides.with.id) : null; }
  riders() { return rides.riders(); }

  // Can you get in someone's car right now? null = yes, else why not.
  cantRide() {
    const w = this.w;
    if (!online.active) return 'You need to be online.';
    if (w.inCar) return 'Get out of your car first.';
    if (rides.with) return `You're already riding with ${rides.with.name}.`;
    if (w.police?.active) return 'Lose the cops first.';
    if (w.combat?.rob || w.combat?.mug || w.thefts?.act) return 'Finish what you\'re doing first.';
    return null;
  }
  cantCarry() {
    const w = this.w;
    if (!online.active) return 'You need to be online.';
    if (!w.inCar || !w.vehicle) return 'Get in your car first.';
    if (w.vehicle.car?.hot) return 'Not in a stolen car.';
    if (rides.seatsLeft() <= 0) return 'Your car is full.';
    return null;
  }
  dist(p) { const me = this.w.playerState(); return Math.hypot(p.x - me.x, p.z - me.z); }

  // Ask to ride with them (they're driving) or offer them a ride (they're walking).
  request(peer) {
    if (!peer || peer.fresh) return false;
    const w = this.w;
    const kind = peer.inCar ? 'ask' : 'offer';
    const why = kind === 'ask' ? this.cantRide() : this.cantCarry();
    if (why) { w.ui.toast(why, 'bad'); return false; }
    if (peer.ride) { w.ui.toast(`${peer.name} is already riding with someone.`, 'info'); return false; }
    if (this.dist(peer) > KEEP) { w.ui.toast(`Get closer to ${peer.name} first.`, 'info'); return false; }
    rides[kind](peer);
    w.ui.toast(kind === 'ask' ? `Asked ${peer.name} for a ride.` : `Offered ${peer.name} a ride.`, 'good');
    return true;
  }

  onEvent(ev, d) {
    const w = this.w, toast = (m, k) => w.ui.toast(m, k);
    if (ev === 'request') {
      audio.horn?.();
      toast(d.kind === 'ask' ? `🚗 ${d.name} wants to ride with you. Press USE to let them in.` : `🚗 ${d.name} is offering you a ride. Press USE to hop in.`, 'info');
    } else if (ev === 'accepted') {
      const p = online.peers.get(d.to);
      if (d.kind === 'offer') { toast(`${d.name} hopped in.`, 'good'); return; }
      // they let you in: climb aboard if you can still reach the car
      const why = this.cantRide();
      if (!p || !p.inCar || why || this.dist(p) > KEEP) { toast(why || `${d.name} drove off.`, 'bad'); online.send({ k: 'rq', t: 'out', to: d.to, rid: 'out' }); return; }
      this.board(p);
    } else if (ev === 'declined') toast(d.kind === 'ask' ? `${d.name} said no.` : `${d.name} passed on the ride.`, 'info');
    else if (ev === 'full') toast(`${d.name}'s car is full.`, 'info');
    else if (ev === 'expired') toast(`${d.name} never answered.`, 'info');
    else if (ev === 'gone') { /* the toast already timed out */ }
    else if (ev === 'dropped') { toast(`${d.name} dropped you off.`, 'info'); this.getOut(true); }
    else if (ev === 'left') toast(`${d.name} got out.`, 'info');
  }

  // Answer the newest request waiting on you.
  acceptPending() {
    const inv = rides.pending();
    if (!inv) return false;
    const w = this.w, p = online.peers.get(inv.from);
    if (!p) { rides.inbox.delete(inv.rid); w.ui.toast(`${inv.name} left the server.`, 'bad'); return true; }
    if (inv.kind === 'ask') {
      const why = this.cantCarry();
      if (why) { rides.answer(inv, rides.seatsLeft() <= 0 ? 'full' : 'no'); w.ui.toast(why, 'bad'); return true; }
      rides.answer(inv, 'yes');
      w.ui.toast(`Letting ${inv.name} in.`, 'good');
    } else {
      const why = this.cantRide();
      if (why || !p.inCar || this.dist(p) > KEEP) { rides.answer(inv, 'no'); w.ui.toast(why || `${inv.name} drove off.`, 'bad'); return true; }
      rides.answer(inv, 'yes');
      this.board(p);
    }
    return true;
  }

  board(p) {
    const w = this.w;
    rides.start(p);
    w.foot.moving = 0;
    w.ui.toast(`Riding with ${p.name}. You can get out once they stop.`, 'good');
    audio.click?.();
  }

  // Climb out beside their car. `forced` = they dropped you or drove off.
  getOut(forced = false) {
    const w = this.w, r = rides.with;
    if (!r) return false;
    const p = this.peer;
    if (!forced && p && Math.abs(p.sp) > OUT_SPEED) { w.ui.toast(`Tell ${r.name} to slow down first.`, 'info'); return true; }
    if (p?.model) {
      const W = dimsFor(p.model).W, rx = Math.cos(p.h), rz = Math.sin(p.h);
      w.foot.x = p.x + rx * (W / 2 + 0.8); w.foot.z = p.z + rz * (W / 2 + 0.8); w.foot.h = p.h;
    }
    rides.stop(!forced || !!p);
    if (!forced) w.ui.toast(`Got out of ${r.name}'s car.`, 'info');
    return true;
  }

  canReach() { return !!this.near && (!this.w.nearLoc || this.nearD < BESIDE); }

  // USE while riding, while a request waits on you, or next to another player.
  tryUse() {
    if (rides.with) return this.getOut();
    if (this.acceptPending()) return true;
    if (this.canReach()) { this.request(this.near); return true; }
    return false;
  }

  update(dt) {
    const w = this.w;
    this.near = null;
    const r = rides.with;
    if (r) {
      const p = this.peer;
      if (!online.active || !p) { w.ui.toast(online.active ? `Lost ${r.name}. You're back on foot.` : 'Offline. You\'re back on foot.', 'info'); this.getOut(true); return; }
      if (!p.inCar) { w.ui.toast(`${r.name} parked and got out.`, 'info'); this.getOut(true); return; }
      // sit in their car: the passenger seat moves with it
      w.foot.x = p.x; w.foot.z = p.z; w.foot.h = p.h; w.foot.moving = 0;
      return;
    }
    if (!online.active || rides.out) return;
    // someone close by you could ride with, or give a ride to
    const me = w.playerState();
    if (w.inCar && (!w.vehicle || Math.abs(w.vehicle.speed) > 2)) return;
    let best = null, bd = REACH;
    for (const p of online.list()) {
      if (p.fresh || p.ride || p.inCar === w.inCar) continue;
      const d = Math.hypot(p.x - me.x, p.z - me.z);
      if (d < bd) { bd = d; best = p; }
    }
    this.near = best; this.nearD = bd;
  }

  // Where the camera should sit while you ride: their car.
  view() {
    const p = rides.with && this.peer;
    if (!p) return null;
    return { x: p.x, z: p.z, h: p.h, vx: Math.sin(p.h) * p.sp, vz: -Math.cos(p.h) * p.sp };
  }

  promptHtml(tch) {
    const gp = pad.inUse, use = gp ? (this.w.inCar ? 'B' : 'A') : tch ? 'USE' : this.w.inCar ? 'Enter' : 'E';
    const r = rides.with;
    if (r) return `🚗 Riding with <b>${esc(r.name)}</b> · <kbd>${use}</kbd> get out`;
    const inv = rides.pending();
    if (inv) return `<kbd>${use}</kbd> <b style="color:#2cff7a">${inv.kind === 'ask' ? `Let ${esc(inv.name)} ride with you` : `Hop in with ${esc(inv.name)}`}</b>`;
    if (rides.out) return `<span class="muted">${rides.out.kind === 'ask' ? `Asked ${esc(rides.out.name)} for a ride…` : `Offered ${esc(rides.out.name)} a ride…`}</span>`;
    const riders = this.w.inCar ? rides.riders() : [];
    const aboard = riders.length ? `🚗 Riding with you: ${riders.map(p => esc(p.name)).join(', ')}` : '';
    if (this.canReach()) return `${aboard ? aboard + ' · ' : ''}<kbd>${use}</kbd> ${this.near.inCar ? `Ask ${esc(this.near.name)} for a ride` : `Offer ${esc(this.near.name)} a ride`}`;
    return aboard;
  }

  destroy() { this.off?.(); rides.stop(); }
}
