// The trailer behind your truck, out in the world. It swings on the hitch
// like the real thing (the axle follows the ball), carries your car on the
// open hauler's deck, and parks with the truck while you drive the car you
// unloaded. Stopped in the truck with a car on: USE unloads it. Stopped in
// that car behind the trailer: USE loads it back up. Rules: core/tow.js.

import { input } from '../core/input.js';
import { pad } from '../core/gamepad.js';
import { audio } from '../core/audio.js';
import { game, levels, addRep } from '../core/state.js';
import { saveGame } from '../core/save.js';
import { CAR_BY_ID } from '../data/cars.js';
import { LOCATIONS } from '../data/world.js';
import { carSprite, drawCar, dimsFor } from '../gfx2d/carSprite.js';
import { esc } from '../ui/dom.js';
import { ensureTow, hitched, dropRig, pickUpRig, loadBlock, meetEntrance } from '../core/tow.js';

const IMG = {};
function img(src) {
  if (!IMG[src]) { const i = new Image(); i.src = src; IMG[src] = i; }
  return IMG[src];
}
const fwd = h => [Math.sin(h), -Math.cos(h)];
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const MAX_BEND = 1.35;   // how far the trailer can swing before it jackknifes (rad)

export class Trailers {
  constructor(world) {
    this.w = world;
    this.th = null;        // trailer heading (same convention as a car's h)
    this.truckRef = null;  // the vehicle it was last hitched to (reset when that changes)
    this.act = null;       // what USE does right now: { label, run }
    this.sprites = new Map();
  }

  get s() { return game.s; }

  // The truck's vehicle, if it's out in the world: the one you drive, or the
  // one left parked while you're in a stolen car.
  truckVehicle() {
    const t = ensureTow(this.s), w = this.w;
    if (!t.trailer || t.rig) return null;
    if (w.vehicle && !w.vehicle.car.hot && w.vehicle.car.uid === t.truck) return w.vehicle;
    const own = w.thefts?.own?.vehicle;
    return own && own.car.uid === t.truck ? own : null;
  }

  hitchPoint(v) {
    const [fx, fz] = fwd(v.h), back = v.dims.L / 2 + 0.25;
    return { x: v.x - fx * back, z: v.z - fz * back };
  }

  // How much the trailer slows the truck you're driving (0 = none).
  slowFor(v) {
    const h = hitched(this.s);
    if (!h || this.s.tow.rig || v !== this.truckVehicle()) return 0;
    return this.s.tow.car ? h.def.loadedSlow : h.def.slow;
  }

  update(dt) {
    const s = this.s, w = this.w;
    ensureTow(s);
    const h = hitched(s);
    const tv = this.truckVehicle();
    // swing the trailer behind the truck
    if (h && tv) {
      const H = this.hitchPoint(tv), d = h.def.len * h.def.axle;
      if (this.truckRef !== tv || this.th == null || !this.axle || Math.hypot(this.axle.x - H.x, this.axle.z - H.z) > d * 2) {
        this.th = tv.h;   // fresh hitch (or the truck got moved): straight behind it
      } else {
        this.th = Math.atan2(H.x - this.axle.x, -(H.z - this.axle.z));
      }
      const bend = wrap(this.th - tv.h);
      if (Math.abs(bend) > MAX_BEND) this.th = tv.h + Math.sign(bend) * MAX_BEND;
      const [fx, fz] = fwd(this.th);
      this.axle = { x: H.x - fx * d, z: H.z - fz * d };
      this.truckRef = tv;
    } else if (!h) { this.truckRef = null; this.axle = null; }
    this.act = this.findAction();
  }

  // ---------------------------------------------------------------- USE
  findAction() {
    const s = this.s, w = this.w, t = s.tow, h = hitched(s);
    const v = w.vehicle;
    if (!h || !w.inCar || !v || v.car.hot || w.races?.active || v.speed > 1.2) return null;
    if (w.police.active && w.police.phase !== 'notice') return null;
    // in the truck with a car on the trailer
    if (!t.rig && t.car && v.car.uid === t.truck) {
      const m = CAR_BY_ID[s.cars.find(c => c.uid === t.car)?.modelId];
      return { label: `Unload the ${m?.model || 'car'}`, run: () => this.unload() };
    }
    // in a car, parked behind the rig
    if (t.rig && v.car.uid === s.activeCar) {
      const back = this.rigBack();
      if (Math.hypot(v.x - back.x, v.z - back.z) > 7.5) return null;
      const why = loadBlock(s, v.car.uid);
      return why ? { label: why, blocked: true, run: () => w.ui.toast(why, 'bad') } : { label: `Load the ${v.model.model} on the trailer`, run: () => this.load() };
    }
    return null;
  }

  // the spot just behind the parked trailer's ramps
  rigBack() {
    const r = this.s.tow.rig, h = hitched(this.s);
    const truckL = dimsFor(CAR_BY_ID[this.s.cars.find(c => c.uid === this.s.tow.truck)?.modelId] || 'truck').L;
    const [fx, fz] = fwd(r.h), [tx, tz] = fwd(r.th);
    const Hx = r.x - fx * (truckL / 2 + 0.25), Hz = r.z - fz * (truckL / 2 + 0.25);
    const out = h.def.len + 2.5;
    return { x: Hx - tx * out, z: Hz - tz * out };
  }

  // Returns true if USE was used up here.
  tryUse() {
    if (!this.act || this.act.blocked) return false;
    this.act.run();
    return true;
  }

  unload() {
    const s = this.s, w = this.w, v = w.vehicle;
    const th = this.th ?? v.h;
    const r = dropRig(s, { x: v.x, z: v.z, h: v.h }, th);
    if (!r.ok) { w.ui.toast(r.text, 'bad'); return; }
    // the car rolls off the back and swings around, nose out
    const H = this.hitchPoint(v), [tx, tz] = fwd(th);
    const L = dimsFor(r.model).L, out = r.def.len + L / 2 + 1.2;
    w.placeCar(r.car, H.x - tx * out, H.z - tz * out, th + Math.PI);
    w.inCar = true;
    input.setContext('car');
    w.restartEngineSound();
    audio.click?.();
    let msg = `Unloaded the ${r.model.model}. Your truck and trailer stay parked here. Pull back up behind the trailer to load it.`;
    const meet = LOCATIONS.find(l => (l.type === 'meet' || l.type === 'carshow') && Math.hypot(l.x - v.x, l.z - v.z) < 60);
    if (meet) {
      const rep = meetEntrance(s, r.def);
      if (rep) { addRep(s, rep, 'Rolled into the meet on a trailer'); msg = `Rolled into ${meet.name} on the trailer. Heads turn when the ramps come down. +${rep} rep.`; }
    }
    w.ui.toast(msg, 'good');
    saveGame('auto', true);
  }

  load() {
    const s = this.s, w = this.w;
    const r = pickUpRig(s);
    if (!r.ok) { w.ui.toast(r.text, 'bad'); return; }
    const truck = s.cars.find(c => c.uid === s.tow.truck);
    w.placeCar(truck, r.rig.x, r.rig.z, r.rig.h);
    this.th = r.rig.th; this.truckRef = w.vehicle;
    const H = this.hitchPoint(w.vehicle), h = hitched(s), [tx, tz] = fwd(this.th);
    this.axle = { x: H.x - tx * h.def.len * h.def.axle, z: H.z - tz * h.def.len * h.def.axle };
    w.inCar = true;
    input.setContext('car');
    w.restartEngineSound();
    audio.click?.();
    w.ui.toast(`Strapped the ${r.model.model} down. Back in the truck.`, 'good');
    saveGame('auto', true);
  }

  // The parked rig is solid: circles along the truck and the trailer.
  obstacles() {
    const s = this.s, t = ensureTow(s);
    if (!t.rig) return [];
    const h = hitched(s);
    if (!h) return [];
    const r = t.rig, truckM = CAR_BY_ID[s.cars.find(c => c.uid === t.truck)?.modelId];
    const tL = dimsFor(truckM || 'truck').L;
    const [fx, fz] = fwd(r.h), [tx, tz] = fwd(r.th);
    const out = [];
    const ob = (x, z, W) => out.push({ x, z, h: r.h, v: 0, dims: { W, L: W }, own: true, parked: true, hit() {} });
    ob(r.x + fx * tL * 0.25, r.z + fz * tL * 0.25, 2);
    ob(r.x - fx * tL * 0.25, r.z - fz * tL * 0.25, 2);
    const Hx = r.x - fx * (tL / 2 + 0.25), Hz = r.z - fz * (tL / 2 + 0.25);
    const n = Math.max(2, Math.round(h.def.len / 2.2));
    for (let i = 0; i < n; i++) {
      const d = h.def.len * (i + 0.5) / n;
      ob(Hx - tx * d, Hz - tz * d, 2.3);
    }
    return out;
  }

  // ---------------------------------------------------------------- draw
  carSpriteOf(car) {
    const m = CAR_BY_ID[car.modelId];
    const key = car.uid + JSON.stringify([car.visual, levels(car), (car.cond?.body ?? 100) | 0]);
    let spr = this.sprites.get(key);
    if (!spr) { if (this.sprites.size > 8) this.sprites.clear(); spr = carSprite(m, car.visual, levels(car), car.cond, { crewColor: this.s.crew?.color }); this.sprites.set(key, spr); }
    return spr;
  }

  // Trailer whose tongue tip sits at (hx, hz), pointing along heading th.
  drawTrailer(ctx, cam, def, hx, hz, th, loaded) {
    const im = img(def.top);
    const [tx, tz] = fwd(th);
    const cx = hx - tx * def.len / 2, cz = hz - tz * def.len / 2;
    const W = im.naturalWidth ? def.len * im.naturalWidth / im.naturalHeight : 2.45;
    this.w.drawShadow(ctx, cx, cz, th, { W: W * 0.9, L: def.len * 0.85 });
    ctx.save();
    ctx.translate(cam.sx(cx), cam.sy(cz)); ctx.rotate(th);
    if (im.complete && im.naturalWidth) {
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(im, -W / 2 * cam.zoom, -def.len / 2 * cam.zoom, W * cam.zoom, def.len * cam.zoom);
    } else {
      ctx.fillStyle = def.kind === 'open' ? '#8a6a3e' : '#dcdcdc';
      ctx.fillRect(-W / 2 * cam.zoom, -def.len * 0.4 * cam.zoom, W * cam.zoom, def.len * 0.9 * cam.zoom);
    }
    ctx.restore();
    // the car strapped to the open deck
    if (loaded && def.kind === 'open') {
      const mid = def.len * (def.deck[0] + def.deck[1]) / 2;
      drawCar(ctx, this.carSpriteOf(loaded), cam.sx(hx - tx * mid), cam.sy(hz - tz * mid), th, cam.zoom);
    }
  }

  // Under the player's car: the trailer you're pulling, or the parked rig.
  draw(ctx, cam) {
    const s = this.s, t = ensureTow(s), h = hitched(s);
    if (!h) return;
    const loaded = t.car ? s.cars.find(c => c.uid === t.car) : null;
    const v = cam.view(30);
    if (t.rig) {
      const r = t.rig, truck = s.cars.find(c => c.uid === t.truck);
      if (!truck || r.x < v.x0 || r.x > v.x1 || r.z < v.z0 || r.z > v.z1) return;
      const m = CAR_BY_ID[truck.modelId], dims = dimsFor(m);
      const [fx, fz] = fwd(r.h);
      this.drawTrailer(ctx, cam, h.def, r.x - fx * (dims.L / 2 + 0.25), r.z - fz * (dims.L / 2 + 0.25), r.th, null);
      this.w.drawShadow(ctx, r.x, r.z, r.h, dims);
      drawCar(ctx, this.carSpriteOf(truck), cam.sx(r.x), cam.sy(r.z), r.h, cam.zoom);
      // a pulsing marker behind the ramps while you're in the car you unloaded
      if (this.w.inCar && this.w.vehicle?.car.uid === s.activeCar) {
        const b = this.rigBack(), pulse = (this.w.t * 0.8) % 1;
        ctx.save();
        ctx.strokeStyle = `rgba(44,255,122,${(1 - pulse) * 0.8})`; ctx.lineWidth = Math.max(2, 0.35 * cam.zoom);
        ctx.beginPath(); ctx.arc(cam.sx(b.x), cam.sy(b.z), (1.5 + pulse * 2.5) * cam.zoom, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      return;
    }
    const tv = this.truckVehicle();
    if (!tv || this.th == null) return;
    const H = this.hitchPoint(tv);
    this.drawTrailer(ctx, cam, h.def, H.x, H.z, this.th, loaded);
  }

  promptHtml(tch) {
    const a = this.act;
    if (!a) return '';
    if (a.blocked) return `<span class="muted">${esc(a.label)}</span>`;
    return `<kbd>${pad.inUse ? 'B' : tch ? 'USE' : 'Enter'}</kbd> <b style="color:#2cff7a">${esc(a.label)}</b>`;
  }
}
