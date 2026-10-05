// Pull-ups in the open world: every so often while you drive, a racer rolls
// up in the next lane, flashes their lights and revs it. USE or the horn
// says "bet": stop the car, they stop beside you, and it's a street race
// from right there (world2d/streetRace.js) to a finish down the road.
// Leave them hanging and they peel off. Rules: core/pullups.js. Who they
// are and the payout: ui/streetRaceSetup.js (pullupOffer / startPullupRace).

import { input } from '../core/input.js';
import { pad } from '../core/gamepad.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/save.js';
import { CAR_BY_ID, carName } from '../data/cars.js';
import { partLevels, defaultVisual } from '../data/parts.js';
import { carSprite, dimsFor } from '../gfx2d/carSprite.js';
import { soundProfile } from '../sim/sound.js';
import { esc } from '../ui/dom.js';
import { hitched } from '../core/tow.js';
import { PULLUP, pullupBlock, nextPullupIn, pullupRoute } from '../core/pullups.js';

const fwd = h => [Math.sin(h), -Math.cos(h)];
const right = h => [Math.cos(h), Math.sin(h)];
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const FLASH = 0.22;   // seconds per headlight flash

export class Pullups {
  constructor(world) {
    this.w = world;
    this.c = null;             // the challenger beside you
    this.wait = null;          // seconds of driving until the next one (set on first drive)
    // headless test browsers drive around a lot: only spawn when asked to there
    this.auto = typeof navigator === 'undefined' || !navigator.webdriver;
  }

  get active() { return !!this.c && this.c.phase !== 'leave'; }

  blocked() {
    const w = this.w, v = w.vehicle, car = v?.car;
    return pullupBlock({
      inCar: w.inCar && !!v, speed: v?.speed || 0, policePhase: w.police.phase, racing: w.races.active,
      hot: !!car?.hot, broken: !!(car?.broken || car?.engineBlown), fuel: car?.fuel ?? 1, towing: !!hitched(w.s),
      gig: !!w.gigs?.job, meetRace: !!w.s.meetRace, robbing: !!(w.combat?.rob || w.combat?.mug),
    });
  }

  // Cars for the world to draw, light up and steer traffic around.
  cars() { return this.c ? [this.c] : []; }

  update(dt) {
    const w = this.w;
    if (!this.c) {
      if (!this.auto || settings.pullups === false) return;
      const why = this.blocked();
      if (why) return;
      this.wait ??= nextPullupIn(w.s, Math.random, true);
      this.wait -= dt;
      if (this.wait <= 0) { if (!this.spawn()) this.wait = 20; }
      return;
    }
    const c = this.c, v = w.vehicle;
    c.t += dt;
    if (c.phase === 'leave') { this.updateLeave(dt); return; }
    // anything that would stop a race ends it: cops, out of the car, racing something else
    const why = this.blocked();
    if (why && why !== 'slow') { this.leave(why === 'cops' ? 'cops' : 'quiet'); return; }
    if (!v) { this.leave('quiet'); return; }
    // ride alongside: just off your door, in the next lane
    const [fx, fz] = fwd(v.h), [rx, rz] = right(v.h);
    const wob = c.phase === 'side' ? Math.sin(c.t * 1.7) * 0.7 : 0;
    c.rel += (wob - c.rel) * (1 - Math.exp(-dt * (c.phase === 'approach' ? 1.1 : 3)));
    const tx = v.x + fx * c.rel + rx * c.side, tz = v.z + fz * c.rel + rz * c.side;
    const k = 1 - Math.exp(-dt * 8);
    const ox = c.x, oz = c.z;
    c.x += (tx - c.x) * k; c.z += (tz - c.z) * k;
    c.h += wrap(v.h - c.h) * k;
    c.v = c.speed = Math.hypot(c.x - ox, c.z - oz) / Math.max(dt, 1e-3);
    if (c.phase === 'approach' && Math.abs(c.rel) < 3) this.arrive();
    if (c.phase === 'side') {
      c.answer -= dt;
      if (input.pressed('horn')) this.accept();
      else if (c.answer <= 0) this.leave('ignored');
    } else if (c.phase === 'lineup') {
      c.answer -= dt;
      c.stillT = v.speed < 1 ? c.stillT + dt : 0;
      if (c.stillT > 0.4) this.go();
      else if (c.answer <= 0) this.leave('ignored');
    }
    this.sound(dt);
  }

  // A racer rolls up from behind in the next lane over.
  spawn(force = false) {
    const w = this.w, v = w.vehicle;
    if (!v || (!force && this.blocked()) || this.c) return false;
    const offer = w.ui.pullup?.offer();
    if (!offer) return false;
    const { npc } = offer, m = CAR_BY_ID[npc.car.model];
    const visual = { ...defaultVisual(m), plate: npc.nick.toUpperCase().slice(0, 7), ...npc.car.visual };
    const lv = partLevels(npc.car.parts);
    const side = this.laneSide(v);
    const [fx, fz] = fwd(v.h), [rx, rz] = right(v.h);
    const rel = -34;
    this.c = {
      pullup: true, ...offer, model: m, name: npc.name, nick: npc.nick,
      x: v.x + fx * rel + rx * side, z: v.z + fz * rel + rz * side, h: v.h, v: v.speed, speed: v.speed,
      dims: dimsFor(m), sprite: carSprite(m, visual, lv, {}), rel, side, phase: 'approach', t: 0, answer: 0, stillT: 0, flashT: 0,
      hit() {},
    };
    this.c.engine = audio.engine({ profile: soundProfile(m, lv, npc.car.parts), volume: 0.5 });
    return true;
  }

  // Which side the next lane is on: toward the middle of the road if you're
  // in the outside lane, away from it if you're inside. One lane each way:
  // they come up in the oncoming lane.
  laneSide(v) {
    const on = this.w.map.roads.nearestOnRoad(v.x, v.z);
    const e = on?.edge;
    if (!e || on.dist > e.width) return -3.8;
    const [fx, fz] = fwd(v.h);
    const sgn = fx * e.dx + fz * e.dz >= 0 ? 1 : -1;
    const lat = ((v.x - on.x) * -e.dz + (v.z - on.z) * e.dx) * sgn;   // + = right of the centreline, going your way
    const lanes = e.lanes || [2, 6];
    if (lanes.length < 2) return -Math.max(3.6, lat + lanes[0]);
    const gap = Math.max(3.6, lanes[1] - lanes[0]);
    return lat > (lanes[0] + lanes[1]) / 2 ? -gap : gap;
  }

  arrive() {
    const c = this.c, s = this.w.s;
    c.phase = 'side'; c.answer = PULLUP.answerFor; c.flashT = 1.6;
    audio.horn();
    const car = carName(c.model, c.npc.car.year);
    this.w.ui.toast(`${c.npc.name} "${c.nick}" pulled up in a ${car}: "${c.line}"${c.wager ? ` ${fmtCash(c.wager)} on it.` : ' Just for the rep.'}`, 'info');
    s.stats.pullups = (s.stats.pullups || 0) + 1;
  }

  // USE (or the horn) while they're beside you. Returns true if it took the press.
  tryUse() {
    if (this.c?.phase !== 'side') return false;
    this.accept();
    return true;
  }

  accept() {
    const c = this.c;
    if (c?.phase !== 'side') return;
    c.phase = 'lineup'; c.answer = PULLUP.lineupFor; c.flashT = 0.8;
    audio.horn();
    this.w.ui.toast(`Bet. Stop the car and line up with ${c.nick}.`, 'good');
  }

  // You stopped: the finish goes down the road and the countdown starts.
  go() {
    const w = this.w, v = w.vehicle, c = this.c;
    const ev = pullupRoute(w.map.roads, v.x, v.z, v.h);
    if (!ev) {
      if (!c.noRoad) w.ui.toast('No clean road to run here. Roll onto a street and stop.', 'info');
      c.noRoad = true; c.stillT = -1.5;
      return;
    }
    const ok = w.ui.pullup?.race({ npc: c.npc, wager: c.wager, ev });
    this.remove();
    this.wait = nextPullupIn(w.s);
    if (!ok) w.ui.toast(`${c.nick} changed their mind.`, 'info');
  }

  // They peel off: on up the road and gone.
  leave(why) {
    const c = this.c;
    if (!c || c.phase === 'leave') return;
    if (why === 'ignored') {
      this.w.ui.toast(`${c.nick} peeled off. "${c.npc.lines?.theyWon && Math.random() < 0.5 ? c.npc.lines.theyWon : 'Scared money don\'t make money.'}"`, 'info');
    }
    c.phase = 'leave'; c.t = 0;
    c.lv = Math.max(10, this.w.vehicle?.speed || 10);
    this.wait = nextPullupIn(this.w.s) + (why === 'ignored' ? PULLUP.ignoredWait : 0);
  }

  updateLeave(dt) {
    const c = this.c;
    c.lv += 7 * dt;
    const [fx, fz] = fwd(c.h);
    c.x += fx * c.lv * dt; c.z += fz * c.lv * dt; c.v = c.speed = c.lv;
    this.sound(dt, 1);
    if (c.t > 6) this.remove();
  }

  sound(dt, floor = 0) {
    const c = this.c, w = this.w;
    if (!c?.engine) return;
    const p = w.playerState();
    const dist = Math.hypot(c.x - p.x, c.z - p.z);
    const idle = c.spec?.idle || 850, red = c.spec?.redline || 7000;
    // revving it at you while they wait for an answer
    const blip = c.phase === 'side' || c.phase === 'lineup' ? Math.max(0, Math.sin(c.t * 4.2)) ** 6 : 0;
    const rpm = Math.min(red * 0.92, idle + c.speed * 70 + blip * (red - idle) * 0.7 + floor * red * 0.55);
    c.engine.update({ rpm, throttle: blip > 0.3 || floor ? 1 : 0.2, speed: c.speed, volume: Math.max(0.05, 1 - dist / 120) * 0.7, pan: Math.max(-0.8, Math.min(0.8, (c.x - p.x) / 30)), turbo: c.model.asp === 'turbo' });
    c.flashT = Math.max(0, c.flashT - dt);
    if (c.phase === 'side' && c.flashT <= 0 && Math.random() < dt * 0.35) c.flashT = 0.9;
  }

  remove() {
    if (!this.c) return;
    this.c.engine?.stop();
    this.c = null;
  }

  // HUD prompt line while they're waiting on you.
  promptHtml(tch) {
    const c = this.c;
    if (!c || (c.phase !== 'side' && c.phase !== 'lineup')) return '';
    const gp = pad.inUse;
    const left = Math.max(0, Math.ceil(c.answer));
    if (c.phase === 'lineup') return `<b style="color:#ffbe1e">Stop the car to line up with ${esc(c.nick)}</b> <span class="muted">${left}s</span>`;
    const stake = c.wager ? `${fmtCash(c.wager)} on it` : 'for rep';
    return `<kbd>${gp ? 'B' : tch ? 'USE' : 'Enter'}</kbd> or <kbd>${gp ? 'L3' : tch ? 'HORN' : 'H'}</kbd> <b style="color:#ffbe1e">Race ${esc(c.nick)}</b> · ${stake} <span class="muted">${left}s</span>`;
  }

  // Headlights flashing at you (drawn after the night lighting so they pop).
  drawFlash(ctx, cam) {
    const c = this.c;
    if (!c || c.flashT <= 0 || Math.floor(c.flashT / FLASH) % 2) return;
    const [fx, fz] = fwd(c.h), [rx, rz] = right(c.h), L = c.dims.L / 2, W = c.dims.W * 0.32;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const sd of [-1, 1]) {
      const x = cam.sx(c.x + fx * L + rx * W * sd), y = cam.sy(c.z + fz * L + rz * W * sd), r = 2.4 * cam.zoom;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,240,0.95)'); g.addColorStop(1, 'rgba(255,255,220,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Their tag over the car: who it is and how quick.
  drawOverlay(ctx, W, H) {
    const c = this.c;
    if (!c || c.phase === 'leave') return;
    const cam = this.w.cam;
    // the tag sits on the far side of their car from yours, so it never covers you
    const [cx, cy] = cam.screen(c.x, c.z), pv = this.w.vehicle;
    const [px, py] = pv ? cam.screen(pv.x, pv.z) : [cx, cy + 1];
    const dl = Math.hypot(cx - px, cy - py) || 1, off = 3.4 * cam.zoom;
    let x = cx + (cx - px) / dl * off, y = cy + (cy - py) / dl * off;
    if (x < -60 || x > W + 60 || y < -30 || y > H + 30) return;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 13px Rajdhani, sans-serif';
    const label = `${c.nick} · ${c.mt.cls} ${c.mt.pi}${c.phase === 'side' ? ' · wants to race' : ''}`;
    const wd = ctx.measureText(label).width + 14;
    // low on the screen the HUD prompt and the touch buttons live: put it beside the car instead
    if (y > H * 0.6) { y = cy; x = cx + Math.sign(cx - px || 1) * (c.dims.L * 0.5 * cam.zoom + wd / 2 + 6); }
    ctx.fillStyle = 'rgba(8,9,12,0.82)'; ctx.fillRect(x - wd / 2, y - 9, wd, 18);
    ctx.fillStyle = c.phase === 'side' && Math.sin(c.t * 6) > 0 ? '#ffbe1e' : '#e0192e'; ctx.fillRect(x - wd / 2, y - 9, 3, 18);
    ctx.fillStyle = '#f2f4f8'; ctx.fillText(label, x, y + 1);
    ctx.restore();
  }

  destroy() { this.remove(); }
}

const fmtCash = n => '$' + Math.round(n).toLocaleString('en-US');
