// Fort Worth PD. Patrol cars drive the streets like traffic. When they see
// you break the law, heat rises; pursuit units drive in from the precincts
// and the edge of the area (nobody teleports next to you), search where you
// were last seen, set roadblocks and spike strips at level 4 and bring the
// helicopter at level 5.

import { CAR_BY_ID } from '../data/cars.js';
import { carSprite, dimsFor } from '../gfx2d/carSprite.js';
import { TrafficCar } from './traffic.js';
import { collideCircle, lineOfSight } from './map.js';
import { LOC_BY_ID, TUNNEL, HWY_Z, HWY_W } from '../data/world.js';
import { LEGAL_DB, hearingRange } from '../sim/sound.js';

const PATROL_MODELS = ['ford_crown_victoria_police_interceptor_2003', 'dodge_charger_scat_pack_2015', 'ford_explorer_xlt_2002', 'chevrolet_tahoe_lt_2007'];
const INTERCEPTORS = ['dodge_charger_srt_hellcat_redeye_2021', 'ford_mustang_gt_s650_2024', 'chevrolet_camaro_ss_2016'];
const UNIT_COUNT = [0, 1, 2, 4, 6, 8];
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Air One's orbit radius and the ring it never comes inside, in metres.
const HELI_ORBIT = 32, HELI_KEEPOUT = 24;

let unitSeq = 12;

class Unit {
  constructor(model, x, z, h) {
    this.model = model;
    this.dims = dimsFor(model);
    this.sprite = carSprite(model, { paint: '#f2f2f2' }, {}, null, { police: true });
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
    this.noiseAtt = 0;   // 0..1: how much attention a loud exhaust has drawn
    this.gunHeat = 0;    // shots fired recently
    this.suspicion = 0;  // builds while a cop watches you speed or burn rubber; a chase starts when it fills
    this.record = [];    // what you did since the last stop: [{ kind, text, fine }]
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
  detect(px, pz, range = 115) {
    let seen = false;
    for (const c of this.allCars()) {
      const d = Math.hypot(c.x - px, c.z - pz);
      if (d < range && lineOfSight(this.map, c.x, c.z, px, pz)) { seen = true; break; }
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
    const wantPatrol = this.phase === 'none' ? (w.inCity ? 2 : 1) : 0;
    if (this.patrols.length < wantPatrol && Math.random() < dt * 0.25) {
      const c = w.traffic.spawnNear(p.x, p.z, 200, 450, { police: true, model: CAR_BY_ID[pick(PATROL_MODELS)] });
      if (c) { c.police = true; this.patrols.push(c); }
    }
    for (const c of this.patrols) c.update(dt, w.trafficCtx);

    // ---- detection ----
    const watchable = p.inCar || !!w.combat?.armed || !!w.combat?.rob;
    this.seen = watchable ? this.detect(p.x, p.z) : false;
    if (this.seen) { this.lastSeen = { x: p.x, z: p.z, vx: p.vx, vz: p.vz }; this.unseenT = 0; }
    else this.unseenT += dt;

    // Offences only count when a cop is close enough to actually see them.
    // Speeding and burnouts have to go on for a few seconds before anyone
    // reacts; running a light or hitting something gets noticed at once.
    const witnessed = watchable && (this.phase !== 'none' ? this.seen : this.detect(p.x, p.z, 65));
    const o = w.offence;
    if (witnessed && o) {
      const gradual = o.kind === 'speeding' || o.kind === 'burnout' || o.kind === 'brandish';
      if (this.phase === 'none' && gradual) {
        this.suspicion += o.heat;
        this.suspicionHold = 2;
        if (this.suspicion >= 1) {
          this.suspicion = 0;
          this.addHeat(o.kind === 'brandish' ? 0.6 : o.heat, o.text, w.hud); this.note(o); this.startChase(w, o.kind === 'brandish');
        }
      } else {
        this.addHeat(o.heat, o.text, w.hud);
        this.note(o);
        if (this.phase === 'none' || this.phase === 'search' || this.phase === 'cooldown') this.startChase(w, o.kind === 'robbery' || o.kind === 'assault');
      }
    } else if (this.suspicion > 0) {
      this.suspicionHold = (this.suspicionHold || 0) - dt;
      if (this.suspicionHold <= 0) this.suspicion = Math.max(0, this.suspicion - dt * 0.3);
    }

    this.gunHeat = Math.max(0, this.gunHeat - dt * 0.25);
    this.hear(dt, w);

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
      if ((p.inCar || w.combat?.armed) && p.speed < 1.5 && near) this.bustT += dt; else this.bustT = Math.max(0, this.bustT - dt * 2);
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
    // Air One circles the target like a real pursuit helicopter: it holds an
    // orbit around the player (or the search area) and keeps its spotlight on
    // the target, but never flies over the car and hides it from view.
    if (lvl >= 5 && this.phase !== 'none' && !this.heli) {
      const ep = this.entryPoint(p.x, p.z);
      this.heli = { x: ep.x, z: ep.z, rot: 0, spot: { x: p.x, z: p.z } };
      w.hud.radio('Air One overhead. Spotlight on.');
    }
    if (this.heli) {
      const hl = this.heli, chase = this.phase === 'chase' && this.lastSeen;
      const t = performance.now() / 3000;
      // where the light should be: on the car in a chase, sweeping the search area otherwise
      const sx = chase ? p.x : (this.lastSeen?.x ?? p.x) + Math.cos(t) * this.searchR * 0.6;
      const sz = chase ? p.z : (this.lastSeen?.z ?? p.z) + Math.sin(t) * this.searchR * 0.6;
      const sd = Math.hypot(sx - hl.spot.x, sz - hl.spot.z), ssp = Math.min(sd, 60 * dt);
      if (sd > 0.1) { hl.spot.x += (sx - hl.spot.x) / sd * ssp; hl.spot.z += (sz - hl.spot.z) / sd * ssp; }
      // the orbit is centred on the player in a chase, on the light while searching
      const cx = chase ? p.x : hl.spot.x, cz = chase ? p.z : hl.spot.z;
      // fly by heading: close in (or back off) to the orbit radius while
      // circling, plus the car's own motion so it keeps pace without ever
      // cutting across the middle of the circle
      const ox0 = hl.x - cx, oz0 = hl.z - cz, pd = Math.hypot(ox0, oz0) || 0.01;
      const rx = ox0 / pd, rz = oz0 / pd;                  // outward from the centre
      const vr = clamp((HELI_ORBIT - pd) * 1.5, -200, 30);  // radial correction
      const vt = HELI_ORBIT * 0.35;                         // slow circle
      let vx = rx * vr - rz * vt + (chase ? p.vx || 0 : 0), vz = rz * vr + rx * vt + (chase ? p.vz || 0 : 0);
      const v = Math.hypot(vx, vz), vmax = Math.max(42, (p.speed || 0) + 25);
      if (v > vmax) { vx *= vmax / v; vz *= vmax / v; }
      hl.x += vx * dt; hl.z += vz * dt;
      // hard rule: never closer to the player than the keep-out ring
      const ox = hl.x - p.x, oz = hl.z - p.z, od = Math.hypot(ox, oz);
      if (od < HELI_KEEPOUT) {
        const a = od > 0.01 ? Math.atan2(oz, ox) : 0;
        hl.x = p.x + Math.cos(a) * HELI_KEEPOUT; hl.z = p.z + Math.sin(a) * HELI_KEEPOUT;
      }
      hl.rot += dt * 25;
      if (this.phase === 'none' || lvl < 5) { hl.leave = (hl.leave || 0) + dt; if (hl.leave > 6) this.heli = null; }
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

  // Keep the worst of each kind of offence for the ticket.
  note(o) {
    if (!o.kind) return;
    const have = this.record.find(r => r.kind === o.kind);
    if (!have) this.record.push({ kind: o.kind, text: o.text, fine: o.fine || 250 });
    else if ((o.fine || 0) > have.fine) { have.fine = o.fine; have.text = o.text; }
  }

  // Loud exhausts get noticed. Anyone within earshot (no line of sight needed)
  // starts paying attention; once it fills up, a patrol nearby pulls you over,
  // or dispatch sends a unit to the noise complaint.
  hear(dt, w) {
    const p = w.player;
    const db = p.inCar ? (w.liveDb || 0) : 0;
    if (!(db > LEGAL_DB) || this.phase === 'chase') { this.noiseAtt = Math.max(0, this.noiseAtt - dt * 0.25); return; }
    const range = hearingRange(db);
    const near = this.allCars().some(c => Math.hypot(c.x - p.x, c.z - p.z) < range);
    const over = (db - LEGAL_DB) / 10;
    this.noiseAtt = Math.min(1.2, this.noiseAtt + dt * 0.05 * (0.6 + over) * (near ? 1 : 0.12));
    if (this.noiseAtt < 1) return;
    this.noiseAtt = 0;
    if (this.phase !== 'none') { this.note({ kind: 'noise', text: `Excessive exhaust noise — ${Math.round(db)} dB (limit ${LEGAL_DB}).`, fine: 400 }); return; }
    this.note({ kind: 'noise', text: `Excessive exhaust noise — ${Math.round(db)} dB (limit ${LEGAL_DB}).`, fine: 400 });
    this.s.heat = Math.max(this.s.heat, 0.2);
    this.lastSeen = { x: p.x, z: p.z, vx: p.vx, vz: p.vz };
    const street = w.streetAt(p.x, p.z);
    w.hud.radio(near ? `That exhaust is way too loud${street ? ' on ' + street : ''}. Pulling them over.` : `Dispatch: noise complaint — loud exhaust${street ? ' on ' + street : ''}. Unit responding.`);
    this.startChase(w);
    this.unseenT = near ? 0 : -18;   // a unit coming from across town gets time to arrive
  }

  startChase(w, force = false) {
    if (this.phase === 'none') {
      this.phase = force || this.level >= 2 ? 'chase' : 'notice';
      w.hud.radio(this.phase === 'notice' ? 'FWPD: Pull over! (Stop to take the ticket, or run.)' : 'Pursuit initiated.');
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

  // A shot was fired (kind 'hit' when it struck someone). Anyone within earshot
  // reports it; dispatch doesn't need to see you.
  gunshot(w, kind = 'shot', melee = false, auto = false) {
    if (auto) this.note({ kind: 'auto', text: 'Possession and use of a machine gun (FRT / full-auto conversion).', fine: 15000 });
    this.gunHeat += kind === 'hit' ? 1 : 0.4;
    if (this.gunHeat < 0.8) return;
    this.gunHeat = 0;
    const p = w.player;
    this.addHeat(kind === 'hit' ? 1.2 : 0.7, melee ? 'Assault reported.' : 'Shots fired!', w.hud);
    this.note({ kind: 'shots', text: melee ? 'Assault with a weapon.' : 'Discharging a firearm in public.', fine: kind === 'hit' ? 4000 : 1800 });
    this.lastSeen = { x: p.x, z: p.z, vx: 0, vz: 0 };
    if (this.phase === 'none') {
      const near = this.allCars().some(c => Math.hypot(c.x - p.x, c.z - p.z) < 160);
      this.startChase(w, true);
      this.unseenT = near ? 0 : -10;
    } else if (this.phase === 'search' || this.phase === 'cooldown') this.startChase(w, true);
  }

  // Silent alarm / 911 call from a robbery: units head for the spot.
  dispatchRobbery(w, loc, mugging = false) {
    const p = w.player;
    if (!mugging) w.hud.radio(`Dispatch: 211 in progress at ${loc.name}. Silent alarm. All units respond.`);
    else w.hud.radio('Dispatch: caller reports an armed mugging. Units responding.');
    this.addHeat(mugging ? 0.9 : 1.6, 'Armed robbery.', w.hud);
    this.note({ kind: 'robbery', text: mugging ? 'Armed mugging.' : `Armed robbery — ${loc.name}.`, fine: mugging ? 4000 : 6000 });
    this.lastSeen = { x: loc.x ?? p.x, z: loc.z ?? p.z, vx: 0, vz: 0 };
    if (this.phase === 'none' || this.phase === 'search' || this.phase === 'cooldown') { this.startChase(w, true); this.unseenT = -8; }
  }

  busted(w) {
    const lvl = Math.max(1, this.level);
    if (this.phase === 'notice') {
      // you pulled over: a proper traffic stop
      const record = this.record.length ? this.record : [{ kind: 'reckless', text: 'Failure to maintain safe driving.', fine: 250 }];
      w.onTrafficStop(record);
    } else {
      w.onBusted(400 * lvl + 250 * (lvl - 1) ** 2, false, this.record.slice());
    }
    this.reset(w);
  }
  escaped(w) {
    this.record = [];
    w.onEscaped();
    this.phase = 'none';
    this.decayHold = 20;
    w.audio.siren(false);
    w.audio.music(null);
  }
  reset(w) {
    this.phase = 'none';
    this.record = []; this.noiseAtt = 0;
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
