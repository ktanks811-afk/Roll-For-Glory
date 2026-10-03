// Carjackings in the open world. Rarely, while you sit still in your car in
// the city, a man with a pistol walks up to the driver's window. You can pull
// off before he gets there. If he reaches you, you choose what to do (rules
// and odds are in data/carjack.js). Give the car up and it turns up abandoned
// somewhere in the city a couple of minutes later: Sgt. Brenner texts you and
// your GPS is set.

import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { addRep, fmtMoney, isNight } from '../core/state.js';
import { sendMessage } from '../core/story.js';
import { carName, CAR_BY_ID } from '../data/cars.js';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { CARJACK, carjackChance, carjackChoices, resolveCarjack, strippedCar } from '../data/carjack.js';
import { drawPerson } from '../gfx2d/person.js';
import { drawCar } from '../gfx2d/carSprite.js';
import { esc } from '../ui/dom.js';

const LOOK = { top: '#141414', shoes: '#141414', skin: '#c68e65', hair: '#0c0c0c' };   // dark hoodie, ski mask

export class Carjacks {
  constructor(world) {
    this.w = world;
    this.jack = null;      // the man walking up to your window
    this.away = null;      // your car driving off with him in it
    this.runner = null;    // him running off after you scared him away
    this.rng = Math.random;
    this.checkT = 0;
  }

  get s() { return this.w.s; }
  get log() { return (this.s.carjack ??= { lastDay: -99, n: 0 }); }

  context() {
    const w = this.w, v = w.vehicle;
    return {
      inCar: w.inCar && !!v, stopped: !!v && v.speed < 1, inCity: w.inCity, policeActive: w.police.active,
      heat: this.s.heat, inGarage: !!w.inGarage, busy: !!(this.jack || this.away || w.combat.rob || w.races?.active),
      playTime: this.s.playTime, day: this.s.time.day, lastDay: this.log.lastDay, night: isNight(this.s.time),
    };
  }

  update(dt) {
    const w = this.w;
    this.checkT -= dt;
    if (this.checkT <= 0) { this.checkT = 1; this.findStolen(); }
    if (this.away) {
      const a = this.away;
      a.t += dt; a.sp = Math.min(26, a.sp + dt * 9);
      a.x += Math.sin(a.h) * a.sp * dt; a.z -= Math.cos(a.h) * a.sp * dt;
      if (a.t > 4) this.away = null;
    }
    if (this.runner) {
      const r = this.runner;
      r.t += dt; r.x += Math.sin(r.h) * 5.5 * dt; r.z -= Math.cos(r.h) * 5.5 * dt;
      if (r.t > 3) this.runner = null;
    }
    if (this.jack) { this.approach(dt); return; }
    if (this.rng() < carjackChance(this.context(), dt)) this.start();
  }

  // the driver's window, just off the left side of the car
  window() {
    const v = this.w.vehicle;
    const rx = Math.cos(v.h), rz = Math.sin(v.h);
    return { x: v.x - rx * (v.dims.W / 2 + 0.7), z: v.z - rz * (v.dims.W / 2 + 0.7) };
  }

  start() {
    const v = this.w.vehicle;
    if (!v) return;
    const rx = Math.cos(v.h), rz = Math.sin(v.h), fx = Math.sin(v.h), fz = -Math.cos(v.h);
    // he comes up from behind on the driver's side, out of the mirror's blind spot
    const x = v.x - rx * (v.dims.W / 2 + 4) - fx * 6, z = v.z - rz * (v.dims.W / 2 + 4) - fz * 6;
    this.jack = { x, z, h: 0, t: 0, walk: 0 };
    this.log.lastDay = this.s.time.day;
    this.w.ui.toast('Ski mask in the mirror, walking up. Pull off!', 'bad');
    audio.radio();
  }

  approach(dt) {
    const w = this.w, j = this.jack, v = w.vehicle;
    // you drove off, got out or the cops showed up: he melts back into the dark
    if (!v || !w.inCar || w.police.active) { this.jack = null; return; }
    if (v.speed > 4) {
      this.jack = null;
      this.runner = { x: j.x, z: j.z, h: j.h + Math.PI, t: 0 };
      w.ui.toast('You pulled off before he reached the window.', 'good');
      return;
    }
    const win = this.window();
    const dx = win.x - j.x, dz = win.z - j.z, d = Math.hypot(dx, dz);
    j.h = Math.atan2(dx, -dz);
    j.t += dt;
    const step = Math.max(2.4, 8 / CARJACK.approachSecs) * dt;
    if (d > step) { j.x += dx / d * step; j.z += dz / d * step; j.walk += dt * 9; return; }
    j.x = win.x; j.z = win.z; j.h = Math.atan2(v.x - j.x, -(v.z - j.z));
    if (!j.confronting) { j.confronting = true; this.confront(); }
  }

  // a loaded gun (or ammo for it) on you
  armed() {
    const gn = this.w.combat.gun;
    if (!gn || gn.def.melee) return false;
    return gn.g.loaded > 0 || (this.w.combat.arms.ammo[gn.def.cal] || 0) > 0;
  }

  async confront() {
    const w = this.w, car = w.vehicle.car, m = CAR_BY_ID[car.modelId];
    const armed = this.armed();
    audio.click();   // the tap of a barrel on glass
    document.querySelectorAll('#toasts .toast').forEach(t => t.remove());
    const html = `<p><b>"Get out the car. Leave it running."</b></p>
      <p>A man in a ski mask has a pistol on you through the window. He wants your ${esc(m ? carName(m, car.year) : 'car')}.</p>
      <p class="small muted">Give it up and the cops will find the car later. Fight for it and you could get shot.${armed ? ` You have your ${esc(w.combat.gun.def.name)} on you.` : ''}</p>`;
    const pick = await w.ui.modal('Carjacking', html, carjackChoices(armed));
    this.resolve(pick);
  }

  resolve(choice, o = resolveCarjack(choice, this.rng)) {
    const w = this.w, s = this.s, j = this.jack;
    this.jack = null;
    if (!j || !w.vehicle) return o;
    const car = w.vehicle.car;
    this.log.n = (this.log.n || 0) + 1;
    s.stats.carjacked = (s.stats.carjacked || 0) + 1;
    // your rounds: the cops hear them, self-defense or not
    if (o.shots) {
      const gn = w.combat.gun;
      if (gn) gn.g.loaded = Math.max(0, gn.g.loaded - o.shots);
      audio.gunshot(1);
      for (let i = 0; i < o.shots + 1; i++) w.police.gunshot(w, 'shot');
    }
    if (o.body) { car.cond.body = Math.max(5, car.cond.body - o.body); w.refreshCarSprite(); }
    let took = 0;
    if (o.wallet && s.cash > 0) { took = Math.round(s.cash * o.wallet); s.cash -= took; }
    if (o.rep) addRep(s, o.rep, 'Stood your ground');
    if (!o.keep) this.takeCar();
    else {
      this.runner = { x: j.x, z: j.z, h: j.h + Math.PI, t: 0 };
      if (choice === 'flee') { const v = w.vehicle; v.vx = Math.sin(v.h) * 9; v.vz = -Math.cos(v.h) * 9; v.sim.v = 9; }
    }
    w.ui.modal(o.keep ? 'You kept your car' : 'Carjacked', `<p>${esc(o.text)}</p>${took ? `<p>He took <b>${fmtMoney(took)}</b> cash.</p>` : ''}`);
    if (o.hurt) w.combat.hurt(o.hurt, o.keep ? 'You\'ve been shot.' : 'You got hurt.');
    return o;
  }

  // He gets in and drives off. The car is hidden until the cops find it.
  takeCar() {
    const w = this.w, s = this.s, v = w.vehicle, car = v.car;
    if (w.inCar) {
      w.inCar = false;
      input.setContext('foot');
      if (w.engine) { w.engine.stop(); w.engine = null; }
      const rx = Math.cos(v.h), rz = Math.sin(v.h);
      w.foot.x = v.x - rx * (v.dims.W / 2 + 2.2); w.foot.z = v.z - rz * (v.dims.W / 2 + 2.2); w.foot.h = v.h + Math.PI;
    }
    this.away = { x: v.x, z: v.z, h: v.h, sp: 0, t: 0, sprite: w.carSpriteImg, dims: v.dims };
    const spot = this.dumpSpot(v.x, v.z);
    const [a, b] = CARJACK.findSecs;
    car.stolen = { ...spot, foundAt: s.playTime + a + this.rng() * (b - a) };
    w.vehicle = null;
    s.carPos = null;
    audio.crash(0.1);
  }

  // Somewhere on a city street 250–600 m away, parked at the curb.
  dumpSpot(px, pz) {
    const roads = this.w.map.roads;
    const ang = this.rng() * Math.PI * 2, d = 250 + this.rng() * 350;
    const x = Math.max(-850, Math.min(850, px + Math.cos(ang) * d)), z = Math.max(-850, Math.min(850, pz + Math.sin(ang) * d));
    const r = roads.nearestOnRoad(x, z);
    const off = r.edge.width / 2 + 3;
    return { x: r.x - r.edge.dz * off, z: r.z + r.edge.dx * off, h: Math.atan2(r.edge.dx, -r.edge.dz) };
  }

  // Cars the cops have found: back on the street (or home, if you've moved on to another car).
  findStolen() {
    const s = this.s, w = this.w;
    for (const car of s.cars) {
      if (!car.stolen || s.playTime < car.stolen.foundAt) continue;
      const spot = car.stolen;
      delete car.stolen;
      strippedCar(car, this.rng);
      const m = CAR_BY_ID[car.modelId], name = m ? carName(m) : 'car';
      if (s.activeCar === car.uid && !w.vehicle) {
        s.carPos = { x: spot.x, z: spot.z, h: spot.h };
        w.placeCar(car, spot.x, spot.z, spot.h);
        w.setGps(spot.x, spot.z, `Your stolen ${m?.model || 'car'}`);
        s.gps.stolen = true;
        const where = [w.streetAt(spot.x, spot.z), w.districtAt(spot.x, spot.z)].filter(Boolean).join(', ');
        sendMessage(s, 'brenner', `Patrol found your ${name} abandoned${where ? ` on ${where}` : ''}. Beat up and nearly out of gas, but it runs. Your GPS is set. Next time just give it up — a car isn't worth dying for.`);
      } else {
        sendMessage(s, 'brenner', `Patrol found your ${name} abandoned. We had it towed to your garage.`);
      }
    }
  }

  draw(ctx, cam) {
    const z = cam.zoom;
    if (this.away) {
      const a = this.away;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, (4 - a.t) / 1.2));
      this.w.drawShadow(ctx, a.x, a.z, a.h, a.dims);
      drawCar(ctx, a.sprite, cam.sx(a.x), cam.sy(a.z), a.h, z);
      ctx.restore();
    }
    for (const p of [this.jack, this.runner]) {
      if (!p) continue;
      const sx = cam.sx(p.x), sy = cam.sy(p.z);
      ctx.save();
      if (p === this.runner) ctx.globalAlpha = Math.max(0, Math.min(1, 3 - p.t));
      drawPerson(ctx, sx, sy, p.h, z, LOOK, p === this.runner ? p.t * 14 : p.walk);
      if (p === this.jack) {
        // the pistol, held out in front
        ctx.translate(sx, sy); ctx.rotate(p.h);
        ctx.fillStyle = '#0b0c0e'; ctx.fillRect(0.2 * z, -0.62 * z, 0.09 * z, 0.4 * z);
      }
      ctx.restore();
    }
  }
}
