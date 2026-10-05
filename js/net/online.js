// Online free roam: other players share the Fort Worth map with you live.
//
// Transport is Supabase Realtime *broadcast* only — no tables, no accounts, no
// stored data, nothing persisted anywhere. Everyone in the same room code sees
// everyone else's car; there is no server-side logic. Because the clients just
// trust each other, everything that comes in is sanitised before it is used
// (names, car ids, colours, numbers), and nobody can touch anyone else's save.
//
// A second transport (same-browser BroadcastChannel) exists so it can be
// tested offline and works across two tabs of the same browser.

import { CAR_BY_ID } from '../data/cars.js';
import { defaultVisual, PERF } from '../data/parts.js';

export const SUPABASE_URL = 'https://fikdilgfjponqygiwofa.supabase.co';
// Publishable (public-by-design) key. Only used for realtime broadcast.
export const SUPABASE_KEY = 'sb_publishable_X7bhi2RvfjUxUt8cK_c88w_gTw1hB8x';
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Named game servers, like a real server browser. Each is its own realtime
// channel with a player cap, so the world never gets crowded. Player counts
// come from realtime presence. The cap is enforced by the clients themselves: a
// full server turns you away. Each career also has one home server, which
// holds SERVER_CAP careers, and houses are deeded per server (net/deeds.js).
export const SERVER_CAP = 15;
export const SERVERS = [
  { id: 'harbor',    name: 'Lake Worth',    blurb: 'Lakefront docks and warehouses, never sleeps' },
  { id: 'downtown',  name: 'Downtown',  blurb: 'Lights, traffic, and a lot of cops' },
  { id: 'eastgate',  name: 'Eastgate',  blurb: 'Where everyone starts out' },
  { id: 'ironside',  name: 'Riverside',  blurb: 'Industrial roads, long straights' },
  { id: 'dustline',  name: 'Dustline',  blurb: 'Desert highway and open sand' },
  { id: 'northridge',name: 'Cross Timbers', blurb: 'Mountain roads' },
  { id: 'pier9',     name: 'Pier 9',    blurb: 'Meet-night crowd' },
  { id: 'glory',     name: 'Glory Row', blurb: 'The big leagues' },
];
export const SERVER_BY_ID = Object.fromEntries(SERVERS.map(sv => [sv.id, sv]));
export const DEFAULT_ROOM = SERVERS[2].id;
// Sync: everyone runs the same prediction for your car (position + speed +
// heading + how fast you're turning and speeding up). You only send an update
// when the real car drifts from that prediction, so a car going straight
// costs a couple of messages a second and a car carving through traffic gets
// up to MAX_HZ. That keeps cars tight on screen while staying inside the
// realtime message budget with a full server.
const MAX_HZ = 15;           // fastest we ever send
const KEEPALIVE = 0.5;       // send at least this often while moving (s)
const IDLE_EVERY = 2;        // … while parked
const ERR_POS = 0.5;         // metres of prediction error before we send
const ERR_HEAD = 0.05;       // radians
const ERR_SPD = 1.2;         // m/s
const HELLO_EVERY = 6;       // seconds between car-appearance refreshes
const PEER_TIMEOUT = 7;      // seconds of silence before a peer disappears
const MAX_PEERS = 24;

const num = (v, lo, hi, d = 0) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const cleanName = (s, d = 'Racer') => (String(s ?? '').replace(/[^\w .'\-]/g, '').trim().slice(0, 16) || d);
const cleanRoom = s => (SERVER_BY_ID[String(s ?? '').toLowerCase()] ? String(s).toLowerCase() : DEFAULT_ROOM);
const cleanText = s => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 90);
const SAFE_VAL = /^[#\w .\-]{1,24}$/;
const PERF_IDS = PERF.map(p => p.id);

export function cleanVisual(model, v) {
  const out = defaultVisual(model);
  if (v && typeof v === 'object') {
    for (const k of Object.keys(out)) {
      const x = v[k];
      if (typeof x === 'string' && SAFE_VAL.test(x)) out[k] = x;
    }
    out.plate = String(v.plate ?? '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, 8) || out.plate;
  }
  return out;
}
export function cleanLevels(lv) {
  const out = {};
  for (const id of PERF_IDS) out[id] = Math.round(num(lv?.[id], 0, 4, 0));
  return out;
}

const norm = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// Where a car will be `age` seconds after a state sample: holds its turn rate
// and acceleration (capped so a lost packet doesn't send it into orbit).
export function predict(st, age) {
  age = Math.min(0.8, Math.max(0, age));
  const r = st.r || 0, a = st.a || 0;
  const v = st.v + a * age;
  const vm = (st.v + v) / 2, hm = st.h + r * age / 2;
  return { x: st.x + Math.sin(hm) * vm * age, z: st.z - Math.cos(hm) * vm * age, h: st.h + r * age, v };
}

export class LocalTransport {
  constructor(room, onMsg, id, onPresence) {
    this.room = room; this.id = id; this.onPresence = onPresence;
    this.ch = new BroadcastChannel('rfg:' + room);
    this.ch.onmessage = e => { const m = e.data; if (m && m.k === '_p') this.gotPresence(m); else onMsg(m); };
    this.census = new BroadcastChannel('rfg-census');
    this.seenP = new Map(); this.meta = null;
  }
  // Presence is only emulated when a meta object is given (the crew lobby); game servers don't use it here.
  async open(name, meta) {
    this.beat(); this.timer = setInterval(() => this.beat(), 1000);
    if (meta !== undefined) {
      this.meta = meta; this.joined = Date.now();
      this.pbeat(); this.ptimer = setInterval(() => { this.pbeat(); this.sweep(); }, 800);
    }
    return true;
  }
  update(meta) { this.meta = meta; this.pbeat(); }
  pbeat() { try { this.ch.postMessage({ k: '_p', id: this.id, t: this.joined, meta: this.meta }); } catch { /* closed */ } this.emitP(); }
  gotPresence(m) {
    if (m.bye) this.seenP.delete(m.id); else this.seenP.set(m.id, { t: m.t, meta: m.meta, last: Date.now() });
    this.emitP();
  }
  sweep() { const now = Date.now(); for (const [id, v] of this.seenP) if (now - v.last > 2600) this.seenP.delete(id); this.emitP(); }
  emitP() {
    if (!this.onPresence || this.meta === null) return;
    const list = [{ id: this.id, t: this.joined, meta: this.meta }, ...[...this.seenP].map(([id, v]) => ({ id, t: v.t, meta: v.meta }))];
    const sig = JSON.stringify(list.map(x => [x.id, x.meta]));
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.onPresence(list.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)));
  }
  beat() { try { this.census.postMessage({ srv: this.room, id: this.id }); } catch { /* closed */ } }
  send(msg) { this.ch.postMessage(msg); }
  close() { clearInterval(this.timer); clearInterval(this.ptimer); try { this.ch.postMessage({ k: '_p', id: this.id, bye: true }); } catch { /* closed */ } this.ch.close(); this.census.close(); }
  // How many are on each server? Listen for the heartbeats for a moment.
  static async count(servers) {
    const seen = Object.fromEntries(servers.map(sv => [sv.id, new Set()]));
    const ch = new BroadcastChannel('rfg-census');
    ch.onmessage = e => { const m = e.data; if (m && seen[m.srv]) seen[m.srv].add(m.id); };
    await new Promise(r => setTimeout(r, 1400));
    ch.close();
    return Object.fromEntries(servers.map(sv => [sv.id, seen[sv.id].size]));
  }
}

async function supabaseClient() {
  const { createClient } = await import(/* @vite-ignore */ SUPABASE_JS);
  return createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { params: { eventsPerSecond: 20 } }, auth: { persistSession: false, autoRefreshToken: false } });
}
const presenceCount = ch => Object.keys(ch.presenceState()).length;

export class SupabaseTransport {
  constructor(room, onMsg, id, onPresence) { this.room = room; this.onMsg = onMsg; this.id = id; this.onPresence = onPresence; this.ch = null; this.client = null; }
  async open(name, meta) {
    this.name = name; this.t0 = Date.now();
    this.client = await supabaseClient();
    this.ch = this.client.channel('rfg:srv:' + this.room, { config: { broadcast: { self: false, ack: false }, presence: { key: this.id } } });
    this.ch.on('broadcast', { event: 'm' }, ({ payload }) => this.onMsg(payload));
    // presence = who is on this server right now (also tells us when someone drops)
    this.ch.on('presence', { event: 'sync' }, () => this.onPresence?.(Object.entries(this.ch.presenceState()).map(([id, metas]) => ({ id, t: metas?.[0]?.t || 0, meta: metas?.[metas.length - 1]?.m })).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1))));
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('Timed out connecting to the server')), 12000);
      this.ch.subscribe(async st => {
        if (st === 'SUBSCRIBED') { try { await this.ch.track({ n: name, t: this.t0, m: meta }); } catch { /* presence is best-effort */ } clearTimeout(to); res(); }
        else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') { clearTimeout(to); rej(new Error('Could not connect to the server')); }
      });
    });
    return true;
  }
  update(meta) { try { this.ch?.track({ n: this.name, t: this.t0, m: meta }); } catch { /* best effort */ } }
  send(msg) { this.ch?.send({ type: 'broadcast', event: 'm', payload: msg }); }
  close() { try { this.ch?.untrack?.(); this.client?.removeChannel(this.ch); this.client?.realtime?.disconnect(); } catch { /* already closed */ } }
  // Player counts for every server: listen to each channel's presence without joining it.
  static async count(servers) {
    const client = await supabaseClient();
    const out = {};
    await Promise.all(servers.map(sv => new Promise(res => {
      const ch = client.channel('rfg:srv:' + sv.id, { config: { presence: { key: 'peek-' + Math.random().toString(36).slice(2, 8) } } });
      const done = n => { out[sv.id] = n; try { client.removeChannel(ch); } catch { /* ignore */ } res(); };
      const to = setTimeout(() => done(null), 6000);
      ch.on('presence', { event: 'sync' }, () => { clearTimeout(to); done(presenceCount(ch)); });
      ch.subscribe(st => { if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(to); done(null); } });
    })));
    try { client.realtime?.disconnect(); } catch { /* ignore */ }
    return out;
  }
}

class Online {
  constructor() {
    this.status = 'off';          // off | connecting | on | error
    this.error = '';
    this.room = DEFAULT_ROOM;     // server id
    this.presence = null;         // ids currently on the server (null until known)
    this.id = '';
    this.name = '';
    this.peers = new Map();
    this.chat = [];
    this.listeners = new Set();
    this.sendT = 0; this.helloT = 0; this.helloReplyT = 0;
    this.sent = null;             // the state everyone else is predicting from
    this.seq = 0;
    this.prev = null;             // last frame, for turn rate and acceleration
    this.me = null;
    this.ride = '';               // id of the driver whose car you're riding in (net/ride.js)
    this.transportKind = 'supabase';
  }

  get active() { return this.status === 'on'; }
  get serverName() { return SERVER_BY_ID[this.room]?.name || this.room; }
  get kind() { return this.kindOverride || (new URLSearchParams(location.search).get('net') === 'local' ? 'local' : 'supabase'); }   // 'local' = same-browser testing

  // Players on every server (null = couldn't tell).
  async census(kind) {
    const T = (kind || this.kind) === 'local' ? LocalTransport : SupabaseTransport;
    try { return await T.count(SERVERS); } catch { return Object.fromEntries(SERVERS.map(sv => [sv.id, null])); }
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev, data) { this.listeners.forEach(f => { try { f(ev, data); } catch { /* listener bug must not kill the loop */ } }); }

  // me = { name, modelId, visual, levels, tier }
  async join(room, me, kind) {
    if (this.status === 'connecting' || this.status === 'on') this.leave();
    this.room = cleanRoom(room);
    this.me = me;
    this.name = cleanName(me.name);
    this.id = Math.random().toString(36).slice(2, 10);
    this.peers.clear(); this.chat = []; this.sent = null; this.prev = null; this.seq = 0; this.ride = '';
    this.status = 'connecting'; this.error = '';
    this.transportKind = kind || this.kind;
    this.presence = null;
    this.emit('status');
    try {
      const T = this.transportKind === 'local' ? LocalTransport : SupabaseTransport;
      this.tr = new T(this.room, m => this.receive(m), this.id, list => this.onPresence(list));
      await this.tr.open(this.name);
      if (this.status === 'error') return false;   // turned away while connecting (server full)
      // full? (the cap is enforced by the clients: we turn ourselves away)
    } catch (e) {
      this.status = 'error'; this.error = e.message || 'Could not connect';
      try { this.tr?.close(); } catch { /* ignore */ }
      this.tr = null;
      this.emit('status');
      return false;
    }
    this.status = 'on';
    this.sendHello();
    this.emit('status');
    return true;
  }

  // Presence is ordered by join time: whoever is past the cap is the one turned away.
  onPresence(list) {
    this.presence = list.map(x => x.id);
    if (list.findIndex(x => x.id === this.id) >= SERVER_CAP) {
      this.error = `${this.serverName} is full (${SERVER_CAP}/${SERVER_CAP})`;
      this.leave(); this.status = 'error'; this.emit('status');
      return;
    }
    this.pruneToPresence(); this.emit('peers');
  }

  // Presence tells us right away when someone leaves or drops.
  pruneToPresence() {
    if (!this.presence) return;
    const here = new Set(this.presence);
    for (const id of [...this.peers.keys()]) if (!here.has(id)) this.peers.delete(id);
  }

  leave() {
    if (this.tr) { try { this.send({ k: 'bye' }); this.tr.close(); } catch { /* ignore */ } }
    this.tr = null;
    this.status = 'off'; this.peers.clear();
    this.emit('status');
  }

  setMe(me) { this.me = me; if (this.active) this.sendHello(); }

  send(msg) {
    if (!this.active || !this.tr) return;
    try { this.tr.send({ ...msg, id: this.id }); } catch { /* dropped packet */ }
  }

  sendHello() {
    const me = this.me;
    if (!me) return;
    this.send({ k: 'h', n: this.name, m: me.modelId, v: me.visual, l: me.levels, t: me.tier, cr: me.crew ? { t: me.crew.tag, c: me.crew.color } : undefined });
  }

  say(text) {
    const t = cleanText(text);
    if (!t) return;
    this.send({ k: 'c', n: this.name, x: t });
    this.addChat(this.name, t, true);
  }
  honk() { this.send({ k: 'ho' }); }

  addChat(name, text, mine = false) {
    this.chat.push({ name, text, mine, t: Date.now() });
    if (this.chat.length > 60) this.chat.shift();
    this.emit('chat', { name, text, mine });
  }

  // ---------------------------------------------------------------- incoming
  receive(m) {
    if (!m || typeof m !== 'object' || typeof m.id !== 'string' || m.id === this.id || m.id.length > 16) return;
    const now = performance.now() / 1000;
    let p = this.peers.get(m.id);
    if (m.k === 'bye') { if (p) { this.peers.delete(m.id); this.emit('peers'); } return; }
    if (!p) {
      if (this.peers.size >= MAX_PEERS) return;
      p = { id: m.id, name: 'Racer', model: null, visual: null, levels: cleanLevels(), tier: 1, x: 0, z: 0, h: 0, sp: 0, inCar: true, flame: 0, walk: 0, seen: now, t: now, fresh: true, sprite: null, spriteKey: '' };
      this.peers.set(m.id, p);
      // we don't know this car yet: introduce ourselves so they can draw us too
      if (now - this.helloReplyT > 1) { this.helloReplyT = now; this.sendHello(); }
    }
    p.seen = now;
    if (m.k === 'h') {
      p.name = cleanName(m.n);
      const model = typeof m.m === 'string' && Object.hasOwn(CAR_BY_ID, m.m) ? CAR_BY_ID[m.m] : null;
      if (model) {
        p.model = model; p.visual = cleanVisual(model, m.v); p.levels = cleanLevels(m.l); p.tier = Math.round(num(m.t, 1, 9, 1));
        p.spriteKey = '';
      }
      const cr = m.cr && typeof m.cr === 'object' ? m.cr : null;
      p.crew = cr && /^[A-Z0-9]{2,4}$/.test(String(cr.t)) && /^#[0-9a-fA-F]{6}$/.test(String(cr.c)) ? { tag: cr.t, color: cr.c } : null;
      this.emit('peers');
    } else if (m.k === 's') {
      // out-of-order packets are dropped
      const q = num(m.q, 0, 1e9, 0);
      if (q && p.q && q <= p.q && p.q - q < 1e6) return;
      p.q = q;
      const x = num(m.x, -9000, 9000), z = num(m.z, -9000, 9000);
      p.st = { x, z, h: num(m.h, -20, 20), v: num(m.v, -80, 120), r: num(m.r, -4, 4), a: num(m.a, -30, 30) };
      p.sp = p.st.v; p.inCar = !!m.c; p.sflame = num(m.f, 0, 2); p.t = now;
      p.ride = typeof m.rd === 'string' && m.rd.length <= 16 ? m.rd : '';
      // gear and revs: only sent while they have passengers, for the passenger's dash
      p.gear = typeof m.g === 'string' && /^[RDN–1-9]$/.test(m.g) ? m.g : ''; p.rpm = num(m.rp, 0, 1.2, 0);
      if (p.fresh) { p.x = x; p.z = z; p.h = p.st.h; p.fresh = false; }
    } else if (m.k === 'c') {
      this.addChat(cleanName(m.n, p.name), cleanText(m.x));
    } else if (m.k === 'ho') {
      p.honkAt = now; this.emit('honk', p);
    } else if (m.k === 'deed') {
      this.emit('deed', m);
    } else if (m.k === 'pv') {
      // head-to-head race invites (net/pvp.js); only the one it's for reads it
      if (m.to === this.id) this.emit('pvp', { ...m, from: m.id, peer: p });
    } else if (m.k === 'rq') {
      // ride-along requests (net/ride.js)
      if (m.to === this.id) this.emit('ride', { ...m, from: m.id, peer: p });
    }
  }

  // ---------------------------------------------------------------- per frame
  // me = { x, z, h, speed, inCar, flame }
  // While you ride in someone's car, everyone hides you and the driver's car
  // carries you, so only a slow keepalive goes out.
  tick(dt, me) {
    if (!this.active) return;
    const now = performance.now() / 1000;
    this.sendT -= dt; this.helloT -= dt;
    // turn rate and acceleration from the last frame, smoothed
    const pv = this.prev;
    let r = 0, a = 0;
    if (pv && dt > 0) {
      r = pv.r + (norm(me.h - pv.h) / dt - pv.r) * Math.min(1, dt * 8);
      a = pv.a + ((me.speed - pv.v) / dt - pv.a) * Math.min(1, dt * 6);
    }
    this.prev = { h: me.h, v: me.speed, r, a };
    const moving = Math.abs(me.speed) > 0.3 || me.flame > 0.04 || !me.inCar;
    if (this.sendT <= 0) {
      const sent = this.sent;
      let need = !sent || sent.c !== (me.inCar ? 1 : 0) || Math.abs((sent.f || 0) - me.flame) > 0.3 || (sent.rd || '') !== this.ride;
      const since = sent ? now - sent.t : 99;
      if (!need && this.ride) need = since >= IDLE_EVERY;
      else if (!need) {
        if (since >= (moving ? KEEPALIVE : IDLE_EVERY)) need = true;
        else {
          const g = predict(sent, since);
          need = Math.hypot(g.x - me.x, g.z - me.z) > ERR_POS || Math.abs(norm(g.h - me.h)) > ERR_HEAD || Math.abs(g.v - me.speed) > ERR_SPD;
        }
      }
      if (need) {
        this.sendT = 1 / MAX_HZ;
        const msg = { k: 's', q: ++this.seq, x: +me.x.toFixed(2), z: +me.z.toFixed(2), h: +me.h.toFixed(3), v: +me.speed.toFixed(2), r: moving ? +r.toFixed(3) : 0, a: moving ? +a.toFixed(2) : 0, c: me.inCar ? 1 : 0, f: +me.flame.toFixed(1) };
        if (this.ride) { msg.rd = this.ride; msg.v = msg.r = msg.a = 0; }
        if (me.dash) { msg.g = me.dash.gear; msg.rp = +Math.min(1.2, me.dash.rpm).toFixed(2); }
        this.sent = { ...msg, t: now };
        this.send(msg);
      }
    }
    if (this.helloT <= 0) { this.helloT = HELLO_EVERY; this.sendHello(); }
    let gone = false;
    for (const p of this.peers.values()) {
      if (now - p.seen > PEER_TIMEOUT) { this.peers.delete(p.id); gone = true; continue; }
      if (p.fresh || !p.st) continue;
      // the same prediction they're sending against, then ease out any jump
      const g = predict(p.st, now - p.t);
      const k = Math.min(1, dt * 12);
      const dx = g.x - p.x, dz = g.z - p.z;
      if (Math.hypot(dx, dz) > 40) { p.x = g.x; p.z = g.z; }     // teleported / respawned
      else { p.x += dx * k; p.z += dz * k; }
      p.h = p.h + norm(g.h - p.h) * k;
      p.sp = g.v;
      p.flame += ((p.sflame || 0) - p.flame) * Math.min(1, dt * 14);
      if (!p.inCar && Math.abs(p.sp) > 0.1) p.walk += dt * 9;
    }
    if (gone) this.emit('peers');
  }

  list() { return [...this.peers.values()].filter(p => p.model); }
}

export const online = new Online();
