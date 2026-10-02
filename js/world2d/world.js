// The open world: owns the player (on foot or driving), traffic, police,
// time of day, weather, fuel, damage and every "press E" interaction.

import { buildMap, collideCircle, onBackroad } from './map.js';
import { Camera, buildStreetLights, drawGround, drawWater, drawLots, drawRoads, drawSkids, drawBuildings, drawTrees, drawTunnel, drawLighting, drawRain, renderOverview, signalState } from './render.js';
import { Vehicle } from './vehicle.js';
import { TrafficSystem } from './traffic.js';
import { PoliceSystem } from './police.js';
import { carSprite, drawCar, DIMS } from '../gfx2d/carSprite.js';
import { drawPerson } from '../gfx2d/person.js';
import { LOCATIONS, LOC_BY_ID, districtAt, HWY_Z, DESERT_Z, ROAD_W } from '../data/world.js';
import { CAR_BY_ID, carName } from '../data/cars.js';
import { game, activeCar, carSpec, levels, hourOf, isNight, spend, addRep, fmtMoney, carMpg, tankGallons } from '../core/state.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { settings, saveGame } from '../core/save.js';
import { emit } from '../core/events.js';
import { MPH } from '../sim/powertrain.js';

let MAP = null;
export function getMap() { if (!MAP) { MAP = buildMap(); MAP.lights = buildStreetLights(MAP); MAP.overview = renderOverview(MAP); } return MAP; }

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class World {
  constructor(ui) {
    this.ui = ui;
    this.map = getMap();
    this.cam = new Camera();
    this.traffic = new TrafficSystem(this.map.roads);
    this.police = new PoliceSystem(this.map, game.s);
    this.skids = [];
    this.smoke = [];
    this.t = 0;
    this.signalT = 0;
    this.paused = false;
    this.vehicle = null;
    this.engine = null;
    this.foot = { x: 0, z: 0, h: 0, walk: 0 };
    this.saveT = 0;
    this.gpsT = 0;
    this.gpsPath = null;
    this.nearLoc = null;
    this.offenceCooldown = {};
    this.redLightNode = null;
    this.trafficCtx = { signalT: 0, others: [] };
    this.audio = audio;
    this.spawnPlayer();
  }

  get s() { return game.s; }
  get hud() { return this.ui.hud; }

  spawnPlayer() {
    const s = this.s;
    const home = LOC_BY_ID[s.home] || LOC_BY_ID.eastgate_studio;
    const car = activeCar(s);
    const pos = s.pos;
    if (car && s.carPos) {
      this.placeCar(car, s.carPos.x, s.carPos.z, s.carPos.h);
    } else if (car) {
      this.placeCar(car, home.x - Math.sin(home.face) * 6 + 4, home.z + Math.cos(home.face) * 6, home.face + Math.PI / 2);
    }
    if (pos && pos.inCar && this.vehicle) { this.inCar = true; }
    else {
      this.inCar = false;
      this.foot.x = pos?.x ?? home.x; this.foot.z = pos?.z ?? home.z; this.foot.h = pos?.h ?? home.face;
    }
  }

  placeCar(car, x, z, h) {
    const model = CAR_BY_ID[car.modelId];
    this.vehicle = new Vehicle(car, model, carSpec(car), x, z, h);
    this.refreshCarSprite();
  }
  refreshCarSprite() {
    if (!this.vehicle) return;
    const car = this.vehicle.car;
    this.carSpriteImg = carSprite(CAR_BY_ID[car.modelId].body, car.visual, levels(car), car.cond, { crewColor: this.s.crew?.color });
  }
  // Called after parts/repairs so the drive matches the build.
  refreshCar() {
    const car = activeCar(this.s);
    if (!car) { this.vehicle = null; return; }
    if (!this.vehicle || this.vehicle.car !== car) {
      // a different car comes out of the home garage
      const home = LOC_BY_ID[this.s.home];
      const sp = this.s.carPos;
      if (sp) this.placeCar(car, sp.x, sp.z, sp.h);
      else this.placeCar(car, home.x + Math.cos(home.face) * 6, home.z + Math.sin(home.face) * 6, home.face + Math.PI / 2);
      if (this.inCar) { this.inCar = false; this.foot.x = this.vehicle.x + 3; this.foot.z = this.vehicle.z; }
    } else {
      this.vehicle.setSpec(carSpec(car));
      this.refreshCarSprite();
    }
    this.restartEngineSound();
  }

  restartEngineSound() {
    if (this.engine) { this.engine.stop(); this.engine = null; }
    if (this.inCar && this.vehicle) {
      const m = this.vehicle.model;
      const cyl = m.asp === 'ev' ? 0 : /V12|W12/.test(m.engine) ? 12 : /V10/.test(m.engine) ? 10 : /V8|W16/.test(m.engine) ? 8 : /V6|I6|Flat-6/.test(m.engine) ? 6 : /Rotary/.test(m.engine) ? 6 : /I3/.test(m.engine) ? 3 : /I5/.test(m.engine) ? 5 : 4;
      if (cyl) this.engine = audio.engine({ cylinders: cyl, loudness: 0.45 + (levels(this.vehicle.car).exhaust || 0) * 0.12 });
    }
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    if (this.paused) return;
    const s = this.s;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    this.signalT += dt;
    s.playTime += dt;
    this.advanceClock(dt);

    if (input.pressed('enterExit')) this.toggleCar();
    if (input.pressed('phone')) { this.ui.openPhone(); return; }
    if (input.pressed('map')) { this.ui.openPhone('map'); return; }
    if (input.pressed('pause')) { this.ui.openPause(); return; }
    if (input.pressed('camera')) this.zoomLevel = ((this.zoomLevel ?? 1) + 1) % 3;

    const p = this.playerState();
    this.offence = null;
    if (this.inCar && !this.vehicle) this.inCar = false;
    if (this.inCar && this.vehicle) this.updateDriving(dt);
    else this.updateFoot(dt);

    // traffic + police
    const inCity = Math.abs(p.x) < 1000 && Math.abs(p.z) < 1000;
    this.inCity = inCity;
    const hour = hourOf(s.time);
    const density = (hour > 1 && hour < 5 ? 0.35 : hour > 7 && hour < 9 || hour > 16 && hour < 19 ? 1.25 : 0.9) * (inCity ? 1 : 0.45) * (settings.quality === 'low' ? 0.6 : 1);
    Object.assign(this.trafficCtx, {
      signalT: this.signalT, px: p.x, pz: p.z, density, inCity, night: isNight(s.time),
      weatherSlow: s.weather === 'rain' || s.weather === 'fog' ? 0.8 : 1,
      movers: this.vehicle ? [this.vehicleMover()] : [],
      extraObstacles: [...(this.vehicle ? [this.vehicleMover()] : []), ...this.police.allCars()],
    });
    this.traffic.update(dt, this.trafficCtx);
    this.police.update(dt, this);
    if (this.inCar && this.vehicle) this.police.checkBlocks(this, this.vehicle);
    this.updatePoliceAudio();

    // interactions
    this.updateInteractions();

    // camera
    const focus = this.inCar && this.vehicle ? this.vehicle : this.foot;
    const vx = this.inCar && this.vehicle ? this.vehicle.vx : 0, vz = this.inCar && this.vehicle ? this.vehicle.vz : 0;
    const spd = Math.hypot(vx, vz);
    const base = (window.innerWidth < 700 ? 7.5 : 11) * [1, 0.55, 1.5][this.zoomLevel ?? 0];
    const targetZoom = this.inCar ? base / (1 + spd / 48) : base * 1.2;
    this.cam.zoom += (targetZoom - this.cam.zoom) * Math.min(1, dt * 2);
    const tx = focus.x + vx * 0.7, tz = focus.z + vz * 0.7;
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.z += (tz - this.cam.z) * Math.min(1, dt * 5);

    // gps
    this.gpsT -= dt;
    if (s.gps && this.gpsT <= 0) { this.gpsT = 1; this.updateGps(); }
    if (s.gps && Math.hypot(s.gps.x - p.x, s.gps.z - p.z) < 25) { this.ui.toast(`Arrived: ${s.gps.label}`, 'good'); s.gps = null; this.gpsPath = null; }

    // persist position
    s.pos = { x: p.x, z: p.z, h: this.inCar ? this.vehicle.h : this.foot.h, inCar: this.inCar };
    if (this.vehicle) s.carPos = { x: this.vehicle.x, z: this.vehicle.z, h: this.vehicle.h };

    this.saveT += dt;
    if (this.saveT > 45) { this.saveT = 0; saveGame('auto', true); }
    this.ui.hud.update(this);
  }

  vehicleMover() {
    const v = this.vehicle;
    return { x: v.x, z: v.z, h: v.h, speed: v.speed, isPlayer: true };
  }

  playerState() {
    if (this.inCar && this.vehicle) {
      const v = this.vehicle;
      return { x: v.x, z: v.z, vx: v.vx, vz: v.vz, speed: v.speed, h: v.h, inCar: true, carName: carName(v.model) };
    }
    return { x: this.foot.x, z: this.foot.z, vx: 0, vz: 0, speed: 0, h: this.foot.h, inCar: false, carName: '' };
  }
  get player() { return this.playerState(); }

  advanceClock(dt) {
    const s = this.s;
    const before = s.time.min;
    s.time.min += dt * 1.0;   // 1 real second = 1 game minute
    if (Math.floor(before / 60) !== Math.floor(s.time.min / 60)) this.onHour();
    if (s.time.min >= 1440) { s.time.min -= 1440; s.time.day++; this.ui.onNewDay(); }
  }

  onHour() {
    const s = this.s;
    if (Math.random() < 0.18) {
      const r = Math.random();
      const nw = r < 0.55 ? 'clear' : r < 0.75 ? 'cloudy' : r < 0.93 ? 'rain' : 'fog';
      if (nw !== s.weather) { s.weather = nw; this.ui.toast(`Weather: ${nw === 'rain' ? 'rain moving in — roads are slick' : nw}`, 'info'); }
    }
    if (Math.floor(s.time.min / 60) === 8) this.ui.onMorning();
    this.ui.onHour();
  }

  toggleCar() {
    if (this.inCar) {
      if (this.vehicle.speed > 2) { this.ui.toast('Slow down to get out', 'bad'); return; }
      const v = this.vehicle;
      this.inCar = false;
      input.setContext('foot');
      const rx = Math.cos(v.h), rz = Math.sin(v.h);
      this.foot.x = v.x - rx * (v.dims.W / 2 + 0.8); this.foot.z = v.z - rz * (v.dims.W / 2 + 0.8); this.foot.h = v.h;
      if (this.engine) { this.engine.stop(); this.engine = null; }
    } else if (this.vehicle) {
      if (Math.hypot(this.vehicle.x - this.foot.x, this.vehicle.z - this.foot.z) < 4.5) {
        this.inCar = true;
        input.setContext('car');
        this.restartEngineSound();
      } else if (!this.nearLoc) this.ui.toast('Get closer to your car (F)', 'info');
    } else if (!this.nearLoc) {
      this.ui.toast("You don't own a car yet — check Marketplace on your phone", 'info');
    }
  }

  updateFoot(dt) {
    const f = this.foot;
    const fwd = input.axis('forward') - input.axis('back');
    const side = input.steer();
    const run = input.held('run');
    const sp = run ? 5.2 : 1.8;
    let mx = side, mz = -fwd;
    const len = Math.hypot(mx, mz);
    if (len > 0.05) {
      mx /= len; mz /= len;
      f.x += mx * sp * dt; f.z += mz * sp * dt;
      f.h = Math.atan2(mx, -mz);
      f.walk += dt * sp * 2.2;
      f.moving = sp;
    } else f.moving = 0;
    const hit = collideCircle(this.map, f.x, f.z, 0.4);
    if (hit) { f.x += hit.nx * hit.pen; f.z += hit.nz * hit.pen; }
  }

  updateDriving(dt) {
    const s = this.s;
    const v = this.vehicle;
    const car = v.car;
    const p = { x: v.x, z: v.z };
    // surface + weather grip
    const onRoad = this.map.roads.onRoad(v.x, v.z);
    const paved = onRoad || (Math.abs(v.x) < 985 && Math.abs(v.z) < 985) || onBackroad(v.x, v.z, 6) || (v.x > 20 && v.x < 180 && v.z > 1150 && v.z < 1960);
    const sand = !paved && v.z > DESERT_Z;
    let grip = paved ? 1 : sand ? 0.62 : 0.72;
    if (s.weather === 'rain') grip *= 0.74;
    const noFuel = car.fuel <= 0.0005;
    v.update(dt, {
      throttle: input.axis('throttle'), brake: input.axis('brake'), steer: input.steer(),
      handbrake: input.held('handbrake'), nitrous: input.held('nitrous'),
      shiftUp: input.pressed('shiftUp'), shiftDown: input.pressed('shiftDown'),
      auto: settings.transmission === 'auto',
    }, { grip, drag: paved ? 0 : sand ? 2.2 : 1.6, noFuel });
    if (v.shifted) { v.shifted = false; audio.shift(); }
    if (input.pressed('horn')) audio.horn();
    if (noFuel && input.axis('throttle') > 0 && !this.fuelWarned) { this.fuelWarned = true; this.ui.toast('Out of gas! Call roadside assistance from your phone (Bank → Roadside) or push it to a station.', 'bad'); }

    // buildings / water
    for (const c of v.circles()) {
      const hit = collideCircle(this.map, c.x, c.z, c.r);
      if (hit) {
        const imp = v.bounce(hit.nx, hit.nz, hit.pen);
        if (imp > 3) this.onCrash(imp, hit.c.water ? 'water' : 'wall');
      }
    }
    // traffic + police cars
    for (const o of [...this.traffic.cars, ...this.police.patrols, ...this.police.units]) {
      const d = Math.hypot(o.x - v.x, o.z - v.z);
      const rr = (v.dims.W + (o.dims?.W || 1.9)) / 2 + 0.9;
      if (d < rr) {
        const nx = (v.x - o.x) / (d || 1), nz = (v.z - o.z) / (d || 1);
        const imp = v.bounce(nx, nz, rr - d);
        if (o.hit) o.hit(imp); else o.v *= 0.5;
        if (imp > 2.5) {
          this.onCrash(imp, o.police ? 'police' : 'car');
          this.setOffence(o.police || this.police.units.includes(o) ? 1.5 : 0.8, o.police ? 'Assault on an officer with a vehicle!' : 'Hit-and-run collision.', 'crash');
        }
      }
    }

    // fuel + odometer
    const dist = v.speed * dt;
    car.miles += dist / 1609.34;
    s.stats.miles += dist / 1609.34;
    const thr = input.axis('throttle');
    const gal = dist / 1609.34 / carMpg(car) * (0.5 + thr * 0.9 + (v.sim.nosOn ? 1 : 0));
    car.fuel = Math.max(0, car.fuel - gal / tankGallons(car));
    if (car.fuel < 0.12 && !this.lowFuelWarned) { this.lowFuelWarned = true; this.ui.toast('Fuel low — find a gas station', 'bad'); }
    if (car.fuel > 0.2) { this.lowFuelWarned = false; this.fuelWarned = false; }
    // tire wear from wheelspin
    if (v.sim.slip > 0.2) car.cond.tires = Math.max(1, car.cond.tires - dt * 0.6 * v.sim.slip);

    // skid marks + smoke
    const sliding = Math.abs(v.slipAngle) > 0.18 && v.speed > 6;
    if ((v.sim.slip > 0.25 || sliding) && v.speed > 0.5) {
      const bx = v.x - Math.sin(v.h) * v.dims.L * 0.32, bz = v.z + Math.cos(v.h) * v.dims.L * 0.32;
      const rx = Math.cos(v.h) * v.dims.W * 0.4, rz = Math.sin(v.h) * v.dims.W * 0.4;
      if (this.lastSkid) for (const k of [-1, 1]) this.skids.push([this.lastSkid.x + rx * k, this.lastSkid.z + rz * k, bx + rx * k, bz + rz * k]);
      this.lastSkid = { x: bx, z: bz };
      if (Math.random() < 0.5) this.smoke.push({ x: bx, z: bz, r: 0.5, life: 1.2, a: 0.32 });
      if (this.skids.length > 900) this.skids.splice(0, 100);
    } else this.lastSkid = null;
    if (car.cond.engine < 35 && Math.random() < dt * 6) {
      this.smoke.push({ x: v.x + Math.sin(v.h) * v.dims.L * 0.4, z: v.z - Math.cos(v.h) * v.dims.L * 0.4, r: 0.8, life: 2, a: 0.4, dark: true });
    }
    for (const sm of this.smoke) { sm.life -= dt; sm.r += dt * 1.1; }
    this.smoke = this.smoke.filter(sm => sm.life > 0);

    // ---- offences (only matter if a cop sees them) ----
    const edge = onRoad?.edge;
    const limit = edge ? (edge.kind === 'highway' ? 29 : edge.kind === 'desert' ? 24.6 : 15.6) : 15.6;
    if (v.speed > limit + 9) this.setOffence(dt * (v.speed > limit + 20 ? 0.9 : 0.45), `Speeding — ${Math.round(v.speed * MPH)} in a ${Math.round(limit * MPH)}.`);
    if (v.sim.slip > 0.4 && v.speed < 8) this.setOffence(dt * 0.25, 'Exhibition of speed (burnout).');
    // red lights
    const node = this.map.roads.nearestNode(v.x, v.z);
    if (node && node.edges.length >= 3 && Math.abs(node.x) <= 900 && Math.abs(node.z) <= 900 && Math.abs(v.x - node.x) < ROAD_W / 2 && Math.abs(v.z - node.z) < ROAD_W / 2) {
      if (this.redLightNode !== node.id && v.speed > 6) {
        const sig = signalState(node, this.signalT);
        const ns = Math.abs(v.vz) > Math.abs(v.vx);
        if ((ns !== sig.nsGreen) && !sig.yellow) this.setOffence(0.7, 'Ran a red light.', 'red' + node.id);
        this.redLightNode = node.id;
      }
    } else this.redLightNode = null;

    // engine audio
    if (this.engine) {
      this.engine.update({ rpm: v.sim.rpm, throttle: thr, boost: v.sim.boost, slip: Math.max(v.sim.slip, sliding ? 0.5 : 0), turbo: v.spec.asp === 'turbo', speed: v.speed });
    }
    if (v.sim.nosOn && !this.nosSound) { audio.nos(); this.nosSound = true; }
    if (!v.sim.nosOn) this.nosSound = false;
  }

  setOffence(heat, text, onceKey) {
    if (onceKey) {
      if (this.offenceCooldown[onceKey] > this.t) return;
      this.offenceCooldown[onceKey] = this.t + 4;
    }
    if (!this.offence || this.offence.heat < heat) this.offence = { heat, text };
  }

  onCrash(impact, what) {
    const car = this.vehicle?.car;
    if (!car || this.t - (this.lastCrashT || 0) < 0.25) return;
    this.lastCrashT = this.t;
    const dmg = Math.max(0, impact - 3) * 1.7;
    car.cond.body = Math.max(5, car.cond.body - dmg);
    car.cond.lights = Math.max(0, car.cond.lights - dmg * (Math.random() < 0.5 ? 1.4 : 0.4));
    if (impact > 14) car.cond.engine = Math.max(10, car.cond.engine - (impact - 14) * 1.2);
    if (impact > 18) car.cond.trans = Math.max(10, car.cond.trans - (impact - 18));
    audio.crash(Math.min(1.5, impact / 15));
    if (settings.shake) this.cam.shake = Math.min(1, impact / 18);
    this.refreshCarSprite();
    if (impact > 10) this.vehicle.setSpec(carSpec(car));
    if (what === 'water') this.ui.toast('That\'s the water. Cars don\'t float.', 'bad');
  }

  onSpikes() {
    const car = this.vehicle.car;
    car.cond.tires = 0;
    this.vehicle.setSpec(carSpec(car));
    this.refreshCarSprite();
    audio.crash(0.6);
    this.ui.toast('SPIKE STRIP! Tires are shredded — grip is gone.', 'bad');
  }

  onBusted(fine, ticketOnly) {
    const s = this.s;
    const insured = s.insurance;
    const total = Math.round(fine * (insured && !ticketOnly ? 0.75 : 1));
    if (!spend(s, total, ticketOnly ? 'PSPD traffic citation' : 'PSPD fines + impound')) {
      s.bank -= Math.max(0, total - s.cash - s.bank); s.cash = 0;
    }
    if (!ticketOnly) { addRep(s, -60, 'Busted'); s.stats.busted++; }
    this.ui.modal(ticketOnly ? 'Pulled over' : 'BUSTED', ticketOnly
      ? `<p>The officer writes you a ticket for ${fmtMoney(total)}. "Slow it down out here."</p>`
      : `<p>You're in cuffs. Your car spends the night in impound.</p><p>Fines, towing and impound: <b>${fmtMoney(total)}</b>${insured ? ' (insurance covered 25%)' : ''}. Rep −60.</p>`);
    emit('busted', { fine: total });
  }

  onEscaped() {
    const s = this.s;
    s.stats.pursuitsEscaped++;
    const lvl = Math.max(1, Math.floor(s.heat));
    addRep(s, 80 * lvl, 'Escaped the cops');
    s.followers += 40 * lvl;
    this.ui.toast(`ESCAPED! +${80 * lvl} rep. Heat will cool down if you lay low.`, 'good');
    emit('pursuitEscaped', { level: lvl });
  }

  updatePoliceAudio() {
    const lvl = this.police.level;
    if (this.police.active) audio.siren(true, Math.min(1, 0.4 + lvl * 0.15));
  }

  streetAt(x, z) { return this.map.roads.streetName(x, z); }
  districtAt(x, z) { return districtAt(x, z); }

  updateInteractions() {
    const p = this.playerState();
    let best = null, bd = 10;
    for (const l of LOCATIONS) {
      const d = Math.hypot(l.x - p.x, l.z - p.z);
      if (d < bd) { bd = d; best = l; }
    }
    if (this.inCar && this.vehicle && this.vehicle.speed > 4) best = null;
    this.nearLoc = best;
    if (best && input.pressed('interact')) this.ui.openPlace(best, this);
  }

  updateGps() {
    const s = this.s, p = this.playerState();
    const roads = this.map.roads;
    const a = roads.nearestNode(p.x, p.z), b = roads.nearestNode(s.gps.x, s.gps.z);
    const route = roads.route(a.id, b.id);
    this.gpsPath = route ? [[p.x, p.z], ...route.map(id => [roads.nodes[id].x, roads.nodes[id].z]), [s.gps.x, s.gps.z]] : [[p.x, p.z], [s.gps.x, s.gps.z]];
  }

  setGps(x, z, label) {
    this.s.gps = { x, z, label };
    this.gpsT = 0;
    this.ui.toast(`GPS set: ${label}`, 'info');
  }

  // ---------------------------------------------------------------- draw
  draw(ctx, W, H, dt) {
    const s = this.s;
    const cam = this.cam;
    cam.w = W; cam.h = H;
    let shakeX = 0, shakeY = 0;
    if (cam.shake > 0) { shakeX = (Math.random() - 0.5) * cam.shake * 14; shakeY = (Math.random() - 0.5) * cam.shake * 14; cam.shake = Math.max(0, cam.shake - dt * 2.5); }
    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawGround(ctx, cam);
    drawWater(ctx, cam, this.map, this.t);
    const v = cam.view(60);
    const items = this.map.drawGrid.query(v.x0, v.z0, v.x1, v.z1);
    drawLots(ctx, cam, items);
    drawRoads(ctx, cam, this.map, this.signalT);
    drawSkids(ctx, cam, this.skids);
    if (s.weather === 'rain') { ctx.fillStyle = 'rgba(40,60,90,0.12)'; ctx.fillRect(0, 0, W, H); }

    // location markers
    for (const l of LOCATIONS) {
      if (l.x < v.x0 || l.x > v.x1 || l.z < v.z0 || l.z > v.z1) continue;
      const pulse = 0.6 + Math.sin(this.t * 3) * 0.2;
      ctx.strokeStyle = l.color; ctx.lineWidth = Math.max(2, 0.4 * cam.zoom);
      ctx.globalAlpha = pulse;
      ctx.beginPath(); ctx.arc(cam.sx(l.x), cam.sy(l.z), 3.2 * cam.zoom, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.18; ctx.fillStyle = l.color; ctx.fill(); ctx.globalAlpha = 1;
    }
    // gps path
    if (this.gpsPath && s.gps) {
      ctx.strokeStyle = 'rgba(255,40,60,0.55)'; ctx.lineWidth = Math.max(3, 1.4 * cam.zoom); ctx.lineJoin = 'round';
      ctx.setLineDash([2 * cam.zoom, 2 * cam.zoom]);
      ctx.beginPath(); this.gpsPath.forEach(([x, z], i) => i ? ctx.lineTo(cam.sx(x), cam.sy(z)) : ctx.moveTo(cam.sx(x), cam.sy(z))); ctx.stroke();
      ctx.setLineDash([]);
    }
    // police spike strips
    for (const b of this.police.blocks) {
      const sp = b.spikes;
      ctx.strokeStyle = '#d6d6d6'; ctx.lineWidth = Math.max(2, 0.6 * cam.zoom); ctx.setLineDash([0.4 * cam.zoom, 0.3 * cam.zoom]);
      ctx.beginPath();
      ctx.moveTo(cam.sx(sp.x - sp.ax * sp.len / 2), cam.sy(sp.z - sp.az * sp.len / 2));
      ctx.lineTo(cam.sx(sp.x + sp.ax * sp.len / 2), cam.sy(sp.z + sp.az * sp.len / 2));
      ctx.stroke(); ctx.setLineDash([]);
    }

    // pedestrians
    for (const pd of this.traffic.peds) {
      if (pd.x < v.x0 || pd.x > v.x1 || pd.z < v.z0 || pd.z > v.z1) continue;
      drawPerson(ctx, cam.sx(pd.x), cam.sy(pd.z), 0, cam.zoom, { top: pd.color, skin: '#c68e65', hair: '#222' }, this.t * 6 * pd.sp);
    }
    // cars
    const cars = [...this.traffic.cars, ...this.police.patrols, ...this.police.units, ...this.police.blocks.flatMap(b => b.cars)];
    const night = this.darkness();
    for (const c of cars) {
      if (c.x < v.x0 || c.x > v.x1 || c.z < v.z0 || c.z > v.z1) continue;
      this.drawShadow(ctx, c.x, c.z, c.h, c.dims);
      drawCar(ctx, c.sprite, cam.sx(c.x), cam.sy(c.z), c.h, cam.zoom);
    }
    // the player's car (parked or driven)
    if (this.vehicle) {
      const pv = this.vehicle;
      this.drawShadow(ctx, pv.x, pv.z, pv.h, pv.dims);
      drawCar(ctx, this.carSpriteImg, cam.sx(pv.x), cam.sy(pv.z), pv.h, cam.zoom);
      if (pv.sim.nosOn && this.inCar) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const bx = pv.x - Math.sin(pv.h) * (pv.dims.L / 2 + 0.6), bz = pv.z + Math.cos(pv.h) * (pv.dims.L / 2 + 0.6);
        const g = ctx.createRadialGradient(cam.sx(bx), cam.sy(bz), 0, cam.sx(bx), cam.sy(bz), 1.6 * cam.zoom);
        g.addColorStop(0, 'rgba(140,110,255,0.9)'); g.addColorStop(1, 'rgba(60,40,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cam.sx(bx), cam.sy(bz), 1.6 * cam.zoom, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    if (!this.inCar) drawPerson(ctx, cam.sx(this.foot.x), cam.sy(this.foot.z), this.foot.h, cam.zoom, this.s.player.look, this.foot.moving ? this.foot.walk : 0, true);

    // smoke
    for (const sm of this.smoke) {
      ctx.fillStyle = sm.dark ? `rgba(40,40,40,${sm.a * sm.life / 2})` : `rgba(220,220,220,${sm.a * sm.life / 1.4})`;
      ctx.beginPath(); ctx.arc(cam.sx(sm.x), cam.sy(sm.z), sm.r * cam.zoom, 0, Math.PI * 2); ctx.fill();
    }

    drawBuildings(ctx, cam, items, night);
    drawTrees(ctx, cam, items);
    drawTunnel(ctx, cam);

    // helicopter shadow + searchlight
    if (this.police.heli) {
      const hx = cam.sx(this.police.heli.x), hy = cam.sy(this.police.heli.z);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(hx + 30, hy + 30, 6 * cam.zoom, 2 * cam.zoom, 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1d24'; ctx.beginPath(); ctx.ellipse(hx, hy, 4.5 * cam.zoom, 1.6 * cam.zoom, 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(200,200,200,0.5)'; ctx.lineWidth = 1;
      const r = this.police.heli.rot;
      ctx.beginPath(); ctx.moveTo(hx - Math.cos(r) * 6 * cam.zoom, hy - Math.sin(r) * 6 * cam.zoom); ctx.lineTo(hx + Math.cos(r) * 6 * cam.zoom, hy + Math.sin(r) * 6 * cam.zoom); ctx.stroke();
    }

    // lighting
    if (night > 0.03) {
      const glows = [], blobs = [];
      const carsLit = cars.filter(c => c.x > v.x0 && c.x < v.x1 && c.z > v.z0 && c.z < v.z1).map(c => ({ x: c.x, z: c.z, h: c.h, lightsOn: true, beam: 22 }));
      if (this.vehicle && this.inCar && this.vehicle.car.cond.lights >= 20) carsLit.push({ x: this.vehicle.x, z: this.vehicle.z, h: this.vehicle.h, lightsOn: true, beam: 34 });
      const pulse = Math.sin(this.t * 14) > 0;
      for (const c of [...this.police.patrols.filter(p => this.police.active), ...this.police.units, ...this.police.blocks.flatMap(b => b.cars)]) {
        if (c.x < v.x0 || c.x > v.x1 || c.z < v.z0 || c.z > v.z1) continue;
        glows.push({ x: c.x, z: c.z, r: 9, color: pulse ? 'rgba(255,30,30,1)' : 'rgba(40,90,255,1)', a: 0.7 });
      }
      for (const c of carsLit) {
        const bx = c.x - Math.sin(c.h) * 2.4, bz = c.z + Math.cos(c.h) * 2.4;
        glows.push({ x: bx, z: bz, r: 2.2, color: 'rgba(255,20,20,1)', a: 0.45 });
      }
      if (this.vehicle) {
        const nv = this.vehicle.car.visual.neon;
        if (nv && nv !== 'none') glows.push({ x: this.vehicle.x, z: this.vehicle.z, r: 5.5, color: nv, a: 0.75 });
        if (this.vehicle.braking && this.inCar) {
          const bx = this.vehicle.x - Math.sin(this.vehicle.h) * this.vehicle.dims.L / 2, bz = this.vehicle.z + Math.cos(this.vehicle.h) * this.vehicle.dims.L / 2;
          glows.push({ x: bx, z: bz, r: 4, color: 'rgba(255,0,0,1)', a: 0.8 });
        }
      }
      if (this.police.heli) blobs.push({ x: this.police.heli.x, z: this.police.heli.z, r: 22, a: 1 });
      for (const l of LOCATIONS) glows.push({ x: l.x, z: l.z, r: 6, color: l.color, a: 0.3 });
      drawLighting(ctx, cam, night, this.map.lights, { cars: carsLit, glows, blobs });
    } else if (this.police.active) {
      // daytime light bars still flash
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pulse = Math.sin(this.t * 14) > 0;
      for (const c of [...this.police.units, ...this.police.patrols]) {
        ctx.fillStyle = pulse ? 'rgba(255,30,30,0.35)' : 'rgba(40,90,255,0.35)';
        ctx.beginPath(); ctx.arc(cam.sx(c.x), cam.sy(c.z), 4 * cam.zoom, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    if (this.police.heli) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cam.sx(this.police.heli.x), cam.sy(this.police.heli.z), 0, cam.sx(this.police.heli.x), cam.sy(this.police.heli.z), 20 * cam.zoom);
      g.addColorStop(0, 'rgba(255,255,230,0.25)'); g.addColorStop(1, 'rgba(255,255,230,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cam.sx(this.police.heli.x), cam.sy(this.police.heli.z), 20 * cam.zoom, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // search zone
    if ((this.police.phase === 'search' || this.police.phase === 'cooldown') && this.police.lastSeen) {
      ctx.strokeStyle = this.police.phase === 'cooldown' ? 'rgba(255,200,0,0.6)' : 'rgba(255,40,40,0.6)';
      ctx.setLineDash([10, 8]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cam.sx(this.police.lastSeen.x), cam.sy(this.police.lastSeen.z), this.police.searchR * cam.zoom, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    drawRain(ctx, cam, s.weather === 'rain' ? 1 : 0, dt);
    if (s.weather === 'fog') { ctx.fillStyle = 'rgba(180,185,195,0.28)'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();

    // GPS arrow at screen edge
    if (s.gps) {
      const gx = cam.sx(s.gps.x), gy = cam.sy(s.gps.z);
      if (gx < 0 || gx > W || gy < 0 || gy > H) {
        const a = Math.atan2(gy - H / 2, gx - W / 2);
        const r = Math.min(W, H) / 2 - 40;
        ctx.save(); ctx.translate(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r); ctx.rotate(a);
        ctx.fillStyle = '#ff2a3a'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  drawShadow(ctx, x, z, h, dims) {
    const cam = this.cam;
    ctx.save();
    ctx.translate(cam.sx(x) + 0.3 * cam.zoom, cam.sy(z) + 0.4 * cam.zoom);
    ctx.rotate(h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-dims.W / 2 * cam.zoom, -dims.L / 2 * cam.zoom, dims.W * cam.zoom, dims.L * cam.zoom);
    ctx.restore();
  }

  darkness() {
    const h = hourOf(this.s.time);
    let d;
    if (h >= 21 || h < 4.5) d = 0.78;
    else if (h >= 18) d = (h - 18) / 3 * 0.78;
    else if (h < 7) d = (7 - h) / 2.5 * 0.78;
    else d = 0;
    if (this.s.weather === 'rain' || this.s.weather === 'fog') d = Math.max(d, 0.18);
    return clamp(d, 0, 0.78);
  }

  destroy() {
    if (this.engine) this.engine.stop();
    audio.siren(false);
    audio.music(null);
  }
}
