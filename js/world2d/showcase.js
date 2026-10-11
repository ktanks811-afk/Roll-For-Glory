// Your place on everybody else's screen, and theirs on yours (net/builds.js
// carries it). Packs up what you've built on what you own (the house you
// designed, the garage plan, fence, livestock, dogs, the cars in your bays
// and the car parked out front) and puts the other players' places on the
// map: their houses go up on their land, their cars sit in their garage
// bays, and their doors open so you can walk in and look around.

import { builds, MAX_CARS } from '../net/builds.js';
import { deedable } from '../net/deeds.js';
import { LAND } from '../data/estate.js';
import { levels, activeCar } from '../core/state.js';
import { isBuilt, houseDesign } from '../core/estate.js';
import { applyEstate, setForeignLand } from './estate.js';
import { dogLook } from './ranch.js';

const carOut = car => ({ m: car.modelId, v: car.visual, l: levels(car), b: Math.round(car.cond?.body ?? 100), li: Math.round(car.cond?.lights ?? 100), t: Math.round(car.cond?.tires ?? 100) });

// Your place: { prop: build } for everything you hold a deed to.
export function packMine(w) {
  const s = w.s, out = {};
  const props = deedable(s);
  if (!props.length) return out;
  const byGarage = {};
  for (const { g, car } of w.garageAssign()) (byGarage[g.id] ||= []).push(carOut(car));
  for (const p of props) {
    const b = { cars: (byGarage[p] || []).slice(0, MAX_CARS) };
    if (LAND[p]) {
      const l = s.estate.land[p], built = isBuilt(s, p);
      b.land = { plan: built ? l.plan : null, design: built ? houseDesign(s, p) : null, fence: l.fence || null, animals: l.animals || {},
        dogs: (s.kennel?.dogs || []).filter(d => d.home === p).slice(0, 16).map(dogLook) };
    }
    // the car you left parked at this place (in the garage or out front)
    const g = w.map.garages.find(q => q.id === p), v = w.vehicle, car = v && !w.inCar && activeCar(s);
    if (g && car && !car.stolen && Math.hypot(v.x - g.center.x, v.z - g.center.z) < 30) b.park = { ...carOut(car), x: +v.x.toFixed(2), z: +v.z.toFixed(2), h: +v.h.toFixed(3) };
    out[p] = b;
  }
  return out;
}

export class Showcase {
  constructor(w) {
    this.w = w;
    this.t = 0;
    this.version = -1;
    this.uid = null;
    this.landKey = '';
    this.places = new Map();   // prop -> { uid, name, b }: other players' places on your server
  }

  // Whose place is this (a garage or house id), if it's another player's? name | null
  ownerOf(id) { return this.places.get(id)?.name || null; }

  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 2;
    const s = this.w.s;
    try { builds.tick(s, 2, s.homeServer ? packMine(this.w) : {}); } catch (e) { console.warn('showcase', e); }
    if (builds.version === this.version && this.uid === s.uid) return;
    this.version = builds.version; this.uid = s.uid;
    this.places = new Map(builds.all(s).filter(([p]) => !s.properties.includes(p) && !s.estate?.land?.[p]?.owned));
    // their land: houses, garages and fences go up, animals and dogs come out
    const land = {};
    for (const [p, e] of this.places) if (LAND[p] && e.b.land) land[p] = { name: e.name, land: e.b.land };
    const key = JSON.stringify(land);
    if (key !== this.landKey) {
      this.landKey = key;
      setForeignLand(land);
      applyEstate(this.w.map, s);
      this.w.ranch.setForeign(land);
    }
    this.w.garageT = 0;
  }

  // Their cars in their garage bays, and the one parked out front, for world.garageCars.
  cars(sprite) {
    const out = [];
    for (const [p, e] of this.places) {
      const g = this.w.map.garages.find(q => q.id === p);
      if (!g) continue;
      e.b.cars.forEach((c, i) => {
        const bay = g.bays[i];
        if (c && bay) out.push({ x: bay.x, z: bay.z, h: bay.h, garage: g.id, ...sprite(c) });
      });
      const k = e.b.park;
      if (k && Math.hypot(k.x - g.center.x, k.z - g.center.z) < 30) out.push({ x: k.x, z: k.z, h: k.h, garage: g.id, ...sprite(k) });
    }
    return out;
  }
}
