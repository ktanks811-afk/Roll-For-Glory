// Saves live in localStorage: one autosave plus three manual slots, kept
// separately for each account that logs in on this device.
// Every access is wrapped — private windows and blocked storage must not
// crash the game, they just mean nothing persists.

import { game } from './state.js';
import { emit } from './events.js';
import { ensure as ensureHustle, settleAway } from './hustle.js';
import { ensureRecord } from './warrants.js';
import { ensureJustice } from './justice.js';
import { ensureNeeds } from './needs.js';

const PREFIX = 'rollforglory.';
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'];
let owner = '';   // 'acct.<user id>.' once someone is logged in

// Points saves at this account's careers. The first account to log in on a
// device takes over the saves made before accounts existed, so nobody loses
// their progress. Returns how many saves it took over.
export function setSaveOwner(userId) {
  owner = userId ? `acct.${userId}.` : '';
  if (!userId || SLOTS.some(sl => raw(owner + 'save.' + sl))) return 0;
  let moved = 0;
  for (const sl of SLOTS) {
    const v = raw('save.' + sl);
    if (!v) continue;
    try {
      localStorage.setItem(PREFIX + owner + 'save.' + sl, v);
      localStorage.removeItem(PREFIX + 'save.' + sl);
      moved++;
    } catch { /* storage full or blocked: the old save stays where it was */ }
  }
  return moved;
}

// The newest save made before accounts existed, if this device has one.
export function latestLegacySave() {
  let best = null;
  for (const sl of SLOTS) {
    let d = null; try { d = JSON.parse(raw('save.' + sl)); } catch { /* unreadable */ }
    if (d && d.state && d.state.player && (!best || d.savedAt > best.savedAt)) best = { savedAt: d.savedAt, name: d.state.player.name, day: d.state.time?.day ?? 1 };
  }
  return best;
}

function raw(key) { try { return localStorage.getItem(PREFIX + key); } catch { return null; } }

function read(key) {
  try { const raw = localStorage.getItem(PREFIX + key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function write(key, val) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); return true; } catch { return false; }
}

export function saveGame(slot = 'auto', quiet = false) {
  if (!game.s) return false;
  ensureHustle(game.s).lastReal = Date.now();
  const ok = write(owner + 'save.' + slot, { savedAt: Date.now(), state: game.s });
  if (!quiet) emit('toast', ok
    ? { kind: 'good', text: slot === 'auto' ? 'Autosaved' : `Saved to ${slotName(slot)}` }
    : { kind: 'bad', text: 'Could not save — browser storage is unavailable' });
  return ok;
}

export function loadGame(slot = 'auto') {
  const data = read(owner + 'save.' + slot);
  if (!data || !data.state) return null;
  return migrate(data.state);
}

export function slotInfo(slot) {
  const d = read(owner + 'save.' + slot);
  if (!d || !d.state) return null;
  const s = d.state;
  return { savedAt: d.savedAt, name: s.player.name, cash: s.cash, rep: s.rep, day: s.time.day, cars: s.cars.length };
}

export function latestSlot() {
  let best = null;
  for (const slot of SLOTS) {
    const i = slotInfo(slot);
    if (i && (!best || i.savedAt > best.savedAt)) best = { slot, ...i };
  }
  return best;
}

export function deleteSlot(slot) {
  try { localStorage.removeItem(PREFIX + owner + 'save.' + slot); } catch { /* storage blocked */ }
}

export function slotName(slot) {
  return slot === 'auto' ? 'Autosave' : `Slot ${slot.slice(-1)}`;
}

export function exportSave() {
  return JSON.stringify({ game: 'roll-for-glory', savedAt: Date.now(), state: game.s }, null, 1);
}

export function importSave(text) {
  const d = JSON.parse(text);
  if (d.game !== 'roll-for-glory' || !d.state) throw new Error('Not a Murda Worth Street Racing save file');
  return migrate(d.state);
}

function migrate(s) {
  // version 1 is current; future migrations go here.
  s.inventory ??= { snacks: 0, energyDrinks: 0, repairKits: 0 };
  s.feed ??= [];
  s.challenges ??= {};
  s.story.counters ??= {};
  // orders from before instant delivery arrive right now
  s.orders ??= [];
  for (const o of s.orders) for (const pid of o.items) s.partsBin.push({ pid, uid: Math.random().toString(36).slice(2) });
  s.orders = [];
  ensureHustle(s);
  ensureRecord(s);
  ensureJustice(s);
  ensureNeeds(s);   // hunger + energy meters (older saves start full)
  settleAway(s);   // the businesses kept running while the game was closed
  return s;
}

// ---------------- settings ----------------
const DEFAULT_SETTINGS = {
  quality: 'medium', units: 'mph', transmission: 'auto', steerMode: 'arrows', camMode: 'top', volume: 0.7, music: 0.5,
  shake: true, showFps: false, miniMode: 0, touch: 'auto', invertCam: false,
};
export const settings = { ...DEFAULT_SETTINGS, ...(read('settings') || {}) };
export function saveSettings() { write('settings', settings); emit('settings', settings); }
