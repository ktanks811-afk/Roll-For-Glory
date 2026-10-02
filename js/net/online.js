// Online free roam: other players share the Port Solace map with you live.
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

export const DEFAULT_ROOM = 'PORT-SOLACE';
const SEND_HZ = 6;           // state updates per second while moving
const IDLE_HZ = 1;           // … while standing still
const HELLO_EVERY = 4;       // seconds between car-appearance refreshes
const PEER_TIMEOUT = 7;      // seconds of silence before a peer disappears
const MAX_PEERS = 24;

const num = (v, lo, hi, d = 0) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const cleanName = (s, d = 'Racer') => (String(s ?? '').replace(/[^\w .'\-]/g, '').trim().slice(0, 16) || d);
const cleanRoom = s => (String(s ?? '').toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 20) || DEFAULT_ROOM);
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

class LocalTransport {
  constructor(room, onMsg) { this.ch = new BroadcastChannel('rfg:' + room); this.ch.onmessage = e => onMsg(e.data); }
  async open() { return true; }
  send(msg) { this.ch.postMessage(msg); }
  close() { this.ch.close(); }
}

class SupabaseTransport {
  constructor(room, onMsg) { this.room = room; this.onMsg = onMsg; this.ch = null; this.client = null; }
  async open() {
    const { createClient } = await import(/* @vite-ignore */ SUPABASE_JS);
    this.client = createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { params: { eventsPerSecond: 20 } }, auth: { persistSession: false, autoRefreshToken: false } });
    this.ch = this.client.channel('rfg:' + this.room, { config: { broadcast: { self: false, ack: false } } });
    this.ch.on('broadcast', { event: 'm' }, ({ payload }) => this.onMsg(payload));
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('Timed out connecting to the server')), 12000);
      this.ch.subscribe(st => {
        if (st === 'SUBSCRIBED') { clearTimeout(to); res(); }
        else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') { clearTimeout(to); rej(new Error('Could not connect to the server')); }
      });
    });
    return true;
  }
  send(msg) { this.ch?.send({ type: 'broadcast', event: 'm', payload: msg }); }
  close() { try { this.client?.removeChannel(this.ch); this.client?.realtime?.disconnect(); } catch { /* already closed */ } }
}

class Online {
  constructor() {
    this.status = 'off';          // off | connecting | on | error
    this.error = '';
    this.room = DEFAULT_ROOM;
    this.id = '';
    this.name = '';
    this.peers = new Map();
    this.chat = [];
    this.listeners = new Set();
    this.sendT = 0; this.helloT = 0; this.helloReplyT = 0;
    this.me = null;
    this.transportKind = 'supabase';
  }

  get active() { return this.status === 'on'; }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev, data) { this.listeners.forEach(f => { try { f(ev, data); } catch { /* listener bug must not kill the loop */ } }); }

  // me = { name, modelId, visual, levels, tier }
  async join(room, me, kind) {
    if (this.status === 'connecting' || this.status === 'on') this.leave();
    this.room = cleanRoom(room);
    this.me = me;
    this.name = cleanName(me.name);
    this.id = Math.random().toString(36).slice(2, 10);
    this.peers.clear(); this.chat = [];
    this.status = 'connecting'; this.error = '';
    this.transportKind = kind || (new URLSearchParams(location.search).get('net') === 'local' ? 'local' : 'supabase');
    this.emit('status');
    try {
      const T = this.transportKind === 'local' ? LocalTransport : SupabaseTransport;
      this.tr = new T(this.room, m => this.receive(m));
      await this.tr.open();
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
    this.send({ k: 'h', n: this.name, m: me.modelId, v: me.visual, l: me.levels, t: me.tier });
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
      this.emit('peers');
    } else if (m.k === 's') {
      const x = num(m.x, -5000, 5000), z = num(m.z, -5000, 5000);
      p.sx = x; p.sz = z; p.sh = num(m.h, -20, 20); p.sp = num(m.v, -80, 120); p.inCar = !!m.c; p.sflame = num(m.f, 0, 2); p.t = now;
      if (p.fresh) { p.x = x; p.z = z; p.h = p.sh; p.fresh = false; }
    } else if (m.k === 'c') {
      this.addChat(cleanName(m.n, p.name), cleanText(m.x));
    } else if (m.k === 'ho') {
      p.honkAt = now; this.emit('honk', p);
    }
  }

  // ---------------------------------------------------------------- per frame
  // me = { x, z, h, speed, inCar, flame }
  tick(dt, me) {
    if (!this.active) return;
    const now = performance.now() / 1000;
    this.sendT -= dt; this.helloT -= dt;
    const moving = Math.abs(me.speed) > 0.3 || me.flame > 0.04 || !me.inCar;
    if (this.sendT <= 0) {
      this.sendT = 1 / (moving ? SEND_HZ : IDLE_HZ);
      this.send({ k: 's', x: +me.x.toFixed(1), z: +me.z.toFixed(1), h: +me.h.toFixed(2), v: +me.speed.toFixed(1), c: me.inCar ? 1 : 0, f: +me.flame.toFixed(1) });
    }
    if (this.helloT <= 0) { this.helloT = HELLO_EVERY; this.sendHello(); }
    let gone = false;
    for (const p of this.peers.values()) {
      if (now - p.seen > PEER_TIMEOUT) { this.peers.delete(p.id); gone = true; continue; }
      if (p.fresh) continue;
      // dead-reckon from the last state, then ease toward it
      const age = Math.min(0.5, now - p.t);
      const tx = p.sx + Math.sin(p.sh) * p.sp * age, tz = p.sz - Math.cos(p.sh) * p.sp * age;
      const k = Math.min(1, dt * 9);
      p.x += (tx - p.x) * k; p.z += (tz - p.z) * k;
      p.h = p.h + norm(p.sh - p.h) * k;
      p.flame += ((p.sflame || 0) - p.flame) * Math.min(1, dt * 14);
      if (!p.inCar && p.sp !== 0) p.walk += dt * 9;
    }
    if (gone) this.emit('peers');
  }

  list() { return [...this.peers.values()].filter(p => p.model); }
}

export const online = new Online();
