// On-foot weapons and robberies. G draws or holsters, F-key style controls
// are in core/input.js (fire / reload), shots are hitscan with a tracer, and
// every shot is loud: nearby pedestrians scatter and the police are told.
//
// Robbery: draw a gun next to a store (gas station, diner, clothing shop) and
// press E. The clerk empties the register over a few seconds while you keep
// the gun on them. Some stores have a silent alarm, some clerks fight back,
// and leaving early only gets you part of the take. Muggings work on
// pedestrians. Get caught after a robbery and you lose the gun and a lot of cash.

import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { addRep, spend, fmtMoney } from '../core/state.js';
import { collideCircle } from './map.js';
import { WEAPON_BY_ID, CAL, ensureArms, equippedGun } from '../data/weapons.js';
import { LOCATIONS } from '../data/world.js';

// A forced-reset trigger turns a semi-auto pistol into a full-auto one: very fast, wild, and unreliable.
export const FRT = { cd: 0.062, spread: 1.7, jam: 0.045, burst: 0.2 };

const rnd = (a, b) => a + Math.random() * (b - a);
const STORES = {
  gas:      { min: 250, max: 800, dur: [5, 7], alarm: 0.4, fight: 0.1, what: 'register' },
  food:     { min: 180, max: 520, dur: [4, 6], alarm: 0.3, fight: 0.08, what: 'till' },
  clothing: { min: 450, max: 1400, dur: [6, 8], alarm: 0.55, fight: 0.12, what: 'safe' },
};
export const ROBBABLE = Object.keys(STORES);

export class Combat {
  constructor(world) {
    this.w = world;
    this.drawn = false;
    this.cd = 0;
    this.reload = 0;
    this.tracers = [];
    this.flashes = [];
    this.sparks = [];
    this.rob = null;
    this.mug = null;
    this.mouse = { x: 0, y: 0, t: -99 };
    this.mouseFire = false;
    this.aim = 0;
    this.msg = '';
    this.heldT = 0; this.freshPull = false; this.trigWas = false; this.jammed = false; this.burstLeft = 0;
    this.msgT = 0;
    ensureArms(world.s);
    window.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.t = performance.now(); });
    window.addEventListener('mousedown', e => { if (e.button === 0 && e.target && e.target.id === 'game') this.mouseFire = true; });
    window.addEventListener('mouseup', () => { this.mouseFire = false; });
  }

  get s() { return this.w.s; }
  get arms() { return ensureArms(this.s); }
  get gun() { const g = equippedGun(this.s); return g ? { g, def: WEAPON_BY_ID[g.id] } : null; }
  get armed() { return this.drawn && !this.w.inCar && !!this.gun; }
  say(t, tone = 'info') { this.w.ui.toast(t, tone); }

  toggleDraw() {
    if (this.w.inCar) return;
    const gn = this.gun;
    if (!gn) { this.say('You have no weapon equipped. Order one from the Amazin\' app (☎ phone).', 'info'); return; }
    this.drawn = !this.drawn;
    audio.click();
    if (!this.drawn) { this.cancelRob('You holstered up.'); this.mug = null; }
  }

  // ---------------------------------------------------------------- aiming
  targets() {
    const w = this.w, out = [];
    for (const p of w.traffic.peds) if (!p.down) out.push({ x: p.x, z: p.z, ped: p });
    for (const c of w.police.allCars()) out.push({ x: c.x, z: c.z, car: c, police: true });
    return out;
  }
  aimAngle() {
    const f = this.w.foot;
    // desktop: face the mouse while it's been moving
    if (performance.now() - this.mouse.t < 2500 && !('ontouchstart' in window && !this.mouseFire)) {
      const cam = this.w.cam;
      const a = Math.atan2(this.mouse.x - cam.sx(f.x), -(this.mouse.y - cam.sy(f.z)));
      if (Number.isFinite(a) && !input.held('forward') && !input.held('back') && !input.held('left') && !input.held('right')) return a;
    }
    // otherwise lock onto the nearest target roughly in front
    const gn = this.gun, range = gn && !gn.def.melee ? CAL[gn.def.cal].range : 2;
    let best = null, bd = 1e9;
    for (const t of this.targets()) {
      const dx = t.x - f.x, dz = t.z - f.z, d = Math.hypot(dx, dz);
      if (d > range || d < 0.5) continue;
      const a = Math.atan2(dx, -dz);
      let da = Math.atan2(Math.sin(a - f.h), Math.cos(a - f.h));
      if (Math.abs(da) > 0.7) continue;
      const score = d * (1 + Math.abs(da));
      if (score < bd) { bd = score; best = a; }
    }
    return best ?? f.h;
  }

  // ---------------------------------------------------------------- firing
  fire() {
    const gn = this.gun; if (!gn) return;
    const { g, def } = gn;
    if (this.cd > 0 || this.reload > 0) return;
    const f = this.w.foot;
    if (def.melee) { this.swing(def); return; }
    if (this.jammed) { if (!this.jamSaid) { this.say('JAMMED! Press R to clear it.', 'bad'); this.jamSaid = true; audio.click(); } this.cd = 0.3; return; }
    // semi-auto guns fire once per pull; held trigger repeats slowly. FRT'd guns and the G18 run full-auto.
    const full = def.auto || g.frt;
    if (!full && !this.freshPull && this.heldT < 0.32) return;
    if (g.loaded <= 0) {
      if ((this.arms.ammo[def.cal] || 0) > 0) this.startReload(); else { audio.click(); this.say(`Out of ${def.cal} — order more ammo.`, 'bad'); this.cd = 0.4; }
      return;
    }
    this.freshPull = false; this.heldT = 0;
    g.loaded--;
    this.shots = (this.shots || 0) + 1;
    this.cd = g.frt ? FRT.cd : def.cd;
    if (g.frt) {
      // the forced-reset trigger: it doesn't always behave
      if (Math.random() < (this.jamChance ?? FRT.jam)) { this.jammed = true; this.jamSaid = false; }
      else if (!this.burstLeft && Math.random() < (this.burstChance ?? FRT.burst)) this.burstLeft = 2;
    }
    const ang0 = this.aimAngle();
    const spread = def.spread * (g.frt ? FRT.spread : 1) * (f.moving ? 1.7 : 1) * Math.PI / 180;
    const ang = ang0 + (Math.random() - 0.5) * 2 * spread;
    f.h = ang0;
    const mx = f.x + Math.sin(ang0) * 0.55, mz = f.z - Math.cos(ang0) * 0.55;
    const hit = this.hitscan(mx, mz, ang, CAL[def.cal].range, CAL[def.cal].dmg);
    this.tracers.push({ x0: mx, z0: mz, x1: hit.x, z1: hit.z, t: 0.09 });
    this.flashes.push({ x: mx, z: mz, a: ang0, t: 0.07 });
    audio.gunshot(def.cal === '.22 LR' ? 0.5 : def.kind === 'arp' ? 1.3 : 1);
    if (this.w.cam) this.w.cam.shake = Math.max(this.w.cam.shake, 0.1);
    // everyone nearby hears it
    for (const p of this.w.traffic.peds) if (Math.hypot(p.x - f.x, p.z - f.z) < 45) p.scared = Math.max(p.scared || 0, 6);
    this.w.police.gunshot(this.w, hit.kind === 'ped' || hit.kind === 'police' ? 'hit' : 'shot', false, !!(g.frt || def.auto));
    if (g.loaded === 0 && (this.arms.ammo[def.cal] || 0) > 0) setTimeout(() => this.startReload(), 250);
  }

  startReload() {
    const gn = this.gun; if (!gn || gn.def.melee || this.reload > 0) return;
    const { g, def } = gn;
    const have = this.arms.ammo[def.cal] || 0;
    if (this.jammed) { this.reload = 1.1; this.reloading = { g, def, clear: true }; audio.click(); return; }
    if (g.loaded >= def.mag || have <= 0) return;
    this.reload = def.reload;
    audio.click();
    this.reloading = { g, def };
  }
  finishReload() {
    const r = this.reloading; if (!r) return;
    if (r.clear) { this.jammed = false; this.reloading = null; audio.click(); this.say('Jam cleared.', 'info'); return; }
    const need = r.def.mag - r.g.loaded, put = Math.min(need, this.arms.ammo[r.def.cal] || 0);
    r.g.loaded += put; this.arms.ammo[r.def.cal] -= put;
    this.reloading = null;
    audio.click();
  }

  // Walk the ray in half-metre steps, stopping at the first wall, and test
  // pedestrians and cars along the way.
  hitscan(x, z, ang, range, dmg) {
    const dx = Math.sin(ang), dz = -Math.cos(ang);
    let tEnd = range, wall = false;
    for (let t = 0.6; t < range; t += 0.6) {
      const px = x + dx * t, pz = z + dz * t;
      const hit = collideCircle(this.w.map, px, pz, 0.05);
      if (hit && hit.c.h > 1) { tEnd = t; wall = true; break; }
    }
    let best = null;
    const test = (o, r, kind, ref) => {
      const rx = o.x - x, rz = o.z - z, t = rx * dx + rz * dz;
      if (t < 0 || t > tEnd) return;
      const perp = Math.abs(rx * dz - rz * dx);
      if (perp < r && (!best || t < best.t)) best = { t, kind, ref, x: x + dx * t, z: z + dz * t };
    };
    for (const p of this.w.traffic.peds) if (!p.down) test(p, 0.5, 'ped', p);
    for (const c of this.w.traffic.cars) test(c, 1.1, 'car', c);
    for (const c of this.w.police.allCars()) test(c, 1.1, 'police', c);
    if (best) {
      this.sparks.push({ x: best.x, z: best.z, t: 0.18 });
      if (best.kind === 'ped') this.hurtPed(best.ref, dmg);
      else if (best.kind === 'police') { this.w.setOffence(1.5, 'Shooting at police!', 'shootcop', 'assault', 2500); if (best.ref.hit) best.ref.hit(3); }
      else if (best.ref.hit) best.ref.hit(2);
      return { x: best.x, z: best.z, kind: best.kind };
    }
    if (wall) this.sparks.push({ x: x + dx * tEnd, z: z + dz * tEnd, t: 0.18 });
    return { x: x + dx * tEnd, z: z + dz * tEnd, kind: wall ? 'wall' : 'air' };
  }

  hurtPed(p, dmg) {
    p.hp = (p.hp ?? 40) - dmg;
    p.scared = 8;
    if (p.hp <= 0) { p.down = 14; p.cower = false; }
  }

  swing(def) {
    const f = this.w.foot;
    this.cd = def.cd;
    const a = this.aimAngle(); f.h = a;
    this.swingT = 0.18; this.swingA = a;
    audio.crash(0.15);
    let hitAny = false;
    for (const p of this.w.traffic.peds) {
      if (p.down) continue;
      const dx = p.x - f.x, dz = p.z - f.z, d = Math.hypot(dx, dz);
      if (d > def.reach + 0.4) continue;
      const da = Math.atan2(Math.sin(Math.atan2(dx, -dz) - a), Math.cos(Math.atan2(dx, -dz) - a));
      if (Math.abs(da) > 1.0) continue;
      this.hurtPed(p, def.dmg * 1.6); hitAny = true;
    }
    if (hitAny) { this.w.setOffence(0.7, 'Assault with a weapon.', 'swing', 'assault', 1800); this.w.police.gunshot(this.w, 'hit', true); }
  }

  // ---------------------------------------------------------------- robbery
  storeNear() {
    const f = this.w.foot;
    for (const l of LOCATIONS) {
      if (!ROBBABLE.includes(l.type)) continue;
      if (Math.hypot(l.x - f.x, l.z - f.z) < 9) return l;
    }
    return null;
  }
  robPrompt() {
    if (!this.armed || this.rob || this.mug) return '';
    const st = this.storeNear();
    if (st) {
      const cd = this.arms.cooldown[st.id];
      if (cd && cd > this.s.time.day) return `${st.name} is on high alert — try another day`;
      return `ROB ${st.name}`;
    }
    const p = this.pedNear(5);
    return p ? 'MUG pedestrian' : '';
  }
  pedNear(r) {
    const f = this.w.foot;
    let best = null, bd = r;
    for (const p of this.w.traffic.peds) {
      if (p.down || p.mugged) continue;
      const dx = p.x - f.x, dz = p.z - f.z, d = Math.hypot(dx, dz);
      if (d > bd) continue;
      const a = Math.atan2(dx, -dz);
      if (Math.abs(Math.atan2(Math.sin(a - f.h), Math.cos(a - f.h))) > 1.1) continue;
      bd = d; best = p;
    }
    return best;
  }

  // E pressed while armed. Returns true if it started a robbery.
  tryInteract(nearLoc) {
    if (!this.armed || this.rob || this.mug) return false;
    const st = this.storeNear() || (nearLoc && ROBBABLE.includes(nearLoc.type) ? nearLoc : null);
    if (st) { this.startRob(st); return true; }
    const p = this.pedNear(5);
    if (p) { this.startMug(p); return true; }
    return false;
  }

  startRob(loc) {
    const cfg = STORES[loc.type], a = this.arms, day = this.s.time.day;
    if (a.cooldown[loc.id] > day) { this.say('The clerk already hit the panic button today. Try another store.', 'bad'); return; }
    const night = this.w.darkness() > 0.4;
    const dur = rnd(cfg.dur[0], cfg.dur[1]);
    this.rob = {
      loc, cfg, t: 0, dur, pay: Math.round(rnd(cfg.min, cfg.max) * (night ? 1.2 : 1)),
      alarm: Math.random() < cfg.alarm * (night ? 0.8 : 1), alarmAt: rnd(0.35, 0.65) * dur,
      fightAt: Math.random() < cfg.fight ? rnd(0.4, 0.85) * dur : 0, alarmed: false,
    };
    this.say(`"${['Easy, easy!', 'Take it, just take it!', 'Please don\'t shoot!'][Math.floor(Math.random() * 3)]}" Keep the gun on them…`, 'info');
    this.w.setOffence(1.5, 'Armed robbery in progress!', 'rob' + loc.id, 'robbery', 6000);
    audio.radio();
  }
  cancelRob(text) {
    if (!this.rob) return;
    const r = this.rob; this.rob = null;
    const part = Math.round(r.pay * Math.min(0.6, (r.t / r.dur) * 0.6));
    if (part > 40 && text !== 'quiet') { this.s.cash += part; this.say(`${text || 'You bailed.'} You grabbed ${fmtMoney(part)} on the way out.`, 'good'); this.finishRobbery(r, part); }
    else if (text) this.say(text, 'info');
  }
  finishRobbery(r, amount) {
    const a = this.arms, s = this.s;
    a.cooldown[r.loc.id] = s.time.day + 1;
    a.robberies++;
    s.stats.robberies = (s.stats.robberies || 0) + 1;
    s.stats.stolen = (s.stats.stolen || 0) + amount;
    addRep(s, 10, 'Robbery');
  }
  completeRob() {
    const r = this.rob; this.rob = null;
    let pay = r.pay, dye = Math.random() < 0.1;
    if (dye) pay = Math.round(pay * 0.5);
    this.s.cash += pay;
    this.finishRobbery(r, pay);
    this.say(`Robbery done: +${fmtMoney(pay)}${dye ? ' (a dye pack burst — half ruined)' : ''}. Now get out of there!`, 'good');
    audio.buy();
    if (!r.alarmed && r.alarm) this.w.police.dispatchRobbery(this.w, r.loc);
  }

  startMug(p) {
    this.mug = { p, t: 0, dur: 2.2, pay: Math.round(rnd(15, 140)) };
    p.cower = true; p.mugged = true; p.scared = 0;
    this.say('"Okay okay! Take my wallet!"', 'info');
    // bystanders may call it in
    const witnesses = this.w.traffic.peds.filter(q => q !== p && !q.down && Math.hypot(q.x - p.x, q.z - p.z) < 30).length;
    if (witnesses >= 2 && Math.random() < 0.5) this.mug.call = true;
    this.w.setOffence(0.9, 'Armed mugging.', 'mug', 'robbery', 4000);
  }

  // ---------------------------------------------------------------- damage
  hurt(dmg, why) {
    const a = this.arms;
    const soak = a.armor > 0 ? Math.min(dmg * 0.6, a.armor * 100) : 0;
    a.armor = Math.max(0, a.armor - soak / 120);
    a.hp -= dmg - soak;
    this.say(`${why} (−${Math.round(dmg - soak)} health)`, 'bad');
    if (this.w.cam) this.w.cam.shake = 0.5;
    if (a.hp <= 0) this.knockedOut();
  }
  knockedOut() {
    const s = this.s, a = this.arms;
    this.rob = null; this.mug = null; this.drawn = false;
    a.hp = 60;
    const bill = 1500;
    if (!spend(s, bill, 'Hospital bill')) { s.bank -= Math.max(0, bill - s.cash - s.bank); s.cash = 0; }
    this.w.police.reset(this.w);
    this.w.ui.modal('You blacked out', `<p>You wake up in the ER. The bill is <b>${fmtMoney(bill)}</b> and the cops are gone — for now.</p>`);
  }
  // Busted with blood on your hands: you lose the gun and a lot of cash.
  onBusted(record) {
    const heavy = record.some(r => r.kind === 'robbery' || r.kind === 'shots' || r.kind === 'assault' || r.kind === 'auto') || !!this.gun?.g.frt;
    if (!heavy) return 0;
    const a = this.arms;
    let extra = 3000;
    const gn = this.gun;
    if (gn) { a.guns = a.guns.filter(g => g.uid !== gn.g.uid); a.equipped = a.guns[0]?.uid || null; extra += 1500; this.say(`Your ${gn.def.name} was confiscated.`, 'bad'); }
    this.drawn = false; this.rob = null; this.mug = null;
    return extra;
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const w = this.w;
    this.cd = Math.max(0, this.cd - dt);
    if (this.reload > 0) { this.reload -= dt; if (this.reload <= 0) this.finishReload(); }
    const a = this.arms;
    if (a.hp < 100 && !this.rob) a.hp = Math.min(100, a.hp + dt * 0.4);
    for (const t of this.tracers) t.t -= dt; this.tracers = this.tracers.filter(t => t.t > 0);
    for (const t of this.flashes) t.t -= dt; this.flashes = this.flashes.filter(t => t.t > 0);
    for (const t of this.sparks) t.t -= dt; this.sparks = this.sparks.filter(t => t.t > 0);
    if (this.swingT > 0) this.swingT -= dt;

    if (w.inCar) { if (this.drawn) { this.drawn = false; } this.rob = null; this.mug = null; return; }
    if (input.pressed('draw')) this.toggleDraw();
    if (!this.gun && this.drawn) this.drawn = false;
    if (!this.armed) { if (this.rob) this.cancelRob('You lowered the gun.'); this.mug = null; return; }

    if (input.pressed('reload')) this.startReload();
    const trig = input.held('fire') || this.mouseFire;
    if (trig && !this.trigWas) this.freshPull = true;
    this.trigWas = trig;
    this.heldT = trig ? (this.heldT || 0) + dt : 0;
    if (this.burstLeft > 0 && this.cd <= 0 && !this.jammed) { this.freshPull = true; this.burstLeft--; this.fire(); }
    else if (trig) this.fire();
    if (!trig) this.freshPull = false;
    this.aim = this.aimAngle();

    // visible weapon: cops that see it call it in (gradual, so a quick draw isn't a felony)
    w.setOffence(dt * 0.35, 'Brandishing a firearm.', undefined, 'brandish', 900);

    const f = w.foot;
    if (this.rob) {
      const r = this.rob;
      r.t += dt;
      if (Math.hypot(r.loc.x - f.x, r.loc.z - f.z) > 13) { this.cancelRob('You left too early.'); return; }
      if (!r.alarmed && r.alarm && r.t >= r.alarmAt) { r.alarmed = true; w.police.dispatchRobbery(w, r.loc); }
      if (r.fightAt && r.t >= r.fightAt) {
        r.fightAt = 0;
        this.rob = null;
        this.hurt(Math.round(rnd(25, 40)), 'The clerk pulled a shotgun from under the counter!');
        this.finishRobbery(r, 0);
        return;
      }
      if (r.t >= r.dur) this.completeRob();
    }
    if (this.mug) {
      const m = this.mug; m.t += dt;
      if (Math.hypot(m.p.x - f.x, m.p.z - f.z) > 8) { this.mug = null; m.p.cower = false; m.p.scared = 6; return; }
      if (m.t >= m.dur) {
        this.mug = null;
        m.p.cower = false; m.p.scared = 10;
        this.s.cash += m.pay;
        this.s.stats.stolen = (this.s.stats.stolen || 0) + m.pay;
        this.arms.robberies++;
        this.say(`Mugged: +${fmtMoney(m.pay)}.`, 'good');
        if (m.call) w.police.dispatchRobbery(w, { x: f.x, z: f.z, name: 'a street mugging' }, true);
      }
    }
  }

  // ---------------------------------------------------------------- hud
  hudLine() {
    const gn = this.gun;
    if (!gn) return '';
    const { g, def } = gn;
    if (def.melee) return `<b>${def.name}</b>`;
    return `<b>${def.name}</b>${g.frt ? ' <small style="color:#ff5a5a">FRT</small>' : ''} ${this.jammed ? '<b style="color:#ff5a5a">JAMMED — R</b>' : ''} &nbsp; ${this.reload > 0 ? 'RELOADING…' : `${g.loaded}/${def.mag}`} <small>· ${this.arms.ammo[def.cal] || 0} ${def.cal}</small>${this.armed ? '' : ' <small>(holstered — G)</small>'}`;
  }
  progress() {
    if (this.rob) return { v: this.rob.t / this.rob.dur, label: this.rob.cfg.what };
    if (this.mug) return { v: this.mug.t / this.mug.dur, label: 'wallet' };
    return null;
  }

  // ---------------------------------------------------------------- draw
  draw(ctx, cam) {
    const f = this.w.foot;
    const z = cam.zoom;
    // tracers and sparks
    ctx.save();
    for (const t of this.tracers) {
      ctx.strokeStyle = `rgba(255,236,160,${Math.min(1, t.t / 0.09) * 0.9})`; ctx.lineWidth = Math.max(1.5, 0.08 * z);
      ctx.beginPath(); ctx.moveTo(cam.sx(t.x0), cam.sy(t.z0)); ctx.lineTo(cam.sx(t.x1), cam.sy(t.z1)); ctx.stroke();
    }
    for (const sp of this.sparks) {
      ctx.fillStyle = `rgba(255,200,80,${sp.t / 0.18})`; ctx.beginPath(); ctx.arc(cam.sx(sp.x), cam.sy(sp.z), 0.28 * z * (1.4 - sp.t / 0.18), 0, Math.PI * 2); ctx.fill();
    }
    for (const fl of this.flashes) {
      const sx = cam.sx(fl.x), sy = cam.sy(fl.z);
      const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, 1.1 * z);
      gr.addColorStop(0, 'rgba(255,240,180,0.95)'); gr.addColorStop(1, 'rgba(255,140,30,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(sx, sy, 1.1 * z, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (this.w.inCar) return;
    const gn = this.gun;
    const sx = cam.sx(f.x), sy = cam.sy(f.z);
    if (this.armed && gn) {
      // the weapon in the player's hands, pointing where they aim
      const a = this.aim ?? f.h;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(a);
      const L = gn.def.len * z;
      ctx.fillStyle = '#15171a'; ctx.fillRect(-0.05 * z, -0.12 * z - L, 0.1 * z, L);
      if (gn.def.kind === 'arp') { ctx.fillStyle = '#26292e'; ctx.fillRect(-0.07 * z, -0.12 * z - L * 0.45, 0.14 * z, L * 0.45); ctx.fillRect(-0.04 * z, -0.12 * z - L * 0.3, 0.08 * z, 0.18 * z); }
      ctx.fillStyle = '#0b0c0e'; ctx.fillRect(-0.045 * z, -0.12 * z - L - 0.06 * z, 0.09 * z, 0.08 * z);
      ctx.restore();
    }
    if (this.swingT > 0 && gn) {
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.swingA + (0.18 - this.swingT) * 9 - 0.8);
      ctx.strokeStyle = '#c9ccd1'; ctx.lineWidth = Math.max(2, 0.12 * z); ctx.beginPath(); ctx.moveTo(0, -0.2 * z); ctx.lineTo(0, -(0.3 + gn.def.len) * z); ctx.stroke(); ctx.restore();
    }
  }

  // drawn on top of buildings and canopies
  drawOverlay(ctx, cam) {
    const f = this.w.foot, z = cam.zoom;
    if (this.w.inCar) return;
    const sx = cam.sx(f.x), sy = cam.sy(f.z);
    const pr = this.progress();
    if (pr) {
      const bw = 3.2 * z, bx = sx - bw / 2, by = sy - 2.2 * z;
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(bx - 3, by - 3, bw + 6, 0.5 * z + 6);
      ctx.fillStyle = '#ff2a3a'; ctx.fillRect(bx, by, bw * Math.min(1, pr.v), 0.5 * z);
      ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.max(10, 0.55 * z)}px Rajdhani, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(`Emptying the ${pr.label}…`, sx, by - 6);
    }
  }
}
