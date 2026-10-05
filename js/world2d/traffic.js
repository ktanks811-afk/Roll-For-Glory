// Civilian traffic and pedestrians. Cars follow lanes on the road graph,
// obey signals, keep their distance and react when you hit them. Only cars
// near the player exist; the rest of the city is simulated by not existing.

import { CARS } from '../data/cars.js';
import { carSprite, dimsFor } from '../gfx2d/carSprite.js';
import { signalState } from './render.js';
import { ROAD_W, DALLAS, DENTON, inDallas, inDenton } from '../data/world.js';

export const COMMON = CARS.filter(c => !c.market && c.msrp < 70000);
const COLORS = ['#9aa0a8', '#24262b', '#f2f2f2', '#3d4452', '#7a1414', '#1b4fc4', '#c8b98a', '#5a5d63', '#0d0d0d', '#4a5232', '#8c9196', '#e0e0e0'];
const pick = a => a[Math.floor(Math.random() * a.length)];

export class TrafficCar {
  constructor(roads, edge, dir, s, lane, opts = {}) {
    this.roads = roads;
    this.model = opts.model || pick(COMMON);
    this.dims = dimsFor(this.model);
    this.color = opts.color || pick(COLORS);
    this.police = !!opts.police;
    this.sprite = carSprite(this.model, { paint: this.police ? '#f2f2f2' : this.color, wheels: 'steel', tint: 'light' }, {}, null, { police: this.police });
    this.edge = edge; this.dir = dir; this.s = s; this.lane = lane;
    this.drv = 0.85 + Math.random() * 0.25;
    this.v = edge.speed * this.drv * 0.8;
    this.stun = 0;
    this.x = 0; this.z = 0; this.h = 0;
    this.place(true);
  }
  laneOffset() { const l = this.edge.lanes; return l[Math.min(this.lane, l.length - 1)]; }
  dirVec() { return { x: this.edge.dx * this.dir, z: this.edge.dz * this.dir }; }
  startNode() { return this.roads.nodes[this.dir > 0 ? this.edge.a : this.edge.b]; }
  endNode() { return this.roads.nodes[this.dir > 0 ? this.edge.b : this.edge.a]; }
  place(snap = false) {
    const st = this.startNode(), d = this.dirVec();
    const off = this.laneOffset();
    const tx = st.x + d.x * this.s - d.z * off, tz = st.z + d.z * this.s + d.x * off;
    const th = Math.atan2(d.x, -d.z);
    if (snap) { this.x = tx; this.z = tz; this.h = th; return; }
    this.x += (tx - this.x) * 0.25; this.z += (tz - this.z) * 0.25;
    let dh = th - this.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    this.h += dh * 0.2;
  }
  get lightsOn() { return true; }

  update(dt, ctx) {
    if (this.stun > 0) { this.stun -= dt; this.v = Math.max(0, this.v - 12 * dt); this.place(); return; }
    const e = this.edge;
    let target = e.speed * this.drv * (ctx.weatherSlow || 1);
    const remaining = e.len - this.s;
    const end = this.endNode();
    // signals
    if (e.kind === 'city' && end.edges.length >= 3 && remaining < 30) {
      const sig = signalState(end, ctx.signalT);
      const ns = Math.abs(e.dz) > 0.5;
      const green = ns === sig.nsGreen && !sig.yellow;
      const stopAt = remaining - (ROAD_W / 2 + 4);
      if (!green && stopAt > -1) target = Math.min(target, Math.max(0, stopAt * 0.9));
    }
    // whoever is in front of us
    const d = this.dirVec();
    let gap = Infinity;
    for (const o of ctx.others) {
      if (o === this) continue;
      const dx = o.x - this.x, dz = o.z - this.z;
      const ahead = dx * d.x + dz * d.z;
      if (ahead <= 0 || ahead > 30) continue;
      const lat = Math.abs(dx * -d.z + dz * d.x);
      if (lat > 2.6) continue;
      gap = Math.min(gap, ahead);
    }
    if (gap < 30) target = Math.min(target, Math.max(0, (gap - 7) * 0.8));
    const acc = target > this.v ? 2.6 : 7;
    this.v += Math.sign(target - this.v) * Math.min(Math.abs(target - this.v), acc * dt);
    this.s += this.v * dt;
    if (this.s >= e.len) this.turn();
    this.place();
  }

  turn() {
    const node = this.endNode();
    const opts = node.edges.filter(id => id !== this.edge.id).map(id => this.roads.edges[id]).filter(e => !e.track);   // nobody commutes on the speedway
    const over = this.s - this.edge.len;
    if (!opts.length) { this.dir = -this.dir; this.s = 0; return; }
    const straight = opts.find(e => Math.abs(e.dx * this.edge.dx + e.dz * this.edge.dz) > 0.9);
    const next = straight && Math.random() < 0.6 ? straight : pick(opts);
    this.edge = next;
    this.dir = next.a === node.id ? 1 : -1;
    this.s = Math.max(0, over);
    this.lane = Math.min(this.lane, next.lanes.length - 1);
  }

  hit(strength) { this.stun = 2 + strength * 0.2; this.v *= 0.3; }
}

export class TrafficSystem {
  constructor(roads) {
    this.roads = roads;
    this.cars = [];
    this.peds = [];
    this.target = 34;
  }
  spawnNear(px, pz, minD, maxD, opts) {
    for (let tries = 0; tries < 30; tries++) {
      const e = this.roads.edges[Math.floor(Math.random() * this.roads.edges.length)];
      if (e.track) continue;
      const s = Math.random() * e.len;
      const x = e.ax + e.dx * s, z = e.az + e.dz * s;
      const d = Math.hypot(x - px, z - pz);
      if (d < minD || d > maxD) continue;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const sAlong = dir > 0 ? s : e.len - s;
      const lane = Math.floor(Math.random() * e.lanes.length);
      return new TrafficCar(this.roads, e, dir, sAlong, lane, opts);
    }
    return null;
  }
  update(dt, ctx) {
    const { px, pz } = ctx;
    const density = ctx.density ?? 1;
    const want = Math.round(this.target * density);
    this.cars = this.cars.filter(c => Math.hypot(c.x - px, c.z - pz) < 520);
    let guard = 0;
    while (this.cars.length < want && guard++ < 6) {
      const c = this.spawnNear(px, pz, this.cars.length < want / 2 ? 120 : 220, 450);
      if (c) this.cars.push(c); else break;
    }
    ctx.others = [...this.cars, ...(ctx.extraObstacles || [])];
    for (const c of this.cars) c.update(dt, ctx);
    this.updatePeds(dt, ctx);
  }

  // ---------------- pedestrians ----------------
  updatePeds(dt, ctx) {
    const { px, pz } = ctx;
    this.peds = this.peds.filter(p => Math.hypot(p.x - px, p.z - pz) < 260 && !p.gone);
    const want = ctx.inCity ? (ctx.night ? 18 : 40) : 0;
    let guard = 0;
    while (this.peds.length < want && guard++ < 4) {
      // walk around a block on the sidewalk
      // Fort Worth's grid, or Dallas's or Denton's when you're over there
      const dal = inDallas(px, pz), den = inDenton(px, pz);
      const gx = dal ? DALLAS.x0 : den ? DENTON.x0 : -900, gz = dal ? DALLAS.z0 : den ? DENTON.z0 : -900, nb = dal ? 9 : den ? 7 : 11;
      const bi = Math.floor((px - gx) / 150 + (Math.random() - 0.5) * 4);
      const bj = Math.floor((pz - gz) / 150 + (Math.random() - 0.5) * 4);
      if (bi < 0 || bj < 0 || bi > nb || bj > nb) continue;
      if (dal && (bj === 4 || bj === 5)) continue;     // not along I-30
      const x0 = gx + bi * 150 + 10.5, z0 = gz + bj * 150 + 10.5, size = 150 - 21;
      const p = { x0, z0, size, t: Math.random() * size * 4, sp: 1.1 + Math.random() * 0.6, dir: Math.random() < 0.5 ? 1 : -1, color: pick(['#c41b1b', '#1b4fc4', '#e8e8e8', '#222', '#e8c21a', '#4a5232', '#6b2bd1']), dodge: 0, dx: 0, dz: 0 };
      this.placePed(p);
      if (Math.hypot(p.x - px, p.z - pz) > 60) this.peds.push(p);
    }
    for (const p of this.peds) {
      if (p.down) { p.down -= dt; if (p.down <= 0) p.gone = true; continue; }
      if (p.cower || p.ctl) continue;   // gang members: world2d/gangs.js moves them
      p.t = (p.t + p.sp * p.dir * dt * (p.scared ? 2.5 : 1) + p.size * 4) % (p.size * 4);
      // jump out of the way of fast cars
      for (const c of ctx.movers) {
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < 8 && c.speed > 2) {
          const nx = (p.x - c.x) / (d || 1), nz = (p.z - c.z) / (d || 1);
          p.dx += nx * 14 * dt; p.dz += nz * 14 * dt;
          p.scared = 1.5;
        }
      }
      const len = Math.hypot(p.dx, p.dz);
      if (len > 5) { p.dx *= 5 / len; p.dz *= 5 / len; }
      if (!p.scared) { p.dx *= Math.pow(0.4, dt); p.dz *= Math.pow(0.4, dt); }
      this.placePed(p);
      if (p.scared) p.scared = Math.max(0, p.scared - dt);
    }
  }
  placePed(p) {
    const s = p.size, t = p.t;
    let x, z;
    if (t < s) { x = p.x0 + t; z = p.z0; } else if (t < 2 * s) { x = p.x0 + s; z = p.z0 + (t - s); }
    else if (t < 3 * s) { x = p.x0 + s - (t - 2 * s); z = p.z0 + s; } else { x = p.x0; z = p.z0 + s - (t - 3 * s); }
    p.x = x + (p.dx || 0); p.z = z + (p.dz || 0);
  }
}
