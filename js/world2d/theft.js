// Stealing cars, GTA style. On foot, walk up to a car parked at the curb (or
// in a lot) and press STEAL (T): you jimmy the door and drive off in it. Walk
// up to a civilian car that's stopped or crawling and you pull the driver out
// instead. Your own car stays parked where you left it; get back in it (F)
// and the stolen one gets dumped.
//
// Somebody usually sees it. A cop who watches you do it chases right away; a
// witness or a car alarm means a 911 call a few seconds later, with units
// coming to the spot. Nobody saw? The owner reports it later anyway, and from
// then on any patrol that gets a look at the plate lights you up. Sal at
// Rusty's Used Autos buys hot cars with no questions asked, or drive one into
// your own garage and pay to swap the plates and keep it.

import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { newCar, uid, earn, spend, carValue, fmtMoney, garageCapacity } from '../core/state.js';
import { CAR_BY_ID, carName } from '../data/cars.js';
import { PROPERTIES } from '../data/world.js';
import { randomPlate } from '../data/parts.js';
import { COMMON } from './traffic.js';
import { grabLoot, lootNames } from '../core/loot.js';
import { lineOfSight } from './map.js';
import { drawPerson } from '../gfx2d/person.js';
import { drawCar } from '../gfx2d/carSprite.js';

const pick = a => a[Math.floor(Math.random() * a.length)];
const DRIVER_LOOKS = ['#c41b1b', '#1b4fc4', '#e8e8e8', '#222', '#e8c21a', '#4a5232', '#6b2bd1'];
// how close you have to be, how slow a car has to be going to pull the driver
// out (m/s, about 13 mph), and how long each takes
export const STEAL = { reach: 3.6, maxSpeed: 6, breakIn: 1.4, yank: 0.8, plateRange: 55, plateSecs: 2.5 };
export const SAL_CUT = 0.3;          // Sal pays 30% of what the car is worth
export const PLATE_SWAP = 600;       // new plates and a VIN swap to keep one
const DUMP_KEEP = 6;

export class Thefts {
  constructor(world) {
    this.w = world;
    this.act = null;       // breaking in / pulling the driver out right now
    this.own = null;       // your own car, left parked while you drive a stolen one: { vehicle, sprite }
    this.dumped = [];      // stolen cars you left behind
    this.drivers = [];     // drivers you pulled out, running off
    this.target = null;    // what STEAL would take right now
    this.plate = 0;        // 0..1: a patrol reading the plate of the reported car you're in
    this.rng = Math.random;
  }

  get s() { return this.w.s; }
  // the stolen car you're driving (or left parked nearby)
  get hot() { const v = this.w.vehicle; return v?.car?.hot ? v : null; }

  update(dt) {
    const w = this.w, s = this.s;
    this.target = this.findTarget();
    if (this.act) this.working(dt);
    else if (input.pressed('steal')) {
      if (this.target) this.start(this.target);
      else if (!w.inCar) w.ui.toast('Nothing to steal here. Walk up to a parked car, or one stopped at a light.', 'info');
    }
    for (const d of this.drivers) { d.t += dt; d.x += Math.sin(d.h) * 5.5 * dt; d.z -= Math.cos(d.h) * 5.5 * dt; }
    this.drivers = this.drivers.filter(d => d.t < 4);
    const p = w.playerState();
    this.dumped = this.dumped.filter(c => Math.hypot(c.x - p.x, c.z - p.z) < 500);
    // parked cars you took come back once you're well away
    for (const b of (this.taken ||= [])) if (Math.hypot(b.x - p.x, b.z - p.z) > 260) { b.gone = false; b.col && (b.col.off = false); b.back = true; }
    this.taken = this.taken.filter(b => !b.back);

    const hot = this.hot;
    if (!hot) { this.plate = 0; return; }
    const h = hot.car.hot;
    // the call comes in: a witness, or the owner finding an empty curb
    if (!h.reported && s.playTime >= h.callAt) this.called(hot);
    // a patrol close behind gets a look at the plate
    const pol = w.police;
    if (w.inCar && h.reported && pol.phase === 'none') {
      const near = pol.patrols.some(c => Math.hypot(c.x - hot.x, c.z - hot.z) < STEAL.plateRange && lineOfSight(w.map, c.x, c.z, hot.x, hot.z));
      this.plate = near ? this.plate + dt / STEAL.plateSecs : Math.max(0, this.plate - dt * 0.3);
      if (this.plate >= 1) {
        this.plate = 0;
        w.hud.radio(`Plate comes back stolen: ${this.title(hot.car)}. Lighting them up.`);
        pol.reportTheft(w, this.charge(h), hot.x, hot.z, true);
      }
    } else this.plate = Math.max(0, this.plate - dt * 0.3);
  }

  // ------------------------------------------------------------ finding one
  findTarget() {
    const w = this.w, f = w.foot;
    if (w.inCar || this.act || w.races?.active || w.combat.rob || w.combat.mug || w.police.phase === 'stop') return null;
    let best = null, bd = STEAL.reach;
    for (const c of w.traffic.cars) {
      if (c.police || c.yanked) continue;
      const d = Math.hypot(c.x - f.x, c.z - f.z);
      if (d < bd && Math.abs(c.v) < STEAL.maxSpeed) { bd = d; best = { kind: 'driver', car: c, model: c.model, color: c.color }; }
    }
    if (best) return best;
    // parked cars are part of the scenery: a box you bump into
    for (const col of w.map.grid.query(f.x - 4, f.z - 4, f.x + 4, f.z + 4)) {
      const b = col.b;
      if (!b || b.kind !== 'parked' || col.off || Math.max(b.w, b.d) > 6.5) continue;
      const px = Math.max(b.x, Math.min(f.x, b.x + b.w)), pz = Math.max(b.z, Math.min(f.z, b.z + b.d));
      const d = Math.hypot(f.x - px, f.z - pz);
      if (d < 1.6 && d < bd) { bd = d; best = { kind: 'parked', b, col }; }
    }
    return best;
  }

  // what the HUD prompt says
  promptText() {
    const t = this.target;
    if (!t) return '';
    return t.kind === 'driver' ? `Pull the driver out of the ${t.model.model}` : 'Steal this car';
  }

  // ------------------------------------------------------------ taking it
  start(t) {
    const w = this.w;
    this.act = { t: 0, x: w.foot.x, z: w.foot.z, ...t, dur: t.kind === 'parked' ? STEAL.breakIn : STEAL.yank };
    if (t.kind === 'driver') {
      // the car stops dead and you yank the door open
      t.car.stun = 3; t.car.v = 0; t.car.yanked = true;
      audio.click();
      w.ui.toast('Yanking the door open…', 'bad');
    } else {
      audio.crash(0.12);   // the window
      w.ui.toast('Breaking in…', 'bad');
    }
  }

  working(dt) {
    const w = this.w, a = this.act;
    if (w.inCar || Math.hypot(w.foot.x - a.x, w.foot.z - a.z) > 1.5) { this.act = null; if (a.car) a.car.yanked = false; w.ui.toast('You backed off.', 'info'); return; }
    if (a.kind === 'driver' && !w.traffic.cars.includes(a.car)) { this.act = null; return; }
    a.t += dt;
    if (a.t >= a.dur) { this.act = null; this.finish(a); }
  }

  finish(a) {
    const w = this.w, s = this.s;
    const armed = !!w.combat.armed;
    let x, z, h, model, color;
    if (a.kind === 'driver') {
      const c = a.car;
      w.traffic.cars = w.traffic.cars.filter(o => o !== c);
      x = c.x; z = c.z; h = c.h; model = c.model; color = c.color;
      // the driver comes out the door and runs for it
      const rx = Math.cos(h), rz = Math.sin(h);
      const dx = x - rx * (c.dims.W / 2 + 0.8), dz = z - rz * (c.dims.W / 2 + 0.8);
      this.drivers.push({ x: dx, z: dz, h: Math.atan2(dx - w.foot.x, -(dz - w.foot.z)), t: 0, color: pick(DRIVER_LOOKS) });
      if (!armed && this.rng() < 0.2) w.combat.hurt(8, 'The driver swung on you before he ran.');
    } else {
      const b = a.b;
      b.gone = true; a.col.off = true; b.col = a.col;
      this.taken.push(b);
      x = b.x + b.w / 2; z = b.z + b.d / 2;
      h = b.w > b.d ? (this.rng() < 0.5 ? 1 : -1) * Math.PI / 2 : this.rng() < 0.5 ? 0 : Math.PI;
      model = pick(COMMON); color = b.color;
    }
    const car = this.makeCar(model, color, a.kind === 'driver' ? 'carjack' : 'parked', armed);
    this.enter(car, x, z, h);
    s.stats.carsStolen = (s.stats.carsStolen || 0) + 1;
    this.witnesses(car, x, z);
    // whatever the owner left inside is yours too (fence it at Cash Cow Pawn)
    const got = grabLoot(s, 'car', `a stolen ${model.model}`, this.rng);
    w.ui.toast((a.kind === 'driver' ? `You took the ${model.model}. Go!` : `You hotwired a ${model.model}. Drive it like it's yours.`) + (got.length ? ` Inside: ${lootNames(got)}.` : ''), 'good');
  }

  makeCar(model, color, kind, armed) {
    const r = this.rng;
    const [y0, y1] = model.years || [2010, 2020];
    const car = newCar(model.id, {
      uid: uid('hot'),
      year: Math.round(y0 + (Math.min(y1, 2025) - y0) * r()),
      miles: Math.round(15000 + r() * 140000),
      fuel: 0.2 + r() * 0.65,
      cond: { body: 60 + r() * 40, lights: 80 + r() * 20, tires: 45 + r() * 55, engine: 70 + r() * 30, trans: 70 + r() * 30 },
      paid: 0,
      hot: { kind, armed, reported: false, callAt: Infinity, conceal: 0 },
    });
    car.visual.paint = color || car.visual.paint;
    return car;
  }

  // Swap into the stolen car. Your own car stays parked where it is.
  enter(car, x, z, h) {
    const w = this.w;
    if (w.vehicle) {
      if (w.vehicle.car.hot) this.dump(w.vehicle, w.carSpriteImg);
      else this.own = { vehicle: w.vehicle, sprite: w.carSpriteImg };
    }
    w.placeCar(car, x, z, h);
    w.inCar = true;
    input.setContext('car');
    w.restartEngineSound();
  }

  dump(v, sprite) {
    this.dumped.push({ x: v.x, z: v.z, h: v.h, sprite, dims: v.dims });
    if (this.dumped.length > DUMP_KEEP) this.dumped.shift();
  }

  // Who saw it. Decides when (and whether) the 911 call comes in.
  witnesses(car, x, z) {
    const w = this.w, h = car.hot, r = this.rng;
    h.conceal = w.police.disguise;
    const cop = w.police.detect(x, z, 90);
    const peds = w.traffic.peds.filter(q => !q.down && Math.hypot(q.x - x, q.z - z) < 30).length;
    const alarm = h.kind === 'parked' && r() < 0.35;
    if (alarm) { audio.horn(); setTimeout(() => audio.horn(), 450); setTimeout(() => audio.horn(), 900); w.ui.toast('🚨 Car alarm! Somebody\'s calling it in.', 'bad'); }
    if (cop) { h.callAt = 0; this.called(w.vehicle, true); return; }
    const seen = h.kind === 'carjack' || alarm || (peds > 0 && r() < 0.6);
    h.quiet = !seen;
    h.callAt = this.s.playTime + (seen ? 5 + r() * 6 : 90 + r() * 120);
  }

  title(car) { const m = CAR_BY_ID[car.modelId]; return m ? carName(m, car.year) : 'vehicle'; }

  charge(h) {
    return h.kind === 'carjack'
      ? { kind: 'carjack', text: h.armed ? 'Armed carjacking.' : 'Carjacking (robbery of a motor vehicle).', fine: h.armed ? 6000 : 3500, conceal: h.conceal }
      : { kind: 'gta', text: 'Grand theft auto (stole a parked car).', fine: 2000, conceal: h.conceal };
  }

  // The theft is on the radio. A quiet theft (nobody saw) only flags the plate.
  called(v, copSaw = false) {
    const w = this.w, h = v.car.hot;
    h.reported = true;
    if (h.quiet) { w.hud.radio(`Dispatch: stolen vehicle report, ${this.title(v.car)}. Plate is in the system.`); return; }
    const street = w.streetAt(v.x, v.z);
    if (!copSaw) w.hud.radio(`Dispatch: 911 caller reports ${h.kind === 'carjack' ? (h.armed ? 'an armed carjacking' : 'a carjacking') : 'a car being stolen'}${street ? ' on ' + street : ''}. Units responding.`);
    else w.hud.radio(h.kind === 'carjack' ? 'Officer witnessed a carjacking! In pursuit.' : 'Officer just watched someone steal a car! In pursuit.');
    w.police.reportTheft(w, this.charge(h), v.x, v.z, copSaw);
  }

  // ------------------------------------------------------------ getting rid of it
  // F next to your own car while driving a stolen one: dump it, take yours.
  tryOwn() {
    const w = this.w, o = this.own;
    if (!o || w.inCar || Math.hypot(o.vehicle.x - w.foot.x, o.vehicle.z - w.foot.z) > 4.5) return false;
    if (o.vehicle.car.impound) { w.ui.toast('Impounded. Sign it out inside the Central Precinct', 'bad'); return true; }
    if (this.hot) this.dump(w.vehicle, w.carSpriteImg);
    this.restoreOwn();
    w.inCar = true;
    input.setContext('car');
    w.restartEngineSound();
    return true;
  }

  // Your own car turned up while you're in a stolen one (the cops found it
  // after a carjacking): it waits at the curb.
  parkOwn(car, x, z, h) {
    const w = this.w, v = w.vehicle, spr = w.carSpriteImg;
    w.placeCar(car, x, z, h);
    this.own = { vehicle: w.vehicle, sprite: w.carSpriteImg };
    w.vehicle = v; w.carSpriteImg = spr;
  }

  restoreOwn() {
    const w = this.w, o = this.own;
    this.own = null;
    w.vehicle = o ? o.vehicle : null;
    if (w.vehicle) w.refreshCarSprite();
  }

  // Out of the stolen car for good (sold, kept or taken off you): you're on
  // foot beside it and your own car is back.
  leave() {
    const w = this.w, v = w.vehicle;
    if (w.inCar) {
      w.inCar = false;
      input.setContext('foot');
      if (w.engine) { w.engine.stop(); w.engine = null; }
      const rx = Math.cos(v.h), rz = Math.sin(v.h);
      w.foot.x = v.x - rx * (v.dims.W / 2 + 0.8); w.foot.z = v.z - rz * (v.dims.W / 2 + 0.8); w.foot.h = v.h;
    }
    this.restoreOwn();
  }

  // Busted in (or near) a stolen car: it goes back to its owner. Your own car
  // isn't towed; it's still wherever you parked it.
  busted() {
    if (!this.hot) return false;
    this.leave();
    return true;
  }

  // Is the stolen car close enough to `loc` to deal with it there?
  near(loc, r = 30) { const v = this.hot; return !!v && Math.hypot(v.x - loc.x, v.z - loc.z) < r; }
  salOffer() { const v = this.hot; return v ? Math.max(300, Math.round(carValue(v.car) * SAL_CUT / 10) * 10) : 0; }

  sell() {
    const v = this.hot, s = this.s;
    if (!v) return 0;
    const pay = this.salOffer();
    this.leave();
    earn(s, pay, `Sal: ${carName(CAR_BY_ID[v.car.modelId], v.car.year)}, no questions asked`, { dirty: true });
    s.stats.carsFenced = (s.stats.carsFenced || 0) + 1;
    return pay;
  }

  // Keep it: new plates, a VIN swap and a rebuilt title. Goes in a garage bay
  // (or becomes your ride, if you didn't have one).
  canKeep() { const s = this.s; return s.cars.length < Math.max(1, garageCapacity(s, PROPERTIES)); }
  keep() {
    const v = this.hot, s = this.s, w = this.w;
    if (!v || !this.canKeep()) return null;
    if (!spend(s, PLATE_SWAP, 'New plates + VIN swap')) return null;
    const car = v.car;
    delete car.hot;
    car.uid = uid('car'); car.title = 'Rebuilt'; car.visual.plate = randomPlate();
    car.stats = { races: 0, wins: 0, losses: 0, bestEt: null, bestTrap: 0 };
    s.cars.push(car);
    if (!this.own && !s.cars.some(c => c.uid === s.activeCar)) {
      s.activeCar = car.uid;   // it's your only car now: it stays out
      w.refreshCarSprite();
      return car;
    }
    if (!this.own) {
      // your own car was in the impound or a shop; it comes out of the garage like any switch
      w.vehicle = null; w.inCar = false; input.setContext('foot');
      w.refreshCar();
      return car;
    }
    this.leave();
    return car;
  }

  // ------------------------------------------------------------ drawing
  draw(ctx, cam) {
    const z = cam.zoom, v = cam.view(10);
    const vis = (x, zz) => x > v.x0 && x < v.x1 && zz > v.z0 && zz < v.z1;
    for (const c of this.dumped) {
      if (!vis(c.x, c.z)) continue;
      this.w.drawShadow(ctx, c.x, c.z, c.h, c.dims);
      drawCar(ctx, c.sprite, cam.sx(c.x), cam.sy(c.z), c.h, z);
    }
    const o = this.own?.vehicle;
    if (o && vis(o.x, o.z)) {
      this.w.drawShadow(ctx, o.x, o.z, o.h, o.dims);
      drawCar(ctx, this.own.sprite, cam.sx(o.x), cam.sy(o.z), o.h, z);
    }
    for (const d of this.drivers) {
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, 4 - d.t));
      drawPerson(ctx, cam.sx(d.x), cam.sy(d.z), d.h, z, { top: d.color, skin: '#c68e65', hair: '#222' }, d.t * 14);
      ctx.restore();
    }
    // the progress ring while you break in
    const a = this.act;
    if (a) {
      const f = this.w.foot, sx = cam.sx(f.x), sy = cam.sy(f.z) - 2.2 * z;
      ctx.save();
      ctx.lineWidth = Math.max(3, 0.35 * z);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(sx, sy, 0.9 * z, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ff2a3a'; ctx.beginPath(); ctx.arc(sx, sy, 0.9 * z, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, a.t / a.dur)); ctx.stroke();
      ctx.restore();
    }
  }

  // Stolen cars and your parked car are things you can drive into.
  obstacles() {
    const o = this.own?.vehicle;
    const out = this.dumped.map(c => ({ x: c.x, z: c.z, h: c.h, dims: c.dims, v: 0, speed: 0, own: true, hit() {} }));
    if (o) out.push({ x: o.x, z: o.z, h: o.h, dims: o.dims, v: 0, speed: 0, own: true, hit() {} });
    return out;
  }
}
