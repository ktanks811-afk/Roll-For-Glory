// How recognisable you are on foot. A ski mask hides most of your face; an
// all-black fit leaves witnesses with "a guy in black", especially at night.
// Concealment (0..1) is the chance a witness or camera can't tie a crime to
// you. Driving doesn't count: they read your plate, not your face.
//
// The other side of it: a ski mask on a public street gets looked at. A
// patrol that watches you walk around masked will stop and question you
// (core police logic lives in world2d/police.js).

import { CLOTH_BY_ID, MASKS } from '../data/shops.js';

const DARK_MAX = 0x30;   // every colour channel at or below this counts as black
const BODY = ['top', 'bottom', 'shoes'];
const CAP = 0.92;        // someone always might recognise your walk

export function isDark(color) {
  const m = /^#([0-9a-f]{6})$/i.exec(color || '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return Math.max(n >> 16, (n >> 8) & 255, n & 255) <= DARK_MAX;
}

export const maskOf = look => { const c = CLOTH_BY_ID[look?.mask]; return c && c.conceal ? c : null; };
export const masked = look => !!maskOf(look);
export const darkPieces = look => BODY.filter(k => isDark(CLOTH_BY_ID[look?.[k]]?.color)).length;
export const allBlack = look => darkPieces(look) === BODY.length;

export function concealment(look, night = false) {
  const v = (maskOf(look)?.conceal || 0) + darkPieces(look) * (night ? 0.12 : 0.08);
  return Math.min(CAP, Math.round(v * 100) / 100);
}

export function disguiseLabel(c) {
  if (c >= 0.75) return 'No ID';
  if (c >= 0.5) return 'Hard to ID';
  if (c >= 0.2) return 'Vague';
  return 'Face shows';
}

// Pull the mask down / up without opening the wardrobe. Remembers which mask.
export function toggleMask(s) {
  const look = s.player.look;
  if (masked(look)) { s.player.maskStash = look.mask; look.mask = 'no_mask'; return false; }
  const own = MASKS.filter(m => s.player.outfits.includes(m.id));
  if (!own.length) return null;
  look.mask = own.some(m => m.id === s.player.maskStash) ? s.player.maskStash : own[0].id;
  return true;
}
export const ownsMask = s => MASKS.some(m => s?.player?.outfits?.includes(m.id));
