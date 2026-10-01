// Port Solace PD. Patrol cars drive the streets like traffic. When they see
// you break the law, heat rises; pursuit units drive in from the precincts
// and the edge of the area (nobody teleports next to you), search where you
// were last seen, set roadblocks and spike strips at level 4 and bring the
// helicopter at level 5.

import { CAR_BY_ID } from '../data/cars.js';
import { carSprite, DIMS } from '../gfx2d/carSprite.js';
import { TrafficCar } from './traffic.js';
import { collideCircle, lineOfSight } from './map.js';
import { LOC_BY_ID, TUNNEL, HWY_Z, HWY_W } from '../data/world.js';

const PATROL_MODELS = ['ford_crown_victoria_police_interceptor_2003', 'dodge_charger_scat_pack_2015', 'ford_explorer_xlt_2002', 'chevrolet_tahoe_lt_2007'];
const INTERCEPTORS = ['dodge_charger_srt_hellcat_redeye_2021', 'ford_mustang_gt_s650_2024', 'chevrolet_camaro_ss_2016'];
const UNIT_COUNT = [0, 1, 2, 4, 6, 8];
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let unitSeq = 12;

class Unit {
  constructor(model, x, z, h) {
    this.model = model;
    this.dims = DIMS[model.body];
    this.sprite = carSprite(model.body, { paint: '#f2f2f2' }, {}, null, { police: true });
    this.x = x; this.z = z; this.h = h; this.v = 0;
    this.id = unitSeq++;
    this.mode = 'pursuit';
    this.stuck = 0; this.backup = 0;
    this.target = null;
    this.searchPt = null;
    this.lightsOn = true;
  }
  get speed() { return Math.abs(this.v); }
}

export class PoliceSystem {
  constructor(map, s) {
    this.map = map;
    this.s = s;
    this.patrols = [];   // TrafficCar with police flag
    this.units = [];     // active pursuit units
    this.blocks = [];    // roadblocks: { cars:[Unit], spikes:{x,z,w,d,h} }
    this.heli = null;
    this.phase = 'none'; // none | notice | chase | search | cooldown
    this.lastSeen = null;
    this.unseenT = 0;
    this.cooldown = 0;
    this.searchR = 0;
    this.bustT = 0;
    this.blockT = 0;
    this.chatterT = 0;
    this.seen = false;
    this.decayHold = 0;
  }
  get level() { return Math.floor(clamp(this.s.heat, 0, 5.99)); }
  get active() { return this.phase === 'chase' || this.phase === 'search' || this.phase === 'cooldown' || this.phase === 'notice'; }

  allCars() { return [...this.patrols, ...this.units, ...this.blocks.flatMap(b => b.cars)]; }

  addHeat(amount, reason, hud) {
    const before = this.level;
    this.s.heat = clamp(this.s.heat + amount, 0, 5.99);
    this.decayHold = 25;
    if (this.level > before && hud) hud.radio(`Dispatch: Heat level ${this.level}. ${reason}`);
  }

  // Did any unit see the player this frame?
  detect(px, pz) {
    let seen = false;
    for (const c of this.allCars()) {
      const d = Math.hypot(c.x - px, c.z - pz);
      if (d < 115 && lineOfSight(this.map, c.x, c.z, px, pz)) { seen = true; break; }
    }
    if (!seen && this.heli) {
      const inTunnel = px > TUNNEL[0] && px < TUNNEL[1] && Math.abs(pz - HWY_Z) < HWY_W;
      if (!inTunnel && Math.hypot(this.heli.x - px, this.heli.z - pz) < 70) seen = true;
    }
    return seen;
  }

  // Where to bring a new unit in from: a precinct or a road point
  // 250-450 m away, off-screen.
  entryPoint(px, pz) {
    const prec = ['pspd_central', 'pspd_harbor'].map(id => LOC_BY_ID[id]).filter(l => Math.hypot(l.x - px, l.z - pz) < 900 && Math.hypot(l.x - px, l.z - pz) > 200);
    if (prec.length && Math.random() < 0.4) { const l = pick(prec); return { x: l.x, z: l.z }; }
    for (let i = 0; i < 40; i++) {
      const e = this.map.roads.edges[Math.floor(Math.random() * this.map.roads.edges.length)];
      const s = Math.random() * e.len;
      const x = e.ax + e.dx * s, z = e.az + e.dz * s;
      const d = Math.hypot(x - px, z - pz);
      if (d > 250 && d < 480) return { x, z };
    }
    return { x: px + 400, z: pz };
  }

  update(dt, w) {
    const p = w.player;              // { x, z, vx, vz, speed, h, inCar, vehicle }
    const roads = this.map.roads;
    const s = this.s;

    // ---- patrols (part of traffic) ----
    this.patrols = this.patrols.filter(c => Math.hypot(c.x - p.x, c.z - p.z) < 600);
    const wantPatrol = this.phase === 'none' ? (w.inCity ? 3 : 1) : 0;
    if (this.patrols.length < wantPatrol && Math.random() < dt * 0.5) {
      const c = w.traffic.spawnNear(p.x, p.z, 200, 450, { police: true, model: CAR_BY_ID[pick(PATROL_MODELS)] });
      if (c) { c.police = true; this.patrols.push(c); }
    }
    for (const c of this.patrols) c.update(dt, w.trafficCtx);

    // ---- detection ----
    this.seen = p.inCar ? this.detect(p.x, p.z) : false;
    if (this.seen) { this.lastSeen = { x: p.x, z: p.z, vx: p.vx, vz: p.vz }; this.unseenT = 0; }
    else this.unseenT += dt;

    // offences only count when a cop can see them (w.offence set by world)
    if (this.seen && w.offence) {
      this.addHeat(w.offence.heat, w.offence.text, w.hud);
      if (this.phase === 'none' || this.phase === 'search' || this.phase === 'cooldown') this.startChase(w);
    }

    // ---- state machine ----
    const lvl = this.level;
    if (this.phase === 'chase' || this.phase === 'notice') {
      if (this.seen && p.speed > 8) this.addHeat(dt * (this.phase === 'notice' ? 0.12 : 0.025), 'Suspect is fleeing.', w.hud);
      if (lvl >= 2 && this.phase === 'notice') { this.phase = 'chase'; w.hud.radio('All units: suspect failed to yield. Pursuit authorized.'); }
      if (this.unseenT > 7) {
        this.phase = 'search';
        this.searchR = 160 + lvl * 70;
        w.hud.radio(`Lost visual. Set up a search grid around ${w.streetAt(this.lastSeen.x, this.lastSeen.z) || 'last known'}.`);
      }
      // busted: stopped with a cop on top of you
      const near = this.units.some(u => Math.hypot(u.x - p.x, u.z - p.z) < 9) || this.patrols.some(u => Math.hypot(u.x - p.x, u.z - p.z) < 9);
      if (p.inCar && p.speed < 1.5 && near) this.bustT += dt; else this.bustT = Math.max(0, this.bustT - dt * 2);
      if (this.bustT > (this.phase === 'notice' ? 2.5 : 3.5)) { this.busted(w); return; }
    } else if (this.phase === 'search') {
      const d = Math.hypot(p.x - this.lastSeen.x, p.z - this.lastSeen.z);
      if (d > this.searchR) { this.phase = 'cooldown'; this.cooldown = 14 + lvl * 5; }
    } else if (this.phase === 'cooldown') {
      const d = Math.hypot(p.x - this.lastSeen.x, p.z - this.lastSeen.z);
      if (d < this.searchR * 0.9) this.phase = 'search';
      this.cooldown -= dt;
      if (this.cooldown <= 0) this.escaped(w);
    } else if (this.phase === 'none') {
      // heat cools off slowly once nobody is looking for you
      this.decayHold -= dt;
      if (this.decayHold <= 0 && s.heat > 0) s.heat = Math.max(0, s.heat - dt * 0.03);
    }

    // ---- dispatch ----
    const want = this.phase === 'none' ? 0 : this.phase === 'notice' ? 1 : UNIT_COUNT[Math.max(1, lvl)];
    if (this.units.length < want && Math.random() < dt * 0.8) {
      const ep = this.entryPoint(p.x, p.z);
      const model = CAR_BY_ID[lvl >= 3 && Math.random() < 0.5 ? pick(INTERCEPTORS) : pick(PATROL_MODELS)];
      const u = new Unit(model, ep.x, ep.z, Math.atan2(p.x - ep.x, -(p.z - ep.z)));
      this.units.push(u);
      if (Math.random() < 0.5) w.hud.radio(`Unit ${u.id} responding, ${Math.round(Math.hypot(ep.x - p.x, ep.z - p.z) / 1609 * 60 / 50 * 60)}s out.`);
    }
    if (this.phase === 'none') {
      // units drive off and disappear once out of sight
      this.units = this.units.filter(u => Math.hypot(u.x - p.x, u.z - p.z) < 300);
    }
    for (const u of this.units) this.driveUnit(u, dt, w, lvl);

    // ---- roadblocks + spikes (level 4+) ----
    this.blockT -= dt;
    if (this.phase === 'chase' && lvl >= 4 && this.blockT <= 0 && p.speed > 15) { this.placeRoadblock(w); this.blockT = 28; }
    this.blocks = this.blocks.filter(b => Math.hypot(b.x - p.x, b.z - p.z) < 700 && (b.life -= dt) > 0);

    // ---- helicopter (level 5) ----
    if (lvl >= 5 && this.phase !== 'none' && !this.heli) {
      const ep = this.entryPoint(p.x, p.z);
      this.heli = { x: ep.x, z: ep.z, rot: 0 };
      w.hud.radio('Air One overhead. Spotlight on.');
    }
    if (this.heli) {
      const tx = this.phase === 'chase' && this.lastSeen ? p.x : (this.lastSeen?.x ?? p.x) + Math.cos(performance.now() / 3000) * this.searchR * 0.6;
      const tz = this.phase === 'chase' && this.lastSeen ? p.z : (this.lastSeen?.z ?? p.z) + Math.sin(performance.now() / 3000) * this.searchR * 0.6;
      const dx = tx - this.heli.x, dz = tz - this.heli.z, d = Math.hypot(dx, dz);
      const sp = Math.min(d, 42 * dt);
      if (d > 0.1) { this.heli.x += dx / d * sp; this.heli.z += dz / d * sp; }
      this.heli.rot += dt * 25;
      if (this.phase === 'none' || lvl < 5) { this.heli.leave = (this.heli.leave || 0) + dt; if (this.heli.leave > 6) this.heli = null; }
    }

    // ---- chatter ----
    this.chatterT -= dt;
    if (this.active && this.chatterT <= 0) {
      this.chatterT = 7 + Math.random() * 6;
      const street = w.streetAt(p.x, p.z);
      const lines = this.phase === 'chase'
        ? [`Suspect ${p.carName} ${dirWord(p.vx, p.vz)} on ${street || 'unknown'}.`, `Speed ${Math.round(p.speed * 2.237)} mph, reckless.`, `Unit ${this.units[0]?.id || 14}, box them in.`, 'Watch the intersections, civilian traffic.']
        : [`Units, sweep ${w.districtAt(this.lastSeen?.x ?? p.x, this.lastSeen?.z ?? p.z)}.`, 'Check the parking lots and alleys.', 'Anyone have eyes on the suspect vehicle?'];
      w.hud.radio(pick(lines));
    }
  }

  startChase(w) {
    if (this.phase === 'none') {
      this.phase = this.level >= 2 ? 'chase' : 'notice';
      w.hud.radio(this.phase === 'notice' ? 'PSPD: Pull over! (Stop to take the ticket, or run.)' : 'Pursuit initiated.');
      w.audio.siren(true, 0.6);
      w.audio.music('pursuit');
    } else {
      this.phase = 'chase';
      w.hud.radio('Eyes back on the suspect!');
    }
    this.unseenT = 0;
  }

  driveUnit(u, dt, w, lvl) {
    const p = w.player;
    const roads = this.map.roads;
    // choose target
    let tx, tz, chasing = false;
    const dToP = Math.hypot(p.x - u.x, p.z - u.z);
    if ((this.phase === 'chase' || this.phase === 'notice') && this.lastSeen) {
      if (dToP < 160 && lineOfSight(this.map, u.x, u.z, p.x, p.z)) {
        tx = p.x + p.vx * 0.6; tz = p.z + p.vz * 0.6; chasing = true;
      } else { const wp = this.waypoint(u, this.lastSeen.x, this.lastSeen.z); tx = wp.x; tz = wp.z; }
    } else if ((this.phase === 'search' || this.phase === 'cooldown') && this.lastSeen) {
      if (!u.searchPt || Math.hypot(u.searchPt.x - u.x, u.searchPt.z - u.z) < 15) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * this.searchR;
        const rp = roads.nearestOnRoad(this.lastSeen.x + Math.cos(a) * r, this.lastSeen.z + Math.sin(a) * r);
        u.searchPt = { x: rp.x, z: rp.z };
      }
      const wp = this.waypoint(u, u.searchPt.x, u.searchPt.z); tx = wp.x; tz = wp.z;
    } else {
      // leaving: head away from the player
      tx = u.x + (u.x - p.x); tz = u.z + (u.z - p.z);
    }
    // steer
    const want = Math.atan2(tx - u.x, -(tz - u.z));
    let dh = want - u.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    const turn = clamp(dh, -2.4 * dt, 2.4 * dt);
    if (u.backup > 0) { u.backup -= dt; u.v = -6; u.h -= turn; }
    else {
      u.h += turn;
      const top = (chasing ? 34 + lvl * 4 : 26) * (this.phase === 'cooldown' ? 0.7 : 1);
      let target = top * (1 - Math.min(0.75, Math.abs(dh) / 1.4));
      if (chasing && dToP < 14) target = Math.max(p.speed - 1, 6);
      u.v += clamp(target - u.v, -14 * dt, 9 * dt);
    }
    u.x += Math.sin(u.h) * u.v * dt;
    u.z += -Math.cos(u.h) * u.v * dt;
    // walls
    const hit = collideCircle(this.map, u.x, u.z, u.dims.W / 2 + 0.6);
    if (hit) { u.x += hit.nx * hit.pen; u.z += hit.nz * hit.pen; u.v *= 0.8; }
    if (Math.abs(u.v) < 1.2 && this.phase !== 'none') u.stuck += dt; else u.stuck = 0;
    if (u.stuck > 1.6) { u.backup = 1.1; u.stuck = 0; }
  }

  // Next point along the road graph towards (x, z).
  waypoint(u, x, z) {
    const roads = this.map.roads;
    if (Math.hypot(x - u.x, z - u.z) < 90 && lineOfSight(this.map, u.x, u.z, x, z)) return { x, z };
    const now = performance.now();
    if (!u.route || now - u.routeT > 1500 || u.routeGoal !== `${Math.round(x / 50)},${Math.round(z / 50)}`) {
      const a = roads.nearestNode(u.x, u.z), b = roads.nearestNode(x, z);
      u.route = roads.route(a.id, b.id) || [b.id];
      u.routeT = now; u.routeGoal = `${Math.round(x / 50)},${Math.round(z / 50)}`;
    }
    while (u.route.length > 1) {
      const n = roads.nodes[u.route[0]];
      if (Math.hypot(n.x - u.x, n.z - u.z) < 14) u.route.shift(); else break;
    }
    const n = roads.nodes[u.route[0]];
    return Math.hypot(n.x - u.x, n.z - u.z) < 14 ? { x, z } : { x: n.x, z: n.z };
  }

  placeRoadblock(w) {
    const p = w.player;
    const f = { x: p.vx / (p.speed || 1), z: p.vz / (p.speed || 1) };
    const ahead = this.map.roads.nearestOnRoad(p.x + f.x * 260, p.z + f.z * 260);
    if (!ahead || ahead.dist > 60) return;
    const e = ahead.edge;
    const cx = ahead.x, cz = ahead.z;
    const rx = -e.dz, rz = e.dx;    // across the road
    const half = e.width / 2;
    const cars = [];
    for (const off of [-half + 3, half - 3]) {
      const u = new Unit(CAR_BY_ID[pick(PATROL_MODELS)], cx + rx * off, cz + rz * off, Math.atan2(rx, -rz));
      u.mode = 'block'; cars.push(u);
    }
    const spikes = { x: cx, z: cz, len: e.width - 10, ax: rx, az: rz };
    this.blocks.push({ x: cx, z: cz, cars, spikes, life: 60, hitSpikes: false });
    w.hud.radio(`Roadblock set on ${e.name}. Spike strips deployed.`);
  }

  // Spike strip + roadblock car collisions with the player.
  checkBlocks(w, veh) {
    for (const b of this.blocks) {
      for (const c of b.cars) {
        const d = Math.hypot(c.x - veh.x, c.z - veh.z);
        if (d < 4.2) {
          const nx = (veh.x - c.x) / (d || 1), nz = (veh.z - c.z) / (d || 1);
          const imp = veh.bounce(nx, nz, 4.2 - d);
          if (imp > 2) w.onCrash(imp, 'roadblock');
        }
      }
      const sp = b.spikes;
      const dx = veh.x - sp.x, dz = veh.z - sp.z;
      const along = dx * sp.ax + dz * sp.az;
      const across = Math.abs(dx * -sp.az + dz * sp.ax);
      if (!b.hitSpikes && Math.abs(along) < sp.len / 2 && across < 1.5) {
        b.hitSpikes = true;
        w.onSpikes();
      }
    }
  }

  busted(w) {
    const lvl = Math.max(1, this.level);
    const fine = this.phase === 'notice' ? 250 : 400 * lvl + 250 * (lvl - 1) ** 2;
    w.onBusted(fine, this.phase === 'notice');
    this.reset(w);
  }
  escaped(w) {
    w.onEscaped();
    this.phase = 'none';
    this.decayHold = 20;
    w.audio.siren(false);
    w.audio.music(null);
  }
  reset(w) {
    this.phase = 'none';
    this.s.heat = 0;
    this.units = [];
    this.blocks = [];
    this.heli = null;
    this.bustT = 0;
    w.audio.siren(false);
    w.audio.music(null);
  }
  // Getting home while they're searching ends it.
  safehouse(w) {
    if (this.phase === 'search' || this.phase === 'cooldown') { this.escaped(w); this.units = []; return true; }
    return false;
  }
}

function dirWord(vx, vz) {
  if (Math.abs(vx) > Math.abs(vz)) return vx > 0 ? 'eastbound' : 'westbound';
  return vz > 0 ? 'southbound' : 'northbound';
}

export { Unit };
