// Where the sun is, for the 2.5D look: every shadow in the world (buildings,
// trees, cars, people, poles) falls the same way and stretches with the time
// of day, and tall things lean away from the screen centre by LEAN.
//
// Shadows swing from bottom-left in the morning to bottom-right in the
// evening, short at noon and long near sunrise and sunset. Clouds and rain
// soften them, and at night they shrink to faint contact shadows.

export const LEAN = 0.0015;   // 1 / camera height (m): how far a 1 m tall thing leans per pixel off centre

// How far something h metres tall is drawn from its base (in drawing px).
// Overhead view: away from the screen centre. Tilted view (cam.tilt): straight
// up the screen, by cam.tx / cam.ty per metre (set in World.draw).
export const leanX = (cam, px, h) => cam.tilt ? cam.tx * h : (px - cam.w / 2) * h * LEAN;
export const leanY = (cam, py, h) => cam.tilt ? cam.ty * h : (py - cam.h / 2) * h * LEAN;
// In the tilted view, draw far things first: larger = further up the screen.
export const depthOf = (cam, x, z) => -(x * Math.sin(cam.rot) + z * Math.cos(cam.rot));

export const sun = { dx: 0.1, dz: 0.12, a: 0.25, lx: -0.55, lz: -0.83 };

const SOFT = { cloudy: 0.55, rain: 0.4, storm: 0.3, fog: 0.35 };

export function setSun(hour, weather = 'clear') {
  const t = (hour - 6.5) / 13;                 // 0 at sunrise, 1 at sunset
  let dx, dz, a;
  if (t > 0 && t < 1) {
    const elev = Math.sin(Math.PI * t);        // 0 on the horizon, 1 at noon
    const len = Math.min(0.75, 0.2 / Math.max(0.25, elev));   // shadow length per metre of height
    const ang = (t - 0.5) * 2.3;               // swings across the bottom of the screen
    dx = Math.sin(ang) * len; dz = Math.cos(ang) * len * 0.9 + 0.03;
    a = 0.3 * Math.min(1, elev * 4);
  } else { dx = 0.04; dz = 0.06; a = 0.12; }  // night: short, faint contact shadows
  a = Math.max(0.12, a) * (SOFT[weather] ?? 1);
  if (a !== sun.a) fills.clear();
  sun.dx = dx; sun.dz = dz; sun.a = a;
  const n = Math.hypot(dx, dz) || 1;
  sun.lx = -dx / n; sun.lz = -dz / n;          // unit vector toward the sun, on the ground
}

// The shadow colour, k times the sun's strength (cached: asked for per tree,
// car and person every frame).
const fills = new Map();
export function shadowFill(k = 1) {
  let f = fills.get(k);
  if (!f) fills.set(k, f = `rgba(0,0,0,${(sun.a * k).toFixed(3)})`);
  return f;
}

// Shadow of an axis-aligned box on the ground (screen px): the footprint
// swept along the sun, as one convex outline.
export function boxShadowPath(ctx, x, y, w, d, ox, oy) {
  if (ox >= 0 && oy >= 0) { ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w + ox, y + oy); ctx.lineTo(x + w + ox, y + d + oy); ctx.lineTo(x + ox, y + d + oy); ctx.lineTo(x, y + d); }
  else if (ox < 0 && oy >= 0) { ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + d); ctx.lineTo(x + w + ox, y + d + oy); ctx.lineTo(x + ox, y + d + oy); ctx.lineTo(x + ox, y + oy); }
  else if (ox < 0) { ctx.moveTo(x + ox, y + oy); ctx.lineTo(x + w + ox, y + oy); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + d); ctx.lineTo(x, y + d); ctx.lineTo(x + ox, y + d + oy); }
  else { ctx.moveTo(x, y); ctx.lineTo(x + ox, y + oy); ctx.lineTo(x + w + ox, y + oy); ctx.lineTo(x + w + ox, y + d + oy); ctx.lineTo(x + w, y + d); ctx.lineTo(x, y + d); }
  ctx.closePath();
}
