// Top-down car sprites, drawn procedurally and cached. Every car is built from
// its own design sheet (data/carShapes.js): real length and width, where the
// windshield, roof and rear glass sit, wing, lights, roof rails, pickup bed,
// convertible cockpit. Every visual mod — paint finish, wheels, tint, aero,
// hood, lights, graphics, widebody, damage — changes the drawing too.
// Sprites face up (north); length runs along y.

import { CALIPER_COLORS } from '../data/parts.js';
import { shapeOf, dimsOf } from '../data/carShapes.js';

export const SPRITE_PX = 24; // pixels per metre in the cached sprite (HD)

// Legacy per-body footprints, used when a caller only knows the body class.
export const DIMS = {
  hatch:  { L: 4.1,  W: 1.76 },
  sedan:  { L: 4.85, W: 1.85 },
  coupe:  { L: 4.45, W: 1.8 },
  muscle: { L: 4.75, W: 1.92 },
  truck:  { L: 5.6,  W: 2.0 },
  suv:    { L: 4.9,  W: 1.95 },
  exotic: { L: 4.55, W: 1.9 },
  super:  { L: 4.5,  W: 1.98 },
  wagon:  { L: 4.8,  W: 1.84 },
};

// Footprint of a model (object) or a body class (string).
export function dimsFor(x) {
  if (x && typeof x === 'object') return dimsOf(x);
  return DIMS[x] || DIMS.sedan;
}

const TINT = { none: 0.55, light: 0.7, medium: 0.82, limo: 0.94 };
const HEAD = { halogen: '#fff1c9', xenon: '#dfe9ff', led: '#ffffff', yellow: '#ffd23a' };
const lerp = (a, b, t) => a + (b - a) * t;

function shade(hex, amt) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

function rrect(g, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath();
  g.moveTo(x + rr, y); g.lineTo(x + w - rr, y); g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr); g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h); g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr); g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

// Smooth closed path through points (midpoint quadratic smoothing).
function smooth(g, pts) {
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  g.beginPath(); g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % n]); g.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
  g.closePath();
}

// Plan-view outline: half-width (fraction of W/2) down the length, front to rear.
function planPoints(sh, L, W, wide) {
  const nw = sh.noseW, tw = sh.tailW;
  const mid = sh.arch === 'X' ? 0.93 : sh.arch === 'N' ? 0.95 : 0.985;
  const hips = sh.arch === 'X' || sh.arch === 'N' ? 1.0 : 0.995;
  const prof = [
    [0.0, nw * 0.62], [0.012, nw * 0.84], [0.05, lerp(nw, 1, 0.45)], [0.12, lerp(nw, 1, 0.8)], [0.2, 0.99], [0.32, mid], [0.5, mid], [0.66, 0.99], [0.76, hips],
    [0.88, lerp(hips, tw, 0.45)], [0.965, tw * 0.9], [1.0, tw * 0.7],
  ];
  const hw = W / 2 - (wide ? 0.08 : 0);
  const right = prof.map(([t, f]) => [f * hw, -L / 2 + L * t]);
  const left = prof.slice().reverse().map(([t, f]) => [-f * hw, -L / 2 + L * t]);
  return right.concat(left);
}

function paintFill(g, color, finish, W) {
  if (finish === 'chrome') {
    const gr = g.createLinearGradient(-W / 2, 0, W / 2, 0);
    gr.addColorStop(0, shade(color, -0.3)); gr.addColorStop(0.3, shade(color, 0.75)); gr.addColorStop(0.5, shade(color, 0.2));
    gr.addColorStop(0.7, shade(color, 0.8)); gr.addColorStop(1, shade(color, -0.35));
    return gr;
  }
  const gr = g.createLinearGradient(-W / 2, 0, W / 2, 0);
  const hi = finish === 'matte' ? 0.05 : finish === 'metallic' ? 0.3 : finish === 'pearl' ? 0.36 : 0.18;
  const lo = finish === 'matte' ? -0.1 : -0.34;
  gr.addColorStop(0, shade(color, lo));
  gr.addColorStop(0.18, shade(color, lo * 0.4));
  gr.addColorStop(0.38, shade(color, hi));
  gr.addColorStop(0.5, shade(color, hi * 0.5));
  gr.addColorStop(0.62, shade(color, hi * 0.8));
  gr.addColorStop(0.82, shade(color, lo * 0.4));
  gr.addColorStop(1, shade(color, lo * 1.15));
  return gr;
}

const cache = new Map();

export function spriteKey(style, v, lv, cond) {
  const id = style && typeof style === 'object' ? style.id : style;
  const dmg = cond ? [Math.round((cond.body ?? 100) / 25), Math.round((cond.lights ?? 100) / 30), (cond.tires ?? 100) <= 1 ? 1 : 0] : [4, 4, 0];
  return JSON.stringify([id, v, lv && [lv.turbo, lv.supercharger, lv.intercooler, lv.tires, lv.brakes, lv.nitrous, lv.exhaust, lv.weight], dmg]);
}

// style: a car model (preferred) or a body class string.
// v: visual object, lv: performance stage levels, cond: condition (for damage)
export function carSprite(style, v = {}, lv = {}, cond = null, opts = {}) {
  const key = spriteKey(style, v, lv, cond) + (opts.police ? 'P' : '') + (opts.taxi ? 'T' : '');
  if (cache.has(key)) return cache.get(key);
  const sh = shapeOf(style && typeof style === 'object' ? style : { id: 'body:' + style, body: style });
  const S = SPRITE_PX;
  const wide = v.kit === 'wide';
  const W = sh.W + (wide ? 0.16 : 0), L = sh.L;
  const pad = 0.8;
  const c = document.createElement('canvas');
  c.width = Math.ceil((W + pad * 2) * S);
  c.height = Math.ceil((L + pad * 2) * S);
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2);
  g.scale(S, S);
  g.lineJoin = 'round';

  const paint = v.paint || '#888888';
  const finish = v.finish || 'gloss';
  const y = f => -L / 2 + L * f;                  // fraction from the front
  const { xCowl, xA, xC, xD } = sh;
  const arch = sh.arch;
  const bodyW = W - (wide ? 0.16 : 0);

  // ---- tires (under the body) ----
  const tl = lv.tires || 0;
  const tireW = (arch === 'P' || arch === 'Q' ? 0.27 : arch === 'X' || arch === 'N' ? 0.28 : 0.235) + [0, 0.015, 0.03, 0.05, 0.07][tl] + (wide ? 0.04 : 0);
  const tireL = sh.tr * 2 + (sh.lift || 0) * 0.5;
  const axF = -L / 2 + sh.fo, axR = -L / 2 + sh.fo + sh.WB;
  const track = bodyW / 2 - tireW / 2 + 0.07;
  for (const ax of [axF, axR]) for (const s of [-1, 1]) {
    const tw = ax === axR && tl >= 3 ? tireW + 0.04 : tireW;
    g.fillStyle = '#0b0b0c';
    rrect(g, s * track - tw / 2, ax - tireL / 2, tw, tireL, 0.07); g.fill();
    g.fillStyle = '#1b1c1f';
    rrect(g, s * track - tw / 2 + 0.02, ax - tireL / 2 + 0.02, tw - 0.04, tireL * 0.2, 0.03); g.fill();   // sidewall shine
    // rim lip peeking out
    g.fillStyle = v.wheels === 'steel' ? '#6d7178' : (v.wheelColor || '#c0c4c8');
    g.fillRect(s * (track + tw / 2) - (s > 0 ? 0.045 : 0), ax - tireL * 0.3, 0.045, tireL * 0.6);
    if (tl >= 3) { g.fillStyle = tl === 4 ? '#ffd23a' : '#eeeeee'; g.fillRect(s * (track + tw / 2) - (s > 0 ? 0.075 : -0.03), ax - 0.12, 0.03, 0.24); }
  }

  // ---- body ----
  const plan = planPoints(sh, L, W, wide);
  smooth(g, plan);
  g.fillStyle = paintFill(g, paint, finish, W);
  g.fill();
  g.save(); g.clip();
  // front-to-back light: hood catches the sky, tail falls away
  const lg = g.createLinearGradient(0, -L / 2, 0, L / 2);
  lg.addColorStop(0, 'rgba(255,255,255,0.1)'); lg.addColorStop(xCowl, 'rgba(255,255,255,0.03)'); lg.addColorStop(0.55, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = lg; g.fillRect(-W, -L, W * 2, L * 2);
  if (finish !== 'matte' && finish !== 'chrome') {
    // hood and deck highlights
    g.fillStyle = 'rgba(255,255,255,0.13)';
    rrect(g, -bodyW * 0.28, y(0.04), bodyW * 0.56, L * (xCowl - 0.06), 0.25); g.fill();
    if (xD < 0.96 && arch !== 'H' && arch !== 'W' && arch !== 'P') { rrect(g, -bodyW * 0.27, y(xD + 0.015), bodyW * 0.54, L * (0.94 - xD), 0.2); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-bodyW * 0.5, y(0.0), bodyW, 0.1);
    g.fillRect(-bodyW * 0.5, y(1) - 0.12, bodyW, 0.12);
  }
  // wheel-arch bulges: slightly lighter flares over the wheels
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (const ax of [axF, axR]) for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * (bodyW / 2 - 0.12), ax, 0.2, tireL * 0.42, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
  smooth(g, plan);
  g.lineWidth = 0.045; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.stroke();
  // hood seam and centre crease
  g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 0.025;
  g.beginPath(); g.moveTo(-bodyW * 0.36, y(0.07)); g.lineTo(-bodyW * 0.38, y(xCowl)); g.moveTo(bodyW * 0.36, y(0.07)); g.lineTo(bodyW * 0.38, y(xCowl)); g.stroke();
  g.beginPath(); g.moveTo(-bodyW * 0.36, y(0.07)); g.quadraticCurveTo(0, y(0.045), bodyW * 0.36, y(0.07)); g.stroke();

  if (wide) {
    g.fillStyle = paintFill(g, paint, finish, W); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 0.03;
    for (const ax of [axF, axR]) for (const s of [-1, 1]) { rrect(g, s * (W / 2 - 0.1) - 0.1, ax - 0.55, 0.2, 1.1, 0.1); g.fill(); g.stroke(); }
  }
  if (opts.police) {
    g.fillStyle = '#0d0d0d';
    g.fillRect(-W / 2 + 0.02, y(xCowl), W - 0.04, L * (xD - xCowl));
    g.fillStyle = '#f2f2f2';
    g.fillRect(-W / 2 + 0.25, y(xA), W - 0.5, L * (xC - xA));
  }

  // ---- glass + roof ----
  const glassA = TINT[v.tint] ?? 0.62;
  const glass = (y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(40,52,68,${glassA})`); gr.addColorStop(0.5, `rgba(14,20,30,${glassA})`); gr.addColorStop(1, `rgba(10,14,22,${glassA})`); return gr; };
  const gw = bodyW * (arch === 'X' || arch === 'N' ? 0.8 : 0.84);
  const rw = bodyW * (arch === 'P' ? 0.72 : arch === 'X' ? 0.66 : 0.74);       // roof width
  const roofX0 = y(xA), roofX1 = y(xC);
  const conv = !!sh.conv;
  if (!conv) {
    // windshield
    g.fillStyle = glass(y(xCowl), y(xA));
    g.beginPath();
    g.moveTo(-gw / 2 + 0.05, y(xCowl)); g.lineTo(gw / 2 - 0.05, y(xCowl));
    g.lineTo(rw / 2 + 0.03, y(xA) + 0.02); g.lineTo(-rw / 2 - 0.03, y(xA) + 0.02); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.beginPath(); g.moveTo(-gw * 0.3, y(xCowl) + 0.04); g.lineTo(-gw * 0.04, y(xCowl) + 0.04); g.lineTo(-rw * 0.2, y(xA) - 0.03); g.lineTo(-rw * 0.42, y(xA) - 0.03); g.fill();
    // side windows
    g.fillStyle = glass(roofX0, roofX1);
    for (const s of [-1, 1]) { g.fillRect(s > 0 ? rw / 2 - 0.02 : -rw / 2 - 0.08, roofX0 + 0.18, 0.1, roofX1 - roofX0 - 0.1); }
    // roof panel
    const roofCol = opts.police ? '#f2f2f2' : paintFill(g, paint, finish, W);
    if (sh.glassRoof) {
      g.fillStyle = glass(roofX0, roofX1);
      rrect(g, -rw / 2 + 0.04, roofX0, rw - 0.08, roofX1 - roofX0 + 0.05, 0.22); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.1)'; rrect(g, -rw * 0.3, roofX0 + 0.1, rw * 0.28, roofX1 - roofX0 - 0.2, 0.1); g.fill();
    } else {
      g.fillStyle = roofCol;
      rrect(g, -rw / 2, roofX0 + 0.06, rw, roofX1 - roofX0 - 0.02, 0.24); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.03; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.14)'; rrect(g, -rw * 0.32, roofX0 + 0.14, rw * 0.3, roofX1 - roofX0 - 0.26, 0.12); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.1)'; rrect(g, rw * 0.12, roofX0 + 0.14, rw * 0.28, roofX1 - roofX0 - 0.26, 0.12); g.fill();
    }
    // rear glass
    if (arch !== 'P') {
      g.fillStyle = glass(y(xC), y(xD));
      g.beginPath();
      g.moveTo(-rw / 2 - 0.01, y(xC) + (xD - xC > 0.05 ? 0 : 0.02)); g.lineTo(rw / 2 + 0.01, y(xC));
      const rb = Math.min(gw * 0.9, bodyW * 0.7) / 2;
      g.lineTo(rb, y(Math.min(xD, 0.975))); g.lineTo(-rb, y(Math.min(xD, 0.975))); g.closePath(); g.fill();
    } else {
      g.fillStyle = glass(y(xC), y(xD));
      rrect(g, -rw * 0.38, y(xC - 0.01), rw * 0.76, L * 0.03, 0.03); g.fill();
    }
    // roof rails
    if (sh.rails) {
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(10,10,12,0.85)'; g.lineWidth = 0.05;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (rw / 2 - 0.02), roofX0 + 0.3); g.lineTo(s * (rw / 2 - 0.02), roofX1 - 0.2); g.stroke(); }
      g.strokeStyle = 'rgba(190,196,204,0.5)'; g.lineWidth = 0.02;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (rw / 2 - 0.02), roofX0 + 0.3); g.lineTo(s * (rw / 2 - 0.02), roofX1 - 0.2); g.stroke(); }
    }
  } else {
    // convertible: dark cockpit with seats, windshield frame, tonneau behind
    const cx0 = y(xA) - 0.1, cx1 = y(xC);
    g.fillStyle = '#0b0c0e'; rrect(g, -rw / 2 - 0.05, cx0, rw + 0.1, cx1 - cx0, 0.2); g.fill();
    g.fillStyle = '#26282d';
    for (const s of [-1, 1]) { rrect(g, s * rw * 0.27 - 0.2, cx0 + 0.3, 0.4, 0.6, 0.14); g.fill(); rrect(g, s * rw * 0.27 - 0.19, cx0 + 0.78, 0.38, 0.14, 0.06); g.fill(); }
    g.fillStyle = shade(paint, -0.12);
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * rw * 0.26, cx1 + 0.06, 0.26, 0.2, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = glass(y(xCowl), y(xA));
    g.beginPath(); g.moveTo(-gw / 2 + 0.05, y(xCowl)); g.lineTo(gw / 2 - 0.05, y(xCowl)); g.lineTo(rw / 2 + 0.05, y(xA) - 0.1); g.lineTo(-rw / 2 - 0.05, y(xA) - 0.1); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(8,8,10,0.9)'; g.lineWidth = 0.05; g.stroke();
  }
  // truck bed
  if (arch === 'P') {
    const b0 = y(xD + 0.015), b1 = y(0.985);
    g.fillStyle = '#1b1c1f';
    rrect(g, -bodyW / 2 + 0.15, b0, bodyW - 0.3, b1 - b0, 0.06); g.fill();
    g.fillStyle = '#26282c'; rrect(g, -bodyW / 2 + 0.28, b0 + 0.12, bodyW - 0.56, b1 - b0 - 0.2, 0.04); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 0.02;
    for (let i = 1; i < 9; i++) { const yy = lerp(b0 + 0.12, b1 - 0.08, i / 9); g.beginPath(); g.moveTo(-bodyW / 2 + 0.3, yy); g.lineTo(bodyW / 2 - 0.3, yy); g.stroke(); }
    g.fillStyle = shade(paint, -0.2); g.fillRect(-bodyW / 2 + 0.15, b1 - 0.06, bodyW - 0.3, 0.1);   // tailgate cap
  }
  // mid-engine cover: louvres and intakes
  if (arch === 'X') {
    g.fillStyle = 'rgba(0,0,0,0.55)';
    for (let i = 0; i < 6; i++) g.fillRect(-bodyW * 0.24, y(xC) + 0.2 + i * 0.12, bodyW * 0.48, 0.05);
    g.fillStyle = 'rgba(8,8,10,0.85)';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * bodyW * 0.5, y(xA)); g.lineTo(s * (bodyW * 0.5 - 0.14), y(xA) + 0.14); g.lineTo(s * (bodyW * 0.5 - 0.1), y(xC) + 0.1); g.lineTo(s * bodyW * 0.5, y(xC) + 0.12); g.fill(); }
  }

  // ---- hood ----
  const hoodMid = y(xCowl * 0.55);
  const carbonHood = v.hood === 'vented' || (lv.weight || 0) >= 2;
  const hoodW = bodyW * 0.72;
  if (carbonHood) {
    g.fillStyle = '#17181c';
    rrect(g, -hoodW / 2, y(0.05), hoodW, L * (xCowl - 0.07), 0.12); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 0.015;
    for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(i * 0.11, y(0.05)); g.lineTo(i * 0.11 + 0.2, y(xCowl - 0.02)); g.stroke(); }
  }
  if (v.hood === 'cowl') { g.fillStyle = shade(paint, 0.15); rrect(g, -0.3, y(0.08), 0.6, L * (xCowl - 0.11), 0.08); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke(); }
  if (v.hood === 'scoop' || (sh.scoop && !v.hood)) {
    g.fillStyle = shade(paint, 0.12); rrect(g, -0.28, hoodMid - 0.35, 0.56, 0.7, 0.1); g.fill();
    g.fillStyle = '#060606'; g.fillRect(-0.22, hoodMid - 0.35, 0.44, 0.12);
  }
  if (v.hood === 'vented') {
    g.fillStyle = '#050505';
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) g.fillRect(s * 0.42 - 0.18, hoodMid - 0.3 + i * 0.16, 0.36, 0.06);
  }
  if ((lv.supercharger || 0) >= 3) {
    g.fillStyle = '#c9ccd1'; rrect(g, -0.25, hoodMid - 0.42, 0.5, 0.75, 0.05); g.fill();
    g.fillStyle = '#111'; rrect(g, -0.28, hoodMid - 0.5, 0.56, 0.32, 0.06); g.fill();
    g.fillStyle = '#444'; for (let i = 0; i < 4; i++) g.fillRect(-0.24, hoodMid - 0.12 + i * 0.1, 0.48, 0.03);
  }

  // ---- graphics ----
  const dc = v.decalColor || '#f2f2f2';
  if (v.decal === 'stripes') {
    g.fillStyle = dc;
    for (const s of [-1, 1]) g.fillRect(s * 0.13 - 0.08, -L / 2 + 0.05, 0.16, L - 0.1);
    g.fillStyle = glass(y(xCowl), y(xA));
    g.fillRect(-0.3, y(xCowl), 0.6, L * (xA - xCowl));
    g.fillRect(-0.3, y(xC), 0.6, L * (Math.min(xD, 0.97) - xC));
  }
  if (v.decal === 'side' || v.decal === 'crew') {
    g.fillStyle = v.decal === 'crew' ? (opts.crewColor || dc) : dc;
    for (const s of [-1, 1]) g.fillRect(s * (bodyW / 2 - 0.08) - 0.04, y(0.06), 0.08, L * 0.88);
  }
  if (v.decal === 'number') {
    const ny = y((xA + xC) / 2);
    g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(0, ny, 0.32, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.font = 'bold 0.4px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String((v.plate || '7').replace(/\D/g, '').slice(-2) || '7'), 0, ny + 0.02);
  }
  if (v.decal === 'flames') {
    for (let i = -2; i <= 2; i++) {
      const gr = g.createLinearGradient(0, y(0.02), 0, y(xCowl));
      gr.addColorStop(0, dc); gr.addColorStop(1, 'rgba(255,190,0,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(i * 0.18 - 0.08, y(0.03)); g.quadraticCurveTo(i * 0.22, y(xCowl * 0.6), i * 0.12 + 0.05, y(xCowl + 0.04));
      g.quadraticCurveTo(i * 0.2 + 0.1, y(xCowl * 0.5), i * 0.18 + 0.08, y(0.03)); g.fill();
    }
  }

  // ---- front aero ----
  if (v.frontBumper === 'sport' || v.kit === 'street') { g.fillStyle = '#121212'; g.fillRect(-bodyW / 2 + 0.2, -L / 2 - 0.06, bodyW - 0.4, 0.08); }
  if (v.frontBumper === 'splitter') { g.fillStyle = '#1c1d22'; rrect(g, -bodyW / 2 + 0.05, -L / 2 - 0.16, bodyW - 0.1, 0.18, 0.05); g.fill(); }
  if ((lv.intercooler || 0) > 0 || (lv.turbo || 0) > 0) {
    g.fillStyle = '#9aa0a8'; g.fillRect(-bodyW * 0.3, -L / 2 + 0.02, bodyW * 0.6, 0.07);
    g.fillStyle = '#333'; for (let i = 0; i < 8; i++) g.fillRect(-bodyW * 0.3 + i * bodyW * 0.075, -L / 2 + 0.02, 0.02, 0.07);
  }
  if ((v.skirts && v.skirts !== 'none') || (v.kit && v.kit !== 'stock')) {
    g.fillStyle = v.skirts === 'aero' ? '#1c1d22' : shade(paint, -0.2);
    for (const s of [-1, 1]) g.fillRect(s * (bodyW / 2 - 0.02) - 0.04, axF + 0.4, 0.08, axR - axF - 0.8);
  }

  // ---- doors + mirrors ----
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.022;
  const doorY0 = y(xCowl + 0.02), doorY1 = y(Math.min(xC + 0.04, 0.8));
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(s * (bodyW / 2 - 0.01), doorY0); g.lineTo(s * (bodyW / 2 - 0.16), doorY0 + 0.02);
    g.moveTo(s * (bodyW / 2 - 0.01), doorY1); g.lineTo(s * (bodyW / 2 - 0.15), doorY1 - 0.01);
    if ((sh.doors ?? 4) >= 4) { const dm = (doorY0 + doorY1) / 2; g.moveTo(s * (bodyW / 2 - 0.01), dm); g.lineTo(s * (bodyW / 2 - 0.15), dm); }
    g.stroke();
  }
  g.fillStyle = opts.police ? '#0d0d0d' : shade(paint, -0.25);
  for (const s of [-1, 1]) { rrect(g, s * (bodyW / 2 + 0.06) - 0.08, y(xCowl + 0.005), 0.17, 0.11, 0.04); g.fill(); }

  // ---- lights ----
  const lightsHealth = cond?.lights ?? 100;
  const head = HEAD[v.headlights] || HEAD.halogen;
  const hk = sh.lights || 'swept';
  for (const s of [-1, 1]) {
    const broken = lightsHealth < 20 || (lightsHealth < 55 && s < 0);
    const col = broken ? '#2a2a2a' : head;
    const hx = s * (bodyW / 2 - 0.3), hy = -L / 2 + 0.17;
    g.fillStyle = '#0c0d10';
    if (hk === 'round') { g.beginPath(); g.arc(hx, hy + 0.02, 0.17, 0, Math.PI * 2); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(hx, hy + 0.02, 0.12, 0, Math.PI * 2); g.fill(); }
    else if (hk === 'slim' || hk === 'led' || hk === 'pixel' || hk === 'pill') {
      g.beginPath(); g.ellipse(hx, hy, 0.3, 0.07, s * 0.1, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.beginPath(); g.ellipse(hx - s * 0.02, hy - 0.005, 0.26, 0.04, s * 0.1, 0, Math.PI * 2); g.fill();
    } else if (hk === 'rect' || hk === 'quad') { g.fillRect(hx - 0.2, hy - 0.08, 0.4, 0.16); g.fillStyle = col; g.fillRect(hx - 0.17, hy - 0.055, 0.34, 0.11); }
    else if (hk === 'pop') { g.fillRect(hx - 0.16, hy - 0.06, 0.32, 0.12); g.fillStyle = shade(paint, -0.15); g.fillRect(hx - 0.14, hy - 0.04, 0.28, 0.08); }
    else { g.beginPath(); g.ellipse(hx, hy, 0.26, 0.1, s * 0.2, 0, Math.PI * 2); g.fill(); g.fillStyle = col; g.beginPath(); g.ellipse(hx, hy, 0.22, 0.07, s * 0.2, 0, Math.PI * 2); g.fill(); }
    if (broken) { g.strokeStyle = '#888'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(hx - 0.14, hy - 0.04); g.lineTo(hx + 0.12, hy + 0.06); g.stroke(); }
  }
  const tailCol = v.taillights === 'smoked' ? '#5a0d0d' : '#d01515';
  g.fillStyle = tailCol;
  const tk = v.taillights === 'bar' ? 'bar' : sh.tl;
  if (tk === 'bar' || tk === 'slim' || tk === 'led') g.fillRect(-bodyW / 2 + 0.15, L / 2 - 0.1, bodyW - 0.3, 0.07);
  else if (tk === 'round') for (const s of [-1, 1]) for (const dx of [0.18, 0.4]) { g.beginPath(); g.arc(s * (bodyW / 2 - dx - 0.05), L / 2 - 0.1, 0.08, 0, Math.PI * 2); g.fill(); }
  else if (tk === 'tri') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.fillRect(s * (bodyW / 2 - 0.12 - i * 0.12) - 0.04, L / 2 - 0.16, 0.08, 0.13);
  else for (const s of [-1, 1]) g.fillRect(s * (bodyW / 2 - 0.3) - 0.2, L / 2 - 0.12, 0.4, 0.09);

  // ---- rear: spoiler, diffuser, exhaust ----
  const wingMap = { lip: 'lip', duck: 'duck', gt: 'big', drag: 'huge' };
  const wing = v.spoiler && v.spoiler !== 'none' ? wingMap[v.spoiler] : (sh.wing || 'none');
  const wy = arch === 'H' || arch === 'h' || arch === 'W' || arch === 'U' || arch === 'Q' ? y(Math.min(xD, 0.97)) : L / 2;
  if (wing === 'lip') { g.fillStyle = shade(paint, -0.25); g.fillRect(-bodyW / 2 + 0.3, L / 2 - 0.3, bodyW - 0.6, 0.07); }
  if (wing === 'duck') { g.fillStyle = shade(paint, -0.15); rrect(g, -bodyW / 2 + 0.2, L / 2 - 0.35, bodyW - 0.4, 0.2, 0.06); g.fill(); }
  if (wing === 'roof') { g.fillStyle = '#0d0e11'; rrect(g, -rw / 2 + 0.05, y(xC) - 0.04, rw - 0.1, 0.16, 0.05); g.fill(); }
  if (wing === 'big' || wing === 'huge') {
    const ww = wing === 'huge' ? bodyW + 0.05 : bodyW - 0.1;
    const depth = wing === 'huge' ? 0.4 : 0.26;
    const wyy = Math.min(wy, L / 2) - (wing === 'huge' ? 0.5 : 0.45);
    g.fillStyle = wing === 'huge' ? '#1c1d22' : shade(paint, -0.2);
    rrect(g, -ww / 2, wyy, ww, depth, 0.04); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(-ww / 2 + 0.05, wyy + 0.03, ww - 0.1, 0.03);
    g.fillStyle = '#0a0a0a';
    for (const s of [-1, 1]) g.fillRect(s * ww / 2 - (s > 0 ? 0.05 : 0), wyy - 0.04, 0.05, depth + 0.08);
  }
  if (v.rearBumper === 'diffuser') { g.fillStyle = '#1c1d22'; g.fillRect(-bodyW / 2 + 0.25, L / 2, bodyW - 0.5, 0.12); g.fillStyle = '#000'; for (let i = -2; i <= 2; i++) g.fillRect(i * 0.22 - 0.01, L / 2, 0.03, 0.12); }
  if (v.rearBumper === 'sport') { g.fillStyle = '#121212'; g.fillRect(-bodyW / 2 + 0.25, L / 2 - 0.02, bodyW - 0.5, 0.08); }
  const tips = { single: [-0.55], dual: [-0.6, 0.6], quad: [-0.68, -0.52, 0.52, 0.68], cannon: [-0.38, 0.38] }[v.exhaustTips || 'single'];
  const tipR = 0.05 + (lv.exhaust || 0) * 0.008 + (v.exhaustTips === 'cannon' ? 0.04 : 0);
  for (const x of tips) {
    const tx = x * (bodyW / 2) / 0.9;
    g.fillStyle = '#1a1c20'; g.beginPath(); g.arc(tx, L / 2 + 0.03, tipR + 0.012, 0, Math.PI * 2); g.fill();
    g.fillStyle = (lv.exhaust || 0) >= 4 ? '#8a7fc0' : '#c9ccd1'; g.beginPath(); g.arc(tx, L / 2 + 0.03, tipR, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#050506'; g.beginPath(); g.arc(tx, L / 2 + 0.03, tipR * 0.5, 0, Math.PI * 2); g.fill();
  }

  // police light bar / taxi sign
  if (opts.police) {
    g.fillStyle = '#d01515'; g.fillRect(-0.55, y((xA + xC) / 2) - 0.08, 0.5, 0.16);
    g.fillStyle = '#1e5bff'; g.fillRect(0.05, y((xA + xC) / 2) - 0.08, 0.5, 0.16);
  }
  if (opts.taxi) { g.fillStyle = '#ffd23a'; rrect(g, -0.25, y((xA + xC) / 2) - 0.08, 0.5, 0.16, 0.04); g.fill(); }

  // nitrous: blue bottle visible through the rear glass
  if ((lv.nitrous || 0) > 0) { g.fillStyle = '#2b55ff'; rrect(g, -0.1, y(xC) + 0.04, 0.2, 0.35, 0.08); g.fill(); }

  // ---- damage ----
  const body = cond?.body ?? 100;
  if (body < 75) {
    g.strokeStyle = 'rgba(30,30,30,0.7)'; g.lineWidth = 0.03;
    g.beginPath(); g.moveTo(-bodyW / 2 + 0.2, -L / 2 + 0.3); g.lineTo(-bodyW / 2 + 0.5, -L / 2 + 0.12); g.lineTo(-bodyW / 2 + 0.7, -L / 2 + 0.3); g.stroke();
    g.fillStyle = 'rgba(40,36,32,0.55)'; g.beginPath(); g.ellipse(bodyW / 2 - 0.25, y(0.5), 0.12, 0.5, 0, 0, Math.PI * 2); g.fill();
  }
  if (body < 45) {
    g.fillStyle = 'rgba(40,36,32,0.65)';
    g.beginPath(); g.ellipse(-bodyW / 4, -L / 2 + 0.2, 0.45, 0.15, 0.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(bodyW / 5, L / 2 - 0.2, 0.4, 0.14, -0.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(200,200,200,0.4)'; g.lineWidth = 0.02;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-bodyW / 2 + 0.05, y(0.3 + i * 0.08)); g.lineTo(-bodyW / 2 + 0.3, y(0.33 + i * 0.08)); g.stroke(); }
  }

  const out = { canvas: c, L, W, pad, px: S };
  cache.set(key, out);
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return out;
}

// Draw a sprite centred at (x, y) in the current transform, rotated by `rot`
// (0 = facing up), at `scale` pixels per metre.
export function drawCar(ctx, sprite, x, y, rot, scale) {
  const k = scale / sprite.px;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(k, k);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sprite.canvas, -sprite.canvas.width / 2, -sprite.canvas.height / 2);
  ctx.restore();
}

// A car mid-wheelie seen from above: the nose rises toward the camera, so
// the body looks shorter (pivoting on the rear axle) and its shadow on the
// ground shows out in front. pitch 0 = flat, 1 = standing up. lenM = car length (m).
// bars: draw wheelie bars off the back.
export function drawCarPitched(ctx, sprite, x, y, rot, scale, pitch, lenM, bars = false) {
  const a = Math.min(1.4, pitch || 0) * 0.6;   // radians, ~35° at pitch 1
  if (bars) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const r = lenM / 2 * scale, w = 0.55 * scale, l = 1.5 * scale;
    ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = Math.max(1.5, 0.09 * scale);
    for (const sx of [-w, w]) { ctx.beginPath(); ctx.moveTo(sx * 0.7, r - 0.2 * scale); ctx.lineTo(sx, r + l); ctx.stroke(); }
    ctx.fillStyle = '#1a1a1a';
    for (const sx of [-w, w]) ctx.fillRect(sx - 0.12 * scale, r + l - 0.18 * scale, 0.24 * scale, 0.36 * scale);
    ctx.restore();
  }
  if (a <= 0.001) { drawCar(ctx, sprite, x, y, rot, scale); return; }
  const k = scale / sprite.px;
  const half = sprite.canvas.height / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.translate(0, half * k);          // pivot on the rear
  ctx.scale(k * (1 + 0.12 * Math.sin(a)), k * Math.cos(a));
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sprite.canvas, -sprite.canvas.width / 2, -sprite.canvas.height);
  ctx.restore();
}

export function caliperColor(level) { return CALIPER_COLORS[level] || '#3a3a3a'; }
