// Roll races and drag races. Cars run up the screen on a straight road built
// for the venue. Both drivers use the same powertrain sim; the AI has a
// reaction time, shift accuracy and nitrous habits from its skill.

import { newSim, stepSim, shiftUp, shiftDown, bestGearFor, wheelRpm, DIST, MPH } from '../sim/powertrain.js';
import { carSprite, drawCar, drawCarPitched, dimsFor } from '../gfx2d/carSprite.js';
import { CARS } from '../data/cars.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/save.js';
import { game, isNight } from '../core/state.js';
import { $, el, esc } from '../ui/dom.js';
import { touchUi } from '../ui/touch.js';
import { pad } from '../core/gamepad.js';
import { RevLimiter, launchRpmSetting, optimalLaunchRpm } from '../sim/twostep.js';
import { soundProfile } from '../sim/sound.js';
import { engineStress, engineMessage } from '../sim/engine.js';
import { drawFlameJets } from '../gfx2d/flames.js';
import { drawRain } from '../world2d/render.js';
import { wx } from '../core/weather.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// instruction text: phone wording when the on-screen controls are showing
// controller: the touch wording with the triggers named
const padText = t => t.replace('drag the shift knob down to downshift', 'LB to downshift').replace(/\bBRAKE\b/g, 'LT').replace(/\bGAS\b/g, 'RT');
const T = (phone, keys) => pad.inUse ? padText(phone) : touchUi.active ? phone : keys;
// fit the whole road comfortably on narrow screens
const H_ZOOM = () => Math.min(14, window.innerWidth / 34);
const THEMES = {
  highway: { lanes: 6, laneW: 3.7, ground: '#2f3a26', road: '#26272b', side: 'barrier', props: 'city', median: true },
  industrial: { lanes: 4, laneW: 3.6, ground: '#4a4b4f', road: '#2c2d31', side: 'curb', props: 'warehouse' },
  desert: { lanes: 2, laneW: 3.7, ground: '#c2a172', road: '#2e2f33', side: 'none', props: 'cactus' },
  mountain: { lanes: 2, laneW: 3.6, ground: '#2a3a24', road: '#2c2d31', side: 'rail', props: 'pine' },
  strip: { lanes: 2, laneW: 4.6, ground: '#3c3d41', road: '#4b4c50', side: 'wall', props: 'stands' },
};

class Driver {
  constructor({ name, car, model, spec, visual, levels, cond, isPlayer, skill = 0.6 }) {
    Object.assign(this, { name, car, model, spec, visual, isPlayer, skill });
    this.flame = 0; this.flameCount = 0;
    this.dims = dimsFor(model);
    this.sprite = carSprite(model, visual, levels, cond);
    this.lane = 0; this.x = 0; this.y = 0;
    this.sim = null;
    this.finished = false; this.time = null; this.trap = 0;
    this.splits = {};
    this.rt = null; this.launched = false; this.redLight = false;
    this.staged = false; this.preStaged = false;
    this.shiftErr = (1 - skill) * 900;
    this.nosAt = 0.25 + Math.random() * 0.2;
    this.wobble = 0;
  }
}

export class Race {
  constructor(opts, onDone) {
    this.o = opts;
    this.onDone = onDone;
    this.theme = THEMES[opts.road] || THEMES.highway;
    this.isDrag = opts.type === 'drag';
    this.dist = DIST[opts.dist] || DIST.quarter;
    this.t = 0;
    this.phase = this.isDrag ? 'burnout' : 'pace';
    this.msg = ''; this.sub = '';
    this.night = isNight(game.s.time) && opts.road !== 'strip' ? 0.6 : isNight(game.s.time) ? 0.25 : 0;
    this.traffic = [];
    this.smoke = [];
    this.marks = [];
    const th = this.theme;
    const laneX = i => (i - (th.lanes - 1) / 2) * th.laneW;
    this.laneX = laneX;
    // drivers
    this.p = new Driver({ ...opts.player, isPlayer: true });
    this.drivers = [this.p];
    if (opts.npc) { this.n = new Driver({ ...opts.npc, isPlayer: false }); this.drivers.push(this.n); }
    // Wet street: both cars lose grip. The strip is prepped and stays dry.
    const sky = wx(game.s);
    this.rain = opts.road === 'strip' ? 0 : sky.rain;
    this.storm = game.s.weather === 'storm' && this.rain > 0;
    if (this.rain > 0) for (const d of this.drivers) d.spec = { ...d.spec, mu: d.spec.mu * sky.grip };
    if (this.isDrag) {
      this.p.lane = 0; this.p.x = laneX(0);
      if (this.n) { this.n.lane = 1; this.n.x = laneX(1); } else { this.p.lane = 0; }
      for (const d of this.drivers) {
        d.y = -14; d.sim = newSim(d.spec, { v: 0, tireTemp: 0.45 }); d.sim.nos = d.isPlayer ? (d.car.nos ?? d.spec.nosSecs) : d.spec.nosSecs;
        d.rev = new RevLimiter(d.spec, d.isPlayer ? launchRpmSetting(d.spec, d.car) : optimalLaunchRpm(d.spec));
      }
      this.tree = { ambers: 0, green: false, red: [false, false], startAt: null, greenAt: null, pro: (opts.tier || 1) >= 3 };
      this.msg = 'BURNOUT'; this.sub = T('Hold BRAKE + GAS to heat the tires · then ease on the GAS to roll into the beams', 'Hold S + W to heat the tires · then tap W to roll into the beams');
    } else {
      const v = opts.roll / MPH;
      const lanes = th.lanes;
      const pl = lanes >= 4 ? Math.floor(lanes / 2) - 1 : 0, nl = pl + 1;
      this.p.lane = pl; this.p.x = laneX(pl);
      if (this.n) { this.n.lane = nl; this.n.x = laneX(nl); }
      for (const d of this.drivers) {
        d.y = -v * 3.6;
        d.sim = newSim(d.spec, { v, gear: bestGearFor(d.spec, v) });
        d.sim.nos = d.isPlayer ? (d.car.nos ?? d.spec.nosSecs) : d.spec.nosSecs;
        d.sim.boost = 0.4;
      }
      this.honks = 0;
      this.msg = `${opts.roll} ROLL`; this.sub = T('◀ ▶ change lanes · drag the shift knob down to downshift · floor the GAS on the third honk', 'Hold your lane · downshift now (Q) if you want · go on the third honk');
      // traffic on public roads
      const n = Math.round((opts.trafficDensity ?? 0.4) * this.dist / 120);
      for (let i = 0; i < n; i++) this.spawnTraffic(80 + Math.random() * (this.dist + 300));
    }
    if (this.rain > 0) this.sub += ` · ${this.storm ? '⛈ Flooded' : '🌧 Wet'} roads: ease on the gas`;
    this.cam = { y: this.p.y, zoom: 13 };
    this.engineP = audio.engine({ profile: soundProfile(this.p.model, this.p.spec.lv, this.p.car?.parts) });
    this.engineN = this.n ? audio.engine({ profile: soundProfile(this.n.model, this.n.spec.lv, this.n.car?.parts), volume: 0.65 }) : null;
    audio.music(this.isDrag ? null : 'race');
    touchUi.setRace(this.isDrag ? 'drag' : 'roll');
    this.hud = el(`<div class="race-hud"><div class="race-top">
      <div><b data-spd>0</b><small>${settings.units === 'kmh' ? 'km/h' : 'mph'}</small></div><div><b data-gear>1</b><small>gear</small></div><div><b data-time>0.000</b><small>time</small></div><div><b data-gap>—</b><small>gap</small></div><div><b data-left>—</b><small>to go</small></div></div>
      <div class="race-msg" data-msg></div><div class="race-sub" data-sub></div>
      ${this.isDrag ? `<div class="tree"><div class="lbl">PRE-STAGE</div><i data-ps0></i><i data-ps1></i><div class="lbl">STAGE</div><i data-s0></i><i data-s1></i><i data-a10></i><i data-a11></i><i data-a20></i><i data-a21></i><i data-a30></i><i data-a31></i><i data-g0></i><i data-g1></i><i data-r0></i><i data-r1></i><div class="lbl">YOU · ${this.n ? 'THEM' : '—'}</div></div>` : ''}
      <div class="hud-dash" style="right:14px;bottom:14px"><div class="dash-tach"><div data-rpm></div></div><div class="dash-row"><span>NOS</span><div class="bar thin nos"><div data-nos></div></div></div><div class="dash-row"><span>TIRES</span><div class="bar thin"><div data-temp></div></div></div></div>
    </div>`);
    document.body.appendChild(this.hud);
    this.q = s => this.hud.querySelector(`[data-${s}]`);
  }

  spawnTraffic(y) {
    const th = this.theme;
    const pool = CARS.filter(c => !c.market && c.msrp < 60000);
    const m = pool[Math.floor(Math.random() * pool.length)];
    const lane = Math.floor(Math.random() * th.lanes);
    this.traffic.push({ model: m, dims: dimsFor(m), sprite: carSprite(m, { paint: ['#9aa0a8', '#24262b', '#f2f2f2', '#3d4452', '#7a1414', '#1b4fc4'][Math.floor(Math.random() * 6)] }, {}), lane, x: this.laneX(lane), y, v: 24 + Math.random() * 6, targetLane: lane });
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    dt = Math.min(dt, 0.033);
    this.t += dt;
    const P = this.p, N = this.n;
    if (this.phase === 'done') { this.updateCoast(dt); return; }
    if (this.isDrag) this.updateDrag(dt); else this.updateRoll(dt);
    // traffic
    for (const c of this.traffic) {
      c.y += c.v * dt;
      for (const d of this.drivers) {
        if (Math.abs(d.x - c.x) < (d.dims.W + c.dims.W) / 2 + 0.2 && Math.abs(d.y - c.y) < (d.dims.L + c.dims.L) / 2) {
          if (d.y < c.y) {
            // rear-ended traffic
            const rel = d.sim.v - c.v;
            if (rel > 2) {
              d.sim.v = Math.max(c.v * 0.8, d.sim.v * 0.45);
              d.y = c.y - (d.dims.L + c.dims.L) / 2 - 0.2;
              d.crashes = (d.crashes || 0) + 1;
              if (d.isPlayer) { audio.crash(Math.min(1.5, rel / 14)); this.crashDamage = (this.crashDamage || 0) + rel * 1.6; this.flash('CRASH', 'Watch the traffic!'); }
            }
          }
        }
      }
    }
    // smoke
    for (const s of this.smoke) { s.life -= dt; s.r += dt * 3; s.y += s.vy * dt; }
    this.smoke = this.smoke.filter(s => s.life > 0);
    // camera
    const lead = Math.max(P.y, N && Math.abs(N.y - P.y) < 30 ? N.y : P.y);
    const target = (P.y * 0.7 + lead * 0.3) + P.sim.v * 0.35;
    this.cam.y += (target - this.cam.y) * Math.min(1, dt * 6);
    this.cam.zoom += ((Math.min(14, Math.max(8, H_ZOOM())) / (1 + P.sim.v / 90)) - this.cam.zoom) * Math.min(1, dt * 1.5);
    this.updateAudio();
    this.updateHud();
  }

  updateAudio() {
    const P = this.p, N = this.n;
    this.engineP?.update({ rpm: P.sim.rpm, throttle: P.thr || 0, boost: P.sim.boost, slip: P.sim.slip, turbo: P.spec.asp === 'turbo', speed: P.sim.v });
    if (N) this.engineN?.update({ rpm: N.sim.rpm, throttle: N.thr || 0, boost: N.sim.boost, slip: N.sim.slip, turbo: N.spec.asp === 'turbo', volume: clamp(1 - Math.abs(N.y - P.y) / 120, 0.1, 1), pan: N.x > P.x ? 0.5 : -0.5, speed: N.sim.v });
  }

  playerInput() {
    return {
      throttle: input.axis('throttle'), brake: input.axis('brake'), nitrous: input.held('nitrous'), gasTap: input.pressed('throttle'),
      up: input.pressed('shiftUp'), down: input.pressed('shiftDown'), left: input.pressed('left'), right: input.pressed('right'),
      auto: settings.transmission === 'auto',
    };
  }

  // ---------------- roll racing ----------------
  updateRoll(dt) {
    const P = this.p, N = this.n;
    const inp = this.playerInput();
    const rollV = this.o.roll / MPH;
    if (this.phase === 'pace') {
      // cars cruise side by side; driver can pick a gear
      if (inp.down) { if (shiftDown(P.spec, P.sim)) audio.shift(); }
      if (inp.up) shiftUp(P.spec, P.sim);
      for (const d of this.drivers) {
        stepSim(d.spec, d.sim, { throttle: 0.25, auto: false }, dt);
        d.sim.v = rollV; d.y += rollV * dt;
        d.thr = 0.25;
      }
      // AI smart drivers downshift for the pull
      if (N && !N.downshifted && this.t > 1 && N.skill > 0.5) { N.downshifted = true; const g = bestGearFor(N.spec, rollV); if (g < N.sim.gear) { N.sim.gear = g; } }
      const honkTimes = [1.6, 2.6, 3.6];
      while (this.honks < 3 && this.t >= honkTimes[this.honks]) {
        this.honks++;
        audio.horn();
        this.flash(this.honks < 3 ? 'HONK' : 'GO!', this.honks === 1 ? 'Two more…' : this.honks === 2 ? 'Next one is GO' : '');
        if (this.honks === 3) { this.phase = 'race'; this.goT = this.t; for (const d of this.drivers) { d.startY = d.y; d.y = 0; } }
      }
      if (this.honks >= 1 && inp.throttle > 0.5 && this.t < honkTimes[2] - 0.12) {
        this.jumped = true; this.finish('jump');
      }
      return;
    }
    // racing
    const raceT = this.t - this.goT;
    this.drivePlayer(P, inp, dt, true);
    if (N) this.driveAI(N, dt, raceT);
    this.checkSplits(raceT);
    this.drafting();
  }

  drivePlayer(P, inp, dt, allowLanes) {
    if (allowLanes && !this.isDrag) {
      if (inp.left) P.lane = Math.max(0, P.lane - 1);
      if (inp.right) P.lane = Math.min(this.theme.lanes - 1, P.lane + 1);
    }
    if (inp.up && shiftUp(P.spec, P.sim)) audio.shift();
    if (inp.down) shiftDown(P.spec, P.sim);
    P.thr = inp.throttle;
    stepSim(P.spec, P.sim, { throttle: P.car?.engineBlown ? 0 : inp.throttle, brake: inp.brake, nitrous: inp.nitrous, auto: inp.auto, launchRpm: P.launchRpm }, dt);
    if (P.sim.gear > 0 || P.sim.v > 8) P.launchRpm = null;
    // drag pack wheelies
    if (P.sim.standing && !P.stoodUp) { P.stoodUp = true; this.flash('WHEELIE!', T('Way too much! Let off the GAS to set it down', 'Way too much! Lift off W to set it down')); }
    else if (P.sim.pitch > 0.15 && !P.wheelied) { P.wheelied = true; if (P.sim.pitch < 0.5) this.flash('WHEELIE', 'Front end up'); }
    const eng = engineStress(P.car, P.spec, inp.throttle, P.sim.rpm, dt, P.sim.nosOn);
    if (eng === 'blown') this.flash('BLOWN', 'You blew the motor.');
    else if (eng === 'critical') this.flash('KNOCK', 'Engine is about to let go!');
    else if (eng === 'warn') this.flash('KNOCK', 'Rod knock. Back off.');
    P.y += P.sim.v * dt;
    P.x += (this.laneX(P.lane) - P.x) * Math.min(1, dt * 4);
    if (P.sim.nosOn && !P.nosSnd) { audio.nos(); P.nosSnd = true; }
    if (P.sim.slip > 0.25) this.puff(P);
  }

  driveAI(N, dt, raceT) {
    const reaction = N.reaction ?? (N.reaction = 0.12 + (1 - N.skill) * 0.4 + Math.random() * 0.12);
    const go = raceT >= reaction;
    let thr = go ? 1 : this.isDrag ? 0 : 0.25;
    // traction management: good drivers feather wheelspin
    if (go && N.sim.slip > 0.35 && Math.random() < N.skill) thr = 0.75;
    // and pedal a wheelie back down
    if (go && N.sim.pitch > 0.6) thr = 0.55;
    N.thr = thr;
    // shifting with human error
    if (N.sim.shiftT <= 0 && N.sim.gear < N.spec.gears.length - 1) {
      const target = N.spec.shiftRpm[N.sim.gear] + (N.err ?? (N.err = (Math.random() - 0.5) * N.shiftErr));
      if (N.sim.rpm >= Math.min(N.spec.redline - 20, target)) { shiftUp(N.spec, N.sim); N.err = null; }
    }
    const nos = go && N.spec.nosHp > 0 && N.y > this.dist * N.nosAt;
    stepSim(N.spec, N.sim, { throttle: thr, nitrous: nos, auto: false, launchRpm: N.launchRpm }, dt);
    if (N.sim.gear > 0 || N.sim.v > 8) N.launchRpm = null;
    N.y += N.sim.v * dt;
    if (!this.isDrag) {
      // avoid traffic ahead
      const ahead = this.traffic.find(c => c.lane === N.lane && c.y > N.y && c.y - N.y < 30 + N.sim.v);
      if (ahead) {
        const options = [N.lane - 1, N.lane + 1].filter(l => l >= 0 && l < this.theme.lanes && l !== this.p.lane && !this.traffic.some(c => c.lane === l && Math.abs(c.y - N.y) < 20));
        if (options.length && Math.random() < 0.4 + N.skill * 0.6) N.lane = options[0];
      }
      N.x += (this.laneX(N.lane) - N.x) * Math.min(1, dt * 3.5);
    }
    if (N.sim.slip > 0.25) this.puff(N);
  }

  drafting() {
    const [a, b] = this.drivers;
    if (!b) return;
    for (const [lead, chase] of [[a, b], [b, a]]) {
      const gap = lead.y - chase.y;
      chase.sim.draft = Math.abs(lead.x - chase.x) < 1.6 && gap > 3 && gap < 25 ? 0.3 * (1 - gap / 25) : 0;
    }
  }

  checkSplits(raceT) {
    for (const d of this.drivers) {
      if (d.finished) continue;
      const marks = { sixty: 18.29, three30: 100.58, eighth: DIST.eighth, thousand: 304.8, quarter: DIST.quarter, half: DIST.half };
      for (const [k, m] of Object.entries(marks)) {
        if (d.splits[k] == null && d.y >= m && m <= this.dist + 0.1) { d.splits[k] = raceT - (d.rt || 0); d.splits[k + 'Mph'] = d.sim.v * MPH; }
      }
      if (d.y >= this.dist) {
        d.finished = true; d.time = raceT - (this.isDrag ? (d.rt ?? 0) : 0); d.elapsed = raceT; d.trap = d.sim.v * MPH;
        if (!this.firstAcross) { this.firstAcross = d; this.flash(d.isPlayer ? 'WIN' : this.n ? 'LOSS' : 'FINISH', ''); }
      }
    }
    if (this.drivers.every(d => d.finished) || (this.firstAcross && this.t - this.goT > (this.firstAcrossT ??= this.t - this.goT) + 4)) this.finish('done');
  }

  // ---------------- drag racing ----------------
  updateDrag(dt) {
    const P = this.p, N = this.n, tr = this.tree;
    const inp = this.playerInput();
    if (this.phase === 'burnout') {
      if (inp.brake > 0.5 && inp.throttle > 0.5) {
        P.burn = (P.burn || 0) + dt;
        P.sim.tireTemp = Math.min(1.15, P.sim.tireTemp + dt * 0.18);
        P.sim.rpm += (P.spec.redline * 0.82 - P.sim.rpm) * dt * 6;
        P.thr = 1; P.sim.slip = 1;
        this.puff(P, 3);
        this.sub = `Burnout! Tires ${Math.round(P.sim.tireTemp * 100)}° — ${T('let off and ease on the GAS to roll up', 'let off and tap W to roll up')}`;
      } else {
        P.thr = 0; P.sim.slip = 0;
        P.sim.rpm += (P.spec.idle + 300 - P.sim.rpm) * dt * 4;
        if (inp.throttle > 0.5 && inp.brake < 0.1) { this.phase = 'stage'; this.msg = 'STAGE'; this.sub = T('Hold GAS to creep forward · it stops when both STAGE lights are on', 'Hold W to creep forward · stop when both STAGE lights are on'); }
      }
      if (N) { N.sim.tireTemp = Math.min(1.1, N.sim.tireTemp + dt * 0.12 * N.skill); if (this.t < 2.5) this.puff(N, 2); }
      if (this.t > 1.2 && this.t < 1.4 && !P.burn) this.sub = T('Hold BRAKE + GAS to heat the tires (skip it if you like) · GAS to roll up', 'Hold S + W to heat the tires (skip it if you like) · W to roll up');
      return;
    }
    if (this.phase === 'stage') {
      // roll up fast, then inch into the beams; the car stops itself once staged
      const creep = inp.throttle > 0.5 ? (P.y < -0.8 ? 7 : 0.9) : 0;
      P.y = Math.min(-0.1, P.y + creep * dt);
      if (N && N.y < -0.1) { N.y = Math.min(-0.1, N.y + dt * (N.y < -0.8 ? 6 : 0.8)); }
      P.preStaged = P.y > -0.55; P.staged = P.y > -0.18;
      if (N) { N.preStaged = N.y > -0.55; N.staged = N.y > -0.18; }
      if (P.staged && (!N || N.staged)) {
        this.phase = 'tree';
        tr.startAt = this.t + 0.6 + Math.random() * 0.9;
        this.msg = ''; this.sub = this.loadHint();
      }
      return;
    }
    if (this.phase === 'tree') {
      // revving against the brake
      const holding = inp.brake > 0.5;
      // gas + brake: a 2-step holds the launch rpm and throws flames; without
      // one the engine just revs into the limiter (no flames)
      const r = P.rev.update(dt, holding && inp.throttle > 0.5);
      P.sim.rpm = r.rpm; P.flame = r.flame;
      if (r.bang) { P.flameCount++; audio.pop(); }
      if (P.spec.asp === 'turbo' && holding && inp.throttle > 0.5) P.sim.boost = Math.min(1, P.sim.boost + dt * 0.8 * clamp(P.sim.rpm / P.spec.spoolRpm, 0, 1));
      P.thr = holding ? inp.throttle : 0;
      // tree sequence
      const t = this.t - tr.startAt;
      if (t >= 0) {
        if (tr.pro) { tr.ambers = 3; if (t >= 0.4 && !tr.green) { tr.green = true; tr.greenAt = tr.startAt + 0.4; audio.treeGreen(); } else if (!tr.amberSnd) { tr.amberSnd = true; audio.treeAmber(); } }
        else {
          const a = Math.min(3, Math.floor(t / 0.5) + 1);
          if (a > tr.ambers) { tr.ambers = a; audio.treeAmber(); }
          if (t >= 1.5 && !tr.green) { tr.green = true; tr.greenAt = tr.startAt + 1.5; audio.treeGreen(); }
        }
      }
      // player launch
      // two ways off the line: release the brake while on the gas, or a fresh stab of the gas
      const launchNow = (P.wasHolding && !holding && inp.throttle > 0.5) || (!holding && inp.gasTap && !P.wasHolding);
      P.wasHolding = holding && inp.throttle > 0.5 ? true : (holding ? P.wasHolding : false);
      if (launchNow && !P.launched) {
        if (!tr.green) { this.redLight(P, 'Left before the green'); return; }
        P.launched = true;
        const tired = (100 - game.s.player.energy) / 100 * 0.08;
        P.rt = (this.t - tr.greenAt) + tired;
        P.tired = tired;
        P.launchRpm = P.spec.twoStep ? P.rev.releaseRpm() : Math.max(P.sim.rpm, P.spec.idle + 800);
        P.flame = 0;
        if (!this.goT) this.goT = tr.greenAt;
      }
      if (N && !N.launched && N.spec.twoStep && N.staged) {
        const r = N.rev.update(dt, true);
        N.sim.rpm = r.rpm; N.flame = r.flame; N.thr = 1;
        if (r.bang) { N.flameCount++; audio.pop(0.5); }
      }
      this.aiLaunch(N);
      if (P.launched) this.phase = 'race';
      else if (tr.green && this.t - tr.greenAt > 4) { this.flash('ASLEEP', 'You never left the line'); P.redLight = true; this.finish('redlight'); return; }
      // NPC can go first; we still wait for the player
      if (N?.launched) this.driveLaunched(N, dt);
      return;
    }
    if (this.phase === 'race') {
      const raceT = this.t - this.goT;
      this.drivePlayer(P, inp, dt, false);
      if (N) { this.aiLaunch(N); if (N.launched) this.driveLaunched(N, dt); }
      this.checkSplits(raceT);
    }
  }

  loadHint() {
    const P = this.p;
    if (P.spec.twoStep) {
      const n = Math.round(P.rev.target / 100) * 100;
      return T(`2-STEP: hold BRAKE + GAS — it holds ${n.toLocaleString()} rpm and pops flames · let go of BRAKE on GREEN`, `2-STEP: hold S + W — it holds ${n.toLocaleString()} rpm and pops flames · release S on GREEN`);
    }
    return T('Hold BRAKE + GAS to load it up · let go of BRAKE on GREEN', 'Hold S + W to load it up · release S (or press W) on GREEN');
  }

  aiLaunch(N) {
    const tr = this.tree;
    {
      if (N && !N.launched && tr.startAt && this.t > tr.startAt) {
        if (N.foulRoll === undefined) N.foulRoll = Math.random() < (1 - N.skill) * 0.07;
        const rt = N.reaction ?? (N.reaction = (N.foulRoll ? -0.05 : 0.04 + (1 - N.skill) * 0.3 + Math.random() * 0.1));
        const greenT = tr.startAt + (tr.pro ? 0.4 : 1.5);
        if (this.t >= greenT + rt) {
          if (rt < 0) { tr.red[1] = true; N.redLight = true; }
          N.launched = true; N.rt = rt;
          N.launchRpm = N.spec.twoStep ? N.rev.releaseRpm() : N.spec.asp === 'turbo' ? N.spec.redline * (0.55 + N.skill * 0.1) : N.spec.redline * (0.42 + N.skill * 0.1);
          N.flame = 0;
          N.sim.boost = N.spec.asp === 'turbo' ? 0.7 : 0;
          if (!this.goT) this.goT = greenT;
        }
      }
    }
  }

  driveLaunched(N, dt) {
    const raceT = this.t - this.goT;
    const save = N.reaction; N.reaction = -1;
    this.driveAI(N, dt, raceT + 10);
    N.reaction = save;
  }

  redLight(d, why) {
    d.redLight = true;
    this.tree.red[d.isPlayer ? 0 : 1] = true;
    audio.error();
    this.flash('RED LIGHT', why);
    this.finish('redlight');
  }

  flash(msg, sub) { this.msg = msg; this.sub = sub; this.msgT = this.t; }

  puff(d, n = 1) {
    for (let i = 0; i < n; i++) this.smoke.push({ x: d.x + (Math.random() - 0.5) * d.dims.W, y: d.y - d.dims.L * 0.4, r: 1 + Math.random(), life: 1.6, vy: d.sim.v * 0.6 });
    if (this.smoke.length > 220) this.smoke.splice(0, 40);
  }

  updateCoast(dt) {
    for (const d of this.drivers) { stepSim(d.spec, d.sim, { throttle: 0, brake: 0.5 }, dt); d.y += d.sim.v * dt; d.thr = 0; }
    for (const c of this.traffic) c.y += c.v * dt;
    this.cam.y += ((this.p.y + this.p.sim.v * 0.3) - this.cam.y) * Math.min(1, dt * 4);
    this.updateAudio();
  }

  finish(reason) {
    if (this.phase === 'done') return;
    this.phase = 'done';
    this.endReason = reason;
    audio.music(null);
    setTimeout(() => this.showResults(), reason === 'done' ? 1600 : 1200);
  }

  showResults() {
    const P = this.p, N = this.n;
    let won = false, voided = false;
    if (this.endReason === 'jump') { voided = true; }
    else if (this.endReason === 'redlight') won = !P.redLight;
    else if (!N) won = true;
    else if (P.redLight && !N.redLight) won = false;
    else if (N.redLight && !P.redLight) won = true;
    else {
      // elapsed from the green for drag (includes reaction), finish order for roll
      const pt = this.isDrag ? (P.rt ?? 0) + (P.time ?? 99) : (P.elapsed ?? 99);
      const nt = this.isDrag ? (N.rt ?? 0) + (N.time ?? 99) : (N.elapsed ?? 99);
      won = pt <= nt;
      if (P.finished && N.finished) this.margin = Math.abs(pt - nt);
    }
    const result = { won, voided, reason: this.endReason, type: this.o.type, dist: this.o.dist, player: summary(P), npc: N ? summary(N) : null, margin: this.margin, crashDamage: this.crashDamage || 0, nosUsed: P.spec.nosSecs ? (P.car.nos ?? P.spec.nosSecs) - P.sim.nos : 0, tired: P.tired || 0, burn: P.burn || 0 };
    this.destroy();
    this.onDone(result);
  }

  updateHud() {
    const P = this.p, N = this.n;
    const kmh = settings.units === 'kmh';
    this.q('spd').textContent = Math.round(P.sim.v * (kmh ? 3.6 : MPH));
    const gearTxt = P.sim.shiftT > 0 ? '–' : P.model.asp === 'ev' ? 'D' : String(P.sim.gear + 1);
    this.q('gear').textContent = gearTxt;
    touchUi.setGear(gearTxt);
    touchUi.setShiftCue(this.goT && !P.finished && P.model.asp !== 'ev' && P.sim.shiftT <= 0 && P.sim.gear < P.spec.gears.length - 1 && P.sim.rpm > P.spec.redline * 0.92);
    const raceT = this.goT ? Math.max(0, this.t - this.goT) : 0;
    this.q('time').textContent = this.goT && this.phase !== 'pace' ? (P.finished ? P.elapsed : raceT).toFixed(3) : '0.000';
    if (N) {
      const gap = N.y - P.y;
      const gapCars = gap / P.dims.L;
      this.q('gap').textContent = this.goT ? (Math.abs(gapCars) < 0.2 ? 'EVEN' : `${gapCars > 0 ? '−' : '+'}${Math.abs(gapCars).toFixed(1)} car`) : '—';
      this.q('gap').style.color = gap > 0 ? 'var(--red2)' : 'var(--green)';
    }
    this.q('left').textContent = this.goT ? `${Math.max(0, Math.round((this.dist - P.y) * 3.281))} ft` : `${Math.round(this.dist * 3.281)} ft`;
    this.q('rpm').style.width = `${Math.min(100, P.model.asp === 'ev' ? P.sim.v / 80 * 100 : P.sim.rpm / P.spec.redline * 100)}%`;
    this.q('rpm').classList.toggle('hot', P.sim.rpm > P.spec.redline * 0.92);
    this.q('nos').style.width = P.spec.nosSecs ? `${P.sim.nos / P.spec.nosSecs * 100}%` : '0%';
    this.q('temp').style.width = `${Math.min(100, P.sim.tireTemp / 1.15 * 100)}%`;
    const showMsg = this.msg && (this.t - (this.msgT ?? -10) < 1.4 || this.phase === 'burnout' || this.phase === 'stage' || this.phase === 'pace' && !this.msgT);
    this.q('msg').textContent = showMsg ? this.msg : '';
    this.q('sub').textContent = this.sub && (this.phase !== 'race' || this.t - (this.msgT ?? -10) < 1.4) ? this.sub : '';
    this.q('sub').style.display = this.q('sub').textContent ? '' : 'none';
    if (this.isDrag) {
      const tr = this.tree;
      const set = (k, on, cls) => { const n = this.q(k); if (n) n.className = on ? cls : ''; };
      for (const [i, d] of [[0, P], [1, N]]) {
        if (!d) continue;
        set('ps' + i, d.preStaged, 'stage'); set('s' + i, d.staged, 'stage');
        set('a1' + i, tr.ambers >= 1 && !tr.green, 'amber'); set('a2' + i, tr.ambers >= 2 && !tr.green, 'amber'); set('a3' + i, tr.ambers >= 3 && !tr.green, 'amber');
        set('g' + i, tr.green && !tr.red[i], 'green'); set('r' + i, tr.red[i], 'red');
      }
    }
  }

  // ---------------------------------------------------------------- draw
  draw(ctx, W, H, dt) {
    const th = this.theme;
    const z = this.cam.zoom;
    const cy = this.cam.y;
    // screen: cars go up. world y -> screen Y
    const baseY = H * 0.68;
    const SY = y => baseY - (y - cy) * z;
    const SX = x => W / 2 + x * z;
    ctx.fillStyle = th.ground; ctx.fillRect(0, 0, W, H);
    const roadW = th.lanes * th.laneW + (th.median ? 2 : 0) + 2;
    const half = roadW / 2;
    // props beside the road
    const yTop = cy + baseY / z + 20, yBot = cy - (H - baseY) / z - 20;
    this.drawProps(ctx, SX, SY, yBot, yTop, half, z);
    // road
    ctx.fillStyle = th.road; ctx.fillRect(SX(-half), 0, roadW * z, H);
    if (th.props === 'stands') {
      // prepped launch area
      ctx.fillStyle = '#2a2a2d'; ctx.fillRect(SX(-half), SY(60), roadW * z, (SY(-10) - SY(60)));
    }
    // lane lines
    ctx.strokeStyle = 'rgba(240,240,235,0.85)'; ctx.lineWidth = Math.max(1, 0.15 * z);
    const dash = 3, gap = 9;
    const start = Math.floor(yBot / (dash + gap)) * (dash + gap);
    for (let i = 1; i < th.lanes; i++) {
      const x = -th.laneW * th.lanes / 2 + i * th.laneW;
      if (th.median && i === th.lanes / 2) { ctx.fillStyle = '#8a8b8f'; ctx.fillRect(SX(x - 0.5), 0, z, H); continue; }
      if (th.props === 'stands') { ctx.fillStyle = '#d6d6d6'; ctx.fillRect(SX(x - 0.25), 0, 0.5 * z, H); continue; }
      ctx.beginPath();
      for (let y = start; y < yTop; y += dash + gap) { ctx.moveTo(SX(x), SY(y)); ctx.lineTo(SX(x), SY(y + dash)); }
      ctx.stroke();
    }
    ctx.fillStyle = th.props === 'cactus' ? '#e8c21a' : '#e9e9e2';
    ctx.fillRect(SX(-half + 0.6), 0, 0.15 * z, H); ctx.fillRect(SX(half - 0.75), 0, 0.15 * z, H);
    // sides
    if (th.side === 'barrier' || th.side === 'wall') { ctx.fillStyle = '#8f9196'; ctx.fillRect(SX(-half - 0.8), 0, 0.8 * z, H); ctx.fillRect(SX(half), 0, 0.8 * z, H); }
    if (th.side === 'rail') { ctx.fillStyle = '#b8bcc4'; ctx.fillRect(SX(-half - 0.3), 0, 0.3 * z, H); ctx.fillRect(SX(half), 0, 0.3 * z, H); }
    // start and finish lines
    const line = (y, checker) => {
      const Y = SY(y);
      if (Y < -20 || Y > H + 20) return;
      if (checker) {
        const s = 1;
        for (let x = -half; x < half; x += s) for (let k = 0; k < 2; k++) { ctx.fillStyle = ((Math.floor((x + half) / s) + k) % 2) ? '#fff' : '#111'; ctx.fillRect(SX(x), Y - k * s * z, s * z + 1, s * z + 1); }
      } else { ctx.fillStyle = '#fff'; ctx.fillRect(SX(-half), Y - 0.25 * z, roadW * z, 0.5 * z); }
    };
    line(0, false);
    line(this.dist, true);
    // distance boards
    ctx.font = `700 ${Math.max(11, 1.6 * z)}px Rajdhani, sans-serif`; ctx.textAlign = 'center';
    const boards = this.isDrag ? [[18.29, "60'"], [100.58, "330'"], [DIST.eighth, '1/8'], [304.8, "1000'"], [DIST.quarter, '1/4'], [DIST.half, '1/2']] : [[DIST.eighth, '1/8'], [DIST.quarter, '1/4'], [DIST.half, '1/2'], [DIST.mile, 'MILE']];
    for (const [y, l] of boards) {
      if (y > this.dist + 1) continue;
      const Y = SY(y);
      if (Y < -30 || Y > H + 30) continue;
      ctx.fillStyle = '#111'; ctx.fillRect(SX(half + 2), Y - 1.2 * z, 5 * z, 2.4 * z);
      ctx.fillStyle = '#ffc21a'; ctx.fillText(l, SX(half + 4.5), Y + 0.5 * z);
    }
    // skid marks
    // traffic
    for (const c of this.traffic) { const Y = SY(c.y); if (Y < -60 || Y > H + 60) continue; drawCar(ctx, c.sprite, SX(c.x), Y, 0, z); }
    // racers
    for (const d of this.drivers) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(SX(d.x) - d.dims.W / 2 * z + 0.3 * z, SY(d.y) - d.dims.L / 2 * z + 0.4 * z, d.dims.W * z, d.dims.L * z);
      drawCarPitched(ctx, d.sprite, SX(d.x), SY(d.y), 0, z, d.sim.pitch, d.dims.L, !!d.spec.barH);
      if (d.sim.nosOn) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(SX(d.x), SY(d.y - d.dims.L / 2 - 0.8), 0, SX(d.x), SY(d.y - d.dims.L / 2 - 0.8), 2 * z);
        g.addColorStop(0, 'rgba(140,110,255,0.9)'); g.addColorStop(1, 'rgba(60,40,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(SX(d.x), SY(d.y - d.dims.L / 2 - 0.8), 2 * z, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      if (d.isPlayer) { ctx.fillStyle = '#ff2a3a'; ctx.beginPath(); ctx.moveTo(SX(d.x), SY(d.y - d.dims.L / 2 - 1.6)); ctx.lineTo(SX(d.x) - 6, SY(d.y - d.dims.L / 2 - 1.6) + 9); ctx.lineTo(SX(d.x) + 6, SY(d.y - d.dims.L / 2 - 1.6) + 9); ctx.fill(); }
    }
    // smoke
    for (const s of this.smoke) {
      ctx.fillStyle = `rgba(225,225,225,${0.3 * s.life / 1.6})`;
      ctx.beginPath(); ctx.arc(SX(s.x), SY(s.y), s.r * z, 0, Math.PI * 2); ctx.fill();
    }
    // night
    if (this.night > 0) {
      ctx.fillStyle = `rgba(6,9,22,${this.night})`; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const d of [...this.drivers, ...this.traffic]) {
        const Y = SY(d.y + d.dims.L / 2);
        if (Y < -200 || Y > H + 50) continue;
        const g = ctx.createRadialGradient(SX(d.x), Y - 10 * z, 0, SX(d.x), Y - 10 * z, 16 * z);
        g.addColorStop(0, 'rgba(255,240,200,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(SX(d.x), Y - 10 * z, 16 * z, 0, Math.PI * 2); ctx.fill();
        const tY = SY(d.y - d.dims.L / 2);
        const g2 = ctx.createRadialGradient(SX(d.x), tY, 0, SX(d.x), tY, 3 * z);
        g2.addColorStop(0, 'rgba(255,0,0,0.5)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(SX(d.x), tY, 3 * z, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // flames out of the exhaust tips — only a 2-step throws these
    for (const d of this.drivers) {
      if (d.flame < 0.04) continue;
      ctx.save(); ctx.translate(SX(d.x), SY(d.y)); ctx.scale(z, z);
      drawFlameJets(ctx, d.model, d.visual, d.flame);
      ctx.restore();
    }
    if (this.rain > 0) {
      drawRain(ctx, { w: W, h: H }, this.rain, dt);
      if (this.storm) {
        this.boltT = (this.boltT ?? 3 + Math.random() * 6) - dt;
        if (this.boltT <= 0) { this.bolt = 1; this.boltT = 5 + Math.random() * 10; audio.thunder?.(); }
        if (this.bolt > 0) { ctx.fillStyle = `rgba(225,230,255,${0.45 * this.bolt})`; ctx.fillRect(0, 0, W, H); this.bolt = Math.max(0, this.bolt - dt * 4); }
      }
    }
    // mini progress bar
    const pw = Math.min(360, W - 40), px = (W - pw) / 2, py = touchUi.active ? 84 : H - 26;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(px, py, pw, 8);
    for (const d of this.drivers) {
      ctx.fillStyle = d.isPlayer ? '#ff2a3a' : '#c0c4cc';
      ctx.beginPath(); ctx.arc(px + clamp(d.y / this.dist, 0, 1) * pw, py + 4, 6, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawProps(ctx, SX, SY, y0, y1, half, z) {
    const th = this.theme;
    const step = th.props === 'stands' ? 8 : th.props === 'city' ? 22 : th.props === 'warehouse' ? 40 : 14;
    const start = Math.floor(y0 / step) * step;
    for (let y = start; y < y1; y += step) {
      const r = Math.abs(Math.sin(y * 12.9898) * 43758.5453) % 1;
      for (const side of [-1, 1]) {
        const off = half + 3 + r * 6;
        const x = side * off;
        if (th.props === 'pine' || th.props === 'cactus') {
          ctx.fillStyle = th.props === 'pine' ? '#1f3a24' : '#3f6b35';
          const rr = (th.props === 'pine' ? 2.5 + r * 2 : 0.8) * z;
          ctx.beginPath(); ctx.arc(SX(x + side * r * 8), SY(y + r * 5), rr, 0, Math.PI * 2); ctx.fill();
        } else if (th.props === 'city') {
          ctx.fillStyle = r > 0.5 ? '#3a3f4a' : '#2f343d';
          ctx.fillRect(SX(side > 0 ? half + 12 : -half - 12 - 14 - r * 10), SY(y + 18), (14 + r * 10) * z, 16 * z);
          if (Math.floor(y / step) % 3 === 0) { ctx.fillStyle = '#c9c9c0'; ctx.beginPath(); ctx.arc(SX(side * (half + 1.6)), SY(y), 0.5 * z, 0, Math.PI * 2); ctx.fill(); }
        } else if (th.props === 'warehouse') {
          ctx.fillStyle = r > 0.5 ? '#6b6f75' : '#5d6167';
          ctx.fillRect(SX(side > 0 ? half + 4 : -half - 4 - 30), SY(y + 34), 30 * z, 30 * z);
        } else if (th.props === 'stands') {
          if (side > 0) {
            ctx.fillStyle = '#5a5f69'; ctx.fillRect(SX(half + 3), SY(y + step), 14 * z, step * z);
            for (let k = 0; k < 6; k++) { ctx.fillStyle = ['#c41b1b', '#1b4fc4', '#e8e8e8', '#222', '#e8c21a'][(k + Math.floor(y)) % 5]; ctx.beginPath(); ctx.arc(SX(half + 4.5 + k * 2), SY(y + r * step), 0.45 * z, 0, Math.PI * 2); ctx.fill(); }
          } else { ctx.fillStyle = '#4a4b4f'; ctx.fillRect(SX(-half - 10), SY(y + step), 8 * z, step * z); }
        }
      }
    }
    if (th.props === 'stands') {
      // timing tower at the finish
      ctx.fillStyle = '#111'; ctx.fillRect(SX(-half - 9), SY(this.dist + 6), 7 * z, 6 * z);
      ctx.fillStyle = '#ff2a3a'; ctx.font = `700 ${Math.max(10, z * 1.6)}px Rajdhani, sans-serif`; ctx.textAlign = 'center';
      const P = this.p;
      ctx.fillText(P.finished ? P.time.toFixed(3) : '0.000', SX(-half - 5.5), SY(this.dist + 4));
      ctx.fillText(P.finished ? Math.round(P.trap) + ' mph' : '', SX(-half - 5.5), SY(this.dist + 2));
    }
  }

  destroy() {
    this.engineP?.stop(); this.engineN?.stop();
    this.engineP = this.engineN = null;
    this.hud?.remove();
    touchUi.setRace('');
    audio.music(null);
  }
}

function summary(d) {
  return { name: d.name, rt: d.rt, time: d.time, elapsed: d.elapsed, trap: d.trap, splits: d.splits, redLight: d.redLight, finished: d.finished, crashes: d.crashes || 0, shifts: d.sim.shifts, spin: d.sim.spinTime, peak: d.sim.peakV * MPH, wheelie: Math.round((d.sim.maxPitch || 0) * 30), stoodUp: !!d.stoodUp };
}
