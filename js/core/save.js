// Saves live in localStorage: one autosave plus three manual slots.
// Every access is wrapped — private windows and blocked storage must not
// crash the game, they just mean nothing persists.

import { game } from './state.js';
import { emit } from './events.js';
import { ensure as ensureHustle, settleAway } from './hustle.js';

const PREFIX = 'rollforglory.';
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'];

function read(key) {
  try { const raw = localStorage.getItem(PREFIX + key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function write(key, val) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); return true; } catch { return false; }
}

export function saveGame(slot = 'auto', quiet = false) {
  if (!game.s) return false;
  ensureHustle(game.s).lastReal = Date.now();
  const ok = write('save.' + slot, { savedAt: Date.now(), state: game.s });
  if (!quiet) emit('toast', ok
    ? { kind: 'good', text: slot === 'auto' ? 'Autosaved' : `Saved to ${slotName(slot)}` }
    : { kind: 'bad', text: 'Could not save — browser storage is unavailable' });
  return ok;
}

export function loadGame(slot = 'auto') {
  const data = read('save.' + slot);
  if (!data || !data.state) return null;
  return migrate(data.state);
}

export function slotInfo(slot) {
  const d = read('save.' + slot);
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
  try { localStorage.removeItem(PREFIX + 'save.' + slot); } catch { /* storage blocked */ }
}

export function slotName(slot) {
  return slot === 'auto' ? 'Autosave' : `Slot ${slot.slice(-1)}`;
}

export function exportSave() {
  return JSON.stringify({ game: 'roll-for-glory', savedAt: Date.now(), state: game.s }, null, 1);
}

export function importSave(text) {
  const d = JSON.parse(text);
  if (d.game !== 'roll-for-glory' || !d.state) throw new Error('Not a Roll for Glory save file');
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
  settleAway(s);   // the businesses kept running while the game was closed
  return s;
}

// ---------------- settings ----------------
const DEFAULT_SETTINGS = {
  quality: 'medium', units: 'mph', transmission: 'auto', volume: 0.7, music: 0.5,
  shake: true, showFps: false, touch: 'auto', invertCam: false,
};
export const settings = { ...DEFAULT_SETTINGS, ...(read('settings') || {}) };
export function saveSettings() { write('settings', settings); emit('settings', settings); }
