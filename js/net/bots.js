// Other drivers on a quiet server. When only a few real players are on, the
// server fills up with regulars who drive around Fort Worth, stop at the
// meets and gas stations, get out and stand around, talk in chat, honk back,
// call you out to race, take your challenges, give and take rides, and log
// on and off through the day like people do.
//
// They live in online.peers next to real players (marked `bot`), so the map,
// the minimap, name tags, the Online panel, races and ride-alongs all treat
// them the same. Anything you send to one of them (a race invite, a ride
// request, a hit) never goes over the network: it's caught here and answered
// the way a player would.
//
// Who is on, where they drive and what they say on their own all come from
// the clock and the server name, so two real players on the same server see
// the same people in the same places saying the same things. Only what
// happens between you and one of them (a race, a ride, a fight) is yours
// alone; afterwards they drive off on their own and slip back onto their
// usual route once you can't see them.

import { online, SERVERS, SERVER_CAP } from './online.js';
import { CARS, carName } from '../data/cars.js';
import { defaultVisual, PAINT_SWATCHES, PERF } from '../data/parts.js';
import { RIMS } from '../data/rims.js';
import { LOCATIONS } from '../data/world.js';
import * as T from '../data/botTalk.js';

// ------------------------------------------------------------ seeded random
export function hash(...parts) {
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];

// ------------------------------------------------------------ who's on
export const SLOTS = 10;              // regulars that can be on one server at once
export const WINDOW = 2400;           // seconds: each slot has at most one session per 40 minutes
export const MAX_SHOWN = 9;           // never more than this many other drivers on a quiet server
const PER_SLOT = 4;                   // different people who use each slot
const BUSY = { eastgate: 1.15, glory: 1.1, downtown: 1.05, pier9: 1.05, harbor: 0.95, ironside: 0.9, dustline: 0.85, northridge: 0.9 };

// Fort Worth time (Central, no DST: close enough for "is it late?")
export const hourCT = t => (((Math.floor(t / 3600) - 6) % 24) + 24) % 24;
export function activity(hour, server) {
  const base = hour < 3 ? 0.62 : hour < 7 ? 0.25 : hour < 12 ? 0.4 : hour < 17 ? 0.5 : hour < 20 ? 0.68 : 0.8;
  return Math.min(0.92, base * (BUSY[server] || 1));
}

// The session one slot of one server has around time t (seconds), or null.
// Each slot's windows start at their own minute, so people come and go all
// through the hour instead of all at once.
export function sessionAt(server, slot, t) {
  const phase = hash('ph', server, slot) % WINDOW;
  const w = Math.floor((t + phase) / WINDOW), w0 = w * WINDOW - phase;
  const r = rng(hash('s', server, slot, w));
  // the first two slots are the ones who are always around
  const act = activity(hourCT(w0 + WINDOW / 2), server);
  if (r() >= (slot < 2 ? Math.max(0.9, act) : act)) return null;
  const start = w0 + 20 + r() * 420, end = w0 + WINDOW - 20 - r() * 420;
  if (t < start || t >= end) return null;
  const who = slot * PER_SLOT + (hash('w', server, slot, Math.floor(w / 3)) % PER_SLOT);
  return { key: `${server}:${slot}:${w}`, slot, who, start, end, seed: hash('r', server, slot, w), said: r() };
}
// The drivers on a server at time t, given how many real players are there.
export function botsOn(server, t, reals = 0) {
  const out = [];
  for (let j = 0; j < SLOTS; j++) { const s = sessionAt(server, j, t); if (s) out.push(s); }
  return out.slice(0, Math.max(0, Math.min(MAX_SHOWN, SERVER_CAP - 1) - reals));
}
// How many careers call this server home (for the server list), regulars included.
export const regulars = server => 5 + hash('reg', server) % 4;

// ------------------------------------------------------------ who they are
const CAR_POOL = CARS.filter(c => !c.rig && (!c.market || c.msrp < 150000) && c.msrp < 260000);
const STREET = CAR_POOL.filter(c => ['Muscle', 'Tuner', 'JDM', 'Sedan', 'Truck'].includes(c.cls) && c.msrp < 90000);
const TINTS = ['none', 'light', 'medium', 'limo'];
const SPOILERS = ['none', 'none', 'lip', 'duck', 'gt'];
const NEON = ['none', 'none', 'none', '#13b3c4', '#6b2bd1', '#c41b1b', '#1f8f3a'];

function makeName(r) {
  const a = pick(r, T.FIRST);
  const shape = pick(r, T.NAME_SHAPES);
  const n = String(Math.floor(r() * 99) + 1);
  let s = shape.map(p => p === 'a' ? a : p === 'w' ? pick(r, T.WORDS) : p === 'n' ? n : p === 'I' ? 'Tha ' + pick(r, ['1st', '3rd', 'Kid']) : p).join('');
  if (r() < 0.3) s = s.toLowerCase();
  return s.replace(/[^\w .'\-]/g, '').slice(0, 16);
}

export function persona(server, who) {
  const r = rng(hash('p', server, who));
  const name = makeName(r);
  const tier = 1 + Math.floor(Math.pow(r(), 1.6) * (server === 'glory' ? 9 : 7));
  const pool = tier >= 6 && r() < 0.6 ? CAR_POOL : STREET.length ? STREET : CAR_POOL;
  const model = pick(r, pool);
  const visual = defaultVisual(model);
  if (r() < 0.7) visual.paint = pick(r, PAINT_SWATCHES);
  if (r() < 0.25) visual.finish = 'matte';
  if (r() < 0.75) { const rim = pick(r, RIMS); visual.wheels = rim.style; visual.rim = rim.id; visual.wheelColor = rim.color; }
  visual.tint = pick(r, TINTS); visual.spoiler = pick(r, SPOILERS); visual.neon = pick(r, NEON);
  visual.wheelSize = pick(r, ['18', '19', '20', '22']);
  visual.plate = (pick(r, ['FW', 'TX', 'GLT', '817', 'CTWN', 'RACE']) + Math.floor(r() * 999)).toUpperCase().slice(0, 8);
  const levels = {};
  const top = Math.min(4, Math.ceil(tier / 2));
  for (const p of PERF) levels[p.id] = r() < 0.65 ? Math.floor(r() * (top + 1)) : 0;
  if (levels.turbo && levels.supercharger) levels[r() < 0.5 ? 'turbo' : 'supercharger'] = 0;
  return {
    who, name, model, visual, levels, tier,
    crew: r() < 0.35 ? pick(r, T.CREWS) : null,
    skill: 0.45 + r() * 0.5,          // how well they race
    drv: 0.95 + r() * 0.35,           // how fast they drive around town
    chatty: 0.3 + r() * 0.7,
    temper: r(),                      // > 0.65 shoots back
    racer: 0.4 + r() * 0.55,          // how often they say yes to a race
    bank: [1000, 5000, 10000, 25000][Math.floor(r() * 4)],
    foot: 0.3 + r() * 0.5,            // how often they get out at a stop
    rides: 0.8,                       // how often they let you ride along
  };
}

// ------------------------------------------------------------ where they drive
// Fort Worth proper: downtown, the Southside, Stop Six, Loop 820 and the strip.
const AREA = { x0: -1300, x1: 2000, z0: -1400, z1: 1300 };
const inArea = n => n.x >= AREA.x0 && n.x <= AREA.x1 && n.z >= AREA.z0 && n.z <= AREA.z1;
const HANG = ['meet', 'carshow', 'food', 'gas', 'perf', 'visual', 'roll', 'drag', 'corner', 'repair'];
const NIGHT_HANG = ['meet', 'meet', 'carshow', 'roll', 'drag', 'food', 'gas'];

// The road graph cut down to Fort Worth, with a quick shortest-path search.
export function botMap(roads) {
  if (roads._bots) return roads._bots;
  const ok = new Uint8Array(roads.nodes.length);
  for (const n of roads.nodes) ok[n.id] = inArea(n) ? 1 : 0;
  const adj = roads.nodes.map(n => ok[n.id] ? n.edges.map(id => roads.edges[id]).filter(e => !e.track && ok[e.a] && ok[e.b]) : []);
  const nodes = roads.nodes.filter(n => adj[n.id].length);
  const spots = [];
  for (const l of LOCATIONS) {
    if (l.city || !HANG.includes(l.type) || !inArea(l)) continue;
    let best = null;
    for (const n of nodes) for (const e of adj[n.id]) {
      if (e.a !== n.id) continue;
      const s = Math.max(0, Math.min(e.len, (l.x - e.ax) * e.dx + (l.z - e.az) * e.dz));
      const d = Math.hypot(e.ax + e.dx * s - l.x, e.az + e.dz * s - l.z);
      if (!best || d < best.d) best = { e, s, d };
    }
    if (best && best.d < 60) spots.push({ loc: l, type: l.type, e: best.e, s: best.s, d: best.d });
  }
  const route = (from, to) => {
    if (from === to) return [from];
    const N = roads.nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
    const heap = [[0, from]]; dist[from] = 0;
    while (heap.length) {
      // tiny binary heap
      const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } }
      const [d, u] = top;
      if (d > dist[u]) continue;
      if (u === to) break;
      for (const e of adj[u]) {
        const v = e.a === u ? e.b : e.a, nd = d + e.len / (e.speed || 15);
        if (nd < dist[v]) {
          dist[v] = nd; prev[v] = u;
          heap.push([nd, v]); let i = heap.length - 1;
          while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
        }
      }
    }
    if (prev[to] < 0) return null;
    const path = [];
    for (let v = to; v >= 0; v = prev[v]) { path.unshift(v); if (v === from) break; }
    return path;
  };
  const edgeBetween = (a, b) => adj[a].find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a)) || null;
  return (roads._bots = { roads, nodes, adj, spots, route, edgeBetween });
}

// A plan is a list of pieces covering [0, dur] seconds:
//   move: straight line from (x, z) along (dx, dz) for len metres, speed v0 → v1
//   stop: parked at (x, z); `foot` = out of the car, standing next to it
const ACC = 2.8, DEC = 4.5;
const laneOff = e => e.lanes?.[0] ?? 2;
const heading = (dx, dz) => Math.atan2(dx, -dz);

class Planner {
  constructor(bm, r, p) { this.bm = bm; this.r = r; this.p = p; this.out = []; this.t = 0; }
  stop(x, z, h, secs, foot = false) {
    if (secs <= 0) return;
    this.out.push({ stop: true, t0: this.t, t1: this.t + secs, x, z, h, foot });
    this.t += secs;
  }
  piece(x, z, dx, dz, len, v0, v1, h) {
    if (len < 0.01) return;
    const secs = 2 * len / Math.max(0.01, v0 + v1);
    this.out.push({ t0: this.t, t1: this.t + secs, x, z, dx, dz, len, v0, v1, h });
    this.t += secs;
  }
  // From P to Q: speed up from v0 toward vc, hold it, slow to v1 by the end.
  move(px, pz, qx, qz, v0, vc, v1) {
    const len = Math.hypot(qx - px, qz - pz);
    if (len < 0.05) return;
    const dx = (qx - px) / len, dz = (qz - pz) / len, h = heading(dx, dz);
    vc = Math.max(vc, v0, v1, 0.5);
    let da = (vc * vc - v0 * v0) / (2 * ACC), dd = (vc * vc - v1 * v1) / (2 * DEC);
    if (da + dd > len) {
      vc = Math.sqrt((2 * ACC * DEC * len + DEC * v0 * v0 + ACC * v1 * v1) / (ACC + DEC));
      if (vc < Math.max(v0, v1) + 0.01) { this.piece(px, pz, dx, dz, len, v0, v1, h); return; }
      da = (vc * vc - v0 * v0) / (2 * ACC); dd = (vc * vc - v1 * v1) / (2 * DEC);
    }
    let s = 0;
    const seg = (l, a, b) => { this.piece(px + dx * s, pz + dz * s, dx, dz, l, a, b, h); s += l; };
    seg(da, v0, vc); seg(len - da - dd, vc, vc); seg(dd, vc, v1);
  }
  // Drive a node path, with turns slowed for and the odd red light.
  drive(path, v0, endV = 0) {
    const { roads } = this.bm, r = this.r;
    let v = v0;
    for (let i = 0; i + 1 < path.length; i++) {
      const A = roads.nodes[path[i]], B = roads.nodes[path[i + 1]];
      const e = this.bm.edgeBetween(A.id, B.id);
      if (!e) break;
      const dx = (B.x - A.x) / e.len, dz = (B.z - A.z) / e.len, off = laneOff(e);
      const nx = -dz * off, nz = dx * off;
      const cruise = Math.min(e.speed * this.p.drv * (e.kind === 'highway' ? 1.1 : 1), 42);
      let vEnd = endV, red = 0;
      if (i + 2 < path.length) {
        const C = roads.nodes[path[i + 2]], e2 = this.bm.edgeBetween(B.id, C.id);
        const dot = e2 ? dx * (C.x - B.x) / e2.len + dz * (C.z - B.z) / e2.len : 1;
        vEnd = dot < -0.7 ? 3 : dot < 0.7 ? 6.5 : Math.min(cruise, e2 ? e2.speed * this.p.drv : cruise);
        if (e.kind === 'city' && B.edges.length >= 3 && r() < 0.18) { red = 2 + r() * 11; vEnd = 0; }
      }
      this.move(A.x + nx, A.z + nz, B.x + nx, B.z + nz, v, cruise, vEnd);
      if (red) this.stop(B.x + nx, B.z + nz, heading(dx, dz), red);
      v = vEnd;
    }
    return v;
  }
}

function pickSpot(bm, r, night) {
  const want = night ? NIGHT_HANG : HANG;
  const type = pick(r, want);
  const list = bm.spots.filter(s => s.type === type);
  return list.length ? pick(r, list) : bm.spots.length ? pick(r, bm.spots) : null;
}

// Plan `dur` seconds of someone's time on the server. `from` = where they are
// now ({ x, z, h }), or nothing to start at a random corner.
export function makePlan(bm, seed, p, dur, from = null, night = false) {
  const r = rng(seed), P = new Planner(bm, r, p), { roads } = bm;
  let node, v = 0;
  if (from) {
    // pull back onto the nearest road, heading the way they face
    let best = null;
    for (const n of bm.nodes) for (const e of bm.adj[n.id]) {
      if (e.a !== n.id) continue;
      const s = Math.max(0, Math.min(e.len, (from.x - e.ax) * e.dx + (from.z - e.az) * e.dz));
      const d = Math.hypot(e.ax + e.dx * s - from.x, e.az + e.dz * s - from.z);
      if (!best || d < best.d) best = { e, s, d };
    }
    const e = best.e, fwd = Math.sin(from.h) * e.dx - Math.cos(from.h) * e.dz >= 0;
    node = fwd ? e.b : e.a;
    const N = roads.nodes[node], dx = fwd ? e.dx : -e.dx, dz = fwd ? e.dz : -e.dz, off = laneOff(e);
    P.move(from.x, from.z, N.x - dz * off, N.z + dx * off, from.v || 0, e.speed * p.drv, 6.5);
    v = 6.5;
  } else node = pick(r, bm.nodes).id;
  let guard = 0;
  while (P.t < dur && guard++ < 400) {
    const spot = r() < 0.55 ? pickSpot(bm, r, night) : null;
    if (spot) {
      // drive to the spot, pull over by the door, hang out a while
      const e = spot.e, end = r() < 0.5 ? e.a : e.b;
      const path = bm.route(node, end);
      if (!path) { node = pick(r, bm.nodes).id; continue; }
      v = P.drive(path, v, 6);
      const N = roads.nodes[end], fwd = end === e.a, dx = fwd ? e.dx : -e.dx, dz = fwd ? e.dz : -e.dz, off = laneOff(e);
      const sAlong = fwd ? spot.s : e.len - spot.s;
      const rx = N.x + dx * sAlong - dz * off, rz = N.z + dz * sAlong + dx * off;
      P.move(N.x - dz * off, N.z + dx * off, rx, rz, v, 9, 0);
      // into the lot / against the kerb, toward the place itself
      const lx = spot.loc.x - rx, lz = spot.loc.z - rz, ld = Math.hypot(lx, lz), pull = Math.min(Math.max(0, ld - 3), 7);
      const px = rx + (ld ? lx / ld : 0) * pull, pz = rz + (ld ? lz / ld : 0) * pull;
      P.move(rx, rz, px, pz, 0, 2.5, 0);
      const h = heading(dx, dz), stay = (spot.type === 'meet' || spot.type === 'carshow' ? 90 : 30) + r() * 150;
      if (r() < p.foot) {
        P.stop(px, pz, h, 3);
        const sx = px + (ld ? lx / ld : 0) * 2.6 + dx * 1.5, sz = pz + (ld ? lz / ld : 0) * 2.6 + dz * 1.5;
        P.stop(sx, sz, h + Math.PI / 2 + (r() - 0.5), stay, true);
        P.stop(px, pz, h, 3);
      } else P.stop(px, pz, h, stay);
      // back out onto the road and on to the far corner
      P.move(px, pz, rx, rz, 0, 2.5, 0);
      const far = fwd ? e.b : e.a, F = roads.nodes[far];
      P.move(rx, rz, F.x - dz * off, F.z + dx * off, 0, e.speed * p.drv, 6.5);
      node = far; v = 6.5;
    } else {
      // just cruising: somewhere across town
      const dest = pick(r, bm.nodes).id;
      const path = bm.route(node, dest);
      if (!path || path.length < 2) { node = dest; continue; }
      v = P.drive(path, v, r() < 0.3 ? 0 : 6.5);
      if (v === 0) { const N = roads.nodes[dest]; P.stop(N.x, N.z, P.out.length ? P.out[P.out.length - 1].h : 0, 2 + r() * 8); }
      node = dest;
    }
  }
  return P.out;
}

// Where the plan has them `t` seconds in: { x, z, h, v, inCar, moving }.
export function planAt(plan, t, hint = 0) {
  if (!plan.length) return null;
  let i = Math.min(Math.max(0, hint), plan.length - 1);
  if (plan[i].t0 > t) i = 0;
  while (i < plan.length - 1 && plan[i].t1 <= t) i++;
  const q = plan[i], tau = Math.max(0, Math.min(t, q.t1) - q.t0);
  if (q.stop) {
    if (!q.foot) return { i, x: q.x, z: q.z, h: q.h, v: 0, inCar: true };
    // standing around: a step or two now and then
    const sway = Math.sin(tau * 0.35) * 1.1, walking = Math.abs(Math.cos(tau * 0.35)) > 0.6;
    return { i, x: q.x + Math.cos(q.h) * sway, z: q.z + Math.sin(q.h) * sway, h: q.h + (Math.cos(tau * 0.35) > 0 ? 0 : Math.PI), v: walking ? 1.2 : 0, inCar: false };
  }
  const a = (q.v1 * q.v1 - q.v0 * q.v0) / (2 * q.len);
  const s = Math.min(q.len, q.v0 * tau + 0.5 * a * tau * tau);
  return { i, x: q.x + q.dx * s, z: q.z + q.dz * s, h: q.h, v: Math.max(0, q.v0 + a * tau), inCar: !q.walk };
}

// ------------------------------------------------------------ chat lines
function fill(line, ctx, r) {
  return line.replace(/\{(\w+)\}/g, (_, k) => {
    if (k === 'me') return ctx.me || 'yo';
    if (k === 'mycar') return ctx.mycar || 'car';
    if (k === 'other' || k === 'B') return ctx.other || pick(r, T.FIRST);
    if (k === 'car') return ctx.car || 'charger';
    if (k === 'acar') return ctx.acar || 'car';
    if (k === 'bcar') return ctx.bcar || 'car';
    if (k === 'street') return pick(r, T.STREETS);
    if (k === 'place') return pick(r, T.PLACES);
    if (k === 'meet') return pick(r, T.MEETS);
    return '';
  });
}
const shortCar = m => m ? `${m.model}`.toLowerCase() : 'car';

// ------------------------------------------------------------ the manager
const now = () => Date.now() / 1000;
const CHAT_EVERY = 25;          // seconds per ambient-chat bucket
const SNAP_AWAY = 230;          // metres: far enough that nobody sees them jump back onto their route

class Bots {
  constructor() {
    this.list = new Map();      // id -> bot
    this.roads = null;
    this.force = false;         // tests turn them on under webdriver
    this.off = false;
    this.clock = now;
    this.pending = [];          // delayed things they do: [{ at, fn }]
    this.checkT = 0; this.bucket = 0; this.inviteT = 200; this.honkT = 0;
    this.joinedAt = 0;
    online.botHook = m => this.hook(m);
    online.on((ev, d) => this.onOnline(ev, d));
  }
  get enabled() {
    if (this.off) return false;
    if (this.force) return true;
    return !(typeof navigator !== 'undefined' && navigator.webdriver);
  }
  attach(world) { this.world = world; this.roads = world?.map?.roads || null; }
  has(id) { return typeof id === 'string' && this.list.has(id); }

  reals() { let n = 0; for (const p of online.peers.values()) if (!p.bot) n++; return n; }
  later(secs, fn) { this.pending.push({ at: this.clock() + secs, fn }); }

  onOnline(ev) {
    if (ev === 'status') {
      if (!online.active) { this.clear(); return; }
      this.clear();
      // answers keep coming while the game is paused behind a menu, like real players' do
      clearInterval(this.timer); this.timer = setInterval(() => { if (online.active) this.runPending(); else clearInterval(this.timer); }, 250);
      this.joinedAt = this.clock(); this.bucket = Math.floor(this.clock() / CHAT_EVERY);
      this.inviteT = 150 + Math.random() * 180; this.checkT = 0; this.greeted = false;
    }
  }
  clear() { for (const id of this.list.keys()) online.peers.delete(id); this.list.clear(); this.pending = []; }

  // ---- who's on right now
  refresh(me) {
    if (!online.active || !this.enabled || !this.roads) { if (this.list.size) { this.clear(); online.emit('peers'); } return; }
    const t = this.clock(), want = botsOn(online.room, t, this.reals());
    const keep = new Set(want.map(s => s.key));
    let changed = false;
    for (const [id, b] of this.list) {
      if (keep.has(b.s.key)) continue;
      if (b.carrying || b.riding) continue;          // they don't log off with you in the car
      if (t - this.joinedAt > 20 && b.s.said < 0.5 * b.p.chatty && t >= b.s.end - 5) this.say(b, pick(Math.random, T.LEAVE));
      this.list.delete(id); online.peers.delete(id); changed = true;
    }
    const have = new Set([...this.list.values()].map(b => b.s.key));
    for (const s of want) if (!have.has(s.key)) { this.add(s, t, me); changed = true; }
    if (changed) online.emit('peers');
  }

  add(s, t, me) {
    const p = persona(online.room, s.who);
    const id = '~' + (hash('id', s.key) % 2176782336).toString(36);
    const bm = botMap(this.roads);
    const night = this.isNight(s.start);
    const plan = makePlan(bm, s.seed, p, s.end - s.start + 60, null, night);
    const peer = { id, bot: true, name: p.name, uid: '', model: p.model, visual: p.visual, levels: p.levels, tier: p.tier, crew: p.crew, skill: p.skill,
      x: 0, z: 0, h: 0, sp: 0, inCar: true, flame: 0, sflame: 0, walk: 0, seen: performance.now() / 1000, t: 0, fresh: false, sprite: null, spriteKey: '',
      snaps: [], hp: 100, dead: false, ride: '' };
    const b = { id, s, p, peer, plan, i: 0, local: null, place: true };
    const at = planAt(plan, t - s.start);
    Object.assign(peer, { x: at.x, z: at.z, h: at.h, sp: at.v, inCar: at.inCar });
    this.list.set(id, b); online.peers.set(id, peer);
    // logged on while you're here: some say hi
    if (t - this.joinedAt > 15 && t - s.start < 30 && s.said < 0.6 * p.chatty) this.later(2 + Math.random() * 6, () => this.say(b, pick(Math.random, T.JOIN)));
    return b;
  }

  isNight(t) { const h = hourCT(t); return h >= 20 || h < 5; }

  // ---- per frame (me = the world's player state)
  tick(dt, me) {
    if (!online.active) return;
    this.checkT -= dt;
    if (this.checkT <= 0) { this.checkT = 1; this.refresh(me); }
    if (!this.list.size) { this.runPending(); return; }
    const t = this.clock(), pnow = performance.now() / 1000;
    for (const b of this.list.values()) this.move(b, dt, t, me, pnow);
    this.runPending();
    this.ambient(t, me);
    this.act(dt, me);
  }
  runPending() {
    if (!this.pending.length) return;
    const t = this.clock(), due = this.pending.filter(x => x.at <= t);
    if (!due.length) return;
    this.pending = this.pending.filter(x => x.at > t);
    for (const x of due) { try { x.fn(); } catch { /* one bot's hiccup can't stop the rest */ } }
  }

  move(b, dt, t, me, pnow) {
    const p = b.peer;
    p.seen = pnow;
    // riding in your car: they go where you go (hidden, your tag says +1)
    if (b.riding) {
      Object.assign(p, { x: me.x, z: me.z, h: me.h, sp: me.speed || 0, inCar: false, ride: online.id });
      if (!me.inCar) this.getOutOfYours(b, me);
      else if (Math.abs(me.speed || 0) < 1 && t > b.riding.until) this.getOutOfYours(b, me);
      return;
    }
    let at;
    if (b.hold) {
      at = { x: b.hold.x, z: b.hold.z, h: b.hold.h, v: 0, inCar: b.hold.inCar };
      // you climbed in: off they go
      if (b.carrying && online.ride === b.id && !b.hold.boarded) { b.hold.boarded = true; b.hold.until = Math.min(b.hold.until, t + 2.5); }
      if (t >= b.hold.until) { b.hold = null; this.goLocal(b, t, me); }
    } else if (b.local) {
      at = planAt(b.local.plan, t - b.local.t0, b.local.i);
      b.local.i = at?.i || 0;
      // back on their usual route once you can't see the jump
      if (!b.carrying && at) {
        const sched = planAt(b.plan, t - b.s.start, b.i);
        const far = d => Math.hypot(d.x - me.x, d.z - me.z) > SNAP_AWAY;
        if (sched && far(at) && far(sched)) { b.local = null; at = sched; b.place = true; }
      }
      if (b.local && t - b.local.t0 > b.local.dur - 5) this.goLocal(b, t, me);
    } else {
      at = planAt(b.plan, t - b.s.start, b.i);
      if (at) b.i = at.i;
    }
    if (!at) return;
    if (b.place) { p.x = at.x; p.z = at.z; p.h = at.h; b.place = false; }
    const err = Math.hypot(at.x - p.x, at.z - p.z);
    if (err > 30) { p.x = at.x; p.z = at.z; p.h = at.h; }
    else { const k = Math.min(1, dt * 9); p.x += (at.x - p.x) * k; p.z += (at.z - p.z) * k; }
    let dh = at.h - p.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    p.h += dh * Math.min(1, dt * (at.inCar ? 6 : 10));
    p.sp = at.v; p.inCar = at.inCar && !p.dead;
    if (!p.inCar && at.v > 0.1) p.walk += dt * 9;
    p.ride = '';
  }

  // Off their usual route (after a race call, a ride, a fight): drive on from here.
  goLocal(b, t, me) {
    const p = b.peer, bm = botMap(this.roads);
    const dur = 600;
    const plan = makePlan(bm, (Math.random() * 4294967296) >>> 0, b.p, dur, { x: p.x, z: p.z, h: p.h, v: p.inCar ? p.sp : 0 }, this.isNight(t));
    b.local = { plan, t0: t, i: 0, dur };
  }
  holdHere(b, secs) {
    const p = b.peer;
    b.hold = { x: p.x, z: p.z, h: p.h, inCar: p.inCar, until: this.clock() + secs };
    b.local = null;
  }
  // You want out of their car: they pull over.
  pullOver(id) {
    const b = this.list.get(id);
    if (!b || b.hold) return;
    this.holdHere(b, 8);
  }

  // ---- chat
  say(b, line, ctx = {}) {
    if (!online.active || !this.list.has(b.id)) return;
    const r = Math.random;
    const text = fill(line, { me: online.name, mycar: this.myCar(), ...ctx }, r);
    online.addChat(b.peer.name, text);
  }
  myCar() { return shortCar(online.me?.modelId && this.world?.vehicle?.model) || 'car'; }

  // Lines they say on their own: the same on every phone on this server.
  ambient(t) {
    const k = Math.floor(t / CHAT_EVERY);
    if (k === this.bucket) return;
    this.bucket = k;
    if (t - this.joinedAt < 8) return;
    const bots = [...this.list.values()].filter(b => !b.peer.dead).sort((a, b) => a.s.slot - b.s.slot);
    if (!bots.length) return;
    const r = rng(hash('chat', online.room, k));
    if (r() > Math.min(0.5, 0.12 + bots.length * 0.035)) return;
    const night = this.isNight(t), hour = hourCT(t);
    const pool = [...T.AMBIENT, ...(night ? T.NIGHT : []), ...(hour >= 7 && hour < 17 ? T.DAY : [])];
    const A = pick(r, bots), others = bots.filter(b => b !== A), B = others.length ? pick(r, others) : null;
    let line = pick(r, pool);
    if (Array.isArray(line) && !B) line = pick(r, T.AMBIENT.filter(x => typeof x === 'string'));
    // the "{me}" lines are about you: only when it's you they'd be talking to
    if (typeof line === 'string' && line.includes('{me}') && (r() < 0.5 || !this.world)) line = pick(r, T.AMBIENT.filter(x => typeof x === 'string' && !x.includes('{me}')));
    const any = bots[Math.floor(r() * bots.length)];
    const ctx = { other: B?.peer.name, car: shortCar(any.p.model), acar: shortCar(A.p.model), bcar: B ? shortCar(B.p.model) : '' };
    const lr = rng(hash('fill', online.room, k));
    if (typeof line === 'string') { online.addChat(A.peer.name, fill(line, { me: online.name, mycar: this.myCar(), ...ctx }, lr)); return; }
    let delay = 0;
    for (const [who, text] of line) {
      const sp = who === 'A' ? A : B;
      const out = fill(text, { me: online.name, ...ctx, other: B.peer.name }, lr);
      if (!delay) online.addChat(sp.peer.name, out);
      else this.later(delay, () => { if (this.list.has(sp.id)) online.addChat(sp.peer.name, out); });
      delay += 3 + text.length * 0.12 + r() * 4;
    }
  }

  // You said something in chat.
  heard(text) {
    if (!this.list.size) return;
    const bots = [...this.list.values()].filter(b => !b.peer.dead);
    if (!bots.length) return;
    const lower = text.toLowerCase();
    const named = bots.find(b => lower.includes(b.p.name.toLowerCase()) || lower.includes(b.p.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5)));
    const rule = T.REPLY.find(x => x.re.test(text));
    const r = Math.random;
    const who = named || bots[Math.floor(r() * bots.length)];
    const typing = line => 1.5 + line.length * 0.15 + r() * 3;
    if (named && !rule) { const l = pick(r, T.NAMED); this.later(typing(l), () => this.say(who, l)); return; }
    if (!rule) { if (r() < 0.3) { const l = pick(r, T.FILLER); this.later(typing(l), () => this.say(who, l)); } return; }
    const l = pick(r, rule.lines);
    this.later(typing(l), () => this.say(who, l));
    // a greeting gets a second "yo" now and then
    if (rule === T.REPLY[0] && bots.length > 1 && r() < 0.5) { const o = bots.find(b => b !== who); const l2 = pick(r, rule.lines); this.later(typing(l2) + 2, () => this.say(o, l2)); }
    // "race me": somebody actually calls you out
    if (rule.race && r() < 0.65) {
      const racer = named || this.nearestCar() || who;
      this.later(typing(l) + 3 + r() * 5, () => this.invite(racer));
    }
  }

  nearestCar() {
    const me = this.world?.playerState?.();
    if (!me) return null;
    let best = null, bd = Infinity;
    for (const b of this.list.values()) { if (!b.peer.inCar || b.peer.dead) continue; const d = Math.hypot(b.peer.x - me.x, b.peer.z - me.z); if (d < bd) { bd = d; best = b; } }
    return best;
  }

  // ---- things they do to you on their own
  act(dt, me) {
    const w = this.world;
    if (!w) return;
    // greet you a little after you join
    if (!this.greeted && this.clock() - this.joinedAt > 6) {
      this.greeted = true;
      const bots = [...this.list.values()];
      if (bots.length && Math.random() < 0.7) { const b = pick(Math.random, bots); this.later(Math.random() * 6, () => this.say(b, pick(Math.random, Math.random() < 0.5 ? T.GREET_ME : T.JOIN))); }
    }
    // a race call now and then while you're driving
    this.inviteT -= dt;
    if (this.inviteT <= 0) {
      this.inviteT = 240 + Math.random() * 300;
      if (me.inCar && !w.paused) {
        const near = [...this.list.values()].filter(b => b.peer.inCar && !b.peer.dead && Math.hypot(b.peer.x - me.x, b.peer.z - me.z) < 400);
        const pool = near.length ? near : [...this.list.values()].filter(b => b.peer.inCar && Math.random() < 0.4);
        if (pool.length) this.invite(pick(Math.random, pool));
      }
    }
    // somebody standing at a meet asks you for a ride when you roll up slow
    this.rideT = (this.rideT ?? 60) - dt;
    if (this.rideT <= 0) {
      this.rideT = 45;
      if (me.inCar && Math.abs(me.speed || 0) < 2) {
        const b = [...this.list.values()].find(b => !b.peer.inCar && !b.peer.dead && !b.asked && Math.hypot(b.peer.x - me.x, b.peer.z - me.z) < 14);
        if (b && Math.random() < 0.35) { b.asked = true; this.askRide(b); }
      }
    }
  }

  invite(b) {
    if (!b || !this.list.has(b.id) || !online.active) return;
    const r = Math.random;
    const type = r() < 0.55 ? 'roll' : 'drag';
    const wagers = [0, 0, 0, 500, 500, 1000, 1000, 5000, 10000].filter(v => v <= b.p.bank);
    online.receive({ k: 'pv', t: 'ask', to: online.id, rid: 'b' + Math.random().toString(36).slice(2, 9), id: b.id,
      ty: type, di: type === 'drag' ? pick(r, ['eighth', 'quarter']) : pick(r, ['quarter', 'half']), ro: pick(r, [30, 40, 60]), wa: pick(r, wagers) }, true);
  }
  askRide(b) {
    b.wantsRide = true;
    online.receive({ k: 'rq', t: 'ask', to: online.id, rid: 'b' + Math.random().toString(36).slice(2, 9), id: b.id }, true);
  }

  // ---- what you send them (caught before it goes out)
  hook(m) {
    if (!m || !this.list.has(m.to)) {
      if (m?.k === 'c' && typeof m.x === 'string') this.heard(m.x);
      if (m?.k === 'ho') this.honked();
      if (m?.k === 'pvp' && m.t === 'dead') this.youDied();
      return false;
    }
    const b = this.list.get(m.to), r = Math.random;
    const reply = (msg, secs) => this.later(secs, () => { if (this.list.has(b.id) && online.active) online.receive({ ...msg, to: online.id, id: b.id }, true); });
    if (m.k === 'pv' && m.t === 'ask') {
      const cfg = { wa: m.wa || 0 };
      const yes = !b.peer.dead && b.peer.inCar && cfg.wa <= b.p.bank && r() < b.p.racer + (cfg.wa ? 0 : 0.15);
      reply({ k: 'pv', t: !b.peer.inCar && r() < 0.5 ? 'busy' : yes ? 'yes' : 'no', rid: m.rid }, 2 + r() * 6);
      if (!yes && r() < 0.4) this.later(4 + r() * 4, () => this.say(b, pick(r, ['nah not rn', 'later', 'cant rn', 'my car in the shop fr', 'next time'])));
    } else if (m.k === 'pv' && (m.t === 'yes' || m.t === 'no')) {
      if (m.t === 'no' && r() < 0.3) this.later(3, () => this.say(b, pick(r, ['scared 😂', 'aight', 'bet another time'])));
    } else if (m.k === 'rq') this.rideMsg(b, m, reply);
    else if (m.k === 'pvp' && m.t === 'hit') this.hit(b, m);
    return true;
  }

  rideMsg(b, m, reply) {
    const r = Math.random, p = b.peer;
    if (m.t === 'ask') {
      // you want to ride in their car: they stop for you first
      if (!p.inCar || b.carrying) { reply({ k: 'rq', t: b.carrying ? 'full' : 'no', rid: m.rid }, 2); return; }
      this.holdHere(b, 30);
      const yes = r() < b.p.rides;
      reply({ k: 'rq', t: yes ? 'yes' : 'no', rid: m.rid }, 1.5 + r() * 2.5);
      if (yes) b.carrying = true;
      else this.later(5, () => { if (b.hold) b.hold.until = this.clock(); });
    } else if (m.t === 'offer') {
      // you offered them a ride: they hop in
      if (p.inCar) { reply({ k: 'rq', t: 'no', rid: m.rid }, 2); return; }
      const yes = r() < 0.75;
      reply({ k: 'rq', t: yes ? 'yes' : 'no', rid: m.rid }, 1.5 + r() * 2);
      if (yes) this.later(1.5 + 2 + 0.1, () => { b.riding = { until: this.clock() + 60 + r() * 180 }; b.local = null; b.hold = null; online.emit('peers'); });
    } else if (m.t === 'yes' && b.wantsRide) {
      b.wantsRide = false; b.riding = { until: this.clock() + 60 + r() * 180 }; b.local = null; b.hold = null; online.emit('peers');
    } else if (m.t === 'drop') {
      if (b.riding) this.getOutOfYours(b, this.world?.playerState?.() || p, false);
    } else if (m.t === 'out') {
      // you got out of their car
      b.carrying = false;
      if (b.hold) b.hold.until = Math.min(b.hold.until, this.clock() + 3);
    } else if (m.t === 'cancel') {
      if (b.hold) b.hold.until = this.clock();
    }
  }
  // When they asked you for a ride and you said yes, the answer comes back here.
  getOutOfYours(b, me, told = true) {
    if (!b.riding) return;
    const p = b.peer;
    b.riding = null;
    p.ride = ''; p.inCar = false;
    p.x = me.x + Math.cos(me.h) * 2.2; p.z = me.z + Math.sin(me.h) * 2.2; p.h = me.h;
    if (told) online.receive({ k: 'rq', t: 'out', to: online.id, rid: 'out', id: b.id }, true);
    this.later(1.5, () => this.say(b, pick(Math.random, T.RIDE_THANKS)));
    // they walk off, then get picked back up on their route out of sight
    const away = { x: p.x + Math.cos(me.h) * 200, z: p.z + Math.sin(me.h) * 200 };
    b.hold = null;
    const plan = []; const len = Math.hypot(away.x - p.x, away.z - p.z), dx = (away.x - p.x) / len, dz = (away.z - p.z) / len;
    plan.push({ stop: true, foot: true, t0: 0, t1: 6, x: p.x, z: p.z, h: me.h });
    plan.push({ t0: 6, t1: 6 + len / 1.6, x: p.x, z: p.z, dx, dz, len, v0: 1.6, v1: 1.6, h: heading(dx, dz), walk: true });
    b.local = { plan, t0: this.clock(), i: 0, dur: 6 + len / 1.6 + 30 };
    online.emit('peers');
  }

  hit(b, m) {
    const p = b.peer;
    if (p.dead || p.inCar) return;
    p.hp -= Math.max(1, Math.min(100, Number(m.d) || 1));
    const r = Math.random;
    if (p.hp <= 0) {
      p.hp = 0; p.dead = true; this.holdHere(b, 9); b.hold.inCar = false;
      online.receive({ k: 'pvp', t: 'dead', target: b.id, to: '*', id: b.id }, true);
      this.later(2 + r() * 3, () => this.say(b, pick(r, T.KILLED)));
      this.later(8, () => { if (!this.list.has(b.id)) return; p.dead = false; p.hp = 100; online.receive({ k: 'pvp', t: 'alive', target: b.id, to: '*', id: b.id }, true); });
      return;
    }
    if (!b.mad) {
      b.mad = true;
      this.later(1 + r() * 2, () => this.say(b, pick(r, T.SHOT)));
      this.later(20, () => { b.mad = false; });
      // some shoot back
      if (b.p.temper > 0.65) {
        for (let i = 0; i < 4 + Math.floor(r() * 4); i++) this.later(0.8 + i * (0.5 + r() * 0.4), () => {
          const me = this.world?.playerState?.();
          if (!me || p.dead || me.inCar || Math.hypot(p.x - me.x, p.z - me.z) > 28) return;
          online.receive({ k: 'pvp', t: 'hit', to: online.id, d: 6 + Math.floor(r() * 6), w: 'gun', x: p.x, z: p.z, h: p.h, id: b.id }, true);
        });
      } else this.holdHere(b, 0.1);   // the rest just leave
    }
  }

  honked() {
    const me = this.world?.playerState?.();
    if (!me || this.honkT > this.clock()) return;
    this.honkT = this.clock() + 4;
    const b = [...this.list.values()].find(b => b.peer.inCar && Math.hypot(b.peer.x - me.x, b.peer.z - me.z) < 60);
    if (b && Math.random() < 0.6) this.later(0.6 + Math.random(), () => online.receive({ k: 'ho', id: b.id }, true));
  }
  youDied() {
    const me = this.world?.playerState?.();
    const b = me && [...this.list.values()].find(b => Math.hypot(b.peer.x - me.x, b.peer.z - me.z) < 120);
    if (b && Math.random() < 0.5) this.later(2 + Math.random() * 3, () => this.say(b, pick(Math.random, T.YOU_DIED)));
  }

  // After a race against one of them (ui/pvp.js).
  raced(id, youWon) {
    const b = this.list.get(id);
    if (!b) return;
    if (Math.random() < 0.8) this.later(2 + Math.random() * 3, () => this.say(b, pick(Math.random, youWon ? T.RACE_LOST : T.RACE_WON)));
    this.goLocal(b, this.clock(), this.world?.playerState?.() || b.peer);
  }

  // For the server list: how many to add on top of the real players.
  shownOn(server, reals) { return this.enabled ? botsOn(server, this.clock(), reals || 0).length : 0; }
}

export const bots = new Bots();
export { SERVERS };
