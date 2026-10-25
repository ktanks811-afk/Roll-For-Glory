// Bikes, trikes, the Slingshot and 4-wheelers, drawn procedurally like the
// cars: a top-down world sprite (facing up, length along y, metres) and a
// side view for the showroom (facing left). Sizes and axle spots come from
// the ride's design sheet in data/carShapes.js; paint, wheel colour, decals,
// underglow and damage come from the visual like any car.
//
// The rider isn't in the sprite: the world draws you on top when you're on
// it (world2d/world.js), so a parked bike is just a bike.

import { shapeOf } from '../data/carShapes.js';
import { CALIPER_COLORS } from '../data/parts.js';
import { CLOTH_BY_ID } from '../data/shops.js';
import { drawHairTop } from './hair.js';

const lerp = (a, b, t) => a + (b - a) * t;

function shade(hex, amt) {
  let c = String(hex || '#888888').replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c, 16) || 0x888888;
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((f - r) * p + r); g = Math.round((f - g) * p + g); b = Math.round((f - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

function rrect(g, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  g.beginPath();
  g.moveTo(x + rr, y); g.lineTo(x + w - rr, y); g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr); g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h); g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr); g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

// smooth closed outline through points
function blob(g, pts) {
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  g.beginPath(); g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], m = mid(p, pts[(i + 1) % n]); g.quadraticCurveTo(p[0], p[1], m[0], m[1]); }
  g.closePath();
}
// mirror half-outline [x, y] (x >= 0) into a closed left-right shape
const sym = half => [...half, ...half.slice().reverse().map(([x, y]) => [-x, y])];

function paintGrad(g, paint, finish, w) {
  const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
  if (finish === 'chrome') {
    gr.addColorStop(0, shade(paint, -0.3)); gr.addColorStop(0.3, shade(paint, 0.75)); gr.addColorStop(0.5, shade(paint, 0.2));
    gr.addColorStop(0.7, shade(paint, 0.8)); gr.addColorStop(1, shade(paint, -0.35));
    return gr;
  }
  const hi = finish === 'matte' ? 0.05 : finish === 'metallic' ? 0.3 : finish === 'pearl' ? 0.36 : 0.2;
  gr.addColorStop(0, shade(paint, -0.32)); gr.addColorStop(0.35, shade(paint, hi)); gr.addColorStop(0.55, shade(paint, hi * 0.4)); gr.addColorStop(1, shade(paint, -0.36));
  return gr;
}

const CHROME = (g, w) => { const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, '#5d6168'); gr.addColorStop(0.4, '#f4f6f8'); gr.addColorStop(1, '#6a6e75'); return gr; };

// ------------------------------------------------------------------ top view
const PX = 40;          // sprite pixels per metre: rides are small, so draw them finer
const cache = new Map();

function tire(g, x, y, w, l, knobby) {
  g.fillStyle = '#141414'; rrect(g, x - w / 2, y - l / 2, w, l, Math.min(w, l) * 0.35); g.fill();
  g.fillStyle = '#2a2a2a';
  if (knobby) for (let k = 1; k < 7; k++) g.fillRect(x - w / 2 + 0.02, y - l / 2 + l * k / 7 - 0.015, w - 0.04, 0.03);
  else g.fillRect(x - w * 0.12, y - l * 0.42, w * 0.24, l * 0.84);
}

// One sprite per ride + visual + damage, cached. Same shape as carSprite's.
export function rideSprite(model, v = {}, cond = null) {
  const sh = shapeOf(model);
  const dmg = cond ? Math.round((cond.body ?? 100) / 25) : 4;
  const key = JSON.stringify([model.id, v.paint, v.finish, v.wheelColor, v.decal, v.decalColor, v.neon, dmg]);
  if (cache.has(key)) return cache.get(key);
  const { L, W } = sh, pad = 0.6;
  const c = document.createElement('canvas');
  c.width = Math.ceil((W + pad * 2) * PX); c.height = Math.ceil((L + pad * 2) * PX);
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2); g.scale(PX, PX);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const paint = v.paint || model.color || '#888888', fin = v.finish || 'gloss';
  const yF = -L / 2 + sh.fo, yR = yF + sh.WB;
  const P = () => paintGrad(g, paint, fin, W);
  if (v.neon && v.neon !== 'none') {
    const gr = g.createRadialGradient(0, 0, 0.1, 0, 0, L * 0.6); gr.addColorStop(0, v.neon); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.55; g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, W * 0.7, L * 0.6, 0, 0, 7); g.fill(); g.globalAlpha = 1;
  }
  const kind = model.ride;
  if (kind === 'moto') topMoto(g, sh, P, paint, v, yF, yR);
  else if (kind === 'trike') topTrike(g, sh, P, paint, v, yF, yR);
  else if (kind === 'spyder') topSpyder(g, sh, P, paint, v, yF, yR);
  else if (kind === 'sling') topSling(g, sh, P, paint, v, yF, yR);
  else topAtv(g, sh, P, paint, v, yF, yR);
  // scuffs and a cracked fairing when it's been down
  if (dmg <= 2) {
    g.strokeStyle = 'rgba(30,30,30,0.6)'; g.lineWidth = 0.025;
    for (let k = 0; k < 4 - dmg; k++) { const y = lerp(yF, yR, 0.2 + k * 0.2); g.beginPath(); g.moveTo(-W * 0.2, y); g.lineTo(W * 0.15, y + 0.12); g.stroke(); }
  }
  const out = { canvas: c, L, W, pad, px: PX };
  cache.set(key, out);
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return out;
}

function bars(g, y, half, chrome) {
  g.strokeStyle = chrome ? '#d8dce0' : '#151515'; g.lineWidth = 0.035;
  g.beginPath(); g.moveTo(-half, y + 0.04); g.quadraticCurveTo(0, y - 0.05, half, y + 0.04); g.stroke();
  g.fillStyle = '#0c0c0c'; for (const s of [-1, 1]) { rrect(g, s * half - 0.06, y + 0.0, 0.12, 0.07, 0.02); g.fill(); }
  g.fillStyle = '#9aa0a8'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * (half + 0.05), y - 0.06, 0.035, 0, 7); g.fill(); }   // mirrors
}

function stripe(g, v, x, y0, y1, w) {
  if (!v.decal || v.decal === 'none') return;
  g.fillStyle = v.decalColor || '#f2f2f2';
  if (v.decal === 'stripes') { g.fillRect(x - w * 0.12, y0, w * 0.08, y1 - y0); g.fillRect(x + w * 0.04, y0, w * 0.08, y1 - y0); }
  else if (v.decal === 'flames') { g.fillStyle = '#ff8a1a'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * w * 0.42, y0); g.lineTo(s * w * 0.2, lerp(y0, y1, 0.6)); g.lineTo(s * w * 0.38, lerp(y0, y1, 0.4)); g.lineTo(s * w * 0.1, y1); g.lineTo(s * w * 0.45, lerp(y0, y1, 0.7)); g.closePath(); g.fill(); } }
  else { g.globalAlpha = 0.85; g.fillRect(x - w * 0.4, lerp(y0, y1, 0.45), w * 0.8, (y1 - y0) * 0.1); g.globalAlpha = 1; }
}

function topMoto(g, sh, P, paint, v, yF, yR) {
  const { L, W } = sh, st = sh.style;
  const sport = st === 'sport', bag = st === 'bagger' || st === 'club';
  const rw = sport ? 0.19 : 0.2, fw = sport ? 0.12 : 0.13;
  // exhaust under everything: sport can on the right, Harley pipes down both sides
  g.fillStyle = CHROME(g, 0.2);
  if (sport) { rrect(g, 0.08, yR - 0.62, 0.12, 0.42, 0.05); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.ellipse(0.14, yR - 0.2, 0.05, 0.03, 0, 0, 7); g.fill(); }
  else { for (const x of [0.2, 0.27]) { rrect(g, x - 0.035, yR - 0.95, 0.07, 1.05, 0.03); g.fill(); } if (!bag) { rrect(g, -0.27, yR - 0.5, 0.07, 0.6, 0.03); g.fill(); } }
  tire(g, 0, yR, rw, sh.tr * 2, false);
  tire(g, 0, yF, fw, sh.tr * 2, false);
  // swingarm and forks
  g.fillStyle = sport ? '#3a3d42' : '#c8ccd0';
  for (const s of [-1, 1]) { g.fillRect(s * 0.1 - 0.02, yR - 0.55, 0.04, 0.55); g.fillRect(s * 0.085 - 0.018, yF - 0.05, 0.036, 0.42); }
  if (bag) {
    // saddlebags either side of the back wheel, the batwing up front
    g.fillStyle = P();
    for (const s of [-1, 1]) { rrect(g, s > 0 ? 0.12 : -0.12 - (W * 0.5 - 0.12), yR - 0.32, W * 0.5 - 0.12, 0.62, 0.1); g.fill(); }
    g.fillStyle = shade(paint, -0.25); g.fillRect(-0.11, yR - 0.1, 0.22, 0.5);    // rear fender
    blob(g, sym([[0.06, yF + 0.02], [W * 0.42, yF + 0.12], [W * 0.46, yF + 0.3], [0.1, yF + 0.36]]));
    g.fill();
    g.fillStyle = 'rgba(140,170,190,0.55)'; blob(g, sym([[0.05, yF + 0.07], [W * 0.3, yF + 0.13], [W * 0.3, yF + 0.2], [0.05, yF + 0.18]])); g.fill();   // screen
  }
  // body: tank + tail (sport) or tank + fender (cruiser)
  g.fillStyle = P();
  if (sport) {
    blob(g, sym([[0.03, -L / 2 + 0.02], [W * 0.22, yF + 0.12], [W * 0.36, yF + 0.34], [W * 0.3, yF + 0.62], [0.16, yF + 0.82], [0.12, yR - 0.15], [0.06, L / 2 - 0.12], [0.02, L / 2 - 0.05]]));
    g.fill();
    if (sh.wings) { g.fillStyle = shade(paint, -0.4); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * W * 0.2, yF + 0.16); g.lineTo(s * W * 0.44, yF + 0.22); g.lineTo(s * W * 0.22, yF + 0.27); g.closePath(); g.fill(); } }
    g.fillStyle = 'rgba(110,140,160,0.7)'; blob(g, sym([[0.03, yF + 0.1], [W * 0.17, yF + 0.2], [W * 0.15, yF + 0.3], [0.03, yF + 0.32]])); g.fill();   // bubble
    g.fillStyle = '#121212'; rrect(g, -0.13, yF + 0.82, 0.26, yR - yF - 0.88, 0.1); g.fill();   // seat
    stripe(g, v, 0, yF + 0.4, yF + 0.78, W * 0.5);
  } else {
    g.fillStyle = shade(paint, -0.2);
    if (!bag) { rrect(g, -0.13, yR - 0.15, 0.26, L / 2 - yR + 0.1, 0.1); g.fill(); rrect(g, -0.1, yF - 0.3, 0.2, 0.48, 0.08); g.fill(); }
    g.fillStyle = P(); g.beginPath(); g.ellipse(0, yF + 0.6, W * 0.2, 0.3, 0, 0, 7); g.fill();     // tank
    stripe(g, v, 0, yF + 0.36, yF + 0.84, W * 0.36);
    g.fillStyle = '#d8dce0'; g.beginPath(); g.ellipse(0, yF + 0.6, 0.05, 0.1, 0, 0, 7); g.fill();    // dash / cap
    g.fillStyle = '#151210'; rrect(g, -0.17, yF + 0.88, 0.34, 0.5, 0.14); g.fill();                    // seat
    // V-twin heads poking out each side
    g.fillStyle = '#c8ccd0'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 0.2, yF + 0.72, 0.07, 0.11, 0, 0, 7); g.fill(); }
  }
  bars(g, yF + (bag ? 0.4 : sport ? 0.36 : 0.28), sport ? W * 0.38 : W * 0.47, !sport);
  g.fillStyle = '#fff6d0'; g.beginPath(); g.ellipse(0, -L / 2 + 0.06, 0.07, 0.04, 0, 0, 7); g.fill();
  g.fillStyle = '#c4141c'; g.fillRect(-0.06, L / 2 - 0.07, 0.12, 0.04);
}

function topTrike(g, sh, P, paint, v, yF, yR) {
  const { L, W } = sh;
  for (const s of [-1, 1]) tire(g, s * (W / 2 - 0.13), yR, 0.22, sh.tr * 2, false);
  tire(g, 0, yF, 0.13, sh.tr * 2, false);
  g.fillStyle = '#c8ccd0'; for (const s of [-1, 1]) g.fillRect(s * 0.085 - 0.018, yF - 0.05, 0.036, 0.42);
  // the wide back end and its trunk
  g.fillStyle = P();
  blob(g, sym([[0.1, yR - 0.62], [W * 0.36, yR - 0.4], [W * 0.38, yR + 0.25], [W * 0.3, L / 2 - 0.04], [0.05, L / 2]]));
  g.fill();
  g.fillStyle = shade(paint, -0.2); rrect(g, -W * 0.18, yR - 0.05, W * 0.36, 0.42, 0.08); g.fill();
  g.fillStyle = '#c4141c'; for (const s of [-1, 1]) g.fillRect(s * W * 0.3 - 0.07, L / 2 - 0.12, 0.14, 0.05);
  g.fillStyle = P();
  blob(g, sym([[0.06, yF + 0.02], [W * 0.3, yF + 0.12], [W * 0.32, yF + 0.3], [0.1, yF + 0.36]])); g.fill();
  g.fillStyle = 'rgba(140,170,190,0.55)'; blob(g, sym([[0.05, yF + 0.07], [W * 0.2, yF + 0.13], [W * 0.2, yF + 0.2], [0.05, yF + 0.18]])); g.fill();
  g.beginPath(); g.ellipse(0, yF + 0.62, 0.17, 0.28, 0, 0, 7); g.fillStyle = P(); g.fill();
  stripe(g, v, 0, yF + 0.4, yF + 0.84, 0.34);
  g.fillStyle = '#151210'; rrect(g, -0.18, yF + 0.88, 0.36, 0.62, 0.14); g.fill();
  bars(g, yF + 0.42, 0.45, true);
  g.fillStyle = '#fff6d0'; g.beginPath(); g.ellipse(0, -L / 2 + 0.06, 0.07, 0.04, 0, 0, 7); g.fill();
}

function topSpyder(g, sh, P, paint, v, yF, yR) {
  const { L, W } = sh;
  for (const s of [-1, 1]) tire(g, s * (W / 2 - 0.12), yF, 0.2, sh.tr * 2, false);
  tire(g, 0, yR, 0.22, sh.tr * 2, false);
  g.fillStyle = '#3a3d42'; for (const s of [-1, 1]) { g.save(); g.translate(s * W * 0.22, yF); g.rotate(s * 0.15); g.fillRect(-W * 0.18, -0.03, W * 0.36, 0.06); g.restore(); }   // A-arms
  // the Y-shaped front: a wide nose that comes back to a bike's tank
  g.fillStyle = P();
  blob(g, sym([[0.12, -L / 2 + 0.03], [W * 0.3, -L / 2 + 0.12], [W * 0.5, yF - 0.18], [W * 0.5, yF + 0.16], [W * 0.2, yF + 0.5], [0.16, yF + 0.9], [0.14, yR - 0.2], [0.06, L / 2 - 0.04]]));
  g.fill();
  g.fillStyle = shade(paint, -0.35); for (const s of [-1, 1]) { rrect(g, s * (W / 2 - 0.12) - 0.12, yF - 0.32, 0.24, 0.24, 0.08); g.fill(); }   // front fenders
  if (sh.style === 'touring') { g.fillStyle = P(); for (const s of [-1, 1]) { rrect(g, s > 0 ? 0.12 : -0.42, yR - 0.4, 0.3, 0.55, 0.1); g.fill(); } g.fillStyle = 'rgba(140,170,190,0.55)'; blob(g, sym([[0.05, yF + 0.3], [W * 0.18, yF + 0.36], [W * 0.18, yF + 0.44], [0.05, yF + 0.44]])); g.fill(); }
  stripe(g, v, 0, yF + 0.5, yF + 0.9, 0.36);
  g.fillStyle = '#121212'; rrect(g, -0.16, yF + 0.95, 0.32, yR - yF - 0.95, 0.12); g.fill();
  bars(g, yF + 0.62, 0.36, false);
  g.fillStyle = '#e9f2ff'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * W * 0.22, -L / 2 + 0.12, 0.09, 0.03, s * 0.3, 0, 7); g.fill(); }
  g.fillStyle = '#c4141c'; g.fillRect(-0.08, L / 2 - 0.08, 0.16, 0.04);
}

function topSling(g, sh, P, paint, v, yF, yR) {
  const { L, W } = sh;
  // open front wheels on A-arms with fenders over them
  for (const s of [-1, 1]) tire(g, s * (W / 2 - 0.13), yF, 0.24, sh.tr * 2, false);
  g.fillStyle = '#2d3036'; for (const s of [-1, 1]) g.fillRect(Math.min(0, s) * W * 0.4 + (s > 0 ? W * 0.05 : 0), yF - 0.04, W * 0.35, 0.08);
  tire(g, 0, yR, 0.3, sh.tr * 2, false);
  g.fillStyle = '#3a3d42'; for (const s of [-1, 1]) g.fillRect(s * 0.17 - 0.03, yR - 0.9, 0.06, 0.9);   // swingarm
  // a long pointed nose that opens into the two-seat tub
  g.fillStyle = P();
  blob(g, sym([[0.1, -L / 2 + 0.02], [W * 0.2, -L / 2 + 0.35], [W * 0.27, yF + 0.2], [W * 0.33, yF + 0.9], [W * 0.33, yF + 1.7], [W * 0.24, yR - 0.55], [0.12, yR - 0.35]]));
  g.fill();
  g.fillStyle = shade(paint, -0.35); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * (W / 2 - 0.13), yF - 0.02, 0.17, 0.4, 0, Math.PI, 0); g.fill(); }
  // hood vents and the stripe
  stripe(g, v, 0, -L / 2 + 0.3, yF + 0.7, W * 0.4);
  g.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 4; k++) g.fillRect(-W * 0.12, yF + 0.2 + k * 0.1, W * 0.24, 0.035);
  // cockpit: tub, two seats, the roll hoops
  g.fillStyle = '#18191c'; rrect(g, -W * 0.3, yF + 0.95, W * 0.6, 1.0, 0.16); g.fill();
  g.fillStyle = '#0c0c0c'; for (const s of [-1, 1]) { rrect(g, s * W * 0.14 - 0.2, yF + 1.35, 0.4, 0.55, 0.12); g.fill(); }
  g.fillStyle = '#4a4d52'; g.beginPath(); g.arc(-W * 0.14, yF + 1.12, 0.12, 0, 7); g.fill();   // wheel
  g.strokeStyle = '#c8ccd0'; g.lineWidth = 0.06; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * W * 0.14 - 0.2, yF + 1.95); g.lineTo(s * W * 0.14 + 0.2, yF + 1.95); g.stroke(); }
  if (sh.wing) { g.fillStyle = '#121316'; g.fillRect(-W * 0.24, yR - 0.48, W * 0.48, 0.08); }
  g.fillStyle = '#e9f2ff'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * W * 0.16, -L / 2 + 0.26, 0.05, 0.12, s * -0.4, 0, 7); g.fill(); }
  g.fillStyle = '#c4141c'; for (const s of [-1, 1]) g.fillRect(s * 0.2 - 0.05, yR - 0.4, 0.1, 0.04);
}

function topAtv(g, sh, P, paint, v, yF, yR) {
  const { L, W } = sh, util = sh.style === 'utility';
  for (const y of [yF, yR]) for (const s of [-1, 1]) tire(g, s * (W / 2 - 0.13), y, 0.25, sh.tr * 2, true);
  g.fillStyle = '#2d3036'; g.fillRect(-W * 0.4, yF - 0.03, W * 0.8, 0.06); g.fillRect(-W * 0.4, yR - 0.03, W * 0.8, 0.06);
  // plastics: front and rear fenders joined by the footwells
  g.fillStyle = P();
  blob(g, sym([[0.14, -L / 2 + 0.06], [W * 0.46, yF - 0.28], [W * 0.5, yF + 0.22], [W * 0.26, yF + 0.42], [W * 0.26, yR - 0.4], [W * 0.5, yR - 0.24], [W * 0.48, yR + 0.25], [0.14, L / 2 - 0.04]]));
  g.fill();
  g.fillStyle = shade(paint, -0.28); for (const s of [-1, 1]) g.fillRect(s * W * 0.27 - (s > 0 ? 0 : W * 0.12), yF + 0.38, W * 0.12, yR - yF - 0.76);   // footwells
  if (util || sh.racks) {
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 0.035;
    for (const [y0, y1] of [[-L / 2 + 0.1, yF + 0.12], [yR - 0.12, L / 2 - 0.08]]) { rrect(g, -W * 0.34, y0, W * 0.68, y1 - y0, 0.04); g.stroke(); for (let k = 1; k < 4; k++) { const y = lerp(y0, y1, k / 4); g.beginPath(); g.moveTo(-W * 0.34, y); g.lineTo(W * 0.34, y); g.stroke(); } }
  }
  stripe(g, v, 0, yF + 0.2, yF + 0.45, W * 0.4);
  g.fillStyle = '#141414'; rrect(g, -0.14, yF + 0.45, 0.28, yR - yF - 0.55, 0.1); g.fill();
  bars(g, yF + 0.3, W * 0.38, false);
  g.fillStyle = '#e9f2ff'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * W * 0.15, -L / 2 + 0.1, 0.06, 0.03, 0, 0, 7); g.fill(); }
  g.fillStyle = '#c4141c'; for (const s of [-1, 1]) g.fillRect(s * W * 0.2 - 0.04, L / 2 - 0.07, 0.08, 0.04);
}

// Where the rider sits (metres from the middle, + = toward the back), and
// whether they sit side by side (Slingshot) or on top (everything else).
export function riderSeat(model) {
  const sh = shapeOf(model), yF = -sh.L / 2 + sh.fo;
  if (model.ride === 'sling') return { x: -sh.W * 0.14, y: yF + 1.5, seated: true };
  if (model.ride === 'atv') return { x: 0, y: yF + 0.62, seated: false };
  if (model.ride === 'spyder') return { x: 0, y: yF + 1.05, seated: false };
  return { x: 0, y: yF + (sh.style === 'sport' ? 0.85 : 0.98), seated: false };
}

// ------------------------------------------------------------------ side view
// Drawn into the showroom canvas (same space as drawSideCar: 1983x793 scaled
// to the canvas, ground at y 700), nose on the left.
export function drawSideRide(canvas, opts, { SW, SH, REF_W, GROUND, K }) {
  const model = opts.model, v = opts.visual || {}, lv = opts.levels || {};
  const sh = shapeOf(model);
  canvas.width = SW; canvas.height = SH;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, SW, SH);
  g.save(); g.scale(K, K);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const { L, H } = sh;
  const ppm = Math.min(1500 / L, 560 / H);
  const ox = (REF_W - L * ppm) / 2;
  const X = m => ox + m * ppm, Y = m => GROUND - m * ppm;
  const R = sh.tr * ppm, fx = X(sh.fo), rx = X(sh.fo + sh.WB), cy = GROUND - R;
  const paint = v.paint || model.color || '#888888';
  const pg = () => { const gr = g.createLinearGradient(0, Y(H), 0, Y(0.3)); const hi = v.finish === 'matte' ? 0.04 : 0.28; gr.addColorStop(0, shade(paint, hi)); gr.addColorStop(0.5, paint); gr.addColorStop(1, shade(paint, -0.35)); return v.finish === 'chrome' ? CHROME(g, 2000) : gr; };
  const fill = (pts, f) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.closePath(); g.fillStyle = f; g.fill(); };
  const smoothFill = (pts, f) => { blob(g, pts.map(([x, y]) => [X(x), Y(y)])); g.fillStyle = f; g.fill(); };
  const line = (pts, w, c) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.lineWidth = w * ppm; g.strokeStyle = c; g.stroke(); };
  const caliper = CALIPER_COLORS[Math.min(4, lv.brakes || 0)] || '#3a3a3a';
  const kind = model.ride, st = sh.style;
  const a = sh.fo, b = sh.fo + sh.WB, r = sh.tr;   // axle x (m) and tyre radius
  // shadow + underglow
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse((X(0) + X(L)) / 2, GROUND + 6, L * ppm * 0.5, 18, 0, 0, 7); g.fill();
  if (v.neon && v.neon !== 'none') { const gr = g.createRadialGradient(X(L / 2), GROUND, 10, X(L / 2), GROUND, L * ppm * 0.5); gr.addColorStop(0, v.neon); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.5; g.fillStyle = gr; g.beginPath(); g.ellipse(X(L / 2), GROUND, L * ppm * 0.5, 60, 0, 0, 7); g.fill(); g.globalAlpha = 1; }

  const wheel = (cx, kindW) => {
    const knob = kindW === 'knob';
    g.fillStyle = '#121212'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    if (knob) { g.fillStyle = '#1f1f1f'; for (let k = 0; k < 18; k++) { const t = k / 18 * Math.PI * 2; g.save(); g.translate(cx + Math.cos(t) * R * 0.94, cy + Math.sin(t) * R * 0.94); g.rotate(t); g.fillRect(-R * 0.06, -R * 0.09, R * 0.12, R * 0.18); g.restore(); } }
    const rimR = R * (knob ? 0.55 : kindW === 'car' ? 0.66 : 0.72);
    const rimC = v.wheelColor || (st === 'cruiser' || st === 'bagger' || st === 'club' ? '#d8dce0' : '#24262b');
    g.fillStyle = shade(rimC, -0.25); g.beginPath(); g.arc(cx, cy, rimR, 0, 7); g.fill();
    g.fillStyle = '#0d0d0d'; g.beginPath(); g.arc(cx, cy, rimR * 0.9, 0, 7); g.fill();
    g.strokeStyle = rimC;
    if (kindW === 'wire') { g.lineWidth = 2.2; for (let k = 0; k < 40; k++) { const t = k / 40 * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(t) * rimR * 0.14, cy + Math.sin(t) * rimR * 0.14); g.lineTo(cx + Math.cos(t + 0.5) * rimR * 0.9, cy + Math.sin(t + 0.5) * rimR * 0.9); g.stroke(); } }
    else { g.lineWidth = rimR * 0.11; const n = knob ? 5 : kindW === 'car' ? 6 : 3; for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2 + 0.3; for (const d of [-0.12, 0.12]) { g.beginPath(); g.moveTo(cx + Math.cos(t) * rimR * 0.2, cy + Math.sin(t) * rimR * 0.2); g.lineTo(cx + Math.cos(t + d) * rimR * 0.9, cy + Math.sin(t + d) * rimR * 0.9); g.stroke(); } } }
    if (!knob) { g.strokeStyle = '#b8bcc2'; g.lineWidth = rimR * 0.08; g.beginPath(); g.arc(cx, cy, rimR * 0.52, 0, 7); g.stroke(); }
    g.fillStyle = caliper; g.fillRect(cx - rimR * 0.62, cy - rimR * 0.58, rimR * 0.24, rimR * 0.34);
    g.fillStyle = '#9aa0a8'; g.beginPath(); g.arc(cx, cy, rimR * 0.12, 0, 7); g.fill();
  };

  if (kind === 'moto' || kind === 'trike' || kind === 'spyder') {
    const sport = st === 'sport' && kind !== 'trike';
    const big = !sport;
    // swingarm, engine, exhaust behind the bodywork
    line([[b, r], [b - 0.55, r + 0.15]], 0.06, sport ? '#2f3237' : '#c8ccd0');
    if (sport) {
      smoothFill([[a + 0.42, r + 0.02], [a + 0.92, r - 0.04], [a + 1.0, r + 0.3], [a + 0.6, r + 0.42], [a + 0.36, r + 0.3]], '#1d1f23');
      line([[a + 0.5, r - 0.1], [b - 0.3, r - 0.05], [b - 0.12, r + 0.2]], 0.07, '#9aa0a8');
      smoothFill([[b - 0.5, r + 0.08], [b - 0.1, r + 0.24], [b - 0.08, r + 0.33], [b - 0.5, r + 0.2]], '#c8ccd0');
    } else {
      // the V-twin: two chrome jugs in a V, pipes running back under the bags
      smoothFill([[a + 0.48, r - 0.02], [a + 0.98, r - 0.05], [a + 1.02, r + 0.16], [a + 0.5, r + 0.18]], '#2a2c30');
      for (const [x, t] of [[a + 0.66, -0.4], [a + 0.84, 0.4]]) { g.save(); g.translate(X(x), Y(r + 0.16)); g.rotate(t); g.fillStyle = '#b8bcc2'; g.fillRect(-0.065 * ppm, -0.24 * ppm, 0.13 * ppm, 0.22 * ppm); g.fillStyle = '#6a6e75'; for (let k = 0; k < 5; k++) g.fillRect(-0.08 * ppm, -0.22 * ppm + k * 0.04 * ppm, 0.16 * ppm, 0.015 * ppm); g.fillStyle = '#e4e8ec'; g.fillRect(-0.07 * ppm, -0.27 * ppm, 0.14 * ppm, 0.04 * ppm); g.restore(); }
      line([[a + 0.6, r + 0.12], [a + 0.75, r - 0.12], [b + 0.35, r - 0.04]], 0.075, '#d8dce0');
      line([[a + 0.86, r + 0.14], [a + 1.0, r - 0.02], [b + 0.35, r + 0.07]], 0.075, '#e4e8ec');
    }
    wheel(rx, big ? (st === 'cruiser' ? 'car' : 'car') : 'cast');
    if (kind !== 'spyder') wheel(fx, st === 'cruiser' ? 'wire' : big ? 'car' : 'cast');
    else { wheel(fx, 'car'); }
    // forks (gold USD on a sportbike, chrome on a Harley)
    if (kind !== 'spyder') line([[a, r], [a + (sport ? 0.2 : 0.3), r + (sport ? 0.62 : 0.7)]], sport ? 0.05 : 0.055, sport ? '#d4a017' : '#d8dce0');
    // bodywork
    if (sport) {
      smoothFill([[a - 0.08, 0.62], [a + 0.05, 0.92], [a + 0.25, 1.06], [a + 0.42, 1.02], [a + 0.7, 0.98], [a + 1.0, 0.9], [b - 0.05, 0.96], [L, 1.02], [L - 0.05, 0.92], [b - 0.3, 0.74], [a + 0.95, 0.5], [a + 0.6, 0.36], [a + 0.15, 0.46]], pg());
      smoothFill([[a + 0.05, 0.98], [a + 0.25, 1.12], [a + 0.36, 1.06], [a + 0.2, 0.96]], 'rgba(120,150,170,0.8)');   // screen
      fill([[a + 0.8, 0.94], [b - 0.25, 0.9], [b - 0.15, 0.95], [a + 0.82, 0.99]], '#121212');                        // seat
      if (sh.wings) smoothFill([[a + 0.08, 0.72], [a + 0.32, 0.74], [a + 0.12, 0.66]], shade(paint, -0.45));
      g.fillStyle = '#fff6d0'; g.beginPath(); g.ellipse(X(a - 0.04), Y(0.8), 0.05 * ppm, 0.025 * ppm, -0.4, 0, 7); g.fill();
    } else {
      const bag = st === 'bagger' || st === 'club' || st === 'touring';
      // rear fender over the back wheel (or the trike's wide body)
      if (kind === 'trike') smoothFill([[b - 0.62, r + 0.42], [b - 0.2, r + 0.62], [L - 0.02, r + 0.55], [L, r + 0.2], [b + 0.1, r + 0.02], [b - 0.5, r + 0.15]], pg());
      else smoothFill([[b - 0.5, r + 0.25], [b - 0.1, 2 * r + 0.06], [b + 0.3, 2 * r - 0.02], [L, r + 0.25], [b + 0.2, r + 0.12]], pg());
      if (bag && kind === 'moto') smoothFill([[b - 0.48, r + 0.1], [b - 0.45, r + 0.42], [b + 0.32, r + 0.44], [b + 0.4, r + 0.1]], pg());
      // tank, seat, the front fender
      smoothFill([[a + 0.42, 0.74], [a + 0.55, 0.94], [a + 0.98, 0.92], [a + 1.06, 0.76], [a + 0.6, 0.64]], pg());
      fill([[a + 1.0, 0.8], [b - 0.25, 0.7], [b - 0.05, 0.74], [b + 0.05, 0.82], [a + 1.0, 0.86]], '#151210');
      if (kind === 'spyder') smoothFill([[0.02, 0.4], [0.05, 0.62], [a + 0.5, 0.86], [a + 0.75, 0.78], [a + 0.5, 0.4], [a + 0.2, 0.2], [-0.02, 0.3]], pg());
      else smoothFill([[a - 0.28, r + 0.05], [a - 0.05, 2 * r + 0.04], [a + 0.2, 2 * r - 0.02], [a + 0.02, r + 0.2]], pg());
      if (st === 'club') smoothFill([[a + 0.16, 0.76], [a + 0.2, 0.98], [a + 0.34, 1.02], [a + 0.4, 0.8]], pg());
      if (st === 'bagger') {
        // batwing fairing + windshield
        smoothFill([[a + 0.12, 0.72], [a + 0.18, 1.04], [a + 0.36, 1.12], [a + 0.5, 0.98], [a + 0.42, 0.72]], pg());
        smoothFill([[a + 0.2, 1.04], [a + 0.3, 1.24], [a + 0.36, 1.12]], 'rgba(150,175,195,0.75)');
      }
      line([[a + 0.4, 1.0], [a + 0.58, 1.1], [a + 0.7, 1.06]], 0.03, '#d8dce0');   // bars
      g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(X(kind === 'spyder' ? 0.05 : a + 0.15), Y(kind === 'spyder' ? 0.52 : 0.82), 0.05 * ppm, 0, 7); g.fill();
    }
    if (v.decal && v.decal !== 'none') { g.fillStyle = v.decalColor || '#f2f2f2'; fill([[a + 0.55, sport ? 0.86 : 0.82], [a + 0.98, sport ? 0.84 : 0.8], [a + 0.98, sport ? 0.8 : 0.77], [a + 0.55, sport ? 0.82 : 0.79]], v.decalColor || '#f2f2f2'); }
    g.fillStyle = '#c4141c'; g.fillRect(X(L - 0.06), Y(kind === 'trike' ? r + 0.48 : sport ? 0.98 : r + 0.36), 0.06 * ppm, 0.03 * ppm);
  } else if (kind === 'sling') {
    line([[b, r], [b - 0.9, r + 0.12]], 0.07, '#2f3237');
    wheel(rx, 'car');
    smoothFill([[0.0, 0.42], [0.25, 0.62], [a + 0.6, 0.78], [a + 1.25, 0.86], [a + 1.6, 0.78], [b - 0.55, 0.9], [b - 0.2, 0.8], [b - 0.3, 0.42], [a + 1.3, 0.28], [a + 0.5, 0.3], [0.1, 0.24]], pg());
    smoothFill([[a + 1.3, 0.84], [a + 1.48, 1.18], [a + 1.62, 1.16], [a + 1.55, 0.8]], '#0c0c0c');   // seat back
    line([[a + 1.62, 0.84], [a + 1.72, 1.28], [a + 1.86, 1.28], [a + 1.9, 0.86]], 0.05, '#c8ccd0');  // roll hoop
    smoothFill([[a + 0.95, 0.86], [a + 1.05, 1.0], [a + 1.12, 0.86]], 'rgba(120,150,170,0.8)');
    wheel(fx, 'car');
    smoothFill([[a - 0.42, r + 0.08], [a - 0.1, 2 * r + 0.1], [a + 0.32, 2 * r + 0.02], [a + 0.36, r + 0.2]], shade(paint, -0.3));   // fender
    if (v.decal && v.decal !== 'none') fill([[0.2, 0.56], [a + 1.2, 0.74], [a + 1.2, 0.7], [0.2, 0.52]], v.decalColor || '#f2f2f2');
    if (sh.wing) fill([[b - 0.6, 0.92], [b - 0.2, 0.9], [b - 0.2, 0.86], [b - 0.6, 0.88]], '#121316');
    g.fillStyle = '#e9f2ff'; g.beginPath(); g.ellipse(X(0.12), Y(0.45), 0.08 * ppm, 0.025 * ppm, -0.3, 0, 7); g.fill();
  } else {
    // 4-wheeler: knobby tyres, plastics over both, racks, the seat on top
    wheel(rx, 'knob'); wheel(fx, 'knob');
    smoothFill([[a + 0.25, r + 0.02], [b - 0.25, r + 0.02], [b - 0.3, r + 0.3], [a + 0.3, r + 0.3]], '#1d1f23');
    smoothFill([[a - 0.42, r + 0.32], [a - 0.2, 2 * r + 0.18], [a + 0.25, 2 * r + 0.2], [a + 0.48, r + 0.36], [b - 0.48, r + 0.36], [b - 0.25, 2 * r + 0.2], [b + 0.25, 2 * r + 0.18], [L, r + 0.32], [b + 0.3, r + 0.25], [a - 0.3, r + 0.25]], pg());
    fill([[a + 0.35, 2 * r + 0.12], [b - 0.35, 2 * r + 0.18], [b - 0.28, 2 * r + 0.26], [a + 0.42, 2 * r + 0.22]], '#141414');   // seat
    if (sh.racks) for (const [x0, x1] of [[0.02, a + 0.3], [b - 0.25, L - 0.02]]) { line([[x0, 2 * r + 0.24], [x1, 2 * r + 0.24]], 0.03, '#1a1a1a'); for (let k = 0; k <= 4; k++) line([[lerp(x0, x1, k / 4), 2 * r + 0.24], [lerp(x0, x1, k / 4), 2 * r + 0.18]], 0.02, '#1a1a1a'); }
    line([[a + 0.3, 2 * r + 0.2], [a + 0.4, 2 * r + 0.42], [a + 0.5, 2 * r + 0.42]], 0.035, '#151515');   // bars
    if (v.decal && v.decal !== 'none') fill([[a - 0.2, 2 * r + 0.1], [a + 0.25, 2 * r + 0.12], [a + 0.25, 2 * r + 0.07], [a - 0.2, 2 * r + 0.05]], v.decalColor || '#f2f2f2');
    g.fillStyle = '#e9f2ff'; g.beginPath(); g.ellipse(X(0.04), Y(2 * r + 0.14), 0.05 * ppm, 0.03 * ppm, 0, 0, 7); g.fill();
  }
  g.restore();
  return canvas;
}

// ------------------------------------------------------------------ the rider
// You (or a traffic rider) on top of the ride, seen from above: legs down the
// sides, arms out to the bars, a helmet on a sportbike, your own hair or hat
// on a cruiser or a quad. On a Slingshot you sit in the left seat.
// (x, y) is the ride's centre on screen, h its heading, zoom pixels/metre.
export function drawRider(ctx, x, y, h, zoom, model, look = {}, opts = {}) {
  const seat = riderSeat(model), sh = shapeOf(model), s = zoom;
  const col = (v, fb) => CLOTH_BY_ID[v]?.color || (typeof v === 'string' && v.startsWith('#') ? v : fb);
  const top = col(look.top, '#24262b');
  const skin = look.skin || '#c68e65';
  const helmet = opts.helmet ?? (sh.style === 'sport' && model.ride === 'moto');
  ctx.save();
  ctx.translate(x, y); ctx.rotate(h);
  ctx.translate(seat.x * s, seat.y * s);
  const lean = opts.lean || 0;                 // into a turn: the body shifts to the inside
  ctx.translate(lean * 0.12 * s, 0);
  if (!seat.seated) {
    // legs to the pegs, arms to the bars
    ctx.fillStyle = col(look.bottom, '#1d2230');
    for (const k of [-1, 1]) { ctx.save(); ctx.translate(k * 0.16 * s, -0.05 * s); ctx.rotate(k * -0.25); ctx.fillRect(-0.06 * s, -0.08 * s, 0.12 * s, 0.38 * s); ctx.restore(); }
    ctx.fillStyle = top;
    const reach = sh.style === 'sport' ? 0.46 : model.ride === 'atv' ? 0.34 : 0.56;
    for (const k of [-1, 1]) { ctx.save(); ctx.translate(k * 0.2 * s, -0.12 * s); ctx.rotate(k * (sh.style === 'sport' ? 0.18 : 0.42)); ctx.fillRect(-0.05 * s, -reach * s, 0.1 * s, reach * s); ctx.restore(); }
  }
  ctx.fillStyle = top;
  ctx.beginPath(); ctx.ellipse(0, (helmet ? -0.08 : 0) * s, 0.23 * s, 0.15 * s, 0, 0, Math.PI * 2); ctx.fill();
  const hy = (helmet ? -0.24 : -0.08) * s;
  if (helmet) {
    const hc = opts.helmetColor || (model.color === '#24262b' ? '#c41b1b' : '#111317');
    ctx.fillStyle = hc; ctx.beginPath(); ctx.ellipse(0, hy, 0.14 * s, 0.16 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(160,190,210,0.7)'; ctx.beginPath(); ctx.ellipse(0, hy - 0.08 * s, 0.09 * s, 0.05 * s, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, hy, 0.12 * s, 0, Math.PI * 2); ctx.fill();
    const hat = CLOTH_BY_ID[look.hat];
    if (hat && hat.style !== 'none') { ctx.fillStyle = hat.color; ctx.beginPath(); ctx.arc(0, hy + 0.01 * s, 0.13 * s, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.save(); ctx.translate(0, hy); drawHairTop(ctx, s, look); ctx.restore(); }
  }
  ctx.restore();
}
