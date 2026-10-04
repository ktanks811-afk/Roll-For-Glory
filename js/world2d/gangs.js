// Gangs in the open world (rules are in core/gangs.js).
//
//   corners  — every set posts up on a corner in its hood. They're peds in the
//              traffic list (so your gun hits them) that stand still. A set
//              that's hostile to you shoots on sight; one you're in has your back.
//   homies   — the homies riding with you follow you on foot and shoot back at
//              anybody shooting at you. In a car they hang out the windows: roll
//              past a rival corner slow on a drive-by job and they let it go.
//   the hit  — when beef runs hot, a rival car comes down your street and opens
//              up as it passes. Shoot back, get out of the way, or both.
//   jobs     — hits, drive-bys, pickups and defending your block report back
//              to core/gangs.js as they happen.

import { TrafficCar } from './traffic.js';
import { collideCircle, lineOfSight } from './map.js';
import { audio } from '../core/audio.js';
import { GANGS, GANG_IDS } from '../data/gangs.js';
import { LOC_BY_ID } from '../data/world.js';
import { HOOD_BY_ID, hoodOf } from '../core/turf.js';
import { ensureArms } from '../data/weapons.js';
import * as G from '../core/gangs.js';

const SKIN = ['#8d5a3b', '#c68e65', '#5a3622', '#e0b48c', '#6e4428'];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const SPAWN_R = 170, DROP_R = 230;
const SHOOT_R = 26;                 // a corner opens up on you inside this
const HOMIE_R = 28;                 // homies shoot back inside this
const DRIVEBY_R = 20, DRIVEBY_V = 15;   // roll past slower than ~33 mph or nobody hits anything

// Where a set posts up: the sidewalk beside the road nearest its spot.
export function cornerAt(map, x, z) {
  let best = null, bd = 1e9;
  for (const e of map.roads.edges) {
    if (e.kind === 'highway' || e.len < 20) continue;
    const t = Math.max(10, Math.min(e.len - 10, (x - e.ax) * e.dx + (z - e.az) * e.dz));
    const px = e.ax + e.dx * t, pz = e.az + e.dz * t, d = Math.hypot(x - px, z - pz);
    if (d < bd) { bd = d; best = { e, px, pz }; }
  }
  if (!best) return { x, z, ax: 1, az: 0 };
  const { e, px, pz } = best, off = (e.width || 16) / 2 + 2.5;
  for (const side of [1, -1]) {
    const cx = px - e.dz * off * side, cz = pz + e.dx * off * side;
    if (!collideCircle(map, cx, cz, 0.8)) return { x: cx, z: cz, ax: e.dx, az: e.dz };
  }
  return { x: px - e.dz * off, z: pz + e.dx * off, ax: e.dx, az: e.dz };
}

export class GangWorld {
  constructor(world) {
    this.w = world;
    this.sets = {};         // id -> { c, peds, lostT }
    this.homies = [];       // peds of the homies following you
    this.hitCar = null;
    this.lastHood = null;
    this.fireT = 0;         // drive-by gun cadence
    this.corners = {};
    for (const id of GANG_IDS) this.corners[id] = cornerAt(world.map, ...GANGS[id].at);
  }
  get s() { return this.w.s; }
  get g() { return G.ensureGang(this.s); }

  // Your set's corner (own set: the middle of your home hood).
  cornerOf(id) {
    if (id === 'own') {
      const own = this.g.own, h = own && HOOD_BY_ID[own.hood];
      if (!h) return null;
      if (!this.ownCorner || this.ownCorner.hood !== own.hood) this.ownCorner = { hood: own.hood, ...cornerAt(this.w.map, h.c[0], h.c[1]) };
      return this.ownCorner;
    }
    return this.corners[id] || null;
  }
  // Point the GPS at whatever the current job needs.
  gpsFor(job = this.g.job) {
    if (!job) return;
    if (job.kind === 'collect') {
      const l = LOC_BY_ID[job.loc], c = l || this.cornerOf(this.g.set);
      if (c) this.w.setGps(c.x, c.z, job.title);
      return;
    }
    const c = this.cornerOf(job.kind === 'defend' ? this.g.set : job.gang);
    if (c) this.w.setGps(c.x, c.z, job.title);
  }

  // ------------------------------------------------------------ peds
  mkPed(x, z, color, extra) {
    return { x, z, x0: x, z0: z, size: 1, t: 0, sp: 0, dir: 1, dx: 0, dz: 0, dodge: 0, color, skin: pick(SKIN), hp: 40, ctl: true, cd: rnd(0.5, 1.5), ...extra };
  }
  addPed(p) { this.w.traffic.peds.push(p); return p; }

  // Who stands on a corner right now: the set itself, or the rivals posted on your block.
  crowd(id) {
    const g = this.g;
    if (g.job?.kind === 'defend' && id === g.set) return { gang: g.job.gang, n: g.job.need - g.job.got, invaders: true };
    if (id === 'own') return { gang: 'own', n: 2 };
    return { gang: id, n: id === g.set ? 3 : 4 };
  }

  spawnSet(id, c) {
    const cr = this.crowd(id);
    const info = G.setInfo(this.s, cr.gang);
    const set = { id, c, gang: cr.gang, invaders: !!cr.invaders, peds: [], angry: false };
    for (let i = 0; i < cr.n; i++) {
      const along = (i - (cr.n - 1) / 2) * 1.6 + rnd(-0.3, 0.3), out = rnd(-0.6, 1.2);
      set.peds.push(this.addPed(this.mkPed(c.x + c.ax * along - c.az * out, c.z + c.az * along + c.ax * out, info?.color || '#888', { gang: cr.gang, friend: cr.gang === this.g.set, set: id })));
    }
    this.sets[id] = set;
  }
  dropSet(id) {
    const set = this.sets[id];
    if (set) for (const p of set.peds) p.gone = true;
    delete this.sets[id];
  }

  updateSets(p) {
    const g = this.g;
    const ids = [...GANG_IDS, ...(g.set === 'own' ? ['own'] : [])];
    for (const id of ids) {
      const c = this.cornerOf(id); if (!c) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      const set = this.sets[id];
      const want = this.crowd(id);
      if (!set && d < SPAWN_R && want.n > 0) this.spawnSet(id, c);
      else if (set && (d > DROP_R || set.gang !== want.gang)) this.dropSet(id);
    }
  }

  // ------------------------------------------------------------ shooting
  shot(x0, z0, x1, z1, loud = 0.7) {
    const cb = this.w.combat;
    this.shots = (this.shots || 0) + 1;
    cb.tracers.push({ x0, z0, x1: x1 + rnd(-0.4, 0.4), z1: z1 + rnd(-0.4, 0.4), t: 0.09 });
    cb.flashes.push({ x: x0, z: z0, a: Math.atan2(x1 - x0, -(z1 - z0)), t: 0.07 });
    const p = this.w.playerState();
    const d = Math.hypot(x0 - p.x, z0 - p.z);
    if (d < 120) audio.gunshot(loud * Math.max(0.25, 1 - d / 120));
  }
  clear(a, b) { return lineOfSight(this.w.map, a.x, a.z, b.x, b.z); }

  // A hostile shooter takes a shot at you (or a homie next to you).
  shootAtYou(from, p, acc, dmg, who) {
    const targets = [{ x: p.x, z: p.z, you: true }, ...this.homies.filter(h => !h.down)];
    const t = targets.reduce((a, b) => (Math.hypot(b.x - from.x, b.z - from.z) < Math.hypot(a.x - from.x, a.z - from.z) ? b : a));
    this.shot(from.x, from.z, t.x, t.z, 0.8);
    const d = Math.hypot(t.x - from.x, t.z - from.z);
    if (Math.random() > acc * (1 - d / 60)) return;
    if (t.you) {
      if (this.w.inCar && this.w.vehicle) {
        const car = this.w.vehicle.car;
        car.cond.body = Math.max(5, car.cond.body - 3);
        this.w.refreshCarSprite();
        if (Math.random() < 0.25) this.w.combat.hurt(Math.round(dmg * 0.6), `${who} hit you through the door`);
      } else this.w.combat.hurt(dmg, `Shot by ${who}`);
    } else {
      t.hp -= dmg;
      if (t.hp <= 0) { t.down = 14; G.homieDown(this.s, t.homie); }
    }
  }

  updateCorners(dt, p) {
    const g = this.g;
    for (const set of Object.values(this.sets)) {
      const info = G.setInfo(this.s, set.gang);
      for (const pd of set.peds) {
        if (pd.down) {
          if (!pd.counted) { pd.counted = true; this.dropped(set, pd); }
          continue;
        }
        // your gunfire nearby sets anybody off
        if (!pd.friend && (pd.scared > 0 || pd.hp < 40) && !set.angry) {
          set.angry = true;
          if (!G.hostile(this.s, set.gang) && GANGS[set.gang]) G.addBeef(this.s, set.gang, 20);
        }
      }
      if (set.peds[0]?.friend) {
        // your own set has your back on the block
        for (const pd of set.peds) {
          if (pd.down || (pd.cd -= dt) > 0) continue;
          const t = this.target(pd, HOMIE_R + 4);
          pd.cd = t ? rnd(0.7, 1.2) : 0.4;
          if (!t) continue;
          this.shot(pd.x, pd.z, t.x, t.z, 0.7);
          if (t.car) { if (Math.random() < 0.3) t.car.gangHit.hp--; } else if (Math.random() < 0.4) this.w.combat.hurtPed(t, 22);
        }
        continue;
      }
      const mad = set.invaders || set.angry || G.hostile(this.s, set.gang);
      if (!mad) continue;
      for (const pd of set.peds) {
        if (pd.down) continue;
        pd.cd -= dt;
        const d = Math.hypot(p.x - pd.x, p.z - pd.z);
        if (d > SHOOT_R || pd.cd > 0) continue;
        pd.cd = rnd(0.8, 1.5);
        if (!this.clear(pd, p)) continue;
        if (!set.warned) { set.warned = true; this.w.ui.toast(`${info.short} are shooting at you!`, 'bad'); }
        this.shootAtYou(pd, p, this.w.inCar ? 0.2 : 0.34, Math.round(rnd(8, 14)), info.short);
      }
    }
  }

  // Someone on a corner went down.
  dropped(set, pd) {
    const s = this.s, g = this.g, gang = set.gang;
    if (pd.friend || !GANGS[gang]) return;
    g.stats.drops++;
    G.addBeef(s, gang, 12);
    if (g.set) G.addRespect(s, 10);
    const j = g.job;
    if (!j) return;
    if (j.kind === 'defend' && set.invaders) G.progress(s, 'defend', gang);
    else if (j.kind === 'driveby' && this.w.inCar) G.progress(s, 'driveby', gang);
    else if (j.kind === 'hit') G.progress(s, 'hit', gang);
  }

  // ------------------------------------------------------------ homies
  updateHomies(dt, p) {
    const s = this.s, g = this.g;
    const want = this.w.inCar ? [] : G.rollingHomies(s);
    // spawn the ones that should be here, drop the ones that shouldn't
    for (const h of this.homies) if (h.down || !want.some(w => w.id === h.homie)) h.gone = true;
    this.homies = this.homies.filter(h => !h.gone);
    const color = G.mySet(s)?.color || '#888';
    want.forEach((h, i) => {
      if (this.homies.some(q => q.homie === h.id)) return;
      const a = this.w.foot.h + Math.PI + (i - 1) * 0.7;
      this.homies.push(this.addPed(this.mkPed(p.x + Math.sin(a) * 2.5, p.z - Math.cos(a) * 2.5, color, { friend: true, homie: h.id, nick: h.nick, hp: 70 })));
    });
    // follow a couple of steps behind you, in a loose line
    this.homies.forEach((q, i) => {
      if (q.down) return;
      const a = this.w.foot.h + Math.PI + (i - (this.homies.length - 1) / 2) * 0.8;
      const tx = p.x + Math.sin(a) * 2.6, tz = p.z - Math.cos(a) * 2.6;
      const dx = tx - q.x, dz = tz - q.z, d = Math.hypot(dx, dz);
      if (d > 45) { q.x = tx; q.z = tz; q.sp = 0; return; }
      const v = d > 1.2 ? Math.min(6, d * 2) : 0;
      const nx = q.x + dx / (d || 1) * v * dt, nz = q.z + dz / (d || 1) * v * dt;
      const hit = collideCircle(this.w.map, nx, nz, 0.4);
      if (!hit) { q.x = nx; q.z = nz; } else { q.x = nx + hit.nx * hit.pen; q.z = nz + hit.nz * hit.pen; }
      q.sp = v > 0.3 ? 1.4 : 0;
      q.hp = Math.min(70, q.hp + dt * 0.5);
    });
    // shoot back at anybody shooting at you
    for (const q of this.homies) {
      if (q.down) continue;
      q.cd -= dt;
      if (q.cd > 0) continue;
      const t = this.target(q, HOMIE_R);
      if (!t) { q.cd = 0.3; continue; }
      q.cd = rnd(0.6, 1.1);
      this.shot(q.x, q.z, t.x, t.z, 0.7);
      if (t.car) { if (Math.random() < 0.4) t.car.gangHit.hp--; } else if (Math.random() < 0.45) this.w.combat.hurtPed(t, 22);
    }
  }

  // The nearest enemy in range: a mad corner, an invader, or the hit car.
  target(from, r) {
    let best = null, bd = r;
    for (const set of Object.values(this.sets)) {
      if (set.peds[0]?.friend) continue;
      if (!(set.invaders || set.angry || G.hostile(this.s, set.gang) || this.g.job?.gang === set.gang)) continue;
      for (const pd of set.peds) {
        if (pd.down) continue;
        const d = Math.hypot(pd.x - from.x, pd.z - from.z);
        if (d < bd && this.clear(from, pd)) { bd = d; best = pd; }
      }
    }
    const hc = this.hitCar;
    if (hc && hc.gangHit.fired && hc.gangHit.hp > 0) {
      const d = Math.hypot(hc.x - from.x, hc.z - from.z);
      if (d < bd) best = { x: hc.x, z: hc.z, car: hc, hp: 999 };
    }
    return best;
  }

  // ------------------------------------------------------------ drive-bys
  // In a car with homies (or your own strap): on a drive-by job, or when a set
  // is already shooting at you, everybody hangs out the windows.
  updateDriveBy(dt, p) {
    const s = this.s, g = this.g, v = this.w.vehicle;
    if (!this.w.inCar || !v) return;
    const riders = Math.min(3, G.rollingHomies(s).length) + (ensureArms(s).guns.some(q => !q.melee) ? 1 : 0);
    if (!riders) return;
    this.fireT -= dt;
    if (this.fireT > 0) return;
    let best = null, bd = DRIVEBY_R, bset = null;
    for (const set of Object.values(this.sets)) {
      if (set.peds[0]?.friend) continue;
      const job = g.job?.kind === 'driveby' && g.job.gang === set.gang;
      if (!job && !set.angry && !set.invaders && !(G.hostile(s, set.gang) && set.warned)) continue;
      for (const pd of set.peds) {
        if (pd.down) continue;
        const d = Math.hypot(pd.x - p.x, pd.z - p.z);
        if (d < bd && this.clear(p, pd)) { bd = d; best = pd; bset = set; }
      }
    }
    if (!best) {
      const hc = this.hitCar;
      if (hc?.gangHit.fired && hc.gangHit.hp > 0 && Math.hypot(hc.x - p.x, hc.z - p.z) < DRIVEBY_R) {
        this.fireT = 0.5 / riders;
        this.shot(p.x, p.z, hc.x, hc.z, 0.8);
        if (Math.random() < 0.4) hc.gangHit.hp--;
      }
      return;
    }
    this.fireT = 0.55 / riders;
    if (v.speed > DRIVEBY_V) { if (!this.fastSaid) { this.fastSaid = true; this.w.ui.toast('Slow down! Can\'t hit nothing at this speed.', 'info'); } return; }
    this.fastSaid = false;
    this.shot(p.x + rnd(-0.8, 0.8), p.z + rnd(-0.8, 0.8), best.x, best.z, 0.9);
    bset.angry = true;
    this.w.setOffence(1.6, `Drive-by shooting${g.set ? ' (gang activity)' : ''}.`, 'driveby', 'driveby', 3500);
    this.w.police.gunshot(this.w, 'shot');
    if (Math.random() < 0.4) this.w.combat.hurtPed(best, 40);
  }

  // ------------------------------------------------------------ the hit
  // A rival car comes down the road you're on and opens up as it passes.
  spawnHit(gang, p) {
    const roads = this.w.map.roads;
    const opts = [];
    for (const e of roads.edges) {
      if (e.kind === 'highway') continue;
      const t = (p.x - e.ax) * e.dx + (p.z - e.az) * e.dz;
      if (t < 0 || t > e.len) continue;
      const perp = Math.abs((p.x - e.ax) * -e.dz + (p.z - e.az) * e.dx);
      if (perp > 22) continue;
      for (const dir of [1, -1]) {
        const back = Math.min(80, dir > 0 ? t - 2 : e.len - 2 - t);   // come from up the street
        if (back >= 35) opts.push({ e, dir, s0: t - dir * back });
      }
    }
    if (!opts.length) return null;
    const o = pick(opts);
    const car = new TrafficCar(roads, o.e, o.dir, o.dir > 0 ? o.s0 : o.e.len - o.s0, 0, { color: GANGS[gang].color });
    car.drv = 0.7;
    car.gangHit = { gang, t: 0, fired: 0, hp: 5, shooters: 2, cd: 0, close: false, done: false };
    const was = car.hit.bind(car);
    car.hit = n => { was(n); car.gangHit.hp--; };     // your bullets count too
    this.w.traffic.cars.push(car);
    this.hitCar = car;
    return car;
  }

  updateHit(dt, p) {
    const s = this.s, g = this.g;
    if (!this.hitCar && g.hit && s.time.day * 1440 + s.time.min >= g.hit.at && !this.w.races?.active && !this.w.inGarage) {
      if (this.spawnHit(g.hit.gang, p)) { this.hitT = 0; g.hit = null; }
      else g.hit.at += 5;     // nowhere to come at you from yet
    }
    const car = this.hitCar; if (!car) return;
    const h = car.gangHit, info = GANGS[h.gang];
    h.t += dt;
    const d = Math.hypot(car.x - p.x, car.z - p.z);
    if (!h.done && h.hp <= 0) {
      h.done = true; car.hit(12);
      G.addRespect(s, 40, `Lit up the ${info.short} car`);
      G.addBeef(s, h.gang, 10);
      this.w.ui.toast(`You lit up their car. ${info.short} crashed out.`, 'good');
    }
    if (!h.done && d < 24 && h.t < 30) {
      if (!h.close) { h.close = true; this.w.ui.toast(`${info.name} sliding on you! Get down!`, 'bad'); car.drv = 0.45; }
      h.cd -= dt;
      if (h.cd <= 0 && this.clear(car, p)) {
        h.cd = rnd(0.18, 0.32); h.fired++;
        this.shootAtYou(car, p, 0.2, Math.round(rnd(7, 11)), info.short);
      }
      if (h.fired > 14) { h.done = true; car.drv = 1.35; }
    } else if (h.close && !h.done) { h.done = true; car.drv = 1.35; }
    if (h.t > 45 || d > 400 || (h.done && d > 120)) this.hitCar = null;
  }

  // ------------------------------------------------------------ the rest
  updateHood(p) {
    const h = hoodOf(p.x, p.z), g = this.g;
    if (h?.id === this.lastHood) return;
    this.lastHood = h?.id || null;
    if (!h) return;
    const owner = GANG_IDS.find(id => GANGS[id].hood === h.id);
    if (g.set === 'own' && g.own?.hood === h.id) return;
    if (!owner) return;
    if (owner === g.set) this.w.ui.toast(`Back on ${GANGS[owner].short} turf.`, 'info');
    else if (G.hostile(this.s, owner)) this.w.ui.toast(`${GANGS[owner].name} territory. They'll shoot on sight.`, 'bad');
    else if (g.set) this.w.ui.toast(`${GANGS[owner].name} territory. Keep it moving.`, 'info');
  }

  updateCollect(p) {
    const j = this.g.job;
    if (!j || j.kind !== 'collect') return;
    const c = LOC_BY_ID[j.loc] || this.cornerOf(this.g.set);
    if (c && Math.hypot(c.x - p.x, c.z - p.z) < 12) G.progress(this.s, 'collect', j.gang);
  }

  update(dt) {
    const s = this.s; if (!s) return;
    const p = this.w.playerState();
    this.updateHood(p);
    this.updateSets(p);
    this.updateCorners(dt, p);
    this.updateHomies(dt, p);
    this.updateDriveBy(dt, p);
    this.updateHit(dt, p);
    this.updateCollect(p);
  }

  // Rings under the people that matter: green for your side, red for anyone shooting at you.
  draw(ctx, cam) {
    const v = cam.view(10), z = cam.zoom;
    const ring = (x, y, col) => { ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, 0.1 * z); ctx.beginPath(); ctx.arc(x, y, 0.75 * z, 0, Math.PI * 2); ctx.stroke(); };
    ctx.save();
    for (const set of Object.values(this.sets)) {
      const c = set.c, info = G.setInfo(this.s, set.gang);
      if (c.x > v.x0 && c.x < v.x1 && c.z > v.z0 && c.z < v.z1 && info) {
        // the set's name tagged on the sidewalk
        ctx.save(); ctx.translate(cam.sx(c.x - c.az * 2.2), cam.sy(c.z + c.ax * 2.2)); ctx.rotate(-cam.rot);
        ctx.globalAlpha = 0.55; ctx.fillStyle = info.color; ctx.font = `800 ${Math.max(8, 0.9 * z)}px Rajdhani, sans-serif`; ctx.textAlign = 'center';
        ctx.fillText(info.short.toUpperCase(), 0, 0); ctx.restore();
      }
      const mad = set.invaders || set.angry || G.hostile(this.s, set.gang);
      for (const pd of set.peds) {
        if (pd.down || pd.x < v.x0 || pd.x > v.x1 || pd.z < v.z0 || pd.z > v.z1) continue;
        ring(cam.sx(pd.x), cam.sy(pd.z), pd.friend ? 'rgba(60,230,120,0.8)' : mad ? 'rgba(255,50,60,0.85)' : 'rgba(255,255,255,0.35)');
      }
    }
    for (const q of this.homies) if (!q.down) ring(cam.sx(q.x), cam.sy(q.z), 'rgba(60,230,120,0.8)');
    const hc = this.hitCar;
    if (hc && hc.gangHit.close && !hc.gangHit.done) {
      ctx.strokeStyle = 'rgba(255,40,60,0.9)'; ctx.lineWidth = Math.max(2, 0.15 * z);
      ctx.beginPath(); ctx.arc(cam.sx(hc.x), cam.sy(hc.z), 3.2 * z, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}
