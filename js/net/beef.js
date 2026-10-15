// Street beef with the regulars (net/bots.js). The hotheads on a server talk
// down on you when you pass ("lame ass dude"), pick with you, flash a gun,
// post on you on Throttle and text you. You can start it too: talk down in
// chat, post on them, or pick "Beef" next to their name in Online. Once they're
// your opp (core/opps.js) it's on sight: they find you wherever you're online
// and spin on you, either sliding past and shooting out the window or parking
// up the street and walking you down. Shoot back with your own gun: light up
// their car and they peel off, drop them on foot and they go down like any
// player. Everything here is between you and them, on your phone only.

import { online } from './online.js';
import { persona, botMap, chasePlan, planAt, hash } from './bots.js';
import * as O from '../core/opps.js';
import * as BT from '../data/beefTalk.js';
import { districtAt } from '../data/world.js';

const pick = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const pnow = () => performance.now() / 1000;

const NEAR = 16;            // metres: close enough to talk down on you
const ON_SIGHT = 70;        // an opp this close comes at you right away
const SLIDE_V = 13;         // m/s rolling past you (about 30 mph)
const SHOOT_CAR = 24, SHOOT_FOOT = 22;

export class Beef {
  constructor(bots) {
    this.bots = bots;
    this.lookT = 2;
    this.socialT = rnd(150, 320);
    this.attackT = rnd(60, 120);
    this.lastPick = -99;
    this.last = null;           // { b, t }: who just picked with you
  }
  get w() { return this.bots.world; }
  get s() { return this.w?.s; }
  keyOf(b) { return b.okey || O.oppKey(online.room, b.s.who); }
  isOpp(b) { return !!this.s && O.isOpp(this.s, this.keyOf(b)); }
  heat(b) { return this.s ? O.beefWith(this.s, this.keyOf(b))?.heat || 0 : 0; }
  toast(t, tone = 'bad') { this.w?.ui?.toast?.(t, tone); }

  // Can anything happen to you right now?
  free() {
    const w = this.w;
    return !!w && !w.paused && !w.races?.active && !w.inGarage && !w.downed && !(w.combat?.pvpDeadT > 0) && !w.rides?.riding;
  }

  add(b, n, why) {
    const out = O.addBeef(this.s, this.keyOf(b), b.p.name, n, { why });
    if (out.posted) this.toast(`📱 ${b.p.name} posted about you on Throttle.`, 'info');
    if (out.texted) this.toast(`📱 ${b.p.name} texted you.`, 'info');
    if (out.became) this.becameOpp(b);
    return out;
  }
  becameOpp(b) {
    this.toast(`${b.p.name} is your opp now. It's on sight. Keep your strap on you.`, 'bad');
    this.attackT = Math.min(this.attackT, rnd(35, 75));
  }

  // ---- per frame
  tick(dt, me, t) {
    const s = this.s;
    if (!s || !online.active) return;
    O.coolOff(s);
    for (const b of this.bots.list.values()) b.peer.opp = this.isOpp(b);
    this.lookT -= dt;
    if (this.lookT <= 0) { this.lookT = 2; this.look(me, t); }
    this.socialT -= dt;
    if (this.socialT <= 0) { this.socialT = rnd(180, 420); this.posting(); }
    this.hunt(dt, me, t);
  }

  // Somebody close by with a temper says something.
  look(me, t) {
    if (!this.free() || t - this.lastPick < 35) return;
    if (me.inCar && Math.abs(me.speed || 0) > 7) return;      // you flew past
    for (const b of this.bots.list.values()) {
      const p = b.peer;
      if (p.dead || b.attack || b.riding || b.carrying || b.p.temper < 0.4 || (b.picked && t - b.picked < 80)) continue;
      if (p.inCar && p.sp > 4) continue;
      if (Math.hypot(p.x - me.x, p.z - me.z) > NEAR) continue;
      if (this.isOpp(b)) { if (!b.slidAt || t - b.slidAt > 120) { this.slide(b, me, t); return; } continue; }
      if (Math.random() > 0.25 + b.p.temper * 0.35) continue;
      this.provoke(b, t);
      return;
    }
  }
  provoke(b, t) {
    b.picked = t; this.lastPick = t; this.last = { b, t };
    const h = this.heat(b), car = this.bots.myCar();
    if (h >= 55 || (h >= 20 && b.p.temper > 0.85)) {
      this.bots.say(b, pick(BT.FLASH), { car });
      b.peer.gun = pnow() + 5;
      this.toast(`${b.p.name} flashed a gun at you. Let it ride, or tap 😤 next to their name in Online.`, 'bad');
      this.add(b, 25, 'Flashed a gun at you');
    } else if (h >= 20) {
      this.bots.say(b, pick(BT.PICK), { car });
      this.add(b, 15, 'Picked with you');
    } else {
      this.bots.say(b, pick(BT.TRASH), { car });
      this.add(b, 12, 'Talked down on you');
    }
  }

  // A hothead on the server posts on you out of nowhere.
  posting() {
    if (!this.free() || this.bots.clock() - this.bots.joinedAt < 60) return;
    const b = [...this.bots.list.values()].find(b => b.p.temper > 0.72 && !O.beefWith(this.s, this.keyOf(b)));
    if (b && Math.random() < 0.4) this.add(b, O.SALTY_AT + 2, 'Posted on you');
  }

  // You typed something in chat. Talking down on somebody starts it.
  heard(text) {
    if (this.saying) return true;           // our own line going out
    if (!this.s || !BT.INSULT.test(text)) return false;
    const lower = text.toLowerCase(), list = [...this.bots.list.values()].filter(b => !b.peer.dead);
    const named = list.find(b => lower.includes(b.p.name.toLowerCase()) || lower.includes(b.p.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5)));
    const me = this.w?.playerState?.();
    const near = me && list.filter(b => Math.hypot(b.peer.x - me.x, b.peer.z - me.z) < 25).sort((a, c) => Math.hypot(a.peer.x - me.x, a.peer.z - me.z) - Math.hypot(c.peer.x - me.x, c.peer.z - me.z))[0];
    const recent = this.last && this.bots.clock() - this.last.t < 40 && this.bots.list.has(this.last.b.id) ? this.last.b : null;
    const b = named || recent || near;
    if (!b) return false;
    this.startIt(b, 'talk', false);
    return true;
  }

  // You start it: 'talk' | 'post' | 'opp'. `said`: also put the line in chat.
  startIt(b, how, said = true) {
    if (!this.s || !b) return null;
    if (said && how === 'talk') { this.saying = true; try { online.say(`${b.p.name} ${pick(BT.TALK_DOWN)}`); } finally { this.saying = false; } }
    const out = O.startBeef(this.s, this.keyOf(b), b.p.name, how);
    if (out.posted) this.toast(`📱 ${b.p.name} posted about you on Throttle.`, 'info');
    if (out.became) this.becameOpp(b);
    this.bots.later(rnd(2, 5), () => this.bots.say(b, pick(out.became ? BT.CLAP_BACK : [...BT.CLAP_BACK, ...BT.PICK]), { car: this.bots.myCar() }));
    return out;
  }
  squash(b) {
    const why = O.squash(this.s, this.keyOf(b), b.p.temper);
    if (!why) this.bots.later(rnd(2, 4), () => this.bots.say(b, pick(BT.SQUASH_YES)));
    return why;
  }

  // You shot one of them (on foot). Dropped = they went down.
  shot(b, dropped) {
    if (!this.s) return;
    const a = b.attack;
    if (a) { if (dropped) { a.smoked = true; this.end(b, false); } return; }
    if (dropped) { const out = O.smokedThem(this.s, this.keyOf(b), b.p.name); if (out.became) this.becameOpp(b); }
    else if (!b.shotAt || this.bots.clock() - b.shotAt > 10) { b.shotAt = this.bots.clock(); this.add(b, 40, 'You shot at them'); }
  }
  // You're shooting at the car sliding on you.
  carHit(b) {
    const a = b.attack;
    if (!a || a.lit) return;
    if (--a.hp > 0) return;
    a.lit = true;
    this.toast(`You lit up ${b.p.name}'s car. They're getting out of there.`, 'good');
    this.end(b, true);
  }

  // ---- opps coming for you
  hunt(dt, me, t) {
    const s = this.s, mine = O.opps(s);
    if (!mine.length) return;
    if ([...this.bots.list.values()].some(b => b.attack)) return;
    this.attackT -= dt;
    // on sight: one already close by comes straight at you
    const close = [...this.bots.list.values()].find(b => this.isOpp(b) && !b.peer.dead && !b.riding && Math.hypot(b.peer.x - me.x, b.peer.z - me.z) < ON_SIGHT && (!b.slidAt || t - b.slidAt > 120));
    if (close && this.free()) { this.slide(close, me, t); return; }
    if (this.attackT > 0 || !this.free()) return;
    this.attackT = rnd(170, 330);
    // whoever it's been longest since
    const o = mine.sort((a, b) => (a.lastSlide || 0) - (b.lastSlide || 0))[0];
    const b = this.find(o.key) || this.bring(o, me, t);
    if (b) this.slide(b, me, t);
  }
  find(key) { for (const b of this.bots.list.values()) if (b.okey === key) return b; return null; }
  // They log on to come find you.
  bring(o, me, t) {
    const bm = botMap(this.bots.roads);
    const sess = { key: 'opp:' + o.key, slot: 99, who: o.who, start: t, end: t + 600, seed: hash('opp', o.key, Math.floor(t)), said: 1, forced: true };
    const b = this.bots.add(sess, t, me, o.server);
    online.emit('peers');
    return b;
  }

  slide(b, me, t) {
    const p = b.peer, bm = botMap(this.bots.roads);
    b.slidAt = t; b.local = null; b.hold = null;
    const walk = !me.inCar && Math.random() < 0.55;
    // far off (or just logged on): come from a corner out of sight
    const d = Math.hypot(p.x - me.x, p.z - me.z);
    if (d > 320 || (!p.inCar && d > 60)) {
      const ring = bm.nodes.filter(n => { const k = Math.hypot(n.x - me.x, n.z - me.z); return k > 150 && k < 240; });
      const n = ring.length ? ring[Math.floor(Math.random() * ring.length)] : null;
      if (n) Object.assign(p, { x: n.x, z: n.z, h: Math.atan2(me.x - n.x, -(me.z - n.z)), sp: 8 });
    }
    p.inCar = true; p.hp = 100;
    b.attack = { mode: walk ? 'walk' : 'slide', phase: 'come', t0: t, pt: t, plan: null, i: 0, replan: 0, shots: 0, cd: 0, hp: 5 + Math.floor(Math.random() * 3), car: null, hitYou: false, lit: false, smoked: false, said: false, where: districtAt(me.x, me.z) };
    const o = O.beefWith(this.s, this.keyOf(b)); if (o) o.lastSlide = t;
  }

  // Their move this frame while they're on you. True = handled.
  move(b, dt, t, me) {
    const a = b.attack, p = b.peer;
    if (!a) return false;
    if (p.dead) { this.end(b, false); return true; }
    const w = this.w, d = Math.hypot(p.x - me.x, p.z - me.z);
    const goTo = (tx, tz, v) => {
      const dx = tx - p.x, dz = tz - p.z, L = Math.hypot(dx, dz) || 1, step = Math.min(L, v * dt);
      p.x += dx / L * step; p.z += dz / L * step; p.sp = v;
      let dh = Math.atan2(dx, -dz) - p.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
      p.h += dh * Math.min(1, dt * 6);
      return L;
    };
    if (a.phase === 'come') {
      // drive the roads toward you, re-aiming every couple of seconds
      a.replan -= dt;
      if (a.replan <= 0 || !a.plan) {
        a.replan = 2.5;
        a.plan = chasePlan(botMap(this.bots.roads), b.p, { x: p.x, z: p.z, h: p.h, v: p.sp }, me.x, me.z, a.mode === 'walk' ? 6 : 11);
        a.pt = t; a.i = 0;
      }
      const at = planAt(a.plan, t - a.pt, a.i);
      if (at) { a.i = at.i; const k = Math.min(1, dt * 9); p.x += (at.x - p.x) * k; p.z += (at.z - p.z) * k; p.h = at.h; p.sp = at.v; }
      p.inCar = true;
      const near = a.mode === 'walk' ? 45 : 50;
      if (d < near) {
        if (a.mode === 'walk') { a.phase = 'park'; a.pt = t; p.sp = 0; }
        else {
          a.phase = 'pass'; a.pt = t;
          // aim to roll right past you, a lane over
          const side = Math.random() < 0.5 ? 1 : -1, ux = (me.x - p.x) / d, uz = (me.z - p.z) / d;
          a.tx = me.x + ux * 60 - uz * 5 * side; a.tz = me.z + uz * 60 + ux * 5 * side;
          this.bots.say(b, pick(BT.SLIDE));
          this.toast(`⚠ ${b.p.name} is sliding on you! Get down or shoot back.`, 'bad');
        }
      }
      if (t - a.t0 > 75) this.end(b, true);     // couldn't find you
      return true;
    }
    if (a.phase === 'pass') {
      goTo(a.tx, a.tz, SLIDE_V);
      p.inCar = true;
      if (d < SHOOT_CAR) { a.close = true; this.fire(b, me, dt, 0.2, 0.24, [7, 11], 16); }
      if ((a.close && d > SHOOT_CAR + 8) || t - a.pt > 9 || Math.hypot(a.tx - p.x, a.tz - p.z) < 2) this.end(b, true);
      return true;
    }
    if (a.phase === 'park') {
      p.sp = 0;
      if (t - a.pt > 1.2) {
        a.car = { x: p.x, z: p.z, h: p.h };
        a.phase = 'walk'; a.pt = t; p.inCar = false;
        p.gun = pnow() + 30;
        this.bots.say(b, pick(BT.WALK_DOWN));
        this.toast(`⚠ ${b.p.name} hopped out and is walking you down!`, 'bad');
      }
      return true;
    }
    if (a.phase === 'walk') {
      p.inCar = false;
      if (d > 8) { goTo(me.x, me.z, 3.6); p.walk += dt * 11; } else { p.sp = 0; p.h = Math.atan2(me.x - p.x, -(me.z - p.z)); }
      if (d < SHOOT_FOOT && w?.gangs?.clear?.(p, me) !== false) this.fire(b, me, dt, 0.32, 0.55, [9, 14], 10);
      if (a.shots >= 10 || t - a.pt > 14 || d > 70) { a.phase = 'run'; a.pt = t; }
      return true;
    }
    if (a.phase === 'run') {
      p.inCar = false; p.walk += dt * 14;
      const L = goTo(a.car.x, a.car.z, 5);
      if (L < 1.2 || t - a.pt > 15) { Object.assign(p, { x: a.car.x, z: a.car.z, h: a.car.h, inCar: true }); this.end(b, true); }
      return true;
    }
    return false;
  }

  // One shot at you every so often: tracer, sound, and the damage, through the gang world's shooter.
  fire(b, me, dt, acc, gap, dmg, max) {
    const a = b.attack, p = b.peer, w = this.w;
    a.cd -= dt;
    if (a.cd > 0 || a.shots >= max || !w) return;
    a.cd = gap * rnd(0.8, 1.3); a.shots++;
    const hp = w.combat?.arms?.hp, wasDown = !!w.downed;
    const from = { x: p.x, z: p.z };
    if (w.gangs?.shootAtYou) w.gangs.shootAtYou(from, me, acc, Math.round(rnd(dmg[0], dmg[1])), b.p.name);
    else if (Math.random() < acc) w.combat?.hurt?.(Math.round(rnd(dmg[0], dmg[1])), `Shot by ${b.p.name}`);
    if ((w.combat?.arms?.hp ?? hp) < hp || (!wasDown && w.downed)) a.hitYou = true;
  }

  // They're done: peel off (or lie there), then it's on the record.
  end(b, drive) {
    const a = b.attack;
    if (!a) return;
    b.attack = null;
    const p = b.peer, t = this.bots.clock();
    if (p.gun) p.gun = 0;
    if (drive) {
      p.inCar = true;
      this.bots.goLocal(b, t, this.w?.playerState?.() || p);
    }
    if (a.phase !== 'come' || a.smoked) {
      O.afterSlide(this.s, this.keyOf(b), { hitYou: a.hitYou, lit: a.lit, smoked: a.smoked, where: a.where });
      const line = a.smoked ? BT.SMOKED : a.lit ? BT.LIT_UP : a.hitYou ? BT.GOT_YOU : BT.MISSED;
      this.bots.later(rnd(3, 6), () => this.bots.say(b, pick(line)));
      if (a.smoked) this.toast(`You dropped ${b.p.name}. They'll be back.`, 'good');
    }
  }
}
