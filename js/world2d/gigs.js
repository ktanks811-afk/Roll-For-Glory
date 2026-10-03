// Gig shifts in the open world (rules and pay are in core/gigs.js).
//
//   delivery — pick up the order at a diner, drop it at a door before the clock runs out
//   ride     — a Ryde rider waves you down at the curb, walks to the car, and rates your driving
//   tow      — a broken-down car with its hazards on; stop next to it to hook it to your
//              dolly, then haul it to the Hook & Haul yard. It trails behind you.

import { LOCATIONS, LOC_BY_ID } from '../data/world.js';
import { CARS } from '../data/cars.js';
import { carSprite, drawCar, dimsFor } from '../gfx2d/carSprite.js';
import { drawPerson } from '../gfx2d/person.js';
import { audio } from '../core/audio.js';
import { fmtMoney } from '../core/state.js';
import * as G from '../core/gigs.js';

const PICK_R = 10, DROP_R = 11, STOP = 1.6;
const COMMON = CARS.filter(c => !c.market && c.msrp < 60000);
const PAINT = ['#9aa0a8', '#24262b', '#f2f2f2', '#3d4452', '#7a1414', '#1b4fc4', '#c8b98a', '#5a5d63'];
const TOPS = ['#1b4fc4', '#e8641a', '#2a2a3a', '#f2f2f2', '#7a1414', '#1f8f3a', '#a01aff', '#c8b98a'];
const SKIN = ['#8d5a3b', '#c68e65', '#e0b48c', '#5a3622', '#f1c9a5'];
const RIDER_NAMES = ['Keisha', 'Marcus', 'Dolores', 'Trey', 'Ana', 'Big Mike', 'Jasmine', 'Hector', 'Brianna', 'Darnell'];
const FOOD = LOCATIONS.filter(l => l.type === 'food' && l.block);
const RIDE_DEST = LOCATIONS.filter(l => l.block && !['home', 'property'].includes(l.type));
const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtClock = t => `${t < 0 ? '-' : ''}${Math.floor(Math.abs(t) / 60)}:${String(Math.floor(Math.abs(t) % 60)).padStart(2, '0')}`;

export class Gigs {
  constructor(world) {
    this.w = world;
    this.job = null;
    this.rng = Math.random;
    this.done = null;       // the last finished job's rider/car fading out
    if (this.s.gps?.gig) this.s.gps = null;   // a shift doesn't survive a reload
  }

  get s() { return this.w.s; }

  blocked() { return G.blocked(this.s, { policePhase: this.w.police.phase, busy: !!this.job }); }

  // ------------------------------------------------------------ spots
  // The sidewalk in front of a city block: where riders wait and orders get dropped.
  curbSpot(nearX, nearZ, min, max) {
    for (let k = 0; k < 40; k++) {
      const i = Math.floor(this.rng() * 12), j = Math.floor(this.rng() * 12);
      const cx = -825 + 150 * i, cz = -825 + 150 * j, d = 62, along = (this.rng() - 0.5) * 60;
      const side = Math.floor(this.rng() * 4);
      const p = [{ x: cx + along, z: cz - d }, { x: cx + along, z: cz + d }, { x: cx + d, z: cz + along }, { x: cx - d, z: cz + along }][side];
      const dist = Math.hypot(p.x - nearX, p.z - nearZ);
      if (dist < min || dist > max) continue;
      if (LOCATIONS.some(l => Math.hypot(l.x - p.x, l.z - p.z) < 25)) continue;
      return p;
    }
    return { x: nearX + min, z: nearZ };
  }

  // Pulled up on the kerb of a city street, facing along it.
  roadsideSpot(nearX, nearZ, min, max) {
    const roads = this.w.map.roads;
    for (let k = 0; k < 40; k++) {
      const ang = this.rng() * Math.PI * 2, d = min + this.rng() * (max - min);
      const x = clamp(nearX + Math.cos(ang) * d, -850, 850), z = clamp(nearZ + Math.sin(ang) * d, -850, 850);
      const r = roads.nearestOnRoad(x, z);
      if (!r || r.edge.kind !== 'city' || r.s < 25 || r.s > r.edge.len - 25) continue;
      const off = r.edge.width / 2 + 2.2;
      return { x: r.x - r.edge.dz * off, z: r.z + r.edge.dx * off, h: Math.atan2(r.edge.dx, -r.edge.dz) };
    }
    return null;
  }

  address(p) {
    const st = this.w.streetAt(p.x, p.z);
    const n = 100 + Math.floor((Math.abs(p.x * 3.1 + p.z * 1.7) % 49)) * 100 + (Math.floor(Math.abs(p.z)) % 2 ? 1 : 0) * 2 + 2;
    return st ? `${n} ${st}` : this.w.districtAt(p.x, p.z);
  }

  meters(a, b) {
    const r = this.w.map.roads.routeBetween(a.x, a.z, b.x, b.z, null);
    return r?.meters || Math.hypot(a.x - b.x, a.z - b.z) * 1.3;
  }

  // ------------------------------------------------------------ start / end
  start(kind) {
    const why = this.blocked();
    if (why) return { ok: false, text: why };
    const w = this.w, me = w.playerState(), gig = G.GIG_BY_ID[kind];
    let pickup, drop;
    this.rider = null; this.towCar = null;
    if (kind === 'delivery') {
      const f = FOOD.slice().sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
      pickup = { x: f.x, z: f.z, label: `Pick up the order at ${f.name}` };
      const d = this.curbSpot(f.x, f.z, 350, 900);
      drop = { ...d, label: `Deliver to ${this.address(d)}` };
    } else if (kind === 'ride') {
      const name = pick(RIDER_NAMES, this.rng);
      const p = this.curbSpot(me.x, me.z, 120, 450);
      pickup = { ...p, label: `Pick up ${name} at ${this.address(p)}` };
      const dests = RIDE_DEST.filter(l => { const d = Math.hypot(l.x - p.x, l.z - p.z); return d > 350 && d < 1100; });
      const l = pick(dests.length ? dests : RIDE_DEST, this.rng);
      drop = { x: l.x, z: l.z, label: `Drop ${name} at ${l.name.split(' (')[0]}` };
      this.rider = { name, look: { top: pick(TOPS, this.rng), skin: pick(SKIN, this.rng), hair: '#141414', shoes: '#e8e8e8' } };
    } else {
      const p = this.roadsideSpot(me.x, me.z, 220, 650);
      if (!p) return { ok: false, text: 'No tow calls right now. Try again in a minute.' };
      const model = pick(COMMON, this.rng);
      const yard = LOC_BY_ID.hook_haul;
      pickup = { ...p, label: `Hook the broken-down ${model.model} on ${w.streetAt(p.x, p.z) || 'the curb'}` };
      drop = { x: yard.x, z: yard.z, label: `Haul it to ${yard.name}` };
      this.towCar = { model, dims: dimsFor(model), x: p.x, z: p.z, h: p.h, sprite: carSprite(model, { paint: pick(PAINT, this.rng), wheels: 'steel', tint: 'light' }, {}, { body: 55, lights: 40, tires: 100, engine: 20, trans: 100 }), hooked: false };
    }
    const meters = this.meters(pickup, drop);
    const quoted = G.quote(this.s, gig, meters);
    this.job = {
      kind, gig, pickup, drop, meters, quoted, stage: 'pickup', t: 0, hold: 0,
      busted0: this.s.stats.busted || 0, body0: null, left: null, limit: null,
      harsh: 0, harshCd: 0, speeding: 0, swing: 0, lastSpeed: 0, warned: {},
    };
    this.route(pickup);
    return { ok: true, text: `${gig.co}: ${pickup.label}. Pays about ${fmtMoney(quoted)}.` };
  }

  // GPS to the next stop; the shift clears it itself (no "Arrived" until you've stopped there)
  route(t) {
    this.s.gps = { x: t.x, z: t.z, label: t.label, gig: true };
    this.w.gpsT = 0;
  }

  clear() {
    if (this.s.gps?.gig) { this.s.gps = null; this.w.gpsPath = null; }
    this.job = null;
  }

  cancel(why = 'You walked off the shift. No pay, and your clean-shift streak resets.') {
    if (!this.job) return;
    G.fail(this.s);
    if (this.towCar) this.towCar = null;
    if (this.rider && this.job.stage === 'drop') this.leaving(this.w.vehicle);
    this.rider = null;
    this.clear();
    this.w.ui.toast(why, 'bad');
  }

  finish() {
    const j = this.job, v = this.w.vehicle;
    const dmg = j.body0 != null && v ? j.body0 - v.car.cond.body : 0;
    const r = G.payOut(this.s, j.kind, j.quoted, { late: j.left != null ? -j.left : 0, dmg, harsh: j.harsh, speeding: j.speeding, swing: j.swing });
    if (j.kind === 'ride') this.leaving(v);
    if (j.kind === 'tow' && this.towCar) this.done = { car: { ...this.towCar }, t: 0 };
    this.towCar = null; this.rider = null;
    this.clear();
    audio.click?.();
    const stars = '★'.repeat(Math.round(r.stars)) + '☆'.repeat(5 - Math.round(r.stars));
    const streak = G.ensure(this.s).streak;
    this.w.ui.toast(`${j.gig.co}: +${fmtMoney(r.pay)} to your bank${r.tip ? ` · ${fmtMoney(r.tip)} tip` : ''} · ${stars}${r.notes.length ? ' · ' + r.notes.join(', ') : ''} · clean streak ${streak}`, 'good');
    return r;
  }

  // the rider gets out and walks off up the sidewalk
  leaving(v) {
    if (!this.rider || !v) return;
    const rx = Math.cos(v.h), rz = Math.sin(v.h);
    this.done = { person: { x: v.x + rx * (v.dims.W / 2 + 0.8), z: v.z + rz * (v.dims.W / 2 + 0.8), h: v.h, look: this.rider.look }, t: 0 };
  }

  // ------------------------------------------------------------ update
  update(dt) {
    if (this.done) { this.done.t += dt; if (this.done.person) { const p = this.done.person; p.x += Math.sin(p.h) * 1.4 * dt; p.z -= Math.cos(p.h) * 1.4 * dt; } if (this.done.t > 3) this.done = null; }
    const j = this.job;
    if (!j) return;
    const w = this.w, v = w.vehicle, s = this.s;
    j.t += dt;
    // things that end a shift
    if ((s.stats.busted || 0) !== j.busted0) { this.towCar = null; this.rider = null; this.clear(); return; }   // core/gigs.js already suspended you
    if (w.police.phase === 'chase') { this.cancel(`${j.gig.co} pulled you off the job: you're in a police chase. Clean-shift streak reset.`); return; }
    if (!v) { this.cancel('No car, no shift. Clean-shift streak reset.'); return; }
    if (j.left != null) {
      j.left -= dt;
      if (j.left < -G.LATE_FAIL) { this.cancel('The customer cancelled the order. Way too late. Clean-shift streak reset.'); return; }
    }
    const tgt = j.stage === 'pickup' ? j.pickup : j.drop;
    const d = Math.hypot(tgt.x - v.x, tgt.z - v.z), stopped = w.inCar && v.speed < STOP;
    if (j.stage === 'pickup') this.updatePickup(dt, d, stopped);
    else this.updateDrop(dt, d, stopped);
    if (this.towCar?.hooked) this.dragTow(dt);
  }

  updatePickup(dt, d, stopped) {
    const j = this.job, w = this.w, v = w.vehicle;
    const near = d < PICK_R && stopped;
    if (j.kind === 'ride') {
      const r = this.rider;
      if (!r.p) r.p = { x: j.pickup.x, z: j.pickup.z, h: 0, walk: 0 };
      if (!near && !r.walking) { j.hold = 0; return; }
      // the rider walks over to the passenger door
      r.walking = true;
      if (!w.inCar || v.speed > STOP) { r.walking = false; return; }
      const rx = Math.cos(v.h), rz = Math.sin(v.h);
      const door = { x: v.x + rx * (v.dims.W / 2 + 0.6), z: v.z + rz * (v.dims.W / 2 + 0.6) };
      const dx = door.x - r.p.x, dz = door.z - r.p.z, dd = Math.hypot(dx, dz), step = 3.2 * dt;
      r.p.h = Math.atan2(dx, -dz);
      if (dd > step && dd < 30) { r.p.x += dx / dd * step; r.p.z += dz / dd * step; r.p.walk += dt * 9; return; }
      r.walking = false; r.in = true;
      this.toDrop(`${r.name} got in. ${j.drop.label}. Drive smooth.`);
      return;
    }
    if (!near) { j.hold = 0; return; }
    j.hold += dt;
    const need = j.kind === 'tow' ? 2 : 1.2;
    if (j.hold < need) return;
    if (j.kind === 'delivery') {
      j.limit = Math.round(25 + j.meters / 11);
      j.left = j.limit;
      this.toDrop(`Order's in the car. ${j.drop.label} — ${fmtClock(j.left)} on the clock.`);
    } else {
      this.towCar.hooked = true;
      audio.crash?.(0.08);
      this.toDrop(`Hooked up. ${j.drop.label}. Keep it under 60.`);
    }
  }

  toDrop(text) {
    const j = this.job, v = this.w.vehicle;
    j.stage = 'drop'; j.hold = 0;
    j.body0 = v.car.cond.body;
    j.lastSpeed = v.speed;
    this.route(j.drop);
    this.w.ui.toast(text, 'good');
  }

  updateDrop(dt, d, stopped) {
    const j = this.job, v = this.w.vehicle;
    // how you drive, for the rating
    const acc = (v.speed - j.lastSpeed) / Math.max(dt, 1e-3);
    j.lastSpeed = v.speed;
    j.harshCd -= dt;
    if (this.w.inCar) {
      if (j.kind === 'ride') {
        if (Math.abs(acc) > 11 && v.speed + Math.abs(acc * dt) > 6 && j.harshCd <= 0) { j.harsh++; j.harshCd = 1.5; this.say(acc < 0 ? `${this.rider.name}: "Whoa! Easy on the brakes."` : `${this.rider.name}: "Bro, chill."`); }
        if (v.speed > G.RIDE_SPEED) { j.speeding += dt; if (!j.warned.speed) { j.warned.speed = true; this.say(`${this.rider.name}: "You're kinda flying right now..."`); } }
      }
      if (j.kind === 'tow' && v.speed > G.TOW_SPEED) { j.swing += dt; if (!j.warned.swing || j.t - j.warned.swing > 8) { j.warned.swing = j.t; this.say('The dolly is swinging. Slow down under 60.'); } }
    }
    if (d < DROP_R && stopped) { j.hold += dt; if (j.hold > (j.kind === 'ride' ? 0.8 : 1)) this.finish(); }
    else j.hold = 0;
  }

  say(text) { this.w.ui.toast(text, 'info'); }

  // The towed car trails behind your hitch on a short bar and swings when you're fast.
  dragTow(dt) {
    const v = this.w.vehicle, c = this.towCar;
    if (!v) return;
    const fx = Math.sin(v.h), fz = -Math.cos(v.h);
    const hx = v.x - fx * (v.dims.L / 2 + 0.4), hz = v.z - fz * (v.dims.L / 2 + 0.4);
    let dx = hx - c.x, dz = hz - c.z, dd = Math.hypot(dx, dz) || 1;
    const bar = c.dims.L / 2 + 1.1;
    c.x = hx - dx / dd * bar; c.z = hz - dz / dd * bar;
    const sw = v.speed > G.TOW_SPEED ? Math.sin(this.job.t * 7) * Math.min(0.35, (v.speed - G.TOW_SPEED) * 0.04) : 0;
    c.h = Math.atan2(dx, -dz) + sw;
  }

  // ------------------------------------------------------------ hud + draw
  hudLine() {
    const j = this.job;
    if (!j) return null;
    const tgt = j.stage === 'pickup' ? j.pickup : j.drop;
    const extra = j.left != null ? ` · ${fmtClock(j.left)}` : '';
    const hint = j.stage === 'pickup' && j.kind === 'tow' ? ' (stop next to it)' : j.stage === 'pickup' && j.kind === 'ride' ? ' (stop at the curb)' : '';
    return { title: `${j.gig.icon} ${j.gig.co} · ${fmtMoney(j.quoted)}`, text: tgt.label + hint + extra, late: j.left != null && j.left < 0 };
  }

  draw(ctx, cam) {
    const z = cam.zoom, j = this.job, blink = performance.now() % 700 < 350;
    const c = this.towCar;
    if (c) {
      this.w.drawShadow(ctx, c.x, c.z, c.h, c.dims);
      drawCar(ctx, c.sprite, cam.sx(c.x), cam.sy(c.z), c.h, z);
      if (!c.hooked && blink) this.hazards(ctx, cam, c);
      if (c.hooked && this.w.vehicle) {
        const v = this.w.vehicle, fx = Math.sin(v.h), fz = -Math.cos(v.h);
        const cfx = Math.sin(c.h), cfz = -Math.cos(c.h);
        ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = Math.max(2, 0.18 * z);
        ctx.beginPath();
        ctx.moveTo(cam.sx(v.x - fx * v.dims.L / 2), cam.sy(v.z - fz * v.dims.L / 2));
        ctx.lineTo(cam.sx(c.x + cfx * c.dims.L / 2), cam.sy(c.z + cfz * c.dims.L / 2));
        ctx.stroke();
      }
    }
    if (this.done?.car) {
      const d = this.done.car;
      ctx.save(); ctx.globalAlpha = clamp(1 - this.done.t / 3, 0, 1);
      drawCar(ctx, d.sprite, cam.sx(d.x), cam.sy(d.z), d.h, z);
      ctx.restore();
    }
    if (this.done?.person) {
      const p = this.done.person;
      ctx.save(); ctx.globalAlpha = clamp(1 - this.done.t / 3, 0, 1);
      drawPerson(ctx, cam.sx(p.x), cam.sy(p.z), p.h, z, p.look, this.done.t * 9);
      ctx.restore();
    }
    if (!j) return;
    const r = this.rider;
    if (r && !r.in) {
      const p = r.p || { x: j.pickup.x, z: j.pickup.z, h: 0, walk: 0 };
      drawPerson(ctx, cam.sx(p.x), cam.sy(p.z), p.h, z, r.look, p.walk);
      if (!r.walking && blink) {   // waving their phone
        ctx.fillStyle = '#8fd0ff'; ctx.fillRect(cam.sx(p.x) + 0.3 * z, cam.sy(p.z) - 0.8 * z, 0.18 * z, 0.3 * z);
      }
    }
    // the pickup/drop-off ring (the GPS route has its own ring, this one shows the stopping spot)
    const tgt = j.stage === 'pickup' ? j.pickup : j.drop;
    const pulse = 1 + Math.sin(performance.now() / 260) * 0.12;
    ctx.save();
    ctx.strokeStyle = j.stage === 'pickup' ? 'rgba(44,255,122,.85)' : 'rgba(255,200,0,.9)';
    ctx.lineWidth = Math.max(2, 0.25 * z);
    ctx.setLineDash([0.9 * z, 0.6 * z]);
    ctx.beginPath(); ctx.arc(cam.sx(tgt.x), cam.sy(tgt.z), (j.stage === 'pickup' ? PICK_R : DROP_R) * 0.55 * z * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  hazards(ctx, cam, c) {
    const fx = Math.sin(c.h), fz = -Math.cos(c.h), rx = Math.cos(c.h), rz = Math.sin(c.h);
    ctx.fillStyle = '#ffae1a';
    for (const a of [1, -1]) for (const b of [1, -1]) {
      const x = c.x + fx * a * (c.dims.L / 2 - 0.2) + rx * b * (c.dims.W / 2 - 0.25), zz = c.z + fz * a * (c.dims.L / 2 - 0.2) + rz * b * (c.dims.W / 2 - 0.25);
      ctx.beginPath(); ctx.arc(cam.sx(x), cam.sy(zz), Math.max(2, 0.28 * cam.zoom), 0, Math.PI * 2); ctx.fill();
    }
  }
}
