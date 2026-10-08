// Fort Worth PD. Patrol cars drive the streets like traffic. When they see
// you break the law, heat rises; pursuit units drive in from the precincts
// and the edge of the area (nobody teleports next to you), search where you
// were last seen, and set roadblocks and spike strips at level 4. There is no
// helicopter: you can always lose them.
//
// Traffic stops: when a cop lights you up you get PULL_OVER_S seconds to stop.
// Stop in time and the unit parks behind you, the officer walks up to your
// window and hands you the ticket. Drive off at any point before you take it
// (or never stop at all) and it's a chase.

import { CAR_BY_ID } from '../data/cars.js';
import { carSprite, dimsFor } from '../gfx2d/carSprite.js';
import { TrafficCar } from './traffic.js';
import { collideCircle, lineOfSight } from './map.js';
import { LOC_BY_ID, TUNNEL, HWY_Z, HWY_W } from '../data/world.js';
import { LEGAL_DB, hearingRange } from '../sim/sound.js';
import { hasWarrant, hasFelony } from '../core/warrants.js';
import { concealment, masked } from '../core/disguise.js';
import { wx, extraPatrols, extraUnits } from '../core/weather.js';

const PATROL_MODELS = ['ford_crown_victoria_police_interceptor_2003', 'dodge_charger_scat_pack_2015', 'ford_explorer_xlt_2002', 'chevrolet_tahoe_lt_2007'];
const INTERCEPTORS = ['dodge_charger_srt_hellcat_redeye_2021', 'ford_mustang_gt_s650_2024', 'chevrolet_camaro_ss_2016'];
const UNIT_COUNT = [0, 1, 2, 4, 6, 8];
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Traffic stop: seconds to pull over, how long you have to sit still to count
// as stopped, where the unit parks behind you, how far you can roll before
// it counts as driving off, and the officer's walking pace (m/s).
export const PULL_OVER_S = 10;
const STOP_STILL = 0.6, PARK_BEHIND = 8, FLEE_DIST = 4, OFFICER_PACE = 1.9;
export const OFFICER_LOOK = { top: '#1c2c55', skin: '#8d5a3b', hair: '#111' };

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
    this.phase = 'none'; // none | notice | stop | chase | search | cooldown
    this.pullT = 0;      // notice: seconds left to pull over
    this.stillT = 0;     // notice: how long you've been sitting still
    this.stop = null;    // stop: { x, z, h, unit, step: 'approach'|'walk'|'ticket', officer, t }
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
    this.recognise = 0;  // 0..1: a patrol running your plate / looking at your face while you have a warrant
    this.eyesOn = false; // an officer has actually seen you during this pursuit
    this.disguise = 0;   // 0..1: how hard you are to recognise right now (on foot, core/disguise.js)
    this.chaseDisguise = 1; // the least disguised they saw you during this pursuit
    this.footOnly = true;   // this pursuit never saw you in a car (no plate to run)
    this.maskSus = 0;    // 0..1: a patrol watching someone walk around in a ski mask
    this.maskStopAt = -99;
  }
  get level() { return Math.floor(clamp(this.s.heat, 0, 5.99)); }
  get active() { return this.phase !== 'none'; }
  // The officer on foot during a traffic stop, for drawing.
  get officer() { return this.stop?.officer || null; }

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
    // the night shift puts more cars out, and they show up faster
    const night = extraPatrols(s.time);
    const wantPatrol = this.phase === 'none' ? (w.inCity ? 2 : 1) + night : 0;
    if (this.patrols.length < wantPatrol && Math.random() < dt * (0.25 + night * 0.15)) {
      const c = w.traffic.spawnNear(p.x, p.z, 200, 450, { police: true, model: CAR_BY_ID[pick(PATROL_MODELS)] });
      if (c) { c.police = true; this.patrols.push(c); }
    }
    for (const c of this.patrols) c.update(dt, w.trafficCtx);

    // ---- detection ----
    // With a warrant out, officers have your plate and your photo: they look
    // harder (longer detection range) and recognise you even on foot.
    const wanted = hasWarrant(s);
    const look = s.player?.look;
    this.disguise = p.inCar ? 0 : concealment(look, (w.darkness?.() || 0) > 0.4);
    const watchable = p.inCar || !!w.combat?.armed || !!w.combat?.rob || (wanted && this.phase !== 'none');
    // rain, storms and fog cut how far an officer can make you out
    this.seen = watchable ? this.detect(p.x, p.z, (wanted ? 140 : 115) * wx(s).sight) : false;
    if (this.seen) {
      this.lastSeen = { x: p.x, z: p.z, vx: p.vx, vz: p.vz }; this.unseenT = 0;
      if (this.phase !== 'none') { this.eyesOn = true; this.chaseDisguise = Math.min(this.chaseDisguise, this.disguise); if (p.inCar) this.footOnly = false; }
    }
    else this.unseenT += dt;
    if (this.phase === 'none') this.recognition(dt, w, wanted);
    if (this.phase === 'none') this.maskWatch(dt, w, look);

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
        if (this.phase === 'stop') this.fled(w);
        else if (this.phase === 'none' || this.phase === 'search' || this.phase === 'cooldown') this.startChase(w, o.kind === 'robbery' || o.kind === 'assault');
      }
    } else if (this.suspicion > 0) {
      this.suspicionHold = (this.suspicionHold || 0) - dt;
      if (this.suspicionHold <= 0) this.suspicion = Math.max(0, this.suspicion - dt * 0.3);
    }

    this.gunHeat = Math.max(0, this.gunHeat - dt * 0.25);
    this.hear(dt, w);

    // ---- state machine ----
    const lvl = this.level;
    if (this.phase === 'notice') {
      // lit up: pull over within the countdown or it turns into a chase. The
      // clock only runs once a cop is actually behind you (a unit sent to a
      // noise complaint across town has to get there first).
      if (this.allCars().some(c => Math.hypot(c.x - p.x, c.z - p.z) < 150)) this.pullT -= dt;
      this.stillT = p.inCar && p.speed < 1.5 ? this.stillT + dt : 0;
      if (this.stillT >= STOP_STILL) this.beginStop(w);
      else if (this.pullT <= 0 || lvl >= 2) this.failedToYield(w);
      else if (this.unseenT > 7) {
        this.phase = 'search';
        this.searchR = 160 + lvl * 70;
        w.hud.radio(`Lost visual. Set up a search grid around ${w.streetAt(this.lastSeen.x, this.lastSeen.z) || 'last known'}.`);
      }
    } else if (this.phase === 'stop' && this.stop) {
      this.updateStop(dt, w);
    }
    if (this.phase === 'chase') {
      if (this.seen && p.speed > 8) this.addHeat(dt * 0.025, 'Suspect is fleeing.', w.hud);
      if (this.unseenT > 7) {
        this.phase = 'search';
        this.searchR = 160 + lvl * 70;
        w.hud.radio(`Lost visual. Set up a search grid around ${w.streetAt(this.lastSeen.x, this.lastSeen.z) || 'last known'}.`);
      }
      // busted: stopped with a cop on top of you
      const near = this.units.some(u => Math.hypot(u.x - p.x, u.z - p.z) < 9) || this.patrols.some(u => Math.hypot(u.x - p.x, u.z - p.z) < 9);
      if ((p.inCar || w.combat?.armed) && p.speed < 1.5 && near) this.bustT += dt; else this.bustT = Math.max(0, this.bustT - dt * 2);
      if (this.bustT > 3.5) { this.busted(w); return; }
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
    const want = this.phase === 'none' ? 0 : this.phase === 'notice' || this.phase === 'stop' ? 1 : UNIT_COUNT[Math.max(1, lvl)] + (lvl >= 2 ? extraUnits(s.time) : 0);
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
    if (this.phase === 'stop' && this.stop && !this.stop.unit && this.units.length) this.stop.unit = this.nearestUnit(this.stop.x, this.stop.z);
    for (const u of this.units) if (!(this.phase === 'stop' && u === this.stop?.unit)) this.driveUnit(u, dt, w, lvl);

    // ---- roadblocks + spikes (level 4+) ----
    this.blockT -= dt;
    if (this.phase === 'chase' && lvl >= 4 && this.blockT <= 0 && p.speed > 15) { this.placeRoadblock(w); this.blockT = 28; }
    this.blocks = this.blocks.filter(b => Math.hypot(b.x - p.x, b.z - p.z) < 700 && (b.life -= dt) > 0);

    // ---- chatter ----
    this.chatterT -= dt;
    if ((this.phase === 'chase' || this.phase === 'search' || this.phase === 'cooldown') && this.chatterT <= 0) {
      this.chatterT = 7 + Math.random() * 6;
      const street = w.streetAt(p.x, p.z);
      const lines = this.phase === 'chase'
        ? [`Suspect ${p.carName} ${dirWord(p.vx, p.vz)} on ${street || 'unknown'}.`, `Speed ${Math.round(p.speed * 2.237)} mph, reckless.`, `Unit ${this.units[0]?.id || 14}, box them in.`, 'Watch the intersections, civilian traffic.']
        : [`Units, sweep ${w.districtAt(this.lastSeen?.x ?? p.x, this.lastSeen?.z ?? p.z)}.`, 'Check the parking lots and alleys.', 'Anyone have eyes on the suspect vehicle?'];
      w.hud.radio(pick(lines));
    }
  }

  // A patrol near you runs your plate (in a car) or recognises your face (on
  // foot, closer). Takes a few seconds of being watched; a felony warrant is
  // a felony stop, everything else starts as a pull-over.
  recognition(dt, w, wanted) {
    if (!wanted) { this.recognise = 0; return; }
    const p = w.player;
    // a covered face can't be matched to a mugshot; a plate always can
    const range = p.inCar ? 70 : masked(this.s.player?.look) ? 0 : 28 * (1 - this.disguise);
    if (range < 5) { this.recognise = Math.max(0, this.recognise - dt * 0.2); return; }
    const near = this.patrols.some(c => Math.hypot(c.x - p.x, c.z - p.z) < range && lineOfSight(this.map, c.x, c.z, p.x, p.z));
    this.recognise = near ? this.recognise + dt / (p.inCar ? 2.5 : 4) : Math.max(0, this.recognise - dt * 0.2);
    if (this.recognise < 1) return;
    this.recognise = 0;
    const felony = hasFelony(this.s);
    this.s.heat = Math.max(this.s.heat, felony ? 2 : 1);
    this.lastSeen = { x: p.x, z: p.z, vx: p.vx, vz: p.vz };
    w.hud.radio(p.inCar ? `Plate hit: ${felony ? 'felony' : 'active'} warrant on file.` : `Subject on foot matches a ${felony ? 'felony ' : ''}warrant.`);
    this.startChase(w, felony);
    this.eyesOn = true;
  }

  // Someone walking around in a ski mask with no reason to: a patrol that
  // watches it for a few seconds pulls up and questions them (world.onMaskStop).
  maskWatch(dt, w, look) {
    const p = w.player;
    const busy = p.inCar || !masked(look) || w.combat?.rob || w.combat?.mug || w.t - this.maskStopAt < 45;
    const near = !busy && this.patrols.some(c => Math.hypot(c.x - p.x, c.z - p.z) < 35 && lineOfSight(this.map, c.x, c.z, p.x, p.z));
    this.maskSus = near ? this.maskSus + dt / 4 : Math.max(0, this.maskSus - dt * 0.3);
    if (this.maskSus < 1) return;
    this.maskSus = 0; this.maskStopAt = w.t;
    w.hud.radio(`Unit ${this.patrols[0]?.id || 14}: out with a subject in a ski mask on ${w.streetAt(p.x, p.z) || 'foot'}.`);
    w.onMaskStop?.();
  }

  // Keep the worst of each kind of offence for the ticket. A crime done on
  // foot remembers how disguised you were (the least, if you did it twice):
  // that decides whether the warrant can name you.
  note(o) {
    if (!o.kind) return;
    const conceal = o.kind === 'noise' ? 0 : (o.conceal ?? this.disguise);   // a store camera remembers how you looked
    const have = this.record.find(r => r.kind === o.kind);
    if (!have) this.record.push({ kind: o.kind, text: o.text, fine: o.fine || 250, conceal });
    else {
      if ((o.fine || 0) > have.fine) { have.fine = o.fine; have.text = o.text; }
      have.conceal = Math.min(have.conceal ?? 0, conceal);
    }
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
      this.eyesOn = this.seen;
      this.chaseDisguise = this.seen ? this.disguise : 1;
      this.footOnly = !w.player.inCar;
      this.phase = force || this.level >= 2 ? 'chase' : 'notice';
      if (this.phase === 'notice') {
        this.pullT = PULL_OVER_S; this.stillT = 0;
        this.takePatrol(w.player);
      }
      w.hud.radio(this.phase === 'notice' ? `Pull over! You have ${PULL_OVER_S} seconds.` : 'Pursuit initiated.');
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

  // Somebody died. Witnesses call it in whether or not a unit saw it. Two
  // bodies (or a cop) makes it capital murder. Murder is life.
  homicide(w, { officer = false } = {}) {
    this.kills = (this.kills || 0) + 1;
    const p = w.player, street = w.streetAt?.(p.x, p.z);
    const capital = officer || this.kills >= 2;
    this.note(capital
      ? { kind: officer ? 'capital_murder_po' : 'capital_murder', text: officer ? 'Capital murder of a peace officer.' : 'Capital murder (more than one person killed).', fine: 100000 }
      : { kind: 'murder', text: `Murder${street ? ' on ' + street : ''}.`, fine: 50000 });
    this.addHeat(2.2 * this.vague(), capital ? 'Multiple homicide. All units.' : 'Homicide. Suspect is armed.', w.hud);
    w.hud.radio(`Dispatch: shooting victim down${street ? ' on ' + street : ''}. It's a homicide now.`);
    this.lastSeen = { x: p.x, z: p.z, vx: 0, vz: 0 };
    if (this.phase === 'stop') this.fled(w);
    else this.startChase(w, true);
  }

  // A shot was fired (kind 'hit' when it struck someone). Anyone within earshot
  // reports it; dispatch doesn't need to see you.
  gunshot(w, kind = 'shot', melee = false, auto = false) {
    if (auto) this.note({ kind: 'auto', text: 'Possession and use of a machine gun (FRT / full-auto conversion).', fine: 15000 });
    this.gunHeat += kind === 'hit' ? 1 : 0.4;
    if (this.gunHeat < 0.8) return;
    this.gunHeat = 0;
    const p = w.player;
    this.addHeat((kind === 'hit' ? 1.2 : 0.7) * this.vague(), melee ? 'Assault reported.' : 'Shots fired!', w.hud);
    this.note({ kind: 'shots', text: melee ? 'Assault with a weapon.' : 'Discharging a firearm in public.', fine: kind === 'hit' ? 4000 : 1800 });
    this.lastSeen = { x: p.x, z: p.z, vx: 0, vz: 0 };
    if (this.phase === 'none') {
      const near = this.allCars().some(c => Math.hypot(c.x - p.x, c.z - p.z) < 160);
      this.startChase(w, true);
      this.unseenT = near ? 0 : -10;
    } else if (this.phase === 'stop') this.fled(w);
    else if (this.phase === 'search' || this.phase === 'cooldown') this.startChase(w, true);
  }

  // Silent alarm / 911 call from a robbery: units head for the spot.
  // called: the clerk phoned it in after the robber left.
  dispatchRobbery(w, loc, mugging = false, called = false, conceal) {
    const p = w.player;
    if (called) w.hud.radio(`Dispatch: caller reports a 211 just occurred at ${loc.name}. Suspect fled on foot. Units respond.`);
    else if (!mugging) w.hud.radio(`Dispatch: 211 in progress at ${loc.name}. Silent alarm. All units respond.`);
    else w.hud.radio('Dispatch: caller reports an armed mugging. Units responding.');
    this.addHeat((mugging ? 0.9 : 1.6) * this.vague(), masked(this.s.player?.look) ? 'Armed robbery, masked suspect.' : 'Armed robbery.', w.hud);
    this.note({ kind: 'robbery', text: mugging ? 'Armed mugging.' : `Armed robbery — ${loc.name}.`, fine: mugging ? 4000 : 6000, conceal });
    this.lastSeen = { x: loc.x ?? p.x, z: loc.z ?? p.z, vx: 0, vz: 0 };
    if (this.phase === 'none' || this.phase === 'search' || this.phase === 'cooldown') { this.startChase(w, true); this.unseenT = -8; }
  }

  // A stolen car got called in (world2d/theft.js). An officer who saw it
  // chases now; a 911 call sends units to the spot, so they show up a little
  // later. A carjacking is a felony stop from the start.
  reportTheft(w, o, x, z, seen) {
    const carjack = o.kind === 'carjack';
    const before = this.level;
    this.s.heat = clamp(Math.max(this.s.heat + (carjack ? 0.6 : 0.3) * this.vague(), carjack ? (o.text.includes('Armed') ? 2.5 : 2) : 1), 0, 5.99);
    this.decayHold = 25;
    if (this.level > before) w.hud.radio(`Dispatch: Heat level ${this.level}. ${carjack ? 'Carjacking suspect.' : 'Stolen vehicle.'}`);
    const have = this.record.find(r => r.kind === o.kind);
    if (!have) this.record.push({ kind: o.kind, text: o.text, fine: o.fine, conceal: o.conceal ?? 0 });
    this.lastSeen = { x, z, vx: 0, vz: 0 };
    if (this.phase === 'stop') this.fled(w);
    else if (this.phase === 'none' || this.phase === 'search' || this.phase === 'cooldown') {
      this.startChase(w, true);
      if (!seen) this.unseenT = -10;
    }
    if (seen) this.eyesOn = true;
  }

  // A vague description ("someone in black, mask on") puts less heat on you.
  vague() { return 1 - 0.3 * this.disguise; }

  busted(w) {
    const lvl = Math.max(1, this.level);
    if (this.phase === 'notice' || this.phase === 'stop') { this.writeTicket(w); return; }
    w.onBusted(400 * lvl + 250 * (lvl - 1) ** 2, false, this.record.slice());
    this.reset(w);
  }

  // ---- traffic stops ----

  // The patrol car that lit you up stops being traffic and follows you.
  takePatrol(p) {
    let best = null, bd = 160;
    for (const c of this.patrols) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = c; } }
    if (!best) return;
    this.patrols = this.patrols.filter(c => c !== best);
    const u = new Unit(best.model, best.x, best.z, best.h);
    u.v = Math.abs(best.v) || 0;
    this.units.push(u);
  }

  nearestUnit(x, z) {
    let best = null, bd = Infinity;
    for (const u of this.units) { const d = Math.hypot(u.x - x, u.z - z); if (d < bd) { bd = d; best = u; } }
    return best;
  }

  // You stopped in time. The unit parks behind you and the officer walks up.
  beginStop(w) {
    const p = w.player;
    this.phase = 'stop';
    this.stop = { x: p.x, z: p.z, h: p.h, unit: this.nearestUnit(p.x, p.z), step: 'approach', officer: null, t: 0 };
    this.bustT = 0;
    w.audio.siren(false);
    w.hud.radio(`Traffic stop${w.streetAt(p.x, p.z) ? ' on ' + w.streetAt(p.x, p.z) : ''}. Stay in the car.`);
  }

  // Didn't stop in time: it's a pursuit now.
  failedToYield(w) {
    this.addHeat(0.5, 'Failure to yield.', null);
    this.eyesOn = true;
    this.note({ kind: 'evading', text: 'Failure to yield to an emergency vehicle.', fine: 900 });
    this.phase = 'chase';
    this.unseenT = Math.min(this.unseenT, 0);
    w.hud.radio('All units: suspect failed to yield. Pursuit authorized.');
  }

  // Drove off (or worse) before taking the ticket.
  fled(w) {
    this.stop = null;   // the officer runs back to the car and the unit gives chase
    this.addHeat(0.8, 'Fleeing a traffic stop.', null);
    this.eyesOn = true;
    this.note({ kind: 'evading', text: 'Evading arrest — fled a traffic stop.', fine: 1500 });
    this.phase = 'chase';
    this.unseenT = 0;
    this.lastSeen = { x: w.player.x, z: w.player.z, vx: w.player.vx, vz: w.player.vz };
    w.hud.radio('Suspect fled the traffic stop! All units, pursuit authorized.');
    w.audio.siren(true, 0.7);
    w.audio.music('pursuit');
  }

  // Runs every frame of a stop.
  updateStop(dt, w) {
    const st = this.stop, p = w.player;
    st.t += dt;
    // pulling off (or walking away from the car) before the ticket is in your hand
    const car = w.vehicle;
    const moved = car ? Math.hypot(car.x - st.x, car.z - st.z) : 0;
    const away = !p.inCar && Math.hypot(p.x - st.x, p.z - st.z) > 7;
    if (st.step !== 'ticket' && (moved > FLEE_DIST || away || (p.inCar && p.speed > 3))) { this.fled(w); return; }
    const u = st.unit;
    if (!u) return;
    const fx = Math.sin(st.h), fz = -Math.cos(st.h);       // the player's car faces this way
    const rx = Math.cos(st.h), rz = Math.sin(st.h);        // its right side
    const W = car ? car.dims.W : 2, L = car ? car.dims.L : 4.6;
    if (st.step === 'approach') {
      const px = st.x - fx * PARK_BEHIND, pz = st.z - fz * PARK_BEHIND;
      const wedged = st.t > 20 && Math.hypot(u.x - px, u.z - pz) < 40;
      if (this.parkUnit(u, dt, px, pz, st.h) || wedged) {
        if (wedged) { u.x = px; u.z = pz; u.h = st.h; }   // stuck on something close by: don't keep you waiting forever
        u.v = 0;
        // the officer gets out of the driver's door
        const ox = u.x - Math.cos(u.h) * (u.dims.W / 2 + 0.6), oz = u.z - Math.sin(u.h) * (u.dims.W / 2 + 0.6);
        st.officer = { x: ox, z: oz, h: st.h, walk: 0, moving: true };
        st.step = 'walk';
      }
    } else if (st.step === 'walk') {
      // to the driver's window: left side, level with the front seats
      const tx = st.x - rx * (W / 2 + 0.7) + fx * (L * 0.08), tz = st.z - rz * (W / 2 + 0.7) + fz * (L * 0.08);
      const o = st.officer, d = Math.hypot(tx - o.x, tz - o.z);
      if (d > 0.15) {
        const sp = Math.min(d, OFFICER_PACE * dt);
        o.x += (tx - o.x) / d * sp; o.z += (tz - o.z) / d * sp;
        o.h = Math.atan2(tx - o.x, -(tz - o.z));
        o.walk += dt * 6; o.moving = true;
      } else {
        o.h = Math.atan2(st.x - o.x, -(st.z - o.z)); o.moving = false;
        st.step = 'ticket';
        this.writeTicket(w);
      }
    }
  }

  // Drive a unit to (x, z) and stop there facing h. True once parked.
  parkUnit(u, dt, x, z, h) {
    const d = Math.hypot(x - u.x, z - u.z);
    if (d < 1.2) {
      u.v = 0;
      let dh = h - u.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
      u.h += clamp(dh, -1.5 * dt, 1.5 * dt);
      return Math.abs(dh) < 0.25;
    }
    const wp = d > 40 ? this.waypoint(u, x, z) : { x, z };
    const want = Math.atan2(wp.x - u.x, -(wp.z - u.z));
    let dh = want - u.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    const turn = clamp(dh, -2.4 * dt, 2.4 * dt);
    if (u.backup > 0) { u.backup -= dt; u.v = -6; u.h -= turn; }
    else {
      u.h += turn;
      const target = Math.min(26, 1.5 + d * 0.9) * (1 - Math.min(0.75, Math.abs(dh) / 1.4));
      u.v += clamp(target - u.v, -14 * dt, 9 * dt);
    }
    if (Math.abs(u.v) < 1.2) u.stuck += dt; else u.stuck = 0;
    if (u.stuck > 1.6) { u.backup = 1.1; u.stuck = 0; }
    u.x += Math.sin(u.h) * u.v * dt;
    u.z += -Math.cos(u.h) * u.v * dt;
    const hit = collideCircle(this.map, u.x, u.z, u.dims.W / 2 + 0.6);
    if (hit) { u.x += hit.nx * hit.pen; u.z += hit.nz * hit.pen; u.v *= 0.8; }
    return false;
  }

  // The officer hands you the ticket. Taking it ends the stop; pulling off
  // from the window turns it into a chase.
  async writeTicket(w) {
    if (hasWarrant(this.s)) {
      // the officer runs your name at the window: it's an arrest
      w.onBusted(400, false, this.record.slice(), true);
      this.reset(w);
      return;
    }
    const record = this.record.length ? this.record : [{ kind: 'reckless', text: 'Failure to maintain safe driving.', fine: 250 }];
    if (this.phase !== 'stop') this.stop = null;
    this.phase = 'stop';
    if (this.stop) this.stop.step = 'ticket';
    const r = await w.onTrafficStop(record);
    if (r === 'flee') { this.fled(w); return; }
    const unit = this.stop?.unit;
    this.reset(w);
    // the officer gets back in and the unit drives off, light bar off
    if (unit && r !== 'busted') { unit.lightBar = false; this.units.push(unit); }
  }
  escaped(w) {
    const record = this.record;
    this.record = [];
    // Got away on foot in a disguise: they chased someone, but not a name.
    const anon = this.eyesOn && this.footOnly && Math.random() < this.chaseDisguise;
    w.onEscaped(record, this.eyesOn && !anon);
    this.phase = 'none';
    this.decayHold = 20;
    w.audio.siren(false);
    w.audio.music(null);
  }
  reset(w) {
    this.phase = 'none';
    this.record = []; this.noiseAtt = 0; this.kills = 0;
    this.s.heat = 0;
    this.units = [];
    this.blocks = [];
    this.bustT = 0;
    this.stop = null; this.pullT = 0; this.stillT = 0;
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
