// The hog hunt, Hogs & Dogs style, out in Johnson County.
//
// You park at the edge of a lease with up to three bay dogs and two catch
// dogs. The bay dogs cast out and work the woods; one winds a hog, trails it
// and bays it up (or the hog breaks and runs, and they run it down). You walk
// in on the bark, turn the catch dogs loose when you're close, and they take
// hold. Walk up to a caught hog and tie it off. Hogs go to the processor in
// Joshua by the pound, trophies pay more.
//
// This is the simulation only (meters, seconds). ui/hoghunt.js draws it and
// feeds it taps. DOM-free so check-data can run whole hunts.

import { HOGS, GROUND_BY_ID, HOG_PER_LB, HUNT_SECONDS, MAX_BAY, MAX_CATCH, STATS } from '../data/dogs.js';
import { ensureKennel, bayScore, catchScore, isAdult } from './dogs.js';
import { earn, fmtMoney } from './state.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const W = 220, H = 150;          // the lease, in meters
const BAY_R = 3.4, REACH = 3.2, TIE_R = 7, RELEASE_R = 45;

function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export const readyToHunt = d => isAdult(d) && d.health >= 40 && d.energy >= 35;
export const huntReady = s => ensureKennel(s).dogs.filter(readyToHunt);

// Pick the best dogs for each job when the player hasn't chosen.
export function autoPick(s) {
  const ok = huntReady(s), bay = [...ok].sort((a, b) => bayScore(b) - bayScore(a)).slice(0, MAX_BAY);
  const rest = ok.filter(d => !bay.includes(d)), ctch = rest.sort((a, b) => catchScore(b) - catchScore(a)).slice(0, MAX_CATCH);
  // with only a few dogs, the best catch dog catches even if it could bay
  if (!ctch.length && bay.length > 1) ctch.push(bay.sort((a, b) => catchScore(b) - catchScore(a)).shift());
  return { bay: bay.map(d => d.id), ctch: ctch.map(d => d.id) };
}

// ---------------------------------------------------------------- start
export function startHunt(s, groundId, bayIds, catchIds, seed = (Math.random() * 2 ** 31) | 0) {
  const g = GROUND_BY_ID[groundId], k = ensureKennel(s);
  if (!g) return { ok: false, text: 'No such lease.' };
  const pickDogs = ids => ids.map(id => k.dogs.find(d => d.id === id)).filter(d => d && readyToHunt(d));
  const bay = pickDogs(bayIds).slice(0, MAX_BAY), ctch = pickDogs(catchIds).filter(d => !bay.includes(d)).slice(0, MAX_CATCH);
  if (!bay.length) return { ok: false, text: 'Take at least one bay dog to find the hogs.' };
  const rnd = mulberry32(seed);
  const R = (a, b) => a + rnd() * (b - a);
  const truck = { x: 14, y: H / 2 };
  // cover: brush and timber, more of it on the rough leases
  const cover = [];
  for (let i = 0; i < 60 + g.brush * 140; i++) cover.push({ x: R(28, W - 4), y: R(4, H - 4), r: R(2.5, 7), kind: rnd() < 0.55 ? 'tree' : 'brush' });
  // a creek wandering across
  const creek = []; let cy = R(30, H - 30);
  for (let x = -5; x <= W + 5; x += 10) { creek.push([x, cy]); cy = clamp(cy + R(-9, 9), 12, H - 12); }
  const hogs = [];
  const tot = g.hogs.reduce((t, [, w]) => t + w, 0);
  for (let i = 0; i < g.count; i++) {
    let r = rnd() * tot, kind = g.hogs[0][0];
    for (const [kk, w] of g.hogs) { r -= w; if (r < 0) { kind = kk; break; } }
    const Hg = HOGS[kind];
    hogs.push({ i, kind, w: Math.round(R(Hg.w[0], Hg.w[1])), x: R(70, W - 12), y: R(12, H - 12), h: R(0, 6.28), state: 'hidden', seen: false, runT: 0, held: 0, tx: 0, ty: 0 });
  }
  const mk = (d, role) => ({ id: d.id, name: d.name, role, d, x: truck.x + R(-3, 3), y: truck.y + R(-3, 3), tx: truck.x, ty: truck.y, state: role === 'bay' ? 'cast' : 'heel', hog: null, wait: 0, bark: 0, hp: d.health, hurt: 0, bays: 0, catches: 0, step: 0, h: 0 });
  const h = {
    ground: g.id, seed, t: 0, over: false, W, H, truck, cover, creek, hogs,
    player: { x: truck.x + 4, y: truck.y, tx: truck.x + 4, ty: truck.y, h: 0, step: 0 },
    dogs: [...bay.map(d => mk(d, 'bay')), ...ctch.map(d => mk(d, 'catch'))],
    vests: { ...k.vests }, collar: !!k.collar, bag: [], events: [], rnd,
  };
  return { ok: true, hunt: h };
}

// ---------------------------------------------------------------- player input
export function walkTo(h, x, y) { h.player.tx = clamp(x, 2, W - 2); h.player.ty = clamp(y, 2, H - 2); }
// the bayed or running hog the catch dogs would go for
export function releaseTarget(h) {
  let best = null, bd = 1e9;
  for (const g of h.hogs) {
    if (g.state !== 'bay' && g.state !== 'run') continue;
    const d = dist(g, h.player);
    if (d < RELEASE_R && d < bd) { bd = d; best = g; }
  }
  return best;
}
export const canRelease = h => !!releaseTarget(h) && h.dogs.some(d => d.role === 'catch' && d.state === 'heel');
export function release(h) {
  const g = releaseTarget(h);
  if (!g) return false;
  let n = 0;
  for (const d of h.dogs) if (d.role === 'catch' && d.state === 'heel') { d.state = 'go'; d.hog = g; n++; }
  if (n) note(h, `Turned the catch dogs loose on the ${HOGS[g.kind].name.toLowerCase()}.`, 'go');
  return n > 0;
}
export const tieTarget = h => h.hogs.find(g => g.state === 'caught' && dist(g, h.player) < TIE_R) || null;
export function tie(h) {
  const g = tieTarget(h);
  if (!g) return false;
  g.state = 'tied';
  h.bag.push({ kind: g.kind, w: g.w });
  for (const d of h.dogs) if (d.hog === g) { d.hog = null; d.state = d.role === 'bay' ? 'cast' : 'heel'; d.wait = 1; }
  note(h, `Tied off a ${g.w} lb ${HOGS[g.kind].name.toLowerCase()}.`, 'tie');
  return true;
}
function note(h, text, kind = 'info') { h.events.push({ t: h.t, text, kind }); if (h.events.length > 30) h.events.shift(); }

// ---------------------------------------------------------------- the sim
function moveTo(o, x, y, speed, dt) {
  const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy);
  if (d < 0.05) return d;
  const m = Math.min(d, speed * dt);
  o.x += dx / d * m; o.y += dy / d * m; o.step = (o.step || 0) + m;
  o.h = Math.atan2(dy, dx);
  return d - m;
}
const dogSpeed = d => 4.5 + d.d.stats.spd * 0.065;            // m/s: a 70-speed cur does about 9
const hogSpeed = g => HOGS[g.kind].speed * (1 - Math.min(0.25, (g.w - 150) / 1200));
const nose = d => 14 + d.d.stats.trk * 0.26 + (d.d.temp === 'Sharp' ? 8 : 0);
const activeOn = (h, g, roles) => h.dogs.filter(d => d.hog === g && roles.includes(d.state));

export function step(h, dt) {
  if (h.over) return;
  const r = h.rnd;
  h.t += dt;
  // the hunter
  const P = h.player;
  moveTo(P, P.tx, P.ty, 6, dt);
  // hogs
  for (const g of h.hogs) {
    if (g.state === 'hidden') {
      // rooting around, a few steps at a time
      if (r() < dt * 0.15) { g.tx = clamp(g.x + (r() - 0.5) * 20, 50, W - 6); g.ty = clamp(g.y + (r() - 0.5) * 20, 6, H - 6); }
      if (g.tx) moveTo(g, g.tx, g.ty, 0.7, dt);
    } else if (g.state === 'run') {
      g.runT += dt;
      // away from the closest dog, and away from you, bending off the fence
      let ax = 0, ay = 0;
      for (const d of h.dogs) { if (d.hog !== g) continue; const dd = Math.max(1, dist(d, g)); ax += (g.x - d.x) / dd / dd; ay += (g.y - d.y) / dd / dd; }
      const pd = Math.max(1, dist(P, g)); ax += (g.x - P.x) / pd / pd; ay += (g.y - P.y) / pd / pd;
      const n = Math.hypot(ax, ay) || 1;
      g.tx = g.x + ax / n * 10; g.ty = g.y + ay / n * 10;
      if (g.ty < 8 || g.ty > H - 8) g.ty = g.y; if (g.tx > W - 6) g.tx = g.x;
      moveTo(g, g.tx, g.ty, hogSpeed(g), dt);
      const chasing = activeOn(h, g, ['trail']).length;
      if (!chasing && g.runT > 6 || g.runT > 40 || g.x > W - 7 && g.runT > 10) {
        g.state = 'gone';
        for (const d of h.dogs) if (d.hog === g) { d.hog = null; d.state = d.role === 'bay' ? 'cast' : 'heel'; }
        note(h, `The ${HOGS[g.kind].name.toLowerCase()} got away into the thicket.`, 'bad');
      }
    } else if (g.state === 'bay') {
      const bayers = activeOn(h, g, ['bay']), holders = activeOn(h, g, ['hold']);
      if (!bayers.length && !holders.length) { g.state = 'run'; g.runT = 0; continue; }
      g.held += dt;
      if (holders.length) {
        // the catch: enough dog on it and he's caught, too little and he shakes them off
        let power = holders.reduce((t, d) => t + catchScore(d.d) * (d.d.temp === 'Bold' ? 1.05 : d.d.temp === 'Hot-headed' ? 1.08 : 1), 0);
        power += bayers.length * 8;
        const need = g.w * 0.42 * Math.sqrt(HOGS[g.kind].mult);
        if (r() < dt * clamp(0.2 * power / need, 0.04, 0.7)) {
          g.state = 'caught';
          for (const d of holders) d.catches++;
          note(h, `Caught! ${holders.map(d => d.name).join(' and ')} ${holders.length > 1 ? 'have' : 'has'} the ${HOGS[g.kind].name.toLowerCase()} by the ear. Go tie it.`, 'good');
        } else if (r() < dt * 0.09 * clamp(need / power, 0.3, 2.5)) {
          g.state = 'run'; g.runT = 0;
          for (const d of holders) d.state = 'trail';
          note(h, `The ${HOGS[g.kind].name.toLowerCase()} shook loose!`, 'bad');
        }
      } else {
        // the bay holds, or he breaks
        const sc = bayers.reduce((t, d) => t + bayScore(d.d), 0) / bayers.length;
        const calm = bayers.some(d => d.d.temp === 'Calm') ? 0.7 : 1;
        if (r() < dt * 0.05 * Math.sqrt(HOGS[g.kind].mult) * (70 / Math.max(30, sc)) * calm / Math.sqrt(bayers.length)) {
          g.state = 'run'; g.runT = 0;
          for (const d of bayers) d.state = 'trail';
          note(h, `He broke bay and he's running!`, 'bad');
        }
      }
      // tusks
      for (const d of [...bayers, ...holders]) {
        const hot = d.d.temp === 'Hot-headed' ? 1.5 : 1, vest = h.vests[d.id] ? 0.4 : 1;
        if (r() < dt * (d.state === 'hold' ? 0.035 : 0.008) * HOGS[g.kind].mult * hot * vest) {
          const dmg = Math.round(8 + r() * 18);
          d.hp -= dmg; d.hurt += dmg;
          if (d.hp < 20) { d.state = 'hurt'; d.hog = null; note(h, `${d.name} got cut bad. ${d.d.sex === 'F' ? 'She' : 'He'}'s limping back to the truck.`, 'bad'); }
          else note(h, `${d.name} took a tusk (−${dmg}).`, 'bad');
        }
      }
    }
  }
  // dogs
  for (const d of h.dogs) {
    const sp = dogSpeed(d);
    d.bark = Math.max(0, d.bark - dt);
    if (d.state === 'hurt') { moveTo(d, h.truck.x + 2, h.truck.y + 2, 2, dt); continue; }
    if (d.state === 'heel') {
      const bx = P.x - Math.cos(P.h) * 2.5 + (d.role === 'catch' && h.dogs.indexOf(d) % 2 ? 1.2 : -1.2), by = P.y - Math.sin(P.h) * 2.5;
      if (Math.hypot(bx - d.x, by - d.y) > 1.2) moveTo(d, bx, by, Math.min(sp, 7), dt);
      continue;
    }
    if (d.state === 'cast') {
      d.wait -= dt;
      if (d.wait <= 0 || Math.hypot(d.tx - d.x, d.ty - d.y) < 1.5) {
        // out ahead of you, working the woods
        d.tx = clamp(P.x + 30 + r() * 120, 20, W - 6); d.ty = clamp(d.y + (r() - 0.5) * 80, 6, H - 6); d.wait = 4 + r() * 5;
      }
      moveTo(d, d.tx, d.ty, sp * 0.55, dt);
      for (const g of h.hogs) {
        if (g.state !== 'hidden' && g.state !== 'run') continue;
        if (dist(d, g) < nose(d) && r() < dt * (0.5 + d.d.stats.trk / 200)) {
          d.state = 'trail'; d.hog = g;
          if (!g.seen) { g.seen = true; note(h, `${d.name} struck a track and opened up!`, 'info'); }
          break;
        }
      }
      continue;
    }
    const g = d.hog;
    if (!g || g.state === 'gone' || g.state === 'tied') { d.hog = null; d.state = d.role === 'bay' ? 'cast' : 'heel'; continue; }
    if (g.state === 'caught') {
      // keep hold of it till you tie it
      if (d.role === 'catch') moveTo(d, g.x + Math.cos(d.id.length + h.dogs.indexOf(d)) * 1.2, g.y + Math.sin(h.dogs.indexOf(d)) * 1.2, sp, dt);
      else moveTo(d, g.x + Math.cos(h.t + h.dogs.indexOf(d) * 2) * BAY_R, g.y + Math.sin(h.t + h.dogs.indexOf(d) * 2) * BAY_R, 3, dt);
      continue;
    }
    if (d.state === 'trail' || d.state === 'go') {
      const left = moveTo(d, g.x, g.y, sp, dt);
      if (left < REACH) {
        if (d.role === 'catch') {
          if (g.state === 'run' || g.state === 'hidden') g.state = 'bay';
          d.state = 'hold';
          if (!h.dogs.some(o => o !== d && o.state === 'hold' && o.hog === g)) note(h, `${d.name} hit him!`, 'go');
        } else if (g.state === 'bay') { d.state = 'bay'; }
        else {
          // he stands and fights, or he runs
          const grit = h.dogs.filter(o => o.hog === g).reduce((t, o) => t + bayScore(o.d), 0);
          const pRun = clamp(0.3 + HOGS[g.kind].rar * 0.12 - grit / 900, 0.08, 0.8);
          if (g.state === 'hidden' && r() < pRun) { g.state = 'run'; g.runT = 0; note(h, `${HOGS[g.kind].name} jumped up and ran. ${d.name} is on him.`, 'info'); }
          else if (g.state === 'run' && r() < 0.7) { g.state = 'bay'; g.held = 0; d.state = 'bay'; d.bays++; note(h, `${d.name} bayed a ${HOGS[g.kind].name.toLowerCase()}! Walk in on the bark.`, 'good'); }
          else if (g.state === 'hidden') { g.state = 'bay'; g.held = 0; d.state = 'bay'; d.bays++; note(h, `${d.name} bayed a ${HOGS[g.kind].name.toLowerCase()}! Walk in on the bark.`, 'good'); }
        }
      }
    } else if (d.state === 'bay') {
      if (g.state !== 'bay') { d.state = 'trail'; continue; }
      const a = h.t * 1.3 + h.dogs.indexOf(d) * 2.1;
      moveTo(d, g.x + Math.cos(a) * BAY_R, g.y + Math.sin(a) * BAY_R, 4, dt);
      if (d.bark <= 0) d.bark = 0.5 + r() * 0.4;
    } else if (d.state === 'hold') {
      if (g.state !== 'bay') { d.state = 'trail'; continue; }
      moveTo(d, g.x + Math.cos(h.dogs.indexOf(d)) * 1.1, g.y + Math.sin(h.dogs.indexOf(d)) * 1.1, sp, dt);
    }
  }
  if (h.t >= HUNT_SECONDS) endHunt(h, 'time');
}
export function endHunt(h, why = 'done') {
  if (h.over) return;
  h.over = why;
  for (const g of h.hogs) if (g.state === 'caught') { g.state = 'tied'; h.bag.push({ kind: g.kind, w: g.w }); }
}
export const timeLeft = h => Math.max(0, HUNT_SECONDS - h.t);
export const hogValue = (b, groundId) => Math.round(b.w * HOG_PER_LB * HOGS[b.kind].mult * (groundId === 'chalk' ? 1.2 : 1));
export const baying = h => h.hogs.filter(g => g.state === 'bay');

// ---------------------------------------------------------------- settle up
// Pays for the hogs, writes the dogs' wear and experience back onto the real
// dogs. Returns a summary for the results screen.
export function settleHunt(s, h) {
  if (!h.over) endHunt(h);
  if (h.settled) return h.settled;
  const k = ensureKennel(s);
  const hogs = h.bag.map(b => ({ ...b, name: HOGS[b.kind].name, value: hogValue(b, h.ground) }));
  const pay = hogs.reduce((t, b) => t + b.value, 0);
  if (pay) earn(s, pay, `Joshua Wild Game Processing: ${hogs.length} hog${hogs.length > 1 ? 's' : ''}`);
  const dogs = [];
  for (const hd of h.dogs) {
    const d = k.dogs.find(x => x.id === hd.id);
    if (!d) continue;
    d.health = clamp(Math.round(hd.hp), 1, d.hcap);
    d.energy = Math.max(0, d.energy - 45);
    d.hunt.n++; d.hunt.bays += hd.bays; d.hunt.catches += hd.catches; d.hunt.hogs += h.bag.length ? 1 : 0;
    const xp = hd.bays * 10 + hd.catches * 14 + h.bag.length * 3 + 4; d.hunt.xp += xp;
    // working dogs get better at their job
    const ups = [];
    const bump = key => { if (d.stats[key] < d.pot[key]) { d.stats[key]++; ups.push(STATS.find(x => x[0] === key)[1]); } };
    if (hd.bays) bump('trk');
    if (hd.bays && Math.random() < 0.5) bump('int');
    if (hd.catches) bump('grip');
    if (hd.catches && Math.random() < 0.5) bump('str');
    dogs.push({ id: d.id, name: d.name, role: hd.role, bays: hd.bays, catches: hd.catches, hurt: hd.hurt, health: d.health, ups });
  }
  const st = k.st;
  st.hunts++; st.hogs += hogs.length; st.earned += pay;
  for (const b of hogs) if (b.w > st.best) { st.best = b.w; st.bestName = b.name; }
  h.settled = { hogs, pay, dogs, ground: GROUND_BY_ID[h.ground], text: hogs.length ? `${hogs.length} hog${hogs.length > 1 ? 's' : ''} to the processor for ${fmtMoney(pay)}.` : 'No hogs today. The dogs had a good run.' };
  return h.settled;
}

// For tests: a hunter who walks to whatever is bayed, turns the catch dogs
// loose and ties off what they catch.
export function autoHunter(h) {
  const t = tieTarget(h);
  if (t) { tie(h); return; }
  const caught = h.hogs.find(g => g.state === 'caught');
  if (caught) { walkTo(h, caught.x, caught.y); return; }
  const g = baying(h)[0];
  if (g) { walkTo(h, g.x - 6, g.y); if (canRelease(h) && dist(g, h.player) < 30) release(h); return; }
  const lead = h.dogs.find(d => d.role === 'bay' && d.state !== 'hurt');
  if (lead) walkTo(h, lead.x - 15, lead.y);
}
