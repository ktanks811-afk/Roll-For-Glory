// The rest of Hogs & Dogs, living inside Murda Worth. Everything the ported
// H&D systems save sits in s.hd (the dogs themselves stay in s.kennel, see
// core/dogs.js). This file makes that save area, gives the engines brought
// over as is (gfx2d/horseArt.js, gfx2d/hogArt.js) the `S` they expect, and
// holds the bits every H&D system shares: the calendar (one game day is one
// month, like in H&D), the rival kennels and the ribbon wall.
// DOM-free so check-data can run it.

import { game } from './state.js';

export function ensureHd(s) {
  const h = s.hd ??= {};
  h.nextId ??= 1;
  h.horses ??= []; h.horseMarket ??= []; h.hpreg ??= []; h.hgid ??= {};
  h.hogs ??= []; h.hogPin ??= { ration: 'standard' }; h.hogSeq ??= 0; h.inv ??= { feed: 0 };
  h.ribbons ??= []; h.st ??= {}; h.log ??= [];
  return h;
}

// The engines read and write S.<field>. S.day is the game day; the rest is s.hd.
export const hdS = new Proxy({}, {
  get(_, k) {
    const s = game.s; if (!s) return undefined;
    if (k === 'day') return s.time.day;
    if (k === 'level') return Math.max(1, Math.floor((s.rep || 0) / 2500) + 1);
    return ensureHd(s)[k];
  },
  set(_, k, v) { const s = game.s; if (s && k !== 'day' && k !== 'level') ensureHd(s)[k] = v; return true; },
});

// One game day is one month, so a year is 12 days, a week is 7.
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthOf = day => ((day - 1) % 12 + 12) % 12;          // 0 = January
export const monthName = day => MONTHS[monthOf(day)];
export const seasonOf = day => ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Fall', 'Fall', 'Fall', 'Winter'][monthOf(day)];
export const weekOf = day => Math.floor(day / 7);
export const yearKey = day => 'Y' + Math.floor((day - 1) / 12);

// The other kennels in the county: the field at shows, trials and the fair.
export const RIVALS = ['Bayou Bend Kennels', 'Red Clay Curs', 'Slough Creek Ranch', 'Palmetto Catch Co.', 'Lone Pine Hog Dogs', 'Big Thicket Bay Dogs', 'Cypress Knee Ranch',
  'Brazos Bottom Kennels', 'Paluxy River Curs', 'Godley Grit Hog Dogs', 'Nolan Creek Catch Dogs', 'Hill County Bay Dogs'];

export const ranchName = s => (s.player?.name ? `${s.player.name}'s kennel` : 'Your kennel');
export const level = s => Math.max(1, Math.floor((s.rep || 0) / 2500) + 1);

// A ribbon on the wall. place 1..3.
export function ribbon(s, o) {
  const h = ensureHd(s);
  h.ribbons.unshift({ day: s.time.day, ...o });
  if (h.ribbons.length > 80) h.ribbons.length = 80;
  h.st.ribbons = (h.st.ribbons || 0) + 1;
}
// The ranch log: the last things that happened with the dogs, hogs and horses.
export function hdLog(s, text) {
  const h = ensureHd(s);
  h.log.unshift({ day: s.time.day, text });
  if (h.log.length > 60) h.log.length = 60;
}
export const bump = (s, k, n = 1) => { const st = ensureHd(s).st; st[k] = (st[k] || 0) + n; return st[k]; };
export const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
