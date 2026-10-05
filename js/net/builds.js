// Your place, as other players see it. Everyone on your home server sees
// what you've built on what you own, the way you see it: the house you
// designed (every room and every piece of furniture), the garage, the fence,
// the cows and horses, the dogs in the yard, and the cars parked in your
// garage bays. Walk into somebody else's garage and their cars are in there.
//
// Two ways it travels:
//  - live, over the server channel, while you're online ({k:'bld'}), sent
//    when something changes and again to anyone who shows up;
//  - saved on your deed (supabase/rfg_builds.sql), so your place still looks
//    like yours to the rest of the server after you log off.
// Everything that comes in is checked before it's used, because the clients
// just trust each other (see net/online.js).
//
// world2d/showcase.js packs your place up and puts everyone else's on the map.

import { online, cleanVisual, cleanLevels } from './online.js';
import { deeds, rpc, me, isDeedable } from './deeds.js';
import { CAR_BY_ID } from '../data/cars.js';
import { LAND, PLAN_BY_ID, FENCE_BY_ID, ANIMAL_BY_ID } from '../data/estate.js';
import { sanitize, check } from '../core/homes.js';

export const MAX_CARS = 25;          // cars shown in one garage (data: MAX_FLOOR_BAYS + the one out front)
const SEND_EVERY = 3;                // seconds between live updates of your place
const SAVE_EVERY = 20;               // … and between saves to your deed
const num = (v, lo, hi, d = 0) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const hex = (v, d = null) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
const cleanName = s => String(s ?? '').replace(/[^\w .'\-]/g, '').trim().slice(0, 16) || 'Racer';

// A build from someone else, made safe to put on the map. null = nothing to show.
export function cleanBuild(prop, b) {
  if (!b || typeof b !== 'object' || !isDeedable(prop)) return null;
  const out = { cars: [] };
  const car = c => {
    const model = c && typeof c.m === 'string' && Object.hasOwn(CAR_BY_ID, c.m) ? CAR_BY_ID[c.m] : null;
    return model ? { m: model.id, v: cleanVisual(model, c.v), l: cleanLevels(c.l), cond: { body: num(c.b, 0, 100, 100), lights: num(c.li, 0, 100, 100), tires: num(c.t, 0, 100, 100) } } : null;
  };
  for (const c of Array.isArray(b.cars) ? b.cars.slice(0, MAX_CARS) : []) out.cars.push(car(c));   // a null keeps the others in their bays
  while (out.cars.length && !out.cars[out.cars.length - 1]) out.cars.pop();
  // the car parked at the place (checked against the garage when it's drawn)
  const pk = b.park && typeof b.park === 'object' ? car(b.park) : null;
  if (pk) out.park = { ...pk, x: num(b.park.x, -9000, 9000), z: num(b.park.z, -9000, 9000), h: num(b.park.h, -20, 20) };
  if (LAND[prop] && b.land && typeof b.land === 'object') {
    const l = b.land, L = { owned: true, plan: null, design: null, fence: null, animals: {}, dogs: [] };
    if (typeof l.plan === 'string' && Object.hasOwn(PLAN_BY_ID, l.plan) && l.design && typeof l.design === 'object' && Array.isArray(l.design.floors)) {
      const raw = { ...l.design, floors: l.design.floors.slice(0, 3), furn: Array.isArray(l.design.furn) ? l.design.furn.slice(0, 3).map(f => (Array.isArray(f) ? f.slice(0, 200) : [])) : [] };
      const d = sanitize(raw);
      if (d && check(d).ok) { d.wall = hex(d.wall, '#d9c9a8'); d.roof = hex(d.roof, '#3a3330'); d.roofStyle = /^[a-z]{1,12}$/.test(d.roofStyle) ? d.roofStyle : 'shingle'; L.plan = l.plan; L.design = d; }
    }
    if (typeof l.fence === 'string' && Object.hasOwn(FENCE_BY_ID, l.fence)) L.fence = l.fence;
    if (l.animals && typeof l.animals === 'object') for (const k of Object.keys(ANIMAL_BY_ID)) { const n = Math.round(num(l.animals[k], 0, 80)); if (n) L.animals[k] = n; }
    for (const d of Array.isArray(l.dogs) ? l.dogs.slice(0, 16) : []) if (d && hex(d.c)) L.dogs.push({ c: hex(d.c), d: hex(d.d), g: num(d.g, 0.3, 1.4, 1) });
    out.land = L;
  }
  return out.cars.length || out.land || out.park ? out : null;
}

// Same, in localStorage, for `?net=local` (two tabs of one browser).
const LKEY = 'rfg-localbuilds';
const local = {
  load() { try { return JSON.parse(localStorage.getItem(LKEY) || '{}') || {}; } catch { return {}; } },
  async get(server) {
    const d = deeds.db.load ? deeds.db.load() : { deeds: {} }, b = this.load();
    return Object.values(d.deeds || {}).filter(x => x.server === server && b[server + ':' + x.prop]).map(x => ({ prop: x.prop, uid: x.uid, name: x.name, build: b[server + ':' + x.prop] }));
  },
  async save(u, server, builds) {
    const b = this.load();
    for (const [p, v] of Object.entries(builds)) { if (v) b[server + ':' + p] = v; else delete b[server + ':' + p]; }
    localStorage.setItem(LKEY, JSON.stringify(b));
  },
};
const remote = {
  get: server => rpc('rfg_builds_get', { p_server: server }).then(r => (Array.isArray(r) ? r : [])),
  save: (u, server, builds) => rpc('rfg_build_save', { p_uid: u.uid, p_tok: u.tok, p_builds: builds }),
};

class Builds {
  constructor() {
    this.server = null;
    this.saved = new Map();     // prop -> { uid, name, b } from the deeds
    this.live = new Map();      // prop -> { uid, name, b } heard over the server channel (newer)
    this.version = 0;           // bumps whenever what's on the map should change
    this.loadedAt = -1e9;
    this.down = false;          // builds table not installed / unreachable
    // what you've sent
    this.mine = {};             // prop -> build
    this.sentKey = {};          // prop -> json last broadcast
    this.savedKey = '';
    this.sendT = 0; this.saveT = 0; this.greetT = 0;
    online.on((ev, d) => {
      if (ev === 'bld') this.gotLive(d);
      else if (ev === 'newpeer') this.greet();
      else if (ev === 'status' && online.active) {
        this.sentKey = {}; this.sendT = 0;
        if (online.room !== this.server) this.load(online.room, true);   // so what they send right away isn't dropped
      }
    });
  }
  get db() { return online.kind === 'local' ? local : remote; }

  // Everyone else's places on `server`, from their deeds.
  async load(server, force = false) {
    if (!server) return;
    if (server !== this.server) { this.server = server; this.saved.clear(); this.live.clear(); this.version++; }
    const now = performance.now();
    if (!force && now - this.loadedAt < 60000) return;
    this.loadedAt = now;
    try {
      const rows = await this.db.get(server);
      if (server !== this.server) return;
      this.down = false;
      this.saved = new Map();
      for (const r of rows) {
        const b = cleanBuild(r.prop, r.build);
        if (b && typeof r.uid === 'string') this.saved.set(r.prop, { uid: r.uid.slice(0, 16), name: cleanName(r.name), b });
      }
      this.version++;
    } catch { this.down = true; }
  }

  // What's on `prop` and whose it is, unless it's yours. { uid, name, b } | null
  at(s, prop) {
    const e = this.live.has(prop) ? this.live.get(prop) : this.saved.get(prop);
    if (!e || !e.b || e.uid === s.uid) return null;
    // a deed changed hands since: the old owner's place is gone
    const o = deeds.server === this.server ? deeds.owners.get(prop) : null;
    if (deeds.server === this.server && deeds.loadedAt && !o && !this.live.has(prop)) return null;
    if (o && o.uid !== e.uid && o.uid !== '?') return null;
    return e;
  }
  // Every other player's place on your server: [[prop, { uid, name, b }]]
  all(s) {
    if (!s.homeServer || s.homeServer !== this.server) return [];
    const props = new Set([...this.saved.keys(), ...this.live.keys()]);
    return [...props].map(p => [p, this.at(s, p)]).filter(([, e]) => e);
  }

  gotLive(m) {
    if (!m || typeof m.p !== 'string' || !isDeedable(m.p) || typeof m.u !== 'string' || online.room !== this.server) return;
    const uid = m.u.slice(0, 16);
    // only the player who holds the deed can say what's on it
    const o = deeds.server === this.server ? deeds.owners.get(m.p) : null;
    if (o && o.uid !== uid && o.uid !== '?') return;
    const b = cleanBuild(m.p, m.b);
    const old = this.live.get(m.p);
    if (!b && !old && !this.saved.has(m.p)) return;
    this.live.set(m.p, { uid, name: cleanName(m.n), b });
    this.version++;
  }

  // ---------------------------------------------------------------- yours
  // Called every couple of seconds with your place ({ prop: build }).
  tick(s, dt, mine) {
    if (!s.homeServer) return;
    if (s.homeServer !== this.server) this.load(s.homeServer, true);
    else if (performance.now() - this.loadedAt > 60000) { this.load(s.homeServer); deeds.load(s.homeServer); }
    this.mine = mine;
    this.sendT -= dt; this.saveT -= dt; this.greetT -= dt;
    if (online.active && online.room === s.homeServer && this.sendT <= 0) {
      this.sendT = SEND_EVERY;
      const props = new Set([...Object.keys(mine), ...Object.keys(this.sentKey)]);
      for (const p of props) {
        const j = JSON.stringify(mine[p] || null);
        if (this.sentKey[p] === j) continue;
        this.sentKey[p] = j;
        online.send({ k: 'bld', u: s.uid, n: me(s).name, p, b: mine[p] || null });
        if (!mine[p]) delete this.sentKey[p];
      }
    }
    if (this.saveT <= 0 && !this.saving) {
      const key = JSON.stringify(mine);
      if (key === this.savedKey) return;
      this.saveT = SAVE_EVERY;
      // what came off your deeds since last time goes as null
      const out = { ...mine };
      for (const p of Object.keys(this.lastSaved || {})) if (!(p in out)) out[p] = null;
      this.saving = true;
      this.db.save(me(s), s.homeServer, out)
        .then(() => { this.savedKey = key; this.lastSaved = mine; this.down = false; })
        .catch(() => { this.down = true; this.saveT = 60; })
        .finally(() => { this.saving = false; });
    }
  }
  // Somebody new on the server: show them your place.
  greet() {
    if (this.greetT > 0) { this.sentKey = {}; return; }
    this.greetT = 2;
    this.sentKey = {}; this.sendT = Math.min(this.sendT, 0.5);
  }
}

export const builds = new Builds();
