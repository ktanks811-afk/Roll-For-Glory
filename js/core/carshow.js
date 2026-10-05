// Car shows: how a build is judged, who else shows up, and how the crowd
// votes. Pure logic so scripts/check-data.mjs can test it; the screens are in
// ui/carshow.js.

import { CARS, CAR_BY_ID } from '../data/cars.js';
import { defaultVisual, partLevels, PAINT_SWATCHES, WHEEL_COLORS } from '../data/parts.js';
import { RACERS } from '../data/npcs.js';

// Weekend daytime shows: Saturday and Sunday, 10 AM to 6 PM.
export const SHOW_DAYS = ['Sat', 'Sun'];
export const SHOW_OPEN = 10, SHOW_CLOSE = 18;
export const ENTRY_FEE = 150;
export const VOTERS = 240;

// Prize money, rep and followers for 1st/2nd/3rd, scaled by the show's tier.
export function prizeFor(place, tier) {
  const base = [0, 2000 + 1500 * (tier - 1), 900 + 600 * (tier - 1), 400 + 250 * (tier - 1)][place] || 0;
  return { cash: base, rep: place ? Math.round([0, 60, 30, 15][place] * tier) : 4, followers: [40, 400, 180, 90][place] || 40 };
}

const pts = (table, v) => table[v] ?? 0;
const hexRgb = c => { const n = parseInt(String(c || '#000').slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const colorDist = (a, b) => { const [r1, g1, b1] = hexRgb(a), [r2, g2, b2] = hexRgb(b); return Math.hypot(r1 - r2, g1 - g2, b1 - b2); };
const isMetal = c => ['#c0c4c8', '#1a1a1a', '#5b5f66', '#c9a24a', '#f2f2f2', '#0d0d0d'].some(m => colorDist(c, m) < 40);

// Score a build out of roughly 0-160, split into what the judges look at.
export function judge(model, visual, cond = {}, levels = {}) {
  const v = { ...defaultVisual(model), ...visual };
  const paint = pts({ gloss: 5, metallic: 9, matte: 10, pearl: 14, chrome: 13 }, v.finish) + (colorDist(v.paint, model.color) > 30 ? 3 : 0);
  const size = +v.wheelSize || 18;
  const wheels = v.wheels === 'steel' ? 0
    : pts({ five: 8, dish: 10, mesh: 11, split: 11, turbine: 9, six: 10, forged: 12 }, v.wheels) + Math.max(0, Math.min(4, size - 18)) + pts({ flush: 3, poke: 2 }, v.offset);
  const body = pts({ street: 8, wide: 15 }, v.kit) + pts({ lip: 4, duck: 4, gt: 6, drag: 4 }, v.spoiler)
    + pts({ sport: 3, splitter: 5 }, v.frontBumper) + pts({ sport: 3, diffuser: 5 }, v.rearBumper)
    + pts({ sport: 3, aero: 5 }, v.skirts) + pts({ cowl: 5, scoop: 5, vented: 5 }, v.hood);
  const details = pts({ light: 3, medium: 5, limo: 6 }, v.tint) + pts({ xenon: 2, led: 4, yellow: 3 }, v.headlights)
    + pts({ smoked: 2, bar: 4 }, v.taillights) + pts({ dual: 2, quad: 3, cannon: 3 }, v.exhaustTips)
    + pts({ stripes: 5, side: 3, number: 4, flames: 8, crew: 5 }, v.decal)
    + (v.neon && v.neon !== 'none' ? 5 : 0) + (v.interior && v.interior !== '#111111' ? 4 : 0);
  // the judges pop the hood
  const engine = Math.min(20, Object.values(levels).reduce((a, b) => a + (+b || 0), 0) * 1.5);
  // does it hang together: wheels that match or set off the paint, and not every loud thing at once
  let cohesion = 0;
  if (v.wheels !== 'steel') cohesion += colorDist(v.wheelColor, v.paint) < 60 ? 5 : isMetal(v.wheelColor) ? 3 : 0;
  if (v.decal !== 'none' && v.decalColor && colorDist(v.decalColor, v.paint) > 120) cohesion += 2;
  const loud = [v.finish === 'chrome', v.decal === 'flames', v.decal === 'number', v.neon && v.neon !== 'none', v.spoiler === 'gt' && v.kit !== 'wide'].filter(Boolean).length;
  cohesion -= Math.max(0, loud - 2) * 4;
  const condition = Math.round(((cond.body ?? 100) - 75) / 25 * 10 + ((cond.lights ?? 100) < 70 ? -4 : 0));
  const rarity = (model.rarity || 1) * 6;
  const parts = { paint, wheels, body, details, engine, cohesion, condition, rarity };
  const total = Math.max(0, Object.values(parts).reduce((a, b) => a + b, 0));
  return { total: Math.round(total), parts };
}

// How loud vs. clean a build is (0..1). Some voters like flash, some like OEM+.
export function flash(visual) {
  const v = visual || {};
  return Math.min(1, (['chrome', 'pearl'].includes(v.finish) ? 0.3 : 0) + (v.kit === 'wide' ? 0.2 : 0) + (v.decal === 'flames' || v.decal === 'number' ? 0.2 : 0)
    + (v.neon && v.neon !== 'none' ? 0.2 : 0) + (v.spoiler === 'gt' ? 0.1 : 0) + (v.offset === 'poke' ? 0.1 : 0));
}

// Build themes for the other entrants. Each pick is drawn from what Vega
// Kustoms actually sells, so the player can copy a build they like.
const THEMES = {
  slab:   { cls: ['Sedan', 'Muscle', 'Truck', 'SUV'], finish: ['pearl', 'pearl', 'metallic', 'chrome'], wheels: ['dish', 'split', 'five'], wheelColor: ['#c0c4c8', '#c9a24a', '#f2f2f2'], size: [20, 22], offset: ['poke'], tint: ['limo', 'medium'], neon: ['#a01aff', '#1a9bff', 'none'], decal: ['none', 'side'] },
  jdm:    { cls: ['JDM', 'Tuner'], finish: ['gloss', 'metallic', 'pearl'], wheels: ['six', 'mesh', 'split'], wheelColor: ['#c9a24a', '#1a1a1a', '#f2f2f2'], size: [17, 18], offset: ['flush'], kit: ['street', 'wide'], spoiler: ['gt', 'lip'], tint: ['medium', 'light'], decal: ['number', 'crew', 'none'], headlights: ['led', 'yellow'] },
  muscle: { cls: ['Muscle'], finish: ['gloss', 'metallic'], wheels: ['five', 'dish'], wheelColor: ['#c0c4c8', '#1a1a1a'], size: [18, 20], offset: ['flush'], hood: ['cowl', 'scoop'], decal: ['stripes', 'stripes', 'none'], exhaustTips: ['dual', 'quad'], tint: ['medium', 'none'] },
  euro:   { cls: ['European', 'Exotic', 'Supercar'], finish: ['matte', 'metallic', 'gloss'], wheels: ['split', 'mesh', 'turbine'], wheelColor: ['#1a1a1a', '#5b5f66'], size: [19, 20, 21], offset: ['flush'], frontBumper: ['splitter', 'sport'], rearBumper: ['diffuser'], skirts: ['aero'], tint: ['medium', 'limo'], headlights: ['led'] },
  stance: { cls: ['Tuner', 'JDM', 'European', 'Sedan'], finish: ['matte', 'gloss', 'pearl'], wheels: ['mesh', 'dish', 'split'], wheelColor: ['#c0c4c8', '#c9a24a'], size: [18, 19], offset: ['poke'], kit: ['wide', 'street'], frontBumper: ['sport'], skirts: ['sport'], tint: ['limo'], neon: ['#ff1a2e', '#13b3c4', 'none'] },
};
export const THEME_NAMES = { slab: 'Slab', jdm: 'JDM', muscle: 'Muscle', euro: 'Euro', stance: 'Stance' };
const FIRST = ['Big Lo', 'Kiki', 'Trey', 'Mari', 'Junior', 'Nae', 'Dez', 'Lil Tone', 'Rosie', 'Chuy', 'Bree', 'Pooh', 'Kendrick', 'Yesi', 'Marcus', 'Tasha', 'Dub', 'Gabe'];
const CLUB = ['from Stop Six', 'from the North Side', 'from Polytechnic', 'from Arlington Heights', 'from the Southside', 'from Como', 'from Haltom City', 'from Everman'];

const pickR = (rnd, a) => a[Math.floor(rnd() * a.length)];

// A full build for an NPC entrant. `level` 1..5 sets how deep the build goes.
export function themedBuild(model, theme, level, rnd = Math.random) {
  const t = THEMES[theme];
  const v = defaultVisual(model);
  const go = () => rnd() < 0.35 + level * 0.12;
  v.paint = rnd() < 0.3 ? model.color : pickR(rnd, PAINT_SWATCHES);
  v.finish = pickR(rnd, t.finish);
  v.wheels = pickR(rnd, t.wheels); v.wheelColor = pickR(rnd, t.wheelColor || WHEEL_COLORS);
  v.wheelSize = String(pickR(rnd, t.size)); v.offset = pickR(rnd, t.offset);
  for (const k of ['kit', 'spoiler', 'frontBumper', 'rearBumper', 'skirts', 'hood', 'tint', 'neon', 'decal', 'headlights', 'exhaustTips']) if (t[k] && go()) v[k] = pickR(rnd, t[k]);
  if (v.decal !== 'none') v.decalColor = pickR(rnd, ['#f2f2f2', '#0d0d0d', '#c41b1b', '#e8c21a']);
  if (level >= 3 && go()) v.interior = pickR(rnd, ['#7a1212', '#a8875a', '#d9d9d9']);
  return v;
}

// Who else is showing today. Some regulars from the street (their real cars),
// the rest locals with themed builds, sized to the player's tier.
export function makeEntrants(tier, n = 5, rnd = Math.random) {
  const out = [];
  const regulars = RACERS.filter(r => r.car?.visual && r.tier <= tier && r.tier >= tier - 1);
  for (const r of regulars.sort(() => rnd() - 0.5).slice(0, Math.min(2, n))) {
    const m = CAR_BY_ID[r.car.model];
    out.push({ id: 'r_' + r.id, name: `${r.name} "${r.nick}"`, modelId: m.id, year: r.car.year, visual: { ...defaultVisual(m), ...r.car.visual }, cond: { body: 96 }, levels: partLevels(r.car.parts || {}), theme: null, color: r.color });
  }
  const priceCap = [0, 35000, 70000, 140000, 400000, 5e6][tier] || 5e6;
  const names = [...FIRST].sort(() => rnd() - 0.5);
  while (out.length < n) {
    const theme = pickR(rnd, Object.keys(THEMES));
    const pool = CARS.filter(m => !m.rig && THEMES[theme].cls.includes(m.cls) && m.msrp <= priceCap);
    const m = pickR(rnd, pool.length ? pool : CARS.filter(c => c.msrp <= priceCap));
    const level = Math.max(1, Math.min(5, tier + Math.floor(rnd() * 3) - 1));
    out.push({ id: 'l' + out.length, name: `${names.pop()} ${pickR(rnd, CLUB)}`, modelId: m.id, year: m.years[1], visual: themedBuild(m, theme, level, rnd), cond: { body: 88 + Math.round(rnd() * 12) }, levels: {}, theme, color: pickR(rnd, ['#c41b1b', '#1b4fc4', '#e8c21a', '#1f8f3a', '#a01aff', '#13b3c4']) });
  }
  return out;
}

// The crowd votes. Every voter has a taste (a favourite class, and flash vs.
// clean) and votes for the build they like most, with some noise. Returns
// the votes per entry, in order, so the UI can play them back.
export function crowdVote(entries, voters = VOTERS, rnd = Math.random) {
  const scored = entries.map(e => ({ e, base: judge(CAR_BY_ID[e.modelId], e.visual, e.cond, e.levels).total, cls: CAR_BY_ID[e.modelId].cls, fl: flash(e.visual) }));
  const classes = [...new Set(scored.map(x => x.cls))];
  const ballots = [];
  for (let i = 0; i < voters; i++) {
    const fav = rnd() < 0.6 ? pickR(rnd, classes) : null;
    const likesFlash = rnd() * 2 - 1;   // -1 clean .. +1 loud
    // each voter leans to the best build for their taste, but not every time
    const w = scored.map(x => x.base * (1 + (fav === x.cls ? 0.15 : 0) + likesFlash * (x.fl - 0.35) * 0.2));
    const top = Math.max(...w);
    const p = w.map(v => Math.exp((v - top) / 9));
    let r = rnd() * p.reduce((a, b) => a + b, 0), best = 0;
    while (best < p.length - 1 && (r -= p[best]) > 0) best++;
    ballots.push(best);
  }
  return ballots;
}

export function tally(ballots, n) {
  const t = new Array(n).fill(0);
  for (const b of ballots) t[b]++;
  return t;
}

export function isShowTime(time, dayName) {
  const h = (time.min / 60) % 24;
  return SHOW_DAYS.includes(dayName) && h >= SHOW_OPEN && h < SHOW_CLOSE;
}
