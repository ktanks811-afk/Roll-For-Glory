// Online profiles, no login. The first time someone opens the game this
// device gets a profile: a short public id and a private key, shown together
// as a profile code (XXXX-XXXX-XXXX-XXXX-XXXX). Every save is copied to the
// Supabase project under that profile, and on launch any newer copy online is
// pulled back down, so careers survive a browser that forgets its storage.
// Typing the code on another phone (or after a wipe) brings the careers back.
//
// The profile itself is kept in localStorage with a cookie backup. The server
// only stores a sha256 hash of the key and is reached through two functions,
// `rfg_profile_save` and `rfg_profile_load` (the table has row level security
// and no policies).
//
// `?auth=local` / `?cloud=local` swaps the server for a same-browser copy (only
// honoured on localhost), which is what the smoke test uses.

import { SUPABASE_URL, SUPABASE_KEY } from './online.js';
import { auth } from './auth.js';
import { exportSlots, importSlots, onSaved } from '../core/save.js';

const KEY = 'mwsr.profile';
const COOKIE = 'mwsr_profile';
const OLD_SESSION = 'mwsr.auth.session';   // from when the game had log-ins
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I mix-ups

const isLocalHost = () => ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
const qs = new URLSearchParams(location.search);
const useLocal = isLocalHost() && (qs.get('auth') === 'local' || qs.get('cloud') === 'local');

const rand = n => { const b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map(x => ABC[x % 32]).join(''); };
const cookiePath = () => location.pathname.replace(/[^/]*$/, '') || '/';

function readStored() {
  try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && p.id && p.key) return p; } catch { /* blocked */ }
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
    const p = m && JSON.parse(decodeURIComponent(m[1]));
    if (p && p.id && p.key) return p;
  } catch { /* blocked */ }
  return null;
}
function store(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* blocked */ }
  try {
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(p))}; path=${cookiePath()}; max-age=34560000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  } catch { /* blocked */ }
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* not supported */ }
}

// Which local save folder this device already uses: the account that was last
// logged in here, else whichever account has the newest save.
function existingOwner() {
  try { const s = JSON.parse(localStorage.getItem(OLD_SESSION) || 'null'); if (s?.user?.id) return s.user.id; } catch { /* none */ }
  let best = null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const m = /^rollforglory\.acct\.(.+)\.save\.\w+$/.exec(localStorage.key(i) || '');
      if (!m) continue;
      let t = 0; try { t = JSON.parse(localStorage.getItem(m[0])).savedAt || 0; } catch { /* unreadable */ }
      if (!best || t > best.t) best = { id: m[1], t };
    }
  } catch { /* blocked */ }
  return best ? best.id : null;
}

export const formatCode = p => (p.id + p.key).match(/.{4}/g).join('-');
export function parseCode(text) {
  const c = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 20) return null;
  return { id: c.slice(0, 8), key: c.slice(8) };
}

async function rpc(fn, args) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST', signal: ctl.signal, keepalive: fn === 'rfg_profile_save' && JSON.stringify(args).length < 60000,
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { /* not json */ }
    if (!res.ok) throw new Error((data && data.message) || `Save server error (${res.status})`);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The save server took too long to answer.');
    throw e;
  } finally { clearTimeout(to); }
}

const remote = {
  load: p => rpc('rfg_profile_load', { p_id: p.id, p_key: p.key }),
  save: (p, saves) => rpc('rfg_profile_save', { p_id: p.id, p_key: p.key, p_saves: saves }),
};
const local = {
  db() { try { return JSON.parse(localStorage.getItem('mwsr.localcloud') || '{}'); } catch { return {}; } },
  async load(p) { const r = this.db()[p.id]; if (!r) return { found: false }; if (r.key !== p.key) throw new Error('Wrong profile code'); return { found: true, saves: r.saves }; },
  async save(p, saves) { const d = this.db(); if (d[p.id] && d[p.id].key !== p.key) throw new Error('Wrong profile code'); d[p.id] = { key: p.key, saves }; localStorage.setItem('mwsr.localcloud', JSON.stringify(d)); return { ok: true }; },
};

export const profile = {
  cloud: useLocal ? local : remote,
  kind: useLocal ? 'local' : 'supabase',
  p: null,
  synced: false,   // true once this launch has talked to the server
  authUser: null,
  get id() { return this.p && this.p.id; },
  get owner() { return this.p && (this.p.owner || this.p.id); },
  get code() { return this.p ? formatCode(this.p) : ''; },

  // Called once at boot, before the title screen.
  async init() {
    await auth.init();
    this.p = readStored();
    if (!this.p) this.p = { id: rand(8), key: rand(12), owner: existingOwner() || undefined };
    store(this.p);
    onSaved(() => this.pushSoon());
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && this.dirty) this.push(); });
    // Don't hold the title screen hostage to a slow signal.
    await Promise.race([this.pull(), new Promise(r => setTimeout(r, 4000))]);
    if (auth.user) await this.switchToAuth(auth.user);
  },

  async switchToAuth(user) {
    if (!user?.id || this.authUser?.id === user.id) return;
    const guestSlots = exportSlots(this.owner);
    this.authUser = user;
    setSaveOwner(user.id);
    try {
      const remoteSave = await auth.loadSave(user.id);
      importSlots(user.id, guestSlots);
      if (remoteSave?.saves?.slots) importSlots(user.id, remoteSave.saves.slots);
      await auth.saveSave(user.id, { v: 1, slots: exportSlots(user.id) });
      this.synced = true;
    } catch (e) {
      console.warn('auth save load', e.message);
      importSlots(user.id, guestSlots);
    }
  },

  async switchFromAuth() {
    if (!this.authUser) return;
    this.authUser = null;
    setSaveOwner(this.p?.id);
    await this.pull();
  },

  // Brings down any save that is newer online than on this device.
  async pull() {
    try {
      const r = await this.cloud.load(this.p);
      this.synced = true;
      if (r && r.found && r.saves) importSlots(this.owner, r.saves.slots || {});
      if (!r || !r.found) this.push();   // first launch: put this device's saves online
      return true;
    } catch (e) { console.warn('profile pull', e.message); return false; }
  },

  dirty: false,
  timer: 0,
  pushSoon() { this.dirty = true; clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 2500); },
  async push() {
    clearTimeout(this.timer);
    this.dirty = false;
    try { await this.cloud.save(this.p, { v: 1, slots: exportSlots(this.owner) }); this.synced = true; }
    catch (e) { this.dirty = true; console.warn('profile push', e.message); }
  },

  // Switches this device to the profile behind a code and pulls its careers.
  async useCode(text) {
    const c = parseCode(text);
    if (!c) throw new Error('A profile code is 20 letters and numbers.');
    if (this.p && c.id === this.p.id) return;
    const r = await this.cloud.load(c);
    if (!r || !r.found) throw new Error('No profile with that code.');
    this.p = { id: c.id, key: c.key };
    store(this.p);
    importSlots(this.owner, (r.saves && r.saves.slots) || {}, true);
  },
};
