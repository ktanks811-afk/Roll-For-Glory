// Street races in the open world: a countdown on the start line, checkpoints
// along real Fort Worth streets, live traffic and cops, and a rival who drives
// the route with the same powertrain sim as you (see data/streetRaces.js).
// The setup screen and the payout live in ui/streetRaceSetup.js.

import { newSim } from '../sim/powertrain.js';
import { raceRoute, raceStart, routeAt, driveRoute, FINISH_GRACE, fmtRaceTime } from '../data/streetRaces.js';
import { carSprite, dimsFor } from '../gfx2d/carSprite.js';
import { partLevels, defaultVisual } from '../data/parts.js';
import { soundProfile } from '../sim/sound.js';
import { audio } from '../core/audio.js';
import { el, esc } from '../ui/dom.js';

const COUNT = 3;          // seconds of countdown
const CP_R = 20;          // how close counts as through a checkpoint (m)

export class StreetRaces {
  constructor(world) {
    this.w = world;
    this.race = null;
  }

  get active() { return !!this.race; }

  // cfg: { ev, rival (racer or null), rivalSpec, stake: { type: 'cash'|'pinks'|'trial', wager }, onDone(result) }
  start(cfg) {
    const w = this.w, v = w.vehicle;
    if (!v || this.race) return false;
    const ev = cfg.ev;
    const route = raceRoute(ev);
    const st = raceStart(ev);
    const [ux, uz] = st.dir, rx = -uz, rz = ux;          // right of the direction of travel
    const road = w.map.roads.nearestOnRoad(st.x, st.z)?.edge;
    const lanes = road?.lanes || [2, 6];
    const myLat = lanes[0], rivalLat = lanes.length > 1 ? lanes[1] : -lanes[0];
    const grid = { x: st.x + rx * myLat, z: st.z + rz * myLat, h: st.h };
    const r = this.race = {
      cfg, ev, route, grid, phase: 'count', t: 0, raceT: 0, beeps: 0,
      next: 0, ps: 0, pTime: null, rTime: null, quitT: 0, offT: 0, endT: null,
      prevGps: w.s.gps, lanes, dir: st.dir,
    };
    w.s.gps = null; w.gpsPath = null;
    // clear the start line
    w.traffic.cars = w.traffic.cars.filter(c => Math.hypot(c.x - st.x, c.z - st.z) > 45);
    this.hold();
    if (cfg.rival) {
      const m = cfg.rivalModel;
      const visual = { ...defaultVisual(m), plate: cfg.rival.nick.toUpperCase().slice(0, 7), ...cfg.rival.car.visual };
      const lv = partLevels(cfg.rival.car.parts);
      r.rival = {
        rival: true, name: cfg.rival.name, nick: cfg.rival.nick, model: m, spec: cfg.rivalSpec, skill: cfg.rival.skill,
        sim: newSim(cfg.rivalSpec, { tireTemp: 0.6 }), s: 0, lat: rivalLat, laneT: 0, wet: w.s.weather === 'rain',
        x: st.x + rx * rivalLat, z: st.z + rz * rivalLat, h: st.h, dims: dimsFor(m), sprite: carSprite(m, visual, lv, {}),
        speed: 0, v: 0, hitT: 0,
        hit(imp) { this.sim.v *= Math.max(0.4, 1 - imp / 30); this.hitT = 0.6; },
      };
      r.rival.engine = audio.engine({ profile: soundProfile(m, lv, cfg.rival.car.parts), volume: 0.6 });
    }
    r.hud = el(`<div class="sr-hud"><div class="sr-name">${esc(ev.name)}</div><div class="sr-row">
      <div><b data-sr-pos>—</b><small>${cfg.rival ? 'place' : 'solo'}</small></div><div><b data-sr-cp>0/${route.checkpoints.length}</b><small>checkpoint</small></div>
      <div><b data-sr-time>0:00.0</b><small>time</small></div><div><b data-sr-gap>—</b><small>${cfg.rival ? 'gap' : 'record'}</small></div></div></div>`);
    document.body.appendChild(r.hud);
    r.q = k => r.hud.querySelector(`[data-sr-${k}]`);
    return true;
  }

  // keep the car on the grid during the countdown (the engine still revs)
  hold() {
    const v = this.w.vehicle, g = this.race.grid;
    if (!v) return;
    v.x = g.x; v.z = g.z; v.h = g.h; v.vx = v.vz = 0; v.sim.v = 0; v.yawRate = 0; v.rev = 0;
  }

  // Rival and its collisions, for the world's draw / traffic / crash code.
  cars() { return this.race?.rival ? [this.race.rival] : []; }

  update(dt) {
    const r = this.race;
    if (!r) return;
    const w = this.w;
    r.t += dt;
    if (r.phase === 'count') {
      if (w.inCar) this.hold();
      if (Math.floor(r.t) >= r.beeps && r.beeps < COUNT) { r.beeps++; audio.treeAmber(); }
      if (r.t >= COUNT) { r.phase = 'race'; audio.treeGreen(); audio.horn(); r.goFlash = r.t; }
      this.updateHud();
      return;
    }
    if (r.phase === 'race') r.raceT += dt;
    this.updatePlayer(dt);
    if (r.rival) this.updateRival(dt);
    // who's done
    const rv = r.rival;
    if (r.phase === 'race') {
      if (r.pTime != null) this.end(!rv ? 'done' : r.rTime == null || r.pTime <= r.rTime ? 'win' : 'loss');
      else if (r.rTime != null && r.raceT - r.rTime > FINISH_GRACE) this.end('loss');
      else if (r.quitT > 6) this.end('dnf');
      else if (r.offT > 12) this.end('dnf');
    }
    this.updateHud();
  }

  updatePlayer(dt) {
    const r = this.race, w = this.w, v = w.vehicle;
    if (!w.inCar || !v) { r.quitT += dt; return; }
    r.quitT = 0;
    if (r.pTime != null) return;
    // where you are along the route (never past a checkpoint you haven't hit)
    const cp = r.route.checkpoints[r.next];
    const pr = project(r.route, v.x, v.z, r.ps);
    r.ps = Math.min(Math.max(r.ps - 30, pr.s), cp.s);
    r.offT = pr.d > 220 ? r.offT + dt : 0;
    if (Math.hypot(v.x - cp.x, v.z - cp.z) < CP_R) {
      r.next++;
      r.ps = cp.s;
      if (r.next >= r.route.checkpoints.length) { r.pTime = r.raceT; audio.treeGreen(); }
      else audio.treeAmber();
    }
  }

  updateRival(dt) {
    const r = this.race, d = r.rival, w = this.w;
    if (d.hitT > 0) d.hitT -= dt;
    if (r.phase === 'race' && r.rTime == null) {
      const at = routeAt(r.route, d.s);
      // traffic in its lane: change lanes if one is clear, else sit behind it
      d.block = Infinity;
      const lanes = r.lanes.length < 3 ? [...r.lanes, ...r.lanes.map(l => -l)] : r.lanes;   // no crossing the highway median
      const blocked = lat => w.traffic.cars.find(c => {
        const dx = c.x - (at.x - at.uz * lat), dz = c.z - (at.z + at.ux * lat);
        const ahead = dx * at.ux + dz * at.uz, side = Math.abs(dx * -at.uz + dz * at.ux);
        return ahead > -3 && ahead < 18 + d.sim.v * 0.8 && side < 2.4;
      });
      const car = blocked(d.lat);
      d.laneT -= dt;
      if (car && d.laneT <= 0) {
        const free = lanes.filter(l => l !== d.lat && !blocked(l)).sort((a, b) => Math.abs(a - d.lat) - Math.abs(b - d.lat));
        if (free.length && Math.random() < 0.5 + d.skill * 0.5) { d.lat = free[0]; d.laneT = 0.8; }
      }
      const still = blocked(d.lat);
      if (still) d.block = Math.max(0, (still.v || 0) - 1);
      if (d.hitT > 0) d.block = Math.min(d.block, d.sim.v);
      if (driveRoute(r.route, d, dt)) d.rTime = r.rTime = r.raceT;
    } else {
      // coast after the line
      d.sim.v = Math.max(0, d.sim.v - 6 * dt);
      d.s = Math.min(r.route.length + 60, d.s + d.sim.v * dt);
    }
    const at = routeAt(r.route, Math.min(d.s, r.route.length));
    const over = Math.max(0, d.s - r.route.length);
    const tx = at.x - at.uz * d.lat + at.ux * over, tz = at.z + at.ux * d.lat + at.uz * over;
    const k = Math.min(1, dt * 9);
    d.x += (tx - d.x) * k; d.z += (tz - d.z) * k;
    let dh = Math.atan2(at.ux, -at.uz) - d.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    d.h += dh * Math.min(1, dt * 7);
    d.speed = d.v = d.sim.v;
    // it shoves traffic out of its way
    for (const c of w.traffic.cars) if (Math.hypot(c.x - d.x, c.z - d.z) < (d.dims.W + c.dims.W) / 2 + 0.6 && c.stun <= 0) { c.hit(4); d.sim.v *= 0.8; }
    const p = w.playerState();
    const dist = Math.hypot(d.x - p.x, d.z - p.z);
    d.engine?.update({ rpm: d.sim.rpm, throttle: d.thr || 0, boost: d.sim.boost, slip: d.sim.slip, turbo: d.spec.asp === 'turbo', volume: Math.max(0.05, 1 - dist / 140) * 0.7, pan: Math.max(-0.8, Math.min(0.8, (d.x - p.x) / 30)), speed: d.sim.v });
  }

  // You got busted / pulled over / the game left the world: nobody wins.
  cancel(reason) { if (this.race) this.end('cancel', reason); }

  end(outcome, why = '') {
    const r = this.race;
    if (!r) return;
    this.race = null;
    r.hud?.remove();
    r.rival?.engine?.stop();
    if (!this.w.s.gps && r.prevGps) { this.w.s.gps = r.prevGps; this.w.gpsT = 0; }
    const result = { outcome, why, ev: r.ev, pTime: r.pTime, rTime: r.rTime, raceT: r.raceT, rival: r.cfg.rival, stake: r.cfg.stake, checkpoints: r.next, total: r.route.checkpoints.length };
    if (outcome !== 'cancel') r.cfg.onDone?.(result);
    else r.cfg.onCancel?.(result);
  }

  updateHud() {
    const r = this.race;
    if (!r?.q || (r.hudT = (r.hudT || 0) - 1) > 0) return;
    r.hudT = 4;   // every few frames is plenty
    const v = this.w.vehicle;
    r.q('cp').textContent = `${Math.min(r.next, r.route.checkpoints.length)}/${r.route.checkpoints.length}`;
    r.q('time').textContent = fmtRaceTime(r.pTime ?? r.raceT);
    if (r.rival) {
      const ahead = r.pTime != null ? (r.rTime == null || r.pTime <= r.rTime) : r.rTime == null && r.ps >= r.rival.s;
      r.q('pos').textContent = r.phase === 'count' ? '—' : ahead ? '1st' : '2nd';
      r.q('pos').style.color = ahead ? 'var(--green)' : 'var(--red2)';
      const gapM = r.rival.s - r.ps;
      const sp = Math.max(8, v?.speed || 0);
      r.q('gap').textContent = r.phase === 'count' ? '—' : `${gapM > 0 ? '−' : '+'}${Math.abs(gapM / sp).toFixed(1)}s`;
    } else {
      r.q('gap').textContent = fmtRaceTime(r.cfg.recordTime);
    }
  }

  // ---------------------------------------------------------------- draw
  // The rest of the route on the road, and the checkpoint rings.
  drawRoute(ctx, cam, alpha = 1, glow = false) {
    const r = this.race;
    if (!r || alpha < 0.02) return;
    const { pts, along, checkpoints } = r.route;
    const z = cam.zoom;
    const from = routeAt(r.route, r.ps);
    const path = [[from.x, from.z]];
    for (let i = from.i; i < pts.length; i++) if (along[i] > r.ps) path.push(pts[i]);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (glow) ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,190,30,0.32)'; ctx.lineWidth = Math.max(5, 3 * z);
    ctx.beginPath(); path.forEach(([x, zz], i) => i ? ctx.lineTo(cam.sx(x), cam.sy(zz)) : ctx.moveTo(cam.sx(x), cam.sy(zz))); ctx.stroke();
    // the next two checkpoints: a pulsing gate, and a dim one after it
    const pulse = (this.w.t * 1.2) % 1;
    for (let k = r.next; k < Math.min(checkpoints.length, r.next + 2); k++) {
      const c = checkpoints[k], x = cam.sx(c.x), y = cam.sy(c.z);
      const last = k === checkpoints.length - 1;
      ctx.globalAlpha = alpha * (k === r.next ? 1 : 0.4);
      ctx.strokeStyle = last ? '#ffffff' : '#ffbe1e'; ctx.lineWidth = Math.max(3, 0.7 * z);
      ctx.beginPath(); ctx.arc(x, y, CP_R * 0.6 * z, 0, Math.PI * 2); ctx.stroke();
      if (k === r.next) { ctx.globalAlpha = alpha * (1 - pulse); ctx.beginPath(); ctx.arc(x, y, CP_R * (0.6 + pulse * 0.4) * z, 0, Math.PI * 2); ctx.stroke(); }
      if (last && k === r.next) {
        // checkered finish flag in the ring
        ctx.globalAlpha = alpha * 0.9;
        const s = Math.max(4, 1.4 * z);
        for (let i = -2; i < 2; i++) for (let j = -2; j < 2; j++) { ctx.fillStyle = (i + j) & 1 ? '#111' : '#fff'; ctx.fillRect(x + i * s, y + j * s, s, s); }
      }
    }
    ctx.restore();
  }

  // Countdown, the arrow to the next checkpoint when it's off screen, and the rival's tag.
  drawOverlay(ctx, W, H) {
    const r = this.race;
    if (!r) return;
    const cam = this.w.cam;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (r.phase === 'count' || (r.goFlash != null && r.t - r.goFlash < 0.9)) {
      const txt = r.phase === 'count' ? String(COUNT - Math.floor(r.t)) : 'GO!';
      ctx.font = `800 ${Math.round(Math.min(W, H) * 0.22)}px Rajdhani, sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(txt, W / 2 + 4, H * 0.42 + 4);
      ctx.fillStyle = r.phase === 'count' ? '#ffbe1e' : '#2cff7a'; ctx.fillText(txt, W / 2, H * 0.42);
    }
    const c = r.route.checkpoints[r.next];
    if (c) {
      const [gx, gy] = cam.screen(c.x, c.z);
      if (gx < 0 || gx > W || gy < 0 || gy > H) {
        const a = Math.atan2(gy - H / 2, gx - W / 2), rr = Math.min(W, H) / 2 - 56;
        ctx.save(); ctx.translate(W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr); ctx.rotate(a);
        ctx.fillStyle = '#ffbe1e'; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-9, -10); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    const d = r.rival;
    if (d) {
      const [x, y0] = cam.screen(d.x, d.z), y = y0 - 3.4 * cam.zoom;
      if (x > -40 && x < W + 40 && y > -20 && y < H + 20) {
        ctx.font = '700 13px Rajdhani, sans-serif';
        const label = `${d.nick}`, wd = ctx.measureText(label).width + 14;
        ctx.fillStyle = 'rgba(8,9,12,0.8)'; ctx.fillRect(x - wd / 2, y - 9, wd, 18);
        ctx.fillStyle = '#ffbe1e'; ctx.fillRect(x - wd / 2, y - 9, 3, 18);
        ctx.fillStyle = '#f2f4f8'; ctx.fillText(label, x, y + 1);
      }
    }
    ctx.restore();
  }

  destroy() { if (this.race) { this.race.hud?.remove(); this.race.rival?.engine?.stop(); this.race = null; } }
}

// Closest point on the route to (x, z), looking near where you were last.
function project(route, x, z, sHint) {
  const { pts, along } = route;
  let best = { s: sHint, d: Infinity };
  for (let i = 1; i < pts.length; i++) {
    if (along[i] < sHint - 80 || along[i - 1] > sHint + 320) continue;
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
    if (d < best.d) best = { s: along[i - 1] + Math.sqrt(L2) * t, d };
  }
  return best;
}

