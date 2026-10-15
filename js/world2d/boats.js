// Boats on the water: the marinas' docks (with your boats and other people's
// tied up in the slips), boats cruising the lakes, and the one you're driving.
// A boat only goes where there's water: the lakes, rivers, Miami's bay and
// the channels under the bridges. Owning boats: core/boats.js. Art:
// gfx2d/boatArt.js. Screens: ui/marina.js.

import { MARINAS, MARINA_BY_ID, BOATS, defaultCustom, knots } from '../data/boats.js';
import { navRects, marinaLayout } from './marinaGeo.js';
import { boatSpec, fleet, defOf, boatName, launchBlock } from '../core/boats.js';
import { boatSprite, hullPath } from '../gfx2d/boatArt.js';
import { drawPerson } from '../gfx2d/person.js';
import { input } from '../core/input.js';
import { pad } from '../core/gamepad.js';
import { soundProfile } from '../sim/sound.js';
import { audio } from '../core/audio.js';
import { saveGame } from '../core/save.js';

const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// decorative boats in a marina's slips, the same every visit
const FILLER = BOATS.filter(b => b.L <= 13);
const LOOKS = [['#f4f4f2', '#1a2a4a'], ['#f4f4f2', '#c41b1b'], ['#0d0d10', '#c9a45a'], ['#2a6bd1', '#f4f4f2'], ['#c41b1b', '#0d0d10'], ['#21b8d8', '#f4f4f2'], ['#e8c21a', '#0d0d10']];
function filler(def, k) {
  const c = defaultCustom(def), [hull, stripe] = LOOKS[k % LOOKS.length];
  return { ...c, hull, stripe, hull2: stripe, flag: k % 3 ? 'texas' : 'usa' };
}

export class Boats {
  constructor(w) {
    this.w = w;
    this.nav = navRects(w.map);
    this.marinas = MARINAS.map(marinaLayout);
    this.active = null;       // the boat you're driving: { rec, def, spec, x, z, h, u, v, r, ... }
    this.npc = [];            // boats cruising the lakes
    this.npcT = 0;
    this.wakes = [];          // foam behind every moving boat
    this.nearDock = null;
    this.t = 0;
    for (const L of this.marinas) {
      const r = rnd(L.m.id.length * 7919 + Math.round(L.sx));
      L.fill = L.slips.map((sl, k) => (r() < 0.55 ? { def: FILLER[Math.floor(r() * FILLER.length)], look: Math.floor(r() * 7) } : null)).map(f => f && (f.def.L <= 13 ? { ...f, cu: filler(f.def, f.look) } : null));
    }
  }

  get s() { return this.w.s; }
  get boating() { return !!this.active; }

  navigable(x, z) {
    for (const r of this.nav) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return true;
    return false;
  }
  onPier(x, z) {
    for (const L of this.marinas) {
      if (x < L.area.x0 || x > L.area.x1 || z < L.area.z0 || z > L.area.z1) continue;
      for (const p of L.piers) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return true;
    }
    return false;
  }
  marinaAt(id) { return this.marinas.find(L => L.m.id === id); }

  // ---------------------------------------------------------------- launch / dock
  launch(rec) {
    const w = this.w, s = this.s;
    const why = launchBlock(s, rec);
    if (why) return { ok: false, text: why };
    if (w.inCar) return { ok: false, text: 'Park the car and walk down to the dock.' };
    if (w.police.phase && w.police.phase !== 'none') return { ok: false, text: 'Not with the cops on you.' };
    const L = this.marinaAt(rec.marina), def = defOf(rec);
    const p = L.launch(def);
    this.active = { rec, def, spec: boatSpec(rec), x: p.x, z: p.z, h: p.h, u: 0, v: 0, r: 0, wakeT: 0, bump: 0, from: L.m.id, horn: 0, vx: 0, vz: 0, speed: 0 };
    input.setContext('car');
    w.cam.x = p.x; w.cam.z = p.z;
    // the motors: a three-cylinder ski, outboard V8s, or big diesels on a yacht
    const motor = def.kind === 'pwc' ? '1.8L I3' : def.L > 20 ? '12.0L V12 Diesel' : def.kind === 'gofast' || def.kind === 'bass' ? '4.6L V8' : '6.2L V8';
    this.redline = def.L > 20 ? 2400 : def.kind === 'pwc' ? 8000 : 6000;
    this.engine = audio.engine({ profile: soundProfile({ engine: motor, asp: def.kind === 'pwc' || def.kind === 'gofast' ? 'sc' : 'na', hp: Math.min(1800, def.price / 400), redline: this.redline, make: 'marine', model: def.model }, { exhaust: def.kind === 'gofast' ? 3 : 1 }) });
    s.stats.boatTrips = (s.stats.boatTrips || 0) + 1;
    return { ok: true };
  }
  // Tie up at the marina you're at; you step off onto the shore.
  dock(L) {
    const w = this.w, a = this.active;
    if (!a) return;
    a.rec.marina = L.m.id;
    this.active = null;
    if (this.engine) { this.engine.stop(); this.engine = null; }
    input.setContext('foot');
    w.foot.x = L.m.x; w.foot.z = L.m.z; w.foot.h = Math.atan2(-L.dx, L.dz);
    w.ui.toast(`⚓ Tied up at ${L.m.name}.`, 'good');
    saveGame('auto', true);
  }
  // A save or a reload while you're out: you're back on the shore at the marina it left from.
  shoreSpot() {
    const a = this.active, m = a && MARINA_BY_ID[a.rec.marina];
    return m ? { x: m.x, z: m.z, h: 0, inCar: false } : null;
  }

  tryUse() {
    if (!this.active) return false;
    if (this.nearDock && this.active.speed < 4) { this.dock(this.nearDock); return true; }
    if (this.nearDock) { this.w.ui.toast('Slow down to dock.', 'info'); return true; }
    this.w.ui.toast('Find a marina to tie up at. They\'re on the Map app.', 'info');
    return true;
  }

  // ---------------------------------------------------------------- driving
  update(dt) {
    this.t += dt;
    const a = this.active;
    if (a) this.drive(a, dt);
    this.updateNpc(dt);
    for (const wk of this.wakes) wk.age += dt;
    while (this.wakes.length && this.wakes[0].age > 5) this.wakes.shift();
  }

  drive(a, dt) {
    const sp = a.spec, s = this.s;
    const throttle = input.axis('throttle'), brake = input.axis('brake'), steer = input.steer();
    const top = sp.top, acc = sp.accel;
    // thrust forward, reverse is weaker; water drag grows with speed so it tops out at `top`
    let f = throttle * acc - brake * acc * (a.u > 0.5 ? 1.2 : 0.45);
    const drag = acc / (top * top);
    a.u += (f - drag * a.u * Math.abs(a.u) - a.u * 0.08) * dt;
    if (a.u < -top * 0.25) a.u = -top * 0.25;
    // steering bites harder the faster water runs past the rudder; big boats turn slowly
    const bite = Math.min(1, Math.abs(a.u) / (top * 0.25) + 0.25) * Math.sign(a.u || 1);
    const rT = steer * sp.turn * bite * (a.u < 0 ? 0.6 : 1);
    a.r += (rT - a.r) * Math.min(1, dt * (sp.L > 30 ? 0.9 : 3));
    a.h += a.r * dt;
    // the hull slides out in a turn, then the water catches it
    a.v += -a.r * a.u * 0.12 * dt;
    a.v *= Math.exp(-dt * (sp.kind === 'pwc' ? 1.8 : 1.2));
    const sn = Math.sin(a.h), cs = Math.cos(a.h);
    a.vx = sn * a.u + cs * a.v; a.vz = -cs * a.u + sn * a.v;
    const nx = a.x + a.vx * dt, nz = a.z + a.vz * dt;
    // the bow and both stern corners must stay on the water
    const hl = sp.L / 2, hw = sp.W / 2;
    const pts = [[0, -hl], [-hw, hl * 0.9], [hw, hl * 0.9], [-hw, -hl * 0.4], [hw, -hl * 0.4]].map(([px, py]) => [nx + cs * px - sn * py, nz + sn * px + cs * py]);
    const dry = pts.find(([x, z]) => !this.navigable(x, z) || this.onPier(x, z));
    if (dry) {
      const hit = Math.abs(a.u);
      if (hit > 4 && a.bump <= 0) {
        a.rec.cond = Math.max(10, (a.rec.cond ?? 100) - Math.min(18, hit * 0.8));
        this.w.ui.toast(hit > 12 ? '💥 You ran it aground hard. The hull took a beating.' : 'Bump. Watch the shore.', 'bad');
        this.w.cam.shake = Math.min(1, hit / 15);
        a.bump = 1.2;
      }
      a.u *= -0.25; a.v *= -0.25; a.r *= 0.3;
    } else { a.x = nx; a.z = nz; }
    a.bump -= dt;
    a.speed = Math.hypot(a.vx, a.vz);
    a.rec.hours = (a.rec.hours || 0) + dt / 60;
    s.stats.boatMiles = (s.stats.boatMiles || 0) + a.speed * dt / 1852;
    // the horn
    if (input.pressed('horn') || input.pressed('handbrake') && a.speed < 1) { a.horn = 1.2; audio.horn?.(); }
    a.horn = Math.max(0, a.horn - dt);
    // foam
    this.wake(a, dt);
    // engine note
    this.engine?.update({ rpm: this.redline * (0.14 + 0.8 * Math.min(1, Math.abs(a.u) / top * 0.75 + throttle * 0.3)), throttle, speed: a.speed });
    // close enough to a marina to tie up?
    this.nearDock = null;
    for (const L of this.marinas) {
      const r = L.area;
      if (a.x > r.x0 - 10 && a.x < r.x1 + 10 && a.z > r.z0 - 10 && a.z < r.z1 + 10) {
        if (!L.m.deep && a.def.L >= 24) continue;
        this.nearDock = L;
      }
    }
    // the camera turns with you like the car's chase camera (world.js)
  }

  wake(b, dt) {
    b.wakeT = (b.wakeT || 0) - dt;
    const sp = Math.hypot(b.vx || 0, b.vz || 0);
    if (sp < 1.2 || b.wakeT > 0) return;
    b.wakeT = 0.09;
    const L = b.def.L, W = b.def.W, sn = Math.sin(b.h), cs = Math.cos(b.h);
    this.wakes.push({ x: b.x - sn * L * 0.48, z: b.z + cs * L * 0.48, h: b.h, w: W, sp, age: 0, id: b });
    if (this.wakes.length > 420) this.wakes.splice(0, 60);
  }

  // ---------------------------------------------------------------- boats out on the lakes
  updateNpc(dt) {
    const c = this.w.cam;
    this.npcT -= dt;
    if (this.npcT <= 0) {
      this.npcT = 1.5;
      // drop the ones far away, add a few on water near the camera
      this.npc = this.npc.filter(b => Math.hypot(b.x - c.x, b.z - c.z) < 1400);
      for (const r of this.nav) {
        if (r.channel) continue;
        const area = (r.x1 - r.x0) * (r.z1 - r.z0);
        if (area < 90000) continue;
        const cx = Math.max(r.x0, Math.min(c.x, r.x1)), cz = Math.max(r.z0, Math.min(c.z, r.z1));
        if (Math.hypot(cx - c.x, cz - c.z) > 700) continue;
        const want = Math.min(5, Math.round(area / 220000) + 1);
        const have = this.npc.filter(b => b.rect === r).length;
        for (let k = have; k < want; k++) this.spawnNpc(r);
      }
    }
    for (const b of this.npc) {
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
      if (d < 25) this.pickWaypoint(b);
      const want = Math.atan2(dx, -dz);
      let dh = want - b.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      b.h += Math.max(-1, Math.min(1, dh)) * b.def.turn * 0.35 * dt;
      const sp = b.cruise * (Math.abs(dh) > 0.8 ? 0.5 : 1);
      b.u += (sp - b.u) * dt * 0.4;
      b.vx = Math.sin(b.h) * b.u; b.vz = -Math.cos(b.h) * b.u;
      const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
      if (nx > b.rect.x0 + 15 && nx < b.rect.x1 - 15 && nz > b.rect.z0 + 15 && nz < b.rect.z1 - 15 && !this.onPier(nx, nz)) { b.x = nx; b.z = nz; } else this.pickWaypoint(b);
      this.wake(b, dt);
    }
  }
  spawnNpc(r) {
    const R = Math.random;
    const big = (r.x1 - r.x0) > 400 && (r.z1 - r.z0) > 400;
    const pool = BOATS.filter(d => d.L <= (big ? 30 : 13));
    const def = pool[Math.floor(R() * pool.length)];
    const look = Math.floor(R() * LOOKS.length);
    const b = { def, cu: filler(def, look), x: r.x0 + 40 + R() * (r.x1 - r.x0 - 80), z: r.z0 + 40 + R() * (r.z1 - r.z0 - 80), h: R() * 6.28, u: 0, rect: r, cruise: def.top * (0.35 + R() * 0.4), vx: 0, vz: 0 };
    if (!this.navigable(b.x, b.z)) return;
    this.pickWaypoint(b);
    this.npc.push(b);
  }
  pickWaypoint(b) {
    const r = b.rect, R = Math.random;
    b.tx = r.x0 + 40 + R() * Math.max(1, r.x1 - r.x0 - 80); b.tz = r.z0 + 40 + R() * Math.max(1, r.z1 - r.z0 - 80);
  }

  // ---------------------------------------------------------------- drawing
  // after the water, before the cars: docks, foam, then every boat
  drawUnder(ctx, cam) {
    const v = cam.view(80), z = cam.zoom, s = this.s;
    // foam trails
    this.drawWakes(ctx, cam, v);
    // docks
    for (const L of this.marinas) {
      const r = L.area;
      if (r.x1 < v.x0 || r.x0 > v.x1 || r.z1 < v.z0 || r.z0 > v.z1) continue;
      for (const p of L.piers) {
        const X = cam.sx(p.x0), Y = cam.sy(p.z0), W = (p.x1 - p.x0) * z, H = (p.z1 - p.z0) * z;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X + 0.6 * z, Y + 0.6 * z, W, H);
        ctx.fillStyle = '#9a7a52'; ctx.fillRect(X, Y, W, H);
        if (z > 3) {   // planks
          ctx.strokeStyle = 'rgba(60,40,20,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
          const across = (p.x1 - p.x0) < (p.z1 - p.z0);
          if (across) for (let q = p.z0; q < p.z1; q += 0.6) { ctx.moveTo(X, cam.sy(q)); ctx.lineTo(X + W, cam.sy(q)); }
          else for (let q = p.x0; q < p.x1; q += 0.6) { ctx.moveTo(cam.sx(q), Y); ctx.lineTo(cam.sx(q), Y + H); }
          ctx.stroke();
          ctx.fillStyle = '#4a3a2a';
          for (const [px, pz] of [[p.x0, p.z0], [p.x1, p.z0], [p.x0, p.z1], [p.x1, p.z1]]) { ctx.beginPath(); ctx.arc(cam.sx(px), cam.sy(pz), Math.max(1.5, 0.3 * z), 0, 7); ctx.fill(); }
        }
      }
      // fuel dock sign and the marina's name painted on the T-head
      if (z > 2.5) {
        const c = L.at(L.P + 2.5, 0);
        let ang = L.out + Math.PI / 2; ang = Math.atan2(Math.sin(ang), Math.cos(ang)); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;   // always reads the right way up
        ctx.save(); ctx.translate(cam.sx(c.x), cam.sy(c.z)); ctx.rotate(ang);
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `900 ${Math.max(8, 2.6 * z)}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(L.m.name.toUpperCase(), 0, 0); ctx.restore();
      }
      // boats in the slips: other people's, then yours
      L.fill.forEach((f, k) => { if (f) { const sl = L.slips[k]; this.drawBoat(ctx, cam, f.def, f.cu, sl.x, sl.z, sl.h, 0.3); } });
      const mine = fleet(s).filter(b => b.marina === L.m.id && b !== this.active?.rec).sort((a, b) => defOf(b).L - defOf(a).L);
      let k = 0;
      for (const b of mine) {
        const def = defOf(b);
        const at = def.L <= 13 ? L.slips.find((sl, i) => !L.fill[i] && !sl.taken) : null;
        const p = at || L.berth(def, k++);
        if (at) at.taken = true;
        this.drawBoat(ctx, cam, def, b.custom, p.x, p.z, p.h, 0.3, !b.charter);
        if (b.charter && z > 2) { ctx.fillStyle = '#e8c21a'; ctx.font = `700 ${Math.max(9, 1.6 * z)}px Arial`; ctx.textAlign = 'center'; ctx.fillText('ON CHARTER', cam.sx(p.x), cam.sy(p.z)); }
      }
      for (const sl of L.slips) sl.taken = false;
    }
    // boats out on the lakes
    for (const b of this.npc) if (b.x > v.x0 && b.x < v.x1 && b.z > v.z0 && b.z < v.z1) this.drawBoat(ctx, cam, b.def, b.cu, b.x, b.z, b.h, b.u / b.def.top);
    // yours
    const a = this.active;
    if (a) {
      this.drawBoat(ctx, cam, a.def, a.rec.custom, a.x, a.z, a.h, Math.abs(a.u) / a.spec.top, true);
      // you, at the helm
      const hx = a.def.kind === 'pwc' ? 0.05 : 0.1, sn = Math.sin(a.h), cs = Math.cos(a.h);
      if (a.def.L < 14) drawPerson(ctx, cam.sx(a.x + sn * a.def.L * hx), cam.sy(a.z - cs * a.def.L * hx), a.h, z, s.player.look, 0, true);
      if (a.horn > 0) { ctx.strokeStyle = `rgba(255,255,255,${a.horn / 1.2 * 0.6})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cam.sx(a.x), cam.sy(a.z), (a.def.L * 0.6 + (1.2 - a.horn) * 30) * z, 0, 7); ctx.stroke(); }
    }
  }

  // A boat bobbing on the water: shadow, the hull and, when it's moving, spray at the bow.
  drawBoat(ctx, cam, def, cu, x, z, h, pace = 0, lit = false) {
    const zoom = cam.zoom, sp = boatSprite(def, cu, this.s.crew?.color);
    const bob = Math.sin(this.t * (def.L > 20 ? 0.9 : 2.1) + x * 0.13) * (def.L > 20 ? 0.006 : 0.025) * (1 - Math.min(0.8, pace));
    const k = zoom / sp.ppm;
    ctx.save();
    ctx.translate(cam.sx(x), cam.sy(z)); ctx.rotate(h + bob);
    // a darker patch of water under the hull, pushed down-right like the buildings' shadows
    ctx.save(); ctx.scale(zoom, zoom); ctx.translate(def.W * 0.18, def.L * 0.04); hullPath(ctx, def); ctx.fillStyle = 'rgba(0,10,25,0.35)'; ctx.fill(); ctx.restore();
    // planing: the bow lifts out of the water at speed (drawn a touch longer toward the camera)
    const lift = Math.min(1, pace * 1.3) * (def.kind === 'superyacht' ? 0.01 : 0.05);
    ctx.scale(k * (1 + bob * 0.4), k * (1 + lift));
    ctx.drawImage(sp.img, -sp.w / 2, -sp.h / 2);
    ctx.restore();
    if (pace > 0.25) {   // spray at the bow
      const sn = Math.sin(h), cs = Math.cos(h), bx = x + sn * def.L * 0.42, bz = z - cs * def.L * 0.42;
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, pace * 0.8)})`;
      for (const side of [-1, 1]) {
        const px = bx + cs * side * def.W * 0.55, pz = bz + sn * side * def.W * 0.55;
        ctx.beginPath(); ctx.ellipse(cam.sx(px), cam.sy(pz), Math.max(1, def.W * 0.22 * zoom * pace), Math.max(1, def.W * 0.12 * zoom), h, 0, 7); ctx.fill();
      }
    }
    void lit;
  }

  drawWakes(ctx, cam, v) {
    if (!this.wakes.length) return;
    const z = cam.zoom;
    // group by boat so each one's trail joins up into two spreading arms
    const by = new Map();
    for (const wk of this.wakes) { if (wk.x < v.x0 - 60 || wk.x > v.x1 + 60 || wk.z < v.z0 - 60 || wk.z > v.z1 + 60) continue; if (!by.has(wk.id)) by.set(wk.id, []); by.get(wk.id).push(wk); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const list of by.values()) {
      if (list.length < 2) continue;
      // churned prop wash down the middle
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1], b = list[i], fade = Math.max(0, 1 - b.age / 2.2);
        if (fade <= 0) continue;
        ctx.strokeStyle = `rgba(235,248,255,${0.45 * fade})`; ctx.lineWidth = Math.max(1, b.w * (0.7 + b.age * 0.6) * z);
        ctx.beginPath(); ctx.moveTo(cam.sx(a.x), cam.sy(a.z)); ctx.lineTo(cam.sx(b.x), cam.sy(b.z)); ctx.stroke();
      }
      // the V: two arms spreading out behind
      for (const side of [-1, 1]) {
        ctx.beginPath();
        let started = false;
        for (const wk of list) {
          const spread = wk.w * 0.5 + wk.age * Math.min(6, wk.sp * 0.35), cs = Math.cos(wk.h), sn = Math.sin(wk.h);
          const x = wk.x + cs * spread * side, zz = wk.z + sn * spread * side;
          if (!started) { ctx.moveTo(cam.sx(x), cam.sy(zz)); started = true; } else ctx.lineTo(cam.sx(x), cam.sy(zz));
        }
        const young = list[list.length - 1];
        ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.55, 0.2 + young.sp / 40)})`; ctx.lineWidth = Math.max(1, 0.45 * z);
        ctx.stroke();
      }
    }
  }

  // colored light under the hull and along the decks at night (world.js lighting pass)
  glows(out) {
    const t = this.t, s = this.s;
    const add = (b, def, x, z) => {
      const c = b.custom;
      const col = v => v === 'rainbow' ? `hsla(${(t * 60) % 360},100%,60%,1)` : v;
      if (c.under && c.under !== 'none') out.glows.push({ x, z, r: def.L * 0.6 + 4, color: col(c.under), a: 0.55 });
      if (c.accent && c.accent !== 'none') out.glows.push({ x, z, r: def.L * 0.45 + 2, color: col(c.accent), a: 0.5 });
    };
    if (this.active) { add(this.active.rec, this.active.def, this.active.x, this.active.z); out.blobs.push({ x: this.active.x, z: this.active.z, r: this.active.def.L * 0.7 + 6, a: 0.7 }); }
    const v = this.w.cam.view(80);
    for (const L of this.marinas) {
      const r = L.area;
      if (r.x1 < v.x0 || r.x0 > v.x1 || r.z1 < v.z0 || r.z0 > v.z1) continue;
      for (const p of L.lamps) { out.blobs.push({ x: p.x, z: p.z, r: 14, a: 0.8 }); out.glows.push({ x: p.x, z: p.z, r: 8, color: 'rgba(255,214,150,1)', a: 0.5 }); }
      let k = 0;
      for (const b of fleet(s).filter(b => b.marina === L.m.id && b !== this.active?.rec)) { const def = defOf(b); if (def.L > 13) { const p = L.berth(def, k++); add(b, def, p.x, p.z); } }
    }
    for (const b of this.npc) if (b.x > v.x0 && b.x < v.x1 && b.z > v.z0 && b.z < v.z1) out.glows.push({ x: b.x, z: b.z, r: 3, color: 'rgba(255,240,200,1)', a: 0.5 });
  }

  // ---------------------------------------------------------------- HUD bits
  promptHtml(tch) {
    const a = this.active;
    if (!a) return '';
    const key = pad.inUse ? 'B' : tch ? 'DOCK' : 'F';
    if (this.nearDock) return `<kbd>${key}</kbd> ${a.speed < 4 ? `Tie up at ${this.nearDock.m.name}` : 'Slow down to dock'}`;
    return '';
  }
  dash() {
    const a = this.active;
    return a && { speed: knots(a.speed), name: boatName(a.rec), cond: a.rec.cond ?? 100, gear: a.u < -0.3 ? 'R' : Math.abs(a.u) < 0.3 ? 'N' : 'F' };
  }
}

