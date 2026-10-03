// Loads the Glitch rim pack atlas once. Anything drawn before it arrives
// falls back to the drawn wheel; listeners redraw when it's ready.

import { RIM_ATLAS, RIM_CELL, RIM_COLS, RIM_BY_ID } from '../data/rims.js';

let img = null, ready = false;
const waiting = new Set();

function load() {
  if (img || typeof Image === 'undefined') return;
  img = new Image();
  img.onload = () => { ready = true; for (const fn of waiting) { try { fn(); } catch {} } waiting.clear(); };
  img.src = RIM_ATLAS;
}

// Call fn once the atlas has loaded (right away if it already has).
export function onRimsReady(fn) { load(); if (ready) fn(); else waiting.add(fn); }

// Draw rim `id` as a circle of radius r centred on (0, 0). Returns false if
// the atlas isn't loaded yet (or the id is unknown) so the caller can fall back.
export function drawRimSprite(g, id, r) {
  const rim = RIM_BY_ID[id];
  load();
  if (!rim || !ready) return false;
  const sx = (rim.i % RIM_COLS) * RIM_CELL, sy = Math.floor(rim.i / RIM_COLS) * RIM_CELL;
  g.save();
  g.imageSmoothingEnabled = !(rim.i < 20);   // the first sheet is pixel art
  g.drawImage(img, sx, sy, RIM_CELL, RIM_CELL, -r, -r, r * 2, r * 2);
  g.restore();
  return true;
}

export function rimHasTire(id) { return !!RIM_BY_ID[id]?.tire; }
