// The open world: owns the player (on foot or driving), traffic, police,
// time of day, weather, fuel, damage and every "press E" interaction.

import { buildMap, collideCircle, onBackroad } from './map.js';
import { Camera, buildStreetLights, drawGround, drawWater, drawLots, drawRoads, drawSkids, drawBuildings, drawTrees, drawTunnel, drawLighting, drawRain, renderOverview, signalState } from './render.js';
import { Vehicle } from './vehicle.js';
import { TrafficSystem } from './traffic.js';
import { missionTick } from '../core/missions.js';
import { PoliceSystem, OFFICER_LOOK } from './police.js';
import { Combat } from './combat.js';
import { Carjacks } from './carjack.js';
import { Thefts } from './theft.js';
import { Gigs } from './gigs.js';
import { GangWorld } from './gangs.js';
import { StreetRaces } from './streetRace.js';
import { carSprite, drawCar, drawCarPitched, dimsFor, DIMS } from '../gfx2d/carSprite.js';
import { drawPerson } from '../gfx2d/person.js';
import { LOCATIONS, LOC_BY_ID, districtAt, HWY_Z, DESERT_Z, ROAD_W } from '../data/world.js';
import { CAR_BY_ID, carName } from '../data/cars.js';
import { engineStress, engineMessage } from '../sim/engine.js';
import { game, activeCar, carSpec, levels, tierOf, hourOf, isNight, spend, addRep, fmtMoney, carMpg, tankGallons } from '../core/state.js';
import { input } from '../core/input.js';
import { esc } from '../ui/dom.js';
import { audio } from '../core/audio.js';
import { settings, saveGame } from '../core/save.js';
import { emit } from '../core/events.js';
import { MPH } from '../sim/powertrain.js';
import { RevLimiter, launchRpmSetting } from '../sim/twostep.js';
import { drawFlameJets } from '../gfx2d/flames.js';
import { online } from '../net/online.js';
import { soundProfile, noiseDb, liveNoiseDb, LEGAL_DB } from '../sim/sound.js';
import { takeWarrants, signCitation, warrantForEscape, CITATION_DAYS, hasWarrant } from '../core/warrants.js';
import { charge, fileCase, openCase, IMPOUND_LOT } from '../core/justice.js';
import { toggleMask, masked } from '../core/disguise.js';
import { wx, isWet, nextWeather, weatherToast, nightShift } from '../core/weather.js';
import { tickNeeds, runMul } from '../core/needs.js';
import { applyEstate } from './estate.js';
import { estateTick } from './trap.js';
import { seizeBag } from '../core/drugs.js';
import { seizeCash } from '../core/bank.js';
import { seizeLoot } from '../core/loot.js';
import { healthMods } from '../core/health.js';
import { FUEL_BURN, wearTick, wearMessage, BREAKDOWNS } from '../core/upkeep.js';

const st0 = (w, g) => w.s.properties.includes(g.id);

let MAP = null;
export function getMap() { if (!MAP) { MAP = buildMap(); MAP.lights = buildStreetLights(MAP); MAP.overview = renderOverview(MAP); } return MAP; }

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class World {
  constructor(ui) {
    this.ui = ui;
    this.map = getMap();
    applyEstate(this.map, game.s);   // houses you built on your land
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
    this.flame = 0;
    this.foot = { x: 0, z: 0, h: 0, walk: 0 };
    this.saveT = 0;
    this.gpsT = 0;
    this.gpsPath = null;
    this.nearLoc = null;
    this.inGarage = null;       // garage you're standing in (roof fades away)
    this.garageHint = '';
    this.garageCars = [];
    this.garageT = 0;
    this.garageSprites = new Map();
    this.offenceCooldown = {};
    this.redLightNode = null;
    this.trafficCtx = { signalT: 0, others: [] };
    this.audio = audio;
    this.combat = new Combat(this);
    this.carjacks = new Carjacks(this);
    this.thefts = new Thefts(this);
    this.gigs = new Gigs(this);
    this.gangs = new GangWorld(this);
    this.races = new StreetRaces(this);
    this.spawnPlayer();
  }

  get s() { return game.s; }
  get hud() { return this.ui.hud; }

  spawnPlayer() {
    const s = this.s;
    const home = LOC_BY_ID[s.home] || LOC_BY_ID.eastgate_studio;
    const car = activeCar(s);
    const pos = s.pos;
    if (car?.stolen) { /* carjacked: it turns up when the cops find it */ }
    else if (car && s.carPos) {
      this.placeCar(car, s.carPos.x, s.carPos.z, s.carPos.h);
    } else if (car) {
      const sp = this.homeSpot(home);
      this.placeCar(car, sp.x, sp.z, sp.h);
    }
    if (pos && pos.inCar && this.vehicle) { this.inCar = true; this.restartEngineSound(); }   // loaded a save sat in the car: start it up
    else {
      this.inCar = false;
      this.foot.x = pos?.x ?? home.x; this.foot.z = pos?.z ?? home.z; this.foot.h = pos?.h ?? home.face;
    }
  }

  // Where your car waits outside a home: on the driveway, nose to the garage door.
  homeSpot(home) {
    const g = this.map.garages.find(q => q.id === home.id);
    if (g) return { x: g.park.x, z: g.park.z, h: g.park.h };
    return { x: home.x + Math.cos(home.face) * 6, z: home.z + Math.sin(home.face) * 6, h: home.face + Math.PI / 2 };
  }

  placeCar(car, x, z, h) {
    const model = CAR_BY_ID[car.modelId];
    this.vehicle = new Vehicle(car, model, carSpec(car), x, z, h);
    this.refreshCarSprite();
  }
  refreshCarSprite() {
    if (!this.vehicle) return;
    const car = this.vehicle.car;
    this.carSpriteImg = carSprite(CAR_BY_ID[car.modelId], car.visual, levels(car), car.cond, { crewColor: car.hot ? null : this.s.crew?.color });
  }
  // Called after parts/repairs so the drive matches the build.
  refreshCar() {
    const car = activeCar(this.s);
    if (this.vehicle?.car?.hot) {
      // driving a stolen car: the shop worked on your own, which stays parked
      const own = this.thefts.own;
      if (own && car && own.vehicle.car === car) { own.vehicle.setSpec(carSpec(car)); own.sprite = carSprite(CAR_BY_ID[car.modelId], car.visual, levels(car), car.cond, { crewColor: this.s.crew?.color }); }
      return;
    }
    if (!car || car.stolen) { this.vehicle = null; this.inCar = false; return; }
    if (!this.vehicle || this.vehicle.car !== car) {
      // a different car comes out of the home garage
      const home = LOC_BY_ID[this.s.home];
      const sp = this.s.carPos;
      if (sp) this.placeCar(car, sp.x, sp.z, sp.h);
      else { const hs = this.homeSpot(home); this.placeCar(car, hs.x, hs.z, hs.h); }
      if (this.inCar) { this.inCar = false; this.foot.x = this.vehicle.x + 3; this.foot.z = this.vehicle.z; }
    } else {
      this.vehicle.setSpec(carSpec(car));
      this.refreshCarSprite();
    }
    this.restartEngineSound();
  }

  restartEngineSound() {
    if (this.engine) { this.engine.stop(); this.engine = null; }
    this.staticDb = this.vehicle ? noiseDb(this.vehicle.model, this.vehicle.car.parts) : 0;
    if (this.inCar && this.vehicle) {
      this.engine = audio.engine({ profile: soundProfile(this.vehicle.model, levels(this.vehicle.car), this.vehicle.car.parts) });
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
    if (input.pressed('view')) {
      settings.camMode = settings.camMode === 'chase' ? 'top' : 'chase';
      this.ui.toast(settings.camMode === 'chase' ? 'Third-person camera' : 'Top-down camera', 'info');
    }
    if (input.pressed('mask')) this.toggleMask();

    const p = this.playerState();
    this.offence = null;
    if (this.inCar && !this.vehicle) this.inCar = false;
    if (this.inCar && this.vehicle) this.updateDriving(dt);
    else this.updateFoot(dt);
    this.combat.update(dt);
    this.carjacks.update(dt);
    this.thefts.update(dt);
    this.gigs.update(dt);
    this.gangs.update(dt);
    this.races.update(dt);
    this.updateOnline(dt);

    // traffic + police
    const inCity = Math.abs(p.x) < 1000 && Math.abs(p.z) < 1000;
    this.inCity = inCity;
    const hour = hourOf(s.time);
    const density = (hour > 1 && hour < 5 ? 0.35 : hour > 7 && hour < 9 || hour > 16 && hour < 19 ? 1.25 : 0.9) * (inCity ? 1 : 0.45) * (settings.quality === 'low' ? 0.6 : 1);
    Object.assign(this.trafficCtx, {
      signalT: this.signalT, px: p.x, pz: p.z, density, inCity, night: isNight(s.time),
      weatherSlow: isWet(s) || s.weather === 'fog' ? 0.8 : 1,
      movers: this.vehicle ? [this.vehicleMover()] : [],
      extraObstacles: [...(this.vehicle ? [this.vehicleMover()] : []), ...this.police.allCars(), ...this.races.cars(), ...this.thefts.obstacles()],
    });
    this.traffic.update(dt, this.trafficCtx);
    this.police.update(dt, this);
    if (this.inCar && this.vehicle) this.police.checkBlocks(this, this.vehicle);
    this.updatePoliceAudio();

    // interactions
    this.updateInteractions();
    this.updateGarageCars(dt);
    for (const g of this.map.garages) g.roof.a += ((g === this.inGarage ? 0 : 1) - g.roof.a) * Math.min(1, dt * 4);

    // camera
    const focus = this.inCar && this.vehicle ? this.vehicle : this.foot;
    const vx = this.inCar && this.vehicle ? this.vehicle.vx : 0, vz = this.inCar && this.vehicle ? this.vehicle.vz : 0;
    const spd = Math.hypot(vx, vz);
    const base = (window.innerWidth < 700 ? 7.5 : 11) * [1, 0.55, 1.5][this.zoomLevel ?? 0];
    // a traffic stop pulls the camera in so you can watch the officer walk up
    const stop = this.police.phase === 'stop' ? this.police.stop : null;
    const targetZoom = stop ? base * 1.35 : this.inCar ? base / (1 + spd / 48) : base * 1.2;
    this.cam.zoom += (targetZoom - this.cam.zoom) * Math.min(1, dt * 2);
    // Keep the car near the middle of the screen at any speed: only a whisker
    // of look-ahead, and a follow fast enough that the lag cancels it out.
    // Third-person (chase) camera: the world turns so the car always points up
    // the screen, and the view is pushed ahead so you see more road than
    // what's behind you. On foot, or with the top-down view, rot eases to 0.
    const cam = this.cam, chase = settings.camMode === 'chase' && this.inCar && this.vehicle;
    let dRot = (chase ? -this.vehicle.h : 0) - cam.rot; dRot = Math.atan2(Math.sin(dRot), Math.cos(dRot));
    cam.rot += dRot * Math.min(1, dt * (chase ? 7 : 5));
    this.camLead = (this.camLead || 0) + ((chase ? 1 : 0) - (this.camLead || 0)) * Math.min(1, dt * 4);
    const lead = this.camLead * (cam.vh || 600) * 0.2 / cam.zoom;   // car sits in the lower part of the screen
    const mid = stop?.unit && Math.hypot(stop.unit.x - focus.x, stop.unit.z - focus.z) < 20 ? stop.unit : null;
    const tx = (mid ? (focus.x + mid.x) / 2 : focus.x + vx * 0.1) - Math.sin(cam.rot) * lead, tz = (mid ? (focus.z + mid.z) / 2 : focus.z + vz * 0.1) - Math.cos(cam.rot) * lead;
    const follow = this.inCar ? 1 - Math.exp(-dt * 12) : Math.min(1, dt * 5);
    this.cam.x += (tx - this.cam.x) * follow;
    this.cam.z += (tz - this.cam.z) * follow;

    // texted missions: stops, clock (before the GPS clears itself on arrival)
    missionTick(this, p, (m, k) => this.ui.toast(m, k));
    estateTick(this, dt);   // construction, customers at your trap house

    // gps
    this.gpsT -= dt;
    if (s.gps && this.gpsT <= 0) { this.gpsT = 0.4; this.updateGps(); }
    if (s.gps && !s.gps.gig && Math.hypot(s.gps.x - p.x, s.gps.z - p.z) < 25) { this.ui.toast(`Arrived: ${s.gps.label}`, 'good'); s.gps = null; this.gpsPath = null; }

    // persist position
    // (a stolen car isn't saved: load the game and you're on foot, your own car where you left it)
    const hot = this.vehicle?.car?.hot, own = hot ? this.thefts.own?.vehicle : this.vehicle;
    s.pos = { x: p.x, z: p.z, h: this.inCar ? this.vehicle.h : this.foot.h, inCar: this.inCar && !hot };
    if (own) s.carPos = { x: own.x, z: own.z, h: own.h };

    this.saveT += dt;
    if (this.saveT > 45) { this.saveT = 0; saveGame('auto', true); }
    this.ui.hud.update(this);
  }

  // ---------------------------------------------------------------- online
  updateOnline(dt) {
    if (!online.active) return;
    const p = this.playerState();
    const walking = !this.inCar && this.foot.moving;
    // keep the car other players see up to date (parts, paint, damage-free look)
    this.onlineMeT = (this.onlineMeT || 0) - dt;
    if (this.onlineMeT <= 0) {
      this.onlineMeT = 1;
      const car = activeCar(this.s);
      if (car) online.me = { name: this.s.player.name, modelId: car.modelId, visual: car.visual, levels: levels(car), tier: tierOf(this.s.rep).n, crew: this.s.onlineCrew ? { tag: this.s.onlineCrew.tag, color: this.s.onlineCrew.color } : null };
    }
    const speed = this.inCar ? (this.vehicle.rev < 0 ? -p.speed : p.speed) : walking ? 3 : 0;
    online.tick(dt, { x: p.x, z: p.z, h: p.h, speed, inCar: this.inCar, flame: this.inCar ? this.flame : 0 });
  }

  // Sprite for another player's car (cached until their build changes).
  peerSprite(p) {
    const key = JSON.stringify([p.model.id, p.visual, p.levels]);
    if (p.spriteKey !== key) { p.sprite = carSprite(p.model, p.visual, p.levels, null); p.spriteKey = key; }
    return p.sprite;
  }

  drawPeers(ctx, v) {
    const cam = this.cam;
    const peers = online.list().filter(p => !p.fresh && p.x > v.x0 - 8 && p.x < v.x1 + 8 && p.z > v.z0 - 8 && p.z < v.z1 + 8);
    for (const p of peers) {
      if (p.inCar) {
        this.drawShadow(ctx, p.x, p.z, p.h, dimsFor(p.model));
        drawCar(ctx, this.peerSprite(p), cam.sx(p.x), cam.sy(p.z), p.h, cam.zoom);
      } else {
        drawPerson(ctx, cam.sx(p.x), cam.sy(p.z), p.h, cam.zoom, { top: '#3a6bff' }, p.sp ? p.walk : 0);
      }
    }
    return peers;
  }

  drawPeerFlames(ctx, peers) {
    const cam = this.cam;
    for (const p of peers) {
      if (!p.inCar || p.flame < 0.04) continue;
      ctx.save(); ctx.translate(cam.sx(p.x), cam.sy(p.z)); ctx.rotate(p.h); ctx.scale(cam.zoom, cam.zoom);
      drawFlameJets(ctx, p.model, p.visual, p.flame);
      ctx.restore();
    }
  }

  drawPeerTags(ctx, peers) {
    const cam = this.cam;
    ctx.save();
    ctx.font = '600 13px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of peers) {
      const label = p.crew ? `[${p.crew.tag}] ${p.name}` : p.name;
      const w = ctx.measureText(label).width + 14;
      ctx.save();
      ctx.translate(cam.sx(p.x), cam.sy(p.z)); ctx.rotate(-cam.rot);   // keep tags upright in the chase camera
      const x = 0, y = -(p.inCar ? 3.2 : 1.8) * cam.zoom;
      ctx.fillStyle = 'rgba(8,9,12,0.78)'; ctx.fillRect(x - w / 2, y - 9, w, 18);
      ctx.fillStyle = p.crew ? p.crew.color : '#ff2a3a'; ctx.fillRect(x - w / 2, y - 9, 3, 18);
      ctx.fillStyle = '#f2f4f8'; ctx.fillText(label, x, y + 1);
      ctx.restore();
    }
    ctx.restore();
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
    const need = tickNeeds(s, dt);   // hunger + energy drain while you play (core/needs.js)
    if (need) this.ui.toast(need, 'info');
    if (Math.floor(before / 60) !== Math.floor(s.time.min / 60)) this.onHour();
    if (s.time.min >= 1440) { s.time.min -= 1440; s.time.day++; this.ui.onNewDay(); }
  }

  onHour() {
    const s = this.s;
    const nw = nextWeather(s.weather);
    if (nw !== s.weather) { s.weather = nw; this.ui.toast(weatherToast(nw), isWet(s) ? 'bad' : 'info'); }
    const shift = nightShift(s.time);
    if (shift !== this.lastShift) {
      if (this.lastShift != null) {
        if (shift === 1 && !this.lastShift) this.ui.toast('🌙 FWPD night shift is out. More patrols on the streets.', 'bad');
        else if (shift === 2) this.ui.toast('🚓 After midnight: patrols doubled up. Drive easy.', 'bad');
        else if (!shift) this.ui.toast('☀ Sun\'s up. Night shift heading in.', 'info');
      }
      this.lastShift = shift;
    }
    if (Math.floor(s.time.min / 60) === 8) this.ui.onMorning();
    this.ui.onHour();
  }

  // Busted: the car is towed to the impound lot and locked until you pay the
  // you sign it out at the Central Precinct (ui/places.js), free. You're let go there.
  impound() {
    const s = this.s, car = activeCar(s);
    // in a stolen car: it goes back to its owner, yours stays where you parked it
    const hot = this.thefts.busted();
    if (!hot) {
      if (!car || car.stolen) return;
      car.impound = { day: s.time?.day ?? 0 };
      const lot = this.homeSpot(LOC_BY_ID[IMPOUND_LOT]);
      this.placeCar(car, lot.x, lot.z, lot.h);
      s.carPos = { x: lot.x, z: lot.z, h: lot.h };
    }
    this.inCar = false;
    input.setContext('foot');
    if (this.engine) { this.engine.stop(); this.engine = null; }
    const l = LOC_BY_ID[IMPOUND_LOT];
    this.foot.x = l.x; this.foot.z = l.z; this.foot.h = l.face;
    if (this.cam) { this.cam.x = l.x; this.cam.z = l.z; }
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
    } else if (this.thefts.tryOwn()) {
      /* back in your own car; the stolen one is dumped */
    } else if (this.vehicle) {
      if (Math.hypot(this.vehicle.x - this.foot.x, this.vehicle.z - this.foot.z) < 4.5) {
        if (this.vehicle.car.impound) { this.ui.toast(`Impounded. Sign it out inside the Central Precinct`, 'bad'); return; }
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
    const hm = healthMods(this.s);   // a bad leg: slower, and no running
    const sp = (run ? (hm.noRun ? 2.4 : 5.2 * runMul(this.s)) : 1.8) * hm.speed;
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
    grip *= wx(s).grip;
    const noFuel = car.fuel <= 0.0005 || !!car.engineBlown || !!car.broken;   // a blown motor or a breakdown makes no power either
    v.update(dt, {
      throttle: input.axis('throttle'), brake: input.axis('brake'), steer: input.steer(),
      handbrake: input.held('handbrake'), nitrous: input.held('nitrous'),
      shiftUp: input.pressed('shiftUp'), shiftDown: input.pressed('shiftDown'),
      auto: settings.transmission === 'auto',
      // gas + brake with no 2-step fitted = burnout (with one it's launch-control hold, handled below)
      burnout: !(v.spec.twoStep >= 1),
    }, { grip, drag: paved ? 0 : sand ? 2.2 : 1.6, noFuel });
    if (v.shifted) { v.shifted = false; audio.shift(); }
    if (input.pressed('horn')) { audio.horn(); online.honk(); }
    // gas + brake while stopped: rev it. With a 2-step it holds the launch rpm
    // and throws flames; without one it just revs into the limiter.
    if (!this.limiter || this.limiter.spec !== v.spec || this.limiter.car !== car) {
      this.limiter = new RevLimiter(v.spec, launchRpmSetting(v.spec, car)); this.limiter.car = car;
    }
    this.limiter.target = launchRpmSetting(v.spec, car);   // follows the Garage → Tune setting
    const revving = !noFuel && v.model.asp !== 'ev' && v.rev > -1 && (v.speed < 1.5 || v.burning) && input.axis('throttle') > 0.3 && input.axis('brake') > 0.3;
    const lr = this.limiter.update(dt, revving);
    this.flame = lr.flame;
    if (revving) { v.sim.rpm = lr.rpm; v.rev = 0; }   // gas + brake beats the reverse gear creeping in
    if (lr.bang) { audio.pop(); if (settings.shake) this.cam.shake = Math.max(this.cam.shake, 0.12); }
    if (car.broken && !car.engineBlown && input.axis('throttle') > 0 && !this.brokeWarned) { this.brokeWarned = true; this.ui.toast(wearMessage(car.broken, car), 'bad'); }
    if (!car.broken) this.brokeWarned = false;
    if (noFuel && !car.engineBlown && !car.broken && input.axis('throttle') > 0 && !this.fuelWarned) { this.fuelWarned = true; this.ui.toast('Out of gas! Call roadside assistance from your phone (Bank → Roadside) or push it to a station.', 'bad'); }

    // buildings / water
    for (const c of v.circles()) {
      const hit = collideCircle(this.map, c.x, c.z, c.r);
      if (hit) {
        const imp = v.bounce(hit.nx, hit.nz, hit.pen);
        if (imp > 3) this.onCrash(imp, hit.c.water ? 'water' : 'wall');
      }
    }
    // traffic + police cars
    for (const o of [...this.traffic.cars, ...this.police.patrols, ...this.police.units, ...this.races.cars(), ...this.thefts.obstacles()]) {
      const d = Math.hypot(o.x - v.x, o.z - v.z);
      const rr = (v.dims.W + (o.dims?.W || 1.9)) / 2 + 0.9;
      if (d < rr) {
        const nx = (v.x - o.x) / (d || 1), nz = (v.z - o.z) / (d || 1);
        const imp = v.bounce(nx, nz, rr - d);
        if (o.hit) o.hit(imp); else o.v *= 0.5;
        if (imp > 2.5 && (o.rival || o.own)) this.onCrash(imp, 'car');   // trading paint with your rival is racing, not a hit-and-run
        else if (imp > 2.5) {
          this.onCrash(imp, o.police ? 'police' : 'car');
          this.setOffence(o.police || this.police.units.includes(o) ? 1.5 : 0.8, o.police ? 'Assault on an officer with a vehicle!' : 'Hit-and-run collision.', 'crash', o.police ? 'assault' : 'hitrun', o.police ? 2500 : 650);
        }
      }
    }

    // fuel + odometer
    const dist = v.speed * dt;
    car.miles += dist / 1609.34;
    s.stats.miles += dist / 1609.34;
    const thr = input.axis('throttle');
    // the engine sips a little just idling; the city is compressed, so it all burns FUEL_BURN times faster
    const idle = noFuel || v.model.asp === 'ev' ? 0 : dt * 0.00012;
    const gal = (dist / 1609.34 / carMpg(car) * (0.5 + thr * 0.9 + (v.sim.nosOn ? 1 : 0)) + idle) * FUEL_BURN;
    car.fuel = Math.max(0, car.fuel - gal / tankGallons(car));
    if (car.fuel < 0.12 && !this.lowFuelWarned) { this.lowFuelWarned = true; this.ui.toast('Fuel low — find a gas station', 'bad'); }
    if (car.fuel > 0.2) { this.lowFuelWarned = false; this.fuelWarned = false; }
    // tire wear from wheelspin
    if (v.sim.slip > 0.2) car.cond.tires = Math.max(1, car.cond.tires - dt * 0.6 * v.sim.slip);
    // upkeep: oil life, tread, everyday wear, and breakdowns when it's been let go
    const wear = wearTick(car, dist / 1609.34, { spec: v.spec, slip: v.sim.slip, dt });
    if (wear) {
      this.ui.toast(wearMessage(wear, car), wear === 'oilLow' || wear === 'tiresLow' ? 'info' : 'bad');
      if (wear === 'blowout') { audio.crash(0.6); this.refreshCarSprite(); }
      if (BREAKDOWNS[wear]) { audio.crash?.(0.5); this.brokeWarned = true; emit('breakdown', { kind: wear }); }
    }
    // worn parts cost power and grip: refresh the sim when they cross a step (not every frame)
    const wk = `${Math.floor(car.cond.engine / 10)}|${Math.floor(car.cond.trans / 10)}|${Math.ceil(car.cond.tires / 5)}`;
    if (this.wearKey && this.wearKey !== wk) v.setSpec(carSpec(car));
    this.wearKey = wk;
    // an aggressive tune knocks (or floats the valves) at wide-open throttle
    // drag pack wheelies: warn once per pull when it stands up
    if (v.sim.standing && !this.wheelieWarned) { this.wheelieWarned = true; this.ui.toast('Wheelie! Front end is way up. Lift to set it down. Tune it out in Garage → Tune → Drag launch.', 'bad'); }
    if (v.sim.pitch === 0 && v.sim.v < 2) this.wheelieWarned = false;
    const eng = engineStress(car, v.spec, thr, v.sim.rpm, dt, v.sim.nosOn);
    if (eng) {
      this.ui.toast(engineMessage(eng, v.spec), eng === 'stress' ? 'info' : 'bad');
      if (eng === 'blown') { audio.crash?.(1.2); v.setSpec(carSpec(car)); }
    }

    // skid marks + smoke (burnouts light up the driven axle, slides light up the rears)
    const fwdBurn = v.burning && v.spec.drive === 'FWD';
    if ((v.skid > 0 || v.sim.slip > 0.25) && (v.speed > 0.5 || v.burning)) {
      const sgn = fwdBurn ? 1 : -1;
      const bx = v.x + sgn * Math.sin(v.h) * v.dims.L * 0.32, bz = v.z - sgn * Math.cos(v.h) * v.dims.L * 0.32;
      const rx = Math.cos(v.h) * v.dims.W * 0.4, rz = Math.sin(v.h) * v.dims.W * 0.4;
      if (this.lastSkid && Math.hypot(bx - this.lastSkid.x, bz - this.lastSkid.z) > 0.12) {
        for (const k of [-1, 1]) this.skids.push([this.lastSkid.x + this.lastSkid.rx * k, this.lastSkid.z + this.lastSkid.rz * k, bx + rx * k, bz + rz * k]);
      }
      if (!this.lastSkid || Math.hypot(bx - this.lastSkid.x, bz - this.lastSkid.z) > 0.12) this.lastSkid = { x: bx, z: bz, rx, rz };
      const puffs = v.burning ? 2 : Math.random() < 0.5 ? 1 : 0;
      for (let i = 0; i < puffs; i++) {
        const k = i % 2 ? 1 : -1;
        this.smoke.push({ x: bx + rx * k * 0.8, z: bz + rz * k * 0.8, r: v.burning ? 0.8 : 0.5, life: v.burning ? 1.8 : 1.2, a: v.burning ? 0.5 : 0.32 });
      }
      if (this.skids.length > 1100) this.skids.splice(0, 100);
      if (this.smoke.length > 160) this.smoke.splice(0, this.smoke.length - 160);
    } else this.lastSkid = null;
    if ((car.cond.engine < 35 || car.broken === 'overheat') && Math.random() < dt * (car.engineBlown || car.broken === 'overheat' ? 18 : 6)) {
      this.smoke.push({ x: v.x + Math.sin(v.h) * v.dims.L * 0.4, z: v.z - Math.cos(v.h) * v.dims.L * 0.4, r: 0.8, life: 2, a: 0.4, dark: true });
    }
    for (const sm of this.smoke) { sm.life -= dt; sm.r += dt * 1.1; }
    this.smoke = this.smoke.filter(sm => sm.life > 0);

    // ---- offences (only matter if a cop sees them) ----
    const edge = onRoad?.edge;
    const limit = edge ? (edge.kind === 'highway' ? 29 : edge.kind === 'desert' ? 24.6 : 15.6) : 15.6;
    if (v.speed > limit + 13) this.setOffence(dt * (v.speed > limit + 24 ? 0.9 : 0.45), `Speeding — ${Math.round(v.speed * MPH)} in a ${Math.round(limit * MPH)}.`, undefined, 'speeding', 150 + Math.round(Math.max(0, (v.speed - limit) * MPH - 10) * 18));
    if (v.sim.slip > 0.4 && v.speed < 8) this.setOffence(dt * 0.25, 'Exhibition of speed (burnout).', undefined, 'burnout', 450);
    // red lights
    const node = this.map.roads.nearestNode(v.x, v.z);
    if (node && node.edges.length >= 3 && Math.abs(node.x) <= 900 && Math.abs(node.z) <= 900 && Math.abs(v.x - node.x) < ROAD_W / 2 && Math.abs(v.z - node.z) < ROAD_W / 2) {
      if (this.redLightNode !== node.id && v.speed > 6) {
        const sig = signalState(node, this.signalT);
        const ns = Math.abs(v.vz) > Math.abs(v.vx);
        if ((ns !== sig.nsGreen) && !sig.yellow) this.setOffence(0.7, 'Ran a red light.', 'red' + node.id, 'redlight', 320);
        this.redLightNode = node.id;
      }
    } else this.redLightNode = null;

    // how loud the car is right now (cops listen)
    this.liveDb = liveNoiseDb(this.staticDb ?? noiseDb(v.model, v.car.parts), thr, v.sim.rpm / v.spec.redline);
    // engine audio
    if (this.engine) {
      this.engine.update({ rpm: v.sim.rpm, throttle: thr, boost: v.sim.boost, slip: Math.max(v.sim.slip, v.skid * 0.7), turbo: v.spec.asp === 'turbo', speed: v.speed });
    }
    if (v.sim.nosOn && !this.nosSound) { audio.nos(); this.nosSound = true; }
    if (!v.sim.nosOn) this.nosSound = false;
  }

  setOffence(heat, text, onceKey, kind, fine) {
    if (onceKey) {
      if (this.offenceCooldown[onceKey] > this.t) return;
      this.offenceCooldown[onceKey] = this.t + 4;
    }
    if (!this.offence || this.offence.heat < heat) this.offence = { heat, text, kind, fine };
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
    // a hard hit hurts you too; hard enough and you crash out and wake up at JPS
    if (impact > 18 && !this.downed && this.combat) {
      const a = this.combat.arms;
      a.hp -= (impact - 18) * 3;
      if (impact > 40 || a.hp <= 0) {
        a.hp = 1;
        this.ui.hospital?.({ cause: 'crash', sev: Math.min(1, (impact - 18) / 30), why: what === 'police' ? 'You hit a squad car and blacked out.' : what === 'water' ? 'You went into the water. Somebody pulled you out.' : 'You crashed out.' });
      } else if (impact > 24) this.ui.toast(`Hard hit. You're hurt (health ${Math.max(1, Math.round(a.hp))}).`, 'bad');
    }
  }

  onSpikes() {
    const car = this.vehicle.car;
    car.cond.tires = 0;
    this.vehicle.setSpec(carSpec(car));
    this.refreshCarSprite();
    audio.crash(0.6);
    this.ui.toast('SPIKE STRIP! Tires are shredded — grip is gone.', 'bad');
  }

  // warrantStop: you pulled over for a ticket and the officer found your warrant.
  // Anything criminal (not just a ticket) is filed as a case at the Tarrant
  // County Courthouse: the magistrate sets bail and a court date (ui/court.js).
  onBusted(fine, ticketOnly, record = [], warrantStop = false) {
    const s = this.s;
    this.races.cancel('cops');
    if (ticketOnly) {
      if (!spend(s, fine, 'FWPD traffic citation')) { s.bank -= Math.max(0, fine - s.cash - s.bank); s.cash = 0; }
      this.ui.modal('Pulled over', `<p>The officer writes you a ticket for ${fmtMoney(fine)}. "Slow it down out here."</p>`);
      emit('busted', { fine, ticket: true });
      return;
    }
    fine += this.combat.onBusted(record);
    const hotCar = !!this.vehicle?.car?.hot;
    // they chased you down: that's evading, on top of whatever they saw
    const ph = this.police.phase, items = record.slice();
    items.push(...seizeBag(s));   // they search you: any product on you is a charge
    const cash = seizeCash(s);    // and a dirty stack gets seized (a laundering charge if it's big)
    items.push(...cash.items);
    items.push(...seizeLoot(s));  // and stolen goods are evidence
    if (ph !== 'none' && ph !== 'notice' && ph !== 'stop' && this.police.eyesOn !== false && !items.some(r => r.kind === 'evading')) {
      items.push(this.inCar && this.police.level >= 2 ? { kind: 'evading', text: 'Evading arrest (in a vehicle).' } : { kind: 'evading', text: 'Evading arrest.' });
    }
    // every open warrant and unpaid ticket comes off the board too
    const wr = takeWarrants(s);
    const now = charge(items, 0.85), old = charge(wr.items, 0.6);
    const tickets = [...now.tickets, ...old.tickets].reduce((t, r) => t + (r.fine || 0), 0) + wr.tickets;
    const insured = s.insurance;
    const total = Math.round(fine * (insured ? 0.75 : 1)) + tickets;
    if (!spend(s, total, 'FWPD fines + impound')) { s.bank -= Math.max(0, total - s.cash - s.bank); s.cash = 0; }
    addRep(s, -60, 'Busted'); s.stats.busted++;
    const charges = [...now.charges, ...old.charges];
    // a case you skipped court on comes back to life too
    const c = charges.length || openCase(s)?.fta ? fileCase(s, charges) : null;
    this.impound();
    const list = c ? `<div class="charges">${c.charges.map(x => `<div>⚖ ${esc(x.text)}</div>`).join('')}</div>` : '';
    this.ui.modal('BUSTED',
      `${warrantStop ? '<p class="muted">"License and registration... Step out of the car, please. You have an active warrant."</p>' : ''}<p>You're in cuffs. ${hotCar ? 'The stolen car goes back to its owner. Your own car is still where you left it.' : 'Your car gets towed to the impound lot behind the FWPD Central Precinct.'}</p><p>Fines${tickets ? ' and tickets' : ''}: <b>${fmtMoney(total)}</b>${insured ? ' (insurance covered 25%)' : ''}. Rep −60.</p>${hotCar ? '' : '<p class="small muted">To get the car back, go into the Central Precinct and sign it out. No charge.</p>'}${cash.seized ? `<p class="bad">They seized <b>${fmtMoney(cash.seized)}</b> in cash you couldn't explain.</p>` : ''}${wr.n ? `<p class="small muted">${wr.n} warrant${wr.n > 1 ? 's' : ''} served.</p>` : ''}${c ? `<p>You're booked into the Tarrant County Jail on:</p>${list}` : '<p class="small muted">No criminal charges. They let you go at the precinct.</p>'}`,
      [{ label: c ? 'See the magistrate' : 'OK', primary: true }]).then(() => { if (c) this.ui.book?.(c); });
    emit('busted', { fine: total, charges: charges.length });
  }

  // You pulled over and the officer is at your window with everything they
  // saw. Resolves 'flee' if you pull off instead of taking the ticket,
  // 'busted' if the car gets impounded, otherwise 'paid'.
  async onTrafficStop(record) {
    const s = this.s;
    const items = record.map(r => ({ ...r }));
    let total = items.reduce((t, r) => t + r.fine, 0);
    const hasNoise = items.some(r => r.kind === 'noise');
    const priors = s.stats.noiseTickets || 0;
    const count = () => { s.stats.tickets = (s.stats.tickets || 0) + 1; if (hasNoise) s.stats.noiseTickets = priors + 1; };
    // third noise citation: they want the car off the road
    if (hasNoise && priors >= 2) { count(); this.onBusted(1200, false); return 'busted'; }
    const say = hasNoise ? '"Sir, you could hear that thing from three blocks away. Step out of the car — license and registration."'
      : items.some(r => r.kind === 'speeding') ? '"Do you know how fast you were going?"' : '"License and registration. You know why I pulled you over?"';
    const list = () => items.map(r => `<div class="row" style="justify-content:space-between"><span>${esc(r.text)}</span><b>${fmtMoney(r.fine)}</b></div>`).join('');
    const pick = await this.ui.modal('Traffic stop',
      `<p class="small muted">The officer leans in at your window with the ticket book.</p><p class="muted">${esc(say)}</p><div style="margin:10px 0">${list()}</div><p><b>Total: ${fmtMoney(total)}</b></p>${hasNoise ? `<p class="small muted">Noise citation${priors ? ` (#${priors + 1}) — a third one gets the car impounded` : ''}. Quieter exhaust, quieter tickets.</p>` : ''}`,
      [{ label: 'Accept the citation', primary: true, value: 'accept' }, { label: `Sign it, pay within ${CITATION_DAYS} days`, value: 'sign' }, { label: 'Try to talk your way out', value: 'argue' }, { label: 'Pull off', danger: true, value: 'flee' }]);
    if (pick === 'flee') return 'flee';
    count();
    let note = '';
    if (pick === 'argue') {
      const chance = Math.max(0.05, 0.15 + tierOf(s.rep).n * 0.04 - priors * 0.05 - (hasNoise ? 0.05 : 0));
      if (Math.random() < chance) { total = 0; note = 'The officer sighs. "Just a warning this time. Get that fixed."'; }
      else { total = Math.round(total * 1.4); note = '"Now you\'re getting every violation I saw." Fines go up 40%.'; }
    }
    // Can't pay on the spot (or chose not to): sign for it. Leave it unpaid
    // past the due date and it turns into a warrant.
    let signed = null;
    if (total > 0 && (pick === 'sign' || !spend(s, total, 'FWPD traffic citation'))) signed = signCitation(s, items, total);
    this.ui.modal(signed ? 'Citation signed' : total ? 'Citation issued' : 'Warning', signed
      ? `<p>You owe <b>${fmtMoney(total)}</b>, due by day ${signed.due}. Pay it at a precinct or in the FWPD app on your phone.</p><p class="small muted">Miss the date and it becomes a warrant for your arrest.</p>`
      : `<p>${total ? `You paid <b>${fmtMoney(total)}</b>. ` : ''}${esc(note || '"Drive safe. Keep it under control."')}</p>`);
    emit('busted', { fine: total, ticket: true });
    return 'paid';
  }

  // record: what they saw you do; seen: whether they ever got eyes on you
  onEscaped(record = [], seen = true) {
    const s = this.s;
    s.stats.pursuitsEscaped++;
    const lvl = Math.max(1, Math.floor(s.heat));
    addRep(s, 80 * lvl, 'Escaped the cops');
    s.followers += 40 * lvl;
    // they know who you are: a warrant goes out for the chase and anything they saw
    const wr = warrantForEscape(s, seen ? record : record.filter(r => r.kind === 'robbery' || r.kind === 'shots' || r.kind === 'assault' || r.kind === 'carjack'), lvl, seen);
    const anon = wr.unidentified ? ` Nobody could ID you behind the mask${wr.unidentified > 1 ? ` (${wr.unidentified} crimes)` : ''}.` : '';
    this.ui.toast(`ESCAPED! +${80 * lvl} rep.${wr.length ? ' A warrant is out for you — patrols will know your plate.' : ' Heat will cool down if you lay low.'}${anon}`, 'good');
    emit('pursuitEscaped', { level: lvl });
  }

  // Pull the mask down or up (V / the MASK button). Never in a car.
  toggleMask() {
    if (this.inCar) return;
    const on = toggleMask(this.s);
    if (on === null) { this.ui.toast('You don\'t own a mask. Riverside Army Surplus sells them.', 'info'); return; }
    audio.click();
    this.ui.toast(on ? 'Mask down. Witnesses won\'t see your face, but cops notice a ski mask.' : 'Mask off.', 'info');
  }

  // A patrol stopped you for walking around masked: the mask comes off and
  // they run your name. A warrant makes it an arrest.
  async onMaskStop() {
    const s = this.s;
    s.player.maskStash = s.player.look.mask; s.player.look.mask = 'no_mask';
    if (hasWarrant(s)) {
      this.police.phase = 'notice';
      this.onBusted(400, false, this.police.record.slice(), true);
      this.police.reset(this);
      return;
    }
    s.heat = Math.max(s.heat, 0.5);
    this.police.decayHold = 25;
    await this.ui.modal('Stopped and questioned', `<p class="muted">"Evening. Take the mask off for me... Any reason you're walking around dressed like that?"</p><p>The officer runs your name. You're clean, so they let you go: "Lose the mask. People call us about it."</p><p class="small muted">Masks keep witnesses from naming you during a crime, but wearing one on the street gets you looked at. Pull it down right before (V or MASK) and off right after.</p>`);
  }

  updatePoliceAudio() {
    const lvl = this.police.level;
    if (this.police.active && this.police.phase !== 'stop') audio.siren(true, Math.min(1, 0.4 + lvl * 0.15));
  }

  streetAt(x, z) { return this.map.roads.streetName(x, z); }
  districtAt(x, z) { return districtAt(x, z); }

  updateInteractions() {
    const p = this.playerState();
    const st = this.s;
    let best = null, bd = 10;
    for (const l of LOCATIONS) {
      const d = Math.hypot(l.x - p.x, l.z - p.z);
      if (d < bd) { bd = d; best = l; }
    }
    // garages: doors open for places you own, the roof fades when you're inside
    let inside = null, hint = '';
    for (const g of this.map.garages) {
      const owned = st.properties.includes(g.id);
      g.panel.off = owned;
      const inn = g.inner;
      if (owned && p.x > inn.x && p.x < inn.x + inn.w && p.z > inn.z && p.z < inn.z + inn.d) inside = g;
      else if (owned && !inside && Math.hypot(p.x - g.park.x, p.z - g.park.z) < 22 && true) {
        hint = this.inCar ? `Drive into the garage — ${g.loc.name.split(' (')[0]}` : `Walk into your garage — ${g.loc.name.split(' (')[0]}`;
      }
    }
    if (inside && inside !== this.inGarage) this.ui.toast(`${inside.loc.name.split(' (')[0]} — your garage. Press E to manage your cars.`, 'info');
    this.inGarage = inside;
    this.garageHint = inside ? '' : hint;
    if (inside) best = inside.loc;   // anywhere inside counts as being at the door
    if (this.inCar && this.vehicle && this.vehicle.speed > 4 && !inside) best = null;
    if (inside && this.inCar && this.vehicle.speed > 6) best = null;
    if (this.races.active) best = null;
    this.nearLoc = best;
    if (input.pressed('interact')) {
      if (this.combat.tryInteract(best)) { /* robbery or mugging started */ }
      else if (best && this.combat.armed && this.combat.storeNear()) this.ui.toast('Holster your weapon (G) to go inside.', 'info');
      else if (best) this.ui.openPlace(best, this);
    }
  }

  // Your other cars, parked in the bays of the garages you own.
  updateGarageCars(dt) {
    this.garageT -= dt;
    if (this.garageT > 0) return;
    this.garageT = 0.5;
    const st = this.s;
    const others = st.cars.filter(c => c.uid !== st.activeCar && !c.stolen);
    const order = [...new Set([st.home, ...st.properties])].map(id => this.map.garages.find(g => g.id === id)).filter(Boolean);
    const out = [];
    let k = 0;
    for (const g of order) {
      for (const bay of g.bays) {
        const car = others[k++];
        if (!car) break;
        const model = CAR_BY_ID[car.modelId];
        if (!model) continue;
        const key = car.uid + JSON.stringify([car.visual, levels(car), (car.cond?.body ?? 100) | 0]);
        let spr = this.garageSprites.get(key);
        if (!spr) { spr = carSprite(model, car.visual, levels(car), car.cond, { crewColor: st.crew?.color }); this.garageSprites.set(key, spr); }
        out.push({ x: bay.x, z: bay.z, h: bay.h, sprite: spr, dims: dimsFor(model), garage: g.id, car });
      }
    }
    this.garageCars = out;
    if (this.garageSprites.size > 40) this.garageSprites.clear();
  }

  // The road route from where you are to (x, z): { path: [[x, z], …], names, meters }.
  routeTo(x, z) {
    const p = this.playerState();
    const heading = this.inCar && this.vehicle && this.vehicle.speed > 3 ? this.vehicle.h : null;
    return this.map.roads.routeBetween(p.x, p.z, x, z, heading);
  }
  updateGps() {
    const r = this.routeTo(this.s.gps.x, this.s.gps.z);
    this.gpsPath = r.path; this.gpsNames = r.names;
  }
  // Where you are along the GPS route right now: the closest segment i
  // (path[i-1] → path[i]), how far along it (t, 0–1) and how far off it (d).
  gpsProgress() {
    const path = this.gpsPath, p = this.playerState();
    // stick to the road part of the route while you're on it (not the hop
    // from where you were standing onto the road)
    const best = roadOnly => {
      let i = 1, t = 0, d = Infinity;
      for (let k = 1; k < path.length; k++) {
        if (roadOnly && this.gpsNames?.[k - 1] == null) continue;
        const [ax, az] = path[k - 1], [bx, bz] = path[k], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
        const tk = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / L2));
        const dk = Math.hypot(ax + dx * tk - p.x, az + dz * tk - p.z);
        if (dk < d - 0.01) { d = dk; i = k; t = tk; }
      }
      return { i, t, d, p };
    };
    const r = best(true);
    return r.d < 12 ? r : best(false);
  }
  // Turn-by-turn: the next turn on the route and how far away it is, measured
  // from where you are right now. { turn: 'left'|'right'|'uturn'|'arrive', dist, street, total }
  navInfo() {
    const path = this.gpsPath, s = this.s;
    if (!path || !s.gps || path.length < 2) return null;
    const { i: best, t: bt, d: bd } = this.gpsProgress();
    const seg = i => Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    let dist = bd + seg(best) * (1 - bt), total = 0, turn = null;
    for (let i = best; i < path.length - 1; i++) {
      // a corner is a turn when the road changes direction by more than ~35°
      const [ax, az] = path[i - 1], [bx, bz] = path[i], [cx, cz] = path[i + 1];
      const ix = bx - ax, iz = bz - az, ox = cx - bx, oz = cz - bz;
      const ang = Math.atan2(ix * oz - iz * ox, ix * ox + iz * oz);
      const onRoad = this.gpsNames?.[i - 1] != null && this.gpsNames?.[i] != null;   // not the hop on/off the road at either end
      if (!turn && onRoad && Math.abs(ang) > 0.6) turn = { turn: Math.abs(ang) > 2.6 ? 'uturn' : ang > 0 ? 'right' : 'left', dist, street: this.gpsNames?.[i] || null };
      dist += seg(i + 1);
    }
    total = dist;
    return { ...(turn || { turn: 'arrive', dist: total, street: s.gps.label }), total, label: s.gps.label };
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
    // Chase camera: draw the world into a square big enough that rotating it
    // about the screen centre never shows an empty corner.
    const rotated = Math.abs(cam.rot) > 0.002, D = rotated ? Math.ceil(Math.hypot(W, H)) : 0;
    cam.vw = W; cam.vh = H;
    cam.w = rotated ? D : W; cam.h = rotated ? D : H;
    let shakeX = 0, shakeY = 0;
    if (cam.shake > 0) { shakeX = (Math.random() - 0.5) * cam.shake * 14; shakeY = (Math.random() - 0.5) * cam.shake * 14; cam.shake = Math.max(0, cam.shake - dt * 2.5); }
    ctx.save();
    ctx.translate(shakeX, shakeY);
    if (rotated) { ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(cam.rot); ctx.translate(-D / 2, -D / 2); }
    drawGround(ctx, cam);
    drawWater(ctx, cam, this.map, this.t);
    const v = cam.view(60);
    const items = this.map.drawGrid.query(v.x0, v.z0, v.x1, v.z1);
    drawLots(ctx, cam, items);
    drawRoads(ctx, cam, this.map, this.signalT);
    drawSkids(ctx, cam, this.skids);
    if (isWet(s)) { ctx.fillStyle = `rgba(40,60,90,${0.12 * wx(s).rain})`; ctx.fillRect(0, 0, cam.w, cam.h); }

    this.drawGpsRoute(ctx, cam, 1);
    this.races.drawRoute(ctx, cam);
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
      if (pd.down) { ctx.fillStyle = pd.color; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(cam.sx(pd.x), cam.sy(pd.z), 0.55 * cam.zoom, 0.28 * cam.zoom, 0.6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c68e65'; ctx.beginPath(); ctx.arc(cam.sx(pd.x) + 0.4 * cam.zoom, cam.sy(pd.z) - 0.15 * cam.zoom, 0.16 * cam.zoom, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      else drawPerson(ctx, cam.sx(pd.x), cam.sy(pd.z), pd.cower ? Math.PI : 0, cam.zoom, { top: pd.color, skin: '#c68e65', hair: '#222' }, pd.cower ? 0 : this.t * 6 * pd.sp);
    }
    // cars
    const cars = [...this.traffic.cars, ...this.police.patrols, ...this.police.units, ...this.police.blocks.flatMap(b => b.cars), ...this.races.cars()];
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
      drawCarPitched(ctx, this.carSpriteImg, cam.sx(pv.x), cam.sy(pv.z), pv.h, cam.zoom, pv.sim.pitch, pv.dims.L, !!pv.spec.barH);
      if (pv.sim.nosOn && this.inCar) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const bx = pv.x - Math.sin(pv.h) * (pv.dims.L / 2 + 0.6), bz = pv.z + Math.cos(pv.h) * (pv.dims.L / 2 + 0.6);
        const g = ctx.createRadialGradient(cam.sx(bx), cam.sy(bz), 0, cam.sx(bx), cam.sy(bz), 1.6 * cam.zoom);
        g.addColorStop(0, 'rgba(140,110,255,0.9)'); g.addColorStop(1, 'rgba(60,40,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cam.sx(bx), cam.sy(bz), 1.6 * cam.zoom, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    // the officer walking up during a traffic stop
    const cop = this.police.officer;
    if (cop) drawPerson(ctx, cam.sx(cop.x), cam.sy(cop.z), cop.h, cam.zoom, OFFICER_LOOK, cop.moving ? cop.walk : 0);
    if (!this.inCar) drawPerson(ctx, cam.sx(this.foot.x), cam.sy(this.foot.z), this.foot.h, cam.zoom, this.s.player.look, this.foot.moving ? this.foot.walk : 0, true);
    this.combat.draw(ctx, cam);
    this.carjacks.draw(ctx, cam);
    this.thefts.draw(ctx, cam);
    this.gigs.draw(ctx, cam);
    this.gangs.draw(ctx, cam);

    const livePeers = online.active ? this.drawPeers(ctx, v) : [];

    // your other cars, parked inside the garages (the roof is drawn over them and fades out)
    for (const c of this.garageCars) {
      if (c.x < v.x0 || c.x > v.x1 || c.z < v.z0 || c.z > v.z1) continue;
      this.drawShadow(ctx, c.x, c.z, c.h, c.dims);
      drawCar(ctx, c.sprite, cam.sx(c.x), cam.sy(c.z), c.h, cam.zoom);
    }
    // "drive in" chevrons leading into the door
    if (this.garageHint && !this.inGarage) {
      for (const g of this.map.garages) {
        if (!st0(this, g) || Math.hypot(g.park.x - cam.x, g.park.z - cam.z) > 90) continue;
        const pulse = (this.t * 1.6) % 1;
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let k = 0; k < 3; k++) {
          const f = (k + pulse) / 3;                                  // 0..1 travelling toward the door
          const px = g.park.x + g.inDir.x * (f * 10 - 3), pz = g.park.z + g.inDir.z * (f * 10 - 3);
          const ang = Math.atan2(g.inDir.z, g.inDir.x);
          ctx.globalAlpha = Math.sin(f * Math.PI) * 0.9;
          ctx.strokeStyle = '#2cff7a'; ctx.lineWidth = Math.max(2, 0.55 * cam.zoom);
          ctx.beginPath();
          const sx = cam.sx(px), sy = cam.sy(pz), r = 1.7 * cam.zoom;
          ctx.moveTo(sx + Math.cos(ang + 2.5) * r, sy + Math.sin(ang + 2.5) * r);
          ctx.lineTo(sx + Math.cos(ang) * r * 0.6, sy + Math.sin(ang) * r * 0.6);
          ctx.lineTo(sx + Math.cos(ang - 2.5) * r, sy + Math.sin(ang - 2.5) * r);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // smoke
    for (const sm of this.smoke) {
      ctx.fillStyle = sm.dark ? `rgba(40,40,40,${sm.a * sm.life / 2})` : `rgba(220,220,220,${sm.a * sm.life / 1.4})`;
      ctx.beginPath(); ctx.arc(cam.sx(sm.x), cam.sy(sm.z), sm.r * cam.zoom, 0, Math.PI * 2); ctx.fill();
    }

    drawBuildings(ctx, cam, items, night);
    drawTrees(ctx, cam, items);
    this.combat.drawOverlay(ctx, cam);
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
      for (const p of livePeers) if (p.inCar) carsLit.push({ x: p.x, z: p.z, h: p.h, lightsOn: true, beam: 28 });
      if (this.vehicle && this.inCar && this.vehicle.car.cond.lights >= 20) carsLit.push({ x: this.vehicle.x, z: this.vehicle.z, h: this.vehicle.h, lightsOn: true, beam: 34 });
      const pulse = Math.sin(this.t * 14) > 0;
      for (const c of [...this.police.patrols.filter(p => this.police.active), ...this.police.units, ...this.police.blocks.flatMap(b => b.cars)]) {
        if (c.lightBar === false || c.x < v.x0 || c.x > v.x1 || c.z < v.z0 || c.z > v.z1) continue;
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
      if (this.police.heli) blobs.push({ x: this.police.heli.spot.x, z: this.police.heli.spot.z, r: 22, a: 1 });
      for (const l of LOCATIONS) glows.push({ x: l.x, z: l.z, r: 7, color: l.color, a: 0.18 });
      if (this.inGarage) glows.push({ x: this.inGarage.center.x, z: this.inGarage.center.z, r: 15, color: 'rgba(255,240,205,1)', a: 0.85 });
      drawLighting(ctx, cam, night, this.map.lights, { cars: carsLit, glows, blobs });
      this.drawGpsRoute(ctx, cam, night * 0.85, true);   // the route glows through the dark
      this.races.drawRoute(ctx, cam, night * 0.7, true);
    } else if (this.police.active) {
      // daytime light bars still flash
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pulse = Math.sin(this.t * 14) > 0;
      for (const c of [...this.police.units, ...this.police.patrols]) {
        if (c.lightBar === false) continue;
        ctx.fillStyle = pulse ? 'rgba(255,30,30,0.35)' : 'rgba(40,90,255,0.35)';
        ctx.beginPath(); ctx.arc(cam.sx(c.x), cam.sy(c.z), 4 * cam.zoom, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    if (this.police.heli) {
      // spotlight: a faint beam from Air One down to the pool of light on the target
      const hl = this.police.heli, hx = cam.sx(hl.x), hy = cam.sy(hl.z), lx = cam.sx(hl.spot.x), ly = cam.sy(hl.spot.z), lr = 20 * cam.zoom;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const ang = Math.atan2(ly - hy, lx - hx), nx = -Math.sin(ang), ny = Math.cos(ang);
      const beam = ctx.createLinearGradient(hx, hy, lx, ly);
      beam.addColorStop(0, 'rgba(255,255,230,0.12)'); beam.addColorStop(1, 'rgba(255,255,230,0.03)');
      ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lx + nx * lr * 0.6, ly + ny * lr * 0.6); ctx.lineTo(lx - nx * lr * 0.6, ly - ny * lr * 0.6); ctx.closePath(); ctx.fill();
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      g.addColorStop(0, 'rgba(255,255,230,0.25)'); g.addColorStop(1, 'rgba(255,255,230,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // search zone
    if ((this.police.phase === 'search' || this.police.phase === 'cooldown') && this.police.lastSeen) {
      ctx.strokeStyle = this.police.phase === 'cooldown' ? 'rgba(255,200,0,0.6)' : 'rgba(255,40,40,0.6)';
      ctx.setLineDash([10, 8]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cam.sx(this.police.lastSeen.x), cam.sy(this.police.lastSeen.z), this.police.searchR * cam.zoom, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    // 2-step flames out of the exhaust tips
    if (this.vehicle && this.inCar && this.flame > 0.04) {
      const pv = this.vehicle;
      ctx.save(); ctx.translate(cam.sx(pv.x), cam.sy(pv.z)); ctx.rotate(pv.h); ctx.scale(cam.zoom, cam.zoom);
      drawFlameJets(ctx, pv.model, pv.car.visual, this.flame);
      ctx.restore();
    }
    if (livePeers.length) { this.drawPeerFlames(ctx, livePeers); this.drawPeerTags(ctx, livePeers); }
    if (rotated) { ctx.restore(); cam.w = W; cam.h = H; }   // rain and fog are screen effects: not rotated
    drawRain(ctx, cam, wx(s).rain, dt);
    if (s.weather === 'storm') this.lightning(ctx, W, H, dt);
    if (s.weather === 'fog') { ctx.fillStyle = 'rgba(180,185,195,0.28)'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();

    // GPS arrow at screen edge
    if (s.gps) {
      const [gx, gy] = cam.screen(s.gps.x, s.gps.z);
      if (gx < 0 || gx > W || gy < 0 || gy > H) {
        const a = Math.atan2(gy - H / 2, gx - W / 2);
        const r = Math.min(W, H) / 2 - 40;
        ctx.save(); ctx.translate(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r); ctx.rotate(a);
        ctx.fillStyle = '#ff2a3a'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    this.races.drawOverlay(ctx, W, H);
  }

  // The GPS route painted on the road: a dark casing, a bright red ribbon
  // and white chevrons flowing toward the destination, plus a pulsing ring
  // on the destination itself. `glow` redraws it additively after the night
  // lighting so it stays readable in the dark.
  drawGpsRoute(ctx, cam, alpha, glow = false) {
    const full = this.gpsPath, g = this.s.gps;
    if (!full || !g || alpha <= 0.01) return;
    // start the line where you are now, not where the route was last worked out
    const { i: k, t: kt, d: off, p } = this.gpsProgress();
    const [ax0, az0] = full[k - 1], [bx0, bz0] = full[k];
    const path = [[ax0 + (bx0 - ax0) * kt, az0 + (bz0 - az0) * kt], ...full.slice(k)];
    if (off > 10) path.unshift([p.x, p.z]);
    const z = cam.zoom, v = cam.view(20);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (glow) ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const line = () => { ctx.beginPath(); path.forEach(([x, zz], i) => i ? ctx.lineTo(cam.sx(x), cam.sy(zz)) : ctx.moveTo(cam.sx(x), cam.sy(zz))); ctx.stroke(); };
    if (!glow) { ctx.strokeStyle = 'rgba(30,0,6,0.55)'; ctx.lineWidth = Math.max(9, 4.2 * z); line(); }
    ctx.strokeStyle = glow ? 'rgba(255,40,60,0.55)' : 'rgba(255,42,58,0.82)'; ctx.lineWidth = Math.max(5, 2.6 * z); line();
    // chevrons every 7 m, sliding along the route (spaced from the
    // destination end, so they don't jump when the route is refreshed)
    let len = 0;
    for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    const gap = 7, cs = Math.max(4, 0.95 * z);
    ctx.strokeStyle = glow ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.92)'; ctx.lineWidth = Math.max(2, 0.42 * z);
    let along = (((len - this.t * 9) % gap) + gap) % gap;
    for (let i = 1; i < path.length; i++) {
      const [ax, az] = path[i - 1], [bx, bz] = path[i], L = Math.hypot(bx - ax, bz - az);
      if (L < 0.01) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      const segVisible = !(Math.max(ax, bx) < v.x0 || Math.min(ax, bx) > v.x1 || Math.max(az, bz) < v.z0 || Math.min(az, bz) > v.z1);
      if (segVisible) {
        for (let d = along; d < L; d += gap) {
          const x = cam.sx(ax + ux * d), y = cam.sy(az + uz * d);
          ctx.beginPath();
          ctx.moveTo(x - ux * cs - uz * cs * 0.8, y - uz * cs + ux * cs * 0.8);
          ctx.lineTo(x, y);
          ctx.lineTo(x - ux * cs + uz * cs * 0.8, y - uz * cs - ux * cs * 0.8);
          ctx.stroke();
        }
      }
      along = ((along - L) % gap + gap) % gap;
    }
    // destination ring
    const gx = cam.sx(g.x), gy = cam.sy(g.z), pulse = (this.t * 0.8) % 1;
    ctx.strokeStyle = `rgba(255,42,58,${(1 - pulse) * 0.9})`; ctx.lineWidth = Math.max(3, 0.5 * z);
    ctx.beginPath(); ctx.arc(gx, gy, (3 + pulse * 6) * z, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,42,58,0.35)'; ctx.beginPath(); ctx.arc(gx, gy, 3 * z, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
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

  // A storm throws a white flash across the whole screen now and then, with
  // thunder rolling in a beat later.
  lightning(ctx, W, H, dt) {
    this.boltT = (this.boltT ?? 4 + Math.random() * 8) - dt;
    if (this.boltT <= 0) { this.bolt = 1; this.boltT = 5 + Math.random() * 12; this.thunderT = 0.4 + Math.random() * 1.2; }
    if (this.thunderT != null && (this.thunderT -= dt) <= 0) { this.thunderT = null; audio.thunder?.(); }
    if (this.bolt > 0) {
      ctx.fillStyle = `rgba(225,230,255,${0.55 * this.bolt * (Math.random() < 0.3 ? 0.4 : 1)})`;
      ctx.fillRect(0, 0, W, H);
      this.bolt = Math.max(0, this.bolt - dt * 4);
    }
  }

  darkness() {
    const h = hourOf(this.s.time);
    let d;
    if (h >= 21 || h < 4.5) d = 0.78;
    else if (h >= 18) d = (h - 18) / 3 * 0.78;
    else if (h < 7) d = (7 - h) / 2.5 * 0.78;
    else d = 0;
    if (this.s.weather === 'storm') d = Math.max(d, 0.32);
    else if (isWet(this.s) || this.s.weather === 'fog') d = Math.max(d, 0.18);
    return clamp(d, 0, 0.78);
  }

  destroy() {
    this.races.destroy();
    if (this.engine) this.engine.stop();
    audio.siren(false);
    audio.music(null);
  }
}
